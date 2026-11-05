import {releases, currentRelease} from './releases.js';
import {tr} from './i18n.js';
import {escape} from './format.js';

const labels = {
  added: ['新增', 'New'], improved: ['优化', 'Improved'], fixed: ['修复', 'Fixed'],
};
const local = value => tr(value.zh, value.en);
const identifier = release => release.version ? `v${release.version}` : release.revision;

function entries() {
  return releases.map((release, index) => `<article class="release-entry">
    <div class="release-meta"><span class="release-version">${escape(identifier(release))}</span>
      <span class="release-state">${release.status === 'preview' ? tr('预览 · 尚未发布', 'Preview · Unreleased') : index === 0 ? tr('当前版本', 'Current version') : tr('已发布', 'Released')}</span>
      ${release.date ? `<time datetime="${escape(release.date)}">${escape(release.date)}</time>` : ''}</div>
    <h3>${escape(local(release.title))}</h3>
    ${release.groups.map(group => `<div class="release-group"><h4>${tr(...labels[group.type])}</h4><ul>${group.items.map(item => `<li>${escape(local(item))}</li>`).join('')}</ul></div>`).join('')}
  </article>`).join('');
}

const button = document.querySelector('#changelog-open');
const dialog = document.querySelector('#changelog-dialog');
function render() {
  const preview = currentRelease.status === 'preview';
  button.textContent = `v${currentRelease.version.split('-')[0]}${preview ? tr(' · 预览', ' · Preview') : ''}`;
  button.title = tr('查看更新日志', 'View changelog');
  button.setAttribute('aria-label', `${tr('更新日志', 'Changelog')} · ${identifier(currentRelease)}`);
  dialog.querySelector('#changelog-title').textContent = tr('更新日志', 'What’s new');
  dialog.querySelector('.changelog-intro').textContent = tr('每一步，都让下一次出发更轻松。', 'Making your next getaway a little easier, one update at a time.');
  dialog.querySelector('.changelog-note').textContent = tr('预览内容尚未正式发布；早期版本保留发布时的提交编号。', 'Preview changes are not released yet. Earlier releases retain their original commit IDs.');
  dialog.querySelector('#changelog-close').setAttribute('aria-label', tr('关闭更新日志', 'Close changelog'));
  dialog.querySelector('.changelog-entries').innerHTML = entries();
}
button.addEventListener('click', () => dialog.showModal());
dialog.querySelector('#changelog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
document.addEventListener('languagechange', render);
render();
