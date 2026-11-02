# Fare Scout 架构地图

## Workers + D1（2026-11-02 新增）

已部署到 Workers Free：https://fare-scout.phosssuki.workers.dev 。
运行时为 Cloudflare Workers：原生前端静态资源 + JavaScript API + D1 + Cron。
`cloudflare/src/index.js → auth / domain / store / runs → D1`；`tasks.js → provider.js → Kiwi`。
`search_runs` / `search_tasks` 持久化队列与租约，Cron 接续中断工作；观察样本与提醒/邮件队列在同一事务写入。
每日推荐：`daily.js → travel-time.js / search_runs → provider.js → daily-mail.js`；
`daily_preferences` 与 `daily_editions` 保存按账号配置、北京时间计划、报价和投递快照。
每日与手动搜特价共用持久化查询队列但独立运行；每日结果不进入监控价格历史。
前端 `static/daily.js / daily.css` 在搜特价的发现结果区接入简报及偏好弹窗，复用 `deal_views.js` 卡片与监控草稿；Python 版隐藏每日入口。口径与验证见 [DAILY.md](DAILY.md)。
邮件通过独立 HTTPS 适配器发送，当前关闭。云端使用 Passkey（WebAuthn），五分钟单次挑战绑定 Cookie、固定 Origin/RP、要求设备验证；D1 只保存公钥与计数器，登录后复用会话/CSRF。
本地 Python 密码版保留，前端根据 auth_mode 切换入口；云端密码接口关闭。

本地 `npm run db:local && npm run dev`，地址 http://localhost:8787；数据库位于 `.wrangler/`。
SQLite 只读离线导出工具保留原库，副本的计划暂停、旧邮件取消，排除会话与凭据。
用户选择云端空库，没有迁移旧数据；发布与验证详见 [CLOUDFLARE.md](CLOUDFLARE.md)。

## 保留的 Python 本地版

Python 3.9+ 标准库本地服务，SQLite 持久化，原生 HTML/CSS/JavaScript。
仅绑定 127.0.0.1，支持本地账号注册、登录与用户隔离；尚未部署为公开服务。
新服务无需安装依赖，prototype 中旧实验仍需 httpx。

## 请求与数据流

`static/app.js → static/api.js → server.py → domain.py / store.py / worker.py`

- `server.py`：静态页面、JSON API、同源保护和友好错误。
- `accounts.py` / `passwords.py`：注册、密码验证、预留账号与旧数据激活。
- `sessions.py` / `auth_http.py`：服务端会话、Cookie、CSRF 和所有业务 API 的登录守卫。
- `schema.py`：可重复执行的数据库升级；`store.py` 保留持久化操作。
- `domain.py`：结构化监控校验、地点范围与日期任务展开、航线和时间筛选。
- `location_groups.py`：编辑精选和区域浏览，通过规范地点 ID 生成分类；免签是带护照口径、日期和官方来源的精选。维护规则见 `docs/LOCATION_DISCOVERY.md`。
- `static/location_browser.js` / `location_browser.css`：各入口共享的分类浏览；输入始终全局搜索。`static/nights.js` / `nights.css`：双滑块停留范围。
- `locations.py` / `data/locations.json`：全球地点查询、类型与机场归属；`scripts/update_locations.py` 更新目录。
- `journeys.py` / `observations.py`：实际行程比较口径与整批采样事务；`presenter.py` 组合用户状态和地点标签。
- `static/locations.js` / `locations.css`：出发地单选、目的地混合多选与搜索。
- `location_history.py` / `static/location_history.js`：按账号、出发/目的地分别保存最近 8 个显式选择；搜特价与监控共享快捷按钮，历史不足时补充本人已保存监控的地点。默认地点和程序回填不计入新选择。
- `provider.py`：Kiwi MCP HTTP/SSE 通信与响应解析，按实际机场和日期保留各行程的最低报价。
- `worker.py`：单线程后台队列，逐组查询；临时网络错误最多 3 次尝试，组合之间间隔 1 秒。
- `scheduler.py`：每 10 秒调度到期任务；独立线程调度邮件投递，慢邮件不阻塞查价。
- `policy.py`：独立校验采样周期和提醒门槛，不修改航班比较条件。
- `alerts.py`：同一组合的上次有效价格比较、预算判断和提醒去重。
- `mail_config.py` / `mail_delivery.py`：本地 SMTP 配置、加密发送和持久化邮件重试队列。
- `store.py`：SQLite 事务、监控配置、逐组合采样记录。
- `deals.py` / `deal_jobs.py`：模糊日期往返探索、结果二次过滤、每城市较低价；独立双线程队列和账号隔离的短期内存任务，不写入监控样本或触发通知。
- `static/holidays.json` / `holidays.js` / `holidays.css`：带年份、来源和正式/参考状态的中国内地假期快捷选择；只填写具体日期，不自动创建任务，维护规则见 `docs/HOLIDAYS.md`。
- `static/landscape.js` / `landscape-provider.js` / `landscape-actions.js`：每小时从 Wikimedia Commons 精选风景分类获取横向照片，按逐图许可过滤；失败显示同源默认竹林，支持本浏览器爱心列表与授权图片下载。摄影来源与许可见 `static/assets/places/CREDITS.md` 及页面逐图链接，与查询条件独立。
- `static/ui.js`：默认搜特价、工作区导航及键盘交互、展开筛选摘要；视觉规范和资产来源见 `docs/design-docs/UI_REDESIGN.md`。
- `static/deals.js` / `deal_views.js` / `deals.css`：搜特价、已返回日期价格条、排序和转监控草稿；复用地点与航班详情组件。
- `static/getaway.css`：搜特价风景首屏、跨区搜索条与机会排版；`deal_views.js` 依据已返回报价生成目的地导航和停留展示，`deals.js` 联动日期/目的地筛选，不引入新的查询或通知路径。
- `static/views.js`：监控、最新机会和采样记录；所有外部字符串转义。
- `static/automation.js`：监控设置、提醒中心、已读状态和收件邮箱配置。
- `static/auth.js`：登录、注册、初始化密码、退出，账号切换时清除旧视图。
- `static/flights.js` / `flights.css`：往返时长、机场、航班、航段与行李详情，数据边界见 `docs/FLIGHT_DETAILS.md`。
- `prototype/`：历史参考代码，Web 服务不导入，也不触发其桌面或 Telegram 通知。

