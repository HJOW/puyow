import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// 개발용 도구 화면(tools.html, puyow_tools.js)의 회귀 테스트다.
// 게임 페이지(puyow.html) 자체의 동작은 test01.spec.js가 맡는다.

const TOOLS_PAGE = '/tools.html';

// 도구 페이지는 한국어와 영어만 지원한다. 아래 테스트들은 한국어 문구로 화면을 찾으므로
// 브라우저 언어를 한국어로 고정하고, 기본 언어인 영어는 파일 끝의 별도 그룹에서 확인한다.
test.use({ locale: 'ko-KR' });

// 도구는 ONNX 추론 적을 쓰지 않지만, 게임 초기화가 CDN에서 27MB wasm을 받으려고 하지 않도록 막는다.
async function blockOnnxWasmCdn(page) {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort('failed'));
}

async function disableLocalAiModel(page) {
  await page.route('**/apis/localmodelinfo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false }) });
  });
}

// 편집 화면 canvas 문구를 확인할 수 있도록 그려진 텍스트를 모아 둔다.
async function recordCanvasTexts(page) {
  await page.addInitScript(() => {
    window.testCanvasTexts = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.testCanvasTexts.push(String(text));
      return originalFillText.call(this, text, ...args);
    };
  });
}

test.beforeEach(async ({ page }) => {
  await blockOnnxWasmCdn(page);
  await disableLocalAiModel(page);
  await recordCanvasTexts(page);
  await page.goto(TOOLS_PAGE);
  await page.waitForFunction(() => Boolean(window.PuyoWTools && window.PuyoW));
});

// 정확히 4연쇄가 나는 피버 패턴 고정 데이터다. 열 0에 빨강 쌍을 떨어뜨릴 때만 4연쇄가 된다.
// 기본 색상 목록(빨강·초록·파랑) 그대로 쓰며, 방해뿌요는 연쇄 순서를 맞추기 위한 채움용이라
// 사용할 색상 목록 검사에서는 제외된다. 열 5의 방해뿌요는 싹쓸이를 막아 다음 목표 연쇄를
// 4 + 1 = 5로 고정하려고 남겨 둔 것이다.
const FEVER_FOUR_CHAIN_PUYOS = [
  { x: 0, y: 0, color: 'red' }, { x: 0, y: 1, color: 'red' },
  { x: 1, y: 0, color: 'green' }, { x: 1, y: 1, color: 'green' }, { x: 1, y: 2, color: 'green' },
  { x: 1, y: 3, color: 'red' }, { x: 1, y: 4, color: 'green' }, { x: 1, y: 5, color: 'blue' },
  { x: 1, y: 6, color: 'garbage' }, { x: 1, y: 7, color: 'red' },
  { x: 2, y: 0, color: 'blue' }, { x: 2, y: 1, color: 'blue' }, { x: 2, y: 2, color: 'blue' },
  { x: 2, y: 3, color: 'garbage' }, { x: 2, y: 4, color: 'red' }, { x: 2, y: 5, color: 'red' },
  { x: 2, y: 6, color: 'red' },
  { x: 5, y: 0, color: 'garbage' }
];

/** 정확히 4연쇄가 나는 피버 패턴을 편집 화면에 올리고 목표 연쇄를 4로 맞춘다. */
async function setupFeverFourChain(page) {
  await page.evaluate((puyos) => window.PuyoW.tools.setEditorData({
    stageData: { puyos },
    suppliedNextPuyos: ['red', 'red']
  }), FEVER_FOUR_CHAIN_PUYOS);
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('4');
}

/**
 * 열 0으로 옮겨 조작 중인 쌍을 떨어뜨린다.
 * 빠른 하강은 방향키를 눌러 둔 동안만 동작하므로, 짧게 여러 번 누르지 않고 눌러 둔다.
 */
async function dropPairAtLeftEdge(page) {
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowDown');
}

/** 편집 화면에 들어간 뒤 시뮬레이터 그리기 모드가 준비될 때까지 기다린다. */
async function selectMode(page, label) {
  await page.getByRole('button', { name: label }).click();
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('simulator_draw');
}

/** 논리 캔버스 좌표를 실제 화면 좌표로 바꾼다. */
async function createCoordinateMapper(page) {
  const canvas = page.locator('canvas[data-puyow-canvas="2d"]');
  // WebKit은 화면 밖 canvas의 절대 좌표로 보낸 마우스 입력을 전달하지 않는다.
  // 실제 사용자처럼 먼저 편집 영역을 보이게 한 뒤 같은 좌표 변환을 적용한다.
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  return (logicalX, logicalY) => ({
    x: box.x + (logicalX / 1280) * box.width,
    y: box.y + (logicalY / 720) * box.height
  });
}

test('도구 첫 화면은 툴바의 두 선택지만 보여 주고 하단은 비어 있다', async ({ page }) => {
  await expect(page.getByRole('button', { name: '피버 패턴 개발' })).toBeVisible();
  await expect(page.getByRole('button', { name: '퍼즐뿌요 개발' })).toBeVisible();
  await expect(page.locator('.puyow-tools-empty')).toBeVisible();
  await expect(page.locator('.puyow-tools-sidebar')).toBeHidden();
  await expect(page.locator('.puyow-tools-right')).toBeHidden();
});

test('개발 대상을 고르면 툴바는 그대로 두고 사이드바·캔버스·출력 영역이 나타난다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await expect(page.getByRole('button', { name: '피버 패턴 개발' })).toBeVisible();
  await expect(page.locator('.puyow-tools-sidebar')).toBeVisible();
  await expect(page.locator('.puyow-tools-canvas canvas[data-puyow-canvas="2d"]')).toBeVisible();
  await expect(page.locator('.puyow-tools-output textarea')).toHaveAttribute('readonly', 'readonly');
  await expect(page.getByRole('button', { name: '스크립트', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '기존 패턴' })).toBeVisible();
  await expect(page.getByRole('button', { name: '테스트' })).toBeVisible();
  await expect(page.getByRole('button', { name: '스크립트 생성' })).toBeVisible();
});

test('편집 화면은 클릭·드래그로 플레이 영역과 다음 뿌요 칸에 뿌요를 배치한다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  const toClient = await createCoordinateMapper(page);
  // 팔레트 첫 번째 색(빨강)을 고른다.
  const palette = toClient(925, 203);
  await page.mouse.click(palette.x, palette.y);
  // 플레이 영역 맨 아랫줄을 드래그로 칠한다.
  const start = toClient(207, 539);
  const end = toClient(321, 539);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  const drawn = await page.evaluate(() => window.PuyoW.tools.getEditorData().stageData.puyos);
  expect(drawn).toEqual([
    { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' },
    { x: 2, y: 0, color: 'red' }, { x: 3, y: 0, color: 'red' }
  ]);

  // 가운데 "다음에 나올 뿌요" 영역도 클릭으로 배치된다.
  const nextTop = toClient(619, 147);
  const nextBottom = toClient(619, 185);
  await page.mouse.click(nextTop.x, nextTop.y);
  await page.mouse.click(nextBottom.x, nextBottom.y);
  await expect.poll(() => page.evaluate(() => window.PuyoW.tools.getEditorData().nextPuyos))
    .toEqual([['red', 'red']]);
});

