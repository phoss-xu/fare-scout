"""Sample Hong Kong weekend return fares with strict local flight-time windows."""

from __future__ import annotations

import argparse
import sqlite3
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx

from flight_watch import extract_search_result, post_mcp, today


DESTINATIONS = {
    "BKK": "曼谷", "HKT": "普吉", "CNX": "清迈", "SIN": "新加坡",
    "KUL": "吉隆坡", "PEN": "槟城", "DPS": "巴厘岛", "SGN": "胡志明市",
    "DAD": "岘港", "MNL": "马尼拉",
}
DB = Path(__file__).with_name("weekend_watch.db")


def weekends(count: int):
    start = today()
    first = start + timedelta(days=(5 - start.weekday()) % 7)
    for number in range(count):
        saturday = first + timedelta(weeks=number)
        yield saturday, saturday + timedelta(days=2)


def matching(offer: dict, saturday: date, monday: date) -> bool:
    outbound = offer.get("outbound") or {}
    inbound = offer.get("inbound") or {}
    departure = outbound.get("departureTime", "")
    arrival = inbound.get("arrivalTime", "")
    return (
        departure.startswith(saturday.isoformat())
        and departure[11:13] in {"00", "01", "02", "03", "04", "05"}
        and arrival.startswith(monday.isoformat())
        and arrival[11:13] in {"00", "01", "02", "03", "04", "05"}
        and outbound.get("from") == "HKG"
        and inbound.get("to") == "HKG"
        and outbound.get("stops", 99) <= 1
        and inbound.get("stops", 99) <= 1
        and outbound.get("durationSeconds", 10**9) <= 8 * 3600
        and inbound.get("durationSeconds", 10**9) <= 8 * 3600
        and isinstance(offer.get("price"), (int, float))
    )


def query(client: httpx.Client, destination: str, saturday: date, monday: date) -> list[dict]:
    arguments = {
        "flyFrom": "HKG", "flyTo": destination,
        "departureDate": saturday.strftime("%d/%m/%Y"),
        "returnDate": (monday - timedelta(days=1)).strftime("%d/%m/%Y"),
        "returnDateTo": monday.strftime("%d/%m/%Y"),
        "currency": "HKD", "adults": 1, "cabinClass": "M", "sort": "price",
        "dtime_from": 0, "dtime_to": 5,
        "ret_atime_from": 0, "ret_atime_to": 5,
        "max_sector_stopovers": 1,
        "allow_self_transfer": False,
    }
    result = post_mcp(client, 2, "tools/call", {"name": "search-flight", "arguments": arguments})
    offers = extract_search_result(result).get("itineraries", [])
    return sorted((o for o in offers if matching(o, saturday, monday)), key=lambda o: o["price"])


def main() -> int:
    parser = argparse.ArgumentParser(description="香港周末东南亚往返航班采样")
    parser.add_argument("--weeks", type=int, default=12)
    parser.add_argument("--limit", type=int, help="本次最多查询多少组，用于小规模试跑")
    parser.add_argument("--destination", choices=DESTINATIONS)
    parser.add_argument("--db", type=Path, default=DB)
    args = parser.parse_args()
    if not 1 <= args.weeks <= 52 or (args.limit is not None and args.limit < 1):
        parser.error("--weeks 须在 1–52 之间，--limit 须大于 0")
    jobs = [(s, m, d) for s, m in weekends(args.weeks)
            for d in (DESTINATIONS if args.destination is None else [args.destination])]
    if args.limit:
        jobs = jobs[:args.limit]
    with sqlite3.connect(args.db) as db:
        db.execute("""CREATE TABLE IF NOT EXISTS observations (
            checked_at TEXT NOT NULL, saturday TEXT NOT NULL, monday TEXT NOT NULL,
            destination TEXT NOT NULL, status TEXT NOT NULL, price REAL,
            outbound TEXT, inbound TEXT, arrival TEXT, booking_url TEXT, detail TEXT
        )""")
        failures = 0
        for saturday, monday, destination in jobs:
            checked_at = datetime.now(timezone.utc).isoformat()
            try:
                with httpx.Client(timeout=45, follow_redirects=True) as client:
                    post_mcp(client, 1, "initialize", {
                        "protocolVersion": "2025-06-18", "capabilities": {},
                        "clientInfo": {"name": "weekend-watch", "version": "0.1"},
                    })
                    offers = query(client, destination, saturday, monday)
                offer = offers[0] if offers else None
                status = "ok" if offer else "empty"
                detail = None
            except Exception as exc:
                offer, status, detail = None, "error", str(exc)[:500]
                failures += 1
            previous = db.execute("""SELECT MIN(price) FROM observations WHERE destination=?
                AND saturday=? AND monday=? AND status='ok' AND checked_at>=?""", (
                destination, saturday.isoformat(), monday.isoformat(),
                (datetime.now(timezone.utc) - timedelta(days=90)).isoformat(),
            )).fetchone()[0]
            db.execute("INSERT INTO observations VALUES (?,?,?,?,?,?,?,?,?,?,?)", (
                checked_at, saturday.isoformat(), monday.isoformat(), destination, status,
                offer["price"] if offer else None,
                offer["outbound"]["departureTime"] if offer else None,
                offer["inbound"]["departureTime"] if offer else None,
                offer["inbound"]["arrivalTime"] if offer else None,
                offer.get("bookingUrl") if offer else None, detail,
            ))
            db.commit()
            if offer:
                change = f"；此前采样最低 HK${previous:g}" if previous is not None else "；首次采样"
                print(f"{saturday} {DESTINATIONS[destination]} HK${offer['price']:g} "
                      f"{offer['outbound']['departureTime']} → "
                      f"{offer['inbound']['arrivalTime']}{change} {offer.get('bookingUrl','')}")
            else:
                print(f"{saturday} {DESTINATIONS[destination]} {status} {detail or ''}")
            time.sleep(0.3)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
