# 中文字体

当前中文统一使用 Adobe 官方 Source Han Serif CN VF（思源宋体）的本地子集，权重轴 250–900；资源 `fare-scout-serif-vf.woff2`。
上游：https://github.com/adobe-fonts/source-han-serif/blob/release/Variable/WOFF2/OTF/Subset/SourceHanSerifCN-VF.otf.woff2
许可：同目录 `Source-Han-Serif-LICENSE.txt`（SIL OFL 1.1）。

子集保留 app 中的非 ASCII 文字与 GB2312 一级常用汉字，共 3,909 个 Unicode 映射，1,269,164 字节。
依照上游保留名称条款，修改后的字体内部家族名称为 Fare Scout Serif VF；CSS 使用 Fare Scout Serif。
中文标题、正文、表单与按钮均沿用同一全局字体变量。ASCII 使用 Manrope，英文品牌/风景标题保留 IM Fell English；子集外文字依次回退到系统宋体。

重建（开发环境，不增加运行时依赖）：

```sh
python3 -m venv /tmp/fare-font-tools
/tmp/fare-font-tools/bin/pip install 'fonttools[woff]'
/tmp/fare-font-tools/bin/python scripts/subset_chinese_font.py /path/to/SourceHanSerifCN-VF.otf.woff2 --serif
```

脚本读取当前页面、前端逻辑、地点目录和 Python 文案；增加新文案后可以重建。原始字体无需提交，生成资源随静态页面提供，不依赖外部字体 CDN。

此前使用的思源黑体资源及许可保留供已有路径兼容，当前页面不再加载。使用同一脚本、不带 `--serif` 可以重建旧黑体资源。
