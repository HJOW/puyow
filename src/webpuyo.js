/**
 * @license Apache-2.0
 * Copyright 2026 HJOW
 * Licensed under the Apache License, Version 2.0.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

(() => {
    'use strict';

    /** 게임 캔버스의 논리 너비다. @type {number} */
    const WIDTH = 1280;
    /** 게임 캔버스의 논리 높이다. @type {number} */
    const HEIGHT = 720;
    /** 한 필드의 가로 칸 수다. @type {number} */
    const COLUMNS = 6;
    /** 숨김 행을 포함한 한 필드의 전체 세로 칸 수다. @type {number} */
    const ROWS = 17;
    /** 화면에 보이는 필드의 세로 칸 수다. @type {number} */
    const VISIBLE_ROWS = 12;
    /** 적 선택 화면 UI를 축소해 표시할 배율이다. @type {number} */
    const OPPONENT_MENU_SCALE = 0.9;
    /** 한 칸의 논리 픽셀 크기다. @type {number} */
    const CELL = 38;
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
    /** 색상 이름별 캔버스 색상값이다. @type {Record<string, string>} */
    const PALETTE = {
        red: '#ef5350', green: '#66bb6a', yellow: '#f7c843', blue: '#42a5f5', purple: '#ab73e8',
        garbage: '#d3edf4'
    };
    /** 연쇄 수에 따른 공격 위력 표다. @type {number[]} */
    const COMBO_POWER = [0, 1, 6, 9, 14, 20, 40, 80, 120, 170, 240, 360, 480, 600, 720, 840, 950, 975, 990];
    /** 화면 제목용 기본 글꼴 이름이다. @type {string} */
    const TITLE_FONT_NAME = 'Black Han Sans';
    /** 버튼용 기본 글꼴 이름이다. @type {string} */
    const BUTTON_FONT_NAME = 'Noto Sans KR';
    /** 메시지용 기본 글꼴 이름이다. @type {string} */
    const MESSAGE_FONT_NAME = 'D2Coding';
    /** 글꼴 지정 시 기본 글꼴 뒤에 대체 글꼴로 붙일 글꼴 이름 목록이다. 배열 내부와 세 글꼴 이름 모두와 중복되지 않도록 자동으로 걸러진다. @type {string[]} */
    const FALLBACK_FONTS = ['Nanum Gothic Coding', 'Nanum Gothic', 'Noto Sans SC', 'Noto Sans JP', 'monospace', 'sans-serif'];
    /** 화면 제목이나 절 제목처럼 강조가 필요한 큰 헤더에 사용할 글꼴 목록이다. @type {string} */
    const TITLE_FONT = buildFontStack(TITLE_FONT_NAME);
    /** 버튼, 선택 카드 등 클릭 가능한 항목의 라벨에 사용할 글꼴 목록이다. @type {string} */
    const BUTTON_FONT = buildFontStack(BUTTON_FONT_NAME);
    /** 이름표, 점수, 안내 문구 등 일반 메시지 표시에 사용할 글꼴 목록이다. @type {string} */
    const MESSAGE_FONT = buildFontStack(MESSAGE_FONT_NAME);
    /** 4방향 인접 좌표 계산에 사용할 X, Y 변화량이다. @type {number[][]} */
    const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    /** 싹쓸이 성공 시 상대방에게 즉시 보낼 방해뿌요 수다. @type {number} */
    const ALL_CLEAR_DAMAGE = 12;
    /** 싹쓸이 성공 시 즉시 더할 점수다. @type {number} */
    const ALL_CLEAR_POINT = 100;
    /** 싹쓸이 황금빛 필드 효과의 지속 시간(ms)이다. @type {number} */
    const ALL_CLEAR_EFFECT_DURATION = 1000;
    /** 사용자 컨트롤의 기본 자동 낙하 간격(ms)이다. @type {number} */
    const PLAYER_FALL_INTERVAL = 1040;
    /** 게임 경과 시간에 따른 사용자 낙하 속도의 최대 배율이다. @type {number} */
    const MAX_PLAYER_FALL_SPEED_MULTIPLIER = 4;
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
    /** AI 쉬움 난이도에서 빠른 하강을 사용하지 않음을 나타내는 지연 시간이다. @type {null} */
    const AI_FAST_DOWN_DELAY_EASY = null;
    /** AI 보통 난이도에서 목표 결정 후 빠른 하강까지 기다리는 시간(ms)이다. @type {number} */
    const AI_FAST_DOWN_DELAY_NORMAL = 1500;
    /** AI 어려움 난이도에서 목표 결정 후 빠른 하강까지 기다리는 시간(ms)이다. @type {number} */
    const AI_FAST_DOWN_DELAY_HARD = 300;
    /** 적이 공격 위력 시뮬레이션을 우선할 피해량 기준이다. @type {number} */
    const AI_ATTACK_SIMULATION_DAMAGE_THRESHOLD = 12;
    /** 공통 뿌요 쌍 대기열의 초기 길이다. @type {number} */
    const INITIAL_PAIR_QUEUE_LENGTH = 16;
    /** 브라우저 저장소에 사용할 키다. @type {string} */
    const STORE_KEY = 'puyow_store';
    /** 한국어 원문을 키로 하는 화면 문구 번역표다. @type {Record<string, Record<string, string>>} */
    const stringTable = {
        en: {
            '게임 시작': 'Game Start', '연습': 'Practice', '난이도 선택': 'Difficulty', '난이도': 'Difficulty', '적 선택': 'Opponent',
            '3색': '3 Colors', '4색': '4 Colors', '5색': '5 Colors', '쉬움': 'Easy', '보통': 'Normal', '어려움': 'Hard', '안드로말리우스': 'Andromalius', '단탈리온': 'Dantalion', '세레': 'Seere', '데카라비아': 'Decarabia', '벨리알': 'Belial', '시작': 'Start', '이전': 'Back',
            '일시정지': 'Paused', '재개': 'Resume', '종료': 'Exit', 'GitHub': 'GitHub',
            '승리': 'Victory', '패배': 'Defeat', '최종 점수 %1': 'Final score %1', '게임 시간 %1초': 'Game time: %1 sec', '%1연쇄': '%1 Chain',
            '연습 상대': 'Practice Opponent', '추후 출시예정': 'Coming soon', '잠김': 'Locked',
            '시뮬레이터': 'Simulator', '팔레트': 'Palette', '재생': 'Play', '그리기': 'Draw', '시뮬레이션': 'Simulation', '지우개': 'Eraser',
            'JSON복사': 'Copy JSON', 'JSON넣기': 'Paste JSON', '배치가 클립보드에 복사됨': 'Layout copied to clipboard',
            '클립보드 복사 실패': 'Clipboard copy failed', 'JSON 파싱 실패': 'JSON parsing failed', '배치 JSON을 입력하세요.': 'Enter layout JSON.',
            '설정': 'Settings', '배경음악 볼륨': 'Music volume', '효과음 볼륨': 'Effects volume', '가상 컨트롤러 사용': 'Use virtual controller', '켜기': 'On', '끄기': 'Off', 'AI 서비스 제공자': 'AI provider', 'AI API 키': 'AI API key', '사용 모델명': 'Model name', '저장': 'Save', '취소': 'Cancel', '이 API키는 브라우저에만 저장됩니다.': 'This API key is stored only in this browser.', '사운드 및 AI 관련 기능은 추후 제공 예정': 'Sound and AI features will be available in a future update.',
            '음소거(꺼짐)' : 'Mute (Off)', '음소거(활성)' : 'Mute (On)'
        },
        ja: {
            '게임 시작': 'ゲーム開始', '연습': '練習', '난이도 선택': '難易度', '난이도': '難易度', '적 선택': '対戦相手',
            '3색': '3色', '4색': '4色', '5색': '5色', '쉬움': '簡単', '보통': '普通', '어려움': '難しい', '안드로말리우스': 'アンドロマリウス', '단탈리온': 'ダンタリオン', '세레': 'セーレ', '데카라비아': 'デカラビア', '벨리알': 'ベリアル', '시작': '開始', '이전': '戻る',
            '일시정지': '一時停止', '재개': '再開', '종료': '終了', 'GitHub': 'GitHub',
            '승리': '勝利', '패배': '敗北', '최종 점수 %1': '最終スコア %1', '게임 시간 %1초': 'ゲーム時間: %1秒', '%1연쇄': '%1連鎖',
            '연습 상대': '練習相手', '추후 출시예정': '近日公開予定', '잠김': 'ロック中',
            '시뮬레이터': 'シミュレーター', '팔레트': 'パレット', '재생': '再生', '그리기': '描画', '시뮬레이션': 'シミュレーション', '지우개': '消しゴム',
            'JSON복사': 'JSONをコピー', 'JSON넣기': 'JSONを貼り付け', '배치가 클립보드에 복사됨': '配置をクリップボードにコピーしました',
            '클립보드 복사 실패': 'クリップボードへのコピーに失敗しました', 'JSON 파싱 실패': 'JSONの解析に失敗しました', '배치 JSON을 입력하세요.': '配置JSONを入力してください。',
            '설정': '設定', '배경음악 볼륨': 'BGM音量', '효과음 볼륨': '効果音量', '가상 컨트롤러 사용': '仮想コントローラーを使用', '켜기': 'オン', '끄기': 'オフ', 'AI 서비스 제공자': 'AIプロバイダー', 'AI API 키': 'AI APIキー', '사용 모델명': 'モデル名', '저장': '保存', '취소': 'キャンセル', '이 API키는 브라우저에만 저장됩니다.': 'このAPIキーはこのブラウザにのみ保存されます。', '사운드 및 AI 관련 기능은 추후 제공 예정': 'サウンドとAI機能は今後のアップデートで提供予定です。',
            '음소거(꺼짐)' : 'ミュート（オフ）', '음소거(활성)' : 'ミュート（オン）'
        },
        zh: {
            '게임 시작': '开始游戏', '연습': '练习', '난이도 선택': '难度', '난이도': '难度', '적 선택': '对手',
            '3색': '3色', '4색': '4色', '5색': '5色', '쉬움': '简单', '보통': '普通', '어려움': '困难', '안드로말리우스': '安德罗马利乌斯', '단탈리온': '丹塔利昂', '세레': '西瑞', '데카라비亚': '德卡拉比亚', '벨리알': '贝利亚尔', '시작': '开始', '이전': '返回',
            '일시정지': '暂停', '재개': '继续', '종료': '退出', 'GitHub': 'GitHub',
            '승리': '胜利', '패배': '失败', '최종 점수 %1': '最终得分 %1', '게임 시간 %1초': '游戏时间：%1秒', '%1연쇄': '%1连锁',
            '연습 상대': '练习对手', '추후 출시예정': '即将推出', '잠김': '已锁定',
            '시뮬레이터': '模拟器', '팔레트': '调色板', '재생': '播放', '그리기': '绘制', '시뮬레이션': '模拟', '지우개': '橡皮擦',
            'JSON복사': '复制 JSON', 'JSON넣기': '粘贴 JSON', '배치가 클립보드에 복사됨': '布局已复制到剪贴板',
            '클립보드 복사 실패': '复制到剪贴板失败', 'JSON 파싱 실패': 'JSON 解析失败', '배치 JSON을 입력하세요.': '请输入布局 JSON。',
            '설정': '设置', '배경음악 볼륨': '背景音乐音量', '효과음 볼륨': '音效音量', '가상 컨트롤러 사용': '使用虚拟控制器', '켜기': '开启', '끄기': '关闭', 'AI 서비스 제공자': 'AI 服务提供商', 'AI API 키': 'AI API 密钥', '사용 모델명': '模型名称', '저장': '保存', '취소': '取消', '이 API키는 브라우저에만 저장됩니다.': '此 API 密钥仅存储在此浏览器中。', '사운드 및 AI 관련 기능은 추후 제공 예정': '声音和 AI 功能将在未来更新中提供。',
            '음소거(꺼짐)' : '静音（关）', '음소거(활성)' : '静音（开）'
        }
    };

    /** 현재 연결된 캔버스 요소다. @type {HTMLCanvasElement|null} */
    let canvas = null;
    /** 현재 연결된 캔버스 2D 렌더링 컨텍스트다. @type {CanvasRenderingContext2D|null} */
    let context = null;
    /** 라이브러리가 초기화되어 이벤트와 게임 루프가 연결됐는지 여부다. @type {boolean} */
    let initialized = false;
    /** initialize()가 canvas를 직접 만들어 연결했는지 여부다. @type {boolean} */
    let createdCanvas = false;
    /** 다음 게임 프레임 취소에 사용할 요청 식별자다. @type {number|null} */
    let animationFrameId = null;
    /** 등록된 WebMCP 도구를 한 번에 해제하는 컨트롤러다. @type {AbortController|null} */
    let webMcpAbortController = null;
    /** 현재 실행 중인 게임 상태다. @type {object|null} */
    let game = null;
    /** 현재 재생 중인 전투 배경음악이다. @type {HTMLAudioElement|null} */
    let backgroundMusicAudio = null;
    /** 메인 화면 왼쪽에 표시할 안내문 원문이다. @type {string} */
    let noticeText = '';
    /** 설정 화면에서 임시로 편집 중인 값이다. @type {object|null} */
    let settingsDraft = null;
    /** 설정 화면의 포커스 항목 인덱스다. @type {number} */
    let settingsFocus = 0;
    /** API 키·모델명 입력란이 실제 편집 상태인지 여부다. @type {boolean} */
    let settingsEditing = false;
    /** 현재 편집 중인 문자열의 커서 위치다. @type {number} */
    let settingsCursor = 0;
    /** AI가 강조 표시하도록 지정한 플레이어 필드 좌표다. @type {{x:number, y:number}|null} */
    let recommendedPoint = null;
    /** 게임이 없을 때 표시할 메뉴 화면 식별자다. @type {'title'|'opponent'|'practiceDifficulty'|'simulator'|'settings'} */
    let menuScreen = 'title';
    /** 시뮬레이터의 편집·재생 상태다. @type {object|null} */
    let simulator = null;
    /** 선택된 적의 OPPONENTS 배열 인덱스다. @type {number} */
    let selectedOpponent = 0;
    /** 선택된 색상 수의 DIFFICULTIES 배열 인덱스다. @type {number} */
    let selectedDifficulty = 1;
    /** 선택된 AI 빠른 하강 난이도의 AI_DIFFICULTIES 배열 인덱스다. @type {number} */
    let selectedAiDifficulty = 1;
    /** 적 선택 메뉴에서 포커스된 행이다. 0: 색상, 1: AI 난이도, 2: 적, 3: 동작이다. @type {number} */
    let opponentMenuFocus = 0;
    /** 적 선택 메뉴 하단에서 포커스된 동작이다. @type {number} */
    let selectedOpponentAction = 0;
    /** 메인 메뉴에서 포커스된 항목이다. @type {number} */
    let titleMenuFocus = 0;
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
    /** 현재 화면 문구에 적용할 언어 코드다. @type {string} */
    let languageCode = 'ko';
    /** localStorage에서 불러온 진행도 데이터다. @type {{clearList:string[], clearListByDifficulty:Record<'easy'|'normal'|'hard', string[]>}} */
    let store = createInitialStore();
    /** 메인 화면 안내문 파일 경로 또는 절대 URL이다. 상대경로는 webpuyo.js 기준으로 해석한다. @type {string} */
    let noticeUrl = 'notice.txt';
    /** 공통 사운드 풀 @type {CommonSoundPool} */
    let commonSoundPool = null;
    /** 난이도별 표시명과 제공 색상 목록이다. @type {{name:string, colors:string[]}[]} */
    const DIFFICULTIES = [
        { name: '3색', colors: ['green', 'yellow', 'blue'] },
        { name: '4색', colors: ['red', 'green', 'yellow', 'blue'] },
        { name: '5색', colors: COLORS }
    ];
    /** AI 빠른 하강 시점별 난이도다. @type {{key:'easy'|'normal'|'hard', name:string, fastDownDelay:number|null}[]} */
    const AI_DIFFICULTIES = [
        { key: 'easy', name: '쉬움', fastDownDelay: AI_FAST_DOWN_DELAY_EASY },
        { key: 'normal', name: '보통', fastDownDelay: AI_FAST_DOWN_DELAY_NORMAL },
        { key: 'hard', name: '어려움', fastDownDelay: AI_FAST_DOWN_DELAY_HARD }
    ];
    /** 등록된 기본 및 외부 적 목록이다. @type {{createController:()=>Enemy, className:string, sortPriority:number, hidden:boolean, notAvail:boolean}[]} */
    const OPPONENTS = [];
    /** 브라우저 전역 및 CommonJS로 공개할 라이브러리 API다. @type {object|null} */
    let WebPuyo = null;

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
     * @returns {{clearList:string[], clearListByDifficulty:Record<'easy'|'normal'|'hard', string[]>}} 초기 저장 데이터
     */
    function createInitialStore() {
        return {
            clearList: [],
            clearListByDifficulty: { easy: [], normal: [], hard: [] },
            settings: { musicVolume: 100, effectsVolume: 100, virtualController: false, aiProvider: 'OpenAI', aiApiKey: '', aiModel: '' },
            muted: false
        };
    }

    /**
     * 현재 저장 데이터를 localStorage에 기록한다. 실패해도 게임 흐름은 계속한다.
     * @returns {void}
     */
    function saveStore() {
        try {
            window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
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
            const serialized = window.localStorage.getItem(STORE_KEY);
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
            const settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
            store = { clearList: [...new Set(parsed.clearList)], clearListByDifficulty, settings: {
                musicVolume: Number.isInteger(settings.musicVolume) ? Math.max(0, Math.min(100, settings.musicVolume)) : initial.settings.musicVolume,
                effectsVolume: Number.isInteger(settings.effectsVolume) ? Math.max(0, Math.min(100, settings.effectsVolume)) : initial.settings.effectsVolume,
                virtualController: settings.virtualController === true,
                aiProvider: settings.aiProvider === 'Google' ? 'Google' : 'OpenAI',
                aiApiKey: typeof settings.aiApiKey === 'string' ? settings.aiApiKey : initial.settings.aiApiKey,
                aiModel: typeof settings.aiModel === 'string' ? settings.aiModel : initial.settings.aiModel
            }, muted: parsed.muted === true };
        } catch (error) {
            console.error('Puyo W 저장 데이터 불러오기에 실패했습니다.', error);
            store = createInitialStore();
        }
    }

    /**
     * noticeUrl을 읽는다. 상대경로는 webpuyo.js와 같은 경로를 기준으로 해석하고,
     * 절대 URL은 지정한 주소 그대로 사용한다. 읽기 실패 시 빈 안내문으로 둔다.
     * @returns {Promise<void>}
     */
    async function loadNotice() {
        if (typeof fetch !== 'function' || typeof document === 'undefined') return;
        try {
            const script = [...(document.scripts || [])].find((element) => /webpuyo(?:\.min)?\.js(?:[?#]|$)/.test(element.src));
            const scriptUrl = script?.src ? new URL(script.src, document.baseURI) : new URL(document.baseURI);
            const notiUrl = new URL(noticeUrl, scriptUrl);
            const response = await fetch(notiUrl.href);
            if (!response.ok) throw new Error(`${noticeUrl} 요청 실패 (${response.status})`);
            noticeText = await response.text();
        } catch (error) {
            console.error(`${noticeUrl}를 불러오지 못했습니다.`, error);
            noticeText = '';
        }
    }

    /**
     * 메인 화면에서 읽을 공지사항 파일 경로 또는 URL을 설정한다.
     * 상대경로는 webpuyo.js와 같은 경로를 기준으로 해석한다.
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
     * 현재 게임에 적용할 AI 난이도 정보를 반환한다.
     * 게임 중에는 시작할 때 선택한 값이 반환되고, 메뉴에서는 현재 선택 중인 값이 반환된다.
     * @returns {{key:'easy'|'normal'|'hard', name:string, fastDownDelay:number|null}} AI 난이도 키, 표시명, 빠른 하강 대기 시간(ms)
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
            const audio = new Audio(url);
            audio.volume = getAudioVolume(type);
            const result = audio.play();
            if (result && typeof result.catch === 'function') result.catch((error) => console.error(`${label} 재생에 실패했습니다.`, error));
        } catch (error) {
            console.error(`${label} 재생에 실패했습니다.`, error);
        }
    }

    /** 현재 전투 배경음악을 중지하고 재생 위치를 초기화한다. @returns {void} */
    function stopBackgroundMusic() {
        if (!backgroundMusicAudio) return;
        try {
            backgroundMusicAudio.pause();
            backgroundMusicAudio.currentTime = 0;
        } catch (error) {
            console.error('배경음악 중지에 실패했습니다.', error);
        }
        backgroundMusicAudio = null;
    }

    /** 적 전용 음원이 없으면 공통 음원을 사용해 전투 배경음악을 반복 재생한다. @param {Enemy|null} controller 현재 적 컨트롤러 @returns {void} */
    function startBackgroundMusic(controller) {
        stopBackgroundMusic();
        const enemyMusic = controller?.soundPool?.backgroundMusic;
        const url = enemyMusic !== null && enemyMusic !== undefined ? enemyMusic : commonSoundPool?.backgroundMusic;
        if (url === null || url === undefined || url === '' || typeof Audio === 'undefined' || getAudioVolume('music') <= 0) return;
        try {
            const audio = new Audio(url);
            audio.loop = true;
            audio.volume = getAudioVolume('music');
            backgroundMusicAudio = audio;
            const result = audio.play();
            if (result && typeof result.catch === 'function') result.catch((error) => console.error('배경음악 재생에 실패했습니다.', error));
        } catch (error) {
            console.error('배경음악 재생에 실패했습니다.', error);
            backgroundMusicAudio = null;
        }
    }

    /** 저장된 음소거·배경음악 음량 설정을 현재 재생 중인 음악에 적용한다. @returns {void} */
    function updateBackgroundMusicVolume() {
        if (backgroundMusicAudio) backgroundMusicAudio.volume = getAudioVolume('music');
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
        playSound(getComboSoundUrl(spellPool, 'spellCombo', combo), 'effects', '연쇄 주문 효과음');
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
     * 색 뿌요 하나를 무작위로 선택한다.
     * @returns {string} 뿌요 색상 이름
     */
    function randomColor(colors = COLORS) {
        return colors[Math.floor(Math.random() * colors.length)];
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
            this.board = Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
            this.point = 0;
            this.attack = 0;
            this.damage = 0;
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
            this.receivesPuyos = true;
            this.allClearEnabled = true;
            this.clearsGarbage = false;
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
     * @returns {{createController:()=>Enemy, className:string, sortPriority:number, hidden:boolean, notAvail:boolean}} 적 등록 항목
     */
    function createOpponentEntry(createController) {
        const controller = createController();
        return {
            createController,
            className: controller.constructor.name,
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

    /**
     * 이전 유효 적을 클리어해 현재 잠금이 해제된 적인지 판별한다.
     * @param {{className:string, hidden:boolean, notAvail:boolean}} opponent 판별할 적
     * @returns {boolean} 선택 가능 여부
     */
    function isOpponentUnlocked(opponent) {
        const progressionOpponents = OPPONENTS.filter((entry) => !entry.hidden && !entry.notAvail);
        const index = progressionOpponents.indexOf(opponent);
        if (index <= 0) return index === 0;
        const difficultyKey = getSelectedDifficulty().key;
        const clearList = store.clearListByDifficulty?.[difficultyKey] || [];
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
     * 선택 불가 적을 건너뛰어 다음 또는 이전 적을 선택한다.
     * @param {number} direction 이전 -1 또는 다음 1
     * @returns {void}
     */
    function selectRelativeOpponent(direction) {
        const selectable = getSelectableOpponents();
        if (!selectable.length) return;
        const currentIndex = Math.max(0, selectable.indexOf(OPPONENTS[selectedOpponent]));
        const nextIndex = (currentIndex + direction + selectable.length) % selectable.length;
        selectedOpponent = OPPONENTS.indexOf(selectable[nextIndex]);
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

    /**
     * 대전 또는 연습 상태를 초기화한다.
     * @param {boolean} practice 연습 모드 여부
     * @returns {void}
     */
    function startGame(practice = false) {
        if (!practice && !ensureSelectedOpponent()) return;
        resetVirtualControllerInput();
        const opponent = practice ? { createController: () => new PracticeEnemy() } : OPPONENTS[selectedOpponent];
        const controller = opponent.createController();
        const colors = DIFFICULTIES[selectedDifficulty].colors;
        const practicePlayer = new PlayerState(controller.getName(), FIELD_RIGHT, controller, colors);
        const players = [new PlayerState('PLAYER 1', FIELD_LEFT, null, colors), practicePlayer];
        // 연습전 상대는 공격을 받지 않고 뿌요도 생성하지 않도록 설정한다.
        if (practice) {
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
            practice,
            difficulty: selectedDifficulty,
            aiDifficulty: selectedAiDifficulty,
            themeController: controller,
            pairQueueColors: colors,
            pairQueue: Array.from({ length: INITIAL_PAIR_QUEUE_LENGTH }, () => createRandomPair(colors)),
            players
        };
        players.filter((player) => player.receivesPuyos).forEach(updateNextPairs);
        startBackgroundMusic(controller);
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
     * 플레이어의 현재 대기열 순번 기준으로 다음 두 쌍 표시를 갱신한다.
     * @param {PlayerState} player 표시를 갱신할 플레이어
     * @returns {void}
     */
    function updateNextPairs(player) {
        ensurePairQueue(player.pairQueuePosition + 1);
        player.nextPairs = game.pairQueue
            .slice(player.pairQueuePosition, player.pairQueuePosition + 2)
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

    /**
     * 카운트다운이 끝난 뒤 각 플레이어에게 첫 조작 뿌요를 제공한다.
     * @returns {void}
     */
    function beginGame() {
        enterControl(game.players[0]);
        enterControl(game.players[1]);
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
        if (player === game?.players[0]) {
            horizontalHoldElapsed = 0;
            horizontalRepeatElapsed = 0;
        }
        player.active = { x: 2, y: 11.5, rotation: 0, colors: takeNextPair(player) };
        // CPU 플레이어면 이번 뿌요 쌍의 목표 위치와 회전을 미리 결정한다.
        if (player.controller) {
            player.controller.prepareTurn(player);
            player.aiTarget = player.controller.chooseTarget(player);
            player.aiRotation = ((player.controller.chooseRotate(player) % 4) + 4) % 4;
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
            return true;
        }
        const horizontalKick = candidate.rotation === 1 ? -1 : candidate.rotation === 3 ? 1 : 0;
        const kicked = { ...candidate, x: candidate.x + horizontalKick };
        // 벽에 막힌 회전은 수평 밀어넣기로 가능한지 검사한다.
        if (horizontalKick && canPlace(player, kicked)) {
            player.active = kicked;
            return true;
        }
        const flipped = { ...player.active, rotation: (player.active.rotation + direction * 2 + 4) % 4 };
        // 마지막으로 반대편 회전 위치를 시도한다.
        if (canPlace(player, flipped)) {
            player.active = flipped;
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
        // 숨김 행을 포함해 유효한 필드 좌표에만 뿌요를 고정한다.
        activeCells(player.active).forEach((cell) => {
            if (cell.y >= 0 && cell.y < ROWS) player.board[cell.y][cell.x] = cell.color;
        });
        player.placedPairCount += 1;
        player.hasPlacedPuyoSinceAllClear = true;
        player.active = null;
        // AI가 제안한 위치는 이 뿌요 쌍이 고정되는 즉시 더 이상 유효하지 않다.
        if (game && player === game.players[0]) recommendedPoint = null;
        startGravity(player, 'explode');
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
                if (player.board[y][x]) stack.push({ color: player.board[y][x], fromY: y });
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
        player.gravityAnimation = falling.length ? { falling, elapsed: 0, duration: Math.max(...falling.map((puyo) => 210 + 790 * Math.sqrt((puyo.fromY - puyo.toY) / VISIBLE_ROWS))) } : null;
    }

    /**
     * 상하좌우로 4개 이상 연결된 색 뿌요를 모두 찾는다.
     * @param {PlayerState} player 탐색할 플레이어
     * @returns {number[][]} 폭발할 [x, y] 좌표 목록
     */
    function findExplosions(player) {
        return findExplosionsOnBoard(player.board);
    }

    /**
     * 보드 복사본에서 상하좌우로 4개 이상 연결된 색 뿌요를 모두 찾는다.
     * @param {(string|null)[][]} board 탐색할 보드
     * @returns {number[][]} 폭발할 [x, y] 좌표 목록
     */
    function findExplosionsOnBoard(board) {
        const visited = new Set();
        const exploding = [];
        // 모든 셀을 시작점으로 삼아 아직 방문하지 않은 색 그룹을 탐색한다.
        for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLUMNS; x += 1) {
            const color = board[y][x];
            const key = `${x},${y}`;
            // 빈칸, 방해뿌요, 이미 조사한 색 뿌요는 탐색 대상에서 제외한다.
            if (!color || color === 'garbage' || visited.has(key)) continue;
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
                    if (nx >= 0 && nx < COLUMNS && ny >= 0 && ny < ROWS && board[ny][nx] === color && !visited.has(nextKey)) {
                        visited.add(nextKey);
                        queue.push([nx, ny]);
                    }
                });
            }
            // 네 개 이상 연결된 그룹만 폭발 목록에 추가한다.
            if (group.length >= 4) exploding.push(...group);
        }
        return exploding;
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
            if (!exploding.length) return simulatedBoard[11][2] !== null;
            const removed = new Set(exploding.map(([x, y]) => `${x},${y}`));
            exploding.forEach(([x, y]) => DIRECTIONS.forEach(([deltaX, deltaY]) => {
                const nextX = x + deltaX;
                const nextY = y + deltaY;
                if (nextX >= 0 && nextX < COLUMNS && nextY >= 0 && nextY < ROWS && simulatedBoard[nextY][nextX] === 'garbage') {
                    removed.add(`${nextX},${nextY}`);
                }
            }));
            removed.forEach((key) => {
                const [x, y] = key.split(',').map(Number);
                simulatedBoard[y][x] = null;
            });
            simulatedBoard = collapseBoard(simulatedBoard);
        }
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
            const removed = new Set(exploding.map(([x, y]) => `${x},${y}`));
            exploding.forEach(([x, y]) => DIRECTIONS.forEach(([deltaX, deltaY]) => {
                const nextX = x + deltaX;
                const nextY = y + deltaY;
                if (nextX >= 0 && nextX < COLUMNS && nextY >= 0 && nextY < ROWS && board[nextY][nextX] === 'garbage') removed.add(`${nextX},${nextY}`);
            }));
            removed.forEach((key) => {
                const [x, y] = key.split(',').map(Number);
                board[y][x] = null;
            });
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
        const virtualPlayer = { board, active: { x: 2, y: 11.5, rotation: 0, colors } };
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
     * @returns {{x:number, rotation:number, positions:{x:number,y:number}[], attack:number, combo:number}} 목표 배치 후보
     */
    function findBestAttackPlacement(player, fallback, defeatCheckColumn = null) {
        let bestPlacement = {
            x: fallback,
            rotation: 0,
            positions: [],
            attack: -1,
            combo: 0
        };
        // 회전을 포함한 모든 실제 착지 후보를 비교한다. 공격력이 같으면 더 오른쪽 열을 선택한다.
        player.aiSimulations.forEach((simulation) => {
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
            const exploding = findExplosionsOnBoard(board);
            if (!exploding.length) return attack;
            combo += 1;
            const power = COMBO_POWER[Math.min(combo, 18)] || 999;
            attack += exploding.length * power / 4;
            const removed = new Set(exploding.map(([x, y]) => `${x},${y}`));
            exploding.forEach(([x, y]) => DIRECTIONS.forEach(([deltaX, deltaY]) => {
                const nextX = x + deltaX;
                const nextY = y + deltaY;
                if (nextX >= 0 && nextX < COLUMNS && nextY >= 0 && nextY < ROWS && board[nextY][nextX] === 'garbage') removed.add(`${nextX},${nextY}`);
            }));
            removed.forEach((key) => {
                const [x, y] = key.split(',').map(Number);
                board[y][x] = null;
            });
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
            const removed = new Set(exploding.map(([x, y]) => `${x},${y}`));
            exploding.forEach(([x, y]) => DIRECTIONS.forEach(([deltaX, deltaY]) => {
                const nextX = x + deltaX;
                const nextY = y + deltaY;
                if (nextX >= 0 && nextX < COLUMNS && nextY >= 0 && nextY < ROWS && board[nextY][nextX] === 'garbage') removed.add(`${nextX},${nextY}`);
            }));
            removed.forEach((key) => {
                const [x, y] = key.split(',').map(Number);
                board[y][x] = null;
            });
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
        const exploding = findExplosions(player);
        // 이번 단계에 폭발할 색 뿌요가 있으면 점수와 공격을 처리한다.
        if (exploding.length) {
            const removed = new Map(exploding.map(([x, y]) => [`${x},${y}`, { x, y, color: player.board[y][x] }]));
            exploding.forEach(([x, y]) => {
                DIRECTIONS.forEach(([deltaX, deltaY]) => {
                    const nextX = x + deltaX;
                    const nextY = y + deltaY;
                    if (nextX >= 0 && nextX < COLUMNS && nextY >= 0 && nextY < ROWS && player.board[nextY][nextX] === 'garbage') {
                        removed.set(`${nextX},${nextY}`, { x: nextX, y: nextY, color: 'garbage' });
                    }
                });
            });
            player.combo += 1;
            playComboSounds(player);
            const power = COMBO_POWER[Math.min(player.combo, 18)] || 999;
            player.point += exploding.length * power;
            player.attack += exploding.length * power / 4;
            cancelPendingAttack(player, opponent);
            const center = exploding.reduce((sum, [x, y]) => ({ x: sum.x + x, y: sum.y + y }), { x: 0, y: 0 });
            player.comboPopups.push({ x: center.x / exploding.length, y: center.y / exploding.length, combo: player.combo, elapsed: 0 });
            removed.forEach((puyo) => { player.board[puyo.y][puyo.x] = null; });
            player.effects = { cells: [...removed.values()], elapsed: 0, duration: 430 };
            player.phase = 'burst';
            player.phaseTimer = 0;
            return;
        }
        cancelPendingAttack(player, opponent);
        const deliveredAttack = Math.floor(player.attack);
        opponent.damage += deliveredAttack;
        player.attack -= deliveredAttack;
        player.combo = 0;
        player.phase = 'garbage';
    }

    /**
     * 새 공격으로 상대의 미정산 공격과 자신의 피해를 즉시 상쇄한다.
     * 정수 부분만 사용해 ATTACK과 DAMAGE의 소수 잔여값은 다음 정산까지 보존한다.
     * @param {PlayerState} player 새 공격을 발생시킨 플레이어
     * @param {PlayerState} opponent 상대 플레이어
     * @returns {void}
     */
    function cancelPendingAttack(player, opponent) {
        const cancelledOpponentAttack = Math.min(Math.floor(player.attack), Math.floor(opponent.attack));
        player.attack -= cancelledOpponentAttack;
        opponent.attack -= cancelledOpponentAttack;
        const cancelledDamage = Math.min(Math.floor(player.attack), Math.floor(player.damage));
        player.attack -= cancelledDamage;
        player.damage -= cancelledDamage;
    }

    /**
     * 피해 수치만큼 방해뿌요를 상단에서 생성한다.
     * @param {PlayerState} player 방해뿌요를 받을 플레이어
     * @returns {void}
     */
    function dropGarbage(player) {
        const amount = Math.min(30, Math.floor(player.damage));
        // 누적 피해가 있으면 한 번에 최대 30개의 방해뿌요를 필드 위에서 떨어뜨린다.
        if (amount) {
            const positions = [];
            // 필요한 행 수만큼 열 순서를 섞어 방해뿌요 위치를 만든다.
            for (let y = 0; y < Math.ceil(amount / COLUMNS); y += 1) {
                const columns = [...Array(COLUMNS).keys()].sort(() => Math.random() - 0.5);
                columns.forEach((x) => positions.push([x, ROWS - 1 - y]));
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
        game.ending = {
            loser,
            winner,
            elapsed: 0,
            duration: 1050,
            fallingPuyos,
            waitForOpponentResolution: isResolutionPhase(winner.phase)
        };
    }

    /**
     * 대전에서 이긴 적의 클래스명을 한 번만 저장한다.
     * @param {PlayerState} winner 승리한 플레이어
     * @returns {void}
     */
    function recordEnemyClear(winner) {
        if (game.practice || winner !== game.players[0]) return;
        const enemyClassName = game.players[1].controller.constructor.name;
        const difficultyKey = AI_DIFFICULTIES[game.aiDifficulty]?.key || AI_DIFFICULTIES[1].key;
        let changed = false;
        if (!store.clearListByDifficulty[difficultyKey].includes(enemyClassName)) {
            store.clearListByDifficulty[difficultyKey].push(enemyClassName);
            changed = true;
        }
        if (!store.clearList.includes(enemyClassName)) {
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
        return phase === 'gravity' || phase === 'explode' || phase === 'burst';
    }

    /**
     * 패배 연출과, 진행 중이던 승리자의 연쇄 처리를 갱신한다.
     * @param {number} delta 이전 프레임 후 경과한 밀리초
     * @returns {void}
     */
    function updateDefeatSequence(delta) {
        const ending = game.ending;
        ending.elapsed += delta;
        // 상대 연쇄가 끝날 때까지는 승리자의 점수 처리를 계속 진행한다.
        if (ending.waitForOpponentResolution && isResolutionPhase(ending.winner.phase)) {
            updatePlayer(ending.winner, ending.loser, delta);
        }
        // 패배 연출과 남은 연쇄 처리가 끝나면 게임을 종료한다.
        if (ending.elapsed > ending.duration && (!ending.waitForOpponentResolution || !isResolutionPhase(ending.winner.phase))) {
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
        const wasAllClearEffectActive = player.allClearEffectElapsed > 0;
        player.allClearEffectElapsed = Math.max(0, player.allClearEffectElapsed - delta);
        if (wasAllClearEffectActive && player.allClearEffectElapsed === 0 && player.pendingAllClearDamage > 0) {
            opponent.damage += player.pendingAllClearDamage;
            player.pendingAllClearDamage = 0;
        }
        // 대기 중인 연습 상대도 예약된 피해가 있으면 방해뿌요 처리는 수행한다.
        if (player.phase === 'idle') {
            if (player.damage > 0) dropGarbage(player);
            return;
        }
        // 조작 단계에서는 CPU 이동과 낙하 타이머를 갱신한다.
        if (player.phase === 'control') {
            if (!player.controller && player === game?.players[0] && horizontalKeyPressed) {
                horizontalHoldElapsed += delta;
                if (horizontalHoldElapsed >= HORIZONTAL_HOLD_DELAY) {
                    horizontalRepeatElapsed += delta;
                    while (horizontalRepeatElapsed >= HORIZONTAL_REPEAT_INTERVAL) {
                        moveActive(player, horizontalKeyPressed === 'arrowleft' ? -1 : 1, 0);
                        horizontalRepeatElapsed -= HORIZONTAL_REPEAT_INTERVAL;
                    }
                }
            }
            if (!player.controller && player === game?.players[0] && (virtualDirectionInput.arrowleft || virtualDirectionInput.arrowright)) {
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
                player.aiFastDown = player.controller.useFastDown(player) === true;
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
            const fastDown = player.controller ? player.aiFastDown : isDownKeyPressed || virtualDirectionInput.arrowdown;
            const speedMultiplier = Math.min(MAX_PLAYER_FALL_SPEED_MULTIPLIER, 1 + Math.floor(game.elapsed / 60000) * 0.2);
            const fallInterval = fastDown ? 55 : player.controller ? 290 : PLAYER_FALL_INTERVAL / speedMultiplier;
            const currentFloor = Math.floor(player.active.y);
            const nextFloor = currentFloor - 1;
            if (nextFloor < 0 || !canPlace(player, { ...player.active, y: nextFloor })) {
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
                player.gravityAnimation = null;
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
            // 패배 판정 행의 중앙이 차면 패배 연출을 시작한다.
            if (player.board[11][2]) {
                startDefeatSequence(player, opponent);
            } else {
                const isAllClear = player.board.every((row) => row.every((cell) => cell === null));
                // 뿌요를 놓은 뒤 필드가 비었을 때만 싹쓸이 공격을 보낸다.
                if (player.allClearEnabled && isAllClear && player.hasPlacedPuyoSinceAllClear) {
                    player.pendingAllClearDamage += ALL_CLEAR_DAMAGE;
                    player.point += ALL_CLEAR_POINT;
                    player.allClearEffectElapsed = ALL_CLEAR_EFFECT_DURATION;
                    player.hasPlacedPuyoSinceAllClear = false;
                }
                enterControl(player);
            }
        }
    }

    /**
     * 공격량을 예고뿌요 단위 목록으로 변환한다.
     * @param {number} amount 예고할 방해뿌요 수
     * @returns {string[]} 왼쪽부터 그릴 예고뿌요 종류
     */
    function warningUnits(amount) {
        const units = [];
        [[500, 'sun'], [210, 'star'], [30, 'rock'], [6, 'drop'], [1, 'tiny']].forEach(([value, type]) => {
            const count = Math.floor(amount / value);
            amount %= value;
            for (let index = 0; index < count && units.length < 6; index += 1) units.push(type);
        });
        return units;
    }

    /**
     * 눈이 있는 색 뿌요 또는 반투명 방해뿌요를 그린다.
     * @param {number} x 셀의 왼쪽 X 좌표
     * @param {number} y 셀의 위쪽 Y 좌표
     * @param {string} color 뿌요 색상 종류
     * @param {number} scale 셀 대비 크기 비율
     * @returns {void}
     */
    function drawPuyo(x, y, color, scale = 1, slimeDetails = true) {
        const radius = CELL * 0.42 * scale;
        context.save();
        context.translate(x + CELL / 2, y + CELL / 2);
        context.fillStyle = PALETTE[color];
        context.globalAlpha = color === 'garbage' ? 0.75 : 1;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = color === 'garbage' ? '#f4fbff' : 'rgba(255,255,255,0.45)';
        context.stroke();
        // 일반/방해뿌요는 물방울 같은 슬라임이라는 인상을 주는 작은 반사광을 넣는다.
        // 예고뿌요(태양, 별, 돌 등)는 이 함수가 아닌 drawWarning에서 별도로 그린다.
        if (slimeDetails) {
            context.fillStyle = 'rgba(255, 255, 255, 0.72)';
            context.beginPath();
            // 긴 축을 기존 방향에서 90도 돌려 표면을 따라 반사되게 한다.
            context.ellipse(radius * 0.43, -radius * 0.43, radius * 0.13, radius * 0.22, 0.55 + Math.PI / 2, 0, Math.PI * 2);
            context.fill();
        }
        drawPuyoEyes(radius, slimeDetails ? radius * 0.08 : 0);
        context.restore();
    }

    /**
     * 30 단위 예고뿌요인 빨간돌을 한 칸 안에 울퉁불퉁하게 그린다.
     * @param {number} x 좌측 X 좌표
     * @param {number} y 위쪽 Y 좌표
     * @returns {void}
     */
    function drawRockWarning(x, y) {
        const size = CELL * 0.42;
        context.save();
        context.translate(x + CELL / 2, y + CELL / 2);
        context.lineJoin = 'round';
        context.lineWidth = 2;
        context.strokeStyle = '#8e2728';
        context.fillStyle = '#c83f3d';
        context.beginPath();
        context.moveTo(-size * 0.78, -size * 0.2);
        context.lineTo(-size * 0.52, -size * 0.78);
        context.lineTo(-size * 0.08, -size * 0.91);
        context.lineTo(size * 0.38, -size * 0.75);
        context.lineTo(size * 0.84, -size * 0.26);
        context.lineTo(size * 0.67, size * 0.48);
        context.lineTo(size * 0.2, size * 0.84);
        context.lineTo(-size * 0.43, size * 0.76);
        context.lineTo(-size * 0.86, size * 0.28);
        context.closePath();
        context.fill();
        context.stroke();

        // 각진 면을 겹쳐 표면이 매끈한 뿌요가 아니라는 점을 강조한다.
        context.fillStyle = '#e4675a';
        context.beginPath();
        context.moveTo(-size * 0.52, -size * 0.78);
        context.lineTo(-size * 0.08, -size * 0.91);
        context.lineTo(size * 0.05, -size * 0.2);
        context.lineTo(-size * 0.4, size * 0.02);
        context.closePath();
        context.fill();
        context.fillStyle = '#9d2d31';
        context.beginPath();
        context.moveTo(size * 0.05, -size * 0.2);
        context.lineTo(size * 0.38, -size * 0.75);
        context.lineTo(size * 0.84, -size * 0.26);
        context.lineTo(size * 0.67, size * 0.48);
        context.lineTo(size * 0.2, size * 0.84);
        context.lineTo(size * 0.12, size * 0.12);
        context.closePath();
        context.fill();
        context.strokeStyle = 'rgba(255, 170, 150, 0.65)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(-size * 0.52, -size * 0.78);
        context.lineTo(-size * 0.08, -size * 0.91);
        context.lineTo(size * 0.05, -size * 0.2);
        context.lineTo(size * 0.38, -size * 0.75);
        context.stroke();
        drawPuyoEyes(size, size * 0.08);
        context.restore();
    }

    /**
     * 현재 변환 좌표를 기준으로 뿌요의 귀여운 두 눈을 그린다.
     * @param {number} radius 뿌요 본체의 반지름
     * @returns {void}
     */
    function drawPuyoEyes(radius, offsetY = 0) {
        context.fillStyle = '#fff';
        context.beginPath();
        context.arc(-radius * 0.28, -radius * 0.12 + offsetY, radius * 0.19, 0, Math.PI * 2);
        context.arc(radius * 0.28, -radius * 0.12 + offsetY, radius * 0.19, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#172031';
        context.beginPath();
        context.arc(-radius * 0.25, -radius * 0.08 + offsetY, radius * 0.08, 0, Math.PI * 2);
        context.arc(radius * 0.31, -radius * 0.08 + offsetY, radius * 0.08, 0, Math.PI * 2);
        context.fill();
    }

    /**
     * 단위별 예고뿌요 모양을 한 칸에 그린다.
     * @param {number} x 셀의 왼쪽 X 좌표
     * @param {number} y 셀의 위쪽 Y 좌표
     * @param {string} type 예고뿌요 단위 종류
     * @returns {void}
     */
    function drawWarning(x, y, type) {
        if (type === 'tiny') return drawPuyo(x + CELL * 0.05, y + CELL * 0.25, 'garbage', 0.45, false);
        if (type === 'sun') {
            context.save();
            context.translate(x + CELL / 2, y + CELL / 2);
            context.fillStyle = '#ff9f1c';
            for (let index = 0; index < 8; index += 1) {
                context.save();
                context.rotate(index * Math.PI / 4);
                context.beginPath();
                context.moveTo(CELL * 0.22, 0);
                context.lineTo(CELL * 0.48, -CELL * 0.1);
                context.lineTo(CELL * 0.48, CELL * 0.1);
                context.closePath();
                context.fill();
                context.restore();
            }
            context.fillStyle = '#ff6b35';
            context.beginPath();
            context.arc(0, 0, CELL * 0.31, 0, Math.PI * 2);
            context.fill();
            context.lineWidth = 2;
            context.strokeStyle = '#ffe082';
            context.stroke();
            drawPuyoEyes(CELL * 0.31);
            context.restore();
            return;
        }
        if (type === 'star') {
            context.save(); context.translate(x + CELL / 2, y + CELL / 2); context.fillStyle = '#ffd54f'; context.beginPath();
            for (let index = 0; index < 10; index += 1) {
                const angle = -Math.PI / 2 + index * Math.PI / 5;
                const radius = index % 2 ? CELL * 0.18 : CELL * 0.42;
                context[index ? 'lineTo' : 'moveTo'](Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            context.closePath(); context.fill(); drawPuyoEyes(CELL * 0.34); context.restore(); return;
        }
        if (type === 'rock') {
            drawRockWarning(x, y);
            return;
        }
        drawPuyo(x, y, 'garbage');
    }

    /**
     * 예고뿌요 목록을 그린다. 1개 단위 예고뿌요끼리는 조금 더 촘촘하게 배치한다.
     * @param {number} x 좌측 X 좌표
     * @param {number} y 위쪽 Y 좌표
     * @param {string[]} units 예고뿌요 단위 목록
     * @returns {void}
     */
    function drawWarningUnits(x, y, units) {
        let tinyCount = 0;
        units.forEach((type, index) => {
            const tinyOffset = type === 'tiny' ? tinyCount++ * 0.35 : 0;
            drawWarning(x + (index - tinyOffset) * CELL, y, type);
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

    /**
     * 한 플레이어의 필드, 예고줄, 낙하와 폭발 효과를 그린다.
     * @param {PlayerState} player 그릴 플레이어
     * @param {PlayerState} opponent 예고 공격량을 제공할 상대
     * @returns {void}
     */
    function drawField(player, opponent) {
        const x = player.fieldX;
        const theme = game.themeController;
        const isDefeated = game.ending?.loser === player;
        theme.drawBezelBackground(context, { x: x - CELL, y: FIELD_TOP - CELL, width: CELL * 8, height: CELL * 14, player });
        theme.drawPlayerBackground(context, { x, y: FIELD_TOP, width: CELL * 6, height: CELL * 12, player });
        if (player.allClearEffectElapsed > 0) {
            context.save();
            context.fillStyle = '#ffd54f';
            context.globalAlpha = 0.5 * (player.allClearEffectElapsed / ALL_CLEAR_EFFECT_DURATION);
            context.fillRect(x, FIELD_TOP, CELL * 6, CELL * 12);
            context.restore();
        }
        context.strokeStyle = 'rgba(162, 220, 235, 0.14)';
        context.lineWidth = 1;
        for (let index = 0; index <= COLUMNS; index += 1) { context.beginPath(); context.moveTo(x + index * CELL, FIELD_TOP); context.lineTo(x + index * CELL, FIELD_BOTTOM); context.stroke(); }
        for (let index = 0; index <= VISIBLE_ROWS; index += 1) { context.beginPath(); context.moveTo(x, FIELD_TOP + index * CELL); context.lineTo(x + CELL * 6, FIELD_TOP + index * CELL); context.stroke(); }
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
        for (let index = 0; index < COLUMNS; index += 1) {
            context.fillStyle = '#0a1d29'; context.fillRect(x + index * CELL + 3, FIELD_TOP - CELL + 3, CELL - 6, CELL - 6);
            context.strokeStyle = 'rgba(176, 232, 244, 0.25)'; context.strokeRect(x + index * CELL + 3, FIELD_TOP - CELL + 3, CELL - 6, CELL - 6);
        }
        drawWarningUnits(x, FIELD_TOP - CELL, warningUnits(opponent.attack + player.damage));
        if (player.effects) {
            const progress = Math.min(1, player.effects.elapsed / player.effects.duration);
            player.effects.cells.forEach((puyo) => drawExplosionEffect(x + puyo.x * CELL, FIELD_BOTTOM - (puyo.y + 1) * CELL, puyo, progress));
        }
        player.comboPopups.forEach((popup) => drawComboPopup(x, popup));
        context.fillStyle = '#e7f8fa'; context.font = `18px ${MESSAGE_FONT}`; context.textAlign = 'left';
        context.fillText(player.name, x, 54);
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
        game.themeController.drawBezelBackground(context, bezel);
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
        const distance = progress * progress * (HEIGHT - FIELD_TOP + CELL);
        const opacity = 1 - progress * 0.45;
        const x = player.fieldX;
        context.save();
        context.globalAlpha = opacity;
        animation.fallingPuyos.forEach((puyo) => {
            const y = FIELD_BOTTOM - (puyo.y + 1) * CELL + distance;
            if (y < HEIGHT) drawPuyo(x + puyo.x * CELL, y, puyo.color);
        });
        // 무너지는 베젤은 낙하 중인 숨김 영역 방해뿌요보다 앞에 보인다.
        game.themeController.drawBezelBackground(context, { x: x - CELL, y: FIELD_BOTTOM + distance, width: CELL * 8, height: CELL, player });
        context.restore();
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
        const occupiedCells = enemy.board
            .slice(0, VISIBLE_ROWS)
            .reduce((count, row) => count + row.filter((cell) => cell !== null).length, 0);
        // 필드 점유율 또는 예정 공격량이 높으면 위기 표정을 표시한다.
        if (occupiedCells >= COLUMNS * VISIBLE_ROWS / 2 || enemy.damage + opponent.attack >= 30) return 'crisis';
        return 'normal';
    }

    /**
   * 양쪽의 다음 2쌍, 단탈리온 이미지와 중앙 점수 패널을 그린다.
     * @returns {void}
     */
    function drawCenter() {
        game.themeController.drawCenterBackground(context, { x: 450, y: 0, width: 380, height: HEIGHT });
        context.fillStyle = '#d8f2f5'; context.textAlign = 'center'; context.font = `42px ${TITLE_FONT}`; context.fillText('Puyo W', WIDTH / 2, 95);
        const left = game.players[0]; const right = game.players[1];
        [
            { player: left, x: 482, color: '#ef8aa0' },
            { player: right, x: 650, color: '#6bbce8' }
        ].forEach(({ player, x, color }, playerIndex) => {
            context.fillStyle = '#0b202c'; context.fillRect(x, 120, 148, 150);
            context.strokeStyle = color; context.lineWidth = 2; context.strokeRect(x, 120, 148, 150);
            context.fillStyle = color; context.font = `13px ${MESSAGE_FONT}`; context.fillText(`${player.name} NEXT`, x + 74, 143);
            const displayedPairs = playerIndex === 1 ? [...player.nextPairs].reverse() : player.nextPairs;
            displayedPairs.forEach((pair, pairIndex) => {
                const pairX = x + 21 + pairIndex * 70;
                drawPuyo(pairX, 163, pair[1], 0.68);
                drawPuyo(pairX, 208, pair[0], 0.68);
                context.fillStyle = 'rgba(216, 242, 245, 0.4)'; context.fillRect(x + 74, 158, 1, 92);
            });
        });
        right.controller.drawPortrait(context, WIDTH / 2, 380, 0.86, getEnemyPortraitExpression(right, left));
        const scores = [
            { player: left, x: 488, color: '#ef8aa0' },
            { player: right, x: 646, color: '#6bbce8' }
        ];
        scores.forEach(({ player, x, color }) => {
            context.fillStyle = '#0b202c'; context.fillRect(x, 492, 146, 92);
            context.strokeStyle = color; context.lineWidth = 2; context.strokeRect(x, 492, 146, 92);
            context.fillStyle = color; context.font = `13px ${MESSAGE_FONT}`; context.fillText(player.name, x + 73, 516);
            context.fillStyle = '#f5fbfc'; context.font = `27px ${MESSAGE_FONT}`; context.fillText(String(Math.floor(player.point)).padStart(7, '0'), x + 73, 557);
        });
    }

    /** 가상 컨트롤러를 표시할 수 있는 게임 진행 상태인지 확인한다. @returns {boolean} */
    function shouldShowVirtualController() {
        return Boolean(game && game.running && !game.paused && !game.ending && game.countdown <= 0 && store.settings.virtualController);
    }

    /** 가상 방향 패드의 한 방향 버튼을 그린다. @param {number} x X 좌표 @param {number} y Y 좌표 @param {string} label 표시 문자 @param {boolean} pressed 눌림 여부 @returns {void} */
    function drawVirtualDirectionButton(x, y, label, pressed) {
        const size = VIRTUAL_DPAD.size;
        context.fillStyle = pressed ? 'rgba(247, 200, 67, 0.88)' : 'rgba(11, 32, 44, 0.78)';
        context.fillRect(x, y, size, size);
        context.strokeStyle = pressed ? '#fff6c7' : '#9cc9d2'; context.lineWidth = 2; context.strokeRect(x, y, size, size);
        context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = pressed ? '#263238' : '#f5fbfc'; context.font = `28px ${BUTTON_FONT}`;
        context.fillText(label, x + size / 2, y + size / 2 + 1);
    }

    /** 가상 조작 버튼을 그린다. @param {number} x 중심 X 좌표 @param {number} y 중심 Y 좌표 @param {string} label 표시 문자 @param {boolean} pressed 눌림 여부 @returns {void} */
    function drawVirtualActionButton(x, y, label, pressed) {
        context.beginPath(); context.arc(x, y, VIRTUAL_ACTION_BUTTONS.radius, 0, Math.PI * 2);
        context.fillStyle = pressed ? 'rgba(247, 200, 67, 0.92)' : 'rgba(86, 48, 104, 0.85)'; context.fill();
        context.strokeStyle = pressed ? '#fff6c7' : '#e5c7f5'; context.lineWidth = 2; context.stroke();
        context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#ffffff'; context.font = `${label === 'ESC' ? 14 : 23}px ${BUTTON_FONT}`;
        context.fillText(label, x, y + 1);
    }

    /** 터치 조작이 가능한 가상 컨트롤러를 게임 화면 위에 그린다. @returns {void} */
    function drawVirtualController() {
        const { x, y, size } = VIRTUAL_DPAD;
        drawVirtualDirectionButton(x - size / 2, y - size * 1.5, '↑', virtualDirectionInput.arrowup);
        drawVirtualDirectionButton(x - size * 1.5, y - size / 2, '←', virtualDirectionInput.arrowleft);
        drawVirtualDirectionButton(x + size / 2, y - size / 2, '→', virtualDirectionInput.arrowright);
        drawVirtualDirectionButton(x - size / 2, y + size / 2, '↓', virtualDirectionInput.arrowdown);
        drawVirtualDirectionButton(x - size * 1.5, y + size / 2, '↙', virtualDirectionInput.arrowleft && virtualDirectionInput.arrowdown);
        drawVirtualDirectionButton(x + size / 2, y + size / 2, '↘', virtualDirectionInput.arrowright && virtualDirectionInput.arrowdown);
        const pressed = new Set([...virtualPointerButtons.values()].flat());
        drawVirtualActionButton(VIRTUAL_ACTION_BUTTONS.z.x, VIRTUAL_ACTION_BUTTONS.z.y, 'Z', pressed.has('z'));
        drawVirtualActionButton(VIRTUAL_ACTION_BUTTONS.x.x, VIRTUAL_ACTION_BUTTONS.x.y, 'X', pressed.has('x'));
        drawVirtualActionButton(VIRTUAL_ACTION_BUTTONS.escape.x, VIRTUAL_ACTION_BUTTONS.escape.y, 'ESC', pressed.has('escape'));
        context.textBaseline = 'alphabetic';
    }

    /** 가상 컨트롤러의 모든 누름 상태를 해제한다. @returns {void} */
    function resetVirtualControllerInput() {
        virtualDirectionInput = { arrowleft: false, arrowright: false, arrowup: false, arrowdown: false };
        virtualPointerButtons.clear();
        virtualHorizontalHoldElapsed = 0;
        virtualHorizontalRepeatElapsed = 0;
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
        const { x: centerX, y: centerY, size } = VIRTUAL_DPAD;
        const inButton = (left, top) => x >= left && x < left + size && y >= top && y < top + size;
        if (inButton(centerX - size / 2, centerY - size * 1.5)) buttons.push('arrowup');
        if (inButton(centerX - size * 1.5, centerY - size / 2)) buttons.push('arrowleft');
        if (inButton(centerX + size / 2, centerY - size / 2)) buttons.push('arrowright');
        if (inButton(centerX - size / 2, centerY + size / 2)) buttons.push('arrowdown');
        if (inButton(centerX - size * 1.5, centerY + size / 2)) buttons.push('arrowleft', 'arrowdown');
        if (inButton(centerX + size / 2, centerY + size / 2)) buttons.push('arrowright', 'arrowdown');
        Object.entries(VIRTUAL_ACTION_BUTTONS).forEach(([button, value]) => {
            if (button !== 'radius' && (x - value.x) ** 2 + (y - value.y) ** 2 <= VIRTUAL_ACTION_BUTTONS.radius ** 2) buttons.push(button);
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
        const bounds = canvas.getBoundingClientRect();
        const x = (event.clientX - bounds.left) * WIDTH / bounds.width;
        const y = (event.clientY - bounds.top) * HEIGHT / bounds.height;
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
        game.themeController.drawBezelBackground(context, { x: x - CELL, y: FIELD_TOP - CELL, width: CELL * 8, height: CELL * 14, player });
        game.themeController.drawPlayerBackground(context, { x, y: FIELD_TOP, width: CELL * 6, height: CELL * 12, player });
        context.textAlign = 'center';
        context.font = `36px ${TITLE_FONT}`;
        if (!game.practice || !won) {
            context.fillStyle = won ? '#f7c843' : '#d8f2f5';
            context.fillText(translate(won ? '승리' : '패배'), x + CELL * 3, FIELD_TOP + CELL * 6.4);
        }
        context.fillStyle = '#d8f2f5'; context.font = `16px ${MESSAGE_FONT}`;
        context.fillText(translate('최종 점수 %1', Math.floor(player.point).toLocaleString()), x + CELL * 3, FIELD_TOP + CELL * 7.15);
        if (game.practice) {
            context.fillStyle = '#f7c843'; context.font = `15px ${MESSAGE_FONT}`;
            context.fillText(translate(DIFFICULTIES[game.difficulty].name), x + CELL * 3, FIELD_TOP + CELL * 7.75);
        }
        context.fillStyle = '#e7f8fa'; context.font = `18px ${MESSAGE_FONT}`; context.textAlign = 'left';
        context.fillText(player.name, x, 54);
    }

    /**
     * 종료 버튼만 있는 중앙 영역을 그린다.
     * @returns {void}
     */
    function drawResultCenter() {
        game.themeController.drawCenterBackground(context, { x: 450, y: 0, width: 380, height: HEIGHT });
        context.fillStyle = '#d8f2f5'; context.textAlign = 'center'; context.font = `42px ${TITLE_FONT}`; context.fillText('Puyo W', WIDTH / 2, 95);
        const enemy = game.players[1];
        if (enemy !== game.winner) enemy.controller.drawPortrait(context, WIDTH / 2, 380, 0.86, 'defeated');
        context.fillStyle = '#d8f2f5'; context.font = `18px ${MESSAGE_FONT}`;
        context.fillText(translate('게임 시간 %1초', Math.floor(game.elapsed / 1000)), WIDTH / 2, 145);
        context.fillStyle = '#ef5350'; context.fillRect(515, 165, 250, 64);
        context.fillStyle = '#ffffff'; context.font = `22px ${BUTTON_FONT}`; context.fillText(translate('종료'), WIDTH / 2, 207);
    }

    /** 시뮬레이터를 빈 그리기 보드와 첫 팔레트 포커스로 연다. @returns {void} */
    function openSimulator() {
        simulator = { mode: 'draw', player: new PlayerState('SIMULATOR', FIELD_LEFT, null, COLORS), selected: 'red', paletteFocus: 0, focusArea: 'palette', boardFocus: { x: 0, y: 0 }, backup: null, waitTimer: 0, message: null, messageElapsed: 0 };
        menuScreen = 'simulator';
    }

    /** 설정 화면을 열고 저장된 설정의 임시 복사본을 만든다. @returns {void} */
    function openSettings() {
        settingsDraft = { ...store.settings };
        settingsFocus = 0; settingsEditing = false; settingsCursor = 0;
        menuScreen = 'settings';
    }

    /** 설정 화면의 변경 사항을 저장한다. @returns {void} */
    function saveSettings() {
        store.settings = { ...settingsDraft };
        saveStore();
        updateBackgroundMusicVolume();
        settingsDraft = null; settingsEditing = false;
        menuScreen = 'title'; loadNotice();
    }

    /** 설정 화면을 저장하지 않고 닫는다. @returns {void} */
    function cancelSettings() {
        settingsDraft = null; settingsEditing = false;
        menuScreen = 'title'; loadNotice();
    }

    /** 메인 화면의 음소거 상태를 토글하고 별도 저장한다. @returns {void} */
    function toggleMuted() {
        store.muted = !store.muted;
        saveStore();
        updateBackgroundMusicVolume();
    }

    /** 설정 화면의 포커스 항목을 실행한다. @returns {void} */
    function activateSettingsFocus() {
        if (settingsFocus === 2) settingsDraft.virtualController = !settingsDraft.virtualController;
        else if (settingsFocus === 6) saveSettings();
        else if (settingsFocus === 7) cancelSettings();
    }

    /** 설정 화면을 그린다. @returns {void} */
    function drawSettings() {
        context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
        context.textAlign = 'center'; context.fillStyle = '#d8f2f5'; context.font = `38px ${TITLE_FONT}`; context.fillText(translate('설정'), WIDTH / 2, 56);
        const rows = [
            { label: '배경음악 볼륨', y: 105, value: settingsDraft.musicVolume, kind: 'slider' },
            { label: '효과음 볼륨', y: 155, value: settingsDraft.effectsVolume, kind: 'slider' },
            { label: '가상 컨트롤러 사용', y: 205, value: settingsDraft.virtualController, kind: 'radio' },
            { label: 'AI 서비스 제공자', y: 255, value: settingsDraft.aiProvider, kind: 'provider' },
            { label: 'AI API 키', y: 305, value: settingsDraft.aiApiKey ? '•'.repeat(Math.min(30, settingsDraft.aiApiKey.length)) : '', kind: 'text' },
            { label: '사용 모델명', y: 355, value: settingsDraft.aiModel, kind: 'text' }
        ];
        rows.forEach((row, index) => {
            context.textAlign = 'left'; context.fillStyle = '#d8f2f5'; context.font = `15px ${BUTTON_FONT}`; context.fillText(translate(row.label), 270, row.y + 5);
            const focused = settingsFocus === index;
            if (row.kind === 'slider') {
                context.strokeStyle = focused ? '#ffd54f' : '#426474'; context.lineWidth = focused ? 3 : 2; context.strokeRect(530, row.y - 10, 390, 20);
                context.fillStyle = '#4cc9b0'; context.fillRect(532, row.y - 8, 386 * row.value / 100, 16);
                context.fillStyle = '#f5fbfc'; context.textAlign = 'right'; context.fillText(String(row.value), 958, row.y + 5);
            } else if (row.kind === 'radio') {
                [{ label: '켜기', value: true, x: 530 }, { label: '끄기', value: false, x: 690 }].forEach((option) => {
                    const selected = row.value === option.value;
                    context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(option.x, row.y - 19, 140, 38);
                    context.strokeStyle = focused && selected ? '#ffd54f' : '#426474'; context.lineWidth = focused && selected ? 3 : 2; context.strokeRect(option.x, row.y - 19, 140, 38);
                    context.beginPath(); context.arc(option.x + 20, row.y, 7, 0, Math.PI * 2); context.fillStyle = '#d8f2f5'; context.strokeStyle = '#d8f2f5'; context.lineWidth = 2; context.stroke();
                    if (selected) { context.beginPath(); context.arc(option.x + 20, row.y, 4, 0, Math.PI * 2); context.fill(); }
                    context.fillStyle = '#f5fbfc'; context.textAlign = 'center'; context.fillText(translate(option.label), option.x + 84, row.y + 5);
                });
            } else if (row.kind === 'provider') {
                ['OpenAI', 'Google'].forEach((provider, providerIndex) => {
                    const x = 530 + providerIndex * 160; const selected = row.value === provider;
                    context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(x, row.y - 19, 140, 38); context.strokeStyle = focused && selected ? '#ffd54f' : '#426474'; context.lineWidth = focused && selected ? 3 : 2; context.strokeRect(x, row.y - 19, 140, 38); context.fillStyle = '#f5fbfc'; context.textAlign = 'center'; context.fillText(provider, x + 70, row.y + 5);
                });
            } else {
                context.fillStyle = '#0b202c'; context.fillRect(530, row.y - 19, 450, 38); context.strokeStyle = focused ? '#ffd54f' : '#426474'; context.lineWidth = focused ? 3 : 2; context.strokeRect(530, row.y - 19, 450, 38); context.fillStyle = '#f5fbfc'; context.textAlign = 'left'; context.fillText(row.value || ' ', 543, row.y + 5);
                if (settingsEditing && settingsFocus === index) { const cursorX = 543 + context.measureText(row.value.slice(0, settingsCursor)).width; context.fillStyle = '#ffd54f'; context.fillRect(cursorX, row.y - 13, 2, 21); }
            }
        });
        context.textAlign = 'left'; context.fillStyle = '#a9d9e5'; context.font = `12px ${MESSAGE_FONT}`; context.fillText(translate('이 API키는 브라우저에만 저장됩니다.'), 530, 402);
        context.textAlign = 'center'; context.fillStyle = '#d8f2f5'; context.font = `13px ${MESSAGE_FONT}`; context.fillText(translate('사운드 및 AI 관련 기능은 추후 제공 예정'), WIDTH / 2, 430);
        [{ label: '저장', x: 580, focus: 6, color: '#4cc9b0' }, { label: '취소', x: 760, focus: 7, color: '#ef5350' }].forEach((button) => {
            context.fillStyle = button.color; context.fillRect(button.x, 455, 160, 46); context.strokeStyle = settingsFocus === button.focus ? '#ffd54f' : button.color; context.lineWidth = settingsFocus === button.focus ? 3 : 2; context.strokeRect(button.x, 455, 160, 46); context.fillStyle = '#fff'; context.font = `16px ${BUTTON_FONT}`; context.textAlign = 'center'; context.fillText(translate(button.label), button.x + 80, 485);
        });
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

    /** 시뮬레이터 팔레트와 버튼 영역을 반환한다. @returns {{kind:string,value:string|null,x:number,y:number,width:number,height:number}[]} */
    function getSimulatorPaletteItems() {
        const items = [...COLORS, 'garbage'].map((color, index) => ({ kind: 'puyo', value: color, x: 906 + (index % 3) * (CELL + 6), y: 184 + Math.floor(index / 3) * (CELL + 6), width: CELL, height: CELL }));
        items.push({ kind: 'eraser', value: 'eraser', x: 906, y: 272, width: CELL, height: CELL });
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

    /** 시뮬레이터 화면에 4초 동안 표시할 메시지를 설정한다. @param {string} message 표시할 메시지 @returns {void} */
    function showSimulatorMessage(message) {
        simulator.message = message;
        simulator.messageElapsed = 0;
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
                if (!puyo || !Number.isInteger(puyo.x) || !Number.isInteger(puyo.y) || puyo.x < 0 || puyo.x >= COLUMNS || puyo.y < 0 || puyo.y >= VISIBLE_ROWS || ![...COLORS, 'garbage'].includes(puyo.color)) {
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
        if (!simulator || simulator.mode !== 'draw' || x < 0 || x >= COLUMNS || y < 0 || y >= VISIBLE_ROWS) return;
        simulator.player.board[y][x] = simulator.selected === 'eraser' ? null : simulator.selected;
    }

    /** 팔레트 항목 선택 또는 버튼 동작을 실행한다. @param {number} index 항목 인덱스 @returns {void} */
    function activateSimulatorPaletteItem(index) {
        const item = getSimulatorPaletteItems()[index];
        if (!simulator || !item) return;
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
        simulator.mode = 'simulation'; simulator.player.effects = null;
        startGravity(simulator.player, 'simulatorExplode');
    }

    /** 시뮬레이션 전 보드 상태로 복원해 그리기 모드로 돌아간다. @returns {void} */
    function restoreSimulatorDrawing() {
        if (!simulator) return;
        if (simulator.backup) simulator.player.board = simulator.backup.map((row) => [...row]);
        simulator.player.gravityAnimation = null; simulator.player.effects = null; simulator.player.phase = 'idle';
        simulator.player.point = 0; simulator.player.attack = 0; simulator.player.damage = 0; simulator.player.combo = 0;
        simulator.mode = 'draw'; simulator.focusArea = 'palette'; simulator.paletteFocus = 0; simulator.waitTimer = 0;
    }

    /** 시뮬레이터 보드의 폭발 및 인접 방해뿌요 제거를 처리한다. @returns {boolean} 폭발 여부 */
    function explodeSimulatorPuyos() {
        const player = simulator.player;
        const exploding = findExplosions(player);
        if (!exploding.length) return false;
        const removed = new Map(exploding.map(([x, y]) => [`${x},${y}`, { x, y, color: player.board[y][x] }]));
        exploding.forEach(([x, y]) => DIRECTIONS.forEach(([dx, dy]) => {
            const nx = x + dx; const ny = y + dy;
            if (nx >= 0 && nx < COLUMNS && ny >= 0 && ny < ROWS && player.board[ny][nx] === 'garbage') removed.set(`${nx},${ny}`, { x: nx, y: ny, color: 'garbage' });
        }));
        removed.forEach(({ x, y }) => { player.board[y][x] = null; });
        player.combo += 1;
        const power = COMBO_POWER[Math.min(player.combo, 18)] || 999;
        player.point += exploding.length * power;
        player.attack += exploding.length * power / 4;
        player.effects = { cells: [...removed.values()], elapsed: 0, duration: 420 }; player.phase = 'simulatorEffect';
        return true;
    }

    /** 시뮬레이터 중력·폭발·복원 시간을 갱신한다. @param {number} delta 경과 시간(ms) @returns {void} */
    function updateSimulator(delta) {
        if (!simulator) return;
        if (simulator.message) {
            simulator.messageElapsed += delta;
            if (simulator.messageElapsed >= 4000) simulator.message = null;
        }
        if (simulator.mode === 'draw') return;
        const player = simulator.player;
        if (simulator.mode === 'complete') return;
        if (player.phase === 'gravity') {
            if (player.gravityAnimation) { player.gravityAnimation.elapsed += delta; if (player.gravityAnimation.elapsed < player.gravityAnimation.duration) return; player.gravityAnimation = null; }
            if (!explodeSimulatorPuyos()) { player.combo = 0; simulator.mode = 'complete'; simulator.focusArea = 'complete'; }
        } else if (player.phase === 'simulatorEffect') {
            player.effects.elapsed += delta;
            if (player.effects.elapsed >= player.effects.duration) { player.effects = null; startGravity(player, 'simulatorExplode'); }
        }
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
        const falling = new Set((player.gravityAnimation?.falling || []).map((puyo) => `${puyo.x},${puyo.toY}`));
        for (let y = 0; y < VISIBLE_ROWS; y += 1) for (let column = 0; column < COLUMNS; column += 1) if (player.board[y][column] && !falling.has(`${column},${y}`)) drawPuyo(x + column * CELL, FIELD_BOTTOM - (y + 1) * CELL, player.board[y][column]);
        if (player.gravityAnimation) { const progress = Math.min(1, player.gravityAnimation.elapsed / player.gravityAnimation.duration) ** 2; player.gravityAnimation.falling.forEach((puyo) => { const y = puyo.fromY + (puyo.toY - puyo.fromY) * progress; if (y < VISIBLE_ROWS) drawPuyo(x + puyo.x * CELL, FIELD_BOTTOM - (y + 1) * CELL, puyo.color); }); }
        if (player.effects) { const progress = Math.min(1, player.effects.elapsed / player.effects.duration); player.effects.cells.forEach((puyo) => drawExplosionEffect(x + puyo.x * CELL, FIELD_BOTTOM - (puyo.y + 1) * CELL, puyo, progress)); }
        if (simulator.mode === 'draw' && simulator.focusArea === 'board') { const focus = simulator.boardFocus; context.strokeStyle = '#ffd54f'; context.lineWidth = 4; context.strokeRect(x + focus.x * CELL + 2, FIELD_BOTTOM - (focus.y + 1) * CELL + 2, CELL - 4, CELL - 4); }
        context.fillStyle = '#071621'; context.fillRect(500, FIELD_TOP - CELL, 350, CELL * 14); context.fillStyle = '#0c2433'; context.fillRect(FIELD_RIGHT - CELL, FIELD_TOP - CELL, CELL * 8, CELL * 14);
        for (let i = 0; i < COLUMNS; i += 1) { context.fillStyle = '#0a1d29'; context.fillRect(FIELD_RIGHT + i * CELL + 3, FIELD_TOP - CELL + 3, CELL - 6, CELL - 6); context.strokeStyle = 'rgba(176,232,244,.25)'; context.strokeRect(FIELD_RIGHT + i * CELL + 3, FIELD_TOP - CELL + 3, CELL - 6, CELL - 6); }
        drawWarningUnits(FIELD_RIGHT, FIELD_TOP - CELL, warningUnits(player.attack));
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
        if (simulator.message) {
            const progress = Math.min(1, simulator.messageElapsed / 4000);
            context.save();
            context.globalAlpha = progress < 0.75 ? 1 : (1 - progress) / 0.25;
            context.fillStyle = '#f7c843'; context.font = `18px ${MESSAGE_FONT}`;
            context.fillText(simulator.message, WIDTH / 2, 635);
            context.restore();
        }
        if (simulator.mode !== 'draw') {
            context.fillStyle = 'rgba(3, 11, 19, 0.62)';
            context.fillRect(FIELD_RIGHT, FIELD_TOP, CELL * COLUMNS, CELL * VISIBLE_ROWS);
        }
        if (simulator.mode === 'complete') {
            context.fillStyle = '#4cc9b0'; context.fillRect(600, 145, 150, 58);
            context.strokeStyle = '#ffd54f'; context.lineWidth = 4; context.strokeRect(600, 145, 150, 58);
            context.fillStyle = '#fff'; context.font = `22px ${BUTTON_FONT}`; context.fillText(translate('그리기'), 675, 183);
        }
        context.fillStyle = '#d8f2f5'; context.font = `18px ${MESSAGE_FONT}`; context.fillText(simulator.mode === 'draw' ? translate('그리기') : translate('시뮬레이션'), 675, 486); context.font = `36px ${MESSAGE_FONT}`; context.fillStyle = '#f7c843'; context.fillText(String(Math.floor(player.point)).padStart(7, '0'), 675, 536); context.font = `17px ${MESSAGE_FONT}`; context.fillStyle = '#a9d9e5'; context.fillText('POINT', 675, 566);
    }

    /**
     * 클릭 가능한 게임 시작 메뉴를 그린다.
     * @returns {void}
     */
    function drawMenu() {
        context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
        const opponentMenuScaled = menuScreen === 'opponent';
        if (opponentMenuScaled) {
            context.save();
            context.translate(WIDTH / 2, HEIGHT / 2);
            context.scale(OPPONENT_MENU_SCALE, OPPONENT_MENU_SCALE);
            context.translate(-WIDTH / 2, -HEIGHT / 2);
        }
        context.textAlign = 'center'; context.fillStyle = '#d8f2f5'; context.font = `54px ${TITLE_FONT}`; context.fillText('Puyo W', WIDTH / 2, menuScreen === 'opponent' ? 90 : 170);
        if (menuScreen === 'title') drawNotice();
        if (menuScreen === 'opponent') {
            context.fillStyle = '#d8f2f5'; context.font = `22px ${TITLE_FONT}`; context.fillText(translate('난이도'), WIDTH / 2, 130);
            DIFFICULTIES.forEach((difficulty, index) => {
                const x = 465 + index * 120;
                const selected = index === selectedDifficulty;
                context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(x, 135, 110, 44);
                context.strokeStyle = opponentMenuFocus === 0 && selected ? '#f7c843' : '#3b6070'; context.lineWidth = opponentMenuFocus === 0 && selected ? 4 : 2;
                context.strokeRect(x, 135, 110, 44);
                context.fillStyle = '#f5fbfc'; context.font = `17px ${BUTTON_FONT}`; context.fillText(translate(difficulty.name), x + 55, 163);
            });
            AI_DIFFICULTIES.forEach((difficulty, index) => {
                const x = 465 + index * 120;
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
            if (opponentMenuFocus === 2) {
                context.fillStyle = '#f7c843';
                context.beginPath();
                context.moveTo(WIDTH / 2 - 205, 385);
                context.lineTo(WIDTH / 2 - 175, 360);
                context.lineTo(WIDTH / 2 - 175, 410);
                context.closePath();
                context.fill();
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
                    context.fillStyle = '#c4cbd0'; context.font = `15px ${BUTTON_FONT}`; context.fillText(translate(entry.createController().getName()), cardX + 94, 500);
                    context.fillStyle = '#f0c674'; context.font = `13px ${BUTTON_FONT}`; context.fillText(translate(entry.notAvail ? '추후 출시예정' : '잠김'), cardX + 80, 524);
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
        const menuX = WIDTH / 2 - 109; const menuWidth = 218; const menuHeight = 50;
        context.fillStyle = '#ef5350'; context.fillRect(menuX, 250, menuWidth, menuHeight);
        context.strokeStyle = titleMenuFocus === 0 ? '#f7c843' : '#ef5350'; context.lineWidth = titleMenuFocus === 0 ? 4 : 2; context.strokeRect(menuX, 250, menuWidth, menuHeight);
        context.fillStyle = '#fff'; context.font = `20px ${BUTTON_FONT}`; context.fillText(translate('게임 시작'), WIDTH / 2, 282);
        context.fillStyle = '#264b5b'; context.fillRect(menuX, 315, menuWidth, menuHeight);
        context.strokeStyle = titleMenuFocus === 1 ? '#f7c843' : '#264b5b'; context.lineWidth = titleMenuFocus === 1 ? 4 : 2; context.strokeRect(menuX, 315, menuWidth, menuHeight);
        context.fillStyle = '#d8f2f5'; context.font = `20px ${BUTTON_FONT}`; context.fillText(translate('연습'), WIDTH / 2, 347);
        context.fillStyle = '#34556b'; context.fillRect(menuX, 380, menuWidth, menuHeight);
        context.strokeStyle = titleMenuFocus === 2 ? '#f7c843' : '#34556b'; context.lineWidth = titleMenuFocus === 2 ? 4 : 2; context.strokeRect(menuX, 380, menuWidth, menuHeight);
        context.fillStyle = '#e3f4ff'; context.font = `20px ${BUTTON_FONT}`; context.fillText(translate('시뮬레이터'), WIDTH / 2, 412);
        context.fillStyle = '#405c70'; context.fillRect(menuX, 445, menuWidth, menuHeight);
        context.strokeStyle = titleMenuFocus === 3 ? '#f7c843' : '#405c70'; context.lineWidth = titleMenuFocus === 3 ? 4 : 2; context.strokeRect(menuX, 445, menuWidth, menuHeight);
        context.fillStyle = '#e3f4ff'; context.font = `20px ${BUTTON_FONT}`; context.fillText(translate('설정'), WIDTH / 2, 477);
        context.fillStyle = '#24292f'; context.fillRect(32, 665, 85, 23);
        context.strokeStyle = titleMenuFocus === 4 ? '#f7c843' : '#52606d'; context.lineWidth = titleMenuFocus === 4 ? 2 : 1; context.strokeRect(32, 665, 85, 23);
        context.fillStyle = '#ffffff'; context.font = `10px ${BUTTON_FONT}`; context.fillText(translate('GitHub'), 74.5, 681);
        context.fillStyle = store.muted ? '#52606d' : '#264b5b'; context.fillRect(WIDTH - 117, 665, 85, 23);
        context.strokeStyle = titleMenuFocus === 5 ? '#f7c843' : '#52606d'; context.lineWidth = titleMenuFocus === 5 ? 2 : 1; context.strokeRect(WIDTH - 117, 665, 85, 23);
        context.fillStyle = '#ffffff'; context.font = `10px ${BUTTON_FONT}`; context.fillText(translate(store.muted ? '음소거(활성)' : '음소거(꺼짐)'), WIDTH - 74.5, 681);
        context.fillStyle = '#8899a6'; context.font = `14px ${MESSAGE_FONT}`; context.fillText('Copyright (c) HJOW', WIDTH / 2, HEIGHT - 20);
        if (menuScreen === 'practiceDifficulty') {
            context.fillStyle = 'rgba(3, 11, 19, 0.76)'; context.fillRect(0, 0, WIDTH, HEIGHT);
            context.fillStyle = '#d8f2f5'; context.font = `30px ${TITLE_FONT}`; context.fillText(translate('난이도 선택'), WIDTH / 2, 300);
            DIFFICULTIES.forEach((difficulty, index) => {
                const x = 465 + index * 120;
                const selected = index === selectedDifficulty;
                context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(x, 335, 110, 58);
                context.strokeStyle = selected ? '#f7c843' : '#3b6070'; context.lineWidth = selected ? 4 : 2; context.strokeRect(x, 335, 110, 58);
                context.fillStyle = '#f5fbfc'; context.font = `17px ${BUTTON_FONT}`; context.fillText(translate(difficulty.name), x + 55, 371);
            });
        }
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
        context.clearRect(0, 0, WIDTH, HEIGHT);
        // 진행 중인 게임이 없으면 현재 메뉴 화면만 렌더링한다.
        if (!game) {
            if (menuScreen === 'simulator' && simulator) drawSimulator();
            else if (menuScreen === 'settings' && settingsDraft) drawSettings();
            else drawMenu();
            return;
        }
        context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
        // 게임이 끝났으면 결과 화면으로 전환한다.
        if (!game.running) {
            drawResultField(game.players[0]); drawResultField(game.players[1]); drawResultCenter();
            return;
        }
        drawField(game.players[0], game.players[1]); drawField(game.players[1], game.players[0]); drawCenter();
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

    /**
     * 애니메이션 프레임을 갱신하고 다음 프레임을 예약한다.
     * @param {number} time 브라우저가 제공한 현재 시각
     * @returns {void}
     */
    function frame(time) {
        const delta = Math.min(50, time - lastTime || 0);
        lastTime = time;
        // 실행 중이며 일시정지가 아닐 때만 게임 상태를 시간에 따라 갱신한다.
        if (game && game.running && !game.paused) {
            // 카운트다운이 끝나면 양쪽 플레이어의 첫 턴을 시작한다.
            if (game.countdown > 0) {
                game.countdown = Math.max(0, game.countdown - delta);
                if (!game.countdown && game.countdownStartsGame) {
                    game.countdownStartsGame = false;
                    beginGame();
                }
            } else if (game.ending) {
                game.elapsed += delta;
                updateDefeatSequence(delta);
            } else {
                game.elapsed += delta;
                updatePlayer(game.players[0], game.players[1], delta);
                updatePlayer(game.players[1], game.players[0], delta);
            }
        }
        if (!game && menuScreen === 'simulator') updateSimulator(delta);
        render();
        animationFrameId = requestAnimationFrame(frame);
    }

    /** 시뮬레이터 키보드 입력을 처리한다. @param {string} key 입력 키 @returns {void} */
    function handleSimulatorKeydown(key) {
        if (!simulator) return;
        if (simulator.mode === 'complete') {
            if (key === 'escape' || key === 'enter' || key === ' ') restoreSimulatorDrawing();
            return;
        }
        if (simulator.mode !== 'draw') { if (key === 'escape') restoreSimulatorDrawing(); return; }
        if (simulator.focusArea === 'board') {
            if (key === 'escape') { simulator.focusArea = 'palette'; simulator.paletteFocus = 0; return; }
            if (key === 'arrowleft') simulator.boardFocus.x = Math.max(0, simulator.boardFocus.x - 1);
            if (key === 'arrowright') simulator.boardFocus.x = Math.min(COLUMNS - 1, simulator.boardFocus.x + 1);
            if (key === 'arrowdown') simulator.boardFocus.y = Math.max(0, simulator.boardFocus.y - 1);
            if (key === 'arrowup') simulator.boardFocus.y = Math.min(VISIBLE_ROWS - 1, simulator.boardFocus.y + 1);
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

    /** 설정 화면에서 포커스 이동과 문자열 편집을 처리한다. @param {KeyboardEvent} event 키보드 이벤트 @param {string} key 소문자 키 @returns {void} */
    function handleSettingsKeydown(event, key) {
        const textField = settingsFocus === 4 || settingsFocus === 5;
        if (settingsEditing && textField) {
            const field = settingsFocus === 4 ? 'aiApiKey' : 'aiModel';
            if (key === 'enter' || key === 'escape') { settingsEditing = false; return; }
            if (key === 'arrowleft') { settingsCursor = Math.max(0, settingsCursor - 1); return; }
            if (key === 'arrowright') { settingsCursor = Math.min(settingsDraft[field].length, settingsCursor + 1); return; }
            if (key === 'backspace') { if (settingsCursor > 0) { settingsDraft[field] = settingsDraft[field].slice(0, settingsCursor - 1) + settingsDraft[field].slice(settingsCursor); settingsCursor -= 1; } return; }
            if (key.length === 1) { settingsDraft[field] = settingsDraft[field].slice(0, settingsCursor) + event.key + settingsDraft[field].slice(settingsCursor); settingsCursor += event.key.length; }
            return;
        }
        if (key === 'enter' || key === ' ') {
            if (textField) { settingsEditing = true; settingsCursor = settingsDraft[settingsFocus === 4 ? 'aiApiKey' : 'aiModel'].length; }
            else activateSettingsFocus();
        } else if (key === 'escape') cancelSettings();
        else if (key === 'arrowup' || key === 'arrowdown') settingsFocus = (settingsFocus + (key === 'arrowup' ? 7 : 1)) % 8;
        else if (key === 'arrowleft' || key === 'arrowright') {
            const direction = key === 'arrowleft' ? -1 : 1;
            if (settingsFocus === 0) settingsDraft.musicVolume = Math.max(0, Math.min(100, settingsDraft.musicVolume + direction));
            else if (settingsFocus === 1) settingsDraft.effectsVolume = Math.max(0, Math.min(100, settingsDraft.effectsVolume + direction));
            else if (settingsFocus === 2) settingsDraft.virtualController = direction < 0;
            else if (settingsFocus === 3) settingsDraft.aiProvider = settingsDraft.aiProvider === 'OpenAI' ? 'Google' : 'OpenAI';
            else if (settingsFocus === 6) settingsFocus = 7;
            else if (settingsFocus === 7) settingsFocus = 6;
        }
    }

    /**
     * 키 입력을 현재 메뉴 또는 플레이어 조작에 전달한다.
     * @param {KeyboardEvent} event 키보드 이벤트
     * @returns {void}
     */
    function handleKeydown(event) {
        const key = event.key.toLowerCase();
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'z', 'x', 'escape', 'enter', ' '].includes(key)) event.preventDefault();
        if (!game && menuScreen === 'simulator') { handleSimulatorKeydown(key); return; }
        // 결과 화면에서는 Enter 또는 ESC로 연습은 메인, 대전은 적 선택 화면으로 돌아간다.
        if (game && !game.running && (key === 'enter' || key === 'escape')) {
            const returnToTitle = game.practice;
            stopBackgroundMusic();
            game = null;
            if (returnToTitle) { menuScreen = 'title'; loadNotice(); }
            else openOpponentMenu();
            return;
        }
        // 게임이 없으면 키 입력을 제목 또는 상대 선택 메뉴로 전달한다.
        if (!game) {
            if (menuScreen === 'practiceDifficulty') {
                if (key === 'arrowleft' || key === 'arrowup') selectedDifficulty = (selectedDifficulty + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
                else if (key === 'arrowright' || key === 'arrowdown') selectedDifficulty = (selectedDifficulty + 1) % DIFFICULTIES.length;
                else if (key === 'enter' || key === ' ') startGame(true);
                else if (key === 'escape') { menuScreen = 'title'; loadNotice(); }
                return;
            }
            if (menuScreen === 'title' && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
                titleMenuFocus = key === 'arrowleft' || key === 'arrowup'
                    ? (titleMenuFocus + 5) % 6
                    : (titleMenuFocus + 1) % 6;
            } else if (menuScreen === 'opponent' && key === 'arrowup') {
                opponentMenuFocus = Math.max(0, opponentMenuFocus - 1);
            } else if (menuScreen === 'opponent' && key === 'arrowdown') {
                opponentMenuFocus = Math.min(3, opponentMenuFocus + 1);
            } else if (menuScreen === 'opponent' && key === 'arrowleft') {
                if (opponentMenuFocus === 0) selectedDifficulty = (selectedDifficulty + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
                else if (opponentMenuFocus === 1) selectedAiDifficulty = (selectedAiDifficulty + AI_DIFFICULTIES.length - 1) % AI_DIFFICULTIES.length;
                else if (opponentMenuFocus === 2) selectRelativeOpponent(-1);
                else selectedOpponentAction = 0;
            } else if (menuScreen === 'opponent' && key === 'arrowright') {
                if (opponentMenuFocus === 0) selectedDifficulty = (selectedDifficulty + 1) % DIFFICULTIES.length;
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
                } else if (selectedOpponentAction === 0) startGame();
                else { menuScreen = 'title'; loadNotice(); }
            } else if (key === 'escape' && menuScreen === 'opponent') { menuScreen = 'title'; loadNotice(); }
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
        if (titleMenuFocus === 0) openOpponentMenu();
        else if (titleMenuFocus === 1) {
            selectedDifficulty = 1;
            menuScreen = 'practiceDifficulty';
        }
        else if (titleMenuFocus === 2) openSimulator();
        else if (titleMenuFocus === 3) openSettings();
        else if (titleMenuFocus === 4) {
            const githubWindow = window.open('https://github.com/HJOW/puyow', '_blank');
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
            resetVirtualControllerInput();
            game.paused = false;
            game.countdown = 3000;
            game.countdownStartsGame = false;
        } else {
            resetVirtualControllerInput();
            stopBackgroundMusic();
            game = null;
            menuScreen = 'title'; loadNotice();
        }
    }

    /**
     * 적 선택 화면을 현재 선택값과 첫 포커스 상태로 연다.
     * @returns {void}
     */
    function openOpponentMenu() {
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
        // 결과 화면에서는 종료 버튼 영역 클릭만 메뉴 복귀로 처리한다.
        if (game && !game.running) {
            const bounds = canvas.getBoundingClientRect();
            const x = (event.clientX - bounds.left) * WIDTH / bounds.width;
            const y = (event.clientY - bounds.top) * HEIGHT / bounds.height;
            if (x >= 515 && x <= 765 && y >= 165 && y <= 229) {
                const returnToTitle = game.practice;
                stopBackgroundMusic();
                game = null;
                if (returnToTitle) { menuScreen = 'title'; loadNotice(); }
                else openOpponentMenu();
            }
            return;
        }
        const bounds = canvas.getBoundingClientRect();
        const x = (event.clientX - bounds.left) * WIDTH / bounds.width;
        const y = (event.clientY - bounds.top) * HEIGHT / bounds.height;
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
        if (menuScreen === 'simulator' && simulator) {
            if (simulator.mode === 'complete') {
                if (x >= 600 && x <= 750 && y >= 145 && y <= 203) restoreSimulatorDrawing();
                return;
            }
            if (simulator.mode !== 'draw') return;
            const boardX = Math.floor((x - FIELD_LEFT) / CELL);
            const boardY = Math.floor((FIELD_BOTTOM - y) / CELL);
            if (boardX >= 0 && boardX < COLUMNS && boardY >= 0 && boardY < VISIBLE_ROWS) {
                simulator.boardFocus = { x: boardX, y: boardY };
                simulator.focusArea = 'board';
                placeSimulatorPuyo(boardX, boardY);
                return;
            }
            const paletteIndex = getSimulatorPaletteItems().findIndex((item) => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
            if (paletteIndex >= 0) activateSimulatorPaletteItem(paletteIndex);
            return;
        }
        if (menuScreen === 'title') {
            if (x >= WIDTH / 2 - 109 && x <= WIDTH / 2 + 109 && y >= 250 && y <= 300) {
                titleMenuFocus = 0;
                activateTitleMenu();
            } else if (x >= WIDTH / 2 - 109 && x <= WIDTH / 2 + 109 && y >= 315 && y <= 365) {
                titleMenuFocus = 1;
                activateTitleMenu();
            } else if (x >= WIDTH / 2 - 109 && x <= WIDTH / 2 + 109 && y >= 380 && y <= 430) {
                titleMenuFocus = 2;
                activateTitleMenu();
            } else if (x >= WIDTH / 2 - 109 && x <= WIDTH / 2 + 109 && y >= 445 && y <= 495) {
                titleMenuFocus = 3;
                activateTitleMenu();
            } else if (x >= WIDTH - 117 && x <= WIDTH - 32 && y >= 665 && y <= 688) {
                toggleMuted();
            } else if (x >= 32 && x <= 117 && y >= 665 && y <= 688) {
                titleMenuFocus = 4;
                activateTitleMenu();
            }
        } else if (menuScreen === 'settings') {
            if (y >= 455 && y <= 501 && x >= 580 && x <= 740) { settingsFocus = 6; saveSettings(); }
            else if (y >= 455 && y <= 501 && x >= 760 && x <= 920) { settingsFocus = 7; cancelSettings(); }
            else if (y >= 95 && y <= 115) { settingsFocus = 0; settingsDraft.musicVolume = Math.round(Math.max(0, Math.min(100, (x - 530) / 390 * 100))); }
            else if (y >= 145 && y <= 165) { settingsFocus = 1; settingsDraft.effectsVolume = Math.round(Math.max(0, Math.min(100, (x - 530) / 390 * 100))); }
            else if (y >= 186 && y <= 224 && x >= 530 && x <= 670) { settingsFocus = 2; settingsDraft.virtualController = true; }
            else if (y >= 186 && y <= 224 && x >= 690 && x <= 830) { settingsFocus = 2; settingsDraft.virtualController = false; }
            else if (y >= 236 && y <= 274) { settingsFocus = 3; settingsDraft.aiProvider = x < 690 ? 'OpenAI' : 'Google'; }
            else if (y >= 286 && y <= 324) { settingsFocus = 4; settingsEditing = true; settingsCursor = settingsDraft.aiApiKey.length; }
            else if (y >= 336 && y <= 374) { settingsFocus = 5; settingsEditing = true; settingsCursor = settingsDraft.aiModel.length; }
        } else {
            if (menuScreen === 'practiceDifficulty') {
                const difficultyIndex = DIFFICULTIES.findIndex((difficulty, index) => x >= 465 + index * 120 && x <= 575 + index * 120 && y >= 335 && y <= 393);
                if (difficultyIndex >= 0) {
                    selectedDifficulty = difficultyIndex;
                    startGame(true);
                } else {
                    // 난이도 선택지 바깥을 클릭하면 ESC와 같이 메인 화면으로 돌아간다.
                    menuScreen = 'title';
                    loadNotice();
                }
                return;
            }
            // 축소해 그린 적 선택 화면의 클릭 좌표를 원래 논리 좌표로 되돌린다.
            const opponentX = (x - WIDTH / 2) / OPPONENT_MENU_SCALE + WIDTH / 2;
            const opponentY = (y - HEIGHT / 2) / OPPONENT_MENU_SCALE + HEIGHT / 2;
            const difficultyIndex = DIFFICULTIES.findIndex((difficulty, index) => opponentX >= 465 + index * 120 && opponentX <= 575 + index * 120 && opponentY >= 135 && opponentY <= 179);
            if (difficultyIndex >= 0) {
                selectedDifficulty = difficultyIndex;
                opponentMenuFocus = 0;
                return;
            }
            const aiDifficultyIndex = AI_DIFFICULTIES.findIndex((difficulty, index) => opponentX >= 465 + index * 120 && opponentX <= 575 + index * 120 && opponentY >= 195 && opponentY <= 239);
            if (aiDifficultyIndex >= 0) {
                selectedAiDifficulty = aiDifficultyIndex;
                opponentMenuFocus = 1;
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
                    selectedOpponent = OPPONENTS.indexOf(clickedOpponent);
                    opponentMenuFocus = 2;
                }
            } else if (opponentX >= 440 && opponentX <= 690 && opponentY >= 600 && opponentY <= 658) {
                selectedOpponentAction = 0;
                opponentMenuFocus = 3;
                startGame();
            } else if (opponentX >= 710 && opponentX <= 840 && opponentY >= 600 && opponentY <= 658) {
                selectedOpponentAction = 1;
                opponentMenuFocus = 3;
                menuScreen = 'title'; loadNotice();
            }
        }
    }

    /**
     * 현재 화면을 AI가 구분할 수 있는 간결한 상태 객체로 만든다.
     * @returns {{screen:'main_menu'|'opponent_select'|'simulator'|'settings'|'countdown'|'playing'|'paused'|'game_over', playerCanControl:boolean}}
     */
    function getNowScreen() {
        if (!game) return { screen: menuScreen === 'opponent' ? 'opponent_select' : menuScreen === 'simulator' ? 'simulator' : menuScreen === 'settings' ? 'settings' : 'main_menu', playerCanControl: false };
        if (!game.running) return { screen: 'game_over', playerCanControl: false };
        if (game.countdown > 0) return { screen: 'countdown', playerCanControl: false };
        if (game.paused) return { screen: 'paused', playerCanControl: false };
        return { screen: 'playing', playerCanControl: game.players[0].phase === 'control' && game.players[0].active !== null };
    }

    /**
     * 한 플레이어의 보드와 대기열을 JSON으로 직렬화 가능한 상태로 만든다.
     * @param {PlayerState} player 상태를 읽을 플레이어
     * @param {PlayerState} opponent 상대 플레이어
     * @returns {{name:string, board:{columns:number, rows:number, visibleRows:number, puyos:{x:number,y:number,color:string}[]}, nextPairs:string[][], warningPuyos:string[], active:{x:number,y:number,rotation:number,colors:string[],cells:{x:number,y:number,color:string}[]}|null}}
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
            board: { columns: COLUMNS, rows: ROWS, visibleRows: VISIBLE_ROWS, puyos },
            nextPairs: player.nextPairs.map((pair) => [...pair]),
            warningPuyos: warningUnits(opponent.attack + player.damage),
            active
        };
    }

    /**
     * 플레이 중인 게임의 AI용 상세 상태를 반환한다.
     * @returns {object}
     */
    function getNowGameStatus() {
        const screen = getNowScreen();
        if (screen.screen !== 'playing' && screen.screen !== 'paused') {
            throw new Error('now_game_status is available only while playing or paused.');
        }
        const [player, opponent] = game.players;
        return {
            screen: screen.screen,
            playerCanControl: screen.playerCanControl,
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
                screen: { type: 'string', enum: ['main_menu', 'opponent_select', 'simulator', 'settings', 'countdown', 'playing', 'paused', 'game_over'] },
                playerCanControl: { type: 'boolean' }
            },
            required: ['screen', 'playerCanControl']
        };
        const puyoSchema = {
            type: 'object', properties: {
                x: { type: 'integer', description: 'Column from the left.' },
                y: { type: 'integer', description: 'Row from the bottom.' },
                color: { type: 'string', enum: [...COLORS, 'garbage'] }
            }, required: ['x', 'y', 'color']
        };
        const activeSchema = {
            type: ['object', 'null'], properties: {
                x: { type: 'integer' }, y: { type: 'integer' }, rotation: { type: 'integer', minimum: 0, maximum: 3 },
                colors: { type: 'array', items: { type: 'string', enum: COLORS }, minItems: 2, maxItems: 2 },
                cells: { type: 'array', items: puyoSchema, minItems: 2, maxItems: 2 }
            }
        };
        const playerSchema = {
            type: 'object', properties: {
                name: { type: 'string' },
                board: { type: 'object', properties: {
                    columns: { type: 'integer', const: COLUMNS }, rows: { type: 'integer', const: ROWS }, visibleRows: { type: 'integer', const: VISIBLE_ROWS },
                    puyos: { type: 'array', items: puyoSchema, description: 'All fixed puyos, including hidden rows.' }
                }, required: ['columns', 'rows', 'visibleRows', 'puyos'] },
                nextPairs: { type: 'array', items: { type: 'array', items: { type: 'string', enum: COLORS }, minItems: 2, maxItems: 2 } },
                warningPuyos: { type: 'array', items: { type: 'string' } }, active: activeSchema
            }, required: ['name', 'board', 'nextPairs', 'warningPuyos', 'active']
        };
        const statusSchema = {
            type: 'object',
            description: 'Both game fields, upcoming pairs, warning puyos, and the currently controlled pair. Board coordinates start at the bottom-left.',
            properties: {
                screen: { type: 'string', enum: ['playing', 'paused'] },
                playerCanControl: { type: 'boolean' }, player: playerSchema, opponent: playerSchema,
                recommendedPoint: { type: ['object', 'null'], properties: { x: { type: 'integer' }, y: { type: 'integer' } } }
            },
            required: ['screen', 'playerCanControl', 'player', 'opponent', 'recommendedPoint']
        };
        const tools = [
            {
                name: 'manual',
                description: 'Return English instructions for playing Puyo W and using the other available game tools.',
                inputSchema: emptyInput,
                execute: () => 'Puyo W is a falling-pair puzzle battle. During your control turn, use left/right to move, Z/X to rotate, and down to fall faster. Match four or more same-color puyos to clear them and send attacks. Use now_screen to learn which screen is visible, now_game_status only while playing or paused to inspect both boards and active pairs, and point_recommend during a controllable player turn to highlight one recommended board coordinate.'
            },
            {
                name: 'now_screen',
                description: 'Get the currently visible game screen. The JSON result states whether it is the main menu, opponent selection, countdown, play, pause, or game-over screen, and whether the human player can currently control a pair.',
                inputSchema: emptyInput,
                outputSchema: screenSchema,
                execute: getNowScreen
            },
            {
                name: 'now_game_status',
                description: 'Get complete JSON game state only while the match is playing or paused: every placed puyo on both boards, upcoming pairs, warning puyos, and both active pairs with coordinates.',
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
        window.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('keyup', handleKeyup);
        canvas.removeEventListener('click', handleCanvasClick);
        canvas.removeEventListener('pointerdown', handleVirtualPointerDown);
        canvas.removeEventListener('pointermove', handleVirtualPointerMove);
        canvas.removeEventListener('pointerup', handleVirtualPointerUp);
        canvas.removeEventListener('pointercancel', handleVirtualPointerUp);
        resetVirtualControllerInput();
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
        if (webMcpAbortController) webMcpAbortController.abort();
        if (createdCanvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        canvas = null;
        context = null;
        game = null;
        simulator = null;
        settingsDraft = null;
        recommendedPoint = null;
        createdCanvas = false;
        animationFrameId = null;
        webMcpAbortController = null;
        initialized = false;
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
        languageCode = navigator.language || navigator.userLanguage || 'ko';
        if (languageCode === 'ko-KR') languageCode = 'ko';
        loadStore();
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
        initialized = true;
        window.addEventListener('keydown', handleKeydown);
        window.addEventListener('keyup', handleKeyup);
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('pointerdown', handleVirtualPointerDown);
        canvas.addEventListener('pointermove', handleVirtualPointerMove);
        canvas.addEventListener('pointerup', handleVirtualPointerUp);
        canvas.addEventListener('pointercancel', handleVirtualPointerUp);
        prepareSoundPools();
        registerWebMcpTools();
        loadNotice();
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


        constructor() { super(); }
    }

    /**
     * 사운드 풀 객체를 생성한다.
     * @param {boolean} commons 공통 시스템용 사운드 풀 생성 여부
     * @returns {SoundPool|CommonSoundPool} 새 사운드 풀 객체
     */
    function createSoundPool(commons) {
        if (commons) return new CommonSoundPool();
        return new SoundPool();
    }

    // Enemy 계층은 파일 하단에 모아 확장 지점을 한곳에서 확인할 수 있게 한다.
    /**
     * 자동 플레이어의 이동 목표를 결정하는 확장 지점이다.
     */
    class Enemy {
        /** 이 적이 연쇄 시 재생되는 효과음들을 담은 사운드풀 @type {SoundPool} */
        soundPool = null;
        constructor() {
            this.sortPriority = 1;
            this.hidden = false;
            this.notAvail = false;
            // 이 좌표에 뿌요가 있으면 AI는 일반 쌓기 대신 공격력 시뮬레이션을 우선한다.
            this.attackSimulationTriggerPosition = { x: 2, y: 8 };
            this.soundPool = createSoundPool(false);
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
            // 조작 중인 뿌요가 없으면 이번 턴에 평가할 후보도 없다.
            if (!player.active) {
                player.aiSimulations = [];
                return;
            }
            const simulations = [];
            // 모든 회전 상태와 열을 순회하며 실제로 착지 가능한 후보를 만든다.
            for (let rotation = 0; rotation < 4; rotation += 1) {
                for (let x = 0; x < COLUMNS; x += 1) {
                    const placement = findLandingPlacement(player, x, rotation);
                    // 벽이나 쌓인 뿌요 때문에 놓을 수 없는 후보는 제외한다.
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
            return delay !== null && player.aiDecisionElapsed >= delay;
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

        /**
         * 안드로말리우스 적 정의
         */
    class Andromalius extends Enemy {
        constructor() {
            super();
            this.phase = 'initialLeft';
            this.turnsRemaining = this.randomTurns();
            this.attackPlacement = null;
        }

        /**
         * 일반 배치 턴 수를 정한다.
         * @returns {number} 6부터 8 사이의 일반 배치 턴 수
         */
        randomTurns() {
            return 6 + Math.floor(Math.random() * 3);
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
            // 중앙이 높이 쌓였거나 시뮬레이션 단계면 최대 공격 위치를 선택한다.
            const trigger = this.attackSimulationTriggerPosition;
            const triggerOccupied = player.board[trigger.y][trigger.x] !== null;
            if (triggerOccupied || this.phase === 'simulation' || player.damage >= AI_ATTACK_SIMULATION_DAMAGE_THRESHOLD) {
                this.attackPlacement = findBestAttackPlacement(player, 0, triggerOccupied ? trigger.x : null);
                this.phase = 'repeatLeft';
                if (!triggerOccupied) this.turnsRemaining = 6;
                return this.attackPlacement.x;
            }

            this.attackPlacement = null;
            const target = this.phase === 'initialRight' ? COLUMNS - 1 : 0;
            this.turnsRemaining -= 1;
            // 현재 방향으로 충분히 쌓았으면 다음 배치 단계를 준비한다.
            if (this.turnsRemaining === 0) {
                if (this.phase === 'initialLeft') {
                    this.phase = 'initialRight';
                    this.turnsRemaining = this.randomTurns();
                } else {
                    this.phase = 'simulation';
                }
            }
            return target;
        }

        /** 공격력 시뮬레이션 단계에서는 최고 공격 후보가 요구하는 회전을 사용한다. @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 목표 회전값 */
        chooseRotate(player) {
            return this.attackPlacement ? this.attackPlacement.rotation : super.chooseRotate(player);
        }

        /**
         * 안드로말리우스 외형 - 갑각형 악마 모습을 그린다.
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
    class Dantalion extends Enemy {
        /**
         * @returns {string} 적 이름
         */
        getName() {
            return '단탈리온';
        }

        constructor() {
            super();
            this.sortPriority = 2;
            this.turnCount = 0;
            this.turnsUntilSimulation = this.randomTurnsUntilSimulation();
            this.attackPlacement = null;
        }

        /**
         * 다음 공격 시뮬레이션 전까지 우측 또는 좌측으로 쌓을 턴 수를 구한다.
         * @returns {number} 10부터 15 사이의 일반 배치 턴 수
         */
        randomTurnsUntilSimulation() {
            return 10 + Math.floor(Math.random() * 6);
        }

        /**
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {number} 목표 X 좌표
         */
        chooseTarget(player) {
            // 중앙이 위험 높이에 도달하면 즉시 공격력이 최대인 열을 찾는다.
            const trigger = this.attackSimulationTriggerPosition;
            const triggerOccupied = player.board[trigger.y][trigger.x] !== null;
            if (triggerOccupied || player.damage >= AI_ATTACK_SIMULATION_DAMAGE_THRESHOLD) {
                this.attackPlacement = findBestAttackPlacement(player, 0, triggerOccupied ? trigger.x : null);
                return this.attackPlacement.x;
            }
            this.turnCount += 1;
            const stackDirection = COLUMNS - 1;
            if (this.turnCount <= this.turnsUntilSimulation || !player.active) {
                this.attackPlacement = null;
                return stackDirection;
            }

            this.attackPlacement = findBestAttackPlacement(player, stackDirection);
            this.turnCount = 0;
            this.turnsUntilSimulation = this.randomTurnsUntilSimulation();
            return this.attackPlacement.x;
        }

        /** 공격력 시뮬레이션 단계에서는 최고 공격 후보가 요구하는 회전을 사용한다. @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 목표 회전값 */
        chooseRotate(player) {
            return this.attackPlacement ? this.attackPlacement.rotation : super.chooseRotate(player);
        }

        /**
         * 가상의 인간형 몬스터 단탈리온을 캔버스 도형으로 그린다.
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
     * 세레는 필드 여유에 따라 연쇄를 모으거나 즉시 공격하는 예지의 악마다.
     */
    class Seere extends Enemy {
        constructor() {
            super();
            this.sortPriority = 3;
            this.notAvail = false;
            this.attackPlacement = null;
        }

        /**
         * @returns {string} 적 이름
         */
        getName() {
            return '세레';
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
     * 데카라비아는 세레의 연쇄 축적 전략에 두 예고쌍 평가와 싹쓸이 우선을 더한 적이다.
     */
    class Decarabia extends Seere {
        constructor() {
            super();
            this.sortPriority = 4;
            this.notAvail = false;
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
         * 박쥐 날개와 별 장식을 가진 데카라비아의 일반·위기·패배 표정을 그린다.
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
     * 벨리알은 추후 정식 AI를 추가할 예정인 출시 예정 적이다.
     */
    class Belial extends Enemy {
        constructor() {
            super();
            this.sortPriority = 5;
            this.notAvail = true;
        }

        /** @returns {string} 적 이름 */
        getName() {
            return '벨리알';
        }

        /**
         * TODO: 벨리알 정식 출시 시 고유한 AI 알고리즘을 구현한다.
         * 현재는 생성된 열과 세로 상태를 유지해 아무 조작 없이 자연 낙하한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {number} 목표 X 좌표
         */
        chooseTarget(player) {
            return player.active ? player.active.x : 2;
        }

        /** @param {PlayerState} player 자동 조작할 플레이어 @returns {number} 목표 회전값 */
        chooseRotate(player) {
            return 0;
        }

        /**
         * TODO: 벨리알 정식 출시 시 고유한 AI가 빠른 하강 정책도 결정한다.
         * @param {PlayerState} player 자동 조작할 플레이어
         * @returns {boolean} 빠른 하강 사용 여부
         */
        useFastDown(player) {
            return false;
        }

        /**
         * 왕관과 망토를 두른 벨리알의 일반·위기·패배 표정을 그린다.
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
     * 연습 모드에서 조작하거나 뿌요를 받지 않는 상대다.
     */
    class PracticeEnemy extends Enemy {
        /**
         * @returns {string} 적 이름
         */
        getName() {
            return translate('연습 상대');
        }
    }


    // 공통 사운드 풀은 외부에서 initialize 호출 전에 음원 URL을 설정할 수 있도록 미리 만든다.
    prepareSoundPools();

    // 기본 적은 모든 함수 선언이 준비된 뒤 등록해 초기화 순서를 명확히 한다.
    OPPONENTS.push(
        createOpponentEntry(() => new Andromalius()),
        createOpponentEntry(() => new Dantalion()),
        createOpponentEntry(() => new Seere()),
        createOpponentEntry(() => new Decarabia()),
        createOpponentEntry(() => new Belial())
    );

    WebPuyo = {
        Enemy,
        SoundPool,
        CommonSoundPool,
        registerOpponent,
        registerLanguage,
        setNoticeFile,
        getSelectedDifficulty,
        getSelectedColorCount,
        getNextPairs,
        initialize,
        destroy,
        get commonSoundPool() { return commonSoundPool; }
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = WebPuyo;
    if (typeof window !== 'undefined') window.WebPuyo = WebPuyo;
})();
