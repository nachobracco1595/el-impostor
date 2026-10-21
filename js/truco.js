/* Truco argentino con baraja española de 40 cartas (sin flor).
   - 1 contra 1, 2 contra 2 o 3 contra 3 (los equipos se sientan alternados). Se juega a 15 o a 30 (malas y buenas).
   - 3 cartas por jugador y 3 bazas: gana la mano el equipo que gana 2. Si hay parda, define la otra baza; si todo es parda, gana el equipo del mano.
   - Envido (2), real envido (3) y falta envido, solo en la primera baza. Truco (2), retruco (3) y vale cuatro (4): sube solo el equipo que quiso.
   - "El envido está primero": al que le cantan truco en la primera baza puede contestar con envido.
   - Al mazo: el otro equipo se lleva lo que vale la mano (y 1 más si en la primera baza todavía no se cantó envido). */
const TR_JERARQUIA = { E1: 14, B1: 13, E7: 12, O7: 11 };
const TR_TRUCO = ["", "", "Truco", "Retruco", "Vale cuatro"];
const TR_ENVIDO = { envido: ["Envido", 2], real: ["Real envido", 3], falta: ["Falta envido", 0] };
const TR_CPU = ["🤖 Rita", "🤖 Tito", "🤖 Pepa", "🤖 Cacho", "🤖 Coca"];

