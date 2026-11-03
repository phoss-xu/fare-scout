"""Generate the Worker discovery menu and browser location names from the shared catalogue."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app import location_groups

output = ROOT / 'cloudflare/src/groups.json'
content = json.dumps({key: location_groups.group(key) for key, _, _, _ in location_groups.GROUPS},
                     ensure_ascii=False, separators=(',', ':')) + '\n'
if not output.exists() or output.read_text() != content:
    output.write_text(content)

from app.locations import catalogue
records = catalogue()[0]
labels = {r['code']: [r['city_name'], records.get('city:'+r['city_code'], {}).get('english_name', r['city_name']), r['name'], r['english_name']] for r in records.values() if r['kind']=='airport'}
(ROOT / 'app/static/location-names.json').write_text(json.dumps(labels, ensure_ascii=False, separators=(',', ':')))
