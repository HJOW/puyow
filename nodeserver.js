/**
 * node.js 기반 웹 서버 기동
 *
 * 사용법)
 *     1. 사전 준비
 *            node.js 를 설치한다.
 * 
 *     2. 서버 실행 (명령 프롬프트 / 터미널로 이 프로젝트 최상위 디렉토리로 접근하여 수행)
 *            npm start
 * 
 *     3. 서버 종료
 *            프로세스를 종료시키거나, 해당 명령 프롬프트 / 터미널 창에서 CTRL+C 입력
 *
 *     4. 포트 지정하여 서버 실행 (포트 미지정 시 기본 포트 9891 사용)
 *
 * 필요사항)
 *     1. node.js 사전 설치 필요
 *     2. 명령 프롬프트 / 터미널에서, cd 명령어로 프로젝트 최상위 디렉토리 (README.md 파일이 있는) 에 접근하여 수행해야 한다.
*/
/*

LICENSE

Copyright 2026 HJOW (hujinone22@naver.com)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. 
 
 */

const http = require('http')
const crypto = require('crypto');
const fs   = require('fs');
const path = require('path');

/*
로컬 게임 테스트를 위한 CORS 응답 헤더. 
인증 정보를 포함한 요청은 별도 허용 출처가 필요하므로
이 간이 서버에서는 자격 증명을 사용하지 않는 개발용 요청만 모든 출처에 공개.
*/
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600'
};

// 포트
let PORT = 9891;
// 웹 경로
const WEB_ROOT = path.join(__dirname, './src');

// 매개변수 검사
if(process.argv.length >= 3) { // process.argv 배열 1, 2번은 예약되어 있음, 3번부터 매개변수가 들어오기 시작함
    PORT = parseInt(process.argv[2]); // 첫 번째 매개변수로 포트 입력
}

// 이 문구들이 들어간 URL은 서비스 되지 않음
const blacklistFilePattern = [
    '/WEB-INF/',
    '/META-INF/'
];

/**************************************** 학습 API 구현 시작 ***************************************/

/** 학습 API가 허용하는 요청 본문의 최대 크기(바이트). */
const LEARNING_MAX_BODY_SIZE = 1024 * 1024;
/** 학습 API 인증에 사용할 Bearer 토큰. 서버 환경변수 PUYOW_AI_TOKEN에서 읽는다. */
const LEARNING_TOKEN = process.env.PUYOW_AI_TOKEN || '';
/** 학습 세션 ID별 마지막 관측값과 에피소드 누적 상태를 보관하는 메모리 저장소. */
const learningSessions = new Map();

/**
 * HTTP 요청 본문을 UTF-8 JSON 객체로 읽는다.
 * @param {import('http').IncomingMessage} req HTTP 요청 객체
 * @returns {Promise<object>} 파싱된 JSON 본문
 * @throws {Error} 본문이 너무 크거나 JSON 형식이 올바르지 않을 때 상태 코드를 가진 오류
 */
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            body += chunk;
            if (Buffer.byteLength(body, 'utf8') > LEARNING_MAX_BODY_SIZE) {
                reject(Object.assign(new Error('요청 본문이 너무 큽니다.'), { statusCode: 413 }));
                req.destroy();
            }
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(Object.assign(new Error('JSON 요청 본문이 올바르지 않습니다.'), { statusCode: 400, cause: error }));
            }
        });
        req.on('error', reject);
    });
}

/**
 * 학습 API 요청의 Bearer 토큰을 검증한다.
 * 토큰이 설정되지 않은 서버에서는 모든 요청을 인증 실패로 처리한다.
 * @param {import('http').IncomingMessage} req HTTP 요청 객체
 * @returns {boolean} 설정된 서버 토큰과 요청 토큰이 일치하면 true
 */
function isLearningAuthorized(req) {
    if (!LEARNING_TOKEN) return false;
    const authorization = req.headers.authorization || '';
    const prefix = 'Bearer ';
    if (!authorization.startsWith(prefix)) return false;
    const supplied = Buffer.from(authorization.substring(prefix.length));
    const expected = Buffer.from(LEARNING_TOKEN);
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

/**
 * 값이 유한한 숫자인지 검증한다.
 * @param {*} value 검증할 값
 * @param {string} name 오류 메시지에 사용할 필드명
 * @param {boolean} [integer=false] 정수만 허용할지 여부
 * @returns {void}
 * @throws {Error} 값이 요구한 숫자 형식이 아닐 때 상태 코드 400을 가진 오류
 */
function requireNumber(value, name, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
        throw Object.assign(new Error(`${name}은(는) 유효한 숫자여야 합니다.`), { statusCode: 400 });
    }
}

