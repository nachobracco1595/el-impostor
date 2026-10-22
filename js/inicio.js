/* Arranque: si el enlace trae ?sala=ABCD, abre directamente "Unirme" */
Referidos.capturar();
S.screen = codigoUrl() ? "onUnirme" : "home";
// Si estaba esperando el correo para entrar (por ejemplo, salió de la app a mirar el mail), vuelve a esa pantalla
if (S.screen === "home" && UI.mailEnviado && !BD.sesion()) S.screen = "cuenta";
render();
Nube.iniciar();

/* Sin zoom en ningún juego: ni pellizcando ni con doble toque (iOS ignora user-scalable=no, por eso también se frena acá) */
["gesturestart", "gesturechange", "gestureend"].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
document.addEventListener("touchmove", e => { if (e.scale !== undefined && e.scale !== 1) e.preventDefault(); }, { passive: false });

/* Instalable como app (pantalla completa, ícono en el inicio del teléfono). Solo en la página publicada (https). */
if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|artifact/.test(location.hostname)) navigator.serviceWorker.register("sw.js").catch(() => {});

/* Los gráficos de la Arena (PixiJS) se bajan en segundo plano, así ya están para la primera pelea */
setTimeout(() => { try { if (ArenaPixi.quiere()) { ArenaPixi.cargar(); ArenaPixi.cargarImagenes(); } } catch {} }, 5000);
