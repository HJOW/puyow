# Puyo W 개발 안내

이 문서는 Puyo W의 페이지 구성, 라이브러리 초기화, 번역 추가, 새 AI 상대 제작을 위한 개발자 안내입니다. 플레이 방법과 게임 규칙은 [README.md](README.md)를 참고하세요.

## 플레이어 안내

게임 소개, 조작 방법, 대전 규칙은 [README.md](README.md)를 참고하세요.

## 프로젝트 구성

- `index.html`: 배포 페이지의 진입점입니다.
- `src/webpuyo.html`: 게임 캔버스를 포함한 페이지 구조와 초기화 호출을 정의합니다.
- `src/webpuyo.css`: 전체 화면 캔버스 레이아웃과 글꼴 스타일을 정의합니다.
- `src/webpuyo.js`: 브라우저/CommonJS 라이브러리, 게임 규칙, 렌더링, 입력, CPU 조작을 구현합니다.
- `HOWTO.md`: 페이지 구성, 라이브러리 사용법, 번역, 새 AI 상대 제작을 포함한 모든 개발 안내를 제공합니다.

## CDN

webpuyo.js 는 CDN으로도 사용할 수 있습니다.
```html
<script src='https://cdn.jsdelivr.net/gh/HJOW/puyow@main/src/webpuyo.js'></script>
```


## 라이브러리 개요

`webpuyo.js`는 CommonJS와 브라우저 스크립트 방식 모두에서 사용할 수 있는 라이브러리입니다. `Enemy`는 CPU 조작 알고리즘과 게임 화면 테마를 넣기 위한 기본 클래스입니다. 메인 화면에서 게임 시작을 선택하면 적 선택 화면이 열리며, 외부 파일에서 등록한 상대를 선택해 대전합니다. `sortPriority` 멤버 변수의 기본값은 `1`이며, 작은 값의 적이 적 선택 화면에서 왼쪽에 표시됩니다.

`Enemy`에는 선택 화면 공개 상태를 위한 boolean 멤버 변수도 있습니다. 둘 다 기본값은 `false`입니다.

- `hidden`: `true`이면 적 선택 화면에 표시하지 않습니다.
- `notAvail`: `true`이면 회색의 `추후 출시예정` 카드로만 표시하며, 마우스와 키보드로 선택할 수 없습니다.

일반 대전에서 플레이어가 승리하면 브라우저 `localStorage`의 `puyow_store`에 적 클래스명이 기록됩니다. `hidden` 및 `notAvail`이 아닌 적은 정렬 순서상 바로 이전 적을 한 번 이겨야 선택할 수 있으며, 첫 번째 적은 쉬움·보통·어려움 모두에서 항상 선택할 수 있습니다. 저장 데이터의 `clearList` 배열은 기존처럼 전체 승리 적 목록을 보관하지만 해금 판정에는 사용하지 않고, `clearListByDifficulty` 객체가 `easy`, `normal`, `hard` 난이도별 잠금 해제 목록을 전담합니다. 따라서 안드로말리우스를 이겨도 해당 난이도에서만 다음 적이 열립니다.

## 초기화

라이브러리를 불러오는 것만으로는 게임이 초기화되지 않습니다. 브라우저에서는 모든 적 등록 스크립트를 불러온 뒤 `WebPuyo.initialize()`를 명시적으로 호출해야 메뉴와 입력 처리가 시작됩니다.

```html
<script defer src="webpuyo.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function() {
    window.WebPuyo.initialize('webpuyo_canvas');
});
</script>
```

Node.js CommonJS 환경에서는 아래처럼 라이브러리를 불러올 수 있습니다. DOM이 없는 Node.js에서는 `initialize()`를 호출할 수 없지만, 컨트롤러 클래스와 적 등록 API는 사용할 수 있습니다.

```js
const { Enemy, registerOpponent, getSelectedDifficulty, getSelectedColorCount, initialize } = require('./src/webpuyo.js');
```

