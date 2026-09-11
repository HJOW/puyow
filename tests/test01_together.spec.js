// "너랑 나랑"(한 컴퓨터 2인 대전) 모드의 회귀 테스트다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, translated, enableReplayFeature, clickReplayPlaybackButton } from './common/gamepage.js';

setupGamePage();

/** 메인 메뉴에서 "너랑 나랑" 방식 선택을 거쳐 오프라인 플레이 안내 화면을 연다. 방식 선택의 첫 포커스는 오프라인 플레이다. */
async function openTogetherGuide(page) {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('together_mode_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('together_guide');
}

/** "너랑 나랑" 안내 화면에서 현재 고른 규칙·색상 수로 대전을 시작한다. 포커스는 규칙 행에서 시작한다. */
async function startTogetherGame(page, colorPresses = 0) {
  await page.keyboard.press('ArrowDown');
  for (let index = 0; index < colorPresses; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
}

test('너랑 나랑의 오프라인 플레이 안내 화면은 취소로 메인 메뉴에 돌아간다', async ({ page }) => {
  await openTogetherGuide(page);

  // 규칙·색상 수 행을 지나 동작 행의 취소를 고르면 메인 메뉴로 돌아간다.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  // ESC로도 메인 메뉴로 돌아간다.
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('together_mode_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('together_guide');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('너랑 나랑 방식 선택은 비활성 온라인 플레이를 건너뛰고 키보드·마우스로 오프라인 플레이와 취소를 고른다', async ({ page }) => {
  const currentScreen = () => page.evaluate(() => window.WebPuyo.getScreenState().screen);
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(currentScreen).toBe('together_mode_select');
  const selectionTexts = await Promise.all([
    translated(page, '너랑 나랑'), translated(page, '오프라인 플레이'), translated(page, '온라인 플레이'), translated(page, '준비 중'), translated(page, '취소'),
  ]);
  await expect.poll(() => page.evaluate((texts) => texts.every((text) => window.testCanvasTexts.includes(text)), selectionTexts)).toBe(true);

  // 첫 포커스는 오프라인 플레이이며, 오른쪽으로 한 번 이동하면 비활성 온라인 플레이를 건너뛰고 취소에 닿는다.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(currentScreen).toBe('main_menu');

  // 아래 방향키도 온라인 플레이를 건너뛰고 끝에서는 더 이동하지 않으며, 위 방향키로 오프라인 플레이에 돌아온다.
  await page.keyboard.press('Enter');
  await expect.poll(currentScreen).toBe('together_mode_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect.poll(currentScreen).toBe('together_guide');
  const guideTitle = await translated(page, '오프라인 너랑 나랑 플레이');
  await expect.poll(() => page.evaluate((text) => window.testCanvasTexts.includes(text), guideTitle)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(currentScreen).toBe('main_menu');

  // ESC는 방식 선택만 닫고 메인 메뉴에 머문다.
  await page.keyboard.press('Enter');
  await expect.poll(currentScreen).toBe('together_mode_select');
  await page.keyboard.press('Escape');
  await expect.poll(currentScreen).toBe('main_menu');

  // 버튼은 논리 좌표 Y 321~399에 폭 250, 간격 18로 가운데 정렬된다(오프라인 X 247, 온라인 X 515, 취소 X 783).
  const box = await page.locator('[data-puyow-canvas="2d"]').boundingBox();
  const scale = box.width / 1280;
  const clickLogical = (logicalX, logicalY) => page.mouse.click(box.x + logicalX * scale, box.y + logicalY * scale);
  await page.keyboard.press('Enter');
  await expect.poll(currentScreen).toBe('together_mode_select');
  // 비활성 온라인 플레이는 클릭해도 아무 화면으로도 넘어가지 않는다.
  await clickLogical(640, 360);
  await page.waitForTimeout(300);
  expect(await currentScreen()).toBe('together_mode_select');
  await clickLogical(908, 360);
  await expect.poll(currentScreen).toBe('main_menu');

  // 버튼 밖을 클릭하면 취소와 같이 메인 메뉴로 돌아간다.
  await page.keyboard.press('Enter');
  await expect.poll(currentScreen).toBe('together_mode_select');
  await clickLogical(640, 560);
  await expect.poll(currentScreen).toBe('main_menu');

  await page.keyboard.press('Enter');
  await expect.poll(currentScreen).toBe('together_mode_select');
  await clickLogical(372, 360);
  await expect.poll(currentScreen).toBe('together_guide');
});

test('너랑 나랑 안내 화면은 조작키 안내와 규칙·색상 수 선택을 보여 준다', async ({ page }) => {
  await openTogetherGuide(page);
  const guideTexts = await Promise.all([
    translated(page, '오프라인 너랑 나랑 플레이'),
    translated(page, '한 대의 컴퓨터에서 두 사람이 함께 대전합니다.'),
    translated(page, '이동: 방향키 또는 F(좌) H(우) B(아래)'),
    translated(page, '이동: 키패드 4(좌) 6(우) 2(아래)'),
    translated(page, '가상 컨트롤러는 사용할 수 없습니다.'),
    translated(page, '규칙'),
    translated(page, '기본 룰'),
    translated(page, '피버 룰'),
    translated(page, '색상 수'),
  ]);
  await expect.poll(() => page.evaluate((texts) => texts.every((text) => window.testCanvasTexts.includes(text)), guideTexts)).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.includes('1P') && window.testCanvasTexts.includes('2P'))).toBe(true);

  // 첫 포커스는 규칙 행이고, 색상 수는 기본 4색이며 왼쪽 방향키로 3색을 고를 수 있다.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getGameState().colorCount)).toBe(3);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().rule)).toBe('standard');
});

test('너랑 나랑 대전은 양쪽 모두 사람이 조작하고 1P·2P 키가 각자 자기 뿌요만 움직인다', async ({ page }) => {
  await openTogetherGuide(page);
  await startTogetherGame(page);

  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.mode).toBe('together');
  expect(state.player.isCpu).toBe(false);
  expect(state.opponent.isCpu).toBe(false);
  expect(state.player.name).toBe('1P');
  expect(state.opponent.name).toBe('2P');

  const actives = () => page.evaluate(() => ({
    first: window.WebPuyo.getGameState().player.active?.x ?? null,
    second: window.WebPuyo.getGameState().opponent.active?.x ?? null,
  }));
  const before = await actives();

  // 1P의 F 키는 왼쪽 필드만, 2P의 키패드 6은 오른쪽 필드만 움직인다.
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await actives()).first).toBe(before.first - 1);
  expect((await actives()).second).toBe(before.second);

  await page.keyboard.press('Numpad6');
  await expect.poll(async () => (await actives()).second).toBe(before.second + 1);
  expect((await actives()).first).toBe(before.first - 1);

  // 회전도 1P는 G, 2P는 대괄호 키로 각자 처리한다.
  const rotations = () => page.evaluate(() => ({
    first: window.WebPuyo.getGameState().player.active?.rotation ?? null,
    second: window.WebPuyo.getGameState().opponent.active?.rotation ?? null,
  }));
  const beforeRotation = await rotations();
  await page.keyboard.press('KeyG');
  await expect.poll(async () => (await rotations()).first).toBe((beforeRotation.first + 3) % 4);
  expect((await rotations()).second).toBe(beforeRotation.second);
  await page.keyboard.press('BracketRight');
  await expect.poll(async () => (await rotations()).second).toBe((beforeRotation.second + 1) % 4);
});

