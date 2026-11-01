/** Navigation and disclosure behavior for the existing workspace. */
export function setupWorkspace() {
  const nav=document.querySelector('.tabs'), heading=document.querySelector('#workspace-heading');
  const buttons=[...nav.querySelectorAll('[data-tab]')];
  const titles={watches:['我的出行监控','持续关注你想去的地方'],offers:['机票机会','查看监控最近一次返回的报价'],alerts:['提醒中心','关注降价与预算内的行程']};
  function select(tab, focus=false) {
    const name=tab.dataset.tab;
    buttons.forEach(button=>{const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.setAttribute('aria-controls',`${button.dataset.tab}-panel`);});
    ['deals','watches','offers','alerts'].forEach(key=>document.querySelector(`#${key}-panel`).hidden=key!==name);
    heading.hidden=name==='deals';
    if(titles[name]) {document.querySelector('#workspace-title').textContent=titles[name][0];document.querySelector('#workspace-caption').textContent=titles[name][1];}
    if(focus) tab.focus();
  }
  nav.addEventListener('click',event=>{const tab=event.target.closest('[data-tab]');if(tab) select(tab);});
  nav.addEventListener('keydown',event=>{
    const current=buttons.indexOf(document.activeElement);
    if(current<0 || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    select(buttons[index],true);
  });
  select(buttons.find(button=>button.getAttribute('aria-selected')==='true') || buttons[0]);
  document.addEventListener('invalid',event=>{let ancestor=event.target.parentElement;while(ancestor){if(ancestor.tagName==='DETAILS') ancestor.open=true;ancestor=ancestor.parentElement;}},true);
  document.addEventListener('click',event=>document.querySelectorAll('.holiday-popover[open],.search-advanced[open]').forEach(details=>{if(!details.contains(event.target)) details.open=false;}));
}
export function setupSearchLayout(form,panel) {
  const anywhere=form.elements.anywhere;
  function sync() {
    panel.querySelector('#deal-destination').hidden=false;
    panel.querySelector('#deal-destination').classList.toggle('place-anywhere',anywhere.checked);
    panel.querySelector('#deal-anywhere').hidden=!anywhere.checked;
    const count=form.elements.adults.value, stops=form.elements.max_stops;
    const filters=[`${count} 位成人`,stops.value==='-1'?'不限中转':stops.options[stops.selectedIndex].text];
    if(Number(form.elements.budget.value)) filters.push(`预算 HK$${form.elements.budget.value}`);
    panel.querySelector('#deal-filter-summary').textContent=filters.join(' · ');
  }
  form.addEventListener('input',sync);form.addEventListener('change',sync);
  form.addEventListener('click',event=>{
    const preset=event.target.closest('[data-deal-range]');
    if(preset) form.querySelectorAll('[data-deal-range]').forEach(button=>button.setAttribute('aria-pressed',String(button===preset)));
    else if(event.target.closest('[data-holiday]')) form.querySelectorAll('[data-deal-range]').forEach(button=>button.setAttribute('aria-pressed','false'));
  });
  ['start','end'].forEach(name=>form.elements[name].addEventListener('input',()=>form.querySelectorAll('[data-deal-range]').forEach(button=>button.setAttribute('aria-pressed','false'))));
  return {reset(){sync();form.querySelectorAll('details').forEach(details=>details.open=false);form.querySelectorAll('[data-deal-range]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.dealRange==='30')));}};
}
