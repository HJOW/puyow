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
 *     5. Local AI (솔로몬)
 *            src/onnx/default.onnx 모델 파일이 있으면 게임 설정의 AI 서비스 제공자에서 "Local AI"를 고를 수 있고,
 *            적 선택 화면에서 솔로몬과 대전할 수 있다. 모델 경로는 LOCAL_AI_MODEL_PATH 상수로 바꾼다.
 *            추론에는 npm install 로 설치되는 onnxruntime-node 패키지를 쓴다. 모델 파일이 없으면 Local AI만 사용 불가가 된다.
 *            극한 난이도의 "역으로 모델 학습"은 지원하지 않는다. (/apis/solomonlearning 요청은 받기만 한다)
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
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
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

/**************************************** Local AI(솔로몬) API 구현 시작 ***************************************/
// python/pythonserver.py 의 /v1/chat/completions·/apis/localmodelinfo 를 옮긴 구현이다.
// 파이썬 서버는 .pt 체크포인트를 torch로 추론하지만, 이 서버는 같은 가치망을 내보낸 ONNX 파일을
// npm 의존성인 onnxruntime-node로 추론한다.

/** Local AI가 추론에 사용할 ONNX 가치망 파일 경로. 파이썬 서버의 default.pt 대신 이 파일을 쓴다. */
const LOCAL_AI_MODEL_PATH = path.join(WEB_ROOT, 'onnx', 'default.onnx');
/** Local AI 추론에 쓰는 npm 패키지 이름. 모델 서비스를 쓸 때만 불러오므로 설치되지 않아도 나머지 API는 동작한다. */
const ONNX_RUNTIME_PACKAGE = 'onnxruntime-node';
/** 착지 뒤 연쇄·ATTACK 계산을 게임과 똑같이 하려고 불러오는 게임 코어 스크립트 경로. */
const PUYOW_CORE_PATH = path.join(WEB_ROOT, 'js', 'puyow.js');
/** ONNX 모델 입력 텐서 이름. puyow.js의 OnnxEnemy가 쓰는 이름과 같다. */
const ONNX_INPUT_NAME = 'observation';
/** ONNX 모델 출력 텐서 이름. puyow.js의 OnnxEnemy가 쓰는 이름과 같다. */
const ONNX_OUTPUT_NAME = 'value';
/** 이 토큰을 루프백 주소에서 보내면 PUYOW_AI_TOKEN과 무관하게 Local AI API를 허용한다. 게임의 Local AI 고정 키와 같다. */
const LOOPBACK_BYPASS_TOKEN = 'localhost';

// 아래 값은 python/common.py의 관측·행동 계약과 같아야 한다. 계약이 달라지면 모델을 다시 학습해야 한다.
const BOARD_WIDTH = 6;
const BOARD_HEIGHT = 12;
const ROTATION_COUNT = 4;
const ACTION_COUNT = BOARD_WIDTH * ROTATION_COUNT;
const PUYO_COLORS = ['red', 'green', 'yellow', 'blue', 'purple'];
const BOARD_CHANNELS = PUYO_COLORS.length + 2;
const OBSERVATION_SCALAR_COUNT = 14;
const OBSERVATION_SIZE = BOARD_WIDTH * BOARD_HEIGHT * BOARD_CHANNELS + PUYO_COLORS.length * 2 + OBSERVATION_SCALAR_COUNT;
const OBSERVATION_SCALES = {
    attack: 30, turn: 100, damage: 30, elapsedMs: 600000, marginRate: 70, timeMultiplierLog2: 10,
    feverGauge: 7, feverNextTime: 30, feverTargetCombo: 12, feverLeftTime: 60000
};
/** 즉시 보상과 애프터스테이트 가치를 합칠 때 쓰는 감가율(common.py DISCOUNT_GAMMA). */
const DISCOUNT_GAMMA = 0.70;
/** 싹쓸이 티켓을 쓴 폭발에 더하는 ATTACK(learning.py ALL_CLEAR_TICKET_ATTACK). */
const ALL_CLEAR_TICKET_ATTACK = 30;
/** 행동 번호의 회전별 두 번째 뿌요 위치다. 0: 위, 1: 오른쪽, 2: 아래, 3: 왼쪽. */
const ROTATION_OFFSETS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
/** 진행 중인 게임이 없을 때 puyow.js가 ATTACK 계산에 쓰는 마진 레이트다. 관측값의 마진 레이트로 환산할 때 쓴다. */
const GAME_DEFAULT_MARGIN_RATE = 70;
/** puyow.js 보드의 전체 행 수(숨김 행 포함)다. 게임 코어에 넘길 보드를 이 크기로 만든다. */
const GAME_BOARD_ROWS = 25;

