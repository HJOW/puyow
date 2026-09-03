# python 기반 서버에서 LM Studio API 모사 시 문제사항

할 일 목록 업데이트됨

현재 상태에서는 4가지 목표 중 다음 정도까지 준비되어 있습니다.

1. `learning.py`로 DQN 학습 가능
2. `pythonserver.py`로 정적 웹 서버와 `/apis/learning` 학습 이벤트 API 실행 가능
3. 게임에서 `LM Studio` 서비스 제공자 선택 가능
4. 게임의 LM Studio 요청 구조 존재

하지만 **Python 서버가 아직 DQN 추론 API를 제공하지 않기 때문에 학습된 모델과의 대전은 아직 불가능합니다.**

## 추가로 필요한 작업

### 1. `pythonserver.py`에 DQN 모델 로드 기능 추가

현재 Python 서버는 모델을 전혀 로드하지 않습니다.

다음 설정이 필요합니다.

```python
SERVER_CONFIG = {
    "port": 9891,
    "web_root": Path(__file__).resolve().parent.parent / "src",
    "learning_token": "change-this-token",
    "dqn_model": Path(__file__).resolve().parent / "puyow_dqn.pt",
    "max_body_size": 1024 * 1024,
}
```

서버 시작 시:

```text
puyow_dqn.pt 로드
→ PolicyNetwork 생성
→ checkpoint의 model 가중치 적용
→ evaluation 모드 전환
```

필요한 구성은 다음과 같습니다.

```python
model = PolicyNetwork()
checkpoint = torch.load(model_path, map_location="cpu")
model.load_state_dict(checkpoint["model"])
model.eval()
```

현재 `PolicyNetwork`는 `learning.py` 안에만 있으므로, 다음 중 하나도 필요합니다.

- `PolicyNetwork`를 공통 모듈로 분리
- `pythonserver.py`에서 같은 구조를 재정의
- `learning.py`에서 import

가장 깔끔한 방식은 다음과 같습니다.

```text
learning/
├─ learning.py
├─ model.py
└─ pythonserver.py
```

`model.py`에 다음을 둡니다.

- `PolicyNetwork`
- `OBSERVATION_SIZE`
- `ACTION_COUNT`
- checkpoint 로드 함수
- 관측값 검증 함수
- action을 `{x, rotation}`으로 변환하는 함수

### 2. LM Studio 호환 API 구현

현재 `pythonserver.py`는 다음 API만 제공합니다.

```text
POST /apis/learning
```

게임은 LM Studio를 선택하면 다음 주소를 호출합니다.

```text
POST /v1/chat/completions
```

따라서 Python 서버에 다음 경로가 필요합니다.

```text
POST /v1/chat/completions
```

응답은 현재 `puyow.js`가 기대하는 LM Studio 형식과 같아야 합니다.

```json
{
  "id": "puyow-dqn-000001",
  "object": "chat.completion",
  "created": 1780000000,
  "model": "puyow-dqn",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"x\":2,\"rotation\":1}"
      },
      "finish_reason": "stop"
    }
  ]
}
```

이렇게 하면 게임에서는 서버를 LM Studio API 서버처럼 사용할 수 있습니다.

### 3. DQN 입력값을 게임에서 서버로 전달

현재 DQN은 숫자 배열 444개를 입력으로 기대합니다.

```text
444개 관측값
→ DQN
→ 24개 Q값
→ action 선택
```

반면 현재 `puyow.js`의 LM Studio 요청은 텍스트 프롬프트 기반입니다.

```text
현재 보드 상태를 보고 최적 배치를 JSON으로 반환해라.
```

이 상태로는 Python 서버가 정확히 444개 관측값을 복원할 수 없습니다.

따라서 `puyow.js`의 LM Studio 요청을 다음과 같이 변경해야 합니다.

```json
{
  "model": "puyow-dqn",
  "messages": [
    {
      "role": "user",
      "content": "{\"observation\":[0,1,0,0],\"actionCount\":24}"
    }
  ]
}
```

또는 서버가 별도 필드를 직접 받도록 할 수 있습니다.

