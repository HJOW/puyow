# Node.js 및 Python 서버 사용법

Node.js/Python 기초와 서버·클라이언트 개념을 아는 초급 개발자를 위한 안내입니다. [English](Server.en.md)

두 서버는 `src/`의 게임 파일과 온라인 플레이 API를 제공합니다. 보통 **하나를 선택해서 실행**합니다. 같은 컴퓨터에서 둘을 실행하려면 서로 다른 포트가 필요합니다. Local AI는 Node에서 ONNX, Python에서 PyTorch 체크포인트를 사용합니다.

## 1. 실행·종료·포트 변경

터미널에서 저장소 루트(이 프로젝트의 `package.json`이 있는 디렉터리)로 이동합니다. 아래 명령은 PowerShell 기준입니다. 다른 셸에서는 `npm.cmd` 대신 `npm`을 사용하세요.

### Node.js

```powershell
npm.cmd install
npm.cmd start
```

`npm start`는 ESLint 검사 → webpack 빌드 → `node/server.js` 실행 순서입니다. 이미 의존성을 설치했다면 서버만 직접 실행할 수도 있습니다.

```powershell
node node/server.js
node node/server.js 9892
```

기본 포트는 `9891`이며 첫 번째 위치 인자가 포트를 덮어씁니다. 기본값 자체를 바꾸려면 `node/server.js`의 `PORT`를 수정합니다. 포트를 전달할 때는 위 직접 실행 명령을 쓰세요. `npm start`는 여러 명령을 묶은 스크립트입니다.

### Python

```powershell
python python/pythonserver.py
python python/pythonserver.py 9892
```

기본 포트는 `python/pythonserver.py`의 `SERVER_CONFIG["port"] = 9891`입니다. 첫 번째 위치 인자가 우선합니다. 타입 표기 때문에 Python 3.10 이상이 필요합니다. 기본 정적 서버는 표준 라이브러리와 저장소의 Python 모듈로 실행하며, 온라인 계정 기능을 켤 때는 다음 의존성을 설치합니다.

```powershell
python -m pip install bcrypt
```

Local AI의 PyTorch 설치, 모델 생성과 학습은 [MachineLearning.md](MachineLearning.md)를 참고하세요. 모델이 없으면 Local AI만 사용할 수 없으며 게임 파일 제공은 계속됩니다.

### 접속과 종료

