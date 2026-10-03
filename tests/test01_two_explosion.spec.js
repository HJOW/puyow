// 2-폭발의 메뉴·독립 진행도·실제 연쇄·AI·리플레이를 확인한다.
import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, openDojoOpponentSelect, releaseNetworkInterception } from './common/gamepage.js';
import { readClassicScript } from './common/modulesource.js';

setupGamePage();

/** 비공개 상태를 조작하는 접근자는 필요한 테스트의 응답에만 삽입한다. */
async function installFixture(page) {
  const fixture = `
window.twoExplosionFixture = {
    game: () => game,
    opponents: (rule) => getVisibleOpponents(rule).map((entry) => entry.classType),
    selectOpponent: (type) => { selectedOpponent = OPPONENTS.findIndex((entry) => entry.classType === type); },
    learningAllowed: () => shouldSendLearningEvent() || shouldTrainLocalAiWithSolomon()
};
`;
  const source = readClassicScript('src/js/puyow.js').replace('\nconst PuyoW = new PuyoWManager();', `${fixture}\nconst PuyoW = new PuyoWManager();`);
  await page.route('**/bundle/puyow.bundle.js', (route) => route.fulfill({ contentType: 'text/javascript', body: source }));
  await page.route('**/apis/leaderboardinfo', (route) => route.fulfill({ status: 404, body: '{}' }));
  await page.reload();
}

/** 새 룰의 해금 조건을 만족하는 기존 기본 룰 기록을 저장한다. */
async function unlockRule(page, extra = {}) {
  await page.evaluate((extra) => {
    const saved = JSON.parse(localStorage.getItem('puyow_store')) || { clearList: [], clearListByDifficulty: {}, settings: {} };
    saved.clearListByDifficulty.hard = ['Gremory'];
    saved.settings.playerName = 'PLAYER 1';
    saved.settings.language = 'ko';
    saved.settings.useReplayFeature = true;
    Object.assign(saved, extra);
    localStorage.setItem('puyow_store', JSON.stringify(saved));
  }, extra);
  await page.reload();
}

/** 도장깨기 대전을 기본 색 수·난이도·첫 적으로 시작한다. */
async function startMatch(page, rule = 'twoExplosion') {
  await enterMainMenu(page);
  await openDojoOpponentSelect(page, rule);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getGameState()?.playerCanControl)).toBe(true);
}

test('2-폭발은 기본·피버 룰 어려움·극한의 그레모리 승리 기록으로만 열린다', async ({ page }, testInfo) => {
  await enterMainMenu(page);
  const cases = [
    [null, null, false],
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
    await page.evaluate(({ field, difficulty }) => {
      const saved = { clearList: ['Gremory'], settings: { playerName: 'PLAYER 1', language: 'en' } };
      if (field) saved[field] = { [difficulty]: ['Gremory'] };
      localStorage.setItem('puyow_store', JSON.stringify(saved));
    }, { field, difficulty });
    await page.reload();
    await enterMainMenu(page);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => Array.from(document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(640, 420, 1, 1).data))).toEqual(unlocked ? [163, 78, 22, 255] : [60, 70, 80, 255]);
    expect(await page.evaluate(() => window.testCanvasTexts.includes('2-Explosion'))).toBe(true);
  }
  await page.locator('[data-puyow-canvas="2d"]').screenshot({ path: testInfo.outputPath('two-explosion-menu.png') });
});

test('잠긴 버튼은 마우스와 키보드에서 제외하고 해금 뒤에는 양쪽 입력으로 선택한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 449 } });
  expect(await page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  // 잠긴 2-폭발을 건너뛰어 취소를 실행하면 도장깨기 선택 단계로 돌아간다.
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.slice(-100).some(({ text }) => text === window.PuyoW.translate('도장깨기')))).toBe(true);
  await unlockRule(page);
  await enterMainMenu(page);
  await openDojoOpponentSelect(page, 'twoExplosion');
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 449 } });
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('opponent_select');
});

