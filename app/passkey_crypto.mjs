// Pure local bridge to the same verifier already used by the Workers backend.
import {generateRegistrationOptions,generateAuthenticationOptions,verifyRegistrationResponse,verifyAuthenticationResponse} from '@simplewebauthn/server';
let input='';
for await (const chunk of process.stdin) input+=chunk;
try {
  const {action,options}=JSON.parse(input);
  let result;
  if(action==='registrationOptions') {
    options.userID=new TextEncoder().encode(options.userID);
    result=await generateRegistrationOptions(options);
  } else if(action==='authenticationOptions') result=await generateAuthenticationOptions(options);
  else if(action==='verifyRegistration') {
    result=await verifyRegistrationResponse(options);
    if(result.registrationInfo) result.registrationInfo.credential.publicKey=Buffer.from(result.registrationInfo.credential.publicKey).toString('base64url');
  } else if(action==='verifyAuthentication') {
    options.credential.publicKey=new Uint8Array(Buffer.from(options.credential.publicKey,'base64url'));
    result=await verifyAuthenticationResponse(options);
  } else throw new Error('Unsupported operation');
  process.stdout.write(JSON.stringify(result));
} catch {
  process.stdout.write(JSON.stringify({verified:false}));
  process.exitCode=1;
}
