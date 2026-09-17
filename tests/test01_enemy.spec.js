// 적 AI와 적 선택·진행도의 회귀 테스트다. 기본 제공 적의 판단 로직, 다수 탐색 Worker,
// 패배 위치 회피, 적 테마, 진행도 저장과 구경 모드를 다룬다.
// ONNX 추론으로 판단하는 적은 test03_ai.spec.js에 있다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, releaseNetworkInterception } from './common/gamepage.js';

setupGamePage();

/*
 * 3수 이상 Worker 탐색에 주는 처리 시간(ms)이다.
 * 이 시간 안에 결과가 오지 않으면 게임은 1수 탐색 결과로 대체하므로, 예산이 모자라면
 * Worker가 멀쩡히 돌아도 테스트가 실패한다. WebKit은 테스트 계측(캔버스 문구 수집 등)이 함께
 * 돌 때 1초로는 3수까지 못 마쳐서, 실제 게임 기본값보다 넉넉하게 잡았다.
 */
const WORKER_SEARCH_TIME_LIMIT = 15000;

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

test('안드레알푸스는 기본·피버 룰에 출시되고 플라우로스는 잠긴 상태로 표시된다', async ({ page }) => {
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
  // 잠긴 적은 카드에 이름 대신 '잠김'만 표시한다. 플라우로스는 안드레알푸스를 이기기 전까지 이 상태다.
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['잠김', 'Locked', 'ロック中', '已锁定'].includes(text)))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => ['플라우로스', 'Flauros', 'フラウロス', '弗劳洛斯'].includes(text)))).toBe(false);
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
  // 잠긴 적은 카드에 이름 대신 '잠김'만 표시한다. 플라우로스는 안드레알푸스를 이기기 전까지 이 상태다.
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['잠김', 'Locked', 'ロック中', '已锁定'].includes(text)))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => ['플라우로스', 'Flauros', 'フラウロス', '弗劳洛斯'].includes(text)))).toBe(false);
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 15000 }).toBe('player');
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 15000 }).toBe('player');
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
  }), { timeout: 15000 }).toEqual({ target: 0, rotation: 0, combo: 1, simulationCount: 22 });
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
  }), { timeout: 15000 }).toEqual({ target: 5, rotation: 2, targetCalled: true, rotationCalled: true });
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
  }), { timeout: 15000 }).not.toBeNull();
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
  }), { timeout: 15000 }).not.toBeNull();
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
  }), { timeout: 15000 }).not.toBeNull();
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
  // Blob Worker를 직접 확인하는 테스트라서 기준선 라우트를 걷고 시작한다.
  await releaseNetworkInterception(page);
  const result = await page.evaluate(async (WORKER_SEARCH_TIME_LIMIT) => {
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
    controller.lookaheadTimeLimitMs = WORKER_SEARCH_TIME_LIMIT;
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
  }, WORKER_SEARCH_TIME_LIMIT);

  expect(result).toEqual({
    target: 4,
    rotation: 3,
    allClear: true,
    targetCombo: 7,
    lookaheadTurnCount: 3,
    lookaheadTimeLimitMs: 15000,
    workerSearchDepth: 3,
    inheritsEnemy: true,
    workerSearchHelpers: true,
  });
});

test('실시간 N수 탐색 공통 클래스는 목표 연쇄와 작은 연쇄 점등 여부만 적마다 정하고 안드레알푸스가 이를 상속한다', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { RealtimeLookaheadEnemy, Andrealphus, Enemy } = window.WebPuyo;
    class CustomRealtimeEnemy extends RealtimeLookaheadEnemy {
      constructor() { super({ targetCombo: 5, lightFeverGaugeWithSmallChains: false }); }
      getClassType() { return 'CustomRealtimeEnemy'; }
    }
    const custom = new CustomRealtimeEnemy();
    const andrealphus = new Andrealphus();
    const defaults = new RealtimeLookaheadEnemy();
    const shared = ['lookaheadTurnCount', 'lookaheadTimeLimitMs', 'lookaheadSearchMode', 'lookaheadBeamWidth', 'realtimeReaction', 'ignorableIncomingGarbage', 'normalFastDownDelayRate', 'dangerFastDownDelayRate'];
    const errors = [
      () => new RealtimeLookaheadEnemy({ targetCombo: 0 }),
      () => new RealtimeLookaheadEnemy({ targetCombo: 6.5 }),
      () => new RealtimeLookaheadEnemy({ lightFeverGaugeWithSmallChains: 'yes' }),
    ].map((create) => { try { create(); return null; } catch (error) { return error.constructor.name; } });
    return {
      inherits: andrealphus instanceof RealtimeLookaheadEnemy && custom instanceof RealtimeLookaheadEnemy && custom instanceof Enemy,
      // 판단 메서드는 모두 공통 클래스에 있고, 안드레알푸스는 이름·종류·테마·초상화만 재정의한다.
      andrealphusOwnMethods: Object.getOwnPropertyNames(Andrealphus.prototype).sort(),
      andrealphus: { targetCombo: andrealphus.targetCombo, light: andrealphus.lightFeverGaugeWithSmallChains, sortPriority: andrealphus.sortPriority, type: andrealphus.getClassType() },
      defaults: { targetCombo: defaults.targetCombo, light: defaults.lightFeverGaugeWithSmallChains, type: defaults.getClassType() },
      custom: { targetCombo: custom.targetCombo, light: custom.lightFeverGaugeWithSmallChains },
      sharedSame: shared.every((key) => custom[key] === andrealphus[key]),
      errors,
    };
  });

  expect(result).toEqual({
    inherits: true,
    andrealphusOwnMethods: ['constructor', 'drawPortrait', 'getClassType', 'getFieldThemeColors', 'getName'],
    andrealphus: { targetCombo: 7, light: true, sortPriority: 8, type: 'Andrealphus' },
    defaults: { targetCombo: 7, light: true, type: 'RealtimeLookaheadEnemy' },
    custom: { targetCombo: 5, light: false },
    sharedSame: true,
    errors: ['RangeError', 'RangeError', 'TypeError'],
  });
});

