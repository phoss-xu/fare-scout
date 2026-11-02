# 搜特价 · 动态风景与渐进展开

> 此文记录前一轮实现。首屏风景已由真实摄影图鉴替代，当前说明见 [TRAVEL_ATLAS.md](TRAVEL_ATLAS.md)。

2026-11-02，替代上一轮同时展开所有输入项的彩色表单布局。

## 交互与视觉

- 初始只展示出发地、日期与目的地摘要。出发地用大字号横线入口，日期用带月日章的浅黄票券，目的地用浅绿胶囊，主搜索操作用蓝色长圆按钮。
- 每次展开一个地点/日期编辑器；手机内联展示，桌面使用浮层。停留晚数、人数、中转、预算、时长及出发星期放入可展开的旅行偏好。已选条件会回填摘要，跨年日期标注两端年份。
- 首次搜索前收起结果空状态和来源说明；发起搜索后展示原有结果、错误和数据边界。未变更搜索参数的含义或数据源。
- 风景为 AI 生成静态底图，配合 32 秒往返运镜和 24 秒光照层变化，营造动态壁纸感；不是实拍视频，也不是实时天气。图片约 470 KB，使用原生 CSS，无新前端依赖。
- 背景有暂停/播放入口。系统减少动态效果偏好下使用静态画面并隐藏播放入口。面板展开、首屏到达与按钮反馈也使用轻量过渡。

## 代码与资源

- `app/static/journey.js`：摘要同步、编辑器展开与背景暂停。
- `app/static/search-panels.css`：风景、差异化控件及响应式布局，替代上一轮分块样式。
- `app/static/deals.js`：接入渐进式控件；地点选择和快捷日期变动后更新摘要。
- `app/static/index.html`：使用原生 details/summary 保留键盘与无脚本展开能力。
- `app/static/assets/coast-dawn.jpg`：内置 image_gen 生成的项目专用背景，原图保存在 Codex generated_images，项目使用 JPEG 导出。
- `app/server.py`：本地资源路由，Workers 继续使用静态资源目录。

## 素材生成记录

工具：内置 `image_gen.imagegen`，无参考图，非 CLI。生成后使用系统 sips 导出 JPEG。

原始输出：`/Users/zhichao.xu-a2085/.codex/generated_images/01a19b25-c42f-73e0-a902-e298d7104882/exec-026f9730-83a3-4f7b-8637-a27264b36ffe.png`。

最终生成提示词：

> Use case: photorealistic-natural. Asset type: wide travel website living-wallpaper background, landscape 16:9. Create a cinematic aerial photograph of a serene blue-green ocean curving around a lush forested mountainous island, pale apricot sunrise, distant layered misty peaks, gentle white surf, fine atmospheric haze. Natural and luxurious travel editorial photography, immersive calm, realistic detailed textures. Composition: coastline sweeps from bottom right toward distant center, open dark teal water across left and lower half provides quiet area for white interface text, luminous distant sky across top quarter. No buildings in foreground, no people, no text, no logos, no UI, no watermark. This will slowly pan in a website like a desktop dynamic wallpaper.

## 验收边界

13 项前端回归、7 项 HTTP 认证回归、JS/Python 语法及 diff 空白检查通过。实际 Chrome 验收桌面、390px 和 320px 无横向溢出；检查日期快捷选/假期回填、跨年摘要、目的地回填、滑块键盘操作、展开筛选、背景暂停及收起必填日期为空时自动展开。390×844 手机初始页面可见主搜索按钮。减少动态效果使用媒体查询实现，本轮未改变操作系统设置进行现场切换。

服务：`FARE_SCOUT_DB=/tmp/fare-scout-colors-qa.db python3 -m app.server --port 8766`。本次未发送真实查价、未创建监控、未发送通知；未提交、推送或部署。
