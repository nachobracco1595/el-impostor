/* Base de la app: estado, utilidades, cronómetro, inicio y configuración */
const app = document.getElementById("app");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const byId = id => document.getElementById(id);
const on = (id, fn) => { const el = byId(id); if (el) el.onclick = fn; };

const store = {
  get(k, d) { try { const v = localStorage.getItem("impostor:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("impostor:" + k, JSON.stringify(v)); } catch {} }
};

const S = {
  screen: "home",
  players: store.get("players", ["Ana", "Bruno", "Carla", "Diego"]),
  themes: store.get("themes", ["Cine", "Series", "Dibujos animados", "Vehículos"]).filter(t => TEMAS[t]),
  cfg: Object.assign({ impostors: 1, hint: true, complice: false, infiltrado: false, bufon: false, allImp: false, noImp: false, minutes: 3 }, store.get("cfg", {})),
  used: store.get("used", []),
  casoCfg: Object.assign({ min: 5, soplon: false }, store.get("casoCfg", {})),
  casoId: store.get("casoId", "collar"),
  caso: null,         // partida local de detectives
  mode: "impostor",   // juego elegido para el flujo local: impostor | liars | casos
  online: false,      // true cuando la configuración se edita para una sala online
  game: null,         // partida local del impostor
  lie: null           // partida local del mentiroso
};
const save = () => { store.set("players", S.players); store.set("themes", S.themes); store.set("cfg", S.cfg); };

const PANTALLAS = {};
function render() {
  if (!S.online && !(typeof Net !== "undefined" && Net.activo())) fijarColores(S.players);
  (PANTALLAS[S.screen] || PANTALLAS.home)();
  if (typeof Sonido !== "undefined") Sonido.trasRender(); }
let animT = null;
function go(s) {
  S.screen = s;
  app.classList.remove("entra"); void app.offsetWidth; app.classList.add("entra");
  clearTimeout(animT); animT = setTimeout(() => app.classList.remove("entra"), 450);
  render(); window.scrollTo(0, 0);
}

const head = (step, back = true) => `<header class="top">
  <button class="logo" id="home" aria-label="Volver al inicio">El <span>Impostor</span></button>
  ${step ? `<div class="steps" aria-label="Paso ${step} de 3">${[1, 2, 3].map(i => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>` : ""}
</header>`;
document.addEventListener("click", e => {
  if (e.target.closest("#home")) { if (typeof Net !== "undefined" && Net.activo()) return go("online"); go("home"); }
});

/* ---------- Sonido, vibración y pantalla encendida ---------- */
let audioCtx = null;
function beep(times = 3, freq = 880) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + i * 0.35;
      o.frequency.value = freq; o.type = "square"; g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.3);
    }
  } catch {}
  try { navigator.vibrate && navigator.vibrate(times > 1 ? [300, 150, 300, 150, 300] : 80); } catch {}
}
function bang() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const len = audioCtx.sampleRate * 0.5, buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = audioCtx.createBufferSource(), g = audioCtx.createGain();
    src.buffer = buf; g.gain.value = 0.8; src.connect(g).connect(audioCtx.destination); src.start();
  } catch {}
  try { navigator.vibrate && navigator.vibrate(600); } catch {}
}
function click() { beep(1, 220); }
async function keepAwake() { try { await navigator.wakeLock.request("screen"); } catch {} }

