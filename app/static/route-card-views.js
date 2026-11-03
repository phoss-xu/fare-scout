import {tr} from './i18n.js';
import {amount,escape} from './format.js';
import {duration} from './flights.js';
import {routeName} from './route-projection.js';
let catalog;
export async function loadDestinationPhotos() {
  if(!catalog)catalog=fetch('/destination-photos.json').then(async r=>{if(!r.ok)throw new Error(`Destination photos HTTP ${r.status}`);return r.json();}).catch(error=>{catalog=undefined;console.info('Destination photographs unavailable',error.message);return {};});
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
  const offer=group.offers[0],photo=photos[group.to],name=routeName(group);
  const image=photo?`<img src="${escape(photo.path)}" alt="${escape(name)}" loading="lazy" width="96" height="140">`:`<span class="destination-image-fallback" aria-hidden="true"><span>✈</span><b>${escape(group.to)}</b></span>`;
  return `<article class="map-destination-card"><button type="button" class="map-destination-row" data-map-pick="${index}"><span class="destination-image">${image}</span><span class="destination-copy"><strong>${escape(name)}</strong><span class="destination-dates">${dates(offer)} · ${group.offers.length}${offer.inbound?tr(' 组往返',' return quotes'):tr(' 组单程',' one-way quotes')}</span><span class="destination-flight">${tr('去','Out')} ${duration(offer.outbound.durationSeconds)}${offer.inbound?` · ${tr('返','Back')} ${duration(offer.inbound.durationSeconds)}`:''}</span><span class="destination-bags">${bags(offer.baggage)}</span><span class="destination-price"><b>${escape(amount(offer.price,offer.currency))}</b><small>${adults}${offer.inbound?tr(' 人往返起',' travellers, return from'):tr(' 人单程起',' travellers, one-way from')}</small></span></span></button>${photo?`<a class="destination-photo-credit" href="${escape(photo.source)}" target="_blank" rel="noopener noreferrer" title="${escape(photo.author)} · ${escape(photo.license)}" aria-label="${escape(name)}${tr('图片来源',' photo source')}">ⓘ</a>`:''}</article>`;
}
export function destinationHero(group,photos) {
  const photo=photos[group.to];if(!photo)return '';
  return `<div class="destination-hero"><img src="${escape(photo.path)}" alt="${escape(routeName(group))}" width="400" height="180"><a href="${escape(photo.source)}" target="_blank" rel="noopener noreferrer">${escape(photo.author)} · ${escape(photo.license)} ↗</a></div>`;
}
