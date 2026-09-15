# Puyo W 온라인 플레이 백엔드 (python)
#
# 이 파일은 온라인 플레이(계정·로그인·대기실·방·대전 중계)만 담당한다.
# python/pythonserver.py 는 OnlinePlayService 객체를 만들어
#     - HTTP  : /apis/onlineplay/...   → handle_api()
#     - 소켓  : /apis/onlineplay/socket → handle_upgrade()
# 두 진입점만 연결한다. 계정·방 파일 입출력은 onlineplay_storage.py에 분리되어 있다.
#
# 프로토콜과 규칙은 저장소 루트의 MAY_BE_LATER.md "세부 결정 사항" 절을 따른다.
# nodeserver/onlineplay.js 도 같은 계약을 구현하므로, 메시지 이름이나 오류 코드를 바꾸면 두 파일을 함께 고쳐야 한다.
#
# Copyright 2026 HJOW
#
# Apache License 2.0
# 이 프로그램은 Apache License 2.0에 따라 사용할 수 있습니다.
# 라이선스 전문은 프로젝트 루트의 LICENSE 파일을 확인하세요.
#
# 의존성
#     bcrypt  (온라인 플레이를 켠 경우에만 필요. 설치: pip install bcrypt)

import base64
import hashlib
import json
import math
import re
import secrets
import socket
import struct
import threading
import time
import traceback
from http import HTTPStatus
from onlineplay_storage import FileOnlinePlayStorage
from typing import Any

# 계정 ID 규칙: 알파벳·숫자·언더바 4~20자.
ID_PATTERN = re.compile(r"^[A-Za-z0-9_]{4,20}$")
# 닉네임 규칙: 알파벳·숫자·언더바 3~20자. 대소문자를 구분한다.
NICKNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,20}$")
# 프런트가 sha256으로 한 번 해시해 보내는 값의 형식이다. (64자리 16진수)
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")

# 비밀번호 실패 기록을 유지하는 시간(초)과 잠금 기준 횟수다.
LOGIN_FAIL_WINDOW_SEC = 5 * 60
LOGIN_FAIL_LIMIT = 3

# WebSocket 연결 후 인증 메시지를 기다리는 시간(초).
AUTH_TIMEOUT_SEC = 5.0
# 서버가 ping을 보내는 간격과, 이 시간 동안 아무 메시지도 없으면 끊긴 것으로 보는 기준(초).
PING_INTERVAL_SEC = 5.0
CONNECTION_TIMEOUT_SEC = 15.0
# 소켓이 끊긴 뒤 같은 토큰으로 다시 연결할 수 있는 유예 시간과, 무조작 세션 만료 시간(초).
SESSION_GRACE_SEC = 60.0
SESSION_IDLE_SEC = 30 * 60.0

# 대기실 목록에 한 번에 보내는 방의 최대 개수와, 서버가 동시에 유지하는 방의 최대 개수다.
ROOM_LIST_LIMIT = 50
ROOM_LIMIT = 200

# 게임 시작 버튼을 누른 뒤 실제 시작까지의 음영처리 시간(초)이다.
GAME_PREPARE_SEC = 3.0
# 한 대전에서 미리 만들어 두는 뿌요 쌍의 개수다. 모자라면 이어서 더 보낸다.
DECK_SIZE = 512
# 양쪽 패배 보고가 이 시간 안에 겹치면 무승부로 처리한다(밀리초).
DRAW_WINDOW_MS = 50

# puyow.js의 COLORS와 같은 순서다. 색상 수 3·4·5는 앞에서부터 자른다.
PUYO_COLORS = ("red", "green", "yellow", "blue", "purple")
# 방에서 고를 수 있는 대전 규칙이다. puyow.js의 TOGETHER_RULE_OPTIONS와 같은 키를 쓴다.
ROOM_RULES = ("standard", "fever", "feverStart")

# RFC 6455가 정한 핸드셰이크용 고정 GUID다.
WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
# 한 WebSocket 메시지의 최대 크기(바이트)다. 게임 조작 메시지는 아주 작으므로 넉넉한 값이다.
MAX_FRAME_BYTES = 256 * 1024
# HTTP 요청 본문의 최대 크기(바이트)다.
MAX_BODY_BYTES = 64 * 1024


# bcrypt는 온라인 플레이를 켠 경우에만 필요하므로 처음 쓸 때 불러온다.
def _get_bcrypt() -> Any:
	"""bcrypt 모듈을 지연 로드한다. 온라인 플레이를 끈 서버는 설치하지 않아도 구동된다."""
	import bcrypt

	return bcrypt


# 0 이상 정수로 보정한다. 잘못된 값은 0이 된다.
def _to_win_point(value: Any) -> int:
	"""WIN POINT는 0 이상 정수만 허용하므로 저장·전송 전에 항상 이 함수로 보정한다."""
	try:
		return max(0, int(value))
	except (TypeError, ValueError):
		return 0


