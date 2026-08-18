import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { migratePatterns, DEFAULT_PREFIXES } from './matcher.js';

export const DEFAULT_RELEASE_TEMPLATE = `## {{displayName}} 最新构建信息

**版本号**：{{tagName}}
**发布日期**：{{publishedAt}}

---

### 📦 下载链接

{{#assets}}- [{{name}}]({{url}})
{{/assets}}{{^assets}}暂无构建文件{{/assets}}
---

### 🖥️ 平台推荐

{{#windowsFile}}- **Windows**：[{{windowsFile}}]({{website}})
{{/windowsFile}}{{#linuxFile}}- **Linux**：[{{linuxFile}}]({{website}})
{{/linuxFile}}{{^windowsFile}}{{^linuxFile}}无特定平台推荐{{/linuxFile}}{{/windowsFile}}

---

> 💡 如无法进行下载，可尝试自行使用第三方加速器进行加速。

[🌐 官网链接]({{website}})`;

export const DEFAULT_HELP_TEMPLATE = `## 📚 可用指令列表

{{#commands}}**{{firstPattern}}**
> {{description}}
{{/commands}}
---

💡 **提示**：指令支持 \`.\` \`/\` \`。\` 开头，例如 \`.help\` \`/help\` \`。help\``;

export function getConfigDir() {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'RoundStudio', 'qBot');
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, 'RoundStudio', 'qBot');
}

export function defaultConfig(env = process.env) {
  return {
    bot: {
      appId: env.APP_ID || '',
      appSecret: env.APP_SECRET || '',
    },
    cacheTtlMs: 60 * 60 * 1000,
    defaultPrefixes: [...DEFAULT_PREFIXES],
    templates: [
      { key: 'release', name: '发布信息模板', content: DEFAULT_RELEASE_TEMPLATE },
      { key: 'help', name: '帮助模板', content: DEFAULT_HELP_TEMPLATE },
    ],
    errorTexts: {
      fetchFailed: '❌ 查询失败，请稍后重试或检查网络。',
      renderFailed: '❌ 生成回复失败，请稍后重试。',
      repoDisabled: '❌ 该仓库未配置或已停用。',
      noCommand: '',
      error: '❌ 执行出错，请稍后重试。',
    },
    repos: [
      {
        key: 'bedrockboot',
        displayName: 'BedrockBoot',
        owner: 'Round-Studio',
        name: 'BedrockBoot',
        windowsFile: 'BedrockBoot-x86_64-win.exe',
        linuxFile: 'BedrockBoot-x86_64-linux.AppImage',
        website: 'https://roundstudio.top/bedrockboot',
        enabled: true,
      },
      {
        key: 'bmcbl',
        displayName: 'Better Minecraft Bedrock Launcher (BMCBL)',
        owner: 'Chlna6666',
        name: 'Better-Minecraft-Bedrock-Launcher',
        windowsFile: '',
        linuxFile: '',
        website: 'https://github.com/Chlna6666/Better-Minecraft-Bedrock-Launcher',
        enabled: true,
      },
    ],
    commands: [
      {
        id: 'help',
        name: 'help',
        description: '显示此帮助信息',
        keywords: ['help', '帮助'],
        prefixes: [...DEFAULT_PREFIXES],
        type: 'help',
        enabled: true,
      },
      {
        id: 'bb',
        name: 'bedrockboot',
        description: '获取 BedrockBoot 最新构建文件',
        keywords: ['bb', 'bedrockboot'],
        prefixes: [...DEFAULT_PREFIXES],
        type: 'release',
        repoKey: 'bedrockboot',
        templateKey: 'release',
        enabled: true,
      },
      {
        id: 'bmcbl',
        name: 'bmcbl',
        description: '获取 BMCBL 最新构建文件',
        keywords: ['bmcbl'],
        prefixes: [...DEFAULT_PREFIXES],
        type: 'release',
        repoKey: 'bmcbl',
        templateKey: 'release',
        enabled: true,
      },
    ],
  };
}

