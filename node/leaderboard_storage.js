/** 리더보드 파일 저장소. 서비스 규칙과 분리된 동기식 저장 계약이다. @license Apache-2.0 */
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * 기본 JSON 저장소. 생성만으로는 파일을 만들거나 지우지 않는다.
 * 다른 저장소도 initialize/loadPlayer/savePlayer/listPlayers 를 구현하면 그대로 갈아 끼울 수 있다.
 * 닉네임 검증과 기록 형식 검사, 순위 병합은 서비스(leaderboard.js)가 담당한다.
 *
 * 한 사람의 기록을 [홈디렉토리]/.puyowserver/leaderboard/[닉네임].json 한 파일에 모아 둔다.
 * 파일 입출력은 모두 동기 함수를 쓴다. node.js 는 단일 스레드이므로 읽기·고치기·쓰기 한 묶음이
 * 다른 요청에 끼어들지 않고 끝나며, 이것이 곧 이 저장소의 잠금 장치다. (파이썬 쪽은 스레드 서버라
 * python/leaderboard_storage.py 에서 threading.Lock 을 따로 쓴다.)
 */
class FileLeaderboardStorage {
    /** @param {string} root 기존 저장 경로 또는 테스트용 독립 경로 */
    constructor(root = path.join(os.homedir(), '.puyowserver')) {
        this.leaderboardRoot = path.join(root, 'leaderboard');
    }

    /** 리더보드 기능을 켰을 때만 서비스가 호출한다. 실패는 호출자에게 전달한다. */
    initialize() {
        fs.mkdirSync(this.leaderboardRoot, { recursive: true });
    }

    /**
     * 한 사람의 기록 파일을 읽는다. 없거나 읽지 못하면 null 이다.
     * @param {string} nickname 검증을 마친 닉네임
     * @returns {object|null} 저장된 객체
     */
    loadPlayer(nickname) {
        return this.readJsonFile(this.getPlayerFilePath(nickname));
    }

    /**
     * 한 사람의 기록 파일을 통째로 저장한다. 실패는 호출자에게 전달한다.
     * @param {object} player 저장할 객체
     * @returns {void}
     */
    savePlayer(player) {
        this.writeJsonFile(this.getPlayerFilePath(player.nickname), player);
    }

    /**
     * 저장된 사람들의 기록 파일을 모두 읽는다. 손상되거나 읽을 수 없는 파일은 건너뛴다.
     * @returns {object[]} 저장된 객체 목록
     */
    listPlayers() {
        let names = [];
        try {
            names = fs.readdirSync(this.leaderboardRoot);
        } catch {
            return [];
        }
        const players = [];
        names.forEach((name) => {
            if (!name.endsWith('.json')) return;
            const player = this.readJsonFile(path.join(this.leaderboardRoot, name));
            if (player && typeof player.nickname === 'string') players.push(player);
        });
        return players;
    }

    /**
     * 닉네임에 해당하는 파일 경로다. 닉네임 검증은 서비스가 이미 끝냈다고 본다.
     * @param {string} nickname 닉네임
     * @returns {string} 파일 경로
     */
    getPlayerFilePath(nickname) {
        return path.join(this.leaderboardRoot, `${nickname}.json`);
    }

    /**
     * JSON 파일을 읽어 객체로 돌려준다. 읽지 못하면 null 이다.
     * @param {string} filePath 파일 경로
     * @returns {object|null} 파싱한 객체
     */
    readJsonFile(filePath) {
        try {
            const value = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
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
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
    }
}

module.exports = { FileLeaderboardStorage };
