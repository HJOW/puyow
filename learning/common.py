# 학습 및 웹서버 코드 공통으로 적용될 코드들
#  
# Copyright 2026 HJOW
#
# Apache License 2.0
# 이 프로그램은 Apache License 2.0에 따라 사용할 수 있습니다.
# 라이선스 전문은 프로젝트 루트의 LICENSE 파일을 확인하세요.

"""Puyo W 학습기와 Python 서버가 함께 사용하는 학습 계약 모듈."""

from math import isfinite
from typing import Any


# Python 학습 환경과 서버 API에서 공통으로 사용하는 보드 크기다.
BOARD_WIDTH = 6
BOARD_HEIGHT = 12
# 현재 학습 환경에서 사용하는 일반 뿌요 색상 수다.
COLORS = 5
# 한 열과 회전 조합으로 표현할 수 있는 전체 행동 수다.
ACTION_COUNT = BOARD_WIDTH * 4
# 빈 칸·색상 채널, 현재 쌍, 공격량·턴을 합친 관측 벡터 길이다.
OBSERVATION_SIZE = BOARD_WIDTH * BOARD_HEIGHT * (COLORS + 1) + COLORS * 2 + 2


def validate_observation(value: Any, name: str = "observation") -> None:
	"""관측값이 공통 계약에 맞는 유한한 숫자 444개인지 검증한다."""
	if not isinstance(value, list) or len(value) != OBSERVATION_SIZE:
		raise ValueError(f"{name}은(는) 유한한 숫자 {OBSERVATION_SIZE}개 배열이어야 합니다.")
	if any(isinstance(item, bool) or not isinstance(item, (int, float)) or not isfinite(item) for item in value):
		raise ValueError(f"{name}은(는) 유한한 숫자 {OBSERVATION_SIZE}개 배열이어야 합니다.")


def action_to_placement(action: Any) -> tuple[int, int]:
	"""DQN 행동 번호를 게임의 열과 회전값으로 변환한다."""
	if isinstance(action, bool) or not isinstance(action, int) or not 0 <= action < ACTION_COUNT:
		raise ValueError(f"action은(는) 0부터 {ACTION_COUNT - 1} 사이의 정수여야 합니다.")
	return divmod(action, 4)
