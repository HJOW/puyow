"""learning.py의 모델 계약과 JS/Python 규칙 일치를 확인하는 단위 테스트다."""

import dataclasses
import importlib.util
import io
import json
import random
import shutil
import string
import subprocess
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

import torch

import common
import learning as training
import lngui
import pythonserver

# lngui.py의 메뉴 테스트는 실제 Tk 창을 만들어 위젯 상태를 확인한다. 화면이 없는 환경(CI 등)에서는
# Tk 초기화 자체가 실패하므로, 여기서 한 번만 확인해 두고 해당 테스트를 통째로 건너뛴다.
try:
	_probe_root = lngui.tk.Tk()
except Exception:
	_TK_AVAILABLE = False
else:
	_TK_AVAILABLE = True
	_probe_root.destroy()


class ExistingPolicyLoadTest(unittest.TestCase):
	"""기존 출력 파일이 있을 때만 모델 가중치를 복원하는지 확인한다."""

	def test_existing_checkpoint_restores_policy_weights(self) -> None:
		checkpoint_path = Path("resume.pt")
		saved_policy = training.ValueNetwork()
		with torch.no_grad():
			for parameter in saved_policy.parameters():
				parameter.fill_(0.25)
		checkpoint = {
			"model": saved_policy.state_dict(),
			"model_version": training.MODEL_VERSION,
			"observation_size": training.OBSERVATION_SIZE,
			"action_count": training.ACTION_COUNT,
			"seed": 2026,
		}

		loaded_policy = training.ValueNetwork()
		with mock.patch.object(Path, "exists", return_value=True), \
			mock.patch.object(Path, "is_file", return_value=True), \
			mock.patch.object(training.torch, "load", return_value=checkpoint) as load_mock:
			resumed = training.load_existing_policy(checkpoint_path, loaded_policy, torch.device("cpu"))

		self.assertTrue(resumed)
		load_mock.assert_called_once_with(checkpoint_path, map_location=torch.device("cpu"), weights_only=True)
		for saved, loaded in zip(saved_policy.parameters(), loaded_policy.parameters()):
			self.assertTrue(torch.equal(saved, loaded))

	def test_missing_checkpoint_keeps_new_policy(self) -> None:
		checkpoint_path = Path("new.pt")
		policy = training.ValueNetwork()

		with mock.patch.object(Path, "exists", return_value=False):
			self.assertFalse(training.load_existing_policy(checkpoint_path, policy, torch.device("cpu")))

	def test_incompatible_checkpoint_is_rejected(self) -> None:
		checkpoint_path = Path("incompatible.pt")
		checkpoint = {
			"model": training.ValueNetwork().state_dict(),
			"model_version": training.MODEL_VERSION,
			"observation_size": training.OBSERVATION_SIZE - 1,
			"action_count": training.ACTION_COUNT,
		}

		with mock.patch.object(Path, "exists", return_value=True), \
			mock.patch.object(Path, "is_file", return_value=True), \
			mock.patch.object(training.torch, "load", return_value=checkpoint):
			with self.assertRaisesRegex(ValueError, "관측값 또는 행동 계약"):
				training.load_existing_policy(checkpoint_path, training.ValueNetwork(), torch.device("cpu"))

	def test_checkpoint_without_current_model_version_is_rejected(self) -> None:
		checkpoint = {
			"model": training.ValueNetwork().state_dict(),
			"observation_size": training.OBSERVATION_SIZE,
			"action_count": training.ACTION_COUNT,
		}
		with mock.patch.object(Path, "exists", return_value=True), \
			mock.patch.object(Path, "is_file", return_value=True), \
			mock.patch.object(training.torch, "load", return_value=checkpoint):
			with self.assertRaisesRegex(ValueError, "모델 버전"):
				training.load_existing_policy(Path("old.pt"), training.ValueNetwork(), torch.device("cpu"))


class RuleStateTest(unittest.TestCase):
	def test_observation_distinguishes_empty_and_garbage_and_contains_rule_state(self) -> None:
		board = training.bundledenemy.new_empty_board()
		board[0][0] = training.bundledenemy.GARBAGE
		observation = training.encode_observation(
			board, (0, 1), 2, 3, incoming_damage=4, fever_rule=True,
			elapsed_ms=320_000, margin_rate=1, time_progress_multiplier=2,
			fever={"active": True, "gauge": 6, "nextTime": 20, "targetCombo": 7, "leftTime": 10000, "damage": 5},
		)
		self.assertEqual(training.OBSERVATION_SIZE, len(observation))
		self.assertEqual(0.0, observation[0].item())
		self.assertEqual(1.0, observation[training.BOARD_WIDTH * training.BOARD_HEIGHT].item())

	def test_margin_rate_and_time_multiplier_boundaries_match_game(self) -> None:
		self.assertEqual(70, training.get_margin_rate(95_999))
		self.assertEqual(52, training.get_margin_rate(96_000))
		self.assertEqual(1, training.get_margin_rate(256_000))
		self.assertEqual(1, training.get_time_progress_multiplier(319_999))
		self.assertEqual(2, training.get_time_progress_multiplier(320_000))
		self.assertEqual(1024, training.get_time_progress_multiplier(600_000))

	def test_fever_uses_game_stage_and_separate_field(self) -> None:
		environment = training.PuyoDuelEnvironment("self", seed=7, fever_rule=True, color_count=3)
		environment.agent_board[0][0] = 0
		environment._activate_fever("agent")
		self.assertTrue(environment.agent_fever.active)
		self.assertEqual(15_000, environment.agent_fever.left_time_ms)
		self.assertEqual(0, environment.agent_board[0][0])
		self.assertTrue(any(cell != training.bundledenemy.EMPTY for row in environment.agent_fever.field for cell in row))

	def test_solomon_prompt_uses_same_time_and_fever_observation_contract(self) -> None:
		prompt = {
			"currentField": {"occupiedCells": [{"x": 0, "y": 0, "color": "garbage"}]},
			"suppliedPuyos": [{"order": "current", "colors": ["red", "green"]}],
			"currentState": {
				"attack": 3, "placedPairCount": 4, "incomingDamage": 5, "feverRule": True,
				"allClearTicket": False, "elapsedMs": 320000, "marginRate": 1,
				"timeProgressMultiplier": 2,
				"fever": {"active": True, "gauge": 7, "nextTime": 20, "targetCombo": 6, "leftTime": 9000, "damage": 2},
			},
		}
		observation = pythonserver.build_model_observation(prompt)
		self.assertEqual(training.OBSERVATION_SIZE, len(observation))
		self.assertEqual(0.0, observation[0])
		self.assertEqual(1.0, observation[training.BOARD_WIDTH * training.BOARD_HEIGHT])


class TrainingControlTest(unittest.TestCase):
	"""lngui.py(GUI 학습기)가 쓰는 일시정지·중단·강제 포기 협조 객체의 계약을 확인한다."""

	def test_pause_blocks_at_boundary_until_resumed(self) -> None:
		control = training.TrainingControl()
		control.request_pause()
		resumed_seen = []

		def waiter() -> None:
			control.check_at_episode_boundary()
			resumed_seen.append(True)

		thread = threading.Thread(target=waiter)
		thread.start()
		try:
			self.assertTrue(control.is_paused())
			# 일시정지 중에는 경계 확인이 끝나지 않아야 한다.
			time.sleep(0.2)
			self.assertEqual([], resumed_seen)
			control.request_resume()
			thread.join(timeout=2)
			self.assertFalse(thread.is_alive())
			self.assertEqual([True], resumed_seen)
			self.assertFalse(control.is_paused())
		finally:
			control.request_abort()  # 테스트 실패로 스레드가 남더라도 정리한다.

	def test_stop_without_pause_returns_immediately(self) -> None:
		control = training.TrainingControl()
		control.request_stop()
		self.assertTrue(control.check_at_episode_boundary())

	def test_stop_wakes_a_paused_wait_without_pausing(self) -> None:
		control = training.TrainingControl()
		control.request_pause()
		results = []

		def waiter() -> None:
			results.append(control.check_at_episode_boundary())

		thread = threading.Thread(target=waiter)
		thread.start()
		time.sleep(0.05)
		control.request_stop()
		thread.join(timeout=2)
		self.assertEqual([True], results)

	def test_abort_raises_immediately_even_when_not_paused(self) -> None:
		control = training.TrainingControl()
		control.request_abort()
		with self.assertRaises(training.TrainingAbort):
			control.check_abort()
		with self.assertRaises(training.TrainingAbort):
			control.check_at_episode_boundary()


class _FakeHeaders(dict):
	"""BaseHTTPRequestHandler.headers를 흉내 내는 최소 스텁이다."""


class _FakeHandler:
	"""HTTP 서버를 띄우지 않고 인증·API 함수를 단위 테스트하기 위한 스텁 핸들러."""

	def __init__(self, authorization: str, client_ip: str, command: str = "POST", body: dict | None = None) -> None:
		headers = {"Authorization": authorization} if authorization is not None else {}
		encoded = json.dumps(body).encode("utf-8") if body is not None else b""
		headers["Content-Length"] = str(len(encoded))
		self.headers = _FakeHeaders(headers)
		self.client_address = (client_ip, 54321)
		self.command = command
		self.rfile = io.BytesIO(encoded)


class LoopbackAuthorizationTest(unittest.TestCase):
	"""`"localhost"` 토큰 호출을 localhost/루프백 클라이언트에만 허용하는지 확인한다."""

	def setUp(self) -> None:
		self._original_token = pythonserver.SERVER_CONFIG["learning_token"]
		pythonserver.SERVER_CONFIG["learning_token"] = "secret-token"

	def tearDown(self) -> None:
		pythonserver.SERVER_CONFIG["learning_token"] = self._original_token

	def test_localhost_token_from_loopback_is_authorized(self) -> None:
		handler = _FakeHandler("Bearer localhost", "127.0.0.1")
		self.assertTrue(pythonserver.is_learning_authorized(handler))

	def test_localhost_token_from_ipv6_loopback_is_authorized(self) -> None:
		handler = _FakeHandler("Bearer localhost", "::1")
		self.assertTrue(pythonserver.is_learning_authorized(handler))

	def test_localhost_token_from_remote_address_is_rejected(self) -> None:
		handler = _FakeHandler("Bearer localhost", "203.0.113.5")
		self.assertFalse(pythonserver.is_learning_authorized(handler))

	def test_empty_token_from_loopback_is_rejected(self) -> None:
		# 빈 문자열 토큰은 루프백 예외 대상이 아니므로, 로컬 호출이라도 다시 거부되어야 한다.
		handler = _FakeHandler("Bearer ", "127.0.0.1")
		self.assertFalse(pythonserver.is_learning_authorized(handler))

	def test_empty_token_from_remote_address_is_rejected(self) -> None:
		handler = _FakeHandler("Bearer ", "203.0.113.5")
		self.assertFalse(pythonserver.is_learning_authorized(handler))

	def test_wrong_token_from_loopback_is_still_rejected(self) -> None:
		handler = _FakeHandler("Bearer wrong-token", "127.0.0.1")
		self.assertFalse(pythonserver.is_learning_authorized(handler))

	def test_correct_token_from_remote_address_is_authorized(self) -> None:
		handler = _FakeHandler("Bearer secret-token", "203.0.113.5")
		self.assertTrue(pythonserver.is_learning_authorized(handler))

	def test_missing_authorization_header_is_rejected(self) -> None:
		handler = _FakeHandler(None, "127.0.0.1")
		self.assertFalse(pythonserver.is_learning_authorized(handler))


