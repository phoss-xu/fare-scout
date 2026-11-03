import {request} from './api.js';
import {dealCards} from './deal_views.js';
import {escape,time} from './format.js';
import {tr} from './i18n.js';
import {subscribeCurrency} from './currency.js';
const status=document.querySelector('#shared-status'),container=document.querySelector('#shared-offer');
const id=new URLSearchParams(location.search).get('id');
document.addEventListener('locationnameschange',()=>render());
let snapshot;
function render(){if(snapshot)container.innerHTML=dealCards([snapshot.offer],[snapshot.offer],snapshot.adults,false,{...snapshot,archived:true,public:true});}
try {
  if(!id)throw new Error(tr('分享链接不完整，请向发送者索取完整链接。','Incomplete share link. Ask the sender for the full link.'));
  const data=await request('/api/shared-trips/'+encodeURIComponent(id));snapshot=data.snapshot;render();subscribeCurrency(render);
  status.textContent=tr('报价查询于 ','Quote checked ')+(snapshot.checked_at?time(snapshot.checked_at):tr('时间暂缺','time unavailable'))+' · '+tr('分享于 ','Shared ')+time(data.created_at);
  const actions=document.querySelector('#shared-login-actions');actions.hidden=false;
  actions.innerHTML=`<a class="small-btn" href="/?trip=${escape(encodeURIComponent(id))}">${tr('登录后收藏','Sign in to save')}</a><a class="primary" href="/?trip=${escape(encodeURIComponent(id))}">${tr('登录后开启降价提醒','Sign in for price alerts')}</a>`;
}catch(e){status.textContent=e.message;container.replaceChildren();}
