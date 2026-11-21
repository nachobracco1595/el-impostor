/* Progreso: misiones diarias y semanales, pase de temporada (gratis) y ligas semanales.
   Todo vive en el perfil (u.diario), así viaja a la nube con el resto:
   - mis:  { dia, d: [3 misiones del día], cambio (ya usó el cambio gratis), sem, w (misión semanal) }
   - pase: { t (temporada), xp, cob: [niveles cobrados], plus (cofres extra cobrados), antes (resumen de la temporada anterior) }
   - liga: { semana (lunes, hora de Argentina), tier (0 Bronce … 5 Leyenda), lp, ant: { semana, tier, lp }, pend, res }
   Las partidas y demás cosas avisan con Misiones.evento(tipo, datos, usuario): ahí se suman misiones, XP del pase y puntos de liga.
   Las monedas se cobran de a una recompensa (cada una ≤ 400) y se sube el perfil entre una y otra (el servidor no deja subir más de 500 juntas). */

/* ---------- Tiempo: Argentina es UTC−3 todo el año ---------- */
const HORA_AR = 3 * 36e5, DIA_MS = 864e5;
const fechaUTC = d => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const Tiempo = {
  semanaAR(t = Date.now()) { const d = new Date(t - HORA_AR); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return fechaUTC(d); },
  finSemanaAR(t = Date.now()) { const [y, m, d] = this.semanaAR(t).split("-").map(Number); return Date.UTC(y, m - 1, d + 7) + HORA_AR; },
  semanaAnterior(t = Date.now()) { return this.semanaAR(t - 7 * DIA_MS); },
  finDia() { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); },
  resta(fin) {
    const ms = Math.max(0, fin - Date.now()), d = Math.floor(ms / DIA_MS), h = Math.floor(ms % DIA_MS / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${Math.max(1, m)} min`;
  }
};
const elegirDe = (r, lista) => lista[Math.floor(r() * lista.length)];

/* ---------- Temporadas del pase: 28 días, iguales para todos desde el lunes 23/11/2026 (la primera arranca ya) ---------- */
const PASE = { EPOCA: Date.UTC(2026, 10, 23, 3), DIAS: 28, NIVELES: 30, PLUS: 500, COFRE_PLUS: 100 };
const TEMAS_PASE = [
  { nombre: "Fiesta Loca", ic: "🎉", c1: "#f06595", c2: "#ffd43b", titulo: "Alma de la Fiesta", skin: ["Rey de la pista", "🪩", { tinte: "#f06595", alfa: .5, aura: "#ffd43b", arma: "#f783ac", part: "#ffd43b", som: "🪩" }] },
  { nombre: "Noche de Casino", ic: "🎰", c1: "#2f9e44", c2: "#ffd43b", titulo: "Rey del Casino", skin: ["Crupier", "🎩", { tinte: "#1b1726", alfa: .55, aura: "#51cf66", arma: "#ffd43b", part: "#ffd43b", som: "🎩" }] },
  { nombre: "Leyendas de la Arena", ic: "⚔️", c1: "#e8590c", c2: "#ff4d63", titulo: "Gladiador Eterno", skin: ["Campeón", "🏆", { tinte: "#e8590c", alfa: .45, aura: "#ff4d63", arma: "#ffa94d", part: "#ffd43b", som: "🏆" }] },
  { nombre: "Misterio en la Mesa", ic: "🕵️", c1: "#7048e8", c2: "#3bc9db", titulo: "Mente Maestra", skin: ["Detective", "🕵️", { tinte: "#5f3dc4", alfa: .5, aura: "#3bc9db", arma: "#99e9f2", som: "🔍" }] },
  { nombre: "Galaxia Loca", ic: "🚀", c1: "#364fc7", c2: "#cc5de8", titulo: "Viajero Estelar", skin: ["Astronauta", "🧑‍🚀", { tinte: "#364fc7", alfa: .5, aura: "#cc5de8", arma: "#91a7ff", part: "#fff", som: "⭐" }] },
  { nombre: "Verano Loco", ic: "🏖️", c1: "#0ca678", c2: "#fcc419", titulo: "Rey del Verano", skin: ["Surfista", "🏄", { tinte: "#0ca678", alfa: .45, aura: "#fcc419", arma: "#63e6be", part: "#fff3bf", som: "🌴" }] }
];
function temporada(t = Date.now()) {
  const L = PASE.DIAS * DIA_MS, n = Math.max(0, Math.floor((t - PASE.EPOCA) / L)), fin = PASE.EPOCA + (n + 1) * L;
  return { num: n + 1, tema: TEMAS_PASE[n % TEMAS_PASE.length], fin, dias: Math.max(0, Math.ceil((fin - t) / DIA_MS)) };
}
const temaDe = num => TEMAS_PASE[(num - 1) % TEMAS_PASE.length];

/* Cosas exclusivas de cada temporada (hasta la actual): marco, título y skin de la Arena. No se venden (refs/pase) */
(() => {
  const n = temporada().num, css = [];
  for (let k = 1; k <= n; k++) {
    const T = temaDe(k);
    MARCOS["t" + k] = `Marco de la Temporada ${k}`;
    CATALOGO["mar-t" + k] = { tipo: "marco", nombre: `Marco ${T.nombre} (T${k})`, precio: 0, valor: "t" + k, refs: "pase" };
    CATALOGO["tit-t" + k] = { tipo: "titulo", nombre: `${T.titulo} (T${k})`, precio: 0, valor: `${T.titulo} T${k}`, refs: "pase" };
    const [nom, ic, x] = T.skin, id = "temp" + k;
    if (typeof SKINS_DATA !== "undefined" && !SKINS_DATA.some(s => s[0] === id)) SKINS_DATA.push([id, `${nom} (T${k})`, ic, 0, { ...x, pase: k }]);
    if (typeof HE !== "undefined" && HE.SKIN) HE.SKIN[id] = { id, nombre: `${nom} (T${k})`, ic, precio: 0, ...x, pase: k };
    css.push(`.marco-t${k}::before{background:conic-gradient(${T.c1},${T.c2},#fff,${T.c1},${T.c2},${T.c1});animation:gira-marco 3.5s linear infinite;box-shadow:0 0 10px ${T.c1}}`);
  }
  const st = document.createElement("style"); st.textContent = css.join("\n"); document.head.appendChild(st);
})();

/* Recompensas por nivel (gratis). m: monedas (≤ 400) · f: fragmentos · g/n: gemas y su nivel · p: pergaminos ·
   item: rareza del botín (1 raro … 4 mítico) · titulo, marco, skin: lo exclusivo de la temporada */
const PREMIOS_PASE = [null,
  [{ m: 100 }], [{ f: 10 }], [{ m: 150 }], [{ item: 1 }], [{ g: 2, n: 2 }], [{ m: 200 }], [{ p: 1 }], [{ f: 25 }], [{ m: 250 }], [{ titulo: 1 }, { m: 100 }],
  [{ g: 2, n: 3 }], [{ m: 300 }], [{ item: 2 }], [{ p: 2 }], [{ m: 350 }, { f: 40 }], [{ g: 3, n: 3 }], [{ item: 2 }], [{ m: 300 }], [{ f: 60 }], [{ marco: 1 }, { m: 200 }],
  [{ item: 3 }], [{ g: 2, n: 4 }], [{ m: 350 }], [{ p: 3 }], [{ item: 3 }, { f: 80 }], [{ m: 400 }], [{ g: 2, n: 5 }], [{ item: 3 }], [{ m: 400 }, { f: 100 }], [{ skin: 1 }, { item: 4 }]
];
const RAREZA_TXT = ["Común", "Raro", "Épico", "Legendario", "Mítico"], RAREZA_COL = ["#ced4da", "#4dabf7", "#b197fc", "#ffa94d", "#ff4d63"];

/* Todo lo que da monedas pasa por acá: de a una, esperando a que se suba la anterior */
const Progreso = {
  ocupado: false,
  async cobrarCon(u, fn) {
    if (this.ocupado || !u) return null;
    this.ocupado = true;
    try {
      const nube = u.nube && typeof Nube !== "undefined" && Nube.user && Nube.user.id === u.id;
      if (nube && u.pendiente) await Nube.subir(u);
      const r = fn();
      BD.guardar();
      if (nube) await Nube.subir(u);
      return r;
    } finally { this.ocupado = false; }
  },
  /* Animación del cobro: el premio sube desde el botón con chispas */
  festejo(el, txt, ics = ["✨", "🪙", "⭐"]) {
    const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const x = Math.max(110, Math.min(innerWidth - 110, r.left + r.width / 2)), y = r.top + r.height / 2, fx = document.createElement("div");
    fx.className = "pg-fx"; fx.style.left = x + "px"; fx.style.top = y + "px";
    fx.innerHTML = `<b>${txt}</b>` + Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, d = 50 + Math.random() * 40;
      return `<i style="--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d)}px">${ics[i % ics.length]}</i>`; }).join("");
    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 1400);
    if (typeof Sonido !== "undefined") Sonido.sfx("monedas");
    try { navigator.vibrate && navigator.vibrate(30); } catch {}
  },
  aviso(ic, titulo, txt, tipo = "info") { Toast.mostrar(`<div class="t-ic">${ic}</div><div class="t-txt"><b>${esc(titulo)}</b>${txt ? `<span>${esc(txt)}</span>` : ""}</div>`, tipo); }
};

