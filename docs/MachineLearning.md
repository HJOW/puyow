# Puyo W 머신러닝

`learning/learning.py`는 PyTorch 기반의 self-play DQN 학습 스크립트다. 기본적으로 Puyo W의 핵심 보드 규칙을 간소화한 Python 환경에서 학습하며, 선택적으로 `pythonserver.py`의 인증된 학습 API에 각 에피소드의 관측값과 전이를 전송할 수 있다.

## 사전 준비

저장소 루트에서 Python 3.10 이상과 PyTorch를 준비한다. Windows PowerShell에서는 다음처럼 설치할 수 있다.

```powershell
python -m pip install torch
```

VS Code에서 `torch`를 찾지 못하면 PyTorch를 설치한 Python 인터프리터를 선택한다. CUDA를 사용할 경우 설치된 PyTorch가 해당 CUDA 환경을 지원해야 한다.

## 로컬 학습

게임 서버 없이 독립 학습을 실행하려면 다음 명령을 사용한다.

```powershell
python learning/learning.py --episodes 1000 --device auto
```

주요 옵션은 다음과 같다.

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `--episodes` | `1000` | self-play 에피소드 수. 1 이상이어야 한다. |
| `--seed` | `2026` | Python과 PyTorch 난수 시드 |
| `--output` | `learning/puyow_dqn.pt` | 모델 체크포인트 저장 경로 |
| `--device` | `auto` | `auto`, `cpu`, `cuda` 중 하나 |
| `--server-url` | 빈 값 | 학습 API가 실행 중인 서버 주소 |
| `--api-token` | 빈 값 | Python 서버의 `SERVER_CONFIG["learning_token"]` 값 |

학습이 끝나면 지정한 경로에 PyTorch 체크포인트가 저장되고, 같은 위치의 확장자를 `.json`으로 바꾼 메타데이터 파일도 생성된다. 기본 출력은 다음 두 파일이다.

```text
learning/puyow_dqn.pt
learning/puyow_dqn.json
```

체크포인트에는 모델 가중치, 관측 벡터 크기, 행동 개수, 학습 시드가 들어 있다.

## 서버 API와 함께 실행

서버 전송 모드를 사용하면 먼저 [learning/pythonserver.py](../learning/pythonserver.py)를 실행한다. 실행 전에 파일 상단의 `SERVER_CONFIG["learning_token"]` 값을 학습기와 같은 토큰으로 직접 설정한다. 이 값은 개발용 설정이며 공개 서버에는 토큰을 소스에 저장하지 않아야 한다.

Python 서버 실행:

```powershell
python learning/pythonserver.py 9891
```

포트 번호를 생략하면 `SERVER_CONFIG["port"]`의 기본값 `9891`을 사용한다.

서버가 실행된 상태에서 학습기를 실행한다.

```powershell
python learning/learning.py `
	--episodes 1000 `
	--server-url http://localhost:9891 `
	--device auto
```

`--api-token`에는 Python 서버의 `SERVER_CONFIG["learning_token"]`과 같은 값을 지정한다.

```powershell
python learning/learning.py `
	--episodes 100 `
	--server-url http://localhost:9891 `
	--api-token "SERVER_CONFIG에 설정한 토큰" `
	--output learning/experiment.pt
```

서버 URL을 지정하면 각 에피소드마다 다음 순서로 `POST /apis/learning` 요청을 보낸다.

1. `reset`: 새로운 세션 ID와 최초 관측값을 전송한다.
2. `step`: 현재 관측값, 행동, 보상, 다음 관측값, 종료 여부를 전송한다.
3. `episode_end`: 에피소드 종료를 전송한다.

모든 요청에는 다음 인증 헤더가 포함된다.

```text
Authorization: Bearer <SERVER_CONFIG["learning_token"]>
Content-Type: application/json
```

서버 요청이 실패하거나 서버가 `ok: false`를 반환하면 학습기도 오류로 종료한다. 학습 데이터가 유실된 채 계속 진행하지 않기 위한 동작이다.

## 관측값과 행동

현재 Python 환경의 관측 벡터는 길이 `444`다.

