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
邮件新增 Cloudflare 原生 EMAIL 绑定，控制面适配器负责目标邮箱验证；D1 缓存云端验证状态，并保存每个用户独立的接收确认。原 Resend HTTPS 适配器保留。线上邮件已启用，真实确认邮件已完成收件验收，详见 [Cloudflare 邮件接入](CLOUDFLARE_EMAIL.md)。云端使用 Passkey（WebAuthn），五分钟单次挑战绑定 Cookie、固定 Origin/RP、要求设备验证；D1 只保存公钥与计数器，登录后复用会话/CSRF。登录默认保持 30 天（可取消并用 7 天会话），不保存密码。
本地 Python 密码版保留，前端根据 auth_mode 切换入口；云端密码接口关闭。

只读管理后台：`/admin → static/admin.js → /api/admin/* → admin.js / admin-pages.js → D1`。
复用会话并独立校验服务端账号 ID 白名单 `ADMIN_USER_IDS`，默认拒绝；API 仅 GET、分页、邮箱在服务端脱敏。
读取用户、任务、提醒/每日邮件及运行聚合，不推进队列或刷新验证。`runtime-health.js` 为 Cron 写入单行心跳，
以 invocation ID 防止迟到结果覆盖新状态；`0010_admin.sql` 为增量表和索引。Python 版不提供管理入口。
运行口径、授权配置、保留策略边界和面试问答见 [ADMIN.md](ADMIN.md)。

本地 `npm run dev`（predev 自动执行 `db:local` 补齐本地增量迁移并准备静态资源），地址 http://localhost:8787；数据库位于 `.wrangler/`。需要单独更新数据库时仍可执行 `npm run db:local`，不作用于远端 D1。
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
- `static/location_browser.js` / `location_browser.css`：各入口共享的分类浏览；输入始终全局搜索。`static/nights.js` / `nights.css`：1–10 晚复选框与空选校验，灵活日期按所选晚数过滤；搜特价的 `date_mode` 区分固定往返与日期范围，两种后端共用前端表单协议。
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
- `static/landscape.js` / `landscape-provider.js` / `landscape-actions.js`：每小时从已核对来源的 Unsplash 精选目录加载 CDN 照片，解码成功后缓存；单张失败自动换图，全部失败保留当前图（首次为同源竹林）；圆形刷新按钮绕过小时缓存并排除当前图，解码成功才切换，支持本浏览器收藏与图片下载。摄影来源与许可见 `static/assets/places/CREDITS.md` 及页面逐图链接，与查询条件独立。
- `static/ui.js`：默认搜特价、工作区导航及键盘交互、展开筛选摘要；视觉规范和资产来源见 `docs/design-docs/UI_REDESIGN.md`。
- `static/search-presets.js` / `search-presets.css`：用户显式保存的常用查询组合，表单下方全量快捷回填、固定往返面板内日期快捷项；`search-form.js` 共用查询提交与回填字段，保存/回填不发起查价。
- `search_presets.py` / Workers `search-presets.js`：账号隔离的组合列表、保存和软移除，每人最多 20 项，按规范化查询去重；仅持久化日期/地点/人数/筛选，不保存查询结果、通知或任务状态。SQLite 随初始化增表，D1 通过增量迁移 `0008_search_presets.sql` 建表。
- `static/travel-dates.js` / `date-editor.css`：日期面板内的出发星期多选与未来四个完整周末多选，周末按北京时间计算。周末搜索以 `date_mode=fixed` 和 `date_pairs` 提交具体往返组合；Python 与 Workers 校验每组周六/周日日期、按组查询并保留同一城市不同周末的报价，总查询上限仍为 120 组。
- `static/deal-progress.js`：查询未结束时显示完成组数、已返回报价及失败组数；`deals.js` 逐批展示报价，只在报价内容变化时重绘，保留日期/目的地筛选与排序。
- Workers `tasks.js` 以单条 D1 UPDATE 原子领取任务并限制有效运行租约为 4，跨轮询请求共享；手动查询及当前轮询的搜索优先。HTTP 每次并行一批 4 组，Cron 沿用已提交的批次上限；保留现有超时、重试、租约恢复及迟到写入保护。Python `deal_source.py` 共用 4 个查价线程，`deals.py` 按完成顺序聚合，`deal_jobs.py` 在运行中发布部分报价。
- `static/deals.js` / `deal_views.js` / `deals.css`：搜特价、已返回日期价格条、排序和转监控草稿；复用地点与航班详情组件。
- `static/getaway.css`：搜特价风景首屏、跨区搜索条与机会排版；`deal_views.js` 依据已返回报价生成目的地导航和停留展示，`deals.js` 联动日期/目的地筛选，不引入新的查询或通知路径。
- `static/discovery-layout.css`：首页最后加载的工作区布局层，统一搜索、结果工具和报价的对齐与字号；搜索后收起风景，手机优先展示价格，原生 details 收拢常用组合与目的地筛选。
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
报价币种存于查询/监控配置（旧配置缺省 HKD），经济舱，人数由监控指定；新监控可选时长和中转限制，默认不限，旧监控保留 8 小时/1 次。
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
`landscape-provider.js` 使用项目维护的 Unsplash 精选目录，包含逐图作者、原始照片页、CDN 图片标识和 Unsplash License；不调用需要密钥的 Unsplash API，不在运行时抓取网页。
远程图片从 `images.unsplash.com` 加载为 1600×1000 JPEG；预加载采用匿名 CORS，实际解码和尺寸检查通过才呈现并写入 v2 浏览器缓存。
成功图片保留一小时；缓存图片重新加载失败时跳过，最多尝试三张不同图片，各自最多等待 12 秒；全部失败保留当前风景（首次为本地岚山竹林），日志保留逐张错误。右上角半透明圆形按钮可立即换图，绕过一小时缓存并排除当前图；加载时旋转、禁用重复点击，成功后更新缓存与摄影信息。
缓存到期避开上一张；页面隐藏恢复时补查，不运行服务器后台下载。旧 Commons v1 缓存不再使用。
爱心继续保存在本浏览器，已有 Commons 收藏来源仍可访问；下载当前展示尺寸，页面保留作者、原图和许可链接。
Python 与 Workers 的 CSP 将风景图片及下载域名切换为 `images.unsplash.com`，保留汇率接口，脚本仍为同源。
原 `landscape-rotation.js` 与 `appearance-store.js` 的旧频率字段仅保留兼容，当前入口不调用轮换器。

