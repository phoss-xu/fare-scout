import {setupAuthMotion} from './auth-motion.js';
const motion=setupAuthMotion();
const $=selector=>document.querySelector(selector);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const controls=[$('#preview-play'),$('#preview-outcome')];
let playing=false;
function reset(){
  $('#workspace').hidden=true;$('#auth-view').hidden=false;
  $('#auth-email').value='';$('#auth-password').value='';$('#auth-error').textContent='';
  motion.reset();
}
async function play(automatic=false){
  if(playing) return;
  if(!automatic && !$('#auth-form').reportValidity()) return;
  playing=true;controls.forEach(control=>control.disabled=true);
  try {
    if(automatic){
      reset();
      await pause(650);
      $('#auth-email').focus();$('#auth-email').value='traveler@example.test';motion.sync();
      await pause(850);
      $('#auth-password').focus();$('#auth-password').value='demo-only';motion.sync();
      await pause(900);
      $('#auth-submit').focus();motion.sync();
      await pause(800);
    }
    $('#auth-error').textContent='';motion.start();
    await pause($('#preview-outcome').value==='slow'?5000:1300);
    if($('#preview-outcome').value==='error'){
      $('#auth-error').textContent='演示：邮箱或密码不正确，请检查后重试。';motion.fail();
    } else {
      await motion.success();$('#auth-view').hidden=true;$('#workspace').hidden=false;$('#workspace').focus();
    }
  } finally {motion.end();playing=false;controls.forEach(control=>control.disabled=false);}
}
$('#auth-form').addEventListener('submit',event=>{event.preventDefault();play();});
$('#auth-submit').addEventListener('click',()=>play());
$('#preview-play').addEventListener('click',()=>play(true));
$('#preview-reset').addEventListener('click',reset);