```json
{
  "model": "puyow-dqn",
  "observation": [444개의 숫자],
  "currentPair": ["red", "blue"]
}
```

현재 `puyow.js`에는 관측값을 만드는 `getLearningObservation()`이 있지만, 이 함수는 내부 함수이며 LM Studio 요청에 포함되지 않습니다. 이 함수를 LM Studio 요청 생성부에서 사용하도록 연결해야 합니다.

### 4. Python과 JavaScript 관측값을 완전히 일치시켜야 함

현재 두 구현에는 중요한 차이가 있습니다.

Python:

```text
보드: 6 × 12
빈 칸 + 5색: 432개
현재 뿌요 쌍: 10개
공격량 + 턴 수: 2개
총 444개
```

브라우저의 현재 관측값 생성 코드는 다음 상태를 사용합니다.

- 실제 게임 보드
- 현재 조작 중인 뿌요 쌍
- `player.attack`
- `player.placedPairCount`

따라서 Python 쪽의 `turn`과 JavaScript 쪽의 `placedPairCount`가 같은 의미인지 확인해야 합니다.

특히 다음을 테스트해야 합니다.

- 보드의 `y=0`이 바닥인지
- 색상 순서가 같은지
- 빈 칸 채널 순서가 같은지
- 현재 쌍의 두 색 순서가 같은지
- 공격량 정규화가 같은지
- 턴 수 정규화가 같은지
- 3색·4색 게임에서 사용하지 않는 색 채널을 어떻게 처리할지
- `garbage`와 `hardGarbage`를 어떻게 인코딩할지

현재 DQN 환경은 일반 색 뿌요만 지원하므로, 실제 게임에 방해뿌요가 등장하면 모델 입력 계약을 확장하거나 별도 처리해야 합니다.

### 5. action 검증과 변환

DQN 출력은 `action` 번호입니다.

```python
column, rotation = divmod(action, 4)
```

변환 결과:

```text
action 0  → x=0, rotation=0
action 1  → x=0, rotation=1
action 2  → x=0, rotation=2
action 3  → x=0, rotation=3
action 4  → x=1, rotation=0
...
action 23 → x=5, rotation=3
```

Python 서버에서 다음을 검증해야 합니다.

```text
observation이 배열인지
observation 길이가 444인지
모든 값이 유한한 숫자인지
action이 0~23인지
x가 0~5인지
rotation이 0~3인지
```

또한 모델이 선택한 위치가 현재 필드에서 실제로 가능한지 검사해야 합니다. 불가능한 위치이면 다음 중 하나가 필요합니다.

- 유효한 행동 중 Q값이 가장 높은 행동으로 대체
- 게임 엔진의 `findLandingPlacement()`를 기준으로 무효 행동 제거
- 무효 행동 응답 시 게임 측 fallback AI 사용

가장 안정적인 방식은 서버에서 유효 행동 마스크를 적용하는 것입니다.

### 6. Python 서버의 포트 사용

구현 후 다음처럼 실행하면 됩니다.

```powershell
python learning/pythonserver.py 9891
```

게임 설정에서:

```text
AI 서비스 제공자: LM Studio
AI API URL: http://localhost:9891
사용 모델명: puyow-dqn
AI API 키: Python 서버의 토큰
```

현재 `puyow.js`는 LM Studio URL 뒤에 자동으로 다음 경로를 붙입니다.

```text
/v1/chat/completions
```

따라서 최종 호출 주소는 다음이 됩니다.

```text
http://localhost:9891/v1/chat/completions
```

Python 서버가 반드시 이 경로를 제공해야 합니다.

### 7. 모델 파일 경로와 시작 옵션

현재 `pythonserver.py`는 포트만 명령행 인자로 받습니다.

향후 다음 옵션을 추가하는 것이 좋습니다.

```powershell
python learning/pythonserver.py 9891 `
  --model learning/puyow_dqn.pt
