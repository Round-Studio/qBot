# RoundStudio qBot

基于 [@tencent-connect/qqbot-nodejs](https://www.npmjs.com/package/@tencent-connect/qqbot-nodejs) 的 QQ 机器人 + Web 管理面板。

所有可配置项（机器人凭证、仓库、指令、Markdown 模板）均可通过前端管理面板配置，配置保存在系统配置目录：

- **Windows**: `%appdata%\RoundStudio\qBot`
- **Linux**: `~/.config/RoundStudio/qBot`（或 `$XDG_CONFIG_HOME/RoundStudio/qBot`）

## 功能

- **机器人设置**：AppID / AppSecret、Release 缓存时间、启动 / 重启 / 停止
- **仓库管理**：维护 GitHub 仓库列表（owner / repo / 平台推荐文件 / 官网链接），支持测试拉取最新 Release
- **指令管理**：指令的触发词（如 `.bb` `/bb` `。bb`）、类型（查询 Release / 帮助 / 固定文本）、关联仓库与模板
- **模板管理**：Markdown 模板在线编辑，支持变量与循环语法，内置预览

### 模板语法

| 语法 | 说明 |
| --- | --- |
| `{{displayName}}` | 变量替换 |
| `{{#assets}}...{{/assets}}` | 循环列表（assets 等数组） |
| `{{^assets}}...{{/assets}}` | 取反：列表为空或无值时渲染 |

**Release 模板可用变量**：`displayName` `repoKey` `owner` `repoName` `tagName` `releaseName` `publishedAt` `website` `windowsFile` `linuxFile` `htmlUrl` `body`，以及 `#assets` 循环（内部 `name` / `url`）、`#windowsFile` / `#linuxFile` 条件块。

**帮助模板可用变量**：`#commands` 循环（内部 `name` `description` `patterns` `firstPattern`）。

## 快速开始

```bash
npm install

# 一、前端开发模式（访问 http://localhost:5173，/api 自动代理到 3000）
npm run dev

# 二、后端服务（端口 3000，可配置 PORT 环境变量），默认自动启动 QQ 机器人
npm run server

# 生产模式：先构建前端，再启动服务，管理面板直接由 3000 端口提供
npm run build
npm start
```

## 配置说明

首次启动时若 `config.json` 不存在，会自动生成默认配置（`APP_ID` / `APP_SECRET` 从 `.env` 读取作为种子）：

```
RoundStudio/qBot/
├── config.json        # 主配置（机器人、仓库、指令、模板）
└── cache/             # GitHub Release 缓存
    ├── <repoKey>.json
    └── ...
```

修改机器人凭证保存后会自动重启机器人；其余配置（指令、仓库、模板）保存后立即生效。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/status` | 机器人状态 |
| POST | `/api/bot/start` `/api/bot/stop` `/api/bot/restart` | 机器人控制 |
| GET / PUT | `/api/config` | 读取 / 保存配置 |
| GET | `/api/config/path` | 配置目录路径 |
| POST | `/api/template/preview` | 模板渲染预览（body: `{template, kind}`） |
| POST | `/api/repos/:key/fetch?refresh=1` | 拉取（并缓存）仓库最新 Release |