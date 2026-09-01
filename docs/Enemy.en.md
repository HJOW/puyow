# Puyo W Opponent and AI Development

Create a subclass of `Enemy`, implement its identifier, name, and AI behavior, and register it with `registerOpponent()`. Portraits and game themes are optional. State-query and placement-simulation APIs can be used to build more sophisticated AI.

Recommended order:

1. Implement `getName()` and `getClassType()`.
2. Implement AI with `chooseTarget()` / `chooseRotate()` or `prepareTurn()`.
3. Register it with `registerOpponent()` before `initialize()`.
4. Add a portrait, theme, and sound if needed.

## Basic structure

Create new opponents by extending `PuyoW.Enemy`. `getName()` must return a non-empty display name. The game loop rotates the pair to the opponent's target rotation, then moves it to the target X coordinate.

The `Enemy` constructor establishes shared defaults: `sortPriority` is `1`; `hidden` and `notAvail` are `false`; and `attackSimulationTriggerPosition` is `{ x: 2, y: 8 }`. When puyos reach that coordinate, the default AI prioritizes attack simulation over its usual directional stacking. Change that coordinate in the constructor to suit the opponent's strategy.

## Opponent-type identifier: `getClassType()`

`getClassType()` returns the unique, stable string that identifies an opponent's sound settings. Every new `Enemy` subclass must override it. Return the class's code name; unlike `getName()`, it must not be translated or changed at runtime.

```js
class CustomEnemy extends PuyoW.Enemy {
    constructor() {
        super();
        // Look for an attack placement when the center reaches this height.
        this.attackSimulationTriggerPosition = { x: 2, y: 7 };
    }

    getClassType() {
        return 'CustomEnemy';
    }
}
```

