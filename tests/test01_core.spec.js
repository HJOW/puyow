// 게임 페이지의 기본 계약 회귀 테스트다. 초기화와 리소스 로드, 공개 API, 보드·NEXT·DAMAGE 규칙,
// 저장 데이터 보정, 확인창, 다국어와 URL 치환처럼 특정 모드에 매이지 않는 항목을 다룬다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, expectDefeatCellMarkers } from './common/gamepage.js';

setupGamePage();

const THREE_SCRIPT = '**/js/three.min.js';

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

test('WebMCP 도구 스키마는 너랑 나랑·피버 룰 (시작)·리플레이까지 포함한 최신 게임 상태를 노출한다', async ({ page }) => {
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
      puzzleConditionTypes: tools.now_game_status.outputSchema.properties.puzzle.properties.winConditionType.enum,
      screenRequired: tools.now_screen.outputSchema.required,
      feverNextTimeMaximum: tools.now_game_status.outputSchema.properties.player.properties.fever.properties.nextTime.maximum,
      puzzleStageIndexMinimum: tools.now_game_status.outputSchema.properties.puzzle.properties.stageIndex.minimum,
      togetherRules: tools.now_game_status.outputSchema.properties.together.properties.rule.enum,
      warningDescription: tools.now_game_status.outputSchema.properties.player.properties.warningPuyos.description,
      manual: tools.manual.execute(),
      titleScreen: tools.now_screen.execute()
    };
  });
  expect(schema.screenEnum).toEqual(expect.arrayContaining(['puzzle_stage_select', 'watch_select', 'together_guide']));
  expect(schema.screenRequired).toEqual(['screen', 'playerCanControl', 'mode', 'rule', 'replayPlayback', 'modelLoading', 'confirmDialogOpen']);
  expect(schema.statusRequired).toEqual(expect.arrayContaining(['puzzle', 'watch', 'feverStart', 'mode', 'rule', 'elapsed', 'marginRate', 'timeProgressMultiplier', 'allClearTicketEnabled', 'replayPlayback', 'together']));
  expect(schema.playerRequired).toEqual(expect.arrayContaining(['point', 'attack', 'damage', 'normalDamage', 'combo', 'placedPairCount', 'allClearTicket']));
  expect(schema.feverTargetMinimum).toBe(4);
  // 피버 룰 (시작)은 nextTime 60초로 시작한다.
  expect(schema.feverNextTimeMaximum).toBe(60);
  // 개발용 도구는 등록되지 않은 퍼즐 스테이지를 -1로 실행한다.
  expect(schema.puzzleStageIndexMinimum).toBe(-1);
  expect(schema.togetherRules).toEqual(['standard', 'fever', 'feverStart']);
  expect(schema.warningDescription).toContain('big-bang 500000');
  expect(schema.activeYType).toBe('number');
  expect(schema.puzzleConditionTypes).toContain('color');
  expect(schema.manual).toContain('Together mode');
  expect(schema.titleScreen).toEqual({ screen: 'initial_title', playerCanControl: false, mode: null, rule: null, replayPlayback: false, modelLoading: false, confirmDialogOpen: false });

  // 실제 반환값의 키가 스키마의 required와 정확히 같아야 게임 상태 필드 추가가 도구에서 빠지지 않는다.
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('playing');
  const status = await page.evaluate(() => {
    const tools = Object.fromEntries(window.registeredWebMcpTools.map((tool) => [tool.name, tool]));
    const result = tools.now_game_status.execute();
    const outputSchema = tools.now_game_status.outputSchema;
    return {
      keys: Object.keys(result).sort(),
      required: [...outputSchema.required].sort(),
      propertyKeys: Object.keys(outputSchema.properties).sort(),
      playerKeys: Object.keys(result.player).sort(),
      playerRequired: [...outputSchema.properties.player.required].sort(),
      mode: result.mode,
      rule: result.rule,
      replayPlayback: result.replayPlayback,
      together: result.together,
      screen: tools.now_screen.execute()
    };
  });
  expect(status.keys).toEqual(status.required);
  expect(status.propertyKeys).toEqual(status.required);
  expect(status.playerKeys).toEqual(status.playerRequired);
  expect(status).toMatchObject({ mode: 'practice', rule: 'standard', replayPlayback: false, together: null });
  expect(status.screen).toMatchObject({ screen: 'playing', mode: 'practice', rule: 'standard', replayPlayback: false, modelLoading: false, confirmDialogOpen: false });
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
  }), { timeout: 15000 }).toEqual(expect.objectContaining({
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
  })), { timeout: 15000 }).toEqual({ queuedPairCount: 20, statePairCount: 2, apiPairCount: 2 });
});

