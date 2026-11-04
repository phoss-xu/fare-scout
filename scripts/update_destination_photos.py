"""Restore curated photos without changing the reviewed source selection.

Run without arguments to download missing files; pass airport/city keys to limit
work, or --force to restore existing files. Authors and licenses are in the
catalog. Downloads are validated before an atomic replacement.
"""
import argparse
import json
import struct
import urllib.request
from urllib.parse import urlsplit
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'app/static'


def photo_download_url(photo):
    """Use a reviewed Commons file URL or the catalog's Unsplash rendition."""
    if 'download_url' in photo:
        url = photo['download_url']
        parsed = urlsplit(url)
        if (parsed.scheme != 'https' or parsed.netloc not in
                {'upload.wikimedia.org', 'thumb.wikimedia.org'} or
                not parsed.path.startswith('/wikipedia/commons/')):
            raise ValueError('Unsupported photo download URL')
        return url
    return (f"https://images.unsplash.com/{photo['cdn_id']}"
            f"?auto=format&fm=jpg&w={photo['width']}&q=85")


def jpeg_size(data):
    """Read JPEG dimensions without an imaging dependency."""
    if not data.startswith(b'\xff\xd8'):
        raise ValueError('Not a JPEG image')
    offset = 2
    while offset < len(data):
        if data[offset] != 255:
            raise ValueError('Invalid JPEG marker')
        while data[offset] == 255:
            offset += 1
        marker = data[offset]
        offset += 1
        if marker in (0xd9, 0xda):
            break
        size = struct.unpack('>H', data[offset:offset + 2])[0]
        if marker in (0xc0, 0xc1, 0xc2):
            height, width = struct.unpack('>HH', data[offset + 3:offset + 7])
            return width, height
        offset += size
    raise ValueError('JPEG dimensions unavailable')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('codes', nargs='*')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    rows = json.loads((ROOT / 'destination-photos.json').read_text())
    unknown = set(args.codes) - set(rows)
    if unknown:
        parser.error('Unknown catalog keys: ' + ', '.join(sorted(unknown)))
    saved = set()
    for code, photo in rows.items():
        if args.codes and code not in args.codes:
            continue
        path = ROOT / photo['path'].lstrip('/')
        if path in saved or (path.exists() and not args.force):
            continue
        if not path.resolve().is_relative_to((ROOT / 'assets/destinations').resolve()):
            raise ValueError('Photo path outside destination assets: ' + code)
        request = urllib.request.Request(
            photo_download_url(photo),
            headers={'User-Agent': 'FareScoutPhotoCatalog/1.0'})
        with urllib.request.urlopen(request, timeout=45) as response:
            if response.headers.get_content_type() != 'image/jpeg':
                raise ValueError('Unexpected photo format for ' + code)
            data = response.read()
        width, height = jpeg_size(data)
        if width < 1600 or height < 800:
            raise ValueError('Photo below required resolution: ' + code)
        if (width, height) != (photo['width'], photo['height']):
            raise ValueError('Photo dimensions differ from reviewed catalog: ' + code)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix('.download')
        temporary.write_bytes(data)
        temporary.replace(path)
        saved.add(path)
        print(code, width, height, len(data), flush=True)


if __name__ == '__main__':
    main()