class WebSocketConnection:
	"""한 WebSocket 연결의 소켓·수신 버퍼·상태를 담는다. 실제 프레임 처리는 이 클래스가 맡는다."""

	def __init__(self, sock: socket.socket) -> None:
		self.socket = sock
		self.buffer = bytearray()
		self.fragments: list[bytes] = []
		self.fragment_opcode = 0
		self.session: dict[str, Any] | None = None
		self.closed = False
		self.last_message_at = time.monotonic()
		self.last_ping_at = time.monotonic()
		# 여러 스레드(자기 수신 스레드와 상대의 중계)가 같은 소켓에 쓰므로 쓰기를 직렬화한다.
		self.write_lock = threading.Lock()

	# 서버에서 클라이언트로 보내는 프레임을 만든다. (서버 프레임은 마스킹하지 않는다.)
	def _encode_frame(self, opcode: int, payload: bytes) -> bytes:
		"""RFC 6455 프레임 하나를 만든다."""
		length = len(payload)
		if length < 126:
			header = struct.pack("!BB", 0x80 | opcode, length)
		elif length < 65536:
			header = struct.pack("!BBH", 0x80 | opcode, 126, length)
		else:
			header = struct.pack("!BBQ", 0x80 | opcode, 127, length)
		return header + payload

	# JSON 메시지 하나를 보낸다.
	def send_message(self, message: dict[str, Any]) -> None:
		"""메시지를 UTF-8 JSON 텍스트 프레임으로 보낸다. 실패하면 연결을 닫힌 것으로 표시한다."""
		self.send_frame(0x1, json.dumps(message, ensure_ascii=False).encode("utf-8"))

	# 임의의 프레임 하나를 보낸다.
	def send_frame(self, opcode: int, payload: bytes) -> None:
		"""ping·pong·close를 포함한 프레임 전송의 공통 경로다."""
		if self.closed:
			return
		try:
			with self.write_lock:
				self.socket.sendall(self._encode_frame(opcode, payload))
		except OSError:
			self.closed = True

	# 소켓을 닫는다.
	def close(self) -> None:
		"""close 프레임을 보내고 소켓을 닫는다. 이미 닫혔으면 아무것도 하지 않는다."""
		if self.closed:
			return
		self.closed = True
		try:
			with self.write_lock:
				self.socket.sendall(self._encode_frame(0x8, b""))
		except OSError:
			pass
		try:
			self.socket.close()
		except OSError:
			pass

	# 받은 바이트에서 완성된 프레임 하나를 꺼낸다. 아직 부족하면 None이다.
	def decode_frame(self) -> tuple[int, bool, bytes] | None:
		"""수신 버퍼에서 프레임 하나를 꺼내 (opcode, fin, payload)로 돌려준다."""
		buffer = self.buffer
		if len(buffer) < 2:
			return None
		fin = (buffer[0] & 0x80) != 0
		opcode = buffer[0] & 0x0F
		masked = (buffer[1] & 0x80) != 0
		length = buffer[1] & 0x7F
		offset = 2
		if length == 126:
			if len(buffer) < offset + 2:
				return None
			length = struct.unpack_from("!H", buffer, offset)[0]
			offset += 2
		elif length == 127:
			if len(buffer) < offset + 8:
				return None
			length = struct.unpack_from("!Q", buffer, offset)[0]
			offset += 8
		mask_length = 4 if masked else 0
		if len(buffer) < offset + mask_length + length:
			return None
		mask = bytes(buffer[offset:offset + 4]) if masked else None
		offset += mask_length
		payload = bytearray(buffer[offset:offset + length])
		# 브라우저가 보내는 프레임은 반드시 마스킹되어 있으므로 여기서 되돌린다.
		if mask is not None:
			for index in range(len(payload)):
				payload[index] ^= mask[index % 4]
		del self.buffer[:offset + length]
		return opcode, fin, bytes(payload)


