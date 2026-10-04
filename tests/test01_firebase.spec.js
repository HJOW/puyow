// 선택적 Firebase 연동과 오류 발생 시 초기화·설정 저장·실제 승리 정산을 확인한다.
import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, openSettings, openDojoOpponentSelect } from './common/gamepage.js';
import { readClassicScript } from './common/modulesource.js';

test.beforeEach(async ({ page }) => {
  // 테스트는 실제 Firebase 프로젝트에 데이터를 보내지 않는다.
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.addInitScript(() => {
    if (!localStorage.getItem('puyow_store')) {
      localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { playerName: 'TEST_USER', language: 'ko' } }));
    }
    window.firebaseCalls = [];
    window.firebaseErrors = [];
    window.firebasePageErrors = [];
    window.firebasePerformanceReads = [];
    window.firebaseTestMode = localStorage.getItem('firebase_test_mode');
    const originalError = console.error;
    console.error = (...args) => {
      if (String(args[0]).startsWith('Firebase')) window.firebaseErrors.push(String(args[0]));
      originalError.apply(console, args);
    };
    window.addEventListener('error', (event) => window.firebasePageErrors.push(event.message));
    window.addEventListener('unhandledrejection', (event) => window.firebasePageErrors.push(String(event.reason)));
    const failIfRequested = () => {
      if (window.firebaseTestMode === 'sync') throw new Error('Firebase 동기 오류 검사');
      if (window.firebaseTestMode === 'async') return Promise.reject(new Error('Firebase 비동기 오류 검사'));
    };
    window.mockFirebaseAnalytics = {
      logEvent(name, params) {
        if (this !== window.mockFirebaseAnalytics) throw new Error('Analytics 호출 객체가 다릅니다.');
        window.firebaseCalls.push({ type: 'logEvent', name, params: { ...params } });
        // SDK가 전달받은 객체를 바꾸더라도 DOM 이벤트의 상세 정보는 보존되어야 한다.
        if (window.firebaseTestMutate && 'rule' in params) params.rule = '변조';
        return failIfRequested();
      },
      setUserId(userId) {
        if (this !== window.mockFirebaseAnalytics) throw new Error('Analytics 호출 객체가 다릅니다.');
        window.firebaseCalls.push({ type: 'setUserId', userId });
        return failIfRequested();
      },
    };
    window.mockFirebasePerformance = new Proxy({}, {
      get(target, key) {
        window.firebasePerformanceReads.push(String(key));
        throw new Error('Performance는 아직 측정하지 않아야 합니다.');
      },
    });
    window.firebase = {
      initializeApp() {},
      analytics: () => window.mockFirebaseAnalytics,
      performance: () => window.mockFirebasePerformance,
    };
  });
});

setupGamePage();

/** 설정의 이름 입력란을 실제 키보드 조작으로 편집한다. */
async function editName(page, name) {
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 82 } });
  await page.keyboard.press('Control+A');
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
}

test('HTML은 초기화 전에 연결하고 사용자 ID 설정 뒤 초기화 이벤트를 한 번 전송한다', async ({ page }) => {
  expect(await page.evaluate(() => window.firebaseCalls)).toEqual([
    { type: 'setUserId', userId: 'TEST_USER' },
    { type: 'logEvent', name: 'puyow_init', params: {} },
  ]);
  expect(await page.evaluate(() => window.PuyoW.setFirebaseServices(null, null))).toBe(false);
  expect(await page.evaluate(() => window.firebaseErrors)).toContain('Firebase 서비스 연결 중 오류가 발생했습니다.');
  await enterMainMenu(page);
  // 화면 이동과 매 프레임의 렌더링 이벤트는 Analytics로 보내지 않는다.
  expect(await page.evaluate(() => window.firebaseCalls.filter(({ type }) => type === 'logEvent'))).toHaveLength(1);
  await page.evaluate(() => {
    const root = document.getElementById('puyow_target');
    window.PuyoW.destroy();
    window.PuyoW.initialize(root);
    window.PuyoW.initialize(root);
  });
  expect(await page.evaluate(() => window.firebaseCalls.filter(({ name }) => name === 'puyow_init'))).toHaveLength(2);
  expect(await page.evaluate(() => window.firebasePerformanceReads)).toEqual([]);
  expect(await page.evaluate(() => window.firebasePageErrors)).toEqual([]);
});

