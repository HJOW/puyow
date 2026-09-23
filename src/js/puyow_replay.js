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
    리플레이 데이터를 넘기고 재생 상태를 읽어 하단 툴바·우측 사이드바·JSON 입력 팝업을 다룬다.
*/
(function () {
    'use strict';

    /** 리플레이 목록 파일 이름이다. puyow.js 와 같은 경로에 둔다. @type {string} */
    const REPLAY_LIST_FILE_NAME = 'replays.json';
    /** 하단 툴바 높이를 정하는 CSS 변수 이름이다. 게임 캔버스의 아래 여백으로도 쓴다. @type {string} */
    const TOOLBAR_HEIGHT_VARIABLE = '--replay-toolbar-height';

    /**
     * 이 페이지에서만 쓰는 화면 문구의 번역표다. 게임 번역표와 같이 한국어 원문을 키로 쓴다.
     * 언어는 게임 화면과 같은 값(PuyoW.replay.getLanguage())을 따르며, 번역이 없으면 영어, 그것도 없으면 원문을 쓴다.
     * @type {Record<string, Record<string, string>>}
     */
    const REPLAY_PAGE_STRINGS = {
        en: {
            'JSON 불러오기': 'Load JSON',
            '목록에서 불러오기': 'Load from List',
            '일시중지': 'Pause',
            '처음부터': 'Restart',
            '리플레이 목록': 'Replay List',
            '닫기': 'Close',
            '리플레이 JSON 불러오기': 'Load Replay JSON',
            '리플레이 JSON 코드를 붙여넣어 주세요.': 'Paste the replay JSON code.',
            '확인': 'OK',
            '취소': 'Cancel',
            'JSON 코드를 입력해 주세요.': 'Enter the JSON code.',
            '리플레이 데이터가 올바르지 않습니다.': 'The replay data is invalid.',
            '목록을 불러오는 중...': 'Loading the list...',
            '불러올 수 있는 리플레이가 없습니다.': 'There are no replays to load.',
            '알 수 없는 리플레이': 'Unknown replay',
            'JSON 불러오기 또는 목록에서 불러오기로 리플레이를 불러와 주세요.': 'Load a replay with Load JSON or Load from List.'
        },
        ja: {
            'JSON 불러오기': 'JSONを読み込む',
            '목록에서 불러오기': 'リストから読み込む',
            '일시중지': '一時停止',
            '처음부터': '最初から',
            '리플레이 목록': 'リプレイ一覧',
            '닫기': '閉じる',
            '리플레이 JSON 불러오기': 'リプレイJSONを読み込む',
            '리플레이 JSON 코드를 붙여넣어 주세요.': 'リプレイのJSONコードを貼り付けてください。',
            '확인': 'OK',
            '취소': 'キャンセル',
            'JSON 코드를 입력해 주세요.': 'JSONコードを入力してください。',
            '리플레이 데이터가 올바르지 않습니다.': 'リプレイデータが正しくありません。',
            '목록을 불러오는 중...': '一覧を読み込み中...',
            '불러올 수 있는 리플레이가 없습니다.': '読み込めるリプレイがありません。',
            '알 수 없는 리플레이': '不明なリプレイ',
            'JSON 불러오기 또는 목록에서 불러오기로 리플레이를 불러와 주세요.': '「JSONを読み込む」または「リストから読み込む」でリプレイを読み込んでください。'
        },
        zh: {
            'JSON 불러오기': '加载JSON',
            '목록에서 불러오기': '从列表加载',
            '일시중지': '暂停',
            '처음부터': '从头播放',
            '리플레이 목록': '回放列表',
            '닫기': '关闭',
            '리플레이 JSON 불러오기': '加载回放JSON',
            '리플레이 JSON 코드를 붙여넣어 주세요.': '请粘贴回放JSON代码。',
            '확인': '确定',
            '취소': '取消',
            'JSON 코드를 입력해 주세요.': '请输入JSON代码。',
            '리플레이 데이터가 올바르지 않습니다.': '回放数据不正确。',
            '목록을 불러오는 중...': '正在加载列表...',
            '불러올 수 있는 리플레이가 없습니다.': '没有可加载的回放。',
            '알 수 없는 리플레이': '未知回放',
            'JSON 불러오기 또는 목록에서 불러오기로 리플레이를 불러와 주세요.': '请通过“加载JSON”或“从列表加载”加载回放。'
        },
        de: {
            'JSON 불러오기': 'JSON laden',
            '목록에서 불러오기': 'Aus Liste laden',
            '일시중지': 'Pause',
            '처음부터': 'Von vorn',
            '리플레이 목록': 'Wiederholungsliste',
            '닫기': 'Schließen',
            '리플레이 JSON 불러오기': 'Wiederholungs-JSON laden',
            '리플레이 JSON 코드를 붙여넣어 주세요.': 'Füge den JSON-Code der Wiederholung ein.',
            '확인': 'OK',
            '취소': 'Abbrechen',
            'JSON 코드를 입력해 주세요.': 'Gib den JSON-Code ein.',
            '리플레이 데이터가 올바르지 않습니다.': 'Die Wiederholungsdaten sind ungültig.',
            '목록을 불러오는 중...': 'Liste wird geladen...',
            '불러올 수 있는 리플레이가 없습니다.': 'Keine Wiederholungen zum Laden vorhanden.',
            '알 수 없는 리플레이': 'Unbekannte Wiederholung',
            'JSON 불러오기 또는 목록에서 불러오기로 리플레이를 불러와 주세요.': 'Lade eine Wiederholung über „JSON laden“ oder „Aus Liste laden“.'
        },
        fr: {
            'JSON 불러오기': 'Charger le JSON',
            '목록에서 불러오기': 'Charger depuis la liste',
            '일시중지': 'Pause',
            '처음부터': 'Recommencer',
            '리플레이 목록': 'Liste des reprises',
            '닫기': 'Fermer',
            '리플레이 JSON 불러오기': 'Charger le JSON de la reprise',
            '리플레이 JSON 코드를 붙여넣어 주세요.': 'Collez le code JSON de la reprise.',
            '확인': 'OK',
            '취소': 'Annuler',
            'JSON 코드를 입력해 주세요.': 'Saisissez le code JSON.',
            '리플레이 데이터가 올바르지 않습니다.': 'Les données de la reprise sont invalides.',
            '목록을 불러오는 중...': 'Chargement de la liste...',
            '불러올 수 있는 리플레이가 없습니다.': 'Aucune reprise à charger.',
            '알 수 없는 리플레이': 'Reprise inconnue',
            'JSON 불러오기 또는 목록에서 불러오기로 리플레이를 불러와 주세요.': 'Chargez une reprise avec « Charger le JSON » ou « Charger depuis la liste ».'
        }
    };

    /** 리플레이 meta.rule 값별 게임 번역표 키(한국어 원문)다. @type {Record<string, string>} */
    const RULE_LABELS = {
        standard: '기본 룰',
        fever: '피버 룰',
        feverStart: '피버 룰 (시작)',
        relaxedFever: '피버 (완화)'
    };

    /** puyow_replay.js 가 읽힌 주소다. puyow.js 스크립트 태그를 찾지 못했을 때 목록 파일 경로의 기준으로 쓴다. @type {string} */
    const currentScriptURL = document.currentScript?.src || '';

    let initialized = false;
    /** 화면 요소 모음이다. @type {Record<string, HTMLElement>|null} */
    let elements = null;
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
    /** 마지막으로 툴바에 반영한 버튼 상태다. 매 프레임 같은 값을 다시 쓰지 않으려고 둔다. @type {{pause:boolean, restart:boolean}|null} */
    let appliedButtonState = null;

    /** 게임 API 를 반환한다. @returns {any} window.PuyoW */
    function getGameApi() {
        return window.PuyoW;
    }

    /** 게임 화면에 적용 중인 언어 코드를 반환한다. @returns {string} 언어 코드 */
    function getLanguage() {
        try {
            return String(getGameApi()?.replay?.getLanguage?.() || 'en');
        } catch (error) {
            return 'en';
        }
    }

    /**
     * 이 페이지 전용 문구를 현재 언어로 번역한다.
     * @param {string} text 한국어 원문
     * @returns {string} 번역한 문구
     */
    function translatePage(text) {
        const language = getLanguage();
        if (language === 'ko') return text;
        return REPLAY_PAGE_STRINGS[language]?.[text] || REPLAY_PAGE_STRINGS.en[text] || text;
    }

    /**
     * 게임 번역표로 문구를 번역한다. 룰·색상 수·적 이름처럼 게임 화면과 같은 문구에 쓴다.
     * @param {string} text 한국어 원문
     * @param {...*} values %1, %2 에 넣을 값
     * @returns {string} 번역한 문구
     */
    function translateGame(text, ...values) {
        const api = getGameApi();
        if (typeof api?.translate === 'function') return api.translate(text, ...values);
        return values.reduce((result, value, index) => result.replace(`%${index + 1}`, String(value)), text);
    }

    /** data-replay-text·data-replay-label 이 붙은 요소의 문구를 현재 언어로 다시 적는다. @returns {void} */
    function applyPageTexts() {
        document.documentElement.lang = getLanguage();
        document.querySelectorAll('[data-replay-text]').forEach((element) => {
            element.textContent = translatePage(element.getAttribute('data-replay-text'));
        });
        document.querySelectorAll('[data-replay-label]').forEach((element) => {
            element.setAttribute('aria-label', translatePage(element.getAttribute('data-replay-label')));
        });
        // 목록 항목의 룰·적 이름도 게임 언어를 따르므로 이미 그린 목록은 다시 그린다.
        if (replayList && !elements.sidebar.hidden) renderReplayList(replayList);
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

    /** 현재 재생 상태에 맞춰 "일시중지"·"처음부터" 버튼의 사용 가능 여부를 맞춘다. @returns {void} */
    function syncToolbarButtons() {
        if (!elements) return;
        let state = null;
        try {
            state = getGameApi()?.replay?.getState?.() || null;
        } catch (error) {
            state = null;
        }
        const loaded = Boolean(state?.loaded);
        // 리플레이를 불러오기 전에는 게임 캔버스(초기 화면)를 숨기고 안내 문구를 보인다.
        if (document.body.classList.contains('replay-empty') === loaded) document.body.classList.toggle('replay-empty', !loaded);
        const next = {
            // 카운트다운 중에도 버튼은 켜 두고, 누르면 아무 일도 하지 않는다(게임 쪽 pause() 가 거절한다).
            pause: loaded && state.running && !state.paused && !state.restartPending,
            // 게임이 비워졌더라도 마지막으로 불러온 리플레이가 있으면 다시 재생할 수 있다.
            restart: (loaded && !state.restartPending) || (!loaded && lastReplayData !== null)
        };
        if (appliedButtonState && appliedButtonState.pause === next.pause && appliedButtonState.restart === next.restart) return;
        appliedButtonState = next;
        elements.pauseButton.disabled = !next.pause;
        elements.restartButton.disabled = !next.restart;
    }

    /** "일시중지" 버튼 동작. 게임 중 ESC 를 누른 것처럼 일시정지한다. @returns {void} */
    function pauseReplay() {
        const paused = getGameApi().replay.pause();
        // 일시정지하면 바로 버튼을 끈다. 재개는 게임 일시정지 화면의 재개 버튼으로 하며, 그때 다시 켜진다.
        if (paused) syncToolbarButtons();
    }

    /** "처음부터" 버튼 동작. 재생을 멈추고 카운트다운부터 다시 재생한다. @returns {void} */
    function restartReplay() {
        const api = getGameApi();
        if (api.replay.getState().loaded) {
            api.replay.restart();
        } else if (lastReplayData !== null) {
            loadReplay(lastReplayData);
        }
        syncToolbarButtons();
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
            setMessage(elements.dialogMessage, translatePage('JSON 코드를 입력해 주세요.'));
            elements.dialogInput.focus();
            return;
        }
        if (!loadReplay(text)) {
            setMessage(elements.dialogMessage, translatePage('리플레이 데이터가 올바르지 않습니다.'));
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
                return parsed;
            })
            .catch((error) => {
                console.error('리플레이 목록을 불러오지 못했습니다.', error);
                // 실패한 목록은 보관하지 않아 다음에 사이드바를 열 때 다시 읽는다.
                return [];
            })
            .finally(() => { replayListRequest = null; });
        return replayListRequest;
    }

    /**
     * 목록에 보일 리플레이 대표 정보(룰·색상 수와 대전 상대)를 만든다.
     * @param {unknown} replay 리플레이 JSON 컨텐츠
     * @returns {{title:string, sub:string}} 제목 줄과 보조 줄
     */
    function describeReplay(replay) {
        const meta = replay && typeof replay === 'object' && !Array.isArray(replay) ? replay.meta : null;
        if (!meta || typeof meta !== 'object') return { title: translatePage('알 수 없는 리플레이'), sub: '' };
        const parts = [];
        const ruleKey = typeof meta.rule === 'string' ? meta.rule : 'standard';
        parts.push(RULE_LABELS[ruleKey] ? translateGame(RULE_LABELS[ruleKey]) : ruleKey);
        if (Array.isArray(meta.colors)) parts.push(translateGame('%1색', meta.colors.length));
        if (meta.watch === true) parts.push(translateGame('구경'));
        if (meta.together === true) parts.push(translateGame('너랑 나랑'));
        const names = Array.isArray(meta.players)
            ? meta.players.map((player) => (player && typeof player.name === 'string' ? translateGame(player.name) : '?'))
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
        elements.status.textContent = list.length ? '' : translatePage('불러올 수 있는 리플레이가 없습니다.');
        elements.status.hidden = list.length > 0;
    }

    /**
     * 목록에서 고른 리플레이를 불러온다. 실패하면 사이드바에 알리고, 성공하면 사이드바를 닫는다.
     * @param {number} index 목록 순번
     * @returns {void}
     */
    function selectReplayFromList(index) {
        if (!replayList || !(index in replayList)) return;
        if (!loadReplay(replayList[index])) {
            setMessage(elements.sidebarMessage, `${index + 1}. ${translatePage('리플레이 데이터가 올바르지 않습니다.')}`);
            return;
        }
        closeSidebar();
    }

    /** 우측 사이드바를 열고 리플레이 목록을 읽어 보인다. @returns {void} */
    function openSidebar() {
        closeJsonDialog();
        setMessage(elements.sidebarMessage, null);
        elements.sidebar.hidden = false;
        if (replayList) {
            renderReplayList(replayList);
            return;
        }
        elements.list.replaceChildren();
        elements.status.textContent = translatePage('목록을 불러오는 중...');
        elements.status.hidden = false;
        fetchReplayList().then((list) => {
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
        // 설정 화면에서 언어를 바꿀 수 있으므로 화면이 바뀔 때마다 페이지 문구를 다시 맞춘다.
        window.addEventListener('puyow_changescreen', applyPageTexts);
        api.initialize(target);
        applyPageTexts();
        syncToolbarButtons();
    }

    window.PuyoWReplay = Object.freeze({
        initialize,
        /** 리플레이를 불러와 재생한다. @param {string|object} data 리플레이 JSON 문자열 또는 객체 @returns {boolean} 성공 여부 */
        load: loadReplay,
        openJsonDialog: () => openJsonDialog(),
        openList: () => openSidebar(),
        pause: () => pauseReplay(),
        restart: () => restartReplay()
    });
})();
