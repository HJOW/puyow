"""리더보드 서버 기록의 검증·저장·병합 규칙을 독립 임시 디렉터리에서 확인한다.

node/leaderboard.js 도 같은 규칙과 같은 응답 형식을 써야 한다. 한쪽을 고치면 다른 쪽도 함께 고친다.
"""
import json
from http import HTTPStatus
from pathlib import Path
import tempfile
import threading
import unittest

from leaderboard import LeaderboardService, normalize_nickname, normalize_record
from leaderboard_storage import FileLeaderboardStorage


class LeaderboardNicknameTest(unittest.TestCase):
    def test_rejects_names_that_cannot_be_file_names(self):
        # 게임 설정 화면의 PLAYER_NAME_FORBIDDEN_PATTERN 과 같은 문자를 막는다.
        for bad in ["", "   ", "a/b", "a\\b", "a:b", "a*b", "a?b", 'a"b', "a<b", "a>b", "a|b", "a'b", "a!b", "a.b", "..", "a\x00b", "가" * 21]:
            self.assertIsNone(normalize_nickname(bad), bad)
        self.assertIsNone(normalize_nickname(None))
        self.assertIsNone(normalize_nickname(12))
        # 앞뒤 공백은 다듬어 받아들인다. 한글·공백이 들어간 이름은 파일명으로 쓸 수 있다.
        self.assertEqual(normalize_nickname("  PLAYER 1  "), "PLAYER 1")
        self.assertEqual(normalize_nickname("뿌요"), "뿌요")


class LeaderboardRecordTest(unittest.TestCase):
    def test_battle_rules_need_difficulty_and_opponent(self):
        self.assertIsNone(normalize_record({"rule": "standard", "colors": 4, "score": 10}))
        self.assertIsNone(normalize_record({"rule": "standard", "difficulty": "normal", "colors": 4, "score": 10}))
        self.assertIsNone(normalize_record({"rule": "standard", "difficulty": "nope", "colors": 4, "opponent": "Kimaris", "score": 10}))
        self.assertIsNone(normalize_record({"rule": "standard", "difficulty": "normal", "colors": 4, "opponent": "../x", "score": 10}))
        self.assertEqual(
            normalize_record({"rule": "standard", "difficulty": "normal", "colors": 4, "opponent": "Kimaris", "score": 10.9}),
            {"rule": "standard", "difficulty": "normal", "colors": 4, "opponent": "Kimaris", "score": 10},
        )

    def test_solo_rules_drop_difficulty_and_opponent(self):
        self.assertEqual(
            normalize_record({"rule": "practice", "difficulty": "normal", "colors": 3, "opponent": "Kimaris", "score": 5}),
            {"rule": "practice", "difficulty": None, "colors": 3, "opponent": None, "score": 5},
        )

    def test_rejects_unknown_rule_color_and_score(self):
        self.assertIsNone(normalize_record({"rule": "nope", "colors": 3, "score": 1}))
        self.assertIsNone(normalize_record({"rule": "practice", "colors": 6, "score": 1}))
        self.assertIsNone(normalize_record({"rule": "practice", "colors": 3, "score": -1}))
        self.assertIsNone(normalize_record({"rule": "practice", "colors": 3, "score": "1"}))


