/* Trabajos diarios: Tala, Mina y Pesca.
   - Cada trabajo se juega una vez por día y se desbloquea mirando un anuncio (si los anuncios están activos).
   - Hay 10 minutos: lo que juntas se convierte en monedas al terminar (con un tope por jornada).
   - Las herramientas se mejoran con monedas en 9 niveles, de madera a "de los creadores".
   El progreso se guarda en el perfil (u.diario.herr y u.diario.trab), que ya se sincroniza con la nube. */

const TR = {
  DURACION: 10 * 60 * 1000,
  TOPE: 450,                      // monedas máximas por jornada
  NIVELES: [
    { id: "madera", m: "de madera", f: "de madera", color: "#a8743f", mango: "#6b4423" },
    { id: "piedra", m: "de piedra", f: "de piedra", color: "#8d949e", mango: "#6b4423" },
    { id: "metal", m: "de metal", f: "de metal", color: "#d4dbe3", mango: "#5a3a20" },
    { id: "esmeralda", m: "de esmeralda", f: "de esmeralda", color: "#2fd27a", mango: "#4a3020" },
    { id: "diamante", m: "de diamante", f: "de diamante", color: "#6fe0ff", mango: "#3f2a1c" },
    { id: "adamantio", m: "de adamantio", f: "de adamantio", color: "#e0344f", mango: "#2b2b33" },
    { id: "encantado", m: "encantado", f: "encantada", color: "#b77bff", mango: "#3b2a55" },
    { id: "vacio", m: "del vacío", f: "del vacío", color: "#4b1f7a", mango: "#120a1f" },
    { id: "creadores", m: "de los creadores", f: "de los creadores", color: "#ffd34d", mango: "#fff3c4" }
  ],
  COSTO: [0, 150, 300, 550, 900, 1400, 2000, 2800, 3800],   // costo para llegar a cada nivel
  DANO: [1, 1.25, 1.5, 1.8, 2.1, 2.5, 2.9, 3.4, 4],
  RINDE: [1, 1.3, 1.6, 2, 2.5, 3, 3.6, 4.3, 5],
  JUEGOS: {
    tala: { nombre: "Tala", lugar: "el bosque", herr: "Hacha", gen: "f", ic: "🪓", mat: "madera", desc: "Tala árboles: cuanto mejor el hacha, más madera da cada uno.", factor: 0.25 },
    mina: { nombre: "Mina", lugar: "la mina", herr: "Pico", gen: "m", ic: "⛏️", mat: "minerales", desc: "Pica rocas y baja cada vez más hondo: abajo hay minerales más valiosos.", factor: 0.3 },
    pesca: { nombre: "Pesca", lugar: "el lago", herr: "Caña", gen: "f", ic: "🎣", mat: "peces", desc: "Lanza, espera que piquen y recoge sin cortar la línea.", factor: 0.35 }
  }
};