test('설정에서 이름 변경을 저장할 때만 사용자 ID를 갱신하고 취소·잘못된 이름은 제외한다', async ({ page }) => {
  await openSettings(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => window.firebaseCalls.filter(({ type }) => type === 'setUserId'))).toHaveLength(1);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('settings');
  await editName(page, 'CANCELLED');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  expect(await page.evaluate(() => window.firebaseCalls.filter(({ type }) => type === 'setUserId'))).toHaveLength(1);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('settings');
  await editName(page, 'BAD/NAME');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('settings');
  expect(await page.evaluate(() => window.firebaseCalls.filter(({ type }) => type === 'setUserId'))).toHaveLength(1);
  await editName(page, 'NEW_USER');
  // 사용자 ID 전송에 실패해도 이름 저장과 화면 이동은 완료되어야 한다.
  await page.evaluate(() => { window.firebaseTestMode = 'sync'; });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.playerName)).toBe('NEW_USER');
  expect(await page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => window.firebaseCalls.filter(({ type }) => type === 'setUserId'))).toEqual([
    { type: 'setUserId', userId: 'TEST_USER' }, { type: 'setUserId', userId: 'NEW_USER' },
  ]);
  expect(await page.evaluate(() => window.firebaseErrors)).toContain('Firebase Analytics setUserId 호출 중 오류가 발생했습니다.');
  expect(await page.evaluate(() => window.firebasePageErrors)).toEqual([]);
});

test('최초 이름 입력을 완료하면 초기 기본 이름 대신 입력한 이름으로 사용자 ID를 갱신한다', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { playerName: '', language: 'ko' } })));
  await page.reload();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('이름 또는 닉네임을 입력하세요'))).toBe(true);
  await page.keyboard.type('FIRST_USER');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.firebaseCalls.filter(({ type }) => type === 'setUserId'))).toEqual([
    { type: 'setUserId', userId: 'PLAYER 1' }, { type: 'setUserId', userId: 'FIRST_USER' },
  ]);
});

test('잘못된 서비스 객체와 접근자 오류는 기존 연결을 보존하고 Performance만 연결해도 게임이 동작한다', async ({ page }) => {
  const results = await page.evaluate(() => {
    const api = window.PuyoW;
    api.destroy();
    const { setFirebaseServices } = new api.PuyoWManager();
    const faulty = { get logEvent() { throw new Error('서비스 접근자 오류 검사'); } };
    const invalidResults = [setFirebaseServices(42), setFirebaseServices({}), setFirebaseServices(faulty), setFirebaseServices(window.mockFirebaseAnalytics, 42)];
    api.initialize('puyow_target');
    return invalidResults;
  });
  expect(results).toEqual([false, false, false, false]);
  expect(await page.evaluate(() => window.firebaseCalls.filter(({ name }) => name === 'puyow_init'))).toHaveLength(2);
  await page.evaluate(() => {
    window.PuyoW.destroy();
    window.performanceOnlyResult = window.PuyoW.setFirebaseServices(null, window.mockFirebasePerformance);
    window.PuyoW.initialize('puyow_target');
  });
  expect(await page.evaluate(() => window.performanceOnlyResult)).toBe(true);
  await enterMainMenu(page);
  expect(await page.evaluate(() => window.firebaseCalls.filter(({ name }) => name === 'puyow_init'))).toHaveLength(2);
  expect(await page.evaluate(() => window.firebasePerformanceReads)).toEqual([]);
  expect(await page.evaluate(() => window.firebasePageErrors)).toEqual([]);
});

