/**
 * 서버 모니터링 및 관리 페이지(src/admin.html) 전용 백엔드다.
 *
 * server.js 는 이 모듈의 진입점 하나만 연결한다.
 *   - HTTP : /apis/admin/...   → handleApi()
 *
 * 관리자 계정은 server.js 상단의 ADMIN_ID·ADMIN_PASSWORD 하나뿐이며 추가할 수 없다.
 * ADMIN_PASSWORD 가 비어 있으면 관리자 계정 자체가 비활성화되어 로그인 API 가 항상 거절한다.
 * 비밀번호는 단방향 암호화 없이 서버 코드에 그대로 두고(운영자가 언제든 고칠 수 있어야 하므로),
 * 로그인 시에만 양쪽에서 sha256 으로 해시해 비교한다.
 *
 * python/admin.py 도 같은 계약을 구현하므로, 경로나 오류 코드를 바꾸면 두 파일을 함께 고쳐야 한다.
 *
 * LICENSE
 *
 * Copyright 2026 HJOW (hujinone22@naver.com)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const crypto = require('crypto');

/**************************************** 상수 ***************************************/

/** 관리자 로그인 세션을 담아 두는 쿠키 이름이다. 온라인 플레이 세션 토큰과 전혀 공유하지 않는다. */
const ADMIN_COOKIE_NAME = 'puyow_admin_session';
/** 이 횟수 이상 로그인에 실패하면 해당 세션의 관리자 로그인을 막는다. */
const LOGIN_FAIL_LIMIT = 5;
/** 마지막 로그인 실패로부터 이 시간 동안만 차단한다(밀리초). */
const LOGIN_BLOCK_MS = 10 * 60 * 1000;
/** 아무 요청도 오지 않으면 이 시간 뒤에 관리자 세션을 버린다(밀리초). */
const SESSION_IDLE_MS = 30 * 60 * 1000;
/** 관리자 API 요청 본문의 최대 크기(바이트). */
const MAX_BODY_BYTES = 64 * 1024;
/** 프런트가 sha256 으로 해시해 보내는 값의 형식이다. (64자리 16진수) */
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/**************************************** 공용 함수 ***************************************/

/**
 * 문자열의 sha256 해시를 16진수 소문자로 만든다.
 * @param {string} value 원문
 * @returns {string} 64자리 16진수 해시
 */
