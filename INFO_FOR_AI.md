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
- 스타일: `src/css/puyow.css`
- 선택적 라이브러리: `src/js/three.min.js`, `src/js/json5.min.js`
- 이미지: `src/img/`
- 언어별 공지사항: `src/notice/`
- Webpack 번들 출력: `src/bundle/puyow.bundle.js`
- E2E 회귀 테스트: `tests/test01.spec.js`
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
- ATTACK은 현재 마진 레이트로 점수를 나눈 뒤 `EXPLOSION_REWARD_MULTIPLIER`와 시간 진행 배율을 곱한 값이다. 시간 진행 배율은 300초까지 1이고 320초부터 20초마다 두 배가 되어 최대 1024다. `game.timeProgressMultiplier`와 `getTimeProgressMultiplier(elapsed)`를 함께 갱신·검증한다.
- 기본 룰·연습·퍼즐뿌요·시뮬레이터·플레이 방법의 싹쓸이는 기존 점수 `+100`과 예약 `ATTACK 12`를 만들지 않는다. 대신 플레이어별 싹쓸이 티켓을 하나 부여하고, 보유 중 필드 배경을 황금색으로 유지한다. 다음 **색 뿌요 폭발**에서 티켓을 즉시 소진해 점수 `+2100`, ATTACK `+30`을 직접 더한다. 이 보너스는 마진 레이트 70으로 환산한 고정값이므로 게임 시간·현재 마진 레이트를 다시 적용하지 않는다. 이후 ATTACK/DAMAGE 상쇄와 상대 DAMAGE 전달은 기존 순서·에너지 정산 경로를 사용한다.
- 싹쓸이 자체는 더 이상 상대 예고뿌요·방해뿌요를 만들지 않는다. 다만 같은 연쇄에서 생긴 일반 ATTACK은 에너지 이동, 상쇄, 상대 DAMAGE 및 필요한 방해뿌요 낙하까지 정산해야 한다. 플레이 방법 4단계는 보라색 쌍으로 첫 싹쓸이·티켓을 보여 준 뒤, 빨강색 쌍 두 개를 회전·이동 없이 차례로 내려 티켓 보너스 공격과 재싹쓸이를 시연한다. 이때 예고뿌요와 방해뿌요 낙하가 끝난 뒤 5단계로 넘어간다. 시뮬레이터는 재생 결과가 빈 보드면 티켓이 부여된 상태로 완료한다.
- 피버 룰·피버 룰 (시작)·연속 피버의 싹쓸이는 티켓을 사용하지 않으며, 기존의 점수 `+100`·황금 연출·목표 연쇄/시간 보너스 규칙을 유지한다.
- 연쇄 중에는 에너지/ATTACK 전달과 DAMAGE 상쇄 순서가 중요하다. `resolveExplosions()`와 전송·정산 함수의 대기 조건을 우회하지 말고, 연쇄 완료 뒤 상대 DAMAGE로 넘어가는 계약을 보존한다.

## 게임 모드

| 모드 | 핵심 계약 |
| --- | --- |
| 기본 룰 | 사람 대 CPU의 일반 필드 대전. 승리는 난이도별 기본 룰 진행도에 저장된다. |
| 피버 룰 | 각 플레이어가 일반 필드와 피버 필드를 가진다. 피버 게이지/시간/목표 연쇄는 플레이어별 상태다. 승리는 별도 피버 진행도에 저장된다. |
| 피버 룰 (시작) | 기본은 잠금 상태이며, 어떤 난이도에서든 피버 룰로 키마리스를 이기면 해금된다. 해금 후 피버 룰과 같은 적 선택·필드 규칙을 사용하되 승리는 별도 피버 시작 진행도에 저장한다. 카운트다운 뒤 양쪽이 목표 5연쇄·60초의 피버 스테이지에서 즉시 시작한다. |
| 연습 | 단독 플레이 배치. 오른쪽은 연습 상대이며 일반 뿌요를 받지 않는다. |
| 연속 피버 | 단독 플레이 피버 스테이지. 목표 5연쇄·60초로 시작하며 두 패배 칸을 쓴다. |
| 퍼즐뿌요 | 항상 5색, `PuzzlePuyoStage` 기반 단독 스테이지다. 오른쪽 영역은 적 필드가 아니라 목표/턴 상태 표시다. |
| 구경 | 선택 가능한 두 CPU가 자동 대전한다. 플레이 조작은 막고 ESC 일시정지만 허용한다. 결과 뒤 5초면 다음 대전을 자동 시작한다. |

### 피버와 연속 피버

- 피버 패턴은 `FeverStageState`, 등록 목록은 `FEVER_STAGES`다. 패턴의 일반 색은 선택한 색상 수와 호환되어야 하며, 지급 쌍의 같은색/다른색 형태도 현재 NEXT와 맞춘다.
- 피버 전용 필드와 연속 피버 필드의 **고정된 보드 뿌요** 중력은 일반보다 1.5배 빠르다. 컨트롤 단계에서 새로 지급된 뿌요 쌍의 자연 낙하에는 이 배율을 적용하지 않으며, 자연 낙하 속도는 게임 경과 1분마다 0.2배씩 증가해 최대 16배(약 75분 경과)에 도달한다.
- 피버 룰에서 피버 패턴을 배치하기 직전의 플레이 영역이 비어 있었다면, 기본 제공 적의 그 패턴 첫 배치는 무작위 위치를 사용한다. 한 번 배치한 뒤 또는 패턴 전 필드가 비어 있지 않았다면 기존 AI 전략을 사용한다.
- 다음 목표 연쇄는 완료 연쇄 `+ 1`, 싹쓸이면 추가 `+ 2`, 최소 4·최대 12를 적용한다. 현재 구현은 직전 목표보다 한 번을 초과해 급격히 낮아지지 않도록 추가 제한도 둔다. 정확한 변경은 `calculateContinuousFeverTarget()`을 기준으로 한다.
- 연속 피버는 시간 만료 후에도 진행 중인 연쇄·효과·전송 정산을 끝낸 뒤 종료한다. 만료 뒤 보너스로 시간이 되살아나지 않는다.

### 퍼즐뿌요

- `PUZZLE_STAGES`의 순서와 `PuzzlePuyoStage` 데이터가 콘텐츠의 기준이다. 새 스테이지는 `registerPuzzleStage()`로도 등록할 수 있다.
- 승리 조건: `combo`, `clear`, `multiple`, `color`, `attack`.
  - `clear`는 한 번이라도 싹쓸이가 발생하면, 후속 정산 뒤에도 승리로 유지되어야 한다.
  - `multiple`/`color`는 한 폭발 단계의 최대 동시 폭발 수/색 수다.
  - `attack`은 해당 턴의 공격과 상대에게 적용된 피해(예고량)의 합을 사용한다.
- 클리어 스테이지와 별 획득 스테이지는 `puyow_store`에 별도 저장한다. 권장 턴 수 이내 클리어하면 별을 얻는다.
- 퍼즐 최초 클리어와 최초 별 획득 보상은 각각 1,000 GOLD이며 `puzzleGoldClearStages`, `puzzleGoldStarStages`로 진행도와 별개로 기록한다. 이 보상 필드가 없는 기존 저장은 기존 클리어·별 기록을 지급 완료로 이관해 소급 지급하지 않는다.
- 스테이지 선택은 첫 두 개를 기본으로 열고, 클리어 진행도에 따라 뒤쪽 두 개까지 연다. 취소 카드·조건·힌트·키보드·마우스 동작을 함께 유지한다.

### GOLD와 카드

- GOLD는 `puyow_store.gold`의 0 이상 정수이며 잘못된 값은 로드 시 0으로 보정한다. 메인 메뉴와 갤러리 좌측 상단에는 번역하지 않는 `GOLD` 단위와 천 단위 콤마로 표시한다.
- 기본/피버/피버 룰 (시작) 대전 승리와 연습/연속 피버 정상 결과 진입 때 종료 점수를 바탕으로 GOLD를 한 번 지급한다. 점수 패널티는 기본 300, 피버 1,000, 피버 룰 (시작)·연습 10,000, 연속 피버 100,000이다. 난이도 배율은 쉬움 3, 보통 4, 어려움 5, 극한 7이고 단독 모드는 1이다. 기본 적 배율은 안드로말리우스부터 안드레알푸스까지 1~8, 솔로몬·외부 적·단독 모드는 1이다. 구경, 퍼즐의 일반 종료 계산, 일시정지 종료에는 지급하지 않는다.
- 보유 카드는 `puyow_cards`의 개별 `{id,type}` 인스턴스 배열이다. 고정 23종과 TODO에 명시된 가중치를 사용하고, 가중치 경계에 따른 EPIC/RARE/UNCOMMON/COMMON 배경색만 그리며 등급 문구는 카드에 표시하지 않는다.
- 갤러리의 카드 유형은 8열·약 4행 카드 목록, 세로 스크롤, 키보드·마우스 포커스/선택을 지원한다. 1장/10장 뽑기는 각각 1,000/9,000 GOLD, 합성은 카드 5장당 새 카드 1장을 지급한다. 자원이 충분하면 먼저 전체 화면 확인창을 열고 사용자가 확인했을 때만 GOLD 차감 또는 선택 카드 소비와 결과 지급을 수행한다.

### 구경 모드와 진행도