const Trabajos = {
  s: null,          // jornada en curso
  reloj: null,

  /* ---------- Datos del perfil ---------- */
  datos(u) {
    Eco.completar(u);
    const d = u.diario;
    d.herr = Object.assign({ tala: 0, mina: 0, pesca: 0 }, d.herr || {});
    if (!d.trab || d.trab.dia !== hoyStr()) d.trab = { dia: hoyStr(), abiertos: [], hechos: [] };
    d.trabRecord = Object.assign({ tala: 0, mina: 0, pesca: 0 }, d.trabRecord || {});
    return d;
  },
  estado(u, j) {
    const d = this.datos(u);
    return d.trab.hechos.includes(j) ? "hecho" : d.trab.abiertos.includes(j) ? "abierto" : "cerrado";
  },
  nombreHerr(j, nivel) { const J = TR.JUEGOS[j], N = TR.NIVELES[nivel]; return `${J.herr} ${J.gen === "f" ? N.f : N.m}`; },

  /* Dibujo de la herramienta: el color de la cabeza cambia con el nivel */
  icono(j, nivel, size = 56) {
    const N = TR.NIVELES[nivel], c = N.color, m = N.mango, brillo = nivel >= 6 ? ` class="herr-brilla n${nivel}"` : "";
    const g = j === "tala"
      ? `<rect x="29" y="14" width="6" height="44" rx="3" fill="${m}" transform="rotate(20 32 36)"/><path d="M30 10 C44 6 52 14 50 26 C46 24 40 24 34 26 Z" fill="${c}" stroke="#0006" stroke-width="1.5" transform="rotate(20 32 36)"/>`
      : j === "mina"
      ? `<rect x="29" y="16" width="6" height="42" rx="3" fill="${m}" transform="rotate(-30 32 36)"/><path d="M8 22 C20 8 44 8 56 22 C46 17 18 17 8 22 Z" fill="${c}" stroke="#0006" stroke-width="1.5" transform="rotate(-30 32 30)"/>`
      : `<path d="M14 58 L46 8" stroke="${m}" stroke-width="5" stroke-linecap="round"/><path d="M46 8 Q56 30 52 52" stroke="#dfe7ff" stroke-width="1.2" fill="none"/><circle cx="23" cy="44" r="6" fill="${c}" stroke="#0006" stroke-width="1.5"/><circle cx="52" cy="54" r="3" fill="#ff5a5a"/>`;
    return `<svg${brillo} viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${g}</svg>`;
  },

  /* ---------- Desbloqueo con anuncio ---------- */
  async desbloquear(j) {
    const u = BD.sesion(); if (!u) return go("perfil");
    if (this.estado(u, j) !== "cerrado") return;
    const conAnuncio = Anuncios.activos(u);
    if (conAnuncio) {
      const c = Anuncios.cfg();
      const visto = await (c.prueba || typeof window.adBreak !== "function" ? Anuncios.prueba(c, `Jugar ${TR.JUEGOS[j].nombre} ${TR.JUEGOS[j].ic}`) : Anuncios.real());
      if (!visto) return;
    }
    if (u.nube && Nube.user) {
      const { data, error } = await Nube.sb.rpc("desbloquear_trabajo", { juego: j });
      if (error) { Toast.mostrar(`<div class="t-ic">⚠️</div><div class="t-txt"><b>No se pudo desbloquear</b><span>${esc(error.message)}</span></div>`, "info"); return; }
      if (!data || !data.ok) {
        this.datos(u).trab.hechos.push(j); Eco.guardar(u);
        Toast.mostrar(`<div class="t-ic">⏰</div><div class="t-txt"><b>Ya hiciste este trabajo hoy</b><span>Vuelve mañana.</span></div>`, "info"); render(); return;
      }
    }
    this.datos(u).trab.abiertos.push(j); Eco.guardar(u);
    this.empezar(j);
  },

  mejorar(j) {
    const u = BD.sesion(); if (!u) return;
    const d = this.datos(u), n = d.herr[j];
    if (n >= TR.NIVELES.length - 1) return;
    const costo = TR.COSTO[n + 1];
    if (u.monedas < costo) return;
    u.monedas -= costo; d.herr[j] = n + 1;
    Eco.guardar(u);
    if (u.nube) Nube.actividad("compra", j, 0, -costo);
    if (typeof Sonido !== "undefined") Sonido.sfx(n + 1 === TR.NIVELES.length - 1 ? "logro" : "monedas");
    Toast.mostrar(`<div class="t-ic">${TR.JUEGOS[j].ic}</div><div class="t-txt"><small>Herramienta mejorada</small><b>${esc(this.nombreHerr(j, n + 1))}</b><span>${n + 1 === TR.NIVELES.length - 1 ? "¡Tope tope! No hay nada mejor." : `Da ${TR.RINDE[n + 1]}× y pega ${TR.DANO[n + 1]}× más fuerte.`}</span></div>`, "logro");
    render();
  },

  /* ---------- Jornada ---------- */
  empezar(j) {
    const u = BD.sesion(); if (!u || this.estado(u, j) !== "abierto") return;
    const nivel = this.datos(u).herr[j];
    this.s = { j, nivel, uid: u.id, fin: Date.now() + TR.DURACION, valor: 0, items: {}, racha: 0, ultimo: 0, aturdido: 0, terminado: null };
    ({ tala: Tala, mina: Mina, pesca: Pesca })[j].iniciar(this.s);
    clearInterval(this.reloj);
    this.reloj = setInterval(() => this.tic(), 250);
    go("trabajo");
  },
  monedas(s) { return Math.min(TR.TOPE, Math.floor(s.valor * TR.JUEGOS[s.j].factor)); },
  sumar(s, item, cant, valor) {
    s.items[item] = (s.items[item] || 0) + cant;
    s.valor += valor;
    if (this.monedas(s) >= TR.TOPE) setTimeout(() => this.terminar("tope"), 600);
  },
  tic() {
    const s = this.s;
    if (!s || s.terminado) { clearInterval(this.reloj); return; }
    if (S.screen !== "trabajo") return this.terminar("salio");
    const queda = s.fin - Date.now();
    if (queda <= 0) return this.terminar("tiempo");
    this.hud();
    const motor = ({ tala: Tala, mina: Mina, pesca: Pesca })[s.j];
    if (motor.tic) motor.tic(s);
  },
  hud() {
    const s = this.s; if (!s) return;
    const queda = Math.max(0, s.fin - Date.now());
    const t = byId("trReloj"); if (t) { const seg = Math.ceil(queda / 1000); t.textContent = `${Math.floor(seg / 60)}:${pad2(seg % 60)}`; t.classList.toggle("poco", seg <= 30); }
    const mo = byId("trMon"); if (mo) mo.textContent = this.monedas(s);
  },
  terminar(motivo) {
    const s = this.s; if (!s || s.terminado) return;
    clearInterval(this.reloj);
    const u = BD.usuario(s.uid);
    const monedas = this.monedas(s), puntos = Math.min(40, Math.round(monedas / 10));
    s.terminado = { motivo, monedas, puntos };
    if (u) {
      const d = this.datos(u);
      d.trab.abiertos = d.trab.abiertos.filter(x => x !== s.j);
      if (!d.trab.hechos.includes(s.j)) d.trab.hechos.push(s.j);
      const record = monedas > d.trabRecord[s.j];
      if (record) d.trabRecord[s.j] = monedas;
      s.terminado.record = record && monedas > 0;
      u.monedas += monedas; u.puntos += puntos;
      u.historial.unshift({ f: Date.now(), juego: s.j, gano: true, puntos, txt: `${TR.JUEGOS[s.j].nombre} · +${monedas} monedas` });
      u.historial = u.historial.slice(0, 40);
      Eco.guardar(u);
      if (u.nube) Nube.actividad("partida", s.j, puntos, monedas);
    }
    if (motivo !== "salio") { if (typeof Sonido !== "undefined") Sonido.sfx("victoria"); render(); }
  },

  /* Numerito que sube desde donde tocaste */
  flota(el, txt, cls = "") {
    if (!el) return;
    const f = document.createElement("span");
    f.className = "tr-flota " + cls; f.textContent = txt;
    el.appendChild(f); setTimeout(() => f.remove(), 900);
  }
};

