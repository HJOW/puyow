// 리플레이 기록과 재생의 회귀 테스트다. 실제 대전을 끝까지 진행하므로 오래 걸리는 항목이 많다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, translated, enableReplayFeature, clickReplayPlaybackButton } from './common/gamepage.js';

setupGamePage();

/** 첫 적과의 대전을 시작하고 가운데 열을 채워 빠르게 결과 화면까지 진행한다. */
async function playQuickMatch(page, ruleKeys = []) {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  for (const key of ruleKeys) await page.keyboard.press(key);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toMatch(/^(fever_)?opponent_select$/);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('playing');
  await page.keyboard.down('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 120000 }).toBe('game_over');
  await page.keyboard.up('ArrowDown');
}

/** 결과 화면 비교에 사용할 양측 상태 요약을 만든다. */
function readMatchSummary(page) {
  return page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    const cells = (board) => board.puyos.map((puyo) => `${puyo.x},${puyo.y},${puyo.color}`).sort().join('|');
    const describe = (side) => ({
      point: Math.round(side.point),
      phase: side.phase,
      allClearTicket: side.allClearTicket,
      board: cells(side.board),
      normalBoard: cells(side.normalBoard),
      feverField: side.fever ? cells(side.fever.field) : null,
      fever: side.fever ? { active: side.fever.active, gauge: side.fever.gauge, targetCombo: side.fever.targetCombo, damage: side.fever.damage } : null,
      warningPuyos: side.warningPuyos.join(','),
      nextPairs: JSON.stringify(side.nextPairs),
    });
    return { winner: state.winner, mode: state.mode, rule: state.rule, player: describe(state.player), opponent: describe(state.opponent) };
  });
}

/** 결과 화면 버튼 영역에 그려진 문구와 Y 좌표를 모은다. */
async function readResultButtonLabels(page) {
  await page.evaluate(() => { window.testCanvasTextCalls = []; });
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.length)).toBeGreaterThan(0);
  return page.evaluate(() => window.testCanvasTextCalls
    .filter(({ y }) => y > 150 && y < 330)
    .map(({ text, y }) => ({ text, y })));
}

test('리플레이 설정이 꺼져 있으면 대전을 기록하지 않고 결과 화면에도 복사 버튼이 없다', async ({ page }) => {
  test.setTimeout(180000);
  await playQuickMatch(page);
  expect(await page.evaluate(() => window.WebPuyo.getReplayData())).toBeNull();
  const labels = await readResultButtonLabels(page);
  expect(labels.some(({ text }) => text === '종료' || text === 'Exit')).toBe(true);
  expect(labels.some(({ text }) => text.includes('리플레이') || text.includes('Replay'))).toBe(false);
});

test('리플레이 설정을 켜면 기본 룰 대전을 기록하고 결과 화면에 리플레이 복사 버튼을 보여 준다', async ({ page }) => {
  test.setTimeout(180000);
  await enableReplayFeature(page);
  await playQuickMatch(page);

  const replay = await page.evaluate(() => window.WebPuyo.getReplayData());
  expect(replay.version).toBe(3);
  expect(replay.meta.rule).toBe('standard');
  expect(replay.meta.watch).toBe(false);
  expect(replay.meta.players).toHaveLength(2);
  expect(replay.meta.players[0].controller).toBeNull();
  expect(typeof replay.meta.players[1].controller).toBe('string');
  expect(replay.frames.length).toBeGreaterThan(1);
  expect(replay.inputs.length).toBeGreaterThan(0);
  expect(replay.deck.pairs.length).toBeGreaterThan(0);
  expect(replay.result.winner).toBe(1);
  // 첫 프레임은 전체 상태를, 이후 프레임은 달라진 항목만 담아 메모리 사용량을 줄인다.
  expect(Object.keys(replay.frames[0].a).length).toBeGreaterThan(10);
  expect(JSON.stringify(replay.frames[replay.frames.length - 1]).length)
    .toBeLessThan(JSON.stringify(replay.frames[0]).length);

  const exitLabel = await translated(page, '종료');
  const copyLabel = await translated(page, '리플레이 복사');
  const labels = await readResultButtonLabels(page);
  expect(labels.some(({ text, y }) => text === exitLabel && y < 240)).toBe(true);
  expect(labels.some(({ text, y }) => text === copyLabel && y > 240)).toBe(true);
});