/** 불러온 ONNX 런타임과 추론 세션의 약속. 로드에 실패하면 비워서 다음 요청에서 다시 시도한다. */
let localAiSessionPromise = null;
/** puyow.js의 공통 계산 함수 모음. 첫 추론 때 한 번만 불러온다. */
let puyowCommon = null;

/**
 * 상태 코드를 가진 API 오류를 만든다.
 * @param {string} message 응답에 담을 오류 메시지
 * @param {number} [statusCode=400] HTTP 상태 코드
 * @returns {Error} statusCode 속성을 가진 오류
 */
function createApiError(message, statusCode = 400) {
    return Object.assign(new Error(message), { statusCode });
}

/** @param {*} value 검사할 값 @returns {boolean} 배열이 아닌 일반 객체 여부 */
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {*} value 검사할 값 @param {number} min 최솟값 @param {number} max 최댓값(미포함) @returns {boolean} 범위 안의 정수 여부 */
function isIntegerInRange(value, min, max) {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value < max;
}

/** @returns {boolean} Local AI 모델 파일이 실제로 있는지 여부 */
function isLocalAiModelConfigured() {
    return Boolean(fs.statSync(LOCAL_AI_MODEL_PATH, { throwIfNoEntry: false })?.isFile());
}

/**
 * 요청을 보낸 소켓 주소가 루프백 주소인지 확인한다.
 * X-Forwarded-For는 요청자가 임의로 넣을 수 있으므로 실제 소켓 주소만 본다.
 * @param {string|undefined} address 소켓 원격 주소
 * @returns {boolean} 루프백 주소 여부
 */
function isLoopbackAddress(address) {
    const normalized = String(address || '').replace(/^::ffff:/i, '');
    return normalized === '::1' || normalized.startsWith('127.');
}

/**
 * Local AI API 요청의 Bearer 토큰을 검증한다. python/pythonserver.py 의 is_learning_authorized()와 같은 규칙이다.
 * @param {import('http').IncomingMessage} req HTTP 요청 객체
 * @returns {boolean} 루프백에서 보낸 localhost 토큰이거나 PUYOW_AI_TOKEN과 일치하면 true
 */
function isLocalAiAuthorized(req) {
    const authorization = req.headers.authorization || '';
    if (!authorization.startsWith('Bearer ')) return false;
    if (authorization.substring('Bearer '.length) === LOOPBACK_BYPASS_TOKEN && isLoopbackAddress(req.socket.remoteAddress)) return true;
    return isLearningAuthorized(req);
}

/** @returns {object} puyow.js의 공통 계산 함수 모음(PuyoW.common) */
function getPuyowCommon() {
    if (!puyowCommon) puyowCommon = require(PUYOW_CORE_PATH).common;
    return puyowCommon;
}

/**
 * ONNX 런타임과 Local AI 모델 세션을 불러온다. 한 번 성공하면 같은 세션을 계속 쓴다.
 * @returns {Promise<{ort:object, session:object}>} 런타임과 추론 세션
 */
function getLocalAiSession() {
    if (!localAiSessionPromise) {
        localAiSessionPromise = (async () => {
            // 네이티브 런타임은 모델 서비스를 쓸 때만 불러온다. 패키지나 모델 파일에 문제가 있어도 서버 기동과 다른 API는 영향을 받지 않는다.
            const ort = require(ONNX_RUNTIME_PACKAGE);
            if (!isLocalAiModelConfigured()) throw new Error(`모델 파일을 찾을 수 없습니다: ${LOCAL_AI_MODEL_PATH}`);
            getPuyowCommon();
            const session = await ort.InferenceSession.create(LOCAL_AI_MODEL_PATH, {
                executionProviders: ['cpu'],
                // 여러 후보를 한 배치로 넣을 때마다 출력 축 경고가 나오는 그래프라 오류만 기록한다(puyow.js와 같다).
                logSeverityLevel: 3
            });
            if (!session.inputNames.includes(ONNX_INPUT_NAME) || !session.outputNames.includes(ONNX_OUTPUT_NAME)) {
                throw new Error(`모델의 입출력 이름이 ${ONNX_INPUT_NAME}/${ONNX_OUTPUT_NAME}이 아닙니다.`);
            }
            return { ort, session };
        })().catch((error) => {
            localAiSessionPromise = null;
            throw error;
        });
    }
    return localAiSessionPromise;
}

