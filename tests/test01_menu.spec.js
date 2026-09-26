// 메뉴·설정·갤러리와 입력 수단의 회귀 테스트다. 타이틀 메뉴 이동, 설정 화면의 값 저장,
// 카드와 GOLD, 가상 컨트롤러·조이스틱·게임패드, 화면 회전, 플레이 방법 시연을 다룬다.
// AI 제공자·학습 설정은 test03_ai.spec.js에 있다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, openSettings, startPracticeWithVirtualController, submitTextDialog, cancelTextDialog } from './common/gamepage.js';

setupGamePage();

test('갤러리 일반뿌요 목록에 철구뿌요를 처음부터 잠금 해제 상태로 표시한다', async ({ page }) => {
  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('gallery');

  for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('철구뿌요'))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => ['잠김', 'Locked', 'ロック中', '已锁定'].includes(text)))).toBe(false);
});

test('갤러리 적 목록에는 출시 적과 발람·푸르카스 출시 예정 적이 모두 등록된다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_gallery', JSON.stringify({ warning: [], enemies: ['Andras', 'Valak', 'Zagan', 'Vapula', 'Oriax', 'Amii', 'Ose', 'Gremory', 'Orobas', 'Murmur', 'Caim', 'Alokes', 'Balaam', 'Purkas'] }));
  });
  await page.reload();
  await page.evaluate(() => {
    window.newEnemyGalleryDraws = { Andras: 0, Valak: 0, Zagan: 0, Vapula: 0, Oriax: 0, Amii: 0, Ose: 0, Gremory: 0, Orobas: 0, Murmur: 0, Caim: 0, Alokes: 0, Balaam: 0, Purkas: 0 };
    ['Andras', 'Valak', 'Zagan', 'Vapula', 'Oriax', 'Amii', 'Ose', 'Gremory', 'Orobas', 'Murmur', 'Caim', 'Alokes', 'Balaam', 'Purkas'].forEach((classType) => {
      const prototype = window.WebPuyo[classType].prototype;
      const original = prototype.drawPortrait;
      prototype.drawPortrait = function (...args) {
        window.newEnemyGalleryDraws[classType] += 1;
        return original.apply(this, args);
      };
    });
  });
  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  // 최초 공개 적 다음부터 저장 기록으로 열린 적들을 차례로 선택해 초상화까지 확인한다.
  for (const classType of ['Andras', 'Valak', 'Zagan', 'Vapula', 'Oriax', 'Amii', 'Ose', 'Gremory', 'Orobas', 'Murmur', 'Caim', 'Alokes', 'Balaam', 'Purkas']) {
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate((name) => window.newEnemyGalleryDraws[name], classType)).toBeGreaterThan(0);
  }
  await expect.poll(() => page.evaluate(() => Object.fromEntries(Object.entries(window.newEnemyGalleryDraws).map(([name, count]) => [name, count > 0])))).toEqual({ Andras: true, Valak: true, Zagan: true, Vapula: true, Oriax: true, Amii: true, Ose: true, Gremory: true, Orobas: true, Murmur: true, Caim: true, Alokes: true, Balaam: true, Purkas: true });
});

test('출시된 적 카드는 유효하지만 출시 예정 적 2종의 카드는 제외한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_cards', JSON.stringify([
      { id: 'andras-card', type: 'enemy:Andras' },
      { id: 'valak-card', type: 'enemy:Valak' },
      { id: 'zagan-card', type: 'enemy:Zagan' },
      { id: 'vapula-card', type: 'enemy:Vapula' },
      { id: 'oriax-card', type: 'enemy:Oriax' },
      { id: 'amii-card', type: 'enemy:Amii' },
      { id: 'ose-card', type: 'enemy:Ose' },
      { id: 'gremory-card', type: 'enemy:Gremory' },
      { id: 'orobas-card', type: 'enemy:Orobas' },
      { id: 'murmur-card', type: 'enemy:Murmur' },
      { id: 'caim-card', type: 'enemy:Caim' },
      { id: 'alokes-card', type: 'enemy:Alokes' },
      { id: 'balaam-card', type: 'enemy:Balaam' },
      { id: 'purkas-card', type: 'enemy:Purkas' }
    ]));
  });
  await page.reload();
  await page.evaluate(() => {
    window.newEnemyCardDraws = { Andras: 0, Valak: 0, Zagan: 0, Vapula: 0, Oriax: 0, Amii: 0, Ose: 0, Gremory: 0, Orobas: 0, Murmur: 0, Caim: 0, Alokes: 0, Balaam: 0, Purkas: 0 };
    ['Andras', 'Valak', 'Zagan', 'Vapula', 'Oriax', 'Amii', 'Ose', 'Gremory', 'Orobas', 'Murmur', 'Caim', 'Alokes', 'Balaam', 'Purkas'].forEach((classType) => {
      const prototype = window.WebPuyo[classType].prototype;
      const original = prototype.drawPortrait;
      prototype.drawPortrait = function (...args) {
        window.newEnemyCardDraws[classType] += 1;
        return original.apply(this, args);
      };
    });
  });
  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowRight');
  // 새로 출시된 적도 카드 목록에서 유효하게 그려진다.
  await expect.poll(() => page.evaluate(() => ['Andras', 'Valak', 'Zagan', 'Vapula', 'Oriax', 'Amii', 'Ose', 'Gremory', 'Orobas', 'Murmur', 'Caim', 'Alokes'].every((type) => window.newEnemyCardDraws[type] > 0))).toBe(true);
  expect(await page.evaluate(() => ['Balaam', 'Purkas'].every((type) => window.newEnemyCardDraws[type] === 0))).toBe(true);
});

test('출시 예정 적은 회색 카드로 표시되고 코드·키보드·마우스로도 선택되지 않는다', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('puyow_code', JSON.stringify(['observation'])));
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  // 마지막 출시 적은 알로케스이며 그 뒤 두 적은 선택할 수 없다.
  for (let index = 0; index < 20; index += 1) await page.keyboard.press('ArrowRight');
  const selectedName = () => page.evaluate(() => window.testCanvasTextCalls.filter((call) => call.y === 450).at(-1)?.text);
  const alokesName = await page.evaluate(() => window.WebPuyo.translate('알로케스'));
  await expect.poll(selectedName).toBe(alokesName);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes(window.WebPuyo.translate('발람')))).toBe(true);
  // 화면 안에 보이는 발람·푸르카스의 회색 카드를 클릭해도 선택이 바뀌지 않는다.
  for (const x of [820, 1000]) {
    await page.locator('[data-puyow-canvas="2d"]').click({ position: { x, y: 505 } });
    await expect.poll(selectedName).toBe(alokesName);
  }
  await page.evaluate(() => { window.testCanvasTextCalls = []; });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 820, y: 505 } });
  await expect.poll(selectedName).toBe(alokesName);
  await page.evaluate(() => { window.testCanvasTextCalls = []; });
  await page.keyboard.press('ArrowRight');
  // 출시 예정 발람는 이동 대상이 아니므로 마지막 출시 적에서 더 이동하지 않는다.
  await expect.poll(selectedName).toBe(alokesName);
  expect(await page.evaluate(() => window.WebPuyo.getGameState())).toBe(null);
});

