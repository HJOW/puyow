# Puyo W 머신러닝 튜토리얼

`learning.py`는 뿌요를 어디에 둘지 평가하는 모델을 학습해 `.pt` 파일로 저장하는 도구다. 이 문서에서는 먼저 화면(GUI)으로 조작하는 `lngui.py`를 실행해 보고, 그다음 명령줄에서 `learning.py`로 같은 로컬 학습을 실행해 본다. 학습 중에 브라우저 게임이나 서버를 실행할 필요는 없다.

## 1. 처음 한 번만 준비하기

이 문서는 Windows와 PowerShell 기준이다. 명령 프롬프트에서도 같은 명령을 사용할 수 있다.

먼저 다음 프로그램을 홈페이지에서 설치한다. 설치 뒤에는 이미 열어 둔 PowerShell 또는 명령 프롬프트를 닫고 새로 연다.

- [Python 다운로드](https://www.python.org/downloads/)에서 **Python 3.10 이상**을 설치한다. 설치 화면의 `Add Python to PATH` 옵션을 체크한다.
- [Node.js 다운로드](https://nodejs.org/ko/download)에서 LTS 버전을 설치한다. 학습기는 실제 게임의 피버 패턴을 읽을 때 Node.js를 사용한다.
- Puyo W 프로젝트가 아직 없다면 [Git for Windows](https://git-scm.com/install/windows)를 설치한 뒤 아래 명령으로 받는다. 이미 프로젝트 폴더가 있다면 이 단계는 건너뛴다.

```powershell
git clone https://github.com/HJOW/puyow.git
cd puyow
```

위 명령을 실행했다면 이미 프로젝트 폴더 안에 있으므로 아래 이동 단계는 필요 없다. 이미 다른 위치에 프로젝트 폴더가 있다면, 아래처럼 그 위치로 이동한다. 경로는 예시이므로 실제 설치 위치에 맞게 바꾼다.

```powershell
cd D:\Workspace\git\puyow
```

설치가 인식되는지 확인한다.

```powershell
python --version
node --version
```

각 명령에서 버전 번호가 보이면 된다. `python`을 찾을 수 없다고 나오면 새 터미널을 열어 다시 시도하고, 그래도 안 되면 Python을 다시 설치하면서 PATH 옵션을 확인한다. Windows에서 `py`만 동작한다면 이후 명령의 `python` 자리에 `py`를 사용해도 된다.

마지막으로 필요한 Python 패키지를 설치한다.

```powershell
python -m pip install --upgrade pip
python -m pip install torch psutil onnx onnxscript
```

`torch`는 학습에, `psutil`은 GUI의 CPU·메모리 표시 기능에 필요하다. `onnx` 및 `onnxscript`는 모델을 ONNX (Open Neural Network Exchange) 형식으로 저장할 때 사용된다.

NVIDIA GPU 사용 환경이라면 [PyTorch 시작 페이지](https://pytorch.org/get-started/locally/)에서 CUDA 환경에 맞는 설치 명령을 확인한다. 잘 모르겠다면 이 문서의 기본 설치와 CPU 학습부터 시작하면 된다.

## 2. `lngui.py`를 실행해 보기

처음에는 짧은 학습으로 설치가 끝났는지 확인한다.

1. PowerShell 또는 명령 프롬프트에서 프로젝트 루트로 이동한다.
2. 다음 명령을 입력하고 Enter를 누른다.

   ```powershell
   python python/lngui.py
   ```

3. **Puyo W Model Trainer** 창이 열리면 `Episodes`의 `5000`을 우선 `10`으로 바꾼다(한국어 Windows에서는 **Puyo W 모델 학습기** 창과 `에피소드 수` 입력란으로 보인다). 에피소드는 컴퓨터가 뿌요 한 판을 시뮬레이션하는 횟수다.
4. `Model output path`는 처음에는 기본값(`python\puyow\default.pt`)을 그대로 둔다. 다른 이름이나 위치에 저장하려면 경로를 입력하거나 `Browse...`를 누른다.
5. **Start**를 누른다. 로그에 `Starting training`이 보이고 진행 막대가 움직이면 학습이 시작된 것이다.
6. 완료될 때까지 기다린다. `Training finished and checkpoint saved.`가 로그에 보이면 성공이다.

`lngui.py`는 **서버 URL을 입력받지 않는 로컬 학습 도구**다. `pythonserver.py`를 실행하거나 API 토큰을 설정할 필요가 없다.

성공하면 기본 경로에는 다음 두 파일이 생긴다.

```text
python/puyow/default.pt
python/puyow/default.json
```

`.pt`는 학습된 모델이고 `.json`은 모델 버전과 입력 크기를 기록한 파일이다.

## 3. `lngui.py`의 간단한 사용 방법

GUI에는 모델 저장 경로, 에피소드 수, 학습 방식, Start/Pause/Stop 버튼, 진행 막대, 로그, CPU/RAM 표시가 있다. **서버 주소 입력란은 없으며**, GUI는 로컬 학습만 실행한다. 시드·장치·상대는 `learning.py`의 기본값인 `2026`, `auto`, `random`을 사용한다.

창의 문구는 운영체제 표시 언어가 한국어면 한국어로, 그 밖에는 영어로 표시된다. 메뉴의 `Language`(한국어 표시에서는 `언어 (Language)`)에서 `English`와 `한국어`를 언제든 바꿀 수 있다. Windows에서는 한국어 글자를 `python/PretendardVariable.ttf` 글꼴로 표시하며, 글꼴을 따로 설치할 필요는 없다. 다른 운영체제는 시스템 글꼴을 쓴다.

아래 표는 영어 이름 기준이다. 한국어 표시에서는 `모델 저장 경로`, `에피소드 수`, `학습 방식`, `시작`, `일시정지`/`재개`, `중단`, `파일 > 다른 이름으로 저장...`/`종료`로 보인다. 학습기 자체가 남기는 학습 로그는 언어 설정과 무관하게 한국어다.

| 화면 항목 | 하는 일 |
| --- | --- |
| `Model output path` | 학습 결과를 저장할 `.pt` 파일 경로다. `Browse...`로 선택할 수도 있다. |
| `Episodes` | 학습할 판 수다. 1 이상의 정수만 입력한다. 설치 확인에는 10, 실제 학습에는 1000 이상처럼 더 큰 값을 쓴다. |
| `Training strategy` | 학습 방식을 고른다. 기본값 `Standard`는 기존 학습과 같다. 고른 방식의 설명이 콤보박스 아래에 표시된다. 자세한 내용은 8절의 「학습 방식」을 참고한다. |
| `Start` | 학습을 시작한다. 학습 중에는 경로·에피소드 수·학습 방식을 바꿀 수 없다. |
| `Pause` / `Resume` | 현재 에피소드가 끝난 뒤 멈추거나 다시 시작한다. |
| `Stop` | 현재 에피소드가 끝난 뒤 중단하고, 그때까지의 모델을 저장한다. |
| 진행 막대와 로그 | 완료된 에피소드, 승패 수, 오류와 저장 결과를 확인한다. |

`File` 메뉴도 사용할 수 있다.

- `File > Save As...`: 학습이 끝난 모델을 다른 `.pt` 파일로 복사하거나 `.onnx` 파일로 변환한다. ONNX 변환에는 `onnx`, `onnxscript` 패키지가 필요하다.
- `File > Exit`: 학습 중이면 현재 에피소드가 끝난 뒤 모델을 저장하고 창을 닫는다.
- 창 오른쪽 위의 **X**: 즉시 닫고 현재 학습 결과는 저장하지 않는다. 이미 있던 모델 파일도 바꾸지 않는다.

같은 `Model output path`로 다시 학습하면 기존 `.pt` 파일의 가중치를 읽은 뒤 추가 학습하고, 정상 종료 시 같은 경로에 다시 저장한다. 원본을 보존하려면 시작 전에 다른 파일명을 지정한다.

## 4. 명령줄로 `learning.py`를 실행해 보기

GUI가 정상 실행된 뒤에는 같은 로컬 학습을 명령줄로 실행할 수 있다. 프로젝트 루트에서 다음 명령을 입력한다.

```powershell
python python/learning.py --episodes 10 --output python/puyow/first-model.pt --device auto
```

`episode=...` 로그가 나오고 마지막에 `saved=python/puyow/first-model.pt`가 나오면 성공이다. 설치 확인이 끝나면 `--episodes 10`을 원하는 수로 바꾼다. 예를 들어 기본 파일에 1000판을 학습하려면 다음과 같이 실행한다.

```powershell
python python/learning.py --episodes 1000 --device auto
```

이 절의 명령은 모두 서버 없이 실행하는 로컬 학습이다. 실행이 끝나면 `--output` 경로에 `.pt` 모델 파일과 같은 이름의 `.json` 메타데이터 파일이 저장된다. 이미 있는 `.pt` 파일을 `--output`으로 지정하면 그 모델부터 추가 학습한다.

명령줄 학습은 모든 에피소드가 끝난 뒤 마지막에 한 번만 저장하므로, 중간에 `Ctrl+C`로 강제 종료하면 그때까지의 학습 결과가 전혀 저장되지 않는다. 그러므로 강제 종료로 학습을 멈추기보다, 먼저 작은 `--episodes` 값으로 실행해 보는 편이 안전하다.

## 5. `learning.py` 옵션

전체 옵션은 다음 명령으로도 확인할 수 있다.

```powershell
python python/learning.py --help
```

| 옵션 | 기본값 | 설명과 예시 |
| --- | --- | --- |
| `--episodes 수` | `1000` | 학습할 에피소드 수. 1 이상이어야 한다. 예: `--episodes 5000` |
| `--seed 수` | `2026` | 난수 시드. 같은 조건의 결과를 비교할 때 고정한다. 예: `--seed 42` |
| `--output 경로` | `python/puyow/default.pt` | 모델 저장 파일. 파일이 이미 있으면 그 가중치를 읽고 추가 학습한다. 예: `--output python/puyow/kimaris.pt` |
| `--device auto\|cpu\|cuda` | `auto` | 계산 장치. `auto`는 CUDA를 사용할 수 있으면 GPU, 아니면 CPU를 고른다. GPU 설정이 불확실하면 `cpu`를 쓴다. |
| `--opponent 값` | `random` | 학습 상대. 아래 상세 설명의 상대 표를 참고한다. 예: `--opponent Kimaris` |
| `--training-strategy 값` | `standard` | 학습 방식. `standard`, `chain-guided`, `chain-curriculum`, `long-nstep`, `chain-all`, `solo-play`, `alternate-model` 중 하나이며 학습에만 적용된다. `solo-play`와 `alternate-model`은 상대도 함께 정하므로 `--opponent`보다 우선한다. 8절의 「학습 방식」 표를 참고한다. 예: `--training-strategy chain-all` |
| `--server-url URL` | 없음 | 학습 이벤트를 `pythonserver.py`에 전송한다. 일반 로컬 학습에는 지정하지 않는다. 자세한 내용은 뒤의 서버 절을 참고한다. |
| `--api-token 토큰` | 없음 | `--server-url`을 쓸 때의 인증 토큰. 환경 변수 `PUYOW_AI_TOKEN`으로도 지정할 수 있다. |
| `--evaluate-episodes 수` | `0` | 학습하지 않고 저장된 모델을 평가한다. 1 이상을 지정하면 승·패·무승부·승률과 연쇄 분포를 JSON으로 출력한다(13절 참고). |
| `--infer-observation JSON파일` | 없음 | 저장된 모델로 관측 JSON 한 건을 직접 추론한다. 학습은 하지 않는다. |
| `--export-gguf 모델폴더` | 없음 | Hugging Face Transformer 모델을 GGUF로 변환한다. 이 학습기가 만든 `.pt` 파일에는 사용할 수 없다. |
| `--gguf-output 경로` | `python/model-f16.gguf` | `--export-gguf` 결과 파일 경로다. |
| `--llama-cpp-converter 경로` | `llama.cpp/convert_hf_to_gguf.py` | GGUF 변환에 사용할 llama.cpp 변환 스크립트 경로다. |

`--export-gguf`, `--infer-observation`, `--evaluate-episodes`는 학습 대신 각각 변환·추론·평가를 실행한다. 한 번에 하나만 사용한다.

## 6. 학습 상세: 적 AI와 대전하며 학습

`python/bundledenemy.py`는 `src/js/puyow.js`에 탑재된 기본 제공 적들(단탈리온, 세레, 데카라비아, 벨리알, 암두시아스, 키마리스, 안드레알푸스)의 판단 알고리즘을 Python으로 옮긴 모듈이다. 솔로몬(외부 AI API 전용)·안드로말리우스는 이식 대상에서 제외했고, 플라우로스(Flauros)는 클래스는 옮겨 두었지만 원작처럼 아직 판단 로직이 없는 출시 예정 상태라 대전 상대 목록에 넣지 않았다. `--opponent` 옵션으로 학습 중 대전할 상대를 고른다.

| 값 | 동작 |
| --- | --- |
| `random` (기본값) | 매 에피소드마다 self-play(자기 자신과 대전) 또는 이식된 적 중 하나를 무작위로 골라 대전한다. |
| `self` | 항상 self-play로 대전한다. 상대측도 학습 중인 정책으로 행동을 고르므로(같은 epsilon-greedy 탐험을 그대로 적용), 상대가 이기면 곧 이번 정책이 스스로에게 진 것과 같다. |
| `solo` | 상대 없이 죽지 않고 버티는 것만 학습하는 옛 방식(`PuyoEnvironment`)을 쓴다. |
| `Dantalion`, `Seere`, `Decarabia`, `Belial`, `Amdusias`, `Kimaris`, `Andrealphus` | 지정한 적 하나로 고정해 계속 대전한다. |
| `QuietEdgeEnemy` | 뿌요를 터뜨리지 않으려 하고 중앙(X=2,3)에서 먼 열부터 채우는 학습 전용 연습 상대와 계속 대전한다. 원작 게임에는 없는 적이라 `random`에서는 뽑히지 않는다. `--training-strategy solo-play`가 이 상대를 자동으로 고른다. |

```powershell
python python/learning.py --episodes 1000 --opponent Kimaris
```

`solo`가 아닌 경우 학습 환경은 `PuyoDuelEnvironment`이며, 에이전트가 한 수를 두고 판정할 때마다 곧바로 상대(적 AI 또는 self-play 정책)도 자신의 판단으로 한 수를 둔다. 두 필드 사이의 ATTACK·방해뿌요 교환도 함께 시뮬레이션하므로, 상대를 이기면(적 필드가 패배 칸에 닿거나 더 이상 둘 곳이 없으면) 큰 보상을, 지면 큰 페널티를 받는다.

`solo` 이외의 대전 모드에서는 상대 선택과 별개로 다음 값도 매 에피소드마다 무작위로 정해진다.

- **룰**: 기본 룰과 피버 룰 중 하나를 50%씩 고른다. 피버 룰은 일반/피버 필드 이원화, 상쇄 7회 게이지, 플레이어별 다음 피버 시간, 제한 시간, 목표 연쇄 변경, 피버 중 최대 연쇄 우선 적 판단을 실행한다. 피버 패턴은 별도 복사본이 아니라 실행 시 `PuyoW.common.getFeverStageDefinitions()`로 실제 게임 데이터 54개를 읽어 색상 수와 지급쌍에 맞춰 배치한다.
- **색상 수**: 3색, 4색, 5색 중 하나를 무작위로 골라 그 수만큼의 색으로만 뿌요 쌍을 생성한다(관측 벡터 채널 수 자체는 항상 5색 기준으로 고정이며, 쓰지 않는 채널은 0으로 남는다).

브라우저 게임은 `game.elapsed`의 실제 경과 밀리초를 관측값에 넣는다. CPU 속도로 즉시 진행되는 오프라인 학습에는 벽시계 시간이 의미 없으므로 양측 한 턴을 3초로 간주해 마진 레이트와 시간 진행 배율, 피버 제한 시간을 결정적으로 진행한다.

## 7. 상세: 서버 API와 함께 실행

서버 전송 모드를 사용하면 먼저 [python/pythonserver.py](../python/pythonserver.py)를 실행한다. 실행 전에 파일 상단의 `SERVER_CONFIG["learning_token"]` 값을 학습기와 같은 토큰으로 직접 설정한다. 이 값은 개발용 설정이며 공개 서버에는 토큰을 소스에 저장하지 않아야 한다. 현재 구현은 단일 문자열 토큰만 검사한다. TODO에 적힌 여러 API 키의 OR 인증(토큰 컬렉션)은 아직 구현되어 있지 않다.

localhost나 루프백 주소(`127.0.0.1`, `::1` 등)에서 온 요청은 예외다. CLI에서 토큰을 `"localhost"`로 보내면 `SERVER_CONFIG["learning_token"]` 설정값과 무관하게 허용한다. `lngui.py`는 서버 URL을 입력받지 않는 로컬 학습 도구이므로 이 서버 연동을 사용하지 않는다. 루프백이 아닌 주소, 또는 `"localhost"`가 아닌 틀린 토큰에는 이 예외가 적용되지 않고 기존처럼 거부된다. 빈 문자열 토큰은 이 예외 대상이 아니므로 루프백에서도 거부된다.

Python 서버 실행:

```powershell
python python/pythonserver.py 9891
```

포트 번호를 생략하면 `SERVER_CONFIG["port"]`의 기본값 `9891`을 사용한다.

서버가 실행된 상태에서 다른 PowerShell 창을 열어 CLI 학습기를 실행한다.

```powershell
python python/learning.py `
	--episodes 1000 `
	--server-url http://localhost:9891 `
	--api-token localhost `
	--device auto
```

원격 서버에는 `--api-token`으로 Python 서버의 `SERVER_CONFIG["learning_token"]`과 같은 값을 지정한다.

```powershell
python python/learning.py `
	--episodes 100 `
	--server-url http://localhost:9891 `
	--api-token "SERVER_CONFIG에 설정한 토큰" `
	--output python/experiment.pt
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

## 8. 상세: 학습 방식

이 게임은 한 수를 두었을 때 어떤 보드가 되는지(착지·폭발·연쇄·ATTACK)를 규칙만으로 정확히 계산할 수 있다. `python/bundledenemy.py`에 그 규칙이 그대로 이식되어 있고, 학습기·서버가 같은 함수를 쓴다. 그래서 학습 방식도 이 성질에 맞췄다.

- **애프터스테이트 가치 학습**: 신경망은 `V(한 수를 둔 직후 상태)` 하나만 출력한다. 실제 배치는 놓을 수 있는 후보마다 규칙으로 결과 보드를 만들어 보고 `즉시 보상 + 감가율 × V(결과 상태)`가 가장 큰 것을 고른다. 규칙으로 알 수 있는 부분을 신경망이 다시 배우지 않아도 되고, 24개 행동이 가치 함수 하나를 공유하므로 같은 대전 수로도 훨씬 빨리 는다. 놓을 수 없는 자리는 후보를 만들 때 빠지므로 불가능한 배치를 학습하거나 고르는 일도 없다.
- **결과 상태의 조작 쌍은 "다음 쌍"이다**: 애프터스테이트는 사실상 "다음 턴이 시작될 때의 내 상태"이므로, 관측 벡터의 조작 쌍 자리에는 이번 수의 다음 쌍이 들어간다. 덕분에 한 수만 평가해도 다음 쌍까지 고려한 판단이 된다. 게임의 솔로몬 프롬프트가 이미 보내는 `suppliedPuyos`의 `next_1`이 이 값이다.
- **보드를 2차원 그대로 보는 합성곱 신경망**: 6×12 보드를 1차원으로 펴지 않고 채널 7개(빈 칸·방해뿌요·5색)의 평면 그대로 합성곱에 넣는다. 같은 색이 붙어 있는지, 어느 열이 높은지 같은 연쇄의 근거는 위치를 옮겨도 같은 특징이기 때문이다. 조작 쌍과 스칼라 상태 24개는 합성곱을 지난 특징 뒤에 이어 붙인다.
- **n스텝 목표값**: 연쇄는 여러 수에 걸쳐 쌓았다가 한 번에 터지므로, 목표값을 만들 때 다음 한 수가 아니라 `learning.N_STEP_RETURN`(기본 3)수까지의 실제 보상을 이어 본다. 그만큼 보상이 앞 수까지 빨리 전달된다.
- **보상 계약**: 한 수의 즉시 보상은 `common.move_reward()`의 `ATTACK + 연쇄 가중치`다. 연쇄 가중치는 `common.chain_reward()`이며 피버 상태가 아니면 `5 × 연쇄^2`, 피버 중에는 그 5분의 1인 `1 × 연쇄^2`다. 피버 필드는 목표 연쇄가 이미 깔린 채로 주어져 같은 연쇄라도 스스로 쌓아 만든 연쇄보다 쉽기 때문이다. 감가율은 `common.DISCOUNT_GAMMA`(0.70)다. 오프라인 학습, 서버 추론, 서버의 온라인 학습, 브라우저 ONNX 추론이 모두 이 계약을 함께 쓴다.
- **승패는 마지막 상태의 가치**: 승리 `+245`(`WIN_REWARD`)와 패배 `-245`(`LOSS_REWARD`)는 마지막 수의 보상이 아니라 **대전이 끝난 그 상태의 가치**로 학습한다. 보상으로만 주면 죽은 보드의 가치가 0이 되어, 후보 중 "두는 순간 지는 수"가 안전한 수보다 좋아 보이는 문제가 생긴다. 245는 피버 상태가 아닐 때의 7연쇄 가중치(`5 × 7^2`)와 같은 크기로, "한 판을 이기는 것"을 "7연쇄를 한 번 내는 것"과 같은 값으로 본다는 뜻이다.
- **게임 시간**: 종료 가치에는 경과 시간 보정이 함께 들어간다(`common.terminal_reward()`). 이긴 판은 빨리 끝낼수록, 진 판은 오래 버틸수록 값이 높다. 크기는 피버 상태가 아닐 때의 2연쇄 가중치(20)가 게임 시간 120초와 같도록 맞춰 두어 연쇄·승패 가중치보다 훨씬 작으며, 관측 벡터의 `elapsed_ms`와 같은 상한(10분)에서 잘린다. 그래서 시간 보정이 승패의 부호를 뒤집는 일은 없다.
- **탐험**: 학습 중에는 일정 확률로 후보 중 하나를 무작위로 고른다. 이 확률은 1.0에서 시작해 전체 에피소드의 절반 지점에서 0.05까지 내려가며, 남은 절반은 거의 모델 자신의 판단으로 둔다. 무작위로 고를 때도 놓을 수 있는 후보 안에서만 고른다.

방해뿌요 낙하는 무작위라서 애프터스테이트에 반영하지 않고, 상쇄하고 남은 피해량만 상태의 스칼라로 남긴다. 이 근사는 학습기와 서버가 같은 함수(`learning.enumerate_afterstates()`)를 쓰므로 어느 쪽에서도 같게 적용된다.

### 학습 방식

`lngui.py`의 `Training strategy` 콤보박스나 `learning.py`의 `--training-strategy` 옵션으로 학습 방식을 고를 수 있다. 기본값 `standard`는 이 옵션이 생기기 전과 같은 학습이다. 앞의 네 방식은 연쇄를 더 노리도록 학습 과정을 바꾸고, 뒤의 두 방식은 대전 상대를 바꾼다.

| 값 | GUI 표시 (영어 / 한국어) | 동작 |
| --- | --- | --- |
| `standard` (기본값) | `Standard` / `기본` | 기존 방식이다. 탐험은 놓을 수 있는 후보 중 무작위이고 n스텝은 3이다. |
| `chain-guided` | `Chain-guided exploration` / `연쇄 유도 탐험` | 탐험하는 수의 절반을 연쇄를 쌓는 적 AI의 배치로 둔다. 안내 적은 에피소드마다 암두시아스·키마리스·안드레알푸스 중 하나를 고른다. 무작위 탐험만으로는 5연쇄 이상을 거의 경험하지 못해, 가치망이 "연쇄를 쌓아 둔 보드"의 가치를 배우기 어렵기 때문이다. |
| `chain-curriculum` | `Chain curriculum` / `연쇄 커리큘럼` | 에피소드의 30%는 실제 피버 패턴을 연쇄 씨앗으로 깐 필드에서 시작하고, 20%는 방해뿌요 교환이 없는 `solo`로 진행한다. 씨앗의 색은 무작위로 섞으므로 곧바로 터지지 않고 몇 수에 걸쳐 방아쇠 색을 맞춰야 한다. |
| `long-nstep` | `Long n-step return` / `긴 n스텝 목표값` | 목표값을 만들 때 3수 대신 8수까지의 실제 보상을 이어 본다. 연쇄 보상이 앞 수까지 더 빨리 전달된다. |
| `chain-all` | `All chain strategies` / `연쇄 방식 모두 사용` | 위 세 방식을 모두 함께 쓴다. |
| `solo-play` | `Solo play` / `솔로 플레이` | 뿌요를 터뜨리지 않으려 하고 중앙(X=2,3)에서 먼 열부터 채우는 연습 상대(`QuietEdgeEnemy`)하고만 대전한다. 상대가 거의 공격하지 않으므로 방해뿌요에 쫓기지 않고 자기 연쇄를 쌓아 이기는 수순만 연습할 수 있다. |
| `alternate-model` | `Play against saved models` / `대체 모델과 플레이` | `python/puyow/`의 `modelNN.pt` 체크포인트 중 하나를 에피소드마다 무작위로 골라 상대로 세운다. 아래의 주의 사항을 참고한다. |

```powershell
python python/learning.py --episodes 5000 --output python/puyow/chain.pt --training-strategy chain-all
```

- 모든 방식은 **학습 과정과 상대만** 바꾼다. 보상·감가율·관측값·행동 계약은 그대로이므로, 어떤 방식으로 학습한 모델이든 서버·브라우저 추론에 그대로 쓸 수 있고 기존 모델을 다른 방식으로 이어 학습해도 된다.
- 반대로 "가장 좋은 수"를 판단하는 기준 자체는 바뀌지 않는다. 이 방식들은 모델이 그 기준에 더 빨리, 더 제대로 도달하도록 돕는다. 효과는 `--evaluate-episodes`의 연쇄 분포로 비교한다(13절 참고).
- `chain-guided`는 탐험하는 수마다 적 AI가 판단하므로, 탐험 비율이 높은 학습 초반이 느려진다.
- `chain-curriculum`의 연쇄 씨앗은 피버 룰과 같은 방식으로 게임 소스의 피버 패턴을 읽으므로 Node.js가 필요하다. `solo` 에피소드는 이길 수 없으므로 로그의 승수가 그만큼 줄어든다.
- 학습 로그에는 에피소드의 최대 연쇄 수가 `max_combo=`로 함께 출력된다.

`alternate-model`(대체 모델과 플레이)은 다음 규칙으로 상대를 고른다.

- 상대 후보는 `python/puyow/` **바로 아래**에서 파일명이 `modelNN.pt` 형식(숫자 두 자리 이상, 예: `model01.pt`, `model02.pt`, `model100.pt`)인 파일뿐이다. 파일명만 보고 고르며, 이 단계에서 체크포인트 내용은 확인하지 않는다. `default.pt`는 이름 규칙에 맞지 않아 상대 목록에 들어가지 않는다.
- 쓸 수 있는 파일이 하나도 없으면 학습을 시작하지 않고 오류로 끝난다. 이때 `--output` 체크포인트는 전혀 건드리지 않는다.
- 매 에피소드마다 남은 후보 중 하나를 무작위로 고른다. 선택은 학습 시드에서 파생되므로 같은 시드로 재현된다.
- 상대 모델을 읽거나 그 모델이 수를 고르는 중에 오류가 나면 **그 에피소드는 통째로 버린다**. 부분 trajectory는 학습 표본이 되지 않고 승패 통계에도 들어가지 않으며, 로그에 `alternate_model_failed`가 남고 그 파일은 이후 선정 대상에서 빠진다.
- 후보가 모두 제외되면 로그에 `alternate_model_exhausted`를 남기고 학습을 중단한다. 중단해도 그때까지 학습한 가중치는 `--output`에 정상적으로 저장된다.
- 상대 모델은 학습 중인 에이전트와 같은 `ValueNetwork`·애프터스테이트·행동 번호 계약을 쓰며, 상대 필드의 관측값으로 탐험 없이(greedy) 수를 고른다.

```powershell
python python/learning.py --episodes 2000 --output python/puyow/default.pt --training-strategy alternate-model
```

## 9. 상세: 관측값과 행동

현재 Python 환경의 모델 버전 3 관측 벡터는 길이 `528`이다(버전 2와 같은 계약이다).

- 6×12 보드의 빈 칸, 방해뿌요, 5색 뿌요 원-핫 채널: `504`개
- 현재 뿌요 쌍의 두 색 원-핫 정보: `10`개
- 정규화된 전투·룰·시간·피버 상태: `14`개. 순서는 ATTACK, 턴, DAMAGE, 피버 룰 여부, 싹쓸이 티켓, 경과시간, 마진 레이트, 시간 진행 배율, 피버 활성, 게이지, 다음 피버 시간, 목표 연쇄, 남은 시간, 피버 DAMAGE다.

보드 좌표는 `board[y][x]`이며 `y=0`이 바닥이다. 행동 번호는 `열 * 4 + 회전`으로 계산한다.

- 열: `0`~`5`
- 회전: `0`~`3`
- 전체 행동 수: `24`

관측값과 행동 계약은 `pythonserver.py` API로 전송하는 데이터에도 그대로 사용된다.

## 10. 상세: 브라우저 게임 상태

브라우저 기반 학습 환경 확장과 적 인공지능 개발에는 별도 학습 전용 API 대신 `PuyoW.getGameState()`를 사용한다. 이 함수는 반환 객체를 변경해도 게임 내부 상태가 바뀌지 않는 읽기 전용 스냅샷이며, 게임이 없거나 튜토리얼 중이면 `null`을 반환한다. 현재 `learning.py`의 독립 `PuyoDuelEnvironment`는 이 API를 호출하지 않고 Python 보드를 직접 시뮬레이션하며, 아래 상태는 브라우저 측 기능을 확장할 때의 공통 조회 계약이다.

```js
const state = window.PuyoW.getGameState();
```

최상위 `mode`는 `versus`, `practice`, `watch`, `continuous_fever`, `puzzle` 중 하나이고, `rule`은 `standard`, `fever`, `fever_start`, `continuous_fever` 중 하나다. `allClearTicketEnabled`는 싹쓸이 티켓이 기본 룰 전용임을 나타낸다.

`player`와 `opponent`에는 같은 형식으로 다음 상태가 들어 있다.

- `board`: 현재 조작 필드의 배치 뿌요 목록. 피버 중에는 피버 필드다.
- `normalBoard`: 피버 활성 여부와 관계없이 보관하는 일반 필드의 배치 뿌요 목록.
- `fever`: 양측 피버 상태. `leftTime`은 해당 플레이어의 피버 남은 시간이며, `field.puyos`는 활성 여부와 관계없이 피버 전용 필드의 배치 뿌요 목록이다. 호환성을 위해 `field.cells`도 제공한다.
- `allClearTicket`: 기본 룰에서 다음 색 뿌요 폭발에 쓸 싹쓸이 티켓 보유 여부.
- `nextPairs`: 양측 모두 현재 수 뒤의 앞 두 쌍만 제공한다. 내부 CPU 탐색용 대기열 전체를 노출하지 않는다.

연속 피버의 남은 시간과 목표 상태는 기존 최상위 `fever.leftTime`, `fever.targetCombo` 등에 들어 있다. `/apis/learning`과 솔로몬 배치 요청은 같은 528개 관측 계약을 사용하며, 솔로몬 프롬프트의 `currentState.elapsedMs`는 JS 게임 루프가 관리하는 실제 `game.elapsed`다.

## 11. 상세: 현재 구현 범위

현재 학습 환경에는 일반 색 뿌요의 연결 폭발, 연쇄, 중력, 패배 위치, 일반 방해뿌요 교환, 기본 룰 싹쓸이 티켓, 시간별 마진/공격 배율, 실제 게임 패턴 기반 피버 룰, 이식된 적 AI 또는 self-play와의 대전, 룰·색상 수의 에피소드별 무작위 선택이 구현되어 있다. 다음 부분은 의도적으로 제한되어 있다.

- 딱딱뿌요(하드 방해뿌요)와 철구뿌요(시뮬레이터 전용)
- 연속 피버 단독 모드(대전 학습은 기본 룰과 피버 룰을 대상으로 한다)
- 실제 브라우저 게임 루프의 상태 수집 및 행동 주입
- 안드레알푸스의 Worker 비동기 3수 탐색(현재는 동기 시간 제한 탐색으로 대체)

현재 `/apis/learning` API는 학습 이벤트를 수신하고 세션 통계만 보관하며, 이 경로로 받은 전이가 모델 가중치를 바꾸지는 않는다. `src/js/puyow.js`는 사용자 게임의 실제 배치·정산 결과를 해당 API 계약으로 전송하며, 브라우저에서 `configureLearningApi()`를 호출해야 전송이 활성화된다. 실제로 모델 가중치를 갱신하는 경로는 위 "솔로몬과 대전하며 실시간으로 학습"의 `/apis/solomonlearning` 하나뿐이다.

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

## 12. 상세: 솔로몬과 대전하며 실시간으로 학습

AI 제공자를 **Local AI**로 두고 **극한** 난이도로 적 **솔로몬**과 대전하며 설정 화면의 **`역으로 모델 학습`** 체크박스를 켜 두면(색상 수와 룰은 가리지 않는다), 그 대전에서 나온 수로 서버에 로드된 모델을 추가 학습한다. 솔로몬의 배치는 원래도 이 서버의 모델이 정하므로, 사람과 실제로 겨룬 결과를 그대로 그 모델에 되먹이는 셈이다. 여기에 더해, **사람이 이긴 대전에서는 그 사람이 둔 수도** 모델이 플레이어 쪽을 조작해 이긴 수순으로 보고 함께 학습한다.

`역으로 모델 학습`은 기본적으로는 꺼져 있다. 꺼 두면 솔로몬 자신이 둔 수를 포함해 이 기능 전체가 동작하지 않는다 — 솔로몬 배치 프롬프트에 학습 세션 ID가 실리지 않고, 대전이 끝나도 `/apis/solomonlearning`으로 어떤 요청도 나가지 않으며, 서버에 로드된 모델의 가중치는 그대로 유지된다. 체크박스 이름의 "역으로"는 `learning.py`로 하는 평소의 오프라인 일괄 학습과 반대로, 실제 서비스 중인 모델을 대전 도중 그 자리에서 갱신한다는 뜻이다.

준비할 것은 아래 "학습한 모델로 게임과 대전" 절과 같다. `pythonserver.py`를 실행하고 게임 설정에서 Local AI를 선택한 뒤, `역으로 모델 학습`을 켜고, 적 선택 화면에서 AI 난이도를 극한으로 두고 솔로몬을 고르면 된다.

동작은 다음과 같다.

1. 게임이 대전마다 학습 세션 ID를 만들어 솔로몬 배치 요청에 함께 보낸다. 조건에 맞지 않는 대전(다른 제공자, 극한이 아닌 난이도, 솔로몬이 아닌 적, `역으로 모델 학습`이 꺼진 경우)에서는 이 값을 보내지 않으므로 기존 요청과 완전히 같다.
2. 서버는 매 요청마다 자신이 고른 수의 애프터스테이트와 즉시 보상(`ATTACK + 연쇄 가중치`)을 세션에 순서대로 담아 둔다. 오프라인 학습과 같은 함수로 만들기 때문에 두 경로의 학습 표본 형식이 같다.
3. 학습은 매 수마다 하지 않는다. 승패가 확정되어 **게임 종료 화면이 뜨는 시점**에 그 판에서 모은 수를 표본으로 바꿔 한 번에 반영하고, 그 결과를 `SERVER_CONFIG["model_path"]`의 체크포인트에 저장한다. 한 수의 목표값은 바로 다음 수의 보상과 감가한 다음 애프터스테이트의 가치이며, 마지막 수는 더 진행할 상태가 없으므로 승패와 경과 시간을 합친 종료 가치(`common.terminal_reward()`, 승리 기준 +245에서 시간 보정)만 목표가 된다. 경과 시간은 그 쪽이 마지막으로 둔 수의 관측값에서 읽는다.
4. 위험 높이나 응답 오류로 솔로몬이 대체 인공지능을 사용한 턴은 요청 자체가 없다. 그 턴을 사이에 둔 앞 수는 다음 상태를 알 수 없으므로 표본으로 만들지 않는다.

### 사람이 이긴 대전의 수순을 함께 학습

관측 벡터와 행동 번호에는 "누가 두었는지"를 나타내는 값이 없다. 어느 쪽이든 자기 필드·자기 조작 쌍·자기 상태만 담는 자기중심 표현이라, 사람이 둔 수도 솔로몬이 둔 수와 똑같은 전이로 만들 수 있다. 이 점을 이용해 사람이 이긴 대전의 수순을 모델에 되먹인다.

이 하위 기능은 별도의 설정이 없다. 위에서 설명한 `역으로 모델 학습` 체크박스 하나가 솔로몬 자신의 학습과 사람의 수 학습을 함께 켜고 끈다.

1. 대전 중 사람이 뿌요를 확정할 때마다 게임이 그 시점의 관측값과 배치(`열*4+회전`)를 같은 학습 세션에 보낸다. 솔로몬의 수와 사람의 수는 서로 다음 상태가 이어지지 않으므로 세션 안에서 **쪽별로 나누어** 쌓는다.
2. 사람의 수도 솔로몬의 수와 똑같이 서버가 애프터스테이트와 `ATTACK + 연쇄 가중치` 보상을 다시 계산한다. 그래야 가치의 기준이 한쪽으로 흔들리지 않는다. 사람이 둔 수의 요청에는 그 수의 다음 쌍(`nextPair`)도 함께 담아 보내며, 서버는 이 값을 애프터스테이트의 조작 쌍 자리에 넣는다.
3. 대전이 끝났을 때 **사람이 이긴 경우에만** 사람 쪽 표본을 마지막 수에 승리 종료 가치(+245에서 시간 보정)를 붙여 학습에 넣는다. 사람이 이기지 못한 대전의 사람 쪽 수는 그대로 버린다.
4. 사람의 승리 수순은 솔로몬 자신의 수보다 높은 비중으로 학습한다. 이 비중은 `pythonserver.py`의 `SOLOMON_PLAYER_WIN_TRAINING_WEIGHT`(기본 `10.0`)로 조절하며, 솔로몬 자신의 수는 항상 `1.0`이다. 값을 올릴수록 사람이 이긴 수순을 더 강하게 따라 배우고, `1.0`로 두면 양쪽을 같은 비중으로 학습한다.

비중은 손실을 계산하기 전에 평균이 1이 되도록 정규화하므로, 값을 바꿔도 학습률을 다시 맞출 필요가 없다. 사람 쪽 표본이 없는 대전에서는 모든 비중이 1이 되어 기존 학습과 완전히 같게 동작한다.

Local AI를 쓸 때는 게임이 이번 턴에 실제로 사용할 수 있는 배치 목록(`usablePlacements`)도 함께 보낸다. 서버가 받는 관측값에는 화면 12줄만 담겨 있어 뿌요가 목표 열까지 가로로 지나갈 수 있는지, 회전할 때 벽에 밀리는지, 화면 위 숨김 행에 자리가 있는지를 알 수 없기 때문이다. 서버는 이 목록이 오면 그 안에서만 가치가 가장 높은 배치를 고르므로, 게임이 쓸 수 없는 좌표를 응답해 "응답받은 솔로몬 배치를 현재 뿌요에 사용할 수 없습니다" 오류로 일시정지되는 일이 없다. 다른 AI 제공자에게 보내는 프롬프트에는 이 항목을 넣지 않는다.

저장 형식은 `learning.py`가 쓰는 것과 같고 모델 버전·관측 벡터·행동 수·시드를 그대로 유지하므로, 이렇게 갱신한 모델도 `learning.py`로 이어서 학습하거나 다른 게임 세션에서 그대로 사용할 수 있다. 저장은 임시 파일에 먼저 쓴 뒤 교체하므로 저장 중에 서버가 멈춰도 기존 모델 파일이 깨지지 않는다.

학습 결과는 게임의 브라우저 콘솔에 `솔로몬 학습 적용 결과`로 기록되며, 반영한 표본 수(`transitions`)와 그중 사람이 둔 수(`playerTransitions`), 마지막 손실값을 확인할 수 있다. 이 요청이 실패하더라도 게임 진행에는 영향을 주지 않는다.

## 13. 상세: 학습한 모델로 게임과 대전

`default.pt`를 게임의 AI 제공자로 쓰려면 실제 LM Studio 앱이 아니라, Chat Completions 형식만 흉내 내는 `pythonserver.py`를 실행한다.

1. [python/pythonserver.py](../python/pythonserver.py)의 `SERVER_CONFIG`에서 `model_path`를 학습된 `.pt` 파일로, `learning_token`을 사용할 API 키 문자열로 설정한다. 기본 `model_path`는 `python/puyow/default.pt`다.
2. `python python/pythonserver.py 9891`로 서버를 실행한다.
3. 게임 설정에서 AI 제공자로 **LM Studio**를 선택하고 URL에 `http://localhost:9891`, API 키에 `learning_token`과 같은 값을 넣는다. 모델명은 비어 있지 않은 임의 문자열(예: `puyow-dqn`)을 넣는다. 게임 클라이언트가 URL 뒤에 `/v1/chat/completions`를 붙여 요청한다.
(로컬에서 플레이하는 경우, API 키에는 `localhost` 를 입력해도 된다.)
4. 설정을 저장 후, 다시 설정 화면에 들어와 "AI API 테스트" 버튼을 클릭한다. 몇초 후 테스트 결과가 메시지로 나타나면, 메인 메뉴를 거쳐 게임으로 들어가 적 "솔로몬"을 선택한다.

```
로컬에서 플레이 시 설정의 예
AI 서비스 제공자 : LM Studio
AI API URL : http://localhost:9891
AI API KEY : localhost
사용 모델명 : puyow-dqn
```

`model_path`가 비어 있거나 존재하지 않는 파일이면 `/v1/chat/completions`만 404를 반환한다. 이 경우에도 정적 파일 제공과 `/apis/learning` 학습 이벤트 API는 계속 실행된다.

`npm start`로 띄우는 [nodeserver.js](../nodeserver.js)도 같은 `/apis/localmodelinfo`·`/v1/chat/completions` 계약을 제공하므로, 파이썬 없이도 게임 설정에서 **Local AI**를 골라 솔로몬과 대전할 수 있다. 이 서버는 `.pt` 대신 [src/onnx/default.onnx](../src/onnx/default.onnx)를 `npm install`로 설치되는 `onnxruntime-node`로 추론하며, 모델 경로는 `nodeserver.js`의 `LOCAL_AI_MODEL_PATH` 상수로 바꾼다. 이 경로에 파일이 없으면 `/apis/localmodelinfo`가 `available: false`를 돌려주어 게임에서 Local AI를 고를 수 없고, 정적 파일과 다른 API는 그대로 동작한다. 배치를 고르는 규칙(애프터스테이트 보상 + 0.70 × 가치)은 `pythonserver.py`와 같다. 역학습은 지원하지 않아 `/apis/solomonlearning`은 요청을 받기만 하고 모델을 바꾸지 않는다.

서버 없이 관측 벡터 하나를 직접 추론하려면 528개 숫자 배열 JSON을 준비하고 다음처럼 실행한다. 결과는 `action`, `x`, `rotation` JSON이며, 가득 찬 열과 벽을 침범하는 행동은 후보에서 아예 빠진다. 실제 대전과 같은 기준으로 평가하려면 배열 대신 `{"observation": [...], "nextPair": [3, 4]}` 형식으로 다음 쌍까지 넣는다(색 번호는 red·green·yellow·blue·purple 순서인 0~4다).

```powershell
python python/learning.py --output python/puyow/default.pt --infer-observation observation.json
```

학습 없이 epsilon=0 승률을 확인하려면 다음 명령을 사용한다.

```powershell
python python/learning.py --output python/puyow/default.pt --evaluate-episodes 100 --opponent random
```

출력 JSON에는 승·패·무승부·승률과 함께 학습 중인 모델 쪽의 연쇄 통계가 들어 있다. 학습 방식을 바꿔 가며 모델이 고연쇄를 더 노리게 되었는지 비교할 때 쓴다.

| 키 | 내용 |
| --- | --- |
| `average_max_combo` | 에피소드별 최대 연쇄 수의 평균 |
| `max_combo_distribution` | 에피소드별 최대 연쇄 수(연쇄를 한 번도 못 냈으면 `0`)마다 그 에피소드 수 |
| `average_combo` | 실제로 터진 수만의 평균 연쇄 수. 터진 수가 없으면 `0` |
| `combo_distribution` | 실제로 터진 수의 연쇄 수마다 그 횟수 |

## 14. 참고: 도움말

전체 옵션은 다음 명령으로 확인할 수 있다.

```powershell
python python/learning.py --help
```

## 15. 참고: GGUF 변환

LM Studio에서 불러오는 GGUF는 일반 PyTorch 파일의 확장자를 바꿔서 만드는 형식이 아니다. 지정한 글의 방식처럼 `llama.cpp` 도구의 `convert_hf_to_gguf.py`를 사용해 `config.json`과 Transformer 가중치를 가진 Hugging Face 모델 디렉터리를 변환해야 한다.

`learning.py`에는 이 변환기를 호출하는 export 경로가 포함되어 있다.

```powershell
python python/learning.py `
	--export-gguf models\my-transformer `
	--llama-cpp-converter llama.cpp\convert_hf_to_gguf.py `
	--gguf-output python\my-model-f16.gguf
```

변환 대상 디렉터리에는 최소한 `config.json`과 해당 모델의 Transformer 가중치 파일이 있어야 한다. 기본 출력 형식은 `f16`이다. 이후 LM Studio에서 필요에 따라 지원되는 양자화 형식으로 추가 변환하거나, 이미 양자화된 GGUF를 직접 사용할 수 있다.

현재 `learning.py`가 학습하는 `default.pt`는 `ValueNetwork`라는 사용자 정의 합성곱 가치망 체크포인트다. 이는 Llama 등의 언어 모델 구조가 아니므로 `convert_hf_to_gguf.py`나 실제 LM Studio 앱에서 직접 사용할 수 없다. 다만 게임 설정에서 LM Studio 제공자를 선택해도 URL을 `pythonserver.py`로 지정하면, 이 서버가 Chat Completions 규격만 맞춰 이 모델을 그대로 서비스할 수 있다. 실제 LM Studio 앱에 넣으려면 별도의 Transformer 기반 모델과 그에 맞는 학습·변환 파이프라인이 필요하다.
