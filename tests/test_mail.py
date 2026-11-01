import os
import smtplib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import mail_delivery, store
from app.domain import jobs
from app.mail_config import configuration
from test_app import config

SMTP = {"FARE_SMTP_HOST": "smtp.example.com", "FARE_SMTP_USER": "sender@example.com",
        "FARE_SMTP_PASSWORD": "test-only-secret", "FARE_SMTP_FROM": "sender@example.com"}


class MailTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(store, "DB", Path(self.temp.name) / "mail.db")
        self.db_patch.start()
        self.env_patch = patch.dict(os.environ, SMTP, clear=True)
        self.env_patch.start()
        store.initialize()
        store.set_recipient("recipient@example.com")
        self.watch_id = store.create(config())
        self.job = jobs(store.watch(self.watch_id))[0]
        store.observe(self.watch_id, self.job, "ok", {"price": 3000})
        store.observe(self.watch_id, self.job, "ok", {"price": 2500, "bookingUrl": "https://kiwi.com/test"})

    def tearDown(self):
        self.env_patch.stop()
        self.db_patch.stop()
        self.temp.cleanup()

    def test_no_config_means_no_send_and_no_attempt_used(self):
        with patch.dict(os.environ, {"FARE_SMTP_PASSWORD": ""}), patch.object(mail_delivery, "send_email") as send:
            mail_delivery.tick()
        send.assert_not_called()
        self.assertEqual(store.snapshot()["alerts"][0]["email_status"], "waiting_config")

    def test_smtp_message_recipient_and_sent_state(self):
        with patch.object(smtplib, "SMTP_SSL") as smtp:
            mail_delivery.tick()
            mail_delivery.tick()
        client = smtp.return_value
        self.assertEqual(client.send_message.call_count, 1)
        message = client.send_message.call_args.args[0]
        self.assertEqual(message["To"], "recipient@example.com")
        self.assertIn("HK$2500", message.get_content())
        self.assertIn("https://kiwi.com/test", message.get_content())
        self.assertEqual(store.snapshot()["alerts"][0]["email_status"], "sent")
        self.assertNotIn("test-only-secret", str(store.snapshot()))

    def test_delivery_failure_retries_then_succeeds_without_losing_alert(self):
        with patch.object(mail_delivery, "send_email", side_effect=OSError), self.assertLogs(mail_delivery.LOG):
            mail_delivery.tick()
        self.assertEqual(store.snapshot()["alerts"][0]["email_status"], "retry")
        with patch.object(mail_delivery, "send_email") as send:
            mail_delivery.tick()
        send.assert_not_called()
        with store.connect() as db:
            db.execute("UPDATE email_outbox SET next_attempt='2000-01-01'")
        with patch.object(mail_delivery, "send_email") as send:
            mail_delivery.tick()
        send.assert_called_once()
        self.assertEqual(store.snapshot()["alerts"][0]["email_status"], "sent")

    def test_maximum_attempts_and_disabled_reminders(self):
        with store.connect() as db:
            db.execute("UPDATE email_outbox SET attempts=4")
        with patch.object(mail_delivery, "send_email", side_effect=OSError), self.assertLogs(mail_delivery.LOG):
            mail_delivery.tick()
        self.assertEqual(store.snapshot()["alerts"][0]["email_status"], "failed")
        with store.connect() as db:
            db.execute("UPDATE email_outbox SET status='pending',next_attempt='2000-01-01'")
        store.update_settings(self.watch_id, {"alerts_enabled": False})
        with patch.object(mail_delivery, "send_email") as send:
            mail_delivery.tick()
        send.assert_not_called()
        self.assertEqual(store.snapshot()["alerts"][0]["email_status"], "skipped")

    def test_address_validation_and_starttls(self):
        with self.assertRaises(ValueError):
            store.set_recipient("bad\r\nBcc: somebody@example.com")
        with patch.dict(os.environ, {"FARE_SMTP_SECURITY": "starttls"}), patch.object(smtplib, "SMTP") as smtp:
            mail_delivery.tick()
        smtp.return_value.starttls.assert_called_once()
        self.assertTrue(configuration("recipient@example.com")["ready"])


if __name__ == "__main__":
    unittest.main()
