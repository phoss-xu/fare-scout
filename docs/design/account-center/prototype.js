const $=s=>document.querySelector(s);
const titles={profile:['ACCOUNT','个人资料'],preferences:['PREFERENCES','偏好设置'],notifications:['NOTIFICATIONS','通知'],security:['SECURITY','安全与登录'],about:['FARE SCOUT','关于']};
const state={email:'',verified:false,phone:''};
function view(name){
 $('#account-menu').hidden=true;
 document.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==name);
 document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 $('#section-kicker').textContent=titles[name][0];$('#section-title').textContent=titles[name][1];
 $('#center-shell').hidden=false;$('#reopen').hidden=true;
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
document.querySelectorAll('[data-layout]').forEach(b=>{if(b.tagName!=='BUTTON')return;b.onclick=()=>{document.body.dataset.layout=b.dataset.layout;document.querySelectorAll('.variants button').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));};});
function closeCenter(){ $('#center-shell').hidden=true;$('#reopen').hidden=false;$('#account-trigger').setAttribute('aria-expanded','false'); }
$('.close-center').onclick=closeCenter;
$('#reopen').onclick=()=>view('profile');
$('#account-trigger').onclick=()=>{const open=$('#account-menu').hidden;closeCenter();$('#reopen').hidden=open;$('#account-menu').hidden=!open;$('#account-trigger').setAttribute('aria-expanded',String(open));};
const dialog=$('#flow-dialog');
function flow(html){$('#flow-body').innerHTML=html;if(!dialog.open)dialog.showModal();}
function syncEmail(){ $('#email-value').textContent=state.email?(state.email+(state.verified?' · 已验证':' · 待验证')):'尚未绑定';$('#bind-email').textContent=state.email?'更换邮箱':'绑定邮箱';$('#notification-email').textContent=state.verified?state.email:'绑定邮箱后接收邮件'; }
function emailFlow(){flow('<h3>绑定邮箱</h3><form id="email-edit"><label>邮箱地址<input type="email" name="email" autocomplete="email" placeholder="you@example.com" required></label><button class="flow-action">发送验证链接</button></form>');$('#email-edit [name=email]').value=state.email;$('#email-edit').onsubmit=e=>{e.preventDefault();state.email=new FormData(e.target).get('email');state.verified=false;syncEmail();flow('<h3>查看你的邮箱</h3><p id="mail-recipient"></p><p class="flow-note">链接 1 小时有效，1 分钟后可重发。</p><button class="flow-action" id="demo-confirm">演示打开验证链接</button><p class="flow-note">原型演示，不发送真实邮件。</p>');$('#mail-recipient').textContent=state.email;$('#demo-confirm').onclick=()=>{state.verified=true;syncEmail();dialog.close();};};}
$('#bind-email').onclick=emailFlow;$('#manage-email').onclick=()=>{view('profile');emailFlow();};
$('#bind-phone').onclick=()=>{flow('<h3>绑定手机号</h3><form id="phone-edit"><label>国家 / 地区<select><option>中国 +86</option><option>香港 +852</option><option>日本 +81</option></select></label><label>手机号<input type="tel" name="phone" autocomplete="tel-national" required placeholder="输入手机号"></label><button class="flow-action">下一步</button></form>');$('#phone-edit').onsubmit=e=>{e.preventDefault();const number=new FormData(e.target).get('phone');flow('<h3>验证手机号</h3><form id="code-edit"><label>短信验证码<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="6 位验证码" required></label><button class="flow-action">完成绑定</button></form><p class="flow-note">原型演示：输入任意 6 位数字，不发送短信。</p>');$('#code-edit').onsubmit=e=>{e.preventDefault();state.phone=number;$('#phone-value').textContent=number.slice(0,3)+' **** '+number.slice(-4)+' · 已验证';$('#bind-phone').textContent='更换手机号';dialog.close();};};};
$('#edit-name').onclick=()=>{flow('<h3>编辑昵称</h3><form id="name-edit"><label>昵称<input name="name" maxlength="40" required></label><button class="flow-action">保存</button></form>');$('#name-edit input').value=$('#profile-name').textContent;$('#name-edit').onsubmit=e=>{e.preventDefault();const name=new FormData(e.target).get('name').trim();if(!name)return;$('#profile-name').textContent=name;$('#account-trigger>span:nth-child(2)').textContent=name;dialog.close();};};
$('#avatar-edit').onclick=()=>{flow('<h3>更换头像</h3><div class="avatar-options"><button data-avatar="p">p</button><button data-avatar="旅">旅</button><button data-avatar="山">山</button></div><label>上传图片<input type="file" id="avatar-file" accept="image/jpeg,image/png,image/webp"></label><p class="flow-note">原型仅在当前页面预览，不上传文件。</p>');document.querySelectorAll('[data-avatar]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.avatar').forEach(a=>a.textContent=b.dataset.avatar);dialog.close();});$('#avatar-file').onchange=e=>{const f=e.target.files[0];if(!f||!f.type.startsWith('image/'))return;const url=URL.createObjectURL(f);document.querySelectorAll('.avatar').forEach(a=>{const img=new Image();img.src=url;img.alt='头像';a.replaceChildren(img);});dialog.close();};};
$('#font').onchange=e=>document.documentElement.dataset.font=e.target.value;
document.querySelectorAll('[data-theme]').forEach(b=>{if(b.tagName!=='BUTTON')return;b.onclick=()=>{document.documentElement.dataset.theme=b.dataset.theme;document.querySelectorAll('.theme-grid button').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));};});
$('#reset-preferences').onclick=()=>{$('#language').selectedIndex=0;$('#currency').selectedIndex=0;$('#font').value='serif';document.documentElement.dataset.font='serif';document.querySelector('[data-theme=paper]').click();$('#scenery').selectedIndex=0;};
for(const id of ['price-mail','daily-mail'])$('#'+id).onchange=e=>{if(e.target.checked&&!state.verified){e.target.checked=false;emailFlow();}};
$('#manage-passkey').onclick=()=>flow('<h3>通行密钥</h3><p class="flow-note">使用指纹、面容或设备 PIN 登录。</p><button class="flow-action" id="add-key">添加通行密钥</button><p class="flow-note">此处展示设备验证入口，原型不修改账号凭据。</p>');
$('#change-password').onclick=()=>flow('<h3>修改密码</h3><form method="dialog"><label>当前密码<input type="password" autocomplete="current-password"></label><label>新密码<input type="password" autocomplete="new-password"></label><button class="flow-action">保存</button></form>');
$('#devices').onclick=()=>flow('<h3>已登录设备</h3><div class="setting-row"><div class="row-copy"><h3>当前设备</h3><p>示例会话 · 当前使用</p></div></div><button class="flow-action">退出其他设备</button>');
$('#signout').onclick=()=>{flow('<h3>退出当前账号？</h3><button class="flow-action" id="confirm-signout">退出登录</button>');$('#confirm-signout').onclick=()=>{dialog.close();closeCenter();};};
$('#travel-preferences').onclick=()=>flow('<h3>每日推荐偏好</h3><div class="setting-row">出发地<button class="inline-action">选择 →</button></div><div class="setting-row">出行时间<button class="inline-action">选择 →</button></div><div class="setting-row">停留晚数<button class="inline-action">选择 →</button></div><p class="flow-note">偏好沿用搜索与每日推荐的同类控件，按需展开。</p>');
$('#watch-list').onclick=()=>flow('<h3>我的行程提醒</h3><p class="flow-note">回到「我的行程」，逐条管理目标价、查价间隔与降价提醒。</p>');
$('#release-notes').onclick=()=>flow('<h3>版本与更新日志</h3><p class="flow-note">这里复用产品当前版本与更新日志。</p>');
$('#photo-collection').onclick=()=>flow('<h3>风景收藏</h3><p class="flow-note">喜欢的风景会收在这里。</p>');
