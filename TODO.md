## 수정할 사항

### PuyoW 머신러닝 인공지능 개발 프로젝트로 아래 4가지를 마저 진행할 거야.

* learning.py 를 이용해 학습시켜 DQN 모델 생성 (학습은 로컬에서 구동)
* pythonserver.py 로 서버 구동 (학습 및 모델 사용 시 nodeserver.js 는 사용하지 않음)
  이 서버에서 LM Studio 의 API규격을 흉내내어 DQN 모델 서비스까지 제공
* 게임 내에서 AI 서비스 제공자로 LM Studio 선택, URL로 localhost 와 포트 지정
* 학습된 모델과 대전 진행

위 4가지를 마저 진행할 거야.
INFO_FOR_AI.md 와 MachineLearning.md 파일을 참고해줘.
   
   
----------------------------------------------------------
## 참고사항

게임 플레이 페이지는 puyow.html, 
게임 핵심 코드는 puyow.js 에 구현하고 있어.
모든 파일은 UTF-8 인코딩을 사용하고, 기본 언어는 한국어야.
INFO_FOR_AI.md 파일을 참고 후 작업해줘. 게임 룰 설명도 이 안에 기재되어 있어. 
(작업 후 다음 작업에 참고할 수 있도록 INFO_FOR_AI.md 파일을 업데이트해줘.)
작업 후 puyow.js 의 BUILDNO 를 1 증가시켜주고, package.json 의 version 의 패치 번호에 BUILDNO 값을 넣어줘.
주석 및 채팅창 답변은 모두 한국어로 해줘.