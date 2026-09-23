/*
    뿌요 W 리플레이 재생 도구

        Copyright 2026 HJOW

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    이 파일은 replay.html 전용이다. 게임 페이지(puyow.html)는 이 파일을 읽지 않는다.
    리플레이 재생 자체는 puyow.js 의 재생 코드를 그대로 쓰고, 이 파일은 PuyoW.replay API 로
    리플레이 데이터를 넘기고 재생 상태를 읽어 하단 툴바·우측 사이드바·JSON 입력 팝업과 WebMCP 도구를 다룬다.
*/
(function () {
    'use strict';

    /** 리플레이 목록 파일 이름이다. puyow.js 와 같은 경로에 둔다. @type {string} */
    const REPLAY_LIST_FILE_NAME = 'replays.json';
    /** 하단 툴바 높이를 정하는 CSS 변수 이름이다. 게임 캔버스의 아래 여백으로도 쓴다. @type {string} */
    const TOOLBAR_HEIGHT_VARIABLE = '--replay-toolbar-height';
    /** 지원 언어 코드다. 이 밖의 언어는 기본 언어(영어)로 보인다. @type {string[]} */
    const SUPPORTED_LANGUAGES = ['en', 'ko', 'ja', 'zh', 'de', 'fr'];
    /** 기본 언어다. 영어 원문이 번역 키이므로 영어 번역표는 따로 두지 않는다. @type {string} */
    const DEFAULT_LANGUAGE = 'en';

    /**
     * 이 페이지 문구의 번역표다. 게임 번역표(한국어 원문 키)와 섞지 않고 영어 원문을 키로 쓴다.
     * 기본 언어인 영어는 원문을 그대로 쓰며, 번역이 없는 문구도 영어 원문으로 보인다. 새 문구는 다섯 언어에 모두 넣는다.
     * @type {Record<string, Record<string, string>>}
     */
    const REPLAY_STRINGS = {
        ko: {
            'Load JSON': 'JSON 불러오기',
            'Load from List': '목록에서 불러오기',
            'Pause': '일시중지',
            'Restart': '처음부터',
            'Back to game': '게임으로 돌아가기',
            'Replay List': '리플레이 목록',
            'Close': '닫기',
            'Load Replay JSON': '리플레이 JSON 불러오기',
            'Paste the replay JSON code.': '리플레이 JSON 코드를 붙여넣어 주세요.',
            'OK': '확인',
            'Cancel': '취소',
            'Enter the JSON code.': 'JSON 코드를 입력해 주세요.',
            'The replay data is invalid.': '리플레이 데이터가 올바르지 않습니다.',
            'Loading the list...': '목록을 불러오는 중...',
            'There are no replays to load.': '불러올 수 있는 리플레이가 없습니다.',
            'Unknown replay': '알 수 없는 리플레이',
            'Load a replay with Load JSON or Load from List.': 'JSON 불러오기 또는 목록에서 불러오기로 리플레이를 불러와 주세요.',
            'Standard Rules': '기본 룰',
            'FEVER Rules': '피버 룰',
            'FEVER Rules (Start)': '피버 룰 (시작)',
            'FEVER (Relaxed)': '피버 (완화)',
            '%1 Colors': '%1색',
            'Watch': '구경',
            'Play Together': '너랑 나랑'
        },
        ja: {
            'Load JSON': 'JSONを読み込む',
            'Load from List': 'リストから読み込む',
            'Pause': '一時停止',
            'Restart': '最初から',
            'Back to game': 'ゲームに戻る',
            'Replay List': 'リプレイ一覧',
            'Close': '閉じる',
            'Load Replay JSON': 'リプレイJSONを読み込む',
            'Paste the replay JSON code.': 'リプレイのJSONコードを貼り付けてください。',
            'OK': 'OK',
            'Cancel': 'キャンセル',
            'Enter the JSON code.': 'JSONコードを入力してください。',
            'The replay data is invalid.': 'リプレイデータが正しくありません。',
            'Loading the list...': '一覧を読み込み中...',
            'There are no replays to load.': '読み込めるリプレイがありません。',
            'Unknown replay': '不明なリプレイ',
            'Load a replay with Load JSON or Load from List.': '「JSONを読み込む」または「リストから読み込む」でリプレイを読み込んでください。',
            'Standard Rules': '基本ルール',
            'FEVER Rules': 'FEVERルール',
            'FEVER Rules (Start)': 'FEVER ルール (開始)',
            'FEVER (Relaxed)': 'FEVER（緩和）',
            '%1 Colors': '%1色',
            'Watch': '観戦',
            'Play Together': '二人プレイ'
        },
        zh: {
            'Load JSON': '加载JSON',
            'Load from List': '从列表加载',
            'Pause': '暂停',
            'Restart': '从头播放',
            'Back to game': '返回游戏',
            'Replay List': '回放列表',
            'Close': '关闭',
            'Load Replay JSON': '加载回放JSON',
            'Paste the replay JSON code.': '请粘贴回放JSON代码。',
            'OK': '确定',
            'Cancel': '取消',
            'Enter the JSON code.': '请输入JSON代码。',
            'The replay data is invalid.': '回放数据不正确。',
            'Loading the list...': '正在加载列表...',
            'There are no replays to load.': '没有可加载的回放。',
            'Unknown replay': '未知回放',
            'Load a replay with Load JSON or Load from List.': '请通过“加载JSON”或“从列表加载”加载回放。',
            'Standard Rules': '基本规则',
            'FEVER Rules': 'FEVER规则',
            'FEVER Rules (Start)': 'FEVER 规则（开始）',
            'FEVER (Relaxed)': 'FEVER（缓和）',
            '%1 Colors': '%1色',
            'Watch': '观战',
            'Play Together': '双人对战'
        },
        de: {
            'Load JSON': 'JSON laden',
            'Load from List': 'Aus Liste laden',
            'Pause': 'Pause',
            'Restart': 'Von vorn',
            'Back to game': 'Zurück zum Spiel',
            'Replay List': 'Wiederholungsliste',
            'Close': 'Schließen',
            'Load Replay JSON': 'Wiederholungs-JSON laden',
            'Paste the replay JSON code.': 'Füge den JSON-Code der Wiederholung ein.',
            'OK': 'OK',
            'Cancel': 'Abbrechen',
            'Enter the JSON code.': 'Gib den JSON-Code ein.',
            'The replay data is invalid.': 'Die Wiederholungsdaten sind ungültig.',
            'Loading the list...': 'Liste wird geladen...',
            'There are no replays to load.': 'Keine Wiederholungen zum Laden vorhanden.',
            'Unknown replay': 'Unbekannte Wiederholung',
            'Load a replay with Load JSON or Load from List.': 'Lade eine Wiederholung über „JSON laden“ oder „Aus Liste laden“.',
            'Standard Rules': 'Standardregeln',
            'FEVER Rules': 'FEVER-Regeln',
            'FEVER Rules (Start)': 'FEVER-Regeln (Start)',
            'FEVER (Relaxed)': 'FEVER (Entspannt)',
            '%1 Colors': '%1 Farben',
            'Watch': 'Zuschauen',
            'Play Together': 'Zusammen spielen'
        },
        fr: {
            'Load JSON': 'Charger le JSON',
            'Load from List': 'Charger depuis la liste',
            'Pause': 'Pause',
            'Restart': 'Recommencer',
            'Back to game': 'Retour au jeu',
            'Replay List': 'Liste des reprises',
            'Close': 'Fermer',
            'Load Replay JSON': 'Charger le JSON de la reprise',
            'Paste the replay JSON code.': 'Collez le code JSON de la reprise.',
            'OK': 'OK',
            'Cancel': 'Annuler',
            'Enter the JSON code.': 'Saisissez le code JSON.',
            'The replay data is invalid.': 'Les données de la reprise sont invalides.',
            'Loading the list...': 'Chargement de la liste...',
            'There are no replays to load.': 'Aucune reprise à charger.',
            'Unknown replay': 'Reprise inconnue',
            'Load a replay with Load JSON or Load from List.': 'Chargez une reprise avec « Charger le JSON » ou « Charger depuis la liste ».',
            'Standard Rules': 'Règles standard',
            'FEVER Rules': 'Règles FEVER',
            'FEVER Rules (Start)': 'Règles FEVER (Début)',
            'FEVER (Relaxed)': 'FEVER (adouci)',
            '%1 Colors': '%1 couleurs',
            'Watch': 'Regarder',
            'Play Together': 'Jouer à deux'
        }
    };

    /** 리플레이 meta.rule 값별 룰 이름(영어 원문 번역 키)이다. 게임 화면의 룰 이름과 같은 말을 쓴다. @type {Record<string, string>} */
    const RULE_LABELS = {
        standard: 'Standard Rules',
        fever: 'FEVER Rules',
        feverStart: 'FEVER Rules (Start)',
        relaxedFever: 'FEVER (Relaxed)'
    };

    /** puyow_replay.js 가 읽힌 주소다. puyow.js 스크립트 태그를 찾지 못했을 때 목록 파일 경로의 기준으로 쓴다. @type {string} */
    const currentScriptURL = document.currentScript?.src || '';

    let initialized = false;
    /** 화면 요소 모음이다. @type {Record<string, HTMLElement>|null} */
    let elements = null;
    /** 현재 페이지 문구 언어다. @type {string} */
    let pageLanguage = DEFAULT_LANGUAGE;
    /**
     * 마지막으로 불러오기에 성공한 리플레이다. 리플레이 페이지에서는 종료 버튼이 없어 재생 게임이 사라지지 않지만,
     * 혹시 게임이 비워진 경우에도 "처음부터"로 다시 재생할 수 있게 보관한다.
     * @type {string|object|null}
     */
    let lastReplayData = null;
    /** 불러온 리플레이 목록이다. 읽기에 성공한 뒤에만 채우고 그 뒤로는 다시 읽지 않는다. @type {unknown[]|null} */
    let replayList = null;
    /** 진행 중인 목록 읽기 작업이다. @type {Promise<unknown[]>|null} */
    let replayListRequest = null;
    /** 마지막 목록 읽기가 실패했는지 여부다. WebMCP 결과에 함께 알린다. @type {boolean} */
    let replayListFailed = false;
    /** 마지막으로 툴바에 반영한 버튼 상태다. 매 프레임 같은 값을 다시 쓰지 않으려고 둔다. @type {{pause:boolean, restart:boolean}|null} */
    let appliedButtonState = null;
    /** WebMCP 도구 등록을 한 번에 해제할 컨트롤러다. @type {AbortController|null} */
    let mcpAbortController = null;

    /** 게임 API 를 반환한다. @returns {any} window.PuyoW */
    function getGameApi() {
        return window.PuyoW;
    }

    /**
     * 언어 값을 지원 언어 코드로 바꾼다. 지원하지 않으면 null 이다.
     * @param {unknown} value 언어 값(ko-KR 처럼 지역이 붙어도 된다)
     * @returns {string|null} 지원 언어 코드
     */
    function normalizeLanguage(value) {
        const code = typeof value === 'string' ? value.trim().slice(0, 2).toLowerCase() : '';
        return SUPPORTED_LANGUAGES.includes(code) ? code : null;
    }

    /**
     * 페이지 문구 언어를 정한다. 캔버스와 말이 어긋나지 않도록 게임 화면 언어(설정값, 없으면 브라우저 언어)를 따르고,
     * 게임 초기화 전이거나 지원하지 않는 언어면 브라우저 언어, 그것도 아니면 기본 언어(영어)를 쓴다.
     * @returns {string} 언어 코드
     */
    function detectLanguage() {
        let gameLanguage = null;
        try {
            gameLanguage = getGameApi()?.replay?.getLanguage?.();
        } catch (error) {
            gameLanguage = null;
        }
        const browserLanguage = typeof navigator !== 'undefined' ? (navigator.language || navigator.userLanguage) : '';
        return normalizeLanguage(gameLanguage) || normalizeLanguage(browserLanguage) || DEFAULT_LANGUAGE;
    }

    /**
     * 이 페이지 문구(영어 원문 키)를 현재 언어로 번역하고 %1, %2 를 채운다.
     * @param {string} text 영어 원문
     * @param {...(string|number)} values 치환할 값
     * @returns {string} 표시할 문구
     */
    function translate(text, ...values) {
        const translated = REPLAY_STRINGS[pageLanguage]?.[text] || text;
        return values.reduce((result, value, index) => result.replace(`%${index + 1}`, String(value)), translated);
    }

    /**
     * 리플레이에 기록된 플레이어 이름을 게임 번역표로 번역한다. 적 이름은 게임 데이터(한국어 원문)라 게임 번역표에만 있다.
     * 사람 플레이어 이름처럼 번역표에 없는 값은 그대로 돌려준다.
     * @param {string} name 기록된 이름
     * @returns {string} 표시할 이름
     */
    function translatePlayerName(name) {
        const api = getGameApi();
        return typeof api?.translate === 'function' ? api.translate(name) : name;
    }

    /** data-replay-text·data-replay-label 이 붙은 요소의 문구를 현재 언어로 다시 적는다. @returns {void} */
    function applyPageTexts() {
        pageLanguage = detectLanguage();
        document.documentElement.lang = pageLanguage;
        document.querySelectorAll('[data-replay-text]').forEach((element) => {
            element.textContent = translate(element.getAttribute('data-replay-text'));
        });
        document.querySelectorAll('[data-replay-label]').forEach((element) => {
            element.setAttribute('aria-label', translate(element.getAttribute('data-replay-label')));
        });
        // 이미 그린 목록도 룰 이름·적 이름을 새 언어로 다시 그린다.
        if (replayList && !elements.sidebar.hidden) renderReplayList(replayList);
    }

    /** 게임 화면 언어가 바뀌었으면 페이지 문구도 다시 적는다. @returns {void} */
    function refreshLanguageIfChanged() {
        if (detectLanguage() !== pageLanguage) applyPageTexts();
    }

    /**
     * 오류 메시지 칸에 문구를 보이거나 숨긴다.
     * @param {HTMLElement} element 메시지 칸
     * @param {string|null} message 보일 문구. null 이면 숨긴다.
     * @returns {void}
     */
    function setMessage(element, message) {
        element.textContent = message || '';
        element.hidden = !message;
    }

    /**
     * 리플레이 불러오기를 시도한다. 성공하면 곧바로 재생(3초 카운트다운 포함)을 시작한다.
     * @param {string|object} data 리플레이 JSON 문자열 또는 그 객체
     * @returns {boolean} 성공 여부
     */
    function loadReplay(data) {
        let loaded = false;
        try {
            loaded = getGameApi().replay.load(data) === true;
        } catch (error) {
            console.error('리플레이를 불러오지 못했습니다.', error);
            loaded = false;
        }
        if (loaded) {
            lastReplayData = data;
            syncToolbarButtons();
        }
        return loaded;
    }

    /** 게임의 리플레이 재생 상태를 읽는다. 읽지 못하면 null 이다. @returns {object|null} 재생 상태 */
    function readPlaybackState() {
        try {
            return getGameApi()?.replay?.getState?.() || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * 툴바 버튼의 사용 가능 여부를 계산한다.
     * @param {object|null} state readPlaybackState() 결과
     * @returns {{pause:boolean, restart:boolean}} 버튼별 사용 가능 여부
     */
    function getToolbarButtonState(state) {
        const loaded = Boolean(state?.loaded);
        return {
            // 카운트다운 중에도 버튼은 켜 두고, 누르면 아무 일도 하지 않는다(게임 쪽 pause() 가 거절한다).
            pause: loaded && state.running && !state.paused && !state.restartPending,
            // 게임이 비워졌더라도 마지막으로 불러온 리플레이가 있으면 다시 재생할 수 있다.
            restart: (loaded && !state.restartPending) || (!loaded && lastReplayData !== null)
        };
    }

    /** 현재 재생 상태에 맞춰 캔버스 표시 여부와 "일시중지"·"처음부터" 버튼의 사용 가능 여부를 맞춘다. @returns {void} */
    function syncToolbarButtons() {
        if (!elements) return;
        const state = readPlaybackState();
        const loaded = Boolean(state?.loaded);
        // 리플레이를 불러오기 전에는 게임 캔버스(초기 화면)를 숨기고 안내 문구를 보인다.
        if (document.body.classList.contains('replay-empty') === loaded) document.body.classList.toggle('replay-empty', !loaded);
        const next = getToolbarButtonState(state);
        if (appliedButtonState && appliedButtonState.pause === next.pause && appliedButtonState.restart === next.restart) return;
        appliedButtonState = next;
        elements.pauseButton.disabled = !next.pause;
        elements.restartButton.disabled = !next.restart;
    }

    /** "일시중지" 버튼 동작. 게임 중 ESC 를 누른 것처럼 일시정지한다. @returns {boolean} 일시정지했는지 여부 */
    function pauseReplay() {
        const paused = getGameApi().replay.pause();
        // 일시정지하면 바로 버튼을 끈다. 재개는 게임 일시정지 화면의 재개 버튼으로 하며, 그때 다시 켜진다.
        if (paused) syncToolbarButtons();
        return paused;
    }

    /** 일시정지 화면의 "재개" 버튼과 같은 동작이다(WebMCP 전용). @returns {boolean} 재개했는지 여부 */
    function resumeReplay() {
        const resumed = getGameApi().replay.resume();
        if (resumed) syncToolbarButtons();
        return resumed;
    }

    /** "처음부터" 버튼 동작. 재생을 멈추고 카운트다운부터 다시 재생한다. @returns {boolean} 다시 재생을 시작했는지 여부 */
    function restartReplay() {
        const api = getGameApi();
        let restarted = false;
        if (api.replay.getState().loaded) {
            restarted = api.replay.restart();
        } else if (lastReplayData !== null) {
            restarted = loadReplay(lastReplayData);
        }
        syncToolbarButtons();
        return restarted;
    }

    /* ---------------- JSON 입력 레이어 팝업 ---------------- */

    /** JSON 입력 팝업을 연다. @returns {void} */
    function openJsonDialog() {
        closeSidebar();
        setMessage(elements.dialogMessage, null);
        elements.dialog.hidden = false;
        elements.dialogInput.focus();
        elements.dialogInput.select();
    }

    /** JSON 입력 팝업을 닫는다. @returns {void} */
    function closeJsonDialog() {
        if (elements.dialog.hidden) return;
        elements.dialog.hidden = true;
        setMessage(elements.dialogMessage, null);
        // 팝업을 닫은 뒤에는 키 입력이 다시 게임(일시정지 메뉴 등)으로 가도록 포커스를 문서로 돌린다.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }

    /** 팝업의 "확인" 동작. 입력한 JSON 으로 불러오기를 시도하고, 실패하면 팝업 안에 바로 알린다. @returns {void} */
    function confirmJsonDialog() {
        const text = elements.dialogInput.value.trim();
        if (!text) {
            setMessage(elements.dialogMessage, translate('Enter the JSON code.'));
            elements.dialogInput.focus();
            return;
        }
        if (!loadReplay(text)) {
            setMessage(elements.dialogMessage, translate('The replay data is invalid.'));
            elements.dialogInput.focus();
            return;
        }
        closeJsonDialog();
    }

    /* ---------------- 우측 사이드바(리플레이 목록) ---------------- */

    /** 리플레이 목록 파일 주소를 구한다. puyow.js 와 같은 경로의 replays.json 이다. @returns {string} 목록 파일 주소 */
    function getReplayListURL() {
        const gameScript = Array.from(document.querySelectorAll('script[src]'))
            .find((script) => /(^|\/)puyow\.js(\?|#|$)/.test(script.getAttribute('src') || ''));
        const base = gameScript?.src || currentScriptURL || document.baseURI;
        return new URL(REPLAY_LIST_FILE_NAME, base).href;
    }

    /**
     * 리플레이 목록을 읽는다. 읽기·JSON 해석에 실패하거나 배열이 아니면 오류를 기록하고 빈 목록을 돌려준다.
     * @returns {Promise<unknown[]>} 리플레이 목록
     */
    function fetchReplayList() {
        if (replayList) return Promise.resolve(replayList);
        if (replayListRequest) return replayListRequest;
        replayListRequest = fetch(getReplayListURL(), { cache: 'no-cache' })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then((text) => {
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed)) throw new TypeError('리플레이 목록이 배열이 아닙니다.');
                replayList = parsed;
                replayListFailed = false;
                return parsed;
            })
            .catch((error) => {
                console.error('리플레이 목록을 불러오지 못했습니다.', error);
                // 실패한 목록은 보관하지 않아 다음에 사이드바를 열 때 다시 읽는다.
                replayListFailed = true;
                return [];
            })
            .finally(() => { replayListRequest = null; });
        return replayListRequest;
    }

    /**
     * 리플레이 JSON 컨텐츠에서 meta 객체를 꺼낸다.
     * @param {unknown} replay 리플레이 JSON 컨텐츠
     * @returns {object|null} meta. 없으면 null
     */
    function getReplayMeta(replay) {
        const meta = replay && typeof replay === 'object' && !Array.isArray(replay) ? replay.meta : null;
        return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : null;
    }

    /**
     * 목록에 보일 리플레이 대표 정보(룰·색상 수와 대전 상대)를 만든다.
     * @param {unknown} replay 리플레이 JSON 컨텐츠
     * @returns {{title:string, sub:string}} 제목 줄과 보조 줄
     */
    function describeReplay(replay) {
        const meta = getReplayMeta(replay);
        if (!meta) return { title: translate('Unknown replay'), sub: '' };
        const parts = [];
        const ruleKey = typeof meta.rule === 'string' ? meta.rule : 'standard';
        parts.push(RULE_LABELS[ruleKey] ? translate(RULE_LABELS[ruleKey]) : ruleKey);
        if (Array.isArray(meta.colors)) parts.push(translate('%1 Colors', meta.colors.length));
        if (meta.watch === true) parts.push(translate('Watch'));
        if (meta.together === true) parts.push(translate('Play Together'));
        const names = Array.isArray(meta.players)
            ? meta.players.map((player) => (player && typeof player.name === 'string' ? translatePlayerName(player.name) : '?'))
            : [];
        return { title: parts.join(' · '), sub: names.length ? names.join(' vs ') : '' };
    }

    /**
     * 사이드바 목록을 그린다.
     * @param {unknown[]} list 리플레이 목록
     * @returns {void}
     */
    function renderReplayList(list) {
        elements.list.replaceChildren();
        list.forEach((replay, index) => {
            const info = describeReplay(replay);
            const item = document.createElement('li');
            item.className = 'replay-list-item';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'replay-list-button';
            const number = document.createElement('span');
            number.className = 'replay-list-number';
            number.textContent = `${index + 1}.`;
            const body = document.createElement('span');
            body.className = 'replay-list-body';
            const title = document.createElement('span');
            title.className = 'replay-list-title';
            title.textContent = info.title;
            body.append(title);
            if (info.sub) {
                const sub = document.createElement('span');
                sub.className = 'replay-list-sub';
                sub.textContent = info.sub;
                sub.title = info.sub;
                body.append(document.createElement('br'), sub);
            }
            button.append(number, body);
            button.addEventListener('click', () => selectReplayFromList(index));
            item.append(button);
            elements.list.append(item);
        });
        elements.status.textContent = list.length ? '' : translate('There are no replays to load.');
        elements.status.hidden = list.length > 0;
    }

    /**
     * 목록에서 고른 리플레이를 불러온다. 실패하면 사이드바가 열려 있을 때 알리고, 성공하면 사이드바를 닫는다.
     * @param {number} index 목록 순번(0부터)
     * @returns {boolean} 성공 여부
     */
    function selectReplayFromList(index) {
        if (!replayList || !(index in replayList)) return false;
        if (!loadReplay(replayList[index])) {
            if (!elements.sidebar.hidden) setMessage(elements.sidebarMessage, `${index + 1}. ${translate('The replay data is invalid.')}`);
            return false;
        }
        closeSidebar();
        return true;
    }

    /** 우측 사이드바를 열고 리플레이 목록을 읽어 보인다. @returns {Promise<void>} 목록을 그린 뒤 끝나는 작업 */
    function openSidebar() {
        closeJsonDialog();
        setMessage(elements.sidebarMessage, null);
        elements.sidebar.hidden = false;
        if (replayList) {
            renderReplayList(replayList);
            return Promise.resolve();
        }
        elements.list.replaceChildren();
        elements.status.textContent = translate('Loading the list...');
        elements.status.hidden = false;
        return fetchReplayList().then((list) => {
            if (!elements.sidebar.hidden) renderReplayList(list);
        });
    }

    /** 우측 사이드바를 닫는다. @returns {void} */
    function closeSidebar() {
        if (elements.sidebar.hidden) return;
        const hadFocus = elements.sidebar.contains(document.activeElement);
        elements.sidebar.hidden = true;
        setMessage(elements.sidebarMessage, null);
        if (hadFocus && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }

    /* ---------------- 이벤트 ---------------- */

    /**
     * 툴바·사이드바·팝업의 클릭을 처리한다.
     * @param {MouseEvent} event 클릭 이벤트
     * @returns {void}
     */
    function handleActionClick(event) {
        const button = event.target instanceof Element ? event.target.closest('[data-replay-action]') : null;
        if (!button || button.disabled) return;
        // 마우스로 누른 툴바 버튼에 포커스가 남으면 이후 키 입력이 게임으로 가지 않으므로 포커스를 푼다.
        if (event.detail > 0 && button.closest('.replay-toolbar')) button.blur();
        const action = button.getAttribute('data-replay-action');
        if (action === 'json') openJsonDialog();
        else if (action === 'list') openSidebar();
        else if (action === 'pause') pauseReplay();
        else if (action === 'restart') restartReplay();
        else if (action === 'close-list') closeSidebar();
        else if (action === 'dialog-confirm') confirmJsonDialog();
        else if (action === 'dialog-cancel') closeJsonDialog();
    }

    /**
     * 페이지 UI 안의 키 입력이 게임(window keydown)으로 넘어가지 않게 막는다.
     * 게임은 방향키·Enter·Space 등의 기본 동작을 막으므로, 그대로 두면 textarea 입력과 버튼 키보드 조작이 되지 않는다.
     * @param {KeyboardEvent} event 키보드 이벤트
     * @returns {void}
     */
    function handleUiKeydown(event) {
        event.stopPropagation();
        if (event.key === 'Escape') {
            if (!elements.dialog.hidden) closeJsonDialog();
            else closeSidebar();
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !elements.dialog.hidden) {
            event.preventDefault();
            confirmJsonDialog();
        }
    }

    /**
     * 페이지 UI 안의 키를 뗀 입력도 게임으로 넘기지 않는다. 게임이 방향키 뗌으로 빠른 하강을 멈추는 처리와 섞이지 않게 한다.
     * @param {KeyboardEvent} event 키보드 이벤트
     * @returns {void}
     */
    function handleUiKeyup(event) {
        event.stopPropagation();
    }

    /* ---------------- WebMCP ---------------- */

    /**
     * 리플레이의 대표 정보를 AI 가 읽을 구조로 만든다. 룰 이름은 번역하지 않은 영어 원문이다.
     * @param {unknown} replay 리플레이 JSON 컨텐츠
     * @returns {object|null} 대표 정보. meta 가 없으면 null
     */
    function summarizeReplay(replay) {
        const meta = getReplayMeta(replay);
        if (!meta) return null;
        const rule = typeof meta.rule === 'string' ? meta.rule : 'standard';
        const result = replay.result && typeof replay.result === 'object' ? replay.result : null;
        return {
            rule,
            ruleLabel: RULE_LABELS[rule] || rule,
            colorCount: Array.isArray(meta.colors) ? meta.colors.length : null,
            colors: Array.isArray(meta.colors) ? meta.colors.filter((color) => typeof color === 'string') : [],
            watch: meta.watch === true,
            together: meta.together === true,
            players: Array.isArray(meta.players)
                ? meta.players.map((player) => ({
                    name: player && typeof player.name === 'string' ? player.name : null,
                    controller: player && typeof player.controller === 'string' ? player.controller : null
                }))
                : [],
            winner: Number.isInteger(result?.winner) ? result.winner : null,
            durationMs: Number.isFinite(result?.elapsed) ? result.elapsed : null
        };
    }

    /** 지금 재생 중인 리플레이 JSON 을 객체로 읽는다. 없거나 해석하지 못하면 null 이다. @returns {object|null} 리플레이 */
    function readCurrentReplay() {
        let source = null;
        try {
            source = getGameApi().replay.getSource();
            return source ? JSON.parse(source) : null;
        } catch (error) {
            return null;
        }
    }

    /** 페이지에 열려 있는 패널을 돌려준다. @returns {'json'|'list'|'none'} 패널 이름 */
    function getOpenPanel() {
        if (!elements.dialog.hidden) return 'json';
        if (!elements.sidebar.hidden) return 'list';
        return 'none';
    }

    /** WebMCP replay_status 결과를 만든다. @returns {object} 페이지 상태 */
    function buildMcpStatus() {
        const state = readPlaybackState();
        const loaded = Boolean(state?.loaded);
        let phase = 'empty';
        if (loaded) {
            if (state.restartPending) phase = 'restarting';
            else if (state.finished) phase = 'finished';
            else if (state.paused) phase = 'paused';
            else if (state.countdown > 0) phase = 'countdown';
            else phase = 'playing';
        }
        const buttons = getToolbarButtonState(state);
        let screen = null;
        try {
            screen = getGameApi().getScreenState().screen;
        } catch (error) {
            screen = null;
        }
        return {
            phase,
            loaded,
            paused: Boolean(state?.paused),
            finished: Boolean(state?.finished),
            countdownMs: loaded ? Math.round(state.countdown) : 0,
            gameScreen: screen,
            canvasVisible: loaded,
            openPanel: getOpenPanel(),
            toolbar: { pauseEnabled: buttons.pause, restartEnabled: buttons.restart },
            language: pageLanguage,
            replay: loaded ? summarizeReplay(readCurrentReplay()) : null
        };
    }

    /** 성공한 동작 뒤 붙일 짧은 상태 문구다. @returns {string} 상태 문구 */
    function describeMcpPhase() {
        return `Current phase: ${buildMcpStatus().phase}.`;
    }

    /** 일시정지를 거절한 이유를 설명한다. @returns {string} 설명 */
    function explainPauseRefusal() {
        const status = buildMcpStatus();
        if (!status.loaded) return 'No replay is loaded, so there is nothing to pause.';
        if (status.phase === 'countdown') return 'The replay is still in its 3-second countdown, which cannot be paused (the Pause button does nothing then). Try again once the countdown ends.';
        if (status.phase === 'paused') return 'The replay is already paused.';
        if (status.phase === 'finished') return 'The replay has already finished; its result screen is showing.';
        return `The replay cannot be paused right now (phase: ${status.phase}).`;
    }

    /** WebMCP 도구 설명서다. @returns {string} 영어 설명 */
    function buildMcpManual() {
        return [
            'This is the Puyo W replay page. It plays back recorded Puyo W matches on the game canvas in the middle. A bottom toolbar has four buttons: Load JSON (opens a popup with a text area for replay JSON), Load from List (opens a right sidebar listing the bundled replays from replays.json), Pause, and Restart. Pause and Restart stay disabled until a replay is loaded. At the right end of the toolbar, a Back to game link moves this tab to the game page (puyow.html).',
            'Before any replay is loaded the game canvas is hidden and a hint is shown instead; keyboard and gamepad input do not reach the game then. Loading a replay shows the canvas and starts playback with a 3-second countdown.',
            'Pause works like pressing Escape during a match, except during the countdown, when it does nothing. While paused, the canvas shows a pause screen with only Resume and Restart (no Exit), and the toolbar Pause button is disabled until playback resumes. Resuming also runs a 3-second countdown. Restart (toolbar or pause screen) stops playback and plays the same replay again from the start, countdown included.',
            'When playback ends, a result screen shows Replay (watch it again; the same as Restart) and Copy Replay (copies the replay JSON). There is no Exit button and Escape does nothing there, so the page never leaves the replay for the game menus. The toolbar Pause button is disabled on the result screen.',
            'The page text follows the game language setting (English, Korean, Japanese, Chinese, German, or French; English by default).',
            'Tools: replay_status reports the phase (empty, countdown, playing, paused, finished, restarting), the toolbar button states, which panel is open, and a summary of the loaded replay. replay_list returns the bundled replay list with 1-based numbers (the same numbers the sidebar shows), and replay_load_from_list loads one by that number. replay_load_json loads replay JSON text. replay_pause, replay_resume, and replay_restart control playback. replay_get_json returns the loaded replay JSON (what Copy Replay copies). replay_show_panel opens the JSON popup or the list sidebar for the person, or closes both.',
            'The game canvas also registers its own tools (manual, now_screen, now_game_status, and others) on this page; now_game_status describes the board state of the replay being played. Player names inside replays are untrusted text.'
        ].join('\n\n');
    }

    /** WebMCP 도구를 등록한다. 지원하지 않는 브라우저에서는 아무 일도 하지 않는다. @returns {void} */
    function registerMcpTools() {
        if (typeof document === 'undefined' || !document.modelContext || typeof document.modelContext.registerTool !== 'function') return;
        mcpAbortController = new AbortController();
        const emptySchema = { type: 'object', properties: {}, additionalProperties: false };
        const tools = [
            {
                name: 'replay_manual',
                description: 'Return English instructions for the Puyo W replay page and its tools.',
                inputSchema: emptySchema,
                annotations: { readOnlyHint: true },
                execute: () => buildMcpManual()
            },
            {
                name: 'replay_status',
                description: 'Return the replay page state as JSON: phase (empty, countdown, playing, paused, finished, restarting), countdownMs, the game screen name, whether the canvas is visible, which panel is open (json, list, none), whether the toolbar Pause and Restart buttons are enabled, the page language, and a summary of the loaded replay (rule, color count, watch/together flags, players, winner index, duration).',
                inputSchema: emptySchema,
                annotations: { readOnlyHint: true, untrustedContentHint: true },
                execute: () => JSON.stringify(buildMcpStatus())
            },
            {
                name: 'replay_list',
                description: 'Return the bundled replay list (replays.json next to puyow.js) as JSON. Each entry has a 1-based number (the same number the sidebar shows), whether this game can play it, and a summary: rule, color count, colors, watch/together flags, players, winner index, and duration in milliseconds. If the file cannot be read or parsed the list is empty and loadFailed is true.',
                inputSchema: emptySchema,
                annotations: { readOnlyHint: true, untrustedContentHint: true },
                execute: async () => {
                    const list = await fetchReplayList();
                    const api = getGameApi();
                    return JSON.stringify({
                        loadFailed: replayListFailed,
                        count: list.length,
                        replays: list.map((replay, index) => {
                            let playable = false;
                            try { playable = api.replay.isValid(replay) === true; } catch (error) { playable = false; }
                            return { number: index + 1, playable, ...(summarizeReplay(replay) || { rule: null }) };
                        })
                    });
                }
            },
            {
                name: 'replay_load_from_list',
                description: 'Load a replay from the bundled list by its 1-based number (see replay_list) and start playing it from a 3-second countdown, the same as clicking it in the Load from List sidebar. The sidebar closes on success.',
                inputSchema: {
                    type: 'object',
                    properties: { number: { type: 'integer', minimum: 1, description: '1-based number of the replay in the list.' } },
                    required: ['number'],
                    additionalProperties: false
                },
                execute: async (input) => {
                    const number = input?.number;
                    if (!Number.isInteger(number) || number < 1) throw new Error('number must be a positive integer.');
                    const list = await fetchReplayList();
                    if (!list.length) return replayListFailed ? 'The replay list could not be loaded.' : 'The replay list is empty.';
                    if (number > list.length) throw new Error(`number must be between 1 and ${list.length}.`);
                    if (!selectReplayFromList(number - 1)) return `Replay ${number} could not be loaded because its data is invalid for this game.`;
                    return `Loaded replay ${number} and started playback from the countdown.`;
                }
            },
            {
                name: 'replay_load_json',
                description: 'Load replay JSON text (the text Copy Replay produces) and start playing it from a 3-second countdown, the same as pasting it into the Load JSON popup and pressing OK. The popup closes on success; on failure nothing changes.',
                inputSchema: {
                    type: 'object',
                    properties: { json: { type: 'string', description: 'Replay JSON text.' } },
                    required: ['json'],
                    additionalProperties: false
                },
                execute: (input) => {
                    const text = typeof input?.json === 'string' ? input.json.trim() : '';
                    if (!text) throw new Error('json must be a non-empty string.');
                    if (!loadReplay(text)) return 'The replay data is invalid, so nothing was loaded.';
                    closeJsonDialog();
                    return 'Loaded the replay and started playback from the countdown.';
                }
            },
            {
                name: 'replay_pause',
                description: 'Pause the replay, the same as the toolbar Pause button (like pressing Escape in a match). Refused during the 3-second countdown, while already paused, before a replay is loaded, and after playback has finished.',
                inputSchema: emptySchema,
                execute: () => (pauseReplay() ? 'Paused the replay.' : explainPauseRefusal())
            },
            {
                name: 'replay_resume',
                description: 'Resume a paused replay, the same as the Resume button on the pause screen. Playback continues after a 3-second countdown.',
                inputSchema: emptySchema,
                execute: () => (resumeReplay() ? 'Resumed; playback continues after a 3-second countdown.' : `The replay is not paused. ${describeMcpPhase()}`)
            },
            {
                name: 'replay_restart',
                description: 'Stop playback and play the loaded replay again from the start with a 3-second countdown, the same as the toolbar Restart button, the pause screen Restart button, and the result screen Replay button.',
                inputSchema: emptySchema,
                execute: () => (restartReplay() ? 'Restarting the replay from the countdown.' : `There is no replay to restart. ${describeMcpPhase()}`)
            },
            {
                name: 'replay_get_json',
                description: 'Return the JSON text of the loaded replay, the same text the result screen Copy Replay button copies. Returns a short notice when nothing is loaded. The text can be large.',
                inputSchema: emptySchema,
                annotations: { readOnlyHint: true, untrustedContentHint: true },
                execute: () => {
                    let source = null;
                    try { source = getGameApi().replay.getSource(); } catch (error) { source = null; }
                    return source || 'No replay is loaded.';
                }
            },
            {
                name: 'replay_show_panel',
                description: "Show a panel to the person: 'json' opens the Load JSON popup (empty text area focused), 'list' opens the Load from List sidebar, and 'none' closes both. Opening one closes the other.",
                inputSchema: {
                    type: 'object',
                    properties: { panel: { type: 'string', enum: ['json', 'list', 'none'], description: 'Panel to show.' } },
                    required: ['panel'],
                    additionalProperties: false
                },
                execute: async (input) => {
                    const panel = input?.panel;
                    if (panel === 'json') {
                        elements.dialogInput.value = '';
                        openJsonDialog();
                        return 'Opened the Load JSON popup.';
                    }
                    if (panel === 'list') {
                        await openSidebar();
                        return `Opened the replay list sidebar (${replayList ? replayList.length : 0} replays).`;
                    }
                    if (panel === 'none') {
                        closeJsonDialog();
                        closeSidebar();
                        return 'Closed the popup and the sidebar.';
                    }
                    throw new Error("panel must be 'json', 'list', or 'none'.");
                }
            }
        ];
        tools.forEach((tool) => {
            try {
                document.modelContext.registerTool(tool, { signal: mcpAbortController.signal });
            } catch (error) {
                console.error(`WebMCP 도구 ${tool.name} 등록에 실패했습니다.`, error);
            }
        });
    }

    /**
     * 리플레이 재생 페이지를 초기화하고 게임 캔버스를 만든다.
     * @param {HTMLElement|string} target 게임 캔버스를 넣을 요소 또는 그 id
     * @returns {void}
     */
    function initialize(target) {
        if (initialized) return;
        const api = getGameApi();
        if (!api?.replay) throw new Error('puyow.js 의 PuyoW.replay API 를 찾을 수 없습니다.');
        initialized = true;
        const toolbar = document.querySelector('.replay-toolbar');
        const sidebar = document.querySelector('.replay-sidebar');
        const dialog = document.querySelector('.replay-dialog-backdrop');
        elements = {
            toolbar,
            sidebar,
            dialog,
            pauseButton: toolbar.querySelector('[data-replay-action="pause"]'),
            restartButton: toolbar.querySelector('[data-replay-action="restart"]'),
            sidebarMessage: sidebar.querySelector('.replay-sidebar-message'),
            status: sidebar.querySelector('.replay-sidebar-status'),
            list: sidebar.querySelector('.replay-list'),
            dialogInput: dialog.querySelector('.replay-dialog-input'),
            dialogMessage: dialog.querySelector('.replay-dialog-message')
        };

        [toolbar, sidebar, dialog].forEach((element) => {
            element.addEventListener('click', handleActionClick);
            element.addEventListener('keydown', handleUiKeydown);
            element.addEventListener('keyup', handleUiKeyup);
        });
        // 팝업 바깥 음영을 눌러도 닫지 않는다. 긴 JSON 을 붙여 넣다가 잘못 눌러 입력을 잃지 않게 하려는 것이다.

        // 게임 캔버스는 하단 툴바를 뺀 화면에 맞춘다. 두 값 모두 initialize 전에만 바꿀 수 있다.
        const toolbarHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(TOOLBAR_HEIGHT_VARIABLE)) || toolbar.offsetHeight || 0;
        api.setCanvasFitMargin({ bottom: toolbarHeight });
        api.replay.setPageMode(true);
        // 재생 상태(일시정지·재개·재생 종료)는 게임 캔버스 안에서도 바뀌므로 매 프레임 그린 뒤 툴바를 맞춘다.
        window.addEventListener('puyow_render', syncToolbarButtons);
        // 게임 화면 언어가 바뀌는 경우에 대비해 화면이 바뀔 때마다 페이지 문구 언어를 확인한다.
        window.addEventListener('puyow_changescreen', refreshLanguageIfChanged);
        api.initialize(target);
        applyPageTexts();
        syncToolbarButtons();
        registerMcpTools();
    }

    window.PuyoWReplay = Object.freeze({
        initialize,
        /** 리플레이를 불러와 재생한다. @param {string|object} data 리플레이 JSON 문자열 또는 객체 @returns {boolean} 성공 여부 */
        load: loadReplay,
        openJsonDialog: () => openJsonDialog(),
        openList: () => openSidebar(),
        pause: () => pauseReplay(),
        resume: () => resumeReplay(),
        restart: () => restartReplay(),
        /** @returns {string} 페이지 문구 언어 코드 */
        getLanguage: () => pageLanguage,
        /** 페이지 문구를 번역한다. @param {string} text 영어 원문 @param {...(string|number)} values 치환할 값 @returns {string} 번역한 문구 */
        translate
    });
})();
