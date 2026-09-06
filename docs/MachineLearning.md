# Puyo W 머신러닝

`python/learning.py`는 PyTorch 기반 애프터스테이트 가치 학습 스크립트다. 24개 행동의 Q값을 따로 외우는 대신, 한 수를 둔 직후 보드 상태의 가치 하나만 배우고 배치는 규칙으로 미리 계산해 고른다(자세한 내용은 아래 "학습 방식" 절 참고). 기본 `random` 상대 모드는 학습 중인 정책과의 self-play 및 Puyo W 기본 적 전략의 Python 포팅본을 섞어 대전한다. 학습은 Puyo W의 핵심 보드 규칙을 간소화한 Python 환경에서 진행하며, 선택적으로 `pythonserver.py`의 인증된 학습 API에 각 에피소드의 관측값과 전이를 전송할 수 있다. 학습·모델 서비스에는 `pythonserver.py`를 사용하며 `nodeserver.js`는 사용하지 않는다.

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

체크포인트에는 모델 가중치, 모델 계약 버전, 관측 벡터 크기, 행동 개수, 학습 시드가 들어 있다. 현재 모델 버전은 `3`이다. 관측 벡터 계약(528개)은 버전 2와 같지만 신경망의 종류와 출력이 다르므로, 버전 2 이하의 체크포인트는 의도적으로 호환되지 않는다. 예전 모델 파일이 있다면 다시 학습해야 하며, 서버도 그런 파일은 읽지 않고 `/apis/localmodelinfo`가 `available: false`를 반환한다.

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

## 학습 방식

이 게임은 한 수를 두었을 때 어떤 보드가 되는지(착지·폭발·연쇄·ATTACK)를 규칙만으로 정확히 계산할 수 있다. `python/bundledenemy.py`에 그 규칙이 그대로 이식되어 있고, 학습기·서버가 같은 함수를 쓴다. 그래서 학습 방식도 이 성질에 맞췄다.

- **애프터스테이트 가치 학습**: 신경망은 `V(한 수를 둔 직후 상태)` 하나만 출력한다. 실제 배치는 놓을 수 있는 후보마다 규칙으로 결과 보드를 만들어 보고 `즉시 보상 + 감가율 × V(결과 상태)`가 가장 큰 것을 고른다. 규칙으로 알 수 있는 부분을 신경망이 다시 배우지 않아도 되고, 24개 행동이 가치 함수 하나를 공유하므로 같은 대전 수로도 훨씬 빨리 는다. 놓을 수 없는 자리는 후보를 만들 때 빠지므로 불가능한 배치를 학습하거나 고르는 일도 없다.
- **결과 상태의 조작 쌍은 "다음 쌍"이다**: 애프터스테이트는 사실상 "다음 턴이 시작될 때의 내 상태"이므로, 관측 벡터의 조작 쌍 자리에는 이번 수의 다음 쌍이 들어간다. 덕분에 한 수만 평가해도 다음 쌍까지 고려한 판단이 된다. 게임의 솔로몬 프롬프트가 이미 보내는 `suppliedPuyos`의 `next_1`이 이 값이다.
- **보드를 2차원 그대로 보는 합성곱 신경망**: 6×12 보드를 1차원으로 펴지 않고 채널 7개(빈 칸·방해뿌요·5색)의 평면 그대로 합성곱에 넣는다. 같은 색이 붙어 있는지, 어느 열이 높은지 같은 연쇄의 근거는 위치를 옮겨도 같은 특징이기 때문이다. 조작 쌍과 스칼라 상태 24개는 합성곱을 지난 특징 뒤에 이어 붙인다.
- **n스텝 목표값**: 연쇄는 여러 수에 걸쳐 쌓았다가 한 번에 터지므로, 목표값을 만들 때 다음 한 수가 아니라 `learning.N_STEP_RETURN`(기본 3)수까지의 실제 보상을 이어 본다. 그만큼 보상이 앞 수까지 빨리 전달된다.
- **보상 계약**: 한 수의 즉시 보상은 `common.move_reward()`의 `ATTACK + 연쇄^2`다. 감가율은 `common.DISCOUNT_GAMMA`(0.99)다. 오프라인 학습, 서버 추론, 서버의 온라인 학습이 모두 이 상수들을 함께 쓴다.
- **승패는 마지막 상태의 가치**: 승리 `+50`(`WIN_REWARD`)과 패배 `-50`(`LOSS_REWARD`)은 마지막 수의 보상이 아니라 **대전이 끝난 그 상태의 가치**로 학습한다. 보상으로만 주면 죽은 보드의 가치가 0이 되어, 후보 중 "두는 순간 지는 수"가 안전한 수보다 좋아 보이는 문제가 생긴다.
- **탐험**: 학습 중에는 일정 확률로 후보 중 하나를 무작위로 고른다. 이 확률은 1.0에서 시작해 전체 에피소드의 절반 지점에서 0.05까지 내려가며, 남은 절반은 거의 모델 자신의 판단으로 둔다. 무작위로 고를 때도 놓을 수 있는 후보 안에서만 고른다.