function normalizeCommand(c) {
  let keywords = Array.isArray(c.keywords)
    ? c.keywords.map(k => String(k).trim()).filter(Boolean)
    : [];
  let prefixes = Array.isArray(c.prefixes)
    ? c.prefixes.map(p => String(p).trim()).filter(Boolean)
    : [];

  // 旧配置迁移：从 patterns 推导 keywords/prefixes
  if (!keywords.length && Array.isArray(c.patterns)) {
    const migrated = migratePatterns(c.patterns);
    keywords = migrated.keywords;
    if (!prefixes.length) prefixes = migrated.prefixes;
  }
  if (!keywords.length) keywords = [String(c.name || '').trim()].filter(Boolean);
  if (!prefixes.length) prefixes = [...DEFAULT_PREFIXES];

  return {
    id: String(c.id || cryptoRandomId()),
    name: String(c.name || '').trim(),
    description: String(c.description || ''),
    keywords,
    prefixes,
    type: ['help', 'text', 'release'].includes(c.type) ? c.type : 'text',
    repoKey: c.repoKey ? String(c.repoKey) : '',
    templateKey: c.templateKey ? String(c.templateKey) : '',
    replyText: c.replyText != null ? String(c.replyText) : '',
    enabled: c.enabled !== false,
  };
}

function normalizeConfig(cfg, env = process.env) {
  const defaults = defaultConfig(env);
  const config = {
    bot: { ...defaults.bot, ...(cfg.bot || {}) },
    cacheTtlMs: Number(cfg.cacheTtlMs) > 0 ? Number(cfg.cacheTtlMs) : defaults.cacheTtlMs,
    defaultPrefixes: Array.isArray(cfg.defaultPrefixes) && cfg.defaultPrefixes.length
      ? cfg.defaultPrefixes.map(p => String(p).trim()).filter(Boolean)
      : [...DEFAULT_PREFIXES],
    templates: Array.isArray(cfg.templates) && cfg.templates.length > 0
      ? cfg.templates.map(t => ({ key: String(t.key || ''), name: String(t.name || ''), content: String(t.content ?? '') }))
      : defaults.templates,
    errorTexts: { ...defaults.errorTexts, ...(cfg.errorTexts || {}) },
    repos: Array.isArray(cfg.repos)
      ? cfg.repos.map(r => ({
          key: String(r.key || '').trim(),
          displayName: String(r.displayName || r.key || ''),
          owner: String(r.owner || '').trim(),
          name: String(r.name || '').trim(),
          windowsFile: String(r.windowsFile || '').trim(),
          linuxFile: String(r.linuxFile || '').trim(),
          website: String(r.website || '').trim(),
          enabled: r.enabled !== false,
        }))
      : defaults.repos,
    commands: Array.isArray(cfg.commands)
      ? cfg.commands.map(normalizeCommand)
      : defaults.commands,
  };
  return config;
}

function cryptoRandomId() {
  const crypto = globalThis.crypto;
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ConfigStore {
  constructor() {
    this.dir = getConfigDir();
    this.file = path.join(this.dir, 'config.json');
    this.cacheDir = path.join(this.dir, 'cache');
    this.config = null;
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.file, 'utf-8');
      this.config = normalizeConfig(JSON.parse(raw));
    } catch {
      this.config = defaultConfig();
      await this.save(this.config);
    }
    return this.config;
  }

  get() {
    return this.config;
  }

  getTemplates() {
    return this.config.templates || [];
  }

  getTemplate(key) {
    return this.getTemplates().find(t => t.key === key) || null;
  }

  getRepos() {
    return this.config.repos || [];
  }

  getRepo(key) {
    return this.getRepos().find(r => r.key === key) || null;
  }

  getCommands() {
    return (this.config.commands || []);
  }

  async save(next) {
    const normalized = normalizeConfig(next);
    await fs.mkdir(this.dir, { recursive: true });
    // 直接写盘（Windows 下 rename 可能因文件占用失败）
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await fs.writeFile(this.file, JSON.stringify(normalized, null, 2), 'utf-8');
        this.config = normalized;
        return normalized;
      } catch (err) {
        lastError = err;
        await new Promise(r => setTimeout(r, 150 * (attempt + 1)));
      }
    }
    throw lastError || new Error('写入配置失败');
  }

  cacheFile(repoKey) {
    return path.join(this.cacheDir, `${repoKey}.json`);
  }

  async readCache(repoKey) {
    try {
      const content = await fs.readFile(this.cacheFile(repoKey), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async writeCache(repoKey, data) {
    const cacheData = { timestamp: Date.now(), releaseData: data };
    await fs.writeFile(this.cacheFile(repoKey), JSON.stringify(cacheData, null, 2), 'utf-8');
  }
}