`initialize(target)`의 `target`에는 canvas 요소, canvas 요소의 `id` 문자열, 또는 canvas를 넣을 `div` 요소를 전달할 수 있습니다. `div`를 전달하면 그 안에 1280x720 canvas를 만들어 게임을 연결하며, 이 canvas는 `destroy()` 호출 시 제거됩니다. canvas 요소를 직접 전달하면 해당 요소를 그대로 사용하고 `destroy()`가 요소를 제거하지 않습니다. 인수를 생략하거나 `null`, `undefined`, 빈 문자열을 전달했을 때 `webpuyo_canvas` canvas가 없으면, 라이브러리는 `body`의 자식으로 새 canvas를 만들고 게임을 연결하며 `destroy()` 시 제거합니다. 지정한 ID가 존재하지 않거나 canvas·div가 아닌 요소를 전달하면 오류가 발생합니다.

## 공지사항 경로 설정

메인 화면 왼쪽에 표시할 공지사항은 기본적으로 `webpuyo.js`와 같은 경로의 `notice.txt`에서 읽습니다. 초기화하기 전에 `WebPuyo.setNoticeFile(noticeFile)`을 호출하면 파일명, 상대경로 또는 절대 URL을 지정할 수 있습니다. 상대경로는 `webpuyo.js`가 로드된 URL을 기준으로 해석하고, `https://`와 같은 절대 URL은 지정한 주소 그대로 사용합니다. 공지사항 파일은 다국어 번역을 거치지 않고 UTF-8 텍스트 그대로 표시합니다.

```js
// 기본값과 같은 파일을 사용한다.
WebPuyo.setNoticeFile('notice.txt');

// webpuyo.js가 있는 위치의 notices/notice-ko.txt를 사용한다.
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

## 음소거 토글 (끄기/켜기)

메인 화면의 음소거 버튼은 내부 함수 `toggleMuted()`로 토글됩니다. 설정에 저장됩니다.

## 기본 구조

새 상대는 `WebPuyo.Enemy`를 상속하는 클래스로 만듭니다. `getName()`은 비어 있지 않은 화면 표시 이름을 반환해야 합니다. 게임 루프는 적이 결정한 목표 회전값으로 뿌요 쌍을 돌린 뒤, 목표 X 좌표까지 이동시킵니다.

`Enemy`의 생성자는 모든 상대에 공통으로 사용할 기본 상태를 설정합니다. `sortPriority`는 `1`, `hidden`과 `notAvail`은 `false`로 시작하며, `attackSimulationTriggerPosition`은 `{ x: 2, y: 8 }`입니다. 이 좌표에 뿌요가 쌓이면 기본 AI가 일반적인 방향 쌓기보다 공격력 시뮬레이션을 우선하도록 만든 기준점입니다. 상대의 전략에 맞춰 생성자에서 이 좌표를 바꿀 수 있습니다.

```js
class CustomEnemy extends WebPuyo.Enemy {
	constructor() {
		super();
		// 중앙이 이 높이에 도달하면 공격 배치를 찾는다.
		this.attackSimulationTriggerPosition = { x: 2, y: 7 };
	}
}
```

`prepareTurn(player)`의 기본 구현은 현재 놓을 수 있는 모든 열·회전 조합을 검사해 `player.aiSimulations`를 만듭니다. 각 후보에는 목표 `x`, `rotation`, 실제 착지할 `positions`, 해당 배치의 예상 `attack`이 들어갑니다. 조작 중인 뿌요가 없으면 빈 배열을 저장합니다. 이 목록을 직접 만들거나 재사용하는 AI는 실제로 놓을 수 없는 후보가 포함되지 않는다는 점을 전제로 할 수 있습니다.

```js
class CenterEnemy extends WebPuyo.Enemy {
    /** 적 이름을 반환한다. */
	getName() {
		return '중앙 수집가';
	}

	/**
	 * 조작할 차례가 됐을 때 뿌요를 어느 위치에 둘 지 결정한다. (중력이 작용하므로 X좌표만 지정하면 된다.)
	 * @param {PlayerState} player 자동 조작할 플레이어
	 * @returns {number} 목표 X 좌표
	 */
	chooseTarget(player) {
		return 2;
	}

    /**
     * 조작할 차례가 됐을 때 뿌요를 회전할 지를 결정한다.
     * @param {PlayerState} player 자동 조작할 플레이어
     * @returns {number} 목표 회전값 (0: 위, 1: 오른쪽, 2: 아래, 3: 왼쪽)
     */
    chooseRotate(player) {
    	return 0;
    }