`surfaceOpacity` 控制顶部主题底色遮罩（0–100，默认 65），照片和下方信息区不随它变淡；
上一轮照片 opacity 偏好不再沿用。`motion` 控制顶部维港的楼群滚动，并遵循系统减少动态设置。
`world-backdrop.js/css` 的图层是 atlas-scene 的内部装饰，受其边界裁切；没有全页背景或全页透明面板。
滚动通过单次 requestAnimationFrame 合并绘制，远景与两座塔楼分别有界平移，没有持续动画循环。
图片包含同源的维港夜景与缩略图，作者/许可见 assets/places/CREDITS.md。

### 统一设置、语言与参考货币（2026-11-02；2026-11-03 已发布）

右侧 `appearance-dialog` 为统一设置入口。`settings.js` 组合语言/货币、已有外观、当前账号邮箱和推荐/监控入口；
邮箱表单只有一份，提醒中心和每日偏好均定位到统一设置，不复制保存和验证逻辑。
账号未登录时隐藏账号偏好；Python 不支持每日推荐时隐藏该入口。单条监控的查价与提醒仍按监控分别保存。

`preferences.js` 校验 `fare-scout:preferences`（zh-CN / en；HKD、CNY、USD、EUR、JPY、GBP、SGD、AUD、CAD；默认 CNY，保留已保存的有效币种），
`i18n.js` 绑定 HTML 中明确声明的文本节点/属性，动态模块使用 `tr(中文, English)`；切换时不重置表单、不重新查价。
地点目录、远程照片元数据与服务端返回的诊断文案仍保留源语言；不改写用户输入。
外观沿用原存储键，恢复默认外观不会清除语言和货币。

