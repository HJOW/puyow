# Puyo W 적과 인공지능 개발

새 적은 `Enemy` 하위 클래스를 만들고, 식별자·이름·AI 동작을 구현한 다음 `registerOpponent()`로 등록합니다. 초상화와 게임 테마는 선택 사항이며, 상태 조회와 배치 시뮬레이션 API를 이용하면 더 정교한 AI를 만들 수 있습니다.

권장 개발 순서는 다음과 같습니다.

1. `getName()`과 `getClassType()`을 구현합니다.
2. `chooseTarget()`·`chooseRotate()` 또는 `prepareTurn()`으로 AI를 구현합니다.
3. `registerOpponent()`로 `initialize()` 전에 등록합니다.
4. 필요할 때 초상화, 테마, 사운드를 추가합니다.

## 기본 구조

새 상대는 `PuyoW.Enemy`를 상속하는 클래스로 만듭니다. `getName()`은 비어 있지 않은 화면 표시 이름을 반환해야 합니다. 게임 루프는 적이 결정한 목표 회전값으로 뿌요 쌍을 돌린 뒤, 목표 X 좌표까지 이동시킵니다.

`Enemy`의 생성자는 모든 상대에 공통으로 사용할 기본 상태를 설정합니다. `sortPriority`는 `1`, `hidden`과 `notAvail`은 `false`로 시작하며, `attackSimulationTriggerPosition`은 `{ x: 2, y: 8 }`입니다. 이 좌표에 뿌요가 쌓이면 기본 AI가 일반적인 방향 쌓기보다 공격력 시뮬레이션을 우선하도록 만든 기준점입니다. 상대의 전략에 맞춰 생성자에서 이 좌표를 바꿀 수 있습니다.

## 적 유형 식별자: `getClassType()`

`getClassType()`은 적의 효과음 설정을 식별하는 고유하고 변하지 않는 문자열을 반환합니다. `Enemy`를 상속한 새 적은 반드시 이 메서드를 재정의해야 합니다. 이 클래스의 코드상의 이름을 반환해야 하며, 표시 이름인 `getName()`과 달리 번역하거나 실행 중에 바꾸지 않아야 합니다.

```js
class CustomEnemy extends PuyoW.Enemy {
    constructor() {
        super();
        // 중앙이 이 높이에 도달하면 공격 배치를 찾는다.
        this.attackSimulationTriggerPosition = { x: 2, y: 7 };
    }

    getClassType() {
        return 'CustomEnemy';
    }
}
```

