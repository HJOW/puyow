"""learning.py의 모델 계약과 JS/Python 규칙 일치를 확인하는 단위 테스트다."""

import json
import shutil
import subprocess
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

import torch

import learning as training
import pythonserver


class ExistingPolicyLoadTest(unittest.TestCase):
	"""기존 출력 파일이 있을 때만 모델 가중치를 복원하는지 확인한다."""

	def test_existing_checkpoint_restores_policy_weights(self) -> None:
		checkpoint_path = Path("resume.pt")
		saved_policy = training.PolicyNetwork()
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

		loaded_policy = training.PolicyNetwork()
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
		policy = training.PolicyNetwork()

		with mock.patch.object(Path, "exists", return_value=False):
			self.assertFalse(training.load_existing_policy(checkpoint_path, policy, torch.device("cpu")))

	def test_incompatible_checkpoint_is_rejected(self) -> None:
		checkpoint_path = Path("incompatible.pt")
		checkpoint = {
			"model": training.PolicyNetwork().state_dict(),
			"model_version": training.MODEL_VERSION,
			"observation_size": training.OBSERVATION_SIZE - 1,
			"action_count": training.ACTION_COUNT,
		}

		with mock.patch.object(Path, "exists", return_value=True), \
			mock.patch.object(Path, "is_file", return_value=True), \
			mock.patch.object(training.torch, "load", return_value=checkpoint):
			with self.assertRaisesRegex(ValueError, "관측값 또는 행동 계약"):
				training.load_existing_policy(checkpoint_path, training.PolicyNetwork(), torch.device("cpu"))

	def test_checkpoint_without_current_model_version_is_rejected(self) -> None:
		checkpoint = {
			"model": training.PolicyNetwork().state_dict(),
			"observation_size": training.OBSERVATION_SIZE,
			"action_count": training.ACTION_COUNT,
		}
		with mock.patch.object(Path, "exists", return_value=True), \
			mock.patch.object(Path, "is_file", return_value=True), \
			mock.patch.object(training.torch, "load", return_value=checkpoint):
			with self.assertRaisesRegex(ValueError, "모델 버전"):
				training.load_existing_policy(Path("old.pt"), training.PolicyNetwork(), torch.device("cpu"))


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
		observation = pythonserver.build_dqn_observation(prompt)
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
	"""HTTP 서버를 띄우지 않고 is_learning_authorized()를 단위 테스트하기 위한 스텁 핸들러."""

	def __init__(self, authorization: str, client_ip: str) -> None:
		self.headers = _FakeHeaders({"Authorization": authorization} if authorization is not None else {})
		self.client_address = (client_ip, 54321)


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
