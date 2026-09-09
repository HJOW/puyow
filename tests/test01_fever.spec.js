// 피버 룰·피버 룰 (시작)·연속 피버와 그에 딸린 공격·싹쓸이 정산의 회귀 테스트다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu } from './common/gamepage.js';

setupGamePage();

test('연속 피버 선택지는 활성 상태이며 목표 5연쇄와 60초로 피버 스테이지를 시작한다', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.feverEnter = 'sounds/test-fever-enter.ogg';
    window.WebPuyo.commonSoundPool.feverBackgroundMusic = 'sounds/test-continuous-fever-bgm.ogg';
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const texts = window.testCanvasTexts;
    const localizedOptions = [
      ['기본 룰', '피버 룰', '피버 룰 (시작)', '연습', '연속 피버'],
      ['Standard Rules', 'FEVER Rules', 'FEVER Rules (Start)', 'Practice', 'Continuous FEVER'],
      ['基本ルール', 'FEVERルール', 'FEVER ルール (開始)', '練習', '連続FEVER'],
      ['基本规则', 'FEVER规则', 'FEVER 规则（开始）', '练习', '连续FEVER'],
    ];
    return localizedOptions.some((options) => options.every((text) => texts.includes(text)));
  })).toBe(true);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state.continuousFever && state.fever.targetCombo === 5 && state.fever.leftTime === 60000;
  })).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
  const feverState = await page.evaluate(() => window.WebPuyo.getGameState());
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(expect.arrayContaining([
    'sounds/test-fever-enter.ogg', 'sounds/test-continuous-fever-bgm.ogg',
  ]));
  expect(feverState.fever.turn).toBe(1);
  expect(feverState.fever.selectedStageTarget).toBe(5);
  expect(feverState.player.board.puyos.length).toBeGreaterThan(0);
  expect(feverState.player.active.colors).toEqual(feverState.fever.stageSuppliedPair);
  expect(feverState.colors).toEqual(['red', 'green', 'yellow', 'blue', 'purple']);
  expect(await page.evaluate(() => Array.from(document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(210, 120, 1, 1).data))).toEqual([232, 144, 53, 255]);
  expect(await page.evaluate(() => {
    const texts = window.testCanvasTexts;
    return [
      '목표 연쇄', 'TARGET COMBO', '目標連鎖', '目标连锁',
      '남은 시간', 'LEFT TIME', '残り時間', '剩余时间',
    ].every((label) => !texts.includes(label));
  })).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  const pausedTime = await page.evaluate(() => window.WebPuyo.getGameState().fever.leftTime);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().fever.leftTime)).toBe(pausedTime);
});

test('피버·연속 피버에서 새로 지급된 조작 뿌요의 자연 낙하는 1.5배가 아니다', async ({ page }) => {
  async function measureNaturalDrop() {
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
    const before = await page.evaluate(() => window.WebPuyo.getGameState().player.active.y);
    await page.waitForTimeout(512);
    const after = await page.evaluate(() => window.WebPuyo.getGameState().player.active.y);
    return before - after;
  }

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const continuousFeverDrop = await measureNaturalDrop();

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('puyow_store') || '{"clearList":[]}');
    saved.feverClearListByDifficulty = { easy: [], normal: ['Kimaris'], hard: [], extreme: [] };
    localStorage.setItem('puyow_store', JSON.stringify(saved));
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  const feverStartDrop = await measureNaturalDrop();

  for (const drop of [continuousFeverDrop, feverStartDrop]) {
    expect(drop).toBeGreaterThan(0.18);
    expect(drop).toBeLessThan(0.34);
  }
});

