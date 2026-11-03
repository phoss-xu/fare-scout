"""Validate a runtime email token and save it privately; never deploy or send email."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SECRET_FILE = ROOT / '.env.email-secrets'
TOKEN_FORMAT = re.compile(r'[A-Za-z0-9_-]{20,512}')


class SetupError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def validate_token(token):
    if not isinstance(token, str) or not TOKEN_FORMAT.fullmatch(token):
        raise SetupError('Token 格式不正确，请复制完整的 Token。')
    config = json.loads((ROOT / 'wrangler.jsonc').read_text())
    account = config['vars']['CF_EMAIL_ACCOUNT_ID']
    if not re.fullmatch(r'[a-f0-9]{32}', account):
        raise SetupError('项目 Cloudflare 账号配置不正确。')
    url = f'https://api.cloudflare.com/client/v4/accounts/{account}/email/routing/addresses?per_page=5'
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=20) as response:
            payload = response.read(1048577)
        if len(payload) > 1048576:
            raise SetupError('Cloudflare 响应异常，未保存 Token。')
        data = json.loads(payload)
    except urllib.error.HTTPError as error:
        raise SetupError(f'Cloudflare 拒绝访问（HTTP {error.code}），请核对账号与目标地址管理权限。') from None
    except (OSError, ValueError):
        raise SetupError('暂时无法连接或读取 Cloudflare 响应，未保存 Token，请稍后重试。') from None
    if not isinstance(data, dict) or data.get('success') is not True or not isinstance(data.get('result'), list):
        raise SetupError('Cloudflare 未确认访问成功，未保存 Token。')


def save_token(token):
    # Require the secret path to be ignored even if the repository conventions change.
    ignored = subprocess.run(['git', 'check-ignore', '--quiet', SECRET_FILE.name], cwd=ROOT, check=False)
    if ignored.returncode != 0:
        raise SetupError('私密文件未被 Git 忽略，已停止保存。')
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    try:
        fd = os.open(SECRET_FILE, flags, 0o600)
    except FileExistsError:
        raise SetupError('私密文件已存在，未覆盖；使用 --check 检查现有 Token。') from None
    with os.fdopen(fd, 'w') as file:
        file.write('CF_EMAIL_API_TOKEN=' + token + '\n')


def read_token():
    try:
        fd = os.open(SECRET_FILE, os.O_RDONLY | os.O_NOFOLLOW)
    except OSError:
        raise SetupError('无法打开私密文件；请先运行不带 --check 的命令录入 Token。') from None
    with os.fdopen(fd) as file:
        info = os.fstat(file.fileno())
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600:
            raise SetupError('私密文件应为普通文件且权限为 600，请先检查文件权限。')
        value = file.read(2048).strip()
    match = re.fullmatch(r'CF_EMAIL_API_TOKEN=([A-Za-z0-9_-]{20,512})', value)
    if not match:
        raise SetupError('私密文件格式不正确。')
    return match[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Only validate the saved token without displaying it')
    args = parser.parse_args()
    try:
        if args.check:
            token = read_token()
        else:
            if SECRET_FILE.exists() or SECRET_FILE.is_symlink():
                raise SetupError('私密文件已存在，未覆盖；使用 --check 检查现有 Token。')
            if not sys.stdin.isatty():
                raise SetupError('请在本机交互终端运行；不接受聊天、命令参数或管道中的 Token。')
            token = getpass.getpass('粘贴 Cloudflare Token 后回车（输入不会显示）：').strip()
        validate_token(token)
        if not args.check:
            save_token(token)
        print('目标账号的邮箱地址读取已验证。写入权限请以 Token 审核摘要为准。')
        print('Token 已保存在 Git 忽略的 .env.email-secrets，权限 600；未显示密钥。')
        print('没有部署、修改 DNS、创建收件地址或发送邮件。可以回复助手“Token 已保存”。')
    except (SetupError, KeyboardInterrupt, EOFError) as error:
        print('未完成配置：' + (str(error) if isinstance(error, SetupError) else '操作已取消。'), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