/* ---------- Misiones ---------- */
const MIS_JUEGOS = ["bowling", "arco", "circo", "preguntas", "basta", "truco", "chinchon", "burako", "poker", "carrera", "naval", "ajedrez", "nave", "arena", "liars"];
/* "Hacé X puntos": [medio, difícil] por partida (bowling a 10 cuadros, arco sobre 120) */
const MIS_PUNTOS = { bowling: [100, 150], arco: [75, 95], circo: [1200, 2500] };
const DIF = [{ n: "Fácil", c: "#51cf66", m: [20, 30], xp: 80 }, { n: "Media", c: "#fcc419", m: [35, 50], xp: 100 }, { n: "Difícil", c: "#ff6b6b", m: [60, 80], xp: 130 }];
const MIS_SEMANA = { m: 250, xp: 400 };
/* Plantillas diarias: [clave, dificultad, arma la misión, ¿se puede hoy?] */
const PLANTILLAS = [
  ["partidas", 0, () => ({ tipo: "partidas", meta: 3 })],
  ["juego", 0, r => ({ tipo: "juego", juego: elegirDe(r, MIS_JUEGOS), meta: 2 })],
  ["diario", 0, () => ({ tipo: "diario", meta: 1 })],
  ["casino", 0, () => ({ tipo: "casino", meta: 5 }), u => (u.monedas | 0) >= 60],
  ["mensaje", 0, () => ({ tipo: "mensaje", meta: 1 }), () => typeof Social !== "undefined" && Social.disponible() && Social.amigos().length > 0],
  ["ganar", 1, () => ({ tipo: "ganar", meta: 2 })],
  ["distintos", 1, () => ({ tipo: "distintos", meta: 3 })],
  ["puntos", 1, r => { const j = elegirDe(r, Object.keys(MIS_PUNTOS)); return { tipo: "puntos", juego: j, meta: MIS_PUNTOS[j][0] }; }],
  ["torre", 1, () => ({ tipo: "torre", meta: 3 })],
  ["palabras", 1, () => ({ tipo: "palabras", juego: "basta", meta: 15 })],
  ["ganarJuego", 2, r => ({ tipo: "ganarJ", juego: elegirDe(r, MIS_JUEGOS), meta: 2 })],
  ["partidas6", 2, () => ({ tipo: "partidas", meta: 6 })],
  ["puntosAlto", 2, r => { const j = elegirDe(r, Object.keys(MIS_PUNTOS)); return { tipo: "puntos", juego: j, meta: MIS_PUNTOS[j][1] }; }],
  ["torre6", 2, () => ({ tipo: "torre", meta: 6 })],
  ["distintos5", 2, () => ({ tipo: "distintos", meta: 5 })]
];
const SEMANALES = [
  ["s-partidas", () => ({ tipo: "partidas", meta: 15 })],
  ["s-ganar", () => ({ tipo: "ganar", meta: 8 })],
  ["s-distintos", () => ({ tipo: "distintos", meta: 6 })],
  ["s-misiones", () => ({ tipo: "misiones", meta: 12 })],
  ["s-torre", () => ({ tipo: "torre", meta: 12 })],
  ["s-online", () => ({ tipo: "online", meta: 1 }), () => typeof Social !== "undefined" && Social.disponible() && Social.amigos().length > 0]
];
const ICONO_MIS = { partidas: "🎮", juego: "🕹️", diario: "🎁", casino: "🎰", mensaje: "💬", ganar: "🏅", ganarJ: "🏆", distintos: "🌈", puntos: "🎯", torre: "🗼", palabras: "✋", misiones: "📋", online: "🌐" };