/**
 * 애프터스테이트 관측 벡터들의 가치를 한 번에 추론한다.
 * @param {number[][]} observations 528개 관측 벡터 목록
 * @returns {Promise<number[]>} 관측 벡터별 가치
 */
async function runLocalAiModel(observations) {
    const { ort, session } = await getLocalAiSession();
    const data = new Float32Array(observations.length * OBSERVATION_SIZE);
    observations.forEach((observation, index) => data.set(observation, index * OBSERVATION_SIZE));
    const tensor = new ort.Tensor('float32', data, [observations.length, OBSERVATION_SIZE]);
    let outputs = null;
    try {
        outputs = await session.run({ [ONNX_INPUT_NAME]: tensor });
        const values = outputs[ONNX_OUTPUT_NAME]?.data;
        if (!values || values.length !== observations.length) throw new Error(`추론 출력 길이 오류: ${values?.length} != ${observations.length}`);
        return Array.from(values, Number);
    } finally {
        tensor.dispose?.();
        if (outputs) Object.values(outputs).forEach((output) => output?.dispose?.());
    }
}

/** 숫자 상태를 0~1로 정규화한다(common.py _clamp_ratio). @param {*} value 값 @param {number} maximum 상한 @returns {number} 정규화 값 */
function clampRatio(value, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(Math.max(number, 0), maximum) / maximum;
}

/** 칸 값을 관측 채널 번호로 바꾼다(common.py _cell_channel). @param {*} cell 칸 값 @returns {number} 0: 빈 칸, 1: 방해뿌요, 2~6: 색 */
function getCellChannel(cell) {
    if (cell === null || cell === undefined) return 0;
    const colorIndex = PUYO_COLORS.indexOf(cell);
    // 학습 범위 밖인 hardGarbage·iron도 방해뿌요처럼 점유된 칸으로 본다.
    return colorIndex >= 0 ? colorIndex + 2 : 1;
}

/** @param {object} source 읽을 객체 @param {string} key 키 @param {*} fallback 키가 없을 때 값 @returns {*} 파이썬 dict.get()과 같은 값 */
function getOrDefault(source, key, fallback) {
    return Object.prototype.hasOwnProperty.call(source, key) ? source[key] : fallback;
}

/**
 * 학습기·파이썬 서버와 같은 528개 관측 벡터를 만든다(common.py encode_observation_values).
 * @param {object} state 보드(y=0이 바닥, 최소 12행), 조작 쌍, 스칼라 상태
 * @returns {number[]} 관측 벡터
 */
function encodeObservationValues(state) {
    const values = [];
    for (let channel = 0; channel < BOARD_CHANNELS; channel += 1) {
        for (let y = 0; y < BOARD_HEIGHT; y += 1) {
            for (let x = 0; x < BOARD_WIDTH; x += 1) values.push(getCellChannel(state.board[y][x]) === channel ? 1 : 0);
        }
    }
    state.pair.forEach((color) => {
        const channel = getCellChannel(color);
        // 조작 쌍이 없으면(null) 채널 0이므로 모든 색 값이 0으로 남는다.
        PUYO_COLORS.forEach((_, candidate) => values.push(channel === candidate + 2 ? 1 : 0));
    });
    const fever = isPlainObject(state.fever) ? state.fever : {};
    const multiplier = Math.max(1, Number(state.timeProgressMultiplier || 1));
    if (Number.isNaN(multiplier)) throw createApiError('관측 상태가 올바르지 않습니다: timeProgressMultiplier');
    values.push(
        clampRatio(state.attack, OBSERVATION_SCALES.attack),
        clampRatio(state.turn, OBSERVATION_SCALES.turn),
        clampRatio(state.incomingDamage, OBSERVATION_SCALES.damage),
        state.feverRule ? 1 : 0,
        state.allClearTicket ? 1 : 0,
        clampRatio(state.elapsedMs, OBSERVATION_SCALES.elapsedMs),
        clampRatio(state.marginRate, OBSERVATION_SCALES.marginRate),
        clampRatio(Math.log2(multiplier), OBSERVATION_SCALES.timeMultiplierLog2),
        getOrDefault(fever, 'active', false) ? 1 : 0,
        clampRatio(getOrDefault(fever, 'gauge', 0), OBSERVATION_SCALES.feverGauge),
        clampRatio(getOrDefault(fever, 'nextTime', 15), OBSERVATION_SCALES.feverNextTime),
        clampRatio(getOrDefault(fever, 'targetCombo', 5), OBSERVATION_SCALES.feverTargetCombo),
        clampRatio(getOrDefault(fever, 'leftTime', 0), OBSERVATION_SCALES.feverLeftTime),
        clampRatio(getOrDefault(fever, 'damage', 0), OBSERVATION_SCALES.damage)
    );
    return values;
}

