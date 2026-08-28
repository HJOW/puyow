# Puyo W 시뮬레이터와 피버 패턴

시뮬레이터는 필드 배치를 직접 시험하고 JSON으로 내보내는 도구이며, 내보낸 데이터는 피버 패턴의 `stageData`로 바로 사용할 수 있습니다.

## 시뮬레이터 사용

메인 메뉴의 **시뮬레이터**에서 팔레트를 선택해 필드에 뿌요를 배치합니다. **재생**으로 중력과 연쇄 결과를 확인하고, 완성한 배치는 **JSON복사**로 내보냅니다. 팔레트의 `철구뿌요`는 시뮬레이터에서만 사용할 수 있는 고정 장애물입니다. 폭발하거나 다른 뿌요 폭발의 영향을 받지 않으며 점수에도 포함되지 않습니다. 시뮬레이터의 점수 계산은 실제 게임과 같은 식을 사용합니다.

시뮬레이터 JSON에서 철구뿌요의 색상 값은 `'iron'`입니다. 이 값은 피버 패턴의 `stageData`나 일반 게임의 뿌요 색상으로 사용하지 않습니다.

## 피버 패턴 추가

피버 룰의 피버 상황과 연속 피버 모드에서 사용할 피버 패턴을 추가할 수 있습니다. 새 피버 턴에는 필드를 비운 뒤 `FeverStageState`에 정의한 뿌요 배치 패턴을 채우고, 지정된 다음 뿌요 쌍을 제공합니다. 외부 스크립트에서는 `PuyoW.FeverStageState`를 만들고 `PuyoW.registerFeverStageState()`로 등록해 목표 연쇄별 패턴을 추가할 수 있습니다. 피버 게임을 시작하기 전에 등록하는 것을 권장합니다.

`FeverStageState` 생성자는 `new PuyoW.FeverStageState(stageData, targetCombo, suppliedNextPuyos, difficulty, usingColors)` 형식입니다. 마지막 `usingColors`는 생략할 수 있으며, 생략하면 배치와 다음 뿌요에 실제로 쓰인 일반 색상 목록을 자동으로 사용합니다.

- `stageData`: `{ puyos: [{ x, y, color }, ...] }` 형식의 배치 데이터입니다. `x`는 0~5, `y`는 0~16이며 `color`는 일반 색상 문자열 또는 `'garbage'`입니다. 시뮬레이터의 JSON 복사 결과를 그대로 사용할 수 있습니다.
- `targetCombo`: 이 패턴이 유도해야 하는 연쇄 수입니다. 현재 연속 피버는 5~12만 선택하므로 이 범위의 패턴을 등록해야 합니다.
- `suppliedNextPuyos`: 배치 직후 제공할 두 색상 문자열입니다. 연속 피버는 실제 다음 쌍이 동색인지 이색인지에 맞는 패턴만 후보로 사용합니다.
- `difficulty`: 패턴 난이도를 기록하는 숫자 메타데이터입니다.
- `usingColors`: 이 패턴이 쓰는 일반 색상 목록입니다. 피버는 먼저 이 목록의 색상 수가 현재 4·5색 모드의 색상 수 이하인 패턴만 후보로 남긴 뒤 목표 연쇄와 다음 쌍 구성을 검사합니다.

### 시뮬레이터로 `stageData` 만들기

직접 좌표와 색상을 작성할 필요는 없습니다. 메인 메뉴의 **시뮬레이터**에서 팔레트를 선택해 필드에 뿌요를 직접 배치하고, **재생**으로 연쇄가 목표 연쇄 수와 일치하는지 시험합니다. 패턴을 완성한 뒤 **JSON복사**를 누르면 클립보드에 `{ "puyos": [...] }` 형식의 JSON 문자열이 복사됩니다. 이 문자열은 `stageData`와 완전히 호환되므로, 아래처럼 그대로 붙여 넣으면 됩니다.

```js
// 시뮬레이터의 JSON복사 결과를 그대로 붙여 넣는다.
const fiveChainStageData = {
    "puyos": [
        // 시뮬레이터에서 복사한 { "x": 0, "y": 0, "color": "red" } 등의 목록
    ]
};

const fiveChainStage = new PuyoW.FeverStageState(
    fiveChainStageData,
    5,
    ['red', 'blue'], // 이색 다음 쌍을 위한 패턴
    2,
    ['red', 'blue', 'green']
);

PuyoW.registerFeverStageState(fiveChainStage);
```

JSON복사 결과에는 클릭해서 고정한 필드 뿌요만 들어갑니다. 피버 턴에 줄 다음 뿌요 쌍은 포함되지 않으므로, 등록할 때는 동색·이색 구성에 맞춰 `suppliedNextPuyos`를 별도로 지정합니다.

현재 색 모드의 색 목록에 `usingColors`의 모든 색이 들어 있으면 스테이지 배치와 지급 뿌요는 원본 색 그대로 사용합니다. 그렇지 않더라도 `usingColors` 수가 현재 모드보다 많지 않으면, 배치와 지급 뿌요의 일반 색상은 현재 모드 색만 쓰도록 중복 없는 1:1 대응으로 변환합니다. `'garbage'`는 변환 없이 유지됩니다. 따라서 특정 색 이름 자체보다 색의 연결 구조가 중요하며, 각 목표 연쇄에는 동색 쌍용 패턴과 이색 쌍용 패턴을 모두 하나 이상 등록해야 어느 다음 쌍이 나와도 후보를 고를 수 있습니다.

`registerFeverStageState()`는 `FeverStageState` 인스턴스만 받으며 다른 값은 `TypeError`를 발생시킵니다. 좌표, 색상, 목표 연쇄가 실제로 올바른지는 등록 시 자동으로 시뮬레이션하지 않으므로, 시뮬레이터 또는 `estimateCombo()`로 실제 착지 가능한 배치와 목표 연쇄 수를 반드시 검증한 뒤 등록해야 합니다.