방해뿌요 낙하는 무작위라서 애프터스테이트에 반영하지 않고, 상쇄하고 남은 피해량만 상태의 스칼라로 남긴다. 이 근사는 학습기와 서버가 같은 함수(`learning.enumerate_afterstates()`)를 쓰므로 어느 쪽에서도 같게 적용된다.

## 관측값과 행동

현재 Python 환경의 모델 버전 3 관측 벡터는 길이 `528`이다(버전 2와 같은 계약이다).

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

연속 피버의 남은 시간과 목표 상태는 기존 최상위 `fever.leftTime`, `fever.targetCombo` 등에 들어 있다. `/apis/learning`과 솔로몬 배치 요청은 같은 528개 관측 계약을 사용하며, 솔로몬 프롬프트의 `currentState.elapsedMs`는 JS 게임 루프가 관리하는 실제 `game.elapsed`다.

## 현재 구현 범위

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

## 솔로몬과 대전하며 실시간으로 학습

AI 제공자를 **Local AI**로 두고 **극한** 난이도로 적 **솔로몬**과 대전하면(색상 수와 룰은 가리지 않는다), 그 대전에서 나온 수로 서버에 로드된 모델을 추가 학습한다. 솔로몬의 배치는 원래도 이 서버의 모델이 정하므로, 사람과 실제로 겨룬 결과를 그대로 그 모델에 되먹이는 셈이다. 여기에 더해, **사람이 이긴 대전에서는 그 사람이 둔 수도** 모델이 플레이어 쪽을 조작해 이긴 수순으로 보고 함께 학습한다.

준비할 것은 아래 "학습한 모델로 게임과 대전" 절과 같다. `pythonserver.py`를 실행하고 게임 설정에서 Local AI를 선택한 뒤, 적 선택 화면에서 AI 난이도를 극한으로 두고 솔로몬을 고르면 된다. 솔로몬이 둔 수로 하는 학습에는 그 밖의 설정이 필요 없고, 사람이 이긴 수순까지 학습하려면 설정 화면의 `역으로 모델 학습`을 함께 켠다.

동작은 다음과 같다.

1. 게임이 대전마다 학습 세션 ID를 만들어 솔로몬 배치 요청에 함께 보낸다. 조건에 맞지 않는 대전(다른 제공자, 극한이 아닌 난이도, 솔로몬이 아닌 적)에서는 이 값을 보내지 않으므로 기존 요청과 완전히 같다.
2. 서버는 매 요청마다 자신이 고른 수의 애프터스테이트와 즉시 보상(`ATTACK + 연쇄^2`)을 세션에 순서대로 담아 둔다. 오프라인 학습과 같은 함수로 만들기 때문에 두 경로의 학습 표본 형식이 같다.
3. 학습은 매 수마다 하지 않는다. 승패가 확정되어 **게임 종료 화면이 뜨는 시점**에 그 판에서 모은 수를 표본으로 바꿔 한 번에 반영하고, 그 결과를 `SERVER_CONFIG["model_path"]`의 체크포인트에 저장한다. 한 수의 목표값은 바로 다음 수의 보상과 감가한 다음 애프터스테이트의 가치이며, 마지막 수는 더 진행할 상태가 없으므로 `WIN_REWARD`(+50)·`LOSS_REWARD`(-50)만 목표가 된다.
4. 위험 높이나 응답 오류로 솔로몬이 대체 인공지능을 사용한 턴은 요청 자체가 없다. 그 턴을 사이에 둔 앞 수는 다음 상태를 알 수 없으므로 표본으로 만들지 않는다.

### 사람이 이긴 대전의 수순을 함께 학습

관측 벡터와 행동 번호에는 "누가 두었는지"를 나타내는 값이 없다. 어느 쪽이든 자기 필드·자기 조작 쌍·자기 상태만 담는 자기중심 표현이라, 사람이 둔 수도 솔로몬이 둔 수와 똑같은 전이로 만들 수 있다. 이 점을 이용해 사람이 이긴 대전의 수순을 모델에 되먹인다.

이 기능은 **설정 화면의 `역으로 모델 학습` 체크박스가 켜져 있을 때만** 동작한다. 기본값은 꺼짐이며, 꺼 두면 사람이 둔 수를 서버로 보내지 않으므로 솔로몬 자신이 둔 수로 하는 기존 학습만 그대로 남는다.

