// 리플레이 재생 페이지(replay.html) 회귀 테스트다. 하단 툴바·JSON 입력 팝업·우측 리플레이 목록과
// 게임 쪽 연결 API(PuyoW.replay)를 다룬다. 게임 페이지(puyow.html)의 기존 일시정지 화면이 그대로인지도 함께 본다.

import { test, expect } from '@playwright/test';

const REPLAY_PAGE = '/replay.html';
const GAME_PAGE = '/puyow.html';

/** 프레임이 손상되어 곧바로 결과 화면으로 넘어가는 짧은 리플레이다(test01_replay 와 같은 형태). */
const CORRUPTED_REPLAY = JSON.stringify({
  version: 3,
  meta: {
    rule: 'standard', watch: false, feverRule: false, feverStart: false, feverLightStart: 0,
    difficulty: 1, aiDifficulty: 1, colors: ['red', 'green', 'yellow', 'blue'],
    players: [{ name: 'PLAYER 1', controller: null }, { name: 'CPU', controller: 'Andromalius' }],
  },
  frames: [{ t: 0, a: { nb: '' } }, { t: 100, a: { nb: '@@@@' } }],
  result: { winner: 1 },
});

/** 게임 공통 준비와 같이 ONNX CDN·Local AI 확인을 막아 외부 환경에 따라 결과가 달라지지 않게 한다. */
async function prepareNetwork(page) {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort('failed'));
  await page.route('**/apis/localmodelinfo', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ available: false })
  }));
}

/** 리플레이 재생 페이지를 열고 게임 초기화를 기다린다. */
async function openReplayPage(page) {
  await page.goto(REPLAY_PAGE);
  await expect.poll(() => page.evaluate(() => window.WebPuyo?.getScreenState?.().screen)).toBe('initial_title');
}

/** 게임과 같은 경로의 replays.json 에서 리플레이 하나를 읽는다. */
function readBundledReplay(page, index = 0) {
  return page.evaluate(async (target) => {
    const response = await fetch('./js/replays.json');
    return JSON.stringify((await response.json())[target]);
  }, index);
}

/** 논리 캔버스 좌표(1280x720)를 눌러 게임 캔버스를 클릭한다. */
async function clickCanvas(page, x, y) {
  const box = await page.locator('canvas[data-puyow-canvas="2d"]').boundingBox();
  await page.mouse.click(box.x + (x / 1280) * box.width, box.y + (y / 720) * box.height);
}

function replayState(page) {
  return page.evaluate(() => window.PuyoW.replay.getState());
}

const toolbarButton = (page, action) => page.locator(`.replay-toolbar [data-replay-action="${action}"]`);

