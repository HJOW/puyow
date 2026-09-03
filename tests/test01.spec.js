import { test, expect } from '@playwright/test';

const GAME_PAGE = '/puyow.html';
const THREE_SCRIPT = '**/js/three.min.js';

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
  await page.goto(GAME_PAGE);
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
    const drawingContext = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d');
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
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 360 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('새 src 하위 디렉토리의 게임 리소스를 로드한다', async ({ page }) => {
  const resources = await page.evaluate(() => ({
    stylesheet: new URL(document.querySelector('link[rel="stylesheet"]').href).pathname,
    icon: new URL(document.querySelector('link[rel="icon"]').href).pathname,
    manifest: new URL(document.querySelector('link[rel="manifest"]').href).pathname,
    scripts: [...document.scripts]
      .map((script) => script.src)
      .filter(Boolean)
      .map((src) => new URL(src).pathname),
  }));

  expect(resources.stylesheet).toBe('/css/puyow.css');
  expect(resources.icon).toBe('/img/icon45.png');
  expect(resources.manifest).toBe('/manifest.webmanifest');
  expect(resources.scripts).toEqual(expect.arrayContaining([
    '/js/three.min.js',
    '/js/json5.min.js',
    '/js/puyow.js',
  ]));
});

test('초기화는 최상위 div 안에 같은 난수 접미사의 2D·3D canvas를 만들고 destroy가 생성 DOM을 정리한다', async ({ page }) => {
  const initialized = await page.evaluate(() => {
    const root = document.getElementById('puyow_target');
    const twoDimensional = root.querySelector('[data-puyow-canvas="2d"]');
    const threeDimensional = root.querySelector('[data-puyow-canvas="3d"]');
    const twoMatch = twoDimensional.id.match(/^div_puyow_2d_(\d{8})$/);
    const threeMatch = threeDimensional.id.match(/^div_puyow_3d_(\d{8})$/);
    const twoBounds = twoDimensional.getBoundingClientRect();
    const threeBounds = threeDimensional.getBoundingClientRect();
    return {
      rootClass: root.classList.contains('div_puyow_root'),
      suffixes: [twoMatch?.[1], threeMatch?.[1]],
      canvasSizes: [[twoDimensional.width, twoDimensional.height], [threeDimensional.width, threeDimensional.height]],
      bounds: [[twoBounds.width, twoBounds.height], [threeBounds.width, threeBounds.height]],
      layers: [getComputedStyle(twoDimensional).zIndex, getComputedStyle(threeDimensional).zIndex],
      transparent: getComputedStyle(threeDimensional).backgroundColor,
      threeAvailable: threeDimensional.dataset.threeAvailable,
    };
  });

  expect(initialized.rootClass).toBe(true);
  expect(initialized.suffixes[0]).toMatch(/^\d{8}$/);
  expect(initialized.suffixes[0]).toBe(initialized.suffixes[1]);
  expect(initialized.canvasSizes[0]).toEqual(initialized.canvasSizes[1]);
  expect(initialized.bounds[0]).toEqual(initialized.bounds[1]);
  expect(initialized.layers).toEqual(['2', '1']);
  expect(initialized.transparent).toBe('rgba(0, 0, 0, 0)');
  expect(initialized.threeAvailable).toBe('true');

  const destroyed = await page.evaluate(() => {
    const extra = document.createElement('span');
    extra.className = 'div_puyow_root';
    document.body.appendChild(extra);
    window.PuyoW.destroy();
    const root = document.getElementById('puyow_target');
    const result = {
      rootRetained: document.body.contains(root),
      rootClassRemoved: !root.classList.contains('div_puyow_root'),
      generatedCanvasesRemoved: root.querySelectorAll('[data-puyow-canvas]').length === 0,
      everyRootClassRemoved: document.querySelectorAll('.div_puyow_root').length === 0,
      runtimeStyleRemoved: document.querySelector('style.puyow_runtime_layout') === null,
    };
    extra.remove();
    return result;
  });

  expect(destroyed).toEqual({
    rootRetained: true,
    rootClassRemoved: true,
    generatedCanvasesRemoved: true,
    everyRootClassRemoved: true,
    runtimeStyleRemoved: true,
  });

  const defaultRootLifecycle = await page.evaluate(() => {
    window.PuyoW.initialize();
    const root = document.querySelector('body > .div_puyow_root');
    const created = {
      directBodyChild: root?.parentElement === document.body,
      canvasCount: root?.querySelectorAll('[data-puyow-canvas]').length,
    };
    window.PuyoW.destroy();
    return { ...created, removed: !document.body.contains(root) };
  });
  expect(defaultRootLifecycle).toEqual({ directBodyChild: true, canvasCount: 2, removed: true });
});

test('Three.js가 없어도 3D canvas를 만들되 3D 컨텍스트 없이 2D 게임을 실행한다', async ({ page }) => {
  await page.addInitScript(() => {
    window.puyowCanvasContextRequests = [];
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function recordPuyowCanvasContext(type, ...args) {
      window.puyowCanvasContextRequests.push({ canvas: this.dataset.puyowCanvas || null, type });
      return originalGetContext.call(this, type, ...args);
    };
  });
  await page.route(THREE_SCRIPT, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.reload();

  const fallback = await page.evaluate(() => ({
    threeAvailable: document.querySelector('[data-puyow-canvas="3d"]').dataset.threeAvailable,
    threeContextRequests: window.puyowCanvasContextRequests.filter((request) => request.canvas === '3d'),
    screen: window.PuyoW.getScreenState().screen,
  }));

  expect(fallback).toEqual({ threeAvailable: 'false', threeContextRequests: [], screen: 'initial_title' });
  await enterMainMenu(page);
});

test('WebMCP 도구 스키마는 퍼즐뿌요와 최신 게임 상태 필드를 노출한다', async ({ page }) => {
  await page.addInitScript(() => {
    window.registeredWebMcpTools = [];
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      writable: true,
      value: { registerTool: (tool) => window.registeredWebMcpTools.push(tool) }
    });
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.registeredWebMcpTools.length)).toBe(5);

  const schema = await page.evaluate(() => {
    const tools = Object.fromEntries(window.registeredWebMcpTools.map((tool) => [tool.name, tool]));
    return {
      screenEnum: tools.now_screen.outputSchema.properties.screen.enum,
      statusRequired: tools.now_game_status.outputSchema.required,
      playerRequired: tools.now_game_status.outputSchema.properties.player.required,
      feverTargetMinimum: tools.now_game_status.outputSchema.properties.fever.properties.targetCombo.minimum,
      activeYType: tools.now_game_status.outputSchema.properties.player.properties.active.properties.y.type,
      puzzleConditionTypes: tools.now_game_status.outputSchema.properties.puzzle.properties.winConditionType.enum
    };
  });
  expect(schema.screenEnum).toContain('puzzle_stage_select');
  expect(schema.screenEnum).toContain('watch_select');
  expect(schema.statusRequired).toContain('puzzle');
  expect(schema.statusRequired).toContain('watch');
  expect(schema.playerRequired).toEqual(expect.arrayContaining(['point', 'attack', 'damage', 'normalDamage', 'combo', 'placedPairCount', 'allClearTicket']));
  expect(schema.feverTargetMinimum).toBe(4);
  expect(schema.activeYType).toBe('number');
  expect(schema.puzzleConditionTypes).toContain('color');
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

test('기본 룰은 AI에 다음 20쌍을 제공하고 공개 다음 뿌요는 두 쌍으로 유지한다', async ({ page }) => {
  await page.evaluate(() => {
    class BasicNextPairQueueEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -100; this.snapshot = null; }
      getClassType() { return 'BasicNextPairQueueEnemy'; }
      getName() { return '기본 다음 20쌍 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (!this.snapshot) {
          const plans = window.WebPuyo.common.simulateNMovePlacements(player, 6, 3);
          this.snapshot = {
            queuedPairCount: player.nextPairs.length,
            hasThreeMovePath: plans.some((plan) => plan.nextResult?.nextResult),
            workerDepth: null,
          };
          window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 6, 3, 1000).promise
            .then((result) => { this.snapshot.workerDepth = result.depth; });
        }
        this.player = player;
        window.basicNextPairQueueEnemy = this;
        player.fallTimer = -100000;
      }

      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new BasicNextPairQueueEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const controller = window.basicNextPairQueueEnemy;
    if (!controller?.snapshot || controller.snapshot.workerDepth === null) return null;
    const state = window.WebPuyo.getGameState();
    const next = window.WebPuyo.getNextPairs();
    return {
      queuedPairCount: controller.snapshot.queuedPairCount,
      hasThreeMovePath: controller.snapshot.hasThreeMovePath,
      workerDepth: controller.snapshot.workerDepth,
      statePairCount: state?.opponent.nextPairs.length,
      apiPairCount: next?.opponent.nextPairs.length,
    };
  }), { timeout: 10000 }).toEqual(expect.objectContaining({
    queuedPairCount: 20,
    hasThreeMovePath: true,
    workerDepth: expect.any(Number),
    statePairCount: 2,
    apiPairCount: 2,
  }));
});

test('피버 룰도 AI용 다음 20쌍을 유지한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverNextPairQueueEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'FeverNextPairQueueEnemy'; }
      getName() { return '피버 다음 20쌍 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        window.feverNextPairQueueEnemy = { queuedPairCount: player.nextPairs.length };
        player.fallTimer = -100000;
      }

      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverNextPairQueueEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => ({
    queuedPairCount: window.feverNextPairQueueEnemy?.queuedPairCount,
    statePairCount: window.WebPuyo.getGameState()?.opponent.nextPairs.length,
    apiPairCount: window.WebPuyo.getNextPairs()?.opponent.nextPairs.length,
  })), { timeout: 10000 }).toEqual({ queuedPairCount: 20, statePairCount: 2, apiPairCount: 2 });
});

test('구경 모드는 양쪽 AI에 다음 20쌍을 제공한다', async ({ page }) => {
  await page.evaluate(() => {
    class WatchNextPairQueueEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'WatchNextPairQueueEnemy'; }
      getName() { return '구경 다음 20쌍 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        window.watchNextPairQueueEnemy = { queuedPairCount: player.nextPairs.length };
        player.fallTimer = -100000;
      }

      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new WatchNextPairQueueEnemy() });
    window.WebPuyo.addCode('observation');
    Math.random = () => 0;
  });

  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => ({
    queuedPairCount: window.watchNextPairQueueEnemy?.queuedPairCount,
    playerPairCount: window.WebPuyo.getGameState()?.player.nextPairs.length,
    opponentPairCount: window.WebPuyo.getGameState()?.opponent.nextPairs.length,
  })), { timeout: 10000 }).toEqual({ queuedPairCount: 20, playerPairCount: 2, opponentPairCount: 2 });
});

test('DAMAGE 방해뿌요 30개는 현재 숨김 생성 범위의 다섯 줄(Y 16~20)에서 생성된다', async ({ page }) => {
  await page.evaluate(() => {
    class GarbageSpawnPositionEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -100; this.prepared = false; }
      getClassType() { return 'GarbageSpawnPositionEnemy'; }
      getName() { return '방해뿌요 생성 위치 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        // 모든 열의 Y 0~15를 채워 생성된 방해뿌요가 중력으로 더 내려가지 않게 한다.
        player.board = Array.from({ length: 25 }, (_, y) => Array.from({ length: 6 }, () => (y <= 15 ? 'red' : null)));
        player.damage = 30;
        player.phase = 'garbage';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new GarbageSpawnPositionEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const puyos = window.WebPuyo.getGameState()?.opponent.board.puyos || [];
    return [...new Set(puyos.filter((puyo) => puyo.color === 'garbage').map((puyo) => puyo.y))].sort((left, right) => left - right);
  }), { timeout: 5000 }).toEqual([16, 17, 18, 19, 20]);
});

test('registerPuzzleStage는 기존 PuzzlePuyoStage와 uid가 중복되면 등록하지 않는다', async ({ page }) => {
  const result = await page.evaluate(() => {
    const stages = window.WebPuyo.PUZZLE_STAGES;
    const initialLength = stages.length;
    const duplicate = new window.WebPuyo.PuzzlePuyoStage({ uid: stages[0].uid });
    let error = null;
    try {
      window.WebPuyo.registerPuzzleStage(duplicate);
    } catch (caught) {
      error = { name: caught.name, message: caught.message };
    }
    return { initialLength, finalLength: stages.length, error };
  });

  expect(result.finalLength).toBe(result.initialLength);
  expect(result.error?.name).toBe('Error');
  expect(result.error?.message).toContain('uid가 중복된');
});

test('시뮬레이터는 양쪽 기본 패배 칸을 표시하고 해당 칸의 뿌요를 앞에 그린다', async ({ page }) => {
  await enterMainMenu(page);
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

test('카드 뽑기는 확인 전에는 자원을 쓰지 않고 취소하거나 확인할 수 있으며 등급 문구를 표시하지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], gold: 10000 }));
  });
  await page.reload();
  await page.evaluate(() => { Math.random = () => 0; });
  await enterMainMenu(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('10,000 GOLD'))).toBe(true);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '1장 뽑기를 진행할까요?', 'Draw 1 card?', 'カードを1枚引きますか？', '要抽1张卡牌吗？', '1 Karte ziehen?', 'Tirer 1 carte ?'
  ].includes(text)))).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).gold)).toBe(10000);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards') || '[]').length)).toBe(0);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).gold)).toBe(10000);
  await page.keyboard.press('Enter');
  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 550, y: 459 } });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards'))?.length)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).gold)).toBe(9000);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards'))[0].type)).toBe('puyo:red');
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => ['COMMON', 'UNCOMMON', 'RARE', 'EPIC'].includes(text)))).toBe(false);
});

test('카드 5장을 선택해 합성하면 원본을 제거하고 새 카드 1장을 저장한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], gold: 0 }));
    localStorage.setItem('puyow_cards', JSON.stringify(Array.from({ length: 5 }, (_, index) => ({ id: `owned-${index}`, type: 'puyo:blue' }))));
  });
  await page.reload();
  await page.evaluate(() => { Math.random = () => 0; });
  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Enter');
    if (index < 4) await page.keyboard.press('ArrowRight');
  }
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards')).length)).toBe(5);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '선택한 카드 5장을 합성할까요?', 'Synthesize the 5 selected cards?', '選択したカード5枚を合成しますか？', '要合成所选的5张卡牌吗？', 'Die 5 ausgewählten Karten kombinieren?', 'Fusionner les 5 cartes sélectionnées ?'
  ].includes(text)))).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards'))?.length)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards'))[0].type)).toBe('puyo:red');
});

test('공개 askConfirm은 요청을 순서대로 표시하고 키보드와 마우스 선택 결과를 Promise로 반환한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.evaluate(() => {
    window.askConfirmResults = [];
    window.WebPuyo.askConfirm('First confirmation').then((value) => window.askConfirmResults.push(value));
    window.WebPuyo.askConfirm('Second confirmation').then((value) => window.askConfirmResults.push(value));
  });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('First confirmation'))).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Second confirmation'))).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.askConfirmResults)).toEqual([true, false]);

  await page.evaluate(() => {
    window.mouseConfirmResult = null;
    window.WebPuyo.askConfirm('Mouse confirmation').then((value) => { window.mouseConfirmResult = value; });
  });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Mouse confirmation'))).toBe(true);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 550, y: 459 } });
  await expect.poll(() => page.evaluate(() => window.mouseConfirmResult)).toBe(true);
});

