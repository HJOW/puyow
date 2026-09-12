# Puyo W Python 서버 사용 안내
#
# 이 프로그램은 Puyo W 웹 페이지와 학습 API를 제공하는 간단한 서버입니다.
# 명령 프롬프트에서 프로젝트 폴더로 이동한 뒤 명령어를 실행하세요.
#
# 기본 포트(9891)로 실행:
#     python python/pythonserver.py
#
# 원하는 포트 번호로 실행(예: 8080):
#     python python/pythonserver.py 8080
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
# 
# 의존성
#     common.py

# Puyo W 웹 서버 역할 뿐 아니라 학습 API 서버 역할도 수행한다.

import argparse
import hmac
import ipaddress
import json
import math
import mimetypes
import threading
import traceback
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable, Sequence
from urllib.parse import unquote, urlsplit

from common import (
	ACTION_COUNT, BOARD_HEIGHT, BOARD_WIDTH, DISCOUNT_GAMMA, MODEL_VERSION, OBSERVATION_SIZE,
	ROTATION_COUNT, action_to_placement, decode_observation_scalars, encode_observation_values,
	is_legal_observation_action, terminal_reward, validate_observation,
)


# 서버 운영자가 이 컬렉션의 값을 수정해 포트와 인증 토큰을 설정한다.
SERVER_CONFIG = {
	"port": 9891, # 포트 번호
	"web_root": Path(__file__).resolve().parent.parent / "src",
	"learning_token": "change-this-token",
	"model_path": Path(__file__).resolve().parent / "puyow" / "default.pt", # 실제 모델 파일을 지정
	"max_body_size": 1024 * 1024,
}

# nodeserver.js와 동일하게 학습 API에서 접근을 차단할 경로 조각이다.
BLACKLIST_FILE_PATTERNS = ("/WEB-INF/", "/META-INF/")

# 확장자별 Content-Type이다. nodeserver.js의 표와 같은 값을 쓰며, mimetypes보다 먼저 적용한다.
# mimetypes.guess_type()은 Windows에서 레지스트리(HKEY_CLASSES_ROOT)를 함께 읽기 때문에 같은
# 확장자라도 PC마다 다른 값이 나온다. 실제로 .mjs가 text/plain으로 잡혀 ONNX 런타임의 wasm 글루
# 모듈을 브라우저가 거부하는 일이 있었고, .wasm도 환경에 따라 빠질 수 있다. 게임 구동에 필요한
# 확장자는 여기에 못박아 두어 어느 PC에서 실행하든 같은 헤더가 나가게 한다.
STATIC_CONTENT_TYPES = {
	".html": "text/html",
	".htm": "text/html",
	".txt": "text/plain",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".wasm": "application/wasm",
	".css": "text/css",
	".json": "application/json",
	".json5": "application/json5",
	".xml": "application/xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".gif": "image/gif",
	".ico": "image/vnd.microsoft.icon",
	".mp3": "audio/mpeg",
	".ogg": "audio/ogg",
	".wav": "audio/wav",
	".mp4": "video/mp4",
	".weba": "audio/webm",
	".webm": "video/webm",
	".webp": "image/webp",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".zip": "application/zip",
	".7z": "application/x-7z-compressed",
	".gz": "application/gzip",
	".jar": "application/java-archive",
	".csv": "text/csv",
	".pdf": "application/pdf",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".webmanifest": "application/manifest+json",
	# ONNX 모델은 브라우저가 ArrayBuffer로 받아 쓰므로 일반 이진 파일로 내려보낸다.
	".onnx": "application/octet-stream",
}

# 이 문자열을 토큰으로 보내고 호출자가 실제로 localhost/루프백 주소일 때만 서버 설정 토큰과
# 무관하게 인증을 통과시킨다. 빈 문자열은 이 예외에 해당하지 않으며 평소처럼 거부된다.
LOOPBACK_BYPASS_TOKEN = "localhost"

# 세션 데이터는 프로세스 메모리에만 보관하며, 여러 HTTP 스레드의 접근을 보호한다.
learning_sessions: dict[str, dict[str, Any]] = {}
learning_sessions_lock = threading.Lock()
# 모델은 실제 파일이 설정된 경우에만 첫 요청에서 로드한다. 모델이 없는 개발 환경에서도
# 정적 파일 및 학습 이벤트 API가 torch 설치 여부와 관계없이 동작하게 하기 위한 캐시다.
value_model: Any = None
value_model_path: Path | None = None
# 체크포인트를 다시 저장할 때 원래 seed 값을 그대로 유지하기 위해 로드 시점에 보관해 둔다.
value_model_seed: Any = None
value_model_lock = threading.Lock()
# bundledenemy는 룰·시간 배율을 모듈 전역으로 관리한다. 배치 추론(애프터스테이트 계산)과 솔로몬
# 온라인 학습이 서로 다른 잠금 아래에서 이 전역을 함께 쓰므로, 실제 계산 구간만 이 잠금으로
# 직렬화한다. 항상 가장 안쪽에서만 잡으므로 다른 잠금과 교착되지 않는다.
simulation_lock = threading.Lock()

# 솔로몬 온라인 학습 세션이다. 게임이 Local AI 제공자로 극한 난이도 솔로몬과 대전할 때만 만들어지며,
# 대전 중에 둔 수의 애프터스테이트와 보상을 순서대로 담아 두었다가 판이 끝날 때 학습에 사용한다.
solomon_sessions: dict[str, dict[str, Any]] = {}
solomon_sessions_lock = threading.Lock()

# 한 대전에서 모을 수의 개수와 동시에 유지할 세션 수의 상한이다. 결과 화면까지 가지 못하고 끝난
# 세션(브라우저 종료 등)이 메모리에 계속 쌓이지 않도록 오래된 세션부터 버린다.
SOLOMON_SESSION_MAX_TRANSITIONS = 500
SOLOMON_SESSION_LIMIT = 8

# 한 세션에서 따로 모으는 수의 주체다. 솔로몬(모델)이 둔 수와 사람이 둔 수는 서로 다음 상태가
# 이어지지 않으므로, 같은 대전이라도 표본을 만들 때는 반드시 나누어 쌓아야 한다.
SOLOMON_SESSION_SIDES = ("solomon", "player")

# 대전이 끝난 뒤 한 번에 적용할 가치망 업데이트 설정이다. 학습률·감가율은 learning.train()과 같다.
SOLOMON_TRAINING_EPOCHS = 4
SOLOMON_TRAINING_BATCH_SIZE = 32
SOLOMON_TRAINING_LEARNING_RATE = 1e-3
SOLOMON_TRAINING_GAMMA = DISCOUNT_GAMMA