/** 관측 벡터의 보드를 정수 보드로 되돌린다(common.py decode_observation_board). @param {number[]} values 관측 벡터 @returns {number[][]} -1: 빈 칸, -2: 방해뿌요, 0~4: 색 */
function decodeObservationBoard(values) {
    const cells = BOARD_WIDTH * BOARD_HEIGHT;
    return Array.from({ length: BOARD_HEIGHT }, (_, y) => Array.from({ length: BOARD_WIDTH }, (__, x) => {
        const index = y * BOARD_WIDTH + x;
        let channel = 0;
        for (let candidate = 1; candidate < BOARD_CHANNELS; candidate += 1) {
            if (values[candidate * cells + index] > values[channel * cells + index]) channel = candidate;
        }
        return channel === 0 ? -1 : channel === 1 ? -2 : channel - 2;
    }));
}

/** 관측 벡터의 현재 쌍을 색 번호 쌍으로 되돌린다(common.py decode_observation_pair). @param {number[]} values 관측 벡터 @returns {number[]} 색 번호 두 개 */
function decodeObservationPair(values) {
    const base = BOARD_WIDTH * BOARD_HEIGHT * BOARD_CHANNELS;
    return [0, 1].map((order) => {
        const offset = base + order * PUYO_COLORS.length;
        let best = 0;
        for (let color = 1; color < PUYO_COLORS.length; color += 1) {
            if (values[offset + color] > values[offset + best]) best = color;
        }
        return values[offset + best] > 0.5 ? best : 0;
    });
}

/** 관측 벡터 끝 14개 스칼라를 원래 단위로 되돌린다(common.py decode_observation_scalars). @param {number[]} values 관측 벡터 @returns {object} 스칼라 상태 */
function decodeObservationScalars(values) {
    const base = BOARD_WIDTH * BOARD_HEIGHT * BOARD_CHANNELS + PUYO_COLORS.length * 2;
    const scalar = (index) => values[base + index];
    return {
        attack: scalar(0) * OBSERVATION_SCALES.attack,
        turn: scalar(1) * OBSERVATION_SCALES.turn,
        incomingDamage: scalar(2) * OBSERVATION_SCALES.damage,
        feverRule: scalar(3) >= 0.5,
        allClearTicket: scalar(4) >= 0.5,
        elapsedMs: scalar(5) * OBSERVATION_SCALES.elapsedMs,
        marginRate: scalar(6) * OBSERVATION_SCALES.marginRate,
        timeProgressMultiplier: 2 ** (scalar(7) * OBSERVATION_SCALES.timeMultiplierLog2),
        feverActive: scalar(8) >= 0.5,
        feverGauge: scalar(9) * OBSERVATION_SCALES.feverGauge,
        feverNextTime: scalar(10) * OBSERVATION_SCALES.feverNextTime,
        feverTargetCombo: scalar(11) * OBSERVATION_SCALES.feverTargetCombo,
        feverLeftTime: scalar(12) * OBSERVATION_SCALES.feverLeftTime,
        feverDamage: scalar(13) * OBSERVATION_SCALES.damage
    };
}

/** 관측 벡터의 열 높이로 한 행동의 기본 착지 가능 여부를 판별한다(common.py is_legal_observation_action). @param {number[]} values 관측 벡터 @param {number} action 행동 번호 @returns {boolean} 가능 여부 */
function isLegalObservationAction(values, action) {
    const x = Math.floor(action / ROTATION_COUNT);
    const rotation = action % ROTATION_COUNT;
    const heights = Array.from({ length: BOARD_WIDTH }, (_, column) => {
        let height = 0;
        for (let y = 0; y < BOARD_HEIGHT; y += 1) if (values[y * BOARD_WIDTH + column] < 0.5) height += 1;
        return height;
    });
    if (rotation === 0 || rotation === 2) return heights[x] <= BOARD_HEIGHT - 2;
    if (rotation === 1) return x + 1 < BOARD_WIDTH && heights[x] < BOARD_HEIGHT && heights[x + 1] < BOARD_HEIGHT;
    return x > 0 && heights[x] < BOARD_HEIGHT && heights[x - 1] < BOARD_HEIGHT;
}

