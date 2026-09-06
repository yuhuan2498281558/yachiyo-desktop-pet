# 环境与操作文档

## 技术栈与版本

- Windows Electron 桌面应用，CommonJS + 原生 HTML/CSS/JavaScript。
- 项目版本：0.3.3。
- `electron`: 43.2.0；`electron-builder`: 26.0.12。
- Node.js 要求：20+；2026-08-23 本机验证为 Node v24.19.0、npm 11.17.0。
- 测试框架：Node 内置 `node:test`。

## 环境前置条件

- Windows 10/11。
- Node.js 20+ 与 npm。
- 构建和版本管理需要 Git；GitHub 同步使用已授权的 GitHub CLI 或标准 Git 凭据。
- 源码根目录：`D:\桌宠\源码\yachiyo-desktop-pet`。
- 桌宠总目录按 `程序`、`源码`、`资料` 分类；目录说明见 `D:\桌宠\目录说明.md`。

## 安装与初始化

```powershell
Set-Location -LiteralPath 'D:\桌宠\源码\yachiyo-desktop-pet'
npm ci
```

首次无锁文件兼容需求时也可运行 `npm install`；常规复现优先 `npm ci`。

## 本地运行

```powershell
Set-Location -LiteralPath 'D:\桌宠\源码\yachiyo-desktop-pet'
npm start
```

- 当前日常程序：`D:\桌宠\程序\八千代与辉夜桌宠\八千代与辉夜桌宠.exe`。
- 当前快捷方式：`D:\桌面\八千代与辉夜桌宠.lnk`，目标应指向上述解包程序。
- 用户数据实际保存于 `D:\桌宠\资料\用户数据\yachiyo-desktop-pet`；应用仍通过 `%APPDATA%\yachiyo-desktop-pet` 兼容入口访问。
- 本地 Live2D 工作区：`D:\桌宠\资料\Live2D工程\八千代`；v0.2 规格与参考索引位于其 `00-规格与索引` 目录。原片、画集、参考帧、分层稿、Cubism 工程和运行时模型素材仅保存在该本地工作流中，不提交到 Git。
- 桌宠实际读取的本地模型入口：`assets\live2d\models\tsukimi-yachiyo\tsukimi-yachiyo.model3.json`。该模型目录被 Git 忽略；本机 `npm start` 和打包会读取它，缺失时自动回退到 Sprite。
- Live2D 浏览器运行库位于 `src\renderer\vendor`；第三方版本与许可见该目录的 `THIRD_PARTY_NOTICES.md`。

## 测试与检查

```powershell
Set-Location -LiteralPath 'D:\桌宠\源码\yachiyo-desktop-pet'
npm test
npm run check
```

当前测试基线为 27 项通过。`npm run check` 递归检查应用与验证脚本（排除第三方 vendor）。`npm test` 明确只运行 `test/*.test.cjs`，不再误收录临时备份中的旧测试。

真实 Electron 回归：`npm run test:electron`；打包版：`npm run test:electron -- --exe "完整 exe 路径"`；追加 `--soak-minutes 30` 可执行半小时稳定性运行。报告、截图与隔离用户数据保存在 `tmp/electron-smoke-*`。依赖本地 Live2D 模型，CI 干净 checkout 仍只覆盖单元测试与打包。

v0.3.3 源码与打包版各通过 11 组检查，包含两档画质的真实拖动、隐藏时模型时钟暂停、视线风格和偏好重启。验收构建：`tmp/comfort-build-20260906/win-unpacked`；新增菜单使用说明见 README。标准档保持默认，省电档仅调整帧率与渲染分辨率，不改变模型纹理。

性能基线：`npm run benchmark:activity`。2026-09-06 本机 22 个近期会话首次扫描约 104 ms；缓存后约 4–6 ms。窗口进程使用独立 worker，首次扫描也不在主线程执行。

诊断：用户数据目录下 `logs/diagnostics.jsonl`，当前及轮转上一份各不超过 256 KiB。仅记录状态与错误码，不包含会话正文、文件路径或原始错误文本。实际路径为 `D:\桌宠\资料\用户数据\yachiyo-desktop-pet\logs`；写入前解析 junction 的真实路径，避免通过 C 盘联接创建子目录时出现 ENOENT。

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
Set-Location -LiteralPath 'D:\桌宠\源码\yachiyo-desktop-pet'
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
