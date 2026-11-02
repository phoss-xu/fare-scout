import {landscapes, photoPath} from './landscape-data.js';

export const REFRESH_MS = 60 * 60 * 1000;
const CACHE_KEY = 'fare-scout:landscape:feed:v1';
const categories = ['landscapes', 'coasts', 'forests', 'mountains', 'islands', 'bodies of water'];
export const defaultLandscape = {...landscapes.find(place => place.id === 'forest'),
  imageUrl:'/assets/places/forest.jpg', downloadUrl:'/assets/places/forest.jpg',
  license:'Unsplash License', licenseUrl:'https://unsplash.com/license', local:true};
const plain = value => String(value || '').replace(/<[^>]*>/g, '').replace(/&(?:amp|quot|lt|gt|#39);/g,
  entity => ({'&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>','&#39;':"'"}[entity])).trim();
function trusted(value, host) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === host && !url.username && !url.password; }
  catch { return false; }
}
export function permittedLicense(value) {
  return /^https:\/\/creativecommons\.org\/(?:licenses\/by(?:-sa)?\/(?:2\.0|2\.5|3\.0|4\.0)|publicdomain\/zero\/1\.0)\/$/.test(value);
}
export function normalizePhoto(page) {
  const info = page?.imageinfo?.[0], meta = info?.extmetadata;
  if (!meta || !Number.isFinite(info.width) || !Number.isFinite(info.height) || !['image/jpeg','image/png'].includes(info.mime) || info.width < 1200 || info.width <= info.height) return null;
  const licenseUrl = String(meta.LicenseUrl?.value || '').replace(/^http:/, 'https:').replace(/\/?$/, '/');
  const author = plain(meta.Artist?.value).slice(0, 180), license = plain(meta.LicenseShortName?.value);
  if (!author || !license || !permittedLicense(licenseUrl) || !trusted(info.thumburl, 'upload.wikimedia.org') ||
    !trusted(info.url, 'upload.wikimedia.org') || !trusted(info.descriptionurl, 'commons.wikimedia.org')) return null;
  return {id:`commons:${page.pageid}`, title:'Somewhere.', name:plain(meta.ObjectName?.value || page.title?.replace(/^File:/,'')).slice(0,100),
    location:'世界风景 · Wikimedia Commons', description:plain(meta.ImageDescription?.value).slice(0,220) || '让眼前的风景，成为下一次出发的灵感。',
    kind:'精选风景 / FIELD NOTES', author, source:info.descriptionurl, imageUrl:info.thumburl, downloadUrl:info.thumburl,
    license, licenseUrl, position:'50% 50%'};
}
export function validPhoto(photo) {
  return photo && typeof photo.id === 'string' && photo.id.startsWith('commons:') &&
    trusted(photo.imageUrl, 'upload.wikimedia.org') && trusted(photo.downloadUrl, 'upload.wikimedia.org') &&
    trusted(photo.source, 'commons.wikimedia.org') && permittedLicense(photo.licenseUrl) &&
    ['author','license','name','description','title','location','kind'].every(key => typeof photo[key] === 'string');
}
/** Public CORS API; no credentials. Cache one licensed photo per browser per hour. */
export async function fetchLandscape({fetcher = fetch, storage, now = Date.now()} = {}) {
  let previous;
  try {
    storage ??= globalThis.localStorage;
    previous = JSON.parse(storage.getItem(CACHE_KEY));
    if (validPhoto(previous?.photo) && now >= previous.at && now - previous.at < REFRESH_MS) return previous.photo;
  } catch (error) { console.info('Landscape cache unavailable', error.name); }
  const hour = Math.floor(now / REFRESH_MS);
  const params = new URLSearchParams({action:'query', format:'json', formatversion:'2', origin:'*',
    generator:'categorymembers', gcmtitle:`Category:Featured pictures of ${categories[hour % categories.length]}`,
    gcmtype:'file', gcmlimit:'12', prop:'imageinfo', iiprop:'url|extmetadata|size|mime', iiurlwidth:'1600',
    iiextmetadatafilter:'Artist|LicenseShortName|LicenseUrl|ObjectName|ImageDescription'});
  const response = await fetcher(`https://commons.wikimedia.org/w/api.php?${params}`, {credentials:'omit', signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error(`Landscape service HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(`Landscape service: ${data.error.code}`);
  const candidates = (data.query?.pages || []).map(normalizePhoto).filter(Boolean);
  const fresh = candidates.filter(photo => photo.id !== previous?.photo?.id);
  const pool = fresh.length ? fresh : candidates;
  if (!pool.length) throw new Error('No licensed landscape returned');
  const photo = pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length];
  try { storage.setItem(CACHE_KEY, JSON.stringify({at:now, photo})); }
  catch (error) { console.info('Landscape cache could not be saved', error.name); }
  return photo;
}
export const landscapeImage = place => place.imageUrl || photoPath(place);
