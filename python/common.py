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
		_clamp_ratio(attack, 30.0),
		_clamp_ratio(turn, 100.0),
		_clamp_ratio(incoming_damage, 30.0),
		float(bool(fever_rule)),
		float(bool(all_clear_ticket)),
		_clamp_ratio(elapsed_ms, 600_000.0),
		_clamp_ratio(margin_rate, 70.0),
		_clamp_ratio(log2(multiplier), 10.0),
		float(bool(fever_state.get("active", False))),
		_clamp_ratio(fever_state.get("gauge", 0), 7.0),
		_clamp_ratio(fever_state.get("nextTime", fever_state.get("next_time", 15)), 30.0),
		_clamp_ratio(fever_state.get("targetCombo", fever_state.get("target_combo", 5)), 12.0),
		_clamp_ratio(fever_state.get("leftTime", fever_state.get("left_time_ms", 0)), 60_000.0),
		_clamp_ratio(fever_state.get("damage", 0), 30.0),
	))
	if len(values) != OBSERVATION_SIZE:
		raise AssertionError(f"관측값 길이 오류: {len(values)} != {OBSERVATION_SIZE}")
	return values


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
	heights = [
		sum(float(observation[y * BOARD_WIDTH + column]) < 0.5 for y in range(BOARD_HEIGHT))
		for column in range(BOARD_WIDTH)
	]
	if rotation in (ROTATION_UP, ROTATION_DOWN):
		return heights[x] <= BOARD_HEIGHT - 2
	if rotation == ROTATION_RIGHT:
		return x + 1 < BOARD_WIDTH and heights[x] < BOARD_HEIGHT and heights[x + 1] < BOARD_HEIGHT
	return x > 0 and heights[x] < BOARD_HEIGHT and heights[x - 1] < BOARD_HEIGHT
