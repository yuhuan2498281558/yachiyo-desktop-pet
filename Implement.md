# 实现说明

> 保存稳定的架构事实和确认过的技术决策；具体代码始终是最终事实来源。

## 架构摘要

- 项目是 Electron 单应用：主进程管理透明窗口、托盘、位置、偏好、散步、视线和 Codex 状态；preload 提供窄 IPC；renderer 负责 Sprite 动画、双形态、场景和交互。
- 当前运行时完全本地，不包含网络请求、模型 Provider、语音、自动更新或远程页面。
- Electron 窗口启用 `contextIsolation` 和 `sandbox`，关闭 `nodeIntegration`；renderer CSP 仅允许 `self`。

## 重要目录与入口

- `package.json`：版本、脚本、Electron Builder 配置和打包文件边界。
- `src/main.cjs`：应用入口；窗口、托盘、偏好、计时器、IPC 和应用生命周期。
- `src/preload.cjs`：向 renderer 暴露移动、拖动、菜单及状态订阅接口。
- `src/codex-activity.cjs`：扫描 `.codex/sessions` 并分类任务生命周期状态。
- `src/gaze.cjs`：全局鼠标坐标到 16 方位视线索引的纯函数。
- `src/renderer/pet.js`：形态/动画/场景/拖动/互动状态控制。
- `src/renderer/dialogue.js`：按角色和情境组织的本地台词池与最近三句去重。
- `assets/`：运行所需角色与场景素材；授权边界见 `ASSET_LICENSE.md`。
- `test/`：Node 内置测试；当前覆盖 Codex 状态分类、台词和视线。
- `build/`：打包图标；`release*/`、`tmp/`、`node_modules/` 为忽略目录。

## 核心数据流

- Codex 状态：每秒扫描近期 JSONL 尾部 → 仅按事件类型判定 working/ready/failed → 主进程生成有效形态状态 → `pet:work-state` IPC → renderer 播放变身或结束动画。
- 视线：主进程读取全局鼠标与桌宠窗口边界 → `gazeDirection` 计算方向 → `pet:gaze` IPC → renderer 选择帧并施加轻微偏移。
- 偏好：托盘/窗口操作修改内存状态 → 250 ms 防抖写入 `app.getPath('userData')/preferences.json` → 启动时与默认值合并并校验枚举项。
- 交互：renderer 捕获点击、双击、拖动和右键 → preload IPC → 主进程移动窗口或弹出菜单；主进程再推送命令与偏好状态。
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

- 使用 Electron 43.2.0 与 electron-builder 26.0.12，Node.js 20+。
- 角色表现采用 Sprite/CSS/Web Animations，不切换到 Live2D 技术栈。
- 主窗口透明、无边框、置顶、不占任务栏；托盘拥有 Windows 生命周期。
- 偏好暂以本地 JSON 保存；已识别直接覆盖写入为待改进点，但尚未修改实现。
- 同时支持 portable 与 NSIS 构建；实际日常部署采用 D 盘解包版以避免 C 盘临时目录增长。
- 项目使用独立私有 GitHub 仓库，生成目录由根 `.gitignore` 排除。