test('2-폭발은 색 수·난이도를 적용하고 다시하기에서도 같은 룰을 유지한다', async ({ page }) => {
  await unlockRule(page);
  await enterMainMenu(page);
  await openDojoOpponentSelect(page, 'twoExplosion');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getGameState()?.playerCanControl)).toBe(true);
  expect(await page.evaluate(() => window.PuyoW.getGameState())).toMatchObject({
    rule: 'two_explosion', explosionCount: 2, twoExplosion: true, feverRule: false,
    colorCount: 5, aiDifficulty: { key: 'hard' }, allClearTicketEnabled: true,
    player: { fever: null }, opponent: { fever: null },
  });
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => window.PuyoW.getGameState())).toMatchObject({ rule: 'two_explosion', explosionCount: 2, colorCount: 5, aiDifficulty: { key: 'hard' } });
});

test('모델 적은 observation 코드와 런타임 유무에 관계없이 2-폭발 목록과 해금 순서에서 빠진다', async ({ page }) => {
  await installFixture(page);
  await unlockRule(page);
  await page.evaluate(() => {
    class ModelEnemy extends window.PuyoW.Enemy {
      constructor() { super(); this.requiresModel = true; this.sortPriority = 1.5; }
      getName() { return '모델 검사 적'; }
      getClassType() { return 'ModelEnemy'; }
    }
    class SolomonProbe extends window.PuyoW.Solomon {
      constructor() { super(); this.hidden = false; }
      getName() { return '솔로몬 검사 적'; }
      getClassType() { return 'SolomonProbe'; }
    }
    window.PuyoW.registerOpponent({ createController: () => new ModelEnemy() });
    window.PuyoW.registerOpponent({ createController: () => new SolomonProbe() });
  });
  expect(await page.evaluate(() => window.twoExplosionFixture.opponents('standard'))).toEqual(expect.arrayContaining(['ModelEnemy', 'SolomonProbe', 'Murmur', 'Caim', 'Alokes']));
  const withoutModels = await page.evaluate(() => window.twoExplosionFixture.opponents('twoExplosion'));
  for (const type of ['Solomon', 'SolomonProbe', 'ModelEnemy', 'Murmur', 'Caim', 'Alokes']) expect(withoutModels).not.toContain(type);
  await enterMainMenu(page);
  await openDojoOpponentSelect(page, 'twoExplosion');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getGameState()?.playerCanControl)).toBe(true);
  await page.evaluate(() => {
    const match = window.twoExplosionFixture.game();
    match.countdown = 0;
    match.players[1].active = null;
    match.players[1].board[11][2] = 'garbage';
    match.players[1].phase = 'check';
    match.players[1].phaseTimer = 200;
  });
  await expect.poll(() => page.evaluate(() => window.PuyoW.getGameState()?.winner)).toBe('player');
  await page.keyboard.press('Escape');
  // 안드로말리우스 뒤에 삽입한 모델 적을 건너뛰고 단탈리온이 열린다.
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.slice(-100).some(({ text }) => text === '단탈리온'))).toBe(true);
  await page.evaluate(() => { localStorage.setItem('puyow_code', JSON.stringify(['observation'])); });
  await page.reload();
  const observed = await page.evaluate(() => window.twoExplosionFixture.opponents('twoExplosion'));
  for (const type of ['Solomon', 'Murmur', 'Caim', 'Alokes']) expect(observed).not.toContain(type);
  expect(await page.evaluate(() => { window.ort = undefined; return window.twoExplosionFixture.opponents('twoExplosion'); })).toEqual(observed);
});

for (const rule of ['standard', 'fever']) {
  test(`${rule} 어려움의 실제 그레모리 승리는 2-폭발 해금 이벤트를 발생시킨다`, async ({ page }) => {
    await installFixture(page);
    await page.evaluate(() => {
      localStorage.setItem('puyow_code', JSON.stringify(['observation']));
      const saved = JSON.parse(localStorage.getItem('puyow_store')) || { clearList: [], settings: {} };
      saved.settings.playerName = 'PLAYER 1';
      localStorage.setItem('puyow_store', JSON.stringify(saved));
    });
    await page.reload();
    await enterMainMenu(page);
    await openDojoOpponentSelect(page, rule);
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.evaluate(() => window.twoExplosionFixture.selectOpponent('Gremory'));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.PuyoW.getGameState()?.playerCanControl)).toBe(true);
    await page.evaluate(() => {
      const match = window.twoExplosionFixture.game();
      match.countdown = 0;
      match.players[1].active = null;
      match.players[1].board[11][2] = 'garbage';
      match.players[1].phase = 'check';
      match.players[1].phaseTimer = 200;
    });
    await expect.poll(() => page.evaluate(() => window.PuyoW.getGameState()?.winner)).toBe('player');
    expect(await page.evaluate(() => window.puyowCustomEvents.filter(({ type, detail }) => type === 'puyow_unlocked' && detail.content === 'rule:two_explosion'))).toHaveLength(1);
  });
}

