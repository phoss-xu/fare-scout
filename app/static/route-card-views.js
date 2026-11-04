import {tr} from './i18n.js';
import {amount,escape} from './format.js';
import {duration} from './flights.js';
import {routeName} from './route-projection.js';
let catalog,loadedPhotos={};
/** Resolve only explicit city/airport relationships from the maintained catalog. */
export function destinationPhoto(code,photos=loadedPhotos) {
  const photo=photos?.[code] || Object.values(photos || {}).find(p=>p.airports?.includes(code));
  const safe=value=>{try {const u=new URL(value,'https://fare-scout.invalid');return typeof value==='string' && u.protocol==='https:' && !value.startsWith('//');}catch{return false;}};
  return photo && safe(photo.path) && safe(photo.source)?photo:undefined;
}
function photoPosition(photo) {
  return photo.id?` data-destination-photo="${escape(photo.id)}"`:'';
}
let handlesErrors=false;
function handlePhotoErrors() {
  if(handlesErrors)return;handlesErrors=true;
  document.addEventListener('error',event=>{
    const img=event.target;if(!img.matches?.('.offer-photo img,.destination-image img,.destination-hero img'))return;
    console.info('Destination photograph unavailable',img.getAttribute('src'));
    const tile=img.closest('.watch-photo-tile');
    if(tile){
      const strip=tile.closest('.watch-photo-strip');tile.remove();
      if(!strip.querySelector('.watch-photo-tile'))strip.remove();
      return;
    }
    const cover=img.closest('.offer-photo,.destination-hero');
    if(cover){cover.remove();return;}
    const fallback=document.createElement('span');fallback.className='destination-image-fallback';fallback.textContent=img.parentElement.dataset.photo;fallback.setAttribute('aria-hidden','true');
    img.closest('.map-destination-card')?.querySelector('.destination-photo-credit')?.remove();img.replaceWith(fallback);
  },true);
}
export async function loadDestinationPhotos() {
  handlePhotoErrors();
  if(!catalog)catalog=fetch('/destination-photos.json').then(async r=>{if(!r.ok)throw new Error(`Destination photos HTTP ${r.status}`);loadedPhotos=await r.json();return loadedPhotos;}).catch(error=>{catalog=undefined;console.info('Destination photographs unavailable',error.message);return {};});
  return catalog;
}
function dates(offer) {
  const start=offer.outbound.departureTime.slice(0,10),end=offer.inbound?.departureTime.slice(0,10);
  if(!end) return start;
  return start.slice(0,4)===end.slice(0,4)?`${start.slice(5).replace('-','/')} – ${end.slice(5).replace('-','/')}`:`${start} – ${end}`;
}
function bags(baggage) {
  return [['personalItem',tr('随身','Personal')],['cabinBag',tr('手提','Cabin')],['checkedBag',tr('托运','Checked')]].map(([key,label])=>`${label} ${Number.isInteger(baggage?.[key])?baggage[key]+tr(' 件',' pcs'):tr('待核对','unconfirmed')}`).join(' · ');
}
export function destinationRow(group,index,photos,adults) {
  const offer=group.offers[0],photo=destinationPhoto(group.to,photos),name=routeName(group);
  const image=photo?`<img src="${escape(photo.path)}" alt="${escape(name)}" loading="lazy" decoding="async" width="96" height="140"${photoPosition(photo)}>`:`<span class="destination-image-fallback" aria-hidden="true"><span>✈</span><b>${escape(group.to)}</b></span>`;
  return `<article class="map-destination-card"><button type="button" class="map-destination-row" data-map-pick="${index}"><span class="destination-image" data-photo="${escape(group.to)}">${image}</span><span class="destination-copy"><strong>${escape(name)}</strong><span class="destination-dates">${dates(offer)} · ${group.offers.length}${offer.inbound?tr(' 组往返',' return quotes'):tr(' 组单程',' one-way quotes')}</span><span class="destination-flight">${tr('去','Out')} ${duration(offer.outbound.durationSeconds)}${offer.inbound?` · ${tr('返','Back')} ${duration(offer.inbound.durationSeconds)}`:''}</span><span class="destination-bags">${bags(offer.baggage)}</span><span class="destination-price"><b>${escape(amount(offer.price,offer.currency))}</b><small>${adults}${offer.inbound?tr(' 人往返起',' travellers, return from'):tr(' 人单程起',' travellers, one-way from')}</small></span></span></button>${photo?`<a class="destination-photo-credit" href="${escape(photo.source)}" target="_blank" rel="noopener noreferrer" title="${escape(photo.author)} · ${escape(photo.license)}" aria-label="${escape(name)}${tr('图片来源',' photo source')}">ⓘ</a>`:''}</article>`;
}
export function destinationHero(group,photos) {
  const photo=destinationPhoto(group.to,photos);if(!photo)return '';
  return `<div class="destination-hero"><img src="${escape(photo.path)}" alt="${escape(routeName(group))}" width="400" height="180" decoding="async"${photoPosition(photo)}><a href="${escape(photo.source)}" target="_blank" rel="noopener noreferrer">${escape(photo.author)} · ${escape(photo.license)} ↗</a></div>`;
}