- 6×12 보드의 빈 칸 및 5색 뿌요 원-핫 채널: `432`개
- 현재 뿌요 쌍의 두 색 원-핫 정보: `10`개
- 누적 공격량과 턴 수: `2`개

보드 좌표는 `board[y][x]`이며 `y=0`이 바닥이다. 행동 번호는 `열 * 4 + 회전`으로 계산한다.

- 열: `0`~`5`
- 회전: `0`~`3`
- 전체 행동 수: `24`

관측값과 행동 계약은 `pythonserver.py` API로 전송하는 데이터에도 그대로 사용된다.

## 현재 구현 범위

현재 학습 환경에는 일반 색 뿌요의 연결 폭발, 연쇄, 중력, 기본 패배 위치가 구현되어 있다. 다음 Puyo W 규칙은 아직 간소화되어 있으므로 실제 게임 AI로 사용하기 전에 보완해야 한다.

- 일반 방해뿌요와 딱딱뿌요
- 피버 룰과 연속 피버
- 싹쓸이 티켓 및 실제 점수·ATTACK 계산
- 마진 레이트와 시간 진행 배율
- 실제 브라우저 게임 루프의 상태 수집 및 행동 주입
- self-play 상대 정책과 평가 전용 에피소드

현재 `pythonserver.py` API는 학습 이벤트를 수신하고 세션 통계를 보관하며, `src/js/puyow.js`는 사용자 게임의 실제 배치·정산 결과를 해당 API 계약으로 전송한다. 브라우저에서 `configureLearningApi()`를 호출해야 전송이 활성화된다.

브라우저 게임에서 실제 사용자 플레이의 전이를 전송하려면 게임 초기화 전에 공개 설정 함수를 호출한다. 토큰은 페이지 소스에 고정하지 말고 개발 환경에서 안전하게 주입해야 한다.

```html
<script>
	window.PuyoW.configureLearningApi({
		serverUrl: "http://localhost:9891",
		token: "change-this-token"
	});
	window.PuyoW.initialize(document.getElementById("puyow_target"));
</script>
```

설정하면 일반 사용자 게임에서 다음 이벤트가 자동으로 전송된다.

- 첫 뿌요 쌍이 고정될 때 `reset`
- 뿌요 폭발·중력·피해 정산이 끝난 뒤 다음 조작 턴에 `step`
- 승패 처리가 끝날 때 `episode_end`

연습, 구경, 플레이 방법 모드는 학습 세션에서 제외된다.

## 도움말

전체 옵션은 다음 명령으로 확인할 수 있다.

```powershell
python learning/learning.py --help
```

## GGUF 변환

LM Studio에서 불러오는 GGUF는 일반 PyTorch 파일의 확장자를 바꿔서 만드는 형식이 아니다. 지정한 글의 방식처럼 `llama.cpp` 도구의 `convert_hf_to_gguf.py`를 사용해 `config.json`과 Transformer 가중치를 가진 Hugging Face 모델 디렉터리를 변환해야 한다.

`learning.py`에는 이 변환기를 호출하는 export 경로가 포함되어 있다.

```powershell
python learning/learning.py `
	--export-gguf models\my-transformer `
	--llama-cpp-converter llama.cpp\convert_hf_to_gguf.py `
	--gguf-output learning\my-model-f16.gguf
```

변환 대상 디렉터리에는 최소한 `config.json`과 해당 모델의 Transformer 가중치 파일이 있어야 한다. 기본 출력 형식은 `f16`이다. 이후 LM Studio에서 필요에 따라 지원되는 양자화 형식으로 추가 변환하거나, 이미 양자화된 GGUF를 직접 사용할 수 있다.

현재 `learning.py`가 학습하는 `puyow_dqn.pt`는 `PolicyNetwork`라는 사용자 정의 DQN MLP 체크포인트다. 이는 Llama 등의 언어 모델 구조가 아니므로 `convert_hf_to_gguf.py`나 LM Studio에서 직접 사용할 수 없다. 현재 DQN은 Python/PyTorch 게임 정책용으로 사용하며, LM Studio에 넣으려면 별도의 Transformer 기반 모델과 그에 맞는 학습·변환 파이프라인이 필요하다.
