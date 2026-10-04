## 수정할 사항

Firebase Analytics 및 Performance 도입

1. 본 게임 (puyow.js) 에, Firebase Analytics 및 Performance 객체 입력받는 함수 추가

본 게임 (puyow.js) 에, Firebase Analytics 및 Performance 객체 입력받는 함수를 추가해야 함.
이 함수 사용 시에는 게임 초기화 전 호출되어야 함.
선택사항으로, 이 함수를 이용하지 않았더라도 나머지 게임 기능은 정상 동작해야 함.
이 함수에서 오류가 발생하더라도 게임의 나머지 기능은 정상 동작해야 함. (오류 내용은 console.error 출력)
이 작업 단계에서는 puyow.html 을 수정하지 않아야 함.

2. Firebase Analytics 객체가 입력된 경우, 주요 이벤트 발생 시 Analytics 호출

본 게임에 준비된 이벤트 puyow_init, puyow_unlocked, puyow_win 3가지 이벤트 발생 시 Analytics 의 logEvent 출력
(https://firebase.google.com/docs/analytics/web/events?hl=ko 참고)
또한, 본 게임 초기화 시점 및 설정 화면에서 이름(닉네임) 변경한 경우, Firebase Analytics 의 사용자 ID로 설정
(https://firebase.google.com/docs/analytics/userid?hl=ko 참고)

이 또한 모두 예외처리를 하여, 오류가 발생하더라도 다른 기능은 정상동작해야 함. (오류 내용은 console.error 출력)
이 작업 단계에서는 puyow.html 을 수정하지 않아야 함.

아직 Firebase Performance 를 통한 성능 측정 기준은 정하지 않았으므로 Performance 객체는 입력만 해두면 됨.

3. puyow.html 에 반영
puyow.html 의 TODO 주석 있는 곳을 수정하여 Analytics 및 Performance 객체 입력

----------------------------------------------------------
## 참고사항

게임 플레이 페이지는 puyow.html, 
게임 핵심 코드는 puyow.js 에 구현하고 있어.
모든 파일은 UTF-8 인코딩을 사용하고, 기본 언어는 한국어야.
INFO_FOR_AI.md 파일을 참고 후 작업해줘. 게임 룰 설명도 이 안에 기재되어 있어. 
(작업 후 다음 작업에 참고할 수 있도록 INFO_FOR_AI.md 파일을 업데이트해줘.)
puyow.js 를 수정한 경우, 작업 후 puyow.js 의 BUILDNO 를 1 증가시켜주고, package.json 의 version 의 패치 번호에 BUILDNO 값을 넣어줘. (이 버전값은 테스트는 하지 말아줘.)
주석 및 채팅창 답변은 모두 한국어로 해줘.
필요 시 git 히스토리를 읽는 건 되지만, 커밋하지는 말아줘.