# 사람이 이긴 대전에서 그 사람의 수를 "모델이 플레이어 쪽을 조작해 이긴 것"으로 보고 학습할 때
# 적용하는 비중이다. 솔로몬 자신이 둔 수의 비중은 항상 1이므로 이 값이 클수록 사람의 승리 수순을
# 더 강하게 따라 배운다. 1로 두면 양쪽을 같은 비중으로 학습한다.
SOLOMON_PLAYER_WIN_TRAINING_WEIGHT = 10.0
# 비중을 적용하지 않는 전이의 기본값이다.
SOLOMON_DEFAULT_TRAINING_WEIGHT = 1.0

# puyow.js의 COLORS 순서와 관측 벡터의 색상 채널 순서다.
PUYO_COLORS = ("red", "green", "yellow", "blue", "purple")


# 정적 파일 하나에 내려보낼 Content-Type을 결정한다.
def resolve_static_content_type(file_path: Path) -> str:
	"""확장자로 Content-Type을 정한다. STATIC_CONTENT_TYPES를 먼저 보고 없으면 mimetypes로 넘긴다.

	OS 설정에 좌우되지 않아야 하는 확장자는 STATIC_CONTENT_TYPES에 못박혀 있으므로 그 값이 우선한다.
	표에 없는 확장자만 mimetypes.guess_type()에 맡기고, 그것도 모르면 일반 이진 파일로 본다.
	"""
	extension = file_path.suffix.lower()
	content_type = STATIC_CONTENT_TYPES.get(extension)
	if content_type is not None:
		return content_type
	return mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"


class ApiError(Exception):
	"""HTTP 상태 코드와 함께 API 입력 오류를 전달한다."""

	# 호출부가 공통 오류 응답을 만들 수 있게 HTTP 상태를 예외와 함께 보관한다.
	def __init__(self, message: str, status: int = HTTPStatus.BAD_REQUEST) -> None:
		super().__init__(message)
		self.status = status


# 모든 JSON API가 공유하는 본문 크기 제한 및 객체 형식 검증 함수다.
def read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
	"""HTTP 요청 본문을 제한된 크기까지 읽고 JSON 객체로 파싱한다."""
	content_length = handler.headers.get("Content-Length")
	try:
		length = int(content_length) if content_length is not None else 0
	except ValueError as error:
		raise ApiError("Content-Length가 올바르지 않습니다.") from error
	# 메모리를 과도하게 사용하지 않도록 설정한 최대 크기를 초과한 요청은 읽기 전에 거절한다.
	if length > SERVER_CONFIG["max_body_size"]:
		raise ApiError("요청 본문이 너무 큽니다.", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
	body = handler.rfile.read(length)
	try:
		payload = json.loads(body.decode("utf-8")) if body else {}
	except (UnicodeDecodeError, json.JSONDecodeError) as error:
		raise ApiError("JSON 요청 본문이 올바르지 않습니다.") from error
	# 배열·문자열 같은 JSON 값은 API 요청 본문으로 허용하지 않는다.
	if not isinstance(payload, dict):
		raise ApiError("JSON 본문은 객체여야 합니다.")
	return payload


# localhost/루프백에서 온 요청인지 확인해 LOOPBACK_BYPASS_TOKEN 호출을 허용할지 판단하는 데 쓴다.
def _is_loopback_client(handler: BaseHTTPRequestHandler) -> bool:
	"""요청을 보낸 클라이언트 주소가 localhost/루프백 주소인지 확인한다."""
	try:
		return ipaddress.ip_address(handler.client_address[0]).is_loopback
	except (ValueError, IndexError, TypeError):
		return False


# 학습 API와 모델 Chat Completions API가 동일하게 사용하는 Bearer 토큰 검증 함수다.
def is_learning_authorized(handler: BaseHTTPRequestHandler) -> bool:
	"""요청의 Bearer 토큰을 상수시간 비교로 검증한다.

	토큰을 `LOOPBACK_BYPASS_TOKEN`("localhost")으로 보낸 호출은, 호출한 클라이언트가
	localhost/루프백 주소일 때만 서버 설정 토큰과 무관하게 허용한다. 같은 컴퓨터에서 게임과
	pythonserver.py를 함께 띄워 쓰거나 GUI 학습기(lngui.py)로 로컬 학습 API에 보고할 때 토큰을
	따로 설정하지 않아도 되게 하기 위함이다. 빈 문자열 토큰은 이 예외에 해당하지 않으므로
	루프백에서 호출하더라도 평소처럼 거부된다.
	"""
	authorization = handler.headers.get("Authorization", "")
	if not authorization.startswith("Bearer "):
		return False
	supplied = authorization.removeprefix("Bearer ")
	if supplied == LOOPBACK_BYPASS_TOKEN and _is_loopback_client(handler):
		return True
	token = str(SERVER_CONFIG["learning_token"])
	if not supplied or not token:
		return False
	return hmac.compare_digest(supplied.encode("utf-8"), token.encode("utf-8"))


# 숫자형 API 필드가 NaN·무한대·boolean을 받지 않도록 검증한다.
def require_number(value: Any, name: str, integer: bool = False) -> None:
	"""값이 유한한 숫자인지 검증한다."""
	if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
		raise ApiError(f"{name}은(는) 유효한 숫자여야 합니다.")
	# action처럼 정수 계약인 필드만 추가로 정수 여부를 확인한다.
	if integer and not isinstance(value, int):
		raise ApiError(f"{name}은(는) 정수여야 합니다.")


# common.py의 관측 벡터 길이 및 유한값 계약을 HTTP 오류 형식으로 변환한다.
def require_observation(value: Any, name: str) -> None:
	"""관측값이 제한된 길이의 유한한 숫자 배열인지 검증한다."""
	try:
		validate_observation(value, name)
	except ValueError as error:
		raise ApiError(str(error)) from error


# 세션 생성과 조회가 동시에 일어나도 하나의 세션 상태만 만들도록 잠금 안에서 처리한다.
def get_learning_session(session_id: Any) -> dict[str, Any]:
	"""세션 ID에 해당하는 학습 세션을 조회하거나 새로 만든다."""
	if not isinstance(session_id, str) or not 1 <= len(session_id) <= 128:
		raise ApiError("sessionId는 1~128자의 문자열이어야 합니다.")
	with learning_sessions_lock:
		# setdefault는 기존 세션을 유지하고, 최초 요청일 때만 초기 상태를 넣는다.
		return learning_sessions.setdefault(session_id, {
			"sequence": 0,
			"steps": 0,
			"reward": 0,
			"done": False,
			"observation": None,
			"updatedAt": datetime.now(timezone.utc).isoformat(),
		})


# 브라우저·학습기가 보내는 reset, step, episode_end 전이를 누적하는 API 진입점이다.
def learning_api(handler: BaseHTTPRequestHandler) -> tuple[int, dict[str, Any]]:
	"""reset, step, episode_end 학습 이벤트를 검증하고 세션에 누적한다."""
	# 학습 전이는 상태를 변경하므로 POST 이외의 메서드는 허용하지 않는다.
	if handler.command != "POST":
		return HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "error": "POST만 지원합니다."}
	# 토큰이 비어 있으면 운영자 설정 오류(503), 그 외에는 요청자 인증 오류(401)다.
	if not is_learning_authorized(handler):
		status = HTTPStatus.SERVICE_UNAVAILABLE if not SERVER_CONFIG["learning_token"] else HTTPStatus.UNAUTHORIZED
		message = "SERVER_CONFIG['learning_token']이 설정되지 않았습니다." if not SERVER_CONFIG["learning_token"] else "인증이 필요합니다."
		return status, {"ok": False, "error": message}
	payload = read_json_body(handler)
	event = payload.get("event")
	session = get_learning_session(payload.get("sessionId"))
	# 정의된 세 이벤트만 받아 세션 통계의 계약을 고정한다.
	if event not in {"reset", "step", "episode_end"}:
		raise ApiError("event는 reset, step, episode_end 중 하나여야 합니다.")
	# reset·step·종료 처리와 누적값 갱신을 하나의 잠금 구간에서 직렬화한다.
	with learning_sessions_lock:
		# reset은 새 에피소드의 기준 관측과 누적값을 처음부터 다시 설정한다.
		if event == "reset":
			require_observation(payload.get("observation"), "observation")
			session.update(sequence=0, steps=0, reward=0, done=False, observation=payload["observation"])
		# step은 행동 전후 관측과 보상을 검증한 뒤 누적 통계에 반영한다.
		elif event == "step":
			require_observation(payload.get("observation"), "observation")
			require_observation(payload.get("nextObservation"), "nextObservation")
			require_number(payload.get("action"), "action", integer=True)
			try:
				action_to_placement(payload.get("action"))
			except ValueError as error:
				raise ApiError(str(error)) from error
			require_number(payload.get("reward"), "reward")
			if not isinstance(payload.get("done"), bool):
				raise ApiError("done은 boolean이어야 합니다.")
			session["steps"] += 1
			session["reward"] += payload["reward"]
			session["done"] = payload["done"]
			session["observation"] = payload["nextObservation"]
		# episode_end는 마지막 step이 없더라도 종료 상태를 명시할 수 있다.
		else:
			if payload.get("done") is not True:
				raise ApiError("episode_end의 done은 true여야 합니다.")
			session["done"] = True
		session["sequence"] += 1
		session["updatedAt"] = datetime.now(timezone.utc).isoformat()
		return HTTPStatus.OK, {"ok": True, "event": event, "sessionId": payload["sessionId"], "sequence": session["sequence"], "steps": session["steps"], "totalReward": session["reward"], "done": session["done"]}