class OnlinePlayService:
	"""계정·세션·방·대전 중계를 모두 담당하는 온라인 플레이 서비스다."""

	def __init__(self, enabled: bool, storage: Any = None) -> None:
		self.enabled = bool(enabled)
		# 다른 저장소도 같은 동기식 메서드를 구현하면 서비스 변경 없이 주입할 수 있다.
		self.storage = storage if storage is not None else FileOnlinePlayStorage()
		# 모든 공유 상태는 이 잠금 아래에서만 바꾼다. HTTP 스레드와 소켓 스레드가 함께 접근한다.
		self.lock = threading.RLock()
		# 토큰 → 세션. 세션은 메모리에만 둔다.
		self.sessions: dict[str, dict[str, Any]] = {}
		# 계정 ID(소문자) → 현재 세션 토큰. 중복 로그인을 찾는 데 쓴다.
		self.session_by_account: dict[str, str] = {}
		# 방 ID → 방 상태. 파일보다 이 메모리 값이 정본이다.
		self.rooms: dict[str, dict[str, Any]] = {}
		# 닉네임 → 계정 ID(소문자). 닉네임은 대소문자를 가리므로 디렉터리 이름으로 쓸 수 없다.
		self.nickname_index: dict[str, str] = {}
		# 계정 ID(소문자) → 최근 비밀번호 실패 시각 목록. 서버를 다시 켜면 사라진다.
		self.login_failures: dict[str, list[float]] = {}

		if self.enabled:
			self.storage.initialize()
			self.nickname_index = self.storage.load_nickname_index()
			self.storage.clear_rooms()
			# 게임 시작 준비와 세션 만료를 살피는 관리 스레드다.
			thread = threading.Thread(target=self._maintenance_loop, name="onlineplay-maintenance", daemon=True)
			thread.start()

	# 이 서버가 온라인 플레이를 제공하는지 알린다.
	def is_enabled(self) -> bool:
		"""SERVER_CONFIG['online_play_enabled'] 값을 그대로 반영한다."""
		return self.enabled

	############################### 계정 ###############################

	# 계정을 읽는다. 없으면 None이다.
	def _load_account(self, account_id: str) -> dict[str, Any] | None:
		"""형식이 맞는 ID에 대해서만 계정 파일을 읽는다."""
		if not ID_PATTERN.match(account_id or ""):
			return None
		return self.storage.load_account(account_id)

	# 계정을 저장한다.
	def _save_account(self, account: dict[str, Any]) -> None:
		"""가입과 WIN POINT 갱신이 함께 쓰는 저장 경로다."""
		self.storage.save_account(account)

	# 최근 5분 안의 비밀번호 실패 횟수를 센다.
	def _count_recent_failures(self, account_key: str) -> int:
		"""오래된 기록은 세는 김에 함께 지운다."""
		now = time.time()
		records = [at for at in self.login_failures.get(account_key, []) if now - at < LOGIN_FAIL_WINDOW_SEC]
		if records:
			self.login_failures[account_key] = records
		else:
			self.login_failures.pop(account_key, None)
		return len(records)

	# 비밀번호 실패를 기록한다.
	def _record_failure(self, account_key: str) -> None:
		"""5분 내 3회 이상이면 그 5분 동안 올바른 비밀번호로도 로그인할 수 없다."""
		now = time.time()
		records = [at for at in self.login_failures.get(account_key, []) if now - at < LOGIN_FAIL_WINDOW_SEC]
		records.append(now)
		self.login_failures[account_key] = records

	# 회원가입 요청을 처리한다.
	def _signup(self, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
		"""서버에서도 유효성 검사를 다시 하고, 통과하면 bcrypt로 한 번 더 해시해 저장한다."""
		account_id = payload.get("id") if isinstance(payload.get("id"), str) else ""
		nickname = payload.get("nickname") if isinstance(payload.get("nickname"), str) else ""
		password = payload.get("password") if isinstance(payload.get("password"), str) else ""

		if not ID_PATTERN.match(account_id):
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_id"}
		if not NICKNAME_PATTERN.match(nickname):
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_nickname"}
		if not SHA256_PATTERN.match(password):
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_password"}
		with self.lock:
			# ID 중복 검사는 대소문자를 가리지 않고, 닉네임 중복 검사는 대소문자를 가린다.
			if self._load_account(account_id) is not None:
				return HTTPStatus.CONFLICT, {"ok": False, "code": "duplicate_id"}
			if nickname in self.nickname_index:
				return HTTPStatus.CONFLICT, {"ok": False, "code": "duplicate_nickname"}
			bcrypt = _get_bcrypt()
			account = {
				"id": account_id,
				"nickname": nickname,
				# 프런트가 sha256으로 한 번 해시한 값을 서버에서 bcrypt로 한 번 더 해시해 저장한다.
				"password": bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
				"winPoint": 0,
				"createdAt": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z",
			}
			self._save_account(account)
			self.nickname_index[nickname] = account_id.lower()
		return HTTPStatus.OK, {"ok": True}

	# 로그인 요청을 처리한다. 성공하면 세션 토큰을 발급한다.
	def _login(self, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
		"""잠금 상태·계정 확인·중복 로그인 무효화를 거쳐 새 세션을 만든다."""
		account_id = payload.get("id") if isinstance(payload.get("id"), str) else ""
		password = payload.get("password") if isinstance(payload.get("password"), str) else ""
		if not ID_PATTERN.match(account_id) or not SHA256_PATTERN.match(password):
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_request"}

		account_key = account_id.lower()
		with self.lock:
			if self._count_recent_failures(account_key) >= LOGIN_FAIL_LIMIT:
				return HTTPStatus.LOCKED, {"ok": False, "code": "account_locked"}
			account = self._load_account(account_id)

		bcrypt = _get_bcrypt()
		# 없는 계정과 틀린 비밀번호를 구분해 알려 주지 않는다.
		matched = False
		if account is not None:
			try:
				matched = bcrypt.checkpw(password.encode("utf-8"), str(account.get("password", "")).encode("utf-8"))
			except ValueError:
				matched = False

		with self.lock:
			if not matched:
				if account is not None:
					self._record_failure(account_key)
				return HTTPStatus.UNAUTHORIZED, {"ok": False, "code": "login_failed"}
			self.login_failures.pop(account_key, None)
			# 이미 로그인된 세션이 있으면 무효화한다.
			previous_token = self.session_by_account.get(account_key)
			if previous_token:
				self._close_session(previous_token, "session_closed")
			token = secrets.token_hex(16)
			now = time.monotonic()
			self.sessions[token] = {
				"token": token,
				"accountId": account["id"],
				"accountKey": account_key,
				"nickname": account["nickname"],
				"connection": None,
				"roomId": None,
				"lastActiveAt": now,
				"disconnectedAt": now,
			}
			self.session_by_account[account_key] = token
			return HTTPStatus.OK, {"ok": True, "token": token, "nickname": account["nickname"], "winPoint": _to_win_point(account.get("winPoint"))}

	# 로그아웃 요청을 처리한다.
	def _logout(self, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
		"""토큰이 살아 있으면 세션을 끝낸다. 없는 토큰이어도 성공으로 답한다."""
		token = payload.get("token") if isinstance(payload.get("token"), str) else ""
		with self.lock:
			if token in self.sessions:
				self._close_session(token, None)
		return HTTPStatus.OK, {"ok": True}

	############################### 세션 ###############################

	# 세션을 끝낸다. 방에서 내보내고 소켓도 닫는다.
	def _close_session(self, token: str, reason: str | None) -> None:
		"""중복 로그인·만료·로그아웃이 모두 이 경로로 세션을 정리한다."""
		session = self.sessions.get(token)
		if session is None:
			return
		self._leave_room(session, True)
		connection = session.get("connection")
		if connection is not None:
			if reason:
				connection.send_message({"type": reason})
			connection.close()
			session["connection"] = None
		self.sessions.pop(token, None)
		if self.session_by_account.get(session["accountKey"]) == token:
			self.session_by_account.pop(session["accountKey"], None)

	# 1초마다 게임 시작 준비와 세션 만료를 살핀다.
	def _maintenance_loop(self) -> None:
		"""소켓 수신 스레드와 별개로 시간이 흘러야 하는 일을 처리한다."""
		while True:
			time.sleep(0.5)
			try:
				with self.lock:
					now = time.monotonic()
					for token, session in list(self.sessions.items()):
						if session.get("connection") is None and now - session["disconnectedAt"] > SESSION_GRACE_SEC:
							self._close_session(token, None)
							continue
						if now - session["lastActiveAt"] > SESSION_IDLE_SEC:
							self._close_session(token, "session_closed")
					for room in list(self.rooms.values()):
						prepare_at = room.get("prepareAt") or 0
						if prepare_at and now >= prepare_at:
							self._start_game(room)
			except Exception:
				print("온라인 플레이 관리 스레드 오류")
				print(traceback.format_exc())

	############################### 방 ###############################

	# 방 상태를 파일로 저장한다. 파일은 스냅샷이며 정본은 메모리다.
	def _save_room_file(self, room: dict[str, Any]) -> None:
		"""저장에 실패해도 메모리 상태로 서비스는 계속한다."""
		try:
			self.storage.save_room(self._room_json(room))
		except OSError:
			print("방 정보를 저장하지 못했습니다.")

	# 방 파일을 지운다.
	def _remove_room_file(self, room_id: str) -> None:
		"""방이 사라지거나 고유 ID가 바뀔 때 이전 파일을 지운다."""
		try:
			self.storage.remove_room(room_id)
		except OSError:
			pass

	# 저장·전송용 방 정보를 만든다.
	def _room_json(self, room: dict[str, Any]) -> dict[str, Any]:
		"""파일 저장과 클라이언트 전송이 같은 구조를 쓴다."""
		return {
			"id": room["id"],
			"rule": room["rule"],
			"colorCount": room["colorCount"],
			"host": self._member_json(room.get("host")),
			"guest": self._member_json(room.get("guest")),
			"state": room["state"],
			"createdAt": room["createdAt"],
		}

	# 방에 표시할 참가자 정보를 만든다.
	def _member_json(self, session: dict[str, Any] | None) -> dict[str, Any] | None:
		"""닉네임과 현재 WIN POINT를 계정 파일에서 읽어 담는다."""
		if session is None:
			return None
		account = self._load_account(session["accountId"])
		return {"id": session["accountId"], "nickname": session["nickname"], "winPoint": _to_win_point((account or {}).get("winPoint"))}

	# 대기실에 보여 줄 방 목록을 만든다.
	def _room_list(self) -> list[dict[str, Any]]:
		"""한 자리가 남은(참여자가 없는) 대기 중인 방만, 만든 시각 오름차순으로 담는다."""
		candidates = [room for room in self.rooms.values() if room["state"] == "waiting" and room.get("guest") is None]
		candidates.sort(key=lambda room: room["createdAt"])
		return [
			{"id": room["id"], "rule": room["rule"], "colorCount": room["colorCount"], "hostNickname": room["host"]["nickname"]}
			for room in candidates[:ROOM_LIST_LIMIT]
		]

	# 대기실에 있는 모든 세션에 방 목록을 밀어 준다.
	def _broadcast_room_list(self) -> None:
		"""클라이언트는 목록을 폴링하지 않고 이 푸시만 받는다."""
		room_list = self._room_list()
		for session in self.sessions.values():
			connection = session.get("connection")
			if connection is not None and session.get("roomId") is None:
				connection.send_message({"type": "room_list", "rooms": room_list})

	# 방 안의 두 사람에게 현재 방 상태를 보낸다.
	def _broadcast_room_state(self, room: dict[str, Any]) -> None:
		"""입장·퇴장·방장 이양을 방 안의 두 사람에게 즉시 알린다."""
		for member in (room.get("host"), room.get("guest")):
			if member is None:
				continue
			connection = member.get("connection")
			if connection is not None:
				connection.send_message({"type": "room_state", "room": self._room_json(room), "youAreHost": member is room.get("host")})

	# 방을 만든다.
	def _create_room(self, session: dict[str, Any], payload: dict[str, Any]) -> None:
		"""방 고유 ID는 방장의 계정 ID를 쓴다."""
		if session.get("roomId") is not None:
			self._send_error(session, "already_in_room")
			return
		if len(self.rooms) >= ROOM_LIMIT:
			self._send_error(session, "room_limit")
			return
		rule = payload.get("rule") if payload.get("rule") in ROOM_RULES else "standard"
		color_count = payload.get("colorCount") if payload.get("colorCount") in (3, 4, 5) else 4
		room = {
			"id": session["accountId"],
			"rule": rule,
			"colorCount": color_count,
			"host": session,
			"guest": None,
			"state": "waiting",
			"createdAt": time.time(),
			"prepareAt": 0.0,
			"game": None,
		}
		self.rooms[room["id"]] = room
		session["roomId"] = room["id"]
		self._save_room_file(room)
		self._broadcast_room_state(room)
		self._broadcast_room_list()

	# 방에 참여한다.
	def _join_room(self, session: dict[str, Any], payload: dict[str, Any]) -> None:
		"""한 계정은 동시에 한 방에만 들어갈 수 있다."""
		if session.get("roomId") is not None:
			self._send_error(session, "already_in_room")
			return
		room_id = payload.get("roomId") if isinstance(payload.get("roomId"), str) else ""
		room = self.rooms.get(room_id)
		if room is None:
			self._send_error(session, "room_not_found")
			return
		if room.get("guest") is not None or room["state"] != "waiting":
			self._send_error(session, "room_full")
			return
		room["guest"] = session
		session["roomId"] = room["id"]
		self._save_room_file(room)
		self._broadcast_room_state(room)
		self._broadcast_room_list()

	# 방에서 나간다. 방장이 나가면 참여자에게 방장 권한과 방 고유 ID가 함께 넘어간다.
	def _leave_room(self, session: dict[str, Any], silent: bool) -> None:
		"""퇴장·연결 끊김·세션 만료가 모두 이 경로로 방을 정리한다."""
		room_id = session.get("roomId")
		session["roomId"] = None
		if room_id is None:
			return
		room = self.rooms.get(room_id)
		if room is None:
			return

		opponent = room.get("guest") if room.get("host") is session else room.get("host")
		# 게임 중이었다면 남은 사람에게 상대가 나갔음을 알린다. (승패 처리 없음, WIN POINT 변동 없음)
		was_playing = room["state"] == "playing" or bool(room.get("prepareAt"))
		room["prepareAt"] = 0.0
		room["game"] = None

		if opponent is None:
			self.rooms.pop(room["id"], None)
			self._remove_room_file(room["id"])
			self._broadcast_room_list()
			connection = session.get("connection")
			if not silent and connection is not None:
				connection.send_message({"type": "room_closed"})
			return

		if room.get("host") is session:
			# 방장이 나가면 참여자가 방장이 되며, 방 고유 ID도 참여자의 계정 ID로 바뀐다.
			self.rooms.pop(room["id"], None)
			self._remove_room_file(room["id"])
			room["host"] = opponent
			room["guest"] = None
			room["id"] = opponent["accountId"]
			opponent["roomId"] = room["id"]
			self.rooms[room["id"]] = room
		else:
			room["guest"] = None
		room["state"] = "waiting"
		self._save_room_file(room)
		opponent_connection = opponent.get("connection")
		if opponent_connection is not None and was_playing:
			opponent_connection.send_message({"type": "opponent_left"})
		self._broadcast_room_state(room)
		self._broadcast_room_list()

	############################### 게임 진행 ###############################

	# 방장이 보낸 시작 요청을 받아 음영처리 단계로 들어간다.
	def _request_game_start(self, session: dict[str, Any]) -> None:
		"""게임 시작 결정은 서버가 한다. 클라이언트는 자기 타이머로 시작하지 않는다."""
		room = self.rooms.get(session.get("roomId") or "")
		if room is None:
			self._send_error(session, "room_not_found")
			return
		if room.get("host") is not session:
			self._send_error(session, "not_host")
			return
		if room.get("guest") is None:
			self._send_error(session, "no_guest")
			return
		if room["state"] != "waiting":
			self._send_error(session, "already_playing")
			return
		room["state"] = "playing"
		room["prepareAt"] = time.monotonic() + GAME_PREPARE_SEC
		self._save_room_file(room)
		# 게임 중인 방은 대기실 목록에서 빠진다.
		self._broadcast_room_list()
		for member in (room["host"], room["guest"]):
			connection = member.get("connection")
			if connection is not None:
				connection.send_message({"type": "game_prepare", "delay": int(GAME_PREPARE_SEC * 1000)})

	# 뿌요 지급 덱을 만든다. 양측이 같은 덱을 같은 순서로 소비한다.
	def _create_deck(self, color_count: int, size: int) -> list[list[str]]:
		"""클라이언트가 자체 난수로 뿌요를 만들지 않도록 서버가 덱을 정한다."""
		colors = list(PUYO_COLORS[:color_count])
		return [[secrets.choice(colors), secrets.choice(colors)] for _ in range(size)]

	# 음영처리 시간이 끝난 방의 게임을 실제로 시작한다.
	def _start_game(self, room: dict[str, Any]) -> None:
		"""준비 시간 동안 이탈이 없었으면 덱과 시작 시각을 실어 양측에 보낸다."""
		room["prepareAt"] = 0.0
		if room.get("guest") is None:
			self._cancel_game(room)
			return
		room["game"] = {"startedAt": time.time(), "deck": self._create_deck(room["colorCount"], DECK_SIZE), "defeats": [], "firstReportAt": 0.0}
		for member in (room["host"], room["guest"]):
			connection = member.get("connection")
			if connection is None:
				continue
			opponent = room["guest"] if member is room["host"] else room["host"]
			connection.send_message({
				"type": "game_start",
				"rule": room["rule"],
				"colorCount": room["colorCount"],
				"deck": room["game"]["deck"],
				"startedAt": room["game"]["startedAt"],
				"youAreHost": member is room["host"],
				"opponent": self._member_json(opponent),
			})

	# 준비 도중 상대가 나가는 등으로 게임을 시작하지 못했을 때 음영처리만 해제한다.
	def _cancel_game(self, room: dict[str, Any]) -> None:
		"""네트워크 지연으로 이탈 정보가 늦게 오는 경우를 위해 음영처리를 되돌린다."""
		room["prepareAt"] = 0.0
		room["state"] = "waiting"
		room["game"] = None
		self._save_room_file(room)
		for member in (room.get("host"), room.get("guest")):
			if member is None:
				continue
			connection = member.get("connection")
			if connection is not None:
				connection.send_message({"type": "game_cancel"})
		self._broadcast_room_state(room)
		self._broadcast_room_list()

	# 조작·연쇄 결과처럼 그대로 상대에게 넘기면 되는 메시지를 중계한다.
	def _relay_to_opponent(self, session: dict[str, Any], message: dict[str, Any]) -> None:
		"""서버는 조작을 해석하지 않고 그대로 전달한다."""
		room = self.rooms.get(session.get("roomId") or "")
		if room is None:
			return
		opponent = room.get("guest") if room.get("host") is session else room.get("host")
		if opponent is None:
			return
		connection = opponent.get("connection")
		if connection is not None:
			connection.send_message(message)

	# 패배 보고를 받는다.
	def _report_defeat(self, session: dict[str, Any], payload: dict[str, Any]) -> None:
		"""먼저 보고한 쪽이 패자이며, 아주 짧은 시간 안에 양쪽이 보고하면 무승부다."""
		room = self.rooms.get(session.get("roomId") or "")
		if room is None or room.get("game") is None or room["state"] != "playing":
			return
		game = room["game"]
		if any(entry["session"] is session for entry in game["defeats"]):
			return
		try:
			reported_time = float(payload.get("time") or 0)
		except (TypeError, ValueError):
			reported_time = 0.0
		game["defeats"].append({"session": session, "time": reported_time})
		if len(game["defeats"]) == 1:
			# 상대의 보고를 아주 짧게 기다린다. 시간이 지나면 관리 스레드가 아니라 이 타이머가 확정한다.
			game["firstReportAt"] = time.monotonic()
			timer = threading.Timer(DRAW_WINDOW_MS / 1000.0, self._finish_game_later, args=(room,))
			timer.daemon = True
			timer.start()
			return
		self._finish_game(room)

	# 타이머에서 부르는 결과 확정 진입점이다.
	def _finish_game_later(self, room: dict[str, Any]) -> None:
		"""타이머 스레드에서 잠금을 잡고 결과를 확정한다."""
		with self.lock:
			if room.get("game") is not None:
				self._finish_game(room)

	# WIN POINT 변경값을 계산한다.
	def _win_point_delta(self, mine: int, theirs: int, won: bool) -> int:
		"""계산식은 MAY_BE_LATER.md를 따른다. 차이값에는 최소값 0을 적용한다."""
		if won:
			return math.floor(3 + max(0, theirs - mine) / 100)
		# 패배 쪽은 음수이므로 내림(floor) 방향에 주의해야 한다. floor(-1.5)는 -1이 아니라 -2다.
		return math.floor((1 + max(0, mine - theirs) / 300) * -1)

	# 게임 결과를 확정하고 WIN POINT를 갱신한다.
	def _finish_game(self, room: dict[str, Any]) -> None:
		"""WIN POINT 계산과 저장은 서버만 하며, 결과를 양측에 보낸다."""
		game = room.get("game")
		if game is None:
			return
		room["game"] = None
		room["state"] = "waiting"

		defeats = game["defeats"]
		first = defeats[0]
		second = defeats[1] if len(defeats) > 1 else None
		# 두 보고의 게임 시각이 거의 같으면 무승부로 보고 WIN POINT를 바꾸지 않는다.
		draw = second is not None and abs(second["time"] - first["time"]) <= DRAW_WINDOW_MS
		loser = None if draw else first["session"]
		winner = None
		if loser is not None:
			winner = room.get("guest") if room.get("host") is loser else room.get("host")

		results: list[tuple[dict[str, Any], dict[str, Any]]] = []
		if winner is None or loser is None:
			for member in (room.get("host"), room.get("guest")):
				if member is None:
					continue
				account = self._load_account(member["accountId"])
				results.append((member, {"result": "draw", "delta": 0, "winPoint": _to_win_point((account or {}).get("winPoint"))}))
		else:
			winner_account = self._load_account(winner["accountId"])
			loser_account = self._load_account(loser["accountId"])
			winner_before = _to_win_point((winner_account or {}).get("winPoint"))
			loser_before = _to_win_point((loser_account or {}).get("winPoint"))
			winner_delta = self._win_point_delta(winner_before, loser_before, True)
			loser_delta = self._win_point_delta(loser_before, winner_before, False)
			# 계산 후 0 미만이면 0으로 되돌린다. (0 이상 정수만 허용)
			winner_after = max(0, winner_before + winner_delta)
			loser_after = max(0, loser_before + loser_delta)
			if winner_account is not None:
				winner_account["winPoint"] = winner_after
				self._save_account(winner_account)
			if loser_account is not None:
				loser_account["winPoint"] = loser_after
				self._save_account(loser_account)
			results.append((winner, {"result": "win", "delta": winner_delta, "winPoint": winner_after}))
			results.append((loser, {"result": "lose", "delta": loser_delta, "winPoint": loser_after}))

		for member, payload in results:
			connection = member.get("connection")
			if connection is not None:
				connection.send_message({"type": "game_result", **payload})
		self._save_room_file(room)
		self._broadcast_room_state(room)
		self._broadcast_room_list()

	############################### WebSocket ###############################

	# 오류 코드를 보낸다.
	def _send_error(self, session: dict[str, Any], code: str) -> None:
		"""클라이언트는 code로 화면 문구를 고른다."""
		connection = session.get("connection")
		if connection is not None:
			connection.send_message({"type": "error", "code": code})

	# WebSocket 업그레이드 요청을 처리한다.
	def handle_upgrade(self, handler: Any) -> None:
		"""HTTP 핸들러가 잡고 있던 소켓을 그대로 넘겨받아 이 스레드에서 연결이 끝날 때까지 처리한다."""
		handler.close_connection = True
		if not self.enabled:
			try:
				handler.send_response(HTTPStatus.NOT_FOUND)
				handler.end_headers()
			except OSError:
				pass
			return
		key = handler.headers.get("Sec-WebSocket-Key")
		upgrade = (handler.headers.get("Upgrade") or "").lower()
		if upgrade != "websocket" or not key:
			try:
				handler.send_response(HTTPStatus.BAD_REQUEST)
				handler.end_headers()
			except OSError:
				pass
			return
		# RFC 6455 핸드셰이크 응답이다.
		accept = base64.b64encode(hashlib.sha1((key + WEBSOCKET_GUID).encode("utf-8")).digest()).decode("ascii")
		response = (
			"HTTP/1.1 101 Switching Protocols\r\n"
			"Upgrade: websocket\r\n"
			"Connection: Upgrade\r\n"
			f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
		)
		try:
			handler.wfile.write(response.encode("ascii"))
			handler.wfile.flush()
		except OSError:
			return

		connection = WebSocketConnection(handler.connection)
		try:
			self._socket_loop(connection)
		finally:
			self._handle_socket_closed(connection)

	# 연결이 끝날 때까지 프레임을 읽어 처리한다.
	def _socket_loop(self, connection: WebSocketConnection) -> None:
		"""1초 간격으로 깨어나 ping 전송과 무응답 판정을 함께 처리한다."""
		sock = connection.socket
		sock.settimeout(1.0)
		while not connection.closed:
			try:
				chunk = sock.recv(4096)
				if not chunk:
					return
				connection.last_message_at = time.monotonic()
				connection.buffer.extend(chunk)
				if len(connection.buffer) > MAX_FRAME_BYTES:
					return
			except socket.timeout:
				chunk = b""
			except OSError:
				return

			now = time.monotonic()
			# 인증하지 않은 채 시간이 지난 연결은 끊는다.
			if connection.session is None and now - connection.last_message_at > AUTH_TIMEOUT_SEC:
				return
			if now - connection.last_message_at > CONNECTION_TIMEOUT_SEC:
				return
			if now - connection.last_ping_at > PING_INTERVAL_SEC:
				connection.last_ping_at = now
				connection.send_frame(0x9, b"")

			while True:
				frame = connection.decode_frame()
				if frame is None:
					break
				opcode, fin, payload = frame
				if opcode == 0x8:
					return
				if opcode == 0x9:
					connection.send_frame(0xA, payload)
					continue
				if opcode == 0xA:
					continue
				# 단편화된 메시지는 모두 모은 뒤 한 번에 처리한다.
				if opcode == 0x0:
					connection.fragments.append(payload)
				else:
					connection.fragments = [payload]
					connection.fragment_opcode = opcode
				if not fin:
					continue
				data = b"".join(connection.fragments)
				connection.fragments = []
				if connection.fragment_opcode != 0x1:
					continue
				try:
					message = json.loads(data.decode("utf-8"))
				except (UnicodeDecodeError, json.JSONDecodeError):
					continue
				if not isinstance(message, dict):
					continue
				self._handle_message(connection, message)

	# 소켓이 끊겼을 때 세션에서 떼어 낸다.
	def _handle_socket_closed(self, connection: WebSocketConnection) -> None:
		"""세션 자체는 유예 시간 동안 남겨 두어 같은 토큰으로 다시 연결할 수 있게 한다."""
		with self.lock:
			session = connection.session
			connection.session = None
			connection.close()
			if session is None or session.get("connection") is not connection:
				return
			session["connection"] = None
			session["disconnectedAt"] = time.monotonic()
			# 게임 중이거나 방에 있었다면 상대에게 알리고 방을 정리한다.
			self._leave_room(session, True)

	# 받은 메시지 하나를 처리한다.
	def _handle_message(self, connection: WebSocketConnection, message: dict[str, Any]) -> None:
		"""인증 전에는 auth만 받고, 인증 후에는 대기실·방·게임 메시지를 처리한다."""
		message_type = message.get("type") if isinstance(message.get("type"), str) else ""
		with self.lock:
			if connection.session is None:
				if message_type != "auth":
					connection.close()
					return
				token = message.get("token") if isinstance(message.get("token"), str) else ""
				session = self.sessions.get(token)
				if session is None:
					connection.send_message({"type": "error", "code": "invalid_token"})
					connection.close()
					return
				# 같은 세션의 이전 소켓이 남아 있으면 새 연결로 교체한다.
				previous = session.get("connection")
				if previous is not None and previous is not connection:
					previous.close()
				connection.session = session
				session["connection"] = connection
				session["lastActiveAt"] = time.monotonic()
				account = self._load_account(session["accountId"])
				connection.send_message({"type": "auth_ok", "nickname": session["nickname"], "winPoint": _to_win_point((account or {}).get("winPoint"))})
				connection.send_message({"type": "room_list", "rooms": self._room_list()})
				return

			session = connection.session
			session["lastActiveAt"] = time.monotonic()

			if message_type == "room_list":
				connection.send_message({"type": "room_list", "rooms": self._room_list()})
			elif message_type == "room_create":
				self._create_room(session, message)
			elif message_type == "room_join":
				self._join_room(session, message)
			elif message_type == "room_leave":
				self._leave_room(session, False)
				connection.send_message({"type": "room_list", "rooms": self._room_list()})
			elif message_type == "game_start_request":
				self._request_game_start(session)
			elif message_type == "input":
				# 조작은 그대로 상대에게 넘긴다. 판정은 각 클라이언트가 같은 덱으로 진행한다.
				self._relay_to_opponent(session, {"type": "opponent_input", "time": message.get("time"), "kind": message.get("kind"), "value": message.get("value")})
			elif message_type == "chain_result":
				self._relay_to_opponent(session, {"type": "opponent_chain", "time": message.get("time"), "attack": message.get("attack"), "allClear": message.get("allClear"), "fever": message.get("fever")})
			elif message_type == "defeat":
				self._report_defeat(session, message)

	############################### HTTP API ###############################

	# /apis/onlineplay/... HTTP 요청을 처리한다.
	def handle_api(self, handler: Any) -> tuple[int, dict[str, Any]]:
		"""가입·로그인·로그아웃만 HTTP로 처리하고, 나머지는 모두 WebSocket으로 주고받는다."""
		# 기능을 끈 서버에서는 온라인 플레이 요청을 아예 받지 않는다.
		if not self.enabled:
			return HTTPStatus.NOT_FOUND, {"ok": False, "code": "online_play_disabled"}
		if getattr(handler, "command", "") != "POST":
			return HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "code": "method_not_allowed"}

		path_parts = handler.path.split("?")[0].split("/")
		action = path_parts[3] if len(path_parts) > 3 else ""
		try:
			length = int(handler.headers.get("Content-Length") or 0)
		except ValueError:
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_body"}
		if length > MAX_BODY_BYTES:
			return HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"ok": False, "code": "invalid_body"}
		try:
			body = handler.rfile.read(length) if length > 0 else b""
			payload = json.loads(body.decode("utf-8")) if body else {}
		except (OSError, UnicodeDecodeError, json.JSONDecodeError):
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_body"}
		if not isinstance(payload, dict):
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_body"}

		try:
			if action == "signup":
				return self._signup(payload)
			if action == "login":
				return self._login(payload)
			if action == "logout":
				return self._logout(payload)
			return HTTPStatus.NOT_FOUND, {"ok": False, "code": "not_found"}
		except Exception:
			print("온라인 플레이 API 처리 중 오류가 발생했습니다.")
			print(traceback.format_exc())
			return HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "code": "server_error"}
