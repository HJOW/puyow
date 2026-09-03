# Puyo W Python 서버 사용 안내
#
# 이 프로그램은 Puyo W 웹 페이지와 학습 API를 제공하는 간단한 서버입니다.
# 명령 프롬프트에서 프로젝트 폴더로 이동한 뒤 명령어를 실행하세요.
#
# 기본 포트(9891)로 실행:
#     python learning/pythonserver.py
#
# 원하는 포트 번호로 실행(예: 8080):
#     python learning/pythonserver.py 8080
#
# 실행한 뒤 웹 브라우저에서 다음 주소를 열면 게임을 시작할 수 있습니다.
#     http://localhost:9891/
#
# 다른 포트를 사용했다면 주소의 숫자도 바꿔 입력하세요.
#     http://localhost:8080/
#
# 서버를 끝내려면 서버가 실행 중인 명령 프롬프트 창에서 Ctrl+C를 누르세요.
#
# Copyright 2026 HJOW
#
# Apache License 2.0
# 이 프로그램은 Apache License 2.0에 따라 사용할 수 있습니다.
# 라이선스 전문은 프로젝트 루트의 LICENSE 파일을 확인하세요.

# Puyo W 웹 서버 역할 뿐 아니라 학습 API 서버 역할도 수행한다.

import argparse
import hmac
import json
import mimetypes
import threading
import traceback
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import unquote, urlsplit


# 서버 운영자가 이 컬렉션의 값을 수정해 포트와 인증 토큰을 설정한다.
SERVER_CONFIG = {
	"port": 9891,
	"web_root": Path(__file__).resolve().parent.parent / "src",
	"learning_token": "change-this-token",
	"max_body_size": 1024 * 1024,
}

# nodeserver.js와 동일하게 학습 API에서 접근을 차단할 경로 조각이다.
BLACKLIST_FILE_PATTERNS = ("/WEB-INF/", "/META-INF/")

# 세션 데이터는 프로세스 메모리에만 보관하며, 여러 HTTP 스레드의 접근을 보호한다.
learning_sessions: dict[str, dict[str, Any]] = {}
learning_sessions_lock = threading.Lock()


class ApiError(Exception):
	"""HTTP 상태 코드와 함께 API 입력 오류를 전달한다."""

	def __init__(self, message: str, status: int = HTTPStatus.BAD_REQUEST) -> None:
		super().__init__(message)
		self.status = status


def read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
	"""HTTP 요청 본문을 제한된 크기까지 읽고 JSON 객체로 파싱한다."""
	content_length = handler.headers.get("Content-Length")
	try:
		length = int(content_length) if content_length is not None else 0
	except ValueError as error:
		raise ApiError("Content-Length가 올바르지 않습니다.") from error
	if length > SERVER_CONFIG["max_body_size"]:
		raise ApiError("요청 본문이 너무 큽니다.", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
	body = handler.rfile.read(length)
	try:
		payload = json.loads(body.decode("utf-8")) if body else {}
	except (UnicodeDecodeError, json.JSONDecodeError) as error:
		raise ApiError("JSON 요청 본문이 올바르지 않습니다.") from error
	if not isinstance(payload, dict):
		raise ApiError("JSON 본문은 객체여야 합니다.")
	return payload


def is_learning_authorized(handler: BaseHTTPRequestHandler) -> bool:
	"""요청의 Bearer 토큰을 상수시간 비교로 검증한다."""
	token = str(SERVER_CONFIG["learning_token"])
	authorization = handler.headers.get("Authorization", "")
	if not token or not authorization.startswith("Bearer "):
		return False
	supplied = authorization.removeprefix("Bearer ").encode("utf-8")
	expected = token.encode("utf-8")
	return hmac.compare_digest(supplied, expected)


def require_number(value: Any, name: str, integer: bool = False) -> None:
	"""값이 유한한 숫자인지 검증한다."""
	if isinstance(value, bool) or not isinstance(value, (int, float)):
		raise ApiError(f"{name}은(는) 유효한 숫자여야 합니다.")
	if integer and not isinstance(value, int):
		raise ApiError(f"{name}은(는) 정수여야 합니다.")


def require_observation(value: Any, name: str) -> None:
	"""관측값이 제한된 길이의 유한한 숫자 배열인지 검증한다."""
	if not isinstance(value, list) or not value or len(value) > 10000:
		raise ApiError(f"{name}은(는) 유한한 숫자의 배열이어야 합니다.")
	for item in value:
		require_number(item, name)


def get_learning_session(session_id: Any) -> dict[str, Any]:
	"""세션 ID에 해당하는 학습 세션을 조회하거나 새로 만든다."""
	if not isinstance(session_id, str) or not 1 <= len(session_id) <= 128:
		raise ApiError("sessionId는 1~128자의 문자열이어야 합니다.")
	with learning_sessions_lock:
		return learning_sessions.setdefault(session_id, {
			"sequence": 0,
			"steps": 0,
			"reward": 0,
			"done": False,
			"observation": None,
			"updatedAt": datetime.now(timezone.utc).isoformat(),
		})


def learning_api(handler: BaseHTTPRequestHandler) -> tuple[int, dict[str, Any]]:
	"""reset, step, episode_end 학습 이벤트를 검증하고 세션에 누적한다."""
	if handler.command != "POST":
		return HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "error": "POST만 지원합니다."}
	if not is_learning_authorized(handler):
		status = HTTPStatus.SERVICE_UNAVAILABLE if not SERVER_CONFIG["learning_token"] else HTTPStatus.UNAUTHORIZED
		message = "SERVER_CONFIG['learning_token']이 설정되지 않았습니다." if not SERVER_CONFIG["learning_token"] else "인증이 필요합니다."
		return status, {"ok": False, "error": message}
	payload = read_json_body(handler)
	event = payload.get("event")
	session = get_learning_session(payload.get("sessionId"))
	if event not in {"reset", "step", "episode_end"}:
		raise ApiError("event는 reset, step, episode_end 중 하나여야 합니다.")
	with learning_sessions_lock:
		if event == "reset":
			require_observation(payload.get("observation"), "observation")
			session.update(sequence=0, steps=0, reward=0, done=False, observation=payload["observation"])
		elif event == "step":
			require_observation(payload.get("observation"), "observation")
			require_observation(payload.get("nextObservation"), "nextObservation")
			require_number(payload.get("action"), "action", integer=True)
			require_number(payload.get("reward"), "reward")
			if not isinstance(payload.get("done"), bool):
				raise ApiError("done은 boolean이어야 합니다.")
			session["steps"] += 1
			session["reward"] += payload["reward"]
			session["done"] = payload["done"]
			session["observation"] = payload["nextObservation"]
		else:
			if payload.get("done") is not True:
				raise ApiError("episode_end의 done은 true여야 합니다.")
			session["done"] = True
		session["sequence"] += 1
		session["updatedAt"] = datetime.now(timezone.utc).isoformat()
		return HTTPStatus.OK, {"ok": True, "event": event, "sessionId": payload["sessionId"], "sequence": session["sequence"], "steps": session["steps"], "totalReward": session["reward"], "done": session["done"]}


