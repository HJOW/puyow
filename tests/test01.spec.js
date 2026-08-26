import { test, expect } from '@playwright/test';

/** 테스트용 Gamepad API 구현을 브라우저 초기화 전에 설치한다. */
async function installMockGamepad(page) {
  await page.addInitScript(() => {
    let gamepad = null;
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => (gamepad ? [gamepad] : []),
    });
    window.setTestGamepad = (axes = [0, 0], pressedButtons = []) => {
      gamepad = {
        connected: true,
        axes,
        buttons: Array.from({ length: 16 }, (_, index) => ({
          pressed: pressedButtons.includes(index),
          value: pressedButtons.includes(index) ? 1 : 0,
        })),
      };
    };
    window.testAudioInstances = [];
    window.Audio = class TestAudio {
      constructor(src) {
        this.src = src;
        this.loop = false;
        this.volume = 1;
        this.currentTime = 0;
        this.paused = true;
        window.testAudioInstances.push(this);
      }

      play() {
        this.paused = false;
        return Promise.resolve();
      }

      pause() {
        this.paused = true;
      }
    };
    window.testCanvasTexts = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.testCanvasTexts.push(String(text));
      return originalFillText.call(this, text, ...args);
    };
  });
}

test.beforeEach(async ({ page }) => {
  await installMockGamepad(page);
  await page.goto('/webpuyo.html');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
});

async function enterMainMenu(page) {
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
}

test('초기 타이틀은 Enter 키와 클릭으로 메인 메뉴에 진입한다', async ({ page }) => {
  await enterMainMenu(page);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.locator('#webpuyo_canvas').click({ position: { x: 640, y: 360 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('메뉴에서 Z 키는 Enter 키처럼 동작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('z');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
});

test('setEnemySoundPool은 getClassType에 해당하는 새 적의 사운드 풀을 교체한다', async ({ page }) => {
  await page.evaluate(() => {
    const sounds = window.WebPuyo.createSoundPool(false);
    sounds.backgroundMusic = 'sounds/test-andromalius-bgm.ogg';
    window.WebPuyo.setEnemySoundPool('Andromalius', sounds);
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.some((audio) => (
    audio.src.endsWith('sounds/test-andromalius-bgm.ogg') && !audio.paused
  )))).toBe(true);
});

test('연속 피버 선택지는 활성 상태이며 목표 5연쇄와 60초로 피버 스테이지를 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const texts = window.testCanvasTexts;
    const localizedOptions = [
      ['기본 룰', '피버 룰', '연습', '연속 피버'],
      ['Standard Rules', 'FEVER Rules', 'Practice', 'Continuous FEVER'],
      ['基本ルール', 'FEVERルール', '練習', '連続FEVER'],
      ['基本规则', 'FEVER规则', '练习', '连续FEVER'],
    ];
    return localizedOptions.some((options) => options.every((text) => texts.includes(text)));
  })).toBe(true);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return state.continuousFever && state.fever.targetCombo === 5 && state.fever.leftTime === 60000;
  })).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 5000 }).toBe('playing');
  const feverState = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(feverState.fever.turn).toBe(1);
  expect(feverState.fever.selectedStageTarget).toBe(5);
  expect(feverState.player.board.puyos.length).toBeGreaterThan(0);
  expect(feverState.player.active.colors).toEqual(feverState.fever.stageSuppliedPair);
  expect(feverState.colors).toEqual(['red', 'green', 'yellow', 'blue', 'purple']);
  expect(await page.evaluate(() => Array.from(document.querySelector('#webpuyo_canvas').getContext('2d').getImageData(210, 120, 1, 1).data))).toEqual([232, 144, 53, 255]);
  expect(await page.evaluate(() => {
    const texts = window.testCanvasTexts;
    return [
      '목표 연쇄', 'TARGET COMBO', '目標連鎖', '目标连锁',
      '남은 시간', 'LEFT TIME', '残り時間', '剩余时间',
    ].every((label) => !texts.includes(label));
  })).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('paused');
  const pausedTime = await page.evaluate(() => window.WebPuyo.getGameState().fever.leftTime);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().fever.leftTime)).toBe(pausedTime);
});

