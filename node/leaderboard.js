/**
 * 리더보드 서버 기능이다. 게임이 로컬 스토리지에 남기는 기록을 서버에도 함께 모아,
 * 리더보드 화면(src/leaderboard.html)에서 "온라인" 기록으로 볼 수 있게 한다.
 * 여기서 말하는 "온라인"은 온라인 대전이 아니라, 사람들이 각자 로컬에서 플레이한 기록을
 * 이 서버가 한곳에 모아 둔 것을 뜻한다. 계정·로그인은 없고 게임 설정의 닉네임만 쓴다.
 *
 * 파일 입출력은 leaderboard_storage.js 의 FileLeaderboardStorage 가 맡고,
 * 이 파일은 닉네임·기록 검증과 순위 병합, HTTP 요청 처리만 담당한다.
 * 파이썬 서버(python/leaderboard.py)도 같은 규칙과 같은 응답 형식을 쓴다.
 *
 * Copyright 2026 HJOW
 * Licensed under the Apache License, Version 2.0
 */
const { FileLeaderboardStorage } = require('./leaderboard_storage');

/** 기록 대상 룰이다. battle 이 true 인 룰은 AI 난이도·적까지 나눠 순위를 둔다. src/js/puyow.js 의 LEADERBOARD_RULES 와 같아야 한다. */
const RULES = Object.freeze({
    standard: true,
    fever: true,
    fever_start: true,
    practice: false,
    continuous_fever: false
});
/** 대전 룰 기록을 나누는 AI 난이도 키다. src/js/puyow.js 의 AI_DIFFICULTIES 와 같아야 한다. */
const DIFFICULTY_KEYS = Object.freeze(['easy', 'normal', 'hard', 'extreme']);
/** 기록할 수 있는 색 수다. */
const COLOR_COUNTS = Object.freeze([3, 4, 5]);
/** 한 순위(룰·AI 난이도·색 수·적)마다 남길 최대 기록 수다. 게임의 LEADERBOARD_MAX_ENTRIES 와 같은 값이다. */
const MAX_ENTRIES = 10;
/** 닉네임으로 받아들일 최대 글자 수다. 게임의 PLAYER_NAME_MAX_LENGTH(10)보다 넉넉하게 둔다. */
const NICKNAME_MAX_LENGTH = 20;
/** 적 classType 으로 받아들일 최대 글자 수다. 외부 확장 적도 들어올 수 있어 여유를 둔다. */
const OPPONENT_MAX_LENGTH = 64;
/** 적 classType 에 허용할 문자다. 파일명으로 쓰지는 않지만 응답에 그대로 나가므로 범위를 좁힌다. */
const OPPONENT_PATTERN = /^[A-Za-z0-9_]{1,64}$/;
/** 한 사람의 파일에 남길 최대 기록 수다. 순위마다 10개씩 남겨도 파일이 끝없이 커지지 않도록 막는다. */
const MAX_RECORDS_PER_PLAYER = 2000;

/**
 * 파일 이름으로 쓸 수 없는 문자다. 게임 설정 화면의 PLAYER_NAME_FORBIDDEN_PATTERN 과 같은 범위를 막고,
 * 경로를 벗어나게 할 수 있는 문자까지 함께 거른다. 제어 문자도 파일 이름으로 쓸 수 없다.
 */
