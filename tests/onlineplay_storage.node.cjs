/** Node 전용 회귀다. Playwright 수집 패턴과 분리하고 실제 홈 저장소에는 접근하지 않는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { FileOnlinePlayStorage } = require('../nodeserver/onlineplay_storage');
const { SqliteOnlinePlayStorage } = require('../docs/examples/onlineplay_sql');
const { createService } = require('../nodeserver/onlineplay');
const fixture = require('./onlineplay.fixture.json');

function temporaryDirectory(t, beforeCleanup = () => {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puyow-online-'));
    t.after(() => {
        beforeCleanup();
        // 이번 테스트가 만든 전용 임시 경로임을 확인한 뒤에만 정리한다.
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('puyow-online-'));
        fs.rmSync(root, { recursive: true, force: true });
    });
    return root;
}

test('파일 저장은 기존 JSON·대소문자·초기화·오류 계약을 유지한다', (t) => {
    const root = temporaryDirectory(t);
    const storage = new FileOnlinePlayStorage(root);
    assert.equal(fs.existsSync(path.join(root, 'account')), false);
    storage.initialize();
    storage.saveAccount(fixture.account);
    assert.deepEqual(storage.loadAccount('ALICE_1'), fixture.account);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'account/alice_1/account.json'), 'utf8')), fixture.account);
    const changed = storage.loadAccount('Alice_1');
    changed.winPoint = 99;
    assert.equal(storage.loadAccount('Alice_1').winPoint, 7);
    assert.equal(storage.loadAccount('missing'), null);
    storage.saveRoom(fixture.room);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'rooms/alice_1.json'), 'utf8')), fixture.room);
    fs.writeFileSync(path.join(root, 'rooms/keep.txt'), 'keep');
    fs.mkdirSync(path.join(root, 'account/broken'));
    fs.writeFileSync(path.join(root, 'account/broken/account.json'), '{');
    assert.equal(storage.loadAccount('broken'), null);
    assert.deepEqual([...storage.loadNicknameIndex()], [['Alice', 'alice_1']]);
    storage.clearRooms();
    assert.equal(fs.existsSync(path.join(root, 'rooms/alice_1.json')), false);
    assert.equal(fs.existsSync(path.join(root, 'rooms/keep.txt')), true);
    assert.deepEqual(storage.loadAccount('Alice_1'), fixture.account);
    storage.removeRoom('absent');
    fs.mkdirSync(path.join(root, 'rooms/fail.json'));
    assert.throws(() => storage.saveRoom({ ...fixture.room, id: 'fail' }));
    fs.mkdirSync(path.join(root, 'account/fail'));
    fs.mkdirSync(path.join(root, 'account/fail/account.json'));
    assert.throws(() => storage.saveAccount({ ...fixture.account, id: 'fail' }));
});

test('온라인 기능을 끄면 주입한 저장소의 메서드를 호출하지 않는다', () => {
    const storage = new Proxy({}, { get() { throw new Error('비활성 저장소 접근'); } });
    const service = createService({ enabled: false, storage });
    assert.equal(service.isEnabled(), false);
    service.close();
});

/** 받은 메시지는 먼저 쌓아 빠른 연속 응답도 잃지 않도록 한다. */
async function connect(base, t) {
    const socket = new WebSocket(base.replace('http:', 'ws:') + '/apis/onlineplay/socket');
    const inbox = [];
    socket.addEventListener('message', event => inbox.push(JSON.parse(event.data)));
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });
    t.after(() => socket.close());
    return {
        send(message) { socket.send(JSON.stringify(message)); },
        async next(type) {
            const deadline = Date.now() + 6000;
            while (Date.now() < deadline) {
                const index = inbox.findIndex(message => message.type === type);
                if (index >= 0) return inbox.splice(index, 1)[0];
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            assert.fail(`응답 대기 시간 초과: ${type}`);
        }
    };
}