test.describe('리플레이 재생 페이지', () => {
  test.beforeEach(async ({ page }) => {
    await prepareNetwork(page);
    await openReplayPage(page);
  });

  test('처음에는 툴바의 일시중지·처음부터가 꺼져 있고 사이드바와 팝업은 숨겨져 있으며, 캔버스는 툴바 위에 놓인다', async ({ page }) => {
    await expect(toolbarButton(page, 'json')).toBeEnabled();
    await expect(toolbarButton(page, 'list')).toBeEnabled();
    await expect(toolbarButton(page, 'pause')).toBeDisabled();
    await expect(toolbarButton(page, 'restart')).toBeDisabled();
    await expect(page.locator('.replay-sidebar')).toBeHidden();
    await expect(page.locator('.replay-dialog-backdrop')).toBeHidden();
    // 문구는 게임 화면과 같은 언어(테스트 기본 영어)를 따른다.
    await expect(toolbarButton(page, 'json')).toHaveText('Load JSON');
    // 불러오기 전에는 캔버스를 숨기지만(visibility) 배치 크기는 그대로다.
    const canvasBox = await page.evaluate(() => document.querySelector('canvas[data-puyow-canvas="2d"]').getBoundingClientRect().toJSON());
    const toolbarBox = await page.locator('.replay-toolbar').boundingBox();
    expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(toolbarBox.y + 1);
    expect(canvasBox.width).toBeGreaterThan(0);
  });

  test('툴바 오른쪽 끝의 게임으로 돌아가기 링크를 누르면 게임 페이지로 이동한다', async ({ page }) => {
    const link = page.locator('.replay-toolbar .replay-back-link');
    await expect(link).toHaveText('Back to game');
    await expect(link).toHaveAttribute('href', './puyow.html');
    // 링크는 툴바의 마지막 요소이며 다른 버튼보다 오른쪽, 툴바 오른쪽 끝 가까이에 있다.
    const [linkBox, restartBox, toolbarBox] = await Promise.all([link.boundingBox(), toolbarButton(page, 'restart').boundingBox(), page.locator('.replay-toolbar').boundingBox()]);
    expect(linkBox.x).toBeGreaterThan(restartBox.x + restartBox.width);
    expect(toolbarBox.x + toolbarBox.width - (linkBox.x + linkBox.width)).toBeLessThan(40);
    await link.click();
    await page.waitForURL(/\/puyow\.html$/);
    await expect.poll(() => page.evaluate(() => window.WebPuyo?.getScreenState?.().screen)).toBe('initial_title');
  });

  test('리플레이를 불러오기 전에는 게임 캔버스를 숨기고 게임 입력도 받지 않으며, 불러오면 캔버스를 보인다', async ({ page }) => {
    const target = page.locator('#puyow_target');
    const guide = page.locator('.replay-empty-guide');
    await expect(target).toBeHidden();
    await expect(page.locator('canvas[data-puyow-canvas="2d"]')).toBeHidden();
    await expect(guide).toBeVisible();
    // 숨긴 초기 화면이 Enter·ESC 로 메인 메뉴 등으로 넘어가면 안 된다.
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

    expect(await page.evaluate((json) => window.PuyoWReplay.load(json), await readBundledReplay(page, 0))).toBe(true);
    await expect(target).toBeVisible();
    await expect(page.locator('canvas[data-puyow-canvas="2d"]')).toBeVisible();
    await expect(guide).toBeHidden();
  });

  test('JSON 불러오기 팝업은 textarea 입력을 게임에 넘기지 않고, 취소·실패·성공을 구분한다', async ({ page }) => {
    await toolbarButton(page, 'json').click();
    const dialog = page.locator('.replay-dialog-backdrop');
    const input = dialog.locator('textarea');
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();
    // 게임은 Enter·Space 기본 동작을 막고 Enter 로 메인 메뉴에 들어가므로, 팝업 안의 키 입력이 게임에 가면 안 된다.
    await page.keyboard.type('a b');
    await page.keyboard.press('Enter');
    await page.keyboard.type('c');
    await expect(input).toHaveValue('a b\nc');
    expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

    await dialog.locator('[data-replay-action="dialog-cancel"]').click();
    await expect(dialog).toBeHidden();
    expect((await replayState(page)).loaded).toBe(false);

    // 올바르지 않은 JSON 은 팝업 안에 바로 알리고 팝업을 닫지 않는다.
    await toolbarButton(page, 'json').click();
    await input.fill('{"version": 3, "meta": {}}');
    await dialog.locator('[data-replay-action="dialog-confirm"]').click();
    await expect(dialog.locator('.replay-dialog-message')).toBeVisible();
    await expect(dialog).toBeVisible();
    expect((await replayState(page)).loaded).toBe(false);
    await expect(toolbarButton(page, 'pause')).toBeDisabled();

    // 올바른 리플레이는 팝업을 닫고 카운트다운부터 재생하며 툴바 버튼을 켠다.
    await input.fill(await readBundledReplay(page, 0));
    await dialog.locator('[data-replay-action="dialog-confirm"]').click();
    await expect(dialog).toBeHidden();
    const state = await replayState(page);
    expect(state.loaded).toBe(true);
    expect(state.countdown).toBeGreaterThan(0);
    await expect(toolbarButton(page, 'pause')).toBeEnabled();
    await expect(toolbarButton(page, 'restart')).toBeEnabled();
    expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  });

  test('일시중지는 카운트다운 중에는 반응하지 않고, 일시정지 화면에는 종료 없이 재개·다시하기만 있다', async ({ page }) => {
    test.setTimeout(60000);
    expect(await page.evaluate((json) => window.PuyoWReplay.load(json), await readBundledReplay(page, 0))).toBe(true);
    const pause = toolbarButton(page, 'pause');

    // 카운트다운 중에 눌러도 아무 일도 하지 않는다.
    await pause.click();
    let state = await replayState(page);
    expect(state.countdown).toBeGreaterThan(0);
    expect(state.paused).toBe(false);
    await expect(pause).toBeEnabled();

    await expect.poll(async () => (await replayState(page)).countdown).toBe(0);
    await pause.click();
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
    await expect(pause).toBeDisabled();
    await expect(toolbarButton(page, 'restart')).toBeEnabled();

    // 본 게임에서 종료 버튼이 있던 자리(755~905)를 눌러도 메뉴로 나가지 않는다.
    await clickCanvas(page, 830, 408);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
    // 버튼이 둘이므로 방향키로 두 번 옮기면 다시 재개 버튼에 온다.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    // 가운데로 옮긴 재개 버튼(470~620)으로 재개하면 일시중지 버튼이 다시 켜진다.
    await clickCanvas(page, 545, 408);
    await expect.poll(async () => (await replayState(page)).paused).toBe(false);
    await expect(pause).toBeEnabled();
    state = await replayState(page);
    expect(state.countdown).toBeGreaterThan(0);
  });

  test('처음부터는 재생 중·일시정지 중 모두 카운트다운부터 다시 재생한다', async ({ page }) => {
    test.setTimeout(60000);
    expect(await page.evaluate((json) => window.PuyoWReplay.load(json), await readBundledReplay(page, 0))).toBe(true);
    await expect.poll(async () => (await replayState(page)).countdown).toBe(0);
    await page.waitForTimeout(500);

    await toolbarButton(page, 'restart').click();
    await expect.poll(async () => (await replayState(page)).countdown).toBeGreaterThan(2000);
    expect((await page.evaluate(() => window.WebPuyo.getGameState())).elapsed ?? 0).toBeLessThan(500);

    await expect.poll(async () => (await replayState(page)).countdown).toBe(0);
    await toolbarButton(page, 'pause').click();
    await expect.poll(async () => (await replayState(page)).paused).toBe(true);
    await toolbarButton(page, 'restart').click();
    await expect.poll(async () => (await replayState(page)).countdown).toBeGreaterThan(2000);
    expect((await replayState(page)).paused).toBe(false);
    await expect(toolbarButton(page, 'pause')).toBeEnabled();
  });

  test('재생이 끝나면 일시중지는 꺼지고 처음부터로 다시 재생할 수 있다', async ({ page }) => {
    test.setTimeout(60000);
    expect(await page.evaluate((json) => window.PuyoWReplay.load(json), CORRUPTED_REPLAY)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('game_over');
    await expect(toolbarButton(page, 'pause')).toBeDisabled();
    await expect(toolbarButton(page, 'restart')).toBeEnabled();
    await toolbarButton(page, 'restart').click();
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
    await expect(toolbarButton(page, 'pause')).toBeEnabled();
  });

  test('재생이 끝난 결과 화면에는 종료 버튼이 없고 ESC 로도 메뉴에 나가지 않는다', async ({ page }) => {
    test.setTimeout(60000);
    expect(await page.evaluate((json) => window.PuyoWReplay.load(json), CORRUPTED_REPLAY)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('game_over');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    // 종료 버튼이 없으므로 0번(기본 포커스)은 다시보기다. Enter 로 다시 재생한다.
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
    await expect(page.locator('#puyow_target')).toBeVisible();

    // 본 게임에서 0번 종료 버튼이 있던 자리(165~229)는 이제 다시보기다.
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('game_over');
    await clickCanvas(page, 640, 197);
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  });

  test('목록에서 불러오기는 replays.json 을 번호·룰·색상 수와 함께 보여 주고, 고르면 사이드바를 닫고 재생한다', async ({ page }) => {
    await toolbarButton(page, 'list').click();
    const sidebar = page.locator('.replay-sidebar');
    await expect(sidebar).toBeVisible();
    const items = sidebar.locator('.replay-list-button');
    const expectedCount = await page.evaluate(async () => (await (await fetch('./js/replays.json')).json()).length);
    await expect(items).toHaveCount(expectedCount);
    const first = await page.evaluate(async () => (await (await fetch('./js/replays.json')).json())[0].meta);
    // 테스트 기본 언어는 영어이므로 페이지 번역표의 영어 원문이 그대로 보인다.
    const ruleLabel = { standard: 'Standard Rules', fever: 'FEVER Rules', feverStart: 'FEVER Rules (Start)', relaxedFever: 'FEVER (Relaxed)' }[first.rule];
    const colorLabel = `${first.colors.length} Colors`;
    await expect(items.nth(0).locator('.replay-list-number')).toHaveText('1.');
    await expect(items.nth(0).locator('.replay-list-title')).toContainText(ruleLabel);
    await expect(items.nth(0).locator('.replay-list-title')).toContainText(colorLabel);
    await expect(items.nth(1).locator('.replay-list-number')).toHaveText('2.');

    await items.nth(1).click();
    await expect(sidebar).toBeHidden();
    expect((await replayState(page)).loaded).toBe(true);
    await expect(toolbarButton(page, 'pause')).toBeEnabled();
    await expect(toolbarButton(page, 'restart')).toBeEnabled();

    // 닫기 버튼과 ESC 로도 사이드바를 닫는다.
    await toolbarButton(page, 'list').click();
    await expect(sidebar).toBeVisible();
    await sidebar.locator('[data-replay-action="close-list"]').click();
    await expect(sidebar).toBeHidden();
    await toolbarButton(page, 'list').click();
    await sidebar.locator('.replay-list-button').first().focus();
    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden();
    // 사이드바 안에서 누른 ESC 는 게임 일시정지로 넘어가지 않는다.
    expect((await replayState(page)).paused).toBe(false);
  });

  test('목록 파일을 읽지 못하거나 JSON 이 아니면 빈 목록을 보이고 오류를 기록한다', async ({ page }) => {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/js/replays.json', (route) => route.fulfill({ status: 404, body: 'not found' }));
    await toolbarButton(page, 'list').click();
    const sidebar = page.locator('.replay-sidebar');
    await expect(sidebar.locator('.replay-sidebar-status')).toBeVisible();
    await expect(sidebar.locator('.replay-list-button')).toHaveCount(0);
    await expect.poll(() => errors.some((text) => text.includes('리플레이 목록을 불러오지 못했습니다.'))).toBe(true);

    // 실패한 목록은 보관하지 않으므로 다시 열면 새로 읽는다. 이번에는 JSON 해석 실패다.
    errors.length = 0;
    await page.unroute('**/js/replays.json');
    await page.route('**/js/replays.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{not json' }));
    await sidebar.locator('[data-replay-action="close-list"]').click();
    await toolbarButton(page, 'list').click();
    await expect.poll(() => errors.some((text) => text.includes('리플레이 목록을 불러오지 못했습니다.'))).toBe(true);
    await expect(sidebar.locator('.replay-list-button')).toHaveCount(0);
  });

  test('목록 항목을 불러오지 못하면 사이드바에 알리고 열어 둔다', async ({ page }) => {
    await page.route('**/js/replays.json', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([{ version: 1, meta: { rule: 'standard', colors: ['red'] } }, 5])
    }));
    await toolbarButton(page, 'list').click();
    const sidebar = page.locator('.replay-sidebar');
    await expect(sidebar.locator('.replay-list-button')).toHaveCount(2);
    await sidebar.locator('.replay-list-button').nth(1).click();
    await expect(sidebar.locator('.replay-sidebar-message')).toBeVisible();
    await expect(sidebar.locator('.replay-sidebar-message')).toContainText('2.');
    await expect(sidebar).toBeVisible();
    expect((await replayState(page)).loaded).toBe(false);
    await expect(toolbarButton(page, 'pause')).toBeDisabled();
  });
});

