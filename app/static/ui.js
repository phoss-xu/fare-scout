import {tr} from './i18n.js';
/** Navigation and disclosure behavior for the existing workspace. */
export function setupWorkspace() {
  const nav=document.querySelector('.tabs'), heading=document.querySelector('#workspace-heading');
  const buttons=[...nav.querySelectorAll('[data-tab]')];
  function select(tab, focus=false) {
    const titles={watches:[tr("我的出行监控","Your travel watches"),''],offers:[tr("机票机会","Flight opportunities"),''],alerts:[tr("提醒中心","Alerts"),'']};
    const name=tab.dataset.tab;
    buttons.forEach(button=>{const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.setAttribute('aria-controls',`${button.dataset.tab}-panel`);});
    ['deals','watches','offers','alerts'].forEach(key=>document.querySelector(`#${key}-panel`).hidden=key!==name);
    document.querySelector('#new-watch').hidden=name!=='watches';
    heading.hidden=name==='deals';
    document.querySelector('#summary').hidden=name!=='watches';
    if(titles[name]) {document.querySelector('#workspace-title').textContent=titles[name][0];document.querySelector('#workspace-caption').textContent=titles[name][1];document.querySelector('#workspace-caption').hidden=!titles[name][1];}
    if(focus) tab.focus();
  }
  document.addEventListener('languagechange',()=>select(buttons.find(button=>button.getAttribute('aria-selected')==='true')));
  nav.addEventListener('click',event=>{const tab=event.target.closest('[data-tab]');if(tab) select(tab);});
  nav.addEventListener('keydown',event=>{
    const current=buttons.indexOf(document.activeElement);
    if(current<0 || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const visible=buttons.filter(b=>!b.hidden),position=visible.indexOf(document.activeElement);
    const index=event.key==='Home'?0:event.key==='End'?visible.length-1:(position+(event.key==='ArrowRight'?1:-1)+visible.length)%visible.length;
    select(visible[index],true);
  });
  select(buttons.find(button=>button.getAttribute('aria-selected')==='true') || buttons[0]);
  document.addEventListener('invalid',event=>{let ancestor=event.target.parentElement;while(ancestor){if(ancestor.tagName==='DETAILS') ancestor.open=true;ancestor=ancestor.parentElement;}},true);
  document.addEventListener('click',event=>document.querySelectorAll('.holiday-popover[open],.search-advanced[open]').forEach(details=>{if(!details.contains(event.target)) details.open=false;}));
}
export function setupSearchLayout(form,panel) {
  const anywhere=form.elements.anywhere;
  function sync() {
    panel.querySelector('#deal-destination').hidden=false;
    panel.querySelector('#deal-destination').classList.remove('place-anywhere');
    panel.querySelector('#deal-anywhere').hidden=true;
    const count=form.elements.adults.value, stops=form.elements.max_stops;
    const filters=[`${count}${tr(" 位成人"," adults")}`,stops.value==='-1'?tr("不限中转","Any stops"):stops.options[stops.selectedIndex].text];
    if(Number(form.elements.budget.value)) filters.push(`${tr("预算 HK$","Budget HK$")}${form.elements.budget.value}`);
    panel.querySelector('#deal-filter-summary').textContent=filters.join(' · ');
  }
  document.addEventListener('languagechange',sync);
  form.addEventListener('input',sync);form.addEventListener('change',sync);
  form.addEventListener('click',event=>{
    const preset=event.target.closest('[data-deal-range]');
    if(preset) form.querySelectorAll('[data-deal-range]').forEach(button=>button.setAttribute('aria-pressed',String(button===preset)));
    else if(event.target.closest('[data-holiday], [data-weekend]')) form.querySelectorAll('[data-deal-range]').forEach(button=>button.setAttribute('aria-pressed','false'));
  });
  ['start','end'].forEach(name=>form.elements[name].addEventListener('input',()=>form.querySelectorAll('[data-deal-range]').forEach(button=>button.setAttribute('aria-pressed','false'))));
  return {reset(){sync();form.querySelectorAll('details').forEach(details=>details.open=false);form.querySelectorAll('[data-deal-range]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.dealRange==='30')));}};
}