- 구경 메뉴는 기본 룰 또는 피버 룰에서 데카라비아를 `normal`, `hard`, `extreme` 중 하나로 이겼을 때만 열린다. 쉬움과 난이도 없는 기존 `clearList` 기록은 해금 근거가 아니다.
- 구경 CPU 후보는 두 규칙에서 보통 이상으로 이긴 출시된 적이다. `Solomon`, `Andromalius`, `Dantalion`은 항상 제외하며, 서로 다른 두 적을 뽑아야 한다.
- ONNX 추론으로 판단하는 적(`requiresOnnx`)은 구경 대전에 **아예 나오지 않는다**. `getWatchOpponentCandidates()`가 ONNX 런타임 사용 가능 여부와 무관하게 이들을 후보에서 모두 빼므로, `selectWatchOpponents()`는 종류가 다른 두 적만 고르면 된다. 적 선택 화면과 갤러리는 이 제한을 받지 않는다(그쪽 규칙은 「브라우저 ONNX 추론 적」 절을 따른다). 구경 대전에는 적 선택 화면이 없어 모델 로딩 실패를 안내할 곳이 마땅치 않다는 점도 이 규칙의 이유다.
- `puyow_code`에 `observation`이 있으면 저장 진행도는 바꾸지 않고 적 선택 화면의 진행도 잠금만 해제한다. `hidden` 및 출시 예정(`notAvail`) 적은 기존처럼 잠긴 채로 유지한다. 같은 코드가 있으면 구경 메뉴도 즉시 열리며, 구경 후보는 숨김·출시 예정 적과 `requiresOnnx` 적, `Solomon`, `Andromalius`, `Dantalion`을 제외한 모든 출시 적이다.
- 구경 대전은 적 잠금 해제와 갤러리 잠금 해제를 진행시키지 않는다.
- 일반 대전 승리 기록은 `clearListByDifficulty`(기본), `feverClearListByDifficulty`(피버), `feverStartClearListByDifficulty`(피버 룰 (시작))에 난이도별로 저장된다. `clearList`는 이전 기본 룰 호환용 전체 목록이므로 신규 난이도 판단 근거로 사용하지 않는다.

## UI·입력·결과 화면

- 초기 화면은 `initial_title`이며 Enter, Gamepad A 또는 캔버스 클릭으로 메인 메뉴에 들어간다.
- 메인 메뉴 좌측 공지사항은 논리 X=42에서 시작하고 폭 350px로 줄바꿈해 표시한다. 공지사항은 `notice_[LANG].txt`에서 읽으며, 표시 영역을 변경할 때 줄바꿈 폭과 클리핑 폭을 함께 수정한다.
- 플레이 중 회전 Z/X는 `event.key`뿐 아니라 물리 키 코드 `KeyZ`/`KeyX`도 받아 macOS 한글 입력기·다른 키보드 레이아웃에서 동작해야 한다. 텍스트 입력 중에는 물리 키 코드로 문자 입력을 바꾸지 않는다.
- 게임 시작 규칙 선택은 첫 줄의 기본 룰·피버 룰·피버 룰 (시작)과 그 아래 연습·연속 피버·퍼즐뿌요, 취소로 구성된다. 물리 배치에 맞춘 방향키 이동을 유지한다. 연속 피버에서 아래는 하단 취소다.
- 연습·연속 피버의 색 수 화면과 퍼즐 스테이지 선택에도 취소가 있다. ESC와 외부 클릭의 기존 의미를 바꾸지 않는다.
- 단독 모드 결과의 오른쪽 영역에는 일반 적 결과를 출력하지 않는다. 퍼즐은 전용 스테이지 상태를, 연습·연속 피버는 빈 적 영역을 사용한다.
- 결과 화면 이후의 복귀 대상은 모드별로 다르다(단독 모드는 메인, 퍼즐은 스테이지 선택, 대전은 적 선택, 리플레이 재생은 메인). 변경 시 `closeResultScreen()`과 관련 메뉴 포커스를 함께 확인한다.
- 결과 화면 버튼은 `getResultScreenButtons()`가 만든다. 0번은 항상 `종료`이며 논리 좌표 (515, 165, 250, 64)에 둔다. 두 번째 버튼은 그 아래 12px 간격으로 놓이고, 리플레이 재생 결과에는 `다시보기`, 리플레이를 기록한 대전 결과에는 `리플레이 복사`가 붙는다. 기본 포커스(`resultScreenFocus`)는 항상 0번이므로 Enter만 누르면 기존처럼 이전 화면으로 돌아간다. 방향키로 포커스를 옮기고 Enter·Space·마우스로 실행하며, 버튼이 하나뿐일 때는 기존 모습을 지키기 위해 포커스 테두리를 그리지 않는다. 구경 결과의 `다음 대전까지 %1초` 안내는 버튼이 두 개면 논리 Y=470으로 내려 겹침을 피한다.
- 메인 메뉴 좌측 하단 GitHub 버튼 바로 위 (32, 634, 85, 23)에 `리플레이 재생` 버튼이 있다. 포커스 순번은 8이며 이동 순서는 `TITLE_MENU_FOCUS_ORDER`가 정한다(목록 0~5 → 리플레이 8 → GitHub 6 → 음소거 7).
- 가상 컨트롤러는 표시 레이아웃과 히트 테스트에 같은 레이아웃 함수를 사용해야 한다. 크기 옵션/대형 배치 변경은 둘을 함께 수정한다.
- 시뮬레이터 그리기 모드의 우측 버튼은 재생·JSON복사·JSON넣기·초기화·종료 순서다. 초기화는 좌측 플레이 영역의 모든 배치를 제거하며, 버튼 라벨은 `translate('초기화')`를 사용한다.
- 공개 `setGameElapsed(elapsed)`는 진행 중인 게임의 경과 시간을 지정한 값으로 옮기고 마진 레이트·시간 진행 배율을 다시 계산한다. 조작 뿌요의 자연 낙하 속도(`getPlayerFallSpeedMultiplier()`, 75분 경과 시 최대 16배)도 경과 시간에서 파생되므로, 긴 대전의 후반 상황을 실제로 기다리지 않고 재현할 때 사용한다. 진행 중인 게임이 없거나 0 미만·유한하지 않은 값이면 예외를 던진다.
- 솔로몬이 AI API 요청을 취소할 때는 `abort(reason)`으로 사유(`contact`·`replaced`·`timeout`)를 신호에 함께 싣는다. 요청을 받은 쪽은 `signal.reason`으로 착지·턴 교체·타임아웃을 구분할 수 있으며, 회귀 테스트가 어느 경로로 취소됐는지 확인하는 근거다.
- 공개 `askConfirm(message)`는 메시지를 그대로 표시하고 번역된 확인·취소 버튼으로 `Promise<boolean>`을 완료한다. 키보드·게임패드·마우스를 지원하며, 게임 중 호출 시 자동 일시정지하고 원래 실행 중이었던 게임만 응답 뒤 재개한다. 동시 요청은 순서대로 표시한다. 카드 뽑기·합성 확인도 이 공용 함수를 사용한다.

### 게임 테마 (적별 배경색)

- 게임 화면의 배경은 `Enemy.getFieldThemeColors()`가 돌려주는 `{bezel, field, center}` 한 벌로 결정한다. `drawBezelBackground()`·`drawPlayerBackground()`·`drawCenterBackground()`의 기본 구현이 각각 이 값을 쓰므로, 단색 테마만 바꿀 때는 `getFieldThemeColors()` 하나만 재정의한다. 세 그리기 메서드를 직접 재정의하는 기존 외부 확장도 그대로 동작한다.
- 기본값은 `DEFAULT_FIELD_THEME_COLORS`(`#0c2433` / `#112f40` / `#071621`)이며 현행 청록 테마다. 솔로몬과 `PracticeEnemy`(연습·연속 피버·퍼즐뿌요·플레이 방법이 쓰는 내부 상대)는 재정의하지 않아 이 기본 테마를 사용한다. 테마를 재정의하지 않은 외부 적도 같다.
- 안드로말리우스(초록)·단탈리온(보라)·세레(청)·데카라비아(자홍)·벨리알(자두)·암두시아스(남색)·키마리스(무채)·안드레알푸스(청록)·플라우로스(주황)는 각자 초상화 색과 어울리는 테마를 가진다. 새 색을 정할 때는 `field`가 `bezel`보다 밝고, `center`가 가장 어두우며, 뿌요 색(`#ef5350`·`#66bb6a`·`#f7c843`·`#42a5f5`·`#ab73e8`)이 필드 위에서 충분히 구분되는지 함께 확인한다.
- 화면 전체 여백은 `getGameScreenBackgroundColor()`가 반환하는 테마의 `center` 색으로 채운다. 베젤 바깥과 중앙 영역의 색이 갈라지지 않게 하기 위한 것이므로, 중앙 영역 색을 바꿀 때 이 함수도 함께 본다. 플레이·결과·플레이 방법 화면이 이 색을 쓰고, 메뉴·설정·시뮬레이터·갤러리는 기존 고정 색을 유지한다.
- 필드 테마 컨트롤러는 `getFieldThemeController()`가 항상 `game.themeController` 하나만 돌려준다. 구경 대전의 `game.themeController`는 우측 CPU이므로 양쪽 필드가 모두 우측 적의 테마를 쓴다. 필드마다 각자 CPU의 테마를 쓰던 이전 동작으로 되돌리지 않는다.
- 피버 전용 플레이 영역과 연속 피버는 여전히 적 테마보다 `FEVER_PLAYER_BACKGROUND_COLOR`·`FEVER_BEZEL_BACKGROUND_COLOR`가 우선한다(`usesFeverFieldTheme()`). 피버 배경색은 적과 무관하게 항상 같다.

### 리플레이