test('기록한 기본 룰 리플레이를 재생하면 마지막 상태가 원래 대전과 같아진다', async ({ page }) => {
  test.setTimeout(420000);
  await enableReplayFeature(page);
  await playQuickMatch(page);
  const recorded = await readMatchSummary(page);
  const replayJson = await page.evaluate(() => JSON.stringify(window.WebPuyo.getReplayData()));

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.evaluate((json) => { window.prompt = () => json; }, replayJson);
  await clickReplayPlaybackButton(page);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  expect(await page.evaluate(() => window.WebPuyo.getGameState().mode)).toBe('versus');
  // 재생은 기록된 조작 단계와 조작 뿌요를 되살릴 뿐이므로, 그 순간에도 사람이 조작할 수 있다고 보고하지 않는다.
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.player.phase === 'control' && state.player.active ? state.playerCanControl : null;
  }), { timeout: 30000 }).toBe(false);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 240000 }).toBe('game_over');
  expect(await readMatchSummary(page)).toEqual(recorded);

  const exitLabel = await translated(page, '종료');
  const againLabel = await translated(page, '다시보기');
  const labels = await readResultButtonLabels(page);
  expect(labels.some(({ text, y }) => text === exitLabel && y < 240)).toBe(true);
  expect(labels.some(({ text, y }) => text === againLabel && y > 240)).toBe(true);

  // 아래 방향키로 다시보기 버튼을 고르면 처음부터 다시 재현한다.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  // 재현 중 ESC는 일시정지 메뉴를 열며, 다시하기는 같은 리플레이의 처음으로 돌아간다.
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  // 종료는 세 번째 버튼이므로 두 칸 이동한다.
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('기록한 피버 룰 리플레이도 피버 필드와 게이지까지 같은 상태로 재현한다', async ({ page }) => {
  test.setTimeout(420000);
  await enableReplayFeature(page);
  await playQuickMatch(page, ['ArrowRight']);
  const recorded = await readMatchSummary(page);
  expect(recorded.rule).toBe('fever');
  expect(recorded.player.fever).not.toBeNull();
  const replayJson = await page.evaluate(() => JSON.stringify(window.WebPuyo.getReplayData()));

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.evaluate((json) => { window.prompt = () => json; }, replayJson);
  await clickReplayPlaybackButton(page);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 240000 }).toBe('game_over');
  expect(await readMatchSummary(page)).toEqual(recorded);
});

test('구경 대전도 리플레이로 기록하며 재생 중에는 자동 재시작을 하지 않는다', async ({ page }) => {
  test.setTimeout(600000);
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { useReplayFeature: true } }));
    localStorage.setItem('puyow_code', JSON.stringify(['observation']));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.evaluate(() => {
    // 이 테스트는 리플레이 기록을 보는 것이므로 적 선정에 쓰이는 첫 두 번의 난수만 고정해
    // 항상 같은 적 둘이 나오게 하고, 뒤의 뿌요 생성은 그대로 무작위로 둔다.
    let drawCount = 0;
    let seed = 12345;
    Math.random = () => {
      drawCount += 1;
      if (drawCount <= 2) return 0;
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
  });

  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 240000 }).toBe('game_over');

  const replay = await page.evaluate(() => window.WebPuyo.getReplayData());
  expect(replay.meta.watch).toBe(true);
  expect(replay.meta.players.every((info) => typeof info.controller === 'string')).toBe(true);
  expect(replay.frames.length).toBeGreaterThan(1);

  const replayJson = await page.evaluate(() => JSON.stringify(window.WebPuyo.getReplayData()));
  await page.keyboard.press('Escape');
  // 구경 결과 화면은 남은 연출과 자동 재시작 대기를 정리한 뒤에야 메인 메뉴로 돌아간다.
  // 다른 테스트와 함께 돌 때는 이 정리가 기본 5초를 넘기기도 하므로 넉넉히 기다린다.
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 60000 }).toBe('main_menu');
  await page.evaluate((json) => { window.prompt = () => json; }, replayJson);
  await clickReplayPlaybackButton(page);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 300000 }).toBe('game_over');
  // 구경 결과 화면의 5초 자동 재시작은 리플레이 재생 결과에서 동작하지 않는다.
  await page.waitForTimeout(6500);
  expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('game_over');
});

