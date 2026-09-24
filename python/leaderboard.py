# 리더보드 서버 기능이다. 게임이 로컬 스토리지에 남기는 기록을 서버에도 함께 모아,
# 리더보드 화면(src/leaderboard.html)에서 "온라인" 기록으로 볼 수 있게 한다.
# 여기서 말하는 "온라인"은 온라인 대전이 아니라, 사람들이 각자 로컬에서 플레이한 기록을
# 이 서버가 한곳에 모아 둔 것을 뜻한다. 계정·로그인은 없고 게임 설정의 닉네임만 쓴다.
#
# 파일 입출력은 leaderboard_storage.py의 FileLeaderboardStorage가 맡고,
# 이 파일은 닉네임·기록 검증과 순위 병합, HTTP 요청 처리만 담당한다.
# node.js 서버(node/leaderboard.js)도 같은 규칙과 같은 응답 형식을 쓴다.
#
# Copyright 2026 HJOW, Apache License 2.0

import json
import re
import time
import traceback
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Any

from leaderboard_storage import FileLeaderboardStorage

# 기록 대상 룰이다. 값이 True인 룰은 AI 난이도·적까지 나눠 순위를 둔다. src/js/puyow.js의 LEADERBOARD_RULES와 같아야 한다.
RULES: dict[str, bool] = {
	"standard": True,
	"fever": True,
	"fever_start": True,
	"relaxed_fever": True,
	"practice": False,
	"continuous_fever": False,
}
# 대전 룰 기록을 나누는 AI 난이도 키다. src/js/puyow.js의 AI_DIFFICULTIES와 같아야 한다.
DIFFICULTY_KEYS = ("easy", "normal", "hard", "extreme")
# 기록할 수 있는 색 수다.
COLOR_COUNTS = (3, 4, 5)
# 한 순위(룰·AI 난이도·색 수·적)마다 남길 최대 기록 수다. 게임의 LEADERBOARD_MAX_ENTRIES와 같은 값이다.
MAX_ENTRIES = 10
# 닉네임으로 받아들일 최대 글자 수다. 게임의 PLAYER_NAME_MAX_LENGTH(10)보다 넉넉하게 둔다.
NICKNAME_MAX_LENGTH = 20
# 적 classType으로 받아들일 최대 글자 수와 허용 문자다. 외부 확장 적도 들어올 수 있어 여유를 둔다.
OPPONENT_PATTERN = re.compile(r"^[A-Za-z0-9_]{1,64}$")
# 한 사람의 파일에 남길 최대 기록 수다. 순위마다 10개씩 남겨도 파일이 끝없이 커지지 않도록 막는다.
MAX_RECORDS_PER_PLAYER = 2000
# 요청 본문으로 받아들일 최대 크기다.
MAX_BODY_BYTES = 64 * 1024

# 파일 이름으로 쓸 수 없는 문자다. 게임 설정 화면의 PLAYER_NAME_FORBIDDEN_PATTERN과 같은 범위를 막고,
# 경로를 벗어나게 할 수 있는 문자까지 함께 거른다. 제어 문자도 파일 이름으로 쓸 수 없다.
NICKNAME_FORBIDDEN_PATTERN = re.compile(r"[\\/:*?\"<>|'!.\x00-\x1F\x7F]")


def normalize_nickname(value: Any) -> str | None:
	"""닉네임을 파일 이름으로 쓸 수 있는지 확인한다.

	금지 문자가 하나라도 있으면 저장하지 않는다. (게임 설정 화면에서도 같은 문자를 막는다.)
	"""
	if not isinstance(value, str):
		return None
	nickname = value.strip()
	if not nickname or len(nickname) > NICKNAME_MAX_LENGTH:
		return None
	if NICKNAME_FORBIDDEN_PATTERN.search(nickname):
		return None
	# 윈도우는 이름 끝의 공백·마침표를 지워 버리므로 다른 파일과 겹칠 수 있다. 점은 위에서 이미 막았다.
	if nickname != nickname.rstrip():
		return None
	return nickname


