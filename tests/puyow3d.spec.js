import { test, expect } from '@playwright/test';

// 독립 3D 버전은 철회됐다. 2D 게임 내부의 투명 3D canvas 검증은 test01.spec.js에서 수행한다.

test.skip('3D 페이지는 PuyoW3D 전역을 초기화하고 2D 게임을 시작하지 않는다', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/puyow3d.html');

  await expect.poll(() => page.evaluate(() => {
    const state = window.PuyoW3D.getState();
    return {
      initialized: state?.initialized,
      rendererReady: typeof state?.rendererReady === 'boolean',
      gameRunning: state?.game?.running,
    };
  })).toEqual({ initialized: true, rendererReady: true, gameRunning: true });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState())).toBeNull();
  await expect.poll(() => page.evaluate(() => ({
    classes: [
      window.PuyoW3D.PuyoW3DApplication,
      window.PuyoW3D.PuyoBoard3D,
      window.PuyoW3D.PuyoMesh3D,
      window.PuyoW3D.ThreeRendererAdapter,
    ].every((value) => typeof value === 'function'),
    center: window.PuyoW3D.toWorldCoordinates(640, 360),
    topLeft: window.PuyoW3D.toWorldCoordinates(0, 0),
  }))).toEqual({
    classes: true,
    center: { x: 0, y: 0 },
    topLeft: { x: -640, y: 360 },
  });
  expect(pageErrors).toEqual([]);
});

test.skip('3D URL 예약어 API는 2D와 같은 컨텍스트 경로를 지원한다', async ({ page }) => {
  await page.goto('/puyow3d.html');
  const result = await page.evaluate(() => {
    const systemCode = navigator.language.slice(0, 2).toLowerCase();
    const languageCode = ['ko', 'en', 'ja', 'zh'].includes(systemCode) ? systemCode : 'en';
    window.PuyoW3D.setURLContextPath('/tomcat-puyow/');
    return {
      contextPath: window.PuyoW3D.urlContextPath,
      url: window.PuyoW3D.convertURL('[CTX]assets/puyo_[LANG].png'),
      languageCode,
    };
  });

  expect(result.contextPath).toBe('/tomcat-puyow/');
  expect(result.url).toBe(`/tomcat-puyow/assets/puyo_${result.languageCode}.png`);
});

test.skip('3D 게임은 키보드 조작으로 활성 쌍을 보드에 고정한다', async ({ page }) => {
  await page.goto('/puyow3d.html');
  await expect.poll(() => page.evaluate(() => window.PuyoW3D.getState().game.active)).not.toBeNull();

  const beforeX = await page.evaluate(() => window.PuyoW3D.getState().game.active.x);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.PuyoW3D.getState().game.active.x)).toBe(beforeX + 1);
  await page.keyboard.press('Space');

  await expect.poll(() => page.evaluate(() => window.PuyoW3D.getState().game.board.flat().filter(Boolean).length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.PuyoW3D.getState().game.active)).not.toBeNull();
});

test.skip('3D 게임은 ESC 일시정지와 canvas 클릭 즉시 낙하를 지원한다', async ({ page }) => {
  await page.goto('/puyow3d.html');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.PuyoW3D.getState().game.paused)).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW3D.getState().game.paused)).toBe(false);
  await page.locator('#webpuyo_canvas').click({ position: { x: 640, y: 360 } });
  await expect.poll(() => page.evaluate(() => window.PuyoW3D.getState().game.board.flat().filter(Boolean).length)).toBeGreaterThan(0);
});
