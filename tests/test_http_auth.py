import http.client
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from app import accounts, sessions, store
from app.server import Handler, ThreadingHTTPServer
from test_app import config


class HTTPAuthTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(store, "DB", Path(self.directory.name) / "http.db")
        self.db_patch.start()
        store.initialize()
        self.alice = accounts.register({"email": "alice@example.com", "password": "alice-test-password"})
        self.bob = accounts.register({"email": "bob@example.com", "password": "bob-test-password"})
        self.bob_watch = store.create(config(), self.bob["id"])
        self.log_patch = patch.object(Handler, "log_message")
        self.log_patch.start()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.log_patch.stop()
        self.db_patch.stop()
        self.directory.cleanup()

    def request(self, path, data=None, cookie=None, csrf=None, extra=None):
        headers = dict(extra or {})
        if cookie:
            headers["Cookie"] = cookie
        if csrf:
            headers["X-CSRF-Token"] = csrf
        if data is not None:
            headers["Content-Type"] = "application/json"
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port)
        connection.request("POST" if data is not None else "GET", path,
                           json.dumps(data) if data is not None else None, headers)
        response = connection.getresponse()
        result = response.status, json.loads(response.read()), response.getheader("Set-Cookie")
        connection.close()
        return result

    def login(self):
        status, body, cookie = self.request('/api/auth/login', {"email": "alice@example.com", "password": "alice-test-password"})
        self.assertEqual(status, 200)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        return cookie.split(";")[0], body["csrf_token"]

    def test_trip_api_auth_isolation_and_public_share(self):
        data = json.loads((Path(__file__).with_name('fixtures') / 'trip-snapshot.json').read_text())
        self.assertEqual(self.request('/api/trips')[0], 401)
        cookie, csrf = self.login()
        self.assertEqual(self.request('/api/trips', data, cookie)[0], 403)
        status, body, _ = self.request('/api/trips', data, cookie, csrf)
        self.assertEqual(status, 200)
        self.assertEqual(len(body['trips']), 1)
        status, body, _ = self.request('/api/shared-trips', data, cookie, csrf)
        self.assertEqual(status, 201)
        public = self.request('/api/shared-trips/' + body['id'])
        self.assertEqual(public[0], 200)
        self.assertNotIn('email', json.dumps(public[1]))
        self.assertEqual(self.request('/api/shared-trips/missing')[0], 404)

    def test_recoverable_deletion_is_authenticated_and_owner_scoped(self):
        cookie, csrf=self.login()
        own=store.create(config(),self.alice['id'])
        url=f'/api/watches/{own}/delete'
        self.assertEqual(self.request(url,{})[0],401)
        self.assertEqual(self.request(url,{},cookie=cookie)[0],403)
        self.assertEqual(self.request(f'/api/watches/{self.bob_watch}/delete',{},cookie,csrf)[0],404)
        self.assertEqual(self.request(url,{},cookie,csrf)[0],200)
        state=self.request('/api/state',cookie=cookie)[1]
        self.assertEqual(state['watches'],[])
        self.assertEqual([w['id'] for w in state['deleted_watches']],[own])
        self.assertEqual(self.request(f'/api/watches/{own}/restore',{},cookie,csrf)[0],200)
        self.assertFalse(store.watch(own,self.alice['id'])['auto_enabled'])

    def test_guest_csrf_and_cross_user_requests_are_blocked(self):
        self.assertEqual(self.request('/api/state')[0], 401)
        self.assertEqual(self.request('/api/watches', config())[0], 401)
        cookie, csrf = self.login()
        self.assertEqual(self.request('/api/state', cookie=cookie)[1]["watches"], [])
        self.assertEqual(self.request('/api/email', {"recipient": "changed@example.com"}, cookie=cookie)[0], 403)
        for action, body in (("settings", {"auto_enabled": False}), ("check", {})):
            with patch('app.worker.submit') as submit:
                status, _, _ = self.request(f'/api/watches/{self.bob_watch}/{action}', body, cookie, csrf)
            self.assertEqual(status, 404)
            submit.assert_not_called()
        created = self.request('/api/watches', config() | {"owner_id": self.bob["id"]}, cookie, csrf)
        self.assertEqual(created[0], 201)
        self.assertEqual(store.watch(created[1]["id"])["owner_id"], self.alice["id"])

    def test_logout_and_origin_validation(self):
        cookie, csrf = self.login()
        status = self.request('/api/email', {"recipient": "new@example.com"}, cookie, csrf,
                              {"Origin": "http://attacker.example"})[0]
        self.assertEqual(status, 403)
        status = self.request('/api/state', extra={"Host": "attacker.example"})[0]
        self.assertEqual(status, 403)
        self.assertEqual(self.request('/api/auth/logout', {}, cookie, csrf)[0], 200)
        self.assertEqual(self.request('/api/state', cookie=cookie)[0], 401)
        self.assertEqual(self.request('/api/auth/session', cookie=cookie)[1], {"user": None})

    def test_remembered_login_extends_cookie_and_server_session_to_thirty_days(self):
        status, body, cookie = self.request('/api/auth/login', {"email": "alice@example.com", "password": "alice-test-password", "remember": True})
        self.assertEqual(status, 200)
        self.assertIn(f"Max-Age={sessions.REMEMBERED_LIFETIME}", cookie)
        token = cookie.split(';')[0].split('=', 1)[1]
        with store.connect() as db:
            row = db.execute("SELECT expires_at FROM sessions WHERE token_hash=?", (sessions.digest(token),)).fetchone()
        self.assertGreater(row["expires_at"], time.time() + sessions.REMEMBERED_LIFETIME - 5)
        status, _, cookie = self.request('/api/auth/login', {"email": "alice@example.com", "password": "alice-test-password", "remember": False})
        self.assertEqual(status, 200)
        self.assertIn(f"Max-Age={sessions.LIFETIME}", cookie)

    def test_global_location_search_and_scoped_watch_roundtrip(self):
        self.assertEqual(self.request('/api/locations?q=Tokyo')[0], 401)
        cookie, csrf = self.login()
        status, data, _ = self.request('/api/locations?q=Tokyo&kind=city', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertIn('city:TYO', [row['id'] for row in data['locations']])
        body = config() | {'origin':'city:LON', 'destinations':['country:JP','city:TYO','airport:HND']}
        created = self.request('/api/watches', body, cookie, csrf)
        self.assertEqual(created[0], 201)
        state = self.request('/api/state', cookie=cookie)[1]
        watch = next(w for w in state['watches'] if w['id'] == created[1]['id'])
        self.assertEqual(watch['origin_location']['id'], 'city:LON')
        self.assertEqual([row['id'] for row in watch['destination_locations']], body['destinations'])

    def test_discovery_requires_session_csrf_and_hides_other_accounts(self):
        self.assertEqual(self.request('/api/deals', config())[0], 401)
        cookie, csrf = self.login()
        self.assertEqual(self.request('/api/deals', config(), cookie=cookie)[0], 403)
        with patch('app.deal_jobs.TASKS', {}), patch('app.deal_jobs.POOL.submit'):
            status, body, _ = self.request('/api/deals', config(), cookie, csrf)
            self.assertEqual(status, 202)
            self.assertEqual(self.request('/api/deals/'+body['id'], cookie=cookie)[1]['status'], 'running')
            from app import deal_jobs
            self.assertIsNone(deal_jobs.get(body['id'], self.bob['id']))

    def test_location_groups_and_unrestricted_location_lookup(self):
        self.assertEqual(self.request('/api/locations?groups=1')[0],401)
        cookie,_=self.login()
        menu=self.request('/api/locations?groups=1',cookie=cookie)[1]['groups']
        self.assertIn('europe',[row['id'] for row in menu])
        group=self.request('/api/locations?group=europe',cookie=cookie)[1]
        self.assertTrue(group['sections'])
        result=self.request('/api/locations?q=HKG',cookie=cookie)[1]['locations']
        self.assertIn('airport:HKG',[row['id'] for row in result])
        self.assertEqual(self.request('/api/locations?group=missing',cookie=cookie)[0],400)

    def test_location_history_auth_csrf_and_owner_isolation(self):
        self.assertEqual(self.request('/api/location-history')[0], 401)
        cookie, csrf = self.login()
        body = {'role':'destination', 'id':'city:TYO', 'user_id':self.bob['id']}
        self.assertEqual(self.request('/api/location-history', body, cookie=cookie)[0], 403)
        status, data, _ = self.request('/api/location-history', body, cookie, csrf)
        self.assertEqual(status, 200)
        self.assertEqual([r['id'] for r in data['destination']], ['city:TYO'])
        from app import location_history
        self.assertNotIn('city:TYO', [r['id'] for r in location_history.recent(self.bob['id'])['destination']])
        self.assertEqual(self.request('/api/location-history', body | {'id':'invalid'}, cookie, csrf)[0], 400)
        self.assertEqual(self.request('/api/location-history', cookie=cookie)[1], data)


if __name__ == '__main__':
    unittest.main()
