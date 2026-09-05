# 학습 및 웹서버 코드 공통으로 적용될 코드들
#  
# Copyright 2026 HJOW
#
# Apache License 2.0
# 이 프로그램은 Apache License 2.0에 따라 사용할 수 있습니다.
# 라이선스 전문은 프로젝트 루트의 LICENSE 파일을 확인하세요.

"""Puyo W 학습기와 Python 서버가 함께 사용하는 학습 계약 모듈."""

from math import isfinite, log2
from typing import Any, Sequence


# Python 학습 환경과 서버 API에서 공통으로 사용하는 보드 크기다.
BOARD_WIDTH = 6
BOARD_HEIGHT = 12
# 현재 학습 환경에서 사용하는 일반 뿌요 색상 수다.
COLORS = 5
# puyow.js의 회전 계약: 두 번째 뿌요가 회전축 뿌요의 위에 있는 상태다.
ROTATION_UP = 0
# puyow.js의 회전 계약: 두 번째 뿌요가 회전축 뿌요의 오른쪽에 있는 상태다.
ROTATION_RIGHT = 1
# puyow.js의 회전 계약: 두 번째 뿌요가 회전축 뿌요의 아래에 있는 상태다.
ROTATION_DOWN = 2
# puyow.js의 회전 계약: 두 번째 뿌요가 회전축 뿌요의 왼쪽에 있는 상태다.
ROTATION_LEFT = 3
# 한 쌍에 가능한 회전 상태 수다. 행동 번호의 나머지 연산에도 사용한다.
ROTATION_COUNT = 4
# 한 열과 회전 조합으로 표현할 수 있는 전체 행동 수다.
ACTION_COUNT = BOARD_WIDTH * ROTATION_COUNT
# 체크포인트와 관측 계약을 함께 식별한다. 이전 모델과의 묵시적 혼용을 막기 위해
# 관측 구조가 바뀔 때 반드시 이 값도 올린다.
MODEL_VERSION = 2
# 빈 칸, 방해뿌요, 5색을 서로 구분하는 보드 채널 수다.
BOARD_CHANNELS = COLORS + 2
# 공격·룰·실제 경과 시간·피버 상태를 담는 스칼라 수다.
OBSERVATION_SCALAR_COUNT = 14
# 보드 채널, 현재 쌍, 전투/시간/피버 상태를 합친 관측 벡터 길이다.
OBSERVATION_SIZE = BOARD_WIDTH * BOARD_HEIGHT * BOARD_CHANNELS + COLORS * 2 + OBSERVATION_SCALAR_COUNT

# 스칼라 관측값을 0~1로 정규화할 때 쓰는 기준값이다. encode_observation_values와
# decode_observation_scalars가 같은 값을 써야 하므로 한 곳에 모아 둔다. 이 값을 바꾸면 관측
# 계약 자체가 달라지므로 MODEL_VERSION도 함께 올려야 한다.
ATTACK_SCALE = 30.0
TURN_SCALE = 100.0
DAMAGE_SCALE = 30.0
ELAPSED_MS_SCALE = 600_000.0
MARGIN_RATE_SCALE = 70.0
TIME_MULTIPLIER_LOG2_SCALE = 10.0
FEVER_GAUGE_SCALE = 7.0
FEVER_NEXT_TIME_SCALE = 30.0
FEVER_TARGET_COMBO_SCALE = 12.0
FEVER_LEFT_TIME_SCALE = 60_000.0

# 대전 한 판의 승·패에 주는 보상이다. 오프라인 학습(learning.PuyoDuelEnvironment)과 실제 대전에서
# 모은 전이로 추가 학습하는 서버가 같은 크기를 써야 Q값의 기준이 흔들리지 않는다.
WIN_REWARD = 50.0
LOSS_REWARD = -50.0


def _clamp_ratio(value: Any, maximum: float) -> float:
	"""숫자 상태를 0~1 범위로 정규화한다."""
	try:
		number = float(value)
	except (TypeError, ValueError):
		return 0.0
	if not isfinite(number):
		return 0.0
	return min(max(number, 0.0), maximum) / maximum


def _cell_channel(cell: Any) -> int:
	"""Python 정수 보드와 puyow.js 문자열 보드를 같은 채널 번호로 바꾼다."""
	if cell is None or cell == -1:
		return 0
	if cell == -2 or cell == "garbage":
		return 1
	if isinstance(cell, int) and not isinstance(cell, bool) and 0 <= cell < COLORS:
		return cell + 2
	if isinstance(cell, str):
		try:
			return ("red", "green", "yellow", "blue", "purple").index(cell) + 2
		except ValueError:
			pass
	# 학습 범위 밖인 hardGarbage/iron은 방해뿌요처럼 점유된 셀로 인코딩한다.
	return 1


