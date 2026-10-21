/* Póker Texas Hold'em en formato torneo (sit & go): todos arrancan con las mismas fichas y gana el último que queda.
   - Las fichas son de la mesa (no son las monedas del juego).
   - Ciegas que suben cada 6 manos. Botón del repartidor, ciega chica y grande (mano a mano el botón pone la chica).
   - Apuestas sin límite: pasar, igualar, subir (mínimo la última subida) o all-in. Pozos laterales cuando alguien va all-in.
   - Bots: calculan su chance simulando manos al azar (Monte Carlo) y comparan con lo que cuesta seguir; a veces faroleán. */
const PK = {
  PALOS: { s: ["♠", "#1b1726"], h: ["♥", "#d6336c"], d: ["♦", "#e8590c"], c: ["♣", "#2b8a3e"] },
  RANGOS: "23456789TJQKA",
  NOMBRE_R: { T: "10", J: "J", Q: "Q", K: "K", A: "A" },
  MANOS: ["Carta alta", "Par", "Doble par", "Trío", "Escalera", "Color", "Full", "Póker", "Escalera de color", "Escalera real"],
  PLURAL: { 2: "dos", 3: "tres", 4: "cuatros", 5: "cincos", 6: "seis", 7: "sietes", 8: "ochos", 9: "nueves", 10: "dieces", 11: "jotas", 12: "reinas", 13: "reyes", 14: "ases" },
  CIEGAS: [[10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [500, 1000], [1000, 2000]],
  BOTS: [["🤖 Rita", "prudente"], ["🤖 Tito", "agresivo"], ["🤖 Pepa", "equilibrado"], ["🤖 Cacho", "farolero"], ["🤖 Coca", "prudente"], ["🤖 Lalo", "agresivo"], ["🤖 Mora", "equilibrado"]]
};

const Poker = {
  /* ---------- Cartas y manos ---------- */
  mazo() { const m = []; for (const s of "shdc") for (const r of PK.RANGOS) m.push(r + s); return shuffle(m); },
  rango: c => PK.RANGOS.indexOf(c[0]) + 2,
  /* Valor de 5 cartas: [categoría, desempates...] (más alto gana) */
  valor5(cs) {
    const rs = cs.map(Poker.rango).sort((a, b) => b - a), color = cs.every(c => c[1] === cs[0][1]);
    const cuenta = {}; rs.forEach(r => cuenta[r] = (cuenta[r] || 0) + 1);
    const grupos = Object.entries(cuenta).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const unicos = [...new Set(rs)];
    let esc = 0;
    if (unicos.length === 5) { if (rs[0] - rs[4] === 4) esc = rs[0]; else if (rs.join() === "14,5,4,3,2") esc = 5; }
    if (esc && color) return [esc === 14 ? 9 : 8, esc];
    if (grupos[0][0] === 4) return [7, grupos[0][1], grupos[1][1]];
    if (grupos[0][0] === 3 && grupos[1][0] === 2) return [6, grupos[0][1], grupos[1][1]];
    if (color) return [5, ...rs];
    if (esc) return [4, esc];
    if (grupos[0][0] === 3) return [3, grupos[0][1], ...grupos.slice(1).map(g => g[1])];
    if (grupos[0][0] === 2 && grupos[1][0] === 2) return [2, grupos[0][1], grupos[1][1], grupos[2][1]];
    if (grupos[0][0] === 2) return [1, grupos[0][1], ...grupos.slice(1).map(g => g[1])];
    return [0, ...rs];
  },
  comparar(a, b) { for (let k = 0; k < Math.max(a.length, b.length); k++) { const d = (a[k] || 0) - (b[k] || 0); if (d) return d; } return 0; },
  /* La mejor de 5 entre 5 a 7 cartas */
  mejor(cs) {
    const n = cs.length; if (n < 5) return null;
    let mejor = null, cinco = null;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const sel = [cs[a], cs[b], cs[c], cs[d], cs[e]], v = Poker.valor5(sel);
      if (!mejor || Poker.comparar(v, mejor) > 0) { mejor = v; cinco = sel; }
    }
    return { v: mejor, cartas: cinco };
  },
  nombreMano(v) {
    if (!v) return "";
    const R = r => PK.NOMBRE_R[PK.RANGOS[r - 2]] || String(r), P = r => PK.PLURAL[r];
    switch (v[0]) {
      case 9: return "¡Escalera real!";
      case 8: return `Escalera de color al ${R(v[1])}`;
      case 7: return `Póker de ${P(v[1])}`;
      case 6: return `Full de ${P(v[1])} y ${P(v[2])}`;
      case 5: return `Color al ${R(v[1])}`;
      case 4: return `Escalera al ${R(v[1])}`;
      case 3: return `Trío de ${P(v[1])}`;
      case 2: return `Doble par: ${P(v[1])} y ${P(v[2])}`;
      case 1: return `Par de ${P(v[1])}`;
      default: return `Carta alta: ${R(v[1])}`;
    }
  },

  /* ---------- Partida ---------- */
  setup(jug, cfg) {
    const fichas = Math.max(200, Math.min(20000, +(cfg && cfg.fichas) || 1000));
    const s = {
      id: "pk-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      jug: jug.map(j => ({ ...j, fichas, mano: [], apuesta: 0, total: 0, fuera: false, retirado: false, allin: false, actuo: false, dicho: null, puesto: 0 })),
      n: jug.length, cfg: { fichas, subir: 6 }, boton: Math.floor(Math.random() * jug.length), manoN: 0, mov: 0, nivel: 0,
      fase: "mano", mesa: [], pozo: 0, apuestaMax: 0, minSubida: 20, turno: -1, res: null, ganador: null, eliminados: [], log: []
    };
    Poker.nuevaMano(s);
    return s;
  },
  vivos: s => s.jug.map((j, i) => j.fuera ? -1 : i).filter(i => i >= 0),
  sig(s, i, cond = j => !j.fuera) { for (let k = 1; k <= s.n; k++) { const x = (i + k) % s.n; if (cond(s.jug[x])) return x; } return -1; },
  ciegas(s) { return PK.CIEGAS[Math.min(PK.CIEGAS.length - 1, s.nivel)]; },
  nuevaMano(s) {
    s.subio = null;
    const vivos = Poker.vivos(s);
    if (vivos.length <= 1) return Poker.terminar(s);
    s.manoN++; s.mov++;
    s.nivel = Math.floor((s.manoN - 1) / s.cfg.subir);
    s.boton = Poker.sig(s, s.boton);
    const m = Poker.mazo();
    s.jug.forEach(j => Object.assign(j, { mano: [], apuesta: 0, total: 0, retirado: j.fuera, allin: false, actuo: false, dicho: null, gana: 0, mostro: false }));
    vivos.forEach(i => s.jug[i].mano = [m.pop(), m.pop()]);
    Object.assign(s, { mazoRest: m, mesa: [], pozo: 0, apuestaMax: 0, fase: "preflop", res: null, log: [], ultimo: -1 });
    const [chica, grande] = Poker.ciegas(s);
    // Mano a mano: el botón pone la chica y habla primero antes del flop
    const sb = vivos.length === 2 ? s.boton : Poker.sig(s, s.boton), bb = Poker.sig(s, sb);
    Poker.poner(s, sb, chica); Poker.poner(s, bb, grande);
    s.jug[sb].dicho = `Ciega chica ${chica}`; s.jug[bb].dicho = `Ciega grande ${grande}`;
    s.sb = sb; s.bb = bb;
    s.apuestaMax = Math.max(s.jug[sb].apuesta, s.jug[bb].apuesta); s.minSubida = grande;
    s.turno = Poker.sig(s, bb, j => !j.fuera && !j.allin);
    if (Poker.listaRonda(s)) Poker.avanzar(s);
  },
  poner(s, i, x) {
    const J = s.jug[i], v = Math.min(x, J.fichas);
    J.fichas -= v; J.apuesta += v; J.total += v; s.pozo += v;
    if (J.fichas === 0) J.allin = true;
    return v;
  },
  enJuego: s => s.jug.filter(j => !j.fuera && !j.retirado),
  /* ¿Terminó la ronda de apuestas? */
  listaRonda(s) {
    const jugando = Poker.enJuego(s);
    if (jugando.length <= 1) return true;
    const pueden = jugando.filter(j => !j.allin);
    if (!pueden.length) return true;
    if (pueden.length === 1 && pueden[0].apuesta >= s.apuestaMax) return true;
    return pueden.every(j => j.actuo && j.apuesta === s.apuestaMax);
  },
  acciones(s, i) {
    const J = s.jug[i];
    if (!J || !["preflop", "flop", "turn", "river"].includes(s.fase) || s.turno !== i || J.retirado || J.allin) return null;
    const pagar = Math.min(J.fichas, s.apuestaMax - J.apuesta), minHasta = Math.min(J.fichas + J.apuesta, s.apuestaMax + s.minSubida);
    const nadieMas = Poker.enJuego(s).filter(j => !j.allin && j !== J).length === 0;
    return { pagar, pasar: pagar === 0, minHasta, maxHasta: J.fichas + J.apuesta, subir: J.fichas > pagar && !nadieMas, pozo: s.pozo };
  },
  act(s, pid, a) {
    if (a.t === "siguiente") { if (s.fase === "fin-mano") Poker.nuevaMano(s); return; }
    const i = s.jug.findIndex(j => j.id === pid), A = Poker.acciones(s, i);
    if (!A) return;
    const J = s.jug[i];
    // Los bots anotan cómo jugás: con qué fuerza subís (faroles) y cuánto te retirás cuando te apuestan
    if (!J.cpu && typeof Mente !== "undefined" && Mente.local()) {
      if (a.t === "raise" && A.subir) Mente.anotar("poker", "fuerzaSube", s.mesa.length ? Poker.chance(J.mano, s.mesa, 1, 40) : Poker.preflop(J.mano) + 0.12);
      if (!A.pasar && (a.t === "fold" || a.t === "call")) Mente.anotar("poker", "seRetira", a.t === "fold" ? 1 : 0);
    }
    if (a.t === "fold") { J.retirado = true; J.dicho = "Se retira"; }
    else if (a.t === "call") {
      if (A.pasar) J.dicho = "Pasa";
      else { const v = Poker.poner(s, i, A.pagar); J.dicho = J.allin ? `All-in ${J.apuesta}` : `Iguala ${v}`; }
    } else if (a.t === "raise") {
      if (!A.subir) return;
      const hasta = Math.max(A.minHasta, Math.min(A.maxHasta, Math.round(+a.hasta || 0)));
      const subida = hasta - s.apuestaMax;
      Poker.poner(s, i, hasta - J.apuesta);
      if (subida >= s.minSubida) { s.minSubida = subida; s.jug.forEach(x => { if (x !== J) x.actuo = false; }); }
      s.apuestaMax = Math.max(s.apuestaMax, J.apuesta);
      J.dicho = J.allin ? `All-in ${J.apuesta}` : `Sube a ${J.apuesta}`; s.subio = i;
    } else return;
    J.actuo = true; s.mov++; s.ultimo = i;
    s.log = [...s.log, `${J.name}: ${J.dicho}`].slice(-6);
    if (Poker.enJuego(s).length === 1) return Poker.repartirPozo(s);
    if (Poker.listaRonda(s)) return Poker.avanzar(s);
    s.turno = Poker.sig(s, i, j => !j.fuera && !j.retirado && !j.allin);
  },
  /* Siguiente calle: flop, turn, river o showdown */
  avanzar(s) {
    s.subio = null;
    s.jug.forEach(j => { j.apuesta = 0; j.actuo = false; if (!j.retirado && !j.fuera && !j.allin) j.dicho = null; });
    s.apuestaMax = 0; s.minSubida = Poker.ciegas(s)[1];
    const m = s.mazoRest;
    if (s.fase === "preflop") { m.pop(); s.mesa.push(m.pop(), m.pop(), m.pop()); s.fase = "flop"; }
    else if (s.fase === "flop") { m.pop(); s.mesa.push(m.pop()); s.fase = "turn"; }
    else if (s.fase === "turn") { m.pop(); s.mesa.push(m.pop()); s.fase = "river"; }
    else return Poker.repartirPozo(s);
    s.mov++;
    // Si ya nadie puede apostar (todos all-in menos uno), se dan las cartas que faltan
    if (Poker.listaRonda(s)) return Poker.avanzar(s);
    s.turno = Poker.sig(s, s.boton, j => !j.fuera && !j.retirado && !j.allin);
  },
  /* Reparte el pozo (con pozos laterales) */
  repartirPozo(s) {
    const enJ = s.jug.map((j, i) => ({ j, i })).filter(x => !x.j.retirado && !x.j.fuera);
    const showdown = enJ.length > 1;
    if (showdown) while (s.mesa.length < 5) s.mesa.push(s.mazoRest.pop());
    const valor = {}; enJ.forEach(({ j, i }) => { valor[i] = showdown ? Poker.mejor([...j.mano, ...s.mesa]) : null; if (showdown) j.mostro = true; });
    const niveles = [...new Set(s.jug.filter(j => j.total > 0).map(j => j.total))].sort((a, b) => a - b);
    let ant = 0; const pozos = [];
    for (const nv of niveles) {
      const monto = s.jug.reduce((t, j) => t + Math.max(0, Math.min(j.total, nv) - ant), 0);
      const aspir = enJ.filter(x => x.j.total >= nv).map(x => x.i);
      if (monto > 0) pozos.push({ monto, aspir });
      ant = nv;
    }
    const ganadores = new Set();
    pozos.forEach((p, k) => {
      let gs = p.aspir;
      if (!gs.length) gs = enJ.map(x => x.i);
      if (showdown && gs.length > 1) {
        let mejor = null;
        gs.forEach(i => { if (!mejor || Poker.comparar(valor[i].v, mejor) > 0) mejor = valor[i].v; });
        gs = gs.filter(i => Poker.comparar(valor[i].v, mejor) === 0);
      }
      const parte = Math.floor(p.monto / gs.length); let resto = p.monto - parte * gs.length;
      // El resto va al primero a la izquierda del botón
      const orden = gs.slice().sort((a, b) => ((a - s.boton + s.n) % s.n) - ((b - s.boton + s.n) % s.n));
      orden.forEach(i => { const extra = resto > 0 ? 1 : 0; resto -= extra; s.jug[i].fichas += parte + extra; s.jug[i].gana += parte + extra; ganadores.add(i); });
      p.ganadores = gs;
    });
    const g = [...ganadores];
    s.res = {
      showdown, pozos: pozos.map(p => ({ monto: p.monto, ganadores: p.ganadores })),
      ganadores: g.map(i => ({ i, gana: s.jug[i].gana, mano: valor[i] ? Poker.nombreMano(valor[i].v) : "", cartas: valor[i] ? valor[i].cartas : [] })),
      mejorCat: Object.fromEntries(Object.entries(valor).map(([i, x]) => [i, x ? x.v[0] : -1]))
    };
    s.jug.forEach((j, i) => { if (s.res.mejorCat[i] != null) j.mejorCat = Math.max(j.mejorCat || -1, s.res.mejorCat[i]); if (g.includes(i)) j.manosG = (j.manosG || 0) + 1; });
    s.pozo = 0; s.turno = -1; s.fase = "fin-mano"; s.mov++;
    // Eliminados (en orden: el que tenía menos fichas antes de la mano queda más abajo)
    const caen = s.jug.map((j, i) => ({ j, i })).filter(x => !x.j.fuera && x.j.fichas === 0).sort((a, b) => a.j.total - b.j.total);
    caen.forEach(({ j }) => { j.fuera = true; j.puesto = Poker.vivos(s).length + 1; s.eliminados.push(j.name); });
    if (Poker.vivos(s).length <= 1) Poker.terminar(s);
  },
  terminar(s) {
    const v = Poker.vivos(s);
    if (v.length === 1) { s.ganador = v[0]; s.jug[v[0]].puesto = 1; }
    s.fase = "fin"; s.turno = -1; s.mov++;
  },

  /* ---------- Bots ---------- */
  /* Fuerza antes del flop (0 a 1) */
  preflop(mano) {
    const [a, b] = mano.map(Poker.rango).sort((x, y) => y - x), mismo = mano[0][1] === mano[1][1];
    let f = (a + b) / 28;
    if (a === b) f = 0.5 + a / 28;
    if (mismo) f += 0.06;
    if (a - b === 1) f += 0.04; else if (a - b === 2) f += 0.02; else if (a - b > 4) f -= 0.05;
    if (a === 14) f += 0.05;
    return Math.max(0, Math.min(1, f));
  },
  /* Chance de ganar contra `rivales` manos al azar, simulando el resto de la mesa */
  chance(mano, mesa, rivales, sims = 160) {
    const usadas = new Set([...mano, ...mesa]), resto = Poker.mazo().filter(c => !usadas.has(c));
    let gana = 0;
    for (let k = 0; k < sims; k++) {
      const m = resto.slice();
      for (let x = m.length - 1; x > m.length - 1 - (5 - mesa.length + rivales * 2) && x > 0; x--) { const y = Math.floor(Math.random() * (x + 1)); [m[x], m[y]] = [m[y], m[x]]; }
      let p = m.length - 1;
      const tablero = [...mesa]; while (tablero.length < 5) tablero.push(m[p--]);
      const yo = Poker.mejor([...mano, ...tablero]).v;
      let gano = 1;
      for (let r = 0; r < rivales; r++) { const o = Poker.mejor([m[p--], m[p--], ...tablero]).v, c = Poker.comparar(yo, o); if (c < 0) { gano = 0; break; } if (c === 0) gano = Math.min(gano, 0.5); }
      gana += gano;
    }
    return gana / sims;
  },
  decidirBot(s) {
    const i = s.turno, J = s.jug[i], A = Poker.acciones(s, i); if (!A) return null;
    const estilo = J.estilo || "equilibrado", r = Math.random();
    const rivales = Math.max(1, Poker.enJuego(s).length - 1);
    // h: habilidad (dificultad + lo que aprendieron de vos). Con más nivel calculan mejor y se equivocan menos
    const M = typeof Mente !== "undefined", h = M ? Mente.habilidad("poker", J.nivel) : J.nivel === "facil" ? 0.2 : 0.5;
    const fuerza = s.mesa.length ? Poker.chance(J.mano, s.mesa, Math.min(rivales, 4), Math.round(50 + 170 * h)) : Poker.preflop(J.mano) * (rivales > 2 ? 0.85 : 1) + (rivales === 1 ? 0.12 : 0);
    const cuota = A.pagar / (s.pozo + A.pagar || 1);
    const agresion = { prudente: 0.7, equilibrado: 1, agresivo: 1.3, farolero: 1.1 }[estilo];
    const ruido = (0.2 - 0.16 * h) * (r - 0.5);
    // Si la última subida fue tuya y aprendieron que subís con poco, te pagan más liviano
    const ult = s.jug[s.subio], vosSubiste = M && ult && !ult.cpu && !A.pasar;
    const lectura = vosSubiste ? Math.max(-0.12, Math.min(0.15, (0.62 - Mente.costumbre("poker", "fuerzaSube", 0.62)) * 0.6)) * h : 0;
    const f = fuerza + ruido + lectura, [, bb] = Poker.ciegas(s);
    const hayVos = s.jug.some(j => !j.cpu && !j.fuera && !j.retirado), teAchicas = M && hayVos ? Mente.costumbre("poker", "seRetira", 0.4) : 0.4;
    const subirA = mult => Math.round(Math.max(A.minHasta, Math.min(A.maxHasta, s.apuestaMax + Math.max(bb, s.pozo * mult))));
    // Fuerte: sube
    if (A.subir && f > (s.mesa.length ? 0.72 : 0.68) / agresion) return { t: "raise", hasta: f > 0.88 && r < 0.3 ? A.maxHasta : subirA(0.6 + r * 0.6) };
    // Farol de vez en cuando cuando nadie apostó
    // (si te retirás seguido, los buenos te farolean más)
    if (A.subir && A.pasar && r < (estilo === "farolero" ? 0.22 : 0.07) * (1 + h * Math.max(-0.5, (teAchicas - 0.4) * 2.5))) return { t: "raise", hasta: subirA(0.5) };
    if (A.pasar) return { t: "call" };
    // Seguir si la chance alcanza para lo que cuesta
    if (f > cuota + (estilo === "prudente" ? 0.12 : 0.05) || A.pagar <= bb && f > 0.3) return { t: "call" };
    if (A.pagar >= J.fichas && f > 0.55) return { t: "call" };
    return { t: "fold" };
  },
  jugarBot(s) {
    const J = s.jug[s.turno]; if (!J || !J.cpu) return;
    const a = Poker.decidirBot(s); if (a) Poker.act(s, J.id, a);
  },

  resultado(s, pid) {
    if (s.fase !== "fin") return null;
    const J = s.jug.find(j => j.id === pid); if (!J) return null;
    return { juego: "poker", id: s.id, gano: J.puesto === 1, puesto: J.puesto, n: s.n, vsCompu: s.jug.every(j => j === J || j.cpu), mejorCat: J.mejorCat ?? -1, manos: J.manosG || 0 };
  },
  view(s, pid) {
    const yo = s.jug.findIndex(j => j.id === pid), fin = s.fase === "fin-mano" || s.fase === "fin";
    return {
      game: "poker", id: s.id, me: pid, yo, n: s.n, fase: s.fase, turno: s.turno, ultimo: s.ultimo ?? -1, ganado: s.res ? s.res.ganadores.reduce((t, g) => t + g.gana, 0) : 0, boton: s.boton, sb: s.sb, bb: s.bb, manoN: s.manoN, mov: s.mov,
      ciegas: Poker.ciegas(s), proxima: PK.CIEGAS[Math.min(PK.CIEGAS.length - 1, s.nivel + 1)], faltan: s.cfg.subir - ((s.manoN - 1) % s.cfg.subir),
      mesa: s.mesa, pozo: s.pozo, apuestaMax: s.apuestaMax, res: s.res, ganador: s.ganador, log: s.log,
      jug: s.jug.map((j, i) => ({ name: j.name, cpu: !!j.cpu, fichas: j.fichas, apuesta: j.apuesta, retirado: j.retirado, fuera: j.fuera, allin: j.allin, dicho: j.dicho, puesto: j.puesto,
        cartas: i === yo || (fin && j.mostro) ? j.mano : j.mano.map(() => null) })),
      acc: yo >= 0 ? Poker.acciones(s, yo) : null
    };
  },

  /* ---------- Dibujo ---------- */
  /* Palos en SVG: se ven igual en todos los teléfonos (los símbolos de texto a veces no tienen fuente) */
  PALO_SVG: {
    s: "M12 2C9 6 4 9 4 13.5 4 16.5 6.3 18.5 9 18c1-.2 1.8-.8 2.2-1.5L10 22h4l-1.2-5.5c.4.7 1.2 1.3 2.2 1.5 2.7.5 5-1.5 5-4.5C20 9 15 6 12 2Z",
    h: "M12 21C6 16 2.5 12.5 2.5 8.5 2.5 5.5 4.8 3.5 7.4 3.5 9.3 3.5 11 4.6 12 6.3 13 4.6 14.7 3.5 16.6 3.5 19.2 3.5 21.5 5.5 21.5 8.5 21.5 12.5 18 16 12 21Z",
    d: "M12 2 20 12 12 22 4 12Z",
    c: "M12 2.5a4.3 4.3 0 0 0-3.6 6.6A4.3 4.3 0 1 0 10.7 16L10 22h4l-.7-6a4.3 4.3 0 1 0 2.3-6.9A4.3 4.3 0 0 0 12 2.5Z"
  },
  palo(p) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${Poker.PALO_SVG[p]}" fill="currentColor"/></svg>`; },
  carta(c, cls = "") {
    if (!c) return `<span class="pk-c dorso ${cls}"></span>`;
    const [p, col] = PK.PALOS[c[1]], r = PK.NOMBRE_R[c[0]] || c[0];
    return `<span class="pk-c ${cls}" style="--pc:${col}" aria-label="${r}${p}"><b>${r}</b><i>${Poker.palo(c[1])}</i><em>${Poker.palo(c[1])}</em></span>`;
  },
  lugar(r, n) { const ang = Math.PI / 2 - r * 2 * Math.PI / n; return [50 + 44 * Math.cos(ang), 50 + 41 * Math.sin(ang)]; },

  render(v, send, opts) {
    const yo = v.yo >= 0 ? v.yo : 0, Y = v.jug[yo], A = v.acc, U = UI.pk = UI.pk && UI.pk.id === v.id ? UI.pk : { id: v.id, hasta: 0 };
    const nom = j => esc(j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name);
    const fin = v.fase === "fin-mano" || v.fase === "fin";
    const ganadores = new Set(v.res ? v.res.ganadores.map(g => g.i) : []);
    const corto = d => !d ? "" : d.replace(/^Ciega (chica|grande) /, "Ciega ").replace(/^Se retira$/, "Afuera");
    const asientos = v.jug.map((j, i) => {
      const r = (i - yo + v.n) % v.n, [x, y] = Poker.lugar(r, v.n), abajo = y < 30;
      const burbuja = i === v.ultimo && j.dicho && !fin ? `<span class="pk-dicho ${abajo ? "abajo" : ""}" data-k="${v.mov}">${esc(j.dicho)}</span>` : "";
      if (r === 0 && v.yo >= 0) return `<div class="pk-asiento yo" style="left:${x}%;top:${y}%">${burbuja}</div>`;
      return `<div class="pk-asiento ${v.turno === i ? "juega" : ""} ${j.retirado && !j.fuera ? "retirado" : ""} ${j.fuera ? "fuera" : ""} ${ganadores.has(i) ? "gana" : ""}" style="left:${x}%;top:${y}%">
        ${burbuja}
        <span class="pk-ava">${j.cpu ? `<span class="cpu-ic">🤖</span>` : avatar(j.name, 34)}${i === v.boton ? `<i class="pk-boton">D</i>` : ""}</span>
        <b>${nom(j)}</b><small>${j.fuera ? `${j.puesto}º` : j.allin ? "ALL-IN" : `${j.fichas}`}${j.dicho && i !== v.ultimo && !j.fuera && !fin ? ` · <span class="pk-est">${esc(corto(j.dicho))}</span>` : ""}</small>
        ${!j.fuera ? `<span class="pk-mano-r">${j.cartas.map(c => Poker.carta(c, "mini")).join("")}</span>` : ""}</div>`;
    }).join("");
    // Lo apostado en esta vuelta, entre cada jugador y el centro
    const apuestas = v.jug.map((j, i) => {
      if (!j.apuesta) return "";
      const r = (i - yo + v.n) % v.n, [x, y] = Poker.lugar(r, v.n), k = r === 0 ? 0.42 : 0.5;
      return `<span class="pk-ficha-ap" style="left:${50 + (x - 50) * k}%;top:${50 + (y - 50) * k}%">${j.apuesta}</span>`;
    }).join("");
    const mesa = `<div class="pk-mesa n${v.n}" data-k="${v.manoN}-${v.mesa.length}">
      <div class="pk-centro"><div class="pk-comun">${[0, 1, 2, 3, 4].map(k => v.mesa[k] ? Poker.carta(v.mesa[k], `comun ${v.res && v.res.ganadores.some(g => g.cartas.includes(v.mesa[k])) ? "brilla" : ""}`) : `<span class="pk-c hueco"></span>`).join("")}</div>
        <div class="pk-pozo">${fin && v.ganado ? `Se llevó <b>${v.ganado}</b>` : `Pozo <b>${v.pozo}</b>`}</div></div>
      ${apuestas}${asientos}</div>`;
    // Mi mano y lo que tengo
    const mia = v.yo >= 0 && Y.cartas.length && Y.cartas[0] ? Poker.mejor([...Y.cartas, ...v.mesa]) : null;
    const yoTxt = v.yo < 0 ? "" : Y.fuera ? `<p class="sub center">Quedaste ${Y.puesto}º. Mirá cómo termina.</p>` : `<div class="pk-yo ${v.turno === yo ? "juega" : ""} ${ganadores.has(yo) ? "gana" : ""}">
        <div class="pk-mis">${Y.cartas.map(c => Poker.carta(c, `grande ${v.res && v.res.ganadores.some(g => g.i === yo && g.cartas.includes(c)) ? "brilla" : ""}`)).join("")}</div>
        <div class="pk-yo-dat"><b>${esc(Y.name)}${yo === v.boton ? ` <i class="pk-boton">D</i>` : ""}</b><span class="pk-fichas">🔘 ${Y.fichas}</span><small>${Y.retirado ? "Te retiraste" : mia ? `Tenés: <b>${Poker.nombreMano(mia.v)}</b>` : v.mesa.length ? "" : `Fuerza: ${["floja", "jugable", "buena", "muy buena"][Math.min(3, Math.floor(Poker.preflop(Y.cartas) * 4))]}`}</small></div></div>`;
    // Botones
    let barra = "";
    if (A) {
      const min = A.minHasta, max = A.maxHasta;
      U.hasta = Math.max(min, Math.min(max, U.hasta || min));
      const rapido = [["½ pozo", Math.round(v.apuestaMax + v.pozo / 2)], ["Pozo", Math.round(v.apuestaMax + v.pozo)], ["All-in", max]].filter(([, x]) => x >= min && x <= max);
      barra = `<div class="pk-barra">
        ${A.subir ? `<div class="pk-subir"><input type="range" id="pkRango" min="${min}" max="${max}" step="${Math.max(1, Math.round(v.ciegas[0]))}" value="${U.hasta}" aria-label="Cuánto subir">
          <div class="pk-rapidos">${rapido.map(([t, x]) => `<button class="btn ghost chico" data-pkx="${x}">${t}</button>`).join("")}</div></div>` : ""}
        <div class="pk-acc"><button class="btn ghost" id="pkFold">Retirarse</button>
          <button class="btn" id="pkCall">${A.pasar ? "Pasar" : A.pagar >= Y.fichas ? `All-in ${A.pagar}` : `Igualar ${A.pagar}`}</button>
          ${A.subir ? `<button class="btn pk-sube" id="pkRaise">${U.hasta >= max ? "All-in" : `Subir a ${U.hasta}`}</button>` : ""}</div></div>`;
    }
    let estado = "";
    if (v.fase === "fin") {
      const g = v.jug[v.ganador];
      estado = `<div class="verdict ${v.ganador === yo && v.yo >= 0 ? "good" : ""}"><div class="big">${v.ganador === yo && v.yo >= 0 ? "¡Ganaste el torneo!" : `Ganó ${nom(g)}`}</div><div class="note">${v.yo >= 0 && v.ganador !== yo ? `Quedaste ${Y.puesto}º de ${v.n}.` : `Se llevó todas las fichas en ${v.manoN} manos.`}</div></div>
        ${opts.local || opts.isHost ? `<div class="row"><button class="btn" id="pkOtra">Otro torneo</button><button class="btn ghost" id="pkSalir">${opts.local ? "Inicio" : "Volver a la sala"}</button></div>` : ""}`;
    } else if (v.fase === "fin-mano") {
      const r = v.res;
      estado = `<div class="pk-res">${r.ganadores.map(g => `<b>${g.i === yo && v.yo >= 0 ? "¡Ganaste" : nom(v.jug[g.i]) + " gana"} ${g.gana}${g.i === yo && v.yo >= 0 ? "!" : ""}</b>${g.mano ? ` con <i>${esc(g.mano)}</i>` : r.showdown ? "" : " (los demás se retiraron)"}`).join("<br>")}</div>
        ${opts.local || opts.isHost ? `<button class="btn" id="pkSig">Siguiente mano</button>` : `<p class="sub center">El anfitrión reparte la próxima.</p>`}`;
    } else {
      const t = v.jug[v.turno];
      estado = `<p class="aj-estado">${v.turno === yo && v.yo >= 0 ? `🎯 <b>Tu turno.</b> ${A && A.pagar ? `Para seguir tenés que poner ${A.pagar}.` : "Podés pasar o apostar."}` : t ? (t.cpu ? `🤖 ${nom(t)} está pensando…` : `Turno de <b>${nom(t)}</b>.`) : ""}</p>`;
    }
    app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen poker">
      <div class="pk-info"><span>Mano ${v.manoN}</span><span>Ciegas <b>${v.ciegas[0]}/${v.ciegas[1]}</b></span><span>${v.faltan === 1 ? "Suben en la próxima" : `Suben en ${v.faltan} manos`}</span></div>
      ${mesa}${estado}${yoTxt}${barra}
      <details class="panel"><summary class="label">Manos de mayor a menor</summary><p class="summary">${PK.MANOS.slice().reverse().join(" › ")}. Cada uno recibe 2 cartas y se usan las 5 de la mesa: gana la mejor combinación de 5. Las ciegas suben cada 6 manos; quien se queda sin fichas queda afuera.</p></details>
    </section>`;
    const rango = byId("pkRango");
    if (rango) rango.oninput = () => { U.hasta = +rango.value; const b = byId("pkRaise"); if (b) b.textContent = U.hasta >= A.maxHasta ? "All-in" : `Subir a ${U.hasta}`; };
    app.querySelectorAll("[data-pkx]").forEach(b => b.onclick = () => { U.hasta = +b.dataset.pkx; render(); });
    on("pkFold", () => send({ t: "fold" }));
    on("pkCall", () => send({ t: "call" }));
    on("pkRaise", () => { const h = U.hasta; U.hasta = 0; send({ t: "raise", hasta: h }); });
    on("pkSig", () => send({ t: "siguiente" }));
    on("pkOtra", () => send({ t: "again" }));
    on("pkSalir", () => opts.local ? go("home") : send({ t: "lobby" }));
  },

  /* ---------- Contra la máquina ---------- */
  bots(n, nivel) { return shuffle(PK.BOTS).slice(0, n).map(([name, estilo], k) => ({ id: "b" + k, name, cpu: true, estilo, nivel })); },
  empezarLocal(cfg) {
    const u = BD.sesion(), yo = { id: "yo", name: u ? u.nombre : (S.players[0] || "Vos") };
    S.pk = Poker.setup(shuffle([yo, ...Poker.bots(cfg.bots, cfg.nivel)]), cfg);
    UI.pk = null; UI.pkPens = null;
    go("poker");
  },
  /* ---------- Online ---------- */
  empezarOn(R) {
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name }));
    if (jug.length > 8) return "El póker es de hasta 8 jugadores.";
    const faltan = Math.max(0, Math.max(2, S.pkCfg.mesa) - jug.length);
    R.pk = Poker.setup([...jug, ...Poker.bots(Math.min(faltan, 8 - jug.length), S.pkCfg.nivel)], S.pkCfg);
    R.game = "poker"; Poker.programarHost(R);
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") R.pk = Poker.setup(R.pk.jug.map(j => ({ id: j.id, name: j.name, cpu: j.cpu, estilo: j.estilo, nivel: j.nivel })), R.pk.cfg);
    else if (a.t === "lobby" && pid === "H") { R.game = null; R.pk = null; return; }
    else if (a.t === "siguiente") { if (pid === "H") Poker.act(R.pk, pid, a); }
    else Poker.act(R.pk, pid, a);
    Poker.programarHost(R);
  },
  timer: null,
  programarHost(R) {
    const s = R.pk;
    if (!s || s.turno < 0 || !s.jug[s.turno] || !s.jug[s.turno].cpu || Poker.timer === s.id + s.mov) return;
    Poker.timer = s.id + s.mov;
    setTimeout(() => {
      if (R.pk !== s || R.game !== "poker" || Poker.timer !== s.id + s.mov) return;
      Poker.jugarBot(s); Poker.timer = null;
      Net.broadcast(); Poker.programarHost(R);
    }, 900 + Math.random() * 700);
  }
};

PANTALLAS.poker = () => {
  const s = S.pk;
  if (!s) return go("pokerIntro");
  Poker.render(Poker.view(s, "yo"), a => {
    if (a.t === "again") return go("pokerIntro");
    Poker.act(s, "yo", a); render();
  }, { local: true });
  const t = s.jug[s.turno];
  if (t && t.cpu && UI.pkPens !== s.id + s.mov) {
    const k = UI.pkPens = s.id + s.mov;
    setTimeout(() => { if (S.screen !== "poker" || S.pk !== s || UI.pkPens !== k) return; Poker.jugarBot(s); render(); }, 800 + Math.random() * 700);
  }
};

/* Armar la mesa contra la máquina */
PANTALLAS.pokerIntro = () => {
  const c = S.pkCfg;
  app.innerHTML = `${head(0)}<section class="screen">
    <div class="tb-hero"><span class="tb-neon">PÓKER</span><p class="sub">Texas Hold'em en formato torneo: todos arrancan con las mismas fichas, las ciegas suben y gana el último que queda. Las fichas son de la mesa, no tus monedas.</p></div>
    <div class="panel"><span class="label">Bots en la mesa</span><div class="seg">${[1, 2, 3, 4, 5].map(n => `<button aria-pressed="${c.bots === n}" data-pkb="${n}">${n}</button>`).join("")}</div>
      <span class="label">Cómo juegan</span><div class="seg">${[["facil", "Fácil"], ["normal", "Normal"], ["dificil", "Difícil"]].map(([k, t]) => `<button aria-pressed="${c.nivel === k}" data-pkn="${k}">${t}</button>`).join("")}</div>
      <span class="label">Fichas para cada uno</span><div class="seg">${[500, 1000, 2000].map(n => `<button aria-pressed="${c.fichas === n}" data-pkf="${n}">${n}</button>`).join("")}</div></div>
${typeof Mente !== "undefined" ? Mente.chip("poker") : ""}
    <button class="btn tb-girar" id="pkJugar">🃏 Sentarme a jugar</button>
    <p class="summary center">¿Con amigos? Creá una sala en "Jugar online" y elegí Póker: los lugares que sobran los ocupan bots.</p>
    <button class="btn ghost" id="pkVolver">Volver</button>
  </section>`;
  const set = (k, v) => { c[k] = v; store.set("pkCfg", c); render(); };
  app.querySelectorAll("[data-pkb]").forEach(b => b.onclick = () => set("bots", +b.dataset.pkb));
  app.querySelectorAll("[data-pkn]").forEach(b => b.onclick = () => set("nivel", b.dataset.pkn));
  app.querySelectorAll("[data-pkf]").forEach(b => b.onclick = () => set("fichas", +b.dataset.pkf));
  on("pkJugar", () => Poker.empezarLocal(c));
  on("pkVolver", () => go("home"));
};