class ObservationDecodeTest(unittest.TestCase):
	"""서버가 관측 벡터에서 보드·쌍·상태를 되돌려 읽는 계약을 확인한다."""

	def test_decoded_values_match_the_encoded_observation(self) -> None:
		board = training.bundledenemy.new_empty_board()
		board[0][0] = training.bundledenemy.GARBAGE
		board[1][3] = 4
		observation = training.encode_observation_values(
			board, (0, 2), attack=3, turn=7, incoming_damage=5, fever_rule=True, all_clear_ticket=True,
			elapsed_ms=320_000, margin_rate=52, time_progress_multiplier=4,
			fever={"active": True, "gauge": 6, "nextTime": 20, "targetCombo": 7, "leftTime": 9_000, "damage": 2},
		)

		self.assertEqual(board, common.decode_observation_board(observation))
		self.assertEqual((0, 2), common.decode_observation_pair(observation))
		scalars = common.decode_observation_scalars(observation)
		self.assertEqual(7, round(scalars["turn"]))
		self.assertEqual(52, round(scalars["margin_rate"]))
		self.assertEqual(4, round(scalars["time_progress_multiplier"]))
		self.assertTrue(scalars["fever_rule"])
		self.assertTrue(scalars["fever_active"])


class AfterstateValueTest(unittest.TestCase):
	"""한 수를 둔 직후 상태를 만들고, 그 가치로 배치를 고르고, 목표값을 만드는 계약을 확인한다."""

	class _ZeroValueNetwork:
		"""모든 상태의 가치를 0으로 보는 스텁이다. 이때 선택은 즉시 보상만으로 결정된다."""

		def __call__(self, states: torch.Tensor) -> torch.Tensor:
			return torch.zeros(states.reshape(-1, common.OBSERVATION_SIZE).shape[0])

	def test_illegal_placements_are_not_candidates(self) -> None:
		board = training.bundledenemy.new_empty_board()
		for y in range(training.BOARD_HEIGHT):
			board[y][0] = 0
		observation = training.encode_observation_values(board, (1, 2))
		actions = {afterstate.action for afterstate in training.enumerate_afterstates(observation, (0, 1))}

		# 가득 찬 X=0 열에는 어떤 회전으로도 놓을 수 없고, X=1의 왼쪽 회전도 그 열을 쓴다.
		self.assertNotIn(0, actions)
		self.assertNotIn(1 * 4 + training.bundledenemy.ROTATION_COUNT - 1, actions)
		self.assertTrue(all(training.action_to_placement(action)[0] > 0 for action in actions))

	def test_greedy_choice_takes_the_placement_that_pops(self) -> None:
		board = training.bundledenemy.new_empty_board()
		for x in range(3):
			board[0][x] = 0
		observation = training.encode_observation_values(board, (0, 0))

		action, afterstate = training.select_afterstate(
			self._ZeroValueNetwork(), observation, (1, 2), torch.device("cpu"),
		)

		# 가치가 모두 같으면 즉시 보상이 가장 큰 수, 즉 실제로 폭발하는 배치를 골라야 한다.
		self.assertGreater(afterstate.reward, 0.0)
		self.assertEqual(action, afterstate.action)
		self.assertTrue(all(cell == training.bundledenemy.EMPTY for row in common.decode_observation_board(afterstate.observation) for cell in row))

	def test_n_step_targets_sum_the_following_rewards(self) -> None:
		zero_state = torch.zeros(common.OBSERVATION_SIZE)
		states = [[float(index)] * common.OBSERVATION_SIZE for index in range(3)]
		trajectory = [(states[0], 1.0), (states[1], 2.0), (states[2], 3.0)]

		samples = training.build_value_samples(trajectory, common.LOSS_REWARD, zero_state, n_step=2, gamma=0.5)

		self.assertEqual(3, len(samples))
		# 다음 두 수의 보상을 감가해 더하고, 거기까지 진행한 상태의 가치를 감가해 붙인다.
		self.assertAlmostEqual(2.0 + 0.5 * 3.0, samples[0].partial_return, places=6)
		self.assertAlmostEqual(0.25, samples[0].discount, places=6)
		self.assertTrue(torch.equal(torch.tensor(states[2], dtype=torch.float32), samples[0].bootstrap))
		self.assertAlmostEqual(3.0, samples[1].partial_return, places=6)
		# 승부가 난 마지막 상태의 목표값은 승패 보상 자체다. 이래야 두는 순간 지는 수도 -50으로 평가된다.
		self.assertAlmostEqual(common.LOSS_REWARD, samples[2].partial_return, places=6)
		self.assertEqual(0.0, samples[2].discount)

	def test_unfinished_episode_bootstraps_from_the_last_state(self) -> None:
		zero_state = torch.zeros(common.OBSERVATION_SIZE)
		states = [[float(index)] * common.OBSERVATION_SIZE for index in range(3)]
		trajectory = [(states[0], 1.0), (states[1], 2.0), (states[2], 3.0)]

		samples = training.build_value_samples(trajectory, None, zero_state, n_step=2, gamma=0.5)

		# 최대 턴에서 잘린 에피소드의 마지막 상태는 뒤가 비어 표본으로 쓰지 않는다.
		self.assertEqual(2, len(samples))
		self.assertAlmostEqual(0.5, samples[1].discount, places=6)
		self.assertTrue(torch.equal(torch.tensor(states[2], dtype=torch.float32), samples[1].bootstrap))

	def test_last_move_without_a_landing_folds_the_terminal_value_into_the_target(self) -> None:
		zero_state = torch.zeros(common.OBSERVATION_SIZE)
		state = [1.0] * common.OBSERVATION_SIZE
		# 놓을 자리가 없어 끝난 마지막 수는 애프터스테이트가 없으므로 앞 수의 목표값에 종료 가치를 넣는다.
		trajectory = [(state, 2.0), (None, 0.0)]

		samples = training.build_value_samples(trajectory, common.LOSS_REWARD, zero_state, n_step=2, gamma=0.5)

		self.assertEqual(1, len(samples))
		self.assertAlmostEqual(0.5 * common.LOSS_REWARD, samples[0].partial_return, places=6)
		self.assertEqual(0.0, samples[0].discount)


class TrainingStrategyTest(unittest.TestCase):
	"""연쇄를 더 노리도록 돕는 학습 방식 선택과, 평가가 내는 연쇄 통계를 확인한다."""

	class _ScriptedEnvironment:
		"""정해 둔 연쇄 수를 차례로 돌려주고 마지막 수에 승리로 끝나는 환경 대역이다."""

		def __init__(self, combos: list[int]) -> None:
			self.combos = list(combos)
			self.observation = torch.tensor(
				common.encode_observation_values(training.bundledenemy.new_empty_board(), (0, 1)), dtype=torch.float32,
			)

		def reset(self) -> torch.Tensor:
			return self.observation

		def next_pair_for_agent(self) -> tuple[int, int]:
			return (1, 2)

		def suggest_agent_action(self, _guide: object) -> None:
			return None

		def step(self, _action: int) -> tuple[torch.Tensor, float, bool, dict]:
			combo = self.combos.pop(0)
			if self.combos:
				return self.observation, 0.0, False, {"combo": combo}
			return self.observation, 0.0, True, {"combo": combo, "result": "enemy_defeated", "terminal_value": common.WIN_REWARD}

	def _observation(self) -> list[float]:
		return common.encode_observation_values(training.bundledenemy.new_empty_board(), (0, 1))

	def _train_with_scripted_environment(self, strategy: object, episodes: int) -> dict:
		"""환경을 대역으로 바꿔 학습을 짧게 돌리고, 학습 방식이 건드린 지점을 모아 돌려준다."""
		record: dict = {"created": [], "suggestions": [], "logs": [], "progress": []}

		def make_environment(opponent: str, _seed: int, _self_play: object, chain_seed_ratio: float) -> object:
			record["created"].append((opponent, chain_seed_ratio))
			environment = self._ScriptedEnvironment([0, 0, 3, 0])
			environment.suggest_agent_action = lambda guide: record["suggestions"].append(guide)
			return environment

		with tempfile.TemporaryDirectory() as directory, \
			mock.patch.object(training, "_make_environment", side_effect=make_environment), \
			mock.patch.object(training, "build_value_samples", wraps=training.build_value_samples) as build_samples:
			output = Path(directory) / "strategy.pt"
			training.train(
				episodes, 11, output, "cpu", opponent="Seere", strategy=strategy, log=record["logs"].append,
				on_progress=lambda _done, _total, stats: record["progress"].append(stats),
			)
			record["saved"] = output.is_file()
		record["n_steps"] = [call.kwargs["n_step"] for call in build_samples.call_args_list]
		return record

	def test_standard_strategy_keeps_the_previous_training_settings(self) -> None:
		strategy = training.resolve_training_strategy(training.DEFAULT_TRAINING_STRATEGY)

		self.assertEqual(training.N_STEP_RETURN, strategy.n_step)
		self.assertEqual((0.0, 0.0, 0.0), (strategy.guided_exploration_ratio, strategy.chain_seed_ratio, strategy.solo_episode_ratio))

	def test_unknown_strategy_is_rejected_before_training(self) -> None:
		with tempfile.TemporaryDirectory() as directory:
			output = Path(directory) / "unused.pt"
			with self.assertRaises(ValueError):
				training.train(1, 1, output, "cpu", strategy="missing")
			self.assertFalse(output.exists())

	def test_every_strategy_has_a_korean_label(self) -> None:
		# lngui.py의 한국어 표시는 label_ko가 비면 영어 이름으로 대신하지만, 등록된 방식은 모두 한국어 이름을 갖는다.
		self.assertTrue(all(strategy.label_ko for strategy in training.TRAINING_STRATEGIES.values()))

	def test_exploration_follows_the_suggested_afterstate(self) -> None:
		observation = self._observation()
		target = training.enumerate_afterstates(observation, (1, 2))[-1]

		for _ in range(5):
			action, chosen = training.select_afterstate(
				AfterstateValueTest._ZeroValueNetwork(), observation, (1, 2), torch.device("cpu"), epsilon=1.0,
				explore_fn=lambda afterstates: next(item for item in afterstates if item.action == target.action),
			)
			self.assertEqual(target.action, action)
			self.assertEqual(target.action, chosen.action)

	def test_exploration_falls_back_to_a_random_candidate_without_a_suggestion(self) -> None:
		observation = self._observation()
		legal = {afterstate.action for afterstate in training.enumerate_afterstates(observation, (1, 2))}

		action, chosen = training.select_afterstate(
			AfterstateValueTest._ZeroValueNetwork(), observation, (1, 2), torch.device("cpu"), epsilon=1.0,
			explore_fn=lambda _afterstates: None,
		)

		self.assertIn(action, legal)
		self.assertIsNotNone(chosen)

	def test_guide_enemies_suggest_placeable_actions_in_both_environments(self) -> None:
		environments = (
			training.PuyoDuelEnvironment("Seere", seed=3, fever_rule=False, color_count=4),
			training.PuyoEnvironment(seed=3),
		)
		for environment in environments:
			for guide_type in training.CHAIN_GUIDE_ENEMY_TYPES:
				guide = training.bundledenemy.create_enemy(guide_type, random.Random(1))
				action = environment.suggest_agent_action(guide)
				legal = {
					afterstate.action
					for afterstate in training.enumerate_afterstates(environment.observe(), environment.next_pair_for_agent())
				}
				self.assertIn(action, legal, f"{type(environment).__name__} / {guide_type}")

	def test_chain_seed_ratio_changes_only_the_agent_start_board(self) -> None:
		seed_board = training.bundledenemy.new_empty_board()
		seed_board[0][0] = 1
		with mock.patch.object(training, "build_chain_seed_board", return_value=seed_board):
			duel = training.PuyoDuelEnvironment("Seere", seed=5, fever_rule=False, color_count=4, chain_seed_ratio=1.0)
			solo = training.PuyoEnvironment(seed=5, chain_seed_ratio=1.0)

		self.assertEqual(seed_board, duel.agent_board)
		self.assertTrue(training.bundledenemy.is_board_empty(duel.enemy_board))
		self.assertEqual(seed_board, solo.board)
		# 비율이 0인 기본 방식은 씨앗 보드를 만들지 않는다.
		with mock.patch.object(training, "build_chain_seed_board") as build:
			training.PuyoDuelEnvironment("Seere", seed=5, fever_rule=False, color_count=4)
			training.PuyoEnvironment(seed=5)
		build.assert_not_called()

	@unittest.skipUnless(shutil.which("node"), "Node.js가 없어 실제 피버 패턴을 읽을 수 없습니다.")
	def test_chain_seed_board_is_a_quiet_fever_pattern(self) -> None:
		for color_count in (3, 4, 5):
			boards = [training.build_chain_seed_board(random.Random(seed), color_count) for seed in range(10)]
			seeded = [board for board in boards if board is not None]
			self.assertTrue(seeded)
			for board in seeded:
				cells = [cell for row in board for cell in row if cell != training.bundledenemy.EMPTY]
				self.assertTrue(cells)
				self.assertTrue(all(cell == training.bundledenemy.GARBAGE or 0 <= cell < color_count for cell in cells))
				# 깔자마자 터지거나 패배 칸을 막는 씨앗은 쓰지 않는다.
				self.assertEqual([], training.bundledenemy.find_explosion_groups(board))
				self.assertFalse(training.bundledenemy.is_defeat_board(board))

	def test_standard_training_uses_no_chain_strategy(self) -> None:
		record = self._train_with_scripted_environment(training.DEFAULT_TRAINING_STRATEGY, 3)

		self.assertTrue(record["saved"])
		self.assertEqual([("Seere", 0.0)] * 3, record["created"])
		self.assertEqual([], record["suggestions"])
		self.assertEqual([training.N_STEP_RETURN] * 3, record["n_steps"])
		self.assertEqual([3] * 3, [stats["max_combo"] for stats in record["progress"]])

	def test_training_applies_every_chain_strategy_setting(self) -> None:
		strategy = dataclasses.replace(training.TRAINING_STRATEGIES["chain-all"], solo_episode_ratio=0.5)
		record = self._train_with_scripted_environment(strategy, 6)

		self.assertTrue(record["saved"])
		self.assertTrue(any(line.startswith("training_strategy=chain-all") for line in record["logs"]))
		self.assertEqual({"Seere", "solo"}, {opponent for opponent, _ratio in record["created"]})
		self.assertTrue(all(ratio == strategy.chain_seed_ratio for _opponent, ratio in record["created"]))
		self.assertTrue(record["suggestions"])
		self.assertTrue(all(type(guide).__name__ in training.CHAIN_GUIDE_ENEMY_TYPES for guide in record["suggestions"]))
		self.assertEqual([8] * 6, record["n_steps"])

	def test_evaluation_reports_the_chain_distribution(self) -> None:
		scripts = [[0, 2, 0, 5], [1, 0, 1], [0, 0]]
		with tempfile.TemporaryDirectory() as directory, \
			mock.patch.object(training, "_make_environment", side_effect=lambda *_args: self._ScriptedEnvironment(scripts.pop(0))):
			checkpoint = Path(directory) / "evaluate.pt"
			torch.save({
				"model": training.ValueNetwork().state_dict(), "model_version": training.MODEL_VERSION,
				"observation_size": training.OBSERVATION_SIZE, "action_count": training.ACTION_COUNT, "seed": 1,
			}, checkpoint)
			result = training.evaluate_policy(checkpoint, 3, 1, "cpu", "Seere")

		self.assertEqual(3, result["wins"])
		self.assertEqual({0: 1, 1: 1, 5: 1}, result["max_combo_distribution"])
		self.assertAlmostEqual(2.0, result["average_max_combo"])
		# 터진 수만 센다: 1연쇄 2번, 2연쇄 1번, 5연쇄 1번.
		self.assertEqual({1: 2, 2: 1, 5: 1}, result["combo_distribution"])
		self.assertAlmostEqual(9 / 4, result["average_combo"])
		json.dumps(result)