test('연속 피버는 두 번째 패배 칸 (3, 11)도 패배로 판정하고 적 결과 상세를 숨긴다', async ({ page }) => {
  await page.evaluate(() => {
    Math.random = () => 0.999999;
    window.WebPuyo.registerFeverStageState(new window.WebPuyo.FeverStageState(
      { puyos: Array.from({ length: 12 }, (unused, y) => ({ x: 3, y, color: 'garbage' })) },
      5,
      ['red', 'red'],
      1,
      ['red'],
    ));
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState().player.board.puyos.some((puyo) => puyo.x === 3 && puyo.y === 11))).toBe(true);

  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 15000 }).toBe('opponent');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('game_over');
  await page.evaluate(() => { window.testCanvasTextCalls = []; });
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.testCanvasTextCalls.some(({ text, x }) => {
    const finalScorePrefixes = ['최종 점수', 'Final score', '最終スコア', '最终得分'];
    const soloModeLabels = ['연속 피버', 'Continuous FEVER', '連続FEVER', '连续FEVER'];
    return x >= 850 && (finalScorePrefixes.some((prefix) => text.startsWith(prefix)) || soloModeLabels.includes(text));
  }))).toBe(false);
});

test('피버 룰은 전용 적 선택 화면에서 4색을 골라 보라색 없이 대전으로 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.feverRule).toBe(true);
  expect(state.continuousFever).toBe(false);
  expect(state.colorCount).toBe(4);
  expect(state.colors).toEqual(['red', 'green', 'yellow', 'blue']);
  expect(state.player.nextPairs.flat()).not.toContain('purple');
  expect(state.player.fever).toMatchObject({ active: false, gauge: 0, nextTime: 15, targetCombo: 5, leftTime: 0, damage: 0 });
  expect(state.opponent.fever).toMatchObject({ active: false, gauge: 0, nextTime: 15, targetCombo: 5, leftTime: 0, damage: 0 });
});

test('피버 룰 (시작)은 키보드·마우스로 선택할 수 있고 양쪽이 즉시 5연쇄·60초 피버로 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const labels = ['피버 룰 (시작)', 'FEVER Rules (Start)', 'FEVER ルール (開始)', 'FEVER 规则（开始）'];
    const color = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(908, 312, 1, 1).data;
    return labels.some((label) => window.testCanvasTexts.includes(label)) && Array.from(color).join(',') === '60,70,80,255';
  })).toBe(true);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 908, y: 312 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('puyow_store') || '{"clearList":[]}');
    saved.feverClearListByDifficulty = { easy: [], normal: [], hard: ['Kimaris'], extreme: [] };
    localStorage.setItem('puyow_store', JSON.stringify(saved));
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const color = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(908, 312, 1, 1).data;
    return Array.from(color).join(',') === '75,31,111,255';
  })).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    const bothInFever = [state?.player, state?.opponent].every((player) => (
      player?.fever?.active && player.fever.targetCombo === 5 && player.fever.leftTime > 55000 && player.fever.leftTime <= 60000
    ));
    return state?.feverStart === true && state.feverRule === true && !state.continuousFever && bothInFever;
  }), { timeout: 15000 }).toBe(true);

  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 908, y: 312 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
});

test('피버 룰은 키보드로 3색을 선택해 초록·노랑·파랑만 사용하는 대전을 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.feverRule).toBe(true);
  expect(state.colorCount).toBe(3);
  expect(state.colors).toEqual(['green', 'yellow', 'blue']);
  expect(state.player.nextPairs.flat().every((color) => state.colors.includes(color))).toBe(true);
});

test('피버 상태의 싹쓸이는 목표 연쇄만 올리고 별도 ATTACK을 보내지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverAllClearEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -1;
        this.hasPreparedAllClear = false;
      }

      getClassType() { return 'FeverAllClearEnemy'; }
      getName() { return '피버 싹쓸이 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.hasPreparedAllClear) return;
        this.hasPreparedAllClear = true;
        // 4개 연결을 터뜨린 뒤 피버 필드를 비운다. 이 폭발은 40점(ATTACK 1 미만)이라
        // 자체 공격은 없으며, DAMAGE가 생긴다면 싹쓸이의 기존 추가 12뿐이다.
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.hasPlacedPuyoSinceAllClear = true;
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverAllClearEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  // 싹쓸이 황금 연출과 모든 에너지 정산이 끝난 뒤에 다음 피버 스테이지가 준비된다.
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.opponent.fever?.targetCombo;
  }), { timeout: 15000 }).toBe(4);
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.opponent.point).toBe(140);
  expect(state.player.damage).toBe(0);
  expect(state.player.warningPuyos).toEqual([]);
});

