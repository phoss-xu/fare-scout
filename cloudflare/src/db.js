export const now = () => new Date().toISOString();
export const seconds = () => Date.now() / 1000;
export const statement = (db, sql, args = []) => db.prepare(sql).bind(...args);
export const first = (db, sql, args) => statement(db, sql, args).first();
export const all = async (db, sql, args) => (await statement(db, sql, args).all()).results;
export const run = (db, sql, args) => statement(db, sql, args).run();
export const batch = (db, queries) => db.batch(queries.map(([sql, args]) => statement(db, sql, args)));
export class ApiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function ensure(condition, message, status) {
  if (!condition) throw new ApiError(message, status);
}
export function email(value) {
  const address = typeof value === 'string' ? value.trim().toLowerCase() : '';
  ensure(address.length <= 254 && /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(address), '请输入有效的邮箱。');
  return address;
}

export function report(error, context) {
  // Stack frames retain call sites while excluding exception text that may embed SQL values.
  console.error(context, error?.name || 'Error', String(error?.stack || '').split('\n').slice(1,5).join('\n'));
}
