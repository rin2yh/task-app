import { createInertiaApp } from '@inertiajs/react';
import { hydrateRoot } from 'react-dom/client';
import { registerSW } from './pwa/register';
import './styles/tailwind.css';

const pages = import.meta.glob('./pages/**/*.tsx', { eager: false });

createInertiaApp({
  resolve: async (name) => {
    const importer = pages[`./pages/${name}.tsx`];
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
