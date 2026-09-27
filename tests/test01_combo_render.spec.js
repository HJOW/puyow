// 실제 캔버스 픽셀로 연쇄 문구가 필드와 에너지 효과보다 앞에 그려지는지 확인한다.
import { test, expect } from '@playwright/test';
import { setupGamePage } from './common/gamepage.js';
import { readClassicScript } from './common/modulesource.js';

// 겹침을 같은 프레임에 고정하기 위한 접근자는 테스트 소스에만 삽입한다.
const fixture = `
window.checkComboRendering = (mode) => {
    cancelAnimationFrame(animationFrameId);
    if (mode === 'simulator') {
        openSimulator();
        simulator.mode = 'simulation';
    } else if (mode === 'tutorial') {
        enterTutorialStage(1);
    } else {
        startGame(true);
        game.countdown = 0;
    }
    screenMessage = null;
    gameStartFirework = null;
    const players = game ? game.players : [simulator.player];
    const popups = [{ x: 0, y: 11, combo: 1, elapsed: 0 }, { x: 5, y: 6, combo: 12, elapsed: 0 }];
    players.forEach((player) => {
        player.active = null;
        player.board = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
        player.board[7][5] = 'purple';
        player.comboPopups = [];
    });
    // 상단·측면 베젤에 걸친 글자 바로 뒤에 실제 에너지 효과도 겹친다.
    const owner = game || simulator;
    owner.energyTransfers = players.flatMap((player) => popups.map((popup) => {
        const position = { x: player.fieldX + (popup.x + 0.5) * CELL, y: FIELD_BOTTOM - (popup.y + 1) * CELL - 10 };
        return { position, elapsed: 0, routeIndex: 0, route: [{ target: position }] };
    }));
    // 기대 화면은 전체 장면을 완성한 다음 연쇄 문구를 한 번 덧그린 결과다.
    render();
    players.forEach((player) => popups.forEach((popup) => drawComboPopup(player.fieldX, popup)));
    const expected = context.getImageData(0, 0, WIDTH, HEIGHT).data;
    players.forEach((player) => { player.comboPopups = popups; });
    render();
    const actual = context.getImageData(0, 0, WIDTH, HEIGHT).data;
    return players.flatMap((player) => popups.map((popup) => {
        const centerX = player.fieldX + (popup.x + 0.5) * CELL;
        const bottom = FIELD_BOTTOM - (popup.y + 1) * CELL;
        let different = 0;
        let textPixels = 0;
        for (let y = bottom - 32; y < bottom + 8; y += 1) {
            for (let x = centerX - 90; x < centerX + 90; x += 1) {
                const offset = (y * WIDTH + x) * 4;
                if (expected[offset] === 255 && expected[offset + 1] === 243 && expected[offset + 2] === 166) textPixels += 1;
                if ([0, 1, 2, 3].some((channel) => expected[offset + channel] !== actual[offset + channel])) different += 1;
            }
        }
        return { fieldX: player.fieldX, combo: popup.combo, different, textPixels };
    }));
};
`;
const source = readClassicScript('src/js/puyow.js').replace(
  '\nconst PuyoW = new PuyoWManager();',
  `${fixture}\nconst PuyoW = new PuyoWManager();`
);

test.beforeEach(async ({ page }) => {
  await page.route('**/bundle/puyow.bundle.js', (route) => route.fulfill({ contentType: 'text/javascript', body: source }));
});
setupGamePage();

for (const [mode, label] of [['simulator', '시뮬레이터'], ['playing', '플레이'], ['tutorial', '플레이 방법']]) {
  test(`${label}의 연쇄 문구는 뿌요·에너지·상단과 측면 베젤보다 앞에 보인다`, async ({ page }, testInfo) => {
    const results = await page.evaluate(async (mode) => {
      await document.fonts.ready;
      return window.checkComboRendering(mode);
    }, mode);
    expect(results).toHaveLength(mode === 'simulator' ? 2 : 4);
    for (const result of results) {
      expect(result.textPixels, `${result.fieldX}: ${result.combo}연쇄 표시`).toBeGreaterThan(20);
      expect(result.different, `${result.fieldX}: ${result.combo}연쇄 가림`).toBe(0);
    }
    await page.locator('[data-puyow-canvas="2d"]').screenshot({ path: testInfo.outputPath('combo-layer.png') });
  });
}