// 적 AI를 한 칸씩 밀어 모델을 쓰지 않게 된 적이다(플라우로스 BUILDNO 79, 안드라스 BUILDNO 81). 다음에 밀면 여기에 추가한다.
for (const { type, name, sortPriority } of [
  { type: 'Flauros', name: '플라우로스', sortPriority: 9 },
  { type: 'Andras', name: '안드라스', sortPriority: 10 },
]) {
  test(`${name}는 모델 없이 안드레알푸스와 같은 실시간 N수 탐색 판단을 쓰고 ONNX 추론 적 표시에서 빠진다`, async ({ page }) => {
    const result = await page.evaluate((enemyType) => {
      const { RealtimeLookaheadEnemy, OnnxEnemy, Andrealphus } = window.WebPuyo;
      const EnemyType = window.WebPuyo[enemyType];
      const enemy = new EnemyType();
      const andrealphus = new Andrealphus();
      const settings = ['targetCombo', 'lightFeverGaugeWithSmallChains', 'lookaheadTurnCount', 'lookaheadTimeLimitMs', 'lookaheadSearchMode', 'lookaheadBeamWidth', 'realtimeReaction', 'ignorableIncomingGarbage', 'normalFastDownDelayRate', 'dangerFastDownDelayRate'];
      return {
        realtime: enemy instanceof RealtimeLookaheadEnemy,
        onnx: enemy instanceof OnnxEnemy,
        requiresOnnx: enemy.requiresOnnx === true,
        modelPath: enemy.modelPath ?? null,
        sameSettings: settings.every((key) => enemy[key] === andrealphus[key]),
        // 판단 메서드는 모두 공통 클래스의 것이고, 이 적은 이름·종류·테마·초상화만 재정의한다.
        ownMethods: Object.getOwnPropertyNames(EnemyType.prototype).sort(),
        identity: { type: enemy.getClassType(), name: enemy.getName(), sortPriority: enemy.sortPriority, notAvail: enemy.notAvail },
      };
    }, type);

    expect(result).toEqual({
      realtime: true,
      onnx: false,
      requiresOnnx: false,
      modelPath: null,
      sameSettings: true,
      ownMethods: ['constructor', 'drawPortrait', 'getClassType', 'getFieldThemeColors', 'getName'],
      identity: { type, name, sortPriority, notAvail: false },
    });
  });
}

test('외부 Enemy 하위 클래스도 Worker 탐색 보조 함수로 결과를 적용한다', async ({ page }) => {
  // Blob Worker를 직접 확인하는 테스트라서 기준선 라우트를 걷고 시작한다.
  await releaseNetworkInterception(page);
  const result = await page.evaluate(async (WORKER_SEARCH_TIME_LIMIT) => {
    class ExternalWorkerEnemy extends window.WebPuyo.Enemy {
      constructor() {
        super();
        this.targetCombo = 7;
        this.lookaheadTurnCount = 3;
        this.lookaheadTimeLimitMs = WORKER_SEARCH_TIME_LIMIT;
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
  }, WORKER_SEARCH_TIME_LIMIT);

  expect(result).toEqual({ inheritsEnemy: true, state: 'ready', pending: false, validPlacement: true });
});

test('3수 이상 공통 Worker 탐색은 정상 완료 Worker를 다음 요청에서 재사용한다', async ({ page }) => {
  // Blob Worker를 직접 확인하는 테스트라서 기준선 라우트를 걷고 시작한다.
  await releaseNetworkInterception(page);
  const result = await page.evaluate(async (WORKER_SEARCH_TIME_LIMIT) => {
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
      await window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 6, 3, WORKER_SEARCH_TIME_LIMIT).promise;
      await window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 6, 3, WORKER_SEARCH_TIME_LIMIT).promise;
      return createdWorkerCount;
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
    }
  }, WORKER_SEARCH_TIME_LIMIT);

  expect(result).toBe(1);
});

