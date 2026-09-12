# Puyo W - AI 인공지능용 학습 모델 (LM Studio 호환) 생성기 - GUI
#
# 이 스크립트에서는 PyTorch 를 이용해 Puyo W 학습 모델을 생성한다.
#    GUI 인터페이스를 제공한다.
#
# 이용을 위한 사전 설치 필요
#
#    python 3.10 이상 버전 (python.org 에서 다운로드)
#    torch, torchvision  ( pip3 install torch torchvision )
#    psutil              ( pip3 install psutil )
#    onnx, onnxscript    ( pip3 install onnx onnxscript )
#
#
# 간단 사용법
#     터미널로 프로젝트 최상위 디렉토리로 접근 후 다음 명령어 사용
#
#     python python/lngui.py
#
#     GUI 창이 뜨면, 모델을 저장할 파일 경로를 입력하고, 에피소드 수와 학습 방식을 지정한 후 "Start"(한국어 표시에서는 "시작") 버튼을 클릭한다.
#     표시 언어는 운영체제 표시 언어를 따라 정해지며, Language(언어) 메뉴에서 English / 한국어로 바꿀 수 있다.
#
#     학습한 모델을 다른 이름이나 ONNX 형식으로 내보내려면 File > Save As... 메뉴를 사용한다.
#     프로그램을 끝낼 때는 File > Exit 메뉴를 쓰면 학습 중이라도 마지막 에피소드까지 저장한 뒤 종료한다.
#
# 의존성
#    common.py
#    bundledenemy.py
#    learning.py
#    PretendardVariable.ttf (한국어 표시용 글꼴. 없으면 시스템 글꼴을 쓴다)
#    torch
#    psutil
#    onnx
#
# Copyright 2026 HJOW
# Licensed under the Apache License, Version 2.0.
#
# See INFO_FOR_AI.md if you are AI.

"""learning.py를 Tkinter GUI로 감싼 학습 도구.

학습은 별도 쓰레드에서 진행하고, 그 쓰레드는 로그·진행 상황을 큐에 적재하기만 한다. 화면을
그리는 메인(Tkinter) 쓰레드는 그 큐를 주기적으로 비우면서 위젯을 갱신하므로, 학습 중에도 창이
멈추지 않는다.

GUI 문구(창 제목·메뉴·버튼·라벨·상태 문구·대화상자·GUI가 남기는 로그)는 MESSAGES 번역표로 영어와
한국어를 지원한다. 처음 언어는 운영체제 표시 언어로 정하고(한국어면 한국어, 그 밖에는 영어),
Language 메뉴로 실행 중에 바꿀 수 있다. 언어를 바꾸면 이미 만든 위젯의 문구와 현재 상태 문구를 새
언어로 다시 적지만, 로그 패널에 이미 적힌 줄은 그대로 둔다. 학습 자체가 남기는 로그(learning.py의
log 콜백 출력)는 언어와 무관하게 한국어다. 문구가 언어마다 달라지므로 동작은 버튼 글자나 메뉴
라벨이 아니라 상태값(_pause_requested)과 메뉴를 만들 때 기록한 인덱스로 판단한다.

한국어 글자가 어느 Windows에서든 같은 모양으로 보이도록, 같은 폴더의 PretendardVariable.ttf를
설치하지 않고 이 프로세스에서만 등록해(AddFontResourceExW, FR_PRIVATE) Tk 이름 글꼴에 적용한다.
등록할 수 없으면 시스템 글꼴을 그대로 쓴다. 또 main()은 창을 띄우기 전에 표준 스트림을 정리해,
콘솔 코드 페이지(cp949 등)에 없는 문자를 출력하거나 pythonw.exe로 실행해 표준 스트림이 없을 때도
작업이 예외로 끝나지 않게 한다(configure_standard_streams 참고).

일시정지·중단은 learning.TrainingControl을 통해 "진행 중인 에피소드가 끝난 뒤"에만 반영되고,
창을 닫아 학습을 포기하는 경우에만 learning.TrainingAbort로 즉시 중단되며 이때는 어떤 파일도
저장하지 않는다. CLI에서 `python python/learning.py ...`로 직접 학습하는 기존 방식은 이 GUI와
무관하게 그대로 동작한다.

Training strategy 콤보박스는 learning.TRAINING_STRATEGIES를 그대로 나열한다. 선택지는 현재 언어의
표시용 라벨(영어 label, 한국어 label_ko)이고 실제로 train()에 넘기는 값은 학습 방식 이름이다.
학습기에 새 방식이 등록되면 이 GUI는 고칠 필요 없이 목록에 함께 나타나며, 학습 중·일시정지 중에는
다른 입력란과 함께 잠긴다. 이 GUI에는 상대 선택란이 없지만, 학습 방식 중에는 상대를 직접 정하는
것도 있다(예: "솔로 플레이"는 연습용 상대와만, "대체 모델과 플레이"는 python/puyow/의 modelNN.pt
체크포인트와 대전한다). 쓸 수 있는 모델 파일이 없는 등 학습을 시작할 수 없는 경우 learning.train()이
예외로 끝나고, _run_training이 그 메시지를 로그·상태 표시로 알린 뒤 잠갔던 조작을 되살린다.

메뉴바에는 File과 Language 두 그룹이 있다. File에는 Save As...와 Exit 두 항목이 있다. Save As...는
학습 중·일시정지 중에는 잠기며, Model output path의 체크포인트를 .pt로 그대로 복사하거나 .onnx로
변환해 내보낸다. Exit는 상태와 무관하게 언제나 누를 수 있고, 학습 중이면 Stop 버튼과 같은 중단
예약을 걸어 마지막 에피소드까지의 결과를 체크포인트에 저장한 뒤 창을 닫는다. 창 오른쪽 위의 닫기
버튼(_on_close)은 예전처럼 저장 없이 즉시 포기하는 경로라서 Exit와 의미가 다르다.

창이 뜬 뒤에는 학습 쓰레드와 별개로 시스템 자원 감시용 데몬 쓰레드도 하나 돌아간다. 이 쓰레드는
psutil로 1초에 한 번 CPU·RAM 점유율만 재서 같은 log_queue에 적재하고, 위젯은 여느 학습 로그와
마찬가지로 _poll_queue가 메인 쓰레드에서만 갱신한다. 창을 닫으면 _closed 플래그로 다음 측정 뒤
루프를 빠져나가며, 데몬 쓰레드라 프로세스 종료를 막지 않는다.
"""

import importlib.util
import locale
import os
import queue
import shutil
import sys
import threading
import tkinter as tk
import tkinter.font as tkfont
from http.server import ThreadingHTTPServer
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Any, Callable
from urllib.parse import urlsplit

import psutil
import torch

import learning
import pythonserver

# 시스템 자원 게이지를 몇 초에 한 번 갱신할지를 결정한다. psutil.cpu_percent(interval=...)가
# 이 시간만큼 블로킹하면서 직접 측정하므로 별도 sleep 없이 정확히 이 주기로 갱신된다.
SYSINFO_POLL_INTERVAL_SEC = 1.0

# GUI 전용 기본값이다. learning.py 자체의 --episodes 기본값(1000)과는 별개로, 요구 사항에 따라
# 창을 열면 5000이 입력된 상태여야 한다.
DEFAULT_EPISODES = 5000

# 서버 주소 입력란의 호스트가 이 목록에 있을 때만 GUI가 직접 pythonserver.py를 띄우고 끈다.
# 원격 주소라면 이미 다른 곳에서 서버를 운영 중이라고 보고 건드리지 않는다.
LOCAL_SERVER_HOSTS = {"localhost", "127.0.0.1", "::1"}

