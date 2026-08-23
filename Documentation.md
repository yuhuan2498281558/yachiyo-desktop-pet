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

## 测试与检查

```powershell
Set-Location -LiteralPath 'D:\daoju\dv\yachiyo-desktop-pet'
npm test
node --check .\src\main.cjs
node --check .\src\preload.cjs
node --check .\src\codex-activity.cjs
node --check .\src\renderer\pet.js
node --check .\src\renderer\dialogue.js
```

当前测试基线为 7 项通过。涉及窗口、托盘、拖动、动画或场景时仍需在 Windows 上手工验证。

## 构建与发布

```powershell
# 仅生成 portable 包
npm run build

# 同时生成可选目录的 NSIS 安装包和 portable 包
npm run dist
```

- 输出目录：`release/`；该目录以及其他 `release*/` 不纳入 Git。
- portable 包会在运行时向 `%TEMP%` 解压完整 Electron 程序，清理失败时会占用 C 盘；日常使用优先 NSIS 安装版或 `win-unpacked`。
- 当前可执行文件未启用代码签名，`package.json` 中 `signAndEditExecutable` 为 `false`。
- 私有远端：`https://github.com/yuhuan2498281558/yachiyo-desktop-pet.git`，默认分支 `main`。

## 已知环境问题

- portable 包曾产生约 369 MB 的单次临时解压目录；不要把 portable 可执行文件作为日常快捷方式目标。
- `release/`、`tmp/` 和 `node_modules/` 体积较大，均由 `.gitignore` 排除；清理前应确认没有运行中的桌宠或构建任务。
- 应用数据入口依赖目录联接；迁移磁盘或重装系统后需要重新核对 `%APPDATA%` 入口与 D 盘目标。
- 角色与作品相关素材仅适合个人学习和桌面展示，公开或商业发布存在授权限制。
