/**
 * @license Apache-2.0
 * Copyright 2026 HJOW
 * Licensed under the Apache License, Version 2.0.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

(() => {
  'use strict';

  const WIDTH = 1280;
  const HEIGHT = 720;
  const COLUMNS = 6;
  const ROWS = 13;
  const VISIBLE_ROWS = 12;
  const CELL = 38;
  const FIELD_TOP = 102;
  const FIELD_BOTTOM = FIELD_TOP + VISIBLE_ROWS * CELL;
  const FIELD_LEFT = 188;
  const FIELD_RIGHT = 864;
  const COLORS = ['red', 'green', 'yellow', 'blue', 'purple']; // 뿌요 컬러
  const PALETTE = {
    red: '#ef5350', green: '#66bb6a', yellow: '#f7c843', blue: '#42a5f5', purple: '#ab73e8',
    garbage: '#d3edf4'
  };
  const COMBO_POWER = [0, 1, 6, 9, 14, 20, 40, 80, 120, 170, 240, 360, 480, 600, 720, 840, 950, 975, 990]; // 연쇄별 공격 위력 지정
  const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // 싹쓸이 성공 시 상대방에게 즉시 보낼 방해뿌요 갯수
  const ALL_CLEAR_DAMAGE = 12;
  // 한국어 원문을 키로 사용하는 화면 문구 번역표. 외부 스크립트는 registerLanguage()로 언어별 항목을 추가할 수 있다.
  const stringTable = {
    en: {
      '게임 시작': 'Game Start', '연습': 'Practice', '난이도 선택': 'Difficulty', '적 선택': 'Opponent',
      '쉬움': 'Easy', '보통': 'Normal', '어려움': 'Hard', '시작': 'Start', '이전': 'Back',
      '일시정지': 'Paused', '재개': 'Resume', '종료': 'Exit', 'ESC 키로 재개': 'Press ESC to resume',
      '승리': 'Victory', '패배': 'Defeat', '최종 점수 %1': 'Final score %1', '%1연쇄': '%1 Chain',
      '연습 상대': 'Practice Opponent'
    }
  };

  let canvas = null;
  let context = null;
  let initialized = false;
  let game = null;
  let menuScreen = 'title';
  let selectedOpponent = 0;
  let selectedDifficulty = 2;
  let opponentMenuFocus = 0;
  let selectedOpponentAction = 0;
  let titleMenuFocus = 0;
  let lastTime = 0;
  let isDownKeyPressed = false;
  let languageCode = 'ko';
  const DIFFICULTIES = [
    { name: '쉬움', colors: ['green', 'yellow', 'blue'] },
    { name: '보통', colors: ['red', 'green', 'yellow', 'blue'] },
    { name: '어려움', colors: COLORS }
  ];

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
      this.addPoint = 0;
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
      this.nextPairs = [this.createPair(), this.createPair()];
      this.aiTarget = 5;
      this.aiRotation = 0;
      this.aiFastDown = false;
      this.aiSimulations = [];
      this.hasPlacedPuyoSinceAllClear = false;
      this.receivesPuyos = true;
      this.allClearEnabled = true;
      this.clearsGarbage = false;
    }

    /**
     * 다음에 제공할 세로 뿌요 한 쌍을 만든다.
     * @returns {string[]} 아래와 위 뿌요 색상
     */
    createPair() {
      return [randomColor(this.colors), randomColor(this.colors)];
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
   * 자동 플레이어의 이동 목표를 결정하는 확장 지점이다.
   */
  class Enemy {
    constructor() {
      this.sortPriority = 1;
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
          simulations.push({
            x,
            rotation,
            positions: activeCells(placement).map(({ x: cellX, y: cellY }) => ({ x: cellX, y: cellY })),
            attack: player.estimateAttack(player.active.colors, activeCells(placement).map(({ x: cellX, y: cellY }) => ({ x: cellX, y: cellY })) )
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
     * 이번 턴에 빠른 하강을 사용할지 결정한다.
     * @param {PlayerState} player 자동 조작할 플레이어
     * @returns {boolean} 빠른 하강 사용 여부
     */
    useFastDown(player) {
      return false;
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
     * 안드로말리우스는 좌우로 기반을 쌓은 뒤 예상 공격이 큰 위치를 노린다.
     */
  class Andromalius extends Enemy {
      constructor() {
        super();
        this.phase = 'initialLeft';
        this.turnsRemaining = this.randomTurns();
      }

      /**
       * 단탈리온과 같은 방식으로 일반 배치 턴 수를 정한다.
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
        if (player.board[9][2] || this.phase === 'simulation') {
          const bestColumn = findBestAttackColumn(player, 0);
          this.phase = 'repeatLeft';
          if (!player.board[9][2]) this.turnsRemaining = 6;
          return bestColumn;
        }

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

      /**
       * 단탈리온과 구별되는 갑각형 악마 모습을 그린다.
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
  * 단탈리온의 배치 목표를 결정한다. 10~15회 일반 배치 후 예상 공격이 가장 큰 열을 고른다.
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
      if (player.board[9][2]) return findBestAttackColumn(player, 0);
      this.turnCount += 1;
      const stackDirection = COLUMNS - 1;
      if (this.turnCount <= this.turnsUntilSimulation || !player.active) return stackDirection;

      const bestColumn = findBestAttackColumn(player, stackDirection);
      this.turnCount = 0;
      this.turnsUntilSimulation = this.randomTurnsUntilSimulation();
      return bestColumn;
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

  /**
   * 세로 배치 후보 중 예상 공격력이 가장 높은 열을 고른다. 동점이면 더 오른쪽 열을 선택한다.
   * @param {PlayerState} player 자동 조작할 플레이어
   * @param {number} fallback 유효한 후보가 없을 때 사용할 열
   * @returns {number} 목표 X 좌표
   */
  function findBestAttackColumn(player, fallback) {
    let bestColumn = fallback;
    let bestAttack = -1;
    // 세로 배치 후보만 비교해 가장 큰 예상 공격을 내는 열을 고른다.
    player.aiSimulations
      .filter((simulation) => simulation.rotation === 0)
      .forEach((simulation) => {
        if (simulation.attack >= bestAttack) {
          bestAttack = simulation.attack;
          bestColumn = simulation.x;
        }
      });
    return bestColumn;
  }

  const OPPONENTS = [
    {
      sortPriority: 1,
      createController: () => new Andromalius()
    },
    {
      sortPriority: 2,
      createController: () => new Dantalion()
    }
  ];

  /**
   * 적 선택 화면에 표시할 순서로 적 목록을 정렬한다.
   * @returns {void}
   */
  function sortOpponents() {
    OPPONENTS.sort((left, right) => left.sortPriority - right.sortPriority);
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
    OPPONENTS.push({ createController: opponent.createController, sortPriority: controller.sortPriority });
    sortOpponents();
  }

  /**
   * 대전 또는 연습 상태를 초기화한다.
   * @param {boolean} practice 연습 모드 여부
   * @returns {void}
   */
  function startGame(practice = false) {
    const opponent = practice ? { createController: () => new PracticeEnemy() } : OPPONENTS[selectedOpponent];
    const controller = opponent.createController();
    const colors = practice ? COLORS : DIFFICULTIES[selectedDifficulty].colors;
    const practicePlayer = new PlayerState(controller.getName(), FIELD_RIGHT, controller, colors);
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
      practice,
      themeController: controller,
      players: [new PlayerState('PLAYER 1', FIELD_LEFT, null, colors), practicePlayer]
    };
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
    player.active = { x: 2, y: 12, rotation: 0, colors: player.nextPairs.shift() };
    player.nextPairs.push(player.createPair());
    // CPU 플레이어면 이번 뿌요 쌍의 목표 위치와 회전을 미리 결정한다.
    if (player.controller) {
      player.controller.prepareTurn(player);
      player.aiTarget = player.controller.chooseTarget(player);
      player.aiRotation = ((player.controller.chooseRotate(player) % 4) + 4) % 4;
      player.aiFastDown = player.controller.useFastDown(player) === true;
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
    const candidate = { ...player.active, x: player.active.x + horizontal, y: player.active.y + vertical };
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
    player.hasPlacedPuyoSinceAllClear = true;
    player.active = null;
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
      const power = COMBO_POWER[Math.min(player.combo, 18)] || 999;
      player.addPoint += exploding.length * power;
      player.attack += exploding.length * power / 4;
      const cancelledAttack = Math.min(Math.floor(player.attack), Math.floor(opponent.attack));
      player.attack -= cancelledAttack;
      opponent.attack -= cancelledAttack;
      const center = exploding.reduce((sum, [x, y]) => ({ x: sum.x + x, y: sum.y + y }), { x: 0, y: 0 });
      player.comboPopups.push({ x: center.x / exploding.length, y: center.y / exploding.length, combo: player.combo, elapsed: 0 });
      removed.forEach((puyo) => { player.board[puyo.y][puyo.x] = null; });
      player.effects = { cells: [...removed.values()], elapsed: 0, duration: 430 };
      player.phase = 'burst';
      player.phaseTimer = 0;
      return;
    }
    player.point += player.addPoint;
    player.addPoint = 0;
    const blocked = Math.min(Math.floor(player.damage), Math.floor(player.attack));
    player.damage -= blocked;
    player.attack -= blocked;
    const deliveredAttack = Math.floor(player.attack);
    opponent.damage += deliveredAttack;
    player.attack -= deliveredAttack;
    player.combo = 0;
    player.phase = 'garbage';
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
      game.running = false;
      game.winner = ending.winner;
      game.ending = null;
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
    // 대기 중인 연습 상대도 예약된 피해가 있으면 방해뿌요 처리는 수행한다.
    if (player.phase === 'idle') {
      if (player.damage > 0) dropGarbage(player);
      return;
    }
    // 조작 단계에서는 CPU 이동과 낙하 타이머를 갱신한다.
    if (player.phase === 'control') {
      if (player.controller) {
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
      player.fallTimer += delta;
      const fastDown = player.controller ? player.aiFastDown : isDownKeyPressed;
      if (player.fallTimer >= (fastDown ? 55 : player.controller ? 290 : 520)) {
        player.fallTimer = 0;
        if (!moveActive(player, 0, -1)) lockActive(player);
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
          opponent.damage += ALL_CLEAR_DAMAGE;
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
  function drawPuyo(x, y, color, scale = 1) {
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
    drawPuyoEyes(radius);
    context.restore();
  }

  /**
   * 현재 변환 좌표를 기준으로 뿌요의 귀여운 두 눈을 그린다.
   * @param {number} radius 뿌요 본체의 반지름
   * @returns {void}
   */
  function drawPuyoEyes(radius) {
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(-radius * 0.28, -radius * 0.12, radius * 0.19, 0, Math.PI * 2);
    context.arc(radius * 0.28, -radius * 0.12, radius * 0.19, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#172031';
    context.beginPath();
    context.arc(-radius * 0.25, -radius * 0.08, radius * 0.08, 0, Math.PI * 2);
    context.arc(radius * 0.31, -radius * 0.08, radius * 0.08, 0, Math.PI * 2);
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
    if (type === 'tiny') return drawPuyo(x + CELL * 0.25, y + CELL * 0.25, 'garbage', 0.45);
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
      drawPuyo(x, y, 'red');
      return;
    }
    drawPuyo(x, y, 'garbage');
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
    context.font = '24px "Black Han Sans"';
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
    if (!isDefeated && player.active) activeCells(player.active).forEach((cell) => {
      if (cell.y < VISIBLE_ROWS) {
        const cellX = x + cell.x * CELL;
        const cellY = FIELD_BOTTOM - (cell.y + 1) * CELL;
        drawPuyo(cellX, cellY, cell.color);
        drawActiveOutline(cellX, cellY);
      }
    });
    for (let index = 0; index < COLUMNS; index += 1) {
      context.fillStyle = '#0a1d29'; context.fillRect(x + index * CELL + 3, FIELD_TOP - CELL + 3, CELL - 6, CELL - 6);
      context.strokeStyle = 'rgba(176, 232, 244, 0.25)'; context.strokeRect(x + index * CELL + 3, FIELD_TOP - CELL + 3, CELL - 6, CELL - 6);
    }
    warningUnits(opponent.attack + player.damage).forEach((type, index) => drawWarning(x + index * CELL, FIELD_TOP - CELL, type));
    if (isDefeated) drawDefeatAnimation(player);
    if (player.effects) {
      const progress = Math.min(1, player.effects.elapsed / player.effects.duration);
      player.effects.cells.forEach((puyo) => drawExplosionEffect(x + puyo.x * CELL, FIELD_BOTTOM - (puyo.y + 1) * CELL, puyo, progress));
    }
    player.comboPopups.forEach((popup) => drawComboPopup(x, popup));
    context.fillStyle = '#e7f8fa'; context.font = '18px "Black Han Sans"'; context.textAlign = 'left';
    context.fillText(player.name, x, 54);
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
    game.themeController.drawBezelBackground(context, { x: x - CELL, y: FIELD_BOTTOM + distance, width: CELL * 8, height: CELL, player });
    animation.fallingPuyos.forEach((puyo) => {
      const y = FIELD_BOTTOM - (puyo.y + 1) * CELL + distance;
      if (y < HEIGHT) drawPuyo(x + puyo.x * CELL, y, puyo.color);
    });
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
    context.fillStyle = '#d8f2f5'; context.textAlign = 'center'; context.font = '42px "Black Han Sans"'; context.fillText('Puyo W', WIDTH / 2, 95);
    const left = game.players[0]; const right = game.players[1];
    [
      { player: left, x: 482, color: '#ef8aa0' },
      { player: right, x: 650, color: '#6bbce8' }
    ].forEach(({ player, x, color }) => {
      context.fillStyle = '#0b202c'; context.fillRect(x, 120, 148, 150);
      context.strokeStyle = color; context.lineWidth = 2; context.strokeRect(x, 120, 148, 150);
      context.fillStyle = color; context.font = '13px "Nanum Gothic Coding"'; context.fillText(`${player.name} NEXT`, x + 74, 143);
      player.nextPairs.forEach((pair, pairIndex) => {
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
      context.fillStyle = color; context.font = '13px "Nanum Gothic Coding"'; context.fillText(player.name, x + 73, 516);
      context.fillStyle = '#f5fbfc'; context.font = '27px "Nanum Gothic Coding"'; context.fillText(String(Math.floor(player.point)).padStart(7, '0'), x + 73, 557);
    });
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
    context.font = '36px "Black Han Sans"';
    context.fillStyle = won ? '#f7c843' : '#d8f2f5';
    context.fillText(translate(won ? '승리' : '패배'), x + CELL * 3, FIELD_TOP + CELL * 6.4);
    context.fillStyle = '#d8f2f5'; context.font = '16px "Nanum Gothic Coding"';
    context.fillText(translate('최종 점수 %1', Math.floor(player.point).toLocaleString()), x + CELL * 3, FIELD_TOP + CELL * 7.15);
    context.fillStyle = '#e7f8fa'; context.font = '18px "Black Han Sans"'; context.textAlign = 'left';
    context.fillText(player.name, x, 54);
  }

  /**
   * 종료 버튼만 있는 중앙 영역을 그린다.
   * @returns {void}
   */
  function drawResultCenter() {
    game.themeController.drawCenterBackground(context, { x: 450, y: 0, width: 380, height: HEIGHT });
    context.fillStyle = '#d8f2f5'; context.textAlign = 'center'; context.font = '42px "Black Han Sans"'; context.fillText('Puyo W', WIDTH / 2, 95);
    context.fillStyle = '#ef5350'; context.fillRect(515, 165, 250, 64);
    context.fillStyle = '#ffffff'; context.font = '22px "Black Han Sans"'; context.fillText(translate('종료'), WIDTH / 2, 207);
  }

  /**
   * 클릭 가능한 게임 시작 메뉴를 그린다.
   * @returns {void}
   */
  function drawMenu() {
    context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
    context.textAlign = 'center'; context.fillStyle = '#d8f2f5'; context.font = '68px "Black Han Sans"'; context.fillText('Puyo W', WIDTH / 2, menuScreen === 'opponent' ? 112 : 260);
    if (menuScreen === 'opponent') {
      context.fillStyle = '#d8f2f5'; context.font = '22px "Black Han Sans"'; context.fillText(translate('난이도 선택'), WIDTH / 2, 150);
      DIFFICULTIES.forEach((difficulty, index) => {
        const x = 465 + index * 120;
        const selected = index === selectedDifficulty;
        context.fillStyle = selected ? '#563068' : '#0b202c'; context.fillRect(x, 170, 110, 50);
        context.strokeStyle = opponentMenuFocus === 0 && selected ? '#f7c843' : '#3b6070'; context.lineWidth = opponentMenuFocus === 0 && selected ? 4 : 2;
        context.strokeRect(x, 170, 110, 50);
        context.fillStyle = '#f5fbfc'; context.font = '17px "Black Han Sans"'; context.fillText(translate(difficulty.name), x + 55, 202);
      });
      context.fillStyle = '#d8f2f5'; context.font = '22px "Black Han Sans"'; context.fillText(translate('적 선택'), WIDTH / 2, 265);
      const opponent = OPPONENTS[selectedOpponent];
      context.fillStyle = '#0b202c'; context.fillRect(WIDTH / 2 - 170, 280, 340, 190);
      context.strokeStyle = opponentMenuFocus === 1 ? '#f7c843' : '#ef8aa0'; context.lineWidth = opponentMenuFocus === 1 ? 4 : 3; context.strokeRect(WIDTH / 2 - 170, 280, 340, 190);
      opponent.createController().drawPortrait(context, WIDTH / 2, 360, 0.7);
      context.fillStyle = '#f5fbfc'; context.font = '28px "Black Han Sans"'; context.fillText(opponent.createController().getName(), WIDTH / 2, 450);
      if (opponentMenuFocus === 1) {
        context.fillStyle = '#f7c843';
        context.beginPath();
        context.moveTo(WIDTH / 2 - 205, 375);
        context.lineTo(WIDTH / 2 - 175, 350);
        context.lineTo(WIDTH / 2 - 175, 400);
        context.closePath();
        context.fill();
        context.beginPath();
        context.moveTo(WIDTH / 2 + 205, 375);
        context.lineTo(WIDTH / 2 + 175, 350);
        context.lineTo(WIDTH / 2 + 175, 400);
        context.closePath();
        context.fill();
      }
      OPPONENTS.forEach((entry, index) => {
        const cardX = WIDTH / 2 - 80 + (index - selectedOpponent) * 180;
        context.fillStyle = index === selectedOpponent ? '#563068' : '#0b202c'; context.fillRect(cardX, 485, 160, 48);
        context.strokeStyle = index === selectedOpponent ? '#ef8aa0' : '#3b6070'; context.lineWidth = 2; context.strokeRect(cardX, 485, 160, 48);
        context.fillStyle = '#f5fbfc'; context.font = '17px "Black Han Sans"'; context.fillText(entry.createController().getName(), cardX + 80, 517);
      });
      context.fillStyle = '#ef5350'; context.fillRect(440, 600, 250, 58);
      context.strokeStyle = opponentMenuFocus === 2 && selectedOpponentAction === 0 ? '#f7c843' : '#ef5350'; context.lineWidth = opponentMenuFocus === 2 && selectedOpponentAction === 0 ? 4 : 2; context.strokeRect(440, 600, 250, 58);
      context.fillStyle = '#fff'; context.font = '20px "Black Han Sans"'; context.fillText(translate('시작'), 565, 637);
      context.fillStyle = '#264b5b'; context.fillRect(710, 600, 130, 58);
      context.strokeStyle = opponentMenuFocus === 2 && selectedOpponentAction === 1 ? '#f7c843' : '#264b5b'; context.lineWidth = opponentMenuFocus === 2 && selectedOpponentAction === 1 ? 4 : 2; context.strokeRect(710, 600, 130, 58);
      context.fillStyle = '#d8f2f5'; context.font = '18px "Black Han Sans"'; context.fillText(translate('이전'), 775, 637);
      return;
    }
    context.fillStyle = '#ef5350'; context.fillRect(WIDTH / 2 - 145, 358, 290, 66);
    context.strokeStyle = titleMenuFocus === 0 ? '#f7c843' : '#ef5350'; context.lineWidth = titleMenuFocus === 0 ? 4 : 2; context.strokeRect(WIDTH / 2 - 145, 358, 290, 66);
    context.fillStyle = '#fff'; context.font = '25px "Black Han Sans"'; context.fillText(translate('게임 시작'), WIDTH / 2, 402);
    context.fillStyle = '#264b5b'; context.fillRect(WIDTH / 2 - 145, 442, 290, 66);
    context.strokeStyle = titleMenuFocus === 1 ? '#f7c843' : '#264b5b'; context.lineWidth = titleMenuFocus === 1 ? 4 : 2; context.strokeRect(WIDTH / 2 - 145, 442, 290, 66);
    context.fillStyle = '#d8f2f5'; context.font = '25px "Black Han Sans"'; context.fillText(translate('연습'), WIDTH / 2, 486);
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
    context.font = '48px "Black Han Sans"';
    context.fillText(translate('일시정지'), WIDTH / 2, 322);
    context.fillStyle = '#4cc9b0';
    context.fillRect(470, 376, 150, 64);
    context.fillStyle = '#ef5350';
    context.fillRect(660, 376, 150, 64);
    context.fillStyle = '#ffffff';
    context.font = '23px "Black Han Sans"';
    context.fillText(translate('재개'), 545, 417);
    context.fillText(translate('종료'), 735, 417);
    context.fillStyle = '#b3dbe2';
    context.font = '15px "Nanum Gothic Coding"';
    context.fillText(translate('ESC 키로 재개'), WIDTH / 2, 478);
  }

  /**
   * 현재 메뉴 또는 실행 중인 게임의 한 프레임을 렌더링한다.
   * @returns {void}
   */
  function render() {
    context.clearRect(0, 0, WIDTH, HEIGHT);
    // 진행 중인 게임이 없으면 현재 메뉴 화면만 렌더링한다.
    if (!game) { drawMenu(); return; }
    context.fillStyle = '#071621'; context.fillRect(0, 0, WIDTH, HEIGHT);
    // 게임이 끝났으면 결과 화면으로 전환한다.
    if (!game.running) {
      drawResultField(game.players[0]); drawResultField(game.players[1]); drawResultCenter();
      return;
    }
    drawField(game.players[0], game.players[1]); drawField(game.players[1], game.players[0]); drawCenter();
    // 시작 전에는 카운트다운 오버레이를 최상단에 표시한다.
    if (game.countdown > 0) {
      context.fillStyle = 'rgba(3, 11, 19, 0.62)'; context.fillRect(0, 0, WIDTH, HEIGHT);
      context.textAlign = 'center'; context.fillStyle = '#f5fbfc'; context.font = '76px "Black Han Sans"';
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
        if (!game.countdown) beginGame();
      } else if (game.ending) {
        updateDefeatSequence(delta);
      } else {
        updatePlayer(game.players[0], game.players[1], delta);
        updatePlayer(game.players[1], game.players[0], delta);
      }
    }
    render();
    requestAnimationFrame(frame);
  }

  /**
   * 키 입력을 현재 메뉴 또는 플레이어 조작에 전달한다.
   * @param {KeyboardEvent} event 키보드 이벤트
   * @returns {void}
   */
  function handleKeydown(event) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'z', 'x', 'escape', 'enter', ' '].includes(key)) event.preventDefault();
    // 결과 화면에서는 Enter 또는 ESC로 상대 선택 화면으로 돌아간다.
    if (game && !game.running && (key === 'enter' || key === 'escape')) {
      game = null;
      openOpponentMenu();
      return;
    }
    // 게임이 없으면 키 입력을 제목 또는 상대 선택 메뉴로 전달한다.
    if (!game) {
      if (menuScreen === 'title' && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        titleMenuFocus = titleMenuFocus === 0 ? 1 : 0;
      } else if (menuScreen === 'opponent' && key === 'arrowup') {
        opponentMenuFocus = Math.max(0, opponentMenuFocus - 1);
      } else if (menuScreen === 'opponent' && key === 'arrowdown') {
        opponentMenuFocus = Math.min(2, opponentMenuFocus + 1);
      } else if (menuScreen === 'opponent' && key === 'arrowleft') {
        if (opponentMenuFocus === 0) selectedDifficulty = (selectedDifficulty + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
        else if (opponentMenuFocus === 1) selectedOpponent = (selectedOpponent + OPPONENTS.length - 1) % OPPONENTS.length;
        else selectedOpponentAction = 0;
      } else if (menuScreen === 'opponent' && key === 'arrowright') {
        if (opponentMenuFocus === 0) selectedDifficulty = (selectedDifficulty + 1) % DIFFICULTIES.length;
        else if (opponentMenuFocus === 1) selectedOpponent = (selectedOpponent + 1) % OPPONENTS.length;
        else selectedOpponentAction = 1;
      } else if (key === 'enter' || key === ' ') {
        if (menuScreen === 'title') activateTitleMenu();
        else if (opponentMenuFocus === 0) opponentMenuFocus = 1;
        else if (opponentMenuFocus === 1) {
          opponentMenuFocus = 2;
          selectedOpponentAction = 0;
        } else if (selectedOpponentAction === 0) startGame();
        else menuScreen = 'title';
      } else if (key === 'escape' && menuScreen === 'opponent') menuScreen = 'title';
      return;
    }
    // 결과 화면에서는 위에서 처리한 메뉴 복귀 외 입력을 무시한다.
    if (!game.running) {
      return;
    }
    // 종료 연출이 아닐 때 ESC로 일시정지 상태를 전환한다.
    if (key === 'escape' && !game.ending) {
      game.paused = !game.paused;
      return;
    }
    // 일시정지 중에는 조작 키를 게임 필드에 전달하지 않는다.
    if (game.paused) return;
    const player = game.players[0];
    if (player.phase !== 'control') return;
    if (key === 'arrowleft') moveActive(player, -1, 0);
    if (key === 'arrowright') moveActive(player, 1, 0);
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
    if (event.key.toLowerCase() === 'arrowdown') isDownKeyPressed = false;
  }

  /**
   * 메인 메뉴에서 포커스된 항목을 실행한다.
   * @returns {void}
   */
  function activateTitleMenu() {
    if (titleMenuFocus === 0) openOpponentMenu();
    else startGame(true);
  }

  /**
   * 적 선택 화면을 기본 난이도와 첫 포커스 상태로 연다.
   * @returns {void}
   */
  function openOpponentMenu() {
    selectedDifficulty = 1;
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
        game = null;
        openOpponentMenu();
      }
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * WIDTH / bounds.width;
    const y = (event.clientY - bounds.top) * HEIGHT / bounds.height;
    // 일시정지 중에는 재개와 종료 버튼의 클릭만 처리한다.
    if (game && game.paused) {
      if (x >= 470 && x <= 620 && y >= 376 && y <= 440) {
        game.paused = false;
      } else if (x >= 660 && x <= 810 && y >= 376 && y <= 440) {
        game = null;
        menuScreen = 'title';
      }
      return;
    }
    // 실행 중인 게임 화면의 일반 클릭은 메뉴 동작으로 처리하지 않는다.
    if (game) return;
    if (menuScreen === 'title') {
      if (x >= WIDTH / 2 - 145 && x <= WIDTH / 2 + 145 && y >= 358 && y <= 424) {
        titleMenuFocus = 0;
        activateTitleMenu();
      } else if (x >= WIDTH / 2 - 145 && x <= WIDTH / 2 + 145 && y >= 442 && y <= 508) {
        titleMenuFocus = 1;
        activateTitleMenu();
      }
    } else {
      const difficultyIndex = DIFFICULTIES.findIndex((difficulty, index) => x >= 465 + index * 120 && x <= 575 + index * 120 && y >= 170 && y <= 220);
      if (difficultyIndex >= 0) {
        selectedDifficulty = difficultyIndex;
        opponentMenuFocus = 0;
        return;
      }
      const cardIndex = OPPONENTS.findIndex((entry, index) => {
        const cardX = WIDTH / 2 - 80 + (index - selectedOpponent) * 180;
        return x >= cardX && x <= cardX + 160 && y >= 485 && y <= 533;
      });
      if (cardIndex >= 0) {
        selectedOpponent = cardIndex;
        opponentMenuFocus = 1;
      } else if (x >= 440 && x <= 690 && y >= 600 && y <= 658) {
        selectedOpponentAction = 0;
        startGame();
      } else if (x >= 710 && x <= 840 && y >= 600 && y <= 658) {
        selectedOpponentAction = 1;
        menuScreen = 'title';
      }
    }
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
    const usesDefaultCanvas = target === null || target === undefined || target === '';
    canvas = usesDefaultCanvas ? document.getElementById('webpuyo_canvas') : typeof target === 'string' ? document.getElementById(target) : target;
    // 기본 캔버스가 문서에 없으면 접근 가능한 새 캔버스를 생성한다.
    if (usesDefaultCanvas && !canvas) {
      canvas = document.createElement('canvas');
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
    requestAnimationFrame(frame);
  }

  const WebPuyo = { Enemy, registerOpponent, registerLanguage, initialize };
  if (typeof module !== 'undefined' && module.exports) module.exports = WebPuyo;
  if (typeof window !== 'undefined') window.WebPuyo = WebPuyo;
})();