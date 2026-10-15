/* Casino de Mesa Loca: ruleta, tragamonedas y bingo (bingo.js) con las monedas del juego.
   Las monedas son del juego: no se compran ni se cambian por plata.
   - Con cuenta en la nube, cada jugada pasa por el servidor (timba_jugar) que controla el saldo y el premio máximo,
     así las ganancias grandes no chocan con el control de "no subir más de 500 monedas de una vez".
   - Con perfil local se guarda en el teléfono. */

const Timba = {
  cfg() { return Object.assign({ activo: true, maxApuesta: 500 }, (typeof Nube !== "undefined" && Nube.cfg && Nube.cfg.timba) || {}); },
  abierto() { return this.cfg().activo !== false; },
  maxApuesta() { return Math.max(10, Math.min(5000, +this.cfg().maxApuesta || 500)); },
  /* Azar del navegador (más parejo que Math.random) */
  azar(n) { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch { return Math.floor(Math.random() * n); } },
  stats(u) {
    u.stats.timba = Object.assign({ jugadas: 0, apostado: 0, ganado: 0, mayor: 0, plenos: 0, jackpots: 0, lineas: 0, bingos: 0 }, u.stats.timba || {});
    return u.stats.timba;
  },
  /* Lo que se ve en pantalla: mientras gira, el premio todavía no aparece */
  saldo(u) { return Math.max(0, (u.monedas || 0) - (UI.timbaPend || 0)); },

  /* Mueve monedas: apuesta (sale) y premio (entra) en una sola jugada */
  mover(u, juego, apuesta, premio, extra = {}) {
    Eco.completar(u);
    if (apuesta > u.monedas) return false;
    const st = this.stats(u);
    if (apuesta > 0) { st.jugadas++; st.apostado += apuesta; }
    st.ganado += premio; st.mayor = Math.max(st.mayor, premio);
    for (const k of ["plenos", "jackpots", "lineas", "bingos"]) st[k] += extra[k] | 0;
    u.monedas += premio - apuesta;
    BD.guardar();
    if (u.nube && typeof Nube !== "undefined" && Nube.sb && Nube.user && Nube.user.id === u.id) {
      Nube.enCola(async () => {
        const { data, error } = await Nube.sb.rpc("timba_jugar", { juego, apuesta, premio });
        if (error) { console.warn("timba", error.message); Eco.guardar(u); return; }        // sin el SQL nuevo: se sube como siempre
        if (data && data.ok) { if (!u.pendiente) { u.monedas = data.monedas; BD.guardar(); } this.subirLuego(u); }
        else if (data && data.motivo === "saldo") { u.monedas = data.monedas; BD.guardar(); Toast.mostrar(`<div class="t-ic">⚠️</div><div class="t-txt"><b>No alcanzaban las monedas</b><span>Tu saldo se corrigió con el de la nube.</span></div>`, "info"); render(); }
        else if (data && data.motivo === "cerrado") { u.monedas -= premio - apuesta; BD.guardar(); Toast.mostrar(`<div class="t-ic">🔒</div><div class="t-txt"><b>El casino está cerrado</b><span>Lo cerró el administrador. No se movieron monedas.</span></div>`, "info"); go("home"); }
      });
    }
    return true;
  },
  /* Las estadísticas del casino se suben un rato después (las monedas ya las guardó el servidor) */
  subirLuego(u) { clearTimeout(this.tSubir); this.tSubir = setTimeout(() => Nube.subir(u), 4000); },

  logros(u) {
    const nuevos = LOGROS.filter(l => !u.logros[l.id] && l.ok(u));
    nuevos.forEach(l => { u.logros[l.id] = Date.now(); Toast.mostrar(`<div class="t-ic">${l.ic}</div><div class="t-txt"><small>Logro desbloqueado</small><b>${esc(l.nombre)}</b><span>${esc(l.desc)}</span></div>`, "logro"); });
    if (nuevos.length) Eco.guardar(u);
  },
  festejo(premio, apuesta, grande) {
    if (premio <= 0) return;
    if (typeof Sonido !== "undefined") Sonido.sfx(grande ? "victoria" : "monedas");
    try { navigator.vibrate && navigator.vibrate(grande ? [80, 40, 80, 40, 200] : 60); } catch {}
    if (grande || premio >= apuesta * 10) Timba.lluvia();
  },
  lluvia() {
    const d = document.createElement("div"); d.className = "tb-lluvia";
    d.innerHTML = Array.from({ length: 26 }, (_, i) => `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random() * .8}s;animation-duration:${1.4 + Math.random()}s">🪙</i>`).join("");
    document.body.appendChild(d); setTimeout(() => d.remove(), 3000);
  },
  /* Pantalla para quien no tiene perfil o con el casino cerrado */
  sinPerfil(titulo) {
    const u = BD.sesion();
    if (!u) {
      app.innerHTML = `${head(0)}<section class="stage"><span class="tb-neon">🎰</span><h2>${titulo}</h2><p class="sub">Necesitas un perfil para apostar tus monedas.</p><button class="btn" id="tbPerfil">Crear o elegir perfil</button><button class="btn ghost" id="tbVolver">Volver</button></section>`;
      on("tbPerfil", () => go("perfil")); on("tbVolver", () => go("home")); return true;
    }
    if (!this.abierto()) {
      app.innerHTML = `${head(0)}<section class="stage"><span class="tb-neon">🔒</span><h2>Casino cerrado</h2><p class="sub">El administrador cerró el casino por ahora. ¡Vuelvan más tarde!</p><button class="btn" id="tbVolver">Volver</button></section>`;
      on("tbVolver", () => go("home")); return true;
    }
    return false;
  },
  cabecera(u, titulo, volver = "casino") {
    return `${head(0)}<div class="tb-cab"><button class="linkish" id="tbAtras">‹ ${volver === "casino" ? "Casino" : "Inicio"}</button><b>${titulo}</b><span class="chip-mon" id="tbSaldo">🪙 ${Timba.saldo(u)}</span></div>`;
  }
};

