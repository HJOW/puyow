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

    /** 캔버스에 그린 그림으로 추적되는 텍스처를 만든다. @param {number} width 폭 @param {number} height 높이 @param {function} paint 그리기 콜백 @returns {object} CanvasTexture */
    createPaintedTexture(width, height, paint) {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        paint(canvas.getContext('2d'), width, height);
        return this.own(new this.THREE.CanvasTexture(canvas));
    }

    /** @param {object[]} cards 등급·배경색·기존 카드 그림 콜백 @returns {boolean} 연출 시작 여부 */
    playCardReveal(cards) {
        this.cancelReveal();
        if (!cards.length) return false;
        try {
            if (!this.prepareRenderer()) return false;
            const T = this.THREE;
            const levels = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4 };
            const rank = Math.max(...cards.map((card) => levels[card.rarity] || 0));
            const started = performance.now();
            // 여러 장도 같은 시간축에 올린다. 게임의 delta 상한과 무관하게 실제 시간으로 끝나며, 가장 높은 전설도 4초를 넘지 않는다.
            this.reveal = { started, duration: 2200 + rank * 450, rank, resources: new Set(), cards: [], root: new T.Group(), flash: null, lastPaint: -Infinity };
            const effect = this.reveal;
            this.scene.add(effect.root);
            // 하나의 부드러운 빛 텍스처를 광채와 입자에 공유해 GPU 자원 수를 제한한다.
            const glowTexture = this.createPaintedTexture(64, 64, (ctx) => {
                const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
                gradient.addColorStop(0, 'rgba(255,255,255,1)');
                gradient.addColorStop(0.15, 'rgba(255,255,255,0.8)');
                gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
            });
            // 전설 연출에서만 쓰는 햇살·광택 텍스처는 필요할 때 한 번만 만들어 모든 전설 카드가 공유한다.
            let rayTexture = null;
            let sheenCanvas = null;
            if (rank >= 4) {
                rayTexture = this.createPaintedTexture(256, 256, (ctx) => {
                    ctx.translate(128, 128);
                    for (let ray = 0; ray < 18; ray += 1) {
                        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 128);
                        gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
                        gradient.addColorStop(0.55, `rgba(255,255,255,${ray % 2 ? 0.25 : 0.45})`);
                        gradient.addColorStop(1, 'rgba(255,255,255,0)');
                        ctx.fillStyle = gradient;
                        ctx.beginPath(); ctx.moveTo(0, 0);
                        ctx.arc(0, 0, 128, (ray / 18) * Math.PI * 2 - 0.07, (ray / 18) * Math.PI * 2 + 0.07);
                        ctx.closePath(); ctx.fill();
                    }
                });
                // 광택 띠는 텍스처 좌표 이동으로 카드 면을 가로지르므로 네 가장자리를 투명하게 둔다.
                sheenCanvas = document.createElement('canvas');
                sheenCanvas.width = 128; sheenCanvas.height = 176;
                const ctx = sheenCanvas.getContext('2d');
                ctx.translate(64, 88); ctx.rotate(-0.45);
                const band = ctx.createLinearGradient(-26, 0, 26, 0);
                band.addColorStop(0, 'rgba(255,255,255,0)');
                band.addColorStop(0.5, 'rgba(255,255,255,0.85)');
                band.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = band; ctx.fillRect(-26, -74, 52, 148);
            }
            const shadeColors = [0x030817, 0x030817, 0x030817, 0x0b0419, 0x140b01];
            const shade = new T.Mesh(this.own(new T.PlaneGeometry(1800, 1100)), this.own(new T.MeshBasicMaterial({ color: shadeColors[rank], transparent: true, opacity: 0.82, depthWrite: false })));
            shade.position.z = -250;
            effect.root.add(shade);
            if (rank >= 4) {
                // 전설 카드가 있으면 착지 순간 화면 전체에 금빛 섬광을 한 번 터뜨린다.
                effect.flash = new T.Mesh(this.own(new T.PlaneGeometry(1800, 1100)), this.own(new T.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false })));
                effect.flash.position.z = 120;
                effect.root.add(effect.flash);
            }
            const columns = Math.min(5, cards.length);
            const rows = Math.ceil(cards.length / columns);
            // 대량 합성에서도 행 간격까지 포함해 전체 결과를 화면 안에 배치한다.
            const rowGap = Math.min(14, 100 / rows);
            const height = Math.min(340, 520 / rows - rowGap);
            const width = height * 0.72;
            // COMMON, UNCOMMON, RARE, EPIC(보라), LEGENDARY(금) 순서의 주 색상과 보조 색상이다.
            const colors = [0xe0e9ff, 0x78ffbd, 0x5acaff, 0xb46bff, 0xffd45b];
            const accentColors = [0xffffff, 0xffffff, 0xffffff, 0xff6ad5, 0xfff6d8];
            const pointsOf = (count, color, size) => {
                const geometry = this.own(new T.BufferGeometry());
                geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(count * 3), 3));
                return new T.Points(geometry, this.own(new T.PointsMaterial({ map: glowTexture, color, size, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false })));
            };
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
                const rim = new T.Mesh(this.own(new T.BoxGeometry(width + 8, height + 8, 7)), this.own(new T.MeshBasicMaterial({ color: colors[level], transparent: true })));
                rim.position.z = -5;
                body.add(rim);
                const glow = new T.Mesh(this.own(new T.PlaneGeometry(width * 2.5, height * 2)), this.own(new T.MeshBasicMaterial({ map: glowTexture, color: colors[level], transparent: true, opacity: 0.18 + level * 0.14, blending: T.AdditiveBlending, depthWrite: false })));
                glow.position.z = -50;
                group.add(glow);
                // 등급이 오르면 입자 수와 광륜 수, 회전량이 함께 증가한다. 장식 궤적은 별도 난수 대신 인덱스로 정한다.
                const rings = [];
                for (let ringIndex = 0; ringIndex <= level; ringIndex += 1) {
                    const ringColor = level >= 3 && ringIndex % 2 ? accentColors[level] : colors[level];
                    const ring = new T.Mesh(this.own(new T.TorusGeometry(width * (0.82 + ringIndex * 0.13), 0.8 + level * 0.45, 6, 72)), this.own(new T.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false })));
                    ring.position.z = -35;
                    group.add(ring); rings.push(ring);
                }
                const points = pointsOf(24 + level * 32, colors[level], Math.min(18, 6 + level * 4));
                group.add(points);
                const item = { card, art, texture, body, group, rings, points, level, width, height, accent: null, shocks: [], rays: null, sheen: null, sparkles: null,
                    x: (index % columns - (countInRow - 1) / 2) * (width + 38), y: ((rows - 1) / 2 - Math.floor(index / columns)) * (height + rowGap) };
                if (level >= 3) {
                    // 에픽 이상은 보조 색 입자가 반대 방향으로 소용돌이치고, 착지 때 충격파 고리가 퍼진다(전설은 두 겹).
                    item.accent = pointsOf(40 + (level - 3) * 24, accentColors[level], 10 + (level - 3) * 3);
                    group.add(item.accent);
                    for (let shockIndex = 0; shockIndex < level - 2; shockIndex += 1) {
                        const shock = new T.Mesh(this.own(new T.RingGeometry(0.9, 1, 72)), this.own(new T.MeshBasicMaterial({ color: shockIndex ? accentColors[level] : colors[level], transparent: true, opacity: 0.9, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })));
                        shock.position.z = -20; shock.visible = false;
                        group.add(shock); item.shocks.push(shock);
                    }
                }
                if (level >= 4) {
                    // 전설은 회전하는 햇살, 카드 면을 훑는 광택, 위로 떠오르는 금빛 반짝이를 더한다.
                    item.rays = new T.Mesh(this.own(new T.PlaneGeometry(width * 3.4, width * 3.4)), this.own(new T.MeshBasicMaterial({ map: rayTexture, color: colors[level], transparent: true, opacity: 0.65, blending: T.AdditiveBlending, depthWrite: false })));
                    item.rays.position.z = -70;
                    group.add(item.rays);
                    // 카드마다 광택 위치가 달라야 하므로 같은 캔버스를 쓰는 텍스처를 카드별로 만든다.
                    const sheenTexture = this.own(new T.CanvasTexture(sheenCanvas));
                    item.sheen = new T.Mesh(this.own(new T.PlaneGeometry(width, height)), this.own(new T.MeshBasicMaterial({ map: sheenTexture, color: 0xfff4c8, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })));
                    item.sheen.position.z = 1;
                    body.add(item.sheen);
                    item.sparkles = pointsOf(60, 0xfff1b0, 9);
                    group.add(item.sparkles);
                }
                effect.cards.push(item);
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
        if (item.level >= 4) {
            // 전설 카드는 금빛 이중 테두리로 앞면에서도 구분되게 한다.
            ctx.strokeStyle = 'rgba(150,96,10,0.8)'; ctx.lineWidth = 2;
            ctx.strokeRect(20, 20, 216, 312);
        }
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
            if (effect.flash) {
                // 카드가 자리를 잡는 600~1,100ms 사이에만 섬광이 차올랐다가 사라진다.
                const flashPhase = (elapsed - 600) / 500;
                effect.flash.userData.opacityScale = flashPhase > 0 && flashPhase < 1 ? Math.sin(flashPhase * Math.PI) : 0;
            }
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
                if (item.accent) {
                    // 보조 입자는 주 입자와 반대 방향으로 돌며 반지름이 맥동한다.
                    const accent = item.accent.geometry.attributes.position;
                    for (let i = 0; i < accent.count; i += 1) {
                        const angle = -(i * 2.39996 + elapsed / 520);
                        const radius = item.width * (0.5 + ((i * 53) % 97) / 120) * (0.2 + 0.8 * ease) * (1 + 0.08 * Math.sin(elapsed / 180 + i));
                        accent.setXYZ(i, Math.cos(angle) * radius * 1.1, Math.sin(angle) * radius * 1.4, 30 + Math.cos(i * 1.3 + elapsed / 400) * 40);
                    }
                    accent.needsUpdate = true;
                }
                item.shocks.forEach((shock, shockIndex) => {
                    const phase = (elapsed - 620 - shockIndex * 260) / 900;
                    shock.visible = phase > 0 && phase < 1;
                    if (!shock.visible) return;
                    shock.scale.setScalar(item.width * (0.55 + phase * 2.3));
                    shock.userData.opacityScale = 1 - phase;
                });
                if (item.rays) {
                    item.rays.rotation.z = elapsed / 2600;
                    item.rays.scale.setScalar((0.35 + 0.65 * ease) * (1 + 0.06 * Math.sin(elapsed / 260)));
                }
                if (item.sheen) {
                    // 착지 후 1.3초마다 광택 띠가 왼쪽에서 오른쪽으로 카드 면을 지나간다.
                    const sweep = elapsed < 650 ? 0 : ((elapsed - 650 + index * 90) % 1300) / 1300;
                    item.sheen.material.map.offset.x = 1.2 - sweep * 2.4;
                }
                if (item.sparkles) {
                    // 금빛 반짝이는 카드 아래에서 위로 떠오르며 좌우로 살짝 흔들린다.
                    const sparkles = item.sparkles.geometry.attributes.position;
                    const span = item.height * 1.7;
                    for (let i = 0; i < sparkles.count; i += 1) {
                        const rise = (elapsed * (0.06 + (i % 7) * 0.012) + i * 97) % span;
                        const sway = Math.sin(elapsed / 420 + i * 1.9) * 10;
                        sparkles.setXYZ(i, (((i * 53) % 101) / 101 - 0.5) * item.width * 1.9 + sway, -item.height * 0.85 + rise, 25 + (i % 5) * 9);
                    }
                    sparkles.needsUpdate = true;
                    item.sparkles.userData.opacityScale = Math.min(1, elapsed / 700);
                }
            });
            if (repaint) effect.lastPaint = time;
            effect.root.traverse((object) => {
                if (!object.material) return;
                if (object.material.userData.baseOpacity === undefined) object.material.userData.baseOpacity = object.material.opacity;
                // 섬광·충격파처럼 스스로 밝기가 변하는 물체는 userData.opacityScale을 함께 곱한다.
                object.material.opacity = object.material.userData.baseOpacity * fade * (object.userData.opacityScale ?? 1);
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
