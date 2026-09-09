// AI 모델 사용과 학습에 관한 회귀 테스트다. 설정의 AI 서비스 제공자(LM Studio·Local AI),
// 솔로몬의 배치 요청과 온라인 학습 전송, "역으로 모델 학습" 설정, 그리고 브라우저 ONNX 추론 적을 다룬다.
// 이 파일만 외부 AI 서버 응답과 ONNX 런타임을 흉내 내므로, 나머지 게임 테스트와 섞지 않는다.

import { test, expect } from '@playwright/test';
import { setupGamePage, enterMainMenu, openSettings } from './common/gamepage.js';

setupGamePage();

test('설정의 AI 서비스 제공자는 LM Studio를 라디오로 표시하고 지원하지 않는 저장값은 미선택으로 되돌린다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { aiProvider: 'OpenAI' } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  // 지원을 제거한 OpenAI·Prompt API와 알 수 없는 값은 모두 아무것도 선택하지 않은 상태가 된다.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.aiProvider)).toBe('');
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('LM Studio'))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.includes('OpenAI'))).toBe(false);
  expect(await page.evaluate(() => window.testCanvasTexts.includes('Prompt API'))).toBe(false);

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 346 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.aiProvider)).toBe('LM Studio');
});

test('제공자를 고르지 않으면 AI 입력란과 API 테스트를 건너뛰고 LM Studio를 고르면 키보드로 입력해 저장한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'Prompt API', aiApiURL: 'http://kept.example/', aiApiKey: 'kept-key', aiModel: 'gpt-5.6-luna' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);

  // 제공자를 고르지 않은 상태의 URL·키·모델명 입력란은 클릭과 키 입력을 받지 않는다.
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 700, y: 390 } });
  await page.keyboard.type('blocked');
  // AI 입력 세 행과 API 테스트 버튼을 모두 건너뛰므로 제공자 행 다음 아래 이동은 첫 체크박스에 닿는다.
  // 체크박스 줄에서만 동작하는 좌우 이동으로 마지막 체크박스까지 옮겨 실제로 체크박스에 닿았음을 확인한다.
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings)).toMatchObject({
    aiProvider: '', aiApiURL: 'http://kept.example/', aiApiKey: 'kept-key', reverseLearning: true,
  });

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('http://192.168.0.5/');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings)).toMatchObject({
    aiProvider: 'LM Studio', aiApiURL: 'http://192.168.0.5/', aiApiKey: 'kept-key',
  });
});

test('Local AI를 사용할 수 있으면 기본값으로 선택되고 서버 주소·고정 키·모델명을 채운다', async ({ page }) => {
  await page.route('**/apis/localmodelinfo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) });
  });
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { aiProvider: 'OpenAI', aiApiKey: 'openai-key', aiModel: 'gpt-5.6-luna' } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  // 지원을 제거한 제공자는 미선택 상태가 되고, Local AI를 쓸 수 있으므로 그 기본값이 대신 채워진다.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings)).toMatchObject({
    aiProvider: 'Local AI', aiApiURL: 'http://localhost:9891', aiApiKey: 'localhost', aiModel: 'puyow',
  });
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Local AI'))).toBe(true);

  // 라디오 선택지 라벨은 선택지 상자 가운데에 그리므로 그려진 좌표에서 클릭 위치를 얻는다.
  const [lmStudioLabelX, localAiLabelX] = await page.evaluate(() => ['LM Studio', 'Local AI'].map((label) => {
    const call = window.testCanvasTextCalls.find((entry) => entry.text === label && entry.y === 350);
    return call ? call.x : null;
  }));
  expect(lmStudioLabelX).not.toBeNull();
  expect(localAiLabelX).not.toBeNull();

  // 다른 제공자로 옮기면 입력값을 그대로 두고, Local AI로 되돌아오면 고정값을 다시 채운다.
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: lmStudioLabelX, y: 346 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: localAiLabelX, y: 346 } });

  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings)).toMatchObject({
    aiProvider: 'Local AI', aiApiURL: 'http://localhost:9891', aiApiKey: 'localhost', aiModel: 'puyow',
  });

  // Local AI 저장은 AI API 테스트를 마친 것으로 취급하므로 솔로몬이 곧바로 나타난다.
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 270 } });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Solomon'))).toBe(true);
});

test('Local AI는 현재 서버의 Chat Completions로 AI API 테스트를 보낸다', async ({ page }) => {
  await page.route('**/apis/localmodelinfo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) });
  });
  let request = null;
  await page.route('http://localhost:9891/v1/chat/completions', async (route) => {
    request = { body: route.request().postDataJSON(), authorization: route.request().headers().authorization };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: '{"success":true}' } }] }),
    });
  });
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'Local AI', aiApiURL: 'http://localhost:9891', aiApiKey: 'localhost', aiModel: 'puyow' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Local AI'))).toBe(true);
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => request).not.toBeNull();
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('AI API test succeeded (JSON schema: passed).'))).toBe(true);
  expect(request.authorization).toBe('Bearer localhost');
  expect(request.body).toMatchObject({
    model: 'puyow',
    messages: [{ role: 'user' }],
    response_format: { type: 'json_schema', json_schema: { name: 'ai_api_test_result', strict: true } },
    stream: false,
  });
});

