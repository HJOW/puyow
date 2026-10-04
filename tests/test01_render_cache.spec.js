// 렌더링 캐시(고정 뿌요 층·적 초상화)를 쓴 화면이 매 프레임 직접 그린 화면과 같은지 실제 캔버스 픽셀로 확인한다.
import { test, expect } from '@playwright/test';
import { setupGamePage } from './common/gamepage.js';
import { readClassicScript } from './common/modulesource.js';

// 같은 게임 상태를 캐시를 끄고 켠 채 두 번 그려 비교하기 위한 접근자는 테스트 소스에만 삽입한다.
const fixture = `
window.checkRenderCache = () => {
    cancelAnimationFrame(animationFrameId);
    startGame(false);
    game.countdown = 0;
    screenMessage = null;
    gameStartFirework = null;
    // 가로·세로로 이어진 같은 색 덩어리와 방해·딱딱뿌요가 섞이도록 양쪽 보드를 채운다.
    // 필드의 절반 이상이 차면 적이 처음부터 위기 표정이 되므로 여섯 줄까지만 채운다.
    const kinds = ['red', 'green', 'yellow', 'blue', 'purple', 'garbage', HARD_GARBAGE];
    game.players.forEach((player, playerIndex) => {
        player.active = null;
        player.board = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
        for (let y = 0; y < 6; y += 1) for (let x = 0; x < COLUMNS; x += 1) {
            if ((x + y * 2 + playerIndex) % 5 === 4) continue;
            player.board[y][x] = kinds[Math.floor((x + playerIndex) / 2 + y / 2) % kinds.length];
        }
    });
    let drawImageCalls = 0;
    const originalDrawImage = context.drawImage;
    context.drawImage = function (...args) { drawImageCalls += 1; return originalDrawImage.apply(this, args); };
    const capture = (enabled) => {
        renderCacheEnabled = enabled;
        drawImageCalls = 0;
        render();
        return { pixels: context.getImageData(0, 0, canvas.width, canvas.height).data, drawImageCalls };
    };
    const compare = (direct, cached) => {
        let maxDifference = 0;
        for (let offset = 0; offset < direct.length; offset += 1) {
            const difference = Math.abs(direct[offset] - cached[offset]);
            if (difference > maxDifference) maxDifference = difference;
        }
        return maxDifference;
    };
    const step = () => {
        const direct = capture(false);
        const cached = capture(true);
        const reused = capture(true);
        return { difference: compare(direct.pixels, cached.pixels), reuseDifference: compare(cached.pixels, reused.pixels), directDraws: direct.drawImageCalls, cachedDraws: cached.drawImageCalls, portraits: enemyPortraitCache.size };
    };
    const results = { filled: step() };
    // 고정 뿌요가 사라지거나 바뀌면 미리 그려 둔 층도 다시 그려야 한다.
    game.players[0].board[0][0] = null;
    game.players[1].board[3][2] = game.players[1].board[3][2] === 'blue' ? 'red' : 'blue';
    results.changed = step();
    // 낙하 연출 중인 칸은 고정 위치에서 빠지고 보간된 위치에 따로 그려진다.
    game.players[0].board[6][1] = 'red';
    game.players[0].gravityAnimation = { elapsed: 40, duration: 100, falling: [{ x: 1, fromY: 11, toY: 6, color: 'red' }] };
    results.falling = step();
    game.players[0].gravityAnimation = null;
    // 예고된 피해가 커져 위기 표정으로 바뀌면 그 표정의 초상화를 새로 준비한다.
    game.players[1].damage = 99;
    results.crisis = step();
    // 그래픽 필터가 걸린 동안에는 도형마다 필터가 적용되어야 하므로 캐시를 쓰지 않는다.
    graphic2DFilters.push('contrast(1.2)');
    results.filterSupported = typeof context.filter !== 'undefined';
    results.filteredDraws = capture(true).drawImageCalls;
    graphic2DFilters.pop();
    if (results.filterSupported) context.filter = 'none';
    context.drawImage = originalDrawImage;
    renderCacheEnabled = true;
    return results;
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

// 오프스크린 층을 거치면 반투명 테두리 픽셀의 반올림이 조금 달라질 수 있다. 잘못된(오래된) 층을 붙이면 뿌요 한 칸이 통째로 달라져 100을 크게 넘는다.
const ROUNDING_TOLERANCE = 16;

test('렌더링 캐시를 쓴 대전 화면은 직접 그린 화면과 같고 보드·낙하·표정이 바뀌면 다시 그린다', async ({ page }) => {
  expect(source).toContain('window.checkRenderCache');
  const results = await page.evaluate(async () => {
    await document.fonts.ready;
    return window.checkRenderCache();
  });
  for (const name of ['filled', 'changed', 'falling', 'crisis']) {
    const result = results[name];
    expect(result.difference, `${name}: 직접 그린 화면과의 차이`).toBeLessThanOrEqual(ROUNDING_TOLERANCE);
    expect(result.reuseDifference, `${name}: 보관한 그림 재사용`).toBe(0);
    expect(result.directDraws, `${name}: 캐시를 끄면 옮겨 붙이지 않는다`).toBe(0);
    // 양쪽 필드의 고정 뿌요 층 두 장과 적 초상화 한 장을 옮겨 붙인다.
    expect(result.cachedDraws, `${name}: 캐시 사용`).toBe(3);
  }
  expect(results.filled.portraits).toBe(1);
  expect(results.crisis.portraits).toBe(2);
  // 캔버스 필터를 지원하지 않는 브라우저(WebKit)는 필터 자체가 걸리지 않으므로 캐시를 그대로 쓴다.
  expect(results.filteredDraws).toBe(results.filterSupported ? 0 : 3);
});
