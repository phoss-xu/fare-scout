import {getPreferences,subscribePreferences} from './preferences.js';
export const tr=(zh,en)=>getPreferences().language==='en'?en:zh;
const bindings=[];
export function applyLanguage() {
  document.documentElement.lang=getPreferences().language;
  for(const {node,zh,en,attribute} of bindings) {
    if(!node.isConnected) continue;
    if(attribute) node.setAttribute(attribute,tr(zh,en));else node.nodeValue=tr(zh,en);
  }
}
/** Explicit text-node and attribute bindings; never translate account or provider content. */
export function setupLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(element=>{
    for(const [index,en] of Object.entries(JSON.parse(element.dataset.i18n))) {
      const node=element.childNodes[Number(index)];
      if(node?.nodeType===3) bindings.push({node,zh:node.nodeValue,en});
    }
  });
  document.querySelectorAll('[data-i18n-attrs]').forEach(node=>{
    for(const [attribute,en] of Object.entries(JSON.parse(node.dataset.i18nAttrs))) bindings.push({node,attribute,zh:node.getAttribute(attribute),en});
  });
  let language=getPreferences().language;
  subscribePreferences(value=>{applyLanguage();if(language!==value.language){language=value.language;document.dispatchEvent(new Event('languagechange'));}});applyLanguage();
}
