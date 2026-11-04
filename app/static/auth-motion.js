import {setButtonLabel} from './ui-icons.js';
import {tr} from './i18n.js';
import {redPandaScene} from './auth-red-panda.js';

/** One lifecycle for password, registration and device authentication. */
export function setupAuthMotion() {
  const card=document.querySelector('.auth-card');
  card.insertAdjacentHTML('afterbegin',redPandaScene);
  const scene=card.querySelector('.auth-journey');
  const caption=scene.querySelector('.journey-caption');
  const form=document.querySelector('#auth-form');
  const email=document.querySelector('#auth-email');
  const password=document.querySelector('#auth-password');
  const submit=document.querySelector('#auth-submit');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let busy=false,failed=false,walkTimer,slowTimer,locked=[],buttonText='',action='login';
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,reduced.matches?0:ms));
  function message() {
    const state=scene.dataset.state;
    if(state==='walking') return tr('出发前，核对一下登机牌…','Checking our boarding passes…');
    if(state==='waiting') return tr('还在连接，请稍候。','Still connecting. One moment.');
    if(state==='departing') return tr('准备好了，一起出发。','All ready. Let’s go.');
    if(state==='error') return tr('先检查一下，我们再出发。','Let’s check that and try again.');
    if(scene.dataset.private==='true') return tr('你慢慢填，我转过去。','Take your time. I’ll look away.');
    if(scene.dataset.ready==='true') return tr('行李收好了，就等你了。','Packed and ready when you are.');
    if(scene.dataset.packed==='true') return tr('背包上肩，离远方又近一步。','Backpack on. A little closer to somewhere new.');
    return tr('地图摊开，下一站去哪儿？','Map out. Where shall we go next?');
  }
  function render() {
    const text=message();
    if(caption.textContent!==text) caption.textContent=text;
    if(busy) setButtonLabel(submit,action==='register'?tr('正在创建账号…','Creating account…'):action==='activate'?tr('正在设置密码…','Setting password…'):tr('正在登录…','Signing in…'));
  }
  function sync() {
    if(busy) {render();return;}
    const packed=email.hidden || email.closest('label').hidden || (email.value.trim()!=='' && email.validity.valid);
    const privateNow=document.activeElement===password || document.activeElement===document.querySelector('#auth-password-confirm');
    scene.dataset.packed=String(packed);
    scene.dataset.ready=String(packed && password.value!=='' && !privateNow);
    scene.dataset.private=String(privateNow);
    scene.dataset.state=failed?'error':'idle';
    render();
  }
  function clearTimers() {clearTimeout(walkTimer);clearTimeout(slowTimer);}
  form.addEventListener('input',()=>{failed=false;sync();});
  form.addEventListener('change',sync);
  form.addEventListener('focusin',sync);
  form.addEventListener('focusout',()=>queueMicrotask(sync));
  document.addEventListener('languagechange',()=>{if(busy) render();else sync();});
  window.addEventListener('pageshow',sync);
  // Password managers may populate the fields without input/change events.
  const autofillTimer=setInterval(()=>{if(!document.querySelector('#auth-view').hidden) sync();},700);
  window.addEventListener('pagehide',()=>clearInterval(autofillTimer),{once:true});
  sync();
  return {
    get busy(){return busy;},
    reset(){failed=false;document.querySelector('#auth-view').classList.remove('auth-leaving');document.querySelector('#workspace').classList.remove('auth-arriving');sync();},
    sync,
    start(nextAction='login'){
      if(busy) return;
      action=nextAction;
      busy=true;failed=false;clearTimers();
      buttonText=submit.textContent;
      locked=[...card.querySelectorAll('button,input')].map(element=>({element,disabled:element.disabled,readOnly:element.readOnly}));
      for(const {element} of locked) {
        if(element.tagName==='BUTTON' || element.type==='checkbox') element.disabled=true;
        else element.readOnly=true;
      }
      card.setAttribute('aria-busy','true');
      scene.dataset.packed='true';scene.dataset.ready='true';scene.dataset.private='false';scene.dataset.state='walking';
      render();
      walkTimer=setTimeout(()=>{scene.dataset.state='waiting';},reduced.matches?0:1200);
      slowTimer=setTimeout(render,3500);
    },
    async success(){
      if(!busy) return;
      clearTimers();
      scene.dataset.state='departing';render();
      await pause(550);
      document.querySelector('#auth-view').classList.add('auth-leaving');
      await pause(250);
      document.querySelector('#workspace').classList.add('auth-arriving');
    },
    fail(){clearTimers();failed=true;scene.dataset.state='error';render();},
    end(){
      clearTimers();busy=false;card.removeAttribute('aria-busy');
      for(const {element,disabled,readOnly} of locked) {element.disabled=disabled;if(element.tagName==='INPUT') element.readOnly=readOnly;}
      locked=[];setButtonLabel(submit,buttonText);sync();
    }
  };
}
