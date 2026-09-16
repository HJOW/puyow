// 실제 게임 루프에서 연쇄 시작과 피버 진입·종료 사이의 DAMAGE 귀속을 확인한다.
import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, enableReplayFeature, clickReplayPlaybackButton, submitTextDialog } from './common/gamepage.js';

setupGamePage();

/** 공개 적 확장으로 양쪽 필드를 준비하고, 게임 시간만 결정론적으로 진행한다. */
async function prepareDamageMatch(page, relaxed = false) {
  await page.evaluate(() => {
    Math.random = () => 0;
    window.damagePlayers = {};
    class DamageLeftEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -200; }
      getClassType() { return 'DamageLeftEnemy'; }
      getName() { return '피해 귀속 왼쪽 테스트 적'; }
      prepareTurn(player) {
        window.damagePlayers.a = player;
        player.tutorialHold = true;
      }
      chooseTarget() { return 2; }
      chooseRotate() { return 0; }
      useFastDown() { return false; }
    }
    class DamageRightEnemy extends DamageLeftEnemy {
      constructor() { super(); this.sortPriority = -199; }
      getClassType() { return 'DamageRightEnemy'; }
      getName() { return '피해 귀속 오른쪽 테스트 적'; }
      prepareTurn(player) {
        window.damagePlayers.b = player;
        player.tutorialHold = true;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new DamageLeftEnemy() });
    window.WebPuyo.registerOpponent({ createController: () => new DamageRightEnemy() });
    window.WebPuyo.addCode('observation');
  });
  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  if (relaxed) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => !!window.damagePlayers.a && !!window.damagePlayers.b)).toBe(true);
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await installWarningProbe(page);
  await page.evaluate(() => {
    // 두 단계가 자연스럽게 이어지는 배치다. 첫 4개 폭발은 ATTACK 1 미만이다.
    window.beginDamageChain = (player, twoChains = true) => {
      player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
      for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
      if (twoChains) {
        for (let x = 0; x < 3; x += 1) player.board[1][x] = 'green';
        player.board[2][3] = 'green';
      }
      // 싹쓸이 패턴 지급이 관찰하려는 연쇄를 바꾸지 않게 잔여 뿌요를 둔다.
      player.board[0][5] = 'blue';
      player.active = null;
      player.combo = 0;
      player.phase = 'explode';
      player.phaseTimer = 0;
      player.tutorialHold = false;
    };
  });
}

/** 실제 예고뿌요 draw 호출의 위치·투명도를 기록한다. 게임 렌더러는 그대로 실행한다. */
async function installWarningProbe(page) {
  await page.evaluate(() => {
    window.warningDraws = [];
    for (const amount of [1, 6, 30, 180]) {
      const unit = window.WebPuyo.common.warningUnits(amount)[0];
      const prototype = Object.getPrototypeOf(unit);
      const original = prototype.draw;
      prototype.draw = function (context, x, y, size) {
        if (x >= 850) window.warningDraws.push({ at: performance.now(), x, alpha: context.globalAlpha, amount: this.unitCount });
        return original.call(this, context, x, y, size);
      };
    }
  });
}

/** 마지막 렌더 프레임에서 오른쪽 예고가 실제로 앞·뒤 어디에 그려졌는지 확인한다. */
async function expectWarningLayers(page, normal, current) {
  await page.evaluate(() => { window.warningDraws = []; });
  await page.clock.runFor(34);
  const actual = await page.evaluate(() => {
    const draws = window.warningDraws;
    const last = draws.filter((draw) => draw.at === draws.at(-1)?.at);
    const back = last.filter((draw) => draw.alpha < 0.5);
    const front = last.filter((draw) => draw.alpha > 0.99);
    return {
      normal: back.reduce((sum, draw) => sum + draw.amount, 0),
      current: front.reduce((sum, draw) => sum + draw.amount, 0),
      backX: back[0]?.x, frontX: front[0]?.x,
    };
  });
  expect(actual).toEqual({ normal, current, backX: normal ? 856 : undefined, frontX: current ? 864 : undefined });
}

