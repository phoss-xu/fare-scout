"""No real API calls, tokens or remote writes in these setup-tool tests."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('email_setup', Path(__file__).resolve().parents[1] / 'scripts/configure_cloudflare_email.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class EmailSetupTests(unittest.TestCase):
    def test_private_file_roundtrip_refuses_overwrite_and_symlink(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / '.env.email-secrets'
            with patch.object(setup, 'SECRET_FILE', path):
                setup.save_token('local-test-token-that-is-not-real')
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)
                self.assertEqual(setup.read_token(), 'local-test-token-that-is-not-real')
                with self.assertRaises(setup.SetupError):
                    setup.save_token('another-local-test-token')
                path.chmod(0o644)
                with self.assertRaises(setup.SetupError):
                    setup.read_token()
                target = Path(directory) / 'target'
                target.write_text('unchanged')
                path.unlink()
                path.symlink_to(target)
                with self.assertRaises(setup.SetupError):
                    setup.read_token()
                with self.assertRaises(setup.SetupError):
                    setup.save_token('another-local-test-token')
                self.assertEqual(target.read_text(), 'unchanged')

    def test_control_characters_rejected_before_network_access(self):
        with patch.object(setup.urllib.request, 'build_opener') as opener:
            with self.assertRaises(setup.SetupError):
                setup.validate_token('test-only-token-with-newline\nextra')
            opener.assert_not_called()

    def test_file_must_be_git_ignored(self):
        with patch.object(setup.subprocess, 'run') as run:
            run.return_value.returncode = 1
            with self.assertRaises(setup.SetupError):
                setup.save_token('local-test-token-that-is-not-real')

    def test_redirect_does_not_forward_authorization_to_another_host(self):
        self.assertIsNone(setup.NoRedirect().redirect_request(None, None, 302, None, {}, 'https://other.example.test'))


if __name__ == '__main__':
    unittest.main()