test('3수 이상 공통 Worker 탐색은 깊이별 현재 1수 결과를 순서대로 전달한다', async ({ page }) => {
  // Blob Worker를 직접 확인하는 테스트라서 기준선 라우트를 걷고 시작한다.
  await releaseNetworkInterception(page);
  const result = await page.evaluate(async (WORKER_SEARCH_TIME_LIMIT) => {
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
    const search = window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 6, 3, WORKER_SEARCH_TIME_LIMIT, {
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
  }, WORKER_SEARCH_TIME_LIMIT);

  expect(result.depths).toEqual([1, 2, 3]);
  expect(result).toMatchObject({ depth: 3, fallback: false });
  expect(result.placement).toMatchObject({ x: expect.any(Number), rotation: expect.any(Number) });
});

test('3수 Worker 메인 콜백 오류는 기존 1수 탐색 결과로 즉시 대체한다', async ({ page }) => {
  // Blob Worker를 직접 확인하는 테스트라서 기준선 라우트를 걷고 시작한다.
  await releaseNetworkInterception(page);
  const result = await page.evaluate(async (WORKER_SEARCH_TIME_LIMIT) => {
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
      const search = window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 6, 3, WORKER_SEARCH_TIME_LIMIT, {
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
  }, WORKER_SEARCH_TIME_LIMIT);

  expect(result).toMatchObject({ fallback: true, depth: 0, errorLogged: true });
  expect(result.placement).toMatchObject({ x: expect.any(Number), rotation: expect.any(Number) });
});

test('advanced Worker 탐색의 빠른 배치 계산은 기본 규칙과 같은 착지·연쇄·ATTACK·결과 보드를 낸다', async ({ page }) => {
  // Blob Worker를 직접 확인하는 테스트라서 기준선 라우트를 걷고 시작한다.
  await releaseNetworkInterception(page);
  const result = await page.evaluate(async (WORKER_SEARCH_TIME_LIMIT) => {
    // 게임이 만든 Worker를 붙잡아, 탐색이 끝나 풀에 돌아간 뒤 검증 메시지를 직접 보낸다.
    const OriginalWorker = window.Worker;
    let capturedWorker = null;
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args);
        capturedWorker = this;
      }
    };
    const common = window.WebPuyo.common;
    try {
      const emptyBoard = () => Array.from({ length: 25 }, () => Array(6).fill(null));
      const warmup = { board: emptyBoard(), active: { x: 2, y: 11.9, rotation: 0, colors: ['red', 'blue'] }, nextPairs: [['green', 'yellow'], ['blue', 'red']], aiSimulations: [], attack: 0, damage: 0, warningReductionDelay: 0 };
      await common.simulateNMovePlacementsInWorker(warmup, 6, 3, WORKER_SEARCH_TIME_LIMIT, { searchMode: 'advanced' }).promise;
    } finally {
      window.Worker = OriginalWorker;
    }
    if (!capturedWorker) return { captured: false };

    // 방해뿌요·딱딱뿌요가 섞인 무작위 보드를 고정 시드로 만든다.
    let seed = 20260917;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const colors = ['red', 'green', 'yellow', 'blue', 'purple'];
    const cases = Array.from({ length: 600 }, () => {
      const board = Array.from({ length: 25 }, () => Array(6).fill(null));
      const colorCount = 3 + Math.floor(random() * 3);
      for (let x = 0; x < 6; x += 1) {
        const height = Math.floor(random() * 13);
        for (let y = 0; y < height; y += 1) {
          const roll = random();
          board[y][x] = roll < 0.08 ? 'garbage' : roll < 0.11 ? 'hardGarbage' : colors[Math.floor(random() * colorCount)];
        }
      }
      return {
        board,
        colors: [colors[Math.floor(random() * colorCount)], colors[Math.floor(random() * colorCount)]],
        x: Math.floor(random() * 6),
        rotation: Math.floor(random() * 4),
      };
    });
    const rules = { marginRate: common.getMarginRate(0), timeProgressMultiplier: common.getTimeProgressMultiplier(0) };
    const fastResults = await new Promise((resolve) => {
      const onMessage = ({ data }) => {
        if (data?.requestId !== 'verify-fast-engine') return;
        capturedWorker.removeEventListener('message', onMessage);
        resolve(data.results);
      };
      capturedWorker.addEventListener('message', onMessage);
      capturedWorker.postMessage({ type: 'resolvePlacements', requestId: 'verify-fast-engine', cases, rules });
    });

    let landed = 0;
    let chained = 0;
    const mismatches = [];
    cases.forEach((testCase, index) => {
      const placement = common.findLandingPlacement({ board: testCase.board, active: { x: 2, y: 11.9, rotation: 0, colors: testCase.colors } }, testCase.x, testCase.rotation);
      const fast = fastResults[index];
      if (!placement) {
        if (fast !== null) mismatches.push({ index, reason: 'landing' });
        return;
      }
      landed += 1;
      const positions = common.activeCells(placement).map(({ x, y }) => ({ x, y }));
      const expected = common.simulatePlacementResult(testCase.board, testCase.colors, positions);
      if (expected.combo > 0) chained += 1;
      if (!fast
        || JSON.stringify(fast.positions) !== JSON.stringify(positions)
        || fast.combo !== expected.combo
        || Math.abs(fast.attack - expected.attack) > 1e-9 * Math.max(1, expected.attack)
        || JSON.stringify(fast.board) !== JSON.stringify(expected.board)) mismatches.push({ index, reason: 'result' });
    });
    return { captured: true, landed, chained, mismatches: mismatches.slice(0, 5) };
  }, WORKER_SEARCH_TIME_LIMIT);

  expect(result.captured).toBe(true);
  // 표본이 착지 가능한 배치와 연쇄를 충분히 포함해야 비교가 의미 있다.
  expect(result.landed).toBeGreaterThan(300);
  expect(result.chained).toBeGreaterThan(50);
  expect(result.mismatches).toEqual([]);
});