# Save As... 대화상자에서 고를 수 있는 형식이다(번역 키, 파일 패턴). 어느 쪽을 골랐는지는 결과 경로의
# 확장자로 판별하므로, 여기에 형식을 더할 때는 _on_save_as의 확장자 분기도 함께 넓혀야 한다.
SAVE_AS_FILE_PATTERNS = (("filetype_checkpoint", "*.pt"), ("filetype_onnx", "*.onnx"))

# 내보낸 ONNX 모델에서 배치 축에 붙일 이름이다. 입력과 출력 모두 이 이름으로 열어 두어, 한 번에
# 여러 애프터스테이트를 넣어 평가하는 사용처가 그대로 쓸 수 있게 한다.
ONNX_BATCH_AXIS_NAME = "batch"

# 한국어를 지원하는 동봉 글꼴이다. 파일이 없거나 등록할 수 없으면 시스템 글꼴을 그대로 쓴다.
FONT_PATH = Path(__file__).resolve().with_name("PretendardVariable.ttf")
# 위 파일의 name 테이블에 적힌 패밀리 이름이다(기본 인스턴스의 굵기는 400). Tk는 이 이름으로 글꼴을 찾는다.
FONT_FAMILY = "Pretendard Variable"
# 표준 위젯이 참조하는 Tk 이름 글꼴이다. 패밀리만 바꾸면 이 이름을 쓰는 위젯이 모두 따라온다.
# 고정폭인 TkFixedFont는 바꾸지 않고, 로그 패널은 TkTextFont를 직접 지정해 쓴다.
TK_NAMED_FONTS = (
	"TkDefaultFont", "TkTextFont", "TkMenuFont", "TkHeadingFont",
	"TkCaptionFont", "TkSmallCaptionFont", "TkIconFont", "TkTooltipFont",
)
# Windows AddFontResourceExW의 FR_PRIVATE 플래그다. 설치하지 않고 이 프로세스에만 보이게 등록하므로
# 시스템 글꼴 목록을 바꾸지 않고, 프로세스가 끝나면 함께 사라진다.
_FR_PRIVATE = 0x10
# Windows LANGID의 하위 10비트가 주 언어이며, 한국어는 0x12다(0x0412 등).
_WINDOWS_PRIMARY_LANGUAGE_MASK = 0x3FF
_WINDOWS_PRIMARY_LANGUAGE_KOREAN = 0x12
_bundled_font_registered: bool | None = None

LANGUAGE_ENGLISH = "en"
LANGUAGE_KOREAN = "ko"
# Language 메뉴에 보일 이름이다. 지금 어떤 언어로 표시 중이든 자기 언어를 알아볼 수 있도록 번역하지 않는다.
LANGUAGE_NAMES = {LANGUAGE_ENGLISH: "English", LANGUAGE_KOREAN: "한국어"}

# GUI 문구 번역표다. 두 언어의 키와 {자리 표시자}는 같아야 하며 test_learning.py가 이를 확인한다.
# 한국어 표에 없는 키는 영어 문구로 대신한다.
MESSAGES: dict[str, dict[str, str]] = {
	LANGUAGE_ENGLISH: {
		"app_title": "Puyo W Model Trainer",
		"menu_file": "File",
		"menu_save_as": "Save As...",
		"menu_exit": "Exit",
		"menu_language": "Language",
		"label_output": "Model output path:",
		"button_browse": "Browse...",
		"label_episodes": "Episodes:",
		"label_strategy": "Training strategy:",
		"label_server_url": "Server URL:",
		"button_start": "Start",
		"button_pause": "Pause",
		"button_resume": "Resume",
		"button_stop": "Stop",
		"status_idle": "Idle.",
		"status_starting": "Starting...",
		"status_training": "Training...",
		"status_pausing": "Pausing (finishing current episode)...",
		"status_paused": "Paused.",
		"status_stopping": "Stopping (finishing current episode)...",
		"status_stopping_before_exit": "Stopping (finishing current episode) before exit...",
		"status_finishing_before_exit": "Finishing the current task before exit...",
		"status_saving": "Saving model...",
		"status_failed": "Failed.",
		"status_episode": "Episode {done}/{total} (wins={wins}, losses={losses})",
		"dialog_select_checkpoint": "Select checkpoint file",
		"dialog_save_model_as": "Save model as",
		"filetype_checkpoint": "PyTorch checkpoint",
		"filetype_onnx": "ONNX model",
		"filetype_all": "All files",
		"error_episodes": "Episodes must be a positive integer.",
		"error_output_path": "Please choose a model output path.",
		"error_server_port": (
			"Could not start pythonserver.py on port {port}.\n"
			"The port may already be in use by another process.\n\n{error}"
		),
		"log_server_started": "Started local pythonserver.py on port {port}.",
		"log_server_stopping": "Stopping local pythonserver.py...",
		"log_training_start": "Starting training: episodes={episodes} output={output} strategy={strategy} server={server}",
		"log_server_none": "(none)",
		"log_training_done": "Training finished and checkpoint saved.",
		"log_error": "Error: {error}",
		"log_exit_requested": "Exit requested. Saving progress after the current episode...",
		"log_save_as_no_model": "Save As failed: no model file at {path}",
		"log_save_as_bad_extension": "Save As failed: unsupported extension '{extension}'. Choose .pt or .onnx.",
		"log_save_as_same_file": "Save As failed: the destination is the same file as the model output path.",
		"log_save_as_started": "Save As started: {source} -> {destination}",
		"log_save_as_failed": "Save As failed: {error}",
		"log_save_as_finished": "Save As finished: {destination}",
		"progress_copying": "Copying checkpoint to {destination}...",
		"progress_copied": "Saved checkpoint to {destination}",
		"progress_loading": "Loading checkpoint from {source}...",
		"progress_preparing": "Preparing sample input...",
		"progress_converting": "Converting to ONNX...",
		"progress_verifying": "Verifying exported model...",
		"progress_onnx_saved": "Saved ONNX model to {destination}",
		"onnx_requirement": (
			"ONNX export requires the onnx package (and onnxscript for the torch.export based exporter). "
			"Install them with: pip3 install onnx onnxscript"
		),
	},
	LANGUAGE_KOREAN: {
		"app_title": "Puyo W 모델 학습기",
		"menu_file": "파일",
		"menu_save_as": "다른 이름으로 저장...",
		"menu_exit": "종료",
		"menu_language": "언어 (Language)",
		"label_output": "모델 저장 경로:",
		"button_browse": "찾아보기...",
		"label_episodes": "에피소드 수:",
		"label_strategy": "학습 방식:",
		"label_server_url": "서버 주소:",
		"button_start": "시작",
		"button_pause": "일시정지",
		"button_resume": "재개",
		"button_stop": "중단",
		"status_idle": "대기 중.",
		"status_starting": "시작하는 중...",
		"status_training": "학습 중...",
		"status_pausing": "일시정지하는 중 (현재 에피소드를 마치는 중)...",
		"status_paused": "일시정지됨.",
		"status_stopping": "중단하는 중 (현재 에피소드를 마치는 중)...",
		"status_stopping_before_exit": "종료 전에 중단하는 중 (현재 에피소드를 마치는 중)...",
		"status_finishing_before_exit": "종료 전에 진행 중인 작업을 마치는 중...",
		"status_saving": "모델을 저장하는 중...",
		"status_failed": "실패했습니다.",
		"status_episode": "에피소드 {done}/{total} (승 {wins}, 패 {losses})",
		"dialog_select_checkpoint": "체크포인트 파일 선택",
		"dialog_save_model_as": "모델을 다른 이름으로 저장",
		"filetype_checkpoint": "PyTorch 체크포인트",
		"filetype_onnx": "ONNX 모델",
		"filetype_all": "모든 파일",
		"error_episodes": "에피소드 수는 1 이상의 정수여야 합니다.",
		"error_output_path": "모델 저장 경로를 지정하세요.",
		"error_server_port": (
			"{port}번 포트에서 pythonserver.py를 시작하지 못했습니다.\n"
			"다른 프로세스가 이미 이 포트를 쓰고 있을 수 있습니다.\n\n{error}"
		),
		"log_server_started": "{port}번 포트에서 로컬 pythonserver.py를 시작했습니다.",
		"log_server_stopping": "로컬 pythonserver.py를 멈추는 중...",
		"log_training_start": "학습 시작: 에피소드={episodes} 저장 경로={output} 학습 방식={strategy} 서버={server}",
		"log_server_none": "(없음)",
		"log_training_done": "학습을 마치고 체크포인트를 저장했습니다.",
		"log_error": "오류: {error}",
		"log_exit_requested": "종료를 요청했습니다. 현재 에피소드가 끝나면 진행 상황을 저장합니다...",
		"log_save_as_no_model": "다른 이름으로 저장 실패: 모델 파일이 없는 경로입니다: {path}",
		"log_save_as_bad_extension": "다른 이름으로 저장 실패: 지원하지 않는 확장자입니다('{extension}'). .pt 또는 .onnx를 고르세요.",
		"log_save_as_same_file": "다른 이름으로 저장 실패: 저장할 위치가 모델 저장 경로와 같은 파일입니다.",
		"log_save_as_started": "다른 이름으로 저장 시작: {source} -> {destination}",
		"log_save_as_failed": "다른 이름으로 저장 실패: {error}",
		"log_save_as_finished": "다른 이름으로 저장 완료: {destination}",
		"progress_copying": "체크포인트를 복사하는 중: {destination}",
		"progress_copied": "체크포인트를 저장했습니다: {destination}",
		"progress_loading": "체크포인트를 읽는 중: {source}",
		"progress_preparing": "견본 입력을 준비하는 중...",
		"progress_converting": "ONNX로 변환하는 중...",
		"progress_verifying": "내보낸 모델을 검증하는 중...",
		"progress_onnx_saved": "ONNX 모델을 저장했습니다: {destination}",
		"onnx_requirement": (
			"ONNX 변환에는 onnx 패키지가 필요합니다(torch.export 기반 변환에는 onnxscript도 필요합니다). "
			"다음 명령으로 설치하세요: pip3 install onnx onnxscript"
		),
	},
}