/**
 * 12행 보드에서 한 쌍의 두 칸이 놓일 좌표를 구한다(bundledenemy.py find_landing_placement).
 * 각 칸을 자기 열의 현재 높이 위에 놓으며, 뜬 칸은 이어지는 중력 정산에서 내려간다.
 * @param {number[][]} board 정수 보드
 * @param {number} action 행동 번호
 * @returns {{x:number,y:number}[]|null} 축 뿌요와 두 번째 뿌요 좌표. 놓을 수 없으면 null
 */
function findLandingPositions(board, action) {
    const x = Math.floor(action / ROTATION_COUNT);
    const [dx, dy] = ROTATION_OFFSETS[action % ROTATION_COUNT];
    const secondX = x + dx;
    if (x < 0 || x >= BOARD_WIDTH || secondX < 0 || secondX >= BOARD_WIDTH) return null;
    const columnHeight = (column) => board.reduce((count, row) => count + (row[column] !== -1 ? 1 : 0), 0);
    if (dx === 0) {
        const height = columnHeight(x);
        if (height + 1 >= BOARD_HEIGHT) return null;
        const bottom = { x, y: height };
        const top = { x, y: height + 1 };
        return dy > 0 ? [bottom, top] : [top, bottom];
    }
    const pivotHeight = columnHeight(x);
    const secondHeight = columnHeight(secondX);
    if (pivotHeight >= BOARD_HEIGHT || secondHeight >= BOARD_HEIGHT) return null;
    return [{ x, y: pivotHeight }, { x: secondX, y: secondHeight }];
}

/**
 * 한 행동의 애프터스테이트 관측 벡터와 즉시 보상을 만든다(learning.py _build_afterstate).
 * 착지 뒤 연쇄·ATTACK 계산은 puyow.js의 simulatePlacementResult()를 그대로 쓴다.
 * @param {number[][]} board 정수 보드
 * @param {number[]} pair 현재 쌍 색 번호
 * @param {object} scalars decodeObservationScalars() 결과
 * @param {number} action 행동 번호
 * @param {(string|null)[]} nextPair 애프터스테이트의 조작 쌍 자리에 넣을 다음 쌍
 * @returns {{action:number, reward:number, observation:number[]}|null} 놓을 수 없으면 null
 */
function buildAfterstate(board, pair, scalars, action, nextPair) {
    const positions = findLandingPositions(board, action);
    if (!positions) return null;
    const common = getPuyowCommon();
    const gameBoard = Array.from({ length: GAME_BOARD_ROWS }, (_, y) => Array.from({ length: BOARD_WIDTH }, (__, x) => {
        const cell = y < BOARD_HEIGHT ? board[y][x] : -1;
        return cell === -1 ? null : cell === -2 ? 'garbage' : PUYO_COLORS[cell];
    }));
    const result = common.simulatePlacementResult(gameBoard, pair.map((color) => PUYO_COLORS[color]), positions);
    if (!result?.board) return null;
    const combo = result.combo;
    // 게임 코어는 진행 중인 게임이 없으면 기본 마진 레이트·시간 배율 1로 계산하므로, 관측값의 값으로 환산한다.
    let attack = result.attack * GAME_DEFAULT_MARGIN_RATE / Math.max(1, scalars.marginRate) * Math.max(1, scalars.timeProgressMultiplier);
    const feverRule = scalars.feverRule;
    const feverActive = feverRule && scalars.feverActive;
    // 피버 중에는 피버 필드 전용 미정산 피해가 그 시점의 실제 피해량이다.
    const damage = feverActive ? scalars.feverDamage : scalars.incomingDamage;
    let ticket = scalars.allClearTicket;
    // 아래 세 보정은 learning.py PuyoDuelEnvironment.step()과 같은 순서여야 보상이 어긋나지 않는다.
    if (feverRule && combo > 0 && attack < 1 && damage >= 1) attack = 1;
    if (combo > 0 && !feverRule && ticket) {
        attack += ALL_CLEAR_TICKET_ATTACK;
        ticket = false;
    }
    if (combo > 0 && !feverRule && common.isAllClearBoard(result.board)) ticket = true;
    const remainingDamage = damage - Math.min(Math.floor(attack), Math.floor(damage));
    const fever = {
        active: feverActive, gauge: scalars.feverGauge, nextTime: scalars.feverNextTime,
        targetCombo: scalars.feverTargetCombo, leftTime: scalars.feverLeftTime,
        damage: feverActive ? remainingDamage : scalars.feverDamage
    };
    const observation = encodeObservationValues({
        board: result.board, pair: nextPair, attack, turn: scalars.turn + 1, incomingDamage: remainingDamage,
        feverRule, allClearTicket: ticket, elapsedMs: scalars.elapsedMs, marginRate: scalars.marginRate,
        timeProgressMultiplier: scalars.timeProgressMultiplier, fever: feverRule ? fever : null
    });
    // common.py move_reward(): 같은 ATTACK이라도 더 긴 연쇄를 높게 본다.
    return { action, reward: attack + combo * combo, observation };
}