test('테서렉트·펜터렉트·헥사액트 예고뿌요는 갤러리와 카드에 각자 단위로 나타난다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_gallery', JSON.stringify({ warning: ['tesseract', 'penteract', 'hexaact'], enemies: [] }));
    localStorage.setItem('puyow_cards', JSON.stringify([
      { id: 'tesseract-card', type: 'warning:3000000' },
      { id: 'penteract-card', type: 'warning:20000000' },
      { id: 'hexaact-card', type: 'warning:140000000' }
    ]));
  });
  await page.reload();
  await page.evaluate(() => {
    window.hypercubeDraws = { tesseract: 0, penteract: 0, hexaact: 0 };
    [['TesseractWarningPuyo', 'tesseract'], ['PenteractWarningPuyo', 'penteract'], ['HexaactWarningPuyo', 'hexaact']].forEach(([className, key]) => {
      const prototype = window.WebPuyo[className].prototype;
      const original = prototype.draw;
      prototype.draw = function (...args) {
        window.hypercubeDraws[key] += 1;
        return original.apply(this, args);
      };
    });
  });
  // 큰 단위부터 공격량을 가져가므로 헥사액트 → 펜터렉트 → 테서렉트 → 빅뱅 순으로 남은 만큼을 채운다.
  expect(await page.evaluate(() => window.WebPuyo.common.warningUnits(163500000).map((unit) => unit.type))).toEqual(['hexaact', 'penteract', 'tesseract', 'big-bang']);

  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('gallery');

  // 예고뿌요 목록은 단위 오름차순이고 처음부터 해금된 작은 예고뿌요에서 시작한다.
  // 첫 아래 키가 목록으로 포커스를 옮기고, 그다음부터는 잠긴 항목을 건너뛰며 해금한 둘을 차례로 지난다.
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes(window.WebPuyo.translate('테서렉트')))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.hypercubeDraws.tesseract)).toBeGreaterThan(0);

  await page.evaluate(() => { window.hypercubeDraws.penteract = 0; });
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes(window.WebPuyo.translate('펜터렉트')))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.hypercubeDraws.penteract)).toBeGreaterThan(0);

  await page.evaluate(() => { window.hypercubeDraws.hexaact = 0; });
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes(window.WebPuyo.translate('헥사액트')))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.hypercubeDraws.hexaact)).toBeGreaterThan(0);

  // 카드 목록에서도 같은 그림을 쓴다.
  for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowRight');
  await page.evaluate(() => { window.hypercubeDraws = { tesseract: 0, penteract: 0, hexaact: 0 }; });
  await expect.poll(() => page.evaluate(() => Object.values(window.hypercubeDraws).every((count) => count > 0))).toBe(true);
});

test('카드 뽑기는 확인 전에는 자원을 쓰지 않고 취소하거나 확인할 수 있으며 등급 문구를 표시하지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], gold: 10000 }));
  });
  await page.reload();
  await page.evaluate(() => { Math.random = () => 0; });
  await enterMainMenu(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('10,000 GOLD'))).toBe(true);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '1장 뽑기를 진행할까요?', 'Draw 1 card?', 'カードを1枚引きますか？', '要抽1张卡牌吗？', '1 Karte ziehen?', 'Tirer 1 carte ?'
  ].includes(text)))).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).gold)).toBe(10000);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards') || '[]').length)).toBe(0);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).gold)).toBe(10000);
  await page.keyboard.press('Enter');
  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 550, y: 459 } });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards'))?.length)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).gold)).toBe(9000);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards'))[0].type)).toBe('puyo:red');
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'].includes(text)))).toBe(false);
});

test('카드 5장을 선택해 합성하면 원본을 제거하고 새 카드 1장을 저장한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], gold: 0 }));
    localStorage.setItem('puyow_cards', JSON.stringify(Array.from({ length: 5 }, (_, index) => ({ id: `owned-${index}`, type: 'puyo:blue' }))));
  });
  await page.reload();
  await page.evaluate(() => { Math.random = () => 0; });
  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Enter');
    if (index < 4) await page.keyboard.press('ArrowRight');
  }
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards')).length)).toBe(5);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '선택한 카드 5장을 합성할까요?', 'Synthesize the 5 selected cards?', '選択したカード5枚を合成しますか？', '要合成所选的5张卡牌吗？', 'Die 5 ausgewählten Karten kombinieren?', 'Fusionner les 5 cartes sélectionnées ?'
  ].includes(text)))).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards'))?.length)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards'))[0].type)).toBe('puyo:red');
});