    /**
     * 이 적의 초상화를 그린다. 적 선택 화면과 게임 중 중앙 영역에서 사용된다.
     * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
     * @param {number} centerX 캐릭터 중심 X 좌표
     * @param {number} centerY 캐릭터 중심 Y 좌표
     * @param {number} scale 기본 크기 대비 배율
     * @returns {void}
     */
    drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
        return super.drawPortrait(drawingContext, centerX, centerY, scale, expression);
    }
}
```

## 적 초상화 그리기

`Enemy`의 `drawPortrait(drawingContext, centerX, centerY, scale, expression)` 메서드를 재정의하면 적 선택 화면과 대전 중 중앙 패널에 표시할 적 이미지를 직접 그릴 수 있습니다. `drawingContext`는 캔버스 2D 컨텍스트이며, `centerX`, `centerY`는 초상화의 중심 좌표, `scale`은 기본 크기 대비 배율입니다. `expression`은 `'normal'`, `'crisis'`, `'defeated'` 중 하나이며, 대전 중 중앙 패널에서는 적 필드가 절반 이상 차거나 `DAMAGE + 상대 ATTACK`이 30 이상이면 `'crisis'`, 적 패배 연출 중이면 `'defeated'`가 전달됩니다.

기본 `Enemy`의 메서드는 아무것도 그리지 않습니다. 새 적은 필요할 때만 이 메서드를 재정의하면 됩니다.

```js
class CenterEnemy extends WebPuyo.Enemy {
	/**
	 * 적 선택 화면과 중앙 패널에 초상화를 그린다.
	 * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
	 * @param {number} centerX 초상화 중심 X 좌표
	 * @param {number} centerY 초상화 중심 Y 좌표
	 * @param {number} scale 기본 크기 대비 배율
	 * @returns {void}
	 */
	drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
		drawingContext.save();
		drawingContext.translate(centerX, centerY);
		drawingContext.fillStyle = '#42a5f5';
		drawingContext.beginPath();
		drawingContext.arc(0, 0, 42 * scale, 0, Math.PI * 2);
		drawingContext.fill();
		drawingContext.restore();
	}
}
```

## 적 등록 방법

새 적은 별도 JavaScript 파일에서 `WebPuyo.registerOpponent()`로 등록합니다. 따라서 새 적을 추가할 때 `webpuyo.js`를 수정할 필요가 없습니다. 등록 객체에는 `createController` 함수가 반드시 필요하며, 이 함수는 매 호출마다 `Enemy`를 상속한 새 인스턴스를 반환해야 합니다. 적 이름은 별도 `name` 속성이 아니라 `getName()`의 반환값을 사용합니다.

`registerOpponent()`는 등록 시 `createController()`를 한 번 호출해 `sortPriority`, `hidden`, `notAvail`을 읽고 검증합니다. 따라서 이 설정은 생성자에서 설정하고, 등록 뒤에 값을 바꾸지 않아야 합니다. 실제 대전에서도 `createController()`를 다시 호출하므로, 게임별 상태는 컨트롤러 인스턴스 멤버로 유지합니다.

```js
// my-opponent.js
class CenterEnemy extends WebPuyo.Enemy {
	getName() {
		return '중앙 수집가';
	}

	chooseTarget(player) {
		return 2;
	}
}