test.describe('게임 페이지의 리플레이 일시정지', () => {
  test.beforeEach(async ({ page }) => {
    await prepareNetwork(page);
  });

  test('리플레이 재생 페이지가 아니면 일시정지 화면의 종료 버튼으로 메인 메뉴에 나간다', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(GAME_PAGE);
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
    const replay = await readBundledReplay(page, 0);
    expect(await page.evaluate((json) => window.PuyoW.replay.load(json), replay)).toBe(true);
    await expect.poll(async () => (await replayState(page)).countdown).toBe(0);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
    await clickCanvas(page, 830, 408);
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  });

  test('리플레이 재생 페이지가 아니면 재생 결과 화면의 0번 종료 버튼·ESC 로 메인 메뉴에 나간다', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(GAME_PAGE);
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
    expect(await page.evaluate((json) => window.PuyoW.replay.load(json), CORRUPTED_REPLAY)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('game_over');
    await clickCanvas(page, 640, 197);
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

    expect(await page.evaluate((json) => window.PuyoW.replay.load(json), CORRUPTED_REPLAY)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('game_over');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  });
});

// 페이지 문구는 puyow_replay.js 의 자체 번역표(영어 원문 키)를 쓰고, 게임 화면 언어(설정값, 없으면 브라우저 언어)를 따른다.
test.describe('리플레이 재생 페이지의 다국어', () => {
  /** 로케일별로 확인할 문구다. 툴바 네 버튼·게임으로 돌아가기 링크·안내 문구·첫 목록 항목의 룰·색 수·구경 표시다. */
  const EXPECTED = {
    'ko-KR': { lang: 'ko', buttons: ['JSON 불러오기', '목록에서 불러오기', '일시중지', '처음부터'], guide: 'JSON 불러오기 또는 목록에서 불러오기로 리플레이를 불러와 주세요.', rule: '피버 (완화)', colors: '5색', watch: '구경', back: '게임으로 돌아가기' },
    'ja-JP': { lang: 'ja', buttons: ['JSONを読み込む', 'リストから読み込む', '一時停止', '最初から'], guide: '「JSONを読み込む」または「リストから読み込む」でリプレイを読み込んでください。', rule: 'FEVER（緩和）', colors: '5色', watch: '観戦', back: 'ゲームに戻る' },
    'zh-CN': { lang: 'zh', buttons: ['加载JSON', '从列表加载', '暂停', '从头播放'], guide: '请通过“加载JSON”或“从列表加载”加载回放。', rule: 'FEVER（缓和）', colors: '5色', watch: '观战', back: '返回游戏' },
    'de-DE': { lang: 'de', buttons: ['JSON laden', 'Aus Liste laden', 'Pause', 'Von vorn'], guide: 'Lade eine Wiederholung über „JSON laden“ oder „Aus Liste laden“.', rule: 'FEVER (Entspannt)', colors: '5 Farben', watch: 'Zuschauen', back: 'Zurück zum Spiel' },
    'fr-FR': { lang: 'fr', buttons: ['Charger le JSON', 'Charger depuis la liste', 'Pause', 'Recommencer'], guide: 'Chargez une reprise avec « Charger le JSON » ou « Charger depuis la liste ».', rule: 'FEVER (adouci)', colors: '5 couleurs', watch: 'Regarder', back: 'Retour au jeu' },
    // 지원하지 않는 언어는 기본 언어인 영어로 보인다.
    'es-ES': { lang: 'en', buttons: ['Load JSON', 'Load from List', 'Pause', 'Restart'], guide: 'Load a replay with Load JSON or Load from List.', rule: 'FEVER (Relaxed)', colors: '5 Colors', watch: 'Watch', back: 'Back to game' }
  };

  for (const [locale, expected] of Object.entries(EXPECTED)) {
    test.describe(locale, () => {
      test.use({ locale });

      test(`${locale} 로케일에서 툴바·안내·목록·팝업 문구가 ${expected.lang} 로 보인다`, async ({ page }) => {
        await prepareNetwork(page);
        await openReplayPage(page);
        expect(await page.evaluate(() => document.documentElement.lang)).toBe(expected.lang);
        expect(await page.evaluate(() => window.PuyoWReplay.getLanguage())).toBe(expected.lang);
        expect(await page.locator('.replay-toolbar .replay-button').allTextContents()).toEqual(expected.buttons);
        await expect(page.locator('.replay-toolbar .replay-back-link')).toHaveText(expected.back);
        await expect(page.locator('.replay-empty-guide')).toHaveText(expected.guide);

        await toolbarButton(page, 'list').click();
        const title = page.locator('.replay-list-button').first().locator('.replay-list-title');
        await expect(title).toHaveText(`${expected.rule} · ${expected.colors} · ${expected.watch}`);
        await page.locator('[data-replay-action="close-list"]').click();

        await toolbarButton(page, 'json').click();
        await page.locator('[data-replay-action="dialog-confirm"]').click();
        await expect(page.locator('.replay-dialog-message')).toHaveText(await page.evaluate(() => window.PuyoWReplay.translate('Enter the JSON code.')));
      });
    });
  }

  test('저장된 게임 언어 설정이 있으면 브라우저 언어보다 그것을 따른다', async ({ page }) => {
    await prepareNetwork(page);
    await page.addInitScript(() => {
      // 게임 저장값은 clearList 배열이 있어야 올바른 값으로 읽는다.
      localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { language: 'de', playerName: 'PLAYER 1' } }));
    });
    await openReplayPage(page);
    expect(await page.evaluate(() => window.PuyoWReplay.getLanguage())).toBe('de');
    await expect(toolbarButton(page, 'json')).toHaveText('JSON laden');
  });
});

