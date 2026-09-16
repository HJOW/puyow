# 서버 모니터링 및 관리 페이지(src/admin.html) 전용 백엔드다.
#
# pythonserver.py는 이 모듈의 진입점 하나만 연결한다.
#     - HTTP : /apis/admin/...   → handle_api()
#
# 관리자 계정은 pythonserver.py의 SERVER_CONFIG["admin_id"]·["admin_password"] 하나뿐이며 추가할 수 없다.
# admin_password가 비어 있으면 관리자 계정 자체가 비활성화되어 로그인 API가 항상 거절한다.
# 비밀번호는 단방향 암호화 없이 서버 설정에 그대로 두고(운영자가 언제든 고칠 수 있어야 하므로),
# 로그인 시에만 양쪽에서 sha256으로 해시해 비교한다.
#
# node/admin.js도 같은 계약을 구현하므로, 경로나 오류 코드를 바꾸면 두 파일을 함께 고쳐야 한다.
#
# 의존성
#     psutil  (대시보드의 CPU·램 점유율 표시에만 필요합니다. 설치: pip install psutil)
#             설치하지 않아도 서버와 관리 페이지는 동작하며, 점유율 칸만 표시되지 않습니다.
#
# Copyright 2026 HJOW
#
# Apache License 2.0
# 이 프로그램은 Apache License 2.0에 따라 사용할 수 있습니다.
# 라이선스 전문은 프로젝트 루트의 LICENSE 파일을 확인하세요.

import hashlib
import hmac
import json
import math
import platform
import re
import secrets
import threading
import time
import traceback
from http import HTTPStatus
from typing import Any

############################### 상수 ###############################

# 관리자 로그인 세션을 담아 두는 쿠키 이름이다. 온라인 플레이 세션 토큰과 전혀 공유하지 않는다.
ADMIN_COOKIE_NAME = "puyow_admin_session"
# 이 횟수 이상 로그인에 실패하면 해당 세션의 관리자 로그인을 막는다.
LOGIN_FAIL_LIMIT = 5
# 마지막 로그인 실패로부터 이 시간 동안만 차단한다(초).
LOGIN_BLOCK_SEC = 10 * 60.0
# 아무 요청도 오지 않으면 이 시간 뒤에 관리자 세션을 버린다(초).
SESSION_IDLE_SEC = 30 * 60.0
# 관리자 API 요청 본문의 최대 크기(바이트).
MAX_BODY_BYTES = 64 * 1024
# 프런트가 sha256으로 해시해 보내는 값의 형식이다. (64자리 16진수)
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


# psutil은 대시보드에서만 쓰므로 처음 필요할 때 불러온다.
def _get_psutil() -> Any:
	"""설치하지 않은 서버에서도 관리 페이지가 동작하도록 실패 시 None을 돌려준다."""
	try:
		import psutil
	except ImportError:
		return None
	return psutil


# 문자열의 sha256 해시를 16진수 소문자로 만든다.
def _sha256_hex(value: str) -> str:
	"""관리자 비밀번호 원문과 프런트가 보낸 값을 같은 방식으로 해시해 비교한다."""
	return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


# 요청 헤더에서 쿠키 하나를 읽는다.
def _read_cookie(handler: Any, name: str) -> str:
	"""쿠키가 없으면 빈 문자열이다."""
	header = handler.headers.get("Cookie") if getattr(handler, "headers", None) is not None else None
	if not header:
		return ""
	for one in header.split(";"):
		one = one.strip()
		if one.startswith(f"{name}="):
			return one[len(name) + 1:]
	return ""