# model_path가 비어 있거나 파일이 없으면 모델 API를 노출하지 않기 위한 경로 확인 함수다.
def get_configured_model_path() -> Path | None:
	"""설정된 체크포인트가 실제 파일일 때만 그 경로를 반환한다."""
	value = SERVER_CONFIG.get("model_path")
	# 설정 키 누락·null·공백 문자열은 모두 "모델 서비스 사용 안 함"으로 해석한다.
	if value is None or (isinstance(value, str) and not value.strip()):
		return None
	try:
		path = Path(value).expanduser()
	except TypeError:
		return None
	# 디렉터리나 존재하지 않는 경로는 요청 시 404가 되도록 None으로 통일한다.
	return path if path.is_file() else None


# 체크포인트를 한 번만 읽고, 설정 경로가 바뀌면 새 모델을 다시 읽는 지연 로더다.
def get_value_model() -> Any:
	"""현재 설정 경로의 호환 가능한 가치망을 지연 로드한다."""
	global value_model, value_model_path, value_model_seed
	model_path = get_configured_model_path()
	if model_path is None:
		raise ApiError("모델이 설정되지 않았거나 모델 파일을 찾을 수 없습니다.", HTTPStatus.NOT_FOUND)
	resolved_path = model_path.resolve()
	with value_model_lock:
		# 동시 요청이 와도 이미 같은 경로를 읽었다면 캐시된 모델을 재사용한다.
		if value_model is not None and value_model_path == resolved_path:
			return value_model
		try:
			# model_path가 없을 때는 이 import를 수행하지 않아 기존 웹 서버 기능을 보존한다.
			import torch
			from learning import ValueNetwork
			checkpoint = torch.load(resolved_path, map_location="cpu", weights_only=True)
			# 학습 당시의 관측·행동 수가 현재 common.py 계약과 다르면 추론을 막는다.
			if not isinstance(checkpoint, dict):
				raise ValueError("체크포인트가 객체 형식이 아닙니다.")
			if checkpoint.get("model_version") != MODEL_VERSION:
				raise ValueError(f"체크포인트 모델 버전이 현재 서버와 다릅니다(필요: {MODEL_VERSION}).")
			if checkpoint.get("observation_size") != OBSERVATION_SIZE or checkpoint.get("action_count") != ACTION_COUNT:
				raise ValueError("체크포인트의 관측값 또는 행동 계약이 현재 서버와 다릅니다.")
			state_dict = checkpoint.get("model")
			if not isinstance(state_dict, dict):
				raise ValueError("체크포인트에 model 가중치가 없습니다.")
			model = ValueNetwork()
			model.load_state_dict(state_dict)
			model.eval()
		except Exception as error:
			# 모델 로드 실패는 정적 웹 서비스까지 중단시키지 않고 이 API에만 503으로 노출한다.
			raise ApiError(f"모델을 불러올 수 없습니다: {error}", HTTPStatus.SERVICE_UNAVAILABLE) from error
		value_model = model
		value_model_path = resolved_path
		value_model_seed = checkpoint.get("seed")
		return value_model


def save_value_checkpoint(model: Any, model_path: Path) -> None:
	"""현재 가중치를 learning.py와 같은 체크포인트 형식으로 저장한다.

	모델 버전·관측값·행동 계약과 seed를 그대로 유지하므로 저장된 파일은 learning.py의 추가 학습과
	다른 게임 세션에서 계속 그대로 쓸 수 있다. 저장 도중 프로세스가 멈춰 사용자의 모델 파일이
	깨지는 일이 없도록 임시 파일에 먼저 쓴 뒤 마지막에 교체한다.
	"""
	import torch
	temporary_path = model_path.with_name(model_path.name + ".tmp")
	torch.save({
		"model": model.state_dict(),
		"model_version": MODEL_VERSION,
		"observation_size": OBSERVATION_SIZE,
		"action_count": ACTION_COUNT,
		"seed": value_model_seed,
	}, temporary_path)
	temporary_path.replace(model_path)


