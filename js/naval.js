/* Batalla naval: tablero 10×10, 5 barcos, si acertás volvés a disparar. Compu con búsqueda y persecución. */
const FLOTA = [["Portaaviones", 5], ["Acorazado", 4], ["Crucero", 3], ["Submarino", 3], ["Destructor", 2]];
const LETRAS_N = "ABCDEFGHIJ";

const Naval = {
  /* Barcos al azar, sin tocarse entre sí */
  acomodar() {
    for (let intento = 0; intento < 200; intento++) {
      const ocup = new Set(), barcos = [];
      let ok = true;
      for (const [nombre, len] of FLOTA) {
        let puesto = false;
        for (let k = 0; k < 300 && !puesto; k++) {
          const hor = Math.random() < 0.5, f = Math.floor(Math.random() * (hor ? 10 : 11 - len)), c = Math.floor(Math.random() * (hor ? 11 - len : 10));
          const celdas = [...Array(len)].map((_, i) => (f + (hor ? 0 : i)) * 10 + c + (hor ? i : 0));
          const choca = celdas.some(x => { const xf = Math.floor(x / 10), xc = x % 10; for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) { const ff = xf + df, cc = xc + dc; if (ff >= 0 && ff < 10 && cc >= 0 && cc < 10 && ocup.has(ff * 10 + cc)) return true; } return false; });
          if (!choca) { celdas.forEach(x => ocup.add(x)); barcos.push({ nombre, len, celdas, hor }); puesto = true; }
        }
        if (!puesto) { ok = false; break; }
      }
      if (ok) return barcos;
    }
    return null;
  },

  setup(jug) {
    return {
      id: "nav-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      jug: jug.slice(0, 2).map(j => ({ ...j, barcos: Naval.acomodar(), tiros: [], listo: !!j.cpu })),
      fase: "colocar", turno: Math.random() < 0.5 ? 0 : 1, ultimo: null, ganador: null, ia: [{ pend: [] }, { pend: [] }]
    };
  },
  idx(s, pid) { return s.jug.findIndex(j => j.id === pid); },
  hundido: (b, tiros) => b.celdas.every(c => tiros.includes(c)),

  act(s, pid, a) {
    const yo = pid === null ? (s.fase === "colocar" ? a.i : s.turno) : Naval.idx(s, pid);
    if (yo < 0 || yo == null) return;
    const J = s.jug[yo];
    if (a.t === "reacomodar" && s.fase === "colocar" && !J.listo) J.barcos = Naval.acomodar();
    else if (a.t === "listo" && s.fase === "colocar") { J.listo = true; if (s.jug.every(j => j.listo)) s.fase = "juego"; }
    else if (a.t === "tiro" && s.fase === "juego" && yo === s.turno) Naval.disparar(s, yo, a.c);
  },

  disparar(s, yo, c) {
    const R = s.jug[1 - yo];
    if (c < 0 || c > 99 || R.tiros.includes(c)) return;
    R.tiros.push(c);
    const barco = R.barcos.find(b => b.celdas.includes(c));
    const hundido = barco && Naval.hundido(barco, R.tiros);
    s.ultimo = { por: yo, c, tocado: !!barco, hundido: hundido ? barco.nombre : null, n: (s.ultimo ? s.ultimo.n : 0) + 1 };
    if (barco && R.barcos.every(b => Naval.hundido(b, R.tiros))) { s.fase = "fin"; s.ganador = yo; return; }
    if (!barco) s.turno = 1 - yo;   // agua: pasa el turno; tocado: vuelve a tirar
  },

  /* Compu: persigue lo que tocó; si no, tira en damero al azar */
  tiroCompu(s, yo) {
    const R = s.jug[1 - yo], tiros = R.tiros;
    const tocadas = tiros.filter(c => { const b = R.barcos.find(x => x.celdas.includes(c)); return b && !Naval.hundido(b, tiros); });
    const vecinos = c => [c - 10, c + 10, c % 10 ? c - 1 : -1, c % 10 < 9 ? c + 1 : -1].filter(x => x >= 0 && x < 100 && !tiros.includes(x));
    let cand = [];
    if (tocadas.length >= 2) {
      const hor = Math.floor(tocadas[0] / 10) === Math.floor(tocadas[1] / 10);
      cand = tocadas.flatMap(vecinos).filter(x => hor ? Math.floor(x / 10) === Math.floor(tocadas[0] / 10) : x % 10 === tocadas[0] % 10);
    }
    if (!cand.length && tocadas.length) cand = tocadas.flatMap(vecinos);
    // No tirar pegado a barcos ya hundidos (nunca se tocan)
    const hundidas = new Set(R.barcos.filter(b => Naval.hundido(b, tiros)).flatMap(b => b.celdas));
    const pegado = x => { const f = Math.floor(x / 10), cc = x % 10; for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) { const ff = f + df, k = cc + dc; if (ff >= 0 && ff < 10 && k >= 0 && k < 10 && hundidas.has(ff * 10 + k)) return true; } return false; };
    if (!cand.length) {
      const libres = [...Array(100).keys()].filter(x => !tiros.includes(x) && !pegado(x));
      const damero = libres.filter(x => (Math.floor(x / 10) + x % 10) % 2 === 0);
      cand = damero.length ? damero : libres.length ? libres : [...Array(100).keys()].filter(x => !tiros.includes(x));
    }
    return pick(cand);
  },

  resultado(s, pid) {
    if (s.fase !== "fin") return null;
    const i = Naval.idx(s, pid); if (i < 0) return null;
    const mios = s.jug[i].barcos, intactos = mios.filter(b => !b.celdas.some(c => s.jug[i].tiros.includes(c))).length;
    return { juego: "naval", id: s.id, gano: s.ganador === i, hundidos: s.jug[1 - i].barcos.filter(b => Naval.hundido(b, s.jug[1 - i].tiros)).length, intactos: s.ganador === i ? intactos : 0, vsCompu: !!s.jug[1 - i].cpu };
  },

  /* Lo que ve cada jugador: sus barcos y, del rival, solo los tiros y los barcos hundidos */
  view(s, pid, yoLocal) {
    const i = yoLocal != null ? yoLocal : Naval.idx(s, pid);
    const vis = k => {
      const J = s.jug[k], propio = k === i || s.fase === "fin";
      return {
        name: J.name, cpu: !!J.cpu, listo: J.listo, tiros: J.tiros,
        barcos: J.barcos.map(b => ({ nombre: b.nombre, len: b.len, hundido: Naval.hundido(b, J.tiros), celdas: propio || Naval.hundido(b, J.tiros) ? b.celdas : null }))
      };
    };
    return { game: "naval", fase: s.fase, turno: s.turno, ultimo: s.ultimo, ganador: s.ganador, yo: i, jug: [vis(0), vis(1)], me: pid };
  },

  grilla(J, opts) {
    const barcoEn = {}; J.barcos.forEach(b => (b.celdas || []).forEach((c, k) => barcoEn[c] = { b, k }));
    const celdas = [];
    for (let c = 0; c < 100; c++) {
      const tiro = J.tiros.includes(c), be = barcoEn[c];
      let cls = "agua", cont = "";
      if (be) { cls = "barco" + (be.b.hundido ? " hundido" : ""); }
      if (tiro && be) { cls += " tocado"; cont = "💥"; }
      else if (tiro) { cls += " fallo"; cont = "•"; }
      if (opts.ultimo === c) cls += " ultimo";
      const toca = opts.disparo && !tiro;
      celdas.push(`<button class="nc ${cls}" ${toca ? `data-tiro="${c}"` : "disabled"} aria-label="${LETRAS_N[Math.floor(c / 10)]}${c % 10 + 1}">${cont}</button>`);
    }
    return `<div class="naval-wrap ${opts.cls || ""}"><div class="naval-col">${[...Array(10)].map((_, k) => `<i>${k + 1}</i>`).join("")}</div><div class="naval-fil">${LETRAS_N.split("").map(l => `<i>${l}</i>`).join("")}</div><div class="naval ${opts.cls || ""}">${celdas.join("")}</div></div>`;
  },

  flotaHTML(J) {
    return `<div class="flota">${J.barcos.map(b => `<span class="${b.hundido ? "hund" : ""}">${b.nombre} <i>${"■".repeat(b.len)}</i></span>`).join("")}</div>`;
  },

  render(v, send, opts) {
    const yo = v.yo, jefe = opts.local || opts.isHost;
    const Y = v.jug[yo], R = v.jug[1 - yo];
    let body = "";
    if (yo < 0) body = `<div class="stage"><h2>Partida en curso</h2><p class="sub">Esta batalla es de dos. Mira cómo termina.</p></div>`;
    else if (v.fase === "colocar") {
      body = `<div><h2>Tu flota, ${esc(Y.name)}</h2><p class="sub">Los barcos se acomodan solos y nunca se tocan. Reacomódalos hasta que te guste.</p></div>
        ${Naval.grilla(Y, { cls: "propia" })}
        ${Naval.flotaHTML(Y)}
        ${Y.listo ? `<p class="sub center">Listo. Esperando a ${esc(R.name)}…</p>` : `<div class="row"><button class="btn ghost" id="nvRe">🔀 Reacomodar</button><button class="btn" id="nvOk">¡A la batalla!</button></div>`}`;
    } else {
      const miTurno = v.fase === "juego" && v.turno === yo && !Y.cpu;
      const u = v.ultimo;
      const aviso = u ? `<div class="nv-aviso ${u.tocado ? (u.hundido ? "hund" : "toc") : "agua"}" data-n="${u.n}">${u.hundido ? `¡Hundido! ${esc(v.jug[u.por].name)} hundió el ${esc(u.hundido)}` : u.tocado ? `💥 ¡Tocado! ${esc(v.jug[u.por].name)} vuelve a disparar` : `💦 Agua. Turno de ${esc(v.jug[1 - u.por].name)}`}</div>` : "";
      body = `${v.fase === "fin" ? `<div class="verdict ${v.ganador === yo ? "good" : "bad"}"><div class="big">${v.ganador === yo ? "¡Ganaste la batalla!" : `Gana ${esc(v.jug[v.ganador].name)}`}</div><div class="note">Toda la flota enemiga está en el fondo del mar.</div></div>` : aviso}
        <div class="nv-tit"><span class="label">Flota de ${esc(R.name)}${miTurno ? " · toca dónde disparar" : ""}</span>${v.fase === "juego" ? `<span class="nv-turno">${miTurno ? "🎯 Tu turno" : `Turno de ${esc(v.jug[v.turno].name)}`}</span>` : ""}</div>
        ${Naval.grilla(R, { disparo: miTurno, ultimo: u && u.por === yo ? u.c : null, cls: "enemiga" })}
        ${Naval.flotaHTML(R)}
        <div class="nv-tit"><span class="label">Tu flota</span></div>
        ${Naval.grilla(Y, { ultimo: u && u.por !== yo ? u.c : null, cls: "propia chica" })}
        ${v.fase === "fin" && jefe ? `<div class="row"><button class="btn" id="nvOtra">Otra batalla</button><button class="btn ghost" id="nvSalir">${opts.local ? "Inicio" : "Volver a la sala"}</button></div>` : ""}`;
    }
    app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen naval-screen">${body}</section>`;
    on("nvRe", () => send({ t: "reacomodar", i: yo }));
    on("nvOk", () => send({ t: "listo", i: yo }));
    app.querySelectorAll("[data-tiro]").forEach(b => b.onclick = () => send({ t: "tiro", c: +b.dataset.tiro }));
    on("nvOtra", () => send({ t: "again" }));
    on("nvSalir", () => opts.local ? go("home") : send({ t: "lobby" }));
  },

  /* ---------- Un teléfono ---------- */
  empezarLocal(jug) {
    S.nav = Naval.setup(jug);
    Object.assign(UI, { nvGate: null, nvPens: null });
    go("naval");
  },
  empezarOn(R) {
    const jug = R.players.filter(p => p.on);
    if (jug.length < 2) return "Hacen falta 2 jugadores.";
    R.nav = Naval.setup(jug.slice(0, 2).map(p => ({ id: p.id, name: p.name })));
    R.game = "naval";
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") { R.nav = Naval.setup(R.nav.jug.map(j => ({ id: j.id, name: j.name }))); return; }
    if (a.t === "lobby" && pid === "H") { R.game = null; R.nav = null; return; }
    Naval.act(R.nav, pid, a);
  }
};

