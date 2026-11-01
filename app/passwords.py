"""Versioned password hashes using the Python standard library."""
import hashlib
import hmac
import secrets

ITERATIONS = 600000


def validate(password):
    if not isinstance(password, str) or not 6 <= len(password) <= 128:
        raise ValueError("密码需为 6–128 个字符，可包含空格和中文。")
    return password


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), ITERATIONS).hex()
    return f"pbkdf2_sha256${ITERATIONS}${salt}${digest}"


DUMMY = hash_password(secrets.token_urlsafe(32))


def verify(password, stored):
    if not isinstance(password, str) or len(password) > 128:
        return False
    algorithm, iterations, salt, expected = (stored or DUMMY).split("$")
    if algorithm != "pbkdf2_sha256":
        raise ValueError("不支持的密码存储格式，请联系维护者。")
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations)).hex()
    return hmac.compare_digest(expected, actual) and stored is not None