test('테스트에 성공하기 전에는 피버 패턴 스크립트를 만들지 않는다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await setupFeverFourChain(page);
  await page.getByRole('button', { name: '스크립트 생성' }).click();
  await expect(page.locator('.puyow-tools-output textarea')).toHaveValue('');
  await expect(page.locator('.puyow-tools-status'))
    .toHaveText('스크립트 생성 실패: 스크립트를 생성하려면 먼저 테스트에 성공해야 합니다.');
});

test('피버 패턴은 테스트에 성공한 뒤 FeverStageState 생성 코드를 출력한다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await setupFeverFourChain(page);
  await page.getByRole('button', { name: '테스트' }).click();
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().playerCanControl), { timeout: 20000 }).toBe(true);
  await dropPairAtLeftEdge(page);
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 30000 }).toBe('simulator_draw');
  await expect(page.locator('.puyow-tools-status'))
    .toHaveText('테스트에 성공했습니다. 이제 스크립트를 생성할 수 있습니다.');

  await page.getByRole('button', { name: '스크립트 생성' }).click();
  const output = await page.locator('.puyow-tools-output textarea').inputValue();
  expect(output.startsWith('new FeverStageState(')).toBe(true);
  expect(output).toContain("    ['red', 'red'],");
  expect(output).toContain("    ['red', 'green', 'blue']");
});

test('피버 테스트에 성공해도 목표 연쇄를 바꾸면 다시 테스트를 요구한다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await setupFeverFourChain(page);
  await page.getByRole('button', { name: '테스트' }).click();
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().playerCanControl), { timeout: 20000 }).toBe(true);
  await dropPairAtLeftEdge(page);
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 30000 }).toBe('simulator_draw');

  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('5');
  await page.getByRole('button', { name: '스크립트 생성' }).click();
  await expect(page.locator('.puyow-tools-output textarea')).toHaveValue('');
  await expect(page.locator('.puyow-tools-status'))
    .toHaveText('스크립트 생성 실패: 테스트 후 내용이 바뀌었습니다. 스크립트를 생성하려면 테스트를 다시 해 주세요.');
});

test('목표 연쇄에 못 미치면 피버 테스트는 실패로 본다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await setupFeverFourChain(page);
  // 같은 배치에서 목표만 5연쇄로 올리면, 실제로는 4연쇄가 나므로 실패여야 한다.
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('5');
  await page.getByRole('button', { name: '테스트' }).click();
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().playerCanControl), { timeout: 20000 }).toBe(true);
  await dropPairAtLeftEdge(page);
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 30000 }).toBe('simulator_draw');
  await expect(page.locator('.puyow-tools-status'))
    .toHaveText('테스트 실패: 처음 지급받은 뿌요로 4연쇄를 만들었지만, 정확히 5연쇄여야 합니다.');
  await expect(page.locator('.puyow-tools-status')).toHaveClass(/is-error/);
});

test('피버 패턴의 사용할 색상 목록 기본값은 빨강·초록·파랑 3색이다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  const colorSelects = page.locator('.puyow-tools-grid tbody select');
  await expect(colorSelects).toHaveCount(3);
  await expect(colorSelects.nth(0)).toHaveValue('red');
  await expect(colorSelects.nth(1)).toHaveValue('green');
  await expect(colorSelects.nth(2)).toHaveValue('blue');
  // 한국어에서는 색 이름 옆에 한국어 이름을 함께 보여 준다.
  await expect(page.locator('.puyow-tools-grid tbody select option').first()).toHaveText('red (빨강)');
});

test('사용할 색상 목록이 중복이면 테스트를 시작하지 않고 알린다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [{ x: 0, y: 0, color: 'red' }] },
    suppliedNextPuyos: ['red', 'red']
  }));
  const colorSelects = page.locator('.puyow-tools-grid tbody select');
  await colorSelects.nth(0).selectOption('red');
  await colorSelects.nth(1).selectOption('red');
  await page.getByRole('button', { name: '테스트' }).click();
  await expect(page.locator('.puyow-tools-status')).toHaveClass(/is-error/);
  await expect(page.evaluate(() => window.PuyoW.getScreenState().screen)).resolves.toBe('simulator_draw');
});

test('사용할 색상 목록이 3색 미만이면 테스트를 시작하지 않고 알린다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [{ x: 0, y: 0, color: 'red' }] },
    suppliedNextPuyos: ['red', 'red']
  }));
  await page.getByRole('button', { name: '삭제' }).first().click();
  await page.getByRole('button', { name: '테스트' }).click();
  await expect(page.locator('.puyow-tools-status'))
    .toHaveText('테스트 실패: 사용할 색상 목록에는 3 ~ 5개의 색이 있어야 합니다.');
});

test('퍼즐뿌요는 목표 턴수만큼 "다음에 나올 뿌요"가 차 있어야 테스트를 시작한다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [{ x: 0, y: 0, color: 'red' }] },
    suppliedNextPuyos: [['red', 'red']]
  }));
  await page.locator('.puyow-tools-sidebar input[type="number"]').nth(1).fill('2');
  await page.getByRole('button', { name: '테스트' }).click();
  await expect(page.locator('.puyow-tools-status'))
    .toHaveText('테스트 실패: "다음에 나올 뿌요"를 목표 턴수인 2턴만큼 모두 채워 주세요.');
});

test('퍼즐뿌요의 목표 턴수가 범위를 벗어나면 테스트를 시작하지 않는다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [{ x: 0, y: 0, color: 'red' }] },
    suppliedNextPuyos: [['red', 'red']]
  }));
  await page.locator('.puyow-tools-sidebar input[type="number"]').nth(1).fill('0');
  await page.getByRole('button', { name: '테스트' }).click();
  await expect(page.locator('.puyow-tools-status'))
    .toHaveText('테스트 실패: 목표 턴수는 1 ~ 6 사이여야 합니다.');
});

test('퍼즐뿌요는 목표 턴수 안에 목표를 달성해야 스크립트를 만든다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  // 빨강 3개에 빨강 쌍을 얹으면 모두 사라져 싹쓸이가 된다.
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [
      { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' }
    ] },
    suppliedNextPuyos: [['red', 'red']]
  }));
  await page.locator('.puyow-tools-sidebar select').first().selectOption('clear');
  await page.locator('.puyow-tools-sidebar input[type="number"]').nth(1).fill('1');

  await page.getByRole('button', { name: '테스트' }).click();
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().playerCanControl), { timeout: 20000 }).toBe(true);
  await dropPairAtLeftEdge(page);
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 30000 }).toBe('simulator_draw');
  await expect(page.locator('.puyow-tools-status'))
    .toHaveText('테스트에 성공했습니다. 이제 스크립트를 생성할 수 있습니다.');

  await page.getByRole('button', { name: '스크립트 생성' }).click();
  const output = await page.locator('.puyow-tools-output textarea').inputValue();
  expect(output.startsWith('new PuzzlePuyoStage({')).toBe(true);
  expect(output).toContain("winConditionType : 'clear'");
  expect(output).toContain('turnLimit : 1');
});