# 현재 게임 클라이언트가 사용하는 response_format.json_schema 이름을 확인한다.
def get_chat_request_schema_name(payload: dict[str, Any]) -> str:
	"""Puyo W가 요구한 Chat Completions 구조화 출력 스키마 이름을 검증한다."""
	response_format = payload.get("response_format")
	if not isinstance(response_format, dict) or response_format.get("type") != "json_schema":
		raise ApiError("response_format.type은 json_schema여야 합니다.")
	json_schema = response_format.get("json_schema")
	if not isinstance(json_schema, dict) or not isinstance(json_schema.get("name"), str):
		raise ApiError("response_format.json_schema.name이 필요합니다.")
	return json_schema["name"]


# Chat Completions 메시지 중 실제 Solomon 상태가 담긴 마지막 user 메시지를 찾는다.
def get_latest_user_message(payload: dict[str, Any]) -> str:
	"""Chat Completions messages 배열에서 마지막 user 문자열 메시지를 반환한다."""
	messages = payload.get("messages")
	if not isinstance(messages, list):
		raise ApiError("messages는 배열이어야 합니다.")
	# 마지막 user 메시지가 최신 게임 상태이므로 뒤에서부터 탐색한다.
	for message in reversed(messages):
		if isinstance(message, dict) and message.get("role") == "user" and isinstance(message.get("content"), str):
			return message["content"]
	raise ApiError("문자열 content를 가진 user 메시지가 필요합니다.")


# Solomon 프롬프트의 게임 상태를 현재 체크포인트가 요구하는 고정 길이 벡터로 바꾼다.
def build_model_observation(prompt: dict[str, Any]) -> list[float]:
	"""Solomon 프롬프트의 필드·현재 쌍·실제 시간·피버 상태를 공통 관측으로 변환한다."""
	field = prompt.get("currentField")
	supplied = prompt.get("suppliedPuyos")
	if not isinstance(field, dict) or not isinstance(supplied, list):
		raise ApiError("Solomon 필드 또는 제공 뿌요 정보가 없습니다.")
	occupied_cells = field.get("occupiedCells")
	if not isinstance(occupied_cells, list):
		raise ApiError("currentField.occupiedCells는 배열이어야 합니다.")
	board: list[list[str | None]] = [[None for _ in range(BOARD_WIDTH)] for _ in range(BOARD_HEIGHT)]
	# 프롬프트의 희소 좌표 목록을 y=0이 바닥인 12행 관측 보드로 복원한다.
	for cell in occupied_cells:
		if not isinstance(cell, dict):
			raise ApiError("occupiedCells 항목은 객체여야 합니다.")
		x, y, color = cell.get("x"), cell.get("y"), cell.get("color")
		if isinstance(x, bool) or not isinstance(x, int) or not 0 <= x < BOARD_WIDTH:
			raise ApiError("occupiedCells.x가 보드 범위를 벗어났습니다.")
		if isinstance(y, bool) or not isinstance(y, int) or y < 0:
			raise ApiError("occupiedCells.y가 올바르지 않습니다.")
		if not isinstance(color, str) or not color:
			raise ApiError("occupiedCells.color가 올바르지 않습니다.")
		# 현재 관측 계약은 puyow.js와 같이 표시 영역 12행만 사용한다.
		if y < BOARD_HEIGHT:
			board[y][x] = color
	current_pair = next((entry.get("colors") for entry in supplied if isinstance(entry, dict) and entry.get("order") == "current"), None)
	if not isinstance(current_pair, list) or len(current_pair) != 2 or any(color not in PUYO_COLORS for color in current_pair):
		raise ApiError("현재 뿌요 쌍은 두 개의 색으로 제공되어야 합니다.")
	current_state = prompt.get("currentState")
	current_state = current_state if isinstance(current_state, dict) else {}
	try:
		return encode_observation_values(
			board, current_pair,
			attack=current_state.get("attack", 0),
			turn=current_state.get("placedPairCount", 0),
			incoming_damage=current_state.get("incomingDamage", 0),
			fever_rule=current_state.get("feverRule", False),
			all_clear_ticket=current_state.get("allClearTicket", False),
			elapsed_ms=current_state.get("elapsedMs", 0),
			margin_rate=current_state.get("marginRate", 70),
			time_progress_multiplier=current_state.get("timeProgressMultiplier", 1),
			fever=current_state.get("fever"),
		)
	except (TypeError, ValueError) as error:
		raise ApiError(f"관측 상태가 올바르지 않습니다: {error}") from error


# 애프터스테이트의 조작 쌍 자리에 넣을 "이 수 다음에 내려올 쌍"을 프롬프트에서 읽는다.
def build_model_next_pair(prompt: dict[str, Any]) -> tuple[Any, Any]:
	"""Solomon 프롬프트의 next_1 쌍을 반환한다. 없으면 색이 정해지지 않은 쌍으로 본다.

	가치망은 한 수를 둔 직후 상태를 "다음 턴 시작 상태"로 보고 평가하므로, 그 상태의 조작 쌍은
	이번 수의 다음 쌍이다. 이 항목을 보내지 않는 요청에서는 색을 비운 쌍으로 인코딩한다.
	"""
	supplied = prompt.get("suppliedPuyos")
	if not isinstance(supplied, list):
		return (None, None)
	colors = next((entry.get("colors") for entry in supplied if isinstance(entry, dict) and entry.get("order") == "next_1"), None)
	if not isinstance(colors, list) or len(colors) != 2 or any(color not in PUYO_COLORS for color in colors):
		return (None, None)
	return (colors[0], colors[1])


# 사람이 둔 수를 보내는 학습 API의 nextPair 항목을 검증한다.
def parse_next_pair(value: Any) -> tuple[Any, Any]:
	"""학습 API가 보낸 nextPair를 색 쌍으로 바꾼다. 항목이 없으면 색이 정해지지 않은 쌍으로 본다."""
	if value is None:
		return (None, None)
	if not isinstance(value, list) or len(value) != 2 or any(color not in PUYO_COLORS for color in value):
		raise ApiError("nextPair는 두 개의 색 이름으로 이루어진 배열이어야 합니다.")
	return (value[0], value[1])


# 모델이 고른 행동이 현재 보드의 기본 높이 조건에서 가능한지 빠르게 거른다.
def is_legal_model_placement(observation: list[float], action: int) -> bool:
	"""표시 영역의 현재 적재 높이를 기준으로 행동의 기본 배치 가능 여부를 판별한다."""
	return is_legal_observation_action(observation, action)