/**
 * 솔로몬 프롬프트의 필드·현재 쌍·상태를 관측 벡터로 바꾼다(pythonserver.py build_model_observation).
 * @param {object} prompt 솔로몬 배치 프롬프트
 * @returns {number[]} 관측 벡터
 */
function buildModelObservation(prompt) {
    const field = prompt.currentField;
    const supplied = prompt.suppliedPuyos;
    if (!isPlainObject(field) || !Array.isArray(supplied)) throw createApiError('Solomon 필드 또는 제공 뿌요 정보가 없습니다.');
    if (!Array.isArray(field.occupiedCells)) throw createApiError('currentField.occupiedCells는 배열이어야 합니다.');
    const board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
    field.occupiedCells.forEach((cell) => {
        if (!isPlainObject(cell)) throw createApiError('occupiedCells 항목은 객체여야 합니다.');
        if (!isIntegerInRange(cell.x, 0, BOARD_WIDTH)) throw createApiError('occupiedCells.x가 보드 범위를 벗어났습니다.');
        if (!isIntegerInRange(cell.y, 0, Infinity)) throw createApiError('occupiedCells.y가 올바르지 않습니다.');
        if (typeof cell.color !== 'string' || !cell.color) throw createApiError('occupiedCells.color가 올바르지 않습니다.');
        // 관측 계약은 화면에 보이는 12행만 사용한다.
        if (cell.y < BOARD_HEIGHT) board[cell.y][cell.x] = cell.color;
    });
    const current = supplied.find((entry) => isPlainObject(entry) && entry.order === 'current')?.colors;
    if (!Array.isArray(current) || current.length !== 2 || current.some((color) => !PUYO_COLORS.includes(color))) {
        throw createApiError('현재 뿌요 쌍은 두 개의 색으로 제공되어야 합니다.');
    }
    const state = isPlainObject(prompt.currentState) ? prompt.currentState : {};
    return encodeObservationValues({
        board, pair: current,
        attack: getOrDefault(state, 'attack', 0),
        turn: getOrDefault(state, 'placedPairCount', 0),
        incomingDamage: getOrDefault(state, 'incomingDamage', 0),
        feverRule: getOrDefault(state, 'feverRule', false),
        allClearTicket: getOrDefault(state, 'allClearTicket', false),
        elapsedMs: getOrDefault(state, 'elapsedMs', 0),
        marginRate: getOrDefault(state, 'marginRate', 70),
        timeProgressMultiplier: getOrDefault(state, 'timeProgressMultiplier', 1),
        fever: state.fever
    });
}

/** 프롬프트의 next_1 쌍을 읽는다. 없으면 색을 비운 쌍이다(pythonserver.py build_model_next_pair). @param {object} prompt 솔로몬 배치 프롬프트 @returns {(string|null)[]} 다음 쌍 */
function buildModelNextPair(prompt) {
    const supplied = Array.isArray(prompt.suppliedPuyos) ? prompt.suppliedPuyos : [];
    const colors = supplied.find((entry) => isPlainObject(entry) && entry.order === 'next_1')?.colors;
    if (!Array.isArray(colors) || colors.length !== 2 || colors.some((color) => !PUYO_COLORS.includes(color))) return [null, null];
    return [colors[0], colors[1]];
}

/** 게임이 보낸 usablePlacements를 행동 번호 집합으로 바꾼다(pythonserver.py parse_usable_actions). @param {*} value 배치 목록 @returns {Set<number>|null} 항목이 없으면 null */
function parseUsableActions(value) {
    if (value === undefined || value === null) return null;
    if (!Array.isArray(value) || !value.length || value.length > ACTION_COUNT) throw createApiError(`usablePlacements는 1~${ACTION_COUNT}개의 배치 목록이어야 합니다.`);
    const actions = new Set();
    value.forEach((item) => {
        if (!isPlainObject(item)) throw createApiError('usablePlacements 항목은 객체여야 합니다.');
        if (!isIntegerInRange(item.x, 0, BOARD_WIDTH)) throw createApiError('usablePlacements.x가 보드 범위를 벗어났습니다.');
        if (!isIntegerInRange(item.rotation, 0, ROTATION_COUNT)) throw createApiError(`usablePlacements.rotation은 0부터 ${ROTATION_COUNT - 1} 사이여야 합니다.`);
        actions.add(item.x * ROTATION_COUNT + item.rotation);
    });
    return actions;
}

