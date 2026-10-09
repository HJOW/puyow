// 가상 컨트롤러 '자동' 선택과 터치스크린 기기의 prompt 텍스트 입력 회귀 테스트다.
// 터치스크린·게임패드 유무에 따른 가상 컨트롤러 표시, 최초 이름 입력·설정 텍스트·코드 입력·askText·온라인 로그인의
// 웹표준 prompt 입력, prompt 뒤에도 설정 화면의 방향키·Enter·마우스가 평소처럼 동작하는지를 다룬다.
// 공통 준비 코드가 터치스크린 없음·prompt 기록용 대체 함수를 기준선으로 깔아 두므로(tests/common/gamepage.js),
// 터치스크린 기기는 window.setTestTouchPoints(1)로, prompt 응답은 window.testPromptResponses로 흉내 낸다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, openSettings, translated } from './common/gamepage.js';

setupGamePage();

const screen = (page) => page.evaluate(() => window.PuyoW.getScreenState().screen);
const clickLogical = (page, x, y) => page.locator('[data-puyow-canvas="2d"]').click({ position: { x, y } });
const nextFrames = (page, count = 3) => page.evaluate((frames) => new Promise((resolve) => {
  const step = (left) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
  step(frames);
}), count);
const promptCalls = (page) => page.evaluate(() => window.testPromptCalls);
const savedSettings = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings);
// 페이지를 연 뒤 한 번이라도 그려진 문구인지 확인한다.
const canvasHasText = (page, text) => page.evaluate((value) => window.testCanvasTexts.includes(value), text);
/** 기록을 비운 뒤 새로 그린 프레임에 문구가 있는지 확인한다. 지금 화면의 상태를 볼 때 쓴다. */
async function currentCanvasHasText(page, text) {
  await page.evaluate(() => { window.testCanvasTexts = []; });
  await nextFrames(page, 3);
  return canvasHasText(page, text);
}

/** 지정한 설정으로 저장 데이터를 만들고 게임을 다시 읽는다. 터치스크린 여부는 다시 읽은 뒤에 정해야 한다. */
async function reloadWithSettings(page, settings) {
  await page.evaluate((value) => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: value }));
  }, settings);
  await page.reload();
  await expect.poll(() => screen(page)).toBe('initial_title');
}

/** 메인 메뉴에서 연습 대전을 시작해 조작할 수 있을 때까지 기다린다. */
async function startPractice(page) {
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('rule_select');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
}

/** 지금 화면에 그려지는 가상 컨트롤러 버튼(Z·X·ESC)의 문구와 위치를 모은다. 그려지지 않으면 빈 배열이다. */
async function drawnVirtualButtons(page) {
  await page.evaluate(() => { window.testCanvasTextCalls = []; });
  await nextFrames(page, 3);
  return page.evaluate(() => {
    const found = new Map();
    window.testCanvasTextCalls.filter((call) => ['Z', 'X', 'ESC'].includes(call.text))
      .forEach((call) => found.set(call.text, { text: call.text, x: call.x, y: call.y }));
    return ['Z', 'X', 'ESC'].filter((text) => found.has(text)).map((text) => found.get(text));
  });
}

const NORMAL_BUTTONS = [{ text: 'Z', x: 1090, y: 591 }, { text: 'X', x: 1170, y: 591 }, { text: 'ESC', x: 1170, y: 501 }];
const LARGE_BUTTONS = [{ text: 'Z', x: 1060, y: 591 }, { text: 'X', x: 1200, y: 611 }, { text: 'ESC', x: 1200, y: 481 }];
const rotation = (page) => page.evaluate(() => window.PuyoW.getGameState().player.active.rotation);

