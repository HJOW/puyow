import { test, expect } from '@playwright/test';

test('3D 페이지는 PuyoW3D 전역을 초기화하고 2D 게임을 시작하지 않는다', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/puyow3d.html');

  await expect.poll(() => page.evaluate(() => window.PuyoW3D.getState())).toEqual({
    initialized: true,
    rendererReady: false,
  });
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
