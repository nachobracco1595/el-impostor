/* Burako con fichas: números del 1 al 13 en 4 colores (dos de cada una) y 2 comodines. Los 2 también sirven de comodín.
   - 2 jugadores o 4 en parejas (sentados alternados). Cada uno recibe 11 fichas y cada equipo tiene un "muerto" de 11.
   - En tu turno: robas del mazo (una ficha) o levantas el pozo (todas las fichas tiradas). Bajas juegos y tiras una ficha.
   - Juegos: escalera (3 o más seguidas del mismo color; el 1 va antes del 2 o después del 13) o pierna (3 o más del mismo número).
     Un solo comodín por juego. Con 7 fichas es canasta: limpia (sin comodín) 200 puntos, sucia 100.
   - Al quedarte sin fichas por primera vez tomas el muerto. Para cerrar hace falta haber tomado el muerto y tener una canasta.
   - Cuenta: lo bajado suma, lo que queda en la mano resta, cerrar suma 100 y no tomar el muerto resta 100. */
const BK = {
  COLORES: { R: ["rojo", "#e03131"], A: ["azul", "#1c7ed6"], N: ["negro", "#212529"], Y: ["amarillo", "#e67700"] },
  METAS: [[0, "Una mano"], [1500, "A 1500"], [3000, "A 3000"]],
  CPU: ["🤖 Rita", "🤖 Tito", "🤖 Pepa"]
};

