/**
 * @license Apache-2.0
 * Copyright 2026 HJOW
 * Licensed under the Apache License, Version 2.0.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * 뿌요 W 3D 버전의 진입점과 확장 구조다.
 *
 * 이 파일은 CommonJS와 브라우저 전역 사용을 함께 지원한다. 실제 게임 규칙은
 * puyow.js에 남겨 두고, 3D 버전은 공개된 WebPuyo API만 읽어 재사용한다.
 */


/*
   TODO
   기존 puyow.html, puyow.js 는 이 게임의 2D 버전으로 그대로 두고
   puyow3d.html 와 puyow3d.js 에 3D 버전을 새로 개발하는 작업

   Three.js 라이브러리 CommonJS 버전을 puyow3d.html 에 이미 탑재했고
   CommonJS 스타일로, ES6 문법을 사용하고, 되도록이면 class 를 적극적으로 사용 계획.
   단 puyow.js 에 있는 일부 공통함수는 같이 사용.
   
   원근법 없이, 기존처럼 게임화면이 정면에서 그대로 보이도록 구현.
   다만 게임 내 구성 요소들 (뿌요들) 을 입체적으로 보이게 하는 것.

   window 에 객체 탑재 시 PuyoW3D 이름 사용.
*/


/**
 * TODO: [createPuyoW3DModule] CommonJS와 브라우저 전역 배포 경로를 유지하면서,
 * 향후 번들러 지원이 필요할 때 중복 초기화나 전역 이름 충돌 없이 확장한다.
 */