```

또는 모델 경로도 상단 설정 컬렉션에 고정할 수 있습니다.

```python
SERVER_CONFIG = {
    "port": 9891,
    "model_path": Path(__file__).resolve().parent / "puyow_dqn.pt",
    "learning_token": "change-this-token",
}
```

요청하신 “상단 변수에 토큰을 하드코딩” 방식과도 맞습니다.

### 8. `learning.py`와 `pythonserver.py`의 모델 구조 공유

현재 모델 구조가 두 파일에 중복되면 나중에 구조가 변경될 때 문제가 생깁니다.

예를 들어 학습 시:

```python
nn.Linear(444, 256)
```

서버에서:

```python
nn.Linear(442, 256)
```

처럼 달라지면 checkpoint를 로드할 수 없습니다.

따라서 메타데이터 검증이 필요합니다.

```json
{
  "observation_size": 444,
  "action_count": 24,
  "board": [6, 12]
}
```

서버 시작 시 다음을 확인해야 합니다.

```text
checkpoint observation_size == 444
checkpoint action_count == 24
```

불일치하면 서버가 시작 시 명확한 오류를 내야 합니다.

## 전체 목표를 위한 권장 구조

```text
learning.py
  ↓
puyow_dqn.pt 생성
  ↓
pythonserver.py 시작
  ↓
DQN checkpoint 로드
  ↓
POST /v1/chat/completions
  ↓
observation 444개 추출
  ↓
PolicyNetwork 추론
  ↓
action 0~23 선택
  ↓
{x, rotation} 변환
  ↓
LM Studio 호환 JSON 응답
  ↓
puyow.js가 배치 적용
```

## 현재 추가해야 할 핵심 작업 순서

1. `PolicyNetwork`와 모델 상수를 공통 모듈로 분리
2. `pythonserver.py`에서 `puyow_dqn.pt` 로드
3. `/v1/chat/completions` 라우팅 추가
4. LM Studio 요청에서 DQN용 444차원 관측값 전달
5. Python/JavaScript 관측 벡터 비교 테스트 추가
6. action 유효성 검사와 fallback 추가
7. 학습 모델이 없을 때 서버 시작 오류 처리
8. Python 서버와 브라우저 간 CORS·토큰 인증 테스트
9. 게임에서 AI 제공자를 `LM Studio`로 선택
10. `AI API URL`에 `http://localhost:9891` 입력
11. 모델명에 `puyow-dqn` 입력
12. 실제 대전 테스트

결론적으로 필요한 핵심은 다음 세 가지입니다.

```text
pythonserver.py의 DQN checkpoint 로드
/v1/chat/completions LM Studio 호환 API 구현
puyow.js에서 444차원 DQN 관측값 전달
```

이 세 가지가 구현되면 다음 방식으로 목표를 달성할 수 있습니다.

```text
learning.py로 학습
→ puyow_dqn.pt 생성
→ pythonserver.py 실행
→ 게임에서 LM Studio 선택
→ URL에 localhost:9891 지정
→ 모델명 puyow-dqn 입력
→ 학습된 DQN과 대전
```

단, 이 서버는 실제 LM Studio가 아니라 **LM Studio API 형식을 흉내 내는 DQN 서버**입니다. 게임 UI에서 `LM Studio`를 선택하더라도 내부적으로는 Python DQN 모델이 응답하게 됩니다.


# node.js 기반 서버에서 LM Studio API 모사 시 문제사항

현재 상태에서 네 가지 목표를 진행하려면 가장 중요한 작업은 **DQN 모델과 LM Studio의 사용 방식이 서로 맞지 않는 문제를 해결하는 것**입니다.

현재 구조:

- `learning.py`
  - 게임 보드를 직접 실행하는 독립 환경
  - `PolicyNetwork`라는 PyTorch DQN 학습
  - 출력: `puyow_dqn.pt`
  - 선택적으로 학습 이벤트를 `nodeserver.js`에 전송
- `nodeserver.js`
  - 관측값, 행동, 보상, 종료 이벤트를 수신
  - 현재는 메모리에 세션 통계만 저장
  - 실제 모델 학습이나 추론은 하지 않음