const Burako = {
  /* ---------- Fichas: "R07a" = rojo, 7, copia a. Comodín: "J00a" ---------- */
  col: t => t[0], num: t => +t.slice(1, 3),
  esJoker: t => t[0] === "J",
  esComodin: t => t[0] === "J" || +t.slice(1, 3) === 2,
  valor(t) { if (t[0] === "J") return 50; const n = +t.slice(1, 3); return n === 2 ? 20 : n === 1 ? 15 : n >= 8 ? 10 : 5; },
  mazo() {
    const m = [];
    for (const c of "RANY") for (let n = 1; n <= 13; n++) for (const k of "ab") m.push(c + String(n).padStart(2, "0") + k);
    m.push("J00a", "J00b");
    return shuffle(m);
  },
  ordenar(mano, modo) {
    const ord = t => Burako.esJoker(t) ? 999 : modo === "num" ? Burako.num(t) * 10 + "RANY".indexOf(t[0]) : "RANY".indexOf(t[0]) * 100 + Burako.num(t);
    return mano.slice().sort((a, b) => ord(a) - ord(b) || (a < b ? -1 : 1));
  },

  /* ¿Estas fichas forman un juego? → { tipo, orden, comodines } o null */
  analizar(fs) {
    if (!fs || fs.length < 3) return null;
    const jok = fs.filter(Burako.esJoker), resto = fs.filter(t => !Burako.esJoker(t)), num = Burako.num;
    const escalera = () => {
      const otros = resto.filter(t => num(t) !== 2), doses = resto.filter(t => num(t) === 2);
      if (!otros.length) return null;
      const c = otros[0][0];
      if (!otros.every(t => t[0] === c)) return null;
      for (const dosNat of [null, ...doses.filter(t => t[0] === c).slice(0, 1)]) for (const alto of [false, true]) {
        if (alto && !otros.some(t => num(t) === 1)) continue;
        const nat = dosNat ? [...otros, dosNat] : otros, wild = [...jok, ...doses.filter(t => t !== dosNat)];
        if (wild.length > 1) continue;
        const val = t => num(t) === 1 && alto ? 14 : num(t);
        const vs = nat.map(val).sort((a, b) => a - b);
        if (new Set(vs).size !== vs.length) continue;
        let lo = vs[0], hi = vs[vs.length - 1];
        const huecos = hi - lo + 1 - vs.length;
        if (huecos > wild.length) continue;
        if (wild.length > huecos) { if (hi < (alto ? 14 : 13)) hi++; else if (lo > 1) lo--; else continue; }
        const orden = []; let wi = 0;
        for (let v = lo; v <= hi; v++) orden.push(nat.find(x => val(x) === v) || wild[wi++]);
        return { tipo: "esc", orden, comodines: wild.length, color: c };
      }
      return null;
    };
    const pierna = () => {
      let nat = resto.filter(t => num(t) !== 2), wild = [...jok, ...resto.filter(t => num(t) === 2)];
      if (!nat.length) { nat = resto; wild = jok; }           // pierna de doses
      if (nat.length < 2 || wild.length > 1 || !nat.every(t => num(t) === num(nat[0]))) return null;
      return { tipo: "pie", orden: [...Burako.ordenar(nat), ...wild], comodines: wild.length };
    };
    return escalera() || pierna();
  },
  juego(fs) { const a = Burako.analizar(fs); return a && { fichas: a.orden, tipo: a.tipo, canasta: a.orden.length >= 7, limpia: a.comodines === 0 }; },

  /* ---------- Partida ---------- */
  equipo: (s, i) => i % 2,
  setup(jug, cfg) {
    const s = {
      id: "bk-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      jug: jug.map(j => ({ ...j, mano: [] })), n: jug.length, cfg: { meta: cfg && cfg.meta != null ? +cfg.meta : 1500 },
      pts: [0, 0], ronda: 0, mano: Math.floor(Math.random() * jug.length), mov: 0,
      st: { limpias: [0, 0], cierres: [0, 0] }, historial: []
    };
    Burako.nuevaMano(s);
    return s;
  },
  nuevaMano(s) {
    s.ronda++; s.mano = (s.mano + 1) % s.n;
    const m = Burako.mazo();
    s.jug.forEach(j => j.mano = m.splice(0, 11));
    Object.assign(s, { muertos: [m.splice(0, 11), m.splice(0, 11)], muertoTomado: [false, false], mazo: m, descarte: [], mesa: [[], []],
      turno: s.mano, fase: "robar", res: null, log: [], aviso: null, mov: s.mov + 1, turnos: 0 });
  },
  decir(s, txt) { s.log = [...s.log, txt].slice(-5); },
  tieneCanasta: (s, q) => s.mesa[q].some(j => j.canasta),
  /* ¿Puede quedar con `k` fichas después de esta jugada? (sin poder tirar no se puede seguir) */
  puedeQuedar(s, i, k, mesaDespues) {
    const q = Burako.equipo(s, i), muerto = !s.muertoTomado[q], canasta = (mesaDespues || s.mesa[q]).some(j => j.canasta);
    if (k >= 2) return true;
    return muerto || canasta && s.muertoTomado[q];
  },

  act(s, pid, a) {
    if (a.t === "siguiente") { if (s.fase === "finMano") Burako.nuevaMano(s); return; }
    const i = s.jug.findIndex(j => j.id === pid), J = s.jug[i];
    if (!J || i !== s.turno || (s.fase !== "robar" && s.fase !== "jugar")) return;
    const q = Burako.equipo(s, i), tiene = ids => Array.isArray(ids) && ids.length && new Set(ids).size === ids.length && ids.every(t => J.mano.includes(t));
    if (a.t === "robar" && s.fase === "robar") {
      if (a.de === "descarte") {
        if (!s.descarte.length) return;
        J.mano.push(...s.descarte); Burako.decir(s, `${J.name} levantó el pozo (${s.descarte.length})`); s.descarte = [];
      } else {
        if (!s.mazo.length) return Burako.cerrarMano(s, null);
        J.mano.push(s.mazo.pop()); Burako.decir(s, `${J.name} robó`);
      }
      s.fase = "jugar"; s.mov++;
    } else if (a.t === "bajar" && s.fase === "jugar" && tiene(a.ids)) {
      const jg = Burako.juego(a.ids); if (!jg) return;
      const mesa = [...s.mesa[q], jg], quedan = J.mano.length - a.ids.length;
      if (!Burako.puedeQuedar(s, i, quedan, mesa)) return;
      s.mesa[q] = mesa; J.mano = J.mano.filter(t => !a.ids.includes(t));
      Burako.decir(s, `${J.name} bajó ${jg.tipo === "esc" ? "una escalera" : "una pierna"}`);
      if (jg.canasta) Burako.festejo(s, i, jg);
      s.mov++; Burako.revisarVacia(s, i, false);
    } else if (a.t === "agregar" && s.fase === "jugar" && tiene(a.ids) && s.mesa[q][a.k]) {
      const viejo = s.mesa[q][a.k], jg = Burako.juego([...viejo.fichas, ...a.ids]); if (!jg) return;
      const mesa = s.mesa[q].map((x, k) => k === a.k ? jg : x), quedan = J.mano.length - a.ids.length;
      if (!Burako.puedeQuedar(s, i, quedan, mesa)) return;
      s.mesa[q] = mesa; J.mano = J.mano.filter(t => !a.ids.includes(t));
      Burako.decir(s, `${J.name} agregó ${a.ids.length} ficha${a.ids.length > 1 ? "s" : ""}`);
      if (jg.canasta && !viejo.canasta) Burako.festejo(s, i, jg);
      s.mov++; Burako.revisarVacia(s, i, false);
    } else if (a.t === "tirar" && s.fase === "jugar" && J.mano.includes(a.id)) {
      if (J.mano.length === 1 && !Burako.puedeQuedar(s, i, 0)) return;
      J.mano = J.mano.filter(t => t !== a.id); s.descarte.push(a.id); s.mov++;
      if (Burako.revisarVacia(s, i, true)) return;
      // Por si nadie puede cerrar nunca (se llevan el descarte una y otra vez): la mano termina a las 400 jugadas
      if (++s.turnos > 400) return Burako.cerrarMano(s, null);
      s.turno = (i + 1) % s.n; s.fase = "robar";
    }
  },
  festejo(s, i, jg) { s.aviso = { k: s.mov, txt: `¡Canasta ${jg.limpia ? "limpia" : "sucia"}!`, eq: Burako.equipo(s, i) }; if (jg.limpia) s.st.limpias[Burako.equipo(s, i)]++; },
  /* Sin fichas: toma el muerto o cierra. Devuelve true si cerró la mano. */
  revisarVacia(s, i, tiro) {
    const J = s.jug[i], q = Burako.equipo(s, i);
    if (J.mano.length) return false;
    if (!s.muertoTomado[q]) {
      s.muertoTomado[q] = true; J.mano = s.muertos[q]; s.muertos[q] = [];
      s.aviso = { k: s.mov, txt: `¡${J.name.replace(/^🤖\s*/, "")} tomó el muerto!`, eq: q };
      Burako.decir(s, `${J.name} tomó el muerto`);
      if (tiro) { s.turno = (i + 1) % s.n; s.fase = "robar"; return true; }
      return false;
    }
    Burako.cerrarMano(s, q);
    return true;
  },
  cerrarMano(s, cerro) {
    const cuenta = [0, 1].map(q => {
      const mesa = s.mesa[q].reduce((t, j) => t + j.fichas.reduce((a, f) => a + Burako.valor(f), 0), 0);
      const canastas = s.mesa[q].reduce((t, j) => t + (j.canasta ? (j.limpia ? 200 : 100) : 0), 0);
      const mano = s.jug.filter((_, i) => Burako.equipo(s, i) === q).reduce((t, j) => t + j.mano.reduce((a, f) => a + Burako.valor(f), 0), 0);
      const r = { mesa, canastas, cierre: cerro === q ? 100 : 0, mano: -mano, muerto: s.muertoTomado[q] ? 0 : -100 };
      r.total = r.mesa + r.canastas + r.cierre + r.mano + r.muerto;
      return r;
    });
    cuenta.forEach((r, q) => s.pts[q] += r.total);
    if (cerro != null) s.st.cierres[cerro]++;
    s.res = { cerro, cuenta, sinFichas: cerro == null };
    s.historial.push(cuenta.map(r => r.total));
    const fin = !s.cfg.meta || s.pts.some(p => p >= s.cfg.meta);
    if (fin) { s.fase = "fin"; s.ganador = s.pts[0] === s.pts[1] ? (cerro ?? 0) : s.pts[0] > s.pts[1] ? 0 : 1; }
    else s.fase = "finMano";
    s.mov++;
  },

  /* ---------- Compu ---------- */
  util(s, i, t) {
    if (Burako.esComodin(t)) return 1000;
    const mano = s.jug[i].mano.filter(x => x !== t && !Burako.esComodin(x)), n = Burako.num(t);
    let u = 0;
    for (const x of mano) {
      if (x[0] === t[0]) { const d = Math.abs(Burako.num(x) - n); if (d === 1) u += 4; else if (d === 2) u += 2; else if (d === 0) u -= 1; }
      if (Burako.num(x) === n && x[0] !== t[0]) u += 3;
    }
    const q = Burako.equipo(s, i);
    if (s.mesa[q].some(j => Burako.analizar([...j.fichas, t]))) u += 50;
    if (s.mesa[1 - q].some(j => Burako.analizar([...j.fichas, t]))) u += 15;     // no regalarle fichas al otro equipo
    return u;
  },
  buscarJuego(mano) {
    const nat = mano.filter(t => !Burako.esComodin(t)), wild = mano.filter(Burako.esComodin);
    const prueba = ids => Burako.analizar(ids) ? ids : null;
    // Escaleras naturales (una ficha por número)
    for (const c of "RANY") {
      const por = {}; nat.filter(t => t[0] === c).forEach(t => { por[Burako.num(t)] = por[Burako.num(t)] || t; });
      if (por[1]) por[14] = por[1];
      let run = [];
      for (let v = 1; v <= 15; v++) {
        if (por[v] && !(v === 14 && run.some(t => Burako.num(t) === 1))) run.push(por[v]);
        else { if (run.length >= 3) { const r = prueba(run); if (r) return r; } run = por[v] ? [por[v]] : []; }
      }
    }
    // Piernas naturales
    const por = {}; nat.forEach(t => (por[Burako.num(t)] = por[Burako.num(t)] || []).push(t));
    for (const g of Object.values(por)) if (g.length >= 3) { const r = prueba(g); if (r) return r; }
    // Con un comodín
    if (wild.length) {
      const w = wild.find(Burako.esJoker) || wild[0];
      for (const a of nat) for (const b of nat) if (a < b && a[0] === b[0] && Math.abs(Burako.num(a) - Burako.num(b)) <= 2 && Burako.num(a) !== Burako.num(b)) { const r = prueba([a, b, w]); if (r) return r; }
      for (const g of Object.values(por)) if (g.length === 2) { const r = prueba([...g, w]); if (r) return r; }
    }
    return null;
  },
  decidir(s) {
    const i = s.turno, J = s.jug[i], q = Burako.equipo(s, i);
    if (s.fase === "robar") {
      const top = s.descarte[s.descarte.length - 1];
      const conTop = top && Burako.buscarJuego([...J.mano, top]);
      const usable = Burako.puedeQuedar(s, i, J.mano.length);       // si después de usarla me quedo sin poder tirar, no sirve
      const sirve = top && usable && (Burako.esComodin(top) || s.mesa[q].some(j => Burako.analizar([...j.fichas, top])) || (conTop && conTop.includes(top)));
      return { t: "robar", de: top && (sirve || s.descarte.length >= 5 && Burako.util(s, i, top) >= 4) || !s.mazo.length ? "descarte" : "mazo" };
    }
    // Agregar a lo que ya está en la mesa (primero las fichas naturales)
    const fichas = Burako.ordenar(J.mano).sort((a, b) => Burako.esComodin(a) - Burako.esComodin(b));
    for (let k = 0; k < s.mesa[q].length; k++) for (const t of fichas) {
      const j = s.mesa[q][k];
      if (Burako.esComodin(t) && (j.fichas.some(Burako.esComodin) || j.canasta && j.limpia)) continue;
      const nuevo = Burako.juego([...j.fichas, t]);
      if (nuevo && Burako.puedeQuedar(s, i, J.mano.length - 1, s.mesa[q].map((x, kk) => kk === k ? nuevo : x))) return { t: "agregar", ids: [t], k };
    }
    const nuevo = Burako.buscarJuego(J.mano);
    if (nuevo && Burako.puedeQuedar(s, i, J.mano.length - nuevo.length, [...s.mesa[q], Burako.juego(nuevo)])) return { t: "bajar", ids: nuevo };
    const tira = J.mano.slice().sort((a, b) => Burako.util(s, i, a) - Burako.util(s, i, b) || Burako.valor(b) - Burako.valor(a))[0];
    return { t: "tirar", id: tira };
  },
  jugarCompu(s) {
    if (s.fase !== "robar" && s.fase !== "jugar") return;
    const J = s.jug[s.turno]; if (!J.cpu) return;
    const mov = s.mov, a = Burako.decidir(s);
    Burako.act(s, J.id, a);
    // Si por algún motivo la jugada no valió, tira la ficha menos útil para no trabarse
    if (s.mov === mov && s.fase === "jugar") { for (const t of J.mano) { Burako.act(s, J.id, { t: "tirar", id: t }); if (s.mov !== mov) break; } }
  },

  resultado(s, pid) {
    if (s.fase !== "fin") return null;
    const i = s.jug.findIndex(j => j.id === pid); if (i < 0) return null;
    const q = Burako.equipo(s, i);
    return { juego: "burako", id: s.id, gano: s.ganador === q, vsCompu: s.jug.every((j, k) => Burako.equipo(s, k) === q || j.cpu), n: s.n, limpias: s.st.limpias[q], cierres: s.st.cierres[q] };
  },
  view(s, pid) {
    const yo = s.jug.findIndex(j => j.id === pid);
    return {
      game: "burako", id: s.id, me: pid, yo, n: s.n, fase: s.fase, turno: s.turno, pts: s.pts, meta: s.cfg.meta, ronda: s.ronda, mov: s.mov,
      jug: s.jug.map((j, i) => ({ name: j.name, cpu: !!j.cpu, n: j.mano.length, eq: Burako.equipo(s, i) })),
      mano: yo >= 0 ? s.jug[yo].mano : [], mesa: s.mesa, top: s.descarte.slice(-1)[0] || null, descarte: s.descarte.length, mazo: s.mazo.length,
      muertoTomado: s.muertoTomado, res: s.res, ganador: s.ganador, log: s.log, aviso: s.aviso
    };
  },

  /* ---------- Dibujo ---------- */
  ficha(t, cls = "", attrs = "") {
    if (Burako.esJoker(t)) return `<span class="bk-f joker ${cls}" ${attrs}><b>★</b></span>`;
    const n = Burako.num(t), c = BK.COLORES[t[0]];
    return `<span class="bk-f ${n === 2 ? "dos" : ""} ${cls}" style="--fc:${c[1]}" ${attrs} aria-label="${n} ${c[0]}"><b>${n}</b><i></i></span>`;
  },
  render(v, send, opts) {
    const yo = v.yo >= 0 ? v.yo : 0, miEq = v.yo >= 0 ? v.jug[yo].eq : 0, U = UI.bk = UI.bk && UI.bk.id === v.id ? UI.bk : { id: v.id, sel: [], orden: "color" };
    U.sel = U.sel.filter(t => v.mano.includes(t));
    const miTurno = v.yo >= 0 && v.turno === v.yo && (v.fase === "robar" || v.fase === "jugar") && !v.jug[yo].cpu, jugando = miTurno && v.fase === "jugar";
    const nom = j => esc(j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name);
    const eqNom = q => v.n === 2 ? (q === miEq && v.yo >= 0 ? "Vos" : nom(v.jug.find(j => j.eq === q))) : q === miEq ? "Nosotros" : "Ellos";
    const marcador = `<div class="bk-marcador">${[miEq, 1 - miEq].map(q => `<div class="bk-eq ${q === miEq ? "nos" : "ellos"}"><b>${eqNom(q)}</b><span class="bk-pts">${v.pts[q]}</span>
      <small>${v.muertoTomado[q] ? "✅ muerto tomado" : "🃏 muerto sin tomar"} · ${v.mesa[q].filter(j => j.canasta).length} canasta${v.mesa[q].filter(j => j.canasta).length === 1 ? "" : "s"}</small></div>`).join("")}</div>`;
    const rivales = `<div class="bk-rivales">${v.jug.map((j, i) => i === v.yo ? "" : `<div class="bk-riv ${i === v.turno && v.fase !== "fin" && v.fase !== "finMano" ? "turno" : ""} ${j.eq === miEq ? "nos" : "ellos"}">${j.cpu ? `<span class="cpu-ic">🤖</span>` : avatar(j.name, 28)}<b>${nom(j)}</b><span>${j.n} ficha${j.n === 1 ? "" : "s"}</span></div>`).join("")}</div>`;
    // Para agregar: qué juegos propios aceptan la selección
    const acepta = k => jugando && U.sel.length && !!Burako.analizar([...v.mesa[miEq][k].fichas, ...U.sel]);
    const juegos = q => v.mesa[q].length ? v.mesa[q].map((j, k) => {
      const ok = q === miEq && acepta(k);
      return `<button class="bk-juego ${j.canasta ? (j.limpia ? "canasta limpia" : "canasta sucia") : ""} ${ok ? "acepta" : ""}" ${q === miEq && jugando ? `data-agregar="${k}"` : "disabled"}>
        ${j.fichas.map(f => Burako.ficha(f, "mini")).join("")}${j.canasta ? `<em>${j.limpia ? "Limpia" : "Sucia"}</em>` : ""}${ok ? `<strong>＋</strong>` : ""}</button>`;
    }).join("") : `<p class="empty">${q === miEq ? "Todavía no bajaron juegos." : "Nada en la mesa."}</p>`;
    const mesa = `<div class="bk-mesa" data-k="${v.mov}">
      <div class="bk-lado"><span class="label">${eqNom(1 - miEq)}</span><div class="bk-juegos">${juegos(1 - miEq)}</div></div>
      <div class="bk-centro">
        <button class="bk-pila mazo" id="bkMazo" ${miTurno && v.fase === "robar" && v.mazo ? "" : "disabled"}><span class="bk-f dorso"></span><small>Mazo · ${v.mazo}</small></button>
        <button class="bk-pila desc" id="bkDesc" ${miTurno && v.fase === "robar" && v.descarte ? "" : "disabled"}>${v.top ? Burako.ficha(v.top) : `<span class="bk-f vacio"></span>`}<small>${v.descarte ? `Pozo · ${v.descarte}` : "Pozo vacío"}</small></button>
      </div>
      <div class="bk-lado nuestro"><span class="label">${eqNom(miEq)}${jugando && U.sel.length ? " · tocá un juego para agregar" : ""}</span><div class="bk-juegos">${juegos(miEq)}</div></div>
    </div>`;

    let estado = "", botones = "", cartel = "";
    if (v.fase === "finMano" || v.fase === "fin") {
      const r = v.res, fila = (t, k) => `<tr><td>${t}</td>${[miEq, 1 - miEq].map(q => `<td class="${r.cuenta[q][k] < 0 ? "neg" : ""}">${r.cuenta[q][k] > 0 && k !== "total" ? "+" : ""}${r.cuenta[q][k]}</td>`).join("")}</tr>`;
      cartel = `${v.fase === "fin" ? `<div class="verdict ${v.ganador === miEq && v.yo >= 0 ? "good" : "bad"}"><div class="big">${v.yo < 0 ? `Ganó ${esc(eqNom(v.ganador))}` : v.ganador === miEq ? "¡Ganaron!" : "Perdieron"}</div><div class="note">${v.pts[miEq]} a ${v.pts[1 - miEq]}</div></div>` : `<div class="verdict"><div class="big">${r.cerro != null ? `Cerró ${esc(eqNom(r.cerro))}` : "Se terminó el mazo"}</div><div class="note">Mano ${v.ronda}${v.meta ? ` · se juega a ${v.meta}` : ""}</div></div>`}
        <table class="bk-cuenta"><tr><th></th><th>${eqNom(miEq)}</th><th>${eqNom(1 - miEq)}</th></tr>${fila("Fichas bajadas", "mesa")}${fila("Canastas", "canastas")}${fila("Cierre", "cierre")}${fila("En la mano", "mano")}${fila("Muerto", "muerto")}${fila("<b>Total de la mano</b>", "total")}</table>
        ${opts.local || opts.isHost ? `<div class="row">${v.fase === "fin" ? `<button class="btn" id="bkOtra">Otra partida</button><button class="btn ghost" id="bkSalir">${opts.local ? "Inicio" : "Volver a la sala"}</button>` : `<button class="btn" id="bkSig">Siguiente mano</button>`}</div>` : `<p class="sub center">El anfitrión reparte la siguiente.</p>`}`;
    } else {
      const sel = U.sel, jg = sel.length >= 3 ? Burako.analizar(sel) : null;
      estado = !miTurno ? (v.jug[v.turno].cpu ? `🤖 ${nom(v.jug[v.turno])} está jugando…` : `Turno de <b>${nom(v.jug[v.turno])}</b>.`)
        : v.fase === "robar" ? "🀄 <b>Tu turno:</b> robá del mazo o levantá todo el pozo."
        : sel.length === 0 ? "Elegí fichas para bajar un juego, tocá un juego tuyo para agregar, o elegí una para tirar."
        : jg ? `✅ ${jg.tipo === "esc" ? "Escalera" : "Pierna"} de ${jg.orden.length}${jg.orden.length >= 7 ? " · ¡canasta!" : ""}` : sel.length === 1 ? "Tirala o agregala a un juego tuyo." : sel.length < 3 ? "Un juego necesita 3 fichas o más." : "Esas fichas no forman un juego.";
      botones = `<div class="bk-botones ${jugando ? "" : "oculta"}" ${jugando ? "" : `aria-hidden="true"`}><button class="btn" id="bkBajar" ${jg ? "" : "disabled"}>⬇️ Bajar</button><button class="btn danger" id="bkTirar" ${sel.length === 1 ? "" : "disabled"}>Tirar</button><button class="btn ghost chico" id="bkLimpiar" ${sel.length ? "" : "disabled"}>✕</button></div>`;
    }
    const mano = v.yo >= 0 && v.fase !== "fin" ? `<div class="panel bk-mano-panel"><div class="headrow"><span class="label">Tu mano · ${v.mano.length} fichas</span><button class="linkish" id="bkOrden">Ordenar por ${U.orden === "color" ? "número" : "color"}</button></div>
      <div class="bk-mano">${Burako.ordenar(v.mano, U.orden).map(t => Burako.ficha(t, `${jugando ? "toca" : ""} ${U.sel.includes(t) ? "sel" : ""}`, jugando ? `data-f="${t}" role="button" tabindex="0"` : "")).join("")}</div></div>` : "";
    const aviso = v.aviso && v.aviso.k >= v.mov - 1 ? `<div class="bk-aviso ${v.aviso.eq === miEq ? "nos" : "ellos"}" data-k="${v.aviso.k}">${esc(v.aviso.txt)}</div>` : "";
    app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen burako">
      ${marcador}${rivales}${aviso}${mesa}
      ${estado ? `<p class="aj-estado bk-estado">${estado}${v.log.length && !miTurno ? ` <small>${esc(v.log[v.log.length - 1])}.</small>` : ""}</p>` : ""}
      ${cartel}${botones}${mano}
      <details class="panel"><summary class="label">Reglas rápidas</summary><p class="summary">Robás del mazo o levantás todo el pozo (las fichas tiradas); bajás juegos y tirás una ficha. <b>Escalera</b>: 3 o más seguidas del mismo color (el 1 va antes del 2 o después del 13). <b>Pierna</b>: 3 o más del mismo número. Un comodín por juego (★ y los 2). Con 7 fichas es <b>canasta</b>: limpia 200, sucia 100. Al quedarte sin fichas tomás el muerto. Para cerrar hay que haber tomado el muerto y tener una canasta: cerrar suma 100. Fichas: ★ 50, 2 → 20, 1 → 15, del 8 al 13 → 10, del 3 al 7 → 5. Lo de la mano resta.</p></details>
    </section>`;
    on("bkMazo", () => send({ t: "robar", de: "mazo" }));
    on("bkDesc", () => send({ t: "robar", de: "descarte" }));
    app.querySelectorAll("[data-f]").forEach(el => {
      const f = () => { const t = el.dataset.f; U.sel = U.sel.includes(t) ? U.sel.filter(x => x !== t) : [...U.sel, t]; if (typeof Sonido !== "undefined") Sonido.sfx("tap"); render(); };
      el.onclick = f; el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } };
    });
    app.querySelectorAll("[data-agregar]").forEach(b => b.onclick = () => {
      if (!U.sel.length) return;
      if (!acepta(+b.dataset.agregar)) return Toast.mostrar(`<div class="t-ic">🀄</div><div class="t-txt"><b>No entran en ese juego</b><span>Elegí fichas que sigan la escalera o del mismo número.</span></div>`, "info");
      const ids = U.sel; U.sel = []; send({ t: "agregar", ids, k: +b.dataset.agregar });
    });
    on("bkBajar", () => { const ids = U.sel; U.sel = []; send({ t: "bajar", ids }); });
    on("bkTirar", () => { const id = U.sel[0]; U.sel = []; send({ t: "tirar", id }); });
    on("bkLimpiar", () => { U.sel = []; render(); });
    on("bkOrden", () => { U.orden = U.orden === "color" ? "num" : "color"; render(); });
    on("bkSig", () => send({ t: "siguiente" }));
    on("bkOtra", () => send({ t: "again" }));
    on("bkSalir", () => opts.local ? go("home") : send({ t: "lobby" }));
  },

  /* Si una jugada no vale, el motor la ignora: le avisamos a la persona por qué */
  explicar(s, i, a, antes) {
    if (s.mov !== antes || s.jug[i].cpu) return;
    const J = s.jug[i], q = Burako.equipo(s, i);
    let txt = "Esa jugada no vale.";
    if (a.t === "tirar" && J.mano.length === 1) txt = s.muertoTomado[q] ? "Para cerrar necesitás al menos una canasta." : "No podés quedarte sin fichas así.";
    else if (a.t === "bajar" || a.t === "agregar") txt = "Así te quedarías sin poder tirar: para cerrar hace falta el muerto tomado y una canasta.";
    Toast.mostrar(`<div class="t-ic">🀄</div><div class="t-txt"><b>No se puede</b><span>${esc(txt)}</span></div>`, "info");
  },

  /* ---------- Un teléfono ---------- */
  asientos(personas, total, juntos) {
    const orden = juntos ? [0, 2, 1, 3].filter(x => x < total) : [...Array(total).keys()];
    const sillas = Array(total).fill(null);
    personas.slice(0, total).forEach((p, k) => sillas[orden[k]] = p);
    let c = 0;
    return sillas.map((p, i) => p || { id: "c" + i, name: BK.CPU[c++ % BK.CPU.length], cpu: true });
  },
  empezarLocal(jug) { S.bk = Burako.setup(jug, S.bkCfg); UI.bk = null; UI.bkVisto = null; UI.bkPens = null; go("burako"); },
  empezarOn(R) {
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name }));
    if (jug.length > 4) return "El burako es de 2 o 4 jugadores.";
    const total = jug.length > 2 || S.bkCfg.n === 4 ? 4 : 2;
    R.bk = Burako.setup(Burako.asientos(jug, total, S.bkCfg.juntos), S.bkCfg);
    R.game = "burako";
    Burako.programarHost(R);
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") R.bk = Burako.setup(R.bk.jug.map(j => ({ id: j.id, name: j.name, cpu: j.cpu })), R.bk.cfg);
    else if (a.t === "lobby" && pid === "H") { R.game = null; R.bk = null; return; }
    else if (a.t === "siguiente") { if (pid === "H") Burako.act(R.bk, pid, a); }
    else Burako.act(R.bk, pid, a);
    Burako.programarHost(R);
  },
  timer: null,
  programarHost(R) {
    const s = R.bk;
    if (!s || (s.fase !== "robar" && s.fase !== "jugar") || !s.jug[s.turno].cpu || Burako.timer === s.id + s.mov) return;
    Burako.timer = s.id + s.mov;
    setTimeout(() => {
      if (R.bk !== s || R.game !== "burako" || Burako.timer !== s.id + s.mov) return;
      Burako.jugarCompu(s); Burako.timer = null;
      Net.broadcast(); Burako.programarHost(R);
    }, 750 + Math.random() * 400);
  }
};

PANTALLAS.burako = () => {
  const s = S.bk;
  if (!s) return go("home");
  const humanos = s.jug.map((j, i) => j.cpu ? -1 : i).filter(i => i >= 0);
  const enJuego = s.fase === "robar" || s.fase === "jugar", act = enJuego ? s.turno : -1;
  if (humanos.length > 1 && act >= 0 && !s.jug[act].cpu && UI.bkVisto !== act) {
    app.innerHTML = `${head(0)}<section class="stage passto"><p class="sub">${esc(s.log[s.log.length - 1] || `Mano ${s.ronda}`)}</p>
      <div class="pass-art">${personaje(colorDe(s.jug[act].name), "duda", 110)}</div>
      <p class="label" style="margin:0">Pásale el teléfono a</p><div class="who">${esc(s.jug[act].name)}</div>
      <button class="btn" id="bkSoy">Soy ${esc(s.jug[act].name)}, ver mis fichas</button></section>`;
    on("bkSoy", () => { UI.bkVisto = act; render(); });
    return;
  }
  const yo = humanos.length === 1 ? humanos[0] : act >= 0 && !s.jug[act].cpu ? act : UI.bkVisto ?? humanos[0];
  Burako.render(Burako.view(s, s.jug[yo].id), a => {
    if (a.t === "again") return Burako.empezarLocal(s.jug.map(j => ({ id: j.id, name: j.name, cpu: j.cpu })));
    const antes = s.mov;
    Burako.act(s, s.jug[yo].id, a);
    if (a.t !== "siguiente") Burako.explicar(s, yo, a, antes);
    render();
  }, { local: true });
  if (act >= 0 && s.jug[act].cpu && UI.bkPens !== s.id + s.mov) {
    const k = UI.bkPens = s.id + s.mov;
    setTimeout(() => { if (S.screen !== "burako" || S.bk !== s || UI.bkPens !== k) return; Burako.jugarCompu(s); render(); }, 700 + Math.random() * 400);
  }
};
