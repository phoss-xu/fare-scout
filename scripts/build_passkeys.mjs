import {build} from 'esbuild';
import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('app/static/vendor',{recursive:true});
await build({stdin:{contents:"export {startRegistration,startAuthentication,browserSupportsWebAuthn} from '@simplewebauthn/browser';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'app/static/vendor/passkeys.js'});
await copyFile('node_modules/@simplewebauthn/browser/LICENSE.md','app/static/vendor/SimpleWebAuthn-LICENSE.md');