- `puyow.js`
  - `configureLearningApi()`를 통해 게임 전이를 서버로 전송
  - LM Studio는 별도의 AI 서비스 제공자로 이미 구현되어 있음
  - LM Studio 응답은 구조화된 `{x, rotation}` JSON을 기대함

**핵심 문제**

현재 DQN은 다음과 같은 숫자 출력 모델입니다.

```text
관측 벡터 444개 -> 신경망 -> 행동 24개에 대한 Q값
```

반면 LM Studio는 GGUF 언어 모델을 로드하고 다음과 같은 채팅 API를 제공합니다.

```text
텍스트 프롬프트 -> 언어 모델 -> JSON 텍스트
```

따라서 현재 `puyow_dqn.pt`를 GGUF로 변환해 LM Studio에 로드하는 것은 불가능합니다. `llama.cpp`의 `convert_hf_to_gguf.py`도 Hugging Face Transformer 언어 모델용 변환기입니다.

## 필요한 추가 작업

### 1. 학습 방식 결정

두 가지 방향 중 하나를 선택해야 합니다.

#### 방향 A: DQN 모델을 그대로 사용

이 방향이 현재 모델 구조에는 가장 자연스럽습니다.

추가 작업:

1. `puyow_dqn.pt` 로드용 Python 추론 모듈 추가
2. 관측 벡터를 입력받아 24개 행동 중 하나를 반환하는 API 추가
3. `nodeserver.js`에 `/apis/inference` API 추가하거나 별도 Python 추론 서버 사용
4. 게임의 `Solomon` 또는 새로운 AI 서비스 제공자가 해당 API 호출
5. 선택한 행동을 `{x, rotation}`으로 변환
6. 게임에서 DQN AI와 실제 대전

이 경우에는 LM Studio를 사용하지 않습니다. 대신 다음과 같은 별도 제공자를 추가하는 편이 적절합니다.

```text
PuyoW DQN
```

장점:
- 현재 학습 모델을 그대로 활용 가능
- 숫자 행동 정책과 게임 구조가 자연스럽게 맞음
- 추론 속도가 빠름
- GGUF 변환이 필요 없음

### 2. LM Studio 사용을 반드시 유지하는 경우

현재 DQN을 GGUF로 바꾸는 것이 아니라, LM Studio가 지원하는 Transformer 언어 모델을 별도로 학습해야 합니다.

필요한 작업:

1. 게임 상태를 텍스트 또는 JSON 프롬프트로 변환
2. 정답 행동을 JSON 형식으로 만드는 학습 데이터 생성
3. Hugging Face Transformer 모델 선택
4. 지도학습 또는 LoRA 방식으로 모델 학습
5. Hugging Face 모델 디렉터리로 저장
6. `llama.cpp`의 `convert_hf_to_gguf.py`로 GGUF 변환
7. GGUF 모델을 LM Studio에 등록
8. LM Studio의 `/v1/chat/completions` 응답 확인
9. 게임의 LM Studio 호출부에서 `{x, rotation}` 검증
10. 실제 게임에서 해당 모델과 대전

학습 데이터 예시는 다음과 같은 형태가 될 수 있습니다.

```json
{
  "messages": [
    {
      "role": "user",
      "content": "현재 보드 상태와 다음 뿌요 쌍을 보고 최적 배치를 JSON으로 반환해라..."
    },
    {
      "role": "assistant",
      "content": "{\"x\":2,\"rotation\":1}"
    }
  ]
}
```

이 경우 DQN의 444차원 관측 벡터를 그대로 사용하는 대신, LM Studio가 이해할 수 있는 JSON 또는 텍스트 표현으로 변환해야 합니다.

### 3. `learning.py`의 학습 데이터 구조 개선

현재 `learning.py`는 게임을 실행하며 DQN을 학습하지만, 서버로 보내는 데이터는 학습 이벤트 기록용입니다.

현재 서버로 전송되는 내용:

```text
reset
step
episode_end
```

하지만 다음 기능은 아직 없습니다.

