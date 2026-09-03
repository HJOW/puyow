# Puyo W 머신러닝

`python/learning.py`는 PyTorch 기반 DQN 학습 스크립트다. 기본 `random` 상대 모드는 학습 중인 정책과의 self-play 및 Puyo W 기본 적 전략의 Python 포팅본을 섞어 대전한다. 학습은 Puyo W의 핵심 보드 규칙을 간소화한 Python 환경에서 진행하며, 선택적으로 `pythonserver.py`의 인증된 학습 API에 각 에피소드의 관측값과 전이를 전송할 수 있다. 학습·모델 서비스에는 `pythonserver.py`를 사용하며 `nodeserver.js`는 사용하지 않는다.

## 사전 준비

저장소 루트에서 Python 3.10 이상, PyTorch, Node.js를 준비한다. Node.js는 Python 피버 환경이 `src/js/puyow.js`의 실제 `FEVER_STAGES`를 읽을 때 사용한다.
[https://www.python.org/](https://www.python.org/)

Python 설치 후 PyTorch 는 Windows PowerShell 에서 다음처럼 설치할 수 있다.

```powershell
python -m pip install torch
```

VS Code에서 `torch`를 찾지 못하면 PyTorch를 설치한 Python 인터프리터를 선택한다. CUDA를 사용할 경우 설치된 PyTorch가 해당 CUDA 환경을 지원해야 한다.

## 로컬 학습

게임 서버 없이 독립 학습을 실행하려면 다음 명령을 사용한다.

```powershell
python python/learning.py --episodes 1000 --device auto
```

주요 옵션은 다음과 같다.

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `--episodes` | `1000` | 학습 에피소드 수. 1 이상이어야 한다. |
| `--seed` | `2026` | Python과 PyTorch 난수 시드 |
| `--output` | `python/puyow/default.pt` | 모델 체크포인트 저장 경로. 실제 파일이 이미 있으면 해당 모델 가중치를 복원해 추가 학습한다. |
| `--device` | `auto` | `auto`, `cpu`, `cuda` 중 하나 |
| `--server-url` | 빈 값 | 학습 API가 실행 중인 서버 주소 |
| `--api-token` | 빈 값 | Python 서버의 `SERVER_CONFIG["learning_token"]` 값 |
| `--opponent` | `random` | 대전 상대. 아래 "적 AI와 대전하며 학습" 참고 |
| `--evaluate-episodes` | `0` | 학습 없이 epsilon=0으로 평가하고 승·패·무승부·승률을 출력할 에피소드 수 |
| `--infer-observation` | 미지정 | LM Studio·HTTP 서버 없이 공통 관측 JSON 하나를 직접 추론 |

학습이 끝나면 지정한 경로에 PyTorch 체크포인트가 저장되고, 같은 위치의 확장자를 `.json`으로 바꾼 메타데이터 파일도 생성된다. `--output` 경로에 실제 파일이 있으면 새 모델을 만들지 않고 그 파일의 가중치를 복원해 추가 학습한 뒤 같은 파일에 저장한다. 모델 버전, 관측 벡터 길이 또는 행동 수가 현재 계약과 다르면 오류로 중단하며 기존 파일을 덮어쓰지 않는다. optimizer·replay buffer·epsilon은 체크포인트에 저장하지 않으므로 추가 학습 실행마다 새로 시작한다. 기본 출력은 다음 두 파일이다.

```text
python/puyow/default.pt
python/puyow/default.json
```

체크포인트에는 모델 가중치, 모델 계약 버전, 관측 벡터 크기, 행동 개수, 학습 시드가 들어 있다. 현재 모델 버전은 `2`이며 이전 444개 관측 모델은 의도적으로 호환되지 않으므로 다시 학습해야 한다.

## GUI 학습기

명령행 대신 화면으로 학습을 다루려면 `python/lngui.py`를 실행한다.

```powershell
python python/lngui.py
```

Tkinter 창에는 모델 저장 경로, 에피소드 수, 서버 주소 입력란과 Start/Pause/Stop 버튼, 진행 게이지, 로그 패널이 있다. 창을 열면 에피소드 수는 `5000`, 서버 주소는 `http://localhost:<pythonserver.py의 SERVER_CONFIG["port"]>`로 미리 채워진다. 시드·디바이스·상대는 `learning.py`의 기본값(`--seed`, `--device`, `--opponent`와 동일)을 그대로 쓰며 GUI에서 따로 입력받지 않는다.

서버 주소가 `localhost`/`127.0.0.1`/`::1`을 가리키면(기본값이 그렇다), Start를 누를 때 GUI가 그 포트로 `pythonserver.py`를 직접 띄워 학습과 함께 운영한다. 이미 다른 프로세스가 그 포트를 쓰고 있으면 학습을 시작하지 않고 오류 창을 띄운다(별도로 `python python/pythonserver.py`를 미리 실행해 두지 않아도 된다는 뜻이며, 반대로 이미 실행 중인 서버가 그 포트를 쓰고 있으면 Start가 실패한다). 서버 주소를 원격 주소로 바꾸면 GUI는 서버를 직접 관리하지 않고, 이미 그 주소에서 실행 중인 서버로만 전이를 전송한다.

버튼 동작은 다음과 같다.

- **Start**: (로컬 주소라면) `pythonserver.py`를 먼저 띄운 뒤 학습을 별도 쓰레드에서 시작한다. Start가 비활성화되고 Pause·Stop이 활성화된다.
- **Pause**: 진행 중인 에피소드가 끝난 뒤 일시정지를 예약한다. 버튼이 "Resume"으로 바뀌며 실제로 정지가 반영될 때까지 비활성화되고, 반영되면 다시 활성화된다.
- **Resume**: 학습을 재개하고 버튼이 다시 "Pause"로 바뀐다.
- **Stop**: Pause·Stop 버튼을 즉시 비활성화하고, 진행 중인 에피소드가 끝나면 그때까지 학습한 가중치를 체크포인트(및 같은 경로의 `.json` 메타데이터)에 저장한다. GUI가 띄운 로컬 서버가 있으면 이때 함께 멈추고, Start 버튼을 다시 활성화한다.
- **창 닫기**: 학습을 즉시 포기한다. 이 경우 체크포인트를 저장하지 않으며, 기존 파일이 있었다면 전혀 손대지 않는다. GUI가 띄운 로컬 서버가 있으면 함께 멈춘다.

정상적으로 학습이 끝났을 때도 저장 직후 GUI가 띄운 로컬 서버를 함께 멈춘다. GUI는 학습 쓰레드가 만드는 로그·진행 상황을 큐에 적재하고 메인(화면) 쓰레드가 주기적으로 비우는 방식으로 화면이 멈추지 않게 한다. `python python/learning.py ...`로 직접 실행하는 기존 CLI 방식(및 별도로 `python python/pythonserver.py`를 직접 실행하는 방식)은 이 GUI와 무관하게 그대로 동작한다.

GUI가 기본으로 채우는 서버 주소(`http://localhost:<port>`)로 학습 전이를 보낼 때는 `SERVER_CONFIG["learning_token"]`을 따로 맞추지 않아도 된다. GUI가 API 토큰으로 항상 `"localhost"`를 보내고, `pythonserver.py`는 이 토큰을 실제로 localhost/루프백 주소에서 온 요청일 때만 서버 설정 토큰과 무관하게 허용하기 때문이다(아래 "서버 API와 함께 실행" 참고). 원격 서버이거나 다른(그러나 틀린) 토큰을 보낸 경우는 기존처럼 `SERVER_CONFIG["learning_token"]`과 정확히 일치해야 한다.

## 적 AI와 대전하며 학습

`python/bundledenemy.py`는 `src/js/puyow.js`에 탑재된 기본 제공 적들(단탈리온, 세레, 데카라비아, 벨리알, 암두시아스, 키마리스, 안드레알푸스)의 판단 알고리즘을 Python으로 옮긴 모듈이다. 솔로몬(외부 AI API 전용)·안드로말리우스는 이식 대상에서 제외했고, 플라우로스(Flauros)는 클래스는 옮겨 두었지만 원작처럼 아직 판단 로직이 없는 출시 예정 상태라 대전 상대 목록에 넣지 않았다. `--opponent` 옵션으로 학습 중 대전할 상대를 고른다.

| 값 | 동작 |
| --- | --- |
| `random` (기본값) | 매 에피소드마다 self-play(자기 자신과 대전) 또는 이식된 적 중 하나를 무작위로 골라 대전한다. |
| `self` | 항상 self-play로 대전한다. 상대측도 학습 중인 정책으로 행동을 고르므로(같은 epsilon-greedy 탐험을 그대로 적용), 상대가 이기면 곧 이번 정책이 스스로에게 진 것과 같다. |
| `solo` | 상대 없이 죽지 않고 버티는 것만 학습하는 옛 방식(`PuyoEnvironment`)을 쓴다. |
| `Dantalion`, `Seere`, `Decarabia`, `Belial`, `Amdusias`, `Kimaris`, `Andrealphus` | 지정한 적 하나로 고정해 계속 대전한다. |

```powershell
python python/learning.py --episodes 1000 --opponent Kimaris
```

`solo`가 아닌 경우 학습 환경은 `PuyoDuelEnvironment`이며, 에이전트가 한 수를 두고 판정할 때마다 곧바로 상대(적 AI 또는 self-play 정책)도 자신의 판단으로 한 수를 둔다. 두 필드 사이의 ATTACK·방해뿌요 교환도 함께 시뮬레이션하므로, 상대를 이기면(적 필드가 패배 칸에 닿거나 더 이상 둘 곳이 없으면) 큰 보상을, 지면 큰 페널티를 받는다.

`solo` 이외의 대전 모드에서는 상대 선택과 별개로 다음 값도 매 에피소드마다 무작위로 정해진다.

- **룰**: 기본 룰과 피버 룰 중 하나를 50%씩 고른다. 피버 룰은 일반/피버 필드 이원화, 상쇄 7회 게이지, 플레이어별 다음 피버 시간, 제한 시간, 목표 연쇄 변경, 피버 중 최대 연쇄 우선 적 판단을 실행한다. 피버 패턴은 별도 복사본이 아니라 실행 시 `PuyoW.common.getFeverStageDefinitions()`로 실제 게임 데이터 54개를 읽어 색상 수와 지급쌍에 맞춰 배치한다.
- **색상 수**: 3색, 4색, 5색 중 하나를 무작위로 골라 그 수만큼의 색으로만 뿌요 쌍을 생성한다(관측 벡터 채널 수 자체는 항상 5색 기준으로 고정이며, 쓰지 않는 채널은 0으로 남는다).

브라우저 게임은 `game.elapsed`의 실제 경과 밀리초를 관측값에 넣는다. CPU 속도로 즉시 진행되는 오프라인 학습에는 벽시계 시간이 의미 없으므로 양측 한 턴을 3초로 간주해 마진 레이트와 시간 진행 배율, 피버 제한 시간을 결정적으로 진행한다.

## 서버 API와 함께 실행

서버 전송 모드를 사용하면 먼저 [python/pythonserver.py](../python/pythonserver.py)를 실행한다. 실행 전에 파일 상단의 `SERVER_CONFIG["learning_token"]` 값을 학습기와 같은 토큰으로 직접 설정한다. 이 값은 개발용 설정이며 공개 서버에는 토큰을 소스에 저장하지 않아야 한다. 현재 구현은 단일 문자열 토큰만 검사한다. TODO에 적힌 여러 API 키의 OR 인증(토큰 컬렉션)은 아직 구현되어 있지 않다.

localhost나 루프백 주소(`127.0.0.1`, `::1` 등)에서 온 요청은 예외다. 토큰을 `"localhost"`로 보내면 `SERVER_CONFIG["learning_token"]` 설정값과 무관하게 허용한다. 같은 컴퓨터에서 게임이나 GUI 학습기(`lngui.py`)와 `pythonserver.py`를 함께 띄워 쓸 때 토큰을 따로 맞추지 않아도 되게 하기 위함이다. 루프백이 아닌 주소, 또는 `"localhost"`가 아닌 틀린 토큰에는 이 예외가 적용되지 않고 기존처럼 거부된다. 빈 문자열 토큰은 이 예외 대상이 아니므로 루프백에서 호출해도 거부된다.

Python 서버 실행:

```powershell
python python/pythonserver.py 9891
```

포트 번호를 생략하면 `SERVER_CONFIG["port"]`의 기본값 `9891`을 사용한다.

서버가 실행된 상태에서 학습기를 실행한다.

```powershell
python python/learning.py `
	--episodes 1000 `
	--server-url http://localhost:9891 `
	--device auto
```

`--api-token`에는 Python 서버의 `SERVER_CONFIG["learning_token"]`과 같은 값을 지정한다.

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

## 관측값과 행동

현재 Python 환경의 모델 버전 2 관측 벡터는 길이 `528`이다.

- 6×12 보드의 빈 칸, 방해뿌요, 5색 뿌요 원-핫 채널: `504`개
- 현재 뿌요 쌍의 두 색 원-핫 정보: `10`개
- 정규화된 전투·룰·시간·피버 상태: `14`개. 순서는 ATTACK, 턴, DAMAGE, 피버 룰 여부, 싹쓸이 티켓, 경과시간, 마진 레이트, 시간 진행 배율, 피버 활성, 게이지, 다음 피버 시간, 목표 연쇄, 남은 시간, 피버 DAMAGE다.

보드 좌표는 `board[y][x]`이며 `y=0`이 바닥이다. 행동 번호는 `열 * 4 + 회전`으로 계산한다.

- 열: `0`~`5`
- 회전: `0`~`3`
- 전체 행동 수: `24`

관측값과 행동 계약은 `pythonserver.py` API로 전송하는 데이터에도 그대로 사용된다.

## 브라우저 게임 상세 상태

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

연속 피버의 남은 시간과 목표 상태는 기존 최상위 `fever.leftTime`, `fever.targetCombo` 등에 들어 있다. `/apis/learning`과 솔로몬 DQN 요청은 같은 528개 관측 계약을 사용하며, 솔로몬 프롬프트의 `currentState.elapsedMs`는 JS 게임 루프가 관리하는 실제 `game.elapsed`다.

## 현재 구현 범위

현재 학습 환경에는 일반 색 뿌요의 연결 폭발, 연쇄, 중력, 패배 위치, 일반 방해뿌요 교환, 기본 룰 싹쓸이 티켓, 시간별 마진/공격 배율, 실제 게임 패턴 기반 피버 룰, 이식된 적 AI 또는 self-play와의 대전, 룰·색상 수의 에피소드별 무작위 선택이 구현되어 있다. 다음 부분은 의도적으로 제한되어 있다.

- 딱딱뿌요(하드 방해뿌요)와 철구뿌요(시뮬레이터 전용)
- 연속 피버 단독 모드(대전 학습은 기본 룰과 피버 룰을 대상으로 한다)
- 실제 브라우저 게임 루프의 상태 수집 및 행동 주입
- 안드레알푸스의 Worker 비동기 3수 탐색(현재는 동기 시간 제한 탐색으로 대체)

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

## 학습한 모델로 게임과 대전

`default.pt`를 게임의 AI 제공자로 쓰려면 실제 LM Studio 앱이 아니라, Chat Completions 형식만 흉내 내는 `pythonserver.py`를 실행한다.

1. [python/pythonserver.py](../python/pythonserver.py)의 `SERVER_CONFIG`에서 `model_path`를 학습된 `.pt` 파일로, `learning_token`을 사용할 API 키 문자열로 설정한다. 기본 `model_path`는 `python/puyow/default.pt`다.
2. `python python/pythonserver.py 9891`로 서버를 실행한다.
3. 게임 설정에서 AI 제공자로 **LM Studio**를 선택하고 URL에 `http://localhost:9891`, API 키에 `learning_token`과 같은 값을 넣는다. 모델명은 비어 있지 않은 임의 문자열(예: `puyow-dqn`)을 넣는다. 게임 클라이언트가 URL 뒤에 `/v1/chat/completions`를 붙여 요청한다.

`model_path`가 비어 있거나 존재하지 않는 파일이면 `/v1/chat/completions`만 404를 반환한다. 이 경우에도 정적 파일 제공과 `/apis/learning` 학습 이벤트 API는 계속 실행된다.

서버 없이 관측 벡터 하나를 직접 추론하려면 528개 숫자 배열 JSON을 준비하고 다음처럼 실행한다. 결과는 `action`, `x`, `rotation` JSON이며, 가득 찬 열과 벽을 침범하는 행동은 Q값 순위에서 건너뛴다.

```powershell
python python/learning.py --output python/puyow/default.pt --infer-observation observation.json
```

학습 없이 epsilon=0 승률을 확인하려면 다음 명령을 사용한다.

```powershell
python python/learning.py --output python/puyow/default.pt --evaluate-episodes 100 --opponent random
```

## 도움말

전체 옵션은 다음 명령으로 확인할 수 있다.

```powershell
python python/learning.py --help
```

## GGUF 변환

LM Studio에서 불러오는 GGUF는 일반 PyTorch 파일의 확장자를 바꿔서 만드는 형식이 아니다. 지정한 글의 방식처럼 `llama.cpp` 도구의 `convert_hf_to_gguf.py`를 사용해 `config.json`과 Transformer 가중치를 가진 Hugging Face 모델 디렉터리를 변환해야 한다.

`learning.py`에는 이 변환기를 호출하는 export 경로가 포함되어 있다.

```powershell
python python/learning.py `
	--export-gguf models\my-transformer `
	--llama-cpp-converter llama.cpp\convert_hf_to_gguf.py `
	--gguf-output python\my-model-f16.gguf
```

변환 대상 디렉터리에는 최소한 `config.json`과 해당 모델의 Transformer 가중치 파일이 있어야 한다. 기본 출력 형식은 `f16`이다. 이후 LM Studio에서 필요에 따라 지원되는 양자화 형식으로 추가 변환하거나, 이미 양자화된 GGUF를 직접 사용할 수 있다.

현재 `learning.py`가 학습하는 `default.pt`는 `PolicyNetwork`라는 사용자 정의 DQN MLP 체크포인트다. 이는 Llama 등의 언어 모델 구조가 아니므로 `convert_hf_to_gguf.py`나 실제 LM Studio 앱에서 직접 사용할 수 없다. 다만 게임 설정에서 LM Studio 제공자를 선택해도 URL을 `pythonserver.py`로 지정하면, 이 서버가 Chat Completions 규격만 맞춰 DQN을 그대로 서비스할 수 있다. 실제 LM Studio 앱에 넣으려면 별도의 Transformer 기반 모델과 그에 맞는 학습·변환 파이프라인이 필요하다.
