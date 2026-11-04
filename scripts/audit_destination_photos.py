"""Report reviewed photo coverage and remaining featured cities, without network access."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.location_groups import GROUPS
from scripts.update_destination_photos import jpeg_size


def main():
    catalog = json.loads((ROOT / 'app/static/destination-photos.json').read_text())
    locations = json.loads((ROOT / 'app/data/locations.json').read_text())['locations']
    city_records = {r['code']: r for r in locations if r['kind'] == 'city'}
    codes = set(catalog)
    owners = {}
    styles = (ROOT / 'app/static/destination-photos.css').read_text()
    for key, photo in catalog.items():
        city = city_records.get(photo.get('city_code'))
        if not city or photo.get('country_code') != city['country_code'] or photo.get('city_name') != city['name']:
            raise ValueError('Photo scope metadata differs from canonical location: ' + key)
        codes.update(photo.get('airports', []))
        for code in [key, *photo.get('airports', [])]:
            if code in owners and owners[code] != photo['path']:
                raise ValueError('Conflicting photos for airport/city: ' + code)
            owners[code] = photo['path']
        x, y = photo['position']
        rule = f'img[data-destination-photo="{photo["id"]}"]{{object-position:{x}% {y}%}}'
        if rule not in styles:
            raise ValueError('Photo focal point differs from CSS: ' + key)
        path = ROOT / 'app/static' / photo['path'].lstrip('/')
        width, height = jpeg_size(path.read_bytes())
        if (width, height) != (photo['width'], photo['height']):
            raise ValueError('Catalog dimensions differ from file: ' + key)
        if width < 1600 or height < 800:
            raise ValueError('Photo below HD target: ' + key)
    featured = set()
    for identity, label, cities, _ in GROUPS:
        if not cities:
            continue
        group = set(cities.split())
        featured.update(group)
        missing = sorted(group - codes)
        print(f'{label}: {len(group & codes)}/{len(group)}; missing: {" ".join(missing) or "none"}')
    cities = {r['code'] for r in locations if r['kind'] == 'city'}
    airports = {r['code'] for r in locations if r['kind'] == 'airport'}
    countries = {r['code'] for r in locations if r['kind'] == 'country'}
    print(f'Reviewed destinations: {len({p["path"] for p in catalog.values()})}')
    print(f'Featured cities: {len(featured & codes)}/{len(featured)}')
    print(f'All searchable cities: {len(cities & codes)}/{len(cities)}')
    print(f'Airport entries covered: {len(airports & codes)}/{len(airports)}')
    print(f'Country scopes with reviewed city examples: {len(countries & {p["country_code"] for p in catalog.values()})}/{len(countries)}')
    print('Coverage is a photo catalog measure, not route or fare availability.')


if __name__ == '__main__':
    main()