test('퍼즐뿌요 목표 타입이 clear면 목표 타입 값 입력을 잠근다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  const winConditionValue = page.locator('.puyow-tools-sidebar input[type="number"]').first();
  await expect(winConditionValue).toBeEnabled();
  await page.locator('.puyow-tools-sidebar select').first().selectOption('clear');
  await expect(winConditionValue).toBeDisabled();
  await page.locator('.puyow-tools-sidebar select').first().selectOption('combo');
  await expect(winConditionValue).toBeEnabled();
});

test('스크립트 팝업은 기존 퍼즐뿌요 스크립트를 읽어 편집 화면에 반영한다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  await page.getByRole('button', { name: '스크립트', exact: true }).click();
  await expect(page.locator('.puyow-tools-dialog.is-load')).toBeVisible();
  await page.locator('.puyow-tools-dialog.is-load textarea').fill(`new PuzzlePuyoStage({
    stageData : {"puyos":[{"x":3,"y":0,"color":"blue"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":4,"y":1,"color":"blue"}]},
    suppliedNextPuyos : [['red', 'red'], ['blue', 'blue']],
    turnLimit : 2,
    winConditionType : 'combo',
    winConditionValue : 2,
    hint : '두 번째에 터뜨려'
})`);
  await page.locator('.puyow-tools-dialog.is-load').getByRole('button', { name: '확인' }).click();
  await expect(page.locator('.puyow-tools-dialog.is-load')).toBeHidden();
  const loaded = await page.evaluate(() => window.PuyoW.tools.getEditorData());
  expect(loaded.stageData.puyos.length).toBe(4);
  expect(loaded.nextPuyos.slice(0, 2)).toEqual([['red', 'red'], ['blue', 'blue']]);

  // 사이드바의 목표 타입·값·턴수·힌트도 불러온 값으로 바뀐다.
  await expect(page.locator('.puyow-tools-sidebar select').first()).toHaveValue('combo');
  await expect(page.locator('.puyow-tools-sidebar input[type="number"]').first()).toHaveValue('2');
  await expect(page.locator('.puyow-tools-sidebar input[type="number"]').nth(1)).toHaveValue('2');
  await expect(page.locator('.puyow-tools-sidebar input[type="text"]').first()).toHaveValue('두 번째에 터뜨려');
});

test('스크립트 팝업의 취소는 편집 내용을 바꾸지 않고 닫는다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [{ x: 0, y: 0, color: 'red' }] },
    suppliedNextPuyos: ['red', 'red']
  }));
  await page.getByRole('button', { name: '스크립트', exact: true }).click();
  await page.locator('.puyow-tools-dialog.is-load textarea').fill('new FeverStageState({"puyos":[]}, 4, [\'red\', \'red\'], 1, [\'red\'])');
  await page.locator('.puyow-tools-dialog.is-load').getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.puyow-tools-dialog.is-load')).toBeHidden();
  const editor = await page.evaluate(() => window.PuyoW.tools.getEditorData());
  expect(editor.stageData.puyos).toEqual([{ x: 0, y: 0, color: 'red' }]);
});

test('기존 패턴 팝업은 퍼즐뿌요 스테이지 목록을 보여 주고 고른 것을 편집 화면에 올린다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  await page.getByRole('button', { name: '기존 패턴' }).click();
  await expect(page.locator('.puyow-tools-dialog.is-pattern')).toBeVisible();

  const items = page.locator('.puyow-tools-pattern-item');
  const registered = await page.evaluate(() => window.PuyoW.PUZZLE_STAGES.length);
  expect(registered).toBeGreaterThan(0);
  await expect(items).toHaveCount(registered);
  // 목록은 사이드바와 같은 항목 이름으로 스테이지 정보를 보여 준다.
  await expect(items.first()).toContainText('목표 타입');
  await expect(items.first()).toContainText('목표 턴수');

  const first = await page.evaluate(() => {
    const stage = window.PuyoW.PUZZLE_STAGES[0];
    return {
      puyoCount: stage.stageData.puyos.length,
      nextPuyos: stage.suppliedNextPuyos.slice(0, 2),
      winConditionType: stage.winConditionType,
      turnLimit: stage.turnLimit
    };
  });
  await items.first().click();
  await expect(page.locator('.puyow-tools-dialog.is-pattern')).toBeHidden();
  await expect(page.locator('.puyow-tools-status')).toHaveText('기존 패턴을 불러왔습니다.');

  const loaded = await page.evaluate(() => window.PuyoW.tools.getEditorData());
  expect(loaded.stageData.puyos.length).toBe(first.puyoCount);
  expect(loaded.nextPuyos.slice(0, 2)).toEqual(first.nextPuyos);
  await expect(page.locator('.puyow-tools-sidebar select').first()).toHaveValue(first.winConditionType);
  await expect(page.locator('.puyow-tools-sidebar input[type="number"]').nth(1)).toHaveValue(String(first.turnLimit));
});

test('기존 패턴 팝업은 피버 패턴 목록도 보여 주고 고른 것을 편집 화면에 올린다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.getByRole('button', { name: '기존 패턴' }).click();

  const items = page.locator('.puyow-tools-pattern-item');
  const first = await page.evaluate(() => {
    const stages = window.PuyoW.getFeverStageDefinitions();
    return {
      count: stages.length,
      puyoCount: stages[0].stageData.puyos.length,
      nextPuyos: stages[0].suppliedNextPuyos,
      targetCombo: stages[0].targetCombo,
      difficulty: stages[0].difficulty
    };
  });
  await expect(items).toHaveCount(first.count);
  await expect(items.first()).toContainText('목표 연쇄 수');

  await items.first().click();
  await expect(page.locator('.puyow-tools-dialog.is-pattern')).toBeHidden();

  const loaded = await page.evaluate(() => window.PuyoW.tools.getEditorData());
  expect(loaded.stageData.puyos.length).toBe(first.puyoCount);
  expect(loaded.nextPuyos[0]).toEqual(first.nextPuyos);
  await expect(page.locator('.puyow-tools-sidebar input[type="number"]').first()).toHaveValue(String(first.targetCombo));
  await expect(page.locator('.puyow-tools-sidebar input[type="number"]').nth(1)).toHaveValue(String(first.difficulty));
});

test('기존 패턴 팝업의 취소는 편집 내용을 바꾸지 않고 닫는다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [{ x: 0, y: 0, color: 'red' }] },
    suppliedNextPuyos: ['red', 'red']
  }));
  await page.getByRole('button', { name: '기존 패턴' }).click();
  await page.locator('.puyow-tools-dialog.is-pattern').getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.puyow-tools-dialog.is-pattern')).toBeHidden();
  const editor = await page.evaluate(() => window.PuyoW.tools.getEditorData());
  expect(editor.stageData.puyos).toEqual([{ x: 0, y: 0, color: 'red' }]);
});

test('피버 테스트는 편집한 패턴과 목표 연쇄로 피버 상태에 들어갔다가 편집 모드로 돌아온다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [
      { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' },
      { x: 2, y: 0, color: 'green' }, { x: 0, y: 1, color: 'red' }
    ] },
    suppliedNextPuyos: ['red', 'green']
  }));
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('4');
  await page.getByRole('button', { name: '테스트' }).click();
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  const fever = await page.evaluate(() => window.PuyoW.getGameState().fever);
  expect(fever.targetCombo).toBe(4);
  expect(fever.leftTime).toBeLessThanOrEqual(60000);
  expect(fever.stageSuppliedPair).toEqual(['red', 'green']);
  // 테스트 중에는 개발 대상 선택과 조작 버튼을 잠근다.
  await expect(page.getByRole('button', { name: '스크립트 생성' })).toBeDisabled();

  // ESC 로 일시정지한 뒤 종료를 고르면 메인 화면이 아니라 편집 모드로 돌아온다.
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 15000 }).toBe('simulator_draw');
  await expect(page.getByRole('button', { name: '스크립트 생성' })).toBeEnabled();
  const editor = await page.evaluate(() => window.PuyoW.tools.getEditorData());
  expect(editor.stageData.puyos.length).toBe(4);
});

