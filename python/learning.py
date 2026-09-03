"""Puyo W용 self-play DQN 학습기.

pythonserver.py의 인증된 학습 이벤트 API를 선택적으로 사용한다. 서버 URL을
지정하지 않으면 Puyo W의 핵심 보드 규칙을 작은 독립 환경으로 실행하고,
지정하면 매 에피소드의 관측값·행동·보상·종료 상태를 서버로 전달한다.
브라우저·적 AI가 추가 학습 상태를 읽어야 할 때는 PuyoW.getGameState()의
mode, rule, 양측 board/normalBoard/fever.field 및 앞 두 nextPairs 계약을 사용한다.
학습된 가중치는 PyTorch 체크포인트로 저장된다.
"""

# Puyo W - AI 인공지능용 학습 모델 (LM Studio 호환) 생성기
#
# 이 스크립트에서는 PyTorch 를 이용해 Puyo W 학습 모델을 생성한다.
#    브라우저 전이 전송을 사용할 때는 pythonserver.py를 먼저 구동한다.
#
# 간단 사용법
#     터미널로 프로젝트 최상위 디렉토리로 접근 후 다음 명령어 사용
#
#     python python/learning.py --episodes 1000 --device auto --output python/puyow/default.pt
#
# 자세한 사용법은 docs/MachineLearning.md 참고
#
# 의존성
#    common.py
#    bundledenemy.py
#    torch
#
# Copyright 2026 HJOW
# Licensed under the Apache License, Version 2.0.
# 
# See INFO_FOR_AI.md if you are AI.

import argparse
import json
import math
import random
import os
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Deque, List, Optional, Tuple

import torch
from torch import nn

import bundledenemy
from common import (
	ACTION_COUNT, BOARD_HEIGHT, BOARD_WIDTH, COLORS, MODEL_VERSION, OBSERVATION_SIZE,
	ROTATION_DOWN, ROTATION_LEFT, ROTATION_RIGHT, ROTATION_UP, action_to_placement,
	encode_observation_values, is_legal_observation_action, validate_observation,
)

# CLI(main())와 GUI 학습기(lngui.py)가 함께 참조하는 기본값이다. GUI는 시드·디바이스·상대는
# 이 값을 그대로 쓰고, 모델 경로·에피소드 수·서버 주소만 사용자 입력으로 받는다.
DEFAULT_SEED = 2026
DEFAULT_DEVICE = "auto"
DEFAULT_OPPONENT = "random"
DEFAULT_OUTPUT = Path("python/puyow/default.pt")


class LearningApiClient:
	"""pythonserver.py의 인증된 학습 이벤트 API 클라이언트.

	토큰으로 `"localhost"`를 넣으면 pythonserver.py가 실제로 localhost/루프백 주소에서 온
	요청일 때만 서버 설정 토큰과 무관하게 허용한다(원격 서버는 그대로 거부한다). GUI 학습기
	(lngui.py)가 기본으로 채우는 로컬 서버 주소는 이 값으로 별도 토큰 설정 없이 사용한다.
	빈 문자열은 이 예외에 해당하지 않으므로 허용되지 않는다.
	"""

	def __init__(self, server_url: str, token: str, timeout: float = 10.0) -> None:
		if not token:
			raise ValueError("API를 사용할 때는 --api-token 또는 PUYOW_AI_TOKEN이 필요합니다.")
		self.endpoint = server_url.rstrip("/") + "/apis/learning"
		self.token = token
		self.timeout = timeout

	def send(self, payload: dict) -> dict:
		request = urllib.request.Request(
			self.endpoint,
			data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
			headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"},
			method="POST",
		)
		try:
			with urllib.request.urlopen(request, timeout=self.timeout) as response:
				result = json.loads(response.read().decode("utf-8"))
		except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as error:
			raise RuntimeError(f"학습 API 요청 실패: {error}") from error
		if not result.get("ok"):
			raise RuntimeError(f"학습 API가 요청을 거부했습니다: {result.get('error', '알 수 없는 오류')}")
		return result

	def reset(self, session_id: str, observation: torch.Tensor) -> dict:
		return self.send({"event": "reset", "sessionId": session_id, "observation": observation.tolist()})

	def step(self, session_id: str, state: torch.Tensor, action: int, reward: float, next_state: torch.Tensor, done: bool) -> dict:
		return self.send({
			"event": "step",
			"sessionId": session_id,
			"observation": state.tolist(),
			"action": action,
			"reward": reward,
			"nextObservation": next_state.tolist(),
			"done": done,
		})

	def episode_end(self, session_id: str) -> dict:
		return self.send({"event": "episode_end", "sessionId": session_id, "done": True})


@dataclass
class Transition:
	state: torch.Tensor
	action: int
	reward: float
	next_state: torch.Tensor
	done: bool


def encode_observation(
	board: List[List[int]], current_pair: Tuple[int, int], attack: float, turn: int, *,
	incoming_damage: float = 0.0, fever_rule: bool = False, all_clear_ticket: bool = False,
	elapsed_ms: float = 0.0, margin_rate: float = 70.0, time_progress_multiplier: float = 1.0,
	fever: Optional[dict[str, Any]] = None,
) -> torch.Tensor:
	"""보드·현재 쌍·전투/시간/피버 상태를 공통 DQN 관측 벡터로 인코딩한다."""
	return torch.tensor(encode_observation_values(
		board, current_pair, attack=attack, turn=turn, incoming_damage=incoming_damage,
		fever_rule=fever_rule, all_clear_ticket=all_clear_ticket, elapsed_ms=elapsed_ms,
		margin_rate=margin_rate, time_progress_multiplier=time_progress_multiplier, fever=fever,
	), dtype=torch.float32)


MARGIN_RATE_SCHEDULE = (
	(0, 70), (96, 52), (112, 34), (128, 25), (144, 16), (160, 12),
	(176, 8), (192, 6), (208, 4), (224, 3), (240, 2), (256, 1),
)
ALL_CLEAR_TICKET_ATTACK = 30.0
FEVER_GAUGE_MAX = 7
FEVER_INITIAL_TARGET_COMBO = 5
FEVER_INITIAL_TIME = 15
FEVER_MAX_TIME = 30
FEVER_MIN_TARGET_COMBO = 4
FEVER_MAX_TARGET_COMBO = 12
FEVER_CHAIN_TIME_BONUS_MS = 2_000
_FEVER_STAGES: Optional[list[dict[str, Any]]] = None