/** 고정된 50ms 간격으로 실제 프레임을 진행해 원하는 게임 단계까지 기다린다. */
async function advanceUntil(page, predicate) {
  for (let index = 0; index < 160; index += 1) {
    if (await page.evaluate(predicate)) return;
    await page.clock.runFor(50);
  }
  expect(await page.evaluate(predicate), '제한된 게임 시간 안에 목표 상태에 도달해야 한다').toBe(true);
}

/** 마지막 상쇄 한 번을 실제로 처리해 오른쪽 플레이어를 피버에 진입시킨다. */
async function activateReceiver(page) {
  await page.evaluate(() => {
    const { b } = window.damagePlayers;
    b.fever.gauge = 6;
    b.normalDamage = 1;
    window.beginDamageChain(b, false);
  });
  await advanceUntil(page, () => window.damagePlayers.b.fever.active);
  await page.evaluate(() => { window.damagePlayers.b.tutorialHold = true; });
}

for (const delayed of [false, true]) {
  test(`연쇄 중 피버에 진입한 상대에게 ${delayed ? '에너지 완료 뒤' : '즉시 정산으로'} 일반 DAMAGE를 전달한다`, async ({ page }) => {
    await prepareDamageMatch(page, delayed);
    await page.evaluate(() => window.beginDamageChain(window.damagePlayers.a));
    await advanceUntil(page, () => window.damagePlayers.a.combo === 1);
    expect(await page.evaluate(() => ({
      attack: window.damagePlayers.a.attack,
      fever: window.damagePlayers.b.fever.active,
    }))).toEqual({ attack: 40 / 70, fever: false });
    await page.evaluate(() => { window.damagePlayers.a.tutorialHold = true; });
    await activateReceiver(page);
    await page.evaluate((delayed) => {
      const { a } = window.damagePlayers;
      // 두 구간을 이동하면 연쇄 종료 뒤까지 에너지가 남는 지연 정산 경로를 탄다.
      a.normalDamage = delayed ? 1 : 0;
      a.tutorialHold = false;
    }, delayed);
    await advanceUntil(page, () => window.damagePlayers.a.combo === 2);
    const amount = delayed ? 4 : 5;
    await advanceUntil(page, () => window.damagePlayers.a.announcedAttack > 0);
    await expectWarningLayers(page, amount, 0);
    expect(await page.evaluate(() => window.WebPuyo.getGameState().opponent.warningPuyos)).toEqual([]);
    await advanceUntil(page, () => window.damagePlayers.a.combo === 0);
    if (delayed) {
      expect(await page.evaluate(() => window.damagePlayers.b.normalDamage)).toBe(0);
    }
    await advanceUntil(page, () => window.damagePlayers.b.normalDamage > 0);
    expect(await page.evaluate(() => {
      const { a, b } = window.damagePlayers;
      return { normal: b.normalDamage, fever: b.fever.damage, active: b.fever.active, attack: a.attack };
    })).toMatchObject({ normal: amount, fever: 0, active: true });
    await expectWarningLayers(page, amount, 0);

    // 피버에서 터뜨리지 못한 배치라도 보존된 일반 피해로 방해뿌요가 떨어지면 안 된다.
    await page.evaluate(() => {
      const { b } = window.damagePlayers;
      b.board = Array.from({ length: 25 }, () => Array(6).fill(null));
      b.phase = 'explode'; b.phaseTimer = 0; b.tutorialHold = false;
    });
    await advanceUntil(page, () => window.damagePlayers.b.phase === 'control');
    expect(await page.evaluate(() => window.damagePlayers.b.garbageDropCount)).toBe(0);
    expect(await page.evaluate(() => window.damagePlayers.b.normalDamage)).toBe(amount);

    // 피버 종료 후에는 같은 피해가 일반 필드의 실제 방해뿌요로 내려온다.
    await page.evaluate(() => {
      const { b } = window.damagePlayers;
      b.fever.leftTime = 0; b.phase = 'check'; b.phaseTimer = 0; b.tutorialHold = false;
    });
    await advanceUntil(page, () => window.damagePlayers.b.garbageDropCount === 1);
    expect(await page.evaluate(() => {
      const { b } = window.damagePlayers;
      return { active: b.fever.active, normal: b.normalDamage, garbage: b.normalBoard.flat().filter((cell) => cell === 'garbage').length };
    })).toEqual({ active: false, normal: 0, garbage: amount });
  });
}