test('새 저장의 가상 컨트롤러 기본값은 자동이고 이미 저장된 선택은 그대로 둔다', async ({ page }) => {
  // 저장 데이터가 없는 최초 실행에서 설정을 그대로 저장하면 자동이 기록된다.
  await page.evaluate(() => localStorage.removeItem('puyow_store'));
  await page.reload();
  await expect.poll(() => screen(page)).toBe('initial_title');
  await openSettings(page);
  const autoLabel = await translated(page, '자동');
  await expect.poll(() => canvasHasText(page, autoLabel)).toBe(true);
  // 이름 행에서 저장 버튼까지 내려간다(제공자 미선택 기준 11번).
  for (let index = 0; index < 11; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('main_menu');
  expect((await savedSettings(page)).virtualController).toBe('auto');

  // 값이 없거나 알 수 없는 저장값은 자동으로, 이전 불리언과 이미 고른 값은 기존 규칙대로 보정한다.
  for (const [stored, expected] of [[undefined, 'auto'], ['bogus', 'auto'], ['none', 'none'], ['normal', 'normal'], ['large', 'large'], [true, 'normal'], [false, 'none']]) {
    await reloadWithSettings(page, { playerName: 'PLAYER 1', virtualController: stored });
    expect((await savedSettings(page)).virtualController).toBe(expected);
  }
});

test('자동은 터치스크린도 게임패드도 없으면 가상 컨트롤러를 숨기고 텍스트 입력은 기존 그대로다', async ({ page }) => {
  await reloadWithSettings(page, { playerName: 'PLAYER 1', virtualController: 'auto' });
  await openSettings(page);
  // 이름 입력란을 누르면 prompt 없이 캔버스 문자 입력 모드로 들어간다.
  await clickLogical(page, 600, 82);
  await page.keyboard.press('Control+A');
  await page.keyboard.type('PCUSER');
  await page.keyboard.press('Enter');
  await expect.poll(() => canvasHasText(page, 'PCUSER')).toBe(true);
  expect(await promptCalls(page)).toEqual([]);
  await clickLogical(page, 480, 671);
  await expect.poll(() => screen(page)).toBe('main_menu');
  expect((await savedSettings(page)).playerName).toBe('PCUSER');

  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowUp');
  await startPractice(page);
  expect(await drawnVirtualButtons(page)).toEqual([]);
  // 버튼이 없으므로 X 버튼 자리를 눌러도 회전하지 않는다.
  const before = await rotation(page);
  await clickLogical(page, 1170, 590);
  await nextFrames(page, 2);
  expect(await rotation(page)).toBe(before);
});

test('자동은 게임패드 없이 터치스크린만 있으면 보통 크기 가상 컨트롤러를 그리고 게임패드를 연결하면 숨긴다', async ({ page }) => {
  await reloadWithSettings(page, { playerName: 'PLAYER 1', virtualController: 'auto' });
  await enterMainMenu(page);
  await page.evaluate(() => window.setTestTouchPoints(1));
  await startPractice(page);

  expect(await drawnVirtualButtons(page)).toEqual(NORMAL_BUTTONS);
  const beforePress = await rotation(page);
  await clickLogical(page, 1170, 590);
  await expect.poll(() => rotation(page)).toBe((beforePress + 1) % 4);

  // 게임패드가 잡히면 터치스크린이 있어도 가상 컨트롤러를 숨기고 버튼 자리의 터치도 받지 않는다.
  await page.evaluate(() => window.setTestGamepad());
  await expect.poll(() => drawnVirtualButtons(page)).toEqual([]);
  const beforeHidden = await rotation(page);
  await clickLogical(page, 1170, 590);
  await nextFrames(page, 2);
  expect(await rotation(page)).toBe(beforeHidden);

  // 게임패드를 뽑으면 다시 휴대폰으로 보아 가상 컨트롤러가 돌아온다.
  await page.evaluate(() => window.clearTestGamepad());
  await expect.poll(() => drawnVirtualButtons(page)).toEqual(NORMAL_BUTTONS);
});

test('자동은 터치스크린 없이 게임패드만 있으면 가상 컨트롤러를 숨기고 텍스트 입력은 기존 그대로다', async ({ page }) => {
  await reloadWithSettings(page, { playerName: 'PLAYER 1', virtualController: 'auto' });
  await openSettings(page);
  await page.evaluate(() => window.setTestGamepad());
  await nextFrames(page, 3);
  // 게임패드만 있는 기기는 키보드가 있다고 보고 캔버스 문자 입력을 그대로 쓴다.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('PADUSER');
  await page.keyboard.press('Enter');
  await expect.poll(() => canvasHasText(page, 'PADUSER')).toBe(true);
  expect(await promptCalls(page)).toEqual([]);
  await clickLogical(page, 480, 671);
  await expect.poll(() => screen(page)).toBe('main_menu');

  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowUp');
  await startPractice(page);
  expect(await drawnVirtualButtons(page)).toEqual([]);
});

test('없음은 터치스크린이 있어도 숨긴 채 캔버스 입력을 쓰고, 크게는 게임패드가 있어도 큰 가상 컨트롤러와 prompt 입력을 쓴다', async ({ page }) => {
  await reloadWithSettings(page, { playerName: 'PLAYER 1', virtualController: 'none' });
  await openSettings(page);
  await page.evaluate(() => window.setTestTouchPoints(1));
  await clickLogical(page, 600, 82);
  await page.keyboard.press('Control+A');
  await page.keyboard.type('NONEUSER');
  await page.keyboard.press('Enter');
  await expect.poll(() => canvasHasText(page, 'NONEUSER')).toBe(true);
  expect(await promptCalls(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('main_menu');
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowUp');
  await startPractice(page);
  expect(await drawnVirtualButtons(page)).toEqual([]);

  await reloadWithSettings(page, { playerName: 'PLAYER 1', virtualController: 'large' });
  await openSettings(page);
  await page.evaluate(() => { window.setTestTouchPoints(1); window.setTestGamepad(); window.testPromptResponses = ['LARGEUSER']; });
  await clickLogical(page, 600, 82);
  await expect.poll(() => canvasHasText(page, 'LARGEUSER')).toBe(true);
  expect(await promptCalls(page)).toEqual([{ message: await translated(page, '이름'), defaultValue: 'PLAYER 1' }]);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('main_menu');
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowUp');
  await startPractice(page);
  expect(await drawnVirtualButtons(page)).toEqual(LARGE_BUTTONS);
});

test('터치스크린 기기의 최초 이름 입력은 입력란을 누르면 prompt로 받고 공란은 취소로 처리한다', async ({ page }) => {
  await reloadWithSettings(page, { playerName: '' });
  await page.evaluate(() => window.setTestTouchPoints(1));
  await page.keyboard.press('Enter');
  const title = await translated(page, '이름 또는 닉네임을 입력하세요');
  await expect.poll(() => canvasHasText(page, title)).toBe(true);

  // 캔버스에 직접 치는 글자는 받지 않는다.
  await page.keyboard.type('TYPED');
  await nextFrames(page, 2);
  expect(await canvasHasText(page, 'TYPED')).toBe(false);

  // 공란(공백만 입력)과 취소는 모두 취소로 처리해 입력란을 바꾸지 않는다.
  await page.evaluate(() => { window.testPromptResponses = ['   ', null, 'TOUCHNAME12345']; });
  await clickLogical(page, 640, 370);
  await clickLogical(page, 640, 370);
  expect(await promptCalls(page)).toEqual([{ message: title, defaultValue: '' }, { message: title, defaultValue: '' }]);
  expect((await savedSettings(page)).playerName).toBe('');

  // 입력한 이름은 게임 화면의 입력란에 최대 10자로 들어가고, 확인 버튼을 눌러야 저장된다.
  await clickLogical(page, 640, 370);
  await expect.poll(() => canvasHasText(page, 'TOUCHNAME1')).toBe(true);
  expect((await savedSettings(page)).playerName).toBe('');
  // 다시 열면 지금 입력란의 값이 prompt에 미리 채워진다.
  await page.evaluate(() => { window.testPromptResponses = ['BAD/NAME']; });
  await clickLogical(page, 640, 370);
  expect((await promptCalls(page)).at(-1)).toEqual({ message: title, defaultValue: 'TOUCHNAME1' });
  await clickLogical(page, 640, 469);
  await expect.poll(async () => canvasHasText(page, await translated(page, '이름에 사용할 수 없는 문자가 있습니다.'))).toBe(true);
  expect((await savedSettings(page)).playerName).toBe('');

  await page.evaluate(() => { window.testPromptResponses = ['TOUCHUSER']; });
  await clickLogical(page, 640, 370);
  await clickLogical(page, 640, 469);
  expect((await savedSettings(page)).playerName).toBe('TOUCHUSER');
  // 대화상자가 닫힌 뒤 메인 메뉴가 평소처럼 동작한다.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('together_mode_select');
});

test('터치스크린 기기의 최초 이름 입력은 키보드와 게임패드로도 입력란과 확인 버튼을 오가며 prompt를 연다', async ({ page }) => {
  await reloadWithSettings(page, { playerName: '' });
  await page.evaluate(() => window.setTestTouchPoints(1));
  await page.keyboard.press('Enter');
  const title = await translated(page, '이름 또는 닉네임을 입력하세요');
  await expect.poll(() => canvasHasText(page, title)).toBe(true);

  // 입력란에 포커스가 있을 때 Enter는 제출이 아니라 prompt를 연다.
  await page.evaluate(() => { window.testPromptResponses = ['KEYUSER']; });
  await page.keyboard.press('Enter');
  await expect.poll(() => canvasHasText(page, 'KEYUSER')).toBe(true);
  expect((await savedSettings(page)).playerName).toBe('');

  // 게임패드 A 버튼(Z)도 터치스크린 기기에서는 글자가 아니라 확인 키로 동작해 prompt를 다시 연다.
  await page.evaluate(() => { window.testPromptResponses = ['PADUSER']; window.setTestGamepad([0, 0], [0]); });
  await expect.poll(async () => (await promptCalls(page)).length).toBe(2);
  expect((await promptCalls(page))[1]).toEqual({ message: title, defaultValue: 'KEYUSER' });
  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(150);

  // 스틱을 아래로 내려 확인 버튼으로 옮긴 뒤 A 버튼으로 제출한다.
  await page.evaluate(() => window.setTestGamepad([0, 1]));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(150);
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(async () => (await savedSettings(page)).playerName).toBe('PADUSER');
  expect((await promptCalls(page)).length).toBe(2);
});

test('터치스크린 기기의 설정 텍스트는 prompt로 입력받고 그 뒤에도 방향키·Enter·마우스가 일반 GUI처럼 동작한다', async ({ page }) => {
  await page.route('https://sound.example/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sounds: [] }) });
  });
  await reloadWithSettings(page, { playerName: 'PLAYER 1', virtualController: 'auto' });
  await openSettings(page);
  await page.evaluate(() => window.setTestTouchPoints(1));
  const nameLabel = await translated(page, '이름');
  const soundLabel = await translated(page, '사운드 데이터 URL');

  // 마우스(터치)로 이름 입력란을 누르면 prompt가 열리고, 입력한 내용이 입력란에 들어간다.
  await page.evaluate(() => { window.testPromptResponses = ['NEWNAME']; });
  await clickLogical(page, 600, 82);
  await expect.poll(() => canvasHasText(page, 'NEWNAME')).toBe(true);
  expect(await promptCalls(page)).toEqual([{ message: nameLabel, defaultValue: 'PLAYER 1' }]);

  // prompt가 닫힌 뒤에는 문자 입력 모드가 아니므로 글자를 쳐도 들어가지 않고 방향키가 포커스를 옮긴다.
  await page.keyboard.type('Q');
  expect(await currentCanvasHasText(page, 'NEWNAME')).toBe(true);
  // 이름(0) → 언어 → 볼륨 두 행 → 가상 컨트롤러(4): 오른쪽 방향키로 자동에서 없음으로 바꾼다.
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  // 가상 컨트롤러(4) → 그래픽 → 사운드 데이터 URL(6): Enter가 prompt를 연다.
  for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowDown');
  await page.evaluate(() => { window.testPromptResponses = ['', null, 'https://sound.example/' + 'x'.repeat(250)]; });
  // 공란과 취소는 기존 값을 그대로 둔다.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  expect((await promptCalls(page)).slice(1)).toEqual([{ message: soundLabel, defaultValue: '' }, { message: soundLabel, defaultValue: '' }]);
  await page.keyboard.press('Enter');
  expect((await promptCalls(page)).length).toBe(4);

  // 마우스로 이름 입력란을 다시 눌러도 prompt가 열리고, 이어서 다른 컨트롤 클릭도 그대로 동작한다.
  await page.evaluate(() => { window.testPromptResponses = ['TAPNAME']; });
  await clickLogical(page, 600, 82);
  expect((await promptCalls(page)).at(-1)).toEqual({ message: nameLabel, defaultValue: 'NEWNAME' });
  await clickLogical(page, 900, 214);
  // 포커스가 가상 컨트롤러 행에 있으므로 저장 버튼까지 7번 내려가 Enter로 저장한다.
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('main_menu');
  const settings = await savedSettings(page);
  expect(settings.playerName).toBe('TAPNAME');
  expect(settings.virtualController).toBe('large');
  // 직접 입력할 때와 같은 최대 길이(200자)가 적용된다.
  expect(settings.soundDataURL).toBe(('https://sound.example/' + 'x'.repeat(250)).slice(0, 200));
});

test('터치스크린이 없으면 설정에서 텍스트 항목 밖을 누를 때 문자 입력 모드가 끝난다', async ({ page }) => {
  await reloadWithSettings(page, { playerName: 'PLAYER 1' });
  await openSettings(page);
  // 사운드 데이터 URL을 눌러 입력 모드로 들어간 뒤 배경음악 슬라이더를 누른다.
  await clickLogical(page, 600, 282);
  await page.keyboard.type('abc');
  await clickLogical(page, 700, 146);
  // 방향키로 이름 입력란까지 올라가면 포커스만 있고 입력 모드는 아니어야 한다.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.type('Q');
  expect(await currentCanvasHasText(page, 'PLAYER 1')).toBe(true);
  // Enter로 입력 모드에 들어가야 글자가 들어간다.
  await page.keyboard.press('Enter');
  await page.keyboard.type('Q');
  await expect.poll(() => canvasHasText(page, 'PLAYER 1Q')).toBe(true);
  expect(await promptCalls(page)).toEqual([]);
});

test('터치스크린 기기의 코드 입력창과 askText는 입력창을 고르면 prompt로 받고 확인 버튼으로 제출한다', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('puyow_code'));
  await reloadWithSettings(page, { playerName: 'PLAYER 1', virtualController: 'auto' });
  await openSettings(page);
  await page.evaluate(() => window.setTestTouchPoints(1));
  const savedCodes = () => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')));

  // 코드 버튼은 한 줄 입력 대화상자를 연다. 캔버스에 직접 치는 글자는 받지 않는다.
  await clickLogical(page, 1232, 692);
  await expect.poll(() => canvasHasText(page, '코드를 입력하세요')).toBe(true);
  await page.keyboard.type('typed');
  await nextFrames(page, 2);
  expect(await canvasHasText(page, 'typed')).toBe(false);

  // 입력창을 누르면 prompt가 열리고, 입력한 내용이 대화상자의 입력창에 들어간다. 아직 제출되지는 않는다.
  await page.evaluate(() => { window.testPromptResponses = ['observation']; });
  await clickLogical(page, 640, 325);
  await expect.poll(() => canvasHasText(page, 'observation')).toBe(true);
  expect(await promptCalls(page)).toEqual([{ message: '코드를 입력하세요', defaultValue: '' }]);
  expect(await savedCodes()).toBeNull();
  await clickLogical(page, 500, 477);
  await expect.poll(savedCodes).toEqual(['observation']);

  // 키보드: 입력창에서 Enter는 prompt를 열고, 공란이면 값이 그대로다. 방향키로 취소 버튼까지 옮겨 Enter로 닫는다.
  await clickLogical(page, 1232, 692);
  await page.evaluate(() => { window.testPromptResponses = ['  ']; });
  await page.keyboard.press('Enter');
  expect((await promptCalls(page)).length).toBe(2);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await nextFrames(page, 2);
  expect(await savedCodes()).toEqual(['observation']);
  // 대화상자가 닫혔으므로 설정 화면의 ESC가 메인 메뉴로 돌아간다.
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('main_menu');

  // 공개 askText의 여러 줄 입력도 입력창을 누르면 prompt로 받고, 방향키로 확인 버튼에 옮겨 제출한다.
  await page.evaluate(() => {
    window.testAskResults = [];
    window.testPromptResponses = ['{"puyos":[]}'];
    window.PuyoW.askText('JSON을 입력하세요', true).then((value) => window.testAskResults.push(value));
  });
  await nextFrames(page, 2);
  await clickLogical(page, 640, 300);
  await expect.poll(() => canvasHasText(page, '{"puyos":[]}')).toBe(true);
  expect((await promptCalls(page)).at(-1)).toEqual({ message: 'JSON을 입력하세요', defaultValue: '' });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testAskResults)).toEqual(['{"puyos":[]}']);

  // 게임패드만으로도 조작할 수 있다: A로 prompt를 열고, 스틱으로 확인 버튼에 옮긴 뒤 A로 제출한다.
  await page.evaluate(() => {
    window.testPromptResponses = ['pad text'];
    window.PuyoW.askText('한 줄 입력').then((value) => window.testAskResults.push(value));
  });
  await nextFrames(page, 2);
  const callsBefore = (await promptCalls(page)).length;
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(async () => (await promptCalls(page)).length).toBe(callsBefore + 1);
  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(150);
  await page.evaluate(() => window.setTestGamepad([1, 0]));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(150);
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(() => page.evaluate(() => window.testAskResults)).toEqual(['{"puyos":[]}', 'pad text']);

  // ESC는 입력창에 포커스가 있어도 대화상자를 취소한다.
  await page.evaluate(() => {
    window.clearTestGamepad();
    window.PuyoW.askText('취소할 입력').then((value) => window.testAskResults.push(value));
  });
  await nextFrames(page, 2);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.testAskResults)).toEqual(['{"puyos":[]}', 'pad text', null]);
});

