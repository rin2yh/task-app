import { renderToString } from 'react-dom/server';
import { Link, Script, ViteClient } from 'vite-ssr-components/react';

type Props = {
  page: string;
  manifest?: string;
  pageProps: Record<string, unknown>;
};

export function rootView(props: Props): string {
  const dataPage = JSON.stringify({ component: props.page, props: props.pageProps });
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
        <Link rel="stylesheet" href="/client/styles/tailwind.css" />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased">
        <div id="app" data-page={dataPage} />
        <Script src="/client/client.tsx" type="module" />
      </body>
    </html>,
  );
  return `<!DOCTYPE html>${html}`;
}
