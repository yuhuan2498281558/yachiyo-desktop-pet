# 实现说明

> 保存稳定的架构事实和确认过的技术决策；具体代码始终是最终事实来源。

## 架构摘要

- 项目是 Electron 单应用：主进程管理透明窗口、托盘、位置、偏好、散步、视线和 Codex 状态；preload 提供窄 IPC；renderer 负责 Sprite 动画、双形态、场景和交互。
- 当前运行时完全本地，不包含网络请求、模型 Provider、语音、自动更新或远程页面。
- Electron 窗口启用 `contextIsolation` 和 `sandbox`，关闭 `nodeIntegration`；renderer CSP 仅允许 `self`。

## 重要目录与入口

- `package.json`：版本、脚本、Electron Builder 配置和打包文件边界。
- `.github/workflows/ci.yml`：Windows CI；测试、语法检查和 unpacked 最小打包验证。
- `src/main.cjs`：应用入口；窗口、托盘、偏好、计时器、IPC 和应用生命周期。
- `src/preload.cjs`：向 renderer 暴露移动、拖动、菜单及状态订阅接口。
- `src/codex-activity.cjs`：扫描 `.codex/sessions` 并分类任务生命周期状态。
- `src/codex-activity-worker.cjs`：独立线程执行缓存扫描，避免同步文件读取阻塞窗口移动。
- `src/preferences-store.cjs`、`src/diagnostics.cjs`：类型校验、原子偏好持久化和限额诊断日志。
- `src/renderer/behavior.js`：主进程与 renderer 共用散步准入规则，协调拖动延期事件、工作状态去重。
- `src/runtime-smoke.cjs`、`scripts/smoke.cjs`：使用隔离偏好执行真实 Electron 输入、重启及可选长测。
- `src/gaze.cjs`：全局鼠标坐标到 16 方位视线索引的纯函数。
- `src/renderer/pet.js`：形态/动画/场景/拖动/互动状态控制。
- `src/renderer/dialogue.js`：按角色和情境组织的本地台词池与最近三句去重。
- `assets/`：运行所需角色与场景素材；授权边界见 `ASSET_LICENSE.md`。
- `test/`：Node 内置测试；当前覆盖 Codex 状态分类、台词、视线、交互拖动阈值/位移合并与 Live2D 回退/行走状态。
- `build/`：打包图标；`release*/`、`tmp/`、`node_modules/` 为忽略目录。

## 核心数据流

- Codex 状态：worker 每秒扫描近期 JSONL 尾部，按文件大小/修改时间缓存解析结果 → 仅把 working/ready/failed 聚合状态交回主进程 → `pet:work-state` IPC → renderer 去重、拖动期间延后处理 → 播放变身或结束动画。
- 视线：主进程读取全局鼠标与桌宠窗口边界 → `gazeDirection` 计算方向 → `pet:gaze` IPC → renderer 选择帧并施加轻微偏移。
- 偏好：托盘/窗口操作修改内存状态 → `preferences-store.cjs` 校验布尔/枚举/坐标，250 ms 防抖 → 写入同目录临时文件、fsync、rename 原子替换 → 退出前 flush。替换失败保留原文件和待写状态，记录错误码。
- 交互：renderer 捕获点击、双击、拖动和右键；拖动先经过 6 px 死区，并以 32 ms 为窗口合并高频位移；Live2D 手动拖动开始时只生成一次静态 Canvas2D 快照并暂停 Pixi，窗口随后仅平移，松手后恢复 WebGL。位移经 preload IPC 交给主进程；主进程再推送命令与偏好状态。
- 场景：托盘选择场景 → 主进程调整固定窗口尺寸并发送场景命令 → renderer 编排背景、角色、鱼群、阶梯和涟漪动画。

## 不变量与兼容性要求