test('기본 룰의 싹쓸이 티켓은 다음 폭발에서 고정 점수·ATTACK을 적용하고 다시 획득한다', async ({ page }) => {
  await page.evaluate(() => {
    class AllClearTicketEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -2; }
      getClassType() { return 'AllClearTicketEnemy'; }
      getName() { return '싹쓸이 티켓 테스트 적'; }
      prepareTurn(player) { this.player = player; player.fallTimer = -100000; window.allClearTicketEnemy = this; }
      chooseTarget(player) { return player.active.x; }
      chooseRotate(player) { return player.active.rotation; }
      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new AllClearTicketEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.allClearTicketEnemy?.player?.phase), { timeout: 15000 }).toBe('control');

  await page.evaluate(() => {
    const player = window.allClearTicketEnemy.player;
    player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
    for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
    player.hasPlacedPuyoSinceAllClear = true;
    player.phase = 'explode';
    player.phaseTimer = 150;
  });
  await expect.poll(() => page.evaluate(() => {
    const player = window.allClearTicketEnemy?.player;
    return player && { point: player.point, ticket: player.allClearTicket };
  }), { timeout: 15000 }).toEqual({ point: 40, ticket: true });

  await page.evaluate(() => {
    const player = window.allClearTicketEnemy.player;
    player.damage = 20;
    player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
    for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
    player.hasPlacedPuyoSinceAllClear = true;
    player.phase = 'explode';
    player.phaseTimer = 150;
  });
  await expect.poll(() => page.evaluate(() => {
    const player = window.allClearTicketEnemy?.player;
    return player && { point: player.point, damage: player.damage, ticket: player.allClearTicket };
  }), { timeout: 15000 }).toEqual({ point: 2180, damage: 0, ticket: true });
});

test('연속 피버와 피버 상태는 낮은 연쇄 뒤 4연쇄 피버 패턴을 사용한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverLowComboEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverLowComboEnemy'; }
      getName() { return '피버 저연쇄 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        this.player = player;
        window.feverLowComboEnemy = this;
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        // 1연쇄 후 남는 뿌요가 있어 싹쓸이 보너스 없이 목표 최솟값만 확인한다.
        player.board[0][5] = 'blue';
        player.hasPlacedPuyoSinceAllClear = true;
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverLowComboEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.selectedStageTarget), { timeout: 15000 }).toBe(4);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().opponent.fever.targetCombo)).toBe(4);
  expect(await page.evaluate(() => window.feverLowComboEnemy.player.fever.randomizeStageOpening)).toBe(false);
});

test('피버 룰의 빈 필드 싹쓸이 뒤 4연쇄 패턴 첫 AI 배치는 무작위 대상으로 예약된다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverEmptyStageEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverEmptyStageEnemy'; }
      getName() { return '피버 빈 필드 패턴 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        this.player = player;
        window.feverEmptyStageEnemy = this;
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = false;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        player.allClearEffectElapsed = 0;
        player.phase = 'feverAllClearWait';
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverEmptyStageEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.selectedStageTarget), { timeout: 15000 }).toBe(4);
  expect(await page.evaluate(() => window.feverEmptyStageEnemy.player.fever.randomizeStageOpening)).toBe(true);
});

test('피버 상태는 낮은 연쇄 싹쓸이 뒤 직전 목표보다 한 단계만 낮은 목표를 사용한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverTargetFloorEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverTargetFloorEnemy'; }
      getName() { return '피버 목표 하한 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.fever.targetCombo = 7;
        // 1연쇄 싹쓸이의 기존 계산값은 4이지만, 직전 목표 7의 -1인 6을 하한으로 적용해야 한다.
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.hasPlacedPuyoSinceAllClear = true;
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverTargetFloorEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.targetCombo), { timeout: 15000 }).toBe(6);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().opponent.fever.selectedStageTarget)).toBe(6);
});