const Misiones = {
  texto(m) {
    const J = m.juego ? JUEGOS[m.juego] || m.juego : "", n = m.meta, s = n > 1 ? "s" : "";
    switch (m.tipo) {
      case "partidas": return `Jugá ${n} partida${s}`;
      case "juego": return `Jugá ${n} partida${s} de ${J}`;
      case "diario": return "Cobrá el premio diario";
      case "casino": return `Hacé ${n} jugadas en el casino`;
      case "mensaje": return "Mandale un mensaje a un amigo";
      case "ganar": return `Ganá ${n} partida${s}`;
      case "ganarJ": return `Ganá ${n} partida${s} de ${J}`;
      case "distintos": return `Jugá ${n} juegos distintos`;
      case "puntos": return `Hacé ${n} puntos en ${J}${m.juego === "bowling" ? "" : m.juego === "arco" ? " (sobre 120)" : ""}`;
      case "torre": return `Pasá ${n} piso${s} de la Torre`;
      case "palabras": return `Escribí ${n} palabras válidas en Basta`;
      case "misiones": return `Cumplí ${n} misiones diarias`;
      case "online": return "Ganá una partida online";
    }
    return "Misión";
  },
  ayuda(m) {
    if (m.tipo === "puntos") return "En una sola partida (contra bots o solo).";
    if (m.tipo === "ganar" || m.tipo === "ganarJ") return "Contra bots también vale.";
    if (m.tipo === "torre") return "En la Arena → Torre de hordas.";
    if (m.tipo === "distintos") return "Cualquier juego que dé puntos.";
    return "";
  },
  /* Arma una misión del día a partir de una plantilla */
  armar(pl, r, dia) {
    const x = pl[2](r), D = DIF[pl[1]], m = D.m[0] + Math.round(r() * (D.m[1] - D.m[0]) / 5) * 5;
    return { k: pl[0], ...x, dif: pl[1], prog: 0, m, xp: D.xp, ok: false, dia };
  },
  /* Las del día salen siempre iguales para ese día y ese perfil: una fácil, una media y una difícil, sin repetir tipo */
  generar(u, dia) {
    const r = azarDe(`${dia}|${u.id}|mis`), out = [];
    for (const dif of [0, 1, 2]) {
      const ops = PLANTILLAS.filter(p => p[1] === dif && (!p[3] || p[3](u)) && !out.some(m => m.tipo === p[2](() => 0).tipo));
      out.push(this.armar(elegirDe(r, ops), r, dia));
    }
    return out;
  },
  generarSemana(u, sem) {
    const r = azarDe(`${sem}|${u.id}|sem`), ops = SEMANALES.filter(p => !p[2] || p[2](u)), pl = elegirDe(r, ops);
    const w = { k: pl[0], ...pl[1](), prog: 0, m: MIS_SEMANA.m, xp: MIS_SEMANA.xp, ok: false, sem };
    // Pasa la misión semanal de antes (10 partidas): si ya la cobró esta semana no se cobra dos veces, y las partidas jugadas cuentan
    const d = u.diario;
    if (d.semana === sem) {
      if (d.semanaCobrada === sem) { w.ok = true; w.prog = w.meta; }
      else if (w.tipo === "partidas") w.prog = Math.min(w.meta, d.partidasSemana | 0);
    }
    return w;
  },
  estado(u) {
    Eco.completar(u);
    const dia = hoyStr(), sem = semanaStr();
    let M = u.diario.mis;
    if (!M || typeof M !== "object") M = u.diario.mis = {};
    if (M.dia !== dia || !Array.isArray(M.d) || M.d.length !== 3) {
      M.dia = dia; M.cambio = false; M.d = this.generar(u, dia);
      // Si ya cobró el premio diario hoy, esa misión ya está hecha
      M.d.forEach(m => { if (m.tipo === "diario" && u.diario.ultimo === dia) m.prog = 1; });
    }
    if (M.sem !== sem || !M.w) { M.sem = sem; M.w = this.generarSemana(u, sem); }
    return M;
  },
  lista(u) { const M = this.estado(u); return [...M.d, M.w]; },
  hechas(u) { return this.estado(u).d.filter(m => m.prog >= m.meta).length; },
  porCobrar(u) { return this.lista(u).filter(m => m.prog >= m.meta && !m.ok).length; },

  valorPuntos(res) {
    if (res.juego === "bowling") return res.cuadros === 10 ? res.total | 0 : (res.total | 0) * 2;
    if (res.juego === "arco") return Math.round((res.total | 0) * 120 / (res.max || 120));
    return res.total | 0;
  },
  avanzar(m, tipo, d) {
    if (tipo === "partida") {
      const { res, calc, online } = d, g = res.juego;
      if (m.tipo === "partidas") m.prog++;
      else if (m.tipo === "juego" && g === m.juego) m.prog++;
      else if (m.tipo === "ganar" && calc.gano) m.prog++;
      else if (m.tipo === "ganarJ" && calc.gano && g === m.juego) m.prog++;
      else if (m.tipo === "distintos") { m.js = Array.isArray(m.js) ? m.js : []; if (!m.js.includes(g)) m.js.push(g); m.prog = m.js.length; }
      else if (m.tipo === "puntos" && g === m.juego) m.prog = Math.max(m.prog, Math.min(m.meta, this.valorPuntos(res)));
      else if (m.tipo === "palabras" && g === "basta") m.prog += res.palabras | 0;
      else if (m.tipo === "online" && online && calc.gano) m.prog++;
    } else if (tipo === m.tipo || (tipo === "diaria" && m.tipo === "misiones")) m.prog += d.n || 1;
    m.prog = Math.min(m.meta, m.prog);
  },
  /* El único punto de entrada: partida, diario, casino, torre, mensaje. Devuelve { xp, lp } */
  evento(tipo, d = {}, u = BD.sesion()) {
    if (!u) return null;
    const M = this.estado(u), out = { xp: 0, lp: 0 }, listas = [], sesion = BD.cargar().sesion === u.id;
    if (tipo === "partida") {
      out.xp = 30 + (d.calc.gano ? 20 : 0);
      if (Liga.activa(u)) out.lp = Math.max(1, d.calc.puntos | 0) + (d.online && d.calc.gano ? 15 : 0);
    } else if (tipo === "diario") out.xp = 50;
    const correr = (lista, t, dd) => lista.forEach(m => {
      if (m.ok || m.prog >= m.meta) return;
      this.avanzar(m, t, dd);
      if (m.prog >= m.meta) listas.push(m);
    });
    correr(M.d, tipo, d);
    correr([M.w], tipo, d);
    // Cada misión diaria cumplida suma a la semanal "Cumplí N misiones"
    const diarias = listas.filter(m => m.dia).length;
    if (diarias) correr([M.w], "diaria", { n: diarias });
    listas.forEach(m => Toast.mostrar(`<div class="t-ic">✅</div><div class="t-txt"><small>${m.sem ? "Misión semanal" : "Misión cumplida"}${sesion ? "" : " · " + esc(u.nombre)}</small><b>${esc(this.texto(m))}</b><span>Cobrá ${m.m} 🪙 y ${m.xp} XP en 🎯 Progreso.</span></div>`, "logro"));
    if (out.xp) Pase.sumar(u, out.xp, sesion);
    if (out.lp) Liga.sumar(u, out.lp);
    BD.guardar();
    return out;
  },
  /* Cobrar una misión (i = 0..2 las del día, "w" la semanal) */
  async cobrar(u, i, el) {
    const M = this.estado(u), m = i === "w" ? M.w : M.d[i];
    if (!m || m.ok || m.prog < m.meta) return false;
    const r = await Progreso.cobrarCon(u, () => {
      if (m.ok) return false;
      m.ok = true; u.monedas += m.m;
      Pase.sumar(u, m.xp, true);
      if (Liga.activa(u) && i !== "w") Liga.sumar(u, 10);
      if (u.nube && typeof Nube !== "undefined") Nube.actividad("mision", null, 0, m.m);
      return true;
    });
    if (r) { Progreso.festejo(el, `+${m.m} 🪙 · +${m.xp} XP`); render(); }
    return r;
  },
  /* Cambio gratis: una misión del día (sin cumplir) por otra de la misma dificultad */
  cambiar(u, i) {
    const M = this.estado(u), m = M.d[i];
    if (!m || M.cambio || m.ok || m.prog >= m.meta) return false;
    const r = azarDe(`${M.dia}|${u.id}|cambio${i}`);
    const ops = PLANTILLAS.filter(p => p[1] === m.dif && p[0] !== m.k && (!p[3] || p[3](u)) && !M.d.some((x, j) => j !== i && x.tipo === p[2](() => 0).tipo));
    if (!ops.length) return false;
    const nueva = this.armar(elegirDe(r, ops), r, M.dia);
    if (nueva.tipo === "diario" && u.diario.ultimo === M.dia) nueva.prog = 1;
    M.d[i] = nueva; M.cambio = true;
    Eco.guardar(u);
    return true;
  }
};

