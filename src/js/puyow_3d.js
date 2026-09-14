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
    /** 캔버스 연결과 GPU 초기화를 분리하여 효과가 필요할 때만 WebGL을 만든다. */
    constructor() {
        this.canvas3d = null;
        this.THREE = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.initialized = false;
        this.failed = false;
        this.reveal = null;
        this.finishTimer = null;
        this.onActiveChange = () => {};
        this.onContextLost = (event) => { event.preventDefault(); this.disable(); };
    }

    /** @returns {boolean} 현재 카드 등장 연출 진행 여부 */
    get active() { return this.reveal !== null; }

    /** @param {HTMLCanvasElement} canvas3d 효과 캔버스 @param {object} options 2D 레이어 연결 콜백 */
    initialize(canvas3d, options = {}) {
        this.dispose();
        this.canvas3d = canvas3d;
        this.THREE = window.THREE || null;
        this.failed = false;
        this.onActiveChange = options.onActiveChange || (() => {});
        canvas3d.addEventListener('webglcontextlost', this.onContextLost);
    }

    /** GPU 자원을 추적하여 완료·취소·부분 생성 실패 때도 모두 해제한다. @param {object} resource GPU 자원 @returns {object} */
    own(resource) {
        this.reveal.resources.add(resource);
        return resource;
    }

    /** 2D 화면을 가리지 않는 투명 렌더러를 지연 생성한다. @returns {boolean} 사용 가능 여부 */
    prepareRenderer() {
        if (!this.THREE || !this.canvas3d || this.failed) return false;
        if (this.initialized) return true;
        const T = this.THREE;
        this.renderer = new T.WebGLRenderer({ canvas: this.canvas3d, alpha: true, antialias: true });
        this.renderer.setClearColor(0x000000, 0);
        this.scene = new T.Scene();
        // 월드 좌표를 논리 화면 1280x720에 맞추고, 화면 회전은 기존 CSS에 맡긴다.
        this.camera = new T.PerspectiveCamera(2 * Math.atan(360 / 1000) * 180 / Math.PI, 1280 / 720, 1, 3000);
        this.camera.position.z = 1000;
        this.initialized = true;
        this.onWindowResize();
        return this.initialized;
    }

    /** @param {object[]} cards 등급·배경색·기존 카드 그림 콜백 @returns {boolean} 연출 시작 여부 */
    playCardReveal(cards) {
        this.cancelReveal();
        if (!cards.length) return false;
        try {
            if (!this.prepareRenderer()) return false;
            const T = this.THREE;
            const levels = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3 };
            const rank = Math.max(...cards.map((card) => levels[card.rarity] || 0));
            const started = performance.now();
            // 여러 장도 같은 시간축에 올린다. 게임의 delta 상한과 무관하게 실제 시간으로 끝난다.
            this.reveal = { started, duration: 2200 + rank * 450, resources: new Set(), cards: [], root: new T.Group(), lastPaint: -Infinity };
            const effect = this.reveal;
            this.scene.add(effect.root);
            // 하나의 부드러운 빛 텍스처를 광채와 입자에 공유해 GPU 자원 수를 제한한다.
            const glowCanvas = document.createElement('canvas');
            glowCanvas.width = 64; glowCanvas.height = 64;
            const glowContext = glowCanvas.getContext('2d');
            const glowGradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
            glowGradient.addColorStop(0, 'rgba(255,255,255,1)');
            glowGradient.addColorStop(0.15, 'rgba(255,255,255,0.8)');
            glowGradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
            glowGradient.addColorStop(1, 'rgba(255,255,255,0)');
            glowContext.fillStyle = glowGradient; glowContext.fillRect(0, 0, 64, 64);
            const glowTexture = this.own(new T.CanvasTexture(glowCanvas));
            const shade = new T.Mesh(this.own(new T.PlaneGeometry(1800, 1100)), this.own(new T.MeshBasicMaterial({ color: 0x030817, transparent: true, opacity: 0.82, depthWrite: false })));
            shade.position.z = -250;
            effect.root.add(shade);
            const columns = Math.min(5, cards.length);
            const rows = Math.ceil(cards.length / columns);
            // 대량 합성에서도 행 간격까지 포함해 전체 결과를 화면 안에 배치한다.
            const rowGap = Math.min(14, 100 / rows);
            const height = Math.min(340, 520 / rows - rowGap);
            const width = height * 0.72;
            cards.forEach((card, index) => {
                const level = levels[card.rarity] || 0;
                const countInRow = Math.min(columns, cards.length - Math.floor(index / columns) * columns);
                const group = new T.Group();
                effect.root.add(group);
                // 앞면과 두께를 같은 물체로 회전시켜 뒷면이 카드 그림을 가리지 않게 한다.
                const body = new T.Group();
                group.add(body);
                const art = document.createElement('canvas');
                art.width = 256; art.height = 352;
                const texture = this.own(new T.CanvasTexture(art));
                texture.colorSpace = T.SRGBColorSpace;
                const material = this.own(new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide, transparent: true }));
                const face = new T.Mesh(this.own(new T.PlaneGeometry(width, height)), material);
                body.add(face);
                const colors = [0xe0e9ff, 0x78ffbd, 0x5acaff, 0xffd45b];
                const rim = new T.Mesh(this.own(new T.BoxGeometry(width + 8, height + 8, 7)), this.own(new T.MeshBasicMaterial({ color: colors[level], transparent: true })));
                rim.position.z = -5;
                body.add(rim);
                const glow = new T.Mesh(this.own(new T.PlaneGeometry(width * 2.5, height * 2)), this.own(new T.MeshBasicMaterial({ map: glowTexture, color: colors[level], transparent: true, opacity: 0.18 + level * 0.14, blending: T.AdditiveBlending, depthWrite: false })));
                glow.position.z = -50;
                group.add(glow);
                // 등급이 오르면 입자 수와 광륜 수, 회전량이 함께 증가한다. 장식 궤적은 별도 난수 대신 인덱스로 정한다.
                const rings = [];
                for (let ringIndex = 0; ringIndex <= level; ringIndex += 1) {
                    const ring = new T.Mesh(this.own(new T.TorusGeometry(width * (0.82 + ringIndex * 0.13), 0.8 + level * 0.45, 6, 72)), this.own(new T.MeshBasicMaterial({ color: colors[level], transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false })));
                    ring.position.z = -35;
                    group.add(ring); rings.push(ring);
                }
                const particleCount = 24 + level * 32;
                const positions = new Float32Array(particleCount * 3);
                const geometry = this.own(new T.BufferGeometry());
                geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
                const points = new T.Points(geometry, this.own(new T.PointsMaterial({ map: glowTexture, color: colors[level], size: 6 + level * 4, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false })));
                group.add(points);
                effect.cards.push({ card, art, texture, body, group, rings, points, level, width, height,
                    x: (index % columns - (countInRow - 1) / 2) * (width + 38), y: ((rows - 1) / 2 - Math.floor(index / columns)) * (height + rowGap) });
            });
            this.onActiveChange(true);
            this.update(performance.now());
            if (!this.active) return false;
            this.finishTimer = setTimeout(() => this.cancelReveal(), Math.max(0, effect.duration - (performance.now() - started)));
            return this.active;
        } catch (error) {
            // 카드 지급·저장은 이미 끝났다. WebGL 오류가 그 결과나 2D 게임 루프를 중단시키지 않게 한다.
            this.disable();
            return false;
        }
    }

    /** 기존 2D 카드 그림을 텍스처에 그린다. 늦게 도착한 초상화도 연출 중 다시 반영한다. @param {object} item 카드 연출 상태 */
    paintCard(item) {
        const ctx = item.art.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, 256, 352);
        ctx.fillStyle = item.card.color;
        ctx.fillRect(0, 0, 256, 352);
        const sheen = ctx.createLinearGradient(0, 0, 256, 352);
        sheen.addColorStop(0, 'rgba(255,255,255,0.7)');
        sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
        sheen.addColorStop(1, 'rgba(10,20,40,0.4)');
        ctx.fillStyle = sheen; ctx.fillRect(0, 0, 256, 352);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
        ctx.strokeRect(12, 12, 232, 328);
        ctx.save();
        ctx.translate(128, 176); ctx.scale(4, 4); ctx.translate(-31, -52);
        item.card.draw(ctx, { x: 0, y: 0, width: 62, height: 124 });
        ctx.restore();
        item.texture.needsUpdate = true;
    }

    /** 게임 delta 상한의 영향을 받지 않고 실제 경과 시간으로 진행한다. @param {number} time RAF의 절대 시각 */
    update(time) {
        if (!this.active) return;
        const effect = this.reveal;
        const elapsed = Math.max(0, time - effect.started);
        if (elapsed >= effect.duration) { this.cancelReveal(); return; }
        try {
            const enter = Math.min(1, elapsed / 700);
            const ease = 1 - Math.pow(1 - enter, 3);
            const fade = Math.min(1, elapsed / 160, (effect.duration - elapsed) / 450);
            const repaint = time - effect.lastPaint >= 200;
            effect.cards.forEach((item, index) => {
                if (repaint) this.paintCard(item);
                item.group.position.set(item.x * ease, item.y * ease, -450 * (1 - ease));
                item.group.scale.setScalar(0.2 + 0.8 * ease);
                item.body.rotation.y = (1 - ease) * Math.PI * (2 + item.level) + Math.sin(elapsed / 600 + index) * 0.09 * ease;
                item.body.rotation.z = (1 - ease) * (index % 2 ? -0.35 : 0.35);
                item.rings.forEach((ring, ringIndex) => {
                    ring.rotation.set(0.5 + ringIndex * 0.6, elapsed / (650 + ringIndex * 220), elapsed / 1100 + ringIndex);
                });
                const positions = item.points.geometry.attributes.position;
                for (let i = 0; i < positions.count; i += 1) {
                    const angle = i * 2.39996 + elapsed / (900 + item.level * 160);
                    const radius = item.width * (0.65 + ((i * 37) % 101) / 110) * (0.3 + 0.7 * ease);
                    positions.setXYZ(i, Math.cos(angle) * radius, Math.sin(angle) * radius * 1.25, Math.sin(i * 1.7 + elapsed / 700) * 70);
                }
                positions.needsUpdate = true;
            });
            if (repaint) effect.lastPaint = time;
            effect.root.traverse((object) => {
                if (!object.material) return;
                if (object.material.userData.baseOpacity === undefined) object.material.userData.baseOpacity = object.material.opacity;
                object.material.opacity = object.material.userData.baseOpacity * fade;
            });
            this.renderer.render(this.scene, this.camera);
        } catch (error) { this.disable(); }
    }

    /** CSS 회전 후 크기가 아니라 2D와 동일한 실제 출력 해상도를 사용한다. */
    onWindowResize() {
        if (!this.initialized) return;
        try {
            this.renderer.setSize(this.canvas3d.width, this.canvas3d.height, false);
            this.camera.aspect = this.canvas3d.width / this.canvas3d.height;
            this.camera.updateProjectionMatrix();
        } catch (error) { this.disable(); }
    }

    /** 완료·건너뛰기·화면 종료 모두 같은 자원 해제와 레이어 복원 경로를 쓴다. */
    cancelReveal() {
        clearTimeout(this.finishTimer);
        this.finishTimer = null;
        const effect = this.reveal;
        this.reveal = null;
        if (effect) {
            this.scene.remove(effect.root);
            effect.resources.forEach((resource) => resource.dispose());
            this.renderer?.renderLists.dispose();
        }
        this.onActiveChange(false);
        try { this.renderer?.clear(); } catch (error) { /* GPU 손실 때도 입력 레이어는 이미 복원되어 있다. */ }
    }

    /** WebGL 초기화 실패나 컨텍스트 손실 후 2D 표시를 유지한다. */
    disable() {
        this.failed = true;
        this.cancelReveal();
        try { this.renderer?.dispose(); } catch (error) { /* 사용할 수 없는 GPU의 정리 오류는 무시한다. */ }
        this.renderer = null;
        this.initialized = false;
    }

    /** 게임 파괴 후 다시 초기화할 수 있도록 타이머·이벤트·GPU 자원을 해제한다. */
    dispose() {
        this.disable();
        this.canvas3d?.removeEventListener('webglcontextlost', this.onContextLost);
        this.canvas3d = null;
        this.THREE = null;
        this.scene = null;
        this.camera = null;
        this.onActiveChange = () => {};
    }
}

const PUYOW_3D_INSTANCES = new PuyoW3DEffectManager();

if (typeof window !== 'undefined') window.PuyoW3DEffect = {
    initialize(canvas3d, options) {
        PUYOW_3D_INSTANCES.initialize(canvas3d, options);
        return PUYOW_3D_INSTANCES;
    },
    dispose() { PUYOW_3D_INSTANCES.dispose(); }
};