- 설정의 `리플레이 사용`이 켜져 있을 때만 기록한다. 대상은 기본 룰·피버 룰·피버 룰 (시작) 대전과 구경 모드의 모든 규칙이며, 연습·연속 피버·퍼즐뿌요·플레이 방법·시뮬레이터는 기록하지 않는다. 기록기는 `game.replay`에 두므로 결과 화면까지 남고 `closeResultScreen()`에서 게임과 함께 사라진다.
- 기록은 `beginReplayRecording()`으로 시작하고, `frame()`이 카운트다운이 끝난 실행 중·비일시정지 프레임에서만 `recordReplayFrame(delta)`를 호출한다. 승패가 확정되는 `updateDefeatSequence()`에서 `finishReplayRecording()`이 마지막 프레임·뿌요 지급 덱·승자를 담아 기록을 닫는다.
- 프레임은 `REPLAY_SAMPLE_INTERVAL`(초당 30장) 간격의 표본이며, 직전 표본과 달라진 항목만 담는 델타 프레임이다. 보드와 뿌요 쌍은 칸·색마다 한 글자인 문자열로 접고, 폭발·중력·연쇄 표시·싹쓸이 효과·패배 연출은 매 프레임 변하는 경과 시간 대신 시작(또는 종료) 시각만 저장한다. 재생 쪽 `refreshReplayAnimationTimers()`가 현재 재생 시각으로 경과 시간을 다시 계산하므로 30fps 표본으로도 연출이 부드럽다. 실측 평균은 프레임당 약 40~80바이트다.
- 데이터는 `{version, build, meta, deck, inputs, sounds, result, frames}` 구조다. `meta`는 규칙·구경 여부·색상 목록·양측 이름과 적 클래스 타입을, `deck`은 전체 뿌요 지급 덱과 양측 소비 위치를, `inputs`는 `[시각, 플레이어, 조작종류, 값]` 형태의 시간대별 컨트롤 조작을 담는다. 조작 종류는 `REPLAY_INPUT`(이동·회전·빠른 하강·고정)이다. `REPLAY_FORMAT_VERSION`이 다르면 재생을 거부하므로 구조를 바꿀 때 함께 올린다. 현재 버전은 2다.
- 효과음은 `sounds`에 `[시각, 출처, 사운드 풀 속성 이름]` 형태로 담는다. 출처는 공통 풀 `'c'`, 왼쪽·오른쪽 적 풀 `0`·`1`, 어느 풀에도 없는 짧은 URL을 그대로 담는 `'u'`다. 데이터 URL이나 `REPLAY_SOUND_URL_MAX_LENGTH`(200자)를 넘는 URL은 기록하지 않는다. 대량 방해뿌요 착지음처럼 중복 재생을 막는 항목은 네 번째 값 `1`을 붙여 재생 쪽에서도 같은 경로를 쓴다.
- 기록 지점은 `playSound()`와 `playGarbageFallLotSound()` 안의 `recordReplaySound()` 한 곳이다. 현재 음량이나 Audio 지원 여부와 무관하게 남기므로 음소거 상태에서 기록한 리플레이도 소리가 난다. 새 게임 효과음을 추가할 때 이 두 함수를 거치면 별도 작업 없이 리플레이에 포함된다. 재생은 `playReplaySounds()`가 현재 재생 시각까지의 항목을 순서대로 내보내며, 참조를 되살리지 못한 항목은 조용히 건너뛴다.
- 배경음악은 별도로 기록하지 않는다. `syncBackgroundMusic()`이 재생용 `game.themeController`와 복원된 피버 활성 상태를 그대로 읽어 원래 대전과 같은 곡을 고른다. 카운트다운이 끝나는 순간에는 `startGameStartFirework()`로 시작 연출도 같이 보여 준다.
- 재생은 `startReplayPlayback()`이 실제 `PlayerState`와 `game` 객체를 만든 뒤 프레임 값을 되돌려 넣는 방식이라 평소 렌더링 경로를 그대로 쓴다. `game.replayPlayback`이 있으면 `frame()`은 일반 진행·에너지 이동·구경 자동 재시작을 실행하지 않고, 갤러리 예고뿌요 해금과 가상 컨트롤러도 막는다. 3초 카운트다운 뒤 재현하며, 프레임 해석 오류는 안내 문구를 띄우고 2초 뒤 결과 화면으로 넘어간다. 재현 중 ESC는 즉시 결과 화면으로 간다.
- 공격 에너지는 기록 시점에 표시 좌표와 투명도만 남기고, 재생에서는 같은 그림이 나오도록 소멸 연출 형태의 표시 전용 에너지로 되돌린다. 구경 리플레이만 `game.watch` 속성을 만들어 `getGameState()`가 모드를 올바르게 보고하게 한다.
- 공개 `getReplayData()`는 현재 기록 중이거나 기록을 마친 리플레이를 JSON 직렬화 가능한 객체로 반환하며, 기록 대상이 아니면 null이다.

## 저장소·다국어·외부 확장

