# Puyo W 사운드 설정

사운드 URL은 적 인스턴스의 전용 풀 또는 게임 전체의 공통 풀에 설정합니다. URL을 `null`로 두면 해당 소리를 재생하지 않습니다.

## 설정 화면의 "사운드 데이터 URL" 로 사운드 적용

해당 URL은 js (JavaScript) 파일을 가리키는 URL이어야 합니다. 
이 JavaScript 코드에서 window.PuyoW.applySoundDataJson 함수를 호출하도록 코딩합니다.


```javascript
// 이 예제의 URL들은 실제로 존재하는 URL이 아닙니다. 실제 URL로 바꾸어 사용하세요.
window.PuyoW.applySoundDataJson({
    common : {
        focusMoves : 'https://puyowsound.com/common/focusMoves.ogg', // 게임 내에서 버튼이나 선택지 커서(포커스) 이동 시 재생
        selects : 'https://puyowsound.com/common/selects.ogg', // 게임 내에서 버튼이나 선택지 선택 시 재생
        cancels : 'https://puyowsound.com/common/cancels.ogg', // 게임 내에서 버튼이나 선택지 취소 시 재생
        gameStarts : 'https://puyowsound.com/common/gameStarts.ogg', // 게임 시작 시 재생
		loose : 'https://puyowsound.com/common/loose.ogg', // 플레이어나 적이 패배 시 재생
        puyoRotate : 'https://puyowsound.com/common/puyoRotate.ogg', // 플레이어나 적이 뿌요를 회전시킬 때 발생
		puyoFall : 'https://puyosound.com/common/puyoFall.ogg', // 뿌요가 다 떨어졌을 때 (바닥 혹은 다른 뿌요에 닿았을 때) 재생
		garbageFallLittle : 'https://puyosound.com/common/garbageFallLittle.ogg', // 방해뿌요가 소량 (1~5개) 떨어졌을 때 재생
		garbageFallLot : 'https://puyosound.com/common/garbageFallLot.ogg',       // 방해뿌요가 대량 (6개 이상) 떨어졌을 때 재생
		combo3SpellEffect : 'https://puyosound.com/common/combo3SpellEffect.ogg', // 3연쇄 공격이 상대에게 도달했을 때 재생 (주문음과 별도)
		combo4SpellEffect : 'https://puyosound.com/common/combo4SpellEffect.ogg', // 4연쇄 공격이 상대에게 도달했을 때 재생 (주문음과 별도)
		combo5SpellEffect : 'https://puyosound.com/common/combo5SpellEffect.ogg', // 5연쇄 공격이 상대에게 도달했을 때 재생 (주문음과 별도)
		combo6SpellEffect : 'https://puyosound.com/common/combo6SpellEffect.ogg', // 6연쇄 이상의 공격이 상대에게 도달했을 때 재생 (주문음과 별도)
		puyoBurstCombo1 : 'https://puyosound.com/common/puyoBurstCombo1.ogg', // 1연쇄째 뿌요 폭발음
		puyoBurstCombo2 : 'https://puyosound.com/common/puyoBurstCombo2.ogg', // 2연쇄째 뿌요 폭발음
		puyoBurstCombo3 : 'https://puyosound.com/common/puyoBurstCombo3.ogg', // 3연쇄째 뿌요 폭발음
		puyoBurstCombo4 : 'https://puyosound.com/common/puyoBurstCombo4.ogg', // 4연쇄째 뿌요 폭발음
		puyoBurstCombo5 : 'https://puyosound.com/common/puyoBurstCombo5.ogg', // 5연쇄째 뿌요 폭발음
		puyoBurstCombo6 : 'https://puyosound.com/common/puyoBurstCombo6.ogg', // 6연쇄째 뿌요 폭발음
		puyoBurstCombo7 : 'https://puyosound.com/common/puyoBurstCombo7.ogg'  // 7연쇄 이상의 뿌요 폭발음
	},
	player : {
		spellCombo1 : 'https://puyosound.com/player/spellCombo1.ogg', // 플레이어의 1연쇄 주문음
		spellCombo2 : 'https://puyosound.com/player/spellCombo2.ogg', // 플레이어의 2연쇄 주문음
		spellCombo3 : 'https://puyosound.com/player/spellCombo3.ogg', // 플레이어의 3연쇄 주문음
		spellCombo4 : 'https://puyosound.com/player/spellCombo4.ogg', // 플레이어의 4연쇄 주문음
		spellCombo5 : 'https://puyosound.com/player/spellCombo5.ogg', // 플레이어의 5연쇄 주문음
		spellCombo6 : 'https://puyosound.com/player/spellCombo6.ogg', // 플레이어의 6연쇄 주문음
		spellCombo7 : 'https://puyosound.com/player/spellCombo7.ogg'  // 플레이어의 7연쇄 주문음
	},
	enemy : {
		spellCombo1 : 'https://puyosound.com/enemy/spellCombo1.ogg', // 적의 1연쇄 주문음 (기본값으로만 사용되며, 개별 적마다 따로 지정되어 있으면 이 지정값은 우선순위가 떨어짐)
		spellCombo2 : 'https://puyosound.com/enemy/spellCombo2.ogg', // 적의 2연쇄 주문음 (기본값으로만 사용되며, 개별 적마다 따로 지정되어 있으면 이 지정값은 우선순위가 떨어짐)
		spellCombo3 : 'https://puyosound.com/enemy/spellCombo3.ogg', // 적의 3연쇄 주문음 (기본값으로만 사용되며, 개별 적마다 따로 지정되어 있으면 이 지정값은 우선순위가 떨어짐)
		spellCombo4 : 'https://puyosound.com/enemy/spellCombo4.ogg', // 적의 4연쇄 주문음 (기본값으로만 사용되며, 개별 적마다 따로 지정되어 있으면 이 지정값은 우선순위가 떨어짐)
		spellCombo5 : 'https://puyosound.com/enemy/spellCombo5.ogg', // 적의 5연쇄 주문음 (기본값으로만 사용되며, 개별 적마다 따로 지정되어 있으면 이 지정값은 우선순위가 떨어짐)
		spellCombo6 : 'https://puyosound.com/enemy/spellCombo6.ogg', // 적의 6연쇄 주문음 (기본값으로만 사용되며, 개별 적마다 따로 지정되어 있으면 이 지정값은 우선순위가 떨어짐)
		spellCombo7 : 'https://puyosound.com/enemy/spellCombo7.ogg'  // 적의 7연쇄 주문음 (기본값으로만 사용되며, 개별 적마다 따로 지정되어 있으면 이 지정값은 우선순위가 떨어짐)
	}
});
```

