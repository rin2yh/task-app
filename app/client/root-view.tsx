import { renderToString } from 'react-dom/server';
import { ReactRefresh, Script, ViteClient } from 'vite-ssr-components/react';

interface Page {
  component: string;
  props: Record<string, unknown>;
  url: string;
}

export function rootView(page: Page): string {
  const dataPage = JSON.stringify(page);
  const html = renderToString(
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0ea5e9" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/icon-192.png" />
        <title>Task App</title>
        <ViteClient />
        <ReactRefresh />
      </head>
      <body className="bg-background text-foreground antialiased">
        <div id="app" data-page={dataPage} />
        <Script src="/client/client.tsx" type="module" />
      </body>
    </html>,
  );
  return `<!DOCTYPE html>${html}`;
}