# 게임이 보낸 배치 후보 목록을 행동 번호로 바꿔, 서버가 그 안에서만 고르게 하기 위한 검증 함수다.
def parse_usable_actions(value: Any) -> set[int] | None:
	"""게임이 보낸 usablePlacements를 행동 번호 집합으로 바꾼다. 항목이 없으면 None을 반환한다."""
	if value is None:
		return None
	if not isinstance(value, list) or not value or len(value) > ACTION_COUNT:
		raise ApiError(f"usablePlacements는 1~{ACTION_COUNT}개의 배치 목록이어야 합니다.")
	actions: set[int] = set()
	for item in value:
		if not isinstance(item, dict):
			raise ApiError("usablePlacements 항목은 객체여야 합니다.")
		x, rotation = item.get("x"), item.get("rotation")
		if isinstance(x, bool) or not isinstance(x, int) or not 0 <= x < BOARD_WIDTH:
			raise ApiError("usablePlacements.x가 보드 범위를 벗어났습니다.")
		if isinstance(rotation, bool) or not isinstance(rotation, int) or not 0 <= rotation < ROTATION_COUNT:
			raise ApiError(f"usablePlacements.rotation은 0부터 {ROTATION_COUNT - 1} 사이여야 합니다.")
		actions.add(x * ROTATION_COUNT + rotation)
	return actions


# 놓을 수 있는 배치마다 결과 보드를 규칙으로 만들어 보고, 가치가 가장 높은 배치를 고른다.
def choose_model_action(
	model: Any, observation: list[float], usable_actions: set[int] | None = None,
	next_pair: Sequence[Any] = (None, None),
) -> int:
	"""이번 턴에 실제로 놓을 수 있는 배치 중 `즉시 보상 + 감가된 가치`가 가장 큰 하나를 고른다.

	`usable_actions`는 게임이 직접 계산해 보낸 배치 후보다. 게임은 뿌요의 현재 낙하 위치에서의
	가로 이동 경로와 회전 킥, 화면 밖 숨김 행까지 보고 판단하지만 서버의 관측값에는 화면 12줄만
	담기므로, 이 목록이 오면 관측값의 높이 조건 대신 이 목록만 믿고 고른다. 목록을 보내지 않는
	요청에서는 관측값의 열 높이로만 거른다.

	솔로몬 학습이 켜진 대전에서는 판이 끝날 때 같은 모델의 가중치를 갱신하므로, 그 갱신과 겹치지
	않도록 추론도 value_model_lock 안에서 수행한다.
	"""
	try:
		import torch
		from learning import select_afterstate
		with value_model_lock, simulation_lock:
			action, afterstate = select_afterstate(
				model, observation, next_pair, torch.device("cpu"), usable_actions=usable_actions,
			)
	except ApiError:
		raise
	except Exception as error:
		raise ApiError(f"모델 추론에 실패했습니다: {error}", HTTPStatus.SERVICE_UNAVAILABLE) from error
	# 관측값의 12줄만으로는 어떤 후보도 착지시킬 수 없는 경우다. 게임이 쓸 수 있다고 알려 준 배치가
	# 있으면 그중 하나라도 돌려주어야 게임이 대체 AI로 넘어가지 않는다.
	if afterstate is None and usable_actions is None:
		raise ApiError("현재 필드에서 선택할 수 있는 행동이 없습니다.", HTTPStatus.UNPROCESSABLE_ENTITY)
	return action


def require_solomon_session_id(session_id: Any) -> str:
	"""프롬프트·API가 보낸 솔로몬 학습 세션 ID 형식을 검증한다."""
	if not isinstance(session_id, str) or not 1 <= len(session_id) <= 128:
		raise ApiError("learningSessionId는 1~128자의 문자열이어야 합니다.")
	return session_id


def _get_or_create_solomon_session(session_id: str) -> dict[str, Any]:
	"""세션을 조회하거나 새로 만든다. 호출자가 solomon_sessions_lock을 잡은 상태여야 한다."""
	session = solomon_sessions.get(session_id)
	if session is not None:
		return session
	# 결과 화면까지 가지 못하고 끝난 예전 대전의 세션을 오래된(먼저 만든) 순서로 버린다.
	while len(solomon_sessions) >= SOLOMON_SESSION_LIMIT:
		solomon_sessions.pop(next(iter(solomon_sessions)))
	session = {side: {"moves": [], "linked": False} for side in SOLOMON_SESSION_SIDES}
	solomon_sessions[session_id] = session
	return session


def build_solomon_afterstate(observation: list[float], action: int, next_pair: Sequence[Any]) -> Any:
	"""이번에 둔 수의 애프터스테이트와 즉시 보상을 오프라인 학습과 같은 규칙으로 만든다.

	learning.PuyoDuelEnvironment.step()과 같은 `ATTACK + 연쇄 가중치` 보상 계약(피버 중의 연쇄는
	5분의 1)과 같은 애프터스테이트 인코딩을 쓰기 위해 학습기의 공용 함수를 그대로 호출한다. 오프라인
	학습과 계약이 같아야 같은 체크포인트를 이어서 학습해도 가치의 기준이 흔들리지 않는다.
	놓을 자리가 없으면 None이다.
	"""
	# 모델 파일이 없는 환경에서도 정적 웹 서비스가 동작하도록 학습 관련 모듈은 필요할 때만 읽는다.
	from learning import build_afterstate
	with simulation_lock:
		return build_afterstate(observation, action, next_pair)


def record_solomon_step(
	session_id: str, observation: list[float], action: int, next_pair: Sequence[Any] = (None, None),
	side: str = "solomon",
) -> None:
	"""이번에 둔 수의 애프터스테이트와 보상을 세션의 해당 쪽에 순서대로 담는다.

	`side`가 `player`이면 사람이 직접 둔 수다. 관측·행동 계약이 솔로몬과 완전히 같으므로 같은 방식으로
	학습 표본을 만들 수 있으며, 실제로 학습에 넣을지는 대전이 끝난 뒤 승패를 보고 결정한다.

	앞 수와 이어지는 수인지(`linked`)를 함께 적어 둔다. 위험 높이·응답 오류로 솔로몬이 대체 AI를 쓴
	턴은 요청이 오지 않는데, 그런 턴이 사이에 끼면 앞 수의 다음 상태가 그 수 하나만의 결과가 아니라
	목표값을 만들 수 없기 때문이다. placedPairCount는 상한(100)에서 잘리므로 두 턴 이상 건너뛴
	경우만 확실히 걸러 낸다.
	"""
	with solomon_sessions_lock:
		session_side = _get_or_create_solomon_session(session_id)[side]
		moves = session_side["moves"]
		scalars = decode_observation_scalars(observation)
		turn = round(scalars["turn"])
		linked = bool(moves) and session_side["linked"] and turn - moves[-1]["turn"] < 2
		afterstate = build_solomon_afterstate(observation, action, next_pair)
		# 착지할 자리가 없는 배치는 추론 단계에서 이미 걸러지므로 사실상 오지 않는다. 그래도 이런 수가
		# 오면 표본을 만들 수 없으므로 건너뛰고, 다음 수도 앞 수와 이어지지 않은 것으로 본다.
		if afterstate is None or len(moves) >= SOLOMON_SESSION_MAX_TRANSITIONS:
			session_side["linked"] = False
			return
		# 종료 가치의 게임 시간 항을 만들 때 쓰려고 이 수 시점의 경과 시간도 함께 적어 둔다.
		moves.append({
			"afterstate": afterstate.observation, "reward": afterstate.reward, "turn": turn,
			"linked": linked, "elapsed_ms": scalars["elapsed_ms"],
		})
		session_side["linked"] = True