/* ---------- Pase de temporada ---------- */
const Pase = {
  costo: n => 300 + 10 * (n - 2),                        // XP para pasar del nivel n−1 al n (el 1 es gratis)
  umbral(n) { let x = 0; for (let k = 2; k <= Math.min(n, PASE.NIVELES); k++) x += this.costo(k); return x; },
  nivel(xp) {
    let n = 1; while (n < PASE.NIVELES && xp >= this.umbral(n + 1)) n++;
    const tope = this.umbral(PASE.NIVELES);
    if (n >= PASE.NIVELES) { const extra = xp - tope, plus = Math.floor(extra / PASE.PLUS); return { n, plus, desde: tope + plus * PASE.PLUS, hasta: tope + (plus + 1) * PASE.PLUS, pct: Math.round((extra % PASE.PLUS) / PASE.PLUS * 100) }; }
    const desde = this.umbral(n), hasta = this.umbral(n + 1);
    return { n, plus: 0, desde, hasta, pct: Math.round((xp - desde) / (hasta - desde) * 100) };
  },
  datos(u) {
    Eco.completar(u);
    const T = temporada();
    let p = u.diario.pase;
    if (!p || typeof p !== "object" || p.t !== T.num) {
      const viejo = p && typeof p === "object" ? p : null;
      p = u.diario.pase = { t: T.num, xp: 0, cob: [], plus: 0 };
      if (viejo && viejo.xp > 0) { const nv = this.nivel(viejo.xp); p.antes = { t: viejo.t, n: nv.n, perdidos: Math.max(0, nv.n - (viejo.cob || []).length) }; }
    }
    if (!Array.isArray(p.cob)) p.cob = [];
    return p;
  },
  pendientes(u) {
    const p = this.datos(u), nv = this.nivel(p.xp);
    let k = 0; for (let n = 1; n <= nv.n; n++) if (!p.cob.includes(n)) k++;
    return k + Math.max(0, nv.plus - (p.plus | 0));
  },
  sumar(u, xp, avisar = true) {
    const p = this.datos(u), antes = this.nivel(p.xp);
    p.xp = Math.max(0, Math.min(1e7, (p.xp | 0) + (xp | 0)));
    const ahora = this.nivel(p.xp);
    if (avisar && (ahora.n > antes.n || ahora.plus > antes.plus))
      Toast.mostrar(`<div class="t-ic">🎟️</div><div class="t-txt"><small>Pase de temporada</small><b>¡Nivel ${ahora.n}${ahora.plus ? " +" + ahora.plus : ""}!</b><span>Tenés recompensas para cobrar.</span></div>`, "logro");
  },
  /* Texto e ícono de una recompensa */
  premio(x, num) {
    const T = temaDe(num);
    if (x.m) return { ic: "🪙", txt: `${x.m} monedas`, chico: `${x.m}` };
    if (x.f) return { ic: "🧩", txt: `${x.f} fragmentos`, chico: `${x.f}` };
    if (x.g) return { ic: "💎", txt: `${x.g} gemas de nivel ${x.n}`, chico: `${x.g}×Nv${x.n}` };
    if (x.p) return { ic: "📜", txt: `${x.p} pergamino${x.p > 1 ? "s" : ""} de grabado`, chico: `${x.p}` };
    if (x.item) return { ic: ["⚪", "🔵", "🟣", "🟠", "🔴"][x.item], txt: `Botín ${RAREZA_TXT[x.item].toLowerCase()} de la Arena`, chico: RAREZA_TXT[x.item], color: RAREZA_COL[x.item] };
    if (x.titulo) return { ic: "🏷️", txt: `Título «${T.titulo} T${num}»`, chico: "Título", excl: true };
    if (x.marco) return { ic: "🖼️", txt: `Marco exclusivo ${T.nombre}`, chico: "Marco", excl: true };
    if (x.skin) return { ic: T.skin[1], txt: `Skin de la Arena «${T.skin[0]}»`, chico: "Skin", excl: true };
    return { ic: "🎁", txt: "Premio", chico: "" };
  },
  /* Da una recompensa (sin guardar). Devuelve el texto de lo que dio */
  dar(u, x, num, nivel) {
    if (x.m) { u.monedas += Math.min(400, x.m); return `+${x.m} 🪙`; }
    const arena = typeof Heroes !== "undefined" && typeof HE !== "undefined";
    if (x.titulo || x.marco) {
      const id = (x.titulo ? "tit-t" : "mar-t") + num, it = CATALOGO[id];
      if (it && !u.inv.includes(id)) { u.inv.push(id); if (u.look && !u.look[it.tipo]) u.look[it.tipo] = it.valor; }
      return it ? it.nombre : "";
    }
    if (!arena) { u.monedas += 50; return "+50 🪙"; }
    if (x.f) { Heroes.sumarMat(u, "f", null, x.f); return `🧩 +${x.f}`; }
    if (x.g) { const out = []; for (let i = 0; i < x.g; i++) { const k = pick(Object.keys(HE.GEMAS)); Heroes.sumarMat(u, "g", k + x.n); out.push(`${HE.GEMAS[k][1]} ${HE.GEMAS[k][0]} ${x.n}`); } return out.join(" · "); }
    if (x.p) { const out = []; for (let i = 0; i < x.p; i++) { const k = pick(Object.keys(HE.GRABADOS)); Heroes.sumarMat(u, "p", k); out.push(`📜 ${HE.GRABADOS[k][0]}`); } return out.join(" · "); }
    if (x.skin) { const a = Heroes.datos(u); a.skins = a.skins || []; if (!a.skins.includes("temp" + num)) a.skins.push("temp" + num); return `Skin ${temaDe(num).skin[0]}`; }
    if (x.item) {
      const a = Heroes.datos(u), clase = a.clase, p = a.pj[clase], id = Heroes.nuevoBotin(x.item, Math.round(5 + nivel * 1.5), true), it = Heroes.item(clase, id);
      if (!it) { Heroes.sumarMat(u, "f", null, [5, 10, 20, 40, 80][x.item]); return "🧩 fragmentos"; }
      if (p.items.length >= HE.BOLSA) { Heroes.sumarMat(u, "f", null, [5, 10, 20, 40, 80][x.item]); return `🎒 Bolsa llena: ${[5, 10, 20, 40, 80][x.item]} 🧩 en su lugar`; }
      p.items.push(id); p.nuevos = [...(p.nuevos || []), id].slice(-8);
      return `${it.nombre} (${AR.CLASES[clase] ? AR.CLASES[clase].nombre : clase})`;
    }
    return "";
  },
  puedeCobrar(u, n) { const p = this.datos(u); return n >= 1 && n <= this.nivel(p.xp).n && !p.cob.includes(n); },
  async cobrar(u, n, el) {
    if (!this.puedeCobrar(u, n)) return null;
    const p = this.datos(u);
    const txt = await Progreso.cobrarCon(u, () => {
      if (p.cob.includes(n)) return null;
      p.cob.push(n);
      const dado = PREMIOS_PASE[n].map(x => this.dar(u, x, p.t, n)).filter(Boolean);
      const m = PREMIOS_PASE[n].reduce((t, x) => t + (x.m || 0), 0);
      if (m && u.nube && typeof Nube !== "undefined") Nube.actividad("ingreso", "pase", 0, m);
      return dado;
    });
    if (txt) { Progreso.festejo(el, `Nv ${n}`, PREMIOS_PASE[n].map(x => this.premio(x, p.t).ic)); Progreso.aviso("🎟️", `Nivel ${n} cobrado`, txt.join(" · "), PREMIOS_PASE[n].some(x => x.skin || x.marco || x.titulo || x.item >= 3) ? "logro" : "info"); }
    return txt;
  },
  async cobrarPlus(u, el) {
    const p = this.datos(u), nv = this.nivel(p.xp);
    if ((p.plus | 0) >= nv.plus) return false;
    const ok = await Progreso.cobrarCon(u, () => { if ((p.plus | 0) >= this.nivel(p.xp).plus) return false; p.plus = (p.plus | 0) + 1; u.monedas += PASE.COFRE_PLUS; return true; });
    if (ok) Progreso.festejo(el, `+${PASE.COFRE_PLUS} 🪙`, ["🎁", "🪙", "✨"]);
    return ok;
  },
  /* Cobrar todo: nivel por nivel, subiendo el perfil entre cada uno */
  async cobrarTodo(u, el) {
    const p = this.datos(u), nv = this.nivel(p.xp);
    let k = 0;
    for (let n = 1; n <= nv.n; n++) if (!p.cob.includes(n)) { if (await this.cobrar(u, n, el)) k++; else break; if (S.screen === "progreso") render(); }
    while ((p.plus | 0) < this.nivel(p.xp).plus) { if (!(await this.cobrarPlus(u, el))) break; k++; }
    render();
    return k;
  }
};