test('로컬 모델을 사용할 수 없으면 Local AI 선택지를 숨기고 아무것도 선택하지 않은 상태로 되돌린다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({ clearList: [], settings: { aiProvider: 'Local AI' } }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  // 사용할 수 없게 된 제공자는 다른 제공자로 옮기지 않고 미선택 상태로 되돌린다.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.aiProvider)).toBe('');
  expect(await page.evaluate(() => window.testCanvasTextCalls.some((call) => call.text === 'Local AI' && call.y === 350))).toBe(false);
  // 제공자를 고르지 않았으므로 AI API 테스트 버튼도 비활성 색으로 그린다.
  await expect.poll(() => page.evaluate(() => window.testCanvasTextCalls.some((call) => {
    // Chromium은 16진수, WebKit은 rgb()/rgba() 문자열로 fillStyle을 돌려줄 수 있다.
    const color = String(call.fillStyle).replace(/\s/g, '').toLowerCase();
    return call.y === 523 && ['#7f969e', 'rgb(127,150,158)', 'rgba(127,150,158,1)'].includes(color);
  }))).toBe(true);

  // 테스트를 통과할 방법이 없으므로 솔로몬도 적 선택 화면에 나타나지 않는다.
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 270 } });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.testCanvasTexts.includes('Solomon'))).toBe(false);
});

test('빈 사용 모델명은 기본값으로 보정되고 API 테스트 버튼은 API 키 없이는 비활성이다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'LM Studio', aiApiURL: 'http://192.168.0.5/', aiApiKey: '', aiModel: '' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await openSettings(page);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('gpt-5.6-luna'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    'AI API 테스트', 'Test AI API', 'AI APIテスト', 'AI API 测试',
  ].includes(text)))).toBe(true);

  let requestCount = 0;
  await page.route('http://192.168.0.5/v1/chat/completions', async (route) => {
    requestCount += 1;
    await route.fulfill({ status: 500 });
  });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 700, y: 518 } });
  await page.waitForTimeout(100);
  expect(requestCount).toBe(0);
});

test('AI API 테스트는 저장된 LM Studio URL과 토큰으로 Chat Completions 구조화 요청을 보낸다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'LM Studio', aiApiURL: 'http://192.168.0.5/', aiApiKey: 'lm-token', aiModel: 'local-model' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  let request = null;
  await page.route('http://192.168.0.5/v1/chat/completions', async (route) => {
    request = { body: route.request().postDataJSON(), authorization: route.request().headers().authorization };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ choices: [{ message: { content: '{"success":true}' } }] }),
    });
  });
  await openSettings(page);
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => request).not.toBeNull();
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('AI API test succeeded (JSON schema: passed).'))).toBe(true);
  expect(request.authorization).toBe('Bearer lm-token');
  expect(request.body).toMatchObject({
    model: 'local-model',
    messages: [{ role: 'user' }],
    response_format: { type: 'json_schema', json_schema: { name: 'ai_api_test_result', strict: true, schema: { required: ['success'] } } },
    max_tokens: 64,
    stream: false,
  });
  expect(request.body).not.toHaveProperty('reasoning');
});

test('솔로몬은 성공한 AI API 테스트 뒤 현재 접속에서만 안드로말리우스보다 앞에 표시된다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'LM Studio', aiApiURL: 'http://lmstudio.local/', aiApiKey: 'test-key', aiModel: 'local-model' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.route('http://lmstudio.local/v1/chat/completions', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"success":true}' } }] }) });
  });

  await openSettings(page);
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('Solomon'))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('AI API test succeeded (JSON schema: passed).'))).toBe(true);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 270 } });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await expect.poll(() => page.evaluate(() => {
    const names = window.testCanvasTextCalls.filter(({ text }) => text === 'Solomon' || text === 'Andromalius');
    const solomonX = Math.min(...names.filter(({ text }) => text === 'Solomon').map(({ x }) => x));
    const andromaliusX = Math.min(...names.filter(({ text }) => text === 'Andromalius').map(({ x }) => x));
    return Number.isFinite(solomonX) && Number.isFinite(andromaliusX) && solomonX < andromaliusX;
  })).toBe(true);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.testCanvasTexts.includes('Solomon'))).toBe(false);
});

