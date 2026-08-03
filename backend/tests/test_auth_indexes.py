import asyncio
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import server


class FakeUsersCollection:
    def __init__(self):
        self.dropped = []
        self.created = []

    async def index_information(self):
        return {
            "_id_": {"key": [("_id", 1)]},
            "googleSub_1": {"key": [("googleSub", 1)], "unique": True},
        }

    async def drop_index(self, name):
        self.dropped.append(name)

    async def create_index(self, field, **options):
        self.created.append((field, options))


class AuthIndexTests(unittest.TestCase):
    def test_replaces_legacy_non_sparse_google_index(self):
        users = FakeUsersCollection()
        with patch.object(server, "db", SimpleNamespace(users=users)):
            asyncio.run(server._ensure_user_auth_indexes())

        self.assertEqual(users.dropped, ["googleSub_1"])
        self.assertIn(("email", {}), users.created)
        self.assertIn(("googleSub", {"unique": True, "sparse": True}), users.created)
        self.assertIn(("appleSub", {"unique": True, "sparse": True}), users.created)


if __name__ == "__main__":
    unittest.main()
