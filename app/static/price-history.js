import {request} from './api.js';
import {escape} from './format.js';
import {historyContent} from './price-history-view.js';
import {tr} from './i18n.js';
import {subscribePreferences} from './preferences.js';
import {ensureRates,subscribeCurrency} from './currency.js';

let installed=false;
export function setupPriceHistory() {
  if(installed || typeof document==='undefined')return;
  installed=true;
  let dialog,opener,data,current,currency,epoch=0;
  function render() {
    if(!dialog?.open || !data)return;
    dialog.querySelector('[data-price-content]').innerHTML=historyContent(data,current,currency);
  }
  subscribePreferences(render);subscribeCurrency(render);
  async function load(id) {
    const version=++epoch,content=dialog.querySelector('[data-price-content]');
    content.textContent=tr('正在加载价格历史…','Loading price history…');data=undefined;
    try {
      const next=await request('/api/price-history/'+encodeURIComponent(id));
      if(version!==epoch || !dialog.open)return;
      data=next;render();
    } catch(error) {
      if(version===epoch && dialog.open)content.innerHTML=`<p role="alert">${escape(error.message)}</p><button type="button" data-price-retry="${escape(id)}">${tr('重试','Retry')}</button>`;
    }
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-price-history]');if(!button)return;
    opener=button;current=Number(button.dataset.priceCurrent);currency=button.dataset.priceCurrency;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='price-history-dialog';dialog.setAttribute('aria-labelledby','price-history-title');
      dialog.innerHTML=`<header><div><p>FARE SCOUT</p><h2 id="price-history-title">${tr('这次价格怎么样','How does this fare compare?')}</h2></div><button type="button" data-price-close aria-label="${tr('关闭价格历史','Close price history')}">×</button></header><div data-price-content></div>`;
      document.body.append(dialog);
      dialog.addEventListener('close',()=>{epoch++;data=undefined;opener?.focus({preventScroll:true});});
      dialog.addEventListener('click',e=>{if(e.target.closest('[data-price-close]'))dialog.close();const retry=e.target.closest('[data-price-retry]');if(retry)void load(retry.dataset.priceRetry);});
    }
    if(!dialog.open)dialog.showModal();
    void ensureRates(currency);
    void load(button.dataset.priceHistory);
  });
}
