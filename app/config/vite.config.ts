import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import { inertiaPages } from '@hono/inertia/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import ssrPlugin from 'vite-ssr-components/plugin';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// VitePWA's config() returns { ssr: { noExternal: ['workbox-window'] } }, which
// makes Vite materialize an `ssr` environment that breaks vite-ssr-components'
// clientFirstBuild. We don't import workbox-window, so drop that field.
function pwaWithoutSsr(plugins: ReturnType<typeof VitePWA>): Plugin[] {
  return (plugins as Plugin[]).map((p) => {
    if (p.name !== 'vite-plugin-pwa' || typeof p.config !== 'function') return p;
    const original = p.config;
    return {
      ...p,
      config(...args: Parameters<typeof original>) {
        const result = original.apply(this, args);
        if (result && typeof result === 'object' && 'ssr' in result) {
          const { ssr: _drop, ...rest } = result as Record<string, unknown>;
          return rest;
        }
        return result;
      },
    };
  });
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
    tailwindcss(),
    inertiaPages({
      pagesDir: 'client/pages',
      outFile: 'pages.gen.ts',
    }),
    cloudflare({
      configPath: path.resolve(dir, 'wrangler.toml'),
    }),
    ssrPlugin(),
    pwaWithoutSsr(
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'client/pwa',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: false,
        manifest: {
          name: 'My Task App',
          short_name: 'TaskApp',
          description: 'GitHub Projects 風カンバンタスク管理',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#0ea5e9',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        },
        devOptions: { enabled: true, type: 'module' },
      }),
    ),
  ],
  build: {
    target: 'es2022',
  },
  resolve: {
    alias: {
      '@server': path.resolve(dir, 'server'),
      '@client': path.resolve(dir, 'client'),
      '@shared': path.resolve(dir, 'shared'),
    },
  },
});
