import {request} from './api.js';
import {escape} from './format.js';
const kinds={country:'国家/地区',city:'城市',airport:'机场',group:'范围'};
let count=0, menuRequest;

export function locationBrowser({label,multiple,values,choose}) {
  const dialog=document.createElement('dialog'), id=`location-browser-${++count}`;
  dialog.className='location-dialog';dialog.setAttribute('aria-labelledby',id);
  dialog.innerHTML=`<div class="dialog-head"><div><p class="eyebrow">从想去的地方开始</p><h2 id="${id}">选择${label}</h2></div><button type="button" class="icon-btn" data-lb-close aria-label="关闭地点选择">×</button></div><input class="location-browser-search" type="search" aria-label="在地点浏览器搜索${label}" placeholder="输入城市、国家、机场或代码"><nav class="location-categories" aria-label="地点分类"></nav><p class="location-browser-note" role="status"></p><div class="location-browser-body"></div><div class="location-browser-footer"><span class="location-selection-summary"></span><button type="button" class="primary" data-lb-close>完成选择</button></div>`;
  document.body.append(dialog);
  const input=dialog.querySelector('input'), nav=dialog.querySelector('nav');
  const note=dialog.querySelector('.location-browser-note'), body=dialog.querySelector('.location-browser-body');
  let active='global', rows=[], version=0, timer, sections=[];
  function footer() {
    const selected=values();
    dialog.querySelector('.location-selection-summary').textContent=selected.length?`已选 ${selected.length} 个地点`:'可先浏览，再选择想去的地方';
    dialog.querySelectorAll('[data-lb-choice]').forEach(button=>button.setAttribute('aria-pressed',String(selected.includes(rows[Number(button.dataset.lbChoice)].id))));
  }
  function show(data) {
    sections=data;rows=[];
    body.innerHTML=sections.map(section=>`<section class="location-group"><h3>${escape(section.label)}</h3><div class="location-choice-grid">${section.locations.map(row=>{const index=rows.push(row)-1;return `<button type="button" data-lb-choice="${index}" aria-pressed="${values().includes(row.id)}"><strong>${escape(row.name===row.code?row.english_name:row.name)}</strong><small>${kinds[row.kind]} · ${escape(row.code)}</small></button>`;}).join('')}</div></section>`).join('') || '<p class="muted">没有找到地点，换个中文、英文名称或代码试试。</p>';
    body.scrollTop=0;footer();
  }
  async function load(group) {
    clearTimeout(timer);const current=++version;active=group;input.value='';
    nav.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lbGroup===active)));
    note.textContent='正在加载地点…';body.replaceChildren();
    try {
      const data=await request(`/api/locations?group=${encodeURIComponent(group)}`);
      if(current!==version || !dialog.open) return;
      note.textContent=data.note;
      if(data.passport) {
        const strong=document.createElement('strong');strong.textContent=`适用：${data.passport} · 核查 ${data.checked_at}。 `;note.prepend(strong);
        const link=document.createElement('a');link.href=data.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' 查看官方条件 ↗';note.append(link);
      }
      const countries=data.sections.flatMap(section=>section.locations).filter(row=>row.kind==='country');
      const range=countries.length ? {id:`group:${data.id}`,kind:'group',name:data.id==='visa-free'?'免签精选':data.label,code:`${countries.length} 国/地区`,members:countries.map(row=>row.id)} : null;
      show(range ? [{label:'整个范围 · 可与其他地点混选',locations:[range]},...data.sections] : data.sections);
    } catch(error) {if(current===version && dialog.open){note.textContent=error.message;body.replaceChildren();}}
  }
  async function search() {
    const query=input.value.trim();if(!query){load(active);return;}
    const current=++version;nav.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed','false'));
    note.textContent='正在搜索所有城市、国家和机场…';
    try {
      const data=await request(`/api/locations?q=${encodeURIComponent(query)}`);
      if(current!==version || !dialog.open) return;
      note.textContent='搜索覆盖所有地点，不受浏览分类限制。';
      show([{label:'搜索结果',locations:data.locations}]);
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
    if(dialog.open) return;dialog.showModal();note.textContent='正在加载分类…';input.value='';const current=++version;
    try {
      menuRequest ||= request('/api/locations?groups=1').catch(error=>{menuRequest=undefined;throw error;});
      const data=await menuRequest;if(current!==version || !dialog.open) return;
      nav.innerHTML=data.groups.map(group=>`<button type="button" data-lb-group="${escape(group.id)}" aria-pressed="${group.id===active}">${escape(group.label)}</button>`).join('');
      load(active);
    } catch(error){if(current===version && dialog.open) note.textContent=error.message;}
  },close(){if(dialog.open) dialog.close();}};
}
