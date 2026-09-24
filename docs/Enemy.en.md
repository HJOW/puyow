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

## Vapula and upcoming ONNX opponents

The built-in `PuyoW.Vapula` and `PuyoW.Oriax` are opponents ordered after Zagan. Both extend `OnnxEnemy` and use the `onnx/model03.onnx` model. Once dedicated models are ready, replace each constructor's `modelPath` independently. Portraits use the existing human-style Canvas design with normal, crisis, and defeated expressions.

Vapula was released in BUILDNO 81: it can be selected after beating Zagan, is excluded from Watch mode candidates like other ONNX opponents, and is included in card acquisition. Oriax is still upcoming with `notAvail = true`, so it appears as a gray coming-soon card in opponent selection and is excluded from selection, Watch mode, and card acquisition. Pages without the ONNX runtime hide both from opponent selection, like other ONNX opponents, and both are registered in the gallery under its existing unlock rules.

BUILDNO 112 adds `Amii`, `Ose`, `Gremory`, `Orobas`, `Murmur`, `Caim`, `Alokes`, `Balaam`, and `Purkas` after Oriax, in that order (`sortPriority` 15–23). All are public `PuyoW` classes extending `OnnxEnemy` directly. They share Oriax's upcoming status, temporary model path, and selection restrictions. They appear in the gallery under its existing unlock rules and are excluded from cards, Watch mode, leaderboard opponent lists, and Python training opponents. Update each constructor's `notAvail` and `modelPath` when releasing that opponent.

Each has normal, crisis, and defeated portraits plus matching field, bezel, and center colors. Names and class identifiers follow the project's spellings. Symbols from the [reference descriptions](https://en.wikipedia.org/wiki/List_of_demons_in_the_Ars_Goetia) are reinterpreted as decorations in the existing single-headed human Canvas style.

| Opponent | Portrait symbols | Theme |
| --- | --- | --- |
| Amii | Flame crest and cape, star book | Copper |
| Ose | Leopard ears and tail, mask, crown | Olive |
| Gremory | Long hair, waist crown, camel-patterned treasure chest | Rose |
| Orobas | Horse ears and mane, horseshoe shield | Steel blue |
| Murmur | Ducal crown, feather wings, trumpet, spirit flame | Sage |
| Caim | Black bird feathers, sword, embers | Gray violet |
| Alokes | Lion mane, star armor, cavalry lance | Brick |
| Balaam | Bear ears, bull and ram crown, hawk crest, serpent tail | Ochre |
| Purkas | White hair and beard, forked spear, philosophy book | Slate |

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

If flat background colors are enough, overriding `getFieldThemeColors()` alone is simpler than the three methods. It returns color strings as `{ bezel, field, center }`, and the default implementations of the three methods use them as they are. The bundled opponents keep `field` (inside the play area) lighter than `bezel`, and `center` (the center area) darkest. The `center` color also fills the screen margins outside the bezels, so changing it changes the backdrop of the whole game screen.

Among the bundled opponents, Solomon and the internal opponent used by Practice, Continuous Fever, Puzzle Puyo, and How to Play keep the default theme; every other bundled opponent has a theme matching its portrait colors. In Watch battles both CPUs are opponents, so both fields and the center area use the right-hand CPU's theme.

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

There is no standalone 3D-game AI. Optional effects over the 2D game or external analysis tools can read the same candidate calculations through `PuyoW.common.findLandingPlacement()`, `estimateCombo()`, `estimateAttack()`, `findBestPreviewResult()`, and `simulateNMovePlacements(player, targetCombo, turnCount)`. In Basic- and Fever-rule matches, including watch mode, `player.nextPairs` keeps 20 predetermined pairs after the current pair; both synchronous N-move search and Worker search use that full queue. The center display and `PuyoW.getNextPairs()` still expose only the first two pairs.

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

