import {locationName} from './location-names.js';
/** Equirectangular chart centered on the shortest longitude interval, including the date line. */
export function routeProjection(points,width=1000,height=560) {
  const longitudes=points.map(p=>(p[0]+360)%360).sort((a,b)=>a-b);
  let gap=-1,start=0;
  for(let i=0;i<longitudes.length;i++) {
    const next=longitudes[(i+1)%longitudes.length]+(i===longitudes.length-1?360:0);
    if(next-longitudes[i]>gap){gap=next-longitudes[i];start=next%360;}
  }
  const unwrap=lon=>((lon-start)%360+360)%360+start;
  const xs=points.map(p=>unwrap(p[0])),ys=points.map(p=>p[1]);
  const midX=(Math.min(...xs)+Math.max(...xs))/2,midY=(Math.min(...ys)+Math.max(...ys))/2;
  const spanX=Math.max(35,Math.max(...xs)-Math.min(...xs)),spanY=Math.max(24,Math.max(...ys)-Math.min(...ys));
  const scale=Math.min((width-140)/spanX,(height-150)/spanY);
  return ([lon,lat])=>{
    let x=unwrap(lon);if(x-midX>180)x-=360;if(x-midX< -180)x+=360;
    return [width/2+(x-midX)*scale,height/2-(lat-midY)*scale];
  };
}
export function groupedRoutes(offers,airports) {
  const groups=new Map(),missing=[];
  for(const offer of offers) {
    const {from,to}=offer.outbound;
    if(!airports[from] || !airports[to]){missing.push(offer);continue;}
    const key=`${from}:${to}`;
    if(!groups.has(key))groups.set(key,{from,to,offers:[]});
    groups.get(key).offers.push(offer);
  }
  for(const group of groups.values())group.offers.sort((a,b)=>a.price-b.price);
  return {groups:[...groups.values()],missing};
}
export function routeCurve(a,b) {
  const control=[(a[0]+b[0])/2,(a[1]+b[1])/2-Math.min(100,Math.hypot(b[0]-a[0],b[1]-a[1])*.22)];
  return {path:`M${a.join(',')} Q${control.join(',')} ${b.join(',')}`,middle:[(a[0]+2*control[0]+b[0])/4,(a[1]+2*control[1]+b[1])/4]};
}
/** Nearby destinations share one count marker until the user zooms in. */
export function clusterPoints(points,cell=44) {
  const buckets=new Map();
  for(const point of points) {
    const key=`${Math.floor(point.x/cell)}:${Math.floor(point.y/cell)}`;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(point);
  }
  return [...buckets.values()].map(items=>({items,x:items.reduce((s,p)=>s+p.x,0)/items.length,y:items.reduce((s,p)=>s+p.y,0)/items.length}));
}
/** Keep a small set of geographically anchored labels; never fill the map with price tiles. */
export const MAP_LABEL_SIZE=Object.freeze({width:150,height:64});
export function mapLabels(points,width,height,selected=-1,limit=6) {
  const placed=[];
  const sorted=points.slice().sort((a,b)=>(b.index===selected)-(a.index===selected) || a.price-b.price);
  for(const point of sorted) {
    if(placed.length>=limit)break;
    const {width:w,height:h}=MAP_LABEL_SIZE;
    const positions=[[point.x+14,point.y-h-8],[point.x-w-14,point.y-h-8],[point.x+14,point.y+12],[point.x-w-14,point.y+12]];
    const position=positions.find(([x,y])=>x>=8 && y>=8 && x+w<=width-8 && y+h<=height-8 && placed.every(p=>x+w+8<p.x || x>p.x+w+8 || y+h+8<p.y || y>p.y+h+8));
    if(position)placed.push({...point,x:position[0],y:position[1]});
  }
  return placed;
}
export const routeName=group=>locationName(group.to,'city',group.offers[0].destination_name || group.offers[0].outbound.segments?.at(-1)?.toCity);