(function createPuyoW3DModule(factory) {
    const globalObject = typeof window !== 'undefined' ? window : globalThis;
    const PuyoW3D = factory(globalObject);

    if (typeof module !== 'undefined' && module.exports) module.exports = PuyoW3D;
    if (typeof window !== 'undefined') window.PuyoW3D = PuyoW3D;
/**
 * TODO: [buildPuyoW3D] 모듈 내부 의존성의 생성 순서와 공개 API 범위를 관리하고,
 * 새 3D 기능은 이 팩터리 내부의 명시된 클래스 또는 함수로만 추가한다.
 */
})(function buildPuyoW3D(globalObject) {
    const LOGICAL_WIDTH = 1280;
    const LOGICAL_HEIGHT = 720;
    const BOARD_COLUMNS = 6;
    const BOARD_ROWS = 17;
    const VISIBLE_ROWS = 12;
    const PUYO_COLORS = ['red', 'green', 'yellow', 'blue', 'purple'];
    const PUYO_MATERIAL_COLORS = {
        red: 0xe94b5f,
        green: 0x43b96f,
        yellow: 0xf2c94c,
        blue: 0x4b8bea,
        purple: 0x9b59b6,
        garbage: 0x8b929c,
        hardGarbage: 0x4a5260,
        iron: 0x8798a8
    };
    const meshResources = new WeakMap();
    let application = null;

    /**
     * 3D 버전이 2D 구현에서 읽을 수 있는 공개 공통 API만 모은다.
     *
     * TODO: [getShared2DApi] 3D 게임에 실제로 필요한 2D 공개 API 목록을 확정하고,
     * 누락·폐기된 API를 명확히 검증한다. 반환 객체는 계속 읽기 전용 어댑터여야 한다.
     *
     * @returns {{randomFloat:Function,getGameState:Function,getScreenState:Function,getSelectedColorCount:Function,common:Record<string,Function>|null}|null}
     *     이후 게임 규칙 이식 시에는 이 반환값만 사용한다. puyow.js 내부 상태나
     *     비공개 함수에 접근하면 2D/3D 구현이 서로 영향을 주므로 사용하지 않는다.
     */
    function getShared2DApi() {
        const source = globalObject.WebPuyo;
        if (!source) return null;
        return {
            randomFloat: source.randomFloat,
            getGameState: source.getGameState,
            getScreenState: source.getScreenState,
            getSelectedColorCount: source.getSelectedColorCount,
            common: source.common || null
        };
    }

    /**
     * 초기화 대상 canvas를 확인한다.
     *
     * TODO: [resolveCanvas] 3D 전용 canvas id와 접근성 속성의 최종 계약을 정하고,
     * 이미 다른 렌더러가 사용 중인 canvas를 거절할지 여부를 구현한다.
     *
     * @param {HTMLCanvasElement|string|null} target canvas 요소 또는 id
     * @returns {HTMLCanvasElement}
     * @throws {Error} 브라우저 DOM 또는 대상 canvas가 없을 때
     */
    function resolveCanvas(target = null) {
        if (!globalObject.document) throw new Error('PuyoW3D.initialize()는 브라우저 DOM에서만 사용할 수 있습니다.');
        const canvas = typeof target === 'string'
            ? globalObject.document.getElementById(target)
            : (target || globalObject.document.getElementById('webpuyo_canvas'));
        if (!canvas || canvas.tagName !== 'CANVAS') throw new Error('PuyoW3D 초기화 대상 canvas를 찾을 수 없습니다.');
        return canvas;
    }

    /**
     * 2D 논리 좌표를 3D 화면의 정규화 좌표로 바꾼다.
     *
     * @param {number} x 2D 논리 X 좌표
     * @param {number} y 2D 논리 Y 좌표
     * @returns {{x:number,y:number}} 화면 중앙이 (0, 0)인 정규화 좌표
     * TODO: [toWorldCoordinates] 보드·메뉴·효과별 월드 단위와 안전 영역이 확정되면
     * 변환 규칙을 이 함수에 집중하고 역변환 함수도 함께 제공한다.
     */
    function toWorldCoordinates(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('좌표는 유한한 숫자여야 합니다.');
        return { x: x - LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 - y };
    }

    /** 3D 게임용 빈 보드를 만든다. @returns {(string|null)[][]} 6x17 보드 */
    function createEmptyBoard() {
        return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLUMNS).fill(null));
    }

    /** 보드와 배열을 외부에서 변경하지 못하도록 깊은 복사한다. @param {unknown[][]} board 원본 보드 @returns {unknown[][]} 복사본 */
    function cloneBoard(board) {
        return board.map((row) => [...row]);
    }

    /** 2D 공통 API가 없을 때 사용할 두 뿌요 좌표 계산이다. @param {{x:number,y:number,rotation:number,colors:string[]}} active 활성 쌍 @returns {{x:number,y:number,color:string}[]} 좌표 */
    function fallbackActiveCells(active) {
        const offsets = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        const offset = offsets[((active.rotation % 4) + 4) % 4];
        return [
            { x: active.x, y: active.y, color: active.colors[0] },
            { x: active.x + offset[0], y: active.y + offset[1], color: active.colors[1] }
        ];
    }

    /** 3D 장면에 주입할 Three.js 네임스페이스를 찾는다. @param {object|null} three 명시적으로 주입한 네임스페이스 @returns {object|null} Three.js 네임스페이스 */
    function resolveThree(three) {
        return three || globalObject.THREE || null;
    }

    /** 색상별 geometry/material을 Three.js 인스턴스마다 한 번만 만든다. @param {object} Three Three.js 네임스페이스 @param {string} color 색상 @returns {{geometry:object,material:object,eyeGeometry:object|null,eyeMaterial:object|null}} 공유 자원 */
    function getMeshResources(Three, color) {
        let resourcesByColor = meshResources.get(Three);
        if (!resourcesByColor) {
            resourcesByColor = new Map();
            meshResources.set(Three, resourcesByColor);
        }
        if (resourcesByColor.has(color)) return resourcesByColor.get(color);
        const resources = {
            geometry: new Three.SphereGeometry(0.46, 24, 18),
            material: new Three.MeshStandardMaterial({
                color: PUYO_MATERIAL_COLORS[color] || 0xffffff,
                roughness: 0.38,
                metalness: color === 'iron' ? 0.45 : 0.05
            }),
            eyeGeometry: null,
            eyeMaterial: null
        };
        if (color !== 'garbage' && color !== 'hardGarbage' && color !== 'iron') {
            resources.eyeGeometry = new Three.SphereGeometry(0.075, 12, 8);
            resources.eyeMaterial = new Three.MeshStandardMaterial({ color: 0x172535, roughness: 0.45 });
        }
        resourcesByColor.set(color, resources);
        return resources;
    }

    /** Three.js 인스턴스에 캐시된 뿌요 공유 자원을 한 번에 해제한다. @param {object|null} Three Three.js 네임스페이스 @returns {void} */
    function disposeMeshResources(Three) {
        const resourcesByColor = Three ? meshResources.get(Three) : null;
        if (!resourcesByColor) return;
        resourcesByColor.forEach((resources) => {
            resources.geometry.dispose();
            resources.material.dispose();
            resources.eyeGeometry?.dispose();
            resources.eyeMaterial?.dispose();
        });
        meshResources.delete(Three);
    }

    /**
     * 3D 장면의 게임 상태를 보관하는 루트 객체다.
     *
     * TODO: [PuyoW3DGame] 게임 시작/중단, 규칙 엔진 연결, 프레임 갱신 순서와 2D
     * 공개 상태의 읽기 전용 동기화 지점을 구현한다. 규칙 자체를 이 클래스에 복제하지 않는다.
     */
    class PuyoW3DGame {
        /**
         * TODO: [PuyoW3DGame.constructor] 3D 독립 규칙 엔진 또는 2D 상태 어댑터 중
         * 하나를 선택해 주입하고, 시작 시점의 난수·규칙·색상 정보를 고정한다.
         * @param {{randomFloat:Function,getGameState:Function,getScreenState:Function,getSelectedColorCount:Function,common:Record<string,Function>|null}|null} shared2DApi 2D 공개 API
         */
        constructor(shared2DApi) {
            this.shared2DApi = shared2DApi;
            this.common = shared2DApi?.common || {};
            this.colors = [...PUYO_COLORS];
            this.board = createEmptyBoard();
            this.active = null;
            this.nextPairs = [];
            this.running = false;
            this.paused = false;
            this.score = 0;
            this.attack = 0;
            this.combo = 0;
            this.elapsed = 0;
            this.gravityElapsed = 0;
            this.gravityDelay = 850;
            this.winner = null;
            this.gameOver = false;
            this.onExplosions = null;
            this.reset();
        }

        /**
         * TODO: [PuyoW3DGame.reset] 2D 버전과 동일한 초기 보드·다음 쌍·점수 계약을
         * 확정한다. 새 게임 시작 때 이전 보드와 효과가 남지 않도록 모든 상태를 재설정한다.
         * @returns {void}
         */
        reset() {
            this.board = createEmptyBoard();
            this.nextPairs = [];
            this.running = true;
            this.paused = false;
            this.score = 0;
            this.attack = 0;
            this.combo = 0;
            this.elapsed = 0;
            this.gravityElapsed = 0;
            this.winner = null;
            this.gameOver = false;
            this.fillNextPairs(3);
            this.spawnPair();
        }

        /** 무작위 색상 하나를 공통 함수로 생성한다. @returns {string} 색상 식별자 */
        randomColor() {
            if (typeof this.common.randomColor === 'function') return this.common.randomColor(this.colors);
            const random = typeof this.shared2DApi?.randomFloat === 'function' ? this.shared2DApi.randomFloat() : Math.random();
            return this.colors[Math.floor(random * this.colors.length)];
        }

        /** 다음 뿌요 쌍을 필요한 개수까지 준비한다. @param {number} count 필요한 쌍 수 @returns {void} */
        fillNextPairs(count) {
            while (this.nextPairs.length < count) this.nextPairs.push([this.randomColor(), this.randomColor()]);
        }

        /** 다음 쌍을 활성 쌍으로 꺼내고 새 쌍을 큐에 넣는다. @returns {void} */
        spawnPair() {
            this.fillNextPairs(1);
            const colors = this.nextPairs.shift();
            this.fillNextPairs(3);
            this.active = { x: 2, y: 13, rotation: 0, colors: [...colors] };
            if (!this.canPlaceActive(this.active)) {
                this.gameOver = true;
                this.running = false;
            }
        }

        /** 공통 착지 함수로 활성 쌍의 배치 가능 여부를 확인한다. @param {{x:number,y:number,rotation:number,colors:string[]}} active 활성 쌍 @returns {boolean} 배치 가능 여부 */
        canPlaceActive(active) {
            const cells = typeof this.common.activeCells === 'function' ? this.common.activeCells(active) : fallbackActiveCells(active);
            return cells.every(({ x, y }) => x >= 0 && x < BOARD_COLUMNS && y >= 0 && y < BOARD_ROWS && !this.board[y][x]);
        }

        /** 착지 위치를 계산한다. @param {number} x 목표 열 @param {number} rotation 목표 회전 @returns {object|null} 착지 배치 */
        getLandingPlacement(x = this.active?.x, rotation = this.active?.rotation) {
            if (!this.active) return null;
            if (typeof this.common.findLandingPlacement === 'function') return this.common.findLandingPlacement(this, x, rotation);
            const candidate = { ...this.active, x, rotation, y: BOARD_ROWS - 1 };
            while (candidate.y > 0 && this.canPlaceActive(candidate)) candidate.y -= 1;
            candidate.y += 1;
            return this.canPlaceActive(candidate) ? candidate : null;
        }

        /** 활성 쌍을 가로로 이동한다. @param {number} direction -1 또는 1 @returns {boolean} 이동 여부 */
        move(direction) {
            if (!this.running || this.paused || !this.active) return false;
            const placement = this.getLandingPlacement(this.active.x + Math.sign(direction), this.active.rotation);
            if (!placement) return false;
            this.active.x = placement.x;
            return true;
        }

        /** 활성 쌍을 회전한다. @param {number} direction 회전 방향 @returns {boolean} 회전 여부 */
        rotate(direction = 1) {
            if (!this.running || this.paused || !this.active) return false;
            const rotation = (this.active.rotation + (direction < 0 ? 3 : 1)) % 4;
            const placement = this.getLandingPlacement(this.active.x, rotation);
            if (!placement) return false;
            this.active.rotation = rotation;
            return true;
        }

        /** 활성 쌍을 한 칸 내린다. @returns {boolean} 계속 하강 가능한지 여부 */
        softDrop() {
            if (!this.running || this.paused || !this.active) return false;
            const candidate = { ...this.active, y: this.active.y - 1 };
            if (this.canPlaceActive(candidate)) {
                this.active.y -= 1;
                this.gravityElapsed = 0;
                return true;
            }
            this.lockPair();
            return false;
        }

        /** 활성 쌍을 즉시 착지시키고 폭발을 처리한다. @returns {void} */
        hardDrop() {
            if (!this.running || this.paused || !this.active) return;
            const placement = this.getLandingPlacement(this.active.x, this.active.rotation);
            if (!placement) {
                this.gameOver = true;
                this.running = false;
                return;
            }
            this.active = { ...this.active, x: placement.x, y: placement.y, rotation: placement.rotation };
            this.lockPair();
        }

        /** 활성 쌍을 보드에 고정한다. @returns {void} */
        lockPair() {
            if (!this.active) return;
            const cells = typeof this.common.activeCells === 'function' ? this.common.activeCells(this.active) : fallbackActiveCells(this.active);
            if (cells.some(({ x, y }) => x < 0 || x >= BOARD_COLUMNS || y < 0 || y >= BOARD_ROWS || this.board[y][x])) {
                this.gameOver = true;
                this.running = false;
                return;
            }
            cells.forEach(({ x, y, color }) => { this.board[y][x] = color; });
            this.resolveExplosions();
            if (!this.gameOver) this.spawnPair();
        }

        /** 폭발 그룹을 제거하고 공통 점수 함수를 적용한다. @returns {void} */
        resolveExplosions() {
            this.combo = 0;
            while (true) {
                const groups = typeof this.common.findExplosionGroupsOnBoard === 'function'
                    ? this.common.findExplosionGroupsOnBoard(this.board)
                    : [];
                if (!groups.length) break;
                this.combo += 1;
                this.onExplosions?.(groups.flatMap((group) => group.cells.map(([x, y]) => ({ x, y }))));
                const exploding = new Set(groups.flatMap((group) => group.cells.map(([x, y]) => `${x},${y}`)));
                groups.flatMap((group) => group.cells).forEach(([x, y]) => {
                    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < BOARD_COLUMNS && ny >= 0 && ny < BOARD_ROWS && this.board[ny][nx] === 'garbage') exploding.add(`${nx},${ny}`);
                    });
                });
                exploding.forEach((key) => {
                    const [x, y] = key.split(',').map(Number);
                    this.board[y][x] = null;
                });
                const point = typeof this.common.calculateExplosionPoint === 'function' ? this.common.calculateExplosionPoint(groups, this.combo) : groups.reduce((sum, group) => sum + group.cells.length * 10, 0);
                this.score += point;
                this.attack += typeof this.common.calculateExplosionAttack === 'function' ? this.common.calculateExplosionAttack(point) : point / 70;
                this.board = typeof this.common.collapseBoard === 'function' ? this.common.collapseBoard(this.board) : this.board;
            }
            if (this.combo === 0) this.attack = Math.floor(this.attack);
            const defeat = this.board[11]?.[2] !== null;
            if (defeat) {
                this.gameOver = true;
                this.running = false;
            }
        }

        /** 경과 시간만큼 중력과 게임 상태를 갱신한다. @param {number} delta 경과 시간(ms) @returns {void} */
        update(delta) {
            if (!this.running || this.paused || this.gameOver) return;
            this.elapsed += Math.max(0, delta);
            this.gravityElapsed += Math.max(0, delta);
            while (this.gravityElapsed >= this.gravityDelay) {
                this.gravityElapsed -= this.gravityDelay;
                if (!this.softDrop()) break;
            }
        }

        /** 외부 소비자용 읽기 전용 상태를 만든다. @returns {object} 게임 상태 복사본 */
        getSnapshot() {
            const active = this.active ? {
                x: this.active.x,
                y: this.active.y,
                rotation: this.active.rotation,
                colors: [...this.active.colors],
                cells: (typeof this.common.activeCells === 'function' ? this.common.activeCells(this.active) : fallbackActiveCells(this.active)).map((cell) => ({ ...cell }))
            } : null;
            return {
                running: this.running,
                paused: this.paused,
                score: this.score,
                attack: this.attack,
                combo: this.combo,
                elapsed: this.elapsed,
                gameOver: this.gameOver,
                winner: this.winner,
                board: cloneBoard(this.board),
                active,
                nextPairs: this.nextPairs.map((pair) => [...pair])
            };
        }
    }

    /**
     * 뿌요 필드의 3D 보드 모델과 메시 묶음을 담당한다.
     *
     * TODO: [PuyoBoard3D] 6x17 논리 셀을 3D 좌표로 매핑하고, 고정 뿌요·낙하쌍·
     * 방해뿌요를 증분 갱신한다. 보드 상태는 PuyoW3DGame의 읽기 전용 스냅샷에서 가져온다.
     */
    class PuyoBoard3D {
        /**
         * TODO: [PuyoBoard3D.constructor] scene group, 셀 좌표표, 메시 재사용 캐시의 소유 관계를 초기화한다.
         * @param {object|null} three Three.js 네임스페이스
         * @param {object|null} scene 장면
         */
        constructor(three = null, scene = null) {
            this.columns = 6;
            this.rows = 17;
            this.three = three;
            this.scene = scene;
            this.group = null;
            this.meshes = new Map();
            if (three && scene) {
                this.group = new three.Group();
                this.group.name = 'puyo-board-3d';
                scene.add(this.group);
            }
        }

        /** 논리 보드 셀을 직교 화면의 월드 좌표로 변환한다. @param {number} x 열 @param {number} y 행 @returns {{x:number,y:number,z:number}} 월드 좌표 */
        cellToWorld(x, y) {
            return { x: (x - 2.5) * 1.05, y: (y - 5.5) * 1.05, z: 0 };
        }

        /** 보드 스냅샷에 맞춰 입체 메시를 생성·이동·삭제한다. @param {(string|null)[][]} board 논리 보드 @returns {void} */
        sync(board) {
            if (!this.group || !this.three) return;
            const visible = new Set();
            board.forEach((row, y) => row.forEach((color, x) => {
                if (!color) return;
                const key = `${x},${y}`;
                visible.add(key);
                let puyo = this.meshes.get(key);
                if (!puyo || puyo.color !== color) {
                    if (puyo) {
                        this.group.remove(puyo.mesh);
                        puyo.dispose();
                    }
                    puyo = new PuyoMesh3D(color, this.three);
                    this.meshes.set(key, puyo);
                    this.group.add(puyo.mesh);
                }
                puyo.setPosition(this.cellToWorld(x, y));
            }));
            this.meshes.forEach((puyo, key) => {
                if (visible.has(key)) return;
                this.group.remove(puyo.mesh);
                puyo.dispose();
                this.meshes.delete(key);
            });
        }

        /** 보드가 소유한 모든 메시와 geometry/material을 해제한다. @returns {void} */
        dispose() {
            this.meshes.forEach((puyo) => puyo.dispose());
            this.meshes.clear();
            if (this.group && this.scene) this.scene.remove(this.group);
            this.group = null;
        }
    }

    /**
     * 일반·방해 뿌요 하나의 입체 메시와 애니메이션 상태를 담당한다.
     *
     * TODO: [PuyoMesh3D] 색상별 재질, 구형/젤리형 기하, 눈·하이라이트, 착지·삭제·
     * 낙하 애니메이션을 구현한다. 재질과 geometry는 여러 인스턴스가 공유하도록 한다.
     */
    class PuyoMesh3D {
        /**
         * TODO: [PuyoMesh3D.constructor] color에 맞는 공유 geometry/material과 개별
         * Object3D를 만들고, garbage 계열의 별도 외형 규칙을 처리한다.
         * @param {string} color 뿌요 색 식별자
         */
        constructor(color, three = null) {
            this.color = color;
            this.three = three;
            this.mesh = null;
            this.geometry = null;
            this.material = null;
            if (three) this.createMesh();
        }

        /** 색상에 맞는 구형 입체 뿌요와 눈을 만든다. @returns {void} */
        createMesh() {
            if (!this.three) return;
            const Three = this.three;
            const resources = getMeshResources(Three, this.color);
            this.geometry = resources.geometry;
            this.material = resources.material;
            this.mesh = new Three.Mesh(this.geometry, this.material);
            this.mesh.name = `puyo-${this.color}`;
            if (resources.eyeGeometry && resources.eyeMaterial) {
                [-0.14, 0.14].forEach((offset) => {
                    const eye = new Three.Mesh(resources.eyeGeometry, resources.eyeMaterial);
                    eye.position.set(offset, 0.12, 0.41);
                    this.mesh.add(eye);
                });
            }
        }

        /** 뿌요 메시를 월드 좌표에 배치한다. @param {{x:number,y:number,z:number}} position 월드 좌표 @returns {void} */
        setPosition(position) {
            if (this.mesh) this.mesh.position.set(position.x, position.y, position.z);
        }

        /** geometry/material과 하위 눈 메시를 해제한다. @returns {void} */
        dispose() {
            if (!this.mesh) return;
            this.mesh = null;
            this.geometry = null;
            this.material = null;
        }
    }

    /**
     * 조작 중인 두 뿌요의 위치·회전과 시각 표현을 담당한다.
     *
     * TODO: [ActivePuyoPair3D] 키/패드 입력에 따른 이동·회전 보간과 착지 직전 그림자,
     * 다음 뿌요 미리보기와의 메시 공유를 구현한다.
     */
    class ActivePuyoPair3D {
        /** TODO: [ActivePuyoPair3D.constructor] 두 PuyoMesh3D와 논리 위치·회전·낙하 보간 상태를 초기화한다. */
        constructor(three = null) {
            this.three = three;
            this.group = three ? new three.Group() : null;
            this.primary = null;
            this.secondary = null;
            this.rotation = 0;
        }

        /** 활성 쌍의 색상과 위치를 3D 메시로 동기화한다. @param {{x:number,y:number,rotation:number,colors:string[]}|null} active 활성 쌍 @param {PuyoBoard3D} board 보드 좌표 변환기 @returns {void} */
        sync(active, board) {
            if (!this.group || !board) return;
            const cells = active ? fallbackActiveCells(active) : [];
            while (this.group.children.length > cells.length) this.group.remove(this.group.children[this.group.children.length - 1]);
            cells.forEach((cell, index) => {
                let mesh = this.group.children[index];
                if (!mesh || mesh.userData.color !== cell.color) {
                    if (mesh) {
                        this.group.remove(mesh);
                        mesh.userData.puyo?.dispose();
                    }
                    const puyo = new PuyoMesh3D(cell.color, board.three);
                    mesh = puyo.mesh;
                    mesh.userData.puyo = puyo;
                    mesh.userData.color = cell.color;
                    this.group.add(mesh);
                }
                const position = board.cellToWorld(cell.x, cell.y);
                mesh.position.set(position.x, position.y, 0.45);
            });
        }

        /** 활성 쌍 메시를 장면에서 제거한다. @returns {void} */
        dispose() {
            if (!this.group) return;
            [...this.group.children].forEach((mesh) => {
                this.group.remove(mesh);
                mesh.userData.puyo?.dispose();
            });
        }
    }

    /**
     * 원근감 없이 정면 게임 화면을 유지하는 직교 카메라 설정을 담당한다.
     *
     * TODO: [OrthographicGameCamera] THREE.OrthographicCamera를 만들고, canvas 종횡비
     * 변경 시 좌·우·상·하 절두체를 다시 계산한다. PerspectiveCamera는 사용하지 않는다.
     */
    class OrthographicGameCamera {
        /** TODO: [OrthographicGameCamera.constructor] 기본 화면 범위, near/far 값, 정면 바라보기 축을 정의한다. */
        constructor(three = null) {
            this.three = three;
            this.camera = null;
            this.bounds = { left: -8, right: 8, top: 8, bottom: -8, near: 0.1, far: 100 };
            if (three && typeof three.OrthographicCamera === 'function') this.create();
        }

        /** 원근감 없는 직교 카메라를 만든다. @returns {void} */
        create() {
            const { left, right, top, bottom, near, far } = this.bounds;
            this.camera = new this.three.OrthographicCamera(left, right, top, bottom, near, far);
            this.camera.position.set(0, 0, 20);
            this.camera.lookAt(0, 0, 0);
        }

        /** canvas 크기 변화에도 논리 화면 비율을 유지한다. @param {number} width 출력 너비 @param {number} height 출력 높이 @returns {void} */
        resize(width, height) {
            if (!this.camera || !width || !height) return;
            const aspect = width / height;
            const targetAspect = LOGICAL_WIDTH / LOGICAL_HEIGHT;
            if (aspect > targetAspect) {
                const halfHeight = (this.bounds.top - this.bounds.bottom) / 2;
                const halfWidth = halfHeight * aspect / targetAspect;
                this.camera.left = -halfWidth;
                this.camera.right = halfWidth;
            } else {
                const halfWidth = (this.bounds.right - this.bounds.left) / 2;
                const halfHeight = halfWidth * targetAspect / aspect;
                this.camera.top = halfHeight;
                this.camera.bottom = -halfHeight;
            }
            this.camera.updateProjectionMatrix();
        }
    }

    /**
     * Three.js scene, renderer, 조명, 렌더 루프를 감싼다.
     *
     * TODO: [ThreeRendererAdapter] 주입된 THREE 네임스페이스로 WebGLRenderer, Scene,
     * 직교 카메라, 환경광/방향광을 만들고 render()·resize()·dispose()를 구현한다.
     * 현재 배포된 three.core.min.js는 ES 모듈이므로, 모듈 브리지 또는 CommonJS 번들을
     * 이 어댑터에 주입하기 전에는 renderer를 생성하지 않는다.
     */
    class ThreeRendererAdapter {
        /**
         * TODO: [ThreeRendererAdapter.constructor] 전달받은 Three.js 네임스페이스의
         * 필수 생성자를 검증하고, renderer/scene/camera의 생성·해제 책임을 정한다.
         * @param {object|null} three Three.js 네임스페이스
         */
        constructor(three = null, canvas = null) {
            this.three = three;
            this.canvas = canvas;
            this.renderer = null;
            this.scene = null;
            this.camera = new OrthographicGameCamera(three);
            this.board = null;
            this.activePair = new ActivePuyoPair3D(three);
            this.activeGroup = this.activePair.group;
            this.effectGroup = null;
            this.background = null;
        }

        /** WebGL renderer와 기본 장면·조명을 준비한다. @returns {boolean} 준비 성공 여부 */
        initialize() {
            const Three = this.three;
            if (!Three || typeof Three.WebGLRenderer !== 'function' || !this.canvas) return false;
            try {
                this.renderer = new Three.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
                this.renderer.setClearColor(0x101a2d, 1);
                this.renderer.setPixelRatio(Math.min(globalObject.devicePixelRatio || 1, 2));
                this.scene = new Three.Scene();
                this.camera = new OrthographicGameCamera(Three);
                this.board = new PuyoBoard3D(Three, this.scene);
                this.activePair = new ActivePuyoPair3D(Three);
                this.activeGroup = this.activePair.group;
                this.activeGroup.name = 'active-puyo-pair-3d';
                this.scene.add(this.activeGroup);
                this.effectGroup = new Three.Group();
                this.effectGroup.name = 'puyo-effects-3d';
                this.scene.add(this.effectGroup);
                this.background = new Three.Mesh(
                    new Three.PlaneGeometry(15.5, 15.5),
                    new Three.MeshStandardMaterial({ color: 0x18253b, roughness: 0.9 })
                );
                this.background.position.set(0, 0, -0.7);
                this.scene.add(this.background);
                const ambient = new Three.HemisphereLight(0xdce8ff, 0x182033, 2.2);
                this.scene.add(ambient);
                const keyLight = new Three.DirectionalLight(0xffffff, 2.7);
                keyLight.position.set(-4, 8, 12);
                this.scene.add(keyLight);
                this.resize();
                return true;
            } catch (error) {
                console.warn('PuyoW3D WebGL renderer를 준비하지 못했습니다.', error);
                this.dispose();
                return false;
            }
        }

        /** 출력 크기와 직교 카메라를 canvas에 맞춘다. @returns {void} */
        resize() {
            if (!this.renderer || !this.canvas) return;
            const width = this.canvas.clientWidth || this.canvas.width || LOGICAL_WIDTH;
            const height = this.canvas.clientHeight || this.canvas.height || LOGICAL_HEIGHT;
            this.renderer.setSize(width, height, false);
            this.camera.resize(width, height);
        }

        /** 게임 보드와 활성 쌍을 장면에 반영하고 렌더링한다. @param {PuyoW3DGame} game 게임 상태 @returns {void} */
        render(game, effects = null) {
            if (!this.renderer || !this.board || !game) return;
            this.board.sync(game.board);
            this.activePair.sync(game.active, this.board);
            this.syncEffects(effects);
            this.renderer.render(this.scene, this.camera.camera);
        }

        /** 폭발 효과 큐를 투명한 구체의 팽창으로 표시한다. @param {PuyoW3DEffectManager|null} effects 효과 관리자 @returns {void} */
        syncEffects(effects) {
            if (!this.effectGroup || !effects) return;
            while (this.effectGroup.children.length) {
                const mesh = this.effectGroup.children[0];
                this.effectGroup.remove(mesh);
                mesh.geometry?.dispose();
                mesh.material?.dispose();
            }
            effects.effects.forEach((effect) => {
                const progress = Math.min(1, effect.elapsed / effect.duration);
                const geometry = new this.three.SphereGeometry(0.16 + progress * 0.42, 16, 12);
                const material = new this.three.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.75 * (1 - progress) });
                const mesh = new this.three.Mesh(geometry, material);
                const position = this.board.cellToWorld(effect.position.x, effect.position.y);
                mesh.position.set(position.x, position.y, 0.7);
                this.effectGroup.add(mesh);
            });
        }

        /** Three.js가 만든 자원을 해제한다. @returns {void} */
        dispose() {
            this.board?.dispose();
            this.activePair?.dispose();
            while (this.effectGroup?.children.length) {
                const mesh = this.effectGroup.children[0];
                this.effectGroup.remove(mesh);
                mesh.geometry?.dispose();
                mesh.material?.dispose();
            }
            this.background?.geometry?.dispose();
            this.background?.material?.dispose();
            this.renderer?.dispose();
            disposeMeshResources(this.three);
            this.renderer = null;
            this.scene = null;
            this.board = null;
            this.activeGroup = null;
            this.effectGroup = null;
        }
    }

    /**
     * 키보드·마우스·게임패드를 3D 게임 명령으로 정규화한다.
     *
     * TODO: [PuyoW3DInputController] 2D 버전과 동일한 키보드, Enter, 클릭, ESC,
     * Gamepad 동작을 유지하고, 화면별 포커스와 canvas hit test를 3D 장면과 관리한다.
     */
    class PuyoW3DInputController {
        /**
         * TODO: [PuyoW3DInputController.constructor] 이벤트 바인딩 목록과 입력 상태를
         * 준비하되, attach/detach를 여러 번 호출해도 이벤트가 중복 등록되지 않게 한다.
         * @param {HTMLCanvasElement} canvas 입력 대상 canvas
         */
        constructor(canvas) {
            this.canvas = canvas;
            this.attached = false;
            this.game = null;
            this.previousGamepadButtons = [];
            this.onKeydown = (event) => this.handleKeydown(event);
            this.onPointerDown = () => this.game?.hardDrop();
        }

        /** 입력 이벤트를 게임 상태에 연결한다. @param {PuyoW3DGame} game 조작할 게임 @returns {void} */
        attach(game) {
            if (this.attached) return;
            this.game = game;
            if (globalObject.addEventListener) globalObject.addEventListener('keydown', this.onKeydown);
            this.canvas?.addEventListener('pointerdown', this.onPointerDown);
            this.attached = true;
        }

        /** 키보드 입력을 3D 게임 명령으로 변환한다. @param {KeyboardEvent} event 키 이벤트 @returns {void} */
        handleKeydown(event) {
            if (!this.game || !this.game.running) return;
            const key = event.key.toLowerCase();
            if (key === 'escape') {
                event.preventDefault();
                this.game.paused = !this.game.paused;
                return;
            }
            if (this.game.paused && key === 'enter') {
                event.preventDefault();
                this.game.paused = false;
                return;
            }
            const actions = {
                arrowleft: () => this.game.move(-1),
                arrowright: () => this.game.move(1),
                arrowdown: () => this.game.softDrop(),
                arrowup: () => this.game.rotate(1),
                z: () => this.game.rotate(-1),
                x: () => this.game.rotate(1),
                ' ': () => this.game.hardDrop(),
                enter: () => this.game.hardDrop()
            };
            if (!actions[key]) return;
            event.preventDefault();
            actions[key]();
        }

        /** 연결된 게임패드의 방향과 버튼을 읽는다. @returns {void} */
        updateGamepad() {
            if (!globalObject.navigator?.getGamepads || !this.game || !this.game.running) return;
            const gamepad = [...globalObject.navigator.getGamepads()].find((pad) => pad);
            if (!gamepad) return;
            const [axisX = 0, axisY = 0] = gamepad.axes || [];
            if (axisX < -0.55 && !this.previousGamepadButtons.left) this.game.move(-1);
            if (axisX > 0.55 && !this.previousGamepadButtons.right) this.game.move(1);
            if (axisY > 0.55 && !this.previousGamepadButtons.down) this.game.softDrop();
            const buttons = gamepad.buttons || [];
            const pressed = (index) => Boolean(buttons[index]?.pressed);
            if (pressed(0) && !this.previousGamepadButtons.a) this.game.hardDrop();
            if (pressed(2) && !this.previousGamepadButtons.x) this.game.rotate(-1);
            if (pressed(3) && !this.previousGamepadButtons.y) this.game.rotate(1);
            if (pressed(9) && !this.previousGamepadButtons.start) this.game.paused = !this.game.paused;
            this.previousGamepadButtons = {
                left: axisX < -0.55,
                right: axisX > 0.55,
                down: axisY > 0.55,
                a: pressed(0),
                x: pressed(2),
                y: pressed(3),
                start: pressed(9)
            };
        }

        /** 입력 이벤트와 게임패드 참조를 해제한다. @returns {void} */
        detach() {
            if (globalObject.removeEventListener) globalObject.removeEventListener('keydown', this.onKeydown);
            this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
            this.game = null;
            this.attached = false;
            this.previousGamepadButtons = [];
        }
    }

    /**
     * 3D 전용 애니메이션과 효과 수명을 관리한다.
     *
     * TODO: [PuyoW3DEffectManager] 삭제, 연쇄, 공격 에너지, 피버, 패배 효과를 시간 축으로
     * 갱신하고, 결과 화면 전에는 완료되어야 하는 효과를 명시적으로 추적한다.
     */
    class PuyoW3DEffectManager {
        /** TODO: [PuyoW3DEffectManager.constructor] 효과 큐, 시간 기준, 완료 콜백과 취소 규칙을 초기화한다. */
        constructor() {
            this.effects = [];
        }

        /** 폭발 연출을 큐에 넣는다. @param {{x:number,y:number}} position 논리 좌표 @param {number} [duration=260] 지속 시간 @returns {void} */
        addExplosion(position, duration = 260) {
            this.effects.push({ type: 'explosion', position: { ...position }, elapsed: 0, duration });
        }

        /** 모든 효과의 시간을 갱신하고 끝난 효과를 제거한다. @param {number} delta 경과 시간 @returns {void} */
        update(delta) {
            this.effects = this.effects
                .map((effect) => ({ ...effect, elapsed: effect.elapsed + Math.max(0, delta) }))
                .filter((effect) => effect.elapsed < effect.duration);
        }

        /** 결과 전 대기해야 하는 효과가 있는지 반환한다. @returns {boolean} 효과 존재 여부 */
        hasPending() {
            return this.effects.length > 0;
        }

        /** 효과 큐를 비운다. @returns {void} */
        dispose() {
            this.effects = [];
        }
    }

    /**
     * 3D 버전의 수명 주기와 하위 객체를 조합한다.
     *
     * TODO: [PuyoW3DApplication] ThreeRendererAdapter 준비 후 requestAnimationFrame
     * 루프를 연결하고, 게임 상태 변화에 따라 보드·활성쌍·효과를 동기화한다.
     */
    class PuyoW3DApplication {
        /**
         * TODO: [PuyoW3DApplication.constructor] 하위 객체의 생성 순서와 의존성 주입
         * 계약을 확정하고, 실패 시 부분 생성한 WebGL 자원을 안전하게 되돌린다.
         * @param {HTMLCanvasElement} canvas 3D를 출력할 canvas
         * @param {{three?:object|null}} [options] 초기 설정
         */
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.shared2DApi = getShared2DApi();
            this.game = new PuyoW3DGame(this.shared2DApi);
            this.board = new PuyoBoard3D();
            this.renderer = new ThreeRendererAdapter(resolveThree(options.three || null), canvas);
            this.activePair = this.renderer.activePair;
            this.input = new PuyoW3DInputController(canvas);
            this.effects = new PuyoW3DEffectManager();
            this.game.onExplosions = (cells) => cells.forEach((position) => this.effects.addExplosion(position));
            this.initialized = false;
            this.animationFrameId = null;
            this.lastFrameTime = 0;
            this.hud = null;
            this.onResize = () => this.renderer.resize();
            this.frame = (time) => this.updateFrame(time);
        }

        /**
         * TODO: [PuyoW3DApplication.initialize] renderer, 입력 이벤트, resize 감지,
         * 애니메이션 루프를 순서대로 준비하고 중복 초기화를 거절한다.
         * @returns {void}
         */
        initialize() {
            if (this.initialized) return;
            this.renderer.initialize();
            this.activePair = this.renderer.activePair;
            this.input.attach(this.game);
            if (globalObject.addEventListener) globalObject.addEventListener('resize', this.onResize);
            this.createHud();
            this.initialized = true;
            this.lastFrameTime = typeof globalObject.performance?.now === 'function' ? globalObject.performance.now() : 0;
            this.animationFrameId = typeof globalObject.requestAnimationFrame === 'function'
                ? globalObject.requestAnimationFrame(this.frame)
                : null;
            this.renderer.render(this.game, this.effects);
            this.updateHud();
        }

        /**
         * TODO: [PuyoW3DApplication.getState] 외부 소비자가 변경할 수 없는 3D 화면·
         * 렌더러·게임 상태 스냅샷을 정의하고 반환한다.
         * @returns {{initialized:boolean,rendererReady:boolean}} 현재 골격의 준비 상태
         */
        getState() {
            return {
                initialized: this.initialized,
                rendererReady: this.renderer.renderer !== null,
                game: this.game.getSnapshot()
            };
        }

        /**
         * TODO: [PuyoW3DApplication.destroy] requestAnimationFrame, WebGL 자원, 입력
         * 이벤트, resize 감지를 역순으로 해제하며 여러 번 호출해도 안전하게 만든다.
         * @returns {void}
         */
        destroy() {
            if (this.animationFrameId !== null && globalObject.cancelAnimationFrame) globalObject.cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            if (globalObject.removeEventListener) globalObject.removeEventListener('resize', this.onResize);
            this.input.detach();
            this.effects.dispose();
            this.hud?.remove();
            this.hud = null;
            this.renderer.dispose();
            this.initialized = false;
        }

        /** 한 프레임 동안 게임·입력·효과·렌더러를 갱신한다. @param {number} time 현재 시각 @returns {void} */
        updateFrame(time) {
            if (!this.initialized) return;
            const delta = Math.min(100, Math.max(0, time - this.lastFrameTime));
            this.lastFrameTime = time;
            this.input.updateGamepad();
            this.game.update(delta);
            this.effects.update(delta);
            this.renderer.render(this.game, this.effects);
            this.updateHud();
            this.animationFrameId = typeof globalObject.requestAnimationFrame === 'function'
                ? globalObject.requestAnimationFrame(this.frame)
                : null;
        }

        /** canvas 위에 점수·상태·조작 안내를 표시할 HUD를 만든다. @returns {void} */
        createHud() {
            if (this.hud || !globalObject.document) return;
            this.hud = globalObject.document.createElement('div');
            this.hud.id = 'puyow3d_hud';
            Object.assign(this.hud.style, {
                color: '#f4f7ff',
                fontFamily: 'Pretendard, sans-serif',
                fontSize: '16px',
                lineHeight: '1.5',
                pointerEvents: 'none',
                position: 'absolute',
                left: '16px',
                top: '12px',
                textShadow: '0 1px 3px #000'
            });
            this.canvas.parentElement?.appendChild(this.hud);
        }

        /** 현재 게임 상태를 HUD 문구에 반영한다. @returns {void} */
        updateHud() {
            if (!this.hud) return;
            const state = this.game.getSnapshot();
            const next = state.nextPairs[0]?.join(' / ') || '-';
            const status = state.gameOver ? 'GAME OVER' : (state.paused ? 'PAUSED' : 'PLAYING');
            this.hud.textContent = `Puyo W 3D · ${status} · 점수 ${Math.floor(state.score)} · 다음 ${next} · ← → 이동 / ↑ Z X 회전 / Space 즉시 낙하 / Esc 일시정지`;
        }
    }

    /**
     * 3D 게임 골격을 초기화한다.
     *
     * TODO: [initialize] 옵션 검증, Three.js 의존성 주입, 비동기 자원 준비 완료 시점,
     * 초기화 실패 후 재시도 규칙을 구현한다.
     *
     * @param {HTMLCanvasElement|string|null} [target=null] canvas 요소 또는 id
     * @param {{three?:object|null}} [options={}] 향후 Three.js 네임스페이스 등의 설정
     * @returns {PuyoW3DApplication} 현재 3D 애플리케이션
     */
    function initialize(target = null, options = {}) {
        if (application) return application;
        application = new PuyoW3DApplication(resolveCanvas(target), options);
        application.initialize();
        return application;
    }

    /**
     * TODO: [getState] PuyoW3DApplication.getState()의 읽기 전용 복사본을 반환하고,
     * 아직 초기화되지 않은 경우의 호출 계약을 문서화한다.
     * @returns {{initialized:boolean,rendererReady:boolean}|null} 초기화된 3D 골격의 상태
     */
    function getState() {
        return application ? application.getState() : null;
    }

    /**
     * TODO: [destroy] 진행 중인 비동기 로드·효과를 취소하고, 다음 initialize()가
     * 완전히 새 인스턴스를 만들도록 모든 전역 참조를 해제한다.
     * @returns {void}
     */
    function destroy() {
        if (!application) return;
        application.destroy();
        application = null;
    }

    return {
        PuyoW3DApplication,
        PuyoW3DGame,
        PuyoBoard3D,
        PuyoMesh3D,
        ActivePuyoPair3D,
        OrthographicGameCamera,
        ThreeRendererAdapter,
        PuyoW3DInputController,
        PuyoW3DEffectManager,
        getShared2DApi,
        toWorldCoordinates,
        initialize,
        getState,
        destroy
    };
});
