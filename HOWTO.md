# Puyo W 개발 안내

이 문서는 Puyo W의 페이지 구성, 라이브러리 초기화, 번역 추가를 위한 공통 개발자 안내입니다. 기능별 API 문서는 하단의 문서 링크를 참고하세요. 플레이 방법과 게임 규칙은 [README.md](README.md)를 참고하세요.

## 문서 길잡이

- [Graphics.md](docs/Graphics.md): 1280 x 720 논리 좌표계, 출력 해상도와 좌표 변환 API
- [Puyo.md](docs/Puyo.md): 일반·방해뿌요 클래스와 사용자 정의 예고뿌요 등록 API
- [Enemy.md](docs/Enemy.md): 새 적 등록, 초상화·테마 렌더링, CPU 알고리즘과 상태 조회 API
- [Simulator.md](docs/Simulator.md): 시뮬레이터 사용법, 점수 확인, 피버 패턴 등록 방법
- [Sound.md](docs/Sound.md): 공통·적 사운드 풀과 음원 URL 변경 방법

## 플레이어 안내

게임 소개, 조작 방법, 대전 규칙은 [README.md](README.md)를 참고하세요.

## 프로젝트 구성

- `index.html`: 배포 페이지의 진입점입니다.
- `src/puyow.html`: 게임 캔버스를 포함한 페이지 구조와 초기화 호출을 정의합니다.
- `src/puyow.css`: 전체 화면 캔버스 레이아웃과 글꼴 스타일을 정의합니다.
- `src/puyow.js`: 브라우저/CommonJS 라이브러리, 게임 규칙, 렌더링, 입력, CPU 조작을 구현합니다.
- `HOWTO.md`: 페이지 구성, 라이브러리 사용법, 번역 및 공통 개발 안내를 제공합니다.
- `docs/`: 그래픽, 뿌요, 적·AI, 시뮬레이터·피버, 사운드별 개발자 문서를 제공합니다.

## CDN