def get_margin_rate(elapsed_ms: float) -> float:
	"""puyow.js와 같은 경과 시간별 마진 레이트를 반환한다."""
	elapsed_second = max(0, int(elapsed_ms // 1000))
	return float(next(rate for start, rate in reversed(MARGIN_RATE_SCHEDULE) if elapsed_second >= start))


def get_time_progress_multiplier(elapsed_ms: float) -> float:
	"""300초 이후 20초마다 두 배, 최대 1024인 시간 진행 배율을 반환한다."""
	elapsed_second = max(0, int(elapsed_ms // 1000))
	increase_count = max(0, (elapsed_second - 300) // 20)
	return float(min(1024, 2 ** increase_count))


def calculate_fever_target(combo: int, all_clear: bool, previous_target: int) -> int:
	"""실제 게임과 같은 다음 피버 목표 연쇄를 계산한다."""
	next_target = max(FEVER_MIN_TARGET_COMBO, min(FEVER_MAX_TARGET_COMBO, combo + 1 + (2 if all_clear else 0)))
	return max(next_target, previous_target - 1)


def load_fever_stage_definitions() -> list[dict[str, Any]]:
	"""puyow.js가 공개하는 실제 FEVER_STAGES 데이터를 Node로 한 번만 읽는다."""
	global _FEVER_STAGES
	if _FEVER_STAGES is not None:
		return _FEVER_STAGES
	game_source = Path(__file__).resolve().parents[1] / "src" / "js" / "puyow.js"
	script = "const p=require(process.argv[1]);process.stdout.write(JSON.stringify(p.common.getFeverStageDefinitions()));"
	try:
		completed = subprocess.run(
			["node", "-e", script, str(game_source)], check=True, capture_output=True, text=True, encoding="utf-8",
		)
		stages = json.loads(completed.stdout)
	except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
		raise RuntimeError("실제 피버 스테이지를 src/js/puyow.js에서 읽지 못했습니다. Node.js와 게임 소스를 확인하세요.") from error
	if not isinstance(stages, list) or not stages:
		raise RuntimeError("src/js/puyow.js에 사용할 수 있는 피버 스테이지가 없습니다.")
	_FEVER_STAGES = stages
	return _FEVER_STAGES


@dataclass
class FeverState:
	"""Puyo W 플레이어별 피버 룰 상태."""
	active: bool = False
	gauge: int = 0
	next_time: int = FEVER_INITIAL_TIME
	target_combo: int = FEVER_INITIAL_TARGET_COMBO
	left_time_ms: float = 0.0
	field: Optional[List[List[int]]] = None
	damage: float = 0.0
	turn: int = 0

	def observation(self) -> dict[str, Any]:
		return {
			"active": self.active, "gauge": self.gauge, "nextTime": self.next_time,
			"targetCombo": self.target_combo, "leftTime": self.left_time_ms, "damage": self.damage,
		}


class PuyoEnvironment:
	"""간결한 단일 플레이어 Puyo W 보드 환경. board[y][x]에서 y=0은 바닥이다.

	상대 없이 "죽지 않고 버티기"만 학습하는 구모드다. 기본값은 PuyoDuelEnvironment(적 AI와
	실제로 대전하며 학습)이며, 이 클래스는 --opponent solo로 선택했을 때만 쓰인다.
	"""

	def __init__(self, seed: int | None = None) -> None:
		self.random = random.Random(seed)
		self.board: List[List[int]] = []
		self.current_pair: Tuple[int, int] = (0, 0)
		self.next_pair: Tuple[int, int] = (0, 0)
		self.attack = 0
		self.turn = 0
		self.reset()

	def _pair(self) -> Tuple[int, int]:
		return self.random.randrange(COLORS), self.random.randrange(COLORS)

	def reset(self) -> torch.Tensor:
		self.board = [[-1 for _ in range(BOARD_WIDTH)] for _ in range(BOARD_HEIGHT)]
		self.current_pair = self._pair()
		self.next_pair = self._pair()
		self.attack = 0
		self.turn = 0
		return self.observe()

	def observe(self) -> torch.Tensor:
		return encode_observation(self.board, self.current_pair, self.attack, self.turn)

	def _cells_for_action(self, action: int) -> List[Tuple[int, int, int]] | None:
		"""공통 회전 계약으로 현재 쌍이 착지할 두 칸을 계산한다."""
		column, rotation = action_to_placement(action)
		first, second = self.current_pair
		heights = [sum(self.board[y][x] >= 0 for y in range(BOARD_HEIGHT)) for x in range(BOARD_WIDTH)]
		# 위·아래 회전은 같은 열에 두 칸을 사용하며, 회전축 뿌요의 높이만 서로 다르다.
		if rotation == ROTATION_UP:
			if heights[column] + 1 >= BOARD_HEIGHT:
				return None
			return [(column, heights[column], first), (column, heights[column] + 1, second)]
		if rotation == ROTATION_DOWN:
			if heights[column] + 1 >= BOARD_HEIGHT:
				return None
			return [(column, heights[column] + 1, first), (column, heights[column], second)]
		# 오른쪽·왼쪽 회전은 회전축 열과 인접 열에 각각 한 칸씩 착지한다.
		second_column = column + 1 if rotation == ROTATION_RIGHT else column - 1
		if second_column < 0 or second_column >= BOARD_WIDTH:
			return None
		if heights[column] >= BOARD_HEIGHT or heights[second_column] >= BOARD_HEIGHT:
			return None
		return [(column, heights[column], first), (second_column, heights[second_column], second)]

	def _resolve(self) -> Tuple[int, int]:
		chain = 0
		cleared = 0
		while True:
			visited = set()
			groups = []
			for y in range(BOARD_HEIGHT):
				for x in range(BOARD_WIDTH):
					if (x, y) in visited or self.board[y][x] < 0:
						continue
					color = self.board[y][x]
					stack = [(x, y)]
					group = []
					visited.add((x, y))
					while stack:
						cx, cy = stack.pop()
						group.append((cx, cy))
						for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
							if 0 <= nx < BOARD_WIDTH and 0 <= ny < BOARD_HEIGHT and (nx, ny) not in visited and self.board[ny][nx] == color:
								visited.add((nx, ny))
								stack.append((nx, ny))
					if len(group) >= 4:
						groups.append(group)
			if not groups:
				break
			chain += 1
			removed = {cell for group in groups for cell in group}
			cleared += len(removed)
			for x, y in removed:
				self.board[y][x] = -1
			for x in range(BOARD_WIDTH):
				remaining = [self.board[y][x] for y in range(BOARD_HEIGHT) if self.board[y][x] >= 0]
				for y in range(BOARD_HEIGHT):
					self.board[y][x] = remaining[y] if y < len(remaining) else -1
		return cleared, chain

	def step(self, action: int) -> Tuple[torch.Tensor, float, bool, dict]:
		cells = self._cells_for_action(action)
		if cells is None:
			return self.observe(), -2.0, True, {"invalid": True}
		for x, y, color in cells:
			self.board[y][x] = color
		cleared, chain = self._resolve()
		reward = float(cleared + chain * chain * 3)
		self.attack += max(0, chain - 1) + cleared // 4
		self.current_pair = self.next_pair
		self.next_pair = self._pair()
		self.turn += 1
		defeated = self.board[BOARD_HEIGHT - 1][2] >= 0
		return self.observe(), reward - (20.0 if defeated else 0.0), defeated, {"cleared": cleared, "chain": chain}


def _apply_attack_exchange(attacker_pending_damage: float, attack_generated: float, defender_pending_damage: float) -> Tuple[float, float]:
	"""puyow.js의 sendAttackEnergy/deliverFinalAttackEnergy를 한 턴 단위로 단순화한 버전이다.

	이번 수로 만든 ATTACK은 먼저 공격한 쪽 자신의 미정산 피해(pending_damage)를 상쇄하고,
	남는 양만큼만 상대의 미정산 피해로 넘어간다. 실제 게임은 연쇄 단계마다 상쇄가 여러 번
	일어나고 상대의 미도착 ATTACK까지 함께 상쇄하지만, 이 환경은 턴을 번갈아 완전히 해소하므로
	상대의 ATTACK이 상쇄 시점에 미도착 상태로 남아 있는 경우가 없어 그 부분은 자연히 생략된다.
	"""
	amount = math.floor(attack_generated)
	if amount < 1:
		return attacker_pending_damage, defender_pending_damage
	cancelled = min(amount, math.floor(attacker_pending_damage))
	attacker_pending_damage -= cancelled
	defender_pending_damage += (amount - cancelled)
	return attacker_pending_damage, defender_pending_damage


class PuyoDuelEnvironment:
	"""puyow.js에 탑재된 적 AI(bundledenemy) 또는 학습 중인 정책 자신과 실제로 대전하며 학습하는 2인용 환경이다.

	매 step()은 학습 중인 에이전트가 한 수를 두고 판정한 뒤, 곧바로 상대가 자신의 판단으로
	한 수를 두는 것까지 함께 처리한다. 상대는 bundledenemy의 Enemy 하위 클래스이거나(적 AI
	대전), 그 자리에 SELF_PLAY_OPPONENT를 골랐다면 `self_play_action_fn`으로 전달받은 학습
	중인 정책 자신이다(self-play). 관측값은 PuyoEnvironment와 같은 계약(encode_observation)을
	쓰며 에이전트 자신의 보드만 담는다.

	기본 룰/피버 룰, 색상 수(3~5색)는 에피소드(대전)마다 무작위로 정해진다. 이 포팅의 피버
	룰이 실제로 얼마나 단순화되어 있는지는 bundledenemy.py 모듈 docstring을 참고한다.

	보상은 이번 수의 ATTACK(연쇄가 클수록, 많이 지울수록 커진다)과 연쇄 수 제곱에 비례하는
	보너스를 기본으로 하고, 상대를 이기거나 지면 WIN_REWARD/LOSS_REWARD를 더한다. TODO.md가
	이 모델의 목적으로 "게임 승리가 연쇄보다 더 중요하다"를 명시하고 있어, 승패 보너스를
	한 수의 전형적인 ATTACK 보상보다 훨씬 크게 잡았다.
	"""

	# 학습 중인 정책이 자기 자신과 대전하는 self-play를 나타내는 opponent_type 값이다.
	# bundledenemy에는 대응하는 클래스가 없으므로(신경망 기반 결정이라) 이 모듈에서만 쓴다.
	SELF_PLAY_OPPONENT = "self"
	COLOR_COUNT_CHOICES: Tuple[int, ...] = (3, 4, 5)

	MAX_TURNS_PER_EPISODE = 150
	# 브라우저에서는 game.elapsed의 실제 밀리초를 관측한다. 오프라인 고속 학습에는 벽시계가
	# 의미 없으므로 한 번의 양측 턴을 실제 플레이의 대표값인 3초로 진행시킨다.
	DUEL_TURN_DURATION_MS = 3_000
	WIN_REWARD = 50.0
	LOSS_REWARD = -50.0
	INVALID_ACTION_REWARD = -5.0
	NEXT_PAIR_LOOKAHEAD = 8

	def __init__(
		self,
		opponent_type: Optional[str] = None,
		seed: Optional[int] = None,
		fever_rule: Optional[bool] = None,
		color_count: Optional[int] = None,
		self_play_action_fn: Optional[Callable[[torch.Tensor], int]] = None,
	) -> None:
		self.random = random.Random(seed)
		self.opponent_type = opponent_type
		self._fever_rule_setting = fever_rule
		self._color_count_setting = color_count
		self.self_play_action_fn = self_play_action_fn
		self.opponent: Optional[bundledenemy.BaseEnemy] = None
		self.is_self_play = False
		self.fever_rule = False
		self.color_count = COLORS
		self.agent_board: List[List[int]] = []
		self.enemy_board: List[List[int]] = []
		self.agent_pair: Tuple[int, int] = (0, 0)
		self.enemy_pair: Tuple[int, int] = (0, 0)
		self.agent_next_pairs: List[Tuple[int, int]] = []
		self.enemy_next_pairs: List[Tuple[int, int]] = []
		self.agent_damage = 0.0
		self.enemy_damage = 0.0
		self.agent_attack = 0.0
		self.enemy_attack = 0.0
		self.agent_all_clear_ticket = False
		self.enemy_all_clear_ticket = False
		self.agent_fever = FeverState()
		self.enemy_fever = FeverState()
		self.elapsed_ms = 0.0
		self.margin_rate = 70.0
		self.time_progress_multiplier = 1.0
		self.turn = 0
		self.reset()

	def _pair(self) -> Tuple[int, int]:
		return self.random.randrange(self.color_count), self.random.randrange(self.color_count)

	def _select_opponent_type(self) -> str:
		if self.opponent_type:
			return self.opponent_type
		pool = (self.SELF_PLAY_OPPONENT,) + bundledenemy.TRAINABLE_ENEMY_TYPES
		return self.random.choice(pool)

	def reset(self) -> torch.Tensor:
		selected_opponent = self._select_opponent_type()
		self.is_self_play = selected_opponent == self.SELF_PLAY_OPPONENT
		# 적 인스턴스는 단탈리온의 진행 단계, 세레의 공격 시뮬레이션 주기처럼 턴을 넘나드는
		# 상태를 인스턴스에 보관하므로, 매 에피소드(=매 대전)마다 새로 만들어야 한다.
		self.opponent = None if self.is_self_play else bundledenemy.create_enemy(selected_opponent, random.Random(self.random.randrange(2 ** 30)))
		self.fever_rule = self._fever_rule_setting if self._fever_rule_setting is not None else self.random.random() < 0.5
		# bundledenemy는 프로세스 전역 상태 하나로 현재 룰을 추적한다(모듈의 configure_rule
		# docstring 참고). 이 학습 스크립트는 한 번에 환경 하나만 순차로 진행하므로 안전하다.
		bundledenemy.configure_rule(self.fever_rule)
		self.color_count = self._color_count_setting or self.random.choice(self.COLOR_COUNT_CHOICES)
		self.agent_board = bundledenemy.new_empty_board()
		self.enemy_board = bundledenemy.new_empty_board()
		self.agent_damage = 0.0
		self.enemy_damage = 0.0
		self.agent_attack = 0.0
		self.enemy_attack = 0.0
		self.agent_all_clear_ticket = False
		self.enemy_all_clear_ticket = False
		self.agent_fever = FeverState(field=bundledenemy.new_empty_board())
		self.enemy_fever = FeverState(field=bundledenemy.new_empty_board())
		self.elapsed_ms = 0.0
		self.margin_rate = get_margin_rate(self.elapsed_ms)
		self.time_progress_multiplier = get_time_progress_multiplier(self.elapsed_ms)
		bundledenemy.configure_timing(self.margin_rate, self.time_progress_multiplier)
		self.agent_pair = self._pair()
		self.enemy_pair = self._pair()
		self.agent_next_pairs = [self._pair() for _ in range(self.NEXT_PAIR_LOOKAHEAD)]
		self.enemy_next_pairs = [self._pair() for _ in range(self.NEXT_PAIR_LOOKAHEAD)]
		self.turn = 0
		return self.observe()

	def observe(self) -> torch.Tensor:
		return self._observe_side("agent")

	def _fever(self, side: str) -> FeverState:
		return self.agent_fever if side == "agent" else self.enemy_fever

	def _board(self, side: str) -> List[List[int]]:
		state = self._fever(side)
		if self.fever_rule and state.active:
			return state.field
		return self.agent_board if side == "agent" else self.enemy_board

	def _set_board(self, side: str, board: List[List[int]]) -> None:
		state = self._fever(side)
		if self.fever_rule and state.active:
			state.field = board
		elif side == "agent":
			self.agent_board = board
		else:
			self.enemy_board = board

	def _damage(self, side: str) -> float:
		state = self._fever(side)
		if self.fever_rule and state.active:
			return state.damage
		return self.agent_damage if side == "agent" else self.enemy_damage

	def _set_damage(self, side: str, damage: float) -> None:
		state = self._fever(side)
		if self.fever_rule and state.active:
			state.damage = damage
		elif side == "agent":
			self.agent_damage = damage
		else:
			self.enemy_damage = damage

	def _observe_side(self, side: str) -> torch.Tensor:
		pair = self.agent_pair if side == "agent" else self.enemy_pair
		attack = self.agent_attack if side == "agent" else self.enemy_attack
		ticket = self.agent_all_clear_ticket if side == "agent" else self.enemy_all_clear_ticket
		state = self._fever(side)
		return encode_observation(
			self._board(side), pair, attack, self.turn, incoming_damage=self._damage(side),
			fever_rule=self.fever_rule, all_clear_ticket=ticket, elapsed_ms=self.elapsed_ms,
			margin_rate=self.margin_rate, time_progress_multiplier=self.time_progress_multiplier,
			fever=state.observation() if self.fever_rule else None,
		)

	def _refill(self, pairs: List[Tuple[int, int]]) -> Tuple[int, int]:
		pairs.append(self._pair())
		return pairs.pop(0)

	def _select_enemy_positions(self) -> Optional[List[Tuple[int, int]]]:
		"""상대(적 AI 또는 self-play 정책)의 이번 수 착지 좌표를 정한다. 둘 곳이 없으면 None이다."""
		if not self.is_self_play:
			bundledenemy.configure_rule(self.fever_rule, self.enemy_fever.active)
			placement = self.opponent.decide(self._board("enemy"), self.enemy_pair, self.enemy_next_pairs, self._damage("enemy"))
			return placement.positions if placement is not None else None
		observation = self._observe_side("enemy")
		action = self.self_play_action_fn(observation) if self.self_play_action_fn else self.random.randrange(ACTION_COUNT)
		column, rotation = action_to_placement(action)
		landing = bundledenemy.find_landing_placement(self._board("enemy"), column, rotation)
		return [landing[0], landing[1]] if landing is not None else None

	def _advance_time(self) -> None:
		self.elapsed_ms += self.DUEL_TURN_DURATION_MS
		self.margin_rate = get_margin_rate(self.elapsed_ms)
		self.time_progress_multiplier = get_time_progress_multiplier(self.elapsed_ms)
		bundledenemy.configure_timing(self.margin_rate, self.time_progress_multiplier)
		if self.fever_rule:
			for state in (self.agent_fever, self.enemy_fever):
				if state.active:
					state.left_time_ms = max(0.0, state.left_time_ms - self.DUEL_TURN_DURATION_MS)

	def _select_fever_stage(self, target_combo: int, pair: Tuple[int, int]) -> tuple[dict[str, Any], dict[str, int]]:
		stages = load_fever_stage_definitions()
		same_pair = pair[0] == pair[1]
		candidates = [stage for stage in stages if len(stage["usingColors"]) <= self.color_count
			and stage["targetCombo"] == target_combo
			and (stage["suppliedNextPuyos"][0] == stage["suppliedNextPuyos"][1]) == same_pair]
		if not candidates:
			raise RuntimeError(f"{self.color_count}색 {target_combo}연쇄 피버 스테이지를 찾지 못했습니다.")
		stage = self.random.choice(candidates)
		color_map: dict[str, int] = {}
		used: set[int] = set()
		for source, target in zip(stage["suppliedNextPuyos"], pair):
			if source in color_map and color_map[source] != target:
				raise RuntimeError("피버 스테이지 지급쌍의 색상 구성이 올바르지 않습니다.")
			color_map[source] = target
			used.add(target)
		source_colors = list(dict.fromkeys(stage["usingColors"]))
		for source in source_colors:
			if source in color_map:
				continue
			preferred = ("red", "green", "yellow", "blue", "purple").index(source)
			if preferred < self.color_count and preferred not in used:
				color_map[source] = preferred
				used.add(preferred)
		remaining = [color for color in range(self.color_count) if color not in used]
		self.random.shuffle(remaining)
		for source in source_colors:
			if source not in color_map:
				color_map[source] = remaining.pop()
		return stage, color_map

	def _prepare_fever_stage(self, side: str, target_combo: int, count_turn: bool = True) -> None:
		state = self._fever(side)
		pair = self.agent_pair if side == "agent" else self.enemy_pair
		stage, color_map = self._select_fever_stage(target_combo, pair)
		board = bundledenemy.new_empty_board()
		for puyo in stage["stageData"].get("puyos", []):
			x, y = puyo.get("x"), puyo.get("y")
			if not isinstance(x, int) or not isinstance(y, int) or not (0 <= x < BOARD_WIDTH and 0 <= y < BOARD_HEIGHT):
				continue
			board[y][x] = bundledenemy.GARBAGE if puyo.get("color") == "garbage" else color_map[puyo["color"]]
		if state.active:
			state.field = board
		else:
			self._set_board(side, board)
		if count_turn:
			state.turn += 1

	def _activate_fever(self, side: str) -> None:
		state = self._fever(side)
		if not self.fever_rule or state.active:
			return
		state.active = True
		state.field = bundledenemy.new_empty_board()
		state.damage = 0.0
		state.gauge = 0
		state.left_time_ms = state.next_time * 1000.0
		state.next_time = FEVER_INITIAL_TIME
		self._prepare_fever_stage(side, state.target_combo)

	def _finish_fever(self, side: str) -> None:
		state = self._fever(side)
		if not state.active:
			return
		if side == "agent":
			self.agent_damage += state.damage
		else:
			self.enemy_damage += state.damage
		state.active = False
		state.field = bundledenemy.new_empty_board()
		state.damage = 0.0
		state.gauge = 0
		state.left_time_ms = 0.0

	def _register_offset(self, side: str, opponent_side: str) -> bool:
		state = self._fever(side)
		if not self.fever_rule or state.active:
			return False
		state.gauge = min(FEVER_GAUGE_MAX, state.gauge + 1)
		opponent_state = self._fever(opponent_side)
		opponent_state.next_time = min(FEVER_MAX_TIME, opponent_state.next_time + 1)
		return state.gauge >= FEVER_GAUGE_MAX

	def _apply_generated_attack(self, side: str, opponent_side: str, attack: float) -> bool:
		before = self._damage(side)
		after, defender = _apply_attack_exchange(before, attack, self._damage(opponent_side))
		self._set_damage(side, after)
		self._set_damage(opponent_side, defender)
		return self._register_offset(side, opponent_side) if after < before else False

	def _after_resolve(self, side: str, combo: int, all_clear: bool, activate_pending: bool) -> None:
		state = self._fever(side)
		if not self.fever_rule:
			if all_clear:
				if side == "agent": self.agent_all_clear_ticket = True
				else: self.enemy_all_clear_ticket = True
			return
		if state.active:
			if combo > 0:
				previous_target = state.target_combo
				state.target_combo = calculate_fever_target(combo, all_clear, previous_target)
				if state.left_time_ms <= 0:
					self._finish_fever(side)
					return
				if state.target_combo != previous_target:
					state.left_time_ms += (combo // 2) * 1000 + FEVER_CHAIN_TIME_BONUS_MS
				self._prepare_fever_stage(side, state.target_combo)
			elif state.left_time_ms <= 0:
				self._finish_fever(side)
			return
		if activate_pending:
			if all_clear:
				state.target_combo = min(FEVER_MAX_TARGET_COMBO, state.target_combo + 2)
			self._activate_fever(side)
		elif all_clear:
			# 피버 비활성 일반 필드의 싹쓸이는 실제 게임처럼 4연쇄 패턴을 지급한다.
			self._prepare_fever_stage(side, FEVER_MIN_TARGET_COMBO, count_turn=False)

	def step(self, action: int) -> Tuple[torch.Tensor, float, bool, dict]:
		self._advance_time()
		bundledenemy.configure_rule(self.fever_rule, self.agent_fever.active)
		column, rotation = action_to_placement(action)
		landing = bundledenemy.find_landing_placement(self._board("agent"), column, rotation)
		if landing is None:
			return self.observe(), self.INVALID_ACTION_REWARD, True, {"invalid": True}
		positions = [landing[0], landing[1]]
		result_board, combo, attack = bundledenemy.resolve_placement(self._board("agent"), self.agent_pair, positions)
		self._set_board("agent", result_board)
		if self.fever_rule and combo > 0 and attack < 1 and self._damage("agent") >= 1:
			attack = 1.0
		if combo > 0 and not self.fever_rule and self.agent_all_clear_ticket:
			attack += ALL_CLEAR_TICKET_ATTACK
			self.agent_all_clear_ticket = False
		self.agent_attack = attack
		reward = attack + combo * combo
		agent_all_clear = combo > 0 and all(cell == bundledenemy.EMPTY for row in result_board for cell in row)
		info = {
			"combo": combo, "attack": attack,
			"opponent": self.SELF_PLAY_OPPONENT if self.is_self_play else self.opponent.get_class_type(),
			"fever_rule": self.fever_rule, "color_count": self.color_count,
			"elapsed_ms": self.elapsed_ms, "margin_rate": self.margin_rate,
			"time_progress_multiplier": self.time_progress_multiplier,
		}

		agent_activation = False
		if combo > 0:
			agent_activation = self._apply_generated_attack("agent", "enemy", attack)
		elif self._damage("agent") > 0:
			damage = self._damage("agent")
			dropped_board, dropped = bundledenemy.drop_garbage(self._board("agent"), damage, self.random)
			self._set_board("agent", dropped_board)
			self._set_damage("agent", damage - dropped)

		if bundledenemy.is_defeat_board(self._board("agent")):
			return self.observe(), reward + self.LOSS_REWARD, True, {**info, "result": "agent_defeated"}

		self.agent_pair = self._refill(self.agent_next_pairs)
		self._after_resolve("agent", combo, agent_all_clear, agent_activation)

		enemy_positions = self._select_enemy_positions()
		if enemy_positions is None:
			# 상대 필드에 더 이상 둘 곳이 없다: 상대의 패배로 처리한다.
			result = "enemy_invalid_self_play" if self.is_self_play else "enemy_no_moves"
			return self.observe(), reward + self.WIN_REWARD, True, {**info, "result": result}

		bundledenemy.configure_rule(self.fever_rule, self.enemy_fever.active)
		enemy_result_board, enemy_combo, enemy_attack = bundledenemy.resolve_placement(self._board("enemy"), self.enemy_pair, enemy_positions)
		if enemy_result_board is None:
			# bundledenemy가 규칙을 벗어난 배치를 반환하지 않는 한 발생하지 않는다. 방어적으로만 처리한다.
			enemy_result_board, enemy_combo, enemy_attack = self._board("enemy"), 0, 0.0
		self._set_board("enemy", enemy_result_board)
		if self.fever_rule and enemy_combo > 0 and enemy_attack < 1 and self._damage("enemy") >= 1:
			enemy_attack = 1.0
		if enemy_combo > 0 and not self.fever_rule and self.enemy_all_clear_ticket:
			enemy_attack += ALL_CLEAR_TICKET_ATTACK
			self.enemy_all_clear_ticket = False
		self.enemy_attack = enemy_attack
		enemy_all_clear = enemy_combo > 0 and all(cell == bundledenemy.EMPTY for row in enemy_result_board for cell in row)

		enemy_activation = False
		if enemy_combo > 0:
			enemy_activation = self._apply_generated_attack("enemy", "agent", enemy_attack)
		elif self._damage("enemy") > 0:
			damage = self._damage("enemy")
			dropped_board, dropped = bundledenemy.drop_garbage(self._board("enemy"), damage, self.random)
			self._set_board("enemy", dropped_board)
			self._set_damage("enemy", damage - dropped)

		if bundledenemy.is_defeat_board(self._board("enemy")):
			return self.observe(), reward + self.WIN_REWARD, True, {**info, "result": "enemy_defeated"}

		self.enemy_pair = self._refill(self.enemy_next_pairs)
		self._after_resolve("enemy", enemy_combo, enemy_all_clear, enemy_activation)
		self.turn += 1
		if self.turn >= self.MAX_TURNS_PER_EPISODE:
			return self.observe(), reward, True, {**info, "result": "timeout"}
		return self.observe(), reward, False, info


class PolicyNetwork(nn.Module):
	def __init__(self) -> None:
		super().__init__()
		self.layers = nn.Sequential(
			nn.Linear(OBSERVATION_SIZE, 256), nn.ReLU(),
			nn.Linear(256, 128), nn.ReLU(), nn.Linear(128, ACTION_COUNT)
		)

	def forward(self, state: torch.Tensor) -> torch.Tensor:
		return self.layers(state)


def load_existing_policy(output: Path, policy: PolicyNetwork, device: torch.device) -> bool:
	"""--output 체크포인트가 있으면 현재 관측·행동 계약을 확인한 뒤 가중치를 복원한다."""
	# 존재하지 않는 출력 경로는 이번 실행에서 새 가중치로 학습해야 하는 정상적인 경우다.
	if not output.exists():
		return False
	# 디렉터리 등 파일이 아닌 대상을 덮어쓰면 사용자의 결과물을 손상할 수 있으므로 중단한다.
	if not output.is_file():
		raise ValueError(f"--output 경로는 체크포인트 파일이어야 합니다: {output}")
	try:
		checkpoint = torch.load(output, map_location=device, weights_only=True)
	except Exception as error:
		raise ValueError(f"기존 체크포인트를 읽을 수 없습니다: {output} ({error})") from error
	# 서버 추론과 같은 모델 버전·관측값·24개 행동 계약이 아니면 잘못된 모델을 이어 학습하지 않는다.
	if not isinstance(checkpoint, dict):
		raise ValueError(f"기존 체크포인트 형식이 올바르지 않습니다: {output}")
	if checkpoint.get("model_version") != MODEL_VERSION:
		raise ValueError(
			f"기존 체크포인트 모델 버전이 현재 학습기와 다릅니다: {output} "
			f"(필요: {MODEL_VERSION}, 실제: {checkpoint.get('model_version')})"
		)
	if checkpoint.get("observation_size") != OBSERVATION_SIZE or checkpoint.get("action_count") != ACTION_COUNT:
		raise ValueError(
			f"기존 체크포인트의 관측값 또는 행동 계약이 현재 학습기와 다릅니다: {output}"
		)
	state_dict = checkpoint.get("model")
	if not isinstance(state_dict, dict):
		raise ValueError(f"기존 체크포인트에 model 가중치가 없습니다: {output}")
	try:
		policy.load_state_dict(state_dict)
	except RuntimeError as error:
		raise ValueError(f"기존 체크포인트 가중치를 복원할 수 없습니다: {output} ({error})") from error
	return True


def load_policy_checkpoint(checkpoint_path: Path, device: torch.device) -> PolicyNetwork:
	"""평가·직접 추론용으로 버전 검증을 거친 정책 하나를 불러온다."""
	policy = PolicyNetwork().to(device)
	if not load_existing_policy(checkpoint_path, policy, device):
		raise FileNotFoundError(f"체크포인트를 찾을 수 없습니다: {checkpoint_path}")
	policy.eval()
	return policy


def choose_policy_action(policy: PolicyNetwork, observation: torch.Tensor, device: torch.device) -> int:
	"""Q값 순서대로 보면서 현재 관측에서 착지 가능한 최선의 행동을 고른다."""
	with torch.inference_mode():
		q_values = policy(observation.to(device)).reshape(-1)
	for action in torch.argsort(q_values, descending=True).tolist():
		if is_legal_observation_action(observation, action):
			return int(action)
	raise RuntimeError("현재 필드에서 선택할 수 있는 DQN 행동이 없습니다.")


def infer_observation(checkpoint_path: Path, observation_path: Path, device_name: str = "auto") -> dict[str, int]:
	"""LM Studio나 HTTP 서버 없이 관측 JSON 파일을 정책에 직접 넣어 배치를 반환한다."""
	device = torch.device(device_name if device_name != "auto" else ("cuda" if torch.cuda.is_available() else "cpu"))
	try:
		observation = json.loads(observation_path.read_text(encoding="utf-8"))
	except (OSError, json.JSONDecodeError) as error:
		raise ValueError(f"관측 JSON을 읽을 수 없습니다: {observation_path} ({error})") from error
	validate_observation(observation)
	policy = load_policy_checkpoint(checkpoint_path, device)
	action = choose_policy_action(policy, torch.tensor(observation, dtype=torch.float32), device)
	x, rotation = action_to_placement(action)
	return {"action": action, "x": x, "rotation": rotation}


def evaluate_policy(
	checkpoint_path: Path, episodes: int, seed: int, device_name: str, opponent: str = "random",
) -> dict[str, float | int]:
	"""탐험 없이(epsilon=0) 대전하고 승·패·무승부와 승률을 집계한다."""
	device = torch.device(device_name if device_name != "auto" else ("cuda" if torch.cuda.is_available() else "cpu"))
	policy = load_policy_checkpoint(checkpoint_path, device)

	def greedy_action(observation: torch.Tensor) -> int:
		return choose_policy_action(policy, observation, device)

	wins = losses = draws = 0
	for episode in range(episodes):
		environment = _make_environment(opponent, seed + episode, greedy_action)
		state = environment.reset()
		result = "timeout"
		max_steps = 100 if opponent == "solo" else PuyoDuelEnvironment.MAX_TURNS_PER_EPISODE
		for _ in range(max_steps):
			action = greedy_action(state)
			state, _reward, done, info = environment.step(action)
			if done:
				result = info.get("result", "invalid" if info.get("invalid") else "done")
				break
		if result in ("enemy_defeated", "enemy_no_moves", "enemy_invalid_self_play"):
			wins += 1
		elif result in ("agent_defeated", "invalid"):
			losses += 1
		else:
			draws += 1
	return {"episodes": episodes, "wins": wins, "losses": losses, "draws": draws, "win_rate": wins / episodes}


def _make_environment(
	opponent: str, seed: int, self_play_action_fn: Optional[Callable[[torch.Tensor], int]] = None,
) -> "PuyoEnvironment | PuyoDuelEnvironment":
	"""--opponent 선택에 맞는 학습 환경을 만든다.

	'solo'는 상대 없이 버티기만 학습하는 옛 PuyoEnvironment다. 'random'은 매 에피소드
	self-play(자기 자신과 대전)와 bundledenemy.TRAINABLE_ENEMY_TYPES 중 하나를 무작위로
	골라 대전하는 PuyoDuelEnvironment를 만들고, 'self'는 항상 self-play, 그 밖의 값은
	해당 적 하나로 고정해 계속 대전하는 PuyoDuelEnvironment를 만든다. 기본 룰/피버 룰과
	색상 수(3~5색)는 PuyoDuelEnvironment가 에피소드마다 알아서 무작위로 고른다.
	"""
	if opponent == "solo":
		return PuyoEnvironment(seed)
	resolved_opponent = None if opponent == "random" else opponent
	return PuyoDuelEnvironment(resolved_opponent, seed, self_play_action_fn=self_play_action_fn)


class TrainingAbort(Exception):
	"""GUI 학습기(lngui.py)가 창을 닫아 즉시 포기시킬 때만 올리는 예외다.

	이 예외가 train()을 빠져나가면 체크포인트 저장 코드에 닿기 전에 함수가 끝나므로,
	기존 파일이 있었더라도 전혀 손대지 않고 새 파일도 만들지 않는다.
	"""


class TrainingControl:
	"""GUI 쓰레드가 학습 쓰레드의 일시정지·중단(저장)·강제 포기(무저장)를 요청하는 협조 객체.

	일시정지·중단 요청은 진행 중인 에피소드가 끝난 뒤(check_at_episode_boundary)에만 반영되고,
	강제 포기(request_abort)는 학습 스텝마다(check_abort) 확인해 거의 즉시 TrainingAbort로
	학습을 중단시킨다. CLI 실행(control=None)에는 전혀 관여하지 않는다.
	"""

	def __init__(self) -> None:
		self._running = threading.Event()
		self._running.set()
		self._paused = threading.Event()
		self._stop_requested = threading.Event()
		self._abort_requested = threading.Event()

	def request_pause(self) -> None:
		"""다음 에피소드 경계에서 학습을 일시정지하도록 예약한다."""
		self._running.clear()

	def request_resume(self) -> None:
		"""일시정지를 풀고 학습을 재개한다."""
		self._paused.clear()
		self._running.set()

	def request_stop(self) -> None:
		"""다음 에피소드 경계에서 학습을 중단하도록 예약한다(중단 시 지금까지 결과를 저장)."""
		self._stop_requested.set()
		self._running.set()

	def request_abort(self) -> None:
		"""저장 없이 즉시 학습을 포기하도록 요청한다(GUI 창 닫기 전용)."""
		self._abort_requested.set()
		self._running.set()

	def is_paused(self) -> bool:
		"""일시정지 요청이 실제로 반영되어 학습 쓰레드가 대기 중인지 확인한다."""
		return self._paused.is_set()

	def check_abort(self) -> None:
		"""학습 스텝마다 호출한다. 강제 포기 요청이 있으면 즉시 TrainingAbort를 올린다."""
		if self._abort_requested.is_set():
			raise TrainingAbort()

	def check_at_episode_boundary(self) -> bool:
		"""에피소드가 끝날 때마다 호출한다. 일시정지 중이면 재개·중단·포기까지 여기서 대기한다.

		@returns 이번 경계에서 학습을 중단해야 하면 True.
		"""
		self.check_abort()
		while not self._running.is_set():
			self._paused.set()
			if self._running.wait(timeout=0.1):
				break
			self.check_abort()
		self._paused.clear()
		return self._stop_requested.is_set()


def train(
	episodes: int, seed: int, output: Path, device_name: str, server_url: str = "", api_token: str = "", opponent: str = "random", *,
	control: Optional[TrainingControl] = None, log: Callable[[str], None] = print,
	on_progress: Optional[Callable[[int, int, dict], None]] = None,
) -> None:
	"""DQN 정책을 학습하고 체크포인트를 저장한다.

	`control`을 넘기면 lngui.py 같은 GUI가 별도 쓰레드에서 일시정지·중단·강제 포기를 요청할 수
	있다. `log`는 기본이 `print`라 CLI 동작은 그대로이며, GUI는 큐에 적재하는 콜백을 넘겨 로그
	패널에 표시한다. `on_progress`는 매 에피소드가 끝날 때 (완료 수, 전체 수, 통계) 로 호출되어
	GUI 진행 게이지를 갱신한다.
	"""
	random.seed(seed)
	torch.manual_seed(seed)
	device = torch.device(device_name if device_name != "auto" else ("cuda" if torch.cuda.is_available() else "cpu"))
	log_interval = 500 if device.type == "cpu" else max(1, episodes // 100)
	api_client = LearningApiClient(server_url, api_token or os.environ.get("PUYOW_AI_TOKEN", "")) if server_url else None
	policy = PolicyNetwork().to(device)
	# --output 파일이 실제로 있으면 새 초기 가중치를 버리고 그 모델부터 추가 학습을 시작한다.
	resumed = load_existing_policy(output, policy, device)
	target = PolicyNetwork().to(device)
	target.load_state_dict(policy.state_dict())
	optimizer = torch.optim.Adam(policy.parameters(), lr=1e-3)
	replay: Deque[Transition] = deque(maxlen=50_000)
	gamma, batch_size = 0.99, 128
	epsilon_start, epsilon_end = 1.0, 0.05
	max_steps_per_episode = 100 if opponent == "solo" else PuyoDuelEnvironment.MAX_TURNS_PER_EPISODE
	total_steps = max(1, episodes * max_steps_per_episode)
	steps = 0
	win_count = 0
	loss_count = 0
	if resumed:
		# 기존 형식은 model 가중치만 저장했으므로 optimizer·replay buffer·epsilon은 이번 실행에서 새로 시작한다.
		log(f"resume={output} 기존 모델 가중치로 추가 학습을 시작합니다.")
	else:
		log(f"new_model={output} 새 모델 가중치로 학습을 시작합니다.")

	# self-play(PuyoDuelEnvironment.SELF_PLAY_OPPONENT) 에피소드에서 상대측 행동을 고르는
	# 콜백이다. 매 스텝 최신 epsilon으로 갱신되는 epsilon_holder를 통해, 학습 중인 에이전트와
	# 같은 epsilon-greedy 탐험 규칙을 상대측에도 그대로 적용한다.
	epsilon_holder = [epsilon_start]

	def self_play_action(observation: torch.Tensor) -> int:
		if random.random() < epsilon_holder[0]:
			return random.randrange(ACTION_COUNT)
		return choose_policy_action(policy, observation, device)

	for episode in range(episodes):
		if control is not None:
			control.check_abort()
		environment = _make_environment(opponent, seed + episode, self_play_action)
		state = environment.reset()
		session_id = f"puyow-training-{seed}-{episode}"
		if api_client:
			api_client.reset(session_id, state)
		episode_reward = 0.0
		episode_result = "timeout"
		for _ in range(max_steps_per_episode):
			if control is not None:
				control.check_abort()
			epsilon = max(epsilon_end, epsilon_start - (epsilon_start - epsilon_end) * steps / total_steps)
			epsilon_holder[0] = epsilon
			if random.random() < epsilon:
				action = random.randrange(ACTION_COUNT)
			else:
				action = choose_policy_action(policy, state, device)
			next_state, reward, done, info = environment.step(action)
			if api_client:
				api_client.step(session_id, state, action, reward, next_state, done)
			replay.append(Transition(state, action, reward, next_state, done))
			state, episode_reward, steps = next_state, episode_reward + reward, steps + 1
			if len(replay) >= batch_size:
				batch = random.sample(replay, batch_size)
				states = torch.stack([item.state for item in batch]).to(device)
				actions = torch.tensor([item.action for item in batch], device=device)
				rewards = torch.tensor([item.reward for item in batch], device=device)
				next_states = torch.stack([item.next_state for item in batch]).to(device)
				dones = torch.tensor([item.done for item in batch], dtype=torch.float32, device=device)
				current = policy(states).gather(1, actions.unsqueeze(1)).squeeze(1)
				with torch.no_grad():
					future = target(next_states).max(1).values
					expected = rewards + gamma * future * (1.0 - dones)
				loss = nn.functional.smooth_l1_loss(current, expected)
				optimizer.zero_grad()
				loss.backward()
				nn.utils.clip_grad_norm_(policy.parameters(), 1.0)
				optimizer.step()
			if steps % 250 == 0:
				target.load_state_dict(policy.state_dict())
			if done:
				episode_result = info.get("result", "invalid" if info.get("invalid") else "done")
				break
		if episode_result in ("enemy_defeated", "enemy_no_moves", "enemy_invalid_self_play"):
			win_count += 1
		elif episode_result in ("agent_defeated", "invalid"):
			loss_count += 1
		if api_client:
			api_client.episode_end(session_id)
		if on_progress is not None:
			on_progress(episode + 1, episodes, {
				"reward": episode_reward, "epsilon": epsilon, "result": episode_result,
				"wins": win_count, "losses": loss_count,
			})
		if (episode + 1) % log_interval == 0 or episode == 0:
			log(f"episode={episode + 1}/{episodes} reward={episode_reward:.1f} epsilon={epsilon:.3f} "
				f"result={episode_result} wins={win_count} losses={loss_count}")
		if control is not None and control.check_at_episode_boundary():
			log(f"stopped_by_user episode={episode + 1}/{episodes}")
			break

	output.parent.mkdir(parents=True, exist_ok=True)
	torch.save({"model": policy.state_dict(), "model_version": MODEL_VERSION, "observation_size": OBSERVATION_SIZE, "action_count": ACTION_COUNT, "seed": seed}, output)
	output.with_suffix(".json").write_text(json.dumps({"model_version": MODEL_VERSION, "observation_size": OBSERVATION_SIZE, "action_count": ACTION_COUNT, "board": [BOARD_WIDTH, BOARD_HEIGHT]}, indent=2), encoding="utf-8")
	log(f"saved={output} device={device}")


def export_gguf(source: Path, output: Path, converter: Path) -> None:
	"""llama.cpp 변환기로 Hugging Face Transformer 모델을 GGUF로 변환한다."""
	if source.is_file() or not (source / "config.json").is_file():
		raise ValueError(
			"현재 default.pt는 사용자 정의 DQN 체크포인트라 LM Studio용 GGUF로 변환할 수 없습니다. "
			"--export-gguf에는 config.json을 포함한 Hugging Face Transformer 모델 디렉터리를 지정하세요."
		)
	if not converter.is_file():
		raise FileNotFoundError(f"llama.cpp 변환기를 찾을 수 없습니다: {converter}")
	output.parent.mkdir(parents=True, exist_ok=True)
	command = [sys.executable, str(converter), str(source), "--outfile", str(output), "--outtype", "f16"]
	print("GGUF 변환 시작:", " ".join(f'"{part}"' if " " in part else part for part in command))
	try:
		subprocess.run(command, check=True)
	except subprocess.CalledProcessError as error:
		raise RuntimeError(f"llama.cpp GGUF 변환 실패 (종료 코드: {error.returncode})") from error
	print(f"GGUF 저장 완료: {output}")


def main() -> None:
	parser = argparse.ArgumentParser(description="Puyo W DQN 학습")
	parser.add_argument("--episodes", type=int, default=1000, help="학습 에피소드 수")
	parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="재현 가능한 난수 시드")
	parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="체크포인트 경로(기존 파일이면 가중치를 복원해 추가 학습)")
	parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default=DEFAULT_DEVICE)
	parser.add_argument("--server-url", default="", help="학습 이벤트를 전송할 pythonserver.py 주소(예: http://localhost:9891)")
	parser.add_argument("--api-token", default="", help="pythonserver.py의 learning_token 값. 로컬 서버라면 \"localhost\"로도 인증할 수 있다(미지정 시 PUYOW_AI_TOKEN 환경변수 사용)")
	parser.add_argument("--evaluate-episodes", type=int, default=0, help="학습하지 않고 epsilon=0으로 평가할 에피소드 수")
	parser.add_argument("--infer-observation", type=Path, metavar="JSON", help="서버 없이 공통 관측 JSON 하나를 직접 추론")
	parser.add_argument("--export-gguf", type=Path, metavar="MODEL_DIR", help="Hugging Face Transformer 모델 디렉터리를 GGUF로 변환")
	parser.add_argument("--gguf-output", type=Path, default=Path("python/model-f16.gguf"), help="GGUF 출력 경로")
	parser.add_argument("--llama-cpp-converter", type=Path, default=Path("llama.cpp") / "convert_hf_to_gguf.py", help="llama.cpp의 convert_hf_to_gguf.py 경로")
	parser.add_argument(
		"--opponent", default=DEFAULT_OPPONENT,
		choices=("random", "solo", PuyoDuelEnvironment.SELF_PLAY_OPPONENT) + bundledenemy.TRAINABLE_ENEMY_TYPES,
		help="대전 상대. 'random'은 매 에피소드 self-play(자기 자신과 대전) 또는 bundledenemy의 적 "
			"중 하나를 무작위로 고르고(기본값), 'self'는 항상 self-play, 'solo'는 상대 없이 "
			"버티기만 학습하는 옛 방식이며, 그 밖에는 지정한 적 하나로 고정한다.",
	)
	args = parser.parse_args()
	if args.export_gguf:
		export_gguf(args.export_gguf, args.gguf_output, args.llama_cpp_converter)
		return
	if args.infer_observation:
		print(json.dumps(infer_observation(args.output, args.infer_observation, args.device), ensure_ascii=False))
		return
	if args.evaluate_episodes:
		if args.evaluate_episodes < 1:
			parser.error("--evaluate-episodes는 1 이상이어야 합니다.")
		print(json.dumps(evaluate_policy(args.output, args.evaluate_episodes, args.seed, args.device, args.opponent), ensure_ascii=False))
		return
	if args.episodes < 1:
		parser.error("--episodes는 1 이상이어야 합니다.")
	train(args.episodes, args.seed, args.output, args.device, args.server_url, args.api_token, args.opponent)
if __name__ == "__main__":
	main()