class RewardWeightTest(unittest.TestCase):
	"""승패·게임 시간·연쇄가 가중치에 반영되는 비율을 확인한다."""

	def test_fever_chain_weight_is_one_fifth_of_the_normal_chain_weight(self) -> None:
		for combo in (1, 2, 5, 7):
			self.assertAlmostEqual(common.chain_reward(combo) / 5.0, common.chain_reward(combo, True), places=6)

	def test_win_and_loss_weight_match_a_seven_chain_outside_fever(self) -> None:
		self.assertAlmostEqual(common.chain_reward(7), common.WIN_REWARD, places=6)
		self.assertAlmostEqual(-common.chain_reward(7), common.LOSS_REWARD, places=6)

	def test_two_chain_weight_matches_one_hundred_twenty_seconds_of_game_time(self) -> None:
		self.assertAlmostEqual(common.chain_reward(2), common.game_time_reward(False, 120_000), places=6)
		self.assertAlmostEqual(-common.chain_reward(2), common.game_time_reward(True, 120_000), places=6)

	def test_game_time_weight_stays_far_below_the_chain_weight(self) -> None:
		# 상한까지 간 게임 시간 항이라도 승패(=비피버 7연쇄) 가중치의 절반을 넘지 않아야 한다.
		longest = common.game_time_reward(False, common.GAME_TIME_REWARD_MAX_MS * 10)
		self.assertLess(longest, common.WIN_REWARD / 2)
		self.assertAlmostEqual(common.game_time_reward(False, common.GAME_TIME_REWARD_MAX_MS), longest, places=6)

	def test_shorter_wins_and_longer_losses_score_higher(self) -> None:
		self.assertGreater(common.terminal_reward(True, 30_000), common.terminal_reward(True, 300_000))
		self.assertGreater(common.terminal_reward(False, 300_000), common.terminal_reward(False, 30_000))
		# 시간 보정이 승패의 부호를 뒤집지는 않는다.
		self.assertGreater(common.terminal_reward(True, common.GAME_TIME_REWARD_MAX_MS), 0.0)
		self.assertLess(common.terminal_reward(False, common.GAME_TIME_REWARD_MAX_MS), 0.0)

	def test_move_reward_keeps_the_attack_term_and_scales_only_the_chain(self) -> None:
		self.assertAlmostEqual(12.0 + common.chain_reward(3), common.move_reward(12.0, 3), places=6)
		self.assertAlmostEqual(12.0 + common.chain_reward(3, True), common.move_reward(12.0, 3, True), places=6)

	def test_afterstate_reward_uses_the_fever_chain_weight(self) -> None:
		board = training.bundledenemy.new_empty_board()
		for x in range(3):
			board[0][x] = 0
		fever = {"active": True, "gauge": 0, "nextTime": 15, "targetCombo": 5, "leftTime": 30_000, "damage": 0}
		normal = training.enumerate_afterstates(common.encode_observation_values(board, (0, 1)), (1, 2))
		feverish = training.enumerate_afterstates(
			common.encode_observation_values(board, (0, 1), fever_rule=True, fever=fever), (1, 2),
		)
		popped = [afterstate for afterstate in normal if afterstate.reward > 0]
		self.assertTrue(popped, "1연쇄가 나는 배치가 있어야 이 비교가 의미를 갖는다.")
		for afterstate in popped:
			same = next(item for item in feverish if item.action == afterstate.action)
			# ATTACK은 그대로이고 연쇄 항만 5분의 1이 된다.
			self.assertLess(same.reward, afterstate.reward)

	def test_duel_terminal_value_falls_for_a_slow_win_and_rises_for_a_long_loss(self) -> None:
		environment = training.PuyoDuelEnvironment("Seere", seed=4, fever_rule=False, color_count=4)
		environment.elapsed_ms = 0.0
		early_win, early_loss = environment.terminal_value(True), environment.terminal_value(False)
		environment.elapsed_ms = 240_000.0
		self.assertLess(environment.terminal_value(True), early_win)
		self.assertGreater(environment.terminal_value(False), early_loss)

	def test_solo_defeat_value_rises_the_longer_the_agent_survives(self) -> None:
		environment = training.PuyoEnvironment(seed=4)
		environment.turn = 0
		immediate = environment._defeat_value()
		environment.turn = 80
		self.assertGreater(environment._defeat_value(), immediate)
		self.assertAlmostEqual(common.LOSS_REWARD, immediate, places=6)


class QuietEdgeEnemyTest(unittest.TestCase):
	"""솔로 플레이 학습 방식이 쓰는 연습 상대의 판단을 확인한다."""

	def test_is_not_picked_by_the_random_opponent_pool(self) -> None:
		self.assertNotIn(training.bundledenemy.QUIET_EDGE_ENEMY_TYPE, training.bundledenemy.TRAINABLE_ENEMY_TYPES)
		self.assertIn(training.bundledenemy.QUIET_EDGE_ENEMY_TYPE, training.bundledenemy.ENEMY_FACTORIES)

	def test_never_pops_while_a_quiet_placement_exists(self) -> None:
		enemy = training.bundledenemy.create_enemy(training.bundledenemy.QUIET_EDGE_ENEMY_TYPE, random.Random(5))
		board = training.bundledenemy.new_empty_board()
		pops = 0
		for turn in range(24):
			pair = (turn % 3, (turn + 1) % 3)
			placement = enemy.decide(board, pair, [(0, 1)], 0.0)
			self.assertIsNotNone(placement)
			quiet_exists = any(
				simulation.combo == 0
				for simulation in training.bundledenemy.prepare_simulations(board, pair)
			)
			board, combo, _attack = training.bundledenemy.resolve_placement(board, pair, placement.positions)
			if combo > 0:
				pops += 1
				self.assertFalse(quiet_exists, f"{turn}턴: 터뜨리지 않는 후보가 있는데도 연쇄를 냈다.")
		self.assertEqual(0, pops)

	def test_fills_the_columns_farthest_from_the_centre_first(self) -> None:
		enemy = training.bundledenemy.create_enemy(training.bundledenemy.QUIET_EDGE_ENEMY_TYPE, random.Random(5))
		board = training.bundledenemy.new_empty_board()
		for turn in range(8):
			pair = (turn % 3, (turn + 1) % 3)
			placement = enemy.decide(board, pair, [(0, 1)], 0.0)
			board, _combo, _attack = training.bundledenemy.resolve_placement(board, pair, placement.positions)
		heights = [sum(1 for row in board if row[x] != training.bundledenemy.EMPTY) for x in range(common.BOARD_WIDTH)]

		# 중앙(X=2,3)에서 가장 먼 양 끝 열부터 고르게 채우고, 그 안쪽과 중앙은 아직 비어 있다.
		self.assertEqual([0, 0, 0, 0], heights[1:5])
		self.assertEqual(heights[0], heights[common.BOARD_WIDTH - 1])
		self.assertGreater(heights[0], 0)

	def test_pops_only_when_no_quiet_placement_is_left(self) -> None:
		# 어떤 자리에 놓아도 터지는 보드를 만들어 대체 판단(가장 작은 연쇄)이 동작하는지 본다.
		board = training.bundledenemy.new_empty_board()
		for x in range(common.BOARD_WIDTH):
			for y in range(3):
				board[y][x] = 0
		enemy = training.bundledenemy.create_enemy(training.bundledenemy.QUIET_EDGE_ENEMY_TYPE, random.Random(5))
		placement = enemy.decide(board, (0, 0), [(0, 1)], 0.0)

		self.assertIsNotNone(placement)
		self.assertGreater(placement.combo, 0)

	def test_returns_none_when_the_field_is_full(self) -> None:
		board = [[0 for _x in range(common.BOARD_WIDTH)] for _y in range(common.BOARD_HEIGHT)]
		enemy = training.bundledenemy.create_enemy(training.bundledenemy.QUIET_EDGE_ENEMY_TYPE, random.Random(5))

		self.assertIsNone(enemy.decide(board, (0, 1), [(0, 1)], 0.0))