/* ---------- Cronómetro: estado {total, running, remaining, endsAt} en segundos/ms ---------- */
const Reloj = {
  nuevo: min => ({ total: min * 60, running: false, remaining: min * 60 * 1000, endsAt: 0 }),
  ms: t => t.running ? Math.max(0, t.endsAt - Date.now()) : t.remaining,
  start(t) { if (this.ms(t) <= 0) t.remaining = t.total * 1000; t.running = true; t.endsAt = Date.now() + t.remaining; },
  pause(t) { t.remaining = this.ms(t); t.running = false; },
  reset(t) { t.running = false; t.remaining = t.total * 1000; },
  /* ms = milisegundos restantes vistos por este teléfono */
  html(ms, running, total) {
    return `<div><div class="clock" data-fin="${Date.now() + ms}" data-run="${running ? 1 : 0}" data-total="${total}">${fmt(Math.ceil(ms / 1000))}</div>
      <div class="bar"><i style="width:${total ? (ms / 1000 / total) * 100 : 0}%"></i></div></div>`;
  }
};
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
setInterval(() => {
  document.querySelectorAll(".clock[data-run='1']").forEach(el => {
    const ms = Math.max(0, +el.dataset.fin - Date.now()), s = Math.ceil(ms / 1000), total = +el.dataset.total;
    el.textContent = fmt(s);
    el.classList.toggle("low", s <= 10 && s > 0);
    el.classList.toggle("done", s === 0);
    const bar = el.parentElement.querySelector(".bar i"); if (bar) bar.style.width = (ms / 1000 / total) * 100 + "%";
    if (s === 0 && !el.dataset.beeped) { el.dataset.beeped = 1; beep(); }
    if (s > 0 && s <= 10 && el.dataset.ultimo !== String(s)) { el.dataset.ultimo = s; if (typeof Sonido !== "undefined") Sonido.sfx("tic"); }
  });
}, 250);

/* ---------- Inicio ---------- */
PANTALLAS.home = () => {
  app.innerHTML = `
  <section class="screen hero">
    ${grupoPortada()}
    <h1 class="titulo">El <span>Impostor</span></h1>
    <p class="sub center">Juegos para la previa con amigos. En un solo teléfono o cada uno en el suyo.</p>
  </section>
  <section class="juegos">
    <article class="juego">
      <div class="juego-art">${personaje("#ff4d63", "imp", 70)}</div>
      <div class="juego-txt"><h2>El Impostor</h2><p>Todos conocen la palabra secreta menos el impostor. Descúbranlo antes de que se escape.</p></div>
      <div class="juego-acc"><button class="btn" id="localImp">Jugar en este teléfono</button></div>
    </article>
    <article class="juego">
      <div class="juego-art cartas-mini">${carta("K")}${carta("J")}${tambor(0, { size: 54 })}</div>
      <div class="juego-txt"><h2>Mesa del Mentiroso</h2><p>Tira cartas boca abajo y miente con cara de póker. Al que pillan, gira el tambor del revólver.</p></div>
      <div class="juego-acc"><button class="btn" id="localLie">Jugar en este teléfono</button></div>
    </article>
    <article class="juego detective">
      <div class="juego-art">${personaje("#e8e8e8", "civ", 70, ["sombrero", "lupa"])}</div>
      <div class="juego-txt"><h2>Detectives</h2><p>${CASOS.length} casos con sospechosos, pruebas y testimonios. Cada uno tiene pistas secretas: debatan y arresten al culpable.</p></div>
      <div class="juego-acc"><button class="btn" id="localCas">Jugar en este teléfono</button></div>
    </article>
    <article class="juego online">
      <div class="juego-txt"><h2>Jugar online</h2><p>Cada uno desde su teléfono, estén donde estén. Uno crea la sala y les pasa el código a los demás.</p></div>
      <div class="juego-acc row"><button class="btn" id="crear">Crear sala</button><button class="btn ghost" id="unirme">Unirme</button></div>
    </article>
  </section>`;
  on("localImp", () => { S.mode = "impostor"; S.online = false; go("players"); });
  on("localLie", () => { S.mode = "liars"; S.online = false; go("players"); });
  on("localCas", () => { S.mode = "casos"; S.online = false; go("players"); });
  on("crear", () => go("onCrear"));
  on("unirme", () => go("onUnirme"));
};