test('솔로몬은 매 턴 저장된 서버와 토큰으로 구조화된 배치를 요청하고 X 이동 후 회전을 적용한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'LM Studio', aiApiURL: 'http://lmstudio.local/', aiApiKey: 'lm-solomon-token', aiModel: 'local-puyo-model' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  const requests = [];
  await page.route('http://lmstudio.local/v1/chat/completions', async (route) => {
    requests.push({ body: route.request().postDataJSON(), authorization: route.request().headers().authorization });
    const content = requests.length === 1 ? '{"success":true}' : '{"x":4,"rotation":1}';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });

  await openSettings(page);
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => requests.length).toBe(1);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 270 } });
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => requests.length, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.evaluate(() => {
    const active = window.WebPuyo.getGameState()?.opponent.active;
    return active ? { x: active.x, rotation: active.rotation } : null;
  }), { timeout: 15000 }).toEqual({ x: 4, rotation: 1 });

  expect(requests[1].authorization).toBe('Bearer lm-solomon-token');
  expect(requests[1].body).toMatchObject({
    model: 'local-puyo-model',
    messages: [{ role: 'user' }],
    response_format: { type: 'json_schema', json_schema: { name: 'solomon_puyo_placement', strict: true, schema: { required: ['x', 'rotation'] } } },
    max_tokens: 128,
    stream: false,
  });
  const prompt = JSON.parse(requests[1].body.messages[0].content);
  expect(prompt.rules.mode).toBe('standard rules');
  expect(prompt.currentField).toMatchObject({ columns: 6, visibleRows: 12 });
  expect(prompt.suppliedPuyos.length).toBe(3);
  expect(prompt.fallbackSafetyCondition.dangerousCells).toEqual([{ x: 2, y: 5 }]);
  expect(prompt.responseSchema.required).toEqual(['x', 'rotation']);
});

test('Local AI 극한 난이도 솔로몬 대전은 학습 세션을 보내고 대전이 끝나면 학습 적용을 요청한다', async ({ page }) => {
  await page.route('**/apis/localmodelinfo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) });
  });
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'Local AI', aiApiURL: 'http://localhost:9891', aiApiKey: 'localhost', aiModel: 'puyow', reverseLearning: true },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

  const prompts = [];
  await page.route('http://localhost:9891/v1/chat/completions', async (route) => {
    const prompt = JSON.parse(route.request().postDataJSON().messages[0].content);
    prompts.push(prompt);
    // 실제 서버와 같이 게임이 보낸 사용 가능한 배치 안에서만 고른다.
    const placements = prompt.usablePlacements;
    const content = JSON.stringify(placements[prompts.length % placements.length]);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  const learningRequests = [];
  await page.route('http://localhost:9891/apis/solomonlearning', async (route) => {
    learningRequests.push({ body: route.request().postDataJSON(), authorization: route.request().headers().authorization });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, trained: true, transitions: 3 }) });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.WebPuyo.getSelectedDifficulty().key)).toBe('extreme');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');

  await expect.poll(() => prompts.length, { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  const sessionId = prompts[0].learningSessionId;
  expect(typeof sessionId).toBe('string');
  expect(sessionId.startsWith('solomon-')).toBe(true);
  // 같은 대전의 모든 요청은 하나의 세션으로 묶여야 서버가 앞뒤 수를 이어 붙일 수 있다.
  expect(prompts.every((prompt) => prompt.learningSessionId === sessionId)).toBe(true);
  // 서버는 화면 12줄 관측값만으로 가로 이동 경로·회전 킥을 알 수 없으므로 게임이 후보를 함께 보낸다.
  expect(prompts[0].usablePlacements.length).toBeGreaterThan(0);
  expect(prompts[0].usablePlacements.every(({ x, rotation }) => (
    Number.isInteger(x) && x >= 0 && x < 6 && Number.isInteger(rotation) && rotation >= 0 && rotation < 4
  ))).toBe(true);

  // 조작 없이 계속 내리면 스폰 열이 쌓여 사용자가 먼저 패배하고 결과 화면으로 넘어간다.
  await page.keyboard.down('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 60000 }).toBe('game_over');
  await page.keyboard.up('ArrowDown');

  await expect.poll(() => learningRequests.filter(({ body }) => body.event === 'finish').length, { timeout: 15000 }).toBe(1);
  // 학습 요청은 대전 순서대로 한 줄로 보내므로 finish는 반드시 마지막이어야 한다.
  const finishRequest = learningRequests[learningRequests.length - 1];
  expect(finishRequest.authorization).toBe('Bearer localhost');
  // result는 학습 대상인 솔로몬 기준이므로, 사용자가 패배한 이번 대전은 승리로 전달된다.
  expect(finishRequest.body).toEqual({ event: 'finish', sessionId, result: 'win' });
  // 사람이 둔 수도 같은 세션으로 모아 둔다. 사람이 이긴 대전에서만 서버가 이 수를 학습에 사용한다.
  const stepRequests = learningRequests.filter(({ body }) => body.event === 'step');
  expect(stepRequests.length).toBeGreaterThan(0);
  expect(stepRequests.every(({ body }) => (
    body.sessionId === sessionId && Array.isArray(body.observation) && body.observation.length === 528
    && Number.isInteger(body.action) && body.action >= 0 && body.action < 24
  ))).toBe(true);
  // 후보 안에서 고른 배치는 항상 사용할 수 있어야 하므로 배치 검증 오류가 나면 안 된다.
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => [
    '솔로몬 AI 응답 오류: 대체 인공지능으로 진행합니다.',
    'Solomon AI response error: continuing with the fallback AI.',
  ].includes(text)))).toBe(false);
});