for (const backend of ['file', 'sqlite']) {
    test(`${backend}: HTTP 가입·로그인부터 WebSocket 결과·방장 이양·재시작까지`, { timeout: 20000 }, async (t) => {
        let storage, service, server;
        const sockets = new Set();
        const root = temporaryDirectory(t, () => {
            service?.close();
            for (const socket of sockets) socket.destroy();
            server?.close();
            storage?.close?.();
        });
        storage = backend === 'file' ? new FileOnlinePlayStorage(root) : new SqliteOnlinePlayStorage(path.join(root, 'test.sqlite'));
        service = createService({ enabled: true, storage });
        server = http.createServer((req, res) => service.handleApi(req, res));
        server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
        server.on('upgrade', (req, socket) => service.handleUpgrade(req, socket));
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        async function api(action, data) {
            const response = await fetch(`${base}/apis/onlineplay/${action}`, { method: 'POST', body: JSON.stringify(data) });
            return { status: response.status, body: await response.json() };
        }
        const password = 'a'.repeat(64);
        assert.equal((await api('signup', { id: 'Alice_1', nickname: 'Alice', password })).status, 200);
        assert.equal((await api('signup', { id: 'alice_1', nickname: 'Different', password })).body.code, 'duplicate_id');
        assert.equal((await api('signup', { id: 'Bob_1', nickname: 'Alice', password })).body.code, 'duplicate_nickname');
        assert.equal((await api('signup', { id: 'Bob_1', nickname: 'alice', password })).status, 200);
        const alice = (await api('login', { id: 'ALICE_1', password })).body;
        const bob = (await api('login', { id: 'Bob_1', password })).body;
        assert.equal(alice.winPoint, 0);
        const saveAccount = storage.saveAccount.bind(storage);
        storage.saveAccount = () => { throw new Error('검증용 계정 저장 실패'); };
        const log = t.mock.method(console, 'error', () => {});
        assert.equal((await api('signup', { id: 'Fail_1', nickname: 'Fail', password })).body.code, 'server_error');
        storage.saveAccount = saveAccount;
        const first = await connect(base, t), second = await connect(base, t);
        first.send({ type: 'auth', token: alice.token });
        second.send({ type: 'auth', token: bob.token });
        await first.next('auth_ok'); await second.next('auth_ok');
        first.send({ type: 'room_create', rule: 'standard', colorCount: 4 });
        const created = await first.next('room_state');
        assert.equal(created.room.id, 'Alice_1');
        const saveRoom = storage.saveRoom.bind(storage);
        storage.saveRoom = () => { throw new Error('검증용 방 저장 실패'); };
        second.send({ type: 'room_join', roomId: created.room.id });
        assert.equal((await second.next('room_state')).room.guest.id, 'Bob_1');
        assert.ok(log.mock.callCount() >= 2);
        storage.saveRoom = saveRoom;
        log.mock.restore();
        first.send({ type: 'game_start_request' });
        const game1 = await first.next('game_start'), game2 = await second.next('game_start');
        assert.deepEqual(game1.deck, game2.deck);
        assert.equal(game1.deck.length, 512);
        second.send({ type: 'defeat', time: 1000 });
        assert.equal((await first.next('game_result')).winPoint, 3);
        assert.equal((await second.next('game_result')).winPoint, 0);
        assert.equal(storage.loadAccount('Alice_1').winPoint, 3);
        // 방장이 나간 뒤 남은 참여자의 ID로 스냅샷이 교체된다.
        await api('logout', { token: alice.token });
        if (backend === 'file') {
            assert.equal(fs.existsSync(path.join(root, 'rooms/alice_1.json')), false);
            assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'rooms/bob_1.json'))).host.id, 'Bob_1');
        } else {
            assert.deepEqual(storage.query('SELECT id FROM puyow_rooms').map(row => row.id), ['bob_1']);
        }
        // 재시작 초기화는 계정을 보존하고 방 스냅샷만 지운다.
        service.close();
        const freshStorage = backend === 'file' ? new FileOnlinePlayStorage(root) : new SqliteOnlinePlayStorage(path.join(root, 'test.sqlite'));
        const restarted = createService({ enabled: true, storage: freshStorage });
        try {
            assert.equal(freshStorage.loadAccount('ALICE_1').winPoint, 3);
            assert.equal(freshStorage.loadNicknameIndex().get('alice'), 'bob_1');
            if (backend === 'file') assert.deepEqual(fs.readdirSync(path.join(root, 'rooms')), []);
            else assert.equal(freshStorage.query('SELECT id FROM puyow_rooms').length, 0);
        } finally { restarted.close(); freshStorage.close?.(); }
    });
}