test('advanced Worker 탐색은 깊이별 결과를 전달하고 허용한 위치·회전 안에서만 현재 수를 고른다', async ({ page }) => {
  // Blob Worker를 직접 확인하는 테스트라서 기준선 라우트를 걷고 시작한다.
  await releaseNetworkInterception(page);
  const result = await page.evaluate(async (WORKER_SEARCH_TIME_LIMIT) => {
    const board = Array.from({ length: 25 }, () => Array(6).fill(null));
    board[0][0] = 'red';
    board[0][1] = 'red';
    const createPlayer = () => {
      const player = {
        board: board.map((row) => [...row]),
        active: { x: 2, y: 11.9, rotation: 0, colors: ['red', 'blue'] },
        nextPairs: [['green', 'yellow'], ['blue', 'red'], ['yellow', 'green']],
        aiSimulations: [],
        attack: 0,
        damage: 0,
        warningReductionDelay: 0,
      };
      new window.WebPuyo.Enemy().prepareTurn(player);
      return player;
    };
    const depths = [];
    const player = createPlayer();
    const completed = await window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 7, 3, WORKER_SEARCH_TIME_LIMIT, {
      searchMode: 'advanced',
      onProgress: (progress) => depths.push(progress.depth),
    }).promise;
    const restrictedPlayer = createPlayer();
    const allowedPlacements = [{ x: 5, rotation: 0 }, { x: 4, rotation: 1 }];
    const restricted = await window.WebPuyo.common.simulateNMovePlacementsInWorker(restrictedPlayer, 7, 3, WORKER_SEARCH_TIME_LIMIT, {
      searchMode: 'advanced',
      allowedPlacements,
    }).promise;
    return {
      depths,
      depth: completed.depth,
      fallback: completed.fallback,
      validPlacement: player.aiSimulations.some((candidate) => candidate.x === completed.placement?.x && candidate.rotation === completed.placement?.rotation),
      restrictedDepth: restricted.depth,
      restrictedAllowed: allowedPlacements.some((placement) => placement.x === restricted.placement?.x && placement.rotation === restricted.placement?.rotation),
    };
  }, WORKER_SEARCH_TIME_LIMIT);

  expect(result).toEqual({ depths: [1, 2, 3], depth: 3, fallback: false, validPlacement: true, restrictedDepth: 3, restrictedAllowed: true });
});

test('advanced Worker 탐색은 방해뿌요가 이번 배치 직후 떨어지면 지금 쏠 수 있는 연쇄로 상쇄한다', async ({ page }) => {
  // Blob Worker를 직접 확인하는 테스트라서 기준선 라우트를 걷고 시작한다.
  await releaseNetworkInterception(page);
  const result = await page.evaluate(async (WORKER_SEARCH_TIME_LIMIT) => {
    // 0열에 빨강 아래·초록 위로 세워 놓으면 빨강 4개가 터지고, 떨어진 초록이 1열 초록 3개와 이어져 터지는 2연쇄 보드다.
    const createPlayer = (damage) => {
      const board = Array.from({ length: 25 }, () => Array(6).fill(null));
      ['red', 'red', 'red'].forEach((color, y) => { board[y][0] = color; });
      ['green', 'green', 'green'].forEach((color, y) => { board[y][1] = color; });
      // 2연쇄 뒤 필드가 비면 싹쓸이 점수 때문에 공격이 없어도 터뜨리므로, 연쇄와 무관한 뿌요를 남겨 둔다.
      board[0][5] = 'yellow';
      board[1][5] = 'purple';
      const player = {
        board,
        active: { x: 2, y: 11.9, rotation: 0, colors: ['red', 'green'] },
        nextPairs: [['yellow', 'purple'], ['purple', 'yellow'], ['yellow', 'blue']],
        aiSimulations: [],
        attack: 0,
        damage,
        warningReductionDelay: 0,
      };
      new window.WebPuyo.Enemy().prepareTurn(player);
      return player;
    };
    const opponent = { board: Array.from({ length: 25 }, () => Array(6).fill(null)), active: null, nextPairs: [], phase: 'control', combo: 0, attack: 0, damage: 0, announcedAttack: 0, warningReductionDelay: 0 };
    const search = async (damage) => {
      const player = createPlayer(damage);
      const completed = await window.WebPuyo.common.simulateNMovePlacementsInWorker(player, 7, 3, WORKER_SEARCH_TIME_LIMIT, {
        searchMode: 'advanced',
        opponent,
        urgentGarbageThreshold: 4,
      }).promise;
      return { depth: completed.depth, combo: completed.placement?.combo };
    };
    return { calm: await search(0), threatened: await search(12) };
  }, WORKER_SEARCH_TIME_LIMIT);

  // 공격이 없으면 목표(7연쇄)보다 작은 2연쇄를 아껴 두고, 곧 12개가 떨어지면 지금 터뜨려 상쇄한다.
  expect(result.calm).toEqual({ depth: 3, combo: 0 });
  expect(result.threatened).toEqual({ depth: 3, combo: 2 });
});

