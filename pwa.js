/* Registra o service worker único (na raiz) e controla o botão "Instalar app". */
(function () {
  const swUrl = new URL('../sw.js', document.currentScript.src);
  if ('serviceWorker' in navigator)
    addEventListener('load', () => navigator.serviceWorker.register(swUrl).catch(() => {}));
  let evt = null;
  const btn = () => document.getElementById('instalar');
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); evt = e; if (btn()) btn().hidden = false; });
  addEventListener('appinstalled', () => { if (btn()) btn().hidden = true; });
  addEventListener('DOMContentLoaded', () => {
    if (btn()) btn().onclick = async () => { if (!evt) return; evt.prompt(); await evt.userChoice; evt = null; btn().hidden = true; };
  });
})();