class AlternateModelOpponentTest(unittest.TestCase):
	"""대체 모델 상대의 파일 선정·오류 제외·중단 동작을 확인한다."""

	def _write_checkpoint(self, path: Path) -> None:
		"""현재 계약에 맞는 정상 체크포인트 하나를 만든다."""
		torch.save({
			"model": training.ValueNetwork().state_dict(), "model_version": training.MODEL_VERSION,
			"observation_size": training.OBSERVATION_SIZE, "action_count": training.ACTION_COUNT, "seed": 1,
		}, path)

	def test_only_two_or_more_digit_model_files_are_candidates(self) -> None:
		with tempfile.TemporaryDirectory() as directory:
			pool = Path(directory)
			for name in ("model01.pt", "model02.pt", "model100.pt", "default.pt", "model1.pt", "model01.txt", "modelAB.pt"):
				(pool / name).write_bytes(b"x")
			(pool / "model03").mkdir()

			found = [path.name for path in training.find_alternate_model_files(pool)]

		self.assertEqual(["model01.pt", "model02.pt", "model100.pt"], found)

	def test_missing_directory_has_no_candidates(self) -> None:
		with tempfile.TemporaryDirectory() as directory:
			self.assertEqual([], training.find_alternate_model_files(Path(directory) / "absent"))

	def test_selection_is_reproducible_for_the_same_seed(self) -> None:
		files = [Path(f"model{index:02d}.pt") for index in range(1, 6)]
		picks = [
			[
				training.AlternateModelOpponents(torch.device("cpu"), files=files).select(random.Random(seed))
				for _ in range(5)
			]
			for seed in (3, 3)
		]

		self.assertEqual(picks[0], picks[1])

	def test_excluding_a_file_removes_it_from_later_selections(self) -> None:
		opponents = training.AlternateModelOpponents(
			torch.device("cpu"), files=[Path("model01.pt"), Path("model02.pt")],
		)
		opponents.exclude(Path("model01.pt"))

		self.assertEqual([Path("model02.pt")], opponents.remaining)
		self.assertEqual(Path("model02.pt"), opponents.select(random.Random(1)))
		opponents.exclude(Path("model02.pt"))
		self.assertFalse(opponents.has_candidates())
		with self.assertRaises(RuntimeError):
			opponents.select(random.Random(1))

	def test_a_broken_checkpoint_raises_the_alternate_model_error(self) -> None:
		with tempfile.TemporaryDirectory() as directory:
			broken = Path(directory) / "model01.pt"
			broken.write_bytes(b"not a checkpoint")
			decide = training.AlternateModelOpponents(torch.device("cpu"), files=[broken]).action_fn(broken)
			observation = torch.tensor(
				common.encode_observation_values(training.bundledenemy.new_empty_board(), (0, 1)), dtype=torch.float32,
			)
			with self.assertRaises(training.AlternateModelError) as caught:
				decide(observation, (1, 2))

		self.assertEqual(broken, caught.exception.path)

	def test_training_without_any_model_file_stops_before_touching_the_output(self) -> None:
		with tempfile.TemporaryDirectory() as directory:
			pool = Path(directory) / "pool"
			pool.mkdir()
			(pool / "default.pt").write_bytes(b"x")
			output = Path(directory) / "out.pt"
			with mock.patch.object(training, "ALTERNATE_MODEL_DIRECTORY", pool):
				with self.assertRaises(ValueError):
					training.train(1, 1, output, "cpu", strategy="alternate-model")

			self.assertFalse(output.exists())

	def test_failing_models_are_excluded_and_training_stops_when_none_are_left(self) -> None:
		logs: list[str] = []
		progress: list[dict] = []
		with tempfile.TemporaryDirectory() as directory, \
			mock.patch.object(training, "build_value_samples", wraps=training.build_value_samples) as build_samples:
			pool = Path(directory) / "pool"
			pool.mkdir()
			for name in ("model01.pt", "model02.pt"):
				(pool / name).write_bytes(b"not a checkpoint")
			output = Path(directory) / "out.pt"
			with mock.patch.object(training, "ALTERNATE_MODEL_DIRECTORY", pool):
				training.train(
					5, 7, output, "cpu", strategy="alternate-model", log=logs.append,
					on_progress=lambda done, _total, stats: progress.append({"done": done, **stats}),
				)
			saved = output.is_file()

		# 두 파일 모두 대전 중 오류로 제외되고, 세 번째 에피소드를 시작하기 전에 학습이 끝난다.
		self.assertEqual(2, sum(1 for line in logs if line.startswith("alternate_model_failed")))
		self.assertTrue(any(line.startswith("alternate_model_exhausted") for line in logs))
		# 버린 에피소드는 학습 표본을 만들지 않으며, 진행 표시만 다음 칸으로 넘어간다.
		build_samples.assert_not_called()
		self.assertEqual([1, 2], [item["done"] for item in progress])
		self.assertEqual(["alternate_model_failed"] * 2, [item["result"] for item in progress])
		self.assertEqual([0, 0], [item["wins"] + item["losses"] for item in progress])
		# 중단해도 그때까지의 가중치는 정상적으로 저장한다.
		self.assertTrue(saved)

	def test_a_working_model_plays_the_enemy_side_for_a_whole_episode(self) -> None:
		logs: list[str] = []
		with tempfile.TemporaryDirectory() as directory:
			pool = Path(directory) / "pool"
			pool.mkdir()
			self._write_checkpoint(pool / "model01.pt")
			output = Path(directory) / "out.pt"
			with mock.patch.object(training, "ALTERNATE_MODEL_DIRECTORY", pool):
				training.train(1, 7, output, "cpu", strategy="alternate-model", log=logs.append)
			saved = output.is_file()

		self.assertTrue(saved)
		self.assertEqual([], [line for line in logs if line.startswith("alternate_model_")])


class NewTrainingStrategyTest(unittest.TestCase):
	"""TODO로 추가한 학습 방식 두 가지의 등록 내용과 상대 지정을 확인한다."""

	def test_both_strategies_are_registered_with_korean_labels(self) -> None:
		for name in ("solo-play", "alternate-model"):
			strategy = training.TRAINING_STRATEGIES[name]
			self.assertTrue(strategy.label_ko)
			self.assertTrue(strategy.label)
			self.assertTrue(strategy.summary)
			self.assertTrue(strategy.description)

	def test_solo_play_uses_the_quiet_edge_enemy_and_nothing_else(self) -> None:
		strategy = training.TRAINING_STRATEGIES["solo-play"]

		self.assertEqual(training.bundledenemy.QUIET_EDGE_ENEMY_TYPE, strategy.opponent)
		self.assertEqual(
			(0.0, 0.0, 0.0), (strategy.guided_exploration_ratio, strategy.chain_seed_ratio, strategy.solo_episode_ratio),
		)

	def test_alternate_model_strategy_selects_the_model_opponent(self) -> None:
		self.assertEqual(training.ALTERNATE_MODEL_OPPONENT, training.TRAINING_STRATEGIES["alternate-model"].opponent)
		# 기존 --opponent solo(상대 없이 버티기)와 다른 식별자를 써야 커리큘럼 동작이 깨지지 않는다.
		self.assertNotIn(training.ALTERNATE_MODEL_OPPONENT, ("solo", training.PuyoDuelEnvironment.SELF_PLAY_OPPONENT))

	def test_the_strategy_opponent_overrides_the_opponent_argument(self) -> None:
		created: list[str] = []

		def make_environment(opponent: str, _seed: int, _action_fn: object, _chain_seed_ratio: float) -> object:
			created.append(opponent)
			return TrainingStrategyTest._ScriptedEnvironment([0, 1])

		with tempfile.TemporaryDirectory() as directory, \
			mock.patch.object(training, "_make_environment", side_effect=make_environment):
			training.train(
				2, 3, Path(directory) / "out.pt", "cpu", opponent="Seere", strategy="solo-play", log=lambda _message: None,
			)

		self.assertEqual([training.bundledenemy.QUIET_EDGE_ENEMY_TYPE] * 2, created)

	def test_existing_strategies_keep_using_the_given_opponent(self) -> None:
		for name in ("standard", "chain-guided", "chain-curriculum", "long-nstep", "chain-all"):
			self.assertEqual("", training.TRAINING_STRATEGIES[name].opponent, name)


class UsablePlacementTest(unittest.TestCase):
	"""게임이 보낸 배치 후보 안에서만 행동을 고르는지 확인한다."""

	class _RightmostValueNetwork:
		"""오른쪽에 쌓은 애프터스테이트일수록 높은 가치를 돌려주는 고정 가치망 스텁이다."""

		def __call__(self, states: torch.Tensor) -> torch.Tensor:
			boards = [common.decode_observation_board(state.tolist()) for state in states.reshape(-1, common.OBSERVATION_SIZE)]
			return torch.tensor([
				float(sum(x for row in board for x, cell in enumerate(row) if cell != training.bundledenemy.EMPTY))
				for board in boards
			])

	def test_parses_placements_into_action_numbers(self) -> None:
		self.assertIsNone(pythonserver.parse_usable_actions(None))
		self.assertEqual({0, 13, 23}, pythonserver.parse_usable_actions(
			[{"x": 0, "rotation": 0}, {"x": 3, "rotation": 1}, {"x": 5, "rotation": 3}],
		))

	def test_rejects_malformed_placement_lists(self) -> None:
		for value in ([], "all", [{"x": 6, "rotation": 0}], [{"x": 0, "rotation": 4}], [{"x": 0}], [1]):
			with self.assertRaises(pythonserver.ApiError):
				pythonserver.parse_usable_actions(value)

	def test_action_is_chosen_from_the_supplied_placements_only(self) -> None:
		board = training.bundledenemy.new_empty_board()
		observation = training.encode_observation_values(board, (0, 1))
		# 빈 보드에서 가치가 가장 높은 배치는 맨 오른쪽 열(X=5)이지만, 게임이 보낸 후보에는 없다.
		self.assertEqual(20, pythonserver.choose_model_action(self._RightmostValueNetwork(), observation))
		# 후보가 오면 그 안에서만 고른다. 9번(X=2, 오른쪽 회전)이 4번(X=1, 위 회전)보다 오른쪽이다.
		self.assertEqual(9, pythonserver.choose_model_action(self._RightmostValueNetwork(), observation, {4, 9}))

	def test_supplied_placements_win_over_the_observation_height_check(self) -> None:
		board = training.bundledenemy.new_empty_board()
		# 관측값에는 화면 12줄만 담기므로 가득 찬 열의 배치는 높이 조건에서 걸린다.
		for y in range(training.BOARD_HEIGHT):
			board[y][5] = 0
		observation = training.encode_observation_values(board, (0, 1))
		self.assertFalse(pythonserver.is_legal_model_placement(observation, 20))
		# 게임이 숨김 행까지 보고 사용 가능하다고 알려 주면, 12줄로는 결과를 만들 수 없어도 그 판단을 따른다.
		self.assertEqual(20, pythonserver.choose_model_action(self._RightmostValueNetwork(), observation, {20}))

	def test_next_pair_of_the_prompt_becomes_the_afterstate_pair(self) -> None:
		prompt = {"suppliedPuyos": [
			{"order": "current", "colors": ["red", "green"]},
			{"order": "next_1", "colors": ["blue", "purple"]},
		]}
		self.assertEqual(("blue", "purple"), pythonserver.build_model_next_pair(prompt))
		# 예전 클라이언트처럼 다음 쌍을 보내지 않으면 색을 비운 쌍으로 본다.
		self.assertEqual((None, None), pythonserver.build_model_next_pair({"suppliedPuyos": []}))


