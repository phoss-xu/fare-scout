import {request} from './api.js';
import {startRegistration,startAuthentication,browserSupportsWebAuthn} from './vendor/passkeys.js';
export async function passkeySession(mode,form) {
 if(!window.isSecureContext || !browserSupportsWebAuthn()) throw new Error('当前浏览器无法使用通行密钥，请换用支持 Passkey 的最新版浏览器。');
 const registering=mode==='register';
 const data=Object.fromEntries(new FormData(form));
 const kind=registering?'register':'login';
 try {
  const {options}=await request(`/api/auth/passkey/${kind}/options`,registering?{email:data.email,name:data.name}:{});
  const response=registering?await startRegistration({optionsJSON:options}):await startAuthentication({optionsJSON:options});
  return await request(`/api/auth/passkey/${kind}/verify`,{response});
 } catch(error) {
  const causeName=error.cause?.name || error.name;
  if(causeName==='NotAllowedError') throw new Error('设备验证已取消或超时，点击按钮可以重试。');
  if(causeName==='InvalidStateError') throw new Error('设备上已存在这个通行密钥，请尝试登录。');
  if(causeName==='SecurityError') throw new Error('请使用本站的 HTTPS 地址，或本机 localhost 地址创建通行密钥。');
  throw error;
 }
}