/* ---------- Jugadores (modo local) ---------- */
const minJug = () => S.mode === "impostor" ? 3 : 2;
PANTALLAS.players = () => {
  const n = S.players.length, min = minJug();
  app.innerHTML = `${head(1)}
  <section class="screen">
    <div><h2>¿Quiénes juegan?</h2><p class="sub">Mínimo ${min} jugadores${S.mode !== "impostor" ? ", máximo 8" : ""}. El orden de la lista es el orden de la ronda.</p></div>
    <form class="add" id="addf"><input id="pname" maxlength="16" placeholder="Nombre del jugador" autocomplete="off" aria-label="Nombre del jugador"><button type="submit" aria-label="Agregar jugador">+</button></form>
    <div class="panel">
      <div class="headrow"><span class="label">${n} jugador${n === 1 ? "" : "es"}</span>${n ? `<button class="linkish" id="clr">Borrar todos</button>` : ""}</div>
      ${n ? `<ul class="players">${S.players.map((p, i) => `<li>${avatar(p, 38, "civ", S.mode === "casos" ? ["sombrero"] : [])}<span class="name">${esc(p)}</span><button class="x" data-del="${i}" aria-label="Quitar a ${esc(p)}">×</button></li>`).join("")}</ul>` : `<p class="empty">Todavía no hay nadie. Escribe un nombre y toca +.</p>`}
    </div>
    <div class="row"><button class="btn ghost" id="back">Inicio</button><button class="btn" id="next" ${n < min || (S.mode !== "impostor" && n > 8) ? "disabled" : ""}>${S.mode === "liars" ? "¡A la mesa!" : S.mode === "casos" ? "Elegir caso" : "Elegir temas"}</button></div>
  </section>`;
  const inp = byId("pname");
  byId("addf").onsubmit = e => {
    e.preventDefault();
    const v = inp.value.trim();
    if (!v) return;
    if (S.players.some(p => p.toLowerCase() === v.toLowerCase())) { inp.value = ""; inp.placeholder = "Ese nombre ya está"; return; }
    S.players.push(v); save(); render(); byId("pname").focus();
  };
  app.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { S.players.splice(+b.dataset.del, 1); save(); render(); });
  on("clr", () => { S.players = []; save(); render(); });
  on("back", () => go("home"));
  on("next", () => S.mode === "liars" ? Lie.empezarLocal() : S.mode === "casos" ? go("casoSel") : go("themes"));
};

/* ---------- Temas ---------- */
PANTALLAS.themes = () => {
  const all = Object.keys(TEMAS), allOn = S.themes.length === all.length;
  app.innerHTML = `${head(S.online ? 0 : 2)}
  <section class="screen">
    <div><h2>Elige los temas</h2><p class="sub">La palabra secreta sale al azar de los temas marcados.</p></div>
    <div class="panel">
      <div class="headrow"><span class="label">${S.themes.length} de ${all.length} temas</span><button class="linkish" id="all">${allOn ? "Quitar todos" : "Marcar todos"}</button></div>
      <div class="temas">${all.map(t => `<button class="tema" aria-pressed="${S.themes.includes(t)}" data-t="${esc(t)}"><span class="te">${TEMA_EMOJI[t]}</span><span class="tn">${esc(t)}</span><span class="c">${TEMAS[t].length} palabras</span></button>`).join("")}</div>
    </div>
    <div class="row"><button class="btn ghost" id="back">Atrás</button><button class="btn" id="next" ${S.themes.length ? "" : "disabled"}>Siguiente</button></div>
  </section>`;
  app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => {
    const t = b.dataset.t;
    S.themes = S.themes.includes(t) ? S.themes.filter(x => x !== t) : [...S.themes, t];
    save(); render();
  });
  on("all", () => { S.themes = allOn ? [] : all.slice(); save(); render(); });
  on("back", () => go(S.online ? "online" : "players"));
  on("next", () => go("config"));
};

/* ---------- Reglas del impostor ---------- */
const nJug = () => S.online ? Net.cantidad() : S.players.length;
const maxImp = n => Math.max(1, Math.floor((n - 1) / 2));
const extras = c => ["complice", "infiltrado", "bufon"].filter(k => c[k]).length;
function validaImp(n, c) {
  const civ = n - Math.min(c.impostors, maxImp(n)) - extras(c);
  if (n < 3) return { ok: false, msg: "Hacen falta al menos 3 jugadores." };
  if (civ < 2) return { ok: false, msg: "Con estos roles quedan menos de 2 inocentes. Quita un rol extra o un impostor, o sumen jugadores." };
  return { ok: true, civ };
}