class AdminService:
	"""관리자 로그인 세션, 서버 현황, 온라인 플레이 계정 관리를 담당하는 관리 페이지 백엔드다."""

	def __init__(self, admin_id: Any, admin_password: Any, online_play_service: Any = None, server_info: Any = None) -> None:
		self.admin_id = admin_id if isinstance(admin_id, str) else ""
		admin_password = admin_password if isinstance(admin_password, str) else ""
		# 비밀번호가 공란이면 관리자 계정 자체가 비활성화된다. ID만 적어 두어도 로그인할 수 없다.
		self.enabled = len(admin_password) > 0
		# 서버가 살아 있는 동안 한 번만 계산해 둔다. 원문은 요청 처리 중에 다시 쓰지 않는다.
		self.admin_password_hash = _sha256_hex(admin_password) if self.enabled else ""
		self.online_play_service = online_play_service
		# 대시보드에 함께 보여 줄 이 서버만의 정보를 만드는 함수다.
		self.server_info = server_info
		# 세션 ID → 관리자 세션. 로그인 여부와 로그인 실패 기록을 함께 담는다.
		# 온라인 플레이 세션(onlineplay.py)과는 저장소도 수명도 완전히 별개다.
		self.sessions: dict[str, dict[str, Any]] = {}
		self.lock = threading.RLock()
		self.started_at = time.time()
		# psutil의 cpu_percent는 첫 호출이 항상 0.0이므로 서버 시작 때 한 번 호출해 기준 시각을 잡아 둔다.
		psutil = _get_psutil()
		if psutil is not None:
			try:
				psutil.cpu_percent(interval=None)
			except Exception:
				pass

	# 이 서버에서 관리자 계정을 쓸 수 있는지 알린다.
	def is_enabled(self) -> bool:
		"""admin_password가 공란이 아닐 때만 True다."""
		return self.enabled

	############################### 세션 ###############################

	# 오래 쓰이지 않은 세션을 버린다.
	def _prune_sessions(self) -> None:
		"""관리 스레드를 따로 두지 않고 요청이 올 때마다 정리한다."""
		now = time.time()
		for session_id in [key for key, value in self.sessions.items() if now - value["lastActiveAt"] > SESSION_IDLE_SEC]:
			self.sessions.pop(session_id, None)

	# 요청의 관리자 세션을 찾고, 없으면 새로 만든다.
	def _resolve_session(self, handler: Any) -> tuple[dict[str, Any], dict[str, str]]:
		"""로그인 실패 횟수를 세션에 담아야 하므로 로그인 전에도 세션을 발급한다."""
		with self.lock:
			self._prune_sessions()
			session = self.sessions.get(_read_cookie(handler, ADMIN_COOKIE_NAME))
			extra_headers: dict[str, str] = {}
			if session is None:
				session_id = secrets.token_hex(24)
				session = {"id": session_id, "authenticated": False, "failCount": 0, "lastFailAt": 0.0, "lastActiveAt": time.time()}
				self.sessions[session_id] = session
				# 관리 페이지는 서버와 같은 출처에서 열리므로 SameSite=Strict로 두어도 문제가 없다.
				extra_headers["Set-Cookie"] = f"{ADMIN_COOKIE_NAME}={session_id}; Path=/; HttpOnly; SameSite=Strict"
			session["lastActiveAt"] = time.time()
			return session, extra_headers

	# 이 세션이 지금 관리자 로그인 차단 상태인지 본다.
	def _blocked_seconds(self, session: dict[str, Any]) -> int:
		"""5회 이상 실패해도 마지막 실패로부터 10분이 지나면 다시 시도할 수 있다."""
		if session["failCount"] < LOGIN_FAIL_LIMIT:
			return 0
		remain = LOGIN_BLOCK_SEC - (time.time() - session["lastFailAt"])
		if remain <= 0:
			# 차단 시간이 지났으므로 실패 기록을 지우고 처음부터 다시 센다.
			session["failCount"] = 0
			session["lastFailAt"] = 0.0
			return 0
		return int(math.ceil(remain))

	############################### 각 API ###############################

	# 지금 로그인 상태와 차단 상태를 알려 준다.
	def _session_api(self, session: dict[str, Any]) -> tuple[int, dict[str, Any]]:
		"""관리 페이지가 처음 열릴 때 호출한다."""
		with self.lock:
			return HTTPStatus.OK, {
				"ok": True,
				"adminEnabled": self.enabled,
				"authenticated": session["authenticated"] is True,
				"blockedSeconds": self._blocked_seconds(session),
			}

	# 관리자 로그인을 처리한다.
	def _login_api(self, session: dict[str, Any], payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
		"""아이디와 sha256 해시가 모두 맞아야 하며, 실패 횟수는 이 세션에 쌓인다."""
		# 비밀번호가 공란이면 관리자 계정이 없는 것과 같다.
		if not self.enabled:
			return HTTPStatus.FORBIDDEN, {"ok": False, "code": "admin_disabled"}

		with self.lock:
			blocked_seconds = self._blocked_seconds(session)
			if blocked_seconds > 0:
				return HTTPStatus.LOCKED, {"ok": False, "code": "login_blocked", "blockedSeconds": blocked_seconds}

			account_id = payload.get("id") if isinstance(payload.get("id"), str) else ""
			password = payload.get("password").lower() if isinstance(payload.get("password"), str) else ""
			# 형식이 맞지 않는 요청도 로그인 실패로 세어 무차별 대입을 함께 막는다.
			matched = bool(SHA256_PATTERN.match(password)) and account_id == self.admin_id and hmac.compare_digest(password, self.admin_password_hash)
			if not matched:
				session["authenticated"] = False
				session["failCount"] += 1
				session["lastFailAt"] = time.time()
				now_blocked = self._blocked_seconds(session)
				if now_blocked > 0:
					return HTTPStatus.LOCKED, {"ok": False, "code": "login_blocked", "blockedSeconds": now_blocked}
				return HTTPStatus.UNAUTHORIZED, {"ok": False, "code": "login_failed", "remain": LOGIN_FAIL_LIMIT - session["failCount"]}

			session["authenticated"] = True
			session["failCount"] = 0
			session["lastFailAt"] = 0.0
			return HTTPStatus.OK, {"ok": True, "adminId": self.admin_id}

	# 관리자 로그아웃을 처리한다. 세션 자체를 버린다.
	def _logout_api(self, session: dict[str, Any]) -> tuple[int, dict[str, Any]]:
		"""로그아웃한 세션의 실패 기록도 함께 사라진다."""
		with self.lock:
			self.sessions.pop(session["id"], None)
		return HTTPStatus.OK, {"ok": True}

	# 대시보드에 보여 줄 서버 현황을 만든다.
	def _status_api(self) -> tuple[int, dict[str, Any]]:
		"""psutil로 시스템 CPU·램 점유율을 읽는다. 설치하지 않았으면 두 값이 None이다."""
		psutil = _get_psutil()
		cpu_percent: float | None = None
		memory_percent: float | None = None
		memory_bytes: list[dict[str, Any]] = []
		if psutil is not None:
			try:
				# interval=None이면 직전 호출 이후의 평균을 바로 돌려주므로 4초 주기 새로고침과 잘 맞는다.
				cpu_percent = round(float(psutil.cpu_percent(interval=None)), 1)
				virtual_memory = psutil.virtual_memory()
				memory_percent = round(float(virtual_memory.percent), 1)
				memory_bytes.append({"key": "systemUsed", "bytes": int(virtual_memory.total - virtual_memory.available)})
				memory_bytes.append({"key": "systemTotal", "bytes": int(virtual_memory.total)})
				memory_bytes.append({"key": "processRss", "bytes": int(psutil.Process().memory_info().rss)})
			except Exception:
				# 권한이나 플랫폼 문제로 읽지 못해도 대시보드 전체가 실패하지는 않게 한다.
				cpu_percent = None
				memory_percent = None
				memory_bytes = []

		online_play = {"enabled": False, "accounts": 0, "sessions": 0, "rooms": 0, "playing": 0}
		if self.online_play_service is not None and hasattr(self.online_play_service, "get_stats"):
			online_play = self.online_play_service.get_stats()

		return HTTPStatus.OK, {
			"ok": True,
			"server": "python",
			"runtime": f"Python {platform.python_version()}",
			"uptimeSec": int(time.time() - self.started_at),
			"time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z",
			"cpuPercent": cpu_percent,
			"memoryPercent": memory_percent,
			"memoryBytes": memory_bytes,
			"psutilAvailable": psutil is not None,
			"onlinePlay": online_play,
			"serverInfo": self.server_info() if callable(self.server_info) else {},
		}

	# 온라인 플레이 계정 목록을 보낸다.
	def _accounts_api(self) -> tuple[int, dict[str, Any]]:
		"""온라인 플레이를 끈 서버에서는 빈 목록과 함께 꺼져 있음을 알린다."""
		service = self.online_play_service
		online_play_enabled = bool(service is not None and hasattr(service, "is_enabled") and service.is_enabled())
		accounts = service.list_accounts() if online_play_enabled and hasattr(service, "list_accounts") else []
		return HTTPStatus.OK, {"ok": True, "onlinePlayEnabled": online_play_enabled, "accounts": accounts}

	# 온라인 플레이 계정의 비밀번호를 바꾼다.
	def _account_password_api(self, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
		"""게임 가입과 같게 sha256 해시를 받아 온라인 플레이 서비스가 bcrypt로 저장한다."""
		service = self.online_play_service
		if service is None or not hasattr(service, "change_account_password"):
			return HTTPStatus.NOT_FOUND, {"ok": False, "code": "online_play_disabled"}
		password = payload.get("password").lower() if isinstance(payload.get("password"), str) else ""
		result = service.change_account_password(payload.get("id"), password)
		return (HTTPStatus.OK if result.get("ok") else HTTPStatus.BAD_REQUEST), result

	# 온라인 플레이 계정을 활성·비활성으로 바꾼다.
	def _account_state_api(self, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
		"""비활성으로 바꿔도 이미 로그인한 세션은 끊지 않고 방 생성·입장만 막는다."""
		service = self.online_play_service
		if service is None or not hasattr(service, "set_account_active"):
			return HTTPStatus.NOT_FOUND, {"ok": False, "code": "online_play_disabled"}
		if not isinstance(payload.get("active"), bool):
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_request"}
		result = service.set_account_active(payload.get("id"), payload.get("active"))
		return (HTTPStatus.OK if result.get("ok") else HTTPStatus.BAD_REQUEST), result

	############################### HTTP 진입점 ###############################

	# /apis/admin/... HTTP 요청을 처리한다.
	def handle_api(self, handler: Any) -> tuple[int, dict[str, Any], dict[str, str]]:
		"""세션 쿠키를 함께 내려야 하므로 상태·본문에 더해 추가 헤더까지 돌려준다."""
		if getattr(handler, "command", "") != "POST":
			return HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "code": "method_not_allowed"}, {}

		session, extra_headers = self._resolve_session(handler)
		path_parts = handler.path.split("?")[0].split("/")
		action = path_parts[3] if len(path_parts) > 3 else ""

		try:
			length = int(handler.headers.get("Content-Length") or 0)
		except ValueError:
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_body"}, extra_headers
		if length > MAX_BODY_BYTES:
			return HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"ok": False, "code": "invalid_body"}, extra_headers
		try:
			body = handler.rfile.read(length) if length > 0 else b""
			payload = json.loads(body.decode("utf-8")) if body else {}
		except (OSError, UnicodeDecodeError, json.JSONDecodeError):
			return HTTPStatus.BAD_REQUEST, {"ok": False, "code": "invalid_body"}, extra_headers
		if not isinstance(payload, dict):
			payload = {}

		try:
			# 로그인 전에도 쓸 수 있는 요청이다.
			if action == "session":
				return (*self._session_api(session), extra_headers)
			if action == "login":
				return (*self._login_api(session, payload), extra_headers)
			if action == "logout":
				return (*self._logout_api(session), extra_headers)

			# 여기부터는 모두 로그인한 관리자만 쓸 수 있다.
			if not self.enabled or session["authenticated"] is not True:
				return HTTPStatus.UNAUTHORIZED, {"ok": False, "code": "unauthorized"}, extra_headers

			if action == "status":
				return (*self._status_api(), extra_headers)
			if action == "accounts":
				return (*self._accounts_api(), extra_headers)
			if action == "accountpassword":
				return (*self._account_password_api(payload), extra_headers)
			if action == "accountstate":
				return (*self._account_state_api(payload), extra_headers)
			return HTTPStatus.NOT_FOUND, {"ok": False, "code": "not_found"}, extra_headers
		except Exception:
			print("관리 API 처리 중 오류가 발생했습니다.")
			print(traceback.format_exc())
			return HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "code": "server_error"}, extra_headers
