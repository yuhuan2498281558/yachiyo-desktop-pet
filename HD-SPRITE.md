# 八千代高清待机制作记录

2026-09-07，本地个人预览。不是官方原画、Cubism 模型或完整动作包；未推送到 GitHub。

## 当前：v0.3.9 / 小步轻跑

- 用户反馈 v004 脚步太大、不优雅；内置 imagegen 编辑原侧视四格，收小前后步幅、降低抬脚/抬膝、直立躯干并收敛衣发摆动。保留侧脸、服饰、玩偶和完整侧向，不是缩窄整张旧图。
- 本地原稿、精确提示词及左右动画预览：`D:\桌宠\资料\Sprite高清重绘\八千代小步轻跑-v005`。奶油底通过用户已授权的本地透明流程提取；`prepare-side-run.py --style gentle-v5` 共用 1.3× 缩放、`(450,185)` 眼锚点，没有矩形头部拼贴。
- 运行素材 `yachiyo-hd-run-gentle-v5.webp`，四帧 768×832，保持 280 ms 步频和现有拖动触发。旧宽步 v004 不再引用/打包，原待机和 gaze 逐字节不变。40 项单元测试、语法检查和打包版 18 组实际回归通过，报告 `tmp/electron-smoke-1788715139342/report.json`。左右截图已目视检查，已备份并更新日常程序；未推送 Git。

## 上轮：v0.3.8 / 官方侧视参考的完整侧身奔跑

- 用户指出正面跑步帧不符合要求，并提供官方设定集。重新渲染 PDF 第 21 页（书内 19 页），取成人造型全身侧视和顶部侧脸参考；确认后脑向后颈收束、发环前后遮挡、窄侧躯干、长后摆及带跟鞋。只作为绘图参考，书页不进入运行包或 Git。
- 使用内置 imagegen，以已确认 v003 母图锁定身份与画风，结合官方侧视画四格右向侧身奔跑。鼻/下巴轮廓、单侧眼睛、肩胯、脚尖均朝右；左向从真正侧视帧镜像，不再使用正面抬腿图。精确提示词见本地 `八千代侧身奔跑-v004/PROMPT.md`。
- `prepare-side-run.py` 在奶油色底上做背景连通提取、飞发间隙处理，保留暖色发丝细节；四帧共用 1.42× 尺度和 `(520,200)` 侧眼锚点。首轮矩形头部拼贴在真实截图中出现肩颈接缝，已移除，保留每帧完整绘图。运行单帧仍 768×832，无损 atlas 3072×832；元数据 `yachiyo-hd-run-side-v4.json` 记录来源与哈希。旧 `yachiyo-hd-run-v3.webp` 保留历史但不再引用/打包。
- 280 ms/帧的拖动动作和原待机/视线行为不变；40 项单元测试、语法检查及最终打包版 18 组实际窗口检查通过，报告 `tmp/electron-smoke-1788714303799/report.json`。左右截图已确认完整侧向、肩颈无拼接缝；已部署日常程序并保留偏好，旧版备份目录后缀 `pre-0.3.8`。未推送 Git。

## 上轮：v0.3.7 / 拖动方向奔跑与减速

用户纠正不是原地按钮跑步。现复用原四帧：右拖正常显示、左拖镜像高清层，280 ms/帧循环，方向反转不重启帧；180 ms 无水平位移或松手回待机。没有重新绘制或覆盖原画；视线跟随保留。下方 v0.3.6 记录仅表示当时的实现，不代表当前触发方式和播放速度。

39 项单元测试、源码与最终打包版各 18 组 Electron 检查通过；最终报告 `tmp/electron-smoke-1788713133262/report.json`。已备份并部署 v0.3.7，未推送 Git。

## 上轮：v0.3.6 / 手动跑步与瞳孔跟随

- 基于已确认母图用内置 imagegen 绘制四格奔跑稿；首稿交替迈腿不足且 Alpha 杂边严重，弃用。第二稿使用奶油色底，再按用户已允许的本地流程抠图；源图及准确提示词在 `D:\桌宠\资料\Sprite高清重绘\八千代动作-v003\PROMPT.md`，没有使用 CLI 或额外付费 API。
- `scripts/prepare-hd-motion.py` 使用同一 1.08× 缩放和头部锚点对齐四帧，锁定顶部 187 像素；保留绘制的衣摆、袖部与交替抬腿。运行 atlas 为 `yachiyo-hd-run-v3.webp`（3072×832）。四帧、每帧 130 ms，手动播放四轮后结束，属于原地跑步展示，不是窗口自动移动。
- `yachiyo-hd-gaze-v3.webp`（1496×680）由原待机眼部图块本地提取虹膜、补眼白、限制眼睑内移动生成；17×17 方向，眼部以外像素与 Alpha 不变，中心方向直接使用原图。母图和三帧待机 atlas 不变；这是轻微瞳孔跟随，不是新 Live2D 转头模型。
- 浏览器解码检查确认奔跑头部无差异、腿与衣摆有变化，视线图块眼部以外像素及 Alpha 差异均为 0。39 项单元测试与源码 18 组 Electron 检查通过，报告 `tmp/electron-smoke-1788712182853/report.json`。哈希与尺寸见 `assets/sprites/yachiyo-hd-motion-v3.json`。
- 经典 Sprite、Live2D、辉夜、变身和演唱会保留原行为；不启用高清自动散步，不让连续点击或拖动触发跑步。本轮未推送 GitHub。
- 最终打包版 18 组检查通过（`tmp/electron-smoke-1788712402465/report.json`），打包内两个新素材哈希核对通过；v0.3.6 已更新日常程序并启动，保留最新偏好，旧版及偏好备份目录后缀为 `pre-0.3.6`。

