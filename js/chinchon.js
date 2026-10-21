/* Chinchón con baraja española de 48 cartas (con 8 y 9) o de 40, y 2 comodines opcionales.
   - 7 cartas por jugador. En tu turno robas (del mazo o del descarte) y tiras una.
   - Juegos: escaleras (3+ del mismo palo seguidas; en la de 40 el 7 va con la sota) y grupos (3 o 4 del mismo número).
   - Puedes cortar si lo que te queda suelto suma 5 o menos. Todo ligado: −10. Escalera de 7 del mismo palo: ¡chinchón!, ganas la partida.
   - Al cortar, cada uno suma sus puntos sueltos. Quien pasa de 100 queda afuera. Gana el último que queda. */
const PALOS = { O: ["Oros", "🪙", "#c99400"], C: ["Copas", "🍷", "#c92a2a"], E: ["Espadas", "🗡️", "#1c6fd1"], B: ["Bastos", "🪵", "#2f8a3e"] };
const ORDEN_CH = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];            // baraja de 40: el 7 sigue con la sota
const ORDEN_48 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];       // baraja de 48: con 8 y 9
const FIGURA = { 10: "Sota", 11: "Caballo", 12: "Rey" };

const Chin = {
  palo: c => c[0], num: c => c[0] === "J" ? 0 : +c.slice(1),
  orden: ORDEN_CH,
  usar(cfg) { Chin.orden = cfg && cfg.con89 ? ORDEN_48 : ORDEN_CH; },
  pos: c => Chin.orden.indexOf(+c.slice(1)),
  esJ: c => c[0] === "J",
  puntos: c => c[0] === "J" ? 25 : Math.min(10, +c.slice(1)),

  mazo(comodines) {
    const m = [];
    for (const p of "OCEB") for (const n of Chin.orden) m.push(p + n);
    if (comodines) m.push("J1", "J2");
    return shuffle(m);
  },

  valido(cs) {
    if (cs.length < 3) return false;
    const js = cs.filter(Chin.esJ).length, nat = cs.filter(c => !Chin.esJ(c));
    if (js > 1 || nat.length < 2) return false;
    // Grupo
    if (cs.length <= 4 && nat.every(c => Chin.num(c) === Chin.num(nat[0]))) return true;
    // Escalera
    if (!nat.every(c => Chin.palo(c) === Chin.palo(nat[0]))) return false;
    const ps = nat.map(Chin.pos).sort((a, b) => a - b);
    if (new Set(ps).size !== ps.length) return false;
    const huecos = ps[ps.length - 1] - ps[0] + 1 - ps.length;
    return huecos <= js && cs.length <= Chin.orden.length;
  },

  /* Mejor forma de ligar una mano: devuelve { resto, juegos: [[cartas]], libres: [cartas] } */
  analizar(mano) {
    const n = mano.length, juegos = [];
    for (let m = 1; m < 1 << n; m++) {
      let k = 0; for (let x = m; x; x &= x - 1) k++;
      if (k >= 3 && Chin.valido(mano.filter((_, i) => m >> i & 1))) juegos.push(m);
    }
    const memo = new Map();
    const mejor = usado => {
      if (usado === (1 << n) - 1) return { resto: 0, elegidos: [] };
      if (memo.has(usado)) return memo.get(usado);
      let i = 0; while (usado >> i & 1) i++;
      const sin = mejor(usado | 1 << i);
      let res = { resto: sin.resto + Chin.puntos(mano[i]), elegidos: sin.elegidos };
      for (const j of juegos) if ((j >> i & 1) && !(j & usado)) {
        const r = mejor(usado | j);
        if (r.resto < res.resto) res = { resto: r.resto, elegidos: [j, ...r.elegidos] };
      }
      memo.set(usado, res);
      return res;
    };
    const r = mejor(0);
    const enJuego = r.elegidos.reduce((a, j) => a | j, 0);
    return {
      resto: r.resto,
      juegos: r.elegidos.map(j => Chin.ordenar(mano.filter((_, i) => j >> i & 1))),
      libres: mano.filter((_, i) => !(enJuego >> i & 1)).sort((a, b) => Chin.puntos(a) - Chin.puntos(b))
    };
  },
  ordenar: cs => cs.slice().sort((a, b) => Chin.esJ(a) - Chin.esJ(b) || Chin.pos(a) - Chin.pos(b) || "OCEB".indexOf(a[0]) - "OCEB".indexOf(b[0])),
  esChinchon(mano7) { return mano7.length === 7 && !mano7.some(Chin.esJ) && Chin.valido(mano7) && new Set(mano7.map(Chin.palo)).size === 1; },

  /* ---------- Partida ---------- */
  setup(jug, cfg) {
    const s = {
      id: "chi-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      jug: jug.map(j => ({ ...j, mano: [], pts: 0, fuera: false, cortes: 0, menos10: 0 })),
      cfg: { comodines: !!cfg.comodines, con89: !!cfg.con89, limite: 100 }, ronda: 0, mano: Math.floor(Math.random() * jug.length),
      mazo: [], descarte: [], turno: 0, fase: "robar", cierre: null, ganador: null, chinchon: null, log: ""
    };
    Chin.nuevaRonda(s);
    return s;
  },
  activos: s => s.jug.map((j, i) => j.fuera ? -1 : i).filter(i => i >= 0),
  sig(s, i) { const n = s.jug.length; for (let k = 1; k <= n; k++) { const x = (i + k) % n; if (!s.jug[x].fuera) return x; } return i; },

  nuevaRonda(s) {
    s.tomadas = {};
    Chin.usar(s.cfg);
    s.ronda++;
    s.mano = Chin.sig(s, s.mano);
    s.mazo = Chin.mazo(s.cfg.comodines);
    s.jug.forEach(j => j.mano = []);
    for (let k = 0; k < 7; k++) Chin.activos(s).forEach(i => s.jug[i].mano.push(s.mazo.pop()));
    s.descarte = [s.mazo.pop()];
    s.turno = Chin.sig(s, s.mano);
    s.fase = "robar"; s.cierre = null; s.log = ""; s.vueltas = 0;
  },

  act(s, pid, a) {
    Chin.usar(s.cfg);
    const i = pid === null ? s.turno : s.jug.findIndex(j => j.id === pid);
    const J = s.jug[i];
    if (a.t === "siguiente") { if (s.fase === "ronda" && (pid === null || pid === "H")) Chin.nuevaRonda(s); return; }
    if (!J || i !== s.turno || J.fuera) return;
    if (a.t === "robar" && s.fase === "robar") {
      if (a.de === "descarte" && s.descarte.length) { const c = s.descarte.pop(); J.mano.push(c); s.nueva = { i, c, de: "descarte" }; s.log = `${J.name} tomó del descarte`; (s.tomadas = s.tomadas || {})[i] = [...(s.tomadas[i] || []), c].slice(-6); }
      else {
        if (!s.mazo.length) {
          // Se acabó el mazo: se mezcla el descarte. Si ya pasó dos veces (o no alcanza), la ronda se anula.
          if (s.descarte.length <= 1 || s.vueltas >= 2) { s.fase = "ronda"; s.cierre = { anulada: true, manos: s.jug.map(j => j.fuera ? null : { ...Chin.analizar(j.mano), suma: 0, mano: j.mano }) }; return; }
          const top = s.descarte.pop(); s.mazo = shuffle(s.descarte); s.descarte = [top]; s.vueltas++;
        }
        const c = s.mazo.pop(); J.mano.push(c); s.nueva = { i, c, de: "mazo" }; s.log = `${J.name} robó del mazo`;
      }
      s.fase = "tirar";
    } else if (a.t === "tirar" && s.fase === "tirar" && J.mano.includes(a.c)) {
      const resto = J.mano.filter(c => c !== a.c);
      if (a.cortar) {
        const an = Chin.analizar(resto);
        if (an.resto > 5 && !Chin.esChinchon(resto)) return;
        J.mano = resto;
        Chin.cerrar(s, i);
      } else {
        J.mano = resto; s.descarte.push(a.c);
        s.turno = Chin.sig(s, i); s.fase = "robar";
      }
    }
  },

  cerrar(s, quien) {
    const C = s.jug[quien];
    if (Chin.esChinchon(C.mano)) {
      s.chinchon = quien; s.ganador = quien; s.fase = "fin";
      s.cierre = { por: quien, chinchon: true, manos: s.jug.map(j => ({ ...Chin.analizar(j.mano), suma: 0, mano: j.mano })) };
      return;
    }
    const manos = s.jug.map((j, i) => {
      if (j.fuera) return null;
      const an = Chin.analizar(j.mano);
      const suma = i === quien ? (an.resto === 0 ? -10 : an.resto) : an.resto;
      return { ...an, suma, mano: j.mano };
    });
    C.cortes++; if (manos[quien].suma === -10) C.menos10++;
    manos.forEach((m, i) => { if (m) { s.jug[i].pts += m.suma; if (s.jug[i].pts > s.cfg.limite) s.jug[i].fuera = true; } });
    s.cierre = { por: quien, menos10: manos[quien].suma === -10, manos };
    const quedan = Chin.activos(s);
    if (quedan.length <= 1) {
      s.fase = "fin";
      s.ganador = quedan.length ? quedan[0] : s.jug.reduce((b, j, i) => j.pts < s.jug[b].pts ? i : b, 0);
    } else s.fase = "ronda";
  },

  /* ---------- Compu ---------- */
  jugarCompu(s) {
    Chin.usar(s.cfg);
    const i = s.turno, J = s.jug[i];
    if (s.fase === "robar") {
      const top = s.descarte[s.descarte.length - 1];
      const actual = Chin.analizar(J.mano).resto;
      const conTop = top ? Math.min(...J.mano.map((_, k) => Chin.analizar([...J.mano.filter((__, x) => x !== k), top]).resto)) : 99;
      Chin.act(s, J.id, { t: "robar", de: top && (Chin.esJ(top) || conTop < actual - 1) ? "descarte" : "mazo" });
    } else if (s.fase === "tirar") {
      // h: habilidad. Los buenos no le tiran al de al lado lo que viene juntando (se acuerdan de lo que levantó del descarte)
      const h = typeof Mente !== "undefined" ? Mente.habilidad("chinchon", J.nivel) : 0.5;
      const sig = Chin.sig(s, i), junta = (s.tomadas || {})[sig] || [];
      const leSirve = c => junta.some(t => !Chin.esJ(t) && (Chin.num(t) === Chin.num(c) || Chin.palo(t) === Chin.palo(c) && Math.abs(Chin.num(t) - Chin.num(c)) <= 2));
      const opciones = [];
      for (const c of J.mano) {
        const resto = J.mano.filter(x => x !== c);
        const an = Chin.analizar(resto);
        const v = an.resto * 100 - Chin.puntos(c) + (Chin.esJ(c) ? 5000 : 0) + (leSirve(c) ? 150 * h : 0);
        opciones.push({ c, v, resto: an.resto, chin: Chin.esChinchon(resto) });
      }
      opciones.sort((a, b) => a.v - b.v);
      // Los flojos a veces se equivocan y tiran la segunda mejor
      let mejor = opciones[0];
      if (opciones[1] && !mejor.chin && Math.random() < 0.3 * (1 - h) && opciones[1].v < 5000) mejor = opciones[1];
      // Cortar: los buenos cortan antes si el rival está por cerrar (le quedan pocas cartas sueltas por lo que levantó)
      const apurado = h > 0.6 && junta.length >= 2;
      const cortar = mejor.chin || mejor.resto <= (h < 0.3 ? 5 : apurado ? 5 : h > 0.75 ? 2 : 3) || mejor.resto <= 5 && Math.random() < 0.15 * h;
      Chin.act(s, J.id, { t: "tirar", c: mejor.c, cortar });
    }
  },

  resultado(s, pid) {
    if (s.fase !== "fin") return null;
    const i = s.jug.findIndex(j => j.id === pid); if (i < 0) return null;
    const J = s.jug[i];
    return { juego: "chinchon", id: s.id, gano: s.ganador === i, chinchon: s.chinchon === i, cortes: J.cortes, menos10: J.menos10, rivales: s.jug.length - 1 };
  },

  view(s, pid, local) {
    const i = local != null ? local : s.jug.findIndex(j => j.id === pid);
    return {
      game: "chinchon", me: pid, yo: i, fase: s.fase, turno: s.turno, ronda: s.ronda, log: s.log, cfg: s.cfg,
      jug: s.jug.map(j => ({ name: j.name, cpu: !!j.cpu, pts: j.pts, fuera: j.fuera, n: j.mano.length })),
      mano: i >= 0 ? s.jug[i].mano : [], nueva: i >= 0 && s.nueva && s.nueva.i === i && s.turno === i && s.fase === "tirar" ? s.nueva : null, top: s.descarte[s.descarte.length - 1] || null, mazo: s.mazo.length,
      cierre: s.cierre, ganador: s.ganador, chinchon: s.chinchon
    };
  },

  carta(c, opts = {}) {
    if (!c) return `<span class="ce dorso ${opts.cls || ""}"></span>`;
    if (Chin.esJ(c)) return `<span class="ce comodin ${opts.cls || ""}" ${opts.attrs || ""}><b>★</b><small>Comodín</small></span>`;
    const [nombre, ic, col] = PALOS[c[0]], n = Chin.num(c);
    return `<span class="ce ${opts.cls || ""}" style="--pc:${col}" ${opts.attrs || ""} aria-label="${FIGURA[n] || n} de ${nombre}"><b>${n}</b><span class="ce-ic">${ic}</span><small>${FIGURA[n] || nombre}</small></span>`;
  },

  render(v, send, opts) {
    Chin.usar(v.cfg);
    const yo = v.yo, jefe = opts.local || opts.isHost;
    const miTurno = yo === v.turno && (v.fase === "robar" || v.fase === "tirar") && !v.jug[yo]?.cpu;
    const marcador = `<div class="ch-marcador">${v.jug.map((j, k) => `<div class="ch-j ${k === v.turno && v.fase !== "ronda" && v.fase !== "fin" ? "turno" : ""} ${j.fuera ? "fuera" : ""}">${j.cpu ? `<span class="cpu-ic">🤖</span>` : avatar(j.name, 30)}<b>${esc(j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name)}${k === yo && !opts.local ? " (tú)" : ""}</b><span>${j.fuera ? "Afuera" : `${j.pts} pts`}</span></div>`).join("")}</div>`;
    let body;
    if (v.fase === "ronda" || v.fase === "fin") {
      const c = v.cierre;
      const quien = c ? v.jug[c.por].name : "";
      body = `${marcador}
        ${v.fase === "fin" ? `<div class="verdict good"><div class="big">${v.chinchon != null ? "¡CHINCHÓN!" : "Fin de la partida"}</div><div class="note">Gana <b>${esc(v.jug[v.ganador].name)}</b>${v.chinchon != null ? " con una escalera de siete" : ""}.</div></div>`
          : c.anulada ? `<div class="verdict"><div class="big">Ronda anulada</div><div class="note">Se acabó el mazo y nadie cortó. Nadie suma puntos.</div></div>`
          : `<div class="verdict"><div class="big">${esc(quien)} cortó${c.menos10 ? " con −10" : ""}</div><div class="note">Ronda ${v.ronda}. Así quedaron las manos:</div></div>`}
        ${c ? `<div class="ch-cierre">${c.manos.map((m, k) => m ? `<div class="panel"><div class="headrow"><b>${esc(v.jug[k].name)}</b><span class="${m.suma > 0 ? "warn" : "ok"}">${m.suma > 0 ? "+" : ""}${m.suma}</span></div>
          <div class="ch-mano chica">${m.juegos.map(g => `<span class="ch-juego">${g.map(x => Chin.carta(x)).join("")}</span>`).join("")}${m.libres.map(x => Chin.carta(x, { cls: "suelta" })).join("")}</div></div>` : "").join("")}</div>` : ""}
        ${v.fase === "ronda" ? (jefe ? `<button class="btn" id="chSig">Siguiente ronda</button>` : `<p class="sub center">El anfitrión reparte la siguiente ronda.</p>`)
          : jefe ? `<div class="row"><button class="btn" id="chOtra">Otra partida</button><button class="btn ghost" id="chSalir">${opts.local ? "Inicio" : "Volver a la sala"}</button></div>` : ""}`;
    } else {
      const an = Chin.analizar(v.mano);
      const sel = UI.chSel && v.mano.includes(UI.chSel) ? UI.chSel : null;
      const nueva = miTurno && v.nueva && v.mano.includes(v.nueva.c) ? v.nueva.c : null, esNueva = c => c === nueva ? "nueva" : "";
      let corte = null;
      if (miTurno && v.fase === "tirar" && sel) {
        const resto = v.mano.filter(c => c !== sel), a2 = Chin.analizar(resto);
        corte = Chin.esChinchon(resto) ? { txt: "¡Chinchón!", ok: true } : a2.resto <= 5 ? { txt: a2.resto === 0 ? "Cortar con −10" : `Cortar (sumas ${a2.resto})`, ok: true } : { txt: `Para cortar te quedarían ${a2.resto}`, ok: false };
      }
      const turnoJ = v.jug[v.turno];
      body = `${marcador}
        <div class="ch-mesa" data-k="${v.mazo}-${v.top}">
          <div class="ch-pila"><span class="label">Mazo · ${v.mazo}</span>${miTurno && v.fase === "robar" ? `<button class="ch-btn" id="chMazo">${Chin.carta(null)}</button>` : Chin.carta(null)}</div>
          <div class="ch-pila"><span class="label">Descarte</span>${miTurno && v.fase === "robar" && v.top ? `<button class="ch-btn" id="chDesc">${Chin.carta(v.top)}</button>` : Chin.carta(v.top)}</div>
        </div>
        <p class="aj-estado">${miTurno ? (v.fase === "robar" ? "🎴 <b>Tu turno:</b> roba del mazo o toma la carta del descarte." : `${nueva ? `${v.nueva.de === "mazo" ? "Robaste" : "Tomaste"} ${Chin.carta(nueva, { cls: "mini" })} (brilla en tu mano). ` : ""}Elige una carta para <b>tirar</b> (o para cortar).`) : turnoJ.cpu ? `🤖 ${esc(turnoJ.name)} está jugando…` : `Turno de <b>${esc(turnoJ.name)}</b>.`}${v.log ? ` <small>${esc(v.log)}.</small>` : ""}</p>
        ${yo >= 0 ? `<div class="panel ch-panel"><div class="headrow"><span class="label">Tu mano</span><span class="label">Sueltas: ${an.resto} pts</span></div>
          <div class="ch-mano">${an.juegos.map(g => `<span class="ch-juego">${g.map(c => Chin.carta(c, { cls: `${miTurno && v.fase === "tirar" ? "toca" : ""} ${sel === c ? "sel" : ""} ${esNueva(c)}`, attrs: miTurno && v.fase === "tirar" ? `data-ch="${c}" role="button" tabindex="0"` : "" })).join("")}</span>`).join("")}${an.libres.map(c => Chin.carta(c, { cls: `suelta ${miTurno && v.fase === "tirar" ? "toca" : ""} ${sel === c ? "sel" : ""} ${esNueva(c)}`, attrs: miTurno && v.fase === "tirar" ? `data-ch="${c}" role="button" tabindex="0"` : "" })).join("")}</div>
          ${miTurno && v.fase === "tirar" ? `<div class="row"><button class="btn" id="chTirar" ${sel ? "" : "disabled"}>Tirar</button><button class="btn ${corte && corte.ok ? "danger" : "ghost"}" id="chCortar" ${corte && corte.ok ? "" : "disabled"}>${corte ? corte.txt : "Cortar"}</button></div>` : ""}
        </div>` : ""}
        <details class="panel"><summary class="label">Reglas rápidas</summary><p class="summary">Escaleras: 3 o más del mismo palo seguidas (${v.cfg && v.cfg.con89 ? "baraja de 48: 7, 8, 9 y la sota" : "baraja de 40: no hay 8 ni 9, el 7 sigue con la sota"}). Grupos: 3 o 4 del mismo número. Un comodín por juego. Puedes cortar si lo suelto suma 5 o menos; con todo ligado restas 10. Una escalera de 7 del mismo palo es <b>chinchón</b> y gana la partida. Quien pasa de 100 queda afuera.</p></details>`;
    }
    app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen chinchon">${body}</section>`;
    on("chMazo", () => send({ t: "robar", de: "mazo" }));
    on("chDesc", () => send({ t: "robar", de: "descarte" }));
    app.querySelectorAll("[data-ch]").forEach(el => {
      const f = () => { UI.chSel = UI.chSel === el.dataset.ch ? null : el.dataset.ch; render(); };
      el.onclick = f; el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } };
    });
    on("chTirar", () => { const c = UI.chSel; UI.chSel = null; send({ t: "tirar", c }); });
    on("chCortar", () => { const c = UI.chSel; UI.chSel = null; send({ t: "tirar", c, cortar: true }); });
    on("chSig", () => send({ t: "siguiente" }));
    on("chOtra", () => send({ t: "again" }));
    on("chSalir", () => opts.local ? go("home") : send({ t: "lobby" }));
  },

  /* ---------- Un teléfono ---------- */
  empezarLocal(jug) {
    S.chi = Chin.setup(jug, S.chCfg);
    Object.assign(UI, { chSel: null, chGate: null, chPens: null });
    go("chinchon");
  },
  empezarOn(R) {
    const jug = R.players.filter(p => p.on);
    const cpus = Math.max(jug.length < 2 ? 1 : 0, Math.min(S.chCfg.cpus | 0, 5 - jug.length));
    if (jug.length + cpus < 2) return "Hacen falta al menos 2 jugadores.";
    if (jug.length > 5) return "El chinchón es de 2 a 5 jugadores.";
    R.chi = Chin.setup([...jug.map(p => ({ id: p.id, name: p.name })), ...CPU_NOMBRES.concat(["🤖 Cacho"]).slice(0, cpus).map((name, i) => ({ id: "c" + i, name, cpu: true }))], S.chCfg);
    R.game = "chinchon"; Chin.programarHost(R);
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") { R.chi = Chin.setup(R.chi.jug.map(j => ({ id: j.id, name: j.name, cpu: j.cpu })), R.chi.cfg); Chin.programarHost(R); return; }
    if (a.t === "lobby" && pid === "H") { R.game = null; R.chi = null; return; }
    Chin.act(R.chi, pid, a);
    Chin.programarHost(R);
  },
  /* Online: las compus juegan en el teléfono del anfitrión */
  timer: null,
  programarHost(R) {
    const s = R.chi;
    if (!s || !(s.fase === "robar" || s.fase === "tirar") || !s.jug[s.turno].cpu) return;
    const k = s.id + s.ronda + s.turno + s.fase + s.mazo.length + s.descarte.length;
    if (Chin.timer === k) return; Chin.timer = k;
    setTimeout(() => { if (R.chi !== s || R.game !== "chinchon" || Chin.timer !== k) return; Chin.timer = null; Chin.jugarCompu(s); Net.broadcast(); Chin.programarHost(R); }, 900 + Math.random() * 500);
  }
};

