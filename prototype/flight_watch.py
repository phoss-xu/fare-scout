"""Small, scheduled flight price watcher backed by Kiwi.com's public MCP."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import httpx


MCP_URL = "https://mcp.kiwi.com"
DB_PATH = Path(os.environ.get("FLIGHT_WATCH_DB", Path(__file__).with_name("flight_watch.db")))
LOCAL_ZONE = ZoneInfo("Asia/Shanghai")


def today() -> date:
    return datetime.now(LOCAL_ZONE).date()


def database() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS watches (
            id INTEGER PRIMARY KEY,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            departure_date TEXT NOT NULL,
            departure_date_to TEXT,
            return_date TEXT,
            currency TEXT NOT NULL,
            max_price REAL NOT NULL DEFAULT 0,
            adults INTEGER NOT NULL DEFAULT 1,
            last_alert_price REAL
        );
        CREATE TABLE IF NOT EXISTS observations (
            id INTEGER PRIMARY KEY,
            watch_id INTEGER NOT NULL REFERENCES watches(id),
            checked_at TEXT NOT NULL,
            travel_date TEXT,
            price REAL,
            currency TEXT NOT NULL,
            booking_url TEXT,
            status TEXT NOT NULL,
            detail TEXT
        );
        """
    )
    watch_columns = {row["name"] for row in connection.execute("PRAGMA table_info(watches)")}
    if "departure_date_to" not in watch_columns:
        connection.execute("ALTER TABLE watches ADD COLUMN departure_date_to TEXT")
    observation_columns = {row["name"] for row in connection.execute("PRAGMA table_info(observations)")}
    if "travel_date" not in observation_columns:
        connection.execute("ALTER TABLE observations ADD COLUMN travel_date TEXT")
        connection.execute(
            "UPDATE observations SET travel_date = "
            "(SELECT departure_date FROM watches WHERE watches.id = observations.watch_id) "
            "WHERE status = 'ok'"
        )
    return connection


def post_mcp(client: httpx.Client, request_id: int, method: str, params: dict[str, Any]) -> dict[str, Any]:
    response = client.post(
        MCP_URL,
        json={"jsonrpc": "2.0", "id": request_id, "method": method, "params": params},
        headers={"Accept": "application/json, text/event-stream", "Content-Type": "application/json"},
    )
    response.raise_for_status()
    if response.headers.get("content-type", "").startswith("text/event-stream"):
        events = []
        for line in response.text.splitlines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))
        matches = [event for event in events if event.get("id") == request_id]
        if not matches:
            raise RuntimeError(f"MCP did not return response {request_id}")
        payload = matches[-1]
    else:
        payload = response.json()
    if "error" in payload:
        raise RuntimeError(f"MCP error: {payload['error']}")
    return payload.get("result", {})


def extract_search_result(tool_result: dict[str, Any]) -> dict[str, Any]:
    if tool_result.get("isError"):
        raise RuntimeError(f"Kiwi tool error: {tool_result.get('content')}")
    structured = tool_result.get("structuredContent")
    if isinstance(structured, dict):
        data = structured.get("result", structured)
        if isinstance(data, dict) and "itineraries" in data:
            return data
    for item in tool_result.get("content", []):
        if item.get("type") == "text":
            try:
                data = json.loads(item["text"])
            except (ValueError, TypeError):
                continue
            if isinstance(data, dict) and "itineraries" in data:
                return data
    raise RuntimeError("Kiwi returned an unrecognized flight result")