- 진행도·설정·GOLD는 `localStorage`의 `puyow_store`, 카드 인스턴스 배열은 `puyow_cards`, 갤러리 잠금은 `puyow_gallery`, 테스트 기능 코드 배열은 `puyow_code`에 저장된다. 초기화 시 `puyow_code`를 JSON 배열로 복원하며, 파싱 실패는 오류를 기록한 뒤 빈 배열로 계속한다. 읽을 때 이전 형식을 보정하므로 새 필드는 기본값·마이그레이션을 함께 설계한다. 설정의 `useReplayFeature`는 리플레이 기능 사용 여부를, `reverseLearning`은 역방향 모델 학습 사용 여부를 저장하는 boolean이며, 기존 저장에 값이 없으면 둘 다 `false`로 보정한다.
- 설정 화면의 `화면 가로방향 고정`·`리플레이 사용`·`역으로 모델 학습` 체크박스는 마우스 클릭 또는 Enter·Space·Z(해당 게임패드 확인 입력 포함)로만 토글한다. 체크박스에 포커스가 있을 때 좌우 방향키는 세 체크박스 사이의 포커스 이동에 쓰며, 양 끝에서는 더 이동하지 않는다. 위치·포커스 순번·저장 키는 `getSettingsCheckboxes()` 한 곳에서 정의하고 그리기·키보드 토글·마우스 판정이 모두 이 목록을 사용하므로, 체크박스를 더할 때는 이 함수와 `SETTINGS_UI_LAYOUT`의 가로 좌표만 추가하면 된다.
- 설정 화면 포커스 순번은 0~9 설정 행, 10 AI API 테스트, 11~13 체크박스, 14 저장, 15 취소, 16 초기화다. `getSelectableSettingsFocuses()`가 AI 입력 세 행 7·8·9를 LM Studio에서만 넣고 10도 API 테스트 실행 가능 여부에 따라 빼므로, 키보드 이동 횟수를 검증하는 테스트는 이 목록을 기준으로 계산한다.
- `registerLanguage()`, `registerOpponent()`, `registerWarningPuyo()`, `registerFeverStageState()`, `registerPuzzleStage()`가 주요 확장 지점이다. 입력 검증과 중복 처리 방식은 기존 등록 함수에 맞춘다.
- 적은 `Enemy` 또는 `BundledEnemy` 계열이다. `getClassType()`의 안정성은 저장 진행도·사운드 연결에 중요하므로 기존 클래스 타입을 바꾸지 않는다.
- 적의 위치·회전 결정은 게임 루프 밖의 별도 보정 함수가 아니라 `prepareTurn()`, `chooseTarget()`, `chooseRotate()` 안에서 끝낸다. 기본 `Enemy.prepareTurn()`은 피버 연쇄 최적화와 패배 위치 회피 후보를 `preparedPlacement`로 준비하고, 기본 제공 적은 `BundledEnemy`에서 연쇄 대응·즉시 패배 보호를 추가한다. 외부 적이 이 공통 규칙을 유지하려면 세 메서드에서 `super` 구현을 호출하고, 완전히 독자적인 AI라면 세 메서드를 재정의하면 된다.
- `Kimaris`는 `PuyoW.Kimaris`로도 공개된다. 피버 중에는 `preparedPlacement`의 공통 연쇄 최적화를 그대로 쓰며, 평상시에는 `simulateNMovePlacements(player, targetCombo, turnCount)`로 현재 수부터 N수까지 평가한다. 기본 목표는 6연쇄·2수이며, 목표에 못 미치는 작은 즉시 공격보다 6연쇄 기반을, 싹쓸이 기회는 그보다 더 높게 평가한다. 즉시 패배 후보는 제외하고, 화면 예고와 아직 전송 중인 ATTACK을 함께 읽은 상쇄 뒤 남는 방해뿌요가 4개 이상일 때만 긴급 상쇄를 장기 연쇄보다 우선한다.
- Worker 탐색 상태(`attackPlacement`, `pendingWorkerSearch`, `workerSearchPlayer`, `workerSearchActive`, `workerSearchDepth`, `workerSearchState`)는 최상위 `Enemy`에 있다. 외부 적은 `BundledEnemy`가 아니라 `PuyoW.Enemy`를 상속하고, `PuyoW.beginWorkerSearchTurn(enemy)`, `startWorkerLookaheadSearch(enemy, player)`, `getWorkerSearchTarget(enemy, player)`, `getWorkerSearchRotation(enemy, player)`, `isWorkerSearchPending(enemy, player)` 공용 함수로 수명주기·선택·대기 처리를 연결한다. 착지 시 엔진은 `cancelPendingWorkerSearch(enemy, player, 'contact')`로 해당 요청만 취소한다. 완료된 탐색 Worker는 최대 2개까지 전역 풀에 보관해 다음 턴 또는 구경 모드의 다른 Worker 적이 재사용한다. 취소·오류·시간 초과 중인 Worker는 즉시 종료하고 풀에 넣지 않는다.
- `Andrealphus`는 `PuyoW.Andrealphus`로도 공개된 `BundledEnemy` 하위의 출시된 8번째 적이다. 키마리스와 독립된 동일 판단 흐름(일반·위기 빠른 하강 지연 비율, 화면 예고 위협량 반영 포함)을 사용하되 평상시 목표는 7연쇄·3수 Worker 반복 심화 탐색이다. `lookaheadTimeLimitMs` 기본값은 50ms이며 인스턴스별로 조정할 수 있다. Worker는 1수·2수·3수 완료 때마다 현재 1수의 X·회전을 갱신하고, 시간 초과·오류로 1수 결과가 없으면 기존 동기 1수 탐색으로 대체한다. 피버·패배 위치 보호 후보가 있으면 Worker를 시작하지 않고 기존 `Enemy.prepareTurn()` 경로를 그대로 우선한다. 이 조정 때문에 키마리스의 목표 6연쇄·2수 계약을 바꾸지 않는다.
- `Seere`의 피버 비활성 일반 쌓기만 오른쪽 두 열 전체 → X=3의 화면 절반(6칸) → X=0 전체 → X=1 전체 순서다. 피버 비활성 피버 룰의 별도 빌드, 피버 중 공통 연쇄 최적화, 패배 위치 보호, 빈 필드 무작위 착수는 이 규칙보다 우선한다. 일반 착수는 오른쪽 하단 세 칸의 점유 여부와 관계없이 `turnCount`에 포함한다. 공격 시뮬레이션 차례가 되면 우측 하단 세 칸이 덜 차 있어도 최적 공격 위치를 우선하며, 그 외에만 해당 세 칸이 찰 때까지 비폭발 착수를 사용한다. 공격 최적 시뮬레이션 뒤 다음 호출 간격은 매번 20~25회로 무작위 선정한다.
- `Flauros`는 9번째 출시 적이며, 처음으로 `OnnxEnemy`를 상속받아 브라우저에서 ONNX 가치망(`onnx/model01.onnx`)을 추론해 판단한다. 자세한 계약은 아래 「브라우저 ONNX 추론 적」 절을 보면 된다. 일반·위기·우는 표정의 표범 초상화와 다국어 이름도 등록되어 있다.
- `WarningPuyo` 확장은 양의 정수 `unitCount`, 비어 있지 않은 `type`, `draw(context, x, y, cellSize)`를 갖춰야 한다.
- 사운드는 `SoundPool`/`CommonSoundPool`/`EnemySoundPool`과 `setEnemySoundPool()`을 사용한다. 배경음은 중복 재생하지 않고 일시정지·음소거·볼륨 상태와 동기화해야 한다. 설정 화면의 배경음악·효과음 슬라이더 값은 축소된 슬라이더 오른쪽(논리 X=920)에 표시한다.
- 설정 화면 오른쪽 아래의 작은 `코드` 버튼은 키보드 포커스 순서에 포함하지 않고 마우스 클릭만 받는다. 클릭하면 `prompt('코드를 입력하세요')`를 호출하며, 취소·공란은 무시하고 값이 있으면 `trim()` 후 `addCode()`에 전달한다. `addCode()`에 `sound:` 접두사가 붙은 값을 직접 전달하면 접두사 뒤 문자열을 최대 200자로 잘라 사운드 데이터 URL로 읽어 `loadSoundDataURL(url, true)` 경로로 로드하고 `puyow_store.settings.soundDataURL`에 저장한다. 설정 화면이 열려 있으면 임시 설정값 `settingsDraft.soundDataURL`도 함께 갱신해 입력 컴포넌트에 즉시 표시한다. 이 예외 코드는 `puyow_code` 목록에는 추가하지 않는다.
- 설정 화면의 AI 제공자는 번역하지 않는 브랜드명 `LM Studio`와 (초기화 때 게임 서버의 `/apis/localmodelinfo`가 `{"available":true}`를 응답할 때만) `Local AI` 라디오 선택지다. 선택지 순서는 항상 LM Studio → Local AI다. **아무것도 선택하지 않은 상태(`aiProvider`가 빈 문자열, 상수 `NO_AI_PROVIDER`)가 정상 상태의 하나다.** 사용자가 스스로 선택을 푸는 방법은 없고, 고른 제공자를 더 이상 쓸 수 없게 됐을 때만 이 상태로 돌아온다. 라디오 행에 포커스가 있는데 선택된 항목이 없으면 표시할 포커스 테두리가 없으므로 모든 선택지에 테두리를 그린다.
- AI 제공자의 기본값은 Local AI 사용 가능 여부에 따라 달라진다. `createDefaultAiSettings()`가 Local AI를 쓸 수 있으면 Local AI와 그 고정값을, 쓸 수 없으면 미선택 상태를 돌려준다. 서버 확인이 비동기라서 `loadStore()` 시점에는 아직 알 수 없으므로, 확인이 끝난 뒤 `applyLocalAiAvailability()`가 저장값을 보정한다. 쓸 수 없는데 저장값이 `Local AI`이면 다른 제공자로 옮기지 않고 미선택으로 되돌리고, 반대로 쓸 수 있는데 미선택이면 Local AI 기본값을 채워 저장한다. `loadStore()`의 `normalizeAiProvider()`는 지원을 제거한 `OpenAI`·`Prompt API`를 포함해 현재 목록에 없는 값을 모두 미선택으로 되돌리되, 서버 확인 전이라 `Local AI`만 그대로 둔다.
- `aiApiURL`·`aiApiKey`·`aiModel` 세 행은 사용자가 직접 입력하는 LM Studio에서만 활성화·포커스되고, Local AI(고정값)와 미선택 상태에서는 셋 다 비활성화·포커스 제외한다. 미선택 상태에서는 `hasCompleteAiApiSettings()`가 `aiProvider`를 빈 값으로 보므로 AI API 테스트 버튼도 자동으로 비활성이 되고, 테스트를 통과할 방법이 없으니 적 `솔로몬`도 나타나지 않는다. Local AI를 고르는 순간 `setSettingsDraftProvider()`가 `applyLocalAiProviderSettings()`로 URL에 현재 페이지 origin(예: `http://localhost:9891`), 키에 `localhost`, 모델명에 `puyow`를 채우고, 다른 제공자로 되돌아갈 때는 값을 그대로 둔 채 활성/비활성 상태만 그 제공자의 규칙을 따른다. Local AI로 설정을 저장하면 AI API 테스트를 통과한 것으로 간주해 `unlockSolomonForSession()`을 호출하며, 다음 접속에서도 서버가 계속 사용 가능하다고 응답하면 같은 이유로 솔로몬을 다시 열어 준다.
- AI API 테스트와 솔로몬은 같은 구조화 출력 요청 경로를 공유한다. 두 제공자 모두 사용자가 입력했거나 채워진 서버 기본 URL 아래의 `/v1/chat/completions`로 요청하고, 저장된 `aiApiKey`를 `$LM_API_TOKEN`에 해당하는 Bearer 토큰으로 보내며, `response_format.json_schema`와 `choices[0].message.content` 형식을 사용한다. Local AI는 `pythonserver.py`가 LM Studio API를 흉내내기 때문에 LM Studio와 완전히 같은 요청 경로를 쓴다. 설정 화면의 AI API 테스트가 응답을 받으면 브라우저 콘솔에 제공자·모델·성공 여부·스키마 검사 여부·원문 응답·파싱 결과를 `console.log`로 기록하며, 요청 오류도 성공 여부와 오류 내용을 함께 기록한다.

### 제거한 AI 제공자(OpenAI·Prompt API) 재도입 참고

BUILDNO 26에서 `OpenAI`와 `Prompt API` 제공자를 **임시로** 제거했다. 게임 규칙이나 솔로몬의 판단 로직이 문제가 아니라, 상용 LLM은 한 수를 고르는 데 너무 오래 걸려 실제로 플레이할 수 없었기 때문이다. 언젠가 다시 넣을 수 있으므로 지운 구현을 아래에 남긴다. 제거 직전 상태는 BUILDNO 25(커밋 `28ddfde`)의 `src/js/puyow.js`와 `tests/test01.spec.js`에 그대로 있으니, 되살릴 때는 이 문서로 범위를 먼저 파악한 뒤 그 커밋에서 실제 코드를 확인하는 편이 빠르다.

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

**함께 지운 회귀 테스트.** `tests/test01.spec.js`에서 아래 네 개를 지웠고, 나머지 AI 테스트는 OpenAI 대신 LM Studio 설정을 쓰도록 옮겼다. Prompt API 테스트는 `page.addInitScript()`로 `window.LanguageModel`을 가짜로 심어 `create`·`prompt`·`destroy` 호출을 기록하는 방식이었다.

- `설정의 AI 서비스 제공자는 OpenAI와 LM Studio를 라디오로 표시하고 기존 Google 값은 정규화한다`
- `Prompt API를 지원하지 않으면 선택지를 숨기고 저장된 Prompt API 설정을 LM Studio로 이관한다`
- `Prompt API는 API 테스트와 솔로몬 배치에서 JSON Schema 제약 prompt를 사용한다`
- `Prompt API 모델이 다운로드 중이면 초기화를 기다리지 않고 create를 호출한다`

`src/notice/notice_ko.txt`·`notice_en.txt`의 "OpenAI 등 상용 LLM은 느리다"는 안내 문구도 제공자 이름을 뺀 일반 문장으로 바꿨다.

## 공통 계산 함수

