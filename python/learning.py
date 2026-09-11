"""Puyo W용 self-play 애프터스테이트 가치 학습기.

이 게임은 한 수를 두었을 때 어떤 보드가 되는지(착지·폭발·연쇄·ATTACK)를 규칙만으로 정확히
계산할 수 있다. 그래서 24개 행동마다 Q값을 따로 외우는 대신, **한 수를 둔 직후의 보드 상태
(애프터스테이트)** 하나의 가치 V(x)만 학습하고, 실제 배치는 후보마다 규칙으로 결과를 미리
계산해 `즉시 보상 + 감가된 V(애프터스테이트)`가 가장 큰 것을 고른다. 규칙으로 알 수 있는 부분을
신경망이 다시 배우지 않아도 되고, 24개 행동이 하나의 가치 함수를 공유하므로 같은 대전 수로도
훨씬 빨리 는다. 놓을 수 없는 자리는 후보를 만들 때 빠지므로 불가능한 행동을 배우는 일도 없다.

가치망은 6×12 보드를 1차원으로 펴지 않고 채널 7개의 2차원 평면 그대로 합성곱에 넣는다.
같은 색이 붙어 있는지, 어느 열이 높은지 같은 연쇄의 근거가 위치를 옮겨도 같은 특징이기 때문이다.

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
import time
import urllib.error
import urllib.request
from collections import Counter, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Deque, List, Optional, Sequence, Tuple

import torch
from torch import nn

import bundledenemy
from common import (
	ACTION_COUNT, BOARD_CHANNELS, BOARD_HEIGHT, BOARD_WIDTH, COLORS, DISCOUNT_GAMMA, MODEL_VERSION,
	OBSERVATION_EXTRA_SIZE, OBSERVATION_SIZE, ROTATION_COUNT, ROTATION_UP, action_to_placement,
	decode_observation_board, decode_observation_pair, decode_observation_scalars,
	encode_observation_values, is_legal_observation_action, move_reward, validate_observation,
)
from common import LOSS_REWARD as DUEL_LOSS_REWARD, WIN_REWARD as DUEL_WIN_REWARD

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
		"""서버 주소와 토큰으로 클라이언트를 초기화한다. 토큰이 없으면 예외를 올린다."""
		if not token:
			raise ValueError("API를 사용할 때는 --api-token 또는 PUYOW_AI_TOKEN이 필요합니다.")
		self.endpoint = server_url.rstrip("/") + "/apis/learning"
		self.token = token
		self.timeout = timeout

	def send(self, payload: dict) -> dict:
		"""페이로드를 학습 API에 POST하고, 실패나 서버 거부 시 예외를 올린다."""
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
		"""에피소드 시작(reset) 이벤트를 서버로 전달한다."""
		return self.send({"event": "reset", "sessionId": session_id, "observation": observation.tolist()})

	def step(self, session_id: str, state: torch.Tensor, action: int, reward: float, next_state: torch.Tensor, done: bool) -> dict:
		"""한 스텝의 상태·행동·보상·다음 상태·종료 여부를 서버로 전달한다."""
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
		"""에피소드 종료 이벤트를 서버로 전달한다."""
		return self.send({"event": "episode_end", "sessionId": session_id, "done": True})


@dataclass
class ValueSample:
	"""리플레이 버퍼에 저장하는 가치 회귀 한 건이다.

	`state`(애프터스테이트)의 목표값은 `partial_return + discount * V(bootstrap)`이다. 에피소드가
	n스텝 안에 끝나 더 볼 상태가 없으면 `discount`가 0이라 남은 보상 합만 목표가 된다.
	"""
	state: torch.Tensor
	partial_return: float
	bootstrap: torch.Tensor
	discount: float


def encode_observation(
	board: List[List[int]], current_pair: Tuple[int, int], attack: float, turn: int, *,
	incoming_damage: float = 0.0, fever_rule: bool = False, all_clear_ticket: bool = False,
	elapsed_ms: float = 0.0, margin_rate: float = 70.0, time_progress_multiplier: float = 1.0,
	fever: Optional[dict[str, Any]] = None,
) -> torch.Tensor:
	"""보드·현재 쌍·전투/시간/피버 상태를 공통 관측 벡터로 인코딩한다."""
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


def _fever_stage_source_colors(stage: dict[str, Any]) -> List[str]:
	"""피버 패턴이 쓰는 일반 색 이름을 처음 나온 순서대로 중복 없이 모은다."""
	colors = list(stage.get("usingColors", []))
	colors.extend(puyo.get("color") for puyo in stage["stageData"].get("puyos", []))
	return [color for color in dict.fromkeys(colors) if color and color != "garbage"]


def build_chain_seed_board(rng: random.Random, color_count: int) -> Optional[List[List[int]]]:
	"""실제 피버 패턴 하나를 연쇄 씨앗으로 깔아 둔 일반 필드를 만든다. 쓸 수 있는 패턴이 없으면 None이다.

	연쇄 커리큘럼 학습 방식이 에피소드의 시작 보드로 쓴다. 피버 패턴은 지급쌍으로 곧바로 터지도록
	만든 것이지만, 여기서는 색을 지급쌍과 무관하게 무작위로 섞는다. 첫 수에 바로 터지면 그 앞 상태가
	없어 가치망이 배울 표본이 생기지 않으므로, 몇 수에 걸쳐 방아쇠 색을 맞춰 터뜨리는 경험을 만들기
	위해서다. 섞은 결과가 이미 폭발하거나 패배 칸을 막으면 쓰지 않는다.
	"""
	candidates = [stage for stage in load_fever_stage_definitions() if len(_fever_stage_source_colors(stage)) <= color_count]
	if not candidates:
		return None
	stage = rng.choice(candidates)
	palette = list(range(color_count))
	rng.shuffle(palette)
	color_map = {source: palette[index] for index, source in enumerate(_fever_stage_source_colors(stage))}
	board = bundledenemy.new_empty_board()
	for puyo in stage["stageData"].get("puyos", []):
		x, y = puyo.get("x"), puyo.get("y")
		if not isinstance(x, int) or not isinstance(y, int) or not (0 <= x < BOARD_WIDTH and 0 <= y < BOARD_HEIGHT):
			continue
		board[y][x] = bundledenemy.GARBAGE if puyo.get("color") == "garbage" else color_map[puyo["color"]]
	board = bundledenemy.collapse_board(board)
	if bundledenemy.find_explosion_groups(board) or bundledenemy.is_defeat_board(board):
		return None
	return board


def _placement_action(placement: Optional[bundledenemy.Placement]) -> Optional[int]:
	"""적 AI가 고른 배치(열·회전)를 이 학습기의 행동 번호로 바꾼다. 배치가 없으면 None이다."""
	return None if placement is None else placement.x * ROTATION_COUNT + placement.rotation


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
		"""이 피버 상태를 관측 인코딩용 딕셔너리로 변환한다."""
		return {
			"active": self.active, "gauge": self.gauge, "nextTime": self.next_time,
			"targetCombo": self.target_combo, "leftTime": self.left_time_ms, "damage": self.damage,
		}


class PuyoEnvironment:
	"""간결한 단일 플레이어 Puyo W 보드 환경. board[y][x]에서 y=0은 바닥이다.

	상대 없이 "죽지 않고 버티기"만 학습하는 구모드다. 기본값은 PuyoDuelEnvironment(적 AI와
	실제로 대전하며 학습)이며, 이 클래스는 --opponent solo로 선택했을 때만 쓰인다.

	착지·연쇄 해소·패배 판정은 대전 환경, 서버 추론과 같은 bundledenemy 함수를 그대로 쓴다.
	가치망이 보는 애프터스테이트와 학습에 쓰는 보상이 어느 모드에서든 같은 규칙이어야 하기 때문이다.
	"""

	# 상대가 없어 승패 보상이 없으므로, 패배만 대전과 같은 크기로 벌한다.
	DEFEAT_REWARD = DUEL_LOSS_REWARD

	def __init__(self, seed: int | None = None, chain_seed_ratio: float = 0.0) -> None:
		"""시드로 난수 생성기를 만들고 초기 상태로 리셋한다.

		`chain_seed_ratio`는 에피소드 시작 보드에 연쇄 씨앗(build_chain_seed_board)을 깔 확률이다.
		"""
		self.random = random.Random(seed)
		self.chain_seed_ratio = chain_seed_ratio
		self.board: List[List[int]] = []
		self.current_pair: Tuple[int, int] = (0, 0)
		self.next_pair: Tuple[int, int] = (0, 0)
		self.attack = 0.0
		self.turn = 0
		self.reset()

	def _pair(self) -> Tuple[int, int]:
		"""무작위 색상 두 개로 이루어진 새 뿌요 쌍을 만든다."""
		return self.random.randrange(COLORS), self.random.randrange(COLORS)

	def reset(self) -> torch.Tensor:
		"""보드와 상태를 비우고 새 에피소드를 시작한다."""
		bundledenemy.configure_rule(False)
		bundledenemy.configure_timing(get_margin_rate(0), get_time_progress_multiplier(0))
		self.board = bundledenemy.new_empty_board()
		# 비율이 0이면 난수를 뽑지 않아, 기본 학습 방식의 에피소드 진행이 예전과 같게 유지된다.
		if self.chain_seed_ratio > 0.0 and self.random.random() < self.chain_seed_ratio:
			self.board = build_chain_seed_board(self.random, COLORS) or self.board
		self.current_pair = self._pair()
		self.next_pair = self._pair()
		self.attack = 0.0
		self.turn = 0
		return self.observe()

	def observe(self) -> torch.Tensor:
		"""현재 보드·쌍·공격력·턴을 관측 벡터로 인코딩한다."""
		return encode_observation(self.board, self.current_pair, self.attack, self.turn)

	def next_pair_for_agent(self) -> Tuple[int, int]:
		"""애프터스테이트에 담을 다음 턴의 조작 쌍을 알려 준다."""
		return self.next_pair

	def suggest_agent_action(self, guide: bundledenemy.BaseEnemy) -> Optional[int]:
		"""안내 역할의 적 AI가 이번 수에 고를 배치를 행동 번호로 알려 준다. 둘 곳이 없으면 None이다."""
		bundledenemy.configure_rule(False)
		return _placement_action(guide.decide(self.board, self.current_pair, [self.next_pair], 0.0))

	def step(self, action: int) -> Tuple[torch.Tensor, float, bool, dict]:
		"""행동을 착지시키고 연쇄를 해소한 뒤, 다음 관측·보상·종료 여부·정보를 반환한다."""
		bundledenemy.configure_rule(False)
		bundledenemy.configure_timing(get_margin_rate(0), get_time_progress_multiplier(0))
		landing = bundledenemy.find_landing_placement(self.board, *action_to_placement(action))
		if landing is None:
			return self.observe(), self.DEFEAT_REWARD, True, {"invalid": True, "terminal_value": self.DEFEAT_REWARD}
		result_board, combo, attack = bundledenemy.resolve_placement(self.board, self.current_pair, [landing[0], landing[1]])
		self.board = result_board
		self.attack = attack
		self.current_pair = self.next_pair
		self.next_pair = self._pair()
		self.turn += 1
		reward = move_reward(attack, combo)
		defeated = bundledenemy.is_defeat_board(self.board)
		info = {"combo": combo, "attack": attack}
		if defeated:
			return self.observe(), reward + self.DEFEAT_REWARD, True, {
				**info, "result": "agent_defeated", "terminal_value": self.DEFEAT_REWARD,
			}
		return self.observe(), reward, False, info


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
	# 승패 보상은 common.py의 공통 계약을 그대로 쓴다. pythonserver.py가 실제 대전에서 모은
	# 전이로 같은 체크포인트를 추가 학습하므로 양쪽 보상 크기가 같아야 한다.
	WIN_REWARD = DUEL_WIN_REWARD
	LOSS_REWARD = DUEL_LOSS_REWARD
	NEXT_PAIR_LOOKAHEAD = 8

	def __init__(
		self,
		opponent_type: Optional[str] = None,
		seed: Optional[int] = None,
		fever_rule: Optional[bool] = None,
		color_count: Optional[int] = None,
		self_play_action_fn: Optional[Callable[[torch.Tensor, Sequence[Any]], int]] = None,
		chain_seed_ratio: float = 0.0,
	) -> None:
		"""대전 설정(상대·시드·피버 룰·색상 수·self-play 콜백)을 받아 초기 상태로 리셋한다.

		`chain_seed_ratio`는 에피소드마다 에이전트의 일반 필드에 연쇄 씨앗(build_chain_seed_board)을
		깔고 시작할 확률이다. 상대 필드는 건드리지 않는다.
		"""
		self.random = random.Random(seed)
		self.chain_seed_ratio = chain_seed_ratio
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
		"""현재 색상 수 범위에서 무작위 뿌요 쌍을 만든다."""
		return self.random.randrange(self.color_count), self.random.randrange(self.color_count)

	def _select_opponent_type(self) -> str:
		"""지정된 상대가 없으면 self-play와 학습 가능한 적 유형 중 하나를 무작위로 고른다."""
		if self.opponent_type:
			return self.opponent_type
		pool = (self.SELF_PLAY_OPPONENT,) + bundledenemy.TRAINABLE_ENEMY_TYPES
		return self.random.choice(pool)

	def reset(self) -> torch.Tensor:
		"""상대·룰·색상 수·양측 보드와 다음 쌍을 새로 뽑아 에피소드를 시작한다."""
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
		# 비율이 0이면 난수를 뽑지 않아, 기본 학습 방식의 에피소드 진행이 예전과 같게 유지된다.
		if self.chain_seed_ratio > 0.0 and self.random.random() < self.chain_seed_ratio:
			self.agent_board = build_chain_seed_board(self.random, self.color_count) or self.agent_board
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
		"""학습 중인 에이전트(agent) 쪽 관측값을 반환한다."""
		return self._observe_side("agent")

	def next_pair_for_agent(self) -> Tuple[int, int]:
		"""애프터스테이트에 담을 다음 턴의 조작 쌍을 알려 준다."""
		return self.agent_next_pairs[0]

	def suggest_agent_action(self, guide: bundledenemy.BaseEnemy) -> Optional[int]:
		"""안내 역할의 적 AI가 에이전트 자리에서 이번 수에 고를 배치를 행동 번호로 알려 준다. 둘 곳이 없으면 None이다."""
		bundledenemy.configure_rule(self.fever_rule, self.agent_fever.active)
		placement = guide.decide(self._board("agent"), self.agent_pair, self.agent_next_pairs, self._damage("agent"))
		return _placement_action(placement)

	def _fever(self, side: str) -> FeverState:
		"""side에 해당하는 피버 상태 객체를 반환한다."""
		return self.agent_fever if side == "agent" else self.enemy_fever

	def _board(self, side: str) -> List[List[int]]:
		"""side가 피버 중이면 피버 필드를, 아니면 평소 보드를 반환한다."""
		state = self._fever(side)
		if self.fever_rule and state.active:
			return state.field
		return self.agent_board if side == "agent" else self.enemy_board

	def _set_board(self, side: str, board: List[List[int]]) -> None:
		"""side가 피버 중이면 피버 필드를, 아니면 평소 보드를 갱신한다."""
		state = self._fever(side)
		if self.fever_rule and state.active:
			state.field = board
		elif side == "agent":
			self.agent_board = board
		else:
			self.enemy_board = board

	def _damage(self, side: str) -> float:
		"""side가 피버 중이면 피버 전용 미정산 피해를, 아니면 평소 미정산 피해를 반환한다."""
		state = self._fever(side)
		if self.fever_rule and state.active:
			return state.damage
		return self.agent_damage if side == "agent" else self.enemy_damage

	def _set_damage(self, side: str, damage: float) -> None:
		"""side가 피버 중이면 피버 전용 미정산 피해를, 아니면 평소 미정산 피해를 갱신한다."""
		state = self._fever(side)
		if self.fever_rule and state.active:
			state.damage = damage
		elif side == "agent":
			self.agent_damage = damage
		else:
			self.enemy_damage = damage

	def _observe_side(self, side: str) -> torch.Tensor:
		"""지정한 side의 보드·쌍·공격력·피버 상태 등을 관측 벡터로 인코딩한다."""
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
		"""다음 쌍 목록 끝에 새 쌍을 채우고, 맨 앞의 쌍을 꺼내 반환한다."""
		pairs.append(self._pair())
		return pairs.pop(0)

	def _select_enemy_positions(self) -> Optional[List[Tuple[int, int]]]:
		"""상대(적 AI 또는 self-play 정책)의 이번 수 착지 좌표를 정한다. 둘 곳이 없으면 None이다."""
		if not self.is_self_play:
			bundledenemy.configure_rule(self.fever_rule, self.enemy_fever.active)
			placement = self.opponent.decide(self._board("enemy"), self.enemy_pair, self.enemy_next_pairs, self._damage("enemy"))
			return placement.positions if placement is not None else None
		observation = self._observe_side("enemy")
		action = (
			self.self_play_action_fn(observation, self.enemy_next_pairs[0])
			if self.self_play_action_fn else self.random.randrange(ACTION_COUNT)
		)
		column, rotation = action_to_placement(action)
		landing = bundledenemy.find_landing_placement(self._board("enemy"), column, rotation)
		return [landing[0], landing[1]] if landing is not None else None

	def _advance_time(self) -> None:
		"""경과 시간을 한 턴만큼 진행시키고 마진 레이트·시간 배율·피버 남은 시간을 갱신한다."""
		self.elapsed_ms += self.DUEL_TURN_DURATION_MS
		self.margin_rate = get_margin_rate(self.elapsed_ms)
		self.time_progress_multiplier = get_time_progress_multiplier(self.elapsed_ms)
		bundledenemy.configure_timing(self.margin_rate, self.time_progress_multiplier)
		if self.fever_rule:
			for state in (self.agent_fever, self.enemy_fever):
				if state.active:
					state.left_time_ms = max(0.0, state.left_time_ms - self.DUEL_TURN_DURATION_MS)

	def _select_fever_stage(self, target_combo: int, pair: Tuple[int, int]) -> tuple[dict[str, Any], dict[str, int]]:
		"""목표 연쇄·색상 수·지급쌍 조건에 맞는 피버 스테이지를 고르고 실제 색상으로 매핑한다."""
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
		"""선택한 피버 스테이지를 필드에 배치하고 필요하면 피버 턴 수를 올린다."""
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
		"""피버 룰이 켜져 있고 아직 비활성 상태면 side의 피버를 시작한다."""
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
		"""side의 피버를 종료하고 누적된 피버 피해를 평소 미정산 피해로 합산한다."""
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
		"""상쇄 1회를 피버 게이지에 반영하고, 게이지가 가득 차 피버 발동 조건을 채웠는지 반환한다."""
		state = self._fever(side)
		if not self.fever_rule or state.active:
			return False
		state.gauge = min(FEVER_GAUGE_MAX, state.gauge + 1)
		opponent_state = self._fever(opponent_side)
		opponent_state.next_time = min(FEVER_MAX_TIME, opponent_state.next_time + 1)
		return state.gauge >= FEVER_GAUGE_MAX

	def _apply_generated_attack(self, side: str, opponent_side: str, attack: float) -> bool:
		"""side가 만든 공격을 상쇄·전달하고, 상쇄가 발생했다면 피버 게이지 등록 결과를 반환한다."""
		before = self._damage(side)
		after, defender = _apply_attack_exchange(before, attack, self._damage(opponent_side))
		self._set_damage(side, after)
		self._set_damage(opponent_side, defender)
		return self._register_offset(side, opponent_side) if after < before else False

	def _after_resolve(self, side: str, combo: int, all_clear: bool, activate_pending: bool) -> None:
		"""연쇄 해소 이후 싹쓸이 티켓·피버 목표/발동/종료 상태를 갱신한다."""
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
		"""에이전트가 한 수를 두고 판정한 뒤 상대의 수까지 처리해, 다음 관측·보상·종료 여부·정보를 반환한다."""
		self._advance_time()
		bundledenemy.configure_rule(self.fever_rule, self.agent_fever.active)
		column, rotation = action_to_placement(action)
		landing = bundledenemy.find_landing_placement(self._board("agent"), column, rotation)
		if landing is None:
			# 놓을 자리가 하나도 없는 상태는 실제 게임의 패배와 같다.
			return self.observe(), self.LOSS_REWARD, True, {"invalid": True, "terminal_value": self.LOSS_REWARD}
		positions = [landing[0], landing[1]]
		result_board, combo, attack = bundledenemy.resolve_placement(self._board("agent"), self.agent_pair, positions)
		self._set_board("agent", result_board)
		if self.fever_rule and combo > 0 and attack < 1 and self._damage("agent") >= 1:
			attack = 1.0
		if combo > 0 and not self.fever_rule and self.agent_all_clear_ticket:
			attack += ALL_CLEAR_TICKET_ATTACK
			self.agent_all_clear_ticket = False
		self.agent_attack = attack
		reward = move_reward(attack, combo)
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
			return self.observe(), reward + self.LOSS_REWARD, True, {
				**info, "result": "agent_defeated", "terminal_value": self.LOSS_REWARD,
			}

		self.agent_pair = self._refill(self.agent_next_pairs)
		self._after_resolve("agent", combo, agent_all_clear, agent_activation)

		enemy_positions = self._select_enemy_positions()
		if enemy_positions is None:
			# 상대 필드에 더 이상 둘 곳이 없다: 상대의 패배로 처리한다.
			result = "enemy_invalid_self_play" if self.is_self_play else "enemy_no_moves"
			return self.observe(), reward + self.WIN_REWARD, True, {**info, "result": result, "terminal_value": self.WIN_REWARD}

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
			return self.observe(), reward + self.WIN_REWARD, True, {
				**info, "result": "enemy_defeated", "terminal_value": self.WIN_REWARD,
			}

		self.enemy_pair = self._refill(self.enemy_next_pairs)
		self._after_resolve("enemy", enemy_combo, enemy_all_clear, enemy_activation)
		self.turn += 1
		if self.turn >= self.MAX_TURNS_PER_EPISODE:
			return self.observe(), reward, True, {**info, "result": "timeout"}
		return self.observe(), reward, False, info


@dataclass
class Afterstate:
	"""한 수를 두고 연쇄까지 끝난 직후의 상태와, 그 수가 만든 즉시 보상."""
	action: int
	reward: float
	observation: List[float]


def observation_values(observation: Any) -> List[float]:
	"""텐서·리스트 어느 쪽으로 들어와도 같은 float 목록으로 만든다."""
	return observation.tolist() if isinstance(observation, torch.Tensor) else [float(value) for value in observation]


def _build_afterstate(
	board: List[List[int]], pair: Tuple[int, int], scalars: dict[str, Any], action: int, next_pair: Sequence[Any],
) -> Optional[Afterstate]:
	"""이미 디코딩한 관측 상태에서 한 행동의 애프터스테이트와 즉시 보상을 만든다.

	호출 전에 bundledenemy의 룰·시간 설정을 이 관측값에 맞춰 두어야 ATTACK 계산이 실제 게임과 같다.
	방해뿌요 낙하는 무작위라 애프터스테이트에 반영하지 않고, 상쇄하고 남은 피해량만 상태에 남긴다.
	"""
	landing = bundledenemy.find_landing_placement(board, *action_to_placement(action))
	if landing is None:
		return None
	result_board, combo, attack = bundledenemy.resolve_placement(board, pair, [landing[0], landing[1]])
	if result_board is None:
		return None
	fever_rule = scalars["fever_rule"]
	fever_active = fever_rule and scalars["fever_active"]
	# 피버 중에는 피버 필드 전용 미정산 피해가 그 시점의 실제 피해량이다.
	damage = scalars["fever_damage"] if fever_active else scalars["incoming_damage"]
	ticket = scalars["all_clear_ticket"]
	# 아래 세 보정은 PuyoDuelEnvironment.step()과 같은 순서·계약이어야 보상이 어긋나지 않는다.
	if fever_rule and combo > 0 and attack < 1 and damage >= 1:
		attack = 1.0
	if combo > 0 and not fever_rule and ticket:
		attack += ALL_CLEAR_TICKET_ATTACK
		ticket = False
	if combo > 0 and not fever_rule and bundledenemy.is_all_clear_board(result_board):
		ticket = True
	remaining_damage = damage - min(math.floor(attack), math.floor(damage))
	fever = {
		"active": fever_active, "gauge": scalars["fever_gauge"], "nextTime": scalars["fever_next_time"],
		"targetCombo": scalars["fever_target_combo"], "leftTime": scalars["fever_left_time"],
		"damage": remaining_damage if fever_active else scalars["fever_damage"],
	}
	observation = encode_observation_values(
		result_board, next_pair, attack=attack, turn=scalars["turn"] + 1, incoming_damage=remaining_damage,
		fever_rule=fever_rule, all_clear_ticket=ticket, elapsed_ms=scalars["elapsed_ms"],
		margin_rate=scalars["margin_rate"], time_progress_multiplier=scalars["time_progress_multiplier"],
		fever=fever if fever_rule else None,
	)
	return Afterstate(action, move_reward(attack, combo), observation)


def enumerate_afterstates(
	observation: Any, next_pair: Sequence[Any], usable_actions: Optional[set[int]] = None,
) -> List[Afterstate]:
	"""이번 수로 놓을 수 있는 모든 배치의 애프터스테이트를 계산한다.

	`usable_actions`를 주면 그 후보만 본다. 게임(솔로몬)은 가로 이동 경로·회전 킥·숨김 행까지
	보고 실제로 쓸 수 있는 배치를 따로 알려 주므로, 그 목록이 오면 관측값의 높이 조건 대신 쓴다.
	`next_pair`는 이 수 다음에 조작할 쌍이며, 애프터스테이트의 조작 쌍 자리에 들어간다.
	"""
	values = observation_values(observation)
	board = decode_observation_board(values)
	pair = decode_observation_pair(values)
	scalars = decode_observation_scalars(values)
	# bundledenemy는 룰·시간 배율을 모듈 전역으로 관리한다. 관측값에서 되살려 두어야 ATTACK이 맞는다.
	bundledenemy.configure_rule(scalars["fever_rule"], scalars["fever_active"])
	bundledenemy.configure_timing(scalars["margin_rate"], scalars["time_progress_multiplier"])
	candidates = sorted(usable_actions) if usable_actions is not None else [
		action for action in range(ACTION_COUNT) if is_legal_observation_action(values, action)
	]
	afterstates = [_build_afterstate(board, pair, scalars, action, next_pair) for action in candidates]
	return [afterstate for afterstate in afterstates if afterstate is not None]


def build_afterstate(observation: Any, action: int, next_pair: Sequence[Any]) -> Optional[Afterstate]:
	"""이미 둔 수 하나의 애프터스테이트를 되살린다. 서버의 온라인 학습이 사용한다."""
	afterstates = enumerate_afterstates(observation, next_pair, {int(action)})
	return afterstates[0] if afterstates else None


class ValueNetwork(nn.Module):
	"""애프터스테이트 하나의 가치를 출력하는 합성곱 신경망.

	보드는 6×12 위에 빈 칸·방해뿌요·5색을 나눈 7채널 평면으로 그대로 넣고, 조작 쌍과 스칼라 상태는
	합성곱을 지난 특징 뒤에 이어 붙인다. 출력은 행동 수와 무관한 스칼라 하나다.
	"""

	CONV_CHANNELS = 32

	def __init__(self) -> None:
		"""보드 합성곱 두 단과 256-128 은닉층의 가치 헤드를 구성한다."""
		super().__init__()
		self.board = nn.Sequential(
			nn.Conv2d(BOARD_CHANNELS, self.CONV_CHANNELS, kernel_size=3, padding=1), nn.ReLU(),
			nn.Conv2d(self.CONV_CHANNELS, self.CONV_CHANNELS, kernel_size=3, padding=1), nn.ReLU(),
		)
		self.head = nn.Sequential(
			nn.Linear(self.CONV_CHANNELS * BOARD_HEIGHT * BOARD_WIDTH + OBSERVATION_EXTRA_SIZE, 256), nn.ReLU(),
			nn.Linear(256, 128), nn.ReLU(), nn.Linear(128, 1),
		)

	def forward(self, observation: torch.Tensor) -> torch.Tensor:
		"""관측 벡터(한 개 또는 배치)를 받아 상태 가치를 계산한다."""
		flat = observation.reshape(-1, OBSERVATION_SIZE)
		cells = BOARD_WIDTH * BOARD_HEIGHT * BOARD_CHANNELS
		# 관측 벡터의 보드 구간은 채널→y→x 순서라 그대로 (채널, 높이, 너비)로 볼 수 있다.
		planes = flat[:, :cells].reshape(-1, BOARD_CHANNELS, BOARD_HEIGHT, BOARD_WIDTH)
		return self.head(torch.cat([self.board(planes).flatten(1), flat[:, cells:]], dim=1)).reshape(-1)


def load_existing_policy(output: Path, policy: ValueNetwork, device: torch.device) -> bool:
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


def load_policy_checkpoint(checkpoint_path: Path, device: torch.device) -> ValueNetwork:
	"""평가·직접 추론용으로 버전 검증을 거친 가치망 하나를 불러온다."""
	policy = ValueNetwork().to(device)
	if not load_existing_policy(checkpoint_path, policy, device):
		raise FileNotFoundError(f"체크포인트를 찾을 수 없습니다: {checkpoint_path}")
	policy.eval()
	return policy


def score_afterstates(
	policy: ValueNetwork, afterstates: Sequence[Afterstate], device: torch.device, gamma: float = DISCOUNT_GAMMA,
) -> torch.Tensor:
	"""후보마다 `즉시 보상 + 감가된 애프터스테이트 가치`를 한 번에 계산한다."""
	states = torch.tensor([afterstate.observation for afterstate in afterstates], dtype=torch.float32, device=device)
	with torch.inference_mode():
		values = policy(states)
	rewards = torch.tensor([afterstate.reward for afterstate in afterstates], dtype=torch.float32, device=device)
	return rewards + gamma * values


def select_afterstate(
	policy: ValueNetwork, observation: Any, next_pair: Sequence[Any], device: torch.device, *,
	usable_actions: Optional[set[int]] = None, epsilon: float = 0.0,
	explore_fn: Optional[Callable[[Sequence[Afterstate]], Optional[Afterstate]]] = None,
) -> Tuple[int, Optional[Afterstate]]:
	"""이번 수의 배치를 고르고, 고른 수의 애프터스테이트를 함께 돌려준다.

	`epsilon`이 0보다 크면 그 확률로 놓을 수 있는 후보 중 하나를 무작위로 고른다(탐험).
	`explore_fn`을 주면 탐험하는 수에서 먼저 그 함수에 후보를 물어보고, None을 돌려주면 무작위로
	고른다. 연쇄 유도 탐험 학습 방식이 이 자리에 적 AI의 배치를 넣는다.
	놓을 자리가 하나도 없으면 애프터스테이트 없이 게임의 스폰 위치(X=2)를 돌려주어, 환경이 이
	턴을 평소와 같은 패배 결과로 끝내게 한다.
	"""
	afterstates = enumerate_afterstates(observation, next_pair, usable_actions)
	if not afterstates:
		return (min(usable_actions) if usable_actions else 2 * ROTATION_COUNT + ROTATION_UP), None
	if epsilon > 0.0 and random.random() < epsilon:
		chosen = explore_fn(afterstates) if explore_fn is not None else None
		if chosen is None:
			chosen = random.choice(afterstates)
		return chosen.action, chosen
	scores = score_afterstates(policy, afterstates, device)
	chosen = afterstates[int(torch.argmax(scores).item())]
	return chosen.action, chosen


def choose_policy_action(
	policy: ValueNetwork, observation: Any, device: torch.device, next_pair: Sequence[Any] = (None, None),
	usable_actions: Optional[set[int]] = None,
) -> int:
	"""탐험 없이 이번 수의 최선 배치 행동 번호만 고른다. 서버 추론과 평가가 함께 쓴다."""
	return select_afterstate(policy, observation, next_pair, device, usable_actions=usable_actions)[0]


def infer_observation(checkpoint_path: Path, observation_path: Path, device_name: str = "auto") -> dict[str, int]:
	"""LM Studio나 HTTP 서버 없이 관측 JSON 파일을 모델에 직접 넣어 배치를 반환한다.

	JSON은 관측 벡터 배열이거나 `{"observation": [...], "nextPair": [...]}` 객체다. 다음 쌍을 함께
	주면 실제 대전과 같은 기준으로 애프터스테이트를 평가한다.
	"""
	device = torch.device(device_name if device_name != "auto" else ("cuda" if torch.cuda.is_available() else "cpu"))
	try:
		document = json.loads(observation_path.read_text(encoding="utf-8"))
	except (OSError, json.JSONDecodeError) as error:
		raise ValueError(f"관측 JSON을 읽을 수 없습니다: {observation_path} ({error})") from error
	observation = document.get("observation") if isinstance(document, dict) else document
	next_pair = document.get("nextPair", (None, None)) if isinstance(document, dict) else (None, None)
	if not isinstance(next_pair, (list, tuple)) or len(next_pair) != 2:
		raise ValueError("nextPair는 두 색으로 이루어진 배열이어야 합니다.")
	validate_observation(observation)
	policy = load_policy_checkpoint(checkpoint_path, device)
	action = choose_policy_action(policy, torch.tensor(observation, dtype=torch.float32), device, next_pair)
	x, rotation = action_to_placement(action)
	return {"action": action, "x": x, "rotation": rotation}


def evaluate_policy(
	checkpoint_path: Path, episodes: int, seed: int, device_name: str, opponent: str = "random",
) -> dict[str, Any]:
	"""탐험 없이(epsilon=0) 대전하고 승·패·무승부와 승률, 연쇄 분포를 집계한다.

	연쇄 통계는 에이전트 쪽 수만 센다. `max_combo_distribution`은 에피소드별 최대 연쇄 수(연쇄를 한 번도
	못 냈으면 0)마다 에피소드 수를, `combo_distribution`은 실제로 터진 수의 연쇄 수마다 그 횟수를 담는다.
	`average_combo`는 터진 수만의 평균이며 터진 수가 없으면 0이다.
	"""
	device = torch.device(device_name if device_name != "auto" else ("cuda" if torch.cuda.is_available() else "cpu"))
	policy = load_policy_checkpoint(checkpoint_path, device)

	def greedy_action(observation: torch.Tensor, next_pair: Sequence[Any]) -> int:
		"""탐험 없이 모델이 고르는 최선의 행동을 반환한다."""
		return choose_policy_action(policy, observation, device, next_pair)

	wins = losses = draws = 0
	max_combo_counts: Counter[int] = Counter()
	combo_counts: Counter[int] = Counter()
	for episode in range(episodes):
		environment = _make_environment(opponent, seed + episode, greedy_action)
		state = environment.reset()
		result = "timeout"
		episode_max_combo = 0
		max_steps = 100 if opponent == "solo" else PuyoDuelEnvironment.MAX_TURNS_PER_EPISODE
		for _ in range(max_steps):
			action = greedy_action(state, environment.next_pair_for_agent())
			state, _reward, done, info = environment.step(action)
			# 놓을 자리가 없어 끝난 수는 info에 연쇄 수가 없다.
			combo = int(info.get("combo", 0))
			if combo > 0:
				combo_counts[combo] += 1
				episode_max_combo = max(episode_max_combo, combo)
			if done:
				result = info.get("result", "invalid" if info.get("invalid") else "done")
				break
		max_combo_counts[episode_max_combo] += 1
		if result in ("enemy_defeated", "enemy_no_moves", "enemy_invalid_self_play"):
			wins += 1
		elif result in ("agent_defeated", "invalid"):
			losses += 1
		else:
			draws += 1
	fired_count = sum(combo_counts.values())
	return {
		"episodes": episodes, "wins": wins, "losses": losses, "draws": draws, "win_rate": wins / episodes,
		"average_max_combo": sum(combo * count for combo, count in max_combo_counts.items()) / episodes,
		"max_combo_distribution": dict(sorted(max_combo_counts.items())),
		"average_combo": sum(combo * count for combo, count in combo_counts.items()) / fired_count if fired_count else 0.0,
		"combo_distribution": dict(sorted(combo_counts.items())),
	}


def _make_environment(
	opponent: str, seed: int, self_play_action_fn: Optional[Callable[[torch.Tensor, Sequence[Any]], int]] = None,
	chain_seed_ratio: float = 0.0,
) -> "PuyoEnvironment | PuyoDuelEnvironment":
	"""--opponent 선택에 맞는 학습 환경을 만든다.

	'solo'는 상대 없이 버티기만 학습하는 옛 PuyoEnvironment다. 'random'은 매 에피소드
	self-play(자기 자신과 대전)와 bundledenemy.TRAINABLE_ENEMY_TYPES 중 하나를 무작위로
	골라 대전하는 PuyoDuelEnvironment를 만들고, 'self'는 항상 self-play, 그 밖의 값은
	해당 적 하나로 고정해 계속 대전하는 PuyoDuelEnvironment를 만든다. 기본 룰/피버 룰과
	색상 수(3~5색)는 PuyoDuelEnvironment가 에피소드마다 알아서 무작위로 고른다.
	`chain_seed_ratio`는 두 환경 모두에 그대로 넘기는 연쇄 씨앗 시작 확률이다.
	"""
	if opponent == "solo":
		return PuyoEnvironment(seed, chain_seed_ratio=chain_seed_ratio)
	resolved_opponent = None if opponent == "random" else opponent
	return PuyoDuelEnvironment(resolved_opponent, seed, self_play_action_fn=self_play_action_fn, chain_seed_ratio=chain_seed_ratio)


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
		"""실행 중 상태로 초기화하고 일시정지·중단·포기 이벤트 플래그를 만든다."""
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


# 한 애프터스테이트의 목표값을 만들 때 실제 보상을 몇 수까지 이어 볼지 정한다. 연쇄는 여러 수에
# 걸쳐 쌓았다가 한 번에 터지므로, 한 수만 보고 배우는 것보다 보상이 앞 수까지 빨리 전달된다.
N_STEP_RETURN = 3

# 연쇄 유도 탐험에서 안내 역할을 맡는 적이다. 목표 연쇄를 두고 연쇄를 쌓는 적 중에서 턴을 넘나드는
# 상태가 없는 적만 골랐다. 탐험하는 수에서만 띄엄띄엄 불리므로, 단탈리온처럼 단계를 기억하는 적은
# 판단이 어긋난다.
CHAIN_GUIDE_ENEMY_TYPES: Tuple[str, ...] = ("Amdusias", "Kimaris", "Andrealphus")


@dataclass(frozen=True)
class TrainingStrategy:
	"""학습 방식 하나의 설정이다. 추론 계약(보상·감가율·관측값·행동)은 건드리지 않고 학습 과정만 바꾼다.

	그래서 어떤 방식으로 학습한 체크포인트든 서버·브라우저 추론에 그대로 쓸 수 있고, 기존 체크포인트를
	다른 방식으로 이어 학습해도 된다. 새 방식은 TRAINING_STRATEGIES에 항목만 더하면 CLI의
	--training-strategy 선택지와 lngui.py의 콤보박스에 함께 나타난다.
	"""
	name: str
	# lngui.py가 영어로 표시할 때 콤보박스에 보여 줄 이름과 설명이다.
	label: str
	summary: str
	# CLI 도움말과 학습 로그에 쓰는 한국어 설명이다. lngui.py가 한국어로 표시할 때의 설명도 이 값이다.
	description: str
	# lngui.py가 한국어로 표시할 때의 이름이다. 비워 두면 영어 label을 쓴다.
	label_ko: str = ""
	# 탐험하는 수 중에서 무작위 대신 연쇄를 쌓는 적 AI(CHAIN_GUIDE_ENEMY_TYPES)의 배치를 따르는 비율이다.
	guided_exploration_ratio: float = 0.0
	# 에이전트의 시작 필드에 실제 피버 패턴을 연쇄 씨앗으로 깔아 두는 에피소드 비율이다.
	chain_seed_ratio: float = 0.0
	# 방해뿌요 교환 없이 혼자 쌓는 solo 에피소드로 바꾸는 비율이다. --opponent solo면 의미가 없다.
	solo_episode_ratio: float = 0.0
	# 목표값을 만들 때 실제 보상을 이어 보는 수의 개수다.
	n_step: int = N_STEP_RETURN


DEFAULT_TRAINING_STRATEGY = "standard"
# CLI 도움말과 lngui.py 콤보박스가 이 순서를 그대로 쓴다.
TRAINING_STRATEGIES: dict[str, TrainingStrategy] = {strategy.name: strategy for strategy in (
	TrainingStrategy(
		"standard", "Standard", "Random exploration among placeable moves and a 3-step return (previous behavior).",
		"기존 방식이다. 탐험은 놓을 수 있는 후보 중 무작위이고 n스텝은 3이다.",
		label_ko="기본",
	),
	TrainingStrategy(
		"chain-guided", "Chain-guided exploration",
		"Half of the exploration moves follow a chain-building enemy AI (Amdusias, Kimaris or Andrealphus).",
		"탐험하는 수의 절반을 연쇄를 쌓는 적 AI(암두시아스·키마리스·안드레알푸스)의 배치로 둔다.",
		label_ko="연쇄 유도 탐험", guided_exploration_ratio=0.5,
	),
	TrainingStrategy(
		"chain-curriculum", "Chain curriculum",
		"30% of episodes start from a fever-pattern chain seed and 20% are played solo without garbage.",
		"에피소드의 30%는 피버 패턴을 연쇄 씨앗으로 깔고 시작하고, 20%는 방해뿌요 없는 solo로 진행한다.",
		label_ko="연쇄 커리큘럼", chain_seed_ratio=0.3, solo_episode_ratio=0.2,
	),
	TrainingStrategy(
		"long-nstep", "Long n-step return", "Value targets sum the actual rewards of the next 8 moves instead of 3.",
		"목표값을 만들 때 3수 대신 8수까지의 실제 보상을 이어 본다.",
		label_ko="긴 n스텝 목표값", n_step=8,
	),
	TrainingStrategy(
		"chain-all", "All chain strategies",
		"Chain-guided exploration, the chain curriculum and the 8-step return together.",
		"연쇄 유도 탐험·연쇄 커리큘럼·8스텝 목표값을 모두 함께 쓴다.",
		label_ko="연쇄 방식 모두 사용", guided_exploration_ratio=0.5, chain_seed_ratio=0.3, solo_episode_ratio=0.2, n_step=8,
	),
)}


def resolve_training_strategy(strategy: "str | TrainingStrategy") -> TrainingStrategy:
	"""학습 방식 이름(또는 이미 만든 설정)을 설정 객체로 바꾼다. 모르는 이름이면 ValueError를 올린다."""
	if isinstance(strategy, TrainingStrategy):
		return strategy
	resolved = TRAINING_STRATEGIES.get(strategy)
	if resolved is None:
		raise ValueError(f"알 수 없는 학습 방식입니다: {strategy} (사용 가능: {', '.join(TRAINING_STRATEGIES)})")
	return resolved


def build_value_samples(
	trajectory: Sequence[Tuple[Optional[List[float]], float]], terminal_value: Optional[float],
	zero_state: torch.Tensor, *, n_step: int = N_STEP_RETURN, gamma: float = DISCOUNT_GAMMA,
) -> List[ValueSample]:
	"""한 에피소드의 (애프터스테이트, 그 수의 보상) 기록을 n스텝 목표값 표본으로 바꾼다.

	애프터스테이트 x의 가치는 그 뒤에 이어지는 보상들의 합이다. 그래서 목표값은 다음 수부터 n개의
	보상을 감가해 더하고, 거기까지 진행한 상태의 가치를 감가해 붙인 값이 된다.

	`terminal_value`는 승부가 난 에피소드의 **마지막 애프터스테이트 자체의 가치**(승리 +50, 패배
	-50)이며, 승부가 나지 않고 최대 턴에서 잘렸으면 None이다. 승패를 그 앞 수의 보상이 아니라 이
	상태의 가치로 두어야, 배치 후보 중 두는 순간 패배하는 수의 가치도 -50으로 평가된다. 승패를
	보상으로만 주면 죽은 보드의 가치가 0이 되어 "지금 죽는 수"가 오히려 좋아 보이게 된다.
	"""
	samples: List[ValueSample] = []
	length = len(trajectory)
	# 같은 애프터스테이트가 자기 표본과 앞 수의 부트스트랩으로 두 번 쓰이므로 텐서는 한 번만 만든다.
	states = [
		torch.tensor(observation, dtype=torch.float32) if observation is not None else None
		for observation, _reward in trajectory
	]
	for index in range(length):
		# 놓을 자리가 없어 애프터스테이트를 만들지 못한 수는 배울 상태 자체가 없다.
		if states[index] is None:
			continue
		if index == length - 1:
			# 승부가 난 마지막 상태의 가치는 승패 보상 그 자체다. 잘린 에피소드의 마지막 상태는
			# 뒤가 비어 목표값을 만들 수 없으므로 표본으로 쓰지 않는다.
			if terminal_value is not None:
				samples.append(ValueSample(states[index], terminal_value, zero_state, 0.0))
			continue
		partial_return = 0.0
		discount = 1.0
		last_index = index
		for step_index in range(index + 1, min(index + n_step, length - 1) + 1):
			partial_return += discount * trajectory[step_index][1]
			discount *= gamma
			last_index = step_index
		bootstrap = states[last_index]
		if bootstrap is not None:
			samples.append(ValueSample(states[index], partial_return, bootstrap, discount))
		else:
			# 마지막 수에 놓을 자리가 없어 상태가 없다. 그 자리의 종료 가치를 대신 더한다.
			samples.append(ValueSample(states[index], partial_return + discount * (terminal_value or 0.0), zero_state, 0.0))
	return samples


def _format_eta(seconds: float) -> str:
	"""남은 시간을(초) H:MM:SS 형태의 문자열로 바꾼다."""
	total_seconds = max(0, int(seconds))
	hours, remainder = divmod(total_seconds, 3600)
	minutes, seconds_part = divmod(remainder, 60)
	return f"{hours}:{minutes:02d}:{seconds_part:02d}"


def train(
	episodes: int, seed: int, output: Path, device_name: str, server_url: str = "", api_token: str = "", opponent: str = "random", *,
	control: Optional[TrainingControl] = None, log: Callable[[str], None] = print,
	on_progress: Optional[Callable[[int, int, dict], None]] = None,
	strategy: "str | TrainingStrategy" = DEFAULT_TRAINING_STRATEGY,
) -> None:
	"""애프터스테이트 가치망을 학습하고 체크포인트를 저장한다.

	`control`을 넘기면 lngui.py 같은 GUI가 별도 쓰레드에서 일시정지·중단·강제 포기를 요청할 수
	있다. `log`는 기본이 `print`라 CLI 동작은 그대로이며, GUI는 큐에 적재하는 콜백을 넘겨 로그
	패널에 표시한다. `on_progress`는 매 에피소드가 끝날 때 (완료 수, 전체 수, 통계) 로 호출되어
	GUI 진행 게이지를 갱신한다. `strategy`는 TRAINING_STRATEGIES의 이름 또는 TrainingStrategy이며,
	기본값 "standard"는 이 인자가 없던 때와 같은 학습을 한다.
	"""
	# 잘못된 이름이면 모델을 만들기 전에 바로 알린다.
	training_strategy = resolve_training_strategy(strategy)
	random.seed(seed)
	torch.manual_seed(seed)
	device = torch.device(device_name if device_name != "auto" else ("cuda" if torch.cuda.is_available() else "cpu"))
	log_interval = 500 if device.type == "cpu" else max(1, episodes // 100)
	api_client = LearningApiClient(server_url, api_token or os.environ.get("PUYOW_AI_TOKEN", "")) if server_url else None
	policy = ValueNetwork().to(device)
	# --output 파일이 실제로 있으면 새 초기 가중치를 버리고 그 모델부터 추가 학습을 시작한다.
	resumed = load_existing_policy(output, policy, device)
	target = ValueNetwork().to(device)
	target.load_state_dict(policy.state_dict())
	optimizer = torch.optim.Adam(policy.parameters(), lr=1e-3)
	replay: Deque[ValueSample] = deque(maxlen=50_000)
	batch_size = 128
	epsilon_start, epsilon_end = 1.0, 0.05
	# 전체 에피소드의 절반을 지나면 탐험 비율이 최저가 되고, 남은 절반은 거의 자기 판단으로 둔다.
	exploration_episodes = max(1, episodes // 2)
	# 학습 방식이 쓰는 확률 판정은 전역 random과 따로 둔다. 기본 방식은 이 생성기를 전혀 쓰지 않으므로
	# 전역 난수 흐름이 예전과 같게 유지된다.
	strategy_random = random.Random(f"training-strategy-{seed}")
	# 애프터스테이트가 그대로 다음 학습 입력이 되므로, 부트스트랩할 상태가 없을 때 쓸 0 벡터 하나만
	# 만들어 두고 모든 표본이 나눠 쓴다(가중치 0으로 곱해져 목표값에 영향을 주지 않는다).
	zero_state = torch.zeros(OBSERVATION_SIZE, dtype=torch.float32)
	steps = 0
	win_count = 0
	loss_count = 0
	training_start_time = time.monotonic()
	progress_log_count = 0
	if resumed:
		# 체크포인트에는 가중치만 있으므로 optimizer·replay buffer·epsilon은 이번 실행에서 새로 시작한다.
		log(f"resume={output} 기존 모델 가중치로 추가 학습을 시작합니다.")
	else:
		log(f"new_model={output} 새 모델 가중치로 학습을 시작합니다.")
	log(f"training_strategy={training_strategy.name} {training_strategy.description}")

	# self-play(PuyoDuelEnvironment.SELF_PLAY_OPPONENT) 에피소드에서 상대측 행동을 고르는
	# 콜백이다. 매 스텝 최신 epsilon으로 갱신되는 epsilon_holder를 통해, 학습 중인 에이전트와
	# 같은 epsilon-greedy 탐험 규칙을 상대측에도 그대로 적용한다.
	epsilon_holder = [epsilon_start]

	def self_play_action(observation: torch.Tensor, next_pair: Sequence[Any]) -> int:
		"""self-play 상대측 행동을, 학습 중인 에이전트와 같은 epsilon-greedy 규칙으로 고른다."""
		return select_afterstate(policy, observation, next_pair, device, epsilon=epsilon_holder[0])[0]

	for episode in range(episodes):
		if control is not None:
			control.check_abort()
		# solo 비율이 있는 학습 방식은 일부 에피소드를 방해뿌요 없는 혼자 쌓기로 바꾼다.
		episode_opponent = opponent
		if opponent != "solo" and training_strategy.solo_episode_ratio > 0.0 and strategy_random.random() < training_strategy.solo_episode_ratio:
			episode_opponent = "solo"
		environment = _make_environment(episode_opponent, seed + episode, self_play_action, training_strategy.chain_seed_ratio)
		max_steps_per_episode = 100 if episode_opponent == "solo" else PuyoDuelEnvironment.MAX_TURNS_PER_EPISODE
		explore_fn: Optional[Callable[[Sequence[Afterstate]], Optional[Afterstate]]] = None
		if training_strategy.guided_exploration_ratio > 0.0:
			# 안내 적도 판단에 난수를 쓰므로 에피소드마다 새로 만들어 대전 사이에 상태가 이어지지 않게 한다.
			guide = bundledenemy.create_enemy(
				strategy_random.choice(CHAIN_GUIDE_ENEMY_TYPES), random.Random(strategy_random.randrange(2 ** 30)),
			)

			def guided_exploration(
				afterstates: Sequence[Afterstate], environment: Any = environment, guide: bundledenemy.BaseEnemy = guide,
			) -> Optional[Afterstate]:
				"""탐험하는 수의 일부를 안내 적의 배치로 바꾼다. 해당하지 않으면 None을 돌려 무작위 탐험에 맡긴다."""
				if strategy_random.random() >= training_strategy.guided_exploration_ratio:
					return None
				action = environment.suggest_agent_action(guide)
				return next((afterstate for afterstate in afterstates if afterstate.action == action), None)

			explore_fn = guided_exploration
		state = environment.reset()
		session_id = f"puyow-training-{seed}-{episode}"
		if api_client:
			api_client.reset(session_id, state)
		episode_reward = 0.0
		episode_result = "timeout"
		episode_max_combo = 0
		# 승부가 난 에피소드의 마지막 애프터스테이트 가치다. 최대 턴에서 잘리면 None으로 남는다.
		terminal_value: Optional[float] = None
		# 이번 에피소드에서 지나온 (애프터스테이트, 그 수가 만든 보상) 기록이다. 에피소드가 끝난 뒤
		# n스텝 목표값을 만들어 리플레이에 넣는다.
		trajectory: List[Tuple[Optional[List[float]], float]] = []
		# 탐험 비율은 스텝이 아니라 에피소드 기준으로 줄인다. 에피소드마다 실제 수 개수가 크게
		# 달라서 스텝 기준으로는 학습이 끝날 때까지 탐험 비율이 거의 내려가지 않기 때문이다.
		epsilon = max(epsilon_end, epsilon_start - (epsilon_start - epsilon_end) * episode / exploration_episodes)
		epsilon_holder[0] = epsilon
		for _ in range(max_steps_per_episode):
			if control is not None:
				control.check_abort()
			action, afterstate = select_afterstate(
				policy, state, environment.next_pair_for_agent(), device, epsilon=epsilon, explore_fn=explore_fn,
			)
			next_state, reward, done, info = environment.step(action)
			episode_max_combo = max(episode_max_combo, int(info.get("combo", 0)))
			if api_client:
				api_client.step(session_id, state, action, reward, next_state, done)
			# 승패 보상은 마지막 상태의 가치로 따로 쓰므로, 기록에는 이 수가 만든 보상만 남긴다.
			step_terminal_value = info.get("terminal_value")
			trajectory.append((
				afterstate.observation if afterstate is not None else None,
				reward - (step_terminal_value if step_terminal_value is not None else 0.0),
			))
			state, episode_reward, steps = next_state, episode_reward + reward, steps + 1
			if len(replay) >= batch_size:
				batch = random.sample(replay, batch_size)
				states = torch.stack([item.state for item in batch]).to(device)
				returns = torch.tensor([item.partial_return for item in batch], dtype=torch.float32, device=device)
				bootstraps = torch.stack([item.bootstrap for item in batch]).to(device)
				discounts = torch.tensor([item.discount for item in batch], dtype=torch.float32, device=device)
				with torch.no_grad():
					expected = returns + discounts * target(bootstraps)
				loss = nn.functional.smooth_l1_loss(policy(states), expected)
				optimizer.zero_grad()
				loss.backward()
				nn.utils.clip_grad_norm_(policy.parameters(), 1.0)
				optimizer.step()
			if steps % 250 == 0:
				target.load_state_dict(policy.state_dict())
			if done:
				terminal_value = step_terminal_value
				episode_result = info.get("result", "invalid" if info.get("invalid") else "done")
				break
		replay.extend(build_value_samples(trajectory, terminal_value, zero_state, n_step=training_strategy.n_step))
		if episode_result in ("enemy_defeated", "enemy_no_moves", "enemy_invalid_self_play"):
			win_count += 1
		elif episode_result in ("agent_defeated", "invalid"):
			loss_count += 1
		if api_client:
			api_client.episode_end(session_id)
		if on_progress is not None:
			on_progress(episode + 1, episodes, {
				"reward": episode_reward, "epsilon": epsilon, "result": episode_result,
				"wins": win_count, "losses": loss_count, "max_combo": episode_max_combo,
			})
		if (episode + 1) % log_interval == 0 or episode == 0:
			progress_log_count += 1
			eta_text = ""
			if progress_log_count >= 2:
				elapsed = time.monotonic() - training_start_time
				remaining_episodes = episodes - (episode + 1)
				eta_seconds = elapsed / (episode + 1) * remaining_episodes
				eta_text = f" eta={_format_eta(eta_seconds)}"
			log(f"episode={episode + 1}/{episodes} reward={episode_reward:.1f} epsilon={epsilon:.3f} "
				f"result={episode_result} max_combo={episode_max_combo} wins={win_count} losses={loss_count}{eta_text}")
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
			"현재 default.pt는 사용자 정의 가치망 체크포인트라 LM Studio용 GGUF로 변환할 수 없습니다. "
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
	"""CLI 인자를 파싱해 GGUF 변환·직접 추론·평가·학습 중 하나를 실행한다."""
	parser = argparse.ArgumentParser(description="Puyo W 애프터스테이트 가치망 학습")
	parser.add_argument("--episodes", type=int, default=1000, help="학습 에피소드 수")
	parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="재현 가능한 난수 시드")
	parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="체크포인트 경로(기존 파일이면 가중치를 복원해 추가 학습)")
	parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default=DEFAULT_DEVICE)
	parser.add_argument("--server-url", default="", help="학습 이벤트를 전송할 pythonserver.py 주소(예: http://localhost:9891)")
	parser.add_argument("--api-token", default="", help="pythonserver.py의 learning_token 값. 로컬 서버라면 \"localhost\"로도 인증할 수 있다(미지정 시 PUYOW_AI_TOKEN 환경변수 사용)")
	parser.add_argument("--evaluate-episodes", type=int, default=0, help="학습하지 않고 epsilon=0으로 평가할 에피소드 수(승패와 함께 연쇄 분포도 출력)")
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
	parser.add_argument(
		"--training-strategy", default=DEFAULT_TRAINING_STRATEGY, choices=tuple(TRAINING_STRATEGIES),
		# argparse는 도움말을 % 형식 문자열로 다루므로 설명에 든 "30%" 같은 문자를 이스케이프한다.
		help="학습 방식(학습에만 적용). " + " ".join(
			f"'{name}': {strategy.description}" for name, strategy in TRAINING_STRATEGIES.items()
		).replace("%", "%%"),
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
	train(
		args.episodes, args.seed, args.output, args.device, args.server_url, args.api_token, args.opponent,
		strategy=args.training_strategy,
	)
if __name__ == "__main__":
	main()