test('너랑 나랑은 가상 컨트롤러를 그리지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { virtualController: 'normal' } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openTogetherGuide(page);
  await startTogetherGame(page);
  await page.evaluate(() => { window.testCanvasTexts = []; });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.testCanvasTexts.includes('ESC'))).toBe(false);
});

test('너랑 나랑의 피버 룰 (시작)은 해금 전에는 잠기고 해금 뒤에 고를 수 있다', async ({ page }) => {
  await openTogetherGuide(page);
  const feverStartLabel = await translated(page, '피버 룰 (시작)');
  const lockedLabel = await translated(page, '잠김');
  await expect.poll(() => page.evaluate((texts) => texts.every((text) => window.testCanvasTexts.includes(text)), [feverStartLabel, lockedLabel])).toBe(true);

  // 오른쪽 방향키는 잠긴 선택지를 건너뛰므로 피버 룰에서 더 이동해도 기본 룰로 돌아갈 뿐이다.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getGameState().rule)).toBe('fever');

  // 피버 룰로 키마리스를 이긴 기록이 있으면 잠금이 풀린다.
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      feverClearListByDifficulty: { easy: ['Kimaris'], normal: [], hard: [], extreme: [] },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openTogetherGuide(page);
  await expect.poll(() => page.evaluate((text) => window.testCanvasTexts.includes(text), feverStartLabel)).toBe(true);
  expect(await page.evaluate((text) => window.testCanvasTexts.includes(text), lockedLabel)).toBe(false);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getGameState().rule)).toBe('fever_start');
});

