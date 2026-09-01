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

The 3D version uses the same logical coordinates, but uses the rules and coordinate functions in `PuyoW.common` instead of a canvas context. World-coordinate conversion and orthographic-camera projection are handled by the 3D renderer.

---

[Development guide](../HOWTO.en.md) · [Opponents and AI](Enemy.en.md) · [Puyos](Puyo.en.md) · [Simulator and Fever](Simulator.en.md) · [Sound](Sound.en.md)