test.describe('카드 3D 등장 연출', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  /** 저장 상태만 준비하고 구매·합성은 실제 갤러리 입력을 통해 실행한다. */
  async function openCards(page, cards = []) {
    await page.evaluate((owned) => {
      localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], gold: 10000 }));
      localStorage.setItem('puyow_cards', JSON.stringify(owned));
    }, cards);
    await page.reload();
    await enterMainMenu(page);
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight');
  }

  /** 추첨 결과를 고정한 뒤 확인창에서 구매한다. */
  async function drawCards(page, count = 1, random = 0) {
    await page.evaluate((value) => { Math.random = () => value; }, random);
    await page.keyboard.press('ArrowDown');
    if (count === 10) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
  }

  /** 테스트에서만 매니저를 읽고 실제 GPU 렌더링·해제 시점을 관찰한다. */
  async function observeEffect(page) {
    await page.evaluate(() => {
      window.testCardEffect = PUYOW_3D_INSTANCES;
      const manager = window.testCardEffect;
      const cancel = manager.cancelReveal.bind(manager);
      manager.cancelReveal = () => {
        if (manager.active) window.testCardEffectElapsed = performance.now() - manager.reveal.started;
        cancel();
      };
    });
  }

  test('일반 카드가 실제 WebGL로 나타나고 4초 안에 자원과 입력 레이어를 복원한다', async ({ page }, testInfo) => {
    await openCards(page);
    await observeEffect(page);
    await drawCards(page);
    await expect.poll(() => page.evaluate(() => window.testCardEffect.active)).toBe(true);
    await page.waitForTimeout(800);
    const rendered = await page.evaluate(() => {
      const manager = window.testCardEffect;
      manager.update(performance.now());
      const gl = manager.renderer.getContext();
      const pixel = new Uint8Array(4);
      gl.readPixels(gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return { alpha: pixel[3], draws: manager.renderer.info.render.calls, level: manager.reveal.cards[0].level };
    });
    expect(rendered.alpha).toBeGreaterThan(0);
    expect(rendered.draws).toBeGreaterThan(3);
    expect(rendered.level).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('common-card.png') });
    await expect.poll(() => page.evaluate(() => window.testCardEffect.active), { timeout: 4000 }).toBe(false);
    expect(await page.evaluate(() => window.testCardEffectElapsed)).toBeLessThanOrEqual(4000);
    expect(await page.evaluate(() => window.testCardEffect.renderer.info.memory)).toMatchObject({ geometries: 0, textures: 0 });
    await expect(page.locator('[data-puyow-canvas="2d"]')).toHaveCSS('z-index', '2');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('main_menu');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards')).length)).toBe(1);
  });

  test('전설 10장은 강화된 효과로 함께 등장하고 세로 회전 후 클릭을 건너뛰기로만 처리한다', async ({ page }, testInfo) => {
    await openCards(page);
    await observeEffect(page);
    await drawCards(page, 10, 0.999999);
    await expect.poll(() => page.evaluate(() => window.testCardEffect.reveal?.cards.length)).toBe(10);
    const batch = await page.evaluate(() => ({
      duration: window.testCardEffect.reveal.duration,
      levels: window.testCardEffect.reveal.cards.map((item) => item.level),
      gold: JSON.parse(localStorage.getItem('puyow_store')).gold,
      count: JSON.parse(localStorage.getItem('puyow_cards')).length,
      particles: window.testCardEffect.reveal.cards[0].points.geometry.attributes.position.count,
    }));
    expect(batch).toMatchObject({ levels: Array(10).fill(4), gold: 1000, count: 10 });
    expect(batch.duration).toBeLessThanOrEqual(4000);
    expect(batch.particles).toBeGreaterThan(24);
    await page.waitForTimeout(750);
    await page.screenshot({ path: testInfo.outputPath('legendary-ten-cards.png') });
    await page.setViewportSize({ width: 720, height: 1280 });
    const two = page.locator('[data-puyow-canvas="2d"]');
    const three = page.locator('[data-puyow-canvas="3d"]');
    expect(await three.boundingBox()).toEqual(await two.boundingBox());
    expect(await page.evaluate(() => {
      const canvas = document.querySelector('[data-puyow-canvas="3d"]');
      return { width: canvas.width, height: canvas.height, aspect: window.testCardEffect.camera.aspect };
    })).toEqual({ width: 1280, height: 720, aspect: 1280 / 720 });
    await page.screenshot({ path: testInfo.outputPath('legendary-portrait.png') });
    await two.click({ position: { x: 360, y: 640 } });
    expect(await page.evaluate(() => window.testCardEffect.active)).toBe(false);
    expect(await page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('gallery');
    // 회전된 2D 캔버스의 닫기 버튼을 실제 화면 좌표로 눌러 마우스 입력 복원을 확인한다.
    const bounds = await two.boundingBox();
    await page.mouse.click(bounds.x + bounds.width * (1 - 28 / 720), bounds.y + bounds.height * (1235 / 1280));
    await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('main_menu');
  });

  test('에픽과 전설은 서로 다른 전용 효과를 쓰고 끝나면 자원을 모두 해제한다', async ({ page }, testInfo) => {
    await openCards(page);
    await observeEffect(page);
    const rarities = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
    const result = await page.evaluate((keys) => {
      const manager = window.testCardEffect;
      const draw = () => {};
      manager.playCardReveal(keys.map((rarity) => ({ rarity, color: '#ffffff', draw })));
      const items = manager.reveal.cards;
      return {
        duration: manager.reveal.duration,
        flash: manager.reveal.flash !== null,
        levels: items.map((item) => item.level),
        accents: items.map((item) => item.accent !== null),
        shocks: items.map((item) => item.shocks.length),
        legendaryOnly: items.map((item) => item.rays !== null && item.sheen !== null && item.sparkles !== null),
      };
    }, rarities);
    expect(result).toEqual({
      duration: 4000,
      flash: true,
      levels: [0, 1, 2, 3, 4],
      accents: [false, false, false, true, true],
      shocks: [0, 0, 0, 1, 2],
      legendaryOnly: [false, false, false, false, true],
    });
    // 에픽만 있는 연출에는 전설 전용 섬광이 없어야 한다.
    const epic = await page.evaluate(() => {
      const manager = window.testCardEffect;
      manager.playCardReveal([{ rarity: 'EPIC', color: '#c9a4ef', draw: () => {} }]);
      return { duration: manager.reveal.duration, flash: manager.reveal.flash !== null };
    });
    expect(epic).toEqual({ duration: 3550, flash: false });
    await page.waitForTimeout(900);
    await page.screenshot({ path: testInfo.outputPath('epic-card.png') });
    const cleaned = await page.evaluate(() => {
      const manager = window.testCardEffect;
      manager.playCardReveal([{ rarity: 'LEGENDARY', color: '#e7be48', draw: () => {} }]);
      manager.update(manager.reveal.started + 900);
      manager.cancelReveal();
      return manager.renderer.info.memory;
    });
    expect(cleaned).toMatchObject({ geometries: 0, textures: 0 });
  });

  test('합성 결과만 연출하며 게임패드로 건너뛰어도 지급을 반복하지 않는다', async ({ page }) => {
    await openCards(page, Array.from({ length: 5 }, (_, i) => ({ id: `synthesis-${i}`, type: 'puyo:blue' })));
    await observeEffect(page);
    await page.keyboard.press('ArrowDown');
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Enter');
      if (i < 4) await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.testCardEffect.active)).toBe(false);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.testCardEffect.reveal?.cards.length)).toBe(1);
    await page.evaluate(() => window.setTestGamepad([], [0]));
    await expect.poll(() => page.evaluate(() => window.testCardEffect.active)).toBe(false);
    await page.evaluate(() => window.setTestGamepad());
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards')));
    expect(saved).toHaveLength(1);
    expect(saved[0].id).not.toContain('synthesis-');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).gold)).toBe(10000);
  });

  for (const missing of ['THREE', '효과 모듈', 'WebGL']) {
    test(`${missing} 없이도 카드 구매·저장·2D 갤러리가 동작한다`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      if (missing === 'WebGL') {
        await page.addInitScript(() => {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (type, ...args) {
            if (type.includes('webgl')) throw new Error('검증용 WebGL 초기화 실패');
            return original.call(this, type, ...args);
          };
        });
      } else {
        await page.route(missing === 'THREE' ? '**/js/three.min.js' : '**/js/puyow_3d.js', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }));
      }
      await openCards(page);
      await drawCards(page);
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_cards')).length)).toBe(1);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).gold)).toBe(9000);
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('main_menu');
      expect(errors).toEqual([]);
    });
  }

  test('프레임 지연·GPU 손실·destroy 후에도 연출을 정리하고 재초기화할 수 있다', async ({ page }) => {
    await openCards(page);
    await observeEffect(page);
    await drawCards(page, 1, 0.999999);
    await expect.poll(() => page.evaluate(() => window.testCardEffect.active)).toBe(true);
    const result = await page.evaluate(() => {
      const manager = window.testCardEffect;
      const cards = manager.reveal.cards.map((item) => item.card);
      manager.update(manager.reveal.started + 4001);
      const expired = !manager.active;
      manager.playCardReveal(cards);
      document.querySelector('[data-puyow-canvas="3d"]').dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
      const lost = !manager.active && !manager.renderer;
      window.PuyoW.destroy();
      const cleaned = manager.canvas3d === null && manager.finishTimer === null;
      window.PuyoW.initialize(document.getElementById('puyow_target'));
      const restarted = manager.playCardReveal(cards);
      // 실제 렌더러의 런타임 오류도 게임 루프 밖으로 전파하지 않는다.
      manager.renderer.render = () => { throw new Error('검증용 렌더 오류'); };
      manager.update(performance.now());
      return { expired, lost, cleaned, restarted, failed: manager.failed, active: manager.active };
    });
    expect(result).toEqual({ expired: true, lost: true, cleaned: true, restarted: true, failed: true, active: false });
    await expect(page.locator('[data-puyow-canvas="2d"]')).toHaveCSS('z-index', '2');
  });
});

