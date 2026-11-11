import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {offerPhoto,boardingDestinationPhoto} from '../app/static/route-card-views.js';
const catalog=JSON.parse(await readFile(new URL('../app/static/destination-photos.json',import.meta.url)));
test('each catalog destination has a local cover with source attribution',async()=>{
 for(const [to,photo] of Object.entries(catalog)) {
  await access(new URL('../app/static'+photo.path,import.meta.url));
  const html=offerPhoto({outbound:{to},destination_name:photo.city},catalog);
  assert.ok(html.includes(photo.path));assert.ok(html.includes(photo.source));
  assert.ok(html.includes('loading="lazy"'));assert.ok(html.includes('rel="noopener noreferrer"'));
 }
});
test('unknown destinations and unsafe image/source URLs keep the plain fare surface',()=>{
 assert.equal(offerPhoto({},catalog),'');assert.equal(offerPhoto(undefined,catalog),'');
 const offer={outbound:{to:'ZZZ'}};
 assert.equal(offerPhoto(offer,catalog),'');
 for(const photo of [{path:'javascript:alert(1)',source:'https://example.com'},{path:'/a.jpg',source:'javascript:alert(1)'}])assert.equal(offerPhoto(offer,{ZZZ:photo}),'');
 const html=offerPhoto(offer,{ZZZ:{path:'/a.jpg',source:'https://example.com',author:'<script>',license:'"test"'}});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});

