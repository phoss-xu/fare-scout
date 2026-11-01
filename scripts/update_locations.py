"""Refresh public Travelpayouts reference data; no fare queries or credentials."""
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / "app" / "data" / "locations.json"


def fetch(kind):
    url = f"https://api.travelpayouts.com/data/zh-CN/{kind}.json"
    with urllib.request.urlopen(url, timeout=45) as response:
        rows = json.load(response)
    if not isinstance(rows, list) or len(rows) < 100:
        raise RuntimeError(f"Unexpected reference response for {kind}")
    return kind, rows


def main():
    with ThreadPoolExecutor(max_workers=3) as pool:
        source = dict(pool.map(fetch, ["countries", "cities", "airports"]))
    records = []
    for plural, singular in [("countries", "country"), ("cities", "city"), ("airports", "airport")]:
        for row in source[plural]:
            code = row.get("code", "")
            if not re.fullmatch("[A-Z]{2}" if singular == "country" else "[A-Z]{3}", code):
                continue
            if singular == "airport" and row.get("iata_type") != "airport":
                continue
            record = {"id": f"{singular}:{code}", "kind": singular, "code": code,
                      "name": row.get("name") or code,
                      "english_name": row.get("name_translations", {}).get("en") or row.get("name") or code,
                      "country_code": code if singular == "country" else row.get("country_code"),
                      "city_code": code if singular == "city" else row.get("city_code"),
                      "time_zone": row.get("time_zone")}
            records.append(record)
    data = {"source": "Travelpayouts reference data", "source_url": "https://travelpayouts.github.io/slate/",
            "updated_at": datetime.now(timezone.utc).isoformat(), "locations": records}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    temporary.replace(OUTPUT)
    print({kind: sum(r["kind"] == kind for r in records) for kind in ("country", "city", "airport")})


if __name__ == "__main__":
    main()
