# Cloudflare Workers Free + D1

线上地址：**https://fare-scout.phosssuki.workers.dev**。当前发布版本 `3cf0e7e9-74bb-4c06-b580-7c4e42d66eab`（代码提交 `b4c86ca`，2026-11-03）。Workers Free，Passkey 登录；未开通 Paid，未迁移旧本地数据，Cloudflare 邮件发送已启用，按用户验证与接收确认状态投递。

D1：`fare-scout`，ID `1486b8bd-cca8-4a19-9bf2-7cfcb71d3477`，APAC。`0001`–`0011` 共十一项迁移已应用，Wrangler 确认没有待应用迁移。部署前后用户 4、Passkey 4、会话 6、监控 2；行程收藏/分享表为空，新批次副本表有 21 条记录。后续更新不初始化或清空业务数据，原 SQLite 与旧本地 D1 均保留。

## 本地运行

需要 Node.js 22+、Python 3.9+、npm。本轮实际 Node 26.5.0。

```bash
npm ci
cp .dev.vars.example .dev.vars  # 仅首次配置；已有文件勿覆盖
npm run db:local
npm run dev
```

使用 **http://localhost:8787**。Passkey 的 RP ID 使用域名，开发使用 localhost；不要用 127.0.0.1 注册凭据。本地 `.dev.vars` 覆盖 `PASSKEY_ORIGIN=http://localhost:8787`，生产配置是正式 HTTPS 地址。

`wrangler dev` 使用项目 `.wrangler/` 的本地 D1。`.dev.vars` 优先于旧 Python `.env`，无需复制旧 SMTP 凭据。真实查询由 `QUERY_ENABLED` 控制，验收期间 `MAIL_ENABLED=false`。

旧版 `python3 -m app.server` 仍使用 8765 和 `fare_scout.db`，保留密码登录。前端根据 `/api/auth/session` 的 `auth_mode` 显示相应登录界面；Python 版不会加载 Passkey 模块。

## 本地双登录模式（2026-11-04，待发布）

本地代码新增 `AUTH_MODE=mixed`，同时开放现有密码及通行密钥实现。`/api/auth/session` 返回 `auth_methods`，前端据此提供登录／注册方式切换；`passkey` 仍只开放通行密钥，`password`／缺省仍只开放密码。当前 wrangler.jsonc 保持线上 `passkey` 配置，未部署或切换生产认证。

```bash
npm run dev -- --local --var MAIL_ENABLED:false --var QUERY_ENABLED:false --var AUTH_MODE:mixed --var PASSKEY_ORIGIN:http://localhost:8787
```

现有凭据独立校验，沿用 PBKDF2 600,000 轮、同源检查、限流、会话与 CSRF；已有仅通行密钥账号不会自动获得密码。重复邮箱注册不能为其添加或重置密码。旧 Python 数据也不会因此迁移到 D1。尚未实现云端账号的密码绑定／找回；Python 本机恢复命令不显示给 Workers 用户。密码路径的线上 CPU 开销尚未在真实 Workers Free 环境验收。

## Passkey

首次在正式网址创建账号，填写昵称和提醒邮箱，再由浏览器/设备创建 Passkey。以后用指纹、面容、设备 PIN 或安全密钥完成验证。验证发生在设备上，D1 保存凭据 ID、公钥与计数器，不保存设备私钥、生物特征或云端登录密码。

- 使用 `@simplewebauthn/server` / `browser`，浏览器库打包为同源静态资源，附 MIT 许可；不运行 CDN 脚本。
- 要求可发现凭据与设备用户验证，当前提供 P-256 / ES256。
- 服务端固定校验 `PASSKEY_ORIGIN`、RP ID 和 challenge；challenge 由 HttpOnly/SameSite Cookie 绑定、五分钟过期，验证时单次消费。
- 校验签名、凭据归属、userHandle、验证标志与计数器，签名失败不颁发会话；账号/公钥同事务创建。
- 登录后使用服务端不透明会话；登录页默认保持 30 天，取消选项则 7 天。Cookie 使用 HTTPS Secure/HttpOnly/SameSite 与逐会话 CSRF，同源检查继续生效；不保存登录密码。
- 云端密码注册/登录/初始化入口关闭，避免触发旧 JS 密码计算；旧本地密码算法保留供 Python 与原测试使用。

凭据绑定网站域名：localhost 和正式站分别注册；以后换域名需要安排凭据迁移/重新注册。请选择支持同步的密码管理器或妥善保存安全密钥；当前尚未提供账号找回、追加密钥或设备管理界面。邮箱用于提醒，暂未验证所有权。

