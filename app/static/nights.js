import {tr} from './i18n.js';
/** Two accessible native sliders sharing one track and the existing form fields. */
export function constrainNights(lower, upper, moved) {
  const clamp=value=>Math.min(30,Math.max(1,Math.round(Number(value)||1)));
  let low=clamp(lower), high=clamp(upper);
  if(low>high) {if(moved==='min_nights') low=high;else high=low;}
  return [low,high];
}
export function setupNights(form) {
  const low=form.elements.min_nights, high=form.elements.max_nights;
  const slider=form.querySelector('.night-slider'), output=form.querySelector('#night-value');
  let dragging, overlapStart;
  function render(moved) {
    const [a,b]=constrainNights(low.value,high.value,moved);
    low.value=a;high.value=b;output.textContent=a===b?`${a}${tr(" 晚"," nights")}`:`${a}${tr(" 至 "," to ")}${b}${tr(" 晚"," nights")}`;
    low.setAttribute('aria-valuetext',`${a}${tr(" 晚"," nights")}`);high.setAttribute('aria-valuetext',`${b}${tr(" 晚"," nights")}`);
    low.setAttribute('aria-valuemax',b);high.setAttribute('aria-valuemin',a);
    slider.style.setProperty('--range-start',`${(a-1)/29*100}%`);
    slider.style.setProperty('--range-end',`${(30-b)/29*100}%`);
  }
  [low,high].forEach(input=>input.addEventListener('input',()=>render(input.name)));
  function move(event) {
    if(!dragging) return;
    const rect=slider.getBoundingClientRect();
    const value=Math.round(1+Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width))*29);
    if(overlapStart!==undefined && value!==overlapStart){dragging=value<overlapStart?low:high;overlapStart=undefined;dragging.focus();}
    dragging.value=value;
    dragging.dispatchEvent(new Event('input',{bubbles:true}));
  }
  slider.addEventListener('pointerdown',event=>{
    event.preventDefault();
    const rect=slider.getBoundingClientRect(), value=1+(event.clientX-rect.left)/rect.width*29;
    dragging=event.target===low?low:event.target===high?high:Math.abs(value-Number(low.value))<=Math.abs(value-Number(high.value))?low:high;
    overlapStart=low.value===high.value?Number(low.value):undefined;
    dragging.focus();slider.setPointerCapture(event.pointerId);move(event);
  });
  slider.addEventListener('pointermove',move);
  const end=()=>{if(dragging) dragging.dispatchEvent(new Event('change',{bubbles:true}));dragging=undefined;overlapStart=undefined;};
  slider.addEventListener('pointerup',end);slider.addEventListener('pointercancel',end);
  document.addEventListener('languagechange',()=>render());
  render();return {reset:()=>render()};
}