test('게임 중 askConfirm은 응답 전까지 게임을 일시정지하고 응답 후 재개한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await page.evaluate(() => {
    window.gameConfirmResult = null;
    window.WebPuyo.askConfirm('Pause the match').then((value) => { window.gameConfirmResult = value; });
  });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Pause the match'))).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.gameConfirmResult)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
});

test('기존 퍼즐 진행도는 GOLD 보상 완료로 이관하고 잘못된 GOLD는 0으로 보정한다', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('puyow_store', JSON.stringify({
    clearList: [], gold: -10, puzzleClearStages: [0, 1], puzzleStarStages: [1]
  })));
  await page.reload();
  await enterMainMenu(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('0 GOLD'))).toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')));
  expect(stored.gold).toBe(0);
  expect(stored.puzzleGoldClearStages).toEqual([0, 1]);
  expect(stored.puzzleGoldStarStages).toEqual([1]);
});

test('메뉴에서 Z 키는 Enter 키처럼 동작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('z');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
});

test('설정의 AI 서비스 제공자는 OpenAI와 LM Studio를 라디오로 표시하고 기존 Google 값은 정규화한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { aiProvider: 'Google' } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('OpenAI'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('LM Studio'))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.includes('Google'))).toBe(false);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 740, y: 346 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.aiProvider)).toBe('LM Studio');
});

test('OpenAI에서는 AI API URL 포커스와 클릭을 건너뛰고 LM Studio에서는 키보드로 입력해 저장한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'OpenAI', aiApiURL: 'http://kept.example/', aiApiKey: '', aiModel: 'gpt-5.6-luna' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);

  // 비활성 URL 입력란은 클릭과 키 입력을 받지 않으며, 아래 이동은 API 키로 건너뛴다.
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 700, y: 390 } });
  await page.keyboard.type('blocked');
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.type('openai-key');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings)).toMatchObject({
    aiProvider: 'OpenAI', aiApiURL: 'http://kept.example/', aiApiKey: 'openai-key',
  });

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('http://192.168.0.5/');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings)).toMatchObject({
    aiProvider: 'LM Studio', aiApiURL: 'http://192.168.0.5/', aiApiKey: 'openai-key',
  });
});

test('Prompt API를 지원하지 않으면 선택지를 숨기고 저장된 Prompt API 설정을 LM Studio로 이관한다', async ({ page }) => {
  await page.addInitScript(() => { delete window.LanguageModel; });
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { aiProvider: 'Prompt API' } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  expect(await page.evaluate(() => window.testCanvasTextCalls.some((call) => call.text === 'Prompt API' && call.y === 346))).toBe(false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.aiProvider)).toBe('LM Studio');
});

test('Prompt API는 API 테스트와 솔로몬 배치에서 JSON Schema 제약 prompt를 사용한다', async ({ page }) => {
  await page.addInitScript(() => {
    window.promptApiCalls = [];
    window.LanguageModel = {
      create: async (createOptions) => {
        const call = { createOptions, prompt: null, promptOptions: null, destroyed: false };
        window.promptApiCalls.push(call);
        return {
          prompt: async (prompt, promptOptions) => {
            call.prompt = prompt;
            call.promptOptions = promptOptions;
            return window.promptApiCalls.length === 1 ? '{"success":true}' : '{"x":4,"rotation":1}';
          },
          destroy: () => { call.destroyed = true; },
        };
      },
    };
  });
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { aiProvider: 'OpenAI' } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Prompt API'))).toBe(true);
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.promptApiCalls.length)).toBe(1);
  expect(await page.evaluate(() => window.promptApiCalls[0])).toMatchObject({
    promptOptions: { responseConstraint: { required: ['success'] } },
    destroyed: true,
  });

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 300 } });
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.promptApiCalls.length), { timeout: 5000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.evaluate(() => {
    const active = window.WebPuyo.getGameState()?.opponent.active;
    return active ? { x: active.x, rotation: active.rotation } : null;
  }), { timeout: 3000 }).toEqual({ x: 4, rotation: 1 });
  expect(await page.evaluate(() => window.promptApiCalls[1])).toMatchObject({
    promptOptions: { responseConstraint: { required: ['x', 'rotation'] } },
    destroyed: true,
  });
});

test('설정의 배경음악·효과음 볼륨 값은 슬라이더 오른쪽 여백에 표시한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { musicVolume: 42, effectsVolume: 73 } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => {
    const values = window.testCanvasTextCalls.filter((call) => ['42', '73', 'Build 6'].includes(call.text));
      return {
      music: values.some((call) => call.text === '42' && call.x === 920 && call.y === 130),
      effects: values.some((call) => call.text === '73' && call.x === 920 && call.y === 174),
      build: values.some((call) => call.text === 'Build 6' && call.x === 10 && call.y === 710),
      };
  })).toEqual({ music: true, effects: true, build: true });
});

test('설정 오른쪽 아래 코드 버튼은 마우스로만 코드를 입력받고 공란은 무시한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [] }));
    localStorage.removeItem('puyow_code');
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await page.evaluate(() => {
    window.codePromptTitles = [];
    window.prompt = (title) => { window.codePromptTitles.push(title); return '  observation  '; };
  });
  for (let index = 0; index < 14; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.codePromptTitles)).toEqual([]);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 1232, y: 692 } });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')))).toEqual(['observation']);
  expect(await page.evaluate(() => window.codePromptTitles)).toEqual(['코드를 입력하세요']);

  await page.evaluate(() => { window.prompt = () => '   '; });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 1232, y: 692 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')))).toEqual(['observation']);

  await page.evaluate(() => { window.prompt = () => null; });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 1232, y: 692 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')))).toEqual(['observation']);
});

test('초기화 시 저장된 코드 배열을 불러오고 잘못된 값은 빈 배열로 보정한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [] }));
    localStorage.setItem('puyow_code', JSON.stringify(['saved-code']));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await page.evaluate(() => { window.prompt = () => 'observation'; });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 1232, y: 692 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')))).toEqual(['saved-code', 'observation']);

  await page.evaluate(() => localStorage.setItem('puyow_code', '{invalid-json'));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await page.evaluate(() => { window.prompt = () => 'observation'; });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 1232, y: 692 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')))).toEqual(['observation']);
});

test('observation 코드는 진행도를 바꾸지 않고 출시된 표시 적과 구경 모드를 연다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      clearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
    }));
    localStorage.setItem('puyow_code', JSON.stringify(['observation']));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => ['솔로몬', 'Solomon', 'ソロモン', '所罗门'].includes(text)))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['추후 출시예정', 'Coming soon', '近日公開予定', '即将推出'].includes(text)))).toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.name)).toBe('안드로말리우스');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.evaluate(() => {
    class ObservationHiddenEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1001; this.hidden = true; }
      getClassType() { return 'ObservationHiddenEnemy'; }
      getName() { return '구경 제외 숨김 적'; }
    }
    class ObservationPlannedEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1000; this.notAvail = true; }
      getClassType() { return 'ObservationPlannedEnemy'; }
      getName() { return '구경 제외 출시 예정 적'; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new ObservationHiddenEnemy() });
    window.WebPuyo.registerOpponent({ createController: () => new ObservationPlannedEnemy() });
    Math.random = () => 0;
  });
  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.watch)).toBe(true);
  const names = await page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return [state.player.name, state.opponent.name];
  });
  expect(names).toEqual(['세레', '데카라비아']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).clearList)).toEqual([]);
  await page.evaluate(() => localStorage.removeItem('puyow_code'));
});

test('플레이어 이름은 설정에 저장되며 게임 화면에 적용되고 최대 10자로 제한된다', async ({ page }) => {
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('PLAYER 1'))).toBe(true);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 82 } });
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type('ABCDEFGHIJK');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });

  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.playerName)).toBe('ABCDEFGHIJ');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getNextPairs().player.name)).toBe('ABCDEFGHIJ');
});

test('사운드 데이터 URL은 최대 200자로 저장되고 초기화 시 변환된 주소에서 읽는다', async ({ page }) => {
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '사운드 데이터 URL', 'Sound data URL', 'サウンドデータURL', '声音数据 URL',
  ].includes(text)))).toBe(true);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 302 } });
  await page.keyboard.type('x'.repeat(201));
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.soundDataURL.length)).toBe(200);

  let requestedUrl = null;
  await page.route('https://sound.example/**', async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sounds: [] }) });
  });
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('puyow_store'));
    store.settings.soundDataURL = 'https://sound.example/sounds_[LANG].json';
    localStorage.setItem('puyow_store', JSON.stringify(store));
  });
  await page.reload();
  await expect.poll(() => requestedUrl).toBe('https://sound.example/sounds_en.json');
});

test('설정 텍스트 입력은 선택, 복사, 붙여넣기와 클립보드 실패 시 선택 삭제를 지원한다', async ({ page }) => {
  await page.evaluate(() => {
    window.testClipboardText = '';
    window.testClipboardShouldFail = false;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: async () => {
          if (window.testClipboardShouldFail) throw new Error('clipboard read failed');
          return window.testClipboardText;
        },
        writeText: async (text) => { window.testClipboardText = text; },
      },
    });
  });
  await openSettings(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 302 } });
  await page.keyboard.type('before');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('abcdef');

  await page.keyboard.down('Shift');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Shift');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('X');
  await page.keyboard.down('Shift');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Control+C');
  expect(await page.evaluate(() => window.testClipboardText)).toBe('def');

  await page.keyboard.press('Backspace');
  await page.evaluate(() => { window.testClipboardText = 'YZ'; });
  await page.keyboard.press('Control+V');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('abcXYZ'))).toBe(true);
  await page.keyboard.down('Shift');
  for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Shift');
  await page.evaluate(() => { window.testClipboardText = '123'; });
  await page.keyboard.press('Control+V');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('abcX123'))).toBe(true);

  await page.keyboard.down('Shift');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Shift');
  await page.evaluate(() => { window.testClipboardShouldFail = true; window.testCanvasTexts = []; });
  await page.keyboard.press('Control+V');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('abcX'))).toBe(true);
});

test('그래픽 설정은 키보드와 마우스로 저장되며 캔버스 출력 해상도와 공개 좌표 변환 API에 반영된다', async ({ page }) => {
  expect(await page.evaluate(() => ({
    canvas: [document.querySelector('[data-puyow-canvas="2d"]').width, document.querySelector('[data-puyow-canvas="2d"]').height],
    output: window.WebPuyo.getCanvasOutputSize(),
  }))).toEqual({
    canvas: [1280, 720],
    output: { graphicsQuality: 'low', width: 1280, height: 720, scaleX: 1, scaleY: 1 },
  });

  await openSettings(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => [document.querySelector('[data-puyow-canvas="2d"]').width, document.querySelector('[data-puyow-canvas="2d"]').height])).toEqual([1920, 1080]);
  expect(await page.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem('puyow_store')).settings.graphicsQuality,
    point: window.WebPuyo.toCanvasCoordinates(640, 360),
    length: window.WebPuyo.toCanvasLength(38),
  }))).toEqual({ settings: 'medium', point: { x: 960, y: 540 }, length: 57 });

  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 895, y: 258 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  await expect.poll(() => page.evaluate(() => [document.querySelector('[data-puyow-canvas="2d"]').width, document.querySelector('[data-puyow-canvas="2d"]').height])).toEqual([3840, 2160]);
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
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.virtualController)).toBe('large');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 595, y: 214 } });
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowDown');
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
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 700, y: 518 } });
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
  for (let index = 0; index < 9; index += 1) await page.keyboard.press('ArrowDown');
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

test('AI API 테스트는 저장된 LM Studio URL과 토큰으로 Chat Completions 구조화 요청을 보낸다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'LM Studio', aiApiURL: 'http://192.168.0.5/', aiApiKey: 'lm-token', aiModel: 'local-model' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  let request = null;
  await page.route('http://192.168.0.5/v1/chat/completions', async (route) => {
    request = { body: route.request().postDataJSON(), authorization: route.request().headers().authorization };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ choices: [{ message: { content: '{"success":true}' } }] }),
    });
  });
  await openSettings(page);
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => request).not.toBeNull();
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('AI API test succeeded (JSON schema: passed).'))).toBe(true);
  expect(request.authorization).toBe('Bearer lm-token');
  expect(request.body).toMatchObject({
    model: 'local-model',
    messages: [{ role: 'user' }],
    response_format: { type: 'json_schema', json_schema: { name: 'ai_api_test_result', strict: true, schema: { required: ['success'] } } },
    max_tokens: 64,
    stream: false,
  });
  expect(request.body).not.toHaveProperty('reasoning');
});

test('솔로몬은 성공한 AI API 테스트 뒤 현재 접속에서만 안드로말리우스보다 앞에 표시된다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'OpenAI', aiApiKey: 'test-key', aiModel: 'gpt-5.6-luna' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.route('https://api.openai.com/v1/responses', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output_text: '{"success":true}' }) });
  });

  await openSettings(page);
  for (let index = 0; index < 9; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Solomon'))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('AI API test succeeded (JSON schema: passed).'))).toBe(true);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 300 } });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await expect.poll(() => page.evaluate(() => {
    const names = window.testCanvasTextCalls.filter(({ text }) => text === 'Solomon' || text === 'Andromalius');
    const solomonX = Math.min(...names.filter(({ text }) => text === 'Solomon').map(({ x }) => x));
    const andromaliusX = Math.min(...names.filter(({ text }) => text === 'Andromalius').map(({ x }) => x));
    return Number.isFinite(solomonX) && Number.isFinite(andromaliusX) && solomonX < andromaliusX;
  })).toBe(true);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.testCanvasTexts.includes('Solomon'))).toBe(false);
});

test('솔로몬은 매 턴 구조화된 배치를 요청하고 X 이동 후 회전과 난이도 지연을 적용한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'OpenAI', aiApiKey: 'solomon-key', aiModel: 'gpt-5.6-luna' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  const requestBodies = [];
  await page.route('https://api.openai.com/v1/responses', async (route) => {
    const body = route.request().postDataJSON();
    requestBodies.push(body);
    const outputText = requestBodies.length === 1 ? '{"success":true}' : '{"x":4,"rotation":1}';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output_text: outputText }) });
  });

  await openSettings(page);
  for (let index = 0; index < 9; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => requestBodies.length).toBe(1);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 300 } });
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => requestBodies.length, { timeout: 5000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.evaluate(() => {
    const active = window.WebPuyo.getGameState()?.opponent.active;
    return active ? { x: active.x, rotation: active.rotation } : null;
  }), { timeout: 3000 }).toEqual({ x: 4, rotation: 1 });

  expect(requestBodies[1]).toMatchObject({
    model: 'gpt-5.6-luna',
    reasoning: { effort: 'low' },
    text: { format: { type: 'json_schema', name: 'solomon_puyo_placement', strict: true, schema: { required: ['x', 'rotation'] } } },
  });
  const prompt = JSON.parse(requestBodies[1].input[0].content);
  expect(prompt.rules.mode).toBe('standard rules');
  expect(prompt.currentField).toMatchObject({ columns: 6, visibleRows: 12 });
  expect(prompt.suppliedPuyos.length).toBe(3);
  expect(prompt.fallbackSafetyCondition.dangerousCells).toEqual([{ x: 2, y: 5 }]);
  expect(prompt.responseSchema.required).toEqual(['x', 'rotation']);
});

