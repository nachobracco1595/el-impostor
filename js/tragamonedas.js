/* Tragamonedas del casino: varias máquinas con muchas líneas, comodines, giros gratis y juegos de bonus.
   - Cada tirada se resuelve entera al tocar Girar (giros gratis y bonus incluidos) y después se anima:
     así el servidor recibe una sola jugada con la apuesta y el premio total.
   - Todas las máquinas pueden ganar el POZO acumulado (lo sortea el servidor en cada tirada, ver Timba). */

/* Líneas de 5 rodillos × 3 filas (las 25 de siempre); las de 4 filas salen de correrlas una fila */
const LINEAS5 = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 2, 2, 0],
  [2, 0, 0, 0, 2], [1, 0, 2, 0, 1], [1, 2, 0, 2, 1], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2]];
const LINEAS54 = (() => { const out = [], ya = new Set(); for (const d of [0, 1]) for (const l of LINEAS5) { const x = l.map(f => f + d), k = x.join(""); if (!ya.has(k)) { ya.add(k); out.push(x); } } [[3, 3, 3, 3, 3], [0, 1, 2, 3, 3], [3, 2, 1, 0, 0]].forEach(x => { const k = x.join(""); if (!ya.has(k)) { ya.add(k); out.unshift(x); } }); return out.slice(0, 40); })();

/* paga[símbolo][cantidad] = veces la apuesta por línea. comodin reemplaza a todos menos scatter y bonus.
   scatter: paga sobre la apuesta total y da giros gratis. bonus: abre el juego de bonus (cofres o rueda). */