test('연쇄 시작 전에 상대가 피버에 진입했다면 피버 DAMAGE로 전달한다', async ({ page }) => {
  await prepareDamageMatch(page);
  await activateReceiver(page);
  await page.evaluate(() => window.beginDamageChain(window.damagePlayers.a));
  await advanceUntil(page, () => window.damagePlayers.a.announcedAttack > 0);
  await expectWarningLayers(page, 0, 5);
  await advanceUntil(page, () => window.damagePlayers.b.fever.damage > 0);
  expect(await page.evaluate(() => ({
    normal: window.damagePlayers.b.normalDamage,
    fever: window.damagePlayers.b.fever.damage,
  }))).toEqual({ normal: 0, fever: 5 });
  // 피버 피해 일부를 상쇄하고 새 스테이지로 넘어가도 남은 예고는 앞쪽을 유지한다.
  await page.evaluate(() => {
    const { b } = window.damagePlayers;
    b.normalDamage = 2;
    window.beginDamageChain(b, false);
  });
  await advanceUntil(page, () => window.damagePlayers.b.fever.turn === 2);
  await expectWarningLayers(page, 2, 4);
});

test('상쇄로 전달량이 0이 된 뒤 새 연쇄는 상대의 새 피버 상태를 사용한다', async ({ page }) => {
  await prepareDamageMatch(page);
  await page.evaluate(() => {
    window.damagePlayers.a.normalDamage = 100;
    window.beginDamageChain(window.damagePlayers.a);
  });
  await advanceUntil(page, () => window.damagePlayers.a.phase === 'control');
  expect(await page.evaluate(() => window.damagePlayers.b.normalDamage)).toBe(0);
  await activateReceiver(page);
  await page.evaluate(() => {
    window.damagePlayers.a.normalDamage = 0;
    window.beginDamageChain(window.damagePlayers.a);
  });
  await advanceUntil(page, () => window.damagePlayers.b.fever.damage > 0);
  expect(await page.evaluate(() => window.damagePlayers.b.normalDamage)).toBe(0);
});

test('연쇄가 시작됐던 피버가 종료·재진입하면 이전 공격은 일반 DAMAGE로 전달한다', async ({ page }) => {
  await prepareDamageMatch(page);
  await activateReceiver(page);
  await page.evaluate(() => window.beginDamageChain(window.damagePlayers.a));
  await advanceUntil(page, () => window.damagePlayers.a.combo === 1);
  await page.evaluate(() => {
    const { a, b } = window.damagePlayers;
    a.tutorialHold = true;
    b.fever.leftTime = 0; b.phase = 'check'; b.phaseTimer = 0; b.tutorialHold = false;
  });
  await advanceUntil(page, () => !window.damagePlayers.b.fever.active);
  await activateReceiver(page);
  await page.evaluate(() => { window.damagePlayers.a.tutorialHold = false; });
  await advanceUntil(page, () => window.damagePlayers.b.normalDamage > 0);
  expect(await page.evaluate(() => ({
    normal: window.damagePlayers.b.normalDamage,
    fever: window.damagePlayers.b.fever.damage,
    active: window.damagePlayers.b.fever.active,
  }))).toEqual({ normal: 5, fever: 0, active: true });
});