현재 개발·유지보수 범위는 2D 버전이다. 게임 규칙 계산을 재사용할 때는 `PuyoW.common`(또는 `PuyoW.getCommonFunctions()`)을 사용한다. 이 객체의 함수는 입력 보드를 직접 변경하지 않는 공통 계산 함수다. 대표적으로 착지/폭발/점수/공격/중력/싱글 보드 시뮬레이션 함수가 있으며, 한 쌍을 가상 배치한 결과는 `simulatePlacementResult(board, colors, positions)` 하나로 구한다. 이 함수는 연쇄가 끝난 보드와 연쇄 수, ATTACK을 `{board, combo, attack}`으로 한 번에 돌려주며 `simulatePlacementBoard()`·`estimateCombo()`·`estimateAttack()`과 `prepareAiPlacementSimulations()`가 모두 이 함수를 거친다. 세 값을 따로 구하던 예전 구현과 결과는 같으나, 같은 배치를 여러 번 시뮬레이션하지 않고 세 값이 서로 어긋날 일도 없다.  `getFeverStageDefinitions()`는 Python 학습 환경이 실제 `FEVER_STAGES`를 복제할 수 있도록 직렬화 가능한 사본을 반환한다.

N수 AI 탐색은 `PuyoW.common.simulateNMovePlacements(player, targetCombo, turnCount)`와 `findBestNMovePlacement(player, targetCombo, turnCount)`로 재사용한다. 목표 연쇄 수는 두 번째 매개변수이며, 반환값은 이번 수의 `simulation`과 이후 경로·점수를 함께 가진다. 기본 룰·피버 룰 대전(구경 포함)은 각 플레이어의 내부 `nextPairs`에 현재 수 뒤 20쌍을 미리 확정해 유지한다. `getGameState()`는 브라우저 기반 학습 환경 확장과 적 AI에 모드와 룰, 양측 현재·일반·피버 필드, 피버 시간, 싹쓸이 티켓, 앞 두 쌍의 NEXT를 공통으로 제공하는 읽기 전용 snapshot이다. 현재 Python `PuyoDuelEnvironment`는 이 API를 호출하지 않고 Python 보드를 직접 시뮬레이션한다. 중앙 화면과 `getNextPairs()`는 대전에서 앞 두 쌍을 보이며, 단독 모드의 `getNextPairs()`는 기존 호환성을 위해 네 쌍을 보인다. 동기 N수 탐색과 Worker snapshot은 20쌍 전체를 사용한다. 3수 이상 비동기 탐색은 `simulateNMovePlacementsInWorker(player, targetCombo, turnCount, timeLimitMs, options)`를 사용한다. 이 함수는 Blob Worker에 현재·상대 필드, 공격·피해, 피버 필드·상태, 예고뿌요, 룰 정보를 JSON snapshot으로 보내고, 깊이별 현재 1수 결과를 `onProgress`로 전달한다. 탐색량은 착지 후보 수에 따라 지수적으로 늘어나므로, 일반 실시간 적은 기존처럼 2수 수준을 사용한다.

공통 계산을 수정하면 2D 게임, CPU 미리보기, 시뮬레이터, 피버 패턴 검증에 미치는 영향을 확인한다. 독립 3D 게임 버전은 개발 대상에서 철회했다. 다만 2D 초기화는 같은 8자리 접미사의 2D·투명 3D canvas를 최상위 `div_puyow_root` 아래에 만들며, 후자는 Three.js가 있을 때만 선택적 연출에 사용한다. 실행용 동적 스타일은 남는 세로 공간에서도 두 canvas의 실제 표시 영역을 화면 상단에 맞추고, 세로 화면에서는 회전 후 보이는 좌측 경계도 화면 좌측에 맞춘다. 클릭 좌표는 계속 2D canvas의 실제 bounding rect를 기준으로 변환한다. 새 독립 3D API·게임·소비자 호환성을 전제로 작업하지 않는다.

## 테스트 작업 체크리스트

1. 최신 `TODO.md`와 해당 소스·기존 테스트를 읽는다.
2. 변경한 규칙의 정상 경로와 경계 조건(잠김, 취소, 패배, 정산, 저장)을 테스트에 추가하거나 갱신한다.
3. 캔버스 UI는 키보드, Enter, 마우스, ESC, 외부 클릭, 잠긴 항목을 함께 확인한다.
4. `node --check src/js/puyow.js`, `npm.cmd test`, 관련 Playwright 테스트를 실행한다.
5. 최종 보고에는 변경 파일, 실행한 검증, 실행하지 못한 검증의 이유를 간단히 적는다.

Playwright의 `webServer`는 `reuseExistingServer`라서 9891 포트에 이미 떠 있는 서버를 그대로 쓴다. `nodeserver.js`는 `/apis/localmodelinfo`에 항상 `{"available": false}`를 주지만 모델을 올린 `python/pythonserver.py`는 `true`를 주므로, 어느 서버로 띄웠는지에 따라 Local AI 사용 가능 여부가 달라진다. Local AI를 쓸 수 있으면 제공자 기본값이 Local AI가 되고 그 때문에 솔로몬이 세션에서 열려 적 목록과 설정 화면 포커스 순번까지 함께 바뀐다. 그래서 `test.beforeEach`의 `disableLocalAiModel()`이 이 응답을 `false`로 고정해 기준선을 일반 웹 서버와 같게 만든다. Local AI가 필요한 테스트는 `page.route()`를 자기 안에서 다시 걸어 이 기본값을 덮어쓴다(나중에 등록한 라우트가 이긴다). ONNX wasm CDN을 막는 `blockOnnxWasmCdn()`도 같은 구조다. 서버 응답에 따라 게임 동작이 갈리는 기능을 새로 만들면 이 두 함수처럼 기준선을 함께 고정한다.

## 머신러닝 작업 참고

머신러닝 관련 작업 시 학습 코드와 학습 API 구현을 함께 확인해야 한다. 학습 모델·환경·학습 실행 방법은 `python/learning.py`를, 관측값·행동·보상·에피소드 종료 이벤트를 전달하는 서버 API는 `python/pythonserver.py`를 참고한다. 승·패 보상(`WIN_REWARD`, `LOSS_REWARD`), 한 수의 즉시 보상 계약 `move_reward()`(= `ATTACK + 연쇄^2`), 감가율 `DISCOUNT_GAMMA`(0.70)와 스칼라 관측값의 정규화 기준(`ATTACK_SCALE` 등), 관측 벡터를 보드·쌍·상태로 되돌리는 `decode_observation_board()`·`decode_observation_pair()`·`decode_observation_scalars()`는 `python/common.py`에 있다. 오프라인 학습과 서버의 온라인 학습이 같은 보상 크기를 써야 하므로 `PuyoDuelEnvironment.WIN_REWARD`도 이 공통 상수를 그대로 참조한다. `pythonserver.py`와 `nodeserver.js`는 모두 `/apis/localmodelinfo`를 제공하며 `{ "available": boolean }`만 응답한다. `pythonserver.py`는 `SERVER_CONFIG['model_path']`가 실제 파일이고 `get_value_model()` 로드까지 성공할 때만 `true`이며, `/v1/chat/completions`를 구현하지 않은 `nodeserver.js`는 항상 `false`다. `python/bundledenemy.py`는 `src/js/puyow.js`의 기본 제공 적 AI를 Python으로 옮긴 모듈이다. 대전 가능한 적은 단탈리온·세레·데카라비아·벨리알·암두시아스·키마리스·안드레알푸스이며, 솔로몬·안드로말리우스와 ONNX 추론을 쓰는 플라우로스는 제외한다(ONNX 추론 적은 앞으로도 모두 학습 상대에서 제외한다). `PuyoDuelEnvironment`의 `--opponent random`은 self-play와 이 일곱 적 중 하나를 매 에피소드마다 고르고, `self`는 현재 학습 중인 정책을 상대에도 적용한다. `solo`를 제외한 대전에서는 기본/피버 룰 및 3~5색도 에피소드마다 무작위로 선택한다. 피버 룰은 일반/피버 필드, 게이지, 제한 시간, 목표 연쇄 및 JS의 실제 피버 패턴을 사용한다. 브라우저 관측은 `game.elapsed`의 실제 시간을 쓰고, 벽시계와 무관하게 고속 실행되는 오프라인 학습은 양측 한 턴을 3초로 진행한다. `src/js/puyow.js`의 적 AI 판단 로직이나 피버 패턴을 바꾸면 `bundledenemy.py`와 학습 회귀 테스트를 함께 확인한다. 숨김 행 없는 12행 보드, 딱딱뿌요 제외, 안드레알푸스의 동기 시간 제한 탐색 등 의도적인 제한은 `bundledenemy.py` 모듈 docstring에 정리되어 있다.

모델 버전 3의 관측값은 528개다. 빈 칸·방해뿌요·5색 보드 채널 504개, 현재 쌍 10개, ATTACK/턴/DAMAGE/룰/티켓/경과시간/마진/시간 배율/피버 상태 14개 순서이며 JS 학습 전이, Python 환경, Solomon 서버가 `python/common.py`의 같은 계약을 사용한다. `learning.py`의 `--output` 경로가 실제 체크포인트 파일이면 `MODEL_VERSION`·`OBSERVATION_SIZE`·`ACTION_COUNT`를 검증한 후 가중치를 복원한다. 관측 계약은 버전 2와 같지만 신경망 종류가 달라 버전 2 이하 체크포인트는 호환하지 않으며 다시 학습해야 한다. `--evaluate-episodes`는 탐험 없이 승률을 집계하고, `--infer-observation`은 LM Studio/HTTP 없이 관측 JSON을 직접 추론한다(숫자 배열 또는 `{observation, nextPair}` 객체). 체크포인트에는 optimizer·replay buffer·epsilon 상태를 저장하지 않는다.

