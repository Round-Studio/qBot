// 启动入口：若管理面板未构建（dist/ 缺失），先自动执行 vite build
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.log('检测到管理面板未构建，正在自动运行 npm run build ...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (err) {
    console.error('自动构建失败，请手动运行 npm run build 后重试。');
    process.exit(1);
  }
}

await import('./index.js');