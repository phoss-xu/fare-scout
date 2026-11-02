import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse} from '@simplewebauthn/server';
import {first,run,batch,seconds,now,email,ensure,ApiError,report} from './db.js';
import {token,digest,equal,throttle,publicUser,issueSession} from './auth.js';
const FLOW='fare_passkey_flow';
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decode = value => Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
function settings(request,env) {
 const origin=env.PASSKEY_ORIGIN;
 ensure(typeof origin==='string','服务登录配置尚未就绪。',503);
 const url=new URL(origin);
 ensure(url.origin===origin && (url.protocol==='https:' || (url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))),'服务登录配置无效。',503);
 ensure(new URL(request.url).origin===origin,'请通过本站正式地址登录。',403);
 return {origin,rpID:url.hostname};
}
function flowCookie(request,value) {
 return `${FLOW}=${value}; Path=/api/auth/passkey; Max-Age=${value?300:0}; HttpOnly; SameSite=Strict${new URL(request.url).protocol==='https:'?'; Secure':''}`;
}
const flowToken = request => /(?:^|;\s*)fare_passkey_flow=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie')||'')?.[1] || '';
async function options(request,env,kind,data) {
 const {origin,rpID}=settings(request,env),db=env.DB;
 const address=kind==='register'?email(data.email):'passkey-login:'+(request.headers.get('CF-Connecting-IP')||'local');
 await throttle(request,db,address);
 let name=null,handle=null,options;
 if(kind==='register') {
  name=typeof data.name==='string'?data.name.trim():'';
  ensure([...name].length<=40,'昵称最多 40 个字符。');
  name ||= address.split('@')[0];
  ensure(!await first(db,'SELECT id FROM users WHERE email=?',[address]),'该邮箱已有账号，请使用已保存的通行密钥登录。',409);
  handle=token();
  options=await generateRegistrationOptions({rpName:'Fare Scout',rpID,userName:address,userDisplayName:name,userID:new TextEncoder().encode(handle),attestationType:'none',supportedAlgorithmIDs:[-7],
   authenticatorSelection:{residentKey:'required',userVerification:'required'},timeout:60000});
 } else options=await generateAuthenticationOptions({rpID,userVerification:'required',timeout:60000});
 const value=token();
 await batch(db,[['DELETE FROM passkey_challenges WHERE expires_at<=? OR id=?',[seconds(),digest(flowToken(request))]],
  ['INSERT INTO passkey_challenges VALUES(?,?,?,?,?,?,?,?,?)',[digest(value),options.challenge,kind,kind==='register'?address:null,name,handle,origin,rpID,seconds()+300]]]);
 return {body:{options},cookie:flowCookie(request,value)};
}
async function consume(request,env,kind) {
 const config=settings(request,env);
 const row=await first(env.DB,'DELETE FROM passkey_challenges WHERE id=? AND expires_at>? RETURNING *',[digest(flowToken(request)),seconds()]);
 ensure(row && row.kind===kind && row.origin===config.origin && row.rp_id===config.rpID,'登录验证已过期或已使用，请重新操作。');
 return row;
}
async function verify(request,env,kind,data) {
 const row=await consume(request,env,kind),db=env.DB,response=data.response;
 ensure(response && typeof response==='object' && typeof response.id==='string' && response.id.length<=1400,'设备返回的登录信息无效。');
 let user;
 if(kind==='register') {
  let result;
  try { result=await verifyRegistrationResponse({response,expectedChallenge:row.challenge,expectedOrigin:row.origin,expectedRPID:row.rp_id,requireUserVerification:true,supportedAlgorithmIDs:[-7]}); }
  catch(error) { report(error,'Passkey registration rejected');throw new ApiError('设备验证未通过，请重新创建通行密钥。'); }
  ensure(result.verified && result.registrationInfo,'设备验证未通过，请重试。');
  const info=result.registrationInfo,c=info.credential,timestamp=now();
  const output=await batch(db,[
   ['INSERT INTO users(email,name,notification_email,created_at,auth_handle) VALUES(?,?,?,?,?) ON CONFLICT(email) DO NOTHING RETURNING id',[row.email,row.name,row.email,timestamp,row.user_handle]],
   [`INSERT INTO passkeys(credential_id,user_id,public_key,counter,transports,device_type,backed_up,created_at)
    SELECT ?,id,?,?,?,?,?,? FROM users WHERE email=? AND auth_handle=?`,
    [c.id,encode(c.publicKey),c.counter,JSON.stringify(c.transports||[]),info.credentialDeviceType,Number(info.credentialBackedUp),timestamp,row.email,row.user_handle]]
  ]);
  ensure(output[0].meta.changes===1 && output[1].meta.changes===1,'该邮箱已有账号，请使用已有通行密钥登录。',409);
  user=await first(db,'SELECT * FROM users WHERE auth_handle=?',[row.user_handle]);
 } else {
  const key=await first(db,'SELECT p.*,u.auth_handle FROM passkeys p JOIN users u ON u.id=p.user_id WHERE credential_id=?',[response.id]);
  ensure(key,'无法识别这个通行密钥，请选择创建账号时保存的密钥。',401);
  if(response.response?.userHandle) ensure(equal(new TextDecoder().decode(decode(response.response.userHandle)),key.auth_handle),'通行密钥不属于该账号。',401);
  let result;
  try { result=await verifyAuthenticationResponse({response,expectedChallenge:row.challenge,expectedOrigin:row.origin,expectedRPID:row.rp_id,requireUserVerification:true,
   credential:{id:key.credential_id,publicKey:decode(key.public_key),counter:key.counter,transports:JSON.parse(key.transports)}}); }
  catch(error) { report(error,'Passkey authentication rejected');throw new ApiError('设备签名验证未通过，请重新登录。',401); }
  ensure(result.verified,'设备签名验证未通过。',401);
  const changed=await run(db,'UPDATE passkeys SET counter=?,last_used_at=? WHERE credential_id=? AND counter=?',[result.authenticationInfo.newCounter,now(),key.credential_id,key.counter]);
  ensure(changed.meta.changes===1,'登录验证已更新，请重新操作。',409);
  user=await first(db,'SELECT * FROM users WHERE id=?',[key.user_id]);
 }
 return issueSession(request,db,publicUser(user));
}
export async function passkeyAuth(request,env,path,data) {
 ensure(env.AUTH_MODE==='passkey','此环境未启用通行密钥。',404);
 const match=/^\/api\/auth\/passkey\/(register|login)\/(options|verify)$/.exec(path);
 ensure(match,'操作不存在。',404);
 const result=await (match[2]==='options'?options:verify)(request,env,match[1],data);
 result.body.auth_mode='passkey';return result;
}
