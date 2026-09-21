import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig(({ mode }) => {
  const sveltePlugins = svelte({
    hot: !mode || mode === 'test' ? false : true,
    emitCss: false,
    compilerOptions: {
      dev: false
    },
    onwarn: () => {}
  });
  const pluginList = Array.isArray(sveltePlugins) ? sveltePlugins : [sveltePlugins];
  const plugins =
    mode === 'test'
      ? pluginList.filter(
          (plugin) =>
            plugin.name !== 'vite-plugin-svelte:hot-update' &&
            plugin.name !== 'vite-plugin-svelte:load-custom' &&
            plugin.name !== 'vite-plugin-svelte:load-compiled-css'
        )
      : pluginList;

  return {
    plugins,
    resolve: {
      alias: {
        $lib: path.resolve('./src/lib'),
        $app: path.resolve('./node_modules/@sveltejs/kit/src/runtime/app')
      },
      conditions: ['browser']
    },
    server: {
      middlewareMode: false,
      hmr: false
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/__tests__/**/*.test.ts'],
      setupFiles: ['src/vitest.setup.ts']
    }
  };
});
