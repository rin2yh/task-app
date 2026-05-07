/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({ cacheName: 'static-assets' }),
);

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    networkTimeoutSeconds: 3,
  }),
);

registerRoute(
  ({ url, request }) =>
    request.method !== 'GET' ||
    url.pathname.startsWith('/projects') ||
    url.pathname.startsWith('/columns') ||
    url.pathname.startsWith('/tasks') ||
    url.pathname.startsWith('/labels') ||
    url.pathname.startsWith('/auth'),
  new NetworkOnly(),
);

self.addEventListener('install', () => {
  // ensure skip waiting
  void self.skipWaiting();
});
