import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app import accounts, passkey_store, sessions, store


class LocalPasskeyChallengeTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.patched = patch.object(store, 'DB', Path(self.directory.name) / 'test.db')
        self.patched.start()
        store.initialize()
        self.user = accounts.register({'email': 'local@example.test', 'password': 'test-password'})
        self.session, _ = sessions.issue(self.user['id'])
        self.handler = SimpleNamespace(headers={'Cookie': 'fare_session='+self.session})

    def tearDown(self):
        self.patched.stop()
        self.directory.cleanup()

    def flow(self):
        token = passkey_store.save_flow(self.handler, 'random-challenge', 'bind', self.user['id'], 'http://localhost:8765', 'localhost')
        self.handler.headers['Cookie'] = f'fare_session={self.session}; fare_passkey_flow={token}'
        with store.connect() as db:
            row = db.execute('SELECT * FROM local_passkey_challenges').fetchone()
            self.assertNotEqual(row['token_hash'], token)
            self.assertNotEqual(row['session_hash'], self.session)
        return token

    def consume(self):
        return passkey_store.consume(self.handler, 'bind', self.user['id'], 'http://localhost:8765', 'localhost')

    def test_expiry_single_use_and_same_user_session_binding(self):
        self.flow()
        self.assertEqual(self.consume()['challenge'], 'random-challenge')
        with self.assertRaises(accounts.AuthError):
            self.consume()
        self.flow()
        with store.connect() as db:
            db.execute('UPDATE local_passkey_challenges SET expires_at=?', (time.time()-1,))
        with self.assertRaises(accounts.AuthError):
            self.consume()
        token = self.flow()
        another, _ = sessions.issue(self.user['id'])
        self.handler.headers['Cookie'] = f'fare_session={another}; fare_passkey_flow={token}'
        with self.assertRaises(accounts.AuthError):
            self.consume()

    def test_origin_and_missing_browser_cookie_rejected_and_handle_stable(self):
        self.assertEqual(passkey_store.user_handle(self.user['id']), passkey_store.user_handle(self.user['id']))
        self.flow()
        with self.assertRaises(accounts.AuthError):
            passkey_store.consume(self.handler, 'bind', self.user['id'], 'http://localhost:9999', 'localhost')
        self.flow()
        self.handler.headers['Cookie'] = 'fare_session='+self.session
        with self.assertRaises(accounts.AuthError):
            self.consume()