test('퍼즐뿌요 테스트는 편집한 스테이지로 진행하고 클리어 기록을 남기지 않는다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [
      { x: 3, y: 0, color: 'blue' }, { x: 4, y: 0, color: 'red' },
      { x: 5, y: 0, color: 'red' }, { x: 4, y: 1, color: 'blue' }
    ] },
    suppliedNextPuyos: [['red', 'red'], ['blue', 'blue']]
  }));
  await page.getByRole('button', { name: '테스트' }).click();
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 15000 }).toBe('simulator_draw');
  const clearedStages = await page.evaluate(() => {
    const saved = window.localStorage.getItem('puyow_store');
    return saved ? (JSON.parse(saved).puzzleClearStages || []) : [];
  });
  expect(clearedStages).toEqual([]);
});

test('피버 테스트에서 연쇄를 끝내면 다음 패턴 배치까지 보여 준 뒤 편집 모드로 돌아온다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [
      { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 0, y: 1, color: 'red' },
      { x: 4, y: 0, color: 'green' }, { x: 5, y: 0, color: 'green' }, { x: 5, y: 1, color: 'green' }
    ] },
    suppliedNextPuyos: ['red', 'green']
  }));
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('4');
  await page.getByRole('button', { name: '테스트' }).click();
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().playerCanControl), { timeout: 20000 }).toBe(true);

  // 편집한 배치와 색이 색 변환 없이 그대로 필드에 올라와야 한다.
  const board = await page.evaluate(() => window.PuyoW.getGameState().player.board.puyos);
  expect(board).toEqual([
    { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' },
    { x: 4, y: 0, color: 'green' }, { x: 5, y: 0, color: 'green' },
    { x: 0, y: 1, color: 'red' }, { x: 5, y: 1, color: 'green' }
  ]);

  // 왼쪽 끝에 빨강을 이어 연쇄를 일으키면, 다음 패턴 배치까지 보여 준 뒤 편집 모드로 돌아온다.
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  for (let index = 0; index < 40; index += 1) await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 30000 }).toBe('simulator_draw');
  const editor = await page.evaluate(() => window.PuyoW.tools.getEditorData());
  expect(editor.stageData.puyos.length).toBe(6);
  expect(editor.nextPuyos).toEqual([['red', 'green']]);
});

test('한국어 브라우저에서는 편집 화면 canvas 문구도 한국어로 나온다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('다음에 나올 뿌요'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('1턴'))).toBe(true);
});

test('피버 패턴 자동생성은 목표 연쇄가 정확히 나오는 배치를 만들어 넣는다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [] },
    suppliedNextPuyos: ['red', 'red']
  }));
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('4');

  await page.getByRole('button', { name: '자동생성' }).click();
  await expect(page.locator('.puyow-tools-status')).toHaveText(/자동생성을 마쳤습니다/, { timeout: 120000 });
  await expect(page.locator('.puyow-tools-overlay')).toBeHidden();

  // 만들어진 배치는 스스로 터지지 않고, 지급 쌍으로 정확히 4연쇄가 나야 한다.
  const check = await page.evaluate(() => {
    const editor = window.PuyoW.tools.getEditorData();
    const board = Array.from({ length: 25 }, () => Array(6).fill(null));
    editor.stageData.puyos.forEach(({ x, y, color }) => { board[y][x] = color; });
    return {
      count: editor.stageData.puyos.length,
      selfPops: window.PuyoW.findExplosionsOnBoard(board).length,
      best: window.PuyoW.findBestPreviewResult(board, ['red', 'red']).combo
    };
  });
  expect(check.count).toBeGreaterThan(0);
  expect(check.selfPops).toBe(0);
  expect(check.best).toBe(4);
});

test('피버 패턴 자동생성을 다시 하면 조건을 만족하는 다른 배치를 만든다', async ({ page }) => {
  test.setTimeout(300000);
  await selectMode(page, '피버 패턴 개발');
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('4');

  // 같은 조건으로 두 번 자동생성한다. 두 번 모두 빈 배치에서 시작해야 조건이 같다.
  const runAutoGenerate = async () => {
    await page.evaluate(() => window.PuyoW.tools.setEditorData({
      stageData: { puyos: [] },
      suppliedNextPuyos: ['red', 'red']
    }));
    await page.getByRole('button', { name: '자동생성' }).click();
    await expect(page.locator('.puyow-tools-status')).toHaveText(/자동생성을 마쳤습니다/, { timeout: 120000 });
    await expect(page.locator('.puyow-tools-overlay')).toBeHidden();
    return page.evaluate(() => {
      const editor = window.PuyoW.tools.getEditorData();
      const board = Array.from({ length: 25 }, () => Array(6).fill(null));
      editor.stageData.puyos.forEach(({ x, y, color }) => { board[y][x] = color; });
      return {
        signature: editor.stageData.puyos.map(({ x, y, color }) => `${x},${y},${color}`).sort().join('|'),
        best: window.PuyoW.findBestPreviewResult(board, ['red', 'red']).combo
      };
    });
  };

  const first = await runAutoGenerate();
  const second = await runAutoGenerate();

  // 조건을 만족하는 경우가 여럿이면 매번 다른 결과를 내야 사용자가 마음에 들 때까지 눌러 볼 수 있다.
  expect(second.signature).not.toBe(first.signature);
  expect(first.best).toBe(4);
  expect(second.best).toBe(4);
});

test('피버 패턴 자동생성은 중단 버튼으로 멈출 수 있다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [] },
    suppliedNextPuyos: ['red', 'red']
  }));
  // 12연쇄는 오래 걸리므로 음영 화면이 떠 있는 동안 중단할 수 있다.
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('12');
  await page.getByRole('button', { name: '자동생성' }).click();
  await expect(page.locator('.puyow-tools-overlay')).toBeVisible();
  await page.getByRole('button', { name: '중단' }).click();
  await expect(page.locator('.puyow-tools-overlay')).toBeHidden();
  await expect(page.locator('.puyow-tools-status')).toHaveText('자동생성을 중단했습니다.');
});

test('퍼즐뿌요 자동생성은 목표를 이룰 수 있는 배치를 만들어 넣는다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [] },
    suppliedNextPuyos: [['red', 'green']]
  }));
  await page.locator('.puyow-tools-sidebar select').first().selectOption('color');
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('2');
  await page.locator('.puyow-tools-sidebar input[type="number"]').nth(1).fill('1');

  await page.getByRole('button', { name: '자동생성' }).click();
  await expect(page.locator('.puyow-tools-status')).toHaveText(/자동생성을 마쳤습니다/, { timeout: 150000 });

  // 만들어진 배치는 스스로 터지지 않고, 첫 턴에 두 색을 동시에 터뜨릴 수 있어야 한다.
  const check = await page.evaluate(() => {
    const editor = window.PuyoW.tools.getEditorData();
    const board = Array.from({ length: 25 }, () => Array(6).fill(null));
    editor.stageData.puyos.forEach(({ x, y, color }) => { board[y][x] = color; });
    return { count: editor.stageData.puyos.length, selfPops: window.PuyoW.findExplosionsOnBoard(board).length };
  });
  expect(check.count).toBeGreaterThan(0);
  expect(check.selfPops).toBe(0);
});

