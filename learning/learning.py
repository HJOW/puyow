"""Puyo W용 self-play DQN 학습기.

pythonserver.py의 인증된 학습 이벤트 API를 선택적으로 사용한다. 서버 URL을
지정하지 않으면 Puyo W의 핵심 보드 규칙을 작은 독립 환경으로 실행하고,
지정하면 매 에피소드의 관측값·행동·보상·종료 상태를 서버로 전달한다.
브라우저·적 AI가 추가 학습 상태를 읽어야 할 때는 PuyoW.getGameState()의
mode, rule, 양측 board/normalBoard/fever.field 및 앞 두 nextPairs 계약을 사용한다.
학습된 가중치는 PyTorch 체크포인트로 저장된다.
"""

# Puyo W - AI 인공지능용 학습 모델 (LM Studio 호환) 개발 스크립트
#
# 이 스크립트에서는 PyTorch 를 이용해 Puyo W 학습 모델을 생성한다.
#    브라우저 전이 전송을 사용할 때는 pythonserver.py를 먼저 구동한다.
#
# 사용법은 docs/MachineLearning.md 참고
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
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Deque, List, Optional, Tuple

import torch
from torch import nn

import bundledenemy
from common import (
	ACTION_COUNT, BOARD_HEIGHT, BOARD_WIDTH, COLORS, OBSERVATION_SIZE,
	ROTATION_DOWN, ROTATION_LEFT, ROTATION_RIGHT, ROTATION_UP, action_to_placement,
)


class LearningApiClient:
	"""pythonserver.py의 인증된 학습 이벤트 API 클라이언트."""

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


