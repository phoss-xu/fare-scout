import {tr} from './i18n.js';
import {request} from './api.js';
import {escape} from './format.js';
import {destinationDiscovery} from './destination-discovery.js';
import {locationBrowser} from './location_browser.js';
import {subscribeHistory,rememberLocation} from './location_history.js';
const names={get country(){return tr("国家/地区","Country/region");},get city(){return tr("城市","City");},get airport(){return tr("机场","Airport");},get group(){return tr("范围","Scope");}};

export function picker(root,multiple,changed=()=>{},{editableSelection=false,maxChoices=100,label=multiple?'目的地':'出发地'}={}) {
  const labelText=()=>label==='出发地'?tr('出发地','Departure'):label==='避开范围'?tr('避开范围','Places to avoid'):tr('目的地','Destination');
  let selected=[],results=[],version=0,timer,editing=false;
  root.classList.toggle('place-editable',editableSelection);
  root.innerHTML=`<div class="place-title">${labelText()}${tr("<span>可多选</span></div><div class=\"place-search\"><input aria-label=\"搜索","<span>Multiple selections allowed</span></div><div class=\"place-search\"><input aria-label=\"Search ")}${labelText()}${tr("\" placeholder=\"城市、国家、机场或代码\" autocomplete=\"off\"><button type=\"button\" class=\"place-browse\" aria-label=\"按地区浏览","\" placeholder=\"City, country, airport or code\" autocomplete=\"off\"><button type=\"button\" class=\"place-browse\" aria-label=\"Browse by region: ")}${labelText()}${tr("\" data-browse>选择多个","\" data-browse>Choose multiple ")}${labelText()}</button></div><div class="place-results" role="listbox" aria-label="${labelText()}${tr("候选\" hidden></div><div class=\"place-selected\"></div><div class=\"place-recent\" aria-label=\"最近选择的"," suggestions\" hidden></div><div class=\"place-selected\"></div><div class=\"place-recent\" aria-label=\"Recently selected ")}${labelText()}" hidden></div><p class="place-history-status" role="status"></p><p class="place-message" role="status"></p>`;
  const input=root.querySelector('input'), list=root.querySelector('.place-results');
  const chips=root.querySelector('.place-selected'), message=root.querySelector('.place-message');
  const browser=locationBrowser({label,multiple,values:()=>selected.map(row=>row.id),choose});
  const recent=root.querySelector('.place-recent'),role=label==='出发地'?'origin':'destination';
  const discovery=multiple && label==='目的地'?destinationDiscovery(root,{values:()=>selected.map(row=>row.id),choose}):null;
  let history=[];
  function renderHistory(){
    const rows=history.filter(row=>!selected.some(item=>item.id===row.id));
    recent.hidden=!rows.length;
    recent.innerHTML=`${tr("<span>最近</span>","<span>Recent</span>")}${rows.map(row=>`<button type="button" data-recent="${row.id}" title="${escape(row.name)} · ${names[row.kind]} ${row.code}${tr("\" aria-label=\"选择最近","\" aria-label=\"Choose recent ")}${labelText()}：${escape(row.name)}，${names[row.kind]} ${row.code}">${escape(row.kind==='airport'?(row.city_name||row.name):row.name)}<small>${row.code}</small></button>`).join('')}`;
  }
  subscribeHistory((data,status)=>{history=data[role];renderHistory();root.querySelector('.place-history-status').textContent=status;});
  function card(row){
    const details=`<span><strong>${escape(row.name)}</strong><small>${names[row.kind]} · ${row.code}</small></span>`;
    if(!multiple) return `${tr("<button type=\"button\" class=\"place-current\" data-edit-place aria-label=\"更换出发地，当前","<button type=\"button\" class=\"place-current\" data-edit-place aria-label=\"Change departure, currently ")}${escape(row.name)}">${details}${tr("<span class=\"place-change\">更换 ↗</span></button>","<span class=\"place-change\">Change ↗</span></button>")}`;
    return `${tr("<div class=\"place-card\"><button type=\"button\" class=\"place-current\" data-browse aria-label=\"调整","<div class=\"place-card\"><button type=\"button\" class=\"place-current\" data-browse aria-label=\"Edit ")}${labelText()}${tr("，当前",", currently ")}${escape(row.name)}">${details}${tr("<span class=\"place-change\">调整 ↗</span></button><button type=\"button\" class=\"place-card-remove\" data-remove=\"","<span class=\"place-change\">Edit  ↗</span></button><button type=\"button\" class=\"place-card-remove\" data-remove=\"")}${row.id}${tr("\" aria-label=\"移除","\" aria-label=\"Remove ")}${escape(row.name)}">×</button></div>`;
  }
  document.addEventListener('languagechange',()=>{
    root.querySelector('.place-title').firstChild.nodeValue=labelText();
    root.querySelector('.place-title span').textContent=tr('可多选','Multiple selections allowed');
    input.placeholder=tr('城市、国家、机场或代码','City, country, airport or code');
    input.setAttribute('aria-label',tr('搜索','Search ')+labelText());
    root.querySelector('[data-browse]').textContent=tr('选择多个','Choose multiple ')+labelText();
    root.querySelector('[data-browse]').setAttribute('aria-label',tr('按地区浏览','Browse by region: ')+labelText());
    render();
  });
  function render() {
    const compact=editableSelection && selected.length && !editing;
    root.querySelector('.place-search').hidden=false;
    chips.innerHTML=compact?selected.map(card).join('')+(multiple?`${tr("<button type=\"button\" class=\"place-add\" data-browse>＋ 添加","<button type=\"button\" class=\"place-add\" data-browse>＋ Add ")}${labelText()}</button>`:''):selected.map(row=>`<span class="place-chip"><span>${escape(row.name)} <small>${names[row.kind]} · ${row.code}</small></span><button type="button" data-remove="${row.id}${tr("\" aria-label=\"移除","\" aria-label=\"Remove ")}${escape(row.name)}">×</button></span>`).join('');
    renderHistory();discovery?.render();changed();
  }
  function choose(row,toggle=false) {
    const exists=selected.some(item=>item.id===row.id);
    if(multiple && !exists && selected.length>=maxChoices) return `${tr("本次最多选择 ","Choose up to ")}${maxChoices}${tr(" 个地点范围，请先移除一个。"," location scopes; remove one first.")}`;
    version+=1;clearTimeout(timer);
    selected=multiple?(toggle&&exists?selected.filter(item=>item.id!==row.id):[...selected.filter(item=>item.id!==row.id),row]):[row];
    editing=false;list.hidden=true;input.value='';message.textContent='';render();
    if(!(toggle&&exists)) rememberLocation(role,row);
    return '';
  }
  async function search() {
    if(!input.value.trim()){list.hidden=true;message.textContent='';return;}
    const current=++version;message.textContent=tr("正在查找地点…","Searching locations…");
    try {
      const data=await request(`/api/locations?q=${encodeURIComponent(input.value.trim())}`);
      if(current!==version) return;
      results=data.locations;
      list.innerHTML=results.map((row,index)=>`<button type="button" role="option" aria-selected="false" data-choice="${index}"><span><strong>${escape(row.name)}</strong><small>${escape(row.english_name)} · ${row.code}</small><small>${escape(row.country_name)}${row.kind==='airport'?` · ${escape(row.city_name)}`:''}</small></span><span class="place-kind">${names[row.kind]}</span></button>`).join('');
      list.hidden=false;message.textContent=results.length?'':tr("未找到地点，试试其他名称或代码。","No locations found. Try another name or code.");
    } catch(error){if(current===version){list.hidden=true;message.textContent=error.message;}}
  }
  input.addEventListener('input',()=>{version+=1;if(!multiple && selected.length){selected=[];render();}clearTimeout(timer);timer=setTimeout(search,250);});
  input.addEventListener('focus',()=>{if(input.value.trim()) search();});
  input.addEventListener('keydown',event=>{if(event.key==='Escape') list.hidden=true;if(event.key==='Enter'){event.preventDefault();clearTimeout(timer);search();}});
  root.addEventListener('click',event=>{
    if(event.target.closest('[data-edit-place]')){editing=true;render();input.focus();message.textContent='';}
    if(event.target.closest('[data-browse]')){version+=1;clearTimeout(timer);list.hidden=true;browser.open();}
    const choice=event.target.closest('[data-choice]');if(choice){const error=choose(results[Number(choice.dataset.choice)]);if(error) message.textContent=error;}
    const previous=event.target.closest('[data-recent]');if(previous){const row=history.find(item=>item.id===previous.dataset.recent);if(row){const error=choose(row);if(error) message.textContent=error;}}
    const remove=event.target.closest('[data-remove]');if(remove){selected=selected.filter(row=>row.id!==remove.dataset.remove);render();}
  });
  document.addEventListener('click',event=>{if(!list.hidden && !root.contains(event.target)){version+=1;list.hidden=true;}});
  return {expandedCount:()=>new Set(selected.flatMap(row=>row.members || [row.id])).size,values:()=>selected.map(row=>row.id),browse:group=>browser.open(group),clear(){version+=1;clearTimeout(timer);browser.close();selected=[];results=[];editing=false;input.value='';list.hidden=true;message.textContent='';render();},async setInitial(id){
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
    const count=destinations.values().length,jobs=origin.expandedCount()*destinations.expandedCount()*(form.elements.mode.value==='weekend'?Number(form.elements.weeks.value):1);
    document.querySelector('#location-summary').textContent=count?`${jobs}${tr(" 组查询 · 每轮最多 12 组，分批查价"," query groups · Up to 12 per round")}`:'';
  }
  const origin=picker(document.querySelector('#origin-picker'),true,summary,{label:tr("出发地","Departure")});
  const destinations=picker(document.querySelector('#destination-picker'),true,summary);
  form.elements.mode.addEventListener('change',summary);form.elements.weeks.addEventListener('change',summary);
  return {async fill(from,to){await Promise.all([origin.setValues(Array.isArray(from)?from:[from]),destinations.setValues(to)]);},reset(active=true){origin.clear();destinations.clear();if(active) origin.setInitial('airport:HKG');},values(){
    if(!origin.values().length) throw new Error(tr("请选择出发地。","Choose a departure location."));
    if(!destinations.values().length) throw new Error(tr("请至少选择一个目的地。","Choose at least one destination."));
    return {origins:origin.values(),destinations:destinations.values()};
  }};
}
