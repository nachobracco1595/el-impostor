/* Blackjack (21) contra la banca.
   - Zapato de 6 mazos; se vuelve a mezclar cuando quedan pocas cartas.
   - La banca pide hasta 16 y se planta en 17 (también en 17 blando). Blackjack paga 3 a 2.
   - Se puede doblar con las dos primeras cartas y separar pares (hasta 4 manos; los ases separados reciben una carta).
   - Solo en el Casino (con compañeros bots si querés) u online con amigos: cada uno apuesta sus monedas o, en mesa amistosa, fichas.
   - Las monedas se cobran todas juntas al terminar la mano (si alguien se va en el medio, la apuesta se cobra igual). */
const BJ = {
  MAZOS: 6,
  FICHAS: [5, 10, 25, 50, 100],
  BOTS: ["🤖 Lola", "🤖 Tano", "🤖 Pocha"],
  FICHAS_MESA: 1000
};

const Blackjack = {
  /* ---------- Cartas ---------- */
  zapato() { const z = []; for (let k = 0; k < BJ.MAZOS; k++) for (const p of "shdc") for (const r of PK.RANGOS) z.push(r + p); return shuffle(z); },
  valor: c => c[0] === "A" ? 11 : "TJQK".includes(c[0]) ? 10 : +c[0],
  total(cartas) {
    let t = 0, ases = 0;
    for (const c of cartas) { t += Blackjack.valor(c); if (c[0] === "A") ases++; }
    while (t > 21 && ases) { t -= 10; ases--; }
    return { t, blanda: ases > 0 && t <= 21 };
  },
  esBJ: m => m.c.length === 2 && !m.separada && Blackjack.total(m.c).t === 21,
  sacar(s) { if (!s.zapato.length) { s.zapato = Blackjack.zapato(); s.barajo = s.mov; } return s.zapato.pop(); },

  setup(jug, cfg) {
    return {
      id: "bj-" + Math.random().toString(36).slice(2, 10), cfg: { monedas: cfg.monedas !== false, max: cfg.max || 500 },
      zapato: Blackjack.zapato(), barajo: -1, crup: [], fase: "apuestas", turno: null, mov: 0, ronda: 0, aviso: "",
      jug: jug.map(j => ({ id: j.id, name: j.name, cpu: !!j.cpu, fichas: BJ.FICHAS_MESA, apuesta: j.cpu ? Blackjack.apuestaBot() : (j.apuesta || 0), listo: !!j.cpu, manos: [], premio: 0, apostado: 0 }))
    };
  },
  apuestaBot: () => [10, 10, 25, 25, 50][Timba.azar(5)],
  comprometido: J => J.manos.reduce((t, m) => t + m.ap, 0),
  topeFichas(s, J) { return s.cfg.monedas ? Infinity : J.fichas; },

  /* ---------- La mano ---------- */
  repartir(s) {
    const juegan = s.jug.filter(j => j.apuesta > 0 && (j.listo || j.cpu));
    if (!juegan.length || s.fase !== "apuestas") return false;
    if (s.zapato.length < 75) { s.zapato = Blackjack.zapato(); s.barajo = s.mov + 1; }
    s.ronda++; s.crup = []; s.aviso = "";
    s.jug.forEach(J => {
      if (J.cpu && J.fichas < 50) J.fichas = BJ.FICHAS_MESA;
      const juega = J.apuesta > 0 && (J.listo || J.cpu) && J.apuesta <= Blackjack.topeFichas(s, J);
      J.manos = juega ? [{ c: [], ap: J.apuesta, doblada: false, separada: false, lista: false, res: null }] : [];
      J.premio = 0; J.apostado = 0;
    });
    for (let k = 0; k < 2; k++) { s.jug.forEach(J => J.manos.forEach(m => m.c.push(Blackjack.sacar(s)))); s.crup.push(Blackjack.sacar(s)); }
    s.jug.forEach(J => J.manos.forEach(m => { if (Blackjack.esBJ(m)) m.lista = true; }));
    s.fase = "juego"; s.turno = null; s.mov++;
    // La banca mira si tiene blackjack cuando muestra un As o una figura
    if (Blackjack.valor(s.crup[0]) >= 10 && Blackjack.total(s.crup).t === 21) { s.aviso = "¡La banca tiene blackjack!"; return Blackjack.liquidar(s), true; }
    Blackjack.siguiente(s);
    return true;
  },
  siguiente(s) {
    const desde = s.turno ? s.turno : { i: 0, m: -1 };
    for (let i = desde.i; i < s.jug.length; i++) {
      const manos = s.jug[i].manos;
      for (let m = i === desde.i ? desde.m + 1 : 0; m < manos.length; m++) if (!manos[m].lista) { s.turno = { i, m }; return; }
    }
    s.turno = null; s.fase = "crupier"; s.mov++;
  },
  manoTurno(s) { return s.turno ? s.jug[s.turno.i].manos[s.turno.m] : null; },
  puede(s, J, m) {
    const t = Blackjack.total(m.c).t, extra = Blackjack.comprometido(J) + m.ap <= Blackjack.topeFichas(s, J);
    return {
      doblar: m.c.length === 2 && t < 21 && extra,
      separar: m.c.length === 2 && Blackjack.valor(m.c[0]) === Blackjack.valor(m.c[1]) && J.manos.length < 4 && !(m.separada && m.c[0][0] === "A") && extra
    };
  },
  act(s, pid, a) {
    const i = s.jug.findIndex(j => j.id === pid), J = s.jug[i];
    if (!J) return false;
    if (s.fase === "apuestas") {
      if (a.t === "apostar") { J.apuesta = Math.max(0, Math.min(s.cfg.max, Blackjack.topeFichas(s, J), a.n | 0)); J.listo = false; s.mov++; return true; }
      if (a.t === "listo") { J.listo = !!a.v && J.apuesta > 0 && J.apuesta <= Blackjack.topeFichas(s, J); s.mov++; return true; }
      return false;
    }
    if (s.fase === "fin" && a.t === "otra") { Blackjack.nueva(s); return true; }
    if (s.fase !== "juego" || !s.turno || s.turno.i !== i) return false;
    const m = J.manos[s.turno.m], p = Blackjack.puede(s, J, m);
    if (a.t === "pedir") {
      m.c.push(Blackjack.sacar(s));
      const t = Blackjack.total(m.c).t;
      if (t >= 21 || (m.separada && m.c[0][0] === "A")) m.lista = true;
    } else if (a.t === "plantarse") m.lista = true;
    else if (a.t === "doblar" && p.doblar) { m.ap *= 2; m.doblada = true; m.c.push(Blackjack.sacar(s)); m.lista = true; }
    else if (a.t === "separar" && p.separar) {
      const otra = { c: [m.c.pop()], ap: m.ap, doblada: false, separada: true, lista: false, res: null };
      m.separada = true; m.c.push(Blackjack.sacar(s)); otra.c.push(Blackjack.sacar(s));
      J.manos.splice(s.turno.m + 1, 0, otra);
      // Ases separados: una carta cada uno y listo
      if (m.c[0][0] === "A") { m.lista = true; otra.lista = true; }
      else { if (Blackjack.total(m.c).t === 21) m.lista = true; if (Blackjack.total(otra.c).t === 21) otra.lista = true; }
    } else return false;
    s.mov++;
    if (m.lista) Blackjack.siguiente(s);
    return true;
  },
  /* La banca: un paso por vez (para que se vea cómo da vuelta la carta y pide) */
  pasoCrupier(s) {
    if (s.fase !== "crupier") return false;
    if (!s.destapada) { s.destapada = true; s.mov++; }
    else {
      const vivas = s.jug.some(J => J.manos.some(m => Blackjack.total(m.c).t <= 21 && !Blackjack.esBJ(m)));
      if (vivas && Blackjack.total(s.crup).t < 17) { s.crup.push(Blackjack.sacar(s)); s.mov++; }
      else Blackjack.liquidar(s);
    }
    return true;
  },
  liquidar(s) {
    const c = Blackjack.total(s.crup).t, cBJ = s.crup.length === 2 && c === 21;
    s.jug.forEach(J => {
      J.premio = 0; J.apostado = 0; J.bjs = 0; J.ganadas = 0;
      J.manos.forEach(m => {
        const t = Blackjack.total(m.c).t, bj = Blackjack.esBJ(m);
        m.res = t > 21 ? "pasa" : bj && !cBJ ? "bj" : cBJ && !bj ? "pierde" : bj && cBJ ? "empata" : c > 21 || t > c ? "gana" : t === c ? "empata" : "pierde";
        const premio = m.res === "bj" ? m.ap + Math.floor(m.ap * 1.5) : m.res === "gana" ? m.ap * 2 : m.res === "empata" ? m.ap : 0;
        m.premio = premio; J.premio += premio; J.apostado += m.ap;
        if (m.res === "bj") J.bjs++;
        if (m.res === "bj" || m.res === "gana") J.ganadas++;
      });
      if (!s.cfg.monedas || J.cpu) J.fichas += J.premio - J.apostado;
    });
    s.destapada = true; s.fase = "fin"; s.turno = null; s.mov++;
  },
  nueva(s) {
    s.fase = "apuestas"; s.crup = []; s.turno = null; s.destapada = false; s.aviso = "";
    s.jug.forEach(J => { J.manos = []; J.listo = !!J.cpu; if (J.cpu) J.apuesta = Blackjack.apuestaBot(); if (!s.cfg.monedas && J.apuesta > J.fichas) J.apuesta = Math.min(J.fichas, 10); });
    s.mov++;
  },

  /* ---------- Estrategia básica (la usan los bots y el botón de consejo) ---------- */
  consejo(m, arriba, p) {
    const d = Blackjack.valor(arriba), { t, blanda } = Blackjack.total(m.c), entre = (a, b) => d >= a && d <= b;
    const par = m.c.length === 2 && Blackjack.valor(m.c[0]) === Blackjack.valor(m.c[1]) ? Blackjack.valor(m.c[0]) : 0;
    if (par && p.separar) {
      if (par === 11 || par === 8) return "separar";
      if (par === 9 && (entre(2, 6) || d === 8 || d === 9)) return "separar";
      if ((par === 7 || par === 2 || par === 3) && entre(2, 7)) return "separar";
      if (par === 6 && entre(2, 6)) return "separar";
      if (par === 4 && entre(5, 6)) return "separar";
    }
    const doblar = cond => cond && p.doblar ? "doblar" : null;
    if (blanda) {
      if (t >= 19) return "plantarse";
      if (t === 18) return doblar(entre(3, 6)) || (d >= 9 ? "pedir" : "plantarse");
      if (t === 17) return doblar(entre(3, 6)) || "pedir";
      if (t >= 15) return doblar(entre(4, 6)) || "pedir";
      return doblar(entre(5, 6)) || "pedir";
    }
    if (t >= 17) return "plantarse";
    if (t >= 13) return entre(2, 6) ? "plantarse" : "pedir";
    if (t === 12) return entre(4, 6) ? "plantarse" : "pedir";
    if (t === 11) return doblar(d <= 10) || "pedir";
    if (t === 10) return doblar(d <= 9) || "pedir";
    if (t === 9) return doblar(entre(3, 6)) || "pedir";
    return "pedir";
  },
  jugarBot(s) {
    const J = s.turno && s.jug[s.turno.i];
    if (!J || !J.cpu) return false;
    const m = J.manos[s.turno.m];
    return Blackjack.act(s, J.id, { t: Blackjack.consejo(m, s.crup[0], Blackjack.puede(s, J, m)) });
  },
  /* Lo que le toca hacer a la mesa sola (bots, banca y repartir cuando están todos listos) */
  pendiente(s) {
    if (s.fase === "crupier") return "crupier";
    if (s.fase === "juego" && s.turno && s.jug[s.turno.i].cpu) return "bot";
    if (s.fase === "apuestas") { const humanos = s.jug.filter(j => !j.cpu); if (humanos.length && humanos.every(j => j.listo || j.fuera) && humanos.some(j => j.listo)) return "repartir"; }
    return null;
  },
  pasoMesa(s) {
    const p = Blackjack.pendiente(s);
    if (p === "crupier") return Blackjack.pasoCrupier(s);
    if (p === "bot") return Blackjack.jugarBot(s);
    if (p === "repartir") return Blackjack.repartir(s);
    return false;
  },

  view(s, pid) {
    const yo = s.jug.findIndex(j => j.id === pid), tapada = s.fase === "juego" || (s.fase === "crupier" && !s.destapada);
    const crup = tapada ? [s.crup[0], null] : s.crup;
    return {
      game: "blackjack", id: s.id, me: pid, yo, fase: s.fase, cfg: s.cfg, ronda: s.ronda, mov: s.mov, aviso: s.aviso, barajo: s.barajo === s.mov || s.barajo === s.mov - 1,
      crup, crupTot: crup.length && crup[0] ? Blackjack.total(crup.filter(Boolean)) : null, turno: s.turno, quedan: s.zapato.length,
      jug: s.jug.map(J => ({ name: J.name, cpu: J.cpu, fichas: J.fichas, apuesta: J.apuesta, listo: J.listo, premio: J.premio, apostado: J.apostado, bjs: J.bjs || 0, ganadas: J.ganadas || 0,
        manos: J.manos.map(m => ({ ...m, tot: Blackjack.total(m.c), bj: Blackjack.esBJ(m) })) }))
    };
  },

  /* ---------- Monedas de este teléfono ---------- */
  pendientes() {
    // Una mano que quedó a medias (se fue de la mesa o se cerró la app): la apuesta se cobra
    const p = store.get("bjPend", null), u = BD.sesion();
    if (!p || !u || (UI.bjEnJuego && UI.bjEnJuego === p.k)) return;
    store.set("bjPend", null);
    if (p.ap > 0) Timba.mover(u, "blackjack", Math.min(p.ap, u.monedas), 0);
  },
  cuentas(v) {
    const u = BD.sesion();
    if (!v.cfg.monedas || v.yo < 0 || !u) { UI.timbaPend = 0; return; }
    const Y = v.jug[v.yo], k = v.id + ":" + v.ronda, hechas = store.get("bjHechas", {});
    const ap = Y.manos.reduce((t, m) => t + m.ap, 0);
    if (v.fase === "juego" || v.fase === "crupier") {
      UI.bjEnJuego = k;
      if (ap > 0 && !hechas[k]) { const p = store.get("bjPend", null); if (!p || p.k !== k || p.ap !== ap) store.set("bjPend", { k, ap }); }
      UI.timbaPend = ap; return;
    }
    UI.timbaPend = 0;
    if (v.fase === "fin" && ap > 0 && !hechas[k]) {
      hechas[k] = 1; store.set("bjHechas", Object.fromEntries(Object.entries(hechas).slice(-40))); store.set("bjPend", null); UI.bjEnJuego = null;
      if (Timba.mover(u, "blackjack", Math.min(Y.apostado, u.monedas), Y.premio, { blackjacks: Y.bjs, bjGanadas: Y.ganadas })) {
        Timba.festejo(Y.premio - Y.apostado, Y.apostado, Y.bjs > 0);
        Timba.logros(u);
      }
    }
  },
  saldoMesa(v) {
    if (v.yo < 0) return 0;
    if (!v.cfg.monedas) return v.jug[v.yo].fichas;
    const u = BD.sesion(); return u ? Timba.saldo(u) : 0;
  },
  /* Hasta cuánto se puede apostar en total en una mano */
  tope(v) {
    if (!v.cfg.monedas) return v.yo >= 0 ? v.jug[v.yo].fichas : 0;
    const u = BD.sesion(); return u ? Math.min(Timba.maxApuesta(), u.monedas) : 0;
  },

  /* ---------- Dibujo ---------- */
  carta(c, nueva, k) { return c ? Poker.carta(c, `grande bj-c ${nueva ? "nueva" : ""}`).replace("<span ", `<span style="--k:${k}" `) : `<span class="pk-c grande dorso bj-c ${nueva ? "nueva" : ""}" style="--k:${k}"></span>`; },
  cartas(lista, clave) {
    // Solo se anima la carta que llegó recién
    const U = UI.bjVistas = UI.bjVistas || {}, antes = U[clave] || 0;
    U[clave] = lista.length;
    return `<div class="bj-cartas">${lista.map((c, k) => Blackjack.carta(c, k >= antes, k)).join("")}</div>`;
  },
  totTxt(tt, bj, cerrada) { return bj ? "21 · BJ" : tt.blanda && tt.t < 21 && !cerrada ? `${tt.t - 10}/${tt.t}` : String(tt.t); },
  /* "19 vs 18": cada mano contra la banca */
  vs(m, v) {
    const c = v.crupTot ? v.crupTot.t : 0, cBJ = v.crup.length === 2 && c === 21;
    if (m.res === "pasa") return `${m.tot.t}: se pasó`;
    const yo = m.bj ? "BJ" : m.tot.t, banca = cBJ ? "BJ" : c > 21 ? `${c} (se pasó)` : c;
    return `${yo} vs ${banca} de la banca`;
  },
  RES: { bj: ["¡Blackjack!", "gana"], gana: ["Ganaste", "gana"], empata: ["Empate", "empata"], pierde: ["Perdiste", "pierde"], pasa: ["Te pasaste", "pierde"] },

  render(v, send, opts) {
    const yo = v.yo, Y = yo >= 0 ? v.jug[yo] : null, U = UI.bj = UI.bj && UI.bj.id === v.id ? UI.bj : { id: v.id, previa: 0, consejo: null };
    if (U.ronda !== v.ronda) { U.ronda = v.ronda; UI.bjVistas = {}; U.consejo = null; }
    const nom = j => esc(j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name);
    const mon = v.cfg.monedas ? "🪙" : "fichas", miTurno = v.fase === "juego" && v.turno && v.turno.i === yo;
    const cab = opts.local ? Timba.cabecera(BD.sesion(), "🃏 Blackjack") : Net.cabecera();
    Blackjack.cuentas(v);
    const manoHTML = (J, i, m, k, grande) => {
      const actual = v.turno && v.turno.i === i && v.turno.m === k && v.fase === "juego", r = m.res && Blackjack.RES[m.res];
      return `<div class="bj-mano ${actual ? "actual" : ""} ${r ? r[1] : ""} ${grande ? "" : "chica"}">
        ${Blackjack.cartas(m.c, `${i}:${k}`)}
        <div class="bj-pie"><span class="bj-tot ${m.tot.t > 21 ? "pasa" : m.tot.t === 21 ? "veinte" : ""}">${Blackjack.totTxt(m.tot, m.bj, m.lista || v.fase === "fin")}</span><span class="bj-ap">${m.ap}${v.cfg.monedas ? " 🪙" : ""}${m.doblada ? " ×2" : ""}</span></div>
        ${r ? `<span class="bj-res ${r[1]}">${r[0]}${m.premio ? ` +${m.premio}` : ""}</span><span class="bj-vs">${Blackjack.vs(m, v)}</span>` : ""}</div>`;
    };
    const otros = v.jug.map((J, i) => i === yo ? "" : `<div class="bj-otro ${v.turno && v.turno.i === i ? "turno" : ""}">
        <div class="bj-otro-cab">${J.cpu ? `<span class="cpu-ic">🤖</span>` : avatar(J.name, 22)}<b>${nom(J)}</b><small>${v.fase === "apuestas" ? (J.listo ? `✅ ${J.apuesta}` : J.apuesta ? `${J.apuesta}…` : "eligiendo") : J.manos.length ? "" : "mira"}</small></div>
        ${J.manos.length ? `<div class="bj-otro-manos">${J.manos.map((m, k) => manoHTML(J, i, m, k, false)).join("")}</div>` : ""}</div>`).join("");
    const crupTot = v.crupTot ? Blackjack.totTxt(v.crupTot, v.crup.length === 2 && v.crupTot.t === 21 && !!v.crup[1], true) : "";
    const mesa = `<div class="bj-mesa">
      <div class="bj-banca"><span class="label">🎩 Banca · juega contra todos${crupTot ? ` · <b class="bj-tot ${v.crupTot.t > 21 ? "pasa" : ""}">${crupTot}</b>` : ""}</span>
        ${v.crup.length ? Blackjack.cartas(v.crup, "c") : `<div class="bj-cartas"><span class="pk-c grande hueco"></span><span class="pk-c grande hueco"></span></div>`}</div>
      <p class="bj-regla">BLACKJACK PAGA 3 A 2 · LA BANCA SE PLANTA EN 17</p>
      ${otros ? `<div class="bj-otros">${otros}</div>` : ""}
      <div class="bj-mias">${Y && Y.manos.length ? Y.manos.map((m, k) => manoHTML(Y, yo, m, k, true)).join("") : `<div class="bj-vacia">${v.fase === "apuestas" ? "Hacé tu apuesta" : "Esta mano no jugás"}</div>`}</div>
    </div>`;

    // Lo de abajo siempre ocupa el mismo lugar (para que nada se corra cuando cambia el turno)
    let estado = "", botones = "";
    const tope = Blackjack.tope(v), saldo = Blackjack.saldoMesa(v);
    // Si ya no alcanza para la apuesta de la mano anterior, se baja sola a lo que alcanza
    if (v.fase === "apuestas" && Y && !Y.listo && Y.apuesta > Math.min(v.cfg.max, tope) && U.ajuste !== v.mov) { U.ajuste = v.mov; setTimeout(() => send({ t: "apostar", n: Math.floor(Math.min(v.cfg.max, tope) / 5) * 5 }), 0); }
    if (v.fase === "apuestas" && Y) {
      const ap = Y.apuesta, max = Math.min(v.cfg.max, tope);
      estado = Y.listo ? `✅ Listo con <b>${ap} ${mon}</b>. ${opts.local ? "" : "Esperando a los demás…"}` : ap ? `Apuesta: <b>${ap} ${mon}</b> · máx. ${max}` : `Elegí cuánto apostar (máx. ${max} ${mon}).`;
      botones = `<div class="bj-fichas">${BJ.FICHAS.map(f => `<button class="ru-ficha grande f${f}" data-bjf="${f}" ${Y.listo || ap + f > max ? "disabled" : ""}>${f}</button>`).join("")}</div>
        <div class="bj-acc"><button class="btn ghost chico" id="bjBorrar" ${ap && !Y.listo ? "" : "disabled"} aria-label="Borrar la apuesta">✕</button>
          <button class="btn ghost chico" id="bjRep" ${!ap && U.previa && U.previa <= max && !Y.listo ? "" : "disabled"} aria-label="Repetir la apuesta">↻</button>
          ${opts.local ? `<button class="btn tb-girar" id="bjRepartir" ${ap && ap <= tope ? "" : "disabled"}>🃏 Repartir${ap ? ` · ${ap}` : ""}</button>`
            : `<button class="btn ${Y.listo ? "ghost" : "tb-girar"}" id="bjListo" ${ap && ap <= tope ? "" : "disabled"}>${Y.listo ? "Cambiar apuesta" : `✅ Listo${ap ? ` · ${ap}` : ""}`}</button>`}</div>`;
    } else if (v.fase === "juego" || v.fase === "crupier") {
      const J = v.turno && v.jug[v.turno.i];
      if (miTurno) {
        const m = Y.manos[v.turno.m], comp = Y.manos.reduce((t, x) => t + x.ap, 0), alcanza = comp + m.ap <= tope;
        const dob = m.c.length === 2 && m.tot.t < 21 && alcanza, sep = m.c.length === 2 && Blackjack.valor(m.c[0]) === Blackjack.valor(m.c[1]) && Y.manos.length < 4 && !(m.separada && m.c[0][0] === "A") && alcanza;
        const cons = U.consejo && U.consejo.mov === v.mov ? U.consejo.que : null, txt = { pedir: "pedir otra carta", plantarse: "plantarte", doblar: "doblar", separar: "separar" };
        estado = cons ? `💡 Te conviene <b>${txt[cons]}</b>.` : `${Y.manos.length > 1 ? `Mano ${v.turno.m + 1} de ${Y.manos.length}: ` : ""}tenés <b>${Blackjack.totTxt(m.tot, false)}</b> contra el ${v.crup[0][0] === "A" ? "As" : Blackjack.valor(v.crup[0])} de la banca.`;
        botones = `<div class="bj-jugar">
          <button class="btn ${cons === "pedir" ? "sugerido" : ""}" id="bjPedir">➕ Pedir</button><button class="btn ghost ${cons === "plantarse" ? "sugerido" : ""}" id="bjPlantar">✋ Plantarse</button>
          <button class="btn ghost ${cons === "doblar" ? "sugerido" : ""}" id="bjDoblar" ${dob ? "" : "disabled"}>×2 Doblar</button><button class="btn ghost ${cons === "separar" ? "sugerido" : ""}" id="bjSeparar" ${sep ? "" : "disabled"}>✂️ Separar</button></div>
          <button class="linkish bj-cons" id="bjConsejo">💡 ¿Qué me conviene?</button>`;
      } else estado = v.fase === "crupier" ? "🎩 Juega la banca…" : J ? (J.cpu ? `🤖 Juega ${nom(J)}…` : `Turno de <b>${nom(J)}</b>.`) : "";
    } else if (v.fase === "fin" && Y) {
      const neto = Y.premio - Y.apostado;
      estado = v.aviso ? `${esc(v.aviso)} ` : "";
      estado += Y.apostado ? (neto > 0 ? `🎉 <b>Ganaste ${neto} ${mon}</b>` : neto === 0 ? "Recuperaste tu apuesta." : `Perdiste ${-neto} ${mon}.`) : "Terminó la mano.";
      botones = `<div class="bj-acc"><button class="btn tb-girar" id="bjOtra">🃏 Otra mano</button>${opts.local ? "" : v.isHost ? `<button class="btn ghost" id="bjLobby">Volver a la sala</button>` : ""}</div>`;
    }
    const otrasOpc = opts.local && v.fase === "apuestas" && Y && !Y.listo ? `<div class="panel bj-opc"><span class="label">Compañeros de mesa (bots)</span><div class="seg">${[0, 1, 2, 3].map(n => `<button aria-pressed="${v.jug.length - 1 === n}" data-bjb="${n}">${n ? n : "Solo"}</button>`).join("")}</div></div>` : "";
    app.innerHTML = `${cab}<section class="screen blackjack">
      ${v.cfg.monedas ? "" : `<div class="bj-saldo">Tus fichas: <b>${saldo}</b></div>`}
      ${v.barajo ? `<div class="bj-aviso">🔀 Se mezcló el zapato</div>` : ""}
      ${mesa}
      <p class="aj-estado bj-estado">${estado}</p>
      <div class="bj-botonera">${botones}</div>
      ${otrasOpc}
      <details class="panel"><summary class="label">Reglas</summary><p class="summary">Sumá lo más cerca de 21 sin pasarte. Las figuras valen 10 y el As 1 u 11. <b>Blackjack</b> (As + figura o 10 de entrada) paga 3 a 2. La banca pide hasta 16 y se planta en 17. <b>Doblar</b>: duplicás la apuesta y recibís una sola carta. <b>Separar</b>: con dos cartas iguales armás dos manos con la misma apuesta cada una (los ases reciben una carta cada uno). Empate: te devuelven lo apostado.</p></details>
      ${v.cfg.monedas ? `<p class="tb-aviso">Las monedas son del juego: no se compran ni se cambian por plata. Jugá por diversión.</p>` : ""}
    </section>`;
    app.querySelectorAll("[data-bjf]").forEach(b => b.onclick = () => { if (typeof Sonido !== "undefined") Sonido.sfx("clic"); send({ t: "apostar", n: Y.apuesta + +b.dataset.bjf }); });
    on("bjBorrar", () => send({ t: "apostar", n: 0 }));
    on("bjRep", () => send({ t: "apostar", n: U.previa }));
    on("bjRepartir", () => { U.previa = Y.apuesta; send({ t: "listo", v: true }); });
    on("bjListo", () => { if (!Y.listo) U.previa = Y.apuesta; send({ t: "listo", v: !Y.listo }); });
    on("bjPedir", () => send({ t: "pedir" }));
    on("bjPlantar", () => send({ t: "plantarse" }));
    on("bjDoblar", () => { const m = Y.manos[v.turno.m]; if (Y.manos.reduce((t, x) => t + x.ap, 0) + m.ap <= Blackjack.tope(v)) send({ t: "doblar" }); });
    on("bjSeparar", () => { const m = Y.manos[v.turno.m]; if (Y.manos.reduce((t, x) => t + x.ap, 0) + m.ap <= Blackjack.tope(v)) send({ t: "separar" }); });
    on("bjConsejo", () => {
      const m = Y.manos[v.turno.m], comp = Y.manos.reduce((t, x) => t + x.ap, 0), alc = comp + m.ap <= Blackjack.tope(v);
      const p = { doblar: !byId("bjDoblar").disabled && alc, separar: !byId("bjSeparar").disabled && alc };
      U.consejo = { mov: v.mov, que: Blackjack.consejo(m, v.crup[0], p) }; render();
    });
    on("bjOtra", () => send({ t: "otra" }));
    on("bjLobby", () => send({ t: "lobby" }));
    app.querySelectorAll("[data-bjb]").forEach(b => b.onclick = () => send({ t: "bots", n: +b.dataset.bjb }));
    on("tbAtras", () => {
      const enJuego = (v.fase === "juego" || v.fase === "crupier") && Y && Y.manos.length;
      if (enJuego && !confirm("Si te vas ahora, perdés lo que apostaste en esta mano. ¿Salir?")) return;
      Blackjack.parar(); UI.bjEnJuego = null; UI.timbaPend = 0; Blackjack.pendientes(); go("casino");
    });
  },

  /* ---------- Solo, en el Casino ---------- */
  timer: null,
  parar() { clearTimeout(Blackjack.timer); Blackjack.timer = null; },
  mesaLocal(bots) {
    const u = BD.sesion(), prev = S.bj && S.bj.jug[0];
    S.bj = Blackjack.setup([{ id: "yo", name: u.nombre, apuesta: prev ? prev.apuesta : 0 }, ...BJ.BOTS.slice(0, bots).map((n, k) => ({ id: "b" + k, name: n, cpu: true }))], { monedas: true, max: Timba.maxApuesta() });
  },
  programarLocal() {
    const s = S.bj;
    if (!s || Blackjack.timer || !Blackjack.pendiente(s)) return;
    const p = Blackjack.pendiente(s);
    Blackjack.timer = setTimeout(() => {
      Blackjack.timer = null;
      if (S.screen !== "blackjack" || S.bj !== s) return;
      if (Blackjack.pasoMesa(s)) render();
    }, p === "repartir" ? 50 : p === "crupier" ? 750 : 850);
  },

  /* ---------- Online: el anfitrión lleva la mesa ---------- */
  empezarOn(R) {
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name }));
    const bots = Math.max(0, Math.min(3, S.bjCfg.bots | 0));
    R.bj = Blackjack.setup([...jug, ...BJ.BOTS.slice(0, Math.max(0, Math.min(bots, 7 - jug.length))).map((n, k) => ({ id: "b" + k, name: n, cpu: true }))], { monedas: S.bjCfg.monedas, max: Timba.maxApuesta() });
    R.game = "blackjack";
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "lobby" && pid === "H") { R.game = null; R.bj = null; return; }
    if (a.t === "bots") return;
    Blackjack.act(R.bj, pid, a);
    Blackjack.programarHost(R);
  },
  timerHost: null,
  programarHost(R) {
    const s = R.bj;
    if (!s || !Blackjack.pendiente(s) || Blackjack.timerHost === s.id + s.mov) return;
    const p = Blackjack.pendiente(s), k = s.id + s.mov;
    Blackjack.timerHost = k;
    setTimeout(() => {
      if (R.bj !== s || R.game !== "blackjack" || Blackjack.timerHost !== k) return;
      Blackjack.timerHost = null;
      if (Blackjack.pasoMesa(s)) Net.broadcast();
      Blackjack.programarHost(R);
    }, p === "repartir" ? 600 : p === "crupier" ? 750 : 900);
  }
};

PANTALLAS.blackjack = () => {
  if (Timba.sinPerfil("Blackjack")) return;
  if (!S.bj) { Blackjack.pendientes(); Blackjack.mesaLocal(S.bjCfg.bots); }
  const s = S.bj;
  Blackjack.render(Blackjack.view(s, "yo"), a => {
    if (a.t === "bots") { S.bjCfg.bots = a.n; store.set("bjCfg", S.bjCfg); Blackjack.parar(); Blackjack.mesaLocal(a.n); return render(); }
    if (a.t === "apostar" && a.n > Blackjack.tope(Blackjack.view(s, "yo"))) return;
    Blackjack.act(s, "yo", a); render();
  }, { local: true });
  Blackjack.programarLocal();
};
