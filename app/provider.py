"""Kiwi MCP transport; no notifications or browser scraping."""
import json
import urllib.request
from datetime import date, timedelta

from .domain import matches
from . import journeys, locations

URL = "https://mcp.kiwi.com"


class Kiwi:
    def __init__(self):
        self.session = None

    def call(self, request_id, method, params):
        headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
        if self.session:
            headers["Mcp-Session-Id"] = self.session
        payload = json.dumps(dict(jsonrpc="2.0", id=request_id, method=method, params=params)).encode()
        req = urllib.request.Request(URL, payload, headers)
        with urllib.request.urlopen(req, timeout=35) as response:
            self.session = response.headers.get("Mcp-Session-Id", self.session)
            body = response.read().decode()
            if "text/event-stream" in response.headers.get("Content-Type", ""):
                messages = [json.loads(line[5:].strip()) for line in body.splitlines() if line.startswith("data:")]
                message = next((m for m in messages if m.get("id") == request_id), None)
            else:
                message = json.loads(body)
        if not isinstance(message, dict) or message.get("error"):
            raise RuntimeError("Kiwi MCP protocol error")
        return message.get("result", {})

    def search(self, watch, job):
        self.call(1, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                   "clientInfo": {"name": "fare-scout", "version": "0.1"}})
        fmt = lambda value: date.fromisoformat(value).strftime("%d/%m/%Y")
        args = dict(flyFrom=(locations.resolve(job["origin_id"]) if job.get("origin_id") else locations.origin(watch))["code"], flyTo=locations.resolve(job.get("location_id") or job["destination"])["code"],
                    departureDate=fmt(job["departure"]), returnDate=fmt(job["arrival"]),
                    currency=watch["currency"], adults=watch["adults"], cabinClass="M",
                    sort="price", allow_self_transfer=False)
        if watch.get("max_stops", 1) >= 0:
            args["max_sector_stopovers"] = watch.get("max_stops", 1)
        if watch["mode"] == "weekend":
            args.update(returnDate=fmt((date.fromisoformat(job["arrival"]) - timedelta(days=1)).isoformat()),
                        returnDateTo=fmt(job["arrival"]), dtime_from=0, dtime_to=5,
                        ret_atime_from=0, ret_atime_to=5)
        offers = [o for o in self.query(args) if matches(o, watch, job)]
        cheapest = {}
        for offer in offers:
            key = journeys.identity(watch, job, offer)
            if key not in cheapest or offer["price"] < cheapest[key]["price"]:
                cheapest[key] = offer
        return sorted(cheapest.values(), key=lambda o: o["price"])

    def query(self, args):
        result = self.call(2, "tools/call", {"name": "search-flight", "arguments": args})
        if result.get("isError"):
            raise RuntimeError("Kiwi search failed")
        data = result.get("structuredContent")
        if isinstance(data, dict):
            data = data.get("result", data)
        if not isinstance(data, dict) or "itineraries" not in data:
            data = None
            for item in result.get("content", []):
                if item.get("type") == "text":
                    try:
                        candidate = json.loads(item["text"])
                    except (ValueError, TypeError):
                        continue
                    if isinstance(candidate, dict) and "itineraries" in candidate:
                        data = candidate
                        break
        if not isinstance(data, dict) or data.get("error") or not isinstance(data.get("itineraries"), list):
            raise RuntimeError("Unrecognized Kiwi result")
        return [o for o in data["itineraries"] if isinstance(o, dict)]