test('실제 2개 폭발 연쇄·독립 승리·GOLD·리플레이 복사와 재생을 지원한다', async ({ page }) => {
  await installFixture(page);
  await unlockRule(page);
  await page.route('**/apis/leaderboardinfo', (route) => route.fulfill({ status: 404, body: '{}' }));
  await page.reload();
  await page.evaluate(() => {
    class TwoExplosionRewardEnemy extends window.PuyoW.Enemy {
      constructor() { super(); this.sortPriority = -1; }
      getClassType() { return 'TwoExplosionRewardEnemy'; }
      getName() { return '보상 검사 적'; }
    }
    window.PuyoW.registerOpponent({ createController: () => new TwoExplosionRewardEnemy() });
  });
  await startMatch(page);
  await page.evaluate(() => {
    window.PuyoW.configureLearningApi({ serverUrl: location.origin, token: '검사' });
    const match = window.twoExplosionFixture.game();
    const [player, opponent] = match.players;
    opponent.active = null;
    opponent.phase = 'idle';
    player.active = null;
    player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
    ['green', 'red', 'red', 'green'].forEach((color, y) => { player.board[y][0] = color; });
    player.point = 10000;
    player.hasPlacedPuyoSinceAllClear = true;
    player.phase = 'explode';
    player.phaseTimer = 200;
  });
  await expect.poll(() => page.evaluate(() => window.PuyoW.getGameState()?.player.allClearTicket)).toBe(true);
  expect(await page.evaluate(() => window.PuyoW.getGameState().player.point)).toBe(10180);
  expect(await page.evaluate(() => window.twoExplosionFixture.learningAllowed())).toBe(false);
  await page.evaluate(() => {
    const opponent = window.twoExplosionFixture.game().players[1];
    opponent.board[11][2] = 'garbage';
    opponent.phase = 'check';
    opponent.phaseTimer = 200;
  });
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('game_over');
  const finished = await page.evaluate(() => ({
    store: JSON.parse(localStorage.getItem('puyow_store')),
    gallery: JSON.parse(localStorage.getItem('puyow_gallery')),
    leaderboard: JSON.parse(localStorage.getItem('puyow_leaderboard')),
    replay: window.PuyoW.getReplayData(),
    game: window.PuyoW.getGameState(),
  }));
  expect(finished.store.twoExplosionClearListByDifficulty.normal).toEqual(['TwoExplosionRewardEnemy']);
  expect(finished.store.clearListByDifficulty.normal).toEqual([]);
  expect(finished.store.clearListByDifficulty.hard).toEqual(['Gremory']);
  expect(finished.store.clearList).toEqual([]);
  expect(finished.store.gold).toBe(40);
  expect(finished.gallery.enemies).toContain('TwoExplosionRewardEnemy');
  expect(finished.leaderboard.records.two_explosion.normal['4'].TwoExplosionRewardEnemy[0].score).toBe(10180);
  expect(finished.replay.meta.rule).toBe('twoExplosion');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copiedTwoExplosion = text; } } }); });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => Boolean(window.copiedTwoExplosion))).toBe(true);
  expect(await page.evaluate(() => JSON.parse(window.copiedTwoExplosion).meta.rule)).toBe('twoExplosion');
  expect(await page.evaluate(() => window.PuyoW.replay.load(window.copiedTwoExplosion))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PuyoW.replay.getState().finished)).toBe(true);
  expect(await page.evaluate(() => window.PuyoW.getGameState())).toMatchObject({ rule: 'two_explosion', explosionCount: 2, winner: 'player', player: { point: finished.game.player.point, board: finished.game.player.board } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).gold)).toBe(40);
});

