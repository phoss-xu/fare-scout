import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

// Parse/minify CSS with the production parser before checking declaration policy.
// This guards ownership of the global font, rather than a list of font names.
test('first-party styles share one root font configuration',async()=>{
  const root=new URL('../app/static/',import.meta.url);
  let owners=0;
  for(const file of (await readdir(root)).filter(f=>f.endsWith('.css'))) {
    const {code}=await transform(await readFile(new URL(file,root),'utf8'),{loader:'css',minify:true});
    const css=code.replace(/@font-face\{[^}]*\}/g,'');
    for(const match of css.matchAll(/(?:^|[;{])(--[\w-]*family|--map-font)\s*:\s*([^;}]+)/g)) {
      assert.equal(file,'style.css',`${file} defines a local font token`);
      assert.equal(match[1],'--family');
      const block=css.lastIndexOf('{',match.index);
      assert.match(css.slice(css.lastIndexOf('}',block)+1,block),/^:root(?:\[data-font=[\w-]+\])?$/,'Font ownership must stay at the document root');
      owners++;
    }
    for(const match of css.matchAll(/(?:^|[;{])(font|font-family)\s*:\s*([^;}]+)/g)) {
      assert.match(match[2],/var\(--(?:family|heading-[\w-]+|title-[\w-]+|body-[\w-]+|caption-[\w-]+|button-[\w-]+)\)|^(?:inherit|normal)$/,
        `${file} bypasses global typography: ${match[0]}`);
    }
  }
  assert.equal(owners,3,'Only the global root may own the three font stacks');
});
