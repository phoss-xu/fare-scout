"""Create a private, offline D1 import file. Never connects to Cloudflare or changes the source DB."""
import argparse
import os
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app import schema

TABLES = ('users', 'passkeys', 'watches', 'schedules', 'observations', 'alerts', 'email_outbox', 'settings', 'location_history')


def export(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if source == output:
        raise ValueError('输出不能覆盖源数据库。')
    memory = sqlite3.connect(':memory:')
    memory.row_factory = sqlite3.Row
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as original:
        original.backup(memory)
    schema.initialize(memory)
    if memory.execute('SELECT 1 FROM watches WHERE owner_id IS NULL LIMIT 1').fetchone():
        raise ValueError('存在未分配账号的旧监控，请先在旧服务完成账号归属迁移。')
    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Never include sessions, activation links, throttling state or service credentials.
    count = 0
    with os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as target:
        target.write('-- Private offline export. Import ONLY into an empty, migrated D1 database.\n')
        target.write('-- Schedules and notifications are paused; sessions and setup tokens are excluded.\n')
        for table in TABLES:
            if not memory.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
                continue
            columns = [r[1] for r in memory.execute(f'PRAGMA table_info({table})')]
            for row in memory.execute(f'SELECT * FROM {table}'):
                values = dict(row)
                if table == 'watches':
                    values['running'] = 0
                if table == 'schedules':
                    values.update(auto_enabled=0, alerts_enabled=0)
                if table == 'observations' and 'task_id' in values:
                    # Preserve evidence without replaying destination alert triggers.
                    values['task_id'] = None
                if table == 'email_outbox':
                    if values['status'] != 'sent':
                        values['status'] = 'cancelled'
                    for key in ('lease_token', 'lease_until'):
                        if key in values:
                            values[key] = None
                literals = [memory.execute('SELECT quote(?)', (values[c],)).fetchone()[0] for c in columns]
                names = ','.join('"' + c + '"' for c in columns)
                target.write(f'INSERT INTO "{table}" ({names}) VALUES({",".join(literals)});\n')
                count += 1
    memory.close()
    return count


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default=str(ROOT / 'fare_scout.db'))
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        count = export(args.source, args.output)
    except (ValueError, sqlite3.Error, OSError) as exc:
        parser.exit(1, f'导出未完成：{exc}\n')
    print(f'已生成 {count} 条本地导入语句；源数据库未修改，未上传数据。')
