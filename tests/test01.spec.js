import { test, expect } from '@playwright/test';

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

test.beforeEach(async ({ page }) => {
  await installMockGamepad(page);
  await page.goto('/puyow.html');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
});

async function enterMainMenu(page) {
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
}

async function openSettings(page) {
  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');
}

async function expectDefeatCellMarkers(page, columns) {
  await expect.poll(() => page.evaluate((targetColumns) => {
    const drawingContext = document.querySelector('#webpuyo_canvas').getContext('2d');
    return [188, 864].every((fieldX) => targetColumns.every((column) => {
      const [red, green, blue] = drawingContext.getImageData(fieldX + column * 38 + 12, 114, 1, 1).data;
      return red >= green * 2 && red >= blue * 1.5;
    }));
  }, columns)).toBe(true);
}

test('초기 타이틀은 Enter 키와 클릭으로 메인 메뉴에 진입한다', async ({ page }) => {
  await enterMainMenu(page);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.locator('#webpuyo_canvas').click({ position: { x: 640, y: 360 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('기본 룰·연습·플레이 방법의 양쪽 필드는 기본 패배 칸에 빨간 X를 표시한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expectDefeatCellMarkers(page, [2]);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expectDefeatCellMarkers(page, [2]);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('tutorial_intro');
  await expectDefeatCellMarkers(page, [2]);
});

test('피버 룰과 연속 피버의 양쪽 필드는 두 패배 칸에 빨간 X를 표시한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expectDefeatCellMarkers(page, [2, 3]);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expectDefeatCellMarkers(page, [2, 3]);
});

test('시뮬레이터는 양쪽 기본 패배 칸을 표시하고 해당 칸의 뿌요를 앞에 그린다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');
  await expectDefeatCellMarkers(page, [2]);

  const canvas = page.locator('#webpuyo_canvas');
  await canvas.click({ position: { x: 925, y: 247 } });
  await canvas.click({ position: { x: 283, y: 121 } });
  await expect.poll(() => page.evaluate(() => {
    const hasBluePuyo = window.WebPuyo.getSimulatorState()?.board.puyos.some((puyo) => puyo.x === 2 && puyo.y === 11 && puyo.color === 'blue');
    const [red, green, blue] = document.querySelector('#webpuyo_canvas').getContext('2d').getImageData(276, 114, 1, 1).data;
    return hasBluePuyo && blue > red * 1.3 && blue > green * 1.2;
  })).toBe(true);
});

test('일반·방해뿌요 클래스는 이름을 제공하고 캔버스에 직접 그린다', async ({ page }) => {
  const rendered = await page.evaluate(() => {
    const types = [
      ['RedPuyo', 'red', '빨강뿌요'],
      ['GreenPuyo', 'green', '초록뿌요'],
      ['YellowPuyo', 'yellow', '노랑뿌요'],
      ['BluePuyo', 'blue', '파랑뿌요'],
      ['PurplePuyo', 'purple', '보라뿌요'],
      ['GarbagePuyo', 'garbage', '방해뿌요'],
      ['HardGarbagePuyo', 'hardGarbage', '딱딱뿌요'],
      ['IronPuyo', 'iron', '철구뿌요'],
    ];
    return types.map(([className, expectedType, expectedName]) => {
      const puyo = new window.WebPuyo[className]();
      const canvas = document.createElement('canvas');
      canvas.width = 38;
      canvas.height = 38;
      const drawingContext = canvas.getContext('2d');
      puyo.draw(drawingContext, 0, 0, 38);
      const painted = drawingContext.getImageData(0, 0, 38, 38).data.some((value, index) => index % 4 === 3 && value > 0);
      return { className, type: puyo.type, name: puyo.getName(), isPuyo: puyo instanceof window.WebPuyo.Puyo, painted, expectedType, expectedName };
    });
  });

  expect(rendered).toEqual([
    { className: 'RedPuyo', type: 'red', name: '빨강뿌요', isPuyo: true, painted: true, expectedType: 'red', expectedName: '빨강뿌요' },
    { className: 'GreenPuyo', type: 'green', name: '초록뿌요', isPuyo: true, painted: true, expectedType: 'green', expectedName: '초록뿌요' },
    { className: 'YellowPuyo', type: 'yellow', name: '노랑뿌요', isPuyo: true, painted: true, expectedType: 'yellow', expectedName: '노랑뿌요' },
    { className: 'BluePuyo', type: 'blue', name: '파랑뿌요', isPuyo: true, painted: true, expectedType: 'blue', expectedName: '파랑뿌요' },
    { className: 'PurplePuyo', type: 'purple', name: '보라뿌요', isPuyo: true, painted: true, expectedType: 'purple', expectedName: '보라뿌요' },
    { className: 'GarbagePuyo', type: 'garbage', name: '방해뿌요', isPuyo: true, painted: true, expectedType: 'garbage', expectedName: '방해뿌요' },
    { className: 'HardGarbagePuyo', type: 'hardGarbage', name: '딱딱뿌요', isPuyo: true, painted: true, expectedType: 'hardGarbage', expectedName: '딱딱뿌요' },
    { className: 'IronPuyo', type: 'iron', name: '철구뿌요', isPuyo: true, painted: true, expectedType: 'iron', expectedName: '철구뿌요' },
  ]);
});

test('갤러리 일반뿌요 목록에 철구뿌요를 처음부터 잠금 해제 상태로 표시한다', async ({ page }) => {
  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('gallery');

  for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('철구뿌요'))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => ['잠김', 'Locked', 'ロック中', '已锁定'].includes(text)))).toBe(false);
});