PANTALLAS.naval = () => {
  const s = S.nav;
  const humanos = s.jug.map((j, i) => j.cpu ? -1 : i).filter(i => i >= 0);
  // Quién mira la pantalla: el humano que coloca o el que dispara
  let yo;
  if (s.fase === "colocar") yo = s.jug.findIndex(j => !j.listo && !j.cpu);
  else if (s.fase === "juego") yo = s.jug[s.turno].cpu ? humanos[0] : s.turno;
  else yo = humanos.length === 1 ? humanos[0] : s.ganador;
  if (yo < 0) yo = humanos[0];
  const dos = humanos.length === 2;
  // Con dos personas en un teléfono, se pasa el teléfono entre turnos
  const clave = `${s.fase}-${yo}`;
  if (dos && s.fase !== "fin" && UI.nvGate !== clave) {
    app.innerHTML = `${head(0)}<section class="stage passto">${s.ultimo && s.fase === "juego" ? `<p class="sub">${s.ultimo.tocado ? "💥 ¡Tocado!" : "💦 Agua."}</p>` : ""}
      <div class="pass-art">${personaje(colorDe(s.jug[yo].name), "duda", 110, ["gorra"])}</div>
      <p class="label" style="margin:0">Pásale el teléfono a</p><div class="who">${esc(s.jug[yo].name)}</div>
      <p class="sub">${s.fase === "colocar" ? "Va a acomodar su flota en secreto." : "Le toca disparar."}</p>
      <button class="btn" id="nvSoy">Soy ${esc(s.jug[yo].name)}</button></section>`;
    on("nvSoy", () => { UI.nvGate = clave; render(); });
    return;
  }
  Naval.render(Naval.view(s, null, yo), a => {
    if (a.t === "again") return Naval.empezarLocal(s.jug.map(j => ({ id: j.id, name: j.name, cpu: j.cpu })));
    Naval.act(s, null, a);
    render();   // con dos personas, después de un "agua" aparece la pantalla de pasar el teléfono
  }, { local: true });
  // Turno de la compu
  const cpu = s.jug[s.turno];
  if (s.fase === "juego" && cpu.cpu && UI.nvPens !== s.ultimo?.n) {
    UI.nvPens = s.ultimo ? s.ultimo.n : 0;
    setTimeout(() => { if (S.screen !== "naval" || s.fase !== "juego" || !s.jug[s.turno].cpu) return; Naval.disparar(s, s.turno, Naval.tiroCompu(s, s.turno)); render(); }, 800);
  }
};
