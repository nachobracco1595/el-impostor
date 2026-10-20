/* Service worker de Mesa Loca: permite instalarla como app.
   - Lo pesado que no cambia (PixiJS y las librerías de js/vendor, el arte de img/arena) se baja una sola vez:
     después se lee de la caché del teléfono al instante, incluso sin internet.
   - Todo lo demás pide siempre la versión nueva a internet; solo si no hay conexión usa la copia guardada. */
// Si se cambia PixiJS o el arte de img/arena, subir el número de RECURSOS para que los teléfonos bajen lo nuevo
const CACHE = "mesa-loca-v2", RECURSOS = "mesa-loca-recursos-v1";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k !== RECURSOS) await caches.delete(k);
  await self.clients.claim();
})()));
const esRecurso = url => /\/js\/vendor\/|\/img\/arena\//.test(url.pathname);
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // Supabase, PeerJS y fuentes van directo
  if (esRecurso(url)) {
    // Primero la caché; si no está, se baja y se guarda para la próxima
    e.respondWith(caches.open(RECURSOS).then(async c => {
      const guardado = await c.match(req, { ignoreSearch: true });
      if (guardado) return guardado;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
});