## 数据与边界

`watches` 保存不可变查询条件与运行标记；`observations` 保存监控、目的地、往返日期、
查询时间、状态及报价 JSON。修改条件通过新建监控完成，避免混用历史口径。
`users` 保存账号资料；`watches.owner_id` 是所有业务记录的归属入口。
`location_history` 保存用户 ID、角色、规范地点 ID 和最后选择时间；GET/POST `/api/location-history` 使用会话归属，写入需要 CSRF。前端串行保存，账号切换清空列表并丢弃旧响应和未发出的写入。
HTTP 层只能使用会话返回的用户 ID，不接受请求体中的用户归属声明。
业务读写按用户过滤，内部采样任务可跨用户调度，但邮件收件人按监控所有者逐条选择。
目前 API 返回本地所有采样；长期运行前应添加分页与保留策略。

固定模式的返程日期表示目的地起飞日；周末模式的结束日期表示返回出发地当地日期。
报价固定 HKD、经济舱，人数由监控指定；新监控可选时长和中转限制，默认不限，旧监控保留 8 小时/1 次。
出发地和目的地保存带类型的地点 ID（国家/城市/机场），具体报价必须核对四个实际机场的范围归属。
每条监控最多保存 100 个目的地范围、4 个周末；每轮查询 12 组，持久化游标轮询其余组合。
自动与手动任务共用单线程队列和运行标记，避免重复排队。
`schedules` 保存开启状态、间隔、降价门槛、下次查询、失败次数与完成状态。
默认每 6 小时采样，失败后 15 分钟起逐次退避，最多等待一个正常间隔；成功后恢复正常间隔。
重启保留未来计划，到期任务只补一次，不回放所有错过的周期；中断任务可重新调度。
暂停会停止剩余组合，已经发出的查询会完成；运行期间修改设置在后续执行时生效。

`alerts` 和 `email_outbox` 与报价在同一事务里写入。`settings` 保存收件邮箱；SMTP 凭据
只从环境与忽略的 `.env` 读取，不通过 API 返回。完整配置不代表真实认证和投递已通过。
邮件规则与重试限制见 `docs/EMAIL.md`，账号迁移和会话边界见 `docs/ACCOUNTS.md`。
每个数据库只支持一个服务进程，不能多进程共享调度。

机会列表仅使用每组组合最近一次结果，失败后旧报价仍保留在历史中。
价格历史和提醒按监控、四个实际往返机场、去程起飞/返程起飞及返回日期分别比较，不声称完整市场低价。
每次范围查询产生 batch_id，机会列表保留最新批次的多个实际行程；失败/空批次隐藏此前机会，历史仍保留。
航班返回时间依照数据源的当地时间字段；实际响应格式变化需要适配器验证。

## 运行与验证