test('메뉴에서 Z 키는 Enter 키처럼 동작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('z');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
});

test('설정의 AI 서비스 제공자는 OpenAI만 표시하고 기존 Google 값은 정규화한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { aiProvider: 'Google' } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('OpenAI'))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.includes('Google'))).toBe(false);

  // Google이 있던 오른쪽 영역을 클릭해도 선택값을 되살릴 수 없어야 한다.
  await page.locator('#webpuyo_canvas').click({ position: { x: 700, y: 305 } });
  await page.locator('#webpuyo_canvas').click({ position: { x: 460, y: 578 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.aiProvider)).toBe('OpenAI');
});

test('그래픽 설정은 키보드와 마우스로 저장되며 캔버스 출력 해상도와 공개 좌표 변환 API에 반영된다', async ({ page }) => {
  expect(await page.evaluate(() => ({
    canvas: [document.querySelector('#webpuyo_canvas').width, document.querySelector('#webpuyo_canvas').height],
    output: window.WebPuyo.getCanvasOutputSize(),
  }))).toEqual({
    canvas: [1280, 720],
    output: { graphicsQuality: 'low', width: 1280, height: 720, scaleX: 1, scaleY: 1 },
  });

  await openSettings(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => [document.querySelector('#webpuyo_canvas').width, document.querySelector('#webpuyo_canvas').height])).toEqual([1920, 1080]);
  expect(await page.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem('puyow_store')).settings.graphicsQuality,
    point: window.WebPuyo.toCanvasCoordinates(640, 360),
    length: window.WebPuyo.toCanvasLength(38),
  }))).toEqual({ settings: 'medium', point: { x: 960, y: 540 }, length: 57 });

  await page.keyboard.press('Enter');
  await page.locator('#webpuyo_canvas').click({ position: { x: 895, y: 255 } });
  await page.locator('#webpuyo_canvas').click({ position: { x: 460, y: 578 } });
  await expect.poll(() => page.evaluate(() => [document.querySelector('#webpuyo_canvas').width, document.querySelector('#webpuyo_canvas').height])).toEqual([3840, 2160]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.graphicsQuality)).toBe('high');
});

test('가상 컨트롤러 크기는 이전 저장값을 호환하고 키보드와 마우스로 없음·보통·크게를 선택한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { virtualController: true } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);

  // 이전 켜기(true)는 보통으로 이관되며, 키보드로 없음과 크게를 순서대로 선택할 수 있다.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.virtualController)).toBe('large');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await page.locator('#webpuyo_canvas').click({ position: { x: 595, y: 205 } });
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.virtualController)).toBe('none');
});

test('빈 사용 모델명은 기본값으로 보정되고 API 테스트 버튼은 API 키 없이는 비활성이다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'OpenAI', aiApiKey: '', aiModel: '' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('gpt-5.6-luna'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    'AI API 테스트', 'Test AI API', 'AI APIテスト', 'AI API 测试',
  ].includes(text)))).toBe(true);

  let requestCount = 0;
  await page.route('https://api.openai.com/v1/responses', async (route) => {
    requestCount += 1;
    await route.fulfill({ status: 500 });
  });
  await page.locator('#webpuyo_canvas').click({ position: { x: 700, y: 455 } });
  await page.waitForTimeout(100);
  expect(requestCount).toBe(0);
});

test('AI API 테스트는 저장된 OpenAI 설정으로 구조화된 Responses 요청을 보내고 응답을 검증한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'OpenAI', aiApiKey: 'test-key', aiModel: 'gpt-5.6-luna' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  let requestBody = null;
  await page.route('https://api.openai.com/v1/responses', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ output_text: '{"success":true}' }),
    });
  });
  await openSettings(page);
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    'AI API 테스트 성공 (JSON 스키마 검사: 통과)',
    'AI API test succeeded (JSON schema: passed).',
    'AI APIテスト成功（JSONスキーマ検証: 合格）',
    'AI API 测试成功（JSON 架构检查：通过）',
  ].includes(text)))).toBe(true);
  expect(requestBody).toMatchObject({
    model: 'gpt-5.6-luna',
    reasoning: { effort: 'low' },
    text: { format: { type: 'json_schema', name: 'ai_api_test_result', strict: true, schema: { required: ['success'] } } },
  });
});

test('저장하지 않은 AI 설정은 API 테스트 요청 대신 저장 안내를 표시한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'OpenAI', aiApiKey: 'test-key', aiModel: 'gpt-5.6-luna' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  let requestCount = 0;
  await page.route('https://api.openai.com/v1/responses', async (route) => {
    requestCount += 1;
    await route.fulfill({ status: 500 });
  });
  await openSettings(page);
  await page.locator('#webpuyo_canvas').click({ position: { x: 600, y: 355 } });
  await page.keyboard.press('x');
  await page.keyboard.press('Enter');
  await page.locator('#webpuyo_canvas').click({ position: { x: 700, y: 455 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '설정 저장 후 다시 시도해 주세요',
    'Save your settings and try again.',
    '設定を保存してから、もう一度お試しください。',
    '请先保存设置后再试。',
  ].includes(text)))).toBe(true);
  expect(requestCount).toBe(0);
});

