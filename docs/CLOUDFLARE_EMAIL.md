# Cloudflare 免费邮件接入

已正式部署，当前版本 940b46ab-250e-4ab6-bcc5-93c0c50d6fea。MAIL_ENABLED=true；专用 Secret 和 EMAIL 绑定已生效，真实接收确认邮件已由用户收件并点击确认。正式业务数据保留。

## 用户流程

1. 在「提醒中心」保存收件邮箱，再点击「发送验证邮件」。后端只使用当前会话的已保存地址，不接受请求中的目标邮箱或用户 ID。
2. Cloudflare 发来验证邮件，用户点击验证链接后返回本站，点击「检查验证结果」。
3. 本站通过原生邮件绑定发送「确认接收机票提醒」邮件。用户在设置邮箱的同一 Fare Scout 账号中打开链接，完成接收确认。
4. 每日推荐和监控提醒各自按用户开启的设置发送。保存邮箱不会替用户开启每日推荐或监控。两类提醒均可在网页暂停。

第二封确认邮件是必要的账号绑定：Cloudflare 的 verified 状态在整个云账号内共享，单靠它不能证明某个 Fare Scout 用户拥有这个邮箱。确认令牌只存 SHA-256 摘要，链接使用 URL fragment，不进入服务端 URL 日志；一小时过期、单次使用、要求会话及 CSRF、绑定当前用户/云账号/收件地址。登录邮箱的 Passkey 注册不代表收件邮箱已验证。

更换收件邮箱后，新地址重新走验证流程，不继承旧地址的验证状态。回到本人先前已确认的同一地址可复用确认；发送前仍向 Cloudflare 检查该地址当前是否有效。用户打开确认链接时若登录了其他账号，需切换到原账号并重新打开链接。

未收到 Cloudflare 验证邮件时先查看垃圾箱；目前公开 REST API 未提供本实现可使用的重发接口，不通过删除目标地址重建来重发。管理员可在 Cloudflare 控制台处理重发。本站接收确认邮件可每五分钟重新申请一次。

## 管理员上线配置（用户验收并授权后执行）

- 确认拥有 phosssuki.edu.kg 的 DNS 管理权，在 Cloudflare 开通 Email Routing，按控制台要求配置邮件 DNS。若域名已有收信业务，应先检查 MX/SPF，避免覆盖已有服务；也可改用专门子域名并同步下面的发件地址。
- 当前 wrangler.jsonc 预置 MAIL_PROVIDER=cloudflare、MAIL_FROM=notifications@phosssuki.edu.kg，以及 EMAIL send_email 绑定，绑定仅允许该发件地址。保留 MAIL_ENABLED=false，直至真实投递验收获授权。
- 创建仅作用于目标账号、具有 **Email Routing Addresses Write** 权限的 API Token。此权限也允许读取目标地址。将它保存为 Worker Secret **CF_EMAIL_API_TOKEN**；不要发到聊天或写进 Git。CF_EMAIL_ACCOUNT_ID 必须与绑定所属账号一致。
- PASSKEY_ORIGIN 必须是正式站的 HTTPS origin，同时用于生成确认链接。它不是发信域名，网站可以继续使用 workers.dev。
- 增量应用 0007_email_verification.sql，保留用户、Passkey 和业务记录；随后在获授权的发布中启用 MAIL_ENABLED=true。不要使用 remote=true 在本地验收。
- 使用获授权的真实收件邮箱验证 Cloudflare 邮件、本站确认、每日推荐与降价邮件，并观察投递/垃圾箱归类和日志。模拟通过不代表实际投递通过。

项目有 Wrangler 配置，远程操作使用项目内 Wrangler；Secret 写入会产生发布，必须与授权的上线操作一起安排。MAIL_ENABLED=false 同时阻止验证请求、本站确认邮件和两类业务投递。普通保存邮箱和查看网页仍可用。

## 实现与限制