test('설정의 배경음악·효과음 볼륨 값은 슬라이더 오른쪽 여백에 표시한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { musicVolume: 42, effectsVolume: 73 } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  // 빌드 번호는 작업마다 올라가므로 표시 문구를 고정하지 않고 현재 BUILDNO와 비교한다.
  await expect.poll(() => page.evaluate(() => {
    const buildText = `Build ${window.WebPuyo.BUILDNO}`;
    const values = window.testCanvasTextCalls.filter((call) => ['42', '73', buildText].includes(call.text));
      return {
      music: values.some((call) => call.text === '42' && call.x === 920 && call.y === 150),
      effects: values.some((call) => call.text === '73' && call.x === 920 && call.y === 184),
      build: values.some((call) => call.text === buildText && call.x === 10 && call.y === 710),
      };
  })).toEqual({ music: true, effects: true, build: true });
});

test('설정 언어는 여섯 선택지를 표시하고 저장한 언어로 게임 번역과 URL 언어를 적용한다', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'ja-JP' });
  });
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { playerName: 'PLAYER 1', language: 'en' } }));
  });
  await page.reload();
  expect(await page.evaluate(() => window.WebPuyo.translate('설정'))).toBe('Settings');
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => ['English', '한국어', '日本語', '中文', 'Français', 'Deutsch']
    .every((label) => window.testCanvasTexts.includes(label)))).toBe(true);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 635, y: 112 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.language)).toBe('ko');
  expect(await page.evaluate(() => window.WebPuyo.translate('설정'))).toBe('설정');

  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('puyow_store'));
    store.settings.language = 'es-MX';
    localStorage.setItem('puyow_store', JSON.stringify(store));
  });
  await page.reload();
  // 지원하지 않는 저장값은 새 저장과 같은 방식(브라우저 언어, 판별할 수 없으면 영어)으로 보정한다. 이 테스트의 브라우저 언어는 ja-JP다.
  expect(await page.evaluate(() => ({
    language: JSON.parse(localStorage.getItem('puyow_store')).settings.language,
    settings: window.WebPuyo.translate('설정'),
  }))).toEqual({ language: 'ja', settings: '設定' });
});

test('설정 하단 버튼의 마우스 클릭은 저장·취소·초기화를 각각 실행한다', async ({ page }) => {
  const setConfirmSpy = () => page.evaluate(() => {
    window.testSettingsConfirmCount = 0;
    window.confirm = () => {
      window.testSettingsConfirmCount += 1;
      return false;
    };
  });

  await openSettings(page);
  await setConfirmSpy();
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 657 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => window.testSettingsConfirmCount)).toBe(0);

  await page.reload();
  await openSettings(page);
  await setConfirmSpy();
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 657 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => window.testSettingsConfirmCount)).toBe(0);

  await page.reload();
  await openSettings(page);
  await setConfirmSpy();
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 800, y: 657 } });
  expect(await page.evaluate(() => window.testSettingsConfirmCount)).toBe(1);
  expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');
});

test('게임 화면의 CPU 적 이름은 현재 설정 언어로 표시한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { playerName: 'PLAYER 1', language: 'en' } }));
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls
    .some((call) => call.text === 'Andromalius' && call.y === 54))).toBe(true);
  // 게임 상태·리플레이·리더보드의 안정적인 이름 키는 기존 한국어 원문을 유지한다.
  expect(await page.evaluate(() => window.WebPuyo.getGameState().opponent.name)).toBe('안드로말리우스');
});

test('설정 오른쪽 아래 코드 버튼은 마우스로만 코드를 입력받고 공란은 무시한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [] }));
    localStorage.removeItem('puyow_code');
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  for (let index = 0; index < 14; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 1232, y: 692 } });
  await submitTextDialog(page, '  observation  ', false);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')))).toEqual(['observation']);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 1232, y: 692 } });
  await submitTextDialog(page, '   ', false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')))).toEqual(['observation']);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 1232, y: 692 } });
  await cancelTextDialog(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')))).toEqual(['observation']);
});

test('초기화 시 저장된 코드 배열을 불러오고 잘못된 값은 빈 배열로 보정한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [] }));
    localStorage.setItem('puyow_code', JSON.stringify(['saved-code']));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 1232, y: 692 } });
  await submitTextDialog(page, 'observation', false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')))).toEqual(['saved-code', 'observation']);

  await page.evaluate(() => localStorage.setItem('puyow_code', '{invalid-json'));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 1232, y: 692 } });
  await submitTextDialog(page, 'observation', false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_code')))).toEqual(['observation']);
});