test('setEnemySoundPool은 getClassType에 해당하는 새 적의 사운드 풀을 교체한다', async ({ page }) => {
  await page.evaluate(() => {
    const sounds = window.WebPuyo.createSoundPool(false);
    sounds.backgroundMusic = 'sounds/test-andromalius-bgm.ogg';
    window.WebPuyo.setEnemySoundPool('Andromalius', sounds);
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.some((audio) => (
    audio.src.endsWith('sounds/test-andromalius-bgm.ogg') && !audio.paused
  )))).toBe(true);
});

test('연속 피버 선택지는 활성 상태이며 목표 5연쇄와 60초로 피버 스테이지를 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const texts = window.testCanvasTexts;
    const localizedOptions = [
      ['기본 룰', '피버 룰', '연습', '연속 피버'],
      ['Standard Rules', 'FEVER Rules', 'Practice', 'Continuous FEVER'],
      ['基本ルール', 'FEVERルール', '練習', '連続FEVER'],
      ['基本规则', 'FEVER规则', '练习', '连续FEVER'],
    ];
    return localizedOptions.some((options) => options.every((text) => texts.includes(text)));
  })).toBe(true);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state.continuousFever && state.fever.targetCombo === 5 && state.fever.leftTime === 60000;
  })).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('playing');
  const feverState = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(feverState.fever.turn).toBe(1);
  expect(feverState.fever.selectedStageTarget).toBe(5);
  expect(feverState.player.board.puyos.length).toBeGreaterThan(0);
  expect(feverState.player.active.colors).toEqual(feverState.fever.stageSuppliedPair);
  expect(feverState.colors).toEqual(['red', 'green', 'yellow', 'blue', 'purple']);
  expect(await page.evaluate(() => Array.from(document.querySelector('#webpuyo_canvas').getContext('2d').getImageData(210, 120, 1, 1).data))).toEqual([232, 144, 53, 255]);
  expect(await page.evaluate(() => {
    const texts = window.testCanvasTexts;
    return [
      '목표 연쇄', 'TARGET COMBO', '目標連鎖', '目标连锁',
      '남은 시간', 'LEFT TIME', '残り時間', '剩余时间',
    ].every((label) => !texts.includes(label));
  })).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  const pausedTime = await page.evaluate(() => window.WebPuyo.getGameState().fever.leftTime);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().fever.leftTime)).toBe(pausedTime);
});

test('연속 피버는 두 번째 패배 칸 (3, 11)도 패배로 판정한다', async ({ page }) => {
  await page.evaluate(() => {
    Math.random = () => 0.999999;
    window.WebPuyo.registerFeverStageState(new window.WebPuyo.FeverStageState(
      { puyos: Array.from({ length: 12 }, (unused, y) => ({ x: 3, y, color: 'garbage' })) },
      5,
      ['red', 'red'],
      1,
      ['red'],
    ));
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('playing');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState().player.board.puyos.some((puyo) => puyo.x === 3 && puyo.y === 11))).toBe(true);

  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 5000 }).toBe('opponent');
});

test('피버 룰은 전용 적 선택 화면에서 4색을 골라 보라색 없이 대전으로 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.feverRule).toBe(true);
  expect(state.continuousFever).toBe(false);
  expect(state.colorCount).toBe(4);
  expect(state.colors).toEqual(['red', 'green', 'yellow', 'blue']);
  expect(state.player.nextPairs.flat()).not.toContain('purple');
  expect(state.player.fever).toMatchObject({ active: false, gauge: 0, nextTime: 15, targetCombo: 5, leftTime: 0, damage: 0 });
  expect(state.opponent.fever).toMatchObject({ active: false, gauge: 0, nextTime: 15, targetCombo: 5, leftTime: 0, damage: 0 });
});

test('피버 룰은 키보드로 3색을 선택해 초록·노랑·파랑만 사용하는 대전을 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.feverRule).toBe(true);
  expect(state.colorCount).toBe(3);
  expect(state.colors).toEqual(['green', 'yellow', 'blue']);
  expect(state.player.nextPairs.flat().every((color) => state.colors.includes(color))).toBe(true);
});

test('기본·피버 룰 적 선택에서 극한 AI 난이도를 선택해 게임에 적용한다', async ({ page }) => {
  async function selectExtremeAndStart() {
    await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['극한', 'Extreme', '極限', '极限'].includes(text)))).toBe(true);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => window.WebPuyo.getSelectedDifficulty())).toEqual({ key: 'extreme', name: '극한', fastDownDelay: 100 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
    expect(await page.evaluate(() => window.WebPuyo.getGameState().aiDifficulty)).toEqual({ key: 'extreme', name: '극한', fastDownDelay: 100 });
  }

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await selectExtremeAndStart();

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await selectExtremeAndStart();
  expect(await page.evaluate(() => window.WebPuyo.getGameState().feverRule)).toBe(true);
});

test('암두시아스는 기본·피버 룰 진행 목록에 출시되고 키마리스는 출시 예정으로 표시된다', async ({ page }) => {
  await page.evaluate(() => {
    const cleared = ['Andromalius', 'Dantalion', 'Seere', 'Decarabia', 'Belial'];
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      clearListByDifficulty: { easy: cleared, normal: cleared, hard: cleared },
      feverClearListByDifficulty: { easy: cleared, normal: cleared, hard: cleared },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['암두시아스', 'Amdusias', 'アムドゥシアス', '阿姆杜西亚斯'].includes(text)))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['키마리스', 'Kimaris', 'キマリス', '基马里斯'].includes(text)))).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['암두시아스', 'Amdusias', 'アムドゥシアス', '阿姆杜西亚斯'].includes(text)))).toBe(true);
});