puyow.js 는 CDN으로도 사용할 수 있습니다.
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/HJOW/puyow@main/src/puyow.css"/>
<script src='https://cdn.jsdelivr.net/gh/HJOW/puyow@main/src/puyow.js'></script>
```


## 라이브러리 개요

`puyow.js`는 CommonJS와 브라우저 스크립트 방식 모두에서 사용할 수 있는 라이브러리입니다. `Enemy`는 CPU 조작 알고리즘과 게임 화면 테마를 넣기 위한 기본 클래스입니다. 메인 화면에서 게임 시작을 선택하면 적 선택 화면이 열리며, 외부 파일에서 등록한 상대를 선택해 대전합니다. `sortPriority` 멤버 변수의 기본값은 `1`이며, 작은 값의 적이 적 선택 화면에서 왼쪽에 표시됩니다.

`Enemy`에는 선택 화면 공개 상태를 위한 boolean 멤버 변수도 있습니다. 둘 다 기본값은 `false`입니다.

- `hidden`: `true`이면 적 선택 화면에 표시하지 않습니다.
- `notAvail`: `true`이면 회색의 `추후 출시예정` 카드로만 표시하며, 마우스와 키보드로 선택할 수 없습니다.

일반 대전에서 플레이어가 승리하면 브라우저 `localStorage`의 `puyow_store`에 적 클래스명이 기록됩니다. `hidden` 및 `notAvail`이 아닌 적은 정렬 순서상 바로 이전 적을 한 번 이겨야 선택할 수 있으며, 첫 번째 적은 쉬움·보통·어려움·극한 모두에서 항상 선택할 수 있습니다. 기본 룰은 `clearListByDifficulty`, 피버 룰은 `feverClearListByDifficulty`의 `easy`, `normal`, `hard`, `extreme` 배열을 각각 사용하므로 두 규칙의 적 잠금 해제 진행도는 서로 영향을 주지 않습니다. `clearList`는 기존 기본 룰의 전체 승리 적 목록만 보관합니다.

## 기본 초기화

라이브러리를 불러오는 것만으로는 게임이 초기화되지 않습니다. 브라우저에서는 모든 적 등록 스크립트를 불러온 뒤 `WebPuyo.initialize()`를 명시적으로 호출해야 메뉴와 입력 처리가 시작됩니다.

```html
<script defer src="puyow.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function() {
    window.WebPuyo.initialize('webpuyo_canvas');
});
</script>
```

Node.js CommonJS 환경에서는 아래처럼 라이브러리를 불러올 수 있습니다. DOM이 없는 Node.js에서는 `initialize()`를 호출할 수 없지만, 컨트롤러 클래스와 적 등록 API는 사용할 수 있습니다.

```js
const { Enemy, Puyo, RedPuyo, GreenPuyo, YellowPuyo, BluePuyo, PurplePuyo, GarbagePuyo, HardGarbagePuyo, WarningPuyo, registerOpponent, registerWarningPuyo, randomFloat, getCanvasOutputSize, toCanvasCoordinates, toCanvasLength, applyCanvasCoordinateTransform, getSelectedDifficulty, getSelectedColorCount, getScreenState, getGameState, showMessage, initialize } = require('./src/puyow.js');
```

`initialize(target)`의 `target`에는 canvas 요소, canvas 요소의 `id` 문자열, 또는 canvas를 넣을 `div` 요소를 전달할 수 있습니다. `div`를 전달하면 그 안에 게임용 canvas를 만들어 연결하며, 이 canvas는 `destroy()` 호출 시 제거됩니다. canvas 요소를 직접 전달하면 해당 요소를 사용하고 `destroy()`가 요소를 제거하지 않습니다. 다만 게임의 그래픽 설정에 따라 해당 canvas의 실제 `width`와 `height`는 설정됩니다. 인수를 생략하거나 `null`, `undefined`, 빈 문자열을 전달했을 때 `webpuyo_canvas` canvas가 없으면, 라이브러리는 `body`의 자식으로 새 canvas를 만들고 게임을 연결하며 `destroy()` 시 제거합니다. 지정한 ID가 존재하지 않거나 canvas·div가 아닌 요소를 전달하면 오류가 발생합니다.

## 실행 중 표시와 설정

### 화면 상단 메시지 표시

`WebPuyo.showMessage(message, color = 'white', duration = 2000, backgroundColor = null)`는 현재 화면의 최상단에 메시지를 표시합니다. `message`는 필수 문자열이고, `color`는 선택 사항인 CSS 글자 색상 문자열이며, `duration`은 페이드 아웃 전 메시지를 유지할 시간(밀리초), `backgroundColor`는 글자 뒤에 표시할 선택 사항인 CSS 배경 색상 문자열입니다. `backgroundColor`가 `null`이면 배경 사각형 없이 기존처럼 글자만 표시합니다. 기본값은 각각 `'white'`, `2000`, `null`입니다. 유지 시간이 지난 뒤 500ms 동안 페이드 아웃되어 사라지며, 새 메시지를 표시하면 이전 메시지를 교체합니다.

이 함수는 다국어 처리를 하지 않고 받은 문자열을 그대로 표시합니다. 따라서 번역이 필요하다면 호출자가 먼저 번역한 뒤 전달해야 합니다.

```js
const message = translateForMyApp('Saved');
WebPuyo.showMessage(message);
WebPuyo.showMessage(message, '#f7c843', 3000);
WebPuyo.showMessage(message, '#ffffff', 3000, '#263238');
```

WebMCP를 지원하는 브라우저에서는 AI도 `show_message` 도구로 동일한 동작을 호출할 수 있습니다. 도구의 `message`는 이미 현지화된 문자열이어야 하며, `color`, `duration`, `backgroundColor`의 기본값은 각각 `'white'`, `2000`, `null`입니다.

### 공지사항 경로 설정

메인 화면 왼쪽에 표시할 공지사항은 기본적으로 `puyow.js`와 같은 경로의 `notice.txt`에서 읽습니다. 초기화하기 전에 `WebPuyo.setNoticeFile(noticeFile)`을 호출하면 파일명, 상대경로 또는 절대 URL을 지정할 수 있습니다. 상대경로는 `puyow.js`가 로드된 URL을 기준으로 해석하고, `https://`와 같은 절대 URL은 지정한 주소 그대로 사용합니다. 공지사항 파일은 다국어 번역을 거치지 않고 UTF-8 텍스트 그대로 표시합니다.

```js
// 기본값과 같은 파일을 사용한다.
WebPuyo.setNoticeFile('notice.txt');

// puyow.js가 있는 위치의 notices/notice-ko.txt를 사용한다.
WebPuyo.setNoticeFile('notices/notice-ko.txt');

// 다른 서버의 공지사항을 사용한다.
WebPuyo.setNoticeFile('https://example.com/puyo/notice.txt');

WebPuyo.initialize('webpuyo_canvas');
```

