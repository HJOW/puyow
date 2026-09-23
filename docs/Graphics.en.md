# Puyo W Graphics Coordinate System

The game screen and external renderers use the same logical coordinate system regardless of the actual output resolution. Use the rules below when drawing custom opponent portraits, themes, or puyos.

## Logical coordinates

- The game's logical canvas size is **1280 x 720**.
- The origin, `(0, 0)`, is at the canvas's upper-left. X increases to the right and Y increases downward.
- The logical-coordinate transform is applied to `CanvasRenderingContext2D` before the game is rendered. External renderers should therefore use coordinates, lengths, and line widths based on 1280 x 720 rather than physical pixels.

## Output resolution and graphics settings

The Graphics Settings selection is stored in `puyow_store.settings.graphicsQuality`. Its default is `low`; older saved data without this value is also normalized to `low`. Saving a setting immediately changes the actual canvas `width` and `height` to the values below. The CSS display size and the game's logical coordinate system do not change.

| Value | Display label | Actual canvas output resolution |
| --- | --- | --- |
| `low` | Low | 1280 x 720 |
| `medium` | Medium | 1920 x 1080 |
| `high` | High | 3840 x 2160 |

Graphics quality changes only the canvas output size, not the CSS display size or the in-game logical coordinate system. The library applies a context transform before rendering, so `fillRect`, `fillText`, line widths, and the coordinates and lengths used by custom renderers are all scaled to the actual output resolution. High-resolution output can increase memory use and rendering load, so `low` is recommended for lower-specification devices.

## Output-coordinate conversion API

External code can inspect the current output size and conversion results.

```js
const output = PuyoW.getCanvasOutputSize();
// { graphicsQuality: 'medium', width: 1920, height: 1080, scaleX: 1.5, scaleY: 1.5 }

PuyoW.toCanvasCoordinates(640, 360);
// { x: 960, y: 540 }

PuyoW.toCanvasLength(38);
// 57
```

`PuyoW.applyCanvasCoordinateTransform()` reapplies the current graphics setting's logical-coordinate transform to the 2D context. Call it after external rendering code changes the context coordinate system with `setTransform()`. It is normally applied automatically during game rendering, so you do not need to call it separately.

There is no standalone 3D version. Optional Three.js effects over the 2D game may use the transparent 3D canvas, while game input and the logical coordinate system remain owned by the 2D canvas.

## Screen fit mode and margins

Choose how the game fits into the web page with the functions below **before** calling `PuyoW.initialize()`. Calling them after initialization throws an error (they can be changed again after `destroy()`).

```js
PuyoW.setCanvasFitMode(1);                                    // 0 or 1 (default 1)
PuyoW.setCanvasFitMargin({ top: 60, right: 0, bottom: 90, left: 0 }); // pixels; omitted sides are 0
// PuyoW.setCanvasFitMargin(16);                              // a single number applies to all four sides
PuyoW.initialize('puyow_target');

PuyoW.getCanvasFit();    // { mode: 1, margin: { top: 60, right: 0, bottom: 90, left: 0 } }
PuyoW.getScreenLayout(); // { fitMode, margin, rotated, viewport, canvasRect }
```

| Mode | Behavior |
| --- | --- |
| `0` | The script does not resize anything. The page's HTML and CSS decide the size of the game-root div, and both canvases fill that div. **The game itself does not change screen orientation (no 90-degree portrait rotation)**, and the `Lock landscape orientation` setting has no effect. Without page CSS, the default is `width: 100%; aspect-ratio: 16 / 9`. That default rule has zero specificity (`:where(.div_puyow_root)`), so page CSS can always override it. If the div is not 16:9 the picture is stretched, so keep the ratio in your page. |
| `1` (default) | Fits the 16:9 game into the browser viewport (`window.innerWidth` x `window.innerHeight`) minus the margins. It refits whenever the window is resized or the orientation changes. |

Mode 1 follows these layout rules.

- **Margins**: `top`, `right`, `bottom`, and `left` of `canvasFitMargin` (pixels) are kept empty at the viewport edges. The game-root div takes the size of the remaining area, and its CSS `margin` becomes these margins. Your page HTML can place ads or other content in that space. Margins always refer to the **actual web screen**, whether or not the game is rotated.
- **Fit the shorter side**: when the remaining area is wider than 16:9 (for example 17:9), the game fills 100% of the height and space remains left and right. When it is narrower than 16:9 (for example 4:3), the game fills 100% of the width and space remains above and below. The leftover space is split evenly so the game is centered.
- **Portrait screens**: when the viewport is taller than it is wide and `Lock landscape orientation` is off, the game is rotated 90 degrees clockwise. For a user who turns the device sideways, the same rules appear to apply. The `puyow-portrait` class is added to `body` in this state.
- **Input coordinates**: mouse and touch input are converted back to logical 1280 x 720 coordinates from the on-screen box of the 2D canvas (`getBoundingClientRect()`), so clicks keep working with margins, centering, and rotation.
- Mode 1 writes inline styles: `position`, `box-sizing`, `width`, `height`, and `margin` on the game-root div, and `left`, `top`, `width`, `height`, `transform`, and `transform-origin` on both canvases. Use mode 0 if you want page CSS to control these properties. `destroy()` removes the inline styles it added.

`PuyoW.getScreenLayout()` returns the current fit mode, margins, rotation state, viewport size, and the on-screen box of the 2D canvas (`canvasRect`, CSS pixels). The same values are available through the WebMCP `screen_layout` tool. When `rotated` is true, logical X (0-1280) increases downward from `canvasRect.top`, and logical Y (0-720) increases leftward from the right edge of `canvasRect`.

---

[Development guide](../HOWTO.en.md) · [Opponents and AI](Enemy.en.md) · [Puyos](Puyo.en.md) · [Simulator and Fever](Simulator.en.md) · [Sound](Sound.en.md)