test('역으로 모델 학습이 꺼져 있으면 대전이 끝나도 솔로몬 학습 서버를 호출하지 않는다', async ({ page }) => {
  await page.route('**/apis/localmodelinfo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) });
  });
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      // reverseLearning을 저장하지 않은 기존 저장은 꺼짐으로 보정된다.
      settings: { aiProvider: 'Local AI', aiApiURL: 'http://localhost:9891', aiApiKey: 'localhost', aiModel: 'puyow' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

  const prompts = [];
  await page.route('http://localhost:9891/v1/chat/completions', async (route) => {
    const prompt = JSON.parse(route.request().postDataJSON().messages[0].content);
    prompts.push(prompt);
    const placements = prompt.usablePlacements;
    const content = JSON.stringify(placements[prompts.length % placements.length]);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  const learningRequests = [];
  await page.route('http://localhost:9891/apis/solomonlearning', async (route) => {
    learningRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, trained: true, transitions: 3 }) });
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');

  // 조작 없이 계속 내리면 스폰 열이 쌓여 사용자가 먼저 패배하고 대전이 끝까지 진행된다.
  await page.keyboard.down('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 60000 }).toBe('game_over');
  await page.keyboard.up('ArrowDown');

  // `역으로 모델 학습`이 꺼져 있으면 솔로몬 자신의 수를 포함해 이 기능 전체가 대상에서 빠져야 하므로,
  // 배치 프롬프트에 학습 세션 ID가 실리지 않고, 대전이 끝나도 /apis/solomonlearning이 호출되지 않는다.
  expect(prompts.length).toBeGreaterThan(0);
  expect(prompts.every((prompt) => prompt.learningSessionId === undefined)).toBe(true);
  expect(learningRequests).toEqual([]);
});

test('LM Studio 제공자와 극한이 아닌 난이도의 솔로몬 프롬프트에는 학습 세션을 넣지 않는다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'LM Studio', aiApiURL: 'http://lmstudio.local/', aiApiKey: 'lm-solomon-token', aiModel: 'local-puyo-model' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  const prompts = [];
  await page.route('http://lmstudio.local/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON();
    prompts.push(body.messages[0].content);
    const content = prompts.length === 1 ? '{"success":true}' : '{"x":4,"rotation":1}';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });

  await openSettings(page);
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => prompts.length).toBe(1);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 270 } });
  await page.keyboard.press('Enter');
  // 극한 난이도로 시작하더라도 Local AI 제공자가 아니면 학습 세션을 만들지 않는다.
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.WebPuyo.getSelectedDifficulty().key)).toBe('extreme');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => prompts.length, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.WebPuyo.getGameState().aiDifficulty.key)).toBe('extreme');

  expect(JSON.parse(prompts[1]).learningSessionId).toBeUndefined();
  // 배치 후보 목록도 Local AI 서버 전용이므로 다른 제공자의 프롬프트에는 넣지 않는다.
  expect(JSON.parse(prompts[1]).usablePlacements).toBeUndefined();
});

test('솔로몬의 잘못된 API 배치는 게임을 일시정지하고 현재 턴을 대체 AI로 전환한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'LM Studio', aiApiURL: 'http://lmstudio.local/', aiApiKey: 'solomon-key', aiModel: 'local-puyo-model' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  let requestCount = 0;
  await page.route('http://lmstudio.local/v1/chat/completions', async (route) => {
    requestCount += 1;
    const content = requestCount === 1 ? '{"success":true}' : '{"x":99,"rotation":0}';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });

  await openSettings(page);
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => requestCount).toBe(1);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 270 } });
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 15000 }).toBe('paused');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '솔로몬 AI 응답 오류: 대체 인공지능으로 진행합니다.',
    'Solomon AI response error: continuing with the fallback AI.',
    'ソロモンAIの応答エラー：代替AIで続行します。',
    '所罗门 AI 响应错误：将使用备用 AI 继续。',
  ].includes(text)))).toBe(true);
});

