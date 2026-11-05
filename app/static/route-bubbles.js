import {displayAmount,currencySymbol} from './currency.js';
export function bubblePrice(value,currency) {
  const p=displayAmount(value,currency);
  return `${p.converted?'≈ ':''}${currencySymbol(p.code)}${p.amount.replace(/\.00$/,'')}`;
}
/** Select readable price pins at their real positions; density grows with the viewport. */
export function bubbleLayout(points,width,height,selected=-1,reserved=[]) {
  const boxes=[],limit=Math.min(32,Math.max(3,Math.floor(width*height/17000)));
  for(const point of points.slice().sort((a,b)=>(b.index===selected)-(a.index===selected) || a.price-b.price)) {
    if(boxes.length>=limit)break;
    const w=Math.max(58,bubblePrice(point.price,point.currency).length*8+20),h=34,x=point.x-w/2,y=point.y-h-10;
    if(x<6 || x+w>width-6 || y<6 || y+h>height-35)continue;
    if(point.index!==selected && reserved.some(p=>x<p.x+p.w+8 && x+w+8>p.x && y<p.y+p.h+8 && y+h+8>p.y))continue;
    if(boxes.some(p=>x<p.x+p.w+12 && x+w+12>p.x && y<p.y+p.h+10 && y+h+10>p.y))continue;
    boxes.push({...point,x,y,w,h});
  }
  return boxes;
}
export function routeBounds(groups,airports) {
  const coordinates=groups.flatMap(g=>[airports[g.from],airports[g.to]]);
  const longs=coordinates.map(p=>(p[0]+360)%360).sort((a,b)=>a-b);let gap=-1,start=0;
  for(let i=0;i<longs.length;i++){
    const next=longs[(i+1)%longs.length]+(i===longs.length-1?360:0);
    if(next-longs[i]>gap){gap=next-longs[i];start=next%360;}
  }
  const xs=coordinates.map(p=>((p[0]-start)%360+360)%360+start),ys=coordinates.map(p=>p[1]);
  return [[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]];
}
