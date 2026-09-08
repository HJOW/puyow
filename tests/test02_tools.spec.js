import { test, expect } from '@playwright/test';

// 개발용 도구 화면(tools.html, puyow_tools.js)의 회귀 테스트다.
// 게임 페이지(puyow.html) 자체의 동작은 test01.spec.js가 맡는다.

const TOOLS_PAGE = '/tools.html';

// 도구는 ONNX 추론 적을 쓰지 않지만, 게임 초기화가 CDN에서 27MB wasm을 받으려고 하지 않도록 막는다.
async function blockOnnxWasmCdn(page) {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort('failed'));
}

async function disableLocalAiModel(page) {
  await page.route('**/apis/localmodelinfo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false }) });
  });
}

test.beforeEach(async ({ page }) => {
  await blockOnnxWasmCdn(page);
  await disableLocalAiModel(page);
  await page.goto(TOOLS_PAGE);
  await page.waitForFunction(() => Boolean(window.PuyoWTools && window.PuyoW));
});

/** 편집 화면에 들어간 뒤 시뮬레이터 그리기 모드가 준비될 때까지 기다린다. */
async function selectMode(page, label) {
  await page.getByRole('button', { name: label }).click();
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('simulator_draw');
}

/** 논리 캔버스 좌표를 실제 화면 좌표로 바꾼다. */
async function createCoordinateMapper(page) {
  const box = await page.locator('canvas[data-puyow-canvas="2d"]').boundingBox();
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
  await expect(page.getByRole('button', { name: '불러오기' })).toBeVisible();
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

test('피버 패턴의 스크립트 생성은 FeverStageState 생성 코드를 출력한다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [
      { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' },
      { x: 2, y: 0, color: 'green' }, { x: 0, y: 1, color: 'red' }
    ] },
    suppliedNextPuyos: ['red', 'green']
  }));
  await page.locator('.puyow-tools-sidebar input[type="number"]').first().fill('4');
  await page.getByRole('button', { name: '스크립트 생성' }).click();
  await expect(page.locator('.puyow-tools-output textarea')).toHaveValue(
    'new FeverStageState(\n'
    + '    {"puyos":[{"x":0,"y":0,"color":"red"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":0,"y":1,"color":"red"}]},\n'
    + '    4,\n'
    + "    ['red', 'green'],\n"
    + '    1,\n'
    + "    ['red', 'green', 'blue']\n"
    + ')'
  );
});

test('피버 패턴의 사용할 색상 목록 기본값은 빨강·초록·파랑 3색이다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  const colorSelects = page.locator('.puyow-tools-grid tbody select');
  await expect(colorSelects).toHaveCount(3);
  await expect(colorSelects.nth(0)).toHaveValue('red');
  await expect(colorSelects.nth(1)).toHaveValue('green');
  await expect(colorSelects.nth(2)).toHaveValue('blue');
});

test('사용할 색상 목록이 중복이면 스크립트를 만들지 않고 알린다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [{ x: 0, y: 0, color: 'red' }] },
    suppliedNextPuyos: ['red', 'red']
  }));
  const colorSelects = page.locator('.puyow-tools-grid tbody select');
  await colorSelects.nth(0).selectOption('red');
  await colorSelects.nth(1).selectOption('red');
  await page.getByRole('button', { name: '스크립트 생성' }).click();
  await expect(page.locator('.puyow-tools-output textarea')).toHaveValue('');
  await expect(page.locator('.puyow-tools-status')).toHaveClass(/is-error/);
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

test('불러오기 팝업은 기존 퍼즐뿌요 스크립트를 읽어 편집 화면에 반영한다', async ({ page }) => {
  await selectMode(page, '퍼즐뿌요 개발');
  await page.getByRole('button', { name: '불러오기' }).click();
  await expect(page.locator('.puyow-tools-dialog')).toBeVisible();
  await page.locator('.puyow-tools-dialog textarea').fill(`new PuzzlePuyoStage({
    stageData : {"puyos":[{"x":3,"y":0,"color":"blue"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":4,"y":1,"color":"blue"}]},
    suppliedNextPuyos : [['red', 'red'], ['blue', 'blue']],
    turnLimit : 2,
    winConditionType : 'combo',
    winConditionValue : 2,
    hint : '두 번째에 터뜨려'
})`);
  await page.locator('.puyow-tools-dialog').getByRole('button', { name: '확인' }).click();
  await expect(page.locator('.puyow-tools-dialog')).toBeHidden();
  const loaded = await page.evaluate(() => window.PuyoW.tools.getEditorData());
  expect(loaded.stageData.puyos.length).toBe(4);
  expect(loaded.nextPuyos.slice(0, 2)).toEqual([['red', 'red'], ['blue', 'blue']]);

  await page.getByRole('button', { name: '스크립트 생성' }).click();
  await expect(page.locator('.puyow-tools-output textarea')).toHaveValue(
    'new PuzzlePuyoStage({\n'
    + '    stageData : {"puyos":[{"x":3,"y":0,"color":"blue"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":4,"y":1,"color":"blue"}]},\n'
    + "    suppliedNextPuyos : [['red', 'red'], ['blue', 'blue']],\n"
    + '    turnLimit : 2,\n'
    + "    winConditionType : 'combo',\n"
    + '    winConditionValue : 2,\n'
    + "    hint : '두 번째에 터뜨려'\n"
    + '})'
  );
});

test('불러오기 팝업의 취소는 편집 내용을 바꾸지 않고 닫는다', async ({ page }) => {
  await selectMode(page, '피버 패턴 개발');
  await page.evaluate(() => window.PuyoW.tools.setEditorData({
    stageData: { puyos: [{ x: 0, y: 0, color: 'red' }] },
    suppliedNextPuyos: ['red', 'red']
  }));
  await page.getByRole('button', { name: '불러오기' }).click();
  await page.locator('.puyow-tools-dialog textarea').fill('new FeverStageState({"puyos":[]}, 4, [\'red\', \'red\'], 1, [\'red\'])');
  await page.locator('.puyow-tools-dialog').getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.puyow-tools-dialog')).toBeHidden();
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
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 10000 }).toBe('simulator_draw');
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
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen), { timeout: 10000 }).toBe('simulator_draw');
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
