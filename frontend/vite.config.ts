import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
  ],
  server: {
    proxy: {
      // 2. Proxy all requests starting with /api
      '/api': {
        // 3. Target your backend server
        target: 'http://localhost:3001',
        // 4. Change origin to match target (for cookie/CORS)
        changeOrigin: true,
      },
    },
  },
});