test('퍼즐뿌요 자동생성은 목표 턴수가 잘못되면 시작하지 않는다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [] },
    suppliedNextPuyos: [['red', 'red']]
  }));
  await page.locator('.puyow-tools-sidebar input[type="number"]').nth(1).fill('0');
  await page.getByRole('button', { name: '자동생성' }).click();
  await expect(page.locator('.puyow-tools-status'))
    .toHaveText('자동생성 실패: 목표 턴수는 1 ~ 6 사이여야 합니다.');
  await expect(page.locator('.puyow-tools-overlay')).toBeHidden();
});

// 게임 코드(PuyoW)만으로 퍼즐 한 턴의 결과를 모두 구하는 도우미를 페이지에 둔다.
// 도구의 판정 코드를 거치지 않으므로 자동생성 결과를 독립적으로 확인할 수 있다.
async function installGamePuzzleHelpers(page) {
  await page.evaluate(() => {
    const api = window.PuyoW;
    const toBoard = (puyos) => {
      const board = Array.from({ length: 25 }, () => Array(6).fill(null));
      puyos.forEach(({ x, y, color }) => { board[y][x] = color; });
      return board;
    };
    // 한 쌍을 놓을 수 있는 모든 자리의 결과. 단계별 터진 색 뿌요 수·색 수도 게임의 폭발 그룹 함수로 센다.
    const outcomes = (board, pair) => {
      const list = [];
      for (let rotation = 0; rotation < 4; rotation += 1) {
        for (let x = 0; x < 6; x += 1) {
          const placement = api.findLandingPlacement({ board, active: { x: 2, y: 11.9, rotation: 0, colors: [...pair] } }, x, rotation);
          if (!placement) continue;
          const cells = api.activeCells(placement);
          const placed = board.map((row) => [...row]);
          cells.forEach(({ x: cx, y: cy, color }) => { placed[cy][cx] = color; });
          const result = api.simulatePlacementResult(board, pair, cells.map(({ x: cx, y: cy }) => ({ x: cx, y: cy })));
          let work = api.collapseBoard(placed);
          let popped = 0;
          let colors = 0;
          for (;;) {
            const groups = api.findExplosionGroupsOnBoard(work);
            if (!groups.length) break;
            popped = Math.max(popped, groups.reduce((sum, group) => sum + group.cells.length, 0));
            colors = Math.max(colors, new Set(groups.map((group) => group.color)).size);
            const next = work.map((row) => [...row]);
            groups.forEach((group) => group.cells.forEach(([gx, gy]) => {
              next[gy][gx] = null;
              [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                if (work[gy + dy]?.[gx + dx] === 'garbage') next[gy + dy][gx + dx] = null;
              });
            }));
            work = api.collapseBoard(next);
          }
          list.push({
            x, rotation, placed: api.collapseBoard(placed), board: result.board, combo: result.combo, popped, colors,
            allClear: result.combo > 0 && api.isAllClearBoard(result.board), defeat: Boolean(result.board[11][2])
          });
        }
      }
      return list;
    };
    const reached = (outcome, objective, exact) => {
      if (objective.kind === 'combo') return exact ? outcome.combo === objective.target : outcome.combo >= objective.target;
      if (objective.kind === 'clear') return outcome.allClear;
      if (objective.kind === 'multiple') return outcome.popped >= objective.target;
      return outcome.colors >= objective.target;
    };
    // 앞 turns턴 안에 (도중에 터뜨리는 수순 포함) 목표를 이룰 수 있는지 모두 따진다.
    const canReachEarly = (board, pairs, turns, objective, turn = 0) => turns > 0 && outcomes(board, pairs[turn])
      .some((outcome) => !outcome.defeat && (reached(outcome, objective, false)
        || (turn + 1 < turns && canReachEarly(outcome.board, pairs, turns, objective, turn + 1))));
    // 앞 턴에서 목표를 이루지 않고 마지막 턴에 목표(연쇄는 정확히)를 이루는 수순이 있는지 본다.
    const canReachOnLastTurn = (board, pairs, objective, turn = 0) => outcomes(board, pairs[turn]).some((outcome) => {
      if (outcome.defeat) return false;
      if (turn === pairs.length - 1) return reached(outcome, objective, true);
      return !reached(outcome, objective, false) && canReachOnLastTurn(outcome.board, pairs, objective, turn + 1);
    });
    window.testGamePuzzle = { toBoard, outcomes, canReachEarly, canReachOnLastTurn };
  });
}

// 퍼즐뿌요 자동생성을 끝까지 돌리고, 결과가 목표 턴수째에 이뤄지며 그 전에는 이룰 수 없는지 게임 코드로 확인한다.
async function expectPuzzleGeneratedOnTurnLimit(page, { pairs, type, value, objective }) {
  await selectMode(page, '퍼즐뿌요 개발');
  await page.evaluate((suppliedNextPuyos) => window.PuyoW.tools.setEditorData({ stageData: { puyos: [] }, suppliedNextPuyos }), pairs);
  await page.locator('.puyow-tools-sidebar select').first().selectOption(type);
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill(String(value));
  await page.locator('.puyow-tools-sidebar input[type="number"]').nth(1).fill(String(pairs.length));
  await page.getByRole('button', { name: '자동생성' }).click();
  await expect(page.locator('.puyow-tools-status')).toHaveText(/자동생성을 마쳤습니다/, { timeout: 150000 });
  await expect(page.locator('.puyow-tools-overlay')).toBeHidden();
  await installGamePuzzleHelpers(page);
  const check = await page.evaluate(({ pairs: suppliedPairs, objective: goal }) => {
    const helper = window.testGamePuzzle;
    const board = helper.toBoard(window.PuyoW.tools.getEditorData().stageData.puyos);
    return {
      selfPops: window.PuyoW.findExplosionsOnBoard(board).length,
      onLastTurn: helper.canReachOnLastTurn(board, suppliedPairs, goal),
      early: helper.canReachEarly(board, suppliedPairs, suppliedPairs.length - 1, goal)
    };
  }, { pairs, objective });
  expect(check).toEqual({ selfPops: 0, onLastTurn: true, early: false });
}

test('퍼즐뿌요 자동생성은 목표 턴수 2에서 2턴째에 목표를 이루고 1턴째에는 이룰 수 없는 배치를 만든다', async ({ page }) => {
  await expectPuzzleGeneratedOnTurnLimit(page, {
    pairs: [['red', 'green'], ['blue', 'yellow']], type: 'combo', value: 2, objective: { kind: 'combo', target: 2 }
  });
});

