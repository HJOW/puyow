"""learning.py의 모델 계약과 JS/Python 규칙 일치를 확인하는 단위 테스트다."""

import io
import json
import shutil
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
import pythonserver


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


if __name__ == "__main__":
	unittest.main()
