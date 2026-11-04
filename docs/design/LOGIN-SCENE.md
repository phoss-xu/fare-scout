# 登录背景：出发之前

首版为独立设计预览，尚未替换正式登录界面。预览入口为 `app/static/login-scene.html`，静态服务根目录为 `app/static`。本次启动地址：http://127.0.0.1:8892/login-scene.html 。可重新运行 `python3 -m http.server 8892 --bind 127.0.0.1 --directory app/static`。

## 资产与构图

使用内置 image_gen 生成，三张 PNG 均为 1672 × 941。路径：`app/static/assets/login-scene/` 下的 `golden.png`、`day.png`、`night.png`。画面为虚构海湾与机场组合，不能作为真实目的地照片或航班信息使用。

镜头从房间后方望向窗外，背影、木桌、电脑、地图、旅行笔记、咖啡、耳机、书籍、绿植和行李构成近景。海湾、岛山和远处机场构成视觉重心。白天与夜景以落日图为编辑目标，保留机位与摆放，生成光照变体。生成式编辑可能留下细微纹理差异，当前预览用 2.8 秒交叉淡化处理，未做像素配准。

## 时间与动效

`login-scene.js` 读取浏览器 IANA 时区；无效或不可读时按 UTC+8 计算北京时间。每 30 秒及重新回到页面时更新。时段：05–07 日出、07–10 清晨、10–14 正午、14–17 下午、17–19 落日、19–21 傍晚、21–01 深夜、01–05 凌晨。按本地钟点分段，不是基于地理位置计算天文日出日落。

八种状态由三张基础图与调色、混合产生，尚非八张独立生成图。手机预览保留完整横幅构图，正式登录布局尚未接入。UI 复用 `style.css` 的全局字体与 `themes.css`，场景光照独立于 UI 主题，没有重定义全局主题变量。

飞机为独立小尺寸 SVG 剪影，在窗户天空区域裁切。起飞向左上移动，降落向右下缩小并在远处机场地平线消隐；39 秒和 47 秒循环均留有空档。支持暂停和系统减少动态效果设置。这是艺术动效，非实时航迹。

## 主图完整提示词

```text
Use case: photorealistic-natural. Asset type: cinematic photographic background for Fare Scout travel sign-in, landscape 16:9, very high detail.
Create a premium realistic architectural lifestyle photograph, seen from inside a lived-in quiet apartment looking past ONE adult traveler sitting with their BACK to camera at a walnut desk toward an enormous picture window. Reference attached manga ONLY for camera arrangement (back of person, desk, expansive window), absolutely NOT its illustration style or dense obstructing buildings.
Camera is several meters behind the desk, eye level, wide 28mm lens, sophisticated asymmetrical composition, person lower left of center and relatively small, desk across bottom third. Window glass opening is a clean rectangle spanning x=22% to 94% and y=9% to 67% of frame, unobstructed broad sky. Window frames straight and fine, no grids through sky. Room foreground fills lower third and narrow sides.
Outside is the PRIMARY subject: breathtaking believable coastal bay, layered green island mountains, distant coastal city and a subtle airport peninsula near the far-right horizon, shimmering ocean, atmospheric depth. Sky is expansive, no airplanes anywhere (airplanes will be animated separately).
Person has short dark hair, neutral linen shirt, sits relaxed gazing outdoors. Elegant but genuinely inhabited room, not a showroom: travel notebook with unreadable tiny handwriting, folded paper map, ceramic coffee cup, laptop with abstract code-like screen and no legible text, a small plant, a few worn books, headphones, canvas backpack and compact carry-on by desk. Organic tactile details, balanced rather than cluttered. No inferred personal identity.
Lighting: late-afternoon golden hour, luminous apricot sun from left outside, blue-green sea, soft warm sunlight across walnut, linen and plaster, gentle shadow, cinematic dynamic range, realistic natural photography, subtle film grain, refined editorial travel magazine composition, emotionally inviting and full of wanderlust. Preserve a useful quiet darker wall area far left, while window is focus. No UI, no text overlay, no watermark, no logos, no stylization, no illustration, no surreal architecture, no giant aircraft.
```

## 光照变体提示词

白天：Use case: lighting-weather. Edit this exact photograph into clear late morning / solar noon daylight. Change ONLY light, sky time, atmospheric color and lit illumination. Absolute invariants: same camera, exact framing, identical person pose silhouette and face hidden, all architecture window frames desk edges mountains coastline airport and EACH object and plants in the EXACT same pixel locations. Keep exact 16:9 dimensions. Remove sunset sun and orange sunset clouds; sun is outside upper frame, luminous natural pale blue sky with delicate wispy clouds, teal blue sea, bright lively green islands. Room is softly lit by bright neutral natural daylight, no artificial lamp glow. Real architectural photography, realistic rich detail. No text, aircraft, UI or watermark. This is a time-variant frame for seamless crossfading with original, so do not redesign or move anything.

夜间：Use case: lighting-weather. Edit this EXACT photograph to deep night. Change ONLY sky lighting and illumination, absolute invariants same camera exact framing identical person pose silhouette hidden face all window frames desk edges mountains coastline airport each object and plant must remain in exactly same pixel positions. Keep exact 16:9 dimensions. Outside deep indigo night sky with a few subtle real stars, no sunset sun, dark blue sea with faint city light reflections, gentle distant coastal city and airport runway lights. Inside intimate warm desk lamp on far left now casts an amber pool over books desk coffee journal, laptop softly glows, person and backpack silhouette softly readable with blue rim light from window. Realistic long exposure architectural night photography, carefully detailed shadows not pitch black, premium atmospheric cinematic real photograph, travel anticipation. No aircraft, no legible text, no UI, no watermark. Do NOT redesign anything: image is a time variant for a seamless crossfade.