test('advanced Worker 탐색은 피버 룰 일반 상태에서 목표 연쇄·역공·점등 우선순위와 작은 연쇄 점등 설정을 따른다', async ({ page }) => {
  // Blob Worker를 직접 확인하는 테스트라서 기준선 라우트를 걷고 시작한다.
  await releaseNetworkInterception(page);
  const results = await page.evaluate(async (WORKER_SEARCH_TIME_LIMIT) => {
    // 게임이 만든 Worker를 붙잡아, 피버 룰 예고 묶음이 담긴 snapshot을 직접 보낸다.
    const OriginalWorker = window.Worker;
    let capturedWorker = null;
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args);
        capturedWorker = this;
      }
    };
    try {
      const warmup = { board: Array.from({ length: 25 }, () => Array(6).fill(null)), active: { x: 2, y: 11.9, rotation: 0, colors: ['red', 'blue'] }, nextPairs: [['green', 'yellow'], ['blue', 'red']], aiSimulations: [], attack: 0, damage: 0, warningReductionDelay: 0 };
      await window.WebPuyo.common.simulateNMovePlacementsInWorker(warmup, 6, 3, WORKER_SEARCH_TIME_LIMIT, { searchMode: 'advanced' }).promise;
    } finally {
      window.Worker = OriginalWorker;
    }
    // 0열 빨강 3개 위에 [빨강, 초록]을 세우면 빨강이 터지고 떨어진 초록이 1열 초록 3개와 이어지는 2연쇄 보드다.
    const createBoard = (tall) => {
      const board = Array.from({ length: 25 }, () => Array(6).fill(null));
      ['red', 'red', 'red'].forEach((color, y) => { board[y][0] = color; });
      ['green', 'green', 'green'].forEach((color, y) => { board[y][1] = color; });
      board[0][5] = 'yellow';
      board[1][5] = 'purple';
      if (tall) {
        // 두 패배 열을 8칸씩 채워, 방해뿌요 30개가 바로 떨어지면 지는 필드로 만든다.
        const colors = ['yellow', 'purple', 'blue'];
        for (let y = 0; y < 8; y += 1) {
          board[y][2] = colors[y % 3];
          board[y][3] = colors[(y + 1) % 3];
        }
      }
      return board;
    };
    const search = (name, { targetCombo = 7, events = [], gauge = 0, lampChains = true, tall = false }) => new Promise((resolve) => {
      const snapshot = {
        self: { board: createBoard(tall), active: { x: 2, y: 11.9, rotation: 0, colors: ['red', 'green'] }, nextPairs: [['yellow', 'purple'], ['purple', 'yellow'], ['yellow', 'blue']], attack: 0, fever: { active: false } },
        incomingGarbage: 0,
        urgentGarbageThreshold: 1,
        targetCombo,
        turnCount: 3,
        searchMode: 'advanced',
        beamWidth: 5,
        rules: { standard: false, feverRule: true, continuousFever: false, usesSecondDefeatCell: true, marginRate: 70, timeProgressMultiplier: 1 },
        realtime: { incoming: events.reduce((sum, event) => sum + event.amount, 0), garbageMoveIndex: 0, fever: { gauge, gaugeMax: 7, events, lampChains } },
      };
      const onMessage = ({ data }) => {
        if (data?.requestId !== name || data.type !== 'done') return;
        capturedWorker.removeEventListener('message', onMessage);
        resolve([name, { depth: data.result?.depth, combo: data.result?.placement?.combo }]);
      };
      capturedWorker.addEventListener('message', onMessage);
      capturedWorker.postMessage({ type: 'simulate', requestId: name, snapshot, timeLimitMs: WORKER_SEARCH_TIME_LIMIT });
    });
    const cases = [
      ['noIncoming', {}],
      ['lampOn', { events: [{ amount: 20, availableMove: 0, landMove: 5 }] }],
      ['lampOff', { events: [{ amount: 20, availableMove: 0, landMove: 5 }], lampChains: false }],
      ['targetFirst', { targetCombo: 2, events: [{ amount: 20, availableMove: 0, landMove: 5 }], lampChains: false }],
      ['counterAttack', { events: [{ amount: 2, availableMove: 0, landMove: 5 }], lampChains: false }],
      ['feverEntry', { events: [{ amount: 20, availableMove: 0, landMove: 5 }], gauge: 5 }],
      ['deferToSurvive', { events: [{ amount: 30, availableMove: 0, landMove: 0 }], lampChains: false, tall: true }],
      ['holdForPredicted', { events: [{ amount: 20, availableMove: 2, landMove: 4 }] }],
    ];
    const entries = [];
    for (const [name, options] of cases) entries.push(await search(name, options));
    return Object.fromEntries(entries);
  }, WORKER_SEARCH_TIME_LIMIT);

  expect(results).toEqual({
    // 상쇄할 예고가 없으면 목표(7연쇄)보다 작은 2연쇄를 아낀다.
    noIncoming: { depth: 3, combo: 0 },
    // 20개를 다 상쇄할 수 없으면 작은 연쇄로 전등 두 개를 켜고, 설정을 끄면 계속 쌓는다.
    lampOn: { depth: 3, combo: 2 },
    lampOff: { depth: 3, combo: 0 },
    // 이번 수에 목표 연쇄가 되면 설정과 관계없이 목표 연쇄가 먼저다.
    targetFirst: { depth: 3, combo: 2 },
    // 2개를 다 받아치고 하나라도 넘길 수 있으면 목표 미만이라도 받아친다.
    counterAttack: { depth: 3, combo: 2 },
    // 전등 5개에서 두 단계 상쇄로 피버에 들어간다.
    feverEntry: { depth: 3, combo: 2 },
    // 피버 룰은 터진 배치 뒤 방해뿌요가 떨어지지 않으므로, 쌓기 모드에서도 지는 배치 대신 연쇄로 낙하를 미룬다.
    deferToSurvive: { depth: 3, combo: 2 },
    // 상대 피버 연쇄가 아직 시작되지 않아 지금은 상쇄할 수 없으면 미리 쏘지 않는다.
    holdForPredicted: { depth: 3, combo: 0 },
  });
});

