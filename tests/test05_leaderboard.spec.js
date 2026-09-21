// 리더보드 회귀 테스트다. 게임 페이지(puyow.html)의 기록 규칙과 조회 화면(leaderboard.html)을 다룬다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu } from './common/gamepage.js';

const LEADERBOARD_PAGE = '/leaderboard.html';

/** 저장된 리더보드 원본을 읽는다. */
function readLeaderboard(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('puyow_leaderboard') || 'null'));
}

test.describe('게임 페이지의 리더보드 기록', () => {
  setupGamePage();

  /** 첫 조작에서 스스로 패배 칸을 막는 테스트용 적을 맨 앞에 등록한다. */
  async function registerSelfLosingEnemy(page, classType) {
    await page.evaluate((type) => {
      class SelfLosingEnemy extends window.WebPuyo.Enemy {
        constructor() { super(); this.sortPriority = -1; }
        getClassType() { return type; }
        getName() { return '리더보드 테스트 적'; }
        prepareTurn(player) {
          super.prepareTurn(player);
          player.board[11][2] = 'red';
          player.board[11][3] = 'red';
          player.phase = 'check';
          player.phaseTimer = 150;
        }
      }
      window.WebPuyo.registerOpponent({ createController: () => new SelfLosingEnemy() });
    }, classType);
  }

  test('기본 룰에서 이기면 AI 난이도·색 수·적별로 닉네임과 점수를 기록한다', async ({ page }) => {
    await registerSelfLosingEnemy(page, 'LeaderboardWinEnemy');
    await enterMainMenu(page);
    const startedAt = await page.evaluate(() => Date.now());
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
    for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 15000 }).toBe('player');
    const colorCount = await page.evaluate(() => window.WebPuyo.getGameState().colorCount);
    const difficultyKey = await page.evaluate(() => window.WebPuyo.getGameState().aiDifficulty.key);
    const playerName = await page.evaluate(() => window.WebPuyo.getGameState().player.name);
    const saved = await readLeaderboard(page);
    expect(saved.version).toBe(2);
    const finishedAt = await page.evaluate(() => Date.now());
    // 적이 있는 대전은 룰 → AI 난이도 → 색 수 → 적 순서로 나눠 기록한다.
    expect(Object.keys(saved.records.standard)).toEqual([difficultyKey]);
    const [entry] = saved.records.standard[difficultyKey][String(colorCount)].LeaderboardWinEnemy;
    expect(saved.records.standard[difficultyKey][String(colorCount)].LeaderboardWinEnemy).toHaveLength(1);
    expect(entry).toMatchObject({ name: playerName, score: 0 });
    // 기록 일시는 게임 진행 시간이 아니라 기록이 발생한 당시의 현재 시각이다.
    expect(entry.recordedAt).toBeGreaterThanOrEqual(startedAt);
    expect(entry.recordedAt).toBeLessThanOrEqual(finishedAt);
    expect(saved.records.fever).toBeUndefined();
    expect(saved.records.practice).toBeUndefined();
  });

  test('연습은 패배했을 때 최종 점수를 기록하고, 일시정지 종료로 빠져나가면 기록하지 않는다', async ({ page }) => {
    await enterMainMenu(page);
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().playerCanControl), { timeout: 15000 }).toBe(true);

    // 일시정지 → 종료(2번)는 패배가 아니므로 기록하지 않는다.
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
    expect(await readLeaderboard(page)).toBeNull();

    // 다시 연습을 시작해 패배 열(X=2)에 세로 쌍을 계속 떨어뜨려 진다.
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
    await page.keyboard.press('Enter');
    await expect.poll(async () => {
      const state = await page.evaluate(() => window.WebPuyo.getScreenState());
      if (state.playerCanControl) {
        await page.keyboard.down('ArrowDown');
        await page.waitForTimeout(300);
        await page.keyboard.up('ArrowDown');
      }
      return state.screen;
    }, { timeout: 60000, intervals: [100] }).toBe('game_over');
    const colorCount = await page.evaluate(() => window.WebPuyo.getSelectedColorCount());
    const saved = await readLeaderboard(page);
    const list = saved.records.practice[String(colorCount)];
    expect(list).toHaveLength(1);
    expect(list[0].score).toBeGreaterThanOrEqual(0);
    expect(Math.abs(list[0].recordedAt - await page.evaluate(() => Date.now()))).toBeLessThan(60000);
    expect(saved.records.standard).toBeUndefined();
  });

  /** 메인 메뉴 좌측 하단 버튼의 문구 좌표를 모은다. */
  async function collectBottomLeftButtons(page) {
    const labels = await page.evaluate(() => ({ replay: window.WebPuyo.translate('리플레이 재생'), leaderboard: window.WebPuyo.translate('리더보드') }));
    await page.evaluate(() => { window.testCanvasTextCalls = []; });
    await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.length)).toBeGreaterThan(0);
    return page.evaluate((names) => {
      const find = (text) => window.testCanvasTextCalls.find((call) => call.text === text);
      return { replay: find(names.replay), leaderboard: find(names.leaderboard), github: find('GitHub') };
    }, labels);
  }

  test('메인 메뉴 리더보드 버튼은 리플레이 재생과 GitHub 사이에 있고 방향키로 골라 리더보드 화면으로 이동한다', async ({ page }) => {
    await enterMainMenu(page);
    const buttons = await collectBottomLeftButtons(page);
    expect(buttons.replay && buttons.leaderboard && buttons.github).toBeTruthy();
    expect(buttons.leaderboard.x).toBeCloseTo(buttons.github.x, 0);
    expect(buttons.replay.x).toBeCloseTo(buttons.github.x, 0);
    expect(buttons.replay.y).toBeLessThan(buttons.leaderboard.y);
    expect(buttons.leaderboard.y).toBeLessThan(buttons.github.y);

    // 목록 항목(잠긴 구경 제외) → 리플레이 재생 → 리더보드 → GitHub 순서다. GitHub에서 위로 한 번 가면 리더보드다.
    await page.evaluate(() => { window.open = () => null; });
    for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/leaderboard\.html$/);
    await expect(page.locator('.lb-sidebar')).toBeVisible();
  });

  test('메인 메뉴 리더보드 버튼을 마우스로 누르면 리더보드 화면으로 이동한다', async ({ page }) => {
    await enterMainMenu(page);
    const canvas = await page.locator('[data-puyow-canvas="2d"]').boundingBox();
    const scale = canvas.width / 1280;
    // 리플레이 재생 버튼(위)과 GitHub 버튼(아래)은 그대로 원래 동작을 한다.
    await page.evaluate(() => { window.openedUrls = []; window.open = (url) => { window.openedUrls.push(url); return null; }; });
    await page.mouse.click(canvas.x + 74 * scale, canvas.y + 676 * scale);
    expect(await page.evaluate(() => window.openedUrls)).toEqual(['https://github.com/HJOW/puyow']);
    await page.mouse.click(canvas.x + 74 * scale, canvas.y + 645 * scale);
    await page.waitForURL(/\/leaderboard\.html$/);
    await expect(page.locator('.lb-sidebar')).toBeVisible();
  });

  test('저장된 기록은 점수순 10개로 정리하고 솔로몬·잘못된 항목은 버린다', async ({ page }) => {
    const data = await page.evaluate(() => {
      const many = Array.from({ length: 13 }, (_, index) => ({ name: `P${index}`, score: index * 10 }));
      localStorage.setItem('puyow_leaderboard', JSON.stringify({
        version: 2,
        records: {
          standard: {
            hard: { 4: { Kimaris: many, Solomon: [{ name: 'S', score: 1 }] }, 9: { Kimaris: [{ name: 'X', score: 1 }] } },
            unknown: { 4: { Kimaris: [{ name: 'U', score: 1 }] } }
          },
          practice: { 3: [{ name: 'A', score: -1 }, { name: 'B', score: 'x' }, { name: 'C', score: 55.7, recordedAt: 1758240000000.9 }, { name: 'D', score: 5, recordedAt: 'x' }] },
          puzzle: { 3: [{ name: 'Z', score: 1 }] }
        }
      }));
      return window.WebPuyo.leaderboard.getData();
    });
    expect(data.version).toBe(2);
    expect(Object.keys(data.records.standard)).toEqual(['hard']);
    expect(data.records.standard.hard['4'].Kimaris.map((entry) => entry.score)).toEqual([120, 110, 100, 90, 80, 70, 60, 50, 40, 30]);
    expect(data.records.standard.hard['4'].Solomon).toBeUndefined();
    expect(data.records.standard.hard['9']).toBeUndefined();
    // 일시가 없거나 잘못된 예전 기록은 recordedAt을 null로 보정한다.
    expect(data.records.practice['3']).toEqual([{ name: 'C', score: 55, recordedAt: 1758240000000 }, { name: 'D', score: 5, recordedAt: null }]);
    expect(data.records.standard.hard['4'].Kimaris[0].recordedAt).toBeNull();
    expect(data.records.puzzle).toBeUndefined();
    expect(data.legacy).toBeUndefined();
    expect(await page.evaluate(() => window.WebPuyo.leaderboard.getDifficulties().map((entry) => entry.key))).toEqual(['easy', 'normal', 'hard', 'extreme']);
    const opponents = await page.evaluate(() => window.WebPuyo.leaderboard.getOpponents().map((entry) => entry.classType));
    expect(opponents).toContain('Andromalius');
    expect(opponents).not.toContain('Solomon');
    expect(opponents).not.toContain('Oriax');
  });

  test('AI 난이도가 없던 형식 1의 대전 기록은 어느 난이도에도 넣지 않고 legacy에 보존한다', async ({ page }) => {
    const data = await page.evaluate(() => {
      localStorage.setItem('puyow_leaderboard', JSON.stringify({
        version: 1,
        records: {
          standard: { 4: { Kimaris: [{ name: 'Old', score: 700, recordedAt: 1758240000000 }] } },
          practice: { 3: [{ name: 'Solo', score: 30 }] }
        }
      }));
      return window.WebPuyo.leaderboard.getData();
    });
    expect(data.version).toBe(2);
    expect(data.records.standard).toBeUndefined();
    expect(data.legacy.v1.standard['4'].Kimaris).toEqual([{ name: 'Old', score: 700, recordedAt: 1758240000000 }]);
    // 단독 룰은 구조가 같아 그대로 옮긴다.
    expect(data.records.practice['3']).toEqual([{ name: 'Solo', score: 30, recordedAt: null }]);
  });
});