def encode_observation_values(
	board: Sequence[Sequence[Any]], current_pair: Sequence[Any], *, attack: float = 0.0,
	turn: int = 0, incoming_damage: float = 0.0, fever_rule: bool = False,
	all_clear_ticket: bool = False, elapsed_ms: float = 0.0, margin_rate: float = 70.0,
	time_progress_multiplier: float = 1.0, fever: Any = None,
) -> list[float]:
	"""학습기·Python 서버가 공유하는 528개 DQN 관측 벡터를 만든다.

	보드는 y=0이 바닥인 6×12이며, 채널 순서는 빈 칸·방해뿌요·red·green·yellow·blue·purple다.
	"""
	if len(board) < BOARD_HEIGHT or any(len(row) < BOARD_WIDTH for row in board[:BOARD_HEIGHT]):
		raise ValueError("board는 최소 6×12 크기여야 합니다.")
	if len(current_pair) != 2:
		raise ValueError("current_pair는 두 색이어야 합니다.")
	cell_channels = [[_cell_channel(board[y][x]) for x in range(BOARD_WIDTH)] for y in range(BOARD_HEIGHT)]
	values = [
		1.0 if cell_channels[y][x] == channel else 0.0
		for channel in range(BOARD_CHANNELS)
		for y in range(BOARD_HEIGHT)
		for x in range(BOARD_WIDTH)
	]
	for color in current_pair:
		channel = _cell_channel(color)
		# 색 정수는 2~6, 문자열 색도 같은 값이며 빈 칸/방해뿌요는 모두 0으로 남긴다.
		values.extend(1.0 if channel == candidate + 2 else 0.0 for candidate in range(COLORS))
	fever_state = fever if isinstance(fever, dict) else {}
	multiplier = max(1.0, float(time_progress_multiplier or 1.0))
	values.extend((
		_clamp_ratio(attack, ATTACK_SCALE),
		_clamp_ratio(turn, TURN_SCALE),
		_clamp_ratio(incoming_damage, DAMAGE_SCALE),
		float(bool(fever_rule)),
		float(bool(all_clear_ticket)),
		_clamp_ratio(elapsed_ms, ELAPSED_MS_SCALE),
		_clamp_ratio(margin_rate, MARGIN_RATE_SCALE),
		_clamp_ratio(log2(multiplier), TIME_MULTIPLIER_LOG2_SCALE),
		float(bool(fever_state.get("active", False))),
		_clamp_ratio(fever_state.get("gauge", 0), FEVER_GAUGE_SCALE),
		_clamp_ratio(fever_state.get("nextTime", fever_state.get("next_time", 15)), FEVER_NEXT_TIME_SCALE),
		_clamp_ratio(fever_state.get("targetCombo", fever_state.get("target_combo", 5)), FEVER_TARGET_COMBO_SCALE),
		_clamp_ratio(fever_state.get("leftTime", fever_state.get("left_time_ms", 0)), FEVER_LEFT_TIME_SCALE),
		_clamp_ratio(fever_state.get("damage", 0), DAMAGE_SCALE),
	))
	if len(values) != OBSERVATION_SIZE:
		raise AssertionError(f"관측값 길이 오류: {len(values)} != {OBSERVATION_SIZE}")
	return values


def decode_observation_board(observation: Sequence[Any]) -> list[list[int]]:
	"""관측 벡터의 보드 채널을 학습 환경과 같은 정수 보드로 되돌린다.

	반환하는 칸 값은 bundledenemy와 같은 계약이다. 빈 칸은 -1, 방해뿌요는 -2, 일반 색은 0~4다.
	"""
	cells = BOARD_WIDTH * BOARD_HEIGHT
	board: list[list[int]] = []
	for y in range(BOARD_HEIGHT):
		row: list[int] = []
		for x in range(BOARD_WIDTH):
			index = y * BOARD_WIDTH + x
			# 원-핫이므로 값이 가장 큰 채널 하나가 그 칸의 내용이다.
			channel = max(range(BOARD_CHANNELS), key=lambda candidate: float(observation[candidate * cells + index]))
			row.append(-1 if channel == 0 else -2 if channel == 1 else channel - 2)
		board.append(row)
	return board


