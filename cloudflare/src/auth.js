import {pbkdf2} from '@noble/hashes/pbkdf2.js';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex,hexToBytes} from '@noble/hashes/utils.js';
import {first,run,batch,seconds,now,email,ensure,ApiError} from './db.js';
const LIFETIME = 7*86400;
const REMEMBERED_LIFETIME = 30*86400;
export const token = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
export const digest = value => bytesToHex(sha256(new TextEncoder().encode(value)));
export const publicUser = r => ({id:r.id,email:r.email,name:r.name,notification_email:r.notification_email});
export function equal(a,b) {
  if (typeof a!=='string' || typeof b!=='string') return false;
  const x=new TextEncoder().encode(a), y=new TextEncoder().encode(b);
  let diff=x.length^y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++) diff|=(x[i]||0)^(y[i]||0);
  return diff===0;
}
function password(value) {
  ensure(typeof value==='string' && [...value].length>=6 && [...value].length<=128,'密码需为 6–128 个字符，可包含空格和中文。');
  return value;
}
// Pure JS PBKDF2 preserves the existing 600,000 rounds, above workerd's native cap.
export function hashPassword(value, salt=token().slice(0,32)) {
  return `pbkdf2_sha256$600000$${salt}$${bytesToHex(pbkdf2(sha256,value,hexToBytes(salt),{c:600000,dkLen:32}))}`;
}
export function verifyPassword(value,stored) {
  if(typeof value!=='string' || [...value].length>128) return false;
  const encoded=stored || 'pbkdf2_sha256$600000$00000000000000000000000000000000$'+'0'.repeat(64);
  const [algorithm,iterations,salt,expected]=encoded.split('$');
  ensure(algorithm==='pbkdf2_sha256' && Number(iterations)===600000 && /^[a-f0-9]{32}$/.test(salt) && /^[a-f0-9]{64}$/.test(expected),'账号密码格式无法读取，请联系维护者。',500);
  return equal(hashPassword(value,salt).split('$')[3],expected) && stored!=null;
}
export const cookieToken = request => /(?:^|;\s*)fare_session=([^;]*)/.exec(request.headers.get('Cookie')||'')?.[1] || '';
export const cookie = (request,value,lifetime=LIFETIME) => `fare_session=${value}; Path=/; Max-Age=${value?lifetime:0}; HttpOnly; SameSite=Lax${new URL(request.url).protocol==='https:'?'; Secure':''}`;
export async function current(request,db) {
  const value=cookieToken(request);
  if(!value || value.length>128) return null;
  const row=await first(db,`SELECT u.*,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND (u.password_hash IS NOT NULL OR EXISTS(SELECT 1 FROM passkeys p WHERE p.user_id=u.id))`,[digest(value),seconds()]);
  return row ? {user:publicUser(row),csrf_token:row.csrf_token} : null;
}
export async function requireUser(request,db,write=false) {
  const session=await current(request,db);
  ensure(session,'请先登录。',401);
  ensure(!write || equal(session.csrf_token,request.headers.get('X-CSRF-Token')),'登录信息已更新，请刷新页面后再试。',403);
  return session.user;
}
export async function throttle(request,db,address) {
  const timestamp=seconds();
  const keys=[digest('ip:'+(request.headers.get('CF-Connecting-IP')||'local')),digest('account:'+address)];
  const output=await batch(db,[['DELETE FROM auth_limits WHERE window_start<?',[timestamp-900]],
    ...keys.map(key=>['INSERT INTO auth_limits(key,count,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',[key,timestamp]])]);
  ensure(output[1].results[0].count<=30 && output[2].results[0].count<=10,'尝试次数较多，请 15 分钟后再试。',429);
}
export async function authenticate(request,env,path,data) {
  const db=env.DB, old=cookieToken(request);
  if(path==='/api/auth/logout') {
    await requireUser(request,db,true);
    await run(db,'DELETE FROM sessions WHERE token_hash=?',[digest(old)]);
    return {body:{message:'已退出登录。'},cookie:cookie(request,'')};
  }
  ensure(env.AUTH_MODE!=='passkey','请使用通行密钥登录。',404);
  const address=path.endsWith('/activate')?'setup@localhost.test':email(data.email);
  await throttle(request,db,address);
  let user;
  if(path.endsWith('/register')) {
    const name=typeof data.name==='string'?data.name.trim():'';
    ensure([...name].length<=40,'昵称最多 40 个字符。');
    const hashed=hashPassword(password(data.password));
    const row=await first(db,`INSERT INTO users(email,name,password_hash,notification_email,created_at) VALUES(?,?,?,?,?)
      ON CONFLICT(email) DO NOTHING RETURNING *`,[address,name||address.split('@')[0],hashed,address,now()]);
    ensure(row,'该邮箱暂时无法注册，请尝试登录；已有本地账号请使用初始化入口。',409);
    user=publicUser(row);
  } else if(path.endsWith('/login')) {
    const row=await first(db,'SELECT * FROM users WHERE email=?',[address]);
    ensure(verifyPassword(data.password,row?.password_hash),'邮箱或密码不正确。',401);
    user=publicUser(row);
  } else if(path.endsWith('/activate')) {
    ensure(typeof data.token==='string' && data.token.length<=128,'初始化入口无效或已过期。');
    const hashed=hashPassword(password(data.password));
    const row=await first(db,`UPDATE users SET password_hash=? WHERE password_hash IS NULL AND id IN
      (SELECT user_id FROM setup_tokens WHERE token_hash=? AND expires_at>?) RETURNING *`,[hashed,digest(data.token),seconds()]);
    ensure(row,'初始化入口无效或已过期。');
    await run(db,'DELETE FROM setup_tokens WHERE user_id=?',[row.id]);
    user=publicUser(row);
  } else throw new ApiError('操作不存在。',404);
  return issueSession(request,db,user,data.remember===true);
}
export async function issueSession(request,db,user,remember=false) {
  const old=cookieToken(request);
  const value=token(),csrf=token();
  const lifetime=remember?REMEMBERED_LIFETIME:LIFETIME;
  await batch(db,[['DELETE FROM sessions WHERE expires_at<=? OR token_hash=?',[seconds(),digest(old)]],
    ['INSERT INTO sessions VALUES(?,?,?,?)',[digest(value),user.id,csrf,seconds()+lifetime]]]);
  return {body:{user,csrf_token:csrf},cookie:cookie(request,value,lifetime)};
}