/* ---------- Ligas semanales ---------- */
const LIGAS = [
  { nombre: "Bronce", ic: "🥉", c: "#d08b4f" }, { nombre: "Plata", ic: "🥈", c: "#c3cad5" }, { nombre: "Oro", ic: "🥇", c: "#ffd43b" },
  { nombre: "Platino", ic: "💠", c: "#63e6be" }, { nombre: "Diamante", ic: "💎", c: "#74c0fc" }, { nombre: "Leyenda", ic: "👑", c: "#ff6b9d" }
];
const Liga = {
  cache: null, revisando: false, sinServidor: false,
  activa: u => !!(u && u.nube),
  datos(u) {
    Eco.completar(u);
    let L = u.diario.liga;
    if (!L || typeof L !== "object") L = u.diario.liga = { semana: null, tier: 0, lp: 0 };
    L.tier = Math.max(0, Math.min(5, L.tier | 0)); L.lp = Math.max(0, L.lp | 0);
    this.rodar(u, L);
    return L;
  },
  /* Semana nueva: la anterior queda en "ant" (el servidor la usa para armar los grupos viejos) y queda pendiente el resultado */
  rodar(u, L) {
    const cur = Tiempo.semanaAR();
    if (L.semana === cur) return false;
    if (L.semana && L.lp > 0) { L.ant = { semana: L.semana, tier: L.tier, lp: L.lp }; L.pend = L.semana === Tiempo.semanaAnterior() ? L.semana : null; }
    else L.pend = null;
    L.semana = cur; L.lp = 0;
    return true;
  },
  sumar(u, lp) { if (!this.activa(u)) return; const L = this.datos(u); L.lp = Math.min(100000, L.lp + Math.max(0, lp | 0)); if (this.cache && this.cache.semana === L.semana) this.cache.t = 0; },
  /* Cuántos suben y bajan en un grupo de n (hasta 5 y 5) */
  zonas(n) { return { sube: Math.min(5, Math.ceil(n / 3)), baja: Math.min(5, Math.floor(n / 3)) }; },
  cofre(pos, tier) {
    const b = pos === 1 ? [300, 400] : pos === 2 ? [250, 300] : pos === 3 ? [200, 250] : pos <= 5 ? [150, 200] : pos <= 10 ? [100, 150] : [50, 100];
    return { m: Math.min(400, b[0] + 20 * tier), xp: b[1] + 50 * tier };
  },
  /* Al abrir la app en una semana nueva: posición final de la semana anterior → sube, baja o se queda, y el cofre */
  async revisar(u) {
    if (!this.activa(u) || this.revisando || typeof Nube === "undefined" || !Nube.sb || !Nube.user || Nube.user.id !== u.id) return;
    const L = this.datos(u);
    if (!L.pend || Date.now() - (this.intento || 0) < 60000) return;
    this.revisando = true; this.intento = Date.now();
    try {
      const { data, error } = await Nube.sb.rpc("liga_resultado", { semana: L.pend });
      if (error) { if (/function|does not exist|not find|schema cache/i.test(error.message || "")) { this.sinServidor = true; L.pend = null; Eco.guardar(u); } return; }
      if (!data || !data.pos) { L.pend = null; Eco.guardar(u); return; }
      const de = L.ant ? L.ant.tier : L.tier, pos = data.pos | 0, n = Math.max(pos, data.n | 0), z = this.zonas(n);
      const a = pos <= z.sube && de < 5 ? de + 1 : pos > n - z.baja && de > 0 ? de - 1 : de, c = this.cofre(pos, de);
      L.tier = a; L.res = { semana: L.pend, pos, n, de, a, m: c.m, xp: c.xp, ok: false }; L.pend = null;
      Eco.guardar(u);
      this.modal(u);
    } catch (e) { console.warn("liga", e); }
    finally { this.revisando = false; }
  },
  modal(u) {
    const L = this.datos(u), R = L.res;
    if (!R || R.ok || document.querySelector(".lg-modal")) return;
    const T = LIGAS[R.a], sube = R.a > R.de, baja = R.a < R.de;
    const caja = document.createElement("div");
    caja.className = "modal-fondo lg-modal";
    caja.innerHTML = `<div class="modal lg-res ${sube ? "sube" : baja ? "baja" : ""}" style="--lg:${T.c}" role="dialog" aria-label="Resultado de la liga">
      <span class="label">Liga semanal · terminó la semana</span>
      <div class="lg-insignia grande">${T.ic}</div>
      <h2>${sube ? `¡Subiste a ${T.nombre}!` : baja ? `Bajaste a ${T.nombre}` : `Seguís en ${T.nombre}`}</h2>
      <p class="sub">Terminaste <b>${R.pos}º</b> de ${R.n} en tu grupo de ${LIGAS[R.de].nombre}.${baja ? " ¡Esta semana la recuperás!" : ""}</p>
      <div class="lg-cofre">🎁<span>Cofre del ${R.pos}º puesto<b>+${R.m} 🪙 · +${R.xp} XP</b></span></div>
      <button class="btn" id="lgCofre">Abrir cofre</button>
    </div>`;
    document.body.appendChild(caja);
    caja.querySelector("#lgCofre").onclick = async e => {
      const b = e.currentTarget; b.disabled = true;
      const uu = BD.usuario(u.id) || u, LL = this.datos(uu), RR = LL.res;
      const ok = RR && !RR.ok && await Progreso.cobrarCon(uu, () => { if (RR.ok) return false; RR.ok = true; uu.monedas += Math.min(400, RR.m); Pase.sumar(uu, RR.xp, true); if (uu.nube) Nube.actividad("ingreso", "liga", 0, RR.m); return true; });
      if (ok) Progreso.festejo(b, `+${RR.m} 🪙 · +${RR.xp} XP`, ["🎁", "🪙", LIGAS[RR.a].ic]);
      setTimeout(() => { caja.remove(); render(); }, ok ? 700 : 0);
    };
  },
  /* Grupo de esta semana (hasta 20 de tu misma liga), con un rato de caché */
  async cargar(u) {
    const L = this.datos(u), c = this.cache;
    if (!this.activa(u) || typeof Nube === "undefined" || Nube.estado !== "lista" || !Nube.user) return;
    if (c && c.semana === L.semana && (c.cargando || Date.now() - c.t < 30000)) return;
    this.cache = { semana: L.semana, filas: c && c.semana === L.semana ? c.filas : null, cargando: true, t: Date.now(), error: "" };
    const { data, error } = await Nube.sb.rpc("liga_grupo", { semana: L.semana });
    if (error) { this.sinServidor = /function|does not exist|not find|schema cache/i.test(error.message || ""); this.cache = { semana: L.semana, filas: null, cargando: false, t: Date.now(), error: this.sinServidor ? "sin" : "red" }; }
    else this.cache = { semana: L.semana, filas: (Array.isArray(data) ? data : []).filter(f => f && f.id), cargando: false, t: Date.now(), error: "" };
    if (S.screen === "progreso" || S.screen === "home") render();
  },
  /* Filas del grupo con mis puntos al día (los del teléfono pueden ir adelante de la nube) */
  filas(u) {
    const L = this.datos(u), c = this.cache;
    if (!c || c.semana !== L.semana || !c.filas) return null;
    const f = c.filas.map(x => ({ ...x, lp: x.id === u.id ? Math.max(L.lp, x.lp | 0) : x.lp | 0 }));
    if (!f.some(x => x.id === u.id)) f.push({ id: u.id, nombre: u.nombre, look: u.look, lp: L.lp, tier: L.tier });
    return f.filter(x => x.id === u.id || x.lp > 0).sort((a, b) => b.lp - a.lp || String(a.nombre).localeCompare(b.nombre));
  },
  posicion(u) { const f = this.filas(u); if (!f) return null; return { pos: f.findIndex(x => x.id === u.id) + 1, n: f.length }; }
};

