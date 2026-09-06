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
#     GUI 창이 뜨면, 모델을 저장할 파일 경로를 입력하고, 에피소드 수를 지정한 후 "Start" 버튼을 클릭한다.
#
#     학습한 모델을 다른 이름이나 ONNX 형식으로 내보내려면 File > Save As... 메뉴를 사용한다.
#     프로그램을 끝낼 때는 File > Exit 메뉴를 쓰면 학습 중이라도 마지막 에피소드까지 저장한 뒤 종료한다.
#
# 의존성
#    common.py
#    bundledenemy.py
#    learning.py
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
멈추지 않는다. GUI 텍스트(버튼·라벨·상태 문구)는 요구 사항에 따라 모두 영어로 표기하며, 학습
자체가 남기는 로그(learning.py의 log 콜백 출력)는 기존 한국어 표기를 그대로 로그 패널에 보여준다.

일시정지·중단은 learning.TrainingControl을 통해 "진행 중인 에피소드가 끝난 뒤"에만 반영되고,
창을 닫아 학습을 포기하는 경우에만 learning.TrainingAbort로 즉시 중단되며 이때는 어떤 파일도
저장하지 않는다. CLI에서 `python python/learning.py ...`로 직접 학습하는 기존 방식은 이 GUI와
무관하게 그대로 동작한다.

메뉴바에는 File 그룹 하나가 있고 그 안에 Save As...와 Exit 두 항목이 있다. Save As...는 학습
중·일시정지 중에는 잠기며, Model output path의 체크포인트를 .pt로 그대로 복사하거나 .onnx로
변환해 내보낸다. Exit는 상태와 무관하게 언제나 누를 수 있고, 학습 중이면 Stop 버튼과 같은 중단
예약을 걸어 마지막 에피소드까지의 결과를 체크포인트에 저장한 뒤 창을 닫는다. 창 오른쪽 위의 닫기
버튼(_on_close)은 예전처럼 저장 없이 즉시 포기하는 경로라서 Exit와 의미가 다르다.