test('패턴형 적은 실제 2개 기준에서 터지지 않는 쌓기 후보를 선택한다', async ({ page }) => {
  await installFixture(page);
  await unlockRule(page);
  await startMatch(page);
  const results = await page.evaluate(() => {
    const common = window.PuyoW.common;
    return ['Andromalius', 'Dantalion', 'Seere'].map((type) => {
      const controller = new window.PuyoW[type]();
      const player = new window.PuyoW.PlayerState('검사', 0, controller, ['red', 'green', 'blue']);
      player.board[0][5] = 'red';
      player.board[1][5] = 'blue';
      player.active = { x: 2, y: 11.9, rotation: 0, colors: ['red', 'green'] };
      controller.prepareTurn(player);
      const x = controller.chooseTarget(player);
      const rotation = controller.chooseRotate(player);
      const choice = player.aiSimulations.find((candidate) => candidate.x === x && candidate.rotation === rotation);
      const expected = common.simulatePlacementResult(player.board, player.active.colors, choice.positions, 2);
      return { type, combo: choice.combo, actualCombo: expected.combo, hasExplodingAlternative: player.aiSimulations.some((candidate) => candidate.combo > 0) };
    });
  });
  for (const result of results) expect(result).toMatchObject({ combo: 0, actualCombo: 0, hasExplodingAlternative: true });
});

test('동기 N수·기본 Worker·advanced Worker는 전달받은 2개 폭발 기준을 끝까지 사용한다', async ({ page }) => {
  test.setTimeout(60000);
  await releaseNetworkInterception(page);
  const result = await page.evaluate(async () => {
    const common = window.PuyoW.common;
    const player = new window.PuyoW.PlayerState('검사', 0, new window.PuyoW.Enemy(), ['red', 'green', 'blue']);
    player.board[0][0] = 'red';
    player.board[0][1] = 'blue';
    player.active = { x: 2, y: 11.9, rotation: 0, colors: ['red', 'blue'] };
    player.nextPairs = [['green', 'yellow'], ['blue', 'green']];
    player.controller.prepareTurn(player);
    const reports = [];
    for (const explosionCount of [2, 4]) {
      const plans = common.simulateNMovePlacements(player, 6, 2, explosionCount);
      const first = plans.find((plan) => plan.simulation.x === 0 && plan.simulation.rotation === 1);
      reports.push({ engine: 'sync', explosionCount, combo: first.combo, futureCombo: first.nextResult.combo });
      for (const searchMode of ['legacy', 'advanced']) {
        const completed = await common.simulateNMovePlacementsInWorker(player, 6, 3, 15000, { searchMode, explosionCount }).promise;
        const expected = common.simulatePlacementResult(player.board, player.active.colors, completed.placement.positions, explosionCount);
        reports.push({ engine: searchMode, explosionCount, depth: completed.depth, fallback: Boolean(completed.fallback), combo: completed.placement.combo, expectedCombo: expected.combo, attack: completed.placement.attack, expectedAttack: expected.attack });
      }
    }
    return reports;
  });
  expect(result.find((entry) => entry.engine === 'sync' && entry.explosionCount === 2).combo).toBe(1);
  expect(result.find((entry) => entry.engine === 'sync' && entry.explosionCount === 4).combo).toBe(0);
  for (const entry of result.filter((entry) => entry.engine !== 'sync')) {
    expect(entry.depth).toBe(3);
    expect(entry.fallback).toBe(false);
    expect(entry.combo).toBe(entry.expectedCombo);
    expect(entry.attack).toBeCloseTo(entry.expectedAttack, 9);
  }
});