test('상대 연쇄 예측은 남은 연쇄 수·최종 ATTACK·끝나는 시간을 게임 규칙대로 계산한다', async ({ page }) => {
  const result = await page.evaluate(() => {
    const common = window.WebPuyo.common;
    // 빨강 4개가 먼저 터지고, 그 위 초록이 떨어져 1열 초록 3개와 이어 터지는 2연쇄가 남은 보드다.
    const board = Array.from({ length: 25 }, () => Array(6).fill(null));
    ['red', 'red', 'red', 'red', 'green'].forEach((color, y) => { board[y][0] = color; });
    ['green', 'green', 'green'].forEach((color, y) => { board[y][1] = color; });
    const explodePhase = { board, phase: 'explode', phaseTimer: 50, combo: 0, attack: 0 };
    const prediction = common.predictPlayerChain(explodePhase);

    // 같은 연쇄를 규칙 함수로 직접 풀어 기대값을 만든다.
    let expectedBoard = board.map((row) => [...row]);
    let expectedAttack = 0;
    let combo = 0;
    while (true) {
      const groups = common.findExplosionGroupsOnBoard(expectedBoard);
      if (!groups.length) break;
      combo += 1;
      expectedAttack += common.calculateExplosionAttack(common.calculateExplosionPoint(groups, combo));
      groups.flatMap((group) => group.cells).forEach(([x, y]) => { expectedBoard[y][x] = null; });
      expectedBoard = common.collapseBoard(expectedBoard);
    }

    const continued = common.predictPlayerChain({ board, phase: 'explode', phaseTimer: 0, combo: 3, attack: 20 });
    return {
      prediction,
      expectedCombo: combo,
      expectedAttack,
      continued: { remainingCombo: continued.remainingCombo, finalCombo: continued.finalCombo, attackIncreased: continued.finalAttack - 20 > expectedAttack },
      idle: common.predictPlayerChain({ board, phase: 'control', combo: 0, attack: 0 }).active,
      lockedWithoutChain: common.predictPlayerChain({ board: Array.from({ length: 25 }, () => Array(6).fill(null)), phase: 'gravity', gravityNextPhase: 'explode', gravityAnimation: null, combo: 0, attack: 0 }).active,
    };
  });

  expect(result.prediction).toMatchObject({ active: true, currentCombo: 0, remainingCombo: 2, finalCombo: 2 });
  expect(result.expectedCombo).toBe(2);
  expect(result.prediction.finalAttack).toBeCloseTo(result.expectedAttack, 9);
  // 남은 폭발 대기 100ms와 두 단계의 폭발 연출(430ms)·대기(150ms)는 최소한 들어가야 한다.
  expect(result.prediction.endInMs).toBeGreaterThanOrEqual(100 + 2 * (430 + 150));
  // 연쇄 보너스는 이미 진행한 연쇄 번호부터 이어서 세므로, 같은 보드라도 4·5연쇄째의 ATTACK이 더 크다.
  expect(result.continued).toEqual({ remainingCombo: 2, finalCombo: 5, attackIncreased: true });
  expect(result.idle).toBe(false);
  expect(result.lockedWithoutChain).toBe(false);
});

