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
  chCfg: Object.assign({ comodines: true, con89: true, cpus: 1 }, store.get("chCfg", {})),
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
  if (typeof Cuenta !== "undefined") Cuenta.prepararLooks();
  if (!S.online && !(typeof Net !== "undefined" && Net.activo())) fijarColores(S.players);
  (PANTALLAS[S.screen] || PANTALLAS.home)();
  if (typeof Cuenta !== "undefined") Cuenta.revisar();
  if (typeof Sonido !== "undefined") Sonido.trasRender();
  if (typeof revisarDiario !== "undefined") revisarDiario();
  if (typeof Chat !== "undefined") Chat.pintar();
  if (typeof Social !== "undefined" && Social.disponible()) Social.arrancar(); }
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
/* Juegos del menú: [modo, nombre, descripción, arte, clase] */
function juegosMenu() {
  return [
    ["impostor", "El Impostor", "Todos saben la palabra menos uno.", personaje("#ff4d63", "imp", 64), "t-imp"],
    ["liars", "Mesa del Mentiroso", "Miente con las cartas o gatilla.", `<span class="cartas-mini">${carta("K")}${carta("J")}</span>`, "t-lie"],
    ["casos", "Detectives", `${CASOS.length} casos para resolver en grupo.`, personaje("#e8e8e8", "civ", 64, ["sombrero", "lupa"]), "t-cas"],
    ["chinchon", "Chinchón", "Escaleras, grupos y a cortar.", `<span class="ce-mini">${Chin.carta("O1")}${Chin.carta("E7")}</span>`, "t-chi"],
    ["naval", "Batalla naval", "Tocado… ¡y hundido!", `<span class="naval-mini">${"<i></i>".repeat(9)}</span>`, "t-nav"],
    ["nave", "La Nave", "Tareas, impostores y votación.", `<span class="nave-mini">🚀</span>`, "t-nave"],
    ["ajedrez", "Ajedrez", "Contra la compu o un amigo.", `<span class="aj-mini"><span class="pieza w">♚</span><span class="pieza b">♞</span></span>`, "t-aj"]
  ];
}

PANTALLAS.home = () => {
  app.innerHTML = `${Cuenta.barra()}
  <section class="screen hero">
    ${grupoPortada()}
    <h1 class="titulo">El <span>Impostor</span></h1>
    <p class="sub center">Juegos para la previa con amigos. En un solo teléfono o cada uno en el suyo.</p>
  </section>
  <section class="juegos-grid">${juegosMenu().map(([m, n, d, art, cls]) => `<button class="tile ${cls}" data-modo="${m}">
      <span class="tile-art">${art}</span><b>${n}</b><small>${d}</small><span class="tile-cta">Jugar</span></button>`).join("")}</section>
  <article class="juego online">
    <div class="juego-txt"><h2>Jugar online</h2><p>Cada uno desde su teléfono, estén donde estén. Uno crea la sala y les pasa el código a los demás.</p></div>
    <div class="juego-acc row"><button class="btn" id="crear">Crear sala</button><button class="btn ghost" id="unirme">Unirme</button></div>
  </article>`;
  app.querySelectorAll("[data-modo]").forEach(b => b.onclick = () => {
    S.mode = b.dataset.modo; S.online = false;
    if (S.mode === "nave") return go("naveIntro");
    go(S.mode === "ajedrez" || S.mode === "naval" ? "duelo" : "players");
  });
  Cuenta.conectarBarra();
  on("crear", () => go("onCrear"));
  on("unirme", () => go("onUnirme"));
};

