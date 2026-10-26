// Service worker a mano (mismo patron que frontend-gym y frontend-peluqueria). Toma el control
// apenas se instala (skipWaiting + clients.claim) y sirve las navegaciones
// network-first, asi un reload siempre trae el shell mas nuevo si hay
// conexion -- y si no hay conexion, cae al shell cacheado.
const SHELL_CACHE = "planilla-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("planilla-") && key !== SHELL_CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Solo cachear GET del mismo origen (el shell de la app). Los pedidos al
  // backend (otro origen) siempre van directo a la red, nunca se cachean aca.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