test('observation 코드는 진행도를 바꾸지 않고 출시된 표시 적과 구경 모드를 연다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      clearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
      feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
    }));
    localStorage.setItem('puyow_code', JSON.stringify(['observation']));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  // 출시 예정 적은 observation 코드로도 열리지 않는다. 기본 제공 적이 모두 출시된 뒤에도 이 규칙을 확인하도록 임시 적을 등록한다.
  await page.evaluate(() => {
    class ObservationPlannedOnlyEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = 1000; this.notAvail = true; }
      getClassType() { return 'ObservationPlannedOnlyEnemy'; }
      getName() { return '출시 예정 유지 적'; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new ObservationPlannedOnlyEnemy() });
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => ['솔로몬', 'Solomon', 'ソロモン', '所罗门'].includes(text)))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['추후 출시예정', 'Coming soon', '近日公開予定', '即将推出'].includes(text)))).toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.name)).toBe('안드로말리우스');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.evaluate(() => {
    class ObservationHiddenEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1001; this.hidden = true; }
      getClassType() { return 'ObservationHiddenEnemy'; }
      getName() { return '구경 제외 숨김 적'; }
    }
    class ObservationPlannedEnemy extends window.WebPuyo.Enemy {
      constructor() { super(); this.sortPriority = -1000; this.notAvail = true; }
      getClassType() { return 'ObservationPlannedEnemy'; }
      getName() { return '구경 제외 출시 예정 적'; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new ObservationHiddenEnemy() });
    window.WebPuyo.registerOpponent({ createController: () => new ObservationPlannedEnemy() });
    Math.random = () => 0;
  });
  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.watch)).toBe(true);
  const names = await page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return [state.player.name, state.opponent.name];
  });
  expect(names).toEqual(['세레', '데카라비아']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).clearList)).toEqual([]);
  await page.evaluate(() => localStorage.removeItem('puyow_code'));
});

test('플레이어 이름은 설정에 저장되며 금지 문자를 거부하고 게임 화면에 적용되며 최대 10자로 제한된다', async ({ page }) => {
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('PLAYER 1'))).toBe(true);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 82 } });
  await page.keyboard.press('Control+A');
  await page.keyboard.type('BAD/NAME');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.playerName)).toBe('PLAYER 1');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes(window.WebPuyo.translate('이름에 사용할 수 없는 문자가 있습니다.')))).toBe(true);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 82 } });
  await page.keyboard.press('Control+A');
  await page.keyboard.type('ABCDEFGHIJK');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });

  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.playerName)).toBe('ABCDEFGHIJ');
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getNextPairs().player.name)).toBe('ABCDEFGHIJ');
});

test('저장된 이름이 없으면 메인 메뉴 진입 뒤 필수 입력 대화상자에서 유효한 이름을 저장해야 한다', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { playerName: '' } })));
  await page.reload();
  await page.keyboard.press('Enter');
  const promptTitle = await page.evaluate(() => window.WebPuyo.translate('이름 또는 닉네임을 입력하세요'));
  const invalidMessage = await page.evaluate(() => window.WebPuyo.translate('이름에 사용할 수 없는 문자가 있습니다.'));
  await expect.poll(() => page.evaluate((title) => window.testCanvasTexts.includes(title), promptTitle)).toBe(true);

  await page.keyboard.type('BAD/NAME');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate((message) => window.testCanvasTexts.includes(message), invalidMessage)).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.playerName)).toBe('');
  await page.reload();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate((title) => window.testCanvasTexts.includes(title), promptTitle)).toBe(true);
  await page.keyboard.press('Control+A');
  await page.keyboard.type('VALIDNAME');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.playerName)).toBe('VALIDNAME');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('together_mode_select');
});

test('사운드 데이터 URL은 최대 200자로 저장되고 초기화 시 변환된 주소에서 읽는다', async ({ page }) => {
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '사운드 데이터 URL', 'Sound data URL', 'サウンドデータURL', '声音数据 URL',
  ].includes(text)))).toBe(true);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 282 } });
  await page.keyboard.type('x'.repeat(201));
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.soundDataURL.length)).toBe(200);

  let requestedUrl = null;
  await page.route('https://sound.example/**', async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sounds: [] }) });
  });
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('puyow_store'));
    store.settings.soundDataURL = 'https://sound.example/sounds_[LANG].json';
    localStorage.setItem('puyow_store', JSON.stringify(store));
  });
  await page.reload();
  await expect.poll(() => requestedUrl).toBe('https://sound.example/sounds_en.json');
});

test('addCode의 sound 코드는 사운드 데이터 URL을 저장하고 변환된 주소를 요청한다', async ({ page }) => {
  await openSettings(page);
  let requestedUrl = null;
  await page.route('https://sound.example/**', async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });

  await page.evaluate(() => window.WebPuyo.addCode('sound:https://sound.example/code_[LANG].json'));

  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.soundDataURL))
    .toBe('https://sound.example/code_[LANG].json');
  expect(await page.evaluate(() => localStorage.getItem('puyow_code'))).toBeNull();
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('https://sound.example/code_[LANG].json'))).toBe(true);
  await expect.poll(() => requestedUrl).toBe('https://sound.example/code_en.json');
});

test('설정 텍스트 입력은 선택, 복사, 붙여넣기와 클립보드 실패 시 선택 삭제를 지원한다', async ({ page }) => {
  await page.evaluate(() => {
    window.testClipboardText = '';
    window.testClipboardShouldFail = false;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: async () => {
          if (window.testClipboardShouldFail) throw new Error('clipboard read failed');
          return window.testClipboardText;
        },
        writeText: async (text) => { window.testClipboardText = text; },
      },
    });
  });
  await openSettings(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 282 } });
  await page.keyboard.type('before');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('abcdef');

  await page.keyboard.down('Shift');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Shift');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('X');
  await page.keyboard.down('Shift');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Control+C');
  expect(await page.evaluate(() => window.testClipboardText)).toBe('def');

  await page.keyboard.press('Backspace');
  await page.evaluate(() => { window.testClipboardText = 'YZ'; });
  await page.keyboard.press('Control+V');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('abcXYZ'))).toBe(true);
  await page.keyboard.down('Shift');
  for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Shift');
  await page.evaluate(() => { window.testClipboardText = '123'; });
  await page.keyboard.press('Control+V');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('abcX123'))).toBe(true);

  await page.keyboard.down('Shift');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Shift');
  await page.evaluate(() => { window.testClipboardShouldFail = true; window.testCanvasTexts = []; });
  await page.keyboard.press('Control+V');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('abcX'))).toBe(true);
});

