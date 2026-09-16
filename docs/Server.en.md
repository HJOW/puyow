# Running the Node.js and Python servers

This guide is for junior developers familiar with Node.js/Python basics and the server–client model. [한국어](Server.md)

Both servers serve the game files under `src/` and the online-play APIs. Normally, **choose one server**. To run both on one computer, use different ports. Local AI uses ONNX in Node and PyTorch checkpoints in Python.

## 1. Starting, stopping, and changing the port

Open a terminal in the repository root, where `package.json` is located. Commands below use PowerShell; in other shells use `npm` instead of `npm.cmd`.

### Node.js

```powershell
npm.cmd install
npm.cmd start
```

`npm start` runs ESLint, builds the webpack bundle, then starts `node/server.js`. After installing dependencies, you can also start just the server:

```powershell
node node/server.js
node node/server.js 9892
```

The default port is `9891`; the first positional argument overrides it. To change the default, edit `PORT` in `node/server.js`. Use the direct command above when supplying a port; `npm start` combines several commands.

### Python

```powershell
python python/pythonserver.py
python python/pythonserver.py 9892
```

The default is `SERVER_CONFIG["port"] = 9891` in `python/pythonserver.py`. The positional argument takes precedence. Python 3.10 or later is required by the type annotations. The basic static server uses the standard library and this repository's Python modules. Install the following dependency when enabling online accounts:

```powershell
python -m pip install bcrypt
```

See [MachineLearning.en.md](MachineLearning.en.md) for PyTorch installation, model creation, and training. Without a model, Local AI is unavailable but game-file serving continues.

### Connecting and stopping

