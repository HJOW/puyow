/*
    뿌요 W 개발용 도구 (피버 패턴 / 퍼즐뿌요 제작)

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

    이 파일은 tools.html 전용이다. 게임 페이지(puyow.html)는 이 파일을 읽지 않는다.
    화면 구성과 스크립트 생성은 모두 이 파일이 맡고, 뿌요 배치 편집과 테스트 실행은
    puyow.js가 내보내는 PuyoW.tools API를 통해 게임 본체의 코드를 그대로 재사용한다.
*/
(() => {
    'use strict';

    /** 편집에 쓸 수 있는 일반 뿌요 색 목록이다. puyow.js의 COLORS와 같은 순서를 유지한다. @type {string[]} */
    const COLORS = ['red', 'green', 'yellow', 'blue', 'purple'];

    /** 색상 선택 칸에 보여 줄 한국어 이름이다. @type {Object<string,string>} */
    const COLOR_LABELS = { red: '빨강', green: '초록', yellow: '노랑', blue: '파랑', purple: '보라' };

    /** 색상 선택 칸 옆에 표시할 미리보기 색이다. @type {Object<string,string>} */
    const COLOR_SAMPLES = { red: '#ef5350', green: '#66bb6a', yellow: '#f7c843', blue: '#42a5f5', purple: '#ab73e8' };

    /** 퍼즐뿌요의 승리 조건 유형 목록이다. @type {{value:string, label:string, description:string}[]} */
    const WIN_CONDITION_TYPES = [
        { value: 'combo', label: 'combo (연쇄)', description: '목표 연쇄 수를 달성하면 승리' },
        { value: 'clear', label: 'clear (싹쓸이)', description: '싹쓸이 발생 시 승리 (목표 값 없음)' },
        { value: 'multiple', label: 'multiple (동시 폭발 수)', description: '한 번의 연쇄에 동시에 터지는 뿌요 수가 목표 수 이상' },
        { value: 'color', label: 'color (동시 폭발 색 수)', description: '한 번의 연쇄에 동시에 터지는 색 수가 목표 수 이상 (방해뿌요 제외)' },
        { value: 'attack', label: 'attack (공격량)', description: 'ATTACK + DAMAGE 합이 순간적으로 목표 수 이상' }
    ];

    /** 피버 패턴 개발 화면에 처음 세팅해 둘 사용 색상 목록(3색)이다. @type {string[]} */
    const DEFAULT_FEVER_USING_COLORS = ['red', 'green', 'blue'];

    /** 피버 패턴에서 받을 수 있는 목표 연쇄 수의 최솟값이다. @type {number} */
    const FEVER_TARGET_COMBO_MIN = 4;

    /** 피버 패턴에서 받을 수 있는 목표 연쇄 수의 최댓값이다. @type {number} */
    const FEVER_TARGET_COMBO_MAX = 12;

    /** 도구 화면을 담은 최상위 요소다. 초기화 전에는 null이다. @type {HTMLElement|null} */
    let rootElement = null;

    /** 화면을 구성하는 주요 요소 모음이다. @type {Object<string, HTMLElement>} */
    const elements = {};

    /** 현재 선택한 개발 대상이다. 아직 고르지 않았으면 null이다. @type {'fever'|'puzzle'|null} */
    let currentMode = null;

    /** 게임 캔버스가 이미 초기화되었는지 여부다. @type {boolean} */
    let gameInitialized = false;

    /** 지금 테스트를 진행 중인지 여부다. @type {boolean} */
    let testing = false;

    /** 캔버스 영역 크기 변화를 감시하는 관찰자다. @type {ResizeObserver|null} */
    let canvasResizeObserver = null;

    /** @returns {object} puyow.js가 내보낸 게임 API */
    function getGameApi() {
        const api = window.PuyoW || window.WebPuyo;
        if (!api) throw new Error('puyow.js를 먼저 불러와야 합니다.');
        return api;
    }

    /** @returns {object} puyow.js가 내보낸 개발용 도구 API */
    function getToolsApi() {
        const api = getGameApi().tools;
        if (!api) throw new Error('이 puyow.js 빌드에는 개발용 도구 API가 없습니다.');
        return api;
    }

    /**
     * 도구 화면에 필요한 CSS를 style 태그로 문서에 넣는다. 이미 넣었으면 아무것도 하지 않는다.
     * @returns {void}
     */
    function prepareStyle() {
        if (document.querySelector('style.puyow_tools_style')) return;
        const style = document.createElement('style');
        style.className = 'puyow_tools_style';
        style.textContent = `
            body.webpuyo { margin: 0; background: #061019; }

            .puyow-tools {
                background: #061019;
                color: #d8f2f5;
                display: flex;
                flex-direction: column;
                font-family: 'Nanum Gothic', 'Noto Sans KR', sans-serif;
                font-size: 14px;
                height: 100vh;
                overflow: hidden;
                width: 100%;
            }

            /* display 를 지정한 영역도 hidden 속성으로 감출 수 있게 한다. */
            .puyow-tools [hidden] { display: none !important; }

            .puyow-tools-toolbar {
                align-items: center;
                background: #0c2433;
                border-bottom: 2px solid #1d4a60;
                display: flex;
                flex: 0 0 auto;
                gap: 10px;
                padding: 10px 16px;
            }

            .puyow-tools-toolbar h1 {
                font-size: 17px;
                font-weight: normal;
                margin: 0 14px 0 0;
                color: #f7c843;
                white-space: nowrap;
            }

            .puyow-tools-status {
                flex: 1 1 auto;
                font-size: 13px;
                margin-left: 12px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .puyow-tools-status.is-error { color: #ff8a80; }
            .puyow-tools-status.is-done { color: #7ee0c8; }

            .puyow-tools button {
                background: #173747;
                border: 2px solid #497180;
                border-radius: 4px;
                color: #f5fbfc;
                cursor: pointer;
                font-family: inherit;
                font-size: 14px;
                padding: 7px 14px;
            }

            .puyow-tools button:hover:not(:disabled) { background: #1f4a5e; }
            .puyow-tools button:disabled { cursor: not-allowed; opacity: .45; }
            .puyow-tools button.is-active { background: #2b6b57; border-color: #46d7c4; }
            .puyow-tools button.is-primary { background: #2b6b57; border-color: #4cc9b0; }
            .puyow-tools button.is-danger { background: #5a2a2a; border-color: #ef5350; }
            .puyow-tools button.is-small { font-size: 12px; padding: 3px 8px; }

            .puyow-tools-body {
                display: flex;
                flex: 1 1 auto;
                min-height: 0;
            }

            .puyow-tools-empty {
                align-items: center;
                color: #6f9cae;
                display: flex;
                flex: 1 1 auto;
                justify-content: center;
                text-align: center;
            }

            /* 좌측 사이드바와 우측 영역의 비율은 4 : 6 이다. */
            .puyow-tools-sidebar {
                background: #0a1d29;
                border-right: 2px solid #1d4a60;
                box-sizing: border-box;
                display: flex;
                flex: 4 1 0;
                flex-direction: column;
                gap: 14px;
                min-width: 0;
                overflow-y: auto;
                padding: 14px 16px;
            }

            .puyow-tools-right {
                box-sizing: border-box;
                display: flex;
                flex: 6 1 0;
                flex-direction: column;
                min-width: 0;
            }

            /* 우측 캔버스 영역과 스크립트 출력 영역의 비율은 7 : 3 이다. */
            .puyow-tools-canvas {
                align-items: center;
                background: #071621;
                box-sizing: border-box;
                display: flex;
                flex: 7 1 0;
                justify-content: center;
                min-height: 0;
                overflow: hidden;
                padding: 8px;
            }

            .puyow-tools-output {
                border-top: 2px solid #1d4a60;
                box-sizing: border-box;
                display: flex;
                flex: 3 1 0;
                flex-direction: column;
                min-height: 0;
                padding: 8px 10px 10px 10px;
            }

            .puyow-tools-output-title {
                color: #a9d9e5;
                flex: 0 0 auto;
                font-size: 13px;
                padding-bottom: 6px;
            }

            .puyow-tools-output textarea {
                background: #061019;
                border: 2px solid #1d4a60;
                border-radius: 4px;
                box-sizing: border-box;
                color: #d8f2f5;
                flex: 1 1 auto;
                font-family: 'Nanum Gothic Coding', 'Noto Sans Mono', monospace;
                font-size: 12px;
                min-height: 0;
                padding: 8px;
                resize: none;
                white-space: pre;
                width: 100%;
            }

            .puyow-tools-section {
                border: 1px solid #1d4a60;
                border-radius: 4px;
                padding: 10px 12px 12px 12px;
            }

            .puyow-tools-section > h2 {
                color: #f7c843;
                font-size: 14px;
                font-weight: normal;
                margin: 0 0 10px 0;
            }

            .puyow-tools-field {
                align-items: center;
                display: flex;
                gap: 8px;
                margin-bottom: 8px;
            }

            .puyow-tools-field:last-child { margin-bottom: 0; }

            .puyow-tools-field > label {
                color: #a9d9e5;
                flex: 0 0 96px;
                font-size: 13px;
            }

            .puyow-tools input[type="number"],
            .puyow-tools input[type="text"],
            .puyow-tools select,
            .puyow-tools textarea {
                background: #061019;
                border: 2px solid #35637a;
                border-radius: 3px;
                box-sizing: border-box;
                color: #f5fbfc;
                font-family: inherit;
                font-size: 13px;
                padding: 5px 6px;
            }

            .puyow-tools input[type="number"] { width: 90px; }
            .puyow-tools input[type="text"] { flex: 1 1 auto; min-width: 0; }
            .puyow-tools select { flex: 1 1 auto; min-width: 0; }
            .puyow-tools input:disabled, .puyow-tools select:disabled { opacity: .4; }

            .puyow-tools-hint {
                color: #6f9cae;
                font-size: 12px;
                line-height: 1.5;
                margin-top: 6px;
            }

            .puyow-tools-grid {
                border-collapse: collapse;
                width: 100%;
            }

            .puyow-tools-grid th, .puyow-tools-grid td {
                border: 1px solid #1d4a60;
                font-size: 13px;
                font-weight: normal;
                padding: 4px 6px;
                text-align: left;
            }

            .puyow-tools-grid th { background: #0f2c3b; color: #a9d9e5; }
            .puyow-tools-grid td.is-narrow { width: 1px; white-space: nowrap; }

            .puyow-tools-color-sample {
                border: 1px solid rgba(255, 255, 255, .35);
                border-radius: 50%;
                display: inline-block;
                height: 14px;
                vertical-align: middle;
                width: 14px;
            }

            .puyow-tools-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .puyow-tools-dialog {
                align-items: center;
                background: rgba(3, 11, 19, .78);
                display: flex;
                inset: 0;
                justify-content: center;
                position: fixed;
                z-index: 100;
            }

            .puyow-tools-dialog[hidden] { display: none; }

            .puyow-tools-dialog-panel {
                background: #102c3b;
                border: 2px solid #6ea2b8;
                border-radius: 6px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 92vw;
                padding: 16px;
                width: 720px;
            }

            .puyow-tools-dialog-panel h2 {
                color: #f7c843;
                font-size: 16px;
                font-weight: normal;
                margin: 0;
            }

            .puyow-tools-dialog-panel textarea {
                font-family: 'Nanum Gothic Coding', 'Noto Sans Mono', monospace;
                height: 260px;
                resize: vertical;
                width: 100%;
            }

            .puyow-tools-dialog-buttons {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }

            /*
                puyow.js의 실행용 레이아웃은 게임 페이지 전체를 채우도록 100vw 기준으로 잡혀 있다.
                도구 화면에서는 캔버스 영역 안쪽에만 들어가야 하므로 크기를 여기서 다시 지정하고,
                실제 픽셀 크기는 16 : 9 비율을 지키도록 스크립트가 계산해 넣는다.
            */
            .puyow-tools-canvas .div_puyow_root {
                align-self: center;
                flex: 0 0 auto;
                height: auto;
                margin: 0;
                width: auto;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 지정한 태그의 요소를 만들어 옵션을 적용한다.
     * @param {string} tagName 태그 이름
     * @param {{className?:string, text?:string, attributes?:Object<string,string>}} [options] 적용할 옵션
     * @param {HTMLElement} [parent] 붙일 부모 요소
     * @returns {HTMLElement} 만들어진 요소
     */
    function createElement(tagName, options = {}, parent = null) {
        const element = document.createElement(tagName);
        if (options.className) element.className = options.className;
        if (options.text !== undefined) element.textContent = options.text;
        Object.entries(options.attributes || {}).forEach(([name, value]) => element.setAttribute(name, value));
        if (parent) parent.appendChild(element);
        return element;
    }

    /**
     * 사이드바에 한 줄짜리 입력 항목을 만든다.
     * @param {HTMLElement} parent 부모 요소
     * @param {string} labelText 항목 이름
     * @param {HTMLElement} field 입력 요소
     * @returns {HTMLElement} 만들어진 줄 요소
     */
    function appendField(parent, labelText, field) {
        const row = createElement('div', { className: 'puyow-tools-field' }, parent);
        createElement('label', { text: labelText }, row);
        row.appendChild(field);
        return row;
    }

    /**
     * 툴바 아래 상태 문구를 바꾼다.
     * @param {string} message 표시할 문구
     * @param {'info'|'error'|'done'} [level='info'] 문구 종류
     * @returns {void}
     */
    function setStatus(message, level = 'info') {
        if (!elements.status) return;
        elements.status.textContent = message;
        elements.status.classList.toggle('is-error', level === 'error');
        elements.status.classList.toggle('is-done', level === 'done');
    }

    /**
     * 입력 요소가 키보드 조작을 게임에 넘기지 않도록 막는다.
     * puyow.js는 window에서 키 입력을 받으므로, 입력 칸 안에서 누른 키는 여기서 전파를 끊는다.
     * @param {KeyboardEvent} event 키 이벤트
     * @returns {void}
     */
    function stopKeyEventForFormField(event) {
        const target = event.target;
        if (!target || typeof target.tagName !== 'string') return;
        const tagName = target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) {
            event.stopPropagation();
        }
    }

    /**
     * 도구 화면의 기본 뼈대(툴바, 사이드바, 캔버스, 출력 영역)를 만든다.
     * @returns {void}
     */
    function buildLayout() {
        rootElement.classList.add('puyow-tools');
        rootElement.textContent = '';

        const toolbar = createElement('div', { className: 'puyow-tools-toolbar' }, rootElement);
        createElement('h1', { text: '뿌요 W 개발 도구' }, toolbar);
        elements.feverModeButton = createElement('button', { text: '피버 패턴 개발', attributes: { type: 'button' } }, toolbar);
        elements.puzzleModeButton = createElement('button', { text: '퍼즐뿌요 개발', attributes: { type: 'button' } }, toolbar);
        elements.status = createElement('div', { className: 'puyow-tools-status', text: '개발할 대상을 선택해 주세요.' }, toolbar);
        elements.feverModeButton.addEventListener('click', () => selectMode('fever'));
        elements.puzzleModeButton.addEventListener('click', () => selectMode('puzzle'));

        elements.body = createElement('div', { className: 'puyow-tools-body' }, rootElement);
        elements.empty = createElement('div', {
            className: 'puyow-tools-empty',
            text: '화면 위쪽에서 "피버 패턴 개발" 또는 "퍼즐뿌요 개발"을 선택하세요.'
        }, elements.body);

        elements.sidebar = createElement('div', { className: 'puyow-tools-sidebar' }, elements.body);
        elements.right = createElement('div', { className: 'puyow-tools-right' }, elements.body);
        elements.canvasHost = createElement('div', { className: 'puyow-tools-canvas' }, elements.right);
        elements.canvasRoot = createElement('div', { attributes: { id: 'puyow_tools_canvas_root' } }, elements.canvasHost);

        const output = createElement('div', { className: 'puyow-tools-output' }, elements.right);
        createElement('div', { className: 'puyow-tools-output-title', text: '생성된 스크립트' }, output);
        elements.output = createElement('textarea', { attributes: { readonly: 'readonly', spellcheck: 'false' } }, output);

        elements.sidebar.hidden = true;
        elements.right.hidden = true;

        buildLoadDialog();
        rootElement.addEventListener('keydown', stopKeyEventForFormField);
        window.addEventListener('resize', resizeCanvasRoot);
    }

    /**
     * 기존 데이터를 붙여 넣을 레이어 팝업을 만든다.
     * @returns {void}
     */
    function buildLoadDialog() {
        const dialog = createElement('div', { className: 'puyow-tools-dialog' }, rootElement);
        dialog.hidden = true;
        const panel = createElement('div', { className: 'puyow-tools-dialog-panel' }, dialog);
        createElement('h2', { text: '기존 데이터 불러오기' }, panel);
        createElement('div', {
            className: 'puyow-tools-hint',
            text: 'new FeverStageState(...) 또는 new PuzzlePuyoStage({...}) 형태의 스크립트를 붙여 넣어 주세요.'
        }, panel);
        elements.loadInput = createElement('textarea', { attributes: { spellcheck: 'false' } }, panel);
        const buttons = createElement('div', { className: 'puyow-tools-dialog-buttons' }, panel);
        const confirmButton = createElement('button', { className: 'is-primary', text: '확인', attributes: { type: 'button' } }, buttons);
        const cancelButton = createElement('button', { text: '취소', attributes: { type: 'button' } }, buttons);
        confirmButton.addEventListener('click', confirmLoadDialog);
        cancelButton.addEventListener('click', closeLoadDialog);
        elements.loadDialog = dialog;
    }

    /** 불러오기 팝업을 연다. @returns {void} */
    function openLoadDialog() {
        elements.loadInput.value = '';
        elements.loadDialog.hidden = false;
        elements.loadInput.focus();
    }

    /** 불러오기 팝업을 닫는다. @returns {void} */
    function closeLoadDialog() {
        elements.loadDialog.hidden = true;
    }

    /**
     * 팝업에 입력한 스크립트를 읽어 편집 화면에 반영한다.
     * @returns {void}
     */
    function confirmLoadDialog() {
        try {
            const stage = parseStageScript(elements.loadInput.value);
            applyLoadedStage(stage);
            closeLoadDialog();
            setStatus('기존 데이터를 불러왔습니다.', 'done');
        } catch (error) {
            setStatus(`불러오기 실패: ${error.message}`, 'error');
        }
    }

    /**
     * 붙여 넣은 스크립트를 실제 FeverStageState / PuzzlePuyoStage 객체로 만든다.
     * 게임과 같은 클래스를 그대로 써서 기본값과 생성자 처리까지 동일하게 맞춘다.
     * @param {string} text 입력한 스크립트
     * @returns {object} 만들어진 스테이지 객체
     */
    function parseStageScript(text) {
        const trimmed = String(text || '').trim().replace(/;+\s*$/, '');
        if (!trimmed) throw new Error('불러올 스크립트를 입력해 주세요.');
        const api = getGameApi();
        let stage = null;
        try {
            const factory = new Function('FeverStageState', 'PuzzlePuyoStage', `'use strict';\nreturn (\n${trimmed}\n);`);
            stage = factory(api.FeverStageState, api.PuzzlePuyoStage);
        } catch (error) {
            throw new Error(`스크립트를 해석할 수 없습니다. (${error.message})`);
        }
        if (stage instanceof api.FeverStageState || stage instanceof api.PuzzlePuyoStage) return stage;
        throw new Error('FeverStageState 또는 PuzzlePuyoStage 객체가 아닙니다.');
    }

    /**
     * 불러온 스테이지 객체를 알맞은 개발 화면에 반영한다.
     * @param {object} stage FeverStageState 또는 PuzzlePuyoStage 객체
     * @returns {void}
     */
    function applyLoadedStage(stage) {
        const api = getGameApi();
        const kind = stage instanceof api.FeverStageState ? 'fever' : 'puzzle';
        selectMode(kind);
        if (kind === 'fever') {
            elements.targetCombo.value = String(stage.targetCombo);
            elements.difficulty.value = String(stage.difficulty);
            setUsingColorRows(stage.usingColors);
        } else {
            elements.winConditionType.value = stage.winConditionType;
            elements.winConditionValue.value = String(stage.winConditionValue);
            elements.turnLimit.value = String(stage.turnLimit);
            elements.hint.value = stage.hint || '';
            refreshWinConditionValueState();
        }
        getToolsApi().setEditorData({
            stageData: stage.stageData,
            suppliedNextPuyos: stage.suppliedNextPuyos
        });
    }

    /**
     * 개발 대상을 고르고 그에 맞는 사이드바와 편집 화면을 준비한다.
     * @param {'fever'|'puzzle'} kind 개발 대상
     * @returns {void}
     */
    function selectMode(kind) {
        if (testing) {
            setStatus('테스트가 끝난 뒤에 다시 선택해 주세요.', 'error');
            return;
        }
        if (currentMode === kind) return;
        currentMode = kind;
        elements.feverModeButton.classList.toggle('is-active', kind === 'fever');
        elements.puzzleModeButton.classList.toggle('is-active', kind === 'puzzle');
        elements.empty.hidden = true;
        elements.sidebar.hidden = false;
        elements.right.hidden = false;
        elements.output.value = '';
        if (kind === 'fever') buildFeverSidebar();
        else buildPuzzleSidebar();
        if (!gameInitialized) {
            getGameApi().initialize(elements.canvasRoot);
            gameInitialized = true;
            observeCanvasSize();
        }
        getToolsApi().openEditor({ kind });
        resizeCanvasRoot();
        setStatus(kind === 'fever' ? '피버 패턴을 편집합니다.' : '퍼즐뿌요 스테이지를 편집합니다.');
    }

    /**
     * 사이드바 위쪽의 공통 영역(불러오기 버튼)을 만든다.
     * @returns {HTMLElement} 만들어진 영역
     */
    function buildCommonSection() {
        elements.sidebar.textContent = '';
        const section = createElement('div', { className: 'puyow-tools-section' }, elements.sidebar);
        createElement('h2', { text: '기존 데이터' }, section);
        const buttons = createElement('div', { className: 'puyow-tools-buttons' }, section);
        const loadButton = createElement('button', { text: '불러오기', attributes: { type: 'button' } }, buttons);
        loadButton.addEventListener('click', openLoadDialog);
        return section;
    }

    /**
     * 사이드바 아래쪽의 공통 조작 버튼을 만든다.
     * @returns {void}
     */
    function buildControlSection() {
        const section = createElement('div', { className: 'puyow-tools-section' }, elements.sidebar);
        createElement('h2', { text: '조작' }, section);
        const buttons = createElement('div', { className: 'puyow-tools-buttons' }, section);
        elements.testButton = createElement('button', { text: '테스트', attributes: { type: 'button' } }, buttons);
        elements.generateButton = createElement('button', { className: 'is-primary', text: '스크립트 생성', attributes: { type: 'button' } }, buttons);
        elements.testButton.addEventListener('click', runTest);
        elements.generateButton.addEventListener('click', generateScript);
        createElement('div', {
            className: 'puyow-tools-hint',
            text: '캔버스 오른쪽 팔레트에서 뿌요를 고른 뒤, 왼쪽 플레이 영역과 가운데 "다음에 나올 뿌요" 칸을 클릭하거나 끌어서 배치합니다.'
        }, section);
    }

    /**
     * 피버 패턴 개발용 사이드바를 만든다.
     * @returns {void}
     */
    function buildFeverSidebar() {
        buildCommonSection();

        const section = createElement('div', { className: 'puyow-tools-section' }, elements.sidebar);
        createElement('h2', { text: '피버 패턴 정보' }, section);

        elements.targetCombo = createElement('input', {
            attributes: { type: 'number', min: String(FEVER_TARGET_COMBO_MIN), max: String(FEVER_TARGET_COMBO_MAX), step: '1', value: '5' }
        });
        appendField(section, '목표 연쇄 수', elements.targetCombo);

        elements.difficulty = createElement('input', { attributes: { type: 'number', min: '1', step: '1', value: '1' } });
        appendField(section, '난이도', elements.difficulty);

        createElement('div', {
            className: 'puyow-tools-hint',
            text: `목표 연쇄 수는 ${FEVER_TARGET_COMBO_MIN} ~ ${FEVER_TARGET_COMBO_MAX} 사이의 정수, 난이도는 1 이상의 정수입니다.`
        }, section);

        const colorSection = createElement('div', { className: 'puyow-tools-section' }, elements.sidebar);
        createElement('h2', { text: '사용할 색상 목록' }, colorSection);
        const table = createElement('table', { className: 'puyow-tools-grid' }, colorSection);
        const headRow = createElement('tr', {}, createElement('thead', {}, table));
        createElement('th', { text: '순번' }, headRow);
        createElement('th', { text: '색상' }, headRow);
        createElement('th', { text: '' }, headRow);
        elements.usingColorBody = createElement('tbody', {}, table);
        const colorButtons = createElement('div', { className: 'puyow-tools-buttons' }, colorSection);
        colorButtons.style.marginTop = '8px';
        const addColorButton = createElement('button', { className: 'is-small', text: '색상 추가', attributes: { type: 'button' } }, colorButtons);
        addColorButton.addEventListener('click', () => {
            const used = readUsingColorValues();
            const unused = COLORS.find((color) => !used.includes(color)) || COLORS[0];
            addUsingColorRow(unused);
        });
        createElement('div', {
            className: 'puyow-tools-hint',
            text: 'red, blue, green, yellow, purple 중에서만 고를 수 있습니다. 같은 색을 두 번 넣으면 스크립트 생성 단계에서 막습니다.'
        }, colorSection);
        setUsingColorRows(DEFAULT_FEVER_USING_COLORS);

        buildControlSection();
    }

    /**
     * 퍼즐뿌요 개발용 사이드바를 만든다.
     * @returns {void}
     */
    function buildPuzzleSidebar() {
        buildCommonSection();

        const section = createElement('div', { className: 'puyow-tools-section' }, elements.sidebar);
        createElement('h2', { text: '퍼즐뿌요 정보' }, section);

        elements.winConditionType = createElement('select', {});
        WIN_CONDITION_TYPES.forEach((type) => {
            const option = createElement('option', { text: type.label }, elements.winConditionType);
            option.value = type.value;
        });
        appendField(section, '목표 타입', elements.winConditionType);

        elements.winConditionValue = createElement('input', { attributes: { type: 'number', min: '1', step: '1', value: '4' } });
        appendField(section, '목표 타입 값', elements.winConditionValue);

        elements.turnLimit = createElement('input', { attributes: { type: 'number', min: '0', step: '1', value: '2' } });
        appendField(section, '목표 턴수', elements.turnLimit);

        elements.hint = createElement('input', { attributes: { type: 'text', maxlength: '80', value: '' } });
        appendField(section, '힌트', elements.hint);

        elements.winConditionDescription = createElement('div', { className: 'puyow-tools-hint', text: '' }, section);
        createElement('div', {
            className: 'puyow-tools-hint',
            text: '목표 턴수는 0 이상의 정수이며, 0을 넣으면 제한이 없는 것으로 봅니다. 힌트는 비워 둘 수 있습니다.'
        }, section);

        elements.winConditionType.addEventListener('change', refreshWinConditionValueState);
        refreshWinConditionValueState();

        buildControlSection();
    }

    /**
     * 목표 타입에 맞춰 목표 타입 값 입력 칸의 사용 여부와 설명을 갱신한다.
     * clear(싹쓸이)는 목표 값이 의미 없으므로 입력 칸을 잠근다.
     * @returns {void}
     */
    function refreshWinConditionValueState() {
        const selected = WIN_CONDITION_TYPES.find((type) => type.value === elements.winConditionType.value);
        const isClear = elements.winConditionType.value === 'clear';
        elements.winConditionValue.disabled = isClear;
        elements.winConditionDescription.textContent = selected ? selected.description : '';
    }

    /**
     * 사용할 색상 목록 그리드에 한 줄을 추가한다.
     * @param {string} color 처음 선택해 둘 색
     * @returns {void}
     */
    function addUsingColorRow(color) {
        if (elements.usingColorBody.children.length >= COLORS.length) {
            setStatus(`색상은 최대 ${COLORS.length}개까지 넣을 수 있습니다.`, 'error');
            return;
        }
        const row = createElement('tr', {}, elements.usingColorBody);
        const indexCell = createElement('td', { className: 'is-narrow' }, row);
        const colorCell = createElement('td', {}, row);
        const buttonCell = createElement('td', { className: 'is-narrow' }, row);

        const sample = createElement('span', { className: 'puyow-tools-color-sample' }, colorCell);
        const select = createElement('select', {}, colorCell);
        select.style.marginLeft = '6px';
        COLORS.forEach((value) => {
            const option = createElement('option', { text: `${value} (${COLOR_LABELS[value]})` }, select);
            option.value = value;
        });
        select.value = COLORS.includes(color) ? color : COLORS[0];
        sample.style.background = COLOR_SAMPLES[select.value];
        select.addEventListener('change', () => { sample.style.background = COLOR_SAMPLES[select.value]; });

        const removeButton = createElement('button', { className: 'is-small is-danger', text: '삭제', attributes: { type: 'button' } }, buttonCell);
        removeButton.addEventListener('click', () => {
            row.remove();
            refreshUsingColorIndexes();
        });
        indexCell.textContent = String(elements.usingColorBody.children.length);
        refreshUsingColorIndexes();
    }

    /** 사용할 색상 목록 그리드의 순번 칸을 다시 매긴다. @returns {void} */
    function refreshUsingColorIndexes() {
        Array.from(elements.usingColorBody.children).forEach((row, index) => {
            row.children[0].textContent = String(index + 1);
        });
    }

    /**
     * 사용할 색상 목록 그리드를 지정한 색 목록으로 다시 채운다.
     * @param {string[]} colors 채울 색 목록
     * @returns {void}
     */
    function setUsingColorRows(colors) {
        elements.usingColorBody.textContent = '';
        const values = (Array.isArray(colors) ? colors : []).filter((color) => COLORS.includes(color));
        (values.length ? values : DEFAULT_FEVER_USING_COLORS).forEach((color) => addUsingColorRow(color));
    }

    /** @returns {string[]} 사용할 색상 목록 그리드에 지금 들어 있는 색 목록 */
    function readUsingColorValues() {
        return Array.from(elements.usingColorBody.querySelectorAll('select')).map((select) => select.value);
    }

    /**
     * 숫자 입력 칸에서 정수를 읽는다.
     * @param {HTMLInputElement} input 입력 칸
     * @param {string} name 오류 문구에 쓸 항목 이름
     * @returns {number} 읽은 정수
     */
    function readIntegerField(input, name) {
        const text = String(input.value || '').trim();
        if (!text) throw new Error(`${name}을(를) 입력해 주세요.`);
        const value = Number(text);
        if (!Number.isInteger(value)) throw new Error(`${name}은(는) 정수여야 합니다.`);
        return value;
    }

    /**
     * 캔버스에서 편집 중인 배치와 지급 뿌요를 읽는다.
     * @returns {{stageData:object, nextPuyos:(string|null)[][]}} 편집 중인 데이터
     */
    function readEditorData() {
        const editor = getToolsApi().getEditorData();
        if (!editor) throw new Error('편집 화면이 준비되지 않았습니다.');
        if (!editor.stageData.puyos.length) throw new Error('플레이 영역에 뿌요를 하나 이상 배치해 주세요.');
        return editor;
    }

    /**
     * 편집 중인 값으로 FeverStageState 객체를 만든다. 잘못된 값이 있으면 예외를 던진다.
     * @returns {object} 만들어진 FeverStageState
     */
    function collectFeverStage() {
        const editor = readEditorData();
        const targetCombo = readIntegerField(elements.targetCombo, '목표 연쇄 수');
        if (targetCombo < FEVER_TARGET_COMBO_MIN || targetCombo > FEVER_TARGET_COMBO_MAX) {
            throw new Error(`목표 연쇄 수는 ${FEVER_TARGET_COMBO_MIN} 이상 ${FEVER_TARGET_COMBO_MAX} 이하여야 합니다.`);
        }
        const difficulty = readIntegerField(elements.difficulty, '난이도');
        if (difficulty < 1) throw new Error('난이도는 1 이상의 정수여야 합니다.');

        const usingColors = readUsingColorValues();
        if (!usingColors.length) throw new Error('사용할 색상을 한 개 이상 넣어 주세요.');
        const duplicated = usingColors.find((color, index) => usingColors.indexOf(color) !== index);
        if (duplicated) throw new Error(`사용할 색상 목록에 "${duplicated}"이(가) 두 번 이상 있습니다.`);

        const supplied = editor.nextPuyos[0] || [];
        if (!supplied[0] || !supplied[1]) throw new Error('"다음에 나올 뿌요"의 두 칸을 모두 채워 주세요.');

        const colorSet = new Set(usingColors);
        const invalidPuyo = editor.stageData.puyos.find((puyo) => puyo.color !== 'garbage' && !colorSet.has(puyo.color));
        if (invalidPuyo) throw new Error(`플레이 영역의 "${invalidPuyo.color}" 색이 사용할 색상 목록에 없습니다.`);
        const invalidSupplied = supplied.find((color) => !colorSet.has(color));
        if (invalidSupplied) throw new Error(`"다음에 나올 뿌요"의 "${invalidSupplied}" 색이 사용할 색상 목록에 없습니다.`);

        return new (getGameApi().FeverStageState)(editor.stageData, targetCombo, [supplied[0], supplied[1]], difficulty, usingColors);
    }

    /**
     * 편집 중인 "다음에 나올 뿌요" 칸을 퍼즐뿌요의 지급 목록으로 바꾼다.
     * @param {(string|null)[][]} nextPuyos 턴별 지급 뿌요
     * @returns {string[][]} 앞에서부터 이어지는 완성된 턴 목록
     */
    function collectPuzzleNextPuyos(nextPuyos) {
        const pairs = [];
        let emptyTurnFound = false;
        nextPuyos.forEach((pair, index) => {
            const filled = [pair[0], pair[1]].filter((color) => Boolean(color));
            if (filled.length === 0) { emptyTurnFound = true; return; }
            if (filled.length === 1) throw new Error(`"다음에 나올 뿌요" ${index + 1}턴의 한 칸이 비어 있습니다.`);
            if (emptyTurnFound) throw new Error(`"다음에 나올 뿌요" ${index + 1}턴 앞에 비어 있는 턴이 있습니다.`);
            pairs.push([pair[0], pair[1]]);
        });
        if (!pairs.length) throw new Error('"다음에 나올 뿌요"를 한 턴 이상 채워 주세요.');
        return pairs;
    }

    /**
     * 편집 중인 값으로 PuzzlePuyoStage 객체를 만든다. 잘못된 값이 있으면 예외를 던진다.
     * @returns {object} 만들어진 PuzzlePuyoStage
     */
    function collectPuzzleStage() {
        const editor = readEditorData();
        const winConditionType = elements.winConditionType.value;
        if (!WIN_CONDITION_TYPES.some((type) => type.value === winConditionType)) throw new Error('목표 타입을 선택해 주세요.');
        let winConditionValue = 0;
        if (winConditionType !== 'clear') {
            winConditionValue = readIntegerField(elements.winConditionValue, '목표 타입 값');
            if (winConditionValue < 1) throw new Error('목표 타입 값은 1 이상의 정수여야 합니다.');
        }
        const turnLimit = readIntegerField(elements.turnLimit, '목표 턴수');
        if (turnLimit < 0) throw new Error('목표 턴수는 0 이상의 정수여야 합니다.');
        const suppliedNextPuyos = collectPuzzleNextPuyos(editor.nextPuyos);

        return new (getGameApi().PuzzlePuyoStage)({
            stageData: editor.stageData,
            suppliedNextPuyos,
            turnLimit,
            winConditionType,
            winConditionValue,
            hint: String(elements.hint.value || '').trim()
        });
    }

    /**
     * 작은따옴표 문자열에 넣을 수 있게 문자를 escape 한다.
     * @param {string} text 원본 문자열
     * @returns {string} escape 한 문자열
     */
    function escapeSingleQuoted(text) {
        return String(text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
    }

    /**
     * 색 이름 배열을 작은따옴표 목록 문자열로 바꾼다.
     * @param {string[]} colors 색 목록
     * @returns {string} 예: ['red', 'green']
     */
    function formatColorArray(colors) {
        return `[${colors.map((color) => `'${color}'`).join(', ')}]`;
    }

    /**
     * FeverStageState 생성 스크립트를 만든다.
     * @param {object} stage 대상 스테이지
     * @returns {string} 자바스크립트 코드
     */
    function formatFeverScript(stage) {
        return [
            'new FeverStageState(',
            `    ${JSON.stringify(stage.stageData)},`,
            `    ${stage.targetCombo},`,
            `    ${formatColorArray(stage.suppliedNextPuyos)},`,
            `    ${stage.difficulty},`,
            `    ${formatColorArray(stage.usingColors)}`,
            ')'
        ].join('\n');
    }

    /**
     * PuzzlePuyoStage 생성 스크립트를 만든다.
     * @param {object} stage 대상 스테이지
     * @returns {string} 자바스크립트 코드
     */
    function formatPuzzleScript(stage) {
        const suppliedText = `[${stage.suppliedNextPuyos.map((pair) => formatColorArray(pair)).join(', ')}]`;
        return [
            'new PuzzlePuyoStage({',
            `    stageData : ${JSON.stringify(stage.stageData)},`,
            `    suppliedNextPuyos : ${suppliedText},`,
            `    turnLimit : ${stage.turnLimit},`,
            `    winConditionType : '${stage.winConditionType}',`,
            `    winConditionValue : ${stage.winConditionValue},`,
            `    hint : '${escapeSingleQuoted(stage.hint)}'`,
            '})'
        ].join('\n');
    }

    /**
     * 편집 중인 내용을 검사한 뒤 자바스크립트 코드를 출력 영역에 적는다.
     * @returns {void}
     */
    function generateScript() {
        try {
            if (currentMode === 'fever') {
                elements.output.value = formatFeverScript(collectFeverStage());
            } else {
                elements.output.value = formatPuzzleScript(collectPuzzleStage());
            }
            setStatus('스크립트를 생성했습니다.', 'done');
        } catch (error) {
            elements.output.value = '';
            setStatus(`스크립트 생성 실패: ${error.message}`, 'error');
        }
    }

    /**
     * 테스트 진행 여부에 맞춰 화면 조작 가능 상태를 바꾼다.
     * @param {boolean} running 테스트 진행 중 여부
     * @returns {void}
     */
    function setTesting(running) {
        testing = running;
        [elements.testButton, elements.generateButton, elements.feverModeButton, elements.puzzleModeButton].forEach((button) => {
            if (button) button.disabled = running;
        });
        elements.sidebar.querySelectorAll('input, select').forEach((field) => { field.disabled = running; });
        if (!running && currentMode === 'puzzle' && elements.winConditionType) refreshWinConditionValueState();
    }

    /**
     * 편집 중인 내용으로 실제 게임 진행 코드를 사용해 테스트를 시작한다.
     * @returns {void}
     */
    function runTest() {
        let stage = null;
        try {
            stage = currentMode === 'fever' ? collectFeverStage() : collectPuzzleStage();
        } catch (error) {
            setStatus(`테스트 실패: ${error.message}`, 'error');
            return;
        }
        try {
            setTesting(true);
            // 키보드 조작이 입력 칸으로 새지 않도록 포커스를 캔버스 쪽으로 옮긴다.
            if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
            const onFinish = () => {
                setTesting(false);
                setStatus('테스트를 마치고 편집 모드로 돌아왔습니다.', 'done');
            };
            if (currentMode === 'fever') getToolsApi().startFeverTest(stage, onFinish);
            else getToolsApi().startPuzzleTest(stage, onFinish);
            setStatus(currentMode === 'fever'
                ? '피버 테스트 중입니다. 키보드로 조작하세요. (ESC: 일시정지)'
                : '퍼즐뿌요 테스트 중입니다. 키보드로 조작하세요. (ESC: 일시정지)');
        } catch (error) {
            setTesting(false);
            setStatus(`테스트 실패: ${error.message}`, 'error');
        }
    }

    /**
     * 게임 캔버스를 캔버스 영역 안에서 16 : 9 비율로 맞춘다.
     * puyow.js의 실행용 레이아웃은 화면 전체 기준이라 도구 화면에서는 여기서 직접 크기를 정한다.
     * @returns {void}
     */
    function resizeCanvasRoot() {
        if (!elements.canvasHost || !elements.canvasRoot || elements.right.hidden) return;
        const style = window.getComputedStyle(elements.canvasHost);
        const width = elements.canvasHost.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const height = elements.canvasHost.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        if (!(width > 0) || !(height > 0)) return;
        const scale = Math.min(width / 1280, height / 720);
        elements.canvasRoot.style.width = `${Math.floor(1280 * scale)}px`;
        elements.canvasRoot.style.height = `${Math.floor(720 * scale)}px`;
    }

    /** 캔버스 영역의 크기 변화를 지켜보며 게임 화면 크기를 다시 맞춘다. @returns {void} */
    function observeCanvasSize() {
        if (typeof ResizeObserver !== 'function') return;
        canvasResizeObserver = new ResizeObserver(() => resizeCanvasRoot());
        canvasResizeObserver.observe(elements.canvasHost);
    }

    /**
     * 개발용 도구 화면을 지정한 요소 안에 만든다.
     * @param {HTMLElement|string} target 도구를 넣을 요소 또는 그 id
     * @returns {void}
     */
    function initialize(target) {
        if (rootElement) return;
        const element = typeof target === 'string' ? document.getElementById(target) : target;
        if (!element) throw new Error('개발용 도구를 넣을 요소를 찾을 수 없습니다.');
        rootElement = element;
        prepareStyle();
        buildLayout();
        if (window.innerWidth < window.innerHeight) {
            setStatus('가로가 더 넓은 화면에서 사용해 주세요.', 'error');
        }
    }

    /**
     * 개발용 도구 화면을 해제한다.
     * @returns {void}
     */
    function destroy() {
        if (!rootElement) return;
        window.removeEventListener('resize', resizeCanvasRoot);
        rootElement.removeEventListener('keydown', stopKeyEventForFormField);
        canvasResizeObserver?.disconnect();
        canvasResizeObserver = null;
        if (gameInitialized) getGameApi().destroy();
        gameInitialized = false;
        rootElement.classList.remove('puyow-tools');
        rootElement.textContent = '';
        rootElement = null;
        currentMode = null;
        testing = false;
        Object.keys(elements).forEach((key) => { delete elements[key]; });
    }

    window.PuyoWTools = { initialize, destroy };
})();
