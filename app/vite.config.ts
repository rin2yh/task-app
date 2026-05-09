import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import { inertiaPages } from '@hono/inertia/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    inertiaPages({
      pagesDir: 'pages',
      outFile: 'pages.gen.ts',
    }),
    cloudflare({
      configPath: './wrangler.toml',
    }),
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
  ],
  build: {
    target: 'es2022',
  },
  resolve: {
    alias: {
      '@': dir,
      '@server': path.resolve(dir, 'server'),
      '@client': path.resolve(dir, 'client'),
      '@shared': path.resolve(dir, 'shared'),
    },
  },
});