test('피버 룰에서 이긴 적은 갤러리에도 잠금 해제된다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverGalleryEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -1;
      }

      getClassType() { return 'FeverGalleryEnemy'; }
      getName() { return '피버 갤러리 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        player.board[11][3] = 'red';
        player.phase = 'check';
        player.phaseTimer = 150;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverGalleryEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 10000 }).toBe('player');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_gallery')).enemies)).toContain('FeverGalleryEnemy');
});

test('피버 전용 필드는 적 테마보다 우선하고 일반 필드는 적 테마를 유지한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverPriorityThemeEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -1;
      }

      getClassType() { return 'FeverPriorityThemeEnemy'; }
      getName() { return '피버 테마 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        player.fever.active = true;
      }

      drawBezelBackground(drawingContext, area) {
        drawingContext.fillStyle = '#010203';
        drawingContext.fillRect(area.x, area.y, area.width, area.height);
      }

      drawPlayerBackground(drawingContext, area) {
        drawingContext.fillStyle = '#040506';
        drawingContext.fillRect(area.x, area.y, area.width, area.height);
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverPriorityThemeEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.active)).toBe(true);
  const pixels = await page.evaluate(() => {
    const drawingContext = document.querySelector('#webpuyo_canvas').getContext('2d');
    return {
      normalField: Array.from(drawingContext.getImageData(210, 120, 1, 1).data),
      feverField: Array.from(drawingContext.getImageData(886, 120, 1, 1).data),
      feverBezel: Array.from(drawingContext.getImageData(842, 120, 1, 1).data),
    };
  });
  expect(pixels.normalField).toEqual([4, 5, 6, 255]);
  expect(pixels.feverField).toEqual([232, 144, 53, 255]);
  expect(pixels.feverBezel).toEqual([207, 94, 56, 255]);
});

test('피버 상태의 싹쓸이는 목표 연쇄만 올리고 별도 ATTACK을 보내지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverAllClearEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -1;
        this.hasPreparedAllClear = false;
      }

      getClassType() { return 'FeverAllClearEnemy'; }
      getName() { return '피버 싹쓸이 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.hasPreparedAllClear) return;
        this.hasPreparedAllClear = true;
        // 4개 연결을 터뜨린 뒤 피버 필드를 비운다. 이 폭발은 40점(ATTACK 1 미만)이라
        // 자체 공격은 없으며, DAMAGE가 생긴다면 싹쓸이의 기존 추가 12뿐이다.
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.board = Array.from({ length: 17 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.hasPlacedPuyoSinceAllClear = true;
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverAllClearEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  // 싹쓸이 황금 연출과 모든 에너지 정산이 끝난 뒤에 다음 피버 스테이지가 준비된다.
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.opponent.fever?.targetCombo;
  }), { timeout: 10000 }).toBe(4);
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.opponent.point).toBe(140);
  expect(state.player.damage).toBe(0);
  expect(state.player.warningPuyos).toEqual([]);
});

test('연속 피버와 피버 상태는 낮은 연쇄 뒤 4연쇄 피버 패턴을 사용한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverLowComboEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverLowComboEnemy'; }
      getName() { return '피버 저연쇄 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.board = Array.from({ length: 17 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        // 1연쇄 후 남는 뿌요가 있어 싹쓸이 보너스 없이 목표 최솟값만 확인한다.
        player.board[0][5] = 'blue';
        player.hasPlacedPuyoSinceAllClear = true;
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverLowComboEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.selectedStageTarget), { timeout: 10000 }).toBe(4);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().opponent.fever.targetCombo)).toBe(4);
});

test('3색 피버 룰의 일반 필드 싹쓸이는 4연쇄 패턴을 배치한다', async ({ page }) => {
  await page.evaluate(() => {
    class NormalFeverAllClearEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'NormalFeverAllClearEnemy'; }
      getName() { return '일반 피버 싹쓸이 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.board = Array.from({ length: 17 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'green';
        player.hasPlacedPuyoSinceAllClear = true;
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new NormalFeverAllClearEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.selectedStageTarget), { timeout: 10000 }).toBe(4);
  const state = await page.evaluate(() => window.WebPuyo.getGameState().opponent.fever);
  expect(state.active).toBe(false);
  expect(state.targetCombo).toBe(5);
});

test('마지막 전등이 켜지는 일반 필드 싹쓸이는 5연쇄 패턴 대신 목표 7연쇄 피버에 진입한다', async ({ page }) => {
  await page.evaluate(() => {
    class ActivatingFeverAllClearEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'ActivatingFeverAllClearEnemy'; }
      getName() { return '피버 진입 싹쓸이 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.gauge = 7;
        player.fever.pendingActivation = true;
        player.board = Array.from({ length: 17 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.hasPlacedPuyoSinceAllClear = true;
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new ActivatingFeverAllClearEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.active === true), { timeout: 10000 }).toBe(true);
  const state = await page.evaluate(() => window.WebPuyo.getGameState().opponent.fever);
  expect(state.targetCombo).toBe(7);
  expect(state.selectedStageTarget).toBe(7);
});

test('피버 중 공격은 피버와 일반 DAMAGE를 모두 상쇄한 뒤 남은 수치를 전달한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverDualDamageCancelEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -1;
        this.prepared = false;
      }

      getClassType() { return 'FeverDualDamageCancelEnemy'; }
      getName() { return '피버 피해 상쇄 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.fever.damage = 1;
        player.normalDamage = 2;
        // 4의 공격으로 피버 DAMAGE 1, 일반 DAMAGE 2를 상쇄하고 남은 1을 상대에게 보낸다.
        player.attack = 4;
        player.board = Array.from({ length: 17 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverDualDamageCancelEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.opponent.normalDamage === 0 && state.opponent.fever?.damage === 0 && state.player.damage >= 1;
  }), { timeout: 10000 }).toBe(true);
});