test('게임 상태 조회는 양쪽 일반·피버 필드와 앞 두 NEXT를 분리해 반환한다', async ({ page }) => {
  expect(await page.evaluate(() => window.WebPuyo.getGameState())).toBeNull();

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState())).toMatchObject({
    mode: 'versus', rule: 'standard', allClearTicketEnabled: true,
    player: { fever: null, board: { columns: 6, rows: 25, visibleRows: 12 }, normalBoard: { columns: 6, rows: 25, visibleRows: 12 } },
    opponent: { fever: null, board: { columns: 6, rows: 25, visibleRows: 12 }, normalBoard: { columns: 6, rows: 25, visibleRows: 12 } },
  });
  expect(await page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return [state.player.nextPairs.length, state.opponent.nextPairs.length];
  })).toEqual([2, 2]);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState())).toMatchObject({
    mode: 'versus', rule: 'fever', allClearTicketEnabled: false,
    player: { fever: { active: false, leftTime: 0, field: { columns: 6, rows: 25, visibleRows: 12, puyos: [] } } },
    opponent: { fever: { active: false, leftTime: 0, field: { columns: 6, rows: 25, visibleRows: 12, puyos: [] } } },
  });
  expect(await page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return [state.player.nextPairs.length, state.opponent.nextPairs.length];
  })).toEqual([2, 2]);
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
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => ({
    queuedPairCount: window.watchNextPairQueueEnemy?.queuedPairCount,
    playerPairCount: window.WebPuyo.getGameState()?.player.nextPairs.length,
    opponentPairCount: window.WebPuyo.getGameState()?.opponent.nextPairs.length,
  })), { timeout: 15000 }).toEqual({ queuedPairCount: 20, playerPairCount: 2, opponentPairCount: 2 });
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
  }), { timeout: 15000 }).toEqual([16, 17, 18, 19, 20]);
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

test('빅뱅 예고뿌요와 ONNX 적 3종은 출시 상태·모델·테마 설정을 가진다', async ({ page }) => {
  const result = await page.evaluate(() => {
    const bigBang = new window.WebPuyo.BigBangWarningPuyo();
    const andras = new window.WebPuyo.Andras();
    const valak = new window.WebPuyo.Valak();
    const zagan = new window.WebPuyo.Zagan();
    const describeEnemy = (enemy) => ({
      classType: enemy.getClassType(), name: enemy.getName(), notAvail: enemy.notAvail,
      requiresOnnx: enemy.requiresOnnx, modelPath: enemy.modelPath, theme: enemy.getFieldThemeColors()
    });
    return {
      bigBang: { unitCount: bigBang.unitCount, type: bigBang.type, name: bigBang.getName() },
      warningTypes: window.WebPuyo.common.warningUnits(500000).map((unit) => unit.type),
      andras: describeEnemy(andras), valak: describeEnemy(valak), zagan: describeEnemy(zagan)
    };
  });

  expect(result.bigBang).toEqual({ unitCount: 500000, type: 'big-bang', name: '빅뱅' });
  expect(result.warningTypes).toEqual(['big-bang']);
  expect(result.andras).toEqual({
    classType: 'Andras', name: '안드라스', notAvail: false, requiresOnnx: true, modelPath: 'onnx/model02.onnx',
    theme: { bezel: '#1b2137', field: '#2d3857', center: '#0a0e1c' }
  });
  expect(result.valak).toEqual({
    classType: 'Valak', name: '발라크', notAvail: false, requiresOnnx: true, modelPath: 'onnx/model03.onnx',
    theme: { bezel: '#431c24', field: '#622936', center: '#210b12' }
  });
  expect(result.zagan).toEqual({
    classType: 'Zagan', name: '자간', notAvail: true, requiresOnnx: true, modelPath: 'onnx/model01.onnx',
    theme: { bezel: '#3d3220', field: '#594a2d', center: '#1c160c' }
  });
});

