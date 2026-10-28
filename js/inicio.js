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

/* Ofrecer instalar la app: mientras no esté instalada, el inicio muestra un aviso cada vez que se abre.
   Android/Chrome: botón que abre el instalador del teléfono. iPhone: se explica Compartir → "Agregar a inicio" (Apple no deja otro camino). */
const Instalar = {
  ev: null,
  esApp: () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
  ios: () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  enOtraApp: () => /CriOS|FxiOS|EdgiOS|Instagram|FBAN|FBAV|WhatsApp|Line\//.test(navigator.userAgent),
  revisar() {
    const ya = document.getElementById("instalarApp");
    const ver = S.screen === "home" && !this.esApp() && !UI.instalarNo && (location.protocol === "https:" || location.hostname === "localhost") && (this.ev || this.ios());
    if (!ver) { if (ya) ya.remove(); return; }
    if (ya) return;
    const d = document.createElement("div"); d.id = "instalarApp"; d.className = "instalar-app";
    d.innerHTML = `<span class="ia-ic"><img src="img/icono.svg" alt="" width="40" height="40"></span><div><b>Instalá Mesa Loca</b><small>${this.ev ? "Se abre a pantalla completa, más rápida y con su ícono." : this.enOtraApp() ? "Abrí esta página en Safari para instalarla." : "Tocá Compartir y después «Agregar a inicio»."}</small></div>
      <button class="btn chico" id="iaSi">${this.ev ? "Instalar" : "Cómo"}</button><button class="ia-no" id="iaNo" aria-label="Ahora no">✕</button>`;
    document.body.appendChild(d);
    byId("iaNo").onclick = () => { UI.instalarNo = true; d.remove(); };
    byId("iaSi").onclick = async () => {
      if (this.ev) { this.ev.prompt(); try { await this.ev.userChoice; } catch {} this.ev = null; d.remove(); return; }
      const m = document.createElement("div"); m.className = "modal-fondo";
      m.innerHTML = `<div class="modal">${this.pasosIos()}<button class="btn" id="iaOk">Entendido</button></div>`;
      document.body.appendChild(m); m.onclick = e => { if (e.target === m || e.target.id === "iaOk") m.remove(); };
    };
  },
  pasosIos() {
    return `<h2>Instalar en iPhone</h2>${this.enOtraApp() ? `<p class="sub">Estás dentro de otra app (WhatsApp, Instagram, Chrome…). Primero abrí esta página en <b>Safari</b>.</p>` : ""}
      <ol class="ia-pasos"><li>Tocá <b>Compartir</b> <span class="ia-sh"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 11v9h14v-9"/></svg></span> (abajo en Safari, o arriba a la derecha).</li><li>Bajá y tocá <b>«Agregar a inicio»</b>.</li><li>Tocá <b>Agregar</b>. ¡Listo! Abrila desde el ícono de Mesa Loca.</li></ol>`;
  }
};
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); Instalar.ev = e; Instalar.revisar(); });
window.addEventListener("appinstalled", () => { Instalar.ev = null; Instalar.revisar(); });
{ const r0 = render; render = function () { const x = r0.apply(this, arguments); try { Instalar.revisar(); } catch {} return x; }; }
Instalar.revisar();