test('솔로몬은 LM Studio 선택 시 저장된 서버와 토큰으로 Chat Completions 배치를 요청한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'LM Studio', aiApiURL: 'http://lmstudio.local/', aiApiKey: 'lm-solomon-token', aiModel: 'local-puyo-model' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  const requests = [];
  await page.route('http://lmstudio.local/v1/chat/completions', async (route) => {
    requests.push({ body: route.request().postDataJSON(), authorization: route.request().headers().authorization });
    const content = requests.length === 1 ? '{"success":true}' : '{"x":4,"rotation":1}';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });

  await openSettings(page);
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => requests.length).toBe(1);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 300 } });
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => requests.length, { timeout: 5000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.evaluate(() => {
    const active = window.WebPuyo.getGameState()?.opponent.active;
    return active ? { x: active.x, rotation: active.rotation } : null;
  }), { timeout: 3000 }).toEqual({ x: 4, rotation: 1 });

  expect(requests[1].authorization).toBe('Bearer lm-solomon-token');
  expect(requests[1].body).toMatchObject({
    model: 'local-puyo-model',
    messages: [{ role: 'user' }],
    response_format: { type: 'json_schema', json_schema: { name: 'solomon_puyo_placement', strict: true, schema: { required: ['x', 'rotation'] } } },
    max_tokens: 128,
    stream: false,
  });
  const prompt = JSON.parse(requests[1].body.messages[0].content);
  expect(prompt.currentField).toMatchObject({ columns: 6, visibleRows: 12 });
});

test('솔로몬의 잘못된 API 배치는 게임을 일시정지하고 현재 턴을 대체 AI로 전환한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'OpenAI', aiApiKey: 'solomon-key', aiModel: 'gpt-5.6-luna' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  let requestCount = 0;
  await page.route('https://api.openai.com/v1/responses', async (route) => {
    requestCount += 1;
    const outputText = requestCount === 1 ? '{"success":true}' : '{"x":99,"rotation":0}';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output_text: outputText }) });
  });

  await openSettings(page);
  for (let index = 0; index < 9; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => requestCount).toBe(1);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 300 } });
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('paused');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '솔로몬 AI 응답 오류: 대체 인공지능으로 진행합니다.',
    'Solomon AI response error: continuing with the fallback AI.',
    'ソロモンAIの応答エラー：代替AIで続行します。',
    '所罗门 AI 响应错误：将使用备用 AI 继续。',
  ].includes(text)))).toBe(true);
});

test('솔로몬은 응답 대기 중 뿌요가 착지하면 해당 요청을 취소하고 다음 턴에 다시 요청한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'OpenAI', aiApiKey: 'solomon-key', aiModel: 'gpt-5.6-luna' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.route('https://api.openai.com/v1/responses', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output_text: '{"success":true}' }) });
  });
  await openSettings(page);
  for (let index = 0; index < 9; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('AI API test succeeded (JSON schema: passed).'))).toBe(true);
  await page.unroute('https://api.openai.com/v1/responses');
  await page.evaluate(() => {
    window.testSolomonRequestCount = 0;
    window.testSolomonAbortCount = 0;
    window.fetch = (_url, options = {}) => {
      window.testSolomonRequestCount += 1;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          window.testSolomonAbortCount += 1;
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    };
  });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 300 } });
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.testSolomonAbortCount), { timeout: 8000 }).toBeGreaterThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.placedPairCount), { timeout: 3000 }).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).not.toBe('paused');
  await expect.poll(() => page.evaluate(() => window.testSolomonRequestCount), { timeout: 5000 }).toBeGreaterThanOrEqual(2);
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
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 434 } });
  await page.keyboard.press('x');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 700, y: 518 } });
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
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.feverEnter = 'sounds/test-fever-enter.ogg';
    window.WebPuyo.commonSoundPool.feverBackgroundMusic = 'sounds/test-continuous-fever-bgm.ogg';
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const texts = window.testCanvasTexts;
    const localizedOptions = [
      ['기본 룰', '피버 룰', '피버 룰 (시작)', '연습', '연속 피버'],
      ['Standard Rules', 'FEVER Rules', 'FEVER Rules (Start)', 'Practice', 'Continuous FEVER'],
      ['基本ルール', 'FEVERルール', 'FEVER ルール (開始)', '練習', '連続FEVER'],
      ['基本规则', 'FEVER规则', 'FEVER 规则（开始）', '练习', '连续FEVER'],
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 5000 }).toBe(true);
  const feverState = await page.evaluate(() => window.WebPuyo.getGameState());
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(expect.arrayContaining([
    'sounds/test-fever-enter.ogg', 'sounds/test-continuous-fever-bgm.ogg',
  ]));
  expect(feverState.fever.turn).toBe(1);
  expect(feverState.fever.selectedStageTarget).toBe(5);
  expect(feverState.player.board.puyos.length).toBeGreaterThan(0);
  expect(feverState.player.active.colors).toEqual(feverState.fever.stageSuppliedPair);
  expect(feverState.colors).toEqual(['red', 'green', 'yellow', 'blue', 'purple']);
  expect(await page.evaluate(() => Array.from(document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(210, 120, 1, 1).data))).toEqual([232, 144, 53, 255]);
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

test('조작 뿌요 자연 낙하 속도는 최대 16배까지 증가한다', async ({ page }) => {
  const multipliers = await page.evaluate(() => {
    const elapsedTimes = [0, 59999, 60000, 4440000, 4500000, 9000000];
    return {
      direct: elapsedTimes.map((elapsed) => window.WebPuyo.getPlayerFallSpeedMultiplier(elapsed)),
      common: elapsedTimes.map((elapsed) => window.WebPuyo.common.getPlayerFallSpeedMultiplier(elapsed)),
    };
  });
  expect(multipliers.direct).toEqual([1, 1, 1.2, 15.8, 16, 16]);
  expect(multipliers.common).toEqual(multipliers.direct);
});

test('피버·연속 피버에서 새로 지급된 조작 뿌요의 자연 낙하는 1.5배가 아니다', async ({ page }) => {
  async function measureNaturalDrop() {
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 5000 }).toBe(true);
    const before = await page.evaluate(() => window.WebPuyo.getGameState().player.active.y);
    await page.waitForTimeout(512);
    const after = await page.evaluate(() => window.WebPuyo.getGameState().player.active.y);
    return before - after;
  }

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const continuousFeverDrop = await measureNaturalDrop();

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('puyow_store') || '{"clearList":[]}');
    saved.feverClearListByDifficulty = { easy: [], normal: ['Kimaris'], hard: [], extreme: [] };
    localStorage.setItem('puyow_store', JSON.stringify(saved));
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  const feverStartDrop = await measureNaturalDrop();

  for (const drop of [continuousFeverDrop, feverStartDrop]) {
    expect(drop).toBeGreaterThan(0.18);
    expect(drop).toBeLessThan(0.34);
  }
});

test('빠른 하강 전 적 조작 뿌요의 자연 낙하는 난이도와 무관하게 플레이어와 같다', async ({ page }) => {
  await page.evaluate(() => {
    class NaturalFallSpeedEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'NaturalFallSpeedEnemy'; }
      getName() { return '자연 낙하 속도 테스트 적'; }
      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new NaturalFallSpeedEnemy() });
  });

  async function startAtDifficulty(key, moveCount, expectedKey) {
    await enterMainMenu(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
    await page.keyboard.press('ArrowDown');
    for (let index = 0; index < moveCount; index += 1) await page.keyboard.press(key);
    expect(await page.evaluate(() => window.WebPuyo.getSelectedDifficulty().key)).toBe(expectedKey);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);
  }

  await startAtDifficulty('ArrowLeft', 1, 'easy');
  const easyDrop = await page.evaluate(async () => {
    const before = window.WebPuyo.getGameState();
    await new Promise((resolve) => setTimeout(resolve, 512));
    const after = window.WebPuyo.getGameState();
    return {
      player: before.player.active.y - after.player.active.y,
      opponent: before.opponent.active.y - after.opponent.active.y,
    };
  });
  expect(easyDrop.player).toBeCloseTo(easyDrop.opponent, 2);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.evaluate(() => {
    class NaturalFallSpeedEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'NaturalFallSpeedEnemy'; }
      getName() { return '자연 낙하 속도 테스트 적'; }
      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new NaturalFallSpeedEnemy() });
  });
  await startAtDifficulty('ArrowRight', 2, 'extreme');
  const extremeDrop = await page.evaluate(async () => {
    const before = window.WebPuyo.getGameState();
    await new Promise((resolve) => setTimeout(resolve, 512));
    const after = window.WebPuyo.getGameState();
    return {
      player: before.player.active.y - after.player.active.y,
      opponent: before.opponent.active.y - after.opponent.active.y,
    };
  });
  expect(extremeDrop.player).toBeCloseTo(extremeDrop.opponent, 2);
});

test('연속 피버는 두 번째 패배 칸 (3, 11)도 패배로 판정하고 적 결과 상세를 숨긴다', async ({ page }) => {
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('game_over');
  await page.evaluate(() => { window.testCanvasTextCalls = []; });
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.testCanvasTextCalls.some(({ text, x }) => {
    const finalScorePrefixes = ['최종 점수', 'Final score', '最終スコア', '最终得分'];
    const soloModeLabels = ['연속 피버', 'Continuous FEVER', '連続FEVER', '连续FEVER'];
    return x >= 850 && (finalScorePrefixes.some((prefix) => text.startsWith(prefix)) || soloModeLabels.includes(text));
  }))).toBe(false);
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

test('피버 룰 (시작)은 키보드·마우스로 선택할 수 있고 양쪽이 즉시 5연쇄·60초 피버로 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const labels = ['피버 룰 (시작)', 'FEVER Rules (Start)', 'FEVER ルール (開始)', 'FEVER 规则（开始）'];
    const color = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(908, 312, 1, 1).data;
    return labels.some((label) => window.testCanvasTexts.includes(label)) && Array.from(color).join(',') === '60,70,80,255';
  })).toBe(true);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 908, y: 312 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('puyow_store') || '{"clearList":[]}');
    saved.feverClearListByDifficulty = { easy: [], normal: [], hard: ['Kimaris'], extreme: [] };
    localStorage.setItem('puyow_store', JSON.stringify(saved));
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const color = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(908, 312, 1, 1).data;
    return Array.from(color).join(',') === '75,31,111,255';
  })).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    const bothInFever = [state?.player, state?.opponent].every((player) => (
      player?.fever?.active && player.fever.targetCombo === 5 && player.fever.leftTime > 55000 && player.fever.leftTime <= 60000
    ));
    return state?.feverStart === true && state.feverRule === true && !state.continuousFever && bothInFever;
  }), { timeout: 10000 }).toBe(true);

  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 908, y: 312 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
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

test('적의 빠른 하강 대기 시간은 일반·위기 상황별 비율을 적용한다', async ({ page }) => {
  await page.evaluate(() => {
    class FastDownDelayRateEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -100;
        this.normalFastDownDelayRate = 0.5;
        this.dangerFastDownDelayRate = 0.1;
      }

      getClassType() { return 'FastDownDelayRateEnemy'; }
      getName() { return '빠른 하강 지연 비율 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        this.player = player;
        window.fastDownDelayRateEnemy = this;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FastDownDelayRateEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.fastDownDelayRateEnemy?.player)).toBeTruthy();

  const result = await page.evaluate(() => {
    const controller = window.fastDownDelayRateEnemy;
    const player = controller.player;
    player.aiDecisionElapsed = 749;
    const normalBefore = controller.useFastDown(player);
    player.aiDecisionElapsed = 750;
    const normalAt = controller.useFastDown(player);

    // 화면의 위기 표정 기준과 같이, 보이는 12행 중 절반인 6행을 채운다.
    player.board = Array.from({ length: 25 }, (_, y) => Array.from({ length: 6 }, () => (y < 6 ? 'red' : null)));
    player.aiDecisionElapsed = 149;
    const dangerBefore = controller.useFastDown(player);
    player.aiDecisionElapsed = 150;
    const dangerAt = controller.useFastDown(player);
    return { normalBefore, normalAt, dangerBefore, dangerAt };
  });

  expect(result).toEqual({ normalBefore: false, normalAt: true, dangerBefore: false, dangerAt: true });
});

test('세레의 일반 쌓기는 오른쪽 두 열, X=3 절반, 왼쪽부터 순서대로 진행한다', async ({ page }) => {
  await page.evaluate(() => {
    const originalPrepareTurn = window.WebPuyo.Enemy.prototype.prepareTurn;
    window.seereStandardBuildTargets = [];
    window.WebPuyo.Enemy.prototype.prepareTurn = function prepareSeereStandardBuildProbe(player) {
      if (this.getClassType() !== 'Seere' || window.seereStandardBuildTargets.length) {
        return originalPrepareTurn.call(this, player);
      }
      const createBoard = () => {
        const board = Array.from({ length: 25 }, () => Array(6).fill(null));
        // 빈 필드 무작위 착수 분기를 지나도록, 빌드·공격 조건과 무관한 하단 칸 하나만 채운다.
        board[0][2] = 'blue';
        return board;
      };
      const fillColumn = (board, column, height) => {
        const colors = ['red', 'green', 'yellow'];
        for (let y = 0; y < height; y += 1) board[y][column] = colors[(column + y) % colors.length];
      };
      const scenarios = [
        createBoard(),
        (() => { const board = createBoard(); fillColumn(board, 4, 12); fillColumn(board, 5, 12); return board; })(),
        (() => { const board = createBoard(); fillColumn(board, 4, 12); fillColumn(board, 5, 12); fillColumn(board, 3, 6); return board; })(),
        (() => { const board = createBoard(); fillColumn(board, 4, 12); fillColumn(board, 5, 12); fillColumn(board, 3, 6); fillColumn(board, 0, 12); return board; })(),
      ];
      scenarios.forEach((board) => {
        player.board = board;
        this.preparedPlacement = null;
        originalPrepareTurn.call(this, player);
        window.seereStandardBuildTargets.push(this.selectStandardRuleBuildPlacement(player)?.x ?? null);
      });
    };
    window.WebPuyo.addCode('observation');
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.name)).toBe('세레');
  await expect.poll(() => page.evaluate(() => window.seereStandardBuildTargets)).toEqual([expect.any(Number), 3, 0, 1]);
  expect(await page.evaluate(() => window.seereStandardBuildTargets[0])).toBeGreaterThanOrEqual(4);
});

