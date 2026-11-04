import {iconLabel} from './ui-icons.js';
import {currencyLabel} from './currency.js';
import {tr} from './i18n.js';
import {escape} from './format.js';
export const shareURL=id=>new URL('/share.html?id='+encodeURIComponent(id),location.origin).href;
export function shareSummary(s) {
  const o=s.offer.outbound,b=s.offer.inbound;
  return `${o.from} → ${o.to} · ${o.departureTime.slice(0,10)}${b?' — '+b.departureTime.slice(0,10):''} · ${s.adults}${b?tr(' 人往返',' travellers, return'):tr(' 人单程',' travellers, one-way')} · ${currencyLabel(s.currency)} ${s.offer.price}`;
}
export async function tripImage(s,url) {
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=920;const c=canvas.getContext('2d');
  c.fillStyle='#f6f2e9';c.fillRect(0,0,1200,920);c.fillStyle='#203f36';c.font='22px sans-serif';c.fillText('FARE SCOUT / A LITTLE FURTHER',72,80);
  const o=s.offer.outbound,b=s.offer.inbound;c.font='bold 72px sans-serif';c.fillText(`${o.from}  →  ${o.to}`,72,215);
  c.font='28px sans-serif';c.fillText(`${o.departureTime.slice(0,10)}${b?'  —  '+b.departureTime.slice(0,10):''}`,72,290);
  c.fillText(`${s.adults}${b?tr(' 人往返',' travellers, return'):tr(' 人单程',' travellers, one-way')} · ${tr('经济舱','Economy')}`,72,343);
  c.fillStyle='#d65b35';c.font='bold 70px sans-serif';c.fillText(`${currencyLabel(s.currency)} ${s.offer.price.toLocaleString()}`,72,460);
  c.fillStyle='#203f36';c.font='26px sans-serif';c.fillText(`${o.from} ${o.departureTime.slice(11,16)} → ${o.to} ${o.arrivalTime.slice(11,16)}`,72,535);
  if(b)c.fillText(`${b.from} ${b.departureTime.slice(11,16)} → ${b.to} ${b.arrivalTime.slice(11,16)}`,72,580);
  c.fillStyle='#676b65';c.font='21px sans-serif';
  c.fillText(tr('机场当地时间 · 行李与最终价格请前往预订页核对','Airport local time · Confirm baggage and final price when booking'),72,655);
  c.fillText(tr('报价查询时间：','Quote checked: ')+(s.checked_at?new Date(s.checked_at).toLocaleString() : tr('暂缺','unavailable')),72,704);
  c.fillText(tr('分享时的报价快照，价格可能变化','Shared quote snapshot. Prices may change.'),72,744);
  const lines=url.match(/.{1,88}/g)||[];c.font='18px sans-serif';lines.forEach((line,i)=>c.fillText(line,72,805+i*26));
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error(tr('图片生成失败，请重试。','Could not generate image. Try again.'))),'image/png'));
}
export function shareMarkup(s,url) {
  return `<p class="trip-share-summary">${escape(shareSummary(s))}</p><p class="form-hint">${tr('持有链接的人可查看此行程，不包含你的邮箱、预算或提醒设置。','Anyone with the link can view this trip. Your email, budget and alert settings stay private.')}</p><label>${tr('行程链接','Trip link')}<input class="trip-share-link" readonly value="${escape(url)}"></label><div class="trip-share-actions"><button type="button" class="primary icon-action" data-share-copy aria-label="${escape(tr('复制链接','Copy link'))}" title="${escape(tr('复制链接','Copy link'))}">${iconLabel('copy',tr('复制链接','Copy link'))}</button><button type="button" class="small-btn icon-action" data-share-system aria-label="${escape(tr('系统分享','Share via…'))}" title="${escape(tr('系统分享','Share via…'))}">${iconLabel('share',tr('系统分享','Share via…'))}</button><button type="button" class="small-btn icon-action" data-share-image aria-label="${escape(tr('生成分享图','Create image'))}" title="${escape(tr('生成分享图','Create image'))}">${iconLabel('image',tr('生成分享图','Create image'))}</button></div><a class="small-btn icon-action" href="${escape(url)}" target="_blank" rel="noopener noreferrer" title="${tr('预览分享页面','Preview shared page')}">${iconLabel('external',tr('预览分享页面','Preview shared page'))}</a><p class="trip-dialog-status" role="status"></p><div class="trip-image-preview"></div>`;
}
export function bindShare(dialog,s,url) {
  let imageURL;const status=dialog.querySelector('.trip-dialog-status');
  dialog.querySelector('[data-share-copy]').onclick=async()=>{try {await navigator.clipboard.writeText(url);status.textContent=tr('链接已复制','Link copied');}catch{dialog.querySelector('input').select();status.textContent=tr('请长按或按 Ctrl/Cmd+C 复制链接','Select and copy the link with Ctrl/Cmd+C');}};
  const system=dialog.querySelector('[data-share-system]');system.hidden=!navigator.share;
  system.onclick=async()=>{try{await navigator.share({title:'Fare Scout',text:shareSummary(s),url});}catch(e){if(e.name!=='AbortError')status.textContent=tr('分享失败，可复制链接重试。','Sharing failed. Copy the link instead.');}};
  dialog.querySelector('[data-share-image]').onclick=async event=>{const b=event.currentTarget;b.disabled=true;try{const blob=await tripImage(s,url);if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(blob);dialog.querySelector('.trip-image-preview').innerHTML=`<img src="${imageURL}" alt="${tr('行程分享图','Trip share image')}"><a class="small-btn icon-action" href="${imageURL}" download="fare-scout-trip.png" title="${tr('下载图片','Download image')}">${iconLabel('download',tr('下载图片','Download image'))}</a>`;}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
  dialog.addEventListener('close',()=>{if(imageURL)URL.revokeObjectURL(imageURL);},{once:true});
}
