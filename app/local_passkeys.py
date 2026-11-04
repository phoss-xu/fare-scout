"""Password-account passkey enrollment and sign-in; never creates a second account."""
import json
import logging
import shutil
import sqlite3
import subprocess
from pathlib import Path

from . import accounts, passkey_store as keys, sessions, store


def crypto(action, options):
    node = shutil.which('node')
    if not node:
        raise accounts.AuthError('本地通行密钥需要安装 Node.js，并在项目运行 npm ci。', 503)
    try:
        result = subprocess.run([node, str(Path(__file__).with_name('passkey_crypto.mjs'))],
                                input=json.dumps({'action': action, 'options': options}), text=True,
                                capture_output=True, timeout=15, check=False)
        if result.returncode:
            logging.warning('Local passkey operation rejected: %s (exit %s)', action, result.returncode)
            raise accounts.AuthError('通行密钥验证未通过，请重试；首次使用请确认已运行 npm ci。', 400)
        return json.loads(result.stdout)
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError):
        logging.exception('Local passkey verifier unavailable')
        raise accounts.AuthError('本地通行密钥服务暂不可用，请使用密码登录。', 503) from None


def settings(handler):
    if handler.headers.get('Host') != f'localhost:{handler.server.server_port}':
        raise accounts.AuthError(f'请使用 http://localhost:{handler.server.server_port} 登录和绑定通行密钥。', 400)
    return f'http://localhost:{handler.server.server_port}', 'localhost'


def handle(handler, path, data):
    from . import auth_http
    prefix = '/api/auth/passkey/'
    if not path.startswith(prefix):
        return False
    origin, rp_id = settings(handler)
    action = path[len(prefix):]
    if action not in ('bind/options', 'bind/verify', 'login/options', 'login/verify', 'list', 'remove'):
        raise accounts.AuthError('操作不存在。', 404)
    binding = action.startswith('bind/')
    user = auth_http.require(handler, write=True) if binding or action in ('list', 'remove') else None
    if action == 'list':
        return send(handler, {'keys': [{k: r[k] for k in ('credential_id', 'created_at', 'last_used_at')} for r in keys.keys(user['id'], rp_id)]})
    if action == 'remove':
        with store.connect() as db:
            db.execute('DELETE FROM local_passkeys WHERE credential_id=? AND user_id=? AND rp_id=?', (data.get('id'), user['id'], rp_id))
        return send(handler, {'message': '通行密钥已移除，仍可用密码登录。'})
    kind = 'bind' if binding else 'login'
    if action.endswith('/options'):
        accounts.throttle(user['email'] if user else 'passkey-login@localhost.test', handler.client_address[0])
        if binding:
            options = crypto('registrationOptions', {'rpName': 'Fare Scout 本地', 'rpID': rp_id,
                'userName': user['email'], 'userDisplayName': user['name'], 'userID': keys.user_handle(user['id']),
                'attestationType': 'none', 'supportedAlgorithmIDs': [-7], 'timeout': 60000,
                'authenticatorSelection': {'residentKey': 'required', 'userVerification': 'required'},
                'excludeCredentials': [{'id': r['credential_id'], 'transports': json.loads(r['transports'])} for r in keys.keys(user['id'], rp_id)]})
        else:
            options = crypto('authenticationOptions', {'rpID': rp_id, 'userVerification': 'required', 'timeout': 60000})
        token = keys.save_flow(handler, options['challenge'], kind, user['id'] if user else None, origin, rp_id)
        return send(handler, {'options': options}, keys.cookie(token))
    flow = keys.consume(handler, kind, user['id'] if user else None, origin, rp_id)
    response = data.get('response')
    if not isinstance(response, dict) or not isinstance(response.get('id'), str) or len(response['id'])>1400:
        raise accounts.AuthError('设备返回的信息无效。', 400)
    verification = {'response': response, 'expectedChallenge': flow['challenge'],
                    'expectedOrigin': origin, 'expectedRPID': rp_id, 'requireUserVerification': True}
    if binding:
        result = crypto('verifyRegistration', {**verification, 'supportedAlgorithmIDs': [-7]})
        if not result.get('verified') or not result.get('registrationInfo'):
            raise accounts.AuthError('通行密钥验证未通过。', 400)
        try:
            keys.save_key(user['id'], rp_id, result['registrationInfo']['credential'])
        except sqlite3.IntegrityError:
            raise accounts.AuthError('该通行密钥已经绑定，请使用其他密钥。', 409) from None
        return send(handler, {'message': '通行密钥已绑定，下次可直接使用。'}, keys.cookie(''))
    with store.connect() as db:
        key = db.execute('SELECT p.*, u.user_handle FROM local_passkeys p JOIN local_passkey_users u ON u.user_id=p.user_id WHERE credential_id=? AND rp_id=?', (response['id'], rp_id)).fetchone()
    if not key:
        raise accounts.AuthError('未找到此通行密钥，请先使用密码登录并绑定。', 401)
    import base64
    handle = response.get('response', {}).get('userHandle')
    expected = base64.urlsafe_b64encode(key['user_handle'].encode()).decode().rstrip('=')
    if handle and handle != expected:
        raise accounts.AuthError('通行密钥不属于该账号。', 401)
    result = crypto('verifyAuthentication', {**verification, 'credential': {'id': key['credential_id'],
        'publicKey': key['public_key'], 'counter': key['counter'], 'transports': json.loads(key['transports'])}})
    if not result.get('verified'):
        raise accounts.AuthError('通行密钥验证未通过。', 401)
    with store.connect() as db:
        changed = db.execute('UPDATE local_passkeys SET counter=?,last_used_at=? WHERE credential_id=? AND counter=?',
            (result['authenticationInfo']['newCounter'], store.now(), key['credential_id'], key['counter'])).rowcount
        user = db.execute('SELECT * FROM users WHERE id=?', (key['user_id'],)).fetchone()
    if not changed or not user:
        raise accounts.AuthError('登录验证已更新，请重试。', 409)
    remember = data.get('remember') is True
    token, csrf = sessions.issue(user['id'], sessions.token_from_cookie(handler.headers.get('Cookie')), remember)
    return send(handler, {'user': accounts.public_user(user), 'csrf_token': csrf, 'local_passkeys': True},
                [sessions.cookie_header(token, remember=remember), keys.cookie('')])


def send(handler, body, cookie=None):
    handler.send(200, body, cookie=cookie)
    return True
