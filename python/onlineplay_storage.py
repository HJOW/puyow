# 온라인 플레이 파일 저장소. 서비스 규칙과 분리된 동기식 저장 계약이다.
# Copyright 2026 HJOW, Apache License 2.0

import json
from pathlib import Path
from typing import Any


class FileOnlinePlayStorage:
	"""생성만으로 파일에 접근하지 않는다. 초기화는 온라인 기능을 켠 서비스가 요청한다."""

	def __init__(self, root: Path | None = None) -> None:
		"""기존 홈 경로를 기본값으로 사용하며 테스트에서는 독립 경로를 주입한다."""
		storage_root = Path(root) if root is not None else Path.home() / ".puyowserver"
		self.account_root = storage_root / "account"
		self.room_root = storage_root / "rooms"

	def initialize(self) -> None:
		"""저장 디렉터리를 만든다. 실패는 호출자에게 전달한다."""
		self.account_root.mkdir(parents=True, exist_ok=True)
		self.room_root.mkdir(parents=True, exist_ok=True)

	# 계정 디렉터리를 한 번 읽어 닉네임 색인을 만든다.
	def load_nickname_index(self) -> dict[str, str]:
		"""닉네임 중복 검사를 위해 서버 시작 시 한 번 계정 목록을 읽어 둔다."""
		nickname_index: dict[str, str] = {}
		try:
			entries = list(self.account_root.iterdir())
		except OSError:
			return nickname_index
		for entry in entries:
			if not entry.is_dir():
				continue
			account = self._read_json_file(entry / "account.json")
			if account and isinstance(account.get("nickname"), str):
				nickname_index[account["nickname"]] = entry.name

		return nickname_index

	# 이전 실행에서 남은 방 파일을 모두 지운다.
	def clear_rooms(self) -> None:
		"""접속자가 없는 방은 존재할 수 없으므로 서버 시작 시 방 디렉터리를 비운다."""
		try:
			entries = list(self.room_root.glob("*.json"))
		except OSError:
			return
		for entry in entries:
			try:
				entry.unlink()
			except OSError:
				pass

	def load_account(self, account_id: str) -> dict[str, Any] | None:
		"""검증된 ID로 조회한다. 없거나 읽기에 실패하면 None이다."""
		return self._read_json_file(self.account_root / account_id.lower() / "account.json")

	def save_account(self, account: dict[str, Any]) -> None:
		"""계정 전체를 저장한다. 실패는 서비스에 전달한다."""
		self._write_json_file(self.account_root / str(account["id"]).lower() / "account.json", account)

	def save_room(self, snapshot: dict[str, Any]) -> None:
		"""소켓·세션을 제외한 방 스냅샷을 저장한다."""
		self._write_json_file(self.room_root / f"{snapshot['id'].lower()}.json", snapshot)

	def remove_room(self, room_id: str) -> None:
		"""기존 계약대로 삭제 실패는 무시한다."""
		try:
			(self.room_root / f"{room_id.lower()}.json").unlink()
		except OSError:
			pass

	def _read_json_file(self, file_path: Path) -> dict[str, Any] | None:
		"""계정·방 파일을 읽는다. 파일이 없거나 형식이 깨졌으면 None을 돌려준다."""
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
