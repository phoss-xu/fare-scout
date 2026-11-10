import {request} from './api.js';
import {tr} from './i18n.js';
const $=s=>document.querySelector(s);
let owner=null,current=null,pending=null;
export function renderAvatar(state){
 owner=state?.user?.id || null;current=state?.profile?.avatar || null;
 if(current && /^data:image\/jpeg;base64,/.test(current))for(const id of ['center-avatar','account-avatar']){const img=new Image();img.alt='';img.src=current;$('#'+id).replaceChildren(img);}
}
export function setupAvatar(refresh){
 const input=$('#center-avatar-file'),dialog=$('#avatar-dialog'),canvas=$('#avatar-canvas'),ctx=canvas.getContext('2d');
 $('#center-avatar').onclick=()=>{
   pending=null;$('#avatar-error').textContent='';$('#avatar-save').disabled=true;$('#avatar-remove').disabled=!current;
   ctx.clearRect(0,0,128,128);if(current){const image=new Image();image.onload=()=>ctx.drawImage(image,0,0,128,128);image.src=current;}
   dialog.showModal();
 };
 $('#avatar-choose').onclick=()=>input.click();$('#avatar-cancel').onclick=()=>dialog.close();
 input.onchange=async()=>{
  const file=input.files[0],userId=owner;input.value='';if(!file)return;
  $('#avatar-error').textContent='';pending=null;$('#avatar-save').disabled=true;
  if(file.size>5*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)){$('#avatar-error').textContent=tr('请选择5MB以内的PNG、JPEG或WebP图片。','Choose a PNG, JPEG or WebP image under 5 MB.');return;}
  let bitmap;try{bitmap=await createImageBitmap(file);if(owner!==userId)return;const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,128,128);pending=canvas.toDataURL('image/jpeg',.75);if(pending.length>10950)pending=canvas.toDataURL('image/jpeg',.45);if(pending.length>10950)throw new Error('large');$('#avatar-save').disabled=false;}
  catch{$('#avatar-error').textContent=tr('无法处理此图片，请选择另一张。','Could not process this image. Choose another.');pending=null;$('#avatar-save').disabled=true;}
  finally{bitmap?.close();}
 };
 async function save(avatar){if(!owner)return;const userId=owner;const buttons=dialog.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{await request('/api/profile',{avatar});if(owner!==userId)return;dialog.close();await refresh();}catch(error){if(owner===userId)$('#avatar-error').textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}}
 $('#avatar-save').onclick=()=>{if(pending)save(pending);};$('#avatar-remove').onclick=()=>save(null);
}
