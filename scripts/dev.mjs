import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const isWin = process.platform === 'win32';

console.log('[dev] building electron main...');
execFileSync(isWin ? 'npm.cmd' : 'npm', ['run', 'build:electron'], { cwd: root, stdio: 'inherit' });

const vite = spawn(isWin ? 'npx.cmd' : 'npx', ['vite'], { cwd: root, stdio: 'inherit' });
if (!existsSync(join(root, 'node_modules', 'electron', 'dist', 'electron.exe'))) {
  vite.kill();
  console.error('[dev] electron binary missing; run npm install again.');
  process.exit(1);
}

const url = 'http://127.0.0.1:5173';
async function waitServer(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite dev server did not start in time');
}

waitServer()
  .then(() => {
    console.log('[dev] vite ready, launching electron...');
    const electron = spawn(
      join(root, 'node_modules', 'electron', 'dist', 'electron.exe'),
      ['.'],
      { cwd: root, env: { ...process.env, VITE_DEV_SERVER_URL: url }, stdio: 'inherit' }
    );
    const stop = () => {
      vite.kill();
      electron.kill();
    };
    process.on('SIGINT', stop);
    process.on('exit', stop);
    electron.on('exit', () => {
      vite.kill();
    });
  })
  .catch((err) => {
    console.error(err.message);
    vite.kill();
    process.exit(1);
  });