test('boarding pass uses only the destination photograph at its side',async()=>{
 const html=boardingDestinationPhoto({outbound:{from:'HKG',to:'HND'}},catalog);
 assert.equal((html.match(/class="offer-photo-tile"/g)||[]).length,1);
 assert.match(html,/data-side="to"/);assert.doesNotMatch(html,/data-side="from"/);
 assert.ok(html.includes(catalog.HND.path));assert.ok(!html.includes(catalog.HKG.path));
 assert.equal((offerPhoto({outbound:{from:'HKG',to:'HND'}},catalog).match(/offer-photo-tile/g)||[]).length,0);
 const css=(await readFile(new URL('../app/static/destination-photos.css',import.meta.url),'utf8'));
 assert.match(css,/\.offer-photo-tile\{[^}]*aspect-ratio:1/);
 assert.match(css,/\.offer-photo-tile\{aspect-ratio:16\/9/);
 const layout=(await readFile(new URL('../app/static/discovery-layout.css',import.meta.url),'utf8'));
 assert.match(layout,/grid-template-columns:minmax\(220px,280px\) minmax\(0,1fr\)/);
 assert.match(layout,/grid-template-columns:minmax\(72px,22vw\) minmax\(0,1fr\)/);
 assert.match(layout,/\.offer-photo:not\(\.watch-photo-strip\)\{display:block;grid-column:1;grid-row:1\/3/);
});

test('same-city passenger airports reuse their reviewed city cover in every view',async()=>{
 const {destinationPhoto,destinationRow,destinationHero}=await import('../app/static/route-card-views.js');
 for(const [code,key] of [['DMK','BKK'],['SZB','KUL'],['ICN','SEL'],['GMP','SEL'],['KIX','OSA'],['TSA','TPE'],['LHR','LON'],['CDG','PAR'],['FCO','ROM'],['JFK','NYC'],['DWC','DXB'],['GIG','RIO'],['SDU','RIO'],['EZE','BUE'],['AEP','BUE'],['GRU','SAO'],['VCP','SAO'],['SPX','CAI'],['HLA','JNB'],['WIL','NBO'],['RML','CMB'],['GOX','GOI'],['ARN','STO'],['YIA','JOG'],['ORD','CHI'],['MDW','CHI'],['IAD','WAS'],['DCA','WAS'],['CTS','SPK'],['OKD','SPK'],['NKM','NGO'],['CXR','NHA'],['OTP','BUH'],['BBU','BUH'],['DSS','DKR'],['GYD','BAK'],['MCO','ORL'],['DAL','DFW'],['TFS','TCI'],['TFN','TCI'],['KEF','REK'],['RKV','REK'],['CGK','JKT'],['HLP','JKT'],['KTI','PNH'],['ADB','IZM'],['ESB','ANK'],['EOH','MDE'],['PIK','GLA'],['BHD','BFS'],['BSL','EAP'],['MLH','EAP'],['YWH','YYJ'],['DTW','DTT']]) {
  assert.equal(destinationPhoto(code,catalog),catalog[key]);
  const offer={outbound:{to:code,departureTime:'2026-11-14T10:00:00',durationSeconds:7200},price:1000,currency:'HKD'};
  const group={to:code,offers:[offer]};
  for(const html of [offerPhoto(offer,catalog),destinationRow(group,0,catalog,1),destinationHero(group,catalog)]) {
   assert.ok(html.includes(catalog[key].path),code);
   assert.ok(html.includes(`data-destination-photo="${key}"`),code);
   assert.ok(!html.includes(' style='),'focal points must respect the existing CSP');
  }
 }
 assert.equal(destinationPhoto('ZZZ',catalog),undefined);
});
test('featured groups and additional curated travel destinations have reviewed covers',async()=>{
 const {destinationPhoto}=await import('../app/static/route-card-views.js');
 for(const city of 'HKG TYO OSA SEL BKK SIN KUL DPS LON PAR ROM NYC LAX SYD DXB MFM TPE KHH HKT SGN HAN MNL BJS CAN CKG CSX CTU HGH KMG SHA SIA SYX SZX TAO WUH XMN BKI PQC CJU CRK PUS AMS BCN FRA MUC PRG VIE ZRH MEX SFO YMQ YTO YVR AKL BNE MEL PER AUH DOH IST RIO BUE LIM BOG SCL SAO CPT CAI MRU JNB NBO KTM DEL BOM MLE CMB JAI GOI BLR ATH LIS BER MAD CPH STO OSL HEL CEB MPH PPS SAI LPQ RGN LOP JOG CHI LAS SEA HNL BOS WAS YYC YOW RAK CMN TUN ZNZ SEZ ADD KGL DAR MCT BAH AMM JED RUH ALA TBS TAS BUD KRK DBV EDI VCE FLR NAP MLA ZQN CHC WLG OOL CNS ADL HBA NAN FUK NGO OKA SPK NHA DLI DVO DAC HAV CUN SJU PTY SJO CTG UIO LPB DUB BRU WAW BUH TLL RIX VNO SOF LXR SSH HRG ACC LOS DKR WDH VFA BAK EVN NQZ BSZ TLV BEY ISB KHI MIA ORL DEN DFW AUS MSY SAN PDX PMI IBZ TCI FNC RHO CFU LCA REK JKT SUB KCH LGK BWN VTE PNH DIL CCU HYD COK ATQ PBH LHE LJU ZAG BEG SJJ TIA SKP TGD AYT IZM ANK BJV NAV BUS MDE GYE MVD USH BRC MDZ SSA REC MAN GLA BFS BRS BHX LPL NCL ORK NCE LYS MRS BOD TLS SXB NTE LIL VLC SVQ BIO GRX TRN BLQ PSA GOA RAR NOU HAM DUS CGN STR DRS NUE SZG INN HDB OST GVA EAP BRN ANR HIJ SDJ NGS KOJ KMJ TAK PHL PIT YQB YHZ SLC YYJ USM KBV HUI JHB CEI UTP ATL PHX MSP BNA CLT DTT ALG ORN FEZ TNG DUR AGA LXA KWL LJG URC HRB DLC BGO GOT GDN WRO LUX AAR PMO CTA VRN CAG OLB BRI NAS PUJ MBJ AUA CUR BGI SAL RTB MGA GUA BZE LIR GDL MTY MID PVR OAX'.split(' ')) {
  assert.ok(destinationPhoto(city,catalog),`Missing featured city ${city}`);
 }
 const used=new Map();
 for(const [code,p] of Object.entries(catalog)) {
  for(const airport of p.airports || []) {
   if(used.has(airport))assert.equal(used.get(airport),p.path,`${airport}: conflicting city covers`);
   used.set(airport,p.path);
  }
  assert.ok(p.width>=1600 && p.height>=800,`${code}: HD source dimensions`);
 }
});
test('map images apply the same source validation as fare covers',async()=>{
 const {destinationRow,destinationHero}=await import('../app/static/route-card-views.js');
 const group={to:'ZZZ',offers:[{outbound:{departureTime:'2026-11-14',durationSeconds:3600},price:1}]};
 const photos={ZZZ:{path:'javascript:alert(1)',source:'https://example.com'}};
 assert.ok(!destinationRow(group,0,photos,1).includes('<img src='));
 assert.equal(destinationHero(group,photos),'');
});

test('single-destination watches and observed fare cards share covers without changing quote fields',async()=>{
 const {watchCards,offerCards}=await import('../app/static/views.js');
 const snapshot=JSON.parse(await readFile(new URL('./fixtures/trip-snapshot.json',import.meta.url)));
 const watch={id:7,origin:'HKG',destinations:['SIN'],mode:'fixed',trip_type:'roundtrip',start:'2099-11-14',end:'2099-11-15',adults:2,currency:'HKD'};
 const state={watches:[watch],observations:[],destinations:{SIN:'新加坡'},destinationPhotos:catalog};
 assert.ok(watchCards(state).includes(catalog.SIN.path));
 const offer=snapshot.offer,before=JSON.stringify(offer);
 state.observations=[{id:1,watch_id:7,status:'ok',destination:'SIN',departure:watch.start,arrival:watch.end,offer,checked_at:snapshot.checked_at}];
 const html=offerCards(state);
 assert.ok(html.includes(catalog.SIN.path));assert.ok(html.includes(offer.bookingUrl));
 assert.equal(JSON.stringify(offer),before,'photography must not modify the observed quote');
 watch.destinations=['SIN','BKK'];assert.ok(watchCards(state).includes('watch-photo-strip'),'multiple cities keep their individual photographs');
 watch.destination_selections=[{name:'日本',kind:'country',code:'JP'}];assert.ok(watchCards(state).includes('范围内的部分目的地风景'));
 assert.ok(!watchCards(state).includes(catalog.SIN.path));
});


test('country and group watch photographs stay inside canonical selected scopes',async()=>{
 const {watchPhotos}=await import('../app/static/route-card-views.js');
 const japan=watchPhotos([{kind:'country',code:'JP',name:'日本'}],catalog);
 assert.ok(japan.includes(catalog.NRT.path));assert.ok(japan.includes(catalog.OSA.path));
 assert.ok(!japan.includes(catalog.SEL.path));assert.ok(japan.includes('范围内的部分目的地风景'));
 assert.ok(watchPhotos([{kind:'country',code:'LA'}],catalog).includes('<strong>Luang Prabang</strong>'),'use the city name when the directory local name is only its code');
 const group={kind:'group',name:'自选范围',members:['country:JP','country:KR']};
 const before=JSON.stringify(group),html=watchPhotos([group],catalog);
 assert.ok(html.includes(catalog.NRT.path));assert.ok(html.includes(catalog.SEL.path));
 assert.ok(!html.includes(catalog.OSA.path),'give each country a turn before a second city');
 assert.equal(JSON.stringify(group),before);
 assert.equal(watchPhotos([{kind:'group',code:'JP',name:'日本'}],catalog),'','scope names or codes do not substitute for explicit members');
 assert.equal(watchPhotos([{kind:'country',code:'ZZ',name:'日本'}],catalog),'');
 assert.equal(watchPhotos([{kind:'country'}],{SIN:{...catalog.SIN,country_code:undefined}}),'','missing country identity must not borrow unscoped photos');
});

test('multi-location watch photos deduplicate airport aliases and tolerate partial coverage',async()=>{
 const {watchPhotos}=await import('../app/static/route-card-views.js');
 const places=[{kind:'airport',code:'HND'},{kind:'airport',code:'NRT'},{kind:'city',code:'SIN'},{kind:'city',code:'BKK'}];
 const before=JSON.stringify(places),html=watchPhotos(places,catalog);
 assert.equal((html.match(/<img /g)||[]).length,2);
 assert.equal((html.match(/data-destination-photo="TYO"/g)||[]).length,1);
 assert.ok(html.includes(catalog.SIN.path));assert.equal(JSON.stringify(places),before);
 const partial=watchPhotos([{kind:'city',code:'SIN'},{kind:'city',code:'ZZZ'}],catalog);
 assert.equal((partial.match(/<img /g)||[]).length,1);assert.ok(partial.includes('部分目的地风景'));
 const unsafe={...catalog,SIN:{...catalog.SIN,path:'javascript:alert(1)'}};
 assert.equal(watchPhotos([{kind:'country',code:'SG'}],unsafe),'');
 assert.equal(watchPhotos([{kind:'city',code:'ZZZ'}],catalog),'');
});