## 运行与资源

配置没有自定义 `limits.cpu_ms`，使用 Free 配额。CPU 时间是执行计算的时间，等待 Kiwi 网络响应不等于 CPU 时间。免费额度有请求数、CPU、D1 读写等限制，不能根据一次验收推断任意规模均可用。[官方限制](https://developers.cloudflare.com/workers/platform/limits/)

- `index.js` / `http.js`：现有业务 API、同源/CSRF、大小限制、安全响应头、静态资源。
- `auth.js` / `passkeys.js`：公共会话逻辑、Passkey 注册/签名验证、持久化限流。
- `domain.js` / `locations.js`：原日期/人数/实际机场筛选；地点检索预处理目录，避免逐请求重复规范化全部记录。分类 JSON 由原 Python 定义生成。
- `store.js` / `history.js`：账号隔离、监控、提醒设置、历史、可恢复删除。
- `runs.js` / `tasks.js`：D1 中保存搜索和逐组任务，90 秒租约及随机令牌限制领取和迟到写入；监控每轮最多 12 组，特价最多 120 组。
- `provider.js`：独立 Kiwi JSON/SSE 适配器，整组超时 22 秒，临时失败最多 3 次；失败与无匹配分别记录。超过单组 100 个已筛选实际行程时显式报错，不静默截断。
- `migrations/`：应用表、持久队列、事务提醒触发器及 Passkey 公钥/挑战。样本、提醒和发信队列同事务写入，删除监控使在途任务令牌失效。
- `mail.js`：原 Resend HTTPS 适配器保留；已上线 Cloudflare 原生发信、邮箱验证与用户接收确认，详见 [CLOUDFLARE_EMAIL.md](CLOUDFLARE_EMAIL.md)。真实确认邮件已由用户收件并确认；每日推荐和降价提醒的实际定时投递待运行验收。

已捕获一次线上 Cron：outcome=ok，CPU 5ms、wall 1393ms、无异常（当时空库，没有监控查询）；这区分了计算与等待时间，不代表所有未来负载。

Cron 每分钟触发。当前本地性能改动中，普通状态读取不调度任务；提交搜索和搜索进度请求通过 `waitUntil` 协助处理最多四个任务，跨请求共用四个源查询名额，Cron 每次最多处理两个任务并接续未完成工作。原样本证据保留，已完成的搜索队列元数据保留一小时、监控任务元数据七天。

本地 Cron 需显式触发，不会像云端按分钟执行：

```bash
curl 'http://localhost:8787/__scheduled?cron=*+*+*+*+*'
```

## 验证与边界

```bash
npm run build                    # 仅 dry-run，不发布
npm run test:workers              # 真正 workerd + 临时 D1，模拟外部源
npm run test:frontend
python3 -m unittest discover -s tests -v
FARE_LIVE_KIWI=1 npm run test:source  # 隔离本地数据库中的真实源查询
```

本轮 18 项 Workers/D1 测试和 13 项前端测试通过，原 Python 61 项回归在迁移阶段通过。新增 Passkey 测试使用实际生成的 P-256 测试密钥和协议响应，覆盖注册、签名登录、过期、单次挑战、重放、来源/RP、设备验证、归属与计数器；不是实际指纹/面容设备验收。

线上 Free 验收已完成：用独立合成账号验证注册协议、签名登录、重放拒绝、受保护 API、地点检索；真实 Kiwi 香港—新加坡、未来 20–23 天出发、2–5 晚、1 成人经济舱 HKD、无预算上限，一组查询成功，1 条报价通过筛选。测试账号、凭据、会话与搜索随后定向清理；业务表复核全为 0，没有用户通知。

HTTPS 首页和字体均返回 200，字体与本地文件逐字节一致。原生设备 Passkey 注册、桌面和移动端视觉/操作仍待用户现场验收：浏览器工具提示 Work 禁用本地浏览器，未绕过该设置。首次真实注册须由用户本人完成设备验证。

## 管理与发布

项目已有 `wrangler.jsonc`，继续使用项目内 Wrangler，不生成其他配置体系。正式发布已获用户授权；后续变更仍按项目约定确认后发布。

```bash
npx wrangler whoami
npm run build
npx wrangler d1 migrations apply fare-scout --remote
npx wrangler deploy
```

配置含当前账号/数据库 ID、`workers_dev=true`、预览 URL 关闭、查价开启、发信关闭。用户在首次部署时选择**空库**；后续已注册用户的数据必须保留，不得重新初始化、清库或执行旧数据导入。离线导出/初始化工具仅作为管理员工具保留；私密文件位于被忽略的 `cloudflare/imports/`，不得随代码上传。

Cloudflare 官方 19 个 skills 已安装至 `~/.agents/skills/`；Codex 的 Cloudflare MCP 已注册并 OAuth 成功，重启后加载。可选 `cf` CLI v0.15.0 已安装；前两轮授权超时后，新一轮官方设备授权已成功，CLI 已保存自身登录凭据。Wrangler/MCP 登录不受该独立流程影响。

## 此前 CPU 配置的结论

最初为兼容旧库保留 JS PBKDF2 600,000 轮，并配置每请求 CPU 上限 30 秒，Free 因不支持自定义 CPU 配置拒绝发布。这不是业务必须购买 CPU 的证明。

本地测量旧 JS 校验约 405–420ms、地点查询约 11ms；目录预处理后本地中文约 0.96–1.43ms、IATA 约 0.46–0.49ms。当前本地 workerd 原生支持 600,000 轮，线上 Free 探针却仍拒绝超过 100,000，因此本地能力不能当作线上结论。临时探针已清理。最终按用户选择采用 Passkey，保留设备验证与签名校验，完成 Free 现场协议验收。

## 后续更新的数据保留规则

更新 Worker 代码和静态资源继续绑定同一个 D1 database_id；不会执行初始化 SQL 或导入脚本。
数据库变更只通过未应用的增量迁移执行。0006_daily.sql 新建每日偏好/简报表并调整一个查询索引，
不删除 users、passkeys 或现有用户配置。发布前后用只读聚合核对账号/凭据数量，不输出邮箱或密钥。

2026-11-02 本次更新前：用户 3、Passkey 3、会话 3、监控 0。已记录 Time Travel 恢复书签；
发布前 115 项检查和 dry-run 通过。正式更新结果见下方发布记录。

## 2026-11-02 后续正式更新记录

- 代码提交并推送：d10048c；正式版本 7f9d731b-ca1c-46c7-84a1-3a4b96c3326a。
- 0006_daily.sql 应用成功，之后 migrations list 显示没有待应用迁移。
- 更新前后均为 3 个用户、3 个 Passkey、3 个会话、0 个监控；每日偏好默认关闭，0 条偏好记录。
- 同一 D1、Passkey Origin 和邮件关闭设置保持不变，不执行数据库导入或初始化。
- 发布前 28 项 Workers/D1、26 项前端、61 项 Python 检查通过；发布后七项主要资源返回 200，
  SHA-256 与本地代码/图片相同，未登录会话仍为 Passkey 模式、受保护 state 接口返回 401。
- 浏览器正式登录页加载正常、控制台无错误；本轮没有代替用户执行设备验证、真实查价或邮件投递。

## 2026-11-02 新首页与设置发布

- 已推送版本 ccc50db 在独立目录检查后发布，线上版本 fdbf9996-d72b-4a05-9b86-db6695499814；包含新首页、思源宋体、语言/显示货币设置和 Unsplash 精选图库。
- 64 项前端/Workers 检查及 dry-run 通过；14 项公开资源 200 且与快照哈希相同。原 D1、Passkey 域名与邮件关闭状态保留，无数据库迁移。
- 用户授权的四项只读计数发布前后相同：用户/Passkey/会话各 3，监控 0。实际浏览器验证已有登录会话、中文宋体、远程湖景和设置入口。
- 工作区的 Cloudflare 邮件验证/原生发信接入及 0007 迁移仍未部署。详见 PROGRESS.md 本轮发布记录。

## 2026-11-03 完整版本发布

- 用户授权提交/推送全部改动后部署；运行时代码为 `85ad7c1`（含 `0a6d909` 的设置折叠、横线清理、风景刷新和 `dfdacdc` 的固定返程/离散晚数搜索）。此前线上邮件能力已一并纳入 Git。
- 正式版本 `9fb855a9-5032-41ff-b50b-8005ab53153b`，保留同一 D1、Passkey Origin、EMAIL/CF_EMAIL_API_TOKEN、邮件/查价开启和每分钟 Cron；无待应用迁移，未初始化或导入数据。
- 发布前 38 项前端、37 项 Workers、67 项 Python 检查及 dry-run 通过。发布后 15 项公开资源哈希一致，Passkey 模式、未登录 401 保护正常。
- 发布前后用户 3、Passkey 3、会话 5、监控/采样/提醒 0、邮箱目标/接收确认各 1；线上浏览器确认手动换图、设置折叠、邮箱已验证和 390px 手机布局，控制台无 error。未重做设备认证、主动查价或邮件发送验收。

## 2026-11-03 登录、管理后台与完整工作区更新

- 用户授权将本地所有改动提交并推送：`b4c86ca`；分支 `main` 的 5 个既有未推送提交也一并推送到 `origin/main`。
- Workers 版本：`3cf0e7e9-74bb-4c06-b580-7c4e42d66eab`，部署消息 `b4c86ca: admin dashboard and remembered login`。通过 `--keep-vars` 保留仪表盘变量；已有 EMAIL/D1/静态资源/每分钟 Cron 继续使用同一绑定。
- 正式 D1 依序应用 `0008_search_presets.sql`、`0009_performance.sql`、`0010_admin.sql`、`0011_trips.sql`。Wrangler 随迁移备份，完成后显示没有待应用迁移。
- 部署前后用户 4、Passkey 4、会话 6、监控 2。新收藏与分享表为空；`current_observations` 迁移回填 21 条当前批次副本，完整历史仍保留。
- 前端 66 项、Python 80 项、完整 Workers/D1 套件及 `npm run build` dry-run 通过。部署后通过浏览器实际打开线上站点；没有代替用户创建报价、发送邮件或授予新的管理权限。`ADMIN_USER_IDS` 没有写入代码配置，此次未变更已存在的仪表盘值；空值仍由服务端默认拒绝。

## 2026-11-03 本地性能优化验收数据（不代表线上负载）

- `assets.run_worker_first` 仅匹配 `/api/*` 与 `/setup`，其余资源采用原生静态分发。`app/static/_headers` 保留 CSP、Referrer-Policy 与 nosniff。未指纹化文件保留原生 `max-age=0, must-revalidate` 和 ETag，避免长期缓存旧模块；API 继续 `no-store`。
- 登录后的空闲状态刷新间隔从 4 秒改为 30 秒，监控运行时为 4 秒、失败后为 60 秒；隐藏标签暂停，重新显示立即刷新。特价进度有变化时 1.5 秒刷新，无变化逐步延长到最多 8 秒，不重叠发出请求。
- `/api/state` 只读取每组监控的当前采样批次。`0009_performance.sql` 回填并维护 `current_observations`，保留全部历史；`GET /api/watches/:id/history?before=:id` 按 ID 分页，每页 100 条，采样覆盖和各实际行程最低价按完整历史计算。
- 提醒与最近删除机会各返回最新 100 条，并提供独立的继续加载接口。未读提醒总数包含尚未加载的页面。业务 API 仍按当前登录账号隔离，读取不会触发调度或发信。
- 特价/每日推荐的完全相同条件共享 60 秒内的成功结果（包括真实成功的空结果），D1 租约合并在途请求；失败不缓存，等候共享请求不消耗重试次数。保留源查询的实际时间，不把缓存命中时间当成重新查询时间。手动和自动监控采样始终请求数据源，价格历史不使用此缓存。
- 搜索接单只计尚在运行的普通搜索，已完成搜索保留一小时供查看，但不占运行名额。任务领取同时读取配置，减少单次 Worker 的 D1 调用；Cron 的每次查询批量减小，减少串行积压和单次调用负担。

本地隔离服务为 http://localhost:8788，独立配置 `/tmp/fare-performance-qa.json`、数据库 `/tmp/fare-performance-qa-state`，查询与发信显式关闭。为方便浏览器自动验收，该隔离服务使用原有密码登录模式；正式配置仍为 Passkey。迁移只应用于本地，不连接正式 D1。

可使用 `node scripts/benchmark_local.mjs http://127.0.0.1:8788 /tmp/fare-performance-session.json` 复测（需要事先创建本地合成账号并保存 Cookie JSON）。脚本拒绝远程目标，并检查查询关闭、邮件未配置。2026-11-03 在 1,005 条合成失败采样、一个当前批次、约 5,079 字节状态响应下，每档 100 个请求：

| 并发请求数 | P50 | P95 | 结果 |
| --- | --- | --- | --- |
| 1 | 6ms | 9ms | 100/100 HTTP 200 |
| 10 | 33ms | 45ms | 100/100 HTTP 200 |
| 50 | 139ms | 208ms | 100/100 HTTP 200 |
| 100 | 268ms | 283ms | 100/100 HTTP 200 |

这些是本机 workerd + 本地 D1 的短时状态读取结果，不包含真实数据源、邮件、设备 Passkey 或 Cloudflare 网络、CPU 与配额约束，不表示线上承载上限。浏览器已检查登录、监控最新批次、100→200 条历史翻页、390px 无横向溢出和查询关闭提示。性能代码随本节上方的 `b4c86ca` 部署；这里的本地基准不替代线上容量测量。