### 애프터스테이트 가치 학습 (모델 버전 3)

24개 행동의 Q값을 내던 DQN(`PolicyNetwork`)을 버리고, 한 수를 둔 직후 상태의 가치 하나를 내는 `learning.ValueNetwork`를 쓴다. 이 게임은 착지·폭발·연쇄·ATTACK을 `bundledenemy`의 규칙만으로 정확히 계산할 수 있으므로, 규칙으로 알 수 있는 부분을 신경망이 다시 배울 이유가 없다.

- **선택 규칙**: `learning.enumerate_afterstates(observation, next_pair, usable_actions)`가 놓을 수 있는 배치마다 결과 보드를 만들고, `learning.select_afterstate()`가 `move_reward + DISCOUNT_GAMMA * V(애프터스테이트)`가 가장 큰 후보를 고른다. 놓을 수 없는 배치는 후보에서 아예 빠지므로 불가능한 행동을 고르는 경로가 없다. 후보가 하나도 없으면 애프터스테이트 없이 스폰 위치(X=2)를 돌려준다.
- **애프터스테이트 인코딩**: 결과 보드를 같은 528개 관측 계약으로 인코딩하되, **조작 쌍 자리에는 이번 수의 다음 쌍**을 넣는다(= 다음 턴이 시작될 때의 내 상태). ATTACK·싹쓸이 티켓·피버 보정은 `PuyoDuelEnvironment.step()`과 같은 순서로 적용하고, 무작위인 방해뿌요 낙하는 반영하지 않은 채 상쇄하고 남은 피해량만 스칼라로 남긴다. 학습기·서버 추론·서버 온라인 학습이 모두 이 함수 하나를 쓰므로 가치망이 보는 입력 분포가 어긋나지 않는다.
- **신경망**: 보드 구간(채널→y→x 순서)을 7×12×6 평면 그대로 3×3 합성곱 두 단(32채널)에 넣고, 조작 쌍 10개와 스칼라 14개(`OBSERVATION_EXTRA_SIZE`)를 이어 붙여 256-128 은닉층을 지나 스칼라 하나를 출력한다.
- **학습 목표값**: `learning.build_value_samples()`가 에피소드가 끝난 뒤 (애프터스테이트, 그 수의 보상) 기록을 n스텝(`N_STEP_RETURN`, 기본 3) 목표값 표본으로 바꾼다. 리플레이 표본은 `ValueSample(state, partial_return, bootstrap, discount)`이며 목표값은 `partial_return + discount * V_target(bootstrap)`이다. 최대 턴에서 잘린 에피소드의 마지막 상태는 뒤가 비어 표본으로 쓰지 않는다.
- **승패는 보상이 아니라 마지막 애프터스테이트의 가치다**: 환경은 `info["terminal_value"]`로 승리 `+WIN_REWARD`·패배 `LOSS_REWARD`를 알려 주고(잘린 에피소드는 이 값이 없다), 학습기는 그 값을 보상에서 빼 낸 뒤 **마지막 애프터스테이트의 목표값 자체**로 쓴다. 승패를 그 앞 수의 보상으로만 주면 죽은 보드의 가치가 0이 되어, 배치 후보 중 "두는 순간 지는 수"가 안전한 수보다 좋아 보이는 문제가 생긴다. 서버의 `_close_solomon_side()`도 같은 계약이다. 놓을 자리가 아예 없어 끝난 수(`invalid`)도 패배로 보고 `LOSS_REWARD`를 쓴다.
- **탐험**: epsilon은 스텝이 아니라 **에피소드 기준**으로 줄여 전체의 절반(`episodes // 2`)에서 최저값 0.05에 닿는다. 에피소드마다 실제 수 개수가 크게 달라 스텝 기준으로는 학습이 끝날 때까지 탐험 비율이 거의 내려가지 않기 때문이다. 탐험도 무작위 행동 번호가 아니라 **놓을 수 있는 후보 중 하나**를 고른다.
- `--opponent solo`의 `PuyoEnvironment`도 자체 보드 로직을 버리고 `bundledenemy`의 착지·연쇄·패배 판정을 그대로 쓴다. 보상 계약이 대전 환경과 같아야 하기 때문이다.

### 브라우저 ONNX 추론 적 (`OnnxEnemy` 계열)

플라우로스(`Flauros`)부터는 파이썬 백엔드 없이 브라우저에서 ONNX Runtime for Web으로 직접 가치망을 추론해 판단한다. 공통 구현은 `OnnxEnemy`(→ `BundledEnemy` → `Enemy`)에 있고, 적마다 모델 파일이 1:1로 대응하므로 하위 클래스는 멤버변수 `modelPath`(`src/` 기준 상대 경로)와 `getClassType()`·`getName()`·`drawPortrait()`만 재정의한다. 플라우로스는 `onnx/model01.onnx`를 쓰고, 이후 적은 `model02.onnx`처럼 이어 붙인다. `OnnxEnemy`는 외부 확장 적도 상속할 수 있도록 `WebPuyo.OnnxEnemy`로 공개한다.

