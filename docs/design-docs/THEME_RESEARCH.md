# 设置侧边栏与颜色主题调研

日期：2026-11-02。范围：研究可用 skill、潘通资料与适合 Fare Scout 的配色方向。本轮未安装第三方 skill，未修改页面或运行时设置。

## 结论

推荐参考 Anthropic Theme Factory 的配色组织方式，搭配网页的语义颜色和状态色阶，保留现有古书字体与静态实拍。潘通适合作为色彩和谐与气氛参考，不能把几张色卡直接当成完整的交互组件主题。

对这个结论的把握较高：两个 skill 的原始 SKILL.md、Radix 和 W3C 文档可直接阅读；潘通官方帮助中心可读，年度配色文章正文返回 403，具体官方色号/HEX 对应未核实。

## 找到的 skill

### Theme Factory — Anthropic 官方技能仓库

原始文件：https://github.com/anthropics/skills/blob/main/skills/theme-factory/SKILL.md

包含 10 套预设主题，以及颜色 HEX、标题/正文字体组合；可作用于幻灯片、文档和 HTML 等产物，也支持自定义主题。与本轮关系最直接的示例：

- Forest Canopy：深绿、鼠尾草、橄榄、象牙色。https://raw.githubusercontent.com/anthropics/skills/main/skills/theme-factory/themes/forest-canopy.md
- Desert Rose：灰玫瑰、陶土、沙色、深酒红。https://raw.githubusercontent.com/anthropics/skills/main/skills/theme-factory/themes/desert-rose.md
- Ocean Depths：深海军蓝、青绿、海沫、奶油色。https://raw.githubusercontent.com/anthropics/skills/main/skills/theme-factory/themes/ocean-depths.md
- Botanical Garden：蕨绿、金盏花、陶土、奶油色，适合提取少量活泼强调色。https://raw.githubusercontent.com/anthropics/skills/main/skills/theme-factory/themes/botanical-garden.md

适用：挑选成套气氛、形成主题目录。局限：主要围绕产物/演示主题，四个颜色并没有穷尽网页的输入框、焦点、悬停、选中、错误等状态；不能直接照搬字体替换用户已经喜欢的 IM Fell English。

### UI UX Pro Max — 社区技能

维护者仓库：https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

原始技能：https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md

更广泛地覆盖配色、排版、设计系统、表单、键盘、响应式和可访问性；可作为实现和复核参考。它的查询工具返回的是建议，最终仍需根据本站布局和用户实际反馈判断。本轮未运行其脚本、未安装 CLI，也未把完整系统生成流程引入项目。

取舍：本次只做主题和设置，不需要借它重做整体布局或引入新框架。

## 潘通查到了什么

官方帮助中心确认 Pantone Connect 的颜色数据页支持加入 palettes、查看 SHADES、HARMONIES、CROSS REFERENCE：
https://support.pantone.com/en/what-is-scan-guide-in-pantone-connect

官方年度色配色文章的检索摘要提供了包括 Comfort Zone、Atmospheric、Powdered Pastels 在内的系列线索，但本轮直接打开正文返回 403：
https://www.pantone.com/uk/en-gb/articles/color-of-the-year/color-of-the-year-2026-color-palettes

因此本轮不宣称已验证这些官方系列的完整色卡或 HEX 数值；后面的候选属于原创网页色板，不标为官方 Pantone 配方。检索 GitHub 等公开来源未找到能够确认由 Pantone 官方发布、面向任意网页主题的通用 SKILL.md；这不是对全网不存在此技能的断言。

## 适合本站的六套网页草案

完整角色色值与计算结果见 theme-candidates.json。均为本轮原创/调整的 RGB 网页草案，不是 Pantone 官方色号转换。

| 主题 | 页面底色 | 主要文字 | 主操作 | 气氛与用途 |
| --- | --- | --- | --- | --- |
| 旧书纸 | #F4F2E9 | #293D31 | #254EDD | 保留当前暖纸与蓝色搜索按钮，默认候选 |
| 苔藓庭院 | #EEF1E6 | #2D4635 | #41664B | 草木绿，偏自然与纸本 |
| 海盐雾蓝 | #EFF4F6 | #273D4B | #376A81 | 清淡蓝灰，更冷静清爽 |
| 玫瑰沙 | #F7EFED | #573C43 | #875460 | 灰粉、沙色、深玫瑰，柔和但不甜腻 |
| 可可燕麦 | #F3EDE5 | #4D3C32 | #785744 | 奶油、燕麦、咖啡，暖色与旧书字体相配 |
| 松林夜色 | #1F2926 | #E5E8DC | #B7CFB3 | 深绿灰底的暗色备选，避免整页纯黑 |

用 WCAG 相对亮度公式计算以上草案的主要文字/页面、次要文字/页面、主要文字/表面、次要文字/表面和按钮文字/按钮共 30 组色对，最低约 4.63:1。这里只是选定色对的静态计算，不代表已经通过完整页面的 WCAG 验收；照片叠字、透明层、禁用状态、焦点和错误提示仍需实际验证。

W3C 普通文字最低 4.5:1，大字最低 3:1：
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Radix 的色阶文档按背景、控件、状态、边界、实心底、文字划分角色，适合作为完整主题落地的参考：
https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale

## 设置侧边栏建议（待实现）

- 桌面从右侧打开，约 340–380px；手机使用全宽抽屉。打开后就地预览，关闭回到搜索，不跳转页面。
- 第一组为外观：六张小主题卡，包含真实背景/文字/按钮配色预览；选中状态有文字或勾选，不能只凭颜色辨认。保持现有古书字体。
- 第二组为风景：按小时、按天、固定当前；这是风景展示偏好，与航班目的地筛选独立。
- 保存主题选择并提供恢复默认；主题与自动风景独立保存，换风景不突然改变页面主题。保持静态图片。
- 邮件账号、查价任务和后台密钥不混入这个外观抽屉。

## 实现前需要解决的真实工程问题

当前页面除了 --paper、--ink、--green 等变量，还有 landscape.css、search-panels.css 中直接写入的底色、按钮色和图片渐隐色。只替换根变量会出现半套主题；应先集中定义页面、表面、正文、次要文字、边界、主按钮、按钮文字、柔和高亮、焦点和状态色，再逐处替换硬编码。

古书字体保持独立，不随主题更换。暖纸/浅色/暗色都要检查原生日期控件、表单展开、侧栏焦点、错误提示和摄影叠字。无需先购买 Pantone Connect 或引入外部运行时调色服务。