test.describe('리더보드 조회 화면', () => {
  const SAMPLE = {
    version: 2,
    records: {
      standard: {
        normal: { 4: { Kimaris: [{ name: 'Alice', score: 98765, recordedAt: Date.UTC(2026, 8, 19, 3, 4) }, { name: '<b>Bob</b>', score: 1200 }] } },
        extreme: { 4: { Kimaris: [{ name: 'Eve', score: 5 }] } }
      },
      continuous_fever: { 5: [{ name: 'Carol', score: 4321 }] }
    }
  };

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((sample) => {
      if (!sessionStorage.getItem('lb_seeded')) {
        localStorage.setItem('puyow_leaderboard', JSON.stringify(sample));
        sessionStorage.setItem('lb_seeded', '1');
      }
    }, SAMPLE);
  });

  test('기본 언어는 영어이고 트리 메뉴로 룰·AI 난이도·색 수·적을 골라 점수 목록을 본다', async ({ page }) => {
    await page.goto(LEADERBOARD_PAGE);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.lb-brand-title')).toHaveText('Leaderboard');
    await expect(page.locator('.lb-title')).toHaveText('Overall ranking');

    // 대전 룰 아래 두 번째 단계는 AI 난이도다.
    await expect(page.locator('[data-node-id="standard"] + ul > li > .lb-node .lb-node-label')).toHaveText(['Easy', 'Normal', 'Hard', 'Extreme']);
    await page.locator('[data-node-id="standard/normal"]').click();
    await expect(page.locator('.lb-title')).toHaveText('Combined ranking');
    await page.locator('[data-node-id="standard/normal/4"]').click();
    await expect(page.locator('.lb-title')).toHaveText('Combined ranking');
    await page.locator('[data-node-id="standard/normal/4/Kimaris"]').click();
    await expect(page.locator('.lb-title')).toHaveText('Kimaris');
    await expect(page.locator('.lb-breadcrumb')).toHaveText('Standard Rules › Normal › 4 Colors');
    const rows = page.locator('.lb-table tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Alice');
    await expect(rows.nth(0)).toContainText('98,765');
    await expect(page.locator('.lb-table thead')).toContainText('Recorded at');
    // 기록 일시는 브라우저 현지 시간대로 표시하고, 일시가 없는 예전 기록은 대시로 표시한다.
    const expectedDate = await page.evaluate((time) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time)), SAMPLE.records.standard.normal[4].Kimaris[0].recordedAt);
    await expect(rows.nth(0).locator('.lb-col-date')).toHaveText(expectedDate);
    await expect(rows.nth(0).locator('.lb-col-date')).toHaveAttribute('title', '2026-09-19T03:04:00.000Z');
    await expect(rows.nth(1).locator('.lb-col-date')).toHaveText('-');
    // 닉네임은 HTML로 해석하지 않는다.
    await expect(rows.nth(1).locator('.lb-col-name')).toHaveText('<b>Bob</b>');
    await expect(page.locator('[data-node-id="standard/normal/4/Kimaris"] .lb-count')).toHaveText('2');

    // 같은 적·색 수라도 AI 난이도가 다르면 순위가 따로다.
    await page.locator('[data-node-id="standard/extreme"]').click();
    await page.locator('[data-node-id="standard/extreme/4"]').click();
    await page.locator('[data-node-id="standard/extreme/4/Kimaris"]').click();
    await expect(page.locator('.lb-breadcrumb')).toHaveText('Standard Rules › Extreme › 4 Colors');
    await expect(page.locator('.lb-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.lb-table tbody tr')).toContainText('Eve');

    // 기록이 없는 적은 빈 목록 안내를 보여 준다.
    await page.locator('[data-node-id="standard/normal/4/Andromalius"]').click();
    await expect(page.locator('.lb-empty')).toHaveText('No records yet.');
    await expect(page.locator('[data-node-id$="/Solomon"]')).toHaveCount(0);

    // 단독 룰은 AI 난이도 단계 없이 색 수가 끝 항목이다.
    await page.locator('[data-node-id="continuous_fever"]').click();
    await expect(page.locator('[data-node-id="continuous_fever"] + ul > li > .lb-node')).toHaveCount(3);
    await page.locator('[data-node-id="continuous_fever/5"]').click();
    await expect(page.locator('.lb-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.lb-table tbody tr')).toContainText('Carol');
  });

  test('아무것도 고르지 않은 처음 화면은 모든 룰을 합친 전체 순위를 보여 준다', async ({ page }) => {
    await page.goto(LEADERBOARD_PAGE);
    await expect(page.locator('.lb-title')).toHaveText('Overall ranking');
    await expect(page.locator('.lb-breadcrumb')).toHaveText('');
    // 룰·색상·적 칸이 함께 나온다.
    await expect(page.locator('.lb-table thead')).toContainText(['Rank', 'Nickname', 'Score', 'Rule', 'Colors', 'Opponent', 'Recorded at'].join(''));

    const rows = page.locator('.lb-table tbody tr');
    await expect(rows).toHaveCount(4);
    // 룰이 달라도 점수 순서 하나로 줄을 세운다.
    await expect(rows.nth(0).locator('.lb-col-name')).toHaveText('Alice');
    await expect(rows.nth(0).locator('.lb-col-rule')).toHaveText('Standard Rules');
    await expect(rows.nth(0).locator('.lb-col-colors')).toHaveText('4 Colors');
    await expect(rows.nth(0).locator('.lb-col-opponent')).toHaveText('Kimaris');
    await expect(rows.nth(0).locator('.lb-col-score')).toHaveText('98,765');
    // 적이 없는 단독 룰은 적 칸이 대시다.
    await expect(rows.nth(1).locator('.lb-col-name')).toHaveText('Carol');
    await expect(rows.nth(1).locator('.lb-col-rule')).toHaveText('Continuous FEVER');
    await expect(rows.nth(1).locator('.lb-col-colors')).toHaveText('5 Colors');
    await expect(rows.nth(1).locator('.lb-col-opponent')).toHaveText('-');
    await expect(rows.nth(2).locator('.lb-col-name')).toHaveText('<b>Bob</b>');
    await expect(rows.nth(3).locator('.lb-col-name')).toHaveText('Eve');

    // 칸을 넘치는 값은 말줄임표로 줄이고 전체 값은 title에 둔다.
    await expect(rows.nth(0).locator('.lb-col-name')).toHaveAttribute('title', 'Alice');
    expect(await rows.nth(0).locator('.lb-col-name').evaluate((cell) => getComputedStyle(cell).textOverflow)).toBe('ellipsis');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // 메뉴에서 고르면 그 항목의 순위로 바뀐다.
    await page.locator('[data-node-id="standard/normal"]').click();
    await expect(page.locator('.lb-breadcrumb')).toHaveText('Standard Rules › Normal');

    // 사이드바 상단 제목을 누르면 아무것도 고르지 않은 처음 화면으로 돌아온다.
    await page.locator('.lb-brand').click();
    await expect(page.locator('.lb-title')).toHaveText('Overall ranking');
    await expect(rows).toHaveCount(4);
    await expect(page.locator('.lb-node[aria-current="true"]')).toHaveCount(0);
    // 펼쳐 둔 가지는 그대로 남는다.
    await expect(page.locator('[data-node-id="standard"]')).toHaveAttribute('aria-expanded', 'true');
  });

  test('기록이 하나도 없으면 처음 화면에 메뉴 안내를 보여 준다', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('puyow_leaderboard'));
    await page.goto(LEADERBOARD_PAGE);
    await expect(page.locator('.lb-empty')).toHaveText('Select a rule and its options from the menu.');
    await expect(page.locator('.lb-table')).toHaveCount(0);
  });

  test('룰 이름을 직접 고르면 그 룰의 난이도 통합 순위를 보여 준다', async ({ page }) => {
    await page.goto(LEADERBOARD_PAGE);

    // 대전 룰: AI 난이도·색 수·적을 가리지 않고 한 표에 모아 점수순으로 매긴다.
    await page.locator('[data-node-id="standard"]').click();
    await expect(page.locator('.lb-breadcrumb')).toHaveText('Standard Rules');
    await expect(page.locator('.lb-title')).toHaveText('Combined ranking');
    await expect(page.locator('.lb-table thead')).toContainText('Conditions');
    const rows = page.locator('.lb-table tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Alice');
    await expect(rows.nth(0).locator('.lb-col-condition')).toHaveText('Normal · 4 Colors · Kimaris');
    await expect(rows.nth(1)).toContainText('<b>Bob</b>');
    // 난이도가 다른 기록도 점수 순서대로 같은 표에 들어간다.
    await expect(rows.nth(2)).toContainText('Eve');
    await expect(rows.nth(2).locator('.lb-col-condition')).toHaveText('Extreme · 4 Colors · Kimaris');

    // 단독 룰은 색 수를 모두 합친다.
    await page.locator('[data-node-id="continuous_fever"]').click();
    await expect(page.locator('.lb-title')).toHaveText('Combined ranking');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText('Carol');
    await expect(rows.nth(0).locator('.lb-col-condition')).toHaveText('5 Colors');

    // 기록이 하나도 없는 룰은 빈 목록 안내를 보여 준다.
    await page.locator('[data-node-id="practice"]').click();
    await expect(page.locator('.lb-empty')).toHaveText('No records yet.');

    // 끝 항목 순위표에는 조건 칸이 붙지 않는다.
    await page.locator('[data-node-id="standard/normal"]').click();
    await page.locator('[data-node-id="standard/normal/4"]').click();
    await page.locator('[data-node-id="standard/normal/4/Kimaris"]').click();
    await expect(page.locator('.lb-table thead')).not.toContainText('Conditions');
    await expect(page.locator('.lb-col-condition')).toHaveCount(0);
  });

  test('자식이 있는 중간 단계 메뉴도 그 아래를 합친 통합 순위를 보여 준다', async ({ page }) => {
    await page.goto(LEADERBOARD_PAGE);

    // AI 난이도 단계: 그 난이도의 색 수·적을 모두 합친다. 조건 칸에는 고른 난이도를 빼고 그 아래만 적는다.
    await page.locator('[data-node-id="standard/normal"]').click();
    await expect(page.locator('.lb-breadcrumb')).toHaveText('Standard Rules › Normal');
    await expect(page.locator('.lb-title')).toHaveText('Combined ranking');
    const rows = page.locator('.lb-table tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Alice');
    await expect(rows.nth(0).locator('.lb-col-condition')).toHaveText('4 Colors · Kimaris');
    await expect(rows.nth(1)).toContainText('<b>Bob</b>');
    // 다른 난이도의 기록은 섞이지 않는다.
    await expect(page.locator('.lb-table tbody')).not.toContainText('Eve');

    // 색 수 단계: 그 색 수의 적을 모두 합치고, 조건 칸에는 적만 남는다.
    await page.locator('[data-node-id="standard/normal/4"]').click();
    await expect(page.locator('.lb-breadcrumb')).toHaveText('Standard Rules › Normal › 4 Colors');
    await expect(page.locator('.lb-title')).toHaveText('Combined ranking');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('.lb-col-condition')).toHaveText('Kimaris');

    // 아래에 기록이 하나도 없는 중간 단계는 빈 목록 안내를 보여 준다.
    await page.locator('[data-node-id="standard/easy"]').click();
    await expect(page.locator('.lb-empty')).toHaveText('No records yet.');

    // 끝 항목은 예전처럼 자기 이름이 제목이고 조건 칸이 없다.
    await page.locator('[data-node-id="standard/normal/4/Kimaris"]').click();
    await expect(page.locator('.lb-title')).toHaveText('Kimaris');
    await expect(page.locator('.lb-col-condition')).toHaveCount(0);
  });

  test('통합 순위의 문구와 조건 이름도 선택한 언어를 따른다', async ({ page }) => {
    await page.goto(LEADERBOARD_PAGE);
    await page.locator('#lb_language_select').selectOption('ko');
    await page.locator('[data-node-id="standard"]').click();
    await expect(page.locator('.lb-breadcrumb')).toHaveText('기본 룰');
    await expect(page.locator('.lb-title')).toHaveText('통합 순위');
    await expect(page.locator('.lb-table thead')).toContainText('조건');
    await expect(page.locator('.lb-table tbody tr').nth(0).locator('.lb-col-condition')).toHaveText('보통 · 4색 · 키마리스');
  });

  test('트리 메뉴는 키보드로 펼치고 이동할 수 있다', async ({ page }) => {
    await page.goto(LEADERBOARD_PAGE);
    await page.locator('[data-node-id="standard"]').focus();
    await expect(page.locator('[data-node-id="standard"]')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-node-id="standard"]')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-node-id="standard/easy"]')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-node-id="standard/normal"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.lb-breadcrumb')).toHaveText('Standard Rules › Normal');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-node-id="standard/normal/3"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-node-id="standard/normal/3/Andromalius"]')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-node-id="standard/normal/3"]')).toBeFocused();
  });

  test('시스템 화면 모드를 따르고 사이드바 하단 토글로 바꾼다', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(LEADERBOARD_PAGE);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const toggle = page.locator('.lb-theme-toggle');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('언어 선택으로 문구와 게임 이름 번역을 함께 바꾼다', async ({ page }) => {
    await page.goto(LEADERBOARD_PAGE);
    await page.locator('#lb_language_select').selectOption('ko');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(page.locator('.lb-brand-title')).toHaveText('리더보드');
    await expect(page.locator('[data-node-id="standard"] .lb-node-label')).toHaveText('기본 룰');
    await page.locator('#lb_language_select').selectOption('de');
    await expect(page.locator('.lb-brand-title')).toHaveText('Bestenliste');
    // 게임 번역표에 독일어 적 이름이 없으면 영어 이름을 쓴다.
    await expect(page.locator('[data-node-id="standard/extreme"] .lb-node-label')).toHaveText('Extrem');
    await page.locator('[data-node-id="standard/normal"]').click();
    await page.locator('[data-node-id="standard/normal/4"]').click();
    await expect(page.locator('[data-node-id="standard/normal/4/Kimaris"] .lb-node-label')).toHaveText('Kimaris');
  });

  test('좁은 화면에서는 메뉴 버튼으로 서랍 사이드바를 연다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(LEADERBOARD_PAGE);
    const sidebar = page.locator('.lb-sidebar');
    await expect.poll(async () => (await sidebar.boundingBox()).x).toBeLessThan(0);
    await page.locator('.lb-menu-button').click();
    await expect.poll(async () => (await sidebar.boundingBox()).x).toBe(0);
    await page.locator('[data-node-id="standard/normal"]').click();
    await page.locator('[data-node-id="standard/normal/4"]').click();
    await page.locator('[data-node-id="standard/normal/4/Kimaris"]').click();
    await expect.poll(async () => (await sidebar.boundingBox()).x).toBeLessThan(0);
    await expect(page.locator('.lb-table tbody tr')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // 서랍 안의 제목을 누르면 서랍을 닫고 전체 순위를 보여 준다.
    await page.locator('.lb-menu-button').click();
    await expect.poll(async () => (await sidebar.boundingBox()).x).toBe(0);
    await page.locator('.lb-brand').click();
    await expect.poll(async () => (await sidebar.boundingBox()).x).toBeLessThan(0);
    await expect(page.locator('.lb-title')).toHaveText('Overall ranking');
  });

  test.describe('WebMCP', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        window.registeredWebMcpTools = [];
        Object.defineProperty(document, 'modelContext', {
          configurable: true,
          writable: true,
          value: { registerTool: (tool) => window.registeredWebMcpTools.push(tool) }
        });
      });
      await page.goto(LEADERBOARD_PAGE);
      await page.waitForFunction(() => Boolean(window.registeredWebMcpTools?.length));
    });

    /** 등록된 도구를 이름으로 불러 결과를 돌려준다. */
    function callTool(page, name, input) {
      return page.evaluate(([toolName, toolInput]) => {
        const tool = window.registeredWebMcpTools.find((entry) => entry.name === toolName);
        return tool.execute(toolInput);
      }, [name, input]);
    }

    test('리더보드 화면은 leaderboard_ 접두어 도구 세 개를 등록한다', async ({ page }) => {
      const names = await page.evaluate(() => window.registeredWebMcpTools.map((tool) => tool.name));
      expect(names).toEqual(['leaderboard_manual', 'leaderboard_records', 'leaderboard_show']);
      // 게임 본체 도구는 이 화면에서 등록되지 않는다(게임을 초기화하지 않기 때문이다).
      expect(names.every((name) => name.startsWith('leaderboard_'))).toBe(true);
    });

    test('leaderboard_records는 combine으로 화면과 같은 통합 순위를 돌려준다', async ({ page }) => {
      // rule을 주지 않으면 모든 룰을 합친 전체 순위다.
      const overall = JSON.parse(await callTool(page, 'leaderboard_records', {}));
      expect(overall.combined).toBe(true);
      expect(overall.limit).toBe(20);
      expect(overall.scope).toBeNull();
      expect(overall.entries.map((entry) => entry.nickname)).toEqual(['Alice', 'Carol', '<b>Bob</b>', 'Eve']);
      expect(overall.entries[0]).toMatchObject({ rank: 1, score: 98765, rule: 'standard', difficulty: 'normal', colors: 4, opponent: 'Kimaris' });
      expect(overall.entries[0].recordedAt).toBe('2026-09-19T03:04:00.000Z');
      // 적이 없는 단독 룰은 난이도·적이 null이다.
      expect(overall.entries[1]).toMatchObject({ rule: 'continuous_fever', difficulty: null, colors: 5, opponent: null, recordedAt: null });

      // 룰만 주면 그 룰의 통합 순위, 난이도까지 주면 그 아래만 합친다.
      const byRule = JSON.parse(await callTool(page, 'leaderboard_records', { rule: 'standard', combine: true }));
      expect(byRule.limit).toBe(10);
      expect(byRule.scope).toMatchObject({ rule: 'standard', difficulty: null, colors: null });
      expect(byRule.entries.map((entry) => entry.nickname)).toEqual(['Alice', '<b>Bob</b>', 'Eve']);
      const byDifficulty = JSON.parse(await callTool(page, 'leaderboard_records', { rule: 'standard', difficulty: 'normal', combine: true }));
      expect(byDifficulty.entries.map((entry) => entry.nickname)).toEqual(['Alice', '<b>Bob</b>']);

      // combine을 주지 않으면 예전처럼 저장 묶음을 그대로 돌려준다.
      const stored = JSON.parse(await callTool(page, 'leaderboard_records', { rule: 'continuous_fever' }));
      expect(stored.combined).toBe(false);
      expect(stored.rankings.find((ranking) => ranking.colors === 5).entries[0]).toMatchObject({ rank: 1, nickname: 'Carol' });

      // 룰 없이 하위 단계만 주면 거절한다.
      await expect(callTool(page, 'leaderboard_records', { difficulty: 'normal' })).rejects.toThrow('difficulty, colors, and opponent need a rule.');
    });

    test('leaderboard_show는 중간 단계와 전체 순위를 모두 보여 준다', async ({ page }) => {
      await callTool(page, 'leaderboard_show', { rule: 'standard', difficulty: 'normal' });
      await expect(page.locator('.lb-breadcrumb')).toHaveText('Standard Rules › Normal');
      await expect(page.locator('.lb-title')).toHaveText('Combined ranking');
      await expect(page.locator('.lb-table tbody tr')).toHaveCount(2);

      // rule을 주지 않으면 고른 항목을 지우고 처음 화면(전체 순위)으로 돌아간다.
      await callTool(page, 'leaderboard_show', {});
      await expect(page.locator('.lb-title')).toHaveText('Overall ranking');
      await expect(page.locator('.lb-table tbody tr')).toHaveCount(4);
      expect(await page.evaluate(() => window.PuyoWLeaderboard.getState().selection)).toBeNull();
    });

    test('leaderboard_manual은 전체 순위와 통합 순위를 함께 설명한다', async ({ page }) => {
      const manual = await callTool(page, 'leaderboard_manual', {});
      expect(manual).toContain('the top 20 scores across every rule');
      expect(manual).toContain('a combined ranking of the top 10 records below it');
      expect(manual).toContain('leaderboard_records');
      expect(manual).toContain('leaderboard_show');
    });
  });

  test.describe('일본어 브라우저', () => {
    test.use({ locale: 'ja-JP' });
    test('브라우저 언어를 따라 일본어로 표시한다', async ({ page }) => {
      await page.goto(LEADERBOARD_PAGE);
      await expect(page.locator('.lb-brand-title')).toHaveText('リーダーボード');
      await expect(page.locator('[data-node-id="practice"] .lb-node-label')).toHaveText('練習');
    });
  });
});