`exchange-rates.js` 集中访问 Frankfurter v2，仅传 HKD 和目标币种，不携带会话或行程；缓存有效期 24 小时，
拒绝非正数、非 HKD 基准、异常日期及超过十天的参考日。`currency.js` 管理加载、失败与参考显示，`format.js` 共用卡片/历史价格格式。
新查询将所选币种传给 Kiwi，返回 offer.currency；若数据源明确返回其他币种，适配器报错，防止错标金额。只有所选展示币种与旧报价原币不同时，才以 HKD 基准汇率的比值换算，并保留数据源金额及参考日期；缺少任一汇率时保留报价原币。
预算、降价门槛、采样比较和邮件使用监控创建时的币种；浏览器设置不会改写已有记录。保存组合、行程快照和收藏身份保留币种，缺省仍为 HKD。每日推荐偏好也保存自身币种。
Python 静态白名单和两个运行时的 CSP 新增相应模块与 `https://api.frankfurter.dev`。

### 机票结果展示（2026-11-03；Workers 已发布）

`static/offer-views.js` 为搜特价与每日推荐共享展示控制器，在原筛选与报价索引之上切换登机牌列表、紧凑卡片、航线地图；展示偏好保存在浏览器。`deal_views.js` 继续统一报价、航班详情与监控草稿，外层增加行李件数。`offer-views.css` 集中三种视图和移动端样式，取消首条报价独占整行。

`route-map.js → route-map-chart.js → route-basemap.js` 在首次进入地图时加载同源 MapLibre GL JS 6.16.0 和 OpenFreeMap Liberty 底图。`route-airports.json` 只含机场坐标，约 222 KB；浏览器直接访问 `tiles.openfreemap.org` 获取样式、地形、矢量瓦片和字体，不传递账号或报价。渲染器与 worker 由 `npm run assets:maps` 从锁定依赖复制到同源 vendor 目录，开发和构建前自动执行。Python、Workers 与静态响应头同步允许该地图域及同源 worker，保留供应商署名。

`route-bubbles.js` 按地图投影后的像素位置避让单行价格气泡，优先低价和当前选择；密集目的地以小圆点或数字聚合，只有选中的航线显示橙色连线。地图提供原生缩放、拖动与全览，航线仅为机场间示意。左侧目的地卡片保留地点、往返日期、双程时长、价格及行李件数；手机将侧栏移到地图下方。`route-card-views.js` 读取同源图片目录与来源记录，缺图时显示机场占位。日期切换、航班详情和创建监控继续使用原始报价索引。缺坐标或底图加载失败仍保留报价；重试地图不清除查询结果。数据、图片来源与许可见 `app/static/assets/MAP-SOURCES.md`。

## 2026-11-03 · 性能改动（Workers 已发布）

Workers 静态资源优先直出，安全响应头由 `static/_headers` 维护；业务 API 仍走登录守卫且禁止缓存。
`static/polling.js` 统一管理可见性、单个在途请求和刷新间隔；`history-panel.js` 在打开记录时加载分页历史，Python 版仍兼容原状态数据。
`store.state → observation-history.currentObservations / alert-pages` 只组装最新批次与分页摘要；历史覆盖、实际行程最低价在历史接口按完整数据计算。
`0009_performance.sql` 增加当前批次索引表、查询缓存和相关索引，不清理采样与账号。
`tasks → source-cache → provider` 为发现查询共享完全相同条件的短期结果，以 D1 租约合并在途请求；监控采样保持新鲜查询。源错误、空结果与缓存来源时间分别保留。
普通状态读取不启动后台工作；创建自动监控显式入队，搜索提交/进度请求协助处理，Cron 持续接续队列、每日推荐与邮件。跨请求保留现有四路源查询上限。
验证及并发测试口径见 `CLOUDFLARE.md` 的本地性能章节。

## 单程搜特价（2026-11-03；Workers 已发布）

搜索表单通过 `trip_type=roundtrip|oneway` 区分行程；旧查询和保存组合默认往返。`app/deals.py → oneway.py / deal_source.py` 与 `cloudflare/src/domain.js → provider.js` 分别负责单程条件校验、去程过滤及不带返程/晚数的 Kiwi 请求。单程固定日期归一为 start=end，灵活范围保留出发星期。保存组合只为单程新增 trip_type，兼容旧往返快照去重。搜特价本身无新增迁移；固定日期单程监控见下方行程提醒说明，每日推荐仍为往返。

