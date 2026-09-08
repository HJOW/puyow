# PyTorch 로 학습된 pt 모델 파일을 ONNX 형식으로 변환
#
# 이용을 위한 사전 설치 필요
#
#    python 3.10 이상 버전 (python.org 에서 다운로드)
#    torch                ( pip3 install torch )
#    onnx, onnxscript     ( pip3 install onnx onnxscript )
#
# 간단 사용법
#     터미널로 프로젝트 최상위 디렉토리로 접근 후 다음 명령어 사용
#
#     python python/convertonnx.py <기존 pt 파일 경로> <새로 저장할 onnx 파일 경로>
#
# 의존성
#    common.py
#    bundledenemy.py
#    learning.py
#    torch
#    onnx
#
# Copyright 2026 HJOW
#
# Apache License 2.0
# 이 프로그램은 Apache License 2.0에 따라 사용할 수 있습니다.
# 라이선스 전문은 프로젝트 루트의 LICENSE 파일을 확인하세요.

"""이미 학습된 PyTorch 체크포인트(.pt)를 ONNX(.onnx) 모델로 변환해 저장하는 CLI 도구.

변환 절차 자체는 lngui.py의 "File > Save As..." 메뉴가 .onnx 확장자를 골랐을 때 수행하는
export_checkpoint_to_onnx()와 같다. 다만 이 스크립트는 GUI(tkinter)나 로컬 서버(psutil,
pythonserver)에 기대지 않는 순수 CLI라서, 같은 절차를 여기서 다시 구현해 무거운 GUI 의존성 없이
터미널에서 바로 쓸 수 있게 했다.
"""

import argparse
import importlib.util
from pathlib import Path

import torch

import learning

# 내보낸 ONNX 모델에서 배치 축에 붙일 이름이다. 입력과 출력 모두 이 이름으로 열어 두어, 한 번에
# 여러 애프터스테이트를 넣어 평가하는 사용처가 그대로 쓸 수 있게 한다.
ONNX_BATCH_AXIS_NAME = "batch"

# ONNX 변환에 필요한 파이썬 패키지를 찾지 못했을 때 보여 줄 안내다.
ONNX_REQUIREMENT_MESSAGE = (
	"ONNX export requires the onnx package (and onnxscript for the torch.export based exporter). "
	"Install them with: pip3 install onnx onnxscript"
)


def convert_pt_to_onnx(source: Path, destination: Path) -> None:
	"""학습 체크포인트(source)를 읽어 ONNX 모델(destination)로 저장한다.

	원본 체크포인트는 읽기만 하고 형식도 바꾸지 않으므로 기존 모델 호환성에는 영향이 없다.
	"""
	# onnx는 두 내보내기 방식 모두가 요구한다. 없으면 변환을 시작하기 전에 설치 방법을 알린다.
	if importlib.util.find_spec("onnx") is None:
		raise RuntimeError(ONNX_REQUIREMENT_MESSAGE)

	print(f"Loading checkpoint from {source}...")
	# load_policy_checkpoint()가 모델 버전·관측값·행동 계약까지 검증하므로, 형식이 다른 파일은
	# 여기서 걸러져 어중간한 ONNX 파일이 만들어지지 않는다.
	policy = learning.load_policy_checkpoint(source, torch.device("cpu"))

	# ValueNetwork.forward()는 (배치, OBSERVATION_SIZE) 모양을 받는다. 배치 축만 동적으로 열어 둔다.
	sample = torch.zeros(1, learning.OBSERVATION_SIZE, dtype=torch.float32)

	print("Converting to ONNX...")
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

	print("Verifying exported model...")
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
	print(f"Saved ONNX model to {destination}")


def main() -> None:
	parser = argparse.ArgumentParser(description="PyTorch 체크포인트(.pt)를 ONNX(.onnx) 모델로 변환")
	parser.add_argument("pt_path", type=Path, help="이미 존재하는 PyTorch 체크포인트(.pt) 파일 경로")
	parser.add_argument("onnx_path", type=Path, help="새로 저장할 ONNX(.onnx) 파일 경로")
	args = parser.parse_args()

	if not args.pt_path.is_file():
		parser.error(f"pt 파일을 찾을 수 없습니다: {args.pt_path}")
	if args.pt_path.resolve() == args.onnx_path.resolve():
		parser.error("pt 파일 경로와 onnx 파일 경로가 같을 수 없습니다.")

	convert_pt_to_onnx(args.pt_path, args.onnx_path)


if __name__ == "__main__":
	main()