- **선택 규칙은 파이썬과 같다**: `learning.select_afterstate()`를 그대로 옮겼다. `getUsablePlacements()`로 실제 도달 가능한 배치만 추리고, 후보마다 `buildAfterstate()`가 연쇄까지 끝난 결과 보드를 `common.py`와 같은 528개 관측 벡터로 만든 뒤, 한 번의 추론(`[후보 수, 528]`)으로 받은 가치로 `move_reward + ONNX_DISCOUNT_GAMMA(0.70) * V`가 가장 큰 배치를 고른다. 모델은 행동이 아니라 **스칼라 가치 하나**를 내므로 후보 열거와 보상 계산은 JS가 한다.
- **관측 인코딩은 한 함수만 쓴다**: `buildObservationValues()`가 학습 API용 `getLearningObservation()`과 애프터스테이트 인코딩 양쪽을 담당한다. ATTACK·싹쓸이 티켓·피버 보정 순서는 `learning.py`의 `_build_afterstate()`와 같아야 하며, 애프터스테이트의 조작 쌍 자리에는 **이번 수 다음에 내려올 쌍**을 넣는다. 이 계약은 기본 룰과 피버 룰 모두 파이썬 `enumerate_afterstates()`와 후보·보상·528개 값이 완전히 일치함을 확인했다. `python/common.py`의 스케일 상수를 바꾸면 이 함수도 함께 고쳐야 한다.
- **결과 보드가 필요해 시뮬레이션을 합쳤다**: `simulatePlacementResult()`가 `{board, combo, attack}`을 한 번에 돌려주고, 기존 `simulatePlacementBoard()`·`estimateCombo()`·`estimateAttack()`과 `prepareAiPlacementSimulations()`가 모두 이 함수를 거친다. 같은 배치를 여러 번 시뮬레이션하지 않고 세 값이 어긋날 일도 없다. 또 `prepareAiPlacementSimulations()`는 계산해 둔 결과 보드를 버리지 않고 후보마다 `board`로 남기며, `buildAfterstate()`는 그 값이 있으면 재사용해 한 턴에 같은 연쇄를 두 번 돌리지 않는다. **이 보드는 여러 곳이 함께 보는 배열이므로 읽기 전용으로만 쓴다.** 후보 목록 밖에서 들어온 배치(`board`가 `undefined`)만 직접 계산하고, 놓을 수 없는 배치는 `board`가 `null`이라 후보에서 빠진다.
- **추론은 반드시 Web Worker에서 돌려야 한다**: wasm 연산은 메인 스레드에서 **동기로** 실행된다. `await session.run()`이라고 써 있어도 연산 자체는 양보하지 않으므로, `ort.env.wasm.proxy`가 꺼져 있으면 그동안 화면·입력·자연 낙하가 통째로 멈춘다. 특히 27MB wasm을 인스턴스화하는 `InferenceSession.create()`가 문제였고, CPU 6배 저속 환경에서 메인 스레드가 **3,756ms** 통째로 멈춰 브라우저가 응답 없음으로 보였다(프록시를 켜면 같은 조건에서 173ms). 이 때는 로딩 안내 문구조차 그려지지 않는다. 그래서 `refreshOnnxRuntimeAvailability()`가 `proxy = true`를 켜고, 프록시 워커를 띄울 수 없는 환경(Blob 워커를 막는 CSP 등)에서만 `loadOnnxSession()`이 프록시를 끄고 한 번 재시도한다. 이 설정은 첫 세션 생성보다 먼저 끝나야 하므로 초기화 시점에 한 번만 잡는다.
- **추론 중에도 게임은 멈추지 않는다**: 솔로몬과 같은 `decisionState`(`pending`/`ready`/`fallback`/`cancelled`) 구조다. 결과가 오기 전에는 `updateControl()`이 좌우 이동·회전을 하지 않고 `useFastDown()`도 false를 돌려주므로 자연 낙하만 진행되며, 결과가 나오기 전에 뿌요가 닿으면 `cancelPendingRequest(player, 'contact')`가 토큰을 올려 그 턴 결과를 버린다. 늦게 도착한 결과는 `inferenceToken`과 `isCurrentTurn()`으로 걸러진다.
- **한 턴의 마감 시한은 `ONNX_INFERENCE_TIMEOUT`(2초)다**: 넘으면 `inferenceToken`을 올려 늦은 결과를 버리고 `applyFallback()`으로 그 턴을 확정한다. 한 턴의 자연 낙하 예산(`PLAYER_FALL_INTERVAL 2048ms × 12칸 ≈ 24초`)보다 훨씬 짧게 잡아, 늦은 추론 때문에 회전도 이동도 없이 스폰 자리에 떨어뜨리는 턴이 생기지 않게 한다. 타이머는 프록시로 메인 스레드가 비어 있을 때만 제때 깨어난다 — 동기 블로킹은 `setTimeout`으로 끊을 수 없으므로 프록시 없이는 이 마감 시한 자체가 무의미하다. `clearDecisionTimeout()`으로 결과 도착·턴 교체·취소 모두에서 정리한다.
- **실패 처리는 두 단계로 나뉜다**: 모델 **로딩** 실패는 대전을 아예 시작하지 않는다. `prepareGameOnnxModels()`가 `game.onnxLoading`을 켜서 카운트다운을 멈추고 로딩 안내를 띄우다가, 실패하면 안내 문구와 함께 적 선택 화면으로 돌려보낸다. 구경 모드는 `requiresOnnx` 적을 후보에서 아예 빼므로 이 경로를 쓰지 않는다. 반면 **추론·출력 검증** 실패는 대전을 멈추지 않고 그 턴만 앞 1수 시뮬레이션(`findBestAttackPlacement()`) 결과로 진행한다. 세션은 `onnxSessionCache`에 모델 경로별로 캐시하되, 실패한 시도는 지워서 다시 시도할 수 있게 한다.
- **런타임이 없어도 게임은 그대로 돈다**: `ort.all.min.js`는 선택 라이브러리다. 초기화 때 `refreshOnnxRuntimeAvailability()`가 전역 `ort` 존재 여부를 한 번 확인하고 `ort.env.wasm.wasmPaths`를 `src/js/`로, `numThreads`를 1로, `proxy`를 true로 지정한다. 런타임이 없거나 wasm 바이너리에 전혀 접근할 수 없으면(`isOnnxRuntimeAvailable()`이 둘을 함께 본다) `requiresOnnx` 적이 적 선택 화면에서 빠진다. 이때 쓰는 플래그는 `hidden`·`notAvail`과 **별개**이며, 갤러리는 영향을 받지 않는다. 그래서 적 목록 함수가 둘로 나뉘어 있다 — 갤러리는 `getGalleryOpponents()`(숨김만 제외), 적 선택 화면은 `getVisibleOpponents()`(숨김 + 런타임 없는 `requiresOnnx` 제외). 구경 모드는 런타임 유무를 따지지 않고 `getWatchOpponentCandidates()`가 `requiresOnnx` 적을 항상 제외한다. 진행도 사슬(`isOpponentUnlocked()`의 `progressionOpponents`)에는 런타임 여부와 무관하게 그대로 남겨 두어야 뒤 적의 해금 조건이 흔들리지 않는다.
- **wasm 파일 위치는 CDN을 먼저 쓴다**: `resolveOnnxWasmPaths()`가 초기화 때 한 번 결정한다. 27MB짜리 `ort-wasm-simd-threaded.jsep.wasm`은 CDN(`https://cdn.jsdelivr.net/npm/onnxruntime-web@<버전>/dist/`)을 HEAD로 먼저 두드리고, 닿으면 `wasmPaths`를 `{ mjs: <로컬>, wasm: <CDN> }` 객체로 지정한다. 46KB짜리 글루 모듈은 함께 배포되므로 항상 로컬 것을 쓴다. CDN에 닿지 않으면 `src/js/` 접두 경로로 되돌리고, **그 로컬 파일도 없으면** `onnxWasmAvailable`을 false로 남겨 적 선택 화면에서 ONNX 적을 감춘다. CDN 주소의 버전은 `ort.env.versions.web`에서 읽어 만들므로 `ort.all.min.js`만 갈아끼워도 글루와 바이너리 버전이 어긋나지 않는다. 확인은 비동기라 `onnxWasmPathsPromise`에 담아 두고 `loadOnnxSession()`이 세션을 만들기 전에 기다린다. 확인이 끝나기 전에는 **사용 가능으로 본다**(낙관적 기본값). 정상 환경에서 적 목록이 뒤늦게 바뀜어 카드가 흔들리는 것을 막기 위해서고, 확인 전에 골라도 모델 로딩 게이트가 실패를 잡아 안내 후 되돌린다. HEAD 요청에는 `ONNX_WASM_PROBE_TIMEOUT`(4초) 제한이 붙어, 응답 없는 네트워크에서 목록이 미확정으로 남지 않는다. 페이지가 `ort.env.wasm.wasmPaths`를 직접 지정했다면 그 설정을 존중해 확인도 하지 않고 그대로 둔다.
- **필요한 파일**: `src/js/`에 `ort.all.min.js`와 함께 `ort-wasm-simd-threaded.jsep.mjs`가 있어야 하고, `ort-wasm-simd-threaded.jsep.wasm`은 오프라인·CDN 차단 환경을 위한 예비로 둔다. 런타임이 `.mjs`를 먼저 불러오고 그 `.mjs`가 `.wasm`을 받아 오는 구조라 글루는 빠질 수 없다. **정적 서버는 HEAD 요청을 반드시 받아야 한다.** 예전에 `python/pythonserver.py`가 HEAD에 501을 돌려줘 파이썬 서버로 구동할 때만 플라우로스가 사라질 뻔했고, 지금은 `do_HEAD()`가 GET과 같은 라우팅을 거친 뒤 본문 없이 헤더만 보낸다(파일을 읽지 않고 `stat()` 크기만 쓴다). 이 파일들을 직접 서빙할 때는 Content-Type도 맞아야 한다. 이 파일들을 직접 서빙할 때는 Content-Type도 맞아야 한다. `nodeserver.js`는 확장자 switch 문으로, `python/pythonserver.py`는 `STATIC_CONTENT_TYPES` 표와 `resolve_static_content_type()`으로 같은 값을 내려보낸다. 파이썬은 예전에 `mimetypes.guess_type()`만 썼는데, 이 함수가 Windows에서는 레지스트리를 함께 읽어 PC마다 결과가 달라진다. 실제로 `.mjs`가 `text/plain`으로 나가 브라우저가 wasm 글루 모듈을 거부한 적이 있어, 게임 구동에 필요한 확장자는 표에 못박아 두고 표에 없는 확장자만 `mimetypes`로 넘긴다. 서빙할 파일 종류를 늘릴 때는 두 서버의 표를 함께 고친다.
- **세션 로그를 error로 낮춘 이유**: `lngui.py`가 내보낸 그래프는 `ValueNetwork.forward()`의 마지막 `reshape(-1)` 때문에 출력 축이 1로 추론되어, 여러 후보를 한 배치로 넣을 때마다 `Expected shape from model of {1}` 경고가 매 턴 쌓인다. 출력 값 자체는 후보 수만큼 정상이고 길이도 검증하므로 `logSeverityLevel: 3`으로 이 경고만 가린다.
- **학습 상대에서는 제외한다**: ONNX 추론 적은 `python/bundledenemy.py`의 `ENEMY_FACTORIES`/`TRAINABLE_ENEMY_TYPES`에 넣지 않는다. 학습 중인 모델과 별개의 모델을 파이썬에서 또 돌려야 하기 때문이며, 앞으로 추가되는 ONNX 적도 같은 이유로 넣지 않는다.

### Local AI 서버에 보내는 배치 후보 목록

서버의 `is_legal_observation_action()`은 관측 벡터에 담긴 **화면 12줄의 목적지 열 높이**만 본다. 반면 게임의 `Solomon.canUsePlacement()`는 뿌요의 현재 낙하 Y에서의 가로 이동 경로, 회전 킥으로 X가 밀리는지, 숨김 행까지 포함한 25줄 보드의 `aiSimulations` 포함 여부를 함께 본다. 그래서 필드가 높아지면 서버가 "합법"이라고 답한 배치를 게임이 거부해 `handleRequestFailure()`로 일시정지되는 일이 생겼다.

이를 막기 위해 AI 제공자가 `Local AI`일 때만 `Solomon.getUsablePlacements()`가 `player.aiSimulations`를 응답 검증과 **같은 `canUsePlacement()`로 걸러** `usablePlacements`(`{x, rotation}` 배열)로 프롬프트에 함께 보낸다. 서버의 `parse_usable_actions()`가 이를 행동 번호 집합으로 바꾸고, `choose_model_action()`은 이 목록이 오면 관측값의 높이 조건 대신 **그 목록 안에서만** 가치가 가장 높은 배치를 고른다. 목록을 보내지 않는 요청(다른 제공자·예전 클라이언트)에서는 기존 높이 조건을 그대로 쓴다. 스폰 상태 `{x:2, rotation:0}`은 항상 이 목록에 들어가므로 목록이 비는 일은 사실상 없지만, 비면 항목 자체를 넣지 않아 기존 동작으로 되돌아간다. 화면 12줄만으로는 어떤 후보도 착지시킬 수 없어 애프터스테이트를 만들지 못한 경우에는, 목록이 왔다면 그중 가장 작은 행동 번호를 돌려주어 게임이 대체 AI로 넘어가지 않게 한다.

`SOLOMON_PLACEMENT_JSON_SCHEMA`(응답 형식)는 바꾸지 않았다. 이 항목은 요청 프롬프트에만 추가된다.

### 솔로몬 온라인 학습 (Local AI + 극한 난이도)

AI 제공자가 `Local AI`이고, 극한 AI 난이도로 적 `솔로몬`과 대전하며, 설정의 `역으로 모델 학습`(`store.settings.reverseLearning`)이 켜져 있을 때만(색상 수·룰은 가리지 않는다) 그 대전에서 나온 수로 로컬 서버의 모델을 추가 학습한다. 판정 함수는 `shouldTrainLocalAiWithSolomon()`이며 `game.players[1].controller`가 솔로몬인지, `isReverseLearningEnabled()`가 켜져 있는지까지 확인하므로, 연습·퍼즐·구경처럼 솔로몬이 나올 수 없는 모드와 이 설정을 꺼 둔 대전은 자연히 제외된다. 이미 끝난 대전을 다시 보여 줄 뿐인 리플레이 재생(`game.replayPlayback`)도 제외한다.

