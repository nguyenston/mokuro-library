import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';

// Check Env Var (Docker) -> Check Git Command (Local) -> Default to 'unknown'
const getVersion = () => {
  // 1. Check if Docker passed it via ENV
  if (process.env.VITE_COMMIT_HASH) {
    return process.env.VITE_COMMIT_HASH;
  }
  // 2. If not, try to get it from local git (for local dev)
  try {
    return execSync('git describe --tags --exact-match HEAD 2>/dev/null || git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
};

const commitHash = getVersion();

// 1. Get the proxy target from an environment variable
//    If it's not set, default to 'http://localhost:3001' for local dev
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3001';
export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
  ],

  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash)
  },
  server: {
    allowedHosts: ["homemachine"],
    proxy: {
      // 2. Proxy all requests starting with /api
      '/api': {
        // 3. Target backend server
        target: proxyTarget,
        // 4. Change origin to match target (for cookie/CORS)
        changeOrigin: true,
      },
    },
  },
});