test('피버 룰의 시간 만료 연쇄는 상대 방해뿌요 낙하를 기다리지 않고 종료한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverExpiredComboEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -1;
        this.prepared = false;
      }

      getClassType() { return 'FeverExpiredComboEnemy'; }
      getName() { return '피버 만료 정산 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        // 다음 프레임에서 0이 되지만, 연쇄와 에너지 전달은 끝까지 정산한다.
        player.fever.leftTime = 1;
        player.attack = 1;
        player.board = Array.from({ length: 17 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverExpiredComboEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  // 플레이어는 아직 방해뿌요를 떨어뜨리지 않았지만, 전달된 DAMAGE 뒤 피버는 종료돼야 한다.
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.player.damage >= 1 && state.opponent.fever?.active === false;
  }), { timeout: 10000 }).toBe(true);
});

test('게임 규칙 선택지의 연습은 색상 수 선택으로 이어지고 취소하면 메인 메뉴로 돌아간다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  await page.keyboard.press('Enter');
  await page.locator('#webpuyo_canvas').click({ position: { x: 20, y: 20 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('연속 피버는 키보드로 3색을 선택하고 피버 패턴도 선택한 색만 사용한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('playing');
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.continuousFever).toBe(true);
  expect(state.colorCount).toBe(3);
  expect(state.colors).toEqual(['green', 'yellow', 'blue']);
  expect(state.player.board.puyos
    .filter((puyo) => puyo.color !== 'garbage')
    .every((puyo) => state.colors.includes(puyo.color))).toBe(true);
  expect(state.player.active.colors.every((color) => state.colors.includes(color))).toBe(true);
});

test('연속 피버의 중앙 정렬된 3색 버튼은 마우스로 선택할 수 있다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.locator('#webpuyo_canvas').click({ position: { x: 520, y: 364 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getGameState().colorCount)).toBe(3);
});

test('플레이 방법 시연은 에너지 이동 초기화 오류 없이 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('tutorial_intro');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 7000 }).toBe('tutorial_demo');
});

test('플레이 방법 1단계는 지정된 뿌요 순서와 조작 시연 메시지를 사용한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '좌우, 아래 키로 뿌요를 이동시킬 수 있고, Z, X 키로 뿌요를 회전시킬 수 있어',
    'Use Left, Right, and Down to move puyos. Rotate them with Z and X.',
    '左右・下キーでぷよを動かし、Z・Xキーで回転できます。',
    '使用左右和下方向键移动噗哟，使用 Z、X 键旋转。',
  ].includes(text)))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 7000 }).toBe('tutorial_demo');
  expect(await page.evaluate(() => window.WebPuyo.getNextPairs().player.nextPairs)).toEqual([
    ['yellow', 'green'],
    ['yellow', 'red'],
  ]);

  const prompts = [
    ['좌우 방향키로 뿌요 이동', 'Move puyos with Left and Right.', '左右キーでぷよを移動', '用左右方向键移动噗哟'],
    ['아래 방향키로 빨리 떨어뜨리기', 'Use Down to drop faster.', '下キーで速く落下', '用下方向键快速落下'],
    ['Z 키를 눌러 좌측으로 뿌요 회전', 'Press Z to rotate left.', 'Zキーで左回転', '按 Z 键向左旋转'],
    ['X 키를 눌러 우측으로 뿌요 회전', 'Press X to rotate right.', 'Xキーで右回転', '按 X 键向右旋转'],
  ];
  for (const prompt of prompts) {
    await expect.poll(() => page.evaluate((texts) => window.testCanvasTexts.some((text) => texts.includes(text)), prompt), { timeout: 12000 }).toBe(true);
  }
});

test('게임패드 A와 X, Y 버튼은 메뉴 확인과 취소 입력으로 동작한다', async ({ page }) => {
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [3]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [2]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [2]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
});

