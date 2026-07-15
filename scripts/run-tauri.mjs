import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';

const home = process.env.HOME || process.env.USERPROFILE;
const cargoBin = home ? join(home, '.cargo', 'bin') : '';
const executable = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
const tauriBin = join(process.cwd(), 'node_modules', '.bin', executable);
const path = [cargoBin, process.env.PATH].filter(Boolean).join(delimiter);
const result = spawnSync(tauriBin, process.argv.slice(2), {
  stdio: 'inherit',
  env: { ...process.env, PATH: path }
});

if (result.error) {
  console.error(`Tauri 실행에 실패했습니다: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