브라우저에서 [게임 페이지](http://localhost:9891/puyow.html)를 엽니다. 웹 루트가 `src/`이므로 주소에 `/src/`를 붙이지 않습니다. 포트를 바꿨다면 접속 주소의 포트도 바꾸세요.

종료는 실행한 터미널에서 **Ctrl+C**입니다. 설정을 바꾼 뒤에는 종료하고 다시 실행해야 합니다. `EADDRINUSE` 또는 포트 사용 중 오류가 나면 기존 서버를 종료하거나 다른 포트를 선택합니다.

다른 컴퓨터에서는 `localhost` 대신 **게임 서버의 실제 IP**를 사용합니다. 예: `http://<게임 서버 IP>:9891/puyow.html`. 두 플레이어가 같은 서버에 접속해야 하며, 방화벽에서 그 포트에 접근할 수 있어야 합니다.

## 2. 온라인 플레이 활성화와 동작

### 활성화

- Node: `node/server.js`의 `ONLINE_PLAY_ENABLED = true`.
- Python: `python/pythonserver.py`의 `SERVER_CONFIG["online_play_enabled"] = True`.

기본값은 둘 다 꺼짐입니다. 재실행 후 `GET /apis/onlineplayinfo`가 `{"available":true}`인지 확인하고 게임 페이지를 새로 고칩니다. 메인 메뉴의 “너랑 나랑”에서 온라인 플레이를 선택합니다. 비활성화 상태에서는 계정·방 저장 디렉터리도 만들지 않습니다.

### 기본 흐름

1. 가입·로그인은 HTTP JSON 요청입니다. 클라이언트가 비밀번호를 SHA-256으로 변환하고 서버는 그 문자열을 bcrypt로 다시 해시하여 저장합니다.
2. 로그인 성공 시 난수 세션 토큰이 발급됩니다. 토큰은 서버와 게임의 메모리에만 보관됩니다.
3. WebSocket을 열고 토큰으로 인증합니다. 방 목록은 서버가 밀어 주며, 방 생성·참여·시작도 이 연결로 요청합니다.
4. 방장이 시작하면 약 3초 후 두 사람에게 같은 뿌요 덱을 보냅니다. 조작은 각 클라이언트가 즉시 적용하고 서버가 상대에게 중계합니다.
5. 서버는 패배 보고를 받아 결과와 WIN POINT를 확정합니다. 정상 종료 후 방은 유지되고 방장이 다시 시작할 수 있습니다.

서버가 모든 보드 물리와 조작의 적법성을 재계산하는 구조는 아닙니다. 현재 입력·연쇄 정보는 중계하고 패배는 클라이언트 보고에 의존합니다.

방은 최대 200개, 목록에는 참여자가 없는 대기 중 방을 생성 순으로 최대 50개 표시합니다. 방장이 나가면 남은 참여자가 방장이 되고 **방 ID도 새 방장의 계정 ID로 변경**됩니다. 접속자가 없으면 방을 삭제합니다. 대전 중 이탈은 승패와 WIN POINT를 바꾸지 않습니다.

관리 페이지에서 비활성으로 바꾼 계정은 로그인이 거부되고, 이미 로그인한 세션이라도 방 생성과 입장이 차단됩니다. 자세한 내용은 아래 관리 페이지 절을 참고하세요.

서버는 5초 간격 ping과 15초 무응답 기준으로 연결을 확인합니다. 연결이 끊기면 방에서는 나가지만 세션은 60초 유예 동안 재인증에 쓸 수 있습니다. 세션 재연결이 진행 중인 대전 복원을 뜻하지는 않습니다. 장시간 무조작 세션은 30분 후 만료됩니다. 로그인 실패가 5분 내 3회 누적되면 유효한 비밀번호도 잠금 조건이 풀릴 때까지 거부됩니다.

WIN POINT는 0 이상 정수입니다. 승자·패자의 변경량은 각각 다음 식이며, 양쪽의 갱신 전 점수를 사용합니다.

```text
승리: floor(3 + max(0, 상대 점수 - 내 점수) / 100)
패배: floor(-(1 + max(0, 내 점수 - 상대 점수) / 300))
갱신 후 점수: max(0, 기존 점수 + 변경량)
```

첫 패배 보고 뒤 50ms를 기다리며, 그 동안 접수한 두 보고의 게임 시각 차이가 50ms 이내면 무승부입니다. 무승부에서는 점수를 변경하지 않습니다.

### HTTPS/WSS

Node는 `SSL_KEY_FILE`(개인 키), `SSL_CERT_FILE`(인증서), 선택적 `SSL_CA_FILE`을 설정합니다. Python은 `SERVER_CONFIG`의 `ssl_key_file`, `ssl_cert_file`, 선택적 `ssl_ca_file`을 설정합니다. 파일은 PEM 형식이며 Python 인증서 파일에는 필요한 서버 체인을 포함하세요.

필수 경로가 비어 있거나 지정한 파일이 없으면 HTTP로 실행됩니다. 로그와 실제 주소의 `https://`를 확인하세요. HTTPS를 사용하면 WebSocket도 같은 포트의 `wss://`를 사용합니다. 비밀번호 해시는 인증에 그대로 쓰이므로 원격 로그인에는 HTTPS가 필요합니다.

## 3. 서버 모니터링·관리 페이지

### 관리자 계정 설정

관리 페이지는 [admin.html](http://localhost:9891/admin.html)입니다. 접속하면 먼저 관리자 로그인 화면이 나옵니다.

- Node: `node/server.js`의 `ADMIN_ID`, `ADMIN_PASSWORD`.
- Python: `python/pythonserver.py`의 `SERVER_CONFIG["admin_id"]`, `SERVER_CONFIG["admin_password"]`.

이 계정은 온라인 플레이 계정과 완전히 별개이며 **하나만 존재하고 추가할 수 없습니다**. 비밀번호 기본값은 빈 문자열이며, **비어 있으면 관리자 계정 자체가 비활성화되어** 어떤 값으로도 로그인할 수 없습니다. 값을 바꾼 뒤에는 서버를 다시 실행합니다.

관리자 비밀번호는 운영자가 서버 코드에서 언제든 고칠 수 있어야 하므로 **단방향 암호화 없이 원문 그대로** 둡니다. 다만 로그인할 때는 관리 페이지와 서버가 각각 SHA-256으로 해시한 값만 비교하므로 원문이 네트워크로 나가지는 않습니다. 원문을 보호하려면 서버 파일의 접근 권한을 제한하고, 원격 접속에는 HTTPS를 사용하세요.

### 로그인 실패 차단

관리자 로그인 세션은 온라인 플레이 세션과 별개이며 `puyow_admin_session` 쿠키로 유지됩니다. 로그인 실패 횟수는 그 세션에 쌓이고, **5회 이상 실패하면 마지막 실패 시각으로부터 10분 동안** 그 세션의 관리자 로그인이 차단됩니다. 차단 중에는 올바른 비밀번호도 거부합니다. 10분이 지나면 실패 횟수를 0으로 되돌립니다. 아무 요청도 없는 관리자 세션은 30분 뒤 사라집니다.

세션에 기록하는 방식이므로 쿠키를 지우면 횟수도 초기화됩니다. 공개된 주소에서 운영한다면 관리 페이지 경로 자체를 방화벽이나 리버스 프록시로 제한하세요.

### 대시보드

로그인하면 대시보드로 이동합니다. 화면 왼쪽 사이드바에는 화면 모드(다크/밝은) 토글과 로그아웃 버튼, 그리고 “홈”·“온라인 계정” 메뉴가 있습니다. 화면 모드는 저장하지 않으며 기본값은 시스템 설정을 따르고, 알 수 없으면 다크 모드입니다.

대시보드는 서버 현황을 **4초마다 자동으로 새로 읽습니다**. 표시 항목은 서버 종류에 따라 다릅니다.

- Node: `process.memoryUsage()`의 `rss`·`heapTotal`·`heapUsed`·`external`·`arrayBuffers`. 시스템 전체 점유율은 알 수 없습니다.
- Python: `psutil`로 읽은 시스템 CPU·램 점유율과 서버 프로세스의 RSS. `psutil`을 설치하지 않으면(`pip install psutil`) 이 칸만 표시되지 않고 나머지는 그대로 동작합니다.

온라인 플레이를 켰다면 가입 계정 수, 접속 세션 수, 개설된 방 수도 함께 보여 줍니다.

### 온라인 계정 관리

“온라인 계정” 메뉴에서 가입된 계정 목록을 봅니다. 계정을 클릭하면 닉네임·ID·현재 상태를 보여 주는 레이어 팝업이 열리고 “비밀번호 변경”·“비활성화”(또는 “활성화”)·“닫기” 버튼이 있습니다. 온라인 플레이를 끈 서버에서는 목록이 비어 있습니다.

- **비밀번호 변경**: 새 비밀번호를 두 번 입력받아 SHA-256 해시만 보냅니다. 서버가 bcrypt로 다시 해시해 저장하며, 해당 계정의 세션은 끊깁니다. 원문 규칙은 게임 가입 화면과 같은 영문·숫자·밑줄·`!@#$%^&*?` 4~30자입니다.
- **비활성화 / 활성화**: 계정 문서의 `active` 필드를 바꾸는 토글입니다. 비활성 계정은 **로그인이 거부**되고, 이미 로그인한 세션이라면 강제로 끊지는 않되 **방 생성과 방 입장이 차단**됩니다. 게임에는 `account_disabled` 오류로 전달됩니다.

### WebMCP 도구

WebMCP를 지원하는 브라우저에서는 관리 페이지가 `document.modelContext`에 도구 다섯 개를 등록해, AI가 사람 대신 조회와 계정 상태 변경을 수행할 수 있습니다. 지원하지 않는 브라우저에서는 아무것도 등록하지 않고 화면만 평소처럼 동작합니다.

| 도구 | 하는 일 | 로그인 필요 |
| --- | --- | --- |
| `admin_manual` | 관리 페이지와 나머지 도구의 영어 사용법 | 아니오 |
| `admin_login_status` | 관리자 계정 사용 가능 여부, 로그인 여부, 남은 차단 시간, 지금 보고 있는 화면 | 아니오 |
| `admin_server_status` | 서버 종류·구동 시간·CPU·램·메모리·온라인 플레이 현황 | 예 |
| `admin_online_accounts` | 온라인 플레이 계정 목록 | 예 |
| `admin_set_account_state` | 온라인 플레이 계정 하나를 활성 또는 비활성으로 변경 | 예 |

**관리자 로그인과 로그아웃은 일부러 도구로 만들지 않았습니다.** 관리자 비밀번호가 도구를 거쳐 가지 않게 하려는 것이며, 로그인은 사람이 화면에서 직접 해야 합니다. **온라인 플레이 계정의 비밀번호 변경도 도구 범위에서 제외**했습니다. 로그인하지 않은 상태에서 로그인이 필요한 도구를 부르면 사람이 먼저 로그인해야 한다는 영어 오류를 돌려줍니다.

도구 설명과 스키마는 AI가 읽으므로 영어로 씁니다. 조회 전용 도구에는 `annotations.readOnlyHint`를, 플레이어가 직접 정한 닉네임이 들어가는 `admin_online_accounts`와 `admin_set_account_state`에는 `annotations.untrustedContentHint`를 함께 둡니다. 도구가 서버 상태를 읽거나 바꾸면 사람이 보고 있는 화면도 같은 값으로 갱신합니다.

## 4. 저장소 구조와 DB 교체

### 기본 파일 저장소

파일 입출력은 [Node 클래스](../node/onlineplay_storage.js)와 [Python 클래스](../python/onlineplay_storage.py)의 `FileOnlinePlayStorage`로 분리되어 있습니다. 로그인·방·대전 서비스가 저장소를 주입받습니다.

```text
<서버 실행 계정의 홈>/.puyowserver/
  account/<소문자 ID>/account.json
  rooms/<소문자 방 ID>.json
```

계정 문서는 `{id, nickname, password, winPoint, createdAt}`이며, 관리 페이지에서 계정을 비활성화하면 boolean `active`가 추가됩니다. `active`가 없는 계정은 활성으로 봅니다. ID는 대소문자를 구분하지 않고, 닉네임은 구분합니다. 계정 파일과 bcrypt 해시는 교체 시 보존해야 합니다. 방 문서는 아래 API의 방 객체와 같으며 **메모리 상태의 스냅샷**입니다. 서비스 시작 시 방 스냅샷만 삭제하고 계정은 유지합니다. 세션·소켓·진행 중 게임은 DB 교체 대상이 아닙니다.

서비스에 필요한 저장소 계약은 다음과 같습니다. 계정과 방을 한 클래스에서 다루므로 파일 기반 세부 사항을 이 경계 안에서 교체할 수 있습니다.

| Node 메서드 | Python 메서드 | 계약 |
| --- | --- | --- |
| `initialize()` | `initialize()` | 저장 경로/스키마 준비. 계정 삭제 금지. 실패 전파 |
| `loadNicknameIndex()` | `load_nickname_index()` | 닉네임 → 소문자 ID, Node `Map` / Python `dict` |
| `listAccounts()` | `list_accounts()` | 저장된 계정 전체 배열/리스트, 관리 화면 목록용. 손상된 계정은 건너뜀 |
| `loadAccount(id)` | `load_account(id)` | 새 계정 객체 또는 `null` / `None` |
| `saveAccount(account)` | `save_account(account)` | 계정 전체 저장, 실패 전파 |
| `saveRoom(snapshot)` | `save_room(snapshot)` | 직렬화 가능한 방 문서 저장, 실패 전파 |
| `removeRoom(id)` | `remove_room(id)` | 해당 방 스냅샷 삭제, 기존 파일 구현은 실패 무시 |
| `clearRooms()` | `clear_rooms()` | 방 스냅샷 초기화, 기존 파일 구현은 실패 무시 |

**모든 메서드는 동기식입니다.** Node에서 Promise를 그대로 반환하는 구현은 주입할 수 없습니다. 기존 처리 순서·예외 처리·Python의 잠금 범위를 유지하기 위한 계약입니다. 저장소 생성자는 I/O를 수행하지 않고, 서비스가 활성화될 때 `initialize` → 닉네임 색인 → 방 초기화를 수행합니다.

입력 검증·bcrypt·닉네임 색인 갱신·점수 계산은 서비스에 남습니다. 계정 저장 예외는 HTTP 경로에서 `server_error`가 됩니다. 방 저장 실패는 기록하고 메모리로 진행합니다(Python 대체 저장소는 `OSError`로 전달). 기존 계정 조회 실패는 없는 계정처럼 처리합니다. 이 리팩터링은 기존 동시 가입 검사나 두 계정의 점수 저장을 트랜잭션으로 변경하지 않습니다.

### 예제의 범위

다음은 **학습용 교체 예제**이며 기본 설정에 적용되어 있지 않습니다. [Node 전체 구현](examples/onlineplay_sql.js), [Node MariaDB 연결 도우미](examples/onlineplay_mariadb_query.js), [Python 전체 구현](examples/onlineplay_sql.py)을 함께 제공합니다.

예제는 기존 JSON 문서를 `puyow_accounts`·`puyow_rooms` 테이블의 `payload TEXT`에 저장하고 소문자 ID를 기본 키로 사용합니다. SQL 값은 매개변수로 전달합니다. 닉네임 검색 정책과 스냅샷 의미는 서비스에 그대로 남습니다.

SQLite는 **프로세스가 로컬 파일을 여는 DB**로 IP와 서버 포트가 없습니다. `192.168.0.15`를 SQLite 접속 주소로 쓰지 않습니다. MariaDB 예제에서만 DB 서버가 `192.168.0.15`, 기본 포트가 `3306`이라고 가정합니다. 실사용 시 실제 DB IP·계정·비밀번호·DB명으로 바꾸세요. 이것은 게임 서버의 HTTP 포트와 별개입니다.

### SQLite: Node.js

`node/server.js`의 서비스 생성 코드를 다음처럼 교체합니다. 저장소 객체가 클래스 인터페이스를 구현하므로 서비스 내부는 수정하지 않습니다.

```js
const { SqliteOnlinePlayStorage } = require('../docs/examples/onlineplay_sql');
const onlinePlayService = onlinePlay.createService({
    enabled: ONLINE_PLAY_ENABLED,
    storage: new SqliteOnlinePlayStorage(path.join(PROJECT_ROOT, 'puyow-online.sqlite'))
});
```

`node:sqlite`의 `DatabaseSync`를 사용합니다. Node 22.12에서는 다음과 같이 실행합니다. 파일 저장소에는 SQLite 기능이 필요하지 않습니다. [Node 22.12 SQLite 문서](https://nodejs.org/download/release/v22.12.0/docs/api/sqlite.html)

```powershell
node --experimental-sqlite node/server.js
```

DB 파일은 공개 웹 루트인 `src/` 밖에 두세요. 상위 디렉터리는 미리 있어야 합니다. 테스트 등에서 직접 저장소를 만들었다면 사용 후 `storage.close()`로 연결을 닫습니다.

### SQLite: Python

`python/pythonserver.py`의 서비스 생성 지점에 다음 코드를 사용합니다. 파일 위치를 바꾸면 예제 모듈 경로도 바꾸세요.

```python
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "docs" / "examples"))
from onlineplay_sql import SqliteOnlinePlayStorage

online_play_service = OnlinePlayService(
    SERVER_CONFIG.get("online_play_enabled") is True,
    storage=SqliteOnlinePlayStorage(Path(__file__).resolve().parent / "puyow-online.sqlite"),
)
```

표준 라이브러리 `sqlite3`를 사용하므로 별도 pip 설치는 없습니다. 예제는 스레드 사이에서 연결을 공유하지 않도록 쿼리마다 연결하고 닫습니다. 이 때문에 `:memory:` 대신 실제 파일 경로를 사용해야 합니다.

### MariaDB: 사전 준비

DB 서버에 MariaDB를 설치한 뒤 관리자 도구에서 예제용 `puyow` 데이터베이스와 전용 사용자를 만듭니다. 서버 프로그램이 접속하는 호스트에서 해당 사용자의 연결을 허용하고, 예제의 초기 테이블 생성을 위해 `CREATE`, 실행을 위해 `SELECT/INSERT/UPDATE/DELETE` 권한을 부여합니다. 비밀번호는 코드에 넣지 않고 환경변수로 전달합니다.

```sql
CREATE DATABASE puyow CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
```

사용자 생성·접속 허용 범위는 실제 게임 서버 주소에 맞춰 설정합니다. 기존 파일은 자동 이관되지 않습니다. 두 서버를 모두 멈추고 원본을 백업한 후, 각 계정 JSON을 DB 저장소의 `saveAccount` / `save_account`로 넣으세요. `password` 해시와 `createdAt` 문자열을 재생성하지 않습니다. 방은 이관하지 않습니다.

### MariaDB: Node.js

예제 사용 시에만 프로젝트 루트에서 드라이버를 설치합니다.

```powershell
npm.cmd install mariadb
$env:PUYOW_DB_PASSWORD = '<실제 DB 비밀번호>'
```

```js
const { MariaDbOnlinePlayStorage } = require('../docs/examples/onlineplay_sql');
const onlinePlayService = onlinePlay.createService({
    enabled: ONLINE_PLAY_ENABLED,
    storage: new MariaDbOnlinePlayStorage({
        host: '192.168.0.15', port: 3306,
        user: 'puyow_app', password: process.env.PUYOW_DB_PASSWORD,
        database: 'puyow'
    })
});
```

MariaDB의 Node 드라이버는 비동기식입니다. 이 예제는 쿼리를 별도 Node 프로세스에서 실행하고 결과를 동기적으로 받아 기존 서비스 계약에 맞춥니다. 비밀번호·SQL 값은 셸 명령이 아니라 자식 프로세스의 표준 입력으로 보냅니다. 생성자는 DB에 접속하지 않습니다. [MariaDB Node Promise API](https://mariadb.com/docs/connectors/mariadb-connector-nodejs/connector-nodejs-promise-api)

이 방식은 **쿼리마다 프로세스를 만들고 메인 이벤트 루프를 막으므로** 운영 성능을 위한 설계가 아닙니다. 결과 크기는 8MiB, 대기는 최대 15초입니다. 장기 운영에는 저장소 내부의 전용 Worker/연결 관리 등을 별도로 설계해야 하며, 서비스 전체를 비동기화하려면 호출 순서와 동시성도 함께 검토해야 합니다.

### MariaDB: Python

```powershell
python -m pip install mariadb
$env:PUYOW_DB_PASSWORD = '<실제 DB 비밀번호>'
```

드라이버 설치 요구사항은 플랫폼별 [MariaDB Connector/Python](https://mariadb.com/docs/connectors/mariadb-connector-python)을 참고하세요. 위 SQLite 예제와 같이 모듈 검색 경로를 추가하고 저장소 클래스를 교체합니다.

```python
import os
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "docs" / "examples"))
from onlineplay_sql import MariaDbOnlinePlayStorage

online_play_service = OnlinePlayService(
    SERVER_CONFIG.get("online_play_enabled") is True,
    storage=MariaDbOnlinePlayStorage({
        "host": "192.168.0.15", "port": 3306,
        "user": "puyow_app", "password": os.environ["PUYOW_DB_PASSWORD"],
        "database": "puyow", "connect_timeout": 5,
    }),
)
```

예제는 동기 연결을 사용하며 쓰기 후 `commit()`, 실패 시 `rollback()`을 실행하고 연결을 닫습니다. [MariaDB Python 연결 문서](https://mariadb.com/docs/connectors/mariadb-connector-python/api/connection)

### DB로 바꿔도 유지되는 한계

DB 예제는 한 온라인 서비스 프로세스의 저장 형식 교체를 보여 줍니다. 같은 DB를 쓴다고 Node와 Python의 방·세션이 공유되지는 않습니다. 다른 서버가 시작하면 공통 방 스냅샷 테이블을 비우므로 동시 운영용 저장소로 사용하지 마세요. DB 테이블의 기본 키만으로 닉네임의 동시 중복 가입이나 승자·패자 점수의 일괄 원자성이 보장되지는 않습니다. 그런 기능은 별도의 서비스 계약 변경 작업입니다.

## 5. HTTP API 명세

이하 URL은 서버 루트 기준입니다. 요청 JSON에는 `Content-Type: application/json`을 사용합니다. 쿼리 매개변수는 필요 없습니다. 특히 현재 Node의 `/apis/` 라우터는 API명 뒤 쿼리 문자열을 일부 경로에서 분리하지 않으므로 문서의 URL을 그대로 사용하세요.

공통적으로 `OPTIONS`는 204와 CORS 헤더를 반환합니다. 허용 Origin은 `*`, 허용 메서드는 `GET, HEAD, POST, OPTIONS`, 허용 헤더는 `Content-Type, Authorization`입니다. 게임과 온라인 플레이 API는 쿠키 인증을 사용하지 않습니다. 관리 페이지 API만 예외로 같은 출처 세션 쿠키를 사용합니다.

| URL | Node | Python | 인증 |
| --- | --- | --- | --- |
| `GET /apis/onlineplayinfo` | 온라인 설정 확인 | 동일 | 없음 |
| `GET /apis/localmodelinfo` | ONNX 로드 가능 여부 | PyTorch 로드 가능 여부 | 없음 |
| `POST /apis/onlineplay/signup` | 가입 | 동일 | 없음 |
| `POST /apis/onlineplay/login` | 로그인 | 동일 | ID·비밀번호 해시 |
| `POST /apis/onlineplay/logout` | 로그아웃 | 동일 | 본문의 세션 토큰 |
| `POST /v1/chat/completions` | Local AI 배치·연결 검사 | 동일 + 선택적 역학습 기록 | AI Bearer 토큰 |
| `POST /apis/learning` | 학습 이벤트 누적 | 동일, 입력 검증은 더 엄격 | AI Bearer 토큰 |
| `POST /apis/solomonlearning` | 수신만 함 | 역학습 수집·반영 | 아래 차이 참고 |
| `POST /apis/admin/session` | 관리자 로그인 상태 확인 | 동일 | 없음(세션 쿠키 발급) |
| `POST /apis/admin/login` | 관리자 로그인 | 동일 | ID·비밀번호 해시 |
| `POST /apis/admin/logout` | 관리자 로그아웃 | 동일 | 관리자 세션 쿠키 |
| `POST /apis/admin/status` | 서버 현황(V8 메모리) | 서버 현황(psutil CPU·램) | 관리자 세션 쿠키 |
| `POST /apis/admin/accounts` | 온라인 계정 목록 | 동일 | 관리자 세션 쿠키 |
| `POST /apis/admin/accountpassword` | 온라인 계정 비밀번호 변경 | 동일 | 관리자 세션 쿠키 |
| `POST /apis/admin/accountstate` | 온라인 계정 활성·비활성 | 동일 | 관리자 세션 쿠키 |

정보 조회 API는 매개변수 없이 200 `{"available":boolean}`을 반환합니다. 온라인 정보는 기능 설정값이며 실제 두 사람의 대전 성공을 검사하지 않습니다. 모델 정보는 파일 존재뿐 아니라 실제 모델 로드도 확인합니다. 두 정보 핸들러 자체는 현재 GET 전용 검사를 하지 않지만 클라이언트는 GET을 사용합니다.

### 가입·로그인·로그아웃

| 요청 | JSON 매개변수 | 200 응답 |
| --- | --- | --- |
| signup | `id`, `nickname`, `password`: 모두 문자열 | `{"ok":true}` |
| login | `id`, `password`: 문자열 | `{"ok":true,"token":"...","nickname":"Alice","winPoint":0}` |
| logout | `token`: 로그인 토큰 문자열 | `{"ok":true}`, 이미 없는 토큰도 성공 |

ID는 ASCII 영문·숫자·밑줄 4~20자이며 대소문자를 구분하지 않습니다. 닉네임은 같은 문자 집합 3~20자이며 대소문자를 구분합니다. API의 `password`는 **평문이 아니라 64자리 소문자 16진 SHA-256 문자열**입니다. 게임 UI는 평문에 대해 영문·숫자·밑줄·`!@#$%^&*?`, 4~30자 규칙을 먼저 적용합니다.

```js
// 게임 페이지에서 실행하는 가입 요청 예제다. 실제 비밀번호를 콘솔 기록에 남기지 않는다.
async function signup(id, nickname, password) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    const response = await fetch('/apis/onlineplay/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nickname, password: hash })
    });
    return response.json();
}
```

`crypto.subtle` 예제는 HTTPS 또는 localhost에서 사용합니다. 게임 본체에는 CryptoJS 대체 경로도 있습니다. 로그인에도 같은 해시를 보내며 bcrypt는 서버에서만 처리합니다.

온라인 HTTP 오류 본문은 `{"ok":false,"code":"..."}`입니다.

| 상태 | code | 의미 |
| --- | --- | --- |
| 400 | `invalid_id`, `invalid_nickname`, `invalid_password` | 가입 필드 형식 오류 |
| 400 | `invalid_request` | 로그인 필드 형식 오류 |
| 400 | `invalid_body` | JSON 본문 오류 |
| 401 | `login_failed` | 없는 계정 또는 비밀번호 불일치 |
| 409 | `duplicate_id`, `duplicate_nickname` | 가입 중복 |
| 403 | `account_disabled` | 관리 페이지에서 비활성으로 바꾼 계정 |
| 423 | `account_locked` | 로그인 실패 횟수 잠금 |
| 404 | `online_play_disabled`, `not_found` | 기능 비활성 또는 알 수 없는 동작 |
| 405 | `method_not_allowed` | POST가 아닌 요청 |
| 500 | `server_error` | 계정 저장 등을 처리하지 못함 |

온라인 본문 제한은 64KiB입니다. Python은 초과 시 413 `invalid_body`를 반환합니다. Node는 초과한 요청 연결을 끊으므로 JSON 오류 응답 수신을 보장하지 않습니다. Python은 객체가 아닌 JSON도 `invalid_body`로 거부합니다. 잘못된 입력에 대한 두 구현의 모든 응답이 완전히 같지는 않습니다.

### 관리 페이지 API

모든 관리 API는 `POST`이며 본문은 JSON입니다. 첫 요청에 `puyow_admin_session` 쿠키(HttpOnly, SameSite=Strict)를 발급하고, 이후 모든 요청이 그 쿠키로 같은 세션을 찾습니다. 브라우저에서는 `fetch(..., { credentials: 'same-origin' })`으로 호출합니다. 본문 제한은 64KiB입니다.

| 요청 | JSON 매개변수 | 200 응답 |
| --- | --- | --- |
| session | 없음 | `{"ok":true,"adminEnabled":true,"authenticated":false,"blockedSeconds":0}` |
| login | `id`, `password`(SHA-256 해시) | `{"ok":true,"adminId":"root"}` |
| logout | 없음 | `{"ok":true}` |
| status | 없음 | 아래 서버 현황 객체 |
| accounts | 없음 | `{"ok":true,"onlinePlayEnabled":true,"accounts":[...]}` |
| accountpassword | `id`, `password`(SHA-256 해시) | `{"ok":true}` |
| accountstate | `id`, `active`(boolean) | `{"ok":true,"account":{...}}` |

`accounts`의 각 항목은 `{id, nickname, active, winPoint, createdAt, online}`입니다. **비밀번호 해시는 어떤 응답에도 들어가지 않습니다.** `online`은 지금 로그인한 세션이 있는지입니다.

`status`는 두 서버가 같은 형태로 응답하되 서버가 알 수 있는 값만 채웁니다. Node는 `cpuPercent`·`memoryPercent`가 항상 `null`이고, Python은 `psutil`이 없으면 두 값이 `null`이며 `psutilAvailable`이 `false`입니다.

```json
{
  "ok": true,
  "server": "node",
  "runtime": "Node.js v22.12.0",
  "uptimeSec": 128,
  "time": "2026-09-16T04:54:34.603Z",
  "cpuPercent": null,
  "memoryPercent": null,
  "memoryBytes": [{ "key": "rss", "bytes": 54231040 }],
  "onlinePlay": { "enabled": true, "accounts": 2, "sessions": 0, "rooms": 0, "playing": 0 },
  "serverInfo": { "port": 9891, "https": false, "onlinePlayEnabled": true, "localAiAvailable": false }
}
```

관리 API의 오류 본문도 `{"ok":false,"code":"..."}`입니다.

| 상태 | code | 의미 |
| --- | --- | --- |
| 400 | `invalid_body`, `invalid_request`, `invalid_password` | 본문·필드 형식 오류 |
| 400 | `account_not_found` | 대상 온라인 계정 없음 |
| 401 | `login_failed` | 관리자 ID 또는 비밀번호 불일치. `remain`에 남은 시도 횟수 |
| 401 | `unauthorized` | 로그인하지 않은 세션이 관리 기능을 호출함 |
| 403 | `admin_disabled` | 서버의 관리자 비밀번호가 공란 |
| 404 | `online_play_disabled`, `not_found` | 온라인 플레이 비활성 또는 알 수 없는 동작 |
| 405 | `method_not_allowed` | POST가 아닌 요청 |
| 423 | `login_blocked` | 5회 실패 차단. `blockedSeconds`에 남은 차단 시간(초) |
| 500 | `server_error` | 처리 중 예외 |

### Local AI 인증과 Chat Completions

Node의 AI 토큰은 환경변수 `PUYOW_AI_TOKEN`, Python은 `SERVER_CONFIG["learning_token"]`입니다. 원격 호출은 `Authorization: Bearer <설정 토큰>`을 사용합니다. 온라인 로그인 토큰과 다른 값입니다.

| 호출 | Node의 `Bearer localhost` | Python의 `Bearer localhost` |
| --- | --- | --- |
| `/v1/chat/completions` | 루프백에서만 허용 | 루프백에서만 허용 |
| `/apis/learning` | 별도 우회 없음, 설정 토큰과 비교 | 루프백에서 허용 |
| `/apis/solomonlearning` | 인증·본문을 검사하지 않는 수신 전용 핸들러 | 루프백에서 허용 |

Chat Completions의 본문 제한은 기본 1MiB입니다. `model`은 비어 있지 않은 문자열이며 응답에도 그대로 들어갑니다. 이 값으로 모델 파일을 선택하지 않습니다. 일반 대화 생성이나 스트리밍을 구현한 엔드포인트가 아닙니다.

```json
{
  "model": "puyow",
  "messages": [{"role": "user", "content": "test"}],
  "response_format": {
    "type": "json_schema",
    "json_schema": {"name": "ai_api_test_result"}
  }
}
```

`ai_api_test_result`는 모델 로드 후 `{"success":true}`를 반환합니다. `solomon_puyo_placement`는 마지막 문자열 `role:"user"` 메시지의 `content`를 JSON으로 파싱하고 다음 필드를 사용합니다.

| content 안의 필드 | 형식·역할 |
| --- | --- |
| `currentField.occupiedCells` | `[{x,y,color}]`, x=0~5, y=0 이상 정수, y=0이 바닥. 관측에는 y<12만 반영 |
| `suppliedPuyos` | `[{order:"current",colors:["red","blue"]},{order:"next_1",colors:["green","yellow"]}]`. current 필수, next_1 선택 |
| `currentState` | 선택 객체. `attack`, `placedPairCount`, `incomingDamage`, `elapsedMs` 기본 0, `marginRate` 70, `timeProgressMultiplier` 1, `feverRule`·`allClearTicket` false |
| `currentState.fever` | 선택 객체. `active`, `gauge`, `nextTime`, `targetCombo`, `leftTime` 등 피버 상태 |
| `usablePlacements` | 선택 배열, 1~24개의 `{x,rotation}`, x=0~5, rotation=0~3. 없으면 서버가 가능 배치를 판정 |
| `learningSessionId` | 선택, 1~128자 문자열. Python은 솔로몬 수를 세션에 기록, Node는 무시 |

쌍의 색 이름은 `red/green/yellow/blue/purple`입니다. API 출력 `rotation`은 0=위, 1=오른쪽, 2=아래, 3=왼쪽입니다. 성공 응답의 형태는 다음과 같으며 `content`는 객체가 아닌 **JSON 문자열**입니다.

```json
{
  "id":"chatcmpl-puyow-...",
  "object":"chat.completion",
  "created":1750000000,
  "model":"puyow",
  "choices":[{"index":0,"message":{"role":"assistant","content":"{\"x\":2,\"rotation\":0}"},"finish_reason":"stop"}]
}
```

오류는 `{"error":{"message":"...","type":"..."}}`입니다. 주요 상태는 400(입력·스키마), 401(인증), 404(모델 미설정·없음), 405(메서드), 413(본문), 422(가능 배치 없음), 503(모델 로드·추론 불가), 500(예상하지 못한 오류)입니다. 본문 초과 시 Node는 연결을 끊을 수도 있습니다.

### 학습 이벤트와 역학습

학습 절차·관측 벡터와 모델의 자세한 설명은 [MachineLearning.md](MachineLearning.md)를 참고하세요. 여기서는 전송 계약만 요약합니다.

`POST /apis/learning`의 공통 필드는 `sessionId`(1~128자), `event`입니다.

| event | 추가 필드 |
| --- | --- |
| `reset` | `observation`: 유한한 숫자 배열 |
| `step` | `observation`, `nextObservation`, `action`(정수), `reward`(유한한 수), `done`(boolean) |
| `episode_end` | `done:true` |

Python 관측은 정확히 528개, action은 0~23입니다. Node의 이벤트 수집 API는 관측 1~10000개와 정수 action을 허용합니다. 두 서버에 같은 요청을 보내려면 Python의 더 엄격한 형식을 사용합니다. 성공 응답은 `{ok,event,sessionId,sequence,steps,totalReward,done}`입니다. 이 API는 이벤트를 누적하며 그 호출만으로 모델 학습을 수행하지 않습니다. 오류는 `{ok:false,error:"..."}`, 주요 상태는 400/401/405/413/500/503(인증 설정 없음)입니다.

`POST /apis/solomonlearning`의 Python 요청:

- `{event:"step",sessionId,observation,action,nextPair?}`: 사람의 수를 기록. nextPair는 색 이름 2개 배열이며 생략 가능.
- `{event:"finish",sessionId,result}`: result는 **솔로몬 기준** `win/loss/draw`. 세션의 표본으로 모델을 학습·저장.
- step 성공: `{ok:true,sessionId,event:"step"}`.
- finish 성공: `{ok:true,sessionId,trained,transitions}`에 학습 시 `playerTransitions,loss`, 학습하지 않았으면 `reason`이 추가됩니다.

Node는 본문을 버리고 `{ok:true,trained:false,transitions:0,reason:"Node 서버는 솔로몬 역학습을 지원하지 않습니다."}`를 반환합니다. 이 핸들러는 현재 메서드와 인증도 검사하지 않습니다. 클라이언트는 POST를 사용합니다.

## 6. 온라인 WebSocket API

주소는 `ws://<게임 서버>:<포트>/apis/onlineplay/socket`이며 HTTPS에서는 `wss://`입니다. 첫 메시지는 연결 후 5초 내 `auth`여야 합니다. JSON 텍스트 메시지를 사용하고 개별 프레임 크기 제한은 256KiB입니다.

```js
const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(scheme + '//' + location.host + '/apis/onlineplay/socket');
socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'auth', token: loginResult.token }));
});
socket.addEventListener('message', event => console.log(JSON.parse(event.data)));
```

`loginResult`는 앞의 로그인 성공 JSON입니다. 브라우저는 프로토콜 ping/pong을 처리합니다. 별도의 JSON `ping` 메시지를 보낼 필요가 없습니다.

### 클라이언트 → 서버

| type | 추가 필드 | 동작 |
| --- | --- | --- |
| `auth` | `token`: 문자열 | 로그인 토큰으로 소켓 연결 |
| `room_list` | 없음 | 대기 방 목록 요청 |
| `room_create` | `rule`, `colorCount` | rule=`standard/fever/feverStart`, colorCount=3/4/5. 유효하지 않거나 생략하면 standard/4 |
| `room_join` | `roomId`: 방 ID 문자열 | 빈 자리가 있는 대기 방 참여 |
| `room_leave` | 없음 | 방 퇴장, 대기실 목록 전송 |
| `game_start_request` | 없음 | 참여자가 있는 방에서 방장만 시작 |
| `input` | `time`, `kind`, `value` | 게임 시각(ms), left/right/rotateLeft/rotateRight/downStart/downEnd, 조작 값 |
| `chain_result` | `time`, `attack`, `allClear`, `fever` | 연쇄 정보 중계 |
| `defeat` | `time`: 게임 시각(ms) | 패배 보고 |

input·chain_result의 값은 서버가 그대로 중계합니다. 위 형식이 서버의 엄격한 검증을 뜻하지는 않습니다. 인증된 연결의 알 수 없는 type은 무시하고, 인증 전 auth 이외 메시지는 연결을 닫습니다.

### 서버 → 클라이언트

| type | 추가 필드·의미 |
| --- | --- |
| `auth_ok` | `nickname,winPoint` |
| `room_list` | `rooms:[{id,rule,colorCount,hostNickname}]` |
| `room_state` | `room`: 아래 방 객체, `youAreHost`: boolean |
| `room_closed` | 방 종료 |
| `opponent_left` | 준비·대전 중 상대 이탈 |
| `game_prepare` | `delay:3000`(ms) |
| `game_start` | `rule,colorCount,deck,startedAt,youAreHost,opponent`. deck는 같은 색상 문자열 쌍 512개 |
| `game_cancel` | 시작 준비 취소 |
| `opponent_input` | `time,kind,value` |
| `opponent_chain` | `time,attack,allClear,fever` |
| `game_result` | `result:"win"/"lose"/"draw",delta,winPoint` |
| `session_closed` | 중복 로그인 또는 세션 만료 등 |
| `error` | `code`: 아래 오류 코드 |

방 객체: `{id,rule,colorCount,host,guest,state,createdAt}`. host/guest는 `{id,nickname,winPoint}`이며 guest는 빈 자리면 null입니다. state는 `waiting/playing`입니다. 서버 내부의 세션·소켓·덱 객체는 방 스냅샷에 포함하지 않습니다.

기존 구현 차이: Node의 방 `createdAt`·게임 `startedAt`은 Unix **밀리초**, Python은 Unix **초**입니다. 계정 createdAt은 양쪽 모두 UTC 문자열(Node는 밀리초 포함)입니다. `input.time`·`defeat.time`과 prepare delay는 양쪽 모두 게임 밀리초입니다. 저장소 교체는 기존 단위나 문자열을 변환하지 않습니다.

소켓 오류 code: `invalid_token`, `already_in_room`, `account_disabled`, `room_limit`, `room_not_found`, `room_full`, `not_host`, `no_guest`, `already_playing`. 잘못된 토큰은 오류 전송 후 연결을 닫습니다. `account_disabled`는 관리 페이지에서 비활성으로 바꾼 계정이 방을 만들거나 입장하려 할 때입니다.

## 7. 저장소 변경 검증

프로젝트 루트에서 다음 명령으로 실제 홈 저장소를 건드리지 않는 임시 파일·SQLite 회귀를 실행합니다.

```powershell
node --experimental-sqlite --test tests/onlineplay_storage.node.cjs
python -B -m unittest discover -s python -p test_onlineplay_storage.py
```

Node 검사는 실제 HTTP/WebSocket을 사용합니다. Python 검사는 관리 스레드를 고정하고 서비스 흐름을 직접 호출합니다. 계정·스냅샷 형식, 비활성 상태, 대소문자 규칙, 결과 저장, 방장 이양, 재시작 동작을 확인합니다. MariaDB 예제는 실제 DB에 연결해 별도로 검증해야 합니다.

---

[개발 안내](../HOWTO.md) · [그래픽](Graphics.md) · [뿌요](Puyo.md) · [적·AI](Enemy.md) · [시뮬레이터·피버](Simulator.md) · [사운드](Sound.md) · [모델 학습](MachineLearning.md) · [English](Server.en.md)