test('게임 규칙 선택지 밖 클릭과 ESC는 메인 메뉴로 돌아간다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.keyboard.press('Enter');
  await page.locator('#webpuyo_canvas').click({ position: { x: 20, y: 20 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('2D URL 예약어는 컨텍스트 경로와 지원 시스템 언어로 치환한다', async ({ page }) => {
  const result = await page.evaluate(() => {
    const systemCode = navigator.language.slice(0, 2).toLowerCase();
    const languageCode = ['ko', 'en', 'ja', 'zh'].includes(systemCode) ? systemCode : 'en';
    window.PuyoW.setURLContextPath('/tomcat-puyow/');
    return {
      contextPath: window.PuyoW.urlContextPath,
      relative: window.PuyoW.convertURL('[CTX]notice_[LANG].txt'),
      absolute: window.PuyoW.convertURL('https://example.com/puyo/notice_[LANG].txt'),
      languageCode,
    };
  });

  expect(result.contextPath).toBe('/tomcat-puyow/');
  expect(result.relative).toBe(`/tomcat-puyow/notice_${result.languageCode}.txt`);
  expect(result.absolute).toBe(`https://example.com/puyo/notice_${result.languageCode}.txt`);
});

test('구글 폰트 import URL은 컨텍스트 경로 변환 예외로 기존 주소를 유지한다', async ({ page }) => {
  const fontImport = await page.evaluate(() => {
    window.PuyoW.destroy();
    window.PuyoW.setURLContextPath('/tomcat-puyow/');
    document.querySelector('style.puyow_font_import')?.remove();
    window.PuyoW.initialize('webpuyo_canvas');
    return document.querySelector('style.puyow_font_import')?.textContent;
  });

  expect(fontImport).toContain("@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans");
  expect(fontImport).not.toContain('/tomcat-puyow/');
  expect(fontImport).not.toContain('[LANG]');
});

test('게임 규칙 선택지의 기본 룰·연습 색상과 하단 취소를 키보드·마우스로 조작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector('#webpuyo_canvas');
    const context = canvas.getContext('2d');
    const standard = context.getImageData(360, 285, 1, 1).data;
    const practice = context.getImageData(360, 387, 1, 1).data;
    return standard[1] < practice[1] && standard[0] < practice[0]
      && window.testCanvasTexts.some((text) => ['취소', 'Cancel', 'キャンセル', '取消'].includes(text));
  })).toBe(true);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.locator('#webpuyo_canvas').click({ position: { x: 640, y: 513 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('연습·연속 피버 색상 선택 화면의 취소는 이전 규칙 선택 화면으로 돌아간다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.locator('#webpuyo_canvas').click({ position: { x: 640, y: 474 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
});

test('퍼즐뿌요는 스테이지 선택, 잠금 해제, 5색 지급과 두 번 클릭 선택을 지원한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');

  expect(await page.evaluate(() => window.WebPuyo.PUZZLE_STAGES.map((stage) => stage.opened))).toEqual([true, true, false, false, false]);
  await page.locator('#webpuyo_canvas').click({ position: { x: 334, y: 550 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
  await page.locator('#webpuyo_canvas').click({ position: { x: 334, y: 550 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 5000 }).toBe(true);
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.puzzle).toMatchObject({ stageIndex: 0, turn: 1 });
  expect(state.colors).toEqual(['red', 'green', 'yellow', 'blue', 'purple']);
  expect(state.player.active.colors).toEqual(await page.evaluate(() => window.WebPuyo.PUZZLE_STAGES[0].suppliedNextPuyos[0]));
  expect(state.opponent.phase).toBe('idle');

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
});

test('연습·연속 피버·퍼즐뿌요는 단독 NEXT 영역에 네 쌍을 표시하고 연습 상대 문구를 숨긴다', async ({ page }) => {
  async function expectSoloNextLayout() {
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.player.nextPairs.length), { timeout: 5000 }).toBe(4);
    expect(await page.evaluate(() => window.testCanvasTextCalls.some(({ text, x, y }) => {
      const practiceNames = ['연습 상대', 'Practice Opponent', '練習相手', '练习对手'];
      return practiceNames.some((name) => text === `${name} NEXT` || (text === name && x >= 850 && y <= 60));
    }))).toBe(false);
  }

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expectSoloNextLayout();

  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expectSoloNextLayout();

  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expectSoloNextLayout();
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['현재 턴 1 / 2', 'Turn 1 / 2', 'ターン 1 / 2', '第 1 / 2 回合'].includes(text)))).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const [red, green, blue] = document.querySelector('#webpuyo_canvas').getContext('2d').getImageData(952, 114, 1, 1).data;
    return red >= green * 2 && red >= blue * 1.5;
  })).toBe(false);
});

test('퍼즐뿌요 스테이지 선택의 취소는 키보드와 마우스로 규칙 선택 화면에 돌아간다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');

  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => {
    const pixels = document.querySelector('#webpuyo_canvas').getContext('2d').getImageData(420, 220, 440, 55).data;
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index] > 180 && pixels[index + 1] > 120 && pixels[index + 2] < 130) return true;
    return false;
  })).toBe(false);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
  await page.locator('#webpuyo_canvas').click({ position: { x: 130, y: 550 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
});

test('퍼즐뿌요 스테이지 클리어는 결과 화면 전환 전에 저장되고 다음 두 스테이지를 연다', async ({ page }) => {
  await page.evaluate(() => {
    const stage = window.WebPuyo.PUZZLE_STAGES[0];
    stage.stageData = { puyos: [{ x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' }] };
    stage.suppliedNextPuyos = [['red', 'blue']];
    stage.winConditionType = 'multiple';
    stage.winConditionValue = 4;
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 5000 }).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 6000 }).toBe('game_over');
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('puyow_store')).puzzleClearStages)).toContain(0);
  await page.evaluate(() => { window.testCanvasTextCalls = []; });
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.some(({ text }) => ['현재 턴 1 / 2', 'Turn 1 / 2', 'ターン 1 / 2', '第 1 / 2 回合'].includes(text)))).toBe(true);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().puzzle.starEarned)).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTextCalls.some(({ text, x }) => {
    const finalScorePrefixes = ['최종 점수', 'Final score', '最終スコア', '最终得分'];
    const puzzleLabels = ['퍼즐뿌요', 'Puzzle Puyo', 'パズルぷよ', '益智魔法气泡'];
    return x >= 850 && (finalScorePrefixes.some((prefix) => text.startsWith(prefix)) || puzzleLabels.includes(text));
  }))).toBe(false);
  await expect.poll(() => page.evaluate(() => {
    const pixels = document.querySelector('#webpuyo_canvas').getContext('2d').getImageData(950, 370, 56, 60).data;
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index] > 190 && pixels[index + 1] > 130 && pixels[index + 2] < 130) return true;
    return false;
  })).toBe(true);

  await page.locator('#webpuyo_canvas').click({ position: { x: 640, y: 197 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.PUZZLE_STAGES.map((stage) => stage.opened))).toEqual([true, true, true, false, false]);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.puzzle?.stageIndex)).toBe(1);
});