/* ---------- Ruleta europea (un solo cero) ---------- */
const RU = {
  RUEDA: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
  ROJOS: new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]),
  FICHAS: [5, 10, 25, 50, 100],
  /* Apuestas de afuera: [clave, texto, paga (con lo apostado), condición] */
  AFUERA: [
    ["doc1", "1ª docena", 3, n => n >= 1 && n <= 12], ["doc2", "2ª docena", 3, n => n >= 13 && n <= 24], ["doc3", "3ª docena", 3, n => n >= 25],
    ["bajo", "1 a 18", 2, n => n >= 1 && n <= 18], ["par", "Par", 2, n => n > 0 && n % 2 === 0], ["rojo", "Rojo", 2, n => RU.ROJOS.has(n)],
    ["negro", "Negro", 2, n => n > 0 && !RU.ROJOS.has(n)], ["impar", "Impar", 2, n => n % 2 === 1], ["alto", "19 a 36", 2, n => n >= 19],
    ["col1", "2 a 1", 3, n => n > 0 && n % 3 === 1], ["col2", "2 a 1", 3, n => n > 0 && n % 3 === 2], ["col3", "2 a 1", 3, n => n > 0 && n % 3 === 0]
  ],
  color: n => n === 0 ? "verde" : RU.ROJOS.has(n) ? "rojo" : "negro",
  gana(clave, n) {
    if (clave.startsWith("n")) return +clave.slice(1) === n ? 36 : 0;
    const a = RU.AFUERA.find(x => x[0] === clave);
    return a && n > 0 && a[3](n) ? a[2] : 0;
  },
  premio(apuestas, n) { return Object.entries(apuestas).reduce((t, [k, v]) => t + v * RU.gana(k, n), 0); },
  total: ap => Object.values(ap).reduce((t, v) => t + v, 0),

  rueda(rot, bola) {
    const paso = 360 / 37, R = 100, r = 66;
    const pt = (rad, ang) => [rad * Math.sin(ang * Math.PI / 180), -rad * Math.cos(ang * Math.PI / 180)];
    const sect = RU.RUEDA.map((n, k) => {
      const a0 = k * paso - paso / 2, a1 = a0 + paso, [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0), [tx, ty] = pt(86, k * paso);
      return `<path d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r} ${r} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z" class="ru-s ${RU.color(n)}"/>
        <text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" transform="rotate(${(k * paso).toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)})" class="ru-t">${n}</text>`;
    }).join("");
    const rayos = Array.from({ length: 8 }, (_, k) => `<path d="M0 0L${pt(52, k * 45)[0].toFixed(1)} ${pt(52, k * 45)[1].toFixed(1)}" stroke="#d9b45a" stroke-width="3" stroke-linecap="round"/>`).join("");
    return `<svg class="ru-rueda" viewBox="0 0 240 240" aria-hidden="true"><g transform="translate(120 120)">
      <circle r="117" fill="#5a3416"/><circle r="111" fill="#7a4a22" stroke="#d9b45a" stroke-width="2"/>
      <g class="ru-giro" id="ruGiro" style="transform:rotate(${rot}deg)">${sect}<circle r="66" fill="#3a2410"/><circle r="56" fill="#7a4a22" stroke="#d9b45a" stroke-width="1.5"/>${rayos}<circle r="14" fill="#d9b45a"/><circle r="7" fill="#fff3c4"/></g>
      <g class="ru-bola" id="ruBola" style="transform:rotate(${bola}deg)"><circle r="110" fill="none"/><circle cx="0" cy="-74" r="5.5" fill="#fff" stroke="#bbb" stroke-width="1" id="ruBolita"/></g>
      <path d="M0 -104 L-7 -118 L7 -118Z" fill="#ffd43b" stroke="#7a4a22" stroke-width="1.5"/></g></svg>`;
  }
};