test('안드레알푸스는 빠른 하강 전에 받을 방해뿌요가 바뀌면 재판단하고, 빠른 하강을 시작한 턴에는 재판단하지 않는다', async ({ page }) => {
  // 실제 대전에서 Blob Worker를 쓰므로 기준선 라우트를 걷고 시작한다.
  await releaseNetworkInterception(page);
  await page.evaluate(() => {
    class RealtimeAndrealphus extends window.WebPuyo.Andrealphus {
      constructor() { super(); this.sortPriority = -100; }
      getClassType() { return 'RealtimeAndrealphus'; }
      getName() { return '실시간 재판단 테스트 안드레알푸스'; }
      prepareTurn(player) {
        super.prepareTurn(player);
        this.player = player;
        window.realtimeAndrealphus = this;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new RealtimeAndrealphus() });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  // Worker 탐색을 쓰는 턴(빈 필드 무작위 배치가 아닌 턴)의 결과가 준비되고, 아직 빠른 하강 전인 순간에 방해뿌요를 늘린다.
  await expect.poll(() => page.evaluate(() => {
    const controller = window.realtimeAndrealphus;
    const state = controller?.realtimeReactionState;
    if (!state || state.fastDownStarted || controller.workerSearchState !== 'ready' || !controller.player.active) return false;
    if (controller.player.placedPairCount !== state.turn) return false;
    // 부하로 프레임 간격이 커도 빠른 하강 대기 시간 안에서 확인하도록, 이번 턴의 판단 경과 시간을 처음으로 되돌린다.
    controller.player.aiDecisionElapsed = 0;
    const before = state.replanCount;
    controller.player.damage = 12;
    const started = controller.updateRealtimeReaction(controller.player);
    window.realtimeReplanResult = { started, replanDelta: state.replanCount - before, pending: controller.workerSearchState === 'pending', incoming: state.incoming };
    return true;
  }), { timeout: 30000 }).toBe(true);
  const replanned = await page.evaluate(() => window.realtimeReplanResult);
  expect(replanned).toMatchObject({ started: true, replanDelta: 1, pending: true });
  expect(replanned.incoming).toBeGreaterThanOrEqual(12);

  // 보통 난이도는 목표 결정 뒤 빠른 하강을 시작한다. 그렇게 빠른 하강을 시작한 턴에서는 받을 양이 다시 바뀌어도 재판단하지 않는다.
  await expect.poll(() => page.evaluate(() => {
    const controller = window.realtimeAndrealphus;
    const state = controller?.realtimeReactionState;
    if (!state?.fastDownStarted || !controller.player.active || controller.player.placedPairCount !== state.turn) return false;
    const before = state.replanCount;
    controller.player.damage += 20;
    window.realtimeGateResult = { started: controller.updateRealtimeReaction(controller.player), replanDelta: state.replanCount - before };
    return true;
  }), { timeout: 30000 }).toBe(true);
  expect(await page.evaluate(() => window.realtimeGateResult)).toEqual({ started: false, replanDelta: 0 });
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

  await expect.poll(() => page.evaluate(() => window.kimarisSimulationTiming || null), { timeout: 15000 }).not.toBeNull();
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
  }), { timeout: 15000 }).not.toContain(2);
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
  }), { timeout: 15000 }).not.toEqual(expect.arrayContaining([2, 3]));
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
  }), { timeout: 15000 }).toEqual({ target: 2, rotation: 0, combo: 1 });
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

// 대전 화면의 베젤·플레이 영역·중앙 영역·화면 여백 색을 한 번에 읽는다.
async function readThemePixels(page) {
  return page.evaluate(() => {
    const drawingContext = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d');
    const at = (x, y) => Array.from(drawingContext.getImageData(x, y, 1, 1).data).slice(0, 3);
    return { bezel: at(160, 300), field: at(210, 300), center: at(460, 700), margin: at(40, 700) };
  });
}

test('기본 제공 적은 각자의 게임 테마를 쓰고 단독 모드는 기본 테마를 유지한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  // 첫 번째 선택지인 안드로말리우스는 초상화와 어울리는 초록 테마를 사용한다.
  await expect.poll(() => readThemePixels(page)).toEqual({
    bezel: [14, 53, 41], field: [22, 76, 57], center: [7, 31, 24], margin: [7, 31, 24],
  });

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  // 대전이 아닌 연습은 기존 기본 테마를 그대로 사용한다.
  await expect.poll(() => readThemePixels(page)).toEqual({
    bezel: [12, 36, 51], field: [17, 47, 64], center: [7, 22, 33], margin: [7, 22, 33],
  });
});

