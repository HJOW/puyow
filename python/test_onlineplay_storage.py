"""계정·방 저장 형식과 서비스 교체 계약을 독립 임시 디렉터리에서 확인한다."""
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from onlineplay import OnlinePlayService
from onlineplay_storage import FileOnlinePlayStorage

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "docs" / "examples"))
from onlineplay_sql import SqliteOnlinePlayStorage

FIXTURE = json.loads((Path(__file__).resolve().parent.parent / "tests" / "onlineplay.fixture.json").read_text(encoding="utf-8"))


class OnlineStorageTest(unittest.TestCase):
    def test_files_and_failure_contract(self):
        with tempfile.TemporaryDirectory(prefix="puyow-online-") as temporary:
            root = Path(temporary)
            storage = FileOnlinePlayStorage(root)
            self.assertFalse((root / "account").exists())
            storage.initialize()
            storage.save_account(FIXTURE["account"])
            self.assertEqual(storage.load_account("ALICE_1"), FIXTURE["account"])
            self.assertEqual(json.loads((root / "account/alice_1/account.json").read_text(encoding="utf-8")), FIXTURE["account"])
            changed = storage.load_account("alice_1")
            changed["winPoint"] = 99
            self.assertEqual(storage.load_account("alice_1")["winPoint"], 7)
            self.assertIsNone(storage.load_account("missing"))
            (root / "account/broken").mkdir()
            (root / "account/broken/account.json").write_text("{", encoding="utf-8")
            self.assertIsNone(storage.load_account("broken"))
            self.assertEqual(storage.load_nickname_index(), {"Alice": "alice_1"})
            storage.save_room(FIXTURE["room"])
            self.assertEqual(json.loads((root / "rooms/alice_1.json").read_text(encoding="utf-8")), FIXTURE["room"])
            (root / "rooms/keep.txt").write_text("keep", encoding="utf-8")
            storage.clear_rooms()
            self.assertEqual([p.name for p in (root / "rooms").iterdir()], ["keep.txt"])
            self.assertEqual(storage.load_account("Alice_1"), FIXTURE["account"])
            storage.remove_room("absent")
            (root / "rooms/fail.json").mkdir()
            with self.assertRaises(OSError):
                storage.save_room({**FIXTURE["room"], "id": "fail"})
            (root / "account/fail/account.json").mkdir(parents=True)
            with self.assertRaises(OSError):
                storage.save_account({**FIXTURE["account"], "id": "fail"})

    def test_disabled_does_not_access_storage(self):
        class UnusableStorage:
            def __getattr__(self, name):
                raise AssertionError("비활성 저장소 접근")
        self.assertFalse(OnlinePlayService(False, UnusableStorage()).is_enabled())

    def test_service_with_file_and_sqlite(self):
        # 관리 스레드 대신 테스트가 게임 시작과 결과 확정 시점을 직접 진행한다.
        with patch("onlineplay.threading.Thread.start"):
            for backend in ("file", "sqlite"):
                with self.subTest(backend=backend), tempfile.TemporaryDirectory(prefix="puyow-online-") as temporary:
                    root = Path(temporary)
                    storage = FileOnlinePlayStorage(root) if backend == "file" else SqliteOnlinePlayStorage(root / "test.sqlite")
                    service = OnlinePlayService(True, storage)

                    def api(action, payload):
                        body = json.dumps(payload).encode()
                        return service.handle_api(SimpleNamespace(command="POST", path=f"/apis/onlineplay/{action}",
                                                  headers={"Content-Length": str(len(body))}, rfile=io.BytesIO(body)))

                    password = "a" * 64
                    self.assertEqual(api("signup", {"id": "Alice_1", "nickname": "Alice", "password": password})[0], 200)
                    self.assertEqual(api("signup", {"id": "alice_1", "nickname": "Other", "password": password})[1]["code"], "duplicate_id")
                    self.assertEqual(api("signup", {"id": "Bob_1", "nickname": "Alice", "password": password})[1]["code"], "duplicate_nickname")
                    self.assertEqual(api("signup", {"id": "Bob_1", "nickname": "alice", "password": password})[0], 200)
                    first = api("login", {"id": "ALICE_1", "password": password})[1]
                    second = api("login", {"id": "Bob_1", "password": password})[1]
                    with patch.object(storage, "save_account", side_effect=OSError("검증용 계정 저장 실패")), patch("builtins.print"):
                        self.assertEqual(api("signup", {"id": "Fail_1", "nickname": "Fail", "password": password})[1]["code"], "server_error")
                    alice, bob = service.sessions[first["token"]], service.sessions[second["token"]]
                    messages = []
                    alice["connection"] = SimpleNamespace(send_message=messages.append, close=lambda: None)
                    bob["connection"] = SimpleNamespace(send_message=messages.append, close=lambda: None)
                    service._create_room(alice, {"rule": "standard", "colorCount": 4})
                    with patch.object(storage, "save_room", side_effect=OSError("검증용 방 저장 실패")), patch("builtins.print") as log:
                        service._join_room(bob, {"roomId": "Alice_1"})
                        log.assert_called_once()
                    room = service.rooms["Alice_1"]
                    self.assertEqual(room["guest"]["accountId"], "Bob_1")
                    service._request_game_start(alice)
                    service._start_game(room)
                    starts = [message for message in messages if message["type"] == "game_start"]
                    self.assertEqual(starts[0]["deck"], starts[1]["deck"])
                    room["game"]["defeats"] = [{"session": bob, "time": 1000}]
                    service._finish_game(room)
                    self.assertEqual(storage.load_account("alice_1")["winPoint"], 3)
                    self.assertEqual(storage.load_account("bob_1")["winPoint"], 0)
                    self.assertEqual([message["winPoint"] for message in messages if message["type"] == "game_result"], [3, 0])
                    api("logout", {"token": first["token"]})
                    self.assertEqual(list(service.rooms), ["Bob_1"])
                    if backend == "file":
                        self.assertFalse((root / "rooms/alice_1.json").exists())
                        self.assertTrue((root / "rooms/bob_1.json").exists())
                    else:
                        self.assertEqual(storage.query("SELECT id FROM puyow_rooms"), [("bob_1",)])
                    restarted = OnlinePlayService(True, storage)
                    self.assertEqual(restarted.nickname_index, {"Alice": "alice_1", "alice": "bob_1"})
                    self.assertEqual(storage.load_account("alice_1")["winPoint"], 3)
                    self.assertEqual(restarted.rooms, {})
                    if backend == "file":
                        self.assertEqual(list((root / "rooms").iterdir()), [])
                    else:
                        self.assertEqual(storage.query("SELECT id FROM puyow_rooms"), [])


if __name__ == "__main__":
    unittest.main()
