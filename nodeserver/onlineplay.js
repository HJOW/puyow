/** Shutting Stars - Puyo W 온라인 플레이 백엔드 (node.js)
 * @author HJOW <hujinone22@naver.com>
 * @license Apache-2.0
 *
 * GitHub : https://github.com/HJOW/puyow
 *
 * 이 파일은 온라인 플레이(계정·로그인·대기실·방·대전 중계)만 담당한다.
 * nodeserver/server.js 는 이 모듈의 createService() 로 서비스 객체를 만들어
 *   - HTTP  : /apis/onlineplay/...   → handleApi()
 *   - 소켓  : Upgrade 요청           → handleUpgrade()
 * 두 진입점만 연결하며, 그 밖의 온라인 플레이 처리는 모두 이 파일 안에 있다.
 *
 * 프로토콜과 규칙은 저장소 루트의 MAY_BE_LATER.md "세부 결정 사항" 절을 따른다.
 * python/onlineplay.py 도 같은 계약을 구현하므로, 메시지 이름이나 오류 코드를 바꾸면 두 파일을 함께 고쳐야 한다.
 *
 * 의존성
 *     bcrypt (package.json 의 dependencies 에 이미 포함)
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**************************************** 상수 ***************************************/

/** 서버가 계정과 방 정보를 저장하는 최상위 디렉터리다. */
const STORAGE_ROOT = path.join(os.homedir(), '.puyowserver');
/** 계정 디렉터리. 이 아래에 "ID(소문자)/account.json" 형태로 저장한다. */
const ACCOUNT_ROOT = path.join(STORAGE_ROOT, 'account');
/** 방 디렉터리. 이 아래에 "방ID.json" 형태로 저장하며 서버 시작 시 비운다. */
const ROOM_ROOT = path.join(STORAGE_ROOT, 'rooms');

