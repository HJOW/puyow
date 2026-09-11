// 퍼즐뿌요 모드의 회귀 테스트다. 스테이지 선택과 잠금 해제, 승리 조건 판정, 결과 화면을 다룬다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu } from './common/gamepage.js';

setupGamePage();

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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.puzzle).toMatchObject({ stageIndex: 0, turn: 1 });
  expect(state.colors).toEqual(['red', 'green', 'yellow', 'blue', 'purple']);
  expect(state.player.active.colors).toEqual(await page.evaluate(() => window.WebPuyo.PUZZLE_STAGES[0].suppliedNextPuyos[0]));
  expect(state.opponent.phase).toBe('idle');

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 408 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getGameState().puzzle)).toMatchObject({ stageIndex: 0, turn: 1 });
});

test('연습·연속 피버·퍼즐뿌요는 단독 NEXT 영역에 네 쌍을 표시하고 연습 상대 문구를 숨긴다', async ({ page }) => {
  async function expectSoloNextLayout() {
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getNextPairs()?.player.nextPairs.length), { timeout: 15000 }).toBe(4);
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
    }), { timeout: 15000 }).toBe(true);
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.puzzle?.stageIndex), { timeout: 15000 }).toBe(5);

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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.puzzle?.stageIndex), { timeout: 15000 }).toBe(5);
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('game_over');
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
  expect(['한 번에 2가지 색 뿌요를 터뜨려봐', 'Pop 2 colors at once!', '一度に2色のぷよを消そう！', '一次消除 2 种颜色的魔法气泡！'])
    .toContain(await page.evaluate(() => window.WebPuyo.getGameState()?.puzzle?.condition));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('game_over');
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('game_over');
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl), { timeout: 15000 }).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('game_over');
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('puyow_store')).puzzleClearStages)).toContain(1);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.puzzle?.stageIndex)).toBe(1);
});
