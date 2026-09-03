## 수정할 사항

### PuyoW 머신러닝 인공지능 개발 프로젝트로 아래 4가지를 마저 진행할 거야.

* learning.py 를 이용해 학습시켜 DQN 모델 생성 (학습은 로컬에서 구동)
* pythonserver.py 로 서버 구동 (학습 및 모델 사용 시 nodeserver.js 는 사용하지 않음)
  이 서버에서 LM Studio 의 API규격을 흉내내어 DQN 모델 서비스까지 제공
* 게임 내에서 AI 서비스 제공자로 LM Studio 선택, URL로 localhost 와 포트 지정
* 학습된 모델과 대전 진행

위 4가지를 마저 진행할 거야.
이와 관련하여 다음 사항을 진행해 줘.

1. 좌표 및 회전 값들은 puyow.js 에서 사용하는 값을 기준으로 해줘. common.py 에도 정의해서
2. 모델 학습 및 서비스에 모두 필요한 관측값은 common.py 에 정의해서 일치하도록 만들어줘.
3. 이 모델의 활동 목적은 게임에서 승리 및 높은 연쇄 발생이야. 단, 게임에서 승리 목적이 더 중요해.
4. 기본 룰, 피버 룰 또한 어느정도 공통사항을 가지고 있으므로,
   (뿌요 폭발 시 공격, 높은 연쇄 시 높은 위력, 싹쓸이 시 혜택 (비록 그 혜택의 형태는 다르지만) 등)
   룰 별로 모델을 나누지는 않으려고 해.
5. pythonserver.py 에서 SERVER_CONFIG 에 model_path 키로 DQN 모델 파일이 지정되어 있는 경우
   이 python 동작 서버에서 LM Studio 의 API 규격을 흉내내어 DQN 모델 서비스 제공
   DQN 모델 파일이 없거나 값이 null 혹은 지정이 안되어 있는 경우, LM Studio API 흉내 서비스만 제외하고 다른 웹 서비스나 API 는 동작해야 함.
   API키는 pythonserver.py 파일 내에 하드코딩하고, 게임 내 설정 화면에서도 동일한 값을 입력하도록 하여 사용하려고 해. (일단은 로컬에서만 구동할 예정.)
   단, API키는 여러개가 될 수 있으니 (or조건) API키가 들어갈 필드는 컬렉션으로 만들어줘.
6. MachineLearning.md 에 사용 방법 설명 및 변경 사항 반영

필요 시 puyow.js 및 pythonserver.py, common.py 를 수정해줘.
INFO_FOR_AI.md 와 MachineLEarning.md 파일을 참고해줘.
   
   
----------------------------------------------------------
## 참고사항

게임 플레이 페이지는 puyow.html, 
게임 핵심 코드는 puyow.js 에 구현하고 있어.
모든 파일은 UTF-8 인코딩을 사용하고, 기본 언어는 한국어야.
INFO_FOR_AI.md 파일을 참고 후 작업해줘. 게임 룰 설명도 이 안에 기재되어 있어. 
(작업 후 다음 작업에 참고할 수 있도록 INFO_FOR_AI.md 파일을 업데이트해줘.)
작업 후 puyow.js 의 BUILDNO 를 1 증가시켜주고, package.json 의 version 의 패치 번호에 BUILDNO 값을 넣어줘.