class SolomonOnlineLearningTest(unittest.TestCase):
	"""Local AI 대전에서 모은 솔로몬의 수를 모델에 반영하는 서버 흐름을 확인한다."""

	def setUp(self) -> None:
		pythonserver.solomon_sessions.clear()

	def tearDown(self) -> None:
		pythonserver.solomon_sessions.clear()

	def _observation(self, board: list[list[int]], pair: tuple[int, int], turn: int) -> list[float]:
		return training.encode_observation_values(board, pair, turn=turn, margin_rate=70, time_progress_multiplier=1)

	def test_reward_uses_the_same_attack_and_combo_contract_as_offline_training(self) -> None:
		board = training.bundledenemy.new_empty_board()
		for x in range(3):
			board[0][x] = 0
		# X=3 세로 배치로 바닥 줄의 같은 색 네 개가 이어져 폭발한다.
		action = 3 * 4 + training.ROTATION_UP
		landing = training.bundledenemy.find_landing_placement(board, 3, training.ROTATION_UP)
		_result, combo, attack = training.bundledenemy.resolve_placement(board, (0, 0), [landing[0], landing[1]])

		afterstate = pythonserver.build_solomon_afterstate(self._observation(board, (0, 0), 5), action, (1, 2))

		self.assertGreater(combo, 0)
		self.assertAlmostEqual(common.move_reward(attack, combo), afterstate.reward, places=6)
		# 애프터스테이트의 조작 쌍은 이번 수가 아니라 다음 수에 내려올 쌍이다.
		self.assertEqual((1, 2), common.decode_observation_pair(afterstate.observation))

	def test_reward_is_zero_when_the_placement_pops_nothing(self) -> None:
		board = training.bundledenemy.new_empty_board()
		self.assertEqual(0.0, pythonserver.build_solomon_afterstate(self._observation(board, (0, 1), 0), 0, (0, 1)).reward)

	def test_consecutive_requests_are_recorded_as_linked_moves(self) -> None:
		board = training.bundledenemy.new_empty_board()

		pythonserver.record_solomon_step("session", self._observation(board, (0, 1), 0), 0)
		pythonserver.record_solomon_step("session", self._observation(board, (1, 2), 1), 4)
		moves = pythonserver.solomon_sessions["session"]["solomon"]["moves"]

		self.assertEqual(2, len(moves))
		self.assertFalse(moves[0]["linked"])
		# 앞 수와 이어지는 수여야 앞 수의 목표값을 만들 수 있다.
		self.assertTrue(moves[1]["linked"])

	def test_player_moves_are_collected_separately_from_the_solomon_moves(self) -> None:
		board = training.bundledenemy.new_empty_board()

		# 솔로몬과 사람은 서로 다음 상태가 이어지지 않으므로 같은 세션에서도 따로 쌓여야 한다.
		pythonserver.record_solomon_step("session", self._observation(board, (0, 1), 0), 0)
		pythonserver.record_solomon_step("session", self._observation(board, (1, 2), 0), 4, side="player")
		pythonserver.record_solomon_step("session", self._observation(board, (2, 3), 1), 8, side="player")
		session = pythonserver.solomon_sessions["session"]

		self.assertEqual(1, len(session["solomon"]["moves"]))
		self.assertEqual(2, len(session["player"]["moves"]))
		self.assertTrue(session["player"]["moves"][1]["linked"])

	def test_turns_played_by_the_fallback_ai_break_the_move_chain(self) -> None:
		board = training.bundledenemy.new_empty_board()

		pythonserver.record_solomon_step("session", self._observation(board, (0, 1), 0), 0)
		# 대체 AI가 두 턴을 대신 두면 그동안 요청이 오지 않아 placedPairCount가 건너뛴다.
		pythonserver.record_solomon_step("session", self._observation(board, (1, 2), 3), 4)
		moves = pythonserver.solomon_sessions["session"]["solomon"]["moves"]

		self.assertFalse(moves[1]["linked"])
		# 앞뒤가 끊긴 수는 다음 상태를 알 수 없으므로 표본으로 만들지 않는다.
		samples = pythonserver._close_solomon_side(
			pythonserver.solomon_sessions["session"]["solomon"], common.WIN_REWARD, 1.0,
		)
		self.assertEqual(1, len(samples))
		self.assertIsNone(samples[0]["bootstrap"])

	def test_finish_closes_the_last_move_with_the_win_reward_and_drops_the_session(self) -> None:
		board = training.bundledenemy.new_empty_board()
		pythonserver.record_solomon_step("session", self._observation(board, (0, 1), 0), 0)
		captured: list[list[dict]] = []

		with mock.patch.object(pythonserver, "train_solomon_samples", side_effect=lambda items: captured.append(items) or 0.5):
			result = pythonserver.finish_solomon_session("session", "win")

		self.assertTrue(result["trained"])
		self.assertEqual(1, result["transitions"])
		self.assertEqual(0, result["playerTransitions"])
		self.assertNotIn("session", pythonserver.solomon_sessions)
		terminal = captured[0][0]
		# 마지막 수 뒤에는 더 진행할 상태가 없으므로 승패 보상만 목표값이 된다.
		self.assertIsNone(terminal["bootstrap"])
		self.assertAlmostEqual(common.WIN_REWARD, terminal["reward"], places=6)
		self.assertAlmostEqual(pythonserver.SOLOMON_DEFAULT_TRAINING_WEIGHT, terminal["weight"], places=6)

	def test_player_moves_are_trained_with_the_win_reward_and_a_higher_weight(self) -> None:
		board = training.bundledenemy.new_empty_board()
		pythonserver.record_solomon_step("session", self._observation(board, (0, 1), 0), 0)
		pythonserver.record_solomon_step("session", self._observation(board, (1, 2), 0), 4, side="player")
		captured: list[list[dict]] = []

		# 솔로몬 기준 loss는 사람이 이겼다는 뜻이므로 사람의 수도 승리 수순으로 학습에 들어간다.
		with mock.patch.object(pythonserver, "train_solomon_samples", side_effect=lambda items: captured.append(items) or 0.5):
			result = pythonserver.finish_solomon_session("session", "loss")

		self.assertEqual(2, result["transitions"])
		self.assertEqual(1, result["playerTransitions"])
		solomon_sample, player_sample = captured[0]
		self.assertAlmostEqual(common.LOSS_REWARD, solomon_sample["reward"], places=6)
		self.assertAlmostEqual(pythonserver.SOLOMON_DEFAULT_TRAINING_WEIGHT, solomon_sample["weight"], places=6)
		self.assertAlmostEqual(common.WIN_REWARD, player_sample["reward"], places=6)
		self.assertAlmostEqual(pythonserver.SOLOMON_PLAYER_WIN_TRAINING_WEIGHT, player_sample["weight"], places=6)

	def test_player_moves_are_dropped_when_the_player_did_not_win(self) -> None:
		board = training.bundledenemy.new_empty_board()
		pythonserver.record_solomon_step("session", self._observation(board, (0, 1), 0), 0)
		pythonserver.record_solomon_step("session", self._observation(board, (1, 2), 0), 4, side="player")
		captured: list[list[dict]] = []

		with mock.patch.object(pythonserver, "train_solomon_samples", side_effect=lambda items: captured.append(items) or 0.5):
			result = pythonserver.finish_solomon_session("session", "win")

		self.assertEqual(1, result["transitions"])
		self.assertEqual(0, result["playerTransitions"])
		self.assertEqual(1, len(captured[0]))

	def test_api_rejects_unauthorized_and_malformed_finish_requests(self) -> None:
		original_token = pythonserver.SERVER_CONFIG["learning_token"]
		pythonserver.SERVER_CONFIG["learning_token"] = "secret-token"
		try:
			body = {"event": "finish", "sessionId": "session", "result": "win"}
			status, payload = pythonserver.solomon_learning_api(_FakeHandler("Bearer wrong", "203.0.113.5", body=body))
			self.assertEqual(401, status)
			self.assertFalse(payload["ok"])

			status, payload = pythonserver.solomon_learning_api(_FakeHandler("Bearer secret-token", "203.0.113.5", command="GET"))
			self.assertEqual(405, status)

			with self.assertRaisesRegex(pythonserver.ApiError, "event"):
				pythonserver.solomon_learning_api(_FakeHandler("Bearer secret-token", "203.0.113.5", body={"event": "reset"}))
			with self.assertRaisesRegex(pythonserver.ApiError, "observation"):
				pythonserver.solomon_learning_api(_FakeHandler(
					"Bearer secret-token", "203.0.113.5", body={"event": "step", "sessionId": "session", "action": 0},
				))
			with self.assertRaisesRegex(pythonserver.ApiError, "result"):
				pythonserver.solomon_learning_api(_FakeHandler(
					"Bearer secret-token", "203.0.113.5", body={"event": "finish", "sessionId": "session", "result": "tie"},
				))
			with self.assertRaisesRegex(pythonserver.ApiError, "learningSessionId"):
				pythonserver.solomon_learning_api(_FakeHandler(
					"Bearer secret-token", "203.0.113.5", body={"event": "finish", "sessionId": "", "result": "win"},
				))
		finally:
			pythonserver.SERVER_CONFIG["learning_token"] = original_token

	def test_api_applies_the_session_when_authorized(self) -> None:
		original_token = pythonserver.SERVER_CONFIG["learning_token"]
		pythonserver.SERVER_CONFIG["learning_token"] = "secret-token"
		try:
			body = {"event": "finish", "sessionId": "session", "result": "loss"}
			with mock.patch.object(pythonserver, "finish_solomon_session", return_value={"trained": True, "transitions": 3}) as finish:
				status, payload = pythonserver.solomon_learning_api(_FakeHandler("Bearer secret-token", "203.0.113.5", body=body))
		finally:
			pythonserver.SERVER_CONFIG["learning_token"] = original_token

		self.assertEqual(200, status)
		finish.assert_called_once_with("session", "loss")
		self.assertEqual({"ok": True, "sessionId": "session", "trained": True, "transitions": 3}, payload)

	def test_api_records_a_step_request_as_a_player_move(self) -> None:
		original_token = pythonserver.SERVER_CONFIG["learning_token"]
		pythonserver.SERVER_CONFIG["learning_token"] = "secret-token"
		board = training.bundledenemy.new_empty_board()
		body = {"event": "step", "sessionId": "session", "observation": self._observation(board, (0, 1), 0), "action": 7}
		try:
			status, payload = pythonserver.solomon_learning_api(_FakeHandler("Bearer secret-token", "203.0.113.5", body=body))
		finally:
			pythonserver.SERVER_CONFIG["learning_token"] = original_token

		self.assertEqual(200, status)
		self.assertEqual({"ok": True, "sessionId": "session", "event": "step"}, payload)
		# 이 API의 step은 항상 사람이 둔 수이므로 솔로몬 쪽에는 아무것도 쌓이지 않아야 한다.
		self.assertEqual(1, len(pythonserver.solomon_sessions["session"]["player"]["moves"]))
		self.assertEqual([], pythonserver.solomon_sessions["session"]["solomon"]["moves"])

	def test_api_uses_the_next_pair_of_a_player_step_for_the_afterstate(self) -> None:
		original_token = pythonserver.SERVER_CONFIG["learning_token"]
		pythonserver.SERVER_CONFIG["learning_token"] = "secret-token"
		board = training.bundledenemy.new_empty_board()
		body = {
			"event": "step", "sessionId": "session", "observation": self._observation(board, (0, 1), 0),
			"action": 0, "nextPair": ["blue", "purple"],
		}
		try:
			pythonserver.solomon_learning_api(_FakeHandler("Bearer secret-token", "203.0.113.5", body=body))
			with self.assertRaisesRegex(pythonserver.ApiError, "nextPair"):
				pythonserver.solomon_learning_api(_FakeHandler("Bearer secret-token", "203.0.113.5", body={**body, "nextPair": ["red"]}))
		finally:
			pythonserver.SERVER_CONFIG["learning_token"] = original_token

		move = pythonserver.solomon_sessions["session"]["player"]["moves"][0]
		self.assertEqual((3, 4), common.decode_observation_pair(move["afterstate"]))

	def test_finish_without_any_request_reports_no_training_data(self) -> None:
		result = pythonserver.finish_solomon_session("missing-session", "loss")

		self.assertFalse(result["trained"])
		self.assertEqual(0, result["transitions"])

	def test_training_keeps_the_checkpoint_contract_and_seed(self) -> None:
		with tempfile.TemporaryDirectory() as directory:
			checkpoint_path = Path(directory) / "online.pt"
			torch.save({
				"model": training.ValueNetwork().state_dict(), "model_version": training.MODEL_VERSION,
				"observation_size": training.OBSERVATION_SIZE, "action_count": training.ACTION_COUNT, "seed": 1234,
			}, checkpoint_path)
			original_path, original_model, original_seed = (
				pythonserver.SERVER_CONFIG["model_path"], pythonserver.value_model, pythonserver.value_model_seed,
			)
			pythonserver.SERVER_CONFIG["model_path"] = checkpoint_path
			pythonserver.value_model = None
			board = training.bundledenemy.new_empty_board()
			samples = [
				{"afterstate": self._observation(board, (0, 1), 0), "reward": 1.0, "bootstrap": None, "weight": 1.0},
				{
					"afterstate": self._observation(board, (1, 2), 1), "reward": 2.0,
					"bootstrap": self._observation(board, (2, 3), 2), "weight": 1.0,
				},
			]
			try:
				pythonserver.train_solomon_samples(samples)
			finally:
				pythonserver.SERVER_CONFIG["model_path"] = original_path
				pythonserver.value_model = original_model
				pythonserver.value_model_seed = original_seed

			saved = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
			self.assertEqual(training.MODEL_VERSION, saved["model_version"])
			self.assertEqual(training.OBSERVATION_SIZE, saved["observation_size"])
			self.assertEqual(training.ACTION_COUNT, saved["action_count"])
			self.assertEqual(1234, saved["seed"])
			# 갱신한 파일을 기존 학습기가 그대로 이어받을 수 있어야 한다.
			self.assertTrue(training.load_existing_policy(checkpoint_path, training.ValueNetwork(), torch.device("cpu")))
			self.assertFalse(checkpoint_path.with_name(checkpoint_path.name + ".tmp").exists())


