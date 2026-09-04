# Puyo W - AI 인공지능용 학습 모델 (LM Studio 호환) 생성기 - GUI
#
# 이 스크립트에서는 PyTorch 를 이용해 Puyo W 학습 모델을 생성한다.
#    GUI 인터페이스를 제공한다.
#
# 간단 사용법
#     터미널로 프로젝트 최상위 디렉토리로 접근 후 다음 명령어 사용
#
#     python python/lngui.py
#
#     GUI 창이 뜨면, 모델을 저장할 파일 경로를 입력하고, 에피소드 수를 지정한 후 "Start" 버튼을 클릭한다.
#
# 의존성
#    common.py
#    bundledenemy.py
#    learning.py
#    torch
#    psutil
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

창이 뜬 뒤에는 학습 쓰레드와 별개로 시스템 자원 감시용 데몬 쓰레드도 하나 돌아간다. 이 쓰레드는
psutil로 1초에 한 번 CPU·RAM 점유율만 재서 같은 log_queue에 적재하고, 위젯은 여느 학습 로그와
마찬가지로 _poll_queue가 메인 쓰레드에서만 갱신한다. 창을 닫으면 _closed 플래그로 다음 측정 뒤
루프를 빠져나가며, 데몬 쓰레드라 프로세스 종료를 막지 않는다.
"""

import queue
import threading
import tkinter as tk
from http.server import ThreadingHTTPServer
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from urllib.parse import urlsplit

import psutil

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
		self.root.title("Puyo W DQN Trainer")
		self.root.geometry("720x520")
		self.root.minsize(560, 420)

		self.log_queue: "queue.Queue[tuple]" = queue.Queue()
		self.control: learning.TrainingControl | None = None
		self.thread: threading.Thread | None = None
		self.server: ThreadingHTTPServer | None = None
		self.server_thread: threading.Thread | None = None
		self.sysinfo_thread: threading.Thread | None = None
		self._closed = False

		self._build_widgets()
		self.root.protocol("WM_DELETE_WINDOW", self._on_close)
		self.root.after(100, self._poll_queue)
		self._start_sysinfo_monitor()

	# ------------------------------------------------------------------
	# 화면 구성
	# ------------------------------------------------------------------
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
	# 학습 시작/일시정지/재개/중단
	# ------------------------------------------------------------------
	def _on_start(self) -> None:
		try:
			episodes = int(self.episodes_var.get().strip())
			if episodes < 1:
				raise ValueError
		except ValueError:
			messagebox.showerror("Puyo W DQN Trainer", "Episodes must be a positive integer.")
			return
		output_text = self.output_var.get().strip()
		if not output_text:
			messagebox.showerror("Puyo W DQN Trainer", "Please choose a model output path.")
			return

		output_path = Path(output_text)
		server_url = self.server_url_var.get().strip()

		local_port = _parse_local_server_port(server_url)
		if local_port is not None:
			try:
				self._start_local_server(local_port)
			except OSError as error:
				messagebox.showerror(
					"Puyo W DQN Trainer",
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
		self._closed = True
		if self.control is not None and self.thread is not None and self.thread.is_alive():
			# 즉시 포기: learning.train()이 저장 코드에 닿기 전에 TrainingAbort로 빠져나간다.
			# 학습 쓰레드는 데몬 쓰레드라 창을 닫아도 프로세스 종료를 막지 않는다.
			self.control.request_abort()
		if self.server is not None:
			self.server.shutdown()
			self.server.server_close()
			self.server = None
			self.server_thread = None
		self.root.destroy()

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
				elif kind == "sysinfo":
					_, cpu_percent, ram_percent = item
					self.cpu_gauge.configure(value=cpu_percent)
					self.cpu_var.set(f"{cpu_percent:.1f}%")
					self.ram_gauge.configure(value=ram_percent)
					self.ram_var.set(f"{ram_percent:.1f}%")
		except queue.Empty:
			pass
		self.root.after(100, self._poll_queue)

	def _reset_controls(self) -> None:
		self._stop_local_server()
		self.start_button.configure(state="normal")
		self.pause_button.configure(text="Pause", state="disabled")
		self.stop_button.configure(state="disabled")
		self._set_inputs_enabled(True)
		self.control = None
		self.thread = None


def main() -> None:
	root = tk.Tk()
	TrainerApp(root)
	root.mainloop()


if __name__ == "__main__":
	main()
