# Puyo W Development Guide

This document is the common developer guide for Puyo W page structure, library initialization, and adding translations. See the document links below for feature-specific API documentation. See [README.md](README.md) for how to play and game rules.

## Documentation guide

- [Graphics.en.md](docs/Graphics.en.md): The 1280 x 720 logical coordinate system, output resolution, and coordinate-conversion API.
- [Puyo.en.md](docs/Puyo.en.md): Normal and garbage-puyo classes, and the custom warning-puyo registration API.
- [Enemy.en.md](docs/Enemy.en.md): Registering opponents, portrait/theme rendering, CPU algorithms, and state-query APIs.
- [Simulator.en.md](docs/Simulator.en.md): Using the simulator, checking scores, and registering Fever patterns.
- [Sound.en.md](docs/Sound.en.md): Common/opponent sound pools and changing audio URLs.

## Player guide

See [README.md](README.md) for the game introduction, controls, and match rules.

## Project structure

- `index.html`: Entry point for the published page.
- `src/puyow.html`: Defines the page structure containing the game canvas and its initialization call.
- `src/puyow.css`: Defines the full-screen canvas layout and font styles.
- `src/puyow.js`: Implements the browser/CommonJS library, game rules, rendering, input, and CPU control.
- `HOWTO.md`: Provides page-structure, library-use, translation, and common development guidance.
- `docs/`: Provides developer documentation for graphics, puyos, opponents/AI, simulator/Fever, and sound.

## CDN

You can also use `puyow.js` from a CDN.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/HJOW/puyow@main/src/puyow.css"/>
<script src='https://cdn.jsdelivr.net/gh/HJOW/puyow@main/src/puyow.js'></script>
```

## Library overview

`puyow.js` is a library usable through both CommonJS and browser-script loading. `Enemy` is the base class for CPU-control algorithms and game-screen themes. Selecting Start Game on the main screen opens opponent selection, where a player can choose an opponent registered from an external file. The default `sortPriority` member value is `1`; lower-valued opponents appear further left on the opponent-selection screen.

`Enemy` also has Boolean members controlling its visibility on the selection screen; both default to `false`.

- `hidden`: When `true`, the opponent is not shown on the selection screen.
- `notAvail`: When `true`, it is shown only as a gray “Coming soon” card and cannot be selected with mouse or keyboard.

When the player wins a regular match, the opponent class name is recorded in browser `localStorage` under `puyow_store`. An opponent that is neither `hidden` nor `notAvail` requires defeating the immediately preceding opponent in sort order once before it becomes selectable; the first opponent is always selectable on Easy, Normal, Hard, and Extreme. Basic rules use the `easy`, `normal`, `hard`, and `extreme` arrays in `clearListByDifficulty`; Fever rules use the corresponding arrays in `feverClearListByDifficulty`, so their unlock progress does not affect one another. `clearList` retains only the all-difficulty victory-opponent list for legacy basic rules.

## Basic initialization

Loading the library alone does not initialize the game. In a browser, explicitly call `PuyoW.initialize()` after loading every opponent-registration script to start menu and input handling.

```html
<script defer src="puyow.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function() {
    window.PuyoW.initialize('webpuyo_canvas');
});
</script>
```

### URL context paths and reserved URL tokens

When deploying the game below a web-application path other than ROOT, call `PuyoW.setURLContextPath()` before initialization to set the URL context path. The default is `'/'`. The value directly replaces `[CTX]` in a URL, so include any required leading and trailing slashes. The 3D version provides `PuyoW3D.setURLContextPath()` and `PuyoW3D.convertURL()` in the same way.

`convertURL(url)` replaces `[CTX]` with the context path and `[LANG]` with the first two characters of the system language in both relative paths and absolute URLs. Supported languages are Korean by default (`ko`) and registered translation-table languages `en`, `ja`, and `zh`; other languages are replaced with `en`.

```js
PuyoW.setURLContextPath('/my-puyo-app/');
PuyoW.setNoticeFile('[CTX]notices/notice_[LANG].txt');
const imageUrl = PuyoW.convertURL('[CTX]assets/logo_[LANG].png');