## 퍼즐뿌요 스테이지 추가

퍼즐뿌요 모드에 사용할 스테이지는 `PuzzlePuyoStage`를 만든 뒤 `PuyoW.registerPuzzleStage()`로 등록합니다. 게임을 시작하기 전에 등록하는 것을 권장합니다.

`PuzzlePuyoStage` 생성자는 `new PuyoW.PuzzlePuyoStage(options)` 형식이며, `options`에 다음 속성을 지정할 수 있습니다.

- `uid`: 스테이지 고유 ID입니다. 생략하면 `PZ`로 시작하는 ID가 자동으로 생성됩니다. 이미 등록된 스테이지와 같은 ID를 사용하면 `registerPuzzleStage()`가 `Error`를 발생시키며 등록하지 않습니다.
- `stageData`: `{ puyos: [{ x, y, color }, ...] }` 형식의 초기 배치 데이터입니다. 시뮬레이터의 JSON 복사 결과를 그대로 사용할 수 있습니다.
- `suppliedNextPuyos`: 초기 배치가 끝난 뒤 차례마다 제공할 다음 뿌요 쌍의 목록입니다(예: `[['red', 'blue'], ['green', 'green']]`).
- `turnLimit`: 승리 조건을 달성해야 하는 컨트롤 타이밍 수입니다. 0 이하이면 제한이 없습니다.
- `winConditionType`와 `winConditionValue`: 승리 조건과 목표값입니다. 조건 유형은 `combo`, `clear`, `multiple`, `attack` 중 하나입니다.
- `hint`: 스테이지 힌트 문구입니다.
- `hidden`: `true`이면 스테이지 목록에 표시하지 않습니다.
- `opened`: 스테이지가 처음부터 열려 있는지 지정합니다.

```js
const puzzleStage = new PuyoW.PuzzlePuyoStage({
    uid: 'my-puzzle-01',
    stageData: { "puyos": [{ "x": 2, "y": 0, "color": "red" }] },
    suppliedNextPuyos: [['red', 'red']],
    turnLimit: 3,
    winConditionType: 'combo',
    winConditionValue: 3,
    hint: '3연쇄를 만들어 보자!',
    opened: true
});

PuyoW.registerPuzzleStage(puzzleStage);
```

`registerPuzzleStage()`는 `PuzzlePuyoStage` 인스턴스만 받으며, 다른 값을 전달하면 `TypeError`를 발생시킵니다. 또한 기존에 등록된 스테이지와 `uid`가 중복되면 `Error`를 발생시키고 배열에 추가하지 않습니다. 좌표나 승리 조건의 유효성은 자동으로 검증하지 않으므로, 시뮬레이터에서 배치를 시험한 뒤 등록해야 합니다.

## 점수 계산

한 폭발 단계의 점수는 동시에 폭발한 일반 색 뿌요 전체를 기준으로 계산합니다. 일반 방해뿌요와 딱딱뿌요는 점수용 뿌요 수에는 포함하지 않습니다.
(딱딱뿌요는 현재 시뮬레이터 화면에서만 사용 가능하며 추후 별도 룰로 출시 고려 중)

```text
일반 뿌요 수 = 동시에 폭발한 모든 일반 색 뿌요 수
보너스 값 = max(1, 연쇄 보너스 + 연결 보너스 + 색수 보너스)
딱딱뿌요 배율 = (이번에 파괴한 딱딱뿌요 수 * HARD_GARBAGE_SCORE_MULTIPLIER) + 1
점수 증가량 = 일반 뿌요 수 * 딱딱뿌요 배율 * 보너스 값 * 10
ATTACK 증가량 = (점수 증가량 / 마진 레이트) * EXPLOSION_REWARD_MULTIPLIER
```

연결 보너스는 색별 연결 그룹마다 따로 더하지 않고, 같은 폭발 단계에서 사라진 일반 뿌요의 총수로 한 번 계산합니다. 예를 들어 빨강 4개와 파랑 5개가 동시에 폭발하면 일반 뿌요 수는 9개, 색수 보너스는 2색 기준 3, 연결 보너스는 9개 기준 6입니다.

`src/puyow.js`의 `HARD_GARBAGE_SCORE_MULTIPLIER`는 현재 `2`입니다. 따라서 1연쇄에서 보너스 값이 1인 일반 뿌요 4개가 폭발할 때, 딱딱뿌요 1개를 함께 파괴하면 `4 * (1 * 2 + 1) * 1 * 10 = 120`점이고, 2개를 함께 파괴하면 `4 * (2 * 2 + 1) * 1 * 10 = 200`점입니다.

이 상수는 실제 게임, 시뮬레이터, AI의 예상 공격 계산이 공유합니다. 값을 바꾸면 `tests/test01.spec.js`의 딱딱뿌요 1개·2개 동시 파괴 점수 기대값도 같은 식으로 갱신해야 합니다.

### 3D 버전에서 공통 계산 재사용

3D 규칙·표현을 구현할 때도 `PuyoW.common.findExplosionGroupsOnBoard()`, `collapseBoard()`, `simulatePlacementBoard()`, `estimateCombo()`, `estimateAttack()`을 사용할 수 있습니다. 이 함수들은 2D 논리 보드의 복사본을 계산하므로 3D 메시 상태와 분리해 결과만 반영할 수 있습니다.

---

[개발 안내](../HOWTO.md) · [그래픽](Graphics.md) · [적·AI](Enemy.md) · [뿌요](Puyo.md) · [사운드](Sound.md)
