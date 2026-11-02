import {request} from './api.js';
import {escape} from './format.js';
import {locationBrowser} from './location_browser.js';
import {subscribeHistory,rememberLocation} from './location_history.js';
const names={country:'国家/地区',city:'城市',airport:'机场'};

export function picker(root,multiple,changed=()=>{},{editableSelection=false,maxChoices=100}={}) {
  let selected=[],results=[],version=0,timer,editing=false;
  root.classList.toggle('place-editable',editableSelection);
  const label=multiple?'目的地':'出发地';
  root.innerHTML=`<div class="place-title">${label}<span>输入或按地区选择</span></div><div class="place-search"><input aria-label="搜索${label}" placeholder="城市、国家、机场或代码" autocomplete="off"><button type="button" class="place-browse" aria-label="按地区浏览${label}" data-browse>浏览</button></div><div class="place-results" role="listbox" aria-label="${label}候选" hidden></div><div class="place-selected"></div><div class="place-recent" aria-label="最近选择的${label}" hidden></div><p class="place-history-status" role="status"></p><p class="place-message" role="status"></p>`;
  const input=root.querySelector('input'), list=root.querySelector('.place-results');
  const chips=root.querySelector('.place-selected'), message=root.querySelector('.place-message');
  const browser=locationBrowser({label,multiple,values:()=>selected.map(row=>row.id),choose});
  const recent=root.querySelector('.place-recent'),role=multiple?'destination':'origin';
  let history=[];
  function renderHistory(){
    const rows=history.filter(row=>!selected.some(item=>item.id===row.id));
    recent.hidden=!rows.length;
    recent.innerHTML=`<span>最近</span>${rows.map(row=>`<button type="button" data-recent="${row.id}" title="${escape(row.name)} · ${names[row.kind]} ${row.code}" aria-label="选择最近${label}：${escape(row.name)}，${names[row.kind]} ${row.code}">${escape(row.kind==='airport'?(row.city_name||row.name):row.name)}<small>${row.code}</small></button>`).join('')}`;
  }
  subscribeHistory((data,status)=>{history=data[role];renderHistory();root.querySelector('.place-history-status').textContent=status;});
  function card(row){
    const details=`<span><strong>${escape(row.name)}</strong><small>${names[row.kind]} · ${row.code}</small></span>`;
    if(!multiple) return `<button type="button" class="place-current" data-edit-place aria-label="更换出发地，当前${escape(row.name)}">${details}<span class="place-change">更换 ↗</span></button>`;
    return `<div class="place-card"><button type="button" class="place-current" data-browse aria-label="调整目的地，当前${escape(row.name)}">${details}<span class="place-change">调整 ↗</span></button><button type="button" class="place-card-remove" data-remove="${row.id}" aria-label="移除${escape(row.name)}">×</button></div>`;
  }
  function render() {
    const compact=editableSelection && selected.length && !editing;
    root.querySelector('.place-search').hidden=Boolean(compact);
    chips.innerHTML=compact?selected.map(card).join('')+(multiple?'<button type="button" class="place-add" data-browse>＋ 添加目的地</button>':''):selected.map(row=>`<span class="place-chip"><span>${escape(row.name)} <small>${names[row.kind]} · ${row.code}</small></span><button type="button" data-remove="${row.id}" aria-label="移除${escape(row.name)}">×</button></span>`).join('');
    renderHistory();changed();
  }
  function choose(row,toggle=false) {
    const exists=selected.some(item=>item.id===row.id);
    if(multiple && !exists && selected.length>=maxChoices) return `本次最多选择 ${maxChoices} 个地点范围，请先移除一个。`;
    version+=1;clearTimeout(timer);
    selected=multiple?(toggle&&exists?selected.filter(item=>item.id!==row.id):[...selected.filter(item=>item.id!==row.id),row]):[row];
    editing=false;list.hidden=true;input.value='';message.textContent='';render();
    if(!(toggle&&exists)) rememberLocation(role,row);
    return '';
  }
  async function search() {
    if(!input.value.trim()){list.hidden=true;message.textContent='也可以点击“浏览”，按地区选地点。';return;}
    const current=++version;message.textContent='正在查找地点…';
    try {
      const data=await request(`/api/locations?q=${encodeURIComponent(input.value.trim())}`);
      if(current!==version) return;
      results=data.locations;
      list.innerHTML=results.map((row,index)=>`<button type="button" role="option" aria-selected="false" data-choice="${index}"><span><strong>${escape(row.name)}</strong><small>${escape(row.english_name)} · ${row.code}</small><small>${escape(row.country_name)}${row.kind==='airport'?` · ${escape(row.city_name)}`:''}</small></span><span class="place-kind">${names[row.kind]}</span></button>`).join('');
      list.hidden=false;message.textContent=results.length?'从候选中选择地点。':'没有找到地点，请换中文、英文或代码试试。';
    } catch(error){if(current===version){list.hidden=true;message.textContent=error.message;}}
  }
  input.addEventListener('input',()=>{version+=1;if(!multiple && selected.length){selected=[];render();}clearTimeout(timer);timer=setTimeout(search,250);});
  input.addEventListener('focus',()=>{if(input.value.trim()) search();});
  input.addEventListener('keydown',event=>{if(event.key==='Escape') list.hidden=true;if(event.key==='Enter'){event.preventDefault();clearTimeout(timer);search();}});
  root.addEventListener('click',event=>{
    if(event.target.closest('[data-edit-place]')){editing=true;render();input.focus();message.textContent='输入地点或点击浏览，选择新的出发地。';}
    if(event.target.closest('[data-browse]')){version+=1;clearTimeout(timer);list.hidden=true;browser.open();}
    const choice=event.target.closest('[data-choice]');if(choice){const error=choose(results[Number(choice.dataset.choice)]);if(error) message.textContent=error;}
    const previous=event.target.closest('[data-recent]');if(previous){const row=history.find(item=>item.id===previous.dataset.recent);if(row){const error=choose(row);if(error) message.textContent=error;}}
    const remove=event.target.closest('[data-remove]');if(remove){selected=selected.filter(row=>row.id!==remove.dataset.remove);render();}
  });
  document.addEventListener('click',event=>{if(!list.hidden && !root.contains(event.target)){version+=1;list.hidden=true;}});
  return {values:()=>selected.map(row=>row.id),browse:()=>browser.open(),clear(){version+=1;clearTimeout(timer);browser.close();selected=[];results=[];editing=false;input.value='';list.hidden=true;message.textContent='';render();},async setInitial(id){
    const current=++version;
    try{const data=await request(`/api/locations?id=${encodeURIComponent(id)}`);if(current===version){selected=[data.location];render();}}
    catch(error){if(current===version) message.textContent=error.message;}
  },async setValues(ids){
    clearTimeout(timer);list.hidden=true;input.value='';message.textContent='';const current=++version;
    const data=await Promise.all(ids.map(id=>request(`/api/locations?id=${encodeURIComponent(id)}`)));
    if(current===version){selected=data.map(row=>row.location);render();}
  }};
}

export function setupLocations(form) {
  function summary(){
    const count=destinations.values().length,jobs=count*(form.elements.mode.value==='weekend'?Number(form.elements.weeks.value):1);
    document.querySelector('#location-summary').textContent=count?`已选 ${count} 个目的地范围，共 ${jobs} 组日期与范围。每轮最多查 12 组，其余轮询；国家和城市查询返回有限结果。`:'可按地区浏览，也可直接搜索城市、国家或具体机场。';
  }
  const origin=picker(document.querySelector('#origin-picker'),false,summary);
  const destinations=picker(document.querySelector('#destination-picker'),true,summary);
  form.elements.mode.addEventListener('change',summary);form.elements.weeks.addEventListener('change',summary);
  return {async fill(from,to){await Promise.all([origin.setValues([from]),destinations.setValues(to)]);},reset(active=true){origin.clear();destinations.clear();if(active) origin.setInitial('airport:HKG');},values(){
    if(!origin.values().length) throw new Error('请从候选中选择出发地。');
    if(!destinations.values().length) throw new Error('请至少选择一个目的地。');
    return {origin:origin.values()[0],destinations:destinations.values()};
  }};
}