- cloudflare-email.js：目标地址 REST API 和原生 EMAIL.send 适配器；分页查找已有地址，失败不当作不存在；无转发别名，不建逐人转发规则。
- email-verification.js：D1 目标状态缓存、邮箱粒度租约、用户/账号请求频率控制、显式检查。普通 /api/state 每四秒轮询只读本地状态，不访问控制面 API。
- email-consent.js：每个用户的独立接收确认。共享邮箱不能借用其他用户的接收确认；不主动删除 Cloudflare 目标地址，以免影响账号下其他业务。
- 新表 email_destinations、email_consents、email_verification_limits；状态按 Cloudflare 账号与标准化邮箱隔离。原有 Resend 适配器保留，可显式选择 MAIL_PROVIDER=resend，但这一路不使用 Cloudflare 验证流程。
- mail.js / daily-mail.js：未验证或未确认进入 waiting_verification，不消耗发送尝试次数；按 next_attempt 排序，避免等待验证的旧记录长期挡住其他用户。投递前再次检查远端状态、当前邮箱、提醒开关及租约。过期邮件按原有 24 小时规则跳过。
- Cloudflare EMAIL.send 返回表示服务接受请求，不表示进入收件箱。持久化租约防止并发领取，X-Fare-Scout-Delivery-ID 仅用于诊断，**不是服务端幂等键**。服务接受邮件后、写回 D1 前进程中断，可能重发；不能宣称端到端只投递一次。
- 默认账号目标邮箱上限 200，多个域名共享；免费发给已验证目标地址不计邮件发送日/月额度，但 Workers / D1 仍有自身配额。提额需另行申请，不能承诺无限用户免费使用。暂不自动清理用户换下的远端地址，管理员应监测名额和请求错误。
- 用户每小时最多 10 次申请、120 次检查；整个云账号本应用每小时最多 100 次申请；同一地址首次创建间隔至少一分钟，接收确认邮件至少五分钟。重新申请不保证 Cloudflare 再发验证邮件。

## 本地验证

```
node --test cloudflare/tests/email-verification.test.mjs
npm run test:workers
npm run test:frontend
npm run build
```

所有默认测试使用临时 D1、模拟控制面和模拟发送。新增原生绑定测试也只使用 Miniflare 本地邮件模拟。Wrangler 类型已从当前绑定生成核对，临时文件位于 /private/tmp/fare-scout-worker-env.d.ts；项目仍为 JavaScript，不手写替代的 Env 类型。

## 官方依据（2026-11-02 核对）