창이 뜬 뒤에는 학습 쓰레드와 별개로 시스템 자원 감시용 데몬 쓰레드도 하나 돌아간다. 이 쓰레드는
psutil로 1초에 한 번 CPU·RAM 점유율만 재서 같은 log_queue에 적재하고, 위젯은 여느 학습 로그와
마찬가지로 _poll_queue가 메인 쓰레드에서만 갱신한다. 창을 닫으면 _closed 플래그로 다음 측정 뒤
루프를 빠져나가며, 데몬 쓰레드라 프로세스 종료를 막지 않는다.
"""

import importlib.util
import queue
import shutil
import threading
import tkinter as tk
from http.server import ThreadingHTTPServer
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Callable
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

# File 메뉴 항목의 라벨이다. 메뉴 항목을 켜고 끌 때 인덱스 대신 이 라벨로 지정하므로, 항목 순서가
# 바뀌어도 상태 처리 코드를 함께 고칠 필요가 없다.
SAVE_AS_MENU_LABEL = "Save As..."
EXIT_MENU_LABEL = "Exit"

# Save As... 대화상자에서 고를 수 있는 형식이다. 어느 쪽을 골랐는지는 결과 경로의 확장자로
# 판별하므로, 여기에 형식을 더할 때는 _on_save_as의 확장자 분기도 함께 넓혀야 한다.
SAVE_AS_FILETYPES = [("PyTorch checkpoint", "*.pt"), ("ONNX model", "*.onnx")]

# 내보낸 ONNX 모델에서 배치 축에 붙일 이름이다. 입력과 출력 모두 이 이름으로 열어 두어, 한 번에
# 여러 애프터스테이트를 넣어 평가하는 사용처가 그대로 쓸 수 있게 한다.
ONNX_BATCH_AXIS_NAME = "batch"

# ONNX 변환에 필요한 파이썬 패키지를 찾지 못했을 때 로그에 보여 줄 안내다.
ONNX_REQUIREMENT_MESSAGE = (
	"ONNX export requires the onnx package (and onnxscript for the torch.export based exporter). "
	"Install them with: pip3 install onnx onnxscript"
)


def _report_progress(progress: Callable[[int, str], None] | None, percent: int, message: str) -> None:
	"""진행 콜백이 있으면 (진행률, 상태 문구)를 전달한다. 콜백이 없으면 아무 일도 하지 않는다."""
	if progress is not None:
		progress(percent, message)


def save_checkpoint_copy(
	source: Path, destination: Path, progress: Callable[[int, str], None] | None = None,
) -> None:
	"""학습 체크포인트를 그대로 다른 경로에 복사한다.

	파일 내용을 전혀 손대지 않으므로 복사본도 learning.py·pythonserver.py가 읽는 기존 체크포인트
	형식 그대로다. 원본 파일도 읽기만 한다.
	"""
	_report_progress(progress, 10, f"Copying checkpoint to {destination}...")
	destination.parent.mkdir(parents=True, exist_ok=True)
	shutil.copy2(source, destination)
	_report_progress(progress, 100, f"Saved checkpoint to {destination}")


def export_checkpoint_to_onnx(
	source: Path, destination: Path, progress: Callable[[int, str], None] | None = None,
) -> None:
	"""학습 체크포인트를 ONNX 모델로 변환해 저장한다.

	원본 체크포인트는 읽기만 하고 형식도 바꾸지 않으므로, 기존 모델 호환성에는 영향이 없다.
	`progress`는 (0~100 진행률, 상태 문구)를 받는 콜백이며 GUI가 게이지바와 로그를 갱신하는 데
	쓴다. 변환 자체는 한 번의 torch.onnx.export 호출이라 중간 진행률을 물어볼 수 없어서, 실제로
	시간을 쓰는 단계(체크포인트 로드 → 변환 → 검증)의 경계마다 진행률을 올린다.
	"""
	# onnx는 두 내보내기 방식 모두가 요구한다. 없으면 변환을 시작하기 전에 설치 방법을 알린다.
	if importlib.util.find_spec("onnx") is None:
		raise RuntimeError(ONNX_REQUIREMENT_MESSAGE)
	_report_progress(progress, 5, f"Loading checkpoint from {source}...")
	# load_policy_checkpoint()가 모델 버전·관측값·행동 계약까지 검증하므로, 형식이 다른 파일은
	# 여기서 걸러져 어중간한 ONNX 파일이 만들어지지 않는다.
	policy = learning.load_policy_checkpoint(source, torch.device("cpu"))
	_report_progress(progress, 30, "Preparing sample input...")
	# ValueNetwork.forward()는 (배치, OBSERVATION_SIZE) 모양을 받는다. 배치 축만 동적으로 열어 둔다.
	sample = torch.zeros(1, learning.OBSERVATION_SIZE, dtype=torch.float32)
	_report_progress(progress, 45, "Converting to ONNX...")
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
		input_names=["observation"], output_names=["value"], **export_options,
	)
	_report_progress(progress, 85, "Verifying exported model...")
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
	_report_progress(progress, 100, f"Saved ONNX model to {destination}")


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

	def __init__(self, root: tk.Tk) -> None:
		self.root = root
		self.root.title("Puyo W Model Trainer")
		self.root.geometry("720x520")
		self.root.minsize(560, 420)

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

		self._build_menu()
		self._build_widgets()
		self.root.protocol("WM_DELETE_WINDOW", self._on_close)
		self.root.after(100, self._poll_queue)
		self._start_sysinfo_monitor()

	# ------------------------------------------------------------------
	# 화면 구성
	# ------------------------------------------------------------------
	def _build_menu(self) -> None:
		"""File 그룹 하나만 있는 메뉴바를 만든다.

		Save As...는 학습 중·일시정지 중에 잠기고, Exit는 상태 변화로는 잠기지 않는다(종료 절차
		자체를 시작한 뒤에만 _disable_all_controls가 함께 잠근다).
		"""
		menubar = tk.Menu(self.root)
		self.file_menu = tk.Menu(menubar, tearoff=0)
		self.file_menu.add_command(label=SAVE_AS_MENU_LABEL, command=self._on_save_as)
		self.file_menu.add_command(label=EXIT_MENU_LABEL, command=self._on_exit_menu)
		menubar.add_cascade(label="File", menu=self.file_menu)
		self.root.configure(menu=menubar)

	def _build_widgets(self) -> None:
		padding = {"padx": 8, "pady": 4}

		form = ttk.Frame(self.root)
		form.grid(row=0, column=0, sticky="ew")
		form.columnconfigure(1, weight=1)
		self.root.columnconfigure(0, weight=1)

		ttk.Label(form, text="Model output path:").grid(row=0, column=0, sticky="w", **padding)
		self.output_var = tk.StringVar(value=str(learning.DEFAULT_OUTPUT))
		self.output_entry = ttk.Entry(form, textvariable=self.output_var)
		self.output_entry.grid(row=0, column=1, sticky="ew", **padding)
		self.browse_button = ttk.Button(form, text="Browse...", command=self._on_browse_output)
		self.browse_button.grid(row=0, column=2, **padding)

		ttk.Label(form, text="Episodes:").grid(row=1, column=0, sticky="w", **padding)
		self.episodes_var = tk.StringVar(value=str(DEFAULT_EPISODES))
		self.episodes_entry = ttk.Entry(form, textvariable=self.episodes_var)
		self.episodes_entry.grid(row=1, column=1, sticky="ew", **padding)

		server_url_label = ttk.Label(form, text="Server URL:")
		server_url_label.grid(row=2, column=0, sticky="w", **padding)
		self.server_url_var = tk.StringVar(value="")
		self.server_url_entry = ttk.Entry(form, textvariable=self.server_url_var)
		self.server_url_entry.grid(row=2, column=1, columnspan=2, sticky="ew", **padding)
		server_url_label.grid_remove()
		self.server_url_entry.grid_remove()

		buttons = ttk.Frame(self.root)
		buttons.grid(row=1, column=0, sticky="ew", **padding)
		self.start_button = ttk.Button(buttons, text="Start", command=self._on_start)
		self.start_button.pack(side="left", padx=4)
		self.pause_button = ttk.Button(buttons, text="Pause", command=self._on_pause_resume, state="disabled")
		self.pause_button.pack(side="left", padx=4)
		self.stop_button = ttk.Button(buttons, text="Stop", command=self._on_stop, state="disabled")
		self.stop_button.pack(side="left", padx=4)

		self.progress = ttk.Progressbar(self.root, orient="horizontal", mode="determinate")
		self.progress.grid(row=2, column=0, sticky="ew", **padding)

		self.status_var = tk.StringVar(value="Idle.")
		ttk.Label(self.root, textvariable=self.status_var).grid(row=3, column=0, sticky="w", **padding)

		log_frame = ttk.Frame(self.root)
		log_frame.grid(row=4, column=0, sticky="nsew", **padding)
		self.root.rowconfigure(4, weight=1)
		scrollbar = ttk.Scrollbar(log_frame)
		scrollbar.pack(side="right", fill="y")
		self.log_text = tk.Text(log_frame, height=16, state="disabled", wrap="word", yscrollcommand=scrollbar.set)
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
			title="Select checkpoint file",
			defaultextension=".pt",
			filetypes=[("PyTorch checkpoint", "*.pt"), ("All files", "*.*")],
			initialdir=str(current.parent) if str(current.parent) else None,
			initialfile=current.name or "default.pt",
		)
		if path:
			self.output_var.set(path)

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
		self.server_url_entry.configure(state=state)

	def _set_save_as_enabled(self, enabled: bool) -> None:
		"""File > Save As... 항목만 켜고 끈다. 학습 중·일시정지 중과 저장 작업 중에는 꺼 둔다."""
		self.file_menu.entryconfigure(SAVE_AS_MENU_LABEL, state="normal" if enabled else "disabled")

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
		self.file_menu.entryconfigure(EXIT_MENU_LABEL, state="disabled")

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
		self._append_log("Stopping local pythonserver.py...")
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
			self._append_log(f"Save As failed: no model file at {source}")
			return

		destination_text = filedialog.asksaveasfilename(
			# parent를 지정해야 이 창에 묶인 모달 대화상자로 뜬다.
			parent=self.root,
			title="Save model as",
			defaultextension=".pt",
			filetypes=SAVE_AS_FILETYPES,
			initialdir=str(source.parent) if str(source.parent) else None,
			initialfile=source.name,
		)
		if not destination_text:
			# 취소했거나 대화상자를 그냥 닫았다.
			return

		destination = Path(destination_text)
		suffix = destination.suffix.lower()
		if suffix not in (".pt", ".onnx"):
			self._append_log(
				f"Save As failed: unsupported extension '{destination.suffix}'. Choose .pt or .onnx."
			)
			return
		if destination.resolve() == source.resolve():
			# 원본과 같은 파일로 저장하면 복사가 실패한다. 미리 걸러 안내한다.
			self._append_log("Save As failed: the destination is the same file as the model output path.")
			return

		as_onnx = suffix == ".onnx"
		self.start_button.configure(state="disabled")
		# 변환이 끝나기 전에 같은 메뉴가 다시 열려 두 작업이 같은 파일에 겹쳐 쓰지 않도록 막는다.
		self._set_save_as_enabled(False)
		if as_onnx:
			# 변환 진행률을 보여 주려고 게이지바를 잠시 빌린다. 끝나면 원래 표시로 되돌린다.
			self._progress_backup = (self.progress.cget("maximum"), self.progress.cget("value"))
			self.progress.configure(maximum=100, value=0)
		self.status_var.set("Saving model...")
		self._append_log(f"Save As started: {source} -> {destination}")

		self.save_thread = threading.Thread(
			target=self._run_save_as, args=(source, destination, as_onnx), daemon=True,
		)
		self.save_thread.start()

	def _run_save_as(self, source: Path, destination: Path, as_onnx: bool) -> None:
		"""백그라운드 저장·변환 쓰레드. 위젯을 직접 건드리지 않고 큐에만 결과를 적재한다."""

		def report(percent: int, message: str) -> None:
			self.log_queue.put(("saveas_progress", percent, message))

		try:
			if as_onnx:
				export_checkpoint_to_onnx(source, destination, report)
			else:
				save_checkpoint_copy(source, destination, report)
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
			self.status_var.set("Stopping (finishing current episode) before exit...")
			self._append_log("Exit requested. Saving progress after the current episode...")
			self.control.request_stop()
			return
		if self._is_busy():
			# 학습은 아니지만 Save As 작업이 남아 있으면 파일이 깨지지 않게 끝날 때까지 기다린다.
			self.status_var.set("Finishing the current task before exit...")
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
			messagebox.showerror("Puyo W Model Trainer", "Episodes must be a positive integer.")
			return
		output_text = self.output_var.get().strip()
		if not output_text:
			messagebox.showerror("Puyo W Model Trainer", "Please choose a model output path.")
			return

		output_path = Path(output_text)
		server_url = self.server_url_var.get().strip()

		local_port = _parse_local_server_port(server_url)
		if local_port is not None:
			try:
				self._start_local_server(local_port)
			except OSError as error:
				messagebox.showerror(
					"Puyo W Model Trainer",
					f"Could not start pythonserver.py on port {local_port}.\n"
					f"The port may already be in use by another process.\n\n{error}",
				)
				return
			self._append_log(f"Started local pythonserver.py on port {local_port}.")

		self.control = learning.TrainingControl()
		self.progress.configure(maximum=episodes, value=0)
		self.status_var.set("Starting...")
		self._append_log(f"Starting training: episodes={episodes} output={output_path} server={server_url or '(none)'}")
		self.start_button.configure(state="disabled")
		self.pause_button.configure(text="Pause", state="normal")
		self.stop_button.configure(state="normal")
		self._set_inputs_enabled(False)
		self._set_save_as_enabled(False)

		self.thread = threading.Thread(
			target=self._run_training, args=(episodes, output_path, server_url, self.control), daemon=True,
		)
		self.thread.start()

	def _run_training(
		self, episodes: int, output: Path, server_url: str, control: learning.TrainingControl,
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
				control=control, log=log, on_progress=on_progress,
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
		if self.pause_button["text"] == "Pause":
			self.control.request_pause()
			self.pause_button.configure(text="Resume", state="disabled")
			self.status_var.set("Pausing (finishing current episode)...")
			self.root.after(100, self._poll_pause_ack)
		else:
			self.control.request_resume()
			self.pause_button.configure(text="Pause", state="normal")
			self.status_var.set("Training...")

	def _poll_pause_ack(self) -> None:
		if self._closed or self.control is None:
			return
		if self.control.is_paused():
			self.pause_button.configure(state="normal")
			self.status_var.set("Paused.")
		elif self.pause_button["text"] == "Resume":
			self.root.after(100, self._poll_pause_ack)

	def _on_stop(self) -> None:
		if self.control is None:
			return
		self.pause_button.configure(state="disabled")
		self.stop_button.configure(state="disabled")
		self.status_var.set("Stopping (finishing current episode)...")
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
					self.status_var.set(
						f"Episode {done}/{total} (wins={stats.get('wins', 0)}, losses={stats.get('losses', 0)})"
					)
				elif kind == "error":
					self._append_log(f"Error: {item[1]}")
					self.status_var.set("Failed.")
					self._reset_controls()
				elif kind == "done":
					self._append_log("Training finished and checkpoint saved.")
					self.status_var.set("Idle.")
					self._reset_controls()
				elif kind == "saveas_progress":
					_, percent, message = item
					# ONNX 변환일 때만 게이지바를 빌려 쓴 상태다(_progress_backup이 있을 때).
					if self._progress_backup is not None:
						self.progress.configure(maximum=100, value=percent)
					self.status_var.set(message)
					self._append_log(message)
				elif kind == "saveas_error":
					self._append_log(f"Save As failed: {item[1]}")
					self.status_var.set("Idle.")
					self._finish_save_as()
				elif kind == "saveas_done":
					self._append_log(f"Save As finished: {item[1]}")
					self.status_var.set("Idle.")
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
		if self._exit_pending:
			# File > Exit로 종료하는 중이다. 잠가 둔 버튼·메뉴를 되살리지 않고, 창을 닫는 일은
			# _poll_queue가 쓰레드 종료를 확인한 뒤에 맡는다.
			return
		self.start_button.configure(state="normal")
		self.pause_button.configure(text="Pause", state="disabled")
		self.stop_button.configure(state="disabled")
		self._set_inputs_enabled(True)
		self._set_save_as_enabled(True)


def main() -> None:
	root = tk.Tk()
	TrainerApp(root)
	root.mainloop()


if __name__ == "__main__":
	main()
