# Puyo W Simulator and Fever Patterns

The simulator lets you test board layouts directly and export them as JSON. Exported data can be used directly as a Fever pattern's `stageData`.

## Using the simulator

Select a palette item in **Simulator** on the main menu and place puyos on the field. Use **Play** to check gravity and chain results, then export a completed layout with **Copy JSON**. **Reset** removes every placement in the left play area. The `Iron Puyo` palette item is a fixed obstacle available only in the simulator. It neither explodes nor is affected by other puyo explosions, and it does not count toward score. The simulator uses the same scoring formula as the game.

An iron puyo uses the color value `'iron'` in simulator JSON. Do not use that value in a Fever pattern's `stageData` or as a normal-game puyo color.

## Adding Fever patterns

You can add Fever patterns used for Fever situations in Fever rules and in Continuous Fever mode. A new Fever turn clears the field, fills it with the layout defined by `FeverStageState`, and supplies the specified next puyo pair. External scripts can create `PuyoW.FeverStageState` objects and register them with `PuyoW.registerFeverStageState()` to add patterns for each target chain. Register them before starting a Fever game.

The `FeverStageState` constructor is `new PuyoW.FeverStageState(stageData, targetCombo, suppliedNextPuyos, difficulty, usingColors)`. The final `usingColors` argument is optional; if omitted, it is automatically populated from the normal colors actually used in the layout and next puyos.

- `stageData`: Layout data in the form `{ puyos: [{ x, y, color }, ...] }`. `x` is 0–5, `y` is 0–16, and `color` is a normal color string or `'garbage'`. You can use the simulator's copied JSON unchanged.
- `targetCombo`: The chain count the pattern must lead to. Continuous Fever currently selects only 5–12, so register patterns in that range.
- `suppliedNextPuyos`: The two color strings supplied immediately after the layout. Continuous Fever considers only patterns matching whether the actual next pair has same or different colors.
- `difficulty`: Numeric metadata recording the pattern difficulty.
- `usingColors`: The normal-color list used by this pattern. Fever first retains only patterns whose list has no more colors than the current 4- or 5-color mode, then checks target chains and next-pair composition.

### Creating `stageData` with the simulator

You do not need to write coordinates and colors manually. Select a palette item in **Simulator**, place puyos on the field, and use **Play** to verify that the chain matches its target. After completing the pattern, click **Copy JSON** to copy a JSON string shaped as `{ "puyos": [...] }` to the clipboard. It is fully compatible with `stageData`, so paste it as shown below.

```js
// Paste the simulator's Copy JSON result unchanged.
const fiveChainStageData = {
    "puyos": [
        // Entries such as { "x": 0, "y": 0, "color": "red" } copied from the simulator
    ]
};

const fiveChainStage = new PuyoW.FeverStageState(
    fiveChainStageData,
    5,
    ['red', 'blue'], // pattern for a different-color next pair
    2,
    ['red', 'blue', 'green']
);

PuyoW.registerFeverStageState(fiveChainStage);
```

Copied JSON contains only fixed puyos placed by clicking the field. It does not include the next puyo pair supplied on a Fever turn, so specify `suppliedNextPuyos` separately for same-color and different-color pair layouts when registering.

If the current color mode includes every color in `usingColors`, the stage layout and supplied puyos retain their original colors. Otherwise, provided the number of `usingColors` does not exceed the current mode, the normal colors in both are converted with a one-to-one, non-duplicating mapping that uses only current-mode colors. `'garbage'` is not converted. Consequently, the color-connection structure matters more than particular color names. Register at least one same-color-pair pattern and one different-color-pair pattern for every target chain so there is a candidate for either next pair.

`registerFeverStageState()` accepts only `FeverStageState` instances; other values raise `TypeError`. Registration does not automatically simulate whether coordinates, colors, and the target chain are valid. Verify a reachable placement and target chain with the simulator or `estimateCombo()` before registering.

## Adding Puzzle Puyo stages