def encode_observation(board: List[List[int]], current_pair: Tuple[int, int], attack: float, turn: int) -> torch.Tensor:
	"""보드·현재 쌍·누적 ATTACK·턴 수를 common.OBSERVATION_SIZE 계약에 맞는 벡터로 인코딩한다.

	PuyoEnvironment(단일 플레이어)와 PuyoDuelEnvironment(적 AI 대전) 양쪽이 이 함수를 공유한다.
	빈 칸(-1)과 방해뿌요(bundledenemy.GARBAGE=-2)는 모두 `cell < 0`이라 같은 채널로 인코딩된다.
	색상별 채널을 넘어 방해뿌요 전용 채널을 두는 일은 TODO.md에 있는 별도의 관측값 재설계
	작업(common.py의 OBSERVATION_SIZE 계약 자체를 바꾸는 일) 범위이므로 이 변경에서는 다루지 않는다.
	"""
	values = []
	for channel in range(COLORS + 1):
		values.extend(
			1.0 if (cell < 0 if channel == 0 else cell == channel - 1) else 0.0
			for row in board for cell in row
		)
	for color in current_pair:
		values.extend(1.0 if color == candidate else 0.0 for candidate in range(COLORS))
	values.extend((min(attack, 30) / 30.0, min(turn, 100) / 100.0))
	return torch.tensor(values, dtype=torch.float32)


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
		self.agent_pair = self._pair()
		self.enemy_pair = self._pair()
		self.agent_next_pairs = [self._pair() for _ in range(self.NEXT_PAIR_LOOKAHEAD)]
		self.enemy_next_pairs = [self._pair() for _ in range(self.NEXT_PAIR_LOOKAHEAD)]
		self.turn = 0
		return self.observe()

	def observe(self) -> torch.Tensor:
		return encode_observation(self.agent_board, self.agent_pair, self.agent_attack, self.turn)

	def _refill(self, pairs: List[Tuple[int, int]]) -> Tuple[int, int]:
		pairs.append(self._pair())
		return pairs.pop(0)

	def _select_enemy_positions(self) -> Optional[List[Tuple[int, int]]]:
		"""상대(적 AI 또는 self-play 정책)의 이번 수 착지 좌표를 정한다. 둘 곳이 없으면 None이다."""
		if not self.is_self_play:
			placement = self.opponent.decide(self.enemy_board, self.enemy_pair, self.enemy_next_pairs, self.enemy_damage)
			return placement.positions if placement is not None else None
		observation = encode_observation(self.enemy_board, self.enemy_pair, self.enemy_attack, self.turn)
		action = self.self_play_action_fn(observation) if self.self_play_action_fn else self.random.randrange(ACTION_COUNT)
		column, rotation = action_to_placement(action)
		landing = bundledenemy.find_landing_placement(self.enemy_board, column, rotation)
		return [landing[0], landing[1]] if landing is not None else None

	def step(self, action: int) -> Tuple[torch.Tensor, float, bool, dict]:
		# bundledenemy의 룰 전역 상태가 다른 곳에서 바뀌었을 가능성에 대비해 매 스텝 다시 확인한다.
		bundledenemy.configure_rule(self.fever_rule)
		column, rotation = action_to_placement(action)
		landing = bundledenemy.find_landing_placement(self.agent_board, column, rotation)
		if landing is None:
			return self.observe(), self.INVALID_ACTION_REWARD, True, {"invalid": True}
		positions = [landing[0], landing[1]]
		result_board, combo, attack = bundledenemy.resolve_placement(self.agent_board, self.agent_pair, positions)
		self.agent_board = result_board
		self.agent_attack = attack
		reward = attack + combo * combo
		info = {
			"combo": combo, "attack": attack,
			"opponent": self.SELF_PLAY_OPPONENT if self.is_self_play else self.opponent.get_class_type(),
			"fever_rule": self.fever_rule, "color_count": self.color_count,
		}

		if combo > 0:
			self.agent_damage, self.enemy_damage = _apply_attack_exchange(self.agent_damage, attack, self.enemy_damage)
		elif self.agent_damage > 0:
			self.agent_board, dropped = bundledenemy.drop_garbage(self.agent_board, self.agent_damage, self.random)
			self.agent_damage -= dropped

		if bundledenemy.is_defeat_board(self.agent_board):
			return self.observe(), reward + self.LOSS_REWARD, True, {**info, "result": "agent_defeated"}

		self.agent_pair = self._refill(self.agent_next_pairs)

		enemy_positions = self._select_enemy_positions()
		if enemy_positions is None:
			# 상대 필드에 더 이상 둘 곳이 없다: 상대의 패배로 처리한다.
			result = "enemy_invalid_self_play" if self.is_self_play else "enemy_no_moves"
			return self.observe(), reward + self.WIN_REWARD, True, {**info, "result": result}

		enemy_result_board, enemy_combo, enemy_attack = bundledenemy.resolve_placement(self.enemy_board, self.enemy_pair, enemy_positions)
		if enemy_result_board is None:
			# bundledenemy가 규칙을 벗어난 배치를 반환하지 않는 한 발생하지 않는다. 방어적으로만 처리한다.
			enemy_result_board, enemy_combo, enemy_attack = self.enemy_board, 0, 0.0
		self.enemy_board = enemy_result_board
		self.enemy_attack = enemy_attack

		if enemy_combo > 0:
			self.enemy_damage, self.agent_damage = _apply_attack_exchange(self.enemy_damage, enemy_attack, self.agent_damage)
		elif self.enemy_damage > 0:
			self.enemy_board, dropped = bundledenemy.drop_garbage(self.enemy_board, self.enemy_damage, self.random)
			self.enemy_damage -= dropped

		if bundledenemy.is_defeat_board(self.enemy_board):
			return self.observe(), reward + self.WIN_REWARD, True, {**info, "result": "enemy_defeated"}

		self.enemy_pair = self._refill(self.enemy_next_pairs)
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


