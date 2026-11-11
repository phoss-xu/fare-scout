import {icon,setIconButton} from './ui-icons.js';
import {tr} from './i18n.js';
import {authFilms,filmPath} from './auth-films-data.js';
import {createFilmPreferences,nextFilmIndex,FILM_PREFERENCES_KEY} from './film-preferences.js';

/** Clip endings drive the playlist; guest reactions persist independently of login. */
export function setupAuthFilms() {
  const view=document.querySelector('#auth-view'),stage=view.querySelector('.auth-films');
  const players=[...stage.querySelectorAll('video')],poster=stage.querySelector('img');
  const controls=view.querySelector('.auth-film-controls'),toggle=view.querySelector('#auth-film-toggle');
  const status=view.querySelector('#auth-film-status'),credit=view.querySelector('#auth-film-credit');
  const like=view.querySelector('#auth-film-like'),dislike=view.querySelector('#auth-film-dislike'),undo=view.querySelector('#auth-film-undo');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),preferences=createFilmPreferences(),failed=new Set();
  let current=nextFilmIndex(authFilms,-1,preferences),active=0,generation=0,loading=false;
  // Keep the first login view on its small static poster. Fetch video only
  // after the visitor explicitly starts playback.
  let paused=true;
  const lastDisliked=()=>preferences.lastDisliked(authFilms.map(film=>film.id));
  const visible=()=>!document.hidden && !view.hidden;
  function render() {
    const film=authFilms[current];
    stage.dataset.filmId=film?.id??'';
    credit.hidden=!film;toggle.hidden=!film;like.disabled=!film;
    if(film) {
      view.querySelector('#auth-film-place').textContent=tr(film.zh,film.en);
      credit.href=film.source;credit.innerHTML=icon('external');
      credit.title=`${tr(film.zh,film.en)} · ${film.author} / Pexels`;
      credit.setAttribute('aria-label',credit.title);
    }
    toggle.innerHTML=icon(paused?'play':'pause');
    toggle.title=paused?tr('播放风景','Play scenery'):tr('暂停风景','Pause scenery');
    toggle.setAttribute('aria-label',toggle.title);toggle.setAttribute('aria-pressed',String(!paused));
    const liked=film && preferences.reaction(film.id)==='liked';
    setIconButton(like,'heart',liked?tr('取消收藏这段风景','Unsave this scene'):tr('收藏这段风景','Save this scene'));
    like.setAttribute('aria-pressed',String(Boolean(liked)));
    setIconButton(dislike,'heartBroken',film?tr('不喜欢，不再播放','Dislike, never play again'):tr('撤销最近一次不喜欢','Undo the last dislike'));
    dislike.disabled=!film && !lastDisliked();
    setIconButton(undo,'undo',tr('撤销最近一次不喜欢','Undo the last dislike'));undo.hidden=!lastDisliked();
  }
  function storageNotice() {
    if(!preferences.saved) status.textContent=tr('无法保存偏好，当前选择只在本次打开时有效。','Preferences could not be saved. Choices apply only to this visit.');
  }
  async function resume(player) {
    try {await player.play();}
    catch(error) {
      if(error.name==='AbortError') return;
      console.warn('Login film playback unavailable',{name:error.name});
      paused=true;render();status.textContent=tr('视频未能播放，点播放可重试。','Video could not play. Press play to retry.');
    }
  }
  const next=()=>select(nextFilmIndex(authFilms,current,preferences,failed));
  async function select(index) {
    const ticket=++generation,film=authFilms[index];
    loading=true;status.textContent='';
    if(!film) {
      players.forEach(player=>{player.pause();player.classList.remove('is-active');});
      current=-1;loading=false;poster.hidden=true;render();
      status.textContent=failed.size?tr('风景暂未载入，请稍后刷新。','Scenery could not load. Refresh to retry.'):tr('已隐藏全部风景，可点碎心撤销最近一次选择。','All scenes hidden. Press the broken heart to undo.');
      return;
    }
    // A disliked frame must disappear immediately, including when the next clip fails.
    if(!players[active].getAttribute('src') || current<0 || preferences.reaction(authFilms[current].id)==='disliked') {
      players.forEach(player=>{player.pause();player.classList.remove('is-active');});
      poster.src=filmPath(film,'jpg');poster.style.objectPosition=film.position;
    }
    poster.hidden=false;
    if(paused) {
      players.forEach(player=>{player.pause();player.classList.remove('is-active');});
      poster.src=filmPath(film,'jpg');poster.style.objectPosition=film.position;
      current=index;loading=false;render();storageNotice();return;
    }
    const player=players[1-active];
    player.pause();player.classList.remove('is-active');player.style.objectPosition=film.position;
    try {
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>finish(new Error('Video load timed out')),15000);
        const ready=()=>finish(),error=()=>finish(new Error('Video load failed'));
        function finish(failure) {
          clearTimeout(timeout);player.removeEventListener('canplay',ready);player.removeEventListener('error',error);
          failure?reject(failure):resolve();
        }
        player.addEventListener('canplay',ready,{once:true});player.addEventListener('error',error,{once:true});
        player.src=filmPath(film);player.load();
      });
      if(ticket!==generation) return;
      current=index;loading=false;
      if(visible() && !paused) await resume(player);
      if(ticket!==generation) return;
      players[active].classList.remove('is-active');players[active].pause();
      player.classList.add('is-active');active=1-active;
      poster.src=filmPath(film,'jpg');poster.style.objectPosition=film.position;
      render();storageNotice();
    } catch(error) {
      if(ticket!==generation) return;
      loading=false;failed.add(film.id);
      console.warn('Login film failed',{id:film.id,name:error.name,message:error.message});
      status.textContent=tr('这段风景暂未载入，正在尝试下一段。','This scene could not load. Trying the next one.');
      select(nextFilmIndex(authFilms,index,preferences,failed));
    }
  }
  for(const player of players) {
    player.loop=false;
    player.addEventListener('ended',()=>{if(player===players[active] && visible() && !paused && !loading) next();});
    player.addEventListener('error',()=>{
      if(loading || player!==players[active] || current<0) return;
      console.warn('Active login film stopped',{id:authFilms[current].id,code:player.error?.code});
      failed.add(authFilms[current].id);next();
    });
  }
  like.addEventListener('click',()=>{
    if(current<0 || loading) return;
    const id=authFilms[current].id;
    preferences.set(id,preferences.reaction(id)==='liked'?null:'liked');render();storageNotice();
  });
  function undoDislike() {
    if(loading) return;
    const id=lastDisliked();if(!id) return;
    preferences.set(id,null);select(authFilms.findIndex(film=>film.id===id));
  }
  undo.addEventListener('click',undoDislike);
  dislike.addEventListener('click',()=>{
    if(loading) return;
    if(current<0) {
      undoDislike();
    } else {preferences.set(authFilms[current].id,'disliked');next();}
    storageNotice();
  });
  toggle.addEventListener('click',()=>{
    paused=!paused;render();
    if(paused) players.forEach(player=>player.pause());
    else if(players[active].ended) next();
    else if(!players[active].error && players[active].getAttribute('src')===filmPath(authFilms[current])) resume(players[active]);
    else select(current);
  });
  function visibility() {
    if(!visible()) players.forEach(player=>player.pause());
    else if(!paused && !loading && current>=0) {
      if(players[active].ended) next();else if(players[active].getAttribute('src')) resume(players[active]);
    }
  }
  document.addEventListener('visibilitychange',visibility);
  new MutationObserver(visibility).observe(view,{attributes:true,attributeFilter:['hidden']});
  reduced.addEventListener('change',()=>{if(reduced.matches){paused=true;players.forEach(player=>player.pause());render();}});
  document.addEventListener('languagechange',render);
  window.addEventListener('storage',event=>{
    if(event.key!==FILM_PREFERENCES_KEY && event.key!==null) return;
    preferences.reload();
    if(current<0 || preferences.reaction(authFilms[current].id)==='disliked') next();else render();
  });
  window.addEventListener('pageshow',visibility);
  window.addEventListener('pagehide',()=>players.forEach(player=>player.pause()));
  controls.hidden=false;render();select(current);
}