test('리플레이 재생 버튼은 취소·잘못된 데이터·재현 오류를 각각 안내한다', async ({ page }) => {
  test.setTimeout(120000);
  await enterMainMenu(page);
  const invalidMessage = await translated(page, '리플레이 데이터가 올바르지 않습니다.');
  const errorMessage = await translated(page, '리플레이 재현 중 오류가 발생했습니다.');

  // 공란 입력은 취소로 처리한다.
  await page.evaluate(() => { window.prompt = () => '   '; window.testCanvasTextCalls = []; });
  await clickReplayPlaybackButton(page);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate((message) => window.testCanvasTextCalls.some(({ text }) => text === message), invalidMessage)).toBe(false);

  // 형식이 맞지 않는 입력은 안내 문구를 표시하고 화면을 바꾸지 않는다.
  await page.evaluate(() => { window.prompt = () => 'not json at all {{{'; window.testCanvasTextCalls = []; });
  await clickReplayPlaybackButton(page);
  await expect.poll(() => page.evaluate((message) => window.testCanvasTextCalls.some(({ text }) => text === message), invalidMessage)).toBe(true);
  expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  // 프레임이 손상된 리플레이는 재현 중 오류를 알리고 2초 뒤 결과 화면으로 넘어간다.
  await page.evaluate(() => {
    window.prompt = () => JSON.stringify({
      version: 3,
      meta: {
        rule: 'standard', watch: false, feverRule: false, feverStart: false, feverLightStart: 0,
        difficulty: 1, aiDifficulty: 1, colors: ['red', 'green', 'yellow', 'blue'],
        players: [{ name: 'PLAYER 1', controller: null }, { name: 'CPU', controller: 'Andromalius' }],
      },
      frames: [{ t: 0, a: { nb: '' } }, { t: 100, a: { nb: '@@@@' } }],
      result: { winner: 1 },
    });
    window.testCanvasTextCalls = [];
  });
  await clickReplayPlaybackButton(page);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  await expect.poll(() => page.evaluate((message) => window.testCanvasTextCalls.some(({ text }) => text === message), errorMessage)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('game_over');
});

test('메인 메뉴 리플레이 재생 버튼은 GitHub 버튼 위에 있고 방향키 포커스 순서에 들어간다', async ({ page }) => {
  await enterMainMenu(page);
  const replayLabel = await translated(page, '리플레이 재생');
  await page.evaluate(() => { window.testCanvasTextCalls = []; window.open = () => null; });
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.length)).toBeGreaterThan(0);
  const buttons = await page.evaluate((label) => window.testCanvasTextCalls
    .filter(({ text }) => text === label || text === 'GitHub')
    .map(({ text, x, y }) => ({ text, x, y })), replayLabel);
  const replayButton = buttons.find(({ text }) => text === replayLabel);
  const githubButton = buttons.find(({ text }) => text === 'GitHub');
  expect(replayButton).toBeTruthy();
  expect(githubButton).toBeTruthy();
  expect(replayButton.x).toBeCloseTo(githubButton.x, 0);
  expect(replayButton.y).toBeLessThan(githubButton.y);

  // 목록 항목 다음 순서가 리플레이 재생 버튼이다. 잠긴 구경 항목은 건너뛴다.
  await page.evaluate(() => { window.replayPromptCount = 0; window.prompt = () => { window.replayPromptCount += 1; return ''; }; });
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.replayPromptCount)).toBe(1);
  expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

/** 테스트용 식별 URL을 공통 사운드 풀과 적 사운드 풀에 채운다. */
async function installReplaySoundUrls(page) {
  await page.evaluate(() => {
    const common = window.WebPuyo.commonSoundPool;
    common.puyoRotate = 'replaysfx/rotate.ogg';
    common.puyoFall = 'replaysfx/fall.ogg';
    common.garbageFallLittle = 'replaysfx/garbage-little.ogg';
    common.garbageFallLot = 'replaysfx/garbage-lot.ogg';
    common.gameStarts = 'replaysfx/start.ogg';
    common.loose = 'replaysfx/loose.ogg';
    common.clears = 'replaysfx/clears.ogg';
    for (let index = 1; index <= 7; index += 1) common[`puyoBurstCombo${index}`] = `replaysfx/burst${index}.ogg`;
  });
}