def train_solomon_samples(samples: list[dict[str, Any]]) -> float:
	"""한 대전에서 모은 표본으로 현재 로드된 가치망을 추가 학습하고 체크포인트에 저장한다."""
	import torch
	from torch import nn
	model = get_value_model()
	model_path = get_configured_model_path()
	if model_path is None:
		raise ApiError("모델이 설정되지 않았거나 모델 파일을 찾을 수 없습니다.", HTTPStatus.NOT_FOUND)
	states = torch.tensor([item["afterstate"] for item in samples], dtype=torch.float32)
	rewards = torch.tensor([item["reward"] for item in samples], dtype=torch.float32)
	# 부트스트랩할 상태가 없는 표본(대전의 마지막 수)은 0 벡터와 감가율 0을 넣어 목표값에서 지운다.
	bootstraps = torch.tensor(
		[item["bootstrap"] if item["bootstrap"] is not None else [0.0] * OBSERVATION_SIZE for item in samples],
		dtype=torch.float32,
	)
	discounts = torch.tensor(
		[0.0 if item["bootstrap"] is None else SOLOMON_TRAINING_GAMMA for item in samples], dtype=torch.float32,
	)
	# 표본별 학습 비중은 평균이 1이 되도록 정규화한다. 이렇게 해야 어떤 비중을 쓰더라도 손실 크기가
	# 예전과 같은 수준으로 유지되어, 학습률을 그대로 두고도 상대적인 비중만 반영할 수 있다.
	weights = torch.tensor([float(item.get("weight", SOLOMON_DEFAULT_TRAINING_WEIGHT)) for item in samples], dtype=torch.float32)
	weights = weights / weights.mean().clamp(min=1e-6)
	# 갱신 중에는 추론도 같은 잠금을 기다린다. 학습이 끝나고 저장까지 마친 뒤에야 다음 추론이 이어진다.
	with value_model_lock:
		# 목표값은 학습을 시작하기 전 가중치로 한 번만 계산한다. learning.train()이 별도 target
		# 네트워크를 두는 것과 같은 이유로, 갱신하는 동안 목표까지 함께 움직이지 않게 하기 위함이다.
		with torch.no_grad():
			expected = rewards + discounts * model(bootstraps)
		optimizer = torch.optim.Adam(model.parameters(), lr=SOLOMON_TRAINING_LEARNING_RATE)
		count = len(samples)
		last_loss = 0.0
		for _ in range(SOLOMON_TRAINING_EPOCHS):
			order = torch.randperm(count)
			for start in range(0, count, SOLOMON_TRAINING_BATCH_SIZE):
				batch = order[start:start + SOLOMON_TRAINING_BATCH_SIZE]
				loss = (nn.functional.smooth_l1_loss(model(states[batch]), expected[batch], reduction="none") * weights[batch]).mean()
				optimizer.zero_grad()
				loss.backward()
				nn.utils.clip_grad_norm_(model.parameters(), 1.0)
				optimizer.step()
				last_loss = float(loss.item())
		save_value_checkpoint(model, model_path)
	return last_loss


def _side_elapsed_ms(session_side: dict[str, Any]) -> float:
	"""한쪽이 마지막으로 둔 수의 경과 시간을 돌려준다. 둔 수가 없으면 0이다."""
	moves = session_side["moves"]
	return float(moves[-1]["elapsed_ms"]) if moves else 0.0


def _close_solomon_side(session_side: dict[str, Any], side_terminal_reward: float, weight: float) -> list[dict[str, Any]]:
	"""한쪽이 둔 수들을 가치망 학습 표본으로 바꾸고 학습 비중을 매긴다.

	애프터스테이트 하나의 가치는 그 뒤에 이어지는 보상의 합이므로, 목표값은 바로 다음 수의 보상과
	감가한 다음 애프터스테이트의 가치다. 대전의 마지막 수 뒤에는 승패 보상만 남고 더 진행할 상태가
	없으므로 부트스트랩 없이 승패 보상만 목표로 쓴다. 앞뒤가 끊긴(`linked`가 아닌) 수는 다음 상태를
	알 수 없어 표본으로 만들지 않는다.
	"""
	moves = session_side["moves"]
	samples: list[dict[str, Any]] = []
	for index, move in enumerate(moves):
		following = moves[index + 1] if index + 1 < len(moves) else None
		if following is not None and following["linked"]:
			samples.append({
				"afterstate": move["afterstate"], "reward": following["reward"],
				"bootstrap": following["afterstate"], "weight": weight,
			})
		elif following is None:
			samples.append({
				"afterstate": move["afterstate"], "reward": side_terminal_reward, "bootstrap": None, "weight": weight,
			})
	return samples


def finish_solomon_session(session_id: str, result: str) -> dict[str, Any]:
	"""대전이 끝난 세션의 수들을 승패 보상까지 반영한 학습 표본으로 바꿔 모델에 반영한다.

	`result`는 솔로몬 기준의 승패다. 솔로몬이 진 대전(`loss`)에서는 사람이 이겼다는 뜻이므로, 그 사람이
	둔 수도 "모델이 플레이어 쪽을 조작해 이긴 수순"으로 보고 SOLOMON_PLAYER_WIN_TRAINING_WEIGHT의
	비중으로 함께 학습한다. 사람이 이기지 못한 대전의 사람 쪽 수는 그대로 버린다.

	종료 가치는 오프라인 학습과 같은 common.terminal_reward()이므로 승패뿐 아니라 게임 시간도 반영한다.
	경과 시간은 그 쪽이 마지막으로 둔 수의 관측값에서 읽는다(둔 수가 없으면 0으로 본다).
	"""
	with solomon_sessions_lock:
		session = solomon_sessions.pop(session_id, None)
		if session is None:
			return {"trained": False, "transitions": 0, "reason": "해당 세션의 학습 데이터가 없습니다."}
		solomon_terminal = (
			terminal_reward(result == "win", _side_elapsed_ms(session["solomon"])) if result in ("win", "loss") else 0.0
		)
		solomon_samples = _close_solomon_side(session["solomon"], solomon_terminal, SOLOMON_DEFAULT_TRAINING_WEIGHT)
		player_samples = (
			_close_solomon_side(
				session["player"], terminal_reward(True, _side_elapsed_ms(session["player"])),
				SOLOMON_PLAYER_WIN_TRAINING_WEIGHT,
			)
			if result == "loss" else []
		)
		samples = solomon_samples + player_samples
	if not samples:
		return {"trained": False, "transitions": 0, "reason": "이번 대전에서 모은 학습 데이터가 없습니다."}
	return {
		"trained": True,
		"transitions": len(samples),
		"playerTransitions": len(player_samples),
		"loss": train_solomon_samples(samples),
	}