## 上轮：v0.3.5 / 已确认形象 v003

- 用户已确认 v003 发型修订稿，并要求按此形象重构。母图为本地 `八千代待机-v003/yachiyo-hair-v003.png`，SHA256 `275a7b896953c77cb07d33d5c80de7e34c968577a59402529af117a719fb4008`。脸、服装、比例与发型以该文件为准，不使用绘图工具重新生成身体。
- 内置 imagegen 只绘制半闭眼和闭眼稿；本地 `scripts/prepare-approved-sprite.py` 合成眼部、提取透明轮廓。采用奶油色背景连通区域和已核对的发环/头发间隙种子抠图，不把浅色皮肤、白纸带或白发当作整片背景删除。保留原件，生成稿与单帧保存在 `D:\桌宠\资料\Sprite高清重绘\八千代待机-v003-runtime`。
- 运行素材改为 `assets/sprites/yachiyo-hd-idle-v3.webp`，旁边 JSON 记录母图/atlas 哈希、尺寸和帧差异。新素材 2304×832（三列），每帧 768×832；等比保留长袍全身，角色尺寸 429×780，位置 `(169,28)`。
- Alpha 完全一致；帧间变化只在 `(347,114)-(424,142)` 眼部范围。每帧 426081 个全透明像素；外轮廓去除约 1 像素的奶油底污染并做亚像素抗锯齿。母图以外不因眨眼更换身体。旧 v1 保留本地，但不再引用或打包。
- 菜单为“高清 Sprite（新版八千代）”，偏好值仍是 `sprite-hd`，兼容旧选择。经典 Sprite 和 Live2D 保留；不扩展跑步、跳跃、辉夜、变身或演唱会动作。
- 绘图提示词、Alpha 报告与视觉预览见本地 `八千代待机-v003-runtime` 目录；未提交或推送 GitHub。
- 验收完成：33 项单元测试、语法检查、最终打包版 15 组 Electron 检查通过，报告 `tmp/electron-smoke-1788710918204/report.json`。v0.3.5 已部署至日常程序并选中高清形象；保留原隐藏状态及其他偏好。旧版及偏好备份在 `D:\桌宠\程序\八千代与辉夜桌宠-backup-20260907-pre-0.3.5`。

## 历史：v001（美术验收未通过，已停用）

用户反馈 v001“不够还原”；v002 重新按设定集修订脸与服装，v003 进一步按用户要求调整发型并获认可。以下 v001 数值和提示词仅保留为历史记录，不代表当前运行素材。

## 素材与实现

- 使用内置 imagegen（非 CLI/API）绘制母图、半闭眼与闭眼稿。原设定集 PDF 第 21 页提供服装正侧背、发环及配色参考；画集用于识别面部和玩偶细节，不复制书页到运行包。
- 用户明确允许本地图像处理透明背景、局部合成及动画帧对齐。生成稿实际为 1024×1536 RGB 绿幕；本地 Pillow/numpy 抠图去绿，不能把生成稿宣称为原生透明输出。
- 母图裁切区域 `(73,141)-(945,1383)`，等比缩为 548×780，放在 768×832 画布 `(110,28)`；不拉伸角色。宽高各为旧 192×208 待机帧的四倍，不是直接放大旧图。
- 仅在眼部软蒙版内合成半闭眼/闭眼，所有帧共用母图 Alpha。输出 2304×832、三列、lossless WebP，顺序睁眼/半闭眼/闭眼；其他身体像素不变。
- 单个已解码 atlas 一次载入，无逐帧网络/磁盘请求、透明度过渡或身体变换。一次性计时器驱动 `0→1→2→1→0`：70/100/90 ms 眨眼，间隔 3.2–5 秒；点击冷却 1 秒。隐藏、拖动、形态/场景转换均暂停计时，恢复剩余时间。
- 运行素材：`assets/sprites/yachiyo-hd-idle-v1.webp`。处理脚本：`scripts/prepare-hd-sprite.py`；开发时需 Pillow/numpy，应用本身不依赖 Python。
- 原始生成稿、单帧 PNG、深浅底预览及 `alpha-frame-qa.json` 保存在本机 `D:\桌宠\资料\Sprite高清重绘\八千代待机-v001`。这些本地参考与中间产物不进入 Git；是否公开新角色素材须单独确认。
- 原 Sprite/Live2D 未覆盖，默认偏好仍为 Live2D；菜单显式选择 `sprite-hd`。高清待机不散步、不做拖动动作、不支持高清变身/演唱会；这些场合保留既有 Sprite。辉夜高清组尚未制作。