@unittest.skipUnless(shutil.which("node"), "Node.js가 없어 JS 회귀 비교를 건너뜁니다.")
class JavascriptBoardRegressionTest(unittest.TestCase):
	def test_simulate_placement_board_matches_javascript(self) -> None:
		boards = []
		plain = training.bundledenemy.new_empty_board()
		boards.append((plain, (0, 1), [(0, 0), (0, 1)]))
		garbage = training.bundledenemy.new_empty_board()
		garbage[0][0] = garbage[1][0] = garbage[2][0] = 0
		garbage[0][1] = training.bundledenemy.GARBAGE
		boards.append((garbage, (0, 1), [(0, 3), (2, 0)]))
		color_names = ("red", "green", "yellow", "blue", "purple")
		payload = []
		for board, pair, positions in boards:
			js_board = [[None if cell == -1 else "garbage" if cell == -2 else color_names[cell] for cell in row] for row in board]
			js_board.extend([[None] * training.BOARD_WIDTH for _ in range(13)])
			payload.append({"board": js_board, "colors": [color_names[color] for color in pair], "positions": [{"x": x, "y": y} for x, y in positions]})
		script = "const fs=require('fs'),p=require('./src/js/puyow.js');const c=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(c.map(v=>p.common.simulatePlacementBoard(v.board,v.colors,v.positions))));"
		completed = subprocess.run(
			["node", "-e", script], input=json.dumps(payload), capture_output=True, text=True,
			cwd=Path(__file__).resolve().parents[1], check=True,
		)
		js_results = json.loads(completed.stdout)
		for (board, pair, positions), js_result in zip(boards, js_results):
			python_result = training.bundledenemy.simulate_placement_board(board, pair, positions)
			normalized_js = [[-1 if cell is None else -2 if cell == "garbage" else color_names.index(cell) for cell in row] for row in js_result[:training.BOARD_HEIGHT]]
			self.assertEqual(python_result, normalized_js)


class _StubThread:
	"""살아 있는지 여부만 흉내내는 쓰레드 대역이다. 실제 학습을 돌리지 않고 상태 전이만 확인한다."""

	def __init__(self) -> None:
		self.alive = True

	def is_alive(self) -> bool:
		return self.alive