test('일반 필드행 미정산 예고가 전량 상쇄되면 뒤쪽에서도 사라진다', async ({ page }) => {
  await prepareDamageMatch(page);
  await page.evaluate(() => window.beginDamageChain(window.damagePlayers.a));
  await advanceUntil(page, () => window.damagePlayers.a.combo === 1);
  await page.evaluate(() => { window.damagePlayers.a.tutorialHold = true; });
  await activateReceiver(page);
  await page.evaluate(() => { window.damagePlayers.a.tutorialHold = false; });
  await advanceUntil(page, () => window.damagePlayers.a.announcedAttack > 0);
  await page.evaluate(() => { window.damagePlayers.a.tutorialHold = true; });
  await expectWarningLayers(page, 5, 0);
  await page.evaluate(() => {
    const { b } = window.damagePlayers;
    // 실제 상쇄 경로에서 상대의 아직 확정되지 않은 ATTACK을 모두 지운다.
    b.attack = 5;
    window.beginDamageChain(b, false);
  });
  await advanceUntil(page, () => window.damagePlayers.a.announcedAttack === 0);
  await expectWarningLayers(page, 0, 0);
  await page.evaluate(() => { window.damagePlayers.a.tutorialHold = false; });
  await advanceUntil(page, () => window.damagePlayers.a.phase === 'control');
  await expectWarningLayers(page, 0, 0);
});

test('새 리플레이는 일반·피버 예고의 앞뒤 구분을 보존하고 구형 기록도 재생한다', async ({ page }) => {
  test.setTimeout(60000);
  await enableReplayFeature(page);
  await prepareDamageMatch(page);
  await page.evaluate(() => window.beginDamageChain(window.damagePlayers.a));
  await advanceUntil(page, () => window.damagePlayers.a.combo === 1);
  await page.evaluate(() => { window.damagePlayers.a.tutorialHold = true; });
  await activateReceiver(page);
  await page.evaluate(() => {
    const { a, b } = window.damagePlayers;
    b.normalDamage = 2;
    b.fever.damage = 3;
    a.tutorialHold = false;
  });
  await advanceUntil(page, () => window.damagePlayers.a.announcedAttack > 0);
  await page.evaluate(() => { window.damagePlayers.a.tutorialHold = true; });
  await expectWarningLayers(page, 7, 3);
  const replay = await page.evaluate(() => {
    const data = window.WebPuyo.getReplayData();
    const full = { t: 0, a: {}, b: {}, g: {} };
    // 실제 기록기의 델타를 합쳐 문제의 한 장면을 짧은 리플레이로 만든다.
    for (const frame of data.frames) {
      for (const group of ['a', 'b', 'g']) Object.assign(full[group], frame[group]);
    }
    return { ...data, sounds: [], frames: [full, { t: 10000 }], result: { winner: 0, elapsed: 10000 } };
  });
  expect(replay.frames[0].b.nw).toBe(5);
  expect(replay.frames[0].b.nd).toBe(2);
  expect(replay.frames[0].b.fd).toBe(3);

  for (const legacy of [false, true]) {
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
    const data = JSON.parse(JSON.stringify(replay));
    // nw가 없는 기존 형식은 목적지를 추측하지 않고 종전 표시를 유지한다.
    if (legacy) {
      delete data.frames[0].a.nw;
      delete data.frames[0].b.nw;
    }
    // 텍스트 입력 도우미의 대기를 위해 입력 중에만 가상 시계를 재개한다.
    await page.clock.resume();
    await clickReplayPlaybackButton(page);
    await submitTextDialog(page, JSON.stringify(data));
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('playing');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await expectWarningLayers(page, legacy ? 2 : 7, legacy ? 8 : 3);
    expect(await page.evaluate(() => {
      const { opponent } = window.WebPuyo.getGameState();
      return { normal: opponent.normalDamage, fever: opponent.fever.damage };
    })).toEqual({ normal: 2, fever: 3 });
  }
});