const NICKNAME_FORBIDDEN_PATTERN = /[\\/:*?"<>|'!.\u0000-\u001F\u007F]/u;

/**
 * 닉네임을 파일 이름으로 쓸 수 있는지 확인한다.
 * 금지 문자가 하나라도 있으면 저장하지 않는다. (게임 설정 화면에서도 같은 문자를 막는다.)
 * @param {unknown} value 요청으로 들어온 닉네임
 * @returns {string|null} 쓸 수 있으면 다듬은 닉네임, 아니면 null
 */
function normalizeNickname(value) {
    if (typeof value !== 'string') return null;
    const nickname = value.trim();
    if (!nickname || nickname.length > NICKNAME_MAX_LENGTH) return null;
    if (NICKNAME_FORBIDDEN_PATTERN.test(nickname)) return null;
    // 윈도우는 이름 끝의 공백·마침표를 지워 버리므로 다른 파일과 겹칠 수 있다. 점은 위에서 이미 막았다.
    if (nickname !== nickname.trimEnd()) return null;
    return nickname;
}

/**
 * 요청으로 들어온 기록 한 줄을 검사해 저장할 형태로 만든다.
 * @param {object} payload 요청 본문
 * @returns {{rule:string, difficulty:string|null, colors:number, opponent:string|null, score:number}|null} 검사한 기록, 잘못된 값이면 null
 */
function normalizeRecord(payload) {
    const rule = typeof payload?.rule === 'string' ? payload.rule : '';
    if (!Object.prototype.hasOwnProperty.call(RULES, rule)) return null;
    const battle = RULES[rule];
    const colors = Number(payload?.colors);
    if (!COLOR_COUNTS.includes(colors)) return null;
    const score = Number(payload?.score);
    if (!Number.isFinite(score) || score < 0) return null;
    const difficulty = typeof payload?.difficulty === 'string' ? payload.difficulty : null;
    const opponent = typeof payload?.opponent === 'string' ? payload.opponent : null;
    if (battle) {
        // 적이 있는 대전은 AI 난이도와 적이 모두 있어야 순위를 나눌 수 있다.
        if (!difficulty || !DIFFICULTY_KEYS.includes(difficulty)) return null;
        if (!opponent || opponent.length > OPPONENT_MAX_LENGTH || !OPPONENT_PATTERN.test(opponent)) return null;
        return { rule, difficulty, colors, opponent, score: Math.floor(score) };
    }
    // 단독 룰에는 AI 난이도·적 단계가 없다. 값이 들어와도 버린다.
    return { rule, difficulty: null, colors, opponent: null, score: Math.floor(score) };
}

/**
 * 순위를 나누는 열쇠다. 같은 열쇠끼리 점수 순으로 겨룬다.
 * @param {{rule:string, difficulty:string|null, colors:number, opponent:string|null}} record 기록
 * @returns {string} 열쇠
 */
function getBucketKey(record) {
    return [record.rule, record.difficulty || '', record.colors, record.opponent || ''].join('\u0000');
}

/**
 * 저장된 기록 배열을 검사해 정리한다. 알 수 없는 값은 버린다.
 * @param {unknown} list 저장된 값
 * @returns {object[]} 정리한 기록 목록
 */
function normalizeStoredRecords(list) {
    if (!Array.isArray(list)) return [];
    const records = [];
    list.forEach((item) => {
        const record = normalizeRecord(item);
        if (!record) return;
        const recordedAt = Number(item?.recordedAt);
        if (!Number.isFinite(recordedAt) || recordedAt < 0) return;
        records.push({ ...record, recordedAt: Math.floor(recordedAt) });
    });
    return records;
}

/**
 * 순위마다 점수 내림차순 상위 MAX_ENTRIES 개만 남긴다.
 * @param {object[]} records 기록 목록
 * @returns {object[]} 정리한 기록 목록
 */
function trimRecords(records) {
    const buckets = new Map();
    records.forEach((record) => {
        const key = getBucketKey(record);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(record);
    });
    const trimmed = [];
    buckets.forEach((list) => {
        // 점수 내림차순이 먼저고, 동점은 먼저 기록한 쪽이 앞이다.
        list.sort((left, right) => right.score - left.score || left.recordedAt - right.recordedAt);
        list.slice(0, MAX_ENTRIES).forEach((record) => trimmed.push(record));
    });
    return trimmed.slice(0, MAX_RECORDS_PER_PLAYER);
}

/**
 * 리더보드 서비스를 만든다. 기능을 끈 경우에는 저장 디렉터리도 만들지 않고 모든 요청을 거절한다.
 * @param {{enabled:boolean, storage?:object}} options 서비스 설정
 * @returns {{isEnabled:Function, handleApi:Function, addRecord:Function, getRecords:Function, getStats:Function}} 서비스 객체
 */
function createService(options) {
    const enabled = options?.enabled === true;
    // 저장소는 교체 가능하며 비활성 상태에서는 초기화하지 않는다.
    const storage = options?.storage || new FileLeaderboardStorage();

    if (enabled) storage.initialize();

    /**
     * 기록 하나를 그 사람의 파일에 더한다. 기록 일시는 요청값을 믿지 않고 서버 시각으로 정한다.
     * node.js 는 단일 스레드이고 저장소가 동기 입출력을 쓰므로, 읽고 고쳐 쓰는 이 묶음은
     * 다른 요청에 끼어들지 않고 한 번에 끝난다.
     * @param {object} payload 요청 본문
     * @returns {{status:number, body:object}} 응답
     */
    function addRecord(payload) {
        const nickname = normalizeNickname(payload?.nickname);
        // 파일 이름으로 쓸 수 없는 닉네임은 저장하지 않는다.
        if (!nickname) return { status: 400, body: { ok: false, code: 'invalid_nickname' } };
        const record = normalizeRecord(payload);
        if (!record) return { status: 400, body: { ok: false, code: 'invalid_record' } };

        const stored = storage.loadPlayer(nickname);
        const records = normalizeStoredRecords(stored?.records);
        records.push({ ...record, recordedAt: Date.now() });
        const player = { version: 1, nickname, records: trimRecords(records) };
        storage.savePlayer(player);
        return { status: 200, body: { ok: true, recorded: true, recordedAt: new Date().toISOString() } };
    }

    /**
     * 저장된 모든 사람의 기록을 리더보드 화면이 그대로 쓸 수 있는 형태로 모은다.
     * 응답의 records 구조는 게임이 localStorage 에 두는 puyow_leaderboard 의 records 와 같다.
     * @returns {{status:number, body:object}} 응답
     */
    function getRecords() {
        const records = {};
        storage.listPlayers().forEach((player) => {
            const nickname = normalizeNickname(player?.nickname);
            if (!nickname) return;
            normalizeStoredRecords(player.records).forEach((record) => {
                const byRule = records[record.rule] ||= {};
                const colorKey = String(record.colors);
                const list = record.difficulty
                    ? ((byRule[record.difficulty] ||= {})[colorKey] ||= {})[record.opponent] ||= []
                    : byRule[colorKey] ||= [];
                list.push({ name: nickname, score: record.score, recordedAt: record.recordedAt });
            });
        });
        // 순위마다 점수 내림차순 상위 MAX_ENTRIES 개만 남긴다.
        const trimList = (list) => list.sort((left, right) => right.score - left.score || left.recordedAt - right.recordedAt).slice(0, MAX_ENTRIES);
        Object.keys(records).forEach((ruleKey) => {
            const byRule = records[ruleKey];
            Object.keys(byRule).forEach((secondKey) => {
                if (Array.isArray(byRule[secondKey])) { byRule[secondKey] = trimList(byRule[secondKey]); return; }
                const byColor = byRule[secondKey];
                Object.keys(byColor).forEach((colorKey) => {
                    const byEnemy = byColor[colorKey];
                    Object.keys(byEnemy).forEach((enemyKey) => { byEnemy[enemyKey] = trimList(byEnemy[enemyKey]); });
                });
            });
        });
        return { status: 200, body: { ok: true, version: 2, maxEntries: MAX_ENTRIES, records } };
    }

    /**
     * 요청 본문을 JSON 으로 읽는다.
     * @param {import('http').IncomingMessage} req HTTP 요청
     * @returns {Promise<object>} 파싱한 본문
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
                    const payload = body ? JSON.parse(body) : {};
                    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('본문은 객체여야 합니다.');
                    resolve(payload);
                } catch (error) {
                    reject(error);
                }
            });
            req.on('error', reject);
        });
    }

    /**
     * /apis/leaderboard/... HTTP 요청을 처리한다.
     * record 는 POST, records 는 GET 이다.
     * @param {import('http').IncomingMessage} req HTTP 요청
     * @param {import('http').ServerResponse} res HTTP 응답
     * @returns {Promise<void>} 처리 완료 시점
     */
    async function handleApi(req, res) {
        const sendJson = (status, body) => {
            res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(body), 'utf-8');
        };
        // 기능을 끈 서버에서는 리더보드 요청을 아예 받지 않는다.
        if (!enabled) { sendJson(404, { ok: false, code: 'leaderboard_disabled' }); return; }
        const action = (req.url || '').split('?')[0].split('/')[3] || '';
        try {
            if (action === 'records') {
                if (req.method !== 'GET' && req.method !== 'HEAD') { sendJson(405, { ok: false, code: 'method_not_allowed' }); return; }
                req.resume();
                const result = getRecords();
                sendJson(result.status, result.body);
                return;
            }
            if (action === 'record') {
                if (req.method !== 'POST') { sendJson(405, { ok: false, code: 'method_not_allowed' }); return; }
                let payload = null;
                try {
                    payload = await readBody(req);
                } catch {
                    sendJson(400, { ok: false, code: 'invalid_body' });
                    return;
                }
                const result = addRecord(payload);
                sendJson(result.status, result.body);
                return;
            }
            req.resume();
            sendJson(404, { ok: false, code: 'not_found' });
        } catch (error) {
            console.error('리더보드 API 처리 중 오류가 발생했습니다.', error);
            sendJson(500, { ok: false, code: 'server_error' });
        }
    }

    /**
     * 관리 화면 대시보드에 보여 줄 요약이다.
     * @returns {{enabled:boolean, players:number, records:number}} 요약
     */
    function getStats() {
        if (!enabled) return { enabled: false, players: 0, records: 0 };
        const players = storage.listPlayers();
        return {
            enabled: true,
            players: players.length,
            records: players.reduce((total, player) => total + normalizeStoredRecords(player.records).length, 0)
        };
    }

    return { isEnabled: () => enabled, handleApi, addRecord, getRecords, getStats };
}

module.exports = { createService, normalizeNickname, normalizeRecord, MAX_ENTRIES };