test('퍼즐뿌요 자동생성은 목표 턴수 3에서 도중에 터뜨리는 수순까지 막고 3턴째에 목표를 이루는 배치를 만든다', async ({ page }) => {
  await expectPuzzleGeneratedOnTurnLimit(page, {
    pairs: [['red', 'green'], ['blue', 'yellow'], ['green', 'blue']], type: 'color', value: 2, objective: { kind: 'color', target: 2 }
  });
});

test('퍼즐뿌요 자동생성 버튼은 목표 타입이 attack이면 비활성화되고 다른 타입으로 바꾸면 다시 켜진다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  const puyos = [{ x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'blue' }];
  await page.evaluate((stagePuyos) => window.PuyoW.tools.setEditorData({
    stageData: { puyos: stagePuyos },
    suppliedNextPuyos: [['red', 'green'], ['blue', 'yellow']]
  }), puyos);
  const button = page.getByRole('button', { name: '자동생성' });
  const typeSelect = page.locator('.puyow-tools-sidebar select').first();
  await expect(button).toBeEnabled();
  await typeSelect.selectOption('attack');
  await expect(button).toBeDisabled();
  // 비활성화된 버튼은 눌러도 아무 일이 없고 배치도 그대로다.
  await button.click({ force: true });
  await expect(page.locator('.puyow-tools-overlay')).toBeHidden();
  expect(await page.evaluate(() => window.PuyoW.tools.getEditorData().stageData.puyos)).toEqual(puyos);
  for (const type of ['combo', 'clear', 'multiple', 'color']) {
    await typeSelect.selectOption(type);
    await expect(button).toBeEnabled();
    await typeSelect.selectOption('attack');
    await expect(button).toBeDisabled();
  }
  // 피버 패턴 개발로 바꾸면 목표 타입과 무관하게 자동생성 버튼이 켜져 있고, 퍼즐로 돌아오면 기본 목표 타입이라 켜진다.
  await selectMode(page, '피버 패턴 개발');
  await expect(page.getByRole('button', { name: '자동생성' })).toBeEnabled();
  await selectMode(page, '퍼즐뿌요 개발');
  await expect(page.getByRole('button', { name: '자동생성' })).toBeEnabled();
});

test('퍼즐뿌요 자동생성은 동그란 진행 표시를 띄우고, 중단하면 시작 전 배치로 돌아간다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  const puyos = [{ x: 0, y: 0, color: 'red' }, { x: 5, y: 0, color: 'garbage' }];
  await page.evaluate((stagePuyos) => window.PuyoW.tools.setEditorData({
    stageData: { puyos: stagePuyos },
    suppliedNextPuyos: [['red', 'green'], ['blue', 'yellow']]
  }), puyos);
  await page.locator('.puyow-tools-sidebar select').first().selectOption('combo');
  // 2쌍으로 12연쇄는 사실상 찾을 수 없어, 제한 시간이 없어진 지금은 중단할 때까지 계속 찾는다.
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('12');
  await page.locator('.puyow-tools-sidebar input[type="number"]').nth(1).fill('2');
  await page.getByRole('button', { name: '자동생성' }).click();
  await expect(page.locator('.puyow-tools-overlay')).toBeVisible();
  const spinner = page.locator('.puyow-tools-overlay .puyow-tools-spinner');
  await expect(spinner).toBeVisible();
  const shape = await spinner.evaluate((element) => {
    const style = getComputedStyle(element);
    return { radius: style.borderTopLeftRadius, animation: style.animationName, width: element.offsetWidth, height: element.offsetHeight };
  });
  expect(shape).toEqual({ radius: '50%', animation: 'puyow-tools-spin', width: 48, height: 48 });
  await expect(page.locator('.puyow-tools-overlay-text')).toHaveText('2턴째에 목표를 이루고 그 전에는 이룰 수 없는 배치를 찾고 있습니다...');
  await page.getByRole('button', { name: '중단' }).click();
  await expect(page.locator('.puyow-tools-overlay')).toBeHidden();
  await expect(page.locator('.puyow-tools-status')).toHaveText('자동생성을 중단했습니다.');
  expect(await page.evaluate(() => window.PuyoW.tools.getEditorData().stageData.puyos)).toEqual(puyos);
});