PANTALLAS.ruleta = () => {
  if (Timba.sinPerfil("Ruleta")) return;
  const u = BD.sesion(), R = UI.rul = UI.rul || { ficha: 10, ap: {}, prev: {}, hist: [], rot: 0, bola: 0, girando: false, res: null, deshacer: [] };
  const tot = RU.total(R.ap), max = Math.min(Timba.maxApuesta(), Timba.saldo(u));
  const ficha = (k) => R.ap[k] ? `<span class="ru-ficha f${RU.FICHAS.filter(f => f <= R.ap[k]).pop() || 5}">${R.ap[k]}</span>` : "";
  const ganadora = k => R.res && !R.girando && RU.gana(k, R.res.n) ? "gana" : "";
  // Paño horizontal: el 0 a la izquierda, 12 columnas de 3 y los "2 a 1" a la derecha
  let pano = `<button class="ru-c verde cero ${ganadora("n0")}" data-ap="n0" style="grid-row:1/4">0${ficha("n0")}</button>`;
  for (let f = 0; f < 3; f++) for (let c = 0; c < 12; c++) { const n = c * 3 + 3 - f; pano += `<button class="ru-c ${RU.color(n)} ${ganadora("n" + n)}" data-ap="n${n}" style="grid-row:${f + 1};grid-column:${c + 2}">${n}${ficha("n" + n)}</button>`; }
  ["col3", "col2", "col1"].forEach((k, f) => pano += `<button class="ru-c afuera ${ganadora(k)}" data-ap="${k}" style="grid-row:${f + 1};grid-column:14">2:1${ficha(k)}</button>`);
  const afuera = RU.AFUERA.filter(a => !a[0].startsWith("col"));
  app.innerHTML = `${Timba.cabecera(u, "🎡 Ruleta")}<section class="screen ruleta">
    <div class="ru-mesa">
      <div class="ru-rueda-box">${RU.rueda(R.rot, R.bola)}
        <div class="ru-res ${R.res && !R.girando ? RU.color(R.res.n) : ""}" id="ruRes">${R.res && !R.girando ? `<b>${R.res.n}</b><small>${R.res.premio ? `+${R.res.premio} 🪙` : "Sin premio"}</small>` : R.girando ? "<small>¡No va más!</small>" : "<small>Hagan sus apuestas</small>"}</div>
      </div>
      <div class="ru-hist">${R.hist.slice(0, 12).map(n => `<i class="${RU.color(n)}">${n}</i>`).join("") || `<small class="sub">Acá aparecen los últimos números.</small>`}</div>
    </div>
    <div class="ru-pano-scroll"><div class="ru-pano ${R.girando ? "quieto" : ""}">${pano}</div></div>
    <div class="ru-afuera">${afuera.map(([k, t]) => `<button class="ru-c afuera ${k === "rojo" ? "rojo" : k === "negro" ? "negro" : ""} ${ganadora(k)}" data-ap="${k}">${k === "rojo" ? "◆ Rojo" : k === "negro" ? "◆ Negro" : t}${ficha(k)}</button>`).join("")}</div>
    <div class="ru-fichas" role="radiogroup" aria-label="Valor de la ficha">${RU.FICHAS.map(f => `<button class="ru-ficha grande f${f} ${R.ficha === f ? "on" : ""}" data-ficha="${f}" aria-pressed="${R.ficha === f}">${f}</button>`).join("")}</div>
    <p class="tb-linea">Apostado: <b>${tot}</b> 🪙 · máximo ${Math.min(Timba.maxApuesta(), u.monedas)} por tirada${R.res && !R.girando && R.res.premio ? ` · <b class="ok">Ganaste ${R.res.premio} 🪙</b>` : ""}</p>
    <div class="row"><button class="btn ghost chico" id="ruDes" ${R.deshacer.length && !R.girando ? "" : "disabled"}>↶ Deshacer</button><button class="btn ghost chico" id="ruBorrar" ${tot && !R.girando ? "" : "disabled"}>Borrar</button><button class="btn ghost chico" id="ruRep" ${!tot && RU.total(R.prev) && RU.total(R.prev) <= max && !R.girando ? "" : "disabled"}>↻ Repetir</button></div>
    <button class="btn tb-girar" id="ruGirar" ${tot && tot <= u.monedas && !R.girando ? "" : "disabled"}>${R.girando ? "Girando…" : "🎡 ¡Girar!"}</button>
    <details class="panel"><summary class="label">Cómo se paga</summary><p class="summary">Pleno (un número): 35 a 1. Docenas y columnas: 2 a 1. Rojo/negro, par/impar, 1-18/19-36: 1 a 1. Si sale el 0 pierden todas las apuestas de afuera. Elige la ficha y toca el paño para apostar.</p></details>
    <p class="tb-aviso">Las monedas son del juego: no se compran ni se cambian por plata. Jugá por diversión.</p>
  </section>`;
  on("tbAtras", () => { if (!R.girando) go("casino"); });
  if (R.girando) return;
  app.querySelectorAll("[data-ficha]").forEach(b => b.onclick = () => { R.ficha = +b.dataset.ficha; render(); });
  app.querySelectorAll("[data-ap]").forEach(b => b.onclick = () => {
    const k = b.dataset.ap;
    if (R.res) { R.res = null; }
    if (RU.total(R.ap) + R.ficha > max) { Toast.mostrar(`<div class="t-ic">🪙</div><div class="t-txt"><b>Llegaste al máximo</b><span>Puedes apostar hasta ${max} 🪙 por tirada.</span></div>`, "info"); return; }
    R.ap[k] = (R.ap[k] || 0) + R.ficha; R.deshacer.push([k, R.ficha]);
    if (typeof Sonido !== "undefined") Sonido.sfx("clic");
    render();
  });
  on("ruDes", () => { const [k, f] = R.deshacer.pop(); R.ap[k] -= f; if (R.ap[k] <= 0) delete R.ap[k]; render(); });
  on("ruBorrar", () => { R.ap = {}; R.deshacer = []; R.res = null; render(); });
  on("ruRep", () => { R.ap = { ...R.prev }; R.deshacer = Object.entries(R.ap); R.res = null; render(); });
  on("ruGirar", () => {
    const apuesta = RU.total(R.ap);
    if (!apuesta || apuesta > u.monedas) return;
    const n = Timba.azar(37), premio = RU.premio(R.ap, n);
    if (!Timba.mover(u, "ruleta", apuesta, premio, { plenos: R.ap["n" + n] ? 1 : 0 })) return;
    UI.timbaPend = premio;
    R.girando = true; R.res = { n, premio, apuesta, ap: { ...R.ap } };
    // La rueda gira 5 vueltas y deja el número arriba; la bolita gira al revés y cae
    const k = RU.RUEDA.indexOf(n), paso = 360 / 37;
    const destino = R.rot + 360 * 5 + ((((-k * paso) - R.rot) % 360) + 360) % 360;
    R.bola = R.bola % 360; const bolaDestino = -360 * 7;
    render();
    if (typeof Sonido !== "undefined") Sonido.sfx("ruleta");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const g = byId("ruGiro"), b = byId("ruBola");
      if (g) { g.style.transition = "transform 5s cubic-bezier(.12,.75,.2,1)"; g.style.transform = `rotate(${destino}deg)`; }
      if (b) { b.style.transition = "transform 5.4s cubic-bezier(.2,.7,.25,1)"; b.style.transform = `rotate(${bolaDestino}deg)`; }
      setTimeout(() => { const bo = byId("ruBolita"); if (bo) bo.classList.add("cae"); }, 4300);
    }));
    setTimeout(() => {
      R.rot = destino; R.bola = 0; R.girando = false; UI.timbaPend = 0;
      R.hist.unshift(n); R.prev = { ...R.ap }; R.ap = {}; R.deshacer = [];
      if (S.screen === "ruleta") render();
      Timba.festejo(premio, apuesta, premio >= apuesta * 20);
      if (!premio && typeof Sonido !== "undefined") Sonido.sfx("clic");
      Timba.logros(u);
    }, 5600);
  });
};

