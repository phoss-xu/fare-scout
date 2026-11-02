import {request} from './api.js';
import {dealCards,watchDraft} from './deal_views.js';
const $=s=>document.querySelector(s);
const time=value=>value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚未查询';
const delivery={pending:'等待推送时间',waiting_config:'等待发信服务启用',retry:'邮件失败，稍后重试',failed:'邮件发送失败',sent:'邮件已发送',cancelled:'邮件已取消',skipped:'邮件已过期，已跳过',sending:'邮件投递中'};

export function dailyCards(offers,adults) {
  return dealCards(offers,offers,adults,true);
}

export function setupDaily(refresh,toast,openWatch,applyPreferences) {
  const form=$('#daily-form');let dirty=false,initialized=false,epoch=0,enabled=false,edition;
  function selectView(name) {
    $('#daily-content').hidden=name!=='daily';$('#search-content').hidden=name!=='search';
    document.querySelectorAll('[data-discovery-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.discoveryView===name)));
  }
  document.querySelectorAll('[data-discovery-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.discoveryView)));
  $('#deals-form').addEventListener('submit',()=>selectView('search'));
  $('#daily-settings-open').addEventListener('click',()=>$('#daily-dialog').showModal());
  $('#daily-offers').addEventListener('click',async event=>{
    const button=event.target.closest('[data-daily-watch]');if(!button || !edition) return;
    const offer=edition.offers[Number(button.dataset.dailyWatch)];if(!offer) return;
    button.disabled=true;try {await openWatch(watchDraft(offer,edition.config));} catch(error){toast(error.message);} finally{button.disabled=false;}
  });
  form.addEventListener('input',()=>dirty=true);
  form.addEventListener('change',()=>dirty=true);
  $('#daily-email-settings').addEventListener('click',()=>{$('#daily-dialog').close();$('[data-tab="alerts"]').click();$('#email-recipient').focus();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('[type=submit]'),generation=epoch;
    button.disabled=true;$('#daily-error').textContent='';
    const body=Object.fromEntries(new FormData(form));
    body.origins=new FormData(form).getAll('origins');
    body.enabled=form.elements.enabled.checked;body.prefer_red_eye=form.elements.prefer_red_eye.checked;
    try {
      await request('/api/daily',body);
      if(generation!==epoch) return;
      dirty=false;$('#daily-dialog').close();toast(body.enabled?'推荐偏好已保存，之后每天替你留意。':'推荐偏好已保存，每日推送已暂停。');await refresh();
    } catch(error) {if(generation===epoch) $('#daily-error').textContent=error.message;}
    finally {if(generation===epoch) button.disabled=false;}
  });
  return {
    reset(){epoch++;dirty=false;initialized=false;enabled=false;edition=undefined;form.reset();form.querySelector('[type=submit]').disabled=false;$('#daily-error').textContent='';$('#daily-offers').replaceChildren();$('#daily-status').textContent='';$('#daily-settings-open').hidden=true;$('#discovery-views').hidden=true;selectView('search');},
    render(state) {
      $('#daily-settings-open').hidden=!state.daily;$('#discovery-views').hidden=!state.daily;
      if(!state.daily) return;
      const {settings:c,edition:e,next_due}=state.daily;edition=e;
      applyPreferences(c);
      if(!enabled) {selectView('daily');enabled=true;}
      $('#daily-settings-open').textContent=c.enabled?`每天 ${c.push_time} 推送 · 修改偏好 ↗`:'开启每日推送 ↗';
      $('#daily-preference-summary').textContent=`${c.origins.map(o=>o==='airport:HKG'?'香港':'深圳').join(' / ')}出发 · 周末与节假日 · ${c.max_leave_days?`最多请假 ${c.max_leave_days} 天`:'不请假'} · 至少玩 ${c.min_full_days} 个白天${c.prefer_red_eye?' · 凌晨往返优先':''}`;
      $('#daily-extra-summary').textContent=`机场、预算与游玩时间 · ${c.budget?`HK$${c.budget} 内`:'预算不限'} · 至少 ${c.min_full_days} 个白天`;
      if(!initialized || !dirty) {
        initialized=true;
        for(const [key,value] of Object.entries(c)) {
          if(key==='origins') {form.querySelectorAll('[name=origins]').forEach(el=>el.checked=value.includes(el.value));continue;}
          const el=form.elements[key];if(!el) continue;
          if(el.type==='checkbox') el.checked=value;else el.value=value;
        }
      }
      $('#daily-next').textContent=c.enabled?`下次计划推送：${time(next_due)}（北京时间）；提前约 30 分钟查价，完成后投递。`:'每日推荐已暂停，保存后可随时开启。';
      $('#daily-mail-status').textContent=(state.query_enabled===false?'当前环境未开启真实查价。':'')+(state.email.configured?`推送至 ${state.email.recipient}`:'发信服务尚未启用，开启后推荐先保存在网页中。');
      $('#daily-status').textContent=!e?(c.enabled?`每天 ${c.push_time} 更新，第一批机票正在等待下次查价。`:'开启每日推送后，适合你的行程会持续出现在这里。'):e.status==='preparing'?`${e.day} 正在查价，结果会自动更新。`:
        `${e.day} · ${e.status==='error'?'本轮查询失败，暂时无法生成推荐':e.offers.length?`${e.offers.length} 个目的地`:'本轮有限结果没有匹配行程'} · ${e.failures}/${e.total} 组失败 · 最近查询 ${time(e.checked_at)} · ${delivery[e.mail_status] || ''}`;
      const view=e?.status==='error'?'error':e?.status==='preparing'?'preparing':e?'empty':'initial';
      const copy={initial:['好周末，值得每天留意。','留下你的偏好，我们每天替你找香港、深圳出发的周末与假期机票。'],empty:['这次还没找到合适的行程。','本次有限结果没有匹配，可以调整请假天数或预算；不代表市场上没有航班。'],error:['今天的查询还没有完成。','数据源暂时未能返回报价，稍后再来看看。'],preparing:['正在为下一个周末找机票。','结果会在这里更新，合适的行程也会按你设定的时间推送。']}[view];
      $('#daily-offers').innerHTML=e?.status==='ready' && e.offers.length?dailyCards(e.offers,e.config.adults):`<div class="discovery-empty"><div><h3>${copy[0]}</h3><p>${copy[1]}</p></div><div class="empty-route" aria-hidden="true"><span>周末</span><img src="/assets/airplane-tilt.svg" alt=""><span>远方</span></div></div>`;
    }
  };
}
