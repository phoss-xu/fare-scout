import {ApiError,ensure} from './db.js';
const SECURITY={
  'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};
export function json(body,status=200,cookie) {
  return new Response(JSON.stringify(body),{status,headers:{...SECURITY,'Content-Type':'application/json; charset=utf-8',...(cookie?{'Set-Cookie':cookie}:{})}});
}
export async function data(request) {
  const url=new URL(request.url),origin=request.headers.get('Origin');
  ensure((!origin || origin===url.origin) && request.headers.get('Sec-Fetch-Site')!=='cross-site','请从本站网页发起操作。',403);
  ensure(request.headers.get('Content-Type')?.split(';')[0]==='application/json','请求格式不正确，请刷新页面重试。',415);
  ensure(!request.headers.has('Content-Length') || Number(request.headers.get('Content-Length'))<=16000,'请求内容过大。',413);
  const reader=request.body?.getReader();ensure(reader,'请求内容无效。');
  const parts=[];let size=0;
  for(;;) { const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>16000) { await reader.cancel();throw new ApiError('请求内容过大。',413); } parts.push(value); }
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts) { bytes.set(p,offset);offset+=p.length; }
  let value;
  try { value=JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError('请求内容无效，请检查后重试。'); }
  ensure(value && typeof value==='object' && !Array.isArray(value),'请求内容无效，请检查后重试。');
  return value;
}
export async function asset(request,env) {
  const url=new URL(request.url);
  if(url.pathname==='/setup') url.pathname='/';
  const response=await env.ASSETS.fetch(new Request(url,request));
  const headers=new Headers(response.headers);
  for(const [k,v] of Object.entries(SECURITY)) headers.set(k,v);
  return new Response(response.body,{status:response.status,headers});
}
