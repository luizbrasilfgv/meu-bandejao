/* ===========================================================
   <APP> — service worker
   Faz o app abrir sem internet.
   EDITE DUAS LISTAS: CASCO e SEMPRE_REDE.
   =========================================================== */

/* SUBA ESTE NÚMERO A CADA PUBLICAÇÃO. É ele que descarta o
   cache antigo — sem isso a pessoa fica presa numa versão. */
const VERSAO = "app-v1";

/* O casco: sem estes arquivos o app não abre. */
const CASCO = [
  "./", "./index.html", "./styles.css", "./app.js",
  "./data.js", "./manifest.json", "./icon-192.png"
];

/* Domínios que NUNCA podem vir do cache: precisam de rede de
   verdade (login, gravação, sua API ao vivo). */
const SEMPRE_REDE = [
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com"
  // acrescente aqui a API do seu app, se houver
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSAO)
      // um a um: addAll falha o conjunto inteiro se UM arquivo der 404
      .then(c => Promise.all(CASCO.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (SEMPRE_REDE.some(d => url.hostname.endsWith(d))) return;   // passa direto

  if (req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(r => { guardar(req, r.clone()); return r; })
        .catch(() => caches.match("./index.html", { ignoreSearch:true })
                        .then(r => r || caches.match("./")))
    );
    return;
  }

  /* ignoreSearch:true faz o ?v=N dos assets não invalidar o cache */
  e.respondWith(
    caches.match(req, { ignoreSearch:true }).then(cacheado => {
      const rede = fetch(req)
        .then(r => { if (r && r.status === 200) guardar(req, r.clone()); return r; })
        .catch(() => cacheado);
      return cacheado || rede;
    })
  );
});

function guardar(req, resp){
  const u = new URL(req.url);
  if (u.origin !== self.location.origin && !u.hostname.endsWith("gstatic.com")) return;
  caches.open(VERSAO).then(c => c.put(req, resp)).catch(() => {});
}
