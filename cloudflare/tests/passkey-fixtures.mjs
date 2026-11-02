// Protocol fixtures generated with actual P-256 keys. No browser/device or real account is impersonated.
import {createHash,generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {encodeCBOR} from '@levischuck/tiny-cbor';
const sha=value=>createHash('sha256').update(value).digest();
const b64=value=>Buffer.from(value).toString('base64url');
export function authenticator() {
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const jwk=publicKey.export({format:'jwk'}),id=randomBytes(32);
 const cose=encodeCBOR(new Map([[1,2],[3,-7],[-1,1],[-2,new Uint8Array(Buffer.from(jwk.x,'base64url'))],[-3,new Uint8Array(Buffer.from(jwk.y,'base64url'))]]));
 return {
  id:b64(id),handle:null,
  register(options,{origin='http://localhost',uv=true,challenge=options.challenge}={}) {
   this.handle=options.user.id;
   const client=Buffer.from(JSON.stringify({type:'webauthn.create',challenge,origin,crossOrigin:false}));
   const length=Buffer.alloc(2);length.writeUInt16BE(id.length);
   const authData=Buffer.concat([sha(options.rp.id),Buffer.from([uv?0x45:0x41]),Buffer.alloc(4),Buffer.alloc(16),length,id,Buffer.from(cose)]);
   const attestation=encodeCBOR(new Map([['fmt','none'],['attStmt',new Map()],['authData',new Uint8Array(authData)]]));
   return {id:b64(id),rawId:b64(id),type:'public-key',response:{clientDataJSON:b64(client),attestationObject:b64(attestation),transports:['internal']},clientExtensionResults:{credProps:{rk:true}},authenticatorAttachment:'platform'};
  },
  login(options,{origin='http://localhost',uv=true,challenge=options.challenge,counter=1,tamper=false,rpID=options.rpId,userHandle=this.handle}={}) {
   const client=Buffer.from(JSON.stringify({type:'webauthn.get',challenge,origin,crossOrigin:false}));
   const count=Buffer.alloc(4);count.writeUInt32BE(counter);
   const authData=Buffer.concat([sha(rpID),Buffer.from([uv?5:1]),count]);
   const signature=sign('sha256',Buffer.concat([authData,sha(client)]),privateKey);
   if(tamper) signature[signature.length-1]^=1;
   return {id:b64(id),rawId:b64(id),type:'public-key',response:{clientDataJSON:b64(client),authenticatorData:b64(authData),signature:b64(signature),userHandle},clientExtensionResults:{},authenticatorAttachment:'platform'};
  }
 };
}
