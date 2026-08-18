import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { ConfigStore } from './config.js';
import { BotManager, buildReleaseContext } from './bot.js';
import { renderTemplate } from './template.js';
import { DEFAULT_RELEASE_TEMPLATE } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// 获取本机局域网 IPv4 地址列表
function lanUrls() {
  const urls = [];
  const interfaces = os.networkInterfaces();
  for (const list of Object.values(interfaces)) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) {
        urls.push(`http://${item.address}:${PORT}`);
      }
    }
  }
  return urls;
}

const store = new ConfigStore();
await store.init();

const botManager = new BotManager(store);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) {
      throw new Error('请求体过大');
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

function sampleData(kind) {
  if (kind === 'help') {
    return {
      commands: [
        { name: 'help', description: '显示此帮助信息', patterns: '.help /help 。help', firstPattern: '.help' },
        { name: 'bedrockboot', description: '获取 BedrockBoot 最新构建文件', patterns: '.bb /bb 。bb', firstPattern: '.bb' },
      ],
    };
  }
  const repo = store.getRepo('bedrockboot') || { key: 'bedrockboot', displayName: 'BedrockBoot', website: 'https://example.com' };
  const fake = {
    tag_name: 'v1.0.0',
    name: 'v1.0.0',
    published_at: new Date().toISOString(),
    html_url: 'https://github.com/example/repo/releases',
    body: '示例更新内容',
    assets: [
      { name: 'example-win.exe', browser_download_url: 'https://example.com/example-win.exe' },
      { name: 'example-linux.AppImage', browser_download_url: 'https://example.com/example-linux.AppImage' },
    ],
  };
  return buildReleaseContext(repo, fake);
}

async function handleApi(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;

  // GET /api/status
  if (method === 'GET' && pathname === '/api/status') {
    return sendJson(res, 200, botManager.getStatus());
  }

  // POST /api/bot/start|stop|restart
  const botAction = pathname.match(/^\/api\/bot\/(start|stop|restart)$/);
  if (method === 'POST' && botAction) {
    const action = botAction[1];
    try {
      if (action === 'start') {
        const ok = await botManager.start();
        return sendJson(res, ok ? 200 : 400, botManager.getStatus());
      }
      if (action === 'stop') {
        await botManager.stop();
        return sendJson(res, 200, botManager.getStatus());
      }
      const ok = await botManager.restart();
      return sendJson(res, ok ? 200 : 400, botManager.getStatus());
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // GET /api/config
  if (method === 'GET' && pathname === '/api/config') {
    return sendJson(res, 200, store.get());
  }

  // PUT /api/config
  if (method === 'PUT' && pathname === '/api/config') {
    try {
      const body = await readBody(req);
      const saved = await store.save(body);
      return sendJson(res, 200, saved);
    } catch (err) {
      return sendError(res, 400, `配置保存失败: ${err.message}`);
    }
  }

  // GET /api/config/path
  if (method === 'GET' && pathname === '/api/config/path') {
    return sendJson(res, 200, { dir: store.dir, file: store.file, cacheDir: store.cacheDir });
  }

  // POST /api/template/preview  { template, data? }
  if (method === 'POST' && pathname === '/api/template/preview') {
    try {
      const body = await readBody(req);
      const template = body.template ?? '';
      const data = body.data ?? sampleData(body.kind || 'release');
      return sendJson(res, 200, { rendered: renderTemplate(template, data) });
    } catch (err) {
      return sendError(res, 400, err.message);
    }
  }

  // POST /api/repos/:key/fetch?refresh=1
  const repoMatch = pathname.match(/^\/api\/repos\/([^/]+)\/fetch$/);
  if (method === 'POST' && repoMatch) {
    const repo = store.getRepo(decodeURIComponent(repoMatch[1]));
    if (!repo) return sendError(res, 404, '仓库不存在');
    try {
      const force = url.searchParams.get('refresh') === '1';
      const releaseData = await botManager.fetchLatestRelease(repo, { force });
      const template = store.getTemplate('release');
      const content = renderTemplate(
        template ? template.content : DEFAULT_RELEASE_TEMPLATE,
        buildReleaseContext(repo, releaseData)
      );
      return sendJson(res, 200, {
        ok: true,
        tagName: releaseData.tag_name || '未知',
        publishedAt: releaseData.published_at || null,
        assetCount: (releaseData.assets || []).length,
        assets: (releaseData.assets || []).map(a => a.name),
        rendered: content,
      });
    } catch (err) {
      return sendError(res, 502, `获取 Release 失败: ${err.message}`);
    }
  }

  return sendError(res, 404, '接口不存在');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStatic(res, pathname) {
  let filePath = path.join(DIST, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ...(ext === '.html' ? { 'Cache-Control': 'no-store' } : {}),
    });
    return fs.createReadStream(filePath).pipe(res);
  }
  const index = path.join(DIST, 'index.html');
  if (fs.existsSync(index)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(index).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>qBot 管理面板未构建</title>
<style>
body{font-family:system-ui,'Microsoft YaHei',sans-serif;background:#fff;color:#18181b;display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0}
.card{max-width:520px;padding:32px;border:1px solid #e4e4e7;border-radius:12px}
h1{font-size:18px}code{background:#f4f4f5;border:1px solid #e4e4e7;border-radius:4px;padding:2px 8px;font-family:Consolas,monospace}
p{color:#52525b;font-size:14px;line-height:1.8}
</style></head>
<body><div class="card">
<h1>管理面板尚未构建</h1>
<p>请先在项目目录下运行：</p>
<p><code>npm run build</code></p>
<p>构建完成后重启服务：<code>npm start</code>（会自动构建）</p>
<p>或开发模式：<code>npm run dev</code> 打开 http://localhost:5173</p>
</div></body></html>`);
}

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);
    const url = new URL(req.url, `http://${req.headers.host || '0.0.0.0'}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      serveStatic(res, url.pathname);
    }
  } catch (err) {
    if (!res.headersSent) {
      sendError(res, 500, err.message);
    } else {
      res.end();
    }
  }
});

const started = await botManager.start();

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.log('--------------------------------------------------------');
  console.log(' ⚠ 注意：dist/ 目录不存在或未构建，管理面板暂时不可用。');
  console.log('   请先运行: npm run build');
  console.log('   然后重启: npm start');
  console.log('   （也可以使用 npm run dev 开发模式）');
  console.log('--------------------------------------------------------');
}

console.log('========================================');
console.log(' RoundStudio qBot 管理服务');
console.log('----------------------------------------');
console.log(` 配置目录: ${store.dir}`);
console.log(` 配置文件: ${store.file}`);
console.log(` 管理面板(本机): http://localhost:${PORT}`);
for (const url of lanUrls()) {
  console.log(` 管理面板(局域网): ${url}`);
}
console.log(` 机器人状态: ${botManager.getStatus().state}`);
console.log('========================================');

server.listen(PORT, HOST, () => {
  console.log(`HTTP 服务已启动: http://${HOST === '0.0.0.0' ? '0.0.0.0' : HOST}:${PORT}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`收到 ${sig}，正在退出...`);
    await botManager.stop();
    server.close(() => process.exit(0));
  });
}