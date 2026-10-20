/* Arranque: si el enlace trae ?sala=ABCD, abre directamente "Unirme" */
Referidos.capturar();
S.screen = codigoUrl() ? "onUnirme" : "home";
// Si estaba esperando el correo para entrar (por ejemplo, salió de la app a mirar el mail), vuelve a esa pantalla
if (S.screen === "home" && UI.mailEnviado && !BD.sesion()) S.screen = "cuenta";
render();
Nube.iniciar();

/* Instalable como app (pantalla completa, ícono en el inicio del teléfono). Solo en la página publicada (https). */
if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|artifact/.test(location.hostname)) navigator.serviceWorker.register("sw.js").catch(() => {});

/* Los gráficos de la Arena (PixiJS) se bajan en segundo plano, así ya están para la primera pelea */
setTimeout(() => { try { ArenaPixi.cargar(); } catch {} }, 5000);
