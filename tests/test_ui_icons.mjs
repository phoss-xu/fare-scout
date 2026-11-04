import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {iconLabel} from '../app/static/ui-icons.js';
import {shareMarkup} from '../app/static/trip-sharing.js';
import {tripSnapshot} from '../app/static/trip-snapshot.js';

test('icon graphics stay decorative and action labels are escaped and available to readers',()=>{
 const markup=iconLabel('mail','Email <account>');
 assert.match(markup,/aria-hidden="true"/);assert.match(markup,/class="action-label sr-only"/);
 assert.match(markup,/Email &lt;account&gt;/);assert.doesNotMatch(markup,/<account>/);
});
test('share actions retain distinct accessible names and existing action hooks',()=>{
 const snapshot=tripSnapshot(JSON.parse(readFileSync('tests/fixtures/trip-snapshot.json','utf8')));
 const html=shareMarkup(snapshot,'http://localhost/share.html?id=example');
 for(const [hook,label] of [['data-share-copy','复制链接'],['data-share-system','系统分享'],['data-share-image','生成分享图']]) {
  const button=html.match(new RegExp(`<button[^>]*${hook}[^>]*>[\\s\\S]*?</button>`))?.[0];
  assert.ok(button,hook);assert.ok(button.includes(`aria-label="${label}"`));
  assert.ok(button.includes('title='));assert.ok(button.includes('<svg'));
 }
});
