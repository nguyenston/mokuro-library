import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      fallback: 'index.html' // CRITICAL for SPA mode
    })
  },
  compilerOptions: {
    warningFilter: (warning) => {
      // Disable the specific state_referenced_locally warning
      if (warning.code === 'state_referenced_locally') return false;
      return true;
    }
  }
};

export default config;