`PuyoW.getGameState()` returns a read-only state snapshot for regular, Fever, Continuous Fever, practice, watch, and puzzle matches. It returns `null` for menus, tutorial, and before initialization. It can also be read during countdown, play, pause, ending animation, and game-over states. Returned objects and arrays are copies, so AI or tests cannot alter the actual game by changing them. Learning environments and external enemy AI use this shared snapshot contract instead of a learning-only API.

```js
const screen = PuyoW.getScreenState();
if (screen.playerCanControl) {
    const state = PuyoW.getGameState();
    console.log(state.player.active);
    console.log(state.player.board.puyos);
}
```

`getGameState()` has top-level `mode`, `rule`, `allClearTicketEnabled`, `running`, `paused`, `countdown`, `elapsed`, `practice`, `colorCount`, `colors`, `aiDifficulty`, `winner`, and `ending`. `mode` is one of `versus`, `practice`, `watch`, `continuous_fever`, or `puzzle`; `rule` is one of `standard`, `fever`, `fever_start`, or `continuous_fever`. Both `player` and `opponent` contain:

- `isCpu`, `phase`, `point`, `attack`, `damage`, `combo`, `placedPairCount`
- `board.columns`, `board.rows`, `board.visibleRows`, `board.puyos`: fixed puyos in the current play field as `{ x, y, color }` entries. This is the Fever field while Fever is active; the origin is lower left.
- `normalBoard`: a same-shaped copy of the normal field, retained whether or not Fever is active.
- `fever`: under Fever rules, `{ active, gauge, nextTime, targetCombo, leftTime, damage, turn, field }`; `field.puyos` and compatibility matrix `field.cells` provide the Fever-only field. It is `null` outside Fever rules.
- `allClearTicket`, `nextPairs`, `warningPuyos`, `active`: `nextPairs` always has the first two pairs for enemy AI and learning. `active` is `null` without an active pair; otherwise it contains `x`, `y`, `rotation`, `colors`, and `cells`.

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

## Worker-based N-move search opponents

External opponents that look ahead three or more moves only need to extend the base `PuyoW.Enemy`. Worker-search state (`pendingWorkerSearch`, `workerSearchPlayer`, `workerSearchActive`, `workerSearchDepth`, `workerSearchState`, and `attackPlacement`) already belongs to `Enemy`; do not extend `BundledEnemy`, which is reserved for built-in opponents.

In `prepareTurn()`, call `PuyoW.beginWorkerSearchTurn(this)` to clear the previous request and result, then call normal `super.prepareTurn(player)` to prepare shared Fever and defeat-cell candidates. Call `PuyoW.startWorkerLookaheadSearch(this, player)` only when no shared placement was prepared. Connect target, rotation, and pending-state decisions through the public helpers below to use the Worker result.

```js
class WorkerPlannerEnemy extends PuyoW.Enemy {
    constructor() {
        super();
        this.targetCombo = 7;
        this.lookaheadTurnCount = 3;
        this.lookaheadTimeLimitMs = 50;
        this.ignorableIncomingGarbage = 4;
    }

    getClassType() { return 'WorkerPlannerEnemy'; }
    getName() { return 'Worker Planner'; }

    prepareTurn(player) {
        PuyoW.beginWorkerSearchTurn(this);
        super.prepareTurn(player);
        if (this.getPreparedPlacement()) return;
        PuyoW.startWorkerLookaheadSearch(this, player);
    }

    chooseTarget(player) { return PuyoW.getWorkerSearchTarget(this, player); }
    chooseRotate(player) { return PuyoW.getWorkerSearchRotation(this, player); }
    updateControl(player) { return PuyoW.isWorkerSearchPending(this, player); }
    useFastDown(player) {
        return !PuyoW.isWorkerSearchPending(this, player) && super.useFastDown(player);
    }
}
```

