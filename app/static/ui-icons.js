import {escape} from './format.js';

/** Shared action symbols; labels remain available to assistive technology and tooltips. */
export const icons={
 check:'<path d="m5 12 4 4L19 6"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 play:'<path d="m8 4 12 8-12 8Z"/>',
 pause:'<path d="M8 4v16M16 4v16"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
 cards:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
 heartBroken:'<path d="m12 4-2 4 4 3-4 3 2 7M8.5 4.2A5.5 5.5 0 0 0 3.1 13L12 21l8.9-8a5.5 5.5 0 0 0-5.4-8.8"/>',
 share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 login:'<path d="M14 3h6v18h-6M3 12h12m-4-4 4 4-4 4"/>',
 userPlus:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m3-13v8m-4-4h8"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
 undo:'<path d="M3 10h11a6 6 0 0 1 0 12M3 10l5-5M3 10l5 5"/>',
 back:'<path d="m11 5-7 7 7 7M4 12h17"/>',
 key:'<circle cx="8" cy="9" r="5"/><path d="m12 13 9 9m-5-5 3-3m-6 0 3-3"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/>',
 external:'<path d="M14 3h7v7M21 3 10 14m0-10H3v17h17v-7"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
 fingerprint:'<path d="M7 15a13.5 13.5 0 0 1 26 5c0 7-1 11-3 15M4 22c0-2 0-3 .5-5M10 9a16 16 0 0 1 26 12M8 32c3-4 3-7 3-12a9 9 0 0 1 18 0c0 8-1 11-4 17M5 28c2-3 2-5 2-8M12 36c4-5 5-9 5-16a3 3 0 0 1 6 0c0 8-1 12-3 17M16 37c3-6 3-11 3-17M25 9c-5-3-11-1-14 3"/>'
};
export const icon=name=>`<svg viewBox="${name==='fingerprint'?'0 0 40 40':'0 0 24 24'}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
export const iconLabel=(name,label)=>`${icon(name)}<span class="action-label sr-only">${escape(label)}</span>`;
export function setIconButton(button,name,label=button.textContent) {
 button.dataset.uiIcon=name;
 button.innerHTML=iconLabel(name,label);
 button.setAttribute('aria-label',label);button.title=label;
}
export function setButtonLabel(button,label) {
 const text=button.querySelector?.('.action-label');
 if(text) text.textContent=label;else button.textContent=label;
 button.setAttribute('aria-label',label);button.title=label;
}
