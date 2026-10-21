/* Bowling: 10 cuadros (o 5 en la partida corta), con strikes, spares y el décimo cuadro con tiros extra.
   - Se tira deslizando la bola hacia arriba: dónde arrancás, para dónde y qué tan rápido deslizás, y la curva
     del dedo le da efecto (la bola engancha al final de la pista, como en el bowling de verdad).
   - La física (bola, pinos que chocan entre sí y caen) la calcula quien manda (este teléfono o el anfitrión)
     y graba el recorrido; todos ven la misma animación.
   - Medidas reales: pista de 18,29 m hasta el primer pino, 1,05 m de ancho, pinos a 30,5 cm. */
const BW = {
  ANCHO: 1.0541, CANAL: 0.235, LARGO: 18.29, FONDO: 19.6, RB: 0.109, RP: 0.061, MB: 7, MP: 1.55,
  SEP: 0.3048, PASO: 1 / 240, CUADRO: 1 / 20,
  // Ajustes de los choques: radio de un pino caído, rebote bola-pino y pino-pino, frenado, cuándo cae y dispersión
  RC: 0.1, EBP: 0.7, EPP: 0.55, FRC: 3.2, CAE: 0.3, DISP: 0.3
};
BW.PINOS = (() => { const p = []; for (let f = 0; f < 4; f++) for (let k = 0; k <= f; k++) p.push({ x: (k - f / 2) * BW.SEP, z: BW.LARGO + f * BW.SEP * 0.866 }); return p; })();

