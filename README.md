# RoundStudio qBot

基于 [@tencent-connect/qqbot-nodejs](https://www.npmjs.com/package/@tencent-connect/qqbot-nodejs) 的 QQ 机器人 + Web 管理面板。

所有可配置项（机器人凭证、仓库、指令、Markdown 模板）均可通过管理面板配置，配置保存在系统配置目录：

- **Windows**: `%appdata%\RoundStudio\qBot`
- **Linux**: `~/.config/RoundStudio/qBot`（或 `$XDG_CONFIG_HOME/RoundStudio/qBot`）

## 管理面板

黑白灰配色，每个分类一个独立路由，可同时开多个标签页互不干扰：

| 路由 | 页面 |
| --- | --- |
| `/#/settings` | 机器人设置：AppID / AppSecret、缓存时间、默认指令前缀、启停控制 |
| `/#/repos` | 仓库管理：GitHub 仓库增删改、测试拉取 Release 并预览模板渲染 |
| `/#/commands` | 指令管理：匹配关键词 / 前缀 / 类型 / 关联仓库与模板 |
| `/#/templates` | 模板管理：Markdown 模板编辑、变量插入、实时预览 |

每个页面底部有**保存条**：有未保存修改时高亮提示，保存成功后重新拉取服务端配置验证落盘，失败时显示具体错误（错误不会自动消失）。

## 指令匹配系统

指令由 **关键词（keywords）+ 前缀（prefixes）** 组成，匹配规则：

1. 去掉消息开头的 `@机器人` 提及；
2. 依次尝试每条启用指令的每个「前缀 + 关键词」组合，与消息开头整体匹配（大小写不敏感）；
3. 消息等于「前缀 + 关键词」或「前缀 + 关键词 + 空格 + 参数」即命中；
4. 禁用指令 / 空消息不匹配；无任何命中时按 `errorTexts.noCommand` 处理（默认不回复）。

示例：关键词 `bb` + 前缀 `.` → 触发 `.bb`、`.bb 参数`；旧版 `patterns`（如 `[".bb", "/bb", "。bb"]`）会自动迁移为 `keywords + prefixes`。

## 模板语法

| 语法 | 说明 |
| --- | --- |
| `{{displayName}}` | 变量替换 |
| `{{#assets}}...{{/assets}}` | 循环列表（assets 等数组） |
| `{{^assets}}...{{/assets}}` | 取反：列表为空或无值时渲染 |

**Release 模板变量**：`displayName` `repoKey` `owner` `repoName` `tagName` `releaseName` `publishedAt` `website` `windowsFile` `linuxFile` `htmlUrl` `body`，以及 `#assets` 循环（内部 `name` / `url`）、`#windowsFile` / `#linuxFile` 条件块。

**帮助模板变量**：`#commands` 循环（内部 `name` `description` `firstPattern` `patterns` `keywords` `prefixes`）。

## 快速开始

```bash
npm install

# 开发模式：后端服务（3000）
npm run server

# 另开终端：前端（5173，/api 自动代理到 3000）
npm run dev

# 生产模式：构建后由 3000 端口直接提供面板
npm run build
npm start
```

## 配置说明

首次启动自动生成默认配置（`APP_ID` / `APP_SECRET` 从 `.env` 读取作为种子）：

```
RoundStudio/qBot/
├── config.json        # 主配置（机器人、仓库、指令、模板）
└── cache/             # GitHub Release 缓存
    └── <repoKey>.json
```

修改机器人凭证保存后会自动重启机器人；其余配置保存后立即生效。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/status` | 机器人状态 |
| POST | `/api/bot/start` `/api/bot/stop` `/api/bot/restart` | 机器人控制 |
| GET / PUT | `/api/config` | 读取 / 保存配置 |
| GET | `/api/config/path` | 配置目录路径 |
| POST | `/api/template/preview` | 模板渲染预览（body: `{template, kind}`） |
| POST | `/api/repos/:key/fetch?refresh=1` | 拉取（并缓存）仓库最新 Release |