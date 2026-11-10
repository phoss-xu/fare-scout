// Cloudflare control-plane calls stay in this adapter. Never log response text or tokens.
export class EmailServiceError extends Error {
  constructor(status) { super('cloudflare_email_'+status);this.name='EmailServiceError';this.status=status; }
}
export const verificationReady = env => env.MAIL_ENABLED==='true' && env.MAIL_PROVIDER==='cloudflare' &&
  typeof env.EMAIL?.send==='function' && !!env.MAIL_FROM;
async function api(env,path='',body) {
  let response;
  try {
    response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_EMAIL_ACCOUNT_ID}/email/routing/addresses${path}`,{
      method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+env.CF_EMAIL_API_TOKEN,'Content-Type':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});
  } catch { throw new EmailServiceError('network'); }
  if(!response.ok) {await response.body?.cancel();throw new EmailServiceError(response.status);}
  let data;try {data=await response.json();} catch {throw new EmailServiceError('response');}
  if(data.success!==true) throw new EmailServiceError('rejected');
  return data;
}
export async function findDestination(env,address) {
  // The API has no email filter. Walk all pages; never confuse a failed lookup with absence.
  for(let page=1;page<=20;page++) {
    const data=await api(env,`?page=${page}&per_page=50`);
    if(!Array.isArray(data.result)) throw new EmailServiceError('response');
    const found=data.result.find(row=>row.email?.toLowerCase()===address);
    if(found) return found;
    if(data.result.length<50 || (data.result_info?.total_pages && page>=data.result_info.total_pages)) return null;
  }
  throw new EmailServiceError('pagination');
}
export async function createDestination(env,address) {return (await api(env,'',{email:address})).result;}
export async function getDestination(env,id) {
  try {return (await api(env,'/'+encodeURIComponent(id))).result;}
  catch(error) {if(error.status===404) return null;throw error;}
}
export async function sendCloudflare(env,recipient,subject,text,key) {
  // X header is diagnostic, not a provider idempotency guarantee.
  const html='<pre>'+text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</pre>';
  return env.EMAIL.send({from:env.MAIL_FROM,to:recipient,subject,text,html,headers:{'X-Fare-Scout-Delivery-ID':key}});
}
