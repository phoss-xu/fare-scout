export function scenePeriod(hour) {
  if(hour>=5 && hour<7) return 'sunrise';
  if(hour>=7 && hour<10) return 'morning';
  if(hour>=10 && hour<14) return 'noon';
  if(hour>=14 && hour<17) return 'afternoon';
  if(hour>=17 && hour<19) return 'sunset';
  if(hour>=19 && hour<21) return 'evening';
  if(hour>=21 || hour<1) return 'night';
  return 'predawn';
}

export function sceneTime(date=new Date(), zone) {
  try {
    const timeZone=zone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
    const formatter=new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const parts=formatter.formatToParts(date);
    return {timeZone,clock:formatter.format(date),hour:Number(parts.find(part=>part.type==='hour').value)};
  } catch {
    const utc8=new Date(date.getTime()+8*3600000);
    return {timeZone:'Asia/Shanghai',clock:`${String(utc8.getUTCHours()).padStart(2,'0')}:${String(utc8.getUTCMinutes()).padStart(2,'0')}`,hour:utc8.getUTCHours()};
  }
}

if(typeof document!=='undefined') {
  const scene=document.querySelector('.travel-scene');
  const buttons=[...document.querySelectorAll('[data-period] button, button[data-period]')];
  let selected='auto';
  function update() {
    const time=sceneTime();
    scene.dataset.period=selected==='auto'?scenePeriod(time.hour):selected;
    document.querySelector('#scene-clock').textContent=`${time.clock} · ${time.timeZone}\n${selected==='auto'?'跟随当地时间':'时段预览'}`;
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.period===selected)));
  }
  buttons.forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.period;update();}));
  const motion=document.querySelector('#motion-toggle');
  motion.addEventListener('click',()=>{
    const paused=scene.dataset.paused!=='true';
    scene.dataset.paused=String(paused);
    motion.setAttribute('aria-pressed',String(paused));
    motion.textContent=paused?'继续飞机':'暂停飞机';
  });
  document.querySelectorAll('.scene-photo').forEach(img=>img.addEventListener('error',()=>{
    document.querySelector('#scene-error').textContent='背景图片未能加载，请刷新重试。';
  }));
  update();
  setInterval(()=>{if(!document.hidden) update();},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) update();});
}
