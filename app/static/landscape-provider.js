import {landscapes, photoPath} from './landscape-data.js';

export const REFRESH_MS = 60 * 60 * 1000;
const CACHE_KEY = 'fare-scout:landscape:feed:v2';
const LICENSE = 'https://unsplash.com/license';
const cdnIds = {
  harbour:'photo-1621609582945-7769dbd34277',
  beach:'photo-1725789644182-060da96d5049',
  sculpture:'photo-1542715539-63b5fd3d3b9f',
};
const lake = {id:'braies',category:'nature',label:'山湖',kind:'山湖 / ALPINE LAKE',
  title:'Lago di Braies.',name:'布莱埃斯湖',location:'意大利 · 南蒂罗尔',
  description:'山间湖水与岸边船屋。',author:'Luca Bravo',
  source:'https://unsplash.com/photos/zAjdgNXsMeg',position:'50% 50%'};
const remote = (place, imageId) => ({...place,
  imageUrl:`https://images.unsplash.com/${imageId}?fm=jpg&fit=crop&w=1600&h=1000&q=85`,
  downloadUrl:`https://images.unsplash.com/${imageId}?fm=jpg&fit=crop&w=1600&h=1000&q=85`,
  license:'Unsplash License',licenseUrl:LICENSE});
// Editorial catalogue; author, source and CDN identity are recorded in CREDITS.md.
// This does not call the authenticated Unsplash API or scrape its pages at runtime.
export const remoteLandscapes = [remote(lake,'photo-1470770841072-f978cf4d019e'),
  ...landscapes.filter(place=>cdnIds[place.id]).map(place=>remote(place,cdnIds[place.id]))];
export const defaultLandscape = {...landscapes.find(place=>place.id==='forest'),
  imageUrl:'/assets/places/forest.jpg',downloadUrl:'/assets/places/forest.jpg',
  license:'Unsplash License',licenseUrl:LICENSE,local:true};
export function validPhoto(photo) {
  return Boolean(photo && remoteLandscapes.some(item=>item.id===photo.id &&
    ['imageUrl','downloadUrl','source','licenseUrl','author','name'].every(key=>photo[key]===item[key])));
}
/** Decode the actual remote image before displaying or caching its metadata. */
export async function loadLandscapeImage(photo) {
  const img = new Image();
  img.crossOrigin = 'anonymous';img.referrerPolicy = 'no-referrer';
  img.src = photo.imageUrl;
  let timer;
  try {
    await Promise.race([img.decode(),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('Landscape image timed out')),12000);
    })]);
    if(img.naturalWidth<1200 || img.naturalWidth<=img.naturalHeight) throw new Error('Invalid landscape dimensions');
  } finally {clearTimeout(timer);}
}
/** Try alternate curated photos on failure; retain one successfully loaded photo per hour. */
export async function fetchLandscape({loadImage=loadLandscapeImage,storage,now=Date.now(),random=()=>crypto.getRandomValues(new Uint32Array(1))[0],force=false,excludeId}={}) {
  let previous;
  try {
    storage ??= globalThis.localStorage;
    previous=JSON.parse(storage.getItem(CACHE_KEY));
  } catch(error) {console.info('Landscape cache unavailable',error.name);}
  const failures=[];
  if(!force && previous?.photo?.id!==excludeId && validPhoto(previous?.photo) && now>=previous.at && now-previous.at<REFRESH_MS) {
    try {await loadImage(previous.photo);return previous.photo;}
    catch(error) {failures.push(error);}
  }
  const candidates=remoteLandscapes.filter(photo=>photo.id!==previous?.photo?.id && photo.id!==excludeId);
  const offset=random()%candidates.length;
  for(let i=0;i<Math.min(3,candidates.length);i++) {
    const photo=candidates[(offset+i)%candidates.length];
    try {
      await loadImage(photo);
      try {storage.setItem(CACHE_KEY,JSON.stringify({at:now,photo}));}
      catch(error) {console.info('Landscape cache could not be saved',error.name);}
      return photo;
    } catch(error) {failures.push(error);console.warn(`Landscape candidate failed: ${photo.id} · ${error.name}: ${error.message}`);}
  }
  throw new AggregateError(failures,'Unsplash landscape images unavailable');
}
export const landscapeImage = place => place.imageUrl || photoPath(place);