test('3색 피버 룰의 일반 필드 싹쓸이는 4연쇄 패턴을 배치한다', async ({ page }) => {
  await page.evaluate(() => {
    class NormalFeverAllClearEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'NormalFeverAllClearEnemy'; }
      getName() { return '일반 피버 싹쓸이 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'green';
        player.hasPlacedPuyoSinceAllClear = true;
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new NormalFeverAllClearEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.selectedStageTarget), { timeout: 15000 }).toBe(4);
  const state = await page.evaluate(() => window.WebPuyo.getGameState().opponent.fever);
  expect(state.active).toBe(false);
  expect(state.targetCombo).toBe(5);
});

test('마지막 전등이 켜지는 일반 필드 싹쓸이는 5연쇄 패턴 대신 목표 7연쇄 피버에 진입한다', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.clears = 'sounds/test-clear.ogg';
    window.WebPuyo.commonSoundPool.feverEnter = 'sounds/test-fever-enter.ogg';
    class ActivatingFeverAllClearEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'ActivatingFeverAllClearEnemy'; }
      getName() { return '피버 진입 싹쓸이 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.gauge = 7;
        player.fever.pendingActivation = true;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.hasPlacedPuyoSinceAllClear = true;
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new ActivatingFeverAllClearEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.active === true), { timeout: 15000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(expect.arrayContaining([
    'sounds/test-clear.ogg', 'sounds/test-fever-enter.ogg',
  ]));
  const state = await page.evaluate(() => window.WebPuyo.getGameState().opponent.fever);
  expect(state.targetCombo).toBe(7);
  expect(state.selectedStageTarget).toBe(7);
});

test('common sound pool plays the Fever gauge light sound after an offset', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.feverLightOn = 'sounds/test-fever-light.ogg';
    class FeverLightEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverLightEnemy'; }
      getName() { return 'Fever light sound test'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.damage = 1;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverLightEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.gauge), { timeout: 15000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(expect.arrayContaining([
    'sounds/test-fever-light.ogg',
  ]));
});

test('피버 중 공격은 피버와 일반 DAMAGE를 모두 상쇄한 뒤 남은 수치를 전달한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverDualDamageCancelEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -1;
        this.prepared = false;
      }

      getClassType() { return 'FeverDualDamageCancelEnemy'; }
      getName() { return '피버 피해 상쇄 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.fever.damage = 1;
        player.normalDamage = 2;
        // 4의 공격으로 피버 DAMAGE 1, 일반 DAMAGE 2를 상쇄하고 남은 1을 상대에게 보낸다.
        player.attack = 4;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverDualDamageCancelEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.opponent.normalDamage === 0 && state.opponent.fever?.damage === 0 && state.player.damage >= 1;
  }), { timeout: 15000 }).toBe(true);
});

test('연쇄 도중 상쇄되어 최종 전달량이 0인 공격은 상대 예고뿌요를 남기지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    class CancelledAttackPreviewEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -100;
        this.prepared = false;
      }

      getClassType() { return 'CancelledAttackPreviewEnemy'; }
      getName() { return '상쇄 예고뿌요 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        this.player = player;
        window.cancelledAttackPreviewEnemy = this;
        player.allClearEnabled = false;
        // 첫 폭발은 ATTACK 예고를 출발시키고, 낙하한 두 번째 색 뿌요가 이어서 폭발한다.
        player.attack = 10;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 6; x += 1) player.board[0][x] = 'red';
        for (let x = 0; x < 3; x += 1) player.board[1][x] = 'green';
        player.board[2][3] = 'green';
        player.phase = 'explode';
        player.phaseTimer = 0;
        // 첫 예고가 상대 천장에 도착한 뒤, 두 번째 폭발의 ATTACK이 이를 포함해 자신의 DAMAGE를 모두 상쇄한다.
        window.setTimeout(() => {
          player.damage = 100000;
          window.cancelledAttackPreviewDamageQueued = true;
        }, 300);
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new CancelledAttackPreviewEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.cancelledAttackPreviewDamageQueued === true)).toBe(true);
  await page.waitForTimeout(3000);
  const result = await page.evaluate(() => {
    const controller = window.cancelledAttackPreviewEnemy;
    const state = window.WebPuyo.getGameState();
    return { announcedAttack: controller?.player?.announcedAttack, warningPuyos: state?.player.warningPuyos };
  });
  expect(result).toEqual({ announcedAttack: 0, warningPuyos: [] });
});