/* ---------- Tala ---------- */
const ARBOLES = {
  pino: { ic: "🌲", hp: 8, madera: 1, peso: 60 },
  roble: { ic: "🌳", hp: 14, madera: 2.2, peso: 26 },
  dorado: { ic: "🌳", hp: 10, madera: 6, peso: 5, cls: "dorado" },
  panal: { ic: "🐝", hp: 1, madera: 0, peso: 9, cls: "panal" }
};
const Tala = {
  nuevo() {
    const total = Object.values(ARBOLES).reduce((a, b) => a + b.peso, 0);
    let r = Math.random() * total, tipo = "pino";
    for (const [k, a] of Object.entries(ARBOLES)) { if ((r -= a.peso) < 0) { tipo = k; break; } }
    return { tipo, hp: ARBOLES[tipo].hp, vuelve: 0, desde: Date.now() };
  },
  iniciar(s) { s.arboles = Array.from({ length: 9 }, () => this.nuevo()); },
  html(s) {
    return `<div class="tr-campo tala">${s.arboles.map((a, i) => this.celda(a, i)).join("")}</div>
      <p class="sub center tr-ayuda">Toca los árboles para talarlos. Si talas seguido sumas racha (más madera). ¡Cuidado con los panales! 🐝</p>`;
  },
  celda(a, i) {
    const A = ARBOLES[a.tipo];
    if (a.vuelve) return `<button class="tr-celda tocon" data-i="${i}" aria-label="Tocón"><span class="tr-ic">🪵</span></button>`;
    return `<button class="tr-celda ${A.cls || ""}" data-i="${i}" aria-label="${a.tipo}"><span class="tr-ic">${A.ic}</span>${A.madera ? `<span class="tr-hp"><i style="width:${(a.hp / A.hp) * 100}%"></i></span>` : ""}</button>`;
  },
  pintar(s, i) { const el = app.querySelector(`.tr-celda[data-i="${i}"]`); if (el) { el.outerHTML = this.celda(s.arboles[i], i); this.conectarUna(s, i); } },
  conectar(s) { s.arboles.forEach((_, i) => this.conectarUna(s, i)); },
  conectarUna(s, i) {
    const el = app.querySelector(`.tr-celda[data-i="${i}"]`); if (!el) return;
    el.onpointerdown = e => { e.preventDefault(); this.golpe(s, i, el); };
  },
  golpe(s, i, el) {
    if (s.terminado) return;
    const a = s.arboles[i], A = ARBOLES[a.tipo], ahora = Date.now();
    if (a.vuelve) return;
    if (ahora < s.aturdido) { Trabajos.flota(el, "🐝 ¡Ay!", "malo"); return; }
    if (a.tipo === "panal") {
      s.aturdido = ahora + 2500; s.racha = 0;
      Trabajos.flota(el, "¡Abejas! 2 s", "malo"); if (typeof Sonido !== "undefined") Sonido.sfx("mal");
      try { navigator.vibrate && navigator.vibrate(200); } catch {}
      s.arboles[i] = this.nuevo(); this.pintar(s, i); this.racha(s); return;
    }
    a.hp -= TR.DANO[s.nivel];
    el.classList.remove("golpe"); void el.offsetWidth; el.classList.add("golpe");
    if (typeof Sonido !== "undefined") Sonido.sfx("hacha");
    if (a.hp > 0) { const b = el.querySelector(".tr-hp i"); if (b) b.style.width = Math.max(0, a.hp / A.hp) * 100 + "%"; return; }
    // Árbol talado
    s.racha = ahora - s.ultimo < 4000 ? s.racha + 1 : 1; s.ultimo = ahora;
    const mult = 1 + 0.1 * Math.min(5, s.racha - 1);
    const madera = Math.round(A.madera * TR.RINDE[s.nivel] * mult * 10) / 10;
    Trabajos.sumar(s, a.tipo === "dorado" ? "Madera dorada" : "Madera", madera, madera);
    Trabajos.flota(el, `+${madera} 🪵`, a.tipo === "dorado" ? "oro" : "");
    if (typeof Sonido !== "undefined") Sonido.sfx("cae");
    a.vuelve = ahora + 2200; this.pintar(s, i); this.racha(s);
  },
  racha(s) { const r = byId("trRacha"); if (r) r.textContent = s.racha > 1 ? `🔥 Racha ×${s.racha} (+${Math.min(5, s.racha - 1) * 10}%)` : ""; },
  tic(s) {
    const ahora = Date.now();
    s.arboles.forEach((a, i) => {
      if (a.vuelve && ahora > a.vuelve) { s.arboles[i] = this.nuevo(); this.pintar(s, i); }
      else if (a.tipo === "panal" && ahora - a.desde > 6000) { s.arboles[i] = this.nuevo(); this.pintar(s, i); }
    });
    if (s.racha > 1 && ahora - s.ultimo > 4000) { s.racha = 0; this.racha(s); }
  }
};