- 서버에 데이터 영구 저장
- 학습 데이터셋 파일 생성
- 학습 중단 후 재개
- 기존 체크포인트 로드
- 평가 전용 실행
- 평균 보상과 승률 기록
- 학습된 정책 검증
- 최적 행동 데이터 생성
- LLM fine-tuning용 JSONL 변환

따라서 최소한 다음 기능이 필요합니다.

```text
--resume 체크포인트 이어 학습
--evaluate 모델 평가
--dataset 출력 학습 데이터 저장
--export-jsonl LLM 학습용 데이터 변환
```

### 4. GGUF 변환 CLI의 역할 명확화

현재 추가된 `--export-gguf`는 Hugging Face Transformer 모델 디렉터리에만 사용할 수 있습니다.

```powershell
python learning/learning.py `
  --export-gguf models\my-transformer `
  --llama-cpp-converter llama.cpp\convert_hf_to_gguf.py `
  --gguf-output learning\my-model-f16.gguf
```

이 명령은 현재의 `learning/puyow_dqn.pt`에는 사용할 수 없습니다.

따라서 문서와 CLI에 다음을 명확히 구분하는 것이 좋습니다.

```text
DQN 체크포인트:
puyow_dqn.pt
-> Python/PyTorch 추론 서버에서 사용

Transformer 언어 모델:
Hugging Face 모델 디렉터리
-> GGUF 변환
-> LM Studio에서 사용
```

### 5. 게임 내 AI 서비스 제공자 연결 확인

게임에서 LM Studio를 선택하는 것과 학습된 모델을 사용하는 것은 별개의 문제입니다.

현재 LM Studio 선택 시 필요한 값:

- LM Studio 서버 주소
- 모델명
- 필요할 경우 API 키
- LM Studio에서 로드한 모델의 응답 형식

게임은 대략 다음 형태의 응답을 기대합니다.

```json
{
  "x": 2,
  "rotation": 1
}
```

따라서 LM Studio에서 사용하는 모델이 반드시:

- JSON만 출력해야 함
- `x`는 `0`~`5`
- `rotation`은 `0`~`3`
- 설명 문장을 출력하지 않아야 함
- 게임 상태에 없는 잘못된 위치를 선택하지 않아야 함

을 만족해야 합니다.

### 6. `learning.html` 토큰 보안 개선

현재 `learning.html`은 URL의 `token` 매개변수를 읽어 API 인증에 사용합니다.

```text
http://localhost:9891/learning.html?token=실제토큰
```

개발 환경에서는 사용할 수 있지만, URL 토큰은 다음에 노출될 수 있습니다.

- 브라우저 방문 기록
- 프록시 로그
- 서버 로그
- Referer 헤더
- 화면 공유나 URL 복사

따라서 실제 배포에서는 다음 중 하나가 필요합니다.

- 로컬 개발 전용으로만 사용
- 일회성 토큰 사용
- 토큰 만료 시간 추가
- 서버에서 세션 토큰 발급
- HTTPS 사용
- URL 대신 개발자 도구에서 직접 설정

## 권장 진행 순서

현재 목표가 “학습한 AI와 게임에서 대전”이라면 다음 순서를 권장합니다.

1. 현재 DQN 모델에 `--resume`과 `--evaluate` 추가
2. DQN 추론 전용 Python API 구현
3. `nodeserver.js`에 DQN 추론 API 연결
4. 게임에 `Puyo W DQN` 서비스 제공자 추가
5. 실제 게임 상태를 DQN 관측 벡터로 변환
6. DQN이 반환한 행동을 게임 배치로 적용
7. 실제 게임과 Python 환경의 결과 비교 테스트 추가
8. 그 후 LM Studio용 Transformer 학습은 별도 프로젝트로 진행
9. Transformer 모델을 GGUF로 변환
10. LM Studio 제공자에서 해당 모델과 대전

결론적으로 현재 남은 핵심 작업은 다음 두 가지입니다.

```text
현재 DQN 모델을 사용한 실제 게임 대전 경로 구현
LM Studio용으로 별도의 Transformer 학습·GGUF 변환 파이프라인 구현
```