# 대전 중 사람이 둔 수를 모으고, 대전이 끝나면 그 판의 학습 세션을 모델에 반영하는 HTTP API다.
def solomon_learning_api(handler: BaseHTTPRequestHandler) -> tuple[int, dict[str, Any]]:
	"""사람이 둔 수(`step`)를 세션에 모으고, 종료 화면 시점의 `finish`로 학습을 적용한다.

	솔로몬 자신의 수는 배치를 추론하는 /v1/chat/completions 요청에서 이미 세션에 쌓이므로, 이 API의
	`step`은 항상 사람이 조작한 플레이어 쪽 수다.
	"""
	if handler.command != "POST":
		return HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "error": "POST만 지원합니다."}
	if not is_learning_authorized(handler):
		status = HTTPStatus.SERVICE_UNAVAILABLE if not SERVER_CONFIG["learning_token"] else HTTPStatus.UNAUTHORIZED
		message = "SERVER_CONFIG['learning_token']이 설정되지 않았습니다." if not SERVER_CONFIG["learning_token"] else "인증이 필요합니다."
		return status, {"ok": False, "error": message}
	payload = read_json_body(handler)
	event = payload.get("event")
	if event not in {"step", "finish"}:
		raise ApiError("event는 step 또는 finish여야 합니다.")
	session_id = require_solomon_session_id(payload.get("sessionId"))
	if event == "step":
		require_observation(payload.get("observation"), "observation")
		require_number(payload.get("action"), "action", integer=True)
		try:
			action_to_placement(payload["action"])
		except ValueError as error:
			raise ApiError(str(error)) from error
		record_solomon_step(
			session_id, payload["observation"], payload["action"], parse_next_pair(payload.get("nextPair")), side="player",
		)
		return HTTPStatus.OK, {"ok": True, "sessionId": session_id, "event": "step"}
	result = payload.get("result")
	if result not in {"win", "loss", "draw"}:
		raise ApiError("result는 win, loss, draw 중 하나여야 합니다.")
	return HTTPStatus.OK, {"ok": True, "sessionId": session_id, **finish_solomon_session(session_id, result)}


# Puyo W가 LM Studio에 보내는 두 종류의 구조화 출력 요청을 처리하는 HTTP API다.
def chat_completions_api(handler: BaseHTTPRequestHandler) -> tuple[int, dict[str, Any]]:
	"""Puyo W의 LM Studio 호환 구조화 출력 요청을 가치망으로 처리한다."""
	# Chat Completions는 생성 요청만 지원하므로 POST 외 요청은 메서드 오류다.
	if handler.command != "POST":
		return HTTPStatus.METHOD_NOT_ALLOWED, {"error": {"message": "POST만 지원합니다.", "type": "invalid_request_error"}}
	# 모델이 비활성화된 경우에는 다른 웹 API와 달리 이 엔드포인트만 404로 숨긴다.
	if get_configured_model_path() is None:
		return HTTPStatus.NOT_FOUND, {"error": {"message": "모델이 설정되지 않았거나 모델 파일을 찾을 수 없습니다.", "type": "not_found_error"}}
	# 브라우저 설정의 AI API 키는 learning_token과 같은 Bearer 토큰이어야 한다.
	if not is_learning_authorized(handler):
		return HTTPStatus.UNAUTHORIZED, {"error": {"message": "인증이 필요합니다.", "type": "authentication_error"}}
	# 인증을 통과한 요청만 파싱해 학습 세션 상태에 반영한다.
	payload = read_json_body(handler)
	model_name = payload.get("model")
	if not isinstance(model_name, str) or not model_name.strip():
		raise ApiError("model은 비어 있지 않은 문자열이어야 합니다.")
	model = get_value_model()
	schema_name = get_chat_request_schema_name(payload)
	# 설정 화면의 연결 테스트는 모델을 정상 로드한 뒤 성공 JSON만 반환한다.
	if schema_name == "ai_api_test_result":
		content = json.dumps({"success": True}, separators=(",", ":"))
	# 실제 대전에서는 Solomon 프롬프트를 관측값으로 바꿔 배치를 추론한다.
	elif schema_name == "solomon_puyo_placement":
		try:
			prompt = json.loads(get_latest_user_message(payload))
		except json.JSONDecodeError as error:
			raise ApiError("Solomon user 메시지는 JSON 객체여야 합니다.") from error
		if not isinstance(prompt, dict):
			raise ApiError("Solomon user 메시지는 JSON 객체여야 합니다.")
		observation = build_model_observation(prompt)
		next_pair = build_model_next_pair(prompt)
		action = choose_model_action(model, observation, parse_usable_actions(prompt.get("usablePlacements")), next_pair)
		# 게임은 Local AI 제공자로 극한 난이도 솔로몬과 대전할 때만 학습 세션 ID를 함께 보낸다.
		# 그 대전에서만 이번 수의 애프터스테이트를 담아 두고, 판이 끝날 때 학습에 사용한다.
		if prompt.get("learningSessionId") is not None:
			record_solomon_step(require_solomon_session_id(prompt.get("learningSessionId")), observation, action, next_pair)
		x, rotation = action_to_placement(action)
		content = json.dumps({"x": x, "rotation": rotation}, separators=(",", ":"))
	else:
		# 게임이 아직 정의하지 않은 스키마는 임의 응답을 만들지 않고 명시적으로 거절한다.
		raise ApiError(f"지원하지 않는 JSON 스키마입니다: {schema_name}")
	return HTTPStatus.OK, {
		"id": f"chatcmpl-puyow-{datetime.now(timezone.utc).timestamp():.6f}",
		"object": "chat.completion",
		"created": int(datetime.now(timezone.utc).timestamp()),
		"model": model_name,
		"choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
	}