/** 지금까지 재생된 테스트용 효과음의 URL별 횟수를 센다. */
function countReplaySounds(page, fromIndex) {
  return page.evaluate((start) => {
    const counts = {};
    window.testAudioInstances.slice(start)
      .map((audio) => String(audio.src))
      .filter((src) => src.startsWith('replaysfx/'))
      .forEach((src) => { counts[src] = (counts[src] || 0) + 1; });
    return counts;
  }, fromIndex);
}

test('리플레이는 게임 중 효과음을 기록하고 재생할 때 같은 효과음을 같은 횟수로 낸다', async ({ page }) => {
  test.setTimeout(420000);
  await enableReplayFeature(page);
  await installReplaySoundUrls(page);

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  // 게임 시작 효과음까지 포함하도록 카운트다운 시점부터 센다.
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('countdown');
  const recordStart = await page.evaluate(() => window.testAudioInstances.length);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('playing');

  // 회전 입력으로 회전 효과음을 남기면서 가운데 열을 채워 결과 화면까지 진행한다.
  await page.keyboard.down('ArrowDown');
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('KeyZ');
    await page.waitForTimeout(120);
  }
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 120000 }).toBe('game_over');
  await page.keyboard.up('ArrowDown');

  const recorded = await countReplaySounds(page, recordStart);
  expect(recorded['replaysfx/start.ogg']).toBe(1);
  expect(recorded['replaysfx/rotate.ogg']).toBeGreaterThan(0);
  expect(recorded['replaysfx/loose.ogg']).toBe(1);

  const replay = await page.evaluate(() => window.WebPuyo.getReplayData());
  expect(replay.sounds.length).toBeGreaterThan(0);
  // 효과음은 URL 대신 사운드 풀 속성 이름으로 저장한다.
  expect(replay.sounds[0]).toEqual([expect.any(Number), 'c', 'gameStarts']);
  expect(replay.sounds.every((event) => !String(event[2]).includes('replaysfx/'))).toBe(true);

  const replayJson = await page.evaluate(() => JSON.stringify(window.WebPuyo.getReplayData()));
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.evaluate((json) => { window.prompt = () => json; }, replayJson);
  await clickReplayPlaybackButton(page);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('countdown');
  const playbackStart = await page.evaluate(() => window.testAudioInstances.length);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 240000 }).toBe('game_over');

  expect(await countReplaySounds(page, playbackStart)).toEqual(recorded);
});

test('기록된 효과음 참조는 공통 풀·적 풀·원문 URL을 되살리고 없는 항목은 건너뛴다', async ({ page }) => {
  test.setTimeout(120000);
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.puyoBurstCombo1 = 'replaysfx/burst1.ogg';
    const enemyPool = window.WebPuyo.createSoundPool(false);
    enemyPool.spellCombo3 = 'replaysfx/andromalius-spell3.ogg';
    window.WebPuyo.setEnemySoundPool('Andromalius', enemyPool);
  });
  await enterMainMenu(page);
  await page.evaluate(() => {
    window.prompt = () => JSON.stringify({
      version: 3,
      meta: {
        rule: 'standard', watch: false, feverRule: false, feverStart: false, feverLightStart: 0,
        difficulty: 1, aiDifficulty: 1, colors: ['red', 'green', 'yellow', 'blue'],
        players: [{ name: 'PLAYER 1', controller: null }, { name: 'CPU', controller: 'Andromalius' }],
      },
      sounds: [
        [50, 'c', 'puyoBurstCombo1'],
        [80, 1, 'spellCombo3'],
        [110, 'u', 'replaysfx/raw-url.ogg'],
        [140, 'c', 'nonexistentSoundKey'],
        [170, 1, 'spellCombo7'],
      ],
      frames: [{ t: 0, a: { nb: '' } }, { t: 400, a: { nb: 'rr' } }],
      result: { winner: 1 },
    });
  });
  await clickReplayPlaybackButton(page);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('countdown');
  const playbackStart = await page.evaluate(() => window.testAudioInstances.length);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 30000 }).toBe('game_over');

  const played = await page.evaluate((start) => window.testAudioInstances.slice(start)
    .map((audio) => String(audio.src))
    .filter((src) => src.startsWith('replaysfx/')), playbackStart);
  expect(played).toEqual([
    'replaysfx/burst1.ogg',
    'replaysfx/andromalius-spell3.ogg',
    'replaysfx/raw-url.ogg',
  ]);
});