test('퍼즐뿌요 패배 결과는 중앙에 다국어 붉은 패배 문구를 표시한다', async ({ page }) => {
  await page.evaluate(() => {
    const stage = window.WebPuyo.PUZZLE_STAGES[0];
    stage.stageData = { puyos: Array.from({ length: 12 }, (_, y) => ({ x: 2, y, color: 'garbage' })) };
    stage.suppliedNextPuyos = [['red', 'blue']];
    stage.winConditionType = 'combo';
    stage.winConditionValue = 99;
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 5000 }).toBe(true);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 6000 }).toBe('game_over');
  expect(await page.evaluate(() => window.WebPuyo.getGameState().winner)).toBe('opponent');
  await page.evaluate(() => { window.testCanvasTextCalls = []; });
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.some(({ text, x, y, fillStyle }) => (
    ['패배', 'Defeat', '敗北', '失败'].includes(text) && x === 640 && y === 380 && fillStyle === '#ef5350'
  )))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTextCalls.some(({ text, x, y }) => (
    ['스테이지 클리어', 'Stage Clear', 'ステージクリア', '关卡完成'].includes(text) && x === 640 && y === 380
  )))).toBe(false);
});

test('퍼즐뿌요 싹쓸이 조건은 연출 뒤 승리 판정까지 유지한다', async ({ page }) => {
  await page.evaluate(() => {
    const stage = window.WebPuyo.PUZZLE_STAGES[1];
    stage.stageData = {
      puyos: [
        { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' },
        { x: 0, y: 1, color: 'red' }, { x: 1, y: 1, color: 'red' }, { x: 2, y: 1, color: 'red' }
      ]
    };
    stage.suppliedNextPuyos = [['red', 'red']];
    stage.winConditionType = 'clear';
    stage.winConditionValue = 0;
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 5000 }).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 6000 }).toBe('game_over');
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('puyow_store')).puzzleClearStages)).toContain(1);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.puzzle?.stageIndex)).toBe(1);
});

test('기본·피버 룰 승리 뒤에는 같은 색 수·난이도로 다음 선택 가능 적에 포커스한다', async ({ page }) => {
  async function verifyVictoryReturn(feverRule, prefix) {
    const nextName = `${prefix} 다음 적`;
    await page.evaluate(({ currentName, successorName, classPrefix }) => {
      class ResultReturnWinner extends window.WebPuyo.Enemy {
        constructor() { super(); this.sortPriority = -20; }
        getClassType() { return `${classPrefix}Winner`; }
        getName() { return currentName; }
        prepareTurn(player) {
          super.prepareTurn(player);
          player.board[11][2] = 'red';
          player.phase = 'check';
          player.phaseTimer = 150;
        }
      }
      class ResultReturnSuccessor extends window.WebPuyo.Enemy {
        constructor() { super(); this.sortPriority = -19; }
        getClassType() { return `${classPrefix}Successor`; }
        getName() { return successorName; }
      }
      window.WebPuyo.registerOpponent({ createController: () => new ResultReturnWinner() });
      window.WebPuyo.registerOpponent({ createController: () => new ResultReturnSuccessor() });
    }, { currentName: `${prefix} 현재 적`, successorName: nextName, classPrefix: prefix.replaceAll(' ', '') });

    await enterMainMenu(page);
    await page.keyboard.press('Enter');
    if (feverRule) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe(feverRule ? 'fever_opponent_select' : 'opponent_select');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 10000 }).toBe('player');

    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe(feverRule ? 'fever_opponent_select' : 'opponent_select');
    expect(await page.evaluate(() => window.WebPuyo.getSelectedColorCount())).toBe(5);
    expect(await page.evaluate(() => window.WebPuyo.getSelectedDifficulty().key)).toBe('hard');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.name)).toBe(nextName);
  }

  await verifyVictoryReturn(false, '기본 복귀 테스트');
  await page.reload();
  await verifyVictoryReturn(true, '피버 복귀 테스트');
});

test('게임 중 왼쪽 아래 스틱은 왼쪽 이동과 빠른 하강을 함께 처리한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);

  const initial = await page.evaluate(() => window.WebPuyo.getGameState().player.active);
  await page.evaluate(() => window.setTestGamepad([-1, 1]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState().player.active.x)).toBeLessThan(initial.x);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState().player.active.y)).toBeLessThan(initial.y);
});

