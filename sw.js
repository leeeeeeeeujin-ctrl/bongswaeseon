// 봉쇄선 service worker. Every picture is cached on install, so the game starts complete and runs offline.
// The page: network first (a new build shows at once when online), the cache when offline.
// Pictures and fonts: the cache first (their addresses carry a version, and a new build replaces this whole cache).
const VERSION = "e23cb83ec3ca";
const CACHE = "bsl-" + VERSION;
const CORE = ["./", "index.html", "manifest.webmanifest", "asset_list.json", "fonts/fonts.css", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    const list = await (await fetch("precache.json", { cache: "no-store" })).json();
    // a few at a time, and a picture that fails once is asked for again
    let i = 0;
    const worker = async () => {
      while (i < list.length) {
        const url = list[i++];
        for (let n = 0; n < 3; n++) { try { await c.add(url); break; } catch (e) { await new Promise((r) => setTimeout(r, 400 * (n + 1))); } }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
    ev.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE); c.put("index.html", res.clone());
        return res;
      } catch (e) {
        return (await caches.match("index.html")) || Response.error();
      }
    })());
    return;
  }
  // pictures (a/…?v=…), fonts and the rest: the cached copy, else the network (and keep it)
  ev.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: url.pathname.includes("/a/") });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    return res;
  })());
});
