import { QQBot } from '@tencent-connect/qqbot-nodejs';
import { renderTemplate } from './template.js';
import { DEFAULT_HELP_TEMPLATE, DEFAULT_RELEASE_TEMPLATE } from './config.js';
import { matchCommand, firstPattern, allPatterns } from './matcher.js';

// 获取消息的发送目标
function getSendTarget(msg) {
  if (msg.replyTarget) {
    return msg.replyTarget;
  }
  if (msg.raw && msg.raw.group_openid) {
    return { scope: 'group', targetId: msg.raw.group_openid };
  }
  if (msg.raw && msg.raw.group_id) {
    return { scope: 'group', targetId: msg.raw.group_id };
  }
  if (msg.groupOpenid) {
    return { scope: 'group', targetId: msg.groupOpenid };
  }
  if (msg.group_id) {
    return { scope: 'group', targetId: msg.group_id };
  }
  if (msg.user_id) {
    return { scope: 'c2c', targetId: msg.user_id };
  }
  return null;
}

// 提取指令和参数（保留，兼容其他调用方）
function parseCommand(content) {
  if (!content) return { command: '', args: [] };

  let trimmed = content.trim();

  const atMatch = trimmed.match(/^@[^\s]+\s*(.*)$/);
  if (atMatch) {
    trimmed = atMatch[1].trim();
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0] || '';
  const args = parts.slice(1);

  return { command, args };
}

function formatDate(iso) {
  if (!iso) return '未知';
  try {
    return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return iso;
  }
}

// 生成模板渲染所需的上下文数据
export function buildReleaseContext(repo, releaseData) {
  const assets = (releaseData.assets || []).map(a => ({
    name: a.name || '',
    url: a.browser_download_url || '',
  }));
  return {
    repoKey: repo.key,
    displayName: repo.displayName || repo.key,
    owner: repo.owner,
    repoName: repo.name,
    tagName: releaseData.tag_name || '未知',
    releaseName: releaseData.name || '',
    publishedAt: formatDate(releaseData.published_at),
    body: releaseData.body || '',
    htmlUrl: releaseData.html_url || '',
    website: repo.website || '',
    windowsFile: repo.windowsFile || '',
    linuxFile: repo.linuxFile || '',
    assets,
    hasAssets: assets.length > 0,
  };
}

const GITHUB_API = (owner, name) =>
  `https://api.github.com/repos/${owner}/${name}/releases/latest`;

export class BotManager {
  constructor(store) {
    this.store = store;
    this.bot = null;
    this.state = 'stopped'; // stopped | connecting | running | error
    this.error = null;
    this.startedAt = null;
    this.lastMessage = null;
    this._startTask = null;
    this._stopping = false;
  }

  getStatus() {
    return {
      state: this.state,
      appId: this.store.get().bot?.appId || '',
      error: this.error,
      startedAt: this.startedAt,
      lastMessage: this.lastMessage,
    };
  }

  async start() {
    const config = this.store.get();
    const creds = config.bot || {};
    if (!creds.appId || !creds.appSecret) {
      this.state = 'error';
      this.error = '未配置 AppID / AppSecret，请先在管理面板中填写。';
      return false;
    }

    await this.stop();

    let bot;
    try {
      bot = new QQBot({
        appId: creds.appId,
        appSecret: creds.appSecret,
        logger: console,
      });
      bot.on('message', (ctx, msg) => this.handleMessage(bot, msg));
    } catch (err) {
      this.state = 'error';
      this.error = `创建机器人失败: ${err.message}`;
      return false;
    }

    this.bot = bot;
    this.state = 'connecting';
    this.error = null;

    bot.on('ready', () => {
      this.state = 'running';
      this.startedAt = Date.now();
      console.log('QQ Bot 已连接就绪');
    });
    bot.on('error', err => {
      this.error = err.message;
    });

    this._startTask = bot.start().then(
      () => {
        if (this.bot === bot && !this._stopping) {
          this.state = 'stopped';
        }
      },
      err => {
        if (this.bot === bot) {
          this.state = 'error';
          this.error = err.message || String(err);
        }
      }
    );

    return true;
  }

  async stop() {
    this._stopping = true;
    const bot = this.bot;
    this.bot = null;
    if (bot) {
      try {
        bot.stop();
      } catch (err) {
        console.error('停止机器人失败:', err);
      }
    }
    this.state = 'stopped';
    this._stopping = false;
  }

  async restart() {
    await this.start();
  }

