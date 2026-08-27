# Puyo W 사운드 설정

사운드 URL은 적 인스턴스의 전용 풀 또는 게임 전체의 공통 풀에 설정합니다. URL을 `null`로 두면 해당 소리를 재생하지 않습니다.

## 사운드 풀 종류

`WebPuyo.SoundPool`은 주문 효과음과 배경음악 URL을 담는 공통 기반 클래스입니다. `WebPuyo.EnemySoundPool`은 적 전용, `WebPuyo.CommonSoundPool`은 플레이어와 공통 시스템 전용 풀입니다. `WebPuyo.createSoundPool(false)`는 적 전용 풀, `WebPuyo.createSoundPool(true)`는 공통 풀을 만듭니다.

## 새 적의 사운드 URL 설정

`Enemy`를 상속한 클래스의 생성자에서 `super()`를 호출하면 `this.soundPool`이 자동으로 만들어집니다. 필요한 항목에 상대경로 또는 절대경로 URL을 대입합니다.

```js
class MyEnemy extends WebPuyo.Enemy {
    constructor() {
        super();
        this.soundPool.spellCombo1 = 'sounds/my-combo-1.ogg';
        this.soundPool.spellCombo7 = 'https://example.com/my-combo-7.ogg';
        this.soundPool.backgroundMusic = 'sounds/my-bgm.ogg';
    }
}
```

## 등록된 적의 사운드 URL 변경

이미 등록된 적의 효과음이나 전용 배경음악을 외부 설정 파일에서 바꾸려면 `WebPuyo.createSoundPool(false)`로 적 전용의 빈 사운드 풀을 만든 뒤 `WebPuyo.setEnemySoundPool()`에 전달합니다. 적 효과음 교체에는 공통 풀을 사용하지 않습니다.

`setEnemySoundPool(enemyClassType, soundPoolObject)`은 등록된 적의 `getClassType()` 반환값으로 대상을 찾습니다. 따라서 적을 먼저 `registerOpponent()`로 등록한 다음 호출해야 합니다. 이후 새로 생성되는 해당 적은 지정한 사운드 풀을 사용하며, 이미 대전 중인 같은 적도 다음 연쇄 효과음부터 새 풀을 사용합니다. 존재하지 않는 유형에는 경고를 남기고, 사운드 풀이 아니거나 빈 유형 문자열이면 오류를 발생시킵니다.

```js
// 기본 적 안드로말리우스의 음원을 프로젝트 설정으로 교체한다.
const andromaliusSounds = WebPuyo.createSoundPool(false);
andromaliusSounds.spellCombo1 = 'sounds/andromalius-combo-1.ogg';
andromaliusSounds.spellCombo7 = 'sounds/andromalius-combo-7.ogg';
andromaliusSounds.backgroundMusic = 'sounds/andromalius-bgm.ogg';
WebPuyo.setEnemySoundPool('Andromalius', andromaliusSounds);
```

## 공통 사운드 URL 설정

`WebPuyo.commonSoundPool`은 플레이어 주문 효과음, 양쪽 공통 뿌요 폭발 효과음, 공통 배경음악을 담는 `CommonSoundPool` 객체입니다. `initialize()` 호출 전이나 후에 URL을 설정할 수 있습니다.

```js
WebPuyo.commonSoundPool.spellCombo1 = 'sounds/player-combo-1.ogg';
WebPuyo.commonSoundPool.puyoBurstCombo1 = 'sounds/puyo-burst-1.ogg';
WebPuyo.commonSoundPool.backgroundMusic = 'sounds/common-bgm.ogg';
```

## 재생 규칙

연쇄 번호가 7 이상이면 `spellCombo7` 또는 `puyoBurstCombo7`을 사용합니다. 적의 배경음악이 `null`일 때만 공통 배경음악을 대신 사용하며, 게임이 끝나면 배경음악은 자동으로 중지됩니다. 설정 화면의 배경음악·효과음 음량과 메인 화면의 음소거 상태가 모든 재생에 적용되고, 재생 오류는 `console.error`로 기록한 뒤 게임은 계속 진행됩니다.

---

[개발 안내](../HOWTO.md) · [그래픽](Graphics.md) · [적·AI](Enemy.md) · [뿌요](Puyo.md) · [시뮬레이터·피버](Simulator.md)