1. 대전 중 사람이 뿌요를 확정할 때마다 게임이 그 시점의 관측값과 배치(`열*4+회전`)를 같은 학습 세션에 보낸다. 솔로몬의 수와 사람의 수는 서로 다음 상태가 이어지지 않으므로 세션 안에서 **쪽별로 나누어** 쌓는다.
2. 사람의 수도 솔로몬의 수와 똑같이 서버가 애프터스테이트와 `ATTACK + 연쇄^2` 보상을 다시 계산한다. 그래야 가치의 기준이 한쪽으로 흔들리지 않는다. 사람이 둔 수의 요청에는 그 수의 다음 쌍(`nextPair`)도 함께 담아 보내며, 서버는 이 값을 애프터스테이트의 조작 쌍 자리에 넣는다.
3. 대전이 끝났을 때 **사람이 이긴 경우에만** 사람 쪽 표본을 마지막 수에 `WIN_REWARD`(+50)를 붙여 학습에 넣는다. 사람이 이기지 못한 대전의 사람 쪽 수는 그대로 버린다.
4. 사람의 승리 수순은 솔로몬 자신의 수보다 높은 비중으로 학습한다. 이 비중은 `pythonserver.py`의 `SOLOMON_PLAYER_WIN_TRAINING_WEIGHT`(기본 `1000.0`)로 조절하며, 솔로몬 자신의 수는 항상 `1.0`이다. 값을 올릴수록 사람이 이긴 수순을 더 강하게 따라 배우고, `1.0`로 두면 양쪽을 같은 비중으로 학습한다.

비중은 손실을 계산하기 전에 평균이 1이 되도록 정규화하므로, 값을 바꿔도 학습률을 다시 맞출 필요가 없다. 사람 쪽 표본이 없는 대전에서는 모든 비중이 1이 되어 기존 학습과 완전히 같게 동작한다.

Local AI를 쓸 때는 게임이 이번 턴에 실제로 사용할 수 있는 배치 목록(`usablePlacements`)도 함께 보낸다. 서버가 받는 관측값에는 화면 12줄만 담겨 있어 뿌요가 목표 열까지 가로로 지나갈 수 있는지, 회전할 때 벽에 밀리는지, 화면 위 숨김 행에 자리가 있는지를 알 수 없기 때문이다. 서버는 이 목록이 오면 그 안에서만 가치가 가장 높은 배치를 고르므로, 게임이 쓸 수 없는 좌표를 응답해 "응답받은 솔로몬 배치를 현재 뿌요에 사용할 수 없습니다" 오류로 일시정지되는 일이 없다. 다른 AI 제공자에게 보내는 프롬프트에는 이 항목을 넣지 않는다.

저장 형식은 `learning.py`가 쓰는 것과 같고 모델 버전·관측 벡터·행동 수·시드를 그대로 유지하므로, 이렇게 갱신한 모델도 `learning.py`로 이어서 학습하거나 다른 게임 세션에서 그대로 사용할 수 있다. 저장은 임시 파일에 먼저 쓴 뒤 교체하므로 저장 중에 서버가 멈춰도 기존 모델 파일이 깨지지 않는다.

학습 결과는 게임의 브라우저 콘솔에 `솔로몬 학습 적용 결과`로 기록되며, 반영한 표본 수(`transitions`)와 그중 사람이 둔 수(`playerTransitions`), 마지막 손실값을 확인할 수 있다. 이 요청이 실패하더라도 게임 진행에는 영향을 주지 않는다.

## 학습한 모델로 게임과 대전

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

서버 없이 관측 벡터 하나를 직접 추론하려면 528개 숫자 배열 JSON을 준비하고 다음처럼 실행한다. 결과는 `action`, `x`, `rotation` JSON이며, 가득 찬 열과 벽을 침범하는 행동은 후보에서 아예 빠진다. 실제 대전과 같은 기준으로 평가하려면 배열 대신 `{"observation": [...], "nextPair": [3, 4]}` 형식으로 다음 쌍까지 넣는다(색 번호는 red·green·yellow·blue·purple 순서인 0~4다).

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

현재 `learning.py`가 학습하는 `default.pt`는 `ValueNetwork`라는 사용자 정의 합성곱 가치망 체크포인트다. 이는 Llama 등의 언어 모델 구조가 아니므로 `convert_hf_to_gguf.py`나 실제 LM Studio 앱에서 직접 사용할 수 없다. 다만 게임 설정에서 LM Studio 제공자를 선택해도 URL을 `pythonserver.py`로 지정하면, 이 서버가 Chat Completions 규격만 맞춰 이 모델을 그대로 서비스할 수 있다. 실제 LM Studio 앱에 넣으려면 별도의 Transformer 기반 모델과 그에 맞는 학습·변환 파이프라인이 필요하다.
