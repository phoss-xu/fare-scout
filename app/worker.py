"""Single query queue with bounded retries and persisted outcomes."""
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError, URLError

from . import store
from .domain import jobs, today
from .provider import Kiwi

POOL = ThreadPoolExecutor(max_workers=1, thread_name_prefix="fare-query")
LOG = logging.getLogger(__name__)
BATCH_SIZE = 12


def search_with_retry(watch, job):
    for attempt in range(3):
        try:
            return Kiwi().search(watch, job)
        except (URLError, TimeoutError, ConnectionError) as exc:
            if isinstance(exc, HTTPError) and exc.code not in (408, 429, 500, 502, 503, 504):
                raise
            if attempt == 2:
                raise
            delay = 2 ** (attempt + 1)
            if isinstance(exc, HTTPError):
                try:
                    delay = max(delay, min(float(exc.headers.get("Retry-After", 0)), 60))
                except (ValueError, TypeError, AttributeError):
                    LOG.warning("Provider supplied an invalid Retry-After header")
            LOG.warning("Temporary provider failure; retry %s in %ss", attempt + 1, delay)
            time.sleep(delay)


def run(watch_id, automatic=False):
    status = "ok"
    cursor, completed, total = None, 0, 0
    try:
        watch = store.watch(watch_id)
        pending = [job for job in jobs(watch) if job["departure"] >= today().isoformat()]
        total = len(pending)
        cursor = watch.get("query_cursor", 0) % total if total else 0
        ordered = pending[cursor:] + pending[:cursor]
        for job in ordered[:BATCH_SIZE]:
            if automatic and not store.watch(watch_id)["auto_enabled"]:
                break
            try:
                offers = search_with_retry(watch, job)
            except Exception:
                # Boundary containment: persist failures and allow other routes to run.
                LOG.exception("Provider search failed for watch %s / %s", watch_id, job)
                store.observe_batch(watch_id, job, "error", [])
                status = "error"
            else:
                store.observe_batch(watch_id, job, "ok" if offers else "empty", offers)
            completed += 1
            time.sleep(1)
        if not total:
            status = "expired"
    except Exception:
        status = "error"
        LOG.exception("Watch run failed for %s", watch_id)
    finally:
        next_cursor = (cursor + completed) % total if total and cursor is not None else cursor
        store.finish(watch_id, status, next_cursor, completed, total)


def submit(watch_id, automatic=False):
    if not store.claim(watch_id):
        return False
    try:
        POOL.submit(run, watch_id, automatic)
    except RuntimeError:
        store.finish(watch_id, "error")
        raise
    return True