`prepareTurn(player)`의 기본 구현은 현재 놓을 수 있는 모든 열·회전 조합을 검사해 `player.aiSimulations`를 만듭니다. 각 후보에는 목표 `x`, `rotation`, 실제 착지할 `positions`, 해당 배치의 예상 `attack`, 전체 예상 연쇄 수인 `combo`가 들어갑니다. 조작 중인 뿌요가 없으면 빈 배열을 저장합니다. 이 목록을 활용하는 방법은 [알고리즘 작성 방법](#알고리즘-작성-방법)을 참고하세요.

```js
class CenterEnemy extends PuyoW.Enemy {
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
class CenterEnemy extends PuyoW.Enemy {
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

새 적은 별도 JavaScript 파일에서 `PuyoW.registerOpponent()`로 등록합니다. 따라서 새 적을 추가할 때 `puyow.js`를 수정할 필요가 없습니다. 등록 객체에는 `createController` 함수가 반드시 필요하며, 이 함수는 매 호출마다 `Enemy`를 상속한 새 인스턴스를 반환해야 합니다. 적 이름은 별도 `name` 속성이 아니라 `getName()`의 반환값을 사용합니다.

`registerOpponent()`는 등록 시 `createController()`를 한 번 호출해 `sortPriority`, `hidden`, `notAvail`을 읽고 검증합니다. 따라서 이 설정은 생성자에서 설정하고, 등록 뒤에 값을 바꾸지 않아야 합니다. 실제 대전에서도 `createController()`를 다시 호출하므로, 게임별 상태는 컨트롤러 인스턴스 멤버로 유지합니다.

```js
// my-opponent.js
class CenterEnemy extends PuyoW.Enemy {
    getName() {
        return '중앙 수집가';
    }

    chooseTarget(player) {
        return 2;
    }
}

PuyoW.registerOpponent({
    createController: () => new CenterEnemy()
});
```

`my-opponent.js`는 `puyow.js` 다음, `PuyoW.initialize()`를 호출하는 스크립트 전의 순서로 불러와야 합니다. 기본 룰 승리 기록은 컨트롤러 클래스명으로 `puyow_store.clearList`와 현재 AI 난이도의 `clearListByDifficulty` 배열에 저장되고, 피버 룰 승리 기록은 별도 `feverClearListByDifficulty` 배열에 저장됩니다. 이미 배포한 적 클래스의 이름을 바꾸면 기존 난이도별 잠금 해제 기록과 호환되지 않습니다.

## 게임 화면 테마

선택된 적의 컨트롤러는 게임 시작 시 세 가지 테마 메서드를 재정의할 수 있습니다. 세 메서드 모두 재정의하지 않으면 기존의 청록색 베젤, 사용자 필드 배경, 중앙 영역 배경이 그대로 그려집니다.

- `drawBezelBackground(drawingContext, area)`: 양쪽 필드를 감싸는 베젤 테두리. `area`에는 `x`, `y`, `width`, `height`, `player`가 있습니다.
- `drawPlayerBackground(drawingContext, area)`: 각 사용자 필드의 뒷배경. `area`에는 `x`, `y`, `width`, `height`, `player`가 있습니다.
- `drawCenterBackground(drawingContext, area)`: 다음 뿌요, 초상화, 점수 뒤의 중앙 영역. `area`에는 `x`, `y`, `width`, `height`가 있습니다.

피버 룰에서 각 플레이어가 피버 상태가 된 전용 플레이 영역은 적 테마보다 우선해 주황색 뒷배경과 조금 더 붉은 주황색 베젤을 사용합니다. 피버가 아닌 일반 플레이 영역은 적 테마를 그대로 사용합니다. 연속 피버는 플레이 내내 두 필드 모두 이 피버 배경을 사용합니다.

피버 룰과 연속 피버에서 싹쓸이는 황금색 필드 연출과 다음 `TARGET COMBO`의 +2 보너스를 유지하지만, 싹쓸이 자체로는 `ATTACK`이나 에너지 이동 효과를 만들지 않습니다. 같은 배치에서 뿌요를 터뜨려 생긴 일반 연쇄 공격과 그 에너지 이동은 기존처럼 적용됩니다. 게임 종료가 겹치면 황금 연출과 이미 발생한 연쇄 공격의 예고뿌요·방해뿌요 정산을 마친 뒤 결과 화면으로 전환합니다.

```js
class NightEnemy extends PuyoW.Enemy {
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

CPU 한 차례를 시작할 때 게임은 `prepareTurn(player)`, `chooseTarget(player)`, `chooseRotate(player)` 순서로 목표를 결정합니다. 그 뒤 조작 단계 동안 `useFastDown(player)`을 매 프레임 호출해 빠른 하강 시점을 확인합니다. `prepareTurn()`은 위치와 회전별 가상 착지 결과, 예상 공격력, 예상 연쇄 수를 `player.aiSimulations`에 준비합니다. 하위 클래스가 재정의할 때는 `super.prepareTurn(player)`을 먼저 호출해 기본 후보 생성을 유지해야 합니다. 그 다음 선택 메서드는 같은 후보 목록을 읽어 서로 일관된 목표 열과 회전을 반환할 수 있습니다.

`chooseTarget(player)`에서는 현재 CPU 필드를 읽고, 이번 뿌요 쌍을 어느 열에 둘지 결정합니다. `chooseRotate(player)`는 목표 회전값을 반환합니다. 기본값은 세로 상태인 `0`이며, `1`은 오른쪽, `2`는 아래, `3`은 왼쪽입니다. 공격력 시뮬레이션처럼 열과 회전을 함께 골랐다면 `chooseTarget()`에서 선택한 후보를 인스턴스 필드에 보관하고, `chooseRotate()`에서 같은 후보의 `rotation`을 반환해야 합니다.

`useFastDown(player)`은 목표 열과 회전이 결정된 뒤 AI가 아래 방향키를 눌러 이번 뿌요 쌍을 빠르게 내릴지 결정합니다. 기본 `Enemy` 구현은 선택된 AI 난이도에 따라 동작합니다. `쉬움`은 빠른 하강을 사용하지 않고, `보통`은 목표 결정 1,500ms 뒤, `어려움`은 300ms 뒤, `극한`은 즉시 빠르게 하강합니다. 기본 제공되는 안드로말리우스와 단탈리온도 이 정책을 그대로 따릅니다. 사용자 정의 AI가 자체 정책을 사용하려면 이 메서드를 재정의하고, 기본 정책을 일부 유지하려면 `super.useFastDown(player)`를 호출합니다.

각 적은 `normalFastDownDelayRate`와 `dangerFastDownDelayRate`로 이 대기 시간을 조절할 수 있습니다. 둘 다 기본값은 `1`이며, 난이도별 대기 시간에 곱해집니다. 중앙 초상화가 위기 표정이 되는 조건(필드의 절반 이상이 차 있거나 `DAMAGE + 상대 ATTACK`이 30 이상)에서는 `dangerFastDownDelayRate`를, 그 외에는 `normalFastDownDelayRate`를 사용합니다. 예를 들어 일반 상황에는 80%, 위기에는 절반만 기다리려면 생성자에서 다음처럼 설정합니다.

```js
constructor() {
    super();
    this.normalFastDownDelayRate = 0.8;
    this.dangerFastDownDelayRate = 0.5;
}
```

`PuyoW.getSelectedDifficulty()`는 현재 선택되어 게임에 적용되는 AI 난이도를 조회합니다. 게임 시작 전에는 적 선택 화면의 현재 선택을, 게임 중에는 시작할 때 확정된 선택을 반환합니다. 반환 객체의 `key`는 `'easy'`, `'normal'`, `'hard'`, `'extreme'` 중 하나이고, `name`은 표시명, `fastDownDelay`는 빠른 하강 대기 시간(ms)이며 쉬움에서는 `null`입니다.

```js
const difficulty = PuyoW.getSelectedDifficulty();
if (difficulty.key === 'hard') {
    // 어려움 AI에 맞춘 별도 판단
}
```

빠른 하강 대기 시간은 `AI_FAST_DOWN_DELAY_EASY`(사용하지 않음), `AI_FAST_DOWN_DELAY_NORMAL`(1,500ms), `AI_FAST_DOWN_DELAY_HARD`(300ms), `AI_FAST_DOWN_DELAY_EXTREME`(0ms)로 난이도별 관리됩니다. 게임 외부에서 이 값을 직접 바꾸는 대신 `getSelectedDifficulty()`의 `fastDownDelay`를 사용해 현재 정책을 확인할 수 있습니다.

`PuyoW.getSelectedColorCount()`는 게임에 적용할 일반 뿌요 색상 수를 `3`, `4`, `5` 중 하나로 반환합니다. 게임 시작 전에는 적 선택 화면의 현재 선택을, 게임 중에는 시작할 때 확정된 선택을 반환하므로 색상 수에 맞춘 AI 후보 생성을 구현할 때 사용할 수 있습니다.

3D 버전의 AI도 `PuyoW.common.findLandingPlacement()`, `PuyoW.common.estimateCombo()`, `PuyoW.common.estimateAttack()`, `PuyoW.common.findBestPreviewResult()`에 해당하는 보드 계산을 재사용할 수 있습니다. 2D와 동일한 후보 평가 결과를 사용하려면 6x17 보드와 두 색상 배열을 같은 형식으로 전달해야 합니다.

기본 룰 적 선택에서는 3·4·5색을 선택할 수 있습니다. 피버 룰 적 선택도 색상 수와 AI 난이도를 모두 고르지만 4·5색만 선택할 수 있습니다. 메인 메뉴의 `연습`은 3·4·5색 선택 뒤 시작하고, `연속 피버`는 같은 색상 선택 화면에서 4·5색만 고른 뒤 시작합니다. 두 단독 모드의 색상 선택 화면은 방향키·Enter·마우스를 지원하며 ESC 또는 선택지 밖 클릭으로 메인 메뉴에 돌아갑니다.

```js
const colorCount = PuyoW.getSelectedColorCount();
const difficultyColors = player.colors.slice(0, colorCount);
```

- `player.board[y][x]`에는 해당 칸의 색상 문자열 또는 빈 칸의 `null`이 있습니다.
- 좌표는 왼쪽 아래가 `(0, 0)`입니다. `x`는 `0`부터 `5`, `y`는 `0`부터 `16`입니다. `y=0`부터 `11`은 화면에 보이는 12줄이고, `y=12`는 조작 뿌요가 생성되는 기존 숨김 행이며, `y=13`부터 `16`은 방해뿌요 생성 전용의 추가 숨김 행입니다.
- 현재 떨어지는 쌍은 `player.active`에 있고, 색상은 `player.active.colors` 배열에 있습니다.
- `player.aiSimulations`의 각 항목에는 `x`, `rotation`, `positions`, `attack`, `combo`가 있습니다. `positions`는 실제 착지 좌표이고 `attack`은 해당 배치의 예상 공격력이며, `combo`는 그 배치에서 최종적으로 일어날 전체 연쇄 수입니다.
- 기본 `prepareTurn()`은 현재 보드에서 실제로 착지할 수 있는 후보만 목록에 넣습니다. 따라서 AI는 존재하지 않는 후보를 별도로 걸러낼 필요가 없습니다.
- 반환값은 `0`부터 `5` 사이의 목표 X 좌표여야 합니다.
- 회전값은 `0`부터 `3` 사이여야 하며, 게임 루프는 회전과 수평 이동을 모두 수행합니다.

예상 공격력이 가장 높은 배치의 열과 회전을 함께 선택하는 예시는 다음과 같습니다.

```js
class AttackEnemy extends PuyoW.Enemy {
    prepareTurn(player) {
        super.prepareTurn(player);
        this.bestMove = player.aiSimulations.reduce(
            (best, candidate) => candidate.attack >= best.attack ? candidate : best,
            { x: 5, rotation: 0, attack: -1, combo: 0 }
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
class LowestColumnEnemy extends PuyoW.Enemy {
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

## 다음 뿌요 정보 읽기

`PuyoW.getNextPairs()`는 중앙 영역에 표시되는 플레이어와 적의 다음 두 뿌요 쌍을 JSON 직렬화 가능한 복사본으로 반환합니다. 각 쌍의 배열은 아래 뿌요, 위 뿌요 순서입니다. 게임이 아직 생성되지 않은 메뉴 상태에서는 `null`을 반환합니다.

```js
const next = PuyoW.getNextPairs();
if (next) {
    console.log(next.player.name, next.player.nextPairs);
    console.log(next.opponent.name, next.opponent.nextPairs);
}
// 예: { player: { name, nextPairs: [['red', 'blue'], ['green', 'green']] },
//       opponent: { name, nextPairs: [['red', 'blue'], ['green', 'green']] } }
```

반환된 `nextPairs`는 내부 대기열의 복사본이므로 값을 변경해도 실제 게임의 다음 뿌요에는 영향을 주지 않습니다.

## 현재 게임 상태 읽기

`PuyoW.getScreenState()`는 메뉴, 튜토리얼, 대전을 포함해 현재 화면을 `{ screen, playerCanControl }` 형태로 반환합니다. `screen`은 `main_menu`, `opponent_select`, `countdown`, `playing`, `paused`, `ending`, `game_over` 등 현재 표시 화면을 나타내며, `playerCanControl`은 플레이어가 실제로 조작 중인 뿌요 쌍을 움직일 수 있을 때만 `true`입니다. Playwright에서는 화면 전환이나 입력 가능 시점을 기다리는 조건으로 사용할 수 있습니다.

`PuyoW.getGameState()`는 일반 대전과 연습전의 읽기 전용 상태 스냅샷을 반환합니다. 메뉴, 튜토리얼, 초기화 전에는 `null`을 반환합니다. 카운트다운, 진행 중, 일시정지, 종료 연출, 게임 오버 상태도 조회할 수 있습니다. 반환된 객체와 배열은 내부 상태의 복사본이므로 AI나 테스트 코드에서 바꿔도 실제 게임에는 영향을 주지 않습니다.

```js
const screen = PuyoW.getScreenState();
if (screen.playerCanControl) {
    const state = PuyoW.getGameState();
    console.log(state.player.active);
    console.log(state.player.board.puyos);
}
```

`getGameState()`의 최상위에는 `running`, `paused`, `countdown`, `elapsed`, `practice`, `colorCount`, `colors`, `aiDifficulty`, `winner`, `ending`이 있습니다. `player`와 `opponent`에는 다음 정보가 각각 들어 있습니다.

- `isCpu`, `phase`, `point`, `attack`, `damage`, `combo`, `placedPairCount`
- `board.columns`, `board.rows`, `board.visibleRows`, `board.puyos` — 고정된 뿌요를 `{ x, y, color }` 목록으로 반환합니다. 좌표의 원점은 왼쪽 아래입니다.
- `nextPairs`, `warningPuyos`, `active` — `active`는 조작 중인 쌍이 없으면 `null`이며, 있을 때는 `x`, `y`, `rotation`, `colors`, `cells`를 포함합니다.

Playwright에서는 다음처럼 브라우저의 실제 게임 상태를 직접 검증할 수 있습니다.

```js
const state = await page.evaluate(() => window.PuyoW.getGameState());
expect(state).not.toBeNull();
expect(state.player.board.columns).toBe(6);
```

## 현재 필드 정보 읽기

`getMyFieldInfo(player)`은 CPU 자신의 필드 배치 현황을 새 JSON 객체로 반환합니다. 반환값은 `{ columns, rows, cells }` 형식이며, `cells[y][x]`에는 색상 문자열, 방해뿌요의 `'garbage'`, 또는 빈 칸의 `null`이 들어 있습니다. `y`의 `0`행은 필드 맨 아래입니다. 반환된 `cells`는 복사본이므로 값을 바꾸어도 실제 게임 필드는 바뀌지 않습니다.

피버 룰 대응 AI는 다음 메서드로 자신의 피버 상태를 읽을 수 있습니다.

- `isInFever(player)`: 현재 피버 상황이면 `true`를 반환합니다.
- `getMyFeverFieldInfo(player)`: 피버 중인 경우 피버 전용 필드를 `{ columns, rows, cells }` 복사본으로 반환하고, 피버 중이 아니면 `null`을 반환합니다.
- `getMyFeverStatus(player)`: `{ active, gauge, nextTime, targetCombo, leftTime, damage, turn }`을 반환합니다. `leftTime`은 밀리초 단위이고 `damage`는 일반 피해와 분리된 피버 전용 피해이며, 피버 룰이 아닌 게임에서는 `null`입니다.

피버 룰에서 피버 필드를 조작할 때는 솔로몬을 제외한 모든 적이 개별 전략보다 공통 연쇄 최적화 전략을 우선합니다. 엔진은 외부 적이 `super.prepareTurn(player)`를 호출하지 않았더라도 모든 착지 위치와 회전을 다시 시뮬레이션하고, 즉시 패배하지 않는 후보 중 예상 연쇄 수가 가장 큰 배치를 선택합니다. 예상 연쇄 수가 같으면 예상 ATTACK이 큰 후보를 선택합니다. 일반 필드와 연속 피버에서는 각 적의 기존 전략을 그대로 사용합니다.

이 메서드는 주로 `chooseTarget()`에서 현재 필드 높이, 색상 연결, 방해뿌요 위치를 판단할 때 사용합니다.

```js
class FieldAwareEnemy extends PuyoW.Enemy {
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

---

[개발 안내](../HOWTO.md) · [그래픽](Graphics.md) · [뿌요](Puyo.md) · [시뮬레이터·피버](Simulator.md) · [사운드](Sound.md)
