// 구경 모드의 2-폭발이 본 게임과 같은 조건으로 잠기고, 같은 2개 폭발 기준으로 진행되는지 확인한다.
import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu } from './common/gamepage.js';
import { readClassicScript } from './common/modulesource.js';

setupGamePage();

/** 구경 규칙 버튼(순번 3)의 왼쪽 위 안쪽 한 점이다. 글자가 닿지 않아 배경색만 읽힌다. */
const WATCH_TWO_EXPLOSION_BUTTON_PIXEL = { x: 860, y: 395 };
/** 구경 규칙 버튼(순번 3)의 중심이다. */
const WATCH_TWO_EXPLOSION_BUTTON_CENTER = { x: 947, y: 419 };

/** 비공개 상태를 읽는 접근자는 이 파일의 테스트 응답에만 삽입한다. */
async function installFixture(page) {
  const fixture = `
window.watchTwoExplosionFixture = {
    game: () => game,
    store: () => store,
    watchRule: () => watchRule,
    watchRuleLocked: () => isWatchRuleLocked('twoExplosion'),
    mainRuleUnlocked: () => isTwoExplosionRuleUnlocked(),
    candidates: (rule) => getWatchOpponentCandidates(rule).map((entry) => entry.classType)
};
`;
  const source = readClassicScript('src/js/puyow.js').replace('\nconst PuyoW = new PuyoWManager();', `${fixture}\nconst PuyoW = new PuyoWManager();`);
  await page.route('**/bundle/puyow.bundle.js', (route) => route.fulfill({ contentType: 'text/javascript', body: source }));
  await page.route('**/apis/leaderboardinfo', (route) => route.fulfill({ status: 404, body: '{}' }));
  await page.reload();
}

/** 구경 메뉴만 열려 있고 2-폭발은 잠겨 있는 저장값(데카라비아 보통 승리)을 만든 뒤 다시 읽는다. */
async function seedStore(page, extra = {}) {
  await page.evaluate((extra) => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: ['Decarabia'],
      clearListByDifficulty: { easy: [], normal: ['Decarabia'], hard: [], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
      settings: { playerName: 'PLAYER 1', language: 'ko', useReplayFeature: true },
      ...extra,
    }));
  }, extra);
  await page.reload();
}

/** 메인 메뉴의 구경 항목을 열어 구경 설정 화면까지 들어간다. */
async function openWatchSelect(page) {
  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('watch_select');
}

/** 캔버스 한 점의 RGBA 값을 읽는다. */
function readPixel(page, { x, y }) {
  return page.evaluate(({ x, y }) => Array.from(document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(x, y, 1, 1).data), { x, y });
}

/** 구경 설정에서 현재 선택된 규칙 키를 읽는다. */
function readWatchRule(page) {
  return page.evaluate(() => window.watchTwoExplosionFixture.watchRule());
}

test('본 게임에서 해금하기 전의 구경 2-폭발은 잠긴 채로 표시되고 키보드와 마우스 선택에서 빠진다', async ({ page }) => {
  await installFixture(page);
  await seedStore(page);
  await openWatchSelect(page);
  expect(await page.evaluate(() => window.watchTwoExplosionFixture.watchRuleLocked())).toBe(true);
  await expect.poll(() => readPixel(page, WATCH_TWO_EXPLOSION_BUTTON_PIXEL)).toEqual([60, 70, 80, 255]);
  expect(await page.evaluate(() => {
    const calls = window.testCanvasTextCalls.slice(-300).map(({ text }) => text);
    return [window.PuyoW.translate('2-폭발'), window.PuyoW.translate('잠김')].every((text) => calls.includes(text));
  })).toBe(true);

  // 좌우 방향키는 잠긴 규칙을 건너뛰어 기본 → 피버 → 완화 피버 → 기본으로 순환한다.
  await page.keyboard.press('ArrowDown');
  const visited = [];
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft']) {
    await page.keyboard.press(key);
    visited.push(await readWatchRule(page));
  }
  expect(visited).toEqual(['fever', 'relaxedFever', 'standard', 'relaxedFever', 'fever']);

  // 잠긴 버튼을 눌러도 규칙이 바뀌지 않고 설정 화면에 머문다.
  await page.locator('[data-puyow-canvas="2d"]').click({ position: WATCH_TWO_EXPLOSION_BUTTON_CENTER });
  expect(await readWatchRule(page)).toBe('fever');
  expect(await page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('watch_select');
});