test('발라크와 자간은 세 가지 표정의 초상화를 캔버스에 그린다', async ({ page }) => {
  const painted = await page.evaluate(() => [window.WebPuyo.Valak, window.WebPuyo.Zagan].map((EnemyType) => {
    const enemy = new EnemyType();
    return ['normal', 'crisis', 'defeated'].map((expression) => {
      const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 220;
      const drawingContext = canvas.getContext('2d');
      enemy.drawPortrait(drawingContext, 110, 110, 1, expression);
      return Array.from(drawingContext.getImageData(0, 0, 220, 220).data).some((value, index) => index % 4 === 3 && value > 0);
    });
  }));
  expect(painted).toEqual([[true, true, true], [true, true, true]]);
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

test('준비된 퍼즐뿌요 스테이지의 모든 힌트는 지원 언어로 번역된다', async ({ page }) => {
  const expectedHints = {
    'ko-KR': ['두 번째에 터뜨려', '한 번만 회전해', '마지막 폭발은 초록색으로', '마지막 파란색 폭발 후를 생각해', '3, 4연쇄째에 보충이 필요해', '방해뿌요는 터뜨려야 제맛', '어디부터 터뜨려야 잘 터뜨렸다고 소문이 날까? 오른쪽?', '저 위의 빨간 색은 왜 있을까?', '최초 폭발은 빨간색', '최초 폭발은 초록색', '최초 폭발은 노란색', '초록 색 4개를 오른쪽 3줄 어딘가에 두어야 해', '초록색은 위에, 빨강색은 아래에', '처음 놓는 뿌요 2개는 2연쇄째에 터져야 해', '이 연쇄는 오른쪽에서 왼쪽으로', '왼쪽만 신경 써', '오른쪽만 신경 써', '최소 하나는 눞혀', '노란색으로 시작하나 빨간색에 주의해', '오른쪽만 신경 써', '그냥 내려 봐', '보라색은 무조건 위로'],
    'en-US': ['Pop on the second turn.', 'Rotate only once.', 'Make the last pop green.', 'Think about what comes after the final blue pop.', 'You need a refill on the 3rd or 4th chain.', 'Pop the garbage puyos too.', 'Where should you pop first? The right side?', 'Why is there red up there?', 'Make the first pop red.', 'Make the first pop green.', 'Make the first pop yellow.', 'Place four green puyos somewhere in the right three columns.', 'Green on top, red on bottom.', 'The first two puyos must pop in the second chain.', 'This chain goes from right to left.', 'Focus only on the left side.', 'Focus only on the right side.', 'Lay at least one pair horizontally.', 'Start with yellow, but watch out for red.', 'Focus only on the right side.', 'Just drop it.', 'Purple must always go on top.'],
    'ja-JP': ['2回目で消そう。', '一度だけ回転しよう。', '最後は緑で消そう。', '最後の青ぷよ消去の後を考えよう。', '3・4連鎖目に補充が必要です。', 'おじゃまぷよも消そう。', 'どこから消そう？右側かな？', '上の赤いぷよはなぜあるのかな？', '最初は赤で消そう。', '最初は緑で消そう。', '最初は黄で消そう。', '右3列のどこかに緑ぷよ4個を置こう。', '緑は上、赤は下。', '最初に置く2個のぷよは2連鎖目で消そう。', 'この連鎖は右から左へ。', '左側だけに集中しよう。', '右側だけに集中しよう。', '少なくとも1組は横に置こう。', '黄色で始めるけど、赤に注意しよう。', '右側だけに集中しよう。', 'そのまま落としてみよう。', '紫は必ず上に。'],
    'zh-CN': ['在第二次消除。', '只旋转一次。', '最后用绿色消除。', '想想最后一次蓝色魔法气泡消除之后。', '第3或第4连锁需要补充。', '也消除垃圾噗哟吧。', '从哪里开始消除？右边？', '上面的红噗哟为什么会在那里？', '首次消除红色。', '首次消除绿色。', '首次消除黄色。', '需要把4个绿色魔法气泡放在右侧三列的某处。', '绿色在上，红色在下。', '最先放置的两个噗哟必须在第二连锁中消除。', '这次连锁要从右向左。', '只关注左边。', '只关注右边。', '至少有一组要横着放。', '从黄色开始，但要注意红色。', '只关注右边。', '直接落下试试。', '紫色一定要放在上面。'],
    'de-DE': ['Lass sie beim zweiten Zug platzen.', 'Drehe nur einmal.', 'Die letzte Explosion muss grün sein.', 'Denke an das Ende nach der letzten blauen Explosion.', 'Bei der 3. oder 4. Kette ist Nachschub nötig.', 'Lass auch die Müll-Puyos platzen.', 'Wo solltest du anfangen? Rechts?', 'Warum ist dort oben ein roter Puyo?', 'Die erste Explosion ist rot.', 'Die erste Explosion ist grün.', 'Die erste Explosion ist gelb.', 'Platziere vier grüne Puyos irgendwo in den drei rechten Spalten.', 'Grün nach oben, Rot nach unten.', 'Die ersten beiden Puyos müssen in der zweiten Kette platzen.', 'Diese Kette geht von rechts nach links.', 'Konzentriere dich nur auf die linke Seite.', 'Konzentriere dich nur auf die rechte Seite.', 'Lege mindestens ein Paar waagerecht.', 'Beginne mit Gelb, aber achte auf Rot.', 'Konzentriere dich nur auf die rechte Seite.', 'Lass sie einfach fallen.', 'Lila muss immer nach oben.'],
    'fr-FR': ['Fais-les éclater au deuxième tour.', 'Ne tourne qu’une fois.', 'Fais éclater le dernier en vert.', 'Pense à ce qui suit la dernière explosion bleue.', 'Un ravitaillement est nécessaire à la 3e ou 4e chaîne.', 'Fais aussi éclater les Puyos-ordures.', 'Par où commencer ? À droite ?', 'Pourquoi ce Puyo rouge est-il là-haut ?', 'La première explosion est rouge.', 'La première explosion est verte.', 'La première explosion est jaune.', 'Place quatre Puyos verts quelque part dans les trois colonnes de droite.', 'Vert en haut, rouge en bas.', 'Les deux premiers Puyos doivent éclater dans la deuxième chaîne.', 'Cette chaîne va de droite à gauche.', 'Concentre-toi uniquement sur la gauche.', 'Concentre-toi uniquement sur la droite.', 'Pose au moins une paire à l’horizontale.', 'Commence par le jaune, mais attention au rouge.', 'Concentre-toi uniquement sur la droite.', 'Laisse-les simplement tomber.', 'Le violet doit toujours aller en haut.']
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
