const $=id=>document.getElementById(id);
const labels={pending:'待处理',running:'执行中',done:'已完成',error:'失败',cancelled:'已取消',retry:'等待重试',waiting_config:'等待邮件配置',waiting_verification:'等待验证或接收确认',sending:'发送中',sent:'供应商已接受',failed:'发送失败',skipped:'已跳过',ok:'有匹配报价',empty:'本次无匹配'};
const taskStates=['pending','running','done','error','cancelled'];
const mailStates=['pending','retry','waiting_config','waiting_verification','sending','sent','failed','cancelled','skipped'];
const time=value=>value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'暂无记录';
let view='overview',cursors=[null],pageIndex=0,next=null,loading=false,requestVersion=0;
function el(tag,text,className) {const node=document.createElement(tag);if(text!==undefined) node.textContent=text;if(className) node.className=className;return node;}
function badge(value) {return el('span',labels[value]||value||'未记录','badge'+(['error','failed'].includes(value)?' bad':''));}
async function get(path) {
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store'});
  const body=await response.json();
  if(!response.ok) throw new Error(body.error||'暂时无法读取记录，请重试。');
  return body;
}
function table(headers,rows) {
  const wrap=el('div',undefined,'table-wrap'),table=el('table'),head=el('thead'),tr=el('tr'),body=el('tbody');
  for(const title of headers) {const th=el('th',title);th.scope='col';tr.append(th);}head.append(tr);
  for(const row of rows) {const tr=el('tr');for(const value of row){const td=el('td');td.append(value instanceof Node?value:el('span',String(value??'—')));tr.append(td);}body.append(tr);}
  table.append(head,body);wrap.append(table);return wrap;
}
function panel(title,lines) {const node=el('article',undefined,'panel');node.append(el('h2',title));for(const line of lines) node.append(el('p',line));return node;}
function counts(rows) {return rows.length?rows.map(r=>`${labels[r.status]||r.status} ${r.count}`).join(' · '):'暂无记录';}
function overview(data) {
  const metrics=el('div',undefined,'metrics');
  for(const [title,value] of [['用户总数',data.users],['有效监控',data.watches],['待执行任务',data.queue.find(r=>r.status==='pending')?.count||0],['租约已过期任务',data.expired_leases]]) {
    const node=el('article',undefined,'metric');node.append(el('span',title),el('strong',String(value)));metrics.append(node);
  }
  const h=data.heartbeat,stale=h && Date.parse(data.generated_at)-Date.parse(h.started_at)>5*60000;
  const health=!h?'尚无调度心跳':stale?'超过 5 分钟未记录新调度，请排查':h.status==='error'?'最近一次调度失败':h.status==='running'?'最近一次调度执行中':'最近一次调度已完成';
  const panels=el('div',undefined,'panels');
  panels.append(panel('定时调度',[
    health,`开始：${time(h?.started_at)}；完成：${time(h?.finished_at)}`,
    `耗时：${h?.duration_ms==null?'暂无':h.duration_ms+' ms'}${h?.error_code?'；错误码：'+h.error_code:''}`,
    `查价${data.query_enabled?'已开启':'已关闭'} · 邮件${data.mail_enabled?'已开启':'已关闭'} · 发信服务配置${data.mail_ready?'就绪':'未就绪'}`,
    '心跳只反映调度函数；不代表外部查价成功或邮件已送达。']),
  panel('最近 24 小时采样',[counts(data.observations_24h),`统计起点：${time(data.window_start)}`,`最近匹配报价：${time(data.last_success)}`,'一轮查询可能返回多条报价；本次无匹配与查询失败分别计数。']),
  panel('邮件队列 · 当前保留记录',[counts(data.mail),'包含降价提醒与每日推荐。已接受表示供应商接受发送请求，未接入收件箱送达回执。']),
  panel('采样覆盖',[`累计保存 ${data.sampling.samples} 条采样记录`, `首条：${time(data.sampling.first_sample)}`,`最近：${time(data.sampling.last_sample)}`,'首末记录跨度不等于连续覆盖，也不代表每条航线都覆盖这一时段。']));
  $('content').append(metrics,panels);
}
function userRows(items) {return items.map(r=>[r.id,r.name,r.email,r.notification_email,r.watch_count,r.passkey_count,`${r.email_verified?'已验证':'未验证'} / ${r.email_confirmed?'已确认接收':'未确认接收'}`,time(r.created_at)]);}
function taskRows(items) {return items.map(r=>{
  const button=el('button','查看','link-button');button.type='button';button.addEventListener('click',()=>detail(r.id));
  return [el('span',r.id,'identity'),r.owner_id,r.kind==='watch'?'监控':'特价 / 推荐',badge(r.status),r.attempts,r.offer_count??0,r.error_code||'—',time(r.created_at),button];
});}
function mailRows(items) {return items.map(r=>[el('span',r.identity,'identity'),r.kind,r.user_id,r.notification_email,badge(r.status),r.attempts,time(r.created_at),time(r.next_attempt),time(r.sent_at),r.run_id||('监控 '+r.watch_id)]);}
async function detail(id) {
  const version=requestVersion,section=$('detail');section.hidden=false;section.replaceChildren(el('p','正在读取任务详情…'));
  try {
    const {task}=await get('/api/admin/tasks/'+encodeURIComponent(id));
    if(version!==requestVersion) return;
    const box=panel('任务追踪',[]),dl=el('dl');
    for(const [key,value] of [['任务 ID',task.id],['运行批次',task.run_id],['用户 ID',task.owner_id],['监控 ID',task.watch_id??'无'],['状态',labels[task.status]||task.status],['执行尝试',task.attempts],['批次创建',time(task.created_at)],['批次完成',time(task.finished_at)],['可执行时间',time(task.available_at)],['租约截止',time(task.lease_until)],['源查询时间',time(task.source_checked_at)],['缓存复用',task.cache_hit?'是':'否'],['报价条数',task.offer_count??0],['错误码',task.error_code||'无']]) dl.append(el('dt',key),el('dd',String(value)));
    box.append(dl,el('h3','查询范围与日期'),el('pre',JSON.stringify(task.job,null,2)),el('p','批次完成时间不等于单任务完成时间。错误码用于关联平台日志；邮件记录当前未持久化具体供应商错误。'));
    section.replaceChildren(box);section.scrollIntoView({behavior:'smooth',block:'start'});
  } catch(error) {if(version===requestVersion) section.replaceChildren(el('p',error.message));}
}
async function load() {
  if(loading) return;loading=true;const version=++requestVersion;
  $('refresh').disabled=true;$('content').setAttribute('aria-busy','true');$('notice').className='';$('notice').textContent='正在读取记录…';$('detail').hidden=true;$('pagination').hidden=true;
  try {
    const params=new URLSearchParams();
    if(cursors[pageIndex]) params.set('before',cursors[pageIndex]);
    if(['tasks','mail'].includes(view)) {if($('user').value) params.set('user',$('user').value);if($('status').value) params.set('status',$('status').value);}
    const data=await get('/api/admin/'+view+'?'+params);
    if(version!==requestVersion) return;
    $('content').replaceChildren();
    if(view==='overview') overview(data);
    else {
      next=data.next;
      const headers=view==='users'?['用户 ID','昵称','账号邮箱','收件邮箱','有效监控','通行密钥','收件状态（本地记录）','注册时间']:view==='tasks'?['任务 ID','用户 ID','类型','状态','尝试','报价数','错误码','批次创建','详情']:['邮件 ID','类型','用户 ID','当前收件邮箱','状态','尝试','计划 / 创建','下次尝试','供应商接受时间','关联批次 / 监控'];
      $('content').append(data.items.length?table(headers,view==='users'?userRows(data.items):view==='tasks'?taskRows(data.items):mailRows(data.items)):panel('暂无符合条件的记录',['可以调整筛选；任务也可能已按保留策略清理。']));
      $('pagination').hidden=false;$('previous').disabled=pageIndex===0;$('next').disabled=!next;$('page-number').textContent=`第 ${pageIndex+1} 页 · 每页最多 25 条`;
    }
    $('notice').textContent=`最近读取：${time(data.generated_at||new Date().toISOString())} · 手动刷新 · 邮箱已脱敏`;
  } catch(error) { $('content').replaceChildren();$('notice').className='error';$('notice').textContent=error.message; }
  finally {loading=false;$('refresh').disabled=false;$('content').setAttribute('aria-busy','false');}
}
for(const button of document.querySelectorAll('[data-view]')) button.addEventListener('click',()=>{
  if(loading) return;view=button.dataset.view;cursors=[null];pageIndex=0;
  for(const tab of document.querySelectorAll('[data-view]')) tab.setAttribute('aria-pressed',String(tab===button));
  $('filters').hidden=!['tasks','mail'].includes(view);$('user').value='';$('status').replaceChildren(new Option('全部状态',''));
  for(const value of view==='tasks'?taskStates:mailStates) $('status').append(new Option(labels[value],value));load();
});
$('refresh').addEventListener('click',load);
$('apply').addEventListener('click',()=>{if(loading) return;cursors=[null];pageIndex=0;load();});
$('previous').addEventListener('click',()=>{if(!loading && pageIndex>0){pageIndex--;load();}});
$('next').addEventListener('click',()=>{if(!loading && next){cursors[++pageIndex]=next;load();}});
load();