def train(episodes: int, seed: int, output: Path, device_name: str, server_url: str = "", api_token: str = "", opponent: str = "random") -> None:
	random.seed(seed)
	torch.manual_seed(seed)
	device = torch.device(device_name if device_name != "auto" else ("cuda" if torch.cuda.is_available() else "cpu"))
	api_client = LearningApiClient(server_url, api_token or os.environ.get("PUYOW_AI_TOKEN", "")) if server_url else None
	policy = PolicyNetwork().to(device)
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

	# self-play(PuyoDuelEnvironment.SELF_PLAY_OPPONENT) 에피소드에서 상대측 행동을 고르는
	# 콜백이다. 매 스텝 최신 epsilon으로 갱신되는 epsilon_holder를 통해, 학습 중인 에이전트와
	# 같은 epsilon-greedy 탐험 규칙을 상대측에도 그대로 적용한다.
	epsilon_holder = [epsilon_start]

	def self_play_action(observation: torch.Tensor) -> int:
		if random.random() < epsilon_holder[0]:
			return random.randrange(ACTION_COUNT)
		with torch.no_grad():
			return int(policy(observation.to(device)).argmax().item())

	for episode in range(episodes):
		environment = _make_environment(opponent, seed + episode, self_play_action)
		state = environment.reset()
		session_id = f"puyow-training-{seed}-{episode}"
		if api_client:
			api_client.reset(session_id, state)
		episode_reward = 0.0
		episode_result = "timeout"
		for _ in range(max_steps_per_episode):
			epsilon = max(epsilon_end, epsilon_start - (epsilon_start - epsilon_end) * steps / total_steps)
			epsilon_holder[0] = epsilon
			if random.random() < epsilon:
				action = random.randrange(ACTION_COUNT)
			else:
				with torch.no_grad():
					action = int(policy(state.to(device)).argmax().item())
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
		if (episode + 1) % max(1, episodes // 10) == 0 or episode == 0:
			print(f"episode={episode + 1}/{episodes} reward={episode_reward:.1f} epsilon={epsilon:.3f} "
				f"result={episode_result} wins={win_count} losses={loss_count}")

	output.parent.mkdir(parents=True, exist_ok=True)
	torch.save({"model": policy.state_dict(), "observation_size": OBSERVATION_SIZE, "action_count": ACTION_COUNT, "seed": seed}, output)
	output.with_suffix(".json").write_text(json.dumps({"observation_size": OBSERVATION_SIZE, "action_count": ACTION_COUNT, "board": [BOARD_WIDTH, BOARD_HEIGHT]}, indent=2), encoding="utf-8")
	print(f"saved={output} device={device}")


def export_gguf(source: Path, output: Path, converter: Path) -> None:
	"""llama.cpp 변환기로 Hugging Face Transformer 모델을 GGUF로 변환한다."""
	if source.is_file() or not (source / "config.json").is_file():
		raise ValueError(
			"현재 puyow_dqn.pt는 사용자 정의 DQN 체크포인트라 LM Studio용 GGUF로 변환할 수 없습니다. "
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
	parser = argparse.ArgumentParser(description="Puyo W self-play DQN 학습")
	parser.add_argument("--episodes", type=int, default=1000, help="self-play 에피소드 수")
	parser.add_argument("--seed", type=int, default=2026, help="재현 가능한 난수 시드")
	parser.add_argument("--output", type=Path, default=Path("learning/puyow_dqn.pt"), help="체크포인트 경로")
	parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
	parser.add_argument("--server-url", default="", help="학습 이벤트를 전송할 nodeserver.js 주소(예: http://localhost:9891)")
	parser.add_argument("--api-token", default="", help="nodeserver.js의 PUYOW_AI_TOKEN 값(미지정 시 환경변수 사용)")
	parser.add_argument("--export-gguf", type=Path, metavar="MODEL_DIR", help="Hugging Face Transformer 모델 디렉터리를 GGUF로 변환")
	parser.add_argument("--gguf-output", type=Path, default=Path("learning/model-f16.gguf"), help="GGUF 출력 경로")
	parser.add_argument("--llama-cpp-converter", type=Path, default=Path("llama.cpp") / "convert_hf_to_gguf.py", help="llama.cpp의 convert_hf_to_gguf.py 경로")
	parser.add_argument(
		"--opponent", default="random",
		choices=("random", "solo", PuyoDuelEnvironment.SELF_PLAY_OPPONENT) + bundledenemy.TRAINABLE_ENEMY_TYPES,
		help="대전 상대. 'random'은 매 에피소드 self-play(자기 자신과 대전) 또는 bundledenemy의 적 "
			"중 하나를 무작위로 고르고(기본값), 'self'는 항상 self-play, 'solo'는 상대 없이 "
			"버티기만 학습하는 옛 방식이며, 그 밖에는 지정한 적 하나로 고정한다.",
	)
	args = parser.parse_args()
	if args.export_gguf:
		export_gguf(args.export_gguf, args.gguf_output, args.llama_cpp_converter)
		return
	if args.episodes < 1:
		parser.error("--episodes는 1 이상이어야 합니다.")
	train(args.episodes, args.seed, args.output, args.device, args.server_url, args.api_token, args.opponent)



# TODO: 현재 DQN 정책을 LM Studio가 아닌 별도 게임 추론 런타임에서 실행하는 경로를 추가한다.
# TODO: hardGarbage, fever, all-clear ticket, margin rate 시간 배율을 환경에 반영한다.
#       (garbage/방해뿌요 교환은 PuyoDuelEnvironment에 구현되었다.)
# TODO: PuyoW.common.simulatePlacementBoard()와 결과를 대조하는 회귀 테스트를 추가한다.
# TODO: 평가 전용(입실론=0, 승률 집계) 에피소드와 모델 버전 호환 검증을 추가한다.


if __name__ == "__main__":
	main()