// 자동생성 Worker 본체를 Node에서 그대로 실행한다. 퍼즐 경로의 정확 판정을 게임 코드와 비교하는 데 쓴다.
function createNodeAutoGenerateWorker() {
  const source = fs.readFileSync('src/js/puyow_tools.js', 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('    function autoGenerateWorkerBootstrap(constants) {');
  const end = source.indexOf('\n    /**\n     * 자동생성 Worker를 만든다.');
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  // puyow_tools.js의 createAutoGenerateWorker()가 넘기는 값과 같다(GAME_RULES·COLORS·AUTO_GENERATE_BOARD).
  const constants = { columns: 6, rows: 13, visibleRows: 12, spawnRow: 11, defeatColumn: 2, puyoColors: ['red', 'green', 'yellow', 'blue', 'purple'], branch: 6, startNodes: 120 };
  const self = { last: null, postMessage(message) { this.last = message; } };
  new Function('self', `${source.slice(start, end)}\nautoGenerateWorkerBootstrap(${JSON.stringify(constants)});`)(self);
  const probe = (data) => { self.onmessage({ data: { type: 'probe', id: 0, ...data } }); return self.last.result; };
  return { probe };
}

test('퍼즐 자동생성 Worker의 착지·연쇄·패배·조기 달성 판정은 게임 코드와 같다', async ({ page }) => {
  test.setTimeout(180000);
  await selectMode(page, '퍼즐뿌요 개발');
  await installGamePuzzleHelpers(page);
  const worker = createNodeAutoGenerateWorker();
  let seed = 20260918;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const palette = ['red', 'green', 'blue', 'yellow', 'garbage'];
  const toKey = (puyos) => puyos.map(({ x, y, color }) => `${x},${y},${color}`).sort().join('|');

  // 열마다 0~13칸을 무작위로 쌓고, 스스로 터지는 보드는 버린다. 높은 보드로 착지 불가·숨김 줄·패배 칸을 함께 확인한다.
  const cases = [];
  while (cases.length < 160) {
    const puyos = [];
    for (let x = 0; x < 6; x += 1) {
      const height = Math.floor(random() * 14);
      for (let y = 0; y < height; y += 1) puyos.push({ x, y, color: palette[Math.floor(random() * (y > 9 ? 5 : 4))] });
    }
    if (worker.probe({ probe: 'resolve', puyos }).combo !== 0) continue;
    const pair = [palette[Math.floor(random() * 4)], palette[Math.floor(random() * 4)]];
    cases.push({ puyos, pair });
  }
  const workerResults = cases.map(({ puyos, pair }) => worker.probe({ probe: 'placements', puyos, pair }).map(({ cells }) => {
    const placed = [...puyos, { x: cells[0][0], y: cells[0][1], color: pair[0] }, { x: cells[1][0], y: cells[1][1], color: pair[1] }];
    const resolved = worker.probe({ probe: 'resolve', puyos: placed });
    return [toKey(placed), resolved.combo, resolved.popped, resolved.colors, resolved.allClear, resolved.defeat, toKey(resolved.puyos)].join('#');
  }).sort());
  const gameResults = await page.evaluate(({ list }) => {
    const helper = window.testGamePuzzle;
    const key = (board) => board.flatMap((row, y) => row.flatMap((color, x) => (color ? [`${x},${y},${color}`] : []))).sort().join('|');
    return list.map(({ puyos, pair }) => [...new Set(helper.outcomes(helper.toBoard(puyos), pair).map((outcome) => [
      key(outcome.placed), outcome.combo, outcome.popped, outcome.colors, outcome.allClear, outcome.defeat, key(outcome.board)
    ].join('#')))].sort());
  }, { list: cases });
  expect(workerResults).toEqual(gameResults);
  // 숨김 줄(y = 12)에 걸치는 착지와 패배 칸이 막히는 경우가 비교 대상에 들어 있어야 의미가 있다.
  expect(gameResults.flat().some((entry) => /(^|\|)\d,12,/.test(entry.split('#')[0]))).toBe(true);
  expect(gameResults.flat().some((entry) => entry.split('#')[5] === 'true')).toBe(true);

  // 조기 달성 검사: 2턴 안에 목표를 이룰 수 있는지를 목표 타입마다 비교한다. 연쇄가 잘 나도록 낮은 보드를 쓴다.
  const objectives = [{ kind: 'combo', target: 2 }, { kind: 'combo', target: 1 }, { kind: 'multiple', target: 5 }, { kind: 'color', target: 2 }, { kind: 'clear', target: 1 }];
  const earlyCases = [];
  while (earlyCases.length < 60) {
    const puyos = [];
    for (let x = 0; x < 6; x += 1) {
      const height = Math.floor(random() * 5);
      for (let y = 0; y < height; y += 1) puyos.push({ x, y, color: palette[Math.floor(random() * 4)] });
    }
    if (worker.probe({ probe: 'resolve', puyos }).combo !== 0) continue;
    const pairs = [0, 1].map(() => [palette[Math.floor(random() * 4)], palette[Math.floor(random() * 4)]]);
    earlyCases.push({ puyos, pairs, objective: objectives[earlyCases.length % objectives.length] });
  }
  const workerEarly = earlyCases.map(({ puyos, pairs, objective }) => worker.probe({ probe: 'early', puyos, pairs, turns: 2, objective }));
  const gameEarly = await page.evaluate(({ list }) => list.map(({ puyos, pairs, objective }) => (
    window.testGamePuzzle.canReachEarly(window.testGamePuzzle.toBoard(puyos), pairs, 2, objective)
  )), { list: earlyCases });
  expect(workerEarly).toEqual(gameEarly);
  expect(gameEarly.includes(true) && gameEarly.includes(false)).toBe(true);
});

test('설정 창은 다크 모드를 끄면 도구 화면을 밝은 톤으로 바꾸고 저장한다', async ({ page }) => {
  await expect(page.locator('body.puyow-tools-light')).toHaveCount(0);
  // 설정 버튼은 툴바의 마지막 요소, 즉 오른쪽 끝에 있다.
  await expect(page.locator('.puyow-tools-toolbar > *').last()).toHaveText('설정');

  await page.getByRole('button', { name: '설정' }).click();
  await expect(page.locator('.puyow-tools-dialog.is-settings')).toBeVisible();
  await expect(page.locator('.puyow-tools-dialog.is-settings input[type="checkbox"]')).toBeChecked();
  await page.locator('.puyow-tools-dialog.is-settings input[type="checkbox"]').uncheck();
  await page.getByRole('button', { name: '저장' }).click();

  await expect(page.locator('.puyow-tools-dialog.is-settings')).toBeHidden();
  await expect(page.locator('body.puyow-tools-light')).toHaveCount(1);
  await expect(page.locator('.puyow-tools-status')).toHaveText('설정을 저장했습니다.');
  // 게임 본체의 저장 데이터와는 다른 키에 JSON 으로 남긴다.
  const saved = await page.evaluate(() => window.localStorage.getItem('puyow_tools_settings'));
  expect(JSON.parse(saved)).toEqual({ darkMode: false });

  // 다시 열면 저장된 값이 그대로 보인다.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.PuyoWTools && window.PuyoW));
  await expect(page.locator('body.puyow-tools-light')).toHaveCount(1);
});

test('설정 창의 취소는 고른 값을 적용하지도 저장하지도 않는다', async ({ page }) => {
  await page.getByRole('button', { name: '설정' }).click();
  await page.locator('.puyow-tools-dialog.is-settings input[type="checkbox"]').uncheck();
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.puyow-tools-dialog.is-settings')).toBeHidden();
  await expect(page.locator('body.puyow-tools-light')).toHaveCount(0);
  const saved = await page.evaluate(() => window.localStorage.getItem('puyow_tools_settings'));
  expect(saved).toBeNull();
});

test.describe('WebMCP', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.registeredWebMcpTools = [];
      Object.defineProperty(document, 'modelContext', {
        configurable: true,
        writable: true,
        value: { registerTool: (tool) => window.registeredWebMcpTools.push(tool) }
      });
    });
    await page.reload();
    await page.waitForFunction(() => Boolean(window.PuyoWTools && window.PuyoW));
  });

  test('도구 페이지는 tools_ 접두어 도구를 등록하고 게임 도구와 이름이 겹치지 않는다', async ({ page }) => {
    const names = await page.evaluate(() => window.registeredWebMcpTools.map((tool) => tool.name));
    expect(names).toEqual([
      'tools_manual', 'tools_status', 'tools_select_mode', 'tools_load_script', 'tools_set_options',
      'tools_place_puyos', 'tools_set_next_puyos', 'tools_auto_generate', 'tools_stop_auto_generate', 'tools_run_test',
      'tools_stop_test', 'tools_generate_script'
    ]);

    // 편집 화면에 들어가면 게임 본체의 도구도 함께 등록되지만 이름이 겹치지 않는다.
    await selectMode(page, '피버 패턴 개발');
    const all = await page.evaluate(() => window.registeredWebMcpTools.map((tool) => tool.name));
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain('now_screen');
  });

  test('WebMCP 도구로 개발 대상 선택과 뿌요 배치, 상태 조회를 할 수 있다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const tools = Object.fromEntries(window.registeredWebMcpTools.map((tool) => [tool.name, tool]));
      await tools.tools_select_mode.execute({ kind: 'fever' });
      await tools.tools_set_options.execute({ targetCombo: 6, usingColors: ['red', 'green', 'blue', 'yellow'] });
      await tools.tools_place_puyos.execute({
        clearFirst: true,
        puyos: [{ x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'green' }, { x: 2, y: 0, color: 'garbage' }]
      });
      await tools.tools_place_puyos.execute({ remove: [{ x: 2, y: 0 }] });
      await tools.tools_set_next_puyos.execute({ turns: [['red', 'red']] });
      return tools.tools_status.execute({});
    });
    expect(result.mode).toBe('fever');
    expect(result.fever).toEqual({ targetCombo: 6, difficulty: 1, usingColors: ['red', 'green', 'blue', 'yellow'] });
    expect(result.puyos).toEqual([{ x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'green' }]);
    expect(result.nextPuyos).toEqual([['red', 'red']]);
    expect(result.verified).toBe(false);
  });

  test('WebMCP 스크립트 생성은 테스트에 성공하기 전에는 거절한다', async ({ page }) => {
    const message = await page.evaluate(async () => {
      const tools = Object.fromEntries(window.registeredWebMcpTools.map((tool) => [tool.name, tool]));
      await tools.tools_select_mode.execute({ kind: 'fever' });
      await tools.tools_place_puyos.execute({ clearFirst: true, puyos: [{ x: 0, y: 0, color: 'red' }] });
      await tools.tools_set_next_puyos.execute({ turns: [['red', 'red']] });
      try {
        await tools.tools_generate_script.execute({});
        return 'no error';
      } catch (error) {
        return error.message;
      }
    });
    expect(message).toContain('테스트에 성공해야');
  });

  test('WebMCP 자동생성은 배치를 채우고 결과 문구를 돌려준다', async ({ page }) => {
    const outcome = await page.evaluate(async () => {
      const tools = Object.fromEntries(window.registeredWebMcpTools.map((tool) => [tool.name, tool]));
      await tools.tools_select_mode.execute({ kind: 'fever' });
      await tools.tools_place_puyos.execute({ clearFirst: true, puyos: [] });
      await tools.tools_set_next_puyos.execute({ turns: [['red', 'red']] });
      await tools.tools_set_options.execute({ targetCombo: 4 });
      const message = await tools.tools_auto_generate.execute({});
      const status = await tools.tools_status.execute({});
      return { message, count: status.puyos.length };
    });
    expect(outcome.message).toContain('자동생성을 마쳤습니다');
    expect(outcome.count).toBeGreaterThan(0);
  });

  test('WebMCP 자동생성은 기다리지 않고 시작할 수 있고, tools_stop_auto_generate로 중단하면 시작 전 배치가 남는다', async ({ page }) => {
    const outcome = await page.evaluate(async () => {
      const tools = Object.fromEntries(window.registeredWebMcpTools.map((tool) => [tool.name, tool]));
      await tools.tools_select_mode.execute({ kind: 'puzzle' });
      await tools.tools_place_puyos.execute({ clearFirst: true, puyos: [{ x: 0, y: 0, color: 'red' }] });
      await tools.tools_set_next_puyos.execute({ turns: [['red', 'green'], ['blue', 'yellow']] });
      // 2쌍으로 12연쇄는 사실상 찾을 수 없어 중단할 때까지 계속 찾는다.
      await tools.tools_set_options.execute({ winConditionType: 'combo', winConditionValue: 12, turnLimit: 2 });
      const started = await tools.tools_auto_generate.execute({ wait: false });
      const running = await tools.tools_status.execute({});
      const stopped = await tools.tools_stop_auto_generate.execute({});
      const after = await tools.tools_status.execute({});
      const again = await tools.tools_stop_auto_generate.execute({});
      // 기다리는 호출도 중단 문구를 받는다.
      await tools.tools_set_options.execute({ winConditionType: 'combo', winConditionValue: 12, turnLimit: 2 });
      const waiting = tools.tools_auto_generate.execute({});
      await tools.tools_stop_auto_generate.execute({});
      const waitedMessage = await waiting;
      // attack 목표는 기다리지 않아도 곧바로 안내 문구를 돌려준다.
      await tools.tools_set_options.execute({ winConditionType: 'attack', winConditionValue: 3 });
      const attackMessage = await tools.tools_auto_generate.execute({ wait: false });
      return { started, running: running.autoGenerating, stopped, after: after.autoGenerating, puyos: after.puyos, again, waitedMessage, attackMessage };
    });
    expect(outcome.started).toContain('Auto generation started');
    expect(outcome.running).toBe(true);
    expect(outcome.stopped).toBe('자동생성을 중단했습니다.');
    expect(outcome.after).toBe(false);
    expect(outcome.puyos).toEqual([{ x: 0, y: 0, color: 'red' }]);
    expect(outcome.again).toBe('Auto generation is not running.');
    expect(outcome.waitedMessage).toBe('자동생성을 중단했습니다.');
    expect(outcome.attackMessage).toBe('목표 타입이 attack (공격량)이면 자동생성을 사용할 수 없습니다.');
  });
});

