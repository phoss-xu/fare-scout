export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const time = value => value ? new Date(value).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '尚未查询';
export const money = value => Number(value).toLocaleString('zh-CN', {maximumFractionDigits: 0});
