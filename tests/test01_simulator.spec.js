// 시뮬레이터와 점수·연결 보너스 계산의 회귀 테스트다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, expectDefeatCellMarkers } from './common/gamepage.js';

setupGamePage();

test('시뮬레이터는 양쪽 기본 패배 칸을 표시하고 해당 칸의 뿌요를 앞에 그린다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');
  await expectDefeatCellMarkers(page, [2]);

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 925, y: 247 } });
  await canvas.click({ position: { x: 283, y: 121 } });
  await expect.poll(() => page.evaluate(() => {
    const hasBluePuyo = window.WebPuyo.getSimulatorState()?.board.puyos.some((puyo) => puyo.x === 2 && puyo.y === 11 && puyo.color === 'blue');
    const [red, green, blue] = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(276, 114, 1, 1).data;
    return hasBluePuyo && blue > red * 1.3 && blue > green * 1.2;
  })).toBe(true);
});

test('시뮬레이터 연쇄는 새 점수 계산식과 같은 연쇄 문구를 표시한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  for (const x of [207, 245, 283, 321]) {
    await canvas.click({ position: { x, y: 539 } });
  }
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => text === '1연쇄' || text === '1 Chain'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000040'))).toBe(true);
});

test('시뮬레이터 싹쓸이는 추가 점수·ATTACK 없이 티켓을 부여한 뒤 완료한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  for (const x of [207, 245, 283, 321]) await canvas.click({ position: { x, y: 539 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState())).toMatchObject({
    allClearTicket: true,
    board: { puyos: [] }
  });
  expect(await page.evaluate(() => window.testCanvasTexts.includes('000000040'))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.includes('000000140'))).toBe(false);
});

test('시뮬레이터 그리기 모드에서는 마우스와 키보드로 13번째 줄에 뿌요를 배치한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  // 13번째 줄(y=12)은 FIELD_TOP 바로 위의 숨김 영역이며, 그리기 중에는 마우스로 편집할 수 있다.
  await canvas.click({ position: { x: 207, y: 83 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.some((puyo) => puyo.x === 0 && puyo.y === 12 && puyo.color === 'red'))).toBe(true);

  // 방향키로 13번째 줄까지 이동한 뒤 Enter로 다음 칸을 배치한다.
  for (let index = 0; index < 12; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 12; index += 1) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.some((puyo) => puyo.x === 1 && puyo.y === 12 && puyo.color === 'red'))).toBe(true);
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.editableRows)).toBe(13);
});

test('시뮬레이터의 초기화 버튼은 좌측 플레이 영역의 뿌요를 모두 제거한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 207, y: 539 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => ['초기화', 'Reset', '初期化', '重置'].some((label) => window.testCanvasTexts.includes(label)))).toBe(true);

  await canvas.click({ position: { x: 960, y: 489 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.length)).toBe(0);
});

test('시뮬레이터 전용 철구뿌요는 키보드와 마우스로 배치되고 재생 후에도 남는다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  // 팔레트의 세 번째 줄 두 번째 항목인 철구뿌요를 키보드로 선택한다.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.some((puyo) => puyo.color === 'iron' && puyo.x === 0 && puyo.y === 0))).toBe(true);

  // 같은 철구뿌요를 마우스로 선택해 다른 칸에도 배치한다.
  await page.keyboard.press('Escape');
  await canvas.click({ position: { x: 970, y: 290 } });
  await canvas.click({ position: { x: 245, y: 539 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.some((puyo) => puyo.color === 'iron' && puyo.x === 1 && puyo.y === 0))).toBe(true);

  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.filter((puyo) => puyo.color === 'iron').length)).toBe(2);
});

test('숨김 13번째 줄 뿌요는 폭발 연결 수에 포함되지 않는다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const puyos = [];
  // 13번째 줄의 빨강 하나가 내려오지 않도록 아래쪽을 채운다.
  for (let x = 0; x < 3; x += 1) for (let y = 0; y <= 10; y += 1) puyos.push({ x, y, color: (x + y) % 2 === 0 ? 'blue' : 'green' });
  puyos.push({ x: 0, y: 11, color: 'red' }, { x: 1, y: 11, color: 'red' }, { x: 2, y: 11, color: 'red' }, { x: 0, y: 12, color: 'red' });
  await page.evaluate((pastedPuyos) => { window.prompt = () => JSON.stringify({ puyos: pastedPuyos }); }, puyos);

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.filter((puyo) => puyo.color === 'red').length)).toBe(4);
});