const Truco = {
  /* ---------- Cartas ---------- */
  mazo() { const m = []; for (const p of "OCEB") for (const n of ORDEN_CH) m.push(p + n); return shuffle(m); },
  valor(c) {
    if (TR_JERARQUIA[c]) return TR_JERARQUIA[c];
    const n = +c.slice(1);
    return { 3: 10, 2: 9, 1: 8, 12: 7, 11: 6, 10: 5, 7: 4, 6: 3, 5: 2, 4: 1 }[n];
  },
  envidoDe(mano) {
    const v = c => { const n = +c.slice(1); return n >= 10 ? 0 : n; };
    let mejor = Math.max(...mano.map(v));
    for (let a = 0; a < mano.length; a++) for (let b = a + 1; b < mano.length; b++)
      if (mano[a][0] === mano[b][0]) mejor = Math.max(mejor, 20 + v(mano[a]) + v(mano[b]));
    return mejor;
  },
  equipo: (s, i) => i % 2,
  /* Orden de la mesa empezando por el mano (sirve para desempatar) */
  desdeMano: (s, i) => (i - s.mano + s.n) % s.n,

  /* ---------- Partida ---------- */
  setup(jug, cfg) {
    const s = {
      id: "tru-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      jug: jug.map(j => ({ ...j, mano: [], orig: [] })), n: jug.length,
      cfg: { a: cfg && +cfg.a === 15 ? 15 : 30 }, pts: [0, 0], mano: Math.floor(Math.random() * jug.length) - 1, manoN: 0, mov: 0,
      st: { envG: [0, 0], trucoG: [0, 0], vale4G: [0, 0], e33: jug.map(() => 0) },
      fase: "juego", ganador: null, dicho: null, log: []
    };
    if (s.mano < 0) s.mano = s.n - 1;
    Truco.nuevaMano(s);
    return s;
  },
  nuevaMano(s) {
    s.mano = (s.mano + 1) % s.n; s.manoN++;
    const m = Truco.mazo();
    s.jug.forEach((j, i) => { j.mano = m.splice(0, 3); j.orig = j.mano.slice(); if (Truco.envidoDe(j.orig) === 33) s.st.e33[i]++; });
    Object.assign(s, {
      baza: 0, mesa: [[]], ganBaza: [], turno: s.mano, lider: s.mano, fase: "juego", res: null, dicho: null, log: [],
      truco: { nivel: 1, puede: null, pend: null },
      env: { estado: "no", pend: null, res: null }
    });
    s.mov++;
  },
  pend(s) { return s.env.pend ? { tipo: "envido", ...s.env.pend } : s.truco.pend ? { tipo: "truco", ...s.truco.pend } : null; },
  actor(s) { const p = Truco.pend(s); return p ? p.resp : s.turno; },
  rival: (s, i) => (i + 1) % s.n,
  envidoPosible(s, i) { return s.env.estado === "no" && s.baza === 0 && s.truco.nivel === 1 && !s.mesa[0].some(x => x.i === i); },

  /* Qué puede hacer el jugador i ahora */
  acciones(s, i) {
    if (s.fase !== "juego" || i < 0) return {};
    const p = Truco.pend(s), A = {};
    if (p) {
      if (p.resp !== i) return {};
      A.quiero = A.noquiero = true;
      if (p.tipo === "envido") {
        const c = p.cadena, hayFalta = c.includes("falta"), hayReal = c.includes("real");
        A.envido = !hayFalta && !hayReal && c.filter(x => x === "envido").length < 2;
        A.real = !hayFalta && !hayReal;
        A.falta = !hayFalta;
      } else {
        if (p.nivel < 4) A.truco = p.nivel + 1;
        if (Truco.envidoPosible(s, i) && p.nivel === 2) A.envido = A.real = A.falta = true;
        A.mazo = true;
      }
      return A;
    }
    if (i !== s.turno) return {};
    A.jugar = true; A.mazo = true;
    if (Truco.envidoPosible(s, i)) A.envido = A.real = A.falta = true;
    if (s.truco.nivel < 4 && (s.truco.puede === null || s.truco.puede === Truco.equipo(s, i))) A.truco = s.truco.nivel + 1;
    return A;
  },

  decir(s, i, txt) { s.dicho = { i, txt, k: (s.dicho ? s.dicho.k : 0) + 1 }; s.log = [...s.log, `${s.jug[i].name}: ${txt}`].slice(-6); },

  sumar(s, eq, p) {
    s.pts[eq] += p;
    if (s.pts[eq] >= s.cfg.a) { s.pts[eq] = s.cfg.a; s.fase = "fin"; s.ganador = eq; return true; }
    return false;
  },
  faltaValor(s) { return Math.max(1, s.cfg.a - Math.max(...s.pts)); },
  valorEnvido(s, cadena) {
    if (cadena.includes("falta")) return Truco.faltaValor(s);
    return cadena.reduce((t, k) => t + TR_ENVIDO[k][1], 0);
  },

  act(s, pid, a) {
    const i = s.jug.findIndex(j => j.id === pid);
    if (a.t === "siguiente") { if (s.fase === "mano") Truco.nuevaMano(s); return; }
    if (i < 0 || s.fase !== "juego") return;
    const A = Truco.acciones(s, i), eq = Truco.equipo(s, i), p = Truco.pend(s);
    // Los bots anotan con qué mano cantás y cuánto te achicás, para aprender si faroleás
    if (!s.jug[i].cpu && typeof Mente !== "undefined" && Mente.local() && A[a.k || a.t]) {
      if (a.t === "truco" && !p) Mente.anotar("truco", "fuerzaTruco", Truco.fuerza(s, i));
      if ((TR_ENVIDO[a.t] || a.t === "envido") && !(p && p.tipo === "envido")) Mente.anotar("truco", "envCanta", Truco.envidoDe(s.jug[i].orig));
      if (p && p.tipo === "truco" && (a.t === "quiero" || a.t === "noquiero")) Mente.anotar("truco", "achica", a.t === "noquiero" ? 1 : 0);
    }
    if (a.t === "jugar") {
      const J = s.jug[i];
      if (!A.jugar || !J.mano.includes(a.c)) return;
      J.mano = J.mano.filter(c => c !== a.c);
      s.mesa[s.baza].push({ i, c: a.c });
      s.dicho = null; s.mov++;
      if (s.mesa[s.baza].length < s.n) { s.turno = (i + 1) % s.n; return; }
      Truco.cerrarBaza(s);
    } else if (TR_ENVIDO[a.t] || a.t === "envido") {
      const k = a.k || a.t;
      if (!TR_ENVIDO[k] || !A[k]) return;
      if (p && p.tipo === "envido") s.env.pend = { ...s.env.pend, cadena: [...s.env.pend.cadena, k], por: eq, quien: i, resp: Truco.rival(s, i) };
      else s.env.pend = { cadena: [k], por: eq, quien: i, resp: Truco.rival(s, i) };
      s.env.estado = "pend"; s.mov++;
      Truco.decir(s, i, `¡${TR_ENVIDO[k][0]}!`);
    } else if (a.t === "truco") {
      if (!A.truco) return;
      if (p && p.tipo === "truco") s.truco.nivel = p.nivel;
      s.truco.pend = { nivel: A.truco, por: eq, quien: i, resp: Truco.rival(s, i) };
      s.mov++;
      Truco.decir(s, i, `¡${p ? "Quiero " + TR_TRUCO[A.truco].toLowerCase() : TR_TRUCO[A.truco]}!`);
    } else if (a.t === "quiero") {
      if (!A.quiero) return;
      s.mov++;
      Truco.decir(s, i, "¡Quiero!");
      if (p.tipo === "envido") Truco.resolverEnvido(s, true);
      else { s.truco.nivel = p.nivel; s.truco.puede = eq; s.truco.pend = null; }
    } else if (a.t === "noquiero") {
      if (!A.noquiero) return;
      s.mov++;
      Truco.decir(s, i, "No quiero");
      if (p.tipo === "envido") Truco.resolverEnvido(s, false);
      else { s.truco.pend = null; Truco.ganarMano(s, p.por, p.nivel - 1, `${TR_TRUCO[p.nivel]} no querido`); }
    } else if (a.t === "mazo") {
      if (!A.mazo) return;
      s.mov++;
      Truco.decir(s, i, "Me voy al mazo");
      const vale = p && p.tipo === "truco" ? p.nivel - 1 : s.truco.nivel;
      const extra = s.baza === 0 && s.env.estado === "no" ? 1 : 0;
      s.truco.pend = null;
      Truco.ganarMano(s, 1 - eq, vale + extra, `${s.jug[i].name} se fue al mazo`);
    }
  },

  resolverEnvido(s, quiso) {
    const p = s.env.pend, c = p.cadena;
    s.env.pend = null; s.env.estado = "hecho";
    if (!quiso) {
      const pts = c.length === 1 ? 1 : Truco.valorEnvido(s, c.slice(0, -1));
      s.env.res = { eq: p.por, pts, txt: `${TR_ENVIDO[c[c.length - 1]][0]} no querido` };
      if (Truco.sumar(s, p.por, pts)) s.res = { eq: p.por, pts, motivo: "Envido no querido" };
      return;
    }
    // Cada equipo muestra su mejor envido; en empate gana el más cercano al mano
    const best = [null, null];
    s.jug.forEach((j, i) => {
      const e = Truco.envidoDe(j.orig), q = Truco.equipo(s, i);
      if (!best[q] || e > best[q].e || (e === best[q].e && Truco.desdeMano(s, i) < Truco.desdeMano(s, best[q].i))) best[q] = { e, i };
    });
    const g = best[0].e > best[1].e ? 0 : best[1].e > best[0].e ? 1 : Truco.desdeMano(s, best[0].i) < Truco.desdeMano(s, best[1].i) ? 0 : 1;
    const pts = Truco.valorEnvido(s, c);
    s.env.res = { eq: g, pts, vals: [best[0].e, best[1].e], quien: best[g].i, txt: c.map(k => TR_ENVIDO[k][0]).join(", ") };
    s.st.envG[g]++;
    s.dicho = { i: best[g].i, txt: `¡${best[g].e} son mejores!`, k: (s.dicho ? s.dicho.k : 0) + 1 };
    s.log = [...s.log, `Envido: ${best[0].e} a ${best[1].e}`].slice(-6);
    if (Truco.sumar(s, g, pts)) s.res = { eq: g, pts, motivo: `Ganaron el envido con ${best[g].e}` };
  },

  cerrarBaza(s) {
    const m = s.mesa[s.baza];
    const top = Math.max(...m.map(x => Truco.valor(x.c)));
    const arriba = m.filter(x => Truco.valor(x.c) === top);
    const eqs = new Set(arriba.map(x => Truco.equipo(s, x.i)));
    const g = eqs.size > 1 ? -1 : Truco.equipo(s, arriba[0].i);
    s.ganBaza.push(g);
    s.lider = g === -1 ? s.lider : arriba[0].i;
    const ganador = Truco.ganadorMano(s);
    if (ganador != null) return Truco.ganarMano(s, ganador, s.truco.nivel);
    s.baza++; s.mesa.push([]); s.turno = s.lider;
  },
  ganadorMano(s) {
    const g = s.ganBaza, manoEq = Truco.equipo(s, s.mano);
    const ganadas = q => g.filter(x => x === q).length;
    if (ganadas(0) >= 2) return 0;
    if (ganadas(1) >= 2) return 1;
    if (g.length < 2) return null;
    if (g.length === 2) {
      if (g[0] === -1 && g[1] !== -1) return g[1];
      if (g[0] !== -1 && g[1] === -1) return g[0];
      return null;
    }
    if (g[2] !== -1) return g[2];
    return g[0] !== -1 ? g[0] : g[1] !== -1 ? g[1] : manoEq;
  },
  ganarMano(s, eq, pts, motivo) {
    if (s.env.pend) s.env.pend = null;
    if (s.truco.nivel >= 2 && !motivo) s.st.trucoG[eq]++;
    if (s.truco.nivel === 4 && !motivo) s.st.vale4G[eq]++;
    s.res = { eq, pts, motivo: motivo || (s.truco.nivel > 1 ? `Ganaron el ${TR_TRUCO[s.truco.nivel].toLowerCase()}` : "Ganaron la mano") };
    if (!Truco.sumar(s, eq, pts)) s.fase = "mano";
  },

  /* ---------- Compu ---------- */
  fuerza(s, i) {
    const eq = Truco.equipo(s, i), vs = s.jug[i].mano.map(Truco.valor).sort((a, b) => b - a);
    const ganadas = s.ganBaza.filter(x => x === eq).length, perdidas = s.ganBaza.filter(x => x === 1 - eq).length;
    return (vs[0] || 0) + (vs[1] || 0) * 0.5 + ganadas * 6 - perdidas * 6;
  },
  decidirCompu(s) {
    const i = Truco.actor(s), J = s.jug[i], A = Truco.acciones(s, i), p = Truco.pend(s), r = Math.random();
    const env = Truco.envidoDe(J.orig), f = Truco.fuerza(s, i), esMano = Truco.equipo(s, i) === Truco.equipo(s, s.mano);
    // Lo que aprendieron de vos: si cantás con poco, te creen menos; si te achicás seguido, te farolean más
    const M = typeof Mente !== "undefined", h = M ? Mente.habilidad("truco") : 0.5, vsVos = p ? !s.jug[p.quien].cpu : s.jug.some(j => !j.cpu);
    const bluffT = M && vsVos ? Math.max(-3, Math.min(4, (17 - Mente.costumbre("truco", "fuerzaTruco", 17)) / 2)) * h : 0;
    const bluffE = M && vsVos ? Math.max(-2, Math.min(3, (28 - Mente.costumbre("truco", "envCanta", 28)) / 2)) * h : 0;
    const achica = M && vsVos ? Mente.costumbre("truco", "achica", 0.3) : 0.3, farol = 0.03 + 0.1 * h * Math.min(1, achica / 0.5);
    if (p && p.tipo === "envido") {
      const c = p.cadena, falta = c.includes("falta");
      if (A.falta && env >= 32 && r < 0.4) return { t: "falta" };
      if (A.real && env >= 30 && r < 0.5) return { t: "real" };
      if (A.envido && env >= 29 && r < 0.3) return { t: "envido" };
      const umbral = (falta ? 30 : c.length > 1 ? 28 : 25) - (esMano ? 1 : 0) - bluffE;
      return { t: env >= umbral || (!falta && r < 0.08) ? "quiero" : "noquiero" };
    }
    if (p && p.tipo === "truco") {
      if (A.envido && env >= 27 && r < 0.9) return { t: env >= 31 ? "real" : "envido" };
      if (A.truco && f >= 19 && r < 0.55) return { t: "truco" };
      return { t: f >= 11 + (p.nivel - 2) * 2.5 - bluffT || r < 0.12 * (1 - h) ? "quiero" : "noquiero" };
    }
    if (A.envido && env >= 27 && r < 0.75) return { t: env >= 31 && r < 0.4 ? "real" : "envido" };
    if (A.truco && (f >= 17 ? r < 0.55 : r < farol)) return { t: "truco" };
    return { t: "jugar", c: Truco.cartaCompu(s, i) };
  },
  cartaCompu(s, i) {
    const mano = s.jug[i].mano.slice().sort((a, b) => Truco.valor(a) - Truco.valor(b));
    const m = s.mesa[s.baza], eq = Truco.equipo(s, i);
    if (!m.length) return s.baza === 0 ? mano[Math.floor((mano.length - 1) / 2)] : s.ganBaza[s.baza - 1] === eq ? mano[0] : mano[mano.length - 1];
    const top = Math.max(...m.map(x => Truco.valor(x.c)));
    const deQuien = m.filter(x => Truco.valor(x.c) === top).map(x => Truco.equipo(s, x.i));
    if (deQuien.every(q => q === eq)) return mano[0];
    return mano.find(c => Truco.valor(c) > top) || mano.find(c => Truco.valor(c) === top && s.baza > 0) || mano[0];
  },
  jugarCompu(s) {
    if (s.fase !== "juego") return;
    const i = Truco.actor(s);
    if (!s.jug[i].cpu) return;
    Truco.act(s, s.jug[i].id, Truco.decidirCompu(s));
  },

  resultado(s, pid) {
    if (s.fase !== "fin") return null;
    const i = s.jug.findIndex(j => j.id === pid); if (i < 0) return null;
    const eq = Truco.equipo(s, i);
    return { juego: "truco", id: s.id, gano: s.ganador === eq, vsCompu: s.jug.every((j, k) => Truco.equipo(s, k) === eq || j.cpu), n: s.n,
      envidos: s.st.envG[eq], vale4: s.st.vale4G[eq], e33: s.st.e33[i] };
  },

  view(s, pid) {
    const yo = s.jug.findIndex(j => j.id === pid), p = Truco.pend(s);
    return {
      game: "truco", me: pid, yo, n: s.n, fase: s.fase, pts: s.pts, a: s.cfg.a, mano: s.mano, manoN: s.manoN, baza: s.baza, turno: s.turno,
      actor: s.fase === "juego" ? Truco.actor(s) : -1, mov: s.mov,
      pend: p ? { tipo: p.tipo, resp: p.resp, quien: p.quien, nivel: p.nivel, cadena: p.cadena } : null,
      mesa: s.mesa, ganBaza: s.ganBaza, nivel: s.truco.nivel, envRes: s.env.res, res: s.res, ganador: s.ganador, dicho: s.dicho, log: s.log,
      jug: s.jug.map((j, i) => ({ name: j.name, cpu: !!j.cpu, n: j.mano.length, eq: Truco.equipo(s, i) })),
      cartas: yo >= 0 ? s.jug[yo].mano : [], miEnv: yo >= 0 ? Truco.envidoDe(s.jug[yo].orig) : 0,
      acc: Truco.acciones(s, yo),
      // Al terminar la mano se muestran las cartas que quedaron
      resto: s.fase !== "juego" ? s.jug.map(j => j.mano) : null
    };
  },

  /* ---------- Dibujo ---------- */
  fosforos(p, a) {
    const grupos = a / 5, ancho = 30;
    let svg = "";
    const palo = (x1, y1, x2, y2, on) => on ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f1d9a6" stroke-width="3" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="2.6" fill="#e03131"/>` : "";
    for (let g = 0; g < grupos; g++) {
      const k = Math.max(0, Math.min(5, p - g * 5)), x = g * ancho + (a === 30 && g >= 3 ? 8 : 0) + 4, y = 4, L = 20;
      svg += `<rect x="${x}" y="${y}" width="${L}" height="${L}" rx="2" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1.5" stroke-dasharray="2 3"/>`;
      svg += palo(x, y + L, x, y, k >= 1) + palo(x, y, x + L, y, k >= 2) + palo(x + L, y, x + L, y + L, k >= 3) + palo(x + L, y + L, x, y + L, k >= 4) + palo(x, y + L, x + L, y, k >= 5);
    }
    if (a === 30) svg += `<line x1="${3 * ancho + 4}" y1="0" x2="${3 * ancho + 4}" y2="28" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3"/>`;
    const w = grupos * ancho + (a === 30 ? 8 : 0) + 4;
    return `<svg class="tr-fosf" viewBox="0 0 ${w} 28" width="${w}" height="28" aria-hidden="true">${svg}</svg>`;
  },
  lugar(r, n) {
    const ang = Math.PI / 2 - r * 2 * Math.PI / n;   // se juega hacia la derecha
    return [50 + 41 * Math.cos(ang), 50 + 38 * Math.sin(ang)];
  },

  render(v, send, opts) {
    const yo = v.yo >= 0 ? v.yo : 0, miEq = v.yo >= 0 ? v.jug[yo].eq : 0, A = v.acc || {};
    const nom = j => esc(j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name);
    const eqNom = q => v.n === 2 ? (q === miEq && v.yo >= 0 ? "Vos" : nom(v.jug.find(j => j.eq === q))) : q === miEq ? "Nosotros" : "Ellos";
    const pts = q => v.pts[q];
    const tanto = q => `<div class="tr-eq ${q === miEq ? "nos" : "ellos"}"><div class="headrow"><b>${eqNom(q)}</b><span class="tr-num">${pts(q)}${v.a === 30 ? `<small>${pts(q) < 15 ? " malas" : " buenas"}</small>` : ""}</span></div>${Truco.fosforos(pts(q), v.a)}</div>`;
    const marcador = `<div class="tr-marcador">${tanto(miEq)}${tanto(1 - miEq)}</div>`;

    // Mesa: cada jugador alrededor y sus cartas jugadas entre él y el centro
    const asientos = v.jug.map((j, i) => {
      const r = (i - yo + v.n) % v.n, [x, y] = Truco.lugar(r, v.n);
      const juega = v.actor === i;
      const burbuja = v.dicho && v.dicho.i === i ? `<span class="tr-burbuja ${x > 70 ? "der" : x < 30 ? "izq" : ""}" data-k="${v.dicho.k}">${esc(v.dicho.txt)}</span>` : "";
      if (r === 0 && v.yo >= 0) return `<div class="tr-asiento yo" style="left:${x}%;top:${y}%">${burbuja}</div>`;
      return `<div class="tr-asiento ${j.eq === miEq ? "nos" : "ellos"} ${juega ? "juega" : ""}" style="left:${x}%;top:${y}%">${burbuja}
        <span class="tr-ava">${j.cpu ? `<span class="cpu-ic">🤖</span>` : avatar(j.name, 34)}${i === v.mano ? `<i class="tr-mano-ic" title="Es mano">✋</i>` : ""}</span>
        <b>${nom(j)}</b><span class="tr-dorsos">${(v.resto ? v.resto[i] : Array(j.n).fill(null)).map(c => `<i class="${c ? "abierta" : ""}">${c ? Chin.carta(c) : ""}</i>`).join("")}</span></div>`;
    }).join("");
    const jugadas = v.mesa.map((baza, b) => baza.map(({ i, c }) => {
      const r = (i - yo + v.n) % v.n, [x, y] = Truco.lugar(r, v.n), lerp = v.n > 4 ? 0.5 : 0.42, cx = 50 + (x - 50) * lerp, cy = 50 + (y - 50) * lerp;
      const g = v.ganBaza[b], gano = g != null && g !== -1 && g === v.jug[i].eq && Truco.valor(c) === Math.max(...baza.filter(z => v.jug[z.i].eq === g).map(z => Truco.valor(z.c)));
      return `<span class="tr-jugada ${gano ? "gano" : ""} ${g === -1 ? "parda" : ""}" style="left:${cx}%;top:${cy}%;--dx:${(b - 1) * (v.n === 2 ? 48 : v.n === 4 ? 24 : 14)}px;z-index:${b + 2}">${Chin.carta(c)}</span>`;
    }).join("")).join("");
    const bazas = `<div class="tr-bazas">${[0, 1, 2].map(b => { const g = v.ganBaza[b]; return `<i class="${g == null ? "" : g === -1 ? "parda" : g === miEq ? "nos" : "ellos"}" title="Baza ${b + 1}">${g == null ? b + 1 : g === -1 ? "=" : g === miEq ? "✓" : "✗"}</i>`; }).join("")}</div>`;
    const valeTxt = `<span class="tr-vale ${v.nivel > 1 ? "on" : ""}">${v.nivel > 1 ? `${TR_TRUCO[v.nivel]} · vale ${v.nivel}` : "Vale 1"}</span>`;
    const mesa = `<div class="tr-mesa n${v.n}" data-k="${v.manoN}-${v.mesa.flat().length}">${jugadas}${asientos}</div><div class="tr-info"><span class="label">Bazas</span>${bazas}${valeTxt}<span class="label">Mano ${v.manoN}</span></div>`;

    // Estado y botones
    const quien = i => i === v.yo ? "vos" : nom(v.jug[i]);
    let estado = "", botones = "";
    if (v.fase === "juego") {
      const P = v.pend;
      if (P) {
        const que = P.tipo === "envido" ? P.cadena.map(k => TR_ENVIDO[k][0]).join(" + ") : TR_TRUCO[P.nivel];
        estado = P.resp === v.yo ? `🎯 <b>${esc(nom(v.jug[P.quien]))}</b> te cantó <b>${esc(que)}</b>. ¿Querés?` : `${esc(quien(P.quien))} cantó <b>${esc(que)}</b>. Responde ${esc(quien(P.resp))}…`;
      } else estado = v.turno === v.yo ? `🎴 <b>Tu turno:</b> tocá una carta para jugarla${A.envido ? " o cantá envido" : ""}${A.truco ? " o truco" : ""}.` : v.jug[v.turno].cpu ? `🤖 ${nom(v.jug[v.turno])} está pensando…` : `Turno de <b>${nom(v.jug[v.turno])}</b>.`;
      const b = [], e = [];
      if (A.quiero) b.push(`<button class="btn tr-si" data-tr="quiero">¡Quiero!</button>`, `<button class="btn ghost tr-no" data-tr="noquiero">No quiero</button>`);
      if (A.truco) b.push(`<button class="btn tr-truco" data-tr="truco">${v.pend && v.pend.tipo === "truco" ? "Quiero " + TR_TRUCO[A.truco].toLowerCase() : TR_TRUCO[A.truco]}</button>`);
      if (A.envido) e.push(`<button class="btn tr-env" data-tr="envido">Envido</button>`);
      if (A.real) e.push(`<button class="btn tr-env" data-tr="real">Real envido</button>`);
      if (A.falta) e.push(`<button class="btn tr-env" data-tr="falta">Falta envido</button>`);
      botones = (b.length ? `<div class="tr-botones">${b.join("")}</div>` : "") + (e.length ? `<div class="tr-botones env">${e.join("")}</div>` : "") + (A.mazo ? `<button class="linkish tr-mazo" data-tr="mazo">🏳️ Irse al mazo</button>` : "");
    }
    const env = v.envRes ? `<span class="tr-envres">${esc(v.envRes.txt)}: ${v.envRes.vals ? `${v.envRes.vals[miEq]} a ${v.envRes.vals[1 - miEq]} · ` : ""}+${v.envRes.pts} para ${eqNom(v.envRes.eq).toLowerCase() === "vos" ? "vos" : esc(eqNom(v.envRes.eq))}</span>` : "";

    let cartel = "";
    if (v.fase === "mano" || v.fase === "fin") {
      const gane = v.res && v.res.eq === miEq;
      cartel = v.fase === "fin"
        ? `<div class="verdict ${v.ganador === miEq && v.yo >= 0 ? "good" : "bad"}"><div class="big">${v.yo < 0 ? `Ganó ${esc(eqNom(v.ganador))}` : v.ganador === miEq ? "¡Ganaron la partida!" : "Perdieron la partida"}</div><div class="note">${v.pts[miEq]} a ${v.pts[1 - miEq]}${v.res ? ` · ${esc(v.res.motivo)}` : ""}.</div></div>
          ${opts.local || opts.isHost ? `<div class="row"><button class="btn" id="trOtra">Otra partida</button><button class="btn ghost" id="trSalir">${opts.local ? "Inicio" : "Volver a la sala"}</button></div>` : `<p class="sub center">El anfitrión puede empezar otra.</p>`}`
        : `<div class="tr-fin-mano ${gane ? "nos" : "ellos"}"><b>${esc(v.res.motivo)}</b><span>+${v.res.pts} para ${esc(eqNom(v.res.eq))}</span>
          ${opts.local || opts.isHost ? `<button class="btn" id="trSig">Repartir de nuevo</button>` : `<small>El anfitrión reparte la próxima.</small>`}</div>`;
    }

    const miTurnoJugar = !!A.jugar;
    const mano = v.yo >= 0 ? `<div class="tr-mano ${miTurnoJugar ? "activa" : ""}">${v.cartas.map((c, k) => `<button class="tr-carta" data-c="${c}" ${miTurnoJugar ? "" : "disabled"} style="--k:${k - (v.cartas.length - 1) / 2}" aria-label="Jugar ${c}">${Chin.carta(c)}</button>`).join("")}</div>
      <p class="tr-ayuda">Tu envido: <b>${v.miEnv}</b>${v.n > 2 ? ` · Equipo: <b>${v.jug.filter(j => j.eq === miEq).map(nom).join(", ")}</b>` : ""}</p>` : `<p class="sub center">Estás mirando la partida.</p>`;

    app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen truco">
      ${marcador}${mesa}
      ${v.fase === "juego" ? `<p class="aj-estado tr-estado">${estado}</p>` : ""}
      ${cartel}${v.fase !== "fin" ? mano : ""}
      ${v.fase === "juego" ? `<div class="tr-botonera">${botones}</div>` : ""}${env ? `<p class="tr-env-linea">${env}</p>` : ""}
      <details class="panel"><summary class="label">Reglas rápidas</summary><p class="summary">De mayor a menor: <b>1 de espadas</b>, <b>1 de bastos</b>, <b>7 de espadas</b>, <b>7 de oro</b>, los 3, los 2, el 1 de copa y de oro, los reyes (12), caballos (11), sotas (10), el 7 de copa y de basto, los 6, los 5 y los 4.<br>
        <b>Envido</b> (solo en la primera baza): dos cartas del mismo palo suman 20 más sus números (las figuras valen 0). Envido 2, real envido 3, falta envido lo que le falta al que va ganando. No querido: 1.<br>
        <b>Truco</b> 2, <b>retruco</b> 3, <b>vale cuatro</b> 4. Solo sube el equipo que quiso. Gana la mano quien gana 2 de las 3 bazas; en parda define la otra y, si son todas pardas, gana el mano. Se juega a ${v.a}.</p></details>
    </section>`;
    app.querySelectorAll("[data-c]").forEach(b => b.onclick = () => send({ t: "jugar", c: b.dataset.c }));
    app.querySelectorAll("[data-tr]").forEach(b => b.onclick = () => send({ t: b.dataset.tr }));
    on("trSig", () => send({ t: "siguiente" }));
    on("trOtra", () => send({ t: "again" }));
    on("trSalir", () => opts.local ? go("home") : send({ t: "lobby" }));
  },

  /* ---------- Un teléfono ---------- */
  /* Arma los asientos: los equipos van alternados (0, 2, 4 contra 1, 3, 5) */
  asientos(personas, total, juntos) {
    const orden = juntos ? [0, 2, 4, 1, 3, 5].filter(x => x < total) : [...Array(total).keys()];
    const sillas = Array(total).fill(null);
    personas.slice(0, total).forEach((p, k) => sillas[orden[k]] = p);
    let c = 0;
    return sillas.map((p, i) => p || { id: "c" + i, name: TR_CPU[c++ % TR_CPU.length], cpu: true });
  },
  empezarLocal(jug) {
    S.tru = Truco.setup(jug, S.trCfg);
    UI.trVisto = null; UI.trPens = null;
    go("truco");
  },
  empezarOn(R) {
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name }));
    if (jug.length > 6) return "El truco es de 2 a 6 jugadores.";
    const total = Math.max(jug.length + jug.length % 2, S.trCfg.n || 2);
    if (total > 6) return "El truco es de 2 a 6 jugadores.";
    R.tru = Truco.setup(Truco.asientos(jug, total, S.trCfg.juntos), S.trCfg);
    R.game = "truco";
    Truco.programarHost(R);
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") R.tru = Truco.setup(R.tru.jug.map(j => ({ id: j.id, name: j.name, cpu: j.cpu })), R.tru.cfg);
    else if (a.t === "lobby" && pid === "H") { R.game = null; R.tru = null; return; }
    else if (a.t === "siguiente") { if (pid === "H") Truco.act(R.tru, pid, a); }
    else Truco.act(R.tru, pid, a);
    Truco.programarHost(R);
  },
  /* En online la compu juega en el teléfono del anfitrión */
  programarHost(R) {
    const s = R.tru;
    if (!s || s.fase !== "juego" || !s.jug[Truco.actor(s)].cpu || Truco.timer === s.id + s.mov) return;
    Truco.timer = s.id + s.mov;
    setTimeout(() => {
      if (R.tru !== s || R.game !== "truco" || Truco.timer !== s.id + s.mov) return;
      Truco.jugarCompu(s); Truco.timer = null;
      Net.broadcast(); Truco.programarHost(R);
    }, 900 + Math.random() * 500);
  },
  timer: null
};

PANTALLAS.truco = () => {
  const s = S.tru;
  const humanos = s.jug.map((j, i) => j.cpu ? -1 : i).filter(i => i >= 0);
  const act = s.fase === "juego" ? Truco.actor(s) : -1;
  // Varias personas en un teléfono: se pasa el teléfono cuando le toca a otra
  if (humanos.length > 1 && act >= 0 && !s.jug[act].cpu && UI.trVisto !== act) {
    app.innerHTML = `${head(0)}<section class="stage passto"><p class="sub">${esc(s.log[s.log.length - 1] || `Mano ${s.manoN}`)}</p>
      <div class="pass-art">${personaje(colorDe(s.jug[act].name), "duda", 110)}</div>
      <p class="label" style="margin:0">Pásale el teléfono a</p><div class="who">${esc(s.jug[act].name)}</div>
      <button class="btn" id="trSoy">Soy ${esc(s.jug[act].name)}, ver mis cartas</button></section>`;
    on("trSoy", () => { UI.trVisto = act; render(); });
    return;
  }
  const yo = humanos.length === 1 ? humanos[0] : act >= 0 && !s.jug[act].cpu ? act : UI.trVisto ?? humanos[0];
  Truco.render(Truco.view(s, s.jug[yo].id), a => {
    if (a.t === "again") return Truco.empezarLocal(s.jug.map(j => ({ id: j.id, name: j.name, cpu: j.cpu })));
    Truco.act(s, s.jug[yo].id, a);
    render();
  }, { local: true });
  if (act >= 0 && s.jug[act].cpu && UI.trPens !== s.id + s.mov) {
    const k = UI.trPens = s.id + s.mov;
    setTimeout(() => { if (S.screen !== "truco" || S.tru !== s || UI.trPens !== k) return; Truco.jugarCompu(s); render(); }, 900 + Math.random() * 500);
  }
};
