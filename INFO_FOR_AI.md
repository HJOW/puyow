# Puyo W AI 작업 참고서

이 문서는 Puyo W 2D 버전 작업을 맡은 AI 에이전트용 압축 참고서다. 사용자에게 보여 줄 게임 설명이 아니라, 변경 범위와 현재 구현 계약을 빠르게 파악하기 위한 문서다.

## 기본적인 사항

게임의 기본 언어는 한국어를 사용하며, 소스코드 내 주석도 한국어로 작성한다.
텍스트 파일의 캐릭터셋은 UTF-8 을 사용한다.

## 판단 우선순위

1. 현재 사용자의 명시 지시와 최신 `TODO.md`
2. 현재 구현된 `src/js/puyow.js`와 그에 대응하는 테스트
3. 이 문서, `HOWTO.md`, `docs/`
4. `OLD_PROMPTS.md`

`OLD_PROMPTS.md`는 과거 요청의 기록이다. 현재 소스와 충돌하거나 이미 변경된 내용은 따르지 않는다. 작업 전에는 항상 최신 `TODO.md`, 관련 소스, 관련 테스트를 읽는다.

## 저장소와 실행 환경

- 2D 게임 페이지: `src/puyow.html`
- 핵심 엔진·캔버스 UI: `src/js/puyow.js`
- 선택적 3D 효과 구현: `src/js/puyow_3d.js` (`puyow.js`와 분리된 확장 모듈)
- 개발용 도구 페이지: `src/tools.html`, `src/js/puyow_tools.js` (피버 패턴·퍼즐뿌요 제작용, 게임 페이지는 이 스크립트를 읽지 않는다)
- 리더보드 서버 기록: `node/leaderboard.js`·`node/leaderboard_storage.js`, `python/leaderboard.py`·`python/leaderboard_storage.py`(검증·병합 규칙과 파일 저장을 나눠 둔다. 두 언어가 같은 규칙과 같은 응답 형식을 쓴다)
- 리더보드 조회 페이지: `src/leaderboard.html`(스타일 포함), `src/js/puyow_leaderboard.js` (기록 읽기·룰/적 목록·게임 번역은 `puyow.js`의 `PuyoW.leaderboard` API를 쓰며 게임은 초기화하지 않는다. 게임 페이지는 이 스크립트를 읽지 않는다)
- 서버 모니터링·관리 페이지: `src/admin.html`, `src/js/puyow_admin.js` (서버 백엔드는 `node/admin.js`·`python/admin.py`, 게임 페이지는 이 스크립트를 읽지 않는다)
- 리플레이 재생 페이지: `src/replay.html`(스타일 포함), `src/js/puyow_replay.js`, 추천 리플레이 목록 `src/js/replays.json` (재생은 `puyow.js`의 `PuyoW.replay` API를 쓴다. 게임 페이지는 이 스크립트를 읽지 않는다. 아래 「리플레이 재생 페이지」 절)
- 스타일: `src/css/puyow.css`
- 선택적 라이브러리: `src/js/three.min.js`, `src/js/json5.min.js`
- 이미지: `src/img/`
- 언어별 공지사항: `src/notice/`
- Webpack 번들 출력: `src/bundle/puyow.bundle.js`
- E2E 회귀 테스트: `tests/test01_*.spec.js` (게임 페이지), `tests/test02_tools.spec.js` (개발용 도구 페이지), `tests/test03_ai.spec.js` (AI 모델 사용·학습), `tests/test04_admin.spec.js` (서버 모니터링·관리 페이지), `tests/test05_leaderboard.spec.js` (리더보드 기록 규칙과 조회 페이지), `tests/test06_replay_page.spec.js` (리플레이 재생 페이지)
- 개발자 문서: `HOWTO.md`, `docs/`
- 공개 안내 문서: `README.md`, `README.en.md` (`README.en.md`는 `README.md`의 영어 번역본이므로 플레이 주소·실행 방법 같은 원문 갱신을 함께 반영한다.)
- 모든 텍스트 파일은 UTF-8, 기본 UI 언어는 한국어다.
- Windows PowerShell에서는 `npm.cmd test`와 `npx.cmd playwright ...`를 사용한다.
- 기본 정적 검증: `node --check src/js/puyow.js`, `npm.cmd test`, `git diff --check`.
- 게임 동작·캔버스 변경은 해당 Playwright 테스트도 실행한다. 정적 검사만으로 게임 동작을 검증했다고 판단하지 않는다.

`puyow.js`는 IIFE 내부에서 게임 상태를 관리한다. CommonJS `module.exports`와 브라우저 `window.WebPuyo`로 내보내며, `window.PuyoW`는 같은 객체의 별칭이다. 외부 확장 등록은 일반적으로 `initialize()` 이전에 한다.

## 공통 작업 원칙

- 기존 공개 API, 저장 데이터, 외부 등록 API를 깨지 않는다.
- 직접적인 `Math.random()` 호출 대신 `randomFloat()`를 사용한다. 테스트의 결정론과 공통 API 계약 때문이다.
- UI 문구는 `translate()`를 거친다. 새 한국어 키는 기본 번역표와 등록 언어에서 자연스럽게 대체될 수 있게 추가한다.
- 캔버스 메뉴 변경은 렌더링, 키보드/게임패드 포커스, 마우스 히트박스, ESC, 외부 클릭을 함께 검토한다. 보이지만 잠긴 선택지는 포커스와 활성화에서 모두 제외한다.
- 좌표는 논리 캔버스 `1280 x 720` 기준이다. 화면 회전·확대 시에는 기존 좌표 변환 함수와 레이아웃 도우미를 사용한다.
- 관련 없는 작업 트리 변경은 보존한다. 요청하지 않은 리팩터링이나 저장 데이터 초기화는 하지 않는다.

## 게임 루프와 시간 진행

- 게임 진행은 `requestAnimationFrame`이 부르는 `frame(time)` 하나가 이끈다. 이 함수는 입력 읽기(`updateGamepadInput()`)와 그리기(`render()`)를 프레임당 한 번만 하고, 그 사이에서 `updateWorld(delta)`를 불러 게임 상태를 진행시킨다.
- **프레임 간격이 `UPDATE_STEP_MS`(50ms)를 넘으면 넘은 시간을 버리지 않고 그 크기로 나눠 `updateWorld()`를 여러 번 부른다.** BUILDNO 41까지는 `Math.min(50, delta)`로 잘라 버렸기 때문에 프레임률이 20fps 아래로 떨어지면 `게임 시간 = min(1, fps / 20) x 실제 시간`이 되어, 느린 기기와 자동화 테스트에서 뿌요가 덜 떨어지거나 피버 제한 시간이 줄지 않았다. BUILDNO 42에서 나눠 갱신으로 바꿔 4fps에서도 게임 시간이 실제 시간의 95% 이상을 따라간다(측정: 15fps 0.99, 9fps 0.98, 4.8fps 0.95).
- 한 프레임에서 따라잡는 실제 시간은 `MAX_CATCH_UP_MS`(250ms)까지다. 탭을 오래 비웠다 돌아오면 브라우저가 `requestAnimationFrame`을 멈춰 둔 만큼 간격이 벌어지는데 그 시간을 모두 진행하면 게임이 순간이동하므로 여기서 끊는다. 그래서 4fps 아래에서는 다시 게임 시간이 뒤처진다(2.4fps에서 약 0.55배). 이 상한을 늘리면 저프레임 정확도는 좋아지지만 탭 복귀 시 점프가 커진다.
- **`updateWorld()` 안의 모든 처리는 호출 횟수가 아니라 `delta`에만 의존해야 한다.** "프레임마다 한 번"을 전제로 코드를 넣으면 프레임률이 낮은 환경에서만 두 배로 도는 버그가 된다. 좌우 홀드 반복(`repeatElapsed`), 연쇄 단계 대기(`phaseTimer`), 리플레이 표본 간격(`sampleElapsed`)처럼 누적값을 쓰는 기존 코드는 이 규칙을 지키고 있다. 프레임당 한 번이어야 하는 일은 `frame()` 쪽에 둔다.
- 자연 낙하에는 이 원칙과 어긋나는 현재 제한이 남아 있다. `updatePlayer()`의 조작 뿌요 낙하는 한 번의 `updateWorld()` 호출에서 `nextFloor` 한 칸까지만 보정하므로, `PLAYER_FALL_INTERVAL / getPlayerFallSpeedMultiplier()`가 갱신 간격보다 짧아지면 실제 속도가 프레임률에 따라 제한된다. 예를 들어 60fps에서는 한 프레임당 최대 한 칸이라 16.7ms/칸(약 122.9배)보다 빨라지지 않는다. 고배율 상한을 제대로 실현하려면 충돌을 건너뛰지 않으면서 여러 칸 이동을 처리하는 별도 수정이 필요하다.
- 60fps 환경에서는 간격이 16.7ms라 루프가 한 번만 돌아 예전과 동작이 같다. 달라지는 것은 20fps 미만에서 시간이 정확해진다는 점뿐이다.
- 리플레이 기록(`recordReplayFrame()`)도 이 루프 안에서 돌며 `REPLAY_SAMPLE_INTERVAL` 기준으로 표본을 남긴다. 나눠 갱신하면서 표본 간격이 더 고르게 됐고, BUILDNO 41 이전에 기록한 리플레이와의 호환성은 유지하지 않기로 했다.

## 보드와 기본 규칙

- 필드는 가로 6칸, 내부 세로 25칸이며, 화면에는 아래쪽 12칸만 보인다. 보드 배열은 `board[y][x]`이고 아래가 `y=0`이다.
- 일반 색 뿌요는 `red`, `green`, `yellow`, `blue`, `purple`이다. 색 수 선택은 3/4/5색이다.
- 같은 색의 상하좌우 연결 4개 이상이 한 폭발 그룹이다. 폭발 뒤 인접한 일반 방해뿌요(`garbage`)도 제거되고, 중력 후 다시 폭발을 검사해 연쇄한다.
- 딱딱뿌요(`hardGarbage`)는 폭발 인접 1회면 일반 방해뿌요가 되고, 같은 폭발 단계에서 2회 이상 맞으면 파괴된다. 철구뿌요(`iron`)는 시뮬레이터 전용이며 일반 폭발로 사라지지 않는다.
- 패배 기본 칸은 `(2, 11)`이다. 피버 룰과 연속 피버는 `(2, 11)`, `(3, 11)` 둘 다 사용한다. 패배 판정·렌더링·AI 가상 배치 모두 같은 규칙을 유지해야 한다.
- 적 AI는 피버 중이 아닐 때 패배 위치 경고를 최우선으로 처리한다. 기본 룰(구경 포함)은 `(2, 8)`이 차면 X=2의 **비폭발** 배치를 피한다. 피버 룰(구경·완화 피버 포함)은 `(2, 8)` 또는 `(3, 8)`이 차면 X=2·X=3의 비폭발 배치를 모두 피한다. 해당 열에 놓아 즉시 폭발할 수 있는 후보는 예외이며, 피버가 활성화된 적에게는 이 회피 규칙을 적용하지 않는다.

### 점수와 공격

점수/공격 변경은 `calculateExplosionPoint()`, `calculateExplosionAttack()`, `resolveExplosions()` 및 시뮬레이터·AI 미리보기까지 함께 확인한다.

- 한 폭발 단계의 색 뿌요 수를 `N`이라 하면, 점수는 `N * hardMultiplier * max(1, chainBonus + connectionBonus + colorBonus) * 10`이다.
- 연결 보너스는 폭발 단계별 색상 수를 먼저 합산해 계산한다. 단색이면 그 색의 전체 수를, 다색이면 **가장 많이 폭발한 한 색의 수**를 `getConnectionBonus()`에 넣는다. 색수 보너스와 점수용 일반 뿌요 수는 여전히 동시에 폭발한 전체 색·전체 일반 뿌요 기준이다.
- `hardMultiplier`는 그 단계에서 한 번에 파괴한 딱딱뿌요 수에만 적용한다.
- ATTACK은 현재 마진 레이트로 점수를 나눈 뒤 `EXPLOSION_REWARD_MULTIPLIER`와 시간 진행 배율을 곱한 값이다. 시간 진행 배율은 360초 직전까지 1이고 360초부터 60초마다 두 배가 되어 최대 4096이다. `game.timeProgressMultiplier`와 `getTimeProgressMultiplier(elapsed)`를 함께 갱신·검증한다.
- 연습 게임의 싹쓸이는 기존 점수 `+100`과 예약 `ATTACK 12`를 만들지 않고, 싹쓸이 순간에 점수 `+2100`을 직접 더한다. 기본 룰·퍼즐뿌요·시뮬레이터·플레이 방법의 싹쓸이는 플레이어별 티켓을 하나 부여하고, 보유 중 필드 배경을 황금색으로 유지한다. 기본 룰에서 다음 **색 뿌요 폭발**이 티켓을 소진하면 점수 `+2100`, ATTACK `+30`을 직접 더한다. 이 티켓 보너스는 마진 레이트 70으로 환산한 고정값이므로 게임 시간·현재 마진 레이트를 다시 적용하지 않는다. 이후 ATTACK/DAMAGE 상쇄와 상대 DAMAGE 전달은 기존 순서·에너지 정산 경로를 사용한다.
- 싹쓸이 자체는 더 이상 상대 예고뿌요·방해뿌요를 만들지 않는다. 다만 같은 연쇄에서 생긴 일반 ATTACK은 에너지 이동, 상쇄, 상대 DAMAGE 및 필요한 방해뿌요 낙하까지 정산해야 한다. 플레이 방법 4단계는 보라색 쌍으로 첫 싹쓸이·티켓을 보여 준 뒤, 빨강색 쌍 두 개를 회전·이동 없이 차례로 내려 티켓 보너스 공격과 재싹쓸이를 시연한다. 이때 예고뿌요와 방해뿌요 낙하가 끝난 뒤 5단계로 넘어간다. 시뮬레이터는 재생 결과가 빈 보드면 티켓이 부여된 상태로 완료한다.
- 피버 룰·피버 룰 (시작)·연속 피버의 싹쓸이는 티켓을 사용하지 않으며, 기존의 점수 `+100`·황금 연출·목표 연쇄/시간 보너스 규칙을 유지한다.
- 연쇄 중에는 에너지/ATTACK 전달과 DAMAGE 상쇄 순서가 중요하다. `resolveExplosions()`와 전송·정산 함수의 대기 조건을 우회하지 말고, 연쇄 완료 뒤 상대 DAMAGE로 넘어가는 계약을 보존한다.
- BUILDNO 99부터 피버 중 자기 피해 상쇄는 **매 폭발 단계의 현재 상태**로 `피버 DAMAGE → 현재 피버 회차를 향하는 상대 ATTACK → 유예된 일반 DAMAGE → 나머지 상대 ATTACK` 순서다. `sendAttackEnergy()`는 상대의 `chainTargetFeverId`가 자신의 현재 `fever.activationId`와 일치하는 비음수 값인지 매번 확인한다. 일반 필드행(-1)·이전 피버 회차행·목적지 미지정(null) 공격은 유예 DAMAGE 뒤에서 상쇄한다. 자신의 `chainTargetFeverId`로 상쇄 우선순위를 고정하거나 이 과정에서 덮어쓰지 않는다. 정수 부분만 상쇄하며 소수 잔여값과 기존 상쇄 에너지 연출을 보존한다.
- 대전 피버 룰의 최종 DAMAGE 목적지는 **연쇄 첫 폭발 당시 상대의 피버 상태**로 결정한다. `resolveExplosions()`가 정수 ATTACK 생성 여부와 관계없이 `chainTargetFeverId`를 기록한다. 상대가 일반 상태였다면 도중에 피버로 진입해도 연쇄 전체의 잔여 공격은 `normalDamage`로 들어가며 피버 종료까지 낙하를 유예한다. 처음부터 피버였다면 해당 피버의 `damage`에 넣는다. `activationId`로 피버 회차를 구별하므로 그 피버가 이미 끝났다면 일반 피해에 합산하며, 새로 진입한 피버에 이전 공격을 넣지 않는다.
- **피버 룰 방해뿌요 낙하와 피버 종료(BUILDNO 77 점검)**: 피버 룰에서는 터진 배치 뒤 `garbage` 단계를 건너뛰고(`resolveExplosions()`가 바로 `check`), 터지지 않은 배치 뒤에만 `dropGarbage()`가 떨어뜨린다(`fever.deferGarbage`는 값만 기록하고 읽는 곳이 없다). 피버 남은 시간이 끝난 경우 — 터진 배치면 `feverWait` 정산 뒤 `finishPlayerFever(player, 'B')`가 피버 DAMAGE를 일반 DAMAGE에 합치고 바로 조작으로 넘어가며, 이후 터지지 않은 배치에서 일반 필드에 떨어진다. 터지지 않은 배치면 `check`의 종료 A가 합친 뒤 `garbage` 단계로 **조작 전에** 일반 필드에 떨어뜨린다. BUILDNO 76까지는 이 경우 `garbage` 단계가 종료 전에 먼저 돌아 피버 DAMAGE가 곧 사라질 피버 필드에 떨어져 **없어지는 버그**가 있었고, `dropGarbage()`가 시간이 끝난 피버 필드에서는 낙하 없이 `check`로 넘기도록 고쳤다. `python/learning.py`도 같은 규칙으로 맞췄다(`_is_expired_fever_placement()`·`_drop_pending_garbage()`, 종료 직후 패배 판정 포함). 회귀 테스트는 `tests/test01_fever_damage.spec.js`의 피버 시간 만료 두 경우와 `python/test_learning.py`의 `test_expired_fever_placement_*` 두 개다.
- `applyAttackDamage()`는 즉시 정산과 에너지 연출 완료 후 지연 정산에 공통으로 쓰인다. 지연 에너지는 목적지를 자체 보관하고, 연쇄 종료 시 플레이어의 목적지는 전달량이 0이어도 초기화한다. 상쇄 순서·정수 처리·연출 대기·비피버 룰은 유지한다. `tests/test01_fever_damage.spec.js`는 실제 게임 루프에서 첫 폭발의 ATTACK이 1 미만인 연쇄, 피버 진입 전후, 즉시/지연 정산, 피버 중 낙하 유예와 종료 후 실제 낙하, 전량 상쇄 후 새 연쇄, 피버 종료·재진입, 일반/피버 예고의 앞뒤 표시와 리플레이 보존을 검사한다.
- BUILDNO 73부터 `normalWarningPreview()`가 현재 예고를 만든 `announcedAttackEnergy.targetFeverId`로 일반 필드행 미정산 예고를 분리한다. 피버 중에는 이 값을 일반 DAMAGE에 더해 뒤쪽에 흐리게 그리고, `currentFieldWarningAmount()`로 앞쪽 예고에서 제외한다. 상쇄·AI용 `warningAmount()`와 실제 피해량은 변경하지 않았다. `getGameState()`의 `warningPuyos`는 앞쪽에 그리는 목록과 일치한다. 뒤쪽 예고는 `FEVER_NORMAL_WARNING_ALPHA`를 `globalAlpha`에 걸어 통째로 흐리게 그리므로, 예고뿌요의 `draw()`는 `globalAlpha`를 덮어쓰지 말고 호출 시점의 값을 곱해서 쓴다. 슬라임 계열(1·6개 단위)과 초입방체 세 종이 이 규칙을 따르며, 새 예고뿌요를 더할 때도 같은 규칙을 지킨다. 새 리플레이는 수신 플레이어의 선택적 델타 필드 `nw`에 분리된 미정산 예고량을 기록한다. 기존 형식 3과 호환되며, `nw`가 없는 과거 기록은 구분을 추측하지 않고 기존 표시를 유지한다.

## 게임 모드

| 모드 | 핵심 계약 |
| --- | --- |
| 기본 룰 | 사람 대 CPU의 일반 필드 대전. 승리는 난이도별 기본 룰 진행도에 저장된다. |
| 피버 룰 | 각 플레이어가 일반 필드와 피버 필드를 가진다. 피버 게이지/시간/목표 연쇄는 플레이어별 상태다. 승리는 별도 피버 진행도에 저장된다. |
| 피버 룰 (시작) | 기본은 잠금 상태이며, 어떤 난이도에서든 피버 룰로 키마리스를 이기면 해금된다. 해금 후 피버 룰과 같은 적 선택·필드 규칙을 사용하되 승리는 별도 피버 시작 진행도에 저장한다. 카운트다운 뒤 양쪽이 목표 5연쇄·60초의 피버 스테이지에서 즉시 시작한다. |
| 피버 룰 (완화) | 피버 룰 (시작)과 동시에 해금된다. 피버 룰과 같은 진행이지만 양쪽의 최소 전등 수가 `min(6, FEVER_LIGHT_STARTS + 3)`이며 피버 종료 뒤에도 이 값으로 돌아간다. 적 진행도와 리더보드는 별도로 저장하고, 승리 시 적 갤러리는 해금한다. |
| 연습 | 단독 플레이 배치. 오른쪽은 연습 상대이며 일반 뿌요를 받지 않는다. |
| 연속 피버 | 단독 플레이 피버 스테이지. 목표 5연쇄·60초로 시작하며 두 패배 칸을 쓴다. |
| 퍼즐뿌요 | 항상 5색, `PuzzlePuyoStage` 기반 단독 스테이지다. 오른쪽 영역은 적 필드가 아니라 목표/턴 상태 표시다. |
| 구경 | 선택 가능한 두 CPU가 자동 대전한다. 플레이 조작은 막고 ESC 일시정지만 허용한다. 결과 뒤 5초면 다음 대전을 자동 시작한다. |
| 너랑 나랑 | 메인 메뉴에서 오프라인 플레이·온라인 플레이를 고른다. 온라인 플레이는 설정된 게임 서버가 사용 가능하다고 응답할 때만 표시된다. 오프라인은 한 컴퓨터에서, 온라인은 서로 다른 컴퓨터에서 두 사람이 대전한다. 규칙은 기본 룰·피버 룰·피버 룰 (시작)과 같고 진행도·GOLD·AI 학습은 모두 대상이 아니다. |

### 너랑 나랑 (한 컴퓨터 2인 대전)

- 메인 메뉴 두 번째 항목이다. BUILDNO 50부터 "너랑 나랑"은 **오프라인 플레이**(한 컴퓨터 2인 대전)와 **온라인 플레이**(서로 다른 컴퓨터 2인 대전) 두 방식으로 나뉜다. 항목을 고르면 `openTogetherModeSelection()`이 메인 메뉴를 음영 처리한 방식 선택 오버레이(`togetherModeSelectionOpen`, `getNowScreen()` 화면 이름 `together_mode_select`)를 연다.
- 방식 선택지는 `TOGETHER_MODE_OPTIONS`의 `오프라인 플레이`·`온라인 플레이`·`취소`를 한 줄로 놓는다. 서버가 온라인 플레이를 지원한다고 응답하면 로그인·가입(`online_login`·`online_signup`), 대기실(`online_lobby`), 방(`online_room`)으로 이어진다. 지원하지 않으면 온라인 선택지는 비활성화되어 포커스에서 빠지고 `준비 중`으로 표시된다. 오프라인 플레이는 `openTogetherGuide()`로 안내 화면(`menuScreen`이 `togetherGuide`)을 열고, `취소`·ESC·버튼 밖 클릭은 오버레이만 닫고 메인 메뉴에 머문다.
- 안내 화면의 제목은 `오프라인 너랑 나랑 플레이`(영어 `Offline-Based Play Together`)다. 메인 메뉴 항목 이름과 방식 선택 오버레이 제목은 여전히 `너랑 나랑`이다.
- 안내 화면은 조작키 안내와 규칙·색상 수·동작 세 행으로 구성하며 타이틀 화면 대신 전체를 그린다. 포커스(`togetherGuideFocus`)는 0이 규칙, 1이 색상 수, 2가 시작·취소다. 위아래 방향키로 행을 옮기고 좌우 방향키로 값을 고르며, 규칙·색상 수 행에서 Enter를 누르면 다음 행으로 내려간다. 취소와 ESC는 메인 메뉴로 돌아간다.
- 규칙 선택지는 `TOGETHER_RULE_OPTIONS`의 기본 룰·피버 룰·피버 룰 (시작)이고, 피버 룰 (시작)의 잠금 조건은 기존 규칙 선택과 같은 `isFeverStartRuleUnlocked()`다. 잠긴 선택지는 `잠김` 표시와 함께 좌우 이동에서 건너뛴다.
- `startTogetherGame()`이 양쪽 `PlayerState`의 컨트롤러를 모두 `null`로 두고 `game.together = { rule, wins }`를 만든다. 이름은 번역하지 않는 `1P`·`2P`(`TOGETHER_PLAYER_NAMES`)이고, 배경·배경음에 쓸 `themeController`만 `PracticeEnemy`로 채운다. 그래서 배경음악은 연습과 같은 공통 곡을 쓴다.
- 중앙 영역은 초상화 대신 `drawTogetherRecordPanel()`의 누적 승수 패널을 그린다. 실제 대전의 누적 승수는 모듈 상태 `togetherWinCounts`에 있고, `openTogetherGuide()`에서만 초기화한다. 결과 화면의 `다시 플레이`(`restartTogetherGame()`)는 이 값을 유지한 채 같은 규칙·색상 수로 다시 시작하고, `종료`는 메인 메뉴로 돌아간다.
- 결과 화면 버튼은 `다시 플레이` → `종료` → `리플레이 복사`(기록이 있을 때) 순서다. 기본 포커스는 0번 `다시 플레이`이므로 결과 화면에서 Enter만 누르면 바로 이어서 대전한다.
- 연쇄 주문 효과음은 `playComboSounds()`가 고른다. 좌측 1P는 다른 화면의 사용자와 같은 공통 `spellCombo1~7`을, 우측 2P는 적 컨트롤러가 없어도 공통 `commonEnemySpellCombo1~7`을 써서 좌우 소리를 구분한다.
- 진행도(`recordEnemyClear()`), GOLD(`calculateCurrentGameGoldReward()`), 역방향 학습 전송(`shouldSendLearningEvent()`), 가상 컨트롤러(`shouldShowVirtualController()`)는 모두 `game.together`를 제외 조건으로 갖는다. ONNX 모델 준비도 호출하지 않는다.
- 조작키는 `resolveTogetherKeyInput()` 한 곳에서 판정한다. 1P는 `TOGETHER_PLAYER_ONE_KEY_CODES`(방향키·Z·X와 F·G·H·B), 2P는 `TOGETHER_PLAYER_TWO_KEY_CODES`(키패드 4·6·2·5와 `[`·`]`)를 쓰며 **반드시 물리 키 코드로 판정한다**. NumLock이 꺼져 있으면 키패드가 방향키 문자값을 보내므로, 문자값으로 판정하면 2P 조작이 1P로 새어 들어간다.
- 방향 홀드 상태는 `playerDirectionInputs[0|1]`에 플레이어별로 있다. 좌우 홀드 반복·빠른 하강·리플레이의 빠른 하강 기록이 모두 `getPlayerDirectionInput(player)`를 거치므로, 새 입력 수단을 붙일 때도 이 배열을 사용한다. 가상 컨트롤러 입력은 1P 전용이다.
- 게임패드는 `updateGamepadInput()`이 "너랑 나랑"에서만 `navigator.getGamepads()`의 0번을 1P, 1번을 2P로 고정해 읽는다. 그 밖의 화면에서는 예전처럼 첫 번째로 연결된 게임패드 하나만 1P 자리에 쓴다. 게임패드가 만든 내부 이벤트는 `gamepadPlayerIndex`로 조작 대상을 전달한다.
- `getGameState()`의 `mode`는 `together`, `getNowScreen()`의 화면 이름은 방식 선택이 `together_mode_select`, 안내 화면이 `together_guide`다. 두 이름 모두 WebMCP `now_screen`의 `screenNames`와 `manual` 문구에 들어 있다.

### 피버와 연속 피버

- 피버 패턴은 `FeverStageState`, 등록 목록은 `FEVER_STAGES`다. 패턴의 일반 색은 선택한 색상 수와 호환되어야 하며, 지급 쌍의 같은색/다른색 형태도 현재 NEXT와 맞춘다.
- 피버 전용 필드와 연속 피버 필드의 **고정된 보드 뿌요** 중력은 일반보다 1.5배 빠르다. 컨트롤 단계에서 새로 지급된 뿌요 쌍의 자연 낙하에는 이 배율을 적용하지 않으며, 자연 낙하 속도는 `PLAYER_FALL_SPEED_INCREASE_PER_MINUTE`(현재 1.0)만큼 게임 경과 1분마다 증가해 `MAX_PLAYER_FALL_SPEED_MULTIPLIER`(현재 128배, 127분 경과)에서 멈춘다. 계산식은 `1 + 경과분 × 증가량`이며, 현재 값에서는 `1 + 127 × 1.0 = 128`이다. 계산 함수 자체는 상한을 반환하지만, 실제 조작 뿌요 이동은 위 게임 루프의 한 호출당 한 칸 제한 때문에 고배율에서 상한 속도까지 도달하지 않는다.
- 피버 룰에서 **실제 피버에 진입해** 패턴을 배치하기 직전의 일반 플레이 영역이 비어 있었다면, `RANDOM_EMPTY_FIELD_ENEMY_TYPES`의 기본 제공 적은 그 패턴 첫 배치를 무작위 위치로 정한다. 한 번 배치한 뒤 또는 패턴 전 필드가 비어 있지 않았다면 기존 AI 전략을 사용한다.
- 피버에 아직 진입하지 않은 일반 필드 싹쓸이 보상 4연쇄 패턴은 이미 뿌요가 깔린 특수 필드다. BUILDNO 100부터는 이 경우 `randomizeStageOpening`을 켜지 않으므로, DAMAGE 위협에 따른 최적 공격·N수·ONNX 판단이 공통 무작위 후보에 선점되지 않는다. 이 상태는 `fever.active === false`라 일반 피버 중의 `findBestFeverComboPlacement()` 우선 분기는 여전히 타지 않는다.
- 피버 룰에서 적이 일반 필드 싹쓸이 보상으로 받는 4연쇄 패턴은 `prepareFeverTurn()`이 숨김 행에 올린 뒤 `startGravity(..., 'feverStageControl')`로 정산한다. 중력 애니메이션이 끝나 `feverStageControl`에서 `enterControl()`로 넘어간 뒤에만 `controller.prepareTurn()`이 실행되므로, 최적 공격·연쇄·N수 시뮬레이션과 ONNX 첫 추론은 모두 패턴의 중력 완료 보드를 기준으로 새로 판단한다. 피버 중 ONNX의 실시간 재추론만 꺼 두며, 턴 시작 추론은 그대로 실행한다.
- 다음 목표 연쇄는 완료 연쇄 `+ 1`, 싹쓸이면 추가 `+ 2`, 최소 4·최대 12를 적용한다. 현재 구현은 직전 목표보다 한 번을 초과해 급격히 낮아지지 않도록 추가 제한도 둔다. 정확한 변경은 `calculateContinuousFeverTarget()`을 기준으로 한다.
- 연속 피버는 시간 만료 후에도 진행 중인 연쇄·효과·전송 정산을 끝낸 뒤 종료한다. 만료 뒤 보너스로 시간이 되살아나지 않는다.

### 퍼즐뿌요

- `PUZZLE_STAGES`의 순서와 `PuzzlePuyoStage` 데이터가 콘텐츠의 기준이다. 새 스테이지는 `registerPuzzleStage()`로도 등록할 수 있다. 스테이지 `hint`는 한국어 원문을 번역 키로 사용하므로, 새 힌트를 추가할 때는 `stringTable`의 영어·일본어·중국어·독일어·프랑스어 번역도 함께 추가한다.
- 승리 조건: `combo`, `clear`, `multiple`, `color`, `attack`.
  - `clear`는 한 번이라도 싹쓸이가 발생하면, 후속 정산 뒤에도 승리로 유지되어야 한다.
  - `multiple`/`color`는 한 폭발 단계의 최대 동시 폭발 수/색 수다.
  - `attack`은 해당 턴의 공격과 상대에게 적용된 피해(예고량)의 합을 사용한다.
- 클리어 스테이지와 별 획득 스테이지는 `puyow_store`에 별도 저장한다. 권장 턴 수 이내 클리어하면 별을 얻는다.
- 퍼즐 최초 클리어와 최초 별 획득 보상은 각각 1,000 GOLD이며 `puzzleGoldClearStages`, `puzzleGoldStarStages`로 진행도와 별개로 기록한다. 이 보상 필드가 없는 기존 저장은 기존 클리어·별 기록을 지급 완료로 이관해 소급 지급하지 않는다.
- 스테이지 선택은 첫 두 개를 기본으로 열고, 클리어 진행도에 따라 뒤쪽 두 개까지 연다. 취소 카드·조건·힌트·키보드·마우스 동작을 함께 유지한다.

### GOLD와 카드

- GOLD는 `puyow_store.gold`의 0 이상 정수이며 잘못된 값은 로드 시 0으로 보정한다. 메인 메뉴와 갤러리 좌측 상단에는 번역하지 않는 `GOLD` 단위와 천 단위 콤마로 표시한다.
- 기본/피버/피버 룰 (시작)/피버 룰 (완화) 대전 승리와 연습/연속 피버 정상 결과 진입 때 종료 점수를 바탕으로 GOLD를 한 번 지급한다. 점수 패널티는 기본 300, 피버·피버 룰 (완화) 1,000, 피버 룰 (시작)·연습 10,000, 연속 피버 100,000이다. 난이도 배율은 쉬움 3, 보통 4, 어려움 5, 극한 7이고 단독 모드는 1이다. 기본 적 배율은 안드로말리우스부터 안드레알푸스까지 1~8, 솔로몬·외부 적·단독 모드는 1이다. 구경, 퍼즐의 일반 종료 계산, 일시정지 종료에는 지급하지 않는다.
- 보유 카드는 `puyow_cards`의 개별 `{id,type}` 인스턴스 배열이다. 기본 카드 풀은 일반뿌요 5종, 방해뿌요 3종, 예고뿌요 11종(단위 1·6·30·210·500·2000·80000·500000·3000000·20000000·140000000), 출시 적 21종(안드로말리우스~알로케스)이며 `getCardDefinitions()`의 가중치를 쓴다. 안드라스·발라크·자간·바퓰라를 포함해 플라우로스 뒤에 추가된 출시 적은 자동으로 가중치 1 카드가 되며, 솔로몬과 `notAvail` 출시 예정 적 2종(발람·푸르카스)은 제외한다. 단위 500000보다 큰 예고뿌요도 자동으로 가중치 1 카드가 된다. BUILDNO 119에서 앞으로 추가될 희귀 카드를 고려해 가중치 10 이상인 명시 카드의 가중치를 모두 20배로 올렸고(예: 빨강 4000, 방해뿌요·예고 1은 6000, 안드레알푸스·예고 2000은 200), 10 미만(예고 80000의 5, 가중치 1 카드들)은 그대로 두었다. 등급은 `getCardRarity(weight)`가 가중치로 정한다. 10 미만 LEGENDARY(황금색 `#e7be48`), 10 이상 100 미만 EPIC(보라색 `#c9a4ef`), 100 이상 1000 미만 RARE(연한 파랑 `#a9d9f5`), 1000 이상 2800 미만 UNCOMMON(연한 초록 `#b9e6b4`), 그 외 COMMON(연한 회색 `#d9dde1`)이다. 20배 조정 후 10~99 구간의 카드가 없어 현재 EPIC 카드는 0종이며, 이는 요청대로 둔 것이다(이후 EPIC 가중치 카드를 추가하면 자동으로 보라색·에픽 연출이 적용된다). 등급 문구는 카드에 표시하지 않는다.
- 갤러리의 카드 유형은 8열·약 4행 카드 목록, 세로 스크롤, 키보드·마우스 포커스/선택을 지원한다. 1장/10장 뽑기는 각각 1,000/9,000 GOLD, 합성은 카드 5장당 새 카드 1장을 지급한다. 자원이 충분하면 먼저 전체 화면 확인창을 열고 사용자가 확인했을 때만 GOLD 차감 또는 선택 카드 소비와 결과 지급을 수행한다.
- 카드 뽑기·합성으로 지급한 카드는 저장을 끝낸 뒤 `revealGrantedCards()`를 통해 선택적 3D 등장 연출을 요청한다. `puyow_3d.js`의 `PuyoW3DEffectManager.playCardReveal()`이 기존 카드 그림 콜백을 텍스처로 만들고, 카드의 회전·광채·광륜·입자를 그린다. 등급 레벨은 COMMON 0 → UNCOMMON 1 → RARE 2 → EPIC 3 → LEGENDARY 4이며, 레벨에 따라 광륜·입자 수와 회전량·광채를 강화하고 등급 문구는 표시하지 않는다. 주 색상은 흰빛·초록·파랑·보라(`0xb46bff`)·금(`0xffd45b`)이다. EPIC 이상은 보조 색(에픽 분홍 `0xff6ad5`, 전설 연금색) 입자가 반대 방향으로 맥동하며 소용돌이치고, 착지 무렵 `RingGeometry` 충격파가 퍼진다(에픽 1겹, 전설 2겹). LEGENDARY는 추가로 카드 뒤에서 회전·맥동하는 18갈래 햇살(`rayTexture`, 전설 카드끼리 공유), 카드 면을 1.3초마다 훑는 광택 띠(같은 캔버스를 쓰는 카드별 `CanvasTexture`의 `offset.x` 이동), 아래에서 떠오르는 금빛 반짝이 60개, 앞면의 금빛 이중 테두리, 600~1,100ms 사이의 화면 전체 금빛 섬광(`reveal.flash`, 전설 카드가 있을 때만 하나), 따뜻한 색의 배경 가림막을 쓴다. 섬광·충격파·반짝이처럼 스스로 밝기가 바뀌는 물체는 `object.userData.opacityScale`에 배율을 두고, 매 프레임 `baseOpacity * fade * opacityScale`로 합성한다. 새 텍스처는 `createPaintedTexture()` 또는 `own()`을 거쳐야 종료 때 해제된다. 여러 장도 한 번에 격자로 등장하므로 전체 시간은 가장 높은 등급에 따라 2,200/2,650/3,100/3,550/4,000ms다. `frame(time)`의 절대 시각과 종료 타이머를 함께 사용하므로 게임의 delta 상한 때문에 4초를 넘도록 늘어나지 않는다. `tests/test01_menu.spec.js`의 카드 3D 테스트는 10장 뽑기(`Math.random` 0.999999, 가중치 1 카드)가 전설 레벨 4로 나오는지와, 다섯 등급을 직접 넣었을 때 에픽·전설 전용 요소 구성 및 자원 해제를 확인한다.
- 연출 중 Enter·Space·ESC·게임패드 확인/취소·캔버스 클릭은 연출만 끝내고 뒤쪽 카드 선택·추가 구매·갤러리 종료로 전달하지 않는다. 방향키와 휠은 연출 중 목록을 바꾸지 않는다. 종료 후 이미 지급된 새 카드에 포커스가 남는다. THREE·효과 모듈이 없거나 WebGL 생성·렌더링이 실패하면 기존 2D 카드 목록으로 바로 진행하며, 카드 재추첨·재지급·추가 차감은 하지 않는다.

### 구경 모드와 진행도

- 구경 메뉴는 기본 룰 또는 피버 룰에서 데카라비아를 `normal`, `hard`, `extreme` 중 하나로 이겼을 때만 열린다. 쉬움과 난이도 없는 기존 `clearList` 기록은 해금 근거가 아니다.
- 구경 CPU 후보는 두 규칙에서 보통 이상으로 이긴 출시된 적이다. `Solomon`, `Andromalius`, `Dantalion`은 항상 제외하며, 서로 다른 두 적을 뽑아야 한다.
- ONNX 추론으로 판단하는 적(`requiresOnnx`)은 구경 대전에 **아예 나오지 않는다**. `getWatchOpponentCandidates()`가 ONNX 런타임 사용 가능 여부와 무관하게 이들을 후보에서 모두 빼므로, `selectWatchOpponents()`는 종류가 다른 두 적만 고르면 된다. 적 선택 화면과 갤러리는 이 제한을 받지 않는다(그쪽 규칙은 「브라우저 ONNX 추론 적」 절을 따른다). 구경 대전에는 적 선택 화면이 없어 모델 로딩 실패를 안내할 곳이 마땅치 않다는 점도 이 규칙의 이유다.
- `puyow_code`에 `observation`이 있으면 저장 진행도는 바꾸지 않고 적 선택 화면의 진행도 잠금만 해제한다. `hidden` 및 출시 예정(`notAvail`) 적은 기존처럼 잠긴 채로 유지한다. 같은 코드가 있으면 구경 메뉴도 즉시 열리며, 구경 후보는 숨김·출시 예정 적과 `requiresOnnx` 적, `Solomon`, `Andromalius`, `Dantalion`을 제외한 모든 출시 적이다.
- 구경 대전은 적 잠금 해제와 갤러리 잠금 해제를 진행시키지 않는다.
- 일반 대전 승리 기록은 `clearListByDifficulty`(기본), `feverClearListByDifficulty`(피버), `feverStartClearListByDifficulty`(피버 룰 (시작)), `relaxedFeverClearListByDifficulty`(피버 룰 (완화))에 난이도별로 저장된다. 각 룰의 적 잠금은 해당 저장소만 사용한다. `clearList`는 이전 기본 룰 호환용 전체 목록이므로 신규 난이도 판단 근거로 사용하지 않는다.

## UI·입력·결과 화면

- 초기 화면은 `initial_title`이며 Enter, Gamepad A 또는 캔버스 클릭으로 메인 메뉴에 들어간다.
- 메인 메뉴 좌측 공지사항은 논리 X=42, Y=230에서 시작하고 폭 350px로 줄바꿈해 표시하며, 아래쪽은 좌측 하단 버튼 묶음 위에서 잘린다. 공지사항은 `notice_[LANG].txt`에서 읽으며, 표시 영역을 변경할 때 줄바꿈 폭과 클리핑 폭을 함께 수정한다.
- 메인 메뉴 배경의 부유 뿌요는 실제 그리기 순서의 맨 위 항목부터 원형 히트박스로 클릭을 판정한다. 클릭 지점에서 중심 바깥 방향으로 속도 충격을 주며 시간이 지나면 원래 유영 속도로 돌아간다. 메뉴·음소거·GitHub·리더보드·리플레이 버튼과 메뉴 오버레이는 부유 뿌요보다 클릭 우선순위가 높다.
- 플레이 중 회전 Z/X는 `event.key`뿐 아니라 물리 키 코드 `KeyZ`/`KeyX`도 받아 macOS 한글 입력기·다른 키보드 레이아웃에서 동작해야 한다. 텍스트 입력 중에는 물리 키 코드로 문자 입력을 바꾸지 않는다.
- 메인 메뉴의 게임 시작은 `도장깨기`·`트레이닝`·`퍼즐뿌요`·`취소`를 먼저 보여 준다. 트레이닝 하위 단계는 연습·연속 피버·취소를 보여 준다. 도장깨기 하위 단계는 기본 룰 한 줄, 피버 룰·피버 룰 (시작)·피버 룰 (완화) 한 줄, 취소 한 줄의 3줄 배치다. 퍼즐뿌요는 스테이지 선택으로 바로 이동한다. 선택지 바깥 클릭은 무시하고, ESC는 해당 단계의 취소와 같다. 첫 단계 취소는 메인 메뉴, 둘째 단계 취소는 첫 단계로 돌아간다. 피버 룰 (시작)과 피버 룰 (완화)은 같은 조건으로 잠기며 포커스·활성화에서 제외한다.
- 연습·연속 피버의 색 수 화면에서 취소하면 트레이닝 하위 선택지로 돌아간다. 퍼즐 스테이지 선택에서 취소·ESC를 누르면 메인 메뉴로 돌아간다. 퍼즐 결과 화면에서 스테이지 선택으로 복귀한 뒤에도 같다.
- 단독 모드 결과의 오른쪽 영역에는 일반 적 결과를 출력하지 않는다. 퍼즐은 전용 스테이지 상태를, 연습·연속 피버는 빈 적 영역을 사용한다.
- 결과 화면 이후의 복귀 대상은 모드별로 다르다(단독 모드는 메인, 퍼즐은 스테이지 선택, 대전은 적 선택, 너랑 나랑과 리플레이 재생은 메인). 변경 시 `closeResultScreen()`과 관련 메뉴 포커스를 함께 확인한다.
- 결과 화면 버튼은 `getResultScreenButtons()`가 만든다. 0번 버튼은 논리 좌표 (515, 165, 250, 64)에 두고 이어지는 버튼은 그 아래 12px 간격으로 놓는다. 너랑 나랑 결과에서는 `다시 플레이`가 맨 위에 오고 그 뒤에 `종료`가, 다른 결과에서는 `종료`가 0번이다. 이어서 리플레이 재생 결과에는 `다시보기`와 그 아래 `리플레이 복사`(BUILDNO 89부터)가, 리플레이를 기록한 대전 결과에는 `리플레이 복사`가 붙는다. 버튼이 세 개 이상이면 `drawResultCenter()`가 패배한 적 초상화를 늘어난 버튼 수만큼(한 칸 76px) 내려 그린다(기본 Y=380, 세 개면 456). 너랑 나랑 승수판·온라인 결과판 위치는 그대로다. 기본 포커스(`resultScreenFocus`)는 항상 0번이므로 너랑 나랑 결과에서는 Enter만 누르면 바로 다시 플레이하고, 그 밖의 결과에서는 기존처럼 이전 화면으로 돌아간다. 방향키로 포커스를 옮기고 Enter·Space·마우스로 실행하며, 버튼이 하나뿐일 때는 기존 모습을 지키기 위해 포커스 테두리를 그리지 않는다. 구경 결과의 `다음 대전까지 %1초` 안내는 버튼이 두 개면 논리 Y=470으로 내려 겹침을 피한다.
- 진행 중인 일반·피버·피버 시작·연습·연속 피버·퍼즐·너랑 나랑·구경·리플레이 재생의 일시정지 오버레이는 `재개`(0)·`다시하기`(1)·`종료`(2) 순서다. 방향키는 순환 포커스를, Enter·Space와 마우스는 선택 실행을 맡는다. 다시하기는 현재 모드·규칙·난이도·퍼즐 스테이지를 보존한 새 게임을 만들고 3초 카운트다운부터 시작한다. 구경은 기존 좌·우 적 종류를 유지하고, 너랑 나랑은 `togetherWinCounts`를 유지하며, 리플레이는 같은 기록 데이터를 처음부터 재생한다. 시뮬레이터와 플레이 방법은 이 오버레이 대상이 아니다.
- 다시하기 전 `releaseGameRuntimeResources()`가 각 적의 대기 API 요청·Worker 탐색을 `replaced` 사유로 취소하고 ONNX 모델 대여를 반납한다. 새 게임 생성 뒤에는 이전 비동기 결과가 적용되지 않으며, ONNX 모델 로딩이 끝나야 카운트다운이 진행된다.
- 메인 메뉴 목록은 `TITLE_MENU_OPTIONS`(게임 시작 0, 너랑 나랑 1, 시뮬레이터 2, 플레이 방법 3, 구경 4, 갤러리 5, 설정 6)이고, 항목 배치는 `TITLE_MENU_ITEM_LAYOUT`(폭 218, 높이 42, 시작 Y 250, 간격 8)을 그리기와 클릭 판정이 함께 쓰는 `getTitleMenuItemBounds()`로 계산한다. 항목을 더하거나 빼면 이 두 상수만 고치면 되고, 잠기는 구경 항목은 `TITLE_WATCH_MENU_INDEX`로 참조한다.
- 메인 메뉴 좌측 하단에는 위에서부터 `리플레이 재생`(`TITLE_REPLAY_BUTTON`, 32, 603, 85, 23), `리더보드`(`TITLE_LEADERBOARD_BUTTON`, 32, 634), `GitHub`(`TITLE_GITHUB_BUTTON`, 32, 665) 버튼이 8px 간격으로 쌓여 있다. BUILDNO 93에서 리더보드 버튼을 넣으면서 리플레이 재생 버튼을 634에서 603으로 올렸고, 테스트 도우미 `clickReplayPlaybackButton()`의 클릭 Y도 614로 옮겼다. 그리기와 클릭 판정이 모두 이 상수들을 쓴다. 리더보드 버튼은 `openLeaderboardPage()`로 현재 페이지를 `LEADERBOARD_PAGE_URL`(`./leaderboard.html`, 게임 페이지 기준 상대 경로이며 `convertURL()`을 거친다)로 이동시킨다(새 창이 아니다).
- 목록 밖 버튼의 포커스 순번은 `TITLE_GITHUB_FOCUS_INDEX`(7)·`TITLE_MUTE_FOCUS_INDEX`(8)·`TITLE_REPLAY_FOCUS_INDEX`(9)·`TITLE_LEADERBOARD_FOCUS_INDEX`(10)이며 이동 순서는 `TITLE_MENU_FOCUS_ORDER`가 정한다(목록 0~6 → 리플레이 → 리더보드 → GitHub → 음소거, 좌측 하단은 위에서 아래 순서). 목록이 늘어나면 이 네 상수도 목록 뒤로 밀어야 순번이 겹치지 않는다.
- 메인 메뉴 공지사항의 클립 높이는 고정 390이 아니라 `TITLE_REPLAY_BUTTON.y - 8 - 230`(현재 365)이다. 좌측 하단 버튼 묶음 맨 위 버튼과 겹치지 않게 하려는 것이므로 버튼을 옮기면 공지 영역도 따라 줄거나 늘어난다.
- 가상 컨트롤러의 Z·X·ESC 조작 버튼은 표시 레이아웃과 히트 테스트에 같은 `getVirtualControllerLayout()`을 사용해야 한다. 크기 옵션/대형 배치 변경은 둘을 함께 수정한다.
- 방향 조작은 BUILDNO 30에서 고정 방향 패드를 없애고 [virtualjoystick.js](https://github.com/jeromeetienne/virtualjoystick.js) 방식을 벤치마킹한 가상 조이스틱으로 완전히 대체했다. 조작 버튼 밖을 누른 지점이 그 포인터의 기준점(`virtualJoystickPointers`)이 되고, 손가락을 떼면 기준점과 방향 입력이 함께 사라진다. 기준점은 드래그 중 따라오지 않는다.
- 방향 판정은 `getVirtualJoystickDirections()` 한 곳에 모여 있다. 기준점에서 `VIRTUAL_JOYSTICK_MIN_DRAG`(10, 논리 픽셀) 미만이면 아무 방향도 아니며, 다른 축이 이 축의 `VIRTUAL_JOYSTICK_DIAGONAL_RATIO`(2)배 안쪽이면 두 축을 함께 눌러 대각선을 두 방향키 동시 입력으로 처리한다. 조이스틱이 만든 방향키도 기존 `virtualPointerButtons`에 담기므로, 좌우 홀드 반복과 빠른 하강 같은 후속 처리는 예전 경로를 그대로 탄다.
- BUILDNO 31부터 조이스틱은 좌우 이동과 빠른 하강만 담당하고, 조작 뿌요 회전은 Z·X 가상 버튼 전용이다. 그래서 위로 끄는 동작에는 대응하는 방향키가 없고(`arrowup`을 만들지 않는다), `virtualDirectionInput`에도 `arrowup` 항목이 없다. 위쪽에 조작을 다시 붙일 때는 이 두 곳과 `triggerVirtualButton()`을 함께 고친다. 키보드 ArrowUp과 게임패드 스틱 위쪽의 회전은 이 변경과 무관하게 그대로다.
- 조이스틱은 좌표 계산에 `getCanvasEventCoordinates()`의 논리 좌표를 그대로 쓰고 그림도 같은 좌표계에 그리므로, 세로 화면의 90도 회전에서도 기준점이 손가락 위치에 맞고 방향이 화면 기준으로 자연스럽게 따라온다. 새 방향 입력 수단을 넣을 때도 이 좌표계를 벗어나지 않는다.
- 스틱 그림만 기준점 원(`VIRTUAL_JOYSTICK_RADIUS`) 안으로 제한하며, 방향 판정 자체는 거리 제한을 받지 않는다. 구경(`game.watch`) 중에는 방향 조작이 없으므로 조이스틱을 만들지 않고 ESC 버튼만 남긴다.
- 포인터 처리는 누름과 이동의 역할이 나뉘어 있다. Z·X·ESC 조작 버튼은 `handleVirtualPointerDown()`에서만 눌리고, `handleVirtualPointerMove()`는 조이스틱 드래그만 처리한다. 그래서 버튼 위를 지나가거나 다른 곳에서 끌고 들어온 포인터로는 회전·일시정지가 일어나지 않는다. 좌표 히트 테스트만으로 눌림을 판단하던 예전 구조에서는 마우스를 버튼 위로 지나가기만 해도 눌렸다(BUILDNO 32~33에서 고친 실제 버그다).
- `handleVirtualPointerMove()`는 `event.buttons`가 0인 이동을 조작으로 보지 않는다. 터치·펜은 닿아 있는 동안 1 이상이고 마우스만 누르지 않은 채 0으로 지나가므로 이 값으로 호버를 가려낸다. 이때 남아 있는 포인터 상태가 있으면 캔버스 밖에서 뗀 것으로 보고 정리한다.
- 시뮬레이터 그리기 모드의 우측 버튼은 재생·JSON복사·JSON넣기·초기화·종료 순서다. 초기화는 좌측 플레이 영역의 모든 배치를 제거하며, 버튼 라벨은 `translate('초기화')`를 사용한다. 개발용 도구가 연 편집 모드(`simulator.tools`)에서만 팔레트가 색 뿌요와 방해뿌요로 좁혀지고 `종료` 버튼이 빠지며, 나머지 네 버튼과 지우개 위치는 그대로다.
- 공개 `setGameElapsed(elapsed)`는 진행 중인 게임의 경과 시간을 지정한 값으로 옮기고 마진 레이트·시간 진행 배율을 다시 계산한다. 조작 뿌요의 자연 낙하 속도(`getPlayerFallSpeedMultiplier()`, `PLAYER_FALL_SPEED_INCREASE_PER_MINUTE`만큼 1분마다 증가해 127분 경과 시 상한 128배)도 경과 시간에서 파생되므로, 긴 대전의 후반 상황을 실제로 기다리지 않고 재현할 때 사용한다. 진행 중인 게임이 없거나 0 미만·유한하지 않은 값이면 예외를 던진다.
- 솔로몬이 AI API 요청을 취소할 때는 `abort(reason)`으로 사유(`contact`·`replaced`·`timeout`)를 신호에 함께 싣는다. 요청을 받은 쪽은 `signal.reason`으로 착지·턴 교체·타임아웃을 구분할 수 있으며, 회귀 테스트가 어느 경로로 취소됐는지 확인하는 근거다.
- 공개 `askConfirm(message)`는 메시지를 그대로 표시하고 번역된 확인·취소 버튼으로 `Promise<boolean>`을 완료한다. 키보드·게임패드·마우스를 지원하며, 게임 중 호출 시 자동 일시정지하고 원래 실행 중이었던 게임만 응답 뒤 재개한다. 동시 요청은 순서대로 표시한다. 카드 뽑기·합성 확인도 이 공용 함수를 사용한다. 실제 대기열 등록은 내부 `requestConfirmDialog(message, confirmLabel = '확인')`이 맡으며, 확인 버튼 문구를 바꿔야 하는 내부 확인창(ONNX 적 불안정 안내의 `계속`)만 두 번째 인자를 쓴다. 공개 `askConfirm()`의 버튼은 항상 `확인`·`취소`다. 메시지는 `wrapCanvasText()`로 폭 440px 안에서 공백 기준으로 줄바꿈하고(한 단어가 넘치면 글자 단위), 줄 묶음을 논리 Y=345 중심으로 세로 가운데 정렬한다. 한 줄에 들어가는 짧은 메시지는 예전처럼 원문 한 번의 `fillText`로 그린다.

### 게임 페이지의 WebMCP

- `initialize()`의 `registerWebMcpTools()`가 `document.modelContext`에 `manual`·`now_screen`·`screen_layout`·`now_game_status`·`point_recommend`·`show_message` 여섯 도구를 등록하고(`screen_layout`은 BUILDNO 106부터), `destroy()`가 `webMcpAbortController`로 해제한다. 도구 설명·스키마·`manual` 문구는 AI가 읽도록 영어로 쓴다. `manual`·`now_screen`·`screen_layout`·`now_game_status`에는 읽기 전용임을 나타내는 `annotations.readOnlyHint`를 두며, 온라인 상대 닉네임이 포함된 `now_game_status`에는 `untrustedContentHint`도 둔다.
- **게임 기능을 바꾸면 이 도구도 함께 고친다.** BUILDNO 63에서는 온라인 플레이와 텍스트 입력 대화상자를 반영했다. `getNowScreen()`에 화면 이름을 더하면 `screenNames`를, `getGameState()`·`getNowGameStatus()`에 필드를 더하면 `statusProperties`를, 조작 키·규칙·모드가 바뀌면 `manual` 문구를 함께 본다.
- `now_screen`은 `getWebMcpScreen()`을 쓴다. 공개 `getScreenState()`의 `{screen, playerCanControl}`은 그대로 두고 `mode`·`rule`(대전 밖에서는 null, 계산은 `getGameState()`와 같은 `getGameModeInfo()`), `replayPlayback`, `modelLoading`(`game.onnxLoading`), `confirmDialogOpen`, `textDialogOpen`을 더한다. 온라인 로그인·가입·대기실·방 화면도 `screenNames`와 설명에 포함한다.
- `now_game_status`는 `getNowGameStatus()`가 공개 `getGameState()` 결과에 `replayPlayback`·`together`(`{rule, wins}` 또는 null)·`online`(`{rule, youAreHost, opponentNickname}` 또는 null)을 더해 돌려준다. 같은 상태를 따로 조립하지 않아 두 API가 어긋나지 않는다. `statusSchema.required`는 `statusProperties`의 키 전체이며, 회귀 테스트가 연습 대전에서 실제 반환 키·`properties`·`required`가 정확히 같은지 확인한다.
- `point_recommend`와 `show_message`는 상태 변경이 끝난 뒤 AI가 성공 여부를 알 수 있도록 짧은 문자열을 반환한다. WebMCP의 `outputSchema`는 미래 호환과 테스트용으로 함께 기록하지만 현재 표준 초안의 확정 필드는 아니므로, 실제 브라우저가 이를 노출한다고 전제하지 않는다.
- `playerCanControl`은 왼쪽 1P가 사람이고 조작 중일 때만 true다. 구경과 리플레이 재생(`game.replayPlayback`)은 false이고, 너랑 나랑에서는 1P 기준이다. 리플레이는 기록된 `phase`·조작 뿌요를 되살리므로 예전에는 재생 중에도 true가 되던 버그가 있었다. `point_recommend`도 이 값으로 막으며 추천 칸은 1P 필드에만 그린다.
- 스키마 경계값은 상수로 만든다. 피버 `nextTime`(초)의 최대값은 피버 룰 (시작)이 60초로 시작하므로 `Math.max(FEVER_MAX_TIME, FEVER_START_INITIAL_TIME / 1000)`이고, 퍼즐 `stageIndex`는 개발용 도구가 등록되지 않은 스테이지를 -1로 실행하므로 최소값이 -1이다. `warningPuyos` 설명은 도구 등록 시점의 `WARNING_PUYO_CLASSES`에서 종류와 단위를 읽어 외부 등록 예고뿌요도 포함한다.

### 게임 테마 (적별 배경색)

- 게임 화면의 배경은 `Enemy.getFieldThemeColors()`가 돌려주는 `{bezel, field, center}` 한 벌로 결정한다. `drawBezelBackground()`·`drawPlayerBackground()`·`drawCenterBackground()`의 기본 구현이 각각 이 값을 쓰므로, 단색 테마만 바꿀 때는 `getFieldThemeColors()` 하나만 재정의한다. 세 그리기 메서드를 직접 재정의하는 기존 외부 확장도 그대로 동작한다.
- 기본값은 `DEFAULT_FIELD_THEME_COLORS`(`#0c2433` / `#112f40` / `#071621`)이며 현행 청록 테마다. 솔로몬과 `PracticeEnemy`(연습·연속 피버·퍼즐뿌요·플레이 방법이 쓰는 내부 상대)는 재정의하지 않아 이 기본 테마를 사용한다. 테마를 재정의하지 않은 외부 적도 같다.
- 안드로말리우스(초록)·단탈리온(보라)·세레(청)·데카라비아(자홍)·벨리알(자두)·암두시아스(남색)·키마리스(무채)·안드레알푸스(청록)·플라우로스(주황)·안드라스(남청)·발라크(적갈)·자간(황갈)은 각자 초상화 색과 어울리는 테마를 가진다. 새 색을 정할 때는 `field`가 `bezel`보다 밝고, `center`가 가장 어두우며, 뿌요 색(`#ef5350`·`#66bb6a`·`#f7c843`·`#42a5f5`·`#ab73e8`)이 필드 위에서 충분히 구분되는지 함께 확인한다.
- 화면 전체 여백은 `getGameScreenBackgroundColor()`가 반환하는 테마의 `center` 색으로 채운다. 베젤 바깥과 중앙 영역의 색이 갈라지지 않게 하기 위한 것이므로, 중앙 영역 색을 바꿀 때 이 함수도 함께 본다. 플레이·결과·플레이 방법 화면이 이 색을 쓰고, 메뉴·설정·시뮬레이터·갤러리는 기존 고정 색을 유지한다.
- BUILDNO 84부터 게임 화면 양측 필드 위 예고뿌요 줄(`FIELD_TOP - CELL`)에 칸마다 그리던 어두운 사각형·테두리를 없애 베젤 배경이 그대로 보인다. 예고뿌요 출력 좌표(`drawWarningUnits(x, FIELD_TOP - CELL, ...)`)와 에너지 이동 도달 지점은 바꾸지 않았으므로 연출 위치는 그대로다. 시뮬레이터 화면과 개발용 도구의 `다음에 나올 뿌요` 칸은 입력 위치를 알려야 하므로 어두운 칸을 유지한다.
- BUILDNO 86부터 패배 연출의 `drawDefeatAnimation()`이 `rect(fieldX - CELL, FIELD_TOP, CELL * 8, HEIGHT - FIELD_TOP)`으로 클립한 뒤 뿌요를 그린다. `startDefeatSequence()`가 `fallingPuyos`에 보드 25줄을 전부 담는데, 숨김 영역 13번째 줄 이상은 낙하 시작 위치가 베젤 위쪽 바깥(13줄은 `y = 26`, 14줄은 `y = -12`)이어서 예전에는 베젤 위로 튀어나와 보였다. 경계를 베젤 바깥 edge(`FIELD_TOP - CELL`)가 아니라 필드 안쪽 edge(`FIELD_TOP`)에 둔 것은 그 사이 한 칸이 예고뿌요를 표시하는 자리여서 뿌요가 겹치면 안 되기 때문이다. 걸친 뿌요는 그 선에서 잘려 베젤 뒤에서 미끄러져 나오는 모습이 된다. 아래쪽을 제한하지 않는 것은 같은 함수가 `FIELD_BOTTOM + distance`에 그리는 무너지는 하단 베젤이 화면 밖까지 내려가야 하기 때문이다. BUILDNO 85에서 잠시 `drawFieldBezelForeground()`의 클립과 베젤 영역을 `y = 0`까지 넓혀 헤더를 덮는 방식을 썼으나, 헤더가 화면 배경색이 아닌 베젤색으로 칠해져 패배 연출 중에만 상단 베젤이 화면 끝까지 늘어나 보였으므로 되돌렸다. 이 클립 덕분에 낙하 뿌요는 베젤의 상단 띠와 좌우 기둥에 닿지 않으므로, `drawFieldBezelForeground()`는 이제 안전망 역할만 한다. 평소 중력 낙하·조작 뿌요가 베젤 상단 띠에 겹치던 문제는 아래 BUILDNO 88 항목에서 같은 경계(`FIELD_TOP`)로 맞췄다.
- BUILDNO 88부터 `drawField()`는 평소 중력 낙하 뿌요(`gravityAnimation`)와 조작 중인 뿌요 쌍(`player.active`)을 `rect(fieldX, FIELD_TOP, CELL * COLUMNS, CELL * VISIBLE_ROWS)`로 클립해 그린다. 조작 뿌요는 `ACTIVE_PUYO_SPAWN_Y`(11.9)에서 나오므로 스폰 직후 아래 칸의 윗부분(최대 0.9칸)이, 가로로 누운 쌍이나 숨김 줄에서 떨어지는 뿌요도 마찬가지로 상단 베젤 띠(예고뿌요 줄)에 겹쳐 앞에 보였다. 이제 필드 밖 부분은 그리지 않아 베젤 뒤에서 내려오는 모습이 된다. 조작 뿌요 외곽선(`drawActiveOutline()`)도 같은 클립 안이라 좌우 기둥 쪽으로 삐져나오지 않는다. 고정 뿌요는 원래 보이는 12줄만 그리고, 예고뿌요·피버 게이지·폭발 효과·연쇄 문구·추천 위치 표시는 클립 밖에서 그대로 그린다. 회귀 테스트는 `tests/test01_enemy.spec.js`의 "조작 중인 뿌요가 필드 위 경계에 걸쳐 있어도 상단 베젤보다 뒤에 그려진다"(조작 뿌요를 11.5줄에 멈추는 테스트용 적으로 상단 베젤 픽셀 비교)이며, 클립을 넓히면 실패함을 확인했다.
- 필드 테마 컨트롤러는 `getFieldThemeController()`가 항상 `game.themeController` 하나만 돌려준다. 구경 대전의 `game.themeController`는 우측 CPU이므로 양쪽 필드가 모두 우측 적의 테마를 쓴다. 필드마다 각자 CPU의 테마를 쓰던 이전 동작으로 되돌리지 않는다.
- 피버 전용 플레이 영역과 연속 피버는 여전히 적 테마보다 `FEVER_PLAYER_BACKGROUND_COLOR`·`FEVER_BEZEL_BACKGROUND_COLOR`가 우선한다(`usesFeverFieldTheme()`). 피버 배경색은 적과 무관하게 항상 같다.

### 리플레이

- 설정의 `리플레이 사용`이 켜져 있을 때만 기록한다. 대상은 기본 룰·피버 룰·피버 룰 (시작)·피버 룰 (완화) 대전과 구경 모드의 모든 규칙, 그리고 너랑 나랑 대전이며, 연습·연속 피버·퍼즐뿌요·플레이 방법·시뮬레이터는 기록하지 않는다. 기록기는 `game.replay`에 두므로 결과 화면까지 남고 `closeResultScreen()`에서 게임과 함께 사라진다.
- 기록은 `beginReplayRecording()`으로 시작하고, `frame()`이 카운트다운이 끝난 실행 중·비일시정지 프레임에서만 `recordReplayFrame(delta)`를 호출한다. 승패가 확정되는 `updateDefeatSequence()`에서 `finishReplayRecording()`이 마지막 프레임·뿌요 지급 덱·승자를 담아 기록을 닫는다.
- 프레임은 `REPLAY_SAMPLE_INTERVAL`(초당 30장) 간격의 표본이며, 직전 표본과 달라진 항목만 담는 델타 프레임이다. 보드와 뿌요 쌍은 칸·색마다 한 글자인 문자열로 접고, 폭발·중력·연쇄 표시·싹쓸이 효과·패배 연출은 매 프레임 변하는 경과 시간 대신 시작(또는 종료) 시각만 저장한다. 재생 쪽 `refreshReplayAnimationTimers()`가 현재 재생 시각으로 경과 시간을 다시 계산하므로 30fps 표본으로도 연출이 부드럽다. 실측 평균은 프레임당 약 40~80바이트다.
- 데이터는 `{version, build, meta, deck, inputs, sounds, result, frames}` 구조다. `meta`는 규칙·구경 여부·색상 목록·양측 이름과 적 클래스 타입을, `deck`은 전체 뿌요 지급 덱과 양측 소비 위치를, `inputs`는 `[시각, 플레이어, 조작종류, 값]` 형태의 시간대별 컨트롤 조작을 담는다. 조작 종류는 `REPLAY_INPUT`(이동·회전·빠른 하강·고정)이다. `meta.together`가 참이면 양쪽 모두 사람이 조작한 너랑 나랑 대전이며, `meta.togetherWins`에 기록 시작 시점의 1P·2P 누적 승수를 담아 재생 중앙 패널에 그대로 보여 준다. `REPLAY_FORMAT_VERSION`이 다르면 재생을 거부하므로 구조를 바꿀 때 함께 올린다. 현재 버전은 3이며, 너랑 나랑 필드를 넣으면서 2에서 올렸다. 그래서 버전 2로 복사해 둔 예전 리플레이는 재생되지 않는다.
- 효과음은 `sounds`에 `[시각, 출처, 사운드 풀 속성 이름]` 형태로 담는다. 출처는 공통 풀 `'c'`, 왼쪽·오른쪽 적 풀 `0`·`1`, 어느 풀에도 없는 짧은 URL을 그대로 담는 `'u'`다. 데이터 URL이나 `REPLAY_SOUND_URL_MAX_LENGTH`(200자)를 넘는 URL은 기록하지 않는다. 대량 방해뿌요 착지음처럼 중복 재생을 막는 항목은 네 번째 값 `1`을 붙여 재생 쪽에서도 같은 경로를 쓴다.
- 기록 지점은 `playSound()`와 `playGarbageFallLotSound()` 안의 `recordReplaySound()` 한 곳이다. 현재 음량이나 Audio 지원 여부와 무관하게 남기므로 음소거 상태에서 기록한 리플레이도 소리가 난다. 새 게임 효과음을 추가할 때 이 두 함수를 거치면 별도 작업 없이 리플레이에 포함된다. 재생은 `playReplaySounds()`가 현재 재생 시각까지의 항목을 순서대로 내보내며, 참조를 되살리지 못한 항목은 조용히 건너뛴다.
- 배경음악은 별도로 기록하지 않는다. `syncBackgroundMusic()`이 재생용 `game.themeController`와 복원된 피버 활성 상태를 그대로 읽어 원래 대전과 같은 곡을 고른다. 카운트다운이 끝나는 순간에는 `startGameStartFirework()`로 시작 연출도 같이 보여 준다.
- 재생은 `startReplayPlayback()`이 실제 `PlayerState`와 `game` 객체를 만든 뒤 프레임 값을 되돌려 넣는 방식이라 평소 렌더링 경로를 그대로 쓴다. `game.replayPlayback`이 있으면 `frame()`은 일반 진행·에너지 이동·구경 자동 재시작을 실행하지 않고, 갤러리 예고뿌요 해금과 가상 컨트롤러도 막는다. 3초 카운트다운 뒤 재현하며, 프레임 해석 오류는 안내 문구를 띄우고 2초 뒤 결과 화면으로 넘어간다. 재현 중 ESC는 일시정지 오버레이를 열고, 여기서 다시하기를 고르면 같은 기록을 처음부터 다시 재현한다.
- 공격 에너지는 기록 시점에 표시 좌표와 투명도만 남기고, 재생에서는 같은 그림이 나오도록 소멸 연출 형태의 표시 전용 에너지로 되돌린다. 구경 리플레이만 `game.watch` 속성을 만들어 `getGameState()`가 모드를 올바르게 보고하게 한다.
- 리플레이 재생 결과의 `리플레이 복사`(BUILDNO 89)는 재생 중인 게임에 `game.replay` 기록기가 없으므로 `game.replayPlayback.source`를 복사한다. `openReplayPlaybackPrompt()`가 붙여넣은 원본 JSON 문자열(앞뒤 공백 제거)을 `startReplayPlayback(replay, source)`로 넘겨 보관하고, `restartReplayPlayback()`의 다시보기·일시정지 다시하기도 이 값을 이어받는다. 원본을 쓰는 이유는 `normalizeReplayData()`가 `build`·`deck`·`inputs`를 버리기 때문이다. 원본이 없으면(`source`가 null) 정리한 `playback.replay`를 직렬화한다. `hasCopyableReplay()`는 기록기 프레임이나 `replayPlayback.replay`가 있으면 true다. 회귀 테스트는 `tests/test01_replay.spec.js`의 "리플레이 재생 결과 화면은 다시보기 아래 리플레이 복사 버튼으로…"(버튼 순서, 방향키·엔터와 마우스 클릭으로 붙여넣은 JSON과 같은 문자열 복사, 복사 뒤 다시보기)이다.
- 공개 `getReplayData()`는 현재 기록 중이거나 기록을 마친 리플레이를 JSON 직렬화 가능한 객체로 반환하며, 기록 대상이 아니면 null이다.
- 별도 리플레이 재생 페이지(`replay.html`)용 `PuyoW.replay` API가 있다(BUILDNO 107~109, 아래 「리플레이 재생 페이지」 절).
- 메인 메뉴의 `리플레이 재생` 버튼(`activateTitleMenu()` → `openReplayPlayback()`)은 `replayPageAvailable`이 참이면 현재 페이지를 `replay.html`로 옮기고, 거짓이면 기존 `openReplayPlaybackPrompt()`(게임 안 JSON 입력 대화상자)를 연다(BUILDNO 111, 아래 「메인 메뉴 리플레이 재생 버튼의 리플레이 페이지 이동」 절).

## 저장소·다국어·외부 확장

- 진행도·설정·GOLD는 `localStorage`의 `puyow_store`, 카드 인스턴스 배열은 `puyow_cards`, 갤러리 잠금은 `puyow_gallery`, 리더보드 기록은 `puyow_leaderboard`(아래 「리더보드」 절), 테스트 기능 코드 배열은 `puyow_code`에 저장된다. 초기화 시 `puyow_code`를 JSON 배열로 복원하며, 파싱 실패는 오류를 기록한 뒤 빈 배열로 계속한다. 읽을 때 이전 형식을 보정하므로 새 필드는 기본값·마이그레이션을 함께 설계한다. 설정의 `useReplayFeature`는 리플레이 기능 사용 여부를, `reverseLearning`은 역방향 모델 학습 사용 여부를 저장하는 boolean이며, 기존 저장에 값이 없으면 둘 다 `false`로 보정한다. `puyow_store` 최상위의 `onnxWarningAcknowledged`는 ONNX 적 첫 대전 전 불안정 안내에서 `계속`을 고른 적이 있는지를 담는 boolean이며, 설정 화면에는 나오지 않고 값이 없거나 true가 아니면 `false`로 보정한다.
- 설정 화면의 `화면 가로방향 고정`·`리플레이 사용`·`역으로 모델 학습` 체크박스는 마우스 클릭 또는 Enter·Space·Z(해당 게임패드 확인 입력 포함)로만 토글한다. 체크박스에 포커스가 있을 때 좌우 방향키는 세 체크박스 사이의 포커스 이동에 쓰며, 양 끝에서는 더 이동하지 않는다. 위치·포커스 순번·저장 키는 `getSettingsCheckboxes()` 한 곳에서 정의하고 그리기·키보드 토글·마우스 판정이 모두 이 목록을 사용하므로, 체크박스를 더할 때는 이 함수와 `SETTINGS_UI_LAYOUT`의 가로 좌표만 추가하면 된다.
- 설정 화면 포커스 순번은 0~9 설정 행, 10 AI API 테스트, 11~13 체크박스, 14 저장, 15 취소, 16 초기화다. `getSelectableSettingsFocuses()`가 AI 입력 세 행 7·8·9를 LM Studio에서만 넣고 10도 API 테스트 실행 가능 여부에 따라 빼므로, 키보드 이동 횟수를 검증하는 테스트는 이 목록을 기준으로 계산한다.
- `registerLanguage()`, `registerOpponent()`, `registerWarningPuyo()`, `registerFeverStage()`, `registerPuzzleStage()`가 주요 확장 지점이다. 입력 검증과 중복 처리 방식은 기존 등록 함수에 맞춘다.
- 적은 `Enemy` 또는 `BundledEnemy` 계열이다. `getClassType()`의 안정성은 저장 진행도·사운드 연결에 중요하므로 기존 클래스 타입을 바꾸지 않는다.
- 적의 위치·회전 결정은 게임 루프 밖의 별도 보정 함수가 아니라 `prepareTurn()`, `chooseTarget()`, `chooseRotate()` 안에서 끝낸다. 기본 `Enemy.prepareTurn()`은 피버 연쇄 최적화와 패배 위치 회피 후보를 `preparedPlacement`로 준비하고, 기본 제공 적은 `BundledEnemy`에서 연쇄 대응·즉시 패배 보호를 추가한다. 외부 적이 이 공통 규칙을 유지하려면 세 메서드에서 `super` 구현을 호출하고, 완전히 독자적인 AI라면 세 메서드를 재정의하면 된다.
- `Andras`·`Valak`은 이관 전 키마리스의 `TwoMoveLookaheadEnemy`를 쓴다. 목표 6연쇄·2수 탐색, 긴급 상쇄 무시 기준 4와 기존 세로 회전 규칙을 보존한다.
- Worker 탐색 상태(`attackPlacement`, `pendingWorkerSearch`, `workerSearchPlayer`, `workerSearchActive`, `workerSearchDepth`, `workerSearchState`)는 최상위 `Enemy`에 있다. 외부 적은 `BundledEnemy`가 아니라 `PuyoW.Enemy`를 상속하고, `PuyoW.beginWorkerSearchTurn(enemy)`, `startWorkerLookaheadSearch(enemy, player)`, `getWorkerSearchTarget(enemy, player)`, `getWorkerSearchRotation(enemy, player)`, `isWorkerSearchPending(enemy, player)` 공용 함수로 수명주기·선택·대기 처리를 연결한다. 착지 시 엔진은 `cancelPendingWorkerSearch(enemy, player, 'contact')`로 해당 요청만 취소한다. 완료된 탐색 Worker는 최대 2개까지 전역 풀에 보관해 다음 턴 또는 구경 모드의 다른 Worker 적이 재사용한다. 취소·오류·시간 초과 중인 Worker는 즉시 종료하고 풀에 넣지 않는다.
- `Zagan`부터 `Orobas`까지는 `RealtimeLookaheadEnemy`를 쓴다. 목표 연쇄는 아래 현재 AI 배정표를 따른다. Worker advanced 3수 탐색(50ms)·실시간 반응·작은 연쇄 점등을 사용한다. `Andrealphus`·`Flauros`는 현재 이관 전 암두시아스의 5연쇄 판단을 사용한다.
- `Seere`의 피버 비활성 일반 쌓기만 오른쪽 두 열 전체 → X=3의 화면 절반(6칸) → X=0 전체 → X=1 전체 순서다. 피버 비활성 피버 룰의 별도 빌드, 피버 중 공통 연쇄 최적화, 패배 위치 보호, 빈 필드 무작위 착수는 이 규칙보다 우선한다. 일반 착수는 오른쪽 하단 세 칸의 점유 여부와 관계없이 `turnCount`에 포함한다. 공격 시뮬레이션 차례가 되면 우측 하단 세 칸이 덜 차 있어도 최적 공격 위치를 우선하며, 그 외에만 해당 세 칸이 찰 때까지 비폭발 착수를 사용한다. 공격 최적 시뮬레이션 뒤 다음 호출 간격은 매번 20~25회로 무작위 선정한다.
- `Seere`의 전승은 "날개 달린 말을 탄 미남 왕자"이며, BUILDNO 56 초상화에서는 하늘빛 머리칼·작은 왕관·날개 망토·은빛 방패를 가진 머리 하나의 인간형 왕자로 재해석한다. 필드 테마(청)는 유지한다.
- **현재 AI 배정(BUILDNO 113)**: 아래 표는 변경 전 AI를 원본으로 삼는다. 모델 미사용 적의 모든 판단·상속된 예외 처리·목표 연쇄·하강 속도를 함께 옮겼다. 이전 날짜의 작업 기록에 있는 적 이름은 그 당시 담당 적을 뜻한다.

| 변경 전 원본 AI | 현재 사용하는 적 | 주요 설정 |
| --- | --- | --- |
| 데카라비아 | 데카라비아·벨리알 | 예고쌍·싹쓸이 우선, 일반/위기 하강 비율 1.5/0.8 |
| 벨리알 | 암두시아스·키마리스 | 예고쌍·싹쓸이 우선, 하강 비율 1.25/0.75 |
| 암두시아스 | 안드레알푸스·플라우로스 | 5연쇄 목표, 피버 룰 DAMAGE 예외, 하강 비율 1.0/0.5 |
| 키마리스 | 안드라스·발라크 | 2수 탐색·목표 6연쇄·긴급 상쇄 기준 4, 기존 세로 회전 규칙 |
| 안드레알푸스 | 자간·바퓰라 | 실시간 3수 탐색·목표 5연쇄 |
| 플라우로스 | 오리아스·아미 | 실시간 3수 탐색·목표 6연쇄 |
| 안드라스 | 오세·그레모리·오로바스 | 실시간 3수 탐색·목표 7연쇄 |
| 발라크 | 무르무르 | OnnxEnemy·onnx/model01.onnx |
| 자간 | 카임 | OnnxEnemy·onnx/model02.onnx |
| 바퓰라 | 알로케스 | OnnxEnemy·onnx/model03.onnx |

- 공통 AI: `PreviewChainEnemy`는 이전 벨리알, `FiveChainEnemy`는 이전 암두시아스, `TwoMoveLookaheadEnemy`는 이전 키마리스의 판단이다. 캐릭터 표시 메서드와 등록 순서는 각 적에 남긴다. `RealtimeLookaheadEnemy`의 3수·50ms·빔 폭 5·실시간 반응·작은 연쇄 점등은 그대로다.
- 모델 미사용 빈 필드 무작위 첫 배치 대상은 데카라비아부터 오로바스까지다(`RANDOM_EMPTY_FIELD_ENEMY_TYPES`). 새 모델 미사용 적도 구경·Python 학습 상대에 포함한다.
- 출시 적은 안드로말리우스부터 알로케스까지 21종이며, 오리아스~알로케스 8종을 새로 출시했다. 발람·푸르카스만 `Enemy` 기반 AI 미구현 자리표시자(`notAvail = true`, `requiresOnnx = false`, 모델 경로 없음)다. 런타임 유무와 무관하게 회색 카드로 보이지만 선택·카드·구경·리더보드·학습에서는 제외한다.
- ONNX 경고·첫 선택 확인·런타임 필터는 `requiresOnnx`에 따라 무르무르·카임·알로케스에만 적용된다. 기존 `onnxWarningAcknowledged`와 진행도·갤러리·GOLD 배율은 유지한다.
- 바퓰라는 그리폰 날개를 가진 사자와 기술·학문 전승을 갈기 후드·옥색 깃털 날개·보안경·설계책·공구로, 오리아스는 사자·뱀·기마·점성술 전승을 연보라 갈기 후드·별 망토·쌍뱀 문양 지팡이·말발굽 문장으로 표현한다. 둘 다 기존 Canvas 인간형 스타일과 일반·위기·패배 세 표정을 공유하며, 필드 테마는 각각 옥색·회보라색이다.
- `BigBangWarningPuyo`는 단위 500000, type `big-bang`인 한 칸 크기의 빅뱅 예고뿌요다. 큰 단위부터 정렬된 `WARNING_PUYO_CLASSES`에서 헥사액트·펜터렉트·테서렉트 다음 네 번째 항목으로 공격량 분해·갤러리·카드 그림에 함께 쓰인다.
- `TesseractWarningPuyo`는 단위 3000000, type `tesseract`인 한 칸 크기의 테서렉트(4차원 정팔포체) 예고뿌요다. 단위가 빅뱅보다 크므로 `getCardDefinitions()`의 자동 규칙에 따라 가중치 1 카드로 들어가고, 갤러리 예고뿌요 목록과 메인 메뉴 떠다니는 연출에도 다른 예고뿌요와 같은 경로로 나타난다.
- `PenteractWarningPuyo`는 단위 20000000, type `penteract`인 한 칸 크기의 펜터렉트(5차원 초입방체) 예고뿌요다. 테서렉트와 마찬가지로 빅뱅보다 큰 단위라 가중치 1 카드·갤러리·메인 메뉴 연출에 자동으로 들어간다.
- `HexaactWarningPuyo`는 단위 140000000, type `hexaact`인 한 칸 크기의 헥사액트(6차원 초입방체) 예고뿌요이며 현재 가장 큰 단위다. `WARNING_PUYO_CLASSES`의 첫 항목이라 공격량을 가장 먼저 가져가고 남은 만큼을 펜터렉트 이하가 채운다. 이름 `Hexaact`는 일반적인 표기 `hexeract`가 아니라 요청받은 표기를 그대로 쓴 것이다.
- 초입방체 예고뿌요 세 종의 그림은 좌표를 손으로 적지 않고 계산한다. 공통 도우미 `createHypercubeGraph(dimensions)`가 꼭짓점 2^n개와 축 하나만 다른 모서리를, `rotateOnPlane()`이 한 평면 회전을, `normalizeProjectedShape()`가 셀 중앙 정렬·반지름 1 정규화·깊이 0~1 환산을 맡는다. 새 차원의 예고뿌요를 더할 때도 이 셋을 재사용한다.
- `createTesseractProjection()`은 4차원 꼭짓점 16개·모서리 32개를 XZ·YZ 평면으로 조금 돌린 뒤 4D→3D→2D로 두 번 원근 투영한다. 4D 쪽 원근이 안팎 두 정육면체를 만들며, 시점 거리 상수 `TESSERACT_W_DISTANCE`(안쪽 정육면체 크기)와 `TESSERACT_Z_DISTANCE`(원근 왜곡 정도)로 비율을 조정한다. 그리기는 넓고 옅은 선부터 좁고 밝은 선까지 세 번 덧그려 청록 네온 발광을 내고, 어두운 필드 위에서도 읽히도록 어두운 우주색 바탕을 먼저 깐다. 눈은 안쪽 정육면체 한가운데에 둔다.
- `createPenteractProjection()`은 5차원 꼭짓점 32개·모서리 80개를 다루는데, 5D→3D를 원근이 아니라 **선형 투영**으로 한다. 정이십면체 각(cos = 1/√5)으로 벌린 생성벡터 다섯 개를 Z축 둘레 72도 간격으로 세우고 각 축을 거기에 실어 보내면 참고 영상과 같은 둥근 마름모 이십면체 실루엣이 나온다. 이어 살짝 기울인 뒤 `PENTERACT_Z_DISTANCE`로 2D 원근 투영한다. 그리기는 푸른 유리 구슬 몸체와 테두리를 깔고 어두운 그림자선 → 푸른 유리기둥 → 흰 하이라이트 순으로 덧그리는데, **흰 하이라이트는 깊이 0.62 이상인 앞쪽 모서리에만 얹는다.** 모서리 80개에 전부 흰 선을 그으면 한 칸 크기에서 몸체가 하얗게 덮여 다른 예고뿌요와 구분되지 않기 때문이다. 같은 이유로 눈 아래에는 어두운 타원을 한 겹 깔아 격자에 묻히지 않게 한다.
- `createHexaactProjection()`은 6차원 꼭짓점 64개·모서리 192개를 펜터렉트와 같은 선형 투영으로 다루되, 생성벡터를 정이십면체의 5중 대칭축 여섯 개(`(0, ±1, ±φ)`의 순환 치환에서 대척점이 겹치지 않게 고른 것)로 놓는다. 이 여섯 축의 zonohedron이 마름모 삼십면체여서 펜터렉트의 마름모 이십면체보다 한 단계 더 촘촘한 실루엣이 된다. 펜터렉트와 달리 **기울이지 않는다.** 대칭축을 정면으로 두면 만다라 같은 규칙적인 무늬가 그대로 드러나 요청받은 "더 고차원적이고 신비로운" 느낌이 살기 때문이다. 그리기는 보랏빛 후광 → 금빛 속심의 자수정 몸체 → 그림자선·연보라 골조·금빛 하이라이트 순이며, 금빛은 깊이 0.74 이상인 앞쪽 모서리에만 얹는다.
- 세 예고뿌요의 투영 결과는 모듈 적재 때 한 번만 만들어 `TESSERACT_PROJECTION`·`PENTERACT_PROJECTION`·`HEXAACT_PROJECTION`에 담아 매 프레임 재사용한다.
- 모서리가 많은 펜터렉트·헥사액트는 `strokeHypercubeEdges()`로 그린다. 이 함수는 `getHypercubeDepthGroups()`가 모서리를 깊이 `HYPERCUBE_DEPTH_STEPS`(8)개 구간으로 한 번 묶어 둔 것을 받아 구간마다 `stroke()`를 한 번만 부른다. 모서리를 하나씩 stroke하면 헥사액트 12개를 그리는 데 프레임당 약 5ms가 들어 메인 메뉴 떠다니는 연출(최대 10개)에서 눈에 띄게 부담이 됐고, 묶어 그린 뒤로는 다른 예고뿌요와 같은 약 1.4ms가 된다. 모서리가 수백 개인 예고뿌요를 더할 때는 이 함수를 그대로 쓴다. 겹별 최소 깊이를 넘기면 앞쪽 모서리에만 하이라이트를 얹을 수 있다.
- `WarningPuyo` 확장은 양의 정수 `unitCount`, 비어 있지 않은 `type`, `draw(context, x, y, cellSize)`를 갖춰야 한다.
- 사운드는 `SoundPool`/`CommonSoundPool`/`EnemySoundPool`과 `setEnemySoundPool()`을 사용한다. 배경음은 중복 재생하지 않고 일시정지·음소거·볼륨 상태와 동기화해야 한다. 설정 화면의 배경음악·효과음 슬라이더 값은 축소된 슬라이더 오른쪽(논리 X=920)에 표시한다.
- 설정 화면 오른쪽 아래의 작은 `코드` 버튼은 키보드 포커스 순서에 포함하지 않고 마우스 클릭만 받는다. 클릭하면 `prompt('코드를 입력하세요')`를 호출하며, 취소·공란은 무시하고 값이 있으면 `trim()` 후 `addCode()`에 전달한다. `addCode()`에 `sound:` 접두사가 붙은 값을 직접 전달하면 접두사 뒤 문자열을 최대 200자로 잘라 사운드 데이터 URL로 읽어 `loadSoundDataURL(url, true)` 경로로 로드하고 `puyow_store.settings.soundDataURL`에 저장한다. 설정 화면이 열려 있으면 임시 설정값 `settingsDraft.soundDataURL`도 함께 갱신해 입력 컴포넌트에 즉시 표시한다. 이 예외 코드는 `puyow_code` 목록에는 추가하지 않는다.
- 설정 화면의 AI 제공자는 번역하지 않는 브랜드명 `LM Studio`와 (초기화 때 게임 서버의 `/apis/localmodelinfo`가 `{"available":true}`를 응답할 때만) `Local AI` 라디오 선택지다. 선택지 순서는 항상 LM Studio → Local AI다. **아무것도 선택하지 않은 상태(`aiProvider`가 빈 문자열, 상수 `NO_AI_PROVIDER`)가 정상 상태의 하나다.** 사용자가 스스로 선택을 푸는 방법은 없고, 고른 제공자를 더 이상 쓸 수 없게 됐을 때만 이 상태로 돌아온다. 라디오 행에 포커스가 있는데 선택된 항목이 없으면 표시할 포커스 테두리가 없으므로 모든 선택지에 테두리를 그린다.
- AI 제공자의 기본값은 Local AI 사용 가능 여부에 따라 달라진다. `createDefaultAiSettings()`가 Local AI를 쓸 수 있으면 Local AI와 그 고정값을, 쓸 수 없으면 미선택 상태를 돌려준다. 서버 확인이 비동기라서 `loadStore()` 시점에는 아직 알 수 없으므로, 확인이 끝난 뒤 `applyLocalAiAvailability()`가 저장값을 보정한다. 쓸 수 없는데 저장값이 `Local AI`이면 다른 제공자로 옮기지 않고 미선택으로 되돌리고, 반대로 쓸 수 있는데 미선택이면 Local AI 기본값을 채워 저장한다. `loadStore()`의 `normalizeAiProvider()`는 지원을 제거한 `OpenAI`·`Prompt API`를 포함해 현재 목록에 없는 값을 모두 미선택으로 되돌리되, 서버 확인 전이라 `Local AI`만 그대로 둔다.
- `aiApiURL`·`aiApiKey`·`aiModel` 세 행은 사용자가 직접 입력하는 LM Studio에서만 활성화·포커스되고, Local AI(고정값)와 미선택 상태에서는 셋 다 비활성화·포커스 제외한다. 미선택 상태에서는 `hasCompleteAiApiSettings()`가 `aiProvider`를 빈 값으로 보므로 AI API 테스트 버튼도 자동으로 비활성이 되고, 테스트를 통과할 방법이 없으니 적 `솔로몬`도 나타나지 않는다. Local AI를 고르는 순간 `setSettingsDraftProvider()`가 `applyLocalAiProviderSettings()`로 URL에 현재 페이지 origin(예: `http://localhost:9891`), 키에 `localhost`, 모델명에 `puyow`를 채우고, 다른 제공자로 되돌아갈 때는 값을 그대로 둔 채 활성/비활성 상태만 그 제공자의 규칙을 따른다. Local AI로 설정을 저장하면 AI API 테스트를 통과한 것으로 간주해 `unlockSolomonForSession()`을 호출하며, 다음 접속에서도 서버가 계속 사용 가능하다고 응답하면 같은 이유로 솔로몬을 다시 열어 준다.
- AI API 테스트와 솔로몬은 같은 구조화 출력 요청 경로를 공유한다. 두 제공자 모두 사용자가 입력했거나 채워진 서버 기본 URL 아래의 `/v1/chat/completions`로 요청하고, 저장된 `aiApiKey`를 `$LM_API_TOKEN`에 해당하는 Bearer 토큰으로 보내며, `response_format.json_schema`와 `choices[0].message.content` 형식을 사용한다. Local AI는 `pythonserver.py`가 LM Studio API를 흉내내기 때문에 LM Studio와 완전히 같은 요청 경로를 쓴다. 설정 화면의 AI API 테스트가 응답을 받으면 브라우저 콘솔에 제공자·모델·성공 여부·스키마 검사 여부·원문 응답·파싱 결과를 `console.log`로 기록하며, 요청 오류도 성공 여부와 오류 내용을 함께 기록한다.

### 제거한 AI 제공자(OpenAI·Prompt API) 재도입 참고

BUILDNO 26에서 `OpenAI`와 `Prompt API` 제공자를 **임시로** 제거했다. 게임 규칙이나 솔로몬의 판단 로직이 문제가 아니라, 상용 LLM은 한 수를 고르는 데 너무 오래 걸려 실제로 플레이할 수 없었기 때문이다. 언젠가 다시 넣을 수 있으므로 지운 구현을 아래에 남긴다. 제거 직전 상태는 BUILDNO 25(커밋 `28ddfde`)의 `src/js/puyow.js`와 당시의 `tests/test01.spec.js`(지금은 아래 「테스트 파일 구성」대로 나뉘었다)에 그대로 있으니, 되살릴 때는 이 문서로 범위를 먼저 파악한 뒤 그 커밋에서 실제 코드를 확인하는 편이 빠르다.

**되살릴 때 먼저 알아야 할 변경점.** 제거와 함께 `aiProvider`에 "아무것도 선택하지 않은 상태"(빈 문자열)가 생겼고, 남은 두 제공자가 모두 `/v1/chat/completions`를 쓰기 때문에 `aiApiURL`·`aiApiKey`·`aiModel` 세 행은 "LM Studio일 때만 활성"이라는 하나의 조건으로 단순해졌다. OpenAI는 URL을 입력받지 않고 Prompt API는 셋 다 입력받지 않으므로, 되살리려면 이 단순화한 조건을 다시 제공자별로 나눠야 한다. 대상은 `getSelectableSettingsFocuses()`, `getSettingsRows()`의 `disabled`, `getSettingsTextField()`, `hasCompleteAiApiSettings()`의 `requiredKeys` 네 곳이다.

**제거한 상수.**

```js
/** 항상 선택할 수 있는 AI 서비스 제공자 목록이다. 브랜드명은 번역하지 않는다. */
const AI_SERVICE_PROVIDERS = ['OpenAI', 'LM Studio'];
/** 브라우저 내장 AI 기반의 선택적 제공자 이름이다. */
const PROMPT_API_PROVIDER = 'Prompt API';
/** Prompt API에서 솔로몬이 사용하는 구조화 JSON 텍스트 출력 옵션이다. */
const PROMPT_API_LANGUAGE_OPTIONS = {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }]
};
/** 브라우저에서 직접 호출할 OpenAI Responses API 주소다. */
const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
```

**Prompt API 지원 확인과 모델 준비.** `let promptApiSupported = false;` 상태를 두고 `initialize()`가 `refreshOnnxRuntimeAvailability()`보다 먼저 `promptApiSupported = checkPromptApiSupport();`를, 그 뒤에 `startPromptApiDownloadIfNeeded();`를 호출했다. 두 함수는 초기화 흐름을 막지 않도록 결과를 기다리지 않는다.

```js
function checkPromptApiSupport() {
    const languageModel = typeof globalThis !== 'undefined' ? globalThis.LanguageModel : undefined;
    return typeof languageModel !== 'undefined' && typeof languageModel.create === 'function';
}

function startPromptApiDownloadIfNeeded() {
    const languageModel = typeof globalThis !== 'undefined' ? globalThis.LanguageModel : undefined;
    if (!languageModel || typeof languageModel.availability !== 'function' || typeof languageModel.create !== 'function') return;
    Promise.resolve().then(() => languageModel.availability(PROMPT_API_LANGUAGE_OPTIONS)).then((availability) => {
        if (availability !== 'downloading') return;
        return languageModel.create(PROMPT_API_LANGUAGE_OPTIONS);
    }).catch((error) => {
        console.info('Puyo W Prompt API 모델 준비를 시작하지 못했습니다.', error);
    });
}
```

**선택지 목록과 판정.** 선택지 순서는 OpenAI → LM Studio → Prompt API → Local AI였다.

```js
function getAiServiceProviders() {
    return [...AI_SERVICE_PROVIDERS, ...(promptApiSupported ? [PROMPT_API_PROVIDER] : []), ...(localAiAvailable ? [LOCAL_AI_PROVIDER] : [])];
}

function isPromptApiProvider(settings) {
    return settings?.aiProvider === PROMPT_API_PROVIDER;
}
```

**요청 경로.** OpenAI는 Responses API라 응답 본문 구조가 Chat Completions와 달라 전용 추출 함수가 필요했다. Prompt API는 HTTP 요청이 아니라 브라우저 세션이므로 `requestStructuredAiOutput()` 맨 앞에서 갈라졌고, 세션은 한 요청에만 쓰고 항상 `destroy()`해 이전 턴의 문맥이 이어지지 않게 했다.

```js
function getResponsesOutputText(response) {
    if (typeof response?.output_text === 'string') return response.output_text;
    for (const outputItem of response?.output || []) {
        for (const content of outputItem?.content || []) {
            if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
        }
    }
    return null;
}

// createStructuredAiRequest()에서 LM Studio·Local AI가 아닐 때 사용한 OpenAI 분기다.
return {
    url: convertURL(OPENAI_RESPONSES_API_URL),
    options: {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: settings.aiModel,
            reasoning: { effort: 'low' },
            input: [{ role: 'user', content: prompt }],
            text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
            max_output_tokens: maxTokens
        })
    },
    readOutputText: getResponsesOutputText
};

// requestStructuredAiOutput()의 첫 분기다.
if (isPromptApiProvider(settings)) {
    if (!promptApiSupported) throw new Error('Prompt API를 지원하지 않는 브라우저입니다.');
    const session = await globalThis.LanguageModel.create({ ...PROMPT_API_LANGUAGE_OPTIONS, signal });
    try {
        return await session.prompt(prompt, { responseConstraint: schema, signal });
    } finally {
        if (typeof session.destroy === 'function') session.destroy();
    }
}
```

**제공자별 입력 조건.** Prompt API는 URL·키·모델명을 쓰지 않으므로 테스트 실행 조건과 저장 여부 판정도 달랐다.

```js
function hasCompleteAiApiSettings(settings) {
    if (isPromptApiProvider(settings)) return promptApiSupported;
    const requiredKeys = ['aiProvider', 'aiApiKey', 'aiModel', ...(isLmStudioProvider(settings) || isLocalAiProvider(settings) ? ['aiApiURL'] : [])];
    return Boolean(settings && requiredKeys.every((key) => typeof settings[key] === 'string' && settings[key].trim()));
}

function hasSavedAiApiSettings() {
    if (isPromptApiProvider(settingsDraft)) return Boolean(store.settings && settingsDraft.aiProvider === store.settings.aiProvider);
    /* 이하 기존 비교와 동일 */
}

function getSelectableSettingsFocuses() {
    const aiSettingFocuses = isPromptApiProvider(settingsDraft) || isLocalAiProvider(settingsDraft) ? [] : [
        ...(isLmStudioProvider(settingsDraft) ? [7] : []), 8, 9
    ];
    return [0, 1, 2, 3, 4, 5, 6, ...aiSettingFocuses, ...(canRunAiApiTest() ? [10] : []), 11, 12, 13, 14, 15, 16];
}

// getSettingsRows()의 7·8·9행 조건과 getSettingsTextField()의 8·9 조건도 같은 모양이었다.
// 7행: disabled: !isLmStudioProvider(settingsDraft)
// 8·9행: disabled: isPromptApiProvider(settingsDraft) || isLocalAiProvider(settingsDraft)
```

**저장값 이관.** 그때는 미선택 상태가 없어서 쓸 수 없게 된 제공자를 항상 `LM Studio`로 옮겼다. 지금은 `normalizeAiProvider()`가 미선택으로 되돌리고 `applyLocalAiAvailability()`도 같은 규칙을 쓰므로, 되살릴 때 이 이관 규칙을 예전으로 되돌리지 말고 현재 규칙을 그대로 유지해야 한다.

```js
// loadStore()의 예전 aiProvider 보정이다.
aiProvider: settings.aiProvider === PROMPT_API_PROVIDER && !promptApiSupported
    ? 'LM Studio'
    : settings.aiProvider === LOCAL_AI_PROVIDER || getAiServiceProviders().includes(settings.aiProvider) ? settings.aiProvider : initial.settings.aiProvider,
```

**함께 지운 회귀 테스트.** 당시의 `tests/test01.spec.js`에서 아래 네 개를 지웠고, 나머지 AI 테스트는 OpenAI 대신 LM Studio 설정을 쓰도록 옮겼다. Prompt API 테스트는 `page.addInitScript()`로 `window.LanguageModel`을 가짜로 심어 `create`·`prompt`·`destroy` 호출을 기록하는 방식이었다.

- `설정의 AI 서비스 제공자는 OpenAI와 LM Studio를 라디오로 표시하고 기존 Google 값은 정규화한다`
- `Prompt API를 지원하지 않으면 선택지를 숨기고 저장된 Prompt API 설정을 LM Studio로 이관한다`
- `Prompt API는 API 테스트와 솔로몬 배치에서 JSON Schema 제약 prompt를 사용한다`
- `Prompt API 모델이 다운로드 중이면 초기화를 기다리지 않고 create를 호출한다`

`src/notice/notice_ko.txt`·`notice_en.txt`의 "OpenAI 등 상용 LLM은 느리다"는 안내 문구도 제공자 이름을 뺀 일반 문장으로 바꿨다.

## 개발용 도구 (`tools.html`)

피버 패턴과 퍼즐뿌요 스테이지를 만들기 위한 개발자 전용 페이지다. 게임 페이지(`puyow.html`)와는 별개이며 배포 게임 동작에 영향을 주지 않는다.

- 화면·검증·스크립트 생성 등 도구의 핵심 코드는 모두 `src/js/puyow_tools.js`에 둔다. 필요한 CSS도 이 파일이 초기화할 때 `style.puyow_tools_style` 태그로 문서에 넣는다. `tools.html`은 `PuyoWTools.initialize(divTarget)` 한 줄만 호출한다.
- 뿌요 배치 편집과 테스트 실행은 새로 만들지 않고 `puyow.js`의 기존 코드를 재사용한다. 그 연결 지점이 `PuyoW.tools` API다: `openEditor({kind, stageData, suppliedNextPuyos})`, `closeEditor()`, `getEditorData()`, `setEditorData(data)`, `startFeverTest(stage, onFinish)`, `startPuzzleTest(stage, onFinish)`, `stopTest()`, `isTesting()`, `getMaxNextTurns()`, `getColors()`. `onFinish(result)`는 테스트 결과 객체를 받는다. 피버는 `{kind:'fever', combo}`, 퍼즐은 `{kind:'puzzle', cleared:true, turn, combo}`이며, 목표를 이루지 못하고 끝나면 `null`이다.
- 화면 구성은 최상단 툴바(항상 표시, 왼쪽부터 `퍼즐뿌요 개발`·`피버 패턴 개발`, 오른쪽 끝에 `설정`), 좌측 사이드바와 우측 영역이 4 : 6, 우측은 캔버스 영역과 읽기 전용 스크립트 출력 영역이 7 : 3이다. 대상을 고르기 전에는 툴바 아래가 비어 있고, 게임 캔버스도 그때 처음 `PuyoW.initialize()`로 만든다.
- 편집 모드는 시뮬레이터 그리기 모드 그 자체다. `simulator.tools`가 있으면 중앙 영역에 `다음에 나올 뿌요` 편집 칸(`drawToolsNextArea()`, `getToolsNextCellBounds()`)이 그려지고, 피버는 1턴·퍼즐은 최대 `TOOLS_MAX_NEXT_TURNS`(6)턴을 받는다. 배열 0번이 아래쪽 축 뿌요이므로 화면에서도 아래 칸이 0번이다. 이 칸에는 색 뿌요만 넣을 수 있다.
- 플레이 영역은 클릭과 드래그로 칠한다. 드래그는 `handleToolsPointerDown()`·`handleToolsPointerMove()`가 처리하며, 도구 편집 모드가 아니면 곧바로 false를 돌려 기존 가상 컨트롤러 경로를 그대로 둔다.
- 피버 테스트는 `startGame(false, true)`로 연속 피버를 시작한 뒤 `game.toolsTest`를 붙인다. `prepareFeverTurn()`은 `game.toolsTest.pendingStage`가 있으면 그 패턴을 색 변환 없이(`createToolsIdentityColorMap()`) 그대로 올리고, 그 다음 번 호출부터는 실제 게임과 같은 방식으로 패턴을 고른 뒤 `finishAfterStage`를 세워 배치가 끝나면 편집 모드로 돌아간다. 남은 시간은 `CONTINUOUS_FEVER_INITIAL_TIME`(60초), 목표 연쇄와 지급 뿌요는 편집 중인 값을 그대로 쓴다.
- 퍼즐뿌요 테스트는 `startPuzzleStageGame(stage, -1, 0)`으로 등록되지 않은 스테이지를 그대로 실행한다. `stageIndex`가 -1이거나 `game.toolsTest`가 있으면 `finishPuzzleStage()`가 클리어 기록·별·GOLD를 저장하지 않는다.
- 테스트 종료는 `updateToolsTest()`가 맡는다. 결과 화면에 들어가면 `TOOLS_TEST_FINISH_DELAY`(1.5초) 뒤 `returnFromToolsTest()`로 편집 모드에 복귀하며, 일시정지의 `종료`와 결과 화면 닫기도 메인 메뉴 대신 편집 모드로 간다.
- 테스트 결과는 `game.toolsTest.result`에 쌓인다. 피버는 `resolveExplosions()`가 첫 연쇄를 끝낼 때 그 연쇄 수를, 퍼즐은 `finishPuzzleStage()`가 달성 턴과 연쇄 수를 한 번만 적는다. `returnFromToolsTest()`가 `game`을 비우기 전에 이 값을 챙겨 종료 콜백으로 넘긴다.
- `puyow.js`의 도구 관련 코드는 모두 `simulator.tools` 또는 `game.toolsTest` 조건 안에 있다. 게임 페이지 동작을 바꾸지 않는 것이 이 API의 계약이므로, 도구 기능을 넓힐 때도 이 가드를 벗어나지 않는다.
- 스크립트 생성은 `TODO.md`의 예시와 같은 형식(`new FeverStageState(...)` 5인자, `new PuzzlePuyoStage({...})` 6항목)을 출력한다. 불러오기는 붙여 넣은 스크립트를 게임의 실제 클래스에 그대로 넘겨 만든다.
- 사이드바 첫 단락 `불러오기`에는 버튼이 둘 있다. `스크립트`는 스크립트를 붙여 넣는 팝업(`.puyow-tools-dialog.is-load`)을, `기존 패턴`은 `puyow.js`에 탑재된 패턴을 고르는 팝업(`.puyow-tools-dialog.is-pattern`)을 연다. 두 팝업 모두 취소하면 편집 내용을 그대로 둔다.
- `기존 패턴` 목록은 열 때마다 `fillPatternList()`가 지금 개발 중인 대상에 맞게 다시 만든다. 퍼즐뿌요는 `PuyoW.PUZZLE_STAGES`를 그대로 읽고, 피버는 `FEVER_STAGES`를 내보내지 않으므로 직렬화 사본을 주는 `getFeverStageDefinitions()`로 `FeverStageState`를 다시 만들어 쓴다. 이 두 API가 이미 있어 `puyow.js`는 건드리지 않았다. 고른 패턴은 스크립트 불러오기와 같은 `applyLoadedStage()`를 거치고, 편집 화면에 넣는 값은 `setEditorData()`가 복사하므로 게임의 원본 스테이지는 바뀌지 않는다.
- 목록 한 줄의 설명(`describeExistingPattern()`)은 사이드바 항목 이름(`목표 연쇄 수`·`난이도`·`사용할 색상 목록`·`목표 타입`·`목표 타입 값`·`목표 턴수`·`힌트`)을 그대로 써서 번역을 함께 맞춘다. 힌트는 게임 데이터에 적힌 원문 그대로 보여 준다. 불러온 뒤에도 검증 지문은 새로 만들지 않으므로 스크립트를 만들려면 테스트를 다시 해야 한다.

### 개발용 도구의 검증 규칙

- **테스트를 누를 때** 값을 모두 검사하며, 하나라도 걸리면 테스트를 시작하지 않는다. 피버는 목표 연쇄 4~12, 난이도 1 이상, 사용 색상 3~5개에 중복 없음, 배치·지급 색이 사용 색상 목록 안(방해뿌요 제외), 지급 뿌요 두 칸이 모두 색 뿌요여야 한다. 퍼즐은 목표 턴수 1~6, 목표 타입 값 1 이상(`clear` 제외), `다음에 나올 뿌요`가 목표 턴수만큼 빈 턴 없이 채워져 있어야 한다. 목표 턴수보다 많이 채운 것은 허용한다.
- **스크립트 생성은 테스트에 성공한 뒤에만** 된다. 성공 판정은 `judgeTestResult()`가 하며, 피버는 처음 지급받은 쌍(1턴)으로 **정확히** 목표 연쇄를 내야 하고 더 많이 터져도 실패다. 퍼즐은 목표 턴수 안에 목표를 이뤄야 하고, 목표 타입이 `combo`면 연쇄 수가 목표와 **정확히** 같아야 한다. 목표 연쇄 수로 패턴을 분류해 쓰기 때문에 초과는 그 목표의 패턴이 아니라고 본다.
- 테스트에 성공하면 그 시점의 내용 지문(`buildVerificationSnapshot()`)을 남긴다. 지문에는 플레이 영역, `다음에 나올 뿌요`, 그리고 달성 여부에 영향을 주는 입력값(피버는 목표 연쇄, 퍼즐은 목표 타입·값·턴수)이 들어간다. 난이도와 힌트는 달성 가능성과 무관해 넣지 않는다. 생성 직전에 지문이 다르면 다시 테스트하도록 막는다.

### 개발용 도구의 설정 창

- 툴바 오른쪽 끝 `설정` 버튼이 레이어 팝업(`.puyow-tools-dialog.is-settings`)을 연다. 값은 `저장`을 눌러야 적용·저장되고 `취소`는 아무것도 바꾸지 않는다.
- 저장 위치는 `localStorage`의 `puyow_tools_settings` 키이며 JSON 한 덩어리다. 게임 본체의 `puyow_store`와 이름이 겹치지 않게 따로 둔다. 읽을 때 알 수 없는 항목은 `toolsSettingsRaw`에 담아 두었다가 저장할 때 그대로 다시 써서 지우지 않는다.
- 지금 있는 항목은 다크 모드 사용 여부 하나이며 기본값은 `true`다. 끄면 `document.body`에 `puyow-tools-light` 클래스가 붙어 CSS 변수(`--tools-*`)가 밝은 톤 값으로 바뀐다. 게임 테스트 영역은 `puyow.js`가 직접 그리므로 `--tools-canvas-bg`만 밝은 톤에서도 어두운 값을 유지한다.
- 도구 화면의 색은 전부 `--tools-*` 변수를 거친다. 새 UI를 넣을 때도 색 리터럴을 직접 쓰지 않는다. 밝은 톤에서 `body.webpuyo`의 어두운 배경을 덮어야 하는데, 게임과 함께 쓰는 `puyow.css`는 건드리지 않고 도구가 나중에 넣는 `style.puyow_tools_style`에서 덮는다.

### 개발용 도구의 자동생성

- 사이드바 `조작` 영역의 `자동생성` 버튼이 플레이 영역을 목표에 맞게 채운다. 이미 놓인 뿌요와 `다음에 나올 뿌요`, 사이드바 값은 그대로 두고 필요한 만큼만 더한다. 시작 전에 테스트와 같은 검증을 거치되, 플레이 영역이 비어 있는 것은 허용한다(`collectFeverStage({requirePuyos:false})`).
- 진행 중에는 화면 전체를 덮는 음영(`.puyow-tools-overlay`)과 동그랗게 도는 진행 표시(`.puyow-tools-spinner`, 2026-09-18부터. 그 전에는 흐르는 가로 막대), `중단` 버튼이 나온다. 중단은 `cancelAutoGenerate()` → `worker.terminate()`이며, 완료·중단 모두 음영을 걷는다. **결과는 성공했을 때만 `acceptAutoGenerateResult()`가 편집 화면에 반영하므로, 중단하면 플레이 영역과 입력값이 자동생성을 시작하기 전 그대로다.** 화면의 `중단` 버튼과 WebMCP `tools_stop_auto_generate`가 같은 `cancelAutoGenerate()`를 쓴다.
- **제한 시간은 없다**(2026-09-18, 피버·퍼즐 모두). 예전 `AUTO_GENERATE_TIME_LIMIT`(2분)을 없앴고, `start` 메시지에 `timeLimit`을 싣지 않으면 Worker의 마감이 `Infinity`다(값을 주면 그 시간 뒤 `failed`를 보내는 경로는 남아 있다). Worker의 `runJob()`은 찾을 때까지 쉬지 않고 돌지만 `terminate()`는 루프 도중에도 Worker를 끝낸다. 답이 없는 조건이면 사용자가 중단할 때까지 계속 찾는다.
- 탐색은 `autoGenerateWorkerBootstrap()`을 문자열로 만들어 Blob URL로 띄운 Worker가 맡는다. 별도 파일은 두지 않는다. `puyow.js`의 연쇄 코드는 IIFE 안에 있어 Worker로 넘길 수 없으므로 Worker가 연쇄 판정을 다시 구현하지만, **그것은 후보를 고르기 위한 근사일 뿐이고 최종 확인은 본래 쓰레드가 게임 코드로 다시 한다**. 두 판정이 어긋나도 잘못된 배치가 반영되지 않는 이유가 이 역할 분담이다.
- 알고리즘은 목표에 한 걸음씩 다가가는 깊이 우선 탐색이다. 한 걸음은 같은 색 뿌요를 1~4개, 한 열 또는 이웃한 두 열에 쌓는 것이며, 쌍을 놓기 전에 스스로 터지는 배치는 버린다. 막히면 직전 선택을 바꿔 되돌아간다. 더하는 뿌요가 적은 후보를 먼저 보므로 결과는 "찾은 것 중 가장 적은" 배치이며, 이론적 최소를 보장하지는 않는다.
- 본래 쓰레드의 확인은 피버가 `findExplosionsOnBoard()`(스스로 터지지 않는지)와 `findBestPreviewResult()`(정확히 목표 연쇄인지)를, 퍼즐이 `findExplosionGroupsOnBoard()`·`collapseBoard()`로 단계를 직접 밟으며 목표 타입별 값을 센다(`resolveBoardWithGameCode()`, `isPuzzleGoalReachedWithGameCode()`). 게임이 단계별 폭발 수·색 수를 따로 내보내지 않기 때문이다.
- 알려진 한계로 3색만 쓰는 11~12연쇄와 목표 타입 `color`의 4·5색은 잘 찾지 못한다(이제 제한 시간이 없으므로 중단할 때까지 찾는다).

#### 퍼즐 자동생성: 목표 턴수째에만 달성 (2026-09-18, `TODO.md`)

**퍼즐 자동생성은 `다음에 나올 뿌요`의 목표 턴수(T)번째 쌍으로 목표를 이루고, 그 전(1~T−1턴)에는 어떻게 두어도 목표를 이룰 수 없는 배치를 만든다.** 이미 만들어진 퍼즐을 플레이할 때는 게임 규칙대로 더 일찍 풀어도 되지만, 개발 도구의 자동생성 결과는 목표 턴수 전에 풀리면 안 된다는 사용자 결정이다. 그 전에는 첫 쌍만 보고 첫 턴 해법을 찾았다. T = 1이면 예전과 같다.

- **목표 타입 `attack`은 자동생성하지 않는다.** `startPuzzleAutoGenerate()`가 Worker를 띄우지 않고 `Auto generation is not available when the win condition is attack.`(한국어 `목표 타입이 attack (공격량)이면 자동생성을 사용할 수 없습니다.`)만 상태 줄에 낸다. 공격량 계산을 Worker가 똑같이 할 수 없어서다. 목표 타입 설명 문구는 바꾸지 않았다(사용자 결정). 이어서 사용자 요청으로 **목표 타입이 attack이면 자동생성 버튼 자체를 비활성화**한다. `refreshWinConditionValueState()`가 목표 타입을 바꿀 때마다(선택 변경·스크립트/기존 패턴 불러오기·WebMCP `tools_set_options`·테스트 종료 뒤) `autoGenerateButton.disabled = testing || attack`으로 맞추며, 퍼즐 사이드바는 조작 버튼을 만든 뒤 이 함수를 부른다. 위 안내 문구는 버튼을 거치지 않는 WebMCP `tools_auto_generate` 경로를 위해 그대로 둔다. 회귀 테스트는 "퍼즐뿌요 자동생성 버튼은 목표 타입이 attack이면 비활성화되고…"다. 예전의 attack 전용 처리(목표 연쇄를 2부터 한 단계씩 올려 보기)는 지웠다.
- **정답 수순**: 1~T−1턴은 아무것도 터뜨리지 않고 쌓기만 한다(사용자 결정). Worker의 `buildOps()`가 탐색 한 판마다 `makePlan()`으로 무작위 쌓기 계획(`{x, rotation}` 목록)을 세우고, `evaluatePuzzle()`이 후보 보드에 그 계획을 `applyPlan()`으로 차례로 떨어뜨린 뒤(도중에 터지거나 패배 칸을 막거나 놓을 수 없으면 후보 제외) T번째 쌍의 모든 자리로 목표 값을 센다. 뿌요 묶음은 예전처럼 초기 보드에 쌓으므로 계획한 쌍은 그 위에 얹힌다. 성장 탐색 `search()`·`nextSteps()`는 피버와 같고, 평가 방법만 `ops`(`isStable`·`evaluate`·`accept`)로 갈라 끼운다.
- **조기 달성 검사**: 목표를 이룬 보드도 `ops.accept` = `!canReachEarly()`를 통과해야 한다. 1~T−1번째 쌍을 놓을 수 있는 모든 자리를 도중에 터뜨리는 수순까지 전부 따지며, 게임처럼 연쇄 목표는 **목표 이상**이면 그 턴에 클리어로 본다(`reachedInGame()`). 패배 칸(2, 11)이 막히는 수순은 게임이 목표보다 패배를 먼저 판정하므로 더 보지 않는다. 턴마다 경우의 수가 최대 22배라, 놓은 두 칸 주변만 세는 `popsFromCells()`로 터지지 않는 자리를 빠르게 거르고 `턴:보드` 지문으로 같은 상태를 한 번만 본다. 마지막 턴(T번째)의 목표는 도구 테스트처럼 연쇄 목표가 **정확히** 같아야 한다.
- **퍼즐 경로의 Worker 판정은 근사가 아니라 게임 규칙 그대로다.** 조기 달성은 모든 경우를 Worker만 따지므로 틀리면 안 된다. `exactStep()`·`exactResolve()`(보이는 12줄에서만 폭발, 터진 칸에 닿은 방해뿌요는 모든 줄에서 제거, 패배 칸 판정), `exactPlace()`·`exactPlacements()`(조작 뿌요가 (x, 11)에 나타나므로 시작 두 칸이 비어야 함 — 안정 보드에서 열 높이 ≤ 그 줄, 착지 뒤 떠 있는 칸은 중력) 모두 `puyow.js`의 `findExplosionGroupsOnBoard()`·`getExplosionResolution()`·`collapseBoard()`·`findLandingPlacement()`·`isDefeatBoard()`와 같아야 한다. 규칙 값은 `puyow_tools.js`의 `GAME_RULES`(`visibleRows` 12, `spawnRow` 11, `defeatColumn` 2)와 `COLORS`로 Worker에 넘긴다. **게임의 이 규칙을 바꾸면 Worker도 함께 고친다.** 피버 경로는 여전히 13줄 근사 판정(`resolveDetail()`·`placePair()`)을 쓰며 이번에 바꾸지 않았다.
- **본래 쓰레드 확인**(`verifyGeneratedPuzzleBoard(puyos, plan, stage)`): Worker가 `found`에 실어 보낸 `plan`을 게임 코드(`findLandingPlacement()`·`activeCells()`·`collapseBoard()`)로 다시 두어 쌓는 동안 터지거나 패배 칸이 막히지 않는지, 그 뒤 T번째 쌍으로 목표(연쇄는 정확히)를 이루는지 본다. T가 `PUZZLE_MAIN_EARLY_CHECK_MAX_TURNS`(3) 이하면 조기 달성 불가도 게임 코드로 다시 확인하고(`canReachPuzzleGoalEarlyWithGameCode()`), 그보다 크면 경우의 수 때문에 화면이 멈출 수 있어 Worker의 전수 검사를 믿는다.
- `overshoot`(놓인 뿌요만으로 목표보다 많이 터짐) 검사는 쌍이 하나일 때(피버, T = 1 퍼즐)만 한다.
- 측정(Node, 빈 보드): T = 2~4는 연쇄 2~4·싹쓸이·multiple 6·color 2 모두 0.1~0.2초, T = 6은 연쇄 3·color 2가 약 7초였다. T = 6의 조기 달성 검사 한 번은 반쯤 찬 보드에서 약 6.6초다.
- 회귀 테스트(`tests/test02_tools.spec.js`): 목표 턴수 2(연쇄 2)·3(color 2) 결과를 도구 코드를 거치지 않고 게임 API만으로 다시 따져 "마지막 턴에만 달성·그 전 불가"를 확인, attack 안내와 배치 유지, 동그란 진행 표시와 중단 후 배치 복원, 그리고 **Worker 본체를 Node에서 그대로 실행해 160개 무작위 보드의 착지·연쇄·단계별 폭발 수·색 수·싹쓸이·패배와 60개 보드의 2턴 조기 달성 판정을 게임 코드와 비교**한다(Worker의 보이는 줄 수를 13으로 바꾸면 실패함을 확인했다). 이 비교 테스트는 `autoGenerateWorkerBootstrap()`을 소스에서 잘라 쓰므로, 그 함수 바로 뒤 주석(`자동생성 Worker를 만든다.`)을 바꾸면 테스트의 자르는 위치도 고친다.
- **자동생성은 누를 때마다 다른 결과를 내려고 한다.** 사용자가 마음에 들 때까지 눌러 보고 이어서 손으로 고칠 수 있게 하려는 것이다. 두 가지가 이 성질을 만든다. 첫째, 탐색 난수의 씨앗을 본래 쓰레드가 `createAutoGenerateSeed()`(게임의 `randomFloat()`를 거친다)로 매번 새로 만들어 `start` 메시지에 실어 보낸다. 예전에는 Worker가 씨앗 0에서 시작해 같은 조건이면 늘 같은 배치가 나왔다. Worker의 `nextSteps()`는 후보를 섞은 뒤 안정 정렬로 이득·더하는 뿌요 수만 비교하므로, 같은 값끼리의 순서가 이 씨앗에 따라 달라진다. 둘째, 찾은 배치가 직전 결과(`autoGenerateLastSignature`)와 완전히 같으면 `retryAutoGenerateForVariety()`가 `reject`를 보내 다른 경우를 더 찾게 한다. 해가 하나뿐인 조건에서 멈추지 않도록 `AUTO_GENERATE_VARIETY_RETRIES`(8)회까지만 다시 찾고 그 뒤에는 같은 결과라도 받아들인다. 개발 대상을 바꾸면 이 지문은 지운다.
- 자동생성 결과도 그대로 쓸 수 있는 완성품이 아니라 손으로 다듬을 초안이다. 배치가 바뀌면 검증 지문도 달라지므로 스크립트를 만들려면 다시 테스트해야 한다.

### 개발용 도구의 WebMCP

- `PuyoWTools.initialize()`에서 `registerMcpTools()`가 `document.modelContext`에 도구를 등록한다. 미지원 브라우저에서는 아무 일도 하지 않으며, `destroy()`가 `AbortController`로 한 번에 해제한다.
- 이름은 모두 `tools_` 접두어를 쓴다. 편집 화면에 들어가면 `puyow.js`도 같은 문서에 `manual`·`now_screen`·`screen_layout`·`now_game_status`·`point_recommend`·`show_message`를 등록하므로 이름이 겹치면 안 된다. 게임 도구는 `PuyoW.initialize()` 때 등록되므로 개발 대상을 고르기 전에는 도구 페이지 것 12개만 있다.
- 도구 목록은 `tools_manual`, `tools_status`, `tools_select_mode`, `tools_load_script`, `tools_set_options`, `tools_place_puyos`, `tools_set_next_puyos`, `tools_auto_generate`, `tools_stop_auto_generate`, `tools_run_test`, `tools_stop_test`, `tools_generate_script`다.
- `tools_auto_generate`는 기본적으로 결과가 나올 때까지 기다린다. `finishAutoGenerate()`가 결과 문구를 화면에 적으면서 `autoGenerateWaiters`에 담긴 완료 함수를 모두 깨우는 구조다. 제한 시간이 없어졌으므로(2026-09-18) `{ wait: false }`를 주면 시작하자마자 돌아오고, `tools_status`의 `autoGenerating`으로 진행 여부를 본다. attack 안내·검증 실패처럼 곧바로 끝난 경우는 `wait: false`여도 결과 문구를 돌려준다.
- `tools_stop_auto_generate`(2026-09-18)는 진행 중인 자동생성을 화면의 `중단`과 같은 `cancelAutoGenerate()`로 취소하고 `자동생성을 중단했습니다.`를 돌려준다. 기다리던 `tools_auto_generate` 호출도 같은 문구로 끝난다. 진행 중이 아니면 `Auto generation is not running.`이다.
- **`tools_run_test`는 테스트를 시작만 하고 바로 돌아온다.** 조작을 넣는 도구가 없어 AI가 대신 플레이할 수 없기 때문이다. 사람이 키보드로 플레이해야 하며 결과는 `tools_status`로 확인한다. 그래서 AI 혼자서는 스크립트 생성까지 갈 수 없고, 배치를 준비하는 데까지가 이 도구들의 몫이다.
- 피버 패턴 화면의 `사용할 색상 목록` 기본값은 `DEFAULT_FEVER_USING_COLORS`(빨강·초록·파랑 3색)다.

### 개발용 도구의 다국어

- 도구 페이지는 **한국어·영어·일본어·중국어·독일어·프랑스어**를 지원하고 **기본 언어는 영어**다. 그래서 게임 본체와 달리 영어 원문을 번역 키로 쓰고, 나머지 다섯 언어의 번역을 `puyow_tools.js`의 `TOOLS_STRINGS`(`ko`·`ja`·`zh`·`de`·`fr`)에 둔다. 게임 본체(`puyow.js`)의 `stringTable`은 한국어가 키이므로 두 표를 섞지 않는다. 문구를 새로 넣을 때는 다섯 표에 모두 넣는다.
- 도구 화면 문구는 `puyow_tools.js`가 자체적으로 가진 `translate(text, ...values)`를 거친다. `%1`, `%2` 치환 방식은 게임 쪽과 같다. 번역이 없으면 영어 원문을 그대로 쓴다.
- 언어 선택은 `detectToolsLanguage()`가 `navigator.language`의 앞 두 글자를 보고 `TOOLS_STRINGS`에 있으면 그 언어를, 없으면 `en`을 돌려준다. `puyow.js`가 게임 문구의 언어를 고르는 방식과 같게 맞춘 것이며, 두 판정이 어긋나면 사이드바와 편집 화면 canvas의 언어가 서로 달라진다. 결과는 `toolsLanguage`에 담기며 도구 초기화 때 한 번 정한다.
- 편집 화면 canvas는 `puyow.js`가 그리므로, 도구에서만 쓰는 canvas 문구(`다음에 나올 뿌요`, `%1턴`, 지급 뿌요 색 경고, 편집 모드 밖 테스트 오류)의 번역은 `puyow_tools.js`의 `TOOLS_CANVAS_STRINGS`에 언어별(en·ja·zh·de·fr)로 두고 `registerLanguage()`로 게임 번역표에 등록한다. 여기서는 게임 번역표에 맞춰 한국어 원문을 키로 쓴다. 등록은 `PuyoW.initialize()` 전에 해야 하므로 도구 초기화에서 처리한다.
- 색상 선택 칸은 `translate(color)`가 색 이름과 다른 값을 돌려줄 때만 `red (빨강)`처럼 괄호를 붙인다. 영어에서는 번역이 색 이름과 같아 `red`만 나온다.
- 도구 회귀 테스트(`tests/test02_tools.spec.js`)는 파일 전체에 `test.use({ locale: 'ko-KR' })`를 걸어 한국어 문구로 화면을 찾고, 파일 끝의 `일본어`·`독일어`·`기본 언어인 영어` 그룹이 각자의 로케일로 따로 확인한다. 도구 문구를 바꾸면 이 그룹들을 함께 본다.
- 테스트에서 조작 뿌요를 떨어뜨릴 때 **빠른 하강은 방향키를 눌러 둔 동안에만 동작한다**. `page.keyboard.press('ArrowDown')`을 여러 번 부르는 방식은 거의 내려가지 않으므로, `keyboard.down`으로 눌러 두고 기다렸다가 `keyboard.up`으로 뗀다(`dropPairAtLeftEdge()`).
- 피버 테스트 성공을 확인하는 고정 데이터는 `FEVER_FOUR_CHAIN_PUYOS`다. 열 0에 빨강 쌍을 떨어뜨릴 때만 정확히 4연쇄가 되며, 열 5의 방해뿌요는 싹쓸이를 막아 다음 목표 연쇄를 5로 고정하려고 남겨 둔 것이다. 싹쓸이가 나면 다음 목표가 7로 뛰는데, 그 색 수와 지급 쌍 구성에 맞는 피버 스테이지가 없으면 `selectContinuousFeverStage()`가 예외를 던져 테스트가 멈춘다.

## 공통 계산 함수

현재 개발·유지보수 범위는 2D 버전이다. 게임 규칙 계산을 재사용할 때는 `PuyoW.common`(또는 `PuyoW.getCommonFunctions()`)을 사용한다. 이 객체의 함수는 입력 보드를 직접 변경하지 않는 공통 계산 함수다. 대표적으로 착지/폭발/점수/공격/중력/싱글 보드 시뮬레이션 함수가 있으며, 한 쌍을 가상 배치한 결과는 `simulatePlacementResult(board, colors, positions)` 하나로 구한다. 이 함수는 연쇄가 끝난 보드와 연쇄 수, ATTACK을 `{board, combo, attack}`으로 한 번에 돌려주며 `simulatePlacementBoard()`·`estimateCombo()`·`estimateAttack()`과 `prepareAiPlacementSimulations()`가 모두 이 함수를 거친다. 세 값을 따로 구하던 예전 구현과 결과는 같으나, 같은 배치를 여러 번 시뮬레이션하지 않고 세 값이 서로 어긋날 일도 없다.  `getFeverStageDefinitions()`는 Python 학습 환경이 실제 `FEVER_STAGES`를 복제할 수 있도록 직렬화 가능한 사본을 반환한다.

N수 AI 탐색은 `PuyoW.common.simulateNMovePlacements(player, targetCombo, turnCount)`와 `findBestNMovePlacement(player, targetCombo, turnCount)`로 재사용한다. 목표 연쇄 수는 두 번째 매개변수이며, 반환값은 이번 수의 `simulation`과 이후 경로·점수를 함께 가진다. 기본 룰·피버 룰 대전(구경 포함)은 각 플레이어의 내부 `nextPairs`에 현재 수 뒤 20쌍을 미리 확정해 유지한다. `getGameState()`는 브라우저 기반 학습 환경 확장과 적 AI에 모드와 룰, 양측 현재·일반·피버 필드, 피버 시간, 싹쓸이 티켓, 앞 두 쌍의 NEXT를 공통으로 제공하는 읽기 전용 snapshot이다. 현재 Python `PuyoDuelEnvironment`는 이 API를 호출하지 않고 Python 보드를 직접 시뮬레이션한다. 중앙 화면과 `getNextPairs()`는 대전에서 앞 두 쌍을 보이며, 단독 모드의 `getNextPairs()`는 기존 호환성을 위해 네 쌍을 보인다. 동기 N수 탐색과 Worker snapshot은 20쌍 전체를 사용한다. 3수 이상 비동기 탐색은 `simulateNMovePlacementsInWorker(player, targetCombo, turnCount, timeLimitMs, options)`를 사용한다. 이 함수는 Blob Worker에 현재·상대 필드, 공격·피해, 피버 필드·상태, 예고뿌요, 룰 정보를 JSON snapshot으로 보내고, 깊이별 현재 1수 결과를 `onProgress`로 전달한다. 탐색량은 착지 후보 수에 따라 지수적으로 늘어나므로, 일반 실시간 적은 기존처럼 2수 수준을 사용한다.

공통 계산을 수정하면 2D 게임, CPU 미리보기, 시뮬레이터, 피버 패턴 검증에 미치는 영향을 확인한다. 독립 3D 게임 버전은 개발 대상에서 철회했다. 선택적 3D 효과는 독립 게임이 아니라 기존 2D 게임 위에 얹는 연출이며, **새 3D 효과와 THREE 객체를 다루는 구현은 `src/js/puyow_3d.js`에 둔다.** `src/js/puyow.js`에는 2D 게임 동작이 유지되는 데 필요한 캔버스 준비, 선택적 효과 모듈 연결, 크기 변경·정리 같은 최소한의 접점만 둔다. 2D 게임 핵심 코드에 THREE를 직접 의존시키거나 THREE가 있다고 가정하는 코드를 추가하지 않는다.

`puyow.js`는 같은 8자리 접미사의 2D·투명 3D canvas를 최상위 `div_puyow_root` 아래에 만들지만, `three.min.js`와 `puyow_3d.js`는 모두 선택 사항이다. THREE가 없거나 3D 효과 모듈이 빠져 있어도 2D 캔버스 초기화·입력·게임 진행은 정상 동작해야 한다. 효과 모듈이 로드된 경우 `window.PuyoW3DEffect.initialize(threeCanvas)`로 초기화하고, 반환된 매니저의 `onWindowResize()`와 `dispose()`를 수명주기 접점으로 사용한다. `puyow_3d.js`도 THREE가 없으면 효과 초기화를 건너뛰어야 하며, 2D 게임 동작을 막아서는 안 된다. 효과 구현 시 이 선택 의존성 계약과 2D 우선 입력·레이어 동작을 보존한다.

현재 초기화에는 두 번째 인자로 `{ onActiveChange: setThreeCanvasLayerActive }`를 전달한다. `initialize()`는 캔버스·콜백만 연결하고 WebGL 렌더러는 첫 카드 연출에서 지연 생성한다. THREE가 있어도 WebGL이 실패할 수 있으므로 매니저 내부에서 오류를 처리한다. `active`일 때만 기존 `frame(time)`이 `update(time)`을 호출하며 별도의 RAF 루프를 만들지 않는다. 앞에 놓인 3D canvas도 `pointer-events: none`을 유지하여 입력은 항상 2D 캔버스의 기존 좌표 변환을 거친다. 렌더러의 `setSize(width, height, false)`에는 CSS 회전 후 크기가 아니라 2D와 같은 실제 출력 해상도를 전달한다. 완료·건너뛰기·갤러리 종료·GPU 컨텍스트 손실은 `cancelReveal()`에서 타이머·효과 geometry/material/texture를 해제하고 레이어를 복원한다. `dispose()`는 렌더러와 이벤트도 정리하여 게임을 재초기화할 수 있게 한다. Webpack 번들에도 효과 모듈을 포함한다.

실행용 동적 스타일은 남는 세로 공간에서도 두 canvas의 실제 표시 영역을 화면 상단에 맞추고, 세로 화면에서는 회전 후 보이는 좌측 경계도 화면 좌측에 맞춘다. 클릭 좌표는 계속 2D canvas의 실제 bounding rect를 기준으로 변환한다. 새 독립 3D 게임·규칙 엔진·기존에 없는 소비자 호환성을 전제로 작업하지 않는다.

## 테스트 작업 체크리스트

1. 최신 `TODO.md`와 해당 소스·기존 테스트를 읽는다.
2. 변경한 규칙의 정상 경로와 경계 조건(잠김, 취소, 패배, 정산, 저장)을 테스트에 추가하거나 갱신한다.
3. 캔버스 UI는 키보드, Enter, 마우스, ESC, 외부 클릭, 잠긴 항목을 함께 확인한다.
4. `node --check src/js/puyow.js`, `npm.cmd test`, 관련 Playwright 테스트를 실행한다.
5. 최종 보고에는 변경 파일, 실행한 검증, 실행하지 못한 검증의 이유를 간단히 적는다.

### 테스트 파일 구성

게임 페이지 회귀 테스트는 예전에 `tests/test01.spec.js` 한 파일이었으나, 무엇을 확인하는 테스트인지에 따라 아래처럼 나눴다. 테스트를 더할 때는 새 파일을 만들기 전에 이 표에서 맞는 자리를 먼저 찾는다.

| 파일 | 다루는 범위 |
| --- | --- |
| `tests/common/gamepage.js` | 여러 파일이 함께 쓰는 준비 코드와 도우미. `setupGamePage()`가 공통 `test.beforeEach`를 지금 spec 파일에 등록한다. 파일 이름이 `*.spec.js`가 아니라서 Playwright가 테스트로 수집하지 않는다. |
| `test01_core.spec.js` | 초기화·리소스 로드·공개 API·보드/NEXT/DAMAGE 규칙·저장 데이터 보정·확인창·다국어와 URL 치환 |
| `test01_menu.spec.js` | 타이틀 메뉴·설정 화면·카드와 GOLD·가상 컨트롤러와 조이스틱·게임패드·화면 회전·플레이 방법 시연 |
| `test01_enemy.spec.js` | 기본 제공 적 AI의 판단, 다수 탐색 Worker, 패배 위치 회피, 적 테마, 진행도 저장, 구경 모드 |
| `test01_fever.spec.js` | 피버 룰·피버 룰 (시작)·연속 피버와 그에 딸린 공격·싹쓸이 정산 |
| `test01_relaxed_fever.spec.js` | 피버 룰 (완화)의 잠금·키보드/마우스 선택·전등 수·독립 적 진행도·갤러리·리더보드·리플레이 |
| `test01_fever_damage.spec.js` | 연쇄 시작 시 상대 피버 상태에 따른 피해 귀속·지연 에너지 정산·피버 종료 후 낙하 |
| `test01_puzzle.spec.js` | 퍼즐뿌요 스테이지 선택·승리 조건·결과 화면 |
| `test01_simulator.spec.js` | 시뮬레이터와 점수·연결 보너스 계산 |
| `test01_replay.spec.js` | 리플레이 기록과 재생 |
| `test01_together.spec.js` | 너랑 나랑 (한 컴퓨터 2인 대전) |
| `test02_tools.spec.js` | 개발용 도구 페이지(`tools.html`) |
| `test05_leaderboard.spec.js` | 리더보드 기록 규칙(기본 룰 승리·연습 패배·일시정지 종료 제외·저장값 정리·서버 전송)과 조회 페이지(`leaderboard.html`)의 트리 메뉴·전체 순위·단계별 통합 순위·로컬/온라인 토글·키보드·화면 모드·다국어·좁은 화면 |
| `test06_replay_page.spec.js` | 리플레이 재생 페이지(`replay.html`)의 툴바 버튼 상태·JSON 입력 팝업·리플레이 목록 사이드바·불러오기 전 캔버스 숨김·결과 화면 종료 버튼 숨김·페이지 다국어·`replay_` WebMCP 도구와, 게임 페이지 리플레이 일시정지·결과 화면의 종료 버튼 유지 |
| `test03_ai.spec.js` | **AI 모델 사용과 학습.** 설정의 AI 서비스 제공자(LM Studio·Local AI), 솔로몬의 배치 요청과 온라인 학습 전송, `역으로 모델 학습` 설정, 브라우저 ONNX 추론 적(적 선택 화면의 느낌표 마크와 첫 대전 전 불안정 안내 포함) |

AI 모델과 학습에 관한 테스트는 반드시 `test03_ai.spec.js`에 둔다. 이 파일만 외부 AI 서버 응답과 ONNX 런타임을 흉내 내고 CPU를 많이 쓰므로, 나머지 게임 동작 테스트와 섞으면 실패 원인을 가리기 어렵다.

한 파일에서만 쓰는 도우미 함수는 그 파일 안에 남기고, 두 파일 이상이 쓰는 것만 `tests/common/gamepage.js`로 올린다.

`test01_*.spec.js`와 `test03_ai.spec.js`는 `test02_tools.spec.js`와 달리 로케일을 고정하지 않아 기본 영어로 돌아간다. 따라서 `window.testCanvasTexts`에서 화면 문구를 찾을 때는 한국어 원문을 그대로 비교하면 안 되고 `window.WebPuyo.translate('한국어 원문')`으로 현재 언어 문구를 얻거나 언어별 후보를 모두 나열해야 한다. 번역표에 없는 문구(예: `철구뿌요`)만 한국어 그대로 나오므로, 기존 테스트가 한국어로 비교한다고 해서 전부 그래도 되는 것은 아니다.

Playwright 설치 때 생긴 예제 `tests/example.spec.js`(공개 인터넷의 playwright.dev에 접속했다)와 철회한 독립 3D 버전의 `tests/puyow3d.spec.js`(전부 `test.skip`이었다)는 지웠다. 되살릴 일이 있으면 git 히스토리에서 찾는다.

### 부하 때문에 흔들리는 테스트

Playwright는 `fullyParallel`이라 여러 테스트를 한꺼번에 돌린다. 이 테스트들은 실제 대전과 연출을 그대로 진행하므로, 혼자 돌릴 때 1초에 끝나는 화면 전환이 전체 실행에서는 몇 초씩 걸린다. **단독 실행에서는 통과하는데 전체 실행에서만 실패한다면 기능이 깨진 것이 아니라 대개 이 문제다.** 두 가지로 대응하고 있다.

- `playwright.config.mjs`의 `expect: { timeout: 15000 }`이 기본 대기 시간을 15초로 올린다. 테스트 안에서 `expect.poll`에 제한 시간을 따로 적을 때도 15초보다 짧게 적지 않는다. 실제로 깨진 기능은 그대로 실패하고 실패를 알아채기까지 걸리는 시간만 길어진다.
- 한 테스트에서 여러 단계를 이어 보는 항목(ONNX 모델 로딩 실패 뒤 실제 추론 대전, 구경 대전 뒤 리플레이 재생 등)은 각 단계의 대기 시간을 합치면 기본 테스트 제한 시간 30초를 넘기므로 `test.setTimeout()`으로 넉넉히 잡는다. ONNX 추론과 구경 대전은 CPU를 많이 써서 함께 돌 때 특히 느려진다.
- ONNX 모델 로딩 실패 경로로 "대전이 시작됐다가 적 선택 화면으로 돌아오는" 흐름을 확인할 때는 `page.route()`의 실패 응답을 2초쯤 늦춘다. 곧바로 404를 주면 WebKit에서는 대전 상태가 `expect.poll`의 확인 간격보다 짧게만 존재해 `getGameState()`를 한 번도 관찰하지 못하고 실패했다(BUILDNO 43 불안정 안내 테스트에서 실제로 겪었다). 기존 플라우로스 모델 로딩 테스트도 같은 이유로 응답을 늦춘다. 불안정 안내 테스트는 `계속` 처리 여부(저장 기록)를 대전 상태보다 먼저 확인해, 실패하면 입력 문제인지 관찰 경합인지 바로 갈리게 해 두었다.
- **WebKit은 같은 화면을 그리는 데 Chromium의 2~3배를 쓴다.** 프레임 하나에서 게임 코드(갱신 + 캔버스 그리기)가 쓰는 시간의 중앙값이 WebKit 11~19ms, Chromium 5~6ms이고, headless WebKit의 `requestAnimationFrame`은 vsync에 묶이지 않아 혼자 돌 때도 100fps 이상으로 돈다(Chromium은 60fps 고정). 병렬 페이지가 늘면 WebKit이 먼저 무너져서, 16페이지 동시 실행에서 WebKit 26fps 대 Chromium 51fps였다. WebKit 전체 실행이 유독 느리거나 실패가 많으면 대개 이 CPU 여유 부족이다. `--workers`를 줄이면 눈에 띄게 줄어든다(기본 8워커 10건 실패 → 4워커 5건 실패).
- BUILDNO 41까지는 여기에 더해 **프레임률이 20fps 아래로 떨어지면 게임 시간 자체가 느려지는** 문제가 겹쳐, 퍼즐 클리어·패배 판정·자연 낙하 속도·튜토리얼 문구·게임패드 입력 테스트가 WebKit에서만 무더기로 실패했다. 원인은 게임 쪽이었고 `게임 루프와 시간 진행` 절의 나눠 갱신으로 해결했다. 다만 벽시계 대기(`page.waitForTimeout`)가 한 프레임보다 짧으면(예: 50ms) 그 사이에 프레임이 하나도 없어 입력 변화가 통째로 무시될 수 있다. 게임패드 테스트처럼 "뗀 상태를 한 프레임은 봐야 새 누름으로 인식하는" 판정을 확인할 때는 대기를 넉넉히 잡는다.

Playwright의 `webServer`는 `reuseExistingServer`라서 9891 포트에 이미 떠 있는 서버를 그대로 쓴다. `nodeserver.js`(`src/onnx/default.onnx`)와 `python/pythonserver.py`(`python/puyow/default.pt`)는 모델 파일을 불러올 수 있으면 `/apis/localmodelinfo`에 `true`를 주므로, Playwright가 기본으로 띄우는 Node 서버에서도 Local AI를 쓸 수 있는 상태가 기준이다. 모델 파일 유무나 어느 서버로 띄웠는지에 따라 Local AI 사용 가능 여부가 달라진다. Local AI를 쓸 수 있으면 제공자 기본값이 Local AI가 되고 그 때문에 솔로몬이 세션에서 열려 적 목록과 설정 화면 포커스 순번까지 함께 바뀐다. 그래서 `tests/common/gamepage.js`의 `setupGamePage()`가 등록하는 `test.beforeEach` 안에서 `disableLocalAiModel()`이 이 응답을 `false`로 고정해 기준선을 일반 웹 서버와 같게 만든다. Local AI가 필요한 테스트는 `page.route()`를 자기 안에서 다시 걸어 이 기본값을 덮어쓴다(나중에 등록한 라우트가 이긴다). ONNX wasm CDN을 막는 `blockOnnxWasmCdn()`도 같은 구조다. 서버 응답에 따라 게임 동작이 갈리는 기능을 새로 만들면 이 두 함수처럼 기준선을 함께 고정한다.

### 2026-09-09 WebKit 호환성 정리

- Playwright WebKit은 `page.route()`가 남아 있으면 `blob:` Worker 스크립트를 읽지 못한다. Worker 탐색만 확인하는 적 AI 테스트는 `releaseNetworkInterception(page)`로 공통 라우트를 걷고 새로 연 뒤 실행한다. 이 경로의 WebKit 단일 worker 5개 회귀는 통과했다.
- 설정 문자열 편집은 모든 처리 키의 기본 브라우저 동작을 막는다. 특히 canvas에 포커스가 있을 때 WebKit의 `Backspace`가 이전 페이지로 이동하지 않아야 한다.
- 도구 화면의 canvas 좌표 테스트는 `scrollIntoViewIfNeeded()` 뒤 실제 bounding box를 읽는다. WebKit은 화면 밖 canvas의 절대 좌표에 보낸 마우스 입력을 전달하지 않는다.
- Local AI 사용 불가 UI는 저장값 보정과 canvas 재그리기가 비동기이므로, 비활성 API 테스트 버튼의 색 확인도 `expect.poll`로 기다린다. `fillStyle` 문자열은 브라우저마다 16진수·`rgb()`·`rgba()`로 달라질 수 있다.

## 머신러닝 작업 참고

머신러닝 관련 작업 시 학습 코드와 학습 API 구현을 함께 확인해야 한다. 학습 모델·환경·학습 실행 방법은 `python/learning.py`를, 관측값·행동·보상·에피소드 종료 이벤트를 전달하는 서버 API는 `python/pythonserver.py`를 참고한다. 승·패 보상(`WIN_REWARD`, `LOSS_REWARD`), 연쇄 가중치 `chain_reward()`, 한 수의 즉시 보상 계약 `move_reward()`(= `ATTACK + 연쇄 가중치`), 게임 시간 보정 `game_time_reward()`, 승패와 시간을 합친 종료 가치 `terminal_reward()`, 감가율 `DISCOUNT_GAMMA`(0.70)와 스칼라 관측값의 정규화 기준(`ATTACK_SCALE` 등), 관측 벡터를 보드·쌍·상태로 되돌리는 `decode_observation_board()`·`decode_observation_pair()`·`decode_observation_scalars()`는 `python/common.py`에 있다. 오프라인 학습과 서버의 온라인 학습이 같은 보상 크기를 써야 하므로 `PuyoDuelEnvironment.WIN_REWARD`도 이 공통 상수를 그대로 참조한다. `pythonserver.py`와 `nodeserver.js`는 모두 `/apis/localmodelinfo`를 제공하며 `{ "available": boolean }`만 응답한다. `pythonserver.py`는 `SERVER_CONFIG['model_path']`가 실제 파일이고 `get_value_model()` 로드까지 성공할 때만, `nodeserver.js`는 `LOCAL_AI_MODEL_PATH`(`src/onnx/default.onnx`)가 실제 파일이고 ONNX 세션 생성까지 성공할 때만 `true`다(아래 「Node 서버의 Local AI」 절). `python/bundledenemy.py`는 `src/js/puyow.js`의 기본 제공 적 AI를 Python으로 옮긴 모듈이다. 대전 가능한 적은 단탈리온부터 오로바스까지 모델 미사용 출시 적 17종이다. 솔로몬·안드로말리우스, ONNX 적 무르무르·카임·알로케스, 출시 예정 발람·푸르카스는 제외한다. 여기에 더해 원작에 없는 학습 전용 연습 상대 `QuietEdgeEnemy`가 `ENEMY_FACTORIES`에만 들어 있고 `TRAINABLE_ENEMY_TYPES`에는 없다(아래 「TODO 학습 방식·가중치 변경 결과」 절 참고). `PuyoDuelEnvironment`의 `--opponent random`은 self-play와 이 17종 적 중 하나를 매 에피소드마다 고르고, `self`는 현재 학습 중인 정책을 상대에도 적용한다. `solo`를 제외한 대전에서는 기본/피버 룰 및 3~5색도 에피소드마다 무작위로 선택한다. 피버 룰은 일반/피버 필드, 게이지, 제한 시간, 목표 연쇄 및 JS의 실제 피버 패턴을 사용한다. 브라우저 관측은 `game.elapsed`의 실제 시간을 쓰고, 벽시계와 무관하게 고속 실행되는 오프라인 학습은 양측 한 턴을 3초로 진행한다. `src/js/puyow.js`의 적 AI 판단 로직이나 피버 패턴을 바꾸면 `bundledenemy.py`와 학습 회귀 테스트를 함께 확인한다. 숨김 행 없는 12행 보드, 딱딱뿌요 제외, RealtimeLookaheadEnemy의 동기 시간 제한 탐색 등 의도적인 제한은 `bundledenemy.py` 모듈 docstring에 정리되어 있다.

모델 버전 4의 관측값은 1035개다. 자기 보드 채널 504개(빈 칸·방해뿌요·5색), **상대 보드 채널 504개**, 현재 쌍 10개, 스칼라 17개 순서이며 JS 학습 전이, Python 환경, Solomon 서버가 `python/common.py`의 같은 계약을 사용한다. 스칼라는 ATTACK/턴/DAMAGE/룰/티켓/경과시간/마진/시간 배율/피버 상태 14개에 이어 `incoming_in_flight`(진행 중인 상대 연쇄의 미확정 예측 공격, `DAMAGE_SCALE` 30)·`incoming_land_move`(그 공격이 떨어지기 전에 둘 수 있는 배치 수, `LAND_MOVE_SCALE` 8)·`opponent_chain_active` 셋이 붙는다. **`incoming_damage`는 확정된 DAMAGE만 뜻한다**(예측을 섞으면 같은 공격을 두 번 센다). `learning.py`의 `--output` 경로가 실제 체크포인트 파일이면 `MODEL_VERSION`·`OBSERVATION_SIZE`·`ACTION_COUNT`를 검증한 후 가중치를 복원한다. 버전 3(528개) 이하 체크포인트는 관측 계약이 달라 호환하지 않으며 다시 학습해야 한다. `--evaluate-episodes`는 탐험 없이 승률을 집계하고, `--infer-observation`은 LM Studio/HTTP 없이 관측 JSON을 직접 추론한다(숫자 배열 또는 `{observation, nextPair}` 객체). 체크포인트에는 optimizer·replay buffer·epsilon 상태를 저장하지 않는다.

### 애프터스테이트 가치 학습 (모델 버전 4)

24개 행동의 Q값을 내던 DQN(`PolicyNetwork`)을 버리고, 한 수를 둔 직후 상태의 가치 하나를 내는 `learning.ValueNetwork`를 쓴다. 이 게임은 착지·폭발·연쇄·ATTACK을 `bundledenemy`의 규칙만으로 정확히 계산할 수 있으므로, 규칙으로 알 수 있는 부분을 신경망이 다시 배울 이유가 없다.

- **선택 규칙**: `learning.enumerate_afterstates(observation, next_pair, usable_actions)`가 놓을 수 있는 배치마다 결과 보드를 만들고, `learning.select_afterstate()`가 `move_reward + DISCOUNT_GAMMA * V(애프터스테이트)`가 가장 큰 후보를 고른다. 놓을 수 없는 배치는 후보에서 아예 빠지므로 불가능한 행동을 고르는 경로가 없다. 후보가 하나도 없으면 애프터스테이트 없이 스폰 위치(X=2)를 돌려준다.
- **애프터스테이트 인코딩**: 결과 보드를 같은 1035개 관측 계약으로 인코딩하되, **조작 쌍 자리에는 이번 수의 다음 쌍**을 넣는다(= 다음 턴이 시작될 때의 내 상태). ATTACK·싹쓸이 티켓·피버 보정은 `PuyoDuelEnvironment`의 착지 처리와 같은 순서로 적용하고, 무작위인 방해뿌요 낙하는 반영하지 않은 채 상쇄하고 남은 피해량만 스칼라로 남긴다. **상대 보드는 내 수로 바뀌지 않으므로 관측값에서 읽은 그대로 이어 붙인다.** 상쇄는 단계별 규칙과 같은 순서로, 이번 수의 정수 ATTACK이 먼저 `incoming_in_flight`를 지우고 남은 만큼만 확정 DAMAGE를 지운다. `incoming_land_move`는 이 수를 두었으니 1 줄고(최소 0), `opponent_chain_active`는 그대로 둔다. 학습기·서버 추론·서버 온라인 학습이 모두 이 함수 하나를 쓰므로 가치망이 보는 입력 분포가 어긋나지 않는다.
- **신경망**: 보드 구간(보드→채널→y→x 순서)을 자기 보드 7채널 + 상대 보드 7채널의 14×12×6 평면 그대로 3×3 합성곱 두 단(32채널)에 넣고, 조작 쌍 10개와 스칼라 17개(`OBSERVATION_EXTRA_SIZE` 27)를 이어 붙여 256-128 은닉층을 지나 스칼라 하나를 출력한다.
- **학습 목표값**: `learning.build_value_samples()`가 에피소드가 끝난 뒤 (애프터스테이트, 그 수의 보상) 기록을 n스텝(`N_STEP_RETURN`, 기본 3) 목표값 표본으로 바꾼다. 리플레이 표본은 `ValueSample(state, partial_return, bootstrap, discount)`이며 목표값은 `partial_return + discount * V_target(bootstrap)`이다. 최대 턴에서 잘린 에피소드의 마지막 상태는 뒤가 비어 표본으로 쓰지 않는다.
- **승패는 보상이 아니라 마지막 애프터스테이트의 가치다**: 환경은 `info["terminal_value"]`로 승리 `+WIN_REWARD`·패배 `LOSS_REWARD`를 알려 주고(잘린 에피소드는 이 값이 없다), 학습기는 그 값을 보상에서 빼 낸 뒤 **마지막 애프터스테이트의 목표값 자체**로 쓴다. 승패를 그 앞 수의 보상으로만 주면 죽은 보드의 가치가 0이 되어, 배치 후보 중 "두는 순간 지는 수"가 안전한 수보다 좋아 보이는 문제가 생긴다. 서버의 `_close_solomon_side()`도 같은 계약이다. 놓을 자리가 아예 없어 끝난 수(`invalid`)도 패배로 보고 `LOSS_REWARD`를 쓴다.
- **탐험**: epsilon은 스텝이 아니라 **에피소드 기준**으로 줄여 전체의 절반(`episodes // 2`)에서 최저값 0.05에 닿는다. 에피소드마다 실제 수 개수가 크게 달라 스텝 기준으로는 학습이 끝날 때까지 탐험 비율이 거의 내려가지 않기 때문이다. 탐험도 무작위 행동 번호가 아니라 **놓을 수 있는 후보 중 하나**를 고른다.
- `--opponent solo`의 `PuyoEnvironment`도 자체 보드 로직을 버리고 `bundledenemy`의 착지·연쇄·패배 판정을 그대로 쓴다. 보상 계약이 대전 환경과 같아야 하기 때문이다.
- **학습 방식(`learning.TrainingStrategy`)**: `TRAINING_STRATEGIES` 등록표 하나를 CLI `--training-strategy`와 `lngui.py` 콤보박스가 함께 읽는다. 항목은 `standard`(기본값, 기존과 같음), `chain-guided`(탐험 수의 50%를 `CHAIN_GUIDE_ENEMY_TYPES` 중 에피소드마다 고른 안내 적의 배치로 둠), `chain-curriculum`(에피소드 30%는 연쇄 씨앗 필드에서 시작, 20%는 solo), `long-nstep`(n스텝 8), `chain-all`(셋 모두)이다. 새 방식은 등록표에 항목만 더하면 CLI 선택지와 GUI 목록에 함께 나타난다. `lngui.py`의 영어 표시 문구는 `label`·`summary`, 한국어 표시 문구는 `label_ko`·`description`이다(`label_ko`가 비면 영어 이름을 쓴다). `description`은 CLI 도움말·학습 로그에도 쓴다. 도움말은 argparse가 `%` 형식으로 다루므로 설명의 `%`를 이스케이프한다.
- **학습 방식은 추론 계약을 바꾸지 않는다**: 보상·감가율·관측값·행동이 그대로라 `MODEL_VERSION`을 올리지 않았다. 어떤 방식으로 학습한 체크포인트든 서버·브라우저 추론과 이어 학습에 호환된다. 대신 "최선의 수" 기준도 그대로이므로, 기준 자체를 바꾸는 감가율·보상 변경과는 다르다.
- **기본 방식의 난수 흐름을 보존한다**: 방식별 확률 판정은 전역 `random`과 분리한 `strategy_random`(`random.Random(f"training-strategy-{seed}")`)으로 하고, 환경의 연쇄 씨앗 판정도 비율이 0이면 난수를 뽑지 않는다. 그래서 `standard`는 이 기능을 넣기 전과 같은 난수 흐름으로 학습한다. 탐험 대체는 `select_afterstate(explore_fn=...)`로 넣고, `explore_fn`이 None을 돌려주면 기존 무작위 탐험으로 돌아간다.
- **안내 적**: 두 환경의 `suggest_agent_action(guide)`가 실제 보드·다음 쌍 목록·미정산 피해로 `decide()`를 부르고, `Placement.x * 4 + rotation`을 행동 번호로 쓴다. 안드레알푸스·안드라스·자간을 쓰는 이유는 턴을 넘나드는 단계 상태가 없어서다. 단탈리온·세레처럼 단계를 기억하는 적은 탐험 수에서만 띄엄띄엄 불리면 판단이 어긋난다. 안내 적은 에피소드마다 새로 만든다.
- **연쇄 씨앗**: `build_chain_seed_board()`는 실제 피버 패턴을 색만 무작위로 섞어(지급쌍과 무관) 에이전트의 일반 필드에만 깐다. 첫 수에 바로 터지면 앞 상태가 없어 `build_value_samples()`가 그 보상을 어떤 표본의 목표에도 쓰지 않기 때문이다. 섞은 결과가 이미 터지거나 패배 칸을 막으면 None을 돌려 빈 보드로 시작한다. 피버 룰과 마찬가지로 Node.js가 필요하다. solo 비율은 `--opponent solo`일 때 의미가 없고, solo 에피소드는 이길 수 없어 로그의 승수가 줄어든다.
- **평가·로그의 연쇄 통계**: `evaluate_policy()`는 승패에 더해 `average_max_combo`·`max_combo_distribution`(에피소드별 최대 연쇄, 0 포함)·`average_combo`·`combo_distribution`(터진 수만)을 돌려준다. 분포 딕셔너리의 키는 정수이며 JSON 출력에서 문자열이 된다. 학습 로그와 `on_progress` 통계에도 에피소드 최대 연쇄 `max_combo`가 붙는다. 회귀는 `test_learning.py`의 `TrainingStrategyTest`와 `TrainerMenuTest`의 콤보박스 테스트가 맡는다.
- **고연쇄를 덜 노리는 근본 원인(2026-09-11 분석)**: 연쇄 보너스 덕분에 보상은 이미 고연쇄를 크게 우대한다(1연쇄 최소 1.57, 7연쇄 최소 246.1). 그러나 감가율 0.70에서는 최소 14수 뒤인 7연쇄의 현재 가치가 약 1.67로, 지금 터뜨리는 1연쇄와 비슷하다. 위 학습 방식들은 추론 계약을 지키느라 이 한계를 바꾸지 못한다. 효과가 부족하면 다음 단계는 모델별 감가율 설정이다(값이 `common.py`·`nodeserver.js`·`puyow.js` 세 곳에 있고 기존 ONNX 적의 호환성을 함께 고려해야 한다). `TODO.md`의 지수 보상 증대안은 검토만 하고 구현하지 않았다. 1.5^n은 2~12연쇄에서 n²보다 작고 0연쇄에 1을 주며, 기존 모델과 가치 크기 기준도 어긋나기 때문이다.

### 브라우저 ONNX 추론 적 (`OnnxEnemy` 계열)

무르무르(`Murmur`)·카임(`Caim`)·알로케스(`Alokes`)는 브라우저 ONNX Runtime으로 각각 `onnx/model01.onnx`·`onnx/model02.onnx`·`onnx/model03.onnx`를 사용한다. 공통 구현은 `OnnxEnemy`(→ `BundledEnemy` → `Enemy`)이며 `WebPuyo.OnnxEnemy`로 공개한다. 각 적은 독립된 `modelPath`와 표시 메서드를 가진다. 발람·푸르카스는 AI 미구현 출시 예정 적이므로 ONNX 의존성이나 모델 경로가 없다.

- **선택 규칙은 파이썬과 같다**: `learning.select_afterstate()`를 그대로 옮겼다. `getUsablePlacements()`로 실제 도달 가능한 배치만 추리고, 후보마다 `buildAfterstate()`가 연쇄까지 끝난 결과 보드를 `common.py`와 같은 1035개 관측 벡터로 만든 뒤, 한 번의 추론(`[후보 수, 1035]`)으로 받은 가치로 `move_reward + ONNX_DISCOUNT_GAMMA(0.70) * V`가 가장 큰 배치를 고른다. 모델은 행동이 아니라 **스칼라 가치 하나**를 내므로 후보 열거와 보상 계산은 JS가 한다.
- **관측 인코딩은 한 함수만 쓴다**: `buildObservationValues()`가 학습 API용 `getLearningObservation()`과 애프터스테이트 인코딩 양쪽을 담당한다. 모델 버전 4부터 `state.board` 뒤에 `state.opponentBoard`를 같은 형식으로 넣고, 끝에 `incomingInFlight`·`incomingLandMove`·`opponentChainActive`를 더한다. ATTACK·싹쓸이 티켓·피버 보정과 상쇄 순서는 `learning.py`의 `_build_afterstate()`와 같아야 하며, 애프터스테이트의 조작 쌍 자리에는 **이번 수 다음에 내려올 쌍**을 넣는다. `python/common.py`의 스케일 상수를 바꾸면 이 함수도 함께 고쳐야 한다.
- **실시간 상태는 `getModelIncomingState(player, opponent)` 하나가 만든다**: 확정 DAMAGE, 진행 중인 상대 연쇄의 미확정 공격(`predictPlayerChain().finalAttack`과 `opponent.attack` 중 큰 쪽의 정수부), 도착까지 남은 배치 수(`estimateAiPlacementTiming()`으로 어림), 상대 연쇄 진행 여부를 돌려준다. 학습 API 관측·ONNX 애프터스테이트·솔로몬 프롬프트가 모두 이 함수를 쓴다. 파이썬 학습 환경의 `_estimate_incoming_land_move()`·`_predicted_in_flight()`와 같은 규칙이어야 한다.
- **모델 버전 검사**: `prepareModel()`이 빌린 세션의 입력 길이를 `isSessionObservationCompatible()`로 확인한다. `ONNX_OBSERVATION_SIZE`와 다르면 한 번 알리고 `disableOnnx()`로 그 대전을 기존 시뮬레이션 AI로 진행한다. 런타임이 입력 정보를 주지 않으면 검사를 건너뛴다. 버전 3 `.onnx` 파일이 남아 있을 때 매 턴 추론이 실패하는 것을 막기 위한 안전장치다.
- **결과 보드가 필요해 시뮬레이션을 합쳤다**: `simulatePlacementResult()`가 `{board, combo, attack}`을 한 번에 돌려주고, 기존 `simulatePlacementBoard()`·`estimateCombo()`·`estimateAttack()`과 `prepareAiPlacementSimulations()`가 모두 이 함수를 거친다. 같은 배치를 여러 번 시뮬레이션하지 않고 세 값이 어긋날 일도 없다. 또 `prepareAiPlacementSimulations()`는 계산해 둔 결과 보드를 버리지 않고 후보마다 `board`로 남기며, `buildAfterstate()`는 그 값이 있으면 재사용해 한 턴에 같은 연쇄를 두 번 돌리지 않는다. **이 보드는 여러 곳이 함께 보는 배열이므로 읽기 전용으로만 쓴다.** 후보 목록 밖에서 들어온 배치(`board`가 `undefined`)만 직접 계산하고, 놓을 수 없는 배치는 `board`가 `null`이라 후보에서 빠진다.
- **추론은 반드시 Web Worker에서 돌려야 한다**: wasm 연산은 메인 스레드에서 **동기로** 실행된다. `await session.run()`이라고 써 있어도 연산 자체는 양보하지 않으므로, `ort.env.wasm.proxy`가 꺼져 있으면 그동안 화면·입력·자연 낙하가 통째로 멈춘다. 특히 27MB wasm을 인스턴스화하는 `InferenceSession.create()`가 문제였고, CPU 6배 저속 환경에서 메인 스레드가 **3,756ms** 통째로 멈춰 브라우저가 응답 없음으로 보였다(프록시를 켜면 같은 조건에서 173ms). 이 때는 로딩 안내 문구조차 그려지지 않는다. 그래서 `refreshOnnxRuntimeAvailability()`가 `proxy = true`를 켜며, Blob 워커를 막는 CSP 등으로 프록시 워커를 만들지 못하면 **절대로 메인 스레드로 재시도하지 않는다.** 그 대전의 `OnnxEnemy`만 기존 `BundledEnemy` 시뮬레이션으로 전환해 게임은 계속 진행한다. 이 설정은 첫 세션 생성보다 먼저 끝나야 하므로 초기화 시점에 한 번만 잡는다.
- **추론 중에도 게임은 멈추지 않는다**: 솔로몬과 같은 `decisionState`(`pending`/`ready`/`fallback`/`cancelled`) 구조다. 결과가 오기 전에는 `updateControl()`이 좌우 이동·회전을 하지 않고 `useFastDown()`도 false를 돌려주므로 자연 낙하만 진행되며, 결과가 나오기 전에 뿌요가 닿으면 `cancelPendingRequest(player, 'contact')`가 토큰을 올려 그 턴 결과를 버린다. 늦게 도착한 결과는 `inferenceToken`과 `isCurrentTurn()`으로 걸러진다.
- **한 턴의 마감 시한은 `ONNX_INFERENCE_TIMEOUT`(2초)다**: 넘으면 `inferenceToken`을 올려 늦은 결과를 버리고 `applyFallback()`으로 그 턴을 확정한다. 한 턴의 자연 낙하 예산(`PLAYER_FALL_INTERVAL 2048ms × 12칸 ≈ 24초`)보다 훨씬 짧게 잡아, 늦은 추론 때문에 회전도 이동도 없이 스폰 자리에 떨어뜨리는 턴이 생기지 않게 한다. 타이머는 프록시로 메인 스레드가 비어 있을 때만 제때 깨어난다 — 동기 블로킹은 `setTimeout`으로 끊을 수 없으므로 프록시 없이는 이 마감 시한 자체가 무의미하다. `clearDecisionTimeout()`으로 결과 도착·턴 교체·취소 모두에서 정리한다.
- **세션·추론 수명은 대전 범위로 제한한다**: `onnxSessionCache`는 양쪽 적이 쓰는 최대 2개 모델만 빌릴 수 있으며, 결과 화면을 닫거나 일시정지에서 종료·다시하기를 고르거나 `destroy()`할 때 각 `OnnxEnemy.releaseModel()`이 마지막 대여 세션의 `release()`를 호출한다. 다시하기는 그보다 먼저 대기 API 요청과 Worker 탐색도 취소한다. 같은 세션의 `run()`은 `runOnnxSessionIfIdle()`이 하나만 허용하고, 이미 실행 중이면 새 요청을 쌓지 않고 그 턴을 앞 1수 시뮬레이션으로 결정한다. 입력 텐서와 모든 출력 텐서는 `finally`에서 `dispose()`한다. 따라서 시간 초과 뒤 실제 `run()`이 늦게 끝나도 여러 요청·텐서가 누적되지 않는다.
- **실패 처리는 세 단계로 나뉜다**: Blob Worker/CSP 때문에 **프록시 Worker 생성만** 실패하면 해당 대전의 ONNX 적을 기존 시뮬레이션 AI로 바꿔 진행한다. 모델 파일·wasm·그래프의 **로딩** 실패는 대전을 아예 시작하지 않는다. `prepareGameOnnxModels()`가 `game.onnxLoading`을 켜서 카운트다운을 멈추고 로딩 안내를 띄우다가, 실패하면 안내 문구와 함께 적 선택 화면으로 돌려보낸다. 구경 모드는 `requiresOnnx` 적을 후보에서 아예 빼므로 이 경로를 쓰지 않는다. 반면 **추론·출력 검증** 실패 또는 이미 실행 중인 세션은 대전을 멈추지 않고 그 턴만 앞 1수 시뮬레이션(`findBestAttackPlacement()`) 결과로 진행한다.
- **첫 대전 전 불안정 안내(임시 대응)**: ONNX 동작이 아직 불안정해 BUILDNO 43에서 넣었다. 적 선택 화면(기본 룰·피버 룰·피버 룰 (시작))은 `requiresOnnx` 적의 이름 오른쪽에 노란 원 안의 느낌표 마크를 붙인다. 하단 카드 목록(출시 예정 카드 포함)과 가운데 선택 영역 이름 모두 `drawOpponentNameWithMark()`로 그리며, 이름과 마크를 한 덩어리로 가운데 정렬한다. 잠겨 이름을 숨긴 카드에는 마크도 없다. `시작`은 키보드·마우스 모두 `startOpponentMenuGame()`을 거친다. 고른 적이 `requiresOnnx`이고 `store.onnxWarningAcknowledged`가 false면 곧바로 시작하지 않고 `ONNX_ENEMY_WARNING_MESSAGE`(`딥러닝 기반의 고난이도 적으로, 게임 플레이가 불안정할 수 있습니다.`)를 공용 확인창에 `계속`/`취소` 버튼으로 띄운다. `계속`이면 이 값을 true로 저장한 뒤 `startGame()`을 부르고, `취소`·ESC면 적 선택 화면에 그대로 머문다. 응답 전에 화면·선택 적이 바뀌었으면 기록만 남기고 시작하지 않는다. 한 번 `계속`을 고른 뒤로는 어떤 ONNX 적이든 안내 없이 예전처럼 바로 시작한다. 구경·너랑 나랑·단독 모드는 ONNX 적이 나오지 않으므로 이 경로와 무관하다. 불안정 문제가 해결되면 이 게이트와 마크, 번역 키를 함께 걷어 낸다.
- **런타임이 없어도 게임은 그대로 돈다**: `ort.all.min.js`는 선택 라이브러리다. 초기화 때 `refreshOnnxRuntimeAvailability()`가 전역 `ort` 존재 여부를 한 번 확인하고 `ort.env.wasm.wasmPaths`를 `src/js/`로, `numThreads`를 1로, `proxy`를 true로 지정한다. 런타임이 없거나 wasm 바이너리에 전혀 접근할 수 없으면(`isOnnxRuntimeAvailable()`이 둘을 함께 본다) `requiresOnnx` 적이 적 선택 화면에서 빠진다. 이때 쓰는 플래그는 `hidden`·`notAvail`과 **별개**이며, 갤러리는 영향을 받지 않는다. 그래서 적 목록 함수가 둘로 나뉘어 있다 — 갤러리는 `getGalleryOpponents()`(숨김만 제외), 적 선택 화면은 `getVisibleOpponents()`(숨김 + 런타임 없는 `requiresOnnx` 제외). 구경 모드는 런타임 유무를 따지지 않고 `getWatchOpponentCandidates()`가 `requiresOnnx` 적을 항상 제외한다. 진행도 사슬(`isOpponentUnlocked()`의 `progressionOpponents`)에는 런타임 여부와 무관하게 그대로 남겨 두어야 뒤 적의 해금 조건이 흔들리지 않는다.
- **wasm 파일 위치는 CDN을 먼저 쓴다**: `resolveOnnxWasmPaths()`가 초기화 때 한 번 결정한다. 27MB짜리 `ort-wasm-simd-threaded.jsep.wasm`은 CDN(`https://cdn.jsdelivr.net/npm/onnxruntime-web@<버전>/dist/`)을 HEAD로 먼저 두드리고, 닿으면 `wasmPaths`를 `{ mjs: <로컬>, wasm: <CDN> }` 객체로 지정한다. 46KB짜리 글루 모듈은 함께 배포되므로 항상 로컬 것을 쓴다. CDN에 닿지 않으면 `src/js/` 접두 경로로 되돌리고, **그 로컬 파일도 없으면** `onnxWasmAvailable`을 false로 남겨 적 선택 화면에서 ONNX 적을 감춘다. CDN 주소의 버전은 `ort.env.versions.web`에서 읽어 만들므로 `ort.all.min.js`만 갈아끼워도 글루와 바이너리 버전이 어긋나지 않는다. 확인은 비동기라 `onnxWasmPathsPromise`에 담아 두고 `acquireOnnxSession()`이 세션을 만들기 전에 기다린다. 확인이 끝나기 전에는 **사용 가능으로 본다**(낙관적 기본값). 정상 환경에서 적 목록이 뒤늦게 바뀜어 카드가 흔들리는 것을 막기 위해서고, 확인 전에 골라도 모델 로딩 게이트가 실패를 잡아 안내 후 되돌린다. HEAD 요청에는 `ONNX_WASM_PROBE_TIMEOUT`(4초) 제한이 붙어, 응답 없는 네트워크에서 목록이 미확정으로 남지 않는다. 페이지가 `ort.env.wasm.wasmPaths`를 직접 지정했다면 그 설정을 존중해 확인도 하지 않고 그대로 둔다.
- **필요한 파일**: `src/js/`에 `ort.all.min.js`와 함께 `ort-wasm-simd-threaded.jsep.mjs`가 있어야 하고, `ort-wasm-simd-threaded.jsep.wasm`은 오프라인·CDN 차단 환경을 위한 예비로 둔다. 런타임이 `.mjs`를 먼저 불러오고 그 `.mjs`가 `.wasm`을 받아 오는 구조라 글루는 빠질 수 없다. **정적 서버는 HEAD 요청을 반드시 받아야 한다.** 예전에 `python/pythonserver.py`가 HEAD에 501을 돌려줘 파이썬 서버로 구동할 때만 플라우로스가 사라질 뻔했고, 지금은 `do_HEAD()`가 GET과 같은 라우팅을 거친 뒤 본문 없이 헤더만 보낸다(파일을 읽지 않고 `stat()` 크기만 쓴다). 이 파일들을 직접 서빙할 때는 Content-Type도 맞아야 한다. 이 파일들을 직접 서빙할 때는 Content-Type도 맞아야 한다. `nodeserver.js`는 확장자 switch 문으로, `python/pythonserver.py`는 `STATIC_CONTENT_TYPES` 표와 `resolve_static_content_type()`으로 같은 값을 내려보낸다. 파이썬은 예전에 `mimetypes.guess_type()`만 썼는데, 이 함수가 Windows에서는 레지스트리를 함께 읽어 PC마다 결과가 달라진다. 실제로 `.mjs`가 `text/plain`으로 나가 브라우저가 wasm 글루 모듈을 거부한 적이 있어, 게임 구동에 필요한 확장자는 표에 못박아 두고 표에 없는 확장자만 `mimetypes`로 넘긴다. 서빙할 파일 종류를 늘릴 때는 두 서버의 표를 함께 고친다.
- **세션 로그를 error로 낮춘 이유**: `lngui.py`가 내보낸 그래프는 `ValueNetwork.forward()`의 마지막 `reshape(-1)` 때문에 출력 축이 1로 추론되어, 여러 후보를 한 배치로 넣을 때마다 `Expected shape from model of {1}` 경고가 매 턴 쌓인다. 출력 값 자체는 후보 수만큼 정상이고 길이도 검증하므로 `logSeverityLevel: 3`으로 이 경고만 가린다.
- **학습 상대에서는 제외한다**: ONNX 추론 적은 `python/bundledenemy.py`의 `ENEMY_FACTORIES`/`TRAINABLE_ENEMY_TYPES`에 넣지 않는다. 학습 중인 모델과 별개의 모델을 파이썬에서 또 돌려야 하기 때문이며, 앞으로 추가되는 ONNX 적도 같은 이유로 넣지 않는다.

#### 학습형 적이 브라우저를 멈추는 현상 수정 (2026-09-11, BUILDNO 49)

- **재현된 원인은 프런트엔드 배치 검사의 동기 무한 반복이다.** 이전 점검의 '무한 루프는 확인되지 않았다'는 결론은 아래 필드를 검사하지 못한 결과였으며, 서버 요청 누적을 이번 정지의 원인으로 확정하면 안 된다.
- `Solomon.canUsePlacement()`와 `OnnxEnemy.canUsePlacement()`에 복제되어 있던 회전 반복은 회전 실패 시 수평 킥과 180도 뒤집기를 시도하지만, 뒤집기에 성공하더라도 목표에 가까워진다는 보장이 없었다. 예를 들어 25×6 보드에서 열 1의 Y=0..10, 열 3의 Y=0..11을 채우고 조작 뿌요를 `{x:2,y:11.9,rotation:0}`으로 두면, 착지 자체는 가능한 `{x:2,rotation:2}` 검사 중 `회전 0 → 왼쪽 킥(X=1, 회전 1) → 회전 3 → 회전 1 → …`이 끝없이 반복된다. 수정 전 두 클래스 모두 VM 실행 제한 300ms를 넘기는 것으로 재현했다.
- 이 검사는 브라우저 메인 스레드에서 실행한다. Local AI 솔로몬의 요청 후보 생성과 ONNX 적의 추론 후보 생성 단계에서 모델 호출 전에 멈출 수 있고, 솔로몬 응답 검증에도 같은 코드가 사용된다. 따라서 서버에서 추론하거나 ONNX Worker·타이머를 사용해도 이 루프는 중단되지 않는다. 화면·입력·타이머 처리를 막고 임시 객체를 반복 생성하므로, 메모리 문제처럼 보일 수 있지만 이 재현은 모델 로딩이나 서버 없이도 발생한다.
- 두 클래스는 이제 공통 `canUseAiPlacement()`를 사용한다. 현재 뿌요와 목표의 좌표를 검증하고, 회전 중 방문한 `(X, 회전)`을 기록해 같은 상태를 다시 만나면 해당 후보를 거부한다. 검사 중 보드와 Y는 고정되며 가능한 회전 상태는 최대 `COLUMNS * 4`개다. X가 달라지는 킥을 잘못 거부하지 않도록 회전값만 기록하지 않는다. 가로 이동 우선·90도 회전·수평 킥·180도 뒤집기·최종 X 일치 판정은 유지한다.
- `tests/test03_ai.spec.js`에 두 클래스의 순환 필드·나머지 후보 반환·원본 상태 보존·정상 이동/뒤집기·막힌 이동/킥·잘못된 좌표·고정 수열로 만든 1,000개 필드 검사를 추가했다. 실제 소스를 VM에서 실행하고 제한 시간을 걸어, 회귀 시 테스트 프로세스까지 무한 반복하지 않게 한다. 솔로몬은 VM 내부에서만 노출하며 공개 API에는 추가하지 않는다.
- 검증: 배치 검사 10개와 기존 솔로몬/ONNX 대전 5개를 Chromium에서 통과했다(실제 Node Local AI 끝까지 대전 포함). 별도로 Chromium·Firefox·WebKit에서 원본 JS와 빌드 번들 각각에 순환 필드를 넣어 후보 검사 후 `requestAnimationFrame`·새로고침이 완료되는 6개 테스트도 통과했다. `puyow.html` 기본값은 원본 JS이므로 번들 테스트는 원본 스크립트 응답만 실제 빌드 산출물로 교체한다. ESLint와 webpack 빌드를 통과했고 번들을 갱신했다. 버전값 자체는 테스트하지 않았다.
- 이전에 언급한 서버 취소 전파/동시 실행 상한, 학습 요청 큐의 제한 시간, ONNX Worker 장애는 별도로 계측할 안정성 점검 대상이지 이번 재현의 전제나 확정 원인이 아니다. 이번 수정은 확인된 공통 무한 반복을 제거하며 서버/API 동작은 변경하지 않는다. 장시간 실제 플레이에서 다른 종류의 정지가 없는지는 별도 확인이 필요하다.

#### ONNX 추론 적의 실시간 재추론 (2026-09-18, BUILDNO 87)

사용자 요청으로 모델을 쓰는 적도 안드레알푸스처럼 실시간 반응하게 했다(조사 때 "수정 방법 A"라 부른 안). 당시에는 **학습 쪽과 모델 입력 계약(528개, `MODEL_VERSION` 3)을 바꾸지 않고 `OnnxEnemy`만** 고쳤다. **BUILDNO 90에서 근본 해결("수정 방법 B")을 구현해 아래 내용 중 입력 계약 부분은 이미 대체되었다**(바로 아래 「학습 환경부터 실시간 반응 도입 — 모델 버전 4」 절 참고). 재추론이 언제 일어나고 실패하면 어떻게 되는지는 그대로이므로, 그 흐름을 볼 때만 이 절을 읽는다.

- **바꾸기 전 문제**: 게임은 상대 연쇄가 **끝난 뒤**에야 `deliverFinalAttackEnergy()` → `applyAttackDamage()`로 `player.damage`를 늘린다. 이전 `buildAfterstate()`는 받을 피해에 `player.damage`만 넣었으므로 상대가 대연쇄를 치는 중이어도 0으로 보았다. 추론도 `prepareTurn()`에서 턴마다 한 번뿐이었다.
- **입력**(BUILDNO 90에서 대체됨): 당시 `buildAfterstate()`의 세 번째 인수는 일반 필드의 받을 피해 하나였고, 거기에 상대 연쇄 예측을 합산해 넣었다. 지금은 `getModelIncomingState()`가 만든 상태 객체를 넘기며, 확정 DAMAGE와 예측 공격을 따로 담는다.
- **받을 양**: `getRealtimeIncomingDamage(player, forecast)`는 `getRealtimeGarbageForecast()` 결과를 모델이 배운 의미("이번에 터뜨리지 않으면 떨어질 양")에 맞춘다. 기본 룰은 `max(player.damage, floor(forecast.incoming))`(확정 DAMAGE + 진행 중 상대 연쇄의 예측 최종 ATTACK)다. 피버 룰 일반 상태는 `forecast.fever.events` 중 `availableMove <= 0`인 묶음만 더한다. 아직 시작하지 않은 상대 피버 패턴 예측 연쇄는 지금 상쇄할 수 없으므로 뺀다. 도착 순번(`garbageMoveIndex`·`landMove`)은 v3 입력에 자리가 없어 버린다.
- **흐름**: `prepareTurn()`은 `isRealtimeReactionActive()`(`realtimeReaction`·`onnxEnabled`·연속 피버 아님·자신이 피버 아님)이면 첫 추론부터 이 양을 넣는다. 이때 `realtimeReactionState = { turn(placedPairCount), signature, incoming, fastDownStarted, replanCount }`를 만든다. `updateControl()`은 `decisionState === 'ready'`일 때 매 프레임 `updateRealtimeReaction()`을 부른다. 비교값 `getRealtimeReactionSignature()`는 "받을 양 | 상대 연쇄 진행 | 상대 피버 예측 연쇄 수:ATTACK"이다. 바뀌면 기준을 갱신하고, 바뀌기 전후 모두 `getRealtimeIgnorableIncomingGarbage()`(기본 룰 `ignorableIncomingGarbage` 4, 피버 룰 1) 미만이면 여기서 멈춘다. 그 밖에는 `getReachableAiPlacements()`로 `aiSimulations`를 걸러 다시 추론한다. `useFastDown()`이 처음 true를 돌려주면 `fastDownStarted`를 세우며, 그 뒤로는 재추론하지 않는다(안드레알푸스와 같은 사용자 요구). 재추론 중에는 `decisionState`가 `pending`이라 이동·회전·빠른 하강 없이 자연 낙하만 한다.
- **턴 판별 주의**: `moveActive()`·회전은 `player.active`를 **새 객체로 바꾸므로**, 조작 도중에는 `isCurrentTurn()`(`turnActive` 동일성)이 거짓이다. 그래서 `updateRealtimeReaction()`은 배치 수(`state.turn`)·`turnPlayer`·`controller`·`phase`로 판별한다. 재추론을 시작할 때는 `turnActive`를 현재 객체로 갱신한다. 자연 낙하는 같은 객체의 `y`만 고치므로 결과가 올 때까지 동일성이 유지된다.
- **실패 처리**: `startInference(player, options)`가 마감 시한 타이머와 `decidePlacement(player, token, options)`를 묶는다. 첫 추론은 기존처럼 실패·세션 사용 중·마감 초과 시 `applyFallback()`(앞 1수 시뮬레이션)을 쓴다. 재추론(`options.replan`)은 같은 경우에 `restoreReplanTarget()`으로 **직전 배치를 유지**하고, 직전 배치에 더는 도달할 수 없을 때만 `applyFallback()`을 쓴다. 재추론 성공은 `aiDecisionElapsed`·`fastDownElapsed`를 되돌리지 않는다.
- **한계**: v3 모델은 받을 피해를 "다음 비연쇄 배치 뒤 떨어지는 확정 양"으로만 배웠다. 예측량을 넣는 것은 근사이고, 몇 수 뒤에 도착하는지는 모른다. 실제 대응 품질은 대전으로 따로 확인해야 한다.
- **솔로몬(Local AI)은 바꾸지 않았다.** 서버 왕복이라 재요청 비용이 크고 이번 범위 밖이다. 넓힌다면 프롬프트의 `currentState.incomingDamage`에 같은 값을 넣고 같은 재요청 흐름을 붙이면 된다(서버·모델 변경 없음).
- 회귀 테스트는 `tests/test03_ai.spec.js`의 "ONNX 추론 적은 빠른 하강 전에 받을 방해뿌요가 바뀌면 그 양을 넣어 다시 추론하고…"다. 발라크 하위 클래스를 등록해 실제 `model01.onnx`로 대전한다. 결과가 준비된 뒤 DAMAGE를 12로 늘려 재추론 시작·`pending`·`replanCount` +1을 확인하고, 재추론 입력의 받을 피해량(관측값 516번 × 30)이 12 이상인지 본다. 빠른 하강을 시작한 턴에서는 재추론하지 않는지도 확인한다. 검증 결과: `test03_ai.spec.js` 43개, ONNX 관련 `test01_core`·`test01_enemy`·`test01_menu` 8개가 Chromium에서 통과했고 ESLint(`npm.cmd test`)·`node --check`·`git diff --check`를 통과했다. 실제 사람 대전에서 상대 연쇄 중 재추론이 나은 판단을 내는지는 측정하지 않았다.

### 학습 환경부터 실시간 반응 도입 — 모델 버전 4 ("수정 방법 B", BUILDNO 90에서 완료)

2026-09-18 조사에서 "언젠간 적용해야 한다"고 했던 안을 BUILDNO 90에서 구현했다. BUILDNO 87의 재추론은 입력 계약을 지키느라 "받을 양"만 근사로 넣었지만, 이제 모델이 상대 필드와 "상대 연쇄 진행 중", "몇 수 뒤 도착"을 직접 보고 배운다.

**사용자가 정한 것**
- 관측에 **상대 보드 전체(504개)까지** 넣는다(스칼라 3개만 넣는 추천안보다 넓은 쪽).
- 학습 환경의 시간 모델은 게임 `estimateAiPlacementTiming()`을 옮긴 높이 기반 어림을 쓴다.
- **기존 버전 3 모델과의 호환성은 포기하고 처음부터 다시 학습한다.** 그래서 이중 계약(v3/v4 동시 지원)도, v3 가중치 이식(`--warm-start-from`)도 만들지 않았다.
- 보상(`move_reward`·`terminal_reward`)과 감가율(`DISCOUNT_GAMMA` 0.70)은 바꾸지 않았다.

**관측 계약 v4 (`python/common.py`)**
- `OBSERVATION_SIZE` 528 → **1035**, `OBSERVATION_SCALAR_COUNT` 14 → **17**, `MODEL_VERSION` 3 → **4**.
- 구간 순서는 자기 보드 504 → 상대 보드 504 → 현재 쌍 10 → 스칼라 17이다. `OBSERVATION_BOARD_SIZE`(504)·`OBSERVATION_BOARD_COUNT`(2)·`OBSERVATION_BOARDS_SIZE`(1008)로 경계를 한 곳에서 정의한다.
- 새 스칼라 세 개는 기존 14개 **뒤에** 붙였다. `incoming_in_flight`(`DAMAGE_SCALE` 30), `incoming_land_move`(새 상수 `LAND_MOVE_SCALE` 8), `opponent_chain_active`(0/1)다.
- `encode_observation_values()`에 기본값 있는 키워드 인수(`opponent_board`, `incoming_in_flight`, `incoming_land_move`, `opponent_chain_active`)를 더했다. 상대 보드를 주지 않으면 빈 보드로 인코딩한다(단일 플레이어 환경·예전 형식 요청).
- `decode_observation_board(observation, board_index)`에 보드 번호를 받는 인수를 더하고, `decode_observation_opponent_board()`를 추가했다. `is_legal_observation_action()`은 자기 보드가 0번이라 그대로 동작한다.

**시간 모델 (`python/bundledenemy.py`)**
- puyow.js의 연출·조작 시간 상수를 그대로 옮겼다: `CHAIN_PHASE_WAIT_MS`(150), `EXPLOSION_EFFECT_DURATION_MS`(430), `LOCK_TO_GARBAGE_DROP_MS`(300), `LOCK_TO_NEXT_CONTROL_MS`(450), `PLAYER_FALL_INTERVAL`(2048), `FAST_DOWN_FALL_INTERVAL`(55), `ACTIVE_PUYO_SPAWN_Y`(11.9), `FEVER_GRAVITY_SPEED_MULTIPLIER`(1.5). **puyow.js 쪽을 고치면 여기도 함께 고쳐야 한다.**
- `estimate_placement_ms(board, elapsed_ms, fast_down_delay_ms)`는 `estimateAiPlacementTiming()`의 nextPlacementMs에서 고정 후 대기를 뺀 "스폰 → 착지" 시간이다. 평균 열 높이를 쓰는 어림도 게임과 같다.
- `measure_gravity_duration()`은 `measureGravityOnBoard()`의 duration과 같은 식이다.
- `resolve_placement_timeline(board, colors, positions, gravity_multiplier)`는 `resolve_placement()`와 같은 결과에 더해 단계별 `ChainStep(combo, attack, explode_ms)`과 `end_ms`를 돌려준다. 시간 계산은 `predictPlayerChain()`과 같다. 기존 `resolve_placement()`의 반환값은 그대로 두었다.

**실시간 대전 환경 (`python/learning.py`의 `PuyoDuelEnvironment`)**
- 턴제를 버리고 **최소 힙 하나로 굴러가는 이벤트 시뮬레이션**이 됐다. 사건은 `(시각, 종류, 일련번호, 쪽, 부가정보)`이며 종류 번호가 곧 같은 시각의 처리 우선순위다: `EVENT_CHAIN_STEP`(0) → `EVENT_CHAIN_END`(1) → `EVENT_SETTLE`(2) → `EVENT_LAND`(3) → `EVENT_SPAWN`(4).
- `step(action)` 계약은 그대로 "에이전트의 결정 한 번 = step 한 번"이다. `step()`은 착지를 예약한 뒤 `_run_until_agent_decision()`으로 에이전트의 다음 스폰까지 진행한다. 그 사이 상대는 여러 번 둘 수도, 한 번도 두지 않을 수도 있다. 그래서 `build_value_samples()`·n스텝·리플레이·`TrainingStrategy`는 그대로 동작한다.
- 한 수의 흐름: 결정(스폰) → `estimate_placement_ms()` 뒤 `EVENT_LAND` → 연쇄가 있으면 단계마다 `EVENT_CHAIN_STEP`, 끝에 `EVENT_CHAIN_END`, 그 뒤 `LOCK_TO_NEXT_CONTROL_MS` 뒤 다음 스폰 / 연쇄가 없으면 `LOCK_TO_GARBAGE_DROP_MS` 뒤 `EVENT_SETTLE`(방해뿌요 낙하·다음 쌍·피버 갱신)과 `LOCK_TO_NEXT_CONTROL_MS` 뒤 다음 스폰.
- **상쇄는 연쇄 단계마다 한다**(`_cancel_attack()`, 게임 `sendAttackEnergy()`와 같은 순서). 피버 중이면 피버 DAMAGE → 보존된 일반 DAMAGE → 상대의 진행 중 공격, 그 밖에는 상대의 진행 중 공격 → 자기 DAMAGE다. 상쇄가 한 번이라도 일어나면 피버 전등을 등록한다(원작도 상대 ATTACK만 지운 경우를 포함한다). 남은 양은 `in_flight[side]`(게임의 `player.attack`)에 쌓이고, `EVENT_CHAIN_END`에서야 상대 DAMAGE가 된다.
- 단계별 ATTACK은 누적 실수의 정수부 증가분으로 보낸다(`generated`/`sent`). 피버 최소 ATTACK 1 보정과 싹쓸이 티켓 보정으로 늘어난 양은 마지막 단계에 붙여 단계 합이 보정 뒤 총량과 같게 한다.
- 관측의 새 스칼라는 `_predicted_in_flight()`(이미 보낸 미상쇄분 + 아직 터지지 않은 단계의 ATTACK)와 `_estimate_incoming_land_move()`가 만든다. land move 규칙: 받을 것이 없거나 **확정 DAMAGE가 1 이상이면 0**(다음 비연쇄 배치 직후에 떨어진다), 그 밖에는 상대 연쇄 종료 시각으로 `ceil((종료 − 첫 낙하 시각) / 배치 한 번 시간)`이다. **JS `getModelIncomingState()`와 node 서버가 같은 규칙을 쓴다.**
- `_advance_clock()`이 경과 시간·마진 레이트·시간 배율·피버 남은 시간을 실제 흐른 시간으로 갱신한다. `DUEL_TURN_DURATION_MS`는 단일 플레이어 환경(`PuyoEnvironment`)의 시간 환산 보조값으로만 남았다.
- 배치 속도(AI 난이도)는 `AI_FAST_DOWN_DELAYS`(None·1500·300·100)에서 에피소드마다 뽑는다. 적별 `normalFastDownDelayRate`는 재현하지 않아 양쪽 모두 배율 1이다.
- 탑재 적 AI의 판단은 바꾸지 않았고, 실시간 정보는 `decide()`의 `incoming_garbage`(확정 DAMAGE + 상대가 지금 만들고 있는 공격, 원작 `getLookaheadIncomingGarbage()`와 같은 뜻)로만 전달한다. `suggest_agent_action()`의 안내 적도 같은 값을 받는다.
- 환경 역학이 바뀌었으므로 **이전 학습 결과와 같은 난수열은 재현되지 않는다.** `standard` 학습 방식의 `strategy_random` 분리 원칙은 그대로다.
- 방어적 상한 `MAX_EVENTS_PER_DECISION`(4096)을 넘으면 그 에피소드를 `timeout`으로 끝낸다. 정상 대전에서는 수십 건이다.

**추론 쪽**
- `src/js/puyow.js`: `ONNX_OBSERVATION_SIZE`가 `ONNX_OBSERVATION_BOARD_SIZE * ONNX_OBSERVATION_BOARD_COUNT + 색 10 + ONNX_OBSERVATION_SCALAR_COUNT(17)`로 바뀌었다. `buildObservationValues()`가 보드 두 장과 새 스칼라를 인코딩하고, `getModelIncomingState()`가 실시간 상태를 한 곳에서 만든다. `OnnxEnemy.buildAfterstate(player, simulation, incoming)`의 세 번째 인수는 이제 그 상태 객체이고, 재추론 흐름(`startInference({ incoming, ... })`)도 같은 객체를 넘긴다. 재추론 판단 기준(`getRealtimeReactionSignature()`)에는 받을 양·도착 순번·연쇄 진행에 더해 상대 피버 패턴 예측을 그대로 남겼다(입력이 아니라 방아쇠다).
- 솔로몬 프롬프트에 `opponentField`가 생기고 `currentState`에 `incomingInFlight`·`incomingLandMove`·`opponentChainActive`가 붙었다. `incomingDamage`는 이제 확정 DAMAGE다.
- `node/server.js`: 관측 상수·인코딩·디코딩·애프터스테이트를 v4로 맞추고, 프롬프트의 `opponentField`를 읽는다. **이때 `OBSERVATION_SCALES.timeMultiplierLog2`가 10으로 적혀 있던 기존 오류(common.py는 12)를 함께 고쳤다.**
- `python/pythonserver.py`: `build_prompt_board()`를 분리해 `currentField`·`opponentField`를 같은 방식으로 읽고, 새 `currentState` 항목을 관측에 넘긴다. `choose_model_action()`·`build_solomon_afterstate()`는 `learning`의 함수를 그대로 쓰므로 자동으로 따라온다.
- `lngui.py`·`convertonnx.py`는 `learning.OBSERVATION_SIZE`로 예시 입력을 만들어 코드 변경이 없었다.

**기존 모델 파일**
- `src/onnx/model01~03.onnx`·`default.onnx`는 입력이 528개라 v4에서 쓸 수 없다. **파일은 그대로 두었다.** 다시 학습해 내보내기 전까지 브라우저 ONNX 적(발라크·자간·바퓰라 및 출시 예정 오리아스~푸르카스)은 `isSessionObservationCompatible()` 검사에 걸려 기존 시뮬레이션 AI로 대전하고, Node 서버 Local AI는 추론에 실패한다.
- `python/puyow/default.pt`·`model02.pt`도 `load_existing_policy()`의 버전 검증에서 거부된다(의도된 동작).
- 그래서 `tests/test03_ai.spec.js`의 ONNX·Local AI 관련 5개 테스트는 v4 모델을 새로 학습해 넣을 때까지 실패한다. 나머지 38개는 통과한다.

**검증 결과**
- `python -B -m unittest test_learning`: 160개 통과(1개는 Tk 없는 환경 건너뜀). 새로 더한 것은 v4 관측 계약, 연쇄 타임라인, 실시간 대전의 상쇄·전달·관측 시점, 애프터스테이트의 새 스칼라 갱신과 결정성, 버전 3 체크포인트 거부, `node/server.js` 인코딩과 `common.py`의 값 단위 비교다.
- `npm.cmd test`(ESLint), `node --check src/js/puyow.js`, `node --check node/server.js` 통과.
- `npx.cmd playwright test --project=chromium tests/test03_ai.spec.js`: 38개 통과, 위에 적은 5개 실패(모델 파일 문제).
- 실제 대전에서 v4 모델이 상대 연쇄에 얼마나 잘 대응하는지는 **아직 측정하지 않았다.** 새 모델을 학습한 뒤 승률로 확인해야 한다.

### Local AI 서버에 보내는 배치 후보 목록

서버의 `is_legal_observation_action()`은 관측 벡터에 담긴 **화면 12줄의 목적지 열 높이**만 본다. 반면 게임의 `Solomon.canUsePlacement()`는 뿌요의 현재 낙하 Y에서의 가로 이동 경로, 회전 킥으로 X가 밀리는지, 숨김 행까지 포함한 25줄 보드의 `aiSimulations` 포함 여부를 함께 본다. 그래서 필드가 높아지면 서버가 "합법"이라고 답한 배치를 게임이 거부해 `handleRequestFailure()`로 일시정지되는 일이 생겼다.

이를 막기 위해 AI 제공자가 `Local AI`일 때만 `Solomon.getUsablePlacements()`가 `player.aiSimulations`를 응답 검증과 **같은 `canUsePlacement()`로 걸러** `usablePlacements`(`{x, rotation}` 배열)로 프롬프트에 함께 보낸다. 서버의 `parse_usable_actions()`가 이를 행동 번호 집합으로 바꾸고, `choose_model_action()`은 이 목록이 오면 관측값의 높이 조건 대신 **그 목록 안에서만** 가치가 가장 높은 배치를 고른다. 목록을 보내지 않는 요청(다른 제공자·예전 클라이언트)에서는 기존 높이 조건을 그대로 쓴다. 스폰 상태 `{x:2, rotation:0}`은 항상 이 목록에 들어가므로 목록이 비는 일은 사실상 없지만, 비면 항목 자체를 넣지 않아 기존 동작으로 되돌아간다. 화면 12줄만으로는 어떤 후보도 착지시킬 수 없어 애프터스테이트를 만들지 못한 경우에는, 목록이 왔다면 그중 가장 작은 행동 번호를 돌려주어 게임이 대체 AI로 넘어가지 않게 한다.

`SOLOMON_PLACEMENT_JSON_SCHEMA`(응답 형식)는 바꾸지 않았다. 이 항목은 요청 프롬프트에만 추가된다.

### Node 서버의 Local AI (`node/server.js`)

`npm start`로 띄우는 `nodeserver.js`도 파이썬 서버와 같은 `/apis/localmodelinfo`·`/v1/chat/completions` 계약을 제공한다. 게임 소스는 바꾸지 않았고 서버만 구현했으므로, 게임 쪽 Local AI 동작(고정 URL·키·모델명, 솔로몬 해금, `usablePlacements`)은 서버 종류와 무관하게 같다.

- **모델과 런타임**: `.pt` 대신 `LOCAL_AI_MODEL_PATH`(`src/onnx/default.onnx`) 상수가 가리키는 ONNX 가치망을 `package.json` `dependencies`의 `onnxruntime-node`(CPU 실행 제공자)로 추론한다. 처음에는 게임 페이지의 `src/js/ort.all.min.js`(ONNX Runtime Web)를 Node에서 불러 썼으나 사용자 요청으로 바꿨다. 네이티브 세션은 `run()`을 동시에 불러도 되므로 예전의 추론 대기열은 없앴다.
- **모델 서비스가 없어도 서버는 그대로 돈다**: `onnxruntime-node`와 `puyow.js`는 모듈 최상단이 아니라 `getLocalAiSession()` 안에서 처음 필요할 때 `require()`한다. `/apis/localmodelinfo`와 `/v1/chat/completions`는 요청마다 먼저 `isLocalAiModelConfigured()`로 `LOCAL_AI_MODEL_PATH`가 실제 파일인지 보고, 없으면 세션을 만들지 않고 각각 `{available:false}`·404를 돌려준다(한 번 만든 세션이 있어도 파일이 사라지면 같다). 파일은 있는데 런타임 로드·세션 생성이 실패하면 `localmodelinfo`는 false, 모델 요청은 503이고, 실패한 약속은 비워 다음 요청에서 다시 시도한다. 정적 파일·`/apis/learning`·`/apis/solomonlearning`은 모델 상태와 무관하다.
- **선택 규칙은 파이썬 서버와 같다**: 프롬프트 → `common.py`와 같은 1035개 관측 벡터(자기 필드 + `opponentField`) → 다시 보드·쌍·스칼라로 디코딩(정규화 상한에서 잘린 값까지 파이썬과 같게 하려고 일부러 되돌린다) → 후보 행동마다 `learning.py _build_afterstate()`와 같은 순서로 ATTACK·싹쓸이 티켓·피버 보정을 적용한 애프터스테이트 → 한 번의 배치 추론으로 `보상 + 0.70 × 가치`가 가장 큰 행동. `usablePlacements`가 오면 그 후보만, 없으면 관측값 열 높이로 거른 24개 행동을 본다. 착지 좌표는 `bundledenemy.py find_landing_placement()`처럼 각 칸을 자기 열 높이 위에 둔다. 보상은 파이썬처럼 보정 뒤 ATTACK으로 계산한다(브라우저 `OnnxEnemy`는 보정 전 ATTACK을 쓴다).
- **관측 인코딩은 서버에 옮겨 적었다**: `puyow.js`의 `buildObservationValues()`는 공개 API가 아니라 `require()`로 가져올 수 없어서 `encodeObservationValues()`·`decode*()`를 `common.py`에서 그대로 옮겼다. `common.py`의 스케일 상수나 채널 순서를 바꾸면 `nodeserver.js`의 `OBSERVATION_SCALES` 등도 함께 고친다. 두 구현이 어긋나기 쉬워, `test_learning.py`의 `NodeServerObservationParityTest`가 같은 상태를 두 구현으로 인코딩해 값 하나까지 비교한다(Node.js가 없으면 건너뛴다).
- **착지 뒤 연쇄 계산은 게임 코어를 재사용한다**: `require('src/js/puyow.js').common`의 `simulatePlacementResult()`·`isAllClearBoard()`를 쓴다(Node에서도 DOM 없이 불러와진다). 이 함수의 ATTACK은 진행 중인 게임이 없으면 마진 레이트 70·시간 배율 1로 계산되므로, 서버가 `× 70 / 관측 마진 레이트 × 관측 시간 배율`로 환산한다(ATTACK은 이 두 값에 선형이다). 넘기는 보드는 `GAME_BOARD_ROWS`(25) 행이며 숨김 행은 비운다.
- **인증**: 파이썬 `is_learning_authorized()`와 같이 루프백 소켓 주소에서 보낸 `Bearer localhost`는 허용하고, 그 밖에는 기존 `PUYOW_AI_TOKEN`과 비교한다. 이 규칙은 `/v1/chat/completions`에만 쓰며 기존 `/apis/learning` 인증은 바꾸지 않았다. `X-Forwarded-For`는 위조할 수 있으므로 보지 않는다.
- **역학습은 구현하지 않는다**: `/apis/solomonlearning`은 본문을 처리하지 않고 `{ok:true, trained:false, transitions:0, reason}`만 돌려준다. 게임은 `ok`가 true가 아니면 콘솔 오류를 남기므로 `ok`는 true여야 한다. 프롬프트의 `learningSessionId`도 무시한다.
- **오류 응답**: 모델 파일이 없으면 `/v1/chat/completions`만 404, 인증 실패 401, POST 외 405, 형식 오류 400, 모델 로드·추론 실패 503, 둘 곳이 없으면 422이며 본문은 `{error:{message,type}}`다.
- 회귀 테스트는 `test03_ai.spec.js`의 `Node 서버는 default.onnx로 …`(서버 API를 직접 호출), `Node 서버는 Local AI 모델 파일이 없으면 …`(`nodeserver.js`만 임시 폴더에 복사해 포트 `9950 + workerIndex`로 따로 띄우고 `available:false`·404와 나머지 API 정상 동작을 확인), `Node 서버의 Local AI로 극한 난이도 솔로몬과 끝까지 대전해도 …`(흉내 낸 응답 없이 실제 대전)다. 뒤쪽은 공통 준비의 `localmodelinfo` 고정 응답을 `route.continue()`로 걷고 실제 서버 응답을 쓴다. 두 테스트는 Playwright가 재사용하는 9891 서버가 `nodeserver.js`라고 가정한다.

### 솔로몬 온라인 학습 (Local AI + 극한 난이도)

AI 제공자가 `Local AI`이고, 극한 AI 난이도로 적 `솔로몬`과 대전하며, 설정의 `역으로 모델 학습`(`store.settings.reverseLearning`)이 켜져 있을 때만(색상 수·룰은 가리지 않는다) 그 대전에서 나온 수로 로컬 서버의 모델을 추가 학습한다. 판정 함수는 `shouldTrainLocalAiWithSolomon()`이며 `game.players[1].controller`가 솔로몬인지, `isReverseLearningEnabled()`가 켜져 있는지까지 확인하므로, 연습·퍼즐·구경처럼 솔로몬이 나올 수 없는 모드와 이 설정을 꺼 둔 대전은 자연히 제외된다. 이미 끝난 대전을 다시 보여 줄 뿐인 리플레이 재생(`game.replayPlayback`)도 제외한다.

`역으로 모델 학습`은 솔로몬 자신의 수로 하는 학습을 포함해 이 온라인 학습 기능 전체를 켜고 끈다(체크박스 이름의 "역으로"는 `learning.py`로 하는 평소의 오프라인 일괄 학습과 반대로, 실제 서비스 중인 모델을 대전 도중 그 자리에서 갱신한다는 뜻이다). 이 설정이 꺼져 있으면 `shouldTrainLocalAiWithSolomon()`이 곧바로 `false`를 반환하므로 `getSolomonLearningSessionId()`가 세션 ID 자체를 만들지 않는다. 그 결과 솔로몬 배치 프롬프트에 `learningSessionId`가 실리지 않아 서버가 그 수를 학습 세션에 쌓지 않고, 대전이 끝나도 `requestSolomonLearningFinish()`가 아예 호출되지 않아 `/apis/solomonlearning`으로 어떤 요청도 나가지 않는다.

- `getSolomonLearningSessionId()`가 대전마다 `solomon-<시각>-<난수>` 세션 ID를 만들어 `game.solomonLearningSessionId`에 보관하고, `Solomon.buildPlacementPrompt()`가 이 값을 프롬프트의 `learningSessionId` 항목으로 함께 보낸다. 학습 대상이 아니면 이 항목 자체를 넣지 않으므로 다른 제공자·난이도의 프롬프트는 기존과 완전히 같다.
- 서버의 `chat_completions_api()`는 `learningSessionId`가 있는 배치 요청마다 `record_solomon_step()`으로 이번 수의 애프터스테이트와 즉시 보상을 세션에 순서대로 담아 둔다. 애프터스테이트는 학습기의 `build_afterstate()`를 그대로 호출해 만들므로 오프라인 학습과 형식·보상 계약이 같다.
- 위험 높이·응답 오류로 솔로몬이 대체 AI를 쓴 턴은 요청이 오지 않는다. 관측값의 `placedPairCount`가 두 턴 이상 건너뛴 수는 `linked`가 false로 기록되고, 그 앞 수는 다음 상태를 알 수 없으므로 표본으로 만들지 않는다.
- 학습은 매 수마다 하지 않고, 승패가 확정되어 결과 화면으로 넘어가는 `updateDefeatSequence()` 시점에 `requestSolomonLearningFinish()`가 `POST /apis/solomonlearning`(`{event:'finish', sessionId, result}`)을 한 번 보낼 때 수행한다. `result`는 학습 대상인 **솔로몬 기준**의 `win`/`loss`/`draw`다. 이 요청이 실패해도 게임 진행에는 영향을 주지 않는다.
- `finish_solomon_session()`은 `_close_solomon_side()`로 양쪽의 수를 학습 표본으로 바꾼 뒤 `train_solomon_samples()`를 호출한다. 한 수의 목표값은 `다음 수의 보상 + 감가된 다음 애프터스테이트의 가치`이고, 대전의 마지막 수는 더 진행할 상태가 없어 승패 보상(`WIN_REWARD`/`LOSS_REWARD`)만 목표가 된다. 목표값은 갱신 전 가중치로 한 번만 계산하고(별도 target 네트워크 대신), `learning.train()`과 같은 학습률 `1e-3`·감가율 `DISCOUNT_GAMMA`·smooth L1 손실·그래디언트 노름 1.0 클리핑을 사용한다.

#### 사람이 이긴 대전의 수순 학습

같은 대전에서 **사람이 조작한 플레이어 쪽 수**도 함께 모아 두었다가, 사람이 이겼을 때만 "모델이 플레이어 쪽을 조작해 이긴 수순"으로 보고 함께 학습한다. 관측 벡터(1035개)와 행동 번호(`열*4+회전`)는 어느 쪽이 두었는지 구분하는 값이 없는 자기중심 표현이므로(상대 보드도 "내 상대의 보드" 자리이므로 양쪽 모두 같은 형식이다), 사람의 수도 솔로몬의 수와 같은 전이 구조로 그대로 쓸 수 있다.

이 하위 기능도 위 절의 `역으로 모델 학습` 설정 하나로 온라인 학습 전체와 함께 켜지고 꺼진다. 별도의 조건 분기는 없으며, `sendSolomonPlayerLearningStep()`이 부르는 `getSolomonLearningSessionId()`가 `shouldTrainLocalAiWithSolomon()`을 그대로 재사용하기 때문이다.

- `lockActive()`에서 사람이 뿌요를 확정할 때마다 `sendSolomonPlayerLearningStep()`이 `POST /apis/solomonlearning`(`{event:'step', sessionId, observation, action, nextPair}`)을 보낸다. 관측은 기존 `/apis/learning` 경로와 같은 `getLearningObservation()`으로 만들며, 배치 직전(=`placedPairCount` 증가 전) 상태라서 솔로몬 프롬프트와 시점 계약이 같다. `nextPair`는 `player.nextPairs[0]`이고 서버가 애프터스테이트의 조작 쌍 자리에 넣는다(솔로몬 프롬프트의 `suppliedPuyos` `next_1`과 같은 값이다). 항목이 없으면 서버는 색을 비운 쌍으로 본다.
- 솔로몬 학습 요청은 모두 `queueSolomonLearningRequest()`의 단일 Promise 큐로 보낸다. 서버가 앞 요청의 관측값을 그 수의 다음 상태로 이어 붙이므로 순서가 뒤바뀌면 안 되고, `finish`는 반드시 그 대전의 마지막 `step` 뒤에 도착해야 한다.
- 서버 세션은 `{"solomon": {...}, "player": {...}}`처럼 쪽별로 나뉘며(`SOLOMON_SESSION_SIDES`), `record_solomon_step(..., side=...)`이 해당 쪽에만 수를 쌓는다. 두 쪽을 한 목록에 섞으면 상대의 상태가 다음 상태가 되어 표본이 망가진다. `/apis/solomonlearning`의 `step`은 항상 사람 쪽이고, 솔로몬 쪽은 `/v1/chat/completions` 경로에서만 쌓인다.
- `finish_solomon_session()`은 `result`가 `loss`(=사람 승리)일 때만 사람 쪽 표본을 `WIN_REWARD`로 닫아 학습에 넣는다. 사람이 이기지 못한 대전의 사람 쪽 수는 그대로 버린다. 사람 쪽 수의 보상도 솔로몬과 같은 `build_afterstate()`로 서버가 다시 계산하므로, 클라이언트가 `/apis/learning`에 보내는 `점수 증가분 + ATTACK 증가분` 보상과 섞이지 않는다.
- 학습 비중은 `SOLOMON_PLAYER_WIN_TRAINING_WEIGHT`(기본 1000.0)로 조절한다. 솔로몬 자신의 수는 항상 `SOLOMON_DEFAULT_TRAINING_WEIGHT`(1.0)이므로 이 값이 클수록 사람의 승리 수순을 더 강하게 따라 배우며, 1로 두면 양쪽을 같은 비중으로 학습한다. `train_solomon_samples()`는 표본별 비중을 **평균이 1이 되도록 정규화**한 뒤 `smooth_l1_loss(..., reduction='none')`에 곱한다. 이렇게 해야 비중을 바꿔도 손실 크기가 같은 수준으로 유지되어 학습률을 다시 맞출 필요가 없고, 사람 쪽 표본이 없는 대전에서는 모든 비중이 1이라 그대로 동작한다.
- 이 기능이 쓰는 관측·행동·체크포인트 계약은 서버의 다른 경로와 완전히 같다. 요청에 `nextPair`를 더한 것 외에 프로토콜도 그대로다.
- 갱신한 가중치는 `save_value_checkpoint()`가 `learning.py`와 같은 체크포인트 형식(`model`, `model_version`, `observation_size`, `action_count`, `seed`)으로 저장한다. `seed`는 로드 시 보관해 둔 `value_model_seed`를 그대로 유지하며, 임시 파일에 쓴 뒤 교체해 저장 중 중단되어도 기존 모델이 깨지지 않게 한다. 관측·행동 계약을 바꾸지 않으므로 갱신된 파일은 `learning.py`의 추가 학습과 다른 게임 세션에서 계속 그대로 쓸 수 있다.
- 학습이 가중치를 바꾸는 동안 추론이 겹치지 않도록 `choose_model_action()`의 추론과 `train_solomon_samples()`의 갱신·저장은 모두 `value_model_lock` 안에서 실행한다. 세션 상태는 `solomon_sessions_lock`으로, `bundledenemy`의 전역 룰·시간 설정을 쓰는 애프터스테이트 계산은 배치 추론과 온라인 학습 양쪽에서 `simulation_lock`으로 직렬화한다(항상 가장 안쪽에서만 잡으므로 교착되지 않는다). 결과 화면까지 가지 못하고 끝난 세션은 `SOLOMON_SESSION_LIMIT`(8)을 넘길 때 오래된 순서로 버린다.

`python/lngui.py`는 `learning.py`를 감싼 Tkinter GUI 학습기다. 학습은 별도 쓰레드에서 돌리고 로그·진행 상황은 큐로 메인 쓰레드에 전달해 화면이 멈추지 않게 한다. GUI 제어는 `learning.TrainingControl`(일시정지·중단은 에피소드 경계에서만 반영, 강제 포기는 `TrainingAbort` 예외로 즉시 반영해 저장을 건너뜀)과 `train()`의 `control`·`log`·`on_progress` 키워드 인자로 구현했으며, 이 인자들을 생략하는 기존 CLI 호출은 그대로 동작한다. `learning.DEFAULT_SEED`·`DEFAULT_DEVICE`·`DEFAULT_OPPONENT`·`DEFAULT_OUTPUT`은 CLI `argparse` 기본값과 GUI 초기값이 공유하는 단일 출처다. 서버 주소 입력란이 `localhost`/`127.0.0.1`/`::1`을 가리키면 Start 클릭 시 `_start_local_server()`가 그 포트로 `pythonserver.py`(`ThreadingHTTPServer` + `PuyoRequestHandler`)를 GUI 프로세스 안에서 직접 띄운다. 생성자가 소켓 바인딩까지 동기 수행하므로 다른 프로세스가 이미 그 포트를 쓰고 있으면 `OSError`가 그대로 올라오고, `_on_start()`는 이를 잡아 학습 자체를 시작하지 않는다(서버 주소를 원격으로 바꾸면 이 자동 기동을 건드리지 않는다). `_stop_local_server()`는 Stop 완료·정상 종료·오류(`_reset_controls()`)와 창 닫기(`_on_close()`) 모두에서 호출해 GUI가 띄운 서버를 남겨 두지 않는다. `pythonserver.py`의 `is_learning_authorized()`는 토큰이 정확히 `LOOPBACK_BYPASS_TOKEN`("localhost")이고 호출자가 실제 localhost/루프백 주소(`_is_loopback_client()`)일 때만 서버 설정 토큰과 무관하게 허용한다. 빈 문자열 토큰은 이 예외 대상이 아니라서 루프백에서도 거부되며, `LearningApiClient`도 빈 토큰이면 즉시 `ValueError`를 올린다. GUI 학습기는 이 때문에 항상 `"localhost"`를 토큰으로 보낸다. 원격 서버이거나 `"localhost"`가 아닌 틀린 토큰에는 이 예외가 적용되지 않는다. `lngui.py`는 창이 뜨면 학습 쓰레드와 별개로 `psutil` 기반 시스템 자원 감시 데몬 쓰레드도 시작한다. 1초 간격으로 CPU·RAM 점유율만 재서 같은 `log_queue`에 적재하며, 창 최하단의 라벨·게이지바는 다른 로그와 마찬가지로 `_poll_queue`가 메인 쓰레드에서만 갱신한다.

`Episodes` 아래의 `Training strategy` 읽기 전용 콤보박스는 `learning.TRAINING_STRATEGIES`를 등록 순서대로 현재 언어의 표시 이름(영어 `label`, 한국어 `label_ko`)으로 나열하고, 바로 아래 회색 라벨에 고른 방식의 설명(영어 `summary`, 한국어 `description`)을 보여 준다. `_selected_strategy_name()`이 라벨을 방식 이름으로 바꿔 `_run_training(..., strategy)`를 거쳐 `learning.train(strategy=...)`에 넘기므로, 새 방식을 등록해도 GUI는 고칠 필요가 없다. `_set_inputs_enabled()`는 켤 때도 `normal`이 아니라 `readonly`로 되돌린다(`normal`이면 목록에 없는 글자를 입력할 수 있다). 두 줄이 늘어난 만큼 창 기본 크기는 720×580, 최소 크기는 560×480이다.

`lngui.py`의 GUI 문구는 `MESSAGES` 번역표(영어 `en`·한국어 `ko`)와 `translate(language, key, **values)`로 만든다. 두 언어의 키와 `{자리 표시자}`는 같아야 하며, 한국어 표에 없는 키는 영어로 대신한다. 처음 언어는 `detect_language()`가 정한다. Windows에서는 로캘이 아니라 표시 언어 `GetUserDefaultUILanguage()`의 주 언어(0x12면 한국어)를 보고, 그 밖의 운영체제는 `LC_ALL`·`LC_MESSAGES`·`LANG`·로캘 이름을 본다. `TrainerApp(root, language=...)`로 고정할 수 있으며, 테스트는 이 인자로 언어를 고정한다(`TrainerMenuTest`는 영어). `Language` 메뉴(한국어 표시에서는 `언어 (Language)`)의 라디오 항목 이름 `English`·`한국어`는 번역하지 않는다. `set_language()`는 다음을 새 언어로 다시 적는다.

- `_translated()`로 기록한 위젯(`_text_widgets`)과 메뉴 항목(`_menu_texts`), 창 제목, Pause/Resume 버튼
- 학습 방식 콤보박스. 고른 방식은 라벨이 아니라 이름으로 유지한다.
- 현재 상태 문구. `_set_status()`가 키와 값을 `_status`에 기억해 둔다.

로그 패널에 이미 적힌 줄과, 이미 번역되어 오는 저장 진행 문구(`_set_status_text()`)는 그대로 둔다. 학습기 자체의 학습 로그는 언어와 무관하게 한국어다. 문구가 언어마다 달라지므로 **버튼 글자나 메뉴 라벨로 동작을 판단하지 않는다**. 일시정지 토글은 `_pause_requested`로 판단하고, 메뉴 항목은 추가 직후 `index("end")`로 기록한 `_save_as_menu_index`·`_exit_menu_index`로 찾는다. 인덱스를 추가 시점에 받으므로 항목 순서를 바꿔도 상태 처리 코드는 고칠 필요가 없다. 새 GUI 문구를 넣을 때는 두 언어 표에 함께 추가하고 위젯은 `_translated()`로 기록한다. `save_checkpoint_copy()`·`export_checkpoint_to_onnx()`는 `language` 키워드(기본 영어)로 진행 문구와 onnx 설치 안내의 언어를 받고, `_run_save_as()`는 작업을 시작한 시점의 언어를 넘긴다.

**글꼴·캐릭터셋**
- `register_bundled_font()`가 `python/PretendardVariable.ttf`를 Windows GDI `AddFontResourceExW(..., FR_PRIVATE)`로 설치 없이 이 프로세스에만 한 번 등록한다. Tk가 `Pretendard Variable`을 찾으면 `TrainerApp._apply_bundled_font()`가 `TK_NAMED_FONTS`의 패밀리만 바꾼다(크기는 시스템 값 유지). 이름 글꼴은 위젯을 만들기 전에 바꾼다.
- 가변 글꼴이라 GDI에는 `Pretendard Variable Thin` 같은 인스턴스 패밀리도 함께 보이며, 기본 인스턴스 `Pretendard Variable`의 굵기는 400이다.
- 로그 패널은 기본 고정폭 글꼴(한국어 Windows에서는 굴림체) 대신 `TkTextFont`를 쓴다.
- Windows가 아니거나 등록에 실패하면 시스템 글꼴을 쓴다. Windows 기본 메뉴바는 운영체제가 그리므로 항상 시스템 글꼴이다.
- `main()`은 창을 띄우기 전에 `configure_standard_streams()`로 표준 스트림을 정리한다.
  - pythonw.exe라서 `None`인 스트림에는 `os.devnull` UTF-8 스트림을 단다. http.server 요청 로그의 `AttributeError`를 막기 위해서다.
  - 파이프·파일로 넘어가 UTF-8이 아닌 스트림은 인코딩을 그대로 두고 `errors="backslashreplace"`로 바꾼다. 실제 콘솔은 파이썬이 이미 UTF-8로 쓰므로 건드리지 않는다.
- `export_checkpoint_to_onnx()`는 `torch.onnx.export(verbose=False)`로 변환 단계 출력을 끈다. torch.export 기반 변환이 찍던 체크 표시 이모지가 cp949 출력에서 `UnicodeEncodeError`를 내, GUI의 ONNX 저장과 `OnnxExportTest`가 실패했었다. 지금은 `PYTHONIOENCODING` 없이도 통과한다.
- 한글이 들어간 경로의 체크포인트 저장·로드·복사·ONNX 변환은 torch 2.14에서 문제없음을 확인했다.

메뉴바에는 File과 Language 두 그룹이 있고, File 그룹에는 `Save As...`와 `Exit` 두 항목이 있다. `Save As...`는 학습 중·일시정지 중과 저장 작업이 도는 동안 잠기며(`_set_save_as_enabled()`), `Exit`는 상태 변화로는 잠기지 않고 종료 절차를 시작한 `_disable_all_controls()`에서만 함께 잠근다. Language 메뉴는 잠그지 않는다.

- `Save As...`(`_on_save_as()`)는 먼저 `Model output path`에 파일이 있는지 확인하고, 없으면 대화상자를 열지 않은 채 로그창에만 안내를 남긴다. 파일이 있으면 `parent=self.root`로 모달 저장 대화상자를 열어 `SAVE_AS_FILE_PATTERNS`(번역 키와 `.pt` / `.onnx` 패턴) 중 하나를 고르게 한다. 어느 형식인지는 결과 경로의 **확장자**로 판별하므로 형식을 더할 때는 이 목록과 확장자 분기를 함께 넓힌다. 취소·닫기, 지원하지 않는 확장자, 원본과 같은 경로는 모두 아무 것도 쓰지 않고 로그만 남긴다.
- 저장을 고르면 `Start` 버튼과 `Save As...`를 잠그고 별도 쓰레드(`_run_save_as()`)에서 처리한다. `.pt`는 `save_checkpoint_copy()`가 `shutil.copy2()`로 바이트 그대로 복사해 기존 체크포인트 형식을 유지하고, `.onnx`는 `export_checkpoint_to_onnx()`가 변환한다. 결과·오류는 큐의 `saveas_progress`·`saveas_done`·`saveas_error` 항목으로 메인 쓰레드에 전달하고, `_finish_save_as()`가 잠근 조작을 되살린다.
- ONNX 변환은 `Start` 버튼 아래의 학습용 게이지바를 잠시 빌려 진행률을 보여 준다. 빌리기 전 `(maximum, value)`를 `_progress_backup`에 담아 두고 끝나면 그대로 되돌리므로, 직전 학습 진행 표시가 사라지지 않는다. `_progress_backup`이 있을 때만 게이지바를 갱신하므로 `.pt` 복사는 게이지바를 건드리지 않는다.
- `export_checkpoint_to_onnx()`는 `learning.load_policy_checkpoint()`로 모델 버전·관측값·행동 계약을 먼저 검증하므로 형식이 다른 체크포인트로 어중간한 ONNX 파일이 만들어지지 않는다. `onnx` 패키지가 없으면 변환을 시작하기 전에 `translate(language, "onnx_requirement")` 설치 안내를 담은 예외를 올린다. `onnxscript`가 있으면 torch 2.9부터 기본이 된 `torch.export` 기반 내보내기를, 없으면 예전 TorchScript 방식을 쓴다. 전자는 `external_data=False`를 반드시 넘겨야 가중치를 옆의 `.onnx.data` 파일로 빼지 않고 고른 위치의 파일 하나로 완성된다. 또 `ValueNetwork.forward()`가 마지막에 `reshape(-1)`을 하기 때문에 출력 축이 1로 고정되어 적히므로, 검증 단계에서 그 축을 입력과 같은 `ONNX_BATCH_AXIS_NAME`(`batch`)으로 고쳐 저장한다. 원본 체크포인트는 읽기만 하므로 기존 모델 호환성에는 영향이 없다.
- `Exit`(`_on_exit_menu()`)는 먼저 모든 버튼·입력·메뉴를 잠근 뒤 `_exit_pending`을 켠다. 학습 중이거나 일시정지 중이면 `Stop` 버튼과 같은 `control.request_stop()`만 걸고 기다린다(`request_stop()`이 일시정지 대기도 함께 풀어 준다). 저장까지 끝나 학습·저장 쓰레드가 모두 끝나면 `_poll_queue()`가 `_shutdown()`으로 창을 닫는다. `_exit_pending`이 켜져 있는 동안에는 `_reset_controls()`와 `_finish_save_as()`가 잠근 버튼을 되살리지 않는다. 창 오른쪽 위 닫기 버튼(`_on_close()`)은 예전처럼 `request_abort()`로 저장 없이 즉시 포기하는 경로라서 `Exit`와 의미가 다르다.

`lngui.py`의 메뉴 동작과 ONNX 변환은 `python/test_learning.py`의 `TrainerMenuTest`·`OnnxExportTest`가 확인한다. 한국어 표시·언어 전환·글꼴 적용은 `TrainerLanguageTest`, 번역표 키와 자리 표시자 일치·언어 감지·표준 스트림 정리는 창이 필요 없는 `TrainerLocalizationHelperTest`가 맡는다. 앞쪽은 실제 Tk 창을 만들어 위젯·메뉴 상태를 검사하므로 화면이 없는 환경에서는 통째로 건너뛴다(`_TK_AVAILABLE`). ONNX 변환 자체를 확인하는 테스트는 `onnx` 패키지가 있을 때만 돌고, 미설치 안내를 확인하는 테스트는 반대로 없을 때만 돈다.

### 숫자 전용 표시 글꼴 (BUILDNO 47)

숫자 전용 글꼴은 `NUMBER_FONT_NAME`에서 만든 `NUMBER_FONT` 스택을 사용한다. 필드·중앙·시뮬레이터 점수, 피버 타이머, 게임 시작 카운트다운, 설정 슬라이더 수치와 `1,000 GOLD`·`9,000 GOLD` 같은 금액 표시에 적용한다. `최종 점수 123`, `5연쇄`, `POINT`, `NEXT`, `카드 5장`처럼 금액이 아닌 한글·영어와 숫자가 섞인 문자열은 기존 `MESSAGE_FONT` 또는 해당 UI 글꼴을 유지한다.

### 플레이어 이름 필수 입력 (BUILDNO 45)

`puyow_store.settings.playerName`이 없거나 `null`·빈 문자열·금지 문자를 포함하면, 저장값을 표시용 기본 이름으로 보정하더라도 `playerNameSetupRequired`를 유지한다. 이 경우에는 정규화한 기본 이름을 저장소에 다시 쓰지 않아 새로고침으로 필수 입력을 우회할 수 없게 한다. 초기 타이틀에서 메인 메뉴로 들어간 직후 `playerNamePrompt`가 메뉴 위에 취소 불가로 표시되며, Enter 또는 확인 버튼으로만 제출할 수 있다. 유효한 이름을 입력하면 즉시 `puyow_store`에 저장하고 대화상자를 닫는다.

이름은 공백을 제외하고 최대 10자로 저장하며 Windows·Linux 파일명에 쓸 수 없는 `\\ / : * ? " < > |`와 작은따옴표, 느낌표, 제어 문자를 거부한다. 같은 `validatePlayerName()`을 설정 화면 저장에도 사용하므로, 잘못된 이름을 저장하려 하면 설정 화면을 닫지 않고 안내 메시지를 표시한다. UI 문자열은 `translate()` 키로 관리한다. 회귀는 `tests/test01_menu.spec.js`의 이름 입력·설정 저장 테스트가 담당하고, 공통 `enterMainMenu()`는 기존 메뉴 시나리오가 첫 실행 대화상자에 막히지 않도록 테스트 이름을 입력한다.

### TODO 학습 방식·가중치 변경 결과 (2026-09-13, BUILDNO 51)

2026-09-13 `TODO.md`로 학습 방식 5개 추가(상대 고정 2개 + 대전 규칙 고정 3개)와 가중치 항목 수정, 진행 로그 보강을 구현했다. 등록된 학습 방식은 `standard`·`chain-guided`·`chain-curriculum`·`long-nstep`·`chain-all`·`solo-play`·`alternate-model`·`fever-only`·`fever-start`·`standard-only` 열 가지다. 관측 벡터(528개)·행동(24개)·`MODEL_VERSION`(3)·`ValueNetwork` 구조는 그대로라 기존 체크포인트(`default.pt`, `model01.pt`)를 그대로 읽고 이어 학습할 수 있다. 다만 보상의 **의미**는 바뀌었으므로, 옛 기준으로 학습한 가중치가 새 기준에서 곧바로 최적은 아니다.

#### 보상(가중치) 계약

`python/common.py` 한 곳이 계약의 원본이고, `learning.py`·`pythonserver.py`·`nodeserver.js`·`src/js/puyow.js`의 ONNX 추론이 모두 같은 값을 쓴다. JS 두 곳은 상수를 직접 복제하므로(`CHAIN_REWARD_WEIGHT`/`ONNX_CHAIN_REWARD_WEIGHT`, `FEVER_CHAIN_REWARD_RATIO`/`ONNX_FEVER_CHAIN_REWARD_RATIO`) `common.py`를 고치면 반드시 함께 고친다.

- 연쇄 가중치 `chain_reward(combo, fever_active)` = `CHAIN_REWARD_WEIGHT(5.0) * combo^2`이고, 피버 중에는 `FEVER_CHAIN_REWARD_RATIO(0.2)`를 곱해 5분의 1이 된다. 피버 밖 2연쇄는 20, 7연쇄는 245다.
- 한 수의 즉시 보상 `move_reward(attack, combo, fever_active)` = `ATTACK + chain_reward(...)`다. ATTACK 항은 예전과 같게 남겨 두었다. TODO가 열거한 항목(승패·시간·연쇄)에는 없지만, 싹쓸이 티켓·상쇄처럼 연쇄 수만으로는 설명되지 않는 가치를 담고 있어 빼지 않았다.
- 승·패 보상은 `WIN_REWARD = +245`, `LOSS_REWARD = -245`로, 피버 밖 7연쇄 가중치와 같은 크기다(`WIN_LOSS_REFERENCE_COMBO = 7`).
- 게임 시간 보정 `game_time_reward(win, elapsed_ms)`는 승리면 경과 시간만큼 깎고 패배면 그만큼 덜 깎는다. 비율은 피버 밖 2연쇄(20)가 120초에 해당하도록 정했고(`GAME_TIME_REFERENCE_COMBO`, `GAME_TIME_REFERENCE_MS`), `GAME_TIME_REWARD_MAX_MS`(= `ELAPSED_MS_SCALE`, 10분)에서 잘린다. 상한까지 가도 100이라 승패 항의 부호를 뒤집지 못한다. 상한을 관측값의 `elapsed_ms` 정규화 상한과 같게 둔 것은 의도적이다. 가치망이 상태에서 이 항을 읽어 낼 수 있어야 하기 때문이다.
- 종료 가치 `terminal_reward(win, elapsed_ms)` = 승패 항 + 시간 항이다. 오프라인 학습은 `PuyoDuelEnvironment.terminal_value()`가, 서버 온라인 학습은 `finish_solomon_session()`이 이 함수를 쓴다. 무승부(`draw`)와 최대 턴 초과(`timeout`)는 예전처럼 종료 가치를 만들지 않는다.
- `PuyoEnvironment`(상대 없는 옛 solo 환경)는 경과 시간을 재지 않아 관측값의 `elapsed_ms`가 늘 0이므로, `_defeat_value()`가 `턴 수 × 3초`를 생존 시간으로 환산해 쓴다. 관측값의 `turn` 스칼라가 같은 정보를 담고 있어 가치망이 구분할 수 있다.
- `pythonserver.record_solomon_step()`은 종료 가치의 시간 항을 만들려고 각 수에 `elapsed_ms`를 함께 적어 둔다. 브라우저가 보내는 요청 형식은 바뀌지 않았다(관측 벡터에서 읽는다).

#### 상대를 고정하는 학습 방식 두 가지

`TrainingStrategy`에 `opponent` 필드가 생겼다. 비어 있지 않으면 그 값이 `train()`의 `opponent` 인자(CLI `--opponent`, GUI 기본값 `random`)보다 우선한다. 다른 방식은 모두 빈 문자열이라 동작이 그대로다.

- `solo-play`(솔로 플레이): `bundledenemy.QuietEdgeEnemy`하고만 대전한다. 이 적은 즉시 패배하지 않는 후보 중 연쇄가 나지 않는 배치를 우선하고, 그중 중앙 두 열(`CENTER_COLUMNS` = X 2,3)에서 가장 먼 열을, 같은 거리면 낮은 자리를 고른다. 터뜨리지 않는 후보가 하나도 없으면 연쇄·ATTACK이 가장 작은 후보로 물러선다. `BaseEnemy.decide()`의 "피버 중 최대 연쇄 우선" 분기는 이 적의 목적과 반대라 `decide()`를 통째로 재정의해 쓰지 않는다. 실제로는 양 끝 열(X=0,5)부터 고르게 채워 올라가며 40턴 안팎에 스스로 막힌다.
- `alternate-model`(대체 모델과 플레이): `ALTERNATE_MODEL_DIRECTORY`(= `python/puyow`, **이 스크립트 파일 기준**이라 작업 디렉터리와 무관하다) 바로 아래에서 `ALTERNATE_MODEL_PATTERN`(`^model\d{2,}\.pt$`)에 맞는 파일만 상대 후보로 삼는다. `default.pt`·`model1.pt`·`model01.txt`는 이름 규칙에서 빠진다. 파일 탐색 단계에서는 체크포인트 내용을 전혀 보지 않는다.

`ALTERNATE_MODEL_OPPONENT`(`"model"`)는 `PuyoDuelEnvironment.POLICY_OPPONENTS`에 `SELF_PLAY_OPPONENT`와 함께 들어 있어, 상대 자리를 `self_play_action_fn` 콜백으로 채우는 같은 경로를 탄다. `info["opponent"]`에는 `policy_opponent_type`이 들어가 self-play와 구분된다. 기존 `--opponent solo`(상대 없이 버티는 `PuyoEnvironment`)와는 다른 식별자이므로 `chain-curriculum`의 `solo_episode_ratio` 동작은 그대로다.

대체 모델 상대의 오류 처리는 다음과 같다.

- `AlternateModelOpponents.action_fn()`이 만든 콜백은 체크포인트 로드·추론 중의 모든 예외를 `AlternateModelError(path, error)`로 바꾼다.
- `train()`의 에피소드 스텝 루프가 이 예외를 받아 그 에피소드를 통째로 버린다. `build_value_samples()`를 부르지 않아 부분 trajectory가 학습 표본이 되지 않고, 승·패 카운트도 올라가지 않는다. 로그에는 `alternate_model_failed`가 남고 해당 파일은 `exclude()`로 제외된다. 진행 게이지는 한 칸 나아가고(`result="alternate_model_failed"`), 서버 세션이 열려 있으면 `episode_end`만 보내 닫는다.
- 남은 후보가 없으면 `alternate_model_exhausted`를 남기고 루프를 빠져나가며, 사용자가 Stop을 누른 경우와 같이 그때까지의 가중치를 저장한다.
- 시작 시점에 후보가 하나도 없으면 모델을 만들기 전에 `ValueError`를 올린다. `--output` 파일은 전혀 건드리지 않는다. GUI는 `_run_training`이 이 예외를 잡아 로그·상태 표시로 알리고 조작을 되살린다.
- 선택은 `strategy_random`(시드 파생) 하나만 쓰므로 같은 시드로 재현된다. 한 번 읽은 체크포인트는 인스턴스 캐시에 남아 에피소드마다 다시 읽지 않는다.

GUI(`lngui.py`)는 `TRAINING_STRATEGIES` 등록표를 그대로 나열하므로 두 방식이 자동으로 콤보박스에 나타난다. GUI 쪽에 새로 고친 코드는 없다.

#### 대전 규칙 고정 학습 방식 (2026-09-13 추가)

`TrainingStrategy`에 `rules` 필드(DUEL_RULES 후보 튜플)가 생겼다. 비어 있지 않으면 모든 에피소드가 그 규칙으로 진행되고, 후보가 여럿이면 에피소드마다 그중 하나를 무작위로 고른다. 비어 있으면 예전처럼 환경이 기본 룰/피버 룰을 절반씩 고른다. 상대와 색상 수(3~5색)는 어느 경우에도 `standard` 방식과 똑같이 에피소드마다 무작위다.

- `fever-only`(피버 위주): `(RULE_FEVER, RULE_RELAXED_FEVER)`
- `fever-start`(피버 강화 학습): `(RULE_FEVER_START,)`
- `standard-only`(기본 룰 위주): `(RULE_STANDARD,)`

`learning.py`의 `DUEL_RULES`는 `puyow.js`의 규칙 식별자를 그대로 쓴다.

| 값 | puyow.js 대응 | 학습 환경 동작 |
| --- | --- | --- |
| `standard` | 기본 룰 | `fever_rule=False`. 피버 필드를 쓰지 않는다. |
| `fever` | 피버 룰 | 전등 `FEVER_LIGHT_STARTS`(0)로 시작해 상쇄 7회에 피버가 발동한다. |
| `relaxedFever` | 피버 룰 (완화) | 전등 `RELAXED_FEVER_LIGHT_STARTS`(= `min(6, FEVER_LIGHT_STARTS + 3)` = 3)로 시작해 상쇄 4회에 발동한다. 게임에서는 구경과 도장깨기에서 선택할 수 있고, 학습 환경에서도 대전 규칙으로 쓸 수 있다. |
| `feverStart` | 피버 룰 (시작) | `FeverState.next_time`을 `FEVER_START_INITIAL_TIME`(60초)로 두고 `reset()` 끝에서 양쪽 `_activate_fever()`를 부른다. `puyow.js`의 `beginGame()` feverStart 분기와 같아, 남은 시간 60초·다음 피버 시간 15초·목표 5연쇄의 피버 스테이지에서 즉시 시작한다. |

구현상 주의할 점은 다음과 같다.

- `PuyoDuelEnvironment.__init__`의 `rule` 인자는 문자열 하나이거나 후보 목록이며, 기존 `fever_rule` 불리언 인자보다 우선한다. 둘 다 생략한 기본 경로는 `random.random() < 0.5` 한 번만 소비해 예전 학습의 난수 흐름과 재현성이 그대로다. 후보가 하나뿐이면 난수를 아예 쓰지 않는다.
- `FeverState.light_start`는 `puyow.js`의 `fever.lightStart`에 대응한다. `_activate_fever()`와 `_finish_fever()`가 전등을 0이 아니라 이 값으로 되돌리므로(원작 `activatePlayerFever`/`finishPlayerFever`와 동일), "피버 룰 (완화)"는 피버가 끝난 뒤에도 전등 3개에서 다시 센다.
- 피버 룰 (시작)의 첫 제한 시간 60,000ms는 관측 스칼라 `fever_left_time`의 정규화 상한(`common.FEVER_LEFT_TIME_SCALE`)과 정확히 같아 값이 잘리지 않는다. `puyow.js`도 같은 상수(`FEVER_START_INITIAL_TIME`)로 정규화한다. 관측 벡터 길이·의미는 바뀌지 않았으므로 기존 체크포인트와 완전히 호환된다.
- `_activate_fever()`는 `_prepare_fever_stage()`에서 현재 조작 쌍을 보고 스테이지를 고르므로, `reset()`에서는 반드시 양측 `agent_pair`/`enemy_pair`와 예고쌍을 모두 정한 뒤에 불러야 한다.
- `step()`의 `info`에 `rule` 키가 추가되었다. 기존 `fever_rule` 키도 그대로 남아 있다.
- `_make_environment()`에 `rule` 인자가 5번째 위치 인자로 붙었다. 이 함수를 대역으로 바꾸는 테스트는 인자 개수를 맞춰야 한다.

#### 진행 로그

`train()`의 진행 로그 한 줄에는 그 에피소드의 최대 연쇄(`max_combo=`)와 **직전 로그 출력 이후 지나온 모든 에피소드의 최대 연쇄**(`recent_max_combo=`)가 함께 나온다. 로그 간격은 `resolve_log_interval()`이 정하며 CPU는 `CPU_LOG_INTERVAL`(500) 고정, GPU는 전체의 1%다(첫 에피소드는 간격과 무관하게 항상 낸다). 간격 사이의 에피소드는 로그에 나타나지 않으므로 `max_combo=`만으로는 연쇄가 느는지 알 수 없어 두 번째 값을 함께 낸다. 누적 변수 `interval_max_combo`는 로그를 낼 때마다 0으로 되돌리고, 대체 모델 오류로 버린 에피소드는 `continue`로 빠져 두 값 모두에 들어가지 않는다. 표시용 값이라 체크포인트 내용·모델 계약과는 무관하다. 로그 간격을 함수로 뽑아 둔 것은 테스트가 간격을 바꿔 이 동작을 확인할 수 있게 하기 위함이다.

#### 회귀 테스트

`python/test_learning.py`에 `DuelRuleTest`, `RuleTrainingStrategyTest`, `ProgressLogTest`, `RewardWeightTest`, `QuietEdgeEnemyTest`, `AlternateModelOpponentTest`, `NewTrainingStrategyTest`와 GUI 오류 표시 테스트 하나를 추가했다(전체 134개). `python -m unittest test_learning`을 `python/` 디렉터리에서 실행한다. 가중치 비율(피버 1/5, 승패 = 7연쇄, 2연쇄 = 120초), `modelNN.pt` 자릿수 규칙, 진행 로그의 `recent_max_combo=` 계산, 네 가지 대전 규칙의 초기 피버 상태와 기본 규칙 선택의 재현성은 이 테스트가 고정한다.

### Node 서버 소스 경로 (2026-09-13)

Node.js 기반 백엔드 서버 소스는 저장소 루트의 `nodeserver.js`에서 `nodeserver/server.js`로 옮겼다(이 디렉터리는 2026-09-16에 `node/`로 이름을 바꿨다. 아래 「Node 서버 디렉터리 이름 변경」 절 참고). `npm start`는 이 새 경로를 실행하며, 서버 안에서는 `__dirname`의 상위 디렉터리를 프로젝트 루트로 계산해 `src/`의 정적 파일·ONNX 모델·게임 핵심 코드를 찾는다. 이 문서에서 이 변경 전 기록을 설명하며 쓰는 `nodeserver.js`·`nodeserver/server.js` 표기는 모두 현재의 `node/server.js`를 뜻한다. 서버 파일 경로를 참조하거나 서버만 임시 복사해 실행하는 테스트를 수정할 때도 이 디렉터리 구조를 유지한다. 이 작업에서 `src/js/puyow.js`의 JSDoc 주석도 함께 정리했으므로 BUILDNO는 52이고 패키지 버전은 `0.0.52`다.

### 온라인 플레이 사용 가능 여부 API (2026-09-13, BUILDNO 53)

온라인 플레이 자체는 아직 구현하지 않았다. Node 서버 `node/server.js`와 Python 서버 `python/pythonserver.py`는 인증 없이 `GET /apis/onlineplayinfo`에 `{ "available": false }`를 응답한다. `puyow.js`는 초기화할 때 이 API를 조회하며, `false`이거나 API 호출에 실패하면 "너랑 나랑" 방식 선택지에서 온라인 플레이를 숨긴다. 나중에 서버가 `true`를 반환하면 선택지는 보이고 포커스를 받을 수 있지만, 온라인 로그인·대기실 구현 전까지 선택해도 화면 전환 없이 끝난다.

### 온라인 플레이 세부 사양 결정 (2026-09-14, 문서 작업)

`MAY_BE_LATER.md`의 온라인 플레이 항목에 "세부 결정 사항" 절을 더해, 구현 전에 정해야 했던 모호한 부분을 보편적인 온라인 대전 게임 방식으로 확정했다. 소스 코드는 바꾸지 않았으므로 BUILDNO와 패키지 버전은 53 그대로다. 온라인 플레이를 구현할 때는 이 절이 기준이며, 요점은 다음과 같다.

- 로그인·가입은 HTTP POST(`/apis/onlineplay/signup`·`login`·`logout`), 대기실부터 게임까지는 WebSocket 하나(`/apis/onlineplay/socket`)를 유지한다. 방 목록은 폴링이 아니라 서버 푸시다. WebSocket은 추가 의존성 없이 RFC 6455 최소 구현을 `onlineplay.js`·`onlineplay.py`에 직접 만든다(python 서버에 라이브러리 설치를 요구하지 않기 위함, `bcrypt`만 pip 안내를 추가한다).
- 로그인하면 서버가 메모리에만 두는 난수 세션 토큰을 발급하고, 클라이언트도 토큰을 저장소에 남기지 않는다. 연결 판정은 5초 ping·15초 무응답 기준이며 이 기준이 "상대방 연결 끊김" 판정도 겸한다.
- 계정 디렉터리 이름은 ID 소문자, 닉네임 색인은 메모리에 만든다. 방 파일의 정본은 서버 메모리이고 파일은 스냅샷이라 서버 시작 시 `rooms/`를 비운다.
- 게임 시작·뿌요 지급 덱·승패 확정·WIN POINT 계산은 서버가 한다. 조작은 각자 화면에 즉시 반영한 뒤 서버가 상대에게 중계하고, 패배 보고가 50ms 이내로 겹치면 무승부로 보아 WIN POINT를 바꾸지 않는다.
- 온라인 대전은 리플레이를 기록하지 않으며, 진행도·GOLD·AI 학습 제외는 오프라인 "너랑 나랑"과 같다. 결과 화면은 "종료"만 두고 방 화면으로 돌아가며(방 유지), 재대전은 방장이 다시 "시작"을 누른다. 이 두 가지는 기존 "너랑 나랑" 결과 화면·리플레이 규칙과 달라지는 지점이므로 `MAY_BE_LATER.md` 최하단 "변경 사유"에도 적어 두었다.

### 온라인 플레이 구현 (2026-09-14, BUILDNO 54)

`MAY_BE_LATER.md`의 온라인 플레이를 실제로 구현했다. 계약은 그 문서의 "세부 결정 사항" 절을 그대로 따른다.

**서버 상수** — Node는 `node/server.js` 상단의 `ONLINE_PLAY_ENABLED`, Python은 `SERVER_CONFIG["online_play_enabled"]` 하나로 기능 전체를 켜고 끈다. 기본값은 둘 다 꺼짐이며, 꺼져 있으면 `/apis/onlineplayinfo`가 `{"available": false}`를 응답하고 저장 디렉터리도 만들지 않는다. SSL은 Node가 `SSL_KEY_FILE`·`SSL_CERT_FILE`·`SSL_CA_FILE`, Python이 `SERVER_CONFIG`의 `ssl_cert_file`·`ssl_key_file`·`ssl_ca_file`을 쓰며, **필수 파일이 모두 실제로 존재할 때만** 그 포트를 HTTPS로 서비스하고 하나라도 없으면 조용히 HTTP로 내려간다. Node는 `https.createServer`, Python은 `ssl.SSLContext.wrap_socket`이라 인증서 파일 구성 방식이 서로 다르다. HTTPS로 서비스하면 WebSocket도 같은 포트라 자동으로 WSS가 된다.

**백엔드 분리** — 구현은 `node/onlineplay.js`와 `python/onlineplay.py`에 있고, 기존 서버 파일은 모듈 연결(API 등록과 Upgrade 라우팅)만 최소로 고쳤다. WebSocket은 추가 의존성 없이 RFC 6455 최소 구현(핸드셰이크와 텍스트·핑·퐁·클로즈 프레임)을 두 파일에 직접 넣었다. Python은 `bcrypt`만 추가로 필요하며 `pythonserver.py` 상단 주석에 적어 두었다(지연 import라 기능을 끄면 설치하지 않아도 서버가 돈다).

**프로토콜** — 가입·로그인·로그아웃만 HTTP POST(`/apis/onlineplay/signup`·`login`·`logout`)이고, 대기실부터 대전까지는 WebSocket 하나(`/apis/onlineplay/socket`)를 유지한다. 클라이언트→서버는 `auth`·`room_list`·`room_create`·`room_join`·`room_leave`·`game_start_request`·`input`·`chain_result`·`defeat`, 서버→클라이언트는 `auth_ok`·`room_list`·`room_state`·`room_closed`·`opponent_left`·`game_prepare`·`game_cancel`·`game_start`·`game_result`·`session_closed`·`error`·`opponent_input`·`opponent_chain`이다. **세 구현(두 서버와 `puyow.js`)이 같은 이름과 오류 코드를 쓰므로 하나를 바꾸면 셋 다 고쳐야 한다.**

**저장** — 계정은 `[홈]/.puyowserver/account/<ID 소문자>/account.json`(`id`·`nickname`·`password`·`winPoint`·`createdAt`), 방은 `[홈]/.puyowserver/rooms/<방ID>.json`이다. 방의 정본은 서버 메모리이고 파일은 스냅샷이라 **서버 시작 시 방 디렉터리를 비운다**. 닉네임은 대소문자를 가려 디렉터리 이름으로 쓸 수 없으므로 시작할 때 계정을 한 번 읽어 메모리 색인을 만든다.

**게임 쪽(`src/js/puyow.js`)** — 화면은 `menuScreen`의 `onlineLogin`·`onlineSignup`·`onlineLobby`·`onlineRoom`이고 `getNowScreen()` 이름은 `online_login`·`online_signup`·`online_lobby`·`online_room`이다(WebMCP `screenNames`에도 넣었다). 상태는 `onlineSession`·`onlineSocket`·`onlineRooms`·`onlineRoom`·`onlineForm`·`onlineCreatePopup`·`onlinePrepare`·`onlineResult`에 있으며 **토큰은 메모리에만 두고 저장소에 남기지 않는다**. 비밀번호는 `hashOnlinePassword()`가 sha256으로 한 번 해시해 보내는데, 평문 http에서는 `crypto.subtle`을 쓸 수 없으므로 `puyow.html`이 함께 불러오는 CryptoJS를 먼저 쓰고 Web Crypto는 대비책이다.

**대전 진행** — `startOnlineGame()`이 `game.online = {rule, youAreHost, opponent, defeatSent}`을 만든다. 뿌요 지급 덱은 서버가 준 것을 `game.pairQueue`에 그대로 넣고, `ensurePairQueue()`는 온라인일 때 무작위 생성 대신 덱을 앞에서부터 다시 써서 양쪽이 언제나 같은 뿌요를 받게 한다. 내 조작은 `moveActive()`·`rotateActive()`와 아래 방향키 누름·뗌에서 `sendOnlineInput()`으로 보내고, 받은 상대 조작은 `applyPlayerControlAction()`과 방향 홀드로 우측 플레이어에 적용한다(그래서 `getPlayerInputIndex()`가 `game.online`에서도 1번 자리를 허용한다). 연쇄 결과(`opponent_chain`)는 **다시 적용하지 않는다** — 내 쪽 시뮬레이션이 이미 같은 값을 만들어 두 번 적용하면 공격이 두 배가 된다. 패배는 `updateDefeatSequence()`에서 `reportOnlineDefeat()`으로 한 번만 보고하고, 승패와 WIN POINT는 서버가 확정해 `game_result`로 돌려준다.

**계정 활성 상태(2026-09-16 추가)** — 계정 문서의 `active`가 `false`면 로그인과 방 생성·입장이 막힌다. 아래 관리 페이지 기록을 함께 본다.

**제외와 차이** — 진행도(`recordEnemyClear`), GOLD(`calculateCurrentGameGoldReward`), 역방향 학습(`shouldSendLearningEvent`), 가상 컨트롤러(`shouldShowVirtualController`)는 "너랑 나랑"과 같게 `game.online`도 제외한다. 리플레이는 기록하지 않으며 ESC 일시정지도 막는다. 결과 화면에서는 적 컨트롤러가 없으므로 `drawResultCenter()`가 초상화 대신 `drawOnlineResultPanel()`로 WIN POINT 변화를 그린다(이 분기를 빼면 이겼을 때 널 참조로 터진다). `closeResultScreen()`의 "종료"는 메인 메뉴가 아니라 방 화면으로 돌아가며, 재대전은 방장이 방에서 "시작"을 다시 누른다.

### 모든 적 초상화 재구현 (2026-09-14, BUILDNO 56)

- 등록된 적 13명(솔로몬, 출시 예정 자간 포함)의 일반·위기·패배 총 39종을 머리 하나의 귀여운 인간형 캐릭터로 다시 그렸다. 동물이나 여러 얼굴을 별도 머리로 그리지 않고 의상·머리 장식·소품으로 재해석한다. 이미지 파일·이미지 로딩 없이 Canvas 2D와 `Path2D`만 사용한다.
- 각 클래스의 `drawPortrait(context, x, y, scale, expression)`는 `drawCuteEnemyPortrait()`를 호출한다. 적별 색과 상징은 `ENEMY_PORTRAIT_STYLES`에 있고, 고정 윤곽의 `Path2D`는 `enemyPortraitPaths`에 보관해 매 프레임 다시 만들지 않는다. 외부 적의 공개 API와 재정의 방식은 그대로다. 직접 등록되지 않는 `ChainBuildingEnemy`의 기본 초상화도 인간형 예지자로 갱신했으며, 원래 그림이 없는 내부 `PracticeEnemy`와 기본 `Enemy`는 빈 초상화를 유지한다.
- 일반은 웃는 눈·입과 열린 팔, 위기는 커진 눈·벌어진 입·땀과 움츠린 팔, 패배는 감긴 눈·눈물과 기울고 처진 자세다. 얼굴에 이전 표정을 덧칠하지 않고 상태에 해당하는 표정을 한 번만 그린다. 카드·적 선택·대전·구경·결과·갤러리는 기존 `drawPortrait()` 경로를 사용하므로 모두 같은 그림으로 표시된다.

| 적 | 새 초상화의 특징 |
| --- | --- |
| 솔로몬 | 갈색 머리칼, 금빛 왕관, 보라 망토와 보석 |
| 안드로말리우스 | 초록 제복과 모자, 별 배지, 뱀의 곡선을 담은 목도리 |
| 단탈리온 | 보라색 긴 머리칼과 베레모, 펼친 비밀의 책 |
| 세레 | 하늘빛 머리칼, 작은 왕관, 날개 망토와 방패 |
| 데카라비아 | 분홍 머리칼, 별 모자와 지팡이, 새 날개 모양 장식 |
| 벨리알 | 연분홍 머리칼, 끊긴 후광, 날개와 리본 |
| 암두시아스 | 연보라 갈기, 유니콘 뿔 장식, 하프와 음표 |
| 키마리스 | 짙은 머리칼과 말 귀 장식, 갑옷 머리띠, 보물 지도 |
| 안드레알푸스 | 청록 머리칼, 공작 깃털 부채, 단안경과 천문 궤도 |
| 플라우로스 | 주황 머리칼, 둥근 표범 귀·점무늬·꼬리, 불꽃 장식 |
| 안드라스 | 은청색 새 깃털 두건, 날개, 늑대 문장과 불꽃 장식 검 |
| 발라크 | 금발, 드래곤 뿔과 비늘 튜닉·꼬리, 작은 날개 |
| 자간 | 갈색 머리칼, 굽은 숫소 뿔 장식, 황금 날개와 잔 |

- 회귀 검증은 `tests/test01_portrait.spec.js`에서 실제 브라우저의 13명 × 3표정 × 5배율(카드 0.14, 선택 0.62, 구경 0.72, 대전 0.86, 갤러리 2.8)을 그린다. 빈 그림·가장자리 잘림·표정 중복·적 그림 중복·컨텍스트 상태 누수를 검사하고, 테스트 산출물 `enemy-portraits.png`에 전체 39종 비교 그림을 남긴다. 버전값 자체는 테스트하지 않는다.
- 검증 결과: Chromium·Firefox·WebKit의 초상화 검사 3개와 기존 적 선택·갤러리·카드·구경 화면 검사 12개가 모두 통과했다. 전체 초상화 비교 그림을 직접 확인했고, JS 문법 검사·ESLint·webpack 빌드도 통과해 `src/bundle/puyow.bundle.js`를 갱신했다.

### 텍스트 입력 대화상자 (2026-09-15, BUILDNO 62)

- 공개 `askText(message, multiline = false, maxLength = 2000)`는 초기화된 캔버스 위에 음영 처리된 텍스트 입력 대화상자를 표시하고, 입력 완료 시 문자열을 `Promise`로 반환하며 ESC·취소 시 `null`을 반환한다. `message`는 원문 그대로 표시하고 확인·취소 버튼은 `translate()`를 거친다. `multiline`이 `true`이면 입력창·확인·취소의 세 포커스를 방향키로 옮기며, 입력창에서 Enter를 누르거나 입력창을 마우스로 클릭하면 입력 모드로 전환한 뒤 Enter는 줄바꿈으로 사용한다. 입력 모드의 ESC는 입력 모드를 해제하고, 포커스된 확인·취소 버튼은 Enter로 선택한다. 입력창은 포커스만 있을 때 노란색 빈 표시, 입력 모드일 때 초록색 채운 표시와 커서로 두 상태를 구분한다. 기본값·`null`은 한 줄 입력이며, 문자열이 아닌 `message`나 boolean·null·생략 이외의 `multiline`, 1~1,000,000 정수가 아닌 `maxLength`는 예외다.
- 확인창과 텍스트 입력창은 `dialogQueue` 하나를 공유해 호출 순서를 유지한다. 대화상자가 진행 중인 게임에서 열리면 키보드 방향 입력과 가상 컨트롤러 상태를 초기화하고 게임·배경음악을 일시정지하며, 대화상자 대기열이 모두 끝난 뒤 원래 실행 중이었던 같은 게임만 다시 시작한다. `destroy()`는 현재·대기 중인 대화상자를 확인은 `false`, 텍스트 입력은 `null`로 완료한다.
- 텍스트 입력은 커서 이동·Home/End·Backspace/Delete·Ctrl+A/C/V·Shift+방향키 선택·유니코드 문자 입력을 지원한다. Ctrl+C는 선택 문자열만 복사하며 Ctrl+V는 현재 선택 영역을 클립보드 문자열로 바꾼다. Shift 없이 누른 방향키와 입력창 클릭은 선택을 해제해 해당 방향 끝 또는 클릭한 문자 사이에 커서를 둔다. 선택 영역은 파란색 배경으로 표시되고, 새 문자를 입력하거나 붙여 넣으면 선택 문자열을 먼저 제거한다. 기본 입력값은 최대 2,000자이며, 리플레이·시뮬레이터 JSON 가져오기는 세 번째 인자로 최대 1,000,000자를 허용한다. 마우스로 입력창·확인·취소를 선택할 수 있고 게임패드 확인 입력은 키보드 Enter 경로를 사용한다. 여러 줄 값은 줄바꿈을 보존해 반환한다.
- 리플레이 재생 JSON·설정의 테스트 코드·시뮬레이터 배치 JSON은 네이티브 `window.prompt` 대신 `askText()`를 사용한다. 앞뒤 처리는 Promise 완료 뒤 실행하며, 시뮬레이터 가져오기는 대기 중 해당 시뮬레이터가 닫히거나 재생으로 바뀌면 입력 결과를 버린다.

### 브라우저 커스텀 이벤트 (2026-09-15, BUILDNO 64)

- `window`에 `CustomEvent` 여섯 종류를 발생시킨다(`puyow_prerender`·`puyow_render`는 아래 「렌더링 전·후 커스텀 이벤트」 절). 외부 코드는 반드시 `PuyoW.initialize()` 전에 `window.addEventListener()`로 리스너를 등록하고, 전달값은 모두 `event.detail`에서 읽는다. `puyow_init`은 성공한 초기화 끝에 한 번 발생하며 초기 화면은 `puyow_changescreen`으로 알리지 않는다. `destroy()` 뒤 재초기화하면 새 초기화 이벤트를 다시 한 번 발생시키며, 화면 비교 기준도 초기화한다.
- `puyow_changescreen`은 렌더링 직후 `getNowScreen().screen`이 직전 값과 달라질 때 한 번 발생한다. `detail`은 `{ screen, previousScreen }`이고 두 값은 `getScreenState().screen`의 표준 화면 식별자를 쓴다. 메뉴의 직접 대입과 대전 상태 전환이 섞여 있으므로 개별 대입 지점에 이벤트를 넣지 말고 이 공통 감지 경로를 유지한다.
- `puyow_unlocked`의 `detail`은 항상 `{ content, rule, difficulty }`다. 새 갤러리 예고·적, 새 퍼즐뿌요 스테이지, 일반 적 진행도, 피버 룰 (시작), 구경 모드, 세션 한정 솔로몬을 실제로 처음 열 때만 발생한다. `content`는 `gallery_warning:<type>`, `gallery_enemy:<classType>`, `puzzle_stage:<zero-based index>`, `enemy:<classType>`, `rule:fever_start`, `mode:watch` 중 하나다. 일반 적 진행도 `enemy:`만 해당 대전의 `rule`(`standard`·`fever`·`fever_start`·`relaxed_fever`)과 AI `difficulty`(`easy`·`normal`·`hard`·`extreme`)를 넣고, 나머지는 `null`이다. 저장값 로드와 테스트 코드 적용은 알리지 않는다.
- `puyow_win`은 사람이 CPU 적을 이긴 뒤 모든 정산·종료 연출을 마치고 결과 상태가 된 시점에 한 번 발생한다. `detail`은 `{ difficulty, colorCount, rule, enemy, elapsedMs }`이고 난이도는 AI 난이도 key, 규칙은 `standard`·`fever`·`fever_start`·`relaxed_fever`, 시간은 `game.elapsed` 밀리초다. 구경, 연습·연속 피버·퍼즐뿌요·튜토리얼, 너랑 나랑, 온라인, 리플레이 재생은 제외한다.
- 개발자 사용법과 정확한 식별자·payload는 `HOWTO.md`와 `HOWTO.en.md`에 같은 의미로 기록했다. `tests/common/gamepage.js`는 스크립트 초기화 전에 이벤트를 기록하고, `tests/test01_core.spec.js`가 초기화 한 번·초기 화면 이벤트 부재·`initial_title`에서 `main_menu`로의 화면 이벤트 payload를 확인한다.

### 렌더링 전·후 커스텀 이벤트 `puyow_prerender`·`puyow_render` (2026-09-21, BUILDNO 104)

- `render()`는 `applyCanvasCoordinateTransform()`과 `context.clearRect(0, 0, WIDTH, HEIGHT)`를 마친 **직후**, 다른 게임 그리기 전에 `dispatchPuyoPrerender()`로 `puyow_prerender`를 매번 발생시킨다. `detail`은 `puyow_render`와 같은 `{ canvas, ctx, frameCounts }`이며 초기화 중 첫 `render()`에도 발생한다. 리스너가 그린 내용은 게임 배경·화면 요소보다 먼저 놓인다.
- `render()`의 맨 끝, `dispatchScreenChangeIfNeeded()` 뒤에서 `dispatchPuyoRender()`가 매번 `puyow_render`를 발생시킨다. `detail`은 `{ canvas, ctx, frameCounts }`로, 게임의 2D `canvas` 요소와 `context` 그대로다. 초기화 중 첫 `render()`(`puyow_init` 이전)에서도 발생한다. 게임 그리기가 모두 끝난 뒤라 리스너가 그린 내용이 최상단에 보인다. `ctx`에는 `applyCanvasCoordinateTransform()`의 논리 좌표계(1280×720)가 적용되어 있고 `canvas.width`·`height`는 그래픽 품질에 따른 실제 해상도다.
- 리스너가 바꾼 그리기 상태가 같은 프레임 및 다음 프레임 게임 그리기에 새지 않도록 `dispatchPuyoPrerender()`와 `dispatchPuyoRender()` 모두 발생 전후로 `context.save()`/`restore()`를 `try/finally`로 감싼다.
- `frameCounts`(모듈 변수)는 `render()` 호출 횟수가 아니라 `frame()` 콜백(requestAnimationFrame) 실행 횟수다. `frame()` 첫 줄에서 1 늘리며, `MAX_FRAME_COUNTS`(4294967295)인 상태에서 다음 프레임이 오면 0으로 돌아간다. 초기화 중 첫 `render()`는 0, 첫 애니메이션 프레임은 1이다. `destroy()`에서 0으로 되돌려 재초기화 시 다시 센다.
- 리스너 오류 격리: 브라우저는 리스너 예외를 `dispatchEvent()` 밖으로 던지지 않고 전역 오류로 보고하므로 게임 루프는 원래 멈추지 않는다. 그래도 환경 차이에 대비해 공통 `dispatchPuyoCustomEvent()`가 발생 과정을 `try/catch`로 감싸 `console.error`로 기록만 하므로 여섯 이벤트 모두 게임 진행을 막지 않는다.
- 사용법은 `HOWTO.md`·`HOWTO.en.md`의 브라우저 커스텀 이벤트 절에 같은 의미로 적었다. `tests/common/gamepage.js`의 초기화 전 이벤트 기록 목록에는 매 프레임 쌓이는 `puyow_prerender`·`puyow_render`를 넣지 않는다. `tests/test01_core.spec.js`가 두 이벤트에 대해 초기화 뒤 리스너를 달아 같은 캔버스·컨텍스트 전달, 연속 이벤트의 `frameCounts` 1씩 증가, `globalAlpha` 복원, 매 프레임 예외가 있어도 메인 메뉴 진입과 프레임 증가가 계속되는지를 확인한다. `puyow_prerender`는 Canvas API 호출을 기록해 `clearRect()` 직후라는 순서도 확인한다.
- 검증 결과: ESLint 통과, webpack 번들 재생성. Chromium 전체 278개 중 273개 통과. 실패 5개는 수정 전 커밋(BUILDNO 74)에서도 똑같이 실패하는 기존 실패였다. 사용자 서버가 9891 포트에 떠 있으면 Playwright가 그 서버를 재사용하므로 서버를 끈 뒤 확인했다.
- 기존 실패 원인 조사(2026-09-17):
  - `test03_ai`의 솔로몬 착지 시 요청 취소: BUILDNO 74에서 낙하 속도 증가량이 1분당 0.2에서 `PLAYER_FALL_SPEED_INCREASE_PER_MINUTE`(1.0)로 바뀌어 경과 75분의 배율이 16이 아니라 76이 됐다. 테스트를 16배가 되는 15분으로 고쳤다(3회 반복 통과).
  - 나머지 4개(`test01_core`의 common sound pool, `test01_menu`의 게임패드 A·X·Y 메뉴 입력, `test03_ai`의 AI 서비스 제공자 라디오·Local AI 기본값)는 **이름 입력 강제(faf369c, 2026-09-11)보다 먼저 만든 테스트가 그 변경을 반영하지 못한 것**이다. 게임 코드 결함이 아니다.
    - AI 설정 2개: 저장값에 `playerName`이 없으면 `playerNameSetupRequired`가 참이라 `saveStore()`가 저장을 건너뛴다. `loadStore()`가 메모리에서 `aiProvider`를 보정·Local AI 기본값을 채워도 localStorage에는 기록되지 않아, localStorage를 직접 읽는 단언이 `OpenAI`를 본다.
    - 사운드풀: `enterMainMenu()`가 이름 입력 대화상자를 확인할 때 `playMenuSelectSound()`가 한 번 더 울려 기대 배열 맨 앞에 `test-menu-select.ogg`가 하나 더 붙는다.
    - 게임패드: 이름 없는 새 저장에서 A로 메인 메뉴에 들어가면 이름 입력 대화상자가 뜨고, 다음 A 입력이 규칙 선택이 아니라 빈 이름 확인에 쓰여 화면이 `main_menu`에 머문다.
    - 네 테스트 모두 시작할 때 저장값에 `playerName: 'PLAYER 1'`을 미리 넣도록 고쳤다. AI 설정 2개는 기존 `localStorage.setItem()`의 `settings`에 이름을 더했고, 사운드풀·게임패드는 이름만 저장한 뒤 새로고침해 `initial_title`을 기다린다. **저장값을 직접 넣어 localStorage 보정 결과를 확인하는 테스트나 메뉴 입력 순서를 세는 테스트를 새로 만들 때도 `playerName`을 함께 넣어야 한다.**
  - 수정 후 Chromium 전체 278개가 모두 통과했다.

### 안드레알푸스 advanced 탐색과 실시간 반응 (2026-09-17, BUILDNO 76)

`TODO.md`의 "적 AI 성능 문제·실시간 반응 부재" 고민에서 나온 제안 중, 사용자가 **3수 이상 탐색에만** 성능 개선과 실시간 반응을 적용하고 안드레알푸스에 쓰도록 정했다. 2수 이하 동기 탐색(`simulateNMovePlacements()`·키마리스 등)과 기존 Worker 탐색 경로는 바꾸지 않았다. 다음 20쌍 예고는 적을 유리하게 하려는 의도이며 공정성은 고려하지 않는다(적마다 N수를 달리 해 난이도 조절에 쓴다).

**조사 당시 측정(Node 22, 무작위 4색 보드)** — 메인 스레드 `simulateNMovePlacements()`는 1수 약 3ms·2수 약 20ms·3수 약 370~400ms/수였다. `findBestNMoveBoardResult()`가 후보마다 `simulatePlacementBoard()`·`estimateCombo()`·`estimateAttack()`으로 같은 배치를 3번 시뮬레이션하는 중복이 있으나 2수 이하 경로라 이번에는 고치지 않았다(고치면 약 2.3배). 기존 Worker 3수 탐색은 약 156ms라 안드레알푸스의 50ms 제한 안에 3수를 끝내지 못하고 **실제로는 2수 결과로 두고 있었다**.

**Worker advanced 모드** (`nMoveSimulationWorkerBootstrap` 안, `snapshot.searchMode === 'advanced'`일 때만)
- 보드를 셀 코드 `Int8Array`(0 빈칸, 1~5 색, 6 방해, 7 딱딱, 8 알 수 없는 칸)와 열 높이로 바꾼다. 조작 단계 보드는 항상 중력이 끝난 상태라는 전제로, 착지는 `findFastLanding()`의 높이 비교로 구한다. 폭발 탐색은 스탬프 배열·정수 스택으로, 중력은 열 압축으로 처리한다. **연쇄 수·ATTACK·결과 보드는 기본 규칙과 완전히 같아야 한다.** 개발 중 Node에서 12만 건, 회귀 테스트에서 600건을 `simulatePlacementResult()`와 비교한다. 검증용 Worker 메시지 `resolvePlacements`가 이 비교에 쓰인다.
- 탐색: 현재 수는 모든 후보(허용 목록이 있으면 그 안에서), 그 아래 수는 한 수 평가 상위 `beamWidth`(기본 `N_MOVE_ADVANCED_DEFAULT_BEAM_WIDTH` = 5)개만 재귀한다. 첫 수 아래에서는 같은 색 쌍의 회전 2·3을 건너뛴다. 다음 수를 어디에 두어도 패배하는 경로는 `DEAD_END_PENALTY`(50만)를 뺀다. 반복 심화·`progress`/`done` 메시지·결과 형식은 기존과 같다.
- 평가: 기존 `getPlacementScore()`(싹쓸이 200만·목표 연쇄 100만·조기 연쇄 감점)를 그대로 쓰되, 보드 점수에 발화점 점수 `연쇄² × 400 − (필요 뿌요 수 − 1) × 300`(2연쇄 이상일 때)을 더한다. 발화점은 각 열 맨 위에 옆·아래와 같은 색을 한 개(안 되면 두 개) 떨어뜨렸을 때의 최대 연쇄다.
- 방해뿌요: `snapshot.realtime = { incoming, garbageMoveIndex }`가 있으면 그 배치 순번까지 보낸 ATTACK만 상쇄로 보고, 그 배치 뒤 남은 양이 있으면 한 줄을 채우는 몫(`floor(남은 양/6)`줄)을 보드에 올려 이어 읽는다. 그 배치에서 연쇄가 없고 위험 열 높이 + `ceil(남은 양/6)`이 11을 넘으면 후보에서 뺀다. 경로가 도착 순번보다 짧으면 잎 보드의 발화점 ATTACK까지 상쇄 가능량으로 어림한다. 비교는 긴급(받을 양 ≥ 무시 기준)일 때 "위험 해소 여부 → 남은 양 → 점수 → 최대 연쇄 → 큰 X" 순이다.
- 측정: advanced 3수(반복 심화 1~3수 합계) 평균 약 17ms, 기존 Worker 3수 약 156ms. 혼자 60수 두기 20판 비교에서 기존 방식(시간 제한 없이 3수)은 4패·2연쇄 이상 발사 48회, advanced는 0패·62회(7연쇄 이상 47회)였다.

**메인 스코프**
- `predictPlayerChain(player)`: 연쇄 중(`isResolutionPhase`)인 플레이어의 보드 복사본으로 남은 연쇄를 끝까지 풀어 `{ active, currentCombo, remainingCombo, finalCombo, finalAttack, endInMs }`를 낸다. 연쇄 보너스를 위해 `player.combo`부터 이어 센다. 시간은 `CHAIN_PHASE_WAIT_MS`(150, `updatePlayer()` 대기와 같아야 함)·`EXPLOSION_EFFECT_DURATION_MS`(430, `resolveExplosions()` 연출과 같아야 함)·`measureGravityOnBoard()`(startGravity와 같은 식)의 합이다. 이 상수를 바꾸면 두 곳을 함께 고친다. 싹쓸이 티켓·피버 최소 공격은 넣지 않는다.
- `getRealtimeGarbageForecast(player, opponent)`: `incoming = floor(max(기존 예고량, damage + 예측 최종 ATTACK))`. 기본 룰에서 상대 연쇄가 진행 중이고 그 공격이 확정 DAMAGE보다 크면, 연쇄 종료 시각을 "현재 뿌요 착지 시간 + 300ms(고정 후 garbage 단계) + m × (450ms + 한 배치 낙하 시간)"과 비교해 `garbageMoveIndex`를 구한다. 낙하 시간은 평균 열 높이, 자연 낙하 간격, 난이도별 빠른 하강 대기(적의 일반·위기 비율 반영) 뒤 55ms/칸으로 어림한다. 연속 피버·적 자신이 피버 중·확정 DAMAGE뿐인 경우는 0이다. 피버 룰 일반 상태는 아래 「피버 룰 실시간 반응」의 `fever` 항목을 따로 담는다. 배치 시간 어림은 `estimateAiPlacementTiming()`으로 분리했다. `predictPlayerChain`·`predictFeverStageChain`·`getRealtimeGarbageForecast`를 `PuyoW.common`에 공개했다.
- `getReachableAiPlacements(player)`: 지금 위치에서 "회전 후 이동"이나 기존 `canUseAiPlacement()`의 "이동 후 회전(킥 포함)"으로 갈 수 있는 `aiSimulations` 후보만 돌려준다.
- `startWorkerLookaheadSearch(enemy, player, { allowedPlacements, keepDecisionElapsed })`: 적의 `lookaheadSearchMode`·`lookaheadBeamWidth`를 Worker 옵션으로 넘긴다. `keepDecisionElapsed`면 `applyWorkerSearchResult()`가 `aiDecisionElapsed`를 0으로 되돌리지 않는다(`enemy.workerSearchKeepsDecisionElapsed`, `beginWorkerSearchTurn()`에서 false로 초기화). 재탐색이 결과를 못 내면 직전 `attackPlacement`를 유지하고, `simulateNMovePlacementsInWorker()`의 동기 대체도 허용 목록 안에서만 고른다.

**안드레알푸스** — `lookaheadSearchMode = 'advanced'`, `lookaheadBeamWidth = 5`, `realtimeReaction = true`이며 3수·50ms는 그대로다(목표 연쇄는 BUILDNO 76 당시 7, BUILDNO 82부터 5). `prepareTurn()`에서 Worker 탐색을 시작한 턴에만 `realtimeReactionState = { turn(placedPairCount), incoming, opponentChainActive, fastDownStarted, replanCount }`를 만든다. `updateControl()`이 매 프레임 `updateRealtimeReaction()`을 불러, 받을 양이나 상대 연쇄 진행 여부가 바뀌면 도달 가능 후보로 재탐색한다. **사용자 요구: 빠른 하강 대기 시간 안에서만 재판단하고, 이번 턴에 빠른 하강을 시작했으면 재판단하지 않는다.** `useFastDown()`이 처음 true를 돌려준 순간 `fastDownStarted`를 세운다. 쉬움 난이도는 빠른 하강이 없으므로 착지 전까지 재판단할 수 있다. 바뀌기 전후 받을 양이 모두 무시 기준(`getLookaheadIgnorableIncomingGarbage()`: 기본 룰 `ignorableIncomingGarbage`(4), 피버 룰 1) 미만이면 기준 상태만 갱신한다. 재판단 비교는 `getRealtimeReactionSignature()`(받을 양·상대 연쇄 진행·상대 피버 패턴 예측의 연쇄 수와 ATTACK)이며 시간에 따라 바뀌는 도착 순번은 넣지 않는다. 연속 피버·적 자신이 피버 중·공통 우선 후보(피버·패배 위치 보호·80% 보호) 턴에서는 재판단하지 않는다. 재탐색 중에는 기존처럼 이동을 멈추고 빠른 하강도 하지 않는다(Worker 결과는 `player.active` 객체가 같아야 적용되기 때문이다).
- `python/bundledenemy.py`의 안드레알푸스는 기존 완전 탐색을 유지한다(모듈 docstring에 이유를 적었다).
- 회귀 테스트(`tests/test01_enemy.spec.js`): 빠른 배치 계산과 기본 규칙 600건 비교(게임이 만든 Worker를 `window.Worker` 감싸기로 붙잡아 `resolvePlacements` 전송), advanced 깊이 1·2·3 전달과 허용 목록 제한, 곧 떨어질 방해뿌요 12개에 2연쇄로 상쇄(공격이 없으면 아껴 둠, 싹쓸이가 되지 않게 연쇄와 무관한 뿌요를 둠), 상대 연쇄 예측의 연쇄 수·ATTACK·시간·연쇄 번호 이어 세기, 실제 대전에서 빠른 하강 전 재판단 시작과 빠른 하강 시작 뒤 재판단 차단.

### 안드레알푸스 피버 룰 실시간 반응 (2026-09-17, BUILDNO 77)

`TODO.md`의 사용자 결정대로, 기본 룰의 advanced 탐색·실시간 재판단을 피버 룰·피버 룰 (시작)·피버 룰 (완화)로 넓혔다. 세 규칙은 모두 `game.feverRule`을 공유한다(완화는 도장깨기와 구경에서 선택할 수 있고, 시작은 양쪽이 피버로 시작하므로 적의 첫 피버가 끝난 뒤부터 동작). **적 자신이 피버 중이면 실시간 반응을 하지 않고** 기존 피버 공통 규칙(최대 연쇄 우선, `preparedPlacement`)을 쓴다. 다른 적과 기본 룰 동작은 바꾸지 않았다.

**사용자 결정 사항(구현 기준)**
- 피버 룰 일반 상태에서 상쇄로 전등을 켜는 행동에 가중치를 준다. 목적은 빠르게 피버에 들어가는 것이므로 **단계당 공격을 작게**(터지는 색 뿌요를 적게) 해서 받을 예고가 남아 있는 동안 더 많은 단계가 상쇄되게 한다. 연쇄 수가 많은 것은 괜찮다(단계마다 점등).
- 상쇄할 예고(유예된 것·곧 떨어질 것·진행 중 상대 연쇄 모두 포함)가 있을 때 **이번 수(1턴)** 기준 우선순위: ① 목표 연쇄 ② 목표 미만이지만 다 받아치고 방해뿌요를 하나라도 넘기는 역공 ③ 점등.
- 이번 수 최대 공격이 받을 양보다 작으면(다 상쇄 불가) 작은 연쇄로 일부러 점등할지 `lightFeverGaugeWithSmallChains`로 켜고 끈다. **기본값 켜짐.** 끄면 그 상황에서 목표 연쇄를 계속 쌓는다. 켜짐은 피버 진입까지 못 가도 전등을 켜러 쏜다는 뜻이다.
- 상쇄로 전등 7개가 다 켜지는 경로는 피버 패턴이 무작위로 정해지므로 그 뒤를 읽지 않는다.
- 상대가 피버 중이면 현재 피버 패턴으로 연쇄를 예측하되 **상대가 즉시 빠른 하강한다고 가정**하고, 상대가 실제로 연쇄를 시작하면 실제 연쇄로 다시 예측한다(일부러 작게 터뜨릴 수 있으므로).
- 안드레알푸스는 피버 룰에서 무시 기준을 쓰지 않는다. 그 밖의 명시되지 않은 사항은 추천안을 따랐다(아래).

**메인 스코프**
- `predictFeverStageChain(opponent)`: 피버 중·조작 단계인 상대의 현재 뿌요를 모든 위치로 두어 최대 연쇄(같으면 큰 ATTACK)를 고르고, 없으면 연쇄 없는 첫 배치 뒤 다음 1쌍까지 본다(추천안). 고른 배치 직후 보드를 `measureGravityOnBoard()`(피버 중력 1.5배)와 가짜 `gravity` 단계 `predictPlayerChain()`에 넣어 연쇄 수·ATTACK·시간을 구한다. 배치 탐색 결과는 `feverStageChainPredictionCache`(WeakMap, 키: 피버 회차·턴·배치 수·현재/다음 색)로 같은 조작 턴 동안 재사용하고, 착지 시간만 현재 Y × 빠른 하강 간격(55ms)으로 매번 다시 계산한다. `startInMs`는 첫 폭발 시각, `endInMs`는 연쇄 종료 시각이다.
- `getFeverRealtimeGarbageForecast()`: 피버 룰에서 CPU가 일반 상태이면 `getRealtimeGarbageForecast()`가 이쪽으로 넘어가 `fever: { gauge, gaugeMax, events, predictedOpponentFeverChain }`를 만든다. `events`는 `{ amount, availableMove, landMove }` 묶음이다 — 확정 DAMAGE(0, 0), 진행 중 상대 연쇄의 나머지(0, 연쇄 종료 시각의 배치 순번), 상대 피버 패턴 예측(첫 폭발 뒤 CPU 첫 폭발이 가능한 배치 순번, 종료 시각의 배치 순번). `incoming`은 묶음 합계다.
- 스냅샷의 `realtime.fever.lampChains`에 `lightFeverGaugeWithSmallChains`를 싣는다. `startWorkerLookaheadSearch()`는 적에 `getLookaheadIgnorableIncomingGarbage(player)`가 있으면 그 값을 `urgentGarbageThreshold`로 쓴다.

**Worker (advanced, `feverModel`)** — `snapshot.rules.feverRule && realtime.fever && !self.fever.active`일 때만 켠다. 이때 기본 룰용 `incoming`·`garbageMoveIndex`·위험 우선 비교(`urgent`)는 쓰지 않는다.
- `resolveFastChain(..., record)`가 단계별 ATTACK(`links`)과 터진 색 뿌요 수(`popped`)를 기록한다(기록 없이 부르면 기존과 같다).
- `applyFeverOffsets()`: 단계마다 누적 ATTACK을 더하고, 지금 상쇄 가능한(`availableMove <= 수`) 예고가 있으면 최소 공격 1을 보장한 뒤 정수 부분만큼 상쇄한다. 상쇄한 단계마다 전등 +1, 남은 누적의 정수 부분이 역공(`overflow`)이다. 먼저 도착할 묶음부터 줄인다.
- 낙하: 터지지 않은 배치이고 피버에 들어가지 않았을 때만, 도착한(`landMove <= 수`) 묶음을 최대 30개 떨어뜨린다(한 줄 몫만 보드에 올리고 위험 열 높이 + ceil(양/6) > 11이면 후보 제외).
- `decideFeverSearchMode()`: 요청마다 첫 수 후보를 한 번 풀어 모드를 정한다. 지금 상쇄 가능한 예고가 없으면 `none`(기존 점수). 있으면 목표 연쇄 후보가 있으면 `target`, 다 받아치고 역공 1 이상 후보가 있으면 `counter`(둘 다 첫 수를 그 후보로 제한하고 기존 점수로 고름), 그 밖에는 이번 수 최대 전송량(상쇄 + 역공)이 받을 양보다 작으면 설정에 따라 `lamp`/`build`, 아니면 `lamp`.
- 점수: `lamp` 모드에서 상쇄가 일어난(또는 터지지 않은) 배치는 `보드 점수 + 전등 × 100,000 − 터진 색 뿌요 × 2,500 + 역공 × 200 (+ 싹쓸이 200만)`이고, 상쇄 없이 터뜨린 배치는 기존 점수(조기 연쇄 감점)를 쓴다. 모든 모드에서 전등이 다 켜지면 `FEVER_ENTRY_SCORE`(40만)를 더하고 더 읽지 않는다(패배 경로 감점도 없음). `build`는 기존 점수 그대로다.
- 상대 예측 연쇄가 아직 시작 전이면 그 묶음은 `availableMove` 전에는 상쇄할 수 없어, 지금 작은 연쇄를 쏠 이유가 없다(추천안 "받아칠 연쇄를 아껴 둔다"가 이렇게 나온다).
- 개발 중 Node 시나리오 8개와 회귀 테스트로 확인했다: 받을 것 없음 → 쌓기, 20개·점등 켜짐 → 2연쇄 점등, 꺼짐 → 쌓기, 목표 2연쇄 가능 → 목표 연쇄, 2개 → 역공, 전등 5 → 2단계로 피버 진입, 높은 필드에 30개 즉시 도착·꺼짐 → 연쇄로 낙하 미룸, 상대 예측 연쇄(2수 뒤 상쇄 가능) → 지금 쏘지 않음. 기본 룰 탐색 결과·속도(평균 약 16ms)는 바뀌지 않았다.

**회귀 테스트** — `tests/test01_enemy.spec.js`의 "advanced Worker 탐색은 피버 룰 일반 상태에서…"(위 8개 시나리오를 게임 Worker에 직접 보냄), `tests/test01_fever_damage.spec.js`의 "피버 룰 실시간 예측은…"(실제 피버 룰 구경 대전에서 상대 피버 패턴 예측·예고 묶음·실제 연쇄 시작 뒤 재예측)과 "안드레알푸스는 피버 룰 일반 상태에서 무시 기준 없이…"(방해뿌요 1개에도 재판단, 빠른 하강 시작 뒤 차단). 실제 피버 룰·완화 구경 대전을 안드레알푸스 포함으로 50초씩 돌려 오류가 없음을 따로 확인했다(임시 스크립트, 저장소에 남기지 않음).

### 실시간 N수 탐색 공통 클래스 `RealtimeLookaheadEnemy` (2026-09-17, BUILDNO 78)

사용자가 안드레알푸스 알고리즘을 다른 적에도 넓히려고 공통 클래스로 분리를 요청했다. **동작은 바꾸지 않고 구조만 나눴다.**

- `RealtimeLookaheadEnemy extends BundledEnemy`에 안드레알푸스의 판단 전체(탐색 설정 필드, `prepareTurn`·`chooseTarget`·`chooseRotate`·`updateControl`·`useFastDown`, 실시간 재판단 `updateRealtimeReaction`·`getRealtimeReactionSignature`·`getLookaheadIgnorableIncomingGarbage`, 호환용 2수 탐색 등)를 옮겼다. `PuyoW.RealtimeLookaheadEnemy`로 공개한다(`OnnxEnemy`와 같은 방식).
- **적마다 다르게 정하는 값은 constructor 옵션 두 개뿐이다(사용자 지정).** `super({ targetCombo, lightFeverGaugeWithSmallChains })` — `targetCombo`는 1 이상 정수(기본 7, 아니면 `RangeError`), `lightFeverGaugeWithSmallChains`는 boolean(기본 true, 아니면 `TypeError`). 그 밖의 탐색 수(3)·시간(50ms)·빔 폭(5)·무시 기준(4, 피버 룰 1)·빠른 하강 비율(1.0/0.5)은 공통값이며, 필요하면 하위 클래스 constructor에서 필드를 덮어쓸 수 있다.
- `Andrealphus extends RealtimeLookaheadEnemy`는 `super({ targetCombo: 5, lightFeverGaugeWithSmallChains: true })`(BUILDNO 82부터, BUILDNO 78 당시 7), `sortPriority = 8`, `notAvail = false`, `getClassType()`·`getName()`·`getFieldThemeColors()`·`drawPortrait()`만 가진다. 공통 클래스의 `getClassType()`은 `'RealtimeLookaheadEnemy'`를 돌려주며 하위 클래스가 반드시 재정의해야 하고, 공통 클래스 자체는 적 목록에 등록하지 않는다.
- **새 적을 이 클래스로 만들 때 함께 할 일**: 적 종류 문자열로 동작이 갈리는 `RANDOM_EMPTY_FIELD_ENEMY_TYPES`(빈 필드 무작위 첫 배치)와 `ENEMY_GOLD_BONUSES`(GOLD 배율)에 새 종류를 넣는다. 적 목록 등록(`createOpponentEntry`), 번역 문자열, 초상화 팔레트, `python/bundledenemy.py` 이식 여부도 기존 적 추가 절차대로 확인한다. `python/bundledenemy.py`의 안드레알푸스는 이번에도 바꾸지 않았다.
- 회귀 테스트: `tests/test01_enemy.spec.js`의 "실시간 N수 탐색 공통 클래스는…"이 상속 관계, 안드레알푸스가 직접 가진 메서드 목록(constructor·drawPortrait·getClassType·getFieldThemeColors·getName), 기본값·사용자 지정값, 공통값이 같음, 잘못된 옵션의 예외를 확인한다.

### [반복 작업 절차] 적 AI 한 칸씩 밀기

BUILDNO 113에서 대규모 이관을 수행했다. 다음 작업은 위 「현재 AI 배정」과 최신 TODO를 기준으로 하며, 아래 과거 기록의 이름을 현재 AI 담당 적으로 간주하지 않는다.

1. **변경 전 원본을 고정한다.** 원본이 다른 AI를 받을 수 있으므로 수정 도중의 클래스를 기준으로 복사하지 않는다. 판단·목표 연쇄·상쇄 임계값·회전 규칙·하강 속도·피버 예외·상속 메서드 전체를 함께 옮긴다. 여러 대상이 같은 AI를 쓰면 표시 메서드를 분리한 공통 클래스로 보존한다.
2. **게임 연결**: 각 대상의 모델 경로·출시 상태·`requiresOnnx`를 적용한다. 이름·타입·초상화·테마·순서·저장 기록·GOLD 배율은 별도 요청 없이 바꾸지 않는다. `RANDOM_EMPTY_FIELD_ENEMY_TYPES`도 AI에 맞춘다. 경고·첫 선택 확인·런타임 필터·구경 필터는 `requiresOnnx`, 카드·진행도·리더보드·출시 예정 잠금은 `notAvail`에 따라 확인한다.
3. **Python**: 같은 배정으로 `bundledenemy.py`의 전략·설정·`ENEMY_FACTORIES`를 갱신한다. `TRAINABLE_ENEMY_TYPES`는 출시된 모델 미사용 적만 포함한다. 이관 대상이 `CHAIN_GUIDE_ENEMY_TYPES`에 있으면 기존 안내 전략을 이어받은 적으로 연결하고 UI 설명도 맞춘다. 기존 Python 이식의 단순화 범위는 유지한다.
4. **검증**: 기존 AI 동작 검사의 대상을 새 담당 적으로 옮긴다. 모델 로딩·실시간 반응·첫 확인·느낌표·런타임 없음·출시 예정 선택 차단·구경 후보·카드·리더보드 목록을 확인한다. 회귀 검사는 `npm.cmd test`, 관련 Playwright 검사, `python -B -m unittest test_learning`을 쓴다. 기존 소스와 AI 상태·판단 메서드를 비교하면 전체 설정 이관을 확인할 수 있다. 버전값은 테스트하지 않는다.
5. **마무리**: `puyow.js` BUILDNO는 작업당 한 번 증가시키고 `package.json`·`package-lock.json` 패치 번호를 맞춘다. 번들을 빌드하고 이 문서와 `docs/Enemy*.md`, `docs/MachineLearning*.md`의 현재 계약을 갱신한다. 커밋하지 않는다.

### 실시간 N수 탐색 적의 목표 연쇄 차별화 (2026-09-17, BUILDNO 82)

같은 `RealtimeLookaheadEnemy` 판단을 쓰는 세 적을 사용자 요청으로 목표 연쇄 수만 다르게 했다. 나머지 설정(작은 연쇄 점등 켜짐, 탐색 수·시간·빔 폭, 무시 기준, 빠른 하강 비율)은 같다.

| 적 | 목표 연쇄 |
|---|---|
| 안드레알푸스 `Andrealphus` | 5 (그 전에는 7) |
| 플라우로스 `Flauros` | 6 (그 전에는 7) |
| 안드라스 `Andras` | 7 |

- 게임은 각 생성자의 `super({ targetCombo, ... })` 값만 바꿨다. 목표 연쇄는 advanced 탐색의 목표 연쇄 가산점·조기 연쇄 감점과, 피버 룰 첫 수 우선순위의 "목표 연쇄 가능" 판정에 함께 쓰인다.
- `python/bundledenemy.py`도 같게 맞췄다. `Andrealphus.target_combo`를 5로 바꾸고, `Flauros`(6)·`Andras`(7)는 생성자에서 목표 연쇄만 덮어쓴다. 파이썬 안드레알푸스는 `learning.py`의 연쇄 유도 탐험 안내 적(`CHAIN_GUIDE_ENEMY_TYPES`)이기도 하므로, 그 안내 수도 5연쇄 기준으로 바뀐다.
- 테스트: `test01_enemy.spec.js`의 안드레알푸스 Worker 싹쓸이 테스트·공통 클래스 테스트 기대값을 5로 바꿨다. 모델 미사용 적 반복 테스트는 목표 연쇄를 공통 설정 비교에서 빼고 적별 기대값(플라우로스 6·안드라스 7)으로 확인한다. `python/test_learning.py`에 `test_realtime_family_differs_only_by_target_combo`를 추가했다.

### 피버 유예 예고 상쇄 에너지 연출 (2026-09-18, BUILDNO 83)

- 피버가 활성화된 플레이어가 자기 연쇄로 `normalDamage`(피버 종료 뒤 일반 필드로 떨어질 유예 DAMAGE)를 상쇄할 때, 기존 `sendAttackEnergy()`는 수치와 전등 규칙만 처리하고 `queueEnergyTransfer()`의 상쇄 경로에는 그 값을 넘기지 않았다. 피버 DAMAGE와 상대 ATTACK이 모두 0이면 빈 경로가 되어 에너지 이동 효과가 아예 생기지 않았고, 다른 상쇄와 함께여도 유예분은 자기 필드 천장으로 가는 연출에서 빠졌다.
- `queueEnergyTransfer()`의 선택적 `cancelledNormalDamage` 인자로 유예분을 상쇄 경로 생성 조건에 포함했다. 이 값은 이미 `normalDamage`에서 차감한 수치라 `warningReductionDelay`를 다시 줄이지 않는 `normalAmount` 메타데이터로만 보관한다. 따라서 상쇄·예고·DAMAGE 정산 순서는 그대로이며, 에너지 구체만 자기 필드 천장까지 이동한다. 남은 공격이 있으면 기존처럼 이어서 상대 천장으로 간다.
- 이 경로는 `game.feverRule && player.fever.active`를 쓰므로 피버 룰·피버 룰 (시작)·피버 룰 (완화)에 공통 적용된다. `tests/test01_fever_damage.spec.js`는 실제 피버 룰·완화 룰 구경 대전에서 유예 DAMAGE만 상쇄하고, 리플레이의 `et` 에너지 표본이 남는지 확인한다. 피버 룰 (시작)은 같은 상쇄 함수·피버 상태 분기를 공유한다.
- 검증: 새 회귀 2개를 Chromium·Firefox·WebKit에서 모두 통과했고, `node --check src/js/puyow.js`와 `npm.cmd test`도 통과했다. BUILDNO는 83, `package.json`·`package-lock.json`의 패키지 버전은 `0.0.83`이며 버전값 자체는 테스트하지 않았다.

### 적 AI 한 칸씩 밀기 2차 (2026-09-17, BUILDNO 81)

`TODO.md` 요구: 다른 AI가 출시 예정 적 바퓰라·오리아스를 추가(BUILDNO 80)한 뒤, 바퓰라를 출시하고 오리아스는 출시 예정으로 두며, 안드라스~자간의 AI를 한 칸씩 밀고 안드라스를 플라우로스와 같은 방식으로 모델 미사용 적으로 만든다. 위 「[반복 작업 절차]」를 그대로 따랐다.

| 적 | BUILDNO 80까지 | BUILDNO 81부터 |
|---|---|---|
| 안드라스 `Andras` | `OnnxEnemy` · `model01.onnx` | `RealtimeLookaheadEnemy` (플라우로스·안드레알푸스와 동일: 목표 7연쇄·작은 연쇄 점등 켜짐) |
| 발라크 `Valak` | `model02.onnx` | `model01.onnx` (모델을 쓰는 첫 적) |
| 자간 `Zagan` | `model03.onnx` | `model02.onnx` |
| 바퓰라 `Vapula` | 출시 예정 · `model03.onnx`(임시) | 출시 · `model03.onnx` |
| 오리아스 `Oriax` | 출시 예정 · `model03.onnx`(임시) | 그대로 |

- 목표 연쇄·점등 설정은 TODO의 "플라우로스가 그랬던 것처럼 마찬가지로"에 따라 7·켜짐으로 했다. `RANDOM_EMPTY_FIELD_ENEMY_TYPES`에 `Andras`를 넣었고 GOLD 배율은 바꾸지 않았다.
- 느낌표·첫 선택 안내·런타임 없음 숨김·구경 후보 제외는 `requiresOnnx` 기준이라 코드 변경 없이 발라크부터 적용된다. 이름으로 막는 코드가 없음을 확인했다. 바퓰라 출시로 카드 풀(`enemy:Vapula`, 가중치 1)과 진행도(자간을 이기면 해금)에 자동으로 들어간다.
- `python/bundledenemy.py`에 `class Andras(Andrealphus)`를 추가하고 `ENEMY_FACTORIES`에 넣어 학습 대전 상대(무작위 풀·`--opponent Andras`)가 되게 했다.
- `package-lock.json`의 버전이 0.0.79로 뒤처져 있어 `package.json`과 함께 0.0.81로 맞췄다.
- 테스트: `test03_ai.spec.js`의 ONNX 추론 적 테스트를 발라크 기준(`ArrowRight` 10번)으로 옮기고, 느낌표 테스트는 발라크·자간에 마크가 있고 플라우로스·안드라스에는 없음을 확인한다. `test01_core.spec.js`의 ONNX 적 3종을 발라크·자간·바퓰라로 바꾸고, 바퓰라·오리아스 테스트를 "출시된 바퓰라와 출시 예정 오리아스…"로 고쳤다. `test01_menu.spec.js`의 카드 테스트(바퓰라 유효·오리아스 제외)와 출시 예정 선택 차단 테스트(바퓰라까지 `ArrowRight` 12번, 오리아스 회색 카드 클릭)를 고쳤다. `test01_enemy.spec.js`의 모델 미사용 적 판단·구경 모드 선정 테스트는 플라우로스·안드라스를 도는 반복 테스트로 바꿨다. `python/test_learning.py`의 `TrainableOpponentPoolTest`는 모델 미사용 적·ONNX 적 튜플로 확인하도록 바꿨다.

### 적 AI 한 칸씩 밀기 (2026-09-17, BUILDNO 79)

`TODO.md` 요구대로 모델 미사용 AI를 한 적 늘리면서 ONNX 적의 모델을 한 칸씩 뒤로 밀었다. 캐릭터(이름·종류 문자열·정렬 순서·테마·초상화)와 진행도 순서는 그대로다.

| 적 | BUILDNO 78까지 | BUILDNO 79부터 |
|---|---|---|
| 플라우로스 `Flauros` | `OnnxEnemy` · `model01.onnx` | `RealtimeLookaheadEnemy` (안드레알푸스와 동일: 목표 7연쇄·작은 연쇄 점등 켜짐) |
| 안드라스 `Andras` | `model02.onnx` | `model01.onnx` |
| 발라크 `Valak` | `model03.onnx` | `model02.onnx` |
| 자간 `Zagan` | 출시 예정 · `model01.onnx`(임시) | 출시 · `model03.onnx` |

- ONNX 경고 표시(이름 옆 느낌표)와 첫 선택 불안정 안내는 `requiresOnnx` 기준이라 코드 변경 없이 안드라스부터 적용된다. 같은 기준으로 ONNX 런타임이 없을 때 적 선택 화면에서 숨기는 적·구경 모드 후보에서 빼는 적도 안드라스부터다. 플라우로스는 이제 런타임과 무관하게 보이고 구경 후보에 들어간다. 구경 후보(`getWatchOpponentCandidates()`)는 `requiresOnnx`와 `WATCH_EXCLUDED_OPPONENT_TYPES`(솔로몬·안드로말리우스·단탈리온)로만 거르고 플라우로스를 이름으로 막는 곳이 없어 코드 수정이 필요 없었다. 다른 적과 같이 보통 이상 승리 기록(observation 코드 적용 시 무조건)이 있어야 후보다. `test01_enemy.spec.js`의 "구경 모드 무작위 적 선정은 모델을 쓰지 않는 플라우로스를 포함하고…"가 데카라비아·플라우로스·안드라스만 이긴 기록으로 데카라비아와 플라우로스가 맞붙는지 확인한다.
- 플라우로스를 `RANDOM_EMPTY_FIELD_ENEMY_TYPES`에 넣어 빈 필드 첫 배치까지 안드레알푸스와 같게 했다. `ENEMY_GOLD_BONUSES`(GOLD 배율)는 AI가 아니라 보상이므로 바꾸지 않았다(플라우로스·안드라스·발라크·자간은 여전히 1).
- 자간 출시로 카드 풀에 `enemy:Zagan`(가중치 1)이 자동으로 들어간다(`notAvail`이 아닌 비고정 적 규칙).
- `python/bundledenemy.py`의 `Flauros`는 안드레알푸스를 상속하도록 바꿨고, 사용자 확인에 따라 학습 대전 상대(`ENEMY_FACTORIES`·`TRAINABLE_ENEMY_TYPES`)에도 넣었다. 그래서 `learning.py --opponent random`의 무작위 풀과 `--opponent Flauros` 고정 대전 모두에 쓰인다(무작위 300판 중 36판, 다른 적과 비슷한 비율). ONNX 적(안드라스·발라크·자간)은 여전히 넣지 않는다. `python/test_learning.py`의 `TrainableOpponentPoolTest`가 확인한다.
- 테스트: `test03_ai.spec.js`의 ONNX 추론 적 테스트(모델 로딩·실패, 느낌표·첫 선택 안내, 추론 마감 시한, 프록시 Worker 실패, CDN/로컬 wasm, 런타임 없음·갤러리)를 플라우로스 대신 안드라스(적 선택에서 오른쪽 9칸, `model01.onnx` 경로 그대로)로 옮기고, 플라우로스는 표시·마크가 없음을 함께 확인한다. `test01_core.spec.js`의 ONNX 적 3종 설정 기대값, `test01_menu.spec.js`의 카드 테스트(자간 카드도 이제 유효), `test01_enemy.spec.js`의 플라우로스 판단 테스트를 갱신·추가했다.

### 온라인 플레이 저장소 분리와 서버 안내 (2026-09-15)

- 파일 입출력은 `node/onlineplay_storage.js`와 `python/onlineplay_storage.py`의 `FileOnlinePlayStorage`로 분리했다. Node는 `createService({enabled, storage})`, Python은 `OnlinePlayService(enabled, storage=...)`로 다른 저장소를 주입할 수 있다. 생략하면 기존 홈 디렉터리의 파일 저장소를 사용한다. 생성자는 I/O를 하지 않으며 비활성 서비스에서는 저장소 메서드를 호출하지 않는다.
- 계약은 동기식 `initialize`, `loadNicknameIndex`/`load_nickname_index`, `listAccounts`/`list_accounts`(2026-09-16 추가, 관리 화면 목록용), `loadAccount`/`load_account`, `saveAccount`/`save_account`, `saveRoom`/`save_room`, `removeRoom`/`remove_room`, `clearRooms`/`clear_rooms`이다. Node에 Promise 반환 저장소를 그대로 연결하지 않는다. 닉네임 색인 로딩은 저장소에서 하고 가입 이후 색인 갱신·입력 검증·bcrypt·점수 계산·메모리 방과 세션·잠금은 서비스에 남긴다.
- 기존 경로·JSON·예외 정책·처리 순서를 유지했다. 서버 시작 시 방 스냅샷만 지우고 계정은 보존한다. 방장 이양 시 옛 ID 스냅샷을 삭제하고 새 ID로 저장한다. 계정 저장 오류는 전파하고 방 저장 오류는 서비스에서 처리한다(Python은 OSError). 동시 가입·복수 계정 점수 저장의 원자성은 이번 리팩터링에서 변경하지 않았다.
- `docs/Server.md`와 `docs/Server.en.md`에 실행·종료·포트, 온라인 설정, 저장소 계약, SQLite/MariaDB 교체, HTTP/WebSocket API를 설명했다. HOWTO 양쪽에서 연결한다. `docs/examples/onlineplay_sql.js`·`onlineplay_sql.py`는 실제 교체 가능한 학습용 예제이며 기본 서버에는 연결하지 않았다. Node MariaDB는 동기 계약을 맞추기 위해 별도 프로세스 도우미를 쓰므로 운영 성능용 설계가 아니다. SQLite는 로컬 파일이며 IP·포트가 없고, MariaDB 설명의 192.168.0.15:3306은 예시일 뿐이다.
- `tests/onlineplay_storage.node.cjs`는 임시 파일/SQLite 저장소와 실제 HTTP/WebSocket으로 가입·로그인·결과·방장 이양·재시작을 확인한다. `python/test_onlineplay_storage.py`는 관리 스레드 시작을 막고 서비스 흐름을 직접 실행한다. 두 테스트는 `tests/onlineplay.fixture.json`으로 기존 JSON 계약을 확인하며 실제 홈 저장소를 건드리지 않는다. Node 22.12 SQLite 검사는 `node --experimental-sqlite --test tests/onlineplay_storage.node.cjs`, Python 검사는 `python -B -m unittest discover -s python -p test_onlineplay_storage.py`로 실행한다. 실제 MariaDB와 브라우저 두 클라이언트의 온라인 대전 검증은 별도다.
- 기존 Node/Python 차이를 문서에 명시했다. 방 createdAt·게임 startedAt은 Node 밀리초/Python 초, 계정 createdAt은 UTC 문자열이다. Node `/apis/learning`에는 `Bearer localhost` 전용 우회가 없고 Python에는 있다. Node `/apis/solomonlearning`은 인증·메서드·본문 검증 없이 수신만 한다. 이 차이들은 이번 작업에서 바꾸지 않았다. `puyow.js`는 수정하지 않아 BUILDNO와 패키지 버전은 그대로다.

- 검증 결과: Node 저장소/HTTP/WebSocket 회귀 4개, Python 저장소 회귀 3개(파일·SQLite 시나리오 포함), 기존 Python 서버 인증 회귀 8개, Chromium의 모델 없는 Node 서버 회귀 1개를 통과했다. 기존 임시 서버 테스트가 새 저장소 모듈까지 함께 복사하도록 수정했다. ESLint와 JS/Python 문법, 서버 문서의 JSON·JavaScript 예제 및 상대 링크를 확인했다. Node 전용 테스트는 Playwright가 수집하지 않도록 `.node.cjs` 확장자를 사용한다.

### 서버 모니터링·관리 페이지 (2026-09-16, BUILDNO 70)

`TODO.md`의 관리 페이지 요구를 구현했다. 프런트는 `src/admin.html`(스타일 전부)과 `src/js/puyow_admin.js`(화면 전체)에만 있고, `puyow.js`는 오류 코드 문구 한 줄만 늘렸다. 관리 페이지는 게임 코드를 전혀 읽지 않으며 `puyow.html`도 관리 코드를 읽지 않는다. 공유하는 것은 sha256용 `crypto-js.min.js` 하나뿐이다.

**관리자 계정** — Node는 `node/server.js`의 `ADMIN_ID`·`ADMIN_PASSWORD`, Python은 `SERVER_CONFIG["admin_id"]`·`["admin_password"]`다. 하나뿐이고 추가할 수 없다. **비밀번호가 공란이면 관리자 계정 자체가 비활성**이라 어떤 값으로도 로그인할 수 없다(`admin_disabled`). 비밀번호는 운영자가 서버 코드에서 고칠 수 있어야 하므로 **단방향 암호화하지 않고 원문 그대로 두고**, 로그인 때만 양쪽이 sha256 해시를 비교한다(Node `crypto.timingSafeEqual`, Python `hmac.compare_digest`).

**관리자 세션** — 온라인 플레이 세션(`onlineplay.js`·`onlineplay.py`)과 저장소도 수명도 완전히 분리되어 있다. `puyow_admin_session` 쿠키(HttpOnly, SameSite=Strict)로 유지하며, 로그인 전에도 세션을 발급해야 **로그인 실패 횟수를 세션에 담을 수 있다**. 5회 이상 실패하면 마지막 실패로부터 **10분** 동안 그 세션의 관리자 로그인을 막고(`login_blocked`, 남은 초는 `blockedSeconds`), 10분이 지나면 횟수를 0으로 되돌린다. 30분간 요청이 없는 세션은 다음 요청에서 정리한다(타이머를 두지 않는다). 쿠키를 지우면 횟수도 초기화되는 한계는 "세션에 담는다"는 요구를 그대로 따른 결과이므로, 공개 서버에서는 경로 자체를 막으라고 문서에 적어 두었다.

**백엔드 분리** — `node/admin.js`의 `createService({adminId, adminPassword, onlinePlayService, getServerInfo})`와 `python/admin.py`의 `AdminService(admin_id, admin_password, online_play_service, server_info)`다. 기존 서버 파일은 서비스 생성과 `apis` 등록만 고쳤다. **Python 쪽은 관리 API만 `Set-Cookie`가 필요해서**, `_send_json(status, payload, extra_headers=None)`을 늘리고 `/apis/` 라우터가 `(상태, 본문)`과 `(상태, 본문, 헤더)` 두 형태를 모두 받도록 했다. 다른 API는 그대로 두 값만 돌려준다.

**API** — 모두 POST다. `session`·`login`·`logout`은 로그인 전에도 쓸 수 있고, `status`·`accounts`·`accountpassword`·`accountstate`는 로그인한 관리자만 쓸 수 있다(`unauthorized`). **세 구현(두 서버와 `puyow_admin.js`)이 같은 경로와 오류 코드를 쓰므로 하나를 바꾸면 셋 다 고쳐야 한다.** 계정 응답에는 어떤 경우에도 비밀번호 해시를 넣지 않는다.

**대시보드** — 4초에 한 번 `status`를 다시 읽는다. Node는 `process.memoryUsage()`의 rss·heapTotal·heapUsed·external·arrayBuffers만 보내고 `cpuPercent`·`memoryPercent`는 항상 `null`이다(시스템 전체 점유율을 알 수 없다). Python은 `psutil`로 CPU·램 점유율과 프로세스 RSS를 읽으며, `psutil`이 없으면 두 값이 `null`이고 `psutilAvailable`이 `false`다. **`psutil`은 지연 import라 설치하지 않아도 서버와 관리 페이지가 돈다.** `psutil.cpu_percent(interval=None)`은 첫 호출이 항상 0.0이라 `AdminService` 생성 때 한 번 호출해 기준 시각을 잡아 둔다.

**온라인 계정 활성 상태** — 계정 문서에 boolean `active`를 더했다. **필드가 없는 예전 계정은 활성으로 본다**(`isAccountActive`·`_is_account_active`). 비활성 계정은 로그인이 거부되고(`account_disabled`, 403), **이미 로그인한 세션은 끊지 않되 방 생성·입장이 막힌다**. 그래서 `createRoom`·`joinRoom`은 세션이 아니라 계정을 다시 읽어 확인한다. 저장소 계약에 `listAccounts()`/`list_accounts()`를 더했고 `docs/examples/onlineplay_sql.*` 예제에도 같이 구현했다. 비밀번호를 바꾸면 그 계정의 세션을 끊는다.

**화면** — 로그인 화면 → 사이드바가 있는 대시보드·온라인 계정 화면이다. 사이드바 상단은 (왼쪽)화면 모드 토글 + (오른쪽)로그아웃이고 메뉴는 `MENU_ITEMS` 배열에 있어 여기에만 추가하면 늘어난다. 화면 모드는 저장하지 않고 `prefers-color-scheme`을 따르되 알 수 없으면 다크다. CSS 변수는 `admin.html`의 `:root`와 `:root[data-theme="light"]`에만 있다. 계정 목록에서 계정을 누르면 상세 레이어 팝업(닉네임·ID·현재 상태 + "비밀번호 변경"·"비활성화/활성화"·"닫기")이 열리고, "비밀번호 변경"은 그 위에 마스킹 입력 팝업을 하나 더 겹친다.

- 검증 결과: Node 임시 서버로 관리 API 16가지(세션 발급·미로그인 차단·5회 실패 차단·차단 중 정상 비밀번호 거절·정상 로그인·현황·계정 목록·접속 표시·비활성화·재활성화·비밀번호 변경·잘못된 요청·로그아웃·계정 파일·공란 비활성)를 확인했고, Python도 실제 `PuyoRequestHandler` 라우터로 같은 16가지를 확인했다. Chromium으로 관리 페이지 전체 흐름(다크/밝은 모드, 로그인 실패 문구, 대시보드 4초 자동 새로고침, 계정 목록·상세 팝업·토글·비밀번호 변경 팝업, 좁은 화면 400px, 로그아웃)을 확인했다. 기존 회귀는 Node 저장소 4개, Python 저장소 3개, `python/test_learning.py` 134개가 모두 통과했다. ESLint와 JS/Python 문법 검사를 거쳤고 webpack 번들을 다시 만들었다.

### 관리 페이지의 WebMCP (2026-09-16)

- `PuyoWAdmin.initialize()`가 `registerMcpTools()`로 `document.modelContext`에 `admin_manual`·`admin_login_status`·`admin_server_status`·`admin_online_accounts`·`admin_set_account_state` 다섯 도구를 등록하고, `destroy()`가 `mcpAbortController`로 한 번에 해제한다. 미지원 브라우저에서는 아무 일도 하지 않는다. **로그인 화면에서도 등록한다** — `admin_login_status`가 로그인 전에 쓰여야 하기 때문이다.
- 이름은 모두 `admin_` 접두어를 쓴다. 관리 페이지는 `puyow.js`를 읽지 않아 지금은 이름이 겹칠 일이 없지만, 같은 문서에 다른 도구가 등록되어도 구분되도록 둔다. **이 작업은 관리 페이지에만 한정하며 `puyow.js`와 BUILDNO는 건드리지 않았다.**
- **관리자 로그인·로그아웃은 일부러 도구로 만들지 않는다.** 관리자 비밀번호가 도구 경로를 지나가지 않게 하려는 것이며, 로그인은 사람이 화면에서 해야 한다. **온라인 계정 비밀번호 변경도 도구 범위에서 제외**한다. 이 두 가지는 요구사항이므로 도구를 늘릴 때도 유지한다.
- 도구 설명·스키마·`admin_manual` 문구는 AI가 읽도록 영어로 쓴다. 화면 문구(`ERROR_TEXTS`)는 사람이 읽는 한국어라 오류 표를 `MCP_ERROR_TEXTS`로 따로 둔다. 조회 전용에는 `annotations.readOnlyHint`, 플레이어가 정한 닉네임이 들어가는 `admin_online_accounts`·`admin_set_account_state`에는 `annotations.untrustedContentHint`를 둔다.
- 도구는 모두 `requestAdminApiForMcp()`를 거쳐 관리 API를 부르고 실패하면 예외를 던진다. 로그인 전 호출은 `unauthorized`를 "사람이 먼저 로그인해야 한다"는 영어 문구로 바꿔 돌려주므로, AI가 스스로 해결하려 하지 않는다. 예외는 `admin_login_status`가 쓰는 `session`으로, 로그인 전에도 성공하는 API라 통신 실패만 예외로 본다.
- 도구가 서버 상태를 읽거나 바꾸면 **사람이 보고 있는 화면도 같은 값으로 갱신한다.** 대시보드를 보고 있으면 `admin_server_status`가 `state.status`를, 계정 화면을 보고 있으면 `admin_online_accounts`가 목록을 갱신하고, `admin_set_account_state`는 `state.accounts`·`state.detailAccount`를 고친 뒤 계정 화면이면 목록을 다시 읽는다.
- 회귀 검증은 `tests/test04_admin.spec.js`다. **기본 설정 서버(관리자 비밀번호 공란)로 돌아가므로 로그인 없이 확인할 수 있는 계약만 검사한다** — 로그인 화면 표시, 화면 모드 토글이 저장되지 않음, 도구 5개의 이름·순서·`annotations`·스키마 유무, `admin_manual`·`admin_login_status`가 로그인 전에도 동작함, 나머지 3개가 영어 안내와 함께 거절함. 로그인 이후 동작은 서버 상수를 바꿔야 해서 이 파일에서 다루지 않는다.

### Node 서버 디렉터리 이름 변경 (2026-09-16, BUILDNO 71)

Node.js 서버 소스가 들어 있던 `nodeserver/` 디렉터리를 `node/`로 바꿨다. 파일 구성(`server.js`·`onlineplay.js`·`onlineplay_storage.js`·`admin.js`)과 내부 코드는 그대로이며, 서버 파일끼리는 상대 경로로 `require()` 하고 프로젝트 루트는 여전히 `__dirname`의 상위 디렉터리로 계산하므로 동작은 바뀌지 않는다.

- 함께 고친 곳: `package.json`의 `start` 스크립트(`node node/server.js`), `tests/onlineplay_storage.node.cjs`의 `require()` 두 줄, `tests/test03_ai.spec.js`가 서버만 임시 폴더에 복사할 때 쓰는 디렉터리 이름과 실행 인자, `tests/test04_admin.spec.js`의 주석, `README.md`·`README.en.md`·`docs/Server.md`·`docs/Server.en.md`·`docs/MachineLearning.md`·`docs/MachineLearning.en.md`의 경로와 링크, `python/pythonserver.py`·`python/onlineplay.py`·`python/admin.py`가 같은 계약을 가리키며 쓰는 주석, `src/js/puyow.js`·`src/js/puyow_admin.js`의 주석이다.
- `OLD_PROMPTS.md`는 과거 요청을 그대로 남긴 기록이라 바꾸지 않았다. 이 문서 안에서도 옛 경로를 설명하는 기록성 문장은 그대로 두고, 위 「Node 서버 소스 경로」 절에 현재 경로와의 대응을 적어 두었다.
- `tests/test03_ai.spec.js`가 서버를 임시 폴더에 복사할 때 `admin.js`가 빠져 있어 `server.js`의 `require('./admin.js')`가 실패하던 문제도 함께 고쳤다. 서버 파일을 늘리면 이 복사 목록도 함께 늘린다.
- `src/js/puyow.js`는 경로를 가리키는 주석 한 줄만 바뀌었지만 파일을 고쳤으므로 BUILDNO는 71이고 패키지 버전은 `0.0.71`이다.

### 출시 예정 바퓰라·오리아스 추가 (2026-09-17, BUILDNO 80)

- `TODO.md`에 따라 두 적을 추가했다. 기존 적의 모델·출시 상태·판단은 바꾸지 않았다. 영어·일본어·중국어 이름, 공개 클래스, 기본 등록 목록, Canvas 초상화·필드 테마를 함께 추가했다.
- 지정된 나무위키 두 문서는 조회 오류로 본문을 읽지 못했다. 대체로 [Goetia 원문 전사본의 59·60번](https://www.esotericarchives.com/solomon/goetia.htm)을 확인해 전승 요소를 반영했다. 이미지 파일 없이 기존 `drawCuteEnemyPortrait()`와 `ENEMY_PORTRAIT_STYLES`를 확장했다.
- 당시 초상화 회귀 검사는 15명 × 3표정 × 5배율을 확인한다. `test01_core.spec.js`는 자간과 같은 AI 상태·메서드·모델 및 독립적인 모델 경로를, `test01_menu.spec.js`는 갤러리 등록·카드 제외·출시 예정 선택 차단을 확인한다.
- 검증: 관련 5개 검사 × Chromium·Firefox·WebKit = 15개 모두 통과했다. 첫 실행의 선택 차단 검사는 영어 표시 이름을 한국어 기대값과 비교해 실패했으며, 현재 언어의 번역값으로 수정한 뒤 세 브라우저에서 재통과했다. 전체 초상화 비교 이미지를 직접 확인했고 `node --check`, `npm.cmd test`, Playwright 서버 시작 시 실행한 webpack 빌드, `git diff --check`도 통과했다. 번들을 갱신했으며 BUILDNO는 80, 패키지 버전은 `0.0.80`이다. 버전값 자체는 테스트하지 않았다. 새 적의 실제 모델 추론 대전은 실행하지 않았으며, 자간과 동일한 공통 AI 메서드·초기 상태·모델 경로를 확인했다.

### 리더보드 (2026-09-19, BUILDNO 91)

`TODO.md`의 리더보드 기록·조회 요구를 구현했다.

**기록 규칙** — 결과가 확정되는 `updateDefeatSequence()`에서 `recordEnemyClear()`·`recordTogetherResult()` 다음에 `recordLeaderboardResult(winner, loser)`를 한 번 부른다(`game.leaderboardRecorded`로 중복 방지). 대상과 제외는 다음과 같다.
- 기본 룰·피버 룰·피버 룰 (시작)·피버 룰 (완화): 사람(1P, `controller === null`)이 **이겼을 때만** 최종 점수(`player.point`, 정수로 내림)를 기록한다. 순위는 룰 × AI 난이도(`AI_DIFFICULTIES[game.aiDifficulty].key`: easy·normal·hard·extreme) × 색 수 × 적 `getClassType()`마다 따로다. BUILDNO 91~93에는 AI 난이도로 나누지 않았고, BUILDNO 94에서 사용자 요청으로 나눴다.
- 연습·연속 피버: 승리 조건이 없으므로 **사람이 패배했을 때**(`loser === players[0]`) 최종 점수를 룰 × 색 수마다 기록한다. 연속 피버의 시간 만료도 `startDefeatSequence(player, …)`를 거치는 패배라 기록된다. 일시정지 `종료`·`다시하기`, 결과 전 이탈은 이 경로를 지나지 않으므로 기록되지 않는다.
- 제외: 너랑 나랑(`game.together`, 오프라인)·온라인(`game.online`)·구경·퍼즐뿌요·플레이 방법(`game.tutorial`)·리플레이 재생·개발용 도구 테스트(`game.toolsTest`), 그리고 **솔로몬**(`LEADERBOARD_EXCLUDED_ENEMY_TYPES`)은 모드와 무관하게 제외한다. ONNX 적은 기록 대상이다. 시뮬레이터는 결과 경로가 없어 기록되지 않는다.
- 닉네임은 게임 시작 때 `PlayerState` 이름으로 들어간 `getPlayerName()` 값(기록 당시 이름)이다. 게임 진행 시간은 기록하지 않는다. BUILDNO 92부터 기록이 발생한 당시의 현재 시각을 `recordedAt`(`Date.now()`, 밀리초)으로 함께 남긴다. 동점은 따로 고려하지 않으며 먼저 들어간 기록 뒤에 놓인다.

**저장 형식** — `localStorage`(`storageManager`)의 `puyow_leaderboard`에 `{version: 2, records, legacy?}` JSON을 둔다(`LEADERBOARD_FORMAT_VERSION`). 단독 룰(`practice`·`continuous_fever`)은 `records[룰키][색 수 문자열] = [{name, score, recordedAt}]`, 대전 룰(`standard`·`fever`·`fever_start`·`relaxed_fever`)은 `records[룰키][AI 난이도 키][색 수 문자열][적 classType] = [{name, score, recordedAt}]`다. 정리는 `normalizeLeaderboardSoloRecords()`·`normalizeLeaderboardBattleRecords()`가 나눠 맡고, 알 수 없는 난이도 키는 버린다. **형식 1(BUILDNO 91~93)의 대전 기록은 AI 난이도 정보가 없어 어느 난이도에도 넣지 않는다.** 임의 난이도로 옮기면 사실과 다른 기록이 되므로, 지워지지도 않게 `legacy.v1[룰키]`에 형식 1 구조 그대로 보존만 하고 화면·WebMCP에는 보이지 않는다(사용자에게 알렸다). 형식 1의 단독 룰 기록은 구조가 같아 그대로 옮긴다. `legacy`는 이후 저장에서도 그대로 유지된다. `recordedAt`이 없거나 잘못된 BUILDNO 91 기록은 `normalizeLeaderboardEntry()`가 `null`로 보정한다(형식 버전은 1 그대로). 룰 키와 표시 라벨·대전 여부는 `LEADERBOARD_RULES` 한 곳에 있다. `loadLeaderboard()`가 읽을 때마다 알 수 없는 룰·3~5 밖의 색 수·솔로몬·음수/숫자 아닌 점수를 버리고 점수 내림차순 10개(`LEADERBOARD_MAX_ENTRIES`)로 정리한다. 설정 화면의 `초기화`는 `storageManager.clear()`라 리더보드도 함께 지운다.

**공개 API** — `PuyoW.leaderboard`(`leaderboardApi`)는 `STORE_KEY`, `MAX_ENTRIES`, `getRules()`, `getColorCounts()`, `getDifficulties()`(`{key, label(한국어 키)}` 네 개), `getOpponents()`(숨김·출시 예정·솔로몬 제외, `{classType, name(한국어 키)}`), `getData()`, `translate(language, 한국어키)`를 준다. `translate`는 `initialize()` 없이도 게임 `stringTable`을 쓰며 그 언어에 번역이 없으면 영어, 그것도 없으면 원문이다(독일어·프랑스어 표에 적 이름이 없어 영어 이름이 나온다). 기록 함수 자체는 공개하지 않는다.

**조회 페이지** — `leaderboard.html`은 `puyow.js`와 `puyow_leaderboard.js`를 읽고 `PuyoWLeaderboard.initialize(target)`만 부른다. 좌측 사이드바는 대전 룰이면 룰(1단) → AI 난이도(2단) → 색 수(3단) → 적(4단), 단독 룰이면 룰(1단) → 색 수(2단) 트리 메뉴이고(노드 id는 `standard/normal/4/Kimaris`, `practice/3`처럼 경로를 `/`로 이은 것) 끝 항목 옆에 기록 수를 표시한다. 적 목록은 `getOpponents()` 전체 뒤에 기록만 있는 적(외부 확장 등)을 classType 이름으로 붙인다. 가지를 누르면 펼치고(이미 선택된 가지를 다시 누르면 접는다), 끝 항목을 누르면 순위·닉네임·점수·기록 일시 표를 보인다. **자식이 있는 항목(룰·AI 난이도·색 수)을 누르면 그 아래를 모두 합친 통합 순위가, 아무것도 고르지 않은 처음 화면에는 모든 룰을 합친 전체 순위가 나온다**(아래 「단계별 통합 순위」·「처음 화면의 전체 순위」 절). 따라서 어느 항목을 눌러도 표가 나오며, 예전에 가지를 눌렀을 때 나오던 `Select a color count.` 같은 안내 문구는 없어졌다. 사이드바 상단 머리글(`리더보드` 제목)을 누르면 처음 화면으로 돌아간다. 기록 일시는 `Intl.DateTimeFormat(현재 언어, {dateStyle:'medium', timeStyle:'short'})`로 브라우저 현지 시간대로 표시하고 셀 `title`에 ISO 8601(UTC) 문자열을 둔다. `recordedAt`이 null이면 `-`다. 좁은 화면에서는 일시 칸이 두 줄까지 줄바꿈된다. 닉네임은 `textContent`로만 넣는다. 트리는 위아래·Home·End 이동, 오른쪽 펼치기·하위 이동, 왼쪽 접기·상위 이동을 지원하며, 다시 그리기 전에 트리 안 포커스 여부를 먼저 확인해 같은 노드로 포커스를 되돌린다. 다른 탭에서 기록이 바뀌면 `storage` 이벤트로 다시 읽는다.
- 화면 모드: CSS 변수(`--lb-*`)는 `leaderboard.html`의 `:root`와 `:root[data-theme="light"]`에만 있다. 헤드의 인라인 스크립트가 `prefers-color-scheme`으로 먼저 `data-theme`를 정해 깜박임을 막고, 사이드바 하단 스위치(`role="switch"`, `aria-checked`가 다크 여부)로 바꾼다. 저장하지 않으며, 사용자가 토글하기 전까지는 시스템 모드 변경을 따라간다.
- 다국어: 기본은 영어이고 한국어·일본어·중국어·독일어·프랑스어를 지원한다. `puyow_tools.js`처럼 영어 원문을 키로 쓰는 `LEADERBOARD_STRINGS`를 두고, 룰·색 수·적 이름은 게임 번역표(`PuyoW.leaderboard.translate`)를 쓴다. 브라우저 언어 앞 두 글자로 고르며 사이드바 하단 언어 선택으로도 바꿀 수 있다(저장하지 않음). 문구를 더할 때는 다섯 언어에 모두 넣는다.
- 760px 이하에서는 사이드바가 서랍이 되어 본문 헤더의 메뉴 버튼으로 열고, 끝 항목 선택·배경 클릭·ESC로 닫는다.
- WebMCP: `leaderboard_manual`, `leaderboard_records`(읽기 전용, 닉네임이 들어가 `untrustedContentHint`, 각 항목의 `recordedAt`은 ISO 8601 UTC 문자열 또는 null), `leaderboard_show` 세 도구를 `leaderboard_` 접두어로 등록한다. 게임은 초기화하지 않으므로 게임 본체 도구는 이 화면에 등록되지 않는다. 게임 페이지 WebMCP `manual`에도 리더보드 기록 규칙 문단을 더했다. 자세한 동작은 아래 「WebMCP의 통합 조회」 절에 있다.
- 검증: `tests/test05_leaderboard.spec.js` 9개 × Chromium·Firefox·WebKit = 27개 통과, `test01_core`·`test01_enemy` Chromium 82개 통과, `node --check`, ESLint, webpack 번들 재생성, `git diff --check`. BUILDNO 91, 패키지 버전 `0.0.91`(버전값 자체는 테스트하지 않음). BUILDNO 92(`0.0.92`)에서 기록 일시를 더한 뒤 같은 27개를 다시 통과했다. BUILDNO 94(`0.0.94`)에서 AI 난이도 단계를 더한 뒤 12개 × 3 브라우저 = 36개가 통과했다(형식 1 이관 테스트 추가). 조회 페이지에는 `puyow.html`로 돌아가는 링크가 있다. BUILDNO 93부터 게임 메인 메뉴 좌측 하단 `리더보드` 버튼으로 이 페이지에 들어간다(위 「UI·입력·결과 화면」 절). 회귀 테스트는 `test05_leaderboard.spec.js`의 버튼 위치·방향키 순서(GitHub에서 위로 한 번)·Enter·마우스 클릭 이동 두 개다.

### 설정 언어 선택 (2026-09-19, BUILDNO 95)

- 게임 설정에 `language`를 저장하며, 이름과 배경음악 볼륨 사이에서 영어·한국어·일본어·중국어·프랑스어·독일어를 고를 수 있다. 선택지는 언어를 바꾸기 전에도 구분할 수 있도록 `English`·`한국어`·`日本語`·`中文`·`Français`·`Deutsch` 자체 표기로 표시한다.
- 새 저장 데이터와 언어 저장값이 없는 기존 데이터는 브라우저 시스템 언어의 앞 두 글자를 위 여섯 언어와 대조한다. 지원하지 않거나 판별할 수 없으면 영어를 저장한다. 잘못된 저장값도 같은 방식으로 보정한다.
- `translate()`와 URL의 `[LANG]` 치환은 시스템 언어가 아니라 저장된 `settings.language`를 사용한다. 설정 저장 직후부터 화면 문구와 공지 경로에 반영된다.
- 언어 행을 추가하면서 설정 화면의 행 간격·입력/선택 컨트롤·버튼 글자 크기와 높이를 조금 줄였다. 언어 선택지는 여섯 개를 한 줄에 배치하며 개별 폭을 사용하므로 마우스 판정도 선택지 폭을 따른다.
- BUILDNO 96부터 초기화에서 저장소를 읽은 직후와 설정 저장 직후에 `applyStoredLanguage()`를 호출한다. 이 함수가 저장된 `settings.language`를 `languageCode`에 적용하므로, 그 시점 이후 `translate()`와 `[LANG]`은 시스템 언어를 다시 읽지 않는다.
- BUILDNO 97에서 언어 행 추가 뒤 남아 있던 설정 화면 마우스 동작 버튼의 예전 포커스 번호 분기를 고쳤다. 버튼 정보에 `action`(`save`·`cancel`·`reset`)을 명시하고, 마우스 클릭은 이 식별자로 실행하므로 포커스 순번 변경과 저장·취소·초기화 실행이 다시 어긋나지 않는다.
- BUILDNO 98에서 게임 시작 시 `PlayerState.name`에 보관하는 적의 한국어 원문 이름을 바꾸지 않고, 게임 필드 상단·NEXT·점수 패널을 그릴 때 `getDisplayedPlayerName()`으로 번역한다. 따라서 게임 상태 API·리플레이·리더보드의 안정적인 이름 키는 유지하면서 설정 언어에 맞는 적 이름을 게임 화면에 표시한다.

### 피버 상쇄 우선순위 수정 (2026-09-19, BUILDNO 99)

- `TODO.md`의 현상을 수정 전 회귀 검사에서 재현했다. 피버 DAMAGE 2·유예 DAMAGE 20·현재 피버행 상대 ATTACK 8에서 공격 5로 상쇄하면 기존에는 유예 DAMAGE가 17이 되고 상대 ATTACK은 8로 남았다. 수정 후에는 유예 DAMAGE 20을 유지하고 상대 ATTACK이 5가 된다.
- 변경은 실제 게임의 `sendAttackEnergy()` 상쇄 분기에 적용했다. 일반 상태의 기존 상쇄 순서와 `resolveExplosions()`·`deliverFinalAttackEnergy()`·`applyAttackDamage()`의 공격 귀속 규칙은 유지한다. 첫 폭발이 전부 상쇄되어 공격 잔여량이 0이 된 경우에도 같은 연쇄의 이후 반격은 첫 폭발 당시 상대 상태로 귀속된다.
- `tests/test01_fever_damage.spec.js`에 우선순위 5가지(피버 피해 우선·피버행 공격 우선·유예 피해까지 상쇄·일반행 공격·이전 피버행 공격), 연쇄 도중 새로 발생한 피버행 공격, 첫 폭발 전량 상쇄 후 즉시/지연 반격의 귀속을 추가했다. 기존 유예 피해 연출 검사는 상대 공격이 일반 필드행임을 명시한다.
- AI 미리보기와 Python 학습 환경도 점검했다. 이들은 피해·예측 공격을 단순화해서 사용한다. `python/learning.py`의 대전 환경은 이후 아래 「피버 상쇄·첫 배치 규칙의 학습 환경 반영」 절에서 목적지 저장·최종 피해 귀속·상쇄 순서를 게임과 맞췄다.
- BUILDNO는 99, 패키지 버전은 `0.0.99`로 갱신했다. 버전값 자체는 테스트하지 않는다.
- 검증: 수정 전 새 검사 8개 중 우선순위 관련 3개가 실패해 현상을 재현했고, 수정 후 `test01_fever_damage.spec.js` 21개 × Chromium·Firefox·WebKit = 63개가 통과했다. `test01_fever.spec.js`의 기본 룰 싹쓸이 티켓·피버 양쪽 DAMAGE 상쇄 후 잔여 공격·전량 상쇄 후 예고 취소 3개도 Chromium에서 통과했다. JS 문법 검사·ESLint·번들 재생성·변경 파일의 공백 검사를 완료했다. 사용자 기존 `TODO.md`의 줄 끝 공백은 변경하지 않았다.

### 피버 상쇄·첫 배치 규칙의 학습 환경 반영 (2026-09-19, Python만 변경)

- BUILDNO 99(피버 상쇄 우선순위)와 BUILDNO 100(일반 필드 싹쓸이 보상 패턴의 무작위 첫 수 제외)을 `python/learning.py`의 `PuyoDuelEnvironment`와 `python/bundledenemy.py`에 반영했다. `puyow.js`는 바꾸지 않았으므로 BUILDNO·패키지 버전은 그대로다.
- `FeverState`에 `activation_id`(게임의 `fever.activationId`, `_activate_fever()`에서 1 증가)와 `randomize_stage_opening`(게임의 `fever.randomizeStageOpening`)을 추가했다. 둘 다 관측값에는 들어가지 않으므로 모델 계약(`MODEL_VERSION`·관측 크기)은 그대로다.
- **공격 목적지**: `_deliver_chain_step()`이 연쇄 첫 폭발에서(정수 ATTACK이 없어도) `_record_chain_target()`으로 `chain_state[side]["target_fever_id"]`를 기록한다(피버 룰 밖 None, 상대 일반 상태 -1, 상대 피버 중이면 그 회차). `_finish_chain()`은 `_apply_attack_damage()`(게임의 `applyAttackDamage()`)로 전달한다. 목적지 피버가 아직 진행 중이면 피버 DAMAGE, 그 밖(일반 상태에서 시작, 이미 끝난 이전 피버)은 일반 DAMAGE(피버 중이면 유예)에 넣는다. 예전에는 연쇄 종료 시점의 상대 상태로 넣었다.
- **피버 중 상쇄**: `_cancel_attack()`이 피버 DAMAGE → 상대 연쇄 목적지가 내 현재 피버 회차와 같은 in_flight → 일반(유예) DAMAGE → 나머지 in_flight 순으로 매 단계 상쇄한다. 피버가 아닐 때의 순서(상대 in_flight → 자기 DAMAGE)는 그대로다. 학습 환경은 에너지 연출 지연을 모형화하지 않으므로 목적지는 연쇄 상태에만 보관한다.
- **피버 패턴 첫 배치 무작위**: `_prepare_fever_stage()`가 `source_field_was_empty`를 받아 `fever_rule and state.active and 빈 필드`일 때만 `randomize_stage_opening`을 켠다. `_activate_fever()`는 피버로 바꾸기 전 일반 필드의 빈 상태를 넘기고, 피버 중 다음 패턴은 직전 피버 필드로 판단하며, 피버 미진입 싹쓸이 보상 4연쇄 패턴은 켜지 않는다. `_finish_fever()`는 끈다. `_select_enemy_positions()`가 이 값을 `BaseEnemy.decide(..., randomize_stage_opening=...)`로 넘긴 뒤 바로 끈다. `bundledenemy`의 `decide()`는 `uses_random_empty_field` 적이면 피버 중 최대 연쇄 우선 분기보다 먼저 `select_random_empty_field_placement(..., randomize_stage_opening=True)`로 비어 있지 않은 패턴 보드에서도 무작위 첫 수를 고른다(게임 `Enemy.prepareTurn()` 순서). 예전 Python은 실제 피버 진입 패턴에서도 무작위 첫 수를 쓰지 않았다. 에이전트 쪽 안내 적(`suggest_agent_action()`)에는 넘기지 않는다.
- 애프터스테이트(`_build_afterstate()`와 JS `buildAfterstate()`)의 단순화된 상쇄 순서(진행 중 공격 → 확정 DAMAGE)는 관측값에 목적지·유예 DAMAGE가 없어 바꾸지 않았다. 바꾸려면 두 구현을 함께 맞춰야 한다.
- 회귀 테스트: `python/test_learning.py`의 `FeverOffsetPriorityTest`(9개)와 `FeverStageOpeningTest`(5개). 수정 전 코드에서는 14개 중 11개가 실패했고, 수정 후 `test_learning`·`test_onlineplay_storage` 전체 177개가 통과했다(Tk 1개 건너뜀).

### WebMCP 게임 도구 최신화 (2026-09-19, BUILDNO 101)

- `getGameState().allClearTicketEnabled`는 `rule === 'standard'`만 보지 않고 실제 `usesAllClearTicket()` 계약을 사용한다. 따라서 기본 룰·너랑 나랑·퍼즐뿌요에서는 `true`, 연습·피버 계열에서는 `false`이며, 도구 상태와 실제 싹쓸이 보상이 일치한다.
- `manual`과 `now_game_status` 스키마 설명에 최신 ATTACK 상쇄 순서(피버 DAMAGE → 현재 피버 회차행 상대 ATTACK → 유예 일반 DAMAGE → 나머지 상대 ATTACK), 피버 시간 만료 뒤 일반 필드 DAMAGE 낙하, 싹쓸이 모드별 보상(티켓 +2100/+30, 연습 즉시 +2100, 피버 목표·시간 보상)을 반영했다. `damage`·`normalDamage`의 현재 필드/유예 필드 의미도 명시했다.
- 실제 게임 페이지는 `src/js/puyow.js`를 읽고 번들은 현재 주석 처리되어 있다. 이번 변경에서는 소스 WebMCP를 갱신했으며, 번들 재생성은 실행 환경의 기존 `src/bundle/puyow.bundle.js` 파일 잠금(EPERM)으로 수행하지 못했다.
- 검증: `node --check src/js/puyow.js`, `npm.cmd test`/`npx eslint src/js/puyow.js`, `git diff --check` 통과. Playwright `test01_core.spec.js`는 테스트 결과 파일 잠금(EPERM)으로 완료하지 못했다. BUILDNO는 101, 패키지 버전은 `0.0.101`이다.

### Python GUI 학습기의 GPU 사용 점검 (2026-09-20)

- `python/lngui.py`는 학습 시작 시 `learning.DEFAULT_DEVICE`인 `auto`를 `learning.train()`에 전달한다. `python/learning.py`는 `auto`일 때 `torch.cuda.is_available()`가 참이면 `cuda`, 아니면 `cpu`를 선택하므로 CUDA 지원 PyTorch와 NVIDIA 환경에서는 GUI 학습도 GPU를 사용할 수 있다.
- `learning.py`의 가치망, 타깃망, 배치 입력·보상·부트스트랩 텐서, 추론 후보 점수 계산과 역전파는 선택한 `device`로 이동한다. 반면 보드·연쇄·상대 AI 시뮬레이션과 애프터스테이트 후보 생성은 Python CPU 코드이므로 학습 전체가 GPU에서 실행되는 구조는 아니다.
- GUI에는 장치 선택란이나 GPU 사용률 표시가 없고 CPU·RAM만 표시한다. 현재 점검 환경의 PyTorch는 `2.14.0+cpu`(`torch.version.cuda is None`)이며 CUDA 장치가 0개라 `auto`는 CPU로 폴백한다. GPU를 쓰려면 NVIDIA 드라이버와 CUDA 지원 PyTorch를 설치한 별도 환경에서 실행해야 한다.
- 이 확인은 `puyow.js`를 수정하지 않은 진단 작업이므로 BUILDNO와 `package.json` 버전은 변경하지 않았다.

### 리플레이 재생 보간 (2026-09-20, BUILDNO 102)

- 리플레이 형식 버전 3과 기록 주기(`REPLAY_SAMPLE_INTERVAL`, 초당 30표본)는 바꾸지 않았다. 재생 상태 내부에만 마지막으로 반영한 프레임 시각과 화면용 Y 좌표를 보관하므로 기존 리플레이 JSON과 복사·붙여넣기 호환성이 유지된다.
- 재생 중 바로 다음 `ac` 델타를 확인해 같은 뿌요 쌍·같은 열·같은 회전인 동안 조작 중 뿌요의 Y 좌표를 현재 재생 시각에 맞춰 선형 보간한다. 화면에 그리는 값만 보간하고 `PlayerState`의 실제 상태, 이동·회전·고정·폭발 같은 이산 이벤트 시점은 바꾸지 않는다. 따라서 기록 주기를 늘리지 않고도 표본 사이의 낙하가 계단식으로 보이는 현상을 줄이며, 다음 표본 확인 비용도 일정하다.
- `src/js/puyow.js`의 BUILDNO는 102, `package.json` 버전은 `0.0.102`다. `node --check`, `npm.cmd test`, `git diff --check`와 Chromium 리플레이 기본 룰 재생 회귀 테스트 1개(`1 passed`, 57.2초)를 통과했다. 전체 리플레이 묶음은 실행 환경의 긴 실제 대전 시간 때문에 별도로 돌리지 않았다.

### 리더보드의 단계별 통합 순위 (2026-09-21)

`TODO.md`의 "난이도를 통합한 리더보드" 요구를 구현했다(처음에는 룰 항목에서만 동작했고, 같은 날 자식이 있는 모든 단계로 넓혔다. 아래 설명은 넓힌 뒤 기준이다). **기록 코드와 저장 형식(`puyow_leaderboard`, 형식 버전 2)은 손대지 않았고**, 이미 룰·AI 난이도·색 수·적별로 모아 둔 데이터에서 화면에 보일 때만 산출한다. 따라서 `src/js/puyow.js`는 고치지 않았고 BUILDNO와 `package.json` 버전도 그대로다(각각 102, `0.1.102`). 고친 파일은 `src/js/puyow_leaderboard.js`, `src/leaderboard.html`, `tests/test05_leaderboard.spec.js` 세 개뿐이다.

- **여는 법**: 좌측 사이드바에 메뉴 항목을 더하지 않았다. **자식이 있는 항목이면 어느 단계든** 누르는 순간 펼치기와 함께 우측에 통합 순위가 나온다. 대전 룰은 룰(1단)·AI 난이도(2단)·색 수(3단) 세 단계가, 단독 룰은 룰(1단) 한 단계가 여기에 해당한다. 예를 들어 `기본 룰 › 쉬움`을 누르면 쉬움 난이도의 색 수·적을 모두 합친 순위가, `기본 룰 › 쉬움 › 4색`을 누르면 그 색 수의 적을 모두 합친 순위가 나온다. 이미 선택된 가지를 다시 누르면 접히지만 순위는 계속 보인다.
- **판별**: `renderMain()`이 `combined = !isLeafSelection(selection)`으로 가른다. 끝 항목이 아니면 모두 통합 순위다. (예전의 `isRuleSelection()`과 `Select an AI difficulty.`·`Select a color count.`·`Select an opponent.` 세 안내 문구는 도달할 수 없게 되어 지웠다.)
- **산출**: `collectRuleRecords(ruleKey)`가 대전 룰이면 AI 난이도 → 색 수 → 적 순서로, 단독 룰이면 색 수 순서로 저장된 목록을 각 기록의 출처(`rule`·`difficulty`·`colors`·`opponent`)와 함께 모은다. `getCombinedRecordList(selection)`은 여기서 **고른 단계까지 값이 같은 기록만 남기고**(`selection.difficulty`·`selection.colors`가 있으면 그것과 같은 것만) `rankRecords()`로 점수 내림차순 `MAX_ENTRIES`(10)개를 남긴다. 적 목록은 끝 항목과 같은 `getOpponentTypes()`를 쓰므로 기록만 있는 외부 확장 적도 포함된다. `Array.prototype.sort`가 안정 정렬이라 동점은 합친 순서를 유지하며, 이는 게임 쪽 `normalizeLeaderboardList()`의 동점 처리와 같은 방식이다.
- **화면**: 브레드크럼에 **고른 항목까지의 경로 전체**(`기본 룰 › 쉬움 › 4색`)를, 제목에 `Combined ranking`(한국어 `통합 순위`)을 넣는다. 끝 항목은 예전처럼 경로에서 자기 이름을 빼고 그것을 제목으로 쓴다. 표에는 `Conditions`(`조건`) 칸을 하나 더 붙여 그 기록이 나온 곳을 `보통 · 4색 · 키마리스`처럼 가운뎃점으로 이어 적되, **이미 고른 단계는 모든 줄이 같은 값이라 빼고 그 아래 단계만 적는다**(`getRecordConditionName(entry, selection)`). 그래서 색 수 단계에서는 조건 칸에 적 이름만 남는다. 조건 칸이 붙는 표에만 `lb-table-combined` 클래스와 카드의 `lb-card-wide`를 붙인다.
- **문구**: `LEADERBOARD_STRINGS`에 `Combined ranking`·`Conditions`·`This ranking combines every record below the selected menu item.` 세 키를 다섯 언어에 모두 넣었다. 조건 칸의 난이도·색 수·적 이름은 기존과 같이 게임 번역표(`PuyoW.leaderboard.translate`)를 쓴다.
- **검증**: `tests/test05_leaderboard.spec.js`에 `룰 이름을 직접 고르면 그 룰의 난이도 통합 순위를 보여 준다`, `자식이 있는 중간 단계 메뉴도 그 아래를 합친 통합 순위를 보여 준다`, `통합 순위의 문구와 조건 이름도 선택한 언어를 따른다`를 더했다. `node --check`, ESLint(`src/js/puyow_leaderboard.js`, 테스트 파일), `git diff --check`도 통과했다. `puyow.js`를 고치지 않아 번들(`src/bundle/puyow.bundle.js`) 재생성은 필요하지 않다(이 리더보드 스크립트는 번들에 들어가지 않는다).

### 리더보드 처음 화면의 전체 순위와 표 말줄임 (2026-09-21)

같은 날 「룰별 통합 순위」에 이어, 아무것도 고르지 않은 처음 화면에도 순위를 띄우라는 요구를 구현했다. 마찬가지로 **기록 코드와 저장 형식은 손대지 않았고** `src/js/puyow.js`도 그대로여서 BUILDNO(102)와 `package.json` 버전(`0.1.102`)은 변하지 않았다.

- **전체 순위**: `getOverallRecordList()`가 모든 룰의 기록을 합쳐 점수 내림차순 `OVERALL_MAX_ENTRIES`(20)개를 남긴다. 룰 하나 안의 통합 순위는 그대로 `MAX_ENTRIES`(10)개이며, 두 값을 따로 둔 이유는 전체 순위가 다섯 룰을 한 표에 담기 때문이다. `renderMain()`의 `!rule` 분기가 제목을 `Overall ranking`(한국어 `전체 순위`)으로 쓰고 이 표를 그린다. 기록이 하나도 없을 때만 예전처럼 `Select a rule and its options from the menu.` 안내가 나온다.
- **수집 함수 분리**: 이전의 `getCombinedRecordList()`를 `collectRuleRecords(ruleKey)`(정렬하지 않고 모으며 각 기록에 `rule`·`difficulty`·`colors`·`opponent`를 붙인다)와 `rankRecords(list, limit)`(점수 내림차순으로 자른다)로 나눴다. 룰별 통합 순위와 전체 순위가 같은 수집·정렬 규칙을 쓰므로 동점 처리도 같다.
- **표 만들기 일원화**: `createRecordTable(list, mode)` 하나가 세 가지 표를 만든다. `leaf`는 끝 항목(순위·닉네임·점수·기록 일시), `combined`는 룰 내 통합(조건 칸 추가), `overall`은 전체 순위(룰·색상·적 칸 추가)다. **칸 순서는 순위 → 닉네임 → 점수 → (조건 또는 룰·색상·적) → 기록 일시**다. 점수를 닉네임 바로 뒤에 둔 이유는 좁은 화면에서 가로로 넘기지 않아도 순위·닉네임·점수가 보이게 하기 위해서다. 적이 없는 단독 룰의 적 칸은 대시(`-`)다.
- **말줄임 처리**: `.lb-table`을 `table-layout: fixed`로 두고 모든 `th`·`td`에 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`을 준다. 닉네임·조건·룰·적 셀에는 전체 값을 `title`에 함께 넣어 잘려도 확인할 수 있게 했다. 예외로 기록 일시 칸만 좁은 화면에서 두 줄까지 접는다(사람이 넣은 값이 아니라 줄이면 알아보기 어렵다). 예전의 `overflow-wrap: anywhere`(닉네임 줄바꿈)는 이 규칙으로 바뀌었다.
- **칸 너비**: 고정 배치라서 칸마다 너비를 정해 둔다. 기록 일시는 한국어 표기(`2026. 9. 10. 오전 10:02`)가 가장 길어 186px로 잡았다. 칸이 더 붙는 표는 `lb-table-combined`(최소 560px)·`lb-table-overall`(최소 780px)에 최소 너비를 주고, 카드에는 `lb-card-wide`(최대 980px, `overflow-x: auto`)를 붙여 좁은 화면에서는 **문서가 아니라 카드 안에서** 가로로 넘긴다. 좁은 화면(760px 이하)에서는 최소 너비를 480px·620px로, 각 칸도 더 좁게 다시 정한다. 390px에서 문서 가로 스크롤이 생기지 않는 것을 확인했다.
- **돌아가는 길**: 사이드바 상단 머리글(아이콘 + `리더보드` 제목 + 부제)이 `<button class="lb-brand">`이며, 누르면 `clearSelection()`이 `state.selection`을 비우고 처음 화면(전체 순위)으로 돌아간다. 트리 메뉴에 항목을 더하지 않기로 했으므로 이 머리글이 유일한 복귀 경로다. 펼쳐 둔 가지는 그대로 두어 다시 찾아가기 쉽게 하고, 좁은 화면에서는 `setMenuOpen(false)`로 서랍을 닫아 표가 보이게 한다. 단추라서 Tab·Enter로도 닿는다. 머리글은 사이드바 머리글 모양(`display:flex`, 아래 테두리)을 그대로 쓰되 단추 기본 모양을 지우고 `.lb-node`와 같은 계열의 옅은 배경으로 hover를 준다.
- **알려진 한계**: 전체 순위 표에는 AI 난이도 칸이 없어, 난이도만 다른 같은 조건의 기록은 표에서 구분되지 않는다(룰별 통합 순위의 조건 칸에는 난이도가 들어 있다). 사용자에게 알린 사항이다.
- **검증**: `tests/test05_leaderboard.spec.js`에 `아무것도 고르지 않은 처음 화면은 모든 룰을 합친 전체 순위를 보여 준다`(칸 순서·단독 룰의 대시·말줄임·`title`·머리글을 눌러 돌아오기까지 확인)와 `기록이 하나도 없으면 처음 화면에 메뉴 안내를 보여 준다`를 더하고, 좁은 화면 테스트에도 머리글을 눌러 서랍이 닫히는지 확인을 더했다.

### 이 세 작업의 최종 검증 상태 (2026-09-21)

위 「단계별 통합 순위」·「처음 화면의 전체 순위」와 머리글 복귀까지 모두 넣은 뒤, `tests/test05_leaderboard.spec.js`는 17개 × Chromium·Firefox·WebKit = 51개다. Chromium 17개 전부와 Firefox·WebKit 34개 중 33개가 통과했고, 남은 하나는 WebKit의 `page.goto` 시간 초과였는데 같은 테스트를 단독으로 다시 돌리면 통과한다. Firefox에서도 `browserContext.close` 프로토콜 오류로 다른 테스트가 한 번 실패했다가 재실행에서 통과했다. **둘 다 실행 환경에서 여러 워커를 함께 돌릴 때 나는 간헐 오류이며 이 변경과 무관하다.** `node --check`, ESLint, `git diff --check`도 통과했다. 세 작업 모두 `src/js/puyow.js`를 고치지 않았으므로 BUILDNO는 102, `package.json` 버전은 `0.1.102` 그대로다.

### 리더보드 WebMCP의 통합 조회 (2026-09-21)

화면에 더한 전체 순위·단계별 통합 순위를 WebMCP로도 그대로 물어볼 수 있게 했다. `src/js/puyow.js`는 이번에도 건드리지 않았다(BUILDNO 102, `0.1.102`).

- **선택 경로에서 룰이 선택 사항이 됐다.** `normalizeMcpSelection(input)`은 `rule`이 없으면 `null`을 돌려주고 이는 "모든 룰"을 뜻한다. 룰 없이 `difficulty`·`colors`·`opponent`만 주면 `difficulty, colors, and opponent need a rule.`로 거절한다. 대전 룰에서 `colors`를 주려면 `difficulty`도 줘야 한다는 기존 규칙은 그대로다(트리에 그런 항목이 없어 `leaderboard_show`가 가리킬 수 없기 때문이며, `leaderboard_records`도 같은 규칙을 쓴다).
- **`leaderboard_records`에 `combine`(boolean)이 생겼다.** 기본값 `false`는 예전처럼 저장 묶음별 순위를 그대로 돌려주고 결과에 `combined: false`가 붙는다. `true`면 화면과 똑같은 산출(`getOverallRecordList()`·`getCombinedRecordList(selection)`)을 써서 합친 순위 하나를 돌려준다. `rule`을 주지 않으면 `combine` 값과 무관하게 항상 합친다(모든 룰의 저장 묶음을 늘어놓는 것은 쓸모가 없기 때문이다). 합친 결과는 `{combined: true, limit, scope, entries}`이고, `limit`은 전체면 `OVERALL_MAX_ENTRIES`(20) 그 밖에는 `MAX_ENTRIES`(10), `scope`는 전체면 `null`, 각 `entries` 항목에는 `rank`·`nickname`·`score`·`recordedAt`에 더해 그 기록이 나온 `rule`·`difficulty`·`colors`·`opponent`가 들어간다.
- **`getCombinedRecordList()`에 적 거르기를 더했다.** 화면에서는 적을 고르면 끝 항목이라 쓰이지 않지만, `leaderboard_records`가 끝 항목까지 같은 방식으로 물어볼 수 있어야 하기 때문이다.
- **`leaderboard_show`도 `rule`이 선택 사항이다.** 주지 않으면 `clearSelection()`으로 고른 항목을 지우고 처음 화면(전체 순위)으로 돌아가며 `Showing the overall ranking across every rule.`를 돌려준다. 사이드바 머리글을 누르는 것과 같은 동작이다.
- **읽기 전용 유지**: 합친 순위를 낼 때 `state.data = state.api.getData()`로 저장소를 다시 읽지만 화면을 다시 그리지는 않는다. 저장값은 바꾸지 않으므로 `readOnlyHint`는 그대로다.
- **설명서 갱신**: `leaderboard_manual`에 전체 순위(20개)와 단계별 통합 순위(10개), 사이드바 머리글로 처음 화면에 돌아가는 법, 모든 메뉴 항목이 순위를 보여 준다는 점, 두 순위 모두 저장값에서 그릴 때 산출할 뿐 따로 저장하지 않는다는 점을 넣었다.
- **검증**: `tests/test05_leaderboard.spec.js`에 `WebMCP` 그룹(도구 세 개 등록, `combine` 통합 조회와 거절, `leaderboard_show`의 중간 단계·전체 순위, `leaderboard_manual` 문구)을 더해 21개 × Chromium·Firefox·WebKit = 63개가 모두 통과했다. 다른 테스트 파일처럼 `document.modelContext`를 가짜로 심어 `window.registeredWebMcpTools`에 모으는 방식을 쓴다. `node --check`, ESLint, `git diff --check`도 통과했다.

### 리더보드 서버 기록과 로컬/온라인 보기 (2026-09-21, BUILDNO 103)

`TODO.md`의 "리더보드 서버에도 같이 저장" 요구를 구현했다. **로컬 스토리지 저장 규칙과 형식(`puyow_leaderboard`, 형식 버전 2)은 그대로이고**, 그 뒤에 서버 전송이 한 단계 더 붙는 구조다. `src/js/puyow.js`를 고쳤으므로 BUILDNO는 103, `package.json` 버전은 `0.1.103`이며 번들(`src/bundle/puyow.bundle.js`)도 다시 만들었다.

**백엔드 구조** — 온라인 플레이와 같은 방식으로 서비스와 저장소를 나눴다. `node/leaderboard.js`·`python/leaderboard.py`가 닉네임·기록 검증과 순위 병합, HTTP 처리를 맡고, `node/leaderboard_storage.js`·`python/leaderboard_storage.py`의 `FileLeaderboardStorage`가 파일 입출력만 맡는다(`FileOnlinePlayStorage`와 같은 계약: `initialize`/`loadPlayer`/`savePlayer`/`listPlayers`). 저장소는 생성자로 교체할 수 있어 테스트에서 독립 경로를 넣는다. **두 언어의 규칙과 응답 형식은 같아야 하므로 한쪽을 고치면 다른 쪽도 함께 고친다.**

- **켜고 끄기**: `node/server.js`의 `LEADERBOARD_SERVER_ENABLED`, `python/pythonserver.py`의 `SERVER_CONFIG["leaderboard_enabled"]` 하나로 결정하며 **기본값은 true**다(온라인 플레이의 기본값 false와 다르다. 계정·비밀번호가 없는 점수 기록이라 바로 쓸 수 있게 두었다). 끄면 저장 디렉터리도 만들지 않고 모든 요청을 404로 거절한다.
- **API**: `/apis/leaderboardinfo`(GET, `{available}`), `/apis/leaderboard/record`(POST, 기록 하나 저장), `/apis/leaderboard/records`(GET, 모두 모아 조회)다. 오류는 `{ok:false, code}` 형식이며 코드는 `leaderboard_disabled`·`method_not_allowed`·`invalid_body`·`invalid_nickname`·`invalid_record`·`not_found`·`server_error`다.
- **저장 위치와 이름**: `[홈디렉토리]/.puyowserver/leaderboard/[닉네임].json` 한 사람당 한 파일이다. 내용은 `{version:1, nickname, records:[{rule, difficulty, colors, opponent, score, recordedAt}]}` 평면 배열이고, 순위(룰·AI 난이도·색 수·적)마다 점수 내림차순 10개(`MAX_ENTRIES`)만 남긴다. 한 파일의 상한은 `MAX_RECORDS_PER_PLAYER`(2000)다.
- **닉네임 검증**: 파일 이름으로 쓸 수 없는 문자(`\ / : * ? " < > | ' ! .` 와 제어 문자)가 하나라도 있으면 저장하지 않는다(`normalizeNickname`/`normalize_nickname`). **마침표를 막는 것이 중요하다.** `..`으로 상위 경로를 가리키는 것을 원천 차단한다. 20자를 넘거나 비어 있어도 거절한다. 게임 쪽 `PLAYER_NAME_FORBIDDEN_PATTERN`에도 마침표를 더해 설정 화면에서 먼저 막으므로, 서버가 거절할 이름은 애초에 저장되지 않는다. 서로 다른 사람이 같은 닉네임을 쓰는 경우는 (요청대로) 고려하지 않았다.
- **동시 저장 대비**: node.js는 단일 스레드이고 저장소가 동기 입출력을 쓰므로 읽기·고치기·쓰기가 한 번에 끝난다(잠금 없음). 파이썬은 `ThreadingHTTPServer`라 `FileLeaderboardStorage`가 `threading.Lock`을 들고 있고 서비스가 `with self.storage.lock():`으로 감싼다.
- **기록 일시**: 요청에 `recordedAt`이 들어와도 무시하고 서버 시각(`Date.now()`/`time.time()`)으로 적는다. 게임도 이 값을 보내지 않는다.
- **조회 응답**: `/apis/leaderboard/records`는 모든 사람의 기록을 합쳐 `{ok, version:2, maxEntries, records}`를 돌려주며, **`records` 구조는 게임이 localStorage에 두는 것과 똑같다**(대전 룰은 `룰 > 난이도 > 색 수 > 적`, 단독 룰은 `룰 > 색 수`, 항목은 `{name, score, recordedAt}`). 그래서 리더보드 화면은 로컬이든 온라인이든 같은 코드로 그린다.
- **관리 화면**: `getServerInfo()`·`admin_server_info()`의 `leaderboard`에 `{enabled, players, records}` 요약을 실어 보낸다.

**게임(`src/js/puyow.js`)** — `refreshLeaderboardServerAvailability()`를 초기화 때 한 번 불러 `leaderboardServerAvailable`에 담아 둔다(`refreshLocalAiAvailability`·`refreshOnlinePlayAvailability` 옆). `recordLeaderboardResult()`는 기존대로 `addLeaderboardRecord()`로 로컬에 저장한 뒤, 이어서 `sendLeaderboardRecordToServer()`로 같은 내용을 POST한다. **전송은 응답을 기다리지 않고 모든 오류를 삼킨다**(`try`와 `.catch()` 둘 다 둔다). 통신 오류로 게임이 멈추면 안 되기 때문이다. **로컬 10위 밖이라 저장하지 않은 기록도 서버에는 보낸다.** 서버 순위는 여러 사람이 함께 겨루므로 내 로컬 순위와 기준이 다르기 때문이다. `loadLeaderboard()`는 저장소를 읽는 부분과 정리하는 부분(`normalizeLeaderboardData()`)으로 나눴고, 서버 응답도 같은 정리 함수를 거친다.

**리더보드 화면** — 사이드바 아래 `기록` 줄에 `로컬`/`온라인` 토글(`.lb-source`, `role="radiogroup"`)을 두었다. 상태는 `state.source`·`state.serverAvailable`·`state.localData`·`state.onlineData`다.

- 화면을 열 때는 **로컬 기록을 먼저 보여 주고**, `PuyoW.leaderboard.checkServer()` 확인이 끝나면 온라인 단추만 켠다(기다리지 않는다). 서버가 기록을 모으지 않으면 온라인 단추가 `disabled`이고 아래에 `이 서버는 온라인 기록을 모으지 않습니다.`가 나온다.
- 온라인을 처음 고르면 `PuyoW.leaderboard.getServerData()`로 한 번 읽어 `state.onlineData`에 담아 두고 그 뒤로는 그 값을 쓴다. 읽는 동안에는 `기록을 불러오는 중...`을, 실패하면 **로컬로 되돌린 뒤** `온라인 기록을 불러오지 못했습니다.`를 보여 준다.
- 다른 탭에서 기록이 바뀌어 `storage` 이벤트가 와도 온라인 보기 중이면 화면을 바꾸지 않고 `state.localData`만 갱신해 둔다.
- 본문 아래 설명은 출처에 따라 `기록은 이 브라우저에만 저장됩니다.`와 `온라인 기록은 이 서버에 모인 다른 사람들의 기록입니다.` 사이를 오간다(`getSourceNote()`).
- WebMCP `leaderboard_records`·`leaderboard_show`에 `source`(`local`·`online`)를 더했다. 주지 않으면 지금 보고 있는 출처를 쓰고, 응답에 `source`를 함께 담는다. `online`을 주면 화면도 함께 바뀌며, 서버가 기록을 모으지 않으면 오류를 던진다. `leaderboard_manual`도 토글 설명을 싣는다.

**검증** — `python/test_leaderboard.py` 9개(닉네임·기록 검증, 사람마다 한 파일, 순위 병합, 순위별 10개 제한, 스레드 30개 동시 저장, 기능 끔) 통과. `tests/test05_leaderboard.spec.js`는 `page.route()`로 세 API를 흉내 내 **실제 홈 디렉터리를 건드리지 않고** 확인하며(도우미 `stubLeaderboardServer`), 29개 × Chromium·Firefox·WebKit = 87개가 모두 통과했다. **기록을 남기는 테스트에는 `stubLeaderboardServer(page, {available:false})`와 `page.reload()`를 먼저 둔다.** 사용 가능 여부는 초기화 때 한 번만 확인하므로 흉내 낸 API를 붙인 뒤 다시 읽어야 하고, 이렇게 해야 진짜 서버가 떠 있어도 테스트가 홈 디렉터리에 파일을 만들지 않는다. 여기에 더해 실제 node 서버와 파이썬 서버를 임시 홈 디렉터리로 각각 띄워, 기록 저장 → 파일 생성 → 온라인 조회 → 화면 표시까지 손으로 한 번씩 확인했다. `node --check`, ESLint, `git diff --check`도 통과했다. **주의: `tests/test01_menu.spec.js`의 언어 폴백·화면 회전 관련 4개는 이 작업 전부터 실패하던 것이다**(변경분을 모두 치워 두고 확인했다). 이 작업과 무관하다.

## 작업를 마치기 전 수행할 추가 작업 및 참고 사항

### 적별 사운드 데이터 JSON 적용 (2026-09-22, BUILDNO 105)

`applySoundDataJson()`은 `enemies` 객체를 적 클래스명(`getClassType()` 반환값)별로 읽는다. 각 적 항목의 `spellCombo1~7`과 `backgroundMusic` 중 값이 있는 것만 기존 `EnemySoundPool`에 덮어쓴 뒤 `setEnemySoundPool()`으로 등록한다. 따라서 JSON에 없는 속성은 기존 값을 유지하며, 현재 대전 중인 같은 적도 다음 연쇄부터 새 사운드풀을 사용한다. 등록되지 않은 적 이름이나 효과음 값이 없는 항목은 무시한다. 사용 방법은 `docs/Sound.md`와 `docs/Sound.en.md`의 `enemies` 예제로도 안내한다. `src/js/puyow.js`를 고쳤으므로 BUILDNO는 105, `package.json` 버전은 `0.1.105`다.

### 캔버스 화면 맞춤 모드와 여백 (2026-09-23, BUILDNO 106)

`src/js/puyow.js`의 `canvasFitMode`(0|1, 기본 1)와 `canvasFitMargin`(`{top,right,bottom,left}` px, 기본 모두 0)이 게임 화면을 웹 페이지에 맞추는 방식을 정한다. 두 값은 **initialize 전에만** 공개 `setCanvasFitMode(mode)`·`setCanvasFitMargin(margin)`으로 바꾼다(초기화 뒤에는 `setNoticeFile()`처럼 오류). `setCanvasFitMargin`은 숫자 하나(네 방향 동일) 또는 부분 객체(생략 방향 0)를 받고 음수·비유한수는 거절한다. 조회용 `getCanvasFit()`과 `getScreenLayout()`도 공개했다. 사용법 문서는 `docs/Graphics.md`·`docs/Graphics.en.md`의 「화면 맞춤 모드와 여백」 절이다.

- **모드 0**: 스크립트가 크기를 건드리지 않는다. `shouldRotateCanvasForViewport()`가 항상 false라 세로 화면 회전·`puyow-portrait` 클래스가 없고 `화면 가로방향 고정` 설정도 효과가 없다. `prepareRuntimeLayoutStyle()`의 최상위 div 규칙은 명시도 0인 `:where(.div_puyow_root)`로 바꿔 기본값(`width: 100%; aspect-ratio: 16 / 9; position: relative` 등)만 주고 페이지 CSS가 덮어쓸 수 있게 했다. canvas 두 장은 div를 100% 채운다.
- **모드 1**: `applyCanvasFitLayout()`이 `window.innerWidth/innerHeight`에서 여백을 뺀 영역을 최상위 div의 인라인 `width`·`height`로, 여백을 인라인 `margin`으로 준다. 16:9가 짧은 쪽에 100% 맞도록 배율을 구하고(회전 시 게임 가로 1280이 화면 세로에 대응) 남는 공간을 반씩 나눠 canvas 두 장의 인라인 `left`·`top`·`width`·`height`로 가운데 배치한다. 세로 화면이면 인라인 `transform: translateX(canvas높이px) rotate(90deg)`, `transform-origin: top left`로 시계 방향 회전한다. 예전의 `body.puyow-portrait` CSS 규칙(100vw 기준)은 지웠고, `puyow-portrait` 클래스 자체는 호환을 위해 모드 1에서 계속 붙인다. `updateCanvasOrientation()`(resize·orientationchange·설정 저장·초기화 때 호출)이 `applyCanvasFitLayout()`을 부른다.
- **클릭 좌표**: `getCanvasEventCoordinates()`는 그대로다. `getBoundingClientRect()` 기준이라 여백·가운데 정렬에도 맞고, 회전 여부는 `shouldRotateCanvasForViewport()`를 따른다.
- **destroy**: `clearCanvasFitLayout()`이 모드 1에서 넣은 인라인 속성(`CANVAS_FIT_ROOT_STYLE_PROPERTIES`·`CANVAS_FIT_CANVAS_STYLE_PROPERTIES`)만 지운다. 외부에서 받은 div의 다른 인라인 스타일은 건드리지 않는다.
- **개발용 도구**: `puyow_tools.js`는 `resizeCanvasRoot()`로 캔버스 영역 크기를 직접 정하므로 게임 초기화 직전에 `setCanvasFitMode(0)`을 부른다(모드 1의 인라인 크기가 도구 레이아웃을 덮어쓰지 않게).
- **WebMCP**: 읽기 전용 `screen_layout` 도구(`getScreenLayout()`: `fitMode`·`margin`·`rotated`·`viewport`·`canvasRect`)를 더했고, `manual` 마지막 문단에 설명을 붙였다. `now_screen`의 반환 형식은 바꾸지 않았다(기존 테스트가 정확히 비교한다).
- **검증**: `tests/test01_core.spec.js`에 「캔버스 맞춤 모드 1은 여백을 뺀 화면의 짧은 쪽에 맞추고…」 테스트를 더했다(17:9·4:3·세로 화면 배치, 회전+여백에서의 클릭, 모드 0의 무회전, destroy 뒤 인라인 스타일 정리). 뷰포트를 바꾼 직후에는 resize가 늦게 처리될 수 있어 `innerWidth`를 기다린 뒤 resize 이벤트를 한 번 더 보낸다. WebMCP 도구 수 기대값은 6으로 올렸다. `test01_menu.spec.js`의 세로 화면·가로 고정 테스트는 가운데 정렬에 맞춰 `top` 기대값만 고쳤다. test01_core 전체(Chromium·Firefox·WebKit 120개)와 test02_tools(Chromium 46개)가 통과했다. **`test01_menu.spec.js`의 세로 화면 회전·가로방향 고정·가로방향 고정 문구 번역·설정 언어 테스트는 이 작업 전(HEAD)에도 실패한다**(설정 화면에 AI 제공자 행이 보여 키보드 포커스 순서가 테스트 가정과 다르다). 이 작업과 무관하다.

### 리플레이 재생 페이지 (2026-09-23, BUILDNO 107~110)

`TODO.md`의 "리플레이 재생용 페이지" 요구를 구현했다. (BUILDNO 111에서 툴바 오른쪽 끝에 `게임으로 돌아가기` 링크를 더했다. 아래 「메인 메뉴 리플레이 재생 버튼의 리플레이 페이지 이동」 절.) 게임의 리플레이 재생 코드(`startReplayPlayback()` 등)를 그대로 쓰고, 페이지 전용 코드는 `src/js/puyow_replay.js`(전역 `PuyoWReplay`)와 `src/replay.html`(구조·스타일)에 둔다. `src/js/puyow.js`에는 연결 지점만 더했다. 첫 구현이 BUILDNO 107, 같은 날 후속 요청(불러오기 전 캔버스 숨김·결과 화면 종료 버튼 숨김)이 BUILDNO 108, 그다음 요청(페이지 자체 다국어·WebMCP 도구, `resume()`·`getSource()` 추가)이 BUILDNO 109, 리플레이 페이지에서 배경음악이 재생되도록 사용자 시작 상태를 설정한 수정이 BUILDNO 110이다(이후 버전은 아래 BUILDNO 111 절).

- **`puyow.js`의 `PuyoW.replay` API**(`replayApi`, `finishReplayPlayback()` 바로 뒤): `setPageMode(enabled)`, `isValid(data)`, `load(data)`, `pause()`, `resume()`, `restart()`, `getSource()`, `getState()`, `getLanguage()`. `resume()`(BUILDNO 109)은 일시정지 화면 `재개`와 같은 `resumePausedGame()`(기존 `activatePauseMenu()`의 재개 분기를 그대로 떼어 낸 함수, 3초 재개 카운트다운)을 부르며 재생 중 일시정지 상태가 아니면 `false`다. `getSource()`(BUILDNO 109)는 결과 화면 `리플레이 복사`와 같은 기준(`playback.source`, 없으면 `JSON.stringify(playback.replay)`)의 JSON 문자열을, 재생 중이 아니면 `null`을 돌려준다. `data`는 리플레이 JSON 문자열이나 객체이고 `normalizeReplayData()`로 검사한다. `load()`는 초기화 전이거나 데이터가 올바르지 않으면 `false`이고, 진행 중인 게임(다른 모드 포함)이 있으면 배경음을 멈추고 `releaseGameRuntimeResources()`를 기다리지 않고 부른 뒤 곧바로 `startReplayPlayback(replay, source)`로 바꾼다(재생 게임은 모델·Worker를 쓰지 않으므로). `source`는 문자열이면 앞뒤 공백을 뺀 원문, 객체면 `JSON.stringify()` 결과이며 결과 화면의 `리플레이 복사`가 이 값을 쓴다. `pause()`는 ESC와 같은 처리(`game.paused`, `pauseMenuFocus = 0`, `pauseBackgroundMusic()`)이며 재생 중이 아니거나 카운트다운(`game.countdown > 0`)·종료 연출·다시하기 대기·이미 일시정지면 `false`로 거절한다. `restart()`는 기존 `restartReplayPlayback()`(일시정지 다시하기·결과 화면 다시보기와 같은 경로, 3초 카운트다운 포함)을 부른다. `getState()`는 `{loaded, running, paused, countdown, finished, restartPending}`이다.
- **종료 버튼 숨김**: 모듈 변수 `replayPageMode`(기본 false)가 참이고 `game.replayPlayback`이 있을 때만 `getPauseMenuButtons()`가 `재개`(x 470)·`다시하기`(x 660) 두 버튼을 가운데에 놓아 돌려준다. 그리기·방향키 순환·클릭 판정·실행이 모두 이 함수를 쓰므로 이 한 곳만 바꿨다. 게임 페이지는 `setPageMode(true)`를 부르지 않으므로 기존 세 버튼 그대로다. 판정은 `isReplayPagePlayback()`(`replayPageMode && game?.replayPlayback`) 하나로 모았다.
- **결과 화면 종료 버튼 숨김(BUILDNO 108)**: 같은 조건에서 `getResultScreenButtons()`가 `종료`를 넣지 않아 리플레이 결과 화면은 `다시보기`(0번, 기본 포커스)·`리플레이 복사` 두 버튼이다. 결과 화면의 ESC도 `종료`와 같은 `closeResultScreen()`이므로 이 조건에서는 무시한다. 그래서 리플레이 페이지에서는 한 번 불러온 뒤 재생 게임이 메뉴 화면으로 바뀌는 경로가 없다.
- **불러오기 전 캔버스 숨김(BUILDNO 108)**: `body`가 처음부터 `replay-empty` 클래스를 갖고, 이때 `#puyow_target`을 `visibility: hidden`으로 숨기고(배치 크기 유지, 클릭도 받지 않음) 가운데에 안내 문구(`.replay-empty-guide`, `JSON 불러오기 또는 목록에서 불러오기로 리플레이를 불러와 주세요.`)를 보인다. `syncToolbarButtons()`가 `getState().loaded`에 맞춰 클래스를 뗀다. 숨긴 초기 화면이 키 입력으로 메인 메뉴 등으로 넘어가지 않도록 `handleKeydown()` 맨 앞에서 `replayPageMode && !game?.replayPlayback`이면 입력을 무시한다(게임패드도 이 함수를 거친다). 게임 자체는 초기 화면 상태로 계속 돌며 그리기만 보이지 않는다.
- **화면 구성**: 가운데 게임 캔버스(맞춤 모드 1, `setCanvasFitMargin({bottom: 툴바 높이})`, 툴바 높이는 CSS 변수 `--replay-toolbar-height` 56px), 하단 고정 툴바(`JSON 불러오기`·`목록에서 불러오기`·`일시중지`·`처음부터`, 오른쪽 끝에 `게임으로 돌아가기` 링크(BUILDNO 111), 좁은 화면에서는 줄바꿈 대신 가로 스크롤), 평소 숨긴 우측 사이드바(`.replay-sidebar`, 캔버스 위에 겹쳐 뜬다), JSON 입력 레이어 팝업(`.replay-dialog-backdrop`, textarea + `확인`·`취소`). 세로 화면에서는 게임 캔버스만 기존처럼 회전한다.
- **툴바 상태**: 게임 캔버스 안의 `재개`나 결과 화면 전환으로도 상태가 바뀌므로 `puyow_render` 이벤트(매 프레임)에서 `syncToolbarButtons()`가 `getState()`로 맞춘다(바뀐 경우에만 DOM을 쓴다). `일시중지`는 불러온 리플레이가 재생 중이고 일시정지·다시하기 대기가 아닐 때 켜진다. 카운트다운 중에도 켜져 있지만 누르면 `pause()`가 거절해 아무 일도 없다. 재생이 끝나(결과 화면) `running`이 false면 꺼진다. `처음부터`는 불러온 리플레이가 있으면 켜진다. 종료 경로가 없어 재생 게임이 사라지지 않지만, 혹시 게임이 비워지면 페이지가 마지막으로 불러온 데이터(`lastReplayData`)로 다시 `load()`한다.
- **키 입력 격리**: 게임은 `window` keydown에서 방향키·Enter·Space 기본 동작을 막고 Enter를 메뉴 입력으로 쓴다. 그래서 툴바·사이드바·팝업 요소에 keydown/keyup 리스너를 달아 `stopPropagation()`으로 게임에 넘기지 않는다(textarea 입력·버튼 키보드 조작 유지). 팝업은 ESC 닫기·Ctrl(⌘)+Enter 확인, 사이드바는 ESC 닫기. 마우스로 누른 툴바 버튼은 `blur()`해 이후 키 입력(ESC·일시정지 메뉴 조작)이 다시 게임으로 가게 한다. 팝업 바깥 음영 클릭으로는 닫지 않는다(긴 JSON 입력을 잃지 않게).
- **리플레이 목록**: `puyow.js` 스크립트 태그 주소 기준의 `replays.json`(찾지 못하면 `puyow_replay.js` 주소, 그다음 문서 주소 기준)을 `fetch`한다. 읽기·JSON 해석 실패·배열 아님은 `console.error('리플레이 목록을 불러오지 못했습니다.', …)` 후 빈 목록과 `불러올 수 있는 리플레이가 없습니다.`를 보인다. 성공한 목록만 보관하고(실패하면 다음에 열 때 다시 읽는다) 각 항목은 `번호.` + `룰 · N색 · 구경/너랑 나랑` 제목 줄과 `이름 vs 이름` 보조 줄로 보인다(`describeReplay()`). 룰 이름(`RULE_LABELS`: standard·fever·feverStart·relaxedFever → 게임 화면과 같은 영어 이름)·`%1 Colors`·`Watch`·`Play Together`는 페이지 번역표를, 플레이어 이름만 게임 번역표(`PuyoW.translate`, 적 이름이 게임 데이터의 한국어 원문이라서)를 쓴다. 항목 불러오기에 실패하면 사이드바 위쪽 메시지 칸에 `N. The replay data is invalid.`(한국어 `리플레이 데이터가 올바르지 않습니다.`)를 보이고 사이드바를 열어 두며, 성공하면 닫는다. JSON 팝업의 실패도 팝업 안 메시지 칸에 바로 보인다(빈 입력은 `Enter the JSON code.`).
- **다국어(BUILDNO 109에서 다시 짬)**: 한국어·영어·일본어·중국어·독일어·프랑스어를 지원하고 **기본 언어는 영어**다. 개발용 도구·리더보드 페이지처럼 **영어 원문을 번역 키**로 쓰고, 번역 데이터는 `puyow_replay.js`의 `REPLAY_STRINGS`(`ko`·`ja`·`zh`·`de`·`fr`)에 따로 둔다. 게임 번역표(한국어 원문 키)와 섞지 않는다. 번역이 없으면 영어 원문 그대로다. 페이지의 `translate(text, ...values)`가 `%1`, `%2`를 채운다. 언어는 `detectLanguage()`가 캔버스와 어긋나지 않도록 **게임 화면 언어**(`PuyoW.replay.getLanguage()`: 저장된 설정 언어, 없으면 브라우저 언어)를 먼저 보고, 지원하지 않으면 브라우저 언어, 그것도 아니면 영어로 정해 `pageLanguage`에 담는다(`<html lang>`도 맞춘다). HTML에는 `data-replay-text`(본문)·`data-replay-label`(aria-label)에 영어 원문을 적고 초기 표시도 영어다. `puyow_changescreen` 때 언어가 바뀌었으면 다시 적는다. 문구를 더하면 다섯 표에 모두 넣는다. 외부에서는 `PuyoWReplay.getLanguage()`·`PuyoWReplay.translate()`로 확인한다.
- **WebMCP(BUILDNO 109)**: `initialize()` 끝의 `registerMcpTools()`가 `document.modelContext`에 `replay_` 접두어 도구 10개를 등록한다(미지원 브라우저는 아무 일도 안 함, `AbortController` 신호 사용). 같은 문서에 게임 도구 여섯 개(`manual`·`now_screen`…)도 `PuyoW.initialize()`가 등록하므로 이름이 겹치지 않게 접두어를 쓴다. 도구 설명·결과는 영어다. `replay_manual`(설명서), `replay_status`(JSON: `phase` = empty·countdown·playing·paused·finished·restarting, `countdownMs`, `gameScreen`, `canvasVisible`, `openPanel` = json·list·none, `toolbar` 버튼 사용 가능 여부, `language`, 불러온 리플레이 요약), `replay_list`(JSON: 1부터 시작하는 `number`(사이드바 번호와 같음), `playable`(`isValid()`), 룰·색 수·색·구경/너랑 나랑·플레이어·승자·길이, 읽기 실패 시 `loadFailed`), `replay_load_from_list {number}`(사이드바 항목 클릭과 같은 `selectReplayFromList()`), `replay_load_json {json}`(팝업 확인과 같은 `loadReplay()`, 성공하면 팝업 닫음), `replay_pause`(툴바 일시중지, 거절 이유를 없음·카운트다운·이미 일시정지·재생 끝으로 구분해 알림), `replay_resume`(일시정지 화면 재개), `replay_restart`(툴바 처음부터 = 일시정지 다시하기 = 결과 화면 다시보기), `replay_get_json`(결과 화면 리플레이 복사와 같은 JSON), `replay_show_panel {panel: json|list|none}`(팝업·사이드바를 사람에게 열거나 모두 닫음). 읽기 전용(`readOnlyHint`)은 manual·status·list·get_json이고, 플레이어 이름이 들어가는 status·list·get_json에는 `untrustedContentHint`를 둔다. 잘못된 입력(번호 범위 밖·빈 json·알 수 없는 panel)은 예외, 상태 때문에 못 하는 동작은 이유 문장을 돌려준다. **페이지 기능을 바꾸면 이 도구와 설명서도 함께 고친다.**
- **배경음악 수정(BUILDNO 110)**: 리플레이 페이지는 타이틀 화면을 거치지 않으므로 `hasUserStarted`가 계속 `false`였고, `startBackgroundMusic()`의 시작 조건에 막혀 음악이 나오지 않았다. 유효한 리플레이를 페이지에서 불러올 때 사용자 시작 상태를 설정한다. 게임 페이지의 재생 경로는 바꾸지 않았다.
- **검증**: `node --check`(두 파일), `npm.cmd test`(ESLint) 통과. `tests/test06_replay_page.spec.js` 12개(초기 버튼 상태·캔버스가 툴바 위, 불러오기 전 캔버스 숨김·안내 문구·Enter/ESC 무시와 불러온 뒤 표시, 팝업 textarea 입력 격리·취소·실패·성공, 카운트다운 중 일시중지 무반응·종료 버튼 자리 클릭 무반응·가운데 재개 버튼, 재생 중·일시정지 중 처음부터, 재생 종료 뒤 처음부터, 결과 화면 종료 버튼 없음·ESC 무시·0번 다시보기, 목록 번호·룰·색 수와 선택·닫기·ESC, 목록 404·JSON 해석 실패, 목록 항목 불러오기 실패, 게임 페이지에서는 일시정지·결과 화면의 종료 버튼과 결과 화면 ESC로 메인 메뉴)와 `test01_replay` 10개, `test01_core`·`test01_together`·`test01_puzzle`·`test02_tools` 108개가 Chromium에서 모두 통과했다.
- **BUILDNO 109 검증**: `test06_replay_page.spec.js`에 다국어 7개(ko·ja·zh·de·fr 로케일과 지원하지 않는 es → 영어, 저장된 게임 언어 설정 우선)와 WebMCP 4개(도구 목록·읽기 전용 표시·게임 도구와 이름 중복 없음, 목록 조회→목록 불러오기→카운트다운 중 일시정지 거절→일시정지→재개→처음부터→JSON 조회, JSON 불러오기와 패널 열기·닫기, 재생 끝 finished와 처음부터)를 더해 23개가 되었고, `test01_replay`와 함께 Chromium 33개, Firefox·WebKit 46개가 모두 통과했다. `test01_core`·`test01_together`·`test01_puzzle`·`test02_tools`·`test01_fever` Chromium 129개 중 128개가 통과했고, 실패한 `피버·연속 피버에서 새로 지급된 조작 뿌요의 자연 낙하는 1.5배가 아니다`는 단독 3회 반복에서 모두 통과해 부하 때문에 흔들리는 테스트로 본다(일시정지 경로를 쓰지 않는다). 테스트에서 게임 저장값을 직접 넣을 때는 `clearList` 배열이 있어야 `loadStore()`가 그 값을 읽는다.
- **BUILDNO 110 검증**: 이번 배경음악 수정은 자동 테스트를 실행하지 않았다.

### 메인 메뉴 리플레이 재생 버튼의 리플레이 페이지 이동 (2026-09-23, BUILDNO 111)

`TODO.md`의 두 요구(리플레이 페이지에 게임으로 돌아가는 링크, 게임 안 리플레이 재생을 리플레이 페이지로 대체)를 구현했다. 이 작업 당시 `puyow.js`의 BUILDNO는 111, `package.json`(과 `package-lock.json`) 버전은 `0.1.111`이며 `src/bundle/puyow.bundle.js`도 다시 빌드했다.

- **게임으로 돌아가기 링크**: `replay.html` 하단 툴바의 마지막 요소 `<a class="replay-back-link" href="./puyow.html" data-replay-text="Back to game">`이다. `margin-left: auto`로 툴바 오른쪽 끝에 붙고 같은 탭에서 이동한다(리더보드 페이지의 `lb-back-link`와 같은 방식). 문구는 페이지 번역표 `REPLAY_STRINGS`의 `Back to game`(ko `게임으로 돌아가기`, ja `ゲームに戻る`, zh `返回游戏`, de `Zurück zum Spiel`, fr `Retour au jeu`)이며 `applyPageTexts()`가 다른 `data-replay-text` 요소와 함께 번역한다. 툴바의 keydown/keyup 격리 리스너 안에 있으므로 링크에서 누른 Enter는 게임으로 넘어가지 않고 브라우저 기본 동작(이동)만 한다. `data-replay-action`이 없어 `handleActionClick()`은 무시한다. 페이지 WebMCP의 `replay_manual` 첫 문단에도 링크 설명을 더했다(도구는 추가하지 않았다).
- **존재 확인**: `puyow.js`의 `initialize()`가 `refreshReplayPageAvailability()`를 기다리지 않고 부른다. `fetch(convertURL(REPLAY_PAGE_URL), { cache: 'no-store' })`(`REPLAY_PAGE_URL = './replay.html'`, 게임 페이지 기준 상대 경로)의 `response.ok`를 모듈 변수 `replayPageAvailable`에 담는다. 404 등 실패 응답·네트워크 오류·`file://` 실행·`fetch` 미지원이면 거짓이다(오류는 `console.info`만). 리플레이 페이지 자신(`replayPageMode`가 참, `setPageMode(true)`가 `initialize()` 전에 불린다)에서는 메인 메뉴를 쓰지 않으므로 확인하지 않는다. 확인이 끝나기 전에 버튼을 누르면 기존 대화상자가 열린다.
- **버튼 동작**: `activateTitleMenu()`의 `TITLE_REPLAY_FOCUS_INDEX` 분기가 `openReplayPlayback()`을 부른다. 마우스 클릭·방향키·게임패드가 모두 이 함수를 거친다. `replayPageAvailable`이면 `window.location.href = convertURL(REPLAY_PAGE_URL)`(리더보드 버튼의 `openLeaderboardPage()`와 같은 방식), 아니면 `openReplayPlaybackPrompt()`다. 게임 안 재생 코드와 `PuyoW.replay.load()`는 그대로 남아 있다.
- **게임 WebMCP**: `manual`의 리플레이 문단에 버튼이 `replay.html`이 있으면 그 페이지로 이동하고 없으면 JSON 입력 대화상자를 연다는 설명을 더했고, 재생 중 ESC가 결과 화면으로 건너뛴다던 예전 문구를 일시정지 화면을 연다로 바로잡았다. `now_screen` 반환 형식은 기존 테스트가 정확히 비교하므로 바꾸지 않았다. `HOWTO.md`·`HOWTO.en.md`의 리플레이 입력 형식 설명도 버튼 동작에 맞게 고쳤다.
- **테스트 기준선**: 테스트 서버는 `src/`를 그대로 제공해 `replay.html`이 늘 있으므로, `tests/common/gamepage.js`의 `setupGamePage()`가 `hideReplayPage()`로 `**/replay.html`을 404로 돌려준다. 그래서 `clickReplayPlaybackButton()` + `submitTextDialog()`를 쓰는 기존 게임 안 리플레이 테스트는 그대로 대화상자 경로를 쓴다. 페이지 이동을 확인하는 테스트만 `allowReplayPage(page)`(라우트 해제 후 새로 읽기)를 부른다. 게임 페이지 테스트를 `setupGamePage()` 없이 새로 만들고 리플레이 재생 버튼을 누른다면 이 점을 함께 챙긴다.
- **검증**: `node --check`, `npm.cmd test`(ESLint) 통과. `test01_replay.spec.js`에 「replay.html이 없으면 … JSON 입력 대화상자를 연다」·「replay.html이 있으면 … 마우스·키보드 모두 그 페이지로 이동한다」(돌아가기 링크로 복귀 포함) 두 개를, `test06_replay_page.spec.js`에 「툴바 오른쪽 끝의 게임으로 돌아가기 링크를 누르면 게임 페이지로 이동한다」를 더하고 다국어 테스트에 링크 문구 기대값(`back`)을 넣었다. Chromium에서 `test01_replay`+`test06_replay_page` 36개, `test05_leaderboard`+`test01_core` 69개가 통과했고, 새 테스트와 다국어 테스트는 Firefox·WebKit 20개도 통과했다.

### 출시 예정 적 9종 추가 (2026-09-24, BUILDNO 112)

이 절은 추가 당시 기록이다. 현재 출시·AI 배정은 BUILDNO 113의 「현재 AI 배정」을 따른다.

- 오리아스 뒤에 `Amii`(아미)·`Ose`(오세)·`Gremory`(그레모리)·`Orobas`(오로바스)·`Murmur`(무르무르)·`Caim`(카임)·`Alokes`(알로케스)·`Balaam`(발람)·`Purkas`(푸르카스)를 요청 순서대로 추가했다. `sortPriority`는 15~23이며 이름·클래스 철자는 TODO의 표기를 사용한다. 기본 등록 목록과 `PuyoW` 공개 클래스, 영어·일본어·중국어 이름을 연결했다.
- 모두 `OnnxEnemy`를 직접 상속하고 `notAvail = true`, 임시 `modelPath = 'onnx/model03.onnx'`를 사용한다. 초기 AI 상태·메서드는 오리아스와 같고 전용 모델은 아직 없다. 각 클래스의 생성자를 독립적으로 수정해 출시·모델 교체가 가능하다. 모델 미사용 적의 무작위 첫 배치 목록·GOLD 보너스·Python 학습 상대에는 추가하지 않았다.
- 출시 예정 적은 총 10종(오리아스~푸르카스)이다. 기존 공통 필터에 따라 적 선택 화면에 회색 출시 예정 카드로 등록되지만 키보드·마우스·`observation` 코드로 선택할 수 없다. ONNX 런타임이 없으면 적 선택 목록에서 숨긴다. 카드 획득·구경 후보·리더보드 적 목록에서 제외하고, 갤러리에는 기존 잠금 규칙으로 등록한다. 선택 메뉴는 선택한 적을 중심으로 한 기존 가로 배치를 유지하므로 먼 뒤쪽 출시 예정 카드는 화면 밖에 놓인다.
- 새 래스터 파일 없이 기존 `ENEMY_PORTRAIT_STYLES`·`drawCuteEnemyPortrait()` Canvas 스타일을 확장했다. 일반·위기·패배의 눈·입·눈물·팔·기울기는 공통 표정 로직을 사용하고, 전승의 동물·여러 머리는 머리 하나의 인간형에 장식으로 표현한다. 고정 경로는 기존 `enemyPortraitPaths` 캐시에 보관한다.
- 디자인: 아미는 불꽃·별무늬 책(적동색), 오세는 표범 귀·꼬리·가면(올리브색), 그레모리는 허리의 관·낙타 문양 보석함(장밋빛), 오로바스는 말 귀·말발굽 방패(강청색), 무르무르는 공작의 관·날개·나팔·혼불(회녹색), 카임은 검은 새 깃털·검·불씨(회자색), 알로케스는 사자 갈기·별 문장 갑옷·기병창(벽돌색), 발람은 곰 귀·소와 양의 뿔 왕관·매 문장·뱀 꼬리(황토색), 푸르카스는 백발·수염·갈래창·철학서(청회색)다. 각 `getFieldThemeColors()`에 필드·베젤·중앙 배경을 정의했으며 필드가 베젤보다 밝고 중앙이 가장 어둡다.
- 전승은 TODO에 있는 [위키백과 목록](https://en.wikipedia.org/wiki/List_of_demons_in_the_Ars_Goetia)을 확인했다. 나무위키 주소는 열리지 않았다. 상세 목록·공개 API·출시 절차는 `docs/Enemy.md`와 영어 문서에도 반영했다.
- 검증: 기존 초상화 회귀 검사를 24명 × 3표정 × 5배율로 확장하고, 전체 비교 이미지를 각 적의 필드색 배경으로 직접 확인했다. 가장자리 잘림·표정 구별·캐릭터 구별·Canvas 상태 복원, 신규 클래스의 AI 상태·메서드·모델 경로 독립성, 갤러리 등록·스크롤·초상화, 출시 예정 10종의 카드 제외, 화면 안 회색 카드의 클릭 및 키보드 선택 차단을 검사했다. 관련 5개 테스트가 Chromium·Firefox·WebKit에서 모두 통과했다(총 15개). 출시 전용 AI나 실제 모델 추론 대전은 이번 범위가 아니다.
- `src/js/puyow.js` BUILDNO를 112로 한 번 올리고 `package.json`·`package-lock.json`을 `0.1.112`로 맞췄다. 버전값 자체는 테스트하지 않는다. 브라우저 검증 서버가 webpack 빌드를 실행해 `src/bundle/puyow.bundle.js`도 갱신했다.

### 적 AI 대규모 이관 및 출시 (2026-09-24, BUILDNO 113)

- 최신 TODO의 배정표대로 변경 전 원본 AI를 이관했다. 현재 배정은 위 「현재 AI 배정」 표를 따른다. 모델은 무르무르 `model01.onnx`, 카임 `model02.onnx`, 알로케스 `model03.onnx`이며 새 모델을 학습하거나 모델 파일을 수정하지 않았다.
- 오리아스부터 알로케스까지 8종을 출시했다. 발람·푸르카스는 `Enemy`를 상속하는 AI 미구현 출시 예정 적이다. ONNX 의존성과 임시 모델 경로를 제거해 이름 옆 모델 경고도 없고, 런타임이 없어도 회색 카드가 보인다. 출시 예정 선택 차단과 갤러리 등록은 유지한다.
- 기존 벨리알·암두시아스·키마리스의 판단을 각각 `PreviewChainEnemy`·`FiveChainEnemy`·`TwoMoveLookaheadEnemy`에 보존했다. 여러 대상이 같은 전략을 공유하되 표시 메서드·캐릭터 타입·등록 순서는 각각 유지한다. Python도 같은 전략 분리를 적용했고, 학습 상대는 단탈리온~오로바스 17종이다. 연쇄 유도 탐험의 안내 적은 이전 세 전략을 보존하도록 안드레알푸스·안드라스·자간으로 옮겼다.
- 이름·초상화·테마·기존 저장 진행도·확인 기록·GOLD 배율은 바꾸지 않았다. 모델 미사용 빈 필드 무작위 첫 배치 목록을 확장했고, 기존 공통 필터가 새 출시 적의 선택·구경·카드·리더보드 목록을 처리한다. 버전은 `0.1.113`, 번들도 다시 빌드했다. 버전값 자체는 테스트하지 않았다.
- **원본 비교**: 변경 전 Git 소스와 이관 대상 18개의 모든 초기 AI 상태·판단 메서드 및 캐릭터 표시를 비교해 일치를 확인했다. Python에서는 원본과 대상의 초기 설정 및 기본 룰·피버 룰 일반 상태·피버 활성 상태의 135개 배치 결과가 일치했다. 시간에 따른 탐색 깊이 차이를 없애기 위해 이 비교에서만 실시간 탐색 계열의 시간 예산을 0으로 고정해 1수 결과를 비교했다. Worker 3수와 실시간 반응은 브라우저 회귀 검사로 별도 확인했다.
- **검증**: ESLint·JS 구문 검사·번들 빌드 통과. Python `test_learning` 174건 중 173건 통과·1건 건너뜀이며, 마지막 학습 상대 목록 보강 후 `TrainableOpponentPoolTest` 3건도 통과했다. 실행 환경의 `LC_ALL`·`LC_MESSAGES`가 macOS 언어 폴백 검사에 영향을 주므로 전체 Python 검사는 이 두 환경 변수를 비운 프로세스에서 실행했다.
- **브라우저 검증**: Chromium에서 `test01_core`·`test01_enemy`·`test01_menu`·`test01_fever_damage`·`test03_ai` 210건을 실행했다. 최초 190건 통과, 카드 테스트 1건은 늘어난 카드 수에 맞춘 검사 수정 중 탭 이동 횟수가 잘못돼 바로잡았다. 남은 설정·언어·Local AI 관련 19건은 변경 전 게임 소스를 제공해 다시 실행해도 같은 실패가 재현되는 기존 문제다. 임시 비교용 테스트 파일은 제거했다. 최종적으로 카드·출시 예정 선택 차단·ONNX 경고/첫 확인·런타임 없음·AI 미구현 상태·리더보드 목록 6개 검사를 Chromium·Firefox·WebKit에서 실행해 18건 모두 통과했다.

### 게임 시작 선택 메뉴 2단계 분리 (2026-09-24, BUILDNO 114)

- `게임 시작`은 `ruleSelectionStep`으로 첫 단계(`category`)와 적 대전(`opponent`)·스스로 연습(`practice`) 하위 단계를 구분한다. 세 단계 모두 외부 `getScreenState()`에는 기존 `rule_select`로 표시한다. 버튼 그리기와 클릭 판정은 `getRuleSelectionOptions()`·`getRuleSelectionButtonBounds()`를 함께 사용한다.
- 첫 단계는 적과 대전·스스로 연습·퍼즐뿌요·취소다. 적 대전의 하위 선택지는 기본 룰·피버 룰·피버 룰 (시작)·취소이며, 스스로 연습은 연습·연속 피버·취소다. 잠긴 피버 룰 (시작)은 기존처럼 선택할 수 없다. 바깥 클릭은 무시하고 ESC는 각 단계의 취소와 같다. 첫 단계 취소는 메인 메뉴, 하위 단계 취소는 첫 단계의 부모 항목으로 돌아간다.
- 퍼즐뿌요는 첫 단계에서 곧바로 스테이지 선택 화면으로 이동한다. 스테이지 선택에서 취소·ESC를 누르면 메인 메뉴로 돌아간다. 연습·연속 피버 색상 선택의 취소는 스스로 연습 하위 단계로 돌아가며 선택했던 모드에 포커스를 둔다. 색상 선택 화면의 ESC와 바깥 클릭은 기존대로 메인 메뉴로 돌아간다.
- 새 첫 단계 문구의 다국어 번역, `HOWTO.md`·`HOWTO.en.md`의 대전 진입 설명, 관련 Playwright 진입 경로를 갱신했다. `src/js/puyow.js` BUILDNO와 패키지 버전은 114이며 번들을 다시 생성했다. `node --check`, ESLint, webpack 빌드와 Chromium의 메뉴·게임패드·대전·피버·퍼즐 관련 검사를 통과했다.

### 게임 시작 메뉴의 대전 명칭 변경 (2026-09-24, BUILDNO 115)

- 첫 단계의 `적과 대전`을 `도장깨기`로 바꾸고 영어·일본어·중국어·독일어·프랑스어 번역 키도 새 문구에 맞춰 갱신했다. 선택 동작과 두 번째 단계의 룰 선택은 그대로다.
- `src/js/puyow.js` BUILDNO와 `package.json`·`package-lock.json` 버전은 115 (`0.1.115`)다. 버전값 검사는 수행하지 않았다.

### 도장깨기 완화 피버 룰 추가 (2026-09-24, BUILDNO 116)

- 도장깨기 하위 메뉴를 기본 룰/피버 룰 3종/취소의 3줄로 배치했다. 가운데 줄은 좌우로 이동하고, 위아래로 기본 룰과 취소에 이동한다. 버튼 영역은 그리기와 클릭에서 같은 함수를 쓴다.
- 피버 룰 (완화)은 피버 룰 (시작)과 동시에 열리고, 구경의 완화 피버처럼 양쪽 최소 전등 수가 3이다. 적 잠금과 승리 진행도는 `relaxedFeverClearListByDifficulty`에 따로 저장한다. 승리 시 적 갤러리는 해금하며, 기존 피버 룰과 같은 GOLD 계산을 쓴다.
- 리더보드와 게임 상태·승리/해금 이벤트는 `relaxed_fever`, 리플레이 메타데이터와 메뉴 내부는 `relaxedFever`를 쓴다. Node/Python 서버도 별도 리더보드 룰을 받는다. 구경 메뉴와 리플레이 페이지의 표시는 `피버 룰 (완화)`로 통일했다.
- BUILDNO와 패키지 버전은 116 (`0.1.116`)이다. JS 문법 검사·ESLint·webpack 빌드, 완화 룰 대전/기록 및 변경된 메뉴·리플레이 Chromium 검사, Python/Node 리더보드 규칙 검사를 수행했다. 버전값 자체는 테스트하지 않았다.

### 메인 메뉴 부유 뿌요 클릭 반응 (2026-09-25, BUILDNO 117)

- 메인 메뉴의 버튼 판정이 끝난 뒤 빈 영역을 클릭하면 `bounceMainMenuGalleryFloater()`가 클릭된 맨 위 뿌요 하나에 밀어내는 속도를 준다. 같은 캔버스 논리 좌표와 기존 반지름으로 판정하며, 화면 경계 반사는 유지한다.
- 클릭 속도에는 상한을 두고 `updateMainMenuGalleryFloaters()`에서 평소 속도로 서서히 되돌린다. BUILDNO와 패키지 버전은 117 (`0.1.117`)이다. JS 문법 검사·ESLint·webpack 빌드와 메인 메뉴 버튼 클릭 Chromium 검사 2개를 통과했고, 버전값 자체는 테스트하지 않았다.

### 게임 시작 메뉴의 트레이닝 명칭 (2026-09-25, BUILDNO 118)

- 첫 단계 선택지 `스스로 연습`을 `트레이닝`으로 변경했다. 영어 표시는 `Training`이며 일본어·중국어·독일어·프랑스어 번역도 새 문구 키에 맞췄다. 하위 선택과 내부 연습 모드 식별자는 유지한다.
- `src/js/puyow.js` BUILDNO와 `package.json`·`package-lock.json` 버전은 118 (`0.1.118`)이다. 버전값 자체는 테스트하지 않았다.

### 도장깨기 피버 룰 선택지 순서 (2026-09-26, BUILDNO 120)

- 도장깨기 규칙 선택 화면의 두 번째 행을 왼쪽부터 `피버 룰 (시작)`, `피버 룰`, `피버 룰 (완화)` 순으로 배치했다. 조건 없는 `피버 룰`이 가운데에 온다.
- 버튼 그리기와 마우스 클릭 판정이 같은 인덱스 기반 영역 계산을 사용하므로 클릭 좌표도 새 순서에 맞춰진다. 방향키의 좌우 이동은 실제 배열 순서를 따르며, 아래쪽 행의 가운데는 인덱스 2이므로 중앙의 일반 피버 룰에 포커스된다. 룰별 잠금과 선택 동작은 유지한다.
- `src/js/puyow.js` BUILDNO와 `package.json`·`package-lock.json` 버전은 120 (`0.2.120`)이다. 버전값 검사는 수행하지 않았다.

작업 후 puyow.js 의 BUILDNO 를 1 증가시켜주고, package.json 의 version 의 패치 번호에 BUILDNO 값을 넣어줘.
작업으로 인해 이 INFO_FOR_AI.md 내용 중 더 이상 맞지 않는 내용이 있다면 수정해 줘.
주석 및 채팅창 답변은 모두 한국어로 해줘.