/* ---------- Mina ---------- */
const MINERALES = [
  { id: "piedra", nombre: "Piedra", ic: "🪨", hp: 4, v: 0.4, req: 0, peso: 50, desde: 1, color: "#6b6f78" },
  { id: "carbon", nombre: "Carbón", ic: "⚫", hp: 5, v: 1, req: 0, peso: 22, desde: 1, color: "#2a2a2e" },
  { id: "hierro", nombre: "Hierro", ic: "⚪", hp: 7, v: 2, req: 1, peso: 14, desde: 1, color: "#d9c3a5" },
  { id: "oro", nombre: "Oro", ic: "🟡", hp: 8, v: 3.5, req: 2, peso: 10, desde: 3, color: "#ffcc33" },
  { id: "esmeralda", nombre: "Esmeralda", ic: "🟢", hp: 10, v: 6, req: 3, peso: 7, desde: 5, color: "#2fd27a" },
  { id: "diamante", nombre: "Diamante", ic: "💎", hp: 12, v: 10, req: 4, peso: 5, desde: 7, color: "#6fe0ff" },
  { id: "adamantio", nombre: "Adamantio", ic: "🔴", hp: 14, v: 15, req: 5, peso: 4, desde: 9, color: "#e0344f" },
  { id: "arcano", nombre: "Cristal arcano", ic: "🔮", hp: 16, v: 22, req: 6, peso: 3, desde: 11, color: "#b77bff" },
  { id: "vacio", nombre: "Fragmento del vacío", ic: "🌌", hp: 18, v: 30, req: 7, peso: 2, desde: 13, color: "#4b1f7a" },
  { id: "tnt", nombre: "TNT", ic: "🧨", hp: 1, v: 0, req: 0, peso: 3, desde: 2, color: "#a3262c" }
];
const Mina = {
  bloque(p) {
    const ok = MINERALES.filter(m => p >= m.desde);
    const total = ok.reduce((a, m) => a + m.peso, 0);
    let r = Math.random() * total;
    for (const m of ok) if ((r -= m.peso) < 0) return { id: m.id, hp: m.hp };
    return { id: "piedra", hp: 4 };
  },
  iniciar(s) { s.prof = 1; this.capa(s); },
  capa(s) { s.bloques = Array.from({ length: 16 }, () => this.bloque(s.prof)); },
  html(s) {
    return `<div class="tr-prof"><b>Profundidad ${s.prof}</b><button class="btn chico" id="trBajar" ${this.puedeBajar(s) ? "" : "disabled"}>⬇️ Bajar</button></div>
      <div class="tr-campo mina">${s.bloques.map((b, i) => this.celda(b, i)).join("")}</div>
      <p class="sub center tr-ayuda">Rompe al menos 12 bloques para bajar. Más abajo hay minerales más valiosos, pero algunos necesitan un pico mejor. 🧨 rompe todo alrededor.</p>`;
  },
  puedeBajar(s) { return s.bloques.filter(b => !b).length >= 12; },
  celda(b, i) {
    if (!b) return `<span class="tr-celda hueco" data-i="${i}"></span>`;
    const M = MINERALES.find(m => m.id === b.id);
    return `<button class="tr-celda roca ${b.id}" data-i="${i}" style="--mc:${M.color}" aria-label="${M.nombre}"><span class="tr-ic">${M.ic}</span><span class="tr-hp"><i style="width:${(b.hp / M.hp) * 100}%"></i></span></button>`;
  },
  pintar(s, i) { const el = app.querySelector(`.mina [data-i="${i}"]`); if (el) { el.outerHTML = this.celda(s.bloques[i], i); this.conectarUna(s, i); } },
  conectar(s) {
    s.bloques.forEach((_, i) => this.conectarUna(s, i));
    on("trBajar", () => { if (!this.puedeBajar(s)) return; s.prof++; this.capa(s); if (typeof Sonido !== "undefined") Sonido.sfx("tocado"); render(); });
  },
  conectarUna(s, i) {
    const el = app.querySelector(`.mina [data-i="${i}"]`); if (!el) return;
    el.onpointerdown = e => { e.preventDefault(); this.golpe(s, i, el); };
  },
  romper(s, i, el) {
    const b = s.bloques[i]; if (!b) return;
    const M = MINERALES.find(m => m.id === b.id);
    s.bloques[i] = null;
    if (M.v) {
      const v = Math.round(M.v * TR.RINDE[s.nivel] * 10) / 10;
      Trabajos.sumar(s, M.nombre, 1, v);
      Trabajos.flota(el, `+1 ${M.ic}`, M.req >= 3 ? "oro" : "");
    }
    this.pintar(s, i);
  },
  golpe(s, i, el) {
    if (s.terminado) return;
    const b = s.bloques[i]; if (!b) return;
    const M = MINERALES.find(m => m.id === b.id);
    if (b.id === "tnt") {
      if (typeof Sonido !== "undefined") Sonido.sfx("bang");
      const x = i % 4, y = Math.floor(i / 4);
      s.bloques[i] = null; this.pintar(s, i);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx > 3 || ny > 3) continue;
        const k = ny * 4 + nx, vb = s.bloques[k];
        if (vb && vb.id !== "tnt" && MINERALES.find(m => m.id === vb.id).req <= s.nivel) this.romper(s, k, app.querySelector(`.mina [data-i="${k}"]`));
      }
    } else {
      const duro = M.req > s.nivel;
      b.hp -= TR.DANO[s.nivel] * (duro ? 0.15 : 1);
      el.classList.remove("golpe"); void el.offsetWidth; el.classList.add("golpe");
      if (typeof Sonido !== "undefined") Sonido.sfx("pico");
      if (duro && !s.avisoDuro) { s.avisoDuro = true; Trabajos.flota(el, `Muy duro: necesitas ${Trabajos.nombreHerr("mina", M.req).toLowerCase()}`, "malo aviso"); setTimeout(() => s.avisoDuro = false, 2500); }
      if (b.hp > 0) { const bar = el.querySelector(".tr-hp i"); if (bar) bar.style.width = Math.max(0, b.hp / M.hp) * 100 + "%"; return; }
      this.romper(s, i, el);
    }
    const bj = byId("trBajar"); if (bj) bj.disabled = !this.puedeBajar(s);
    if (s.bloques.every(x => !x)) { s.prof++; this.capa(s); setTimeout(render, 250); }
  }
};