test('솔로몬은 응답 대기 중 뿌요가 착지하면 해당 요청을 취소하고 다음 턴에 다시 요청한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'LM Studio', aiApiURL: 'http://lmstudio.local/', aiApiKey: 'solomon-key', aiModel: 'local-puyo-model' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await page.route('http://lmstudio.local/v1/chat/completions', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"success":true}' } }] }) });
  });
  await openSettings(page);
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.includes('AI API test succeeded (JSON schema: passed).'))).toBe(true);
  await page.unroute('http://lmstudio.local/v1/chat/completions');
  await page.evaluate(() => {
    window.testSolomonRequestCount = 0;
    window.testSolomonAbortCount = 0;
    window.testSolomonAbortReasons = [];
    window.fetch = (_url, options = {}) => {
      window.testSolomonRequestCount += 1;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          window.testSolomonAbortCount += 1;
          window.testSolomonAbortReasons.push(options.signal.reason);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    };
  });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 671 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 640, y: 270 } });
  await page.keyboard.press('Enter');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('countdown');

  // 기본 낙하 속도로는 뿌요가 바닥까지 24초쯤 걸려 6초짜리 API 타임아웃이 먼저 터진다. 경과 시간을
  // 75분으로 옮겨 낙하 속도를 최대(16배)로 만들어야 응답 대기 중 착지가 실제로 일어난다.
  const maxFallSpeedElapsed = await page.evaluate(() => {
    window.WebPuyo.setGameElapsed(75 * 60000);
    return window.WebPuyo.common.getPlayerFallSpeedMultiplier(window.WebPuyo.getGameState().elapsed);
  });
  expect(maxFallSpeedElapsed).toBe(16);

  await expect.poll(() => page.evaluate(() => window.testSolomonAbortCount), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  // 타임아웃이 아니라 뿌요 착지(contact)로 취소되어야 이 테스트가 의도한 경로를 지난 것이다.
  expect(await page.evaluate(() => window.testSolomonAbortReasons)).toContain('contact');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent.placedPairCount), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).not.toBe('paused');
  await expect.poll(() => page.evaluate(() => window.testSolomonRequestCount), { timeout: 15000 }).toBeGreaterThanOrEqual(2);
});

test('저장하지 않은 AI 설정은 API 테스트 요청 대신 저장 안내를 표시한다', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      settings: { aiProvider: 'LM Studio', aiApiURL: 'http://lmstudio.local/', aiApiKey: 'test-key', aiModel: 'local-model' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  let requestCount = 0;
  await page.route('http://lmstudio.local/v1/chat/completions', async (route) => {
    requestCount += 1;
    await route.fulfill({ status: 500 });
  });
  await openSettings(page);
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 600, y: 434 } });
  await page.keyboard.press('x');
  await page.keyboard.press('Enter');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 700, y: 518 } });
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => [
    '설정 저장 후 다시 시도해 주세요',
    'Save your settings and try again.',
    '設定を保存してから、もう一度お試しください。',
    '请先保存设置后再试。',
  ].includes(text)))).toBe(true);
  expect(requestCount).toBe(0);
});

test('역으로 모델 학습 체크박스는 키보드와 마우스로 토글되며 settings.reverseLearning으로 저장된다', async ({ page }) => {
  await openSettings(page);
  // 저장값이 없으면 꺼진 상태로 시작한다.
  expect(await page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');

  // 가로방향 고정까지 내려간 뒤 오른쪽 방향키로 리플레이 사용을 거쳐 역학습 체크박스에 닿는다.
  for (let index = 0; index < 9; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  // 체크박스 줄의 오른쪽 끝이므로 더 눌러도 저장 버튼으로 넘어가지 않는다.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('main_menu');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings)).toMatchObject({
    reverseLearning: true, useReplayFeature: false, landscapeOrientationLocked: false,
  });

  // 마우스로 같은 체크박스를 눌러 끄고 저장하면 false로 되돌아간다.
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('settings');
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 789, y: 577 } });
  await page.locator('[data-puyow-canvas="2d"]').click({ position: { x: 480, y: 671 } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puyow_store')).settings.reverseLearning)).toBe(false);
});

test('역으로 모델 학습 문구는 지원 언어별로 번역된다', async ({ page }) => {
  const translations = [
    ['en-US', 'Reverse model learning'],
    ['ja-JP', 'モデルを逆学習'],
    ['zh-CN', '反向训练模型'],
  ];

  for (const [language, translation] of translations) {
    await page.addInitScript((locale) => {
      Object.defineProperty(navigator, 'language', { configurable: true, value: locale });
    }, language);
    await page.reload();
    await openSettings(page);
    await expect.poll(() => page.evaluate((text) => window.testCanvasTexts.includes(text), translation)).toBe(true);
  }
});

/** 모든 기본 제공 적을 이긴 진행도와 플라우로스 갤러리 해금 기록을 저장한다. */
async function seedAllOpponentsCleared(page) {
  await page.evaluate(() => {
    const cleared = ['Andromalius', 'Dantalion', 'Seere', 'Decarabia', 'Belial', 'Amdusias', 'Kimaris', 'Andrealphus', 'Flauros'];
    localStorage.setItem('puyow_store', JSON.stringify({
      clearList: [],
      clearListByDifficulty: { easy: cleared, normal: cleared, hard: cleared, extreme: cleared },
      feverClearListByDifficulty: { easy: cleared, normal: cleared, hard: cleared, extreme: cleared },
    }));
    localStorage.setItem('puyow_gallery', JSON.stringify({ warning: [], enemies: ['Flauros'] }));
  });
}

