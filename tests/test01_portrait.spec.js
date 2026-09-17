// 기본 제공 적 전체의 캔버스 초상화를 실제 브라우저에서 확인한다.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('모든 적의 세 표정은 카드·대전·갤러리 크기로 그려지고 캔버스 상태를 보존한다', async ({ page }, testInfo) => {
  // 숨김 적과 출시 예정 적도 포함하되 게임 공개 API에는 테스트용 접근자를 추가하지 않는다.
  const source = readFileSync('src/js/puyow.js', 'utf8').replace(
    '    WebPuyo = {',
    '    window.portraitTestEnemies = OPPONENTS.map((entry) => entry.createController());\n    WebPuyo = {'
  );
  await page.setContent('<html lang="ko"><body style="margin:0;background:#f6f0eb"><canvas id="portraits" width="1620" height="1120"></canvas></body></html>');
  await page.addScriptTag({ content: source });
  const result = await page.evaluate(() => {
    const expressions = ['normal', 'crisis', 'defeated'];
    const labels = ['일반', '위기', '패배'];
    const sheet = document.querySelector('#portraits').getContext('2d');
    const results = [];
    window.portraitTestEnemies.forEach((enemy, index) => {
      const variants = [];
      for (const scale of [0.14, 0.62, 0.72, 0.86, 2.8]) {
        const size = Math.ceil(200 * scale + 24);
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const context = canvas.getContext('2d');
        for (const expression of expressions) {
          context.clearRect(0, 0, size, size);
          context.fillStyle = '#123456'; context.strokeStyle = '#654321';
          context.lineWidth = 7; context.lineCap = 'square'; context.lineJoin = 'bevel';
          context.setTransform(1, 0, 0, 1, 1, 2);
          const before = [context.fillStyle, context.strokeStyle, context.lineWidth, context.lineCap, context.lineJoin, ...Array.from(context.getTransform().toFloat64Array())];
          enemy.drawPortrait(context, size / 2, size / 2, scale, expression);
          const after = [context.fillStyle, context.strokeStyle, context.lineWidth, context.lineCap, context.lineJoin, ...Array.from(context.getTransform().toFloat64Array())];
          const pixels = context.getImageData(0, 0, size, size).data;
          let painted = 0;
          let edge = 0;
          for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
              if (!pixels[(y * size + x) * 4 + 3]) continue;
              painted += 1;
              if (x === 0 || y === 0 || x === size - 1 || y === size - 1) edge += 1;
            }
          }
          variants.push({ scale, expression, painted, edge, restored: JSON.stringify(before) === JSON.stringify(after), image: canvas.toDataURL() });
          context.resetTransform();
        }
      }
      expressions.forEach((expression, column) => {
        const x = (index % 3) * 540 + column * 180;
        const y = Math.floor(index / 3) * 224;
        sheet.fillStyle = index % 2 ? '#e8eaf4' : '#f5e8e1';
        sheet.fillRect(x + 3, y + 3, 174, 218);
        enemy.drawPortrait(sheet, x + 90, y + 119, 1.12, expression);
        sheet.fillStyle = '#343047'; sheet.textAlign = 'center'; sheet.font = 'bold 14px sans-serif';
        sheet.fillText(enemy.getName(), x + 90, y + 22);
        sheet.font = '12px sans-serif'; sheet.fillText(labels[column], x + 90, y + 212);
      });
      results.push({ type: enemy.getClassType(), variants });
    });
    return results;
  });
  expect(result.map(({ type }) => type).sort()).toEqual([
    'Solomon', 'Andromalius', 'Dantalion', 'Seere', 'Decarabia', 'Belial', 'Amdusias',
    'Kimaris', 'Andrealphus', 'Flauros', 'Andras', 'Valak', 'Zagan', 'Vapula', 'Oriax',
  ].sort());
  for (const enemy of result) {
    for (const variant of enemy.variants) {
      expect(variant.painted, `${enemy.type} ${variant.scale} ${variant.expression}`).toBeGreaterThan(40);
      expect(variant.edge, `${enemy.type} 가장자리 잘림`).toBe(0);
      expect(variant.restored, `${enemy.type} 컨텍스트 복원`).toBe(true);
    }
    for (const scale of [0.14, 0.62, 0.72, 0.86, 2.8]) {
      expect(new Set(enemy.variants.filter((variant) => variant.scale === scale).map((variant) => variant.image)).size, `${enemy.type} 표정 구분`).toBe(3);
    }
  }
  expect(new Set(result.map((enemy) => enemy.variants.find((variant) => variant.scale === 0.86 && variant.expression === 'normal').image)).size).toBe(result.length);
  await page.locator('#portraits').screenshot({ path: testInfo.outputPath('enemy-portraits.png') });
});