/* ---------- Pesca ---------- */
const PECES = [
  { nombre: "Bota vieja", ic: "👢", v: 0, peso: 10, dif: 0.3, mejora: -0.12 },
  { nombre: "Sardina", ic: "🐟", v: 2, peso: 40, dif: 0.6, mejora: -0.05 },
  { nombre: "Trucha", ic: "🐟", v: 3.5, peso: 24, dif: 0.8, mejora: 0, cls: "trucha" },
  { nombre: "Cangrejo", ic: "🦀", v: 4, peso: 12, dif: 0.8, mejora: 0.1 },
  { nombre: "Pez globo", ic: "🐡", v: 5, peso: 10, dif: 1, mejora: 0.15 },
  { nombre: "Pez tropical", ic: "🐠", v: 6.5, peso: 8, dif: 1.1, mejora: 0.25 },
  { nombre: "Pulpo", ic: "🐙", v: 9, peso: 4, dif: 1.3, mejora: 0.4 },
  { nombre: "Calamar gigante", ic: "🦑", v: 14, peso: 2, dif: 1.5, mejora: 0.6 },
  { nombre: "Cofre del tesoro", ic: "💰", v: 20, peso: 0.6, dif: 1.2, mejora: 0.8 },
  { nombre: "Tiburón", ic: "🦈", v: 22, peso: 1, dif: 1.8, mejora: 0.9, desde: 2 },
  { nombre: "Ballena", ic: "🐋", v: 35, peso: 0.4, dif: 2.1, mejora: 1.2, desde: 5 },
  { nombre: "Pez del vacío", ic: "🐟", v: 50, peso: 0.15, dif: 2.4, mejora: 1.6, desde: 7, cls: "vacio" }
];
const Pesca = {
  iniciar(s) { s.fase = "listo"; s.tension = 0; s.avance = 0; s.tira = false; s.aprieta = false; s.pez = null; s.prox = 0; s.msg = "Toca «Lanzar» para tirar la línea."; },
  elegir(nivel) {
    const ok = PECES.filter(p => !p.desde || nivel >= p.desde);
    const pesos = ok.map(p => Math.max(0.05, p.peso * (1 + p.mejora * nivel)));
    let r = Math.random() * pesos.reduce((a, b) => a + b, 0);
    for (let k = 0; k < ok.length; k++) if ((r -= pesos[k]) < 0) return ok[k];
    return ok[1];
  },
  html(s) {
    return `<div class="tr-lago" id="trLago">
        <div class="tr-agua"><span class="tr-boya" id="trBoya"></span><span class="tr-pez" id="trPez" hidden></span></div>
      </div>
      <div class="tr-barras" id="trBarras" hidden>
        <label>Recogido<span class="bar"><i id="trAv"></i></span></label>
        <label>Tensión<span class="bar tension"><i id="trTen"></i></span></label>
      </div>
      <p class="sub center tr-msg" id="trMsg"></p>
      <button class="btn tr-accion" id="trAcc"></button>
      <p class="sub center tr-ayuda">Cuando el pez <b>tira</b> (se pone rojo), suelta el botón o se corta la línea. Una caña mejor trae peces más raros y aguanta más.</p>`;
  },
  /* Se actualiza en el lugar (sin volver a dibujar el botón) para no perder el dedo apoyado */
  actualizar(s) {
    const lago = byId("trLago"); if (!lago) return;
    lago.className = "tr-lago " + s.fase;
    byId("trBoya").textContent = s.fase === "pica" ? "❗" : s.fase === "listo" ? "" : "🔴";
    const pez = byId("trPez"), pelea = s.fase === "pelea";
    pez.hidden = !pelea;
    if (pelea) { pez.textContent = s.pez.ic; pez.className = `tr-pez ${s.pez.cls || ""} ${s.tira ? "tira" : ""}`; }
    byId("trBarras").hidden = !pelea;
    byId("trAv").style.width = Math.max(0, s.avance) + "%"; byId("trTen").style.width = Math.min(100, s.tension) + "%";
    byId("trMsg").textContent = s.msg;
    const b = byId("trAcc");
    b.textContent = { listo: "🎣 Lanzar", espera: "Esperando…", pica: "¡Tira ahora!", pelea: s.aprieta ? "Recogiendo…" : "Mantén para recoger" }[s.fase];
    b.classList.toggle("pica", s.fase === "pica");
  },
  conectar(s) {
    const b = byId("trAcc"); if (!b) return;
    b.onpointerdown = e => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch {}
      if (s.terminado) return;
      if (s.fase === "listo") { s.fase = "espera"; s.prox = Date.now() + 1500 + Math.random() * 3000; s.msg = "Esperando que pique…"; if (typeof Sonido !== "undefined") Sonido.sfx("agua"); }
      else if (s.fase === "espera") { s.fase = "listo"; s.msg = "¡Muy apurado! Se espantaron. Lanza de nuevo."; }
      else if (s.fase === "pica") { s.pez = this.elegir(s.nivel); s.fase = "pelea"; s.avance = 15; s.tension = 0; s.tira = false; s.prox = Date.now() + 800; s.msg = "¡Enganchado! Mantén apretado para recoger."; s.aprieta = true; }
      else if (s.fase === "pelea") s.aprieta = true;
      this.actualizar(s);
    };
    const soltar = () => { s.aprieta = false; this.actualizar(s); };
    b.onpointerup = soltar; b.onpointercancel = soltar; b.onlostpointercapture = soltar;
    b.oncontextmenu = e => e.preventDefault();
    this.actualizar(s);
  },
  tic(s) {
    const ahora = Date.now(), dt = 0.25;
    if (s.fase === "espera" && ahora > s.prox) {
      s.fase = "pica"; s.prox = ahora + 900 + 150 * s.nivel; s.msg = "¡Picó! Toca rápido.";
      if (typeof Sonido !== "undefined") Sonido.sfx("tic"); try { navigator.vibrate && navigator.vibrate(120); } catch {}
      this.actualizar(s);
    } else if (s.fase === "pica" && ahora > s.prox) {
      s.fase = "listo"; s.msg = "Se escapó… Lanza de nuevo."; this.actualizar(s);
    } else if (s.fase === "pelea") {
      const p = s.pez, aguante = 1 + s.nivel * 0.18;
      if (ahora > s.prox) { s.tira = !s.tira; s.prox = ahora + (s.tira ? 500 + Math.random() * 700 * p.dif : 700 + Math.random() * 1300 / p.dif); }
      if (s.aprieta) {
        if (s.tira) { s.tension += (55 * p.dif / aguante) * dt; s.avance += 3 * dt; }
        else { s.avance += (30 + 4 * s.nivel) / p.dif * dt; s.tension = Math.max(0, s.tension - 10 * dt); }
      } else { s.tension = Math.max(0, s.tension - 45 * dt); s.avance -= (s.tira ? 10 : 4) * p.dif * dt; }
      if (s.tension >= 100) { s.fase = "listo"; s.msg = `¡Se cortó la línea! Era: ${p.ic} ${p.nombre}.`; if (typeof Sonido !== "undefined") Sonido.sfx("mal"); this.actualizar(s); return; }
      if (s.avance <= 0) { s.fase = "listo"; s.msg = `Se escapó ${p.ic} ${p.nombre}.`; this.actualizar(s); return; }
      if (s.avance >= 100) {
        const v = Math.round(p.v * TR.RINDE[s.nivel] * 10) / 10;
        Trabajos.sumar(s, `${p.ic} ${p.nombre}`, 1, v);
        s.fase = "listo"; s.msg = p.v ? `¡Pescaste ${p.ic} ${p.nombre}! Vale ${Math.round(v * TR.JUEGOS.pesca.factor * 10) / 10} 🪙.` : `Sacaste ${p.ic} ${p.nombre}… no vale nada.`;
        if (typeof Sonido !== "undefined") Sonido.sfx(p.v >= 14 ? "logro" : p.v ? "bien" : "mal");
        this.actualizar(s); return;
      }
      this.actualizar(s);
    }
  }
};