前端 `journey.js / search-form.js` 控制行程和日期联动；`deal_views.js / flights.js / route-card-views.js` 展示可缺省 inbound 的单程报价。`result-frame.css` 仅整理状态、排序和展示方式切换控件，不再绘制空白的大型外框；每日推荐工具栏仍独立。

## 行程收藏、分享与降价提醒（2026-11-03；Workers 已发布）

- `static/deal_views.js → trip-state.js` 为卡片、登机牌、地图具体报价及每日推荐生成统一操作；机票机会也接入相同入口。`trip-actions.js` 处理账号切换、收藏/撤销和「我的行程」；`trip-dialogs.js` 处理提醒设置与分享弹层，`trip-sharing.js` 使用浏览器系统分享和 Canvas 生成分享图片。
- `trip-snapshot.js` 同时用于前端和 Workers 的公开行程白名单，Python 对应 `trip_snapshot.py`。只接受航程、人数、经济舱、受支持币种的原始报价、行李、核价链接、筛选和原始查询时间，忽略邮箱、预算、通知等账号字段。收藏身份包含人数、舱位、币种、往返实际航段和时间，不包含报价及查询时间；降价提醒按同机场/日期/人数/筛选匹配，不锁航班号。
- `GET/POST /api/trips → trips.py / Workers trips.js`：每账号最多 200 条收藏，保存同一行程更新快照，移除可由界面短时撤销；数据库删除后不保留独立回收站。收藏与监控独立，不触发采样或邮件。
- `POST /api/shared-trips` 需登录与 CSRF，生成不可猜测的 UUID 分享标识；`GET /api/shared-trips/:id` 无需登录，只返回白名单快照和分享时间，错误标识统一 404。分享快照不可变，同一账号相同内容复用链接，每账号最多 1,000 个快照。持有链接可查看，当前没有分享撤销入口。
- `/share.html?id=… → shared-trip.js` 提供公开报价快照与核价入口；收藏/提醒引导 `/?trip=…`，登录后展示原快照供操作。分享页不自动重新查价，不表示当前报价。开发本地链接只能在对应本机服务访问。
- SQLite 初始化增表，D1 `0011_trips.sql` 已增量应用；发布没有清理既有数据。线上仍需用户自行操作查价与行程功能，自动通知的长期现场效果不由模拟测试代替。
- 固定日期监控新增 `trip_type=oneway`：源适配器不传返程参数，过滤与价格身份将单程和往返分开，通知总价文案区分行程类型；现有往返与周末配置继续兼容。机场不同的开口往返仍需从城市/地区监控入口自行配置。

本地地点名称由 `scripts/build_cloudflare_data.py` 从同一地点目录生成 `static/location-names.json`，`location-names.js` 提供中英城市/机场名称和常见航司的标准代码对应中文名称；加载后重绘结果、地图、收藏及公开分享。目录未收录的名称保留数据源名称或机场代码，不猜译。中文金额单位通过 `currencyLabel` 显示中文币名。

## 航线详情与方案比较（2026-11-03，本地待验收）

搜特价／每日推荐的登机牌和卡片由 `offer-views.js → route-detail.js` 打开详情面板；`route-detail-model.js` 按实际去返程机场及报价币种归组，`route-detail-views.js` 展示日期组合、完整报价方案、当地时间与中转、所选航段／行李和核价入口。手机为全屏面板，桌面为双栏；去返程始终选择数据源的完整组合。

`route-detail-search.js → POST /api/deals` 复用已有账号隔离队列与轮询。新增可选 `comparison:true` 仅接受单组机场与固定日期，沿用人数、报价币种及中转／时长条件，不设发现预算上限。Python `deal_source.py` 和 Workers `provider.js` 此时传 `one_for_city:false`，按完整去返航程去重保留最低报价；Workers `runs.js` 同样保留不同航班组合，普通发现与监控聚合规则不变。补查更新该日期组合及其查询时间，失败／空结果保留旧报价并明确提示；关闭或切换日期后忽略迟到响应。补查不创建监控、价格采样、提醒或邮件，无新增数据库迁移。

