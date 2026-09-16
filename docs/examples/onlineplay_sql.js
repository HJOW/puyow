/** Server.md의 동기식 SQL 저장소 예제. 기본 서버는 이 파일을 사용하지 않는다. */
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/** 테이블에 기존 JSON을 그대로 저장하여 필드와 시간 단위를 유지한다. */
class SqlOnlinePlayStorage {
    /** 스키마 준비와 방 초기화는 분리한다. 계정은 초기화할 때 삭제하지 않는다. */
    initialize() {
        for (const table of ['puyow_accounts', 'puyow_rooms']) {
            this.query(`CREATE TABLE IF NOT EXISTS ${table} (id VARCHAR(20) PRIMARY KEY, payload TEXT NOT NULL)`);
        }
    }

    /** 서비스가 닉네임 대소문자 구분을 계속 담당한다. */
    loadNicknameIndex() {
        const index = new Map();
        try {
            for (const row of this.query('SELECT id, payload FROM puyow_accounts')) {
                try {
                    const account = JSON.parse(row.payload);
                    if (typeof account?.nickname === 'string') index.set(account.nickname, row.id);
                } catch { /* 손상된 행은 기존 파일 색인과 같이 건너뛴다. */ }
            }
        } catch { /* 기존 파일 조회 실패 정책을 유지하는 학습용 예제다. */ }
        return index;
    }

    /** 관리 화면의 계정 목록용이다. 손상된 행은 닉네임 색인과 같이 건너뛴다. */
    listAccounts() {
        const accounts = [];
        try {
            for (const row of this.query('SELECT payload FROM puyow_accounts')) {
                try {
                    const account = JSON.parse(row.payload);
                    if (typeof account?.id === 'string') accounts.push(account);
                } catch { /* 손상된 행은 건너뛴다. */ }
            }
        } catch { /* 기존 파일 조회 실패 정책을 유지하는 학습용 예제다. */ }
        return accounts;
    }

    loadAccount(id) {
        try {
            const rows = this.query('SELECT payload FROM puyow_accounts WHERE id = ?', [id.toLowerCase()]);
            return rows.length ? JSON.parse(rows[0].payload) : null;
        } catch { return null; }
    }

    saveAccount(account) { this.save('puyow_accounts', account); }
    saveRoom(snapshot) { this.save('puyow_rooms', snapshot); }

    /** 테이블명은 내부 상수만 사용하고 값은 SQL 매개변수로 전달한다. */
    save(table, value) {
        const suffix = this.dialect === 'mariadb'
            ? 'ON DUPLICATE KEY UPDATE payload = VALUES(payload)'
            : 'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload';
        this.query(`INSERT INTO ${table} (id, payload) VALUES (?, ?) ${suffix}`, [value.id.toLowerCase(), JSON.stringify(value)]);
    }

    removeRoom(id) {
        try { this.query('DELETE FROM puyow_rooms WHERE id = ?', [id.toLowerCase()]); }
        catch { /* 기존 삭제 실패 정책을 유지한다. */ }
    }

    clearRooms() {
        try { this.query('DELETE FROM puyow_rooms'); }
        catch { /* 메모리의 방 상태가 정본이다. */ }
    }
}

/** Node 22.12에서는 --experimental-sqlite 옵션이 필요하다. */
class SqliteOnlinePlayStorage extends SqlOnlinePlayStorage {
    constructor(filename) {
        super();
        this.filename = filename;
        this.dialect = 'sqlite';
    }

    initialize() {
        const { DatabaseSync } = require('node:sqlite');
        this.database = new DatabaseSync(this.filename);
        super.initialize();
    }

    query(sql, parameters = []) {
        const statement = this.database.prepare(sql);
        if (sql.startsWith('SELECT')) return statement.all(...parameters);
        statement.run(...parameters);
        return [];
    }

    close() { this.database?.close(); }
}

/** 동기식 서비스와 비동기 DB 드라이버 사이의 학습용 별도 프로세스 경계다. */
class MariaDbOnlinePlayStorage extends SqlOnlinePlayStorage {
    constructor(config) {
        super();
        this.config = config;
        this.dialect = 'mariadb';
    }

    query(sql, parameters = []) {
        // 비밀번호를 명령행에 넣지 않고 표준 입력으로 보낸다. 셸은 실행하지 않는다.
        const result = spawnSync(process.execPath, [path.join(__dirname, 'onlineplay_mariadb_query.js')], {
            input: JSON.stringify({ config: this.config, sql, parameters }),
            encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 8 * 1024 * 1024
        });
        if (result.error || result.status !== 0) throw new Error('MariaDB 예제 쿼리를 실행하지 못했습니다.');
        return JSON.parse(result.stdout);
    }
}

module.exports = { SqliteOnlinePlayStorage, MariaDbOnlinePlayStorage };