/* ---------- Pantallas ---------- */
PANTALLAS.trabajos = () => {
  const u = BD.sesion();
  if (!u) {
    app.innerHTML = `${head(0)}<section class="stage"><h2>Trabajos diarios</h2><p class="sub">Necesitas un perfil para guardar tus herramientas y monedas.</p><button class="btn" id="trPerfil">Crear o elegir perfil</button><button class="btn ghost" id="trVolver">Volver</button></section>`;
    on("trPerfil", () => go("perfil")); on("trVolver", () => go("home")); return;
  }
  const d = Trabajos.datos(u), conAnuncio = Anuncios.activos(u);
  const hechos = d.trab.hechos.length;
  app.innerHTML = `${Cuenta.barra()}<section class="screen">
    <div class="headrow"><h1 class="titulo chico">Trabajos <span>diarios</span></h1><span class="chip-mon">🪙 ${u.monedas}</span></div>
    <p class="sub">3 trabajos por día, ${conAnuncio ? "cada uno se desbloquea mirando un anuncio" : "uno de cada uno"}. Tienes <b>10 minutos</b>: lo que juntas se vuelve monedas (hasta ${TR.TOPE} por trabajo). Mejora tus herramientas para ganar más.</p>
    <div class="tr-dia">${Object.keys(TR.JUEGOS).map(j => `<i class="${d.trab.hechos.includes(j) ? "on" : ""}"></i>`).join("")}<small>${hechos}/3 hechos hoy</small></div>
    ${Object.entries(TR.JUEGOS).map(([j, J]) => {
      const n = d.herr[j], est = Trabajos.estado(u, j), max = n >= TR.NIVELES.length - 1, costo = TR.COSTO[n + 1];
      return `<article class="tr-card t-${j}">
        <div class="tr-card-top"><span class="tr-herr">${Trabajos.icono(j, n, 64)}</span>
          <div><h2>${J.ic} ${J.nombre}</h2><p class="sub">${J.desc}</p>${d.trabRecord[j] ? `<small class="sub">Récord: ${d.trabRecord[j]} 🪙</small>` : ""}</div></div>
        <div class="tr-nivel"><b>${esc(Trabajos.nombreHerr(j, n))}</b><span class="tr-pasos">${TR.NIVELES.map((N, k) => `<i style="--c:${N.color}" class="${k <= n ? "on" : ""}" title="${esc(Trabajos.nombreHerr(j, k))}"></i>`).join("")}</span></div>
        <div class="row">
          ${est === "hecho" ? `<button class="btn ghost" disabled>✓ Hecho hoy</button>`
            : est === "abierto" ? `<button class="btn" data-jugar="${j}">▶ Jugar</button>`
            : `<button class="btn" data-abrir="${j}">${conAnuncio ? "📺 Mirar anuncio y jugar" : "▶ Jugar"}</button>`}
          ${max ? `<button class="btn ghost" disabled>👑 Tope tope</button>` : `<button class="btn ghost" data-mejorar="${j}" ${u.monedas < costo ? "disabled" : ""}>⬆️ ${esc(Trabajos.nombreHerr(j, n + 1))} · ${costo} 🪙</button>`}
        </div></article>`;
    }).join("")}
    <button class="btn ghost" id="trVolver">Volver al inicio</button>
  </section>`;
  Cuenta.conectarBarra();
  app.querySelectorAll("[data-abrir]").forEach(b => b.onclick = async () => { b.disabled = true; await Trabajos.desbloquear(b.dataset.abrir); if (S.screen === "trabajos") render(); });
  app.querySelectorAll("[data-jugar]").forEach(b => b.onclick = () => Trabajos.empezar(b.dataset.jugar));
  app.querySelectorAll("[data-mejorar]").forEach(b => b.onclick = () => Trabajos.mejorar(b.dataset.mejorar));
  on("trVolver", () => go("home"));
};

