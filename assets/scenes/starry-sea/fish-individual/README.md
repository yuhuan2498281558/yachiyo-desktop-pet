# 星降之海独立鱼素材

这组素材用于把原先的整群鱼拆成可独立错位、可反向游动的透明精灵。文件名中的 `left` / `right` 表示鱼头朝向和建议的运动方向；尾部的星屑粒子均留在游动后方。

| 素材 | 方向 | 用途 | PNG 尺寸 |
| --- | --- | --- | --- |
| `fish-large-left` / `fish-large-right` | 左 / 右 | 前景主鱼 | 1225×564 / 1216×595 |
| `fish-medium-left` / `fish-medium-right` | 左 / 右 | 中景鱼 | 1228×625 / 1228×577 |
| `fish-small-left` / `fish-small-right` | 左 / 右 | 远景小鱼 | 1021×452 / 1067×453 |

每个 PNG 都是 RGBA；WebP 为 lossless 版本。素材先由内置 imagegen 在纯 `#00ff00` 色键上生成，再使用官方 `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` 去除背景，最后按 alpha 边界裁剪并保留 24px 边缘缓冲。

## 提示词约束

六个变体都沿用同一套约束：单条鱼、侧面轮廓、星海演唱会的青蓝紫半透明材质、无场景/文字/水印/阴影；分别明确要求鱼头朝左或朝右，且尾部粒子只向相反方向拖曳。体量变体为 `large`（鲸形灵鱼）、`medium`（锦鲤形灵鱼）和 `small`（敏捷小鱼），避免多个鱼群重新绑定成一个呆板的大图。

## QA

`tmp/fish-assets-v2/qa-contact-dark.png` 是六个方向的深色背景对照图；`tmp/fish-assets-v2` 内还有色键原图、裁剪前 PNG、裁剪后 PNG/WebP 及 alpha 统计。最终素材的可见像素中绿色污染比例为 0，alpha 不透明像素占比约 92.4%–97.8%。