/* ---------- Inicio: los tres botones y los carteles ---------- */
Object.assign(Progreso, {
  hub(u) {
    if (!u) return "";
    const M = Misiones.estado(u), hechas = M.d.filter(m => m.prog >= m.meta).length, pm = Misiones.porCobrar(u);
    const p = Pase.datos(u), nv = Pase.nivel(p.xp), pp = Pase.pendientes(u);
    let liga;
    if (Liga.activa(u)) {
      const L = Liga.datos(u), T = LIGAS[L.tier], pos = Liga.posicion(u);
      if (typeof Nube !== "undefined" && Nube.listo === u.id) { Liga.revisar(u); Liga.cargar(u); if (L.res && !L.res.ok) setTimeout(() => Liga.modal(u), 600); }
      liga = `<button class="pg-chip" data-pg="liga" style="--pc:${T.c}"><span class="pg-ic">${T.ic}</span><span class="pg-t"><b>${T.nombre}</b><small>${pos && L.lp > 0 ? `${pos.pos}º · ${L.lp} LP` : "¡Sumá LP!"}</small></span></button>`;
    } else liga = `<button class="pg-chip" data-pg="liga" style="--pc:#d08b4f"><span class="pg-ic">🏆</span><span class="pg-t"><b>Ligas</b><small>Con cuenta</small></span></button>`;
    return `<nav class="pg-hub" aria-label="Progreso">
      <button class="pg-chip ${pm ? "hay" : ""}" data-pg="misiones" style="--pc:#51cf66"><span class="pg-ic">🎯</span><span class="pg-t"><b>Misiones</b><small>${hechas}/3 hoy</small></span>${pm ? `<i class="pg-badge">${pm}</i>` : ""}</button>
      <button class="pg-chip ${pp ? "hay" : ""}" data-pg="pase" style="--pc:${temporada().tema.c1}"><span class="pg-ic">🎟️</span><span class="pg-t"><b>Pase</b><small>Nivel ${nv.n}${nv.plus ? "+" : ""}</small><span class="pg-xp"><i style="width:${nv.pct}%"></i></span></span>${pp ? `<i class="pg-badge">${pp}</i>` : ""}</button>
      ${liga}
    </nav>${this.cartel(u)}`;
  },
  /* Cartel de temporada: nueva temporada o que se termina con premios sin cobrar */
  cartel(u) {
    const T = temporada(), p = Pase.datos(u), pp = Pase.pendientes(u);
    if (p.antes && !p.antes.visto) return `<button class="pg-cartel nueva" id="pgNueva" style="--c1:${T.tema.c1};--c2:${T.tema.c2}"><span class="pg-c-ic">${T.tema.ic}</span><span><b>¡Nueva temporada! T${T.num}: ${esc(T.tema.nombre)}</b><small>Pase nuevo con marco, título y skin exclusivos. Llegaste al nivel ${p.antes.n} en la anterior.</small></span><i>›</i></button>`;
    if (T.dias <= 3 && pp > 0) return `<button class="pg-cartel" data-pg="pase" style="--c1:${T.tema.c1};--c2:${T.tema.c2}"><span class="pg-c-ic">⏳</span><span><b>La temporada termina en ${T.dias} día${T.dias === 1 ? "" : "s"}</b><small>Tenés ${pp} recompensa${pp > 1 ? "s" : ""} del pase sin cobrar: se pierden al terminar.</small></span><i>›</i></button>`;
    return "";
  },
  conectar() {
    app.querySelectorAll("[data-pg]").forEach(b => b.onclick = () => { UI.tabPg = b.dataset.pg; UI.pgScroll = false; go("progreso"); });
    on("pgNueva", () => { const u = BD.sesion(); if (u) { Pase.datos(u).antes.visto = true; Eco.guardar(u); } UI.tabPg = "pase"; go("progreso"); });
  }
});

