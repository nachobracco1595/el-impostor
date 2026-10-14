/* Arranque: si el enlace trae ?sala=ABCD, abre directamente "Unirme" */
S.screen = codigoUrl() ? "onUnirme" : "home";
render();
Nube.iniciar();

/* Instalable como app (pantalla completa, ícono en el inicio del teléfono). Solo en la página publicada (https). */
if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|artifact/.test(location.hostname)) navigator.serviceWorker.register("sw.js").catch(() => {});