/** Cover imagery is content; fares and controls retain the global theme. */
export function offerPhoto(offer,photos) {
  if(!offer?.outbound?.to)return '';
  const photo=destinationPhoto(offer.outbound.to,photos);
  if(!photo)return '';
  const name=routeName({to:offer.outbound.to,offers:[offer]});
  return `<figure class="offer-photo" data-photo="${escape(offer.outbound.to)}"><img src="${escape(photo.path)}" alt="${escape(name)}${tr('目的地风景',' destination scenery')}" loading="lazy" decoding="async" width="${Number.isInteger(photo.width)?photo.width:1600}" height="${Number.isInteger(photo.height)?photo.height:1067}"${photoPosition(photo)}><figcaption><strong>${escape(name)}</strong><a href="${escape(photo.source)}" target="_blank" rel="noopener noreferrer" title="${escape(photo.license)}">${escape(photo.author)} · ${tr('图片来源','Photo source')} ↗</a></figcaption></figure>`;
}


/** Use canonical scope identities; a country's cities are examples, never a replacement scope. */
export function watchPhotos(places,photos=loadedPhotos) {
  if(places.length===1 && ['city','airport'].includes(places[0].kind)) {
    return offerPhoto({outbound:{to:places[0].code},destination_name:places[0].name},photos);
  }
  const selected=new Map();
  const add=photo=>{if(photo && !selected.has(photo.path))selected.set(photo.path,photo);};
  const pools=[];
  const country=code=>{
    if(typeof code!=='string' || !/^[A-Z]{2}$/.test(code))return;
    pools.push(Object.entries(photos).filter(([,photo])=>photo.country_code===code)
      .map(([key])=>destinationPhoto(key,photos)).filter(Boolean));
  };
  for(const place of places) {
    if(['city','airport'].includes(place.kind))pools.push([destinationPhoto(place.code,photos)].filter(Boolean));
    else if(place.kind==='country')country(place.code);
    else if(place.kind==='group') {
      for(const member of place.members || []) {
        if(typeof member==='string' && /^country:[A-Z]{2}$/.test(member))country(member.slice(8));
      }
    }
  }
  // Give different selected locations a turn before showing another city in one country.
  for(let index=0;index<Math.max(0,...pools.map(pool=>pool.length)) && selected.size<2;index++) {
    for(const pool of pools){add(pool[index]);if(selected.size===2)break;}
  }
  const examples=[...selected.values()].slice(0,2);
  if(!examples.length)return '';
  const tiles=examples.map(photo=>{
    const name=tr(photo.city_name && photo.city_name!==photo.city_code?photo.city_name:photo.city,photo.city);
    return `<figure class="watch-photo-tile"><img src="${escape(photo.path)}" alt="${escape(name)}${tr('目的地风景',' destination scenery')}" loading="lazy" decoding="async" width="${Number.isInteger(photo.width)?photo.width:1600}" height="${Number.isInteger(photo.height)?photo.height:1067}" data-destination-photo="${escape(photo.id)}"><figcaption><strong>${escape(name)}</strong><a href="${escape(photo.source)}" target="_blank" rel="noopener noreferrer" title="${escape(photo.author)} · ${escape(photo.license)}">${escape(photo.author)} <span class="watch-photo-source">· ${tr('图片来源','Photo source')} ↗</span></a></figcaption></figure>`;
  }).join('');
  return `<section class="offer-photo watch-photo-strip" aria-label="${tr('范围内的部分目的地风景','Selected scenery within this scope')}"><div class="watch-photo-grid">${tiles}</div><p class="watch-photo-note">${tr('范围内的部分目的地风景','Selected scenery within this scope')}</p></section>`;
}
