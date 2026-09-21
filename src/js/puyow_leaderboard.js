/*
    뿌요 W 리더보드 화면용 스크립트

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

    이 파일은 leaderboard.html 전용이다. 게임 페이지(puyow.html)는 이 파일을 읽지 않는다.
    기록 데이터 읽기·룰/적 목록·게임 문구 번역은 puyow.js가 내보내는 PuyoW.leaderboard API를 그대로 쓰고,
    화면 구성(좌측 트리 메뉴, 우측 점수 목록, 화면 모드, 다국어)은 이 파일이 맡는다.
    게임은 초기화(PuyoW.initialize)하지 않는다.
*/
(function () {
    'use strict';

    /** 지원 언어다. 기본 언어는 영어이며, 영어 원문을 번역 키로 쓴다. */
    const SUPPORTED_LANGUAGES = [
        { code: 'en', label: 'English' },
        { code: 'ko', label: '한국어' },
        { code: 'ja', label: '日本語' },
        { code: 'zh', label: '中文' },
        { code: 'de', label: 'Deutsch' },
        { code: 'fr', label: 'Français' }
    ];

    /** 이 화면에서만 쓰는 문구의 번역표다. 영어 원문이 키이며, 새 문구는 다섯 언어에 모두 넣는다. */
    const LEADERBOARD_STRINGS = {
        ko: {
            'Leaderboard': '리더보드',
            'Top %1 scores per rule': '룰별 상위 %1위 점수',
            'Rank': '순위',
            'Nickname': '닉네임',
            'Score': '점수',
            'Recorded at': '기록 일시',
            'No records yet.': '아직 기록이 없습니다.',
            'Select a rule and its options from the menu.': '메뉴에서 룰과 세부 항목을 선택하세요.',
            'Select an AI difficulty.': 'AI 난이도를 선택하세요.',
            'Battles are ranked separately by AI difficulty, color count, and opponent.': '적이 있는 대전은 AI 난이도·색상 수·적마다 따로 기록됩니다.',
            'Select a color count.': '색상 수를 선택하세요.',
            'Select an opponent.': '적을 선택하세요.',
            'Only wins against this opponent are recorded.': '이 적에게 승리한 대전만 기록됩니다.',
            'The final score is recorded when you lose.': '패배했을 때의 최종 점수가 기록됩니다.',
            'Records are saved only in this browser.': '기록은 이 브라우저에만 저장됩니다.',
            'Combined ranking': '통합 순위',
            'Conditions': '조건',
            'This ranking combines every record saved under this rule.': '이 룰에 저장된 모든 기록을 합쳐 매긴 순위입니다.',
            'Dark mode': '다크 모드',
            'Language': '언어',
            'Back to game': '게임으로 돌아가기',
            'Menu': '메뉴',
            'Unknown opponent': '알 수 없는 적'
        },
        ja: {
            'Leaderboard': 'リーダーボード',
            'Top %1 scores per rule': 'ルール別 上位%1位のスコア',
            'Rank': '順位',
            'Nickname': 'ニックネーム',
            'Score': 'スコア',
            'Recorded at': '記録日時',
            'No records yet.': 'まだ記録がありません。',
            'Select a rule and its options from the menu.': 'メニューからルールと項目を選んでください。',
            'Select an AI difficulty.': 'AIの難易度を選んでください。',
            'Battles are ranked separately by AI difficulty, color count, and opponent.': '対戦はAIの難易度・色数・対戦相手ごとに別々に記録されます。',
            'Select a color count.': '色数を選んでください。',
            'Select an opponent.': '対戦相手を選んでください。',
            'Only wins against this opponent are recorded.': 'この相手に勝利した対戦だけが記録されます。',
            'The final score is recorded when you lose.': '負けたときの最終スコアが記録されます。',
            'Records are saved only in this browser.': '記録はこのブラウザにのみ保存されます。',
            'Combined ranking': '統合ランキング',
            'Conditions': '条件',
            'This ranking combines every record saved under this rule.': 'このルールに保存されたすべての記録をまとめたランキングです。',
            'Dark mode': 'ダークモード',
            'Language': '言語',
            'Back to game': 'ゲームに戻る',
            'Menu': 'メニュー',
            'Unknown opponent': '不明な相手'
        },
        zh: {
            'Leaderboard': '排行榜',
            'Top %1 scores per rule': '各规则前%1名分数',
            'Rank': '名次',
            'Nickname': '昵称',
            'Score': '分数',
            'Recorded at': '记录时间',
            'No records yet.': '暂无记录。',
            'Select a rule and its options from the menu.': '请从菜单中选择规则和选项。',
            'Select an AI difficulty.': '请选择AI难度。',
            'Battles are ranked separately by AI difficulty, color count, and opponent.': '对战按AI难度、颜色数和对手分别记录。',
            'Select a color count.': '请选择颜色数。',
            'Select an opponent.': '请选择对手。',
            'Only wins against this opponent are recorded.': '只记录战胜该对手的对战。',
            'The final score is recorded when you lose.': '记录失败时的最终分数。',
            'Records are saved only in this browser.': '记录只保存在此浏览器中。',
            'Combined ranking': '综合排行',
            'Conditions': '条件',
            'This ranking combines every record saved under this rule.': '汇总该规则下保存的所有记录的排行榜。',
            'Dark mode': '深色模式',
            'Language': '语言',
            'Back to game': '返回游戏',
            'Menu': '菜单',
            'Unknown opponent': '未知对手'
        },
        de: {
            'Leaderboard': 'Bestenliste',
            'Top %1 scores per rule': 'Top %1 Punktzahlen je Regel',
            'Rank': 'Rang',
            'Nickname': 'Spielername',
            'Score': 'Punkte',
            'Recorded at': 'Datum',
            'No records yet.': 'Noch keine Einträge.',
            'Select a rule and its options from the menu.': 'Wähle im Menü eine Regel und ihre Optionen.',
            'Select an AI difficulty.': 'Wähle einen KI-Schwierigkeitsgrad.',
            'Battles are ranked separately by AI difficulty, color count, and opponent.': 'Duelle werden je KI-Schwierigkeit, Farbanzahl und Gegner getrennt gespeichert.',
            'Select a color count.': 'Wähle die Anzahl der Farben.',
            'Select an opponent.': 'Wähle einen Gegner.',
            'Only wins against this opponent are recorded.': 'Nur Siege gegen diesen Gegner werden gespeichert.',
            'The final score is recorded when you lose.': 'Gespeichert wird die Endpunktzahl bei einer Niederlage.',
            'Records are saved only in this browser.': 'Einträge werden nur in diesem Browser gespeichert.',
            'Combined ranking': 'Gesamtwertung',
            'Conditions': 'Bedingungen',
            'This ranking combines every record saved under this rule.': 'Diese Wertung fasst alle unter dieser Regel gespeicherten Einträge zusammen.',
            'Dark mode': 'Dunkelmodus',
            'Language': 'Sprache',
            'Back to game': 'Zurück zum Spiel',
            'Menu': 'Menü',
            'Unknown opponent': 'Unbekannter Gegner'
        },
        fr: {
            'Leaderboard': 'Classement',
            'Top %1 scores per rule': 'Top %1 des scores par règle',
            'Rank': 'Rang',
            'Nickname': 'Pseudo',
            'Score': 'Score',
            'Recorded at': 'Date',
            'No records yet.': 'Aucun score pour le moment.',
            'Select a rule and its options from the menu.': 'Choisis une règle et ses options dans le menu.',
            'Select an AI difficulty.': 'Choisis une difficulté de l’IA.',
            'Battles are ranked separately by AI difficulty, color count, and opponent.': 'Les duels sont enregistrés séparément par difficulté de l’IA, nombre de couleurs et adversaire.',
            'Select a color count.': 'Choisis le nombre de couleurs.',
            'Select an opponent.': 'Choisis un adversaire.',
            'Only wins against this opponent are recorded.': 'Seules les victoires contre cet adversaire sont enregistrées.',
            'The final score is recorded when you lose.': 'Le score final est enregistré lorsque tu perds.',
            'Records are saved only in this browser.': 'Les scores sont enregistrés uniquement dans ce navigateur.',
            'Combined ranking': 'Classement global',
            'Conditions': 'Conditions',
            'This ranking combines every record saved under this rule.': 'Ce classement regroupe tous les scores enregistrés pour cette règle.',
            'Dark mode': 'Mode sombre',
            'Language': 'Langue',
            'Back to game': 'Retour au jeu',
            'Menu': 'Menu',
            'Unknown opponent': 'Adversaire inconnu'
        }
    };

    /** 트리 메뉴의 룰 옆에 찍는 점 색이다. 게임의 규칙 선택 버튼 색 계열을 따른다. */
    const RULE_DOT_COLORS = {
        standard: '#43a047',
        fever: '#e0409f',
        fever_start: '#8e5ccf',
        practice: '#66bb6a',
        continuous_fever: '#e57bd0'
    };

    /** 초기화한 화면 상태다. 초기화 전에는 null이다. */
    let state = null;
    /** WebMCP 도구 등록을 한 번에 해제할 컨트롤러다. */
    let mcpAbortController = null;

    /** 브라우저 언어에서 지원 언어 코드를 고른다. 지원하지 않으면 영어다. @returns {string} 언어 코드 */
    function detectLanguage() {
        const raw = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'en';
        const code = String(raw).trim().slice(0, 2).toLowerCase();
        return SUPPORTED_LANGUAGES.some((language) => language.code === code) ? code : 'en';
    }

    /**
     * 이 화면 문구(영어 원문 키)를 현재 언어로 번역하고 %1, %2 를 채운다.
     * @param {string} text 영어 원문
     * @param {...(string|number)} values 치환할 값
     * @returns {string} 표시할 문구
     */
    function translate(text, ...values) {
        const table = LEADERBOARD_STRINGS[state?.language];
        const translated = (table && table[text]) || text;
        return values.reduce((result, value, index) => result.replace(`%${index + 1}`, String(value)), translated);
    }

    /** 게임 번역표(한국어 원문 키)로 현재 언어 문구를 얻는다. @param {string} koreanText 한국어 원문 @returns {string} 번역 */
    function translateGame(koreanText) {
        return state.api.translate(state.language, koreanText);
    }

    /** 룰 표시 이름이다. @param {{label:string}} rule 룰 @returns {string} 이름 */
    function getRuleName(rule) {
        return translateGame(rule.label);
    }

    /** 색 수 표시 이름이다. @param {number} colorCount 색 수 @returns {string} 이름 */
    function getColorName(colorCount) {
        return translateGame(`${colorCount}색`);
    }

    /** AI 난이도 표시 이름이다. @param {string} difficultyKey 난이도 키 @returns {string} 이름 */
    function getDifficultyName(difficultyKey) {
        const difficulty = state.difficulties.find((entry) => entry.key === difficultyKey);
        return difficulty ? translateGame(difficulty.label) : difficultyKey;
    }

    /** 적 표시 이름이다. 등록되지 않은 적(외부 확장 등)은 classType을 그대로 쓴다. @param {string} classType 적 종류 @returns {string} 이름 */
    function getOpponentName(classType) {
        const opponent = state.opponents.find((entry) => entry.classType === classType);
        return opponent ? translateGame(opponent.name) : classType || translate('Unknown opponent');
    }

    /** 점수를 현재 언어의 천 단위 구분으로 표시한다. @param {number} score 점수 @returns {string} 표시 문자열 */
    function formatScore(score) {
        try {
            return new Intl.NumberFormat(state.language).format(score);
        } catch (error) {
            return String(score);
        }
    }

    /**
     * 기록 일시를 현재 언어의 날짜·시간 형식으로 표시한다. 브라우저의 현지 시간대를 쓴다.
     * 일시가 없는 예전 기록은 대시(-)로 표시한다.
     * @param {number|null} recordedAt 기록 시각(밀리초)
     * @returns {string} 표시 문자열
     */
    function formatRecordedAt(recordedAt) {
        if (recordedAt === null || recordedAt === undefined) return '-';
        const date = new Date(recordedAt);
        if (Number.isNaN(date.getTime())) return '-';
        try {
            return new Intl.DateTimeFormat(state.language, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
        } catch (error) {
            return date.toLocaleString();
        }
    }

    /** DOM 요소를 만든다. @param {string} tag 태그 @param {object} [props] 속성 @param {...(Node|string)} children 자식 @returns {HTMLElement} 요소 */
    function createElement(tag, props = {}, ...children) {
        const element = document.createElement(tag);
        Object.entries(props).forEach(([key, value]) => {
            if (value === null || value === undefined || value === false) return;
            if (key === 'className') element.className = value;
            else if (key === 'text') element.textContent = value;
            else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
            else element.setAttribute(key, value === true ? '' : String(value));
        });
        children.flat().forEach((child) => {
            if (child === null || child === undefined) return;
            element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });
        return element;
    }

    /**
     * 선택 경로로 순위 목록을 꺼낸다.
     * 대전 룰은 룰 → AI 난이도 → 색 수 → 적, 단독 룰은 룰 → 색 수가 끝까지 정해져야 한다.
     * @param {{rule:string, difficulty:string|null, colors:number|null, opponent:string|null}} selection 선택 경로
     * @returns {{name:string, score:number, recordedAt:number|null}[]|null} 순위 목록, 경로가 끝까지 정해지지 않았으면 null
     */
    function getRecordList(selection) {
        const rule = state.rules.find((entry) => entry.key === selection.rule);
        if (!rule) return null;
        const byRule = state.data.records[rule.key];
        if (!rule.battle) {
            if (!selection.colors) return null;
            const list = byRule?.[String(selection.colors)];
            return Array.isArray(list) ? list : [];
        }
        if (!selection.difficulty || !selection.colors || !selection.opponent) return null;
        return byRule?.[selection.difficulty]?.[String(selection.colors)]?.[selection.opponent] || [];
    }

    /**
     * 대전 룰·AI 난이도·색 수에서 트리에 보일 적 목록이다. 등록 적 전체 뒤에 기록만 있는 적(외부 확장 등)을 붙인다.
     * @param {string} ruleKey 룰 @param {string} difficultyKey AI 난이도 @param {number} colorCount 색 수
     * @returns {string[]} 적 종류 목록
     */
    function getOpponentTypes(ruleKey, difficultyKey, colorCount) {
        const types = state.opponents.map((entry) => entry.classType);
        const recorded = Object.keys(state.data.records[ruleKey]?.[difficultyKey]?.[String(colorCount)] || {});
        recorded.forEach((classType) => { if (!types.includes(classType)) types.push(classType); });
        return types;
    }

    /**
     * 룰 하나에 저장된 모든 기록을 합친 통합 순위다. 대전 룰은 AI 난이도·색 수·적을, 단독 룰은 색 수를 모두 합친다.
     * 기록 형식과 저장 구조는 그대로 두고, 화면에 보일 때만 산출한다.
     * @param {string} ruleKey 룰 키
     * @returns {{name:string, score:number, recordedAt:number|null, difficulty:string|null, colors:number, opponent:string|null}[]} 점수 내림차순 순위(최대 MAX_ENTRIES개)
     */
    function getCombinedRecordList(ruleKey) {
        const rule = state.rules.find((entry) => entry.key === ruleKey);
        if (!rule) return [];
        const byRule = state.data.records[ruleKey] || {};
        const merged = [];
        const collect = (list, difficulty, colorCount, opponent) => {
            if (!Array.isArray(list)) return;
            list.forEach((entry) => merged.push({ ...entry, difficulty, colors: colorCount, opponent }));
        };
        if (!rule.battle) {
            state.colorCounts.forEach((colorCount) => collect(byRule[String(colorCount)], null, colorCount, null));
        } else {
            state.difficulties.forEach((difficulty) => {
                state.colorCounts.forEach((colorCount) => {
                    const byEnemy = byRule[difficulty.key]?.[String(colorCount)];
                    if (!byEnemy) return;
                    getOpponentTypes(ruleKey, difficulty.key, colorCount).forEach((classType) => collect(byEnemy[classType], difficulty.key, colorCount, classType));
                });
            });
        }
        // 게임의 순위 정리와 같게 점수 내림차순으로 자른다. 동점은 합친 순서(AI 난이도 → 색 수 → 적)를 유지한다.
        return merged.sort((left, right) => right.score - left.score).slice(0, state.api.MAX_ENTRIES);
    }

    /** 통합 순위에서 그 기록이 나온 조건 이름이다. @param {{difficulty:string|null, colors:number, opponent:string|null}} entry 기록 @returns {string} 조건 이름 */
    function getRecordConditionName(entry) {
        return [
            entry.difficulty ? getDifficultyName(entry.difficulty) : null,
            entry.colors ? getColorName(entry.colors) : null,
            entry.opponent ? getOpponentName(entry.opponent) : null
        ].filter(Boolean).join(' · ');
    }

    /** 트리 노드 id를 만든다. @param {...(string|number)} parts 경로 @returns {string} id */
    function nodeId(...parts) {
        return parts.join('/');
    }

    /** 선택을 트리 노드 id로 바꾼다. @param {{rule:string, difficulty:string|null, colors:number|null, opponent:string|null}|null} selection 선택 @returns {string|null} id */
    function selectionToNodeId(selection) {
        if (!selection) return null;
        return nodeId(...[selection.rule, selection.difficulty, selection.colors, selection.opponent].filter((part) => part !== null && part !== undefined));
    }

    /** 선택이 끝 항목(순위 목록을 보여 줄 수 있는 항목)인지 확인한다. @param {{rule:string, difficulty:string|null, colors:number|null, opponent:string|null}} selection 선택 @returns {boolean} 끝 항목 여부 */
    function isLeafSelection(selection) {
        const rule = state.rules.find((entry) => entry.key === selection.rule);
        if (!rule) return false;
        return rule.battle ? Boolean(selection.difficulty && selection.colors && selection.opponent) : Boolean(selection.colors);
    }

    /**
     * 선택이 룰 자체(하위 항목을 하나도 고르지 않음)인지 확인한다. 이때는 룰 내 통합 순위를 보여 준다.
     * @param {{rule:string, difficulty:string|null, colors:number|null, opponent:string|null}} selection 선택
     * @returns {boolean} 룰만 고른 선택인지 여부
     */
    function isRuleSelection(selection) {
        return Boolean(selection) && !selection.difficulty && !selection.colors && !selection.opponent;
    }

    /**
     * 트리 버튼 하나를 만든다.
     * @param {{id:string, label:string, level:number, leaf:boolean, count:number|null, dotColor?:string, onActivate:()=>void}} options 노드 정보
     * @returns {HTMLButtonElement} 버튼
     */
    function createTreeButton(options) {
        const expanded = !options.leaf && state.expanded.has(options.id);
        const current = selectionToNodeId(state.selection) === options.id;
        const button = createElement('button', {
            type: 'button',
            className: `lb-node lb-node-level-${options.level}${options.leaf ? ' lb-node-leaf' : ''}${options.level === 1 ? ' lb-node-rule' : ''}`,
            'data-node-id': options.id,
            'aria-expanded': options.leaf ? null : String(expanded),
            'aria-current': current ? 'true' : null,
            onClick: options.onActivate
        },
        createElement('span', { className: 'lb-caret', 'aria-hidden': 'true', text: '▶' }),
        options.dotColor ? createElement('span', { className: 'lb-rule-dot', style: `background:${options.dotColor}`, 'aria-hidden': 'true' }) : null,
        createElement('span', { className: 'lb-node-label', text: options.label }),
        options.count !== null ? createElement('span', { className: 'lb-count', text: String(options.count) }) : null);
        return button;
    }

    /** 가지 노드를 펼치거나 접는다. @param {string} id 노드 id @returns {void} */
    function toggleExpanded(id) {
        if (state.expanded.has(id)) state.expanded.delete(id);
        else state.expanded.add(id);
        renderTree(id);
    }

    /**
     * 선택을 바꾸고 화면을 다시 그린다. 가지(룰, 대전 룰의 AI 난이도·색 수)를 고르면 펼치고 안내만 보여 준다.
     * @param {{rule:string, difficulty?:string|null, colors?:number|null, opponent?:string|null}} selection 선택
     * @param {{toggle?:boolean, focus?:boolean}} [options] toggle이면 이미 펼친 가지를 접는다.
     * @returns {void}
     */
    function select(selection, options = {}) {
        const rule = state.rules.find((entry) => entry.key === selection.rule);
        // 단독 룰에는 AI 난이도·적 단계가 없다.
        const next = {
            rule: selection.rule,
            difficulty: rule?.battle ? selection.difficulty ?? null : null,
            colors: selection.colors ?? null,
            opponent: rule?.battle ? selection.opponent ?? null : null
        };
        const id = selectionToNodeId(next);
        const isLeaf = isLeafSelection(next);
        if (!isLeaf && options.toggle && state.expanded.has(id) && selectionToNodeId(state.selection) === id) {
            state.expanded.delete(id);
        } else {
            // 선택한 노드까지의 모든 상위 가지를 펼친다.
            const parts = id.split('/');
            for (let length = 1; length <= (isLeaf ? parts.length - 1 : parts.length); length += 1) state.expanded.add(parts.slice(0, length).join('/'));
        }
        state.selection = next;
        // 좁은 화면에서는 끝 항목을 고르면 서랍 메뉴를 닫고 점수 목록을 보여 준다.
        if (isLeaf) setMenuOpen(false);
        renderTree(options.focus === false ? null : id);
        renderMain();
    }

    /**
     * 좌측 트리 메뉴를 다시 그린다.
     * @param {string|null} [focusId] 다시 그린 뒤 포커스를 둘 노드 id
     * @returns {void}
     */
    function renderTree(focusId = null) {
        const tree = createElement('ul', { className: 'lb-tree', 'aria-label': translate('Leaderboard') });
        state.rules.forEach((rule) => {
            const ruleId = nodeId(rule.key);
            const ruleItem = createElement('li', {}, createTreeButton({
                id: ruleId, label: getRuleName(rule), level: 1, leaf: false, count: null, dotColor: RULE_DOT_COLORS[rule.key],
                onActivate: () => select({ rule: rule.key }, { toggle: true })
            }));
            const childList = createElement('ul', { hidden: !state.expanded.has(ruleId) });
            if (!rule.battle) {
                // 단독 룰: 룰 → 색 수(끝 항목)
                state.colorCounts.forEach((colorCount) => {
                    const list = state.data.records[rule.key]?.[String(colorCount)];
                    childList.appendChild(createElement('li', {}, createTreeButton({
                        id: nodeId(rule.key, colorCount), label: getColorName(colorCount), level: 2, leaf: true, count: Array.isArray(list) ? list.length : 0,
                        onActivate: () => select({ rule: rule.key, colors: colorCount })
                    })));
                });
            } else {
                // 적이 있는 대전 룰: 룰 → AI 난이도 → 색 수 → 적(끝 항목)
                state.difficulties.forEach((difficulty) => {
                    const difficultyId = nodeId(rule.key, difficulty.key);
                    const difficultyItem = createElement('li', {}, createTreeButton({
                        id: difficultyId, label: getDifficultyName(difficulty.key), level: 2, leaf: false, count: null,
                        onActivate: () => select({ rule: rule.key, difficulty: difficulty.key }, { toggle: true })
                    }));
                    const colorList = createElement('ul', { hidden: !state.expanded.has(difficultyId) });
                    state.colorCounts.forEach((colorCount) => {
                        const colorId = nodeId(rule.key, difficulty.key, colorCount);
                        const byEnemy = state.data.records[rule.key]?.[difficulty.key]?.[String(colorCount)];
                        const colorItem = createElement('li', {}, createTreeButton({
                            id: colorId, label: getColorName(colorCount), level: 3, leaf: false, count: null,
                            onActivate: () => select({ rule: rule.key, difficulty: difficulty.key, colors: colorCount }, { toggle: true })
                        }));
                        const opponentList = createElement('ul', { hidden: !state.expanded.has(colorId) });
                        getOpponentTypes(rule.key, difficulty.key, colorCount).forEach((classType) => {
                            opponentList.appendChild(createElement('li', {}, createTreeButton({
                                id: nodeId(rule.key, difficulty.key, colorCount, classType), label: getOpponentName(classType), level: 4, leaf: true,
                                count: byEnemy?.[classType]?.length || 0,
                                onActivate: () => select({ rule: rule.key, difficulty: difficulty.key, colors: colorCount, opponent: classType })
                            })));
                        });
                        colorItem.appendChild(opponentList);
                        colorList.appendChild(colorItem);
                    });
                    difficultyItem.appendChild(colorList);
                    childList.appendChild(difficultyItem);
                });
            }
            ruleItem.appendChild(childList);
            tree.appendChild(ruleItem);
        });
        // 다시 그리면 포커스된 버튼이 사라지므로, 그 전에 트리 안에 포커스가 있었는지 먼저 확인한다.
        const hadFocus = state.elements.treeWrap.contains(document.activeElement);
        state.elements.treeWrap.replaceChildren(tree);
        if (focusId && hadFocus) {
            const target = Array.from(tree.querySelectorAll('.lb-node')).find((button) => button.getAttribute('data-node-id') === focusId);
            target?.focus();
        }
    }

    /** 트리에서 화면에 보이는 노드 버튼 목록이다. @returns {HTMLButtonElement[]} 버튼 */
    function getVisibleTreeButtons() {
        return Array.from(state.elements.treeWrap.querySelectorAll('.lb-node')).filter((button) => !button.closest('ul[hidden]'));
    }

    /**
     * 트리 키보드 조작이다. 위아래는 보이는 노드 사이 이동, 오른쪽은 펼치기·첫 하위로 이동, 왼쪽은 접기·상위로 이동이다.
     * Enter·Space는 버튼 기본 동작(클릭)을 그대로 쓴다.
     * @param {KeyboardEvent} event 키 이벤트
     * @returns {void}
     */
    function handleTreeKeydown(event) {
        const button = event.target.closest?.('.lb-node');
        if (!button) return;
        const buttons = getVisibleTreeButtons();
        const index = buttons.indexOf(button);
        const id = button.getAttribute('data-node-id');
        const expandable = button.hasAttribute('aria-expanded');
        const expanded = button.getAttribute('aria-expanded') === 'true';
        let handled = true;
        if (event.key === 'ArrowDown') buttons[Math.min(buttons.length - 1, index + 1)]?.focus();
        else if (event.key === 'ArrowUp') buttons[Math.max(0, index - 1)]?.focus();
        else if (event.key === 'Home') buttons[0]?.focus();
        else if (event.key === 'End') buttons[buttons.length - 1]?.focus();
        else if (event.key === 'ArrowRight') {
            if (expandable && !expanded) toggleExpanded(id);
            else if (expandable) buttons[index + 1]?.focus();
        } else if (event.key === 'ArrowLeft') {
            if (expandable && expanded) toggleExpanded(id);
            else {
                const parentId = id.split('/').slice(0, -1).join('/');
                if (parentId) buttons.find((item) => item.getAttribute('data-node-id') === parentId)?.focus();
            }
        } else handled = false;
        if (handled) event.preventDefault();
    }

    /** 우측 본문(제목과 점수 목록)을 다시 그린다. @returns {void} */
    function renderMain() {
        const { breadcrumb, title, note, card } = state.elements;
        const selection = state.selection;
        const rule = selection ? state.rules.find((entry) => entry.key === selection.rule) : null;
        if (!rule) {
            card.classList.remove('lb-card-wide');
            breadcrumb.textContent = '';
            title.textContent = translate('Leaderboard');
            note.textContent = translate('Records are saved only in this browser.');
            card.replaceChildren(createElement('div', { className: 'lb-empty', text: translate('Select a rule and its options from the menu.') }));
            return;
        }
        // 룰 이름 항목을 직접 고르면 그 룰의 하위 기록을 모두 합친 통합 순위를 보여 준다.
        const combined = isRuleSelection(selection);
        const path = [getRuleName(rule)];
        if (selection.difficulty) path.push(getDifficultyName(selection.difficulty));
        if (selection.colors) path.push(getColorName(selection.colors));
        if (selection.opponent) path.push(getOpponentName(selection.opponent));
        breadcrumb.textContent = combined ? getRuleName(rule) : path.slice(0, -1).join(' › ');
        title.textContent = combined ? translate('Combined ranking') : path[path.length - 1];
        if (combined) {
            note.textContent = `${translate('This ranking combines every record saved under this rule.')} ${translate('Records are saved only in this browser.')}`;
        } else {
            note.textContent = rule.battle
                ? `${translate('Battles are ranked separately by AI difficulty, color count, and opponent.')} ${translate('Only wins against this opponent are recorded.')} ${translate('Records are saved only in this browser.')}`
                : `${translate('The final score is recorded when you lose.')} ${translate('Records are saved only in this browser.')}`;
        }
        // 통합 순위는 조건 칸이 하나 더 붙으므로 표를 조금 넓게 쓴다.
        card.classList.toggle('lb-card-wide', combined);
        const list = combined ? getCombinedRecordList(rule.key) : getRecordList(selection);
        if (list === null) {
            let guide = 'Select a color count.';
            if (rule.battle && !selection.difficulty) guide = 'Select an AI difficulty.';
            else if (rule.battle && selection.colors) guide = 'Select an opponent.';
            card.replaceChildren(createElement('div', { className: 'lb-empty', text: translate(guide) }));
            return;
        }
        if (list.length === 0) {
            card.replaceChildren(createElement('div', { className: 'lb-empty', text: translate('No records yet.') }));
            return;
        }
        const body = createElement('tbody', {}, list.map((entry, index) => createElement('tr', {},
            createElement('td', { className: 'lb-col-rank' }, createElement('span', { className: `lb-rank lb-rank-${index + 1}`, text: String(index + 1) })),
            // 닉네임은 사용자가 입력한 값이므로 textContent로만 넣는다.
            createElement('td', { className: 'lb-col-name', text: entry.name }),
            combined ? createElement('td', { className: 'lb-col-condition', text: getRecordConditionName(entry) }) : null,
            createElement('td', { className: 'lb-col-score', text: formatScore(entry.score) }),
            createElement('td', {
                className: 'lb-col-date',
                text: formatRecordedAt(entry.recordedAt),
                title: entry.recordedAt !== null && entry.recordedAt !== undefined ? new Date(entry.recordedAt).toISOString() : null
            }))));
        card.replaceChildren(createElement('table', { className: combined ? 'lb-table lb-table-combined' : 'lb-table' },
            createElement('thead', {}, createElement('tr', {},
                createElement('th', { className: 'lb-col-rank', scope: 'col', text: translate('Rank') }),
                createElement('th', { className: 'lb-col-name', scope: 'col', text: translate('Nickname') }),
                combined ? createElement('th', { className: 'lb-col-condition', scope: 'col', text: translate('Conditions') }) : null,
                createElement('th', { className: 'lb-col-score', scope: 'col', text: translate('Score') }),
                createElement('th', { className: 'lb-col-date', scope: 'col', text: translate('Recorded at') }))),
            body));
    }

    /** 사이드바의 고정 문구(제목·하단 설정)를 현재 언어로 다시 쓴다. @returns {void} */
    function renderStaticTexts() {
        const { brandTitle, brandSub, themeLabel, languageLabel, backLink, menuButton } = state.elements;
        document.documentElement.lang = state.language;
        document.title = `Puyo W ${translate('Leaderboard')}`;
        brandTitle.textContent = translate('Leaderboard');
        brandSub.textContent = translate('Top %1 scores per rule', state.api.MAX_ENTRIES);
        themeLabel.textContent = translate('Dark mode');
        languageLabel.textContent = translate('Language');
        backLink.textContent = translate('Back to game');
        menuButton.textContent = `☰ ${translate('Menu')}`;
    }

    /** 화면 모드를 적용한다. @param {'dark'|'light'} theme 화면 모드 @returns {void} */
    function applyTheme(theme) {
        state.theme = theme === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        state.elements.themeToggle.setAttribute('aria-checked', String(state.theme === 'dark'));
    }

    /** 시스템 화면 모드를 읽는다. 알 수 없으면 다크다. @returns {'dark'|'light'} 화면 모드 */
    function detectSystemTheme() {
        try {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        } catch (error) {
            return 'dark';
        }
    }

    /** 좁은 화면의 서랍 메뉴를 열거나 닫는다. @param {boolean} open 열기 여부 @returns {void} */
    function setMenuOpen(open) {
        state.elements.root.classList.toggle('is-menu-open', open);
        state.elements.menuButton.setAttribute('aria-expanded', String(open));
    }

    /** 언어를 바꾸고 화면 전체를 다시 그린다. @param {string} language 언어 코드 @returns {void} */
    function setLanguage(language) {
        state.language = SUPPORTED_LANGUAGES.some((entry) => entry.code === language) ? language : 'en';
        state.elements.languageSelect.value = state.language;
        renderStaticTexts();
        renderTree();
        renderMain();
    }

    /** 저장소에서 기록을 다시 읽어 화면을 갱신한다. 다른 탭에서 게임을 끝냈을 때 쓴다. @returns {void} */
    function reload() {
        state.data = state.api.getData();
        renderTree();
        renderMain();
    }

    /** 화면 골격을 만든다. @param {HTMLElement} target 넣을 요소 @returns {object} 참조할 요소 모음 */
    function buildLayout(target) {
        const elements = {};
        elements.brandTitle = createElement('div', { className: 'lb-brand-title' });
        elements.brandSub = createElement('div', { className: 'lb-brand-sub' });
        elements.treeWrap = createElement('nav', { className: 'lb-tree-wrap' });
        elements.treeWrap.addEventListener('keydown', handleTreeKeydown);
        elements.themeLabel = createElement('span');
        elements.themeToggle = createElement('button', {
            type: 'button', className: 'lb-theme-toggle', role: 'switch', 'aria-checked': 'true',
            onClick: () => {
                state.themeChosen = true;
                applyTheme(state.theme === 'dark' ? 'light' : 'dark');
            }
        }, elements.themeLabel, createElement('span', { className: 'lb-switch', 'aria-hidden': 'true' }));
        elements.languageLabel = createElement('label', { className: 'lb-footer-label', for: 'lb_language_select' });
        elements.languageSelect = createElement('select', {
            id: 'lb_language_select', className: 'lb-select',
            onChange: (event) => setLanguage(event.target.value)
        }, SUPPORTED_LANGUAGES.map((language) => createElement('option', { value: language.code, text: language.label })));
        elements.backLink = createElement('a', { className: 'lb-back-link', href: './puyow.html' });
        const sidebar = createElement('aside', { className: 'lb-sidebar' },
            createElement('div', { className: 'lb-brand' },
                createElement('img', { src: './img/icon45.png', alt: '' }),
                createElement('div', {}, elements.brandTitle, elements.brandSub)),
            elements.treeWrap,
            createElement('div', { className: 'lb-sidebar-footer' },
                createElement('div', { className: 'lb-footer-row' }, elements.languageLabel, elements.languageSelect),
                elements.themeToggle,
                elements.backLink));
        elements.menuButton = createElement('button', { type: 'button', className: 'lb-menu-button', 'aria-expanded': 'false', onClick: () => setMenuOpen(!state.elements.root.classList.contains('is-menu-open')) });
        elements.breadcrumb = createElement('p', { className: 'lb-breadcrumb' });
        elements.title = createElement('h1', { className: 'lb-title' });
        elements.note = createElement('p', { className: 'lb-note' });
        elements.card = createElement('section', { className: 'lb-card', 'aria-live': 'polite' });
        const main = createElement('main', { className: 'lb-main' },
            createElement('div', { className: 'lb-main-header' }, elements.menuButton,
                createElement('div', {}, elements.breadcrumb, elements.title, elements.note)),
            elements.card);
        const backdrop = createElement('div', { className: 'lb-backdrop', onClick: () => setMenuOpen(false) });
        elements.root = createElement('div', { className: 'lb-layout' }, sidebar, main, backdrop);
        target.replaceChildren(elements.root);
        return elements;
    }

    /**
     * WebMCP 도구에 넘길 선택 경로를 검사해 정리한다. 대전 룰에서 색 수를 주려면 AI 난이도도 함께 줘야 한다.
     * @param {object} input 도구 입력
     * @returns {{rule:string, difficulty:string|null, colors:number|null, opponent:string|null}} 선택
     */
    function normalizeMcpSelection(input) {
        const rule = state.rules.find((entry) => entry.key === input?.rule);
        if (!rule) throw new Error(`Unknown rule. Use one of: ${state.rules.map((entry) => entry.key).join(', ')}.`);
        const colors = input.colors === undefined || input.colors === null ? null : Number(input.colors);
        if (colors !== null && !state.colorCounts.includes(colors)) throw new Error(`colors must be one of ${state.colorCounts.join(', ')}.`);
        if (!rule.battle) return { rule: rule.key, difficulty: null, colors, opponent: null };
        const difficultyKeys = state.difficulties.map((entry) => entry.key);
        const difficulty = typeof input.difficulty === 'string' && input.difficulty ? input.difficulty : null;
        if (difficulty !== null && !difficultyKeys.includes(difficulty)) throw new Error(`difficulty must be one of ${difficultyKeys.join(', ')}.`);
        if (difficulty === null && colors !== null) throw new Error('Battle rules need difficulty before colors.');
        const opponent = colors !== null && typeof input.opponent === 'string' && input.opponent ? input.opponent : null;
        return { rule: rule.key, difficulty, colors, opponent };
    }

    /** 리더보드 화면의 WebMCP 도구를 등록한다. 미지원 브라우저에서는 아무 일도 하지 않는다. @returns {void} */
    function registerMcpTools() {
        if (typeof document === 'undefined' || !document.modelContext || typeof document.modelContext.registerTool !== 'function') return;
        mcpAbortController = new AbortController();
        const ruleKeys = state.rules.map((rule) => rule.key);
        const selectionSchema = {
            type: 'object',
            properties: {
                rule: { type: 'string', enum: ruleKeys, description: 'Rule key.' },
                difficulty: { type: 'string', enum: state.difficulties.map((entry) => entry.key), description: 'AI difficulty key. Used only by battle rules (standard, fever, fever_start), and required there before colors.' },
                colors: { type: 'integer', enum: state.colorCounts, description: 'Color count. Optional for leaderboard_records.' },
                opponent: { type: 'string', description: 'Opponent class type (for example Andromalius). Used only by battle rules (standard, fever, fever_start).' }
            },
            required: ['rule'],
            additionalProperties: false
        };
        const tools = [
            {
                name: 'leaderboard_manual',
                description: 'Return English instructions for the Puyo W leaderboard page and its tools.',
                inputSchema: { type: 'object', properties: {}, additionalProperties: false },
                annotations: { readOnlyHint: true },
                execute: () => [
                    `This page shows the top ${state.api.MAX_ENTRIES} Puyo W scores stored only in this browser (localStorage key ${state.api.STORE_KEY}), each with the player name used when the score was made and the date and time when it was recorded (the wall-clock time at the end of the game, not the match duration). Play time is not recorded.`,
                    'Battle rules (standard, fever, fever_start) keep a separate ranking per AI difficulty, color count, and opponent, and record the final score only when the human player wins. The tree menu goes rule, AI difficulty, color count, then opponent. Matches against Solomon are never recorded.',
                    'Solo rules (practice, continuous_fever) keep a separate ranking per color count and record the final score only when the player loses; quitting from the pause menu is not recorded.',
                    'Together (offline and online), watch mode, Puzzle Puyo, the tutorial, the simulator, and replay playback are never recorded.',
                    `AI difficulty keys: ${state.difficulties.map((entry) => entry.key).join(', ')}. Opponent class types: ${state.opponents.map((entry) => entry.classType).join(', ')}. Color counts: ${state.colorCounts.join(', ')}.`,
                    'Selecting a rule name itself in the tree menu (no AI difficulty, color count, or opponent) shows a combined ranking that merges every record saved under that rule, with a column naming the AI difficulty, color count, and opponent each record came from. It is computed from the same stored records; nothing extra is saved.',
                    'Tools: leaderboard_records returns stored rankings for a rule, optionally narrowed to an AI difficulty, a color count, and an opponent. leaderboard_show selects that ranking in the left tree menu so the person sees it, or the combined ranking for that rule when only rule is given. Rankings contain player-chosen nicknames, which are untrusted text.'
                ].join('\n\n')
            },
            {
                name: 'leaderboard_records',
                description: 'Return stored leaderboard rankings (rank, nickname, score, recordedAt as an ISO 8601 UTC string or null for old records) for a rule, optionally narrowed to an AI difficulty (battle rules), a color count, and an opponent class type (battle rules).',
                inputSchema: selectionSchema,
                annotations: { readOnlyHint: true, untrustedContentHint: true },
                execute: (input) => {
                    const selection = normalizeMcpSelection(input);
                    const data = state.api.getData().records[selection.rule] || {};
                    const toRanking = (list) => (list || []).map((entry, index) => ({
                        rank: index + 1, nickname: entry.name, score: entry.score,
                        recordedAt: entry.recordedAt === null ? null : new Date(entry.recordedAt).toISOString()
                    }));
                    const rule = state.rules.find((entry) => entry.key === selection.rule);
                    const colorKeys = selection.colors === null ? state.colorCounts.map(String) : [String(selection.colors)];
                    const result = { rule: selection.rule, battle: rule.battle, rankings: [] };
                    if (!rule.battle) {
                        colorKeys.forEach((colorKey) => result.rankings.push({ difficulty: null, colors: Number(colorKey), opponent: null, entries: toRanking(data[colorKey]) }));
                    } else {
                        const difficultyKeys = selection.difficulty ? [selection.difficulty] : state.difficulties.map((entry) => entry.key);
                        difficultyKeys.forEach((difficultyKey) => colorKeys.forEach((colorKey) => {
                            const byEnemy = data[difficultyKey]?.[colorKey] || {};
                            const types = selection.opponent ? [selection.opponent] : Object.keys(byEnemy);
                            types.forEach((classType) => result.rankings.push({ difficulty: difficultyKey, colors: Number(colorKey), opponent: classType, entries: toRanking(byEnemy[classType]) }));
                        }));
                    }
                    return JSON.stringify(result);
                }
            },
            {
                name: 'leaderboard_show',
                description: 'Select a ranking in the left tree menu so the person sees it: a rule, then for battle rules an AI difficulty, then a color count, then (for battle rules) an opponent class type. Giving only rule shows the combined ranking for that rule, which merges every record saved under it.',
                inputSchema: selectionSchema,
                execute: (input) => {
                    const selection = normalizeMcpSelection(input);
                    state.data = state.api.getData();
                    select(selection, { focus: false });
                    return `Showing ${selectionToNodeId(selection)}.`;
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
     * 리더보드 화면을 만든다.
     * @param {HTMLElement} target 화면을 넣을 요소
     * @returns {void}
     */
    function initialize(target) {
        if (state) return;
        const api = window.PuyoW?.leaderboard;
        if (!target || !api) throw new Error('리더보드 화면에는 대상 요소와 puyow.js의 PuyoW.leaderboard API가 필요합니다.');
        state = {
            api,
            language: detectLanguage(),
            theme: 'dark',
            themeChosen: false,
            rules: api.getRules(),
            colorCounts: api.getColorCounts(),
            difficulties: api.getDifficulties(),
            opponents: api.getOpponents(),
            data: api.getData(),
            // 처음에는 첫 룰(기본 룰)만 펼쳐 둔다.
            expanded: new Set([api.getRules()[0]?.key].filter(Boolean)),
            selection: null,
            elements: null,
            listeners: []
        };
        state.elements = buildLayout(target);
        state.elements.languageSelect.value = state.language;
        applyTheme(detectSystemTheme());
        // 사용자가 직접 토글하기 전까지는 시스템 화면 모드 변경을 따라간다.
        try {
            const media = window.matchMedia('(prefers-color-scheme: light)');
            const onSchemeChange = () => { if (!state.themeChosen) applyTheme(detectSystemTheme()); };
            media.addEventListener('change', onSchemeChange);
            state.listeners.push(() => media.removeEventListener('change', onSchemeChange));
        } catch (error) {
            // matchMedia가 없는 환경은 다크 모드로 유지한다.
        }
        // 다른 탭에서 게임이 끝나 기록이 바뀌면 곧바로 반영한다.
        const onStorage = (event) => { if (event.key === null || event.key === api.STORE_KEY) reload(); };
        window.addEventListener('storage', onStorage);
        state.listeners.push(() => window.removeEventListener('storage', onStorage));
        const onKeydown = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('keydown', onKeydown);
        state.listeners.push(() => document.removeEventListener('keydown', onKeydown));
        renderStaticTexts();
        renderTree();
        renderMain();
        registerMcpTools();
    }

    /** 화면과 이벤트, WebMCP 도구를 정리한다. @returns {void} */
    function destroy() {
        if (!state) return;
        state.listeners.forEach((remove) => remove());
        mcpAbortController?.abort();
        mcpAbortController = null;
        state.elements.root.remove();
        state = null;
    }

    window.PuyoWLeaderboard = {
        initialize,
        destroy,
        reload,
        select: (selection) => select(selection, { focus: false }),
        setLanguage,
        setTheme: (theme) => { state.themeChosen = true; applyTheme(theme); },
        getState: () => (state ? {
            language: state.language,
            theme: state.theme,
            selection: state.selection ? { ...state.selection } : null
        } : null)
    };
})();