test('구경 2-폭발은 본 게임의 2-폭발과 같은 조건으로 잠금이 풀리고 해금 즉시 선택할 수 있다', async ({ page }) => {
  await installFixture(page);
  await seedStore(page);
  await openWatchSelect(page);

  // 본 게임의 해금 조건 표(기본·피버 룰의 어려움/극한 그레모리 승리만 해당)와 구경의 잠금이 항상 일치해야 한다.
  const cases = [
    ['clearListByDifficulty', 'easy', false],
    ['clearListByDifficulty', 'normal', false],
    ['feverClearListByDifficulty', 'normal', false],
    ['feverStartClearListByDifficulty', 'hard', false],
    ['relaxedFeverClearListByDifficulty', 'extreme', false],
    ['twoExplosionClearListByDifficulty', 'hard', false],
    ['clearListByDifficulty', 'hard', true],
    ['clearListByDifficulty', 'extreme', true],
    ['feverClearListByDifficulty', 'hard', true],
    ['feverClearListByDifficulty', 'extreme', true],
  ];
  for (const [field, difficulty, unlocked] of cases) {
    const result = await page.evaluate(({ field, difficulty }) => {
      const fixture = window.watchTwoExplosionFixture;
      const saved = fixture.store();
      for (const key of ['clearListByDifficulty', 'feverClearListByDifficulty', 'feverStartClearListByDifficulty', 'relaxedFeverClearListByDifficulty', 'twoExplosionClearListByDifficulty']) {
        for (const level of ['easy', 'normal', 'hard', 'extreme']) saved[key][level] = [];
      }
      saved[field][difficulty] = ['Gremory'];
      return { watchLocked: fixture.watchRuleLocked(), mainUnlocked: fixture.mainRuleUnlocked() };
    }, { field, difficulty });
    expect(result, `${field} ${difficulty}`).toEqual({ watchLocked: !unlocked, mainUnlocked: unlocked });
  }

  // 마지막 경우(피버 룰 극한 승리)로 이미 열린 설정 화면이 다시 열지 않고도 잠금 해제된다.
  await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowRight');
  expect(await readWatchRule(page)).toBe('twoExplosion');
  await expect.poll(() => readPixel(page, WATCH_TWO_EXPLOSION_BUTTON_PIXEL)).toEqual([163, 78, 22, 255]);
  await page.keyboard.press('ArrowRight');
  expect(await readWatchRule(page)).toBe('standard');
  await page.keyboard.press('ArrowLeft');
  expect(await readWatchRule(page)).toBe('twoExplosion');

  // 마우스로도 선택할 수 있다.
  await page.keyboard.press('ArrowRight');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: WATCH_TWO_EXPLOSION_BUTTON_CENTER });
  expect(await readWatchRule(page)).toBe('twoExplosion');
});