/* ---------- Pantalla de progreso: misiones, pase y liga ---------- */
PANTALLAS.progreso = () => {
  const u = BD.sesion();
  if (!u) return go("cuenta");
  const tab = UI.tabPg || "misiones", pm = Misiones.porCobrar(u), pp = Pase.pendientes(u);
  const tabs = [["misiones", "🎯 Misiones", pm], ["pase", "🎟️ Pase", pp], ["liga", "🏆 Liga", 0]];
  app.innerHTML = `${head(0)}
  <section class="screen pg">
    <div class="tienda-head"><div><h2>Progreso</h2><p class="sub">Misiones, pase de temporada y ligas.</p></div><div class="saldo">🪙 <b>${u.monedas}</b></div></div>
    <div class="tabs pg-tabs">${tabs.map(([k, n, b]) => `<button data-pgt="${k}" aria-pressed="${tab === k}">${n}${b ? `<i class="pg-badge">${b}</i>` : ""}</button>`).join("")}</div>
    ${tab === "pase" ? vistaPase(u) : tab === "liga" ? vistaLiga(u) : vistaMisiones(u)}
    <button class="btn ghost" id="volver">Volver</button>
  </section>`;
  app.querySelectorAll("[data-pgt]").forEach(b => b.onclick = () => { UI.tabPg = b.dataset.pgt; render(); });
  app.querySelectorAll("[data-mc]").forEach(b => b.onclick = () => { b.disabled = true; Misiones.cobrar(u, b.dataset.mc === "w" ? "w" : +b.dataset.mc, b).then(ok => { if (!ok) b.disabled = false; }); });
  app.querySelectorAll("[data-mx]").forEach(b => b.onclick = () => { if (Misiones.cambiar(u, +b.dataset.mx)) { Progreso.aviso("🔄", "Misión cambiada", "Mañana tenés otro cambio gratis."); render(); } });
  app.querySelectorAll("[data-pn]").forEach(b => b.onclick = () => { b.disabled = true; Pase.cobrar(u, +b.dataset.pn, b).then(() => render()); });
  on("pgTodo", e => { const b = e.currentTarget; b.disabled = true; Pase.cobrarTodo(u, b); });
  on("pgPlus", e => { const b = e.currentTarget; b.disabled = true; Pase.cobrarPlus(u, b).then(() => render()); });
  on("pgCuenta", () => go("cuenta"));
  on("pgRecargar", () => { Liga.cache = null; render(); });
  app.querySelectorAll("[data-tarjeta]").forEach(li => li.onclick = () => typeof Tarjeta !== "undefined" && Tarjeta.abrir({ id: li.dataset.tarjeta }));
  on("volver", () => go("home"));
  if (tab === "pase") { const yo = app.querySelector(".pn.actual"); if (yo && !UI.pgScroll) { UI.pgScroll = true; yo.scrollIntoView({ block: "center" }); } }
};

