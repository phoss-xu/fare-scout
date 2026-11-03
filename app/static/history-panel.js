import {request} from './api.js';
import {historyView} from './views.js';
import {tr} from './i18n.js';
export function historyPanel(container,dialog,getState) {
  let id,page,epoch=0,loading=false;
  function render() {
    const state=getState();
    if(!state || !id || !dialog.open || state.history_api && !page) return;
    container.innerHTML=historyView(state,id,page);
  }
  async function load(more=false) {
    const version=++epoch,watchId=id;loading=true;
    const button=container.querySelector('[data-history-more]');if(button) button.disabled=true;
    try {
      const next=await request(`/api/watches/${watchId}/history${more?'?before='+page.next_before:''}`);
      if(version!==epoch || id!==watchId || !getState()) return;
      page={...next,destinations:{...page?.destinations,...next.destinations},observations:more?[...page.observations,...next.observations]:next.observations};render();
    } catch(error) {
      if(version===epoch) {
        if(button) button.disabled=false;
        let message=container.querySelector('[data-history-error]');
        if(!message) {message=document.createElement('p');message.dataset.historyError='';container.append(message);}
        message.textContent=error.message;
        if(!page) {
          const retry=document.createElement('button');retry.type='button';retry.dataset.historyRetry='';retry.textContent=tr('重试','Retry');container.append(retry);
        }
      }
    } finally {if(version===epoch) loading=false;}
  }
  container.addEventListener('click',event=>{
    if(event.target.closest('[data-history-more]') && !loading) void load(true);
    if(event.target.closest('[data-history-retry]') && !loading) void load();
  });
  dialog.addEventListener('close',()=>{epoch++;loading=false;});
  return {open(watchId){id=watchId;page=undefined;dialog.showModal();
    if(getState().history_api) {container.textContent=tr('正在加载采样记录…','Loading price samples…');void load();} else render();
  },render,reset(){epoch++;id=undefined;page=undefined;loading=false;dialog.close();}};
}
