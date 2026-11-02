"""Generate the Worker discovery menu from the existing Python catalogue definitions."""
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