`역으로 모델 학습`은 솔로몬 자신의 수로 하는 학습을 포함해 이 온라인 학습 기능 전체를 켜고 끈다(체크박스 이름의 "역으로"는 `learning.py`로 하는 평소의 오프라인 일괄 학습과 반대로, 실제 서비스 중인 모델을 대전 도중 그 자리에서 갱신한다는 뜻이다). 이 설정이 꺼져 있으면 `shouldTrainLocalAiWithSolomon()`이 곧바로 `false`를 반환하므로 `getSolomonLearningSessionId()`가 세션 ID 자체를 만들지 않는다. 그 결과 솔로몬 배치 프롬프트에 `learningSessionId`가 실리지 않아 서버가 그 수를 학습 세션에 쌓지 않고, 대전이 끝나도 `requestSolomonLearningFinish()`가 아예 호출되지 않아 `/apis/solomonlearning`으로 어떤 요청도 나가지 않는다.

- `getSolomonLearningSessionId()`가 대전마다 `solomon-<시각>-<난수>` 세션 ID를 만들어 `game.solomonLearningSessionId`에 보관하고, `Solomon.buildPlacementPrompt()`가 이 값을 프롬프트의 `learningSessionId` 항목으로 함께 보낸다. 학습 대상이 아니면 이 항목 자체를 넣지 않으므로 다른 제공자·난이도의 프롬프트는 기존과 완전히 같다.
- 서버의 `chat_completions_api()`는 `learningSessionId`가 있는 배치 요청마다 `record_solomon_step()`으로 이번 수의 애프터스테이트와 즉시 보상을 세션에 순서대로 담아 둔다. 애프터스테이트는 학습기의 `build_afterstate()`를 그대로 호출해 만들므로 오프라인 학습과 형식·보상 계약이 같다.
- 위험 높이·응답 오류로 솔로몬이 대체 AI를 쓴 턴은 요청이 오지 않는다. 관측값의 `placedPairCount`가 두 턴 이상 건너뛴 수는 `linked`가 false로 기록되고, 그 앞 수는 다음 상태를 알 수 없으므로 표본으로 만들지 않는다.
- 학습은 매 수마다 하지 않고, 승패가 확정되어 결과 화면으로 넘어가는 `updateDefeatSequence()` 시점에 `requestSolomonLearningFinish()`가 `POST /apis/solomonlearning`(`{event:'finish', sessionId, result}`)을 한 번 보낼 때 수행한다. `result`는 학습 대상인 **솔로몬 기준**의 `win`/`loss`/`draw`다. 이 요청이 실패해도 게임 진행에는 영향을 주지 않는다.
- `finish_solomon_session()`은 `_close_solomon_side()`로 양쪽의 수를 학습 표본으로 바꾼 뒤 `train_solomon_samples()`를 호출한다. 한 수의 목표값은 `다음 수의 보상 + 감가된 다음 애프터스테이트의 가치`이고, 대전의 마지막 수는 더 진행할 상태가 없어 승패 보상(`WIN_REWARD`/`LOSS_REWARD`)만 목표가 된다. 목표값은 갱신 전 가중치로 한 번만 계산하고(별도 target 네트워크 대신), `learning.train()`과 같은 학습률 `1e-3`·감가율 `DISCOUNT_GAMMA`·smooth L1 손실·그래디언트 노름 1.0 클리핑을 사용한다.

#### 사람이 이긴 대전의 수순 학습

같은 대전에서 **사람이 조작한 플레이어 쪽 수**도 함께 모아 두었다가, 사람이 이겼을 때만 "모델이 플레이어 쪽을 조작해 이긴 수순"으로 보고 함께 학습한다. 관측 벡터(528개)와 행동 번호(`열*4+회전`)는 어느 쪽이 두었는지 구분하는 값이 없는 자기중심 표현이므로, 사람의 수도 솔로몬의 수와 같은 전이 구조로 그대로 쓸 수 있다.

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

`lngui.py`에는 File 그룹 하나만 있는 메뉴바가 있고, 그 안에 `SAVE_AS_MENU_LABEL`(`Save As...`)와 `EXIT_MENU_LABEL`(`Exit`) 두 항목이 있다. 메뉴 항목을 켜고 끌 때는 인덱스가 아니라 이 라벨 상수로 지정하므로 항목 순서를 바꿔도 상태 처리 코드를 함께 고칠 필요가 없다. `Save As...`는 학습 중·일시정지 중과 저장 작업이 도는 동안 잠기며(`_set_save_as_enabled()`), `Exit`는 상태 변화로는 잠기지 않고 종료 절차를 시작한 `_disable_all_controls()`에서만 함께 잠근다.

- `Save As...`(`_on_save_as()`)는 먼저 `Model output path`에 파일이 있는지 확인하고, 없으면 대화상자를 열지 않은 채 로그창에만 안내를 남긴다. 파일이 있으면 `parent=self.root`로 모달 저장 대화상자를 열어 `SAVE_AS_FILETYPES`(`.pt` / `.onnx`) 중 하나를 고르게 한다. 어느 형식인지는 결과 경로의 **확장자**로 판별하므로 형식을 더할 때는 이 목록과 확장자 분기를 함께 넓힌다. 취소·닫기, 지원하지 않는 확장자, 원본과 같은 경로는 모두 아무 것도 쓰지 않고 로그만 남긴다.
- 저장을 고르면 `Start` 버튼과 `Save As...`를 잠그고 별도 쓰레드(`_run_save_as()`)에서 처리한다. `.pt`는 `save_checkpoint_copy()`가 `shutil.copy2()`로 바이트 그대로 복사해 기존 체크포인트 형식을 유지하고, `.onnx`는 `export_checkpoint_to_onnx()`가 변환한다. 결과·오류는 큐의 `saveas_progress`·`saveas_done`·`saveas_error` 항목으로 메인 쓰레드에 전달하고, `_finish_save_as()`가 잠근 조작을 되살린다.
- ONNX 변환은 `Start` 버튼 아래의 학습용 게이지바를 잠시 빌려 진행률을 보여 준다. 빌리기 전 `(maximum, value)`를 `_progress_backup`에 담아 두고 끝나면 그대로 되돌리므로, 직전 학습 진행 표시가 사라지지 않는다. `_progress_backup`이 있을 때만 게이지바를 갱신하므로 `.pt` 복사는 게이지바를 건드리지 않는다.
- `export_checkpoint_to_onnx()`는 `learning.load_policy_checkpoint()`로 모델 버전·관측값·행동 계약을 먼저 검증하므로 형식이 다른 체크포인트로 어중간한 ONNX 파일이 만들어지지 않는다. `onnx` 패키지가 없으면 변환을 시작하기 전에 `ONNX_REQUIREMENT_MESSAGE`를 담은 예외를 올린다. `onnxscript`가 있으면 torch 2.9부터 기본이 된 `torch.export` 기반 내보내기를, 없으면 예전 TorchScript 방식을 쓴다. 전자는 `external_data=False`를 반드시 넘겨야 가중치를 옆의 `.onnx.data` 파일로 빼지 않고 고른 위치의 파일 하나로 완성된다. 또 `ValueNetwork.forward()`가 마지막에 `reshape(-1)`을 하기 때문에 출력 축이 1로 고정되어 적히므로, 검증 단계에서 그 축을 입력과 같은 `ONNX_BATCH_AXIS_NAME`(`batch`)으로 고쳐 저장한다. 원본 체크포인트는 읽기만 하므로 기존 모델 호환성에는 영향이 없다.
- `Exit`(`_on_exit_menu()`)는 먼저 모든 버튼·입력·메뉴를 잠근 뒤 `_exit_pending`을 켠다. 학습 중이거나 일시정지 중이면 `Stop` 버튼과 같은 `control.request_stop()`만 걸고 기다린다(`request_stop()`이 일시정지 대기도 함께 풀어 준다). 저장까지 끝나 학습·저장 쓰레드가 모두 끝나면 `_poll_queue()`가 `_shutdown()`으로 창을 닫는다. `_exit_pending`이 켜져 있는 동안에는 `_reset_controls()`와 `_finish_save_as()`가 잠근 버튼을 되살리지 않는다. 창 오른쪽 위 닫기 버튼(`_on_close()`)은 예전처럼 `request_abort()`로 저장 없이 즉시 포기하는 경로라서 `Exit`와 의미가 다르다.

`lngui.py`의 메뉴 동작과 ONNX 변환은 `python/test_learning.py`의 `TrainerMenuTest`·`OnnxExportTest`가 확인한다. 앞쪽은 실제 Tk 창을 만들어 위젯·메뉴 상태를 검사하므로 화면이 없는 환경에서는 통째로 건너뛴다(`_TK_AVAILABLE`). ONNX 변환 자체를 확인하는 테스트는 `onnx` 패키지가 있을 때만 돌고, 미설치 안내를 확인하는 테스트는 반대로 없을 때만 돈다.

## 작업를 마치기 전 수행할 추가 작업 및 참고 사항

작업 후 puyow.js 의 BUILDNO 를 1 증가시켜주고, package.json 의 version 의 패치 번호에 BUILDNO 값을 넣어줘.
작업으로 인해 이 INFO_FOR_AI.md 내용 중 더 이상 맞지 않는 내용이 있다면 수정해 줘.
주석 및 채팅창 답변은 모두 한국어로 해줘.