const MAQUINAS = {
  frutas: {
    nombre: "Frutillitas", ic: "🍒", tema: "frutas", desc: "3×3 con 5 líneas. ⭐ es comodín y 3 🔔 dan giros gratis ×2.",
    cols: 3, filas: 3, lineas: LINEAS5.slice(0, 5).map(l => l.slice(0, 3)),
    comodin: "⭐", scatter: "🔔", giros: { 3: 6 }, multGiros: 2, pagaScatter: { 3: 2 },
    simbolos: [["🍒", 12], ["🍋", 10], ["🍊", 9], ["🍇", 7], ["🍉", 6], ["7️⃣", 3], ["⭐", 2], ["🔔", 3]],
    paga: { "🍒": { 2: 1, 3: 4 }, "🍋": { 3: 8 }, "🍊": { 3: 10 }, "🍇": { 3: 15 }, "🍉": { 3: 20 }, "7️⃣": { 3: 60 }, "⭐": { 3: 100 } }
  },
  pirata: {
    nombre: "Tesoro Pirata", ic: "🏴‍☠️", tema: "pirata", desc: "5×3 con 20 líneas. Giros gratis con 🗺️ y el bonus de los cofres con 🧰.",
    cols: 5, filas: 3, lineas: LINEAS5.slice(0, 20),
    comodin: "🏴‍☠️", scatter: "🗺️", giros: { 3: 10, 4: 15, 5: 20 }, multGiros: 2, pagaScatter: { 3: 2, 4: 10, 5: 50 },
    bonus: "🧰", bonusEn: [0, 2, 4], tipoBonus: "cofres",
    simbolos: [["⚓", 14], ["🦀", 13], ["🐙", 11], ["🦜", 9], ["🗝️", 7], ["💰", 5], ["💎", 3], ["🏴‍☠️", 2], ["🗺️", 2], ["🧰", 3]],
    paga: { "⚓": { 3: 5, 4: 15, 5: 50 }, "🦀": { 3: 5, 4: 15, 5: 50 }, "🐙": { 3: 8, 4: 25, 5: 80 }, "🦜": { 3: 10, 4: 30, 5: 100 }, "🗝️": { 3: 15, 4: 50, 5: 150 }, "💰": { 3: 25, 4: 80, 5: 300 }, "💎": { 3: 40, 4: 150, 5: 600 }, "🏴‍☠️": { 3: 60, 4: 250, 5: 1000 } }
  },
  dragon: {
    nombre: "Dragón de la Fortuna", ic: "🐉", tema: "dragon", desc: "5×3 con 25 líneas. 🧧 da giros gratis ×3 y 🏮 gira la rueda de la fortuna.",
    cols: 5, filas: 3, lineas: LINEAS5,
    comodin: "🐉", scatter: "🧧", giros: { 3: 8, 4: 12, 5: 16 }, multGiros: 3, pagaScatter: { 3: 3, 4: 15, 5: 60 },
    bonus: "🏮", bonusEn: [1, 2, 3], tipoBonus: "rueda",
    simbolos: [["🎋", 14], ["🍵", 13], ["🐟", 11], ["🐼", 9], ["🐯", 7], ["🪙", 5], ["💮", 3], ["🐉", 2], ["🧧", 2], ["🏮", 3]],
    paga: { "🎋": { 3: 5, 4: 12, 5: 40 }, "🍵": { 3: 5, 4: 12, 5: 40 }, "🐟": { 3: 8, 4: 20, 5: 70 }, "🐼": { 3: 10, 4: 30, 5: 100 }, "🐯": { 3: 15, 4: 50, 5: 150 }, "🪙": { 3: 25, 4: 80, 5: 300 }, "💮": { 3: 40, 4: 150, 5: 500 }, "🐉": { 3: 60, 4: 250, 5: 1000 } }
  },
  deluxe: {
    nombre: "Mesa Loca Deluxe", ic: "🤪", tema: "deluxe", desc: "5×4 con 40 líneas. 🎉 da giros gratis ×2 y 🎁 abre los regalos sorpresa.",
    cols: 5, filas: 4, lineas: LINEAS54,
    comodin: "🤪", scatter: "🎉", giros: { 3: 10, 4: 15, 5: 25 }, multGiros: 2, pagaScatter: { 3: 2, 4: 10, 5: 40 },
    bonus: "🎁", bonusEn: [0, 2, 4], tipoBonus: "cofres",
    simbolos: [["🃏", 14], ["🎲", 13], ["🍀", 11], ["🔔", 9], ["🎩", 7], ["💎", 5], ["7️⃣", 3], ["🤪", 2], ["🎉", 2], ["🎁", 3]],
    paga: { "🃏": { 3: 4, 4: 10, 5: 30 }, "🎲": { 3: 4, 4: 10, 5: 30 }, "🍀": { 3: 6, 4: 18, 5: 60 }, "🔔": { 3: 8, 4: 25, 5: 80 }, "🎩": { 3: 12, 4: 40, 5: 120 }, "💎": { 3: 20, 4: 70, 5: 250 }, "7️⃣": { 3: 35, 4: 120, 5: 500 }, "🤪": { 3: 50, 4: 200, 5: 1000 } }
  }
};
/* Ajuste fino de cada máquina para que devuelva cerca del 94% de lo apostado (medido con simulación) */
const SL_AJUSTE = { frutas: 1.12, pirata: 1.49, dragon: 1.65, deluxe: 1.38 };
const SL_APUESTAS = [10, 20, 40, 50, 100, 200, 400, 500, 1000, 2000, 5000, 10000, 20000, 50000];
const SL_TOPE = 900;   // un tirada nunca paga más de 900 veces lo apostado (el servidor acepta hasta 1000)