Open the [game page](http://localhost:9891/puyow.html). Since `src/` is the web root, do not include `/src/` in the URL. If you changed the port, also change it in the URL.

Stop the server with **Ctrl+C** in its terminal. Restart after changing configuration. If you get `EADDRINUSE` or a port-in-use error, stop the existing server or choose another port.

From another computer, replace `localhost` with the **actual game server IP**, for example `http://<game-server-IP>:9891/puyow.html`. Both players must connect to the same server, and its firewall must allow access to that port.

## 2. Enabling online play and understanding the flow

### Enabling it

- Node: set `ONLINE_PLAY_ENABLED = true` in `node/server.js`.
- Python: set `SERVER_CONFIG["online_play_enabled"] = True` in `python/pythonserver.py`.

Both default to disabled. Restart, check that `GET /apis/onlineplayinfo` returns `{"available":true}`, and refresh the game page. Select online play under “Play Together.” When disabled, the server does not even create account or room directories.

### Basic flow

1. Signup and login use HTTP JSON requests. The client computes SHA-256 of the password; the server hashes that string again with bcrypt before storing it.
2. Successful login issues a random session token. Both the server and game keep tokens only in memory.
3. The client opens a WebSocket and authenticates with its token. The server pushes room lists; room creation, joining, and starting use this connection.
4. About three seconds after the host starts, both players receive the same puyo deck. Each client immediately applies its own inputs, which the server relays to the opponent.
5. The server determines results and WIN POINT from defeat reports. After a normal result, the room remains and its host can start again.

The server does not recalculate all board physics or validate every move. It currently relays input and chain information and relies on client defeat reports.

There are at most 200 rooms. The lobby lists up to 50 waiting rooms with a vacant guest slot, ordered by creation time. When the host leaves, the remaining guest becomes host and **the room ID changes to that account ID**. Empty rooms are deleted. Leaving during a match does not update results or WIN POINT.

An account deactivated from the administration page is refused at login, and an already logged-in session cannot create or join rooms. See the administration section below.

The server sends ping frames every five seconds and considers a connection unresponsive after 15 seconds. Disconnecting leaves the room, but the session can be used to authenticate again within a 60-second grace period. Reconnecting a session does not restore the match. Idle sessions expire after 30 minutes. Three password failures within five minutes cause login to reject even the correct password until the lock condition clears.

WIN POINT is a nonnegative integer. Changes use both players' scores before updating:

```text
Win: floor(3 + max(0, opponent score - my score) / 100)
Loss: floor(-(1 + max(0, my score - opponent score) / 300))
New score: max(0, old score + delta)
```

The server waits 50ms after the first defeat report. If it receives a second report in that window and the two reported game times differ by at most 50ms, the result is a draw. Draws do not change points.

### HTTPS/WSS

Node uses `SSL_KEY_FILE` (private key), `SSL_CERT_FILE` (certificate), and optional `SSL_CA_FILE`. Python uses `ssl_key_file`, `ssl_cert_file`, and optional `ssl_ca_file` in `SERVER_CONFIG`. Use PEM files and include the required server chain in Python's certificate file.

If required paths are empty or a specified file is missing, the server runs HTTP. Check the logs and actual `https://` URL. HTTPS also uses `wss://` on the same port. Because the password hash itself is an authentication credential, use HTTPS for remote login.

## 3. Server monitoring and administration page

### Setting up the administrator account

The administration page is [admin.html](http://localhost:9891/admin.html). Opening it shows an administrator login screen first.

- Node: `ADMIN_ID` and `ADMIN_PASSWORD` in `node/server.js`.
- Python: `SERVER_CONFIG["admin_id"]` and `SERVER_CONFIG["admin_password"]` in `python/pythonserver.py`.

This account is completely separate from online-play accounts, and **only one exists; you cannot add more**. The password defaults to an empty string, and **an empty password disables the administrator account entirely**, so no value can log in. Restart the server after changing either value.

The administrator password is stored **in plain text with no one-way hashing** because the operator must be able to edit it in the server source at any time. During login, however, the page and the server each hash it with SHA-256 and compare only those digests, so the plain text never travels over the network. Restrict file permissions on the server source and use HTTPS for remote access.

### Login-failure blocking

The administrator session is separate from online-play sessions and is kept in a `puyow_admin_session` cookie. Failed attempts accumulate in that session, and **five or more failures block administrator login for that session for 10 minutes from the last failure**. While blocked, even the correct password is rejected. After 10 minutes the failure count resets to zero. An administrator session with no requests disappears after 30 minutes.

Because the count lives in the session, clearing cookies resets it. On a publicly reachable server, restrict the administration page itself with a firewall or reverse proxy.

### Dashboard

Logging in opens the dashboard. The left sidebar holds a theme toggle (dark/light) and a logout button, plus the “Home” and “Online accounts” menu items. The theme is not persisted; it defaults to the system setting, falling back to dark mode when that is unavailable.

The dashboard **re-reads server status every four seconds**. The values shown depend on the server.

- Node: `rss`, `heapTotal`, `heapUsed`, `external`, and `arrayBuffers` from `process.memoryUsage()`. System-wide usage is not available.
- Python: system CPU and RAM usage read through `psutil`, plus the server process RSS. Without `psutil` (`pip install psutil`) only those cards are hidden; everything else keeps working.

When online play is enabled, the dashboard also shows the number of accounts, connected sessions, and open rooms.

### Managing online accounts

The “Online accounts” menu lists registered accounts. Clicking one opens a layer popup with the nickname, ID, and current state, plus “Change password”, “Deactivate” (or “Activate”), and “Close” buttons. The list is empty on a server with online play disabled.

- **Change password**: the new password is entered twice and only its SHA-256 hash is sent. The server hashes it again with bcrypt and stores it, and that account's session is closed. The plain-text rule is the same as the game's signup screen: letters, digits, underscore, and `!@#$%^&*?`, 4-30 characters.
- **Deactivate / Activate**: a toggle that flips the `active` field of the account document. A deactivated account **cannot log in**, and a session that logged in earlier is not force-closed but **cannot create or join rooms**. The game receives this as the `account_disabled` error.

### WebMCP tools

In browsers that support WebMCP, the administration page registers five tools on `document.modelContext` so an AI can read status and change account state on a person's behalf. Browsers without support register nothing and the page behaves as usual.

| Tool | What it does | Sign-in required |
| --- | --- | --- |
| `admin_manual` | English instructions for the page and the other tools | No |
| `admin_login_status` | Whether the administrator account exists, whether someone is signed in, remaining block time, and the visible screen | No |
| `admin_server_status` | Server kind, uptime, CPU, RAM, memory figures, and online-play counters | Yes |
| `admin_online_accounts` | The online-play account list | Yes |
| `admin_set_account_state` | Activate or deactivate one online-play account | Yes |

**Signing in and out are deliberately not tools.** This keeps the administrator password out of the tool path, and a person has to sign in on the page. **Changing an online-play account password is also outside the tool scope.** Calling a tool that needs sign-in while nobody is signed in returns an English error saying a person must sign in first.

Tool descriptions and schemas are written in English because an AI reads them. Read-only tools carry `annotations.readOnlyHint`, and `admin_online_accounts` and `admin_set_account_state` also carry `annotations.untrustedContentHint` because they contain nicknames chosen by the players. When a tool reads or changes server state, the page the person is looking at is refreshed with the same values.

## 4. Storage and replacing files with a database

### Default file storage

File I/O is isolated in `FileOnlinePlayStorage` in the [Node module](../node/onlineplay_storage.js) and [Python module](../python/onlineplay_storage.py). The account, room, and match service accepts a storage object.

```text
<home of the server's operating-system account>/.puyowserver/
  account/<lowercase ID>/account.json
  rooms/<lowercase room ID>.json
```

An account document is `{id, nickname, password, winPoint, createdAt}`, plus a boolean `active` once the administration page deactivates the account. An account without `active` counts as active. IDs are case-insensitive; nicknames are case-sensitive. Preserve the account data and bcrypt hashes when replacing storage. Room documents have the room shape described below and are **snapshots of in-memory state**. Service startup deletes room snapshots but preserves accounts. Sessions, sockets, and running matches are outside the database replacement.

The service requires the following contract. One class handles both accounts and room snapshots, keeping file-specific details behind this boundary.

| Node method | Python method | Contract |
| --- | --- | --- |
| `initialize()` | `initialize()` | Prepare directories/schema; never delete accounts; propagate failures |
| `loadNicknameIndex()` | `load_nickname_index()` | Nickname → lowercase ID; Node `Map` / Python `dict` |
| `listAccounts()` | `list_accounts()` | Every stored account, for the administration list. Skips damaged accounts |
| `loadAccount(id)` | `load_account(id)` | Fresh account object or `null` / `None` |
| `saveAccount(account)` | `save_account(account)` | Save the whole account; propagate failures |
| `saveRoom(snapshot)` | `save_room(snapshot)` | Save a serializable room document; propagate failures |
| `removeRoom(id)` | `remove_room(id)` | Delete one snapshot; the file implementation ignores failures |
| `clearRooms()` | `clear_rooms()` | Clear room snapshots; the file implementation ignores failures |

**Every method is synchronous.** A Node adapter that simply returns Promises cannot be injected. This preserves existing execution order, exception handling, and Python lock scopes. Constructors perform no I/O; an enabled service calls initialize, loads the nickname index, then clears rooms.

Input validation, bcrypt, nickname-index updates, and point calculations stay in the service. Account-save exceptions become `server_error` on HTTP paths. Room-save failures are logged while play continues in memory; Python adapters must raise `OSError` for that handler. Account-read failures currently behave like missing accounts. This refactoring does not turn concurrent signup checks or two-account score updates into transactions.

### Example scope

The following are **educational replacement examples**, not enabled defaults. Complete implementations are provided for [Node](examples/onlineplay_sql.js), the [Node MariaDB helper](examples/onlineplay_mariadb_query.js), and [Python](examples/onlineplay_sql.py).

They keep existing JSON documents in the `payload TEXT` column of `puyow_accounts` and `puyow_rooms`, with lowercase IDs as primary keys. Values use SQL parameters. Nickname policy and snapshot semantics remain in the service.

SQLite is a database accessed by **opening a local file**, so it has no server IP or listening port. Do not use `192.168.0.15` as a SQLite address. Only the MariaDB examples assume a database server at `192.168.0.15` on its default port `3306`. Replace the IP, username, password, and database name with actual values. This port is separate from the game server's HTTP port.

### SQLite: Node.js

Replace the service-construction code in `node/server.js` with the following. The adapter implements the storage interface, so the service internals need no changes.

```js
const { SqliteOnlinePlayStorage } = require('../docs/examples/onlineplay_sql');
const onlinePlayService = onlinePlay.createService({
    enabled: ONLINE_PLAY_ENABLED,
    storage: new SqliteOnlinePlayStorage(path.join(PROJECT_ROOT, 'puyow-online.sqlite'))
});
```

The example uses `DatabaseSync` from `node:sqlite`. On Node 22.12, start it as follows. The default file adapter does not require SQLite. [Node 22.12 SQLite documentation](https://nodejs.org/download/release/v22.12.0/docs/api/sqlite.html)

```powershell
node --experimental-sqlite node/server.js
```

Keep the database outside the public `src/` directory. Its parent directory must already exist. If you construct storage directly in tests or tools, close its connection with `storage.close()` afterward.

### SQLite: Python

Use this at the service-construction point in `python/pythonserver.py`. Adjust the example-module search path if you move files.

```python
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "docs" / "examples"))
from onlineplay_sql import SqliteOnlinePlayStorage

online_play_service = OnlinePlayService(
    SERVER_CONFIG.get("online_play_enabled") is True,
    storage=SqliteOnlinePlayStorage(Path(__file__).resolve().parent / "puyow-online.sqlite"),
)
```

This uses standard-library `sqlite3`, with no additional pip installation. It opens and closes a connection per query to avoid sharing connections between threads. For that reason, supply a real file path rather than `:memory:`.

### MariaDB: preparation

Install MariaDB on the database host, then create an example `puyow` database and a dedicated user with an administration tool. Allow that user to connect from the game server host. The example needs `CREATE` for initialization and `SELECT/INSERT/UPDATE/DELETE` at runtime. Pass passwords through environment variables rather than writing them into source code.

```sql
CREATE DATABASE puyow CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
```

Configure the user and allowed host for your actual game server. Existing files are not migrated automatically. Stop both servers, back up the files, then pass each account JSON document to the database adapter's `saveAccount` / `save_account` method. Do not regenerate `password` hashes or `createdAt` strings. Do not migrate rooms.

### MariaDB: Node.js

Install the driver in the repository root only if using this example.

```powershell
npm.cmd install mariadb
$env:PUYOW_DB_PASSWORD = '<actual DB password>'
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

MariaDB's Node driver is asynchronous. This example executes queries in a separate Node process and synchronously receives the result to satisfy the existing service contract. Passwords and SQL values go through the child's standard input, not a shell command. Construction does not connect to the database. [MariaDB Node Promise API](https://mariadb.com/docs/connectors/mariadb-connector-nodejs/connector-nodejs-promise-api)

This **creates a process per query and blocks the main event loop**, so it is not a production-performance design. Results are limited to 8MiB and execution to 15 seconds. Long-term operation needs a separately designed worker/connection mechanism inside the adapter; making the entire service asynchronous would also require reviewing ordering and concurrency.

### MariaDB: Python

```powershell
python -m pip install mariadb
$env:PUYOW_DB_PASSWORD = '<actual DB password>'
```

See [MariaDB Connector/Python](https://mariadb.com/docs/connectors/mariadb-connector-python) for platform-specific installation requirements. Add the module search path as in the SQLite example, then change the adapter:

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

The example uses synchronous connections, calls `commit()` after writes and `rollback()` on failure, then closes the connection. [MariaDB Python connection documentation](https://mariadb.com/docs/connectors/mariadb-connector-python/api/connection)

### Limits that remain after switching to a DB

These examples replace storage for one online-service process. Sharing a DB does not share Node/Python rooms or sessions. Another server startup clears the shared snapshot table, so do not treat the examples as storage for concurrent server instances. Primary keys alone do not guarantee concurrent nickname uniqueness or atomic winner/loser updates. Those require a separate change to the service contract.

## 5. HTTP API reference

URLs below are relative to the server root. Send JSON with `Content-Type: application/json`. No query parameters are needed. In particular, the current Node `/apis/` router does not strip query strings from the API name on some paths, so use the documented URLs directly.

`OPTIONS` returns 204 and CORS headers. Allowed Origin is `*`, methods are `GET, HEAD, POST, OPTIONS`, and headers are `Content-Type, Authorization`. The game and online-play APIs do not use cookie authentication. Only the administration API is an exception and uses a same-origin session cookie.

| URL | Node | Python | Authentication |
| --- | --- | --- | --- |
| `GET /apis/onlineplayinfo` | Online setting | Same | None |
| `GET /apis/localmodelinfo` | ONNX load availability | PyTorch load availability | None |
| `POST /apis/onlineplay/signup` | Signup | Same | None |
| `POST /apis/onlineplay/login` | Login | Same | ID and password hash |
| `POST /apis/onlineplay/logout` | Logout | Same | Session token in body |
| `POST /v1/chat/completions` | Local AI placement/test | Same, plus optional reverse-training recording | AI Bearer token |
| `POST /apis/learning` | Accumulate learning events | Same, stricter validation | AI Bearer token |
| `POST /apis/solomonlearning` | Acknowledge only | Collect/apply reverse training | See differences below |
| `POST /apis/admin/session` | Administrator login state | Same | None (issues a session cookie) |
| `POST /apis/admin/login` | Administrator login | Same | ID and password hash |
| `POST /apis/admin/logout` | Administrator logout | Same | Administrator session cookie |
| `POST /apis/admin/status` | Server status (V8 memory) | Server status (psutil CPU/RAM) | Administrator session cookie |
| `POST /apis/admin/accounts` | Online account list | Same | Administrator session cookie |
| `POST /apis/admin/accountpassword` | Change an online account password | Same | Administrator session cookie |
| `POST /apis/admin/accountstate` | Activate or deactivate an online account | Same | Administrator session cookie |

Information endpoints take no parameters and return 200 `{"available":boolean}`. Online information reflects configuration, not a live two-player match test. Model information checks actual model loading as well as file existence. These two handlers currently do not enforce GET themselves, but clients use GET.

### Signup, login, and logout

| Request | JSON parameters | 200 response |
| --- | --- | --- |
| signup | `id`, `nickname`, `password`: strings | `{"ok":true}` |
| login | `id`, `password`: strings | `{"ok":true,"token":"...","nickname":"Alice","winPoint":0}` |
| logout | `token`: login-token string | `{"ok":true}`, including an already absent token |

IDs allow 4–20 ASCII letters, digits, or underscores and are case-insensitive. Nicknames allow the same character set, 3–20 characters, and are case-sensitive. API `password` is a **64-character lowercase hexadecimal SHA-256 string, not plaintext**. The game UI first validates plaintext as 4–30 letters, digits, underscores, or `!@#$%^&*?`.

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

Run the `crypto.subtle` example on HTTPS or localhost. The game also has a CryptoJS fallback. Send the same hash for login; bcrypt runs only on the server.

Online HTTP errors use `{"ok":false,"code":"..."}`.

| Status | code | Meaning |
| --- | --- | --- |
| 400 | `invalid_id`, `invalid_nickname`, `invalid_password` | Invalid signup fields |
| 400 | `invalid_request` | Invalid login fields |
| 400 | `invalid_body` | Invalid JSON body |
| 401 | `login_failed` | Missing account or wrong password |
| 409 | `duplicate_id`, `duplicate_nickname` | Duplicate signup |
| 403 | `account_disabled` | The account was deactivated from the administration page |
| 423 | `account_locked` | Password-failure lock |
| 404 | `online_play_disabled`, `not_found` | Disabled feature or unknown action |
| 405 | `method_not_allowed` | Non-POST request |
| 500 | `server_error` | Failure such as account persistence |

Online bodies are limited to 64KiB. Python returns 413 `invalid_body` when exceeded. Node destroys the request connection, so receipt of an error JSON is not guaranteed. Python also rejects non-object JSON as `invalid_body`. The implementations do not produce identical responses for every invalid input.

### Administration API

Every administration API is a `POST` with a JSON body. The first request issues a `puyow_admin_session` cookie (HttpOnly, SameSite=Strict), and every later request finds the same session through it. Call them from a browser with `fetch(..., { credentials: 'same-origin' })`. Bodies are limited to 64KiB.

| Request | JSON parameters | 200 response |
| --- | --- | --- |
| session | None | `{"ok":true,"adminEnabled":true,"authenticated":false,"blockedSeconds":0}` |
| login | `id`, `password` (SHA-256 hash) | `{"ok":true,"adminId":"root"}` |
| logout | None | `{"ok":true}` |
| status | None | The server-status object below |
| accounts | None | `{"ok":true,"onlinePlayEnabled":true,"accounts":[...]}` |
| accountpassword | `id`, `password` (SHA-256 hash) | `{"ok":true}` |
| accountstate | `id`, `active` (boolean) | `{"ok":true,"account":{...}}` |

Each entry in `accounts` is `{id, nickname, active, winPoint, createdAt, online}`. **No response ever contains the password hash.** `online` reports whether a session is currently logged in.

`status` has the same shape on both servers, but each fills only what it can measure. Node always returns `null` for `cpuPercent` and `memoryPercent`; Python returns `null` for both and `psutilAvailable: false` when `psutil` is missing.

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

Administration errors also use `{"ok":false,"code":"..."}`.

| Status | code | Meaning |
| --- | --- | --- |
| 400 | `invalid_body`, `invalid_request`, `invalid_password` | Invalid body or field |
| 400 | `account_not_found` | The target online account does not exist |
| 401 | `login_failed` | Wrong administrator ID or password. `remain` holds the attempts left |
| 401 | `unauthorized` | A session that is not logged in called an administration action |
| 403 | `admin_disabled` | The server's administrator password is empty |
| 404 | `online_play_disabled`, `not_found` | Online play disabled or unknown action |
| 405 | `method_not_allowed` | Non-POST request |
| 423 | `login_blocked` | Blocked after five failures. `blockedSeconds` holds the remaining seconds |
| 500 | `server_error` | An exception during processing |

### Local AI authentication and Chat Completions

Node reads the AI token from `PUYOW_AI_TOKEN`; Python uses `SERVER_CONFIG["learning_token"]`. Remote calls use `Authorization: Bearer <configured-token>`. This is different from an online login session token.

| Endpoint | Node `Bearer localhost` | Python `Bearer localhost` |
| --- | --- | --- |
| `/v1/chat/completions` | Allowed only from loopback | Allowed only from loopback |
| `/apis/learning` | No separate bypass; compared with configured token | Allowed from loopback |
| `/apis/solomonlearning` | Acknowledgement handler does not validate auth/body | Allowed from loopback |

Chat Completions bodies default to a 1MiB limit. `model` must be a nonempty string and is echoed in the response; it does not select a model file. This endpoint implements neither general conversation generation nor streaming.

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

`ai_api_test_result` loads the model and returns `{"success":true}`. `solomon_puyo_placement` parses the last string `role:"user"` message's `content` as JSON and reads:

| Field inside content | Type and purpose |
| --- | --- |
| `currentField.occupiedCells` | `[{x,y,color}]`; integer x=0–5, y>=0, bottom is y=0. Only y<12 enters the observation |
| `suppliedPuyos` | `[{order:"current",colors:["red","blue"]},{order:"next_1",colors:["green","yellow"]}]`. current required, next_1 optional |
| `currentState` | Optional object. `attack`, `placedPairCount`, `incomingDamage`, `elapsedMs` default 0; `marginRate` 70; `timeProgressMultiplier` 1; `feverRule` and `allClearTicket` false |
| `currentState.fever` | Optional object with `active`, `gauge`, `nextTime`, `targetCombo`, `leftTime`, etc. |
| `usablePlacements` | Optional array of 1–24 `{x,rotation}` items, x=0–5, rotation=0–3. Without it the server determines legal placements |
| `learningSessionId` | Optional 1–128-character string; Python records Solomon moves in the session, Node ignores it |

Pair colors are `red/green/yellow/blue/purple`. Output rotation is 0=up, 1=right, 2=down, 3=left. A successful response has the following shape; `content` is a **JSON string**, not an object.

```json
{
  "id":"chatcmpl-puyow-...",
  "object":"chat.completion",
  "created":1750000000,
  "model":"puyow",
  "choices":[{"index":0,"message":{"role":"assistant","content":"{\"x\":2,\"rotation\":0}"},"finish_reason":"stop"}]
}
```

Errors use `{"error":{"message":"...","type":"..."}}`. Main statuses are 400 (input/schema), 401 (authentication), 404 (model unconfigured/missing), 405 (method), 413 (body size), 422 (no legal placement), 503 (model load/inference unavailable), and 500 (unexpected failure). Node may close the connection on an oversized body.

### Learning events and reverse training

See [MachineLearning.en.md](MachineLearning.en.md) for training workflows, observations, and model details. This section summarizes the transport contract.

Common `POST /apis/learning` fields are `sessionId` (1–128 characters) and `event`.

| event | Additional fields |
| --- | --- |
| `reset` | `observation`: finite-number array |
| `step` | `observation`, `nextObservation`, `action` (integer), `reward` (finite number), `done` (boolean) |
| `episode_end` | `done:true` |

Python requires exactly 528 observation values and action 0–23. Node's event collector accepts 1–10000 observation values and an integer action. Use Python's stricter shape for requests shared between both servers. Success returns `{ok,event,sessionId,sequence,steps,totalReward,done}`. This endpoint accumulates events; calling it does not itself train a model. Errors use `{ok:false,error:"..."}`, mainly 400/401/405/413/500/503 (missing authentication configuration).

Python `POST /apis/solomonlearning` requests:

- `{event:"step",sessionId,observation,action,nextPair?}`: records a human move. Optional nextPair contains two color names.
- `{event:"finish",sessionId,result}`: result is `win/loss/draw` **from Solomon's perspective**. Trains and saves the model from session samples.
- Step success: `{ok:true,sessionId,event:"step"}`.
- Finish success: `{ok:true,sessionId,trained,transitions}`, with `playerTransitions,loss` when trained, or `reason` when not trained.

Node discards the body and returns `{ok:true,trained:false,transitions:0,reason:"Node 서버는 솔로몬 역학습을 지원하지 않습니다."}`. Its current handler does not validate method or authentication. The client uses POST.

## 6. Online WebSocket API

Connect to `ws://<game-server>:<port>/apis/onlineplay/socket`, or `wss://` with HTTPS. Send `auth` as the first message within five seconds. Messages are JSON text; individual frames are limited to 256KiB.

```js
const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(scheme + '//' + location.host + '/apis/onlineplay/socket');
socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'auth', token: loginResult.token }));
});
socket.addEventListener('message', event => console.log(JSON.parse(event.data)));
```

`loginResult` is the successful login JSON described above. Browsers handle protocol ping/pong automatically; do not send a separate JSON `ping` message.

### Client → server

| type | Additional fields | Behavior |
| --- | --- | --- |
| `auth` | `token`: string | Authenticate the socket with a login token |
| `room_list` | None | Request waiting rooms |
| `room_create` | `rule`, `colorCount` | rule=`standard/fever/feverStart`, colorCount=3/4/5; invalid or missing values default to standard/4 |
| `room_join` | `roomId`: room-ID string | Join a waiting room with a free slot |
| `room_leave` | None | Leave and receive the lobby list |
| `game_start_request` | None | Host starts a room with a guest |
| `input` | `time`, `kind`, `value` | Game time in ms; left/right/rotateLeft/rotateRight/downStart/downEnd; action value |
| `chain_result` | `time`, `attack`, `allClear`, `fever` | Relay chain information |
| `defeat` | `time`: game time in ms | Report defeat |

The server relays input/chain_result values as supplied. The table does not imply strict server-side validation. Unknown types on authenticated connections are ignored; messages other than auth before authentication close the connection.

### Server → client

| type | Additional fields and meaning |
| --- | --- |
| `auth_ok` | `nickname,winPoint` |
| `room_list` | `rooms:[{id,rule,colorCount,hostNickname}]` |
| `room_state` | `room`: room object below; `youAreHost`: boolean |
| `room_closed` | Room closed |
| `opponent_left` | Opponent left during preparation/play |
| `game_prepare` | `delay:3000` ms |
| `game_start` | `rule,colorCount,deck,startedAt,youAreHost,opponent`; deck contains 512 identical-to-opponent pairs of color strings |
| `game_cancel` | Start preparation cancelled |
| `opponent_input` | `time,kind,value` |
| `opponent_chain` | `time,attack,allClear,fever` |
| `game_result` | `result:"win"/"lose"/"draw",delta,winPoint` |
| `session_closed` | Duplicate login, session expiration, etc. |
| `error` | `code`: one of the codes below |

Room object: `{id,rule,colorCount,host,guest,state,createdAt}`. host/guest have `{id,nickname,winPoint}`; guest is null when vacant. state is `waiting/playing`. Internal session, socket, and deck objects are not included in snapshots.

Existing implementation difference: Node room `createdAt` and game `startedAt` use Unix **milliseconds**; Python uses Unix **seconds**. Account createdAt is a UTC string in both, with milliseconds included by Node. `input.time`, `defeat.time`, and preparation delay use game milliseconds in both. Storage replacement preserves existing units and strings.

Socket error codes: `invalid_token`, `already_in_room`, `account_disabled`, `room_limit`, `room_not_found`, `room_full`, `not_host`, `no_guest`, `already_playing`. An invalid token sends an error and closes the connection. `account_disabled` means an account deactivated from the administration page tried to create or join a room.

## 7. Validating storage changes

From the repository root, run the temporary-file/SQLite regressions, which do not touch the actual home storage:

```powershell
node --experimental-sqlite --test tests/onlineplay_storage.node.cjs
python -B -m unittest discover -s python -p test_onlineplay_storage.py
```

Node tests use real HTTP/WebSocket connections. Python tests control the maintenance thread and call the service flow directly. They check account/snapshot shapes, disabled mode, case rules, result persistence, host transfer, and restart behavior. MariaDB examples need separate validation against an actual database.

---

[Development guide](../HOWTO.en.md) · [Graphics](Graphics.en.md) · [Puyo](Puyo.en.md) · [Opponents and AI](Enemy.en.md) · [Simulator and Fever](Simulator.en.md) · [Sound](Sound.en.md) · [Model training](MachineLearning.en.md) · [한국어](Server.md)
