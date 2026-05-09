import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import { inertiaPages } from '@hono/inertia/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function ssrManifestInject(): Plugin {
  const PLACEHOLDER = '"__VITE_MANIFEST_CONTENT__"';
  let clientOutDir = path.resolve(dir, 'dist/client');
  let searchRoot = path.resolve(dir, 'dist');
  return {
    name: 'ssr-manifest-inject',
    apply: 'build',
    configResolved(config) {
      const clientEnvOutDir = config.environments?.client?.build?.outDir;
      if (clientEnvOutDir) {
        clientOutDir = path.resolve(config.root, clientEnvOutDir);
        searchRoot = path.dirname(clientOutDir);
      }
    },
    closeBundle: {
      sequential: true,
      order: 'post',
      handler() {
        if (this.environment?.name !== 'client') return;
        const manifestPath = path.join(clientOutDir, '.vite/manifest.json');
        let manifestJson: string;
        try {
          manifestJson = readFileSync(manifestPath, 'utf-8');
        } catch {
          return;
        }
        const replacement = `{ "__manifest__": { default: ${manifestJson} } }`;
        const walk = (d: string) => {
          if (path.resolve(d) === clientOutDir) return;
          let entries: string[];
          try {
            entries = readdirSync(d);
          } catch {
            return;
          }
          for (const name of entries) {
            const full = path.join(d, name);
            if (statSync(full).isDirectory()) {
              walk(full);
              continue;
            }
            if (!name.endsWith('.js') && !name.endsWith('.mjs')) continue;
            const code = readFileSync(full, 'utf-8');
            if (!code.includes(PLACEHOLDER)) continue;
            writeFileSync(full, code.replaceAll(PLACEHOLDER, replacement));
          }
        };
        walk(searchRoot);
      },
    },
  };
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
    ssrManifestInject(),
    cloudflare({
      configPath: path.resolve(dir, 'wrangler.toml'),
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
  environments: {
    client: {
      build: {
        manifest: true,
        rollupOptions: {
          input: ['client/client.tsx'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@server': path.resolve(dir, 'server'),
      '@client': path.resolve(dir, 'client'),
      '@shared': path.resolve(dir, 'shared'),
    },
  },
});
