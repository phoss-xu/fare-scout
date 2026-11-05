import {request} from './api.js';
import {escape} from './format.js';
import {tr} from './i18n.js';

const regions=[['southeast-asia','东南亚','Southeast Asia'],['east-asia','东亚','East Asia'],['europe','欧洲','Europe'],['oceania','大洋洲','Oceania'],['middle-east','中东','Middle East'],['north-america','北美','North America'],['south-america','南美','South America'],['africa','非洲','Africa']];

// Group canonical city records by their catalogue country, never by display text.
export function countryCities(sections) {
  const cities=sections.flatMap(section=>section.locations).filter(row=>row.kind==='city');
  const countries=new Map(sections.flatMap(section=>section.locations).filter(row=>row.kind==='country').map(row=>[row.code,row]));
  return [...new Set(cities.map(row=>row.country_code))].map(code=>({country:countries.get(code),cities:cities.filter(row=>row.country_code===code)}));
}

export function destinationDiscovery(root,{values,choose}) {
  const section=document.createElement('section');section.className='destination-discovery';
  root.insertBefore(section,root.querySelector('.place-recent'));
  let active=regions[0][0],data,version=0,loaded=false;
  const name=row=>tr(row.name,row.english_name || row.name);
  function render() {
    const focused=section.contains(document.activeElement)?document.activeElement?.dataset:null;
    section.innerHTML=`<div class="destination-discovery-heading"><strong>${tr('下一站灵感','Ideas for your next trip')}</strong><small>${tr('精选城市 · 可多选','Curated cities · Choose several')}</small></div><nav aria-label="${tr('推荐目的地区域','Destination regions')}">${regions.map(([id,zh,en])=>`<button type="button" data-discovery-region="${id}" aria-pressed="${id===active}">${tr(zh,en)}</button>`).join('')}</nav><div class="destination-discovery-countries"></div><p role="status"></p>`;
    if(focused?.discoveryRegion) section.querySelector(`[data-discovery-region="${focused.discoveryRegion}"]`)?.focus({preventScroll:true});
    if(!data) return;
    const selected=values();
    section.querySelector('.destination-discovery-countries').innerHTML=countryCities(data.sections).map(({country,cities})=>`<div class="destination-discovery-country"><span>${escape(country?name(country):tr(cities[0].country_name,cities[0].country_code))}</span><div>${cities.map(row=>`<button type="button" data-discovery-city="${escape(row.id)}" aria-pressed="${selected.includes(row.id)}">${escape(name(row))}${selected.includes(row.id)?' <span aria-hidden="true">✓</span>':''}</button>`).join('')}</div></div>`).join('');
    if(focused?.discoveryCity) section.querySelector(`[data-discovery-city="${focused.discoveryCity}"]`)?.focus({preventScroll:true});
  }
  async function load(region) {
    active=region;data=undefined;const current=++version;render();
    section.querySelector('[role=status]').textContent=tr('正在加载推荐城市…','Loading city ideas…');
    try {
      const result=await request(`/api/locations?group=${encodeURIComponent(region)}`);
      if(current!==version) return;
      data=result;render();
    } catch(error) {if(current===version) section.querySelector('[role=status]').textContent=error.message;}
  }
  section.addEventListener('click',event=>{
    event.stopPropagation();
    const region=event.target.closest('[data-discovery-region]');
    if(region){load(region.dataset.discoveryRegion);return;}
    const button=event.target.closest('[data-discovery-city]');
    if(!button || !data) return;
    const row=data.sections.flatMap(section=>section.locations).find(row=>row.id===button.dataset.discoveryCity);
    const error=choose(row,true);render();
    section.querySelector('[role=status]').textContent=error || '';
  });
  document.addEventListener('languagechange',render);
  const observer=new IntersectionObserver(entries=>{
    if(!loaded && entries.some(entry=>entry.isIntersecting)){loaded=true;load(active);observer.disconnect();}
  });
  render();observer.observe(section);
  return {render};
}