for (const mode of ['정상', 'sync', 'async']) {
  test(`실제 해금·승리 이벤트를 전송하고 ${mode} 상태에서도 승리 기록과 DOM 이벤트를 보존한다`, async ({ page }) => {
    // 실제 패배 판정과 승리 정산 경로를 실행하기 위해 게임 상태 접근자만 테스트 응답에 삽입한다.
    const source = readClassicScript('src/js/puyow.js').replace('\nconst PuyoW = new PuyoWManager();', '\nwindow.firebaseGameFixture = () => game;\nconst PuyoW = new PuyoWManager();');
    await page.route('**/bundle/puyow.bundle.js', (route) => route.fulfill({ contentType: 'text/javascript', body: source }));
    await page.evaluate((mode) => localStorage.setItem('firebase_test_mode', mode), mode);
    await page.reload();
    await page.evaluate(() => { window.firebaseTestMutate = true; });
    await enterMainMenu(page);
    await openDojoOpponentSelect(page);
    for (let index = 0; index < 4; index += 1) await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.PuyoW.getGameState()?.playerCanControl)).toBe(true);
    await page.evaluate(() => {
      const match = window.firebaseGameFixture();
      match.players[0].point = 10000;
      const opponent = match.players[1];
      opponent.active = null;
      opponent.board[11][2] = 'garbage';
      opponent.phase = 'check';
      opponent.phaseTimer = 200;
    });
    await expect.poll(() => page.evaluate(() => window.PuyoW.getScreenState().screen)).toBe('game_over');
    const report = await page.evaluate(() => ({
      events: window.firebaseCalls.filter(({ type }) => type === 'logEvent').map(({ name, params }) => ({ type: name, detail: params })),
      dom: window.puyowCustomEvents.filter(({ type }) => ['puyow_init', 'puyow_unlocked', 'puyow_win'].includes(type)),
      saved: JSON.parse(localStorage.getItem('puyow_store')),
      errors: window.firebaseErrors,
      pageErrors: window.firebasePageErrors,
      performanceReads: window.firebasePerformanceReads,
    }));
    expect(report.events).toEqual(report.dom);
    expect(report.events.filter(({ type }) => type === 'puyow_unlocked').length).toBeGreaterThan(0);
    expect(report.events.filter(({ type }) => type === 'puyow_win')).toEqual([
      { type: 'puyow_win', detail: { difficulty: 'normal', colorCount: 4, rule: 'standard', enemy: 'Andromalius', elapsedMs: expect.any(Number) } },
    ]);
    expect(report.saved.clearListByDifficulty.normal).toContain('Andromalius');
    expect(report.saved.gold).toBeGreaterThan(0);
    expect(report.pageErrors).toEqual([]);
    expect(report.performanceReads).toEqual([]);
    if (mode !== '정상') {
      expect(report.errors).toContain('Firebase Analytics setUserId 호출 중 오류가 발생했습니다.');
      expect(report.errors).toContain('Firebase Analytics logEvent 호출 중 오류가 발생했습니다.');
    }
  });
}

for (const mode of ['서비스 주입 생략', 'SDK 없음']) {
  test(`${mode} 상태에서도 초기화와 게임 메뉴가 동작한다`, async ({ page }) => {
    if (mode === '서비스 주입 생략') {
      await page.route('**/puyow.html', async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, body: (await response.text()).replace('window.PuyoW.setFirebaseServices(analytics, performance);', '') });
      });
    } else {
      await page.route('https://www.gstatic.com/firebasejs/**', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.firebase = undefined;' }));
      await page.route('**/js/firebaseinit.js', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
    }
    await page.reload();
    await enterMainMenu(page);
    expect(await page.evaluate(() => window.firebaseCalls)).toEqual([]);
    expect(await page.evaluate(() => window.puyowCustomEvents.filter(({ type }) => type === 'puyow_init'))).toHaveLength(1);
    expect(await page.evaluate(() => window.firebasePageErrors)).toEqual([]);
  });
}
