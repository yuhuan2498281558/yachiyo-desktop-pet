# 环境与操作文档

## 技术栈与版本

- Windows Electron 桌面应用，CommonJS + 原生 HTML/CSS/JavaScript。
- 项目版本：0.3.1。
- `electron`: 43.2.0；`electron-builder`: 26.0.12。
- Node.js 要求：20+；2026-08-23 本机验证为 Node v24.19.0、npm 11.17.0。
- 测试框架：Node 内置 `node:test`。

## 环境前置条件

- Windows 10/11。
- Node.js 20+ 与 npm。
- 构建和版本管理需要 Git；GitHub 同步使用已授权的 GitHub CLI 或标准 Git 凭据。
- 源码根目录：`D:\daoju\dv\yachiyo-desktop-pet`。

## 安装与初始化

```powershell
Set-Location -LiteralPath 'D:\daoju\dv\yachiyo-desktop-pet'
npm ci
```

首次无锁文件兼容需求时也可运行 `npm install`；常规复现优先 `npm ci`。

## 本地运行

```powershell
Set-Location -LiteralPath 'D:\daoju\dv\yachiyo-desktop-pet'
npm start
```

- 当前日常程序：`D:\桌宠\程序\八千代与辉夜桌宠\八千代与辉夜桌宠.exe`。
- 当前快捷方式：`D:\桌面\八千代与辉夜桌宠.lnk`，目标应指向上述解包程序。
- 用户数据实际保存于 `D:\桌宠\资料\用户数据\yachiyo-desktop-pet`；应用仍通过 `%APPDATA%\yachiyo-desktop-pet` 兼容入口访问。
- 本地 Live2D 工作区：`D:\桌宠\资料\Live2D工程\八千代`；v0.1 规格与参考索引位于其 `00-规格与索引` 目录。原片、画集、参考帧、分层稿、Cubism 工程和运行时模型素材仅保存在该本地工作流中，不提交到 Git。

## 测试与检查

```powershell
Set-Location -LiteralPath 'D:\daoju\dv\yachiyo-desktop-pet'
npm test
npm run check
```

当前测试基线为 21 项通过，覆盖 Codex 状态分类、台词去重、视线方向、偏好持久化和诊断日志。`npm run check` 检查全部 JavaScript/CJS 源文件，含 `src/preferences.cjs` 与 `src/diagnostics.cjs`。涉及窗口、托盘、拖动、动画或场景时仍需在 Windows 上手工验证。

诊断日志写入 `%APPDATA%\yachiyo-desktop-pet\diagnostics.jsonl`（本机经目录联接落在 D 盘用户数据目录），只记录 Codex 生命周期、形态、动画编排和配置错误；不包含会话正文，也不会上传。文件默认上限 256 KiB，超限后截断为尾部。

GitHub Actions 工作流位于 `.github/workflows/ci.yml`：pull request 运行依赖安装、测试和语法检查；推送 `main` 或手动触发时，还会运行 unpacked 最小打包检查。

## 构建与发布

```powershell
# 默认安全构建：生成 release\win-unpacked
npm run build

# 生成可选择安装目录的 NSIS 安装包
npm run dist

# 仅在明确需要时生成 portable 单文件包
npm run build:portable
```

- 输出目录：`release/`；该目录以及其他 `release*/` 不纳入 Git。
- portable 包会在运行时向 `%TEMP%` 解压完整 Electron 程序，清理失败时会占用 C 盘；日常使用优先 NSIS 安装版或 `win-unpacked`。
- 当前可执行文件未启用代码签名，`package.json` 中 `signAndEditExecutable` 为 `false`。

## Git 与 GitHub 上传

- 私有远端：`https://github.com/yuhuan2498281558/yachiyo-desktop-pet.git`，远端名 `origin`，默认分支 `main`。
- 本机 GitHub CLI：`D:\工具\GitHubCLI\bin\gh.exe`；仅记录工具路径，不记录认证令牌。
- 常规上传使用已配置的 HTTPS Git 凭据：

```powershell
Set-Location -LiteralPath 'D:\daoju\dv\yachiyo-desktop-pet'
git status --short --branch
git add -- <本次确认要提交的文件>
git diff --cached
git commit -m '<类型>: <简短说明>'
git push origin main
```

- 推送后使用以下命令确认远端和 CI；如果 CLI 需要重新登录，先运行 `& 'D:\工具\GitHubCLI\bin\gh.exe' auth login`：

```powershell
git status --short --branch
& 'D:\工具\GitHubCLI\bin\gh.exe' auth status
& 'D:\工具\GitHubCLI\bin\gh.exe' run list --repo 'yuhuan2498281558/yachiyo-desktop-pet' --limit 5
```

## 已知环境问题

- portable 包曾产生约 369 MB 的单次临时解压目录；不要把 portable 可执行文件作为日常快捷方式目标。
- `release/`、`tmp/` 和 `node_modules/` 体积较大，均由 `.gitignore` 排除；清理前应确认没有运行中的桌宠或构建任务。
- 应用数据入口依赖目录联接；迁移磁盘或重装系统后需要重新核对 `%APPDATA%` 入口与 D 盘目标。
- 角色与作品相关素材仅适合个人学习和桌面展示，公开或商业发布存在授权限制。
