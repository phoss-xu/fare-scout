"""Prepare an offline, two-hour activation capability for an existing password-less D1 account."""
import argparse
import hashlib
import os
from pathlib import Path
import secrets
import sqlite3
import time
from urllib.parse import urlsplit


def prepare(email, base_url, output):
    from app.accounts import canonical_email
    email = canonical_email(email)
    url = urlsplit(base_url)
    if url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1')):
        raise ValueError('初始化入口需使用 HTTPS 或本机 HTTP 地址。')
    if url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise ValueError('请仅填写网站根地址。')
    output = Path(output)
    token = secrets.token_urlsafe(32)
    link_file = output.with_suffix('.link.txt')
    if output.exists() or link_file.exists():
        raise ValueError('输出文件已存在，请使用新文件名。')
    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(':memory:')
    quote = lambda value: db.execute('SELECT quote(?)', (value,)).fetchone()[0]
    sql = f"DELETE FROM setup_tokens WHERE user_id IN (SELECT id FROM users WHERE email={quote(email)} AND password_hash IS NULL);\n"
    sql += f"INSERT INTO setup_tokens(token_hash,user_id,expires_at) SELECT {quote(hashlib.sha256(token.encode()).hexdigest())},id,{time.time()+7200} FROM users WHERE email={quote(email)} AND password_hash IS NULL;\n"
    for path, content in ((output, sql), (link_file, base_url.rstrip('/') + '/setup#token=' + token + '\n')):
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as file:
            file.write(content)
    db.close()
    return link_file


if __name__ == '__main__':
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--email', required=True)
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        link = prepare(args.email, args.base_url, args.output)
    except (ValueError, OSError) as exc:
        parser.exit(1, f'未生成初始化入口：{exc}\n')
    print(f'仅生成离线 SQL；尚未执行。私密初始化链接保存在 {link}，SQL 应用后可用。')