PANTALLAS.chinchon = () => {
  const s = S.chi;
  const humanos = s.jug.map((j, i) => j.cpu ? -1 : i).filter(i => i >= 0);
  const enJuego = s.fase === "robar" || s.fase === "tirar";
  let yo = enJuego && !s.jug[s.turno].cpu ? s.turno : humanos.length === 1 ? humanos[0] : -1;
  // Varias personas: se pasa el teléfono en cada turno
  if (humanos.length > 1 && enJuego && !s.jug[s.turno].cpu && UI.chGate !== `${s.ronda}-${s.turno}-${s.descarte.length}-${s.mazo.length}`) {
    if (s.fase === "robar") {
      app.innerHTML = `${head(0)}<section class="stage passto"><p class="sub">${esc(s.log || `Ronda ${s.ronda}`)}</p>
        <div class="pass-art">${personaje(colorDe(s.jug[s.turno].name), "duda", 110)}</div>
        <p class="label" style="margin:0">Pásale el teléfono a</p><div class="who">${esc(s.jug[s.turno].name)}</div>
        <button class="btn" id="chSoy">Soy ${esc(s.jug[s.turno].name)}, ver mis cartas</button></section>`;
      on("chSoy", () => { UI.chGate = `${s.ronda}-${s.turno}-${s.descarte.length}-${s.mazo.length}`; render(); });
      return;
    }
  }
  if (yo < 0) yo = humanos[0] ?? 0;
  Chin.render(Chin.view(s, null, yo), a => {
    if (a.t === "again") return Chin.empezarLocal(s.jug.map(j => ({ id: j.id, name: j.name, cpu: j.cpu, nivel: j.nivel })));
    Chin.act(s, null, a);
    if (a.t === "robar") UI.chGate = `${s.ronda}-${s.turno}-${s.descarte.length}-${s.mazo.length}`;
    render();
  }, { local: true });
  // Turno de la compu
  if (enJuego && s.jug[s.turno].cpu) {
    const k = `${s.ronda}-${s.turno}-${s.fase}-${s.mazo.length}-${s.descarte.length}`;
    if (UI.chPens !== k) {
      UI.chPens = k;
      setTimeout(() => { if (S.screen !== "chinchon" || !s.jug[s.turno].cpu) return; Chin.jugarCompu(s); render(); }, 700);
    }
  }
};