function sha256Hex(value) {
    return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

/**
 * 길이가 같은 두 16진수 해시를 시간 차이 없이 비교한다.
 * @param {string} left 비교할 값
 * @param {string} right 비교할 값
 * @returns {boolean} 같으면 true
 */
function isSameHash(left, right) {
    const leftBuffer = Buffer.from(String(left), 'utf8');
    const rightBuffer = Buffer.from(String(right), 'utf8');
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * 요청 헤더에서 쿠키 하나를 읽는다.
 * @param {import('http').IncomingMessage} req HTTP 요청
 * @param {string} name 쿠키 이름
 * @returns {string} 쿠키 값. 없으면 빈 문자열
 */
function readCookie(req, name) {
    const header = req.headers?.cookie;
    if (typeof header !== 'string') return '';
    const found = header.split(';').map((one) => one.trim()).find((one) => one.startsWith(`${name}=`));
    return found ? decodeURIComponent(found.substring(name.length + 1)) : '';
}

/**************************************** 서비스 본체 ***************************************/

/**
 * 관리 페이지 백엔드를 만든다.
 * @param {{adminId:string, adminPassword:string, onlinePlayService:object, getServerInfo?:Function}} options 서비스 설정
 * @returns {{isEnabled:()=>boolean, handleApi:Function}} 서비스 객체
 */
function createService(options) {
    const adminId = typeof options?.adminId === 'string' ? options.adminId : '';
    const adminPassword = typeof options?.adminPassword === 'string' ? options.adminPassword : '';
    const onlinePlayService = options?.onlinePlayService || null;
    const getServerInfo = typeof options?.getServerInfo === 'function' ? options.getServerInfo : () => ({});

    // 비밀번호가 공란이면 관리자 계정 자체가 비활성화된다. ID 만 적어 두어도 로그인할 수 없다.
    const enabled = adminPassword.length > 0;
    // 서버가 살아 있는 동안 한 번만 계산해 둔다. 원문은 요청 처리 중에 다시 쓰지 않는다.
    const adminPasswordHash = enabled ? sha256Hex(adminPassword) : '';

    /**
     * 세션 ID → 관리자 세션. 로그인 여부와 로그인 실패 기록을 함께 담는다.
     * 온라인 플레이 세션(onlineplay.js)과는 저장소도 수명도 완전히 별개다.
     * @type {Map<string, {id:string, authenticated:boolean, failCount:number, lastFailAt:number, lastActiveAt:number}>}
     */
    const sessions = new Map();

    /**
     * 오래 쓰이지 않은 세션을 버린다. 타이머 대신 요청이 올 때마다 정리한다.
     * @returns {void}
     */
    function pruneSessions() {
        const now = Date.now();
        sessions.forEach((session, id) => {
            if (now - session.lastActiveAt > SESSION_IDLE_MS) sessions.delete(id);
        });
    }

    /**
     * 요청의 관리자 세션을 찾고, 없으면 새로 만든다.
     * 로그인 실패 횟수를 세션에 담아야 하므로 로그인 전에도 세션을 발급한다.
     * @param {import('http').IncomingMessage} req HTTP 요청
     * @param {import('http').ServerResponse} res HTTP 응답
     * @returns {object} 관리자 세션
     */
    function resolveSession(req, res) {
        pruneSessions();
        const cookieValue = readCookie(req, ADMIN_COOKIE_NAME);
        let session = cookieValue ? sessions.get(cookieValue) : null;
        if (!session) {
            const id = crypto.randomBytes(24).toString('hex');
            session = { id, authenticated: false, failCount: 0, lastFailAt: 0, lastActiveAt: Date.now() };
            sessions.set(id, session);
            // 관리 페이지는 서버와 같은 출처에서 열리므로 SameSite=Strict 로 두어도 문제가 없다.
            res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=${session.id}; Path=/; HttpOnly; SameSite=Strict`);
        }
        session.lastActiveAt = Date.now();
        return session;
    }

    /**
     * 이 세션이 지금 관리자 로그인 차단 상태인지 본다.
     * 5회 이상 실패해도 마지막 실패로부터 10분이 지나면 다시 시도할 수 있다.
     * @param {object} session 관리자 세션
     * @returns {number} 남은 차단 시간(초). 차단 중이 아니면 0
     */
    function getBlockedSeconds(session) {
        if (session.failCount < LOGIN_FAIL_LIMIT) return 0;
        const remain = LOGIN_BLOCK_MS - (Date.now() - session.lastFailAt);
        if (remain <= 0) {
            // 차단 시간이 지났으므로 실패 기록을 지우고 처음부터 다시 센다.
            session.failCount = 0;
            session.lastFailAt = 0;
            return 0;
        }
        return Math.ceil(remain / 1000);
    }

    /**************************************** 각 API ***************************************/

    /**
     * 지금 로그인 상태와 차단 상태를 알려 준다. 관리 페이지가 처음 열릴 때 호출한다.
     * @param {object} session 관리자 세션
     * @returns {{status:number, body:object}} 응답
     */
    function sessionApi(session) {
        return {
            status: 200,
            body: {
                ok: true,
                adminEnabled: enabled,
                authenticated: session.authenticated === true,
                blockedSeconds: getBlockedSeconds(session)
            }
        };
    }

    /**
     * 관리자 로그인을 처리한다.
     * @param {object} session 관리자 세션
     * @param {object} payload 요청 본문
     * @returns {{status:number, body:object}} 응답
     */
    function loginApi(session, payload) {
        // 비밀번호가 공란이면 관리자 계정이 없는 것과 같다.
        if (!enabled) return { status: 403, body: { ok: false, code: 'admin_disabled' } };

        const blockedSeconds = getBlockedSeconds(session);
        if (blockedSeconds > 0) return { status: 423, body: { ok: false, code: 'login_blocked', blockedSeconds } };

        const id = typeof payload?.id === 'string' ? payload.id : '';
        const password = typeof payload?.password === 'string' ? payload.password.toLowerCase() : '';
        // 형식이 맞지 않는 요청도 로그인 실패로 세어 무차별 대입을 함께 막는다.
        const matched = SHA256_PATTERN.test(password) && id === adminId && isSameHash(password, adminPasswordHash);
        if (!matched) {
            session.authenticated = false;
            session.failCount += 1;
            session.lastFailAt = Date.now();
            const nowBlocked = getBlockedSeconds(session);
            if (nowBlocked > 0) return { status: 423, body: { ok: false, code: 'login_blocked', blockedSeconds: nowBlocked } };
            return { status: 401, body: { ok: false, code: 'login_failed', remain: LOGIN_FAIL_LIMIT - session.failCount } };
        }

        session.authenticated = true;
        session.failCount = 0;
        session.lastFailAt = 0;
        return { status: 200, body: { ok: true, adminId } };
    }

    /**
     * 관리자 로그아웃을 처리한다. 세션 자체를 버린다.
     * @param {object} session 관리자 세션
     * @returns {{status:number, body:object}} 응답
     */
    function logoutApi(session) {
        sessions.delete(session.id);
        return { status: 200, body: { ok: true } };
    }

    /**
     * 대시보드에 보여 줄 서버 현황을 만든다.
     * Node 서버는 psutil 같은 것이 없으므로 V8 이 알려 주는 메모리 사용량을 그대로 보낸다.
     * @returns {{status:number, body:object}} 응답
     */
    function statusApi() {
        const memory = process.memoryUsage();
        return {
            status: 200,
            body: {
                ok: true,
                server: 'node',
                runtime: `Node.js ${process.version}`,
                uptimeSec: Math.round(process.uptime()),
                time: new Date().toISOString(),
                // 파이썬 서버와 달리 시스템 전체 점유율은 알 수 없으므로 비워 둔다. 화면에서 이 값이 null 이면 해당 칸을 그리지 않는다.
                cpuPercent: null,
                memoryPercent: null,
                memoryBytes: [
                    { key: 'rss', bytes: memory.rss },
                    { key: 'heapTotal', bytes: memory.heapTotal },
                    { key: 'heapUsed', bytes: memory.heapUsed },
                    { key: 'external', bytes: memory.external },
                    { key: 'arrayBuffers', bytes: memory.arrayBuffers }
                ],
                onlinePlay: onlinePlayService?.getStats ? onlinePlayService.getStats() : { enabled: false, accounts: 0, sessions: 0, rooms: 0, playing: 0 },
                serverInfo: getServerInfo()
            }
        };
    }

    /**
     * 온라인 플레이 계정 목록을 보낸다.
     * @returns {{status:number, body:object}} 응답
     */
    function accountsApi() {
        const onlinePlayEnabled = onlinePlayService?.isEnabled ? onlinePlayService.isEnabled() === true : false;
        return {
            status: 200,
            body: {
                ok: true,
                onlinePlayEnabled,
                accounts: onlinePlayEnabled && onlinePlayService?.listAccounts ? onlinePlayService.listAccounts() : []
            }
        };
    }

    /**
     * 온라인 플레이 계정의 비밀번호를 바꾼다.
     * @param {object} payload 요청 본문
     * @returns {Promise<{status:number, body:object}>} 응답
     */
    async function accountPasswordApi(payload) {
        if (!onlinePlayService?.changeAccountPassword) return { status: 404, body: { ok: false, code: 'online_play_disabled' } };
        const id = typeof payload?.id === 'string' ? payload.id : '';
        const password = typeof payload?.password === 'string' ? payload.password.toLowerCase() : '';
        const result = await onlinePlayService.changeAccountPassword(id, password);
        return { status: result.ok ? 200 : 400, body: result };
    }

    /**
     * 온라인 플레이 계정을 활성·비활성으로 바꾼다.
     * @param {object} payload 요청 본문
     * @returns {{status:number, body:object}} 응답
     */
    function accountStateApi(payload) {
        if (!onlinePlayService?.setAccountActive) return { status: 404, body: { ok: false, code: 'online_play_disabled' } };
        if (typeof payload?.active !== 'boolean') return { status: 400, body: { ok: false, code: 'invalid_request' } };
        const result = onlinePlayService.setAccountActive(typeof payload?.id === 'string' ? payload.id : '', payload.active);
        return { status: result.ok ? 200 : 400, body: result };
    }

    /**************************************** HTTP 진입점 ***************************************/

    /**
     * 요청 본문을 JSON 객체로 읽는다.
     * @param {import('http').IncomingMessage} req HTTP 요청
     * @returns {Promise<object>} 본문 객체
     */
    function readBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.setEncoding('utf8');
            req.on('data', (chunk) => {
                body += chunk;
                if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
                    reject(new Error('요청 본문이 너무 큽니다.'));
                    req.destroy();
                }
            });
            req.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve(parsed && typeof parsed === 'object' ? parsed : {});
                } catch (error) {
                    reject(error);
                }
            });
            req.on('error', reject);
        });
    }

    /**
     * /apis/admin/... HTTP 요청을 처리한다.
     * @param {import('http').IncomingMessage} req HTTP 요청
     * @param {import('http').ServerResponse} res HTTP 응답
     * @returns {Promise<void>} 처리 완료 시점
     */
    async function handleApi(req, res) {
        const sendJson = (status, body) => {
            res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(body), 'utf-8');
        };
        if (req.method !== 'POST') { req.resume(); sendJson(405, { ok: false, code: 'method_not_allowed' }); return; }

        const session = resolveSession(req, res);
        const action = (req.url || '').split('?')[0].split('/')[3] || '';

        let payload = null;
        try {
            payload = await readBody(req);
        } catch {
            sendJson(400, { ok: false, code: 'invalid_body' });
            return;
        }

        try {
            // 로그인 전에도 쓸 수 있는 요청이다.
            if (action === 'session') { const result = sessionApi(session); sendJson(result.status, result.body); return; }
            if (action === 'login') { const result = loginApi(session, payload); sendJson(result.status, result.body); return; }
            if (action === 'logout') { const result = logoutApi(session); sendJson(result.status, result.body); return; }

            // 여기부터는 모두 로그인한 관리자만 쓸 수 있다.
            if (!enabled || session.authenticated !== true) { sendJson(401, { ok: false, code: 'unauthorized' }); return; }

            if (action === 'status') { const result = statusApi(); sendJson(result.status, result.body); return; }
            if (action === 'accounts') { const result = accountsApi(); sendJson(result.status, result.body); return; }
            if (action === 'accountpassword') { const result = await accountPasswordApi(payload); sendJson(result.status, result.body); return; }
            if (action === 'accountstate') { const result = accountStateApi(payload); sendJson(result.status, result.body); return; }
            sendJson(404, { ok: false, code: 'not_found' });
        } catch (error) {
            console.error('관리 API 처리 중 오류가 발생했습니다.', error);
            sendJson(500, { ok: false, code: 'server_error' });
        }
    }

    return { isEnabled: () => enabled, handleApi };
}

module.exports = { createService };
