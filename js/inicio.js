/* Arranque: si el enlace trae ?sala=ABCD, abre directamente "Unirme" */
Referidos.capturar();
S.screen = codigoUrl() ? "onUnirme" : "home";
// Si estaba esperando el correo para entrar (por ejemplo, salió de la app a mirar el mail), vuelve a esa pantalla
if (S.screen === "home" && UI.mailEnviado && !BD.sesion()) S.screen = "cuenta";
render();
Nube.iniciar();

/* App instalada en un iPhone con muesca o isla: mínimo de espacio arriba por si el teléfono lo informa en 0 */
if ((navigator.standalone || matchMedia("(display-mode: standalone)").matches) && /iPhone/.test(navigator.userAgent) && Math.max(screen.height, screen.width) >= 812)
  document.documentElement.style.setProperty("--sat-min", Math.max(screen.height, screen.width) >= 852 ? "54px" : "47px");

/* Sin zoom en ningún juego: ni pellizcando ni con doble toque (iOS ignora user-scalable=no, por eso también se frena acá) */
["gesturestart", "gesturechange", "gestureend"].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
document.addEventListener("touchmove", e => { if (e.scale !== undefined && e.scale !== 1) e.preventDefault(); }, { passive: false });

/* Instalable como app (pantalla completa, ícono en el inicio del teléfono). Solo en la página publicada (https). */
if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|artifact/.test(location.hostname)) navigator.serviceWorker.register("sw.js").catch(() => {});

/* Los gráficos de la Arena (PixiJS) se bajan en segundo plano, así ya están para la primera pelea */
setTimeout(() => { try { if (ArenaPixi.quiere()) { ArenaPixi.cargar(); ArenaPixi.cargarImagenes(); } } catch {} }, 5000);