test('피버 룰의 시간 만료 연쇄는 상대 방해뿌요 낙하를 기다리지 않고 종료한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverExpiredComboEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -1;
        this.prepared = false;
      }

      getClassType() { return 'FeverExpiredComboEnemy'; }
      getName() { return '피버 만료 정산 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        // 다음 프레임에서 0이 되지만, 연쇄와 에너지 전달은 끝까지 정산한다.
        player.fever.leftTime = 1;
        player.attack = 1;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverExpiredComboEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  // 플레이어는 아직 방해뿌요를 떨어뜨리지 않았지만, 전달된 DAMAGE 뒤 피버는 종료돼야 한다.
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.player.damage >= 1 && state.opponent.fever?.active === false;
  }), { timeout: 15000 }).toBe(true);
});

test('피버 룰은 DAMAGE 전달 뒤 상대 방해뿌요 낙하를 기다리지 않고 다음 피버 스테이지를 준비한다', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.backgroundMusic = 'sounds/test-normal-bgm.ogg';
    window.WebPuyo.commonSoundPool.feverBackgroundMusic = 'sounds/test-fever-bgm.ogg';
    class FeverNextStageBeforeGarbageEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverNextStageBeforeGarbageEnemy'; }
      getName() { return '피버 즉시 다음 스테이지 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        player.fever.leftTime = 10000;
        // 1연쇄 뒤 남은 ATTACK 1을 상대 DAMAGE로 확정한다.
        player.attack = 1;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverNextStageBeforeGarbageEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.player.phase === 'control'
      && state.player.damage >= 1
      && state.opponent.fever?.active === true
      && state.opponent.fever.selectedStageTarget === 4;
  }), { timeout: 15000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.some((audio) => (
    audio.src === 'sounds/test-fever-bgm.ogg' && !audio.paused
  )))).toBe(true);
});

test('연속 피버는 다음 스테이지 배치 때 DAMAGE 예고를 없애고 방해뿌요를 생성하지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    Math.random = () => 0.999999;
    window.WebPuyo.registerFeverStageState(new window.WebPuyo.FeverStageState(
      { puyos: [
        { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' },
        { x: 3, y: 0, color: 'red' }, { x: 4, y: 0, color: 'red' }, { x: 5, y: 0, color: 'red' },
        { x: 0, y: 1, color: 'red' }, { x: 1, y: 1, color: 'red' },
      ] },
      5,
      ['red', 'red'],
      1,
      ['red'],
    ));
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().fever.stageSuppliedPair)).toEqual(['blue', 'blue']);

  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');

  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.continuousFever === true
      && state.fever?.selectedStageTarget === 4
      && state.opponent.phase === 'idle'
      && state.player.attack === 0
      && state.player.damage === 0
      && state.opponent.attack === 0
      && state.opponent.damage === 0
      && state.player.warningPuyos.length === 0
      && state.opponent.warningPuyos.length === 0
      && state.opponent.board.puyos.length === 0;
  }), { timeout: 15000 }).toBe(true);
});

test('연속 피버는 키보드로 3색을 선택하고 피버 패턴도 선택한 색만 사용한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  // 조작 뿌요는 착지와 다음 쌍 지급 사이에 잠시 비므로, active가 있는 순간의 상태를 통째로 붙잡는다.
  let state = null;
  await expect.poll(async () => {
    state = await page.evaluate(() => window.WebPuyo.getGameState());
    return Boolean(state?.player.active);
  }, { timeout: 15000 }).toBe(true);
  expect(state.continuousFever).toBe(true);
  expect(state.colorCount).toBe(3);
  expect(state.colors).toEqual(['green', 'yellow', 'blue']);
  expect(state.player.board.puyos
    .filter((puyo) => puyo.color !== 'garbage')
    .every((puyo) => state.colors.includes(puyo.color))).toBe(true);
  expect(state.player.active.colors.every((color) => state.colors.includes(color))).toBe(true);
});

test('연속 피버의 중앙 정렬된 3색 버튼은 마우스로 선택할 수 있다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 520, y: 364 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getGameState().colorCount)).toBe(3);
});