/* ---------- Tragamonedas ----------
   Cada casilla sale al azar según el peso de cada símbolo. Las líneas pagan de izquierda a derecha.
   paga[símbolo][cantidad] = veces la apuesta de esa línea. El comodín reemplaza a cualquiera; el scatter paga en cualquier lugar. */
const MAQUINAS = {
  frutas: {
    nombre: "Frutillitas", ic: "🍒", desc: "La clásica: 3 rodillos y 1 línea.", tema: "frutas", cols: 3, filas: 1, lineas: [[0, 0, 0]], apuestas: [1, 5, 10, 25, 50],
    simbolos: [["🍒", 8], ["🍋", 7], ["🍊", 6], ["🍉", 5], ["🔔", 4], ["⭐", 2], ["7️⃣", 1]],
    paga: { "🍒": { 1: 1, 2: 3, 3: 10 }, "🍋": { 3: 12 }, "🍊": { 3: 18 }, "🍉": { 3: 30 }, "🔔": { 3: 60 }, "⭐": { 3: 150 }, "7️⃣": { 3: 250 } }, jackpot: "7️⃣"
  },
  pirata: {
    nombre: "Tesoro pirata", ic: "🏴‍☠️", desc: "3×3 con 5 líneas. La bandera pirata es comodín.", tema: "pirata", cols: 3, filas: 3,
    lineas: [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]], apuestas: [1, 2, 5, 10, 20], comodin: "🏴‍☠️",
    simbolos: [["⚓", 9], ["🦀", 8], ["🐙", 6], ["🗝️", 5], ["💰", 3], ["💎", 2], ["🏴‍☠️", 1]],
    paga: { "⚓": { 3: 8 }, "🦀": { 3: 11 }, "🐙": { 3: 18 }, "🗝️": { 3: 30 }, "💰": { 3: 75 }, "💎": { 3: 150 }, "🏴‍☠️": { 3: 300 } }, jackpot: "🏴‍☠️"
  },
  deluxe: {
    nombre: "Mesa Loca Deluxe", ic: "🤪", desc: "5 rodillos, 10 líneas y 🎉 que paga en cualquier lado.", tema: "deluxe", cols: 5, filas: 3,
    lineas: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1]],
    apuestas: [1, 2, 5, 10], scatter: "🎉",
    simbolos: [["🃏", 10], ["🎲", 9], ["🍀", 7], ["🔔", 5], ["💎", 3], ["7️⃣", 2], ["🎉", 2]],
    paga: { "🃏": { 3: 7, 4: 15, 5: 40 }, "🎲": { 3: 9, 4: 20, 5: 50 }, "🍀": { 3: 14, 4: 35, 5: 90 }, "🔔": { 3: 24, 4: 70, 5: 150 }, "💎": { 3: 45, 4: 140, 5: 400 }, "7️⃣": { 3: 70, 4: 250, 5: 1000 }, "🎉": { 3: 4, 4: 20, 5: 80 } }, jackpot: "7️⃣"
  }
};