test.describe('리플레이 재생 페이지의 WebMCP', () => {
  test.beforeEach(async ({ page }) => {
    await prepareNetwork(page);
    await page.addInitScript(() => {
      window.registeredWebMcpTools = [];
      Object.defineProperty(document, 'modelContext', {
        configurable: true,
        writable: true,
        value: { registerTool: (tool) => window.registeredWebMcpTools.push(tool) }
      });
    });
    await openReplayPage(page);
    await page.waitForFunction(() => window.registeredWebMcpTools.some((tool) => tool.name === 'replay_manual'));
  });

  /** 등록된 도구를 이름으로 불러 결과를 돌려준다. */
  function callTool(page, name, input = {}) {
    return page.evaluate(async ([toolName, toolInput]) => {
      const tool = window.registeredWebMcpTools.find((entry) => entry.name === toolName);
      return tool.execute(toolInput);
    }, [name, input]);
  }

  async function status(page) {
    return JSON.parse(await callTool(page, 'replay_status'));
  }

  test('replay_ 접두어 도구 열 개를 게임 도구와 함께 등록한다', async ({ page }) => {
    const names = await page.evaluate(() => window.registeredWebMcpTools.map((tool) => tool.name));
    expect(names.filter((name) => name.startsWith('replay_'))).toEqual([
      'replay_manual', 'replay_status', 'replay_list', 'replay_load_from_list', 'replay_load_json',
      'replay_pause', 'replay_resume', 'replay_restart', 'replay_get_json', 'replay_show_panel'
    ]);
    // 게임 캔버스의 도구도 같은 문서에 있으므로 이름이 겹치면 안 된다.
    expect(names).toContain('manual');
    expect(new Set(names).size).toBe(names.length);
    const readOnly = await page.evaluate(() => window.registeredWebMcpTools
      .filter((tool) => tool.name.startsWith('replay_') && tool.annotations?.readOnlyHint).map((tool) => tool.name));
    expect(readOnly).toEqual(['replay_manual', 'replay_status', 'replay_list', 'replay_get_json']);
    expect(await callTool(page, 'replay_manual')).toContain('replay_load_from_list');
  });

  test('목록 조회·목록 불러오기·일시정지·재개·처음부터·JSON 조회를 도구로 모두 할 수 있다', async ({ page }) => {
    test.setTimeout(60000);
    let current = await status(page);
    expect(current.phase).toBe('empty');
    expect(current.canvasVisible).toBe(false);
    expect(current.toolbar).toEqual({ pauseEnabled: false, restartEnabled: false });
    expect(await callTool(page, 'replay_pause')).toContain('No replay is loaded');

    const list = JSON.parse(await callTool(page, 'replay_list'));
    const bundled = await page.evaluate(async () => (await (await fetch('./js/replays.json')).json()));
    expect(list.loadFailed).toBe(false);
    expect(list.count).toBe(bundled.length);
    expect(list.replays[0]).toMatchObject({ number: 1, playable: true, rule: bundled[0].meta.rule, colorCount: bundled[0].meta.colors.length, watch: bundled[0].meta.watch });

    // 사이드바를 연 상태에서 목록으로 불러오면 사이드바가 닫힌다.
    expect(await callTool(page, 'replay_show_panel', { panel: 'list' })).toContain('Opened the replay list');
    expect((await status(page)).openPanel).toBe('list');
    expect(await callTool(page, 'replay_load_from_list', { number: 2 })).toContain('Loaded replay 2');
    await expect(page.locator('.replay-sidebar')).toBeHidden();
    current = await status(page);
    expect(current.phase).toBe('countdown');
    expect(current.canvasVisible).toBe(true);
    expect(current.openPanel).toBe('none');
    expect(current.replay).toMatchObject({ rule: bundled[1].meta.rule, colorCount: bundled[1].meta.colors.length });
    await expect(page.locator('#puyow_target')).toBeVisible();

    // 카운트다운 중 일시정지는 거절한다.
    expect(await callTool(page, 'replay_pause')).toContain('countdown');
    await expect.poll(async () => (await status(page)).phase).toBe('playing');
    expect(await callTool(page, 'replay_pause')).toBe('Paused the replay.');
    current = await status(page);
    expect(current.phase).toBe('paused');
    expect(current.toolbar.pauseEnabled).toBe(false);
    await expect(toolbarButton(page, 'pause')).toBeDisabled();
    expect(await callTool(page, 'replay_pause')).toContain('already paused');

    expect(await callTool(page, 'replay_resume')).toContain('Resumed');
    expect((await status(page)).phase).toBe('countdown');
    await expect(toolbarButton(page, 'pause')).toBeEnabled();
    expect(await callTool(page, 'replay_resume')).toContain('not paused');

    await expect.poll(async () => (await status(page)).phase).toBe('playing');
    await page.waitForTimeout(500);
    expect(await callTool(page, 'replay_restart')).toContain('Restarting');
    await expect.poll(async () => (await status(page)).countdownMs).toBeGreaterThan(2000);

    // 결과 화면의 리플레이 복사와 같은 JSON 을 돌려준다.
    const json = JSON.parse(await callTool(page, 'replay_get_json'));
    expect(json.meta).toEqual(bundled[1].meta);

    await expect(callTool(page, 'replay_load_from_list', { number: bundled.length + 1 })).rejects.toThrow();
  });

  test('replay_load_json 과 replay_show_panel 은 팝업과 같은 방식으로 불러오고 패널을 열고 닫는다', async ({ page }) => {
    expect(await callTool(page, 'replay_show_panel', { panel: 'json' })).toBe('Opened the Load JSON popup.');
    await expect(page.locator('.replay-dialog-backdrop')).toBeVisible();
    expect((await status(page)).openPanel).toBe('json');

    expect(await callTool(page, 'replay_load_json', { json: '{"version": 3}' })).toContain('invalid');
    await expect(page.locator('.replay-dialog-backdrop')).toBeVisible();
    expect((await status(page)).loaded).toBe(false);

    expect(await callTool(page, 'replay_load_json', { json: await readBundledReplay(page, 0) })).toContain('Loaded the replay');
    await expect(page.locator('.replay-dialog-backdrop')).toBeHidden();
    expect((await status(page)).phase).toBe('countdown');

    await callTool(page, 'replay_show_panel', { panel: 'list' });
    await expect(page.locator('.replay-sidebar')).toBeVisible();
    expect(await callTool(page, 'replay_show_panel', { panel: 'none' })).toContain('Closed');
    await expect(page.locator('.replay-sidebar')).toBeHidden();
    expect((await status(page)).openPanel).toBe('none');
  });

  test('재생이 끝나면 replay_status 가 finished 를 알리고 replay_restart 로 다시 재생한다', async ({ page }) => {
    test.setTimeout(60000);
    await callTool(page, 'replay_load_json', { json: CORRUPTED_REPLAY });
    await expect.poll(async () => (await status(page)).phase, { timeout: 20000 }).toBe('finished');
    const current = await status(page);
    expect(current.toolbar).toEqual({ pauseEnabled: false, restartEnabled: true });
    expect(current.gameScreen).toBe('game_over');
    expect(await callTool(page, 'replay_pause')).toContain('finished');
    expect(await callTool(page, 'replay_restart')).toContain('Restarting');
    await expect.poll(async () => (await status(page)).phase).toBe('countdown');
  });
});
