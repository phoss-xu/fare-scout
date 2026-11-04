# 登录旅行伙伴：布贴小熊猫

用户确认 2026-11-04 的简笔布贴角色后，将此前线条角色换为同一形象的透明动作图集。现有风景照片与其他登录背景设计稿均未改动。

## 实现与素材

- `app/static/assets/mascot/red-panda-approved.png`：用户确认的静态角色稿，保留原图。
- `app/static/assets/mascot/red-panda-poses.png`：内置 image_gen 基于确认稿生成的 RGBA 动作图集，1774 × 887，4 列 × 2 行。透明边缘已在实际页面检查；不是旧 SVG 改色。
- `app/static/auth-red-panda.js`：舞台结构；图集由 `auth-motion.css` 引用。
- `app/static/auth-motion.css`：图帧选择、背包上肩、转身、拉箱准备、两帧步态配合身体起伏、等待核对登机牌、失败检查与离场。所有 UI 文字和表面继续读取全局主题、字体。
- `app/static/auth-motion.js`：沿用既有输入与认证生命周期，未改变接口；`auth.js` 和本地通行密钥入口继续调用该生命周期。
- `app/server.py`：加入两张本地 PNG 的静态资源入口。

图集顺序如下，位置由百分比指定，兼容奇数像素宽度：

| 行 | 第 1 列 | 第 2 列 | 第 3 列 | 第 4 列 |
| --- | --- | --- | --- | --- |
| 上 | 拿地图，背包放在身边 | 背包上肩 | 背过身保护输入隐私 | 拿好箱杆 |
| 下 | 步态 A | 步态 B | 核对登机牌 | 疑惑检查 |

首版使用姿势切换和 CSS 动作，不是骨骼动画。行走为两张步态交替，配合身体起伏及从左至右移动；不会让等待中的角色不断重走。开启减少动态效果时显示静态姿势并跳过转场等待。

## 预览和验收

隔离服务：http://127.0.0.1:8896/auth-motion-preview.html 。点击「播放完整动画」可选择正常、等待 5 秒或失败情境；没有认证请求。实际应用入口 http://localhost:8896/ 使用临时数据库 `/tmp/fare-auth-motion-preview.db`，不运行查价及通知任务。

完整前端 90 项通过（含动画生命周期与全局字体检查），模块语法、Python 编译、git diff --check 通过。实际浏览器已查看地图、背包、背身、拉箱、行走、登机牌等待及失败姿势；临时账号先失败后成功登录工作台。Chrome 检查 390px 和 320px，页面没有横向溢出；320px 操作注册/登录模式切换正常，未创建账号。预览页 error 日志为空。

截图：`/tmp/fare-patch-panda-desktop.png`、`/tmp/fare-patch-panda-waiting.png`、`/tmp/fare-patch-panda-mobile.png`。未现场验证真实手机软键盘、真实设备通行密钥或系统减少动态效果设置；减少动态效果生命周期已有单元测试覆盖。未发起实时查价、未发送通知、未 commit、push 或部署。

## 生成记录

工具：内置 image_gen；编辑参考为已确认的角色稿，`transparent_background=true`。来源原件保留在 Codex generated_images；项目引用的两张图片已复制到上列工作区路径。

最终提示词（原文）：

> Production game sprite sheet / animation pose atlas for the EXACT approved red panda patch mascot in the reference image. Preserve that character's identity faithfully: giant round orange head, little dark round eyes, two cream oval brows, broad cream oval muzzle, curved cream cheek stripes, round dark ears with cream insides, very small cocoa-brown stubby body and legs, short thick orange tail with three dark bands, olive-green small backpack. Same adorable minimal flat embroidered felt-appliqué texture, same rounded shapes and proportions. NOT the realistic furry red panda, NOT a new design. TRANSPARENT BACKGROUND with actual alpha, no shadows or backdrop. Layout is STRICT FOUR COLUMNS by TWO ROWS equal-size square cells, total landscape aspect ratio 2:1. Exactly EIGHT separate full-body poses, each contained entirely in its own cell, no overlap across cells. Same consistent character size throughout: character including ears and feet fits within central 80 percent of each cell, feet at 90 percent cell height, head centered at x=50 percent of each cell. Leave transparent padding around each sprite. No text, no numbers, no labels, no grids, no borders. Pose order, left to right top row then bottom row: (1) IDLE front view, holding a small cream folded travel map with both paws at chest, backpack NOT worn, a small olive backpack sits on ground beside left foot; (2) PACKED front view matching reference, backpack now worn on back with visible green strap, left paw holds strap, right paw relaxed, friendly tiny expression; (3) PRIVACY turns head and upper body away toward left showing back of round head and worn backpack, cute white cheek just visible, no face looking at viewer, short tail visible; (4) READY front three-quarter facing slightly right, wearing backpack, right paw grips extended handle of small rounded butter-yellow wheeled suitcase at right, short legs planted; (5) WALK A same character wearing pack and pulling same suitcase at right, three-quarter facing RIGHT, left stubby foot stepping forward and right foot behind, tail slightly lifted, hand connected to handle; (6) WALK B same angle as WALK A, same head size and same suitcase alignment, opposite right foot forward / left foot behind; (7) WAIT front three-quarter right wearing pack, suitcase at right, holding small cream boarding pass close to chest and glancing down, gentle patient expression; (8) RETRY front view wearing pack, suitcase at right, one paw touches cheek, head tilted 8 degrees, puzzled but sweet expression, no tears. All eight heads identical large round shape and facial identity, all eight sizes equal, coherent silhouettes, each is an independent cutout. Plain clean genuine transparency everywhere outside sprite silhouettes, no cream rectangles. High quality clean faithful sprite atlas.