const Slots = {
  simbolo(m) {
    const tot = m.simbolos.reduce((t, s) => t + s[1], 0);
    let r = Timba.azar(tot);
    for (const [s, w] of m.simbolos) { if (r < w) return s; r -= w; }
    return m.simbolos[0][0];
  },
  tirar(m) { return Array.from({ length: m.cols }, () => Array.from({ length: m.filas }, () => Slots.simbolo(m))); },
  /* grid[col][fila] → { premio, lineas: [{ l, celdas, sym, n, pago }], jackpot } */
  evaluar(m, grid, apLinea) {
    const out = { premio: 0, lineas: [], jackpot: false };
    m.lineas.forEach((ln, l) => {
      const syms = ln.map((f, c) => grid[c][f]);
      let base = syms.find(s => s !== m.comodin && s !== m.scatter) || syms[0];
      if (base === m.scatter) return;
      let n = 0; while (n < syms.length && (syms[n] === base || syms[n] === m.comodin)) n++;
      // Tres comodines solos pagan como comodín
      if (m.comodin && syms.slice(0, n).every(s => s === m.comodin)) base = m.comodin;
      const pago = (m.paga[base] || {})[n] || 0;
      if (pago) {
        out.premio += pago * apLinea; out.lineas.push({ l, celdas: ln.slice(0, n).map((f, c) => [c, f]), sym: base, n, pago: pago * apLinea });
        if (base === m.jackpot && n === m.cols) out.jackpot = true;
      }
    });
    if (m.scatter) {
      const celdas = []; grid.forEach((col, c) => col.forEach((s, f) => { if (s === m.scatter) celdas.push([c, f]); }));
      const pago = (m.paga[m.scatter] || {})[Math.min(5, celdas.length)] || 0;
      if (pago) { const p = pago * apLinea * m.lineas.length; out.premio += p; out.lineas.push({ l: -1, celdas, sym: m.scatter, n: celdas.length, pago: p }); }
    }
    return out;
  }
};