const Slots = {
  rnd: n => typeof Timba !== "undefined" ? Timba.azar(n) : Math.floor(Math.random() * n),
  simbolo(m, c, giro) {
    for (let k = 0; k < 20; k++) {
      const lista = m.simbolos.filter(([s]) => !(giro && s === m.bonus)), tot = lista.reduce((t, s) => t + s[1], 0);
      let r = Slots.rnd(tot), s = lista[0][0];
      for (const [x, w] of lista) { if (r < w) { s = x; break; } r -= w; }
      if (s === m.bonus && m.bonusEn && !m.bonusEn.includes(c)) continue;
      return s;
    }
    return m.simbolos[0][0];
  },
  tirar(m, giro) { return Array.from({ length: m.cols }, (_, c) => { const col = []; for (let f = 0; f < m.filas; f++) { let s = Slots.simbolo(m, c, giro); while ((s === m.scatter || s === m.bonus) && col.includes(s)) s = Slots.simbolo(m, c, giro); col.push(s); } return col; }); },
  /* Líneas ganadoras, scatter y bonus de una grilla (grid[col][fila]); apLinea puede tener decimales */
  evaluar(m, grid, apLinea, mult = 1, ajuste = 1) {
    const out = { premio: 0, lineas: [], scatter: 0, bonus: 0, celdasSc: [], celdasBo: [] };
    m.lineas.forEach((ln, l) => {
      const syms = ln.map((f, c) => grid[c][f]);
      if (syms[0] === m.scatter || syms[0] === m.bonus) return;
      let base = syms.find(s => s !== m.comodin) || m.comodin;
      if (base === m.scatter || base === m.bonus) base = m.comodin;
      let n = 0; while (n < syms.length && (syms[n] === base || syms[n] === m.comodin)) n++;
      // Una línea que arranca con comodines puede pagar más como comodín solo
      let nw = 0; while (nw < syms.length && syms[nw] === m.comodin) nw++;
      let pago = ((m.paga[base] || {})[n] || 0), sym = base, cant = n;
      const pw = (m.paga[m.comodin] || {})[nw] || 0;
      if (pw > pago) { pago = pw; sym = m.comodin; cant = nw; }
      // El comodín en la línea duplica en Frutillitas (máquina clásica)
      if (pago && m.cols === 3 && sym !== m.comodin && syms.slice(0, cant).includes(m.comodin)) pago *= 2;
      if (pago) { const p = pago * apLinea * mult * ajuste; out.premio += p; out.lineas.push({ l, celdas: ln.slice(0, cant).map((f, c) => [c, f]), sym, n: cant, pago: p }); }
    });
    grid.forEach((col, c) => col.forEach((s, f) => { if (s === m.scatter) out.celdasSc.push([c, f]); if (s === m.bonus) out.celdasBo.push([c, f]); }));
    out.scatter = out.celdasSc.length; out.bonus = out.celdasBo.length;
    const ps = (m.pagaScatter || {})[Math.min(5, out.scatter)] || 0;
    if (ps) { const p = ps * apLinea * m.lineas.length * mult * ajuste; out.premio += p; out.lineas.push({ l: -1, celdas: out.celdasSc, sym: m.scatter, n: out.scatter, pago: p }); }
    return out;
  },
  /* Premios del bonus, en veces la apuesta total */
  COFRES: [2, 3, 3, 4, 5, 5, 6, 8, 10, 12, 15, 20, 25, 40],
  RUEDA: [[5, 6], [8, 6], [10, 5], [12, 5], [15, 4], [20, 3], [25, 3], [30, 2], [50, 1.5], [100, 0.5]],
  bonus(m, total, ajuste) {
    if (m.tipoBonus === "rueda") {
      const tot = Slots.RUEDA.reduce((t, x) => t + x[1] * 10, 0); let r = Slots.rnd(tot), k = 0;
      for (; k < Slots.RUEDA.length; k++) { if (r < Slots.RUEDA[k][1] * 10) break; r -= Slots.RUEDA[k][1] * 10; }
      k = Math.min(k, Slots.RUEDA.length - 1);
      return { tipo: "rueda", k, x: Slots.RUEDA[k][0], premio: Slots.RUEDA[k][0] * total * ajuste };
    }
    // Cofres: 12 cerrados, se abren 3; lo que hay adentro se sortea ahora (los otros se muestran al final)
    const caja = Array.from({ length: 12 }, () => Slots.COFRES[Slots.rnd(Slots.COFRES.length)]);
    const mios = caja.slice(0, 3), x = mios.reduce((t, v) => t + v, 0);
    return { tipo: "cofres", caja, mios, x, premio: x * total * ajuste };
  },
  /* Una tirada completa: base, bonus y giros gratis (con regiros, hasta 50) */
  jugar(id, total) {
    const m = MAQUINAS[id], aj = SL_AJUSTE[id] || 1, apLinea = total / m.lineas.length;
    const grid = Slots.tirar(m), base = Slots.evaluar(m, grid, apLinea, 1, aj);
    const out = { grid, base, bonus: null, giros: [], mult: m.multGiros || 1, premio: base.premio };
    if (m.bonus && base.bonus >= 3) { out.bonus = Slots.bonus(m, total, aj); out.premio += out.bonus.premio; }
    let quedan = m.giros ? m.giros[Math.min(5, base.scatter)] || 0 : 0, hechos = 0;
    out.girosGanados = quedan;
    while (quedan > 0 && hechos < 50) {
      const g = Slots.tirar(m, true), r = Slots.evaluar(m, g, apLinea, out.mult, aj), extra = m.giros[Math.min(5, r.scatter)] || 0;
      out.giros.push({ grid: g, res: r, extra }); out.premio += r.premio; quedan += extra - 1; hechos++;
    }
    out.premio = Math.min(Math.round(out.premio), total * SL_TOPE);
    return out;
  },
  apuestas(m, u) { const mx = Math.min(Timba.maxApuesta(), Math.max(Timba.saldo(u), SL_APUESTAS[0])); return SL_APUESTAS.filter(a => a <= mx); }
};