The default `prepareTurn(player)` checks every currently placeable column/rotation combination and builds `player.aiSimulations`. Each candidate contains target `x`, `rotation`, actual landing `positions`, predicted `attack`, and total predicted `combo`. It stores an empty array when there is no active pair. See [Writing the algorithm](#writing-the-algorithm) for using this list.

```js
class CenterEnemy extends PuyoW.Enemy {
    /** Returns the opponent name. */
    getName() {
        return 'Center Collector';
    }

    /** @param {PlayerState} player CPU-controlled player @returns {number} target X coordinate */
    chooseTarget(player) {
        return 2;
    }

    /** @param {PlayerState} player CPU-controlled player @returns {number} target rotation: 0 up, 1 right, 2 down, 3 left */
    chooseRotate(player) {
        return 0;
    }

    /** Draws the opponent portrait used on selection and in the center panel. */
    drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
        return super.drawPortrait(drawingContext, centerX, centerY, scale, expression);
    }
}
```

## Drawing opponent portraits

Override `Enemy.drawPortrait(drawingContext, centerX, centerY, scale, expression)` to draw an opponent image on the opponent-selection screen and the in-match center panel. `drawingContext` is a canvas 2D context, `centerX` and `centerY` are the portrait center, and `scale` is relative to the base size. `expression` is `'normal'`, `'crisis'`, or `'defeated'`. The center panel supplies `'crisis'` when the opponent's field is at least half full or `DAMAGE + opponent ATTACK` is at least 30, and `'defeated'` during its defeat animation.

The base `Enemy` method draws nothing, so override it only when a portrait is needed.

```js
class CenterEnemy extends PuyoW.Enemy {
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

## Registering an opponent

Register a new opponent in a separate JavaScript file with `PuyoW.registerOpponent()`, so adding it does not require modifying `puyow.js`. The registration object must supply `createController`, which must return a new `Enemy` subclass instance on every call. The opponent name comes from `getName()`, not from a separate `name` property.

At registration, `registerOpponent()` calls `createController()` once to read and validate `sortPriority`, `hidden`, and `notAvail`. Set those in the constructor and do not change them after registration. It calls `createController()` again for the real match, so per-game state belongs on the controller instance.

```js
// my-opponent.js
class CenterEnemy extends PuyoW.Enemy {
    getName() { return 'Center Collector'; }
    chooseTarget(player) { return 2; }
}

PuyoW.registerOpponent({
    createController: () => new CenterEnemy()
});
```

Load `my-opponent.js` after `puyow.js` and before the script that calls `PuyoW.initialize()`. Basic-rule victories are stored under the controller class name in `puyow_store.clearList` and the current difficulty's `clearListByDifficulty`; Fever victories use the separate `feverClearListByDifficulty`. Renaming a released opponent class breaks compatibility with existing difficulty-specific unlock records.

## Game-screen themes

The selected opponent controller can override three theme methods when a game begins. If none is overridden, the original teal bezel, player-field background, and center-area background are drawn.

- `drawBezelBackground(drawingContext, area)`: Bezel surrounding each field. `area` has `x`, `y`, `width`, `height`, and `player`.
- `drawPlayerBackground(drawingContext, area)`: Background behind each player's field. `area` has `x`, `y`, `width`, `height`, and `player`.
- `drawCenterBackground(drawingContext, area)`: Center area behind next puyos, portrait, and score. `area` has `x`, `y`, `width`, and `height`.

In Fever rules, an individual Fever play area overrides the opponent theme with an orange background and a slightly redder-orange bezel. Non-Fever normal play areas continue to use the opponent theme. Continuous Fever uses these Fever backgrounds for both fields throughout play.

Under Fever rules and Continuous Fever, an all-clear retains the gold-field presentation and the +2 bonus for the next `TARGET COMBO`, but it produces no `ATTACK` or energy-transfer effect itself. Ordinary chain attacks and their energy transfer from popping puyos in the same placement still apply. If game end overlaps, the game completes the gold presentation and settlement of already-created warning and garbage puyos before changing to the result screen.

```js
class NightEnemy extends PuyoW.Enemy {
    drawBezelBackground(context, area) { context.fillStyle = '#2b193d'; context.fillRect(area.x, area.y, area.width, area.height); }
    drawPlayerBackground(context, area) { context.fillStyle = '#171226'; context.fillRect(area.x, area.y, area.width, area.height); }
    drawCenterBackground(context, area) { context.fillStyle = '#100d1a'; context.fillRect(area.x, area.y, area.width, area.height); }
}
```

## Writing the algorithm

At the start of each CPU turn, the game determines its target in the order `prepareTurn(player)`, `chooseTarget(player)`, and `chooseRotate(player)`. During control, it calls `useFastDown(player)` every frame to check when to fast-drop. `prepareTurn()` prepares virtual landing results, predicted attacks, and predicted chain counts by position and rotation in `player.aiSimulations`. A subclass overriding it should call `super.prepareTurn(player)` first so the default candidate generation remains available. The two selection methods can then read the same list and return a consistent column and rotation.

`chooseTarget(player)` reads the CPU field and selects the column for this pair. `chooseRotate(player)` returns a rotation: default vertical `0`, right `1`, down `2`, or left `3`. If an attack simulation chooses column and rotation together, store the selected candidate on the instance in `chooseTarget()` and return its `rotation` in `chooseRotate()`.

`useFastDown(player)` determines whether the AI holds Down to drop the chosen pair quickly. The default `Enemy` implementation uses the selected AI difficulty: Easy never fast-drops; Normal waits 1,500 ms after deciding; Hard waits 300 ms; Extreme fast-drops immediately. Bundled Andromalius and Dantalion retain this policy. Override the method for a custom policy, or call `super.useFastDown(player)` to retain part of the default behavior.

Every opponent can adjust these waits with `normalFastDownDelayRate` and `dangerFastDownDelayRate`; both default to `1` and multiply the difficulty's wait. The danger rate applies when the center portrait would show crisis (field at least half full or `DAMAGE + opponent ATTACK` at least 30), and the normal rate otherwise.

```js
constructor() {
    super();
    this.normalFastDownDelayRate = 0.8;
    this.dangerFastDownDelayRate = 0.5;
}
```

`PuyoW.getSelectedDifficulty()` returns the AI difficulty currently selected for the game. Before play it reports the opponent-selection choice; in a match it reports the choice fixed at game start. Its `key` is `'easy'`, `'normal'`, `'hard'`, or `'extreme'`; `name` is the display name; and `fastDownDelay` is the fast-drop wait in milliseconds (`null` for Easy).

```js
const difficulty = PuyoW.getSelectedDifficulty();
if (difficulty.key === 'hard') {
    // A separate decision tuned for Hard AI.
}
```

Difficulty waits are managed by `AI_FAST_DOWN_DELAY_EASY` (not used), `AI_FAST_DOWN_DELAY_NORMAL` (1,500 ms), `AI_FAST_DOWN_DELAY_HARD` (300 ms), and `AI_FAST_DOWN_DELAY_EXTREME` (0 ms). Rather than changing them from external code, use `getSelectedDifficulty().fastDownDelay` to inspect the current policy.

`PuyoW.getSelectedColorCount()` returns the normal-puyo color count applied to the game: `3`, `4`, or `5`. It reports the current opponent-selection value before the game and the fixed start value during the game, so it is suitable for generating AI candidates by color count.

3D AI can reuse corresponding board calculations from `PuyoW.common.findLandingPlacement()`, `estimateCombo()`, `estimateAttack()`, and `findBestPreviewResult()`. To reuse the current AI's N-move lookahead, call `PuyoW.common.simulateNMovePlacements(player, targetCombo, turnCount)`. `targetCombo` is the second parameter; it gives target-chain foundations a higher evaluation than smaller chains that miss the target. `findBestNMovePlacement()` returns the single highest-scoring result. Pass the same 6x17 board and two-color-array format to obtain the same candidate evaluations as 2D.

Basic-rule opponent selection supports 3, 4, and 5 colors. Fever-rule selection also chooses color count and AI difficulty, but permits only 4 and 5 colors. The main-menu Practice starts after choosing 3, 4, or 5 colors; Continuous Fever uses the same screen but permits only 4 and 5. Both solo-mode color screens support arrows, Enter, and mouse, and return to the main menu on ESC or an outside click.

```js
const colorCount = PuyoW.getSelectedColorCount();
const difficultyColors = player.colors.slice(0, colorCount);
```

- `player.board[y][x]` contains the color string at that cell or `null` for empty.
- The lower-left coordinate is `(0, 0)`. `x` is 0–5 and `y` is 0–16. Rows 0–11 are the 12 visible rows; `y=12` is the original hidden active-puyo spawn row; rows 13–16 are additional hidden rows used only for garbage spawning.
- The falling pair is `player.active`, with colors in `player.active.colors`.
- Each `player.aiSimulations` item contains `x`, `rotation`, `positions`, `attack`, and `combo`. `positions` are actual landing coordinates, `attack` is the placement's predicted attack, and `combo` is its final total chain count.
- Default `prepareTurn()` includes only candidates that can truly land on the current board; AI need not filter impossible candidates separately.
- Return a target X coordinate from 0 through 5.
- Return a rotation from 0 through 3; the game loop performs both rotation and horizontal movement.

This example selects both the column and rotation of the highest predicted attack:

```js
class AttackEnemy extends PuyoW.Enemy {
    prepareTurn(player) {
        super.prepareTurn(player);
        this.bestMove = player.aiSimulations.reduce(
            (best, candidate) => candidate.attack >= best.attack ? candidate : best,
            { x: 5, rotation: 0, attack: -1, combo: 0 }
        );
    }
    chooseTarget(player) { return this.bestMove.x; }
    chooseRotate(player) { return this.bestMove.rotation; }
}
```

A simple algorithm can choose the lowest column:

```js
class LowestColumnEnemy extends PuyoW.Enemy {
    chooseTarget(player) {
        let bestColumn = 0;
        let lowestHeight = ROWS;
        for (let x = 0; x < COLUMNS; x += 1) {
            let height = 0;
            while (height < ROWS && player.board[height][x]) height += 1;
            if (height < lowestHeight) { lowestHeight = height; bestColumn = x; }
        }
        return bestColumn;
    }
}
```

For a stronger AI, score every `player.aiSimulations` candidate by predicted attack, adjacent same-color puyos, field height, and garbage risk, then select the best. A column/rotation absent from the candidates cannot actually land on the current board.

## Reading next-puyo information

`PuyoW.getNextPairs()` returns JSON-serializable copies of the player and opponent's next two pairs shown in the center area. Each pair lists lower then upper puyo. It returns `null` in a menu state before a game exists.

```js
const next = PuyoW.getNextPairs();
if (next) {
    console.log(next.player.name, next.player.nextPairs);
    console.log(next.opponent.name, next.opponent.nextPairs);
}
// { player: { name, nextPairs: [['red', 'blue'], ['green', 'green']] },
//   opponent: { name, nextPairs: [['red', 'blue'], ['green', 'green']] } }
```

The returned `nextPairs` are copies, so changing them does not affect the game's real next puyos.

## Reading current game state

`PuyoW.getScreenState()` returns the current screen, including menus, tutorial, and matches, as `{ screen, playerCanControl }`. `screen` identifies the displayed state such as `main_menu`, `opponent_select`, `countdown`, `playing`, `paused`, `ending`, or `game_over`. `playerCanControl` is `true` only while the player can move an active pair. In Playwright, it can be used to wait for a screen transition or an input-ready moment.

`PuyoW.getGameState()` returns a read-only state snapshot for regular and practice matches. It returns `null` for menus, tutorial, and before initialization. It can also be read during countdown, play, pause, ending animation, and game-over states. Returned objects and arrays are copies, so AI or tests cannot alter the actual game by changing them.

```js
const screen = PuyoW.getScreenState();
if (screen.playerCanControl) {
    const state = PuyoW.getGameState();
    console.log(state.player.active);
    console.log(state.player.board.puyos);
}
```

`getGameState()` has top-level `running`, `paused`, `countdown`, `elapsed`, `practice`, `colorCount`, `colors`, `aiDifficulty`, `winner`, and `ending`. Both `player` and `opponent` contain:

- `isCpu`, `phase`, `point`, `attack`, `damage`, `combo`, `placedPairCount`
- `board.columns`, `board.rows`, `board.visibleRows`, `board.puyos`: fixed puyos as `{ x, y, color }` entries, with the origin at lower left.
- `nextPairs`, `warningPuyos`, `active`: `active` is `null` without an active pair; otherwise it contains `x`, `y`, `rotation`, `colors`, and `cells`.

Playwright can inspect the browser's actual game state directly:

```js
const state = await page.evaluate(() => window.PuyoW.getGameState());
expect(state).not.toBeNull();
expect(state.player.board.columns).toBe(6);
```

## Reading current field information

`getMyFieldInfo(player)` returns a new JSON object describing a CPU's own field: `{ columns, rows, cells }`. `cells[y][x]` is a color string, `'garbage'`, or `null`; row 0 is the bottom. `cells` is a copy, so modifying it does not change the real field.

Fever-aware AI can read its Fever state with:

- `isInFever(player)`: returns `true` in Fever.
- `getMyFeverFieldInfo(player)`: returns the Fever-only field as a `{ columns, rows, cells }` copy in Fever, or `null` otherwise.
- `getMyFeverStatus(player)`: returns `{ active, gauge, nextTime, targetCombo, leftTime, damage, turn }`. `leftTime` is milliseconds; `damage` is Fever-only damage separate from normal damage; it returns `null` outside Fever rules.

When operating the Fever field in Fever rules, all opponents except Solomon prioritize a shared chain-optimization strategy over individual strategies. Even if an external opponent does not call `super.prepareTurn(player)`, the engine re-simulates every landing position and rotation and selects the non-immediate-defeat candidate with the largest predicted chain count, breaking ties by larger predicted ATTACK. Normal fields and Continuous Fever keep each opponent's existing strategy.

Use these methods chiefly in `chooseTarget()` to assess field height, color connections, and garbage locations.

```js
class FieldAwareEnemy extends PuyoW.Enemy {
    chooseTarget(player) {
        const field = this.getMyFieldInfo(player);
        return field.cells[0][2] === null ? 2 : 3;
    }
}
```

## Estimating attack

AI can call `player.estimateAttack(colors, positions)` to obtain the predicted attack for placing a specific pair. It does not modify the current board; it virtually applies gravity, chains, and removal of adjacent garbage, then returns total `ATTACK` as a number.

`colors` holds the lower then upper puyo colors. `positions` contains their `{ x, y }` coordinates. The lower-left coordinate is `(0, 0)`; an out-of-range or occupied cell returns `0`.

```js
const attack = player.estimateAttack(
    [player.active.colors[0], player.active.colors[1]],
    [{ x: 2, y: 4 }, { x: 2, y: 5 }]
);
```

## Estimating chains

`player.estimateCombo(colors, positions)` accepts the same arguments as `estimateAttack()` and returns the total chain count from a virtual placement. It does not modify the current board and returns `0` for invalid colors or coordinates.

```js
const combo = player.estimateCombo(
    [player.active.colors[0], player.active.colors[1]],
    [{ x: 2, y: 4 }, { x: 2, y: 5 }]
);
```

---

[Development guide](../HOWTO.en.md) · [Graphics](Graphics.en.md) · [Puyos](Puyo.en.md) · [Simulator and Fever](Simulator.en.md) · [Sound](Sound.en.md)