PANTALLAS.config = () => {
  const n = nJug(), c = S.cfg;
  c.impostors = Math.max(1, Math.min(c.impostors, maxImp(n)));
  const val = validaImp(n, c);
  const sw = (k, title, desc) => `<div class="opt"><div class="txt"><b>${title}</b><small>${desc}</small></div><button class="switch" role="switch" aria-checked="${!!c[k]}" data-sw="${k}" aria-label="${title}"></button></div>`;
  app.innerHTML = `${head(S.online ? 0 : 3)}
  <section class="screen">
    <div><h2>Reglas de la partida</h2><p class="sub">${n} jugadores · ${S.themes.length} tema${S.themes.length === 1 ? "" : "s"}</p></div>
    <div class="panel">
      <div class="stepper"><div class="txt"><b>Impostores</b><small>Máximo ${maxImp(n)} con ${n} jugadores</small></div>
        <div class="ctl"><button id="minus" aria-label="Menos impostores" ${c.impostors <= 1 ? "disabled" : ""}>−</button><output>${c.impostors}</output><button id="plus" aria-label="Más impostores" ${c.impostors >= maxImp(n) ? "disabled" : ""}>+</button></div></div>
      ${sw("hint", "Pista para el impostor", "El impostor ve una palabra relacionada para poder disimular.")}
    </div>
    <div class="panel">
      <span class="label">Rondas sorpresa</span>
      ${sw("allImp", "Todos pueden ser impostores", "De vez en cuando, todos reciben la carta de impostor. Nadie sabe quiénes son sus compañeros.")}
      ${sw("noImp", "Todos pueden ser inocentes", "De vez en cuando no hay ningún impostor y todos tienen la misma palabra.")}
    </div>
    <div class="panel">
      <span class="label">Roles extra (opcionales)</span>
      ${sw("complice", "Cómplice", "Conoce la palabra y sabe quién es el impostor. Gana si gana el impostor.")}
      ${sw("infiltrado", "Infiltrado", "Recibe otra palabra del mismo tema y no sabe que es distinta. Juega con los inocentes.")}
      ${sw("bufon", "Bufón", "Conoce la palabra. Gana solo si el grupo lo expulsa a él.")}
    </div>
    <div class="panel">
      <span class="label">Cronómetro de debate</span>
      <div class="seg">${[0, 1, 2, 3, 5].map(m => `<button aria-pressed="${c.minutes === m}" data-min="${m}">${m ? m + " min" : "Sin"}</button>`).join("")}</div>
    </div>
    ${val.ok ? `<p class="summary">Habrá <b>${val.civ} inocente${val.civ === 1 ? "" : "s"}</b>, <b>${c.impostors} impostor${c.impostors > 1 ? "es" : ""}</b>${extras(c) ? ` y <b>${extras(c)} rol${extras(c) > 1 ? "es" : ""} extra</b>` : ""}.</p>` : `<p class="warn">${val.msg}</p>`}
    <div class="row"><button class="btn ghost" id="back">Atrás</button>${S.online ? `<button class="btn" id="sala">Volver a la sala</button>` : `<button class="btn" id="start" ${val.ok ? "" : "disabled"}>¡Repartir!</button>`}</div>
  </section>`;
  on("minus", () => { c.impostors--; save(); render(); });
  on("plus", () => { c.impostors++; save(); render(); });
  app.querySelectorAll("[data-sw]").forEach(b => b.onclick = () => { c[b.dataset.sw] = !c[b.dataset.sw]; save(); render(); });
  app.querySelectorAll("[data-min]").forEach(b => b.onclick = () => { c.minutes = +b.dataset.min; save(); render(); });
  on("back", () => go("themes"));
  on("start", () => ImpLocal.nueva());
  on("sala", () => { Net.cfgCambiada(); go("online"); });
};
