import {tr} from './i18n.js';
import {request} from './api.js';
import {startRegistration,startAuthentication,browserSupportsWebAuthn} from './vendor/passkeys.js';
export async function passkeySession(mode,form) {
 if(!window.isSecureContext || !browserSupportsWebAuthn()) throw new Error(tr("浏览器不支持通行密钥，请升级或更换浏览器。","This browser does not support passkeys. Update it or use another browser."));
 const registering=mode==='register';
 const data=Object.fromEntries(new FormData(form));
 const kind=registering?'register':'login';
 try {
  const {options}=await request(`/api/auth/passkey/${kind}/options`,registering?{email:data.email,name:data.name}:{});
  const response=registering?await startRegistration({optionsJSON:options}):await startAuthentication({optionsJSON:options});
  return await request(`/api/auth/passkey/${kind}/verify`,{response});
 } catch(error) {
  const causeName=error.cause?.name || error.name;
  if(causeName==='NotAllowedError') throw new Error(tr("设备验证已取消或超时，请重试。","Device verification was cancelled or timed out. Try again."));
  if(causeName==='InvalidStateError') throw new Error(tr("设备上已存在这个通行密钥，请尝试登录。","This passkey already exists on your device. Try signing in."));
  if(causeName==='SecurityError') throw new Error(tr("请使用本站的 HTTPS 地址，或本机 localhost 地址创建通行密钥。","Use this site over HTTPS or localhost to create a passkey."));
  throw error;
 }
}