test('터치스크린 기기의 온라인 로그인 입력칸도 prompt로 받고 비밀번호는 기존 값을 미리 채우지 않는다', async ({ page }) => {
  await page.route('**/apis/onlineplayinfo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) });
  });
  await page.evaluate(() => localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { playerName: 'PLAYER 1' } })));
  const onlineInfo = page.waitForResponse((response) => new URL(response.url()).pathname === '/apis/onlineplayinfo');
  await page.reload();
  await onlineInfo;
  await enterMainMenu(page);
  await page.evaluate(() => window.setTestTouchPoints(1));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('together_mode_select');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('online_login');
  const idLabel = await translated(page, '아이디');
  const passwordLabel = await translated(page, '비밀번호');

  // 아이디 입력칸을 누르면 prompt로 받고 최대 30자까지 입력칸에 들어간다.
  await page.evaluate(() => { window.testPromptResponses = ['tester_' + 'z'.repeat(40)]; });
  await clickLogical(page, 660, 260);
  await expect.poll(() => canvasHasText(page, 'tester_' + 'z'.repeat(23))).toBe(true);
  // 키보드로 비밀번호 입력칸에 내려가 Enter를 눌러도 prompt가 열리고, 입력값은 가려서 표시한다.
  await page.evaluate(() => { window.testPromptResponses = ['secret12', '   ']; });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => canvasHasText(page, '•'.repeat(8))).toBe(true);
  // 공란은 취소로 처리해 기존 비밀번호를 지우지 않는다.
  await page.keyboard.press('Enter');
  expect(await currentCanvasHasText(page, '•'.repeat(8))).toBe(true);
  expect(await promptCalls(page)).toEqual([
    { message: idLabel, defaultValue: '' },
    { message: passwordLabel, defaultValue: '' },
    { message: passwordLabel, defaultValue: '' },
  ]);
  // prompt 뒤에도 방향키와 ESC가 평소처럼 동작한다.
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('main_menu');
});
