/**
 * @license Apache-2.0
 * Copyright 2026 HJOW
 * Licensed under the Apache License, Version 2.0.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * 
 * 뿌요 W 3D 이펙트 스크립트
 *     의존성
 *         puyow.js     (필수, 기본 게임 코드)
 *         three.min.js (필수, 3D 효과 메인 라이브러리)
 *         json5.min.js (선택사항, JSON5 형식 사용을 위함)
 *         ort.all.min.js, ort.webgl.min.js, ort.wasm.min.js (선택사항, ONNX Runtime 사용을 위함)
 *         puyow.css (선택사항, 캔버스 영역이 화면 100%를 차지하게 만들고, 기본 뒷배경 색 변경)
 *         notice_ko.txt, notice_en.txt (선택사항으로 공지사항 존재 시 이 곳에 기재)
 *     html 예제
 *         puyow.html
 */

class PuyoW3DEffectManager {
    /** @type {HTMLCanvasElement} 3D 효과를 렌더링할 캔버스 객체 */
    canvas3d = null;
    /** @type {THREE} Three.js 라이브러리 객체 */
    THREE = null;
    /** @type {THREE.WebGLRenderer} 3D 렌더러 객체 */
    renderer = null;
    /** @type {THREE.Camera} 3D 카메라 객체 */
    camera   = null;
    /** @type {THREE.Scene} 3D 장면 객체 */
    scene    = null;

    /** @type {boolean} 3D 매니저 초기화 여부 */
    initialized = false;


    constructor() {}

    /** 
     * 3D 매니저 초기화
     * @param {HTMLCanvasElement} canvas3d 3D 효과를 렌더링할 캔버스 객체 
     * 
    */
    initialize(canvas3d) {
        if(this.initialized) return;

        // Three.js 존재여부 탐지 (Three.js 액세스가 불가능하면 3D 효과도 초기화하지 않음)
        if (typeof(window.THREE) == 'undefined') {
            console.error('Three.js is not loaded. 3D effects will not be initialized.');
            return;
        }
        this.THREE = window.THREE;
        this.canvas3d = canvas3d;
        this.renderer = new window.THREE.WebGLRenderer({ canvas: this.canvas3d, antialias: true });
        this.renderer.setSize(this.canvas3d.clientWidth, this.canvas3d.clientHeight);
        this.scene = new window.THREE.Scene();
        this.camera = new window.THREE.PerspectiveCamera(75, this.canvas3d.clientWidth / this.canvas3d.clientHeight, 0.1, 1000);

        // TODO: 3D 렌더러 및 장면 초기화 코드 작성

        this.initialized = true;
    }

    /** 창 크기 변경 / 방향 변경 시 호출 */
    onWindowResize() {
        if (!this.initialized) return;
        this.camera.aspect = this.canvas3d.clientWidth / this.canvas3d.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.canvas3d.clientWidth, this.canvas3d.clientHeight);
    }

    /** 3D 효과 사용 중단 */
    dispose() {
        this.canvas3d = null;
        this.initialized = false;
    }
}

const PUYOW_3D_INSTANCES = new PuyoW3DEffectManager();

window.PuyoW3DEffect = {
    initialize : function(canvas3d) {
        PUYOW_3D_INSTANCES.initialize(canvas3d);
        return PUYOW_3D_INSTANCES;
    },
    dispose : function() {
        PUYOW_3D_INSTANCES.dispose();
    }
}
