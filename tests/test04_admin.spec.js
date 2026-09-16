import { test, expect } from '@playwright/test';

// 서버 모니터링·관리 페이지(admin.html, puyow_admin.js)의 회귀 테스트다.
// 게임 페이지(puyow.html)는 test01_*.spec.js, 개발용 도구 페이지는 test02_tools.spec.js가 맡는다.
//
// 이 테스트는 저장소 기본 설정 그대로의 서버를 쓴다. nodeserver/server.js 의 ADMIN_PASSWORD 가
// 공란이라 관리자 계정이 비활성인 상태이며, 그래서 로그인 없이 확인할 수 있는 계약만 검사한다.
// 로그인 이후 동작(대시보드·계정 관리)은 서버 상수를 바꿔야 하므로 여기서 다루지 않는다.

const ADMIN_PAGE = '/admin.html';

// 관리 페이지는 한국어 화면만 제공하므로 브라우저 언어를 고정한다.
test.use({ locale: 'ko-KR' });

// 실제 브라우저에는 WebMCP가 없으므로 등록만 받아 두는 최소 구현을 문서에 심는다.
async function recordWebMcpTools(page) {
  await page.addInitScript(() => {
    window.registeredWebMcpTools = [];
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      writable: true,
      value: { registerTool: (tool) => window.registeredWebMcpTools.push(tool) }
    });
  });
}

// 등록된 도구를 이름으로 찾아 실행하고, 예외는 메시지 문자열로 돌려준다.
async function runTool(page, name, input) {
  return page.evaluate(async ({ toolName, toolInput }) => {
    const tool = window.registeredWebMcpTools.find((one) => one.name === toolName);
    if (!tool) throw new Error(`${toolName} is not registered.`);
    try {
      return { ok: true, value: await tool.execute(toolInput || {}) };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }, { toolName: name, toolInput: input });
}

test.beforeEach(async ({ page }) => {
  await recordWebMcpTools(page);
  await page.goto(ADMIN_PAGE);
  await page.waitForSelector('.admin-login-box');
});

test('관리 페이지는 접속하면 관리자 로그인 화면부터 보여 준다', async ({ page }) => {
  await expect(page.locator('.admin-login-box h1')).toHaveText('Puyo W 서버 관리');
  await expect(page.locator('.admin-login-box input[type="password"]')).toHaveCount(1);
  // 로그인 전에는 사이드바와 본문 화면이 없다.
  await expect(page.locator('.admin-layout')).toHaveCount(0);
});

test('화면 모드 토글은 문서의 data-theme 을 바꾸고 저장하지 않는다', async ({ page }) => {
  const before = await page.getAttribute('html', 'data-theme');
  expect(['dark', 'light']).toContain(before);
  await page.click('.admin-login-top button');
  const after = await page.getAttribute('html', 'data-theme');
  expect(after).not.toBe(before);
  // 화면 모드는 저장하지 않으므로 다시 열면 기본값으로 돌아온다.
  await page.reload();
  await page.waitForSelector('.admin-login-box');
  expect(await page.getAttribute('html', 'data-theme')).toBe(before);
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
});

test.describe('WebMCP', () => {
  test('관리 페이지는 admin_ 접두어 도구 다섯 개만 등록한다', async ({ page }) => {
    const names = await page.evaluate(() => window.registeredWebMcpTools.map((tool) => tool.name));
    expect(names).toEqual([
      'admin_manual', 'admin_login_status', 'admin_server_status',
      'admin_online_accounts', 'admin_set_account_state'
    ]);
    // 로그인·로그아웃과 계정 비밀번호 변경은 일부러 도구로 만들지 않는다.
    expect(names.some((name) => /login$|logout|password/.test(name))).toBe(false);
  });

  test('읽기 전용 도구와 신뢰할 수 없는 내용 표시를 함께 알린다', async ({ page }) => {
    const tools = await page.evaluate(() => Object.fromEntries(
      window.registeredWebMcpTools.map((tool) => [tool.name, {
        annotations: tool.annotations || null,
        hasInputSchema: Boolean(tool.inputSchema),
        hasOutputSchema: Boolean(tool.outputSchema)
      }])
    ));
    expect(tools.admin_manual.annotations).toEqual({ readOnlyHint: true });
    expect(tools.admin_login_status.annotations).toEqual({ readOnlyHint: true });
    expect(tools.admin_server_status.annotations).toEqual({ readOnlyHint: true });
    // 계정 닉네임은 플레이어가 직접 정한 문자열이다.
    expect(tools.admin_online_accounts.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
    expect(tools.admin_set_account_state.annotations).toEqual({ untrustedContentHint: true });
    Object.values(tools).forEach((tool) => expect(tool.hasInputSchema).toBe(true));
    expect(tools.admin_manual.hasOutputSchema).toBe(false);
    ['admin_login_status', 'admin_server_status', 'admin_online_accounts', 'admin_set_account_state']
      .forEach((name) => expect(tools[name].hasOutputSchema).toBe(true));
  });

  test('admin_manual 은 로그인 전에도 영어 안내를 돌려준다', async ({ page }) => {
    const result = await runTool(page, 'admin_manual');
    expect(result.ok).toBe(true);
    expect(result.value).toContain('manages the accounts used for online play');
    // 로그인은 사람이 해야 한다는 점과 비밀번호 변경 제외를 안내에 담는다.
    expect(result.value).toContain('there is no tool for it');
    expect(result.value).toContain('untrusted text');
  });

  test('admin_login_status 는 로그인 전에도 동작하며 현재 화면을 함께 알린다', async ({ page }) => {
    const result = await runTool(page, 'admin_login_status');
    expect(result.ok).toBe(true);
    expect(result.value.authenticated).toBe(false);
    expect(result.value.screen).toBe('login');
    expect(result.value.blockedSeconds).toBe(0);
    // 기본 서버는 ADMIN_PASSWORD 가 공란이라 관리자 계정 자체가 비활성이다.
    expect(typeof result.value.adminEnabled).toBe('boolean');
  });

  test('로그인하지 않으면 나머지 도구는 사람이 로그인해야 한다고 알리며 거절한다', async ({ page }) => {
    const calls = [
      ['admin_server_status', {}],
      ['admin_online_accounts', {}],
      ['admin_set_account_state', { id: 'tester01', active: false }]
    ];
    for (const [name, input] of calls) {
      const result = await runTool(page, name, input);
      expect(result.ok, `${name} 은 로그인 없이 성공하면 안 된다`).toBe(false);
      expect(result.message).toContain('A person has to sign in on the page first');
    }
  });
});
