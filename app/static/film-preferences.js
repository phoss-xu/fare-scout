/** Browser-local guest choices; stable media IDs also identify future guide assets. */
export const FILM_PREFERENCES_KEY='fare-scout:travel-media:reactions:v1';
export function createFilmPreferences(storage) {
  let entries={},saved=true;
  function read() {
    try {
      storage??=globalThis.localStorage;
      const value=JSON.parse(storage.getItem(FILM_PREFERENCES_KEY));
      if(value?.version===1 && value.entries && typeof value.entries==='object') {
        entries=Object.fromEntries(Object.entries(value.entries).filter(([id,item])=>
          /^[a-z0-9-]{1,80}$/.test(id) && ['liked','disliked'].includes(item?.reaction) && typeof item.updatedAt==='string'));
      }
    } catch(error) {saved=false;console.warn('Travel media preferences unavailable',{name:error.name});}
  }
  read();
  return {
    reaction:id=>entries[id]?.reaction??null,
    lastDisliked:(ids)=>Object.entries(entries).filter(([id,item])=>item.reaction==='disliked' && (!ids || ids.includes(id))).sort((a,b)=>b[1].updatedAt.localeCompare(a[1].updatedAt))[0]?.[0],
    get saved(){return saved;},
    reload(){entries={};read();},
    set(id,reaction) {
      if(reaction===null) delete entries[id];
      else entries[id]={reaction,updatedAt:new Date().toISOString()};
      try {storage.setItem(FILM_PREFERENCES_KEY,JSON.stringify({version:1,entries}));saved=true;}
      catch(error) {saved=false;console.warn('Travel media preference could not be saved',{name:error.name});}
      return saved;
    }
  };
}
export function nextFilmIndex(films,current,preferences,failed=new Set()) {
  for(let step=1;step<=films.length;step++) {
    const index=(current+step+films.length)%films.length;
    if(preferences.reaction(films[index].id)!=='disliked' && !failed.has(films[index].id)) return index;
  }
  return -1;
}
