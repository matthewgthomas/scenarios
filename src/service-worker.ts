/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `scenario-designer-${version}`;
const root = new URL('./', worker.location.href).pathname;
const assets = new Set([...build, ...files, root]);

worker.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await cache.addAll([...assets]);
      await worker.skipWaiting();
    })()
  );
});
worker.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('scenario-designer-') && key !== cacheName) await caches.delete(key);
      await worker.clients.claim();
    })()
  );
});
worker.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Never cache credentials, model responses or any cross-origin requests.
  if (request.method !== 'GET' || url.origin !== worker.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);
      if (assets.has(url.pathname) && request.mode !== 'navigate') {
        const cached = await cache.match(request);
        if (cached) return cached;
      }
      try {
        return await fetch(request);
      } catch (error) {
        const cached = await cache.match(request.mode === 'navigate' ? root : request);
        if (cached) return cached;
        throw error;
      }
    })()
  );
});
