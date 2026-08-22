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

## 라이브러리 개요

`webpuyo.js`는 CommonJS와 브라우저 스크립트 방식 모두에서 사용할 수 있는 라이브러리입니다. `Enemy`는 CPU 조작 알고리즘과 게임 화면 테마를 넣기 위한 기본 클래스입니다. 메인 화면에서 게임 시작을 선택하면 적 선택 화면이 열리며, 외부 파일에서 등록한 상대를 선택해 대전합니다. `sortPriority` 멤버 변수의 기본값은 `1`이며, 작은 값의 적이 적 선택 화면에서 왼쪽에 표시됩니다.

`Enemy`에는 선택 화면 공개 상태를 위한 boolean 멤버 변수도 있습니다. 둘 다 기본값은 `false`입니다.

- `hidden`: `true`이면 적 선택 화면에 표시하지 않습니다.
- `notAvail`: `true`이면 회색의 `추후 출시예정` 카드로만 표시하며, 마우스와 키보드로 선택할 수 없습니다.

일반 대전에서 플레이어가 승리하면 브라우저 `localStorage`의 `puyow_store`에 적 클래스명이 기록됩니다. `hidden` 및 `notAvail`이 아닌 적은 정렬 순서상 바로 이전 적을 한 번 이겨야 선택할 수 있으며, 첫 번째 적은 항상 선택할 수 있습니다. 저장 데이터의 `clearList` 배열은 이 잠금 해제 기록을 보관합니다.

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
const { Enemy, registerOpponent, initialize } = require('./src/webpuyo.js');
```

`initialize(target)`의 `target`에는 canvas 요소나 canvas 요소의 `id` 문자열을 전달할 수 있습니다. 인수를 생략하거나 `null`, `undefined`, 빈 문자열을 전달했을 때 `webpuyo_canvas` canvas가 없으면, 라이브러리는 `body`의 자식으로 새 1280x720 canvas를 만들고 게임을 연결합니다. 지정한 요소가 canvas가 아니거나 존재하지 않으면 오류가 발생합니다.

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

## 기본 구조

새 상대는 `WebPuyo.Enemy`를 상속하는 클래스로 만듭니다. `getName()`은 비어 있지 않은 화면 표시 이름을 반환해야 합니다. 게임 루프는 적이 결정한 목표 회전값으로 뿌요 쌍을 돌린 뒤, 목표 X 좌표까지 이동시킵니다.

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

`my-opponent.js`는 `webpuyo.js` 다음, `WebPuyo.initialize()`를 호출하는 스크립트 전의 순서로 불러와야 합니다. 일반 대전 승리 기록은 컨트롤러 클래스명으로 브라우저 `localStorage`의 `puyow_store.clearList`에 저장되므로, 이미 배포한 적 클래스의 이름을 바꾸면 기존 잠금 해제 기록과 호환되지 않습니다.

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

CPU 한 차례를 시작할 때 게임은 `prepareTurn(player)`, `chooseTarget(player)`, `chooseRotate(player)`, `useFastDown(player)` 순서로 호출합니다. `prepareTurn()`은 위치와 회전별 가상 착지 결과 및 예상 공격력을 `player.aiSimulations`에 준비합니다. 하위 클래스가 재정의할 때는 `super.prepareTurn(player)`을 먼저 호출해 기본 후보 생성을 유지해야 합니다. 그 다음 선택 메서드는 같은 후보 목록을 읽어 서로 일관된 목표 열과 회전을 반환할 수 있습니다.

`chooseTarget(player)`에서는 현재 CPU 필드를 읽고, 이번 뿌요 쌍을 어느 열에 둘지 결정합니다. `chooseRotate(player)`는 목표 회전값을 반환합니다. 기본값은 세로 상태인 `0`이며, `1`은 오른쪽, `2`는 아래, `3`은 왼쪽입니다.

`useFastDown(player)`은 `true`를 반환하면 AI가 이번 뿌요 쌍을 빠르게 내립니다. 기본 구현은 `false`입니다.

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