test('게임 외와 연습 게임 배경음악은 하나만 재생되고 일시정지에 맞춰 멈춘다', async ({ page }) => {
  const languageCode = await page.evaluate(() => {
    const systemCode = navigator.language.slice(0, 2).toLowerCase();
    window.WebPuyo.setURLContextPath('/tomcat-puyow/');
    window.WebPuyo.commonSoundPool.otherBackgroundMusic = '[CTX]other_[LANG].mp3';
    window.WebPuyo.commonSoundPool.backgroundMusic = '[CTX]game_[LANG].mp3';
    return ['ko', 'en', 'ja', 'zh'].includes(systemCode) ? systemCode : 'en';
  });
  await enterMainMenu(page);
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual([`/tomcat-puyow/other_${languageCode}.mp3`]);

  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual([`/tomcat-puyow/other_${languageCode}.mp3`, `/tomcat-puyow/game_${languageCode}.mp3`]);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances[1].paused)).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances[1].paused)).toBe(false);
});

test('새 게임의 마진 레이트는 70으로 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().marginRate)).toBe(70);
});

test('시뮬레이터 연쇄는 새 점수 계산식과 같은 연쇄 문구를 표시한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('#webpuyo_canvas');
  for (const x of [207, 245, 283, 321]) {
    await canvas.click({ position: { x, y: 539 } });
  }
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => text === '1연쇄' || text === '1 Chain'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000040'))).toBe(true);
});

test('시뮬레이터 그리기 모드에서는 마우스와 키보드로 13번째 줄에 뿌요를 배치한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('#webpuyo_canvas');
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

test('시뮬레이터 전용 철구뿌요는 키보드와 마우스로 배치되고 재생 후에도 남는다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('#webpuyo_canvas');
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.filter((puyo) => puyo.color === 'iron').length)).toBe(2);
});

test('숨김 13번째 줄 뿌요는 폭발 연결 수에 포함되지 않는다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const puyos = [];
  // 13번째 줄의 빨강 하나가 내려오지 않도록 아래쪽을 채운다.
  for (let x = 0; x < 3; x += 1) for (let y = 0; y <= 10; y += 1) puyos.push({ x, y, color: (x + y) % 2 === 0 ? 'blue' : 'green' });
  puyos.push({ x: 0, y: 11, color: 'red' }, { x: 1, y: 11, color: 'red' }, { x: 2, y: 11, color: 'red' }, { x: 0, y: 12, color: 'red' });
  await page.evaluate((pastedPuyos) => { window.prompt = () => JSON.stringify({ puyos: pastedPuyos }); }, puyos);

  const canvas = page.locator('#webpuyo_canvas');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.filter((puyo) => puyo.color === 'red').length)).toBe(4);
});

test('숨김 13번째 줄 뿌요는 중력으로 내려온 뒤 다음 폭발 판정에 참여한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  // y=12의 빨강은 중력 후 y=3으로 내려와 y=0~2의 세 뿌요와 함께 폭발한다.
  await page.evaluate(() => { window.prompt = () => JSON.stringify({ puyos: [
    { x: 0, y: 0, color: 'red' }, { x: 0, y: 1, color: 'red' }, { x: 0, y: 2, color: 'red' }, { x: 0, y: 12, color: 'red' },
  ] }); });
  const canvas = page.locator('#webpuyo_canvas');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.some((puyo) => puyo.color === 'red'))).toBe(false);
});

test('시뮬레이터 점수는 동시 폭발의 색수와 총 연결 보너스를 합산한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('#webpuyo_canvas');
  for (const x of [207, 245, 283, 321]) {
    await canvas.click({ position: { x, y: 539 } });
  }
  await canvas.click({ position: { x: 970, y: 200 } });
  for (const x of [207, 245, 283, 321]) {
    await canvas.click({ position: { x, y: 501 } });
  }
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000640'))).toBe(true);
});

test('시뮬레이터 점수는 동시 4·5색 폭발의 총 9개 연결 보너스를 적용한다', async ({ page }) => {
  await enterMainMenu(page);
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

  const canvas = page.locator('#webpuyo_canvas');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000810'))).toBe(true);
});

test('시뮬레이터 점수는 다섯 뿌요 연결 보너스를 적용한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('#webpuyo_canvas');
  for (const x of [207, 245, 283, 321, 359]) {
    await canvas.click({ position: { x, y: 539 } });
  }
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000100'))).toBe(true);
});

test('시뮬레이터에서 딱딱뿌요 하나의 파괴는 점수에 세 배율로 반영된다', async ({ page }) => {
  await enterMainMenu(page);
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

  const canvas = page.locator('#webpuyo_canvas');
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
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  await page.evaluate(() => {
    window.prompt = () => JSON.stringify({ puyos: [
      { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' }, { x: 1, y: 1, color: 'red' },
      { x: 0, y: 1, color: 'hardGarbage' }, { x: 2, y: 1, color: 'hardGarbage' },
    ] });
  });

  const canvas = page.locator('#webpuyo_canvas');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState().board.puyos.some((puyo) => puyo.color === 'hardGarbage'))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000200'))).toBe(true);
});

test('시뮬레이터 딱딱뿌요는 한 방향 폭발에 일반 방해뿌요가 된다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  await page.evaluate(() => {
    window.prompt = () => JSON.stringify({ puyos: [
      { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' }, { x: 3, y: 0, color: 'red' },
      { x: 4, y: 0, color: 'hardGarbage' },
    ] });
  });

  const canvas = page.locator('#webpuyo_canvas');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState().board.puyos)).toEqual([{ x: 4, y: 0, color: 'garbage' }]);
});