test('숨김 13번째 줄 뿌요는 중력으로 내려온 뒤 다음 폭발 판정에 참여한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  // y=12의 빨강은 중력 후 y=3으로 내려와 y=0~2의 세 뿌요와 함께 폭발한다.
  await page.evaluate(() => { window.prompt = () => JSON.stringify({ puyos: [
    { x: 0, y: 0, color: 'red' }, { x: 0, y: 1, color: 'red' }, { x: 0, y: 2, color: 'red' }, { x: 0, y: 12, color: 'red' },
  ] }); });
  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.some((puyo) => puyo.color === 'red'))).toBe(false);
});

test('시뮬레이터 점수는 동시 폭발의 색수와 가장 많은 색의 연결 보너스를 합산한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  for (const x of [207, 245, 283, 321]) {
    await canvas.click({ position: { x, y: 539 } });
  }
  await canvas.click({ position: { x: 970, y: 200 } });
  for (const x of [207, 245, 283, 321]) {
    await canvas.click({ position: { x, y: 501 } });
  }
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000240'))).toBe(true);
});

test('시뮬레이터 점수는 동시 4·5색 폭발에서 5개 색의 연결 보너스를 적용한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  await page.evaluate(() => {
    window.prompt = () => JSON.stringify({ puyos: [
      { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' }, { x: 3, y: 0, color: 'red' },
      { x: 4, y: 0, color: 'garbage' },
      { x: 0, y: 1, color: 'blue' }, { x: 1, y: 1, color: 'blue' }, { x: 2, y: 1, color: 'blue' }, { x: 3, y: 1, color: 'blue' }, { x: 4, y: 1, color: 'blue' },
    ] });
  });

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000450'))).toBe(true);
});

test('시뮬레이터 점수는 다섯 뿌요 연결 보너스를 적용한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  for (const x of [207, 245, 283, 321, 359]) {
    await canvas.click({ position: { x, y: 539 } });
  }
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000100'))).toBe(true);
});

test('시뮬레이터에서 딱딱뿌요 하나의 파괴는 점수에 세 배율로 반영된다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const puyos = [
    { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' }, { x: 1, y: 1, color: 'red' },
    { x: 2, y: 1, color: 'hardGarbage' },
  ];
  await page.evaluate((pastedPuyos) => {
    window.prompt = () => JSON.stringify({ puyos: pastedPuyos });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text) => { window.testClipboardText = text; return Promise.resolve(); } },
    });
  }, puyos);

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 960, y: 440 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.some((puyo) => puyo.color === 'hardGarbage'))).toBe(true);
  await canvas.click({ position: { x: 960, y: 395 } });
  await expect.poll(() => page.evaluate(() => window.testClipboardText)).toContain('hardGarbage');

  await page.evaluate(() => { window.testCanvasTexts = []; });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState().board.puyos.some((puyo) => puyo.color === 'hardGarbage'))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000120'))).toBe(true);
});

test('시뮬레이터에서 동시에 파괴한 두 딱딱뿌요는 점수에 다섯 배율로 반영된다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  await page.evaluate(() => {
    window.prompt = () => JSON.stringify({ puyos: [
      { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' }, { x: 1, y: 1, color: 'red' },
      { x: 0, y: 1, color: 'hardGarbage' }, { x: 2, y: 1, color: 'hardGarbage' },
    ] });
  });

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState().board.puyos.some((puyo) => puyo.color === 'hardGarbage'))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000200'))).toBe(true);
});

test('시뮬레이터 딱딱뿌요는 한 방향 폭발에 일반 방해뿌요가 된다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  await page.evaluate(() => {
    window.prompt = () => JSON.stringify({ puyos: [
      { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' }, { x: 3, y: 0, color: 'red' },
      { x: 4, y: 0, color: 'hardGarbage' },
    ] });
  });

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState().board.puyos)).toEqual([{ x: 4, y: 0, color: 'garbage' }]);
});