def normalize_record(payload: Any) -> dict[str, Any] | None:
	"""요청으로 들어온 기록 한 줄을 검사해 저장할 형태로 만든다. 잘못된 값이면 None이다."""
	if not isinstance(payload, dict):
		return None
	rule = payload.get("rule")
	if not isinstance(rule, str) or rule not in RULES:
		return None
	battle = RULES[rule]
	colors = payload.get("colors")
	if not isinstance(colors, (int, float)) or isinstance(colors, bool) or int(colors) not in COLOR_COUNTS:
		return None
	score = payload.get("score")
	if not isinstance(score, (int, float)) or isinstance(score, bool) or score < 0 or score != score:
		return None
	difficulty = payload.get("difficulty") if isinstance(payload.get("difficulty"), str) else None
	opponent = payload.get("opponent") if isinstance(payload.get("opponent"), str) else None
	if battle:
		# 적이 있는 대전은 AI 난이도와 적이 모두 있어야 순위를 나눌 수 있다.
		if difficulty not in DIFFICULTY_KEYS:
			return None
		if not opponent or not OPPONENT_PATTERN.match(opponent):
			return None
		return {"rule": rule, "difficulty": difficulty, "colors": int(colors), "opponent": opponent, "score": int(score)}
	# 단독 룰에는 AI 난이도·적 단계가 없다. 값이 들어와도 버린다.
	return {"rule": rule, "difficulty": None, "colors": int(colors), "opponent": None, "score": int(score)}


def _bucket_key(record: dict[str, Any]) -> tuple:
	"""순위를 나누는 열쇠다. 같은 열쇠끼리 점수 순으로 겨룬다."""
	return (record["rule"], record["difficulty"] or "", record["colors"], record["opponent"] or "")


def normalize_stored_records(value: Any) -> list[dict[str, Any]]:
	"""저장된 기록 배열을 검사해 정리한다. 알 수 없는 값은 버린다."""
	if not isinstance(value, list):
		return []
	records: list[dict[str, Any]] = []
	for item in value:
		record = normalize_record(item)
		if record is None:
			continue
		recorded_at = item.get("recordedAt") if isinstance(item, dict) else None
		if not isinstance(recorded_at, (int, float)) or isinstance(recorded_at, bool) or recorded_at < 0:
			continue
		record["recordedAt"] = int(recorded_at)
		records.append(record)

	return records


def trim_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
	"""순위마다 점수 내림차순 상위 MAX_ENTRIES개만 남긴다."""
	buckets: dict[tuple, list[dict[str, Any]]] = {}
	for record in records:
		buckets.setdefault(_bucket_key(record), []).append(record)
	trimmed: list[dict[str, Any]] = []
	for bucket in buckets.values():
		# 점수 내림차순이 먼저고, 동점은 먼저 기록한 쪽이 앞이다.
		bucket.sort(key=lambda item: (-item["score"], item["recordedAt"]))
		trimmed.extend(bucket[:MAX_ENTRIES])

	return trimmed[:MAX_RECORDS_PER_PLAYER]