/* ---------- Duelo (ajedrez y batalla naval): quién contra quién ---------- */
const CPU_NOMBRES = ["🤖 Rita", "🤖 Tito", "🤖 Pepa"];
PANTALLAS.duelo = () => {
  const aj = S.mode === "ajedrez";
  const rivalesCpu = aj ? [["cpu-facil", "🤖 Compu fácil"], ["cpu-dificil", "🤖 Compu difícil"]] : [["cpu", "🤖 Compu"]];
  const d = UI.duelo = UI.duelo && UI.duelo.modo === S.mode ? UI.duelo : { modo: S.mode, a: S.players[0] || "", b: rivalesCpu[0][0] };
  if (!S.players.includes(d.a)) d.a = S.players[0] || "";
  if (d.b === d.a || (!d.b.startsWith("cpu") && !S.players.includes(d.b))) d.b = rivalesCpu[0][0];
  const chip = (campo, val, txt, art) => `<button class="chip-j ${d[campo] === val ? "on" : ""}" data-campo="${campo}" data-val="${esc(val)}" aria-pressed="${d[campo] === val}">${art}${esc(txt)}</button>`;
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>${aj ? "Ajedrez" : "Batalla naval"}</h2><p class="sub">Elige quién juega y contra quién.</p></div>
    <div class="panel"><span class="label">${aj ? "Juega con blancas" : "Jugador 1"}</span>
      ${S.players.length ? `<div class="chips-j">${S.players.map(n => chip("a", n, n, avatar(n, 26))).join("")}</div>` : `<p class="empty">Agrega jugadores en la lista.</p>`}</div>
    <div class="panel"><span class="label">${aj ? "Rival (negras)" : "Rival"}</span>
      <div class="chips-j">${rivalesCpu.map(([v, t]) => chip("b", v, t, "")).join("")}${S.players.filter(n => n !== d.a).map(n => chip("b", n, n, avatar(n, 26))).join("")}</div>
      <p class="summary">${d.b.startsWith("cpu") ? "Juegas contra la computadora en este teléfono." : aj ? "Dos personas en el mismo teléfono: se van turnando." : "Dos personas: se pasan el teléfono en cada turno para no ver la flota del otro."}</p></div>
    <div class="row"><button class="btn ghost" id="lista">Editar jugadores</button><button class="btn" id="go" ${d.a ? "" : "disabled"}>¡A jugar!</button></div>
    <button class="linkish" id="back">Inicio</button>
  </section>`;
  app.querySelectorAll("[data-campo]").forEach(b => b.onclick = () => { d[b.dataset.campo] = b.dataset.val; render(); });
  on("lista", () => go("players"));
  on("back", () => go("home"));
  on("go", () => {
    const A = { id: "p0", name: d.a };
    const B = d.b.startsWith("cpu") ? { id: "p1", name: aj ? (d.b === "cpu-dificil" ? "🤖 Compu difícil" : "🤖 Compu fácil") : "🤖 Compu", cpu: true, nivel: d.b === "cpu-dificil" ? "dificil" : "facil" } : { id: "p1", name: d.b };
    aj ? Ajedrez.empezarLocal([A, B]) : Naval.empezarLocal([A, B]);
  });
};

/* ---------- Jugadores (modo local) ---------- */
const minJug = () => S.mode === "impostor" ? 3 : ["chinchon", "ajedrez", "naval"].includes(S.mode) ? 1 : 2;
PANTALLAS.players = () => {
  const n = S.players.length, min = minJug();
  app.innerHTML = `${head(1)}
  <section class="screen">
    <div><h2>¿Quiénes juegan?</h2><p class="sub">${S.mode === "chinchon" ? "Las personas que juegan; abajo puedes sumar compus." : `Mínimo ${min} jugadores${S.mode !== "impostor" ? ", máximo 8" : ""}.`} El orden de la lista es el orden de la ronda.</p></div>
    <form class="add" id="addf"><input id="pname" maxlength="16" placeholder="Nombre del jugador" autocomplete="off" aria-label="Nombre del jugador"><button type="submit" aria-label="Agregar jugador">+</button></form>
    <div class="panel">
      <div class="headrow"><span class="label">${n} jugador${n === 1 ? "" : "es"}</span>${n ? `<button class="linkish" id="clr">Borrar todos</button>` : ""}</div>
      ${n ? `<ul class="players">${S.players.map((p, i) => `<li>${avatar(p, 38, "civ", S.mode === "casos" ? ["sombrero"] : [])}<span class="name">${esc(p)}${BD.porNombre(p) ? `<small class="suma">⭐ Suma puntos</small>` : ""}</span><button class="x" data-del="${i}" aria-label="Quitar a ${esc(p)}">×</button></li>`).join("")}</ul>` : `<p class="empty">Todavía no hay nadie. Escribe un nombre y toca +.</p>`}
    </div>
    ${(() => { const libres = BD.usuarios().filter(u => !S.players.some(x => x.toLowerCase() === u.nombre.toLowerCase())); return libres.length ? `<div class="panel"><span class="label">Perfiles de este teléfono · toca para sumarlos</span><div class="chips-j">${libres.map(u => `<button class="chip-j" data-perfil="${esc(u.nombre)}">${personaje(u.look.color, "civ", 26, u.look.acc)}${esc(u.nombre)}</button>`).join("")}</div></div>` : ""; })()}
    ${S.mode === "chinchon" ? `<div class="panel">
      <div class="stepper"><div class="txt"><b>Compus en la mesa</b><small>Jugadores de la computadora. En total, de 2 a 5.</small></div>
        <div class="ctl"><button id="cpuMenos" aria-label="Menos compus" ${S.chCfg.cpus <= 0 ? "disabled" : ""}>−</button><output>${S.chCfg.cpus}</output><button id="cpuMas" aria-label="Más compus" ${S.chCfg.cpus >= 3 ? "disabled" : ""}>+</button></div></div>
      <div class="opt"><div class="txt"><b>Con comodines</b><small>Agrega 2 comodines que sirven como cualquier carta.</small></div><button class="switch" role="switch" aria-checked="${S.chCfg.comodines}" id="chCom" aria-label="Con comodines"></button></div>
      <div class="opt"><div class="txt"><b>Con 8 y 9</b><small>${S.chCfg.con89 ? "Baraja de 48: la escalera va 7, 8, 9, sota." : "Baraja de 40: sin 8 ni 9, el 7 sigue con la sota."}</small></div><button class="switch" role="switch" aria-checked="${S.chCfg.con89}" id="ch89" aria-label="Con 8 y 9"></button></div>
    </div>` : ""}
    ${(() => { const tot = n + (S.mode === "chinchon" ? S.chCfg.cpus : 0), max = S.mode === "chinchon" ? 5 : S.mode === "impostor" ? 99 : 8, ok = tot >= min && tot <= max && (S.mode !== "chinchon" || n >= 1);
      return `${S.mode === "chinchon" && tot > 5 ? `<p class="warn">El chinchón es de 2 a 5 jugadores (contando las compus).</p>` : ""}<div class="row"><button class="btn ghost" id="back">Inicio</button><button class="btn" id="next" ${ok ? "" : "disabled"}>${S.mode === "liars" ? "¡A la mesa!" : S.mode === "casos" ? "Elegir caso" : S.mode === "chinchon" ? "¡Repartir!" : S.mode === "ajedrez" || S.mode === "naval" ? "Listo" : "Elegir temas"}</button></div>`; })()}
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
  app.querySelectorAll("[data-perfil]").forEach(b => b.onclick = () => { S.players.push(b.dataset.perfil); save(); render(); });
  on("back", () => go("home"));
  on("cpuMenos", () => { S.chCfg.cpus--; store.set("chCfg", S.chCfg); render(); });
  on("cpuMas", () => { S.chCfg.cpus++; store.set("chCfg", S.chCfg); render(); });
  on("chCom", () => { S.chCfg.comodines = !S.chCfg.comodines; store.set("chCfg", S.chCfg); render(); });
  on("ch89", () => { S.chCfg.con89 = !S.chCfg.con89; store.set("chCfg", S.chCfg); render(); });
  on("next", () => {
    if (S.mode === "liars") return Lie.empezarLocal();
    if (S.mode === "casos") return go("casoSel");
    if (S.mode === "ajedrez" || S.mode === "naval") return go("duelo");
    if (S.mode === "chinchon") return Chin.empezarLocal([...S.players.map((name, i) => ({ id: "p" + i, name })), ...CPU_NOMBRES.slice(0, S.chCfg.cpus).map((name, i) => ({ id: "c" + i, name, cpu: true }))]);
    go("themes");
  });
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