def translate(language: str, key: str, **values: Any) -> str:
	"""번역표에서 문구를 찾아 자리 표시자를 채운다. 그 언어에 없는 키는 영어 문구를 쓴다."""
	text = MESSAGES.get(language, {}).get(key) or MESSAGES[LANGUAGE_ENGLISH][key]
	return text.format(**values) if values else text


def language_from_windows_language_id(language_id: int) -> str:
	"""Windows LANGID의 주 언어가 한국어면 한국어를, 그 밖에는 영어를 고른다."""
	if language_id & _WINDOWS_PRIMARY_LANGUAGE_MASK == _WINDOWS_PRIMARY_LANGUAGE_KOREAN:
		return LANGUAGE_KOREAN
	return LANGUAGE_ENGLISH


def language_from_locale_name(name: str | None) -> str:
	"""`ko_KR.UTF-8`, `Korean_Korea` 같은 로캘 이름이 한국어면 한국어를, 그 밖에는 영어를 고른다."""
	lowered = (name or "").lower()
	if lowered == "ko" or lowered.startswith(("ko_", "ko-", "ko.", "korean")):
		return LANGUAGE_KOREAN
	return LANGUAGE_ENGLISH


def detect_language() -> str:
	"""운영체제 표시 언어로 처음 보여 줄 언어를 정한다.

	Windows는 로캘(숫자·날짜 형식)과 표시 언어가 따로 설정되므로, 메뉴·대화상자가 쓰는 표시 언어
	(GetUserDefaultUILanguage)를 기준으로 삼는다. 그 밖의 운영체제는 LC_ALL·LC_MESSAGES·LANG 환경
	변수와 로캘 이름을 본다.
	"""
	if sys.platform == "win32":
		try:
			import ctypes

			return language_from_windows_language_id(ctypes.windll.kernel32.GetUserDefaultUILanguage())
		except (AttributeError, OSError):
			pass
	for variable in ("LC_ALL", "LC_MESSAGES", "LANG"):
		if os.environ.get(variable):
			return language_from_locale_name(os.environ[variable])
	return language_from_locale_name(locale.getlocale()[0])


def register_bundled_font() -> bool:
	"""동봉 글꼴(FONT_PATH)을 이 프로세스에서만 쓸 수 있게 등록하고, 성공했는지 돌려준다.

	Tk는 글꼴 파일을 직접 읽지 못하므로 Windows에서는 GDI에 FR_PRIVATE로 등록한다. 등록은 프로세스마다
	한 번만 하고 결과를 기억한다. 다른 운영체제는 등록하지 않고 시스템 글꼴을 쓴다.
	"""
	global _bundled_font_registered
	if _bundled_font_registered is None:
		_bundled_font_registered = False
		if sys.platform == "win32" and FONT_PATH.is_file():
			try:
				import ctypes

				# 경로에 한글이 있어도 되도록 유니코드(W) 판을 쓴다.
				_bundled_font_registered = ctypes.windll.gdi32.AddFontResourceExW(str(FONT_PATH), _FR_PRIVATE, 0) > 0
			except (AttributeError, OSError):
				_bundled_font_registered = False
	return _bundled_font_registered


def configure_standard_streams() -> None:
	"""Windows에서 표준 출력의 문자 집합 때문에 GUI 작업이 실패하지 않도록 표준 스트림을 정리한다.

	- pythonw.exe로 띄우면 콘솔이 없어 sys.stdout·sys.stderr가 None이다. http.server의 요청 로그처럼
	  곧바로 write()를 부르는 코드가 AttributeError로 죽지 않도록 버리는 스트림을 달아 둔다.
	- 출력을 파이프·파일로 넘기면 인코딩이 cp949 같은 ANSI 코드 페이지가 된다. torch·onnx가 찍는
	  이모지처럼 그 코드 페이지에 없는 문자를 만나면 UnicodeEncodeError로 작업 전체가 실패하므로,
	  받는 쪽이 계속 읽을 수 있게 인코딩은 그대로 두고 표현할 수 없는 문자만 `\\uXXXX` 형태로 바꿔 쓴다.
	  실제 콘솔에 붙어 있으면 파이썬이 이미 UTF-8로 쓰므로 건드리지 않는다.
	"""
	for name in ("stdout", "stderr"):
		stream = getattr(sys, name)
		if stream is None:
			setattr(sys, name, open(os.devnull, "w", encoding="utf-8"))
			continue
		encoding = (getattr(stream, "encoding", None) or "").lower().replace("-", "").replace("_", "")
		if encoding != "utf8" and callable(getattr(stream, "reconfigure", None)):
			stream.reconfigure(errors="backslashreplace")


def _report_progress(progress: Callable[[int, str], None] | None, percent: int, message: str) -> None:
	"""진행 콜백이 있으면 (진행률, 상태 문구)를 전달한다. 콜백이 없으면 아무 일도 하지 않는다."""
	if progress is not None:
		progress(percent, message)


def save_checkpoint_copy(
	source: Path, destination: Path, progress: Callable[[int, str], None] | None = None,
	language: str = LANGUAGE_ENGLISH,
) -> None:
	"""학습 체크포인트를 그대로 다른 경로에 복사한다.

	파일 내용을 전혀 손대지 않으므로 복사본도 learning.py·pythonserver.py가 읽는 기존 체크포인트
	형식 그대로다. 원본 파일도 읽기만 한다. `language`는 진행 문구의 언어다.
	"""
	_report_progress(progress, 10, translate(language, "progress_copying", destination=destination))
	destination.parent.mkdir(parents=True, exist_ok=True)
	shutil.copy2(source, destination)
	_report_progress(progress, 100, translate(language, "progress_copied", destination=destination))


