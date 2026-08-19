/* ===========================================================
   BOTÃO DE PÂNICO
   Se o service worker travar seus usuários numa versão velha,
   substitua TODO o conteúdo do sw.js por este arquivo e
   publique. No próximo acesso de cada pessoa ele se desliga,
   apaga o cache e recarrega limpo. Depois de um dia, pode
   apagar o sw.js de vez.
   =========================================================== */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type:"window" })) c.navigate(c.url);
  })());
});