test('세레는 오른쪽 하단 세 칸이 비어 있어도 일반 착수 카운트를 증가시키고 20~25회 간격을 사용한다', async ({ page }) => {
  await page.evaluate(() => {
    const originalPrepareTurn = window.WebPuyo.Enemy.prototype.prepareTurn;
    window.WebPuyo.Enemy.prototype.prepareTurn = function prepareSeereTurnCountProbe(player) {
      const result = originalPrepareTurn.call(this, player);
      if (this.getClassType() === 'Seere') window.seereTurnCountProbe = { controller: this, player };
      return result;
    };
    window.WebPuyo.addCode('observation');
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.seereTurnCountProbe !== undefined)).toBe(true);
  const result = await page.evaluate(() => {
    const { controller } = window.seereTurnCountProbe;
    const originalIsRightThreeRowsFilled = controller.isRightThreeRowsFilled;
    const originalSelectStandardRuleBuildPlacement = controller.selectStandardRuleBuildPlacement;
    const originalTurnsUntilSimulation = controller.turnsUntilSimulation;
    const originalTurnCount = controller.turnCount;
    const placement = { x: 5, rotation: 0, combo: 0, positions: [{ x: 5, y: 0 }, { x: 5, y: 1 }] };
    const player = {
      board: Array.from({ length: 25 }, () => Array(6).fill(null)),
      aiSimulations: [placement],
      fever: { active: false },
      active: { colors: ['red', 'blue'] },
      damage: 0
    };
    controller.preparedPlacement = null;
    controller.turnCount = 0;
    controller.turnsUntilSimulation = 99;
    controller.isRightThreeRowsFilled = () => false;
    controller.selectStandardRuleBuildPlacement = () => placement;
    controller.chooseTarget(player);
    const countedTurn = controller.turnCount;
    controller.turnCount = 0;
    controller.turnsUntilSimulation = 0;
    controller.chooseTarget(player);
    const simulationTurnCount = controller.turnCount;
    const intervals = Array.from({ length: 100 }, () => controller.randomTurnsUntilSimulation());
    controller.isRightThreeRowsFilled = originalIsRightThreeRowsFilled;
    controller.selectStandardRuleBuildPlacement = originalSelectStandardRuleBuildPlacement;
    controller.turnsUntilSimulation = originalTurnsUntilSimulation;
    controller.turnCount = originalTurnCount;
    return { countedTurn, simulationTurnCount, intervals };
  });

  expect(result.countedTurn).toBe(1);
  expect(result.simulationTurnCount).toBe(0);
  expect(result.intervals.every((interval) => interval >= 20 && interval <= 25)).toBe(true);
});

test('안드레알푸스는 기본·피버 룰에 출시되고 플라우로스는 출시 예정으로 표시된다', async ({ page }) => {
  await page.evaluate(() => {
    const cleared = ['Andromalius', 'Dantalion', 'Seere', 'Decarabia', 'Belial', 'Amdusias', 'Kimaris'];
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
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['안드레알푸스', 'Andrealphus', 'アンドレアルフス', '安德雷阿尔弗斯'].includes(text)))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['플라우로스', 'Flauros', 'フラウロス', '弗劳洛斯'].includes(text)))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['추후 출시예정', 'Coming soon', '近日公開予定', '即将推出'].includes(text)))).toBe(true);
  for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.name)).toBe('안드레알푸스');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.placedPairCount || 0), { timeout: 15000 }).toBeGreaterThan(1);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['플라우로스', 'Flauros', 'フラウロス', '弗劳洛斯'].includes(text)))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['추후 출시예정', 'Coming soon', '近日公開予定', '即将推出'].includes(text)))).toBe(true);
  for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.name)).toBe('안드레알푸스');
  expect(await page.evaluate(() => window.WebPuyo.getGameState()?.feverRule)).toBe(true);
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

test('피버 룰 (시작) 승리는 피버 룰과 분리된 진행도로 저장되고 적 갤러리를 해금한다', async ({ page }) => {
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('puyow_store') || '{"clearList":[]}');
    saved.feverClearListByDifficulty = { easy: [], normal: [], hard: ['Kimaris'], extreme: [] };
    localStorage.setItem('puyow_store', JSON.stringify(saved));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.evaluate(() => {
    class FeverStartProgressEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; }
      getClassType() { return 'FeverStartProgressEnemy'; }
      getName() { return '피버 시작 진행도 테스트 적'; }
      prepareTurn(player) {
        super.prepareTurn(player);
        player.board[11][3] = 'red';
        player.phase = 'check';
        player.phaseTimer = 150;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverStartProgressEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 10000 }).toBe('player');
  const progress = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('puyow_store'));
    const gallery = JSON.parse(localStorage.getItem('puyow_gallery'));
    return {
      fever: saved.feverClearListByDifficulty.normal,
      feverStart: saved.feverStartClearListByDifficulty.normal,
      gallery: gallery.enemies,
    };
  });
  expect(progress.fever).toEqual([]);
  expect(progress.feverStart).toEqual(['FeverStartProgressEnemy']);
  expect(progress.gallery).toContain('FeverStartProgressEnemy');
});

test('피버 룰 (시작)은 피버 룰의 여러 적 승리 기록이 있어도 적을 별도로 잠근다', async ({ page }) => {
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('puyow_store') || '{"clearList":[]}');
    saved.feverClearListByDifficulty = {
      easy: [],
      normal: ['Andromalius', 'Dantalion', 'Seere', 'Decarabia', 'Belial', 'Amdusias', 'Kimaris'],
      hard: [],
      extreme: [],
    };
    saved.feverStartClearListByDifficulty = { easy: [], normal: [], hard: [], extreme: [] };
    localStorage.setItem('puyow_store', JSON.stringify(saved));
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  await expect.poll(() => page.evaluate(() => {
    const texts = window.testCanvasTexts;
    const firstOpponent = ['안드로말리우스', 'Andromalius', 'アンドロマリウス', '安德罗马利乌斯'];
    const lockedOpponent = ['단탈리온', 'Dantalion', 'ダンタリオン', '丹塔利昂'];
    return firstOpponent.some((text) => texts.includes(text)) && !lockedOpponent.some((text) => texts.includes(text));
  })).toBe(true);
});

test('Enemy 기본 구현은 피버 상태에서 연쇄 최적 위치와 회전을 준비한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverComboPriorityEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -100;
      }

      getClassType() { return 'FeverComboPriorityEnemy'; }
      getName() { return '피버 연쇄 최적화 테스트 적'; }

      prepareTurn(player) {
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 3; x += 1) player.board[0][x] = 'red';
        player.active.colors = ['red', 'blue'];
        super.prepareTurn(player);
        player.fallTimer = -100000;
        this.player = player;
        window.feverComboPriorityEnemy = this;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverComboPriorityEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const controller = window.feverComboPriorityEnemy;
    if (!controller?.player) return null;
    const placement = controller.player.aiSimulations.find((simulation) => (
      simulation.x === controller.player.aiTarget && simulation.rotation === controller.player.aiRotation
    ));
    return {
      target: controller.player.aiTarget,
      rotation: controller.player.aiRotation,
      combo: placement?.combo,
      simulationCount: controller.player.aiSimulations.length,
    };
  }), { timeout: 10000 }).toEqual({ target: 0, rotation: 0, combo: 1, simulationCount: 22 });
});

test('외부 적은 피버 상태에서도 세 선택 메서드를 재정의해 독자 결정을 사용할 수 있다', async ({ page }) => {
  await page.evaluate(() => {
    class CustomFeverDecisionEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -100; this.targetCalled = false; this.rotationCalled = false; }
      getClassType() { return 'CustomFeverDecisionEnemy'; }
      getName() { return '피버 독자 결정 테스트 적'; }

      prepareTurn(player) {
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.fallTimer = -100000;
        this.player = player;
        window.customFeverDecisionEnemy = this;
      }

      chooseTarget() { this.targetCalled = true; return 5; }
      chooseRotate() { this.rotationCalled = true; return 2; }
      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new CustomFeverDecisionEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const controller = window.customFeverDecisionEnemy;
    return controller?.player ? {
      target: controller.player.aiTarget,
      rotation: controller.player.aiRotation,
      targetCalled: controller.targetCalled,
      rotationCalled: controller.rotationCalled,
    } : null;
  }), { timeout: 10000 }).toEqual({ target: 5, rotation: 2, targetCalled: true, rotationCalled: true });
});

test('키마리스는 3개 방해뿌요를 긴급 상쇄 우선순위에서 제외한다', async ({ page }) => {
  await page.evaluate(() => {
    class KimarisLookaheadEnemy extends window.WebPuyo.Kimaris {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'KimarisLookaheadEnemy'; }
      getName() { return '키마리스 3개 방해 테스트 적'; }

      prepareTurn(player) {
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let y = 0; y < 3; y += 1) player.board[y][0] = 'red';
        for (let y = 0; y < 2; y += 1) player.board[y][3] = 'red';
        player.board[0][5] = 'iron';
        player.normalDamage = 3;
        player.active.colors = ['red', 'red'];
        player.nextPairs[0] = ['red', 'blue'];
        super.prepareTurn(player);
        player.fallTimer = -100000;
        this.player = player;
        window.kimarisLookaheadEnemy = this;
      }

      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new KimarisLookaheadEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const controller = window.kimarisLookaheadEnemy;
    const player = controller?.player;
    const placement = controller?.attackPlacement;
    if (!player || !placement) return null;
    const plan = window.WebPuyo.common.findBestNMovePlacement(player, controller.targetCombo, controller.lookaheadTurnCount);
    const evaluation = plan && controller.evaluateLookaheadPlacement(player, plan, 3);
    return { combo: placement.combo, maxCombo: evaluation?.maxCombo, remainingIncoming: evaluation?.remainingIncoming };
  }), { timeout: 10000 }).not.toBeNull();
  const result = await page.evaluate(() => {
    const controller = window.kimarisLookaheadEnemy;
    const player = controller.player;
    const placement = controller.attackPlacement;
    const plan = window.WebPuyo.common.findBestNMovePlacement(player, controller.targetCombo, controller.lookaheadTurnCount);
    const evaluation = controller.evaluateLookaheadPlacement(player, plan, 3);
    return { combo: placement.combo, maxCombo: evaluation.maxCombo, remainingIncoming: evaluation.remainingIncoming };
  });
  expect(result.combo).toBe(0);
  expect(result.remainingIncoming).toBeLessThan(4);
  expect(result.maxCombo).toBeGreaterThanOrEqual(0);
  const priority = await page.evaluate(() => {
    const controller = new window.WebPuyo.Kimaris();
    const preferredLongTerm = {
      unresolvedDanger: true, remainingIncoming: 4, score: 100,
      maxCombo: 1, simulation: { x: 0 }
    };
    const emergencyCancel = {
      unresolvedDanger: false, remainingIncoming: 3, score: 1,
      maxCombo: 0, simulation: { x: 1 }
    };
    return {
      ignored: controller.isBetterLookaheadPlacement(emergencyCancel, preferredLongTerm, false),
      urgent: controller.isBetterLookaheadPlacement(emergencyCancel, preferredLongTerm, true),
    };
  });
  expect(priority).toEqual({ ignored: false, urgent: true });
});

test('키마리스는 4개 이상 방해뿌요가 남을 상황이면 즉시 상쇄를 우선한다', async ({ page }) => {
  await page.evaluate(() => {
    class KimarisCounterEnemy extends window.WebPuyo.Kimaris {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'KimarisCounterEnemy'; }
      getName() { return '키마리스 상쇄 테스트 적'; }

      prepareTurn(player) {
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let y = 0; y < 3; y += 1) player.board[y][0] = 'red';
        for (let y = 0; y < 2; y += 1) player.board[y][3] = 'red';
        player.board[0][5] = 'iron';
        player.normalDamage = 4;
        player.active.colors = ['red', 'red'];
        player.nextPairs[0] = ['red', 'blue'];
        super.prepareTurn(player);
        player.fallTimer = -100000;
        this.player = player;
        window.kimarisCounterEnemy = this;
      }

      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new KimarisCounterEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const controller = window.kimarisCounterEnemy;
    const player = controller?.player;
    const placement = controller?.attackPlacement;
    if (!player || !placement) return null;
    const plan = window.WebPuyo.common.simulateNMovePlacements(player, controller.targetCombo, controller.lookaheadTurnCount)
      .find((candidate) => candidate.simulation.x === placement.x && candidate.simulation.rotation === placement.rotation);
    const evaluation = plan && controller.evaluateLookaheadPlacement(player, plan, 4);
    return { combo: placement.combo, attack: placement.attack, remainingIncoming: evaluation?.remainingIncoming, unresolvedDanger: evaluation?.unresolvedDanger };
  }), { timeout: 10000 }).not.toBeNull();
  const result = await page.evaluate(() => {
    const controller = window.kimarisCounterEnemy;
    const player = controller.player;
    const placement = controller.attackPlacement;
    const plan = window.WebPuyo.common.simulateNMovePlacements(player, controller.targetCombo, controller.lookaheadTurnCount)
      .find((candidate) => candidate.simulation.x === placement.x && candidate.simulation.rotation === placement.rotation);
    const evaluation = controller.evaluateLookaheadPlacement(player, plan, 4);
    return { combo: placement.combo, attack: placement.attack, remainingIncoming: evaluation.remainingIncoming, unresolvedDanger: evaluation.unresolvedDanger };
  });
  expect(result.combo).toBeGreaterThanOrEqual(1);
  expect(Math.floor(result.attack)).toBeGreaterThanOrEqual(1);
  expect(result.remainingIncoming).toBeLessThan(4);
  expect(result.unresolvedDanger).toBe(false);
});

test('키마리스는 비피버 싹쓸이 경로를 6연쇄 기반보다 우선한다', async ({ page }) => {
  await page.evaluate(() => {
    class KimarisAllClearEnemy extends window.WebPuyo.Kimaris {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'KimarisAllClearEnemy'; }
      getName() { return '키마리스 싹쓸이 테스트 적'; }

      prepareTurn(player) {
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let y = 0; y < 3; y += 1) player.board[y][0] = 'red';
        for (let y = 0; y < 2; y += 1) player.board[y][3] = 'red';
        player.active.colors = ['red', 'red'];
        player.nextPairs[0] = ['red', 'blue'];
        super.prepareTurn(player);
        player.fallTimer = -100000;
        this.player = player;
        window.kimarisAllClearEnemy = this;
      }

      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new KimarisAllClearEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const controller = window.kimarisAllClearEnemy;
    const player = controller?.player;
    const placement = controller?.attackPlacement;
    if (!player || !placement) return null;
    const plan = window.WebPuyo.common.simulateNMovePlacements(player, controller.targetCombo, controller.lookaheadTurnCount)
      .find((candidate) => candidate.simulation.x === placement.x && candidate.simulation.rotation === placement.rotation);
    if (!plan) return null;
    return { combo: placement.combo, allClear: plan.allClear, nextAllClear: plan.nextResult?.allClear === true };
  }), { timeout: 10000 }).not.toBeNull();
  const plan = await page.evaluate(() => {
    const controller = window.kimarisAllClearEnemy;
    const player = controller.player;
    const placement = controller.attackPlacement;
    return window.WebPuyo.common.simulateNMovePlacements(player, controller.targetCombo, controller.lookaheadTurnCount)
      .find((candidate) => candidate.simulation.x === placement.x && candidate.simulation.rotation === placement.rotation);
  });
  expect(plan.simulation.combo).toBeGreaterThanOrEqual(1);
  expect(plan.allClear || plan.nextResult?.allClear).toBe(true);
});