## 绘图提示词记录（内置工具）

验证：32 项单元测试及语法检查通过；最终打包版 15 组 Electron 检查通过，报告 `tmp/electron-smoke-1788708329724/report.json`。浏览器解码每帧有 369879 个全透明像素，帧间 Alpha 差异及眼部以外的像素差异均为 0。v0.3.4 已更新日常程序，旧版和偏好已备份；保留原 Live2D 选择，右键菜单可启用高清待机。

### 母图（identity-preserve）

输入 1：上一版八千代重绘试稿；输入 2：设定集第 21 页。

Use case: identity-preserve. Edit target image 1: refine this ONE chibi Yachiyo standing idle sprite for a real desktop pet. Image 2 is the clothing and hair accessory accuracy reference (the silver-haired character in navy/teal stage dress, not the other costumes). Preserve the cute face, calm open eyes, front-facing standing pose, long silver hair and lavender inner hair, the pink plush, same drawing style and high-resolution crisp linework. Correct only costume fidelity and proportions: make her slightly more compact approximately 3-head-tall chibi, shorten the legs relative to the head; show natural light skin at exposed knees/thighs rather than opaque white tights; two hanging white strips should be short folded zigzag paper-like ribbons to the sides of the waist/plush area, NOT long straight necktie rectangles over the crotch; belt knots and cords deep purple not gold; footwear teal with small white circular markings and gold soles like the reference, not modern fashion boots with gold V-shaped cuffs. Keep dark navy-purple wide sleeves, red inner cuffs, teal motifs, teal inner skirt and dark purple outer ruffles. Precisely two modest-sized white circular hair loops with their roots visibly attached and short thin gold hairpins. No detached white furry spot on sleeve. Both feet at the same baseline. No extra character, no umbrella, no typography or book borders. Keep full silhouette unclipped with about 7% padding. High-resolution 2D cel-shaded anime character, one full-body frame. IMPORTANT background: use a perfectly flat solid saturated chroma green #00FF00 background throughout all empty space including ring holes, without any pattern, texture, gradient or shadow. No green reflection on character. This is deliberately a green-screen source for local transparent sprite extraction, NOT a checkerboard. Do not paint a checkerboard. Prefer a high resolution portrait image.

### 闭眼（precise-object-edit）

输入：上述睁眼母图。

Use case: precise-object-edit. This is the exact master of a high-resolution desktop pet idle animation. Produce the CLOSED-EYES blink frame. Change ONLY both open eyes into gently closed natural dark curved eyelids with delicate lashes; preserve eyebrows, nose, tiny calm smile, cheek shape, eye positions, skin color and every single other element unchanged. No smiling closed eyes exaggerated arc, no squeezed/winking one eye, both eyes close softly. Keep the exact same canvas dimensions, pixel registration, character scale, silhouette, ring ornaments, hair strands, clothing, pink plush, limbs, feet baseline and solid #00FF00 green-screen background. Do not redraw or move the body, no pose change, no movement, no zoom, no crop, no added text. One full-body image with two naturally closed eyes, nothing else changed. Keep full high-resolution sharp linework. Local composition will take only the eye patches from this frame to guarantee that the final animation body pixels remain identical.

### 半闭眼（precise-object-edit）

输入：上述睁眼母图。

Use case: precise-object-edit. Make the HALF-CLOSED eyes intermediate blink frame of this EXACT desktop pet sprite. Change ONLY the upper eyelids and eye openings: upper lids descend to cover the upper half of both blue-purple irises, leaving the lower half of each iris visible. This is a relaxed blink midpoint, not sleepy eyebrows or smiling crescent eyes. Preserve the eyebrow positions, small smile, skin, bangs and all other pixels as closely as possible. Exact same canvas dimensions, full-body scale and position, head shape and eye centers. Do not move anything: hair loops, strands, clothes, doll, legs, boots and green background stay unchanged. Solid #00FF00 backdrop in every empty area, no gradient, no checkerboard. No crop or zoom, no text. One full-body frame; local processing will copy only the eye regions onto the identical master for stable animation.