def export_checkpoint_to_onnx(
	source: Path, destination: Path, progress: Callable[[int, str], None] | None = None,
	language: str = LANGUAGE_ENGLISH,
) -> None:
	"""학습 체크포인트를 ONNX 모델로 변환해 저장한다.

	원본 체크포인트는 읽기만 하고 형식도 바꾸지 않으므로, 기존 모델 호환성에는 영향이 없다.
	`progress`는 (0~100 진행률, 상태 문구)를 받는 콜백이며 GUI가 게이지바와 로그를 갱신하는 데
	쓴다. 변환 자체는 한 번의 torch.onnx.export 호출이라 중간 진행률을 물어볼 수 없어서, 실제로
	시간을 쓰는 단계(체크포인트 로드 → 변환 → 검증)의 경계마다 진행률을 올린다. `language`는 진행
	문구와 설치 안내의 언어다.
	"""
	# onnx는 두 내보내기 방식 모두가 요구한다. 없으면 변환을 시작하기 전에 설치 방법을 알린다.
	if importlib.util.find_spec("onnx") is None:
		raise RuntimeError(translate(language, "onnx_requirement"))
	_report_progress(progress, 5, translate(language, "progress_loading", source=source))
	# load_policy_checkpoint()가 모델 버전·관측값·행동 계약까지 검증하므로, 형식이 다른 파일은
	# 여기서 걸러져 어중간한 ONNX 파일이 만들어지지 않는다.
	policy = learning.load_policy_checkpoint(source, torch.device("cpu"))
	_report_progress(progress, 30, translate(language, "progress_preparing"))
	# ValueNetwork.forward()는 (배치, OBSERVATION_SIZE) 모양을 받는다. 배치 축만 동적으로 열어 둔다.
	sample = torch.zeros(1, learning.OBSERVATION_SIZE, dtype=torch.float32)
	_report_progress(progress, 45, translate(language, "progress_converting"))
	destination.parent.mkdir(parents=True, exist_ok=True)
	if importlib.util.find_spec("onnxscript") is not None:
		# torch 2.9부터 기본이 된 torch.export 기반 내보내기다. external_data를 끄지 않으면 가중치를
		# 옆의 .onnx.data 파일로 빼기 때문에, 고른 위치의 파일 하나만 옮기면 모델이 깨진다.
		export_options = {
			"dynamo": True, "external_data": False,
			"dynamic_shapes": ({0: ONNX_BATCH_AXIS_NAME},),
		}
	else:
		# onnxscript가 없는 환경에서는 예전 TorchScript 방식으로 같은 그래프를 내보낸다.
		export_options = {
			"dynamo": False,
			"dynamic_axes": {
				"observation": {0: ONNX_BATCH_AXIS_NAME}, "value": {0: ONNX_BATCH_AXIS_NAME},
			},
		}
	torch.onnx.export(
		policy, (sample,), str(destination),
		input_names=["observation"], output_names=["value"],
		# 변환 단계를 표준 출력에 찍지 않는다. 진행은 progress 콜백으로 알린다. torch.export 기반 변환이
		# 단계마다 찍는 체크 표시 이모지는 cp949 출력에서 UnicodeEncodeError를 일으켜 변환 전체를 실패시켰다.
		verbose=False,
		**export_options,
	)
	_report_progress(progress, 85, translate(language, "progress_verifying"))
	# 선택 의존성이라 모듈 최상단이 아니라 설치 여부를 확인한 뒤 여기서만 불러온다.
	import onnx

	model = onnx.load(str(destination))
	# ValueNetwork.forward()가 마지막에 reshape(-1)로 1차원을 만들기 때문에, torch.export 기반
	# 내보내기는 출력 축을 견본 배치 크기인 1로 고정해 적는다. 그래프 자체는 배치를 그대로 흘려
	# 보내므로, 입력과 같은 동적 축 이름으로 고쳐 적어 사용처가 배치 추론을 거부하지 않게 한다.
	output_dimension = model.graph.output[0].type.tensor_type.shape.dim[0]
	if not output_dimension.dim_param:
		output_dimension.dim_param = ONNX_BATCH_AXIS_NAME
		onnx.save(model, str(destination))
	onnx.checker.check_model(model)
	_report_progress(progress, 100, translate(language, "progress_onnx_saved", destination=destination))


def _parse_local_server_port(server_url: str) -> int | None:
	"""server_url이 로컬 주소를 가리키면 그 포트를, 아니면 None을 반환한다."""
	if not server_url:
		return None
	try:
		parsed = urlsplit(server_url)
	except ValueError:
		return None
	if (parsed.hostname or "").lower() not in LOCAL_SERVER_HOSTS:
		return None
	if parsed.port is not None:
		return parsed.port
	return 443 if parsed.scheme == "https" else 80