PANTALLAS.slots = () => {
  if (Timba.sinPerfil("Tragamonedas")) return;
  const u = BD.sesion(), m = MAQUINAS[UI.maquina] || MAQUINAS.frutas, id = UI.maquina in MAQUINAS ? UI.maquina : "frutas";
  const T = UI.sl = UI.sl && UI.sl.id === id ? UI.sl : { id, ap: m.apuestas[0], grid: Slots.tirar(m), res: null, girando: false };
  const total = T.ap * m.lineas.length, ganadoras = new Set(T.res && !T.girando ? T.res.lineas.flatMap(x => x.celdas.map(c => c.join(","))) : []);
  const rod = T.grid.map((col, c) => `<div class="sl-rod" data-col="${c}"><div class="sl-tira">${col.map((s, f) => `<span class="sl-c ${ganadoras.has(c + "," + f) ? "gana" : ""}">${s}</span>`).join("")}</div></div>`).join("");
  app.innerHTML = `${Timba.cabecera(u, `${m.ic} ${esc(m.nombre)}`)}<section class="screen slots">
    <div class="sl-maq ${m.tema} ${T.res && T.res.jackpot && !T.girando ? "jackpot" : ""}" style="--cols:${m.cols};--filas:${m.filas}">
      <div class="sl-luces"></div>
      <div class="sl-titulo">${esc(m.nombre)}</div>
      <div class="sl-ventana">${rod}${m.filas > 1 ? `<div class="sl-marca"></div>` : `<div class="sl-marca uno"></div>`}</div>
      <div class="sl-lcd" id="slLcd">${T.girando ? "¡Suerte!" : T.res ? (T.res.premio ? `${T.res.jackpot ? "¡¡JACKPOT!! " : "¡Ganaste! "}+${T.res.premio} 🪙` : "Sin premio, ¡otra!") : `${m.lineas.length} línea${m.lineas.length > 1 ? "s" : ""} · ${esc(m.desc)}`}</div>
    </div>
    ${T.res && !T.girando && T.res.lineas.length ? `<p class="tb-linea">${T.res.lineas.map(x => `${x.l < 0 ? `${x.n} × ${x.sym} sueltos` : `Línea ${x.l + 1}: ${x.n} × ${x.sym}`} <b>+${x.pago}</b>`).join(" · ")}</p>` : ""}
    <div class="sl-apuesta"><span class="label">${m.lineas.length > 1 ? "Por línea" : "Apuesta"}</span>
      <div class="seg">${m.apuestas.map(a => `<button aria-pressed="${T.ap === a}" data-slap="${a}" ${T.girando || a * m.lineas.length > Math.min(Timba.maxApuesta(), u.monedas) ? "disabled" : ""}>${a}</button>`).join("")}</div>
      <small class="sub">Total por tirada: <b>${total}</b> 🪙</small></div>
    <button class="btn tb-girar" id="slGirar" ${total <= u.monedas && !T.girando ? "" : "disabled"}>${T.girando ? "Girando…" : `🎰 Girar · ${total} 🪙`}</button>
    <details class="panel"><summary class="label">Tabla de premios</summary>
      <table class="sl-tabla">${Object.entries(m.paga).map(([s, p]) => `<tr><td>${s}${s === m.comodin ? "<small> comodín</small>" : s === m.scatter ? "<small> en cualquier lado</small>" : ""}</td>${Object.entries(p).map(([n, x]) => `<td>${n === "1" ? "1" : n}× <b>${x}</b></td>`).join("")}</tr>`).join("")}</table>
      <p class="summary">${m.lineas.length > 1 ? `Los premios son por cada línea, de izquierda a derecha.${m.scatter ? ` ${m.scatter} paga sobre la apuesta total.` : ""}` : "El premio es por las veces que apostaste."}</p></details>
    <p class="tb-aviso">Las monedas son del juego: no se compran ni se cambian por plata. Jugá por diversión.</p>
  </section>`;
  on("tbAtras", () => { if (!T.girando) go("casino"); });
  if (T.girando) return;
  app.querySelectorAll("[data-slap]").forEach(b => b.onclick = () => { T.ap = +b.dataset.slap; render(); });
  on("slGirar", () => {
    if (total > u.monedas) return;
    const grid = Slots.tirar(m), res = Slots.evaluar(m, grid, T.ap);
    if (!Timba.mover(u, "tragamonedas", total, res.premio, { jackpots: res.jackpot ? 1 : 0 })) return;
    UI.timbaPend = res.premio;
    const viejo = T.grid; T.girando = true; T.res = null;
    render();
    if (typeof Sonido !== "undefined") Sonido.sfx("rodillo");
    // Cada rodillo es una tira larga: arriba lo que se veía, al medio símbolos al azar y abajo el resultado
    const H = app.querySelector(".sl-c").getBoundingClientRect().height;
    app.querySelectorAll(".sl-rod").forEach((el, c) => {
      const largo = 14 + c * 5, tira = el.querySelector(".sl-tira");
      const syms = [...viejo[c], ...Array.from({ length: largo }, () => Slots.simbolo(m)), ...grid[c]];
      tira.innerHTML = syms.map(s => `<span class="sl-c">${s}</span>`).join("");
      tira.style.transform = "translateY(0)";
      requestAnimationFrame(() => requestAnimationFrame(() => {
        tira.style.transition = `transform ${1.1 + c * 0.35}s cubic-bezier(.25,.1,.3,1.08)`;
        tira.style.transform = `translateY(${-(syms.length - m.filas) * H}px)`;
      }));
      setTimeout(() => { if (typeof Sonido !== "undefined") Sonido.sfx("clic"); }, (1.1 + c * 0.35) * 1000);
    });
    setTimeout(() => {
      T.grid = grid; T.res = res; T.girando = false; UI.timbaPend = 0;
      if (S.screen === "slots") render();
      Timba.festejo(res.premio, total, res.jackpot);
      Timba.logros(u);
    }, (1.1 + (m.cols - 1) * 0.35) * 1000 + 250);
  });
};