test('그래픽 설정은 키보드와 마우스로 저장되며 캔버스 출력 해상도와 공개 좌표 변환 API에 반영된다', async ({ page }) => {
  expect(await page.evaluate(() => ({
    canvas: [document.querySelector('[data-puyow-canvas="2d"]').width, document.querySelector('[data-puyow-canvas="2d"]').height],
    output: window.WebPuyo.getCanvasOutputSize(),
  }))).toEqual({
    canvas: [1280, 720],
    output: { graphicsQuality: 'low', width: 1280, height: 720, scaleX: 1, scaleY: 1 },
  });

  await openSettings(page);
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  // 그래픽 설정 행에서 사운드·AI 제공자 행과 체크박스 세 개를 지나 저장 버튼까지 내려간다.
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => [document.querySelector('[data-puyow-canvas="2d"]').width, document.querySelector('[data-puyow-canvas="2d"]').height])).toEqual([1920, 1080]);
  expect(await page.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem('puyow_store')).settings.graphicsQuality,
    point: window.WebPuyo.toCanvasCoordinates(640, 360),
    length: window.WebPuyo.toCanvasLength(38),
  }))).toEqual({ settings: 'medium', point: { x: 960, y: 540 }, length: 57 });

  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 895, y: 248 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  await expect.poll(() => page.evaluate(() => [document.querySelector('[data-puyow-canvas="2d"]').width, document.querySelector('[data-puyow-canvas="2d"]').height])).toEqual([3840, 2160]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.graphicsQuality)).toBe('high');
});

test('가상 컨트롤러 크기는 이전 저장값을 호환하고 키보드와 마우스로 없음·보통·크게를 선택한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { virtualController: true } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);

  // 이전 켜기(true)는 보통으로 이관되며, 키보드로 없음과 크게를 순서대로 선택할 수 있다.
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  // 가상 컨트롤러 행에서 그래픽·사운드·AI 제공자 행과 체크박스 세 개를 지나 저장 버튼까지 내려간다.
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.virtualController)).toBe('large');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 595, y: 214 } });
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.virtualController)).toBe('none');
});

test('가상 조이스틱은 누른 지점을 기준으로 드래그 방향의 방향키를 누르고 떼면 조작을 멈춘다', async ({ page }) => {
  const { point, activeX } = await startPracticeWithVirtualController(page);

  // 조작 버튼이 없는 곳을 누르면 그 지점이 이번 조이스틱의 기준점이 된다.
  const base = point(400, 300);
  const before = await activeX();
  await page.mouse.move(base.x, base.y);
  await page.mouse.down();

  // 최소 드래그 거리에 못 미치는 이동은 조작으로 인정하지 않는다.
  const tiny = point(405, 300);
  await page.mouse.move(tiny.x, tiny.y);
  expect(await activeX()).toBe(before);

  const right = point(460, 300);
  await page.mouse.move(right.x, right.y);
  expect(await activeX()).toBeGreaterThan(before);

  const movedRight = await activeX();
  const left = point(340, 300);
  await page.mouse.move(left.x, left.y);
  await expect.poll(activeX).toBeLessThan(movedRight);

  // 손가락을 떼면 기준점이 사라지고 방향키에서 손을 뗀 것으로 처리한다.
  await page.mouse.up();
  const released = await activeX();
  await page.waitForTimeout(300);
  expect(await activeX()).toBe(released);
});

test('가상 조이스틱의 대각선 드래그는 두 방향키를 함께 누른 것으로 처리한다', async ({ page }) => {
  const { point, activeX, activeY } = await startPracticeWithVirtualController(page);

  // 입력이 없을 때의 자연 낙하량을 먼저 재 둔다.
  const naturalStart = await activeY();
  await page.waitForTimeout(150);
  const naturalDrop = naturalStart - (await activeY());

  const base = point(400, 300);
  const downRight = point(460, 360);
  const startX = await activeX();
  const startY = await activeY();
  await page.mouse.move(base.x, base.y);
  await page.mouse.down();
  await page.mouse.move(downRight.x, downRight.y);
  await page.waitForTimeout(150);
  const movedX = (await activeX()) - startX;
  const droppedY = startY - (await activeY());
  await page.mouse.up();

  // 우측 아래 드래그라서 오른쪽 이동과 빠른 하강이 동시에 일어나야 한다.
  expect(movedX).toBeGreaterThan(0);
  expect(droppedY).toBeGreaterThan(naturalDrop * 2);
});

test('가상 조이스틱은 회전을 일으키지 않고 Z·X 가상 버튼만 조작 뿌요를 돌린다', async ({ page }) => {
  const { point, activeX } = await startPracticeWithVirtualController(page);
  const rotation = () => page.evaluate(() => window.WebPuyo.getGameState().player.active.rotation);

  // 회전은 우측 조작 버튼만 담당한다.
  const beforeButton = await rotation();
  const xButton = point(1170, 590);
  await page.mouse.click(xButton.x, xButton.y);
  expect(await rotation()).toBe((beforeButton + 1) % 4);

  // 위로 끄는 조작에는 대응하는 방향키가 없어 회전도 이동도 하지 않는다.
  const base = point(400, 300);
  const beforeDrag = await rotation();
  const beforeX = await activeX();
  await page.mouse.move(base.x, base.y);
  await page.mouse.down();
  const up = point(400, 240);
  await page.mouse.move(up.x, up.y);
  await page.waitForTimeout(150);
  expect(await rotation()).toBe(beforeDrag);
  expect(await activeX()).toBe(beforeX);

  // 우측 위 대각선도 회전 없이 오른쪽 이동만 한다.
  const upRight = point(460, 240);
  await page.mouse.move(upRight.x, upRight.y);
  await page.waitForTimeout(150);
  expect(await rotation()).toBe(beforeDrag);
  expect(await activeX()).toBeGreaterThan(beforeX);
  await page.mouse.up();
});

test('가상 조작 버튼은 직접 누른 경우에만 반응하고 지나가거나 끌고 들어온 포인터는 무시한다', async ({ page }) => {
  const { point, activeX } = await startPracticeWithVirtualController(page);
  const rotation = () => page.evaluate(() => window.WebPuyo.getGameState().player.active.rotation);
  const paused = () => page.evaluate(() => window.WebPuyo.getGameState().paused);
  const buttonPoints = [[1090, 590], [1170, 590], [1170, 500]].map(([x, y]) => point(x, y));

  // 누르지 않은 채 Z·X·ESC 버튼 위를 차례로 지나간다.
  const beforeHoverRotation = await rotation();
  const beforeHoverX = await activeX();
  for (const hover of buttonPoints) await page.mouse.move(hover.x, hover.y);
  await page.waitForTimeout(80);
  expect(await rotation()).toBe(beforeHoverRotation);
  expect(await activeX()).toBe(beforeHoverX);
  expect(await paused()).toBe(false);

  // 버튼 밖에서 누른 뒤 버튼 위로 끌고 들어와도 눌린 것으로 보지 않는다.
  const beforeDragRotation = await rotation();
  const outside = point(700, 300);
  await page.mouse.move(outside.x, outside.y);
  await page.mouse.down();
  for (const hover of buttonPoints) await page.mouse.move(hover.x, hover.y);
  await page.mouse.up();
  expect(await rotation()).toBe(beforeDragRotation);
  expect(await paused()).toBe(false);

  // 버튼을 직접 누르면 그대로 동작한다.
  const beforePressRotation = await rotation();
  await page.mouse.click(buttonPoints[1].x, buttonPoints[1].y);
  expect(await rotation()).toBe((beforePressRotation + 1) % 4);
});