PANTALLAS.trabajo = () => {
  const s = Trabajos.s;
  if (!s) return go("trabajos");
  const J = TR.JUEGOS[s.j], motor = { tala: Tala, mina: Mina, pesca: Pesca }[s.j];
  if (s.terminado) {
    const t = s.terminado, items = Object.entries(s.items).sort((a, b) => b[1] - a[1]);
    app.innerHTML = `${head(0)}<section class="stage tr-fin">
      <span class="tr-herr grande">${Trabajos.icono(s.j, s.nivel, 90)}</span>
      <h2>${t.motivo === "tope" ? "¡Llegaste al tope!" : t.motivo === "salio" ? "Jornada terminada" : "¡Se terminó el tiempo!"}</h2>
      <div class="tr-premio"><div><b>+${t.monedas}</b><small>monedas</small></div><div><b>+${t.puntos}</b><small>puntos</small></div></div>
      ${t.record ? `<p class="warn ok">🏆 ¡Nuevo récord en ${J.nombre}!</p>` : ""}
      ${items.length ? `<ul class="tr-items">${items.map(([k, n]) => `<li><span>${esc(k)}</span><b>${Math.round(n * 10) / 10}</b></li>`).join("")}</ul>` : `<p class="sub">No juntaste nada esta vez.</p>`}
      <button class="btn" id="trOtra">Ver trabajos</button></section>`;
    on("trOtra", () => { Trabajos.s = null; go("trabajos"); });
    return;
  }
  app.innerHTML = `<section class="stage tr-juego t-${s.j}">
    <div class="tr-hud"><span class="tr-reloj" id="trReloj">10:00</span><span class="tr-mon">🪙 <b id="trMon">${Trabajos.monedas(s)}</b><small>/${TR.TOPE}</small></span></div>
    <div class="tr-sub"><span class="tr-herr chica">${Trabajos.icono(s.j, s.nivel, 30)}</span><small>${esc(Trabajos.nombreHerr(s.j, s.nivel))} · ${J.ic} ${J.nombre}</small><small id="trRacha" class="tr-racha"></small></div>
    ${motor.html(s)}
    <button class="linkish" id="trFin">Terminar y cobrar</button>
  </section>`;
  motor.conectar(s);
  Trabajos.hud();
  on("trFin", () => { if (confirm("¿Terminar la jornada ahora? Cobras lo que juntaste y no puedes volver a jugarla hoy.")) Trabajos.terminar("fin"); });
};
