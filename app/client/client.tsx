import { createInertiaApp } from '@inertiajs/react';
import axios from 'axios';
import { hydrateRoot } from 'react-dom/client';
import { registerSW } from './pwa/register';

const csrfMeta = (): string => {
  // CSRF cookie 経由
  const m = document.cookie.match(/(?:^|; )__Host-csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1]!) : '';
};

axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
axios.interceptors.request.use((config) => {
  const token = csrfMeta();
  if (token && config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
    config.headers ??= {};
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

const pages = import.meta.glob('../pages/**/*.tsx', { eager: false });

createInertiaApp({
  resolve: async (name) => {
    const importer = pages[`../pages/${name}.tsx`];
    if (!importer) throw new Error(`Page not found: ${name}`);
    const mod = (await importer()) as { default: React.ComponentType<unknown> };
    return mod.default;
  },
  setup({ el, App, props }) {
    hydrateRoot(el, <App {...props} />);
  },
  progress: { color: '#0ea5e9' },
});

registerSW();