test('가상 조이스틱은 조작 버튼 위에서는 만들어지지 않고 버튼 동작을 그대로 남긴다', async ({ page }) => {
  const { point, activeX } = await startPracticeWithVirtualController(page);

  // ESC 버튼에서 시작한 드래그는 방향 조작이 아니라 기존 버튼 동작이어야 한다.
  const escapeButton = point(1170, 500);
  const before = await activeX();
  await page.mouse.move(escapeButton.x, escapeButton.y);
  await page.mouse.down();
  await page.mouse.move(escapeButton.x + 60, escapeButton.y);
  await page.mouse.up();
  expect(await activeX()).toBe(before);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.paused)).toBe(true);
});

test('스스로 연습의 연습은 색상 수 선택으로 이어지고 ESC는 메인 메뉴로 돌아간다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 20, y: 20 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
});

test('플레이 방법 시연은 에너지 이동 초기화 오류 없이 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('tutorial_intro');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('tutorial_demo');
});

test('플레이 방법 4단계는 보라 싹쓸이 뒤 빨강 두 쌍으로 티켓 공격과 재싹쓸이를 시연한다', async ({ page }) => {
  await page.addInitScript(() => {
    let tutorialTime = performance.now();
    window.requestAnimationFrame = (callback) => window.setTimeout(() => {
      tutorialTime += 50;
      callback(tutorialTime);
    }, 4);
  });
  await page.reload();
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => {
    const nextPairs = window.WebPuyo.getNextPairs()?.player.nextPairs || [];
    window.tutorialSawTicketPairSequence ||= nextPairs[0]?.every((color) => color === 'red')
      && nextPairs[1]?.every((color) => color === 'red');
    window.tutorialEnteredStageFive ||= nextPairs[0]?.[0] === 'red' && nextPairs[0]?.[1] === 'blue';
    return {
      ticketPairSequence: window.tutorialSawTicketPairSequence,
      enteredStageFive: window.tutorialEnteredStageFive,
      nextPairs
    };
  }), { timeout: 20000, intervals: [20] }).toMatchObject({ ticketPairSequence: true, enteredStageFive: true });
});

test('플레이 방법 1단계는 지정된 뿌요 순서와 조작 시연 메시지를 사용한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '좌우, 아래 키로 뿌요를 이동시킬 수 있고, Z, X 키로 뿌요를 회전시킬 수 있어',
    'Use Left, Right, and Down to move puyos. Rotate them with Z and X.',
    '左右・下キーでぷよを動かし、Z・Xキーで回転できます。',
    '使用左右和下方向键移动噗哟，使用 Z、X 键旋转。',
  ].includes(text)))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('tutorial_demo');
  expect(await page.evaluate(() => window.WebPuyo.getNextPairs().player.nextPairs)).toEqual([
    ['yellow', 'green'],
    ['yellow', 'red'],
  ]);

  const prompts = [
    ['좌우 방향키로 뿌요 이동', 'Move puyos with Left and Right.', '左右キーでぷよを移動', '用左右方向键移动噗哟'],
    ['아래 방향키로 빨리 떨어뜨리기', 'Use Down to drop faster.', '下キーで速く落下', '用下方向键快速落下'],
    ['Z 키를 눌러 좌측으로 뿌요 회전', 'Press Z to rotate left.', 'Zキーで左回転', '按 Z 键向左旋转'],
    ['X 키를 눌러 우측으로 뿌요 회전', 'Press X to rotate right.', 'Xキーで右回転', '按 X 键向右旋转'],
  ];
  for (const prompt of prompts) {
    await expect.poll(() => page.evaluate((texts) => window.testCanvasTexts.some((text) => texts.includes(text)), prompt), { timeout: 15000 }).toBe(true);
  }
});

test('게임패드 A와 X, Y 버튼은 메뉴 확인과 취소 입력으로 동작한다', async ({ page }) => {
  // 이름이 없는 새 저장은 메인 메뉴에서 필수 이름 입력 대화상자를 띄워 다음 A 입력을 가져간다.
  // 이름을 미리 저장해 이 테스트가 확인하려는 게임패드 메뉴 입력만 검사한다.
  await page.evaluate(() => localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { playerName: 'PLAYER 1' } })));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

  await page.evaluate(() => { window.setTestGamepad(); window.testCanvasTexts = []; });
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes(window.WebPuyo.translate('기본 룰')))).toBe(true);

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [3]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [2]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

  await page.evaluate(() => { window.setTestGamepad(); window.testCanvasTexts = []; });
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [2]));
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes(window.WebPuyo.translate('기본 룰')))).toBe(true);

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [2]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
});

test('게임 시작의 두 선택지에서 바깥 클릭은 무시하고 ESC는 한 단계씩 돌아간다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 20, y: 20 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 20, y: 20 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.evaluate(() => { window.testCanvasTexts = []; });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes(window.WebPuyo.translate('도장깨기')))).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('게임 시작 첫 단계와 하위 단계의 취소 버튼을 키보드·마우스로 조작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await expect.poll(() => page.evaluate(() => {
    const labels = ['도장깨기', '트레이닝', '퍼즐뿌요', '취소'];
    return labels.every((label) => window.testCanvasTexts.includes(window.WebPuyo.translate(label)));
  })).toBe(true);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 445 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 445 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('연습·연속 피버 색상 선택 화면의 취소는 스스로 연습 선택지로 돌아간다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 474 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
});

test('첫 단계 취소에서 왼쪽 방향키를 누르면 퍼즐뿌요로 이동한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
});

test('게임 시작 첫 단계와 연습 하위 단계의 마우스 좌표로 모드를 선택한다', async ({ page }) => {
  await enterMainMenu(page);
  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await page.keyboard.press('Enter');
  await canvas.click({ position: { x: 640, y: 340 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes(window.WebPuyo.translate('연속 피버')))).toBe(true);
  await canvas.click({ position: { x: 770, y: 340 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await canvas.click({ position: { x: 900, y: 340 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('puzzle_stage_select');
});

test('게임 중 왼쪽 아래 스틱은 왼쪽 이동과 빠른 하강을 함께 처리한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);

  const initial = await page.evaluate(() => window.WebPuyo.getGameState().player.active);
  await page.evaluate(() => window.setTestGamepad([-1, 1]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState().player.active.x)).toBeLessThan(initial.x);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState().player.active.y)).toBeLessThan(initial.y);
});

test('컨트롤 전부터 누른 오른쪽 키를 뿌요 지급 직후 반영한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await page.evaluate(() => {
    window.firstControlX = null;
    const captureFirstControlFrame = () => {
      const state = window.WebPuyo.getGameState();
      if (state?.playerCanControl) window.firstControlX = state.player.active.x;
      else window.requestAnimationFrame(captureFirstControlFrame);
    };
    window.requestAnimationFrame(captureFirstControlFrame);
  });

  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.firstControlX), { timeout: 15000 }).toBe(3);

  await page.keyboard.up('ArrowRight');
});

