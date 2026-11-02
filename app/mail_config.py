"""Local SMTP configuration. Secrets never enter API responses."""
import os
import re
from pathlib import Path

KEYS = ("FARE_SMTP_HOST", "FARE_SMTP_PORT", "FARE_SMTP_SECURITY", "FARE_SMTP_USER",
        "FARE_SMTP_PASSWORD", "FARE_SMTP_FROM", "FARE_SCOUT_EMAIL_TO", "FARE_OWNER_EMAIL", "FARE_COOKIE_SECURE")


def load_local_env():
    path = Path(__file__).resolve().parents[1] / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() in KEYS:
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def valid_email(address):
    return isinstance(address, str) and len(address) <= 254 and bool(re.fullmatch(r"[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+", address))


def configuration(recipient):
    values = {key: os.environ.get(key, "").strip() for key in KEYS}
    sender = values["FARE_SMTP_FROM"] or values["FARE_SMTP_USER"]
    security = values["FARE_SMTP_SECURITY"] or "ssl"
    try:
        port = int(values["FARE_SMTP_PORT"] or (465 if security == "ssl" else 587))
    except ValueError:
        port = 0
    ready = (valid_email(recipient) and valid_email(sender) and bool(values["FARE_SMTP_HOST"])
             and bool(values["FARE_SMTP_USER"]) and bool(values["FARE_SMTP_PASSWORD"])
             and security in ("ssl", "starttls") and 1 <= port <= 65535)
    return dict(ready=bool(ready), recipient=recipient, sender=sender, host=values["FARE_SMTP_HOST"],
                port=port, security=security, user=values["FARE_SMTP_USER"], password=values["FARE_SMTP_PASSWORD"])


def public_status(recipient):
    config = configuration(recipient)
    return dict(recipient=recipient, configured=config["ready"],
                message="邮件服务已就绪" if config["ready"] else "邮件未启用 · 网页提醒可用")