test('ONNX 런타임이 없으면 플라우로스는 적 선택 화면에서 빠진다', async ({ page }) => {
  await seedAllOpponentsCleared(page);
  // ort.all.min.js를 빈 응답으로 바꿔 ONNX 런타임이 없는 페이지와 같은 상태를 만든다.
  await page.route('**/js/ort.all.min.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  expect(await page.evaluate(() => typeof window.ort)).toBe('undefined');

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  // 이전 적과 플라우로스를 모두 이긴 기록이 있어도 목록에 나오지 않는다.
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['안드레알푸스', 'Andrealphus', 'アンドレアルフス', '安德雷阿尔弗斯'].includes(text)))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => ['플라우로스', 'Flauros', 'フラウロス', '弗劳洛斯'].includes(text)))).toBe(false);
});

test('ONNX 런타임이 없어도 이긴 전적이 있는 플라우로스는 갤러리에서 잠금 해제된다', async ({ page }) => {
  await seedAllOpponentsCleared(page);
  await page.route('**/js/ort.all.min.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  expect(await page.evaluate(() => typeof window.ort)).toBe('undefined');

  await enterMainMenu(page);
  // 메인 메뉴 0: 게임 시작, 1: 너랑 나랑, 2: 시뮬레이터, 3: 플레이 방법, 4: 구경, 5: 갤러리
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('gallery');
  // 갤러리 유형 0: 일반뿌요, 1: 예고뿌요, 2: 적
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  // 첫 번째 ArrowDown 은 목록으로 포커스를 옮기고, 두 번째부터 잠김 해제된 다음 대상으로 이동한다.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['플라우로스', 'Flauros', 'フラウロス', '弗劳洛斯'].includes(text)))).toBe(true);
});

test('구경 모드는 ONNX 추론 적을 선정 대상에서 아예 제외한다', async ({ page }) => {
  await page.evaluate(() => {
    // 두 ONNX 적을 목록 맨 앞에 두고 무작위를 고정하면, 제외하지 않을 때 반드시 뽑히는 자리에 놓인다.
    class OnnxWatchEnemyA extends window.WebPuyo.OnnxEnemy {
      constructor() { super(); this.sortPriority = -1002; }
      getClassType() { return 'OnnxWatchEnemyA'; }
      getName() { return 'ONNX 구경 적 A'; }
    }
    class OnnxWatchEnemyB extends window.WebPuyo.OnnxEnemy {
      constructor() { super(); this.sortPriority = -1001; }
      getClassType() { return 'OnnxWatchEnemyB'; }
      getName() { return 'ONNX 구경 적 B'; }
    }
    window.WebPuyo.registerOpponent({ createController: () => new OnnxWatchEnemyA() });
    window.WebPuyo.registerOpponent({ createController: () => new OnnxWatchEnemyB() });
    // 진행도와 관계없이 구경 메뉴를 열고 모든 적을 후보로 삼도록 지금 세션에 바로 적용한다.
    window.WebPuyo.addCode('observation');
    Math.random = () => 0;
  });
  await enterMainMenu(page);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('watch_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.watch), { timeout: 20000 }).toBe(true);

  const names = await page.evaluate(() => {
    const state = window.WebPuyo.getGameState();
    return [state.player.name, state.opponent.name];
  });
  // 후보에서 아예 빠지므로 고정된 무작위값으로도 양쪽 모두 ONNX 적이 뽑히지 않는다.
  expect(names).not.toContain('ONNX 구경 적 A');
  expect(names).not.toContain('ONNX 구경 적 B');
});

test('플라우로스는 ONNX 모델을 불러온 뒤 대전하고, 모델을 못 불러오면 적 선택 화면으로 돌아간다', async ({ page }) => {
  // 모델 실패 경로(최대 20초)와 실제 추론 대전(최대 60초)을 한 테스트에서 이어 보므로
  // 기본 제한 시간 30초로는 항상 모자란다. ONNX 추론은 CPU를 많이 써서 다른 테스트와 함께 돌면 더 느려진다.
  test.setTimeout(180000);
  await page.evaluate(() => localStorage.setItem('puyow_code', JSON.stringify(['observation'])));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

  // 모델 요청을 실패시키면 대전을 시작하지 않고 적 선택 화면으로 돌아간다.
  // 로딩 중 상태를 관찰할 수 있도록 응답을 잠시 늦춘다.
  await page.route('**/onnx/model01.onnx', async (route) => {
    await new Promise((resolve) => { setTimeout(resolve, 2000); });
    await route.fulfill({ status: 404, body: '' });
  });
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent?.name), { timeout: 15000 }).toBe('플라우로스');
  // 모델을 다 불러오기 전에는 카운트다운이 줄지 않고 로딩 안내만 보여 준다.
  expect(await page.evaluate(() => window.WebPuyo.getGameState()?.countdown)).toBe(3000);
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => text.includes('...') || text.includes('…')))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 20000 }).toBe('opponent_select');
  expect(await page.evaluate(() => window.WebPuyo.getGameState())).toBe(null);

  // 모델 요청을 되살리면 로딩이 끝난 뒤 카운트다운이 진행되고 플라우로스가 실제로 뿌요를 놓는다.
  await page.unroute('**/onnx/model01.onnx');
  // 돌아온 적 선택 화면은 첫 줄에 포커스가 있으므로 다시 적 줄로 내려 시작한다. 선택된 적은 그대로 플라우로스다.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent?.name), { timeout: 15000 }).toBe('플라우로스');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent?.placedPairCount || 0), { timeout: 60000 }).toBeGreaterThan(2);
});