Create a `PuzzlePuyoStage` and register it with `PuyoW.registerPuzzleStage()` to add a stage for Puzzle Puyo mode. Register it before starting the game.

The constructor is `new PuyoW.PuzzlePuyoStage(options)`, and `options` can contain:

- `uid`: A unique stage ID. If omitted, an ID starting with `PZ` is generated. A duplicate registered ID causes `registerPuzzleStage()` to raise `Error` without registering it.
- `stageData`: Initial layout data shaped as `{ puyos: [{ x, y, color }, ...] }`. You can use copied simulator JSON unchanged.
- `suppliedNextPuyos`: A list of next puyo pairs supplied each turn after the initial layout (for example, `[['red', 'blue'], ['green', 'green']]`).
- `turnLimit`: The number of control timings in which the win condition must be achieved. Zero or less means no limit.
- `winConditionType` and `winConditionValue`: The win condition and its target. Condition types are `combo`, `clear`, `multiple`, and `attack`.
- `hint`: Stage hint text.
- `hidden`: If `true`, hides the stage from the stage list.
- `opened`: Whether the stage starts unlocked.

```js
const puzzleStage = new PuyoW.PuzzlePuyoStage({
    uid: 'my-puzzle-01',
    stageData: { "puyos": [{ "x": 2, "y": 0, "color": "red" }] },
    suppliedNextPuyos: [['red', 'red']],
    turnLimit: 3,
    winConditionType: 'combo',
    winConditionValue: 3,
    hint: 'Try making a 3-chain!',
    opened: true
});

PuyoW.registerPuzzleStage(puzzleStage);
```

`registerPuzzleStage()` accepts only `PuzzlePuyoStage` instances; other values raise `TypeError`. A `uid` duplicated from an already registered stage raises `Error` and does not add it to the array. Coordinate and win-condition validity is not automatically checked, so test the layout in the simulator before registering it.

## Score calculation

The score for one explosion step is based on every normal colored puyo exploding simultaneously. Normal garbage and hard garbage are not included in the score-puyo count. (Hard garbage is currently available only in the simulator and may be released under a separate rule in the future.)

```text
Normal puyo count = all normal colored puyos exploding simultaneously
Bonus value = max(1, chain bonus + connection bonus + color bonus)
Hard-garbage multiplier = (hard garbage destroyed in this step * HARD_GARBAGE_SCORE_MULTIPLIER) + 1
Score increase = normal puyo count * hard-garbage multiplier * bonus value * 10
ATTACK increase = (score increase / margin rate) * EXPLOSION_REWARD_MULTIPLIER * time-progress multiplier
```

Do not add connection bonuses separately for each connected group of a color. For a single-color explosion, calculate it once from the total normal puyos removed for that color. When several colors explode together, total each color and calculate it once from the largest count. For example, when four red and five blue puyos explode together, the normal-puyo count is 9, the two-color bonus is 3, and the connection bonus is 2 from the larger blue group of 5.

`HARD_GARBAGE_SCORE_MULTIPLIER` in `src/puyow.js` is currently `2`. Thus, when four normal puyos explode in a 1-chain with a bonus value of 1, destroying one hard garbage produces `4 * (1 * 2 + 1) * 1 * 10 = 120` points; destroying two produces `4 * (2 * 2 + 1) * 1 * 10 = 200` points.

The time-progress multiplier is 1 through 300 seconds of actual game time, doubles every 20 seconds from 320 seconds, and caps at 1024. The game and AI attack estimates apply it; the simulator, which has no time concept, defaults to 1. The game, simulator, and AI share this constant and formula. If you change it, update the expected scores for destroying one and two hard garbage simultaneously in `tests/test01.spec.js` using the same formula.

---

[Development guide](../HOWTO.en.md) · [Graphics](Graphics.en.md) · [Opponents and AI](Enemy.en.md) · [Puyos](Puyo.en.md) · [Sound](Sound.en.md)
