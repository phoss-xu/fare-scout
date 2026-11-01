"""Typed global location catalogue and exact airport membership."""
import json
import unicodedata
from collections import Counter
from functools import lru_cache
from pathlib import Path


def fold(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value.casefold()) if not unicodedata.combining(c))


@lru_cache(maxsize=1)
def catalogue():
    data = json.loads(Path(__file__).with_name("data").joinpath("locations.json").read_text())
    records = {row["id"]: row for row in data["locations"]}
    city_counts, country_counts = Counter(), Counter()
    for row in records.values():
        if row["kind"] == "airport":
            city_counts[row["city_code"]] += 1
            country_counts[row["country_code"]] += 1
    for row in records.values():
        country = records.get("country:" + (row["country_code"] or ""), {})
        city = records.get("city:" + (row["city_code"] or ""), {})
        row["country_name"] = country.get("name", "")
        row["city_name"] = city.get("name", "")
        row["airport_count"] = 1 if row["kind"] == "airport" else (city_counts if row["kind"] == "city" else country_counts)[row["code"]]
    return records, data["updated_at"]


def resolve(value):
    identity = value.get("id") if isinstance(value, dict) else value
    if not isinstance(identity, str) or len(identity) > 80:
        raise ValueError("请从地点候选中选择国家/地区、城市或机场。")
    identity = identity.strip()
    records, _ = catalogue()
    if ":" not in identity:
        code = identity.upper()
        identity = next((kind + ":" + code for kind in ("airport", "city", "country") if kind + ":" + code in records), "")
    row = records.get(identity)
    if not row:
        raise ValueError("没有找到该地点，请重新搜索并从候选中选择。")
    return dict(row)


def contains(scope, airport):
    if scope["kind"] == "airport":
        return scope["code"] == airport
    records, _ = catalogue()
    member = records.get("airport:" + str(airport))
    return bool(member and member["country_code" if scope["kind"] == "country" else "city_code"] == scope["code"])


def origin(watch):
    return resolve(watch.get("origin_location") or watch["origin"])


def destinations(watch):
    return [resolve(value) for value in watch.get("destination_locations", watch["destinations"])]


def search(query="", kind="", limit=20):
    if kind not in ("", "country", "city", "airport") or len(query) > 100:
        raise ValueError("请检查地点类型或缩短搜索内容。")
    terms = fold(query.strip()).split()
    candidates = []
    for row in catalogue()[0].values():
        if kind and row["kind"] != kind:
            continue
        content = fold(" ".join(str(row.get(key) or "") for key in ("name", "english_name", "code", "country_name", "city_name")))
        if terms and not all(term in content for term in terms):
            continue
        exact = fold(query.strip()) in (fold(row["name"]), fold(row["english_name"]), fold(row["code"]))
        prefix = any(fold(row[key]).startswith(fold(query.strip())) for key in ("name", "english_name", "code"))
        candidates.append(((not exact, not prefix, {"country":0,"city":1,"airport":2}[row["kind"]], row["english_name"]), row))
    return [dict(row) for _, row in sorted(candidates, key=lambda item: item[0])[:limit]]


def label(code):
    records, _ = catalogue()
    row = records.get("airport:" + str(code)) or records.get("city:" + str(code)) or records.get("country:" + str(code))
    return (row["city_name"] or row["name"]) if row else str(code)


def stats():
    records, updated = catalogue()
    return {**dict(Counter(row["kind"] for row in records.values())), "updated_at": updated}