## Python 本地 Passkey（2026-11-03，本地待发布）

`auth.js → local-passkeys.js → /api/auth/passkey/* → local_passkeys.py → passkey_store.py / SQLite`。
`passkey_crypto.mjs` 是本机验证适配器，复用 `@simplewebauthn/server`，通过 stdin/stdout JSON 与 Python 通信，
有超时与友好错误；不会把私钥、响应或完整异常写入日志。现有密码会话及恢复能力保留，
设置中为当前账号绑定/列出/移除密钥，登录采用可发现凭据，不另建同邮箱账号。
挑战绑定来源、浏览器和绑定会话，五分钟、一次性；本地 RP 为 localhost。
依赖、边界和验证见 [ACCOUNTS.md](ACCOUNTS.md)。

### 全局显示配置

字体栈唯一入口为 `static/style.css` 的 `:root --family`，品牌文字、装饰标题、地图 UI、弹层、分享图与管理页均复用。`test_global_typography.mjs` 经 CSS 解析检查所有自有样式的字体所有权；组件只能调整字号、字重和行高。显示货币复用 `preferences.js → currency.js → format.js`，主题复用 `theme-init.js / appearance.js → themes.css`，分享与管理页同样加载全局入口。源报价和历史记录保留原币种，换算展示保留来源说明。

目的地照片：`destination-photos.json` 为统一元数据，显式机场别名复用对应城市的实拍；`destination-photos.css` 负责卡片、登机牌和地图共用构图。收藏、公开分享、机票机会和监控异步加载同一目录，图片失败保留报价。`watchPhotos` 为多地点或国家/区域监控生成最多两张范围内的城市图例；依据地点目录中的 `city_code` / `country_code`，只解析带类型的国家成员，不通过名称推断范围。城市/机场别名去重，不同选择轮流取图；图例注明部分风景，不改变监控目的地。单图失败保留其他图，全部失败收起图例。地图详情不重复显示封面。`assets/destinations/CREDITS.md` 记录选片与来源。下载脚本默认只恢复缺失的已选原图：Unsplash 按目录宽度请求，Commons 使用已核对的 HTTPS 官方媒体 download_url，不需要 cdn_id；验证 JPEG 完整宽高后原子写入；`audit_destination_photos.py` 离线核对文件与覆盖缺口。长期覆盖进度见 `docs/DESTINATION_PHOTOS.md`。


## 本地登录与旅行素材（2026-11-04）

- 当前本地入口统一为 `npm run dev` → `http://localhost:8787` → Wrangler 本地 D1；`.dev.vars` 使用 mixed 认证。历史 Python 8765 服务已停用，`fare_scout.db` 留作迁移源／备份，不进行双写。现有迁移器 `scripts/export_d1.py` 在副本中升级旧 schema，排除会话与 setup tokens，仅向空的已迁移 D1 导入；保持密码哈希与账号 ID，暂停导入的查价和提醒计划。线上数据库未参与本次操作。
- `auth-films-data.js` 是登录场景与未来导览可共用的素材目录：稳定 ID、作者／原页、实际地点依据与画面焦点。地点未知时留空，不把体验名称当作具体城市。`auth-films.js` 根据原生 ended 事件换片，双播放器交接，删除 loop 和 30 秒轮换计时器；载入失败有诊断并跳过，所有片段失败时展示中性背景。减少动态效果／省流量使用静帧，不自动轮换。
- `film-preferences.js` 保存 `fare-scout:travel-media:reactions:v1`（`version`、以素材 ID 为键的 `reaction` 与 `updatedAt`）。爱心切换 liked；碎心写入 disliked 并立即从队列排除；已排除的素材刷新后仍跳过，撤销入口可恢复。此阶段是浏览器内访客偏好，不上传账号、不跨浏览器同步；未来导览可以按同一 ID 读取目录及偏好再接入账号收藏。存储失败保留本次选择并明确提示。全部排除后停止风景，并允许撤销，不强制重播已拒绝的素材。