- [免费目标地址与验证](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/)
- [原生 Workers 发信 API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)
- [目标地址创建与权限](https://developers.cloudflare.com/api/resources/email_routing/subresources/addresses/methods/create/)
- [目标地址列表与分页](https://developers.cloudflare.com/api/resources/email_routing/subresources/addresses/methods/list/)
- [额度与限制](https://developers.cloudflare.com/email-service/platform/limits/)
- [邮件头与平台生成的 Message-ID](https://developers.cloudflare.com/email-service/reference/headers/)

## 2026-11-02 线上配置核对与 Token 录入

只读核对的 Cloudflare 账号为 7b33669e944449263a4dd3f911ea7dc6，域名 phosssuki.edu.kg，Zone ID 为 e3802494e7596d0a8e1b08f2b6f5d7ca。控制台显示路由已启用、DNS 已锁定、2 条路由规则、3 个目标地址。MX（route1/2/3.mx.cloudflare.net）、SPF（include:_spf.mx.cloudflare.net）与 cf2024-1._domainkey 的 DKIM 已存在，无需重建邮件路由。本次没有修改 DNS 或已有转发。公开查询未发现 _dmarc TXT；尚未添加域名级策略，以免替现有邮件业务做未核实的策略变更。

当前 Wrangler OAuth 仅有部署等权限，缺少域名读取/邮件管理权限；无需为应用扩大这份 OAuth。已在 Cloudflare 控制台准备账号级 Token 草稿 fare-scout-email-destinations，仅包含本账号 Email Routing Addresses Write；没有 DNS、Workers 或 Token 创建权限。Email Service 官方兼容账号级 Token。创建凭据的最终操作交给用户；尚未创建或保存 Token 时，不应声称已接通。

用户创建并复制 Token 后，在本机交互终端执行：

```bash
cd /Users/zhichao.xu-a2085/study/fare-scout
python3 scripts/configure_cloudflare_email.py
```

脚本使用隐藏输入，真实请求仅为读取本账号目标地址，不创建地址、不发邮件、不修改 DNS、不部署；不打印 Token 或目标邮箱列表。访问成功后，以权限 600 新建 Git 忽略的 `.env.email-secrets`，仅含 CF_EMAIL_API_TOKEN，不覆盖旧文件，不读取符号链接，不跟随 API 重定向。`--check` 可只读复核已保存 Token；读权限检查不能单独证明写权限，写权限以 Token 审核摘要为准。

待用户录入后，可以通过项目内 `wrangler versions secret bulk .env.email-secrets --name fare-scout` 把 Secret 暂存到未部署版本，保留 MAIL_ENABLED=false。此命令不会发布本地代码；后续正常部署时必须显式带上 `--secrets-file .env.email-secrets` 或部署已暂存的对应版本，不能假定暂存 Secret 自动进入任意后续部署。不要使用会立即部署的 `wrangler secret put` 来代替暂存步骤。真实投递和开启自动通知另行验收安排。

### Token 已暂存（2026-11-02）

用户已完成 Token 创建与本机录入，`--check` 只读访问成功。项目内 Wrangler 已将 **CF_EMAIL_API_TOKEN** 暂存到版本 **9ec91c1f-e534-4745-b8c9-6a8a1a661ad1**，版本详情确认 Secret 存在且 MAIL_ENABLED=false。暂存前后正式部署均为 **fdbf9996-d72b-4a05-9b86-db6695499814**，100% 流量，线上行为未改变。

该暂存版本是正式旧代码加 Secret，并不包含本地新增 EMAIL 绑定与邮件流程，不能直接当作功能上线版本部署。后续获授权上线应增量应用 0007，并把本地邮件代码、配置与 `--secrets-file .env.email-secrets` 一起发布；发布前保留/核对现有业务记录。尚未执行远程迁移、正式部署或真实邮件验收。

## 正式上线与真实收件验收（2026-11-02）

用户明确授权增量迁移、部署并开启发信，且指定 phosssuki@gmail.com 接收验证和测试邮件。迁移前记录 D1 Time Travel 书签 `00000005-0000001a-00005117-4d3ee631cbd515fba1df071f633f565b`；0007 已应用，只新增三张表。迁移前后用户 3、Passkey 3、会话 3、监控/采样/提醒均 0。后续用户本人登录验收产生新会话，最终会话 5，其余既有记录数量未变。

从隔离快照 `/private/tmp/fare-mail-release-p3ijj0ix` 发布本地邮件代码与配置，携带受保护的 `--secrets-file`，保留同一 D1、正式 Passkey Origin、每分钟 Cron、QUERY_ENABLED=true 与 Workers Free。首次快照漏带 app/data/locations.json，构建在上传前失败；补齐后发布成功。正式版本 **940b46ab-250e-4ab6-bcc5-93c0c50d6fea**，前一个生产版本 **fdbf9996-d72b-4a05-9b86-db6695499814** 可供回退参考。

发布前 35 项 Workers、36 项前端、65 项 Python 检查通过，共 136 项，dry-run 通过。发布后首页、email-settings.js、automation.js、settings.js、daily.js 均与快照 SHA-256 一致；未登录 state、email/verify 都返回 401。版本详情复核 EMAIL、CF_EMAIL_API_TOKEN、MAIL_PROVIDER=cloudflare、MAIL_ENABLED=true。公开接口核对记录 `/private/tmp/fare-email-release-verification.json`。

真实浏览器由用户本人完成通行密钥登录，保存获授权收件邮箱并点击申请。该邮箱此前已是 Cloudflare 已验证目标地址，因此没有再发 Cloudflare 验证邮件，直接通过原生 EMAIL 绑定提交 Fare Scout 接收确认邮件。用户明确反馈已收到并点击链接；网站显示“收件邮箱已验证”，D1 聚合核对 verified_destinations=1、confirmed_recipients=1。浏览器控制台无错误，截图 `/private/tmp/fare-email-release-confirmed.png`。未读取邮件正文、确认令牌或私密 Cookie。

此验收证明真实确认邮件投递及每用户接收确认链路。未创建虚构报价、测试监控或推荐，不强行开启用户的每日推荐；最终 daily_enabled=0。每日推荐/降价业务邮件的实际定时投递、连续多日运行、其他邮箱服务商及新目标地址验证邮件仍待用户启用相应设置后验收。没有执行 commit 或 push。
