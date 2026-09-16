"""Server.md의 SQLite/MariaDB 저장소 예제. 기본 서버는 이 모듈을 불러오지 않는다."""
import json
import sqlite3


class SqlOnlinePlayStorage:
    """서비스와 같은 동기 계약으로 기존 JSON 문서를 SQL 테이블에 저장한다."""

    def initialize(self):
        for table in ("puyow_accounts", "puyow_rooms"):
            self.query(f"CREATE TABLE IF NOT EXISTS {table} (id VARCHAR(20) PRIMARY KEY, payload TEXT NOT NULL)")

    def query(self, sql, parameters=()):
        # 요청마다 연결을 열어 HTTP 스레드와 관리 스레드의 연결 공유를 피한다.
        connection = self.connect()
        try:
            cursor = connection.cursor()
            cursor.execute(sql, parameters)
            rows = cursor.fetchall() if sql.startswith("SELECT") else []
            connection.commit()
            return rows
        except Exception as error:
            connection.rollback()
            # 방 저장 실패를 처리하는 기존 서비스의 OSError 계약에 맞춘다.
            raise OSError("SQL 저장소 쿼리 실패") from error
        finally:
            connection.close()

    def load_nickname_index(self):
        index = {}
        try:
            for account_id, payload in self.query("SELECT id, payload FROM puyow_accounts"):
                try:
                    account = json.loads(payload)
                    if isinstance(account, dict) and isinstance(account.get("nickname"), str):
                        index[account["nickname"]] = account_id
                except (TypeError, ValueError):
                    pass
        except OSError:
            pass
        return index

    def list_accounts(self):
        # 관리 화면의 계정 목록용이다. 손상된 행은 닉네임 색인과 같이 건너뛴다.
        accounts = []
        try:
            for (payload,) in self.query("SELECT payload FROM puyow_accounts"):
                try:
                    account = json.loads(payload)
                    if isinstance(account, dict) and isinstance(account.get("id"), str):
                        accounts.append(account)
                except (TypeError, ValueError):
                    pass
        except OSError:
            pass
        return accounts

    def load_account(self, account_id):
        try:
            rows = self.query("SELECT payload FROM puyow_accounts WHERE id = ?", (account_id.lower(),))
            value = json.loads(rows[0][0]) if rows else None
            return value if isinstance(value, dict) else None
        except (OSError, TypeError, ValueError):
            return None

    def save_account(self, account):
        self.save("puyow_accounts", account)

    def save_room(self, snapshot):
        self.save("puyow_rooms", snapshot)

    def save(self, table, value):
        # 테이블명은 내부 상수만 사용하고 계정 값은 SQL에 이어 붙이지 않는다.
        suffix = ("ON DUPLICATE KEY UPDATE payload = VALUES(payload)" if self.dialect == "mariadb"
                  else "ON CONFLICT(id) DO UPDATE SET payload = excluded.payload")
        self.query(f"INSERT INTO {table} (id, payload) VALUES (?, ?) {suffix}",
                   (value["id"].lower(), json.dumps(value, ensure_ascii=False)))

    def remove_room(self, room_id):
        try:
            self.query("DELETE FROM puyow_rooms WHERE id = ?", (room_id.lower(),))
        except OSError:
            pass

    def clear_rooms(self):
        try:
            self.query("DELETE FROM puyow_rooms")
        except OSError:
            pass


class SqliteOnlinePlayStorage(SqlOnlinePlayStorage):
    def __init__(self, filename):
        # 메서드별 연결을 쓰므로 :memory: 대신 실제 파일 경로를 사용한다.
        self.filename = filename
        self.dialect = "sqlite"

    def connect(self):
        try:
            return sqlite3.connect(self.filename)
        except sqlite3.Error as error:
            raise OSError("SQLite 연결 실패") from error


class MariaDbOnlinePlayStorage(SqlOnlinePlayStorage):
    def __init__(self, config):
        self.config = config
        self.dialect = "mariadb"

    def connect(self):
        import mariadb
        try:
            return mariadb.connect(**self.config)
        except mariadb.Error as error:
            raise OSError("MariaDB 연결 실패") from error