test('게임 외와 연습 게임 배경음악은 하나만 재생되고 일시정지에 맞춰 멈춘다', async ({ page }) => {
  const languageCode = await page.evaluate(() => {
    const systemCode = navigator.language.slice(0, 2).toLowerCase();
    window.WebPuyo.setURLContextPath('/tomcat-puyow/');
    window.WebPuyo.commonSoundPool.otherBackgroundMusic = '[CTX]other_[LANG].mp3';
    window.WebPuyo.commonSoundPool.backgroundMusic = '[CTX]game_[LANG].mp3';
    return ['ko', 'en', 'ja', 'zh'].includes(systemCode) ? systemCode : 'en';
  });
  await enterMainMenu(page);
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual([`/tomcat-puyow/other_${languageCode}.mp3`]);

  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual([`/tomcat-puyow/other_${languageCode}.mp3`, `/tomcat-puyow/game_${languageCode}.mp3`]);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances[1].paused)).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances[1].paused)).toBe(false);
});

test('공통 사운드 풀은 시뮬레이터의 뿌요 착지·폭발·주문 효과음을 재생한다', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.puyoFall = 'sounds/test-puyo-fall.ogg';
    window.WebPuyo.commonSoundPool.puyoBurstCombo1 = 'sounds/test-puyo-burst.ogg';
    window.WebPuyo.commonSoundPool.spellCombo1 = 'sounds/test-player-spell.ogg';
  });
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('[data-puyow-canvas="2d"]');
  await canvas.click({ position: { x: 960, y: 440 } });
  await submitTextDialog(page, JSON.stringify({ puyos: [
    { x: 0, y: 0, color: 'red' }, { x: 0, y: 1, color: 'red' }, { x: 0, y: 2, color: 'red' }, { x: 0, y: 12, color: 'red' },
  ] }));
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(expect.arrayContaining([
    'sounds/test-puyo-fall.ogg', 'sounds/test-puyo-burst.ogg', 'sounds/test-player-spell.ogg',
  ]));
  expect(await page.evaluate(() => window.testAudioInstances.filter((audio) => audio.src === 'sounds/test-puyo-fall.ogg'))).toHaveLength(1);
});

test('세로 화면에서는 캔버스를 회전하고 클릭 좌표를 변환한다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('puyow-portrait'))).toBe(true);

  const bounds = await page.locator('[data-puyow-canvas="2d"]').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  expect(bounds.width).toBeCloseTo(375, 1);
  expect(bounds.height).toBeCloseTo(bounds.width * 16 / 9, 1);
  expect(bounds.left).toBeCloseTo(0, 1);
  // 화면에 맞춘 뒤 남는 세로 공간은 위아래로 나뉜다.
  expect(bounds.top).toBeCloseTo((667 - bounds.height) / 2, 1);

  await enterMainMenu(page);
  const logicalX = 640;
  const logicalY = 580;
  await page.mouse.click(
    bounds.left + bounds.width * (1 - logicalY / 720),
    bounds.top + bounds.height * logicalX / 1280
  );
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');

  const clickLogicalSettingsPoint = async (x, y) => page.mouse.click(
    bounds.left + bounds.width * (1 - y / 720),
    bounds.top + bounds.height * x / 1280
  );
  await clickLogicalSettingsPoint(600, 316);
  await clickLogicalSettingsPoint(700, 350);
  await page.keyboard.type('http://portrait-lm.local/');
  await page.keyboard.press('Enter');
  await clickLogicalSettingsPoint(480, 671);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings)).toMatchObject({
    aiProvider: 'LM Studio', aiApiURL: 'http://portrait-lm.local/',
  });
});

test('화면 가로방향 고정은 저장되며 세로 화면 입력도 회전하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openSettings(page);
  // 제공자를 고르지 않은 기본 설정에서는 AI 입력 세 행과 API 테스트를 건너뛰어 첫 체크박스에 닿는다.
  // 이름(0)·언어(1)·…·제공자(7) 다음이 첫 체크박스(12)이므로 8번 내려간다.
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  // 가로방향 고정 체크박스에서 리플레이·역학습 체크박스를 지나 저장 버튼까지 내려간다.
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.landscapeOrientationLocked)).toBe(true);
  expect(await page.evaluate(() => document.body.classList.contains('puyow-portrait'))).toBe(false);

  const bounds = await page.locator('[data-puyow-canvas="2d"]').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  expect(bounds.width).toBeCloseTo(375, 1);
  expect(bounds.height).toBeCloseTo(375 * 9 / 16, 1);
  expect(bounds.left).toBeCloseTo(0, 1);
  // 가로 폭에 100% 맞추고 남는 세로 공간은 위아래로 나뉜다.
  expect(bounds.top).toBeCloseTo((667 - 375 * 9 / 16) / 2, 1);

  await page.mouse.click(bounds.left + bounds.width / 2, bounds.top + bounds.height * 580 / 720);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');
});

test('변경된 사운드 데이터 URL을 저장하면 즉시 사운드 데이터를 다시 불러온다', async ({ page }) => {
  let requestedUrl = null;
  await page.route('https://sound.example/**', async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });

  await openSettings(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 282 } });
  await page.keyboard.type('https://sound.example/sounds_[LANG].json');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });

  await expect.poll(() => requestedUrl).toBe('https://sound.example/sounds_en.json');
});

test('화면 가로방향 고정 문구는 지원 언어별로 번역된다', async ({ page }) => {
  const translations = [
    ['en-US', 'Lock landscape orientation'],
    ['ja-JP', '画面を横向きに固定'],
    ['zh-CN', '锁定横屏'],
  ];

  for (const [language, translation] of translations) {
    await page.addInitScript((locale) => {
      Object.defineProperty(navigator, 'language', { configurable: true, value: locale });
    }, language);
    // 저장된 settings.language가 브라우저 언어보다 우선하므로(BUILDNO 95) 반복마다 저장값을 지운다.
    await page.evaluate(() => localStorage.removeItem('puyow_store'));
    await page.reload();
    await openSettings(page);
    await expect.poll(() => page.evaluate((text) => window.testCanvasTexts.includes(text), translation)).toBe(true);
  }
});
