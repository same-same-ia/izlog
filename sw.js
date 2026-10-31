/* IMM izlog service worker: cache-first, fully-offline board.
   The cache name is stamped at build time from a content hash of the built page and
   its voice banks, so every rebuild rolls the cache; activate deletes the old one.
   The default voice is precached with the code; any other voice is cached the first
   time the page fetches it, so a voice chosen once works offline afterwards. */
var CACHE = 'imm-izlog-1cdb701a71e8';
var ASSETS = ['./', './index.html', './manifest.json',
              './icon-192.png', './icon-512.png', './icon-180.png',
              './glasovi/ST.json'];
var BANK = /\/glasovi\/[^\/]+\.json$/;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        // Through the network, not the HTTP cache: Pages sends max-age=600, so a plain
        // addAll within ten minutes of a visit could store the OLD files under the NEW name.
        return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                               .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (r) {
      if (r) return r;
      if (!BANK.test(new URL(e.request.url).pathname)) return fetch(e.request);
      // A voice's bank: keep it once it has arrived whole (cache-on-fetch). The page is
      // answered only after the put, so a voice that played is a voice that is stored --
      // unless the put itself fails (quota, a cache gone): then the bank that DID arrive
      // still reaches the page, it is only not kept for offline.
      // Through the network, not the HTTP cache, for the reason install gives: a bank
      // fetched within max-age of an older visit would be stored stale under the new name.
      return fetch(new Request(e.request, { cache: 'reload' })).then(function (resp) {
        if (!resp.ok) return resp;
        var copy = resp.clone();
        return caches.open(CACHE)
          .then(function (c) { return c.put(e.request, copy); })
          .catch(function () {})
          .then(function () { return resp; });
      });
    })
  );
});
