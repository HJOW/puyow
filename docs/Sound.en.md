# Puyo W Sound Settings

Set sound URLs on an opponent instance's dedicated pool or on the game-wide common pool. Set a URL to `null` to disable that sound.

## Applying sound through the Settings screen's “Sound data URL”

The URL must point to a JavaScript file. That JavaScript should call `window.PuyoW.applySoundDataJson`.

```javascript
// These example URLs do not exist. Replace them with real URLs.
window.PuyoW.applySoundDataJson({
    common: {
        clears: 'https://puyowsound.com/common/clears.ogg', // all-clear effect
        feverEnter: 'https://puyowsound.com/common/feverEnter.ogg', // entering Fever mode
        feverLightOn: 'https://puyowsound.com/common/feverLightOn.ogg', // Fever light turning on
        focusMoves: 'https://puyowsound.com/common/focusMoves.ogg', // moving a button or option cursor
        selects: 'https://puyowsound.com/common/selects.ogg', // selecting a button or option
        cancels: 'https://puyowsound.com/common/cancels.ogg', // cancelling a button or option
        gameStarts: 'https://puyowsound.com/common/gameStarts.ogg', // game start
        loose: 'https://puyowsound.com/common/loose.ogg', // player or opponent defeat
        puyoRotate: 'https://puyowsound.com/common/puyoRotate.ogg', // rotating a puyo pair
        puyoFall: 'https://puyosound.com/common/puyoFall.ogg', // normal puyos landing
        garbageFallLittle: 'https://puyosound.com/common/garbageFallLittle.ogg', // 1–5 garbage puyos landing
        garbageFallLot: 'https://puyosound.com/common/garbageFallLot.ogg', // 6 or more garbage puyos landing
        combo3SpellEffect: 'https://puyosound.com/common/combo3SpellEffect.ogg', // 3-chain attack reaches opponent
        combo4SpellEffect: 'https://puyosound.com/common/combo4SpellEffect.ogg', // 4-chain attack reaches opponent
        combo5SpellEffect: 'https://puyosound.com/common/combo5SpellEffect.ogg', // 5-chain attack reaches opponent
        combo6SpellEffect: 'https://puyosound.com/common/combo6SpellEffect.ogg', // 6+-chain attack reaches opponent
        puyoBurstCombo1: 'https://puyosound.com/common/puyoBurstCombo1.ogg', // first-chain burst
        puyoBurstCombo2: 'https://puyosound.com/common/puyoBurstCombo2.ogg', // second-chain burst
        puyoBurstCombo3: 'https://puyosound.com/common/puyoBurstCombo3.ogg', // third-chain burst
        puyoBurstCombo4: 'https://puyosound.com/common/puyoBurstCombo4.ogg', // fourth-chain burst
        puyoBurstCombo5: 'https://puyosound.com/common/puyoBurstCombo5.ogg', // fifth-chain burst
        puyoBurstCombo6: 'https://puyosound.com/common/puyoBurstCombo6.ogg', // sixth-chain burst
        puyoBurstCombo7: 'https://puyosound.com/common/puyoBurstCombo7.ogg', // seventh-or-higher-chain burst
        backgroundMusic: 'https://puyosound.com/common/backgroundMusic.mp3', // default in-game BGM; overridden by an opponent's BGM
        feverBackgroundMusic: 'https://puyosound.com/common/feverBackgroundMusic.mp3', // Fever BGM
        otherBackgroundMusic: 'https://puyosound.com/common/otherBackgroundMusic.mp3' // non-game BGM, such as menus
    },
    player: {
        spellCombo1: 'https://puyosound.com/player/spellCombo1.ogg', // player's 1-chain spell
        spellCombo2: 'https://puyosound.com/player/spellCombo2.ogg', // player's 2-chain spell
        spellCombo3: 'https://puyosound.com/player/spellCombo3.ogg', // player's 3-chain spell
        spellCombo4: 'https://puyosound.com/player/spellCombo4.ogg', // player's 4-chain spell
        spellCombo5: 'https://puyosound.com/player/spellCombo5.ogg', // player's 5-chain spell
        spellCombo6: 'https://puyosound.com/player/spellCombo6.ogg', // player's 6-chain spell
        spellCombo7: 'https://puyosound.com/player/spellCombo7.ogg' // player's 7+-chain spell
    },
    enemy: {
        spellCombo1: 'https://puyosound.com/enemy/spellCombo1.ogg', // opponent default 1-chain spell
        spellCombo2: 'https://puyosound.com/enemy/spellCombo2.ogg', // opponent default 2-chain spell
        spellCombo3: 'https://puyosound.com/enemy/spellCombo3.ogg', // opponent default 3-chain spell
        spellCombo4: 'https://puyosound.com/enemy/spellCombo4.ogg', // opponent default 4-chain spell
        spellCombo5: 'https://puyosound.com/enemy/spellCombo5.ogg', // opponent default 5-chain spell
        spellCombo6: 'https://puyosound.com/enemy/spellCombo6.ogg', // opponent default 6-chain spell
        spellCombo7: 'https://puyosound.com/enemy/spellCombo7.ogg' // opponent default 7+-chain spell
    }
});
```

## Applying sound data with `applySoundDataJson()`

`PuyoW.applySoundDataJson(soundDataJson)` applies an object or JSON string containing sound URL settings to the common sound pool at once. Specify menu and common effects (game start, selection, cancellation, focus movement, defeat, landing, attack arrival, and puyo bursts) under `common`; player spell effects (`spellCombo1`–`spellCombo7`) under `player`; and common opponent spell effects under `enemy`. Omitted items retain their current settings.

