"""Durable SMTP outbox; bounded retries and no network activity without configuration."""
import logging
import json
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from zoneinfo import ZoneInfo

from . import store
from .domain import today
from .locations import label as location_label
from .mail_config import configuration

LOG = logging.getLogger(__name__)


def send_email(config, alert, watch):
    message = EmailMessage()
    destination = location_label(alert["destination"])
    origin = json.loads(alert["route_key"])[0] if alert.get("route_key") else watch["origin"]
    label = "进入预算" if alert["reason"] == "budget" else "机票降价"
    message["Subject"] = f"Fare Scout · {origin} → {destination} {label} · HK${alert['price']:g}"
    message["From"] = config["sender"]
    message["To"] = config["recipient"]
    # Stable ID also helps providers deduplicate ambiguous post-DATA disconnects.
    message["Message-ID"] = f"<fare-scout-{alert['id']}-{alert['created_at'].replace(':', '')}@{config['sender'].split('@')[-1]}>"
    previous = f"上次有效报价：HK${alert['previous_price']:g}\n" if alert["previous_price"] is not None else "首次采样进入预算。\n"
    returning = "返程抵达日期" if watch["mode"] == "weekend" else "返程起飞日期"
    sampled = datetime.fromisoformat(alert["created_at"]).astimezone(ZoneInfo("Asia/Shanghai")).isoformat(timespec="minutes")
    message.set_content(f"{origin} → {destination}\n出发日期：{alert['departure']}\n{returning}：{alert['arrival']}\n"
                        f"{watch['adults']} 位成人 · 经济舱 · 往返总价 HK${alert['price']:g}\n{previous}"
                        f"采样时间：{sampled}\n核价链接：{alert['booking_url'] or '暂无，请在网页重新查价'}\n\n"
                        "报价可能变化，请在预订前重新核价。记录来自有限查询结果，不代表完整市场最低价。\n"
                        "可在 Fare Scout 本地网页的「自动查价与提醒」中暂停提醒。")
    context = ssl.create_default_context()
    if config["security"] == "ssl":
        client = smtplib.SMTP_SSL(config["host"], config["port"], timeout=20, context=context)
    else:
        client = smtplib.SMTP(config["host"], config["port"], timeout=20)
    with client:
        if config["security"] == "starttls":
            client.ehlo()
            client.starttls(context=context)
            client.ehlo()
        client.login(config["user"], config["password"])
        client.send_message(message)


def tick():
    timestamp = store.now()
    with store.connect() as db:
        rows = [dict(r) for r in db.execute("""SELECT a.*, q.attempts FROM email_outbox q JOIN alerts a ON a.id=q.alert_id
            JOIN watches w ON w.id=a.watch_id LEFT JOIN users u ON u.id=w.owner_id
            WHERE q.status IN ('pending','retry','waiting_config') AND q.next_attempt<=?
            AND (w.owner_id IS NULL OR u.password_hash IS NOT NULL)
            ORDER BY a.id LIMIT 3""", (timestamp,))]
    for alert in rows:
        watch = store.watch(alert["watch_id"])
        config = configuration(store.email_recipient(watch["owner_id"]))
        age = datetime.now(timezone.utc) - datetime.fromisoformat(alert["created_at"])
        if age > timedelta(hours=24) or alert["departure"] < today().isoformat() or not watch["alerts_enabled"]:
            with store.connect() as db:
                db.execute("UPDATE email_outbox SET status='skipped' WHERE alert_id=?", (alert["id"],))
            continue
        if not config["ready"]:
            with store.connect() as db:
                db.execute("UPDATE email_outbox SET status='waiting_config' WHERE alert_id=?", (alert["id"],))
            continue
        attempt = alert["attempts"] + 1
        try:
            send_email(config, alert, watch)
        except Exception as exc:
            # Log the category, never SMTP credentials or authentication payloads.
            LOG.warning("Email delivery failed for alert %s: %s", alert["id"], type(exc).__name__)
            due = (datetime.now(timezone.utc) + timedelta(minutes=min(60, 2 ** attempt))).isoformat()
            with store.connect() as db:
                db.execute("""UPDATE email_outbox SET status=?,attempts=?,next_attempt=? WHERE alert_id=?""",
                           ("failed" if attempt >= 5 else "retry", attempt, due, alert["id"]))
        else:
            with store.connect() as db:
                db.execute("UPDATE email_outbox SET status='sent',attempts=?,sent_at=? WHERE alert_id=?",
                           (attempt, store.now(), alert["id"]))
