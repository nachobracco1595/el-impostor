/* Circo: como el Circus Charlie. El payaso (con tu personaje) avanza de costado y salta obstáculos.
   - Etapa 1: arriba del león, saltando aros de fuego (y ollas encendidas en el piso). Los aros chicos dan bonus.
   - Etapa 2: cuerda floja, saltando monos que vienen caminando (los azules rebotan).
   - Etapa 3: pelotas que ruedan: hay que saltar de una a otra sin caer al piso.
   - 3 vidas; al perder una, se vuelve al último banderín. Cada obstáculo superado suma, y terminar rápido da bonus.
   - Online cada uno juega en su teléfono la misma pista (sale de una semilla) y ve a los demás como fantasmas.
     En un teléfono, varias personas juegan una detrás de otra. */
const CI = {
  G: 1700, SALTO: 640, VEL: 205, ATRAS: 120, VEL_BOLA: 150, LARGO: 3000, CP: 750, VIDAS: 3, ALTO: 96, DURACION: 300,
  BOLA: 28, SEGURO: 260, ETAPAS: [["leon", "El león y los aros de fuego"], ["cuerda", "La cuerda floja"], ["pelotas", "Las pelotas"]]
};

const Circo = {
  clave: "circo", nombre: "Circo", boton: "🎪 ¡Que empiece la función!",
  descripcion: "Como el Circus Charlie: saltá aros de fuego arriba del león, monos en la cuerda floja y pasá de pelota en pelota. Tres vidas, y gana el que más puntos hace.",
  cfg() { return Turnero.cfg("circo", {}); },
  arte() { return MenuArte.circo(); },
  empezarLocal() { Circo.local(); },
  lobby(v, H) { const c = v.exCfg.circo; return `<p class="summary">Todos a la vez, cada uno en su teléfono, con la misma pista. Ven a los demás como fantasmas. Gana el que más puntos hace.${c.mesa > v.players.length ? ` Se suman ${Math.min(6, c.mesa) - v.players.length} bot${Math.min(6, c.mesa) - v.players.length > 1 ? "s" : ""}.` : ""}</p>${Turnero.lobbyBots("circo", c, H)}`; },
  lobbyInfo: ["Circo", "🎪", "1 a 8"],

  azar(semilla) { let a = semilla >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  /* Las tres etapas (iguales para todos los que tienen la misma semilla).
     Cada obstáculo se ubica de modo que, desde cualquier banderín donde se pueda reaparecer y avanzando a
     velocidad normal, siempre haya tiempo de aterrizar antes del salto siguiente (los aros y los monos se
     mueven, así que uno rápido podría alcanzar a otro: eso se controla acá). */
  pista(semilla) {
    const r = Circo.azar(semilla), L = CI.LARGO;
    const salidas = [0, 1, 2, 3].map(k => k * CI.CP);
    const armar = (vel, minimo, crear) => {
      const lista = []; let x = 560, id = 0;
      const cuando = (o, cp) => (o.x0 - (cp + 80)) / (vel + (o.v || 0));
      const sirve = o => salidas.every(cp => {
        if (cp && o.x0 <= cp + 260) return true;
        const t = cuando(o, cp);
        return lista.every(q => (cp && q.x0 <= cp + 260) || Math.abs(cuando(q, cp) - t) >= minimo);
      });
      while (x < L - CI.SEGURO - 60) {
        const o = crear(x / L, id); o.x0 = x;
        let ok = false;
        for (let k = 0; k < 30 && o.x0 < L - CI.SEGURO - 40; k++) { if (sirve(o)) { ok = true; break; } o.x0 += 35; }
        if (ok) { o.id = id++; lista.push(o); x = o.x0; }
        x += 170 + r() * 200;
      }
      return lista;
    };
    // León: aros que vienen hacia vos, ollas encendidas en el piso y aros chicos con bonus
    const leon = armar(CI.VEL, 1.05, (dif, id) => {
      const k = r();
      if (k < 0.5 || dif < 0.2) return { t: "aro", x0: 0, v: 55 + dif * 30, cy: 150, ri: 78 };
      if (k < 0.82) return { t: "olla", x0: 0, w: 15, h: 38 };
      return dif > 0.4 ? { t: "aro", x0: 0, v: 62, cy: 158, ri: 60, bonus: true } : { t: "olla", x0: 0, w: 15, h: 38 };
    }).map(o => o);
    // Cuerda floja: monos marrones que caminan y azules que rebotan
    const cuerda = armar(CI.VEL, 0.95, dif => { const azul = dif > 0.35 && r() < 0.35; return { t: "mono", x0: 0, v: azul ? 110 : 65 + dif * 35, azul, fase: r() * 6 }; });
    // Pelotas: ruedan hacia vos; hay que saltar de una a otra
    const pelotas = armar(CI.VEL_BOLA, 1.15, (dif, id) => ({ t: "bola", x0: 0, v: 26 + r() * 18 + dif * 16, color: ["#ff4d63", "#4dabf7", "#ffd43b", "#69db7c", "#b197fc"][id % 5] }));
    return [{ t: "leon", obst: leon }, { t: "cuerda", obst: cuerda }, { t: "pelotas", obst: pelotas }];
  },
  /* Dónde está un obstáculo que se mueve (según el tiempo de este tramo) */
  xObs(o, C) { return o.v ? o.x0 - o.v * C.te : o.x0; },
  yMono(o, C) { return o.azul ? Math.abs(Math.sin(C.te * 3.6 + o.fase)) * 58 : 0; },

  nuevo(j) {
    return { ...j, et: 0, x: 80, y: 0, vx: 0, vy: 0, aire: false, te: 0, tEt: 0, cp: 0, vidas: CI.VIDAS, pts: 0, muerto: 0, fin: null, completo: false, pasados: [], bola: -1, usadas: [], suelo: 0, etapas: 0, quema: 0 };
  },
  /* ---------- Física de un payaso (la misma para la persona y los bots) ---------- */
  paso(E, C, dt, ctrl) {
    if (C.fin != null) return;
    if (C.muerto > 0) {
      C.muerto -= dt;
      if (C.muerto <= 0) { C.muerto = 0; if (C.vidas <= 0) { C.fin = C.tTotal || 0; return; } Circo.revivir(C); }
      return;
    }
    const et = E[C.et], tipo = et.t;
    C.te += dt; C.tEt += dt; C.tTotal = (C.tTotal || 0) + dt;
    // En las pelotas, parado arriba de la tuya (salvo en la zona segura del final)
    if (tipo === "pelotas" && !C.aire && C.bola !== -3) C.y = CI.BOLA * 2;
    if (!C.aire) C.vx = ctrl.dir > 0 ? (tipo === "pelotas" ? CI.VEL_BOLA : CI.VEL) : ctrl.dir < 0 ? -(tipo === "pelotas" ? CI.VEL_BOLA * 0.7 : CI.ATRAS) : 0;
    if (ctrl.salta && !C.aire) { C.vy = CI.SALTO; C.aire = true; if (tipo === "pelotas") { if (C.bola >= 0) C.usadas.push(C.bola); C.dejo = { x: C.x, t: C.te }; C.bola = -2; } if (typeof Sonido !== "undefined" && C.yo) Sonido.sfx("tic"); }
    C.x = Math.max(C.cp + 20, C.x + C.vx * dt);
    const yAntes = C.y, base = tipo === "pelotas" ? CI.BOLA * 2 : 0;
    if (C.aire) {
      C.vy -= CI.G * dt; C.y += C.vy * dt;
      if (tipo !== "pelotas" && C.y <= 0) { C.y = 0; C.aire = false; C.vy = 0; }
      if (tipo === "pelotas" && C.vy < 0 && yAntes >= base && C.y < base) {
        // ¿Cae arriba de una pelota?
        const b = Circo.activos(et, C).find(o => !C.usadas.includes(o.id) && Math.abs(Circo.xObs(o, C) - C.x) < 24);
        if (b) { C.y = base; C.aire = false; C.vy = 0; C.bola = b.id; C.bx0 = Circo.xObs(b, C) - C.x; if (!C.pasados.includes("b" + b.id)) { C.pasados.push("b" + b.id); C.pts += 100; } }
      }
      if (tipo === "pelotas" && C.y <= 0) { C.y = 0; C.aire = false; C.vy = 0; if (C.x < CI.LARGO - CI.SEGURO) return Circo.morir(C, "cayo"); C.bola = -3; }
    }
    // Choques
    for (const o of Circo.activos(et, C)) {
      if (o.t === "bola") continue;
      const ox = Circo.xObs(o, C), dx = C.x - ox;
      if (o.t === "aro") {
        if (Math.abs(dx) < 10) { const abajo = o.cy - o.ri + 4, arriba = o.cy + o.ri; if (C.y < abajo || C.y + CI.ALTO > arriba) return Circo.morir(C, "quema"); }
        if (dx > 40 && !C.pasados.includes(o.id)) { C.pasados.push(o.id); C.pts += o.bonus ? 500 : 100; }
      } else if (o.t === "olla") {
        if (Math.abs(dx) < o.w + 30 && C.y < o.h) return Circo.morir(C, "quema");
        if (dx > 50 && !C.pasados.includes(o.id)) { C.pasados.push(o.id); C.pts += 200; }
      } else if (o.t === "mono") {
        const my = Circo.yMono(o, C);
        if (Math.abs(dx) < 24 && C.y < my + 34 && C.y + 70 > my) return Circo.morir(C, "mono");
        if (dx > 30 && !C.pasados.includes(o.id)) { C.pasados.push(o.id); C.pts += o.azul ? 200 : 100; }
      }
    }
    // Pelotas: la propia va con el payaso; si choca con otra, se cae
    if (tipo === "pelotas" && !C.aire && C.bola !== -3) {
      for (const o of Circo.activos(et, C)) {
        if (C.usadas.includes(o.id) || o.id === C.bola) continue;
        if (Math.abs(Circo.xObs(o, C) - C.x) < CI.BOLA * 2 - 4) return Circo.morir(C, "choca");
      }
    }
    // Fin de la etapa
    if (C.x >= CI.LARGO) {
      C.pts += 1000 + Math.max(0, Math.round((60 - C.tEt) * 40 / 10) * 10); C.etapas++;
      if (C.et >= E.length - 1) { C.completo = true; C.fin = C.tTotal; return; }
      C.et++; C.x = 80; C.y = 0; C.cp = 0; C.te = 0; C.tEt = 0; C.aire = false; C.vy = 0; C.bola = -1; C.usadas = []; C.pasados = []; C.desde = 0; C.dejo = null; C.nuevaEtapa = true;
    }
  },
  morir(C, porque) {
    C.muerto = 1.4; C.vidas--; C.porque = porque; C.vx = 0; C.aire = false;
    if (typeof Sonido !== "undefined" && C.yo) Sonido.sfx("derrota");
    try { if (C.yo) navigator.vibrate && navigator.vibrate(120); } catch {}
  },
  revivir(C) {
    C.cp = Math.floor(Math.max(0, C.x - 60) / CI.CP) * CI.CP;
    C.x = C.cp + 80; C.y = 0; C.vy = 0; C.aire = false; C.te = 0; C.bola = -1; C.usadas = []; C.porque = null; C.dejo = null;
    // Los obstáculos se vuelven a armar desde el banderín (los que ya pasaste no vuelven a sumar)
    C.desde = C.cp + 260;
  },
  /* Obstáculos activos de este tramo (después de perder una vida arrancan desde el banderín) */
  activos(et, C) { const d = C.desde || 0; return d ? et.obst.filter(o => o.x0 > d) : et.obst; },

  /* ---------- Bots ---------- */
  pensar(E, C, dt) {
    if (C.fin != null || C.muerto > 0) return { dir: 0, salta: false };
    const et = E[C.et], h = C.h ?? (C.h = Turnero.habilidad("circo", C.nivel)), err = 1 - h;
    C.duda = C.duda ?? 0; C.duda -= dt;
    const ctrl = { dir: 1, salta: false };
    if (C.aire) return ctrl;
    if (et.t === "pelotas") {
      const sig = Circo.activos(et, C).filter(o => !C.usadas.includes(o.id) && o.id !== C.bola).map(o => ({ o, x: Circo.xObs(o, C) })).filter(b => b.x > C.x).sort((a, b) => a.x - b.x)[0];
      const vuelo = 2 * CI.SALTO / CI.G;
      if (sig) {
        const necesita = (CI.VEL_BOLA + sig.o.v) * vuelo, gap = sig.x - C.x;
        C.errB = C.errB ?? Turnero.gauss() * (6 + 40 * err);
        if (gap < necesita + C.errB) { ctrl.salta = true; C.errB = null; }
      } else if (C.x > CI.LARGO - CI.SEGURO - 95) ctrl.salta = true;
      return ctrl;
    }
    // Tiempo hasta cada obstáculo de adelante y cuándo conviene saltar
    let mejor = null;
    for (const o of Circo.activos(et, C)) {
      const ox = Circo.xObs(o, C), d = ox - C.x; if (d < 12 || d > 420) continue;
      // Momento ideal para saltar (segundos antes de llegar al centro del obstáculo): mitad de la ventana que lo pasa
      const vrel = CI.VEL + (o.v || 0), tl = d / vrel;
      const ideal = o.t === "aro" ? (o.bonus ? 0.4 : 0.375) : o.t === "olla" ? 0.375 : o.azul ? 0.3 : 0.32;
      if (!mejor || tl < mejor.tl) mejor = { o, tl, ideal };
    }
    if (mejor) {
      C.errO = C.errO && C.errO.id === mejor.o.id ? C.errO : { id: mejor.o.id, e: Turnero.gauss() * (0.012 + 0.11 * err) };
      if (mejor.tl <= mejor.ideal + C.errO.e) ctrl.salta = true;
    }
    return ctrl;
  },

  /* ---------- Partida ---------- */
  crear(jug, cfg) {
    const semilla = Math.floor(Math.random() * 1e9);
    return { id: Turnero.nuevoId("ci"), semilla, etapas: Circo.pista(semilla), fase: "cuenta", t: -3, mov: 0, local: !!cfg.local, jug: jug.map(j => Circo.nuevo(j)) };
  },
  tick(s, dt) {
    s.t += dt;
    if (s.fase === "cuenta" && s.t >= 0) s.fase = "juego";
    if (s.fase !== "juego") return;
    for (const b of s.jug) if (b.cpu && b.fin == null) { const ctrl = Circo.pensar(s.etapas, b, dt); Circo.paso(s.etapas, b, dt, ctrl); }
    Circo.ordenar(s);
    const humanos = s.jug.filter(j => !j.cpu);
    // Si las personas ya terminaron, los bots que siguen se apuran
    if (humanos.length && humanos.every(j => j.fin != null)) for (const b of s.jug) if (b.cpu && b.fin == null) { for (let k = 0; k < 8 && b.fin == null; k++) Circo.paso(s.etapas, b, 0.05, Circo.pensar(s.etapas, b, 0.05)); }
    if (s.jug.every(j => j.fin != null) || s.t > CI.DURACION) Circo.terminar(s);
  },
  ordenar(s) { const o = s.jug.slice().sort((a, b) => b.pts - a.pts || b.et - a.et || b.x - a.x); o.forEach((j, k) => j.puesto = k + 1); },
  terminar(s) { if (s.fase === "fin") return; s.jug.forEach(j => { if (j.fin == null) j.fin = s.t; }); Circo.ordenar(s); s.fase = "fin"; s.mov++; },
  act(s, pid, a) {
    const J = s.jug.find(j => j.id === pid); if (!J || J.cpu) return;
    if (a.t === "pos" && s.fase !== "fin") {
      const n = (v, lo, hi) => Math.max(lo, Math.min(hi, +v || 0));
      J.et = n(a.et, 0, 2) | 0; J.x = n(a.x, 0, CI.LARGO + 50); J.y = n(a.y, 0, 400); J.pts = Math.max(J.pts, n(a.pts, 0, 60000) | 0); J.vidas = n(a.vi, 0, 3) | 0; J.muerto = a.m ? 0.2 : 0; J.etapas = n(a.ets, 0, 3) | 0;
      if (a.fin && J.fin == null) { J.fin = s.t; J.completo = !!a.comp; }
    }
  },
  /* Lo que suma a la cuenta (el puntaje de la función es otra cosa: es solo para esta partida) */
  textoCuenta(v, yo) {
    if (!yo || typeof Puntos === "undefined" || !BD.sesion()) return "";
    const r = Circo.resultado({ fase: "fin", id: v.id, jug: v.jug.map(j => ({ ...j, cpu: j.cpu })) }, yo.id); if (!r) return "";
    const c = Puntos.calcular(r);
    return `El puntaje de la función queda en tu récord. A tu cuenta se suman <b>+${c.puntos} puntos</b>${c.gano ? " y la partida cuenta como ganada" : ""}.`;
  },
  resultado(s, pid) {
    if (!s || s.fase !== "fin") return null;
    const J = s.jug.find(j => j.id === pid); if (!J) return null;
    // Solo (sin rivales) se gana completando la función
    return { juego: "circo", id: s.id, gano: s.jug.length > 1 ? J.puesto === 1 : !!J.completo, puesto: J.puesto, n: s.jug.length, vsCompu: s.jug.every(j => j === J || j.cpu), total: J.pts, etapas: J.etapas, completo: J.completo };
  },
  view(s, pid) {
    return { game: "circo", id: s.id, me: pid, semilla: s.semilla, fase: s.fase, t: s.t,
      jug: s.jug.map(j => ({ id: j.id, name: j.name, cpu: !!j.cpu, look: j.look, et: j.et, x: Math.round(j.x), y: Math.round(j.y), pts: j.pts, vidas: j.vidas, m: j.muerto > 0, fin: j.fin, puesto: j.puesto, etapas: j.etapas, completo: j.completo })) };
  },

  /* ---------- En este teléfono: una persona detrás de otra; los bots corren junto con la primera ---------- */
  local() {
    const c = Circo.cfg(), u = BD.sesion();
    const personas = (c.personas && c.personas.length ? c.personas : [u ? u.nombre : "Vos"]).slice(0, 6);
    const jug = [...personas.map((name, i) => { const p = BD.porNombre(name); return { id: "p" + i, name, look: p ? p.look : null }; }), ...Turnero.bots(c.bots, c.nivel)];
    S.extra = Circo.crear(jug, { local: true }); S.extra.juego = "circo"; S.extra.actual = 0;
    UI.extraPase = personas.length > 1 ? null : "p0";
    go("circo");
  },
  pantallaLocal() {
    const s = S.extra; if (!s || s.juego !== "circo") return go("circoIntro");
    const humanos = s.jug.filter(j => !j.cpu), J = humanos[s.actual];
    if (s.fase !== "fin" && J && UI.extraPase !== J.id) {
      Circo.parar();
      app.innerHTML = `${head(0)}<section class="stage">${retrato(J.look || { color: colorDe(J.name), acc: [] }, 110)}<h2>${s.actual ? "Turno de" : "Arranca"} ${esc(J.name)}</h2><p class="sub">${s.actual ? `Récord a batir: <b>${Math.max(...s.jug.filter(j => j.fin != null).map(j => j.pts))}</b> puntos.` : "Pasale el teléfono."}</p><button class="btn" id="soyYo">Soy ${esc(J.name)}, ¡a la pista!</button></section>`;
      on("soyYo", () => { UI.extraPase = J.id; if (s.actual) { s.t = -3; s.fase = "cuenta"; } render(); });
      return;
    }
    clearInterval(Circo.reloj);
    let prev = performance.now();
    Circo.reloj = setInterval(() => {
      if (S.extra !== s || S.screen !== "circo") { clearInterval(Circo.reloj); Circo.reloj = null; return; }
      const ahora = performance.now(), dt = Math.min(0.06, (ahora - prev) / 1000); prev = ahora;
      s.t += dt; if (s.fase === "cuenta" && s.t >= 0) s.fase = "juego";
      if (s.fase === "juego" && s.actual === 0) for (const b of s.jug) if (b.cpu && b.fin == null) Circo.paso(s.etapas, b, dt, Circo.pensar(s.etapas, b, dt));
      Circo.ordenar(s);
      const yo = humanos[s.actual];
      if (yo && yo.fin != null && s.fase !== "fin") {
        // Terminó esta persona: si hay otra, le toca; si no, se esperan los bots (se apuran)
        if (s.actual < humanos.length - 1) { s.actual++; clearInterval(Circo.reloj); Circo.reloj = null; setTimeout(() => render(), 1800); return; }
        for (const b of s.jug) if (b.cpu) while (b.fin == null) Circo.paso(s.etapas, b, 0.05, Circo.pensar(s.etapas, b, 0.05));
        Circo.terminar(s);
      }
      Circo.v = Circo.view(s, yo ? yo.id : "p0"); Circo.hud();
      if (s.fase === "fin" && !s.contada) { s.contada = true; Cuenta.revisar(); }
    }, 50);
    Circo.render(Circo.view(s, J ? J.id : "p0"), a => {
      if (a.t === "again") { Circo.parar(); return Circo.local(); }
      if (a.t === "salir") { Circo.parar(); clearInterval(Circo.reloj); S.extra = null; return go("circoIntro"); }
    }, { local: true, isHost: true });
  },

  /* ---------- Online ---------- */
  empezarOn(R) {
    const c = Circo.cfg();
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name, look: p.id === "H" ? Cuenta.look() : p.look }));
    if (jug.length > 8) return "El circo es de hasta 8.";
    R.ex = Circo.crear([...jug, ...Turnero.bots(Math.max(0, Math.min(5, (c.mesa || 0) - jug.length)), c.nivel)], { local: false });
    R.ex.juego = "circo"; R.game = "circo";
    clearInterval(Circo.relojOn);
    let prev = performance.now(), n = 0;
    Circo.relojOn = setInterval(() => {
      if (!Net.R || Net.R.game !== "circo" || !Net.R.ex) { clearInterval(Circo.relojOn); Circo.relojOn = null; return; }
      const s = Net.R.ex, ahora = performance.now(); Circo.tick(s, Math.min(0.1, (ahora - prev) / 1000)); prev = ahora;
      if (++n % 2 === 0 || s.fase === "fin") Net.broadcast();
      if (s.fase === "fin") { clearInterval(Circo.relojOn); Circo.relojOn = null; }
    }, 50);
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") { const e = Circo.empezarOn(R); R.err = e || ""; return; }
    if (a.t === "lobby" && pid === "H") { clearInterval(Circo.relojOn); R.game = null; R.ex = null; return; }
    Circo.act(R.ex, pid, a);
  },
  turnoInfo() { return null; },

  /* ---------- Pantalla ---------- */
  render(v, send, opts) {
    Circo.v = v; Circo.send = send; Circo.opts = opts;
    const U = UI.ci;
    if (!U || U.id !== v.id || U.me !== v.me || !byId("ciCanvas")) Circo.montar(v);
    else if (!opts.local) { const nuevo = performance.now() / 1000 - v.t; UI.ci.off = Math.abs(nuevo - UI.ci.off) > 0.5 ? nuevo : UI.ci.off * 0.9 + nuevo * 0.1; }
    Circo.hud();
  },
  montar(v) {
    Circo.parar(true);
    document.body.classList.add("en-nave");
    app.innerHTML = `<div class="nave circo" id="ciRoot"><canvas id="ciCanvas"></canvas>
      <div class="cr-top" id="ciTop"></div><div class="ar-centro" id="ciCentro" hidden></div>
      <div class="ci-ctrl"><button class="ci-b" id="ciAtras" aria-label="Para atrás">◀</button><button class="ci-b" id="ciAdelante" aria-label="Para adelante">▶</button></div>
      <button class="md-accion ci-saltar" id="ciSaltar" aria-label="Saltar">SALTAR</button>
      <button class="nv-salir" id="ciSalir" aria-label="Salir">✕</button>
      <div class="ar-fin" id="ciFin" hidden></div></div>`;
    const local = Circo.opts.local, s = S.extra;
    const yo = local ? s.jug.find(j => j.id === v.me) : Circo.nuevo(v.jug.find(j => j.id === v.me) || { id: v.me, name: "Vos" });
    yo.yo = true;
    UI.ci = { id: v.id, me: v.me, etapas: local ? s.etapas : Circo.pista(v.semilla), off: performance.now() / 1000 - v.t, yo, dir: 0, salta: false, teclas: {}, ultEnvio: 0, otros: {}, cam: 0, chispas: [] };
    const sostener = (id, dir) => { const b = byId(id); const on1 = e => { e.preventDefault(); UI.ci.dir = dir; b.classList.add("on"); }, off = e => { if (UI.ci && UI.ci.dir === dir) UI.ci.dir = 0; b.classList.remove("on"); }; b.addEventListener("pointerdown", on1); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off); b.oncontextmenu = e => e.preventDefault(); };
    sostener("ciAdelante", 1); sostener("ciAtras", -1);
    const bs = byId("ciSaltar"); bs.onpointerdown = e => { e.preventDefault(); UI.ci.salta = true; setTimeout(() => { if (UI.ci) UI.ci.salta = false; }, 140); }; bs.oncontextmenu = e => e.preventDefault();
    byId("ciSalir").onclick = () => { if (Circo.opts.local) { if (Circo.v.fase === "fin" || confirm("¿Salir del circo?")) Circo.send({ t: "salir" }); } else { UI.confirmSalir = true; render(); } };
    if (!Circo.teclasListas) {
      Circo.teclasListas = true;
      window.addEventListener("keydown", e => { if (!UI.ci || !byId("ciCanvas")) return; if (e.key === " " || e.key === "ArrowUp") { UI.ci.salta = true; e.preventDefault(); } if (e.key === "ArrowRight") UI.ci.teclas.d = 1; if (e.key === "ArrowLeft") UI.ci.teclas.i = 1; });
      window.addEventListener("keyup", e => { if (!UI.ci) return; if (e.key === " " || e.key === "ArrowUp") UI.ci.salta = false; if (e.key === "ArrowRight") delete UI.ci.teclas.d; if (e.key === "ArrowLeft") delete UI.ci.teclas.i; });
    }
    let prev = performance.now();
    const paso = now => {
      Circo.raf = requestAnimationFrame(paso);
      const cv = byId("ciCanvas"); if (!cv || !UI.ci) { Circo.parar(); return; }
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      Circo.moverYo(dt, now);
      dibujarSeguro(cv, () => Circo.dibujar(cv, now));
    };
    Circo.raf = requestAnimationFrame(paso);
  },
  parar(soloVista) { cancelAnimationFrame(Circo.raf); Circo.raf = null; UI.ci = null; document.body.classList.remove("en-nave"); const r = byId("ciRoot"); if (r) r.remove(); if (!soloVista) { clearInterval(Circo.reloj); Circo.reloj = null; } },
  moverYo(dt, now) {
    const U = UI.ci, v = Circo.v, C = U.yo;
    const t = Circo.opts.local ? S.extra.t : now / 1000 - U.off;
    if (v.fase !== "juego" || t < 0 || C.fin != null) { if (!Circo.opts.local && C.fin != null && !U.avisoFin) { U.avisoFin = true; Circo.enviar(C); } return; }
    const dir = U.dir || (U.teclas.d ? 1 : U.teclas.i ? -1 : 0);
    Circo.paso(U.etapas, C, dt, { dir, salta: U.salta });
    if (C.nuevaEtapa) { C.nuevaEtapa = false; U.cartelEt = { txt: CI.ETAPAS[C.et][1], t: now }; }
    if (!Circo.opts.local && now - U.ultEnvio > 110) { U.ultEnvio = now; Circo.enviar(C); }
  },
  enviar(C) { Circo.send({ t: "pos", et: C.et, x: Math.round(C.x), y: Math.round(C.y), pts: C.pts, vi: C.vidas, m: C.muerto > 0 ? 1 : 0, ets: C.etapas, fin: C.fin != null ? 1 : 0, comp: C.completo ? 1 : 0 }); },

  dibujar(cv, now) {
    const U = UI.ci, v = Circo.v, C = U.yo, dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const esc = Math.min(W / 400, H / 430), piso = H * 0.64, et = U.etapas[C.et], tipo = et.t, t = now / 1000;
    U.cam += ((C.x - W * 0.3 / esc) - U.cam) * 0.2;
    const X = x => (x - U.cam) * esc, Y = y => piso - y * esc;
    // Carpa: rayas, público y reflectores
    const fondo = ctx.createLinearGradient(0, 0, 0, H); fondo.addColorStop(0, "#2a0b16"); fondo.addColorStop(0.6, "#5a1124"); fondo.addColorStop(1, "#2a0b16"); ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    const par = U.cam * esc * 0.3, ancho = 70;
    for (let k = -1; k < W / ancho + 2; k++) { const x = k * ancho - (par % ancho); ctx.fillStyle = k % 2 ? "rgba(255,230,200,.08)" : "rgba(255,60,80,.12)"; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + ancho, 0); ctx.lineTo(x + ancho * 1.6, piso - 120 * esc); ctx.lineTo(x + ancho * 0.6, piso - 120 * esc); ctx.fill(); }
    const pub = U.cam * esc * 0.55;
    for (let fila = 0; fila < 3; fila++) { const y = piso - (150 + fila * 34) * esc; for (let k = -1; k < W / 26 + 2; k++) { const x = k * 26 - (pub % 26) + fila * 13, salto = Math.max(0, Math.sin(t * 6 + k * 1.7 + fila)) * 3; ctx.fillStyle = `hsl(${(k * 47 + fila * 90) % 360},35%,${22 + fila * 4}%)`; ctx.beginPath(); ctx.arc(x, y - salto, 9 * esc, 0, 7); ctx.fill(); ctx.fillRect(x - 10 * esc, y - salto + 6 * esc, 20 * esc, 18 * esc); } }
    for (let k = 0; k < 3; k++) { const x = W * (0.2 + k * 0.3) + Math.sin(t * 0.7 + k * 2) * W * 0.12; const g = ctx.createLinearGradient(x, 0, x, piso); g.addColorStop(0, "rgba(255,240,180,.35)"); g.addColorStop(1, "rgba(255,240,180,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 8, 0); ctx.lineTo(x + 8, 0); ctx.lineTo(x + 90, piso); ctx.lineTo(x - 90, piso); ctx.fill(); }
    // Piso de la pista (aserrín) o la red de la cuerda floja
    if (tipo === "cuerda") {
      ctx.fillStyle = "#2a1a12"; ctx.fillRect(0, piso + 120 * esc, W, H);
      ctx.strokeStyle = "rgba(255,255,255,.12)"; for (let x = -(U.cam * esc % 20); x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, piso + 110 * esc); ctx.lineTo(x + 10, piso + 125 * esc); ctx.stroke(); }
      ctx.strokeStyle = "#f1e3c8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, piso + 2); ctx.lineTo(W, piso + 2); ctx.stroke();
      for (let px = Math.floor(U.cam / 500) * 500; px < U.cam + W / esc + 500; px += 500) { ctx.fillStyle = "#8d6e4e"; ctx.fillRect(X(px) - 4, piso, 8, H); }
    } else {
      const pisoG = ctx.createLinearGradient(0, piso, 0, H); pisoG.addColorStop(0, "#c98d4b"); pisoG.addColorStop(1, "#7a4b22"); ctx.fillStyle = pisoG; ctx.fillRect(0, piso, W, H - piso);
      ctx.fillStyle = "#ffd43b"; ctx.fillRect(0, piso, W, 4);
      ctx.fillStyle = "rgba(0,0,0,.12)"; for (let x = -(U.cam * esc % 46); x < W; x += 46) ctx.fillRect(x, piso + 14, 22, 3);
    }
    // Banderines (cada 750) y meta
    for (let cp = CI.CP; cp <= CI.LARGO; cp += CI.CP) { const x = X(cp); if (x < -40 || x > W + 40) continue; ctx.strokeStyle = "#eee"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, piso); ctx.lineTo(x, piso - 70 * esc); ctx.stroke(); ctx.fillStyle = cp >= CI.LARGO ? "#ffd43b" : "#ff4d63"; ctx.beginPath(); ctx.moveTo(x, piso - 70 * esc); ctx.lineTo(x + 26 * esc, piso - 62 * esc); ctx.lineTo(x, piso - 54 * esc); ctx.fill(); ctx.font = `bold ${11 * esc}px system-ui`; ctx.fillStyle = "#fff"; if (cp >= CI.LARGO) ctx.fillText("META", x + 3, piso - 74 * esc); }
    if (tipo === "pelotas") { const xm = X(CI.LARGO - CI.SEGURO); ctx.fillStyle = "#9c36b5"; ctx.fillRect(xm, piso - 8 * esc, X(CI.LARGO + 400) - xm, 10 * esc); ctx.fillStyle = "#ffd43b"; ctx.fillRect(xm, piso - 11 * esc, X(CI.LARGO + 400) - xm, 4 * esc); ctx.font = `bold ${12 * esc}px system-ui`; ctx.fillStyle = "#ffd43b"; ctx.fillText("¡ZONA SEGURA!", xm + 8, piso - 18 * esc); }
    // Obstáculos (los aros se dibujan en dos mitades: atrás y adelante del payaso)
    const obs = Circo.activos(et, C).map(o => ({ o, x: Circo.xObs(o, C) })).filter(q => X(q.x) > -120 && X(q.x) < W + 120);
    for (const { o, x } of obs) {
      if (o.t === "aro") Circo.aro(ctx, X(x), Y(o.cy), o.ri * esc, t, true, o.bonus);
      else if (o.t === "olla") Circo.olla(ctx, X(x), piso, esc, t);
      else if (o.t === "mono") { const my = Circo.yMono(o, C); Circo.mono(ctx, X(x), Y(my), esc, t, o.azul, my > 2); if (o.azul) { ctx.fillStyle = "rgba(77,171,247,.35)"; ctx.beginPath(); ctx.ellipse(X(x), piso + 2, 14 * esc, 4 * esc, 0, 0, 7); ctx.fill(); } }
      else if (o.t === "bola" && !C.usadas.includes(o.id) && o.id !== C.bola) Circo.pelota(ctx, X(x), Y(0), CI.BOLA * esc, o.color, x / CI.BOLA);
    }
    // La pelota que dejaste, rodando hacia atrás
    if (tipo === "pelotas" && C.dejo) { const x = C.dejo.x - 60 * (C.te - C.dejo.t); if (C.te - C.dejo.t < 3) Circo.pelota(ctx, X(x), Y(0), CI.BOLA * esc, "#adb5bd", x / CI.BOLA); }
    // Fantasmas de los demás en la misma etapa
    const otros = Circo.opts.local ? S.extra.jug.filter(j => j !== C && j.cpu && S.extra.actual === 0) : v.jug.filter(j => j.id !== v.me);
    for (const j of otros) {
      if (j.et !== C.et || j.fin != null) continue;
      const o = U.otros[j.id] = U.otros[j.id] || { x: j.x, y: j.y }; o.x += (j.x - o.x) * 0.3; o.y += (j.y - o.y) * 0.3;
      ctx.globalAlpha = 0.38; Circo.payaso(ctx, X(o.x), Y(o.y), esc, j.look, tipo, t, false, (j.m || j.muerto > 0), j.x); ctx.globalAlpha = 1;
      ctx.font = `bold ${10 * esc}px system-ui`; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.textAlign = "center"; ctx.fillText(j.name.replace(/^🤖\s*/, "🤖").slice(0, 10), X(o.x), Y(o.y + (tipo === "leon" ? 120 : 92))); ctx.textAlign = "start";
    }
    // Yo
    if (tipo === "pelotas" && !C.aire && C.bola !== -3 && C.muerto <= 0) Circo.pelota(ctx, X(C.x), Y(0), CI.BOLA * esc, "#f76707", C.x / CI.BOLA);
    Circo.payaso(ctx, X(C.x), Y(C.y), esc, C.look, tipo, t, true, C.muerto > 0, C.x);
    for (const { o, x } of obs) if (o.t === "aro") Circo.aro(ctx, X(x), Y(o.cy), o.ri * esc, t, false, o.bonus);
    // Cartel de etapa y cuenta regresiva
    const cen = byId("ciCentro"), tt = Circo.opts.local ? S.extra.t : now / 1000 - U.off;
    if (cen) {
      const falta = Math.ceil(-tt);
      const txt = v.fase === "cuenta" || tt < 0 ? (falta > 0 ? String(falta) : "¡YA!") : C.muerto > 0 ? (C.vidas > 0 ? (C.porque === "mono" ? "¡El mono!" : C.porque === "cayo" || C.porque === "choca" ? "¡Te caíste!" : "¡Te quemaste!") : "Fin de la función") : U.cartelEt && now - U.cartelEt.t < 2200 ? U.cartelEt.txt : C.fin != null ? (C.completo ? "¡Función completa!" : "Fin de la función") : "";
      if (v.fase === "fin") { cen.hidden = true; return; }
      cen.hidden = !txt; if (cen.textContent !== txt) { cen.textContent = txt; cen.classList.remove("pop"); void cen.offsetWidth; cen.classList.add("pop"); }
    }
  },
  aro(ctx, x, y, r, t, atras, bonus) {
    ctx.save(); ctx.translate(x, y);
    ctx.lineWidth = Math.max(4, r * 0.13);
    ctx.strokeStyle = atras ? "#b8420f" : "#ff922b";
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.28, r, 0, atras ? Math.PI / 2 : -Math.PI / 2, atras ? Math.PI * 1.5 : Math.PI / 2); ctx.stroke();
    if (!atras) {
      // Llamas alrededor
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, fx = Math.cos(a) * r * 0.28, fy = Math.sin(a) * r, fl = 7 + Math.sin(t * 14 + k * 2.1) * 4; ctx.fillStyle = k % 2 ? "#ffd43b" : "#ff6b00"; ctx.beginPath(); ctx.moveTo(fx - 4, fy); ctx.quadraticCurveTo(fx + Math.sin(t * 9 + k) * 3, fy - fl * 2, fx + 4, fy); ctx.fill(); }
      if (bonus) { // Bolsa de monedas colgando del aro
        const s = r * 0.022, g = Math.sin(t * 3) * 0.12;
        ctx.save(); ctx.translate(0, r * 0.05); ctx.rotate(g);
        ctx.strokeStyle = "#f1e3c8"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, -10 * s); ctx.stroke();
        ctx.fillStyle = "#c08a2c"; ctx.beginPath(); ctx.moveTo(-5 * s, -10 * s); ctx.lineTo(5 * s, -10 * s); ctx.quadraticCurveTo(14 * s, 4 * s, 9 * s, 12 * s); ctx.lineTo(-9 * s, 12 * s); ctx.quadraticCurveTo(-14 * s, 4 * s, -5 * s, -10 * s); ctx.fill();
        ctx.fillStyle = "#8a5a14"; ctx.fillRect(-6 * s, -9 * s, 12 * s, 2.5 * s);
        ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.arc(0, 3 * s, 4.5 * s, 0, 7); ctx.fill();
        ctx.fillStyle = "#c08a2c"; ctx.fillRect(-0.8 * s, 0, 1.6 * s, 6 * s);
        ctx.restore();
      }
    }
    ctx.restore();
  },
  /* Mono de la cuerda floja, mirando hacia el payaso; el azul salta */
  mono(ctx, x, y, esc, t, azul, enAire) {
    const piel = azul ? "#3b6fd1" : "#7a4a24", osc = azul ? "#274f9e" : "#5a3418", cara = azul ? "#cfe0ff" : "#e9c29a", p = Math.sin(t * 12) * (enAire ? 0 : 1), s = esc;
    ctx.save(); ctx.translate(x, y);
    // Cola enroscada
    ctx.strokeStyle = osc; ctx.lineWidth = 3 * s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(7 * s, -12 * s); ctx.bezierCurveTo(20 * s, -10 * s, 22 * s, -30 * s, 13 * s, -30 * s); ctx.stroke();
    // Patas
    ctx.strokeStyle = osc; ctx.lineWidth = 4 * s; ctx.beginPath();
    if (enAire) { ctx.moveTo(-3 * s, -8 * s); ctx.lineTo(-7 * s, -3 * s); ctx.moveTo(4 * s, -8 * s); ctx.lineTo(8 * s, -3 * s); }
    else { ctx.moveTo(-3 * s, -8 * s); ctx.lineTo(-4 * s + p * 3 * s, 0); ctx.moveTo(4 * s, -8 * s); ctx.lineTo(4 * s - p * 3 * s, 0); }
    ctx.stroke();
    // Cuerpo y panza
    ctx.fillStyle = piel; ctx.beginPath(); ctx.ellipse(0, -15 * s, 9 * s, 10 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = cara; ctx.beginPath(); ctx.ellipse(-1 * s, -13 * s, 5 * s, 6.5 * s, 0, 0, 7); ctx.fill();
    // Brazos (arriba si salta, balanceándose si camina)
    ctx.strokeStyle = piel; ctx.lineWidth = 3.5 * s; ctx.beginPath();
    if (enAire) { ctx.moveTo(-6 * s, -20 * s); ctx.lineTo(-12 * s, -32 * s); ctx.moveTo(6 * s, -20 * s); ctx.lineTo(12 * s, -32 * s); }
    else { ctx.moveTo(-6 * s, -19 * s); ctx.lineTo(-12 * s, -10 * s - p * 3 * s); ctx.moveTo(6 * s, -19 * s); ctx.lineTo(10 * s, -10 * s + p * 3 * s); }
    ctx.stroke();
    // Cabeza, orejas y cara
    const hy = -31 * s;
    ctx.fillStyle = piel; ctx.beginPath(); ctx.arc(-9 * s, hy, 4 * s, 0, 7); ctx.arc(9 * s, hy, 4 * s, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, hy, 9.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = cara; ctx.beginPath(); ctx.arc(-9 * s, hy, 2 * s, 0, 7); ctx.arc(9 * s, hy, 2 * s, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-1.5 * s, hy + 1.5 * s, 6.5 * s, 6 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#1b1726"; ctx.beginPath(); ctx.arc(-4 * s, hy - 1 * s, 1.5 * s, 0, 7); ctx.arc(1.5 * s, hy - 1 * s, 1.5 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = "#1b1726"; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.arc(-1.5 * s, hy + 3 * s, 2.5 * s, 0.2, Math.PI - 0.2); ctx.stroke();
    // Gorrito de circo
    ctx.fillStyle = azul ? "#ffd43b" : "#ff4d63"; ctx.beginPath(); ctx.moveTo(-4 * s, hy - 8 * s); ctx.lineTo(4 * s, hy - 8 * s); ctx.lineTo(1 * s, hy - 17 * s); ctx.fill();
    ctx.restore();
  },
  olla(ctx, x, piso, esc, t) {
    ctx.fillStyle = "#3b2a1e"; ctx.beginPath(); ctx.moveTo(x - 18 * esc, piso - 30 * esc); ctx.lineTo(x + 18 * esc, piso - 30 * esc); ctx.lineTo(x + 13 * esc, piso); ctx.lineTo(x - 13 * esc, piso); ctx.fill();
    ctx.fillStyle = "#ffd43b"; ctx.fillRect(x - 19 * esc, piso - 33 * esc, 38 * esc, 5 * esc);
    for (let k = 0; k < 5; k++) { const fx = x + (k - 2) * 7 * esc, fl = (12 + Math.sin(t * 13 + k * 1.9) * 6) * esc; ctx.fillStyle = k % 2 ? "#ffd43b" : "#ff6b00"; ctx.beginPath(); ctx.moveTo(fx - 5 * esc, piso - 33 * esc); ctx.quadraticCurveTo(fx, piso - 33 * esc - fl * 1.6, fx + 5 * esc, piso - 33 * esc); ctx.fill(); }
  },
  pelota(ctx, x, y, r, color, giro) {
    ctx.save(); ctx.translate(x, y - r);
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0, r, r, r * 0.22, 0, 0, 7); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.save(); ctx.clip(); ctx.rotate(-giro); ctx.fillStyle = "rgba(255,255,255,.85)"; for (let k = 0; k < 3; k++) { ctx.rotate(Math.PI * 2 / 3); ctx.fillRect(-r, -r * 0.12, r * 2, r * 0.24); } ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.4, r * 0.25, 0, 7); ctx.fill();
    ctx.restore();
  },
  payaso(ctx, x, y, esc, look, tipo, t, yo, muerto, wx) {
    look = look || { color: "#ffc53d", acc: [] };
    const img = Mundo.muneco(look), anda = Math.sin(wx * 0.06);
    ctx.save(); ctx.translate(x, y);
    if (muerto) ctx.rotate(Math.sin(t * 20) * 0.3);
    let alto = 0;
    if (tipo === "leon") {
      // León
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0, 2, 40 * esc, 6 * esc, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#c8781f"; for (const [lx, k] of [[-24, 0], [-14, 1], [16, 1], [26, 0]]) { ctx.save(); ctx.translate(lx * esc, -22 * esc); ctx.rotate((k ? anda : -anda) * 0.5); ctx.fillRect(-4 * esc, 0, 8 * esc, 22 * esc); ctx.restore(); }
      ctx.fillStyle = "#e8a33d"; ctx.beginPath(); ctx.ellipse(0, -34 * esc, 36 * esc, 16 * esc, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#c8781f"; ctx.lineWidth = 4 * esc; ctx.beginPath(); ctx.moveTo(-34 * esc, -38 * esc); ctx.quadraticCurveTo(-50 * esc, -50 * esc, -46 * esc, -28 * esc + anda * 4); ctx.stroke();
      ctx.fillStyle = "#8a4b14"; ctx.beginPath(); ctx.arc(32 * esc, -44 * esc, 17 * esc, 0, 7); ctx.fill();
      ctx.fillStyle = "#e8a33d"; ctx.beginPath(); ctx.arc(36 * esc, -42 * esc, 10 * esc, 0, 7); ctx.fill();
      ctx.fillStyle = "#1b1726"; ctx.beginPath(); ctx.arc(39 * esc, -45 * esc, 2 * esc, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(45 * esc, -40 * esc, 2.5 * esc, 0, 7); ctx.fill();
      alto = 48;
    } else if (tipo === "cuerda") {
      ctx.strokeStyle = "#1b1726"; ctx.lineWidth = 5 * esc; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-5 * esc, -22 * esc); ctx.lineTo(-5 * esc + anda * 6 * esc, 0); ctx.moveTo(5 * esc, -22 * esc); ctx.lineTo(5 * esc - anda * 6 * esc, 0); ctx.stroke();
      // Sombrilla para el equilibrio
      ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14 * esc, -40 * esc); ctx.lineTo(14 * esc, -86 * esc); ctx.stroke();
      ctx.fillStyle = "#ff4d63"; ctx.beginPath(); ctx.arc(14 * esc, -86 * esc, 18 * esc, Math.PI, 0); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(14 * esc, -86 * esc); ctx.arc(14 * esc, -86 * esc, 18 * esc, Math.PI * 1.33, Math.PI * 1.66); ctx.fill();
      alto = 20;
    } else {
      ctx.strokeStyle = "#1b1726"; ctx.lineWidth = 5 * esc; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-6 * esc, -20 * esc); ctx.lineTo(-8 * esc, 0); ctx.moveTo(6 * esc, -20 * esc); ctx.lineTo(8 * esc, 0); ctx.stroke();
      alto = 18;
    }
    // Payaso: tu personaje con gorro y volado
    const by = -alto * esc;
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -19 * esc, by - 46 * esc, 38 * esc, 44 * esc);
    else { ctx.fillStyle = look.color; ctx.beginPath(); ctx.arc(0, by - 24 * esc, 18 * esc, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#fff"; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(k * 7 * esc, by - 6 * esc, 5 * esc, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#ff4d63"; ctx.beginPath(); ctx.moveTo(-9 * esc, by - 44 * esc); ctx.lineTo(9 * esc, by - 44 * esc); ctx.lineTo(2 * esc, by - 64 * esc); ctx.fill();
    ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.arc(2 * esc, by - 65 * esc, 3.5 * esc, 0, 7); ctx.fill();
    if (yo && !muerto) { ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.moveTo(-5 * esc, by - 76 * esc); ctx.lineTo(5 * esc, by - 76 * esc); ctx.lineTo(0, by - 69 * esc); ctx.fill(); }
    ctx.restore();
  },
  hud() {
    const v = Circo.v, U = UI.ci; if (!U) return;
    const C = U.yo, top = byId("ciTop");
    if (top) {
      const lider = v.jug.slice().sort((a, b) => b.pts - a.pts)[0];
      top.innerHTML = `<span class="ar-chip yo"><small>Puntaje</small> <b>${C.pts}</b></span><span class="ar-chip ci-vidas">${Array.from({ length: CI.VIDAS }, (_, k) => `<i class="${k < C.vidas ? "on" : ""}"></i>`).join("")}</span><span class="ar-chip"><b>Etapa ${C.et + 1}/3</b></span>${lider && lider.id !== v.me && v.jug.length > 1 ? `<span class="ar-chip"><small>Primero</small> <b>${esc(lider.name.replace(/^🤖\s*/, ""))} ${lider.pts}</b></span>` : ""}
        <div class="ci-barra"><i style="width:${Math.min(100, ((C.et * CI.LARGO + Math.min(CI.LARGO, C.x)) / (3 * CI.LARGO)) * 100)}%"></i></div>`;
    }
    const fin = byId("ciFin");
    if (fin) {
      fin.hidden = v.fase !== "fin";
      if (v.fase === "fin" && !fin.dataset.listo) {
        fin.dataset.listo = 1;
        const orden = v.jug.slice().sort((a, b) => a.puesto - b.puesto), yo = v.jug.find(j => j.id === v.me);
        fin.innerHTML = Turnero.tablaFin(v, orden.map(j => ({ puesto: j.puesto, name: j.name, yo: j.id === v.me, txt: `${j.pts} de puntaje · ${j.completo ? "función completa" : `llegó a la etapa ${j.et + 1}`}` })), yo && (v.jug.length > 1 ? yo.puesto === 1 : yo.completo) ? "¡La estrella del circo!" : "Fin de la función", Circo.textoCuenta(v, yo), Circo.send, Circo.opts);
        Turnero.conectarFin(Circo.send, Circo.opts);
      }
    }
  }
};
EXTRA.circo = Circo;
PANTALLAS.circoIntro = () => Turnero.intro(Circo);
PANTALLAS.circo = () => Circo.pantallaLocal();
