import {request} from './api.js';
import {tr} from './i18n.js';
import {dealCards} from './deal_views.js';
import {subscribePreferences} from './preferences.js';
import {subscribeCurrency} from './currency.js';
import {openShare,openTripAlert} from './trip-dialogs.js';
import {tripRecord,savedTrips,isSaved,updateSaved,resetTrips,syncTripButtons} from './trip-state.js';
export function setupTripActions(refresh,toast) {
  let owner=null,epoch=0,loaded=false,imported=false;const pending=new Set();
  const saved=document.querySelector('#saved-trips'),savedStatus=document.querySelector('#saved-trips-status');
  function render() {
    if(!owner){saved.replaceChildren();return;}
    document.querySelector('#saved-trip-count').textContent=savedTrips.length;
    if(!loaded)return;
    savedStatus.textContent=savedTrips.length?tr('收藏保留当时的报价，预订前请核价。','Saved quotes are snapshots. Confirm prices before booking.'):tr('遇见想去的地方，点一下心形留在这里。','Tap the heart on a trip to keep it here.');
    saved.innerHTML=savedTrips.map(t=>dealCards([t.snapshot.offer],[t.snapshot.offer],t.snapshot.adults,false,{...t.snapshot,archived:true})).join('');
  }
  document.addEventListener('tripschange',()=>{syncTripButtons();render();});
  document.addEventListener('locationnameschange',render);
  subscribePreferences(()=>{syncTripButtons();render();});subscribeCurrency(render);
  document.querySelectorAll('[data-my-trips-view]').forEach(b=>b.onclick=()=>{
    const showSaved=b.dataset.myTripsView==='saved';
    document.querySelectorAll('[data-my-trips-view]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));
    document.querySelector('#saved-trips-section').hidden=!showSaved;document.querySelector('#watches').hidden=showSaved;
  });
  async function load(version) {
    try {const result=await request('/api/trips');if(version!==epoch)return;loaded=true;updateSaved(result.trips);}
    catch(e){if(version===epoch){savedStatus.textContent=e.message;const retry=document.createElement('button');retry.className='text-btn';retry.textContent=tr('重试','Retry');retry.onclick=()=>load(version);savedStatus.append(retry);}}
  }
  async function importTrip(version) {
    const id=new URLSearchParams(location.search).get('trip');if(!id || imported)return;imported=true;
    try {
      const {snapshot:s}=await request('/api/shared-trips/'+encodeURIComponent(id));if(version!==epoch)return;
      const d=document.createElement('dialog');d.id='trip-import-dialog';d.className='trip-dialog';
      const close=document.createElement('button');close.className='icon-btn';close.textContent='×';close.ariaLabel=tr('关闭','Close');close.onclick=()=>d.close();
      d.append(close);const content=document.createElement('div');content.innerHTML=dealCards([s.offer],[s.offer],s.adults,false,{...s,archived:true});d.append(content);document.body.append(d);d.showModal();d.addEventListener('close',()=>d.remove(),{once:true});
      const url=new URL(location.href);url.searchParams.delete('trip');history.replaceState(null,'',url);
    }catch(e){if(version===epoch)toast(e.message);}
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-trip-save],[data-trip-share],[data-trip-alert]');if(!button || !owner)return;
    const ref=button.dataset.tripSave || button.dataset.tripShare || button.dataset.tripAlert,r=tripRecord(ref);if(!r)return;
    const version=epoch,isCurrent=()=>version===epoch;
    if(button.hasAttribute('data-trip-alert')){try{document.querySelector('#trip-import-dialog')?.close();openTripAlert(r.snapshot,refresh,toast,isCurrent);}catch(e){toast(e.message);}return;}
    if(pending.has(r.key))return;pending.add(r.key);button.disabled=true;
    try {
      if(button.hasAttribute('data-trip-share')){document.querySelector('#trip-import-dialog')?.close();await openShare(r.snapshot,isCurrent);return;}
      const removing=isSaved(r.key),result=await request('/api/trips',removing?{action:'remove',key:r.key}:r.snapshot);
      if(!isCurrent())return;updateSaved(result.trips);toast(removing?tr('已取消收藏','Removed from saved trips'):tr('已收藏到「我的行程」','Saved to My trips'));
      const undo=document.createElement('button');undo.className='text-btn';undo.textContent=tr('撤销','Undo');
      undo.onclick=async()=>{undo.disabled=true;try{const restored=await request('/api/trips',removing?r.snapshot:{action:'remove',key:r.key});if(isCurrent()){updateSaved(restored.trips);toast(tr('已撤销','Undone'));}}catch(e){if(isCurrent())toast(e.message);}};
      document.querySelector('#toast').append(undo);
    }catch(e){if(isCurrent())toast(e.message);}finally{pending.delete(r.key);button.disabled=false;}
  });
  return {reset(user){epoch++;owner=user?.id;loaded=false;imported=false;pending.clear();resetTrips();document.querySelector('#saved-trip-count').textContent='0';document.querySelectorAll('.trip-dialog[open]').forEach(d=>d.close());savedStatus.textContent=owner?tr('正在加载收藏…','Loading saved trips…'):'';if(owner){load(epoch);importTrip(epoch);}}};
}
