# Cloudflare Workers Free + D1

线上地址：**https://fare-scout.phosssuki.workers.dev**。当前发布版本 `fdbf9996-d72b-4a05-9b86-db6695499814`（代码 `ccc50db`）。已按用户授权发布到 Workers Free，使用 Passkey 登录；未开通 Paid，未迁移旧数据，邮件发送关闭。

D1：`fare-scout`，ID `1486b8bd-cca8-4a19-9bf2-7cfcb71d3477`，APAC。六项迁移已应用，现有正式账号持续保留。首次上线时仅清理过独立合成验收账号；后续更新不再初始化或清空业务数据，原 SQLite 与旧本地 D1 均保留。

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

## Passkey

首次在正式网址创建账号，填写昵称和提醒邮箱，再由浏览器/设备创建 Passkey。以后用指纹、面容、设备 PIN 或安全密钥完成验证。验证发生在设备上，D1 保存凭据 ID、公钥与计数器，不保存设备私钥、生物特征或云端登录密码。

- 使用 `@simplewebauthn/server` / `browser`，浏览器库打包为同源静态资源，附 MIT 许可；不运行 CDN 脚本。
- 要求可发现凭据与设备用户验证，当前提供 P-256 / ES256。
- 服务端固定校验 `PASSKEY_ORIGIN`、RP ID 和 challenge；challenge 由 HttpOnly/SameSite Cookie 绑定、五分钟过期，验证时单次消费。
- 校验签名、凭据归属、userHandle、验证标志与计数器，签名失败不颁发会话；账号/公钥同事务创建。
- 登录后使用服务端不透明会话（7 天）、HTTPS Secure/HttpOnly/SameSite Cookie 和逐会话 CSRF，同源检查继续生效。
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
- `mail.js`：Resend HTTPS 适配器，需启用开关、发件邮箱与 Secret 后才能发送；真实投递尚未验收，不上传旧 SMTP 凭据。

已捕获一次线上 Cron：outcome=ok，CPU 5ms、wall 1393ms、无异常（当时空库，没有监控查询）；这区分了计算与等待时间，不代表所有未来负载。

Cron 每分钟触发；网页轮询通过 `waitUntil` 协助处理一个任务，关闭网页后由 Cron 接续。原样本证据保留，已完成的搜索队列元数据保留一小时、监控任务元数据七天。

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