class LeaderboardServiceTest(unittest.TestCase):
    def test_saves_one_file_per_player_and_merges_rankings(self):
        with tempfile.TemporaryDirectory(prefix="puyow-leaderboard-") as temporary:
            root = Path(temporary)
            storage = FileLeaderboardStorage(root)
            # 생성만으로는 디렉터리를 만들지 않는다.
            self.assertFalse((root / "leaderboard").exists())
            service = LeaderboardService(True, storage)
            self.assertTrue((root / "leaderboard").exists())

            self.assertEqual(service.add_record({"nickname": "ALICE", "rule": "standard", "difficulty": "normal", "colors": 4, "opponent": "Kimaris", "score": 50000})[0], HTTPStatus.OK)
            self.assertEqual(service.add_record({"nickname": "BOB", "rule": "standard", "difficulty": "normal", "colors": 4, "opponent": "Kimaris", "score": 70000})[0], HTTPStatus.OK)
            self.assertEqual(service.add_record({"nickname": "뿌요", "rule": "practice", "colors": 3, "score": 777})[0], HTTPStatus.OK)
            # 파일 이름은 닉네임 그대로다. 사람마다 한 파일만 쓴다.
            self.assertEqual(sorted(path.name for path in (root / "leaderboard").iterdir()), ["ALICE.json", "BOB.json", "뿌요.json"])

            # 기록 일시는 요청값을 믿지 않고 서버 시각으로 적는다.
            status, body = service.add_record({"nickname": "ALICE", "rule": "practice", "colors": 5, "score": 1, "recordedAt": 0})
            self.assertEqual(status, HTTPStatus.OK)
            saved = json.loads((root / "leaderboard" / "ALICE.json").read_text(encoding="utf-8"))
            self.assertTrue(all(record["recordedAt"] > 0 for record in saved["records"]))

            status, body = service.get_records()
            self.assertEqual(status, HTTPStatus.OK)
            self.assertEqual(body["version"], 2)
            # 여러 사람의 기록이 한 순위에 점수 내림차순으로 모인다. 구조는 게임의 localStorage 와 같다.
            ranking = body["records"]["standard"]["normal"]["4"]["Kimaris"]
            self.assertEqual([entry["name"] for entry in ranking], ["BOB", "ALICE"])
            self.assertEqual([entry["score"] for entry in ranking], [70000, 50000])
            self.assertEqual(body["records"]["practice"]["3"][0]["name"], "뿌요")

    def test_rejects_bad_nickname_and_record_without_writing(self):
        with tempfile.TemporaryDirectory(prefix="puyow-leaderboard-") as temporary:
            root = Path(temporary)
            service = LeaderboardService(True, FileLeaderboardStorage(root))
            self.assertEqual(service.add_record({"nickname": "../../evil", "rule": "practice", "colors": 3, "score": 1})[1]["code"], "invalid_nickname")
            self.assertEqual(service.add_record({"nickname": "OK", "rule": "nope", "colors": 3, "score": 1})[1]["code"], "invalid_record")
            self.assertEqual(list((root / "leaderboard").iterdir()), [])

    def test_keeps_only_top_ten_per_ranking(self):
        with tempfile.TemporaryDirectory(prefix="puyow-leaderboard-") as temporary:
            root = Path(temporary)
            service = LeaderboardService(True, FileLeaderboardStorage(root))
            for score in range(15):
                service.add_record({"nickname": "ALICE", "rule": "practice", "colors": 3, "score": score})
            saved = json.loads((root / "leaderboard" / "ALICE.json").read_text(encoding="utf-8"))
            self.assertEqual(len(saved["records"]), 10)
            self.assertEqual(sorted((record["score"] for record in saved["records"]), reverse=True)[0], 14)
            # 서로 다른 순위는 따로 10개씩 남는다.
            service.add_record({"nickname": "ALICE", "rule": "practice", "colors": 4, "score": 1})
            saved = json.loads((root / "leaderboard" / "ALICE.json").read_text(encoding="utf-8"))
            self.assertEqual(len(saved["records"]), 11)

    def test_concurrent_writes_do_not_lose_records(self):
        # 파이썬 서버는 스레드 서버라 읽고 고쳐 쓰는 묶음이 겹칠 수 있다. 저장소의 잠금이 이를 막는다.
        with tempfile.TemporaryDirectory(prefix="puyow-leaderboard-") as temporary:
            root = Path(temporary)
            service = LeaderboardService(True, FileLeaderboardStorage(root))
            colors = [3, 4, 5]

            def worker(index: int) -> None:
                service.add_record({"nickname": "ALICE", "rule": "practice", "colors": colors[index % 3], "score": index})

            threads = [threading.Thread(target=worker, args=(index,)) for index in range(30)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
            saved = json.loads((root / "leaderboard" / "ALICE.json").read_text(encoding="utf-8"))
            # 색 수마다 10개씩 남아 모두 30개다. 잠금이 없으면 덮어써서 이보다 줄어든다.
            self.assertEqual(len(saved["records"]), 30)

    def test_disabled_service_refuses_every_request(self):
        with tempfile.TemporaryDirectory(prefix="puyow-leaderboard-") as temporary:
            root = Path(temporary)
            service = LeaderboardService(False, FileLeaderboardStorage(root))
            # 기능을 끄면 저장 디렉터리도 만들지 않는다.
            self.assertFalse((root / "leaderboard").exists())
            handler = type("Handler", (), {"path": "/apis/leaderboard/records", "command": "GET"})()
            self.assertEqual(service.handle_api(handler)[1]["code"], "leaderboard_disabled")
            self.assertEqual(service.get_stats(), {"enabled": False, "players": 0, "records": 0})


if __name__ == "__main__":
    unittest.main()