@unittest.skipUnless(_TK_AVAILABLE, "화면이 없는 환경에서는 Tk 창을 만들 수 없다.")
class TrainerMenuTest(unittest.TestCase):
	"""lngui.py의 File 메뉴(Save As.../Exit) 동작 계약을 확인한다."""

	def setUp(self) -> None:
		self.root = lngui.tk.Tk()
		self.root.withdraw()
		# 이 클래스는 영어 문구를 기준으로 확인한다. 한국어 표시는 TrainerLanguageTest가 맡는다.
		self.app = lngui.TrainerApp(self.root, language=lngui.LANGUAGE_ENGLISH)
		self.directory = Path(tempfile.mkdtemp())
		self.source = self.directory / "model.pt"
		# 실제로 다시 불러올 수 있는 체크포인트를 만들어 둔다.
		torch.save({
			"model": training.ValueNetwork().state_dict(),
			"model_version": training.MODEL_VERSION,
			"observation_size": training.OBSERVATION_SIZE,
			"action_count": training.ACTION_COUNT,
			"seed": 2026,
		}, self.source)
		self.app.output_var.set(str(self.source))

	def tearDown(self) -> None:
		self.app._closed = True
		try:
			self.root.destroy()
		except lngui.tk.TclError:
			# Exit 메뉴를 확인한 테스트는 이미 창을 닫은 뒤다.
			pass
		shutil.rmtree(self.directory, ignore_errors=True)

	def _menu_state(self, index: int) -> str:
		# 메뉴 라벨은 언어마다 달라지므로 앱이 기록한 인덱스로 찾는다.
		return str(self.app.file_menu.entrycget(index, "state"))

	def _drain_queue(self, timeout: float = 30.0) -> None:
		"""저장 쓰레드가 끝나 큐가 비고 잠금이 풀릴 때까지 _poll_queue를 직접 돌린다."""
		deadline = time.monotonic() + timeout
		while time.monotonic() < deadline:
			self.app._poll_queue()
			if self.app.save_thread is None and self.app.log_queue.empty():
				return
			time.sleep(0.02)
		self.fail("저장 작업이 제한 시간 안에 끝나지 않았다.")

	def test_file_menu_has_save_as_and_exit(self) -> None:
		"""File 메뉴에 요구한 두 항목만 있고, 처음에는 둘 다 쓸 수 있어야 한다."""
		labels = [self.app.file_menu.entrycget(index, "label") for index in range(self.app.file_menu.index("end") + 1)]
		self.assertEqual(["Save As...", "Exit"], labels)
		self.assertEqual([self.app._save_as_menu_index, self.app._exit_menu_index], [0, 1])
		self.assertEqual("normal", self._menu_state(self.app._save_as_menu_index))
		self.assertEqual("normal", self._menu_state(self.app._exit_menu_index))

	def test_training_strategy_combobox_lists_every_strategy(self) -> None:
		"""콤보박스는 학습기의 등록표를 그대로 나열하고, 기본 방식을 고른 채 다른 입력란과 함께 잠겨야 한다."""
		labels = [str(label) for label in self.app.strategy_combobox.cget("values")]
		self.assertEqual([strategy.label for strategy in training.TRAINING_STRATEGIES.values()], labels)
		self.assertEqual(training.DEFAULT_TRAINING_STRATEGY, self.app._selected_strategy_name())
		self.assertEqual(
			training.TRAINING_STRATEGIES[training.DEFAULT_TRAINING_STRATEGY].summary, self.app.strategy_summary_var.get(),
		)
		self.app._set_inputs_enabled(False)
		self.assertEqual("disabled", str(self.app.strategy_combobox.cget("state")))
		self.app._set_inputs_enabled(True)
		self.assertEqual("readonly", str(self.app.strategy_combobox.cget("state")))

	def test_alternate_model_strategy_reports_a_missing_model_pool_and_unlocks(self) -> None:
		"""대체 모델 상대로 쓸 파일이 없으면 학습 쓰레드가 오류를 로그로 알리고 조작을 되살려야 한다."""
		alternate = training.TRAINING_STRATEGIES["alternate-model"]
		self.app.strategy_combobox.set(alternate.label)
		self.app._on_strategy_selected()
		self.assertEqual("alternate-model", self.app._selected_strategy_name())
		self.app._set_inputs_enabled(False)
		empty_pool = self.directory / "empty-pool"
		empty_pool.mkdir()
		with mock.patch.object(training, "ALTERNATE_MODEL_DIRECTORY", empty_pool):
			# 학습 쓰레드 본문을 그대로 호출한다. train()이 ValueError로 끝나면 큐에 error가 쌓인다.
			self.app._run_training(1, self.source, "", training.TrainingControl(), "alternate-model")
		self.app._poll_queue()

		self.assertIn("Error:", self.app.log_text.get("1.0", "end"))
		self.assertEqual("Failed.", self.app.status_var.get())
		self.assertEqual("readonly", str(self.app.strategy_combobox.cget("state")))
		self.assertEqual("normal", str(self.app.start_button.cget("state")))

	def test_start_passes_the_selected_strategy_to_training(self) -> None:
		"""Start는 표시 라벨이 아니라 학습 방식 이름을 학습 쓰레드와 learning.train()에 넘겨야 한다."""
		chain_all = training.TRAINING_STRATEGIES["chain-all"]
		self.app.strategy_combobox.set(chain_all.label)
		self.app._on_strategy_selected()
		self.app.episodes_var.set("1")
		with mock.patch.object(lngui.threading, "Thread") as thread_class:
			self.app._on_start()
		self.assertEqual("chain-all", thread_class.call_args.kwargs["args"][-1])
		self.assertEqual(chain_all.summary, self.app.strategy_summary_var.get())

		with mock.patch.object(lngui.learning, "train") as train:
			self.app._run_training(1, self.source, "", training.TrainingControl(), "chain-all")
		self.assertEqual("chain-all", train.call_args.kwargs["strategy"])

	def test_save_as_locks_while_training_and_unlocks_after(self) -> None:
		"""Save As...는 학습 중에 잠기고 학습이 끝나면 다시 열려야 한다."""
		self.app._set_save_as_enabled(False)
		self.assertEqual("disabled", self._menu_state(self.app._save_as_menu_index))
		self.app._reset_controls()
		self.assertEqual("normal", self._menu_state(self.app._save_as_menu_index))
		# Exit는 학습 상태와 무관하게 항상 활성 상태를 유지한다.
		self.assertEqual("normal", self._menu_state(self.app._exit_menu_index))

	def test_save_as_without_model_file_only_logs(self) -> None:
		"""Model output path에 파일이 없으면 대화상자를 열지 않고 안내만 남긴다."""
		self.app.output_var.set(str(self.directory / "missing.pt"))
		with mock.patch.object(lngui.filedialog, "asksaveasfilename", side_effect=AssertionError("대화상자를 열면 안 된다")):
			self.app._on_save_as()
		self.assertIn("no model file", self.app.log_text.get("1.0", "end"))
		self.assertIsNone(self.app.save_thread)

	def test_save_as_cancelled_dialog_does_nothing(self) -> None:
		"""대화상자를 취소하면 아무 작업도 시작하지 않는다."""
		with mock.patch.object(lngui.filedialog, "asksaveasfilename", return_value=""):
			self.app._on_save_as()
		self.assertIsNone(self.app.save_thread)
		self.assertEqual("normal", str(self.app.start_button["state"]))

	def test_save_as_rejects_other_extensions(self) -> None:
		"""pt·onnx가 아닌 확장자는 저장하지 않고 안내만 남긴다."""
		with mock.patch.object(lngui.filedialog, "asksaveasfilename", return_value=str(self.directory / "model.bin")):
			self.app._on_save_as()
		self.assertIn("unsupported extension", self.app.log_text.get("1.0", "end"))
		self.assertIsNone(self.app.save_thread)
		self.assertFalse((self.directory / "model.bin").exists())

	def test_save_as_rejects_same_path(self) -> None:
		"""원본과 같은 파일로 저장하려 하면 복사를 시도하지 않는다."""
		with mock.patch.object(lngui.filedialog, "asksaveasfilename", return_value=str(self.source)):
			self.app._on_save_as()
		self.assertIn("same file", self.app.log_text.get("1.0", "end"))
		self.assertIsNone(self.app.save_thread)

	def test_save_as_pt_copies_checkpoint_and_restores_controls(self) -> None:
		"""pt를 고르면 체크포인트를 그대로 복사하고 Start 버튼을 되살린다."""
		destination = self.directory / "copied.pt"
		with mock.patch.object(lngui.filedialog, "asksaveasfilename", return_value=str(destination)):
			self.app._on_save_as()
		# 저장이 도는 동안에는 Start와 Save As...가 모두 잠겨 있어야 한다.
		self.assertEqual("disabled", str(self.app.start_button["state"]))
		self.assertEqual("disabled", self._menu_state(self.app._save_as_menu_index))
		self._drain_queue()
		self.assertEqual(self.source.read_bytes(), destination.read_bytes())
		# 복사본도 기존 체크포인트 형식 그대로라 다시 불러올 수 있어야 한다.
		training.load_policy_checkpoint(destination, torch.device("cpu"))
		self.assertEqual("normal", str(self.app.start_button["state"]))
		self.assertEqual("normal", self._menu_state(self.app._save_as_menu_index))

	def test_save_as_onnx_uses_progress_bar_and_restores_it(self) -> None:
		"""onnx를 고르면 게이지바로 진행률을 보여 주고, 끝나면 원래 표시로 되돌린다."""
		destination = self.directory / "model.onnx"
		self.app.progress.configure(maximum=5000, value=1234)
		with mock.patch.object(lngui.filedialog, "asksaveasfilename", return_value=str(destination)), \
			mock.patch.object(lngui, "export_checkpoint_to_onnx") as export:
			# 실제 변환은 onnx 패키지가 있어야 하므로, 여기서는 진행 콜백 계약만 확인한다.
			export.side_effect = lambda source, target, progress, **_options: [progress(45, "Converting..."), progress(100, "done")]
			self.app._on_save_as()
			self.assertEqual((5000.0, 1234.0), self.app._progress_backup)
			self._drain_queue()
		export.assert_called_once()
		self.assertEqual(self.source, export.call_args.args[0])
		self.assertEqual(destination, export.call_args.args[1])
		self.assertIsNone(self.app._progress_backup)
		self.assertEqual(5000.0, float(self.app.progress.cget("maximum")))
		self.assertEqual(1234.0, float(self.app.progress.cget("value")))
		self.assertEqual("normal", str(self.app.start_button["state"]))

	def test_save_as_failure_restores_controls(self) -> None:
		"""변환이 실패해도 잠갔던 Start·Save As...를 반드시 되살린다."""
		destination = self.directory / "model.onnx"
		with mock.patch.object(lngui.filedialog, "asksaveasfilename", return_value=str(destination)), \
			mock.patch.object(lngui, "export_checkpoint_to_onnx", side_effect=RuntimeError("boom")):
			self.app._on_save_as()
			self._drain_queue()
		self.assertIn("Save As failed: boom", self.app.log_text.get("1.0", "end"))
		self.assertEqual("normal", str(self.app.start_button["state"]))
		self.assertEqual("normal", self._menu_state(self.app._save_as_menu_index))

	def test_exit_while_idle_closes_immediately(self) -> None:
		"""학습 중이 아니면 Exit는 곧바로 창을 닫는다."""
		with mock.patch.object(self.app.root, "destroy") as destroy:
			self.app._on_exit_menu()
		destroy.assert_called_once()
		self.assertTrue(self.app._closed)

	def test_exit_while_training_saves_before_closing(self) -> None:
		"""학습 중이면 중단 예약만 걸고, 저장이 끝난 뒤에 창을 닫는다."""
		control = training.TrainingControl()
		control.request_pause()
		self.app.control = control
		self.app.thread = _StubThread()

		with mock.patch.object(self.app.root, "destroy") as destroy:
			self.app._on_exit_menu()
			# 이 시점에는 아직 닫히지 않고 중단만 예약되어야 한다.
			destroy.assert_not_called()
			self.assertTrue(control.check_at_episode_boundary(), "중단 예약이 학습 쓰레드에 전달되지 않았다")
			# 종료 절차에 들어가면 모든 버튼과 메뉴가 잠긴다.
			self.assertEqual("disabled", str(self.app.start_button["state"]))
			self.assertEqual("disabled", str(self.app.stop_button["state"]))
			self.assertEqual("disabled", self._menu_state(self.app._save_as_menu_index))
			self.assertEqual("disabled", self._menu_state(self.app._exit_menu_index))

			# learning.train()이 체크포인트를 저장하고 끝난 상황을 재현한다.
			self.app.thread.alive = False
			self.app.log_queue.put(("done", None))
			self.app._poll_queue()
			destroy.assert_called_once()
		# 완료 처리가 잠근 버튼을 다시 살리지 않아야 한다.
		self.assertEqual("disabled", str(self.app.start_button["state"]))

	def test_exit_waits_for_running_save(self) -> None:
		"""저장 작업이 남아 있으면 그 작업이 끝난 뒤에 창을 닫는다."""
		self.app.save_thread = _StubThread()
		with mock.patch.object(self.app.root, "destroy") as destroy:
			self.app._on_exit_menu()
			destroy.assert_not_called()
			self.app.save_thread.alive = False
			self.app._poll_queue()
			destroy.assert_called_once()


class TrainerLocalizationHelperTest(unittest.TestCase):
	"""lngui.py의 번역표·언어 감지·표준 스트림 정리처럼 창 없이 확인할 수 있는 계약을 확인한다."""

	@staticmethod
	def _fields(text: str) -> list[str]:
		return sorted(field for _literal, field, _spec, _conversion in string.Formatter().parse(text) if field)

	def test_both_languages_have_the_same_keys_and_placeholders(self) -> None:
		english = lngui.MESSAGES[lngui.LANGUAGE_ENGLISH]
		korean = lngui.MESSAGES[lngui.LANGUAGE_KOREAN]
		self.assertEqual(set(english), set(korean))
		for key, text in english.items():
			self.assertEqual(self._fields(text), self._fields(korean[key]), key)

	def test_missing_translation_falls_back_to_english(self) -> None:
		with mock.patch.dict(lngui.MESSAGES[lngui.LANGUAGE_KOREAN], clear=True):
			self.assertEqual("Episode 1/2 (wins=0, losses=1)", lngui.translate(
				lngui.LANGUAGE_KOREAN, "status_episode", done=1, total=2, wins=0, losses=1,
			))

	def test_language_is_detected_from_windows_language_ids_and_locale_names(self) -> None:
		self.assertEqual(lngui.LANGUAGE_KOREAN, lngui.language_from_windows_language_id(0x0412))
		self.assertEqual(lngui.LANGUAGE_KOREAN, lngui.language_from_windows_language_id(0x0812))
		self.assertEqual(lngui.LANGUAGE_ENGLISH, lngui.language_from_windows_language_id(0x0409))
		self.assertEqual(lngui.LANGUAGE_ENGLISH, lngui.language_from_windows_language_id(0x0411))
		for name in ("ko_KR.UTF-8", "Korean_Korea", "ko", "ko-KR"):
			self.assertEqual(lngui.LANGUAGE_KOREAN, lngui.language_from_locale_name(name), name)
		for name in ("en_US.UTF-8", "kok_IN", "", None):
			self.assertEqual(lngui.LANGUAGE_ENGLISH, lngui.language_from_locale_name(name), name)
		self.assertIn(lngui.detect_language(), lngui.LANGUAGE_NAMES)

	def test_language_is_detected_from_macos_display_languages(self) -> None:
		# macOS는 `defaults read -g AppleLanguages`가 옛 plist 형식으로 선호 순서를 돌려준다.
		self.assertEqual(lngui.LANGUAGE_KOREAN, lngui.language_from_macos_languages('(\n    "ko-KR",\n    "en-US"\n)\n'))
		self.assertEqual(lngui.LANGUAGE_ENGLISH, lngui.language_from_macos_languages('(\n    "en-US",\n    "ko-KR"\n)\n'))
		self.assertIsNone(lngui.language_from_macos_languages("(\n)\n"))
		self.assertIsNone(lngui.language_from_macos_languages(None))
		# 터미널 밖에서 띄우면 LANG이 없거나 C.UTF-8이라, 표시 언어를 환경 변수보다 먼저 봐야 한다.
		with mock.patch.object(lngui.sys, "platform", "darwin"), \
				mock.patch.dict(lngui.os.environ, {"LANG": "C.UTF-8"}), \
				mock.patch.object(lngui, "macos_ui_language", return_value=lngui.LANGUAGE_KOREAN):
			self.assertEqual(lngui.LANGUAGE_KOREAN, lngui.detect_language())
		# 표시 언어를 읽지 못하면 기존대로 환경 변수로 넘어간다.
		with mock.patch.object(lngui.sys, "platform", "darwin"), \
				mock.patch.dict(lngui.os.environ, {"LANG": "ko_KR.UTF-8"}), \
				mock.patch.object(lngui, "macos_ui_language", return_value=None):
			self.assertEqual(lngui.LANGUAGE_KOREAN, lngui.detect_language())

	def test_standard_streams_survive_characters_outside_the_code_page(self) -> None:
		buffer = io.BytesIO()
		cp949_stream = io.TextIOWrapper(buffer, encoding="cp949")
		with mock.patch.object(lngui.sys, "stdout", cp949_stream), mock.patch.object(lngui.sys, "stderr", None):
			lngui.configure_standard_streams()
			# cp949에 없는 이모지를 써도 예외 없이 이스케이프되어야 한다.
			lngui.sys.stdout.write("학습 완료 ✅\n")
			lngui.sys.stdout.flush()
			# 콘솔이 없어 None이던 표준 오류에는 버리는 스트림이 달린다.
			replaced_stderr = lngui.sys.stderr
			replaced_stderr.write("서버 로그\n")
		replaced_stderr.close()
		self.assertIn("학습 완료".encode("cp949"), buffer.getvalue())
		self.assertIn(b"\\u2705", buffer.getvalue())
		self.assertEqual("cp949", cp949_stream.encoding)


