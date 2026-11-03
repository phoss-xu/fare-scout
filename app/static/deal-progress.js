import {tr} from './i18n.js';
import {resultSummary} from './deal_views.js';
export function searchStatus(data) {
  if(data.status!=='running') return resultSummary(data);
  return `${tr('查询中 · ','Checking · ')}${data.completed}/${data.total}${data.offers?.length?tr(` · 已返回 ${data.offers.length} 组报价`,` · ${data.offers.length} quotes received`):''}${data.failures?tr(` · ${data.failures} 组查询失败`,` · ${data.failures} failed groups`):''}`;
}
