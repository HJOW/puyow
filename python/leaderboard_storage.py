# 리더보드 파일 저장소. 서비스 규칙과 분리된 동기식 저장 계약이다.
# Copyright 2026 HJOW, Apache License 2.0

import json
import threading
from pathlib import Path
from typing import Any


class FileLeaderboardStorage:
	"""생성만으로 파일에 접근하지 않는다. 초기화는 리더보드 기능을 켠 서비스가 요청한다.

	한 사람의 기록을 [홈디렉토리]/.puyowserver/leaderboard/[닉네임].json 한 파일에 모아 둔다.
	파이썬 서버는 ThreadingHTTPServer 라 요청마다 스레드가 다르므로, 읽고 고쳐 쓰는 묶음이
	서로 끼어들지 않도록 threading.Lock 을 둔다. (node.js 쪽은 단일 스레드 + 동기 입출력이라
	node/leaderboard_storage.js 에는 잠금이 없다.)

	닉네임 검증과 기록 형식 검사, 순위 병합은 서비스(leaderboard.py)가 담당한다.
	"""

	def __init__(self, root: Path | None = None) -> None:
		"""기존 홈 경로를 기본값으로 사용하며 테스트에서는 독립 경로를 주입한다."""
		storage_root = Path(root) if root is not None else Path.home() / ".puyowserver"
		self.leaderboard_root = storage_root / "leaderboard"
		self._lock = threading.Lock()

	def initialize(self) -> None:
		"""저장 디렉터리를 만든다. 실패는 호출자에게 전달한다."""
		self.leaderboard_root.mkdir(parents=True, exist_ok=True)

	def lock(self) -> threading.Lock:
		"""읽고 고쳐 쓰는 묶음을 감쌀 잠금이다. 서비스가 with 문으로 사용한다."""
		return self._lock

	def load_player(self, nickname: str) -> dict[str, Any] | None:
		"""한 사람의 기록 파일을 읽는다. 없거나 읽지 못하면 None이다."""
		return self._read_json_file(self.get_player_file_path(nickname))

	def save_player(self, player: dict[str, Any]) -> None:
		"""한 사람의 기록 파일을 통째로 저장한다. 실패는 호출자에게 전달한다."""
		self._write_json_file(self.get_player_file_path(str(player["nickname"])), player)

	def list_players(self) -> list[dict[str, Any]]:
		"""저장된 사람들의 기록 파일을 모두 읽는다. 손상되거나 읽을 수 없는 파일은 건너뛴다."""
		try:
			entries = sorted(self.leaderboard_root.glob("*.json"))
		except OSError:
			return []
		players: list[dict[str, Any]] = []
		for entry in entries:
			player = self._read_json_file(entry)
			if player and isinstance(player.get("nickname"), str):
				players.append(player)

		return players

	def get_player_file_path(self, nickname: str) -> Path:
		"""닉네임에 해당하는 파일 경로다. 닉네임 검증은 서비스가 이미 끝냈다고 본다."""
		return self.leaderboard_root / f"{nickname}.json"

	def _read_json_file(self, file_path: Path) -> dict[str, Any] | None:
		"""기록 파일을 읽는다. 파일이 없거나 형식이 깨졌으면 None을 돌려준다."""
		try:
			with file_path.open("r", encoding="utf-8") as stream:
				value = json.load(stream)
			return value if isinstance(value, dict) else None
		except (OSError, json.JSONDecodeError):
			return None

	def _write_json_file(self, file_path: Path, value: dict[str, Any]) -> None:
		"""부모 디렉터리를 만든 뒤 UTF-8 JSON으로 저장한다."""
		file_path.parent.mkdir(parents=True, exist_ok=True)
		with file_path.open("w", encoding="utf-8") as stream:
			json.dump(value, stream, ensure_ascii=False, indent=2)