def search_flights(watch: sqlite3.Row) -> list[dict[str, Any]]:
    start = max(date.fromisoformat(watch["departure_date"]), today())
    arguments: dict[str, Any] = {
        "flyFrom": watch["origin"],
        "flyTo": watch["destination"],
        "departureDate": start.strftime("%d/%m/%Y"),
        "currency": watch["currency"],
        "adults": watch["adults"],
        "sort": "price",
        "allow_self_transfer": False,
    }
    if watch["departure_date_to"]:
        arguments["departureDateTo"] = date.fromisoformat(watch["departure_date_to"]).strftime("%d/%m/%Y")
    if watch["return_date"]:
        arguments["returnDate"] = date.fromisoformat(watch["return_date"]).strftime("%d/%m/%Y")
    with httpx.Client(timeout=45.0, follow_redirects=True) as client:
        post_mcp(client, 1, "initialize", {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "flight-watch-mvp", "version": "0.1.0"},
        })
        tool_result = post_mcp(client, 2, "tools/call", {
            "name": "search-flight", "arguments": arguments,
        })
    data = extract_search_result(tool_result)
    if data.get("error"):
        raise RuntimeError(f"Kiwi search error: {data['error']}")
    offers = [
        item for item in data.get("itineraries", [])
        if isinstance(item, dict) and isinstance(item.get("price"), (int, float))
    ]
    cheapest_by_date: dict[str, dict[str, Any]] = {}
    for offer in offers:
        departure_time = (offer.get("outbound") or {}).get("departureTime")
        if not isinstance(departure_time, str) or len(departure_time) < 10:
            continue
        travel_date = departure_time[:10]
        current = cheapest_by_date.get(travel_date)
        if current is None or offer["price"] < current["price"]:
            cheapest_by_date[travel_date] = {
                "travel_date": travel_date,
                "price": float(offer["price"]),
                "booking_url": offer.get("bookingUrl"),
            }
    return list(cheapest_by_date.values())


def notify(message: str) -> None:
    token = os.environ.get("FLIGHT_WATCH_TELEGRAM_TOKEN")
    chat_id = os.environ.get("FLIGHT_WATCH_TELEGRAM_CHAT_ID")
    if token and chat_id:
        response = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": message},
            timeout=15,
        )
        response.raise_for_status()
    elif sys.platform == "darwin":
        escaped = message.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
        subprocess.run(
            ["osascript", "-e", f'display notification "{escaped}" with title "机票降价提醒"'],
            check=True,
        )
    else:
        print(f"ALERT: {message}")


def check_watch(connection: sqlite3.Connection, watch: sqlite3.Row) -> bool:
    checked_at = datetime.now(timezone.utc).isoformat()
    since = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    try:
        offers = search_flights(watch)
    except Exception as exc:
        with connection:
            connection.execute(
                "INSERT INTO observations (watch_id, checked_at, travel_date, price, currency, booking_url, status, detail) "
                "VALUES (?, ?, NULL, NULL, ?, NULL, 'error', ?)",
                (watch["id"], checked_at, watch["currency"], str(exc)[:500]),
            )
        print(f"#{watch['id']} 查询失败：{exc}", file=sys.stderr)
        return False
    if not offers:
        with connection:
            connection.execute(
                "INSERT INTO observations (watch_id, checked_at, travel_date, price, currency, booking_url, status) "
                "VALUES (?, ?, NULL, NULL, ?, NULL, 'empty')",
                (watch["id"], checked_at, watch["currency"]),
            )
        print(f"#{watch['id']} 暂无符合条件的报价")
        return True
    notified = True
    for offer in sorted(offers, key=lambda item: item["price"]):
        travel_date = offer["travel_date"]
        price = offer["price"]
        booking_url = offer["booking_url"]
        prior = connection.execute(
            "SELECT MIN(price) AS lowest, COUNT(DISTINCT substr(checked_at, 1, 10)) AS sample_days, "
            "MIN(checked_at) AS first_sample FROM observations "
            "WHERE watch_id = ? AND travel_date = ? AND status = 'ok' AND checked_at >= ?",
            (watch["id"], travel_date, since),
        ).fetchone()
        with connection:
            connection.execute(
                "INSERT INTO observations (watch_id, checked_at, travel_date, price, currency, booking_url, status) "
                "VALUES (?, ?, ?, ?, ?, ?, 'ok')",
                (watch["id"], checked_at, travel_date, price, watch["currency"], booking_url),
            )
        prior_low = prior["lowest"]
        print(f"#{watch['id']} {watch['origin']} → {watch['destination']} "
              f"{travel_date}: {price:g} {watch['currency']} "
              f"（此前 90 天采样最低 {prior_low if prior_low is not None else '暂无'}；"
              f"采样 {prior['sample_days']} 天）")
        # Three separate observation days give a baseline without calling a first sample a deal.
        if prior_low is not None and prior["sample_days"] >= 3 and price < prior_low:
            first_day = datetime.fromisoformat(prior["first_sample"]).date()
            covered_days = min(90, (today() - first_day).days + 1)
            label = "近90天采样新低" if covered_days >= 90 else f"监测期新低（覆盖 {covered_days} 天）"
            message = (f"{watch['origin']} → {watch['destination']} "
                       f"{travel_date} {label}: "
                       f"{price:g} {watch['currency']}，此前最低 {prior_low:g}，"
                       f"采样 {prior['sample_days']} 天\n"
                       f"{booking_url or '请重新查询确认价格'}")
            try:
                notify(message)
            except Exception as exc:
                print(f"#{watch['id']} 通知失败：{exc}", file=sys.stderr)
                notified = False
    return notified


