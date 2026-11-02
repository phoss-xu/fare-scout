"""Short-lived, account-isolated asynchronous discovery tasks."""
import copy
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from . import deals

POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix='fare-deals')
LOCK = threading.Lock()
TASKS = {}
TTL = 3600


def start(user_id, data):
    config = deals.validate(data)
    with LOCK:
        expired = [key for key,row in TASKS.items() if time.monotonic()-row['created'] > TTL and row['status'] != 'running']
        for key in expired:
            del TASKS[key]
        if any(row['owner'] == user_id and row['status'] == 'running' for row in TASKS.values()):
            raise ValueError('你已有一份特价搜索正在进行，请等待完成。')
        if len(TASKS) >= 100:
            raise ValueError('搜索服务正在忙，请稍后重试。')
        identity = uuid.uuid4().hex
        TASKS[identity] = dict(owner=user_id, created=time.monotonic(), status='running',
                               completed=0, total=len(config['origin_locations']) * (len(config['destinations']) or 1), config=config)
    try:
        POOL.submit(run, identity, config)
    except RuntimeError:
        with LOCK:
            TASKS.pop(identity, None)
        raise
    return identity


def run(identity, config):
    def progress(completed, total):
        with LOCK:
            TASKS[identity].update(completed=completed, total=total)
    try:
        result = deals.search(config, progress)
        with LOCK:
            TASKS[identity].update(result, status='error' if result['failures'] == result['total'] else 'done')
    except Exception:
        import logging
        logging.exception('Discovery task failed')
        with LOCK:
            TASKS[identity].update(status='error')


def get(identity, user_id):
    with LOCK:
        row = TASKS.get(identity)
        if not row or row['owner'] != user_id:
            return None
        return copy.deepcopy({key:value for key,value in row.items() if key not in ('owner','created')})