test('안드레알푸스는 Worker 3수 싹쓸이 후보의 회전값을 실제 선택에 적용한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const board = Array.from({ length: 25 }, () => Array(6).fill(null));
    board[0][2] = 'yellow';
    board[1][2] = 'yellow';
    const player = {
      board,
      active: { x: 2, y: 12, rotation: 0, colors: ['yellow', 'yellow'] },
      nextPairs: [['red', 'blue'], ['green', 'blue']],
      aiSimulations: [],
      attack: 0,
      damage: 0,
      warningReductionDelay: 0,
      estimateAttack(colors, positions) { return window.WebPuyo.estimateAttack(this.board, colors, positions); },
      estimateCombo(colors, positions) { return window.WebPuyo.estimateCombo(this.board, colors, positions); },
    };
    const controller = new window.WebPuyo.Andrealphus();
    controller.lookaheadTimeLimitMs = 1000;
    controller.prepareTurn(player);
    const search = controller.pendingWorkerSearch;
    await search.promise;
    player.aiTarget = controller.chooseTarget(player);
    const rotation = controller.chooseRotate(player);
    const selectedPlan = window.WebPuyo.simulateNMovePlacements(player, controller.targetCombo, 1)
      .find((plan) => plan.simulation.x === player.aiTarget && plan.simulation.rotation === rotation);
    return {
      target: player.aiTarget,
      rotation,
      allClear: selectedPlan?.allClear === true,
      targetCombo: controller.targetCombo,
      lookaheadTurnCount: controller.lookaheadTurnCount,
      lookaheadTimeLimitMs: controller.lookaheadTimeLimitMs,
      workerSearchDepth: controller.workerSearchDepth,
      inheritsEnemy: controller instanceof window.WebPuyo.Enemy,
      workerSearchHelpers: ['beginWorkerSearchTurn', 'startWorkerLookaheadSearch', 'isWorkerSearchPending', 'getWorkerSearchTarget', 'getWorkerSearchRotation']
        .every((name) => typeof window.WebPuyo[name] === 'function'),
    };
  });

  expect(result).toEqual({
    target: 4,
    rotation: 3,
    allClear: true,
    targetCombo: 7,
    lookaheadTurnCount: 3,
    lookaheadTimeLimitMs: 1000,
    workerSearchDepth: 3,
    inheritsEnemy: true,
    workerSearchHelpers: true,
  });
});

test('외부 Enemy 하위 클래스도 Worker 탐색 보조 함수로 결과를 적용한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    class ExternalWorkerEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.targetCombo = 7;
        this.lookaheadTurnCount = 3;
        this.lookaheadTimeLimitMs = 1000;
        this.ignorableIncomingGarbage = 4;
      }

      getClassType() { return 'ExternalWorkerEnemy'; }
      getName() { return '외부 Worker 탐색 적'; }

      prepareTurn(player) {
        window.WebPuyo.beginWorkerSearchTurn(this);
        super.prepareTurn(player);
        if (!this.getPreparedPlacement()) window.WebPuyo.startWorkerLookaheadSearch(this, player);
      }

      chooseTarget(player) { return window.WebPuyo.getWorkerSearchTarget(this, player); }
      chooseRotate(player) { return window.WebPuyo.getWorkerSearchRotation(this, player); }
      updateControl(player) { return window.WebPuyo.isWorkerSearchPending(this, player); }
    }

    const board = Array.from({ length: 25 }, () => Array(6).fill(null));
    board[0][2] = 'yellow';
    board[1][2] = 'yellow';
    const player = {
      board,
      active: { x: 2, y: 12, rotation: 0, colors: ['yellow', 'yellow'] },
      nextPairs: [['red', 'blue'], ['green', 'blue']],
      aiSimulations: [],
      attack: 0,
      damage: 0,
      warningReductionDelay: 0,
      estimateAttack(colors, positions) { return window.WebPuyo.estimateAttack(this.board, colors, positions); },
      estimateCombo(colors, positions) { return window.WebPuyo.estimateCombo(this.board, colors, positions); },
    };
    const controller = new ExternalWorkerEnemy();
    controller.prepareTurn(player);
    await controller.pendingWorkerSearch.promise;
    const target = controller.chooseTarget(player);
    const rotation = controller.chooseRotate(player);
    return {
      inheritsEnemy: controller instanceof window.WebPuyo.Enemy,
      state: controller.workerSearchState,
      pending: controller.updateControl(player),
      validPlacement: player.aiSimulations.some((candidate) => candidate.x === target && candidate.rotation === rotation),
    };
  });

  expect(result).toEqual({ inheritsEnemy: true, state: 'ready', pending: false, validPlacement: true });
});

test('3수 이상 공통 Worker 탐색은 정상 완료 Worker를 다음 요청에서 재사용한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const board = Array.from({ length: 25 }, () => Array(6).fill(null));
    board[0][0] = 'red';
    board[0][1] = 'red';
    const player = {
      board,
      active: { x: 2, y: 12, rotation: 0, colors: ['red', 'blue'] },
      nextPairs: [['green', 'yellow'], ['blue', 'red']],
      aiSimulations: [],
      attack: 0,
      damage: 0,
      warningReductionDelay: 0,
      estimateAttack(colors, positions) { return window.WebPuyo.estimateAttack(this.board, colors, positions); },
      estimateCombo(colors, positions) { return window.WebPuyo.estimateCombo(this.board, colors, positions); },
    };
    const originalCreateObjectURL = URL.createObjectURL;
    let createdWorkerCount = 0;
    URL.createObjectURL = (...args) => {
      createdWorkerCount += 1;
      return originalCreateObjectURL.apply(URL, args);
    };
    try {
      await window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 6, 3, 1000).promise;
      await window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 6, 3, 1000).promise;
      return createdWorkerCount;
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
    }
  });

  expect(result).toBe(1);
});

test('3수 이상 공통 Worker 탐색은 깊이별 현재 1수 결과를 순서대로 전달한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const board = Array.from({ length: 25 }, () => Array(6).fill(null));
    board[0][0] = 'red';
    board[0][1] = 'red';
    const player = {
      board,
      active: { x: 2, y: 12, rotation: 0, colors: ['red', 'blue'] },
      nextPairs: [['green', 'yellow'], ['blue', 'red']],
      aiSimulations: [],
      attack: 0,
      damage: 0,
      warningReductionDelay: 0,
      estimateAttack(colors, positions) { return window.WebPuyo.estimateAttack(this.board, colors, positions); },
      estimateCombo(colors, positions) { return window.WebPuyo.estimateCombo(this.board, colors, positions); },
    };
    const opponent = {
      board: Array.from({ length: 25 }, () => Array(6).fill(null)),
      active: null,
      nextPairs: [],
      attack: 0,
      damage: 0,
      announcedAttack: 0,
      warningReductionDelay: 0,
    };
    const depths = [];
    const search = window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 6, 3, 1000, {
      opponent,
      urgentGarbageThreshold: 4,
      onProgress: (progress) => depths.push(progress.depth),
    });
    const completed = await search.promise;
    return {
      depths,
      depth: completed.depth,
      fallback: completed.fallback,
      placement: completed.placement ? { x: completed.placement.x, rotation: completed.placement.rotation } : null,
    };
  });

  expect(result.depths).toEqual([1, 2, 3]);
  expect(result).toMatchObject({ depth: 3, fallback: false });
  expect(result.placement).toMatchObject({ x: expect.any(Number), rotation: expect.any(Number) });
});

test('3수 Worker 메인 콜백 오류는 기존 1수 탐색 결과로 즉시 대체한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const board = Array.from({ length: 25 }, () => Array(6).fill(null));
    board[0][0] = 'red';
    board[0][1] = 'red';
    const player = {
      board,
      active: { x: 2, y: 12, rotation: 0, colors: ['red', 'blue'] },
      nextPairs: [['green', 'yellow'], ['blue', 'red']],
      aiSimulations: [],
      attack: 0,
      damage: 0,
      warningReductionDelay: 0,
      estimateAttack(colors, positions) { return window.WebPuyo.estimateAttack(this.board, colors, positions); },
      estimateCombo(colors, positions) { return window.WebPuyo.estimateCombo(this.board, colors, positions); },
    };
    new window.WebPuyo.Enemy().prepareTurn(player);
    const errors = [];
    const originalConsoleError = console.error;
    console.error = (...args) => errors.push(args.map(String).join(' '));
    try {
      const search = window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 6, 3, 1000, {
        onProgress: () => { throw new Error('테스트용 메인 콜백 오류'); },
      });
      const completed = await search.promise;
      return {
        fallback: completed.fallback,
        depth: completed.depth,
        placement: completed.placement ? { x: completed.placement.x, rotation: completed.placement.rotation } : null,
        errorLogged: errors.some((message) => message.includes('테스트용 메인 콜백 오류')),
      };
    } finally {
      console.error = originalConsoleError;
    }
  });

  expect(result).toMatchObject({ fallback: true, depth: 0, errorLogged: true });
  expect(result.placement).toMatchObject({ x: expect.any(Number), rotation: expect.any(Number) });
});

test('키마리스 2턴 시뮬레이션 처리 시간을 측정한다', async ({ page }) => {
  await page.evaluate(() => {
    class KimarisTimingEnemy extends window.WebPuyo.Kimaris {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'KimarisTimingEnemy'; }
      getName() { return '키마리스 2턴 시뮬레이션 시간 측정 적'; }

      prepareTurn(player) {
        // 4색을 열마다 번갈아 배치해 필드에 12개를 고정한다.
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        const colors = ['red', 'blue', 'green', 'yellow'];
        for (let y = 0; y < 3; y += 1) {
          for (let x = 0; x < 4; x += 1) player.board[y][x] = colors[x];
        }
        player.active.colors = ['red', 'blue'];
        player.nextPairs = [['green', 'yellow'], ['blue', 'red']];

        // 공통 준비 단계에서 현재 턴의 후보를 만들고, 키마리스의 2턴 읽기만 측정한다.
        window.WebPuyo.Enemy.prototype.prepareTurn.call(this, player);
        this.findBestLookaheadPlacement(player); // 워밍업(JIT) 호출
        const samples = [];
        let firstPlacement = null;
        for (let index = 0; index < 7; index += 1) {
          const startedAt = performance.now();
          const placement = this.findBestLookaheadPlacement(player);
          const elapsedMs = performance.now() - startedAt;
          if (!firstPlacement) firstPlacement = placement;
          samples.push(elapsedMs);
        }
        const totalMs = samples.reduce((sum, elapsedMs) => sum + elapsedMs, 0);
        window.kimarisSimulationTiming = {
          boardPuyoCount: player.board.flat().filter(Boolean).length,
          lookaheadTurnCount: this.lookaheadTurnCount,
          simulationCount: player.aiSimulations.length,
          firstMs: samples[0],
          averageMs: totalMs / samples.length,
          minMs: Math.min(...samples),
          maxMs: Math.max(...samples),
          samples,
          placement: firstPlacement ? { x: firstPlacement.x, rotation: firstPlacement.rotation } : null,
        };
        player.fallTimer = -100000;
        this.player = player;
      }

      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new KimarisTimingEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.kimarisSimulationTiming || null), { timeout: 10000 }).not.toBeNull();
  const timing = await page.evaluate(() => window.kimarisSimulationTiming);
  console.log(`키마리스 2턴 시뮬레이션: 첫 회 ${timing.firstMs.toFixed(3)}ms, 평균 ${timing.averageMs.toFixed(3)}ms (최소 ${timing.minMs.toFixed(3)}ms, 최대 ${timing.maxMs.toFixed(3)}ms; 필드 ${timing.boardPuyoCount}개, 후보 ${timing.simulationCount}개)`);
  expect(timing.boardPuyoCount).toBeGreaterThanOrEqual(10);
  expect(timing.lookaheadTurnCount).toBe(2);
  expect(timing.simulationCount).toBeGreaterThan(0);
  expect(timing.samples).toHaveLength(7);
  expect(timing.placement).not.toBeNull();
});

test('기본 룰 적은 패배 위치 경고에서 X=2의 비폭발 배치를 최우선으로 피한다', async ({ page }) => {
  await page.evaluate(() => {
    class StandardDefeatPositionEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'StandardDefeatPositionEnemy'; }
      getName() { return '기본 패배 위치 테스트 적'; }

      prepareTurn(player) {
        player.board[8][2] = 'garbage';
        super.prepareTurn(player);
        player.fallTimer = -100000;
        this.player = player;
        window.standardDefeatPositionEnemy = this;
      }

      chooseTarget(player) { return super.chooseTarget(player); }
      chooseRotate(player) { return super.chooseRotate(player); }
      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new StandardDefeatPositionEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const player = window.standardDefeatPositionEnemy?.player;
    if (!player) return null;
    const placement = player.aiSimulations.find((simulation) => (
      simulation.x === player.aiTarget && simulation.rotation === player.aiRotation
    ));
    return placement?.positions.map((position) => position.x) || null;
  }), { timeout: 10000 }).not.toContain(2);
});

test('피버 룰의 비피버 적은 한 패배 위치 경고에도 X=2와 X=3의 비폭발 배치를 모두 피한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverDefeatPositionEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'FeverDefeatPositionEnemy'; }
      getName() { return '피버 패배 위치 테스트 적'; }

      prepareTurn(player) {
        player.board[8][2] = 'garbage';
        super.prepareTurn(player);
        player.fallTimer = -100000;
        this.player = player;
        window.feverDefeatPositionEnemy = this;
      }

      chooseTarget(player) { return super.chooseTarget(player); }
      chooseRotate(player) { return super.chooseRotate(player); }
      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverDefeatPositionEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const player = window.feverDefeatPositionEnemy?.player;
    if (!player) return null;
    const placement = player.aiSimulations.find((simulation) => (
      simulation.x === player.aiTarget && simulation.rotation === player.aiRotation
    ));
    return placement?.positions.map((position) => position.x) || null;
  }), { timeout: 10000 }).not.toEqual(expect.arrayContaining([2, 3]));
});