/* ---------- Pantalla de la máquina ---------- */
PANTALLAS.slots = () => {
  if (Timba.sinPerfil("Tragamonedas")) return;
  const u = BD.sesion(), id = UI.maquina in MAQUINAS ? UI.maquina : "frutas", m = MAQUINAS[id];
  const T = UI.sl = UI.sl && UI.sl.id === id ? UI.sl : { id, ap: null, grid: Slots.tirar(m), girando: false, msg: "", auto: 0 };
  const opciones = Slots.apuestas(m, u);
  if (!T.ap || !SL_APUESTAS.includes(T.ap)) T.ap = opciones[Math.min(2, opciones.length - 1)] || 10;
  app.innerHTML = `${Timba.cabecera(u, `${m.ic} ${esc(m.nombre)}`)}<section class="screen slots">
    ${Timba.bannerPozo()}
    <div class="sl-maq ${m.tema}" id="slMaq" style="--cols:${m.cols};--filas:${m.filas}">
      <div class="sl-luces"></div>
      <div class="sl-titulo">${esc(m.nombre)}</div>
      <div class="sl-giros" id="slGiros" hidden></div>
      <div class="sl-ventana" id="slVentana">${Slots.htmlRodillos(m, T.grid)}</div>
      <div class="sl-lcd" id="slLcd">${T.msg || `${m.lineas.length} líneas · ${esc(m.desc)}`}</div>
      <div class="sl-bonus" id="slBonus" hidden></div>
    </div>
    <p class="tb-linea" id="slDetalle"></p>
    <div class="sl-ctrl">
      <div class="sl-apuesta"><button class="sl-mm" id="slMenos" aria-label="Bajar la apuesta">−</button><div><small>Apuesta</small><b id="slAp">${num(T.ap)}</b><small>${num(Math.round(T.ap / m.lineas.length * 100) / 100)} por línea</small></div><button class="sl-mm" id="slMas" aria-label="Subir la apuesta">+</button></div>
      <button class="btn tb-girar sl-girar" id="slGirar">GIRAR</button>
      <button class="sl-auto ${T.auto ? "on" : ""}" id="slAuto" aria-pressed="${!!T.auto}">${T.auto ? `AUTO<br><b>${T.auto}</b>` : "AUTO<br>×10"}</button>
    </div>
    <details class="panel"><summary class="label">Tabla de premios y reglas</summary>
      <table class="sl-tabla">${Object.entries(m.paga).map(([s, p]) => `<tr><td>${s}${s === m.comodin ? "<small> comodín</small>" : ""}</td>${Object.entries(p).map(([n, x]) => `<td>${n}× <b>${x}</b></td>`).join("")}</tr>`).join("")}
        ${m.scatter ? `<tr><td>${m.scatter}<small> giros gratis</small></td>${Object.entries(m.giros).map(([n, g]) => `<td>${n}× <b>${g} giros</b></td>`).join("")}</tr>` : ""}</table>
      <p class="summary">Los premios de la tabla son veces la apuesta por línea, de izquierda a derecha y en las ${m.lineas.length} líneas. ${m.comodin} reemplaza a cualquier símbolo menos ${m.scatter}${m.bonus ? ` y ${m.bonus}` : ""}.${m.cols === 3 ? ` Una línea con ${m.comodin} paga el doble.` : ""}
        ${m.scatter} en cualquier lugar paga sobre la apuesta total y da giros gratis con todo multiplicado ×${m.multGiros} (y se pueden volver a ganar giros).
        ${m.bonus ? `3 ${m.bonus} (en los rodillos ${m.bonusEn.map(c => c + 1).join(", ")}) abren ${m.tipoBonus === "rueda" ? "la rueda de la fortuna: paga de 5 a 100 veces la apuesta" : "el bonus: elegís 3 de 12 cofres y te llevás lo que hay adentro (de 2 a 40 veces la apuesta cada uno)"}.` : ""}
        Cada tirada puede ganar además el <b>pozo acumulado</b>.</p></details>
    <p class="tb-aviso">Las monedas son del juego: no se compran ni se cambian por plata. Jugá por diversión.</p>
  </section>`;
  on("tbAtras", () => { if (!T.girando) { T.auto = 0; go("casino"); } else { T.auto = 0; Slots.botones(); } });
  Slots.botones();
  Timba.pintarPozo();
  on("slMenos", () => { const o = Slots.apuestas(m, u), k = o.indexOf(T.ap); T.ap = o[Math.max(0, (k < 0 ? o.length : k) - 1)] || T.ap; Slots.pintarApuesta(); });
  on("slMas", () => { const o = Slots.apuestas(m, u), k = o.indexOf(T.ap); T.ap = o[Math.min(o.length - 1, k + 1)] || T.ap; Slots.pintarApuesta(); });
  on("slGirar", () => Slots.tirada());
  on("slAuto", () => { T.auto = T.auto ? 0 : 10; Slots.botones(); if (T.auto && !T.girando) Slots.tirada(); });
};

