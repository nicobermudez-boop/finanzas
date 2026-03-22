// Self-destructing service worker: clears all caches and unregisters itself.
// Replaces the old caching SW so browsers running the cached version
// pick up this update and stop serving stale content.
// Does NOT reload clients to avoid infinite reload loops.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => self.registration.unregister())
  );
});
