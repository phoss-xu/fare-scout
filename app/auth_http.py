"""Authentication routes and session guard shared by API handlers."""
import os

from . import accounts, sessions


def current(handler):
    return sessions.current(sessions.token_from_cookie(handler.headers.get("Cookie")))


def require(handler, write=False):
    session = current(handler)
    if not session:
        raise accounts.AuthError("请先登录。")
    if write and not sessions.valid_csrf(session, handler.headers.get("X-CSRF-Token")):
        raise accounts.AuthError("登录信息已更新，请刷新页面后再试。", 403)
    return session["user"]


def handle(handler, path, data):
    if path not in {"/api/auth/register", "/api/auth/login", "/api/auth/activate", "/api/auth/logout"}:
        return False
    old_token = sessions.token_from_cookie(handler.headers.get("Cookie"))
    secure = os.environ.get("FARE_COOKIE_SECURE") == "1"
    if path == "/api/auth/logout":
        require(handler, write=True)
        sessions.revoke(old_token)
        handler.send(200, {"message": "已退出登录。"}, cookie=sessions.cookie_header("", secure))
        return True
    accounts.throttle(data.get("email") if path != "/api/auth/activate" else "setup@localhost.test", handler.client_address[0])
    action = {"/api/auth/register": accounts.register, "/api/auth/login": accounts.login,
              "/api/auth/activate": accounts.activate}[path]
    user = action(data)
    remember = data.get("remember") is True
    token, csrf = sessions.issue(user["id"], old_token, remember)
    handler.send(200, {"user": user, "csrf_token": csrf}, cookie=sessions.cookie_header(token, secure, remember))
    return True