PuyoW.initialize('webpuyo_canvas');
```

In Node.js CommonJS, load the library as follows. A DOM-free Node.js process cannot call `initialize()`, but can use controller classes and opponent-registration APIs.

```js
const { Enemy, Puyo, RedPuyo, GreenPuyo, YellowPuyo, BluePuyo, PurplePuyo, GarbagePuyo, HardGarbagePuyo, WarningPuyo, registerOpponent, registerWarningPuyo, randomFloat, getCanvasOutputSize, toCanvasCoordinates, toCanvasLength, applyCanvasCoordinateTransform, getSelectedDifficulty, getSelectedColorCount, getScreenState, getGameState, showMessage, initialize } = require('./src/puyow.js');
```

`initialize(target)` accepts a canvas element, a canvas element's `id` string, or a `div` element that will contain a canvas. Passing a `div` creates and attaches the game canvas within it; that canvas is removed by `destroy()`. Passing a canvas uses that element and `destroy()` does not remove it. The canvas's actual `width` and `height` are nevertheless set according to the game's graphics setting. If the argument is omitted, `null`, `undefined`, or an empty string and no `webpuyo_canvas` exists, the library creates a canvas as a child of `body`, attaches the game, and removes it on `destroy()`. An unknown ID or an element that is neither canvas nor div raises an error.

## Runtime display and settings

### Showing a message at the top of the screen

`PuyoW.showMessage(message, color = 'white', duration = 2000, backgroundColor = null)` displays a message at the topmost layer of the current screen. `message` is a required string; `color` is an optional CSS text-color string; `duration` is the time in milliseconds to keep the message before fade-out; and `backgroundColor` is an optional CSS background-color string behind the text. When `backgroundColor` is `null`, the original text-only display is used. Defaults are `'white'`, `2000`, and `null`. The message fades out over 500 ms after its duration; a new message replaces the previous one.

The function does not translate its input and displays the supplied string as-is. Callers needing localization must translate it first.

```js
const message = translateForMyApp('Saved');
PuyoW.showMessage(message);
PuyoW.showMessage(message, '#f7c843', 3000);
PuyoW.showMessage(message, '#ffffff', 3000, '#263238');
```

In browsers supporting WebMCP, AI can invoke the same behavior through the `show_message` tool. Its `message` must already be localized, and `color`, `duration`, and `backgroundColor` default to `'white'`, `2000`, and `null`.

### Setting the notice path

The notice displayed at the left of the main screen is loaded by default from `notice.txt` alongside `puyow.js`. Before initialization, call `PuyoW.setNoticeFile(noticeFile)` to set a file name, relative path, or absolute URL. A relative path is resolved from the URL from which `puyow.js` was loaded; an absolute URL such as `https://` is used unchanged. `[CTX]` and `[LANG]` in the path are replaced according to the `convertURL()` rules. Notice files are displayed as raw UTF-8 text without language translation.

```js
// Use the same file as the default.
PuyoW.setNoticeFile('notice.txt');

// Use notices/notice-ko.txt beside puyow.js.
// [LANG] is replaced with the system language code (ko, en, ...).
PuyoW.setNoticeFile('notices/notice-[LANG].txt');

// Use a notice from another server.
PuyoW.setNoticeFile('https://example.com/puyo/notice.txt');

PuyoW.initialize('webpuyo_canvas');
```

Use `setNoticeFile()` only before `initialize()`. Calling it after initialization raises an error; to change the path, end the game with `destroy()`, set it again, then call `initialize()`.

## Shutdown and cleanup

`PuyoW.destroy()` terminates the game instance started by `initialize()` and restores its pre-initialization state. Call it for page transitions, dynamic UI removal, or reinitializing the game on a different canvas in the same page.

It removes keyboard and canvas-click events, cancels scheduled animation frames, and unregisters WebMCP tools. A `webpuyo_canvas` created directly because `initialize()` could not find the default canvas is removed from the DOM, but a canvas supplied in HTML or passed to `initialize(target)` is not removed.