When a pair contacts the floor or another puyo, the engine cancels only that opponent's Worker request. `PuyoW.beginWorkerSearchTurn(this)` also cancels the previous request when the turn changes, so subclasses do not need their own Worker-termination code. To stop a search for another reason, call `PuyoW.cancelPendingWorkerSearch(this, player, reason)`.

`PuyoW.startWorkerLookaheadSearch()` reads `targetCombo`, `lookaheadTurnCount`, `lookaheadTimeLimitMs`, and `ignorableIncomingGarbage`, then calls `PuyoW.common.simulateNMovePlacementsInWorker()`. It applies the best current-pair position and rotation as depths 1, 2, and 3 complete. If no first-move result is available or the Worker fails, it falls back to the existing synchronous one-move search. Normally completed Workers are kept in a global pool of up to two Workers for reuse by the next turn or another Worker opponent in watch mode; cancelled, failed, or timed-out Workers are not reused.

### Advanced search mode and real-time re-planning

Set `lookaheadSearchMode = 'advanced'` on an opponent to make `PuyoW.startWorkerLookaheadSearch()` use the advanced search inside the Worker. Without it, the existing search above is used unchanged. Among the built-in opponents, Andrealphus uses this mode. All of the advanced-search and real-time re-planning logic below lives in `PuyoW.RealtimeLookaheadEnemy`, a common class for built-in opponents; Andrealphus inherits it and only sets its target chain (`targetCombo`) and whether to light lamps with small chains (`lightFeverGaugeWithSmallChains`) via `super({ targetCombo: 5, lightFeverGaugeWithSmallChains: true })`. Flauros and Andras inherit the same class and differ only in their target chains, 6 and 7 respectively. Because this class inherits the built-in-only `BundledEnemy`, external opponents should keep using `PuyoW.Enemy` and the Worker search helpers as in the example above.

- **Fast board computation**: The board is converted to cell-code arrays and column heights. For each placement, the landing position, chain count, ATTACK, and resulting board are the same as the existing rules.
- **Beam search**: Every candidate for the current pair is read, but from the next pair on only the `lookaheadBeamWidth` best candidates by one-move evaluation (default 5) are searched deeper. Candidates that produce the same board, such as a 180-degree rotation of a same-color pair, are skipped.
- **Trigger-point evaluation**: The board score adds the largest chain that would fire if one or two puyos were dropped on top of each column, so unfired chain structures are valued.
- **Garbage arrival forecast**: If the opponent is chaining, the rest of that chain is computed to find how much garbage will arrive and when, and that time is converted to the placement after which it lands. Only attacks sent up to that placement count as offsets, and later moves are read with the remaining garbage placed on the board.
- **Fever rule (normal state)**: Incoming warnings are split into groups by the placement from which they can be offset and the placement after which they land. Offsets, gauge lights, and counterattacks are computed per chain step in the same order as the game, including the minimum attack of 1. Garbage does not fall after a placement that pops, and a path that lights every lamp and enters Fever is not read further. When there are warnings to offset, the current placement prefers (1) the target chain, (2) a counterattack that offsets everything and sends at least one garbage back, then (3) lighting lamps. If the largest attack this placement can send is smaller than the incoming amount, small chains are fired to light lamps only while `lightFeverGaugeWithSmallChains` (default `true`) is on; when it is off, the opponent keeps building its target chain. Lighting lamps is valued higher when fewer colored puyos pop per step. If the opponent is in Fever and has not started a chain yet, its Fever pattern chain is predicted and treated as impossible to offset until it starts. While the opponent itself is in Fever, the existing common Fever rule is used.

To search again when the situation changes mid-control, call `PuyoW.startWorkerLookaheadSearch(this, player, { allowedPlacements, keepDecisionElapsed: true })`. `allowedPlacements` is the list of `{ x, rotation }` reachable from the current position, and the current move is chosen only from it. When `keepDecisionElapsed` is `true`, applying the result does not restart the fast-drop delay. If the new search produces no result, the previous target is kept.

