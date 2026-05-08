/// <reference lib="webworker" />

type WBManifestEntry = { url: string; revision: string | null };
type SWGlobalScope = ServiceWorkerGlobalScope & { __WB_MANIFEST: WBManifestEntry[] };
const sw = globalThis as unknown as SWGlobalScope;

const PRECACHE = 'precache-v1';
const PAGES_CACHE = 'pages-v1';
const STATIC_CACHE = 'static-assets-v1';

// vite-plugin-pwa が `self.__WB_MANIFEST` リテラルを置換するためここで参照する
const PRECACHE_URLS = (self as unknown as SWGlobalScope).__WB_MANIFEST.map((e) => e.url);

const NETWORK_ONLY_PREFIXES = ['/projects', '/columns', '/tasks', '/labels', '/auth'];
const STATIC_DESTINATIONS = new Set(['style', 'script', 'font']);

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((c) => c.addAll(PRECACHE_URLS))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![PRECACHE, PAGES_CACHE, STATIC_CACHE].includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (NETWORK_ONLY_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, 3000));
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(
  request: Request,
  cacheName: string,
  timeoutMs: number,
): Promise<Response> {
  const cache = await caches.open(cacheName);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('network timeout')), timeoutMs);
      }),
    ]);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('network and cache both failed');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