test('ONNX 추론은 워커에서 돌아가고 마감 시한을 넘기면 앞 1수 시뮬레이션으로 그 턴을 확정한다', async ({ page }) => {
  test.setTimeout(300000);
  await page.evaluate(() => localStorage.setItem('puyow_code', JSON.stringify(['observation'])));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

  // 게임 초기화가 추론을 워커로 넘겨 두었는지 확인한다. 이 설정이 없으면 wasm 연산이 메인 스레드를 막는다.
  expect(await page.evaluate(() => window.ort.env.wasm.proxy)).toBe(true);

  // 추론을 마감 시한(2초)보다 오래 끌게 만들어 폴백 경로를 태운다.
  await page.evaluate(() => {
    window.onnxSessionStats = { activeRuns: 0, maxActiveRuns: 0, inputDisposals: 0, outputDisposals: 0, releases: 0 };
    const originalCreate = window.ort.InferenceSession.create.bind(window.ort.InferenceSession);
    window.ort.InferenceSession.create = async (...args) => {
      const session = await originalCreate(...args);
      const originalRun = session.run.bind(session);
      session.run = async (...runArgs) => {
        const input = runArgs[0]?.observation;
        const originalInputDispose = input?.dispose?.bind(input);
        if (originalInputDispose) input.dispose = () => {
          window.onnxSessionStats.inputDisposals += 1;
          return originalInputDispose();
        };
        window.onnxSessionStats.activeRuns += 1;
        window.onnxSessionStats.maxActiveRuns = Math.max(window.onnxSessionStats.maxActiveRuns, window.onnxSessionStats.activeRuns);
        try {
          await new Promise((resolve) => { setTimeout(resolve, 6000); });
          const outputs = await originalRun(...runArgs);
          const output = outputs.value;
          const originalOutputDispose = output?.dispose?.bind(output);
          if (originalOutputDispose) output.dispose = () => {
            window.onnxSessionStats.outputDisposals += 1;
            return originalOutputDispose();
          };
          return outputs;
        } finally {
          window.onnxSessionStats.activeRuns -= 1;
        }
      };
      const originalRelease = session.release?.bind(session);
      if (originalRelease) session.release = async () => {
        window.onnxSessionStats.releases += 1;
        return originalRelease();
      };
      return session;
    };
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent?.name), { timeout: 60000 }).toBe('플라우로스');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.countdown), { timeout: 60000 }).toBe(0);

  // 폴백이 없으면 회전·이동·빠른 하강 없이 자연 낙하만 하므로 한 수에 20초가 넘게 걸린다.
  const startedAt = Date.now();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent?.placedPairCount || 0), { timeout: 60000 }).toBeGreaterThanOrEqual(3);
  const averageTurnMs = (Date.now() - startedAt) / 3;
  expect(averageTurnMs).toBeLessThan(15000);
  // 마감 시한을 넘긴 이전 run()이 남아 있어도 새 추론을 쌓지 않아 동시에 실행되는 세션 호출은 하나다.
  expect(await page.evaluate(() => window.onnxSessionStats.maxActiveRuns)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.onnxSessionStats.inputDisposals)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.onnxSessionStats.outputDisposals)).toBeGreaterThan(0);
  // destroy()는 대전이 빌린 세션을 반납하고, 실행 중인 추론이 끝난 뒤 ONNX 리소스를 해제한다.
  await page.evaluate(() => window.WebPuyo.destroy());
  await expect.poll(() => page.evaluate(() => window.onnxSessionStats.releases)).toBeGreaterThan(0);
});

test('ONNX 프록시 워커를 만들지 못하면 메인 스레드 재시도 없이 기본 AI로 대전한다', async ({ page }) => {
  test.setTimeout(180000);
  await page.evaluate(() => localStorage.setItem('puyow_code', JSON.stringify(['observation'])));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

  await page.evaluate(() => {
    window.ort.InferenceSession.create = async () => {
      throw new Error("Failed to construct 'Worker': Script at blob: blocked by CSP");
    };
  });

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent?.name), { timeout: 60000 }).toBe('플라우로스');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.countdown), { timeout: 60000 }).toBe(0);
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent?.placedPairCount || 0), { timeout: 60000 }).toBeGreaterThanOrEqual(1);
  // proxy 플래그를 끄지 않았으므로 이후 대전도 메인 스레드 ONNX 실행으로 바뀌지 않는다.
  expect(await page.evaluate(() => window.ort.env.wasm.proxy)).toBe(true);
});