Andrealphus uses this for real-time reactions under the standard rule and the Fever rules (including Fever (Start) and Fever (Relaxed)). During control it checks every frame the incoming garbage amount, whether the opponent is chaining, and the predicted Fever pattern chain of the opponent, and searches again when any of them changes. It does not search again once fast drop has started this turn, or when the incoming amount is below the ignore threshold both before and after the change. The threshold comes from `getLookaheadIgnorableIncomingGarbage(player)`; Andrealphus returns 1 (no threshold) under the Fever rules and `ignorableIncomingGarbage` otherwise. When an opponent defines this method, `startWorkerLookaheadSearch()` passes the same value to the search. It does not search again while the opponent itself is in Fever. Set `realtimeReaction = false` to disable it.

Browser ONNX inference enemies (the `OnnxEnemy` family: Valak, Zagan, Vapula, Oriax) also react in real time from BUILDNO 87. From model version 4 in BUILDNO 90, **the model sees the realtime situation directly.** The observation (1035 values) now carries the opponent's whole field, together with the unsettled attack of the opponent's ongoing chain, how many placements can still be made before it lands, and whether the opponent is chaining. The incoming-damage slot no longer mixes in predictions: it holds settled DAMAGE only. While moving by an inference result, if that state changes the enemy re-runs inference over the placements reachable from its current position. It does not re-infer after fast drop has started, when the amount stays below the threshold (standard rule `ignorableIncomingGarbage` 4, Fever rule 1) both before and after, while the enemy itself is in Fever, or in Continuous Fever. If a re-inference fails or passes the deadline, the previous placement is kept. Set `realtimeReaction = false` to turn it off.

The model-version-4 observation contract is not compatible with version 3. An `.onnx` file exported earlier takes a different input length and cannot be used, so the game checks the input length when it leases a session; on a mismatch it reports once and plays that match with the built-in simulation AI instead.

The forecast functions are also available as common functions.

- `PuyoW.common.predictPlayerChain(player)`: Returns `{ active, currentCombo, remainingCombo, finalCombo, finalAttack, endInMs }` for a chaining player. Chain resolution has no randomness, so the chain count and ATTACK are exact; `endInMs` adds the explosion wait, explosion effect, and gravity animation times.
- `PuyoW.common.getRealtimeGarbageForecast(player, opponent)`: Returns the garbage count `incoming` that `player` will receive and `garbageMoveIndex`, the index of the placement right before it lands (0 is the pair currently under control, -1 when nothing is incoming). Under the Fever rules, when `player` is in the normal state it also returns `fever: { gauge, gaugeMax, events, predictedOpponentFeverChain }`. Each entry of `events` is `{ amount, availableMove, landMove }`: the placement index from which it can be offset and the placement index after which it lands.
- `PuyoW.common.predictFeverStageChain(opponent)`: Assumes an opponent in Fever pops its Fever pattern with the largest chain using the pair under control (or the next pair if needed) and fast-drops immediately, and returns `{ combo, attack, startInMs, endInMs }`. It returns `null` when the pattern cannot be popped or the opponent is not in control.

Tools or experimental opponents that do not use the base class can call the common function directly. Call `cancel()` when its result should no longer be applied; `promise` completes with the final-depth result or fallback result.

```js
const request = PuyoW.common.simulateNMovePlacementsInWorker(
    player, 7, 3, 50,
    {
        onProgress: ({ depth, placement }) => {
            console.log(depth, placement.x, placement.rotation);
        }
    }
);

request.promise.then((result) => {
    if (!result.cancelled && result.placement) {
        console.log(result.depth, result.placement.x, result.placement.rotation);
    }
});
// When the pair has landed or the turn changed: request.cancel('contact');
```

---

[Development guide](../HOWTO.en.md) · [Graphics](Graphics.en.md) · [Puyos](Puyo.en.md) · [Simulator and Fever](Simulator.en.md) · [Sound](Sound.en.md)