@unittest.skipUnless(_TK_AVAILABLE, "화면이 없는 환경에서는 Tk 창을 만들 수 없다.")
class TrainerLanguageTest(unittest.TestCase):
	"""lngui.py의 한국어 표시·실행 중 언어 전환·동봉 글꼴 적용을 확인한다."""

	def setUp(self) -> None:
		self.root = lngui.tk.Tk()
		self.root.withdraw()
		self.app = lngui.TrainerApp(self.root, language=lngui.LANGUAGE_KOREAN)

	def tearDown(self) -> None:
		self.app._closed = True
		self.root.destroy()

	def test_korean_texts_are_applied_to_the_window_menus_and_widgets(self) -> None:
		self.assertEqual("Puyo W 모델 학습기", self.root.title())
		self.assertEqual("파일", self.app.menubar.entrycget(self.app._file_cascade_index, "label"))
		self.assertEqual("언어 (Language)", self.app.menubar.entrycget(self.app._language_cascade_index, "label"))
		self.assertEqual("다른 이름으로 저장...", self.app.file_menu.entrycget(self.app._save_as_menu_index, "label"))
		self.assertEqual("종료", self.app.file_menu.entrycget(self.app._exit_menu_index, "label"))
		self.assertEqual(["시작", "일시정지", "중단"], [
			str(button["text"]) for button in (self.app.start_button, self.app.pause_button, self.app.stop_button)
		])
		self.assertEqual("대기 중.", self.app.status_var.get())
		labels = [str(label) for label in self.app.strategy_combobox.cget("values")]
		self.assertEqual([strategy.label_ko for strategy in training.TRAINING_STRATEGIES.values()], labels)
		self.assertEqual(training.DEFAULT_TRAINING_STRATEGY, self.app._selected_strategy_name())
		self.assertEqual(
			training.TRAINING_STRATEGIES[training.DEFAULT_TRAINING_STRATEGY].description, self.app.strategy_summary_var.get(),
		)
		# 언어 이름은 번역하지 않는다.
		self.assertEqual(["English", "한국어"], [
			self.app.language_menu.entrycget(index, "label") for index in range(self.app.language_menu.index("end") + 1)
		])

	def test_switching_language_keeps_the_selected_strategy_and_status(self) -> None:
		long_nstep = training.TRAINING_STRATEGIES["long-nstep"]
		self.app.strategy_combobox.set(long_nstep.label_ko)
		self.app._on_strategy_selected()
		self.app._set_status("status_episode", done=3, total=10, wins=2, losses=1)
		self.assertEqual("에피소드 3/10 (승 2, 패 1)", self.app.status_var.get())

		self.app.set_language(lngui.LANGUAGE_ENGLISH)

		self.assertEqual("long-nstep", self.app._selected_strategy_name())
		self.assertEqual(long_nstep.label, self.app.strategy_var.get())
		self.assertEqual(long_nstep.summary, self.app.strategy_summary_var.get())
		self.assertEqual("Episode 3/10 (wins=2, losses=1)", self.app.status_var.get())
		self.assertEqual("Start", str(self.app.start_button["text"]))
		self.assertEqual("Puyo W Model Trainer", self.root.title())
		self.assertEqual(lngui.LANGUAGE_ENGLISH, self.app.language_var.get())
		self.assertEqual("Save As...", self.app.file_menu.entrycget(self.app._save_as_menu_index, "label"))
		# 메뉴를 켜고 끄는 코드는 번역된 라벨이 아니라 인덱스로 찾으므로 언어를 바꿔도 그대로 동작한다.
		self.app._set_save_as_enabled(False)
		self.assertEqual("disabled", str(self.app.file_menu.entrycget(self.app._save_as_menu_index, "state")))
		with self.assertRaises(ValueError):
			self.app.set_language("ja")

	def test_language_menu_switches_the_language(self) -> None:
		self.app.language_var.set(lngui.LANGUAGE_ENGLISH)
		self.app._on_language_selected()
		self.assertEqual(lngui.LANGUAGE_ENGLISH, self.app.language)
		self.assertEqual("Idle.", self.app.status_var.get())

	def test_pause_toggle_does_not_depend_on_the_button_text(self) -> None:
		control = training.TrainingControl()
		self.app.control = control
		self.app._on_pause_resume()
		self.assertTrue(self.app._pause_requested)
		self.assertEqual("재개", str(self.app.pause_button["text"]))
		self.assertEqual("일시정지하는 중 (현재 에피소드를 마치는 중)...", self.app.status_var.get())

		self.app.set_language(lngui.LANGUAGE_ENGLISH)
		self.assertEqual("Resume", str(self.app.pause_button["text"]))
		self.app._on_pause_resume()
		self.assertFalse(self.app._pause_requested)
		self.assertEqual("Pause", str(self.app.pause_button["text"]))
		self.assertEqual("Training...", self.app.status_var.get())

	def test_korean_save_as_messages_are_logged(self) -> None:
		with tempfile.TemporaryDirectory() as directory:
			self.app.output_var.set(str(Path(directory) / "없는 모델.pt"))
			self.app._on_save_as()
		self.assertIn("모델 파일이 없는 경로입니다", self.app.log_text.get("1.0", "end"))

	def test_bundled_font_is_used_when_it_can_be_registered(self) -> None:
		if not lngui.register_bundled_font():
			self.skipTest("동봉 글꼴을 등록할 수 없는 환경이다(Windows가 아니거나 글꼴 파일이 없음).")
		self.assertEqual(lngui.FONT_FAMILY, self.app.font_family)
		self.assertEqual(lngui.FONT_FAMILY, lngui.tkfont.nametofont("TkDefaultFont", root=self.root).actual("family"))
		log_font = lngui.tkfont.Font(root=self.root, font=self.app.log_text.cget("font"))
		self.assertEqual(lngui.FONT_FAMILY, log_font.actual("family"))


class OnnxExportTest(unittest.TestCase):
	"""lngui.py의 체크포인트 복사·ONNX 변환 함수를 확인한다."""

	def setUp(self) -> None:
		self.directory = Path(tempfile.mkdtemp())
		self.source = self.directory / "model.pt"
		torch.save({
			"model": training.ValueNetwork().state_dict(),
			"model_version": training.MODEL_VERSION,
			"observation_size": training.OBSERVATION_SIZE,
			"action_count": training.ACTION_COUNT,
			"seed": 2026,
		}, self.source)

	def tearDown(self) -> None:
		shutil.rmtree(self.directory, ignore_errors=True)

	def test_copy_keeps_bytes_and_reports_progress(self) -> None:
		"""복사본은 원본과 바이트까지 같아야 기존 모델 호환성이 유지된다."""
		destination = self.directory / "nested" / "copy.pt"
		reported: list[int] = []
		lngui.save_checkpoint_copy(self.source, destination, lambda percent, message: reported.append(percent))
		self.assertEqual(self.source.read_bytes(), destination.read_bytes())
		self.assertEqual(100, reported[-1])
		self.assertEqual(sorted(reported), reported, "진행률은 줄어들지 않아야 한다")

	def test_copy_to_a_korean_path_reports_korean_progress(self) -> None:
		"""한글이 들어간 경로에도 복사하고, 한국어로 고르면 진행 문구도 한국어다."""
		destination = self.directory / "한글 폴더" / "복사본 모델.pt"
		messages: list[str] = []
		lngui.save_checkpoint_copy(
			self.source, destination, lambda percent, message: messages.append(message), language=lngui.LANGUAGE_KOREAN,
		)
		self.assertEqual(self.source.read_bytes(), destination.read_bytes())
		self.assertTrue(messages[0].startswith("체크포인트를 복사하는 중"))
		self.assertIn(str(destination), messages[-1])

	@unittest.skipIf(importlib.util.find_spec("onnx") is not None, "onnx가 설치된 환경에서는 안내 경로를 확인할 수 없다.")
	def test_onnx_export_without_package_explains_installation(self) -> None:
		"""onnx가 없으면 변환을 시작하지 않고 설치 방법을 알린다."""
		with self.assertRaises(RuntimeError) as raised:
			lngui.export_checkpoint_to_onnx(self.source, self.directory / "model.onnx")
		self.assertIn("pip3 install onnx", str(raised.exception))
		self.assertFalse((self.directory / "model.onnx").exists())

	@unittest.skipIf(importlib.util.find_spec("onnx") is None, "onnx 패키지가 없으면 변환을 확인할 수 없다.")
	def test_onnx_export_writes_single_file_with_dynamic_batch(self) -> None:
		"""변환 결과는 파일 하나로 완성되고, 배치 축이 열려 있어야 한다."""
		import onnx

		destination = self.directory / "nested" / "model.onnx"
		reported: list[int] = []
		lngui.export_checkpoint_to_onnx(self.source, destination, lambda percent, message: reported.append(percent))
		# 가중치를 옆 파일로 빼면 고른 위치의 파일만 옮겼을 때 모델이 깨진다.
		self.assertEqual(["model.onnx"], [entry.name for entry in destination.parent.iterdir()])
		self.assertEqual(100, reported[-1])
		model = onnx.load(str(destination))
		dimension = lambda value: [d.dim_param or d.dim_value for d in value.type.tensor_type.shape.dim]
		self.assertEqual([lngui.ONNX_BATCH_AXIS_NAME, training.OBSERVATION_SIZE], dimension(model.graph.input[0]))
		self.assertEqual([lngui.ONNX_BATCH_AXIS_NAME], dimension(model.graph.output[0]))

	def test_onnx_export_rejects_incompatible_checkpoint(self) -> None:
		"""모델 버전이 다른 체크포인트는 변환하지 않는다(기존 계약 검증을 그대로 쓴다)."""
		broken = self.directory / "old.pt"
		torch.save({"model": {}, "model_version": training.MODEL_VERSION - 1}, broken)
		with self.assertRaises((ValueError, RuntimeError)):
			lngui.export_checkpoint_to_onnx(broken, self.directory / "old.onnx")


if __name__ == "__main__":
	unittest.main()