test('피버 룰은 전용 적 선택 화면에서 4색을 골라 보라색 없이 대전으로 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('fever_opponent_select');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.feverRule).toBe(true);
  expect(state.continuousFever).toBe(false);
  expect(state.colorCount).toBe(4);
  expect(state.colors).toEqual(['red', 'green', 'yellow', 'blue']);
  expect(state.player.nextPairs.flat()).not.toContain('purple');
  expect(state.player.fever).toMatchObject({ active: false, gauge: 0, nextTime: 15, targetCombo: 5, leftTime: 0, damage: 0 });
  expect(state.opponent.fever).toMatchObject({ active: false, gauge: 0, nextTime: 15, targetCombo: 5, leftTime: 0, damage: 0 });
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
        player.board[11][2] = 'red';
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
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.winner), { timeout: 10000 }).toBe('player');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_gallery')).enemies)).toContain('FeverGalleryEnemy');
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
    const drawingContext = document.querySelector('#webpuyo_canvas').getContext('2d');
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

test('게임 규칙 선택지의 연습은 색상 수 선택으로 이어지고 취소하면 메인 메뉴로 돌아간다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  await page.keyboard.press('Enter');
  await page.locator('#webpuyo_canvas').click({ position: { x: 20, y: 20 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('연속 피버 색상 선택은 4색과 5색만 제공하고 선택한 색만 지급한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  const state = await page.evaluate(() => window.WebPuyo.getGameState());
  expect(state.continuousFever).toBe(true);
  expect(state.colorCount).toBe(4);
  expect(state.colors).toEqual(['red', 'green', 'yellow', 'blue']);
});

test('연속 피버의 중앙 정렬된 5색 버튼은 마우스로 선택할 수 있다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('practice_difficulty');

  await page.locator('#webpuyo_canvas').click({ position: { x: 700, y: 364 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');
  expect(await page.evaluate(() => window.WebPuyo.getGameState().colorCount)).toBe(5);
});

test('플레이 방법 시연은 에너지 이동 초기화 오류 없이 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('tutorial_intro');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 7000 }).toBe('tutorial_demo');
});

test('게임패드 A와 X, Y 버튼은 메뉴 확인과 취소 입력으로 동작한다', async ({ page }) => {
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [0]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');

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

  await page.evaluate(() => window.setTestGamepad());
  await page.waitForTimeout(50);
  await page.evaluate(() => window.setTestGamepad([0, 0], [2]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
});

test('게임 규칙 선택지 밖 클릭과 ESC는 메인 메뉴로 돌아간다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');

  await page.keyboard.press('Enter');
  await page.locator('#webpuyo_canvas').click({ position: { x: 20, y: 20 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
});

test('게임 중 왼쪽 아래 스틱은 왼쪽 이동과 빠른 하강을 함께 처리한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);

  const initial = await page.evaluate(() => window.WebPuyo.getGameState().player.active);
  await page.evaluate(() => window.setTestGamepad([-1, 1]));
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState().player.active.x)).toBeLessThan(initial.x);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState().player.active.y)).toBeLessThan(initial.y);
});

test('게임 외와 연습 게임 배경음악은 하나만 재생되고 일시정지에 맞춰 멈춘다', async ({ page }) => {
  await page.evaluate(() => {
    window.WebPuyo.commonSoundPool.otherBackgroundMusic = 'other.mp3';
    window.WebPuyo.commonSoundPool.backgroundMusic = 'game.mp3';
  });
  await enterMainMenu(page);
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(['other.mp3']);

  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances.map((audio) => audio.src))).toEqual(['other.mp3', 'game.mp3']);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances[1].paused)).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testAudioInstances[1].paused)).toBe(false);
});

test('새 게임의 마진 레이트는 70으로 시작한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.playerCanControl)).toBe(true);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().marginRate)).toBe(70);
});

test('시뮬레이터 연쇄는 새 점수 계산식과 같은 연쇄 문구를 표시한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('#webpuyo_canvas');
  for (const x of [207, 245, 283, 321]) {
    await canvas.click({ position: { x, y: 539 } });
  }
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => text === '1연쇄' || text === '1 Chain'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000040'))).toBe(true);
});

test('시뮬레이터 점수는 동시 폭발의 색수 보너스를 합산한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('#webpuyo_canvas');
  for (const x of [207, 245, 283, 321]) {
    await canvas.click({ position: { x, y: 539 } });
  }
  await canvas.click({ position: { x: 970, y: 200 } });
  for (const x of [207, 245, 283, 321]) {
    await canvas.click({ position: { x, y: 501 } });
  }
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000240'))).toBe(true);
});

test('시뮬레이터 점수는 다섯 뿌요 연결 보너스를 적용한다', async ({ page }) => {
  await enterMainMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('simulator_draw');

  const canvas = page.locator('#webpuyo_canvas');
  for (const x of [207, 245, 283, 321, 359]) {
    await canvas.click({ position: { x, y: 539 } });
  }
  await canvas.click({ position: { x: 960, y: 350 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('000000100'))).toBe(true);
});