/**
 * 놓을 수 있는 배치 중 `즉시 보상 + 감가된 가치`가 가장 큰 행동을 고른다(learning.py select_afterstate).
 * usablePlacements가 오면 관측값의 높이 조건 대신 게임이 알려 준 후보만 본다.
 * @param {object} prompt 솔로몬 배치 프롬프트
 * @returns {Promise<number>} 행동 번호(열*4+회전)
 */
async function chooseLocalAiAction(prompt) {
    const observation = buildModelObservation(prompt);
    const nextPair = buildModelNextPair(prompt);
    const usableActions = parseUsableActions(prompt.usablePlacements);
    const board = decodeObservationBoard(observation);
    const pair = decodeObservationPair(observation);
    const scalars = decodeObservationScalars(observation);
    const candidates = usableActions
        ? [...usableActions].sort((left, right) => left - right)
        : Array.from({ length: ACTION_COUNT }, (_, action) => action).filter((action) => isLegalObservationAction(observation, action));
    const afterstates = candidates.map((action) => buildAfterstate(board, pair, scalars, action, nextPair)).filter(Boolean);
    if (!afterstates.length) {
        // 12행만으로는 착지시킬 수 없어도 게임이 쓸 수 있다고 알려 준 배치가 있으면 그중 하나를 돌려 대체 AI로 넘어가지 않게 한다.
        if (usableActions) return Math.min(...usableActions);
        throw createApiError('현재 필드에서 선택할 수 있는 행동이 없습니다.', 422);
    }
    let values;
    try {
        values = await runLocalAiModel(afterstates.map((afterstate) => afterstate.observation));
    } catch (error) {
        console.error('Local AI 모델 추론에 실패했습니다.', error);
        throw createApiError(`모델 추론에 실패했습니다: ${String(error.message).split('\n')[0]}`, 503);
    }
    let best = null;
    let bestScore = -Infinity;
    afterstates.forEach((afterstate, index) => {
        if (!Number.isFinite(values[index])) return;
        const score = afterstate.reward + DISCOUNT_GAMMA * values[index];
        if (score > bestScore) {
            bestScore = score;
            best = afterstate;
        }
    });
    if (!best) throw createApiError('모델 추론 결과에서 유효한 가치를 찾지 못했습니다.', 503);
    return best.action;
}

/**
 * 게임이 LM Studio 형식으로 보내는 구조화 출력 요청을 Local AI 모델로 처리한다(pythonserver.py chat_completions_api).
 * @param {import('http').IncomingMessage} req HTTP 요청 객체
 * @returns {Promise<{status:number, payload:object}>} 응답 상태와 본문
 */