`setNoticeFile()`은 `initialize()` 호출 전에만 사용할 수 있습니다. 초기화가 끝난 뒤 호출하면 오류가 발생하므로, 경로를 바꾸려면 `destroy()`로 게임을 종료한 뒤 다시 설정하고 `initialize()`를 호출해야 합니다.

## 종료 및 정리

`WebPuyo.destroy()`는 `initialize()`로 시작한 게임 인스턴스를 종료하고 초기화 전 상태로 되돌립니다. 페이지 전환, 동적 UI 제거, 같은 페이지에서 다른 canvas로 게임을 다시 초기화할 때 호출합니다.

이 메서드는 키보드와 canvas 클릭 이벤트를 해제하고, 예약된 애니메이션 프레임을 취소하며, 등록된 WebMCP 도구도 해제합니다. `initialize()`가 기본 canvas를 찾지 못해 직접 생성한 `webpuyo_canvas`는 DOM에서 제거하지만, 개발자가 HTML에 넣었거나 `initialize(target)`으로 전달한 canvas는 제거하지 않습니다.

`destroy()` 뒤에는 다시 `initialize()`를 호출할 수 있습니다. 아직 초기화되지 않은 상태에서 호출해도 아무 작업 없이 안전하게 끝납니다.

```js
WebPuyo.initialize('webpuyo_canvas');

// 페이지의 게임 영역을 없애기 전에 실행한다.
WebPuyo.destroy();
```

## 화면 언어 추가

초기화 전에 `WebPuyo.registerLanguage(locale, entries)`로 화면 문구 번역을 추가할 수 있습니다. 브라우저 언어가 `ko` 또는 `ko-KR`이면 한국어 원문을 그대로 사용합니다. 다른 언어는 전체 언어 코드(예: `ja-JP`)를 먼저 찾고, 없으면 기본 언어 코드(예: `ja`), 마지막으로 영어(`en`) 번역표를 사용합니다.

번역 키는 게임에 있는 한국어 원문입니다. `%1`, `%2`는 실행 중 전달된 값으로 바뀌는 자리표시자이며, 연쇄 메시지는 `%1연쇄` 키를 사용합니다.

```js
WebPuyo.registerLanguage('ja', {
	'게임 시작': 'ゲーム開始',
	'연습': '練習',
	'승리': '勝利',
	'패배': '敗北',
	'%1연쇄': '%1連鎖'
});

WebPuyo.initialize();
```

### 음소거 토글 (끄기/켜기)

메인 화면의 음소거 버튼은 내부 함수 `toggleMuted()`로 토글됩니다. 설정에 저장됩니다.

## 개발 보조 API

### 랜덤 난수 생성

`WebPuyo.randomFloat()`는 `0` 이상 `1` 미만의 실수 난수를 반환합니다. 게임 내부에서 색상 선택, 방해뿌요 열 순서 섞기, AI의 무작위 턴 수 결정 등 모든 랜덤 값은 이 함수를 통해 생성됩니다. 게임 내부에 새로운 랜덤 동작을 추가할 때도 `Math.random()`을 직접 호출하지 말고 `randomFloat()`을 사용해야 테스트에서 랜덤 생성 지점을 한 곳으로 관리할 수 있습니다.

```js
const value = WebPuyo.randomFloat();
// 0 <= value < 1
const index = Math.floor(value * items.length);
const item = items[index];
```

`randomFloat()` 자체는 기본적으로 브라우저의 `Math.random()`을 호출합니다. Playwright에서 특정 게임 상황을 재현하려면 게임 스크립트가 로드되기 전에 `Math.random`을 테스트용 함수로 바꾼 뒤 페이지를 초기화할 수 있습니다. 테스트가 끝난 뒤에는 원래 함수를 복원하거나 테스트 컨텍스트를 폐기해야 합니다.

```js
await page.addInitScript(() => {
    Math.random = () => 0.25;
});
await page.goto('/puyow.html');
```

---

[그래픽 좌표](docs/Graphics.md) · [뿌요 API](docs/Puyo.md) · [적·AI](docs/Enemy.md) · [시뮬레이터·피버](docs/Simulator.md) · [사운드](docs/Sound.md)