/**
 * 관측값이 유한한 숫자로 구성된 제한된 길이의 배열인지 검증한다.
 * @param {*} value 검증할 관측값
 * @param {string} name 오류 메시지에 사용할 필드명
 * @returns {void}
 * @throws {Error} 관측값 형식이 올바르지 않을 때 상태 코드 400을 가진 오류
 */
function requireObservation(value, name) {
    if (!Array.isArray(value) || value.length === 0 || value.length > 10000 || value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
        throw Object.assign(new Error(`${name}은(는) 유한한 숫자의 배열이어야 합니다.`), { statusCode: 400 });
    }
}

/**
 * 세션 ID에 해당하는 학습 세션을 조회하거나 새로 만든다.
 * @param {*} sessionId 학습 세션 식별자
 * @returns {{sequence:number, steps:number, reward:number, done:boolean, observation:number[]|null, updatedAt:string}} 학습 세션 상태
 * @throws {Error} 세션 ID가 1~128자의 문자열이 아닐 때 상태 코드 400을 가진 오류
 */
function getLearningSession(sessionId) {
    if (typeof sessionId !== 'string' || sessionId.length < 1 || sessionId.length > 128) {
        throw Object.assign(new Error('sessionId는 1~128자의 문자열이어야 합니다.'), { statusCode: 400 });
    }
    let session = learningSessions.get(sessionId);
    if (!session) {
        session = { sequence: 0, steps: 0, reward: 0, done: false, observation: null, updatedAt: new Date().toISOString() };
        learningSessions.set(sessionId, session);
    }
    return session;
}

/**
 * 관측값과 행동 전이를 수신하는 학습 API 핸들러.
 * reset, step, episode_end 이벤트를 세션별로 검증하고 누적한다.
 * @param {import('http').IncomingMessage} req HTTP 요청 객체
 * @param {import('http').ServerResponse} res HTTP 응답 객체
 * @returns {object|Promise<object>} API 응답 또는 비동기 API 응답
 */
function learningApi(req, res) {
    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Allow', 'POST');
        return { ok: false, error: 'POST만 지원합니다.' };
    }
    if (!isLearningAuthorized(req)) {
        res.statusCode = LEARNING_TOKEN ? 401 : 503;
        return { ok: false, error: LEARNING_TOKEN ? '인증이 필요합니다.' : 'PUYOW_AI_TOKEN이 설정되지 않았습니다.' };
    }
    return readJsonBody(req).then((payload) => {
        const { event, sessionId } = payload;
        const session = getLearningSession(sessionId);
        if (!['reset', 'step', 'episode_end'].includes(event)) {
            throw Object.assign(new Error('event는 reset, step, episode_end 중 하나여야 합니다.'), { statusCode: 400 });
        }
        if (event === 'reset') {
            requireObservation(payload.observation, 'observation');
            session.sequence = 0;
            session.steps = 0;
            session.reward = 0;
            session.done = false;
            session.observation = payload.observation;
        } else if (event === 'step') {
            requireObservation(payload.observation, 'observation');
            requireObservation(payload.nextObservation, 'nextObservation');
            requireNumber(payload.action, 'action', true);
            requireNumber(payload.reward, 'reward');
            if (typeof payload.done !== 'boolean') throw Object.assign(new Error('done은 boolean이어야 합니다.'), { statusCode: 400 });
            session.steps += 1;
            session.reward += payload.reward;
            session.done = payload.done;
            session.observation = payload.nextObservation;
        } else {
            if (typeof payload.done !== 'boolean' || !payload.done) throw Object.assign(new Error('episode_end의 done은 true여야 합니다.'), { statusCode: 400 });
            session.done = true;
        }
        session.sequence += 1;
        session.updatedAt = new Date().toISOString();
        return { ok: true, event, sessionId, sequence: session.sequence, steps: session.steps, totalReward: session.reward, done: session.done };
    }).catch((error) => {
        res.statusCode = error.statusCode || 500;
        return { ok: false, error: error.statusCode ? error.message : '학습 이벤트를 처리하지 못했습니다.' };
    });
}

/**************************************** 학습 API 구현 끝 ***************************************/

/**
 * 이 서버가 로컬 모델로 /v1/chat/completions 를 제공할 수 있는지 알려 주는 API 핸들러.
 * 이 Node 서버는 아직 /v1/chat/completions 를 구현하지 않으므로 항상 사용 불가로 응답한다.
 * @returns {{available:boolean}} 로컬 모델 사용 가능 여부
 */
function localModelInfoApi() {
    return { available: false };
}

// 학습 클라이언트가 실제 게임의 관측값과 전이를 전달하는 API와, 게임이 로컬 모델 사용 가능 여부를 확인하는 API다.
const apis = { learning: learningApi, localmodelinfo: localModelInfoApi };