WebPuyo.registerOpponent({
	createController: () => new CenterEnemy()
});
```

`my-opponent.js`는 `webpuyo.js` 다음, `WebPuyo.initialize()`를 호출하는 스크립트 전의 순서로 불러와야 합니다. 일반 대전 승리 기록은 컨트롤러 클래스명으로 브라우저 `localStorage`의 `puyow_store.clearList`와 현재 AI 난이도에 해당하는 `clearListByDifficulty` 배열에 저장됩니다. 해금 판정은 `clearListByDifficulty`만 사용하므로, 이미 배포한 적 클래스의 이름을 바꾸면 기존 난이도별 잠금 해제 기록과 호환되지 않습니다.

## 게임 화면 테마

선택된 적의 컨트롤러는 게임 시작 시 세 가지 테마 메서드를 재정의할 수 있습니다. 세 메서드 모두 재정의하지 않으면 기존의 청록색 베젤, 사용자 필드 배경, 중앙 영역 배경이 그대로 그려집니다.

- `drawBezelBackground(drawingContext, area)`: 양쪽 필드를 감싸는 베젤 테두리. `area`에는 `x`, `y`, `width`, `height`, `player`가 있습니다.
- `drawPlayerBackground(drawingContext, area)`: 각 사용자 필드의 뒷배경. `area`에는 `x`, `y`, `width`, `height`, `player`가 있습니다.
- `drawCenterBackground(drawingContext, area)`: 다음 뿌요, 초상화, 점수 뒤의 중앙 영역. `area`에는 `x`, `y`, `width`, `height`가 있습니다.

```js
class NightEnemy extends WebPuyo.Enemy {
	drawBezelBackground(drawingContext, area) {
		drawingContext.fillStyle = '#2b193d';
		drawingContext.fillRect(area.x, area.y, area.width, area.height);
	}

	drawPlayerBackground(drawingContext, area) {
		drawingContext.fillStyle = '#171226';
		drawingContext.fillRect(area.x, area.y, area.width, area.height);
	}

	drawCenterBackground(drawingContext, area) {
		drawingContext.fillStyle = '#100d1a';
		drawingContext.fillRect(area.x, area.y, area.width, area.height);
	}
}
```

## 알고리즘 작성 방법

CPU 한 차례를 시작할 때 게임은 `prepareTurn(player)`, `chooseTarget(player)`, `chooseRotate(player)` 순서로 목표를 결정합니다. 그 뒤 조작 단계 동안 `useFastDown(player)`을 매 프레임 호출해 빠른 하강 시점을 확인합니다. `prepareTurn()`은 위치와 회전별 가상 착지 결과 및 예상 공격력을 `player.aiSimulations`에 준비합니다. 하위 클래스가 재정의할 때는 `super.prepareTurn(player)`을 먼저 호출해 기본 후보 생성을 유지해야 합니다. 그 다음 선택 메서드는 같은 후보 목록을 읽어 서로 일관된 목표 열과 회전을 반환할 수 있습니다.

`chooseTarget(player)`에서는 현재 CPU 필드를 읽고, 이번 뿌요 쌍을 어느 열에 둘지 결정합니다. `chooseRotate(player)`는 목표 회전값을 반환합니다. 기본값은 세로 상태인 `0`이며, `1`은 오른쪽, `2`는 아래, `3`은 왼쪽입니다.

`useFastDown(player)`은 목표 열과 회전이 결정된 뒤 AI가 아래 방향키를 눌러 이번 뿌요 쌍을 빠르게 내릴지 결정합니다. 기본 `Enemy` 구현은 선택된 AI 난이도에 따라 동작합니다. `쉬움`은 빠른 하강을 사용하지 않고, `보통`은 목표 결정 2,000ms 뒤, `어려움`은 500ms 뒤에도 조작 중일 때 빠르게 하강합니다. 기본 제공되는 안드로말리우스와 단탈리온도 이 정책을 그대로 따릅니다. 사용자 정의 AI가 자체 정책을 사용하려면 이 메서드를 재정의하고, 기본 정책을 일부 유지하려면 `super.useFastDown(player)`를 호출합니다.

`WebPuyo.getSelectedDifficulty()`는 현재 선택되어 게임에 적용되는 AI 난이도를 조회합니다. 게임 시작 전에는 적 선택 화면의 현재 선택을, 게임 중에는 시작할 때 확정된 선택을 반환합니다. 반환 객체의 `key`는 `'easy'`, `'normal'`, `'hard'` 중 하나이고, `name`은 표시명, `fastDownDelay`는 빠른 하강 대기 시간(ms)이며 쉬움에서는 `null`입니다.

```js
const difficulty = WebPuyo.getSelectedDifficulty();
if (difficulty.key === 'hard') {
	// 어려움 AI에 맞춘 별도 판단
}
```

빠른 하강 대기 시간은 `AI_FAST_DOWN_DELAY_EASY`(사용하지 않음), `AI_FAST_DOWN_DELAY_NORMAL`(2,000ms), `AI_FAST_DOWN_DELAY_HARD`(500ms)로 난이도별 관리됩니다. 게임 외부에서 이 값을 직접 바꾸는 대신 `getSelectedDifficulty()`의 `fastDownDelay`를 사용해 현재 정책을 확인할 수 있습니다.

`WebPuyo.getSelectedColorCount()`는 게임에 적용할 일반 뿌요 색상 수를 `3`, `4`, `5` 중 하나로 반환합니다. 게임 시작 전에는 적 선택 화면의 현재 선택을, 게임 중에는 시작할 때 확정된 선택을 반환하므로 색상 수에 맞춘 AI 후보 생성을 구현할 때 사용할 수 있습니다.

```js
const colorCount = WebPuyo.getSelectedColorCount();
const difficultyColors = player.colors.slice(0, colorCount);
```

- `player.board[y][x]`에는 해당 칸의 색상 문자열 또는 빈 칸의 `null`이 있습니다.
- 좌표는 왼쪽 아래가 `(0, 0)`입니다. `x`는 `0`부터 `5`, `y`는 `0`부터 `16`입니다. `y=0`부터 `11`은 화면에 보이는 12줄이고, `y=12`는 조작 뿌요가 생성되는 기존 숨김 행이며, `y=13`부터 `16`은 방해뿌요 생성 전용의 추가 숨김 행입니다.
- 현재 떨어지는 쌍은 `player.active`에 있고, 색상은 `player.active.colors` 배열에 있습니다.
- `player.aiSimulations`의 각 항목에는 `x`, `rotation`, `positions`, `attack`이 있습니다. `positions`는 실제 착지 좌표이고 `attack`은 해당 배치의 예상 공격력입니다.
- 기본 `prepareTurn()`은 현재 보드에서 실제로 착지할 수 있는 후보만 목록에 넣습니다. 따라서 AI는 존재하지 않는 후보를 별도로 걸러낼 필요가 없습니다.
- 반환값은 `0`부터 `5` 사이의 목표 X 좌표여야 합니다.
- 회전값은 `0`부터 `3` 사이여야 하며, 게임 루프는 회전과 수평 이동을 모두 수행합니다.

예상 공격력이 가장 높은 배치의 열과 회전을 함께 선택하는 예시는 다음과 같습니다.

```js
class AttackEnemy extends WebPuyo.Enemy {
	prepareTurn(player) {
		super.prepareTurn(player);
		this.bestMove = player.aiSimulations.reduce(
			(best, candidate) => candidate.attack >= best.attack ? candidate : best,
			{ x: 5, rotation: 0, attack: -1 }
		);
	}

