// 게임 페이지(puyow.html) 회귀 테스트가 함께 쓰는 준비 코드와 도우미 함수다.
// test01_*.spec.js와 test03_ai.spec.js가 모두 이 파일을 읽으므로, 여러 파일이 쓰는 것만 여기에 둔다.
// 한 파일에서만 쓰는 도우미는 그 파일 안에 남긴다.
// 파일 이름이 *.spec.js가 아니므로 Playwright가 테스트 파일로 수집하지 않는다.
import { test, expect } from '@playwright/test';

const GAME_PAGE = '/puyow.html';

/** 테스트용 Gamepad API 구현을 브라우저 초기화 전에 설치한다. */
async function installMockGamepad(page) {
  await page.addInitScript(() => {
    let gamepad = null;
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => (gamepad ? [gamepad] : []),
    });
    window.setTestGamepad = (axes = [0, 0], pressedButtons = []) => {
      gamepad = {
        connected: true,
        axes,
        buttons: Array.from({ length: 16 }, (_, index) => ({
          pressed: pressedButtons.includes(index),
          value: pressedButtons.includes(index) ? 1 : 0,
        })),
      };
    };
    window.testAudioInstances = [];
    window.Audio = class TestAudio {
      constructor(src) {
        this.src = src;
        this.loop = false;
        this.volume = 1;
        this.currentTime = 0;
        this.paused = true;
        window.testAudioInstances.push(this);
      }

      play() {
        this.paused = false;
        return Promise.resolve();
      }

      pause() {
        this.paused = true;
      }
    };
    window.testCanvasTexts = [];
    window.testCanvasTextCalls = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.testCanvasTexts.push(String(text));
      window.testCanvasTextCalls.push({ text: String(text), x: Number(args[0]), y: Number(args[1]), fillStyle: String(this.fillStyle) });
      return originalFillText.call(this, text, ...args);
    };
  });
}

// 게임은 ONNX wasm 바이너리를 CDN에서 먼저 받는다. 테스트가 공개 네트워크에 의존하거나
// 27MB를 반복해서 주고받지 않도록, 기본적으로 CDN을 막아 로컬 파일 폴백 경로를 쓰게 한다.
// CDN 우선 경로 자체를 확인하는 테스트만 자기 라우트를 따로 걸어 이 기본값을 덮어쓴다.
async function blockOnnxWasmCdn(page) {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort('failed'));
}

// 게임을 어떤 서버로 띄웠는지에 따라 Local AI 사용 가능 여부가 달라지고, 쓸 수 있으면 제공자 기본값이
// Local AI가 되어 솔로몬 해금·설정 포커스 순번·적 목록까지 함께 바뀐다. 기본값을 일반 웹 서버와 같은
// 사용 불가로 고정하고, Local AI가 필요한 테스트만 자기 라우트를 따로 걸어 이 기본값을 덮어쓴다.
async function disableLocalAiModel(page) {
  await page.route('**/apis/localmodelinfo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false }) });
  });
}

/**
 * 게임 페이지 테스트의 공통 준비 과정을 현재 spec 파일에 등록한다.
 * 각 spec 파일이 자기 최상위에서 한 번 부르면 그 파일의 test.beforeEach가 된다.
 */
export function setupGamePage() {
  test.beforeEach(async ({ page }) => {
    await installMockGamepad(page);
    await blockOnnxWasmCdn(page);
    await disableLocalAiModel(page);
    await page.goto(GAME_PAGE);
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  });
}

export async function enterMainMenu(page) {
  const canvasTextCount = await page.evaluate(() => window.testCanvasTexts.length);
  await page.keyboard.press('Enter');
  // 첫 실행 또는 오래된 저장값은 메인 메뉴 위에 필수 이름 입력 대화상자를 띄운다.
  // 기존 시나리오는 메뉴 동작 자체를 검증하므로 여기서 기본 테스트 이름을 한 번만 입력한다.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  const promptTitle = await page.evaluate(() => window.WebPuyo.translate('이름 또는 닉네임을 입력하세요'));
  if (await page.evaluate(({ title, start }) => window.testCanvasTexts.slice(start).includes(title), { title: promptTitle, start: canvasTextCount })) {
    await page.keyboard.type('PLAYER 1');
    await page.keyboard.press('Enter');
  }
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
}

export async function openSettings(page) {
  await enterMainMenu(page);
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');
}

export // 가상 조이스틱 테스트는 조작할 뿌요와 빈 화면이 모두 필요하므로 연습 모드를 쓴다.
async function startPracticeWithVirtualController(page, size = 'normal') {
  await page.evaluate((virtualController) => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { virtualController } }));
  }, size);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
  const box = await page.locator('[data-puyow-canvas="2d"]').boundingBox();
  return {
    point: (logicalX, logicalY) => ({ x: box.x + logicalX * box.width / 1280, y: box.y + logicalY * box.height / 720 }),
    activeX: () => page.evaluate(() => window.WebPuyo.getGameState().player.active.x),
    activeY: () => page.evaluate(() => window.WebPuyo.getGameState().player.active.y),
  };
}

export async function expectDefeatCellMarkers(page, columns) {
  await expect.poll(() => page.evaluate((targetColumns) => {
    const drawingContext = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d');
    return [188, 864].every((fieldX) => targetColumns.every((column) => {
      const [red, green, blue] = drawingContext.getImageData(fieldX + column * 38 + 12, 114, 1, 1).data;
      return red >= green * 2 && red >= blue * 1.5;
    }));
  }, columns)).toBe(true);
}

export /** 현재 브라우저 언어로 번역된 문구를 얻는다. 테스트 실행 언어가 달라도 같은 버튼을 찾을 수 있다. */
function translated(page, korean) {
  return page.evaluate((text) => window.WebPuyo.translate(text), korean);
}

export /** 리플레이 설정을 켠 상태로 저장 데이터를 다시 읽는다. */
async function enableReplayFeature(page) {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { useReplayFeature: true } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
}

export /** 메인 메뉴 좌측 하단의 리플레이 재생 버튼을 마우스로 누른다. */
async function clickReplayPlaybackButton(page) {
  const bounds = await page.locator('[data-puyow-canvas="2d"]').boundingBox();
  const scale = bounds.width / 1280;
  await page.mouse.click(bounds.x + 74 * scale, bounds.y + 645 * scale);
}

/**
 * 공통 준비 과정이 걸어 둔 네트워크 가로채기를 모두 걷고 페이지를 다시 연다.
 * Playwright의 WebKit은 `page.route()`가 하나라도 걸려 있으면 `blob:` 주소의 Worker 스크립트를
 * 읽지 못해, 게임의 Blob Worker(3수 이상 N수 탐색)가 늘 시간 초과로 1수 결과에 대체된다.
 * 실제 브라우저의 문제가 아니라 테스트 도구의 제약이므로, Blob Worker 자체를 확인하는 테스트만
 * 이 함수로 기준선 라우트를 걷고 시작한다. 그런 테스트는 ONNX와 Local AI 응답을 쓰지 않아
 * 기준선을 잃지 않는다.
 * @param {import('@playwright/test').Page} page 대상 페이지
 * @returns {Promise<void>}
 */
export async function releaseNetworkInterception(page) {
  await page.unrouteAll();
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo?.getScreenState().screen)).toBe('initial_title');
}