## `applySoundDataJson()`으로 사운드 데이터 적용

`PuyoW.applySoundDataJson(soundDataJson)`은 사운드 URL 설정을 담은 객체 또는 JSON 문자열을 한 번에 공통 사운드 풀에 적용합니다. `common`에는 메뉴·공통 효과음(게임 시작, 선택, 취소, 포커스 이동, 패배, 착지, 공격 도착, 뿌요 폭발)을, `player`에는 플레이어 주문 효과음(`spellCombo1`~`spellCombo7`)을, `enemy`에는 적 공통 주문 효과음(`spellCombo1`~`spellCombo7`)을 지정합니다. 지정하지 않은 항목은 현재 설정을 유지합니다.

```js
PuyoW.applySoundDataJson({
    common: {
        gameStarts: 'sounds/game-start.ogg',
        selects: 'sounds/menu-select.ogg',
        cancels: 'sounds/menu-cancel.ogg',
        focusMoves: 'sounds/menu-focus.ogg',
        puyoBurstCombo1: 'sounds/puyo-burst-1.ogg'
    },
    player: {
        spellCombo1: 'sounds/player-combo-1.ogg'
    },
    enemy: {
        spellCombo1: 'sounds/enemy-combo-1.ogg'
    }
});
```

## 사운드 풀 종류

`PuyoW.SoundPool`은 주문 효과음과 배경음악 URL을 담는 공통 기반 클래스입니다. `PuyoW.EnemySoundPool`은 적 전용, `PuyoW.CommonSoundPool`은 플레이어와 공통 시스템 전용 풀입니다. `PuyoW.createSoundPool(false)`는 적 전용 풀, `PuyoW.createSoundPool(true)`는 공통 풀을 만듭니다.

공통 사운드 풀 자체를 교체하려면 `PuyoW.setCommonSoundPool(commonSoundPoolObject)`를 호출합니다. 인자는 `PuyoW.CommonSoundPool` 인스턴스여야 하며, `PuyoW.createSoundPool(true)` 또는 `new PuyoW.CommonSoundPool()`으로 만들 수 있습니다. 다른 종류의 사운드 풀이나 일반 객체를 전달하면 `TypeError`가 발생합니다. `initialize()` 호출 전후 언제든 교체할 수 있으며, 교체한 풀의 플레이어 주문 효과음·공통 뿌요 폭발 효과음·공통 배경음악 URL이 이후 재생에 사용됩니다.

```js
const commonSounds = PuyoW.createSoundPool(true);
commonSounds.spellCombo1 = 'sounds/player-combo-1.ogg';
commonSounds.puyoBurstCombo1 = 'sounds/puyo-burst-1.ogg';
commonSounds.backgroundMusic = 'sounds/common-bgm.ogg';
PuyoW.setCommonSoundPool(commonSounds);
```

