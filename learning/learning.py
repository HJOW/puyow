"""Puyo W용 self-play DQN 학습기.

nodeserver.js의 인증된 학습 이벤트 API를 선택적으로 사용한다. 서버 URL을
지정하지 않으면 Puyo W의 핵심 보드 규칙을 작은 독립 환경으로 실행하고,
지정하면 매 에피소드의 관측값·행동·보상·종료 상태를 서버로 전달한다.
학습된 가중치는 PyTorch 체크포인트로 저장된다.
"""

# Puyo W - AI 인공지능용 학습 모델 (LM Studio 호환) 개발 스크립트
#
# 이 스크립트에서는 PyTorch 를 이용해 Puyo W 학습 모델을 생성한다.
#    이 스크립트 사용 전, 게임 서버 (nodeserver.js) 를 먼저 구동한다.
#
# Copyright 2026 HJOW
# Licensed under the Apache License, Version 2.0.
# 
# See INFO_FOR_AI.md if you are AI.

import argparse
import json
import random
import os
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Deque, List, Tuple

import torch
from torch import nn


BOARD_WIDTH = 6
BOARD_HEIGHT = 12
COLORS = 5
ACTION_COUNT = BOARD_WIDTH * 4
OBSERVATION_SIZE = BOARD_WIDTH * BOARD_HEIGHT * (COLORS + 1) + COLORS * 2 + 2


class LearningApiClient:
	"""nodeserver.js의 인증된 학습 이벤트 API 클라이언트."""

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


class PuyoEnvironment:
	"""간결한 Puyo W 보드 환경. board[y][x]에서 y=0은 바닥이다."""

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
		values = []
		for channel in range(COLORS + 1):
			values.extend(
				1.0 if (cell < 0 if channel == 0 else cell == channel - 1) else 0.0
				for row in self.board for cell in row
			)
		for color in self.current_pair:
			values.extend(1.0 if color == candidate else 0.0 for candidate in range(COLORS))
		values.extend((min(self.attack, 30) / 30.0, min(self.turn, 100) / 100.0))
		return torch.tensor(values, dtype=torch.float32)

	def _cells_for_action(self, action: int) -> List[Tuple[int, int, int]] | None:
		column, rotation = divmod(action, 4)
		first, second = self.current_pair
		if rotation == 0:
			cells = [(column, 0, first), (column + 1, 0, second)]
		elif rotation == 1:
			cells = [(column, 0, first), (column, 1, second)]
		elif rotation == 2:
			cells = [(column, 0, first), (column - 1, 0, second)]
		else:
			cells = [(column, 1, first), (column, 0, second)]
		if any(x < 0 or x >= BOARD_WIDTH for x, _, _ in cells):
			return None
		heights = [sum(self.board[y][x] >= 0 for y in range(BOARD_HEIGHT)) for x in range(BOARD_WIDTH)]
		result = []
		for x, offset, color in cells:
			y = heights[x] + offset
			if y >= BOARD_HEIGHT:
				return None
			result.append((x, y, color))
			heights[x] += 1
		return result

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


class PolicyNetwork(nn.Module):
	def __init__(self) -> None:
		super().__init__()
		self.layers = nn.Sequential(
			nn.Linear(OBSERVATION_SIZE, 256), nn.ReLU(),
			nn.Linear(256, 128), nn.ReLU(), nn.Linear(128, ACTION_COUNT)
		)

	def forward(self, state: torch.Tensor) -> torch.Tensor:
		return self.layers(state)


def train(episodes: int, seed: int, output: Path, device_name: str, server_url: str = "", api_token: str = "") -> None:
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
	total_steps = max(1, episodes * 100)
	steps = 0

	for episode in range(episodes):
		environment = PuyoEnvironment(seed + episode)
		state = environment.reset()
		session_id = f"puyow-training-{seed}-{episode}"
		if api_client:
			api_client.reset(session_id, state)
		episode_reward = 0.0
		for _ in range(100):
			epsilon = max(epsilon_end, epsilon_start - (epsilon_start - epsilon_end) * steps / total_steps)
			if random.random() < epsilon:
				action = random.randrange(ACTION_COUNT)
			else:
				with torch.no_grad():
					action = int(policy(state.to(device)).argmax().item())
			next_state, reward, done, _ = environment.step(action)
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
				break
		if api_client:
			api_client.episode_end(session_id)
		if (episode + 1) % max(1, episodes // 10) == 0 or episode == 0:
			print(f"episode={episode + 1}/{episodes} reward={episode_reward:.1f} epsilon={epsilon:.3f}")

	output.parent.mkdir(parents=True, exist_ok=True)
	torch.save({"model": policy.state_dict(), "observation_size": OBSERVATION_SIZE, "action_count": ACTION_COUNT, "seed": seed}, output)
	output.with_suffix(".json").write_text(json.dumps({"observation_size": OBSERVATION_SIZE, "action_count": ACTION_COUNT, "board": [BOARD_WIDTH, BOARD_HEIGHT]}, indent=2), encoding="utf-8")
	print(f"saved={output} device={device}")


def main() -> None:
	parser = argparse.ArgumentParser(description="Puyo W self-play DQN 학습")
	parser.add_argument("--episodes", type=int, default=1000, help="self-play 에피소드 수")
	parser.add_argument("--seed", type=int, default=2026, help="재현 가능한 난수 시드")
	parser.add_argument("--output", type=Path, default=Path("learning/puyow_dqn.pt"), help="체크포인트 경로")
	parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
	parser.add_argument("--server-url", default="", help="학습 이벤트를 전송할 nodeserver.js 주소(예: http://localhost:9891)")
	parser.add_argument("--api-token", default="", help="nodeserver.js의 PUYOW_AI_TOKEN 값(미지정 시 환경변수 사용)")
	args = parser.parse_args()
	if args.episodes < 1:
		parser.error("--episodes는 1 이상이어야 합니다.")
	train(args.episodes, args.seed, args.output, args.device, args.server_url, args.api_token)



# TODO: 브라우저의 실제 게임 루프가 이 클라이언트와 같은 API 계약으로 이벤트를 전송하도록 연결한다.
# TODO: 실행 환경에 PyTorch를 설치하고 VS Code의 Python 인터프리터를 같은 환경으로 선택한다.
# TODO: 저장한 PyTorch 체크포인트를 LM Studio가 지원하는 배포 형식으로 변환하는 export 경로를 추가한다.
# TODO: hardGarbage, garbage, fever, all-clear ticket, margin rate, time multiplier를 환경에 반영한다.
# TODO: PuyoW.common.simulatePlacementBoard()와 결과를 대조하는 회귀 테스트를 추가한다.
# TODO: self-play 상대 정책, 평가 전용 에피소드, 모델 버전 호환 검증을 추가한다.


if __name__ == "__main__":
	main()