test.describe('일본어', () => {
  test.use({ locale: 'ja-JP' });

  test('일본어 브라우저에서는 도구 화면과 편집 화면 canvas 문구가 일본어로 나온다', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'FEVERパターン開発' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'なぞぷよ開発' })).toBeVisible();
    await selectMode(page, 'FEVERパターン開発');
    await expect(page.locator('.puyow-tools-sidebar')).toContainText('使用する色の一覧');
    await expect(page.getByRole('button', { name: 'スクリプト生成' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('NEXTぷよ'))).toBe(true);
  });
});

test.describe('독일어', () => {
  test.use({ locale: 'de-DE' });

  test('독일어 브라우저에서는 도구 화면과 편집 화면 canvas 문구가 독일어로 나온다', async ({ page }) => {
    await selectMode(page, 'FEVER-Muster bearbeiten');
    await expect(page.locator('.puyow-tools-sidebar')).toContainText('Verwendete Farben');
    await expect(page.getByRole('button', { name: 'Skript erzeugen' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Nächste Puyos'))).toBe(true);
  });
});

test.describe('기본 언어인 영어', () => {
  test.use({ locale: 'en-US' });

  test('한국어가 아닌 브라우저에서는 도구 화면이 영어로 나온다', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Edit FEVER Pattern' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Puzzle Puyo' })).toBeVisible();
    await expect(page.locator('.puyow-tools-status')).toHaveText('Choose what to develop.');
    await expect(page.locator('.puyow-tools-empty'))
      .toHaveText('Choose "Edit Puzzle Puyo" or "Edit FEVER Pattern" at the top of the screen.');
  });

  test('영어 사이드바와 편집 화면 canvas 문구도 영어로 나온다', async ({ page }) => {
    await selectMode(page, 'Edit FEVER Pattern');
    await expect(page.locator('.puyow-tools-sidebar')).toContainText('Colors In Use');
    await expect(page.locator('.puyow-tools-sidebar')).toContainText('Target Chain');
    await expect(page.getByRole('button', { name: 'Generate Script' })).toBeVisible();
    await expect(page.locator('.puyow-tools-output-title')).toHaveText('Generated Script');
    // 색상 선택 칸은 영어에서 색 이름만 보여 준다.
    await expect(page.locator('.puyow-tools-grid tbody select option').first()).toHaveText('red');
    await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Next Puyos'))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('T1'))).toBe(true);
  });

  test('영어 화면의 검증 오류 문구도 영어로 나온다', async ({ page }) => {
    await selectMode(page, 'Edit FEVER Pattern');
    await page.getByRole('button', { name: 'Test' }).click();
    await expect(page.locator('.puyow-tools-status'))
      .toHaveText('Test failed: Place at least one puyo on the play field.');
    await expect(page.locator('.puyow-tools-status')).toHaveClass(/is-error/);
  });

  test('영어 화면의 퍼즐뿌요 목표 타입 설명도 영어로 나온다', async ({ page }) => {
    await selectMode(page, 'Edit Puzzle Puyo');
    await expect(page.locator('.puyow-tools-sidebar')).toContainText('Win when the target chain count is reached.');
    await page.locator('.puyow-tools-sidebar select').first().selectOption('clear');
    await expect(page.locator('.puyow-tools-sidebar')).toContainText('Win on an all clear. The condition value is not used.');
  });
});