test('너랑 나랑 게임 중앙에는 초상화 대신 1P·2P 승패 현황이 표시된다', async ({ page }) => {
  await openTogetherGuide(page);
  await startTogetherGame(page);
  const recordLabel = await translated(page, '전적');
  const winLabel = (await translated(page, '%1승')).replace('%1', '0');
  await page.evaluate(() => { window.testCanvasTexts = []; });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.length)).toBeGreaterThan(0);
  expect(await page.evaluate((texts) => texts.every((text) => window.testCanvasTexts.includes(text)), [recordLabel, winLabel])).toBe(true);
});

test('너랑 나랑의 1P는 공통 주문 효과음을, 2P는 공통 적 주문 효과음을 낸다', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.spellCombo1 = 'sounds/together-1p-spell.ogg';
    window.WebPuyo.commonSoundPool.commonEnemySpellCombo1 = 'sounds/together-2p-spell.ogg';
    // 한 가지 색만 나오게 해 양쪽 모두 빠른 하강만으로 곧바로 연쇄를 일으키게 한다.
    Math.random = () => 0;
  });
  await openTogetherGuide(page);
  await startTogetherGame(page);

  await page.keyboard.down('KeyB');
  await page.keyboard.down('Numpad2');
  await expect.poll(() => page.evaluate(() => ({
    first: window.testAudioInstances.some((audio) => audio.src === 'sounds/together-1p-spell.ogg'),
    second: window.testAudioInstances.some((audio) => audio.src === 'sounds/together-2p-spell.ogg'),
  })), { timeout: 30000 }).toEqual({ first: true, second: true });
  await page.keyboard.up('KeyB');
  await page.keyboard.up('Numpad2');
});

/** 결과 화면 버튼 세 개까지 담기도록 넓은 범위에서 버튼 문구를 읽는다. */
async function readTogetherResultButtonLabels(page) {
  await page.evaluate(() => { window.testCanvasTextCalls = []; });
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.length)).toBeGreaterThan(0);
  return page.evaluate(() => window.testCanvasTextCalls
    .filter(({ y }) => y > 150 && y < 400)
    .map(({ text }) => text));
}

/** 1P가 빠른 하강으로 스스로 쌓아 패배할 때까지 기다려 "너랑 나랑" 대전을 끝낸다. */
async function finishTogetherGameByTopOut(page) {
  await page.keyboard.down('KeyB');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 180000 }).toBe('game_over');
  await page.keyboard.up('KeyB');
}

