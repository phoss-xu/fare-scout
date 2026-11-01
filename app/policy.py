"""Editable sampling and alert settings, independent of flight conditions."""
import math

INTERVALS = (1, 3, 6, 12, 24)


def validate_settings(data):
    enabled = data.get("auto_enabled", True)
    alerts = data.get("alerts_enabled", True)
    try:
        interval = float(data.get("interval_hours", 6))
        threshold = float(data.get("min_drop", 100))
    except (TypeError, ValueError):
        raise ValueError("请检查查价间隔和降价金额。") from None
    if not isinstance(enabled, bool) or not isinstance(alerts, bool):
        raise ValueError("请选择是否开启自动查价和价格提醒。")
    if interval not in INTERVALS:
        raise ValueError("查价间隔可选 1、3、6、12 或 24 小时。")
    if not math.isfinite(threshold) or not 1 <= threshold <= 1000000:
        raise ValueError("降价提醒金额须为 HK$1–1,000,000。")
    return dict(auto_enabled=enabled, alerts_enabled=alerts,
                interval_hours=int(interval), min_drop=threshold)