```js
PuyoW.applySoundDataJson({
    common: {
        gameStarts: 'sounds/game-start.ogg',
        selects: 'sounds/menu-select.ogg',
        cancels: 'sounds/menu-cancel.ogg',
        focusMoves: 'sounds/menu-focus.ogg',
        puyoBurstCombo1: 'sounds/puyo-burst-1.ogg'
    },
    player: { spellCombo1: 'sounds/player-combo-1.ogg' },
    enemy: { spellCombo1: 'sounds/enemy-combo-1.ogg' }
});
```

## Sound-pool types

`PuyoW.SoundPool` is the common base class for spell-effect and background-music URLs. `PuyoW.EnemySoundPool` is an opponent-only pool, and `PuyoW.CommonSoundPool` is for the player and common systems. `PuyoW.createSoundPool(false)` creates an opponent-only pool; `PuyoW.createSoundPool(true)` creates a common pool.

To replace the common sound pool itself, call `PuyoW.setCommonSoundPool(commonSoundPoolObject)`. Its argument must be a `PuyoW.CommonSoundPool` instance, created with `PuyoW.createSoundPool(true)` or `new PuyoW.CommonSoundPool()`. Passing another sound-pool type or a plain object raises `TypeError`. You can replace it before or after `initialize()`; the replacement pool's player spells, common puyo-burst effects, and common BGM are used for subsequent playback.

```js
const commonSounds = PuyoW.createSoundPool(true);
commonSounds.spellCombo1 = 'sounds/player-combo-1.ogg';
commonSounds.puyoBurstCombo1 = 'sounds/puyo-burst-1.ogg';
commonSounds.backgroundMusic = 'sounds/common-bgm.ogg';
PuyoW.setCommonSoundPool(commonSounds);
```

## Setting sound URLs for a new opponent

Calling `super()` in the constructor of a class that inherits `Enemy` automatically creates `this.soundPool`. Assign relative or absolute URL values to the needed properties.

```js
class MyEnemy extends PuyoW.Enemy {
    constructor() {
        super();
        this.soundPool.spellCombo1 = 'sounds/my-combo-1.ogg';
        this.soundPool.spellCombo7 = 'https://example.com/my-combo-7.ogg';
        this.soundPool.backgroundMusic = 'sounds/my-bgm.ogg';
    }
}
```

## Changing sound URLs for a registered opponent

To change effects or dedicated BGM for an already registered opponent from an external settings file, create an empty opponent-only sound pool with `PuyoW.createSoundPool(false)` and pass it to `PuyoW.setEnemySoundPool()`. Do not use a common pool to replace opponent effects.

`setEnemySoundPool(enemyClassType, soundPoolObject)` finds the target by the registered opponent's `getClassType()` return value. Register the opponent with `registerOpponent()` before calling it. Newly created instances then use the assigned pool, and an instance already in a match uses the new pool from its next chain effect. An unknown type logs a warning; a non-sound-pool value or empty type string raises an error.

```js
// Replace the bundled opponent Andromalius's audio using project settings.
const andromaliusSounds = PuyoW.createSoundPool(false);
andromaliusSounds.spellCombo1 = 'sounds/andromalius-combo-1.ogg';
andromaliusSounds.spellCombo7 = 'sounds/andromalius-combo-7.ogg';
andromaliusSounds.backgroundMusic = 'sounds/andromalius-bgm.ogg';
PuyoW.setEnemySoundPool('Andromalius', andromaliusSounds);
```

## Setting common sound URLs

`PuyoW.commonSoundPool` is a `CommonSoundPool` object containing player spell effects, common puyo-burst effects for both sides, and common BGM. Set URLs before or after `initialize()`.

```js
PuyoW.commonSoundPool.spellCombo1 = 'sounds/player-combo-1.ogg';
PuyoW.commonSoundPool.puyoBurstCombo1 = 'sounds/puyo-burst-1.ogg';
PuyoW.commonSoundPool.backgroundMusic = 'sounds/common-bgm.ogg';
```

Set additional common effects through the properties shown above. `gameStarts` plays when the countdown ends and the game starts; `selects` plays when a normal button or option is clicked or activated with Enter; `cancels` plays on cancellation or exit; and `focusMoves` plays when button or option focus moves. A selection or cancellation action does not also play a focus-move sound. `loose` plays just before the defeat animation. `puyoFall` plays whenever a normal puyo lands, but ignores requests during the 0.5 seconds after the last playback. `garbageFallLittle` plays when 1–5 garbage puyos land at once. `garbageFallLot` plays when six or more land at once and does not overlap an earlier playback.

`combo3SpellEffect`, `combo4SpellEffect`, `combo5SpellEffect`, and `combo6SpellEffect` are used when attack energy from chains of 3, 4, 5, and 6 or more respectively reaches the opponent's field after cancellation. If an opponent's `spellCombo1`–`spellCombo7` is empty, `commonEnemySpellCombo1`–`commonEnemySpellCombo7` supplies the fallback spell sound for that chain number.

## Playback rules

For a chain number of seven or more, the game uses `spellCombo7`, `puyoBurstCombo7`, and `commonEnemySpellCombo7`. An opponent's spell sound falls back to the common opponent spell only when its dedicated item is absent. Common BGM is used only when the opponent's BGM is `null`, and BGM stops automatically when the game ends. The settings screen's BGM/effects volumes and the main screen's mute state apply to all playback. Playback errors are recorded with `console.error` and the game continues.

---

[Development guide](../HOWTO.en.md) · [Graphics](Graphics.en.md) · [Opponents and AI](Enemy.en.md) · [Puyos](Puyo.en.md) · [Simulator and Fever](Simulator.en.md)
