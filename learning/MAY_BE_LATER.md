할 일 목록 업데이트됨

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
