import {sampledDays} from './deal_views.js';
import {escape,fareNumber,flightDate} from './format.js';
import {displayAmount,currencyLabel} from './currency.js';
import {tr} from './i18n.js';

export function datePriceRail(offers,{day='',destination='',currency='HKD'}={}) {
  const scoped=offers.filter(o=>!destination || (o.destination_id || o.outbound.to)===destination);
  const dates=sampledDays(scoped),minimum=Math.min(...dates.map(([,p])=>p)),maximum=Math.max(...dates.map(([,p])=>p));
  return `<button type="button" data-deal-day="" aria-pressed="${!day}">${tr('全部日期','All dates')}</button>`+dates.map(([date,value])=>{
    const lowest=value===minimum,height=maximum>0?Math.max(2,Math.round(value/maximum*32)):2;
    return `<button type="button" class="date-fare${lowest?' is-lowest':''}" data-deal-day="${date}" aria-pressed="${date===day}"><span>${escape(flightDate(date,true))}</span><strong>${escape(fareNumber(value,currency))}</strong><span class="fare-bar-track" aria-hidden="true"><svg viewBox="0 0 100 32" preserveAspectRatio="none"><rect x="15" y="${32-height}" width="70" height="${height}" rx="2"/></svg></span><small>${lowest?tr('最低起价','Lowest from'):tr('起价','From')}</small></button>`;
  }).join('');
}

export function resultPriceNote(result,destination='') {
  const currency=result.config.currency || 'HKD',p=displayAmount(0,currency);
  const basis=result.config.trip_type==='oneway'?tr('单程总价','one-way total'):tr('往返总价','return total');
  const converted=p.converted?tr(` · 参考汇率 ${p.date}`,` · Reference rate ${p.date}`):'';
  return tr(`金额：${currencyLabel(p.code)}（${p.code}） · ${result.config.adults} 人${basis}${converted}。日期栏：${destination || '所有目的地'}当日起价，停留晚数与航班可能不同；仅含已返回报价。未列出日期不代表无票。`,
    `Currency: ${p.code} · ${result.config.adults} travellers, ${basis}${converted}. Dates: lowest returned fare per departure day for ${destination || 'all destinations'}; stays and flights may differ. Unlisted dates may still have flights.`);
}