	chooseTarget(player) {
		return this.bestMove.x;
	}

	chooseRotate(player) {
		return this.bestMove.rotation;
	}
}
```

간단한 알고리즘은 각 열의 높이를 구한 뒤, 가장 낮은 열을 선택하는 방식입니다.

```js
class LowestColumnEnemy extends WebPuyo.Enemy {
	/**
	 * 가장 낮은 열을 찾아 뿌요를 쌓는다.
	 * @param {PlayerState} player 자동 조작할 플레이어
	 * @returns {number} 목표 X 좌표
	 */
	chooseTarget(player) {
		let bestColumn = 0;
		let lowestHeight = ROWS;

		for (let x = 0; x < COLUMNS; x += 1) {
			let height = 0;
			while (height < ROWS && player.board[height][x]) height += 1;
			if (height < lowestHeight) {
				lowestHeight = height;
				bestColumn = x;
			}
		}
		return bestColumn;
	}
}
```

더 강한 AI를 만들려면 `player.aiSimulations`의 후보마다 예상 공격력, 같은 색의 인접 수, 필드 높이, 방해뿌요 위험을 점수화해 가장 높은 후보를 선택하면 됩니다. 후보에 없는 열·회전 조합은 현재 보드에서 실제로 착지할 수 없는 조합입니다.

## 사운드 풀 설정

`WebPuyo.SoundPool`은 적의 주문 효과음과 적 전용 배경음악 URL을 담는 클래스입니다. `Enemy`를 상속한 클래스의 생성자에서 `super()`를 호출하면 `this.soundPool`이 자동으로 만들어지므로, 필요한 항목에 상대경로 또는 절대경로 URL을 대입하면 됩니다. URL을 `null`(기본값)로 두면 해당 소리는 재생하지 않습니다.

```js
class MyEnemy extends WebPuyo.Enemy {
    constructor() {
        super();
        this.soundPool.spellCombo1 = 'sounds/my-combo-1.ogg';
        this.soundPool.spellCombo7 = 'https://example.com/my-combo-7.ogg';
        this.soundPool.backgroundMusic = 'sounds/my-bgm.ogg';
    }
}
```

`WebPuyo.commonSoundPool`은 플레이어 주문 효과음, 양쪽 공통 뿌요 폭발 효과음, 공통 배경음악을 담는 `CommonSoundPool` 객체입니다. `initialize()` 호출 전이나 후에 URL을 설정할 수 있습니다.

```js
WebPuyo.commonSoundPool.spellCombo1 = 'sounds/player-combo-1.ogg';
WebPuyo.commonSoundPool.puyoBurstCombo1 = 'sounds/puyo-burst-1.ogg';
WebPuyo.commonSoundPool.backgroundMusic = 'sounds/common-bgm.ogg';
```

연쇄 번호가 7 이상이면 `spellCombo7` 또는 `puyoBurstCombo7`을 사용합니다. 적의 배경음악이 `null`일 때만 공통 배경음악을 대신 사용하며, 게임이 끝나면 배경음악은 자동으로 중지됩니다. 설정 화면의 배경음악·효과음 음량과 메인 화면의 음소거 상태가 모든 재생에 적용되고, 재생 오류는 `console.error`로 기록한 뒤 게임은 계속 진행됩니다.

## 현재 필드 정보 읽기

`getMyFieldInfo(player)`은 CPU 자신의 필드 배치 현황을 새 JSON 객체로 반환합니다. 반환값은 `{ columns, rows, cells }` 형식이며, `cells[y][x]`에는 색상 문자열, 방해뿌요의 `'garbage'`, 또는 빈 칸의 `null`이 들어 있습니다. `y`의 `0`행은 필드 맨 아래입니다. 반환된 `cells`는 복사본이므로 값을 바꾸어도 실제 게임 필드는 바뀌지 않습니다.

이 메서드는 주로 `chooseTarget()`에서 현재 필드 높이, 색상 연결, 방해뿌요 위치를 판단할 때 사용합니다.

```js
class FieldAwareEnemy extends WebPuyo.Enemy {
	chooseTarget(player) {
		const field = this.getMyFieldInfo(player);
		return field.cells[0][2] === null ? 2 : 3;
	}
}
```

## 예상 공격 계산

AI는 `player.estimateAttack(colors, positions)`으로 특정 두 뿌요를 놓았을 때의 예상 공격 수치를 얻을 수 있습니다. 이 메서드는 현재 보드를 변경하지 않고, 중력, 연쇄, 인접 방해뿌요 제거를 가상으로 적용한 뒤 전체 `ATTACK` 값을 숫자로 반환합니다.

`colors`는 아래 뿌요부터의 색상 두 개이고, `positions`는 각각의 `{ x, y }` 좌표입니다. 좌표는 왼쪽 아래가 `(0, 0)`이며 범위를 벗어나거나 이미 찬 칸을 지정하면 `0`을 반환합니다.

```js
const attack = player.estimateAttack(
	[player.active.colors[0], player.active.colors[1]],
	[{ x: 2, y: 4 }, { x: 2, y: 5 }]
);
```

## 예상 연쇄 계산

`player.estimateCombo(colors, positions)`은 `estimateAttack()`과 동일한 인수를 받고, 가상 배치에서 발생할 전체 연쇄 수를 숫자로 반환합니다. 현재 보드는 변경하지 않으며, 유효하지 않은 색상이나 좌표를 전달하면 `0`을 반환합니다.

```js
const combo = player.estimateCombo(
	[player.active.colors[0], player.active.colors[1]],
	[{ x: 2, y: 4 }, { x: 2, y: 5 }]
);
```