test('빠른 Worker 엔진은 2개 기준의 방해뿌요·중력·연쇄·발화점을 공통 계산과 동일하게 처리한다', async ({ page }) => {
  test.setTimeout(60000);
  await releaseNetworkInterception(page);
  const result = await page.evaluate(async () => {
    const common = window.PuyoW.common;
    const OriginalWorker = window.Worker;
    let worker = null;
    window.Worker = class extends OriginalWorker {
      constructor(...args) { super(...args); worker = this; }
    };
    const empty = () => Array.from({ length: 25 }, () => Array(6).fill(null));
    const player = { board: empty(), active: { x: 2, y: 11.9, rotation: 0, colors: ['red', 'blue'] }, nextPairs: [['green', 'yellow'], ['purple', 'blue']], aiSimulations: [] };
    try {
      await common.simulateNMovePlacementsInWorker(player, 6, 3, 15000, { searchMode: 'advanced', explosionCount: 2 }).promise;
    } finally { window.Worker = OriginalWorker; }
    if (!worker) return { captured: false };
    let seed = 20261004;
    const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    const colors = ['red', 'green', 'yellow', 'blue', 'purple'];
    const cases = Array.from({ length: 200 }, () => {
      const board = empty();
      for (let x = 0; x < 6; x += 1) {
        const height = Math.floor(random() * 13);
        for (let y = 0; y < height; y += 1) {
          const roll = random();
          board[y][x] = roll < 0.1 ? 'garbage' : roll < 0.2 ? 'hardGarbage' : colors[Math.floor(random() * 5)];
        }
      }
      return { board, colors: [colors[Math.floor(random() * 5)], colors[Math.floor(random() * 5)]], x: Math.floor(random() * 6), rotation: Math.floor(random() * 4) };
    });
    // 한 개 추가로 바로 터지는 발화점은 기존의 4개 기준에서는 빠지던 경우다.
    const potentialBoard = empty();
    potentialBoard[0][0] = 'red';
    cases.push({ board: potentialBoard, colors: ['blue', 'green'], x: 5, rotation: 0 });
    const fastResults = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('빠른 엔진 비교 응답 시간 초과')), 15000);
      const receive = ({ data }) => {
        if (data?.requestId !== 'two-explosion-compare') return;
        clearTimeout(timer);
        worker.removeEventListener('message', receive);
        if (data.type === 'error') reject(new Error(data.message));
        else resolve(data.results);
      };
      worker.addEventListener('message', receive);
      worker.postMessage({ type: 'resolvePlacements', requestId: 'two-explosion-compare', cases, rules: { explosionCount: 2, marginRate: 70, timeProgressMultiplier: 1 } });
    });
    const mismatches = [];
    let chains = 0;
    cases.forEach((entry, index) => {
      const landing = common.findLandingPlacement({ board: entry.board, active: { x: 2, y: 11.9, rotation: 0, colors: entry.colors } }, entry.x, entry.rotation);
      if (!landing) { if (fastResults[index] !== null) mismatches.push(index); return; }
      const positions = common.activeCells(landing).map(({ x, y }) => ({ x, y }));
      const expected = common.simulatePlacementResult(entry.board, entry.colors, positions, 2);
      const fast = fastResults[index];
      if (expected.combo > 0) chains += 1;
      if (!fast || fast.combo !== expected.combo || Math.abs(fast.attack - expected.attack) > 1e-8 || JSON.stringify(fast.board) !== JSON.stringify(expected.board)) mismatches.push(index);
    });
    // 풀에 돌아간 Worker도 요청 전송에 실패하면 2개 기준의 동기 탐색으로 대체한다.
    worker.postMessage = () => { throw new Error('대체 탐색 검사'); };
    player.board[0][0] = 'red';
    player.board[0][1] = 'blue';
    player.controller = new window.PuyoW.Enemy();
    player.controller.prepareTurn(player);
    const fallback = await common.simulateNMovePlacementsInWorker(player, 6, 3, 15000, { explosionCount: 2 }).promise;
    return { captured: true, chains, mismatches, potential: fastResults.at(-1).potential, fallback: Boolean(fallback.fallback), fallbackCombo: fallback.placement.combo };
  });
  expect(result.captured).toBe(true);
  expect(result.chains).toBeGreaterThan(100);
  expect(result.mismatches).toEqual([]);
  expect(result.potential).toMatchObject({ combo: 1, needed: 1 });
  expect(result.fallback).toBe(true);
  expect(result.fallbackCombo).toBe(2);
});