class LeaderboardService:
	"""리더보드 서버 기록 서비스. 기능을 끈 경우에는 저장 디렉터리도 만들지 않고 모든 요청을 거절한다."""

	def __init__(self, enabled: bool, storage: Any = None) -> None:
		"""저장소는 교체 가능하며 비활성 상태에서는 초기화하지 않는다."""
		self.enabled = enabled is True
		self.storage = storage if storage is not None else FileLeaderboardStorage()
		if self.enabled:
			self.storage.initialize()

	def add_record(self, payload: Any) -> tuple[int, dict[str, Any]]:
		"""기록 하나를 그 사람의 파일에 더한다. 기록 일시는 요청값을 믿지 않고 서버 시각으로 정한다."""
		nickname = normalize_nickname(payload.get("nickname") if isinstance(payload, dict) else None)
		# 파일 이름으로 쓸 수 없는 닉네임은 저장하지 않는다.
		if nickname is None:
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_nickname"}
		record = normalize_record(payload)
		if record is None:
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_record"}
		recorded_at = int(time.time() * 1000)
		# 읽고 고쳐 쓰는 묶음이 다른 스레드와 겹치지 않게 잠근다.
		with self.storage.lock():
			stored = self.storage.load_player(nickname)
			records = normalize_stored_records(stored.get("records") if stored else None)
			record["recordedAt"] = recorded_at
			records.append(record)
			self.storage.save_player({"version": 1, "nickname": nickname, "records": trim_records(records)})
		stamp = datetime.fromtimestamp(recorded_at / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
		return HTTPStatus.OK, {"ok": True, "recorded": True, "recordedAt": stamp}

	def get_records(self) -> tuple[int, dict[str, Any]]:
		"""저장된 모든 사람의 기록을 리더보드 화면이 그대로 쓸 수 있는 형태로 모은다.

		응답의 records 구조는 게임이 localStorage에 두는 puyow_leaderboard의 records와 같다.
		"""
		records: dict[str, Any] = {}
		with self.storage.lock():
			players = self.storage.list_players()
		for player in players:
			nickname = normalize_nickname(player.get("nickname"))
			if nickname is None:
				continue
			for record in normalize_stored_records(player.get("records")):
				by_rule = records.setdefault(record["rule"], {})
				color_key = str(record["colors"])
				if record["difficulty"]:
					bucket = by_rule.setdefault(record["difficulty"], {}).setdefault(color_key, {}).setdefault(record["opponent"], [])
				else:
					bucket = by_rule.setdefault(color_key, [])
				bucket.append({"name": nickname, "score": record["score"], "recordedAt": record["recordedAt"]})
		# 순위마다 점수 내림차순 상위 MAX_ENTRIES개만 남긴다.
		for by_rule in records.values():
			for second_key, second in list(by_rule.items()):
				if isinstance(second, list):
					by_rule[second_key] = _trim_entries(second)
					continue
				for color_key, by_enemy in second.items():
					for enemy_key, entries in by_enemy.items():
						by_enemy[enemy_key] = _trim_entries(entries)
		return HTTPStatus.OK, {"ok": True, "version": 2, "maxEntries": MAX_ENTRIES, "records": records}

	def handle_api(self, handler: Any) -> tuple[int, dict[str, Any]]:
		"""/apis/leaderboard/... HTTP 요청을 처리한다. record는 POST, records는 GET이다."""
		# 기능을 끈 서버에서는 리더보드 요청을 아예 받지 않는다.
		if not self.enabled:
			return HTTPStatus.NOT_FOUND, {"ok": False, "code": "leaderboard_disabled"}
		path_parts = handler.path.split("?")[0].split("/")
		action = path_parts[3] if len(path_parts) > 3 else ""
		try:
			if action == "records":
				if getattr(handler, "command", "") not in ("GET", "HEAD"):
					return HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "code": "method_not_allowed"}
				return self.get_records()
			if action == "record":
				if getattr(handler, "command", "") != "POST":
					return HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "code": "method_not_allowed"}
				payload = self._read_body(handler)
				if payload is None:
					return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_body"}
				return self.add_record(payload)
			return HTTPStatus.NOT_FOUND, {"ok": False, "code": "not_found"}
		except Exception:
			print("리더보드 API 처리 중 오류가 발생했습니다.")
			print(traceback.format_exc())
			return HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "code": "server_error"}

	def get_stats(self) -> dict[str, Any]:
		"""관리 화면 대시보드에 보여 줄 요약이다."""
		if not self.enabled:
			return {"enabled": False, "players": 0, "records": 0}
		with self.storage.lock():
			players = self.storage.list_players()
		return {
			"enabled": True,
			"players": len(players),
			"records": sum(len(normalize_stored_records(player.get("records"))) for player in players),
		}

	def _read_body(self, handler: Any) -> dict[str, Any] | None:
		"""요청 본문을 제한된 크기까지 읽고 JSON 객체로 파싱한다. 실패하면 None이다."""
		try:
			length = int(handler.headers.get("Content-Length") or 0)
		except ValueError:
			return None
		if length > MAX_BODY_BYTES:
			return None
		try:
			body = handler.rfile.read(length) if length > 0 else b""
			payload = json.loads(body.decode("utf-8")) if body else {}
		except (OSError, UnicodeDecodeError, json.JSONDecodeError):
			return None
		return payload if isinstance(payload, dict) else None


def _trim_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
	"""한 순위의 기록을 점수 내림차순 상위 MAX_ENTRIES개로 자른다."""
	entries.sort(key=lambda item: (-item["score"], item["recordedAt"]))
	return entries[:MAX_ENTRIES]