def decode_observation_pair(observation: Sequence[Any]) -> tuple[int, int]:
	"""관측 벡터의 현재 쌍 원-핫 두 묶음을 색 번호 쌍으로 되돌린다."""
	base = BOARD_WIDTH * BOARD_HEIGHT * BOARD_CHANNELS
	colors: list[int] = []
	for order in range(2):
		offset = base + order * COLORS
		values = [float(observation[offset + color]) for color in range(COLORS)]
		best = max(range(COLORS), key=lambda color: values[color])
		# 조작 쌍이 없는 상태로 만든 관측값은 모든 채널이 0이다. 이 경우 첫 색으로 되돌린다.
		colors.append(best if values[best] > 0.5 else 0)
	return colors[0], colors[1]


def decode_observation_scalars(observation: Sequence[Any]) -> dict[str, Any]:
	"""관측 벡터 끝의 14개 정규화 스칼라를 원래 단위로 되돌린다.

	정규화 때 상한을 넘겨 잘린 값(clamp)은 그 상한으로만 복원된다.
	"""
	base = BOARD_WIDTH * BOARD_HEIGHT * BOARD_CHANNELS + COLORS * 2
	values = [float(observation[base + index]) for index in range(OBSERVATION_SCALAR_COUNT)]
	return {
		"attack": values[0] * ATTACK_SCALE,
		"turn": values[1] * TURN_SCALE,
		"incoming_damage": values[2] * DAMAGE_SCALE,
		"fever_rule": values[3] >= 0.5,
		"all_clear_ticket": values[4] >= 0.5,
		"elapsed_ms": values[5] * ELAPSED_MS_SCALE,
		"margin_rate": values[6] * MARGIN_RATE_SCALE,
		"time_progress_multiplier": 2.0 ** (values[7] * TIME_MULTIPLIER_LOG2_SCALE),
		"fever_active": values[8] >= 0.5,
		"fever_gauge": values[9] * FEVER_GAUGE_SCALE,
		"fever_next_time": values[10] * FEVER_NEXT_TIME_SCALE,
		"fever_target_combo": values[11] * FEVER_TARGET_COMBO_SCALE,
		"fever_left_time": values[12] * FEVER_LEFT_TIME_SCALE,
		"fever_damage": values[13] * DAMAGE_SCALE,
	}


def validate_observation(value: Any, name: str = "observation") -> None:
	"""관측값이 공통 계약에 맞는 유한한 숫자 배열인지 검증한다."""
	if not isinstance(value, list) or len(value) != OBSERVATION_SIZE:
		raise ValueError(f"{name}은(는) 유한한 숫자 {OBSERVATION_SIZE}개 배열이어야 합니다.")
	if any(isinstance(item, bool) or not isinstance(item, (int, float)) or not isfinite(item) for item in value):
		raise ValueError(f"{name}은(는) 유한한 숫자 {OBSERVATION_SIZE}개 배열이어야 합니다.")


def action_to_placement(action: Any) -> tuple[int, int]:
	"""DQN 행동 번호를 게임의 열과 회전값으로 변환한다."""
	if isinstance(action, bool) or not isinstance(action, int) or not 0 <= action < ACTION_COUNT:
		raise ValueError(f"action은(는) 0부터 {ACTION_COUNT - 1} 사이의 정수여야 합니다.")
	return divmod(action, ROTATION_COUNT)


def is_legal_observation_action(observation: Sequence[Any], action: int) -> bool:
	"""관측 벡터의 빈 칸 채널로 한 행동의 기본 착지 가능 여부를 판별한다."""
	x, rotation = action_to_placement(action)
	# Board cells occupy the first one-hot channel (EMPTY), stored as [y][x].
	# EMPTY is 1.0; values below 0.5 therefore represent occupied cells.
	heights = [
		sum(float(observation[y * BOARD_WIDTH + column]) < 0.5 for y in range(BOARD_HEIGHT))
		for column in range(BOARD_WIDTH)
	]
	if rotation in (ROTATION_UP, ROTATION_DOWN):
		return heights[x] <= BOARD_HEIGHT - 2
	if rotation == ROTATION_RIGHT:
		return x + 1 < BOARD_WIDTH and heights[x] < BOARD_HEIGHT and heights[x + 1] < BOARD_HEIGHT
	return x > 0 and heights[x] < BOARD_HEIGHT and heights[x - 1] < BOARD_HEIGHT