test('ONNX wasm 바이너리는 CDN을 먼저 시도한다', async ({ page }) => {
  const wasmRequests = [];
  page.on('request', (request) => {
    if (/ort-wasm[^/]*\.wasm(\?|$)/.test(request.url()) && request.method() === 'GET') wasmRequests.push(request.url());
  });
  // 기본 차단을 덮어쓴다. 본문은 짧은 더미로 돌려줘, 27MB를 오가지 않아도
  // "CDN 주소를 골라 실제로 요청했는가"를 확인할 수 있다.
  await page.route('https://cdn.jsdelivr.net/npm/onnxruntime-web@*/dist/ort-wasm-simd-threaded.jsep.wasm', (route) => route.fulfill({
    status: 200,
    contentType: 'application/wasm',
    body: 'not-a-real-wasm',
  }));
  await page.evaluate(() => localStorage.setItem('puyow_code', JSON.stringify(['observation'])));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

  // 글루 모듈은 로컬, 큰 바이너리는 CDN으로 나눈 객체 형식이어야 한다.
  await expect.poll(() => page.evaluate(() => {
    const paths = window.ort.env.wasm.wasmPaths;
    return paths && typeof paths === 'object' ? paths.wasm : null;
  })).toContain('cdn.jsdelivr.net');
  expect(await page.evaluate(() => window.ort.env.wasm.wasmPaths.mjs)).toContain('ort-wasm-simd-threaded.jsep.mjs');

  // 대전을 시작하면 런타임이 그 CDN 주소로 wasm을 요청한다.
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => wasmRequests.some((url) => url.startsWith('https://cdn.jsdelivr.net/')), { timeout: 30000 }).toBe(true);
  expect(wasmRequests.every((url) => !url.startsWith('http://localhost'))).toBe(true);

  // 이 더미 wasm으로는 세션을 만들 수 없으므로 안내 후 적 선택 화면으로 돌아온다.
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen), { timeout: 60000 }).toBe('opponent_select');
});

test('CDN에 닿지 않으면 로컬 wasm으로 플라우로스 대전을 진행한다', async ({ page }) => {
  test.setTimeout(180000);
  const wasmRequests = [];
  page.on('request', (request) => {
    if (/ort-wasm[^/]*\.wasm(\?|$)/.test(request.url()) && request.method() === 'GET') wasmRequests.push(request.url());
  });
  // CDN은 beforeEach가 이미 막아 둔 상태다.
  await page.evaluate(() => localStorage.setItem('puyow_code', JSON.stringify(['observation'])));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

  // CDN이 막히면 로컬 디렉터리 접두 경로로 되돌아간다.
  await expect.poll(() => page.evaluate(() => window.ort.env.wasm.wasmPaths)).toContain('/js/');

  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getGameState()?.opponent?.placedPairCount || 0), { timeout: 120000 }).toBeGreaterThanOrEqual(2);
  expect(wasmRequests.every((url) => !url.startsWith('https://cdn.jsdelivr.net/'))).toBe(true);
});

test('CDN과 로컬 모두 wasm을 못 받으면 적 선택 화면에서만 플라우로스를 숨긴다', async ({ page }) => {
  // CDN은 beforeEach가 막아 두었고, 여기서는 로컬 파일까지 없는 상황을 만든다.
  await page.route('**/js/ort-wasm-simd-threaded.jsep.wasm', (route) => route.fulfill({ status: 404, body: '' }));
  await page.evaluate(() => {
    localStorage.setItem('puyow_code', JSON.stringify(['observation']));
    localStorage.setItem('puyow_gallery', JSON.stringify({ warning: [], enemies: ['Flauros'] }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');

  // ort 자체는 있지만 wasm을 못 받으므로 추론을 쓸 수 없는 상태가 된다.
  expect(await page.evaluate(() => typeof window.ort)).toBe('object');
  await enterMainMenu(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('rule_select');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('opponent_select');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['안드로말리우스', 'Andromalius', 'アンドロマリウス', '安杜马利乌斯'].includes(text)))).toBe(true);
  expect(await page.evaluate(() => window.testCanvasTexts.some((text) => ['플라우로스', 'Flauros', 'フラウロス', '弗劳洛斯'].includes(text)))).toBe(false);

  // 갤러리는 이 제한과 무관하게 이긴 전적대로 잠금이 풀려 있어야 한다.
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('initial_title');
  await enterMainMenu(page);
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.WebPuyo.getScreenState().screen)).toBe('gallery');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.testCanvasTexts.some((text) => ['플라우로스', 'Flauros', 'フラウロス', '弗劳洛斯'].includes(text)))).toBe(true);
});