def main() -> int:
    parser = argparse.ArgumentParser(description="机票价格监控最小版")
    sub = parser.add_subparsers(dest="command", required=True)
    add = sub.add_parser("add", help="添加监控")
    add.add_argument("--from", dest="origin", required=True, help="出发城市或机场")
    add.add_argument("--to", dest="destination", required=True, help="到达城市或机场")
    dates = add.add_mutually_exclusive_group(required=True)
    dates.add_argument("--date", help="指定出发日期 YYYY-MM-DD")
    dates.add_argument("--date-from", help="可出发日期范围的开始 YYYY-MM-DD")
    add.add_argument("--date-to", help="可出发日期范围的结束 YYYY-MM-DD，最多相隔 30 天")
    add.add_argument("--return-date", help="返程日期 YYYY-MM-DD")
    add.add_argument("--currency", default="CNY", help="币种，默认 CNY")
    add.add_argument("--adults", type=int, default=1)
    sub.add_parser("list", help="列出监控")
    remove = sub.add_parser("remove", help="删除监控")
    remove.add_argument("--id", type=int, required=True)
    check = sub.add_parser("check", help="执行一次查价，适合放进 cron")
    check.add_argument("--id", type=int, help="只查指定监控")
    history = sub.add_parser("history", help="查看最近查价记录")
    history.add_argument("--id", type=int, required=True)
    args = parser.parse_args()
    with database() as connection:
        if args.command == "add":
            if bool(args.date_from) != bool(args.date_to):
                parser.error("日期范围需要同时提供 --date-from 和 --date-to")
            if args.date and args.date_to:
                parser.error("--date 不可与 --date-to 同时使用")
            departure_text = args.date or args.date_from
            departure = date.fromisoformat(departure_text)
            if departure < today():
                parser.error("出发日期不能早于今天")
            if args.date_to:
                range_end = date.fromisoformat(args.date_to)
                if range_end < departure or (range_end - departure).days > 30:
                    parser.error("日期范围需在 0–30 天内")
            if args.return_date and args.date_to:
                parser.error("日期范围监控目前只支持单程")
            if args.return_date and date.fromisoformat(args.return_date) < departure:
                parser.error("返程日期不能早于出发日期")
            if args.adults < 1 or args.adults > 9:
                parser.error("成人数须为 1–9")
            row = connection.execute(
                "INSERT INTO watches (origin, destination, departure_date, departure_date_to, return_date, currency, max_price, adults) "
                "VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
                (args.origin, args.destination, departure_text, args.date_to, args.return_date,
                 args.currency.upper(), args.adults),
            )
            print(f"已添加监控 #{row.lastrowid}")
        elif args.command == "list":
            for row in connection.execute("SELECT * FROM watches ORDER BY id"):
                print(f"#{row['id']} {row['origin']} → {row['destination']} "
                      f"{row['departure_date']}–{row['departure_date_to'] or row['departure_date']} "
                      f"/ {row['return_date'] or '单程'} "
                      f"{row['currency']}")
        elif args.command == "remove":
            connection.execute("DELETE FROM observations WHERE watch_id = ?", (args.id,))
            removed = connection.execute("DELETE FROM watches WHERE id = ?", (args.id,))
            print("已删除" if removed.rowcount else "未找到该监控")
        elif args.command == "history":
            for row in connection.execute(
                "SELECT * FROM observations WHERE watch_id = ? ORDER BY id DESC LIMIT 20", (args.id,)
            ):
                print(f"{row['checked_at']} {row['travel_date'] or '-'} {row['status']} "
                      f"{row['price'] if row['price'] is not None else '-'} "
                      f"{row['currency']} {row['detail'] or row['booking_url'] or ''}")
        elif args.command == "check":
            query = "SELECT * FROM watches WHERE COALESCE(departure_date_to, departure_date) >= ?"
            parameters: list[Any] = [today().isoformat()]
            if args.id is not None:
                query += " AND id = ?"
                parameters.append(args.id)
            watches = connection.execute(query, parameters).fetchall()
            if not watches:
                print("没有待查的监控")
                return 0
            results = [check_watch(connection, watch) for watch in watches]
            return 0 if all(results) else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
