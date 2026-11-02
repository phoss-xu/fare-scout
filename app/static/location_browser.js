import {tr} from './i18n.js';
import {request} from './api.js';
import {escape} from './format.js';
const kinds={get country(){return tr("国家/地区","Country/region");},get city(){return tr("城市","City");},get airport(){return tr("机场","Airport");},get group(){return tr("范围","Scope");}};
let count=0, menuRequest;

export function locationBrowser({label,multiple,values,choose}) {
  const dialog=document.createElement('dialog'), id=`location-browser-${++count}`;
  dialog.className='location-dialog';dialog.setAttribute('aria-labelledby',id);
  dialog.innerHTML=`<div class="dialog-head"><div><h2 id="${id}${tr("\">选择","\">Choose ")}${label}${tr("</h2></div><button type=\"button\" class=\"icon-btn\" data-lb-close aria-label=\"关闭地点选择\">×</button></div><input class=\"location-browser-search\" type=\"search\" aria-label=\"在地点浏览器搜索","</h2></div><button type=\"button\" class=\"icon-btn\" data-lb-close aria-label=\"Close location picker\">×</button></div><input class=\"location-browser-search\" type=\"search\" aria-label=\"Search locations: ")}${label}${tr("\" placeholder=\"输入城市、国家、机场或代码\"><nav class=\"location-categories\" aria-label=\"地点分类\"></nav><p class=\"location-browser-note\" role=\"status\"></p><div class=\"location-browser-body\"></div><div class=\"location-browser-footer\"><span class=\"location-selection-summary\"></span><button type=\"button\" class=\"primary\" data-lb-close>完成选择</button></div>","\" placeholder=\"Enter a city, country, airport or code\"><nav class=\"location-categories\" aria-label=\"Location categories\"></nav><p class=\"location-browser-note\" role=\"status\"></p><div class=\"location-browser-body\"></div><div class=\"location-browser-footer\"><span class=\"location-selection-summary\"></span><button type=\"button\" class=\"primary\" data-lb-close>Done</button></div>")}`;
  document.body.append(dialog);
  const input=dialog.querySelector('input'), nav=dialog.querySelector('nav');
  function chrome() {
    dialog.querySelector('h2').textContent=tr('选择','Choose ')+(label==='出发地'?tr('出发地','departure'):tr('目的地','destinations'));
    input.placeholder=tr('输入城市、国家、机场或代码','Enter a city, country, airport or code');
    input.setAttribute('aria-label',tr('搜索地点','Search locations'));
    dialog.querySelector('.location-browser-footer button').textContent=tr('完成选择','Done');
    dialog.querySelector('.icon-btn').setAttribute('aria-label',tr('关闭地点选择','Close location picker'));
    nav.setAttribute('aria-label',tr('地点分类','Location categories'));
  }
  document.addEventListener('languagechange',chrome);chrome();
  const note=dialog.querySelector('.location-browser-note'), body=dialog.querySelector('.location-browser-body');
  let active='global', rows=[], version=0, timer, sections=[];
  function footer() {
    const selected=values();
    dialog.querySelector('.location-selection-summary').textContent=selected.length?`${tr("已选 ","Selected: ")}${selected.length}${tr(" 个地点"," locations")}`:tr("未选择","Nothing selected");
    dialog.querySelectorAll('[data-lb-choice]').forEach(button=>button.setAttribute('aria-pressed',String(selected.includes(rows[Number(button.dataset.lbChoice)].id))));
  }
  function show(data) {
    sections=data;rows=[];
    body.innerHTML=sections.map(section=>`<section class="location-group"><h3>${escape(section.label)}</h3><div class="location-choice-grid">${section.locations.map(row=>{const index=rows.push(row)-1;return `<button type="button" data-lb-choice="${index}" aria-pressed="${values().includes(row.id)}"><strong>${escape(row.name===row.code?row.english_name:row.name)}</strong><small>${kinds[row.kind]} · ${escape(row.code)}</small></button>`;}).join('')}</div></section>`).join('') || tr("<p class=\"muted\">未找到地点</p>","<p class=\"muted\">No locations found</p>");
    body.scrollTop=0;footer();
  }
  async function load(group) {
    clearTimeout(timer);const current=++version;active=group;input.value='';
    nav.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lbGroup===active)));
    note.textContent=tr("正在加载地点…","Loading locations…");body.replaceChildren();
    try {
      const data=await request(`/api/locations?group=${encodeURIComponent(group)}`);
      if(current!==version || !dialog.open) return;
      note.textContent=data.note;
      if(data.passport) {
        const strong=document.createElement('strong');strong.textContent=`${tr("适用：","Applies to: ")}${data.passport}${tr(" · 核查 "," · Checked ")}${data.checked_at}。 `;note.prepend(strong);
        const link=document.createElement('a');link.href=data.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent=tr(" 查看官方条件 ↗"," View official conditions ↗");note.append(link);
      }
      const countries=data.sections.flatMap(section=>section.locations).filter(row=>row.kind==='country');
      const range=countries.length ? {id:`group:${data.id}`,kind:'group',name:data.id==='visa-free'?tr("免签精选","Visa-free selection"):data.label,code:`${countries.length}${tr(" 国/地区"," countries/regions")}`,members:countries.map(row=>row.id)} : null;
      show(range ? [{label:tr("整个范围","Entire scope"),locations:[range]},...data.sections] : data.sections);
    } catch(error) {if(current===version && dialog.open){note.textContent=error.message;body.replaceChildren();}}
  }
  async function search() {
    const query=input.value.trim();if(!query){load(active);return;}
    const current=++version;nav.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed','false'));
    note.textContent=tr("搜索中…","Searching…");
    try {
      const data=await request(`/api/locations?q=${encodeURIComponent(query)}`);
      if(current!==version || !dialog.open) return;
      note.textContent='';
      show([{label:tr("搜索结果","Search results"),locations:data.locations}]);
    } catch(error){if(current===version && dialog.open){note.textContent=error.message;body.replaceChildren();}}
  }
  input.addEventListener('input',()=>{version+=1;clearTimeout(timer);timer=setTimeout(search,200);});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();clearTimeout(timer);search();}});
  dialog.addEventListener('click',event=>{
    if(event.target.closest('[data-lb-close]')) dialog.close();
    const group=event.target.closest('[data-lb-group]');if(group) load(group.dataset.lbGroup);
    const button=event.target.closest('[data-lb-choice]');
    if(button){const error=choose(rows[Number(button.dataset.lbChoice)],multiple);if(error){note.textContent=error;return;}footer();if(!multiple) dialog.close();}
  });
  dialog.addEventListener('close',()=>{version+=1;clearTimeout(timer);});
  return {async open(group) {
    if(group) active=group;
    if(dialog.open) return;dialog.showModal();note.textContent=tr("正在加载分类…","Loading categories…");input.value='';const current=++version;
    try {
      menuRequest ||= request('/api/locations?groups=1').catch(error=>{menuRequest=undefined;throw error;});
      const data=await menuRequest;if(current!==version || !dialog.open) return;
      nav.innerHTML=data.groups.map(group=>`<button type="button" data-lb-group="${escape(group.id)}" aria-pressed="${group.id===active}">${escape(group.label)}</button>`).join('');
      load(active);
    } catch(error){if(current===version && dialog.open) note.textContent=error.message;}
  },close(){if(dialog.open) dialog.close();}};
}
