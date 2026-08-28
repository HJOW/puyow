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
            this.running = false;
        }
    }

    /**
     * 뿌요 필드의 3D 보드 모델과 메시 묶음을 담당한다.
     *
     * TODO: [PuyoBoard3D] 6x17 논리 셀을 3D 좌표로 매핑하고, 고정 뿌요·낙하쌍·
     * 방해뿌요를 증분 갱신한다. 보드 상태는 PuyoW3DGame의 읽기 전용 스냅샷에서 가져온다.
     */
    class PuyoBoard3D {
        /** TODO: [PuyoBoard3D.constructor] scene group, 셀 좌표표, 메시 재사용 캐시의 소유 관계를 초기화한다. */
        constructor() {
            this.columns = 6;
            this.rows = 17;
            this.meshes = new Map();
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
        constructor(color) {
            this.color = color;
            this.mesh = null;
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
        constructor() {
            this.primary = null;
            this.secondary = null;
            this.rotation = 0;
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
        constructor() {
            this.camera = null;
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
        constructor(three = null) {
            this.three = three;
            this.renderer = null;
            this.scene = null;
            this.camera = new OrthographicGameCamera();
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
            this.game = new PuyoW3DGame(getShared2DApi());
            this.board = new PuyoBoard3D();
            this.activePair = new ActivePuyoPair3D();
            this.renderer = new ThreeRendererAdapter(options.three || null);
            this.input = new PuyoW3DInputController(canvas);
            this.effects = new PuyoW3DEffectManager();
            this.initialized = false;
        }

        /**
         * TODO: [PuyoW3DApplication.initialize] renderer, 입력 이벤트, resize 감지,
         * 애니메이션 루프를 순서대로 준비하고 중복 초기화를 거절한다.
         * @returns {void}
         */
        initialize() {
            this.initialized = true;
        }

        /**
         * TODO: [PuyoW3DApplication.getState] 외부 소비자가 변경할 수 없는 3D 화면·
         * 렌더러·게임 상태 스냅샷을 정의하고 반환한다.
         * @returns {{initialized:boolean,rendererReady:boolean}} 현재 골격의 준비 상태
         */
        getState() {
            return { initialized: this.initialized, rendererReady: this.renderer.renderer !== null };
        }

        /**
         * TODO: [PuyoW3DApplication.destroy] requestAnimationFrame, WebGL 자원, 입력
         * 이벤트, resize 감지를 역순으로 해제하며 여러 번 호출해도 안전하게 만든다.
         * @returns {void}
         */
        destroy() {
            this.initialized = false;
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