function tarjetaMision(m, i, M) {
  const listo = m.prog >= m.meta, D = m.sem ? { n: "Semanal", c: "#b48cff" } : DIF[m.dif], ayuda = Misiones.ayuda(m);
  return `<article class="mis ${listo ? "lista" : ""} ${m.ok ? "cobrada" : ""}" style="--dc:${D.c}">
    <span class="mis-ic">${ICONO_MIS[m.tipo] || "🎯"}</span>
    <div class="mis-txt"><span class="mis-dif">${D.n}</span><b>${esc(Misiones.texto(m))}</b>${ayuda && !listo ? `<small>${esc(ayuda)}</small>` : ""}
      <div class="mis-bar"><i style="width:${Math.round(m.prog / m.meta * 100)}%"></i><span>${m.prog}/${m.meta}</span></div>
      <small class="mis-premio">🪙 ${m.m} · 🎟️ ${m.xp} XP</small></div>
    <div class="mis-acc">${m.ok ? `<span class="ok">✓ Cobrada</span>` : listo ? `<button class="btn chico brilla" data-mc="${i}">Cobrar</button>`
      : i !== "w" && !M.cambio ? `<button class="mis-cambio" data-mx="${i}" aria-label="Cambiar esta misión" title="Cambiar (1 gratis por día)">🔄</button>` : ""}</div>
  </article>`;
}
function vistaMisiones(u) {
  const M = Misiones.estado(u);
  return `<div class="pg-sec"><div class="pg-sec-h"><b>Misiones de hoy</b><small>⏱️ Nuevas en ${Tiempo.resta(Tiempo.finDia())}</small></div>
    ${M.d.map((m, i) => tarjetaMision(m, i, M)).join("")}
    <p class="summary">${M.cambio ? "Ya usaste el cambio de hoy." : "🔄 Podés cambiar una misión gratis por día."}</p></div>
  <div class="pg-sec"><div class="pg-sec-h"><b>Misión semanal</b><small>⏱️ Termina en ${Tiempo.resta((() => { const [y, m, d] = M.sem.split("-").map(Number); return new Date(y, m - 1, d + 7).getTime(); })())}</small></div>
    ${tarjetaMision(M.w, "w", M)}</div>`;
}
function vistaPase(u) {
  const T = temporada(), p = Pase.datos(u), nv = Pase.nivel(p.xp), pp = Pase.pendientes(u);
  const fila = n => {
    const ps = PREMIOS_PASE[n].map(x => Pase.premio(x, p.t)), cob = p.cob.includes(n), abierto = n <= nv.n, excl = ps.some(x => x.excl);
    return `<li class="pn ${cob ? "cobrado" : abierto ? "listo" : "cerrado"} ${excl ? "excl" : ""} ${n === Math.min(nv.n + 1, PASE.NIVELES) && !cob ? "actual" : ""}">
      <span class="pn-n">${n}</span>
      <span class="pn-prem">${ps.map(x => `<span class="pn-p" ${x.color ? `style="--rc:${x.color}"` : ""}><em>${x.ic}</em><span><b>${esc(x.txt)}</b></span></span>`).join("")}</span>
      <span class="pn-acc">${cob ? `<span class="ok">✓</span>` : abierto ? `<button class="btn chico brilla" data-pn="${n}">Cobrar</button>` : `<small>🔒 ${Pase.umbral(n) - p.xp} XP</small>`}</span></li>`;
  };
  const plusListos = Math.max(0, nv.plus - (p.plus | 0));
  return `<div class="pase-head" style="--c1:${T.tema.c1};--c2:${T.tema.c2}">
      <span class="pase-ic">${T.tema.ic}</span>
      <div class="pase-t"><small>Temporada ${T.num} · gratis para todos</small><b>${esc(T.tema.nombre)}</b><small>⏱️ Termina en ${Tiempo.resta(T.fin)}</small></div>
      <div class="pase-nv"><small>Nivel</small><b>${nv.n}${nv.plus ? `<sup>+${nv.plus}</sup>` : ""}</b></div>
      <div class="pase-xp"><div class="mis-bar"><i style="width:${nv.pct}%"></i><span>${p.xp - nv.desde} / ${nv.hasta - nv.desde} XP</span></div></div>
    </div>
    ${pp ? `<button class="btn brilla" id="pgTodo">Cobrar todo (${pp})</button>` : ""}
    ${T.dias <= 3 && pp ? `<p class="pg-alerta">⏳ Quedan ${T.dias} día${T.dias === 1 ? "" : "s"}: lo que no cobres se pierde con la temporada.</p>` : ""}
    <ol class="pase-lista">${Array.from({ length: PASE.NIVELES }, (_, i) => fila(i + 1)).join("")}
      <li class="pn ${plusListos ? "listo" : "cerrado"} plus"><span class="pn-n">+</span><span class="pn-prem"><span class="pn-p"><em>🎁</em><span><b>Cofre extra: ${PASE.COFRE_PLUS} 🪙 cada ${PASE.PLUS} XP después del nivel ${PASE.NIVELES}</b></span></span></span>
        <span class="pn-acc">${plusListos ? `<button class="btn chico brilla" id="pgPlus">Abrir (${plusListos})</button>` : `<small>${p.cob.length ? `${p.plus | 0} abiertos` : "🔒"}</small>`}</span></li></ol>
    <details class="panel"><summary class="label">¿Cómo gano XP?</summary>
      <ul class="reglas-pts"><li><span>Terminar una partida (cualquier juego)</span><b>+30</b></li><li><span>Ganarla</span><b>+20 extra</b></li>
        <li><span>Misión diaria (fácil / media / difícil)</span><b>+80 / +100 / +130</b></li><li><span>Misión semanal</span><b>+${MIS_SEMANA.xp}</b></li>
        <li><span>Cobrar el premio diario</span><b>+50</b></li><li><span>Cofre de la liga semanal</span><b>+100 a +650</b></li></ul>
      <p class="summary">Cada temporada dura ${PASE.DIAS} días. Al terminar, el pase vuelve a cero y lo que no cobraste se pierde. Los objetos de la Arena son para el personaje que tengas elegido.</p></details>`;
}
function vistaLiga(u) {
  if (!Liga.activa(u)) return `<div class="panel center lg-invita"><div class="lg-insignia grande">🏆</div><b>Las ligas son para cuentas en la nube</b>
    <p class="sub">Cada semana competís con hasta 20 jugadores de tu división: los mejores suben de Bronce a Plata, Oro… hasta Leyenda, y todos ganan un cofre.</p>
    <button class="btn" id="pgCuenta">Crear mi cuenta gratis</button></div>`;
  const L = Liga.datos(u), T = LIGAS[L.tier];
  Liga.cargar(u);
  const c = Liga.cache, filas = Liga.filas(u), z = filas ? Liga.zonas(filas.length) : null;
  let tabla;
  if (Liga.sinServidor || (c && c.error === "sin")) tabla = `<div class="panel center"><p class="empty">🛠️ La liga se activa cuando el admin actualice el servidor.</p><small class="sub">Mientras tanto tus puntos de liga se guardan igual.</small></div>`;
  else if (c && c.error) tabla = `<div class="panel center"><p class="empty">No se pudo cargar tu grupo.</p><button class="btn chico ghost" id="pgRecargar">Reintentar</button></div>`;
  else if (!filas) tabla = `<div class="panel center"><p class="empty">Cargando tu grupo…</p></div>`;
  else tabla = `<ol class="lg-tabla">${filas.map((f, i) => {
      const pos = i + 1, sube = pos <= z.sube && L.tier < 5, baja = pos > filas.length - z.baja && L.tier > 0, look = Cuenta.lookValido(f.look) || { color: "#748ffc", acc: [], marco: "", titulo: "", mascota: "" };
      return `<li class="${f.id === u.id ? "yo" : ""} ${sube ? "z-sube" : baja ? "z-baja" : ""}" ${f.id !== u.id ? `data-tarjeta="${esc(f.id)}" role="button" tabindex="0"` : ""}>
        <span class="pos">${pos}</span>${retrato(look, 32)}<span class="nm"><b>${esc(f.nombre)}</b>${f.id === u.id ? "<small>Vos</small>" : ""}</span>
        <span class="lg-flecha">${sube ? "▲" : baja ? "▼" : ""}</span><strong>${f.lp} <small>LP</small></strong></li>`;
    }).join("")}</ol>
    <p class="summary">▲ Los primeros ${z.sube} suben${L.tier >= 5 ? " (en Leyenda no se sube más)" : ""} · ▼ los últimos ${z.baja} bajan${L.tier === 0 ? " (de Bronce no se baja)" : ""}. Para entrar al grupo hay que sumar al menos 1 LP.</p>`;
  return `<div class="lg-head" style="--lg:${T.c}"><div class="lg-insignia">${T.ic}</div>
      <div class="lg-t"><small>Liga semanal</small><b>${T.nombre}</b><small>⏱️ Termina en ${Tiempo.resta(Tiempo.finSemanaAR())}</small></div>
      <div class="lg-lp"><b>${L.lp}</b><small>LP</small></div></div>
    <div class="lg-escalera">${LIGAS.map((x, i) => `<span class="${i === L.tier ? "yo" : i < L.tier ? "pasada" : ""}" style="--lg:${x.c}" title="${x.nombre}">${x.ic}</span>`).join("<i></i>")}</div>
    ${tabla}
    <details class="panel"><summary class="label">¿Cómo funciona?</summary>
      <ul class="reglas-pts"><li><span>Cada partida terminada</span><b>LP = sus puntos</b></li><li><span>Ganar una partida online</span><b>+15 LP extra</b></li><li><span>Cobrar una misión diaria</span><b>+10 LP</b></li>
        <li><span>1º / 2º / 3º puesto</span><b>Cofre de 300 / 250 / 200 🪙</b></li><li><span>4º-5º / 6º-10º / resto</span><b>150 / 100 / 50 🪙</b></li></ul>
      <p class="summary">La semana va de lunes 00:00 a domingo 23:59 (hora de Argentina). Grupos de hasta 20 de la misma liga. Cuanto más alta la liga, más grande el cofre (+20 🪙 y +50 XP por división).</p></details>`;
}
