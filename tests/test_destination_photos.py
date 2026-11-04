"""Exercise photo restoration in a temporary asset tree; never contact the CDN."""
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts import update_destination_photos as photos


class PhotoRestorationTests(unittest.TestCase):
    def setUp(self):
        catalog = json.loads((photos.ROOT / 'destination-photos.json').read_text())
        self.photo = catalog['ADD']
        self.original = (photos.ROOT / self.photo['path'].lstrip('/')).read_bytes()
        self.other = (photos.ROOT / catalog['HKG']['path'].lstrip('/')).read_bytes()
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        (self.root / 'destination-photos.json').write_text(json.dumps({'ADD': self.photo}))
        self.target = self.root / self.photo['path'].lstrip('/')

    def restore(self, data):
        response = MagicMock()
        response.__enter__.return_value = response
        response.headers.get_content_type.return_value = 'image/jpeg'
        response.read.return_value = data
        with patch.object(photos, 'ROOT', self.root), patch('sys.argv', ['restore', 'ADD']), \
                patch.object(photos.urllib.request, 'urlopen', return_value=response) as download, \
                contextlib.redirect_stdout(io.StringIO()):
            photos.main()
        return download

    def test_restores_the_reviewed_panorama_resolution(self):
        download = self.restore(self.original)
        self.assertIn('w=1800', download.call_args.args[0].full_url)
        self.assertEqual(self.target.read_bytes(), self.original)
        self.assertEqual(photos.jpeg_size(self.target.read_bytes()), (1800, 810))

    def test_a_different_hd_image_does_not_replace_the_reviewed_dimensions(self):
        with self.assertRaisesRegex(ValueError, 'dimensions differ'):
            self.restore(self.other)
        self.assertFalse(self.target.exists())
        self.assertFalse(self.target.with_suffix('.download').exists())

    def test_existing_local_selection_is_untouched_without_force(self):
        self.target.parent.mkdir(parents=True)
        self.target.write_bytes(b'existing local test selection')
        download = self.restore(self.original)
        download.assert_not_called()
        self.assertEqual(self.target.read_bytes(), b'existing local test selection')

    def test_commons_restores_the_fixed_reviewed_url_without_an_unsplash_id(self):
        photo = {key: value for key, value in self.photo.items() if key != 'cdn_id'}
        url = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/reviewed.jpg'
        photo['download_url'] = url
        (self.root / 'destination-photos.json').write_text(json.dumps({'ADD': photo}))
        download = self.restore(self.original)
        self.assertEqual(download.call_args.args[0].full_url, url)
        self.assertEqual(self.target.read_bytes(), self.original)

    def test_unsupported_file_urls_fail_before_requesting_or_writing(self):
        for url in ['file:///etc/passwd', 'http://upload.wikimedia.org/wikipedia/commons/a.jpg',
                    'https://upload.wikimedia.org.example.com/wikipedia/commons/a.jpg',
                    'https://upload.wikimedia.org/other/a.jpg']:
            with self.subTest(url=url):
                photo = dict(self.photo, download_url=url)
                (self.root / 'destination-photos.json').write_text(json.dumps({'ADD': photo}))
                with self.assertRaisesRegex(ValueError, 'Unsupported photo download URL'):
                    self.restore(self.original)
                self.assertFalse(self.target.exists())
