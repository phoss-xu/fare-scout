"""Loopback-only local UI and JSON API. Run with python3 -m app.server."""
import argparse
import json
import logging
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from . import accounts, auth_http, deal_jobs, location_groups, location_history, locations, mail_config, mail_delivery, presenter, scheduler, store, worker, removals
from .domain import jobs, today, validate

STATIC = Path(__file__).with_name("static")


class Handler(BaseHTTPRequestHandler):
    def send(self, status, body, content_type="application/json; charset=utf-8", cookie=None):
        content = json.dumps(body, ensure_ascii=False).encode() if isinstance(body, dict) else body
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://images.unsplash.com; connect-src 'self' https://api.frankfurter.dev https://images.unsplash.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        if not self.valid_host():
            return self.send(403, {"error": "请使用本机地址访问。"})
        path = urlsplit(self.path).path
        if path == "/api/auth/session":
            return self.send(200, auth_http.current(self) or {"user": None})
        if path in ("/api/state", "/api/locations", "/api/location-history") or path.startswith('/api/deals/'):
            try:
                user = auth_http.require(self)
            except accounts.AuthError as exc:
                return self.send(exc.status, {"error": str(exc)})
            if path == "/api/state":
                return self.send(200, presenter.state(user))
            if path == '/api/location-history':
                return self.send(200, location_history.recent(user['id']))
            if path.startswith('/api/deals/'):
                result = deal_jobs.get(path.rsplit('/', 1)[-1], user['id'])
                return self.send(200, result) if result else self.send(404, {'error':'这份搜索不存在或已过期，请重新搜索。'})
            query = parse_qs(urlsplit(self.path).query)
            try:
                if query.get('groups'):
                    return self.send(200, {'groups':location_groups.menu()})
                if query.get('group'):
                    return self.send(200, location_groups.group(query['group'][0]))
                if query.get("id"):
                    return self.send(200, {"location": locations.resolve(query["id"][0])})
                return self.send(200, {"locations": locations.search(query.get("q", [""])[0], query.get("kind", [""])[0])})
            except ValueError as exc:
                return self.send(400, {"error": str(exc)})
        files = {"/": ("index.html", "text/html"), "/app.js": ("app.js", "text/javascript"),
                 "/setup": ("index.html", "text/html"), "/auth.js": ("auth.js", "text/javascript"),
                 "/auth.css": ("auth.css", "text/css"),
                 "/flights.js": ("flights.js", "text/javascript"), "/format.js": ("format.js", "text/javascript"),
                 "/flights.css": ("flights.css", "text/css"),
                 "/locations.js": ("locations.js", "text/javascript"), "/locations.css": ("locations.css", "text/css"),
                 "/location_history.js": ("location_history.js", "text/javascript"),
                 "/deals.js": ("deals.js", "text/javascript"), "/deal_views.js": ("deal_views.js", "text/javascript"),
                 "/deals.css": ("deals.css", "text/css"),
                 "/departure.css": ("departure.css", "text/css"),
                 "/search-panels.css": ("search-panels.css", "text/css"),
                 "/holidays.js": ("holidays.js", "text/javascript"), "/holidays.css": ("holidays.css", "text/css"),
                 "/holidays.json": ("holidays.json", "application/json"),
                 "/ui.js": ("ui.js", "text/javascript"),
                 "/journey.js": ("journey.js", "text/javascript"),
                 "/landscape.js": ("landscape.js", "text/javascript"),
                 "/world-backdrop.js": ("world-backdrop.js", "text/javascript"),
                 "/world-backdrop.css": ("world-backdrop.css", "text/css"),
                 "/landscape.css": ("landscape.css", "text/css"),
                 "/getaway.css": ("getaway.css", "text/css"),
                 "/landscape-data.js": ("landscape-data.js", "text/javascript"),
                 "/landscape-rotation.js": ("landscape-rotation.js", "text/javascript"),
                 "/appearance.js": ("appearance.js", "text/javascript"),
                 "/appearance-store.js": ("appearance-store.js", "text/javascript"),
                 "/theme-init.js": ("theme-init.js", "text/javascript"),
                 "/themes.css": ("themes.css", "text/css"),
                 "/appearance.css": ("appearance.css", "text/css"),
                 "/settings.css": ("settings.css", "text/css"),
                 "/assets/coast-dawn.jpg": ("assets/coast-dawn.jpg", "image/jpeg"),
                 "/nights.js": ("nights.js", "text/javascript"), "/nights.css": ("nights.css", "text/css"),
                 "/location_browser.js": ("location_browser.js", "text/javascript"),
                 "/location_browser.css": ("location_browser.css", "text/css"),
                 "/api.js": ("api.js", "text/javascript"), "/views.js": ("views.js", "text/javascript"),
                 "/automation.js": ("automation.js", "text/javascript"),
                 "/daily.js": ("daily.js", "text/javascript"),
                 "/daily.css": ("daily.css", "text/css"),
                 "/automation.css": ("automation.css", "text/css"),
                 "/style.css": ("style.css", "text/css")}
        files.update({f"/{name}.js": (f"{name}.js", "text/javascript") for name in ("landscape-provider", "landscape-actions", "email-settings", "preferences", "exchange-rates", "currency", "i18n", "settings")})
        files.update({f"/assets/places/{name}.jpg": (f"assets/places/{name}.jpg", "image/jpeg") for name in ("beach", "forest", "rice", "city", "sculpture", "harbour", "harbour.thumb", "beach.thumb", "forest.thumb", "rice.thumb", "city.thumb", "sculpture.thumb")})
        files.update({f"/assets/manrope-{weight}.ttf": (f"assets/manrope-{weight}.ttf", "font/ttf") for weight in (400, 500, 600, 700)})
        files["/assets/fare-scout-serif-vf.woff2"] = ("assets/fare-scout-serif-vf.woff2", "font/woff2")
        files["/assets/fare-scout-sans-vf.woff2"] = ("assets/fare-scout-sans-vf.woff2", "font/woff2")
        files["/assets/airplane-tilt.svg"] = ("assets/airplane-tilt.svg", "image/svg+xml")
        files["/assets/im-fell-english-400.ttf"] = ("assets/im-fell-english-400.ttf", "font/ttf")
        if path not in files:
            return self.send(404, {"error": "页面不存在。"})
        filename, kind = files[path]
        self.send(200, (STATIC / filename).read_bytes(), kind + "; charset=utf-8")

    def do_POST(self):
        # JSON-only API plus same-origin checks prevent cross-site form submissions.
        if not self.valid_host() or self.headers.get("Origin") not in (None, f"http://{self.headers.get('Host')}") or self.headers.get("Sec-Fetch-Site") == "cross-site":
            return self.send(403, {"error": "请从本地网页发起操作。"})
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.send(415, {"error": "请求格式不正确，请刷新页面重试。"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 16000:
                raise ValueError("请求内容大小不正确。")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("请检查监控条件。")
            if auth_http.handle(self, self.path, data):
                return
            user = auth_http.require(self, write=True)
            user_id = user["id"]
            if self.path == '/api/location-history':
                return self.send(200, location_history.remember(user_id, data.get('role'), data.get('id')))
            if self.path == '/api/deals':
                return self.send(202, {'id':deal_jobs.start(user_id, data)})
            if self.path == "/api/watches":
                return self.send(201, {"id": store.create(validate(data), user_id)})
            if self.path == "/api/alerts/read":
                store.mark_read(data.get("through_id"), user_id)
                return self.send(200, {"message": "提醒已标为已读。"})
            if self.path == "/api/email":
                store.set_recipient(data.get("recipient"), user_id)
                return self.send(200, {"message": "收件邮箱已保存。"})
            parts = self.path.strip("/").split("/")
            if len(parts) == 4 and parts[0] == 'api' and parts[1] in ('watches','offers') and parts[3] in ('delete','restore'):
                if not parts[2].isdigit() or not removals.change(parts[1],int(parts[2]),user_id,parts[3]=='restore'):
                    return self.send(404, {'error':'这条记录不存在。'})
                return self.send(200, {'message':'已恢复。' if parts[3]=='restore' else '已删除，可在最近删除中恢复。'})
            if len(parts) == 4 and parts[:2] == ["api", "watches"] and parts[3] == "settings":
                if not parts[2].isdigit() or not store.update_settings(int(parts[2]), data, user_id):
                    return self.send(404, {"error": "这条监控不存在。"})
                return self.send(200, {"message": "自动查价与提醒设置已保存。"})
            if len(parts) == 4 and parts[:2] == ["api", "watches"] and parts[3] == "check":
                watch_id = int(parts[2]) if parts[2].isdigit() else 0
                watch = store.watch(watch_id, user_id)
                if not watch:
                    return self.send(404, {"error": "这条监控不存在。"})
                if not any(j["departure"] >= today().isoformat() for j in jobs(watch)):
                    raise ValueError("这条监控的出行日期已过，请新建监控。")
                if not worker.submit(watch_id):
                    return self.send(409, {"error": "这条监控正在查询，请稍候。"})
                return self.send(202, {"message": "已加入查价队列。"})
            return self.send(404, {"error": "操作不存在。"})
        except accounts.AuthError as exc:
            self.send(exc.status, {"error": str(exc)})
        except (ValueError, TypeError) as exc:
            message = str(exc) if type(exc) is ValueError and not isinstance(exc, json.JSONDecodeError) else "请求内容无效，请检查后重试。"
            self.send(400, {"error": message})
        except Exception:
            logging.exception("Local API request failed")
            self.send(500, {"error": "暂时无法完成操作，请稍后重试。"})

    def valid_host(self):
        port = self.server.server_port
        return self.headers.get("Host") in {f"127.0.0.1:{port}", f"localhost:{port}"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    mail_config.load_local_env()
    store.initialize()
    owner = os.environ.get("FARE_OWNER_EMAIL")
    if owner:
        accounts.migrate_legacy(owner)
        token = accounts.setup_token(owner, replace=False)
        if token:
            print(f"本机账号初始化（2 小时内有效）：http://127.0.0.1:{args.port}/setup#token={token}", flush=True)
    timer = scheduler.Scheduler()
    mailer = scheduler.Scheduler(callback=mail_delivery.tick, name="fare-mailer")
    timer.start()
    mailer.start()
    print(f"Fare Scout · http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("Stopping local Fare Scout service")
    finally:
        timer.stop()
        mailer.stop()
        worker.POOL.shutdown(wait=True, cancel_futures=True)
        deal_jobs.POOL.shutdown(wait=True, cancel_futures=True)
        server.server_close()


if __name__ == "__main__":
    main()
