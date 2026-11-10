import {ensure,run,now} from './db.js';
// Avatars are small, same-origin encoded JPEGs. Keep them private in the account state.
export async function saveProfile(db,userId,data) {
  if(data.name!==undefined){
    const name=typeof data.name==='string'?data.name.trim():'';
    ensure(name.length>0 && [...name].length<=40,'昵称须为1–40个字符。');
    await run(db,'UPDATE users SET name=? WHERE id=?',[name,userId]);return;
  }
  ensure(data.avatar===null || typeof data.avatar==='string','请选择头像。');
  let avatar=null;
  if(data.avatar!==null){
    ensure(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.avatar) && data.avatar.length<=12000,'头像过大或格式不正确。');
    let bytes;try{bytes=Uint8Array.from(atob(data.avatar.split(',')[1]),c=>c.charCodeAt(0));}catch{ensure(false,'头像格式不正确。');}
    ensure(bytes.length<=8192 && bytes[0]===255 && bytes[1]===216 && bytes.at(-2)===255 && bytes.at(-1)===217,'头像格式不正确。');
    let offset=2,dimensions=false;const parts=[bytes.slice(0,2)];
    while(offset<bytes.length){
      ensure(bytes[offset]===255,'头像格式不正确。');const marker=bytes[offset+1];
      if(marker===218){parts.push(bytes.slice(offset));break;}
      const length=(bytes[offset+2]<<8)|bytes[offset+3];ensure(length>=2 && offset+2+length<=bytes.length,'头像格式不正确。');
      if([192,193,194].includes(marker)){const h=(bytes[offset+5]<<8)|bytes[offset+6],w=(bytes[offset+7]<<8)|bytes[offset+8];ensure(w===128 && h===128,'头像须为128像素正方形。');dimensions=true;}
      if(!(marker>=224&&marker<=239) && marker!==254)parts.push(bytes.slice(offset,offset+length+2));
      offset+=length+2;
    }
    ensure(dimensions,'头像格式不正确。');const clean=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const part of parts){clean.set(part,i);i+=part.length;}
    avatar='data:image/jpeg;base64,'+btoa(String.fromCharCode(...clean));
  }
  await run(db,'INSERT INTO user_profiles(user_id,avatar,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET avatar=excluded.avatar,updated_at=excluded.updated_at',[userId,avatar,now()]);
}