# nodeserver.js의 apis 객체와 같은 역할을 하는 동적 API 등록 컬렉션이다.
apis: dict[str, Callable[[BaseHTTPRequestHandler], tuple[int, dict[str, Any]]]] = {"learning": learning_api}


class PuyoRequestHandler(BaseHTTPRequestHandler):
	"""CORS, 동적 API, 정적 파일 응답을 담당하는 HTTP 핸들러."""

	def _send_json(self, status: int, payload: dict[str, Any]) -> None:
		data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
		self.send_response(status)
		self._send_cors_headers()
		self.send_header("Content-Type", "application/json; charset=utf-8")
		self.send_header("Content-Length", str(len(data)))
		self.end_headers()
		self.wfile.write(data)

	def _send_cors_headers(self) -> None:
		self.send_header("Access-Control-Allow-Origin", "*")
		self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		self.send_header("Access-Control-Max-Age", "600")

	def do_OPTIONS(self) -> None:
		self.send_response(HTTPStatus.NO_CONTENT)
		self._send_cors_headers()
		self.end_headers()

	def do_GET(self) -> None:
		self._handle_request()

	def do_POST(self) -> None:
		self._handle_request()

	def _handle_request(self) -> None:
		path = unquote(urlsplit(self.path).path)
		if any(pattern in path for pattern in BLACKLIST_FILE_PATTERNS):
			self._send_json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "403 Forbidden"})
			return
		if path.startswith("/apis/"):
			api_name = path[6:].split("/", 1)[0]
			api_handler = apis.get(api_name)
			if api_handler is None:
				self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "404 Not Found"})
				return
			try:
				status, payload = api_handler(self)
			except ApiError as error:
				status, payload = error.status, {"ok": False, "error": str(error)}
			except Exception:
				self.log_error("API 처리 오류\\n%s", traceback.format_exc())
				status, payload = HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": "API 처리 중 오류가 발생했습니다."}
			self._send_json(status, payload)
			return
		self._serve_static(path)

	def _serve_static(self, request_path: str) -> None:
		relative_path = request_path.lstrip("/") or "index.html"
		root = Path(SERVER_CONFIG["web_root"]).resolve()
		file_path = (root / relative_path).resolve()
		if root not in file_path.parents and file_path != root:
			self._send_json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "403 Forbidden"})
			return
		if not file_path.is_file():
			self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "404 Not Found"})
			return
		data = file_path.read_bytes()
		content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
		self.send_response(HTTPStatus.OK)
		self._send_cors_headers()
		self.send_header("Content-Type", content_type)
		self.send_header("Content-Length", str(len(data)))
		self.end_headers()
		self.wfile.write(data)


def main() -> None:
	"""명령행 포트를 반영해 Python HTTP 서버를 시작한다."""
	parser = argparse.ArgumentParser(description="Puyo W Python 웹 서버")
	parser.add_argument("port", nargs="?", type=int, help="사용할 포트 번호(기본값: SERVER_CONFIG['port'])")
	args = parser.parse_args()
	port = args.port if args.port is not None else SERVER_CONFIG["port"]
	server = ThreadingHTTPServer(("", port), PuyoRequestHandler)
	print(f"Server is running on port {port}.")
	print(f"Web root: {Path(SERVER_CONFIG['web_root']).resolve()}")
	try:
		server.serve_forever()
	except KeyboardInterrupt:
		print("Server shutdown requested.")
	finally:
		server.server_close()


if __name__ == "__main__":
	main()