  async fetchLatestRelease(repo, { force = false } = {}) {
    const ttl = this.store.get().cacheTtlMs || 60 * 60 * 1000;
    if (!force) {
      const cache = await this.store.readCache(repo.key);
      if (cache && Date.now() - cache.timestamp < ttl) {
        console.log(`使用缓存数据（${repo.displayName}）`);
        return cache.releaseData;
      }
    }

    console.log(`缓存已过期或不存在，请求 GitHub API（${repo.displayName}）...`);
    const response = await fetch(GITHUB_API(repo.owner, repo.name), {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!response.ok) {
      throw new Error(`GitHub API 请求失败，状态码: ${response.status}`);
    }
    const data = await response.json();
    await this.store.writeCache(repo.key, data);
    console.log(`数据已缓存（${repo.displayName}）`);
    return data;
  }

  async handleMessage(bot, msg) {
    this.lastMessage = { content: msg.content, time: Date.now() };
    console.log(`收到消息: ${msg.content}, 类型: ${msg.rawEventType || '未知'}`);

    const eventType = msg.rawEventType || '';
    if (eventType === 'IMAGE' || eventType === 'image' ||
        msg.content?.includes('[图片]') || msg.content?.includes('[image]')) {
      console.log('忽略图片消息');
      return;
    }

    // 如果消息内容为空或只有空白，也忽略
    if (!msg.content || !msg.content.trim()) {
      console.log('忽略空消息');
      return;
    }

    const config = this.store.get();
    const target = getSendTarget(msg);
    if (!target) {
      console.log('无法确定消息发送目标:', JSON.stringify(msg));
      return;
    }

    const { command, args } = parseCommand(msg.content || '');
    console.log(`解析结果: 指令="${command}", 参数=${JSON.stringify(args)}`);

    if (!command) {
      await this.runHelp(bot, target);
      return;
    }

    const commands = this.store.getCommands();
    const defaultPrefixes = this.store.get().defaultPrefixes || [];

    // 匹配系统：前缀 + 关键词，支持多种触发方式
    const matched = matchCommand(msg.content, commands, defaultPrefixes);

    if (!matched) {
      const noCommand = config.errorTexts?.noCommand;
      if (noCommand) {
        await this.safeSend(bot, target, noCommand);
      }
      return;
    }

    const { command: commandDef, args: matchArgs } = matched;
    console.log(`执行指令: ${commandDef.name}（触发词 ${firstPattern(commandDef, defaultPrefixes)}）`);
    try {
      if (commandDef.type === 'help') {
        await this.runHelp(bot, target);
      } else if (commandDef.type === 'text') {
        await this.safeSend(bot, target, commandDef.replyText || '');
      } else if (commandDef.type === 'release') {
        await this.runRelease(bot, target, commandDef);
      } else {
        await this.runHelp(bot, target);
      }
    } catch (err) {
      console.error(`指令 ${commandDef.name} 执行出错:`, err);
      const errorText = config.errorTexts?.error || '❌ 执行出错，请稍后重试。';
      await this.safeSend(bot, target, errorText);
    }
  }

  async runHelp(bot, target) {
    const config = this.store.get();
    const commands = this.store.getCommands();
    const defaultPrefixes = config.defaultPrefixes || [];
    const context = {
      commands: commands.map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        patterns: allPatterns(cmd, defaultPrefixes).join(' '),
        firstPattern: firstPattern(cmd, defaultPrefixes),
        keywords: (cmd.keywords || []).join(' '),
        prefixes: (cmd.prefixes || defaultPrefixes).join(' '),
      })),
    };
    const template = this.store.getTemplate('help');
    const content = renderTemplate(template ? template.content : DEFAULT_HELP_TEMPLATE, context);
    await this.safeSendMarkdown(bot, target, content, config);
  }

  async runRelease(bot, target, cmd) {
    const config = this.store.get();
    const repo = this.store.getRepo(cmd.repoKey);
    if (!repo || repo.enabled === false) {
      await this.safeSend(bot, target, config.errorTexts?.repoDisabled || '❌ 该仓库未配置或已停用。');
      return;
    }

    let releaseData;
    try {
      releaseData = await this.fetchLatestRelease(repo);
    } catch (err) {
      console.error(`获取最新 Release 失败（${repo.displayName}）:`, err);
      await this.safeSend(bot, target, config.errorTexts?.fetchFailed || '❌ 查询失败，请稍后重试或检查网络。');
      return;
    }

    const template = this.store.getTemplate(cmd.templateKey);
    const content = renderTemplate(
      template ? template.content : DEFAULT_RELEASE_TEMPLATE,
      buildReleaseContext(repo, releaseData)
    );

    if (!content.trim()) {
      await this.safeSend(bot, target, config.errorTexts?.renderFailed || '❌ 生成回复失败，请稍后重试。');
      return;
    }
    await this.safeSendMarkdown(bot, target, content, config);
  }

  async safeSend(bot, target, content) {
    if (!content) return;
    try {
      await bot.sendText(target, content);
    } catch (err) {
      console.error('发送文本消息失败:', err);
    }
  }

  async safeSendMarkdown(bot, target, content, config) {
    if (!content) return;
    try {
      await bot.sendMarkdown(target, content);
    } catch (err) {
      console.error('发送 Markdown 消息失败，降级为文本:', err);
      await this.safeSend(bot, target, config?.errorTexts?.error || '❌ 发送失败，请稍后重试。');
    }
  }
}