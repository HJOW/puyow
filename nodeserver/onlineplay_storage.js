/** 온라인 플레이 파일 저장소. 서비스 규칙과 분리된 동기식 저장 계약이다. @license Apache-2.0 */
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * 기본 JSON 저장소. 생성만으로는 파일을 만들거나 지우지 않는다.
 * 다른 저장소도 initialize/loadNicknameIndex/listAccounts/loadAccount/saveAccount/saveRoom/removeRoom/clearRooms를 구현한다.
 * 계정 ID 검증, 닉네임 중복 정책, 스냅샷 변환과 저장 오류 처리는 서비스가 담당한다.
 */
class FileOnlinePlayStorage {
    /** @param {string} root 기존 저장 경로 또는 테스트용 독립 경로 */
    constructor(root = path.join(os.homedir(), '.puyowserver')) {
        this.accountRoot = path.join(root, 'account');
        this.roomRoot = path.join(root, 'rooms');
    }

    /** 온라인 기능을 켰을 때만 서비스가 호출한다. 실패는 호출자에게 전달한다. */
    initialize() {
        this.ensureDirectory(this.accountRoot);
        this.ensureDirectory(this.roomRoot);
    }

    /** 기존 파일의 닉네임 색인을 반환한다. 손상되거나 읽을 수 없는 계정은 건너뛴다. */
    loadNicknameIndex() {
        const nicknameIndex = new Map();
        let entries = [];
        try {
            entries = fs.readdirSync(this.accountRoot, { withFileTypes: true });
        } catch {
            return nicknameIndex;
        }
        entries.forEach((entry) => {
            if (!entry.isDirectory()) return;
            const account = this.readJsonFile(path.join(this.accountRoot, entry.name, 'account.json'));
            if (account && typeof account.nickname === 'string') nicknameIndex.set(account.nickname, entry.name);
        });
        return nicknameIndex;
    }

    /** 관리 화면의 계정 목록용으로 저장된 계정을 모두 읽는다. 손상된 계정은 건너뛴다. */
    listAccounts() {
        let entries = [];
        try {
            entries = fs.readdirSync(this.accountRoot, { withFileTypes: true });
        } catch {
            return [];
        }
        const accounts = [];
        entries.forEach((entry) => {
            if (!entry.isDirectory()) return;
            const account = this.readJsonFile(path.join(this.accountRoot, entry.name, 'account.json'));
            if (account && typeof account.id === 'string') accounts.push(account);
        });
        return accounts;
    }

    /** 이전 실행의 방 스냅샷만 지운다. 계정과 JSON 이외 파일은 보존한다. */
    clearRooms() {
        let entries = [];
        try {
            entries = fs.readdirSync(this.roomRoot);
        } catch {
            return;
        }
        entries.forEach((name) => {
            if (!name.endsWith('.json')) return;
            try {
                fs.unlinkSync(path.join(this.roomRoot, name));
            } catch {
                // 지우지 못한 파일은 메모리 상태와 무관하므로 무시한다.
            }
        });
    }

    /** 유효성을 확인한 ID로 계정을 조회한다. 없거나 읽기에 실패하면 null이다. */
    loadAccount(accountId) {
        return this.readJsonFile(path.join(this.accountRoot, accountId.toLowerCase(), 'account.json'));
    }

    /** 계정 전체를 저장한다. 실패는 호출자에게 전달한다. */
    saveAccount(account) {
        this.writeJsonFile(path.join(this.accountRoot, account.id.toLowerCase(), 'account.json'), account);
    }

    /** 소켓·세션을 제외한 방 스냅샷을 저장한다. 실패는 서비스에서 처리한다. */
    saveRoom(snapshot) {
        this.writeJsonFile(path.join(this.roomRoot, `${snapshot.id.toLowerCase()}.json`), snapshot);
    }

    /** 기존 계약대로 삭제 실패는 무시한다. */
    removeRoom(roomId) {
        try {
            fs.unlinkSync(path.join(this.roomRoot, `${roomId.toLowerCase()}.json`));
        } catch {
            // 메모리의 방 상태가 정본이므로 파일 삭제 실패로 방 처리를 중단하지 않는다.
        }
    }

    /**
     * 디렉터리가 없으면 만든다.
     * @param {string} dirPath 디렉터리 경로
     * @returns {void}
     */
    ensureDirectory(dirPath) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    /**
     * JSON 파일을 읽어 객체로 돌려준다. 읽지 못하면 null 이다.
     * @param {string} filePath 파일 경로
     * @returns {object|null} 파싱한 객체
     */
    readJsonFile(filePath) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {
            return null;
        }
    }

    /**
     * 객체를 JSON 파일로 저장한다.
     * @param {string} filePath 파일 경로
     * @param {object} value 저장할 객체
     * @returns {void}
     */
    writeJsonFile(filePath, value) {
        this.ensureDirectory(path.dirname(filePath));
        fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
    }

}
module.exports = { FileOnlinePlayStorage };