Object.assign(Slots, {
  htmlRodillos(m, grid, gana = new Set(), clase = {}) {
    return grid.map((col, c) => `<div class="sl-rod" data-col="${c}"><div class="sl-tira">${col.map((s, f) => `<span class="sl-c ${gana.has(c + "," + f) ? "gana" : ""} ${clase[c + "," + f] || ""}">${s}</span>`).join("")}</div></div>`).join("")
      + `<svg class="sl-lineas" id="slLineas" viewBox="0 0 ${m.cols} ${m.filas}" preserveAspectRatio="none" aria-hidden="true"></svg>`;
  },
  pintarApuesta() {
    const T = UI.sl, m = MAQUINAS[T.id], a = byId("slAp"); if (!a) return;
    a.textContent = num(T.ap); a.nextElementSibling.textContent = `${num(Math.round(T.ap / m.lineas.length * 100) / 100)} por línea`;
    Slots.botones();
  },
  botones() {
    const T = UI.sl, u = BD.sesion(); if (!T || !u) return;
    const o = Slots.apuestas(MAQUINAS[T.id], u), g = byId("slGirar"); if (!g) return;
    g.disabled = T.girando || T.ap > Timba.saldo(u) || T.ap > Timba.maxApuesta();
    g.textContent = T.girando ? (T.auto ? "PARAR AUTO" : "…") : "GIRAR";
    if (T.girando && T.auto) { g.disabled = false; g.onclick = () => { T.auto = 0; Slots.botones(); }; } else g.onclick = () => Slots.tirada();
    byId("slMenos").disabled = T.girando || o.indexOf(T.ap) <= 0;
    byId("slMas").disabled = T.girando || o.indexOf(T.ap) >= o.length - 1;
    const au = byId("slAuto"); au.classList.toggle("on", !!T.auto); au.setAttribute("aria-pressed", !!T.auto); au.innerHTML = T.auto ? `AUTO<br><b>${T.auto}</b>` : "AUTO<br>×10";
  },
  lcd(txt, cls = "") { const e = byId("slLcd"); if (e) { e.innerHTML = txt; e.className = "sl-lcd " + cls; } UI.sl.msg = txt; },
  espera: ms => new Promise(r => setTimeout(r, ms)),
  /* Gira los rodillos hasta la grilla nueva (rápido en los giros gratis) */
  girar(m, grid, vel = 1) {
    const T = UI.sl, viejo = T.grid; T.grid = grid;
    const ven = byId("slVentana"); if (!ven) return Promise.resolve();
    ven.innerHTML = Slots.htmlRodillos(m, viejo);
    const c0 = ven.querySelector(".sl-c"), H = c0 ? c0.getBoundingClientRect().height : 60;
    if (typeof Sonido !== "undefined") Sonido.sfx("rodillo");
    const durs = [];
    ven.querySelectorAll(".sl-rod").forEach((el, c) => {
      const largo = Math.round((10 + c * 4) * vel), tira = el.querySelector(".sl-tira"), d = (0.55 + c * 0.22) * vel + 0.25;
      const syms = [...viejo[c], ...Array.from({ length: largo }, () => Slots.simbolo(m, c)), ...grid[c]];
      tira.innerHTML = syms.map(s => `<span class="sl-c">${s}</span>`).join("");
      tira.style.transform = "translateY(0)"; durs.push(d);
      requestAnimationFrame(() => requestAnimationFrame(() => { tira.style.transition = `transform ${d}s cubic-bezier(.3,.1,.3,1.1)`; tira.style.transform = `translateY(${-(syms.length - m.filas) * H}px)`; }));
      setTimeout(() => { if (typeof Sonido !== "undefined") Sonido.sfx("clic"); }, d * 1000);
    });
    return Slots.espera(Math.max(...durs) * 1000 + 120).then(() => { const v = byId("slVentana"); if (v) v.innerHTML = Slots.htmlRodillos(m, grid); });
  },
  /* Marca las líneas ganadoras con su trazo y deja brillando las casillas */
  marcar(m, grid, res) {
    const ven = byId("slVentana"); if (!ven) return;
    const gana = new Set(res.lineas.flatMap(x => x.celdas.map(c => c.join(",")))), clase = {};
    res.celdasSc.forEach(([c, f]) => clase[c + "," + f] = "sc"); res.celdasBo.forEach(([c, f]) => clase[c + "," + f] = "bo");
    ven.innerHTML = Slots.htmlRodillos(m, grid, gana, clase);
    const svg = byId("slLineas"), colores = ["#ffd43b", "#ff6b6b", "#4dabf7", "#69db7c", "#f783ac", "#ffa94d", "#b197fc", "#3bc9db"];
    svg.innerHTML = res.lineas.filter(x => x.l >= 0).map((x, k) => `<polyline points="${m.lineas[x.l].map((f, c) => `${c + 0.5},${f + 0.5}`).join(" ")}" stroke="${colores[k % colores.length]}" />`).join("");
    const det = byId("slDetalle");
    if (det) det.innerHTML = res.lineas.slice(0, 8).map(x => `${x.l < 0 ? `${x.n} × ${x.sym}` : `Línea ${x.l + 1}: ${x.n} × ${x.sym}`} <b>+${num(Math.round(x.pago))}</b>`).join(" · ") + (res.lineas.length > 8 ? ` · y ${res.lineas.length - 8} más` : "");
  },
  async tirada() {
    const T = UI.sl, u = BD.sesion(), m = MAQUINAS[T.id]; if (!T || !u || T.girando) return;
    const total = T.ap;
    if (total > Timba.saldo(u) || total > Timba.maxApuesta()) { T.auto = 0; Slots.botones(); if (total > Timba.saldo(u)) Toast.mostrar(`<div class="t-ic">🪙</div><div class="t-txt"><b>No te alcanzan las monedas</b><span>Bajá la apuesta.</span></div>`, "info"); return; }
    const out = Slots.jugar(T.id, total), grande = out.premio >= total * 100;
    if (!Timba.mover(u, "tragamonedas", total, out.premio, { jackpots: grande ? 1 : 0 })) return;
    UI.timbaPend = out.premio; T.girando = true; if (T.auto) T.auto--;
    Slots.botones(); Timba.pintarSaldo(); Slots.lcd("¡Suerte!"); const det = byId("slDetalle"); if (det) det.innerHTML = "";
    const g = byId("slGiros"); if (g) g.hidden = true;
    await Slots.girar(m, out.grid);
    let cobrado = 0;
    const cobrar = p => { cobrado += p; UI.timbaPend = Math.max(0, out.premio - cobrado); Timba.pintarSaldo(); };
    if (out.base.premio > 0 || out.base.scatter >= 3 || out.base.bonus >= 3) Slots.marcar(m, out.grid, out.base);
    if (out.base.premio > 0) { const p = Math.round(out.base.premio); Slots.lcd(`¡Ganaste! +${num(p)} 🪙`, "gana"); cobrar(p); Timba.festejo(p, total, false); await Slots.espera(900); }
    else if (!out.bonus && !out.giros.length) Slots.lcd("Sin premio, ¡otra!");
    if (out.bonus) { await Slots.espera(400); cobrar(await Slots.jugarBonus(m, out.bonus, total)); }
    if (out.giros.length) cobrar(await Slots.girosGratis(m, out, total));
    // Lo que falta por redondeo o por el tope
    cobrar(Math.max(0, out.premio - cobrado));
    if (out.premio > 0) {
      Slots.lcd(`${out.bonus || out.giros.length ? "Total de la tirada: " : "¡Ganaste! "}+${num(out.premio)} 🪙`, "gana");
      if (out.premio >= total * 15) await Timba.granPremio(out.premio, total);
    }
    T.girando = false; UI.timbaPend = 0; Timba.pintarSaldo(); Slots.botones();
    Timba.logros(u);
    if (T.auto && S.screen === "slots" && UI.sl === T) { await Slots.espera(out.premio ? 900 : 350); if (T.auto && S.screen === "slots" && !T.girando) Slots.tirada(); }
  },
  async girosGratis(m, out, total) {
    const T = UI.sl, g = byId("slGiros");
    Slots.lcd(`¡${out.girosGanados} GIROS GRATIS! Todo paga ×${out.mult}`, "bonus");
    if (typeof Sonido !== "undefined") { Sonido.sfx("logro"); Sonido.musica("bonus"); }
    await Timba.cartel(`${out.girosGanados} GIROS GRATIS`, `Todos los premios ×${out.mult}`);
    let suma = 0, totalGiros = out.girosGanados;
    for (let k = 0; k < out.giros.length; k++) {
      const x = out.giros[k], gg = byId("slGiros");
      if (gg) { gg.hidden = false; gg.innerHTML = `GIRO GRATIS <b>${k + 1}</b> de ${totalGiros} · ×${out.mult} · Ganado <b>${num(Math.round(suma))}</b>`; }
      await Slots.girar(m, x.grid, 0.6);
      if (x.res.premio > 0 || x.res.scatter >= 3) Slots.marcar(m, x.grid, x.res);
      if (x.res.premio > 0) { suma += x.res.premio; if (typeof Sonido !== "undefined") Sonido.sfx("monedas"); Slots.lcd(`+${num(Math.round(x.res.premio))} 🪙`, "gana"); }
      if (x.extra) { totalGiros += x.extra; Slots.lcd(`¡+${x.extra} giros más!`, "bonus"); if (typeof Sonido !== "undefined") Sonido.sfx("logro"); await Slots.espera(700); }
      await Slots.espera(x.res.premio > 0 ? 700 : 250);
    }
    if (g) g.hidden = true; const g2 = byId("slGiros"); if (g2) g2.hidden = true;
    const p = Math.round(suma);
    if (typeof Sonido !== "undefined") Sonido.musica(escenaMusical());
    await Timba.cartel("FIN DE LOS GIROS", `Ganaste ${num(p)} 🪙`);
    return p;
  },
  /* Bonus de cofres (elegís 3) o rueda de la fortuna */
  jugarBonus(m, b, total) {
    const caja = byId("slBonus"); const p = Math.round(b.premio);
    if (!caja) return Promise.resolve(p);
    if (typeof Sonido !== "undefined") { Sonido.sfx("logro"); Sonido.musica("bonus"); }
    caja.hidden = false;
    const fin = () => { if (typeof Sonido !== "undefined") Sonido.musica(escenaMusical()); };
    if (b.tipo === "rueda") {
      const n = Slots.RUEDA.length, paso = 360 / n, colores = ["#c92a2a", "#e8590c", "#f08c00", "#2f9e44", "#1971c2", "#6741d9", "#c2255c", "#0c8599", "#e67700", "#862e9c"];
      const sect = Slots.RUEDA.map(([x], k) => { const a0 = (k * paso - paso / 2) * Math.PI / 180, a1 = (k * paso + paso / 2) * Math.PI / 180, R = 96;
        const p0 = [R * Math.sin(a0), -R * Math.cos(a0)], p1 = [R * Math.sin(a1), -R * Math.cos(a1)], tx = 66 * Math.sin(k * paso * Math.PI / 180), ty = -66 * Math.cos(k * paso * Math.PI / 180);
        return `<path d="M0 0L${p0[0].toFixed(1)} ${p0[1].toFixed(1)}A${R} ${R} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}Z" fill="${colores[k % colores.length]}" stroke="#ffd43b" stroke-width="1.5"/><text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" transform="rotate(${k * paso} ${tx.toFixed(1)} ${ty.toFixed(1)})" class="sl-rt">×${x}</text>`; }).join("");
      caja.innerHTML = `<div class="sl-bonus-caja"><h3>RUEDA DE LA FORTUNA</h3><p>Girá la rueda: paga de 5 a 100 veces tu apuesta</p>
        <div class="sl-rueda"><svg viewBox="-100 -100 200 200"><g id="slRueda">${sect}<circle r="16" fill="#ffd43b"/></g><path d="M0 -102 L-9 -84 L9 -84Z" fill="#fff" stroke="#000" stroke-width="1"/></svg></div>
        <button class="btn tb-girar" id="slRuedaGo">GIRAR LA RUEDA</button><p class="sl-bonus-res" id="slBonRes"></p></div>`;
      return new Promise(res => {
        let listo = false;
        const ir = () => {
          if (listo) return; listo = true; byId("slRuedaGo").disabled = true;
          const g = byId("slRueda"), destino = 360 * 6 - b.k * paso;
          if (typeof Sonido !== "undefined") Sonido.sfx("ruleta");
          g.style.transition = "transform 4.2s cubic-bezier(.15,.7,.2,1)"; g.style.transform = `rotate(${destino}deg)`;
          setTimeout(async () => {
            const r = byId("slBonRes"); if (r) r.innerHTML = `¡×${b.x}! Ganaste <b>${num(p)} 🪙</b>`;
            Timba.festejo(p, total, b.x >= 50); await Slots.espera(1800);
            const c = byId("slBonus"); if (c) c.hidden = true; fin(); res(p);
          }, 4400);
        };
        on("slRuedaGo", ir);
        setTimeout(() => { if (UI.sl && UI.sl.auto) ir(); }, 1500);   // en automático gira sola
        setTimeout(() => { if (!listo) ir(); }, 20000);
      });
    }
    // Cofres
    caja.innerHTML = `<div class="sl-bonus-caja"><h3>¡BONUS DE ${m.bonus === "🎁" ? "REGALOS" : "COFRES"}!</h3><p>Elegí 3: cada uno tiene un premio adentro</p>
      <div class="sl-cofres">${b.caja.map((_, k) => `<button class="sl-cofre" data-cofre="${k}">${m.bonus}</button>`).join("")}</div>
      <p class="sl-bonus-res" id="slBonRes">Te quedan <b>3</b></p></div>`;
    return new Promise(res => {
      let abiertos = 0, suma = 0; const usados = new Set();
      const abrir = k => {
        if (usados.has(k) || abiertos >= 3) return;
        usados.add(k); const v = b.mios[abiertos]; abiertos++; suma += v;
        const el = caja.querySelector(`[data-cofre="${k}"]`); if (el) { el.classList.add("abierto"); el.innerHTML = `<b>×${v}</b>`; }
        if (typeof Sonido !== "undefined") Sonido.sfx(v >= 15 ? "victoria" : "monedas");
        const r = byId("slBonRes");
        if (abiertos < 3) { if (r) r.innerHTML = `×${suma} hasta ahora · te quedan <b>${3 - abiertos}</b>`; return; }
        // Se muestran los que no abriste
        let otros = b.caja.slice(3);
        caja.querySelectorAll(".sl-cofre").forEach(e => { if (!usados.has(+e.dataset.cofre)) { e.classList.add("otro"); e.innerHTML = `×${otros.shift()}`; } });
        if (r) r.innerHTML = `¡×${b.x}! Ganaste <b>${num(p)} 🪙</b>`;
        Timba.festejo(p, total, b.x >= 40);
        setTimeout(() => { const c = byId("slBonus"); if (c) c.hidden = true; fin(); res(p); }, 2200);
      };
      caja.querySelectorAll("[data-cofre]").forEach(e => e.onclick = () => abrir(+e.dataset.cofre));
      // En automático (o si no toca nada) se abren solos
      const solo = () => { const libres = b.caja.map((_, k) => k).filter(k => !usados.has(k)); if (libres.length && abiertos < 3) { abrir(libres[Slots.rnd(libres.length)]); if (abiertos < 3) setTimeout(solo, 700); } };
      if (UI.sl && UI.sl.auto) setTimeout(solo, 1200);
      setTimeout(() => { if (abiertos < 3) solo(); }, 25000);
    });
  }
});
