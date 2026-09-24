// 도장깨기 완화 피버 룰의 메뉴, 대전, 독립 기록을 확인한다.
import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu } from './common/gamepage.js';

setupGamePage();

test('완화 룰 버튼을 클릭하면 해당 규칙의 적 대전이 열린다', async ({ page }) => {
  await enterMainMenu(page);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('puyow_store'));
    saved.feverClearListByDifficulty.normal = ['Kimaris'];
    localStorage.setItem('puyow_store', JSON.stringify(saved));
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 900, y: 345 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.rule)).toBe('relaxed_fever');
});

test('완화 룰은 해금 전에는 선택할 수 없고 해금 뒤 전등 3개로 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await expect.poll(() => page.evaluate(() => {
    const pixel = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(900, 315, 1, 1).data;
    return Array.from(pixel).join(',');
  })).toBe('60,70,80,255');
  await canvas.click({ position: { x: 900, y: 345 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('puyow_store'));
    saved.feverClearListByDifficulty.normal = ['Kimaris'];
    saved.settings.useReplayFeature = true;
    localStorage.setItem('puyow_store', JSON.stringify(saved));
  });
  await page.reload();
  await page.evaluate(() => {
    class RelaxedFeverProgressEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1; }
      getClassType() { return 'RelaxedFeverProgressEnemy'; }
      getName() { return '완화 피버 진행도 테스트 적'; }
      prepareTurn(player) {
        super.prepareTurn(player);
        player.board[11][2] = 'red';
        player.board[11][3] = 'red';
        player.phase = 'check';
        player.phaseTimer = 150;
      }
    }
    window.WebPuyo.registerOpponent({ createController: () => new RelaxedFeverProgressEnemy() });
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const pixel = document.querySelector('[data-puyow-canvas="2d"]').getContext('2d').getImageData(900, 315, 1, 1).data;
    return Array.from(pixel).join(',');
  })).toBe('176,0,122,255');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.rule).toBe('relaxed_fever');
  expect(state.player.fever.gauge).toBe(3);
  expect(state.opponent.fever.gauge).toBe(3);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 15000 }).toBe('player');
  const records = await page.evaluate(() => ({
    store: JSON.parse(localStorage.getItem('puyow_store')),
    leaderboard: JSON.parse(localStorage.getItem('puyow_leaderboard')),
    gallery: JSON.parse(localStorage.getItem('puyow_gallery')),
    replayRule: window.WebPuyo.getReplayData()?.meta?.rule,
  }));
  expect(records.store.relaxedFeverClearListByDifficulty.normal).toContain('RelaxedFeverProgressEnemy');
  expect(records.store.feverClearListByDifficulty.normal).toEqual(['Kimaris']);
  expect(records.gallery.enemies).toContain('RelaxedFeverProgressEnemy');
  expect(records.leaderboard.records.relaxed_fever.normal['4'].RelaxedFeverProgressEnemy).toHaveLength(1);
  expect(records.replayRule).toBe('relaxedFever');
});
