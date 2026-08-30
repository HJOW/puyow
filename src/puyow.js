/**
 * @license Apache-2.0
 * Copyright 2026 HJOW
 * Licensed under the Apache License, Version 2.0.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * 
 * 뿌요 W 2D 버전 스크립트
 *     의존성
 *         puyow.css  (캔버스 영역이 화면 100%를 차지하게 만들고, 기본 뒷배경 색 변경)
 *         notice_ko.txt, notice_en.txt (선택사항으로 공지사항 존재 시 이 곳에 기재)
 *     html 예제
 *         puyow.html
 */

(() => {
    'use strict';

    /** 빌드 번호 @type {number} */
    const BUILDNO = 2;
    /** 게임 캔버스의 논리 너비다. @type {number} */
    const WIDTH = 1280;
    /** 게임 캔버스의 논리 높이다. @type {number} */
    const HEIGHT = 720;
    /** 한 필드의 가로 칸 수다. @type {number} */
    const COLUMNS = 6;
    /** 숨김 행을 포함한 한 필드의 전체 세로 칸 수다. @type {number} */
    const ROWS = 25;
    /** 화면에 보이는 필드의 세로 칸 수다. @type {number} */
    const VISIBLE_ROWS = 12;
    /** 피버 스테이지 데이터를 숨김 영역에서 떨어뜨리기 위해 더할 Y 좌표다. @type {number} */
    const FEVER_STAGE_SPAWN_Y_OFFSET = VISIBLE_ROWS;
    /** DAMAGE 방해뿌요가 생성될 최상단 숨김 행이다. @type {number} */
    const GARBAGE_SPAWN_MAX_ROW = ROWS - 5;
    /** DAMAGE 방해뿌요가 생성될 수 있는 가장 낮은 숨김 행이다. @type {number} */
    const GARBAGE_SPAWN_MIN_ROW = GARBAGE_SPAWN_MAX_ROW - 5;
    /** 시뮬레이터 그리기 모드에서 편집할 수 있는 줄 수다. 13번째 줄은 실행 중 베젤 뒤에 숨겨진다. @type {number} */
    const SIMULATOR_EDITABLE_ROWS = VISIBLE_ROWS + 1;
    /** 적 선택 화면 UI를 축소해 표시할 배율이다. @type {number} */
    const OPPONENT_MENU_SCALE = 0.9;
    /** 한 칸의 논리 픽셀 크기다. @type {number} */
    const CELL = 38;
    /** 패배 연출에서 필드 밖으로 더 떨어뜨릴 줄 수다. @type {number} */
    const DEFEAT_EXTRA_FALL_ROWS = 5;
    /** 메인 메뉴에서 갤러리 대상이 떠다니는 최소 개수다. 이 값을 바꾸면 추첨 범위가 함께 바뀐다. @type {number} */
    const MAIN_MENU_GALLERY_FLOATER_MIN_COUNT = 7;
    /** 메인 메뉴에서 갤러리 대상이 떠다니는 최대 개수다. 최소 개수 이상으로 설정한다. @type {number} */
    const MAIN_MENU_GALLERY_FLOATER_MAX_COUNT = 10;
    /** 메인 메뉴 부유 뿌요의 회전 속도 상한이다(rad/ms). 화면에서 천천히 회전하도록 낮게 제한한다. @type {number} */
    const MAIN_MENU_GALLERY_FLOATER_MAX_ROTATION_SPEED = 0.00028;
    /** 메인 메뉴 부유 뿌요가 벽에 비스듬히 부딪힐 때 회전 속도에 더할 충돌 계수다. @type {number} */
    const MAIN_MENU_GALLERY_FLOATER_ROTATION_IMPULSE = 0.006;
    /** 필드 표시 영역의 위쪽 논리 좌표다. @type {number} */
    const FIELD_TOP = 102;
    /** 필드 표시 영역의 아래쪽 논리 좌표다. @type {number} */
    const FIELD_BOTTOM = FIELD_TOP + VISIBLE_ROWS * CELL;
    /** 왼쪽 플레이어 필드의 왼쪽 논리 좌표다. @type {number} */
    const FIELD_LEFT = 188;
    /** 오른쪽 플레이어 필드의 왼쪽 논리 좌표다. @type {number} */
    const FIELD_RIGHT = 864;
    /** 일반 뿌요에 사용할 색상 이름 목록이다. @type {string[]} */
    const COLORS = ['red', 'green', 'yellow', 'blue', 'purple'];
    /** 시뮬레이터와 갤러리에서만 사용하는 얼음질 방해뿌요 식별자다. @type {string} */
    const HARD_GARBAGE = 'hardGarbage';
    /** 시뮬레이터에서만 사용하는 철구뿌요 식별자다. @type {string} */
    const IRON_PUYO = 'iron';
    /** 한 번에 파괴한 딱딱뿌요 한 개당 점수용 일반 뿌요 수에 적용할 배율이다. @type {number} */
    const HARD_GARBAGE_SCORE_MULTIPLIER = 2;
    /** 색상 이름별 캔버스 색상값이다. @type {Record<string, string>} */
    const PALETTE = {
        red: '#ef5350', green: '#66bb6a', yellow: '#f7c843', blue: '#42a5f5', purple: '#ab73e8',
        garbage: '#d3edf4', hardGarbage: '#9cdef6', iron: '#000000',
        // 예고뿌요 전용 색상이다. 방해뿌요의 투명도·눈·반사선은 그대로 두고 본체 색만 바꾼다.
        warningInk: '#30363f'
    };
    /** 연쇄 수별 점수 보너스다. 20연쇄 이상은 마지막 값에 연쇄 초과분을 곱해 계산한다. @type {number[]} */
    const CHAIN_BONUS = [0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512];
    /** 한 색 뿌요 연결 그룹의 크기별 점수 보너스다. 11개 이상은 마지막 값을 사용한다. @type {number[]} */
    const CONNECTION_BONUS = [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10];
    /** 동시에 폭발한 서로 다른 색 수별 점수 보너스다. 6색 이상은 마지막 값에서 색 수만큼 증가한다. @type {number[]} */
    const COLOR_BONUS = [0, 0, 3, 6, 12, 24];
    /** 게임 경과 초에 따라 ATTACK 계산에 사용할 마진 레이트 표다. @type {{startSecond:number, rate:number}[]} */
    const MARGIN_RATE_SCHEDULE = [
        { startSecond: 0, rate: 70 }, { startSecond: 96, rate: 52 }, { startSecond: 112, rate: 34 }, { startSecond: 128, rate: 25 },
        { startSecond: 144, rate: 16 }, { startSecond: 160, rate: 12 }, { startSecond: 176, rate: 8 }, { startSecond: 192, rate: 6 },
        { startSecond: 208, rate: 4 }, { startSecond: 224, rate: 3 }, { startSecond: 240, rate: 2 }, { startSecond: 256, rate: 1 }
    ];
    /** 뿌요 폭발로 계산된 ATTACK에 적용할 배율이다. 밸런스 조절 및 임시 테스트에 사용한다. @type {number} */
    const EXPLOSION_REWARD_MULTIPLIER = 1;
    /** 화면에 표시할 점수의 최소 자릿수다. @type {number} */
    const SCORE_DISPLAY_DIGITS = 9;
    /** 화면 제목용 기본 글꼴 이름이다. @type {string} */
    const TITLE_FONT_NAME = 'Pretendard';
    /** 버튼용 기본 글꼴 이름이다. @type {string} */
    const BUTTON_FONT_NAME = 'Noto Sans KR';
    /** 메시지용 기본 글꼴 이름이다. @type {string} */
    const MESSAGE_FONT_NAME = 'D2Coding';
    /** 글꼴 지정 시 기본 글꼴 뒤에 대체 글꼴로 붙일 글꼴 이름 목록이다. 배열 내부와 세 글꼴 이름 모두와 중복되지 않도록 자동으로 걸러진다. @type {string[]} */
    const FALLBACK_FONTS = ['Nanum Gothic Coding', 'Nanum Gothic', 'Noto Sans Mono', 'Noto Sans SC', 'Noto Sans JP', 'Black Han Sans', 'monospace', 'sans-serif'];
    /** 화면 제목이나 절 제목처럼 강조가 필요한 큰 헤더에 사용할 글꼴 목록이다. @type {string} */
    const TITLE_FONT = buildFontStack(TITLE_FONT_NAME);
    /** 버튼, 선택 카드 등 클릭 가능한 항목의 라벨에 사용할 글꼴 목록이다. @type {string} */
    const BUTTON_FONT = buildFontStack(BUTTON_FONT_NAME);
    /** 이름표, 점수, 안내 문구 등 일반 메시지 표시에 사용할 글꼴 목록이다. @type {string} */
    const MESSAGE_FONT = buildFontStack(MESSAGE_FONT_NAME);
    /** 4방향 인접 좌표 계산에 사용할 X, Y 변화량이다. @type {number[][]} */
    const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    /** 기본 룰·연습의 싹쓸이 성공 시 상대방에게 보낼 방해뿌요 수다. 피버 룰과 연속 피버에는 적용하지 않는다. @type {number} */
    const ALL_CLEAR_DAMAGE = 12;
    /** 싹쓸이 성공 시 즉시 더할 점수다. @type {number} */
    const ALL_CLEAR_POINT = 100;
    /** 싹쓸이 디버깅 시 기본 룰·피버 룰·연습의 첫 두 뿌요 쌍을 같은 색으로 고정할지 여부다. @type {boolean} */
    const DEBUG_CLEAR_RULE_MODE = false;
    /** 싹쓸이 황금빛 필드 효과의 지속 시간(ms)이다. @type {number} */
    const ALL_CLEAR_EFFECT_DURATION = 1000;
    /** Game start firework effect duration (ms). */
    const GAME_START_FIREWORK_DURATION = 1000;
    /** Game start firework begins fading after this elapsed time (ms). */
    const GAME_START_FIREWORK_FADE_START = 500;
    /** Colors used by the game start firework sparks. */
    const GAME_START_FIREWORK_COLORS = ['#f7c843', '#ef5350', '#66bb6a', '#42a5f5', '#ab73e8', '#f5fbfc'];
    /** 연속 피버 모드의 시작 목표 연쇄 수다. @type {number} */
    const CONTINUOUS_FEVER_INITIAL_TARGET_COMBO = 5;
    /** 피버 패턴으로 내려갈 수 있는 목표 연쇄 최솟값이다. 시작 목표는 5연쇄를 유지한다. @type {number} */
    const FEVER_MIN_TARGET_COMBO = 4;
    /** 연속 피버 모드의 시작 제한 시간(ms)이다. @type {number} */
    const CONTINUOUS_FEVER_INITIAL_TIME = 60000;
    /** 연속 피버 모드의 목표 연쇄 최댓값이다. @type {number} */
    const CONTINUOUS_FEVER_MAX_TARGET_COMBO = 12;
    /** 연속 피버에서 싹쓸이를 완료했을 때 추가하는 시간(ms)이다. @type {number} */
    const CONTINUOUS_FEVER_ALL_CLEAR_TIME_BONUS = 5000;
    /** 피버·연속 피버에서 연쇄 성공 시 기본으로 더하는 시간(ms)이다. @type {number} */
    const FEVER_CHAIN_TIME_BONUS = 2000;
    /** 피버 전용 필드와 연속 피버 필드의 중력 애니메이션 속도 배율이다. @type {number} */
    const FEVER_GRAVITY_SPEED_MULTIPLIER = 1.5;
    /** 피버 룰에서 피버를 발동시키는 상쇄 전등 수다. @type {number} */
    const FEVER_GAUGE_MAX = 7;
    /** 피버 룰의 게임 시작 및 피버 종료 직후 켜져 있는 전등 수다. @type {number} */
    const FEVER_LIGHT_STARTS = 0;
    /** 피버 룰의 시작 목표 연쇄 수다. @type {number} */
    const FEVER_INITIAL_TARGET_COMBO = 5;
    /** 피버 룰의 시작 다음 피버 시간(초)이다. @type {number} */
    const FEVER_INITIAL_TIME = 15;
    /** 상쇄로 늘어날 수 있는 다음 피버 시간의 최댓값(초)이다. @type {number} */
    const FEVER_MAX_TIME = 30;
    /** 사용자 컨트롤의 기본 자동 낙하 간격(ms)이다. @type {number} */
    const PLAYER_FALL_INTERVAL = 2048;
    /** 모든 게임 모드에서 새로 지급한 뿌요 쌍의 회전축 생성 Y 좌표다.  @type {number} */
    const ACTIVE_PUYO_SPAWN_Y = 11.9;
    /** 게임 경과 시간에 따른 사용자 낙하 속도의 최대 배율이다. @type {number} */
    const MAX_PLAYER_FALL_SPEED_MULTIPLIER = 8;
    /** 좌우 방향키를 홀드 입력으로 판정하기 전 대기 시간(ms)이다. @type {number} */
    const HORIZONTAL_HOLD_DELAY = 100;
    /** 좌우 방향키 홀드 중 반복 이동 간격(ms)이다. @type {number} */
    const HORIZONTAL_REPEAT_INTERVAL = 80;
    /** 가상 컨트롤러 방향키 홀드 중 반복 이동 전 대기 시간(ms)이다. @type {number} */
    const VIRTUAL_HORIZONTAL_HOLD_DELAY = 100;
    /** 가상 컨트롤러 방향키 홀드 반복 이동 간격(ms)이다. @type {number} */
    const VIRTUAL_HORIZONTAL_REPEAT_INTERVAL = 80;
    /** 가상 컨트롤러 방향 패드 중심 좌표와 한 방향 버튼의 크기다. @type {{x:number,y:number,size:number}} */
    const VIRTUAL_DPAD = { x: 118, y: 610, size: 52 };
    /** 가상 컨트롤러 Z, X, ESC 버튼의 중심 좌표와 크기다. @type {{z:{x:number,y:number},x:{x:number,y:number},escape:{x:number,y:number},radius:number}} */
    const VIRTUAL_ACTION_BUTTONS = { z: { x: 1090, y: 590 }, x: { x: 1170, y: 590 }, escape: { x: 1170, y: 500 }, radius: 31 };
    /** 크게 표시할 때 방향 패드를 이동할 논리 좌표다. CSS 최대 폭 1280px 화면에서는 화면 픽셀과 같다. @type {{x:number,y:number}} */
    const VIRTUAL_LARGE_DPAD_OFFSET = { x: 40, y: -40 };
    /** 크게 표시할 때 버튼끼리 겹치지 않도록 벌린 우측 조작 버튼 중심 좌표다. @type {{z:{x:number,y:number},x:{x:number,y:number},escape:{x:number,y:number}}} */
    const VIRTUAL_LARGE_ACTION_BUTTONS = { z: { x: 1060, y: 590 }, x: { x: 1200, y: 610 }, escape: { x: 1200, y: 480 } };
    /** AI 쉬움 난이도에서 빠른 하강을 사용하지 않음을 나타내는 지연 시간이다. @type {number|null} */
    const AI_FAST_DOWN_DELAY_EASY = null;
    /** AI 보통 난이도에서 목표 결정 후 빠른 하강까지 기다리는 시간(ms)이다. @type {number|null} */
    const AI_FAST_DOWN_DELAY_NORMAL = 1500;
    /** AI 어려움 난이도에서 목표 결정 후 빠른 하강까지 기다리는 시간(ms)이다. @type {number|null} */
    const AI_FAST_DOWN_DELAY_HARD = 300;
    /** AI 극한 난이도에서 목표 결정 후 빠른 하강까지 기다리는 시간(ms)이다. @type {number|null} */
    const AI_FAST_DOWN_DELAY_EXTREME = 100;
    /** 적이 공격 위력 시뮬레이션을 우선할 피해량 기준이다. @type {number} */
    const AI_ATTACK_SIMULATION_DAMAGE_THRESHOLD = 12;
    /** 공통 뿌요 쌍 대기열의 초기 길이다. @type {number} */
    const INITIAL_PAIR_QUEUE_LENGTH = 16;
    /** 브라우저 저장소에 사용할 키다. @type {string} */
    const STORE_KEY = 'puyow_store';
    /** 갤러리 잠금 해제 정보를 저장할 브라우저 저장소 키다. @type {string} */
    const GALLERY_STORE_KEY = 'puyow_gallery';
    /** 설정에서 새로 제안하고 저장값이 비어 있을 때 보정할 기본 OpenAI 모델명이다. @type {string} */
    const DEFAULT_AI_MODEL = 'gpt-5.6-luna';
    /** 설정 화면에서 선택할 수 있는 AI 서비스 제공자 목록이다. Google은 현재 제공하지 않는다. @type {string[]} */
    const AI_SERVICE_PROVIDERS = ['OpenAI'];
    /** 그래픽 품질별 캔버스 출력 해상도다. 게임 내부 좌표는 항상 WIDTH x HEIGHT를 사용한다. @type {{key:'low'|'medium'|'high', label:string, width:number, height:number}[]} */
    const GRAPHICS_QUALITY_OPTIONS = [
        { key: 'low', label: '낮음', width: WIDTH, height: HEIGHT },
        { key: 'medium', label: '중간', width: 1920, height: 1080 },
        { key: 'high', label: '높음', width: 3840, height: 2160 }
    ];
    /** 새 설정 및 잘못된 저장값에 사용할 기본 그래픽 품질이다. @type {'low'} */
    const DEFAULT_GRAPHICS_QUALITY = 'low';
    /** 플레이어 이름으로 허용할 최대 글자 수다. */
    const PLAYER_NAME_MAX_LENGTH = 10;
    /** 사운드 데이터 URL로 허용할 최대 글자 수다. */
    const SOUND_DATA_URL_MAX_LENGTH = 200;
    /** 새 설정 및 비어 있거나 잘못된 이름에 사용할 기본 플레이어 이름이다. */
    const DEFAULT_PLAYER_NAME = 'PLAYER 1';
    /** 가상 컨트롤러 표시 크기 선택지다. 기존 true/false 저장값은 normal/none으로 이관한다. @type {{key:'none'|'normal'|'large', label:string}[]} */
    const VIRTUAL_CONTROLLER_OPTIONS = [
        { key: 'none', label: '없음' },
        { key: 'normal', label: '보통' },
        { key: 'large', label: '크게' }
    ];
    /** 브라우저에서 직접 호출할 OpenAI Responses API 주소다. @type {string} */
    const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
    /** API 테스트 응답에 요구할 최소 JSON Schema다. @type {object} */
    const AI_API_TEST_JSON_SCHEMA = {
        type: 'object',
        properties: { success: { type: 'boolean' } },
        required: ['success'],
        additionalProperties: false
    };
    /** 솔로몬이 OpenAI Responses API 응답을 기다리는 최대 시간(ms)이다. @type {number} */
    const SOLOMON_API_TIMEOUT = 6000;
    /** 솔로몬의 배치 결정에 요구할 구조화 출력 JSON Schema다. @type {object} */
    const SOLOMON_PLACEMENT_JSON_SCHEMA = {
        type: 'object',
        properties: {
            x: { type: 'integer', minimum: 0, maximum: COLUMNS - 1, description: 'Rotation-axis column.' },
            rotation: { type: 'integer', minimum: 0, maximum: 3, description: '0=up, 1=right, 2=down, 3=left.' }
        },
        required: ['x', 'rotation'],
        additionalProperties: false
    };
    /** 한국어 원문을 키로 하는 화면 문구 번역표다. @type {Record<string, Record<string, string>>} */
    const stringTable = {
        en: {
            '솔로몬': 'Solomon', '솔로몬 AI 응답 오류: 대체 인공지능으로 진행합니다.': 'Solomon AI response error: continuing with the fallback AI.',
            '뿌요 W': 'Puyo W',
            '초기화': 'Reset', '이 게임의 모든 설정을 초기화하시겠습니까?': 'Reset all settings for this game?', '초기화 중...': 'Resetting...',
            '게임 시작': 'Game Start', '기본 룰': 'Standard Rules', '피버 룰': 'FEVER Rules', '연속 피버': 'Continuous FEVER', '퍼즐뿌요': 'Puzzle Puyo', '퍼즐뿌요 스테이지': 'Puzzle Puyo Stage', '스테이지 %1': 'Stage %1', '권장 턴 수 %1': 'Recommended turns: %1', '현재 턴 %1': 'Turn %1', '현재 턴 %1 / %2': 'Turn %1 / %2', '%1 연쇄 해봐': 'Make a %1-chain!', '싹쓸이 해봐': 'Get an all clear!', '한 번에 %1개 뿌요를 터뜨려봐': 'Pop %1 puyos at once!', '방해뿌요 %1개를 발생 시켜봐': 'Send %1 garbage puyos!', '스테이지 클리어': 'Stage Clear', '(출시 예정)': '(Coming soon)', '목표 연쇄': 'TARGET COMBO', '남은 시간': 'LEFT TIME', '연습': 'Practice', '선택': 'Select', '난이도': 'Difficulty', '적 선택': 'Opponent', 'ENTER 혹은 클릭하여 시작': 'Press ENTER or click to start',
            '3색': '3 Colors', '4색': '4 Colors', '5색': '5 Colors', '쉬움': 'Easy', '보통': 'Normal', '어려움': 'Hard', '안드로말리우스': 'Andromalius', '단탈리온': 'Dantalion', '세레': 'Seere', '데카라비아': 'Decarabia', '벨리알': 'Belial', '암두시아스': 'Amdusias', '키마리스': 'Kimaris', '시작': 'Start', '이전': 'Back',
            '극한': 'Extreme',
            '일시정지': 'Paused', '재개': 'Resume', '종료': 'Exit', 'GitHub': 'GitHub',
            '승리': 'Victory', '패배': 'Defeat', '최종 점수 %1': 'Final score %1', '게임 시간 %1초': 'Game time: %1 sec', '%1연쇄': '%1 Chain',
            '연습 상대': 'Practice Opponent', '추후 출시예정': 'Coming soon', '잠김': 'Locked', '한 번만 회전해': 'Rotate only once.', '마지막 폭발은 초록색으로': 'Make the last pop green.', '방해뿌요는 터뜨려야 제맛': 'Pop the garbage puyos too.', '어디부터 터뜨려야 잘 터뜨렸다고 소문이 날까? 오른쪽?': 'Where should you pop first? The right side?', '저 위의 빨간 색은 왜 있을까?': 'Why is that red puyo up there?',
            '시뮬레이터': 'Simulator', '팔레트': 'Palette', '재생': 'Play', '그리기': 'Draw', '시뮬레이션': 'Simulation', '지우개': 'Eraser',
            'JSON복사': 'Copy JSON', 'JSON넣기': 'Paste JSON', '배치가 클립보드에 복사됨': 'Layout copied to clipboard',
            '클립보드 복사 실패': 'Clipboard copy failed', 'JSON 파싱 실패': 'JSON parsing failed', '배치 JSON을 입력하세요.': 'Enter layout JSON.',
            '설정': 'Settings', '이름': 'Name', '배경음악 볼륨': 'Music volume', '효과음 볼륨': 'Effects volume', '가상 컨트롤러 사용': 'Use virtual controller', '없음': 'None', '크게': 'Large', '그래픽 설정': 'Graphics quality', '사운드 데이터 URL': 'Sound data URL', '낮음': 'Low', '중간': 'Medium', '높음': 'High', 'AI 서비스 제공자': 'AI provider', 'AI API 키': 'AI API key', '사용 모델명': 'Model name', 'AI API 테스트': 'Test AI API', '저장': 'Save', '취소': 'Cancel', '이 API키는 브라우저에만 저장됩니다.': 'This API key is stored only in this browser.', '사운드 관련 기능은 추후 제공 예정': 'Sound features will be available in a future update.', '설정 저장 후 다시 시도해 주세요': 'Save your settings and try again.', 'AI API 테스트 요청 중...': 'Testing AI API...', 'AI API 테스트 성공 (JSON 스키마 검사: 통과)': 'AI API test succeeded (JSON schema: passed).', 'AI API 테스트 실패 (JSON 스키마 검사: 실패)': 'AI API test failed (JSON schema: failed).', 'AI API 테스트 실패 (JSON 스키마 검사: 미실시)': 'AI API test failed (JSON schema: not run).',
            '플레이 방법': 'How to Play', '갤러리': 'Gallery', '대상 유형': 'Category', '대상': 'Item', '일반뿌요': 'Puyos', '예고뿌요': 'Warning Puyos', '적': 'Enemies', '빨강뿌요': 'Red Puyo', '초록뿌요': 'Green Puyo', '노랑뿌요': 'Yellow Puyo', '파랑뿌요': 'Blue Puyo', '보라뿌요': 'Purple Puyo', '방해뿌요': 'Garbage Puyo', '딱딱뿌요': 'Hard Puyo', '작은 예고뿌요': 'Small Warning Puyo', '큰 예고뿌요': 'Large Warning Puyo', '빨간 돌': 'Red Rock', '별': 'Star', '태양': 'Sun', '중성자별': 'Neutron Star', '블랙홀': 'Black Hole', '위기': 'Crisis', '다시보기': 'Replay',
            '좌우, 아래 키로 뿌요를 이동시킬 수 있고, Z, X 키로 뿌요를 회전시킬 수 있어': 'Use Left, Right, and Down to move puyos. Rotate them with Z and X.', '좌우 방향키로 뿌요 이동': 'Move puyos with Left and Right.', '아래 방향키로 빨리 떨어뜨리기': 'Use Down to drop faster.', 'Z 키를 눌러 좌측으로 뿌요 회전': 'Press Z to rotate left.', 'X 키를 눌러 우측으로 뿌요 회전': 'Press X to rotate right.', '같은 색의 뿌요 4개 이상이 붙으면 뿌요를 터뜨려 적을 공격할 수 있어.': 'Connect four or more puyos of the same color to pop them and attack.', '같은 색의 뿌요 4개가 붙어, 적을 공격할 수 있어': 'Four puyos of the same color connect to attack the opponent.', '뿌요가 터질 때 인접한 방해뿌요도 같이 터져': 'Garbage puyos next to popping puyos disappear too.', '연쇄적으로 뿌요를 폭발시키면 강력한 공격을 할 수 있어.': 'Chain popping puyos for a stronger attack.', '게임 중 싹쓸이를 하면 강력한 공격을 할 수 있어.': 'An all clear gives you a powerful attack.', '3번째 줄 끝에 뿌요가 오래 닿으면 패배해.': 'You lose when puyos stay at the end of the third row.',
            '은하': 'Galaxy',
            '음소거(꺼짐)' : 'Mute (Off)', '음소거(활성)' : 'Mute (On)',
            '화면 가로방향 고정': 'Lock landscape orientation',
        },
        ja: {
            '솔로몬': 'ソロモン', '솔로몬 AI 응답 오류: 대체 인공지능으로 진행합니다.': 'ソロモンAIの応答エラー：代替AIで続行します。',
            '이름': '名前',
            '뿌요 W': 'Puyo W',
            '초기화': '初期化', '이 게임의 모든 설정을 초기화하시겠습니까?': 'このゲームのすべての設定を初期化しますか？', '초기화 중...': '初期化中…',
            '게임 시작': 'ゲーム開始', '기본 룰': '基本ルール', '피버 룰': 'FEVERルール', '연속 피버': '連続FEVER', '퍼즐뿌요': 'パズルぷよ', '퍼즐뿌요 스테이지': 'パズルぷよステージ', '스테이지 %1': 'ステージ %1', '권장 턴 수 %1': '推奨ターン数: %1', '현재 턴 %1': 'ターン %1', '현재 턴 %1 / %2': 'ターン %1 / %2', '%1 연쇄 해봐': '%1連鎖してみよう！', '싹쓸이 해봐': '全消ししてみよう！', '한 번에 %1개 뿌요를 터뜨려봐': '一度に%1個のぷよを消そう！', '방해뿌요 %1개를 발생 시켜봐': 'おじゃまぷよを%1個送ろう！', '스테이지 클리어': 'ステージクリア', '(출시 예정)': '(近日公開)', '목표 연쇄': '目標連鎖', '남은 시간': '残り時間', '연습': '練習', '선택': '選択', '난이도': '難易度', '적 선택': '対戦相手', 'ENTER 혹은 클릭하여 시작': 'ENTERキーまたはクリックで開始',
            '3색': '3色', '4색': '4色', '5색': '5色', '쉬움': '簡単', '보통': '普通', '어려움': '難しい', '안드로말리우스': 'アンドロマリウス', '단탈리온': 'ダンタリオン', '세레': 'セーレ', '데카라비아': 'デカラビア', '벨리알': 'ベリアル', '암두시아스': 'アムドゥシアス', '키마리스': 'キマリス', '시작': '開始', '이전': '戻る',
            '극한': '極限',
            '일시정지': '一時停止', '재개': '再開', '종료': '終了', 'GitHub': 'GitHub',
            '승리': '勝利', '패배': '敗北', '최종 점수 %1': '最終スコア %1', '게임 시간 %1초': 'ゲーム時間: %1秒', '%1연쇄': '%1連鎖',
            '연습 상대': '練習相手', '추후 출시예정': '近日公開予定', '잠김': 'ロック中', '한 번만 회전해': '一度だけ回転しよう。', '마지막 폭발은 초록색으로': '最後は緑で消そう。', '방해뿌요는 터뜨려야 제맛': 'おじゃまぷよも消そう。', '어디부터 터뜨려야 잘 터뜨렸다고 소문이 날까? 오른쪽?': 'どこから消そう？右側かな？', '저 위의 빨간 색은 왜 있을까?': '上の赤いぷよはなぜあるのかな？',
            '시뮬레이터': 'シミュレーター', '팔레트': 'パレット', '재생': '再生', '그리기': '描画', '시뮬레이션': 'シミュレーション', '지우개': '消しゴム',
            'JSON복사': 'JSONをコピー', 'JSON넣기': 'JSONを貼り付け', '배치가 클립보드에 복사됨': '配置をクリップボードにコピーしました',
            '클립보드 복사 실패': 'クリップボードへのコピーに失敗しました', 'JSON 파싱 실패': 'JSONの解析に失敗しました', '배치 JSON을 입력하세요.': '配置JSONを入力してください。',
            '설정': '設定', '배경음악 볼륨': 'BGM音量', '효과음 볼륨': '効果音量', '가상 컨트롤러 사용': '仮想コントローラーを使用', '없음': 'なし', '크게': '大きく', '그래픽 설정': 'グラフィック設定', '사운드 데이터 URL': 'サウンドデータURL', '낮음': '低', '중간': '中', '높음': '高', 'AI 서비스 제공자': 'AIプロバイダー', 'AI API 키': 'AI APIキー', '사용 모델명': 'モデル名', 'AI API 테스트': 'AI APIテスト', '저장': '保存', '취소': 'キャンセル', '이 API키는 브라우저에만 저장됩니다.': 'このAPIキーはこのブラウザにのみ保存されます。', '사운드 관련 기능은 추후 제공 예정': 'サウンド機能は今後のアップデートで提供予定です。', '설정 저장 후 다시 시도해 주세요': '設定を保存してから、もう一度お試しください。', 'AI API 테스트 요청 중...': 'AI APIをテスト中…', 'AI API 테스트 성공 (JSON 스키마 검사: 통과)': 'AI APIテスト成功（JSONスキーマ検証: 合格）', 'AI API 테스트 실패 (JSON 스키마 검사: 실패)': 'AI APIテスト失敗（JSONスキーマ検証: 失敗）', 'AI API 테스트 실패 (JSON 스키마 검사: 미실시)': 'AI APIテスト失敗（JSONスキーマ検証: 未実施）',
            '플레이 방법': '遊び方', '갤러리': 'ギャラリー', '대상 유형': '種類', '대상': '対象', '일반뿌요': 'ぷよ', '예고뿌요': '予告ぷよ', '적': '敵', '빨강뿌요': '赤ぷよ', '초록뿌요': '緑ぷよ', '노랑뿌요': '黄ぷよ', '파랑뿌요': '青ぷよ', '보라뿌요': '紫ぷよ', '방해뿌요': 'おじゃまぷよ', '딱딱뿌요': 'かたぷよ', '작은 예고뿌요': '小さい予告ぷよ', '큰 예고뿌요': '大きい予告ぷよ', '빨간 돌': '赤い岩', '별': '星', '태양': '太陽', '중성자별': '中性子星', '블랙홀': 'ブラックホール', '위기': 'ピンチ', '다시보기': 'もう一度見る',
            '좌우, 아래 키로 뿌요를 이동시킬 수 있고, Z, X 키로 뿌요를 회전시킬 수 있어': '左右・下キーでぷよを動かし、Z・Xキーで回転できます。', '좌우 방향키로 뿌요 이동': '左右キーでぷよを移動', '아래 방향키로 빨리 떨어뜨리기': '下キーで速く落下', 'Z 키를 눌러 좌측으로 뿌요 회전': 'Zキーで左回転', 'X 키를 눌러 우측으로 뿌요 회전': 'Xキーで右回転', '같은 색의 뿌요 4개 이상이 붙으면 뿌요를 터뜨려 적을 공격할 수 있어.': '同じ色のぷよを4個以上つなげると消して攻撃できます。', '같은 색의 뿌요 4개가 붙어, 적을 공격할 수 있어': '同じ色のぷよ4個がつながり、相手を攻撃できます。', '뿌요가 터질 때 인접한 방해뿌요도 같이 터져': 'ぷよが消えると、隣接するおじゃまぷよも消えます。', '연쇄적으로 뿌요를 폭발시키면 강력한 공격을 할 수 있어.': '連鎖でぷよを消すと、より強く攻撃できます。', '게임 중 싹쓸이를 하면 강력한 공격을 할 수 있어.': '全消しをすると強力な攻撃ができます。', '3번째 줄 끝에 뿌요가 오래 닿으면 패배해.': '3段目の端にぷよが残ると負けです。',
            '은하': '銀河',
            '음소거(꺼짐)' : 'ミュート（オフ）', '음소거(활성)' : 'ミュート（オン）',
            '화면 가로방향 고정': '画面を横向きに固定',
        },
        zh: {
            '솔로몬': '所罗门', '솔로몬 AI 응답 오류: 대체 인공지능으로 진행합니다.': '所罗门 AI 响应错误：将使用备用 AI 继续。',
            '이름': '名称',
            '뿌요 W': 'Puyo W',
            '초기화': '重置', '이 게임의 모든 설정을 초기화하시겠습니까?': '要重置此游戏的所有设置吗？', '초기화 중...': '正在重置…',
            '게임 시작': '开始游戏', '기본 룰': '基本规则', '피버 룰': 'FEVER规则', '연속 피버': '连续FEVER', '퍼즐뿌요': '益智魔法气泡', '퍼즐뿌요 스테이지': '益智魔法气泡关卡', '스테이지 %1': '关卡 %1', '권장 턴 수 %1': '推荐回合数: %1', '현재 턴 %1': '第 %1 回合', '현재 턴 %1 / %2': '第 %1 / %2 回合', '%1 연쇄 해봐': '试试 %1 连锁！', '싹쓸이 해봐': '试试全消！', '한 번에 %1개 뿌요를 터뜨려봐': '一次消除 %1 个魔法气泡！', '방해뿌요 %1개를 발생 시켜봐': '发送 %1 个垃圾魔法气泡！', '스테이지 클리어': '关卡完成', '(출시 예정)': '(即将推出)', '목표 연쇄': '目标连锁', '남은 시간': '剩余时间', '연습': '练习', '선택': '选择', '난이도': '难度', '적 선택': '对手', 'ENTER 혹은 클릭하여 시작': '按 ENTER 键或点击开始',
            '3색': '3色', '4색': '4色', '5색': '5色', '쉬움': '简单', '보통': '普通', '어려움': '困难', '안드로말리우스': '安德罗马利乌斯', '단탈리온': '丹塔利昂', '세레': '西瑞', '데카라비亚': '德卡拉比亚', '벨리알': '贝利亚尔', '시작': '开始', '이전': '返回',
            '암두시아스': '阿姆杜西亚斯', '키마리스': '基马里斯',
            '극한': '极限',
            '일시정지': '暂停', '재개': '继续', '종료': '退出', 'GitHub': 'GitHub',
            '승리': '胜利', '패배': '失败', '최종 점수 %1': '最终得分 %1', '게임 시간 %1초': '游戏时间：%1秒', '%1연쇄': '%1连锁',
            '연습 상대': '练习对手', '추후 출시예정': '即将推出', '잠김': '已锁定', '한 번만 회전해': '只旋转一次。', '마지막 폭발은 초록색으로': '最后用绿色消除。', '방해뿌요는 터뜨려야 제맛': '也消除垃圾噗哟吧。', '어디부터 터뜨려야 잘 터뜨렸다고 소문이 날까? 오른쪽?': '从哪里开始消除？右边？', '저 위의 빨간 색은 왜 있을까?': '上面的红噗哟为什么会在那里？',
            '시뮬레이터': '模拟器', '팔레트': '调色板', '재생': '播放', '그리기': '绘制', '시뮬레이션': '模拟', '지우개': '橡皮擦',
            'JSON복사': '复制 JSON', 'JSON넣기': '粘贴 JSON', '배치가 클립보드에 복사됨': '布局已复制到剪贴板',
            '클립보드 복사 실패': '复制到剪贴板失败', 'JSON 파싱 실패': 'JSON 解析失败', '배치 JSON을 입력하세요.': '请输入布局 JSON。',
            '설정': '设置', '배경음악 볼륨': '背景音乐音量', '효과음 볼륨': '音效音量', '가상 컨트롤러 사용': '使用虚拟控制器', '없음': '无', '크게': '大', '그래픽 설정': '图形设置', '사운드 데이터 URL': '声音数据 URL', '낮음': '低', '중간': '中', '높음': '高', 'AI 서비스 제공자': 'AI 服务提供商', 'AI API 키': 'AI API 密钥', '사용 모델명': '模型名称', 'AI API 테스트': 'AI API 测试', '저장': '保存', '취소': '取消', '이 API키는 브라우저에만 저장됩니다.': '此 API 密钥仅存储在此浏览器中。', '사운드 관련 기능은 추후 제공 예정': '声音功能将在未来更新中提供。', '설정 저장 후 다시 시도해 주세요': '请先保存设置后再试。', 'AI API 테스트 요청 중...': '正在测试 AI API…', 'AI API 테스트 성공 (JSON 스키마 검사: 통과)': 'AI API 测试成功（JSON 架构检查：通过）', 'AI API 테스트 실패 (JSON 스키마 검사: 실패)': 'AI API 测试失败（JSON 架构检查：失败）', 'AI API 테스트 실패 (JSON 스키마 검사: 미실시)': 'AI API 测试失败（JSON 架构检查：未执行）',
            '플레이 방법': '玩法说明', '갤러리': '图鉴', '대상 유형': '类别', '대상': '对象', '일반뿌요': '普通噗哟', '예고뿌요': '预告噗哟', '적': '敌人', '빨강뿌요': '红噗哟', '초록뿌요': '绿噗哟', '노랑뿌요': '黄噗哟', '파랑뿌요': '蓝噗哟', '보라뿌요': '紫噗哟', '방해뿌요': '垃圾噗哟', '딱딱뿌요': '硬噗哟', '작은 예고뿌요': '小型预告噗哟', '큰 예고뿌요': '大型预告噗哟', '빨간 돌': '红色岩石', '별': '星星', '태양': '太阳', '중성자별': '中子星', '블랙홀': '黑洞', '위기': '危机', '다시보기': '再次观看',
            '좌우, 아래 키로 뿌요를 이동시킬 수 있고, Z, X 키로 뿌요를 회전시킬 수 있어': '使用左右和下方向键移动噗哟，使用 Z、X 键旋转。', '좌우 방향키로 뿌요 이동': '用左右方向键移动噗哟', '아래 방향키로 빨리 떨어뜨리기': '用下方向键快速落下', 'Z 키를 눌러 좌측으로 뿌요 회전': '按 Z 键向左旋转', 'X 키를 눌러 우측으로 뿌요 회전': '按 X 键向右旋转', '같은 색의 뿌요 4개 이상이 붙으면 뿌요를 터뜨려 적을 공격할 수 있어.': '连接四个或更多相同颜色的噗哟即可消除并攻击对手。', '같은 색의 뿌요 4개가 붙어, 적을 공격할 수 있어': '四个相同颜色的噗哟连接后可以攻击对手。', '뿌요가 터질 때 인접한 방해뿌요도 같이 터져': '消除噗哟时，相邻的垃圾噗哟也会一起消失。', '연쇄적으로 뿌요를 폭발시키면 강력한 공격을 할 수 있어.': '连续消除噗哟可以发动更强的攻击。', '게임 중 싹쓸이를 하면 강력한 공격을 할 수 있어.': '全消时可以发动强力攻击。', '3번째 줄 끝에 뿌요가 오래 닿으면 패배해.': '噗哟停留在第 3 行末端时会失败。',
            '은하': '银河',
            '음소거(꺼짐)' : '静音（关）', '음소거(활성)' : '静音（开）',
            '화면 가로방향 고정': '锁定横屏',
        }
    };

    /** 현재 연결된 캔버스 요소다. @type {HTMLCanvasElement|null} */
    let canvas = null;
    /** 현재 연결된 캔버스 2D 렌더링 컨텍스트다. @type {CanvasRenderingContext2D|null} */
    let context = null;
    /** 라이브러리가 초기화되어 이벤트와 게임 루프가 연결됐는지 여부다. @type {boolean} */
    let initialized = false;
    /** 초기 타이틀에서 탑재된 피버 스테이지 검증을 마쳤는지 여부다. @type {boolean} */
    let feverStageValidationComplete = false;
    /** 피버 스테이지 검증 전에 받은 초기 타이틀 진입 입력을 보관한다. @type {boolean} */
    let pendingInitialTitleEntry = false;
    /** 초기 타이틀에서 피버 스테이지 검증을 시작할 타이머다. @type {number|null} */
    let feverStageValidationTimer = null;
    /** initialize()가 canvas를 직접 만들어 연결했는지 여부다. @type {boolean} */
    let createdCanvas = false;
    /** 다음 게임 프레임 취소에 사용할 요청 식별자다. @type {number|null} */
    let animationFrameId = null;
    /** 등록된 WebMCP 도구를 한 번에 해제하는 컨트롤러다. @type {AbortController|null} */
    let webMcpAbortController = null;
    /** 현재 실행 중인 게임 상태다. @type {object|null} */
    let game = null;
    /** 현재 재생 중인 배경음악이다. 화면 종류와 상관없이 한 개만 유지한다. @type {HTMLAudioElement|null} */
    let backgroundMusicAudio = null;
    /** 현재 배경음악 요소가 재생하는 음원 URL이다. @type {string|null} */
    let backgroundMusicUrl = null;
    /** 대량 방해뿌요 착지음의 중복 재생을 막기 위해 보관하는 오디오다. @type {HTMLAudioElement|null} */
    let garbageFallLotAudio = null;
    /** 마지막 일반 뿌요 착지음 재생 시각(ms) @type {number} */
    let puyoFallLastPlayedAt = -Infinity;
    /** 일반 뿌요 착지음의 최소 재생 간격(ms) */
    const PUYO_FALL_SOUND_COOLDOWN = 250;
    /** 초기 타이틀을 벗어나 브라우저가 재생을 허용하는 사용자 조작이 발생했는지 여부다. @type {boolean} */
    let hasUserStarted = false;
    /** 메인 화면 왼쪽에 표시할 안내문 원문이다. @type {string} */
    let noticeText = '';
    /** 설정에서 불러온 사운드 데이터 JSON의 주소다. @type {string|null} */
    let soundDataURL = null;
    /** 설정 화면에서 임시로 편집 중인 값이다. @type {object|null} */
    let settingsDraft = null;
    /** 설정 화면의 포커스 항목 인덱스다. @type {number} */
    let settingsFocus = 0;
    /** API 키·모델명 입력란이 실제 편집 상태인지 여부다. @type {boolean} */
    let settingsEditing = false;
    /** 현재 편집 중인 문자열의 커서 위치다. @type {number} */
    let settingsCursor = 0;
    /** 설정 텍스트 입력의 선택 시작 위치다. 선택이 없으면 null이다. @type {number|null} */
    let settingsSelectionAnchor = null;
    /** 화면 최상단에 표시할 외부 메시지다. @type {{message:string,color:string,backgroundColor:string|null,elapsed:number,duration:number}|null} */
    let screenMessage = null;
    /** Game start firework animation state. @type {{elapsed:number,particles:{angle:number,speed:number,delay:number,size:number,color:string}[]}|null} */
    let gameStartFirework = null;
    /** 외부 메시지가 유지 시간 뒤 사라지는 데 걸리는 시간(ms)이다. @type {number} */
    const SCREEN_MESSAGE_FADE_DURATION = 500;
    /** AI API 테스트 요청이 진행 중인지 여부다. @type {boolean} */
    let settingsApiTestPending = false;
    /** 현재 페이지 접속 중 AI API 테스트를 통과해 솔로몬을 사용할 수 있는지 여부다. 저장하지 않는다. @type {boolean} */
    let solomonSessionUnlocked = false;
    /** 종료된 설정 화면의 비동기 응답을 무시하기 위한 요청 식별자다. @type {number} */
    let settingsApiTestRequestId = 0;
    /** 설정 전체 초기화 확인 후 표시하는 초기화 진행 화면 여부다. @type {boolean} */
    let settingsResetting = false;
    /** 설정 전체 초기화 후 첫 화면으로 돌아가기 위한 타이머다. @type {number|null} */
    let settingsResetTimer = null;
    /** AI가 강조 표시하도록 지정한 플레이어 필드 좌표다. @type {{x:number, y:number}|null} */
    let recommendedPoint = null;
    /** 게임이 없을 때 표시할 메뉴 화면 식별자다. @type {'initialTitle'|'title'|'opponent'|'practiceDifficulty'|'puzzleStage'|'simulator'|'settings'|'gallery'} */
    let menuScreen = 'initialTitle';
    /** 색상 수 선택 화면이 시작할 단독 모드다. @type {'practice'|'continuousFever'} */
    let colorSelectionMode = 'practice';
    /** 퍼즐뿌요 스테이지 선택 화면에서 포커스된 스테이지 순번이다. @type {number} */
    let puzzleStageFocus = 0;
    /** 퍼즐뿌요 스테이지 선택 화면에서 직전에 마우스로 포커스한 스테이지 순번이다. @type {number|null} */
    let puzzleStageLastClickedIndex = null;
    /** 퍼즐뿌요 스테이지 선택 화면의 취소 버튼에 사용할 가상 포커스 순번이다. @type {number} */
    const PUZZLE_STAGE_CANCEL_INDEX = -1;
    /** 퍼즐뿌요 선택 줄에서 동시에 보여 줄 카드 수다. 취소와 스테이지 다섯 개가 기본 배치다. @type {number} */
    const PUZZLE_STAGE_VISIBLE_CARD_COUNT = 6;
    /** 퍼즐뿌요 선택 줄의 첫 번째로 보이는 카드 슬롯이다. @type {number} */
    let puzzleStageScrollOffset = 0;
    /** 갤러리의 현재 선택과 포커스 상태다. @type {{typeIndex:number,itemIndex:number,focus:'type'|'target',portraitElapsed:number}|null} */
    let gallery = null;
    /** 초기 타이틀 중앙에 순환 표시할 갤러리 대상 상태다. @type {{loaded:boolean,items:{draw:()=>void}[],startIndex:number,elapsed:number}} */
    let initialGalleryPreview = { loaded: false, items: [], startIndex: 0, elapsed: 0 };
    /** localStorage에서 읽은 갤러리 잠금 해제 정보다. @type {{warning:string[],enemies:string[]}} */
    let galleryUnlocks = createInitialGalleryUnlocks();
    /** 시뮬레이터의 편집·재생 상태다. @type {object|null} */
    let simulator = null;
    /** 선택된 적의 OPPONENTS 배열 인덱스다. @type {number} */
    let selectedOpponent = 0;
    /** 선택된 색상 수의 DIFFICULTIES 배열 인덱스다. @type {number} */
    let selectedDifficulty = 1;
    /** 색상 수 선택 화면에서 포커스된 항목이다. 색상 인덱스 또는 취소 가상 인덱스다. @type {number} */
    let colorSelectionFocus = selectedDifficulty;
    /** 선택된 AI 빠른 하강 난이도의 AI_DIFFICULTIES 배열 인덱스다. @type {number} */
    let selectedAiDifficulty = 1;
    /** 적 선택 메뉴에서 포커스된 행이다. 0: 색상, 1: AI 난이도, 2: 적, 3: 동작이다. @type {number} */
    let opponentMenuFocus = 0;
    /** 적 선택 메뉴 하단에서 포커스된 동작이다. @type {number} */
    let selectedOpponentAction = 0;
    /** 적 선택 화면에서 시작할 대전 규칙이다. @type {'standard'|'fever'} */
    let opponentMenuRule = 'standard';
    /** 메인 메뉴에서 포커스된 항목이다. @type {number} */
    let titleMenuFocus = 0;
    /** 메인 메뉴의 게임 규칙 선택 오버레이가 열려 있는지 여부다. @type {boolean} */
    let ruleSelectionOpen = false;
    /** 메인 메뉴에서 떠다닐 갤러리 항목의 위치·속도·회전 상태다. @type {{draw:()=>void,x:number,y:number,vx:number,vy:number,radius:number,rotation:number,rotationVelocity:number}[]} */
    let mainMenuGalleryFloaters = [];
    /** 직전 렌더링 메뉴 화면이다. 메인 메뉴 재진입 시 떠다니는 항목을 다시 추첨하는 데 사용한다. @type {string} */
    let previousRenderedMenuScreen = 'initialTitle';
    /** 게임 규칙 선택 오버레이에서 포커스된 항목이다. @type {number} */
    let ruleSelectionFocus = 0;
    /** 일시정지 메뉴에서 포커스된 항목이다. @type {number} */
    let pauseMenuFocus = 0;
    /** 직전 애니메이션 프레임의 시각이다. @type {number} */
    let lastTime = 0;
    /** 아래 방향키가 눌린 상태인지 여부다. @type {boolean} */
    let isDownKeyPressed = false;
    /** 현재 홀드 중인 좌우 방향키다. @type {'arrowleft'|'arrowright'|null} */
    let horizontalKeyPressed = null;
    /** 좌우 방향키를 누른 뒤 경과한 시간(ms)이다. @type {number} */
    let horizontalHoldElapsed = 0;
    /** 좌우 방향키 홀드 반복 이동의 누적 시간(ms)이다. @type {number} */
    let horizontalRepeatElapsed = 0;
    /** 가상 컨트롤러에서 현재 홀드 중인 방향키 상태다. @type {{arrowleft:boolean,arrowright:boolean,arrowup:boolean,arrowdown:boolean}} */
    let virtualDirectionInput = { arrowleft: false, arrowright: false, arrowup: false, arrowdown: false };
    /** 터치·포인터별로 누르고 있는 가상 컨트롤러 버튼 목록이다. @type {Map<number,string[]>} */
    let virtualPointerButtons = new Map();
    /** 가상 컨트롤러 좌우 방향키를 누른 뒤 경과한 시간(ms)이다. @type {number} */
    let virtualHorizontalHoldElapsed = 0;
    /** 가상 컨트롤러 좌우 방향키 홀드 반복 이동의 누적 시간(ms)이다. @type {number} */
    let virtualHorizontalRepeatElapsed = 0;
    /** Gamepad API의 스틱 입력을 방향 입력으로 판단하는 최소 절댓값이다. @type {number} */
    const GAMEPAD_STICK_DEAD_ZONE = 0.5;
    /** 게임패드에서 현재 누르고 있는 방향키다. 키보드 입력과 별도로 해제하기 위해 보관한다. @type {Set<string>} */
    let gamepadDirectionKeys = new Set();
    /** 게임패드의 한 번 누름 동작 버튼 상태다. @type {{z:boolean,x:boolean,enter:boolean,escape:boolean}} */
    let gamepadActionInput = { z: false, x: false, enter: false, escape: false };
    /** 현재 화면 문구에 적용할 언어 코드다. @type {string} */
    let languageCode = 'ko';
    /** [CTX] 예약어를 치환할 웹 애플리케이션의 URL 컨텍스트 경로다. @type {string} */
    let urlContextPath = '/';
    /** localStorage에서 불러온 진행도 데이터다. @type {{clearList:string[], clearListByDifficulty:Record<'easy'|'normal'|'hard'|'extreme', string[]>, feverClearListByDifficulty:Record<'easy'|'normal'|'hard'|'extreme', string[]>, puzzleClearStages:number[], puzzleStarStages:number[]}} */
    let store = createInitialStore();
    /** 메인 화면 안내문 파일 경로 또는 절대 URL이다. 상대경로는 puyow.js 기준으로 해석한다. @type {string} */
    let noticeUrl = 'notice_[LANG].txt';
    /** 공통 사운드 풀 @type {CommonSoundPool} */
    let commonSoundPool = null;
    /** 난이도별 표시명과 제공 색상 목록이다. @type {{name:string, colors:string[]}[]} */
    const DIFFICULTIES = [
        { name: '3색', colors: ['green', 'yellow', 'blue'] },
        { name: '4색', colors: ['red', 'green', 'yellow', 'blue'] },
        { name: '5색', colors: COLORS }
    ];
    /** 색상 수 선택 화면에서 취소 버튼에 사용할 가상 항목 인덱스다. */
    const COLOR_SELECTION_CANCEL_INDEX = DIFFICULTIES.length;
    /** AI 빠른 하강 시점별 난이도다. @type {{key:'easy'|'normal'|'hard'|'extreme', name:string, fastDownDelay:number|null}[]} */
    const AI_DIFFICULTIES = [
        { key: 'easy', name: '쉬움', fastDownDelay: AI_FAST_DOWN_DELAY_EASY },
        { key: 'normal', name: '보통', fastDownDelay: AI_FAST_DOWN_DELAY_NORMAL },
        { key: 'hard', name: '어려움', fastDownDelay: AI_FAST_DOWN_DELAY_HARD },
        { key: 'extreme', name: '극한', fastDownDelay: AI_FAST_DOWN_DELAY_EXTREME }
    ];
    /** 등록된 기본 및 외부 적 목록이다. @type {{createController:()=>Enemy, className:string, classType:string, sortPriority:number, hidden:boolean, notAvail:boolean}[]} */
    const OPPONENTS = [];
    /** getClassType()별로 외부에서 지정한 적 사운드 풀이다. @type {Map<string, SoundPool>} */
    const enemySoundPools = new Map();
    /** 메인 메뉴 게임 규칙 선택지의 버튼 배경색이다. */
    const RULE_OPTION_BACKGROUND_COLORS = {
        standard: '#1b5e20',
        fever: '#b0007a',
        practice: '#388e3c',
        continuousFever: '#cf4bb0',
        puzzle: '#236a8b'
    };
    /** 메인 메뉴의 게임 규칙 선택지다. 새 규칙은 이 목록에 추가해 확장한다. @type {{label:string,statusLabel?:string,backgroundColor:string,disabled?:boolean,activate?:()=>void}[]} */
    const GAME_RULE_OPTIONS = [
        { label: '기본 룰', backgroundColor: RULE_OPTION_BACKGROUND_COLORS.standard, activate: () => openOpponentMenu(false) },
        { label: '피버 룰', backgroundColor: RULE_OPTION_BACKGROUND_COLORS.fever, activate: () => openOpponentMenu(true) },
        { label: '연습', backgroundColor: RULE_OPTION_BACKGROUND_COLORS.practice, activate: () => openPracticeDifficulty() },
        { label: '연속 피버', backgroundColor: RULE_OPTION_BACKGROUND_COLORS.continuousFever, activate: () => openContinuousFeverDifficulty() },
        { label: '퍼즐뿌요', backgroundColor: RULE_OPTION_BACKGROUND_COLORS.puzzle, activate: () => openPuzzleStageSelection() }
    ];
    /** 게임 규칙 선택 오버레이에서 취소 버튼에 사용할 가상 항목 인덱스다. */
    const RULE_SELECTION_CANCEL_INDEX = GAME_RULE_OPTIONS.length;
    /** 브라우저 전역 및 CommonJS로 공개할 라이브러리 API다. @type {object|null} */
    let WebPuyo = null;

    /**
     * 0 이상 1 미만의 난수를 반환한다.
     *     자동 테스트 시 임시로 이 메소드를 수정한 후 테스트할 수 있다.
     *     테스트를 위해서는 이 게임 내에서 랜덤 수 생성 시 반드시 이 함수를 이용해 생성해야만 한다.
     * @returns {number}
     */
    function randomFloat() {
        return Math.random();
    }

    /**
     * 설정 등을 저장할 때 사용하는 대리 객체
     */
    class StorageManager {
        /**
         * 스토리지에 저장된 데이터를 읽어 반환, 해당 데이터가 존재하지 않으면 null 반환
         *
         * @param {string} key 데이터의 키
         * @returns {string|null} 데이터
         */
        getItem(key) {
            return window.localStorage.getItem(key);
        }

        /**
         * 스토리지에 데이터 저장 (단, null 입력 시 데이터 삭제)
         * 
         * @param {string} key 데이터의 키
         * @param {string|null} value 저장할 데이터 (삭제 시 null 입력)
         */
        setItem(key, value) {
            if(value == null) window.localStorage.removeItem(key);
            else window.localStorage.setItem(key, value);
        }

        /**
         * 스토리지의 모든 데이터를 삭제
         */
        clear() {
            window.localStorage.clear();
        }
    }

    /** 
     * 스토리지 저장 시 사용하는 공통 객체 
     *     다른 플랫폼 용으로 사용할 때 해당 플랫폼 제공 저장수단으로 교체하여 사용한다.
     * 
     * @type {StorageManager} 
     * 
    */
    let storageManager = new StorageManager();

    /**
     * 공통 스토리지 매니저 교체
     * 
     * @param {StorageManager} storageManagerObject 
     */
    function setStorageManager(storageManagerObject) {
        if(! (storageManagerObject instanceof StorageManager)) throw new TypeError('storageManagerObject는 StorageManager 인스턴스여야 합니다.');
        storageManager = storageManagerObject;
    }

    /**
     * 공백이 있어 CSS font 값에서 여러 키워드로 잘못 해석될 수 있는 글꼴 이름에만 쌍따옴표를 붙인다.
     * @param {string} fontName 원본 글꼴 이름
     * @returns {string} font 속성에 안전하게 넣을 수 있는 글꼴 이름
     */
    function quoteFontNameIfNeeded(fontName) {
        return fontName.includes(' ') ? `"${fontName}"` : fontName;
    }
    /**
     * 기본 글꼴 뒤에 FALLBACK_FONTS를 자기 자신 및 세 기본 글꼴 이름과 겹치지 않게 이어 붙인 글꼴 목록 문자열을 만든다.
     * @param {string} primaryFontName 최우선으로 사용할 글꼴 이름
     * @returns {string} 콤마로 구분된 글꼴 목록 문자열
     */
    function buildFontStack(primaryFontName) {
        const reserved = new Set([primaryFontName, TITLE_FONT_NAME, BUTTON_FONT_NAME, MESSAGE_FONT_NAME]);
        const uniqueFallbacks = [...new Set(FALLBACK_FONTS)].filter((fontName) => !reserved.has(fontName));
        return [primaryFontName, ...uniqueFallbacks].map(quoteFontNameIfNeeded).join(', ');
    }

    /**
     * 저장 데이터의 기본 구조를 만든다.
     * @returns {{clearList:string[], clearListByDifficulty:Record<'easy'|'normal'|'hard'|'extreme', string[]>, feverClearListByDifficulty:Record<'easy'|'normal'|'hard'|'extreme', string[]>, puzzleClearStages:number[], puzzleStarStages:number[]}} 초기 저장 데이터
     */
    function createInitialStore() {
        return {
            clearList: [],
            clearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
            feverClearListByDifficulty: { easy: [], normal: [], hard: [], extreme: [] },
            puzzleClearStages: [],
            puzzleStarStages: [],
            settings: { playerName: DEFAULT_PLAYER_NAME, musicVolume: 100, effectsVolume: 100, virtualController: 'none', graphicsQuality: DEFAULT_GRAPHICS_QUALITY, landscapeOrientationLocked: false, soundDataURL: '', aiProvider: 'OpenAI', aiApiKey: '', aiModel: DEFAULT_AI_MODEL },
            muted: false
        };
    }

    /** 저장된 플레이어 이름을 표시 가능한 기본값과 최대 길이로 정규화한다. @param {unknown} value 저장값 @returns {string} 플레이어 이름 */
    function normalizePlayerName(value) {
        if (typeof value !== 'string') return DEFAULT_PLAYER_NAME;
        const name = Array.from(value).slice(0, PLAYER_NAME_MAX_LENGTH).join('');
        return name.trim() ? name : DEFAULT_PLAYER_NAME;
    }

    /** 저장된 사운드 데이터 URL을 최대 길이로 정규화한다. @param {unknown} value 저장값 @returns {string} 사운드 데이터 URL */
    function normalizeSoundDataURL(value) {
        return typeof value === 'string' ? Array.from(value).slice(0, SOUND_DATA_URL_MAX_LENGTH).join('') : '';
    }

    /** 현재 설정된 플레이어 이름을 반환한다. @returns {string} 플레이어 이름 */
    function getPlayerName() {
        return normalizePlayerName(store?.settings?.playerName);
    }

    /** 그래픽 품질 키에 맞는 출력 해상도 항목을 반환한다. @param {unknown} quality 그래픽 품질 키 @returns {{key:'low'|'medium'|'high', label:string, width:number, height:number}} */
    function getGraphicsQualityOption(quality) {
        return GRAPHICS_QUALITY_OPTIONS.find((option) => option.key === quality)
            || GRAPHICS_QUALITY_OPTIONS.find((option) => option.key === DEFAULT_GRAPHICS_QUALITY);
    }

    /** 저장된 가상 컨트롤러 크기값을 유효한 선택지로 정규화한다. @param {unknown} value 저장값 @returns {'none'|'normal'|'large'} */
    function getVirtualControllerOption(value) {
        if (value === true) return 'normal';
        if (value === false) return 'none';
        return VIRTUAL_CONTROLLER_OPTIONS.some((option) => option.key === value) ? value : 'none';
    }

    /** 가로 방향 고정 저장값을 불리언으로 정규화한다. @param {unknown} value 저장값 @returns {boolean} 가로 방향 고정 여부 */
    function normalizeLandscapeOrientationLocked(value) {
        return value === true;
    }

    /**
     * 현재 그래픽 설정의 캔버스 출력 크기와 논리 좌표 배율을 반환한다.
     * @returns {{graphicsQuality:'low'|'medium'|'high', width:number, height:number, scaleX:number, scaleY:number}}
     */
    function getCanvasOutputSize() {
        const option = getGraphicsQualityOption(store?.settings?.graphicsQuality);
        return {
            graphicsQuality: option.key,
            width: option.width,
            height: option.height,
            scaleX: option.width / WIDTH,
            scaleY: option.height / HEIGHT
        };
    }

    /** 논리 게임 좌표를 현재 캔버스의 실제 출력 좌표로 변환한다. @param {number} x 논리 X 좌표 @param {number} y 논리 Y 좌표 @returns {{x:number, y:number}} 실제 캔버스 좌표 */
    function toCanvasCoordinates(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('x와 y는 유한한 숫자여야 합니다.');
        const { scaleX, scaleY } = getCanvasOutputSize();
        return { x: x * scaleX, y: y * scaleY };
    }

    /** 논리 게임 길이를 현재 캔버스의 실제 출력 길이로 변환한다. @param {number} length 논리 길이 @returns {number} 실제 캔버스 길이 */
    function toCanvasLength(length) {
        if (!Number.isFinite(length)) throw new TypeError('length는 유한한 숫자여야 합니다.');
        return length * getCanvasOutputSize().scaleX;
    }

    /** 현재 캔버스 컨텍스트에 논리 1280x720 좌표계를 적용한다. @returns {{graphicsQuality:'low'|'medium'|'high', width:number, height:number, scaleX:number, scaleY:number}} 적용한 출력 정보 */
    function applyCanvasCoordinateTransform() {
        const outputSize = getCanvasOutputSize();
        if (context) context.setTransform(outputSize.scaleX, 0, 0, outputSize.scaleY, 0, 0);
        return outputSize;
    }

    /** 현재 그래픽 설정에 맞춰 실제 캔버스 크기를 바꾸고 논리 좌표계를 다시 적용한다. @returns {{graphicsQuality:'low'|'medium'|'high', width:number, height:number, scaleX:number, scaleY:number}} 적용한 출력 정보 */
    function applyCanvasOutputResolution() {
        const outputSize = getCanvasOutputSize();
        if (!canvas) return outputSize;
        if (canvas.width !== outputSize.width) canvas.width = outputSize.width;
        if (canvas.height !== outputSize.height) canvas.height = outputSize.height;
        context = canvas.getContext('2d');
        if (!context) throw new Error('2D 캔버스 컨텍스트를 만들 수 없습니다.');
        return applyCanvasCoordinateTransform();
    }

    /** 현재 뷰포트에서 게임 화면을 회전해야 하는지 반환한다. @returns {boolean} 화면 회전 여부 */
    function shouldRotateCanvasForViewport() {
        return window.innerWidth < window.innerHeight && !store?.settings?.landscapeOrientationLocked;
    }

    /** 뷰포트 방향에 맞춰 게임 화면 회전 클래스를 갱신한다. @returns {void} */
    function updateCanvasOrientation() {
        document.body?.classList.toggle('puyow-portrait', shouldRotateCanvasForViewport());
    }

    /** 캔버스 입력 이벤트를 게임의 논리 좌표로 변환한다. @param {MouseEvent|PointerEvent} event 입력 이벤트 @returns {{x:number,y:number}} 게임 논리 좌표 */
    function getCanvasEventCoordinates(event) {
        const bounds = canvas.getBoundingClientRect();
        if (shouldRotateCanvasForViewport()) {
            return {
                x: (event.clientY - bounds.top) * WIDTH / bounds.height,
                y: (bounds.right - event.clientX) * HEIGHT / bounds.width
            };
        }
        return {
            x: (event.clientX - bounds.left) * WIDTH / bounds.width,
            y: (event.clientY - bounds.top) * HEIGHT / bounds.height
        };
    }

    /** 갤러리에서 처음부터 공개할 항목을 만든다. @returns {{warning:string[],enemies:string[]}} */
    function createInitialGalleryUnlocks() {
        return { warning: ['tiny'], enemies: ['Andromalius'] };
    }

    /** 갤러리 잠금 해제 정보를 매 진입 시점에 불러온다. @returns {void} */
    function loadGalleryUnlocks() {
        const initial = createInitialGalleryUnlocks();
        try {
            const serialized = storageManager.getItem(GALLERY_STORE_KEY);
            if (!serialized) {
                galleryUnlocks = initial;
                return;
            }
            const parsed = JSON.parse(serialized);
            if (!parsed || typeof parsed !== 'object') throw new TypeError('갤러리 저장 형식이 올바르지 않습니다.');
            const warning = Array.isArray(parsed.warning) ? parsed.warning.filter((type) => typeof type === 'string') : [];
            const enemies = Array.isArray(parsed.enemies) ? parsed.enemies.filter((type) => typeof type === 'string') : [];
            galleryUnlocks = {
                warning: [...new Set([...initial.warning, ...warning])],
                enemies: [...new Set([...initial.enemies, ...enemies])]
            };
        } catch (error) {
            console.error('Puyo W 갤러리 저장 데이터 불러오기에 실패했습니다.', error);
            galleryUnlocks = initial;
        }
    }

    /** 갤러리 잠금 해제 정보를 짧은 지연 뒤 안전하게 기록한다. @returns {void} */
    function saveGalleryUnlocks() {
        setTimeout(() => {
            try {
                storageManager.setItem(GALLERY_STORE_KEY, JSON.stringify(galleryUnlocks));
            } catch (error) {
                console.error('Puyo W 갤러리 저장 데이터 기록에 실패했습니다.', error);
            }
        }, 1);
    }

    /** 게임에서 표시된 예고뿌요를 갤러리에 공개한다. @param {string} type 예고뿌요 종류 @returns {void} */
    function unlockGalleryWarning(type) {
        if (galleryUnlocks.warning.includes(type)) return;
        galleryUnlocks.warning.push(type);
        saveGalleryUnlocks();
    }

    /** 기본·피버 룰 대전에서 이긴 적을 갤러리에 공개한다. @param {string} classType 적 종류 식별자 @returns {void} */
    function unlockGalleryEnemy(classType) {
        if (galleryUnlocks.enemies.includes(classType)) return;
        galleryUnlocks.enemies.push(classType);
        // saveGalleryUnlocks는 setTimeout(1)과 try-catch로 저장 실패가 게임 흐름을 막지 않게 한다.
        saveGalleryUnlocks();
    }

    /** 현재 실제 플레이가 갤러리 해금을 허용하는 기본 룰·연습·연속 피버인지 판별한다. @returns {boolean} 해금 가능 여부 */
    function canUnlockGalleryWarningInCurrentGame() {
        return Boolean(game && !game.feverRule && game.running && game.countdown <= 0 && !game.paused && !game.ending && !game.tutorial);
    }

    /** 초기 타이틀 중앙에 그릴, 잠금 해제된 갤러리 대상 목록을 만든다. @returns {{draw:()=>void}[]} */
    function getInitialGalleryPreviewItems() {
        const centerX = WIDTH / 2;
        const centerY = 380;
        const puyos = [...COLORS, 'garbage'].map((color) => {
            const puyo = getPuyo(color);
            return {
                draw: () => {
                    context.save(); context.translate(centerX, centerY); context.scale(5.6, 5.6);
                    puyo.draw(context, -CELL / 2, -CELL / 2, CELL);
                    context.restore();
                }
            };
        });
        const warnings = [...WARNING_PUYO_CLASSES]
            .sort((left, right) => left.unitCount - right.unitCount)
            .map((WarningPuyoType) => new WarningPuyoType())
            .filter((unit) => galleryUnlocks.warning.includes(unit.type))
            .map((unit) => ({
                draw: () => {
                    context.save(); context.translate(centerX, centerY); context.scale(5.2, 5.2);
                    unit.draw(context, -CELL / 2, -CELL / 2, CELL);
                    context.restore();
                }
            }));
        const enemies = getVisibleOpponents()
            .filter((entry) => galleryUnlocks.enemies.includes(entry.classType))
            .map((entry) => ({ draw: () => entry.createController().drawPortrait(context, centerX, centerY, 2.8, 'normal') }));
        return [...puyos, ...warnings, ...enemies];
    }

    /** 초기 타이틀을 먼저 그린 뒤 비동기로 갤러리 잠금 데이터를 읽고 미리보기를 준비한다. @returns {void} */
    function loadInitialGalleryPreview() {
        initialGalleryPreview = { loaded: false, items: [], startIndex: 0, elapsed: 0 };
        setTimeout(() => {
            try {
                // loadGalleryUnlocks 내부에서도 저장소 오류를 처리한다.
                loadGalleryUnlocks();
                const items = getInitialGalleryPreviewItems();
                initialGalleryPreview = {
                    loaded: true,
                    items,
                    startIndex: items.length ? Math.floor(randomFloat() * items.length) : 0,
                    elapsed: 0
                };
            } catch (error) {
                console.error('Puyo W 초기 갤러리 미리보기를 준비하지 못했습니다.', error);
                galleryUnlocks = createInitialGalleryUnlocks();
                try {
                    initialGalleryPreview = { loaded: true, items: getInitialGalleryPreviewItems(), startIndex: 0, elapsed: 0 };
                } catch (fallbackError) {
                    console.error('Puyo W 초기 갤러리 미리보기 복구에 실패했습니다.', fallbackError);
                    initialGalleryPreview = { loaded: true, items: [], startIndex: 0, elapsed: 0 };
                }
            }
        }, 1);
    }

    /** 0 이상 1 미만의 난수로 배열을 섞는다. @param {unknown[]} values 원본 배열 @returns {unknown[]} 섞인 새 배열 */
    function shuffleGalleryValues(values) {
        const shuffled = [...values];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(randomFloat() * (index + 1));
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }
        return shuffled;
    }

    /** 메인 메뉴 떠다니는 후보를 추첨한다. 일반 뿌요는 중복하지 않고 방해·예고뿌요는 복원 추첨한다. @param {{allowDuplicate:boolean}[]} candidates 추첨 후보 @param {number} count 떠다닐 개수 @returns {{allowDuplicate:boolean}[]} 선택된 후보 */
    function selectMainMenuGalleryFloaters(candidates, count) {
        const uniqueCandidates = shuffleGalleryValues(candidates.filter((candidate) => !candidate.allowDuplicate));
        const repeatableCandidates = candidates.filter((candidate) => candidate.allowDuplicate);
        const selected = [];
        while (selected.length < count && (uniqueCandidates.length || repeatableCandidates.length)) {
            const pool = [...uniqueCandidates, ...repeatableCandidates];
            const selectedCandidate = pool[Math.floor(randomFloat() * pool.length)];
            selected.push(selectedCandidate);
            if (!selectedCandidate.allowDuplicate) uniqueCandidates.splice(uniqueCandidates.indexOf(selectedCandidate), 1);
        }
        return selected;
    }

    /** 메인 메뉴에서 떠다닐 갤러리 일반·방해·예고뿌요를 새로 추첨한다. @returns {void} */
    function createMainMenuGalleryFloaters() {
        try {
            loadGalleryUnlocks();
            const candidates = [...COLORS, 'garbage'].map((color) => {
                const puyo = getPuyo(color);
                return {
                    radius: CELL * 0.5,
                    allowDuplicate: color === 'garbage',
                    draw: () => puyo.draw(context, -CELL / 2, -CELL / 2, CELL, 0.82)
                };
            });
            WARNING_PUYO_CLASSES.forEach((WarningPuyoType) => {
                const unit = new WarningPuyoType();
                if (galleryUnlocks.warning.includes(unit.type)) candidates.push({
                    radius: CELL * 0.62,
                    allowDuplicate: true,
                    draw: () => unit.draw(context, -CELL / 2, -CELL / 2, CELL)
                });
            });
            const floaterCount = MAIN_MENU_GALLERY_FLOATER_MIN_COUNT
                + Math.floor(randomFloat() * (MAIN_MENU_GALLERY_FLOATER_MAX_COUNT - MAIN_MENU_GALLERY_FLOATER_MIN_COUNT + 1));
            const selected = selectMainMenuGalleryFloaters(candidates, floaterCount);
            mainMenuGalleryFloaters = selected.map((item) => {
                const radius = item.radius;
                const speed = 0.012 + randomFloat() * 0.012;
                const x = radius + randomFloat() * (WIDTH - radius * 2);
                const y = radius + randomFloat() * (HEIGHT - radius * 2);
                const vx = (randomFloat() < 0.5 ? -1 : 1) * speed;
                const vy = (randomFloat() < 0.5 ? -1 : 1) * speed * (0.75 + randomFloat() * 0.5);
                return {
                    ...item,
                    x,
                    y,
                    vx,
                    vy,
                    // 위치와 이동 방향에서 초기 자세를 정해 난수 소비량을 기존과 동일하게 유지한다.
                    rotation: ((x / WIDTH + y / HEIGHT) % 1) * Math.PI * 2,
                    rotationVelocity: (vx * vy >= 0 ? 1 : -1) * MAIN_MENU_GALLERY_FLOATER_MAX_ROTATION_SPEED * 0.25
                };
            });
        } catch (error) {
            // 저장소뿐 아니라 확장 예고뿌요 생성·추첨 오류도 메뉴 렌더링을 중단시키지 않는다.
            console.error('Puyo W 메인 메뉴 갤러리 항목 준비에 실패했습니다.', error);
            mainMenuGalleryFloaters = [];
        }
    }

    /** 메인 메뉴의 갤러리 항목을 천천히 이동하고 캔버스 경계에서 튕긴다. @param {number} delta 경과 시간(ms) @returns {void} */
    function updateMainMenuGalleryFloaters(delta) {
        mainMenuGalleryFloaters.forEach((item) => {
            const incomingVx = item.vx;
            const incomingVy = item.vy;
            let collisionNormalX = 0;
            let collisionNormalY = 0;
            item.x += item.vx * delta;
            item.y += item.vy * delta;
            if (item.x <= item.radius || item.x >= WIDTH - item.radius) {
                item.x = Math.max(item.radius, Math.min(WIDTH - item.radius, item.x));
                if (item.x === item.radius) {
                    item.vx = Math.abs(item.vx);
                    collisionNormalX = 1;
                } else {
                    item.vx = -Math.abs(item.vx);
                    collisionNormalX = -1;
                }
            }
            if (item.y <= item.radius || item.y >= HEIGHT - item.radius) {
                item.y = Math.max(item.radius, Math.min(HEIGHT - item.radius, item.y));
                if (item.y === item.radius) {
                    item.vy = Math.abs(item.vy);
                    collisionNormalY = 1;
                } else {
                    item.vy = -Math.abs(item.vy);
                    collisionNormalY = -1;
                }
            }
            if (collisionNormalX || collisionNormalY) {
                // 벽의 접선 방향 속도가 클수록 비스듬한 충돌이므로 회전량도 커진다.
                const tangentVelocity = incomingVy * collisionNormalX - incomingVx * collisionNormalY;
                item.rotationVelocity += tangentVelocity * MAIN_MENU_GALLERY_FLOATER_ROTATION_IMPULSE;
                item.rotationVelocity = Math.max(
                    -MAIN_MENU_GALLERY_FLOATER_MAX_ROTATION_SPEED,
                    Math.min(MAIN_MENU_GALLERY_FLOATER_MAX_ROTATION_SPEED, item.rotationVelocity)
                );
            }
            item.rotation = (item.rotation + item.rotationVelocity * delta) % (Math.PI * 2);
        });
    }

    /** 메인 메뉴의 갤러리 항목을 배경에 그린다. @returns {void} */
    function drawMainMenuGalleryFloaters() {
        mainMenuGalleryFloaters.forEach((item) => {
            try {
                context.save(); context.translate(item.x, item.y); context.rotate(item.rotation); item.draw(); context.restore();
            } catch (error) {
                context.restore();
                console.error('Puyo W 메인 메뉴 갤러리 항목 렌더링에 실패했습니다.', error);
            }
        });
    }

    /**
     * 현재 저장 데이터를 localStorage에 기록한다. 실패해도 게임 흐름은 계속한다.
     * @returns {void}
     */
    function saveStore() {
        try {
            storageManager.setItem(STORE_KEY, JSON.stringify(store));
        } catch (error) {
            console.error('Puyo W 저장 데이터 기록에 실패했습니다.', error);
        }
    }

    /**
     * localStorage에서 저장 데이터를 불러오고, 없거나 형식이 잘못되었으면 초기화한다.
     * @returns {void}
     */
    function loadStore() {
        try {
            const serialized = storageManager.getItem(STORE_KEY);
            if (!serialized) {
                store = createInitialStore();
                return;
            }
            const parsed = JSON.parse(serialized);
            if (!parsed || !Array.isArray(parsed.clearList) || !parsed.clearList.every((name) => typeof name === 'string')) {
                throw new TypeError('clearList 배열이 필요합니다.');
            }
            const storedClearListByDifficulty = parsed.clearListByDifficulty && typeof parsed.clearListByDifficulty === 'object' && !Array.isArray(parsed.clearListByDifficulty)
                ? parsed.clearListByDifficulty
                : {};
            const initial = createInitialStore();
            const clearListByDifficulty = Object.fromEntries(Object.keys(initial.clearListByDifficulty).map((key) => [
                key,
                Array.isArray(storedClearListByDifficulty[key])
                    ? [...new Set(storedClearListByDifficulty[key].filter((name) => typeof name === 'string'))]
                    : []
            ]));
            const storedFeverClearListByDifficulty = parsed.feverClearListByDifficulty && typeof parsed.feverClearListByDifficulty === 'object' && !Array.isArray(parsed.feverClearListByDifficulty)
                ? parsed.feverClearListByDifficulty
                : {};
            const feverClearListByDifficulty = Object.fromEntries(Object.keys(initial.feverClearListByDifficulty).map((key) => [
                key,
                Array.isArray(storedFeverClearListByDifficulty[key])
                    ? [...new Set(storedFeverClearListByDifficulty[key].filter((name) => typeof name === 'string'))]
                    : []
            ]));
            const settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
            const puzzleClearStages = Array.isArray(parsed.puzzleClearStages)
                ? [...new Set(parsed.puzzleClearStages.filter((index) => Number.isInteger(index) && index >= 0))]
                : [];
            const puzzleStarStages = Array.isArray(parsed.puzzleStarStages)
                ? [...new Set(parsed.puzzleStarStages.filter((index) => Number.isInteger(index) && index >= 0))]
                : [];
            store = { clearList: [...new Set(parsed.clearList)], clearListByDifficulty, feverClearListByDifficulty, puzzleClearStages, puzzleStarStages, settings: {
                playerName: normalizePlayerName(settings.playerName),
                musicVolume: Number.isInteger(settings.musicVolume) ? Math.max(0, Math.min(100, settings.musicVolume)) : initial.settings.musicVolume,
                effectsVolume: Number.isInteger(settings.effectsVolume) ? Math.max(0, Math.min(100, settings.effectsVolume)) : initial.settings.effectsVolume,
                // 이전 켜기/끄기 불리언 저장값도 각각 보통/없음으로 유지한다.
                virtualController: getVirtualControllerOption(settings.virtualController),
                graphicsQuality: getGraphicsQualityOption(settings.graphicsQuality).key,
                landscapeOrientationLocked: normalizeLandscapeOrientationLocked(settings.landscapeOrientationLocked),
                soundDataURL: normalizeSoundDataURL(settings.soundDataURL),
                // 이전 Google 설정값은 더 이상 선택할 수 없으므로 기본 제공자인 OpenAI로 정규화한다.
                aiProvider: AI_SERVICE_PROVIDERS.includes(settings.aiProvider) ? settings.aiProvider : initial.settings.aiProvider,
                aiApiKey: typeof settings.aiApiKey === 'string' ? settings.aiApiKey : initial.settings.aiApiKey,
                aiModel: typeof settings.aiModel === 'string' && settings.aiModel.trim() ? settings.aiModel : initial.settings.aiModel
            }, muted: parsed.muted === true };
        } catch (error) {
            console.error('Puyo W 저장 데이터 불러오기에 실패했습니다.', error);
            store = createInitialStore();
        }
    }

    /**
     * noticeUrl을 읽는다. 상대경로는 puyow.js와 같은 경로를 기준으로 해석하고,
     * 절대 URL은 지정한 주소 그대로 사용한다. 읽기 실패 시 빈 안내문으로 둔다.
     * @returns {Promise<void>}
     */
    async function loadNotice() {
        if (typeof fetch !== 'function' || typeof document === 'undefined') return;
        try {
            const script = [...(document.scripts || [])].find((element) => /puyow(?:\.min)?\.js(?:[?#]|$)/.test(element.src));
            const scriptUrl = new URL(convertURL(script?.src || document.baseURI));
            const notiUrl = new URL(convertURL(noticeUrl), scriptUrl);
            const response = await fetch(convertURL(notiUrl.href));
            if (!response.ok) throw new Error(`${noticeUrl} 요청 실패 (${response.status})`);
            noticeText = await response.text();
        } catch (error) {
            console.error(`${noticeUrl}를 불러오지 못했습니다.`, error);
            noticeText = '';
        }
    }

    /**
     * 사운드 정보가 담겨 있는 JSON 을 실제 사운드로 적용한다.
     */
    function applySoundDataJson(soundDataJson) {
        if(soundDataJson == null) return;
        if(typeof(soundDataJson) == 'string') soundDataJson = JSON.parse(soundDataJson);
        if(soundDataJson.common) {
            const commonObj = soundDataJson.common;
            if(commonObj.gameStarts) commonSoundPool.gameStarts = commonObj.gameStarts;
            if(commonObj.selects) commonSoundPool.selects = commonObj.selects;
            if(commonObj.cancels) commonSoundPool.cancels = commonObj.cancels;
            if(commonObj.focusMoves) commonSoundPool.focusMoves = commonObj.focusMoves;
            if(commonObj.loose) commonSoundPool.loose = commonObj.loose;
            if(commonObj.puyoFall) commonSoundPool.puyoFall = commonObj.puyoFall;
            if(commonObj.garbageFallLittle) commonSoundPool.garbageFallLittle = commonObj.garbageFallLittle;
            if(commonObj.garbageFallLot) commonSoundPool.garbageFallLot = commonObj.garbageFallLot;
            if(commonObj.puyoRotate) commonSoundPool.puyoRotate = commonObj.puyoRotate;
            if(commonObj.clears) commonSoundPool.clears = commonObj.clears;
            if(commonObj.feverEnter) commonSoundPool.feverEnter = commonObj.feverEnter;
            if(commonObj.feverLightOn) commonSoundPool.feverLightOn = commonObj.feverLightOn;
            if(commonObj.combo3SpellEffect) commonSoundPool.combo3SpellEffect = commonObj.combo3SpellEffect;
            if(commonObj.combo4SpellEffect) commonSoundPool.combo4SpellEffect = commonObj.combo4SpellEffect;
            if(commonObj.combo5SpellEffect) commonSoundPool.combo5SpellEffect = commonObj.combo5SpellEffect;
            if(commonObj.combo6SpellEffect) commonSoundPool.combo6SpellEffect = commonObj.combo6SpellEffect;
            if(commonObj.puyoBurstCombo1) commonSoundPool.puyoBurstCombo1 = commonObj.puyoBurstCombo1;
            if(commonObj.puyoBurstCombo2) commonSoundPool.puyoBurstCombo2 = commonObj.puyoBurstCombo2;
            if(commonObj.puyoBurstCombo3) commonSoundPool.puyoBurstCombo3 = commonObj.puyoBurstCombo3;
            if(commonObj.puyoBurstCombo4) commonSoundPool.puyoBurstCombo4 = commonObj.puyoBurstCombo4;
            if(commonObj.puyoBurstCombo5) commonSoundPool.puyoBurstCombo5 = commonObj.puyoBurstCombo5;
            if(commonObj.puyoBurstCombo6) commonSoundPool.puyoBurstCombo6 = commonObj.puyoBurstCombo6;
            if(commonObj.puyoBurstCombo7) commonSoundPool.puyoBurstCombo7 = commonObj.puyoBurstCombo7;
            if(commonObj.backgroundMusic) commonSoundPool.backgroundMusic = commonObj.backgroundMusic;
            if(commonObj.otherBackgroundMusic) commonSoundPool.otherBackgroundMusic = commonObj.otherBackgroundMusic;
            if(commonObj.feverBackgroundMusic) commonSoundPool.feverBackgroundMusic = commonObj.feverBackgroundMusic;
        }
        if(soundDataJson.player) {
            const playerObj = soundDataJson.player;
            if(playerObj.spellCombo1) commonSoundPool.spellCombo1 = playerObj.spellCombo1;
            if(playerObj.spellCombo2) commonSoundPool.spellCombo2 = playerObj.spellCombo2;
            if(playerObj.spellCombo3) commonSoundPool.spellCombo3 = playerObj.spellCombo3;
            if(playerObj.spellCombo4) commonSoundPool.spellCombo4 = playerObj.spellCombo4;
            if(playerObj.spellCombo5) commonSoundPool.spellCombo5 = playerObj.spellCombo5;
            if(playerObj.spellCombo6) commonSoundPool.spellCombo6 = playerObj.spellCombo6;
            if(playerObj.spellCombo7) commonSoundPool.spellCombo7 = playerObj.spellCombo7;
        }
        if(soundDataJson.enemy) {
            const enemyObj = soundDataJson.enemy;
            if(enemyObj.spellCombo1) commonSoundPool.commonEnemySpellCombo1 = enemyObj.spellCombo1;
            if(enemyObj.spellCombo2) commonSoundPool.commonEnemySpellCombo2 = enemyObj.spellCombo2;
            if(enemyObj.spellCombo3) commonSoundPool.commonEnemySpellCombo3 = enemyObj.spellCombo3;
            if(enemyObj.spellCombo4) commonSoundPool.commonEnemySpellCombo4 = enemyObj.spellCombo4;
            if(enemyObj.spellCombo5) commonSoundPool.commonEnemySpellCombo5 = enemyObj.spellCombo5;
            if(enemyObj.spellCombo6) commonSoundPool.commonEnemySpellCombo6 = enemyObj.spellCombo6;
            if(enemyObj.spellCombo7) commonSoundPool.commonEnemySpellCombo7 = enemyObj.spellCombo7;
        }
    }

    /** 설정한 사운드 데이터 URL에서 JSON을 비동기로 불러온다. @returns {Promise<void>} 완료 시점 */
    async function loadSoundDataURL() {
        if (soundDataURL === null || soundDataURL === '') return;
        try {
            const convertedURL = convertURL(soundDataURL);

            // JSONP 로 convertedURL 호출
            const scriptObj = document.createElement('script');
            scriptObj.src = convertedURL;
            scriptObj.classList.add('script_jsonp');
            document.body.appendChild(scriptObj);
        } catch (error) {
            console.error('사운드 데이터 URL을 불러오지 못했습니다.', error);
        }
    }

    /**
     * 메인 화면에서 읽을 공지사항 파일 경로 또는 URL을 설정한다.
     * 상대경로는 puyow.js와 같은 경로를 기준으로 해석한다.
     * @param {string} noticeFile 공지사항 파일명, 상대경로 또는 절대 URL
     * @returns {void}
     */
    function setNoticeFile(noticeFile) {
        if (initialized) throw new Error('공지사항 경로 설정은 initialize 호출 전에 해야 합니다.');
        if (typeof noticeFile !== 'string' || noticeFile.length === 0) {
            throw new TypeError('공지사항 경로는 비어 있지 않은 문자열이어야 합니다.');
        }
        noticeUrl = noticeFile;
    }

    /**
     * URL 예약어 치환에 사용할 웹 애플리케이션 컨텍스트 경로를 설정한다.
     * 값은 [CTX] 예약어에 그대로 들어가므로 필요한 앞뒤 슬래시를 호출자가 포함해야 한다.
     * @param {string} contextPath [CTX]를 대신할 문자열
     * @returns {void}
     */
    function setURLContextPath(contextPath) {
        if (typeof contextPath !== 'string') throw new TypeError('URL 컨텍스트 경로는 문자열이어야 합니다.');
        urlContextPath = contextPath;
    }

    /**
     * 시스템 언어에서 URL 예약어에 쓸 두 글자 언어 코드를 구한다.
     * 한국어 원문은 번역표 밖에 있으나 기본 언어이므로 지원 언어로 취급한다.
     * @returns {string} stringTable에 있는 언어 코드 또는 ko, 그 외에는 en
     */
    function getURLLanguageCode() {
        const systemLanguage = typeof navigator !== 'undefined'
            ? (navigator.language || navigator.userLanguage || languageCode)
            : languageCode;
        const code = typeof systemLanguage === 'string' ? systemLanguage.trim().slice(0, 2).toLowerCase() : '';
        return code === 'ko' || Object.prototype.hasOwnProperty.call(stringTable, code) ? code : 'en';
    }

    /**
     * URL 안의 [CTX], [LANG] 예약어를 현재 컨텍스트 경로와 시스템 언어 코드로 모두 치환한다.
     * 상대경로와 절대 URL 모두 전달할 수 있다.
     * @param {string} url 변환할 URL
     * @returns {string} 예약어가 치환된 URL
     */
    function convertURL(url) {
        if (typeof url !== 'string') throw new TypeError('URL은 문자열이어야 합니다.');
        return url.replace(/\[CTX\]/g, urlContextPath).replace(/\[LANG\]/g, getURLLanguageCode());
    }

    /**
     * 현재 게임에 적용할 AI 난이도 정보를 반환한다.
     * 게임 중에는 시작할 때 선택한 값이 반환되고, 메뉴에서는 현재 선택 중인 값이 반환된다.
     * @returns {{key:'easy'|'normal'|'hard'|'extreme', name:string, fastDownDelay:number|null}} AI 난이도 키, 표시명, 빠른 하강 대기 시간(ms)
     */
    function getSelectedDifficulty() {
        const index = game ? game.aiDifficulty : selectedAiDifficulty;
        const difficulty = AI_DIFFICULTIES[index] || AI_DIFFICULTIES[1];
        return { ...difficulty };
    }

    /**
     * 현재 게임에 적용할 색상 수 설정을 반환한다.
     * 게임 중에는 시작할 때 선택한 값이 반환되고, 메뉴에서는 현재 선택 중인 값이 반환된다.
     * @returns {3|4|5} 사용할 일반 뿌요 색상 수
     */
    function getSelectedColorCount() {
        const index = game ? game.difficulty : selectedDifficulty;
        const difficulty = DIFFICULTIES[index] || DIFFICULTIES[1];
        return difficulty.colors.length;
    }

    /**
     * 현재 브라우저 언어에 맞춰 한국어 원문을 번역하고 %1, %2 형식의 인수를 채운다.
     * @param {string} text 한국어 원문 키
     * @param {...(string|number)} values 치환할 값
     * @returns {string} 표시할 문구
     */
    function translate(text, ...values) {
        const localeTable = stringTable[languageCode] || stringTable[languageCode.split('-')[0]] || stringTable.en;
        const translated = languageCode === 'ko' ? text : localeTable[text] || text;
        return values.reduce((result, value, index) => result.replace(`%${index + 1}`, String(value)), translated);
    }

    /** 현재 음량 설정을 HTMLAudioElement의 0~1 범위로 변환한다. @param {'music'|'effects'} type 음량 종류 @returns {number} 음량 */
    function getAudioVolume(type) {
        if (store.muted) return 0;
        const value = type === 'music' ? store.settings.musicVolume : store.settings.effectsVolume;
        return Math.max(0, Math.min(1, Number(value) / 100));
    }

    /** 음원 URL을 일회성 효과음으로 재생한다. 재생 실패는 기록하고 게임은 계속 진행한다. @param {string|null|undefined} url 음원 URL @param {'music'|'effects'} type 음량 종류 @param {string} label 로그용 설명 @returns {void} */
    function playSound(url, type, label) {
        if (url === null || url === undefined || url === '' || typeof Audio === 'undefined' || getAudioVolume(type) <= 0) return;
        try {
            const audio = new Audio(convertURL(url));
            audio.volume = getAudioVolume(type);
            const result = audio.play();
            if (result && typeof result.catch === 'function') result.catch((error) => console.error(`${label} 재생에 실패했습니다.`, error));
        } catch (error) {
            console.error(`${label} 재생에 실패했습니다.`, error);
        }
    }

    /** 메뉴 선택·취소 효과음이 재생된 횟수다. 포커스 이동음과 한 입력에서 겹치지 않게 한다. @type {number} */
    let menuActionSoundCount = 0;

    /** 일반 메뉴 버튼 또는 선택지를 실행한 효과음을 재생한다. @returns {void} */
    function playMenuSelectSound() {
        menuActionSoundCount += 1;
        playSound(commonSoundPool?.selects, 'effects', '메뉴 선택 효과음');
    }

    /** 메뉴의 취소 또는 종료 동작 효과음을 재생한다. @returns {void} */
    function playMenuCancelSound() {
        menuActionSoundCount += 1;
        playSound(commonSoundPool?.cancels, 'effects', '메뉴 취소 효과음');
    }

    /** 메뉴 버튼이나 선택지의 포커스가 옮겨졌을 때 효과음을 재생한다. @returns {void} */
    function playMenuFocusMoveSound() {
        playSound(commonSoundPool?.focusMoves, 'effects', '메뉴 포커스 이동 효과음');
    }

    /** 현재 입력 가능한 메뉴 포커스를 비교하기 위한 식별자를 만든다. @returns {string|null} */
    function getMenuFocusToken() {
        if (game?.tutorial?.mode === 'complete') return `tutorial:${game.tutorial.finalFocus}`;
        if (game?.paused) return `pause:${pauseMenuFocus}`;
        if (game) return null;
        if (menuScreen === 'title' && ruleSelectionOpen) return `rule:${ruleSelectionFocus}`;
        if (menuScreen === 'title') return `title:${titleMenuFocus}`;
        if (menuScreen === 'opponent') return `opponent:${opponentMenuFocus}:${selectedDifficulty}:${selectedAiDifficulty}:${selectedOpponent}:${selectedOpponentAction}`;
        if (menuScreen === 'practiceDifficulty') return `difficulty:${colorSelectionFocus}:${selectedDifficulty}`;
        if (menuScreen === 'puzzleStage') return `puzzle:${puzzleStageFocus}:${puzzleStageScrollOffset}`;
        if (menuScreen === 'settings') return `settings:${settingsFocus}`;
        if (menuScreen === 'gallery' && gallery) return `gallery:${gallery.focus}:${gallery.typeIndex}:${gallery.itemIndex}`;
        if (menuScreen === 'simulator' && simulator) return `simulator:${simulator.mode}:${simulator.focusArea}:${simulator.paletteFocus}`;
        return null;
    }

    /** 대량 방해뿌요 착지음이 아직 재생 중이면 중복 재생하지 않는다. @param {string|null|undefined} url 음원 URL @returns {void} */
    function playGarbageFallLotSound(url) {
        if (url === null || url === undefined || url === '' || typeof Audio === 'undefined' || getAudioVolume('effects') <= 0) return;
        if (garbageFallLotAudio && !garbageFallLotAudio.paused && !garbageFallLotAudio.ended) return;
        try {
            const audio = new Audio(convertURL(url));
            audio.volume = getAudioVolume('effects');
            garbageFallLotAudio = audio;
            const clearAudio = () => { if (garbageFallLotAudio === audio) garbageFallLotAudio = null; };
            if (typeof audio.addEventListener === 'function') audio.addEventListener('ended', clearAudio, { once: true });
            const result = audio.play();
            if (result && typeof result.catch === 'function') result.catch((error) => {
                clearAudio();
                console.error('대량 방해뿌요 착지 효과음 재생에 실패했습니다.', error);
            });
        } catch (error) {
            garbageFallLotAudio = null;
            console.error('대량 방해뿌요 착지 효과음 재생에 실패했습니다.', error);
        }
    }

    /** 일반 뿌요 착지음은 너무 짧은 간격으로 반복되지 않게 재생한다. @param {string|null|undefined} url 음원 URL @returns {void} */
    function playPuyoFallSound(url) {
        if (url === null || url === undefined || url === '' || typeof Audio === 'undefined' || getAudioVolume('effects') <= 0) return;
        const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
        if (now - puyoFallLastPlayedAt < PUYO_FALL_SOUND_COOLDOWN) return;
        puyoFallLastPlayedAt = now;
        playSound(url, 'effects', '뿌요 착지 효과음');
    }

    /** 중력 애니메이션으로 떨어진 뿌요들의 착지 효과음을 재생한다. @param {{color:string}[]} falling 착지한 뿌요 목록 @returns {void} */
    function playGravityLandingSounds(falling) {
        if (!Array.isArray(falling) || !falling.length) return;
        const normalPuyoCount = falling.filter((puyo) => COLORS.includes(puyo.color)).length;
        const garbageCount = falling.filter((puyo) => puyo.color === 'garbage').length;
        for (let index = 0; index < normalPuyoCount; index += 1) playPuyoFallSound(commonSoundPool?.puyoFall);
        if (garbageCount >= 6) playGarbageFallLotSound(commonSoundPool?.garbageFallLot);
        else for (let index = 0; index < garbageCount; index += 1) playSound(commonSoundPool?.garbageFallLittle, 'effects', '방해뿌요 착지 효과음');
    }

    /** 현재 배경음악을 중지하고 재생 위치를 초기화한다. @returns {void} */
    function stopBackgroundMusic() {
        if (!backgroundMusicAudio) return;
        try {
            backgroundMusicAudio.pause();
            backgroundMusicAudio.currentTime = 0;
        } catch (error) {
            console.error('배경음악 중지에 실패했습니다.', error);
        }
        backgroundMusicAudio = null;
        backgroundMusicUrl = null;
    }

    /** 현재 배경음악을 일시정지한다. @returns {void} */
    function pauseBackgroundMusic() {
        if (!backgroundMusicAudio) return;
        try {
            backgroundMusicAudio.pause();
        } catch (error) {
            console.error('배경음악 일시정지에 실패했습니다.', error);
        }
    }

    /** 일시정지된 현재 배경음악을 재개한다. @returns {void} */
    function resumeBackgroundMusic() {
        if (!backgroundMusicAudio) return;
        try {
            backgroundMusicAudio.volume = getAudioVolume('music');
            if (!backgroundMusicAudio.paused) return;
            const result = backgroundMusicAudio.play();
            if (result && typeof result.catch === 'function') result.catch((error) => console.error('배경음악 재개에 실패했습니다.', error));
        } catch (error) {
            console.error('배경음악 재개에 실패했습니다.', error);
        }
    }

    /** 하나의 배경음악만 반복 재생하도록 음원을 교체한다. @param {string|null|undefined} url 음원 URL @returns {void} */
    function startBackgroundMusic(url) {
        if (url === null || url === undefined || url === '' || typeof Audio === 'undefined' || !hasUserStarted) {
            stopBackgroundMusic();
            return;
        }
        const convertedUrl = convertURL(url);
        if (backgroundMusicAudio && backgroundMusicUrl === convertedUrl) {
            updateBackgroundMusicVolume();
            return;
        }
        stopBackgroundMusic();
        try {
            const audio = new Audio(convertedUrl);
            audio.loop = true;
            audio.volume = getAudioVolume('music');
            backgroundMusicAudio = audio;
            backgroundMusicUrl = convertedUrl;
            const result = audio.play();
            if (result && typeof result.catch === 'function') result.catch((error) => console.error('배경음악 재생에 실패했습니다.', error));
        } catch (error) {
            console.error('배경음악 재생에 실패했습니다.', error);
            backgroundMusicAudio = null;
            backgroundMusicUrl = null;
        }
    }

    /** 게임용 배경음악을 시작한다. 연습·시뮬레이션·플레이 방법은 항상 공통 음원을 사용한다. @param {Enemy|null} controller 현재 적 컨트롤러 @param {boolean} useCommonMusic 공통 음원만 사용할지 여부 @returns {void} */
    function startGameBackgroundMusic(controller, useCommonMusic = false) {
        const enemyMusic = useCommonMusic ? null : controller?.soundPool?.backgroundMusic;
        const url = enemyMusic !== null && enemyMusic !== undefined ? enemyMusic : commonSoundPool?.backgroundMusic;
        startBackgroundMusic(url);
    }

    /** 게임 외 화면용 공통 배경음악을 시작한다. @returns {void} */
    function startOtherBackgroundMusic() {
        startBackgroundMusic(commonSoundPool?.otherBackgroundMusic);
    }

    /** 현재 화면에 맞는 단일 배경음악을 재생 또는 일시정지 상태로 맞춘다. @returns {void} */
    function syncBackgroundMusic() {
        try {
            if (!hasUserStarted) {
                stopBackgroundMusic();
                return;
            }
            if (!game) {
                if (menuScreen === 'simulator' && simulator?.mode === 'simulation') startGameBackgroundMusic(null, true);
                else startOtherBackgroundMusic();
                return;
            }
            if (!game.running) {
                startOtherBackgroundMusic();
                return;
            }
            const feverMusicActive = game.continuousFever
                || (game.feverRule && game.players.some((player) => player.fever?.active));
            if (feverMusicActive) startBackgroundMusic(commonSoundPool?.feverBackgroundMusic);
            else if (game.tutorial) startGameBackgroundMusic(null, true);
            else startGameBackgroundMusic(game.practice ? null : game.themeController, game.practice);
            if (game.paused) pauseBackgroundMusic();
            else resumeBackgroundMusic();
        } catch (error) {
            console.error('배경음악 상태를 동기화하지 못했습니다.', error);
        }
    }

    /** 저장된 음소거·배경음악 음량 설정을 현재 재생 중인 음악에 적용한다. @returns {void} */
    function updateBackgroundMusicVolume() {
        if (!backgroundMusicAudio) return;
        try {
            backgroundMusicAudio.volume = getAudioVolume('music');
        } catch (error) {
            console.error('배경음악 음량을 적용하지 못했습니다.', error);
        }
    }

    /** 연쇄 번호에 맞는 사운드 풀 항목을 선택한다. 7 이상은 7번을 사용한다. @param {SoundPool|CommonSoundPool|null|undefined} pool 사운드 풀 @param {string} prefix 속성 접두사 @param {number} combo 연쇄 번호 @returns {string|null} 음원 URL */
    function getComboSoundUrl(pool, prefix, combo) {
        if (!pool) return null;
        const index = Math.max(1, Math.min(7, Math.floor(combo)));
        const url = pool[`${prefix}${index}`];
        return url === null || url === undefined || url === '' ? null : url;
    }

    /** 한 단계의 연쇄에 필요한 주문과 뿌요 폭발 효과음을 재생한다. @param {PlayerState} player 연쇄를 일으킨 플레이어 @returns {void} */
    function playComboSounds(player) {
        const spellPool = player.controller ? player.controller.soundPool : commonSoundPool;
        const combo = player.combo;
        playSound(getComboSoundUrl(commonSoundPool, 'puyoBurstCombo', combo), 'effects', '뿌요 폭발 효과음');
        const spellUrl = getComboSoundUrl(spellPool, 'spellCombo', combo)
            || (player.controller ? getComboSoundUrl(commonSoundPool, 'commonEnemySpellCombo', combo) : null);
        playSound(spellUrl, 'effects', '연쇄 주문 효과음');
    }

    /** 3연쇄 이상 공격 에너지가 상대 필드에 도착했을 때의 공통 효과음을 재생한다. @param {number|null|undefined} combo 연쇄 번호 @returns {void} */
    function playComboSpellEffect(combo) {
        if (!Number.isFinite(combo) || combo < 3) return;
        const index = Math.max(3, Math.min(6, Math.floor(combo)));
        playSound(commonSoundPool?.[`combo${index}SpellEffect`], 'effects', `${index}연쇄 공격 도착 효과음`);
    }

    /**
     * 초기화 전 stringTable에 새 언어의 번역 문구를 추가하거나 기존 항목을 갱신한다.
     * @param {string} locale BCP 47 언어 코드 (예: en, ja-JP)
     * @param {Record<string, string>} entries 한국어 원문 키와 번역문으로 구성된 객체
     * @returns {void}
     */
    function registerLanguage(locale, entries) {
        // 초기화 뒤에는 화면 문구의 일관성을 보장하기 위해 언어 등록을 막는다.
        if (initialized) throw new Error('언어 등록은 initialize 호출 전에 해야 합니다.');
        // 로케일 코드와 번역 항목이 올바른 형태인지 먼저 검증한다.
        if (typeof locale !== 'string' || !locale || !entries || typeof entries !== 'object' || Array.isArray(entries)) {
            throw new TypeError('locale과 번역 문구 객체가 필요합니다.');
        }
        stringTable[locale] = { ...(stringTable[locale] || {}), ...entries };
    }

    /**
     * 초기화 전에 사용자 정의 예고뿌요 클래스를 등록한다.
     * 클래스는 WarningPuyo를 상속하고, 양의 정수 static unitCount 및 해당 값과 같은 인스턴스 unitCount,
     * 비어 있지 않은 type, 그리고 자체 draw 메소드를 제공해야 한다. 등록 뒤에는 단위가 큰 순서로 자동 정렬된다.
     * @param {new () => WarningPuyo} WarningPuyoType 등록할 예고뿌요 클래스
     * @returns {void}
     */
    function registerWarningPuyo(WarningPuyoType) {
        if (initialized) throw new Error('예고뿌요 등록은 initialize 호출 전에 해야 합니다.');
        if (typeof WarningPuyoType !== 'function' || !(WarningPuyoType.prototype instanceof WarningPuyo)) {
            throw new TypeError('WarningPuyo를 상속한 예고뿌요 클래스가 필요합니다.');
        }
        if (!Number.isInteger(WarningPuyoType.unitCount) || WarningPuyoType.unitCount <= 0) {
            throw new RangeError('예고뿌요 클래스의 static unitCount는 양의 정수여야 합니다.');
        }
        let warningPuyo;
        try {
            warningPuyo = new WarningPuyoType();
        } catch (error) {
            throw new TypeError('예고뿌요 클래스의 인스턴스를 만들 수 없습니다.', { cause: error });
        }
        if (warningPuyo.unitCount !== WarningPuyoType.unitCount || typeof warningPuyo.type !== 'string' || !warningPuyo.type) {
            throw new TypeError('예고뿌요의 unitCount와 비어 있지 않은 type을 올바르게 설정해야 합니다.');
        }
        if (WarningPuyoType.prototype.draw === WarningPuyo.prototype.draw) {
            throw new TypeError('예고뿌요 클래스는 draw 메소드를 구현해야 합니다.');
        }
        if (WARNING_PUYO_CLASSES.includes(WarningPuyoType)) throw new Error('이미 등록된 예고뿌요 클래스입니다.');
        WARNING_PUYO_CLASSES.push(WarningPuyoType);
        WARNING_PUYO_CLASSES.sort((left, right) => right.unitCount - left.unitCount);
    }

    /**
     * 색 뿌요 하나를 무작위로 선택한다.
     * @returns {string} 뿌요 색상 이름
     */
    function randomColor(colors = COLORS) {
        return colors[Math.floor(randomFloat() * colors.length)];
    }

    /**
     * 플레이어 한 명의 보드와 진행 상태를 보관한다.
     */
    class PlayerState {
        /**
         * @param {string} name 화면에 표시할 이름
         * @param {number} fieldX 필드의 왼쪽 X 좌표
       * @param {Enemy|null} controller 자동 조작 컨트롤러
       * @param {string[]} colors 이 플레이어에게 제공할 색 뿌요 목록
         */
        constructor(name, fieldX, controller = null, colors = COLORS) {
            this.name = name;
            this.fieldX = fieldX;
            this.controller = controller;
            this.colors = colors;
            /** 피버가 아닐 때 사용하는 일반 플레이 영역이다. @type {(string|null)[][]} */
            this.normalBoard = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
            this.point = 0;
            this.attack = 0;
            /** 피버가 아닐 때 사용하는 일반 피해다. @type {number} */
            this.normalDamage = 0;
            this.combo = 0;
            this.phase = 'control';
            this.active = null;
            this.fallTimer = 0;
            this.phaseTimer = 0;
            this.gravityAnimation = null;
            this.gravityNextPhase = 'explode';
            this.effects = null;
            this.comboPopups = [];
            this.nextPairs = [];
            this.pairQueuePosition = 0;
            // 이 플레이어가 실제로 필드에 고정한 뿌요 쌍의 누적 횟수
            this.placedPairCount = 0;
            this.aiTarget = 5;
            this.aiRotation = 0;
            this.aiFastDown = false;
            this.aiDecisionElapsed = 0;
            this.aiSimulations = [];
            this.hasPlacedPuyoSinceAllClear = false;
            this.allClearEffectElapsed = 0;
            this.pendingAllClearDamage = 0;
            /** 실제 방해뿌요 낙하가 일어난 누적 횟수다. 피버 턴 정산 대기에 사용한다. @type {number} */
            this.garbageDropCount = 0;
            // 실제 수치는 먼저 차감하되, 예고뿌요 표시는 에너지 도착까지 유지한다.
            this.warningReductionDelay = 0;
            // 연쇄가 끝나기 전까지 상대에게 보이지 않아야 하는 누적 공격의 정수 부분이다.
            this.outgoingWarningDelay = 0;
            // 상대 필드에 에너지 도착으로 이미 알려진 정수 ATTACK이다.
            this.announcedAttack = 0;
            /** 현재 announcedAttack을 표시 중인 에너지다. 예고 취소 시 다른 에너지의 표시를 지우지 않도록 식별한다. @type {object|null} */
            this.announcedAttackEnergy = null;
            this.lastAttackTransfer = null;
            this.lastAttackEnergySource = null;
            this.receivesPuyos = true;
            this.allClearEnabled = true;
            this.clearsGarbage = false;
            /** 피버 룰에서만 사용하는 플레이어별 피버 상태다. @type {object|null} */
            this.fever = null;
        }

        /** 현재 일반 또는 피버 플레이 영역을 반환한다. @returns {(string|null)[][]} 활성 플레이 영역 */
        get board() {
            return this.fever?.active ? this.fever.field : this.normalBoard;
        }

        /** 현재 일반 또는 피버 플레이 영역을 교체한다. @param {(string|null)[][]} value 새 플레이 영역 */
        set board(value) {
            if (this.fever?.active) this.fever.field = value;
            else this.normalBoard = value;
        }

        /** 현재 일반 또는 피버 상황에 적용되는 피해를 반환한다. @returns {number} 활성 피해 값 */
        get damage() {
            return this.fever?.active ? this.fever.damage : this.normalDamage;
        }

        /** 현재 일반 또는 피버 상황에 적용되는 피해를 갱신한다. @param {number} value 새 피해 값 */
        set damage(value) {
            if (this.fever?.active) this.fever.damage = value;
            else this.normalDamage = value;
        }

        /**
         * 현재 보드에 지정한 뿌요를 놓았을 때의 예상 공격 수치를 계산한다.
         * @param {string[]} colors 배치할 두 뿌요의 색상
         * @param {{x:number, y:number}[]} positions 두 뿌요의 보드 좌표
         * @returns {number} 연쇄와 인접 방해뿌요 제거까지 반영한 예상 ATTACK 값
         */
        estimateAttack(colors, positions) {
            return estimateAttack(this.board, colors, positions);
        }
        
        /**
         * 현재 보드에 지정한 뿌요를 놓았을 때의 예상 연쇄 수를 계산한다.
         * @param {string[]} colors 배치할 두 뿌요의 색상
         * @param {{x:number, y:number}[]} positions 두 뿌요의 보드 좌표
         * @returns {number} 인접 방해뿌요 제거까지 반영한 예상 연쇄 수
         */
        estimateCombo(colors, positions) {
            return estimateCombo(this.board, colors, positions);
        }
    }

    /**
     * 적 인스턴스의 선택 화면 표시 설정을 등록 항목으로 만든다.
     * @param {()=>Enemy} createController 새 적 인스턴스 생성 함수
     * @returns {{createController:()=>Enemy, className:string, classType:string, sortPriority:number, hidden:boolean, notAvail:boolean}} 적 등록 항목
     */
    function createOpponentEntry(createController) {
        const controller = createController();
        const classType = controller.getClassType();
        return {
            createController: () => {
                const enemy = createController();
                const soundPool = enemySoundPools.get(classType);
                if (soundPool) enemy.soundPool = soundPool;
                return enemy;
            },
            className: controller.constructor.name,
            classType,
            sortPriority: controller.sortPriority,
            hidden: controller.hidden === true,
            notAvail: controller.notAvail === true
        };
    }

    /**
     * 적 선택 화면에 표시할 순서로 적 목록을 정렬한다.
     * @returns {void}
     */
    function sortOpponents() {
        OPPONENTS.sort((left, right) => left.sortPriority - right.sortPriority);
    }

    /**
     * 숨김 처리되지 않아 적 선택 화면에 표시할 적 목록을 반환한다.
        * @returns {{createController:()=>Enemy, className:string, sortPriority:number, hidden:boolean, notAvail:boolean}[]} 표시할 적 목록
     */
    function getVisibleOpponents() {
        return OPPONENTS.filter((opponent) => !opponent.hidden);
    }

    /** 성공한 AI API 테스트 뒤 현재 접속에 한해 솔로몬을 적 목록에 표시한다. @returns {void} */
    function unlockSolomonForSession() {
        solomonSessionUnlocked = true;
        const solomon = OPPONENTS.find((opponent) => opponent.classType === 'Solomon');
        if (solomon) solomon.hidden = false;
    }

    /**
     * 이전 유효 적을 클리어해 현재 잠금이 해제된 적인지 판별한다.
     * @param {{className:string, hidden:boolean, notAvail:boolean}} opponent 판별할 적
     * @returns {boolean} 선택 가능 여부
     */
    function isOpponentUnlocked(opponent) {
        // 솔로몬은 저장 진행도와 무관한 세션 전용 적이므로 기존 적의 순차 해금 조건에 끼워 넣지 않는다.
        if (opponent.classType === 'Solomon') return solomonSessionUnlocked;
        const progressionOpponents = OPPONENTS.filter((entry) => !entry.hidden && !entry.notAvail && entry.classType !== 'Solomon');
        const index = progressionOpponents.indexOf(opponent);
        if (index <= 0) return index === 0;
        const difficultyKey = getSelectedDifficulty().key;
        const progressStore = opponentMenuRule === 'fever' ? store.feverClearListByDifficulty : store.clearListByDifficulty;
        const clearList = progressStore?.[difficultyKey] || [];
        return clearList.includes(progressionOpponents[index - 1].className);
    }

    /**
     * 현재 선택할 수 있는 적 목록을 반환한다.
     * @returns {{createController:()=>Enemy, className:string, sortPriority:number, hidden:boolean, notAvail:boolean}[]} 선택할 수 있는 적 목록
     */
    function getSelectableOpponents() {
        return getVisibleOpponents().filter((opponent) => !opponent.notAvail && isOpponentUnlocked(opponent));
    }

    /**
     * 현재 선택값이 선택 가능한 적을 가리키도록 보정한다.
     * @returns {boolean} 선택 가능한 적 존재 여부
     */
    function ensureSelectedOpponent() {
        const selectable = getSelectableOpponents();
        if (!selectable.length) return false;
        if (!selectable.includes(OPPONENTS[selectedOpponent])) selectedOpponent = OPPONENTS.indexOf(selectable[0]);
        return true;
    }

    /**
     * 선택 가능한 적 중 현재 적의 이전 또는 다음 적을 반환한다.
     * @param {number} direction 이전 -1 또는 다음 1
     * @returns {{createController:()=>Enemy, className:string, classType:string, sortPriority:number, hidden:boolean, notAvail:boolean}|null} 이동 대상 적
     */
    function getRelativeSelectableOpponent(direction) {
        const selectable = getSelectableOpponents();
        const currentIndex = selectable.indexOf(OPPONENTS[selectedOpponent]);
        if (currentIndex < 0) return null;
        return selectable[currentIndex + (direction < 0 ? -1 : 1)] || null;
    }

    /**
     * 선택 불가 적을 건너뛰어 다음 또는 이전 적을 선택한다.
     * @param {number} direction 이전 -1 또는 다음 1
     * @returns {boolean} 적 이동 여부
     */
    function selectRelativeOpponent(direction) {
        const target = getRelativeSelectableOpponent(direction);
        if (!target) return false;
        selectedOpponent = OPPONENTS.indexOf(target);
        return true;
    }

    /**
     * 외부 스크립트에서 새 적을 등록한다.
   * @param {{createController:()=>Enemy}} opponent 등록할 적 정보
     * @returns {void}
     */
    function registerOpponent(opponent) {
        // 등록 정보에 컨트롤러 생성 함수가 있는지 확인한다.
        if (!opponent || typeof opponent.createController !== 'function') {
            throw new TypeError('opponent에는 createController 함수가 필요합니다.');
        }
        const controller = opponent.createController();
        // 확장 컨트롤러가 엔진의 Enemy 계약을 따르는지 확인한다.
        if (!(controller instanceof Enemy)) {
            throw new TypeError('createController는 Enemy 인스턴스를 반환해야 합니다.');
        }
        // 선택 화면에 표시할 적 이름이 유효한지 확인한다.
        if (typeof controller.getName() !== 'string' || !controller.getName()) {
            throw new TypeError('Enemy의 getName은 비어 있지 않은 문자열을 반환해야 합니다.');
        }
        OPPONENTS.push(createOpponentEntry(opponent.createController));
        sortOpponents();
        ensureSelectedOpponent();
    }

    /** 플레이어 한 명의 피버 룰 상태를 만든다. @returns {object} 초기 피버 상태 */
    function createFeverRuleState() {
        return {
            active: false,
            gauge: FEVER_LIGHT_STARTS,
            nextTime: FEVER_INITIAL_TIME,
            targetCombo: FEVER_INITIAL_TARGET_COMBO,
            leftTime: 0,
            field: Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null)),
            damage: 0,
            turn: 0,
            pendingCombo: 0,
            pendingAllClear: false,
            expiredPlacement: false,
            selectedStageTarget: null,
            stageSuppliedPair: [],
            pendingActivation: false,
            deferGarbage: false,
            pendingAllClearStage: false
        };
    }

    /**
     * 대전, 연습, 피버 룰 또는 연속 피버 상태를 초기화한다.
     * @param {boolean} practice 연습 모드 여부
     * @param {boolean} continuousFever 연속 피버 모드 여부
     * @param {boolean} feverRule 피버 룰 대전 여부
     * @returns {void}
     */
    function startGame(practice = false, continuousFever = false, feverRule = false) {
        const soloMode = practice || continuousFever;
        if (!soloMode && !ensureSelectedOpponent()) return;
        playMenuSelectSound();
        resetVirtualControllerInput();
        const opponent = soloMode ? { createController: () => new PracticeEnemy() } : OPPONENTS[selectedOpponent];
        const controller = opponent.createController();
        const difficulty = selectedDifficulty;
        const colors = DIFFICULTIES[difficulty].colors;
        const pairQueue = Array.from({ length: INITIAL_PAIR_QUEUE_LENGTH }, () => createRandomPair(colors));
        // 연속 피버는 전용 스테이지에서 시작하므로 싹쓸이 디버그 고정 지급 대상에서 제외한다.
        if (DEBUG_CLEAR_RULE_MODE && !continuousFever) {
            const debugColor = randomColor(colors);
            pairQueue[0] = [debugColor, debugColor];
            pairQueue[1] = [debugColor, debugColor];
        }
        const practicePlayer = new PlayerState(controller.getName(), FIELD_RIGHT, controller, colors);
        const players = [new PlayerState(getPlayerName(), FIELD_LEFT, null, colors), practicePlayer];
        if (feverRule) players.forEach((player) => { player.fever = createFeverRuleState(); });
        // 연습과 연속 피버의 상대는 공격만 받아 방해뿌요 연출을 보여주고 일반 뿌요는 생성하지 않는다.
        if (soloMode) {
            practicePlayer.receivesPuyos = false;
            practicePlayer.allClearEnabled = false;
            practicePlayer.clearsGarbage = true;
            practicePlayer.nextPairs = [];
            practicePlayer.phase = 'idle';
        }
        game = {
            running: true,
            paused: false,
            winner: null,
            ending: null,
            countdown: 3000,
            countdownStartsGame: true,
            elapsed: 0,
            marginRate: MARGIN_RATE_SCHEDULE[0].rate,
            practice: soloMode,
            continuousFever,
            feverRule,
            fever: continuousFever ? {
                targetCombo: CONTINUOUS_FEVER_INITIAL_TARGET_COMBO,
                leftTime: CONTINUOUS_FEVER_INITIAL_TIME,
                turn: 0,
                pendingCombo: 0,
                pendingAllClear: false,
                expiredPlacement: false,
                selectedStageTarget: null,
                stageSuppliedPair: []
            } : null,
            difficulty,
            aiDifficulty: selectedAiDifficulty,
            /** 결과 화면에서 적 선택 메뉴를 복원할 때 사용할 적 목록 순번이다. 단독 모드에서는 없다. */
            opponentIndex: soloMode ? null : selectedOpponent,
            themeController: controller,
            pairQueueColors: colors,
            pairQueue,
            energyTransfers: [],
            players
        };
        players.filter((player) => player.receivesPuyos).forEach(updateNextPairs);
        syncBackgroundMusic();
    }

    /** 연속 피버 모드를 선택된 3색·4색·5색, 목표 5연쇄, 60초 상태로 시작한다. @returns {void} */
    function startContinuousFeverGame() {
        startGame(false, true);
    }

    /** 현재 저장된 클리어 정보에 따라 선택할 수 있는 퍼즐뿌요 스테이지 수를 반환한다. @returns {number} 열린 스테이지 수 */
    function getOpenedPuzzleStageCount() {
        const furthestClear = store.puzzleClearStages.reduce((maximum, index) => Math.max(maximum, index), -1);
        const openedCount = Math.min(PUZZLE_STAGES.length, Math.max(2, furthestClear + 3));
        PUZZLE_STAGES.forEach((stage, index) => { stage.opened = index < openedCount; });
        return openedCount;
    }

    /** 퍼즐뿌요 스테이지의 클리어 조건 문구를 현재 언어로 반환한다. @param {PuzzlePuyoStage} stage 대상 스테이지 @returns {string} 조건 문구 */
    function getPuzzleConditionText(stage) {
        if (stage.winConditionType === 'clear') return translate('싹쓸이 해봐');
        if (stage.winConditionType === 'multiple') return translate('한 번에 %1개 뿌요를 터뜨려봐', stage.winConditionValue);
        if (stage.winConditionType === 'attack') return translate('방해뿌요 %1개를 발생 시켜봐', stage.winConditionValue);
        return translate('%1 연쇄 해봐', stage.winConditionValue);
    }

    /** 퍼즐뿌요 스테이지 선택 화면을 열고 지정한 열린 스테이지에 포커스를 둔다. @param {number} [preferredFocusIndex=0] 우선 포커스할 스테이지 순번 @returns {void} */
    function openPuzzleStageSelection(preferredFocusIndex = 0) {
        loadStore();
        const openedCount = getOpenedPuzzleStageCount();
        puzzleStageFocus = Math.max(0, Math.min(openedCount - 1, preferredFocusIndex));
        puzzleStageLastClickedIndex = null;
        puzzleStageScrollOffset = 0;
        scrollPuzzleStageFocusIntoView();
        menuScreen = 'puzzleStage';
    }

    /** 현재 포커스된 퍼즐뿌요 스테이지를 시작한다. @returns {void} */
    function startSelectedPuzzleStage() {
        const openedCount = getOpenedPuzzleStageCount();
        if (puzzleStageFocus < 0 || puzzleStageFocus >= openedCount) return;
        const stage = PUZZLE_STAGES[puzzleStageFocus];
        if (!(stage instanceof PuzzlePuyoStage)) return;
        playMenuSelectSound();
        resetVirtualControllerInput();
        const colors = [...COLORS];
        const controller = new PracticeEnemy();
        const player = new PlayerState(getPlayerName(), FIELD_LEFT, null, colors);
        const target = new PlayerState(controller.getName(), FIELD_RIGHT, controller, colors);
        target.receivesPuyos = false;
        target.allClearEnabled = false;
        target.clearsGarbage = true;
        target.nextPairs = [];
        target.phase = 'idle';
        (stage.stageData?.puyos || []).forEach((puyo) => {
            if (Number.isInteger(puyo?.x) && Number.isInteger(puyo?.y) && puyo.x >= 0 && puyo.x < COLUMNS && puyo.y >= 0 && puyo.y < ROWS && (COLORS.includes(puyo.color) || puyo.color === 'garbage')) {
                player.board[puyo.y][puyo.x] = puyo.color;
            }
        });
        const pairQueue = stage.suppliedNextPuyos.map((pair) => [...pair]);
        game = {
            running: true, paused: false, winner: null, ending: null,
            countdown: 3000, countdownStartsGame: true, elapsed: 0, marginRate: MARGIN_RATE_SCHEDULE[0].rate,
            practice: true, continuousFever: false, feverRule: false, fever: null,
            puzzle: {
                stage,
                stageIndex: puzzleStageFocus,
                // 클리어 전 이미 열려 있던 다음 스테이지가 있을 때만 그쪽으로 이동한다.
                // 마지막 선택 가능 스테이지를 깨면 새로 열린 항목 대신 현재 스테이지에 둔다.
                returnFocusIndex: puzzleStageFocus < openedCount - 1 ? puzzleStageFocus + 1 : puzzleStageFocus,
                turn: 1, pendingCombo: 0, pendingMaxExplosion: 0, pendingAllClear: false, pendingWarningAmount: 0
            },
            difficulty: DIFFICULTIES.length - 1, aiDifficulty: selectedAiDifficulty, themeController: controller,
            pairQueueColors: colors, pairQueue, energyTransfers: [], players: [player, target]
        };
        updateNextPairs(player);
        syncBackgroundMusic();
    }

    /**
     * 공통 대기열에 넣을 무작위 뿌요 한 쌍을 만든다.
     * @param {string[]} colors 제공할 색상 목록
     * @returns {string[]} 아래와 위 뿌요 색상
     */
    function createRandomPair(colors) {
        return [randomColor(colors), randomColor(colors)];
    }

    /**
     * 지정 순번까지 공통 뿌요 쌍 대기열을 확장한다.
     * @param {number} requiredPosition 필요한 마지막 대기열 순번
     * @returns {void}
     */
    function ensurePairQueue(requiredPosition) {
        while (game.pairQueue.length <= requiredPosition) game.pairQueue.push(createRandomPair(game.pairQueueColors));
    }

    /**
     * 플레이어의 현재 대기열 순번 기준으로 다음 뿌요 쌍 표시를 갱신한다. 단독 모드에서는 중앙 영역 전체를 써서 네 쌍을 표시한다.
     * @param {PlayerState} player 표시를 갱신할 플레이어
     * @returns {void}
     */
    function updateNextPairs(player) {
        const nextPairCount = game?.puzzle || game?.continuousFever || (game?.practice && !game?.tutorial) ? 4 : 2;
        ensurePairQueue(player.pairQueuePosition + nextPairCount - 1);
        player.nextPairs = game.pairQueue
            .slice(player.pairQueuePosition, player.pairQueuePosition + nextPairCount)
            .map((pair) => [...pair]);
    }

    /**
     * 플레이어의 현재 순번에 해당하는 공통 대기열 뿌요 쌍을 지급한다.
     * @param {PlayerState} player 뿌요를 지급할 플레이어
     * @returns {string[]} 아래와 위 뿌요 색상
     */
    function takeNextPair(player) {
        ensurePairQueue(player.pairQueuePosition);
        const pair = [...game.pairQueue[player.pairQueuePosition]];
        player.pairQueuePosition += 1;
        updateNextPairs(player);
        return pair;
    }

    /** 플레이어가 다음에 바로 지급받을 뿌요 쌍을 복사해 반환한다. @param {PlayerState} player 대상 플레이어 @returns {string[]} 다음 뿌요 쌍 */
    function peekNextPair(player) {
        ensurePairQueue(player.pairQueuePosition);
        return [...game.pairQueue[player.pairQueuePosition]];
    }

    /** 배열 복사본을 randomFloat 기반 Fisher-Yates 방식으로 섞는다. @param {string[]} values 원본 배열 @returns {string[]} 섞인 복사본 */
    function shuffledCopy(values) {
        const result = [...values];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(randomFloat() * (index + 1));
            [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
        }
        return result;
    }

    /**
     * 피버 스테이지의 색상 선언과 실제 패턴·지급 색상이 일치하는지 확인한다.
     * @param {FeverStageState} stage 검사할 피버 스테이지
     * @returns {string|null} 잘못된 이유, 올바르면 null
     */
    function getFeverStageValidationError(stage) {
        if (!(stage instanceof FeverStageState)) return 'FeverStageState 인스턴스가 아닙니다.';
        if (!Array.isArray(stage.usingColors) || stage.usingColors.length === 0) return 'usingColors가 비어 있거나 배열이 아닙니다.';
        const invalidUsingColorIndex = stage.usingColors.findIndex((color) => !COLORS.includes(color));
        if (invalidUsingColorIndex >= 0) return `usingColors에 지원하지 않는 색상 "${stage.usingColors[invalidUsingColorIndex]}"이 있습니다.`;
        const usingColorSet = new Set(stage.usingColors);
        if (!stage.stageData || !Array.isArray(stage.stageData.puyos)) return 'stageData.puyos가 배열이 아닙니다.';
        const invalidPuyoIndex = stage.stageData.puyos.findIndex((puyo) => !puyo || typeof puyo.color !== 'string'
            || (puyo.color !== 'garbage' && !usingColorSet.has(puyo.color)));
        if (invalidPuyoIndex >= 0) {
            const invalidColor = stage.stageData.puyos[invalidPuyoIndex]?.color;
            return typeof invalidColor === 'string'
                ? `stageData에 usingColors에 없는 색상 "${invalidColor}"이 있습니다.`
                : `stageData.puyos[${invalidPuyoIndex}]의 색상 정보가 올바르지 않습니다.`;
        }
        if (!Array.isArray(stage.suppliedNextPuyos) || stage.suppliedNextPuyos.length !== 2) return 'suppliedNextPuyos에는 색상 두 개가 있어야 합니다.';
        const invalidSuppliedColorIndex = stage.suppliedNextPuyos.findIndex((color) => !usingColorSet.has(color));
        if (invalidSuppliedColorIndex >= 0) return `suppliedNextPuyos에 usingColors에 없는 색상 "${stage.suppliedNextPuyos[invalidSuppliedColorIndex]}"이 있습니다.`;
        return null;
    }

    /** 잘못된 피버 스테이지와 제외 이유를 개발자 콘솔에 출력한다. @param {FeverStageState} stage 잘못된 객체 @param {number} index 탑재 목록 순번 @param {string} reason 제외 이유 @returns {void} */
    function reportInvalidFeverStage(stage, index, reason) {
        console.error(`잘못된 FeverStageState 객체를 탑재 목록에서 제외했습니다. (index: ${index}, 이유: ${reason})`, stage);
    }

    /** 탑재된 피버 스테이지 전체를 한 번 검사하고 잘못된 객체를 목록에서 제거한다. @returns {void} */
    function validateLoadedFeverStages() {
        const invalidStages = [];
        FEVER_STAGES.forEach((stage, index) => {
            const reason = getFeverStageValidationError(stage);
            if (reason) invalidStages.push({ stage, index, reason });
        });
        invalidStages.forEach(({ stage, index, reason }) => reportInvalidFeverStage(stage, index, reason));
        for (let index = invalidStages.length - 1; index >= 0; index -= 1) FEVER_STAGES.splice(invalidStages[index].index, 1);
    }

    /** 첫 타이틀을 표시한 뒤 피버 스테이지 검사를 예약한다. 검사 전 입력은 완료 뒤 메인 메뉴 진입으로 이어진다. @returns {void} */
    function scheduleFeverStageValidation() {
        feverStageValidationComplete = false;
        if (feverStageValidationTimer !== null) window.clearTimeout(feverStageValidationTimer);
        feverStageValidationTimer = window.setTimeout(() => {
            feverStageValidationTimer = null;
            validateLoadedFeverStages();
            feverStageValidationComplete = true;
            if (pendingInitialTitleEntry && menuScreen === 'initialTitle') enterMainMenu();
        }, 0);
    }

    /** 피버 스테이지 검사가 끝난 뒤 등록되는 객체도 같은 규칙으로 한 번 검사해 추가한다. @param {FeverStageState} stage 등록할 객체 @returns {boolean} 등록 여부 */
    function addFeverStageState(stage) {
        if (feverStageValidationComplete) {
            const reason = getFeverStageValidationError(stage);
            if (reason) {
                reportInvalidFeverStage(stage, FEVER_STAGES.length, reason);
                return false;
            }
        }
        FEVER_STAGES.push(stage);
        return true;
    }

    /** 사용 가능한 색 수, 목표 연쇄, 다음 뿌요의 동색 여부가 일치하는 피버 스테이지를 무작위로 고른다. 색 수 필터는 목표 연쇄 필터보다 먼저 적용한다. @param {number} targetCombo 목표 연쇄 @param {string[]} nextPair 바로 지급할 뿌요 @param {string[]} availableColors 게임 색상 목록 @returns {FeverStageState} 선택된 피버 스테이지 */
    function selectContinuousFeverStage(targetCombo, nextPair, availableColors) {
        const nextPairIsSameColor = nextPair[0] === nextPair[1];
        const colorCandidates = FEVER_STAGES.filter((stage) => stage.usingColors.length <= availableColors.length);
        const candidates = colorCandidates.filter((stage) => stage.targetCombo === targetCombo
            && (stage.suppliedNextPuyos[0] === stage.suppliedNextPuyos[1]) === nextPairIsSameColor);
        if (!candidates.length) throw new Error(`사용 색상 수와 목표 ${targetCombo}연쇄, 다음 뿌요 구성에 맞는 피버 스테이지가 없습니다.`);
        return candidates[Math.floor(randomFloat() * candidates.length)];
    }

    /** 스테이지 원본 색을 실제 다음 뿌요 색에 맞춘 중복 없는 1:1 색상표로 만든다. @param {FeverStageState} stage 원본 스테이지 @param {string[]} nextPair 실제 다음 뿌요 @param {string[]} availableColors 게임 색상 목록 @returns {Map<string,string>} 원본색-변환색 대응표 */
    function createContinuousFeverColorMap(stage, nextPair, availableColors) {
        const colorMap = new Map();
        const usedTargets = new Set();
        const assign = (source, target) => {
            if (source === 'garbage') return;
            if (colorMap.has(source) && colorMap.get(source) !== target) throw new Error('피버 스테이지의 suppliedNextPuyos 색상 구성이 올바르지 않습니다.');
            if (!colorMap.has(source) && usedTargets.has(target)) throw new Error('피버 스테이지 색상은 중복 없이 1:1로 변환되어야 합니다.');
            colorMap.set(source, target);
            usedTargets.add(target);
        };
        const sourceColors = [...new Set([
            ...stage.suppliedNextPuyos,
            ...(stage.stageData.puyos || []).map((puyo) => puyo.color)
        ].filter((color) => color && color !== 'garbage'))];
        // 바로 지급할 뿌요는 원본 스테이지의 색상과 무관하게 현재 대기열의 뿌요와 같아야 한다.
        assign(stage.suppliedNextPuyos[0], nextPair[0]);
        assign(stage.suppliedNextPuyos[1], nextPair[1]);
        // 지급쌍에 사용되지 않은 색은 가능한 한 원본 패턴 색을 유지하고, 충돌하는 색만 남은 색상으로 1:1 치환한다.
        const remainingSources = sourceColors.filter((color) => !colorMap.has(color));
        remainingSources.filter((source) => availableColors.includes(source) && !usedTargets.has(source)).forEach((source) => assign(source, source));
        const remainingTargets = shuffledCopy(availableColors.filter((color) => !usedTargets.has(color)));
        remainingSources.filter((source) => !colorMap.has(source)).forEach((source) => {
            const target = remainingTargets.shift();
            if (!target) throw new Error('피버 스테이지의 색상을 변환할 게임 색상이 부족합니다.');
            assign(source, target);
        });
        return colorMap;
    }

    /** 연속 피버의 다음 스테이지를 배치한 직후 양쪽의 공격·피해 및 예고 상태를 초기화한다. @returns {void} */
    function resetContinuousFeverCombatState() {
        if (!game?.continuousFever) return;
        game.players.forEach((state) => {
            state.attack = 0;
            state.damage = 0;
            state.normalDamage = 0;
            state.warningReductionDelay = 0;
            state.outgoingWarningDelay = 0;
            state.announcedAttack = 0;
            state.announcedAttackEnergy = null;
            state.lastAttackTransfer = null;
            state.lastAttackEnergySource = null;
        });
    }

    /** 다음 뿌요에 맞춰 피버 스테이지를 숨김 영역에 복사·변환하고, 중력 연출 뒤 지정 플레이어의 조작 턴을 준비한다. @param {PlayerState} player 대상 플레이어 @param {object} feverState 갱신할 피버 상태 @param {number} targetCombo 스테이지 목표 연쇄 @param {boolean} countTurn 피버 턴 수 증가 여부 @returns {void} */
    function prepareFeverTurn(player, feverState, targetCombo = feverState.targetCombo, countTurn = true) {
        const nextPair = peekNextPair(player);
        const stage = selectContinuousFeverStage(targetCombo, nextPair, player.colors);
        const colorMap = createContinuousFeverColorMap(stage, nextPair, player.colors);
        const transformedSupplied = stage.suppliedNextPuyos.map((color) => colorMap.get(color));
        game.pairQueue[player.pairQueuePosition] = transformedSupplied;
        player.board = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
        (stage.stageData.puyos || []).forEach((puyo) => {
            const spawnY = puyo.y + FEVER_STAGE_SPAWN_Y_OFFSET;
            if (!Number.isInteger(puyo.x) || !Number.isInteger(puyo.y) || puyo.x < 0 || puyo.x >= COLUMNS || spawnY < 0 || spawnY >= ROWS) return;
            player.board[spawnY][puyo.x] = puyo.color === 'garbage' ? 'garbage' : colorMap.get(puyo.color);
        });
        // 연속 피버는 다음 stageData 배치가 새 턴의 경계다. 남아 있던 DAMAGE 예고를 이때 없앤다.
        resetContinuousFeverCombatState();
        player.active = null;
        player.combo = 0;
        player.phaseTimer = 0;
        player.gravityAnimation = null;
        player.effects = null;
        player.hasPlacedPuyoSinceAllClear = false;
        player.allClearEffectElapsed = 0;
        player.pendingAllClearDamage = 0;
        if (countTurn) feverState.turn += 1;
        feverState.pendingCombo = 0;
        feverState.pendingAllClear = false;
        feverState.expiredPlacement = false;
        feverState.selectedStageTarget = stage.targetCombo;
        feverState.stageSuppliedPair = [...transformedSupplied];
        updateNextPairs(player);
        // 패턴이 갑자기 완성된 상태로 나타나지 않도록 숨김 영역에서 실제 중력을 적용한다.
        startGravity(player, 'feverStageControl');
    }

    /** 연속 피버의 사용자 필드를 새 피버 턴으로 초기화한다. @returns {void} */
    function prepareContinuousFeverTurn() {
        if (!game?.continuousFever || !game.fever) return;
        prepareFeverTurn(game.players[0], game.fever);
    }

    /**
     * 카운트다운이 끝난 뒤 각 플레이어에게 첫 조작 뿌요를 제공한다.
     * @returns {void}
     */
    function beginGame() {
        if (game.continuousFever) {
            playSound(commonSoundPool?.feverEnter, 'effects', '연속 피버 진입 효과음');
            prepareContinuousFeverTurn();
        }
        else enterControl(game.players[0]);
        enterControl(game.players[1]);
    }

    /** 피버 룰의 상쇄가 발생했을 때 전등과 상대의 다음 피버 시간을 갱신한다. @param {PlayerState} player 상쇄한 플레이어 @param {PlayerState} opponent 상대 플레이어 @returns {void} */
    function registerFeverOffset(player, opponent) {
        if (!game?.feverRule || !player.fever || player.fever.active) return;
        const previousGauge = player.fever.gauge;
        player.fever.gauge = Math.min(FEVER_GAUGE_MAX, player.fever.gauge + 1);
        if (player.fever.gauge > previousGauge) playSound(commonSoundPool?.feverLightOn, 'effects', '피버 전등 점등 효과음');
        if (opponent.fever) opponent.fever.nextTime = Math.min(FEVER_MAX_TIME, opponent.fever.nextTime + 1);
        if (player.fever.gauge >= FEVER_GAUGE_MAX) player.fever.pendingActivation = true;
    }

    /** 일반 필드를 보관하고 플레이어를 피버 상황으로 전환한다. @param {PlayerState} player 대상 플레이어 @returns {void} */
    function activatePlayerFever(player) {
        const state = player.fever;
        if (!game?.feverRule || !state || state.active) return;
        // 일반 필드와 일반 DAMAGE는 PlayerState에 그대로 보존하고, 새 피버 전용 상태를 활성화한다.
        state.field = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
        state.damage = 0;
        state.active = true;
        playSound(commonSoundPool?.feverEnter, 'effects', '피버 진입 효과음');
        state.gauge = FEVER_LIGHT_STARTS;
        state.pendingActivation = false;
        state.leftTime = state.nextTime * 1000;
        state.nextTime = FEVER_INITIAL_TIME;
        state.deferGarbage = false;
        prepareFeverTurn(player, state);
    }

    /** 피버 전용 필드와 피해를 초기화하고 보존된 일반 필드로 돌아가 누적 피해를 합산한다. @param {PlayerState} player 대상 플레이어 @param {'A'|'B'} exitType 종료 유형 @returns {void} */
    function finishPlayerFever(player, exitType) {
        const state = player.fever;
        if (!state?.active) return;
        const feverDamage = state.damage;
        state.active = false;
        // active를 먼저 해제하면 damage 접근자가 다시 일반 DAMAGE를 가리킨다.
        player.damage += feverDamage;
        state.field = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
        state.damage = 0;
        state.gauge = FEVER_LIGHT_STARTS;
        state.leftTime = 0;
        state.pendingCombo = 0;
        state.pendingAllClear = false;
        state.expiredPlacement = false;
        state.selectedStageTarget = null;
        state.stageSuppliedPair = [];
        state.pendingActivation = false;
        state.pendingAllClearStage = false;
        // targetCombo와 nextTime은 다음 피버 발동에서 이어서 사용하므로 초기화하지 않는다.
        player.active = null;
        player.combo = 0;
        if (exitType === 'A' && Math.floor(player.damage) > 0) {
            player.phase = 'garbage';
            player.phaseTimer = 0;
            return;
        }
        state.deferGarbage = exitType === 'B' && Math.floor(player.damage) > 0;
        enterControl(player);
    }

    /**
     * 현재 뿌요 쌍의 모든 착지 가능 위치와 회전을 시뮬레이션한다.
     * 외부 적이 prepareTurn을 재정의했더라도 피버 룰의 공통 연쇄 전략이 후보를 다시 준비할 때 사용한다.
     * @param {PlayerState} player CPU 플레이어
     * @returns {void}
     */
    function prepareAiPlacementSimulations(player) {
        if (!player.active) {
            player.aiSimulations = [];
            return;
        }
        const simulations = [];
        for (let rotation = 0; rotation < 4; rotation += 1) {
            for (let x = 0; x < COLUMNS; x += 1) {
                const placement = findLandingPlacement(player, x, rotation);
                if (!placement) continue;
                const positions = activeCells(placement).map(({ x: cellX, y: cellY }) => ({ x: cellX, y: cellY }));
                simulations.push({
                    x,
                    rotation,
                    positions,
                    attack: player.estimateAttack(player.active.colors, positions),
                    combo: player.estimateCombo(player.active.colors, positions)
                });
            }
        }
        player.aiSimulations = simulations;
    }

    /** 솔로몬을 제외한 적이 피버 중이면 즉시 패배하지 않는 후보 가운데 예상 연쇄가 가장 큰 배치를 고른다. @param {PlayerState} player CPU 플레이어 @returns {object|null} 선택 후보 */
    function findBestFeverComboPlacement(player) {
        return player.aiSimulations.reduce((best, simulation) => {
            if (causesImmediateDefeat(player, simulation)) return best;
            if (!best || simulation.combo > best.combo || (simulation.combo === best.combo && simulation.attack > best.attack)) return simulation;
            return best;
        }, null);
    }

    /** 적의 새 조작 턴에 플레이어가 2연쇄 이상을 진행 중인지 판별한다. @param {PlayerState} player 조작 턴을 시작할 적 @returns {boolean} 즉시 공격 우선 여부 */
    function shouldCounterPlayerChain(player) {
        const opponent = game?.players[0];
        return Boolean(player === game?.players[1] && opponent && opponent.combo >= 2 && isResolutionPhase(opponent.phase));
    }

    /**
     * prepareTurn을 마친 컨트롤러에 피버 룰 공통 연쇄 전략과 기본 제공 적의 공통 우선순위를 적용한다.
     * 피버 공통 전략은 솔로몬을 제외한 외부 적에도 적용하며, 솔로몬의 대체 인공지능은 솔로몬 제외 정책을 유지한다.
     * @param {PlayerState} player CPU 플레이어
     * @param {Enemy} controller 결정에 사용할 컨트롤러
     * @param {boolean} appliesBundledEngineStrategy 기본 제공 적 공통 전략 적용 여부
     * @returns {void}
     */
    function applyPreparedControllerDecision(player, controller, appliesBundledEngineStrategy) {
        const appliesFeverComboStrategy = game?.feverRule && player.fever?.active && !(player.controller instanceof Solomon);
        if (appliesFeverComboStrategy) {
            // 외부 적이 기본 prepareTurn을 호출하지 않았더라도 피버에서는 엔진이 모든 후보를 직접 다시 계산한다.
            prepareAiPlacementSimulations(player);
            const feverPlacement = findBestFeverComboPlacement(player) || findBestAttackPlacement(player, player.active.x, null, true);
            player.aiTarget = feverPlacement.x;
            player.aiRotation = ((feverPlacement.rotation % 4) + 4) % 4;
        } else if (appliesBundledEngineStrategy && shouldCounterPlayerChain(player)) {
            const attackPlacement = findBestAttackPlacement(player, player.active.x, null, true);
            player.aiTarget = attackPlacement.x;
            player.aiRotation = ((attackPlacement.rotation % 4) + 4) % 4;
        } else {
            player.aiTarget = controller.chooseTarget(player);
            player.aiRotation = ((controller.chooseRotate(player) % 4) + 4) % 4;
        }
        if (!appliesBundledEngineStrategy && !appliesFeverComboStrategy) return;
        const selectedPlacement = player.aiSimulations.find((simulation) => simulation.x === player.aiTarget && simulation.rotation === player.aiRotation);
        if (selectedPlacement && causesImmediateDefeat(player, selectedPlacement)) {
            const safePlacement = findBestAttackPlacement(player, player.active.x, null, true);
            if (safePlacement.positions.length) {
                player.aiTarget = safePlacement.x;
                player.aiRotation = safePlacement.rotation;
            }
        }
    }

    /**
     * 조작 단계로 전환하고 다음 뿌요 한 쌍을 꺼낸다.
     * @param {PlayerState} player 전환할 플레이어
     * @returns {void}
     */
    function enterControl(player) {
        // 뿌요를 받지 않는 연습 상대는 대기 상태로 유지한다.
        if (!player.receivesPuyos) {
            player.active = null;
            player.phase = 'idle';
            return;
        }
        player.phase = 'control';
        player.fallTimer = 0;
        // 플레이 방법 시연은 새 뿌요를 지급할 때마다 빠른 하강 상태를 초기화한다.
        if (game?.tutorial && player === game.players[0]) player.tutorialFastDown = false;
        if (player === game?.players[0]) {
            horizontalHoldElapsed = 0;
            horizontalRepeatElapsed = 0;
        }
        player.active = { x: 2, y: ACTIVE_PUYO_SPAWN_Y, rotation: 0, colors: takeNextPair(player) };
        // CPU 플레이어면 이번 뿌요 쌍의 목표 위치와 회전을 미리 결정한다.
        if (player.controller) {
            player.controller.prepareTurn(player);
            // 피버 필드의 연쇄 최적화는 솔로몬을 제외한 모든 적에 적용하고,
            // 플레이어 연쇄 대응 같은 나머지 엔진 공통 특수 규칙은 기본 제공 적에만 적용한다.
            // findBestAttackPlacement가 즉시 패배 후보를 먼저 제외하므로 생존 조건만 이 우선순위보다 앞선다.
            const appliesBundledEngineStrategy = player.controller instanceof BundledEnemy && !(player.controller instanceof Solomon);
            applyPreparedControllerDecision(player, player.controller, appliesBundledEngineStrategy);
            // 기본 제공 적의 개별 쌓기 전략보다 즉시 패배 회피를 항상 우선한다. 피버 룰에서는
            // isDefeatBoard가 (2,11)과 (3,11)을 모두 검사하므로, 최종 x·회전 조합도 두 칸을
            // 포함한 실제 폭발·중력 결과로 재검증한 뒤 위험하면 안전한 후보로 교체한다.
            player.aiFastDown = false;
            player.aiDecisionElapsed = 0;
        }
    }

    /**
     * 회전값으로부터 현재 조작 중인 두 뿌요의 좌표를 구한다.
     * @param {{x:number, y:number, rotation:number, colors:string[]}} active 조작 중인 뿌요 쌍
     * @returns {{x:number, y:number, color:string}[]} 두 뿌요의 좌표와 색상
     */
    function activeCells(active) {
        const offsets = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        const offset = offsets[active.rotation];
        const baseY = Math.floor(active.y);
        return [
            { x: active.x, y: baseY, color: active.colors[0] },
            { x: active.x + offset[0], y: baseY + offset[1], color: active.colors[1] }
        ];
    }

    /** 실수 Y 좌표를 유지한 채 화면에 그릴 조작 중 뿌요의 위치를 반환한다. @param {{x:number,y:number,rotation:number,colors:string[]}} active 조작 중인 뿌요 쌍 @returns {{x:number,y:number,color:string}[]} 화면 표시 좌표 */
    function activeRenderCells(active) {
        const offsets = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        const offset = offsets[active.rotation];
        return [
            { x: active.x, y: active.y, color: active.colors[0] },
            { x: active.x + offset[0], y: active.y + offset[1], color: active.colors[1] }
        ];
    }

    /**
     * 후보 위치에 두 뿌요를 모두 놓을 수 있는지 검사한다.
     * @param {PlayerState} player 대상 플레이어
     * @param {{x:number, y:number, rotation:number, colors:string[]}} active 검사할 뿌요 쌍
     * @returns {boolean} 배치 가능 여부
     */
    function canPlace(player, active) {
        return activeCells(active).every((cell) => cell.x >= 0 && cell.x < COLUMNS && cell.y >= 0 && cell.y < ROWS && !player.board[cell.y][cell.x]);
    }

    /**
     * 지정한 회전과 X 좌표에서 뿌요 쌍이 실제로 착지할 위치를 가상으로 구한다.
     * @param {PlayerState} player 대상 플레이어
     * @param {number} x 회전축이 될 X 좌표
     * @param {number} rotation 목표 회전값
     * @returns {{x:number, y:number, rotation:number, colors:string[]}|null} 착지 상태 또는 불가능 시 null
     */
    function findLandingPlacement(player, x, rotation) {
        // 현재 조작 뿌요가 없으면 착지 위치를 계산할 수 없다.
        if (!player.active) return null;
        let placement = { ...player.active, x, rotation };
        // 시작 위치부터 배치할 수 없는 후보는 무효 처리한다.
        if (!canPlace(player, placement)) return null;
        // 한 칸씩 내리며 더 이상 내려갈 수 없는 실제 착지 지점을 찾는다.
        while (canPlace(player, { ...placement, y: placement.y - 1 })) {
            placement = { ...placement, y: placement.y - 1 };
        }
        return placement;
    }

    /**
     * 조작 중인 뿌요 쌍을 한 칸 이동한다.
     * @param {PlayerState} player 이동할 플레이어
     * @param {number} horizontal X축 이동량
     * @param {number} vertical Y축 이동량
     * @returns {boolean} 이동 성공 여부
     */
    function moveActive(player, horizontal, vertical) {
        // 조작할 뿌요가 없으면 이동 요청을 거절한다.
        if (!player.active) return false;
        const candidate = {
            ...player.active,
            x: player.active.x + horizontal,
            y: vertical ? player.active.y + vertical : player.active.y
        };
        // 이동 목적지가 경계 또는 다른 뿌요와 겹치면 이동하지 않는다.
        if (!canPlace(player, candidate)) return false;
        player.active = candidate;
        return true;
    }

    /**
     * 뿌요 쌍을 회전하며, 한쪽만 막혔을 때 반대쪽으로 밀어 넣는다.
     * @param {PlayerState} player 회전할 플레이어
     * @param {number} direction 좌회전 -1 또는 우회전 1
     * @returns {boolean} 회전 성공 여부
     */
    function rotateActive(player, direction) {
        // 조작할 뿌요가 없으면 회전 요청을 거절한다.
        if (!player.active) return false;
        const candidate = { ...player.active, rotation: (player.active.rotation + direction + 4) % 4 };
        // 기본 회전 위치가 비어 있으면 그대로 회전한다.
        if (canPlace(player, candidate)) {
            player.active = candidate;
            playSound(commonSoundPool?.puyoRotate, 'effects', '뿌요 회전 효과음');
            return true;
        }
        const horizontalKick = candidate.rotation === 1 ? -1 : candidate.rotation === 3 ? 1 : 0;
        const kicked = { ...candidate, x: candidate.x + horizontalKick };
        // 벽에 막힌 회전은 수평 밀어넣기로 가능한지 검사한다.
        if (horizontalKick && canPlace(player, kicked)) {
            player.active = kicked;
            playSound(commonSoundPool?.puyoRotate, 'effects', '뿌요 회전 효과음');
            return true;
        }
        const flipped = { ...player.active, rotation: (player.active.rotation + direction * 2 + 4) % 4 };
        // 마지막으로 반대편 회전 위치를 시도한다.
        if (canPlace(player, flipped)) {
            player.active = flipped;
            playSound(commonSoundPool?.puyoRotate, 'effects', '뿌요 회전 효과음');
            return true;
        }
        return false;
    }

    /**
     * 조작 중인 뿌요를 보드에 고정하고 중력 단계로 넘긴다.
     * @param {PlayerState} player 고정할 플레이어
     * @returns {void}
     */
    function lockActive(player) {
        // 비동기 판단을 기다리는 적은 뿌요가 실제 바닥이나 다른 뿌요에 닿는 즉시 요청을 취소한다.
        player.controller?.cancelPendingRequest?.(player, 'contact');
        // 피버 룰의 방해뿌요 지연은 배치마다 새로 판정한다. 이번 배치가 폭발에 성공하면
        // resolveExplosions에서 다시 true가 되어 다음 컨트롤까지 DAMAGE 낙하를 미룬다.
        if (game?.feverRule && player.fever) player.fever.deferGarbage = false;
        if (game?.continuousFever && player === game.players[0] && game.fever) {
            game.fever.pendingCombo = 0;
            game.fever.pendingAllClear = false;
            game.fever.expiredPlacement = game.fever.leftTime <= 0;
        }
        if (game?.feverRule && player.fever?.active) {
            player.fever.pendingCombo = 0;
            player.fever.pendingAllClear = false;
            player.fever.expiredPlacement = player.fever.leftTime <= 0;
        }
        if (game?.puzzle && player === game.players[0]) {
            game.puzzle.pendingCombo = 0;
            game.puzzle.pendingMaxExplosion = 0;
            game.puzzle.pendingAllClear = false;
            game.puzzle.pendingWarningAmount = 0;
        }
        // 숨김 행을 포함해 유효한 필드 좌표에만 뿌요를 고정한다.
        const lockedPuyos = activeCells(player.active).filter((cell) => cell.y >= 0 && cell.y < ROWS);
        lockedPuyos.forEach((cell) => {
            if (cell.y >= 0 && cell.y < ROWS) player.board[cell.y][cell.x] = cell.color;
        });
        playGravityLandingSounds(lockedPuyos);
        player.placedPairCount += 1;
        player.hasPlacedPuyoSinceAllClear = true;
        player.active = null;
        // AI가 제안한 위치는 이 뿌요 쌍이 고정되는 즉시 더 이상 유효하지 않다.
        if (game && player === game.players[0]) recommendedPoint = null;
        startGravity(player, 'explode');
    }

    /** 피버 전용·연속 피버 필드에 적용할 중력 애니메이션 속도 배율을 반환한다. @param {PlayerState} player 대상 플레이어 @returns {number} 속도 배율 */
    function getGravitySpeedMultiplier(player) {
        if (game?.continuousFever && player === game.players[0]) return FEVER_GRAVITY_SPEED_MULTIPLIER;
        if (game?.feverRule && player.fever?.active) return FEVER_GRAVITY_SPEED_MULTIPLIER;
        return 1;
    }

    /**
     * 모든 보드 뿌요의 낙하 목적지와 가속 애니메이션을 준비한다.
     * @param {PlayerState} player 중력을 적용할 플레이어
     * @param {string} nextPhase 낙하 완료 후 실행할 단계
     * @returns {void}
     */
    function startGravity(player, nextPhase) {
        const nextBoard = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
        const falling = [];
        // 각 열을 독립적으로 아래부터 다시 쌓아 중력 결과를 계산한다.
        for (let x = 0; x < COLUMNS; x += 1) {
            const stack = [];
            // 아래 행부터 기존 뿌요를 수집해 낙하 전 위치를 보관한다.
            for (let y = 0; y < ROWS; y += 1) {
                if (player.board[y]?.[x]) stack.push({ color: player.board[y][x], fromY: y });
            }
            // 수집한 뿌요를 빈칸 없이 아래쪽부터 다시 배치한다.
            for (let y = 0; y < ROWS; y += 1) {
                const puyo = stack[y];
                if (!puyo) continue;
                nextBoard[y][x] = puyo.color;
                if (puyo.fromY !== y) falling.push({ x, fromY: puyo.fromY, toY: y, color: puyo.color });
            }
        }
        player.board = nextBoard;
        player.gravityNextPhase = nextPhase;
        player.phase = 'gravity';
        player.phaseTimer = 0;
        const gravitySpeedMultiplier = getGravitySpeedMultiplier(player);
        player.gravityAnimation = falling.length ? {
            falling,
            elapsed: 0,
            duration: Math.max(...falling.map((puyo) => (210 + 790 * Math.sqrt((puyo.fromY - puyo.toY) / VISIBLE_ROWS)) / gravitySpeedMultiplier))
        } : null;
    }

    /**
     * 보드 복사본에서 상하좌우로 4개 이상 연결된 색 뿌요를 모두 찾는다.
     * @param {(string|null)[][]} board 탐색할 보드
     * @returns {number[][]} 폭발할 [x, y] 좌표 목록
     */
    function findExplosionsOnBoard(board) {
        return findExplosionGroupsOnBoard(board).flatMap((group) => group.cells);
    }

    /**
     * 보드 복사본에서 폭발하는 같은 색 뿌요 연결 그룹을 찾는다. 숨김 행은 중력 완료 전까지 인접 판정에서 제외한다.
     * @param {(string|null)[][]} board 탐색할 보드
     * @returns {{color:string, cells:number[][]}[]} 폭발할 색상과 [x, y] 좌표 그룹 목록
     */
    function findExplosionGroupsOnBoard(board) {
        const visited = new Set();
        const explosionGroups = [];
        // 화면에 보이는 셀만 시작점으로 삼는다. 숨김 행은 중력으로 내려온 다음 폭발 단계부터 참여한다.
        for (let y = 0; y < VISIBLE_ROWS; y += 1) for (let x = 0; x < COLUMNS; x += 1) {
            const color = board[y][x];
            const key = `${x},${y}`;
            // 빈칸, 방해뿌요, 이미 조사한 색 뿌요는 탐색 대상에서 제외한다.
            if (!COLORS.includes(color) || visited.has(key)) continue;
            const group = [];
            const queue = [[x, y]];
            visited.add(key);
            // 연결된 같은 색 뿌요를 깊이 우선으로 모두 모은다.
            while (queue.length) {
                const [currentX, currentY] = queue.pop();
                group.push([currentX, currentY]);
                DIRECTIONS.forEach(([deltaX, deltaY]) => {
                    const nx = currentX + deltaX;
                    const ny = currentY + deltaY;
                    const nextKey = `${nx},${ny}`;
                    if (nx >= 0 && nx < COLUMNS && ny >= 0 && ny < VISIBLE_ROWS && board[ny][nx] === color && !visited.has(nextKey)) {
                        visited.add(nextKey);
                        queue.push([nx, ny]);
                    }
                });
            }
            // 네 개 이상 연결된 그룹만 폭발 목록에 추가한다.
            if (group.length >= 4) explosionGroups.push({ color, cells: group });
        }
        return explosionGroups;
    }

    /** 연쇄 수에 맞는 점수 보너스를 구한다. @param {number} combo 현재 연쇄 수 @returns {number} 연쇄 보너스 */
    function getChainBonus(combo) {
        if (combo < CHAIN_BONUS.length) return CHAIN_BONUS[Math.max(0, combo)];
        return CHAIN_BONUS[CHAIN_BONUS.length - 1] * (combo - 18);
    }

    /** 한 폭발 단계에서 사라진 일반 뿌요 수에 맞는 점수 보너스를 구한다. @param {number} puyoCount 폭발한 일반 뿌요 수 @returns {number} 연결 보너스 */
    function getConnectionBonus(puyoCount) {
        return CONNECTION_BONUS[Math.min(Math.max(0, puyoCount), CONNECTION_BONUS.length - 1)];
    }

    /** 동시에 폭발한 색 수에 맞는 점수 보너스를 구한다. @param {number} colorCount 서로 다른 색 수 @returns {number} 색수 보너스 */
    function getColorBonus(colorCount) {
        if (colorCount < COLOR_BONUS.length) return COLOR_BONUS[Math.max(0, colorCount)];
        return COLOR_BONUS[COLOR_BONUS.length - 1] + colorCount - 5;
    }

    /**
     * 폭발한 색 뿌요에 인접한 방해뿌요의 제거·약화 결과를 계산한다.
     * 딱딱뿌요는 인접 폭발이 한 개면 일반 방해뿌요로 약화되고, 두 개 이상이면 즉시 파괴된다.
     * @param {(string|null)[][]} board 처리 전 보드
     * @param {number[][]} exploding 이번 단계에 폭발한 색 뿌요 좌표
     * @returns {{removed:Map<string,{x:number,y:number,color:string}>,degradedHardGarbage:{x:number,y:number}[],brokenHardGarbageCount:number}}
     */
    function getExplosionResolution(board, exploding) {
        const removed = new Map(exploding.map(([x, y]) => [`${x},${y}`, { x, y, color: board[y][x] }]));
        const hardGarbageHits = new Map();
        exploding.forEach(([x, y]) => DIRECTIONS.forEach(([deltaX, deltaY]) => {
            const nextX = x + deltaX;
            const nextY = y + deltaY;
            if (nextX < 0 || nextX >= COLUMNS || nextY < 0 || nextY >= ROWS) return;
            const color = board[nextY][nextX];
            const key = `${nextX},${nextY}`;
            if (color === 'garbage') removed.set(key, { x: nextX, y: nextY, color });
            else if (color === HARD_GARBAGE) hardGarbageHits.set(key, (hardGarbageHits.get(key) || 0) + 1);
        }));
        const degradedHardGarbage = [];
        let brokenHardGarbageCount = 0;
        hardGarbageHits.forEach((hitCount, key) => {
            const [x, y] = key.split(',').map(Number);
            if (hitCount >= 2) {
                removed.set(key, { x, y, color: HARD_GARBAGE });
                brokenHardGarbageCount += 1;
            } else {
                degradedHardGarbage.push({ x, y });
            }
        });
        return { removed, degradedHardGarbage, brokenHardGarbageCount };
    }

    /** 폭발 영향 계산 결과를 보드에 반영한다. @param {(string|null)[][]} board 대상 보드 @param {{removed:Map<string,{x:number,y:number,color:string}>,degradedHardGarbage:{x:number,y:number}[]}} resolution 폭발 영향 @returns {void} */
    function applyExplosionResolution(board, resolution) {
        resolution.degradedHardGarbage.forEach(({ x, y }) => { board[y][x] = 'garbage'; });
        resolution.removed.forEach(({ x, y }) => { board[y][x] = null; });
    }

    /**
     * 한 폭발 단계의 점수 증가량을 계산한다. 동시에 폭발한 일반 뿌요 수 전체로 연결 보너스를 계산하고,
     * 인접 방해뿌요는 점수용 뿌요 수에 포함하지 않는다.
     * @param {{color:string, cells:number[][]}[]} explosionGroups 이번 단계에 폭발한 색 뿌요 연결 그룹
     * @param {number} combo 현재 연쇄 수
     * @param {number} [brokenHardGarbageCount=0] 이번 단계에서 한 번에 파괴한 딱딱뿌요 수
     * @returns {number} 이번 폭발 단계의 점수 증가량
     */
    function calculateExplosionPoint(explosionGroups, combo, brokenHardGarbageCount = 0) {
        const puyoCount = explosionGroups.reduce((total, group) => total + group.cells.length, 0);
        const connectionBonus = getConnectionBonus(puyoCount);
        const colorBonus = getColorBonus(new Set(explosionGroups.map((group) => group.color)).size);
        const bonus = Math.max(1, getChainBonus(combo) + connectionBonus + colorBonus);
        const hardGarbageMultiplier = brokenHardGarbageCount * HARD_GARBAGE_SCORE_MULTIPLIER + 1;
        return puyoCount * hardGarbageMultiplier * bonus * 10;
    }

    /** 게임 경과 시간에 해당하는 마진 레이트를 구한다. @param {number} elapsed 게임 경과 시간(ms) @returns {number} 마진 레이트 */
    function getMarginRate(elapsed) {
        const elapsedSecond = Math.max(0, Math.floor(elapsed / 1000));
        let marginRate = MARGIN_RATE_SCHEDULE[0].rate;
        MARGIN_RATE_SCHEDULE.forEach((entry) => {
            if (elapsedSecond >= entry.startSecond) marginRate = entry.rate;
        });
        return marginRate;
    }

    /** 현재 게임 경과 시간을 반영해 마진 레이트를 갱신한다. @returns {void} */
    function refreshGameMarginRate() {
        if (game) game.marginRate = getMarginRate(game.elapsed);
    }

    /** 점수 증가량을 현재 마진 레이트와 ATTACK 배율로 변환한다. @param {number} point 점수 증가량 @returns {number} ATTACK 증가량 */
    function calculateExplosionAttack(point) {
        const marginRate = game?.marginRate ?? MARGIN_RATE_SCHEDULE[0].rate;
        return point / marginRate * EXPLOSION_REWARD_MULTIPLIER;
    }

    /** 화면용 점수를 소수점 없이 정수 문자열로 변환한다. @param {number} point 점수 @returns {string} 표시용 점수 */
    function formatIntegerPoint(point) {
        return String(Math.max(0, Math.floor(point)));
    }

    /** 게임 진행 중 화면용 점수를 9자리 이상으로 변환한다. @param {number} point 점수 @returns {string} 표시용 점수 */
    function formatPoint(point) {
        return formatIntegerPoint(point).padStart(SCORE_DISPLAY_DIGITS, '0');
    }

    /**
     * 보드의 모든 뿌요를 열별로 아래로 내린다.
     * @param {(string|null)[][]} board 중력을 적용할 보드
     * @returns {(string|null)[][]} 중력 적용 후의 새 보드
     */
    function collapseBoard(board) {
        const collapsed = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
        // 열마다 아래쪽 빈칸을 제거해 압축된 새 보드를 만든다.
        for (let x = 0; x < COLUMNS; x += 1) {
            let targetY = 0;
            for (let y = 0; y < ROWS; y += 1) {
                if (board[y][x]) {
                    collapsed[targetY][x] = board[y][x];
                    targetY += 1;
                }
            }
        }
        return collapsed;
    }

    /**
     * 가상 착지 뒤 폭발 탐지와 중력을 모두 처리한 최종 보드에서 패배 여부를 검사한다.
     * @param {PlayerState} player 자동 조작할 플레이어
     * @param {{positions:{x:number, y:number}[]}} simulation 가상 배치 후보
     * @returns {boolean} 이 후보를 두면 즉시 패배하는지 여부
     */
    function causesImmediateDefeat(player, simulation) {
        let simulatedBoard = player.board.map((row) => [...row]);
        simulation.positions.forEach(({ x, y }, index) => {
            simulatedBoard[y][x] = player.active.colors[index];
        });
        simulatedBoard = collapseBoard(simulatedBoard);
        // 실제 폭발 단계처럼 색 뿌요와 인접 방해뿌요를 제거하고 중력을 반복 적용한다.
        while (true) {
            const exploding = findExplosionsOnBoard(simulatedBoard);
            if (!exploding.length) return isDefeatBoard(simulatedBoard);
            applyExplosionResolution(simulatedBoard, getExplosionResolution(simulatedBoard, exploding));
            simulatedBoard = collapseBoard(simulatedBoard);
        }
    }

    /** 현재 규칙의 패배 칸에 뿌요가 있는지 확인한다. 피버 룰과 연속 피버는 (2, 11) 및 (3, 11)을 검사한다. @param {(string|null)[][]} board 검사할 필드 @returns {boolean} 패배 여부 */
    function isDefeatBoard(board) {
        return board[11][2] !== null || (usesSecondDefeatCell() && board[11][3] !== null);
    }

    /**
     * 뿌요 한 쌍을 가상 배치하고 폭발·중력을 모두 처리한 안정 상태의 보드를 만든다.
     * @param {(string|null)[][]} sourceBoard 배치 전 보드
     * @param {string[]} colors 배치할 두 뿌요 색상
     * @param {{x:number,y:number}[]} positions 두 뿌요의 착지 좌표
     * @returns {(string|null)[][]|null} 안정 상태 보드. 유효하지 않은 배치면 null
     */
    function simulatePlacementBoard(sourceBoard, colors, positions) {
        if (!Array.isArray(colors) || !Array.isArray(positions) || colors.length !== 2 || positions.length !== 2) return null;
        let board = sourceBoard.map((row) => [...row]);
        for (let index = 0; index < 2; index += 1) {
            const { x, y } = positions[index] || {};
            if (!COLORS.includes(colors[index]) || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= COLUMNS || y < 0 || y >= ROWS || board[y][x]) return null;
            board[y][x] = colors[index];
        }
        board = collapseBoard(board);
        while (true) {
            const exploding = findExplosionsOnBoard(board);
            if (!exploding.length) return board;
            applyExplosionResolution(board, getExplosionResolution(board, exploding));
            board = collapseBoard(board);
        }
    }

    /**
     * 가상 보드에서 특정 예고 뿌요 쌍으로 만들 수 있는 최고 연쇄·공격을 계산한다.
     * @param {(string|null)[][]} board 가상 보드
     * @param {string[]} colors 예고 뿌요 쌍
     * @returns {{combo:number,attack:number}} 최고 결과
     */
    function findBestPreviewResult(board, colors) {
        const virtualPlayer = { board, active: { x: 2, y: ACTIVE_PUYO_SPAWN_Y, rotation: 0, colors } };
        let best = { combo: 0, attack: 0 };
        for (let rotation = 0; rotation < 4; rotation += 1) {
            for (let x = 0; x < COLUMNS; x += 1) {
                const placement = findLandingPlacement(virtualPlayer, x, rotation);
                if (!placement) continue;
                const positions = activeCells(placement).map(({ x: cellX, y: cellY }) => ({ x: cellX, y: cellY }));
                const combo = estimateCombo(board, colors, positions);
                const attack = estimateAttack(board, colors, positions);
                if (combo > best.combo || (combo === best.combo && attack > best.attack)) best = { combo, attack };
            }
        }
        return best;
    }

    /** @param {(string|null)[][]} board 검사할 보드 @returns {boolean} 빈 보드 여부 */
    function isAllClearBoard(board) {
        return board.every((row) => row.every((cell) => cell === null));
    }

    /**
     * 모든 회전 배치 후보 중 예상 공격력이 가장 높은 배치를 고른다.
     * 지정 열의 후보가 즉시 패배하면 그 후보를 건너뛰어 차순위를 선택한다.
     * @param {PlayerState} player 자동 조작할 플레이어
     * @param {number} fallback 유효한 후보가 없을 때 사용할 열
     * @param {number|null} defeatCheckColumn 즉시 패배를 피할 X 좌표. null이면 검사하지 않는다.
     * @param {boolean} excludeAllImmediateDefeats 모든 즉시 패배 후보를 제외할지 여부
     * @returns {{x:number, rotation:number, positions:{x:number,y:number}[], attack:number, combo:number}} 목표 배치 후보
     */
    function findBestAttackPlacement(player, fallback, defeatCheckColumn = null, excludeAllImmediateDefeats = false) {
        let bestPlacement = {
            x: fallback,
            rotation: 0,
            positions: [],
            attack: -1,
            combo: 0
        };
        // 회전을 포함한 모든 실제 착지 후보를 비교한다. 공격력이 같으면 더 오른쪽 열을 선택한다.
        player.aiSimulations.forEach((simulation) => {
            // Y=2에 닿는 후보는 다른 조건보다 먼저 즉시 패배 여부를 확인해 배제한다.
            if (excludeAllImmediateDefeats && causesImmediateDefeat(player, simulation)) return;
            if (simulation.positions.some((position) => position.y === 2) && causesImmediateDefeat(player, simulation)) return;
            if (simulation.x === defeatCheckColumn && causesImmediateDefeat(player, simulation)) return;
            if (simulation.attack > bestPlacement.attack || (simulation.attack === bestPlacement.attack && simulation.x >= bestPlacement.x)) {
                bestPlacement = simulation;
            }
        });
        return bestPlacement;
    }

    /**
     * 기존 열 기반 AI와의 호환을 위해 최고 공격 후보의 X 좌표만 반환한다.
     * 새 AI는 회전 정보까지 포함하는 findBestAttackPlacement()를 사용해야 한다.
     * @param {PlayerState} player 자동 조작할 플레이어
     * @param {number} fallback 유효한 후보가 없을 때 사용할 열
     * @param {number|null} defeatCheckColumn 즉시 패배를 피할 X 좌표. null이면 검사하지 않는다.
     * @returns {number} 목표 X 좌표
     */
    function findBestAttackColumn(player, fallback, defeatCheckColumn = null) {
        return findBestAttackPlacement(player, fallback, defeatCheckColumn).x;
    }

    /**
     * 두 뿌요를 가상 배치하여 발생 가능한 ATTACK을 계산한다.
     * @param {(string|null)[][]} sourceBoard 배치 전 보드
     * @param {string[]} colors 배치할 두 뿌요 색상
     * @param {{x:number, y:number}[]} positions 배치할 두 뿌요 좌표
     * @returns {number} 연쇄 전체의 예상 ATTACK 값
     */
    function estimateAttack(sourceBoard, colors, positions) {
        // 두 색상과 두 좌표가 모두 제공되지 않으면 유효한 가상 배치가 아니다.
        if (!Array.isArray(colors) || !Array.isArray(positions) || colors.length !== 2 || positions.length !== 2) return 0;
        let board = sourceBoard.map((row) => [...row]);
        // 각 뿌요가 필드 안의 빈칸에 놓이는지 확인하며 복사 보드에 배치한다.
        for (let index = 0; index < 2; index += 1) {
            const { x, y } = positions[index] || {};
            if (!COLORS.includes(colors[index]) || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= COLUMNS || y < 0 || y >= ROWS || board[y][x]) return 0;
            board[y][x] = colors[index];
        }
        board = collapseBoard(board);
        let combo = 0;
        let attack = 0;
        // 폭발과 중력을 반복해 전체 연쇄의 공격력을 누적한다.
        while (true) {
            const explosionGroups = findExplosionGroupsOnBoard(board);
            if (!explosionGroups.length) return attack;
            const exploding = explosionGroups.flatMap((group) => group.cells);
            const resolution = getExplosionResolution(board, exploding);
            combo += 1;
            attack += calculateExplosionAttack(calculateExplosionPoint(explosionGroups, combo, resolution.brokenHardGarbageCount));
            applyExplosionResolution(board, resolution);
            board = collapseBoard(board);
        }
    }

    /**
     * 두 뿌요를 가상 배치하여 발생 가능한 연쇄 수를 계산한다.
     * @param {(string|null)[][]} sourceBoard 배치 전 보드
     * @param {string[]} colors 배치할 두 뿌요 색상
     * @param {{x:number, y:number}[]} positions 배치할 두 뿌요 좌표
     * @returns {number} 연쇄 전체의 예상 연쇄 수
     */
    function estimateCombo(sourceBoard, colors, positions) {
        // 두 색상과 두 좌표가 모두 제공되지 않으면 유효한 가상 배치가 아니다.
        if (!Array.isArray(colors) || !Array.isArray(positions) || colors.length !== 2 || positions.length !== 2) return 0;
        let board = sourceBoard.map((row) => [...row]);
        // 각 뿌요가 필드 안의 빈칸에 놓이는지 확인하며 복사 보드에 배치한다.
        for (let index = 0; index < 2; index += 1) {
            const { x, y } = positions[index] || {};
            if (!COLORS.includes(colors[index]) || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= COLUMNS || y < 0 || y >= ROWS || board[y][x]) return 0;
            board[y][x] = colors[index];
        }
        board = collapseBoard(board);
        let combo = 0;
        // 더 이상 폭발이 없을 때까지 연쇄 횟수를 센다.
        while (true) {
            const exploding = findExplosionsOnBoard(board);
            if (!exploding.length) return combo;
            combo += 1;
            applyExplosionResolution(board, getExplosionResolution(board, exploding));
            board = collapseBoard(board);
        }
    }

    /**
     * 폭발 점수와 공격을 계산하고 인접 방해뿌요까지 제거한다.
     * @param {PlayerState} player 공격한 플레이어
     * @param {PlayerState} opponent 공격받는 플레이어
     * @returns {void}
     */
    function resolveExplosions(player, opponent) {
        const explosionGroups = findExplosionGroupsOnBoard(player.board);
        const exploding = explosionGroups.flatMap((group) => group.cells);
        // 이번 단계에 폭발할 색 뿌요가 있으면 점수와 공격을 처리한다.
        if (exploding.length) {
            const resolution = getExplosionResolution(player.board, exploding);
            player.combo += 1;
            if (game?.puzzle && player === game.players[0]) {
                game.puzzle.pendingMaxExplosion = Math.max(game.puzzle.pendingMaxExplosion, exploding.length);
            }
            playComboSounds(player);
            const point = calculateExplosionPoint(explosionGroups, player.combo, resolution.brokenHardGarbageCount);
            player.point += point;
            player.attack += calculateExplosionAttack(point);
            // 피버 룰에서는 상쇄할 DAMAGE 또는 상대 ATTACK이 있으면 폭발 공격을 최소 1 이상 보장한다.
            if (game?.feverRule && Math.floor(player.attack) < 1 && (Math.floor(player.damage) > 0 || Math.floor(opponent.attack) > 0)) {
                player.attack = 1;
            }
            const center = exploding.reduce((sum, [x, y]) => ({ x: sum.x + x, y: sum.y + y }), { x: 0, y: 0 });
            sendAttackEnergy(player, opponent, center.x / exploding.length, center.y / exploding.length);
            player.comboPopups.push({ x: center.x / exploding.length, y: center.y / exploding.length, combo: player.combo, elapsed: 0 });
            applyExplosionResolution(player.board, resolution);
            player.effects = { cells: [...resolution.removed.values()], elapsed: 0, duration: 430 };
            player.phase = 'burst';
            player.phaseTimer = 0;
            return;
        }
        const completedCombo = player.combo;
        deliverFinalAttackEnergy(player, opponent);
        if (game?.continuousFever && player === game.players[0] && game.fever) game.fever.pendingCombo = completedCombo;
        if (game?.feverRule && player.fever?.active) player.fever.pendingCombo = completedCombo;
        if (game?.puzzle && player === game.players[0]) game.puzzle.pendingCombo = completedCombo;
        player.combo = 0;
        if (game?.puzzle && player === game.players[0]) {
            player.phase = 'check';
        } else if (game?.feverRule && completedCombo > 0) {
            // 현재 DAMAGE의 유무와 관계없이 성공한 배치임을 보존한다. 공격 에너지가 비동기로
            // 도착하더라도 이 배치에서 폭발했다면 일반/피버 필드 모두 방해뿌요를 받지 않는다.
            if (player.fever) player.fever.deferGarbage = true;
            player.phase = 'check';
        } else {
            player.phase = 'garbage';
        }
    }

    /**
     * 새 공격으로 상대의 미정산 공격과 자신의 피해를 즉시 상쇄한다.
     * 정수 부분만 사용해 ATTACK과 DAMAGE의 소수 잔여값은 다음 정산까지 보존한다.
     * @param {PlayerState} player 새 공격을 발생시킨 플레이어
     * @param {PlayerState} opponent 상대 플레이어
     * @returns {void}
     */
    function sendAttackEnergy(player, opponent, sourceX, sourceY) {
        const amount = Math.floor(player.attack);
        if (amount < 1) return;
        let remaining = amount;
        let cancelledOpponentAttack = 0;
        let cancelledDamage = 0;
        let cancelledNormalDamage = 0;
        if (game?.feverRule && player.fever?.active) {
            // 피버 공격은 피버 DAMAGE와 보존된 일반 DAMAGE를 모두 상쇄한 뒤 상대 ATTACK을 상쇄한다.
            cancelledDamage = Math.min(remaining, Math.floor(player.fever.damage));
            player.fever.damage -= cancelledDamage;
            player.attack -= cancelledDamage;
            remaining -= cancelledDamage;
            cancelledNormalDamage = Math.min(remaining, Math.floor(player.normalDamage));
            player.normalDamage -= cancelledNormalDamage;
            player.attack -= cancelledNormalDamage;
            remaining -= cancelledNormalDamage;
            cancelledOpponentAttack = Math.min(remaining, Math.floor(opponent.attack));
            player.attack -= cancelledOpponentAttack;
            opponent.attack -= cancelledOpponentAttack;
            remaining -= cancelledOpponentAttack;
        } else {
            cancelledOpponentAttack = Math.min(remaining, Math.floor(opponent.attack));
            player.attack -= cancelledOpponentAttack;
            opponent.attack -= cancelledOpponentAttack;
            remaining -= cancelledOpponentAttack;
            cancelledDamage = Math.min(remaining, Math.floor(player.damage));
            player.damage -= cancelledDamage;
            player.attack -= cancelledDamage;
            remaining -= cancelledDamage;
        }
        opponent.outgoingWarningDelay = Math.floor(opponent.attack);
        if (cancelledDamage) player.warningReductionDelay += cancelledDamage;
        if (cancelledOpponentAttack || cancelledDamage || cancelledNormalDamage) registerFeverOffset(player, opponent);
        const source = { x: player.fieldX + (sourceX + 0.5) * CELL, y: FIELD_BOTTOM - (sourceY + 0.5) * CELL };
        player.lastAttackEnergySource = source;
        player.outgoingWarningDelay = Math.floor(player.attack);
        // 연쇄 중에는 에너지만 상대 천장까지 보낸다. 도착 시 예고뿌요만 갱신하고 DAMAGE는 정산하지 않는다.
        if (cancelledOpponentAttack || cancelledDamage || cancelledNormalDamage || remaining) {
            const energy = queueEnergyTransfer(player, opponent, source, cancelledDamage, cancelledOpponentAttack, 0, remaining > 0, Math.floor(player.attack), true);
            if (remaining > 0 && energy) {
                energy.spellEffectCombo = player.combo;
                player.lastAttackTransfer = energy;
            }
        }
    }

    /**
     * 연쇄 및 에너지 연출이 끝난 뒤 남은 정수 공격력을 상대 피해로 확정한다.
     * @param {PlayerState} player 공격을 보낸 플레이어
     * @param {PlayerState} opponent 공격을 받을 플레이어
     * @returns {void}
     */
    function deliverFinalAttackEnergy(player, opponent) {
        const amount = Math.floor(player.attack);
        const energyTransfers = getEnergyTransfers();
        const lastEnergy = player.lastAttackTransfer;
        // 연쇄 중 먼저 출발한 에너지도 이후 ATTACK 상쇄로 최종 전달량이 0이 될 수 있다.
        // 이때는 남아 있는 예고를 즉시 취소해 상대 필드에 오래 표시되지 않게 한다.
        if (amount < 1) {
            cancelEnergyPreview(lastEnergy);
            player.lastAttackTransfer = null;
            return;
        }
        player.attack -= amount;
        player.outgoingWarningDelay = Math.floor(player.attack);
        // 마지막 폭발에서 이미 출발한 에너지를 최종 DAMAGE 정산에 사용한다.
        // 해당 연출이 끝난 상태라면 지금이 곧 "에너지 완료 후" 시점이다.
        if (lastEnergy && energyTransfers?.includes(lastEnergy)) {
            lastEnergy.finalDamageAmount = amount;
        } else {
            opponent.damage += amount;
            clearAnnouncedAttack(player);
        }
        player.lastAttackTransfer = null;
    }

    /**
     * 싹쓸이 보너스 피해를 상대 필드로 전달하는 에너지 연출을 등록한다.
     * @param {PlayerState} player 싹쓸이를 달성한 플레이어
     * @param {PlayerState} opponent 보너스를 받을 상대 플레이어
     * @param {number} amount 전달할 피해량
     * @returns {void}
     */
    function sendAllClearEnergy(player, opponent, amount) {
        if (amount < 1) return;
        queueEnergyTransfer(player, opponent, { x: player.fieldX + COLUMNS * CELL / 2, y: FIELD_TOP + VISIBLE_ROWS * CELL / 2 }, 0, 0, amount);
    }

    /**
     * 현재 게임 또는 시뮬레이터가 관리하는 에너지 전달 목록을 가져온다.
     * @returns {Array<object>|null} 에너지 전달 목록. 게임과 시뮬레이터가 모두 없으면 null
     */
    function getEnergyTransfers() {
        if (game?.energyTransfers) return game.energyTransfers;
        return simulator?.energyTransfers || null;
    }

    /**
     * 공격 상쇄 또는 피해 전달에 사용할 에너지 이동 경로를 생성한다.
     * @param {PlayerState} player 에너지를 보낸 플레이어
     * @param {PlayerState} opponent 에너지를 받을 플레이어
     * @param {{x:number,y:number}} source 에너지 출발 논리 좌표
     * @param {number} cancelledDamage 상쇄한 내 피해량
     * @param {number} cancelledAttack 상쇄한 상대 공격력
     * @param {number} delivered 즉시 전달할 피해량
     * @param {boolean} [travelToOpponent=false] 피해량이 없어도 상대방까지 이동할지 여부
     * @param {number|null} [previewAmount=null] 이동 중 표시할 공격 예고량
     * @param {boolean} [startsAtExplosion=false] 폭발 지점에서 바로 출발하는지 여부
     * @returns {object|null|undefined} 생성한 에너지 정보. 경로 또는 전달 목록이 없으면 null 또는 undefined
     */
    function queueEnergyTransfer(player, opponent, source, cancelledDamage, cancelledAttack, delivered, travelToOpponent = false, previewAmount = null, startsAtExplosion = false) {
        const energyTransfers = getEnergyTransfers();
        if (!energyTransfers) return;
        const ownTarget = { x: player.fieldX + COLUMNS * CELL / 2, y: FIELD_TOP - CELL / 2 };
        const opponentTarget = { x: opponent.fieldX + COLUMNS * CELL / 2, y: FIELD_TOP - CELL / 2 };
        const route = [];
        if (cancelledDamage || cancelledAttack) route.push({ target: ownTarget, kind: 'cancel', amount: cancelledDamage, attackAmount: cancelledAttack, arcDirection: 'up' });
        if (delivered || travelToOpponent) route.push({ target: opponentTarget, kind: 'damage', amount: delivered, previewAmount, arcDirection: (cancelledDamage || cancelledAttack) ? 'down' : startsAtExplosion ? 'up' : 'down' });
        if (!route.length) return null;
        const energy = { player, opponent, position: source, route, routeIndex: 0, elapsed: 0, fading: false, previewCancelled: false, finalDamageAmount: 0, spellEffectCombo: null, spellEffectPlayed: false };
        energyTransfers.push(energy);
        return energy;
    }

    /**
     * 현재 플레이어 필드에 표시할 방해뿌요 예고 총량을 계산한다.
     * @param {PlayerState} player 예고를 표시할 플레이어
     * @param {PlayerState} opponent 상대 플레이어
     * @returns {number} 표시할 예고 총량
     */
    function warningAmount(player, opponent) {
        return player.damage + opponent.announcedAttack + player.warningReductionDelay;
    }

    /**
     * 특정 에너지가 표시한 예고만 지운다. 다른 에너지가 더 최신 예고를 표시 중이면 유지한다.
     * @param {PlayerState} player 예고 공격력을 보낸 플레이어
     * @param {object|null} [energy=null] 지울 예고를 표시한 에너지
     * @returns {void}
     */
    function clearAnnouncedAttack(player, energy = null) {
        if (energy && player.announcedAttackEnergy !== energy) return;
        player.announcedAttack = 0;
        player.announcedAttackEnergy = null;
    }

    /**
     * 최종 DAMAGE가 상쇄된 에너지가 예고를 새로 표시하거나 기존 예고를 남기지 못하게 한다.
     * @param {object|null} energy 취소할 공격 에너지
     * @returns {void}
     */
    function cancelEnergyPreview(energy) {
        if (!energy) return;
        energy.previewCancelled = true;
        clearAnnouncedAttack(energy.player, energy);
    }

    /**
     * 에너지 전달 애니메이션을 진행하고, 도착한 피해·상쇄 효과를 반영한다.
     * @param {number} delta 이전 프레임 이후 경과 시간(ms)
     * @returns {void}
     */
    function updateEnergyTransfers(delta) {
        const energyTransfers = getEnergyTransfers();
        if (!energyTransfers?.length) return;
        const remainingTransfers = energyTransfers.filter((energy) => {
            if (energy.fading) {
                energy.elapsed += delta;
                if (energy.elapsed < 150) return true;
                if (energy.finalDamageAmount) {
                    energy.opponent.damage += energy.finalDamageAmount;
                    clearAnnouncedAttack(energy.player, energy);
                }
                return false;
            }
            energy.elapsed += delta;
            if (energy.elapsed < 250) return true;
            const segment = energy.route[energy.routeIndex];
            energy.position = segment.target;
            if (segment.kind === 'cancel') {
                energy.player.warningReductionDelay = Math.max(0, energy.player.warningReductionDelay - segment.amount);
                energy.opponent.announcedAttack = Math.max(0, energy.opponent.announcedAttack - segment.attackAmount);
                if (!energy.opponent.announcedAttack) energy.opponent.announcedAttackEnergy = null;
            } else {
                if (segment.previewAmount !== null && !energy.previewCancelled) {
                    energy.player.announcedAttack = segment.previewAmount;
                    energy.player.announcedAttackEnergy = energy;
                }
                if (segment.amount) {
                    energy.opponent.damage += segment.amount;
                    clearAnnouncedAttack(energy.player, energy);
                }
                if (energy.spellEffectCombo !== null && !energy.spellEffectPlayed) {
                    playComboSpellEffect(energy.spellEffectCombo);
                    energy.spellEffectPlayed = true;
                }
            }
            energy.routeIndex += 1;
            energy.elapsed = 0;
            if (energy.routeIndex < energy.route.length) return true;
            energy.fading = true;
            return true;
        });
        if (game?.energyTransfers === energyTransfers) game.energyTransfers = remainingTransfers;
        else if (simulator?.energyTransfers === energyTransfers) simulator.energyTransfers = remainingTransfers;
    }

    /**
     * 아직 재생 중이거나 사라지는 중인 에너지 전달이 있는지 확인한다.
     * @returns {boolean} 대기 중인 에너지 전달 존재 여부
     */
    function hasPendingEnergyTransfers() {
        return Boolean(getEnergyTransfers()?.length);
    }

    /**
     * 피해 수치만큼 방해뿌요를 상단에서 생성한다.
     * @param {PlayerState} player 방해뿌요를 받을 플레이어
     * @returns {void}
     */
    function dropGarbage(player) {
        // 연속 피버에서는 DAMAGE를 다음 스테이지 배치 전까지 예고로 보존하며 실제 방해뿌요를 만들지 않는다.
        if (game?.continuousFever) {
            player.phase = 'check';
            player.phaseTimer = 0;
            return;
        }
        const amount = Math.min(30, Math.floor(player.damage));
        // 누적 피해가 있으면 한 번에 최대 30개의 방해뿌요를 필드 위에서 떨어뜨린다.
        if (amount) {
            player.garbageDropCount += 1;
            const positions = [];
            // 필요한 행 수만큼 열 순서를 섞어 방해뿌요 위치를 만든다.
            for (let y = 0; y < Math.ceil(amount / COLUMNS); y += 1) {
                const spawnY = GARBAGE_SPAWN_MAX_ROW - y;
                if (spawnY < GARBAGE_SPAWN_MIN_ROW) break;
                const columns = [...Array(COLUMNS).keys()].sort(() => randomFloat() - 0.5);
                columns.forEach((x) => positions.push([x, spawnY]));
            }
            positions.slice(0, amount).forEach(([x, y]) => { player.board[y][x] = 'garbage'; });
            player.damage -= amount;
            startGravity(player, 'check');
            return;
        }
        player.phase = 'check';
    }

    /**
     * 패배한 필드의 뿌요와 하단 베젤이 무너지는 연출을 시작한다.
     * @param {PlayerState} loser 패배한 플레이어
     * @param {PlayerState} winner 승리한 플레이어
     * @returns {void}
     */
    function startDefeatSequence(loser, winner) {
        const fallingPuyos = [];
        loser.board.forEach((row, y) => row.forEach((color, x) => {
            if (color) fallingPuyos.push({ x, y, color });
        }));
        loser.active = null;
        loser.phase = 'defeated';
        playSound(commonSoundPool?.loose, 'effects', '패배 효과음');
        game.ending = {
            loser,
            winner,
            elapsed: 0,
            duration: 1050,
            fallingPuyos
        };
    }

    /**
     * 대전에서 이긴 적의 클래스명을 한 번만 저장한다.
     * @param {PlayerState} winner 승리한 플레이어
     * @returns {void}
     */
    function recordEnemyClear(winner) {
        if (game.practice || winner !== game.players[0]) return;
        const enemyController = game.players[1].controller;
        const enemyClassName = enemyController.constructor.name;
        unlockGalleryEnemy(enemyController.getClassType());
        const difficultyKey = AI_DIFFICULTIES[game.aiDifficulty]?.key || AI_DIFFICULTIES[1].key;
        const progressStore = game.feverRule ? store.feverClearListByDifficulty : store.clearListByDifficulty;
        let changed = false;
        if (!progressStore[difficultyKey].includes(enemyClassName)) {
            progressStore[difficultyKey].push(enemyClassName);
            changed = true;
        }
        if (!game.feverRule && !store.clearList.includes(enemyClassName)) {
            store.clearList.push(enemyClassName);
            changed = true;
        }
        if (changed) saveStore();
    }

    /**
     * 상대가 연쇄 처리 중인 단계인지 판별한다.
     * @param {string} phase 플레이어 진행 단계
     * @returns {boolean} 중력 또는 폭발 연출 중인지 여부
     */
    function isResolutionPhase(phase) {
        return phase === 'gravity' || phase === 'explode' || phase === 'burst' || phase === 'garbage' || phase === 'check';
    }

    function isWinnerSettlementPending(player) {
        return isResolutionPhase(player.phase) || player.allClearEffectElapsed > 0 || player.pendingAllClearDamage > 0 || hasPendingEnergyTransfers();
    }

    /**
     * 싹쓸이 표시 시간을 진행하고 효과가 끝나면 예약된 기본 룰 공격 에너지를 보낸다.
     * 패배 연출 중에도 호출할 수 있도록 일반 플레이어 단계 갱신과 분리한다.
     * @param {PlayerState} player 싹쓸이를 발생시킨 플레이어
     * @param {PlayerState} opponent 공격을 받을 상대
     * @param {number} delta 이전 프레임 후 경과한 밀리초
     * @returns {void}
     */
    function updateAllClearEffect(player, opponent, delta) {
        player.allClearEffectElapsed = Math.max(0, player.allClearEffectElapsed - delta);
        // 패배 연출이 시작된 프레임 경계에서 효과 시간이 이미 0이 되었더라도 예약 공격은
        // 반드시 상대 예고뿌요까지 전달되도록 남은 값을 즉시 에너지로 전환한다.
        if (player.allClearEffectElapsed === 0 && player.pendingAllClearDamage > 0) {
            sendAllClearEnergy(player, opponent, player.pendingAllClearDamage);
            player.pendingAllClearDamage = 0;
        }
    }

    /** 완료한 연쇄·싹쓸이 여부와 직전 목표로 다음 목표 연쇄를 계산한다. @param {number} combo 완료 연쇄 @param {boolean} allClear 싹쓸이 여부 @param {number} previousTarget 직전 목표 연쇄 @returns {number} 4~12 범위의 다음 목표 */
    function calculateContinuousFeverTarget(combo, allClear, previousTarget) {
        // 연속 피버와 피버 상태의 다음 목표는 항상 완료 연쇄 + 1부터 계산한다.
        let nextTarget = combo + 1;
        if (allClear) nextTarget += 2;
        nextTarget = Math.max(FEVER_MIN_TARGET_COMBO, Math.min(CONTINUOUS_FEVER_MAX_TARGET_COMBO, nextTarget));
        // 급격한 난이도 하락을 막기 위해 직전 목표보다 1을 넘겨 낮아지지 않게 한다.
        return Math.max(nextTarget, previousTarget - 1);
    }

    /** 배치 시작 전 또는 배치·연쇄 처리 도중 피버 시간이 만료되었는지 확인한다. @param {object} feverState 피버 상태 @returns {boolean} 종료 처리 필요 여부 */
    function isFeverTimeExpired(feverState) {
        return feverState.expiredPlacement || feverState.leftTime <= 0;
    }

    /** 연쇄에 따른 ATTACK·DAMAGE 전달과 싹쓸이 연출이 끝났는지 확인한다. 상대 방해뿌요 낙하는 다음 피버 스테이지와 병행한다. @param {PlayerState} player 사용자 @returns {boolean} 아직 기다려야 하는지 여부 */
    function isContinuousFeverSettlementPending(player) {
        return player.allClearEffectElapsed > 0
            || player.pendingAllClearDamage > 0
            || hasPendingEnergyTransfers();
    }

    /** 피버 연쇄 정산 후 종료하거나 목표·시간을 갱신하고 다음 피버 턴을 시작한다. 시간 만료 뒤에는 연쇄·싹쓸이 보너스로 시간을 되살리지 않는다. @param {PlayerState} player 사용자 @param {PlayerState} opponent 연습 상대 @returns {void} */
    function finishContinuousFeverResolution(player, opponent) {
        if (!game?.continuousFever || !game.fever) return;
        if (isFeverTimeExpired(game.fever)) {
            startDefeatSequence(player, opponent);
            return;
        }
        const combo = game.fever.pendingCombo;
        game.fever.targetCombo = calculateContinuousFeverTarget(combo, game.fever.pendingAllClear, game.fever.targetCombo);
        if (game.fever.leftTime > 0 && combo > 0) {
            const comboTimeBonus = Math.floor(combo / 2) * 1000 + FEVER_CHAIN_TIME_BONUS;
            const allClearTimeBonus = game.fever.pendingAllClear ? CONTINUOUS_FEVER_ALL_CLEAR_TIME_BONUS : 0;
            game.fever.leftTime += comboTimeBonus + allClearTimeBonus;
        }
        prepareContinuousFeverTurn();
    }

    /** 피버 룰 연쇄의 ATTACK·DAMAGE 전달과 싹쓸이 연출이 끝났는지 확인한다. 상대 방해뿌요 낙하는 다음 피버 스테이지와 병행한다. @param {PlayerState} player 연쇄 플레이어 @returns {boolean} 대기 필요 여부 */
    function isFeverRuleSettlementPending(player) {
        return player.allClearEffectElapsed > 0
            || player.pendingAllClearDamage > 0
            || hasPendingEnergyTransfers();
    }

    /** 피버 룰의 한 피버 턴을 정산하고 다음 턴 또는 피버 종료로 전환한다. @param {PlayerState} player 대상 플레이어 @returns {void} */
    function finishFeverRuleResolution(player) {
        const state = player.fever;
        if (!game?.feverRule || !state?.active) return;
        const combo = state.pendingCombo;
        const previousTarget = state.targetCombo;
        state.targetCombo = calculateContinuousFeverTarget(combo, state.pendingAllClear, previousTarget);
        if (isFeverTimeExpired(state)) {
            finishPlayerFever(player, 'B');
            return;
        }
        if (state.targetCombo !== previousTarget) state.leftTime += Math.floor(combo / 2) * 1000 + FEVER_CHAIN_TIME_BONUS;
        prepareFeverTurn(player, state);
    }

    /** 퍼즐뿌요 한 턴의 클리어 조건을 확인한다. @param {PlayerState} player 사용자 @returns {boolean} 조건 달성 여부 */
    function isPuzzleStageCleared(player) {
        const puzzle = game?.puzzle;
        if (!puzzle) return false;
        const stage = puzzle.stage;
        if (stage.winConditionType === 'clear') return puzzle.pendingAllClear;
        if (stage.winConditionType === 'multiple') return puzzle.pendingMaxExplosion >= stage.winConditionValue;
        if (stage.winConditionType === 'attack') return puzzle.pendingWarningAmount >= stage.winConditionValue;
        return puzzle.pendingCombo >= stage.winConditionValue;
    }

    /** 퍼즐뿌요 스테이지의 클리어 정보를 저장하고 즉시 결과 화면으로 전환한다. @param {PlayerState} player 사용자 @returns {void} */
    function finishPuzzleStage(player) {
        const stageIndex = game.puzzle.stageIndex;
        const earnedStar = player === game.players[0] && game.puzzle.turn <= game.puzzle.stage.turnLimit;
        let progressChanged = false;
        if (!store.puzzleClearStages.includes(stageIndex)) {
            store.puzzleClearStages.push(stageIndex);
            progressChanged = true;
        }
        if (earnedStar && !store.puzzleStarStages.includes(stageIndex)) {
            store.puzzleStarStages.push(stageIndex);
            progressChanged = true;
        }
        if (progressChanged) saveStore();
        game.winner = player;
        game.running = false;
        game.ending = null;
        stopBackgroundMusic();
    }

    /** 퍼즐뿌요 턴 정산 뒤 클리어 또는 다음 턴으로 전환한다. @param {PlayerState} player 사용자 @param {PlayerState} opponent 연습 상대 @returns {boolean} 정산 완료 여부 */
    function finishPuzzleTurn(player, opponent) {
        const puzzle = game?.puzzle;
        if (!puzzle) return true;
        puzzle.pendingWarningAmount = Math.max(puzzle.pendingWarningAmount, warningAmount(opponent, player));
        if (player.allClearEffectElapsed > 0 || player.pendingAllClearDamage > 0 || hasPendingEnergyTransfers()) return false;
        if (isPuzzleStageCleared(player)) {
            finishPuzzleStage(player);
            return true;
        }
        // 퍼즐뿌요는 예고만 보여 주며 다음 조작 직전에 모든 공격·피해를 정리한다.
        player.attack = 0;
        player.damage = 0;
        player.normalDamage = 0;
        player.announcedAttack = 0;
        player.announcedAttackEnergy = null;
        opponent.attack = 0;
        opponent.damage = 0;
        opponent.normalDamage = 0;
        opponent.announcedAttack = 0;
        opponent.announcedAttackEnergy = null;
        opponent.warningReductionDelay = 0;
        puzzle.turn += 1;
        enterControl(player);
        return true;
    }

    /**
     * 패배 연출과, 진행 중이던 승리자의 연쇄 처리를 갱신한다.
     * @param {number} delta 이전 프레임 후 경과한 밀리초
     * @returns {void}
     */
    function updateDefeatSequence(delta) {
        const ending = game.ending;
        ending.elapsed += delta;
        // 승자의 연쇄 단계는 계속 갱신한다. 그 밖의 단계에서도 싹쓸이 효과와 예약 공격을
        // 별도로 진행한다. 시작 시점의 스냅샷에 의존하지 않고 매 프레임 정산 상태를 확인해야
        // 양측 어느 쪽이 먼저 패배하더라도 싹쓸이 예고뿌요 생성까지 완료할 수 있다.
        if (isResolutionPhase(ending.winner.phase)) updatePlayer(ending.winner, ending.loser, delta);
        else updateAllClearEffect(ending.winner, ending.loser, delta);
        // 패배 연출과 승자의 연쇄·싹쓸이·에너지 이동이 모두 끝난 뒤에만 게임을 종료한다.
        if (ending.elapsed > ending.duration && !isWinnerSettlementPending(ending.winner)) {
            recordEnemyClear(ending.winner);
            game.running = false;
            game.winner = ending.winner;
            game.ending = null;
            stopBackgroundMusic();
        }
    }

    /**
     * 플레이어의 현재 게임 단계를 시간 경과만큼 진행한다.
     * @param {PlayerState} player 갱신할 플레이어
     * @param {PlayerState} opponent 상대 플레이어
     * @param {number} delta 이전 프레임 후 경과한 밀리초
     * @returns {void}
     */
    function updatePlayer(player, opponent, delta) {
        player.comboPopups = player.comboPopups
            .map((popup) => ({ ...popup, elapsed: popup.elapsed + delta }))
            .filter((popup) => popup.elapsed < 2000);
        updateAllClearEffect(player, opponent, delta);
        if (game?.puzzle && player === game.players[0]) {
            game.puzzle.pendingWarningAmount = Math.max(game.puzzle.pendingWarningAmount, warningAmount(opponent, player));
        }
        // 플레이 방법 시연은 싹쓸이 예고와 방해뿌요 낙하를 보여주는 동안 다음 뿌요의 낙하를 멈춘다.
        if (player.tutorialHold) return;
        if (player.phase === 'feverWait') {
            if (game?.continuousFever) {
                if (!isContinuousFeverSettlementPending(player)) finishContinuousFeverResolution(player, opponent);
            } else if (game?.feverRule && !isFeverRuleSettlementPending(player)) {
                finishFeverRuleResolution(player);
            }
            return;
        }
        if (player.phase === 'feverAllClearWait') {
            if (player.allClearEffectElapsed > 0 || hasPendingEnergyTransfers()) return;
            player.fever.pendingAllClearStage = false;
            // 피버 룰의 일반 필드 싹쓸이는 피버에 진입하지 않았을 때 4연쇄 패턴을 지급한다.
            prepareFeverTurn(player, player.fever, FEVER_MIN_TARGET_COMBO, false);
            return;
        }
        // 피버 패턴은 숨김 영역에서의 중력 애니메이션이 끝난 뒤에만 조작을 시작한다.
        if (player.phase === 'feverStageControl') {
            enterControl(player);
            return;
        }
        // 대기 중인 연습 상대도 예약된 피해가 있으면 방해뿌요 처리는 수행한다.
        if (player.phase === 'idle') {
            // 퍼즐뿌요의 오른쪽 영역은 DAMAGE 예고만 보이고 방해뿌요를 실제로 떨어뜨리지 않는다.
            if (game?.puzzle) return;
            // 연속 피버의 DAMAGE는 다음 피버 스테이지가 배치될 때까지 예고로만 남기며 방해뿌요를 생성하지 않는다.
            if (game?.continuousFever) return;
            // 연습·플레이 방법에서는 연쇄와 그에 딸린 모든 에너지 이동이 끝난 뒤에만 방해뿌요를 떨어뜨린다.
            if (game?.practice && (opponent.combo > 0 || isResolutionPhase(opponent.phase) || opponent.allClearEffectElapsed > 0 || opponent.pendingAllClearDamage > 0 || hasPendingEnergyTransfers())) return;
            if (player.damage > 0) dropGarbage(player);
            return;
        }
        // 조작 단계에서는 CPU 이동과 낙하 타이머를 갱신한다.
        if (player.phase === 'control') {
            const tutorialAutoplay = game?.tutorial?.stage === 1 && player === game.players[0];
            if (!tutorialAutoplay && !player.controller && player === game?.players[0] && horizontalKeyPressed) {
                horizontalHoldElapsed += delta;
                if (horizontalHoldElapsed >= HORIZONTAL_HOLD_DELAY) {
                    horizontalRepeatElapsed += delta;
                    while (horizontalRepeatElapsed >= HORIZONTAL_REPEAT_INTERVAL) {
                        moveActive(player, horizontalKeyPressed === 'arrowleft' ? -1 : 1, 0);
                        horizontalRepeatElapsed -= HORIZONTAL_REPEAT_INTERVAL;
                    }
                }
            }
            if (!tutorialAutoplay && !player.controller && player === game?.players[0] && (virtualDirectionInput.arrowleft || virtualDirectionInput.arrowright)) {
                virtualHorizontalHoldElapsed += delta;
                if (virtualHorizontalHoldElapsed >= VIRTUAL_HORIZONTAL_HOLD_DELAY) {
                    virtualHorizontalRepeatElapsed += delta;
                    while (virtualHorizontalRepeatElapsed >= VIRTUAL_HORIZONTAL_REPEAT_INTERVAL) {
                        if (virtualDirectionInput.arrowleft) moveActive(player, -1, 0);
                        if (virtualDirectionInput.arrowright) moveActive(player, 1, 0);
                        virtualHorizontalRepeatElapsed -= VIRTUAL_HORIZONTAL_REPEAT_INTERVAL;
                    }
                }
            }
            if (player.controller) {
                player.aiDecisionElapsed += delta;
                const controllerHandledMovement = player.controller.updateControl?.(player, delta) === true;
                if (!controllerHandledMovement) {
                    const rotationDelta = (player.aiRotation - player.active.rotation + 4) % 4;
                    if (rotationDelta) {
                        const direction = rotationDelta === 3 ? -1 : 1;
                        if (!rotateActive(player, direction) && player.active.x !== player.aiTarget) {
                            moveActive(player, player.active.x < player.aiTarget ? 1 : -1, 0);
                        }
                    } else if (player.active.x !== player.aiTarget) {
                        moveActive(player, player.active.x < player.aiTarget ? 1 : -1, 0);
                    }
                }
                player.aiFastDown = player.controller.useFastDown(player) === true;
            }
            // AI 정책 또는 사용자·가상 컨트롤러·튜토리얼 입력으로 빠른 하강을 적용할지 여부다.
            const fastDown = player.controller ? player.aiFastDown : tutorialAutoplay ? player.tutorialFastDown === true : isDownKeyPressed || virtualDirectionInput.arrowdown || player.tutorialFastDown === true;
            // 경과 시간 1분마다 0.2씩 증가하며 최대 배율을 넘지 않는 사용자 자동 낙하 속도 배율이다.
            const speedMultiplier = Math.min(MAX_PLAYER_FALL_SPEED_MULTIPLIER, 1 + Math.floor(game.elapsed / 60000) * 0.2);
            // 빠른 하강·AI·사용자 자동 낙하 각각에 적용할 한 칸 낙하 간격(ms)이다.
            const fallInterval = fastDown ? 55 : player.controller ? 290 : PLAYER_FALL_INTERVAL / speedMultiplier;
            const currentFloor = Math.floor(player.active.y);
            const nextFloor = currentFloor - 1;
            if (nextFloor < 0 || !canPlace(player, { ...player.active, y: nextFloor })) {
                // 다음 칸이 막혀 있어도 현재 칸의 바닥에 닿기 전까지는
                // 남은 소수점 거리만큼 평소 하강 속도로 계속 내려간다.
                // 여기서 즉시 currentFloor로 보정하면 1칸 미만의 간격을
                // 건너뛰고 자석처럼 잠기는 현상이 발생한다.
                const nextY = player.active.y - delta / fallInterval;
                if (nextY > currentFloor) {
                    player.active.y = nextY;
                    return;
                }
                player.active.y = currentFloor;
                player.fallTimer = 0;
                lockActive(player);
            } else {
                player.active.y -= delta / fallInterval;
                if (player.active.y <= nextFloor) player.active.y = nextFloor;
            }
            return;
        }
        // 중력 애니메이션이 끝날 때까지 낙하 위치를 보간한다.
        if (player.phase === 'gravity') {
            if (!player.gravityAnimation) {
                player.phase = player.gravityNextPhase;
                return;
            }
            player.gravityAnimation.elapsed += delta;
            if (player.gravityAnimation.elapsed >= player.gravityAnimation.duration) {
                const falling = player.gravityAnimation.falling;
                player.gravityAnimation = null;
                playGravityLandingSounds(falling);
                player.phase = player.gravityNextPhase;
            }
            return;
        }
        // 폭발 연출이 끝난 뒤에는 다시 중력과 폭발 판정을 실행한다.
        if (player.phase === 'burst') {
            player.effects.elapsed += delta;
            if (player.effects.elapsed >= player.effects.duration) {
                player.effects = null;
                startGravity(player, 'explode');
            }
            return;
        }
        player.phaseTimer += delta;
        if (player.phaseTimer < 150) return;
        player.phaseTimer = 0;
        // 대기 시간이 끝난 현재 단계에 맞는 규칙 처리를 실행한다.
        if (player.phase === 'explode') {
            resolveExplosions(player, opponent);
        } else if (player.phase === 'garbage') {
            dropGarbage(player);
        } else if (player.phase === 'check') {
            if (player.clearsGarbage) {
                player.board = player.board.map((row) => row.map((cell) => cell === 'garbage' ? null : cell));
                player.damage = 0;
            }
            // 피버 룰과 연속 피버는 두 패배 칸을, 다른 규칙은 기존 중앙 패배 칸을 검사한다.
            if (isDefeatBoard(player.board)) {
                startDefeatSequence(player, opponent);
            } else {
                const isAllClear = player.board.every((row) => row.every((cell) => cell === null));
                // 뿌요를 놓은 뒤 필드가 비었을 때만 싹쓸이를 처리한다.
                const triggeredAllClear = player.allClearEnabled && isAllClear && player.hasPlacedPuyoSinceAllClear;
                if (triggeredAllClear) {
                    playSound(commonSoundPool?.clears, 'effects', '싹쓸이 효과음');
                    // 피버 룰·연속 피버의 싹쓸이는 목표 연쇄 보너스와 황금 연출만 제공한다.
                    // 뿌요 폭발에서 생긴 ATTACK 에너지는 resolveExplosions()의 기존 경로로 그대로 전달된다.
                    if (!game?.feverRule && !game?.continuousFever) player.pendingAllClearDamage += ALL_CLEAR_DAMAGE;
                    player.point += ALL_CLEAR_POINT;
                    player.allClearEffectElapsed = ALL_CLEAR_EFFECT_DURATION;
                    player.hasPlacedPuyoSinceAllClear = false;
                }
                if (game?.continuousFever && player === game.players[0] && game.fever) {
                    game.fever.pendingAllClear = triggeredAllClear;
                    if (game.fever.pendingCombo > 0) {
                        player.phase = 'feverWait';
                        return;
                    }
                    if (isFeverTimeExpired(game.fever)) {
                        startDefeatSequence(player, opponent);
                        return;
                    }
                }
                if (game?.feverRule && player.fever) {
                    const state = player.fever;
                    if (state.active) {
                        state.pendingAllClear = triggeredAllClear;
                        if (state.pendingCombo > 0) {
                            player.phase = 'feverWait';
                            return;
                        }
                        if (isFeverTimeExpired(state)) {
                            finishPlayerFever(player, 'A');
                            return;
                        }
                    } else {
                        if (state.pendingActivation) {
                            // 일반 필드 싹쓸이로 마지막 전등이 켜진 경우에는 피버 스테이지를 고르기 전에
                            // 현재 목표에 2연쇄 보너스를 적용한다. 피버 진입이 새 스테이지를 즉시 준비하므로
                            // 일반 필드에 별도의 싹쓸이 스테이지를 배치하지 않는다.
                            if (triggeredAllClear) state.targetCombo = Math.min(CONTINUOUS_FEVER_MAX_TARGET_COMBO, state.targetCombo + 2);
                            activatePlayerFever(player);
                            return;
                        }
                        if (triggeredAllClear) {
                            state.pendingAllClearStage = true;
                            player.phase = 'feverAllClearWait';
                            return;
                        }
                    }
                }
                if (game?.puzzle && player === game.players[0]) {
                    // 싹쓸이 연출이 끝난 뒤 check 단계가 한 번 더 실행되어도, 이번 턴에
                    // 한 번이라도 발생한 싹쓸이 기록은 승리 판정까지 유지한다.
                    game.puzzle.pendingAllClear = game.puzzle.pendingAllClear || triggeredAllClear;
                    finishPuzzleTurn(player, opponent);
                    return;
                }
                enterControl(player);
            }
        }
    }

    /**
     * 일반·방해뿌요가 공유하는 종류 식별자, 이름, 렌더링 규약이다.
     * 하위 클래스는 고유한 모양을 그리거나 공통 슬라임 렌더링을 상속한다.
     */
    class Puyo {
        /** @param {string} type 보드와 외부 상태에 쓰는 종류 식별자 @param {string} name 표시할 이름 */
        constructor(type, name) {
            /** 보드와 외부 상태에 유지하는 종류 식별자다. @type {string} */
            this.type = type;
            /** 갤러리 등에 표시할 기본 이름이다. @type {string} */
            this.name = name;
        }

        /** 뿌요 이름을 반환한다. @returns {string} */
        getName() { return this.name; }

        /** 뿌요 하나를 그린다. 하위 클래스에서 모양을 구현한다. @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @param {number} scale 셀 대비 크기 비율 @param {boolean} slimeDetails 반사광과 눈 위치를 기본 슬라임처럼 그릴지 여부 @returns {void} */
        draw(drawingContext, x, y, cellSize, scale = 1, slimeDetails = true) {}
    }

    /** 일반 색 뿌요와 둥근 방해뿌요가 공유하는 슬라임 렌더링 클래스다. */
    class SlimePuyo extends Puyo {
        /** @param {string} type 종류 식별자 @param {string} name 표시할 이름 @param {string} paletteKey PALETTE 색상 키 @param {boolean} garbageStyle 방해뿌요식 반투명 테두리를 쓸지 여부 */
        constructor(type, name, paletteKey, garbageStyle = false) {
            super(type, name);
            this.paletteKey = paletteKey;
            this.garbageStyle = garbageStyle;
        }

        /** 공통 슬라임 모양을 그린다. @override @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @param {number} scale 셀 대비 크기 비율 @param {boolean} slimeDetails 반사광과 눈 위치를 기본 슬라임처럼 그릴지 여부 @returns {void} */
        draw(drawingContext, x, y, cellSize, scale = 1, slimeDetails = true) {
            const radius = cellSize * 0.42 * scale;
            drawingContext.save();
            drawingContext.translate(x + cellSize / 2, y + cellSize / 2);
            drawingContext.fillStyle = PALETTE[this.paletteKey];
            drawingContext.globalAlpha = this.garbageStyle ? 0.75 : 1;
            drawingContext.beginPath();
            drawingContext.arc(0, 0, radius, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.lineWidth = 2;
            drawingContext.strokeStyle = this.garbageStyle ? '#f4fbff' : 'rgba(255,255,255,0.45)';
            drawingContext.stroke();
            // 일반/방해뿌요는 물방울 같은 슬라임이라는 인상을 주는 작은 반사광을 넣는다.
            // 예고뿌요(태양, 별, 돌 등)는 각 WarningPuyo 하위 클래스에서 별도로 그린다.
            if (slimeDetails) {
                drawingContext.fillStyle = 'rgba(255, 255, 255, 0.72)';
                drawingContext.beginPath();
                // 긴 축을 기존 방향에서 90도 돌려 표면을 따라 반사되게 한다.
                drawingContext.ellipse(radius * 0.43, -radius * 0.43, radius * 0.13, radius * 0.22, 0.55 + Math.PI / 2, 0, Math.PI * 2);
                drawingContext.fill();
            }
            drawPuyoEyes(drawingContext, radius, slimeDetails ? radius * 0.08 : 0);
            drawingContext.restore();
        }
    }

    /** 빨강 일반뿌요다. */
    class RedPuyo extends SlimePuyo { constructor() { super('red', '빨강뿌요', 'red'); } }
    /** 초록 일반뿌요다. */
    class GreenPuyo extends SlimePuyo { constructor() { super('green', '초록뿌요', 'green'); } }
    /** 노랑 일반뿌요다. */
    class YellowPuyo extends SlimePuyo { constructor() { super('yellow', '노랑뿌요', 'yellow'); } }
    /** 파랑 일반뿌요다. */
    class BluePuyo extends SlimePuyo { constructor() { super('blue', '파랑뿌요', 'blue'); } }
    /** 보라 일반뿌요다. */
    class PurplePuyo extends SlimePuyo { constructor() { super('purple', '보라뿌요', 'purple'); } }
    /** 둥근 방해뿌요다. */
    class GarbagePuyo extends SlimePuyo { constructor() { super('garbage', '방해뿌요', 'garbage', true); } }
    /** 시뮬레이터에서만 사용할 수 있고 폭발하지 않는 철구뿌요다. */
    class IronPuyo extends SlimePuyo { constructor() { super(IRON_PUYO, '철구뿌요', 'iron'); } }

    /** 딱딱뿌요의 얼음 결정 모양을 그리는 방해뿌요 클래스다. */
    class HardGarbagePuyo extends Puyo {
        /** 딱딱뿌요를 만든다. */
        constructor() { super(HARD_GARBAGE, '딱딱뿌요'); }

        /** 얼음 결정 모양의 딱딱뿌요를 그린다. @override @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @param {number} scale 셀 대비 크기 비율 @returns {void} */
        draw(drawingContext, x, y, cellSize, scale = 1) {
            const radius = cellSize * 0.42 * scale;
            const halfWidth = radius * 1.08;
            const halfHeight = radius * 0.86;
            const corner = radius * 0.16;
            drawingContext.save();
            drawingContext.translate(x + cellSize / 2, y + cellSize / 2);
            const ice = drawingContext.createLinearGradient(-halfWidth, -halfHeight, halfWidth, halfHeight);
            ice.addColorStop(0, '#e9fbff'); ice.addColorStop(0.44, '#9cdef6'); ice.addColorStop(1, '#4fa9d2');
            drawingContext.fillStyle = ice;
            drawingContext.beginPath();
            drawingContext.moveTo(-halfWidth + corner, -halfHeight);
            drawingContext.lineTo(halfWidth - corner, -halfHeight);
            drawingContext.lineTo(halfWidth, -halfHeight + corner);
            drawingContext.lineTo(halfWidth, halfHeight - corner);
            drawingContext.lineTo(halfWidth - corner, halfHeight);
            drawingContext.lineTo(-halfWidth + corner, halfHeight);
            drawingContext.lineTo(-halfWidth, halfHeight - corner);
            drawingContext.lineTo(-halfWidth, -halfHeight + corner);
            drawingContext.closePath();
            drawingContext.fill();
            drawingContext.strokeStyle = '#dff8ff'; drawingContext.lineWidth = 2; drawingContext.stroke();
            drawingContext.strokeStyle = 'rgba(255, 255, 255, 0.8)'; drawingContext.lineWidth = 1.5;
            drawingContext.beginPath(); drawingContext.moveTo(-halfWidth + corner * 1.5, -halfHeight + corner * 1.2); drawingContext.lineTo(halfWidth * 0.45, -halfHeight + corner * 1.2); drawingContext.stroke();
            drawPuyoEyes(drawingContext, radius * 0.86, radius * 0.08);
            drawingContext.restore();
        }
    }

    /** 예고뿌요의 작은 낱개·큰 낱개에만 쓰는 내부 잉크색 슬라임이다. */
    class WarningInkPuyo extends SlimePuyo { constructor() { super('warningInk', '예고뿌요', 'warningInk', true); } }

    /** 내장 일반·방해뿌요 객체 목록이다. 보드의 기존 문자열 식별자와 연결한다. @type {Puyo[]} */
    const PUYO_TYPES = [new RedPuyo(), new GreenPuyo(), new YellowPuyo(), new BluePuyo(), new PurplePuyo(), new GarbagePuyo(), new HardGarbagePuyo(), new IronPuyo(), new WarningInkPuyo()];
    /** 보드 문자열에서 뿌요 렌더링 객체를 찾는다. @type {Map<string, Puyo>} */
    const PUYO_BY_TYPE = new Map(PUYO_TYPES.map((puyo) => [puyo.type, puyo]));

    /** 보드의 종류 문자열에 해당하는 뿌요 객체를 반환한다. @param {string} type 종류 식별자 @returns {Puyo|null} */
    function getPuyo(type) { return PUYO_BY_TYPE.get(type) || null; }

    /**
     * 기존 보드 렌더링 호출을 뿌요 객체의 draw 메소드로 연결한다.
     * @param {number} x 셀의 왼쪽 X 좌표
     * @param {number} y 셀의 위쪽 Y 좌표
     * @param {string} color 뿌요 색상 종류
     * @param {number} scale 셀 대비 크기 비율
     * @param {boolean} slimeDetails 반사광과 눈 위치를 기본 슬라임처럼 그릴지 여부
     * @returns {void}
     */
    function drawPuyo(x, y, color, scale = 1, slimeDetails = true) {
        const puyo = getPuyo(color);
        if (puyo) puyo.draw(context, x, y, CELL, scale, slimeDetails);
    }

    /**
     * 모든 예고뿌요가 공유하는 단위와 렌더링 규약이다.
     * 하위 클래스는 단위 수와 draw 메소드를 재정의한다.
     */
    class WarningPuyo {
        /** @param {number} unitCount 이 예고뿌요 하나가 나타내는 방해뿌요 수 @param {string} type 외부 상태용 종류 식별자 */
        constructor(unitCount, type) {
            /** 이 예고뿌요 하나가 나타내는 방해뿌요 수다. @type {number} */
            this.unitCount = unitCount;
            /** WebMCP 등 외부 상태에 공개하는 종류 식별자다. @type {string} */
            this.type = type;
        }

        /** 예고뿌요 이름을 반환 @return {string} */
        getName() {
            return '예고 ' + this.unitCount;
        }

        /** 표시 목록 내에서 이 예고뿌요를 그릴 X 좌표를 계산한다. 하위 클래스에서 좁은 배치를 위해 재정의할 수 있다. @param {number} startX 시작 X 좌표 @param {number} index 목록 순번 @param {number} sameTypeIndex 같은 종류의 앞선 개수 @returns {number} 그릴 X 좌표 */
        getDisplayX(startX, index, sameTypeIndex) {
            return startX + index * CELL;
        }

        /** 예고뿌요 한 개를 그린다. 하위 클래스에서 각 모양을 구현한다. @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @returns {void} */
        draw(drawingContext, x, y, cellSize) {}
    }

    /** 1개 단위의 작은 낱개 예고뿌요다. */
    class TinyWarningPuyo extends WarningPuyo {
        /** 이 종류가 나타내는 방해뿌요 수다. @type {number} */
        static unitCount = 1;
        /** 1개 단위 작은 낱개 예고뿌요를 만든다. */
        constructor() { super(TinyWarningPuyo.unitCount, 'tiny'); }
        /** 예고뿌요 이름을 반환 @return {string} */
        getName() { return '작은 예고뿌요'; }
        /** 작은 낱개들은 기존처럼 서로 조금 겹치게 배치한다. @override @param {number} startX 시작 X 좌표 @param {number} index 목록 순번 @param {number} sameTypeIndex 앞선 작은 낱개 수 @returns {number} 그릴 X 좌표 */
        getDisplayX(startX, index, sameTypeIndex) { return startX + (index - sameTypeIndex * 0.35) * CELL; }
        /** 작은 낱개 예고뿌요를 그린다. @override @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @returns {void} */
        draw(drawingContext, x, y, cellSize) { drawPuyo(x + cellSize * 0.05, y + cellSize * 0.25, 'warningInk', 0.45, false); }
    }

    /** 6개 단위의 한 칸 크기 예고뿌요다. */
    class DropWarningPuyo extends WarningPuyo {
        /** 이 종류가 나타내는 방해뿌요 수다. @type {number} */
        static unitCount = 6;
        /** 6개 단위 한 칸 예고뿌요를 만든다. */
        constructor() { super(DropWarningPuyo.unitCount, 'drop'); }
        /** 예고뿌요 이름을 반환 @return {string} */
        getName() { return '큰 예고뿌요'; }
        /** 한 칸 크기 예고뿌요를 그린다. @override @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @returns {void} */
        draw(drawingContext, x, y, cellSize) { drawPuyo(x, y, 'warningInk'); }
    }

    /** 30개 단위의 빨간 돌 예고뿌요다. */
    class RockWarningPuyo extends WarningPuyo {
        /** 이 종류가 나타내는 방해뿌요 수다. @type {number} */
        static unitCount = 30;
        /** 30개 단위 빨간 돌 예고뿌요를 만든다. */
        constructor() { super(RockWarningPuyo.unitCount, 'rock'); }
        /** 예고뿌요 이름을 반환 @return {string} */
        getName() { return '빨간 돌'; }
        /** 빨간 돌 예고뿌요를 그린다. @override @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @returns {void} */
        draw(drawingContext, x, y, cellSize) {
            const size = CELL * 0.42;
            context.save(); context.translate(x + CELL / 2, y + CELL / 2); context.lineJoin = 'round'; context.lineWidth = 2;
            context.strokeStyle = '#8e2728'; context.fillStyle = '#c83f3d'; context.beginPath();
            context.moveTo(-size * 0.78, -size * 0.2); context.lineTo(-size * 0.52, -size * 0.78); context.lineTo(-size * 0.08, -size * 0.91); context.lineTo(size * 0.38, -size * 0.75); context.lineTo(size * 0.84, -size * 0.26); context.lineTo(size * 0.67, size * 0.48); context.lineTo(size * 0.2, size * 0.84); context.lineTo(-size * 0.43, size * 0.76); context.lineTo(-size * 0.86, size * 0.28); context.closePath(); context.fill(); context.stroke();
            context.fillStyle = '#e4675a'; context.beginPath(); context.moveTo(-size * 0.52, -size * 0.78); context.lineTo(-size * 0.08, -size * 0.91); context.lineTo(size * 0.05, -size * 0.2); context.lineTo(-size * 0.4, size * 0.02); context.closePath(); context.fill();
            context.fillStyle = '#9d2d31'; context.beginPath(); context.moveTo(size * 0.05, -size * 0.2); context.lineTo(size * 0.38, -size * 0.75); context.lineTo(size * 0.84, -size * 0.26); context.lineTo(size * 0.67, size * 0.48); context.lineTo(size * 0.2, size * 0.84); context.lineTo(size * 0.12, size * 0.12); context.closePath(); context.fill();
            context.strokeStyle = 'rgba(255, 170, 150, 0.65)'; context.lineWidth = 1.5; context.beginPath(); context.moveTo(-size * 0.52, -size * 0.78); context.lineTo(-size * 0.08, -size * 0.91); context.lineTo(size * 0.05, -size * 0.2); context.lineTo(size * 0.38, -size * 0.75); context.stroke();
            drawPuyoEyes(drawingContext, size, size * 0.08); context.restore();
        }
    }

    /** 210개 단위의 별 모양 예고뿌요다. */
    class StarWarningPuyo extends WarningPuyo {
        /** 이 종류가 나타내는 방해뿌요 수다. @type {number} */
        static unitCount = 210;
        /** 210개 단위 별 예고뿌요를 만든다. */
        constructor() { super(StarWarningPuyo.unitCount, 'star'); }
        /** 예고뿌요 이름을 반환 @return {string} */
        getName() { return '별'; }
        /** 별 모양 예고뿌요를 그린다. @override @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @returns {void} */
        draw(drawingContext, x, y, cellSize) {
            context.save(); context.translate(x + CELL / 2, y + CELL / 2); context.fillStyle = '#ffd54f'; context.beginPath();
            for (let index = 0; index < 10; index += 1) {
                const angle = -Math.PI / 2 + index * Math.PI / 5;
                const radius = index % 2 ? CELL * 0.18 : CELL * 0.42;
                context[index ? 'lineTo' : 'moveTo'](Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            context.closePath(); context.fill(); drawPuyoEyes(drawingContext, CELL * 0.34); context.restore();
        }
    }

    /** 500개 단위의 태양 모양 예고뿌요다. */
    class SunWarningPuyo extends WarningPuyo {
        /** 이 종류가 나타내는 방해뿌요 수다. @type {number} */
        static unitCount = 500;
        /** 500개 단위 태양 예고뿌요를 만든다. */
        constructor() { super(SunWarningPuyo.unitCount, 'sun'); }
        /** 예고뿌요 이름을 반환 @return {string} */
        getName() { return '태양'; }
        /** 태양 모양 예고뿌요를 그린다. @override @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @returns {void} */
        draw(drawingContext, x, y, cellSize) {
            context.save(); context.translate(x + CELL / 2, y + CELL / 2); context.fillStyle = '#ff9f1c';
            for (let index = 0; index < 8; index += 1) {
                context.save(); context.rotate(index * Math.PI / 4); context.beginPath(); context.moveTo(CELL * 0.22, 0); context.lineTo(CELL * 0.48, -CELL * 0.1); context.lineTo(CELL * 0.48, CELL * 0.1); context.closePath(); context.fill(); context.restore();
            }
            context.fillStyle = '#ff6b35'; context.beginPath(); context.arc(0, 0, CELL * 0.31, 0, Math.PI * 2); context.fill(); context.lineWidth = 2; context.strokeStyle = '#ffe082'; context.stroke(); drawPuyoEyes(drawingContext, CELL * 0.31); context.restore();
        }
    }

    /** 2,000개 단위의 밝은 청백색 중성자별 예고뿌요다. */
    class NeutronStarWarningPuyo extends WarningPuyo {
        /** 이 종류가 나타내는 방해뿌요 수다. @type {number} */
        static unitCount = 2000;
        /** 2,000개 단위 중성자별 예고뿌요를 만든다. */
        constructor() { super(NeutronStarWarningPuyo.unitCount, 'neutron-star'); }
        /** 예고뿌요 이름을 반환 @return {string} */
        getName() { return '중성자별'; }
        /** 중성자별의 고밀도 청백색 광구와 짧은 방사광을 그린다. @override @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @returns {void} */
        draw(drawingContext, x, y, cellSize) {
            const radius = cellSize * 0.3;
            drawingContext.save();
            drawingContext.translate(x + cellSize / 2, y + cellSize / 2);
            drawingContext.strokeStyle = 'rgba(122, 209, 255, 0.58)'; drawingContext.lineWidth = cellSize * 0.07;
            for (let index = 0; index < 8; index += 1) {
                drawingContext.save(); drawingContext.rotate(index * Math.PI / 4); drawingContext.beginPath();
                drawingContext.moveTo(radius * 1.05, 0); drawingContext.lineTo(radius * 1.48, 0); drawingContext.stroke(); drawingContext.restore();
            }
            const glow = drawingContext.createRadialGradient(-radius * 0.2, -radius * 0.24, radius * 0.06, 0, 0, radius * 1.14);
            glow.addColorStop(0, '#ffffff'); glow.addColorStop(0.36, '#edfaff'); glow.addColorStop(0.72, '#bce9ff'); glow.addColorStop(1, '#4ba9e8');
            drawingContext.fillStyle = glow; drawingContext.beginPath(); drawingContext.arc(0, 0, radius, 0, Math.PI * 2); drawingContext.fill();
            drawingContext.strokeStyle = '#d9f6ff'; drawingContext.lineWidth = cellSize * 0.045; drawingContext.stroke();
            drawingContext.fillStyle = 'rgba(255, 255, 255, 0.8)'; drawingContext.beginPath(); drawingContext.arc(-radius * 0.31, -radius * 0.38, radius * 0.2, 0, Math.PI * 2); drawingContext.fill();
            drawPuyoEyes(drawingContext, radius, radius * 0.08); drawingContext.restore();
        }
    }

    /** 80,000개 단위의 보랏빛 나선 은하 예고뿌요다. */
    class GalaxyWarningPuyo extends WarningPuyo {
        /** 이 종류가 나타내는 방해뿌요 수다. @type {number} */
        static unitCount = 80000;
        /** 80,000개 단위 은하 예고뿌요를 만든다. */
        constructor() { super(GalaxyWarningPuyo.unitCount, 'galaxy'); }
        /** 예고뿌요 이름을 반환 @return {string} */
        getName() { return '은하'; }
        /** 참고 이미지의 청보라 나선팔과 밝은 중심을 한 칸 크기로 그린다. @override @param {CanvasRenderingContext2D} drawingContext 캔버스 2D 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @returns {void} */
        draw(drawingContext, x, y, cellSize) {
            const radius = cellSize * 0.3;
            drawingContext.save();
            drawingContext.translate(x + cellSize / 2, y + cellSize / 2);
            drawingContext.rotate(-0.46);
            // 은하 바깥의 옅은 푸른 광륜과 서로 반대 방향으로 감기는 두 나선팔이다.
            const halo = drawingContext.createRadialGradient(0, 0, radius * 0.12, 0, 0, radius * 1.56);
            halo.addColorStop(0, 'rgba(255, 246, 220, 0.96)'); halo.addColorStop(0.28, 'rgba(196, 190, 255, 0.9)'); halo.addColorStop(0.62, 'rgba(104, 110, 214, 0.56)'); halo.addColorStop(1, 'rgba(25, 30, 88, 0)');
            drawingContext.fillStyle = halo; drawingContext.beginPath(); drawingContext.ellipse(0, 0, radius * 1.55, radius * 0.78, 0, 0, Math.PI * 2); drawingContext.fill();
            drawingContext.lineCap = 'round'; drawingContext.lineWidth = radius * 0.3;
            ['rgba(131, 132, 255, 0.72)', 'rgba(92, 204, 255, 0.64)'].forEach((color, index) => {
                drawingContext.strokeStyle = color; drawingContext.beginPath();
                const direction = index ? -1 : 1;
                drawingContext.moveTo(-radius * 1.35, direction * radius * 0.2);
                drawingContext.bezierCurveTo(-radius * 0.56, -direction * radius * 1.12, radius * 0.92, direction * radius * 0.9, radius * 1.35, -direction * radius * 0.1);
                drawingContext.stroke();
            });
            drawingContext.fillStyle = '#efe6ff'; drawingContext.beginPath(); drawingContext.arc(0, 0, radius * 0.43, 0, Math.PI * 2); drawingContext.fill();
            drawingContext.fillStyle = '#ffffff'; [[-0.78, -0.42, 0.08], [0.94, 0.26, 0.06], [0.56, -0.6, 0.05]].forEach(([starX, starY, starRadius]) => { drawingContext.beginPath(); drawingContext.arc(radius * starX, radius * starY, radius * starRadius, 0, Math.PI * 2); drawingContext.fill(); });
            drawingContext.rotate(0.46);
            // 다른 대형 예고뿌요처럼 눈은 중심에 유지해 게임의 캐릭터성을 보존한다.
            drawPuyoEyes(drawingContext, radius * 0.74, radius * 0.07);
            drawingContext.restore();
        }
    }

    /** 13,000개 단위의 강착 원반을 두른 블랙홀 예고뿌요다. */
    class BlackHoleWarningPuyo extends WarningPuyo {
        /** 이 종류가 나타내는 방해뿌요 수다. @type {number} */
        static unitCount = 13000;
        /** 13,000개 단위 블랙홀 예고뿌요를 만든다. */
        constructor() { super(BlackHoleWarningPuyo.unitCount, 'black-hole'); }
        /** 예고뿌요 이름을 반환 @return {string} */
        getName() { return '블랙홀'; }
        /** 검은 중심과 빛나는 강착 원반을 한 칸 크기로 그린다. @override @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트 @param {number} x 셀의 왼쪽 X 좌표 @param {number} y 셀의 위쪽 Y 좌표 @param {number} cellSize 셀 크기 @returns {void} */
        draw(drawingContext, x, y, cellSize) {
            const radius = cellSize * 0.29;
            drawingContext.save();
            drawingContext.translate(x + cellSize / 2, y + cellSize / 2); drawingContext.rotate(-0.32);
            const disk = drawingContext.createRadialGradient(0, 0, radius * 0.35, 0, 0, radius * 1.55);
            disk.addColorStop(0, 'rgba(8, 12, 25, 0)'); disk.addColorStop(0.48, 'rgba(255, 241, 193, 0.96)'); disk.addColorStop(0.66, 'rgba(255, 166, 78, 0.86)'); disk.addColorStop(1, 'rgba(92, 74, 166, 0)');
            drawingContext.fillStyle = disk; drawingContext.beginPath(); drawingContext.ellipse(0, 0, radius * 1.6, radius * 0.59, 0, 0, Math.PI * 2); drawingContext.fill();
            drawingContext.strokeStyle = 'rgba(255, 224, 139, 0.82)'; drawingContext.lineWidth = cellSize * 0.055; drawingContext.beginPath(); drawingContext.ellipse(0, 0, radius * 1.32, radius * 0.46, 0, Math.PI * 0.08, Math.PI * 1.08); drawingContext.stroke();
            drawingContext.rotate(0.32);
            const rim = drawingContext.createRadialGradient(-radius * 0.2, -radius * 0.25, radius * 0.12, 0, 0, radius * 1.05);
            rim.addColorStop(0, '#0a0d1b'); rim.addColorStop(0.64, '#05060d'); rim.addColorStop(0.8, '#30205e'); rim.addColorStop(1, '#9a76e8');
            drawingContext.fillStyle = rim; drawingContext.beginPath(); drawingContext.arc(0, 0, radius, 0, Math.PI * 2); drawingContext.fill();
            drawingContext.strokeStyle = '#c2a7ff'; drawingContext.lineWidth = cellSize * 0.04; drawingContext.stroke();
            drawPuyoEyes(drawingContext, radius * 0.72, radius * 0.08); drawingContext.restore();
        }
    }

    /**
     * 등록된 예고뿌요 클래스 목록이다. 큰 단위부터 배치해야 공격량을 기존 규칙대로 분해한다.
     * 새 예고뿌요는 이 배열에 클래스를 추가해 등록한다.
     * @type {Array<new () => WarningPuyo>}
     */
    const WARNING_PUYO_CLASSES = [GalaxyWarningPuyo, BlackHoleWarningPuyo, NeutronStarWarningPuyo, SunWarningPuyo, StarWarningPuyo, RockWarningPuyo, DropWarningPuyo, TinyWarningPuyo];

    /**
     * 현재 변환 좌표를 기준으로 뿌요의 귀여운 두 눈을 그린다.
     * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
     * @param {number} radius 뿌요 본체의 반지름
     * @param {number} offsetY 눈의 세로 보정값
     * @returns {void}
     */
    function drawPuyoEyes(drawingContext, radius, offsetY = 0) {
        drawingContext.fillStyle = '#fff';
        drawingContext.beginPath();
        drawingContext.arc(-radius * 0.28, -radius * 0.12 + offsetY, radius * 0.19, 0, Math.PI * 2);
        drawingContext.arc(radius * 0.28, -radius * 0.12 + offsetY, radius * 0.19, 0, Math.PI * 2);
        drawingContext.fill();
        drawingContext.fillStyle = '#172031';
        drawingContext.beginPath();
        drawingContext.arc(-radius * 0.25, -radius * 0.08 + offsetY, radius * 0.08, 0, Math.PI * 2);
        drawingContext.arc(radius * 0.31, -radius * 0.08 + offsetY, radius * 0.08, 0, Math.PI * 2);
        drawingContext.fill();
    }

    /**
     * 공격량을 단위별 예고뿌요 객체 목록으로 변환한다.
     * @param {number} amount 예고할 방해뿌요 수
     * @returns {WarningPuyo[]} 왼쪽부터 그릴 예고뿌요 객체
     */
    function warningUnits(amount) {
        const units = [];
        WARNING_PUYO_CLASSES.forEach((WarningPuyoType) => {
            const count = Math.floor(amount / WarningPuyoType.unitCount);
            amount %= WarningPuyoType.unitCount;
            for (let index = 0; index < count && units.length < 6; index += 1) units.push(new WarningPuyoType());
        });
        return units;
    }

    /**
     * 예고뿌요 객체 목록을 그린다. 작은 낱개는 자신의 배치 메소드를 통해 조금 더 촘촘하게 표시한다.
     * @param {number} x 좌측 X 좌표
     * @param {number} y 위쪽 Y 좌표
     * @param {WarningPuyo[]} units 예고뿌요 객체 목록
     * @returns {void}
     */
    function drawWarningUnits(x, y, units) {
        const sameTypeCounts = new Map();
        units.forEach((unit, index) => {
            const sameTypeIndex = sameTypeCounts.get(unit.type) || 0;
            sameTypeCounts.set(unit.type, sameTypeIndex + 1);
            unit.draw(context, unit.getDisplayX(x, index, sameTypeIndex), y, CELL);
        });
    }

    /**
     * 폭발한 뿌요 위치에 확산 광선 효과를 그린다.
     * @param {number} x 셀의 왼쪽 X 좌표
     * @param {number} y 셀의 위쪽 Y 좌표
     * @param {{color:string}} puyo 폭발한 뿌요 정보
     * @param {number} progress 0부터 1까지의 애니메이션 진행률
     * @returns {void}
     */
    function drawExplosionEffect(x, y, puyo, progress) {
        const centerX = x + CELL / 2;
        const centerY = y + CELL / 2;
        context.save();
        context.globalAlpha = 1 - progress;
        context.strokeStyle = puyo.color === 'garbage' ? '#e9fbff' : PALETTE[puyo.color];
        context.lineWidth = 3;
        for (let ray = 0; ray < 8; ray += 1) {
            const angle = (Math.PI * 2 * ray) / 8;
            const inner = CELL * 0.14 + progress * CELL * 0.12;
            const outer = CELL * (0.28 + progress * 0.44);
            context.beginPath();
            context.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
            context.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
            context.stroke();
        }
        context.fillStyle = '#fff';
        context.beginPath();
        context.arc(centerX, centerY, CELL * (0.3 + progress * 0.2), 0, Math.PI * 2);
        context.fill();
        context.restore();
    }

    /**
     * 현재 진행 중인 에너지 전달 효과를 캔버스에 그린다.
     * @returns {void}
     */
    function drawEnergyTransfers() {
        const energyTransfers = getEnergyTransfers();
        if (!energyTransfers) return;
        energyTransfers.forEach((energy) => {
            const segment = energy.route[energy.routeIndex] || energy.route[energy.route.length - 1];
            let x = energy.position.x;
            let y = energy.position.y;
            let scale = 1;
            let alpha = 1;
            if (energy.fading) {
                const progress = Math.min(1, energy.elapsed / 150);
                scale = 1 + progress * 1.8;
                alpha = 1 - progress;
            } else {
                const progress = Math.min(1, energy.elapsed / 250);
                const start = energy.position;
                const end = segment.target;
                // 폭발 지점에서 천장으로 직행할 때는 위쪽, 내 천장 경유 후 상대 천장으로 갈 때는 아래쪽으로 휜다.
                const arc = segment.arcDirection === 'down' ? CELL * 3 : -CELL * 0.7;
                const inverse = 1 - progress;
                x = inverse * start.x + progress * end.x;
                y = inverse * start.y + progress * end.y + 4 * inverse * progress * arc;
            }
            const radius = CELL * 0.17 * scale;
            const gradient = context.createRadialGradient(x - radius * 0.35, y - radius * 0.35, 1, x, y, radius * 1.9);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.35, '#fff6a7');
            gradient.addColorStop(1, 'rgba(82, 220, 255, 0)');
            context.save();
            context.globalAlpha = alpha;
            context.fillStyle = gradient;
            context.beginPath(); context.arc(x, y, radius * 1.9, 0, Math.PI * 2); context.fill();
            context.fillStyle = '#ffffff';
            context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
            context.restore();
        });
    }

    /**
     * 폭발 중심에서 위로 올라가며 사라지는 연쇄 수 텍스트를 그린다.
     * @param {number} fieldX 필드의 왼쪽 X 좌표
     * @param {{x:number, y:number, combo:number, elapsed:number}} popup 연쇄 텍스트 정보
     * @returns {void}
     */
    function drawComboPopup(fieldX, popup) {
        const progress = popup.elapsed / 2000;
        const opacity = popup.elapsed <= 1500 ? 1 : 1 - (popup.elapsed - 1500) / 500;
        const x = fieldX + (popup.x + 0.5) * CELL;
        const y = FIELD_BOTTOM - (popup.y + 1) * CELL - progress * 42;
        context.save();
        context.globalAlpha = opacity;
        context.textAlign = 'center';
        context.font = `24px ${MESSAGE_FONT}`;
        context.lineWidth = 5;
        context.strokeStyle = '#172031';
        context.strokeText(translate('%1연쇄', popup.combo), x, y);
        context.fillStyle = '#fff3a6';
        context.fillText(translate('%1연쇄', popup.combo), x, y);
        context.restore();
    }

    /**
     * 조작 중인 뿌요에 흰색 점멸 테두리를 그린다.
     * @param {number} x 셀의 왼쪽 X 좌표
     * @param {number} y 셀의 위쪽 Y 좌표
     * @returns {void}
     */
    function drawActiveOutline(x, y) {
        const pulse = 0.35 + (Math.sin(performance.now() / 105) + 1) * 0.325;
        context.save();
        context.globalAlpha = pulse;
        context.strokeStyle = '#ffffff';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(x + CELL / 2, y + CELL / 2, CELL * 0.44, 0, Math.PI * 2);
        context.stroke();
        context.restore();
    }

    /**
     * AI가 추천한 착지 칸을 배경을 가리지 않는 테두리로 표시한다.
     * @param {PlayerState} player 표시 대상 플레이어
     * @returns {void}
     */
    function drawRecommendedPoint(player) {
        if (player !== game?.players[0] || !recommendedPoint) return;
        const { x, y } = recommendedPoint;
        if (x < 0 || x >= COLUMNS || y < 0 || y >= VISIBLE_ROWS) return;
        context.save();
        context.strokeStyle = '#ffd54f';
        context.lineWidth = 4;
        context.strokeRect(player.fieldX + x * CELL + 2, FIELD_BOTTOM - (y + 1) * CELL + 2, CELL - 4, CELL - 4);
        context.restore();
    }

    /** 피버 룰 필드 옆 베젤에 상쇄 전등 7개와 다음 피버 시간을 그린다. @param {PlayerState} player 표시 대상 @returns {void} */
    function drawFeverGauge(player) {
        if (!game?.feverRule || !player.fever) return;
        const isLeftPlayer = player === game.players[0];
        const centerX = isLeftPlayer ? player.fieldX + COLUMNS * CELL + CELL / 2 : player.fieldX - CELL / 2;
        const topY = 190;
        for (let visualIndex = 0; visualIndex < FEVER_GAUGE_MAX; visualIndex += 1) {
            const gaugeIndex = FEVER_GAUGE_MAX - 1 - visualIndex;
            const lit = gaugeIndex < player.fever.gauge;
            context.beginPath();
            context.arc(centerX, topY + visualIndex * 34, 8, 0, Math.PI * 2);
            context.fillStyle = lit ? '#ffe45c' : '#45505a';
            context.fill();
            context.strokeStyle = lit ? '#fff2a6' : '#26333d';
            context.lineWidth = 2;
            context.stroke();
        }
        context.fillStyle = '#f5fbfc';
        context.font = `17px ${MESSAGE_FONT}`;
        context.textAlign = 'center';
        context.fillText(String(player.fever.nextTime).padStart(2, '0'), centerX, topY + FEVER_GAUGE_MAX * 34 + 4);
    }

    /** 피버 전용 플레이 영역의 주황색 뒷배경 색상이다. @type {string} */
    const FEVER_PLAYER_BACKGROUND_COLOR = '#e89035';
    /** 피버 전용 플레이 영역의 뒷배경보다 더 붉은 베젤 색상이다. @type {string} */
    const FEVER_BEZEL_BACKGROUND_COLOR = '#cf5e38';
    /** 피버 중 뒤편 일반 영역 예고뿌요를 겹침이 보이도록 옮길 가로 거리다. @type {number} */
    const FEVER_NORMAL_WARNING_OFFSET_X = -8;
    /** 피버 중 뒤편 일반 영역 예고뿌요에 적용할 불투명도다. @type {number} */
    const FEVER_NORMAL_WARNING_ALPHA = 0.3;

    /** 지정 필드가 적 테마보다 우선하는 피버 배경을 써야 하는지 판별한다. @param {PlayerState} player 검사할 플레이어 @returns {boolean} 피버 배경 적용 여부 */
    function usesFeverFieldTheme(player) {
        return Boolean(game?.continuousFever || (game?.feverRule && player.fever?.active));
    }

    /** 적 테마 또는 피버 전용 테마로 필드 베젤을 그린다. @param {PlayerState} player 대상 플레이어 @param {{x:number,y:number,width:number,height:number,player?:PlayerState}} area 베젤 영역 @returns {void} */
    function drawFieldBezelBackground(player, area) {
        if (usesFeverFieldTheme(player)) {
            context.fillStyle = FEVER_BEZEL_BACKGROUND_COLOR;
            context.fillRect(area.x, area.y, area.width, area.height);
            return;
        }
        game.themeController.drawBezelBackground(context, area);
    }

    /** 적 테마 또는 피버 전용 테마로 필드 뒷배경을 그린다. @param {PlayerState} player 대상 플레이어 @param {{x:number,y:number,width:number,height:number,player?:PlayerState}} area 필드 영역 @returns {void} */
    function drawFieldPlayerBackground(player, area) {
        if (usesFeverFieldTheme(player)) {
            context.fillStyle = FEVER_PLAYER_BACKGROUND_COLOR;
            context.fillRect(area.x, area.y, area.width, area.height);
            return;
        }
        game.themeController.drawPlayerBackground(context, area);
    }

    /** 피버 룰 또는 연속 피버가 두 번째 패배 칸을 쓰는지 반환한다. @returns {boolean} 두 번째 패배 칸 사용 여부 */
    function usesSecondDefeatCell() {
        return game?.feverRule === true || game?.continuousFever === true;
    }

    /** 패배 조건 칸에 1칸 크기의 빨간 X 표시를 그린다. 뿌요보다 먼저 그려 점유 시 가려진다. @param {number} fieldX 필드 왼쪽 X 좌표 @param {boolean} [includeSecondCell=false] (3, 11) 칸도 표시할지 여부 @returns {void} */
    function drawDefeatCellMarkers(fieldX, includeSecondCell = false) {
        context.save();
        context.strokeStyle = '#ef5350';
        context.lineWidth = 5;
        [2, ...(includeSecondCell ? [3] : [])].forEach((column) => {
            const x = fieldX + column * CELL;
            const y = FIELD_BOTTOM - VISIBLE_ROWS * CELL;
            context.beginPath(); context.moveTo(x + 6, y + 6); context.lineTo(x + CELL - 6, y + CELL - 6); context.stroke();
            context.beginPath(); context.moveTo(x + CELL - 6, y + 6); context.lineTo(x + 6, y + CELL - 6); context.stroke();
        });
        context.restore();
    }

    /** 연습·연속 피버·퍼즐뿌요의 단독 플레이 화면인지 반환한다. @returns {boolean} 단독 플레이 전용 배치 사용 여부 */
    function usesSoloPlayLayout() {
        return Boolean(game && !game.tutorial && (game.practice || game.continuousFever || game.puzzle));
    }

    /** 연습·연속 피버의 중앙 점수 패널을 단독 배치로 사용할지 반환한다. @returns {boolean} 단독 점수 패널 사용 여부 */
    function usesSoloScoreLayout() {
        return Boolean(game && !game.tutorial && (game.practice || game.continuousFever));
    }

    /** 퍼즐뿌요의 오른쪽 안내 전용 영역인지 반환한다. @param {PlayerState} player 검사할 플레이어 @returns {boolean} 안내 영역 여부 */
    function isPuzzleTargetField(player) {
        return Boolean(game?.puzzle && player === game.players[1]);
    }

    /** 퍼즐뿌요를 권장 턴 수 이하로 클리어해 이번 플레이의 별을 달성했는지 반환한다. @returns {boolean} 별 달성 여부 */
    function hasPuzzleStageStar() {
        const puzzle = game?.puzzle;
        return Boolean(puzzle && game.winner === game.players[0] && puzzle.turn <= puzzle.stage.turnLimit);
    }

    /** 퍼즐뿌요 종료 안내 영역에 표시할 별 모양을 그린다. @param {number} fieldX 안내 영역의 필드 X 좌표 @returns {void} */
    function drawPuzzleStageStar(fieldX) {
        const centerX = fieldX + COLUMNS * CELL / 2;
        const centerY = FIELD_TOP + CELL * 7.65;
        context.save();
        context.beginPath();
        for (let index = 0; index < 10; index += 1) {
            const angle = -Math.PI / 2 + index * Math.PI / 5;
            const radius = index % 2 === 0 ? 25 : 11;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
        }
        context.closePath();
        context.fillStyle = '#f7c843'; context.fill();
        context.strokeStyle = '#fff3ad'; context.lineWidth = 3; context.stroke();
        context.restore();
    }

    /** 퍼즐뿌요 오른쪽 안내 영역에 클리어 조건과 현재·권장 턴 수를 그린다. @param {number} fieldX 안내 영역의 필드 X 좌표 @param {boolean} [showResultStar=false] 종료 화면의 별을 표시할지 여부 @returns {void} */
    function drawPuzzleStageStatus(fieldX, showResultStar = false) {
        const puzzle = game?.puzzle;
        if (!puzzle) return;
        const centerX = fieldX + COLUMNS * CELL / 2;
        context.textAlign = 'center'; context.fillStyle = '#f7c843'; context.font = `20px ${BUTTON_FONT}`;
        context.fillText(getPuzzleConditionText(puzzle.stage), centerX, FIELD_TOP + CELL * 5.65);
        context.fillStyle = '#d8f2f5'; context.font = `17px ${MESSAGE_FONT}`;
        context.fillText(translate('현재 턴 %1 / %2', puzzle.turn, puzzle.stage.turnLimit), centerX, FIELD_TOP + CELL * 6.55);
        if (showResultStar && hasPuzzleStageStar()) drawPuzzleStageStar(fieldX);
    }

    /**
     * 한 플레이어의 필드, 예고줄, 낙하와 폭발 효과를 그린다.
     * @param {PlayerState} player 그릴 플레이어
     * @param {PlayerState} opponent 예고 공격량을 제공할 상대
     * @returns {void}
     */
    function drawField(player, opponent) {
        const x = player.fieldX;
        const isDefeated = game.ending?.loser === player;
        const puzzleTargetField = isPuzzleTargetField(player);
        drawFieldBezelBackground(player, { x: x - CELL, y: FIELD_TOP - CELL, width: CELL * 8, height: CELL * 14, player });
        drawFieldPlayerBackground(player, { x, y: FIELD_TOP, width: CELL * 6, height: CELL * 12, player });
        if (player.allClearEffectElapsed > 0) {
            context.save();
            context.fillStyle = '#ffd54f';
            context.globalAlpha = 0.5 * (player.allClearEffectElapsed / ALL_CLEAR_EFFECT_DURATION);
            context.fillRect(x, FIELD_TOP, CELL * 6, CELL * 12);
            context.restore();
        }
        if (!puzzleTargetField) {
            context.strokeStyle = 'rgba(162, 220, 235, 0.14)';
            context.lineWidth = 1;
            for (let index = 0; index <= COLUMNS; index += 1) { context.beginPath(); context.moveTo(x + index * CELL, FIELD_TOP); context.lineTo(x + index * CELL, FIELD_BOTTOM); context.stroke(); }
            for (let index = 0; index <= VISIBLE_ROWS; index += 1) { context.beginPath(); context.moveTo(x, FIELD_TOP + index * CELL); context.lineTo(x + CELL * 6, FIELD_TOP + index * CELL); context.stroke(); }
            drawDefeatCellMarkers(x, usesSecondDefeatCell());
            const fallingTargets = new Set((player.gravityAnimation?.falling || []).map((puyo) => `${puyo.x},${puyo.toY}`));
            // 패배 연출이 아닐 때 보이는 필드의 고정 뿌요를 한 칸씩 그린다.
            for (let y = 0; !isDefeated && y < VISIBLE_ROWS; y += 1) for (let column = 0; column < COLUMNS; column += 1) {
                const puyo = player.board[y][column];
                if (puyo && !fallingTargets.has(`${column},${y}`)) drawPuyo(x + column * CELL, FIELD_BOTTOM - (y + 1) * CELL, puyo);
            }
            // 낙하 중인 뿌요는 고정 뿌요 대신 보간된 위치에 그린다.
            if (!isDefeated && player.gravityAnimation) {
                const animation = player.gravityAnimation;
                const progress = Math.min(1, animation.elapsed / animation.duration);
                const eased = progress * progress;
                animation.falling.forEach((puyo) => {
                    const y = puyo.fromY + (puyo.toY - puyo.fromY) * eased;
                    if (y < VISIBLE_ROWS) drawPuyo(x + puyo.x * CELL, FIELD_BOTTOM - (y + 1) * CELL, puyo.color);
                });
            }
            // 조작 중인 뿌요 쌍은 필드 위에 별도로 표시한다.
            if (!isDefeated && player.active) activeRenderCells(player.active).forEach((cell) => {
                if (cell.y < VISIBLE_ROWS && cell.y + 1 > 0) {
                    const cellX = x + cell.x * CELL;
                    const cellY = FIELD_BOTTOM - (cell.y + 1) * CELL;
                    drawPuyo(cellX, cellY, cell.color);
                    drawActiveOutline(cellX, cellY);
                }
            });
            drawRecommendedPoint(player);
            if (isDefeated) drawDefeatAnimation(player);
            if (isDefeated) drawFieldBezelForeground(player);
        }
        for (let index = 0; index < COLUMNS; index += 1) {
            context.fillStyle = '#0a1d29'; context.fillRect(x + index * CELL + 3, FIELD_TOP - CELL + 3, CELL - 6, CELL - 6);
            context.strokeStyle = 'rgba(176, 232, 244, 0.25)'; context.strokeRect(x + index * CELL + 3, FIELD_TOP - CELL + 3, CELL - 6, CELL - 6);
        }
        const displayedWarnings = warningUnits(warningAmount(player, opponent));
        // 피버 중에는 보존된 일반 필드의 DAMAGE 예고를 흐리게 뒤에 먼저 그린다. 피버 필드 예고는 현행 불투명도로 앞에 그린다.
        if (game?.feverRule && player.fever?.active && player.normalDamage > 0) {
            context.save();
            context.globalAlpha = FEVER_NORMAL_WARNING_ALPHA;
            drawWarningUnits(x + FEVER_NORMAL_WARNING_OFFSET_X, FIELD_TOP - CELL, warningUnits(player.normalDamage));
            context.restore();
        }
        // 기본 룰·연습·연속 피버의 실제 플레이 중 나타난 예고뿌요만 갤러리에 공개한다.
        if (canUnlockGalleryWarningInCurrentGame()) displayedWarnings.forEach((unit) => unlockGalleryWarning(unit.type));
        drawWarningUnits(x, FIELD_TOP - CELL, displayedWarnings);
        drawFeverGauge(player);
        if (game?.feverRule && player.fever?.active) {
            context.fillStyle = player.fever.leftTime <= 10000 ? '#ef5350' : '#f5fbfc';
            context.font = `28px ${MESSAGE_FONT}`;
            context.textAlign = 'center';
            context.fillText(String(Math.ceil(player.fever.leftTime / 1000)), x + COLUMNS * CELL / 2, FIELD_TOP + 31);
        }
        if (player.effects) {
            const progress = Math.min(1, player.effects.elapsed / player.effects.duration);
            player.effects.cells.forEach((puyo) => drawExplosionEffect(x + puyo.x * CELL, FIELD_BOTTOM - (puyo.y + 1) * CELL, puyo, progress));
        }
        player.comboPopups.forEach((popup) => drawComboPopup(x, popup));
        if (!(usesSoloPlayLayout() && player === game.players[1])) {
            context.fillStyle = '#e7f8fa'; context.font = `18px ${MESSAGE_FONT}`; context.textAlign = 'left';
            context.fillText(player.name, x, 54);
        }
        if (puzzleTargetField) drawPuzzleStageStatus(x);
    }

    /** 패배 연출 중 움직이는 뿌요보다 앞에 고정 베젤을 다시 그린다. @param {PlayerState} player 대상 플레이어 @returns {void} */
    function drawFieldBezelForeground(player) {
        const x = player.fieldX;
        const bezel = { x: x - CELL, y: FIELD_TOP - CELL, width: CELL * 8, height: CELL * 14 };
        context.save();
        context.beginPath();
        context.rect(x - CELL, FIELD_TOP - CELL, CELL * 8, CELL);
        context.rect(x - CELL, FIELD_TOP, CELL, CELL * VISIBLE_ROWS);
        context.rect(x + CELL * COLUMNS, FIELD_TOP, CELL, CELL * VISIBLE_ROWS);
        context.clip();
        drawFieldBezelBackground(player, bezel);
        context.restore();
    }

    /**
     * 패배 필드에서 하단 베젤과 모든 뿌요가 아래로 떨어지는 모습을 그린다.
     * @param {PlayerState} player 패배한 플레이어
     * @returns {void}
     */
    function drawDefeatAnimation(player) {
        const animation = game.ending;
        const progress = Math.min(1, animation.elapsed / animation.duration);
        // 베젤과 뿌요가 캔버스 밖으로 충분히 빠져나간 것처럼 보이도록 5줄을 더 떨어뜨린다.
        const distance = progress * progress * (HEIGHT - FIELD_TOP + CELL + CELL * DEFEAT_EXTRA_FALL_ROWS);
        const opacity = 1 - progress * 0.45;
        const x = player.fieldX;
        context.save();
        context.globalAlpha = opacity;
        animation.fallingPuyos.forEach((puyo) => {
            const y = FIELD_BOTTOM - (puyo.y + 1) * CELL + distance;
            if (y < HEIGHT) drawPuyo(x + puyo.x * CELL, y, puyo.color);
        });
        // 무너지는 베젤은 낙하 중인 숨김 영역 방해뿌요보다 앞에 보인다.
        drawFieldBezelBackground(player, { x: x - CELL, y: FIELD_BOTTOM + distance, width: CELL * 8, height: CELL, player });
        context.restore();
    }

    /**
     * 적의 현재 필드와 공격 상태가 초상화의 위기 표정 조건에 해당하는지 판별한다.
     * @param {PlayerState} enemy 적 플레이어
     * @param {PlayerState|undefined} opponent 적의 상대 플레이어
     * @returns {boolean} 위기 상태 여부
     */
    function isEnemyInCrisis(enemy, opponent) {
        const occupiedCells = enemy.board
            .slice(0, VISIBLE_ROWS)
            .reduce((count, row) => count + row.filter((cell) => cell !== null).length, 0);
        return occupiedCells >= COLUMNS * VISIBLE_ROWS / 2 || enemy.damage + (opponent?.attack ?? 0) >= 30;
    }

    /**
     * 적의 현재 필드와 공격 상태에 맞는 중앙 초상화 표정을 결정한다.
     * @param {PlayerState} enemy 적 플레이어
     * @param {PlayerState} opponent 적의 상대 플레이어
     * @returns {'normal'|'crisis'|'defeated'} 중앙 초상화 표정
     */
    function getEnemyPortraitExpression(enemy, opponent) {
        // 게임 종료 중 패배한 적은 최우선으로 패배 표정을 표시한다.
        if (game.ending?.loser === enemy) return 'defeated';
        // 필드 점유율 또는 예정 공격량이 높으면 위기 표정을 표시한다.
        if (isEnemyInCrisis(enemy, opponent)) return 'crisis';
        return 'normal';
    }

    /**
   * 다음 뿌요, 단탈리온 이미지와 중앙 점수 패널을 그린다.
     * @returns {void}
     */
    function drawCenter() {
        game.themeController.drawCenterBackground(context, { x: 450, y: 0, width: 380, height: HEIGHT });
        context.textAlign = 'center';
        const nextAreaY = 50;
        const left = game.players[0]; const right = game.players[1];
        if (usesSoloPlayLayout()) {
            const x = 482;
            const width = 316;
            context.fillStyle = '#0b202c'; context.fillRect(x, nextAreaY, width, 150);
            context.strokeStyle = '#ef8aa0'; context.lineWidth = 2; context.strokeRect(x, nextAreaY, width, 150);
            context.fillStyle = '#ef8aa0'; context.font = `13px ${MESSAGE_FONT}`; context.fillText(`${left.name} NEXT`, x + width / 2, nextAreaY + 23);
            left.nextPairs.slice(0, 4).forEach((pair, pairIndex) => {
                const pairX = x + 22 + pairIndex * 76;
                drawPuyo(pairX, nextAreaY + 43, pair[1], 0.68);
                drawPuyo(pairX, nextAreaY + 88, pair[0], 0.68);
                if (pairIndex < 3) {
                    context.fillStyle = 'rgba(216, 242, 245, 0.4)'; context.fillRect(x + 76 + pairIndex * 76, nextAreaY + 38, 1, 92);
                }
            });
        } else {
            [
                { player: left, x: 482, color: '#ef8aa0' },
                { player: right, x: 650, color: '#6bbce8' }
            ].forEach(({ player, x, color }, playerIndex) => {
                context.fillStyle = '#0b202c'; context.fillRect(x, nextAreaY, 148, 150);
                context.strokeStyle = color; context.lineWidth = 2; context.strokeRect(x, nextAreaY, 148, 150);
                context.fillStyle = color; context.font = `13px ${MESSAGE_FONT}`; context.fillText(`${player.name} NEXT`, x + 74, nextAreaY + 23);
                const displayedPairs = playerIndex === 1 ? [...player.nextPairs].reverse() : player.nextPairs;
                displayedPairs.forEach((pair, pairIndex) => {
                    const pairX = x + 21 + pairIndex * 70;
                    drawPuyo(pairX, nextAreaY + 43, pair[1], 0.68);
                    drawPuyo(pairX, nextAreaY + 88, pair[0], 0.68);
                    context.fillStyle = 'rgba(216, 242, 245, 0.4)'; context.fillRect(x + 74, nextAreaY + 38, 1, 92);
                });
            });
        }
        if (game.continuousFever && game.fever) {
            context.fillStyle = game.fever.leftTime <= 10000 ? '#ef5350' : '#f5fbfc'; context.font = `48px ${MESSAGE_FONT}`;
            context.fillText(String(Math.ceil(game.fever.leftTime / 1000)), WIDTH / 2, 396);
        } else {
            right.controller.drawPortrait(context, WIDTH / 2, 380, 0.86, getEnemyPortraitExpression(right, left));
        }
        const scores = usesSoloScoreLayout()
            ? [{ player: left, x: 488, width: 304, color: '#ef8aa0' }]
            : [
                { player: left, x: 488, width: 146, color: '#ef8aa0' },
                { player: right, x: 646, width: 146, color: '#6bbce8' }
            ];
        scores.forEach(({ player, x, width, color }) => {
            context.fillStyle = '#0b202c'; context.fillRect(x, 492, width, 92);
            context.strokeStyle = color; context.lineWidth = 2; context.strokeRect(x, 492, width, 92);
            context.fillStyle = color; context.font = `13px ${MESSAGE_FONT}`; context.fillText(player.name, x + width / 2, 516);
            context.fillStyle = '#f5fbfc'; context.font = `22px ${MESSAGE_FONT}`; context.fillText(formatPoint(player.point), x + width / 2, 557);
        });
    }

    /** 가상 컨트롤러를 표시할 수 있는 게임 진행 상태인지 확인한다. @returns {boolean} */
    function shouldShowVirtualController() {
        return Boolean(game && !game.tutorial && game.running && !game.paused && !game.ending && game.countdown <= 0 && store.settings.virtualController !== 'none');
    }

    /** 선택된 가상 컨트롤러의 렌더링·입력 배율을 반환한다. @returns {number} */
    function getVirtualControllerScale() { return store.settings.virtualController === 'large' ? 1.5 : 1; }

    /** 선택된 크기에 맞는 가상 컨트롤러의 공통 그리기·입력 배치를 반환한다. @returns {{dpad:{x:number,y:number,size:number},actions:{z:{x:number,y:number},x:{x:number,y:number},escape:{x:number,y:number}},scale:number}} */
    function getVirtualControllerLayout() {
        const large = store.settings.virtualController === 'large';
        return {
            dpad: {
                x: VIRTUAL_DPAD.x + (large ? VIRTUAL_LARGE_DPAD_OFFSET.x : 0),
                y: VIRTUAL_DPAD.y + (large ? VIRTUAL_LARGE_DPAD_OFFSET.y : 0),
                size: VIRTUAL_DPAD.size
            },
            actions: large ? VIRTUAL_LARGE_ACTION_BUTTONS : VIRTUAL_ACTION_BUTTONS,
            scale: getVirtualControllerScale()
        };
    }

    /** 가상 방향 패드의 한 방향 버튼을 그린다. @param {number} x X 좌표 @param {number} y Y 좌표 @param {string} label 표시 문자 @param {boolean} pressed 눌림 여부 @param {number} scale 표시 배율 @returns {void} */
    function drawVirtualDirectionButton(x, y, label, pressed, scale) {
        const size = VIRTUAL_DPAD.size * scale;
        context.fillStyle = pressed ? 'rgba(247, 200, 67, 0.88)' : 'rgba(11, 32, 44, 0.78)';
        context.fillRect(x, y, size, size);
        context.strokeStyle = pressed ? '#fff6c7' : '#9cc9d2'; context.lineWidth = 2; context.strokeRect(x, y, size, size);
        context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = pressed ? '#263238' : '#f5fbfc'; context.font = `${28 * scale}px ${BUTTON_FONT}`;
        context.fillText(label, x + size / 2, y + size / 2 + 1);
    }

    /** 가상 조작 버튼을 그린다. @param {number} x 중심 X 좌표 @param {number} y 중심 Y 좌표 @param {string} label 표시 문자 @param {boolean} pressed 눌림 여부 @param {number} scale 표시 배율 @returns {void} */
    function drawVirtualActionButton(x, y, label, pressed, scale) {
        context.beginPath(); context.arc(x, y, VIRTUAL_ACTION_BUTTONS.radius * scale, 0, Math.PI * 2);
        context.fillStyle = pressed ? 'rgba(247, 200, 67, 0.92)' : 'rgba(86, 48, 104, 0.85)'; context.fill();
        context.strokeStyle = pressed ? '#fff6c7' : '#e5c7f5'; context.lineWidth = 2; context.stroke();
        context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#ffffff'; context.font = `${(label === 'ESC' ? 14 : 23) * scale}px ${BUTTON_FONT}`;
        context.fillText(label, x, y + 1);
    }

    /** 터치 조작이 가능한 가상 컨트롤러를 게임 화면 위에 그린다. @returns {void} */
    function drawVirtualController() {
        const { dpad, actions, scale } = getVirtualControllerLayout();
        const { x, y, size: baseSize } = dpad; const size = baseSize * scale;
        drawVirtualDirectionButton(x - size / 2, y - size * 1.5, '↑', virtualDirectionInput.arrowup, scale);
        drawVirtualDirectionButton(x - size * 1.5, y - size / 2, '←', virtualDirectionInput.arrowleft, scale);
        drawVirtualDirectionButton(x + size / 2, y - size / 2, '→', virtualDirectionInput.arrowright, scale);
        drawVirtualDirectionButton(x - size / 2, y + size / 2, '↓', virtualDirectionInput.arrowdown, scale);
        drawVirtualDirectionButton(x - size * 1.5, y + size / 2, '↙', virtualDirectionInput.arrowleft && virtualDirectionInput.arrowdown, scale);
        drawVirtualDirectionButton(x + size / 2, y + size / 2, '↘', virtualDirectionInput.arrowright && virtualDirectionInput.arrowdown, scale);
        const pressed = new Set([...virtualPointerButtons.values()].flat());
        drawVirtualActionButton(actions.z.x, actions.z.y, 'Z', pressed.has('z'), scale);
        drawVirtualActionButton(actions.x.x, actions.x.y, 'X', pressed.has('x'), scale);
        drawVirtualActionButton(actions.escape.x, actions.escape.y, 'ESC', pressed.has('escape'), scale);
        context.textBaseline = 'alphabetic';
    }

    /** 가상 컨트롤러의 모든 누름 상태를 해제한다. @returns {void} */
    function resetVirtualControllerInput() {
        virtualDirectionInput = { arrowleft: false, arrowright: false, arrowup: false, arrowdown: false };
        virtualPointerButtons.clear();
        virtualHorizontalHoldElapsed = 0;
        virtualHorizontalRepeatElapsed = 0;
    }

    /** 게임패드에서 내부 키 입력 처리기로 전달할 최소 키보드 이벤트를 만든다. @param {string} key 키 이름 @returns {{key:string,repeat:boolean,preventDefault:()=>void}} */
    function createGamepadKeyboardEvent(key) {
        return { key, repeat: false, preventDefault: () => {} };
    }

    /** 게임패드 버튼이 눌린 상태인지 확인한다. @param {Gamepad} gamepad 게임패드 @param {number} index 버튼 번호 @returns {boolean} */
    function isGamepadButtonPressed(gamepad, index) {
        const button = gamepad.buttons?.[index];
        return Boolean(button?.pressed || (typeof button?.value === 'number' && button.value >= GAMEPAD_STICK_DEAD_ZONE));
    }

    /** 현재 화면에서 스틱의 하단 대각선 조합을 함께 처리해야 하는지 확인한다. @returns {boolean} */
    function canUseGamepadDownDiagonal() {
        return Boolean(game && game.running && !game.paused && !game.ending && game.countdown <= 0);
    }

    /** 게임패드 왼쪽 스틱 상태를 게임 내부 방향키 상태로 변환한다. @param {Gamepad} gamepad 게임패드 @returns {Set<string>} */
    function getGamepadDirectionKeys(gamepad) {
        const axisX = Number(gamepad.axes?.[0]) || 0;
        const axisY = Number(gamepad.axes?.[1]) || 0;
        const horizontal = axisX <= -GAMEPAD_STICK_DEAD_ZONE ? 'arrowleft' : axisX >= GAMEPAD_STICK_DEAD_ZONE ? 'arrowright' : null;
        const vertical = axisY <= -GAMEPAD_STICK_DEAD_ZONE ? 'arrowup' : axisY >= GAMEPAD_STICK_DEAD_ZONE ? 'arrowdown' : null;
        if (!horizontal || !vertical) return new Set([horizontal || vertical].filter(Boolean));
        // 실제 게임에서는 하단 대각선을 빠른 하강과 좌우 이동의 동시 입력으로 처리한다.
        if (vertical === 'arrowdown' && canUseGamepadDownDiagonal()) return new Set([horizontal, vertical]);
        // 메뉴와 그 밖의 화면에서는 대각선이 한 번에 둘 이상의 메뉴 동작을 일으키지 않게 큰 축 하나만 사용한다.
        return new Set([Math.abs(axisX) >= Math.abs(axisY) ? horizontal : vertical]);
    }

    /** 게임패드가 해제되거나 연결이 끊겼을 때 게임패드가 누르던 방향키만 해제한다. @returns {void} */
    function resetGamepadInput() {
        try {
            gamepadDirectionKeys.forEach((key) => handleKeyup(createGamepadKeyboardEvent(key)));
            gamepadDirectionKeys.clear();
            gamepadActionInput = { z: false, x: false, enter: false, escape: false };
        } catch (error) {
            console.error('게임패드 입력을 해제하지 못했습니다.', error);
        }
    }

    /** 현재 연결된 첫 게임패드의 입력을 키보드 입력으로 반영한다. @param {boolean} suppressActions 초기 인식 시 이미 누르고 있던 버튼은 실행하지 않을지 여부 @returns {void} */
    function updateGamepadInput(suppressActions = false) {
        try {
            if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
                resetGamepadInput();
                return;
            }
            const gamepads = navigator.getGamepads();
            const gamepad = Array.from(gamepads || []).find((candidate) => candidate && candidate.connected !== false);
            if (!gamepad) {
                resetGamepadInput();
                return;
            }
            const nextDirections = getGamepadDirectionKeys(gamepad);
            gamepadDirectionKeys.forEach((key) => {
                if (!nextDirections.has(key)) handleKeyup(createGamepadKeyboardEvent(key));
            });
            nextDirections.forEach((key) => {
                if (!gamepadDirectionKeys.has(key)) handleKeydown(createGamepadKeyboardEvent(key));
            });
            gamepadDirectionKeys = nextDirections;

            const nextActions = {
                z: isGamepadButtonPressed(gamepad, 0) || isGamepadButtonPressed(gamepad, 4),
                x: isGamepadButtonPressed(gamepad, 1) || isGamepadButtonPressed(gamepad, 5),
                enter: isGamepadButtonPressed(gamepad, 2),
                escape: isGamepadButtonPressed(gamepad, 3)
            };
            if (!suppressActions) {
                Object.entries(nextActions).forEach(([key, pressed]) => {
                    if (pressed && !gamepadActionInput[key]) handleKeydown(createGamepadKeyboardEvent(key));
                });
            }
            gamepadActionInput = nextActions;
        } catch (error) {
            console.error('게임패드 입력을 처리하지 못했습니다.', error);
        }
    }

    /** 초기화 시 Gamepad API 지원 여부와 첫 게임패드 상태를 안전하게 확인한다. @returns {void} */
    function initializeGamepadInput() {
        try {
            if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
            updateGamepadInput(true);
        } catch (error) {
            console.error('Gamepad API를 초기화하지 못했습니다.', error);
        }
    }

    /** 포인터별 누름 상태를 합쳐 가상 방향 입력을 갱신한다. @returns {void} */
    function refreshVirtualDirectionInput() {
        const previous = virtualDirectionInput;
        const next = { arrowleft: false, arrowright: false, arrowup: false, arrowdown: false };
        virtualPointerButtons.forEach((buttons) => buttons.forEach((button) => {
            if (Object.hasOwn(next, button)) next[button] = true;
        }));
        virtualDirectionInput = next;
        if ((!previous.arrowleft && next.arrowleft) || (!previous.arrowright && next.arrowright)) {
            virtualHorizontalHoldElapsed = 0;
            virtualHorizontalRepeatElapsed = 0;
            const player = game?.players[0];
            if (shouldShowVirtualController() && player?.phase === 'control') {
                if (!previous.arrowleft && next.arrowleft) moveActive(player, -1, 0);
                if (!previous.arrowright && next.arrowright) moveActive(player, 1, 0);
            }
        }
        if (!next.arrowleft && !next.arrowright) {
            virtualHorizontalHoldElapsed = 0;
            virtualHorizontalRepeatElapsed = 0;
        }
    }

    /** 캔버스 좌표에서 눌린 가상 컨트롤러 버튼을 구한다. @param {number} x X 좌표 @param {number} y Y 좌표 @returns {string[]} */
    function getVirtualControllerButtonsAt(x, y) {
        const buttons = [];
        const { dpad, actions, scale } = getVirtualControllerLayout();
        const { x: centerX, y: centerY } = dpad;
        const size = dpad.size * scale;
        const inButton = (left, top) => x >= left && x < left + size && y >= top && y < top + size;
        if (inButton(centerX - size / 2, centerY - size * 1.5)) buttons.push('arrowup');
        if (inButton(centerX - size * 1.5, centerY - size / 2)) buttons.push('arrowleft');
        if (inButton(centerX + size / 2, centerY - size / 2)) buttons.push('arrowright');
        if (inButton(centerX - size / 2, centerY + size / 2)) buttons.push('arrowdown');
        if (inButton(centerX - size * 1.5, centerY + size / 2)) buttons.push('arrowleft', 'arrowdown');
        if (inButton(centerX + size / 2, centerY + size / 2)) buttons.push('arrowright', 'arrowdown');
        Object.entries(actions).forEach(([button, value]) => {
            if ((x - value.x) ** 2 + (y - value.y) ** 2 <= (VIRTUAL_ACTION_BUTTONS.radius * scale) ** 2) buttons.push(button);
        });
        return buttons;
    }

    /** 가상 버튼의 한 번 누름 동작을 처리한다. @param {string} button 버튼 식별자 @returns {void} */
    function triggerVirtualButton(button) {
        if (!shouldShowVirtualController()) return;
        if (button === 'escape') {
            resetVirtualControllerInput();
            game.paused = true;
            pauseMenuFocus = 0;
            pauseBackgroundMusic();
            return;
        }
        const player = game.players[0];
        if (player.phase !== 'control') return;
        if (button === 'arrowup' || button === 'x') rotateActive(player, 1);
        else if (button === 'z') rotateActive(player, -1);
    }

    /** 포인터 이벤트를 가상 컨트롤러 입력으로 바꾼다. @param {PointerEvent} event 포인터 이벤트 @returns {void} */
    function updateVirtualPointer(event) {
        if (!shouldShowVirtualController()) return;
        const { x, y } = getCanvasEventCoordinates(event);
        const pointerId = Number.isFinite(event.pointerId) ? event.pointerId : 0;
        const previous = virtualPointerButtons.get(pointerId) || [];
        const buttons = getVirtualControllerButtonsAt(x, y);
        if (buttons.length) virtualPointerButtons.set(pointerId, buttons);
        else virtualPointerButtons.delete(pointerId);
        refreshVirtualDirectionInput();
        buttons.filter((button) => !previous.includes(button)).forEach(triggerVirtualButton);
        if (buttons.length && event.cancelable) event.preventDefault();
    }

    /** 가상 컨트롤러 포인터 누름을 처리한다. @param {PointerEvent} event 포인터 이벤트 @returns {void} */
    function handleVirtualPointerDown(event) {
        updateVirtualPointer(event);
        if (virtualPointerButtons.has(event.pointerId) && canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    }

    /** 가상 컨트롤러 포인터 이동을 처리한다. @param {PointerEvent} event 포인터 이벤트 @returns {void} */
    function handleVirtualPointerMove(event) { updateVirtualPointer(event); }

    /** 가상 컨트롤러 포인터 해제를 처리한다. @param {PointerEvent} event 포인터 이벤트 @returns {void} */
    function handleVirtualPointerUp(event) {
        virtualPointerButtons.delete(event.pointerId);
        refreshVirtualDirectionInput();
    }

    /**
     * 종료 화면에서 비어 있는 플레이 영역과 각 플레이어의 결과를 그린다.
     * @param {PlayerState} player 결과를 표시할 플레이어
     * @returns {void}
     */
    function drawResultField(player) {
        const x = player.fieldX;
        const won = player === game.winner;
        const puzzleTargetField = isPuzzleTargetField(player);
        const soloTargetField = usesSoloPlayLayout() && player === game.players[1];
        game.themeController.drawBezelBackground(context, { x: x - CELL, y: FIELD_TOP - CELL, width: CELL * 8, height: CELL * 14, player });
        game.themeController.drawPlayerBackground(context, { x, y: FIELD_TOP, width: CELL * 6, height: CELL * 12, player });
        context.textAlign = 'center';
        context.font = `36px ${TITLE_FONT}`;
        if (!game.puzzle && (!game.practice || !won)) {
            context.fillStyle = won ? '#f7c843' : '#d8f2f5';
            context.fillText(translate(won ? '승리' : '패배'), x + CELL * 3, FIELD_TOP + CELL * 6.4);
        }
        if (!puzzleTargetField && !soloTargetField) {
            context.fillStyle = '#d8f2f5'; context.font = `16px ${MESSAGE_FONT}`;
            context.fillText(translate('최종 점수 %1', formatIntegerPoint(player.point)), x + CELL * 3, FIELD_TOP + CELL * 7.15);
            if (game.puzzle) {
                context.fillStyle = '#f7c843'; context.font = `17px ${MESSAGE_FONT}`;
                context.fillText(translate('퍼즐뿌요'), x + CELL * 3, FIELD_TOP + CELL * 7.75);
            } else if (game.practice) {
                context.fillStyle = '#f7c843'; context.font = `15px ${MESSAGE_FONT}`;
                context.fillText(translate(game.continuousFever ? '연속 피버' : DIFFICULTIES[game.difficulty].name), x + CELL * 3, FIELD_TOP + CELL * 7.75);
            }
        }
        if (!(usesSoloPlayLayout() && player === game.players[1])) {
            context.fillStyle = '#e7f8fa'; context.font = `18px ${MESSAGE_FONT}`; context.textAlign = 'left';
            context.fillText(player.name, x, 54);
        }
        if (puzzleTargetField) drawPuzzleStageStatus(x, true);
    }

    /**
     * 종료 버튼만 있는 중앙 영역을 그린다.
     * @returns {void}
     */
    function drawResultCenter(showExitButton = true) {
        game.themeController.drawCenterBackground(context, { x: 450, y: 0, width: 380, height: HEIGHT });
        context.fillStyle = '#d8f2f5'; context.textAlign = 'center'; context.font = `42px ${TITLE_FONT}`; context.fillText(translate('뿌요 W'), WIDTH / 2, 95);
        const enemy = game.players[1];
        if (!game.puzzle && enemy !== game.winner) enemy.controller.drawPortrait(context, WIDTH / 2, 380, 0.86, 'defeated');
        context.fillStyle = '#d8f2f5'; context.font = `18px ${MESSAGE_FONT}`;
        context.fillText(translate('게임 시간 %1초', Math.floor(game.elapsed / 1000)), WIDTH / 2, 145);
        if (game.puzzle) {
            const cleared = game.winner === game.players[0];
            context.fillStyle = cleared ? '#f7c843' : '#ef5350'; context.font = `30px ${TITLE_FONT}`;
            context.fillText(translate(cleared ? '스테이지 클리어' : '패배'), WIDTH / 2, 380);
        }
        if (showExitButton) {
            context.fillStyle = '#ef5350'; context.fillRect(515, 165, 250, 64);
            context.fillStyle = '#ffffff'; context.font = `22px ${BUTTON_FONT}`; context.fillText(translate('종료'), WIDTH / 2, 207);
        }
    }

    /** 시뮬레이터를 빈 그리기 보드와 첫 팔레트 포커스로 연다. @returns {void} */
    function openSimulator() {
        simulator = { mode: 'draw', player: new PlayerState('SIMULATOR', FIELD_LEFT, null, COLORS), target: new PlayerState('', FIELD_RIGHT, null, COLORS), energyTransfers: [], selected: 'red', paletteFocus: 0, focusArea: 'palette', boardFocus: { x: 0, y: 0 }, backup: null, waitTimer: 0 };
        menuScreen = 'simulator';
        syncBackgroundMusic();
    }

    /** 플레이 방법 안내를 연다. @returns {void} */
    function openTutorial() {
        enterTutorialStage(1);
    }

    /** @param {number} stage 안내 단계 @returns {{pairs:string[][], targets:number[], intro:string, preset:{x:number,y:number,color:string}[]}} */
    function getTutorialStageConfig(stage) {
        const presets = {
            2: [{ x: 0, y: 0, color: 'red' }, { x: 1, y: 0, color: 'red' }, { x: 0, y: 1, color: 'green' }, { x: 0, y: 2, color: 'garbage' }, { x: 0, y: 3, color: 'purple' }],
            3: [...Array(3).keys()].flatMap((y) => [{ x: 5, y, color: 'red' }, { x: 4, y, color: 'blue' }, { x: 3, y, color: 'green' }, { x: 2, y, color: 'red' }]).concat([{ x: 4, y: 3, color: 'red' }, { x: 3, y: 3, color: 'blue' }, { x: 2, y: 3, color: 'green' }, { x: 0, y: 0, color: 'purple' }]),
            4: [{ x: 1, y: 0, color: 'purple' }, { x: 2, y: 0, color: 'purple' }],
            5: [...Array(10).keys()].flatMap((y) => [...Array(COLUMNS).keys()].map((x) => ({ x, y, color: 'garbage' })))
        };
        const configs = {
            1: { pairs: [['red', 'blue'], ['yellow', 'green'], ['yellow', 'red']], targets: [3, 2, 3], intro: '좌우, 아래 키로 뿌요를 이동시킬 수 있고, Z, X 키로 뿌요를 회전시킬 수 있어' },
            2: { pairs: [['red', 'red'], ['green', 'green'], ['green', 'green']], targets: [2, 1, 1], intro: '같은 색의 뿌요 4개 이상이 붙으면 뿌요를 터뜨려 적을 공격할 수 있어.' },
            3: { pairs: [['green', 'red']], targets: [1], intro: '연쇄적으로 뿌요를 폭발시키면 강력한 공격을 할 수 있어.' },
            4: { pairs: [['purple', 'purple']], targets: [2], intro: '게임 중 싹쓸이를 하면 강력한 공격을 할 수 있어.' },
            5: { pairs: [['red', 'blue']], targets: [2], intro: '3번째 줄 끝에 뿌요가 오래 닿으면 패배해.' }
        };
        return { ...configs[stage], preset: presets[stage] || [] };
    }

    /** 안내의 지정 단계를 초기화한다. @param {number} stage 단계 번호 @returns {void} */
    function enterTutorialStage(stage) {
        const config = getTutorialStageConfig(stage);
        const themeController = new PracticeEnemy();
        const player = new PlayerState(getPlayerName(), FIELD_LEFT, null, COLORS);
        const opponent = new PlayerState('', FIELD_RIGHT, themeController, COLORS);
        opponent.receivesPuyos = false;
        opponent.phase = 'idle';
        config.preset.forEach(({ x, y, color }) => { player.board[y][x] = color; });
        game = {
            running: true, paused: false, winner: null, ending: null, countdown: 0, countdownStartsGame: false, elapsed: 0, marginRate: MARGIN_RATE_SCHEDULE[0].rate, practice: true,
            difficulty: selectedDifficulty, aiDifficulty: selectedAiDifficulty, themeController, pairQueueColors: COLORS,
            pairQueue: [...config.pairs, ['blue', 'yellow'], ['red', 'green']], energyTransfers: [], players: [player, opponent],
            tutorial: { stage, config, mode: 'intro', elapsed: 0, pieceElapsed: 0, placedCount: 0, lastCombo: 0, greenExplosionShown: false, stageThreeGarbageDropped: false, message: config.intro, messageElapsed: 0, messageDuration: stage === 1 ? 2000 : 4800, actionFlags: {}, allClearPreviewElapsed: null, allClearGarbageShown: false, resultElapsed: 0, finalFocus: 1, stageOneStep: stage === 1 ? 'intro' : null, stageOneElapsed: 0 }
        };
        updateNextPairs(player);
        showTutorialMessage(config.intro, game.tutorial.messageDuration);
        syncBackgroundMusic();
    }

    /** 플레이 방법 안내를 끝내고 메인 화면으로 돌아간다. @returns {void} */
    function closeTutorial() {
        playMenuCancelSound();
        game = null;
        menuScreen = 'title';
        loadNotice();
        syncBackgroundMusic();
    }

    /** 안내 문구를 번역한 뒤 공통 화면 메시지로 표시한다. @param {string} message 번역 키 @param {number} [duration=2000] 페이드 아웃 전 유지 시간(ms) @returns {void} */
    function showTutorialMessage(message, duration = 2000) {
        if (!game?.tutorial) return;
        game.tutorial.message = message;
        game.tutorial.messageElapsed = 0;
        game.tutorial.messageDuration = duration;
        showMessage(translate(message), '#f5fbfc', duration, '#263238');
    }

    /** 1단계에서 플레이어 입력 없이 이동·빠른 하강·회전을 순서대로 시연한다. @param {PlayerState} player 시연할 플레이어 @param {PlayerState} opponent 상대 플레이어 @param {number} delta 경과 시간(ms) @returns {void} */
    function updateTutorialStageOne(player, opponent, delta) {
        const tutorial = game.tutorial;
        const advanceStep = (step) => { tutorial.stageOneStep = step; tutorial.stageOneElapsed = 0; };
        const startNextPairPrompt = (step, message, duration = 2000) => {
            advanceStep(step);
            showTutorialMessage(message, duration);
        };

        if (tutorial.stageOneStep === 'firstFalling') {
            tutorial.stageOneElapsed += delta;
            if (tutorial.stageOneElapsed >= 800) {
                startNextPairPrompt('firstMoving', '좌우 방향키로 뿌요 이동', 6000);
                moveActive(player, -1, 0);
                tutorial.actionFlags.horizontalMoveCount = 1;
            }
        } else if (tutorial.stageOneStep === 'firstMoving') {
            tutorial.stageOneElapsed += delta;
            const horizontalMoves = [-1, -1, 1, 1];
            const horizontalMoveCount = tutorial.actionFlags.horizontalMoveCount || 0;
            if (horizontalMoveCount < horizontalMoves.length && tutorial.stageOneElapsed >= horizontalMoveCount * 2000) {
                moveActive(player, horizontalMoves[horizontalMoveCount], 0);
                tutorial.actionFlags.horizontalMoveCount = horizontalMoveCount + 1;
            }
            if (tutorial.actionFlags.horizontalMoveCount === horizontalMoves.length && !tutorial.message) startNextPairPrompt('firstFastDownPrompt', '아래 방향키로 빨리 떨어뜨리기');
        } else if (tutorial.stageOneStep === 'firstFastDownPrompt') {
            tutorial.stageOneElapsed += delta;
            if (tutorial.stageOneElapsed >= 1000) {
                player.tutorialFastDown = true;
                advanceStep('firstFastDown');
            }
        } else if (tutorial.stageOneStep === 'secondRotatePrompt' && !tutorial.message) {
            rotateActive(player, -1);
            advanceStep('secondBetweenRotations');
        } else if (tutorial.stageOneStep === 'secondBetweenRotations') {
            tutorial.stageOneElapsed += delta;
            if (tutorial.stageOneElapsed >= 2000) {
                rotateActive(player, -1);
                advanceStep('secondFalling');
            }
        } else if (tutorial.stageOneStep === 'thirdRotatePrompt' && !tutorial.message) {
            rotateActive(player, 1);
            advanceStep('thirdBetweenRotations');
        } else if (tutorial.stageOneStep === 'thirdBetweenRotations') {
            tutorial.stageOneElapsed += delta;
            if (tutorial.stageOneElapsed >= 2000) {
                rotateActive(player, 1);
                advanceStep('thirdFalling');
            }
        } else if (tutorial.stageOneStep === 'secondFalling' || tutorial.stageOneStep === 'thirdFalling') {
            tutorial.stageOneElapsed += delta;
            if (tutorial.stageOneElapsed >= 1000) player.tutorialFastDown = true;
        }

        updatePlayer(player, opponent, delta);

        if (player.placedPairCount >= 3) {
            enterTutorialStage(2);
            return;
        }
        if (player.placedPairCount === 1 && !tutorial.stageOneStep.startsWith('awaitSecondPair') && !tutorial.stageOneStep.startsWith('second')) {
            player.tutorialFastDown = false;
            advanceStep('awaitSecondPair');
        } else if (player.placedPairCount === 2 && !tutorial.stageOneStep.startsWith('awaitThirdPair') && !tutorial.stageOneStep.startsWith('third')) {
            player.tutorialFastDown = false;
            advanceStep('awaitThirdPair');
        }
        if (player.active && tutorial.stageOneStep === 'awaitSecondPair') {
            startNextPairPrompt('secondRotatePrompt', 'Z 키를 눌러 좌측으로 뿌요 회전');
        } else if (player.active && tutorial.stageOneStep === 'awaitThirdPair') {
            startNextPairPrompt('thirdRotatePrompt', 'X 키를 눌러 우측으로 뿌요 회전');
        }
    }

    /** 안내 시연을 시간에 따라 진행한다. @param {number} delta 경과 시간 @returns {void} */
    function updateTutorial(delta) {
        const tutorial = game.tutorial;
        const [player, opponent] = game.players;
        tutorial.elapsed += delta;
        tutorial.messageElapsed += delta;
        if (tutorial.message && tutorial.messageElapsed >= tutorial.messageDuration + SCREEN_MESSAGE_FADE_DURATION) tutorial.message = null;
        if (tutorial.mode === 'complete') return;
        if (tutorial.mode === 'result') {
            tutorial.resultElapsed += delta;
            if (tutorial.resultElapsed >= 2000) tutorial.mode = 'complete';
            return;
        }
        if (game.ending) {
            updateDefeatSequence(delta);
            if (!game.running) { tutorial.mode = 'result'; tutorial.resultElapsed = 0; }
            return;
        }
        if (tutorial.mode === 'intro') {
            if (!tutorial.message) {
                tutorial.mode = 'demo'; tutorial.elapsed = 0; tutorial.message = null;
                if (tutorial.stage === 1) tutorial.stageOneStep = 'firstFalling';
                enterControl(player);
            }
            return;
        }
        let holdAllClearGarbage = false;
        if (tutorial.stage === 4 && opponent.damage >= ALL_CLEAR_DAMAGE) {
            if (tutorial.allClearPreviewElapsed === null) tutorial.allClearPreviewElapsed = 0;
            tutorial.allClearPreviewElapsed += delta;
            holdAllClearGarbage = tutorial.allClearPreviewElapsed < 2000;
        }
        if (!holdAllClearGarbage) updatePlayer(opponent, player, delta);
        if (tutorial.stage === 1) {
            updateTutorialStageOne(player, opponent, delta);
            return;
        }
        // 3단계는 예고 표시만으로 끝내지 않고, 적 필드의 실제 방해뿌요 낙하를 한 번 확인한다.
        if (tutorial.stage === 3 && opponent.phase !== 'idle') tutorial.stageThreeGarbageDropped = true;
        const waitingForGarbage = tutorial.stage >= 2 && opponent.phase !== 'idle' && player.phase === 'control' && player.placedPairCount > 0;
        player.tutorialHold = tutorial.stage === 4 && (player.allClearEffectElapsed > 0 || holdAllClearGarbage);
        if (!waitingForGarbage) updatePlayer(player, opponent, delta);
        const currentPiece = Math.min(player.placedPairCount, tutorial.config.pairs.length - 1);
        if (player.placedPairCount !== tutorial.placedCount) {
            tutorial.placedCount = player.placedPairCount;
            tutorial.pieceElapsed = 0;
            tutorial.actionFlags = {};
        }
        if (player.active) {
            tutorial.pieceElapsed += delta;
            const target = tutorial.config.targets[currentPiece];
            if (tutorial.pieceElapsed >= 250) player.active.x = target;
            if (tutorial.pieceElapsed >= 2050) player.tutorialFastDown = true;
        }
        if (player.combo === 0) tutorial.lastCombo = 0;
        if (player.combo > tutorial.lastCombo) {
            tutorial.lastCombo = player.combo;
            if (tutorial.stage === 2) {
                if (player.placedPairCount <= 1) showTutorialMessage('같은 색의 뿌요 4개가 붙어, 적을 공격할 수 있어');
                else {
                    tutorial.greenExplosionShown = true;
                    showTutorialMessage('뿌요가 터질 때 인접한 방해뿌요도 같이 터져');
                }
            }
        }
        if (tutorial.stage === 4 && tutorial.allClearPreviewElapsed !== null && tutorial.allClearPreviewElapsed >= 2000 && opponent.phase === 'idle' && opponent.damage <= 0) {
            tutorial.allClearGarbageShown = true;
        }
        const stageFourComplete = tutorial.stage !== 4 || (tutorial.allClearGarbageShown && player.allClearEffectElapsed <= 0 && player.pendingAllClearDamage <= 0 && !hasPendingEnergyTransfers());
        const stageTwoComplete = tutorial.stage !== 2 || (tutorial.greenExplosionShown && !hasPendingEnergyTransfers());
        const stageThreeComplete = tutorial.stage !== 3 || (tutorial.stageThreeGarbageDropped && !hasPendingEnergyTransfers());
        if (player.placedPairCount >= tutorial.config.pairs.length && player.phase === 'control' && opponent.phase === 'idle' && !tutorial.message && !holdAllClearGarbage && stageFourComplete && stageTwoComplete && stageThreeComplete) {
            if (tutorial.stage < 5) enterTutorialStage(tutorial.stage + 1);
        }
    }

    /** 플레이 방법 안내 화면을 그린다. @returns {void} */
    function drawTutorial() {
        const [player, opponent] = game.players;
        const tutorial = game.tutorial;
        if (tutorial.mode === 'result' || tutorial.mode === 'complete') {
            context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
            drawResultField(player); drawResultField(opponent); drawResultCenter(false);
            if (tutorial.mode === 'complete') drawTutorialCompleteOverlay(tutorial);
            return;
        }
        context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
        drawField(player, opponent); drawField(opponent, player); drawCenter(); drawEnergyTransfers();
        if (tutorial.stage === 5 && tutorial.mode === 'intro') {
            const targetX = player.fieldX + 2 * CELL;
            const targetY = FIELD_BOTTOM - 12 * CELL;
            context.save();
            context.strokeStyle = '#ef5350'; context.lineWidth = 4;
            context.strokeRect(targetX + 2, targetY + 2, CELL - 4, CELL - 4);
            context.restore();
        }
        context.textAlign = 'center'; context.fillStyle = '#d8f2f5'; context.font = `20px ${TITLE_FONT}`;
        context.fillText(`${translate('플레이 방법')} ${tutorial.stage} / 5`, WIDTH / 2, 32);
    }

    /** 게임 종료 화면을 유지한 채 안내 완료 선택지를 겹쳐 그린다. @param {object} tutorial 안내 상태 @returns {void} */
    function drawTutorialCompleteOverlay(tutorial) {
        context.fillStyle = 'rgba(3, 11, 19, 0.76)'; context.fillRect(0, 0, WIDTH, HEIGHT);
        const buttons = [{ label: '다시보기', x: 470, focus: 0, color: '#4cc9b0' }, { label: '종료', x: 660, focus: 1, color: '#ef5350' }];
        buttons.forEach((button) => {
            context.fillStyle = button.color; context.fillRect(button.x, 376, 150, 64);
            context.strokeStyle = tutorial.finalFocus === button.focus ? '#f7c843' : button.color; context.lineWidth = tutorial.finalFocus === button.focus ? 4 : 2; context.strokeRect(button.x, 376, 150, 64);
            context.fillStyle = '#fff'; context.font = `22px ${BUTTON_FONT}`; context.fillText(translate(button.label), button.x + 75, 417);
        });
    }

    /** 설정 화면을 열고 저장된 설정의 임시 복사본을 만든다. @returns {void} */
    function openSettings() {
        clearSettingsApiTest();
        settingsDraft = { ...store.settings };
        settingsFocus = 0; settingsEditing = false; settingsCursor = 0; settingsSelectionAnchor = null;
        menuScreen = 'settings';
    }

    /** 설정 화면의 변경 사항을 저장한다. @returns {void} */
    function saveSettings() {
        playMenuSelectSound();
        clearSettingsApiTest();
        settingsDraft.playerName = normalizePlayerName(settingsDraft.playerName);
        settingsDraft.soundDataURL = normalizeSoundDataURL(settingsDraft.soundDataURL);
        const soundDataURLChanged = soundDataURL !== settingsDraft.soundDataURL;
        store.settings = { ...settingsDraft };
        saveStore();
        applyCanvasOutputResolution();
        updateCanvasOrientation();
        updateBackgroundMusicVolume();
        if (soundDataURLChanged) {
            soundDataURL = settingsDraft.soundDataURL;
            void loadSoundDataURL();
        }
        settingsDraft = null; settingsEditing = false; clearSettingsTextSelection();
        menuScreen = 'title'; loadNotice();
    }

    /** 설정 화면을 저장하지 않고 닫는다. @returns {void} */
    function cancelSettings() {
        playMenuCancelSound();
        clearSettingsApiTest();
        settingsDraft = null; settingsEditing = false; clearSettingsTextSelection();
        menuScreen = 'title'; loadNotice();
    }

    /** 모든 저장 데이터를 지우고 2초 뒤 첫 화면으로 돌아간다. @returns {void} */
    function resetAllSettings() {
        try {
            if (typeof window.confirm === 'function' && !window.confirm(translate('이 게임의 모든 설정을 초기화하시겠습니까?'))) return;
        } catch (error) {
            console.error('Puyo W 설정 초기화 확인 창을 표시하지 못했습니다.', error);
            return;
        }
        playMenuSelectSound();
        try {
            storageManager.clear();
        } catch (error) {
            console.error('Puyo W 설정 초기화 중 저장 데이터 삭제에 실패했습니다.', error);
        }
        stopBackgroundMusic();
        clearSettingsApiTest();
        settingsDraft = null;
        settingsEditing = false;
        clearSettingsTextSelection();
        settingsResetting = true;
        store = createInitialStore();
        applyCanvasOutputResolution();
        updateCanvasOrientation();
        galleryUnlocks = createInitialGalleryUnlocks();
        initialGalleryPreview = { loaded: false, items: [], startIndex: 0, elapsed: 0 };
        game = null;
        simulator = null;
        gallery = null;
        ruleSelectionOpen = false;
        if (settingsResetTimer !== null) window.clearTimeout(settingsResetTimer);
        settingsResetTimer = window.setTimeout(() => {
            settingsResetTimer = null;
            settingsResetting = false;
            menuScreen = 'initialTitle';
            hasUserStarted = false;
            loadInitialGalleryPreview();
        }, 2000);
    }

    /** 메인 화면의 음소거 상태를 토글하고 별도 저장한다. @returns {void} */
    function toggleMuted() {
        store.muted = !store.muted;
        saveStore();
        updateBackgroundMusicVolume();
    }

    /** AI API 테스트에 필요한 세 입력값이 모두 채워졌는지 확인한다. @param {object|null} settings 설정값 @returns {boolean} 실행 가능 여부 */
    function hasCompleteAiApiSettings(settings) {
        return Boolean(settings && ['aiProvider', 'aiApiKey', 'aiModel'].every((key) => typeof settings[key] === 'string' && settings[key].trim()));
    }

    /** 편집 중인 AI 설정이 저장된 설정과 같은지 확인한다. @returns {boolean} 저장된 설정 사용 여부 */
    function hasSavedAiApiSettings() {
        return Boolean(settingsDraft && store.settings
            && settingsDraft.aiProvider === store.settings.aiProvider
            && settingsDraft.aiApiKey === store.settings.aiApiKey
            && settingsDraft.aiModel === store.settings.aiModel);
    }

    /** 현재 API 테스트 버튼을 활성화할 수 있는지 확인한다. @returns {boolean} 버튼 활성화 여부 */
    function canRunAiApiTest() {
        return !settingsApiTestPending && hasCompleteAiApiSettings(settingsDraft);
    }

    /** API 테스트 실행 가능 여부를 반영한 설정 화면 포커스 순서를 만든다. @returns {number[]} 포커스 인덱스 목록 */
    function getSelectableSettingsFocuses() {
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, ...(canRunAiApiTest() ? [9] : []), 10, 11, 12, 13];
    }

    /** 설정 화면에서 다음 또는 이전 포커스로 이동한다. @param {number} direction 이동 방향 @returns {void} */
    function moveSettingsFocus(direction) {
        const focuses = getSelectableSettingsFocuses();
        const currentIndex = focuses.indexOf(settingsFocus);
        const nextIndex = (Math.max(0, currentIndex) + direction + focuses.length) % focuses.length;
        settingsFocus = focuses[nextIndex];
    }

    /** API 테스트 안내문을 번역한 뒤 공통 화면 메시지로 표시한다. @param {string} message 번역 키 @returns {void} */
    function showSettingsApiTestMessage(message) {
        showMessage(translate(message));
    }

    /** 화면을 닫거나 초기화할 때 남은 API 테스트 결과를 무효화한다. @returns {void} */
    function clearSettingsApiTest() {
        settingsApiTestRequestId += 1;
        settingsApiTestPending = false;
    }

    /** Responses API 응답에서 생성된 텍스트를 꺼낸다. @param {object} response API 응답 @returns {string|null} JSON 텍스트 */
    function getResponsesOutputText(response) {
        if (typeof response?.output_text === 'string') return response.output_text;
        for (const outputItem of response?.output || []) {
            for (const content of outputItem?.content || []) {
                if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
            }
        }
        return null;
    }

    /** API 테스트의 최소 응답 스키마를 브라우저에서도 검사한다. @param {unknown} value 파싱된 응답 @returns {boolean} 스키마 통과 여부 */
    function isAiApiTestResult(value) {
        return Boolean(value && typeof value === 'object' && !Array.isArray(value)
            && Object.keys(value).length === 1 && value.success === true);
    }

    /** 저장된 OpenAI 설정으로 Responses API를 직접 호출해 연결을 확인한다. @returns {Promise<void>} 완료 시점 */
    async function runAiApiTest() {
        if (!hasCompleteAiApiSettings(settingsDraft) || !hasSavedAiApiSettings()) {
            showSettingsApiTestMessage('설정 저장 후 다시 시도해 주세요');
            return;
        }
        if (settingsApiTestPending) return;
        const requestId = ++settingsApiTestRequestId;
        const settings = { ...store.settings };
        settingsApiTestPending = true;
        showSettingsApiTestMessage('AI API 테스트 요청 중...');
        try {
            const response = await window.fetch(convertURL(OPENAI_RESPONSES_API_URL), {
                method: 'POST',
                headers: { Authorization: `Bearer ${settings.aiApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: settings.aiModel,
                    reasoning: { effort: 'low' },
                    input: [{ role: 'user', content: 'Return only JSON matching the supplied schema, with success set to true.' }],
                    text: { format: { type: 'json_schema', name: 'ai_api_test_result', strict: true, schema: AI_API_TEST_JSON_SCHEMA } },
                    max_output_tokens: 64
                })
            });
            if (!response.ok) {
                showSettingsApiTestMessage('AI API 테스트 실패 (JSON 스키마 검사: 미실시)');
                return;
            }
            const outputText = getResponsesOutputText(await response.json());
            if (requestId !== settingsApiTestRequestId) return;
            let result;
            try { result = outputText ? JSON.parse(outputText) : null; } catch (error) { result = null; }
            const testSucceeded = isAiApiTestResult(result);
            if (testSucceeded) unlockSolomonForSession();
            showSettingsApiTestMessage(testSucceeded
                ? 'AI API 테스트 성공 (JSON 스키마 검사: 통과)'
                : 'AI API 테스트 실패 (JSON 스키마 검사: 실패)');
        } catch (error) {
            console.error('Puyo W AI API 테스트 요청에 실패했습니다.', error);
            showSettingsApiTestMessage('AI API 테스트 실패 (JSON 스키마 검사: 미실시)');
        } finally {
            if (requestId === settingsApiTestRequestId) settingsApiTestPending = false;
        }
    }

    /** 설정 화면의 포커스 항목을 실행한다. @returns {void} */
    function activateSettingsFocus() {
        if (settingsFocus === 3) {
            playMenuSelectSound();
            const currentIndex = VIRTUAL_CONTROLLER_OPTIONS.findIndex((option) => option.key === settingsDraft.virtualController);
            settingsDraft.virtualController = VIRTUAL_CONTROLLER_OPTIONS[(currentIndex + 1) % VIRTUAL_CONTROLLER_OPTIONS.length].key;
        }
        else if (settingsFocus === 4) {
            playMenuSelectSound();
            const currentIndex = GRAPHICS_QUALITY_OPTIONS.findIndex((option) => option.key === settingsDraft.graphicsQuality);
            settingsDraft.graphicsQuality = GRAPHICS_QUALITY_OPTIONS[(currentIndex + 1) % GRAPHICS_QUALITY_OPTIONS.length].key;
        } else if (settingsFocus === 9 && canRunAiApiTest()) { playMenuSelectSound(); runAiApiTest(); }
        else if (settingsFocus === 10) { playMenuSelectSound(); settingsDraft.landscapeOrientationLocked = !settingsDraft.landscapeOrientationLocked; }
        else if (settingsFocus === 11) saveSettings();
        else if (settingsFocus === 12) cancelSettings();
        else if (settingsFocus === 13) resetAllSettings();
    }

    /** 설정 화면을 그린다. @returns {void} */
    function drawSettings() {
        context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
        context.textAlign = 'center'; context.fillStyle = '#d8f2f5'; context.font = `34px ${TITLE_FONT}`; context.fillText(translate('설정'), WIDTH / 2, 52);
        const rows = [
            { label: '이름', y: 95, value: settingsDraft.playerName, kind: 'text' },
            { label: '배경음악 볼륨', y: 145, value: settingsDraft.musicVolume, kind: 'slider' },
            { label: '효과음 볼륨', y: 195, value: settingsDraft.effectsVolume, kind: 'slider' },
            { label: '가상 컨트롤러 사용', y: 245, value: settingsDraft.virtualController, kind: 'radio', options: VIRTUAL_CONTROLLER_OPTIONS.map((option, optionIndex) => ({ label: option.label, value: option.key, x: 530 + optionIndex * 145, width: 125 })) },
            { label: '그래픽 설정', y: 295, value: settingsDraft.graphicsQuality, kind: 'radio', options: GRAPHICS_QUALITY_OPTIONS.map((option, optionIndex) => ({ label: option.label, value: option.key, x: 530 + optionIndex * 145, width: 125 })) },
            { label: '사운드 데이터 URL', y: 345, value: settingsDraft.soundDataURL, kind: 'text' },
            { label: 'AI 서비스 제공자', y: 395, value: settingsDraft.aiProvider, kind: 'provider' },
            { label: 'AI API 키', y: 445, value: settingsDraft.aiApiKey ? '•'.repeat(Math.min(30, settingsDraft.aiApiKey.length)) : '', kind: 'text' },
            { label: '사용 모델명', y: 495, value: settingsDraft.aiModel, kind: 'text' }
        ];
        rows.forEach((row, index) => {
            context.textAlign = 'left'; context.fillStyle = '#d8f2f5'; context.font = `13px ${BUTTON_FONT}`; context.fillText(translate(row.label), 280, row.y + 4);
            const focused = settingsFocus === index;
            if (row.kind === 'slider') {
                context.strokeStyle = focused ? '#ffd54f' : '#426474'; context.lineWidth = focused ? 3 : 2; context.strokeRect(540, row.y - 8, 360, 16);
                context.fillStyle = '#4cc9b0'; context.fillRect(542, row.y - 6, 356 * row.value / 100, 12);
                context.fillStyle = '#f5fbfc'; context.textAlign = 'right'; context.fillText(String(row.value), 915, row.y + 4);
            } else if (row.kind === 'radio') {
                row.options.forEach((option) => {
                    const selected = row.value === option.value;
                    context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(option.x, row.y - 16, option.width, 32);
                    context.strokeStyle = focused && selected ? '#ffd54f' : '#426474'; context.lineWidth = focused && selected ? 3 : 2; context.strokeRect(option.x, row.y - 16, option.width, 32);
                    context.beginPath(); context.arc(option.x + 16, row.y, 6, 0, Math.PI * 2); context.fillStyle = '#d8f2f5'; context.strokeStyle = '#d8f2f5'; context.lineWidth = 2; context.stroke();
                    if (selected) { context.beginPath(); context.arc(option.x + 16, row.y, 3, 0, Math.PI * 2); context.fill(); }
                    context.fillStyle = '#f5fbfc'; context.textAlign = 'center'; context.fillText(translate(option.label), option.x + (option.width + 16) / 2, row.y + 4);
                });
            } else if (row.kind === 'provider') {
                AI_SERVICE_PROVIDERS.forEach((provider, providerIndex) => {
                    const x = 540 + providerIndex * 145; const selected = row.value === provider;
                    context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(x, row.y - 16, 125, 32); context.strokeStyle = focused && selected ? '#ffd54f' : '#426474'; context.lineWidth = focused && selected ? 3 : 2; context.strokeRect(x, row.y - 16, 125, 32); context.fillStyle = '#f5fbfc'; context.textAlign = 'center'; context.fillText(provider, x + 62.5, row.y + 4);
                });
            } else {
                context.fillStyle = '#0b202c'; context.fillRect(540, row.y - 16, 420, 32); context.strokeStyle = focused ? '#ffd54f' : '#426474'; context.lineWidth = focused ? 3 : 2; context.strokeRect(540, row.y - 16, 420, 32);
                const characters = Array.from(row.value);
                const textFieldX = 551;
                const textFieldWidth = 398;
                const cursorIndex = settingsEditing && settingsFocus === index ? settingsCursor : 0;
                let visibleStart = 0;
                while (visibleStart < cursorIndex && context.measureText(characters.slice(visibleStart, cursorIndex).join('')).width > textFieldWidth - 4) visibleStart += 1;
                let visibleEnd = visibleStart;
                while (visibleEnd < characters.length && context.measureText(characters.slice(visibleStart, visibleEnd + 1).join('')).width <= textFieldWidth) visibleEnd += 1;
                context.save();
                context.beginPath(); context.rect(textFieldX, row.y - 15, textFieldWidth, 30); context.clip();
                const selection = settingsEditing && settingsFocus === index ? getSettingsTextSelectionRange() : null;
                if (selection) {
                    const selectionStart = Math.max(selection[0], visibleStart);
                    const selectionEnd = Math.min(selection[1], visibleEnd);
                    if (selectionStart < selectionEnd) {
                        const selectionX = textFieldX + context.measureText(characters.slice(visibleStart, selectionStart).join('')).width;
                        const selectionWidth = context.measureText(characters.slice(selectionStart, selectionEnd).join('')).width;
                        context.fillStyle = '#426f9e'; context.fillRect(selectionX, row.y - 11, selectionWidth, 18);
                    }
                }
                context.fillStyle = '#f5fbfc'; context.textAlign = 'left'; context.fillText(characters.slice(visibleStart, visibleEnd).join('') || ' ', textFieldX, row.y + 4);
                if (settingsEditing && settingsFocus === index) { const cursorX = textFieldX + context.measureText(characters.slice(visibleStart, settingsCursor).join('')).width; context.fillStyle = '#ffd54f'; context.fillRect(cursorX, row.y - 11, 2, 18); }
                context.restore();
            }
        });
        const apiTestEnabled = canRunAiApiTest();
        context.fillStyle = apiTestEnabled ? '#264b5b' : '#263640'; context.fillRect(540, 525, 420, 36);
        context.strokeStyle = settingsFocus === 9 && apiTestEnabled ? '#ffd54f' : (apiTestEnabled ? '#4cc9b0' : '#4b5b64'); context.lineWidth = settingsFocus === 9 && apiTestEnabled ? 3 : 2; context.strokeRect(540, 525, 420, 36);
        context.fillStyle = apiTestEnabled ? '#f5fbfc' : '#7f969e'; context.font = `14px ${BUTTON_FONT}`; context.textAlign = 'center'; context.fillText(translate('AI API 테스트'), 750, 549);
        context.textAlign = 'left'; context.fillStyle = '#a9d9e5'; context.font = `11px ${MESSAGE_FONT}`; context.fillText(translate('이 API키는 브라우저에만 저장됩니다.'), 540, 580);
        const checkboxX = 540;
        const checkboxY = 600;
        context.fillStyle = '#0b202c'; context.fillRect(checkboxX, checkboxY, 20, 20);
        context.strokeStyle = settingsFocus === 10 ? '#ffd54f' : '#426474'; context.lineWidth = settingsFocus === 10 ? 3 : 2; context.strokeRect(checkboxX, checkboxY, 20, 20);
        if (settingsDraft.landscapeOrientationLocked) {
            context.strokeStyle = '#4cc9b0'; context.lineWidth = 3; context.beginPath(); context.moveTo(checkboxX + 4, checkboxY + 10); context.lineTo(checkboxX + 8, checkboxY + 15); context.lineTo(checkboxX + 17, checkboxY + 5); context.stroke();
        }
        context.fillStyle = '#f5fbfc'; context.font = `14px ${BUTTON_FONT}`; context.textAlign = 'left'; context.fillText(translate('화면 가로방향 고정'), checkboxX + 30, checkboxY + 16);
        [{ label: '저장', x: 390, focus: 11, color: '#4cc9b0' }, { label: '취소', x: 565, focus: 12, color: '#ef5350' }, { label: '초기화', x: 740, focus: 13, color: '#7e6bc4' }].forEach((button) => {
            context.fillStyle = button.color; context.fillRect(button.x, 640, 150, 42); context.strokeStyle = settingsFocus === button.focus ? '#ffd54f' : button.color; context.lineWidth = settingsFocus === button.focus ? 3 : 2; context.strokeRect(button.x, 640, 150, 42); context.fillStyle = '#fff'; context.font = `14px ${BUTTON_FONT}`; context.textAlign = 'center'; context.fillText(translate(button.label), button.x + 75, 666);
        });
    }

    /** 설정 초기화 중 다른 그래픽 없이 진행 문구만 표시한다. @returns {void} */
    function drawSettingsResetting() {
        context.fillStyle = '#071621';
        context.fillRect(0, 0, WIDTH, HEIGHT);
        context.textAlign = 'center';
        context.fillStyle = '#f5fbfc';
        context.font = `34px ${TITLE_FONT}`;
        context.fillText(translate('초기화 중...'), WIDTH / 2, HEIGHT / 2);
    }

    /** 메인 화면 왼쪽에 noticeUrl 내용을 줄바꿈해 표시한다. @returns {void} */
    function drawNotice() {
        if (!noticeText) return;
        const x = 42; const y = 230; const width = 300; const lineHeight = 18; const lines = [];
        context.save();
        context.beginPath(); context.rect(x, y, width, 390); context.clip();
        context.fillStyle = '#a9d9e5'; context.textAlign = 'left'; context.font = `13px ${quoteFontNameIfNeeded(MESSAGE_FONT_NAME)}`;
        noticeText.split(/\r?\n/).forEach((sourceLine) => {
            let line = '';
            for (const character of sourceLine) {
                const candidate = line + character;
                if (line && context.measureText(candidate).width > width) { lines.push(line); line = character; } else line = candidate;
            }
            lines.push(line);
        });
        lines.forEach((line, index) => context.fillText(line, x, y + 16 + index * lineHeight));
        context.restore();
    }

    /** 갤러리에 표시할 대상 유형 목록이다. @returns {{label:string,key:'puyo'|'warning'|'enemy'}[]} */
    function getGalleryTypes() {
        return [
            { label: '일반뿌요', key: 'puyo' },
            { label: '예고뿌요', key: 'warning' },
            { label: '적', key: 'enemy' }
        ];
    }

    /** 갤러리 항목의 현재 언어 표시명을 반환한다. @param {{label?:string,labelValues?:unknown[],displayLabel?:string}} item 갤러리 항목 @returns {string} 표시명 */
    function getGalleryItemLabel(item) {
        return item.displayLabel || translate(item.label || '', ...(item.labelValues || []));
    }

    /** 갤러리의 현재 유형에 맞는 대상 목록을 만든다. @returns {{id:string,label?:string,labelValues?:unknown[],displayLabel?:string,locked:boolean,draw:(expressionIndex?:number)=>void}[]} */
    function getGalleryItems() {
        if (!gallery) return [];
        const type = getGalleryTypes()[gallery.typeIndex]?.key;
        if (type === 'puyo') {
            return [...COLORS, 'garbage', HARD_GARBAGE, IRON_PUYO].map((color) => {
                const puyo = getPuyo(color);
                return {
                    id: color, label: puyo.getName(), locked: false,
                    draw: () => {
                        context.save(); context.translate(805, 410); context.scale(5.6, 5.6);
                        puyo.draw(context, -CELL / 2, -CELL / 2, CELL);
                        context.restore();
                    }
                };
            });
        }
        if (type === 'warning') {
            return [...WARNING_PUYO_CLASSES].sort((left, right) => left.unitCount - right.unitCount).map((WarningPuyoType) => {
                const unit = new WarningPuyoType();
                return {
                    id: unit.type, displayLabel: translate(unit.getName()), locked: !galleryUnlocks.warning.includes(unit.type),
                    draw: () => {
                        context.save(); context.translate(805, 410); context.scale(5.2, 5.2);
                        unit.draw(context, -CELL / 2, -CELL / 2, CELL);
                        context.restore();
                    }
                };
            });
        }
        const expressions = ['normal', 'crisis', 'defeated'];
        return getVisibleOpponents().map((entry) => {
            const enemy = entry.createController();
            return {
                id: entry.classType, displayLabel: translate(enemy.getName()),
                locked: !galleryUnlocks.enemies.includes(entry.classType),
                draw: (expressionIndex = 0) => enemy.drawPortrait(context, 805, 420, 2.8, expressions[expressionIndex % expressions.length])
            };
        });
    }

    /** 갤러리 대상 목록의 스크롤 시작 위치를 반환한다. @returns {number} */
    function getGalleryListStart() {
        const itemCount = getGalleryItems().length;
        return Math.max(0, Math.min(Math.max(0, itemCount - 8), (gallery?.itemIndex || 0) - 3));
    }

    /** 갤러리 대상 하나의 클릭 영역을 반환한다. @param {number} index 대상 순번 @returns {{x:number,y:number,width:number,height:number}} */
    function getGalleryTargetBounds(index) {
        return { x: 54, y: 220 + (index - getGalleryListStart()) * 51, width: 310, height: 43 };
    }

    /** 갤러리 우측 상단 닫기 버튼의 클릭 영역을 반환한다. @returns {{x:number,y:number,width:number,height:number}} */
    function getGalleryCloseButtonBounds() {
        return { x: 1221, y: 16, width: 29, height: 24 };
    }

    /** 갤러리를 닫고 메인 메뉴로 돌아간다. @returns {void} */
    function closeGallery() {
        playMenuCancelSound();
        gallery = null;
        menuScreen = 'title';
        loadNotice();
    }

    /** 갤러리를 첫 유형·첫 대상으로 열고 저장된 잠금 상태를 새로 읽는다. @returns {void} */
    function openGallery() {
        loadGalleryUnlocks();
        gallery = { typeIndex: 0, itemIndex: 0, focus: 'type', portraitElapsed: 0 };
        menuScreen = 'gallery';
    }

    /** 갤러리 유형을 바꾸며 첫 공개 대상을 선택한다. @param {number} amount 이동 방향 @returns {void} */
    function selectGalleryType(amount) {
        if (!gallery) return;
        const types = getGalleryTypes();
        gallery.typeIndex = (gallery.typeIndex + amount + types.length) % types.length;
        const items = getGalleryItems();
        gallery.itemIndex = Math.max(0, items.findIndex((item) => !item.locked));
        gallery.portraitElapsed = 0;
    }

    /** 갤러리 대상에서 잠긴 항목을 건너뛰어 이동한다. @param {number} amount 이동 방향 @returns {void} */
    function selectRelativeGalleryItem(amount) {
        if (!gallery) return;
        const items = getGalleryItems();
        if (!items.length) return;
        for (let offset = 1; offset <= items.length; offset += 1) {
            const index = (gallery.itemIndex + amount * offset + items.length) % items.length;
            if (!items[index].locked) { gallery.itemIndex = index; gallery.portraitElapsed = 0; return; }
        }
    }

    /** 갤러리 화면을 그린다. @returns {void} */
    function drawGallery() {
        context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
        const closeButton = getGalleryCloseButtonBounds();
        context.fillStyle = '#264b5b'; context.fillRect(closeButton.x, closeButton.y, closeButton.width, closeButton.height);
        context.strokeStyle = '#6ea2b8'; context.lineWidth = 2; context.strokeRect(closeButton.x, closeButton.y, closeButton.width, closeButton.height);
        context.fillStyle = '#f5fbfc'; context.font = `16px ${BUTTON_FONT}`; context.textAlign = 'center'; context.fillText('×', closeButton.x + closeButton.width / 2, closeButton.y + 18);
        context.textAlign = 'center'; context.fillStyle = '#d8f2f5'; context.font = `34px ${TITLE_FONT}`;
        context.fillText(translate('갤러리'), WIDTH / 2, 48);
        const types = getGalleryTypes();
        const typeWidth = 190; const typeY = 91;
        types.forEach((type, index) => {
            const x = WIDTH / 2 - (types.length * typeWidth + (types.length - 1) * 14) / 2 + index * (typeWidth + 14);
            const selected = index === gallery.typeIndex;
            context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(x, typeY, typeWidth, 54);
            context.strokeStyle = selected && gallery.focus === 'type' ? '#f7c843' : '#3b6070'; context.lineWidth = selected && gallery.focus === 'type' ? 4 : 2; context.strokeRect(x, typeY, typeWidth, 54);
            context.fillStyle = '#f5fbfc'; context.font = `19px ${BUTTON_FONT}`; context.fillText(translate(type.label), x + typeWidth / 2, typeY + 34);
        });
        context.fillStyle = '#0c2433'; context.fillRect(34, 180, 350, 500);
        context.strokeStyle = gallery.focus === 'target' ? '#f7c843' : '#3b6070'; context.lineWidth = gallery.focus === 'target' ? 3 : 2; context.strokeRect(34, 180, 350, 500);
        const items = getGalleryItems();
        const start = getGalleryListStart();
        items.slice(start, start + 8).forEach((item, relativeIndex) => {
            const index = start + relativeIndex;
            const bounds = getGalleryTargetBounds(index);
            const selected = index === gallery.itemIndex;
            context.fillStyle = item.locked ? '#303b45' : selected ? '#563068' : '#102c3b'; context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            context.strokeStyle = selected && gallery.focus === 'target' ? '#f7c843' : item.locked ? '#65727d' : '#3b6070'; context.lineWidth = selected && gallery.focus === 'target' ? 3 : 1; context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            const itemLabel = getGalleryItemLabel(item);
            context.fillStyle = item.locked ? '#adb7bd' : '#f5fbfc'; context.font = `16px ${BUTTON_FONT}`; context.fillText(item.locked ? translate('잠김') : itemLabel, bounds.x + bounds.width / 2, bounds.y + 28);
        });
        context.fillStyle = '#102c3b'; context.fillRect(414, 180, 832, 500);
        context.strokeStyle = '#3b6070'; context.lineWidth = 2; context.strokeRect(414, 180, 832, 500);
        const selected = items[gallery.itemIndex];
        if (selected?.locked) {
            context.fillStyle = '#65727d'; context.font = `82px ${TITLE_FONT}`; context.fillText('🔒', 830, 414);
            context.fillStyle = '#d8f2f5'; context.font = `23px ${BUTTON_FONT}`; context.fillText(translate('잠김'), 830, 510);
        } else if (selected) {
            const portraitExpression = getGalleryTypes()[gallery.typeIndex]?.key === 'enemy' ? Math.floor(gallery.portraitElapsed / 2000) % 3 : 0;
            selected.draw(portraitExpression);
        }
        context.textBaseline = 'alphabetic';
    }

    /** 시뮬레이터 팔레트와 버튼 영역을 반환한다. @returns {{kind:string,value:string|null,x:number,y:number,width:number,height:number}[]} */
    function getSimulatorPaletteItems() {
        const items = [...COLORS, 'garbage', HARD_GARBAGE, IRON_PUYO].map((color, index) => ({ kind: 'puyo', value: color, x: 906 + (index % 3) * (CELL + 6), y: 184 + Math.floor(index / 3) * (CELL + 6), width: CELL, height: CELL }));
        items.push({ kind: 'eraser', value: 'eraser', x: 994, y: 272, width: CELL, height: CELL });
        items.push(
            { kind: 'play', value: null, x: 906, y: 332, width: CELL * 3, height: CELL },
            { kind: 'copyJson', value: null, x: 906, y: 378, width: CELL * 3, height: CELL },
            { kind: 'pasteJson', value: null, x: 906, y: 424, width: CELL * 3, height: CELL },
            { kind: 'exit', value: null, x: 906, y: 470, width: CELL * 3, height: CELL }
        );
        return items;
    }

    /** 현재 시뮬레이터 배치를 클립보드용 JSON 문자열로 만든다. @returns {string} 배치 JSON 문자열 */
    function serializeSimulatorBoard() {
        const puyos = [];
        simulator.player.board.forEach((row, y) => row.forEach((color, x) => {
            if (color) puyos.push({ x, y, color });
        }));
        return JSON.stringify({ puyos });
    }

    /** 시뮬레이터 메시지를 공통 화면 메시지로 표시한다. @param {string} message 이미 번역된 표시문 @returns {void} */
    function showSimulatorMessage(message) {
        showMessage(message, '#f7c843', 3500);
    }

    /** 클립보드에 시뮬레이터 배치를 복사한다. @returns {void} */
    function copySimulatorJson() {
        const serialized = serializeSimulatorBoard();
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            console.error('시뮬레이터 배치를 클립보드에 복사할 수 없습니다.');
            showSimulatorMessage(translate('클립보드 복사 실패'));
            return;
        }
        navigator.clipboard.writeText(serialized).then(() => {
            showSimulatorMessage(translate('배치가 클립보드에 복사됨'));
        }).catch((error) => {
            console.error('시뮬레이터 배치 클립보드 복사에 실패했습니다.', error);
            showSimulatorMessage(translate('클립보드 복사 실패'));
        });
    }

    /** 입력받은 JSON 문자열로 시뮬레이터 배치를 교체한다. @returns {void} */
    function pasteSimulatorJson() {
        const serialized = window.prompt(translate('배치 JSON을 입력하세요.'));
        if (serialized === null || serialized.trim() === '') return;
        try {
            const parsed = JSON.parse(serialized);
            if (!parsed || !Array.isArray(parsed.puyos)) throw new TypeError('puyos 배열이 필요합니다.');
            const board = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
            parsed.puyos.forEach((puyo) => {
                if (!puyo || !Number.isInteger(puyo.x) || !Number.isInteger(puyo.y) || puyo.x < 0 || puyo.x >= COLUMNS || puyo.y < 0 || puyo.y >= SIMULATOR_EDITABLE_ROWS || ![...COLORS, 'garbage', HARD_GARBAGE, IRON_PUYO].includes(puyo.color)) {
                    throw new TypeError('유효하지 않은 뿌요 좌표 또는 색상입니다.');
                }
                if (board[puyo.y][puyo.x]) throw new TypeError('같은 칸에 뿌요가 중복됩니다.');
                board[puyo.y][puyo.x] = puyo.color;
            });
            simulator.player.board = board;
        } catch (error) {
            showSimulatorMessage(translate('JSON 파싱 실패'));
        }
    }

    /** 선택한 항목을 필드 칸에 반영한다. @param {number} x X 좌표 @param {number} y Y 좌표 @returns {void} */
    function placeSimulatorPuyo(x, y) {
        if (!simulator || simulator.mode !== 'draw' || x < 0 || x >= COLUMNS || y < 0 || y >= SIMULATOR_EDITABLE_ROWS) return;
        simulator.player.board[y][x] = simulator.selected === 'eraser' ? null : simulator.selected;
    }

    /** 팔레트 항목 선택 또는 버튼 동작을 실행한다. @param {number} index 항목 인덱스 @returns {void} */
    function activateSimulatorPaletteItem(index) {
        const item = getSimulatorPaletteItems()[index];
        if (!simulator || !item) return;
        if (item.kind === 'exit') playMenuCancelSound();
        else playMenuSelectSound();
        simulator.paletteFocus = index;
        if (item.kind === 'puyo' || item.kind === 'eraser') { simulator.selected = item.value; simulator.focusArea = 'board'; }
        else if (item.kind === 'play') startSimulatorPlayback();
        else if (item.kind === 'copyJson') copySimulatorJson();
        else if (item.kind === 'pasteJson') pasteSimulatorJson();
        else { simulator = null; menuScreen = 'title'; loadNotice(); }
    }

    /** 편집 보드를 보관하고 중력 단계부터 재생한다. @returns {void} */
    function startSimulatorPlayback() {
        if (!simulator || simulator.mode !== 'draw') return;
        simulator.backup = simulator.player.board.map((row) => [...row]);
        simulator.mode = 'simulation'; simulator.player.effects = null; simulator.player.comboPopups = []; simulator.energyTransfers = [];
        simulator.target.damage = 0; simulator.target.attack = 0; simulator.target.warningReductionDelay = 0; simulator.target.outgoingWarningDelay = 0; simulator.target.announcedAttack = 0; simulator.target.announcedAttackEnergy = null;
        startGravity(simulator.player, 'simulatorExplode');
        syncBackgroundMusic();
    }

    /** 시뮬레이션 전 보드 상태로 복원해 그리기 모드로 돌아간다. @returns {void} */
    function restoreSimulatorDrawing() {
        if (!simulator) return;
        if (simulator.backup) simulator.player.board = simulator.backup.map((row) => [...row]);
        simulator.player.gravityAnimation = null; simulator.player.effects = null; simulator.player.phase = 'idle';
        simulator.player.point = 0; simulator.player.attack = 0; simulator.player.damage = 0; simulator.player.combo = 0; simulator.player.comboPopups = [];
        simulator.target.damage = 0; simulator.target.attack = 0; simulator.target.warningReductionDelay = 0; simulator.target.outgoingWarningDelay = 0; simulator.target.announcedAttack = 0; simulator.target.announcedAttackEnergy = null; simulator.energyTransfers = [];
        simulator.mode = 'draw'; simulator.focusArea = 'palette'; simulator.paletteFocus = 0; simulator.waitTimer = 0;
        syncBackgroundMusic();
    }

    /** 시뮬레이터 보드의 폭발 및 인접 방해뿌요 제거를 처리한다. @returns {boolean} 폭발 여부 */
    function explodeSimulatorPuyos() {
        const player = simulator.player;
        const explosionGroups = findExplosionGroupsOnBoard(player.board);
        const exploding = explosionGroups.flatMap((group) => group.cells);
        if (!exploding.length) return false;
        const resolution = getExplosionResolution(player.board, exploding);
        applyExplosionResolution(player.board, resolution);
        player.combo += 1;
        playComboSounds(player);
        const center = exploding.reduce((sum, [x, y]) => ({ x: sum.x + x, y: sum.y + y }), { x: 0, y: 0 });
        player.comboPopups.push({ x: center.x / exploding.length, y: center.y / exploding.length, combo: player.combo, elapsed: 0 });
        const point = calculateExplosionPoint(explosionGroups, player.combo, resolution.brokenHardGarbageCount);
        player.point += point;
        player.attack += calculateExplosionAttack(point);
        sendAttackEnergy(player, simulator.target, center.x / exploding.length, center.y / exploding.length);
        player.effects = { cells: [...resolution.removed.values()], elapsed: 0, duration: 420 }; player.phase = 'simulatorEffect';
        return true;
    }

    /** 시뮬레이터 중력·폭발·복원 시간을 갱신한다. @param {number} delta 경과 시간(ms) @returns {void} */
    function updateSimulator(delta) {
        if (!simulator) return;
        const player = simulator.player;
        if (simulator.mode === 'draw') return;
        player.comboPopups = player.comboPopups
            .map((popup) => ({ ...popup, elapsed: popup.elapsed + delta }))
            .filter((popup) => popup.elapsed < 2000);
        if (simulator.mode === 'complete') return;
        if (simulator.mode === 'settling') {
            if (!hasPendingEnergyTransfers()) { simulator.mode = 'complete'; simulator.focusArea = 'complete'; }
            return;
        }
        if (player.phase === 'gravity') {
            if (player.gravityAnimation) {
                player.gravityAnimation.elapsed += delta;
                if (player.gravityAnimation.elapsed < player.gravityAnimation.duration) return;
                const falling = player.gravityAnimation.falling;
                player.gravityAnimation = null;
                playGravityLandingSounds(falling);
            }
            if (!explodeSimulatorPuyos()) {
                deliverFinalAttackEnergy(player, simulator.target);
                player.combo = 0;
                simulator.mode = hasPendingEnergyTransfers() ? 'settling' : 'complete';
                simulator.focusArea = 'complete';
            }
        } else if (player.phase === 'simulatorEffect') {
            player.effects.elapsed += delta;
            if (player.effects.elapsed >= player.effects.duration) { player.effects = null; startGravity(player, 'simulatorExplode'); }
        }
    }

    /** 시뮬레이션 중 상단·측면 베젤을 전경으로 다시 그려 숨김 행의 낙하 뿌요를 가린다. @returns {void} */
    function drawSimulatorBezelForeground() {
        const x = FIELD_LEFT;
        context.fillStyle = '#0c2433';
        context.fillRect(x - CELL, FIELD_TOP - CELL, CELL * 8, CELL);
        context.fillRect(x - CELL, FIELD_TOP, CELL, CELL * VISIBLE_ROWS);
        context.fillRect(x + CELL * COLUMNS, FIELD_TOP, CELL, CELL * VISIBLE_ROWS);
    }

    /** 시뮬레이터 화면을 그린다. @returns {void} */
    function drawSimulator() {
        const player = simulator.player; const x = FIELD_LEFT;
        context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
        context.fillStyle = '#0c2433'; context.fillRect(x - CELL, FIELD_TOP - CELL, CELL * 8, CELL * 14);
        context.fillStyle = '#112f40'; context.fillRect(x, FIELD_TOP, CELL * 6, CELL * 12);
        context.strokeStyle = 'rgba(162,220,235,.14)'; context.lineWidth = 1;
        for (let i = 0; i <= COLUMNS; i += 1) { context.beginPath(); context.moveTo(x + i * CELL, FIELD_TOP); context.lineTo(x + i * CELL, FIELD_BOTTOM); context.stroke(); }
        for (let i = 0; i <= VISIBLE_ROWS; i += 1) { context.beginPath(); context.moveTo(x, FIELD_TOP + i * CELL); context.lineTo(x + COLUMNS * CELL, FIELD_TOP + i * CELL); context.stroke(); }
        drawDefeatCellMarkers(x);
        const falling = new Set((player.gravityAnimation?.falling || []).map((puyo) => `${puyo.x},${puyo.toY}`));
        // 그리기 중에만 13번째 줄을 베젤 위에 표시한다. 시뮬레이션에서는 기존처럼 베젤 뒤에 숨긴다.
        const renderedRows = simulator.mode === 'draw' ? SIMULATOR_EDITABLE_ROWS : VISIBLE_ROWS;
        for (let y = 0; y < renderedRows; y += 1) for (let column = 0; column < COLUMNS; column += 1) if (player.board[y][column] && !falling.has(`${column},${y}`)) drawPuyo(x + column * CELL, FIELD_BOTTOM - (y + 1) * CELL, player.board[y][column]);
        if (player.gravityAnimation) { const progress = Math.min(1, player.gravityAnimation.elapsed / player.gravityAnimation.duration) ** 2; player.gravityAnimation.falling.forEach((puyo) => { const y = puyo.fromY + (puyo.toY - puyo.fromY) * progress; if (y < VISIBLE_ROWS) drawPuyo(x + puyo.x * CELL, FIELD_BOTTOM - (y + 1) * CELL, puyo.color); }); }
        if (player.effects) { const progress = Math.min(1, player.effects.elapsed / player.effects.duration); player.effects.cells.forEach((puyo) => drawExplosionEffect(x + puyo.x * CELL, FIELD_BOTTOM - (puyo.y + 1) * CELL, puyo, progress)); }
        player.comboPopups.forEach((popup) => drawComboPopup(x, popup));
        // 낙하 애니메이션도 베젤보다 먼저 그려지므로, 시뮬레이션에서는 베젤을 전경으로 복원한다.
        if (simulator.mode !== 'draw') drawSimulatorBezelForeground();
        if (simulator.mode === 'draw' && simulator.focusArea === 'board') { const focus = simulator.boardFocus; context.strokeStyle = '#ffd54f'; context.lineWidth = 4; context.strokeRect(x + focus.x * CELL + 2, FIELD_BOTTOM - (focus.y + 1) * CELL + 2, CELL - 4, CELL - 4); }
        context.fillStyle = '#071621'; context.fillRect(500, FIELD_TOP - CELL, 350, CELL * 14); context.fillStyle = '#0c2433'; context.fillRect(FIELD_RIGHT - CELL, FIELD_TOP - CELL, CELL * 8, CELL * 14);
        drawDefeatCellMarkers(FIELD_RIGHT);
        for (let i = 0; i < COLUMNS; i += 1) { context.fillStyle = '#0a1d29'; context.fillRect(FIELD_RIGHT + i * CELL + 3, FIELD_TOP - CELL + 3, CELL - 6, CELL - 6); context.strokeStyle = 'rgba(176,232,244,.25)'; context.strokeRect(FIELD_RIGHT + i * CELL + 3, FIELD_TOP - CELL + 3, CELL - 6, CELL - 6); }
        drawWarningUnits(FIELD_RIGHT, FIELD_TOP - CELL, warningUnits(warningAmount(simulator.target, player)));
        drawEnergyTransfers();
        context.textAlign = 'center';
        getSimulatorPaletteItems().forEach((item, index) => {
            const focused = simulator.focusArea === 'palette' && simulator.paletteFocus === index;
            const selected = (item.kind === 'puyo' || item.kind === 'eraser') && simulator.selected === item.value;
            context.fillStyle = item.kind === 'play' ? '#4cc9b0' : item.kind === 'exit' ? '#ef5350' : '#173747'; context.fillRect(item.x, item.y, item.width, item.height);
            if (selected) { context.strokeStyle = '#46d7c4'; context.lineWidth = 4; context.strokeRect(item.x + 4, item.y + 4, item.width - 8, item.height - 8); }
            context.strokeStyle = focused ? '#ffd54f' : '#497180'; context.lineWidth = focused ? 4 : 2; context.strokeRect(item.x, item.y, item.width, item.height);
            if (item.kind === 'puyo') drawPuyo(item.x, item.y, item.value);
            else if (item.kind === 'eraser') { context.strokeStyle = '#f4f7f8'; context.lineWidth = 7; context.beginPath(); context.moveTo(item.x + 8, item.y + CELL - 8); context.lineTo(item.x + CELL - 8, item.y + 8); context.stroke(); }
            else {
                const labels = { play: '▶', exit: translate('종료'), copyJson: translate('JSON복사'), pasteJson: translate('JSON넣기') };
                context.fillStyle = '#fff'; context.font = item.kind === 'play' ? '24px sans-serif' : `15px ${BUTTON_FONT}`;
                context.fillText(labels[item.kind], item.x + item.width / 2, item.y + 26);
            }
        });
        if (simulator.mode !== 'draw') {
            context.fillStyle = 'rgba(3, 11, 19, 0.62)';
            context.fillRect(FIELD_RIGHT, FIELD_TOP, CELL * COLUMNS, CELL * VISIBLE_ROWS);
        }
        if (simulator.mode === 'complete') {
            context.fillStyle = '#4cc9b0'; context.fillRect(600, 145, 150, 58);
            context.strokeStyle = '#ffd54f'; context.lineWidth = 4; context.strokeRect(600, 145, 150, 58);
            context.fillStyle = '#fff'; context.font = `22px ${BUTTON_FONT}`; context.fillText(translate('그리기'), 675, 183);
        }
        context.fillStyle = '#d8f2f5'; context.font = `18px ${MESSAGE_FONT}`; context.fillText(simulator.mode === 'draw' ? translate('그리기') : translate('시뮬레이션'), 675, 486); context.font = `30px ${MESSAGE_FONT}`; context.fillStyle = '#f7c843'; context.fillText(formatPoint(player.point), 675, 536); context.font = `17px ${MESSAGE_FONT}`; context.fillStyle = '#a9d9e5'; context.fillText('POINT', 675, 566);
    }

    /** 초기 타이틀을 그리고 시작 조작을 안내한다. @returns {void} */
    function drawInitialTitle() {
        context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
        context.textAlign = 'center'; context.fillStyle = '#d8f2f5'; context.font = `58px ${TITLE_FONT}`;
        context.fillText(translate('뿌요 W'), WIDTH / 2, 115);
        if (initialGalleryPreview.loaded && initialGalleryPreview.items.length) {
            const offset = Math.floor(initialGalleryPreview.elapsed / 2000);
            const index = (initialGalleryPreview.startIndex + offset) % initialGalleryPreview.items.length;
            initialGalleryPreview.items[index].draw();
        }
        context.fillStyle = '#f5fbfc'; context.font = `22px ${MESSAGE_FONT}`;
        context.fillText(translate('ENTER 혹은 클릭하여 시작'), WIDTH / 2, HEIGHT - 70);
    }

    /** 포커스 가능한 게임 규칙 선택지의 실제 배열 순번을 반환한다. @returns {number[]} 포커스 가능한 선택지 순번 */
    function getSelectableRuleOptionIndices() {
        return GAME_RULE_OPTIONS.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
    }

    /** 게임 규칙 선택지 하나의 화면 영역을 반환한다. @param {number} index 선택지 순번 @returns {{x:number,y:number,width:number,height:number}} 버튼 영역 */
    function getRuleSelectionButtonBounds(index) {
        const width = 280;
        const height = 78;
        const gap = 24;
        if (index === GAME_RULE_OPTIONS.length - 1) {
            return { x: WIDTH / 2 - width - gap / 2, y: 475, width, height };
        }
        const columns = 2;
        const rows = 2;
        const totalWidth = columns * width + (columns - 1) * gap;
        const totalHeight = rows * height + (rows - 1) * gap;
        return {
            x: (WIDTH - totalWidth) / 2 + (index % columns) * (width + gap),
            y: (HEIGHT - totalHeight) / 2 + Math.floor(index / columns) * (height + gap),
            width,
            height
        };
    }

    /** 게임 규칙 선택 오버레이 하단 취소 버튼의 화면 영역을 반환한다. @returns {{x:number,y:number,width:number,height:number}} 취소 버튼 영역 */
    function getRuleSelectionCancelButtonBounds() {
        const optionBounds = getRuleSelectionButtonBounds(GAME_RULE_OPTIONS.length - 1);
        return { x: WIDTH / 2 + 12, y: optionBounds.y, width: optionBounds.width, height: optionBounds.height };
    }

    /** 메인 메뉴 위에 게임 규칙 선택 오버레이를 연다. @returns {void} */
    function openRuleSelection() {
        ruleSelectionOpen = true;
        ruleSelectionFocus = getSelectableRuleOptionIndices()[0] ?? 0;
    }

    /** 게임 규칙 선택 오버레이를 닫고 메인 메뉴로 돌아간다. @returns {void} */
    function closeRuleSelection() {
        ruleSelectionOpen = false;
        ruleSelectionFocus = 0;
        opponentMenuRule = 'standard';
    }

    /** 현재 색상 수 선택 화면에서 고를 수 있는 DIFFICULTIES의 인덱스다. @returns {number[]} */
    function getSelectableColorDifficultyIndices() {
        return DIFFICULTIES.map((difficulty, index) => index);
    }

    /**
     * 세 색상 수 선택지를 화면 중앙에 수평 정렬한 왼쪽 좌표를 반환한다.
     * @param {number} difficultyIndex DIFFICULTIES 배열 인덱스
     * @returns {number} 버튼의 왼쪽 좌표
     */
    function getColorDifficultyButtonX(difficultyIndex) {
        const buttonWidth = 110;
        const gap = 10;
        const totalWidth = DIFFICULTIES.length * buttonWidth + (DIFFICULTIES.length - 1) * gap;
        return (WIDTH - totalWidth) / 2 + difficultyIndex * (buttonWidth + gap);
    }

    /** 연습·연속 피버 색상 수 선택 화면 하단 취소 버튼의 화면 영역을 반환한다. @returns {{x:number,y:number,width:number,height:number}} 취소 버튼 영역 */
    function getColorSelectionCancelButtonBounds() {
        return { x: WIDTH / 2 - 100, y: 445, width: 200, height: 58 };
    }

    /** 색상 수 선택을 취소하고 게임 규칙 선택 화면으로 돌아간다. @returns {void} */
    function returnToRuleSelection() {
        playMenuCancelSound();
        menuScreen = 'title';
        openRuleSelection();
    }

    /** AI 난이도 선택지를 개수와 관계없이 화면 중앙에 수평 정렬한다. @param {number} difficultyIndex AI_DIFFICULTIES 배열 인덱스 @returns {number} 버튼의 왼쪽 좌표 */
    function getAiDifficultyButtonX(difficultyIndex) {
        const buttonWidth = 110;
        const gap = 10;
        const totalWidth = AI_DIFFICULTIES.length * buttonWidth + (AI_DIFFICULTIES.length - 1) * gap;
        return (WIDTH - totalWidth) / 2 + difficultyIndex * (buttonWidth + gap);
    }

    /** 게임 규칙 선택지에서 연습을 고른 뒤 색상 수 선택 화면을 연다. @returns {void} */
    function openPracticeDifficulty() {
        selectedDifficulty = 1;
        colorSelectionFocus = selectedDifficulty;
        colorSelectionMode = 'practice';
        menuScreen = 'practiceDifficulty';
    }

    /** 게임 규칙 선택지에서 연속 피버를 고른 뒤 3색·4색·5색 선택 화면을 연다. @returns {void} */
    function openContinuousFeverDifficulty() {
        selectedDifficulty = 1;
        colorSelectionFocus = selectedDifficulty;
        colorSelectionMode = 'continuousFever';
        menuScreen = 'practiceDifficulty';
    }

    /** 포커스된 게임 규칙을 선택한다. @returns {void} */
    function activateRuleSelection() {
        if (ruleSelectionFocus === RULE_SELECTION_CANCEL_INDEX) {
            playMenuCancelSound();
            closeRuleSelection();
            return;
        }
        const option = GAME_RULE_OPTIONS[ruleSelectionFocus];
        if (!option || option.disabled) return;
        playMenuSelectSound();
        closeRuleSelection();
        option.activate();
    }

    /** 게임 규칙 선택 오버레이의 키보드·게임패드 키 입력을 처리한다. @param {string} key 소문자 키 이름 @returns {void} */
    function handleRuleSelectionKey(key) {
        if (key === 'escape') { playMenuCancelSound(); closeRuleSelection(); return; }
        if (key === 'enter' || key === ' ') { activateRuleSelection(); return; }
        if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) return;
        if (ruleSelectionFocus === RULE_SELECTION_CANCEL_INDEX) {
            if (key === 'arrowleft') ruleSelectionFocus = GAME_RULE_OPTIONS.length - 1;
            else if (key === 'arrowup') ruleSelectionFocus = GAME_RULE_OPTIONS.length - 2;
            return;
        }
        if (ruleSelectionFocus === GAME_RULE_OPTIONS.length - 1) {
            if (key === 'arrowright') ruleSelectionFocus = RULE_SELECTION_CANCEL_INDEX;
            else if (key === 'arrowup') ruleSelectionFocus = 2;
            return;
        }
        if (ruleSelectionFocus === GAME_RULE_OPTIONS.length - 2 && key === 'arrowdown') {
            ruleSelectionFocus = RULE_SELECTION_CANCEL_INDEX;
            return;
        }
        const columns = 2;
        const row = Math.floor(ruleSelectionFocus / columns);
        const column = ruleSelectionFocus % columns;
        const rowDelta = key === 'arrowup' ? -1 : key === 'arrowdown' ? 1 : 0;
        const columnDelta = key === 'arrowleft' ? -1 : key === 'arrowright' ? 1 : 0;
        if (key === 'arrowdown' && row === Math.ceil(GAME_RULE_OPTIONS.length / columns) - 1) {
            ruleSelectionFocus = RULE_SELECTION_CANCEL_INDEX;
            return;
        }
        const nextRow = row + rowDelta;
        const nextColumn = column + columnDelta;
        if (nextRow < 0 || nextRow >= Math.ceil(GAME_RULE_OPTIONS.length / columns) || nextColumn < 0 || nextColumn >= columns) return;
        const nextIndex = nextRow * columns + nextColumn;
        if (GAME_RULE_OPTIONS[nextIndex] && !GAME_RULE_OPTIONS[nextIndex].disabled) ruleSelectionFocus = nextIndex;
    }

    /** 메인 메뉴 위에 게임 규칙 선택 오버레이를 그린다. @returns {void} */
    function drawRuleSelectionOverlay() {
        context.fillStyle = 'rgba(3, 11, 19, 0.76)'; context.fillRect(0, 0, WIDTH, HEIGHT);
        GAME_RULE_OPTIONS.forEach((option, index) => {
            const bounds = getRuleSelectionButtonBounds(index);
            const disabled = option.disabled === true;
            const focused = !disabled && index === ruleSelectionFocus;
            context.fillStyle = disabled ? '#3c4650' : option.backgroundColor; context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            context.strokeStyle = disabled ? '#7c8791' : focused ? '#f7c843' : '#4f7788'; context.lineWidth = focused ? 4 : 2; context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            context.textAlign = 'center'; context.fillStyle = disabled ? '#c4cbd0' : '#f5fbfc'; context.font = `22px ${BUTTON_FONT}`;
            context.fillText(translate(option.label), bounds.x + bounds.width / 2, bounds.y + (option.statusLabel ? 32 : 47));
            if (option.statusLabel) {
                context.fillStyle = disabled ? '#f0c674' : '#f5fbfc'; context.font = `15px ${BUTTON_FONT}`;
                context.fillText(translate(option.statusLabel), bounds.x + bounds.width / 2, bounds.y + 59);
            }
        });
        const cancelBounds = getRuleSelectionCancelButtonBounds();
        const cancelFocused = ruleSelectionFocus === RULE_SELECTION_CANCEL_INDEX;
        context.fillStyle = '#455a64'; context.fillRect(cancelBounds.x, cancelBounds.y, cancelBounds.width, cancelBounds.height);
        context.strokeStyle = cancelFocused ? '#f7c843' : '#607d8b'; context.lineWidth = cancelFocused ? 4 : 2;
        context.strokeRect(cancelBounds.x, cancelBounds.y, cancelBounds.width, cancelBounds.height);
        context.textAlign = 'center'; context.fillStyle = '#f5fbfc'; context.font = `22px ${BUTTON_FONT}`;
        context.fillText(translate('취소'), cancelBounds.x + cancelBounds.width / 2, cancelBounds.y + 47);
    }

    /** 퍼즐뿌요 취소 카드와 스테이지 카드 전체 수를 반환한다. @returns {number} 카드 수 */
    function getPuzzleStageCardCount() {
        return PUZZLE_STAGES.length + 1;
    }

    /** 현재 화면에 표시할 퍼즐뿌요 카드 수를 반환한다. @returns {number} 표시 카드 수 */
    function getVisiblePuzzleStageCardCount() {
        return Math.min(PUZZLE_STAGE_VISIBLE_CARD_COUNT, getPuzzleStageCardCount());
    }

    /** 퍼즐뿌요 스테이지 또는 취소 가상 순번을 카드 슬롯으로 바꾼다. @param {number} index 스테이지 순번 또는 취소 가상 순번(-1) @returns {number} 카드 슬롯 */
    function getPuzzleStageCardSlot(index) {
        return index === PUZZLE_STAGE_CANCEL_INDEX ? 0 : index + 1;
    }

    /** 카드 슬롯을 퍼즐뿌요 스테이지 또는 취소 가상 순번으로 바꾼다. @param {number} slot 카드 슬롯 @returns {number} 스테이지 순번 또는 취소 가상 순번 */
    function getPuzzleStageIndexFromSlot(slot) {
        return slot === 0 ? PUZZLE_STAGE_CANCEL_INDEX : slot - 1;
    }

    /** 현재 가능한 퍼즐뿌요 선택 줄의 최대 스크롤 오프셋을 반환한다. @returns {number} 최대 오프셋 */
    function getPuzzleStageScrollLimit() {
        return Math.max(0, getPuzzleStageCardCount() - getVisiblePuzzleStageCardCount());
    }

    /** 퍼즐뿌요 선택 줄의 스크롤 값을 유효 범위로 보정한다. @returns {void} */
    function normalizePuzzleStageScrollOffset() {
        puzzleStageScrollOffset = Math.max(0, Math.min(getPuzzleStageScrollLimit(), puzzleStageScrollOffset));
    }

    /** 지정한 카드가 현재 퍼즐뿌요 선택 줄에 보이는지 반환한다. @param {number} index 스테이지 순번 또는 취소 가상 순번 @returns {boolean} 표시 여부 */
    function isPuzzleStageCardVisible(index) {
        normalizePuzzleStageScrollOffset();
        const slot = getPuzzleStageCardSlot(index);
        return slot >= puzzleStageScrollOffset && slot < puzzleStageScrollOffset + getVisiblePuzzleStageCardCount();
    }

    /** 포커스된 퍼즐뿌요 카드가 화면 안에 들어오도록 선택 줄을 스크롤한다. @returns {void} */
    function scrollPuzzleStageFocusIntoView() {
        normalizePuzzleStageScrollOffset();
        const slot = getPuzzleStageCardSlot(puzzleStageFocus);
        const visibleCount = getVisiblePuzzleStageCardCount();
        if (slot < puzzleStageScrollOffset) puzzleStageScrollOffset = slot;
        else if (slot >= puzzleStageScrollOffset + visibleCount) puzzleStageScrollOffset = slot - visibleCount + 1;
        normalizePuzzleStageScrollOffset();
    }

    /** 퍼즐뿌요 선택 줄을 한 카드만큼 스크롤한다. @param {number} direction 왼쪽 -1 또는 오른쪽 1 @returns {boolean} 스크롤 여부 */
    function scrollPuzzleStageSelection(direction) {
        normalizePuzzleStageScrollOffset();
        const nextOffset = Math.max(0, Math.min(getPuzzleStageScrollLimit(), puzzleStageScrollOffset + (direction < 0 ? -1 : 1)));
        if (nextOffset === puzzleStageScrollOffset) return false;
        puzzleStageScrollOffset = nextOffset;
        return true;
    }

    /** 퍼즐뿌요 선택 줄을 지정한 방향으로 스크롤할 수 있는지 반환한다. @param {number} direction 왼쪽 -1 또는 오른쪽 1 @returns {boolean} 스크롤 가능 여부 */
    function canScrollPuzzleStageSelection(direction) {
        normalizePuzzleStageScrollOffset();
        return direction < 0 ? puzzleStageScrollOffset > 0 : puzzleStageScrollOffset < getPuzzleStageScrollLimit();
    }

    /** 퍼즐뿌요 선택 줄 스크롤 화살표의 화면 영역을 반환한다. @param {number} direction 왼쪽 -1 또는 오른쪽 1 @returns {{x:number,y:number,width:number,height:number}|null} 화살표 영역 */
    function getPuzzleStageScrollButtonBounds(direction) {
        if (!canScrollPuzzleStageSelection(direction)) return null;
        const visibleCount = getVisiblePuzzleStageCardCount();
        const slot = direction < 0 ? puzzleStageScrollOffset : puzzleStageScrollOffset + visibleCount - 1;
        const cardBounds = getPuzzleStageButtonBounds(getPuzzleStageIndexFromSlot(slot));
        return { x: cardBounds.x + cardBounds.width / 2 - 32, y: cardBounds.y + cardBounds.height + 13, width: 64, height: 34 };
    }

    /** 퍼즐뿌요 스테이지 또는 취소 카드의 화면 영역을 반환한다. @param {number} index 스테이지 순번 또는 취소 가상 순번(-1) @returns {{x:number,y:number,width:number,height:number}} 카드 영역 */
    function getPuzzleStageButtonBounds(index) {
        normalizePuzzleStageScrollOffset();
        const width = 190;
        const height = 110;
        const gap = 14;
        const visibleCount = getVisiblePuzzleStageCardCount();
        const totalWidth = visibleCount * width + Math.max(0, visibleCount - 1) * gap;
        const slot = getPuzzleStageCardSlot(index);
        return { x: (WIDTH - totalWidth) / 2 + (slot - puzzleStageScrollOffset) * (width + gap), y: 500, width, height };
    }

    /** 퍼즐뿌요 스테이지 카드의 클리어 또는 별 달성 표식을 글자보다 먼저 그린다. @param {{x:number,y:number,width:number,height:number}} bounds 카드 영역 @param {number} stageIndex 스테이지 순번 @returns {void} */
    function drawPuzzleStageCompletionMarker(bounds, stageIndex) {
        const earnedStar = store.puzzleStarStages.includes(stageIndex);
        if (!earnedStar && !store.puzzleClearStages.includes(stageIndex)) return;
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        context.save();
        context.globalAlpha = 0.72;
        context.fillStyle = '#f7c843';
        context.beginPath();
        if (earnedStar) {
            for (let point = 0; point < 10; point += 1) {
                const angle = -Math.PI / 2 + point * Math.PI / 5;
                const radius = point % 2 === 0 ? 34 : 15;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                if (point === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
            }
            context.closePath();
        } else context.arc(centerX, centerY, 30, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }

    /** 퍼즐뿌요 스테이지 선택 화면을 그린다. @returns {void} */
    function drawPuzzleStageSelection() {
        const stage = puzzleStageFocus === PUZZLE_STAGE_CANCEL_INDEX ? null : (PUZZLE_STAGES[puzzleStageFocus] || PUZZLE_STAGES[0]);
        context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
        context.textAlign = 'center'; context.fillStyle = '#d8f2f5'; context.font = `48px ${TITLE_FONT}`;
        context.fillText(translate('퍼즐뿌요 스테이지'), WIDTH / 2, 105);
        if (stage) {
            context.fillStyle = '#f7c843'; context.font = `38px ${TITLE_FONT}`;
            context.fillText(getPuzzleConditionText(stage), WIDTH / 2, 255);
            if (stage.hint) {
                context.fillStyle = '#b8dbe2'; context.font = `20px ${MESSAGE_FONT}`;
                context.fillText(translate(stage.hint), WIDTH / 2, 300);
            }
            context.fillStyle = '#d8f2f5'; context.font = `18px ${MESSAGE_FONT}`;
            context.fillText(translate('권장 턴 수 %1', stage.turnLimit), WIDTH / 2, 342);
        }
        const openedCount = getOpenedPuzzleStageCount();
        PUZZLE_STAGES.forEach((item, index) => {
            if (!isPuzzleStageCardVisible(index)) return;
            const bounds = getPuzzleStageButtonBounds(index);
            const opened = index < openedCount;
            const focused = opened && index === puzzleStageFocus;
            context.fillStyle = opened ? '#236a8b' : '#3c4650'; context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            context.strokeStyle = focused ? '#f7c843' : opened ? '#65b9d8' : '#7c8791'; context.lineWidth = focused ? 4 : 2; context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            drawPuzzleStageCompletionMarker(bounds, index);
            context.fillStyle = opened ? '#f5fbfc' : '#c4cbd0'; context.font = `24px ${BUTTON_FONT}`;
            context.fillText(translate('스테이지 %1', index + 1), bounds.x + bounds.width / 2, bounds.y + 43);
            context.font = `16px ${MESSAGE_FONT}`;
            context.fillText(opened ? getPuzzleConditionText(item) : translate('잠김'), bounds.x + bounds.width / 2, bounds.y + 78);
        });
        if (isPuzzleStageCardVisible(PUZZLE_STAGE_CANCEL_INDEX)) {
            const cancelBounds = getPuzzleStageButtonBounds(PUZZLE_STAGE_CANCEL_INDEX);
            const cancelFocused = puzzleStageFocus === PUZZLE_STAGE_CANCEL_INDEX;
            context.fillStyle = '#455a64'; context.fillRect(cancelBounds.x, cancelBounds.y, cancelBounds.width, cancelBounds.height);
            context.strokeStyle = cancelFocused ? '#f7c843' : '#607d8b'; context.lineWidth = cancelFocused ? 4 : 2; context.strokeRect(cancelBounds.x, cancelBounds.y, cancelBounds.width, cancelBounds.height);
            context.fillStyle = '#f5fbfc'; context.font = `24px ${BUTTON_FONT}`; context.fillText(translate('취소'), cancelBounds.x + cancelBounds.width / 2, cancelBounds.y + 62);
        }
        [-1, 1].forEach((direction) => {
            const bounds = getPuzzleStageScrollButtonBounds(direction);
            if (!bounds) return;
            context.fillStyle = '#264b5b'; context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            context.strokeStyle = '#6bbce8'; context.lineWidth = 2; context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            context.fillStyle = '#d8f2f5'; context.beginPath();
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            context.moveTo(centerX + (direction < 0 ? -10 : 10), centerY);
            context.lineTo(centerX + (direction < 0 ? 7 : -7), centerY - 9);
            context.lineTo(centerX + (direction < 0 ? 7 : -7), centerY + 9);
            context.closePath();
            context.fill();
        });
    }

    /**
     * 클릭 가능한 게임 시작 메뉴를 그린다.
     * @returns {void}
     */
    function drawMenu() {
        context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
        if (menuScreen === 'title') drawMainMenuGalleryFloaters();
        const opponentMenuScaled = menuScreen === 'opponent';
        if (opponentMenuScaled) {
            context.save();
            context.translate(WIDTH / 2, HEIGHT / 2);
            context.scale(OPPONENT_MENU_SCALE, OPPONENT_MENU_SCALE);
            context.translate(-WIDTH / 2, -HEIGHT / 2);
        }
        context.textAlign = 'center'; context.fillStyle = '#d8f2f5'; context.font = `54px ${TITLE_FONT}`; context.fillText(translate('뿌요 W'), WIDTH / 2, menuScreen === 'opponent' ? 90 : 110);
        if (menuScreen === 'puzzleStage') {
            drawPuzzleStageSelection();
            return;
        }
        if (menuScreen === 'opponent') {
            DIFFICULTIES.forEach((difficulty, index) => {
                const x = getColorDifficultyButtonX(index);
                const selected = index === selectedDifficulty;
                context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(x, 135, 110, 44);
                context.strokeStyle = opponentMenuFocus === 0 && selected ? '#f7c843' : '#3b6070'; context.lineWidth = opponentMenuFocus === 0 && selected ? 4 : 2;
                context.strokeRect(x, 135, 110, 44);
                context.fillStyle = '#f5fbfc'; context.font = `17px ${BUTTON_FONT}`; context.fillText(translate(difficulty.name), x + 55, 163);
            });
            AI_DIFFICULTIES.forEach((difficulty, index) => {
                const x = getAiDifficultyButtonX(index);
                const selected = index === selectedAiDifficulty;
                context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(x, 195, 110, 44);
                context.strokeStyle = opponentMenuFocus === 1 && selected ? '#f7c843' : '#3b6070'; context.lineWidth = opponentMenuFocus === 1 && selected ? 4 : 2;
                context.strokeRect(x, 195, 110, 44);
                context.fillStyle = '#f5fbfc'; context.font = `17px ${BUTTON_FONT}`; context.fillText(translate(difficulty.name), x + 55, 223);
            });
            context.fillStyle = '#d8f2f5'; context.font = `22px ${TITLE_FONT}`; context.fillText(translate('적 선택'), WIDTH / 2, 285);
            ensureSelectedOpponent();
            const opponent = OPPONENTS[selectedOpponent];
            context.fillStyle = '#0b202c'; context.fillRect(WIDTH / 2 - 170, 300, 340, 170);
            context.strokeStyle = opponentMenuFocus === 2 ? '#f7c843' : '#ef8aa0'; context.lineWidth = opponentMenuFocus === 2 ? 4 : 3; context.strokeRect(WIDTH / 2 - 170, 300, 340, 170);
            if (opponent) {
                opponent.createController().drawPortrait(context, WIDTH / 2, 375, 0.62);
                context.fillStyle = '#f5fbfc'; context.font = `28px ${BUTTON_FONT}`; context.fillText(translate(opponent.createController().getName()), WIDTH / 2, 450);
            }
            const previousOpponent = getRelativeSelectableOpponent(-1);
            const nextOpponent = getRelativeSelectableOpponent(1);
            context.fillStyle = opponentMenuFocus === 2 ? '#f7c843' : '#6bbce8';
            if (previousOpponent) {
                context.beginPath();
                context.moveTo(WIDTH / 2 - 205, 385);
                context.lineTo(WIDTH / 2 - 175, 360);
                context.lineTo(WIDTH / 2 - 175, 410);
                context.closePath();
                context.fill();
            }
            if (nextOpponent) {
                context.beginPath();
                context.moveTo(WIDTH / 2 + 205, 385);
                context.lineTo(WIDTH / 2 + 175, 360);
                context.lineTo(WIDTH / 2 + 175, 410);
                context.closePath();
                context.fill();
            }
            const visibleOpponents = getVisibleOpponents();
            const selectedVisibleIndex = visibleOpponents.indexOf(opponent);
            visibleOpponents.forEach((entry, index) => {
                const cardX = WIDTH / 2 - 80 + (index - selectedVisibleIndex) * 180;
                const selected = entry === opponent;
                const locked = !entry.notAvail && !isOpponentUnlocked(entry);
                const disabled = entry.notAvail || locked;
                context.fillStyle = disabled ? '#3c4650' : selected ? '#563068' : '#0b202c'; context.fillRect(cardX, 475, 160, 62);
                context.strokeStyle = disabled ? '#7c8791' : selected ? '#ef8aa0' : '#3b6070'; context.lineWidth = 2; context.strokeRect(cardX, 475, 160, 62);
                if (disabled) {
                    context.save();
                    context.globalAlpha = 0.42;
                    entry.createController().drawPortrait(context, cardX + 24, 495, 0.14);
                    context.restore();
                    // 잠긴 적은 이름을 숨긴다. 출시 예정 적은 기존처럼 이름과 안내를 함께 표시한다.
                    if (entry.notAvail) {
                        context.fillStyle = '#c4cbd0'; context.font = `15px ${BUTTON_FONT}`; context.fillText(translate(entry.createController().getName()), cardX + 94, 500);
                    }
                    context.fillStyle = '#f0c674'; context.font = `13px ${BUTTON_FONT}`; context.fillText(translate(entry.notAvail ? '추후 출시예정' : '잠김'), cardX + 80, entry.notAvail ? 524 : 500);
                } else {
                    context.fillStyle = '#f5fbfc'; context.font = `17px ${BUTTON_FONT}`; context.fillText(translate(entry.createController().getName()), cardX + 80, 513);
                }
            });
            context.fillStyle = '#ef5350'; context.fillRect(440, 600, 250, 58);
            context.strokeStyle = opponentMenuFocus === 3 && selectedOpponentAction === 0 ? '#f7c843' : '#ef5350'; context.lineWidth = opponentMenuFocus === 3 && selectedOpponentAction === 0 ? 4 : 2; context.strokeRect(440, 600, 250, 58);
            context.fillStyle = '#fff'; context.font = `20px ${BUTTON_FONT}`; context.fillText(translate('시작'), 565, 637);
            context.fillStyle = '#264b5b'; context.fillRect(710, 600, 130, 58);
            context.strokeStyle = opponentMenuFocus === 3 && selectedOpponentAction === 1 ? '#f7c843' : '#264b5b'; context.lineWidth = opponentMenuFocus === 3 && selectedOpponentAction === 1 ? 4 : 2; context.strokeRect(710, 600, 130, 58);
            context.fillStyle = '#d8f2f5'; context.font = `18px ${BUTTON_FONT}`; context.fillText(translate('이전'), 775, 637);
            context.restore();
            return;
        }
        const menuX = WIDTH / 2 - 109; const menuWidth = 218; const menuHeight = 46; const menuStartY = 280; const menuGap = 10;
        const titleOptions = [
            { label: '게임 시작', color: '#ef5350' }, { label: '시뮬레이터', color: '#34556b' }, { label: '플레이 방법', color: '#405c70' },
            { label: '갤러리', color: '#405c70' }, { label: '설정', color: '#405c70' }
        ];
        titleOptions.forEach((option, index) => {
            const y = menuStartY + index * (menuHeight + menuGap);
            context.fillStyle = option.color; context.fillRect(menuX, y, menuWidth, menuHeight);
            context.strokeStyle = titleMenuFocus === index ? '#f7c843' : option.color; context.lineWidth = titleMenuFocus === index ? 4 : 2; context.strokeRect(menuX, y, menuWidth, menuHeight);
            context.fillStyle = '#e3f4ff'; context.font = `20px ${BUTTON_FONT}`; context.fillText(translate(option.label), WIDTH / 2, y + 30);
        });
        context.fillStyle = '#24292f'; context.fillRect(32, 665, 85, 23);
        context.strokeStyle = titleMenuFocus === 5 ? '#f7c843' : '#52606d'; context.lineWidth = titleMenuFocus === 5 ? 2 : 1; context.strokeRect(32, 665, 85, 23);
        context.fillStyle = '#ffffff'; context.font = `10px ${BUTTON_FONT}`; context.fillText(translate('GitHub'), 74.5, 681);
        context.fillStyle = store.muted ? '#52606d' : '#264b5b'; context.fillRect(WIDTH - 117, 665, 85, 23);
        context.strokeStyle = titleMenuFocus === 6 ? '#f7c843' : '#52606d'; context.lineWidth = titleMenuFocus === 6 ? 2 : 1; context.strokeRect(WIDTH - 117, 665, 85, 23);
        context.fillStyle = '#ffffff'; context.font = `10px ${BUTTON_FONT}`; context.fillText(translate(store.muted ? '음소거(활성)' : '음소거(꺼짐)'), WIDTH - 74.5, 681);
        context.fillStyle = '#8899a6'; context.font = `14px ${MESSAGE_FONT}`; context.fillText('Copyright (c) HJOW', WIDTH / 2, HEIGHT - 20);
        if (menuScreen === 'practiceDifficulty') {
            context.fillStyle = 'rgba(3, 11, 19, 0.76)'; context.fillRect(0, 0, WIDTH, HEIGHT);
            context.fillStyle = '#d8f2f5'; context.font = `30px ${TITLE_FONT}`; context.fillText(translate('선택'), WIDTH / 2, 300);
            DIFFICULTIES.forEach((difficulty, index) => {
                if (!getSelectableColorDifficultyIndices().includes(index)) return;
                const x = getColorDifficultyButtonX(index);
                const selected = index === selectedDifficulty;
                context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(x, 335, 110, 58);
                const focused = colorSelectionFocus === index;
                context.strokeStyle = focused ? '#f7c843' : '#3b6070'; context.lineWidth = focused ? 4 : 2; context.strokeRect(x, 335, 110, 58);
                context.fillStyle = '#f5fbfc'; context.font = `17px ${BUTTON_FONT}`; context.fillText(translate(difficulty.name), x + 55, 371);
            });
            const cancelBounds = getColorSelectionCancelButtonBounds();
            const cancelFocused = colorSelectionFocus === COLOR_SELECTION_CANCEL_INDEX;
            context.fillStyle = '#455a64'; context.fillRect(cancelBounds.x, cancelBounds.y, cancelBounds.width, cancelBounds.height);
            context.strokeStyle = cancelFocused ? '#f7c843' : '#607d8b'; context.lineWidth = cancelFocused ? 4 : 2;
            context.strokeRect(cancelBounds.x, cancelBounds.y, cancelBounds.width, cancelBounds.height);
            context.fillStyle = '#f5fbfc'; context.font = `20px ${BUTTON_FONT}`; context.fillText(translate('취소'), WIDTH / 2, cancelBounds.y + 37);
        }
        // 공지사항은 부유하는 뿌요와 모든 메인 메뉴 요소 위에 그린다.
        if (menuScreen === 'title') drawNotice();
        if (menuScreen === 'title' && ruleSelectionOpen) drawRuleSelectionOverlay();
    }

    /**
     * 진행 중인 화면 위에 일시정지 오버레이와 조작 버튼을 그린다.
     * @returns {void}
     */
    function drawPauseOverlay() {
        context.fillStyle = 'rgba(3, 11, 19, 0.72)';
        context.fillRect(0, 0, WIDTH, HEIGHT);
        context.textAlign = 'center';
        context.fillStyle = '#f5fbfc';
        context.font = `48px ${TITLE_FONT}`;
        context.fillText(translate('일시정지'), WIDTH / 2, 322);
        context.fillStyle = '#4cc9b0';
        context.fillRect(470, 376, 150, 64);
        context.strokeStyle = pauseMenuFocus === 0 ? '#f7c843' : '#4cc9b0';
        context.lineWidth = pauseMenuFocus === 0 ? 4 : 2;
        context.strokeRect(470, 376, 150, 64);
        context.fillStyle = '#ef5350';
        context.fillRect(660, 376, 150, 64);
        context.strokeStyle = pauseMenuFocus === 1 ? '#f7c843' : '#ef5350';
        context.lineWidth = pauseMenuFocus === 1 ? 4 : 2;
        context.strokeRect(660, 376, 150, 64);
        context.fillStyle = '#ffffff';
        context.font = `23px ${BUTTON_FONT}`;
        context.fillText(translate('재개'), 545, 417);
        context.fillText(translate('종료'), 735, 417);
    }

    /**
     * 현재 메뉴 또는 실행 중인 게임의 한 프레임을 렌더링한다.
     * @returns {void}
     */
    function render() {
        applyCanvasCoordinateTransform();
        context.clearRect(0, 0, WIDTH, HEIGHT);
        if (settingsResetting) {
            drawSettingsResetting();
        } else if (!game) {
            // 진행 중인 게임이 없으면 현재 메뉴 화면만 렌더링한다.
            if (menuScreen === 'initialTitle') drawInitialTitle();
            else if (menuScreen === 'simulator' && simulator) drawSimulator();
            else if (menuScreen === 'settings' && settingsDraft) drawSettings();
            else if (menuScreen === 'gallery' && gallery) drawGallery();
            else drawMenu();
        } else if (game.tutorial) {
            drawTutorial();
        } else if (!game.running) {
            context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
            // 게임이 끝났으면 결과 화면으로 전환한다.
            drawResultField(game.players[0]); drawResultField(game.players[1]); drawResultCenter();
        } else {
            context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
            drawField(game.players[0], game.players[1]); drawField(game.players[1], game.players[0]); drawCenter(); drawEnergyTransfers();
            if (shouldShowVirtualController()) drawVirtualController();
            // 시작 또는 재개 카운트다운 중에는 카운트다운 오버레이를 최상단에 표시한다.
            if (game.countdown > 0) {
                context.fillStyle = 'rgba(3, 11, 19, 0.62)'; context.fillRect(0, 0, WIDTH, HEIGHT);
                context.textAlign = 'center'; context.fillStyle = '#f5fbfc'; context.font = `76px ${TITLE_FONT}`;
                context.fillText(String(Math.ceil(game.countdown / 1000)), WIDTH / 2, 390);
            } else if (game.paused) {
                drawPauseOverlay();
            }
        }
        drawScreenMessage();
        drawGameStartFirework();
    }

    /** 화면 최상단에 표시 중인 외부 메시지를 그린다. @returns {void} */
    function drawScreenMessage() {
        if (!screenMessage) return;
        const fadeProgress = Math.max(0, Math.min(1, (screenMessage.elapsed - screenMessage.duration) / SCREEN_MESSAGE_FADE_DURATION));
        context.save();
        context.globalAlpha = 1 - fadeProgress;
        context.textAlign = 'center';
        context.font = `28px ${MESSAGE_FONT}`;
        if (screenMessage.backgroundColor !== null) {
            const metrics = context.measureText(screenMessage.message);
            const textWidth = metrics.width;
            const textAscent = Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : 28;
            const textDescent = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : 7;
            const paddingX = 10;
            const paddingY = 6;
            const backgroundWidth = textWidth + paddingX * 2;
            const backgroundHeight = textAscent + textDescent + paddingY * 2;
            context.fillStyle = screenMessage.backgroundColor;
            context.fillRect(WIDTH / 2 - backgroundWidth / 2, 70 - textAscent - paddingY, backgroundWidth, backgroundHeight);
        }
        context.fillStyle = screenMessage.color;
        context.fillText(screenMessage.message, WIDTH / 2, 70);
        context.restore();
    }

    /** 화면 최상단 메시지의 경과 시간을 갱신한다. @param {number} delta 이전 프레임 후 경과한 밀리초 @returns {void} */
    function updateScreenMessage(delta) {
        if (!screenMessage) return;
        screenMessage.elapsed += delta;
        if (screenMessage.elapsed >= screenMessage.duration + SCREEN_MESSAGE_FADE_DURATION) screenMessage = null;
    }

    /** Start the centered firework shown when a game begins. @returns {void} */
    function startGameStartFirework() {
        const particleCount = 72;
        gameStartFirework = {
            elapsed: 0,
            particles: Array.from({ length: particleCount }, (unused, index) => ({
                angle: (index / particleCount) * Math.PI * 2 + (randomFloat() - 0.5) * 0.12,
                speed: 0.2 + randomFloat() * 0.25,
                delay: randomFloat() * 55,
                size: 1.5 + randomFloat() * 2.5,
                color: GAME_START_FIREWORK_COLORS[Math.floor(randomFloat() * GAME_START_FIREWORK_COLORS.length)]
            }))
        };
    }

    /** Advance and expire the game-start firework. @param {number} delta Elapsed milliseconds @returns {void} */
    function updateGameStartFirework(delta) {
        if (!gameStartFirework) return;
        gameStartFirework.elapsed += delta;
        if (gameStartFirework.elapsed >= GAME_START_FIREWORK_DURATION) gameStartFirework = null;
    }

    /** Draw the game-start firework above every other canvas element. @returns {void} */
    function drawGameStartFirework() {
        if (!gameStartFirework) return;
        const elapsed = gameStartFirework.elapsed;
        const fadeAlpha = elapsed <= GAME_START_FIREWORK_FADE_START
            ? 1
            : Math.max(0, 1 - (elapsed - GAME_START_FIREWORK_FADE_START) / (GAME_START_FIREWORK_DURATION - GAME_START_FIREWORK_FADE_START));
        const centerX = WIDTH / 2;
        const centerY = HEIGHT / 2;

        context.save();
        context.globalCompositeOperation = 'lighter';
        context.globalAlpha = fadeAlpha;

        const flashProgress = Math.min(1, elapsed / 220);
        context.fillStyle = '#ffffff';
        context.globalAlpha = fadeAlpha * (1 - flashProgress) * 0.8;
        context.beginPath();
        context.arc(centerX, centerY, 7 + flashProgress * 16, 0, Math.PI * 2);
        context.fill();

        context.strokeStyle = '#f7c843';
        context.lineWidth = 3;
        context.globalAlpha = fadeAlpha * Math.max(0, 1 - elapsed / 850) * 0.8;
        context.beginPath();
        context.arc(centerX, centerY, 16 + elapsed * 0.34, 0, Math.PI * 2);
        context.stroke();

        gameStartFirework.particles.forEach((particle) => {
            const particleElapsed = Math.max(0, elapsed - particle.delay);
            if (!particleElapsed) return;
            const distance = particle.speed * particleElapsed;
            const gravity = 0.00016 * particleElapsed * particleElapsed;
            const x = centerX + Math.cos(particle.angle) * distance;
            const y = centerY + Math.sin(particle.angle) * distance + gravity;
            const trailElapsed = Math.max(0, particleElapsed - 85);
            const trailDistance = particle.speed * trailElapsed;
            const trailGravity = 0.00016 * trailElapsed * trailElapsed;
            const trailX = centerX + Math.cos(particle.angle) * trailDistance;
            const trailY = centerY + Math.sin(particle.angle) * trailDistance + trailGravity;

            context.strokeStyle = particle.color;
            context.lineWidth = particle.size;
            context.globalAlpha = fadeAlpha * Math.max(0.25, 1 - particleElapsed / GAME_START_FIREWORK_DURATION);
            context.beginPath();
            context.moveTo(trailX, trailY);
            context.lineTo(x, y);
            context.stroke();
            context.fillStyle = particle.color;
            context.beginPath();
            context.arc(x, y, particle.size * 0.9, 0, Math.PI * 2);
            context.fill();
        });
        context.restore();
    }

    /** 카운트다운과 일시정지 밖에서 연속 피버 남은 시간을 0까지 감소시킨다. @param {number} delta 이전 프레임 후 경과한 밀리초 @returns {void} */
    function updateContinuousFeverTime(delta) {
        if (!game?.continuousFever || !game.fever || game.countdown > 0 || game.ending) return;
        game.fever.leftTime = Math.max(0, game.fever.leftTime - delta);
    }

    /** 피버 룰에서 각 플레이어의 피버 남은 시간을 독립적으로 감소시킨다. @param {number} delta 이전 프레임 후 경과한 밀리초 @returns {void} */
    function updateFeverRuleTime(delta) {
        if (!game?.feverRule || game.countdown > 0 || game.ending) return;
        game.players.forEach((player) => {
            if (player.fever?.active) player.fever.leftTime = Math.max(0, player.fever.leftTime - delta);
        });
    }

    /**
     * 애니메이션 프레임을 갱신하고 다음 프레임을 예약한다.
     * @param {number} time 브라우저가 제공한 현재 시각
     * @returns {void}
     */
    function frame(time) {
        const delta = Math.min(50, time - lastTime || 0);
        lastTime = time;
        updateGamepadInput();
        updateScreenMessage(delta);
        updateGameStartFirework(delta);
        // 플레이 방법은 결과 화면 표시 시간까지 갱신하고, 일반 게임은 실행 중일 때만 갱신한다.
        if (game?.tutorial && !game.paused) {
            if (game.running) {
                game.elapsed += delta;
                refreshGameMarginRate();
            }
            updateTutorial(delta);
        } else if (game && game.running && !game.paused) {
            // 카운트다운이 끝나면 양쪽 플레이어의 첫 턴을 시작한다.
            if (game.countdown > 0) {
                game.countdown = Math.max(0, game.countdown - delta);
                if (!game.countdown && game.countdownStartsGame) {
                    game.countdownStartsGame = false;
                    playSound(commonSoundPool?.gameStarts, 'effects', '게임 시작 효과음');
                    startGameStartFirework();
                    beginGame();
                }
            } else if (game.ending) {
                game.elapsed += delta;
                refreshGameMarginRate();
                updateDefeatSequence(delta);
            } else {
                game.elapsed += delta;
                refreshGameMarginRate();
                updateContinuousFeverTime(delta);
                updateFeverRuleTime(delta);
                updatePlayer(game.players[0], game.players[1], delta);
                updatePlayer(game.players[1], game.players[0], delta);
            }
        }
        if (game?.running && !game.paused) updateEnergyTransfers(delta);
        if (!game && menuScreen === 'simulator') { updateSimulator(delta); updateEnergyTransfers(delta); }
        if (!game && menuScreen === 'gallery' && gallery) gallery.portraitElapsed += delta;
        if (!game && menuScreen === 'initialTitle' && initialGalleryPreview.loaded) initialGalleryPreview.elapsed += delta;
        if (!game && menuScreen === 'title') {
            if (previousRenderedMenuScreen !== 'title') createMainMenuGalleryFloaters();
            updateMainMenuGalleryFloaters(delta);
        }
        previousRenderedMenuScreen = menuScreen;
        syncBackgroundMusic();
        render();
        animationFrameId = requestAnimationFrame(frame);
    }

    /** 시뮬레이터 키보드 입력을 처리한다. @param {string} key 입력 키 @returns {void} */
    function handleSimulatorKeydown(key) {
        if (!simulator) return;
        if (simulator.mode === 'complete') {
            if (key === 'escape' || key === 'enter' || key === ' ') {
                if (key === 'escape') playMenuCancelSound();
                else playMenuSelectSound();
                restoreSimulatorDrawing();
            }
            return;
        }
        if (simulator.mode !== 'draw') { if (key === 'escape') { playMenuCancelSound(); restoreSimulatorDrawing(); } return; }
        if (simulator.focusArea === 'board') {
            if (key === 'escape') { simulator.focusArea = 'palette'; simulator.paletteFocus = 0; return; }
            if (key === 'arrowleft') simulator.boardFocus.x = Math.max(0, simulator.boardFocus.x - 1);
            if (key === 'arrowright') simulator.boardFocus.x = Math.min(COLUMNS - 1, simulator.boardFocus.x + 1);
            if (key === 'arrowdown') simulator.boardFocus.y = Math.max(0, simulator.boardFocus.y - 1);
            if (key === 'arrowup') simulator.boardFocus.y = Math.min(SIMULATOR_EDITABLE_ROWS - 1, simulator.boardFocus.y + 1);
            if (key === 'enter' || key === ' ') placeSimulatorPuyo(simulator.boardFocus.x, simulator.boardFocus.y);
            return;
        }
        const items = getSimulatorPaletteItems();
        if (key === 'escape') { simulator.paletteFocus = 0; return; }
        if (key === 'enter' || key === ' ') { activateSimulatorPaletteItem(simulator.paletteFocus); return; }
        if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) return;
        const current = items[simulator.paletteFocus];
        const direction = key === 'arrowleft' ? [-1, 0] : key === 'arrowright' ? [1, 0] : key === 'arrowup' ? [0, -1] : [0, 1];
        const candidates = items.map((item, index) => ({ item, index })).filter(({ item }) => {
            const dx = item.x - current.x; const dy = item.y - current.y;
            return direction[0] * dx > 0 || direction[1] * dy > 0;
        });
        if (candidates.length) candidates.sort((a, b) => {
            const aDistance = Math.abs((a.item.x - current.x) - direction[0] * 66) + Math.abs((a.item.y - current.y) - direction[1] * 66);
            const bDistance = Math.abs((b.item.x - current.x) - direction[0] * 66) + Math.abs((b.item.y - current.y) - direction[1] * 66);
            return aDistance - bDistance;
        });
        if (candidates.length) simulator.paletteFocus = candidates[0].index;
    }

    /** 갤러리의 키보드·게임패드 입력을 처리한다. @param {string} key 소문자 키 이름 @returns {void} */
    function handleGalleryKeydown(key) {
        if (!gallery) return;
        if (key === 'escape') { closeGallery(); return; }
        if (gallery.focus === 'type') {
            if (key === 'arrowleft') selectGalleryType(-1);
            else if (key === 'arrowright') selectGalleryType(1);
            else if (key === 'arrowdown' || key === 'enter' || key === ' ') gallery.focus = 'target';
            return;
        }
        if (key === 'arrowleft' || key === 'arrowright') {
            gallery.focus = 'type';
            selectGalleryType(key === 'arrowleft' ? -1 : 1);
        } else if (key === 'arrowup') {
            if (gallery.itemIndex === 0) gallery.focus = 'type';
            else selectRelativeGalleryItem(-1);
        } else if (key === 'arrowdown') selectRelativeGalleryItem(1);
    }

    /** 설정 화면에서 편집 가능한 텍스트 입력 필드 이름을 반환한다. @returns {'playerName'|'soundDataURL'|'aiApiKey'|'aiModel'|null} 설정 입력 필드 */
    function getSettingsTextField() {
        return settingsFocus === 0 ? 'playerName' : (settingsFocus === 5 ? 'soundDataURL' : (settingsFocus === 7 ? 'aiApiKey' : (settingsFocus === 8 ? 'aiModel' : null)));
    }

    /** 설정 텍스트 입력의 선택 범위를 반환한다. @returns {[number,number]|null} 선택 시작·끝 위치 */
    function getSettingsTextSelectionRange() {
        if (settingsSelectionAnchor === null || settingsSelectionAnchor === settingsCursor) return null;
        return [Math.min(settingsSelectionAnchor, settingsCursor), Math.max(settingsSelectionAnchor, settingsCursor)];
    }

    /** 설정 텍스트 입력의 선택 상태를 해제한다. @returns {void} */
    function clearSettingsTextSelection() {
        settingsSelectionAnchor = null;
    }

    /** 현재 선택한 설정 텍스트를 삭제한다. @param {string} field 설정 필드 이름 @returns {boolean} 선택 영역 삭제 여부 */
    function deleteSettingsTextSelection(field) {
        const selection = getSettingsTextSelectionRange();
        if (!selection) return false;
        const [start, end] = selection;
        const characters = Array.from(settingsDraft[field]);
        settingsDraft[field] = characters.slice(0, start).concat(characters.slice(end)).join('');
        settingsCursor = start;
        clearSettingsTextSelection();
        return true;
    }

    /** 설정 텍스트 입력에 문자열을 현재 커서 위치로 삽입한다. @param {string} field 설정 필드 이름 @param {string} text 삽입할 문자열 @returns {void} */
    function insertSettingsText(field, text) {
        const characters = Array.from(settingsDraft[field]);
        const before = characters.slice(0, settingsCursor);
        const after = characters.slice(settingsCursor);
        const maxLength = field === 'playerName' ? PLAYER_NAME_MAX_LENGTH : (field === 'soundDataURL' ? SOUND_DATA_URL_MAX_LENGTH : Infinity);
        const availableLength = Number.isFinite(maxLength) ? Math.max(0, maxLength - before.length - after.length) : Infinity;
        const inserted = Number.isFinite(availableLength) ? Array.from(text).slice(0, availableLength).join('') : text;
        settingsDraft[field] = before.concat(Array.from(inserted), after).join('');
        settingsCursor += Array.from(inserted).length;
    }

    /** 설정 텍스트 입력에 클립보드 내용을 붙여 넣는다. 선택된 텍스트는 읽기 실패 전에도 먼저 삭제한다. @param {string} field 설정 필드 이름 @returns {Promise<void>} 붙여 넣기 완료 시점 */
    async function pasteSettingsText(field) {
        deleteSettingsTextSelection(field);
        try {
            const text = await navigator.clipboard.readText();
            insertSettingsText(field, text);
        } catch (error) {
            console.error('설정 텍스트를 클립보드에서 붙여 넣지 못했습니다.', error);
        }
    }

    /** 설정 텍스트 입력의 선택 영역을 클립보드에 복사한다. @param {string} field 설정 필드 이름 @returns {Promise<void>} 복사 완료 시점 */
    async function copySettingsText(field) {
        const selection = getSettingsTextSelectionRange();
        if (!selection) return;
        try {
            await navigator.clipboard.writeText(Array.from(settingsDraft[field]).slice(selection[0], selection[1]).join(''));
        } catch (error) {
            console.error('설정 텍스트를 클립보드에 복사하지 못했습니다.', error);
        }
    }

    /** 설정 화면에서 포커스 이동과 문자열 편집을 처리한다. @param {KeyboardEvent} event 키보드 이벤트 @param {string} key 소문자 키 @returns {void} */
    function handleSettingsKeydown(event, key) {
        const textField = getSettingsTextField();
        if (settingsEditing && textField) {
            const field = textField;
            if (event.ctrlKey && key === 'a') {
                event.preventDefault();
                settingsSelectionAnchor = 0;
                settingsCursor = Array.from(settingsDraft[field]).length;
                return;
            }
            if (event.ctrlKey && key === 'v') { event.preventDefault(); void pasteSettingsText(field); return; }
            if (event.ctrlKey && key === 'c') { event.preventDefault(); void copySettingsText(field); return; }
            if (key === 'enter' || key === 'escape') { settingsEditing = false; clearSettingsTextSelection(); return; }
            if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
                const selection = getSettingsTextSelectionRange();
                if (event.shiftKey) {
                    if (settingsSelectionAnchor === null) settingsSelectionAnchor = settingsCursor;
                    if (key === 'arrowleft') settingsCursor = Math.max(0, settingsCursor - 1);
                    else if (key === 'arrowright') settingsCursor = Math.min(Array.from(settingsDraft[field]).length, settingsCursor + 1);
                    else if (key === 'arrowup') settingsCursor = 0;
                    else settingsCursor = Array.from(settingsDraft[field]).length;
                    if (settingsSelectionAnchor === settingsCursor) clearSettingsTextSelection();
                } else if (selection) {
                    settingsCursor = key === 'arrowleft' || key === 'arrowup' ? selection[0] : selection[1];
                    clearSettingsTextSelection();
                } else if (key === 'arrowleft') settingsCursor = Math.max(0, settingsCursor - 1);
                else if (key === 'arrowright') settingsCursor = Math.min(Array.from(settingsDraft[field]).length, settingsCursor + 1);
                return;
            }
            if (key === 'backspace') {
                if (!deleteSettingsTextSelection(field) && settingsCursor > 0) {
                    const characters = Array.from(settingsDraft[field]);
                    settingsDraft[field] = characters.slice(0, settingsCursor - 1).concat(characters.slice(settingsCursor)).join('');
                    settingsCursor -= 1;
                }
                return;
            }
            if (key.length === 1) {
                deleteSettingsTextSelection(field);
                insertSettingsText(field, event.key);
            }
            return;
        }
        if (key === 'enter' || key === ' ') {
            if (textField) { settingsEditing = true; settingsCursor = Array.from(settingsDraft[textField]).length; clearSettingsTextSelection(); }
            else activateSettingsFocus();
        } else if (key === 'escape') cancelSettings();
        else if (key === 'arrowup' || key === 'arrowdown') moveSettingsFocus(key === 'arrowup' ? -1 : 1);
        else if (key === 'arrowleft' || key === 'arrowright') {
            const direction = key === 'arrowleft' ? -1 : 1;
            if (settingsFocus === 1) settingsDraft.musicVolume = Math.max(0, Math.min(100, settingsDraft.musicVolume + direction));
            else if (settingsFocus === 2) settingsDraft.effectsVolume = Math.max(0, Math.min(100, settingsDraft.effectsVolume + direction));
            else if (settingsFocus === 3) {
                const currentIndex = VIRTUAL_CONTROLLER_OPTIONS.findIndex((option) => option.key === settingsDraft.virtualController);
                settingsDraft.virtualController = VIRTUAL_CONTROLLER_OPTIONS[(currentIndex + direction + VIRTUAL_CONTROLLER_OPTIONS.length) % VIRTUAL_CONTROLLER_OPTIONS.length].key;
            }
            else if (settingsFocus === 4) {
                const currentIndex = GRAPHICS_QUALITY_OPTIONS.findIndex((option) => option.key === settingsDraft.graphicsQuality);
                settingsDraft.graphicsQuality = GRAPHICS_QUALITY_OPTIONS[(currentIndex + direction + GRAPHICS_QUALITY_OPTIONS.length) % GRAPHICS_QUALITY_OPTIONS.length].key;
            } else if (settingsFocus === 10) settingsDraft.landscapeOrientationLocked = direction > 0;
            else if (settingsFocus >= 11) settingsFocus = 11 + (settingsFocus - 11 + (direction < 0 ? 2 : 1)) % 3;
        }
    }

    /** 실제 텍스트 입력 중에는 Z 키를 메뉴 확인 키로 바꾸지 않아야 하는지 확인한다. @param {KeyboardEvent|{target?:EventTarget|null}} event 입력 이벤트 @returns {boolean} */
    function isTextInputInProgress(event) {
        if (settingsEditing) return true;
        const target = event.target;
        if (!target || typeof target !== 'object') return false;
        if (target.isContentEditable) return true;
        const tagName = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
        return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    }

    /** 게임 플레이 중이 아닐 때 Z 키를 메뉴 확인 키로 처리할지 확인한다. @param {KeyboardEvent|{target?:EventTarget|null}} event 입력 이벤트 @returns {boolean} */
    function shouldTreatZAsEnter(event) {
        return !isTextInputInProgress(event) && (!game || !game.running || game.paused);
    }

    /** 초기 타이틀에서 사용자 조작을 받은 뒤 메인 메뉴와 게임 외 배경음악을 시작한다. @returns {void} */
    function enterMainMenu() {
        if (menuScreen !== 'initialTitle') return;
        if (!feverStageValidationComplete) {
            pendingInitialTitleEntry = true;
            return;
        }
        pendingInitialTitleEntry = false;
        playMenuSelectSound();
        hasUserStarted = true;
        menuScreen = 'title';
        loadNotice();
        syncBackgroundMusic();
    }

    /** 승리한 대전의 적 선택 상태를 복원하고, 새로 열렸으면 다음 적에 포커스를 둔다. @param {{difficulty:number,aiDifficulty:number,opponentIndex:number|null,feverRule:boolean,winner:PlayerState|null,players:PlayerState[]}} finishedGame 종료된 게임 상태 @returns {void} */
    function restoreOpponentMenuAfterResult(finishedGame) {
        selectedDifficulty = finishedGame.difficulty;
        selectedAiDifficulty = finishedGame.aiDifficulty;
        if (Number.isInteger(finishedGame.opponentIndex) && OPPONENTS[finishedGame.opponentIndex]) selectedOpponent = finishedGame.opponentIndex;
        opponentMenuRule = finishedGame.feverRule ? 'fever' : 'standard';
        const playerWon = finishedGame.winner === finishedGame.players[0];
        if (playerWon) {
            const selectable = getSelectableOpponents();
            const completedIndex = selectable.indexOf(OPPONENTS[finishedGame.opponentIndex]);
            // 마지막 선택 가능 적이면 현재 적을 유지하고, 새 적이 열렸으면 그 적을 선택한다.
            if (completedIndex >= 0 && completedIndex < selectable.length - 1) selectedOpponent = OPPONENTS.indexOf(selectable[completedIndex + 1]);
        }
        openOpponentMenu(finishedGame.feverRule);
        if (playerWon) opponentMenuFocus = 2;
    }

    /** 결과 화면을 닫고 해당 게임의 이전 메뉴로 돌아간다. 퍼즐뿌요를 클리어했다면 시작 시 결정한 다음 또는 현재 스테이지에 포커스를 둔다. @returns {void} */
    function closeResultScreen() {
        if (!game || game.running) return;
        playMenuCancelSound();
        const finishedGame = game;
        const returnToTitle = finishedGame.practice;
        const returnToPuzzleStages = finishedGame.puzzle !== undefined && finishedGame.puzzle !== null;
        const puzzleFocusIndex = returnToPuzzleStages && finishedGame.winner === finishedGame.players[0]
            ? finishedGame.puzzle.returnFocusIndex
            : 0;
        stopBackgroundMusic();
        game = null;
        if (returnToPuzzleStages) openPuzzleStageSelection(puzzleFocusIndex);
        else if (returnToTitle) { menuScreen = 'title'; loadNotice(); }
        else restoreOpponentMenuAfterResult(finishedGame);
    }

    /**
     * 키 입력을 현재 메뉴 또는 플레이어 조작에 전달한다.
     * @param {KeyboardEvent} event 키보드 이벤트
     * @returns {void}
     */
    function handleKeydown(event) {
        const focusBefore = getMenuFocusToken();
        const actionSoundCountBefore = menuActionSoundCount;
        handleKeydownCore(event);
        if (actionSoundCountBefore === menuActionSoundCount && focusBefore !== getMenuFocusToken()) playMenuFocusMoveSound();
    }

    /** 키 입력의 실제 화면 동작을 처리한다. @param {KeyboardEvent} event 키보드 이벤트 @returns {void} */
    function handleKeydownCore(event) {
        let key = event.key.toLowerCase();
        if (key === 'z' && shouldTreatZAsEnter(event)) key = 'enter';
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'z', 'x', 'escape', 'enter', ' '].includes(key)) event.preventDefault();
        if (settingsResetting) return;
        if (!game && menuScreen === 'initialTitle') {
            if (key === 'enter') enterMainMenu();
            return;
        }
        if (!game && menuScreen === 'simulator') { handleSimulatorKeydown(key); return; }
        if (!game && menuScreen === 'gallery') { handleGalleryKeydown(key); return; }
        if (game?.tutorial) {
            const tutorial = game.tutorial;
            if (key === 'escape') { closeTutorial(); return; }
            if (tutorial.mode === 'complete') {
                if (key === 'arrowleft' || key === 'arrowright') tutorial.finalFocus = tutorial.finalFocus === 0 ? 1 : 0;
                else if (key === 'enter' || key === ' ') { if (tutorial.finalFocus === 0) { playMenuSelectSound(); enterTutorialStage(1); } else closeTutorial(); }
            }
            return;
        }
        // 결과 화면에서는 Enter 또는 ESC로 연습은 메인, 대전은 적 선택 화면으로 돌아간다.
        if (game && !game.running && (key === 'enter' || key === 'escape')) {
            closeResultScreen();
            return;
        }
        // 게임이 없으면 키 입력을 제목 또는 상대 선택 메뉴로 전달한다.
        if (!game) {
            if (menuScreen === 'title' && ruleSelectionOpen) {
                handleRuleSelectionKey(key);
                return;
            }
            if (menuScreen === 'practiceDifficulty') {
                const choices = getSelectableColorDifficultyIndices();
                if (key === 'escape') { playMenuCancelSound(); menuScreen = 'title'; loadNotice(); }
                else if (colorSelectionFocus === COLOR_SELECTION_CANCEL_INDEX) {
                    if (key === 'arrowup') colorSelectionFocus = selectedDifficulty;
                    else if (key === 'arrowleft' || key === 'arrowright') {
                        const currentIndex = Math.max(0, choices.indexOf(selectedDifficulty));
                        const direction = key === 'arrowleft' ? -1 : 1;
                        selectedDifficulty = choices[(currentIndex + direction + choices.length) % choices.length];
                        colorSelectionFocus = selectedDifficulty;
                    } else if (key === 'enter' || key === ' ') returnToRuleSelection();
                } else if (key === 'arrowleft' || key === 'arrowright') {
                    const currentIndex = Math.max(0, choices.indexOf(selectedDifficulty));
                    const direction = key === 'arrowleft' ? -1 : 1;
                    selectedDifficulty = choices[(currentIndex + direction + choices.length) % choices.length];
                    colorSelectionFocus = selectedDifficulty;
                } else if (key === 'arrowdown') colorSelectionFocus = COLOR_SELECTION_CANCEL_INDEX;
                else if (key === 'enter' || key === ' ') startGame(colorSelectionMode === 'practice', colorSelectionMode === 'continuousFever');
                return;
            }
            if (menuScreen === 'puzzleStage') {
                const openedCount = getOpenedPuzzleStageCount();
                const focusChoices = [PUZZLE_STAGE_CANCEL_INDEX, ...Array.from({ length: openedCount }, (unused, index) => index)];
                if (key === 'escape') returnToRuleSelection();
                else if (key === 'arrowleft' || key === 'arrowright') {
                    const currentIndex = Math.max(0, focusChoices.indexOf(puzzleStageFocus));
                    const direction = key === 'arrowleft' ? -1 : 1;
                    const nextFocus = focusChoices[Math.max(0, Math.min(focusChoices.length - 1, currentIndex + direction))];
                    if (nextFocus !== puzzleStageFocus) {
                        puzzleStageFocus = nextFocus;
                        scrollPuzzleStageFocusIntoView();
                    } else scrollPuzzleStageSelection(direction);
                    puzzleStageLastClickedIndex = null;
                } else if (key === 'enter' || key === ' ') {
                    if (puzzleStageFocus === PUZZLE_STAGE_CANCEL_INDEX) returnToRuleSelection();
                    else startSelectedPuzzleStage();
                }
                return;
            }
            if (menuScreen === 'title' && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
                titleMenuFocus = key === 'arrowleft' || key === 'arrowup'
                    ? (titleMenuFocus + 6) % 7
                    : (titleMenuFocus + 1) % 7;
            } else if (menuScreen === 'opponent' && key === 'arrowup') {
                opponentMenuFocus = Math.max(0, opponentMenuFocus - 1);
            } else if (menuScreen === 'opponent' && key === 'arrowdown') {
                opponentMenuFocus = Math.min(3, opponentMenuFocus + 1);
            } else if (menuScreen === 'opponent' && key === 'arrowleft') {
                if (opponentMenuFocus === 0) {
                    const choices = getSelectableColorDifficultyIndices();
                    const currentIndex = Math.max(0, choices.indexOf(selectedDifficulty));
                    selectedDifficulty = choices[(currentIndex + choices.length - 1) % choices.length];
                }
                else if (opponentMenuFocus === 1) selectedAiDifficulty = (selectedAiDifficulty + AI_DIFFICULTIES.length - 1) % AI_DIFFICULTIES.length;
                else if (opponentMenuFocus === 2) selectRelativeOpponent(-1);
                else selectedOpponentAction = 0;
            } else if (menuScreen === 'opponent' && key === 'arrowright') {
                if (opponentMenuFocus === 0) {
                    const choices = getSelectableColorDifficultyIndices();
                    const currentIndex = Math.max(0, choices.indexOf(selectedDifficulty));
                    selectedDifficulty = choices[(currentIndex + 1) % choices.length];
                }
                else if (opponentMenuFocus === 1) selectedAiDifficulty = (selectedAiDifficulty + 1) % AI_DIFFICULTIES.length;
                else if (opponentMenuFocus === 2) selectRelativeOpponent(1);
                else selectedOpponentAction = 1;
            } else if (menuScreen === 'settings') {
                handleSettingsKeydown(event, key);
            } else if (key === 'enter' || key === ' ') {
                if (menuScreen === 'title') activateTitleMenu();
                else if (menuScreen === 'settings') activateSettingsFocus();
                else if (opponentMenuFocus === 0) opponentMenuFocus = 1;
                else if (opponentMenuFocus === 1) opponentMenuFocus = 2;
                else if (opponentMenuFocus === 2) {
                    opponentMenuFocus = 3;
                    selectedOpponentAction = 0;
                } else if (selectedOpponentAction === 0) startGame(false, false, opponentMenuRule === 'fever');
                else { playMenuCancelSound(); menuScreen = 'title'; loadNotice(); }
            } else if (key === 'escape' && menuScreen === 'opponent') { playMenuCancelSound(); menuScreen = 'title'; loadNotice(); }
            return;
        }
        // 결과 화면에서는 위에서 처리한 메뉴 복귀 외 입력을 무시한다.
        if (!game.running) {
            return;
        }
        // 시작 또는 재개 카운트다운 중에는 일시정지를 포함한 게임 조작을 받지 않는다.
        if (game.countdown > 0) {
            return;
        }
        // 일시정지 중에는 방향키와 Enter로만 오버레이의 버튼을 조작한다.
        if (game.paused) {
            if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
                pauseMenuFocus = pauseMenuFocus === 0 ? 1 : 0;
            } else if (key === 'enter' || key === ' ') {
                activatePauseMenu();
            }
            return;
        }
        // 종료 연출이 아닐 때 ESC로 일시정지를 시작한다.
        if (key === 'escape' && !game.ending) {
            resetVirtualControllerInput();
            game.paused = true;
            pauseMenuFocus = 0;
            pauseBackgroundMusic();
            return;
        }
        const player = game.players[0];
        if (player.phase !== 'control') return;
        if (key === 'arrowleft' && !event.repeat) moveActive(player, -1, 0);
        if (key === 'arrowright' && !event.repeat) moveActive(player, 1, 0);
        if (key === 'arrowup' && !event.repeat) rotateActive(player, 1);
        if (key === 'arrowleft' || key === 'arrowright') {
            if (horizontalKeyPressed !== key) {
                horizontalKeyPressed = key;
                horizontalHoldElapsed = 0;
                horizontalRepeatElapsed = 0;
            }
        }
        if (key === 'arrowdown') isDownKeyPressed = true;
        if (key === 'z') rotateActive(player, -1);
        if (key === 'x') rotateActive(player, 1);
    }

    /**
     * 아래 방향키를 놓으면 사용자 빠른 하강을 중지한다.
     * @param {KeyboardEvent} event 키보드 이벤트
     * @returns {void}
     */
    function handleKeyup(event) {
        const key = event.key.toLowerCase();
        if (key === 'arrowdown') isDownKeyPressed = false;
        if (key === horizontalKeyPressed) {
            horizontalKeyPressed = null;
            horizontalHoldElapsed = 0;
            horizontalRepeatElapsed = 0;
        }
    }

    /**
     * 메인 메뉴에서 포커스된 항목을 실행한다.
     * @returns {void}
     */
    function activateTitleMenu() {
        playMenuSelectSound();
        if (titleMenuFocus === 0) openRuleSelection();
        else if (titleMenuFocus === 1) openSimulator();
        else if (titleMenuFocus === 2) openTutorial();
        else if (titleMenuFocus === 3) openGallery();
        else if (titleMenuFocus === 4) openSettings();
        else if (titleMenuFocus === 5) {
            const githubWindow = window.open(convertURL('https://github.com/HJOW/puyow'), '_blank');
            if (githubWindow) githubWindow.opener = null;
        } else {
            toggleMuted();
        }
    }

    /**
     * 일시정지 오버레이에서 포커스된 명령을 실행한다.
     * @returns {void}
     */
    function activatePauseMenu() {
        if (pauseMenuFocus === 0) {
            playMenuSelectSound();
            resetVirtualControllerInput();
            game.paused = false;
            game.countdown = 3000;
            game.countdownStartsGame = false;
            resumeBackgroundMusic();
        } else {
            playMenuCancelSound();
            resetVirtualControllerInput();
            stopBackgroundMusic();
            game = null;
            menuScreen = 'title'; loadNotice();
            syncBackgroundMusic();
        }
    }

    /**
     * 적 선택 화면을 현재 선택값과 첫 포커스 상태로 연다.
     * @returns {void}
     */
    function openOpponentMenu(feverRule = false) {
        opponentMenuRule = feverRule ? 'fever' : 'standard';
        ensureSelectedOpponent();
        opponentMenuFocus = 0;
        selectedOpponentAction = 0;
        menuScreen = 'opponent';
    }

    /**
     * 메뉴의 게임 시작 버튼을 선택하거나 결과 화면에서 메뉴로 돌아간다.
     * @param {MouseEvent} event 캔버스 클릭 이벤트
     * @returns {void}
     */
    /**
     * 캔버스 클릭을 메뉴 조작에 전달한다.
     * @param {MouseEvent} event 마우스 이벤트
     * @returns {void}
     */
    function handleCanvasClick(event) {
        const focusBefore = getMenuFocusToken();
        const actionSoundCountBefore = menuActionSoundCount;
        handleCanvasClickCore(event);
        if (actionSoundCountBefore === menuActionSoundCount && focusBefore !== getMenuFocusToken()) playMenuFocusMoveSound();
    }

    /** 캔버스 클릭의 실제 화면 동작을 처리한다. @param {MouseEvent} event 마우스 이벤트 @returns {void} */
    function handleCanvasClickCore(event) {
        if (settingsResetting) return;
        if (!game && menuScreen === 'initialTitle') {
            enterMainMenu();
            return;
        }
        if (game?.tutorial) {
            const { x, y } = getCanvasEventCoordinates(event);
            if (game.tutorial.mode === 'complete' && y >= 376 && y <= 440) {
                if (x >= 470 && x <= 620) { playMenuSelectSound(); enterTutorialStage(1); }
                else if (x >= 660 && x <= 810) closeTutorial();
            }
            return;
        }
        // 결과 화면에서는 종료 버튼 영역 클릭만 메뉴 복귀로 처리한다.
        if (game && !game.running) {
            const { x, y } = getCanvasEventCoordinates(event);
            if (x >= 515 && x <= 765 && y >= 165 && y <= 229) {
                closeResultScreen();
            }
            return;
        }
        const { x, y } = getCanvasEventCoordinates(event);
        // 일시정지 중에는 재개와 종료 버튼의 클릭만 처리한다.
        if (game && game.paused) {
            if (x >= 470 && x <= 620 && y >= 376 && y <= 440) {
                pauseMenuFocus = 0;
                activatePauseMenu();
            } else if (x >= 660 && x <= 810 && y >= 376 && y <= 440) {
                pauseMenuFocus = 1;
                activatePauseMenu();
            }
            return;
        }
        // 실행 중인 게임 화면의 일반 클릭은 메뉴 동작으로 처리하지 않는다.
        if (game) return;
        if (menuScreen === 'title' && ruleSelectionOpen) {
            const cancelBounds = getRuleSelectionCancelButtonBounds();
            if (x >= cancelBounds.x && x <= cancelBounds.x + cancelBounds.width && y >= cancelBounds.y && y <= cancelBounds.y + cancelBounds.height) {
                ruleSelectionFocus = RULE_SELECTION_CANCEL_INDEX;
                activateRuleSelection();
                return;
            }
            const selectedIndex = GAME_RULE_OPTIONS.findIndex((option, index) => {
                const bounds = getRuleSelectionButtonBounds(index);
                return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
            });
            if (selectedIndex >= 0) {
                if (!GAME_RULE_OPTIONS[selectedIndex].disabled) {
                    ruleSelectionFocus = selectedIndex;
                    activateRuleSelection();
                }
            } else {
                playMenuCancelSound();
                closeRuleSelection();
            }
            return;
        }
        if (menuScreen === 'simulator' && simulator) {
            if (simulator.mode === 'complete') {
                if (x >= 600 && x <= 750 && y >= 145 && y <= 203) { playMenuSelectSound(); restoreSimulatorDrawing(); }
                return;
            }
            if (simulator.mode !== 'draw') return;
            const boardX = Math.floor((x - FIELD_LEFT) / CELL);
            const boardY = Math.floor((FIELD_BOTTOM - y) / CELL);
            if (boardX >= 0 && boardX < COLUMNS && boardY >= 0 && boardY < SIMULATOR_EDITABLE_ROWS) {
                simulator.boardFocus = { x: boardX, y: boardY };
                simulator.focusArea = 'board';
                placeSimulatorPuyo(boardX, boardY);
                return;
            }
            const paletteIndex = getSimulatorPaletteItems().findIndex((item) => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
            if (paletteIndex >= 0) activateSimulatorPaletteItem(paletteIndex);
            return;
        }
        if (menuScreen === 'gallery' && gallery) {
            const closeButton = getGalleryCloseButtonBounds();
            if (x >= closeButton.x && x <= closeButton.x + closeButton.width && y >= closeButton.y && y <= closeButton.y + closeButton.height) {
                closeGallery();
                return;
            }
            const types = getGalleryTypes();
            const typeWidth = 190; const typeY = 91;
            const typeIndex = types.findIndex((type, index) => {
                const typeX = WIDTH / 2 - (types.length * typeWidth + (types.length - 1) * 14) / 2 + index * (typeWidth + 14);
                return x >= typeX && x <= typeX + typeWidth && y >= typeY && y <= typeY + 54;
            });
            if (typeIndex >= 0) {
                playMenuSelectSound();
                gallery.typeIndex = typeIndex;
                gallery.itemIndex = Math.max(0, getGalleryItems().findIndex((item) => !item.locked));
                gallery.focus = 'type';
                gallery.portraitElapsed = 0;
                return;
            }
            const items = getGalleryItems();
            const targetIndex = items.findIndex((item, index) => {
                const targetBounds = getGalleryTargetBounds(index);
                return x >= targetBounds.x && x <= targetBounds.x + targetBounds.width && y >= targetBounds.y && y <= targetBounds.y + targetBounds.height;
            });
            if (targetIndex >= 0 && !items[targetIndex].locked) {
                playMenuSelectSound();
                gallery.itemIndex = targetIndex;
                gallery.focus = 'target';
                gallery.portraitElapsed = 0;
            }
            return;
        }
        if (menuScreen === 'puzzleStage') {
            const scrollDirection = [-1, 1].find((direction) => {
                const bounds = getPuzzleStageScrollButtonBounds(direction);
                return bounds && x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
            });
            if (scrollDirection !== undefined) {
                if (scrollPuzzleStageSelection(scrollDirection)) {
                    playMenuFocusMoveSound();
                    puzzleStageLastClickedIndex = null;
                }
                return;
            }
            const cancelBounds = getPuzzleStageButtonBounds(PUZZLE_STAGE_CANCEL_INDEX);
            if (isPuzzleStageCardVisible(PUZZLE_STAGE_CANCEL_INDEX) && x >= cancelBounds.x && x <= cancelBounds.x + cancelBounds.width && y >= cancelBounds.y && y <= cancelBounds.y + cancelBounds.height) {
                puzzleStageFocus = PUZZLE_STAGE_CANCEL_INDEX;
                puzzleStageLastClickedIndex = null;
                returnToRuleSelection();
                return;
            }
            const stageIndex = PUZZLE_STAGES.findIndex((stage, index) => {
                if (!isPuzzleStageCardVisible(index)) return false;
                const stageBounds = getPuzzleStageButtonBounds(index);
                return x >= stageBounds.x && x <= stageBounds.x + stageBounds.width && y >= stageBounds.y && y <= stageBounds.y + stageBounds.height;
            });
            if (stageIndex >= 0 && stageIndex < getOpenedPuzzleStageCount()) {
                if (puzzleStageFocus === stageIndex && puzzleStageLastClickedIndex === stageIndex) startSelectedPuzzleStage();
                else {
                    playMenuSelectSound();
                    puzzleStageFocus = stageIndex;
                    puzzleStageLastClickedIndex = stageIndex;
                }
            }
            return;
        }
        if (menuScreen === 'title') {
            const titleItemIndex = Array.from({ length: 5 }, (unused, index) => index).find((index) => {
                const itemY = 280 + index * 56;
                return x >= WIDTH / 2 - 109 && x <= WIDTH / 2 + 109 && y >= itemY && y <= itemY + 46;
            });
            if (titleItemIndex !== undefined) {
                titleMenuFocus = titleItemIndex;
                activateTitleMenu();
            } else if (x >= WIDTH - 117 && x <= WIDTH - 32 && y >= 665 && y <= 688) {
                playMenuSelectSound();
                toggleMuted();
            } else if (x >= 32 && x <= 117 && y >= 665 && y <= 688) {
                titleMenuFocus = 5;
                activateTitleMenu();
            }
        } else if (menuScreen === 'settings') {
            if (y >= 525 && y <= 561 && x >= 540 && x <= 960 && canRunAiApiTest()) { playMenuSelectSound(); settingsFocus = 9; runAiApiTest(); }
            else if (y >= 600 && y <= 620 && x >= 540 && x <= 960) { playMenuSelectSound(); settingsFocus = 10; settingsDraft.landscapeOrientationLocked = !settingsDraft.landscapeOrientationLocked; }
            else if (y >= 640 && y <= 682 && x >= 390 && x <= 540) { settingsFocus = 11; saveSettings(); }
            else if (y >= 640 && y <= 682 && x >= 565 && x <= 715) { settingsFocus = 12; cancelSettings(); }
            else if (y >= 640 && y <= 682 && x >= 740 && x <= 890) { settingsFocus = 13; resetAllSettings(); }
            else if (y >= 79 && y <= 111) { settingsFocus = 0; settingsEditing = true; settingsCursor = Array.from(settingsDraft.playerName).length; clearSettingsTextSelection(); }
            else if (y >= 137 && y <= 153) { settingsFocus = 1; settingsDraft.musicVolume = Math.round(Math.max(0, Math.min(100, (x - 540) / 360 * 100))); }
            else if (y >= 187 && y <= 203) { settingsFocus = 2; settingsDraft.effectsVolume = Math.round(Math.max(0, Math.min(100, (x - 540) / 360 * 100))); }
            else if (y >= 229 && y <= 261 && x >= 530 && x <= 655) { playMenuSelectSound(); settingsFocus = 3; settingsDraft.virtualController = 'none'; }
            else if (y >= 229 && y <= 261 && x >= 675 && x <= 800) { playMenuSelectSound(); settingsFocus = 3; settingsDraft.virtualController = 'normal'; }
            else if (y >= 229 && y <= 261 && x >= 820 && x <= 945) { playMenuSelectSound(); settingsFocus = 3; settingsDraft.virtualController = 'large'; }
            else if (y >= 279 && y <= 311 && x >= 530 && x <= 655) { playMenuSelectSound(); settingsFocus = 4; settingsDraft.graphicsQuality = 'low'; }
            else if (y >= 279 && y <= 311 && x >= 675 && x <= 800) { playMenuSelectSound(); settingsFocus = 4; settingsDraft.graphicsQuality = 'medium'; }
            else if (y >= 279 && y <= 311 && x >= 820 && x <= 945) { playMenuSelectSound(); settingsFocus = 4; settingsDraft.graphicsQuality = 'high'; }
            else if (y >= 329 && y <= 361 && x >= 540 && x <= 960) { settingsFocus = 5; settingsEditing = true; settingsCursor = Array.from(settingsDraft.soundDataURL).length; clearSettingsTextSelection(); }
            else if (y >= 379 && y <= 411 && x >= 540 && x <= 665) { playMenuSelectSound(); settingsFocus = 6; settingsDraft.aiProvider = AI_SERVICE_PROVIDERS[0]; }
            else if (y >= 429 && y <= 461 && x >= 540 && x <= 960) { settingsFocus = 7; settingsEditing = true; settingsCursor = Array.from(settingsDraft.aiApiKey).length; clearSettingsTextSelection(); }
            else if (y >= 479 && y <= 511 && x >= 540 && x <= 960) { settingsFocus = 8; settingsEditing = true; settingsCursor = Array.from(settingsDraft.aiModel).length; clearSettingsTextSelection(); }
        } else {
            if (menuScreen === 'practiceDifficulty') {
                const cancelBounds = getColorSelectionCancelButtonBounds();
                if (x >= cancelBounds.x && x <= cancelBounds.x + cancelBounds.width && y >= cancelBounds.y && y <= cancelBounds.y + cancelBounds.height) {
                    colorSelectionFocus = COLOR_SELECTION_CANCEL_INDEX;
                    returnToRuleSelection();
                    return;
                }
                const difficultyIndex = DIFFICULTIES.findIndex((difficulty, index) => x >= getColorDifficultyButtonX(index) && x <= getColorDifficultyButtonX(index) + 110 && y >= 335 && y <= 393);
                if (difficultyIndex >= 0 && getSelectableColorDifficultyIndices().includes(difficultyIndex)) {
                    selectedDifficulty = difficultyIndex;
                    colorSelectionFocus = difficultyIndex;
                    startGame(colorSelectionMode === 'practice', colorSelectionMode === 'continuousFever');
                } else {
                    // 난이도 선택지 바깥을 클릭하면 ESC와 같이 메인 화면으로 돌아간다.
                    playMenuCancelSound();
                    menuScreen = 'title';
                    loadNotice();
                }
                return;
            }
            // 축소해 그린 적 선택 화면의 클릭 좌표를 원래 논리 좌표로 되돌린다.
            const opponentX = (x - WIDTH / 2) / OPPONENT_MENU_SCALE + WIDTH / 2;
            const opponentY = (y - HEIGHT / 2) / OPPONENT_MENU_SCALE + HEIGHT / 2;
            const difficultyIndex = DIFFICULTIES.findIndex((difficulty, index) => opponentX >= getColorDifficultyButtonX(index) && opponentX <= getColorDifficultyButtonX(index) + 110 && opponentY >= 135 && opponentY <= 179);
            if (difficultyIndex >= 0) {
                playMenuSelectSound();
                selectedDifficulty = difficultyIndex;
                opponentMenuFocus = 0;
                return;
            }
            const aiDifficultyIndex = AI_DIFFICULTIES.findIndex((difficulty, index) => opponentX >= getAiDifficultyButtonX(index) && opponentX <= getAiDifficultyButtonX(index) + 110 && opponentY >= 195 && opponentY <= 239);
            if (aiDifficultyIndex >= 0) {
                playMenuSelectSound();
                selectedAiDifficulty = aiDifficultyIndex;
                opponentMenuFocus = 1;
                return;
            }
            if (opponentX >= 425 && opponentX <= 470 && opponentY >= 350 && opponentY <= 420 && selectRelativeOpponent(-1)) {
                playMenuSelectSound();
                opponentMenuFocus = 2;
                return;
            }
            if (opponentX >= 810 && opponentX <= 855 && opponentY >= 350 && opponentY <= 420 && selectRelativeOpponent(1)) {
                playMenuSelectSound();
                opponentMenuFocus = 2;
                return;
            }
            const visibleOpponents = getVisibleOpponents();
            const selectedEntry = OPPONENTS[selectedOpponent];
            const selectedVisibleIndex = visibleOpponents.indexOf(selectedEntry);
            const cardIndex = visibleOpponents.findIndex((entry, index) => {
                const cardX = WIDTH / 2 - 80 + (index - selectedVisibleIndex) * 180;
                return opponentX >= cardX && opponentX <= cardX + 160 && opponentY >= 475 && opponentY <= 537;
            });
            if (cardIndex >= 0) {
                const clickedOpponent = visibleOpponents[cardIndex];
                if (!clickedOpponent.notAvail && isOpponentUnlocked(clickedOpponent)) {
                    playMenuSelectSound();
                    selectedOpponent = OPPONENTS.indexOf(clickedOpponent);
                    opponentMenuFocus = 2;
                }
            } else if (opponentX >= 440 && opponentX <= 690 && opponentY >= 600 && opponentY <= 658) {
                selectedOpponentAction = 0;
                opponentMenuFocus = 3;
                startGame(false, false, opponentMenuRule === 'fever');
            } else if (opponentX >= 710 && opponentX <= 840 && opponentY >= 600 && opponentY <= 658) {
                playMenuCancelSound();
                selectedOpponentAction = 1;
                opponentMenuFocus = 3;
                menuScreen = 'title'; loadNotice();
            }
        }
    }

    /**
     * 현재 화면을 AI가 구분할 수 있는 간결한 상태 객체로 만든다.
     * @returns {{screen:'initial_title'|'main_menu'|'rule_select'|'practice_difficulty'|'puzzle_stage_select'|'opponent_select'|'fever_opponent_select'|'simulator_draw'|'simulator_simulation'|'simulator_complete'|'settings'|'settings_resetting'|'gallery'|'tutorial_intro'|'tutorial_demo'|'tutorial_result'|'tutorial_complete'|'countdown'|'playing'|'paused'|'ending'|'game_over', playerCanControl:boolean}}
     */
    function getNowScreen() {
        if (settingsResetting) return { screen: 'settings_resetting', playerCanControl: false };
        if (!game) {
            if (menuScreen === 'initialTitle') return { screen: 'initial_title', playerCanControl: false };
            if (menuScreen === 'title' && ruleSelectionOpen) return { screen: 'rule_select', playerCanControl: false };
            if (menuScreen === 'opponent') return { screen: opponentMenuRule === 'fever' ? 'fever_opponent_select' : 'opponent_select', playerCanControl: false };
            if (menuScreen === 'practiceDifficulty') return { screen: 'practice_difficulty', playerCanControl: false };
            if (menuScreen === 'puzzleStage') return { screen: 'puzzle_stage_select', playerCanControl: false };
            if (menuScreen === 'simulator') {
                const screen = simulator?.mode === 'draw' ? 'simulator_draw' : simulator?.mode === 'complete' ? 'simulator_complete' : 'simulator_simulation';
                return { screen, playerCanControl: false };
            }
            if (menuScreen === 'settings') return { screen: 'settings', playerCanControl: false };
            if (menuScreen === 'gallery') return { screen: 'gallery', playerCanControl: false };
            return { screen: 'main_menu', playerCanControl: false };
        }
        if (game.tutorial) {
            if (game.tutorial.mode === 'complete') return { screen: 'tutorial_complete', playerCanControl: false };
            if (game.tutorial.mode === 'result' || game.ending || !game.running) return { screen: 'tutorial_result', playerCanControl: false };
            return { screen: game.tutorial.mode === 'intro' ? 'tutorial_intro' : 'tutorial_demo', playerCanControl: false };
        }
        if (!game.running) return { screen: 'game_over', playerCanControl: false };
        if (game.countdown > 0) return { screen: 'countdown', playerCanControl: false };
        if (game.paused) return { screen: 'paused', playerCanControl: false };
        if (game.ending) return { screen: 'ending', playerCanControl: false };
        return { screen: 'playing', playerCanControl: game.players[0].phase === 'control' && game.players[0].active !== null };
    }

    /**
     * 한 플레이어의 보드와 대기열을 JSON으로 직렬화 가능한 상태로 만든다.
     * @param {PlayerState} player 상태를 읽을 플레이어
     * @param {PlayerState} opponent 상대 플레이어
     * @returns {{name:string, isCpu:boolean, phase:string, point:number, attack:number, damage:number, normalDamage:number, combo:number, placedPairCount:number, board:{columns:number, rows:number, visibleRows:number, puyos:{x:number,y:number,color:string}[]}, nextPairs:string[][], warningPuyos:string[], active:{x:number,y:number,rotation:number,colors:string[],cells:{x:number,y:number,color:string}[]}|null}}
     */
    function getPlayerGameStatus(player, opponent) {
        const puyos = [];
        player.board.forEach((row, y) => row.forEach((color, x) => {
            if (color) puyos.push({ x, y, color });
        }));
        const active = player.active ? {
            x: player.active.x,
            y: player.active.y,
            rotation: player.active.rotation,
            colors: [...player.active.colors],
            cells: activeCells(player.active).map(({ x, y, color }) => ({ x, y, color }))
        } : null;
        return {
            name: player.name,
            isCpu: player.controller !== null,
            phase: player.phase,
            point: player.point,
            attack: player.attack,
            damage: player.damage,
            normalDamage: player.normalDamage,
            combo: player.combo,
            placedPairCount: player.placedPairCount,
            board: { columns: COLUMNS, rows: ROWS, visibleRows: VISIBLE_ROWS, puyos },
            nextPairs: player.nextPairs.map((pair) => [...pair]),
            warningPuyos: warningUnits(warningAmount(player, opponent)).map((unit) => unit.type),
            fever: player.fever ? {
                active: player.fever.active,
                gauge: player.fever.gauge,
                nextTime: player.fever.nextTime,
                targetCombo: player.fever.targetCombo,
                leftTime: player.fever.leftTime,
                damage: player.fever.damage,
                turn: player.fever.turn,
                selectedStageTarget: player.fever.selectedStageTarget,
                stageSuppliedPair: [...player.fever.stageSuppliedPair],
                field: player.fever.active ? { columns: COLUMNS, rows: ROWS, cells: player.board.map((row) => [...row]) } : null
            } : null,
            active
        };
    }

    /**
     * 플레이 중인 게임의 AI용 상세 상태를 반환한다.
     * @returns {object}
     */
    function getNowGameStatus() {
        const screen = getNowScreen();
        if (!game || game.tutorial || (screen.screen !== 'playing' && screen.screen !== 'paused')) {
            throw new Error('now_game_status is available only during a normal match while playing or paused.');
        }
        const [player, opponent] = game.players;
        return {
            screen: screen.screen,
            playerCanControl: screen.playerCanControl,
            continuousFever: game.continuousFever === true,
            feverRule: game.feverRule === true,
            puzzle: game.puzzle ? {
                stageIndex: game.puzzle.stageIndex,
                turn: game.puzzle.turn,
                winConditionType: game.puzzle.stage.winConditionType,
                winConditionValue: game.puzzle.stage.winConditionValue,
                recommendedTurns: game.puzzle.stage.turnLimit,
                condition: getPuzzleConditionText(game.puzzle.stage),
                starEarned: hasPuzzleStageStar()
            } : null,
            fever: game.fever ? {
                targetCombo: game.fever.targetCombo,
                leftTime: game.fever.leftTime,
                turn: game.fever.turn,
                pendingCombo: game.fever.pendingCombo,
                pendingAllClear: game.fever.pendingAllClear,
                selectedStageTarget: game.fever.selectedStageTarget,
                stageSuppliedPair: [...game.fever.stageSuppliedPair]
            } : null,
            player: getPlayerGameStatus(player, opponent),
            opponent: getPlayerGameStatus(opponent, player),
            recommendedPoint: recommendedPoint ? { ...recommendedPoint } : null
        };
    }

    /**
     * 현재 표시 중인 화면과 플레이어 조작 가능 여부를 반환한다.
     * 메뉴, 튜토리얼, 대전 진행 상태 모두에서 사용할 수 있다.
     * @returns {{screen:'initial_title'|'main_menu'|'rule_select'|'practice_difficulty'|'puzzle_stage_select'|'opponent_select'|'fever_opponent_select'|'simulator_draw'|'simulator_simulation'|'simulator_complete'|'settings'|'settings_resetting'|'gallery'|'tutorial_intro'|'tutorial_demo'|'tutorial_result'|'tutorial_complete'|'countdown'|'playing'|'paused'|'ending'|'game_over', playerCanControl:boolean}}
     */
    function getScreenState() {
        return getNowScreen();
    }

    /**
     * 현재 화면의 최상단에 원문 메시지를 표시한다. 다국어 변환은 호출 전에 처리해야 한다.
     * @param {string} message 표시할 메시지
     * @param {string} [color='white'] 글자 색상(CSS 색상 문자열)
     * @param {number} [duration=2000] 페이드 아웃 전 유지 시간(밀리초)
     * @param {string|null} [backgroundColor=null] 글자 뒤에 표시할 배경 색상(CSS 색상 문자열)
     * @returns {void}
     */
    function showMessage(message, color = 'white', duration = 2000, backgroundColor = null) {
        if (!initialized || !context) throw new Error('메시지를 표시하려면 먼저 WebPuyo.initialize()를 호출해야 합니다.');
        if (typeof message !== 'string') throw new TypeError('message는 문자열이어야 합니다.');
        if (typeof color !== 'string') throw new TypeError('color는 문자열이어야 합니다.');
        if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) throw new RangeError('duration은 0 이상의 유한한 숫자여야 합니다.');
        if (backgroundColor !== null && typeof backgroundColor !== 'string') throw new TypeError('backgroundColor는 문자열 또는 null이어야 합니다.');
        screenMessage = { message, color, backgroundColor, elapsed: 0, duration };
    }

    /**
     * 현재 시뮬레이터 편집 상태의 읽기 전용 스냅샷을 반환한다.
     * @returns {{mode:'draw'|'simulation'|'settling'|'complete', selected:string, focusArea:'palette'|'board'|'complete', boardFocus:{x:number,y:number}, board:{columns:number,rows:number,visibleRows:number,editableRows:number,puyos:{x:number,y:number,color:string}[]}}|null}
     */
    function getSimulatorState() {
        if (!simulator) return null;
        const puyos = [];
        simulator.player.board.forEach((row, y) => row.forEach((color, x) => {
            if (color) puyos.push({ x, y, color });
        }));
        return {
            mode: simulator.mode,
            selected: simulator.selected,
            focusArea: simulator.focusArea,
            boardFocus: { ...simulator.boardFocus },
            board: { columns: COLUMNS, rows: ROWS, visibleRows: VISIBLE_ROWS, editableRows: SIMULATOR_EDITABLE_ROWS, puyos }
        };
    }

    /**
     * 현재 일반 대전의 읽기 전용 상태 스냅샷을 반환한다.
     * 반환된 객체와 그 안의 배열을 변경해도 실제 게임 상태에는 영향을 주지 않는다.
     * 메뉴, 튜토리얼 또는 초기화 전 상태에서는 null을 반환한다.
     * @returns {{screen:string, playerCanControl:boolean, running:boolean, paused:boolean, countdown:number, elapsed:number, marginRate:number, practice:boolean, continuousFever:boolean, fever:object|null, colorCount:number, colors:string[], aiDifficulty:{key:string,name:string,fastDownDelay:number|null}, winner:'player'|'opponent'|null, ending:{loser:'player'|'opponent',winner:'player'|'opponent',elapsed:number,duration:number}|null, player:object, opponent:object, recommendedPoint:{x:number,y:number}|null}|null}
     */
    function getGameState() {
        if (!game || game.tutorial) return null;
        const screen = getNowScreen();
        const [player, opponent] = game.players;
        const getRole = (target) => target === player ? 'player' : target === opponent ? 'opponent' : null;
        return {
            screen: screen.screen,
            playerCanControl: screen.playerCanControl,
            running: game.running,
            paused: game.paused,
            countdown: game.countdown,
            elapsed: game.elapsed,
            marginRate: game.marginRate,
            practice: game.practice,
            continuousFever: game.continuousFever === true,
            feverRule: game.feverRule === true,
            puzzle: game.puzzle ? {
                stageIndex: game.puzzle.stageIndex,
                turn: game.puzzle.turn,
                winConditionType: game.puzzle.stage.winConditionType,
                winConditionValue: game.puzzle.stage.winConditionValue,
                recommendedTurns: game.puzzle.stage.turnLimit,
                condition: getPuzzleConditionText(game.puzzle.stage),
                starEarned: hasPuzzleStageStar()
            } : null,
            fever: game.fever ? {
                targetCombo: game.fever.targetCombo,
                leftTime: game.fever.leftTime,
                turn: game.fever.turn,
                pendingCombo: game.fever.pendingCombo,
                pendingAllClear: game.fever.pendingAllClear,
                selectedStageTarget: game.fever.selectedStageTarget,
                stageSuppliedPair: [...game.fever.stageSuppliedPair]
            } : null,
            colorCount: game.pairQueueColors.length,
            colors: [...game.pairQueueColors],
            aiDifficulty: getSelectedDifficulty(),
            winner: getRole(game.winner),
            ending: game.ending ? {
                loser: getRole(game.ending.loser),
                winner: getRole(game.ending.winner),
                elapsed: game.ending.elapsed,
                duration: game.ending.duration
            } : null,
            player: getPlayerGameStatus(player, opponent),
            opponent: getPlayerGameStatus(opponent, player),
            recommendedPoint: recommendedPoint ? { ...recommendedPoint } : null
        };
    }

    /**
     * 중앙 영역에 표시되는 양쪽의 다음 두 뿌요 쌍을 JSON 직렬화 가능한 복사본으로 반환한다.
     * 게임이 생성되지 않은 메뉴 상태에서는 null을 반환한다.
     * @returns {{player:{name:string,nextPairs:string[][]},opponent:{name:string,nextPairs:string[][]}}|null} 플레이어와 적의 다음 뿌요 정보
     */
    function getNextPairs() {
        if (!game) return null;
        const [player, opponent] = game.players;
        return {
            player: { name: player.name, nextPairs: player.nextPairs.map((pair) => [...pair]) },
            opponent: { name: opponent.name, nextPairs: opponent.nextPairs.map((pair) => [...pair]) }
        };
    }

    /** 사운드 풀을 준비한다. */
    function prepareSoundPools() {
        if (!commonSoundPool) commonSoundPool = createSoundPool(true);
    }

    /**
     * WebMCP에 노출할 게임 도구를 등록한다. 미지원 브라우저에서는 아무 작업도 하지 않는다.
     * @returns {void}
     */
    function registerWebMcpTools() {
        if (!document.modelContext || typeof document.modelContext.registerTool !== 'function') return;
        webMcpAbortController = new AbortController();
        const emptyInput = { type: 'object', properties: {}, additionalProperties: false };
        const screenSchema = {
            type: 'object',
            properties: {
                screen: { type: 'string', enum: ['initial_title', 'main_menu', 'rule_select', 'practice_difficulty', 'puzzle_stage_select', 'opponent_select', 'fever_opponent_select', 'simulator_draw', 'simulator_simulation', 'simulator_complete', 'settings', 'settings_resetting', 'gallery', 'tutorial_intro', 'tutorial_demo', 'tutorial_result', 'tutorial_complete', 'countdown', 'playing', 'paused', 'ending', 'game_over'], description: 'The exact visible title, puzzle-stage selection, menu, gallery, simulator, tutorial, or match screen.' },
                playerCanControl: { type: 'boolean' }
            },
            required: ['screen', 'playerCanControl']
        };
        const boardColors = [...COLORS, 'garbage', HARD_GARBAGE, IRON_PUYO];
        const puyoSchema = {
            type: 'object', properties: {
                x: { type: 'integer', minimum: 0, maximum: COLUMNS - 1, description: 'Column from the left.' },
                y: { type: 'number', minimum: 0, maximum: ROWS - 1, description: 'Row from the bottom; active puyos may be fractional while falling.' },
                color: { type: 'string', enum: boardColors }
            }, required: ['x', 'y', 'color']
        };
        const boardCellSchema = { type: ['string', 'null'], enum: [...boardColors, null] };
        const activeSchema = {
            type: ['object', 'null'], properties: {
                x: { type: 'integer', minimum: 0, maximum: COLUMNS - 1 }, y: { type: 'number', minimum: 0, maximum: ROWS - 1 }, rotation: { type: 'integer', minimum: 0, maximum: 3 },
                colors: { type: 'array', items: { type: 'string', enum: COLORS }, minItems: 2, maxItems: 2 },
                cells: { type: 'array', items: puyoSchema, minItems: 2, maxItems: 2 }
            }, required: ['x', 'y', 'rotation', 'colors', 'cells']
        };
        const playerSchema = {
            type: 'object', properties: {
                name: { type: 'string' }, isCpu: { type: 'boolean' }, phase: { type: 'string' },
                point: { type: 'number', minimum: 0 }, attack: { type: 'number', minimum: 0 },
                damage: { type: 'number', minimum: 0 }, normalDamage: { type: 'number', minimum: 0 },
                combo: { type: 'integer', minimum: 0 }, placedPairCount: { type: 'integer', minimum: 0 },
                board: { type: 'object', properties: {
                    columns: { type: 'integer', const: COLUMNS }, rows: { type: 'integer', const: ROWS }, visibleRows: { type: 'integer', const: VISIBLE_ROWS },
                    puyos: { type: 'array', items: puyoSchema, description: 'All fixed puyos, including hidden rows.' }
                }, required: ['columns', 'rows', 'visibleRows', 'puyos'] },
                nextPairs: { type: 'array', items: { type: 'array', items: { type: 'string', enum: COLORS }, minItems: 2, maxItems: 2 } },
                warningPuyos: { type: 'array', items: { type: 'string' } },
                fever: { type: ['object', 'null'], properties: {
                    active: { type: 'boolean' }, gauge: { type: 'integer', minimum: 0, maximum: FEVER_GAUGE_MAX },
                    nextTime: { type: 'integer', minimum: FEVER_INITIAL_TIME, maximum: FEVER_MAX_TIME },
                    targetCombo: { type: 'integer', minimum: FEVER_MIN_TARGET_COMBO, maximum: CONTINUOUS_FEVER_MAX_TARGET_COMBO },
                    leftTime: { type: 'number', minimum: 0 }, damage: { type: 'number', minimum: 0 }, turn: { type: 'integer', minimum: 0 },
                    selectedStageTarget: { type: ['integer', 'null'], minimum: FEVER_MIN_TARGET_COMBO, maximum: CONTINUOUS_FEVER_MAX_TARGET_COMBO },
                    stageSuppliedPair: { type: 'array', items: { type: 'string', enum: COLORS }, minItems: 0, maxItems: 2 },
                    field: { type: ['object', 'null'], properties: {
                        columns: { type: 'integer', const: COLUMNS }, rows: { type: 'integer', const: ROWS },
                        cells: { type: 'array', items: { type: 'array', items: boardCellSchema, minItems: COLUMNS, maxItems: COLUMNS }, minItems: ROWS, maxItems: ROWS }
                    }, required: ['columns', 'rows', 'cells'] }
                }, required: ['active', 'gauge', 'nextTime', 'targetCombo', 'leftTime', 'damage', 'turn', 'selectedStageTarget', 'stageSuppliedPair', 'field'] }, active: activeSchema
            }, required: ['name', 'isCpu', 'phase', 'point', 'attack', 'damage', 'normalDamage', 'combo', 'placedPairCount', 'board', 'nextPairs', 'warningPuyos', 'fever', 'active']
        };
        const puzzleSchema = {
            type: ['object', 'null'], properties: {
                stageIndex: { type: 'integer', minimum: 0 }, turn: { type: 'integer', minimum: 1 },
                winConditionType: { type: 'string', enum: ['combo', 'clear', 'multiple', 'attack'] },
                winConditionValue: { type: 'number', minimum: 0 }, recommendedTurns: { type: 'number', minimum: 0 },
                condition: { type: 'string' }, starEarned: { type: 'boolean' }
            }, required: ['stageIndex', 'turn', 'winConditionType', 'winConditionValue', 'recommendedTurns', 'condition', 'starEarned']
        };
        const feverSchema = {
            type: ['object', 'null'],
            properties: {
                targetCombo: { type: 'integer', minimum: FEVER_MIN_TARGET_COMBO, maximum: CONTINUOUS_FEVER_MAX_TARGET_COMBO },
                leftTime: { type: 'number', minimum: 0, description: 'Remaining continuous-fever time in milliseconds.' },
                turn: { type: 'integer', minimum: 0 },
                pendingCombo: { type: 'integer', minimum: 0 },
                pendingAllClear: { type: 'boolean' },
                selectedStageTarget: { type: ['integer', 'null'], minimum: FEVER_MIN_TARGET_COMBO, maximum: CONTINUOUS_FEVER_MAX_TARGET_COMBO },
                stageSuppliedPair: { type: 'array', items: { type: 'string', enum: COLORS }, minItems: 0, maxItems: 2 }
            },
            required: ['targetCombo', 'leftTime', 'turn', 'pendingCombo', 'pendingAllClear', 'selectedStageTarget', 'stageSuppliedPair']
        };
        const statusSchema = {
            type: 'object',
            description: 'Both game fields, score and attack state, upcoming pairs, warning puyos, fever or puzzle state, and the currently controlled pair. Board coordinates start at the bottom-left.',
            properties: {
                screen: { type: 'string', enum: ['playing', 'paused'] },
                playerCanControl: { type: 'boolean' },
                continuousFever: { type: 'boolean' },
                feverRule: { type: 'boolean' },
                puzzle: puzzleSchema,
                fever: feverSchema,
                player: playerSchema, opponent: playerSchema,
                recommendedPoint: { type: ['object', 'null'], properties: {
                    x: { type: 'integer', minimum: 0, maximum: COLUMNS - 1 }, y: { type: 'integer', minimum: 0, maximum: VISIBLE_ROWS - 1 }
                }, required: ['x', 'y'] }
            },
            required: ['screen', 'playerCanControl', 'continuousFever', 'feverRule', 'puzzle', 'fever', 'player', 'opponent', 'recommendedPoint']
        };
        const tools = [
            {
                name: 'manual',
                description: 'Return English instructions for playing Puyo W and using the other available game tools.',
                inputSchema: emptyInput,
                execute: () => 'Puyo W is a falling-pair puzzle battle. During a match control turn, use left/right to move, Z/X to rotate, and down to fall faster. Match four or more same-color puyos to clear them and send attacks. Practice and continuous-fever modes use a solo opponent; continuous fever starts with a 60-second timer and advances through selected fever stages. Puzzle Puyo uses stage objectives and turn limits. Fever-rule players have independent gauge, nextTime, targetCombo, leftTime, and fever field state. Use now_screen to identify the exact menu, puzzle-stage selection, gallery, simulator, tutorial, or match screen. Use now_game_status while a match is playing or paused, and point_recommend only during a controllable player turn. Use show_message to display already-localized text at the top of the current screen.'
            },
            {
                name: 'now_screen',
                description: 'Get the exact visible Puyo W screen, including gallery, standard or fever opponent selection, practice or puzzle-stage selection, simulator modes, tutorial phases, match countdown, ending animation, pause, and game-over. playerCanControl is true only when the human can control an active pair in a match.',
                inputSchema: emptyInput,
                outputSchema: screenSchema,
                execute: getNowScreen
            },
            {
                name: 'now_game_status',
                description: 'Get complete JSON game state only while a normal match is playing or paused: both boards, scores, ATTACK and DAMAGE, upcoming pairs, warning puyos, per-player fever state and fields, optional Puzzle Puyo objective state, and both active pairs with coordinates.',
                inputSchema: emptyInput,
                outputSchema: statusSchema,
                execute: getNowGameStatus
            },
            {
                name: 'point_recommend',
                description: 'While the human player is actively controlling a pair, highlight exactly one recommended board cell at the given integer x and y coordinate. The highlight disappears when that pair locks.',
                inputSchema: {
                    type: 'object', properties: {
                        x: { type: 'integer', minimum: 0, maximum: COLUMNS - 1, description: 'Board column from the left.' },
                        y: { type: 'integer', minimum: 0, maximum: VISIBLE_ROWS - 1, description: 'Board row from the bottom.' }
                    }, required: ['x', 'y'], additionalProperties: false
                },
                execute: ({ x, y }) => {
                    const screen = getNowScreen();
                    if (screen.screen !== 'playing' || !screen.playerCanControl) throw new Error('point_recommend is available only during the player control phase.');
                    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= COLUMNS || y < 0 || y >= VISIBLE_ROWS) throw new RangeError('x and y must identify a visible board cell.');
                    recommendedPoint = { x, y };
                }
            },
            {
                name: 'show_message',
                description: 'Display an already-localized message at the top of the current screen. It remains visible for duration milliseconds (default 2000), then fades out. An optional backgroundColor draws a rectangle behind the text. Do not use this tool for translation.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'The already-localized text to display.' },
                        color: { type: 'string', default: 'white', description: 'CSS text color.' },
                        duration: { type: 'number', minimum: 0, default: 2000, description: 'Milliseconds to remain fully visible before fading out.' },
                        backgroundColor: { type: ['string', 'null'], default: null, description: 'Optional CSS background color behind the message text.' }
                    },
                    required: ['message'],
                    additionalProperties: false
                },
                execute: ({ message, color = 'white', duration = 2000, backgroundColor = null }) => showMessage(message, color, duration, backgroundColor)
            }
        ];
        tools.forEach((tool) => {
            try {
                Promise.resolve(document.modelContext.registerTool(tool, { signal: webMcpAbortController.signal })).catch((error) => console.error('WebMCP tool registration failed.', error));
            } catch (error) {
                console.error('WebMCP tool registration failed.', error);
            }
        });
    }

    /**
     * 게임 이벤트, 애니메이션, WebMCP 도구를 해제하고 이 인스턴스를 초기화 전 상태로 되돌린다.
     * @returns {void}
     */
    function destroy() {
        if (!initialized) return;
        stopBackgroundMusic();
        if (settingsResetTimer !== null) window.clearTimeout(settingsResetTimer);
        if (feverStageValidationTimer !== null) window.clearTimeout(feverStageValidationTimer);
        settingsResetTimer = null;
        feverStageValidationTimer = null;
        settingsResetting = false;
        screenMessage = null;
        gameStartFirework = null;
        window.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('keyup', handleKeyup);
        window.removeEventListener('resize', updateCanvasOrientation);
        window.removeEventListener('orientationchange', updateCanvasOrientation);
        canvas.removeEventListener('click', handleCanvasClick);
        canvas.removeEventListener('pointerdown', handleVirtualPointerDown);
        canvas.removeEventListener('pointermove', handleVirtualPointerMove);
        canvas.removeEventListener('pointerup', handleVirtualPointerUp);
        canvas.removeEventListener('pointercancel', handleVirtualPointerUp);
        resetVirtualControllerInput();
        resetGamepadInput();
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
        if (webMcpAbortController) webMcpAbortController.abort();
        if (createdCanvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        canvas = null;
        context = null;
        game = null;
        simulator = null;
        gallery = null;
        initialGalleryPreview = { loaded: false, items: [], startIndex: 0, elapsed: 0 };
        settingsDraft = null;
        recommendedPoint = null;
        menuScreen = 'initialTitle';
        hasUserStarted = false;
        feverStageValidationComplete = false;
        pendingInitialTitleEntry = false;
        ruleSelectionOpen = false;
        ruleSelectionFocus = 0;
        createdCanvas = false;
        animationFrameId = null;
        webMcpAbortController = null;
        initialized = false;
    }

    /**
     * 웹폰트를 import 하는 style 태그를 만들어 head 에 삽입한다.
     */
    function prepareFontImportStyle() {
        // 먼저 기존 style 태그 존재여부 확인 (클래스 puyow_font_import)
        const existingStyle = document.querySelector('style.puyow_font_import');
        if (existingStyle) return;

        const style = document.createElement('style');
        style.className = 'puyow_font_import';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Nanum+Gothic&family=Nanum+Gothic+Coding&family=Noto+Sans+JP:wght@100..900&family=Noto+Sans+KR:wght@100..900&family=Noto+Sans+Mono:wght@100..900&family=Noto+Sans+SC:wght@100..900&display=swap');
            
            body.puyow-portrait main {
                flex-shrink: 0;
                height: auto;
                max-width: none;
                width: min(100vh, 177.7777777778vw);
            }

            body.puyow-portrait canvas {
                transform: rotate(90deg);
                transform-origin: center;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 지정한 캔버스에 게임을 연결하고 메뉴 렌더링을 시작한다.
     * @param {HTMLCanvasElement|string|null} target 캔버스 요소 또는 요소 id. 생략 시 기본 캔버스를 찾거나 만든다.
     * @returns {void}
     */
    function initialize(target = null) {
        // 같은 캔버스에 이벤트가 중복 등록되지 않도록 초기화는 한 번만 수행한다.
        if (initialized) return;
        // 브라우저 DOM이 없는 CommonJS 실행 환경에서는 초기화를 거절한다.
        if (typeof document === 'undefined' || typeof window === 'undefined') {
            throw new Error('Web Puyo 초기화에는 브라우저 DOM 환경이 필요합니다.');
        }
        prepareFontImportStyle();
        languageCode = navigator.language || navigator.userLanguage || 'ko';
        if (languageCode === 'ko-KR') languageCode = 'ko';
        loadStore();
        soundDataURL = store.settings.soundDataURL;
        loadSoundDataURL();
        createdCanvas = false;
        const usesDefaultCanvas = target === null || target === undefined || target === '';
        const targetElement = usesDefaultCanvas ? document.getElementById('webpuyo_canvas') : typeof target === 'string' ? document.getElementById(target) : target;
        if (targetElement && typeof targetElement.getContext === 'function') {
            // canvas DOM 객체를 직접 전달한 경우에는 해당 요소를 그대로 사용한다.
            canvas = targetElement;
        } else if (targetElement && targetElement.nodeType === 1 && targetElement.tagName.toLowerCase() === 'div') {
            // div를 전달한 경우에는 그 안에 게임용 canvas를 만들어 사용한다.
            canvas = document.createElement('canvas');
            createdCanvas = true;
            canvas.id = 'webpuyo_canvas';
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            canvas.setAttribute('aria-label', 'Web Puyo puzzle game');
            canvas.style.cssText = 'display:block;width:min(100vw, 1280px);height:auto;aspect-ratio:16 / 9;';
            targetElement.appendChild(canvas);
        } else {
            canvas = targetElement;
        }
        // 기본 캔버스가 문서에 없으면 접근 가능한 새 캔버스를 생성한다.
        if (usesDefaultCanvas && !canvas) {
            canvas = document.createElement('canvas');
            createdCanvas = true;
            canvas.id = 'webpuyo_canvas';
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            canvas.setAttribute('aria-label', 'Web Puyo puzzle game');
            canvas.style.cssText = 'display:block;width:min(100vw, 1280px);height:auto;aspect-ratio:16 / 9;';
            document.body.appendChild(canvas);
        }
        // 전달된 대상이 2D 컨텍스트를 만들 수 있는 캔버스인지 검증한다.
        if (!canvas || typeof canvas.getContext !== 'function') {
            throw new TypeError('유효한 canvas 요소 또는 id를 전달해야 합니다.');
        }
        context = canvas.getContext('2d');
        if (!context) throw new Error('2D 캔버스 컨텍스트를 만들 수 없습니다.');
        applyCanvasOutputResolution();
        updateCanvasOrientation();
        initialized = true;
        window.addEventListener('keydown', handleKeydown);
        window.addEventListener('keyup', handleKeyup);
        window.addEventListener('resize', updateCanvasOrientation);
        window.addEventListener('orientationchange', updateCanvasOrientation);
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('pointerdown', handleVirtualPointerDown);
        canvas.addEventListener('pointermove', handleVirtualPointerMove);
        canvas.addEventListener('pointerup', handleVirtualPointerUp);
        canvas.addEventListener('pointercancel', handleVirtualPointerUp);
        initializeGamepadInput();
        prepareSoundPools();
        registerWebMcpTools();
        loadNotice();
        // 첫 화면은 제목과 시작 문구만 즉시 표시한 뒤 갤러리 미리보기를 비동기로 준비한다.
        render();
        scheduleFeverStageValidation();
        loadInitialGalleryPreview();
        animationFrameId = requestAnimationFrame(frame);
    }

    /**
     * 사운드 풀. 음원 파일이 있는 상대/절대경로 URL 주소들을 담는 객체를 만들기 위한 클래스. 플레이어 / 적이 공통으로 갖는 효과음들을 담는다.
     */
    class SoundPool {
        /**  
         * 1연쇄 발생 시 주인공 / 적이 말하는 주문 효과음. (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        spellCombo1 = null;
        /**  
         * 2연쇄 발생 시 주인공 / 적이 말하는 주문 효과음. (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        spellCombo2 = null;
        /**  
         * 3연쇄 발생 시 주인공 / 적이 말하는 주문 효과음. (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        spellCombo3 = null;
        /**  
         * 4연쇄 발생 시 주인공 / 적이 말하는 주문 효과음. (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        spellCombo4 = null;
        /**  
         * 5연쇄 발생 시 주인공 / 적이 말하는 주문 효과음. (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        spellCombo5 = null;
        /**  
         * 6연쇄 발생 시 주인공 / 적이 말하는 주문 효과음. (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        spellCombo6 = null;
        /**  
         * 7 또는 그 이상의 연쇄 발생 시 주인공 / 적이 말하는 주문 효과음. (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        spellCombo7 = null;
        /**  
         * 적의 경우, 해당 적과 게임 시 사용되는 배경 음악. null 인 경우 해당 상황에서 소리가 나지 않는다.
         *     해당 적의 배경 음악이 없으면, 공통 사운드 풀의 backgroundMusic 을 체크해서 있으면 이용한다.
         *     (연습 모드이거나, 시뮬레이터 화면에서 시뮬레이션 모드이거나, 플레이 방법 화면에서도 공통 사운드 풀의 backgroundMusic 이 있으면 재생해야 한다.)
         *     배경 음악이므로 반복되어야 한다.
         * @type {string|null}
         */
        backgroundMusic = null;

        constructor() {}
    }

    /**
     * 공통 사운드 풀. 플레이어 주인공의 주문 효과음과 더불어, 시스템에서 공통으로 사용되는 효과음들도 포함한다.
     */
    class CommonSoundPool extends SoundPool {
        /**  
         * 뿌요가 터지는 소리 효과음, 1연쇄일 때에만 사용, (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        puyoBurstCombo1 = null;

        /**  
         * 뿌요가 터지는 소리 효과음, 2연쇄일 때에만 사용, (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        puyoBurstCombo2 = null;

        /**  
         * 뿌요가 터지는 소리 효과음, 3연쇄일 때에만 사용, (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        puyoBurstCombo3 = null;

        /**  
         * 뿌요가 터지는 소리 효과음, 4연쇄일 때에만 사용, (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        puyoBurstCombo4 = null;

        /**  
         * 뿌요가 터지는 소리 효과음, 5연쇄일 때에만 사용, (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        puyoBurstCombo5 = null;

        /**  
         * 뿌요가 터지는 소리 효과음, 6연쇄일 때에만 사용, (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        puyoBurstCombo6 = null;

        /**  
         * 뿌요가 터지는 소리 효과음, 7 또는 그 이상의 연쇄일 때에만 사용, (null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        puyoBurstCombo7 = null;

        /**  
         * 패배 조건 발생 시 패배 연출 (베젤 무너지는 효과) 직전 재생
         * @type {string|null}
         */
        loose = null;

        /**  
         * 뿌요들 (방해뿌요 제외) 낙하가 종료 (땅 혹은 다른 뿌요에 닿아서) 시 재생 - 닿을 때마다 재생 (동시 재생 가능성이 높음에 유의 !)
         * @type {string|null}
         */
        puyoFall = null;

        /**  
         * 방해뿌요가 낙하가 종료 (땅 혹은 다른 뿌요에 닿아서) 시 재생 (방해뿌요 갯수가 1~5개일 때) - 닿을 때마다 재생 (동시 재생 가능성이 높음에 유의 !)
         * @type {string|null}
         */
        garbageFallLittle = null;

        /**  
         * 방해뿌요가 낙하가 종료 (땅 혹은 다른 뿌요에 닿아서) 시 재생 (방해뿌요 갯수가 6개 이상일 때) - 닿을 때마다 재생 (단 이 효과음이 이미 재생중인 경우는 건너뛴다.)
         * @type {string|null}
         */
        garbageFallLot = null;

        /**  
         * 3연쇄 때의 에너지 이동 효과가 최종 목적지에 도착했을 때
         *     이 연쇄째 공격 ATTACK 수치 차감 계산 시 자신의 피해 DAMAGE 와 상대의 공격 ATTACK 모두를 차감하고도 남았는지 체크하여
         *     1 이상 남은 경우 재생
         * @type {string|null}
         */
        combo3SpellEffect = null;

        /**  
         * 4연쇄 때의 에너지 이동 효과가 최종 목적지에 도착했을 때
         *     이 연쇄째 공격 ATTACK 수치 차감 계산 시 자신의 피해 DAMAGE 와 상대의 공격 ATTACK 모두를 차감하고도 남았는지 체크하여
         *     1 이상 남은 경우 재생
         * @type {string|null}
         */
        combo4SpellEffect = null;

        /**  
         * 5연쇄 때의 에너지 이동 효과가 최종 목적지에 도착했을 때
         *     이 연쇄째 공격 ATTACK 수치 차감 계산 시 자신의 피해 DAMAGE 와 상대의 공격 ATTACK 모두를 차감하고도 남았는지 체크하여
         *     1 이상 남은 경우 재생
         * @type {string|null}
         */
        combo5SpellEffect = null;

        /**  
         * 6 이상의 매 연쇄마다, 에너지 이동 효과가 최종 목적지에 도착했을 때
         *     이 연쇄째 공격 ATTACK 수치 차감 계산 시 자신의 피해 DAMAGE 와 상대의 공격 ATTACK 모두를 차감하고도 남았는지 체크하여
         *     1 이상 남은 경우 재생
         * @type {string|null}
         */
        combo6SpellEffect = null;

        /**  
         * 1연쇄 발생 시 적이 말하는 주문 효과음. (해당 적의 SoundPool 의 spellCombo1 이 null일 때 대신 사용, null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        commonEnemySpellCombo1 = null;
        /**  
         * 2연쇄 발생 시 적이 말하는 주문 효과음. (해당 적의 SoundPool 의 spellCombo2 이 null일 때 대신 사용, null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        commonEnemySpellCombo2 = null;
        /**  
         * 3연쇄 발생 시 적이 말하는 주문 효과음. (해당 적의 SoundPool 의 spellCombo3 이 null일 때 대신 사용, null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        commonEnemySpellCombo3 = null;
        /**  
         * 4연쇄 발생 시 적이 말하는 주문 효과음. (해당 적의 SoundPool 의 spellCombo4 이 null일 때 대신 사용, null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        commonEnemySpellCombo4 = null;
        /**  
         * 5연쇄 발생 시 적이 말하는 주문 효과음. (해당 적의 SoundPool 의 spellCombo5 이 null일 때 대신 사용, null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        commonEnemySpellCombo5 = null;
        /**  
         * 6연쇄 발생 시 적이 말하는 주문 효과음. (해당 적의 SoundPool 의 spellCombo6 이 null일 때 대신 사용, null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        commonEnemySpellCombo6 = null;
        /**  
         * 7연쇄 발생 시 적이 말하는 주문 효과음. (해당 적의 SoundPool 의 spellCombo7 이 null일 때 대신 사용, null 인 경우 해당 상황에서 소리가 나지 않는다.)
         * @type {string|null}
         */
        commonEnemySpellCombo7 = null;

        /**
         * 카운트 다운이 끝나고 게임이 시작될 때 재생되는 효과음
         * @type {string|null}
         */
        gameStarts = null;

        /**
         * 모든 화면에서, 버튼이나 선택지를 클릭 (엔터 키로 선택해도 마찬가지) 했을 때 재생되는 효과음 (단, 취소나 종료 선택지/버튼은 제외)
         * @type {string|null}
         */
        selects = null;

        /**
         * 모든 화면에서, 취소/종료 버튼이나 선택지를 클릭 (엔터 키로 선택해도 마찬가지) 했을 때 재생되는 효과음
         * @type {string|null}
         */
        cancels = null;

        /**
         * 모든 화면에서, 버튼이나 선택지 포커스가 이동할 때 재생되는 효과음
         * @type {string|null}
         */
        focusMoves = null;

        /**
         * 모든 게임 모드에서, 뿌요를 사용자 혹은 적이 회전시킬 때 재생되는 효과음
         * @type {string|null}
         */
        puyoRotate = null;

        /**
         * 모든 게임 모드에서, 싹쓸이 발동으로 인한 연출 시작 전 재생되는 효과음
         * @type {string|null}
         */
        clears = null;

        /**
         * 연속 피버 게임 시작 또는 피버 룰에서 피버 상태에 진입 시 재생되는 효과음
         * @type {string|null}
         */
        feverEnter = null;

        /**
         * 피버 룰에서, 중앙의 전등이 들어올 때마다 재생되는 효과음
         * @type {string|null}
         */
        feverLightOn = null;

        /**  
         * 전투 중이 아닌 상황에서 재생되는 배경 음악, null 인 경우 해당 상황에서 소리가 나지 않는다.
         *     배경 음악이므로 반복되어야 한다.
         * @type {string|null}
         */
        otherBackgroundMusic = null;

        /**
         * 연속 피버 모드, 혹은 피버 룰에서 플레이어 혹은 적 둘 중 하나라도 피버 상태에 있을 때 기존 배경음악 대신 재생되는 배경음악
         *     배경 음악이므로 반복되어야 한다.
         *     (피버 상태가 끝나면 바로 이전 배경음악으로 돌아가야 한다.)
         *
         * @type {string|null}
         */
        feverBackgroundMusic = null;

        constructor() { super(); }
    }

    /**
     * 적 음성 및 배경음악을 저장하는 사운드 풀
     */
    class EnemySoundPool extends SoundPool {
        constructor() { super(); }
    }

    /**
     * 사운드 풀 객체를 생성한다.
     * @param {boolean} commons 공통 시스템용으로 생성할 지 여부 (false 시 적 캐릭터를 위한 사운드 풀 반환)
     * @returns {SoundPool|CommonSoundPool} 새 사운드 풀 객체
     */
    function createSoundPool(commons) {
        if (commons) return new CommonSoundPool();
        return new EnemySoundPool();
    }

    /**
     * 퍼즐 뿌요 모드에서 쓰일 하나의 스테이지
     */
    class PuzzlePuyoStage {
        /**
         * 이 객체의 고유 ID
         */
        uid = 'PZ' + (Math.floor(randomFloat() * 89999999) + 10000000);

        /**
         * 뿌요 배치 정보, 시뮬레이터 모드의 JSON복사 기능으로 생성된 데이터와 호환된다.
         *    예: {"puyos":[{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":5,"y":1,"color":"red"}]}
         * @type {Object}
         */
        stageData = {};

        /**
         * 이 배치가 끝나자마자 그 다음에 플레이어의 컨트롤 차례가 됐을 때 제공되어야 하는 뿌요 색 정보.
         *     원소로 또 배열이 들어가야 하며, 내부 배열 안에 색상 이름이 2개가 들어가야 한다. (예: [["red","blue"],["green","yellow"]])
         *     이 횟수만큼 뿌요를 지급 받고도 이후에 계속 플레이어 컨트롤 타이밍이 돌아온다면 그 때는 기본 룰 5색과 동일한 방식으로 뿌요를 지급한다.
         *     (FeverStageState 와 호환되지 않으니 유의 !)
         * 
         * @type {string[][]}
         */
        suppliedNextPuyos = [];

        /**
         * 플레이어가 이 횟수만큼의 "컨트롤 타이밍" 동안 클리어를 해야 한다.
         *     이 횟수를 초과해도 게임은 계속 가능하지만 "별" (승리로 스테이지 종료 시 별 획득 여부 출력 예정) 을 획득할 수 없다.
         *     (이 횟수 이내에 승리 조건 만족 시 "별"을 획득한다.)
         * 
         * 0 이하의 값을 지정하면 제한이 없는 것으로 간주한다.
         * 
         * @type {number}
         */
        turnLimit = 0;

        /**
         * 이 퍼즐 스테이지의 승리 조건 유형
         *     연쇄 (combo), 싹쓸이 (clear), 동시 폭발 뿌요 수 (multiple) 중 하나가 들어가야 한다.
         * 
         *     combo : 목표 연쇄 수를 달성하면 승리
         *     clear : 싹쓸이 발생 시 승리
         *     multiple : 한 번의 연쇄에 동시에 터지는 뿌요 수가 한 번이라도 목표 수 이상으로 넘어갔다면 승리
         *     attack : 발생시킨 공격 ATTACK + 상대에게 적용한 피해 DAMAGE (즉 예고뿌요가 나타내는 방해뿌요 총 수) 합이 순간적으로 이 목표 수 이상으로 넘어갔다면 승리
         * 
         * 목표 연쇄 수나 동시 폭발 뿌요 수 등의 값은 winConditionValue 에 들어가야 한다.
         * 
         * @type {string}
         */
        winConditionType = 'combo';

        /**
         * 이 퍼즐 스테이지의 승리 조건 값
         * 
         * @type {number}
         */
        winConditionValue = 4;

        /**
         * 이 퍼즐 스테이지의 힌트 문구. (예: "2연쇄를 노려보자!")
         *     빈 문자열이면 힌트가 없는 것으로 간주한다.
         * 
         * 흰트 문구는 한글로 입력한다. (게임 내에서 이 값을 다국어 처리 후 출력한다.)
         * 
         * @type {string}
         */
        hint = '';

        /**
         * 숨김 여부, 숨겨진 스테이지는 화면에 출력되지 않는다.
         * 
         * @type {boolean}
         */
        hidden = false;

        /**
         * 이 퍼즐 스테이지 오픈 여부, 게임 중 변경되는 값이다.
         * true 시 오픈됨, false 시 아직 오픈되지 않음
         *     처음에는 첫 번째와 두 번째 스테이지만 오픈한다.
         *     이전 스테이지를 클리어하면 다다음 (앞 2개) 스테이지를 오픈한다.
         *     (예: 1, 2 스테이지가 오픈되어 있고 1 스테이지를 클리어한 경우, 2, 3 스테이지가 오픈되어야 하나 2 스테이지는 이미 오픈되었으므로 3 스테이지만 오픈한다.)
         * @type {boolean}
         */
        opened = false;

        constructor(plainObject) {
            if(typeof(plainObject.stageData) != 'undefined') this.stageData = plainObject.stageData;
            if(typeof(plainObject.suppliedNextPuyos) != 'undefined') this.suppliedNextPuyos = plainObject.suppliedNextPuyos;
            if(typeof(plainObject.turnLimit) != 'undefined') this.turnLimit = plainObject.turnLimit;
            if(typeof(plainObject.winConditionType) != 'undefined') this.winConditionType = plainObject.winConditionType;
            if(typeof(plainObject.winConditionValue) != 'undefined') this.winConditionValue = plainObject.winConditionValue;
            if(typeof(plainObject.hint) != 'undefined') this.hint = plainObject.hint;
            if(typeof(plainObject.hidden) != 'undefined') this.hidden = plainObject.hidden;
            if(typeof(plainObject.uid) != 'undefined') this.uid = plainObject.uid;
            if(typeof(plainObject.opened) != 'undefined') this.opened = plainObject.opened;
        }
    }

        /**
     * 퍼즐뿌요 스테이지들을 순서대로 담을 배열.
     * 
     * @type {PuzzlePuyoStage[]}
     */
    const PUZZLE_STAGES = [
        new PuzzlePuyoStage({
            stageData : {"puyos":[{"x":2,"y":0,"color":"blue"},{"x":3,"y":0,"color":"blue"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":3,"y":1,"color":"green"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":4,"y":2,"color":"red"}]},
            suppliedNextPuyos : [['green', 'blue'], ['green', 'green']],
            turnLimit : 2,
            winConditionType : 'combo',
            winConditionValue : 3,
            hint : '한 번만 회전해',
            opened : true
        }),
        new PuzzlePuyoStage({
            stageData : {"puyos":[{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":3,"y":1,"color":"garbage"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"blue"},{"x":3,"y":2,"color":"blue"}]},
            suppliedNextPuyos : [['green', 'green'], ['red', 'blue'], ['green', 'green']],
            turnLimit : 3,
            winConditionType : 'clear',
            winConditionValue : 0,
            hint : '마지막 폭발은 초록색으로',
            opened : true
        }),
        new PuzzlePuyoStage({
            stageData : {"puyos":[{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"purple"},{"x":5,"y":0,"color":"blue"},{"x":1,"y":1,"color":"garbage"},{"x":2,"y":1,"color":"green"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"purple"},{"x":5,"y":1,"color":"blue"},{"x":2,"y":2,"color":"red"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"blue"},{"x":3,"y":3,"color":"purple"},{"x":3,"y":4,"color":"purple"}]},
            suppliedNextPuyos : [['blue', 'blue'], ['green', 'green'], ['blue', 'blue']],
            turnLimit : 3,
            winConditionType : 'combo',
            winConditionValue : 5,
            hint : '방해뿌요는 터뜨려야 제맛'
        }),
        new PuzzlePuyoStage({
            stageData : {"puyos":[{"x":0,"y":0,"color":"garbage"},{"x":1,"y":0,"color":"garbage"},{"x":2,"y":0,"color":"garbage"},{"x":3,"y":0,"color":"garbage"},{"x":4,"y":0,"color":"garbage"},{"x":5,"y":0,"color":"garbage"},{"x":0,"y":1,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"garbage"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"red"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"garbage"},{"x":1,"y":2,"color":"garbage"},{"x":2,"y":2,"color":"red"},{"x":3,"y":2,"color":"garbage"},{"x":4,"y":2,"color":"garbage"},{"x":5,"y":2,"color":"garbage"},{"x":0,"y":3,"color":"red"},{"x":1,"y":3,"color":"garbage"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"garbage"},{"x":4,"y":3,"color":"red"},{"x":5,"y":3,"color":"garbage"},{"x":0,"y":4,"color":"garbage"},{"x":1,"y":4,"color":"red"},{"x":2,"y":4,"color":"garbage"},{"x":3,"y":4,"color":"garbage"},{"x":4,"y":4,"color":"red"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"garbage"},{"x":1,"y":5,"color":"red"},{"x":2,"y":5,"color":"red"},{"x":3,"y":5,"color":"garbage"},{"x":4,"y":5,"color":"garbage"},{"x":5,"y":5,"color":"garbage"},{"x":0,"y":6,"color":"red"},{"x":1,"y":6,"color":"garbage"},{"x":2,"y":6,"color":"garbage"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"red"},{"x":0,"y":7,"color":"garbage"},{"x":1,"y":7,"color":"red"},{"x":2,"y":7,"color":"red"},{"x":4,"y":7,"color":"garbage"},{"x":0,"y":8,"color":"red"},{"x":0,"y":9,"color":"red"}]},
            suppliedNextPuyos : [['red', 'red'], ['red', 'red'], ['red', 'red'], ['red', 'red'], ['red', 'red'], ['red', 'red']],
            turnLimit : 3,
            winConditionType : 'clear',
            winConditionValue : 0,
            hint : '어디부터 터뜨려야 잘 터뜨렸다고 소문이 날까? 오른쪽?'
        }),
        new PuzzlePuyoStage({
            stageData : {"puyos":[{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"green"},{"x":5,"y":2,"color":"blue"},{"x":3,"y":3,"color":"green"},{"x":4,"y":3,"color":"purple"},{"x":5,"y":3,"color":"blue"},{"x":4,"y":4,"color":"red"},{"x":5,"y":4,"color":"green"},{"x":5,"y":5,"color":"green"},{"x":5,"y":6,"color":"purple"},{"x":5,"y":7,"color":"purple"},{"x":5,"y":8,"color":"purple"},{"x":5,"y":9,"color":"red"}]},
            suppliedNextPuyos : [['red', 'red'], ['green', 'green']],
            turnLimit : 2,
            winConditionType : 'combo',
            winConditionValue : 6,
            hint : '저 위의 빨간 색은 왜 있을까?'
        }),
        new PuzzlePuyoStage({
            stageData : {"puyos":[{"x":0,"y":0,"color":"red"},{"x":1,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":3,"y":1,"color":"blue"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"green"},{"x":1,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"green"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"blue"},{"x":1,"y":3,"color":"blue"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"green"},{"x":0,"y":4,"color":"blue"},{"x":1,"y":4,"color":"green"},{"x":3,"y":4,"color":"yellow"},{"x":4,"y":4,"color":"yellow"},{"x":5,"y":4,"color":"yellow"},{"x":0,"y":5,"color":"purple"},{"x":1,"y":5,"color":"blue"},{"x":3,"y":5,"color":"red"},{"x":4,"y":5,"color":"blue"},{"x":5,"y":5,"color":"green"},{"x":0,"y":6,"color":"red"},{"x":1,"y":6,"color":"purple"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"blue"},{"x":5,"y":6,"color":"blue"},{"x":0,"y":7,"color":"red"},{"x":1,"y":7,"color":"yellow"},{"x":3,"y":7,"color":"red"},{"x":4,"y":7,"color":"purple"},{"x":5,"y":7,"color":"green"},{"x":0,"y":8,"color":"red"},{"x":1,"y":8,"color":"blue"},{"x":3,"y":8,"color":"blue"},{"x":4,"y":8,"color":"purple"},{"x":5,"y":8,"color":"purple"},{"x":0,"y":9,"color":"green"},{"x":1,"y":9,"color":"green"},{"x":3,"y":9,"color":"yellow"},{"x":4,"y":9,"color":"green"},{"x":5,"y":9,"color":"green"},{"x":0,"y":10,"color":"purple"},{"x":1,"y":10,"color":"red"},{"x":3,"y":10,"color":"purple"},{"x":4,"y":10,"color":"red"},{"x":5,"y":10,"color":"green"},{"x":5,"y":11,"color":"blue"}]},
            suppliedNextPuyos : [['green', 'yellow'], ['yellow', 'red'], ['green', 'green'], ['purple', 'green'], ['blue', 'green'], ['green', 'blue']],
            turnLimit : 6,
            winConditionType : 'clear',
            winConditionValue : 0,
            hint : '그냥 내려 봐'
        })
    ];

    /** 
     * 연속 피버 및 피버 룰 에 쓰일, 
     *    플레이 영역에 사전에 뿌요들을 배치하는 정보와 그 연쇄 수를 담은 객체를 위한 클래스. 
     *    "피버 스테이지" 객체 라고 부를 예정.
     * 
     * 이 객체의 데이터대로 플레이어의 보드에 뿌요를 배치하고, 플레이어가 특정 위치에 뿌요를 놓으면, 해당 연쇄가 발생한다.
     *     뿌요 배치 정보와, 연쇄 수, 뿌요 배치 직후에 제공되는 뿌요 색과 구성 정보 포함
     * 
    */
    class FeverStageState {
        /**
         * 뿌요 배치 정보, 시뮬레이터 모드의 JSON복사 기능으로 생성된 데이터와 호환된다.
         *    예: {"puyos":[{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":5,"y":1,"color":"red"}]}
         * @type {Object}
         */
        stageData = {};

        /**
         * 목표 연쇄 수, 1 ~ 19 사이의 정수가 들어가야 한다. (19연쇄 초과는 논리적으로 불가능하다. 6 * 13 = 78칸, 78칸에 4개씩 뿌요를 배치하면 최대 19연쇄까지 가능.)
         * @type {number}
         */
        targetCombo = 1;

        /**
         * 이 배치가 끝나자마자 그 다음에 플레이어의 컨트롤 차례가 됐을 때 제공되어야 하는 뿌요 색 목록
         *     PuzzlePuyoStage 클래스와는 다르게 1회 치 정보만 탑재한다.
         *     배열로 안에는 색 이름 (red, blue, ...) 의 문자열이 2개가 들어가야 한다.
         * @type {string[]}
         */
        suppliedNextPuyos = [];

        /**
         * 이 피버 퍼즐의 난이도
         * @type {number}
         */
        difficulty = 1;

        /**
         * 사용하는 색상 목록
         * @type {string[]}
         */
        usingColors = ['red', 'blue', 'green', 'yellow'];

        /**
         * @param {Object} pStageData 피버 필드 배치
         * @param {number} pTargetCombo 목표 연쇄 수
         * @param {string[]} pSuppliedNextPuyos 지급할 다음 뿌요
         * @param {number} difficulty 패턴 난이도
         * @param {string[]} [pUsingColors] 패턴에서 사용하는 일반 뿌요 색상 목록
         */
        constructor(pStageData, pTargetCombo, pSuppliedNextPuyos, difficulty, pUsingColors) {
            if(typeof(pStageData) != 'undefined') this.stageData = pStageData;
            if(typeof(pTargetCombo) != 'undefined') this.targetCombo = pTargetCombo;
            if(typeof(pSuppliedNextPuyos) != 'undefined') this.suppliedNextPuyos = pSuppliedNextPuyos;
            if(typeof(difficulty) != 'undefined') this.difficulty = difficulty;
            const patternColors = [...new Set([
                ...(this.stageData.puyos || []).map((puyo) => puyo.color),
                ...this.suppliedNextPuyos
            ].filter((color) => color && color !== 'garbage'))];
            this.usingColors = Array.isArray(pUsingColors) ? [...new Set(pUsingColors.filter((color) => color && color !== 'garbage'))] : patternColors;
        }
    }

    /**
     * "피버 스테이지" 객체들을 담을 배열, 4 ~ 12연쇄 까지만 담을 예정. 
     *     (연속 피버 및 피버 룰에서의 피버 상태에서는 5연쇄부터 사용, 피버 룰에서 피버 상태 아닐 때 싹쓸이 시 4연쇄 패턴 배치)
     *     (연속 피버 및 피버 룰에서의 피버 상태에서 사용자가 4연쇄 미만을 한 경우, 4연쇄 패턴을 사용해야 함)
     * 
     * @type {FeverStageState[]}
     */
    const FEVER_STAGES = [
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"green"},{"x":2,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"garbage"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"yellow"},{"x":1,"y":3,"color":"yellow"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"green"},{"x":1,"y":4,"color":"garbage"},{"x":2,"y":4,"color":"yellow"},{"x":3,"y":4,"color":"garbage"},{"x":4,"y":4,"color":"green"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"red"},{"x":1,"y":5,"color":"yellow"},{"x":2,"y":5,"color":"green"},{"x":3,"y":5,"color":"red"},{"x":4,"y":5,"color":"yellow"},{"x":5,"y":5,"color":"yellow"},{"x":0,"y":6,"color":"red"},{"x":1,"y":6,"color":"garbage"},{"x":2,"y":6,"color":"yellow"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"yellow"},{"x":5,"y":6,"color":"green"},{"x":1,"y":7,"color":"yellow"},{"x":2,"y":7,"color":"yellow"},{"x":3,"y":7,"color":"garbage"},{"x":4,"y":7,"color":"green"},{"x":5,"y":7,"color":"green"},{"x":2,"y":8,"color":"red"},{"x":3,"y":8,"color":"green"},{"x":5,"y":8,"color":"yellow"},{"x":5,"y":9,"color":"red"},{"x":5,"y":10,"color":"red"},{"x":5,"y":11,"color":"green"}]},
            12,
            ['red', 'red'],
            2,
            ['red', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"green"},{"x":2,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"garbage"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"yellow"},{"x":1,"y":3,"color":"yellow"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"green"},{"x":1,"y":4,"color":"garbage"},{"x":2,"y":4,"color":"yellow"},{"x":3,"y":4,"color":"garbage"},{"x":4,"y":4,"color":"green"},{"x":5,"y":4,"color":"red"},{"x":2,"y":5,"color":"green"},{"x":3,"y":5,"color":"red"},{"x":4,"y":5,"color":"yellow"},{"x":5,"y":5,"color":"yellow"},{"x":2,"y":6,"color":"yellow"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"yellow"},{"x":5,"y":6,"color":"green"},{"x":2,"y":7,"color":"yellow"},{"x":3,"y":7,"color":"garbage"},{"x":4,"y":7,"color":"green"},{"x":5,"y":7,"color":"green"},{"x":2,"y":8,"color":"red"},{"x":3,"y":8,"color":"green"},{"x":5,"y":8,"color":"yellow"},{"x":5,"y":9,"color":"red"},{"x":5,"y":10,"color":"red"},{"x":5,"y":11,"color":"green"}]},
            11,
            ['yellow', 'yellow'],
            2,
            ['red', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"green"},{"x":2,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"garbage"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"yellow"},{"x":1,"y":3,"color":"yellow"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"green"},{"x":1,"y":4,"color":"garbage"},{"x":2,"y":4,"color":"yellow"},{"x":3,"y":4,"color":"garbage"},{"x":4,"y":4,"color":"green"},{"x":5,"y":4,"color":"red"},{"x":2,"y":5,"color":"green"},{"x":3,"y":5,"color":"red"},{"x":4,"y":5,"color":"yellow"},{"x":5,"y":5,"color":"yellow"},{"x":2,"y":6,"color":"red"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"yellow"},{"x":5,"y":6,"color":"green"},{"x":5,"y":7,"color":"green"},{"x":5,"y":8,"color":"yellow"},{"x":5,"y":9,"color":"red"},{"x":5,"y":10,"color":"red"},{"x":5,"y":11,"color":"green"}]},
            10,
            ['green', 'green'],
            2,
            ['red', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"green"},{"x":2,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"garbage"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"yellow"},{"x":1,"y":3,"color":"yellow"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"green"},{"x":1,"y":4,"color":"garbage"},{"x":2,"y":4,"color":"yellow"},{"x":3,"y":4,"color":"garbage"},{"x":4,"y":4,"color":"green"},{"x":5,"y":4,"color":"red"},{"x":2,"y":5,"color":"green"},{"x":3,"y":5,"color":"red"},{"x":5,"y":5,"color":"yellow"},{"x":2,"y":6,"color":"red"},{"x":3,"y":6,"color":"red"},{"x":5,"y":6,"color":"yellow"},{"x":5,"y":7,"color":"red"},{"x":5,"y":8,"color":"red"},{"x":5,"y":9,"color":"green"}]},
            9,
            ['yellow', 'yellow'],
            2,
            ['red', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"green"},{"x":2,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"garbage"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"yellow"},{"x":1,"y":3,"color":"yellow"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"green"},{"x":1,"y":4,"color":"garbage"},{"x":2,"y":4,"color":"yellow"},{"x":3,"y":4,"color":"garbage"},{"x":4,"y":4,"color":"green"},{"x":5,"y":4,"color":"red"},{"x":2,"y":5,"color":"green"},{"x":3,"y":5,"color":"red"},{"x":5,"y":5,"color":"red"},{"x":2,"y":6,"color":"red"},{"x":3,"y":6,"color":"red"}]},
            8,
            ['green', 'red'],
            2,
            ['red', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"green"},{"x":2,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"garbage"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"yellow"},{"x":1,"y":3,"color":"yellow"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":0,"y":4,"color":"green"},{"x":1,"y":4,"color":"garbage"},{"x":2,"y":4,"color":"yellow"},{"x":3,"y":4,"color":"garbage"},{"x":2,"y":5,"color":"green"},{"x":3,"y":5,"color":"red"},{"x":2,"y":6,"color":"red"},{"x":3,"y":6,"color":"red"}]},
            7,
            ['green', 'green'],
            2,
            ['red', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"green"},{"x":2,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"garbage"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":0,"y":3,"color":"yellow"},{"x":1,"y":3,"color":"yellow"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"red"},{"x":0,"y":4,"color":"green"},{"x":1,"y":4,"color":"garbage"},{"x":2,"y":4,"color":"yellow"},{"x":2,"y":5,"color":"green"},{"x":2,"y":6,"color":"red"}]},
            6,
            ['red', 'red'],
            2,
            ['red', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"green"},{"x":2,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"garbage"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"yellow"},{"x":0,"y":3,"color":"yellow"},{"x":4,"y":3,"color":"yellow"},{"x":0,"y":4,"color":"green"}]},
            5,
            ['yellow', 'yellow'],
            2,
            ['red', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"green"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"red"},{"x":1,"y":1,"color":"green"},{"x":2,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":1,"y":2,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":4,"y":3,"color":"green"}]},
            4,
            ['green', 'green'],
            1,
            ['red', 'green']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"yellow"},{"x":0,"y":1,"color":"blue"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"yellow"},{"x":4,"y":1,"color":"red"},{"x":5,"y":1,"color":"yellow"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"yellow"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"yellow"},{"x":5,"y":2,"color":"blue"},{"x":0,"y":3,"color":"blue"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"blue"},{"x":3,"y":3,"color":"yellow"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"blue"},{"x":0,"y":4,"color":"yellow"},{"x":1,"y":4,"color":"yellow"},{"x":2,"y":4,"color":"yellow"},{"x":3,"y":4,"color":"red"},{"x":4,"y":4,"color":"yellow"},{"x":5,"y":4,"color":"yellow"},{"x":0,"y":5,"color":"blue"},{"x":1,"y":5,"color":"blue"},{"x":2,"y":5,"color":"blue"},{"x":4,"y":5,"color":"red"},{"x":5,"y":5,"color":"yellow"},{"x":0,"y":6,"color":"yellow"},{"x":4,"y":6,"color":"blue"},{"x":5,"y":6,"color":"red"},{"x":0,"y":7,"color":"blue"},{"x":5,"y":7,"color":"red"},{"x":0,"y":8,"color":"yellow"},{"x":5,"y":8,"color":"blue"},{"x":0,"y":9,"color":"blue"},{"x":5,"y":9,"color":"blue"},{"x":0,"y":10,"color":"yellow"},{"x":5,"y":10,"color":"blue"},{"x":0,"y":11,"color":"red"}]},
            12,
            ['blue', 'red'],
            3,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"yellow"},{"x":0,"y":1,"color":"blue"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"yellow"},{"x":4,"y":1,"color":"red"},{"x":5,"y":1,"color":"yellow"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"yellow"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"yellow"},{"x":5,"y":2,"color":"blue"},{"x":0,"y":3,"color":"blue"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"blue"},{"x":3,"y":3,"color":"yellow"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"blue"},{"x":0,"y":4,"color":"yellow"},{"x":1,"y":4,"color":"yellow"},{"x":2,"y":4,"color":"yellow"},{"x":3,"y":4,"color":"red"},{"x":4,"y":4,"color":"yellow"},{"x":5,"y":4,"color":"yellow"},{"x":0,"y":5,"color":"blue"},{"x":4,"y":5,"color":"red"},{"x":5,"y":5,"color":"yellow"},{"x":0,"y":6,"color":"yellow"},{"x":4,"y":6,"color":"blue"},{"x":5,"y":6,"color":"red"},{"x":0,"y":7,"color":"blue"},{"x":5,"y":7,"color":"red"},{"x":0,"y":8,"color":"yellow"},{"x":5,"y":8,"color":"blue"},{"x":0,"y":9,"color":"red"},{"x":5,"y":9,"color":"blue"},{"x":5,"y":10,"color":"blue"}]},
            11,
            ['yellow', 'red'],
            3,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"yellow"},{"x":0,"y":1,"color":"blue"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"yellow"},{"x":4,"y":1,"color":"red"},{"x":5,"y":1,"color":"yellow"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"yellow"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"yellow"},{"x":5,"y":2,"color":"blue"},{"x":0,"y":3,"color":"blue"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"blue"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"blue"},{"x":0,"y":4,"color":"yellow"},{"x":2,"y":4,"color":"red"},{"x":3,"y":4,"color":"yellow"},{"x":4,"y":4,"color":"red"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"blue"},{"x":3,"y":5,"color":"blue"},{"x":4,"y":5,"color":"yellow"},{"x":5,"y":5,"color":"red"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"blue"},{"x":5,"y":6,"color":"yellow"},{"x":5,"y":7,"color":"yellow"},{"x":5,"y":8,"color":"blue"},{"x":5,"y":9,"color":"blue"},{"x":5,"y":10,"color":"red"}]},
            10,
            ['yellow', 'blue'],
            3,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"yellow"},{"x":0,"y":1,"color":"blue"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"yellow"},{"x":4,"y":1,"color":"red"},{"x":5,"y":1,"color":"yellow"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"yellow"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"yellow"},{"x":5,"y":2,"color":"blue"},{"x":0,"y":3,"color":"blue"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"blue"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"blue"},{"x":0,"y":4,"color":"yellow"},{"x":3,"y":4,"color":"yellow"},{"x":4,"y":4,"color":"red"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"blue"},{"x":4,"y":5,"color":"yellow"},{"x":5,"y":5,"color":"red"},{"x":0,"y":6,"color":"yellow"},{"x":4,"y":6,"color":"blue"},{"x":5,"y":6,"color":"yellow"},{"x":5,"y":7,"color":"yellow"},{"x":5,"y":8,"color":"blue"}]},
            9,
            ['red', 'blue'],
            4,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"yellow"},{"x":0,"y":1,"color":"blue"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"yellow"},{"x":4,"y":1,"color":"red"},{"x":5,"y":1,"color":"yellow"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"yellow"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"yellow"},{"x":5,"y":2,"color":"blue"},{"x":0,"y":3,"color":"blue"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"blue"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"blue"},{"x":0,"y":4,"color":"yellow"},{"x":4,"y":4,"color":"red"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"blue"},{"x":4,"y":5,"color":"yellow"},{"x":5,"y":5,"color":"red"},{"x":0,"y":6,"color":"yellow"},{"x":5,"y":6,"color":"yellow"}]},
            8,
            ['red', 'blue'],
            4,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"yellow"},{"x":0,"y":1,"color":"blue"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"yellow"},{"x":4,"y":1,"color":"red"},{"x":5,"y":1,"color":"yellow"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"yellow"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"yellow"},{"x":5,"y":2,"color":"blue"},{"x":0,"y":3,"color":"blue"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"blue"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"blue"},{"x":0,"y":4,"color":"yellow"},{"x":4,"y":4,"color":"red"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"blue"},{"x":0,"y":6,"color":"yellow"}]},
            7,
            ['red', 'blue'],
            4,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"yellow"},{"x":0,"y":1,"color":"blue"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"yellow"},{"x":4,"y":1,"color":"red"},{"x":5,"y":1,"color":"yellow"},{"x":0,"y":2,"color":"yellow"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"yellow"},{"x":5,"y":2,"color":"blue"},{"x":0,"y":3,"color":"blue"},{"x":2,"y":3,"color":"red"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"blue"},{"x":0,"y":4,"color":"yellow"},{"x":4,"y":4,"color":"red"},{"x":5,"y":4,"color":"red"}]},
            6,
            ['yellow', 'yellow'],
            3,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"red"},{"x":5,"y":0,"color":"yellow"},{"x":0,"y":1,"color":"blue"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"yellow"},{"x":4,"y":1,"color":"red"},{"x":5,"y":1,"color":"yellow"},{"x":0,"y":2,"color":"yellow"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"blue"},{"x":4,"y":2,"color":"yellow"},{"x":0,"y":3,"color":"blue"},{"x":2,"y":3,"color":"red"},{"x":4,"y":3,"color":"blue"},{"x":0,"y":4,"color":"yellow"}]},
            5,
            ['yellow', 'yellow'],
            3,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"red"},{"x":0,"y":1,"color":"blue"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"yellow"},{"x":4,"y":1,"color":"red"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"yellow"},{"x":2,"y":2,"color":"yellow"},{"x":4,"y":2,"color":"yellow"},{"x":0,"y":3,"color":"blue"},{"x":0,"y":4,"color":"yellow"}]},
            4,
            ['yellow', 'red'],
            2,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"blue"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"blue"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"yellow"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"blue"},{"x":3,"y":2,"color":"red"},{"x":4,"y":2,"color":"blue"},{"x":5,"y":2,"color":"red"},{"x":0,"y":3,"color":"red"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"red"},{"x":5,"y":3,"color":"green"},{"x":0,"y":4,"color":"red"},{"x":1,"y":4,"color":"red"},{"x":2,"y":4,"color":"blue"},{"x":3,"y":4,"color":"green"},{"x":4,"y":4,"color":"green"},{"x":5,"y":4,"color":"blue"},{"x":0,"y":5,"color":"yellow"},{"x":1,"y":5,"color":"blue"},{"x":2,"y":5,"color":"blue"},{"x":3,"y":5,"color":"yellow"},{"x":4,"y":5,"color":"red"},{"x":5,"y":5,"color":"blue"},{"x":0,"y":6,"color":"red"},{"x":1,"y":6,"color":"red"},{"x":2,"y":6,"color":"yellow"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"blue"},{"x":1,"y":7,"color":"green"},{"x":2,"y":7,"color":"blue"},{"x":3,"y":7,"color":"yellow"},{"x":4,"y":7,"color":"red"},{"x":3,"y":8,"color":"yellow"},{"x":4,"y":8,"color":"red"}]},
            12,
            ['green', 'blue'],
            2,
            ['red', 'blue', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"blue"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"blue"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"yellow"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"blue"},{"x":3,"y":2,"color":"red"},{"x":4,"y":2,"color":"blue"},{"x":5,"y":2,"color":"red"},{"x":0,"y":3,"color":"red"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"red"},{"x":5,"y":3,"color":"green"},{"x":0,"y":4,"color":"red"},{"x":1,"y":4,"color":"red"},{"x":2,"y":4,"color":"blue"},{"x":3,"y":4,"color":"green"},{"x":4,"y":4,"color":"green"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"yellow"},{"x":1,"y":5,"color":"blue"},{"x":2,"y":5,"color":"blue"},{"x":3,"y":5,"color":"yellow"},{"x":4,"y":5,"color":"green"},{"x":5,"y":5,"color":"red"},{"x":0,"y":6,"color":"red"},{"x":1,"y":6,"color":"red"},{"x":2,"y":6,"color":"yellow"},{"x":3,"y":6,"color":"red"},{"x":1,"y":7,"color":"green"},{"x":2,"y":7,"color":"blue"},{"x":3,"y":7,"color":"yellow"},{"x":3,"y":8,"color":"yellow"}]},
            11,
            ['red', 'red'],
            1,
            ['red', 'blue', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"blue"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"blue"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"yellow"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"blue"},{"x":3,"y":2,"color":"red"},{"x":4,"y":2,"color":"blue"},{"x":5,"y":2,"color":"red"},{"x":0,"y":3,"color":"red"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"red"},{"x":5,"y":3,"color":"green"},{"x":0,"y":4,"color":"red"},{"x":1,"y":4,"color":"red"},{"x":2,"y":4,"color":"blue"},{"x":3,"y":4,"color":"green"},{"x":4,"y":4,"color":"green"},{"x":0,"y":5,"color":"yellow"},{"x":1,"y":5,"color":"blue"},{"x":2,"y":5,"color":"blue"},{"x":3,"y":5,"color":"yellow"},{"x":4,"y":5,"color":"green"},{"x":0,"y":6,"color":"red"},{"x":1,"y":6,"color":"red"},{"x":2,"y":6,"color":"yellow"},{"x":1,"y":7,"color":"green"},{"x":2,"y":7,"color":"blue"}]},
            10,
            ['yellow', 'yellow'],
            1,
            ['red', 'blue', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"blue"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"blue"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"yellow"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"blue"},{"x":3,"y":2,"color":"red"},{"x":4,"y":2,"color":"blue"},{"x":5,"y":2,"color":"red"},{"x":0,"y":3,"color":"red"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"red"},{"x":5,"y":3,"color":"green"},{"x":0,"y":4,"color":"red"},{"x":1,"y":4,"color":"red"},{"x":2,"y":4,"color":"blue"},{"x":3,"y":4,"color":"green"},{"x":4,"y":4,"color":"green"},{"x":0,"y":5,"color":"yellow"},{"x":1,"y":5,"color":"blue"},{"x":2,"y":5,"color":"blue"},{"x":3,"y":5,"color":"red"},{"x":4,"y":5,"color":"green"},{"x":0,"y":6,"color":"red"}]},
            9,
            ['red', 'blue'],
            1,
            ['red', 'blue', 'green', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"blue"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"blue"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"yellow"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"blue"},{"x":3,"y":2,"color":"red"},{"x":4,"y":2,"color":"blue"},{"x":5,"y":2,"color":"red"},{"x":0,"y":3,"color":"red"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"red"},{"x":5,"y":3,"color":"yellow"},{"x":0,"y":4,"color":"red"},{"x":1,"y":4,"color":"red"},{"x":3,"y":4,"color":"yellow"},{"x":4,"y":4,"color":"yellow"},{"x":0,"y":5,"color":"yellow"},{"x":3,"y":5,"color":"red"},{"x":4,"y":5,"color":"yellow"}]},
            8,
            ['red', 'red'],
            2,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"blue"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"blue"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"yellow"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"yellow"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"blue"},{"x":3,"y":2,"color":"red"},{"x":4,"y":2,"color":"blue"},{"x":5,"y":2,"color":"red"},{"x":0,"y":3,"color":"red"},{"x":1,"y":3,"color":"blue"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"red"},{"x":5,"y":3,"color":"yellow"},{"x":0,"y":4,"color":"red"},{"x":1,"y":4,"color":"red"},{"x":4,"y":4,"color":"yellow"},{"x":0,"y":5,"color":"yellow"}]},
            7,
            ['red', 'red'],
            2,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"blue"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"blue"},{"x":5,"y":0,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"blue"},{"x":3,"y":2,"color":"red"},{"x":4,"y":2,"color":"blue"},{"x":5,"y":2,"color":"red"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"red"},{"x":5,"y":3,"color":"yellow"},{"x":3,"y":4,"color":"yellow"},{"x":4,"y":4,"color":"yellow"},{"x":3,"y":5,"color":"red"},{"x":4,"y":5,"color":"yellow"}]},
            6,
            ['red', 'blue'],
            2,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"blue"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"blue"},{"x":5,"y":0,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":1,"y":2,"color":"red"},{"x":2,"y":2,"color":"blue"},{"x":3,"y":2,"color":"red"},{"x":4,"y":2,"color":"blue"},{"x":5,"y":2,"color":"red"},{"x":2,"y":3,"color":"red"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"red"},{"x":5,"y":3,"color":"yellow"},{"x":4,"y":4,"color":"yellow"}]},
            5,
            ['red', 'blue'],
            2,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"blue"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"blue"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"yellow"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"blue"},{"x":5,"y":1,"color":"red"},{"x":2,"y":2,"color":"blue"},{"x":3,"y":2,"color":"red"},{"x":4,"y":2,"color":"blue"},{"x":5,"y":2,"color":"red"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"red"}]},
            4,
            ['red', 'blue'],
            2,
            ['red', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"green"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"purple"},{"x":1,"y":2,"color":"green"},{"x":2,"y":2,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"purple"},{"x":1,"y":3,"color":"red"},{"x":2,"y":3,"color":"green"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"purple"},{"x":1,"y":4,"color":"green"},{"x":2,"y":4,"color":"red"},{"x":3,"y":4,"color":"green"},{"x":4,"y":4,"color":"purple"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"green"},{"x":1,"y":5,"color":"red"},{"x":2,"y":5,"color":"green"},{"x":3,"y":5,"color":"red"},{"x":4,"y":5,"color":"red"},{"x":5,"y":5,"color":"purple"},{"x":0,"y":6,"color":"purple"},{"x":1,"y":6,"color":"green"},{"x":2,"y":6,"color":"red"},{"x":3,"y":6,"color":"green"},{"x":5,"y":6,"color":"purple"},{"x":0,"y":7,"color":"green"},{"x":1,"y":7,"color":"green"},{"x":2,"y":7,"color":"red"},{"x":3,"y":7,"color":"green"},{"x":5,"y":7,"color":"purple"},{"x":2,"y":8,"color":"purple"}]},
            12,
            ['red', 'red'],
            2,
            ['red', 'green', 'purple']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"green"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"purple"},{"x":1,"y":2,"color":"green"},{"x":2,"y":2,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"purple"},{"x":1,"y":3,"color":"red"},{"x":2,"y":3,"color":"green"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"purple"},{"x":1,"y":4,"color":"green"},{"x":2,"y":4,"color":"red"},{"x":3,"y":4,"color":"green"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"green"},{"x":1,"y":5,"color":"red"},{"x":2,"y":5,"color":"green"},{"x":3,"y":5,"color":"green"},{"x":5,"y":5,"color":"purple"},{"x":0,"y":6,"color":"purple"},{"x":1,"y":6,"color":"green"},{"x":2,"y":6,"color":"red"},{"x":5,"y":6,"color":"purple"},{"x":0,"y":7,"color":"green"},{"x":1,"y":7,"color":"green"},{"x":2,"y":7,"color":"red"},{"x":5,"y":7,"color":"purple"},{"x":2,"y":8,"color":"purple"}]},
            11,
            ['green', 'purple'],
            4,
            ['red', 'green', 'purple']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"green"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"purple"},{"x":1,"y":2,"color":"green"},{"x":2,"y":2,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"purple"},{"x":1,"y":3,"color":"red"},{"x":2,"y":3,"color":"green"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"purple"},{"x":1,"y":4,"color":"green"},{"x":2,"y":4,"color":"red"},{"x":3,"y":4,"color":"green"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"green"},{"x":1,"y":5,"color":"red"},{"x":2,"y":5,"color":"green"},{"x":3,"y":5,"color":"green"},{"x":5,"y":5,"color":"purple"},{"x":0,"y":6,"color":"purple"},{"x":1,"y":6,"color":"green"},{"x":2,"y":6,"color":"red"},{"x":5,"y":6,"color":"purple"},{"x":0,"y":7,"color":"green"},{"x":1,"y":7,"color":"green"}]},
            10,
            ['green', 'red'],
            3,
            ['red', 'green', 'purple']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"green"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"purple"},{"x":1,"y":2,"color":"green"},{"x":2,"y":2,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"purple"},{"x":1,"y":3,"color":"red"},{"x":2,"y":3,"color":"green"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"purple"},{"x":1,"y":4,"color":"green"},{"x":2,"y":4,"color":"red"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"green"},{"x":1,"y":5,"color":"red"},{"x":5,"y":5,"color":"purple"},{"x":0,"y":6,"color":"purple"},{"x":1,"y":6,"color":"green"},{"x":5,"y":6,"color":"purple"},{"x":0,"y":7,"color":"green"},{"x":1,"y":7,"color":"green"}]},
            9,
            ['red', 'red'],
            1,
            ['red', 'green', 'purple']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"green"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"purple"},{"x":1,"y":2,"color":"green"},{"x":2,"y":2,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"purple"},{"x":1,"y":3,"color":"red"},{"x":2,"y":3,"color":"green"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"purple"},{"x":1,"y":4,"color":"green"},{"x":5,"y":4,"color":"red"},{"x":0,"y":5,"color":"green"},{"x":5,"y":5,"color":"purple"},{"x":0,"y":6,"color":"purple"},{"x":5,"y":6,"color":"purple"},{"x":0,"y":7,"color":"green"}]},
            8,
            ['green', 'green'],
            1,
            ['red', 'green', 'purple']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"green"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"purple"},{"x":1,"y":2,"color":"green"},{"x":2,"y":2,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":0,"y":3,"color":"purple"},{"x":1,"y":3,"color":"red"},{"x":2,"y":3,"color":"green"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":0,"y":4,"color":"purple"},{"x":5,"y":4,"color":"red"},{"x":5,"y":5,"color":"purple"},{"x":5,"y":6,"color":"purple"}]},
            7,
            ['green', 'purple'],
            2,
            ['red', 'green', 'purple']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"green"},{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"green"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"green"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":1,"y":2,"color":"green"},{"x":2,"y":2,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":2,"y":3,"color":"green"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":5,"y":4,"color":"red"},{"x":5,"y":5,"color":"purple"},{"x":5,"y":6,"color":"purple"}]},
            6,
            ['green', 'red'],
            2,
            ['red', 'green', 'purple']
        ),
        new FeverStageState(
            {"puyos":[{"x":1,"y":0,"color":"red"},{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":2,"y":1,"color":"green"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":2,"y":2,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":5,"y":4,"color":"red"},{"x":5,"y":5,"color":"purple"},{"x":5,"y":6,"color":"purple"}]},
            5,
            ['green', 'red'],
            2,
            ['red', 'green', 'purple']
        ),
        new FeverStageState(
            {"puyos":[{"x":2,"y":0,"color":"green"},{"x":3,"y":0,"color":"red"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"green"},{"x":3,"y":3,"color":"red"},{"x":4,"y":3,"color":"green"},{"x":5,"y":3,"color":"red"},{"x":5,"y":4,"color":"red"},{"x":5,"y":5,"color":"purple"},{"x":5,"y":6,"color":"purple"}]},
            4,
            ['green', 'green'],
            1,
            ['red', 'green', 'purple']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"red"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"yellow"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"red"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"red"},{"x":1,"y":2,"color":"blue"},{"x":2,"y":2,"color":"yellow"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"yellow"},{"x":1,"y":3,"color":"red"},{"x":2,"y":3,"color":"yellow"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"yellow"},{"x":2,"y":4,"color":"yellow"},{"x":3,"y":4,"color":"blue"},{"x":4,"y":4,"color":"yellow"},{"x":5,"y":4,"color":"green"},{"x":2,"y":5,"color":"blue"},{"x":3,"y":5,"color":"green"},{"x":4,"y":5,"color":"blue"},{"x":5,"y":5,"color":"green"},{"x":2,"y":6,"color":"green"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"red"},{"x":5,"y":6,"color":"green"},{"x":3,"y":7,"color":"red"},{"x":4,"y":7,"color":"blue"},{"x":5,"y":7,"color":"yellow"},{"x":3,"y":8,"color":"blue"},{"x":4,"y":8,"color":"yellow"},{"x":5,"y":8,"color":"blue"},{"x":3,"y":9,"color":"red"},{"x":4,"y":9,"color":"yellow"},{"x":5,"y":9,"color":"yellow"},{"x":3,"y":10,"color":"yellow"},{"x":4,"y":10,"color":"blue"},{"x":4,"y":11,"color":"green"}]},
            12,
            ['yellow', 'yellow'],
            5,
            ['red', 'green', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"red"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"yellow"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"red"},{"x":1,"y":1,"color":"blue"},{"x":2,"y":1,"color":"blue"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"red"},{"x":1,"y":2,"color":"blue"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"yellow"},{"x":0,"y":3,"color":"yellow"},{"x":1,"y":3,"color":"green"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"yellow"},{"x":3,"y":4,"color":"blue"},{"x":4,"y":4,"color":"yellow"},{"x":5,"y":4,"color":"green"},{"x":3,"y":5,"color":"green"},{"x":4,"y":5,"color":"blue"},{"x":5,"y":5,"color":"green"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"red"},{"x":5,"y":6,"color":"green"},{"x":3,"y":7,"color":"red"},{"x":4,"y":7,"color":"blue"},{"x":5,"y":7,"color":"yellow"},{"x":3,"y":8,"color":"blue"},{"x":4,"y":8,"color":"yellow"},{"x":5,"y":8,"color":"blue"},{"x":3,"y":9,"color":"red"},{"x":4,"y":9,"color":"yellow"},{"x":5,"y":9,"color":"yellow"},{"x":3,"y":10,"color":"yellow"},{"x":4,"y":10,"color":"blue"},{"x":4,"y":11,"color":"green"}]},
            11,
            ['red', 'blue'],
            4,
            ['red', 'green', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":0,"y":0,"color":"red"},{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"yellow"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":0,"y":1,"color":"red"},{"x":1,"y":1,"color":"green"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":0,"y":2,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"yellow"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"yellow"},{"x":3,"y":4,"color":"blue"},{"x":4,"y":4,"color":"yellow"},{"x":5,"y":4,"color":"green"},{"x":3,"y":5,"color":"green"},{"x":4,"y":5,"color":"blue"},{"x":5,"y":5,"color":"green"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"red"},{"x":5,"y":6,"color":"green"},{"x":3,"y":7,"color":"red"},{"x":4,"y":7,"color":"blue"},{"x":5,"y":7,"color":"yellow"},{"x":3,"y":8,"color":"blue"},{"x":4,"y":8,"color":"yellow"},{"x":5,"y":8,"color":"blue"},{"x":3,"y":9,"color":"red"},{"x":4,"y":9,"color":"yellow"},{"x":5,"y":9,"color":"yellow"},{"x":3,"y":10,"color":"yellow"},{"x":4,"y":10,"color":"blue"},{"x":4,"y":11,"color":"green"}]},
            10,
            ['red', 'yellow'],
            3,
            ['red', 'green', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"yellow"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"yellow"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"yellow"},{"x":3,"y":4,"color":"blue"},{"x":4,"y":4,"color":"yellow"},{"x":5,"y":4,"color":"green"},{"x":3,"y":5,"color":"green"},{"x":4,"y":5,"color":"blue"},{"x":5,"y":5,"color":"green"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"red"},{"x":5,"y":6,"color":"green"},{"x":3,"y":7,"color":"red"},{"x":4,"y":7,"color":"blue"},{"x":5,"y":7,"color":"yellow"},{"x":3,"y":8,"color":"blue"},{"x":4,"y":8,"color":"yellow"},{"x":5,"y":8,"color":"blue"},{"x":3,"y":9,"color":"red"},{"x":4,"y":9,"color":"yellow"},{"x":5,"y":9,"color":"yellow"},{"x":4,"y":10,"color":"blue"},{"x":4,"y":11,"color":"green"}]},
            9,
            ['yellow', 'yellow'],
            5,
            ['red', 'green', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"yellow"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"yellow"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"yellow"},{"x":3,"y":4,"color":"blue"},{"x":4,"y":4,"color":"yellow"},{"x":5,"y":4,"color":"green"},{"x":3,"y":5,"color":"green"},{"x":4,"y":5,"color":"blue"},{"x":5,"y":5,"color":"green"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"red"},{"x":5,"y":6,"color":"green"},{"x":3,"y":7,"color":"red"},{"x":4,"y":7,"color":"blue"},{"x":5,"y":7,"color":"blue"},{"x":3,"y":8,"color":"blue"},{"x":4,"y":8,"color":"green"},{"x":5,"y":8,"color":"blue"},{"x":5,"y":9,"color":"yellow"}]},
            8,
            ['yellow', 'red'],
            5,
            ['red', 'green', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"yellow"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"yellow"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"yellow"},{"x":3,"y":4,"color":"blue"},{"x":4,"y":4,"color":"yellow"},{"x":5,"y":4,"color":"green"},{"x":3,"y":5,"color":"green"},{"x":4,"y":5,"color":"red"},{"x":5,"y":5,"color":"green"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"blue"},{"x":5,"y":6,"color":"green"},{"x":3,"y":7,"color":"red"},{"x":4,"y":7,"color":"green"},{"x":5,"y":7,"color":"yellow"}]},
            7,
            ['yellow', 'red'],
            5,
            ['red', 'green', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"yellow"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":5,"y":2,"color":"garbage"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"blue"},{"x":5,"y":3,"color":"yellow"},{"x":3,"y":4,"color":"blue"},{"x":4,"y":4,"color":"yellow"},{"x":5,"y":4,"color":"yellow"},{"x":3,"y":5,"color":"green"},{"x":4,"y":5,"color":"red"},{"x":5,"y":5,"color":"red"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"blue"},{"x":5,"y":6,"color":"yellow"}]},
            6,
            ['yellow', 'red'],
            5,
            ['red', 'green', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"yellow"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"red"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"blue"},{"x":3,"y":4,"color":"blue"},{"x":4,"y":4,"color":"red"},{"x":3,"y":5,"color":"green"},{"x":4,"y":5,"color":"red"},{"x":3,"y":6,"color":"red"},{"x":4,"y":6,"color":"blue"}]},
            5,
            ['yellow', 'red'],
            5,
            ['red', 'green', 'blue', 'yellow']
        ),
        new FeverStageState(
            {"puyos":[{"x":1,"y":0,"color":"yellow"},{"x":2,"y":0,"color":"yellow"},{"x":3,"y":0,"color":"yellow"},{"x":4,"y":0,"color":"green"},{"x":5,"y":0,"color":"red"},{"x":1,"y":1,"color":"red"},{"x":3,"y":1,"color":"red"},{"x":4,"y":1,"color":"green"},{"x":5,"y":1,"color":"red"},{"x":3,"y":2,"color":"green"},{"x":4,"y":2,"color":"blue"},{"x":5,"y":2,"color":"blue"},{"x":3,"y":3,"color":"blue"},{"x":4,"y":3,"color":"red"},{"x":5,"y":3,"color":"blue"}]},
            4,
            ['yellow', 'green'],
            4,
            ['red', 'green', 'blue', 'yellow']
        )
    ];

    /**
     * * "피버 스테이지" 객체를 등록한다.
     * 
     * @param {FeverStageState} feverStateObject 
     */
    function registerFeverStage(feverStateObject) {
        if (!(feverStateObject instanceof FeverStageState)) {
            throw new TypeError('registerFeverStage requires a FeverStageState instance.');
        }
        addFeverStageState(feverStateObject);
    }

    // Enemy 계층은 파일 하단에 모아 확장 지점을 한곳에서 확인할 수 있게 한다.
    /**
     * 자동 플레이어의 이동 목표를 결정하는 확장 지점이다.
     */
    class Enemy {
        /** 이 적이 연쇄 시 재생되는 효과음들을 담은 사운드풀 @type {SoundPool} */
        soundPool = null;

        /** 일반적인 상황에서, 아래 방향키 이용 딜레이 비율 (목표 결정 후 빠른 하강까지 기다리는 시간 값에 곱셈이 되는 비율) (0~1) @type {number}  */
        normalFastDownDelayRate = 1;

        /** 위기 상황에서, 아래 방향키 이용 딜레이 비율 (목표 결정 후 빠른 하강까지 기다리는 시간 값에 곱셈이 되는 비율) (0~1) @type {number}  */
        dangerFastDownDelayRate = 1;

        constructor() {
            this.sortPriority = 1;
            this.hidden = false;
            this.notAvail = false;
            // 이 좌표에 뿌요가 있으면 AI는 일반 쌓기 대신 공격력 시뮬레이션을 우선한다.
            this.attackSimulationTriggerPosition = { x: 2, y: 8 };
            this.soundPool = createSoundPool(false);
        }

        /** 이 클래스 이름 반환, 하위 클래스는 반드시 이 메소드를 오버라이드해야 함. @type {string}  */
        getClassType() {
            return 'Enemy';
        }

        /**
         * 적의 화면 표시 이름을 반환한다.
         * @returns {string} 적 이름
         */
        getName() {
            return '';
        }

        /**
         * 위치와 회전별 가상 착지 결과를 계산하여 AI가 사용할 후보 목록을 준비한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {void}
         */
        prepareTurn(player) {
            prepareAiPlacementSimulations(player);
        }

        /**
         * 현재는 회전 없이 가장 오른쪽 열에 배치한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {number} 목표 X 좌표
         */
        chooseTarget(player) {
            return COLUMNS - 1;
        }

        /**
         * 현재는 세로 상태를 유지한다. 하위 클래스에서 목표 회전값을 반환해 재정의할 수 있다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {number} 목표 회전값 (0: 위, 1: 오른쪽, 2: 아래, 3: 왼쪽)
         */
        chooseRotate(player) {
            return 0;
        }

        /**
         * 목표 열과 회전을 정한 뒤 현재 AI 난이도에 따라 빠른 하강을 사용할지 결정한다.
         * 이 메서드는 조작 단계 동안 매 프레임 호출되므로, 대기 시간이 지나기 전에는 false를 반환한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {boolean} 빠른 하강 사용 여부
         */
        useFastDown(player) {
            const delay = getSelectedDifficulty().fastDownDelay;
            if (delay === null) return false;
            const opponent = game?.players.find((candidate) => candidate !== player);
            const delayRate = isEnemyInCrisis(player, opponent) ? this.dangerFastDownDelayRate : this.normalFastDownDelayRate;
            return player.aiDecisionElapsed >= delay * delayRate;
        }

        /**
         * AI가 현재 필드의 모든 뿌요 배치 현황을 읽는다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {{columns:number, rows:number, cells:(string|null)[][]}} 필드 크기와 아래 행부터의 뿌요 배치
         */
        getMyFieldInfo(player) {
            return {
                columns: COLUMNS,
                rows: ROWS,
                cells: player.board.map((row) => [...row])
            };
        }

        /** CPU 자신이 피버 상황인지 확인한다. @param {PlayerState} player 자동 조작할 플레이어 @returns {boolean} 피버 상황 여부 */
        isInFever(player) {
            return player.fever?.active === true;
        }

        /** CPU 자신의 피버 전용 필드 배치를 반환한다. 피버 중이 아니면 null이다. @param {PlayerState} player 자동 조작할 플레이어 @returns {{columns:number,rows:number,cells:(string|null)[][]}|null} 피버 필드 복사본 */
        getMyFeverFieldInfo(player) {
            if (!this.isInFever(player)) return null;
            return {
                columns: COLUMNS,
                rows: ROWS,
                cells: player.board.map((row) => [...row])
            };
        }

        /** CPU 자신의 피버 게이지·시간·피해·목표 연쇄 상태를 반환한다. @param {PlayerState} player 자동 조작할 플레이어 @returns {object|null} 피버 룰 상태 */
        getMyFeverStatus(player) {
            if (!player.fever) return null;
            return {
                active: player.fever.active,
                gauge: player.fever.gauge,
                nextTime: player.fever.nextTime,
                targetCombo: player.fever.targetCombo,
                leftTime: player.fever.leftTime,
                damage: player.fever.damage,
                turn: player.fever.turn
            };
        }

        /**
         * 적 선택 및 대전 화면에 표시할 적 초상화를 그린다.
         * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
         * @param {number} centerX 초상화 중심 X 좌표
         * @param {number} centerY 초상화 중심 Y 좌표
       * @param {number} scale 기본 크기 대비 배율
       * @param {'normal'|'crisis'|'defeated'} expression 표시할 표정
         * @returns {void}
         */
            drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
        }

        /**
         * 게임 화면의 베젤 테두리를 그린다. 기본 구현은 현행 테두리를 유지한다.
         * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
         * @param {{x:number, y:number, width:number, height:number, player:PlayerState}} area 베젤 영역 정보
         * @returns {void}
         */
        drawBezelBackground(drawingContext, area) {
            drawingContext.fillStyle = '#0c2433';
            drawingContext.fillRect(area.x, area.y, area.width, area.height);
        }

        /**
         * 각 사용자 필드의 뒷배경을 그린다. 기본 구현은 현행 배경을 유지한다.
         * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
         * @param {{x:number, y:number, width:number, height:number, player:PlayerState}} area 사용자 영역 정보
         * @returns {void}
         */
        drawPlayerBackground(drawingContext, area) {
            drawingContext.fillStyle = '#112f40';
            drawingContext.fillRect(area.x, area.y, area.width, area.height);
        }

        /**
         * 중앙 영역의 뒷배경을 그린다. 기본 구현은 현행 배경을 유지한다.
         * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
         * @param {{x:number, y:number, width:number, height:number}} area 중앙 영역 정보
         * @returns {void}
         */
        drawCenterBackground(drawingContext, area) {
            drawingContext.fillStyle = '#071621';
            drawingContext.fillRect(area.x, area.y, area.width, area.height);
        }
    }

    /** 기본 제공되는 적임을 의미하는 클래스 */
    class BundledEnemy extends Enemy {
        constructor() { super(); }

        /** 이 클래스 이름 반환, 하위 클래스는 반드시 이 메소드를 오버라이드해야 함. @type {string}  */
        getClassType() {
            return 'BundledEnemy';
        }
    }

    /**
     * 솔로몬은 매 조작 턴마다 현재 필드와 제공된 모든 NEXT를 OpenAI Responses API에 보내
     * 구조화된 최적 배치를 받아 조작하는 세션 전용 기본 적이다.
     */
    class Solomon extends BundledEnemy {
        constructor() {
            super();
            this.sortPriority = 0;
            this.hidden = true;
            /** API가 늦거나 실패했을 때 사용할 교체 가능한 대체 인공지능이다. @type {Enemy} */
            this.fallbackEnemy = new Belial();
            /** @type {'idle'|'pending'|'ready'|'fallback'|'cancelled'} */
            this.decisionState = 'idle';
            /** @type {AbortController|null} */
            this.requestController = null;
            /** @type {number|null} */
            this.requestTimeoutId = null;
            /** @type {PlayerState|null} */
            this.turnPlayer = null;
            /** @type {object|null} */
            this.turnActive = null;
            this.targetX = 2;
            this.targetRotation = 0;
            this.fastDownElapsed = 0;
        }

        getClassType() { return 'Solomon'; }
        getName() { return '솔로몬'; }

        /** 위험 높이에서는 API를 기다리지 않고 대체 인공지능을 사용할지 판별한다. @param {PlayerState} player CPU 플레이어 @returns {boolean} */
        shouldUseFallbackImmediately(player) {
            if (game?.feverRule) return Boolean(player.board[5]?.[2] || player.board[5]?.[3]);
            return Boolean(player.board[5]?.[2]);
        }

        /** 현재 턴을 벨리알과 같은 판단 결과로 전환한다. @param {PlayerState} player CPU 플레이어 @returns {void} */
        applyFallback(player) {
            if (!player.active) return;
            this.fallbackEnemy.prepareTurn(player);
            applyPreparedControllerDecision(player, this.fallbackEnemy, this.fallbackEnemy instanceof BundledEnemy);
            this.targetX = player.aiTarget;
            this.targetRotation = player.aiRotation;
            player.aiDecisionElapsed = 0;
            this.decisionState = 'fallback';
        }

        /** API 프롬프트에 넣을 현재 규칙·필드·제공 뿌요 정보를 만든다. @param {PlayerState} player CPU 플레이어 @returns {string} */
        buildPlacementPrompt(player) {
            const occupiedCells = [];
            player.board.forEach((row, y) => row.forEach((color, x) => {
                if (color) occupiedCells.push({ x, y, color });
            }));
            const feverRule = game?.feverRule === true;
            const dangerCells = feverRule ? [{ x: 2, y: 5 }, { x: 3, y: 5 }] : [{ x: 2, y: 5 }];
            return JSON.stringify({
                task: 'Choose one legal and strategically optimal landing for the current falling puyo pair.',
                rules: {
                    mode: feverRule ? 'FEVER rules' : 'standard rules',
                    field: `The field has ${COLUMNS} columns (x=0..${COLUMNS - 1}) and ${VISIBLE_ROWS} visible rows (y=0..${VISIBLE_ROWS - 1}); y=0 is the bottom and y increases upward.`,
                    pair: 'Two puyos fall as one pair. Four or more orthogonally connected puyos of the same color pop; gravity then applies and may create chains. Larger chains attack the opponent.',
                    garbage: 'Attack first offsets incoming DAMAGE. Remaining attack sends garbage puyos to the opponent; adjacent garbage disappears when colored puyos pop.',
                    defeat: feverRule ? 'After resolution, occupied defeat cells x=2,y=11 or x=3,y=11 lose the game.' : 'After resolution, an occupied defeat cell x=2,y=11 loses the game.',
                    fever: feverRule ? 'Offsets fill a seven-light gauge. A full gauge enters a timed FEVER field whose prepared pattern should be cleared at or above targetCombo; the normal field returns when FEVER ends.' : null,
                    rotations: { 0: 'second puyo above the rotation-axis puyo', 1: 'second puyo right', 2: 'second puyo below', 3: 'second puyo left' },
                    outputCoordinates: 'x is the final column of the first (rotation-axis) puyo. rotation is one of 0,1,2,3 as defined above.'
                },
                currentField: { columns: COLUMNS, rows: ROWS, visibleRows: VISIBLE_ROWS, occupiedCells },
                currentState: { incomingDamage: player.damage, fever: this.getMyFeverStatus(player) },
                suppliedPuyos: [
                    { order: 'current', colors: [...player.active.colors] },
                    ...player.nextPairs.map((colors, index) => ({ order: `next_${index + 1}`, colors: [...colors] }))
                ],
                fallbackSafetyCondition: {
                    dangerousCells: dangerCells,
                    instruction: 'Avoid placements that occupy or further endanger these cells. If any dangerous cell is already occupied, the local fallback AI is used instead of this request.'
                },
                responseSchema: SOLOMON_PLACEMENT_JSON_SCHEMA
            });
        }

        /** 실제 뿌요가 API 결과의 X까지 먼저 이동한 뒤 회전할 수 있는지 검사한다. @param {PlayerState} player CPU 플레이어 @param {{x:number,rotation:number}} result API 결과 @returns {boolean} */
        canUsePlacement(player, result) {
            if (!result || !Number.isInteger(result.x) || !Number.isInteger(result.rotation)
                || result.x < 0 || result.x >= COLUMNS || result.rotation < 0 || result.rotation > 3) return false;
            if (!player.aiSimulations.some((simulation) => simulation.x === result.x && simulation.rotation === result.rotation)) return false;
            let simulated = { ...player.active };
            while (simulated.x !== result.x) {
                const candidate = { ...simulated, x: simulated.x + (simulated.x < result.x ? 1 : -1) };
                if (!canPlace(player, candidate)) return false;
                simulated = candidate;
            }
            while (simulated.rotation !== result.rotation) {
                const rotationDelta = (result.rotation - simulated.rotation + 4) % 4;
                const direction = rotationDelta === 3 ? -1 : 1;
                const candidate = { ...simulated, rotation: (simulated.rotation + direction + 4) % 4 };
                if (canPlace(player, candidate)) {
                    simulated = candidate;
                    continue;
                }
                const horizontalKick = candidate.rotation === 1 ? -1 : candidate.rotation === 3 ? 1 : 0;
                const kicked = { ...candidate, x: candidate.x + horizontalKick };
                if (horizontalKick && canPlace(player, kicked)) {
                    simulated = kicked;
                    continue;
                }
                const flipped = { ...simulated, rotation: (simulated.rotation + direction * 2 + 4) % 4 };
                if (!canPlace(player, flipped)) return false;
                simulated = flipped;
            }
            return simulated.x === result.x;
        }

        /** 응답·파싱·배치 검증 오류를 알리고 게임을 멈춘 뒤 현재 턴을 대체 AI로 준비한다. @param {PlayerState} player CPU 플레이어 @param {unknown} error 오류 @returns {void} */
        handleRequestFailure(player, error) {
            if (!this.isCurrentTurn(player)) return;
            console.error('솔로몬 AI 배치 요청에 실패했습니다.', error);
            this.applyFallback(player);
            game.paused = true;
            pauseMenuFocus = 0;
            pauseBackgroundMusic();
            showMessage(translate('솔로몬 AI 응답 오류: 대체 인공지능으로 진행합니다.'), '#f5fbfc', 2000, '#7b2636');
        }

        /** 캡처한 뿌요가 아직 이 컨트롤러의 현재 조작 턴인지 확인한다. @param {PlayerState} player CPU 플레이어 @returns {boolean} */
        isCurrentTurn(player) {
            return Boolean(game?.running && player === this.turnPlayer && player.controller === this
                && player.phase === 'control' && player.active === this.turnActive);
        }

        /** 저장된 OpenAI 설정으로 이번 턴의 배치를 요청한다. @param {PlayerState} player CPU 플레이어 @returns {Promise<void>} */
        async requestPlacement(player) {
            const abortController = new AbortController();
            this.requestController = abortController;
            this.requestTimeoutId = setTimeout(() => {
                if (this.requestController !== abortController || !this.isCurrentTurn(player)) return;
                abortController.puyowCancelReason = 'timeout';
                this.applyFallback(player);
                abortController.abort();
            }, SOLOMON_API_TIMEOUT);
            try {
                const response = await window.fetch(convertURL(OPENAI_RESPONSES_API_URL), {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${store.settings.aiApiKey}`, 'Content-Type': 'application/json' },
                    signal: abortController.signal,
                    body: JSON.stringify({
                        model: store.settings.aiModel,
                        reasoning: { effort: 'low' },
                        input: [{ role: 'user', content: this.buildPlacementPrompt(player) }],
                        text: { format: { type: 'json_schema', name: 'solomon_puyo_placement', strict: true, schema: SOLOMON_PLACEMENT_JSON_SCHEMA } },
                        max_output_tokens: 128
                    })
                });
                if (!response.ok) throw new Error(`OpenAI Responses API HTTP ${response.status}`);
                const outputText = getResponsesOutputText(await response.json());
                if (!outputText) throw new Error('Responses API 응답에 output_text가 없습니다.');
                let result;
                try { result = JSON.parse(outputText); } catch (error) { throw new Error('솔로몬 배치 JSON을 파싱할 수 없습니다.', { cause: error }); }
                if (!this.isCurrentTurn(player)) return;
                if (!this.canUsePlacement(player, result)) throw new Error('응답받은 솔로몬 배치를 현재 뿌요에 사용할 수 없습니다.');
                this.targetX = result.x;
                this.targetRotation = result.rotation;
                player.aiTarget = result.x;
                player.aiRotation = result.rotation;
                player.aiDecisionElapsed = 0;
                this.fastDownElapsed = 0;
                this.decisionState = 'ready';
            } catch (error) {
                if (abortController.puyowCancelReason) return;
                this.handleRequestFailure(player, error);
            } finally {
                if (this.requestController === abortController) {
                    if (this.requestTimeoutId !== null) clearTimeout(this.requestTimeoutId);
                    this.requestTimeoutId = null;
                    this.requestController = null;
                }
            }
        }

        /** @param {PlayerState} player CPU 플레이어 @returns {void} */
        prepareTurn(player) {
            this.cancelPendingRequest(null, 'replaced');
            super.prepareTurn(player);
            this.turnPlayer = player;
            this.turnActive = player.active;
            this.targetX = player.active?.x ?? 2;
            this.targetRotation = player.active?.rotation ?? 0;
            this.fastDownElapsed = 0;
            if (this.shouldUseFallbackImmediately(player)) {
                this.applyFallback(player);
                return;
            }
            this.decisionState = 'pending';
            void this.requestPlacement(player);
        }

        chooseTarget() { return this.targetX; }
        chooseRotate() { return this.targetRotation; }

        /** API 성공 배치는 수평 이동을 모두 마친 다음 회전한다. 대체 AI는 기존 엔진 조작을 그대로 쓴다. @param {PlayerState} player CPU 플레이어 @param {number} delta 경과 시간 @returns {boolean} 엔진 기본 이동을 대체했는지 */
        updateControl(player, delta) {
            if (this.decisionState === 'fallback') return false;
            if (this.decisionState !== 'ready') return true;
            if (player.active.x !== player.aiTarget) {
                this.fastDownElapsed = 0;
                moveActive(player, player.active.x < player.aiTarget ? 1 : -1, 0);
                return true;
            }
            const rotationDelta = (player.aiRotation - player.active.rotation + 4) % 4;
            if (rotationDelta) {
                this.fastDownElapsed = 0;
                rotateActive(player, rotationDelta === 3 ? -1 : 1);
                return true;
            }
            this.fastDownElapsed += delta;
            return true;
        }

        /** @param {PlayerState} player CPU 플레이어 @returns {boolean} */
        useFastDown(player) {
            if (this.decisionState === 'fallback') return this.fallbackEnemy.useFastDown(player);
            if (this.decisionState !== 'ready') return false;
            const delay = getSelectedDifficulty().fastDownDelay;
            if (delay === null) return false;
            const opponent = game?.players.find((candidate) => candidate !== player);
            const delayRate = isEnemyInCrisis(player, opponent) ? this.dangerFastDownDelayRate : this.normalFastDownDelayRate;
            return this.fastDownElapsed >= delay * delayRate;
        }

        /** 착지 또는 턴 교체 시 남아 있는 Responses API 요청을 취소한다. @param {PlayerState|null} player CPU 플레이어 @param {string} reason 취소 사유 @returns {void} */
        cancelPendingRequest(player, reason = 'cancelled') {
            if (!this.requestController || (player && player !== this.turnPlayer)) return;
            this.requestController.puyowCancelReason = reason;
            if (this.requestTimeoutId !== null) clearTimeout(this.requestTimeoutId);
            this.requestTimeoutId = null;
            this.requestController.abort();
            this.requestController = null;
            if (reason === 'contact') this.decisionState = 'cancelled';
        }

        /** 인간 왕의 왕관·망토를 바탕으로 솔로몬의 일반·위기·우는 표정을 그린다. */
        drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
            const size = 72 * scale;
            drawingContext.save();
            drawingContext.translate(centerX, centerY);
            drawingContext.lineJoin = 'round';
            drawingContext.fillStyle = '#38275f'; drawingContext.strokeStyle = '#201536'; drawingContext.lineWidth = 4 * scale;
            drawingContext.beginPath(); drawingContext.moveTo(-size * 0.62, size * 0.72); drawingContext.lineTo(-size * 0.47, -size * 0.05); drawingContext.lineTo(0, size * 0.13); drawingContext.lineTo(size * 0.47, -size * 0.05); drawingContext.lineTo(size * 0.62, size * 0.72); drawingContext.closePath(); drawingContext.fill(); drawingContext.stroke();
            drawingContext.fillStyle = '#e7b58f'; drawingContext.beginPath(); drawingContext.ellipse(0, -size * 0.07, size * 0.4, size * 0.49, 0, 0, Math.PI * 2); drawingContext.fill(); drawingContext.stroke();
            drawingContext.fillStyle = '#352334'; drawingContext.beginPath(); drawingContext.arc(0, -size * 0.2, size * 0.43, Math.PI, Math.PI * 2); drawingContext.fill();
            drawingContext.fillStyle = '#e9c95f'; drawingContext.beginPath(); drawingContext.moveTo(-size * 0.38, -size * 0.46); drawingContext.lineTo(-size * 0.3, -size * 0.9); drawingContext.lineTo(-size * 0.08, -size * 0.59); drawingContext.lineTo(0, -size * 0.96); drawingContext.lineTo(size * 0.12, -size * 0.59); drawingContext.lineTo(size * 0.36, -size * 0.88); drawingContext.lineTo(size * 0.38, -size * 0.46); drawingContext.closePath(); drawingContext.fill(); drawingContext.stroke();
            const eyeY = -size * 0.08;
            if (expression === 'defeated') {
                drawingContext.strokeStyle = '#38233d'; drawingContext.lineWidth = 3 * scale;
                [-size * 0.16, size * 0.16].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.moveTo(eyeX - size * 0.07, eyeY - size * 0.05); drawingContext.lineTo(eyeX + size * 0.07, eyeY + size * 0.05); drawingContext.moveTo(eyeX + size * 0.07, eyeY - size * 0.05); drawingContext.lineTo(eyeX - size * 0.07, eyeY + size * 0.05); drawingContext.stroke(); });
                drawingContext.fillStyle = '#78d5f4'; [-size * 0.16, size * 0.16].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.ellipse(eyeX, eyeY + size * 0.2, size * 0.055, size * 0.14, 0, 0, Math.PI * 2); drawingContext.fill(); });
                drawingContext.beginPath(); drawingContext.arc(0, size * 0.29, size * 0.11, Math.PI, Math.PI * 2); drawingContext.stroke();
            } else {
                drawingContext.fillStyle = expression === 'crisis' ? '#7b2636' : '#38233d';
                [-size * 0.16, size * 0.16].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.ellipse(eyeX, eyeY, size * 0.065, expression === 'crisis' ? size * 0.12 : size * 0.075, 0, 0, Math.PI * 2); drawingContext.fill(); });
                drawingContext.strokeStyle = '#7b2636'; drawingContext.lineWidth = 3 * scale; drawingContext.beginPath();
                if (expression === 'crisis') drawingContext.arc(0, size * 0.3, size * 0.11, Math.PI, Math.PI * 2); else drawingContext.arc(0, size * 0.15, size * 0.12, 0, Math.PI); drawingContext.stroke();
            }
            drawingContext.restore();
        }
    }

    /**
     * 안드로말리우스 적 정의
     */
    class Andromalius extends BundledEnemy {
        constructor() {
            super();
            this.attackPlacement = null;
            this.normalFastDownDelayRate = 3.0;
            this.dangerFastDownDelayRate = 1.0;
        }

        /** 이 클래스 이름 반환, 하위 클래스는 반드시 이 메소드를 오버라이드해야 함. @type {string}  */
        getClassType() {
            return 'Andromalius';
        }

        /**
         * @returns {string} 적 이름
         */
        getName() {
            return '안드로말리우스';
        }

        /**
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {number} 목표 X 좌표
         */
        chooseTarget(player) {
            const bottomRowsFilled = player.board[0].every((cell) => cell !== null) && player.board[1].every((cell) => cell !== null);
            const safeSimulations = player.aiSimulations.filter((simulation) => !causesImmediateDefeat(player, simulation));
            const simulations = safeSimulations.length ? safeSimulations : player.aiSimulations;
            if (!bottomRowsFilled) {
                // 하단 두 줄을 완성할 때까지는 터뜨리지 않는 후보 중 낮은 칸을 가장 많이 채운다.
                let selected = null;
                let bestScore = -Infinity;
                simulations.forEach((simulation) => {
                    if (simulation.combo !== 0) return;
                    // Y=2에 놓이는 후보는 폭발하지 않고 즉시 패배하지 않을 때만 허용한다.
                    if (simulation.positions.some((position) => position.y === 2) && causesImmediateDefeat(player, simulation)) return;
                    const fillScore = simulation.positions.reduce((score, position) => score + (position.y <= 1 ? 100 : 0) - position.y, 0);
                    if (fillScore >= bestScore) { selected = simulation; bestScore = fillScore; }
                });
                this.attackPlacement = selected || simulations.find((simulation) => simulation.combo === 0) || findBestAttackPlacement(player, player.active ? player.active.x : 2);
            } else {
                // 하단 두 줄이 완성된 뒤에는 매 턴 공격력 시뮬레이션 결과를 사용한다.
                this.attackPlacement = simulations.reduce((best, simulation) => {
                    if (!best || simulation.attack > best.attack || (simulation.attack === best.attack && simulation.x >= best.x)) return simulation;
                    return best;
                }, null) || findBestAttackPlacement(player, player.active ? player.active.x : 2);
            }
            return this.attackPlacement.x;
        }

        /** 공격력 시뮬레이션 단계에서는 최고 공격 후보가 요구하는 회전을 사용한다. @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 목표 회전값 */
        chooseRotate(player) {
            return this.attackPlacement ? this.attackPlacement.rotation : super.chooseRotate(player);
        }

        /**
         * 뱀을 두른 정의의 백작 안드로말리우스의 일반·위기·우는 표정을 그린다.
         * @param {CanvasRenderingContext2D} drawingContext 캔버스 2D 컨텍스트
         * @param {number} centerX 캐릭터 중심 X 좌표
         * @param {number} centerY 캐릭터 중심 Y 좌표
         * @param {number} scale 기본 크기 대비 배율
         * @returns {void}
         */
        drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
            const size = 72 * scale;
            drawingContext.save();
            drawingContext.translate(centerX, centerY);
            drawingContext.strokeStyle = '#164c50';
            drawingContext.fillStyle = '#237f79';
            drawingContext.lineWidth = 9 * scale;
            // 양쪽 집게를 대칭으로 그려 갑각형 실루엣을 만든다.
            for (const direction of [-1, 1]) {
                drawingContext.beginPath();
                drawingContext.moveTo(direction * size * 0.32, size * 0.1);
                drawingContext.quadraticCurveTo(direction * size * 0.9, size * 0.22, direction * size * 0.78, size * 0.68);
                drawingContext.stroke();
            }
            drawingContext.beginPath();
            drawingContext.ellipse(0, size * 0.18, size * 0.56, size * 0.63, 0, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.stroke();
            // 도둑을 찾아주는 정의의 백작답게 한 손의 작은 뱀과 별 배지를 더한다.
            drawingContext.strokeStyle = '#b7d65b'; drawingContext.lineWidth = 5 * scale;
            drawingContext.beginPath(); drawingContext.arc(size * 0.58, size * 0.22, size * 0.18, 0, Math.PI * 1.8); drawingContext.stroke();
            drawingContext.fillStyle = '#f3d46b'; drawingContext.beginPath(); drawingContext.arc(-size * 0.3, size * 0.35, size * 0.1, 0, Math.PI * 2); drawingContext.fill();
            drawingContext.fillStyle = '#9ad9b8';
            drawingContext.beginPath();
            drawingContext.arc(-size * 0.19, -size * 0.06, size * 0.16, 0, Math.PI * 2);
            drawingContext.arc(size * 0.19, -size * 0.06, size * 0.16, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.fillStyle = '#172535';
            drawingContext.beginPath();
            drawingContext.arc(-size * 0.17, -size * 0.04, size * 0.07, 0, Math.PI * 2);
            drawingContext.arc(size * 0.17, -size * 0.04, size * 0.07, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.fillStyle = '#d6a63a';
            drawingContext.beginPath();
            drawingContext.moveTo(0, size * 0.12);
            drawingContext.lineTo(-size * 0.12, size * 0.42);
            drawingContext.lineTo(size * 0.12, size * 0.42);
            drawingContext.closePath();
            drawingContext.fill();
            drawPortraitEmotion(drawingContext, size, expression, -size * 0.06, size * 0.19);
            drawingContext.restore();
        }
    }

    /**
     * 단탈리온 적 정의
     */
    class Dantalion extends BundledEnemy {
        /** 이 클래스 이름 반환, 하위 클래스는 반드시 이 메소드를 오버라이드해야 함. @type {string}  */
        getClassType() {
            return 'Dantalion';
        }

        /**
         * @returns {string} 적 이름
         */
        getName() {
            return '단탈리온';
        }

        constructor() {
            super();
            this.sortPriority = 2;
            this.phase = 'initialLeft';
            this.turnsRemaining = this.randomTurns();
            this.attackPlacement = null;
            this.normalFastDownDelayRate = 2.5;
            this.dangerFastDownDelayRate = 0.9;
        }

        /**
         * 일반 배치 턴 수를 정한다.
         * @returns {number} 6부터 8 사이의 일반 배치 턴 수
         */
        randomTurns() {
            return 6 + Math.floor(randomFloat() * 3);
        }

        /** @param {PlayerState} player 자동 조작할 플레이어 @param {number} side 목표 측 X 좌표 @returns {boolean} 목표 측 하단 두 칸이 모두 채워졌는지 */
        isSideFilled(player, side) {
            return player.board[0][side] !== null && player.board[1][side] !== null;
        }

        /**
         * 목표 측 하단 두 칸을 채우되, 폭발 뒤 최종 보드에서 즉시 패배하는 후보를 피하는 배치를 고른다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @param {number} side 목표 측 X 좌표
         * @returns {object|null} 배치 후보
         */
        selectSideBuildPlacement(player, side) {
            let selected = null;
            let bestScore = -Infinity;
            player.aiSimulations.forEach((simulation) => {
                if (simulation.combo !== 0) return;
                if (causesImmediateDefeat(player, simulation)) return;
                const score = simulation.positions.reduce((total, position) => {
                    const targetRow = position.y <= 1 ? 1000 : 0;
                    return total + targetRow - Math.abs(position.x - side) * 50 - position.y;
                }, 0);
                if (score >= bestScore) { selected = simulation; bestScore = score; }
            });
            return selected;
        }

        /**
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {number} 목표 X 좌표
         */
        chooseTarget(player) {
            // 중앙이 높이 쌓였거나 시뮬레이션 단계면 최대 공격 위치를 선택한다.
            const trigger = this.attackSimulationTriggerPosition;
            const triggerOccupied = player.board[trigger.y][trigger.x] !== null;
            if (triggerOccupied || this.phase === 'simulation' || player.damage >= AI_ATTACK_SIMULATION_DAMAGE_THRESHOLD) {
                this.attackPlacement = findBestAttackPlacement(player, 0, triggerOccupied ? trigger.x : null, true);
                this.phase = 'repeatLeft';
                if (!triggerOccupied) this.turnsRemaining = 6;
                return this.attackPlacement.x;
            }

            const target = this.phase === 'initialRight' ? COLUMNS - 1 : 0;
            const buildPlacement = this.selectSideBuildPlacement(player, target);
            const safeFallback = player.aiSimulations.find((simulation) => !causesImmediateDefeat(player, simulation));
            const basicPlacement = buildPlacement || safeFallback;
            // 좌·우 끝의 하단 두 칸이 차기 전에는 회전을 포함한 비폭발 쌓기를 계속한다.
            if (!this.isSideFilled(player, target) && basicPlacement) {
                this.attackPlacement = basicPlacement;
                return basicPlacement.x;
            }
            this.attackPlacement = basicPlacement;
            this.turnsRemaining -= 1;
            if (this.turnsRemaining <= 0) {
                if (this.phase === 'initialLeft') {
                    this.phase = 'initialRight';
                    this.turnsRemaining = this.randomTurns();
                } else {
                    this.phase = 'simulation';
                }
            }
            return basicPlacement ? basicPlacement.x : target;
        }

        /** 공격력 시뮬레이션 단계에서는 최고 공격 후보가 요구하는 회전을 사용한다. @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 목표 회전값 */
        chooseRotate(player) {
            return this.attackPlacement ? this.attackPlacement.rotation : super.chooseRotate(player);
        }

        /**
         * 여러 얼굴과 비밀의 책을 가진 단탈리온의 일반·위기·우는 표정을 그린다.
         * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
         * @param {number} centerX 캐릭터 중심 X 좌표
         * @param {number} centerY 캐릭터 중심 Y 좌표
         * @param {number} scale 기본 크기 대비 배율
         * @returns {void}
         */
        drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
            const size = 72 * scale;
            drawingContext.save();
            drawingContext.translate(centerX, centerY);
            drawingContext.lineCap = 'round';
            drawingContext.strokeStyle = '#3d204d';
            drawingContext.lineWidth = 14 * scale;
            drawingContext.beginPath();
            drawingContext.moveTo(-size * 0.33, size * 0.34);
            drawingContext.lineTo(-size * 0.5, size * 0.82);
            drawingContext.moveTo(size * 0.33, size * 0.34);
            drawingContext.lineTo(size * 0.5, size * 0.82);
            drawingContext.stroke();
            drawingContext.fillStyle = '#563068';
            drawingContext.beginPath();
            drawingContext.moveTo(-size * 0.52, size * 0.34);
            drawingContext.lineTo(-size * 0.92, size * 0.04);
            drawingContext.moveTo(size * 0.52, size * 0.34);
            drawingContext.lineTo(size * 0.92, size * 0.04);
            drawingContext.lineWidth = 15 * scale;
            drawingContext.stroke();
            drawingContext.beginPath();
            drawingContext.moveTo(-size * 0.5, size * 0.28);
            drawingContext.quadraticCurveTo(0, -size * 0.02, size * 0.5, size * 0.28);
            drawingContext.lineTo(size * 0.35, size * 0.72);
            drawingContext.quadraticCurveTo(0, size * 0.88, -size * 0.35, size * 0.72);
            drawingContext.closePath();
            drawingContext.fillStyle = '#6e3f8b';
            drawingContext.fill();
            drawingContext.strokeStyle = '#bd87e8';
            drawingContext.lineWidth = 3 * scale;
            drawingContext.stroke();
            drawingContext.fillStyle = '#303752';
            drawingContext.beginPath();
            drawingContext.arc(0, -size * 0.28, size * 0.43, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.strokeStyle = '#bd87e8';
            drawingContext.lineWidth = 3 * scale;
            drawingContext.stroke();
            // '서로 다름'의 공작: 옆에 겹친 작은 얼굴들과 미래를 적은 책을 보인다.
            drawingContext.fillStyle = '#48506d'; [-size * 0.48, size * 0.48].forEach((faceX) => { drawingContext.beginPath(); drawingContext.arc(faceX, -size * 0.21, size * 0.16, 0, Math.PI * 2); drawingContext.fill(); });
            drawingContext.fillStyle = '#d8a968'; drawingContext.fillRect(-size * 0.34, size * 0.36, size * 0.68, size * 0.2); drawingContext.strokeStyle = '#563068'; drawingContext.strokeRect(-size * 0.34, size * 0.36, size * 0.68, size * 0.2);
            drawingContext.fillStyle = '#ef5350';
            drawingContext.beginPath();
            drawingContext.moveTo(-size * 0.27, -size * 0.6);
            drawingContext.lineTo(-size * 0.08, -size * 0.93);
            drawingContext.lineTo(size * 0.03, -size * 0.55);
            drawingContext.closePath();
            drawingContext.moveTo(size * 0.27, -size * 0.6);
            drawingContext.lineTo(size * 0.08, -size * 0.93);
            drawingContext.lineTo(-size * 0.03, -size * 0.55);
            drawingContext.closePath();
            drawingContext.fill();
            drawingContext.fillStyle = '#f5fbfc';
            drawingContext.beginPath();
            drawingContext.arc(-size * 0.16, -size * 0.31, size * 0.12, 0, Math.PI * 2);
            drawingContext.arc(size * 0.16, -size * 0.31, size * 0.12, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.fillStyle = '#ef5350';
            drawingContext.beginPath();
            drawingContext.arc(-size * 0.13, -size * 0.29, size * 0.055, 0, Math.PI * 2);
            drawingContext.arc(size * 0.13, -size * 0.29, size * 0.055, 0, Math.PI * 2);
            drawingContext.fill();
            drawPortraitEmotion(drawingContext, size, expression, -size * 0.31, size * 0.16);
            drawingContext.restore();
        }
    }

    /**
     * 적 초상화 위에 위기 또는 패배 표정을 겹쳐 그린다.
     * @param {CanvasRenderingContext2D} drawingContext 캔버스 2D 컨텍스트
     * @param {number} size 초상화 기준 크기
     * @param {'normal'|'crisis'|'defeated'} expression 표시할 표정
     * @param {number} eyeY 눈 중심 Y 좌표
     * @param {number} eyeSpacing 눈 중심의 X축 거리
     * @returns {void}
     */
    function drawPortraitEmotion(drawingContext, size, expression, eyeY, eyeSpacing) {
        if (expression === 'crisis') {
            drawingContext.strokeStyle = '#172535';
            drawingContext.lineWidth = Math.max(2, size * 0.045);
            drawingContext.beginPath();
            drawingContext.moveTo(-eyeSpacing * 1.65, eyeY - size * 0.19);
            drawingContext.lineTo(-eyeSpacing * 0.35, eyeY - size * 0.13);
            drawingContext.moveTo(eyeSpacing * 1.65, eyeY - size * 0.19);
            drawingContext.lineTo(eyeSpacing * 0.35, eyeY - size * 0.13);
            drawingContext.stroke();
            drawingContext.fillStyle = '#8dd8ef';
            drawingContext.beginPath();
            drawingContext.ellipse(eyeSpacing * 1.85, eyeY + size * 0.18, size * 0.075, size * 0.12, 0.25, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.strokeStyle = '#d9f8ff';
            drawingContext.lineWidth = Math.max(1, size * 0.018);
            drawingContext.stroke();
        } else if (expression === 'defeated') {
            drawingContext.fillStyle = '#75c9f0';
            [-eyeSpacing, eyeSpacing].forEach((eyeX) => {
                drawingContext.beginPath();
                drawingContext.ellipse(eyeX, eyeY + size * 0.2, size * 0.09, size * 0.2, 0, 0, Math.PI * 2);
                drawingContext.fill();
            });
            drawingContext.strokeStyle = '#e7f8fa';
            drawingContext.lineWidth = Math.max(1, size * 0.018);
            drawingContext.beginPath();
            drawingContext.moveTo(-eyeSpacing, eyeY + size * 0.04);
            drawingContext.lineTo(-eyeSpacing, eyeY + size * 0.3);
            drawingContext.moveTo(eyeSpacing, eyeY + size * 0.04);
            drawingContext.lineTo(eyeSpacing, eyeY + size * 0.3);
            drawingContext.stroke();
        }
    }

    /**
     * 연쇄 축적형 적들이 공유하는 필드 평가와 안전 배치 전략이다.
     */
    class ChainBuildingEnemy extends BundledEnemy {
        constructor() {
            super();
            this.sortPriority = 3;
            this.notAvail = false;
            this.attackPlacement = null;
        }

        /** 이 클래스 이름 반환, 하위 클래스는 반드시 이 메소드를 오버라이드해야 함. @type {string}  */
        getClassType() {
            return 'ChainBuildingEnemy';
        }

        /** 이번 턴에서 사용할 공격 후보를 초기화한다. @param {PlayerState} player 자동 조작할 플레이어 @returns {void} */
        prepareTurn(player) {
            super.prepareTurn(player);
            this.attackPlacement = null;
        }

        /**
         * 현재 보드의 보이는 영역 점유율을 반환한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {number} 0~1 사이 점유율
         */
        getFieldOccupancy(player) {
            let occupied = 0;
            for (let y = 0; y < VISIBLE_ROWS; y += 1) {
                for (let x = 0; x < COLUMNS; x += 1) if (player.board[y][x] !== null) occupied += 1;
            }
            return occupied / (COLUMNS * VISIBLE_ROWS);
        }

        /**
         * 현재 예고된 방해뿌요 수를 반환한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {number} 다음 정산에 받을 수 있는 방해뿌요 수
         */
        getIncomingGarbage(player) {
            const opponent = game?.players.find((candidate) => candidate !== player);
            return player.damage + (opponent ? opponent.attack : 0);
        }

        /**
         * 즉시 패배하는 후보를 제외한다. 특히 착지 좌표에 Y=2가 포함될 때도 최종 폭발·중력 결과를 검사한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {object[]} 안전한 시뮬레이션 후보
         */
        getSafeSimulations(player) {
            return player.aiSimulations.filter((simulation) => {
                const placedAtThirdRow = simulation.positions.some((position) => position.y === 2);
                const losesImmediately = causesImmediateDefeat(player, simulation);
                if (placedAtThirdRow && losesImmediately) return false;
                return !losesImmediately;
            });
        }

        /**
         * 조건을 통과한 후보 중 점수가 가장 높은 것을 선택한다.
         * @param {object[]} simulations 시뮬레이션 후보
         * @param {(simulation:object)=>boolean} predicate 선택 조건
         * @param {(simulation:object)=>number} score 후보 점수 함수
         * @returns {object|null} 선택된 후보
         */
        selectSimulation(simulations, predicate, score) {
            let selected = null;
            let bestScore = -Infinity;
            simulations.forEach((simulation) => {
                if (!predicate(simulation)) return;
                const currentScore = score(simulation);
                if (currentScore >= bestScore) {
                    selected = simulation;
                    bestScore = currentScore;
                }
            });
            return selected;
        }

        /**
         * 터뜨리지 않고 연쇄 재료를 모으는 후보의 기반 점수를 계산한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @param {object} simulation 시뮬레이션 후보
         * @returns {number} 쌓기 점수
         */
        getBuildScore(player, simulation) {
            let score = 0;
            simulation.positions.forEach((position, index) => {
                const color = player.active.colors[index];
                DIRECTIONS.forEach(([deltaX, deltaY]) => {
                    const x = position.x + deltaX;
                    const y = position.y + deltaY;
                    if (x < 0 || x >= COLUMNS || y < 0 || y >= ROWS) return;
                    if (player.board[y][x] === color) score += 12;
                    else if (player.board[y][x] !== null) score += 1;
                });
                // 낮고 중앙에 가까운 기반을 우선해 여러 단계의 연쇄 재료를 모은다.
                score += Math.max(0, 8 - position.y) * 0.45;
                score -= Math.abs(position.x - (COLUMNS - 1) / 2) * 0.2;
            });
            return score;
        }

        /**
         * 아직 터뜨리지 않는 후보 중 다음 연쇄 재료를 가장 많이 만드는 배치를 선택한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @param {object[]} simulations 안전한 시뮬레이션 후보
         * @returns {object|null} 쌓기용 후보
         */
        selectBuildSimulation(player, simulations) {
            return this.selectSimulation(simulations, (simulation) => simulation.combo === 0, (simulation) => this.getBuildScore(player, simulation));
        }

        /**
         * 필드 상태에 맞는 공격 또는 쌓기 후보를 선택한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {number} 목표 X 좌표
         */
        chooseTarget(player) {
            const safeSimulations = this.getSafeSimulations(player);
            const simulations = safeSimulations.length ? safeSimulations : player.aiSimulations;
            const occupancy = this.getFieldOccupancy(player);
            const incomingGarbage = this.getIncomingGarbage(player);
            let selected = null;

            // 예고 방해뿌요가 12개 이상이면 연쇄가 작아도 가장 큰 즉시 공격을 우선한다.
            if (incomingGarbage >= 12) {
                selected = this.selectSimulation(simulations, () => true, (simulation) => simulation.attack);
            } else if (occupancy <= 0.3) {
                // 여유가 있으면 3~4연쇄가 가능한 때까지는 터뜨리지 않고 재료를 쌓는다.
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 3 && simulation.combo <= 4, (simulation) => simulation.attack);
                if (!selected) selected = this.selectBuildSimulation(player, simulations);
            } else if (occupancy >= 0.5) {
                // 필드가 절반 이상 차면 정확한 2연쇄를 우선하고, 없으면 2연쇄 이상 공격을 선택한다.
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo === 2, (simulation) => simulation.attack);
                if (!selected) selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 2, (simulation) => simulation.attack - Math.abs(simulation.combo - 2) * 10000);
            } else {
                // 중간 높이에서는 3~4연쇄 기회를 계속 찾되, 아직 없으면 터뜨리지 않고 쌓는다.
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 3 && simulation.combo <= 4, (simulation) => simulation.attack);
                if (!selected) selected = this.selectBuildSimulation(player, simulations);
            }

            this.attackPlacement = selected || findBestAttackPlacement(player, player.active ? player.active.x : 2);
            return this.attackPlacement.x;
        }

        /** 선택된 공격 또는 쌓기 후보의 회전값을 적용한다. @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 목표 회전값 */
        chooseRotate(player) {
            return this.attackPlacement ? this.attackPlacement.rotation : super.chooseRotate(player);
        }

        /**
         * 가면과 수정구를 가진 예지자 모습 및 표정별 얼굴을 그린다.
         * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
         * @param {number} centerX 캐릭터 중심 X 좌표
         * @param {number} centerY 캐릭터 중심 Y 좌표
         * @param {number} scale 기본 크기 대비 배율
         * @param {'normal'|'crisis'|'defeated'} expression 표시할 표정
         * @returns {void}
         */
        drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
            const size = 72 * scale;
            drawingContext.save();
            drawingContext.translate(centerX, centerY);
            drawingContext.lineJoin = 'round';

            drawingContext.fillStyle = '#1b3046';
            drawingContext.beginPath();
            drawingContext.moveTo(-size * 0.55, size * 0.78);
            drawingContext.quadraticCurveTo(0, size * 0.3, size * 0.55, size * 0.78);
            drawingContext.closePath();
            drawingContext.fill();
            drawingContext.strokeStyle = '#83d5df';
            drawingContext.lineWidth = 3 * scale;
            drawingContext.stroke();

            drawingContext.fillStyle = '#d7e8da';
            drawingContext.beginPath();
            drawingContext.ellipse(0, -size * 0.1, size * 0.48, size * 0.58, 0, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.strokeStyle = '#35556a';
            drawingContext.lineWidth = 4 * scale;
            drawingContext.stroke();

            drawingContext.fillStyle = '#77cfd5';
            drawingContext.beginPath();
            drawingContext.arc(0, size * 0.66, size * 0.23, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.strokeStyle = '#d7ffff';
            drawingContext.lineWidth = 2 * scale;
            drawingContext.stroke();
            drawingContext.fillStyle = 'rgba(255, 255, 255, 0.7)';
            drawingContext.beginPath();
            drawingContext.arc(-size * 0.075, size * 0.58, size * 0.055, 0, Math.PI * 2);
            drawingContext.fill();

            const eyeY = -size * 0.16;
            if (expression === 'defeated') {
                drawingContext.fillStyle = '#6cbce6';
                [-size * 0.19, size * 0.19].forEach((eyeX) => {
                    drawingContext.beginPath();
                    drawingContext.ellipse(eyeX, eyeY + size * 0.13, size * 0.1, size * 0.23, 0, 0, Math.PI * 2);
                    drawingContext.fill();
                });
                drawingContext.strokeStyle = '#35556a';
                drawingContext.lineWidth = 3 * scale;
                drawingContext.beginPath();
                drawingContext.arc(0, size * 0.25, size * 0.13, Math.PI, Math.PI * 2);
                drawingContext.stroke();
            } else if (expression === 'crisis') {
                drawingContext.fillStyle = '#203d56';
                [-size * 0.19, size * 0.19].forEach((eyeX) => {
                    drawingContext.beginPath();
                    drawingContext.arc(eyeX, eyeY, size * 0.08, 0, Math.PI * 2);
                    drawingContext.fill();
                });
                drawingContext.fillStyle = '#87dff1';
                drawingContext.beginPath();
                drawingContext.ellipse(size * 0.42, -size * 0.34, size * 0.07, size * 0.13, 0.2, 0, Math.PI * 2);
                drawingContext.fill();
                drawingContext.fillStyle = '#35556a';
                drawingContext.beginPath();
                drawingContext.ellipse(0, size * 0.25, size * 0.11, size * 0.14, 0, 0, Math.PI * 2);
                drawingContext.fill();
            } else {
                drawingContext.fillStyle = '#203d56';
                [-size * 0.19, size * 0.19].forEach((eyeX) => {
                    drawingContext.beginPath();
                    drawingContext.moveTo(eyeX, eyeY - size * 0.11);
                    drawingContext.lineTo(eyeX + size * 0.07, eyeY);
                    drawingContext.lineTo(eyeX, eyeY + size * 0.11);
                    drawingContext.lineTo(eyeX - size * 0.07, eyeY);
                    drawingContext.closePath();
                    drawingContext.fill();
                });
                drawingContext.strokeStyle = '#35556a';
                drawingContext.lineWidth = 3 * scale;
                drawingContext.beginPath();
                drawingContext.moveTo(-size * 0.13, size * 0.26);
                drawingContext.quadraticCurveTo(0, size * 0.34, size * 0.13, size * 0.26);
                drawingContext.stroke();
            }
            drawingContext.restore();
        }
    }

    /**
     * 적 세레의 정의.
     *     적 세레는 일정 횟수 동안 오른쪽에 쌓은 뒤 공격력 시뮬레이션을 수행한다.
     */
    class Seere extends BundledEnemy {
        constructor() {
            super();
            this.sortPriority = 3;
            this.turnCount = 0;
            this.turnsUntilSimulation = this.randomTurnsUntilSimulation();
            this.attackPlacement = null;
            this.normalFastDownDelayRate = 2.0;
            this.dangerFastDownDelayRate = 0.8;
        }

        /** 이 클래스 이름 반환, 하위 클래스는 반드시 이 메소드를 오버라이드해야 함. @type {string}  */
        getClassType() {
            return 'Seere';
        }

        /** @returns {string} 적 이름 */
        getName() {
            return '세레';
        }

        /** @returns {number} 다음 공격 시뮬레이션 전까지의 일반 배치 턴 수 */
        randomTurnsUntilSimulation() {
            return 10 + Math.floor(randomFloat() * 6);
        }

        /** @param {PlayerState} player 자동 조작할 플레이어 @returns {boolean} 우측 하단 세 칸이 모두 채워졌는지 */
        isRightThreeRowsFilled(player) {
            return [0, 1, 2].every((y) => player.board[y][COLUMNS - 1] !== null);
        }

        /**
         * 우측 하단 세 칸을 우선 채우되, 폭발 뒤 최종 보드에서 즉시 패배하는 후보를 제외한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {object|null} 배치 후보
         */
        selectRightBuildPlacement(player) {
            let selected = null;
            let bestScore = -Infinity;
            player.aiSimulations.forEach((simulation) => {
                if (simulation.combo !== 0) return;
                if (causesImmediateDefeat(player, simulation)) return;
                const score = simulation.positions.reduce((total, position) => {
                    const targetRow = position.x === COLUMNS - 1 && position.y <= 2 ? 1000 : 0;
                    return total + targetRow - Math.abs(position.x - (COLUMNS - 1)) * 50 - position.y;
                }, 0);
                if (score >= bestScore) { selected = simulation; bestScore = score; }
            });
            return selected;
        }

        /** @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 목표 X 좌표 */
        chooseTarget(player) {
            const trigger = this.attackSimulationTriggerPosition;
            const triggerOccupied = player.board[trigger.y][trigger.x] !== null;
            if (triggerOccupied || player.damage >= AI_ATTACK_SIMULATION_DAMAGE_THRESHOLD) {
                this.attackPlacement = findBestAttackPlacement(player, 0, triggerOccupied ? trigger.x : null, true);
                return this.attackPlacement.x;
            }
            const buildPlacement = this.selectRightBuildPlacement(player);
            const safeFallback = player.aiSimulations.find((simulation) => !causesImmediateDefeat(player, simulation));
            const basicPlacement = buildPlacement || safeFallback;
            // 우측 하단 세 칸이 차기 전에는 폭발을 만들지 않는 회전·배치만 사용한다.
            if (!this.isRightThreeRowsFilled(player) && basicPlacement) {
                this.attackPlacement = basicPlacement;
                return basicPlacement.x;
            }
            this.turnCount += 1;
            if (this.turnCount <= this.turnsUntilSimulation || !player.active) {
                this.attackPlacement = basicPlacement;
                return basicPlacement ? basicPlacement.x : COLUMNS - 1;
            }
            this.attackPlacement = findBestAttackPlacement(player, COLUMNS - 1, null, true);
            this.turnCount = 0;
            this.turnsUntilSimulation = this.randomTurnsUntilSimulation();
            return this.attackPlacement.x;
        }

        /** @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 목표 회전값 */
        chooseRotate(player) {
            return this.attackPlacement ? this.attackPlacement.rotation : super.chooseRotate(player);
        }

        /** 은빛 말과 그리폰 날개, 차가운 눈을 귀엽게 표현한 세레의 세 표정 */
        drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
            const size = 72 * scale;
            drawingContext.save();
            drawingContext.translate(centerX, centerY);
            drawingContext.lineJoin = 'round';
            drawingContext.fillStyle = '#1b3046';
            drawingContext.beginPath();
            drawingContext.moveTo(-size * 0.55, size * 0.78);
            drawingContext.quadraticCurveTo(0, size * 0.3, size * 0.55, size * 0.78);
            drawingContext.closePath(); drawingContext.fill();
            drawingContext.strokeStyle = '#83d5df'; drawingContext.lineWidth = 3 * scale; drawingContext.stroke();
            drawingContext.fillStyle = '#d7e8da'; drawingContext.beginPath(); drawingContext.ellipse(0, -size * 0.1, size * 0.48, size * 0.58, 0, 0, Math.PI * 2); drawingContext.fill();
            drawingContext.strokeStyle = '#35556a'; drawingContext.lineWidth = 4 * scale; drawingContext.stroke();
            drawingContext.fillStyle = '#ecd98b'; drawingContext.beginPath(); drawingContext.moveTo(-size * 0.37, -size * 0.37); drawingContext.quadraticCurveTo(0, -size * 0.75, size * 0.37, -size * 0.37); drawingContext.lineTo(0, -size * 0.48); drawingContext.closePath(); drawingContext.fill();
            drawingContext.fillStyle = '#c7d0dc'; [-1, 1].forEach((direction) => { drawingContext.beginPath(); drawingContext.moveTo(direction * size * 0.42, size * 0.15); drawingContext.lineTo(direction * size * 0.82, -size * 0.25); drawingContext.lineTo(direction * size * 0.58, size * 0.45); drawingContext.closePath(); drawingContext.fill(); drawingContext.stroke(); });
            drawingContext.fillStyle = '#77cfd5'; drawingContext.beginPath(); drawingContext.arc(0, size * 0.66, size * 0.23, 0, Math.PI * 2); drawingContext.fill();
            drawingContext.strokeStyle = '#d7ffff'; drawingContext.lineWidth = 2 * scale; drawingContext.stroke();
            const eyeY = -size * 0.16;
            if (expression === 'defeated') {
                drawingContext.fillStyle = '#6cbce6'; [-size * 0.19, size * 0.19].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.ellipse(eyeX, eyeY + size * 0.13, size * 0.1, size * 0.23, 0, 0, Math.PI * 2); drawingContext.fill(); });
            } else {
                drawingContext.fillStyle = '#203d56'; [-size * 0.19, size * 0.19].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.arc(eyeX, eyeY, size * 0.08, 0, Math.PI * 2); drawingContext.fill(); });
                if (expression === 'crisis') { drawingContext.fillStyle = '#87dff1'; drawingContext.beginPath(); drawingContext.ellipse(size * 0.42, -size * 0.34, size * 0.07, size * 0.13, 0.2, 0, Math.PI * 2); drawingContext.fill(); }
            }
            drawingContext.restore();
        }
    }

    /**
     * 적 데카라비아
     *     데카라비아는 세레의 기존 연쇄 축적 전략을 기반으로 수정하여 사용한다.
     */
    class Decarabia extends ChainBuildingEnemy {
        constructor() {
            super();
            this.sortPriority = 4;
            this.notAvail = false;
            this.normalFastDownDelayRate = 1.5;
            this.dangerFastDownDelayRate = 0.8;
        }

        /** 이 클래스 이름 반환, 하위 클래스는 반드시 이 메소드를 오버라이드해야 함. @type {string}  */
        getClassType() {
            return 'Decarabia';
        }

        /** @returns {string} 적 이름 */
        getName() {
            return '데카라비아';
        }

        /**
         * 현재 후보마다 중앙에 표시된 다음 두 쌍으로 만들 수 있는 최고 연쇄를 미리 계산한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {void}
         */
        prepareTurn(player) {
            super.prepareTurn(player);
            player.aiSimulations.forEach((simulation) => {
                const board = simulatePlacementBoard(player.board, player.active.colors, simulation.positions);
                simulation.allClear = board ? isAllClearBoard(board) : false;
                let preview = { combo: 0, attack: 0 };
                // 표시되는 두 예고쌍 각각을 현재 후보의 결과 보드에 가상으로 놓아 미래 연쇄 가능성을 반영한다.
                player.nextPairs.slice(0, 2).forEach((pair) => {
                    const result = board ? findBestPreviewResult(board, pair) : { combo: 0, attack: 0 };
                    if (result.combo > preview.combo || (result.combo === preview.combo && result.attack > preview.attack)) preview = result;
                });
                simulation.previewCombo = preview.combo;
                simulation.previewAttack = preview.attack;
            });
        }

        /**
         * 예고쌍으로 이어질 연쇄 가능성을 더해 비폭발 쌓기 후보를 선택한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @param {object[]} simulations 안전한 시뮬레이션 후보
         * @returns {object|null} 쌓기용 후보
         */
        selectBuildSimulation(player, simulations) {
            return this.selectSimulation(simulations, (simulation) => simulation.combo === 0, (simulation) => {
                return this.getBuildScore(player, simulation) + (simulation.previewCombo || 0) * 1000 + (simulation.previewAttack || 0);
            });
        }

        /**
         * 싹쓸이, 위험도, 필드 점유율에 맞춰 공격 또는 예고쌍을 고려한 쌓기 배치를 선택한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {number} 목표 X 좌표
         */
        chooseTarget(player) {
            const safeSimulations = this.getSafeSimulations(player);
            const simulations = safeSimulations.length ? safeSimulations : player.aiSimulations;
            const occupancy = this.getFieldOccupancy(player);
            const incomingGarbage = this.getIncomingGarbage(player);
            let selected = this.selectSimulation(simulations, (simulation) => simulation.allClear === true, (simulation) => simulation.attack + (simulation.previewAttack || 0));

            // 싹쓸이 기회가 없을 때에만 필드 높이에 맞춘 연쇄 목표를 적용한다.
            if (!selected && incomingGarbage >= 12) {
                selected = this.selectSimulation(simulations, () => true, (simulation) => simulation.attack + (simulation.previewCombo || 0));
            } else if (!selected && occupancy >= 0.8) {
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 1, (simulation) => simulation.attack + (simulation.previewCombo || 0));
            } else if (!selected && occupancy >= 0.5) {
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo === 2, (simulation) => simulation.attack + (simulation.previewCombo || 0));
                if (!selected) selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 2, (simulation) => simulation.attack - Math.abs(simulation.combo - 2) * 10000 + (simulation.previewCombo || 0));
            } else if (!selected && occupancy <= 0.3) {
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 4, (simulation) => simulation.attack + (simulation.previewCombo || 0));
                if (!selected) selected = this.selectBuildSimulation(player, simulations);
            } else if (!selected) {
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 4, (simulation) => simulation.attack + (simulation.previewCombo || 0));
                if (!selected) selected = this.selectBuildSimulation(player, simulations);
            }

            this.attackPlacement = selected || findBestAttackPlacement(player, player.active ? player.active.x : 2);
            return this.attackPlacement.x;
        }

        /**
         * 오망성과 작은 새 사역마를 가진 데카라비아의 일반·위기·우는 표정을 그린다.
         * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
         * @param {number} centerX 캐릭터 중심 X 좌표
         * @param {number} centerY 캐릭터 중심 Y 좌표
         * @param {number} scale 기본 크기 대비 배율
         * @param {'normal'|'crisis'|'defeated'} expression 표시할 표정
         * @returns {void}
         */
        drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
            const size = 72 * scale;
            drawingContext.save();
            drawingContext.translate(centerX, centerY);
            drawingContext.lineJoin = 'round';
            drawingContext.fillStyle = '#5c354e';
            drawingContext.strokeStyle = '#2b1a31';
            drawingContext.lineWidth = 4 * scale;
            [-1, 1].forEach((direction) => {
                drawingContext.beginPath();
                drawingContext.moveTo(direction * size * 0.3, -size * 0.05);
                drawingContext.lineTo(direction * size * 0.92, -size * 0.48);
                drawingContext.lineTo(direction * size * 0.7, size * 0.4);
                drawingContext.lineTo(direction * size * 0.27, size * 0.32);
                drawingContext.closePath();
                drawingContext.fill();
                drawingContext.stroke();
            });
            drawingContext.fillStyle = '#a55b80';
            drawingContext.beginPath();
            drawingContext.arc(0, 0, size * 0.52, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.stroke();
            drawingContext.fillStyle = '#ffd76b';
            drawingContext.beginPath();
            for (let index = 0; index < 10; index += 1) {
                const angle = -Math.PI / 2 + index * Math.PI / 5;
                const radius = index % 2 ? size * 0.15 : size * 0.31;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius - size * 0.58;
                if (index === 0) drawingContext.moveTo(x, y);
                else drawingContext.lineTo(x, y);
            }
            drawingContext.closePath();
            drawingContext.fill();
            drawingContext.stroke();
            drawingContext.fillStyle = '#b9d7f0'; drawingContext.beginPath(); drawingContext.arc(size * 0.72, -size * 0.42, size * 0.11, 0, Math.PI * 2); drawingContext.fill(); drawingContext.beginPath(); drawingContext.moveTo(size * 0.75, -size * 0.42); drawingContext.lineTo(size * 0.98, -size * 0.52); drawingContext.lineTo(size * 0.78, -size * 0.3); drawingContext.closePath(); drawingContext.fill();

            if (expression === 'defeated') {
                drawingContext.strokeStyle = '#f3edff';
                drawingContext.lineWidth = 3 * scale;
                [-size * 0.18, size * 0.18].forEach((eyeX) => {
                    drawingContext.beginPath();
                    drawingContext.moveTo(eyeX - size * 0.09, -size * 0.1);
                    drawingContext.lineTo(eyeX + size * 0.09, size * 0.1);
                    drawingContext.moveTo(eyeX + size * 0.09, -size * 0.1);
                    drawingContext.lineTo(eyeX - size * 0.09, size * 0.1);
                    drawingContext.stroke();
                });
                drawingContext.fillStyle = '#75c9f0';
                drawingContext.beginPath();
                drawingContext.ellipse(0, size * 0.27, size * 0.13, size * 0.08, 0, 0, Math.PI * 2);
                drawingContext.fill();
            } else {
                drawingContext.fillStyle = expression === 'crisis' ? '#fff5bb' : '#f7efff';
                [-size * 0.18, size * 0.18].forEach((eyeX) => {
                    drawingContext.beginPath();
                    drawingContext.ellipse(eyeX, -size * 0.1, size * 0.11, size * 0.14, 0, 0, Math.PI * 2);
                    drawingContext.fill();
                });
                drawingContext.fillStyle = expression === 'crisis' ? '#ef5350' : '#3c2347';
                [-size * 0.18, size * 0.18].forEach((eyeX) => {
                    drawingContext.beginPath();
                    drawingContext.arc(eyeX, -size * 0.08, size * 0.047, 0, Math.PI * 2);
                    drawingContext.fill();
                });
                drawingContext.strokeStyle = '#3c2347';
                drawingContext.lineWidth = 3 * scale;
                drawingContext.beginPath();
                if (expression === 'crisis') drawingContext.arc(0, size * 0.32, size * 0.12, Math.PI, Math.PI * 2);
                else drawingContext.arc(0, size * 0.16, size * 0.12, 0, Math.PI);
                drawingContext.stroke();
                if (expression === 'crisis') {
                    drawingContext.fillStyle = '#82d9f5';
                    drawingContext.beginPath();
                    drawingContext.ellipse(size * 0.42, size * 0.06, size * 0.06, size * 0.11, 0.2, 0, Math.PI * 2);
                    drawingContext.fill();
                }
            }
            drawingContext.restore();
        }
    }

    /**
     * 벨리알은 데카라비아가 사용하던 예고쌍 평가 및 싹쓸이 우선 전략을 사용한다.
     */
    class Belial extends ChainBuildingEnemy {
        constructor() {
            super();
            this.sortPriority = 5;
            this.notAvail = false;
            this.normalFastDownDelayRate = 1.25;
            this.dangerFastDownDelayRate = 0.75;
        }

        /** 이 클래스 이름 반환, 하위 클래스는 반드시 이 메소드를 오버라이드해야 함. @type {string}  */
        getClassType() {
            return 'Belial';
        }

        /** @returns {string} 적 이름 */
        getName() {
            return '벨리알';
        }

        /** @param {PlayerState} player 자동 조작할 플레이어 @returns {void} */
        prepareTurn(player) {
            super.prepareTurn(player);
            player.aiSimulations.forEach((simulation) => {
                const board = simulatePlacementBoard(player.board, player.active.colors, simulation.positions);
                simulation.allClear = board ? isAllClearBoard(board) : false;
                let preview = { combo: 0, attack: 0 };
                player.nextPairs.slice(0, 2).forEach((pair) => {
                    const result = board ? findBestPreviewResult(board, pair) : { combo: 0, attack: 0 };
                    if (result.combo > preview.combo || (result.combo === preview.combo && result.attack > preview.attack)) preview = result;
                });
                simulation.previewCombo = preview.combo;
                simulation.previewAttack = preview.attack;
            });
        }

        /** @param {PlayerState} player 자동 조작할 플레이어 @param {object[]} simulations 후보 목록 @returns {object|null} */
        selectBuildSimulation(player, simulations) {
            return this.selectSimulation(simulations, (simulation) => simulation.combo === 0, (simulation) => this.getBuildScore(player, simulation) + (simulation.previewCombo || 0) * 1000 + (simulation.previewAttack || 0));
        }

        /** @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 목표 X 좌표 */
        chooseTarget(player) {
            const safeSimulations = this.getSafeSimulations(player);
            const simulations = safeSimulations.length ? safeSimulations : player.aiSimulations;
            const occupancy = this.getFieldOccupancy(player);
            const incomingGarbage = this.getIncomingGarbage(player);
            let selected = this.selectSimulation(simulations, (simulation) => simulation.allClear === true, (simulation) => simulation.attack + (simulation.previewAttack || 0));
            if (!selected && incomingGarbage >= 12) {
                selected = this.selectSimulation(simulations, () => true, (simulation) => simulation.attack + (simulation.previewCombo || 0));
            } else if (!selected && occupancy >= 0.8) {
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 1, (simulation) => simulation.attack + (simulation.previewCombo || 0));
            } else if (!selected && occupancy >= 0.5) {
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo === 2, (simulation) => simulation.attack + (simulation.previewCombo || 0));
                if (!selected) selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 2, (simulation) => simulation.attack - Math.abs(simulation.combo - 2) * 10000 + (simulation.previewCombo || 0));
            } else if (!selected && occupancy <= 0.3) {
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 4, (simulation) => simulation.attack + (simulation.previewCombo || 0));
                if (!selected) selected = this.selectBuildSimulation(player, simulations);
            } else if (!selected) {
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 4, (simulation) => simulation.attack + (simulation.previewCombo || 0));
                if (!selected) selected = this.selectBuildSimulation(player, simulations);
            }
            this.attackPlacement = selected || findBestAttackPlacement(player, player.active ? player.active.x : 2);
            return this.attackPlacement.x;
        }

        /**
         * 깨진 천사 후광과 망토를 두른 벨리알의 일반·위기·우는 표정을 그린다.
         * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
         * @param {number} centerX 캐릭터 중심 X 좌표
         * @param {number} centerY 캐릭터 중심 Y 좌표
         * @param {number} scale 기본 크기 대비 배율
         * @param {'normal'|'crisis'|'defeated'} expression 표시할 표정
         * @returns {void}
         */
        drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
            const size = 72 * scale;
            drawingContext.save();
            drawingContext.translate(centerX, centerY);
            drawingContext.lineJoin = 'round';
            drawingContext.fillStyle = '#372446';
            drawingContext.strokeStyle = '#1d1629';
            drawingContext.lineWidth = 4 * scale;
            drawingContext.beginPath();
            drawingContext.moveTo(-size * 0.7, size * 0.8);
            drawingContext.lineTo(-size * 0.52, -size * 0.05);
            drawingContext.lineTo(0, size * 0.26);
            drawingContext.lineTo(size * 0.52, -size * 0.05);
            drawingContext.lineTo(size * 0.7, size * 0.8);
            drawingContext.closePath();
            drawingContext.fill();
            drawingContext.stroke();
            drawingContext.fillStyle = '#d79a73';
            drawingContext.beginPath();
            drawingContext.ellipse(0, -size * 0.08, size * 0.42, size * 0.52, 0, 0, Math.PI * 2);
            drawingContext.fill();
            drawingContext.stroke();
            drawingContext.fillStyle = '#e7b846';
            drawingContext.beginPath();
            drawingContext.moveTo(-size * 0.34, -size * 0.5);
            drawingContext.lineTo(-size * 0.24, -size * 0.91);
            drawingContext.lineTo(0, -size * 0.62);
            drawingContext.lineTo(size * 0.24, -size * 0.91);
            drawingContext.lineTo(size * 0.34, -size * 0.5);
            drawingContext.closePath();
            drawingContext.fill();
            drawingContext.stroke();
            drawingContext.strokeStyle = '#f0d88a'; drawingContext.lineWidth = 3 * scale; drawingContext.beginPath(); drawingContext.arc(0, -size * 0.78, size * 0.28, Math.PI * 0.12, Math.PI * 0.88); drawingContext.stroke();

            if (expression === 'defeated') {
                drawingContext.strokeStyle = '#413047';
                drawingContext.lineWidth = 3 * scale;
                [-size * 0.16, size * 0.16].forEach((eyeX) => {
                    drawingContext.beginPath();
                    drawingContext.moveTo(eyeX - size * 0.08, -size * 0.13);
                    drawingContext.lineTo(eyeX + size * 0.08, size * 0.03);
                    drawingContext.moveTo(eyeX + size * 0.08, -size * 0.13);
                    drawingContext.lineTo(eyeX - size * 0.08, size * 0.03);
                    drawingContext.stroke();
                });
                drawingContext.fillStyle = '#75c9f0';
                drawingContext.beginPath();
                drawingContext.ellipse(0, size * 0.3, size * 0.15, size * 0.09, 0, 0, Math.PI * 2);
                drawingContext.fill();
            } else {
                drawingContext.fillStyle = '#2a1a32';
                [-size * 0.16, size * 0.16].forEach((eyeX) => {
                    drawingContext.beginPath();
                    drawingContext.ellipse(eyeX, -size * 0.13, size * 0.07, expression === 'crisis' ? size * 0.12 : size * 0.07, 0, 0, Math.PI * 2);
                    drawingContext.fill();
                });
                drawingContext.strokeStyle = '#5a2438';
                drawingContext.lineWidth = 3 * scale;
                drawingContext.beginPath();
                if (expression === 'crisis') drawingContext.arc(0, size * 0.31, size * 0.12, Math.PI, Math.PI * 2);
                else drawingContext.arc(0, size * 0.15, size * 0.12, 0, Math.PI);
                drawingContext.stroke();
                if (expression === 'crisis') {
                    drawingContext.fillStyle = '#82d9f5';
                    drawingContext.beginPath();
                    drawingContext.ellipse(size * 0.42, size * 0.08, size * 0.06, size * 0.11, 0.2, 0, Math.PI * 2);
                    drawingContext.fill();
                }
            }
            drawingContext.restore();
        }
    }

    /**
     * 암두시아스는 유니콘 작곡가 콘셉트의 기본 제공 적이다. 벨리알의 예고쌍·싹쓸이 평가를
     * 이어받되 일반 필드에서 한 단계 높은 5연쇄 목표를 사용한다. 피버 필드에서는 공통 연쇄 최적화 전략을 따른다.
     */
    class Amdusias extends Belial {
        constructor() {
            super();
            this.sortPriority = 6;
            this.notAvail = false;
            this.normalFastDownDelayRate = 1.0;
            this.dangerFastDownDelayRate = 0.5;
        }

        /** 이 클래스 이름 반환, 하위 클래스는 반드시 이 메소드를 오버라이드해야 함. @type {string}  */
        getClassType() {
            return 'Amdusias';
        }

        /** @returns {string} 적 이름 */
        getName() {
            return '암두시아스';
        }

        /** @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 목표 X 좌표 */
        chooseTarget(player) {
            const safeSimulations = this.getSafeSimulations(player);
            const simulations = safeSimulations.length ? safeSimulations : player.aiSimulations;
            const occupancy = this.getFieldOccupancy(player);
            const score = (simulation) => simulation.attack + (simulation.previewAttack || 0) + (simulation.previewCombo || 0) * 1000;
            let selected = this.selectSimulation(simulations, (simulation) => simulation.allClear === true, score);
            // 피버 룰에서 피버가 아닐 때 DAMAGE가 있으면 생존 다음 우선순위로 공격력 시뮬레이션을 쓴다.
            if (!selected && game?.feverRule && player.damage > 0) {
                selected = this.selectSimulation(simulations, () => true, score);
            } else if (!selected && occupancy >= 0.8) {
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 1, score);
            } else if (!selected && occupancy >= 0.5) {
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo === 2, score);
                if (!selected) selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 2, (simulation) => score(simulation) - Math.abs(simulation.combo - 2) * 10000);
            } else if (!selected) {
                // 필드가 30% 이하이거나 중간 높이일 때는 5연쇄 기회까지 터뜨리지 않고 쌓는다.
                selected = this.selectSimulation(simulations, (simulation) => simulation.combo >= 5, score);
                if (!selected) selected = this.selectBuildSimulation(player, simulations);
            }
            this.attackPlacement = selected || findBestAttackPlacement(player, player.active ? player.active.x : 2, null, !this.isInFever(player));
            return this.attackPlacement.x;
        }

        /**
         * 암두시아스의 일반·위기·우는 표정을 그린다.
         * @param {CanvasRenderingContext2D} drawingContext 캔버스 렌더링 컨텍스트
         * @param {number} centerX 캐릭터 중심 X 좌표
         * @param {number} centerY 캐릭터 중심 Y 좌표
         * @param {number} scale 기본 크기 대비 배율
         * @param {'normal'|'crisis'|'defeated'} expression 표시할 표정
         * @returns {void}
         */
        drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
            const size = 72 * scale;
            drawingContext.save();
            drawingContext.translate(centerX, centerY);
            drawingContext.lineJoin = 'round';
            // 뿔과 음표 리본으로 유니콘 작곡가를 귀엽게 각색한다.
            drawingContext.fillStyle = '#405270'; drawingContext.strokeStyle = '#1a263b'; drawingContext.lineWidth = 4 * scale;
            drawingContext.beginPath();
            drawingContext.moveTo(-size * 0.56, size * 0.72); drawingContext.lineTo(-size * 0.78, -size * 0.12); drawingContext.lineTo(-size * 0.34, size * 0.06);
            drawingContext.lineTo(0, -size * 0.48); drawingContext.lineTo(size * 0.34, size * 0.06); drawingContext.lineTo(size * 0.78, -size * 0.12); drawingContext.lineTo(size * 0.56, size * 0.72);
            drawingContext.closePath(); drawingContext.fill(); drawingContext.stroke();
            drawingContext.fillStyle = '#c7d7ed'; drawingContext.beginPath(); drawingContext.ellipse(0, -size * 0.06, size * 0.43, size * 0.5, 0, 0, Math.PI * 2); drawingContext.fill(); drawingContext.stroke();
            drawingContext.fillStyle = '#f1d77a'; drawingContext.beginPath(); drawingContext.moveTo(0, -size * 0.52); drawingContext.lineTo(size * 0.12, -size * 0.98); drawingContext.lineTo(size * 0.24, -size * 0.46); drawingContext.closePath(); drawingContext.fill(); drawingContext.stroke();
            drawingContext.strokeStyle = '#f1d77a'; drawingContext.lineWidth = 3 * scale; drawingContext.beginPath(); drawingContext.arc(-size * 0.62, size * 0.23, size * 0.18, -Math.PI * 0.7, Math.PI * 0.35); drawingContext.stroke();
            drawingContext.fillStyle = '#f1d77a'; drawingContext.beginPath(); drawingContext.arc(-size * 0.51, size * 0.17, size * 0.05, 0, Math.PI * 2); drawingContext.fill();
            const eyeY = -size * 0.11;
            if (expression === 'defeated') {
                // 우는 표정
                drawingContext.fillStyle = '#577aa3'; [-size * 0.17, size * 0.17].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.ellipse(eyeX, eyeY, size * 0.08, size * 0.05, 0, 0, Math.PI * 2); drawingContext.fill(); });
                drawingContext.fillStyle = '#77d8f5'; [-size * 0.17, size * 0.17].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.ellipse(eyeX, eyeY + size * 0.2, size * 0.07, size * 0.15, 0, 0, Math.PI * 2); drawingContext.fill(); });
                drawingContext.strokeStyle = '#30415f'; drawingContext.beginPath(); drawingContext.arc(0, size * 0.28, size * 0.12, Math.PI, Math.PI * 2); drawingContext.stroke();
            } else {
                drawingContext.fillStyle = expression === 'crisis' ? '#ef5350' : '#293c5b';
                [-size * 0.17, size * 0.17].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.ellipse(eyeX, eyeY, size * 0.075, expression === 'crisis' ? size * 0.13 : size * 0.09, 0, 0, Math.PI * 2); drawingContext.fill(); });
                drawingContext.strokeStyle = '#30415f'; drawingContext.lineWidth = 3 * scale; drawingContext.beginPath();
                if (expression === 'crisis') drawingContext.arc(0, size * 0.28, size * 0.11, Math.PI, Math.PI * 2);
                else drawingContext.arc(0, size * 0.18, size * 0.12, 0, Math.PI);
                drawingContext.stroke();
            }
            drawingContext.restore();
        }
    }

    /**
     * 키마리스는 검은 말의 용감한 보물 탐험가를 귀엽게 각색한 출시 예정 적이다.
     * TODO: 전용 AI가 출시될 때까지는 자연 낙하만 유지한다.
     */
    class Kimaris extends BundledEnemy {
        constructor() {
            super();
            this.sortPriority = 7;
            this.notAvail = true;
        }

        getClassType() { return 'Kimaris'; }
        getName() { return '키마리스'; }

        /** TODO: 키마리스 전용 탐색·공격 AI를 구현한다. @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 현재 열 */
        chooseTarget(player) { return player.active ? player.active.x : 2; }
        /** @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 회전하지 않는 기본값 */
        chooseRotate() { return 0; }
        /** TODO: 키마리스 전용 빠른 하강 정책을 구현한다. @returns {boolean} */
        useFastDown() { return false; }

        /** 검은 말 갈기·보물 지도·용감한 표정의 일반·위기·우는 초상화를 그린다. */
        drawPortrait(drawingContext, centerX, centerY, scale = 1, expression = 'normal') {
            const size = 72 * scale;
            drawingContext.save(); drawingContext.translate(centerX, centerY); drawingContext.lineJoin = 'round';
            drawingContext.fillStyle = '#252332'; drawingContext.strokeStyle = '#10101b'; drawingContext.lineWidth = 4 * scale;
            drawingContext.beginPath(); drawingContext.ellipse(0, size * 0.18, size * 0.61, size * 0.57, 0, 0, Math.PI * 2); drawingContext.fill(); drawingContext.stroke();
            [-1, 1].forEach((direction) => { drawingContext.beginPath(); drawingContext.moveTo(direction * size * 0.28, -size * 0.2); drawingContext.lineTo(direction * size * 0.53, -size * 0.74); drawingContext.lineTo(direction * size * 0.05, -size * 0.45); drawingContext.closePath(); drawingContext.fill(); drawingContext.stroke(); });
            drawingContext.fillStyle = '#5b473d'; drawingContext.beginPath(); drawingContext.ellipse(0, -size * 0.04, size * 0.43, size * 0.46, 0, 0, Math.PI * 2); drawingContext.fill(); drawingContext.stroke();
            drawingContext.fillStyle = '#c89043'; drawingContext.fillRect(size * 0.23, size * 0.27, size * 0.29, size * 0.22); drawingContext.strokeRect(size * 0.23, size * 0.27, size * 0.29, size * 0.22);
            const eyeY = -size * 0.1;
            if (expression === 'defeated') {
                drawingContext.fillStyle = '#72cdeb'; [-size * 0.16, size * 0.16].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.ellipse(eyeX, eyeY + size * 0.16, size * 0.075, size * 0.19, 0, 0, Math.PI * 2); drawingContext.fill(); });
                drawingContext.strokeStyle = '#231c28'; drawingContext.beginPath(); drawingContext.arc(0, size * 0.26, size * 0.12, Math.PI, Math.PI * 2); drawingContext.stroke();
            } else {
                drawingContext.fillStyle = expression === 'crisis' ? '#f3dc75' : '#f5f0dc'; [-size * 0.16, size * 0.16].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.ellipse(eyeX, eyeY, size * 0.09, expression === 'crisis' ? size * 0.14 : size * 0.1, 0, 0, Math.PI * 2); drawingContext.fill(); });
                drawingContext.fillStyle = '#161522'; [-size * 0.16, size * 0.16].forEach((eyeX) => { drawingContext.beginPath(); drawingContext.arc(eyeX, eyeY, size * 0.04, 0, Math.PI * 2); drawingContext.fill(); });
                drawingContext.strokeStyle = '#231c28'; drawingContext.beginPath(); if (expression === 'crisis') drawingContext.arc(0, size * 0.25, size * 0.12, Math.PI, Math.PI * 2); else drawingContext.arc(0, size * 0.14, size * 0.12, 0, Math.PI); drawingContext.stroke();
            }
            drawingContext.restore();
        }
    }

    /**
     * 연습 모드에서 조작하거나 뿌요를 받지 않는 상대다.
     */
    class PracticeEnemy extends BundledEnemy {
        constructor() {
            super();
        }

        /**
         * @returns {string} 적 이름
         */
        getName() {
            return translate('연습 상대');
        }

        /** 이 클래스 이름 반환, 하위 클래스는 반드시 이 메소드를 오버라이드해야 함. @type {string}  */
        getClassType() {
            return 'PracticeEnemy';
        }
    }


    // 공통 사운드 풀은 외부에서 initialize 호출 전에 음원 URL을 설정할 수 있도록 미리 만든다.
    prepareSoundPools();

    // 기본 적은 모든 함수 선언이 준비된 뒤 등록해 초기화 순서를 명확히 한다.
    OPPONENTS.push(
        createOpponentEntry(() => new Solomon()),
        createOpponentEntry(() => new Andromalius()),
        createOpponentEntry(() => new Dantalion()),
        createOpponentEntry(() => new Seere()),
        createOpponentEntry(() => new Decarabia()),
        createOpponentEntry(() => new Belial()),
        createOpponentEntry(() => new Amdusias()),
        createOpponentEntry(() => new Kimaris())
    );

    /**
     * 적의 사운드 풀을 변경한다.
     *
     * @param {string} enemyClassType 적 클래스명 (getClassType() 반환값)
     * @param {SoundPool} soundPoolObject 사운드풀 객체
     */
    function setEnemySoundPool(enemyClassType, soundPoolObject) {
        if (typeof enemyClassType !== 'string' || !enemyClassType) throw new TypeError('enemyClassType은 비어 있지 않은 getClassType() 반환 문자열이어야 합니다.');
        if (!(soundPoolObject instanceof SoundPool)) throw new TypeError('soundPoolObject는 PuyoW.createSoundPool(false)로 만든 SoundPool이어야 합니다.');
        const enemyEntry = OPPONENTS.find((entry) => entry.classType === enemyClassType);
        if (!enemyEntry) {
            console.warn(`setEnemySoundPool: Enemy class type "${enemyClassType}" not found.`);
            return;
        }
        enemySoundPools.set(enemyClassType, soundPoolObject);
        // 이미 대전 중인 같은 적도 다음 연쇄 효과음부터 새 사운드 풀을 사용한다.
        game?.players.forEach((player) => {
            if (player.controller?.getClassType?.() === enemyClassType) player.controller.soundPool = soundPoolObject;
        });
    }

    /**
     * 공통 사운드 풀을 변경한다.
     * 
     * @param {CommonSoundPool} commonSoundPoolObject 
     */
    function setCommonSoundPool(commonSoundPoolObject) {
        if (!(commonSoundPoolObject instanceof CommonSoundPool)) throw new TypeError('commonSoundPoolObject PuyoW.createSoundPool(true)로 만든 SoundPool이어야 합니다.');
        commonSoundPool = commonSoundPoolObject;
    }

    /**
     * 피버 연쇄 패턴을 추가한다.
     * 
     * @param {FeverStageState} feverStageState 피버 연쇄 패턴
     */
    function registerFeverStageState(feverStageState) {
        if (!(feverStageState instanceof FeverStageState)) throw new TypeError('feverStageState는 FeverStageState 인스턴스여야 합니다.');
        addFeverStageState(feverStageState);
    }
    
    /**
     * 퍼즐 뿌요 스테이지를 추가한다.
     * 
     * @param {PuzzlePuyoStage} puzzlePuyoStage 퍼즐 뿌요 스테이지
     */
    function registerPuzzleStage(puzzlePuyoStage) {
        if (!(puzzlePuyoStage instanceof PuzzlePuyoStage)) throw new TypeError('puzzlePuyoStage는 PuzzlePuyoStage 인스턴스여야 합니다.');
        if (PUZZLE_STAGES.some((registeredStage) => registeredStage.uid === puzzlePuyoStage.uid)) {
            throw new Error(`uid가 중복된 PuzzlePuyoStage는 등록할 수 없습니다: ${puzzlePuyoStage.uid}`);
        }
        PUZZLE_STAGES.push(puzzlePuyoStage);
    }

    /**
     * 2D 렌더러에 종속되지 않아 3D 버전도 재사용할 수 있는 공통 함수 모음이다.
     * 모든 함수는 입력 보드를 직접 바꾸지 않으며, 3D 규칙 구현에서 PuyoW.common으로 접근한다.
     */
    const commonFunctions = Object.freeze({
        randomFloat,
        randomColor,
        translate,
        getPuyo,
        activeCells,
        activeRenderCells,
        findLandingPlacement,
        findBestPreviewResult,
        findExplosionsOnBoard,
        findExplosionGroupsOnBoard,
        getChainBonus,
        getConnectionBonus,
        getColorBonus,
        calculateExplosionPoint,
        getMarginRate,
        calculateExplosionAttack,
        formatIntegerPoint,
        formatPoint,
        collapseBoard,
        simulatePlacementBoard,
        isAllClearBoard,
        estimateAttack,
        estimateCombo,
        warningUnits
    });

    WebPuyo = {
        Enemy,
        Puyo,
        RedPuyo,
        GreenPuyo,
        YellowPuyo,
        BluePuyo,
        PurplePuyo,
        GarbagePuyo,
        HardGarbagePuyo,
        IronPuyo,
        WarningPuyo,
        SoundPool,
        CommonSoundPool,
        EnemySoundPool,
        StorageManager,
        FeverStageState,
        PuzzlePuyoStage,
        PUZZLE_STAGES,
        BUILDNO,
        createSoundPool,
        setEnemySoundPool,
        setCommonSoundPool,
        applySoundDataJson,
        setStorageManager,
        registerFeverStageState,
        registerPuzzleStage,
        registerOpponent,
        registerWarningPuyo,
        registerLanguage,
        setNoticeFile,
        setURLContextPath,
        convertURL,
        common: commonFunctions,
        getCommonFunctions: () => commonFunctions,
        randomFloat,
        randomColor,
        translate,
        getPuyo,
        activeCells,
        activeRenderCells,
        findLandingPlacement,
        findBestPreviewResult,
        findExplosionsOnBoard,
        findExplosionGroupsOnBoard,
        getChainBonus,
        getConnectionBonus,
        getColorBonus,
        calculateExplosionPoint,
        getMarginRate,
        calculateExplosionAttack,
        formatIntegerPoint,
        formatPoint,
        collapseBoard,
        simulatePlacementBoard,
        isAllClearBoard,
        estimateAttack,
        estimateCombo,
        warningUnits,
        getCanvasOutputSize,
        toCanvasCoordinates,
        toCanvasLength,
        applyCanvasCoordinateTransform,
        getSelectedDifficulty,
        getSelectedColorCount,
        getScreenState,
        getSimulatorState,
        getGameState,
        getNextPairs,
        playSound,
        showMessage,
        initialize,
        destroy,
        get urlContextPath() { return urlContextPath; },
        get commonSoundPool() { return commonSoundPool; }
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = WebPuyo;
    if (typeof window !== 'undefined') {
        window.WebPuyo = WebPuyo;
        window.PuyoW   = WebPuyo; // 추후 WebPuyo 대신 PuyoW 이름으로 변경 예정
    }
})();