class TrainerApp:
	"""학습 진행을 시작·일시정지·재개·중단할 수 있는 Tkinter 메인 창."""

	def __init__(self, root: tk.Tk, language: str | None = None) -> None:
		"""창을 구성한다. `language`를 생략하면 운영체제 표시 언어(detect_language)를 따른다."""
		self.root = root
		self.language = language if language is not None else detect_language()
		if self.language not in LANGUAGE_NAMES:
			raise ValueError(f"지원하지 않는 언어입니다: {self.language}")
		self.root.geometry("720x580")
		self.root.minsize(560, 480)

		self.log_queue: "queue.Queue[tuple]" = queue.Queue()
		self.control: learning.TrainingControl | None = None
		self.thread: threading.Thread | None = None
		self.server: ThreadingHTTPServer | None = None
		self.server_thread: threading.Thread | None = None
		self.sysinfo_thread: threading.Thread | None = None
		# Save As...가 띄우는 저장·변환 쓰레드다. 한 번에 하나만 돌고, 끝나면 큐로 결과를 알린다.
		self.save_thread: threading.Thread | None = None
		# File > Exit로 종료 절차에 들어갔는지를 나타낸다. 학습·저장이 끝나기를 기다리는 동안
		# 켜져 있으며, 이 값이 켜져 있으면 완료 처리에서 잠근 버튼을 다시 살리지 않는다.
		self._exit_pending = False
		# ONNX 변환에 게이지바를 잠시 빌려 쓰기 전의 (maximum, value)를 담아 둔다. 변환이 끝나면
		# 이 값으로 되돌려, 직전 학습 진행 표시가 그대로 남아 있게 한다.
		self._progress_backup: tuple | None = None
		self._closed = False
		# 일시정지를 요청해 Pause 버튼이 Resume 역할을 하는 중인지 나타낸다. 버튼 글자는 언어마다
		# 다르므로 글자 대신 이 값으로 판단한다.
		self._pause_requested = False
		# 언어를 바꿀 때 다시 적을 현재 상태 문구(번역 키, 값)다. 이미 번역되어 온 저장 진행 문구를
		# 보여 줄 때는 None이며, 그 문구는 다음 갱신 때까지 원래 언어로 남는다.
		self._status: tuple[str, dict[str, Any]] | None = ("status_idle", {})
		# 언어를 바꿀 때 문구를 다시 적을 위젯(위젯, 키)과 메뉴 항목(메뉴, 인덱스, 키) 목록이다.
		self._text_widgets: list[tuple[Any, str]] = []
		self._menu_texts: list[tuple[tk.Menu, int, str]] = []

		# 위젯이 만들어지기 전에 이름 글꼴을 바꿔야 처음 그릴 때부터 같은 글꼴로 배치된다.
		self.font_family = self._apply_bundled_font()
		self._build_menu()
		self._build_widgets()
		self._apply_texts(learning.DEFAULT_TRAINING_STRATEGY)
		self.root.protocol("WM_DELETE_WINDOW", self._on_close)
		self.root.after(100, self._poll_queue)
		self._start_sysinfo_monitor()

	# ------------------------------------------------------------------
	# 언어·글꼴
	# ------------------------------------------------------------------
	def _t(self, key: str, **values: Any) -> str:
		"""현재 언어로 번역한 문구를 돌려준다."""
		return translate(self.language, key, **values)

	def _apply_bundled_font(self) -> str | None:
		"""동봉 글꼴을 쓸 수 있으면 Tk 이름 글꼴의 패밀리를 모두 그 글꼴로 바꾸고 패밀리 이름을 돌려준다.

		크기는 시스템 기본값을 그대로 둬 창 배치가 달라지지 않게 한다. 등록에 실패하거나 Tk가 글꼴을
		찾지 못하면 아무것도 바꾸지 않고 None을 돌려준다. Windows의 메뉴바는 운영체제가 직접 그리므로
		이 설정과 무관하게 시스템 글꼴로 표시된다.
		"""
		if not register_bundled_font() or FONT_FAMILY not in tkfont.families(self.root):
			return None
		for name in TK_NAMED_FONTS:
			try:
				tkfont.nametofont(name, root=self.root).configure(family=FONT_FAMILY)
			except tk.TclError:
				continue
		return FONT_FAMILY

	def _strategy_label(self, strategy: learning.TrainingStrategy) -> str:
		"""학습 방식의 현재 언어 표시 이름이다. 한국어 이름이 비어 있으면 영어 이름을 쓴다."""
		if self.language == LANGUAGE_KOREAN:
			return strategy.label_ko or strategy.label
		return strategy.label

	def _strategy_summary(self, strategy: learning.TrainingStrategy) -> str:
		"""학습 방식의 현재 언어 설명이다. 한국어는 CLI 도움말과 같은 description을 쓴다."""
		return strategy.description if self.language == LANGUAGE_KOREAN else strategy.summary

	def _translated(self, widget: Any, key: str) -> Any:
		"""위젯에 번역 문구를 달고, 언어를 바꿀 때 다시 적을 수 있게 기록한 뒤 위젯을 돌려준다."""
		widget.configure(text=self._t(key))
		self._text_widgets.append((widget, key))
		return widget

	def _pause_button_key(self) -> str:
		"""일시정지 요청 여부에 맞는 Pause/Resume 버튼 문구 키다."""
		return "button_resume" if self._pause_requested else "button_pause"

	def _apply_texts(self, strategy_name: str) -> None:
		"""현재 언어로 창 제목·메뉴·위젯·학습 방식 목록·상태 문구를 모두 다시 적는다.

		콤보박스 라벨도 언어에 따라 바뀌므로, 고른 학습 방식은 라벨이 아니라 `strategy_name`으로 받아
		새 언어의 라벨로 다시 고른다.
		"""
		self.root.title(self._t("app_title"))
		for menu, index, key in self._menu_texts:
			menu.entryconfigure(index, label=self._t(key))
		for widget, key in self._text_widgets:
			widget.configure(text=self._t(key))
		self.pause_button.configure(text=self._t(self._pause_button_key()))
		strategies = learning.TRAINING_STRATEGIES
		self._strategy_names_by_label = {self._strategy_label(strategy): name for name, strategy in strategies.items()}
		self.strategy_combobox.configure(values=list(self._strategy_names_by_label))
		self.strategy_var.set(self._strategy_label(strategies[strategy_name]))
		self._on_strategy_selected()
		if self._status is not None:
			key, values = self._status
			self.status_var.set(self._t(key, **values))

	def set_language(self, language: str) -> None:
		"""표시 언어를 바꾸고, 이미 만든 위젯의 문구를 모두 새 언어로 다시 적는다."""
		if language not in LANGUAGE_NAMES:
			raise ValueError(f"지원하지 않는 언어입니다: {language}")
		# 라벨이 바뀌기 전에 지금 고른 학습 방식을 이름으로 기억해 둔다.
		strategy_name = self._selected_strategy_name()
		self.language = language
		self.language_var.set(language)
		self._apply_texts(strategy_name)

	def _on_language_selected(self) -> None:
		"""Language 메뉴에서 고른 언어로 바꾼다."""
		self.set_language(self.language_var.get())

	def _set_status(self, key: str, **values: Any) -> None:
		"""번역 키로 상태 문구를 적고, 언어를 바꿀 때 다시 적을 수 있게 기억한다."""
		self._status = (key, values)
		self.status_var.set(self._t(key, **values))

	def _set_status_text(self, text: str) -> None:
		"""이미 번역된 문구(저장 진행 안내)를 그대로 상태에 적는다."""
		self._status = None
		self.status_var.set(text)

	# ------------------------------------------------------------------
	# 화면 구성
	# ------------------------------------------------------------------
	def _build_menu(self) -> None:
		"""File·Language 두 그룹이 있는 메뉴바를 만든다.

		메뉴 문구는 언어에 따라 바뀌므로 항목을 켜고 끄거나 문구를 다시 적을 때는 라벨이 아니라 만들 때
		기록한 인덱스를 쓴다. 인덱스를 추가 직후 index("end")로 받으므로 항목 순서를 바꿔도 상태 처리
		코드를 함께 고칠 필요가 없다. Save As...는 학습 중·일시정지 중에 잠기고, Exit는 상태 변화로는
		잠기지 않는다(종료 절차 자체를 시작한 뒤에만 _disable_all_controls가 함께 잠근다). Language는
		언제든 바꿀 수 있다.
		"""
		self.menubar = tk.Menu(self.root)
		self.file_menu = tk.Menu(self.menubar, tearoff=0)
		self.file_menu.add_command(label=self._t("menu_save_as"), command=self._on_save_as)
		self._save_as_menu_index = self.file_menu.index("end")
		self.file_menu.add_command(label=self._t("menu_exit"), command=self._on_exit_menu)
		self._exit_menu_index = self.file_menu.index("end")
		self.menubar.add_cascade(label=self._t("menu_file"), menu=self.file_menu)
		self._file_cascade_index = self.menubar.index("end")

		self.language_menu = tk.Menu(self.menubar, tearoff=0)
		self.language_var = tk.StringVar(value=self.language)
		for code, name in LANGUAGE_NAMES.items():
			self.language_menu.add_radiobutton(
				label=name, value=code, variable=self.language_var, command=self._on_language_selected,
			)
		self.menubar.add_cascade(label=self._t("menu_language"), menu=self.language_menu)
		self._language_cascade_index = self.menubar.index("end")
		self._menu_texts.extend((
			(self.file_menu, self._save_as_menu_index, "menu_save_as"),
			(self.file_menu, self._exit_menu_index, "menu_exit"),
			(self.menubar, self._file_cascade_index, "menu_file"),
			(self.menubar, self._language_cascade_index, "menu_language"),
		))
		self.root.configure(menu=self.menubar)

	def _build_widgets(self) -> None:
		"""입력란·버튼·진행 표시·로그·자원 게이지를 배치한다. 번역 문구는 _translated로 기록한다."""
		padding = {"padx": 8, "pady": 4}

		form = ttk.Frame(self.root)
		form.grid(row=0, column=0, sticky="ew")
		form.columnconfigure(1, weight=1)
		self.root.columnconfigure(0, weight=1)

		self._translated(ttk.Label(form), "label_output").grid(row=0, column=0, sticky="w", **padding)
		self.output_var = tk.StringVar(value=str(learning.DEFAULT_OUTPUT))
		self.output_entry = ttk.Entry(form, textvariable=self.output_var)
		self.output_entry.grid(row=0, column=1, sticky="ew", **padding)
		self.browse_button = self._translated(ttk.Button(form, command=self._on_browse_output), "button_browse")
		self.browse_button.grid(row=0, column=2, **padding)

		self._translated(ttk.Label(form), "label_episodes").grid(row=1, column=0, sticky="w", **padding)
		self.episodes_var = tk.StringVar(value=str(DEFAULT_EPISODES))
		self.episodes_entry = ttk.Entry(form, textvariable=self.episodes_var)
		self.episodes_entry.grid(row=1, column=1, sticky="ew", **padding)

		# 학습 방식은 앞으로 늘어날 수 있으므로 등록표를 그대로 읽는 읽기 전용 콤보박스로 고르게 한다.
		# 선택지와 설명은 언어에 따라 달라지므로 _apply_texts가 채운다.
		self._translated(ttk.Label(form), "label_strategy").grid(row=2, column=0, sticky="w", **padding)
		self._strategy_names_by_label: dict[str, str] = {}
		self.strategy_var = tk.StringVar(value="")
		self.strategy_combobox = ttk.Combobox(form, textvariable=self.strategy_var, state="readonly")
		self.strategy_combobox.grid(row=2, column=1, columnspan=2, sticky="ew", **padding)
		self.strategy_combobox.bind("<<ComboboxSelected>>", self._on_strategy_selected)
		self.strategy_summary_var = tk.StringVar(value="")
		ttk.Label(form, textvariable=self.strategy_summary_var, foreground="gray40", wraplength=560).grid(
			row=3, column=1, columnspan=2, sticky="w", padx=8,
		)

		server_url_label = self._translated(ttk.Label(form), "label_server_url")
		server_url_label.grid(row=4, column=0, sticky="w", **padding)
		self.server_url_var = tk.StringVar(value="")
		self.server_url_entry = ttk.Entry(form, textvariable=self.server_url_var)
		self.server_url_entry.grid(row=4, column=1, columnspan=2, sticky="ew", **padding)
		server_url_label.grid_remove()
		self.server_url_entry.grid_remove()

		buttons = ttk.Frame(self.root)
		buttons.grid(row=1, column=0, sticky="ew", **padding)
		self.start_button = self._translated(ttk.Button(buttons, command=self._on_start), "button_start")
		self.start_button.pack(side="left", padx=4)
		# Pause 버튼 문구는 일시정지 요청 여부에 따라 달라지므로 _apply_texts가 따로 적는다.
		self.pause_button = ttk.Button(buttons, command=self._on_pause_resume, state="disabled")
		self.pause_button.pack(side="left", padx=4)
		self.stop_button = self._translated(ttk.Button(buttons, command=self._on_stop, state="disabled"), "button_stop")
		self.stop_button.pack(side="left", padx=4)

		self.progress = ttk.Progressbar(self.root, orient="horizontal", mode="determinate")
		self.progress.grid(row=2, column=0, sticky="ew", **padding)

		self.status_var = tk.StringVar(value="")
		ttk.Label(self.root, textvariable=self.status_var).grid(row=3, column=0, sticky="w", **padding)

		log_frame = ttk.Frame(self.root)
		log_frame.grid(row=4, column=0, sticky="nsew", **padding)
		self.root.rowconfigure(4, weight=1)
		scrollbar = ttk.Scrollbar(log_frame)
		scrollbar.pack(side="right", fill="y")
		# tk.Text의 기본 글꼴은 고정폭(TkFixedFont)이라 한글 모양이 들쭉날쭉하므로, 동봉 글꼴이 적용되는
		# TkTextFont를 지정한다. 학습 로그는 한국어로 남는다.
		self.log_text = tk.Text(
			log_frame, height=16, state="disabled", wrap="word", font="TkTextFont", yscrollcommand=scrollbar.set,
		)
		self.log_text.pack(side="left", fill="both", expand=True)
		scrollbar.config(command=self.log_text.yview)

		sysinfo_frame = ttk.Frame(self.root)
		sysinfo_frame.grid(row=5, column=0, sticky="ew", **padding)
		sysinfo_frame.columnconfigure(1, weight=1)

		ttk.Label(sysinfo_frame, text="CPU:").grid(row=0, column=0, sticky="w", padx=(0, 4))
		self.cpu_gauge = ttk.Progressbar(sysinfo_frame, orient="horizontal", mode="determinate", maximum=100)
		self.cpu_gauge.grid(row=0, column=1, sticky="ew", padx=4)
		self.cpu_var = tk.StringVar(value="0.0%")
		ttk.Label(sysinfo_frame, textvariable=self.cpu_var, width=6, anchor="e").grid(row=0, column=2, sticky="e")

		ttk.Label(sysinfo_frame, text="RAM:").grid(row=1, column=0, sticky="w", padx=(0, 4))
		self.ram_gauge = ttk.Progressbar(sysinfo_frame, orient="horizontal", mode="determinate", maximum=100)
		self.ram_gauge.grid(row=1, column=1, sticky="ew", padx=4)
		self.ram_var = tk.StringVar(value="0.0%")
		ttk.Label(sysinfo_frame, textvariable=self.ram_var, width=6, anchor="e").grid(row=1, column=2, sticky="e")

	# ------------------------------------------------------------------
	# 입력 도우미
	# ------------------------------------------------------------------
	def _on_browse_output(self) -> None:
		current = Path(self.output_var.get()) if self.output_var.get().strip() else learning.DEFAULT_OUTPUT
		path = filedialog.asksaveasfilename(
			title=self._t("dialog_select_checkpoint"),
			defaultextension=".pt",
			filetypes=[(self._t("filetype_checkpoint"), "*.pt"), (self._t("filetype_all"), "*.*")],
			initialdir=str(current.parent) if str(current.parent) else None,
			initialfile=current.name or "default.pt",
		)
		if path:
			self.output_var.set(path)

	def _selected_strategy_name(self) -> str:
		"""콤보박스에서 고른 라벨을 learning.train()에 넘길 학습 방식 이름으로 바꾼다."""
		return self._strategy_names_by_label.get(self.strategy_var.get(), learning.DEFAULT_TRAINING_STRATEGY)

	def _on_strategy_selected(self, _event: object = None) -> None:
		"""고른 학습 방식의 설명을 콤보박스 아래에 보여 준다."""
		strategy = learning.TRAINING_STRATEGIES[self._selected_strategy_name()]
		self.strategy_summary_var.set(self._strategy_summary(strategy))

	def _append_log(self, message: str) -> None:
		self.log_text.configure(state="normal")
		self.log_text.insert("end", message + "\n")
		self.log_text.see("end")
		self.log_text.configure(state="disabled")

	def _set_inputs_enabled(self, enabled: bool) -> None:
		state = "normal" if enabled else "disabled"
		self.output_entry.configure(state=state)
		self.browse_button.configure(state=state)
		self.episodes_entry.configure(state=state)
		# 콤보박스를 "normal"로 두면 목록에 없는 글자를 직접 입력할 수 있으므로 켤 때도 읽기 전용이다.
		self.strategy_combobox.configure(state="readonly" if enabled else "disabled")
		self.server_url_entry.configure(state=state)

	def _set_save_as_enabled(self, enabled: bool) -> None:
		"""File > Save As... 항목만 켜고 끈다. 학습 중·일시정지 중과 저장 작업 중에는 꺼 둔다."""
		self.file_menu.entryconfigure(self._save_as_menu_index, state="normal" if enabled else "disabled")

	def _disable_all_controls(self) -> None:
		"""종료 절차에 들어갈 때 모든 버튼·입력·메뉴를 잠가 추가 조작을 막는다.

		Exit는 평소 상태 변화로는 잠기지 않지만, 종료 절차가 두 번 겹쳐 돌지 않도록 여기서만
		함께 잠근다. 어차피 이 시점 이후에는 창이 닫히는 것 외에 할 일이 없다.
		"""
		self.start_button.configure(state="disabled")
		self.pause_button.configure(state="disabled")
		self.stop_button.configure(state="disabled")
		self._set_inputs_enabled(False)
		self._set_save_as_enabled(False)
		self.file_menu.entryconfigure(self._exit_menu_index, state="disabled")

	def _is_busy(self) -> bool:
		"""학습 쓰레드나 저장·변환 쓰레드가 아직 돌고 있는지 확인한다."""
		return any(
			thread is not None and thread.is_alive() for thread in (self.thread, self.save_thread)
		)

	# ------------------------------------------------------------------
	# 로컬 pythonserver.py 수명주기
	# ------------------------------------------------------------------
	def _start_local_server(self, port: int) -> None:
		"""이 포트에 pythonserver.py를 백그라운드 쓰레드로 띄운다.

		ThreadingHTTPServer 생성자가 소켓 바인딩까지 동기적으로 수행하므로, 이미 다른
		프로세스가 그 포트를 점유하고 있으면 학습 쓰레드를 시작하기 전에 OSError가 그대로
		올라온다. 호출부(_on_start)는 이를 잡아 학습 시작 자체를 취소한다.
		"""
		server = ThreadingHTTPServer(("", port), pythonserver.PuyoRequestHandler)
		thread = threading.Thread(target=server.serve_forever, daemon=True)
		thread.start()
		self.server = server
		self.server_thread = thread

	def _stop_local_server(self) -> None:
		"""GUI가 띄운 로컬 서버가 있으면 멈추고 소켓을 닫는다. 없으면 아무 일도 하지 않는다."""
		if self.server is None:
			return
		self._append_log(self._t("log_server_stopping"))
		self.server.shutdown()
		self.server.server_close()
		self.server = None
		self.server_thread = None

	# ------------------------------------------------------------------
	# CPU/RAM 점유율 감시
	# ------------------------------------------------------------------
	def _start_sysinfo_monitor(self) -> None:
		"""CPU·RAM 점유율을 1초마다 재는 데몬 쓰레드를 시작한다. 위젯은 직접 건드리지 않는다."""
		thread = threading.Thread(target=self._sysinfo_loop, daemon=True)
		thread.start()
		self.sysinfo_thread = thread

	def _sysinfo_loop(self) -> None:
		while not self._closed:
			cpu_percent = psutil.cpu_percent(interval=SYSINFO_POLL_INTERVAL_SEC)
			ram_percent = psutil.virtual_memory().percent
			if self._closed:
				return
			self.log_queue.put(("sysinfo", cpu_percent, ram_percent))

	# ------------------------------------------------------------------
	# File 메뉴 (다른 이름으로 저장 / 종료)
	# ------------------------------------------------------------------
	def _on_save_as(self) -> None:
		"""File > Save As... : 현재 체크포인트를 다른 이름(.pt) 또는 ONNX(.onnx)로 내보낸다.

		Model output path의 파일이 실제로 있어야만 대화상자를 연다. 대화상자를 취소하거나 그냥
		닫으면 아무 일도 하지 않는다. 실제 저장·변환은 창이 멈추지 않도록 별도 쓰레드에서 한다.
		"""
		source_text = self.output_var.get().strip()
		source = Path(source_text) if source_text else learning.DEFAULT_OUTPUT
		if not source.is_file():
			# 아직 한 번도 학습하지 않았거나 경로를 잘못 적은 경우다. 로그로만 알리고 끝낸다.
			self._append_log(self._t("log_save_as_no_model", path=source))
			return

		destination_text = filedialog.asksaveasfilename(
			# parent를 지정해야 이 창에 묶인 모달 대화상자로 뜬다.
			parent=self.root,
			title=self._t("dialog_save_model_as"),
			defaultextension=".pt",
			filetypes=[(self._t(key), pattern) for key, pattern in SAVE_AS_FILE_PATTERNS],
			initialdir=str(source.parent) if str(source.parent) else None,
			initialfile=source.name,
		)
		if not destination_text:
			# 취소했거나 대화상자를 그냥 닫았다.
			return

		destination = Path(destination_text)
		suffix = destination.suffix.lower()
		if suffix not in (".pt", ".onnx"):
			self._append_log(self._t("log_save_as_bad_extension", extension=destination.suffix))
			return
		if destination.resolve() == source.resolve():
			# 원본과 같은 파일로 저장하면 복사가 실패한다. 미리 걸러 안내한다.
			self._append_log(self._t("log_save_as_same_file"))
			return

		as_onnx = suffix == ".onnx"
		self.start_button.configure(state="disabled")
		# 변환이 끝나기 전에 같은 메뉴가 다시 열려 두 작업이 같은 파일에 겹쳐 쓰지 않도록 막는다.
		self._set_save_as_enabled(False)
		if as_onnx:
			# 변환 진행률을 보여 주려고 게이지바를 잠시 빌린다. 끝나면 원래 표시로 되돌린다.
			self._progress_backup = (self.progress.cget("maximum"), self.progress.cget("value"))
			self.progress.configure(maximum=100, value=0)
		self._set_status("status_saving")
		self._append_log(self._t("log_save_as_started", source=source, destination=destination))

		self.save_thread = threading.Thread(
			target=self._run_save_as, args=(source, destination, as_onnx), daemon=True,
		)
		self.save_thread.start()

	def _run_save_as(self, source: Path, destination: Path, as_onnx: bool) -> None:
		"""백그라운드 저장·변환 쓰레드. 위젯을 직접 건드리지 않고 큐에만 결과를 적재한다."""

		def report(percent: int, message: str) -> None:
			self.log_queue.put(("saveas_progress", percent, message))

		# 진행 문구는 이 작업을 시작한 시점의 언어로 만든다.
		language = self.language
		try:
			if as_onnx:
				export_checkpoint_to_onnx(source, destination, report, language=language)
			else:
				save_checkpoint_copy(source, destination, report, language=language)
		except Exception as error:
			self.log_queue.put(("saveas_error", str(error)))
			return
		self.log_queue.put(("saveas_done", str(destination)))

	def _finish_save_as(self) -> None:
		"""저장·변환이 끝난 뒤 게이지바를 원래대로 돌리고 잠갔던 조작을 되살린다."""
		if self._progress_backup is not None:
			maximum, value = self._progress_backup
			self.progress.configure(maximum=maximum, value=value)
			self._progress_backup = None
		self.save_thread = None
		if self._exit_pending:
			# 종료 절차 중이면 잠긴 상태를 그대로 두고, _poll_queue가 창을 닫게 맡긴다.
			return
		self.start_button.configure(state="normal")
		self._set_save_as_enabled(True)

	def _on_exit_menu(self) -> None:
		"""File > Exit : 학습 중이면 마지막 에피소드까지 저장한 뒤 프로그램을 끝낸다.

		Stop 버튼과 같은 중단 예약을 걸어 learning.train()이 체크포인트를 저장하고 정상적으로
		빠져나오게 한 다음, 그 완료 신호를 _poll_queue에서 받아 창을 닫는다. 창 오른쪽 위의 닫기
		버튼(_on_close)이 하는 강제 포기와 달리 학습 결과를 버리지 않는다.
		"""
		# 종료를 시작하면 되돌릴 수 없으므로 먼저 모든 버튼과 메뉴를 잠가 추가 조작을 막는다.
		self._disable_all_controls()
		self._exit_pending = True
		if self.control is not None and self.thread is not None and self.thread.is_alive():
			# 일시정지 중이어도 request_stop()이 대기를 함께 풀어 주므로 그대로 예약하면 된다.
			self._set_status("status_stopping_before_exit")
			self._append_log(self._t("log_exit_requested"))
			self.control.request_stop()
			return
		if self._is_busy():
			# 학습은 아니지만 Save As 작업이 남아 있으면 파일이 깨지지 않게 끝날 때까지 기다린다.
			self._set_status("status_finishing_before_exit")
			return
		self._shutdown()

	def _shutdown(self) -> None:
		"""로컬 서버를 정리하고 창을 닫아 프로그램을 끝낸다."""
		self._closed = True
		if self.server is not None:
			self.server.shutdown()
			self.server.server_close()
			self.server = None
			self.server_thread = None
		self.root.destroy()

	# ------------------------------------------------------------------
	# 학습 시작/일시정지/재개/중단
	# ------------------------------------------------------------------
	def _on_start(self) -> None:
		try:
			episodes = int(self.episodes_var.get().strip())
			if episodes < 1:
				raise ValueError
		except ValueError:
			messagebox.showerror(self._t("app_title"), self._t("error_episodes"))
			return
		output_text = self.output_var.get().strip()
		if not output_text:
			messagebox.showerror(self._t("app_title"), self._t("error_output_path"))
			return

		output_path = Path(output_text)
		server_url = self.server_url_var.get().strip()
		strategy_name = self._selected_strategy_name()

		local_port = _parse_local_server_port(server_url)
		if local_port is not None:
			try:
				self._start_local_server(local_port)
			except OSError as error:
				messagebox.showerror(self._t("app_title"), self._t("error_server_port", port=local_port, error=error))
				return
			self._append_log(self._t("log_server_started", port=local_port))

		self.control = learning.TrainingControl()
		self.progress.configure(maximum=episodes, value=0)
		self._set_status("status_starting")
		self._append_log(self._t(
			"log_training_start", episodes=episodes, output=output_path, strategy=strategy_name,
			server=server_url or self._t("log_server_none"),
		))
		self.start_button.configure(state="disabled")
		self._pause_requested = False
		self.pause_button.configure(text=self._t(self._pause_button_key()), state="normal")
		self.stop_button.configure(state="normal")
		self._set_inputs_enabled(False)
		self._set_save_as_enabled(False)

		self.thread = threading.Thread(
			target=self._run_training, args=(episodes, output_path, server_url, self.control, strategy_name), daemon=True,
		)
		self.thread.start()

	def _run_training(
		self, episodes: int, output: Path, server_url: str, control: learning.TrainingControl,
		strategy: str = learning.DEFAULT_TRAINING_STRATEGY,
	) -> None:
		"""백그라운드 학습 쓰레드. 위젯을 직접 건드리지 않고 큐에만 결과를 적재한다."""

		def log(message: str) -> None:
			self.log_queue.put(("log", message))

		def on_progress(done: int, total: int, stats: dict) -> None:
			self.log_queue.put(("progress", done, total, stats))

		try:
			# GUI에는 API 토큰 입력란이 없다. pythonserver.py가 "localhost" 토큰을 실제
			# 루프백 요청에 한해 서버 설정 토큰과 무관하게 허용하므로, 기본으로 채워지는 로컬
			# 서버 주소는 이 값으로 별도 설정 없이 쓸 수 있다(원격 서버라면 정상적으로 거부된다).
			learning.train(
				episodes, learning.DEFAULT_SEED, output, learning.DEFAULT_DEVICE,
				server_url, "localhost", learning.DEFAULT_OPPONENT,
				control=control, log=log, on_progress=on_progress, strategy=strategy,
			)
		except learning.TrainingAbort:
			# 창 닫기로 인한 강제 포기: 저장 코드에 닿지 않았으므로 조용히 끝낸다. 창이 이미
			# 닫히고 있을 수 있어 큐에도 아무것도 넣지 않는다.
			return
		except Exception as error:
			self.log_queue.put(("error", str(error)))
			return
		self.log_queue.put(("done", None))

	def _on_pause_resume(self) -> None:
		if self.control is None:
			return
		if not self._pause_requested:
			self.control.request_pause()
			self._pause_requested = True
			self.pause_button.configure(text=self._t(self._pause_button_key()), state="disabled")
			self._set_status("status_pausing")
			self.root.after(100, self._poll_pause_ack)
		else:
			self.control.request_resume()
			self._pause_requested = False
			self.pause_button.configure(text=self._t(self._pause_button_key()), state="normal")
			self._set_status("status_training")

	def _poll_pause_ack(self) -> None:
		if self._closed or self.control is None:
			return
		if self.control.is_paused():
			self.pause_button.configure(state="normal")
			self._set_status("status_paused")
		elif self._pause_requested:
			self.root.after(100, self._poll_pause_ack)

	def _on_stop(self) -> None:
		if self.control is None:
			return
		self.pause_button.configure(state="disabled")
		self.stop_button.configure(state="disabled")
		self._set_status("status_stopping")
		self.control.request_stop()

	def _on_close(self) -> None:
		if self.control is not None and self.thread is not None and self.thread.is_alive():
			# 즉시 포기: learning.train()이 저장 코드에 닿기 전에 TrainingAbort로 빠져나간다.
			# 학습 쓰레드는 데몬 쓰레드라 창을 닫아도 프로세스 종료를 막지 않는다.
			self.control.request_abort()
		self._shutdown()

	# ------------------------------------------------------------------
	# 학습 쓰레드 -> GUI 쓰레드 큐 처리
	# ------------------------------------------------------------------
	def _poll_queue(self) -> None:
		if self._closed:
			return
		try:
			while True:
				item = self.log_queue.get_nowait()
				kind = item[0]
				if kind == "log":
					self._append_log(item[1])
				elif kind == "progress":
					_, done, total, stats = item
					self.progress.configure(maximum=total, value=done)
					self._set_status(
						"status_episode", done=done, total=total, wins=stats.get("wins", 0), losses=stats.get("losses", 0),
					)
				elif kind == "error":
					self._append_log(self._t("log_error", error=item[1]))
					self._set_status("status_failed")
					self._reset_controls()
				elif kind == "done":
					self._append_log(self._t("log_training_done"))
					self._set_status("status_idle")
					self._reset_controls()
				elif kind == "saveas_progress":
					_, percent, message = item
					# ONNX 변환일 때만 게이지바를 빌려 쓴 상태다(_progress_backup이 있을 때).
					if self._progress_backup is not None:
						self.progress.configure(maximum=100, value=percent)
					self._set_status_text(message)
					self._append_log(message)
				elif kind == "saveas_error":
					self._append_log(self._t("log_save_as_failed", error=item[1]))
					self._set_status("status_idle")
					self._finish_save_as()
				elif kind == "saveas_done":
					self._append_log(self._t("log_save_as_finished", destination=item[1]))
					self._set_status("status_idle")
					self._finish_save_as()
				elif kind == "sysinfo":
					_, cpu_percent, ram_percent = item
					self.cpu_gauge.configure(value=cpu_percent)
					self.cpu_var.set(f"{cpu_percent:.1f}%")
					self.ram_gauge.configure(value=ram_percent)
					self.ram_var.set(f"{ram_percent:.1f}%")
		except queue.Empty:
			pass
		# File > Exit로 종료를 예약했다면, 학습·저장 쓰레드가 모두 끝난 뒤에 창을 닫는다.
		if self._exit_pending and not self._is_busy():
			self._shutdown()
			return
		self.root.after(100, self._poll_queue)

	def _reset_controls(self) -> None:
		self._stop_local_server()
		self.control = None
		self.thread = None
		self._pause_requested = False
		if self._exit_pending:
			# File > Exit로 종료하는 중이다. 잠가 둔 버튼·메뉴를 되살리지 않고, 창을 닫는 일은
			# _poll_queue가 쓰레드 종료를 확인한 뒤에 맡는다.
			return
		self.start_button.configure(state="normal")
		self.pause_button.configure(text=self._t(self._pause_button_key()), state="disabled")
		self.stop_button.configure(state="disabled")
		self._set_inputs_enabled(True)
		self._set_save_as_enabled(True)


def main() -> None:
	"""표준 스트림을 정리한 뒤 학습기 창을 띄운다."""
	configure_standard_streams()
	root = tk.Tk()
	TrainerApp(root)
	root.mainloop()


if __name__ == "__main__":
	main()