async function chatCompletionsApi(req) {
    if (req.method !== 'POST') return { status: 405, payload: { error: { message: 'POST만 지원합니다.', type: 'invalid_request_error' } } };
    if (!isLocalAiModelConfigured()) return { status: 404, payload: { error: { message: '모델 파일을 찾을 수 없습니다.', type: 'not_found_error' } } };
    if (!isLocalAiAuthorized(req)) return { status: 401, payload: { error: { message: '인증이 필요합니다.', type: 'authentication_error' } } };
    const payload = await readJsonBody(req);
    if (!isPlainObject(payload)) throw createApiError('JSON 본문은 객체여야 합니다.');
    if (typeof payload.model !== 'string' || !payload.model.trim()) throw createApiError('model은 비어 있지 않은 문자열이어야 합니다.');
    try {
        await getLocalAiSession();
    } catch (error) {
        // 오류 전체(모듈 경로가 담긴 require 스택 포함)는 서버 로그에만 남기고 응답에는 첫 줄만 보낸다.
        console.error('Local AI 모델을 불러오지 못했습니다.', error);
        throw createApiError(`모델을 불러올 수 없습니다: ${String(error.message).split('\n')[0]}`, 503);
    }
    const responseFormat = payload.response_format;
    if (!isPlainObject(responseFormat) || responseFormat.type !== 'json_schema') throw createApiError('response_format.type은 json_schema여야 합니다.');
    if (!isPlainObject(responseFormat.json_schema) || typeof responseFormat.json_schema.name !== 'string') throw createApiError('response_format.json_schema.name이 필요합니다.');
    const schemaName = responseFormat.json_schema.name;
    let content;
    if (schemaName === 'ai_api_test_result') {
        // 설정 화면의 AI API 테스트는 모델을 정상적으로 불러온 뒤 성공 JSON만 돌려준다.
        content = JSON.stringify({ success: true });
    } else if (schemaName === 'solomon_puyo_placement') {
        const messages = payload.messages;
        if (!Array.isArray(messages)) throw createApiError('messages는 배열이어야 합니다.');
        const userMessage = [...messages].reverse().find((message) => isPlainObject(message) && message.role === 'user' && typeof message.content === 'string');
        if (!userMessage) throw createApiError('문자열 content를 가진 user 메시지가 필요합니다.');
        let prompt;
        try {
            prompt = JSON.parse(userMessage.content);
        } catch (error) {
            throw createApiError('Solomon user 메시지는 JSON 객체여야 합니다.');
        }
        if (!isPlainObject(prompt)) throw createApiError('Solomon user 메시지는 JSON 객체여야 합니다.');
        // 이 서버는 역학습을 구현하지 않으므로 learningSessionId가 와도 수를 모으지 않는다.
        const action = await chooseLocalAiAction(prompt);
        content = JSON.stringify({ x: Math.floor(action / ROTATION_COUNT), rotation: action % ROTATION_COUNT });
    } else {
        throw createApiError(`지원하지 않는 JSON 스키마입니다: ${schemaName}`);
    }
    const now = Date.now() / 1000;
    return {
        status: 200,
        payload: {
            id: `chatcmpl-puyow-${now.toFixed(6)}`,
            object: 'chat.completion',
            created: Math.floor(now),
            model: payload.model,
            choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }]
        }
    };
}

/**
 * 이 서버가 Local AI 모델로 /v1/chat/completions 를 제공할 수 있는지 알려 주는 API 핸들러.
 * 모델 파일이 있고 실제로 불러올 수 있을 때만 사용 가능으로 응답한다.
 * @returns {Promise<{available:boolean}>} 로컬 모델 사용 가능 여부
 */
async function localModelInfoApi() {
    if (!isLocalAiModelConfigured()) return { available: false };
    try {
        await getLocalAiSession();
        return { available: true };
    } catch (error) {
        console.error('Local AI 모델을 불러오지 못했습니다.', error);
        return { available: false };
    }
}

/**
 * 극한 난이도 솔로몬 대전의 역학습 요청을 받는 API 핸들러.
 * 이 Node 서버는 역학습을 구현하지 않으므로 요청 내용을 처리하지 않고 성공만 응답한다.
 * 게임은 응답의 ok가 true가 아니면 콘솔에 오류를 남기므로 ok만은 true로 돌려준다.
 * @param {import('http').IncomingMessage} req HTTP 요청 객체
 * @returns {{ok:boolean, trained:boolean, transitions:number, reason:string}} 학습하지 않았다는 응답
 */
function solomonLearningApi(req) {
    req.resume();
    return { ok: true, trained: false, transitions: 0, reason: 'Node 서버는 솔로몬 역학습을 지원하지 않습니다.' };
}

/**
 * JSON 본문을 상태 코드와 함께 응답한다.
 * @param {import('http').ServerResponse} res HTTP 응답 객체
 * @param {number} status HTTP 상태 코드
 * @param {object} payload 응답 본문
 * @returns {void}
 */
function sendJson(res, status, payload) {
    if (res.headersSent) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload), 'utf-8');
}

/**************************************** Local AI(솔로몬) API 구현 끝 ***************************************/

// 학습 이벤트 API, 로컬 모델 사용 가능 여부 확인 API, 솔로몬 역학습 API(요청만 받음)다.
const apis = { learning: learningApi, localmodelinfo: localModelInfoApi, solomonlearning: solomonLearningApi };

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

    // 게임이 LM Studio 형식으로 보내는 Local AI(솔로몬·AI API 테스트) 요청 처리
    if(url.split('?')[0] === '/v1/chat/completions') {
        chatCompletionsApi(req).then(({ status, payload }) => sendJson(res, status, payload)).catch((error) => {
            if (!error.statusCode) console.error(error);
            sendJson(res, error.statusCode || 500, {
                error: {
                    message: error.statusCode ? error.message : 'Chat Completions 처리 중 오류가 발생했습니다.',
                    type: error.statusCode ? 'invalid_request_error' : 'server_error'
                }
            });
        });
        return;
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
        case '.wasm': contentType = 'application/wasm'; break;
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