# 게임 클라이언트가 이 서버의 로컬 모델 사용 가능 여부를 먼저 확인하기 위한 HTTP API다.
def local_model_info_api(handler: BaseHTTPRequestHandler) -> tuple[int, dict[str, Any]]:
	"""SERVER_CONFIG의 model_path로 /v1/chat/completions를 제공할 수 있는지 알려 준다."""
	# 인증 없이 호출하는 확인용 API이므로 사용 가능 여부만 boolean으로 응답한다.
	if get_configured_model_path() is None:
		return HTTPStatus.OK, {"available": False}
	try:
		# 실제 서비스와 같은 지연 로더를 사용해 체크포인트 호환성까지 확인한다.
		get_value_model()
	except Exception:
		# 모델을 읽지 못하면 게임이 Local AI를 선택하지 못하도록 사용 불가로 응답한다.
		return HTTPStatus.OK, {"available": False}
	return HTTPStatus.OK, {"available": True}


# nodeserver.js의 apis 객체와 같은 역할을 하는 동적 API 등록 컬렉션이다.
apis: dict[str, Callable[[BaseHTTPRequestHandler], tuple[int, dict[str, Any]]]] = {"learning": learning_api, "localmodelinfo": local_model_info_api, "solomonlearning": solomon_learning_api}


class PuyoRequestHandler(BaseHTTPRequestHandler):
	"""CORS, 동적 API, 정적 파일 응답을 담당하는 HTTP 핸들러."""

	# 상태 코드와 JSON 객체를 공통 CORS 헤더와 함께 브라우저로 전송한다.
	def _send_json(self, status: int, payload: dict[str, Any]) -> None:
		data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
		self.send_response(status)
		self._send_cors_headers()
		self.send_header("Content-Type", "application/json; charset=utf-8")
		self.send_header("Content-Length", str(len(data)))
		self.end_headers()
		# HEAD 응답은 헤더까지만 보낸다. 본문을 붙이면 HTTP 규약을 어긴다.
		if not self._is_head_request():
			self.wfile.write(data)

	# 지금 처리 중인 요청이 본문 없이 헤더만 돌려주어야 하는 HEAD 요청인지 확인한다.
	def _is_head_request(self) -> bool:
		return getattr(self, "command", None) == "HEAD"

	# 게임 페이지와 API 서버 포트가 달라도 요청할 수 있도록 필요한 CORS 헤더를 추가한다.
	def _send_cors_headers(self) -> None:
		self.send_header("Access-Control-Allow-Origin", "*")
		self.send_header("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")
		self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		self.send_header("Access-Control-Max-Age", "600")

	# 브라우저의 사전 요청은 본문 없이 CORS 허용 정보만 반환한다.
	def do_OPTIONS(self) -> None:
		self.send_response(HTTPStatus.NO_CONTENT)
		self._send_cors_headers()
		self.end_headers()

	# GET 요청은 공통 라우터를 통해 정적 파일 또는 메서드 오류로 처리한다.
	def do_GET(self) -> None:
		self._handle_request()

	# HEAD 요청은 GET과 같은 라우팅을 거치되 본문 없이 헤더만 돌려준다.
	# 게임이 ONNX wasm 파일을 내려받기 전에 접근 가능한지 확인할 때 사용하므로 반드시 지원해야 한다.
	def do_HEAD(self) -> None:
		self._handle_request()

	# POST 요청은 공통 라우터에서 Chat Completions 또는 /apis API로 분기한다.
	def do_POST(self) -> None:
		self._handle_request()

	# 차단 경로, 모델 서비스, 학습 API, 정적 파일 순서로 URL을 판별하는 요청 라우터다.
	def _handle_request(self) -> None:
		path = unquote(urlsplit(self.path).path)
		# 웹 루트 안에 있더라도 서버 내부 설정 경로는 직접 제공하지 않는다.
		if any(pattern in path for pattern in BLACKLIST_FILE_PATTERNS):
			self._send_json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "403 Forbidden"})
			return
		# model_path가 유효할 때만 동작하는 LM Studio 호환 모델 서비스다.
		if path == "/v1/chat/completions":
			try:
				status, payload = chat_completions_api(self)
			except ApiError as error:
				status, payload = error.status, {"error": {"message": str(error), "type": "invalid_request_error"}}
			except Exception:
				self.log_error("Chat Completions 처리 오류\\n%s", traceback.format_exc())
				status, payload = HTTPStatus.INTERNAL_SERVER_ERROR, {"error": {"message": "Chat Completions 처리 중 오류가 발생했습니다.", "type": "server_error"}}
			self._send_json(status, payload)
			return
		# /apis/ 아래는 등록된 동적 API 이름으로 찾아 실행한다.
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

	# 웹 루트 밖으로 벗어나는 경로를 차단한 뒤 존재하는 정적 파일만 제공한다.
	def _serve_static(self, request_path: str) -> None:
		relative_path = request_path.lstrip("/") or "index.html"
		root = Path(SERVER_CONFIG["web_root"]).resolve()
		file_path = (root / relative_path).resolve()
		# resolve 뒤에도 루트 하위가 아니면 ../ 등을 통한 경로 이탈 시도다.
		if root not in file_path.parents and file_path != root:
			self._send_json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "403 Forbidden"})
			return
		# 디렉터리와 없는 파일은 목록 노출 없이 동일하게 404로 처리한다.
		if not file_path.is_file():
			self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "404 Not Found"})
			return
		content_type = resolve_static_content_type(file_path)
		# HEAD는 존재 여부와 크기만 알면 되므로 파일을 통째로 읽지 않는다.
		# 게임이 27MB짜리 wasm 파일의 접근 가능 여부를 확인할 때 이 경로를 쓴다.
		head_only = self._is_head_request()
		data = b"" if head_only else file_path.read_bytes()
		content_length = file_path.stat().st_size if head_only else len(data)
		self.send_response(HTTPStatus.OK)
		self._send_cors_headers()
		self.send_header("Content-Type", content_type)
		self.send_header("Content-Length", str(content_length))
		self.end_headers()
		if not head_only:
			self.wfile.write(data)


# 명령행 포트 설정을 읽고 ThreadingHTTPServer의 수명주기를 관리하는 실행 진입점이다.
def main() -> None:
	"""명령행 포트를 반영해 Python HTTP 서버를 시작한다."""
	parser = argparse.ArgumentParser(description="Puyo W Python 웹 서버")
	parser.add_argument("port", nargs="?", type=int, help="사용할 포트 번호(기본값: SERVER_CONFIG['port'])")
	args = parser.parse_args()
	# 명령행 인자가 있으면 우선하고, 없으면 SERVER_CONFIG의 기본 포트를 사용한다.
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