- 启动：`python3 -m app.server`，默认 http://127.0.0.1:8765。
- 测试：`python3 -m unittest discover -s tests -v`。
- 隔离验收数据库：`FARE_SCOUT_DB=/tmp/fare-scout-qa.db python3 -m app.server --port 8766`。
- 生产化前需补邮箱验证、密码找回、HTTPS 部署、共享查询、长期采样保留策略和多进程调度协调。

搜特价 POST `/api/deals` 发起任务，GET `/api/deals/{id}` 查询本人结果；同样需要登录，写请求要求 CSRF。
默认 Anywhere，直接使用上游日期范围和晚数能力，每次最多 6 个目的地范围；不展开逐日/逐机场穷举。
每账号最多一份在途搜索，任务上限 100；完成任务超过一小时在新搜索时清理，重启清除全部任务。
搜索结果不等于促销或历史最低价；转监控需用户在原有表单保存，自动查价默认暂停。

### 多出发地与地点范围（2026-11-02）

`location_scopes.py` 负责范围解析、规范 ID 去重与展开上限。`domain.validate` 保存
`origin_selections` / `destination_selections` 及展开后的 `origin_locations` / `destination_locations`；
兼容历史单出发地配置。任务携带 `origin_id`，适配器使用该范围发起请求，筛选往返机场均按该任务检查。
多出发地监控的 `search_id` 带出发范围，单出发地延续旧键；报价比较仍使用实际机场及日期。
搜特价按两端展开的组合执行，最多 120 组，失败统计与进度使用相同组合数。

### 可恢复删除（2026-11-02）

`removals.py` 通过登录用户归属校验处理 `/api/{watches|offers}/{id}/{delete|restore}`。
监控使用 `watches.deleted_at`，机会使用 `observations.dismissed_at`，不清空价格证据。
状态接口分出 `deleted_watches`；机会先按最新批次取结果，再排除 dismissed 行，避免旧报价回流。
删除监控同时暂停查价和提醒、取消待投递队列；调度、任务申领、Worker 和采样写入检查删除状态。
列表“最近删除”可跨刷新恢复；恢复监控保持暂停。机会删除仅移除本条采样展示，新采样可再次成为机会。

### 浏览器外观与风景偏好（2026-11-02）

`theme-init.js` 在样式加载前读取主题，`appearance-store.js` 校验并持久化
`fare-scout:appearance`，`appearance.js` 管理原生 dialog 与即时预览。
`themes.css` 定义六套语义颜色；中文使用本地思源宋体子集，拉丁正文沿用 Manrope、英文展示沿用 IM Fell English。
`auth.css` 最后加载，与工作区共用颜色和排版；`appearance.css` 负责侧栏响应式布局。
字体来源、OFL 许可及重建见 `static/assets/CHINESE-FONT.md`，Python 与 Workers 均提供同源 WOFF2。
偏好仅在当前浏览器保存，不调用账号接口，不改变航班查询或邮件配置。
`landscape-provider.js` 集中请求 Wikimedia Commons 公共 CORS API，无需 API key；浏览器直连不携带登录凭据。
每小时按精选风景分类取最多 12 条元数据，筛选横向 JPEG/PNG、作者、可信图片/来源域名及明确的 CC BY、CC BY-SA 或 CC0 许可。
成功结果缓存在本浏览器一小时；旧的固定照片及轮换频率偏好不再控制图片。页面打开期间按一小时间隔取图，隐藏页面恢复时补查一次，不在服务器后台下载。
接口失败、无可用许可、图片解码超时/失败均回退本地岚山竹林，并记录诊断和显示提示；默认图不可用时保留摄影来源入口。
爱心保存 ID、标题、作者、来源至本浏览器，不固定图片；“我的喜欢”可回到来源页或取消喜欢，不提供背景切换。
下载当前展示尺寸的 JPEG/PNG，保留可见作者、来源与许可链接，失败提供友好提示；不提供许可未知图片下载。
Python 与 Workers 的 CSP 仅新增 Commons API 与 upload.wikimedia.org 图片域名，脚本仍为同源。
原 `landscape-rotation.js` 与 `appearance-store.js` 的旧频率字段仅保留兼容，当前入口不调用轮换器。

`surfaceOpacity` 控制顶部主题底色遮罩（0–100，默认 65），照片和下方信息区不随它变淡；
上一轮照片 opacity 偏好不再沿用。`motion` 控制顶部维港的楼群滚动，并遵循系统减少动态设置。
`world-backdrop.js/css` 的图层是 atlas-scene 的内部装饰，受其边界裁切；没有全页背景或全页透明面板。
滚动通过单次 requestAnimationFrame 合并绘制，远景与两座塔楼分别有界平移，没有持续动画循环。
图片包含同源的维港夜景与缩略图，作者/许可见 assets/places/CREDITS.md。