- 保持单实例锁；第二次启动必须召回已运行窗口。
- 保持 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true` 和窄 preload API。
- 自动形态切换必须以 Codex 生命周期事件为准，不使用短时静默超时。
- Codex JSONL 只用于本地事件分类，不得上传正文或自动作为模型上下文。
- 偏好文件未知、缺失或损坏时应用仍应使用安全默认值启动；后续改造不得破坏现有字段兼容性。
- 日常部署必须从安装/解包目录运行，不能依赖 portable 临时解压目录。
- 代码与角色素材的许可边界必须分离；素材不能因代码采用 MIT 而被视为 MIT。

## 已确认实现决策

- v0.3.9 改用 `yachiyo-hd-run-gentle-v5.webp` 小步侧视稿，替代用户否定的大步 v004。`prepare-side-run.py --style gentle-v5` 使用 1.3× 等比缩放、`(450,185)` 眼锚点、整帧透明提取；不进行局部拉伸或矩形头部拼贴。不改动拖动算法、280 ms 步频、待机和视线素材。v004 与旧正面跑步图均排除打包。
- v0.3.8 使用 `yachiyo-hd-run-side-v4.webp` 替换被用户否定的正面抬腿稿。以官方设定集 PDF 第 21 页（书内 19 页）的侧脸与全身侧视为结构参考，内置 imagegen 画四帧完整右侧视，左向仍镜像真实侧视帧。`prepare-side-run.py` 本地透明处理、统一 1.42× 缩放、侧眼锚点对齐；保留每帧完整绘图，避免矩形头部粘贴在肩颈/发丝处产生接缝。画面宽展源于真正侧身迈腿，而非窗口位移补偿。旧正面跑步 atlas 不再引用或打包，待机和视线素材不变。
- v0.3.7 按用户纠正将高清跑步改为左右拖动驱动，替代 v0.3.6 原地按钮；`updateDrag(deltaX)` 使用全局指针位移，只在真实拖动过死区后进入奔跑，280 ms/帧循环。向左仅镜像高清层，向右恢复，8 px 反向累积抑制手抖；改变方向不重置帧。180 ms 无水平移动、松手/丢捕获/失焦、隐藏/形态/场景切换停止奔跑。窗口仍为 1:1 位移，不接入自动散步计时器。附加 run/gaze atlas 预解码后使用，失败保持高清待机，切换形象可重试。
- 高清视线复用现有 `pet:gaze` IPC 和 `gazeTracking` 偏好，在母图 `(342,110,88,40)` 眼部叠加 17×17 离线生成瞳孔图块（±3/±2 素材像素），120 ms 时间常数、按需约 30 FPS 缓动，静止后停止计时。眨眼和跑步不显示眼层，关闭开关立即居中；身体与脸部其他像素不改，不扩展 IPC 或运行依赖。
- v0.3.4 新增 `sprite-hd` 可选八千代待机渲染器（`hd-sprite.js`），768×832×3 无损透明 atlas，眼部以外像素一致。图片解码完成后才切换显示，单次计时器驱动眨眼、1 秒点击冷却；拖动/隐藏/形态场景转换暂停并保留剩余时间。主进程与 renderer 均禁止高清待机散步，点击不进入经典动作，辉夜/变身/演唱会仍用原 Sprite，恢复后回到高清。失败不覆盖经典回退，切换模式可重试。无新增运行依赖或 IPC。
- v0.3.5 将高清素材更新为用户确认的 v003 母图，运行时使用 `yachiyo-hd-idle-v3.webp` 和可验证哈希的 JSON 记录。旧 v1 不引用、不打包；像素级 Electron 检查只允许眼部范围变化，单元测试防止误用旧稿。透明提取和眼部合成开发脚本为 `prepare-approved-sprite.py`，仅需 Pillow/numpy，不增加运行依赖。
- 使用 Electron 43.2.0 与 electron-builder 26.0.12，Node.js 20+。
- 八千代现已接入可选 Live2D 渲染器：`src/renderer/live2d.js` 负责 Pixi/Cubism 加载、窗口适配、视线参数和表情；`yachiyoRenderer` 偏好由主进程持久化，并通过桌宠/托盘右键菜单切换。
- Live2D 用于八千代待机、点击互动和手动拖动；模型包没有 `.motion3.json` 跑步动作，v0.3.2 在主进程和 renderer 两端禁止八千代 Live2D 自动散步（即使旧偏好开启）。保留已有程序化参数代码供独立模型测试，不作为桌宠自动行为。拖动开始时生成单张 Canvas2D 快照、暂停 Pixi；松手时先完成 WebGL 首帧绘制，再撤掉快照，不依赖固定延迟或透明度渐变。拖动期间工作/偏好事件延期，Sprite 变身暂停；相同工作状态不重播动画。辉夜、变身与场景继续使用 Sprite。加载/上下文失败安全回退，切换 Sprite 再切回 Live2D 可重试，保留原 canvas。
- Live2D 运行库保存在 `src/renderer/vendor/`；`assets/live2d/models/tsukimi-yachiyo/` 的运行包按用户确认的非商业条件纳入 Git 并随源码打包，干净 checkout 也包含该模型。模型被移除或加载失败时仍回退到 Sprite；其他本地实验模型继续忽略。
- 八千代 Live2D 规划基线为全身源立绘、默认四分之三身显示、高画质 2×4096/轻量 2×2048 纹理，并先以头部、头发、上半身和粉色玩偶构建最小可动样机。
- 主窗口透明、无边框、置顶、不占任务栏；托盘拥有 Windows 生命周期。
- `diagnostics.cjs` 记录状态与错误码，白名单过滤字段，当前及上一份日志各最多 256 KiB，不记录会话正文。写入失败不阻断程序。
- 日常用户数据 C 盘入口是指向 D 盘的 junction。主进程在创建日志子目录和访问偏好前解析真实目录；新用户目录不存在时保留原路径并按需创建。
- Live2D 关闭模型默认的 shared ticker，由应用 ticker 驱动；标准最高 60 FPS / 2× 渲染，省电最高 30 FPS / 1× 渲染，实际分辨率不超过屏幕比例。切换仅 resize，不重载模型；拖动时延期更新，松手重建匹配尺寸的快照缓冲。隐藏时停止 ticker，恢复步长最多 50 ms。
- Live2D 视线目标按 160 ms 时间常数缓动，支持 gentle（轻微转头）/eyes-only（仅眼睛），两档帧率的响应一致。点击轮换 smile/shy/bsmile，900 ms 冷却防止重复动作；允许 hello 升级为双击 hop。拖动期间中性表情恢复延期，表情 Promise 失败被捕获。
- 托盘“关于与诊断”展示版本与模型状态，包含渲染进程退出及资源回退。打开固定程序/日志路径仅在主进程执行，不扩展 preload 权限。
- 默认 `npm run build` 生成 `win-unpacked`，`npm run dist` 生成 NSIS；portable 只能通过 `npm run build:portable` 显式生成。
- GitHub Actions 在 pull request 上运行测试和语法检查，在推送 `main` 或手动触发时追加 unpacked 打包 smoke test。
- 项目使用独立公开 GitHub 仓库，生成目录由根 `.gitignore` 排除。