const Bowling = {
  clave: "bowling", nombre: "Bowling", boton: "🎳 ¡A tirar!",
  descripcion: "Deslizá la bola hacia arriba para tirar: la dirección y la velocidad del dedo deciden el tiro, y si lo curvás le das efecto. 10 cuadros con strikes y spares.",
  cfg() { return Turnero.cfg("bowling", { cuadros: 10 }); },
  arte() { return MenuArte.bowling(); },
  opciones(c) { return `<span class="label">Largo de la partida</span><div class="seg">${[[10, "10 cuadros"], [5, "Corta (5)"]].map(([k, t]) => `<button aria-pressed="${c.cuadros === k}" data-bwc="${k}">${t}</button>`).join("")}</div>`; },
  conectarOpciones(c, guardar) { app.querySelectorAll("[data-bwc]").forEach(b => b.onclick = () => { c.cuadros = +b.dataset.bwc; guardar(); }); },
  empezarLocal() { Turnero.empezarLocal(Bowling); },
  empezarOn(R) { return Turnero.empezarOn(Bowling, R); },
  actOn(R, pid, a) { Turnero.actOn(Bowling, R, pid, a); },
  lobby(v, H) { const c = v.exCfg.bowling; return `<p class="summary">Por turnos: cada uno tira su cuadro desde su teléfono y todos ven el tiro. ${c.cuadros === 5 ? "Partida corta de 5 cuadros." : "10 cuadros."}${c.mesa > v.players.length ? ` Se suman ${Math.min(6, c.mesa) - v.players.length} bot${Math.min(6, c.mesa) - v.players.length > 1 ? "s" : ""}.` : ""}</p>
    ${H ? `<div class="seg">${[[10, "10 cuadros"], [5, "Corta (5)"]].map(([k, t]) => `<button aria-pressed="${c.cuadros === k}" data-exopc="bowling:cuadros:${k}">${t}</button>`).join("")}</div>` : ""}${Turnero.lobbyBots("bowling", c, H)}`; },
  lobbyInfo: ["Bowling", "🎳", "1 a 6"],

  crear(jug, cfg) {
    return { id: Turnero.nuevoId("bw"), cuadros: cfg.cuadros === 5 ? 5 : 10, fase: "tiro", turno: 0, mov: 0, anim: null, nAnim: 0,
      jug: jug.map(j => ({ ...j, tiros: [], pinos: Array(10).fill(true), cuadro: 0, enCuadro: 0, strikes: 0, spares: 0, seguidos: 0, turkey: false, zurdo: !!j.cpu && Math.random() < 0.3 })) };
  },
  validar(p) {
    const n = (v, a, b, d) => Math.max(a, Math.min(b, Number.isFinite(+v) ? +v : d));
    return { x: n(p.x, -0.45, 0.45, 0), a: n(p.a, -0.12, 0.12, 0), v: n(p.v, 3.5, 11, 7), e: n(p.e, -1, 1, 0) };
  },

  /* ---------- Física ---------- */
  simular(p, parados) {
    const B = { x: p.x, z: 0.4, vx: Math.sin(p.a) * p.v, vz: Math.cos(p.a) * p.v, canal: false };
    const P = BW.PINOS.map((q, i) => ({ x: q.x, z: q.z, vx: 0, vz: 0, en: parados[i], cae: false, t: -1 }));
    const cuadros = [], borde = BW.ANCHO / 2;
    let t = 0, quieto = 0, cuadro = 0;
    const foto = () => cuadros.push([Math.round(B.x * 1000), Math.round(B.z * 1000), ...P.flatMap(q => q.en ? [Math.round(q.x * 1000), Math.round(q.z * 1000), q.cae ? 1 : 0] : [0, 0, 2])]);
    foto();
    while (t < 7.5) {
      t += BW.PASO;
      // Bola: frena un poco y engancha más en el último tercio (según el efecto)
      if (!B.canal && B.z < BW.LARGO + 0.6) {
        const gancho = Math.pow(Math.min(1, Math.max(0, (B.z - 6) / 10)), 1.6);
        B.vx += p.e * 1.15 * gancho * BW.PASO;
      }
      B.vz -= 0.18 * BW.PASO;
      B.x += B.vx * BW.PASO; B.z += B.vz * BW.PASO;
      if (!B.canal && Math.abs(B.x) > borde && B.z < BW.LARGO - 0.3) { B.canal = true; B.vx = 0; B.x = Math.sign(B.x) * (borde + BW.CANAL * 0.45); }
      // Choques bola → pino y pino → pino
      for (const q of P) {
        if (!q.en) continue;
        if (!B.canal || B.z > BW.LARGO - 0.4) {
          const dx = q.x - B.x, dz = q.z - B.z, d = Math.hypot(dx, dz), min = BW.RB + (q.cae ? BW.RC : BW.RP);
          if (d < min && d > 0) Bowling.chocar(B, q, dx / d, dz / d, BW.MB, BW.MP, min - d, BW.EBP);
        }
      }
      for (let i = 0; i < P.length; i++) for (let k = i + 1; k < P.length; k++) {
        const a = P[i], b = P[k]; if (!a.en || !b.en) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = (a.cae ? BW.RC : BW.RP) + (b.cae ? BW.RC : BW.RP);
        if (d < min && d > 0) Bowling.chocar(a, b, dx / d, dz / d, BW.MP, BW.MP, min - d, BW.EPP);
      }
      let mov = Math.hypot(B.vx, B.vz) > 0.2 && B.z < BW.FONDO ? 1 : 0;
      for (const q of P) {
        if (!q.en) continue;
        const sp = Math.hypot(q.vx, q.vz);
        if (!q.cae && sp > BW.CAE) { q.cae = true; q.t = t; }
        q.x += q.vx * BW.PASO; q.z += q.vz * BW.PASO;
        const fr = Math.exp(-(q.cae ? BW.FRC : 6) * BW.PASO); q.vx *= fr; q.vz *= fr;
        if (Math.abs(q.x) > borde + 0.05 || q.z > BW.FONDO + 0.3) { if (!q.cae) { q.cae = true; q.t = t; } if (Math.abs(q.x) > borde + BW.CANAL || q.z > BW.FONDO + 0.6) q.en = false; }
        if (sp > 0.05) mov = 1;
      }
      if (B.z > BW.FONDO + 0.5) { B.vx = B.vz = 0; }
      quieto = mov ? 0 : quieto + BW.PASO;
      if (quieto > 0.4 || (B.z > BW.FONDO && t > 0 && P.every(q => !q.en || Math.hypot(q.vx, q.vz) < 0.03))) break;
      if ((cuadro += BW.PASO) >= BW.CUADRO - 1e-9) { cuadro = 0; foto(); }
    }
    foto();
    const tumbados = P.map((q, i) => parados[i] && (q.cae || !q.en));
    return { cuadros, tumbados, canal: B.canal, dur: Math.round(cuadros.length * BW.CUADRO * 1000) };
  },
  /* Choque elástico entre dos círculos (con algo de pérdida) */
  chocar(a, b, nx, nz, ma, mb, pen, e) {
    const vr = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    const tot = ma + mb;
    a.x -= nx * pen * mb / tot; a.z -= nz * pen * mb / tot; b.x += nx * pen * ma / tot; b.z += nz * pen * ma / tot;
    if (vr >= 0) return;
    const j = -(1 + e) * vr / (1 / ma + 1 / mb);
    a.vx -= j * nx / ma; a.vz -= j * nz / ma; b.vx += j * nx / mb; b.vz += j * nz / mb;
    // Un poco de dispersión para que los pinos no salgan en línea perfecta
    const g = (Math.random() - 0.5) * BW.DISP * Math.abs(j / mb);
    b.vx += -nz * g; b.vz += nx * g;
  },

  /* ---------- Reglas ---------- */
  tirar(s, i, p) {
    const J = s.jug[i], antes = J.pinos.slice(), fresco = antes.every(Boolean), sim = Bowling.simular(p, antes);
    const n = sim.tumbados.filter(Boolean).length;
    J.tiros.push(n);
    J.pinos = antes.map((x, k) => x && !sim.tumbados[k]);
    const quedan = J.pinos.filter(Boolean).length;
    let marca = n === 0 ? (sim.canal ? "canal" : "cero") : "pinos";
    if (fresco && n === 10) { marca = "strike"; J.strikes++; J.seguidos++; if (J.seguidos >= 3) J.turkey = true; }
    else { J.seguidos = 0; if (!fresco && quedan === 0) { marca = "spare"; J.spares++; } }
    J.enCuadro++;
    s.anim = { n: ++s.nAnim, quien: i, cuadros: sim.cuadros, tumbados: n, marca, dur: sim.dur, antes };
    s.fase = "anim";
  },
  /* Después de la animación: ¿sigue tirando, pasa al otro o terminó? */
  seguir(s) {
    const J = s.jug[s.turno], ultimo = J.cuadro === s.cuadros - 1, r = J.enCuadro, tt = J.tiros.slice(-r);
    let termino;
    if (!ultimo) termino = r >= 2 || J.pinos.every(x => !x);
    else {
      termino = r >= 3 || (r === 2 && tt[0] !== 10 && tt[0] + tt[1] < 10);
      // Décimo cuadro: después de un strike o un spare se vuelven a parar los diez
      if (!termino && J.pinos.every(x => !x)) J.pinos = Array(10).fill(true);
    }
    if (termino) {
      J.cuadro++; J.enCuadro = 0; J.pinos = Array(10).fill(true);
      const sig = Bowling.siguiente(s);
      if (sig < 0) { s.fase = "fin"; s.anim = null; Bowling.ordenar(s); return; }
      s.turno = sig;
    }
    s.fase = "tiro"; s.anim = null;
  },
  siguiente(s) {
    for (let k = 1; k <= s.jug.length; k++) { const i = (s.turno + k) % s.jug.length; if (s.jug[i].cuadro < s.cuadros) return i; }
    return -1;
  },
  /* Arma los cuadros a partir de la lista de tiros y calcula el puntaje con los bonus */
  marcador(J, n) {
    const t = J.tiros, cuadros = []; let k = 0;
    for (let f = 0; f < n && k < t.length; f++) {
      if (f < n - 1) { const c = t[k] === 10 ? { tiros: [10], k } : { tiros: t.slice(k, k + 2), k }; k += c.tiros[0] === 10 ? 1 : 2; cuadros.push(c); }
      else { cuadros.push({ tiros: t.slice(k, k + 3), k, ultimo: true }); k += 3; }
    }
    let acum = 0;
    for (const c of cuadros) {
      const a = t[c.k], b = t[c.k + 1], d = t[c.k + 2];
      if (c.ultimo) c.pts = Bowling.decimoCompleto(c.tiros) ? c.tiros.reduce((x, y) => x + y, 0) : null;
      else if (a === 10) c.pts = b != null && d != null ? 10 + b + d : null;
      else if (b != null && a + b === 10) c.pts = d != null ? 10 + d : null;
      else c.pts = b != null ? a + b : null;
      if (c.pts != null && acum != null) { acum += c.pts; c.acum = acum; } else acum = null;
    }
    return { cuadros };
  },
  decimoCompleto(tt) { return tt.length === 3 || (tt.length === 2 && tt[0] !== 10 && tt[0] + tt[1] < 10); },
  /* Puntaje que se ve (los cuadros con bonus pendiente suman lo que ya se sabe) */
  puntaje(s, J) {
    return Bowling.marcador(J, s.cuadros).cuadros.reduce((x, c) => x + (c.pts != null ? c.pts : c.tiros.reduce((a, b) => a + b, 0)), 0);
  },
  ordenar(s) {
    const o = s.jug.slice().sort((a, b) => Bowling.puntaje(s, b) - Bowling.puntaje(s, a));
    o.forEach((j, k) => j.puesto = k > 0 && Bowling.puntaje(s, j) === Bowling.puntaje(s, o[k - 1]) ? o[k - 1].puesto : k + 1);
  },
  /* X, / y números para la planilla */
  marcas(tt, ultimo) {
    const d = n => n === 0 ? "–" : String(n);
    if (!ultimo) return tt[0] === 10 ? "X" : tt.map((n, k) => k === 1 && tt[0] + n === 10 ? "/" : d(n)).join("");
    let out = "", fresco = true, prev = 0;
    for (const n of tt) {
      if (fresco && n === 10) out += "X";
      else if (!fresco && prev + n === 10) { out += "/"; fresco = true; }
      else { out += d(n); if (fresco) { fresco = false; prev = n; } else fresco = true; }
    }
    return out;
  },

  /* ---------- Bots ---------- */
  /* Dónde cruza la bola la línea del primer pino (solo la bola, sin pinos: es rápido) */
  llegada(p) {
    let x = p.x, z = 0.4, vx = Math.sin(p.a) * p.v, vz = Math.cos(p.a) * p.v;
    while (z < BW.LARGO) { const g = Math.pow(Math.min(1, Math.max(0, (z - 6) / 10)), 1.6); vx += p.e * 1.15 * g * BW.PASO * 4; vz -= 0.18 * BW.PASO * 4; x += vx * BW.PASO * 4; z += vz * BW.PASO * 4; if (Math.abs(x) > BW.ANCHO / 2) return x; }
    return x;
  },
  /* Ángulo para que la bola llegue a xObj (búsqueda por mitades) */
  apuntar(x0, v, e, xObj) {
    let lo = -0.12, hi = 0.12;
    for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (Bowling.llegada({ x: x0, a: m, v, e }) < xObj) lo = m; else hi = m; }
    return (lo + hi) / 2;
  },
  bot(s, i) {
    const J = s.jug[i], h = Turnero.habilidad("bowling", J.nivel), parados = BW.PINOS.filter((_, k) => J.pinos[k]);
    const lado = J.zurdo ? -1 : 1, err = 1 - h;
    let x0, e, v, obj;
    if (parados.length === 10) { obj = lado * 0.085; e = -lado * (0.3 + 0.4 * h); x0 = lado * 0.28; v = 7.4; }
    else {
      // Segundo tiro: al pino más adelantado del grupo que queda (pegarle de frente los arrastra a todos)
      const delante = parados.reduce((a, q) => q.z < a.z ? q : a, parados[0]), cx = parados.reduce((a, q) => a + q.x, 0) / parados.length;
      obj = parados.length === 1 ? delante.x : delante.x * 0.6 + cx * 0.4; e = 0; x0 = Math.max(-0.35, Math.min(0.35, -obj * 0.6)); v = 7.8;
    }
    const a = Bowling.apuntar(x0, v, e, obj + Turnero.gauss() * (0.016 + 0.25 * Math.pow(err, 1.3)));
    return Bowling.validar({ x: x0, a, v: v + Turnero.gauss() * 0.4 * err, e });
  },

  resultado(s, pid) {
    if (!s || s.fase !== "fin") return null;
    const J = s.jug.find(j => j.id === pid); if (!J) return null;
    const pts = Bowling.puntaje(s, J);
    return { juego: "bowling", id: s.id, gano: s.jug.length > 1 && J.puesto === 1, puesto: J.puesto, n: s.jug.length, vsCompu: s.jug.every(j => j === J || j.cpu), total: pts, cuadros: s.cuadros, strikes: J.strikes, spares: J.spares, turkey: J.turkey };
  },
  view(s, pid) {
    return { game: "bowling", id: s.id, me: pid, yo: Turnero.idx(s, pid), fase: s.fase, turno: s.turno, cuadros: s.cuadros, anim: s.anim,
      jug: s.jug.map(j => ({ id: j.id, name: j.name, cpu: !!j.cpu, look: j.look, tiros: j.tiros, pinos: j.pinos, cuadro: j.cuadro, enCuadro: j.enCuadro, puesto: j.puesto, strikes: j.strikes })) };
  },
  turnoInfo(v) { return Turnero.turno(v, "tirar"); },

  /* ---------- Pantalla ---------- */
  render(v, send, opts) {
    Bowling.v = v; Bowling.send = send; Bowling.opts = opts;
    if (!UI.bw || UI.bw.id !== v.id || !byId("bwCanvas")) Bowling.montar(v);
    // Animación nueva
    if (v.anim && UI.bw.anim !== v.anim.n) { UI.bw.anim = v.anim.n; UI.bw.t0 = performance.now(); UI.bw.cartel = null; }
    if (!v.anim) UI.bw.anim = null;
    Bowling.hud();
  },
  montar(v) {
    Bowling.parar();
    document.body.classList.add("en-nave");
    app.innerHTML = `<div class="nave bowling" id="bwRoot"><canvas id="bwCanvas"></canvas>
      <div class="bw-top" id="bwTop"></div><div class="ar-centro bw-cartel" id="bwCartel" hidden></div>
      <div class="bw-ayuda" id="bwAyuda"></div>
      <button class="nv-salir" id="bwSalir" aria-label="Salir">✕</button>
      <div class="ar-fin" id="bwFin" hidden></div></div>`;
    UI.bw = { id: v.id, anim: null, t0: 0, x: 0, gesto: null, cam: 0 };
    byId("bwSalir").onclick = () => { if (Bowling.opts.local) { if (Bowling.v.fase === "fin" || confirm("¿Salir del bowling?")) Bowling.send({ t: "salir" }); } else { UI.confirmSalir = true; render(); } };
    Bowling.gestos(byId("bwCanvas"));
    const paso = now => { Bowling.raf = requestAnimationFrame(paso); const cv = byId("bwCanvas"); if (!cv || !UI.bw) { Bowling.parar(); return; } dibujarSeguro(cv, () => Bowling.dibujar(cv, now)); };
    Bowling.raf = requestAnimationFrame(paso);
  },
  parar() { cancelAnimationFrame(Bowling.raf); Bowling.raf = null; if (UI.bw) UI.bw = null; document.body.classList.remove("en-nave"); const r = byId("bwRoot"); if (r) r.remove(); },
  miTurno() { const v = Bowling.v; return v && v.fase === "tiro" && v.jug[v.turno] && v.jug[v.turno].id === v.me && !v.jug[v.turno].cpu; },

  /* Deslizar: primero de costado para ubicarse, después hacia arriba para tirar */
  gestos(cv) {
    const pos = e => { const r = cv.getBoundingClientRect(), t = e.changedTouches ? e.changedTouches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top, t: performance.now() }; };
    const inicio = e => {
      if (!Bowling.miTurno() || !UI.bw) return;
      const p = pos(e); UI.bw.gesto = { pts: [p], x0: UI.bw.x, tirando: false };
      if (e.cancelable) e.preventDefault();
    };
    const mover = e => {
      const G = UI.bw && UI.bw.gesto; if (!G) return;
      const p = pos(e), a = G.pts[0], esc = cv.clientWidth / 1.7;
      if (!G.tirando && Math.abs(p.y - a.y) > 26 && a.y - p.y > Math.abs(p.x - a.x) * 0.8) { G.tirando = true; G.pts = [G.pts[G.pts.length - 1]]; }
      if (!G.tirando) UI.bw.x = Math.max(-0.42, Math.min(0.42, G.x0 + (p.x - a.x) / esc));
      G.pts.push(p); if (G.pts.length > 60) G.pts.splice(1, 1);
      if (e.cancelable) e.preventDefault();
    };
    const fin = e => {
      const G = UI.bw && UI.bw.gesto; if (!G) return; UI.bw.gesto = null;
      if (!G.tirando || G.pts.length < 3) return;
      const a = G.pts[0], b = G.pts[G.pts.length - 1], dy = a.y - b.y, dx = b.x - a.x, dt = Math.max(40, b.t - a.t);
      if (dy < 40) return;
      // Velocidad del dedo → velocidad de la bola; dirección → ángulo; panza de la curva → efecto
      const vel = Math.hypot(dx, dy) / dt;
      let panza = 0; const L = Math.hypot(dx, dy) || 1;
      for (const q of G.pts) { const c = ((q.x - a.x) * dy - (a.y - q.y) * dx) / L; if (Math.abs(c) > Math.abs(panza)) panza = c; }
      const p = { x: UI.bw.x, a: Math.atan2(dx, dy) * 0.09, v: 3.8 + vel * 3.4, e: Math.max(-1, Math.min(1, -panza / 70)) };
      Bowling.send({ t: "tiro", p });
    };
    cv.addEventListener("touchstart", inicio, { passive: false }); cv.addEventListener("touchmove", mover, { passive: false }); cv.addEventListener("touchend", fin); cv.addEventListener("touchcancel", () => { if (UI.bw) UI.bw.gesto = null; });
    cv.addEventListener("mousedown", inicio); window.addEventListener("mousemove", e => { if (UI.bw && UI.bw.gesto) mover(e); }); window.addEventListener("mouseup", e => { if (UI.bw && UI.bw.gesto) fin(e); });
  },

  /* Cuadro de la animación en el instante actual */
  estadoAnim(now) {
    const v = Bowling.v, U = UI.bw, A = v.anim;
    if (!A) return null;
    const t = Math.max(0, (now - U.t0) / 1000), k = Math.min(A.cuadros.length - 1, t / BW.CUADRO), i = Math.floor(k), f = k - i;
    const c0 = A.cuadros[i], c1 = A.cuadros[Math.min(A.cuadros.length - 1, i + 1)];
    const L = (o) => (c0[o] + (c1[o] - c0[o]) * f) / 1000;
    const pinos = BW.PINOS.map((_, n) => { const o = 2 + n * 3; return c0[o + 2] === 2 ? null : { x: L(o), z: L(o + 1), cae: c1[o + 2] === 1 || c0[o + 2] === 1 }; });
    return { t, ball: { x: L(0), z: L(1) }, pinos, fin: t >= A.dur / 1000 };
  },

  dibujar(cv, now) {
    const v = Bowling.v, U = UI.bw, dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const J = v.jug[v.anim ? v.anim.quien : v.turno] || v.jug[0], st = Bowling.estadoAnim(now);
    // Cámara: sigue a la bola durante el tiro
    const objetivo = st ? Math.max(0, Math.min(11, st.ball.z - 5)) : 0;
    U.cam += (objetivo - U.cam) * 0.08;
    // Perspectiva: lo cercano abajo (86% de la pantalla) y el fondo de la pista arriba (22%)
    const cam = U.cam, D = 9, B0 = Math.min(W, H * 0.62) * 4.13, A0 = H * 8.4, yInf = -H * 0.073;
    const P = z => 1 / (Math.max(0.3, z - cam) + D), X = (x, z) => W / 2 + x * B0 * P(z);
    const ySuelo = z => yInf + A0 * P(z);
    // Fondo: la pared del fondo y la oscuridad
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#120e1c"); g.addColorStop(1, "#231a33"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const zf = BW.FONDO + 1.2, yF = ySuelo(zf);
    // Cortina del fondo con luces
    ctx.fillStyle = "#1a1530"; ctx.fillRect(0, 0, W, yF);
    for (let k = 0; k < 9; k++) { const x = (k + 0.5) * W / 9; ctx.fillStyle = `hsla(${(k * 40 + now / 30) % 360},90%,60%,.55)`; ctx.beginPath(); ctx.arc(x, Math.max(14, yF - 40), 4, 0, 7); ctx.fill(); }
    ctx.font = `bold ${Math.max(14, W * 0.05)}px ${getComputedStyle(document.body).getPropertyValue("--display") || "sans-serif"}`; ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,197,61,.85)"; ctx.shadowColor = "#ffc53d"; ctx.shadowBlur = 16;
    if (yF - 70 > 10) ctx.fillText("MESA LOCA BOWL", W / 2, yF - 62); ctx.shadowBlur = 0; ctx.textAlign = "start";
    // Pista: canales, tablas de madera, flechas
    const z0 = cam + 0.01, z1 = zf, mitad = BW.ANCHO / 2, canal = mitad + BW.CANAL;
    const quad = (xa, xb, za, zb, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(X(xa, za), ySuelo(za)); ctx.lineTo(X(xb, za), ySuelo(za)); ctx.lineTo(X(xb, zb), ySuelo(zb)); ctx.lineTo(X(xa, zb), ySuelo(zb)); ctx.closePath(); ctx.fill(); };
    quad(-canal - 0.6, canal + 0.6, z0, z1, "#2b2240");
    quad(-canal, -mitad, z0, z1, "#3d4552"); quad(mitad, canal, z0, z1, "#3d4552");
    const madera = ctx.createLinearGradient(0, ySuelo(z1), 0, ySuelo(z0)); madera.addColorStop(0, "#b77b45"); madera.addColorStop(1, "#e7b071");
    quad(-mitad, mitad, z0, z1, madera);
    ctx.strokeStyle = "rgba(120,70,30,.28)"; ctx.lineWidth = 1;
    for (let k = 1; k < 39; k++) { const x = -mitad + k * BW.ANCHO / 39; ctx.beginPath(); ctx.moveTo(X(x, z0), ySuelo(z0)); ctx.lineTo(X(x, z1), ySuelo(z1)); ctx.stroke(); }
    // Brillo del aceite
    ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.beginPath(); ctx.moveTo(X(-0.25, z0), ySuelo(z0)); ctx.lineTo(X(0.25, z0), ySuelo(z0)); ctx.lineTo(X(0.08, 12), ySuelo(12)); ctx.lineTo(X(-0.08, 12), ySuelo(12)); ctx.fill();
    // Flechas guía (a 4,5 m) y puntos (a 2 m)
    for (let k = -3; k <= 3; k++) { const x = k * 5 * BW.ANCHO / 39, z = 4.6 + Math.abs(k) * 0.3; if (z < cam) continue; ctx.fillStyle = "#6b3a14"; ctx.beginPath(); ctx.moveTo(X(x, z + 0.3), ySuelo(z + 0.3)); ctx.lineTo(X(x - 0.025, z), ySuelo(z)); ctx.lineTo(X(x + 0.025, z), ySuelo(z)); ctx.fill(); }
    // Zona de aproximación (antes de la línea de tiro)
    const yLinea = ySuelo(Math.max(cam + 0.01, 0.02));
    if (yLinea < H) { const ap = ctx.createLinearGradient(0, yLinea, 0, H); ap.addColorStop(0, "#c98d55"); ap.addColorStop(1, "#7a4b22"); ctx.fillStyle = ap; ctx.fillRect(0, yLinea, W, H - yLinea); ctx.fillStyle = "rgba(0,0,0,.18)"; for (let k = 1; k < 8; k++) ctx.fillRect(0, yLinea + (H - yLinea) * k / 8, W, 1); for (const dx of [-0.4, -0.2, 0, 0.2, 0.4]) { ctx.fillStyle = "#5c3a1e"; ctx.beginPath(); ctx.arc(W / 2 + dx * W * 0.6, yLinea + (H - yLinea) * 0.25, 3, 0, 7); ctx.fill(); } }
    if (cam < 0.5) { ctx.fillStyle = "#c0392b"; ctx.fillRect(X(-mitad, 0.02), ySuelo(0.02) - 2, X(mitad, 0.02) - X(-mitad, 0.02), 3); }
    // Pinos y bola, de atrás para adelante
    const objs = [];
    const pinosVer = st ? st.pinos : BW.PINOS.map((q, k) => J.pinos[k] ? { x: q.x, z: q.z, cae: false } : null);
    pinosVer.forEach(q => { if (q) objs.push({ z: q.z, f: () => Bowling.pino(ctx, X(q.x, q.z), ySuelo(q.z), B0 * P(q.z), q.cae, q.x) }); });
    const bola = st ? st.ball : { x: U.x, z: 0.45 };
    if (bola.z < BW.FONDO + 0.4) objs.push({ z: bola.z, f: () => Bowling.bola(ctx, X(bola.x, bola.z), ySuelo(bola.z), B0 * P(bola.z) * BW.RB, J.look, bola.z) });
    objs.sort((a, b) => b.z - a.z).forEach(o => o.f());
    // Guía mientras deslizás
    const G = U.gesto;
    if (!st && G && G.tirando && G.pts.length > 1) { ctx.strokeStyle = "rgba(255,212,59,.85)"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); G.pts.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
    // Cartel del resultado
    if (st && st.fin && !U.cartel && v.anim) { U.cartel = v.anim.marca === "strike" ? "¡STRIKE! 🎳" : v.anim.marca === "spare" ? "¡SPARE!" : v.anim.marca === "canal" ? "Al canal…" : v.anim.tumbados ? `${v.anim.tumbados} pino${v.anim.tumbados > 1 ? "s" : ""}` : "Ninguno"; const c = byId("bwCartel"); if (c) { c.textContent = U.cartel; c.hidden = false; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); c.dataset.m = v.anim.marca; } if (v.anim.marca === "strike" && typeof Sonido !== "undefined") Sonido.sfx("victoria"); }
    if (!v.anim) { const c = byId("bwCartel"); if (c && !c.hidden) c.hidden = true; }
  },
  pino(ctx, x, y, esc, cae, px) {
    const h = esc * 0.38, w = esc * 0.12;
    ctx.save(); ctx.translate(x, y);
    if (cae) { ctx.rotate(px > 0 ? 1.35 : -1.35); ctx.globalAlpha = 0.9; ctx.translate(0, -w * 0.4); }
    ctx.fillStyle = "rgba(0,0,0,.25)"; if (!cae) { ctx.beginPath(); ctx.ellipse(0, 0, w * 0.9, w * 0.32, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#fbf7ee"; ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0); ctx.bezierCurveTo(-w * 0.75, -h * 0.35, -w * 0.62, -h * 0.5, -w * 0.25, -h * 0.66); ctx.bezierCurveTo(-w * 0.18, -h * 0.72, -w * 0.42, -h * 0.9, -w * 0.25, -h * 0.98);
    ctx.bezierCurveTo(-w * 0.1, -h * 1.04, w * 0.1, -h * 1.04, w * 0.25, -h * 0.98); ctx.bezierCurveTo(w * 0.42, -h * 0.9, w * 0.18, -h * 0.72, w * 0.25, -h * 0.66); ctx.bezierCurveTo(w * 0.62, -h * 0.5, w * 0.75, -h * 0.35, w * 0.38, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e03131"; ctx.fillRect(-w * 0.28, -h * 0.76, w * 0.56, h * 0.035); ctx.fillRect(-w * 0.3, -h * 0.71, w * 0.6, h * 0.035);
    ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.beginPath(); ctx.ellipse(w * 0.2, -h * 0.35, w * 0.16, h * 0.25, 0, 0, 7); ctx.fill();
    ctx.restore();
  },
  bola(ctx, x, y, r, look, z) {
    const col = (look && look.color) || "#748ffc";
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(x, y, r * 1.05, r * 0.35, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 1.35, r * 0.1, x, y - r, r); g.addColorStop(0, "#fff"); g.addColorStop(0.25, col); g.addColorStop(1, oscurecer(col));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - r, r, 0, 7); ctx.fill();
    // Agujeros que giran
    const a = z * 9; ctx.fillStyle = "rgba(0,0,0,.55)";
    for (const [dx, dy] of [[-0.25, -0.2], [0.05, -0.32], [-0.05, 0.05]]) { const yy = ((dy + a) % 1.4 + 1.4) % 1.4 - 0.7; if (Math.abs(yy) < 0.55) { ctx.beginPath(); ctx.ellipse(x + dx * r, y - r + yy * r, r * 0.09, r * 0.09 * Math.cos(yy * 2), 0, 0, 7); ctx.fill(); } }
  },

  hud() {
    const v = Bowling.v; if (!UI.bw) return;
    const top = byId("bwTop"), tira = v.jug[v.turno];
    if (top) {
      const fila = J => { const m = Bowling.marcador(J, v.cuadros);
        return `<div class="bw-fila ${J === tira && v.fase !== "fin" ? "on" : ""} ${J.id === v.me ? "yo" : ""}"><b>${esc(J.name.replace(/^🤖\s*/, "🤖 ").slice(0, 12))}</b><div class="bw-cuadros">${Array.from({ length: v.cuadros }, (_, f) => { const c = m.cuadros[f];
          const marca = c ? Bowling.marcas(c.tiros, f === v.cuadros - 1) : "";
          return `<span class="${f === J.cuadro && J === tira ? "act" : ""}"><i>${marca}</i><em>${c && c.acum != null ? c.acum : ""}</em></span>`; }).join("")}</div><strong>${Bowling.puntaje({ cuadros: v.cuadros }, J)}</strong></div>`; };
      top.innerHTML = `<div class="bw-tabla">${v.jug.map(fila).join("")}</div>`;
    }
    const ay = byId("bwAyuda");
    if (ay) { const mio = Bowling.miTurno(); ay.hidden = v.fase === "fin"; ay.innerHTML = v.fase === "anim" ? "" : mio ? `🎳 <b>Tu turno</b> · cuadro ${tira.cuadro + 1}, tiro ${tira.enCuadro + 1}<br><small>Arrastrá de costado para ubicarte y deslizá hacia arriba para tirar. Curvá el dedo para darle efecto.</small>` : `⏳ Tira <b>${esc(tira.name.replace(/^🤖\s*/, ""))}</b>…`; }
    const fin = byId("bwFin");
    if (fin) {
      fin.hidden = v.fase !== "fin";
      if (v.fase === "fin" && !fin.dataset.listo) {
        fin.dataset.listo = 1;
        const orden = v.jug.slice().sort((a, b) => a.puesto - b.puesto), yo = v.jug.find(j => j.id === v.me);
        fin.innerHTML = Turnero.tablaFin(v, orden.map(j => ({ puesto: j.puesto, name: j.name, yo: j.id === v.me, txt: `${Bowling.puntaje({ cuadros: v.cuadros }, j)} pts · ${j.strikes} strike${j.strikes === 1 ? "" : "s"}` })),
          yo && yo.puesto === 1 && v.jug.length > 1 ? "🏆 ¡Ganaste!" : "🎳 Fin de la partida", "", Bowling.send, Bowling.opts);
        Turnero.conectarFin(Bowling.send, Bowling.opts);
      }
    }
  }
};
EXTRA.bowling = Bowling;
PANTALLAS.bowlingIntro = () => Turnero.intro(Bowling);
PANTALLAS.bowling = () => Turnero.pantalla(Bowling);