test('구경 2-폭발 대전은 2개 폭발 기준으로 진행하고 모델 적을 뽑지 않으며 진행도와 GOLD를 바꾸지 않는다', async ({ page }) => {
  test.setTimeout(90000);
  await installFixture(page);
  await seedStore(page, { clearListByDifficulty: { easy: [], normal: [], hard: ['Decarabia', 'Gremory', 'WatchModelEnemy'], extreme: [] } });
  await page.evaluate(() => {
    class WatchModelEnemy extends window.PuyoW.Enemy {
      constructor() { super(); this.requiresModel = true; this.sortPriority = 1.5; }
      getName() { return '모델 검사 적'; }
      getClassType() { return 'WatchModelEnemy'; }
    }
    window.PuyoW.registerOpponent({ createController: () => new WatchModelEnemy() });
  });

  // 모델을 쓰는 적은 다른 구경 규칙에는 후보로 남지만 2-폭발에서만 빠진다.
  expect(await page.evaluate(() => window.watchTwoExplosionFixture.candidates('standard'))).toEqual(expect.arrayContaining(['Decarabia', 'Gremory', 'WatchModelEnemy']));
  const twoExplosionCandidates = await page.evaluate(() => window.watchTwoExplosionFixture.candidates('twoExplosion'));
  expect(twoExplosionCandidates).toEqual(expect.arrayContaining(['Decarabia', 'Gremory']));
  expect(twoExplosionCandidates).not.toContain('WatchModelEnemy');

  const before = await page.evaluate(() => {
    const saved = window.watchTwoExplosionFixture.store();
    return { gold: saved.gold, twoExplosion: saved.twoExplosionClearListByDifficulty, gallery: localStorage.getItem('puyow_gallery') };
  });

  await openWatchSelect(page);
  await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => window.PuyoW.getGameState())).toMatchObject({
    mode: 'watch', rule: 'two_explosion', watch: true, twoExplosion: true, explosionCount: 2, feverRule: false, playerCanControl: false,
    player: { fever: null, isCpu: true }, opponent: { fever: null, isCpu: true },
  });
  // 후보가 데카라비아·그레모리 둘뿐이므로 모델 적이 끼지 않고 두 적이 맞붙는다.
  expect(await page.evaluate(() => [...window.watchTwoExplosionFixture.game().watch.opponentTypes].sort())).toEqual(['Decarabia', 'Gremory']);
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  expect(await page.evaluate(() => window.PuyoW.getReplayData().meta)).toMatchObject({ rule: 'twoExplosion', watch: true, feverRule: false });

  // 왼쪽 CPU 필드에 두 개씩만 이어진 뿌요를 두면 실제 게임 루프가 2연쇄로 터뜨린다(기본 4개 기준이면 터지지 않는다).
  await page.evaluate(() => {
    const [left, right] = window.watchTwoExplosionFixture.game().players;
    right.active = null;
    right.phase = 'idle';
    right.tutorialHold = true;
    left.active = null;
    left.board = Array.from({ length: 25 }, () => Array(6).fill(null));
    ['green', 'red', 'red', 'green'].forEach((color, y) => { left.board[y][0] = color; });
    window.watchMaxCombo = 0;
    const sample = () => { window.watchMaxCombo = Math.max(window.watchMaxCombo, left.combo); requestAnimationFrame(sample); };
    sample();
    left.phase = 'explode';
    left.phaseTimer = 200;
  });
  await expect.poll(() => page.evaluate(() => window.watchMaxCombo), { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.PuyoW.getGameState().player.point)).toBeGreaterThan(0);

  // 일시정지의 다시하기도 같은 룰과 같은 두 적으로 새 대전을 만든다.
  const pairBeforeRestart = await page.evaluate(() => [...window.watchTwoExplosionFixture.game().watch.opponentTypes]);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('paused');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => window.PuyoW.getGameState())).toMatchObject({ mode: 'watch', rule: 'two_explosion', twoExplosion: true, explosionCount: 2 });
  expect(await page.evaluate(() => window.watchTwoExplosionFixture.game().watch.opponentTypes)).toEqual(pairBeforeRestart);

  // 오른쪽 CPU를 패배시켜 결과를 확정한다. 구경이라 진행도·GOLD·갤러리는 그대로다.
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  await page.evaluate(() => {
    const right = window.watchTwoExplosionFixture.game().players[1];
    right.active = null;
    right.board[11][2] = 'garbage';
    right.phase = 'check';
    right.phaseTimer = 200;
  });
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 15000 }).toBe('game_over');
  const replayJson = await page.evaluate(() => JSON.stringify(window.PuyoW.getReplayData()));
  expect(JSON.parse(replayJson).meta).toMatchObject({ rule: 'twoExplosion', watch: true });
  const after = await page.evaluate(() => {
    const saved = window.watchTwoExplosionFixture.store();
    return { gold: saved.gold, twoExplosion: saved.twoExplosionClearListByDifficulty, gallery: localStorage.getItem('puyow_gallery') };
  });
  expect(after).toEqual(before);

  // 결과 5초 뒤 같은 룰로 자동 시작한다.
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 15000 }).toBe('countdown');
  expect(await page.evaluate(() => window.PuyoW.getGameState())).toMatchObject({ mode: 'watch', rule: 'two_explosion', explosionCount: 2 });

  // 기록한 구경 리플레이도 2-폭발로 복원된다.
  expect(await page.evaluate((json) => window.PuyoW.replay.load(json), replayJson)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PuyoW.replay.getState().finished)).toBe(true);
  expect(await page.evaluate(() => window.PuyoW.getGameState())).toMatchObject({ mode: 'watch', rule: 'two_explosion', watch: true, explosionCount: 2 });
});