You can call `initialize()` again after `destroy()`. Calling it before initialization safely does nothing.

```js
PuyoW.initialize('webpuyo_canvas');

// Run before removing the page's game area.
PuyoW.destroy();
```

## Adding display languages

Before initialization, call `PuyoW.registerLanguage(locale, entries)` to add translations for screen text. If the browser language is `ko` or `ko-KR`, Korean source text is used directly. For other languages, the game first looks for the full locale (for example, `ja-JP`), then the base locale (`ja`), and finally the English (`en`) translation table.

Translation keys are the Korean source strings in the game. `%1` and `%2` are placeholders replaced by values supplied at runtime; chain messages use the `%1연쇄` key.

```js
PuyoW.registerLanguage('ja', {
    '게임 시작': 'ゲーム開始',
    '연습': '練習',
    '승리': '勝利',
    '패배': '敗北',
    '%1연쇄': '%1連鎖'
});

PuyoW.initialize();
```

### Mute toggle

The mute button on the main screen is toggled by the internal `toggleMuted()` function. Its state is saved in settings.

## Development support API

### Random number generation

`PuyoW.randomFloat()` returns a floating-point random number greater than or equal to 0 and less than 1. Every random game value—including color selection, garbage-column shuffling, and AI random-turn decisions—is generated through this function. New random behavior must also use `randomFloat()` rather than calling `Math.random()` directly, keeping the random-generation boundary controllable in tests.

```js
const value = PuyoW.randomFloat();
// 0 <= value < 1
const index = Math.floor(value * items.length);
const item = items[index];
```

By default, `randomFloat()` itself calls the browser's `Math.random()`. To reproduce a particular game situation in Playwright, replace `Math.random` with a test function before the game script loads, then initialize the page. Restore the original function or dispose of the test context after the test.

```js
await page.addInitScript(() => {
    Math.random = () => 0.25;
});
await page.goto('/puyow.html');
```

### Shared 2D/3D functions

Rules, board, and scoring utilities that do not depend on the 2D renderer are exposed through `PuyoW.common`. The 3D version can reuse the same calculation results through the namespace below. `PuyoW.getCommonFunctions()` returns the same read-only function collection.

```js
const common = PuyoW.common;
const groups = common.findExplosionGroupsOnBoard(board);
const point = common.calculateExplosionPoint(groups, combo);
const attack = common.calculateExplosionAttack(point);
const combo = common.estimateCombo(board, colors, positions);
```

Common functions include `randomFloat`, `randomColor`, `translate`, `getPuyo`, `activeCells`, `activeRenderCells`, `findLandingPlacement`, `findBestPreviewResult`, `simulateNMovePlacements`, `findBestNMovePlacement`, `findExplosionsOnBoard`, `findExplosionGroupsOnBoard`, `collapseBoard`, `simulatePlacementBoard`, `isAllClearBoard`, `estimateAttack`, `estimateCombo`, `getChainBonus`, `getConnectionBonus`, `getColorBonus`, `getMarginRate`, `getTimeProgressMultiplier`, `calculateExplosionPoint`, `calculateExplosionAttack`, `formatIntegerPoint`, `formatPoint`, and `warningUnits`. `simulateNMovePlacements(player, targetCombo, turnCount)` accepts its target chain count as the second argument and evaluates candidates from the current move through N moves; `findBestNMovePlacement()` returns the best of them. `getTimeProgressMultiplier(elapsed)` returns 1 through 300 seconds, then doubles every 20 seconds up to 1024. Functions accepting boards or arrays do not change their inputs, so 3D can maintain state separately and use only their results.

Some functions assume the 2D game's board format (6 columns and 17 rows) and color strings. Preserve that data contract even when implementing independent 3D rules, and implement screen drawing separately with 3D meshes.

---

[Graphics coordinates](docs/Graphics.en.md) · [Puyo API](docs/Puyo.en.md) · [Opponents and AI](docs/Enemy.en.md) · [Simulator and Fever](docs/Simulator.en.md) · [Sound](docs/Sound.en.md)