test('너랑 나랑 결과 화면은 다시 플레이로 승패 현황을 잇고 종료하면 초기화한다', async ({ page }) => {
  test.setTimeout(300000);
  await enableReplayFeature(page);
  await openTogetherGuide(page);
  await startTogetherGame(page);
  await finishTogetherGameByTopOut(page);

  // 결과 화면에는 다시 플레이가 맨 위에 오고 그 아래로 종료·리플레이 복사가 붙는다. 세 번째 버튼은 기존 판독 범위보다 아래에 있다.
  const labels = await readTogetherResultButtonLabels(page);
  const [exitLabel, copyLabel, againLabel] = await Promise.all([
    translated(page, '종료'), translated(page, '리플레이 복사'), translated(page, '다시 플레이'),
  ]);
  expect(labels).toEqual(expect.arrayContaining([againLabel, exitLabel, copyLabel]));
  expect(labels.indexOf(againLabel)).toBeLessThan(labels.indexOf(exitLabel));

  // 다시 플레이는 진입 시부터 포커스되어 있어 Enter만으로 누적 승수를 유지한 채 같은 규칙으로 다시 시작한다.
  const winLabel = (await translated(page, '%1승')).replace('%1', '1');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getGameState().mode)).toBe('together');
  await page.evaluate(() => { window.testCanvasTexts = []; });
  await expect.poll(() => page.evaluate((text) => window.testCanvasTexts.includes(text), winLabel)).toBe(true);

  // 일시정지의 다시하기도 같은 대전 묶음의 승패 현황을 유지한다.
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('playing');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await page.evaluate(() => { window.testCanvasTexts = []; });
  await expect.poll(() => page.evaluate((text) => window.testCanvasTexts.includes(text), winLabel)).toBe(true);

  // 종료는 세 번째 버튼이므로 두 번 이동한 뒤 메인 메뉴로 돌아간다.
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('playing');
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  // 메인 메뉴 포커스는 "너랑 나랑"에 그대로 남아 있으므로 Enter로 방식 선택을 열고, 첫 포커스인 오프라인 플레이로 안내 화면을 다시 연다.
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('together_mode_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('together_guide');
  await startTogetherGame(page);
  const resetLabel = (await translated(page, '%1승')).replace('%1', '0');
  await page.evaluate(() => { window.testCanvasTexts = []; });
  await expect.poll(() => page.evaluate((text) => window.testCanvasTexts.includes(text), resetLabel)).toBe(true);
  expect(await page.evaluate((text) => window.testCanvasTexts.includes(text), winLabel)).toBe(false);
});

test('너랑 나랑 대전도 새 형식으로 기록하고 재생하면 승패 현황까지 되살린다', async ({ page }) => {
  test.setTimeout(300000);
  await enableReplayFeature(page);
  await openTogetherGuide(page);
  await startTogetherGame(page);
  await finishTogetherGameByTopOut(page);

  const replay = await page.evaluate(() => window.WebPuyo.getReplayData());
  expect(replay.version).toBe(3);
  expect(replay.meta.together).toBe(true);
  expect(replay.meta.togetherWins).toEqual([0, 0]);
  expect(replay.meta.players.map((info) => info.controller)).toEqual([null, null]);

  // 기록한 리플레이를 그대로 재생하면 중앙에 초상화 대신 승패 현황이 나온다.
  // 너랑 나랑 결과 화면은 0번 다시 플레이에 포커스가 있으므로 아래 방향키로 종료를 골라 메인 메뉴로 나간다.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  await page.evaluate((data) => { window.prompt = () => JSON.stringify(data); }, replay);
  await clickReplayPlaybackButton(page);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('playing');
  const recordLabel = await translated(page, '전적');
  await page.evaluate(() => { window.testCanvasTexts = []; });
  await expect.poll(() => page.evaluate((text) => window.testCanvasTexts.includes(text), recordLabel)).toBe(true);

  // 재생 중에도 일시정지 메뉴에서 종료하면 메인 메뉴로 돌아간다.
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});
