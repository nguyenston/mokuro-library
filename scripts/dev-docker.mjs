import { execSync, spawn } from 'node:child_process';

const getCommitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
};

const args = process.argv.slice(2);
const env = { ...process.env, VITE_COMMIT_HASH: getCommitHash() };
const commandArgs = ['-f', 'docker-compose.dev.yml', ...(args.length ? args : ['up'])];
const child = spawn('docker-compose', commandArgs, {
  stdio: 'inherit',
  env
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