test('패배 위치 경고 중에도 X=2에 놓아 폭발하는 기본 룰 적 배치는 유지한다', async ({ page }) => {
  await page.evaluate(() => {
    class ExplodingDefeatPositionEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'ExplodingDefeatPositionEnemy'; }
      getName() { return '패배 위치 폭발 예외 테스트 적'; }

      prepareTurn(player) {
        player.board[8][2] = 'garbage';
        for (const x of [0, 1, 3]) {
          player.board[0][x] = 'red';
          player.board[1][x] = 'red';
        }
        player.active.colors = ['red', 'blue'];
        super.prepareTurn(player);
        player.fallTimer = -100000;
        this.player = player;
        window.explodingDefeatPositionEnemy = this;
      }

      chooseTarget(player) { return super.chooseTarget(player); }
      chooseRotate(player) { return super.chooseRotate(player); }
      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new ExplodingDefeatPositionEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const player = window.explodingDefeatPositionEnemy?.player;
    if (!player) return null;
    const placement = player.aiSimulations.find((simulation) => (
      simulation.x === player.aiTarget && simulation.rotation === player.aiRotation
    ));
    return placement ? { target: player.aiTarget, rotation: player.aiRotation, combo: placement.combo } : null;
  }), { timeout: 10000 }).toEqual({ target: 2, rotation: 0, combo: 1 });
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
    const drawingContext = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d');
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
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
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

test('기본 룰의 싹쓸이 티켓은 다음 폭발에서 고정 점수·ATTACK을 적용하고 다시 획득한다', async ({ page }) => {
  await page.evaluate(() => {
    class AllClearTicketEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -2; }
      getClassType() { return 'AllClearTicketEnemy'; }
      getName() { return '싹쓸이 티켓 테스트 적'; }
      prepareTurn(player) { this.player = player; player.fallTimer = -100000; window.allClearTicketEnemy = this; }
      chooseTarget(player) { return player.active.x; }
      chooseRotate(player) { return player.active.rotation; }
      useFastDown() { return false; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new AllClearTicketEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.allClearTicketEnemy?.player?.phase), { timeout: 6000 }).toBe('control');

  await page.evaluate(() => {
    const player = window.allClearTicketEnemy.player;
    player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
    for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
    player.hasPlacedPuyoSinceAllClear = true;
    player.phase = 'explode';
    player.phaseTimer = 150;
  });
  await expect.poll(() => page.evaluate(() => {
    const player = window.allClearTicketEnemy?.player;
    return player && { point: player.point, ticket: player.allClearTicket };
  }), { timeout: 6000 }).toEqual({ point: 40, ticket: true });

  await page.evaluate(() => {
    const player = window.allClearTicketEnemy.player;
    player.damage = 20;
    player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
    for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
    player.hasPlacedPuyoSinceAllClear = true;
    player.phase = 'explode';
    player.phaseTimer = 150;
  });
  await expect.poll(() => page.evaluate(() => {
    const player = window.allClearTicketEnemy?.player;
    return player && { point: player.point, damage: player.damage, ticket: player.allClearTicket };
  }), { timeout: 6000 }).toEqual({ point: 2180, damage: 0, ticket: true });
});

test('연속 피버와 피버 상태는 낮은 연쇄 뒤 4연쇄 피버 패턴을 사용한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverLowComboEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverLowComboEnemy'; }
      getName() { return '피버 저연쇄 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        this.player = player;
        window.feverLowComboEnemy = this;
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
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
  expect(await page.evaluate(() => window.feverLowComboEnemy.player.fever.randomizeStageOpening)).toBe(false);
});

test('피버 룰의 빈 필드 싹쓸이 뒤 4연쇄 패턴 첫 AI 배치는 무작위 대상으로 예약된다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverEmptyStageEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverEmptyStageEnemy'; }
      getName() { return '피버 빈 필드 패턴 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        this.player = player;
        window.feverEmptyStageEnemy = this;
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = false;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        player.allClearEffectElapsed = 0;
        player.phase = 'feverAllClearWait';
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverEmptyStageEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.selectedStageTarget), { timeout: 10000 }).toBe(4);
  expect(await page.evaluate(() => window.feverEmptyStageEnemy.player.fever.randomizeStageOpening)).toBe(true);
});

test('피버 상태는 낮은 연쇄 싹쓸이 뒤 직전 목표보다 한 단계만 낮은 목표를 사용한다', async ({ page }) => {
  await page.evaluate(() => {
    class FeverTargetFloorEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverTargetFloorEnemy'; }
      getName() { return '피버 목표 하한 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        player.fever.leftTime = 10000;
        player.fever.targetCombo = 7;
        // 1연쇄 싹쓸이의 기존 계산값은 4이지만, 직전 목표 7의 -1인 6을 하한으로 적용해야 한다.
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.hasPlacedPuyoSinceAllClear = true;
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverTargetFloorEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.targetCombo), { timeout: 10000 }).toBe(6);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().opponent.fever.selectedStageTarget)).toBe(6);
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
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
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
    window.WebPuyo.commonSoundPool.clears = 'sounds/test-clear.ogg';
    window.WebPuyo.commonSoundPool.feverEnter = 'sounds/test-fever-enter.ogg';
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
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
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
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(expect.arrayContaining([
    'sounds/test-clear.ogg', 'sounds/test-fever-enter.ogg',
  ]));
  const state = await page.evaluate(() => window.WebPuyo.getGameState().opponent.fever);
  expect(state.targetCombo).toBe(7);
  expect(state.selectedStageTarget).toBe(7);
});

test('common sound pool plays the Fever gauge light sound after an offset', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.feverLightOn = 'sounds/test-fever-light.ogg';
    class FeverLightEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverLightEnemy'; }
      getName() { return 'Fever light sound test'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.damage = 1;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverLightEnemy() });
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

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.fever?.gauge), { timeout: 10000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(expect.arrayContaining([
    'sounds/test-fever-light.ogg',
  ]));
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
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
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

test('연쇄 도중 상쇄되어 최종 전달량이 0인 공격은 상대 예고뿌요를 남기지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    class CancelledAttackPreviewEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.sortPriority = -100;
        this.prepared = false;
      }

      getClassType() { return 'CancelledAttackPreviewEnemy'; }
      getName() { return '상쇄 예고뿌요 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        this.player = player;
        window.cancelledAttackPreviewEnemy = this;
        player.allClearEnabled = false;
        // 첫 폭발은 ATTACK 예고를 출발시키고, 낙하한 두 번째 색 뿌요가 이어서 폭발한다.
        player.attack = 10;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 6; x += 1) player.board[0][x] = 'red';
        for (let x = 0; x < 3; x += 1) player.board[1][x] = 'green';
        player.board[2][3] = 'green';
        player.phase = 'explode';
        player.phaseTimer = 0;
        // 첫 예고가 상대 천장에 도착한 뒤, 두 번째 폭발의 ATTACK이 이를 포함해 자신의 DAMAGE를 모두 상쇄한다.
        window.setTimeout(() => {
          player.damage = 100000;
          window.cancelledAttackPreviewDamageQueued = true;
        }, 300);
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new CancelledAttackPreviewEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.cancelledAttackPreviewDamageQueued === true)).toBe(true);
  await page.waitForTimeout(3000);
  const result = await page.evaluate(() => {
    const controller = window.cancelledAttackPreviewEnemy;
    const state = window.WebPuyo.getGameState();
    return { announcedAttack: controller?.player?.announcedAttack, warningPuyos: state?.player.warningPuyos };
  });
  expect(result).toEqual({ announcedAttack: 0, warningPuyos: [] });
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
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
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

test('피버 룰은 DAMAGE 전달 뒤 상대 방해뿌요 낙하를 기다리지 않고 다음 피버 스테이지를 준비한다', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.backgroundMusic = 'sounds/test-normal-bgm.ogg';
    window.WebPuyo.commonSoundPool.feverBackgroundMusic = 'sounds/test-fever-bgm.ogg';
    class FeverNextStageBeforeGarbageEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; this.prepared = false; }
      getClassType() { return 'FeverNextStageBeforeGarbageEnemy'; }
      getName() { return '피버 즉시 다음 스테이지 테스트 적'; }

      prepareTurn(player) {
        super.prepareTurn(player);
        if (this.prepared) return;
        this.prepared = true;
        player.fever.active = true;
        player.fever.leftTime = 10000;
        // 1연쇄 뒤 남은 ATTACK 1을 상대 DAMAGE로 확정한다.
        player.attack = 1;
        player.board = Array.from({ length: 25 }, () => Array(6).fill(null));
        for (let x = 0; x < 4; x += 1) player.board[0][x] = 'red';
        player.phase = 'explode';
        player.phaseTimer = 0;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new FeverNextStageBeforeGarbageEnemy() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.player.phase === 'control'
      && state.player.damage >= 1
      && state.opponent.fever?.active === true
      && state.opponent.fever.selectedStageTarget === 4;
  }), { timeout: 10000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.some((audio) => (
    audio.src === 'sounds/test-fever-bgm.ogg' && !audio.paused
  )))).toBe(true);
});

test('연속 피버는 다음 스테이지 배치 때 DAMAGE 예고를 없애고 방해뿌요를 생성하지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    Math.random = () => 0.999999;
    window.WebPuyo.registerFeverStageState(new window.WebPuyo.FeverStageState(
      { puyos: [
        { x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 2, y: 0, color: 'red' },
        { x: 3, y: 0, color: 'red' }, { x: 4, y: 0, color: 'red' }, { x: 5, y: 0, color: 'red' },
        { x: 0, y: 1, color: 'red' }, { x: 1, y: 1, color: 'red' },
      ] },
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 5000 }).toBe(true);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().fever.stageSuppliedPair)).toEqual(['blue', 'blue']);

  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');

  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state?.continuousFever === true
      && state.fever?.selectedStageTarget === 4
      && state.opponent.phase === 'idle'
      && state.player.attack === 0
      && state.player.damage === 0
      && state.opponent.attack === 0
      && state.opponent.damage === 0
      && state.player.warningPuyos.length === 0
      && state.opponent.warningPuyos.length === 0
      && state.opponent.board.puyos.length === 0;
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
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 20, y: 20 } });
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

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 520, y: 364 } });
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

test('플레이 방법 4단계는 보라 싹쓸이 뒤 빨강 두 쌍으로 티켓 공격과 재싹쓸이를 시연한다', async ({ page }) => {
  await page.addInitScript(() => {
    let tutorialTime = performance.now();
    window.requestAnimationFrame = (callback) => window.setTimeout(() => {
      tutorialTime += 50;
      callback(tutorialTime);
    }, 4);
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const nextPairs = window.WebPuyo.getNextPairs()?.player.nextPairs || [];
    window.tutorialSawTicketPairSequence ||= nextPairs[0]?.every((color) => color === 'red')
      && nextPairs[1]?.every((color) => color === 'red');
    window.tutorialEnteredStageFive ||= nextPairs[0]?.[0] === 'red' && nextPairs[0]?.[1] === 'blue';
    return {
      ticketPairSequence: window.tutorialSawTicketPairSequence,
      enteredStageFive: window.tutorialEnteredStageFive,
      nextPairs
    };
  }), { timeout: 20000, intervals: [20] }).toMatchObject({ ticketPairSequence: true, enteredStageFive: true });
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
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 20, y: 20 } });
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

test('독일어와 프랑스어 stringTable은 FEVER 표기와 주요 화면 문구를 제공한다', async ({ page }) => {
  const expected = {
    'de-DE': { fever: 'FEVER-Regeln', feverStart: 'FEVER-Regeln (Start)', relaxedFever: 'FEVER (Entspannt)', puzzle: 'Puzzle-Puyo', start: 'Spiel starten', watch: 'Zuschauen', language: 'de' },
    'fr-FR': { fever: 'Règles FEVER', feverStart: 'Règles FEVER (Début)', relaxedFever: 'FEVER (adouci)', puzzle: 'Puzzle Puyo', start: 'Commencer', watch: 'Regarder', language: 'fr' }
  };
  for (const [locale, values] of Object.entries(expected)) {
    await page.addInitScript((language) => {
      Object.defineProperty(navigator, 'language', { configurable: true, value: language });
    }, locale);
    await page.reload();
    const result = await page.evaluate(() => {
      window.WebPuyo.setURLContextPath('/puyow/');
      return {
        fever: window.WebPuyo.translate('피버 룰'),
        feverStart: window.WebPuyo.translate('피버 룰 (시작)'),
        relaxedFever: window.WebPuyo.translate('피버 (완화)'),
        puzzle: window.WebPuyo.translate('퍼즐뿌요'),
        start: window.WebPuyo.translate('게임 시작'),
        watch: window.WebPuyo.translate('구경'),
        language: window.WebPuyo.convertURL('[LANG]')
      };
    });
    expect(result).toEqual({ ...values, language: `${values.language}` });
  }
});

test('구글 폰트 import URL은 컨텍스트 경로 변환 예외로 기존 주소를 유지한다', async ({ page }) => {
  const fontImport = await page.evaluate(() => {
    window.PuyoW.destroy();
    window.PuyoW.setURLContextPath('/tomcat-puyow/');
    document.querySelector('style.puyow_font_import')?.remove();
    window.PuyoW.initialize('puyow_target');
    return document.querySelector('style.puyow_font_import')?.textContent;
  });

  expect(fontImport).toContain("@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans");
  expect(fontImport).not.toContain('/tomcat-puyow/');
  expect(fontImport).not.toContain('[LANG]');
});

test('게임 규칙 선택지의 기본 룰·연습 색상과 연속 피버 아래 취소를 키보드·마우스로 조작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector('[data-puyow-canvas="2d"]');
    const context = canvas.getContext('2d');
    const standard = context.getImageData(360, 285, 1, 1).data;
    const practice = context.getImageData(360, 387, 1, 1).data;
    return standard[1] < practice[1] && standard[0] < practice[0]
      && window.testCanvasTexts.some((text) => ['취소', 'Cancel', 'キャンセル', '取消'].includes(text));
  })).toBe(true);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 513 } });
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
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 474 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
});

test('퍼즐뿌요는 스테이지 선택, 잠금 해제, 5색 지급과 두 번 클릭 선택을 지원한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');

  const initiallyOpenedStages = await page.evaluate(() => window.WebPuyo.PUZZLE_STAGES.map((stage) => stage.opened));
  expect(initiallyOpenedStages).toEqual([true, true, ...Array(initiallyOpenedStages.length - 2).fill(false)]);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 334, y: 550 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 334, y: 550 } });
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

  async function expectSoloScoreLayout() {
    await page.evaluate(() => { window.testCanvasTextCalls = []; });
    await expect.poll(() => page.evaluate(() => {
      const practiceNames = ['연습 상대', 'Practice Opponent', '練習相手', '练习对手'];
      const opponentScoreShown = window.testCanvasTextCalls.some(({ text, y }) => practiceNames.includes(text) && y === 516);
      const [red, , blue] = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(700, 492, 1, 1).data;
      return !opponentScoreShown && red > blue;
    }), { timeout: 5000 }).toBe(true);
  }

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expectSoloNextLayout();
  await expectSoloScoreLayout();

  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expectSoloNextLayout();
  await expectSoloScoreLayout();

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
    const [red, green, blue] = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(952, 114, 1, 1).data;
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
    const pixels = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(420, 220, 440, 55).data;
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index] > 180 && pixels[index + 1] > 120 && pixels[index + 2] < 130) return true;
    return false;
  })).toBe(false);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 130, y: 550 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
});