/** 계정 ID 규칙: 알파벳·숫자·언더바 4~20자. */
const ID_PATTERN = /^[A-Za-z0-9_]{4,20}$/;
/** 닉네임 규칙: 알파벳·숫자·언더바 3~20자. 대소문자를 구분한다. */
const NICKNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
/** 비밀번호 원문 규칙: 알파벳·숫자·언더바와 일부 특수문자 4~30자. 프런트에서 먼저 검사하고 서버도 같은 기준으로 다시 본다. */
const PASSWORD_PATTERN = /^[A-Za-z0-9_!@#$%^&*?]{4,30}$/;
/** 프런트가 sha256 으로 한 번 해시해 보내는 값의 형식이다. (64자리 16진수) */
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** 비밀번호 실패 기록을 유지하는 시간(밀리초). */
const LOGIN_FAIL_WINDOW_MS = 5 * 60 * 1000;
/** 이 횟수 이상 틀리면 LOGIN_FAIL_WINDOW_MS 동안 해당 계정으로 로그인할 수 없다. */
const LOGIN_FAIL_LIMIT = 3;

/** WebSocket 연결 후 인증 메시지를 기다리는 시간(밀리초). */
const AUTH_TIMEOUT_MS = 5 * 1000;
/** 서버가 ping 을 보내는 간격(밀리초). */
const PING_INTERVAL_MS = 5 * 1000;
/** 이 시간 동안 아무 메시지도 오지 않으면 연결이 끊긴 것으로 본다. */
const CONNECTION_TIMEOUT_MS = 15 * 1000;
/** 소켓이 끊긴 뒤 같은 토큰으로 다시 연결할 수 있는 유예 시간(밀리초). */
const SESSION_GRACE_MS = 60 * 1000;
/** 대기실·방에서 아무 조작이 없을 때 세션을 만료시키는 시간(밀리초). */
const SESSION_IDLE_MS = 30 * 60 * 1000;

/** 대기실 목록에 한 번에 보내는 방의 최대 개수. */
const ROOM_LIST_LIMIT = 50;
/** 서버가 동시에 유지하는 방의 최대 개수. */
const ROOM_LIMIT = 200;

/** 게임 시작 버튼을 누른 뒤 실제 시작까지의 음영처리 시간(밀리초). */
const GAME_PREPARE_MS = 3 * 1000;
/** 한 대전에서 미리 만들어 두는 뿌요 쌍의 개수. 모자라면 이어서 더 보낸다. */
const DECK_SIZE = 512;
/** 양쪽 패배 보고가 이 시간 안에 겹치면 무승부로 처리한다(밀리초). */
const DRAW_WINDOW_MS = 50;

/** puyow.js 의 COLORS 와 같은 순서다. 색상 수 3·4·5 는 앞에서부터 자른다. */
const PUYO_COLORS = ['red', 'green', 'yellow', 'blue', 'purple'];
/** 방에서 고를 수 있는 대전 규칙이다. puyow.js 의 TOGETHER_RULE_OPTIONS 와 같은 키를 쓴다. */
const ROOM_RULES = ['standard', 'fever', 'feverStart'];

/** RFC 6455 가 정한 핸드셰이크용 고정 GUID 다. */
const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
/** 한 WebSocket 메시지의 최대 크기(바이트). 게임 조작 메시지는 아주 작으므로 넉넉한 값이다. */
const MAX_FRAME_BYTES = 256 * 1024;

/**************************************** 유틸리티 ***************************************/

/**
 * bcrypt 모듈을 처음 필요할 때만 불러온다.
 * 온라인 플레이를 끈 서버에서는 bcrypt 가 설치되어 있지 않아도 구동에 지장이 없게 하기 위함이다.
 * @returns {object} bcrypt 모듈
 */
let bcryptModule = null;
function getBcrypt() {
    if (!bcryptModule) bcryptModule = require('bcrypt');
    return bcryptModule;
}

/**
 * 디렉터리가 없으면 만든다.
 * @param {string} dirPath 디렉터리 경로
 * @returns {void}
 */
function ensureDirectory(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * JSON 파일을 읽어 객체로 돌려준다. 읽지 못하면 null 이다.
 * @param {string} filePath 파일 경로
 * @returns {object|null} 파싱한 객체
 */
function readJsonFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

/**
 * 객체를 JSON 파일로 저장한다.
 * @param {string} filePath 파일 경로
 * @param {object} value 저장할 객체
 * @returns {void}
 */
function writeJsonFile(filePath, value) {
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

/**
 * 0 이상 정수로 보정한다. 잘못된 값은 0 이 된다.
 * @param {*} value 검사할 값
 * @returns {number} 0 이상 정수
 */
function toWinPoint(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.floor(number));
}

/**
 * 난수 세션 토큰을 만든다. (128비트를 16진수 문자열로)
 * @returns {string} 세션 토큰
 */
function createToken() {
    return crypto.randomBytes(16).toString('hex');
}

/**************************************** 서비스 본체 ***************************************/

/**
 * 온라인 플레이 서비스를 만든다.
 * 기능을 끈 경우에는 저장 디렉터리도 만들지 않고 모든 요청을 거절한다.
 * @param {{enabled:boolean}} options 서비스 설정
 * @returns {{isEnabled:()=>boolean, handleApi:Function, handleUpgrade:Function, close:Function}} 서비스 객체
 */
function createService(options) {
    const enabled = options?.enabled === true;

    /** 로그인한 세션이다. 토큰을 열쇠로 쓰며 메모리에만 둔다. @type {Map<string, object>} */
    const sessions = new Map();
    /** 계정 ID(소문자) → 현재 세션 토큰. 중복 로그인을 찾는 데 쓴다. @type {Map<string, string>} */
    const sessionByAccount = new Map();
    /** 방 ID → 방 상태. 파일보다 이 메모리 값이 정본이다. @type {Map<string, object>} */
    const rooms = new Map();
    /** 닉네임 → 계정 ID(소문자). 닉네임 중복 검사에 쓴다. @type {Map<string, string>} */
    const nicknameIndex = new Map();
    /** 계정 ID(소문자) → 최근 비밀번호 실패 기록. 메모리에만 두므로 서버를 다시 켜면 사라진다. @type {Map<string, number[]>} */
    const loginFailures = new Map();

    let timer = null;

    // 기능을 켠 경우에만 저장 디렉터리를 준비한다.
    if (enabled) {
        ensureDirectory(ACCOUNT_ROOT);
        ensureDirectory(ROOM_ROOT);
        buildNicknameIndex();
        clearRoomDirectory();
        timer = setInterval(onTimerTick, 1000);
        // 서버 종료를 막지 않도록 타이머를 참조에서 제외한다.
        if (typeof timer.unref === 'function') timer.unref();
    }

    /**
     * 계정 디렉터리를 한 번 읽어 닉네임 색인을 만든다.
     * 닉네임은 대소문자를 구분하므로 디렉터리 이름으로 쓸 수 없어 메모리 색인이 필요하다.
     * @returns {void}
     */
    function buildNicknameIndex() {
        nicknameIndex.clear();
        let entries = [];
        try {
            entries = fs.readdirSync(ACCOUNT_ROOT, { withFileTypes: true });
        } catch {
            return;
        }
        entries.forEach((entry) => {
            if (!entry.isDirectory()) return;
            const account = readJsonFile(path.join(ACCOUNT_ROOT, entry.name, 'account.json'));
            if (account && typeof account.nickname === 'string') nicknameIndex.set(account.nickname, entry.name);
        });
    }

    /**
     * 이전 실행에서 남은 방 파일을 모두 지운다.
     * 접속자가 없는 방은 존재할 수 없으므로 서버 시작 시 항상 비운다.
     * @returns {void}
     */
    function clearRoomDirectory() {
        let entries = [];
        try {
            entries = fs.readdirSync(ROOM_ROOT);
        } catch {
            return;
        }
        entries.forEach((name) => {
            if (!name.endsWith('.json')) return;
            try {
                fs.unlinkSync(path.join(ROOM_ROOT, name));
            } catch {
                // 지우지 못한 파일은 메모리 상태와 무관하므로 무시한다.
            }
        });
    }

    /**************************************** 계정 ***************************************/

    /**
     * 계정 파일 경로를 만든다. 디렉터리 이름은 항상 ID 의 소문자다.
     * @param {string} accountId 계정 ID
     * @returns {string} account.json 경로
     */
    function getAccountFilePath(accountId) {
        return path.join(ACCOUNT_ROOT, accountId.toLowerCase(), 'account.json');
    }

    /**
     * 계정을 읽는다. 없으면 null 이다.
     * @param {string} accountId 계정 ID
     * @returns {object|null} 계정 객체
     */
    function loadAccount(accountId) {
        if (!ID_PATTERN.test(accountId)) return null;
        return readJsonFile(getAccountFilePath(accountId));
    }

    /**
     * 계정을 저장한다.
     * @param {object} account 계정 객체
     * @returns {void}
     */
    function saveAccount(account) {
        writeJsonFile(getAccountFilePath(account.id), account);
    }

    /**
     * 최근 5분 안의 비밀번호 실패 횟수를 센다. 오래된 기록은 이때 함께 정리한다.
     * @param {string} accountKey 계정 ID(소문자)
     * @returns {number} 최근 실패 횟수
     */
    function countRecentFailures(accountKey) {
        const now = Date.now();
        const records = (loginFailures.get(accountKey) || []).filter((time) => now - time < LOGIN_FAIL_WINDOW_MS);
        if (records.length > 0) loginFailures.set(accountKey, records);
        else loginFailures.delete(accountKey);
        return records.length;
    }

    /**
     * 비밀번호 실패를 기록한다.
     * @param {string} accountKey 계정 ID(소문자)
     * @returns {void}
     */
    function recordFailure(accountKey) {
        const records = (loginFailures.get(accountKey) || []).filter((time) => Date.now() - time < LOGIN_FAIL_WINDOW_MS);
        records.push(Date.now());
        loginFailures.set(accountKey, records);
    }

    /**
     * 회원가입 요청을 처리한다.
     * @param {object} payload 요청 본문
     * @returns {Promise<{status:number, body:object}>} 응답
     */
    async function signup(payload) {
        const id = typeof payload?.id === 'string' ? payload.id : '';
        const nickname = typeof payload?.nickname === 'string' ? payload.nickname : '';
        const password = typeof payload?.password === 'string' ? payload.password : '';

        // 프런트에서 이미 검사했더라도 서버에서 반드시 다시 본다.
        if (!ID_PATTERN.test(id)) return { status: 400, body: { ok: false, code: 'invalid_id' } };
        if (!NICKNAME_PATTERN.test(nickname)) return { status: 400, body: { ok: false, code: 'invalid_nickname' } };
        if (!SHA256_PATTERN.test(password)) return { status: 400, body: { ok: false, code: 'invalid_password' } };
        // ID 중복 검사는 대소문자를 가리지 않는다. (디렉터리 이름을 소문자로 맞춰 두어 파일시스템 종류와 무관하게 같다.)
        if (loadAccount(id)) return { status: 409, body: { ok: false, code: 'duplicate_id' } };
        // 닉네임은 대소문자를 가려 비교한다.
        if (nicknameIndex.has(nickname)) return { status: 409, body: { ok: false, code: 'duplicate_nickname' } };

        const account = {
            id,
            nickname,
            // 프런트가 sha256 으로 한 번 해시한 값을 서버에서 bcrypt 로 한 번 더 해시해 저장한다.
            password: await getBcrypt().hash(password, 10),
            winPoint: 0,
            createdAt: new Date().toISOString()
        };
        saveAccount(account);
        nicknameIndex.set(nickname, id.toLowerCase());
        return { status: 200, body: { ok: true } };
    }

    /**
     * 로그인 요청을 처리한다. 성공하면 세션 토큰을 발급한다.
     * @param {object} payload 요청 본문
     * @returns {Promise<{status:number, body:object}>} 응답
     */
    async function login(payload) {
        const id = typeof payload?.id === 'string' ? payload.id : '';
        const password = typeof payload?.password === 'string' ? payload.password : '';
        if (!ID_PATTERN.test(id) || !SHA256_PATTERN.test(password)) return { status: 400, body: { ok: false, code: 'invalid_request' } };

        const accountKey = id.toLowerCase();
        // 5분 안에 3회 이상 틀린 계정은 올바른 비밀번호로도 로그인할 수 없다.
        if (countRecentFailures(accountKey) >= LOGIN_FAIL_LIMIT) return { status: 423, body: { ok: false, code: 'account_locked' } };

        const account = loadAccount(id);
        // 없는 계정과 틀린 비밀번호를 구분해 알려 주지 않는다.
        if (!account || !(await getBcrypt().compare(password, String(account.password || '')))) {
            if (account) recordFailure(accountKey);
            return { status: 401, body: { ok: false, code: 'login_failed' } };
        }
        loginFailures.delete(accountKey);

        // 이미 로그인된 세션이 있으면 무효화한다.
        const previousToken = sessionByAccount.get(accountKey);
        if (previousToken) closeSession(previousToken, 'session_closed');

        const token = createToken();
        sessions.set(token, {
            token,
            accountId: account.id,
            accountKey,
            nickname: account.nickname,
            socket: null,
            roomId: null,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
            disconnectedAt: Date.now()
        });
        sessionByAccount.set(accountKey, token);
        return { status: 200, body: { ok: true, token, nickname: account.nickname, winPoint: toWinPoint(account.winPoint) } };
    }

    /**
     * 로그아웃 요청을 처리한다.
     * @param {object} payload 요청 본문
     * @returns {{status:number, body:object}} 응답
     */
    function logout(payload) {
        const token = typeof payload?.token === 'string' ? payload.token : '';
        if (sessions.has(token)) closeSession(token, null);
        return { status: 200, body: { ok: true } };
    }

    /**************************************** 세션 ***************************************/

    /**
     * 세션을 끝낸다. 방에서 내보내고 소켓도 닫는다.
     * @param {string} token 세션 토큰
     * @param {string|null} reason 소켓에 마지막으로 보낼 메시지 종류. null 이면 보내지 않는다.
     * @returns {void}
     */
    function closeSession(token, reason) {
        const session = sessions.get(token);
        if (!session) return;
        leaveRoom(session, true);
        if (session.socket) {
            if (reason) sendMessage(session.socket, { type: reason });
            closeSocket(session.socket);
            session.socket = null;
        }
        sessions.delete(token);
        if (sessionByAccount.get(session.accountKey) === token) sessionByAccount.delete(session.accountKey);
    }

    /**
     * 1초마다 연결 상태와 세션 만료를 점검한다.
     * @returns {void}
     */
    function onTimerTick() {
        const now = Date.now();
        sessions.forEach((session, token) => {
            const socket = session.socket;
            if (socket) {
                // 일정 시간 아무 메시지도 오지 않으면 끊긴 것으로 본다.
                if (now - socket.lastMessageAt > CONNECTION_TIMEOUT_MS) {
                    handleSocketClosed(socket);
                    return;
                }
                if (now - socket.lastPingAt > PING_INTERVAL_MS) {
                    socket.lastPingAt = now;
                    sendPing(socket);
                }
            } else if (now - session.disconnectedAt > SESSION_GRACE_MS) {
                // 소켓이 끊긴 채 유예 시간을 넘긴 세션은 만료한다.
                closeSession(token, null);
                return;
            }
            // 대기실·방에서 오래 조작이 없는 세션도 만료한다.
            if (now - session.lastActiveAt > SESSION_IDLE_MS) closeSession(token, 'session_closed');
        });
        // 게임 시작 준비 시간이 지난 방을 실제로 시작시킨다.
        rooms.forEach((room) => {
            if (room.prepareAt && now >= room.prepareAt) startGame(room);
        });
    }

    /**************************************** 방 ***************************************/

    /**
     * 방 파일 경로를 만든다.
     * @param {string} roomId 방 ID
     * @returns {string} 방 JSON 경로
     */
    function getRoomFilePath(roomId) {
        return path.join(ROOM_ROOT, `${roomId.toLowerCase()}.json`);
    }

    /**
     * 방 상태를 파일로 저장한다. 파일은 스냅샷이며 정본은 메모리다.
     * @param {object} room 방 상태
     * @returns {void}
     */
    function saveRoomFile(room) {
        try {
            writeJsonFile(getRoomFilePath(room.id), toRoomJson(room));
        } catch (error) {
            console.error('방 정보를 저장하지 못했습니다.', error);
        }
    }

    /**
     * 방 파일을 지운다.
     * @param {string} roomId 방 ID
     * @returns {void}
     */
    function removeRoomFile(roomId) {
        try {
            fs.unlinkSync(getRoomFilePath(roomId));
        } catch {
            // 이미 없는 파일이면 그대로 둔다.
        }
    }

    /**
     * 저장·전송용 방 정보를 만든다.
     * @param {object} room 방 상태
     * @returns {object} 방 JSON
     */
    function toRoomJson(room) {
        return {
            id: room.id,
            rule: room.rule,
            colorCount: room.colorCount,
            host: toMemberJson(room.host),
            guest: toMemberJson(room.guest),
            state: room.state,
            createdAt: room.createdAt
        };
    }

    /**
     * 방에 표시할 참가자 정보를 만든다.
     * @param {object|null} session 참가자 세션
     * @returns {object|null} 닉네임과 WIN POINT
     */
    function toMemberJson(session) {
        if (!session) return null;
        const account = loadAccount(session.accountId);
        return { id: session.accountId, nickname: session.nickname, winPoint: toWinPoint(account?.winPoint) };
    }

    /**
     * 대기실에 보여 줄 방 목록을 만든다. 한 자리가 남은(참여자가 없는) 대기 중인 방만 담는다.
     * @returns {object[]} 방 목록
     */
    function getRoomList() {
        return Array.from(rooms.values())
            .filter((room) => room.state === 'waiting' && !room.guest)
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(0, ROOM_LIST_LIMIT)
            .map((room) => ({ id: room.id, rule: room.rule, colorCount: room.colorCount, hostNickname: room.host.nickname }));
    }

    /**
     * 대기실에 있는 모든 세션에 방 목록을 밀어 준다. (클라이언트는 폴링하지 않는다.)
     * @returns {void}
     */
    function broadcastRoomList() {
        const list = getRoomList();
        sessions.forEach((session) => {
            if (session.socket && !session.roomId) sendMessage(session.socket, { type: 'room_list', rooms: list });
        });
    }

    /**
     * 방 안의 두 사람에게 현재 방 상태를 보낸다.
     * @param {object} room 방 상태
     * @returns {void}
     */
    function broadcastRoomState(room) {
        [room.host, room.guest].forEach((member) => {
            if (!member?.socket) return;
            sendMessage(member.socket, { type: 'room_state', room: toRoomJson(room), youAreHost: member === room.host });
        });
    }

    /**
     * 방을 만든다.
     * @param {object} session 방을 만드는 세션
     * @param {object} payload 요청 메시지
     * @returns {void}
     */
    function createRoom(session, payload) {
        if (session.roomId) { sendError(session, 'already_in_room'); return; }
        if (rooms.size >= ROOM_LIMIT) { sendError(session, 'room_limit'); return; }
        const rule = ROOM_RULES.includes(payload?.rule) ? payload.rule : 'standard';
        const colorCount = [3, 4, 5].includes(payload?.colorCount) ? payload.colorCount : 4;
        // 방 고유 ID 는 방장의 계정 ID 를 쓴다.
        const room = {
            id: session.accountId,
            rule,
            colorCount,
            host: session,
            guest: null,
            state: 'waiting',
            createdAt: Date.now(),
            prepareAt: 0,
            game: null
        };
        rooms.set(room.id, room);
        session.roomId = room.id;
        saveRoomFile(room);
        broadcastRoomState(room);
        broadcastRoomList();
    }

    /**
     * 방에 참여한다.
     * @param {object} session 참여하는 세션
     * @param {object} payload 요청 메시지
     * @returns {void}
     */
    function joinRoom(session, payload) {
        if (session.roomId) { sendError(session, 'already_in_room'); return; }
        const room = rooms.get(typeof payload?.roomId === 'string' ? payload.roomId : '');
        if (!room) { sendError(session, 'room_not_found'); return; }
        if (room.guest || room.state !== 'waiting') { sendError(session, 'room_full'); return; }
        room.guest = session;
        session.roomId = room.id;
        saveRoomFile(room);
        broadcastRoomState(room);
        broadcastRoomList();
    }

    /**
     * 방에서 나간다. 방장이 나가면 참여자에게 방장 권한과 방 고유 ID 가 함께 넘어간다.
     * @param {object} session 나가는 세션
     * @param {boolean} silent 나가는 본인에게 알리지 않을지 여부
     * @returns {void}
     */
    function leaveRoom(session, silent) {
        const room = session.roomId ? rooms.get(session.roomId) : null;
        session.roomId = null;
        if (!room) return;

        const opponent = room.host === session ? room.guest : room.host;
        // 게임 중이었다면 남은 사람에게 상대가 나갔음을 알리고 대기실로 돌려보낸다. (승패·WIN POINT 변동 없음)
        const wasPlaying = room.state === 'playing' || room.prepareAt > 0;
        room.prepareAt = 0;
        room.game = null;

        if (!opponent) {
            // 남은 사람이 없으면 방을 없앤다.
            rooms.delete(room.id);
            removeRoomFile(room.id);
            broadcastRoomList();
            if (!silent && session.socket) sendMessage(session.socket, { type: 'room_closed' });
            return;
        }

        if (room.host === session) {
            // 방장이 나가면 참여자가 방장이 되며, 방 고유 ID 도 참여자의 계정 ID 로 바뀐다.
            rooms.delete(room.id);
            removeRoomFile(room.id);
            room.host = opponent;
            room.guest = null;
            room.id = opponent.accountId;
            opponent.roomId = room.id;
            rooms.set(room.id, room);
        } else {
            room.guest = null;
        }
        room.state = 'waiting';
        saveRoomFile(room);
        if (opponent.socket && wasPlaying) sendMessage(opponent.socket, { type: 'opponent_left' });
        broadcastRoomState(room);
        broadcastRoomList();
    }

    /**************************************** 게임 진행 ***************************************/

    /**
     * 방장이 보낸 시작 요청을 받아 음영처리 단계로 들어간다.
     * @param {object} session 요청한 세션
     * @returns {void}
     */
    function requestGameStart(session) {
        const room = session.roomId ? rooms.get(session.roomId) : null;
        if (!room) { sendError(session, 'room_not_found'); return; }
        if (room.host !== session) { sendError(session, 'not_host'); return; }
        if (!room.guest) { sendError(session, 'no_guest'); return; }
        if (room.state !== 'waiting') { sendError(session, 'already_playing'); return; }
        room.state = 'playing';
        room.prepareAt = Date.now() + GAME_PREPARE_MS;
        saveRoomFile(room);
        // 게임 중인 방은 대기실 목록에서 빠진다.
        broadcastRoomList();
        [room.host, room.guest].forEach((member) => {
            if (member.socket) sendMessage(member.socket, { type: 'game_prepare', delay: GAME_PREPARE_MS });
        });
    }

    /**
     * 뿌요 지급 덱을 만든다. 양측이 같은 덱을 같은 순서로 소비한다.
     * @param {number} colorCount 색상 수
     * @param {number} size 만들 쌍의 개수
     * @returns {string[][]} 뿌요 쌍 목록
     */
    function createDeck(colorCount, size) {
        const colors = PUYO_COLORS.slice(0, colorCount);
        const deck = [];
        for (let index = 0; index < size; index++) {
            deck.push([colors[crypto.randomInt(colors.length)], colors[crypto.randomInt(colors.length)]]);
        }
        return deck;
    }

    /**
     * 음영처리 시간이 끝난 방의 게임을 실제로 시작한다.
     * @param {object} room 방 상태
     * @returns {void}
     */
    function startGame(room) {
        room.prepareAt = 0;
        if (!room.guest) { cancelGame(room); return; }
        room.game = { startedAt: Date.now(), deck: createDeck(room.colorCount, DECK_SIZE), defeats: [], drawTimer: null };
        const message = {
            type: 'game_start',
            rule: room.rule,
            colorCount: room.colorCount,
            deck: room.game.deck,
            startedAt: room.game.startedAt
        };
        [room.host, room.guest].forEach((member) => {
            if (member.socket) sendMessage(member.socket, { ...message, youAreHost: member === room.host, opponent: toMemberJson(member === room.host ? room.guest : room.host) });
        });
    }

    /**
     * 준비 도중 상대가 나가는 등으로 게임을 시작하지 못했을 때 음영처리만 해제한다.
     * @param {object} room 방 상태
     * @returns {void}
     */
    function cancelGame(room) {
        room.prepareAt = 0;
        room.state = 'waiting';
        room.game = null;
        saveRoomFile(room);
        [room.host, room.guest].forEach((member) => {
            if (member?.socket) sendMessage(member.socket, { type: 'game_cancel' });
        });
        broadcastRoomState(room);
        broadcastRoomList();
    }

    /**
     * 같은 방의 상대 세션을 찾는다.
     * @param {object} session 기준 세션
     * @returns {object|null} 상대 세션
     */
    function getOpponent(session) {
        const room = session.roomId ? rooms.get(session.roomId) : null;
        if (!room) return null;
        return room.host === session ? room.guest : room.host;
    }

    /**
     * 조작·연쇄 결과처럼 그대로 상대에게 넘기면 되는 메시지를 중계한다.
     * @param {object} session 보낸 세션
     * @param {object} message 보낼 메시지
     * @returns {void}
     */
    function relayToOpponent(session, message) {
        const opponent = getOpponent(session);
        if (opponent?.socket) sendMessage(opponent.socket, message);
    }

    /**
     * 패배 보고를 받는다. 먼저 보고한 쪽이 패자이며, 아주 짧은 시간 안에 양쪽이 보고하면 무승부다.
     * @param {object} session 보고한 세션
     * @param {object} payload 요청 메시지
     * @returns {void}
     */
    function reportDefeat(session, payload) {
        const room = session.roomId ? rooms.get(session.roomId) : null;
        if (!room || !room.game || room.state !== 'playing') return;
        const game = room.game;
        if (game.defeats.some((entry) => entry.session === session)) return;
        game.defeats.push({ session, time: Number(payload?.time) || 0, at: Date.now() });

        // 첫 보고 뒤 아주 짧은 시간 동안 상대의 보고를 기다린다. 둘 다 오면 무승부다.
        if (game.defeats.length === 1) {
            game.drawTimer = setTimeout(() => finishGame(room), DRAW_WINDOW_MS);
            if (typeof game.drawTimer.unref === 'function') game.drawTimer.unref();
            return;
        }
        if (game.drawTimer) { clearTimeout(game.drawTimer); game.drawTimer = null; }
        finishGame(room);
    }

    /**
     * WIN POINT 변경값을 계산한다. 계산식은 MAY_BE_LATER.md 를 따른다.
     * @param {number} mine 내 WIN POINT
     * @param {number} theirs 상대 WIN POINT
     * @param {boolean} won 이겼는지 여부
     * @returns {number} 변경값(음수 가능)
     */
    function calculateWinPointDelta(mine, theirs, won) {
        if (won) return Math.floor(3 + Math.max(0, theirs - mine) / 100);
        return Math.floor((1 + Math.max(0, mine - theirs) / 300) * -1);
    }

    /**
     * 게임 결과를 확정하고 WIN POINT 를 갱신한다.
     * @param {object} room 방 상태
     * @returns {void}
     */
    function finishGame(room) {
        const game = room.game;
        if (!game) return;
        room.game = null;
        room.state = 'waiting';

        const first = game.defeats[0];
        const second = game.defeats[1];
        // 두 보고의 게임 시각이 거의 같으면 무승부로 보고 WIN POINT 를 바꾸지 않는다.
        const draw = Boolean(second) && Math.abs(second.time - first.time) <= DRAW_WINDOW_MS;
        const loser = draw ? null : first.session;
        const winner = draw ? null : (room.host === loser ? room.guest : room.host);

        const results = new Map();
        if (draw || !winner || !loser) {
            [room.host, room.guest].forEach((member) => {
                if (member) results.set(member, { result: 'draw', delta: 0, winPoint: toWinPoint(loadAccount(member.accountId)?.winPoint) });
            });
        } else {
            const winnerAccount = loadAccount(winner.accountId);
            const loserAccount = loadAccount(loser.accountId);
            const winnerBefore = toWinPoint(winnerAccount?.winPoint);
            const loserBefore = toWinPoint(loserAccount?.winPoint);
            const winnerDelta = calculateWinPointDelta(winnerBefore, loserBefore, true);
            const loserDelta = calculateWinPointDelta(loserBefore, winnerBefore, false);
            // 계산 후 0 미만이면 0 으로 되돌린다. (0 이상 정수만 허용)
            const winnerAfter = Math.max(0, winnerBefore + winnerDelta);
            const loserAfter = Math.max(0, loserBefore + loserDelta);
            if (winnerAccount) { winnerAccount.winPoint = winnerAfter; saveAccount(winnerAccount); }
            if (loserAccount) { loserAccount.winPoint = loserAfter; saveAccount(loserAccount); }
            results.set(winner, { result: 'win', delta: winnerDelta, winPoint: winnerAfter });
            results.set(loser, { result: 'lose', delta: loserDelta, winPoint: loserAfter });
        }

        results.forEach((value, member) => {
            if (member.socket) sendMessage(member.socket, { type: 'game_result', ...value });
        });
        saveRoomFile(room);
        broadcastRoomState(room);
        broadcastRoomList();
    }

    /**************************************** WebSocket ***************************************/

    /**
     * WebSocket 업그레이드 요청을 처리한다.
     * @param {import('http').IncomingMessage} req HTTP 요청
     * @param {import('net').Socket} socket TCP 소켓
     * @returns {void}
     */
    function handleUpgrade(req, socket) {
        const requestPath = (req.url || '').split('?')[0];
        if (!enabled || requestPath !== '/apis/onlineplay/socket') {
            socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
            return;
        }
        const key = req.headers['sec-websocket-key'];
        if (req.headers.upgrade?.toLowerCase() !== 'websocket' || typeof key !== 'string') {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            return;
        }
        // RFC 6455 핸드셰이크 응답이다.
        const accept = crypto.createHash('sha1').update(key + WEBSOCKET_GUID).digest('base64');
        socket.write([
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${accept}`,
            '\r\n'
        ].join('\r\n'));
        socket.setNoDelay(true);

        const connection = {
            socket,
            buffer: Buffer.alloc(0),
            fragments: [],
            fragmentOpcode: 0,
            session: null,
            closed: false,
            lastMessageAt: Date.now(),
            lastPingAt: Date.now()
        };
        // 정해진 시간 안에 인증하지 않은 연결은 끊는다.
        connection.authTimer = setTimeout(() => {
            if (!connection.session) closeSocket(connection);
        }, AUTH_TIMEOUT_MS);
        if (typeof connection.authTimer.unref === 'function') connection.authTimer.unref();

        socket.on('data', (chunk) => onSocketData(connection, chunk));
        socket.on('close', () => handleSocketClosed(connection));
        socket.on('error', () => handleSocketClosed(connection));
    }

    /**
     * 소켓에서 받은 바이트를 모아 완성된 프레임마다 메시지를 처리한다.
     * @param {object} connection 연결 상태
     * @param {Buffer} chunk 받은 바이트
     * @returns {void}
     */
    function onSocketData(connection, chunk) {
        connection.lastMessageAt = Date.now();
        connection.buffer = Buffer.concat([connection.buffer, chunk]);
        // 버퍼가 지나치게 커지면 잘못된 요청으로 보고 끊는다.
        if (connection.buffer.length > MAX_FRAME_BYTES) { closeSocket(connection); return; }

        for (;;) {
            const frame = decodeFrame(connection.buffer);
            if (!frame) return;
            connection.buffer = connection.buffer.subarray(frame.totalLength);
            if (frame.opcode === 0x8) { closeSocket(connection); return; }
            if (frame.opcode === 0x9) { sendPong(connection, frame.payload); continue; }
            if (frame.opcode === 0xA) continue;

            // 단편화된 메시지는 모두 모은 뒤 한 번에 처리한다.
            if (frame.opcode === 0x0) connection.fragments.push(frame.payload);
            else { connection.fragments = [frame.payload]; connection.fragmentOpcode = frame.opcode; }
            if (!frame.fin) continue;

            const payload = Buffer.concat(connection.fragments);
            connection.fragments = [];
            if (connection.fragmentOpcode !== 0x1) continue;
            let message = null;
            try {
                message = JSON.parse(payload.toString('utf-8'));
            } catch {
                continue;
            }
            handleMessage(connection, message);
        }
    }

    /**
     * 받은 바이트에서 완성된 프레임 하나를 꺼낸다. 아직 부족하면 null 이다.
     * @param {Buffer} buffer 받은 바이트
     * @returns {{opcode:number, fin:boolean, payload:Buffer, totalLength:number}|null} 프레임
     */
    function decodeFrame(buffer) {
        if (buffer.length < 2) return null;
        const fin = (buffer[0] & 0x80) !== 0;
        const opcode = buffer[0] & 0x0f;
        const masked = (buffer[1] & 0x80) !== 0;
        let length = buffer[1] & 0x7f;
        let offset = 2;
        if (length === 126) {
            if (buffer.length < offset + 2) return null;
            length = buffer.readUInt16BE(offset);
            offset += 2;
        } else if (length === 127) {
            if (buffer.length < offset + 8) return null;
            // 게임 메시지는 작으므로 상위 4바이트는 쓰지 않는다.
            length = Number(buffer.readBigUInt64BE(offset));
            offset += 8;
        }
        const maskLength = masked ? 4 : 0;
        if (buffer.length < offset + maskLength + length) return null;
        const mask = masked ? buffer.subarray(offset, offset + 4) : null;
        offset += maskLength;
        const payload = Buffer.from(buffer.subarray(offset, offset + length));
        // 브라우저가 보내는 프레임은 반드시 마스킹되어 있으므로 여기서 되돌린다.
        if (mask) for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4];
        return { opcode, fin, payload, totalLength: offset + length };
    }

    /**
     * 서버에서 클라이언트로 보내는 프레임을 만든다. (서버 프레임은 마스킹하지 않는다.)
     * @param {number} opcode 프레임 종류
     * @param {Buffer} payload 보낼 내용
     * @returns {Buffer} 프레임 바이트
     */
    function encodeFrame(opcode, payload) {
        const length = payload.length;
        let header = null;
        if (length < 126) {
            header = Buffer.alloc(2);
            header[1] = length;
        } else if (length < 65536) {
            header = Buffer.alloc(4);
            header[1] = 126;
            header.writeUInt16BE(length, 2);
        } else {
            header = Buffer.alloc(10);
            header[1] = 127;
            header.writeBigUInt64BE(BigInt(length), 2);
        }
        header[0] = 0x80 | opcode;
        return Buffer.concat([header, payload]);
    }

    /**
     * JSON 메시지 하나를 보낸다.
     * @param {object} connection 연결 상태
     * @param {object} message 보낼 메시지
     * @returns {void}
     */
    function sendMessage(connection, message) {
        if (!connection || connection.closed) return;
        try {
            connection.socket.write(encodeFrame(0x1, Buffer.from(JSON.stringify(message), 'utf-8')));
        } catch {
            handleSocketClosed(connection);
        }
    }

    /**
     * 연결 확인용 ping 을 보낸다.
     * @param {object} connection 연결 상태
     * @returns {void}
     */
    function sendPing(connection) {
        if (!connection || connection.closed) return;
        try {
            connection.socket.write(encodeFrame(0x9, Buffer.alloc(0)));
        } catch {
            handleSocketClosed(connection);
        }
    }

    /**
     * 받은 ping 에 pong 으로 답한다.
     * @param {object} connection 연결 상태
     * @param {Buffer} payload ping 이 담고 있던 내용
     * @returns {void}
     */
    function sendPong(connection, payload) {
        if (!connection || connection.closed) return;
        try {
            connection.socket.write(encodeFrame(0xA, payload));
        } catch {
            handleSocketClosed(connection);
        }
    }

    /**
     * 소켓을 닫는다.
     * @param {object} connection 연결 상태
     * @returns {void}
     */
    function closeSocket(connection) {
        if (!connection || connection.closed) return;
        connection.closed = true;
        if (connection.authTimer) clearTimeout(connection.authTimer);
        try {
            connection.socket.end(encodeFrame(0x8, Buffer.alloc(0)));
        } catch {
            // 이미 끊어진 소켓이면 그대로 둔다.
        }
    }

    /**
     * 소켓이 끊겼을 때 세션에서 떼어 낸다.
     * 세션 자체는 유예 시간 동안 남겨 두어 같은 토큰으로 다시 연결할 수 있게 한다.
     * @param {object} connection 연결 상태
     * @returns {void}
     */
    function handleSocketClosed(connection) {
        if (!connection) return;
        const session = connection.session;
        connection.session = null;
        if (!connection.closed) closeSocket(connection);
        if (!session || session.socket !== connection) return;
        session.socket = null;
        session.disconnectedAt = Date.now();
        // 게임 중이거나 방에 있었다면 상대에게 알리고 방을 정리한다.
        leaveRoom(session, true);
    }

    /**
     * 오류 코드를 보낸다.
     * @param {object} session 대상 세션
     * @param {string} code 오류 코드
     * @returns {void}
     */
    function sendError(session, code) {
        if (session?.socket) sendMessage(session.socket, { type: 'error', code });
    }

    /**
     * 받은 메시지 하나를 처리한다.
     * @param {object} connection 연결 상태
     * @param {object} message 받은 메시지
     * @returns {void}
     */
    function handleMessage(connection, message) {
        const type = typeof message?.type === 'string' ? message.type : '';

        // 인증 전에는 auth 메시지만 받는다.
        if (!connection.session) {
            if (type !== 'auth') { closeSocket(connection); return; }
            const session = sessions.get(typeof message.token === 'string' ? message.token : '');
            if (!session) {
                sendMessage(connection, { type: 'error', code: 'invalid_token' });
                closeSocket(connection);
                return;
            }
            // 같은 세션의 이전 소켓이 남아 있으면 새 연결로 교체한다.
            if (session.socket && session.socket !== connection) closeSocket(session.socket);
            if (connection.authTimer) clearTimeout(connection.authTimer);
            connection.session = session;
            session.socket = connection;
            session.lastActiveAt = Date.now();
            sendMessage(connection, { type: 'auth_ok', nickname: session.nickname, winPoint: toWinPoint(loadAccount(session.accountId)?.winPoint) });
            sendMessage(connection, { type: 'room_list', rooms: getRoomList() });
            return;
        }

        const session = connection.session;
        session.lastActiveAt = Date.now();

        switch (type) {
            case 'room_list':
                sendMessage(connection, { type: 'room_list', rooms: getRoomList() });
                break;
            case 'room_create':
                createRoom(session, message);
                break;
            case 'room_join':
                joinRoom(session, message);
                break;
            case 'room_leave':
                leaveRoom(session, false);
                sendMessage(connection, { type: 'room_list', rooms: getRoomList() });
                break;
            case 'game_start_request':
                requestGameStart(session);
                break;
            case 'input':
                // 조작은 그대로 상대에게 넘긴다. 판정은 각 클라이언트가 같은 덱으로 진행한다.
                relayToOpponent(session, { type: 'opponent_input', time: message.time, kind: message.kind, value: message.value });
                break;
            case 'chain_result':
                relayToOpponent(session, { type: 'opponent_chain', time: message.time, attack: message.attack, allClear: message.allClear, fever: message.fever });
                break;
            case 'defeat':
                reportDefeat(session, message);
                break;
            default:
                break;
        }
    }

    /**************************************** HTTP API ***************************************/

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
                if (Buffer.byteLength(body, 'utf8') > 64 * 1024) {
                    reject(new Error('요청 본문이 너무 큽니다.'));
                    req.destroy();
                }
            });
            req.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : {});
                } catch (error) {
                    reject(error);
                }
            });
            req.on('error', reject);
        });
    }

    /**
     * /apis/onlineplay/... HTTP 요청을 처리한다.
     * @param {import('http').IncomingMessage} req HTTP 요청
     * @param {import('http').ServerResponse} res HTTP 응답
     * @returns {Promise<void>} 처리 완료 시점
     */
    async function handleApi(req, res) {
        const sendJson = (status, body) => {
            res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(body), 'utf-8');
        };
        // 기능을 끈 서버에서는 온라인 플레이 요청을 아예 받지 않는다.
        if (!enabled) { sendJson(404, { ok: false, code: 'online_play_disabled' }); return; }
        if (req.method !== 'POST') { sendJson(405, { ok: false, code: 'method_not_allowed' }); return; }

        const action = (req.url || '').split('?')[0].split('/')[3] || '';
        let payload = null;
        try {
            payload = await readBody(req);
        } catch {
            sendJson(400, { ok: false, code: 'invalid_body' });
            return;
        }

        try {
            if (action === 'signup') { const result = await signup(payload); sendJson(result.status, result.body); return; }
            if (action === 'login') { const result = await login(payload); sendJson(result.status, result.body); return; }
            if (action === 'logout') { const result = logout(payload); sendJson(result.status, result.body); return; }
            sendJson(404, { ok: false, code: 'not_found' });
        } catch (error) {
            console.error('온라인 플레이 API 처리 중 오류가 발생했습니다.', error);
            sendJson(500, { ok: false, code: 'server_error' });
        }
    }

    /**
     * 서비스가 쓰던 타이머를 정리한다.
     * @returns {void}
     */
    function close() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    return { isEnabled: () => enabled, handleApi, handleUpgrade, close };
}

module.exports = { createService };