test('구경 대전은 양쪽 필드와 화면 배경 모두 우측 적의 테마를 쓴다', async ({ page }) => {
  await page.evaluate(() => {
    const cleared = ['Decarabia', 'Kimaris', 'Andrealphus'];
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: cleared,
      clearListByDifficulty: { easy: [], normal: cleared, hard: [], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: cleared, hard: [], extreme: [] },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');

  const themesByName = {
    '데카라비아': { bezel: [53, 25, 44], field: [76, 39, 64], center: [28, 13, 23] },
    '키마리스': { bezel: [30, 26, 32], field: [46, 40, 48], center: [14, 12, 16] },
    '안드레알푸스': { bezel: [12, 59, 69], field: [19, 84, 96], center: [6, 31, 38] },
  };
  const rightName = (await page.evaluate(() => window.WebPuyo.getGameState())).opponent.name;
  const expected = themesByName[rightName];
  expect(expected).toBeTruthy();
  const readWatchThemePixels = () => page.evaluate(() => {
    const drawingContext = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d');
    const at = (x, y) => Array.from(drawingContext.getImageData(x, y, 1, 1).data).slice(0, 3);
    return {
      leftBezel: at(160, 300), leftField: at(210, 300),
      rightBezel: at(836, 300), rightField: at(886, 300),
      center: at(460, 700), margin: at(40, 700),
    };
  });
  // 좌측 CPU의 테마가 아니라 game.themeController인 우측 CPU의 테마만 사용한다.
  await expect.poll(readWatchThemePixels).toEqual({
    leftBezel: expected.bezel, leftField: expected.field,
    rightBezel: expected.bezel, rightField: expected.field,
    center: expected.center, margin: expected.center,
  });
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
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 15000 }).toBe('player');

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
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
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
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
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
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
});

// 모델을 쓰지 않게 된 적은 구경 모드 무작위 선정 후보가 되고, ONNX 추론 적(현재 첫 ONNX 적은 발라크)은 빠진다.
for (const { type, name } of [
  { type: 'Flauros', name: '플라우로스' },
  { type: 'Andras', name: '안드라스' },
]) {
  test(`구경 모드 무작위 적 선정은 모델을 쓰지 않는 ${name}를 포함하고 ONNX 추론 적 발라크는 뺀다`, async ({ page }) => {
    // 보통 이상에서 이긴 적만 후보가 되므로, 데카라비아(구경 해금)·이 적·발라크만 이긴 기록을 둔다.
    await page.evaluate((enemyType) => {
      localStorage.setItem('puyow_store', JSON.stringify({
        clearList: ['Decarabia'],
        clearListByDifficulty: { easy: [], normal: ['Decarabia', enemyType, 'Valak'], hard: [], extreme: [] },
        feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
      }));
    }, type);
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
    await enterMainMenu(page);
    for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.watch), { timeout: 20000 }).toBe(true);

    // 발라크는 이긴 기록이 있어도 빠지므로, 남은 후보 두 명(데카라비아·이 적)이 무작위와 관계없이 맞붙는다.
    const names = await page.evaluate(() => {
      const state = window.WebPuyo.getGameState();
      return [state.player.name, state.opponent.name].sort();
    });
    expect(names).toEqual(['데카라비아', name].sort());
  });
}

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
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
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
  const initialWatchNames = [initialState.player.name, initialState.opponent.name];

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return [state.player.name, state.opponent.name];
  })).toEqual(initialWatchNames);
  expect(await page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state.player.placedPairCount + state.opponent.placedPairCount;
  })).toBe(0);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');

  // 세 번째 버튼인 종료는 오른쪽으로 두 칸 옮겨 선택한다.
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  await page.keyboard.press('ArrowRight');
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 830, y: 408 } });
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
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('playing');
  await expect.poll(() => page.evaluate(() => window.watchPortraitCalls.some((call) => (
    call.type === 'WatchPortraitLeft' && call.x === 545 && call.y === 380 && call.expression === 'crisis'
  ))), { timeout: 15000 }).toBe(true);
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
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('game_over');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).clearList)).toEqual(['Decarabia']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_gallery')))).toEqual({ warning: ['tiny'], enemies: ['Andromalius'] });
  const controllerCountAtResult = await page.evaluate(() => window.watchTestControllerCount);
  await expect.poll(() => page.evaluate(() => window.watchTestControllerCount), { timeout: 15000 }).toBeGreaterThan(controllerCountAtResult);
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
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.some((audio) => audio.src === 'sounds/watch-left-player-spell.ogg')), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate(() => window.testAudioInstances.some((audio) => audio.src === 'sounds/watch-enemy-spell.ogg'))).toBe(false);
});