test('퍼즐뿌요 스테이지 선택은 여섯 번째 스테이지에서 키보드와 화살표 클릭으로 수평 스크롤한다', async ({ page }) => {
  await page.evaluate(() => {
    const store = JSON.parse(window.localStorage.getItem('puyow_store') || '{"clearList":[]}');
    store.puzzleClearStages = [3];
    window.localStorage.setItem('puyow_store', JSON.stringify(store));
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');

  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.puzzle?.stageIndex), { timeout: 5000 }).toBe(5);

  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 1150, y: 640 } });
  await canvas.click({ position: { x: 1150, y: 550 } });
  await canvas.click({ position: { x: 1150, y: 550 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.puzzle?.stageIndex), { timeout: 5000 }).toBe(5);
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
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('puyow_store')).puzzleStarStages)).toContain(0);
  expect(await page.evaluate(() => {
    const stored = JSON.parse(window.localStorage.getItem('puyow_store'));
    return { gold: stored.gold, clearRewards: stored.puzzleGoldClearStages, starRewards: stored.puzzleGoldStarStages };
  })).toEqual({ gold: 2000, clearRewards: [0], starRewards: [0] });
  await page.evaluate(() => { window.testCanvasTextCalls = []; });
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.some(({ text }) => ['현재 턴 1 / 2', 'Turn 1 / 2', 'ターン 1 / 2', '第 1 / 2 回合'].includes(text)))).toBe(true);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().puzzle.starEarned)).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTextCalls.some(({ text, x }) => {
    const finalScorePrefixes = ['최종 점수', 'Final score', '最終スコア', '最终得分'];
    const puzzleLabels = ['퍼즐뿌요', 'Puzzle Puyo', 'パズルぷよ', '益智魔法气泡'];
    return x >= 850 && (finalScorePrefixes.some((prefix) => text.startsWith(prefix)) || puzzleLabels.includes(text));
  }))).toBe(false);
  await expect.poll(() => page.evaluate(() => {
    const pixels = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(950, 370, 56, 60).data;
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index] > 190 && pixels[index + 1] > 130 && pixels[index + 2] < 130) return true;
    return false;
  })).toBe(true);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 197 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
  await expect.poll(() => page.evaluate(() => {
    const openedStages = window.WebPuyo.PUZZLE_STAGES.map((stage) => stage.opened);
    return openedStages.slice(0, 3).every(Boolean) && openedStages.slice(3).every((opened) => !opened);
  })).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.puzzle?.stageIndex)).toBe(1);
});

test('퍼즐뿌요 color 조건은 동시 폭발한 일반뿌요 색 수를 스테이지와 게임 화면에 표시하고 클리어한다', async ({ page }) => {
  await page.evaluate(() => {
    const stage = window.WebPuyo.PUZZLE_STAGES[0];
    stage.stageData = {
      puyos: [
        ...Array.from({ length: 4 }, (_, x) => ({ x, y: 0, color: 'red' })),
        ...Array.from({ length: 4 }, (_, x) => ({ x, y: 1, color: 'blue' })),
        { x: 4, y: 0, color: 'garbage' }
      ]
    };
    stage.suppliedNextPuyos = [['green', 'yellow']];
    stage.winConditionType = 'color';
    stage.winConditionValue = 2;
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['한 번에 2가지 색 뿌요를 터뜨려봐', 'Pop 2 colors at once!', '一度に2色のぷよを消そう！', '一次消除 2 种颜色的魔法气泡！'].includes(text)))).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 5000 }).toBe(true);
  expect(['한 번에 2가지 색 뿌요를 터뜨려봐', 'Pop 2 colors at once!', '一度に2色のぷよを消そう！', '一次消除 2 种颜色的魔法气泡！'])
    .toContain(await page.evaluate(() => window.WebPuyo.getGameState()?.puzzle?.condition));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 6000 }).toBe('game_over');
  expect(await page.evaluate(() => window.WebPuyo.getGameState()?.winner)).toBe('player');
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('puyow_store')).puzzleClearStages)).toContain(0);
});

test('퍼즐뿌요 color 조건은 동시에 제거된 방해뿌요를 색 수에 포함하지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    const stage = window.WebPuyo.PUZZLE_STAGES[0];
    stage.stageData = {
      puyos: [
        ...Array.from({ length: 4 }, (_, x) => ({ x, y: 0, color: 'red' })),
        ...Array.from({ length: 4 }, (_, x) => ({ x, y: 1, color: 'blue' })),
        { x: 4, y: 0, color: 'garbage' }
      ]
    };
    stage.suppliedNextPuyos = [['green', 'yellow']];
    stage.winConditionType = 'color';
    stage.winConditionValue = 3;
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 5000 }).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 6000 }).toBe(true);
  expect(await page.evaluate(() => window.WebPuyo.getGameState()?.winner)).toBeNull();
  expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('playing');
});

test('퍼즐뿌요 스테이지 카드의 9글자 초과 클리어 조건은 말줄임표로 표시한다', async ({ page }) => {
  await page.evaluate(() => {
    const stage = window.WebPuyo.PUZZLE_STAGES[0];
    stage.winConditionType = 'color';
    stage.winConditionValue = 3;
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '한 번에 3가지...', 'Pop 3 col...', '一度に3色のぷよを...', '一次消除 3 种颜...'
  ].includes(text)))).toBe(true);
});

test('준비된 퍼즐뿌요 스테이지의 모든 힌트는 지원 언어로 번역된다', async ({ page }) => {
  const expectedHints = {
    'ko-KR': ['두 번째에 터뜨려', '한 번만 회전해', '마지막 폭발은 초록색으로', '마지막 파란색 폭발 후를 생각해', '3, 4연쇄째에 보충이 필요해', '방해뿌요는 터뜨려야 제맛', '어디부터 터뜨려야 잘 터뜨렸다고 소문이 날까? 오른쪽?', '저 위의 빨간 색은 왜 있을까?', '최초 폭발은 빨간색', '최초 폭발은 초록색', '최초 폭발은 노란색', '초록 색 4개를 오른쪽 3줄 어딘가에 두어야 해', '그냥 내려 봐'],
    'en-US': ['Pop on the second turn.', 'Rotate only once.', 'Make the last pop green.', 'Think about what comes after the final blue pop.', 'You need a refill on the 3rd or 4th chain.', 'Pop the garbage puyos too.', 'Where should you pop first? The right side?', 'Why is there red up there?', 'Make the first pop red.', 'Make the first pop green.', 'Make the first pop yellow.', 'Place four green puyos somewhere in the right three columns.', 'Just drop it.'],
    'ja-JP': ['2回目で消そう。', '一度だけ回転しよう。', '最後は緑で消そう。', '最後の青ぷよ消去の後を考えよう。', '3・4連鎖目に補充が必要です。', 'おじゃまぷよも消そう。', 'どこから消そう？右側かな？', '上の赤いぷよはなぜあるのかな？', '最初は赤で消そう。', '最初は緑で消そう。', '最初は黄で消そう。', '右3列のどこかに緑ぷよ4個を置こう。', 'そのまま落としてみよう。'],
    'zh-CN': ['在第二次消除。', '只旋转一次。', '最后用绿色消除。', '想想最后一次蓝色魔法气泡消除之后。', '第3或第4连锁需要补充。', '也消除垃圾噗哟吧。', '从哪里开始消除？右边？', '上面的红噗哟为什么会在那里？', '首次消除红色。', '首次消除绿色。', '首次消除黄色。', '需要把4个绿色魔法气泡放在右侧三列的某处。', '直接落下试试。'],
    'de-DE': ['Lass sie beim zweiten Zug platzen.', 'Drehe nur einmal.', 'Die letzte Explosion muss grün sein.', 'Denke an das Ende nach der letzten blauen Explosion.', 'Bei der 3. oder 4. Kette ist Nachschub nötig.', 'Lass auch die Müll-Puyos platzen.', 'Wo solltest du anfangen? Rechts?', 'Warum ist dort oben ein roter Puyo?', 'Die erste Explosion ist rot.', 'Die erste Explosion ist grün.', 'Die erste Explosion ist gelb.', 'Platziere vier grüne Puyos irgendwo in den drei rechten Spalten.', 'Lass sie einfach fallen.'],
    'fr-FR': ['Fais-les éclater au deuxième tour.', 'Ne tourne qu’une fois.', 'Fais éclater le dernier en vert.', 'Pense à ce qui suit la dernière explosion bleue.', 'Un ravitaillement est nécessaire à la 3e ou 4e chaîne.', 'Fais aussi éclater les Puyos-ordures.', 'Par où commencer ? À droite ?', 'Pourquoi ce Puyo rouge est-il là-haut ?', 'La première explosion est rouge.', 'La première explosion est verte.', 'La première explosion est jaune.', 'Place quatre Puyos verts quelque part dans les trois colonnes de droite.', 'Laisse-les simplement tomber.']
  };
  for (const [language, expected] of Object.entries(expectedHints)) {
    await page.addInitScript((locale) => {
      Object.defineProperty(navigator, 'language', { configurable: true, value: locale });
    }, language);
    await page.reload();
    expect(await page.evaluate(() => window.WebPuyo.PUZZLE_STAGES.map((stage) => window.WebPuyo.translate(stage.hint)))).toEqual(expected);
  }
});

test('플레이 방법 4단계의 싹쓸이 안내 문구는 모든 기본 언어로 번역된다', async ({ page }) => {
  const message = '게임 중 싹쓸이를 하면 그 다음 번 공격이 대폭 강해져.';
  const expected = {
    'ko-KR': message,
    'en-US': 'An all clear makes your next attack much stronger.',
    'ja-JP': '全消しをすると、次の攻撃が大幅に強化されます。',
    'zh-CN': '全消后，下一次攻击会大幅增强。',
    'de-DE': 'Ein All Clear verstärkt deinen nächsten Angriff deutlich.',
    'fr-FR': 'Un Tout Effacé renforce considérablement ta prochaine attaque.'
  };
  for (const [locale, translation] of Object.entries(expected)) {
    await page.addInitScript((language) => {
      Object.defineProperty(navigator, 'language', { configurable: true, value: language });
    }, locale);
    await page.reload();
    expect(await page.evaluate((key) => window.WebPuyo.translate(key), message)).toBe(translation);
  }
});

test('퍼즐뿌요 스테이지 선택 카드는 저장된 클리어와 별 달성 표식을 표시한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      puzzleClearStages: [0, 1],
      puzzleStarStages: [1],
    }));
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const context = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d');
    const hasGoldMarker = (x, y, width, height) => {
      const pixels = context.getImageData(x, y, width, height).data;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] > 180 && pixels[index + 1] > 100 && pixels[index + 2] < 100) return true;
      }
      return false;
    };
    return hasGoldMarker(304, 525, 60, 60) && hasGoldMarker(504, 515, 68, 70);
  })).toBe(true);
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

test('컨트롤 전부터 누른 오른쪽 키를 뿌요 지급 직후 반영한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await page.evaluate(() => {
    window.firstControlX = null;
    const captureFirstControlFrame = () => {
      const state = window.WebPuyo.getGameState();
      if (state?.playerCanControl) window.firstControlX = state.player.active.x;
      else window.requestAnimationFrame(captureFirstControlFrame);
    };
    window.requestAnimationFrame(captureFirstControlFrame);
  });

  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.firstControlX), { timeout: 5000 }).toBe(3);

  await page.keyboard.up('ArrowRight');
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

test('폭발 점수 보너스는 최소 1이며 시간 진행 배율은 300초 뒤 20초마다 두 배가 된다', async ({ page }) => {
  const result = await page.evaluate(() => {
    const groups = [{ color: 'red', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] }];
    const elapsedTimes = [0, 300000, 319999, 320000, 340000, 500000, 900000];
    return {
      point: window.WebPuyo.calculateExplosionPoint(groups, 1),
      direct: elapsedTimes.map((elapsed) => window.WebPuyo.getTimeProgressMultiplier(elapsed)),
      common: elapsedTimes.map((elapsed) => window.WebPuyo.common.getTimeProgressMultiplier(elapsed)),
      attackAtStart: window.WebPuyo.calculateExplosionAttack(70, 70, 1),
      attackAtMaximum: window.WebPuyo.calculateExplosionAttack(70, 70, 1024),
    };
  });
  expect(result.point).toBe(40);
  expect(result.direct).toEqual([1, 1, 1, 2, 4, 1024, 1024]);
  expect(result.common).toEqual(result.direct);
  expect(result.attackAtStart).toBe(1);
  expect(result.attackAtMaximum).toBe(1024);

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().timeProgressMultiplier)).toBe(1);
});

test('다색 동시 폭발 연결 보너스는 가장 많이 터진 한 색만 사용한다', async ({ page }) => {
  const points = await page.evaluate(() => {
    const cells = (count) => Array.from({ length: count }, (_, index) => [index, 0]);
    return {
      singleColor: window.WebPuyo.calculateExplosionPoint([
        { color: 'red', cells: cells(4) }, { color: 'red', cells: cells(5) },
      ], 1),
      threeColors: window.WebPuyo.calculateExplosionPoint([
        { color: 'red', cells: cells(4) }, { color: 'blue', cells: cells(5) }, { color: 'yellow', cells: cells(4) },
      ], 1),
    };
  });
  expect(points.singleColor).toBe(540);
  expect(points.threeColors).toBe(1040);
});

test('공통 사운드 풀은 시뮬레이터의 뿌요 착지·폭발·주문 효과음을 재생한다', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.puyoFall = 'sounds/test-puyo-fall.ogg';
    window.WebPuyo.commonSoundPool.puyoBurstCombo1 = 'sounds/test-puyo-burst.ogg';
    window.WebPuyo.commonSoundPool.spellCombo1 = 'sounds/test-player-spell.ogg';
  });
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  await page.evaluate(() => {
    window.prompt = () => JSON.stringify({ puyos: [
      { x: 0, y: 0, color: 'red' }, { x: 0, y: 1, color: 'red' }, { x: 0, y: 2, color: 'red' }, { x: 0, y: 12, color: 'red' },
    ] });
  });
  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(expect.arrayContaining([
    'sounds/test-puyo-fall.ogg', 'sounds/test-puyo-burst.ogg', 'sounds/test-player-spell.ogg',
  ]));
  expect(await page.evaluate(() => window.testAudioInstances.filter((audio) => audio.src === 'sounds/test-puyo-fall.ogg'))).toHaveLength(1);
});

test('common sound pool plays menu and game-start sounds', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.selects = 'sounds/test-menu-select.ogg';
    window.WebPuyo.commonSoundPool.cancels = 'sounds/test-menu-cancel.ogg';
    window.WebPuyo.commonSoundPool.focusMoves = 'sounds/test-menu-focus.ogg';
    window.WebPuyo.commonSoundPool.gameStarts = 'sounds/test-game-start.ogg';
    window.WebPuyo.commonSoundPool.puyoRotate = 'sounds/test-puyo-rotate.ogg';
  });
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual([
    'sounds/test-menu-select.ogg',
    'sounds/test-menu-focus.ogg',
    'sounds/test-menu-focus.ogg',
    'sounds/test-menu-select.ogg',
    'sounds/test-menu-cancel.ogg',
  ]);

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(expect.arrayContaining([
    'sounds/test-game-start.ogg',
  ]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);
  const initialRotation = await page.evaluate(() => window.WebPuyo.getGameState().player.active.rotation);
  // 한글 입력기처럼 event.key가 달라도 물리 KeyX/KeyZ는 회전해야 한다.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ㅌ', code: 'KeyX', bubbles: true, cancelable: true,
  })));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.player.active?.rotation)).toBe((initialRotation + 1) % 4);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ㅋ', code: 'KeyZ', bubbles: true, cancelable: true,
  })));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.player.active?.rotation)).toBe(initialRotation);
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(expect.arrayContaining([
    'sounds/test-puyo-rotate.ogg',
  ]));
});