/* ---------- Entrada del casino ---------- */
PANTALLAS.casino = () => {
  if (Timba.sinPerfil("Casino")) return;
  const u = BD.sesion(), st = Timba.stats(u);
  app.innerHTML = `${Timba.cabecera(u, "🎰 Casino", "inicio")}<section class="screen casino">
    <div class="tb-hero"><span class="tb-neon">CASINO</span><p class="sub">Apuesta tus monedas del juego. ${st.jugadas ? `Llevas ${st.jugadas} jugadas · tu mayor premio: <b>${st.mayor} 🪙</b>.` : "¡Que la suerte te acompañe!"}</p></div>
    <button class="tb-juego ru" id="tbRuleta"><span class="tb-art">🎡</span><div><b>Ruleta</b><small>Europea, con un solo cero. Plenos 35 a 1.</small></div></button>
    <span class="label">Tragamonedas</span>
    <div class="tb-maqs">${Object.entries(MAQUINAS).map(([k, m]) => `<button class="tb-juego ${m.tema}" data-maq="${k}"><span class="tb-art">${m.ic}</span><div><b>${esc(m.nombre)}</b><small>${esc(m.desc)}</small></div></button>`).join("")}</div>
    <button class="tb-juego bi" id="tbBingo"><span class="tb-art">🎱</span><div><b>Bingo</b><small>Contra compus acá, o con amigos en "Jugar online". Hasta 3 cartones.</small></div></button>
    <p class="tb-aviso">Las monedas son del juego: no se compran ni se cambian por plata. Si un día te quedas sin monedas, juega partidas, trabajos o cobra el premio diario.</p>
  </section>`;
  on("tbAtras", () => go("home"));
  on("tbRuleta", () => go("ruleta"));
  on("tbBingo", () => go("bingoSolo"));
  app.querySelectorAll("[data-maq]").forEach(b => b.onclick = () => { UI.maquina = b.dataset.maq; go("slots"); });
};