// 서버 구동 시작 (종료 시에는 CTRL+C 단축키를 입력할 것)
const server = http.createServer((req, res) => {
    // 모든 정적·동적 응답에 CORS 헤더를 먼저 설정한다.
    Object.entries(CORS_HEADERS).forEach(([name, value]) => res.setHeader(name, value));

    // JSON POST 등 브라우저 preflight 요청에는 본문 없이 성공을 반환한다.
    if(req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // URL 경로 설정 (기본값: index.html)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const url = req.url;
    console.log('REQUEST : ' + url + ' by ' + ip);

    // blacklist 처리
    for(let idx=0; idx<blacklistFilePattern.length; idx++) {
        const blacklistOne = blacklistFilePattern[idx];
        if(url.indexOf(blacklistOne) >= 0) {
            res.writeHead(403, {'Content-Type': 'text/plain'});
            res.end('403 Forbidden');
            return;
        }
    }

    // 동적 URL 처리
    if(url.indexOf('/apis/') == 0) {
        let prefRemoved = url.substring(6);
        let nextSlash = prefRemoved.indexOf('/');
        if(nextSlash < 0) nextSlash = prefRemoved.length;

        let apiName = prefRemoved.substring(0, nextSlash);
        let funcObj = apis[apiName];

        if(typeof(funcObj) == 'undefined' || funcObj == null) {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end('404 Not Found');
            return;
        }

        Promise.resolve(funcObj(req, res)).then((results) => {
            if(typeof(results) === 'undefined') return;
            if(typeof(results) === 'object') results = JSON.stringify(results);
            if(typeof(results) != 'string') results = String(results);
            if (!res.headersSent) res.writeHead(res.statusCode >= 400 ? res.statusCode : 200, {'Content-Type': 'application/json'});
            res.end(results, 'utf-8');
        }).catch((error) => {
            if (res.headersSent) return;
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({ ok: false, error: 'API 처리 중 오류가 발생했습니다.' }), 'utf-8');
            console.error(error);
        });
        return;
    }

    // 정적 URL 처리
    let filePath = path.join(WEB_ROOT, req.url === '/' ? 'index.html' : req.url);

    // 위 filePath 에는 URL 매개변수 Query String 이 포함되어 있을수가 있음. Query String 분리
    const queryIndex = filePath.indexOf('?');
    let queryString = '';
    if(queryIndex >= 0) {
        queryString = filePath.substring(queryIndex + 1);
        filePath = filePath.substring(0, queryIndex);
    }

    // 파일 확장자 추출
    const extname = path.extname(filePath);
    let contentType = 'application/octet-stream';

    switch (extname) {
        case '.html': contentType = 'text/html'; break;
        case '.htm': contentType = 'text/html'; break;
        case '.txt': contentType = 'text/plain'; break;
        case '.js': contentType = 'text/javascript'; break;
        case '.mjs': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.json5': contentType = 'application/json5'; break;
        case '.xml': contentType = 'application/xml'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpeg'; break;
        case '.gif': contentType = 'image/gif'; break;
        case '.ico': contentType = 'image/vnd.microsoft.icon'; break;
        case '.mp3': contentType = 'audio/mpeg'; break;
        case '.ogg': contentType = 'audio/ogg'; break;
        case '.wav': contentType = 'audio/wav'; break;
        case '.mp4': contentType = 'video/mp4'; break;
        case '.weba': contentType = 'audio/webm'; break;
        case '.webm': contentType = 'video/webm'; break;
        case '.webp': contentType = 'image/webp'; break;
        case '.ttf': contentType = 'font/ttf'; break;
        case '.otf': contentType = 'font/otf'; break;
        case '.woff': contentType = 'font/woff'; break;
        case '.woff2': contentType = 'font/woff2'; break;
        case '.zip': contentType = 'application/zip'; break;
        case '.7z': contentType = 'application/x-7z-compressed'; break;
        case '.gz': contentType = 'application/gzip'; break;
        case '.jar': contentType = 'application/java-archive'; break;
        case '.csv': contentType = 'text/csv'; break;
        case '.pdf': contentType = 'application/pdf'; break;
        case '.docx': contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; break;
        case '.pptx': contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'; break;
        case '.xlsx': contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; break;
        case '.webmanifest': contentType = 'application/manifest+json'; break;
    }

    fs.readFile(filePath, (err, content) => {
        if(err) {
            if(err.code == 'ENOENT') {
                res.writeHead(404, {'Content-Type': 'text/plain'});
                res.end('404 Not Found');
                return;
            } else {
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        } else {
            res.writeHead(200, {'Content-Type': contentType});
            res.end(content, 'utf-8');
        }
    });
});

server.on('close', () => {
    console.log('Server with ' + PORT + ' will be shutdown !');
});

server.on('error', (err) => {
    console.log('Server with ' + PORT + ' error !');
    console.error(err);
});

server.listen(PORT, () => {
    console.log('Server in running with ' + PORT + ' port !');
    console.log('    WEB ROOT : ' + WEB_ROOT);
});