test('시뮬레이터 연쇄는 새 점수 계산식과 같은 연쇄 문구를 표시한다', async ({ page }) => {
  await enterMainMenu(page);
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
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  for (const x of [207, 245, 283, 321]) await canvas.click({ position: { x, y: 539 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('simulator_complete');
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

  const canvas = page.locator('[data-puyow-canvas="2d"]');
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
  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 960, y: 440 } });
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('simulator_complete');
  expect(await page.evaluate(() => window.WebPuyo.getSimulatorState()?.board.puyos.some((puyo) => puyo.color === 'red'))).toBe(false);
});

test('시뮬레이터 점수는 동시 폭발의 색수와 가장 많은 색의 연결 보너스를 합산한다', async ({ page }) => {
  await enterMainMenu(page);
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

test('세로 화면에서는 캔버스를 회전하고 클릭 좌표를 변환한다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('puyow-portrait'))).toBe(true);

  const bounds = await page.locator('[data-puyow-canvas="2d"]').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  expect(bounds.width).toBeCloseTo(375, 1);
  expect(bounds.height).toBeCloseTo(bounds.width * 16 / 9, 1);
  expect(bounds.left).toBeCloseTo(0, 1);
  expect(bounds.top).toBeCloseTo(0, 1);

  await enterMainMenu(page);
  const logicalX = 640;
  const logicalY = 580;
  await page.mouse.click(
    bounds.left + bounds.width * (1 - logicalY / 720),
    bounds.top + bounds.height * logicalX / 1280
  );
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');

  const clickLogicalSettingsPoint = async (x, y) => page.mouse.click(
    bounds.left + bounds.width * (1 - y / 720),
    bounds.top + bounds.height * x / 1280
  );
  await clickLogicalSettingsPoint(740, 346);
  await clickLogicalSettingsPoint(700, 390);
  await page.keyboard.type('http://portrait-lm.local/');
  await page.keyboard.press('Enter');
  await clickLogicalSettingsPoint(480, 671);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings)).toMatchObject({
    aiProvider: 'LM Studio', aiApiURL: 'http://portrait-lm.local/',
  });
});

test('화면 가로방향 고정은 저장되며 세로 화면 입력도 회전하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openSettings(page);
  for (let index = 0; index < 9; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.landscapeOrientationLocked)).toBe(true);
  expect(await page.evaluate(() => document.body.classList.contains('puyow-portrait'))).toBe(false);

  const bounds = await page.locator('[data-puyow-canvas="2d"]').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  expect(bounds.width).toBeCloseTo(375, 1);
  expect(bounds.height).toBeCloseTo(375 * 9 / 16, 1);
  expect(bounds.left).toBeCloseTo(0, 1);
  expect(bounds.top).toBeCloseTo(0, 1);

  await page.mouse.click(bounds.left + bounds.width / 2, bounds.top + bounds.height * 580 / 720);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');
});

test('변경된 사운드 데이터 URL을 저장하면 즉시 사운드 데이터를 다시 불러온다', async ({ page }) => {
  let requestedUrl = null;
  await page.route('https://sound.example/**', async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });

  await openSettings(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 302 } });
  await page.keyboard.type('https://sound.example/sounds_[LANG].json');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });

  await expect.poll(() => requestedUrl).toBe('https://sound.example/sounds_en.json');
});

test('화면 가로방향 고정 문구는 지원 언어별로 번역된다', async ({ page }) => {
  const translations = [
    ['en-US', 'Lock landscape orientation'],
    ['ja-JP', '画面を横向きに固定'],
    ['zh-CN', '锁定横屏'],
  ];

  for (const [language, translation] of translations) {
    await page.addInitScript((locale) => {
      Object.defineProperty(navigator, 'language', { configurable: true, value: locale });
    }, language);
    await page.reload();
    await openSettings(page);
    await expect.poll(() => page.evaluate((text) => window.testCanvasTexts.includes(text), translation)).toBe(true);
  }
});

test('기본 룰과 피버 룰의 적 초상화 화살표는 선택 가능한 이전·다음 적만 이동한다', async ({ page }) => {
  await page.evaluate(() => {
    const cleared = ['Andromalius'];
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      clearListByDifficulty: { easy: cleared, normal: cleared, hard: cleared, extreme: cleared },
      feverClearListByDifficulty: { easy: cleared, normal: cleared, hard: cleared, extreme: cleared },
    }));
  });
  await page.reload();

  const arrowColorAt = (x, y, color) => page.evaluate(({ x: pixelX, y: pixelY, expected }) => {
    const pixel = Array.from(document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(pixelX, pixelY, 1, 1).data);
    return pixel[0] === expected[0] && pixel[1] === expected[1] && pixel[2] === expected[2];
  }, { x, y, expected: color });
  const openOpponentMenu = async (feverRule) => {
    if (await page.evaluate(() => window.WebPuyo.getScreenState().screen) !== 'main_menu') await enterMainMenu(page);
    await page.keyboard.press('Enter');
    if (feverRule) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe(feverRule ? 'fever_opponent_select' : 'opponent_select');
  };

  for (const feverRule of [false, true]) {
    await openOpponentMenu(feverRule);
    await expect.poll(() => arrowColorAt(805, 383, [107, 188, 232])).toBe(true);
    expect(await arrowColorAt(475, 383, [107, 188, 232])).toBe(false);

    await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 805, y: 383 } });
    await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.some(({ text, x, y }) => text === 'Dantalion' && x === 640 && y === 450))).toBe(true);
    await expect.poll(() => arrowColorAt(475, 383, [247, 200, 67])).toBe(true);
    expect(await arrowColorAt(805, 383, [247, 200, 67])).toBe(false);

    await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 475, y: 383 } });
    await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.some(({ text, x, y }) => text === 'Andromalius' && x === 640 && y === 450))).toBe(true);
    if (!feverRule) {
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
    }
  }
});

test('구경 메뉴는 데카라비아를 보통 이상에서 이기기 전에는 잠기고 키보드·클릭으로 건너뛴다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      clearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 468 } });
  expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.reload();
  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('gallery');

  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: ['Decarabia'],
      clearListByDifficulty: { easy: ['Decarabia'], normal: [], hard: [], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
    }));
  });
  await page.reload();
  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('gallery');

  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      clearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: ['Decarabia'], hard: [], extreme: [] },
    }));
  });
  await page.reload();
  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
});

test('구경 설정은 키보드와 마우스로 색상 수·규칙·취소를 고르고 두 CPU의 대전을 시작한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: ['Decarabia'],
      clearListByDifficulty: { easy: [], normal: ['Andromalius', 'Dantalion', 'Decarabia', 'Belial'], hard: [], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
  await expect.poll(() => page.evaluate(() => ['구경', 'Watch', '観戦', '观战', 'Zuschauen', 'Regarder'].some((text) => window.testCanvasTexts.includes(text)))).toBe(true);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');

  const initialState = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(initialState).toMatchObject({ watch: true, feverRule: true, colorCount: 5, playerCanControl: false });
  expect(initialState.player.fever.gauge).toBe(3);
  expect(initialState.opponent.fever.gauge).toBe(3);
  expect(initialState.aiDifficulty).toEqual({ key: 'extreme', name: '극한', fastDownDelay: 100 });
  expect(initialState.player.isCpu).toBe(true);
  expect(initialState.opponent.isCpu).toBe(true);
  expect(initialState.player.name).not.toBe(initialState.opponent.name);
  expect(['데카라비아', '벨리알']).toContain(initialState.player.name);
  expect(['데카라비아', '벨리알']).toContain(initialState.opponent.name);

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('playing');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('z');
  await page.keyboard.press('Enter');
  expect((await page.evaluate(() => window.WebPuyo.getGameState())).paused).toBe(false);
  const placedPairCountBeforePause = await page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state.player.placedPairCount + state.opponent.placedPairCount;
  });

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  expect(await page.evaluate(() => window.WebPuyo.getGameState())).toMatchObject({ watch: true, paused: true });
  await expect.poll(() => page.evaluate(() => ['일시정지', 'Paused', '一時停止', '暂停', 'Pausiert', 'Pause'].some((text) => window.testCanvasTexts.includes(text)))).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getGameState())).toMatchObject({ watch: true, paused: false });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('playing');
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state.player.placedPairCount + state.opponent.placedPairCount;
  }), { timeout: 15000 }).toBeGreaterThan(placedPairCountBeforePause);
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state.player.placedPairCount > 0 && state.opponent.placedPairCount > 0;
  }), { timeout: 15000 }).toBe(true);
  expect((await page.evaluate(() => window.WebPuyo.getScreenState())).playerCanControl).toBe(false);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => window.WebPuyo.getSelectedDifficulty())).toEqual({ key: 'normal', name: '보통', fastDownDelay: 1500 });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 468 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 520, y: 294 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 760, y: 420 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 750, y: 540 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 468 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 530, y: 540 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('playing');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 735, y: 408 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('구경 중앙 영역은 양쪽 적의 초상화와 현재 표정을 함께 그린다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: ['Decarabia'],
      clearListByDifficulty: { easy: [], normal: ['Decarabia', 'WatchPortraitLeft', 'WatchPortraitRight'], hard: [], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.evaluate(() => {
    window.watchPortraitCalls = [];
    class WatchPortraitLeft extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -300; }
      getClassType() { return 'WatchPortraitLeft'; }
      getName() { return '구경 좌측 초상화 적'; }
      prepareTurn(player) {
        super.prepareTurn(player);
        for (let y = 0; y < 6; y += 1) {
          for (let x = 0; x < 6; x += 1) player.board[y][x] = 'red';
        }
      }
      useFastDown() { return false; }
      drawPortrait(context, x, y, scale, expression) {
        window.watchPortraitCalls.push({ type: this.getClassType(), x, y, scale, expression });
      }
    }
    class WatchPortraitRight extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -299; }
      getClassType() { return 'WatchPortraitRight'; }
      getName() { return '구경 우측 초상화 적'; }
      prepareTurn(player) { super.prepareTurn(player); }
      useFastDown() { return false; }
      drawPortrait(context, x, y, scale, expression) {
        window.watchPortraitCalls.push({ type: this.getClassType(), x, y, scale, expression });
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new WatchPortraitLeft() });
    window.WebPuyo.registerOpponent({ createController: () => new WatchPortraitRight() });
    Math.random = () => 0;
  });

  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 10000 }).toBe('playing');
  await expect.poll(() => page.evaluate(() => window.watchPortraitCalls.some((call) => (
    call.type === 'WatchPortraitLeft' && call.x === 545 && call.y === 380 && call.expression === 'crisis'
  ))), { timeout: 5000 }).toBe(true);
  expect(await page.evaluate(() => window.watchPortraitCalls.some((call) => (
    call.type === 'WatchPortraitRight' && call.x === 735 && call.y === 380 && call.expression === 'normal'
  )))).toBe(true);
});

test('구경 결과 화면을 5초 동안 조작하지 않으면 새 적 두 명의 대전을 자동 시작한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: ['Decarabia'],
      clearListByDifficulty: { easy: [], normal: [], hard: ['Decarabia', 'WatchAutoLoser', 'WatchAutoWinner'], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
    }));
    localStorage.setItem('puyow_gallery', JSON.stringify({ warning: ['tiny'], enemies: ['Andromalius'] }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.evaluate(() => {
    window.watchTestControllerCount = 0;
    class WatchAutoLoser extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -299; window.watchTestControllerCount += 1; }
      getClassType() { return 'WatchAutoLoser'; }
      getName() { return '구경 자동 패배 적'; }
      prepareTurn(player) {
        super.prepareTurn(player);
        for (let y = 0; y < 12; y += 1) player.board[y][2] = 'garbage';
      }
      chooseTarget() { return 0; }
      useFastDown() { return true; }
    }
    class WatchAutoWinner extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -300; window.watchTestControllerCount += 1; }
      getClassType() { return 'WatchAutoWinner'; }
      getName() { return '구경 자동 승리 적'; }
      chooseTarget() { return 5; }
      useFastDown() { return true; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new WatchAutoLoser() });
    window.WebPuyo.registerOpponent({ createController: () => new WatchAutoWinner() });
    Math.random = () => 0;
  });

  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 12000 }).toBe('game_over');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).clearList)).toEqual(['Decarabia']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_gallery')))).toEqual({ warning: ['tiny'], enemies: ['Andromalius'] });
  const controllerCountAtResult = await page.evaluate(() => window.watchTestControllerCount);
  await expect.poll(() => page.evaluate(() => window.watchTestControllerCount), { timeout: 8000 }).toBeGreaterThan(controllerCountAtResult);
  expect((await page.evaluate(() => window.WebPuyo.getGameState())).watch).toBe(true);
});

test('구경 모드 좌측 적은 고유 주문 효과음이 없으면 플레이어 공통 주문 효과음을 사용한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: ['Decarabia'],
      clearListByDifficulty: { easy: [], normal: [], hard: ['Decarabia', 'WatchSpellLeft', 'WatchSpellRight'], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.evaluate(() => {
    class WatchSpellLeft extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -300; }
      getClassType() { return 'WatchSpellLeft'; }
      getName() { return '구경 좌측 주문 적'; }
      prepareTurn(player) {
        if (player.placedPairCount === 0) {
          for (let x = 0; x < 3; x += 1) player.board[0][x] = 'red';
          player.active.colors = ['red', 'blue'];
        }
        super.prepareTurn(player);
      }
      chooseTarget() { return 3; }
      chooseRotate() { return 1; }
      useFastDown() { return true; }
    }
    class WatchSpellRight extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -299; }
      getClassType() { return 'WatchSpellRight'; }
      getName() { return '구경 우측 주문 적'; }
      useFastDown() { return true; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new WatchSpellLeft() });
    window.WebPuyo.registerOpponent({ createController: () => new WatchSpellRight() });
    const leftPool = window.WebPuyo.createSoundPool(false);
    window.WebPuyo.setEnemySoundPool('WatchSpellLeft', leftPool);
    window.WebPuyo.commonSoundPool.spellCombo1 = 'sounds/watch-left-player-spell.ogg';
    window.WebPuyo.commonSoundPool.commonEnemySpellCombo1 = 'sounds/watch-enemy-spell.ogg';
    Math.random = () => 0;
  });

  await enterMainMenu(page);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.some((audio) => audio.src === 'sounds/watch-left-player-spell.ogg')), { timeout: 10000 }).toBe(true);
  expect(await page.evaluate(() => window.testAudioInstances.some((audio) => audio.src === 'sounds/watch-enemy-spell.ogg'))).toBe(false);
});
