# Puyo W Puyo API

Built-in classes render normal and garbage puyos. Attack preview rows can be extended with subclasses of `WarningPuyo`. The board representation of normal puyos remains strings, preserving compatibility with game state and saved data.

## Built-in normal and garbage puyo classes

`PuyoW.Puyo` is the common base class for normal and garbage puyos. The following built-in classes provide `getName()` and `draw(drawingContext, x, y, cellSize, scale)`. The gallery and game renderer use these same objects.

- Normal puyos: `RedPuyo`, `GreenPuyo`, `YellowPuyo`, `BluePuyo`, `PurplePuyo`
- Garbage puyos: `GarbagePuyo`, `HardGarbagePuyo`
- Simulator-only garbage puyo: `IronPuyo`

`drawingContext` in `draw()` is a 2D canvas context; `x`, `y`, and `cellSize` use logical-coordinate values. Normal slime-style puyos can also receive the optional `scale` and `slimeDetails` values. See [Graphics.en.md](Graphics.en.md) for rendering-coordinate rules.

### Connected puyos and the pop effect

Like the Puyo Puyo series, the game field and the simulator draw same-color normal puyos that touch vertically or horizontally joined by a pinched neck. The neck flows smoothly out of each body outline, but its middle is about half the body diameter, so each puyo keeps a clearly distinct round shape. `Puyo` provides the following methods for this, and the field draws `drawBody()` for every cell, then `drawConnection()` for connected cells, then `drawDetails()` for every cell.

- `isConnectable()`: whether the puyo connects to neighbors of the same type. The default is `false`; only the five built-in normal colors return `true`. Garbage, hard garbage, and iron puyos never connect.
- `drawBody(drawingContext, x, y, cellSize, scale = 1, flash = 0)`: the body. `flash` (0-1) is the opacity of a white overlay painted on the body. The default implementation calls the whole `draw()`, so puyos that do not override it still render as before.
- `drawConnection(drawingContext, x, y, cellSize, direction, flash = 0)`: draws the neck toward the right (`'right'`) or upper (`'up'`) neighbor. Only these two directions are used so that each pair is drawn once.
- `drawDetails(drawingContext, x, y, cellSize, scale = 1, squint = false)`: the highlight and eyes. When `squint` is true, it draws the tightly closed `> <` eyes shown right before popping.

`draw()` of normal puyos still calls `drawBody()` and `drawDetails()` in sequence, so places that draw a single puyo, such as the gallery, NEXT, and the active pair, look unchanged. Falling puyos and the active pair are not connected.

The pop effect keeps the existing effect duration. In the first half, the popping puyos keep their connected shape, flash white 2.5 times, and close their eyes. In the second half, they swell white and burst, scattering same-color droplets (ice shards for hard garbage) that fall with gravity, along with a shock ring and sparkles. Fragments are drawn only inside the visible field.

`IronPuyo` is a completely black metal-ball shape with a surface highlight and eyes. It can be created only in the simulator. It is not part of normal-color explosion groups and is not affected by other explosions. It therefore remains until the simulation ends and does not affect the score.

The type strings in regular-game boards, saved data, and public state remain `'red'`, `'green'`, `'yellow'`, `'blue'`, `'purple'`, `'garbage'`, and `'hardGarbage'`. Simulator state and JSON may additionally use the simulator-only `'iron'`. Existing game logic continues to use these strings and delegates only screen drawing to the corresponding class object's `draw()` method.

## Custom warning-puyo classes

Garbage-puyo preview rows consist of `PuyoW.WarningPuyo` objects. A subclass can change its display name with `getName()`, draw its shape with `draw()`, and, when necessary, adjust horizontal placement of same-type icons with `getDisplayX()`.

Pass a subclass to `PuyoW.registerWarningPuyo()` to register a new unit. Registration must happen before `initialize()`. Registered classes are automatically sorted by descending `static unitCount`.

`PuyoW.common.randomColor(colors)` and `PuyoW.common.getPuyo(type)` return a color identifier and shared Puyo object. There is no standalone 3D renderer; optional effects over the 2D game may read these values without changing them.

The class must meet the following contract:

- `static unitCount`: A positive integer unit value.
- Constructor: Must call `super(ClassName.unitCount, 'unique-type-name')`. The instance's `unitCount` must equal the static value.
- `draw(drawingContext, x, y, cellSize)`: Draws one warning puyo. `x`, `y`, and `cellSize` are the game's logical coordinates and cell size.
- Optionally override `getDisplayX(startX, index, sameTypeIndex)` to change horizontal placement of warning puyos of the same type.

```js
class CrownWarningPuyo extends PuyoW.WarningPuyo {
    static unitCount = 100;

    constructor() {
        super(CrownWarningPuyo.unitCount, 'crown');
    }

    draw(drawingContext, x, y, cellSize) {
        drawingContext.save();
        drawingContext.translate(x + cellSize / 2, y + cellSize / 2);
        drawingContext.fillStyle = '#c98b24';
        drawingContext.beginPath();
        drawingContext.moveTo(-cellSize * 0.35, cellSize * 0.26);
        drawingContext.lineTo(-cellSize * 0.35, -cellSize * 0.26);
        drawingContext.lineTo(0, -cellSize * 0.02);
        drawingContext.lineTo(cellSize * 0.35, -cellSize * 0.26);
        drawingContext.lineTo(cellSize * 0.35, cellSize * 0.26);
        drawingContext.closePath();
        drawingContext.fill();
        drawingContext.restore();
    }
}

PuyoW.registerWarningPuyo(CrownWarningPuyo);
PuyoW.initialize();
```

An error is raised when registering the same class twice, a class that does not inherit from `WarningPuyo`, a class without `draw()`, or an invalid unit value. As before, a preview row displays at most six icons.

---

[Development guide](../HOWTO.en.md) · [Graphics](Graphics.en.md) · [Opponents and AI](Enemy.en.md) · [Simulator and Fever](Simulator.en.md) · [Sound](Sound.en.md)