## 새 적의 사운드 URL 설정

`Enemy`를 상속한 클래스의 생성자에서 `super()`를 호출하면 `this.soundPool`이 자동으로 만들어집니다. 필요한 항목에 상대경로 또는 절대경로 URL을 대입합니다.

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

## 등록된 적의 사운드 URL 변경

이미 등록된 적의 효과음이나 전용 배경음악을 외부 설정 파일에서 바꾸려면 `PuyoW.createSoundPool(false)`로 적 전용의 빈 사운드 풀을 만든 뒤 `PuyoW.setEnemySoundPool()`에 전달합니다. 적 효과음 교체에는 공통 풀을 사용하지 않습니다.

`setEnemySoundPool(enemyClassType, soundPoolObject)`은 등록된 적의 `getClassType()` 반환값으로 대상을 찾습니다. 따라서 적을 먼저 `registerOpponent()`로 등록한 다음 호출해야 합니다. 이후 새로 생성되는 해당 적은 지정한 사운드 풀을 사용하며, 이미 대전 중인 같은 적도 다음 연쇄 효과음부터 새 풀을 사용합니다. 존재하지 않는 유형에는 경고를 남기고, 사운드 풀이 아니거나 빈 유형 문자열이면 오류를 발생시킵니다.

```js
// 기본 적 안드로말리우스의 음원을 프로젝트 설정으로 교체한다.
const andromaliusSounds = PuyoW.createSoundPool(false);
andromaliusSounds.spellCombo1 = 'sounds/andromalius-combo-1.ogg';
andromaliusSounds.spellCombo7 = 'sounds/andromalius-combo-7.ogg';
andromaliusSounds.backgroundMusic = 'sounds/andromalius-bgm.ogg';
PuyoW.setEnemySoundPool('Andromalius', andromaliusSounds);
```

## 공통 사운드 URL 설정

`PuyoW.commonSoundPool`은 플레이어 주문 효과음, 양쪽 공통 뿌요 폭발 효과음, 공통 배경음악을 담는 `CommonSoundPool` 객체입니다. `initialize()` 호출 전이나 후에 URL을 설정할 수 있습니다.

```js
PuyoW.commonSoundPool.spellCombo1 = 'sounds/player-combo-1.ogg';
PuyoW.commonSoundPool.puyoBurstCombo1 = 'sounds/puyo-burst-1.ogg';
PuyoW.commonSoundPool.backgroundMusic = 'sounds/common-bgm.ogg';
```

추가 공통 효과음은 아래 속성으로 설정합니다. `gameStarts`는 카운트다운이 끝나 실제 게임이 시작될 때, `selects`는 일반 버튼·선택지를 클릭하거나 Enter로 실행할 때, `cancels`는 취소·종료를 실행할 때, `focusMoves`는 버튼·선택지 포커스가 이동할 때 재생됩니다. 한 번의 선택 또는 취소 동작에서는 포커스 이동음이 함께 재생되지 않습니다. `loose`는 패배 연출 직전, `puyoFall`은 일반 뿌요가 착지할 때마다 재생하되 마지막 재생 후 0.5초 동안의 요청은 무시합니다. `garbageFallLittle`은 한 번에 1~5개 방해뿌요가 착지할 때마다 재생됩니다. `garbageFallLot`은 한 번에 6개 이상이 착지할 때 재생하며, 이전 재생이 끝나기 전에는 중복 재생하지 않습니다.

`combo3SpellEffect`, `combo4SpellEffect`, `combo5SpellEffect`, `combo6SpellEffect`는 각각 3·4·5·6연쇄 이상 공격 에너지가 상쇄 후 상대 필드에 도착했을 때 사용합니다. 적의 `spellCombo1`~`spellCombo7`이 비어 있으면 `commonEnemySpellCombo1`~`commonEnemySpellCombo7`이 같은 연쇄 번호의 대체 주문음으로 사용됩니다.

## 재생 규칙

연쇄 번호가 7 이상이면 `spellCombo7`, `puyoBurstCombo7`, `commonEnemySpellCombo7`을 사용합니다. 적의 주문음은 전용 항목이 없을 때만 공통 적 주문음으로 대체됩니다. 적의 배경음악이 `null`일 때만 공통 배경음악을 대신 사용하며, 게임이 끝나면 배경음악은 자동으로 중지됩니다. 설정 화면의 배경음악·효과음 음량과 메인 화면의 음소거 상태가 모든 재생에 적용되고, 재생 오류는 `console.error`로 기록한 뒤 게임은 계속 진행됩니다.

---

[개발 안내](../HOWTO.md) · [그래픽](Graphics.md) · [적·AI](Enemy.md) · [뿌요](Puyo.md) · [시뮬레이터·피버](Simulator.md)
