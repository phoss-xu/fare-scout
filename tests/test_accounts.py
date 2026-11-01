import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from app import accounts, mail_delivery, passwords, scheduler, sessions, store
from app.domain import jobs
from test_app import config

PASSWORD = "test-only-long-password"


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(store, "DB", Path(self.directory.name) / "accounts.db")
        self.db_patch.start()
        store.initialize()

    def tearDown(self):
        self.db_patch.stop()
        self.directory.cleanup()

    def user(self, email):
        return accounts.register({"email": email, "password": PASSWORD, "name": "测试旅客"})

    def test_hashing_normalized_login_and_session_revocation(self):
        user = self.user("Alice@Example.com")
        logged = accounts.login({"email": " alice@example.com ", "password": PASSWORD})
        self.assertEqual(logged["id"], user["id"])
        with store.connect() as db:
            hashed = db.execute("SELECT password_hash FROM users").fetchone()[0]
        self.assertNotIn(PASSWORD, hashed)
        self.assertTrue(passwords.verify(PASSWORD, hashed))
        token, csrf = sessions.issue(user["id"])
        session = sessions.current(token)
        self.assertTrue(sessions.valid_csrf(session, csrf))
        self.assertFalse(sessions.valid_csrf(session, "错误"))
        with store.connect() as db:
            self.assertNotEqual(db.execute("SELECT token_hash FROM sessions").fetchone()[0], token)
        sessions.revoke(token)
        self.assertIsNone(sessions.current(token))

    def test_users_cannot_read_or_change_each_others_records(self):
        alice, bob = self.user("alice@example.com"), self.user("bob@example.com")
        a = store.create(config(), alice["id"])
        b = store.create(config(), bob["id"])
        for watch_id in (a, b):
            job = jobs(store.watch(watch_id))[0]
            store.observe(watch_id, job, "ok", {"price": 3000})
            store.observe(watch_id, job, "ok", {"price": 2500})
        view = store.snapshot(alice["id"])
        self.assertEqual([w["id"] for w in view["watches"]], [a])
        self.assertEqual({o["watch_id"] for o in view["observations"]}, {a})
        self.assertEqual({o["watch_id"] for o in view["alerts"]}, {a})
        self.assertIsNone(store.watch(b, alice["id"]))
        self.assertFalse(store.update_settings(b, {"auto_enabled": False}, alice["id"]))
        self.assertTrue(store.watch(b)["auto_enabled"])
        store.set_recipient("alice-alerts@example.com", alice["id"])
        self.assertEqual(store.email_recipient(bob["id"]), "bob@example.com")
        store.mark_read(999999, alice["id"])
        self.assertIsNone(store.snapshot(bob["id"])["alerts"][0]["read_at"])

    def test_mail_delivery_selects_each_watch_owners_recipient(self):
        alice, bob = self.user("alice@example.com"), self.user("bob@example.com")
        for user in (alice, bob):
            watch_id = store.create(config(), user["id"])
            job = jobs(store.watch(watch_id))[0]
            store.observe(watch_id, job, "ok", {"price": 3000})
            store.observe(watch_id, job, "ok", {"price": 2500})
        with patch.object(mail_delivery, "configuration", side_effect=lambda recipient: {"ready": True, "recipient": recipient}), patch.object(mail_delivery, "send_email") as send:
            mail_delivery.tick()
        self.assertEqual([c.args[0]["recipient"] for c in send.call_args_list], ["alice@example.com", "bob@example.com"])

    def test_legacy_data_reserved_and_setup_token_single_use(self):
        watch_id = store.create(config())
        accounts.migrate_legacy("owner@example.com")
        stranger = self.user("stranger@example.com")
        self.assertFalse(store.snapshot(stranger["id"])["watches"])
        with self.assertRaises(accounts.AuthError):
            self.user("owner@example.com")
        with patch.object(scheduler.worker, "submit") as submit:
            scheduler.tick()
        submit.assert_not_called()
        token = accounts.setup_token("owner@example.com")
        self.assertIsNone(accounts.setup_token("owner@example.com", replace=False))
        with self.assertRaises(accounts.AuthError):
            accounts.activate({"token": "wrong", "password": PASSWORD})
        owner = accounts.activate({"token": token, "password": PASSWORD})
        self.assertEqual(store.watch(watch_id)["owner_id"], owner["id"])
        with self.assertRaises(accounts.AuthError):
            accounts.activate({"token": token, "password": PASSWORD})

    def test_expired_session_and_invalid_credentials_are_rejected(self):
        user = self.user("alice@example.com")
        token, _ = sessions.issue(user["id"])
        with store.connect() as db:
            db.execute("UPDATE sessions SET expires_at=?", (time.time() - 1,))
        self.assertIsNone(sessions.current(token))
        for email in ("alice@example.com", "missing@example.com"):
            with self.assertRaisesRegex(accounts.AuthError, "邮箱或密码不正确"):
                accounts.login({"email": email, "password": "incorrect"})
        for _ in range(10):
            accounts.throttle("alice@example.com", "127.0.0.1")
        with self.assertRaises(accounts.AuthError) as caught:
            accounts.throttle("alice@example.com", "127.0.0.1")
        self.assertEqual(caught.exception.status, 429)

    def test_six_character_minimum_and_local_password_update(self):
        user = self.user("owner@example.com")
        token, _ = sessions.issue(user["id"])
        accounts.set_password("owner@example.com", "abcdef")
        self.assertEqual(accounts.login({"email": "owner@example.com", "password": "abcdef"})["id"], user["id"])
        self.assertIsNone(sessions.current(token))
        with self.assertRaises(ValueError):
            accounts.set_password("owner@example.com", "abcde")


if __name__ == "__main__":
    unittest.main()
