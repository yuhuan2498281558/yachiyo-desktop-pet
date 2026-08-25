# 实现说明

> 保存稳定的架构事实和确认过的技术决策；具体代码始终是最终事实来源。

## 架构摘要

- 项目是 Electron 单应用：主进程管理透明窗口、托盘、位置、偏好、散步、视线和 Codex 状态；preload 提供窄 IPC；renderer 负责 Sprite 动画、双形态、场景和交互。
- 当前运行时完全本地，不包含网络请求、模型 Provider、语音、自动更新或远程页面。
- Electron 窗口启用 `contextIsolation` 和 `sandbox`，关闭 `nodeIntegration`；renderer CSP 仅允许 `self`。

## 重要目录与入口

- `package.json`：版本、脚本、Electron Builder 配置和打包文件边界。
- `.github/workflows/ci.yml`：Windows CI；测试、语法检查和 unpacked 最小打包验证。
- `src/main.cjs`：应用入口；窗口、托盘、偏好调度、计时器、IPC 和应用生命周期。
- `src/preload.cjs`：向 renderer 暴露移动、拖动、菜单及状态订阅接口。
- `src/preferences.cjs`：偏好默认值、字段校验、进程内写锁，以及临时文件重命名的原子写入。
- `src/diagnostics.cjs`：有大小上限的本地 JSONL 诊断日志；只记录状态事件，不写会话正文。
- `src/codex-activity.cjs`：扫描 `.codex/sessions` 并分类任务生命周期状态。
- `src/gaze.cjs`：全局鼠标坐标到 16 方位视线索引的纯函数。
- `src/renderer/sprite-actions.js`：Sprite 动作队列，支持 append/replace/interrupt；`pet.js` 用它串行化走路、跳跃、招呼和变身。
- `src/renderer/pet.js`：形态/动画/场景/拖动/互动状态控制。
- `src/renderer/dialogue.js`：按角色和情境组织的本地台词池与最近三句去重。
- `assets/`：运行所需角色与场景素材；授权边界见 `ASSET_LICENSE.md`。
- `test/`：Node 内置测试；覆盖 Codex 状态分类、台词、视线、偏好持久化、诊断日志和 Sprite 动作队列。
- `build/`：打包图标；`release*/`、`tmp/`、`node_modules/` 为忽略目录。

## 核心数据流

- Codex 状态：每秒扫描近期 JSONL 尾部 → 仅按事件类型判定 working/ready/failed → 主进程生成有效形态状态 → `pet:work-state` IPC → renderer 播放变身或结束动画。
- 视线：主进程读取全局鼠标与桌宠窗口边界 → `gazeDirection` 计算方向 → `pet:gaze` IPC → renderer 选择帧并施加轻微偏移。
- 偏好：托盘/窗口操作修改内存状态 → `PreferenceStore` 250 ms 防抖 → 校验后经临时文件重命名写入 `app.getPath('userData')/preferences.json` → 启动时加载并规范化已知字段；退出前 `flush()` 立即落盘。
- 诊断：主进程将 Codex 生命周期、形态切换、动画编排和配置错误追加到 `userData/diagnostics.jsonl`；单文件有大小上限，超限时截断为尾部。不记录会话正文，也不上传。
- 交互：renderer 捕获点击、双击、拖动和右键 → preload IPC → 主进程移动窗口或弹出菜单；主进程再推送命令与偏好状态。
- Sprite 动画：`playOnce` 通过队列 `interrupt` 立即取消当前动作；`playLoop` 通过 `replace` 替换循环且不打断未完成的 once；后续 once 可用 `append` 排队。星降之海仍用独立的 `sceneRunToken` 与 Web Animations，不进入 Sprite 队列。
- 场景：托盘选择场景 → 主进程调整固定窗口尺寸并发送场景命令 → renderer 编排背景、角色、鱼群、阶梯和涟漪动画。

## 不变量与兼容性要求

- 保持单实例锁；第二次启动必须召回已运行窗口。
- 保持 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true` 和窄 preload API。
- 自动形态切换必须以 Codex 生命周期事件为准，不使用短时静默超时。
- Codex JSONL 只用于本地事件分类，不得上传正文或自动作为模型上下文。诊断日志同样只写 working/ready/failed 等生命周期状态，不得写入 prompt、response 或会话正文。
- 偏好文件未知、缺失或损坏时应用仍应使用安全默认值启动；后续改造不得破坏现有字段兼容性。
- 日常部署必须从安装/解包目录运行，不能依赖 portable 临时解压目录。
- 代码与角色素材的许可边界必须分离；素材不能因代码采用 MIT 而被视为 MIT。

## 已确认实现决策

- 使用 Electron 43.2.0 与 electron-builder 26.0.12，Node.js 20+。
- 当前已实现的角色表现仍采用 Sprite/CSS/Web Animations。八千代 Live2D 仅进入本地可选试验规划，尚未接入代码；接入时必须保留 Sprite 回退，不在首版重做辉夜和“星降之海”角色动画。
- 八千代 Live2D 规划基线为全身源立绘、默认四分之三身显示、高画质 2×4096/轻量 2×2048 纹理，并先以头部、头发、上半身和粉色玩偶构建最小可动样机。
- 主窗口透明、无边框、置顶、不占任务栏；托盘拥有 Windows 生命周期。
- 偏好以本地 JSON 保存。`src/preferences.cjs` 只保留已知字段，非法枚举/布尔/坐标回退到默认值；损坏或非对象 JSON 使用完整默认值。写入使用进程内 `WriteLock` 串行化，并先写 `preferences.json.tmp` 再 `rename` 替换目标文件。
- 诊断日志为本地 append-only JSONL，默认上限 256 KiB，超限后保留尾部；落在 `app.getPath('userData')`，与偏好文件一起随用户数据目录存放，不进入 Git。preload 不新增诊断 IPC。
- Sprite 片动画由 `SpriteActionQueue` 调度。once 动作（变身、跳跃、招呼）使用 interrupt；循环动作（走路、工作）使用 replace，不会打断正在播放的 once。场景演出保持独立令牌，以免与角色片动画互相取消。
- 默认 `npm run build` 生成 `win-unpacked`，`npm run dist` 生成 NSIS；portable 只能通过 `npm run build:portable` 显式生成。
- GitHub Actions 在 pull request 上运行测试和语法检查，在推送 `main` 或手动触发时追加 unpacked 打包 smoke test。
- 项目使用独立私有 GitHub 仓库，生成目录由根 `.gitignore` 排除。
