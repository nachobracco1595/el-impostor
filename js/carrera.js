/* Carrera Loca: una pista llena de obstáculos que sube; gana el primero que llega a la meta.
   - Barras giratorias bajas (se saltan), péndulos y bloques que van y vienen (se esquivan), pozos de agua
     (si caés, volvés al último banderín), cintas que arrastran, barro que frena y puertas falsas.
   - Todos los obstáculos se mueven según el reloj de la carrera y la pista sale de una semilla:
     online todos ven lo mismo y solo viajan las posiciones (cada uno mueve su personaje, como en la Arena).
   - Bots que miran adelante, esquivan, saltan y a veces se equivocan. */
const CR = {
  W: 480, LARGO: 5200, R: 15, VEL: 235, SALTO: 0.6, ESPERA_SALTO: 0.35, CUENTA: 3, DURACION: 150,
  BOTS: ["🤖 Rita", "🤖 Tito", "🤖 Pepa", "🤖 Cacho", "🤖 Coca", "🤖 Lalo", "🤖 Mora"],
  COLORES: ["#ff6b6b", "#ffd43b", "#69db7c", "#74c0fc", "#b197fc", "#f783ac", "#ffa94d"]
};

const Carrera = {
  azar(semilla) { let a = semilla >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },

  /* La pista: secciones de obstáculos una detrás de otra, cada vez más difíciles */
  pista(semilla) {
    const r = Carrera.azar(semilla), W = CR.W, obst = [], cps = [0];
    let y = 360;
    const tipos = ["barra", "bloques", "pozos", "cinta", "puertas", "pendulos", "barro"];
    // La primera sección siempre es tranquila: bloques lentos para calentar
    obst.push({ t: "bloque", y: 260, w: 110, h: 34, A: 140, w2: 1, fase: r() * 6 });
    let anterior = "bloques";
    while (y < CR.LARGO - 320) {
      const dif = y / CR.LARGO;
      let t; do t = tipos[Math.floor(r() * tipos.length)]; while (t === anterior);
      anterior = t; cps.push(y - 40);
      if (t === "barra") { obst.push({ t: "barra", x: W / 2, y: y + 90, largo: 150 + r() * 40, w: (r() < .5 ? -1 : 1) * (1.4 + dif * 1.4), fase: r() * 6 }); y += 220; }
      else if (t === "bloques") { const n = 2 + (dif > .5 ? 1 : 0); for (let k = 0; k < n; k++) obst.push({ t: "bloque", y: y + 40 + k * 85, w: 110 + r() * 40, h: 34, A: 150, w2: 1.2 + r() * 1.2 + dif, fase: r() * 6 }); y += 70 + n * 85; }
      else if (t === "pozos") { const n = 2 + Math.floor(r() * 2); for (let k = 0; k < n; k++) { const hueco = 60 + r() * (W - 200); obst.push({ t: "pozo", x: 0, y: y + 30 + k * 95, w: hueco, h: 54 }, { t: "pozo", x: hueco + 110 - dif * 30, y: y + 30 + k * 95, w: W, h: 54 }); } y += 60 + n * 95; }
      else if (t === "cinta") { const dir = r() < .5 ? -1 : 1; obst.push({ t: "cinta", y: y + 20, h: 170, dir, vel: 95 + dif * 60 }); obst.push({ t: "pozo", x: dir > 0 ? W - 70 : 0, y: y + 70, w: 70, h: 70 }); y += 230; }
      else if (t === "puertas") { const n = 5, falsas = new Set(); while (falsas.size < 2 + (dif > .6 ? 1 : 0)) falsas.add(Math.floor(r() * n)); obst.push({ t: "puertas", y: y + 60, n, falsas: [...falsas] }); y += 170; }
      else if (t === "pendulos") { const n = 2 + (dif > .4 ? 1 : 0); for (let k = 0; k < n; k++) obst.push({ t: "pendulo", y: y + 50 + k * 90, A: 170, w2: 1.4 + r() + dif, fase: r() * 6, r: 26 }); y += 80 + n * 90; }
      else { obst.push({ t: "barro", y: y + 20, h: 150 }); obst.push({ t: "pendulo", y: y + 95, A: 160, w2: 1.2, fase: r() * 6, r: 24 }); y += 210; }
      y += 70;
    }
    return { obst, cps };
  },

  /* Dónde está cada obstáculo que se mueve en el instante t */
  xBloque: (o, t) => CR.W / 2 + o.A * Math.sin(o.w2 * t + o.fase),
  angBarra: (o, t) => o.fase + o.w * t,

  setup(jug, cfg) {
    const semilla = Math.floor(Math.random() * 1e9), p = Carrera.pista(semilla);
    return {
      id: "cr-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), semilla, obst: p.obst, cps: p.cps, mov: 0,
      jug: jug.map((j, i) => ({ ...j, x: 60 + (i % 8) * ((CR.W - 120) / 7), y: 40 + Math.floor(i / 8) * 30, vx: 0, vy: 0, salto: 0, esperaSalto: 0, aturdido: 0, cp: 0, meta: null, puesto: 0, cae: 0, golpe: 0,
        look: j.look || { color: CR.COLORES[i % CR.COLORES.length], acc: [] } })),
      n: jug.length, cfg: { nivel: (cfg && cfg.nivel) || "normal" }, fase: "cuenta", t: -CR.CUENTA, llegaron: 0
    };
  },

  /* ---------- Física de un corredor (la misma para la persona, online y los bots) ---------- */
  mover(s, p, dt, mx, my, salta) {
    if (p.meta != null) return;
    const t = s.t, R = CR.R;
    p.salto = Math.max(0, p.salto - dt); p.esperaSalto = Math.max(0, p.esperaSalto - dt); p.aturdido = Math.max(0, p.aturdido - dt); p.cae = Math.max(0, p.cae - dt);
    if (p.cae > 0) return;
    if (salta && p.salto <= 0 && p.esperaSalto <= 0) { p.salto = CR.SALTO; p.esperaSalto = CR.SALTO + CR.ESPERA_SALTO; }
    let vel = CR.VEL;
    for (const o of s.obst) if (o.t === "barro" && p.y > o.y && p.y < o.y + o.h && p.salto <= 0) vel *= 0.5;
    const d = Math.hypot(mx, my); if (d > 1) { mx /= d; my /= d; }
    if (p.aturdido > 0) { mx = 0; my = 0; }
    p.x += (mx * vel + p.vx) * dt; p.y += (my * vel + p.vy) * dt;
    p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt);
    for (const o of s.obst) {
      if (o.t === "cinta" && p.y > o.y && p.y < o.y + o.h && p.salto <= 0) p.x += o.dir * o.vel * dt;
      else if (o.t === "barra") {
        const a = Carrera.angBarra(o, t), ux = Math.cos(a), uy = Math.sin(a), dx = p.x - o.x, dy = p.y - o.y, k = Math.max(-o.largo, Math.min(o.largo, dx * ux + dy * uy));
        const ex = dx - k * ux, ey = dy - k * uy, dist = Math.hypot(ex, ey);
        if (dist < R + 8 && p.salto <= 0 && p.aturdido <= 0) Carrera.golpe(p, ex / (dist || 1), ey / (dist || 1), 380);
      } else if (o.t === "bloque") {
        const cx = Carrera.xBloque(o, t), hx = o.w / 2, hy = o.h / 2;
        const nx = Math.max(cx - hx, Math.min(cx + hx, p.x)), ny = Math.max(o.y - hy, Math.min(o.y + hy, p.y)), ex = p.x - nx, ey = p.y - ny, dist = Math.hypot(ex, ey);
        if (dist < R) { const ux = dist ? ex / dist : 0, uy = dist ? ey / dist : -1; p.x = nx + ux * R; p.y = ny + uy * R; if (p.aturdido <= 0) Carrera.golpe(p, ux, uy || -1, 300); }
      } else if (o.t === "pendulo") {
        const cx = Carrera.xBloque(o, t), dx = p.x - cx, dy = p.y - o.y, dist = Math.hypot(dx, dy);
        if (dist < R + o.r && p.aturdido <= 0) Carrera.golpe(p, dx / (dist || 1), dy / (dist || 1), 420);
      } else if (o.t === "puertas") {
        const ancho = CR.W / o.n, k = Math.min(o.n - 1, Math.floor(p.x / ancho));
        if (o.falsas.includes(k) && p.y > o.y - 12 - R && p.y < o.y + 12 + R) { p.y = o.y - 12 - R - 1; p.vy = -60; p.choco = { y: o.y, k }; }
      } else if (o.t === "pozo" && p.salto <= 0 && p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h) {
        // Al agua: vuelve al último banderín
        p.cae = 1.1; p.x = CR.W / 2; p.y = s.cps[p.cp] + 10; p.vx = p.vy = 0; p.caidas = (p.caidas || 0) + 1;
      }
    }
    p.x = Math.max(R, Math.min(CR.W - R, p.x)); p.y = Math.max(10, p.y);
    while (p.cp + 1 < s.cps.length && p.y > s.cps[p.cp + 1] + 30) p.cp++;
    if (p.y >= CR.LARGO) { p.meta = s.t; }
  },
  golpe(p, ux, uy, f) { p.vx = ux * f; p.vy = uy * f; p.aturdido = 0.45; p.golpe = 0.45; p.golpes = (p.golpes || 0) + 1; },

  /* ---------- Bots ---------- */
  peligro(s, x, y, t) {
    let d = 0;
    for (const o of s.obst) {
      if (o.t === "bloque") { const cx = Carrera.xBloque(o, t); if (Math.abs(y - o.y) < o.h / 2 + 22 && Math.abs(x - cx) < o.w / 2 + 22) d += 10; }
      else if (o.t === "pendulo") { const cx = Carrera.xBloque(o, t); if (Math.hypot(x - cx, y - o.y) < o.r + 28) d += 10; }
      else if (o.t === "pozo") { if (x > o.x - 10 && x < o.x + o.w + 10 && y > o.y - 10 && y < o.y + o.h + 10) d += 4; }
      else if (o.t === "puertas") { const k = Math.min(o.n - 1, Math.floor(x / (CR.W / o.n))); if (Math.abs(y - o.y) < 40 && o.falsas.includes(k)) d += 3; }
      else if (o.t === "cinta" && y > o.y && y < o.y + o.h) d += Math.abs(x - (o.dir > 0 ? 60 : CR.W - 60)) < 60 ? 0 : 0.3;
    }
    return d;
  },
  pensarBot(s, b, dt) {
    const nivel = { facil: 0.55, normal: 0.8, dificil: 0.95 }[b.nivel || s.cfg.nivel] || 0.8;
    b.piensa = (b.piensa || 0) - dt;
    if (b.piensa <= 0) {
      b.piensa = 0.12 + (1 - nivel) * 0.3;
      // Prueba varios carriles y elige el menos peligroso un poco más adelante
      let mejor = null;
      for (const off of [0, -45, 45, -95, 95, -150, 150, -210, 210]) {
        const x = Math.max(20, Math.min(CR.W - 20, b.x + off));
        let d = 0; for (const [dy, dtt] of [[40, 0.15], [80, 0.3], [120, 0.45]]) d += Carrera.peligro(s, x, b.y + dy, s.t + dtt);
        d += Math.abs(off) * 0.004 + (Math.random() - 0.5) * (1 - nivel) * 6;
        // Las puertas falsas: el bot "se acuerda" de las que ya probó y a veces adivina
        if (!mejor || d < mejor.d) mejor = { x, d };
      }
      b.objX = mejor.x;
      // Saltar: pozo o barra muy cerca
      b.quiereSaltar = s.obst.some(o => (o.t === "pozo" && b.x > o.x && b.x < o.x + o.w && o.y - b.y < 45 && o.y - b.y > 0) ||
        (o.t === "barra" && Math.hypot(b.x - o.x, b.y - o.y) < o.largo + 30 && Math.abs(((b.x - o.x) * -Math.sin(Carrera.angBarra(o, s.t)) + (b.y - o.y) * Math.cos(Carrera.angBarra(o, s.t)))) < 48)) && Math.random() < nivel;
    }
    const dx = b.objX - b.x;
    Carrera.mover(s, b, dt, Math.max(-1, Math.min(1, dx / 40)), Math.random() < nivel * 0.98 ? 1 : 0.2, b.quiereSaltar);
  },

  /* Un paso de la carrera (en el teléfono local o en el anfitrión) */
  tick(s, dt) {
    s.t += dt;
    if (s.fase === "cuenta" && s.t >= 0) s.fase = "carrera";
    if (s.fase !== "carrera") return;
    for (const b of s.jug) if (b.cpu && b.meta == null) Carrera.pensarBot(s, b, dt);
    Carrera.ordenar(s);
    const humanos = s.jug.filter(j => !j.cpu), primero = s.jug.find(j => j.puesto === 1 && j.meta != null);
    if (humanos.length && humanos.every(j => j.meta != null) || s.jug.every(j => j.meta != null) || s.t > CR.DURACION || (primero && s.t - primero.meta > 30)) Carrera.terminar(s);
  },
  ordenar(s) {
    const orden = s.jug.slice().sort((a, b) => (a.meta ?? 1e9) - (b.meta ?? 1e9) || b.y - a.y);
    orden.forEach((j, k) => j.puesto = k + 1);
  },
  terminar(s) { if (s.fase === "fin") return; Carrera.ordenar(s); s.fase = "fin"; s.mov++; },
  act(s, pid, a) {
    const J = s.jug.find(j => j.id === pid); if (!J) return;
    if (a.t === "pos" && s.fase !== "fin" && J.meta == null) {
      J.x = Math.max(0, Math.min(CR.W, +a.x || 0)); J.y = Math.max(0, Math.min(CR.LARGO + 20, +a.y || 0));
      J.salto = a.s ? 0.2 : 0; J.cae = a.c ? 0.2 : 0; J.golpe = a.g ? 0.2 : 0; J.caidas = a.ca | 0;
      if (J.y >= CR.LARGO) J.meta = s.t;
    }
  },

  resultado(s, pid) {
    if (s.fase !== "fin") return null;
    const J = s.jug.find(j => j.id === pid); if (!J) return null;
    return { juego: "carrera", id: s.id, gano: J.puesto === 1, puesto: J.puesto, n: s.n, llego: J.meta != null, tiempo: J.meta, vsCompu: s.jug.every(j => j === J || j.cpu), caidas: J.caidas | 0 };
  },
  view(s, pid) {
    return { game: "carrera", id: s.id, me: pid, semilla: s.semilla, fase: s.fase, t: s.t, n: s.n,
      jug: s.jug.map(j => ({ id: j.id, name: j.name, cpu: !!j.cpu, look: j.look, x: Math.round(j.x), y: Math.round(j.y), s: j.salto > 0, c: j.cae > 0, g: j.golpe > 0, meta: j.meta, puesto: j.puesto })) };
  },

  /* ---------- Pantalla ---------- */
  render(v, send, opts) {
    Carrera.v = v; Carrera.send = send; Carrera.opts = opts;
    const U = UI.cr;
    // El reloj: online se sincroniza con el del anfitrión
    if (!U || U.id !== v.id || !byId("crCanvas")) Carrera.montar(v);
    else if (!opts.local) { const nuevo = performance.now() / 1000 - v.t; UI.cr.off = Math.abs(nuevo - UI.cr.off) > 0.5 ? nuevo : UI.cr.off * 0.9 + nuevo * 0.1; }
    Carrera.hud();
  },
  montar(v) {
    document.body.classList.add("en-nave");
    const p = Carrera.pista(v.semilla), yo = v.jug.find(j => j.id === v.me) || v.jug[0];
    app.innerHTML = `<div class="nave carrera" id="crRoot"><canvas id="crCanvas"></canvas>
      <div class="cr-top" id="crTop"></div><div class="ar-centro" id="crCentro" hidden></div>
      <div class="nv-joy" id="crJoy"><i></i></div>
      <button class="md-accion cr-saltar" id="crSaltar" aria-label="Saltar">⤴️</button>
      <button class="nv-salir" id="crSalir" aria-label="Salir">✕</button>
      <div class="ar-fin" id="crFin" hidden></div></div>`;
    if (CarreraPixi.activo) CarreraPixi.desmontar();
    ArenaFX.cargar();
    if (ArenaPixi.listo) CarreraPixi.montar(byId("crCanvas")); else ArenaPixi.cargar();
    UI.cr = { id: v.id, obst: p.obst, cps: p.cps, off: performance.now() / 1000 - v.t, yo: { ...yo, vx: 0, vy: 0, salto: 0, esperaSalto: 0, aturdido: 0, cae: 0, golpe: 0, cp: 0, meta: null },
      mov: { x: 0, y: 0 }, teclas: {}, salta: false, ultEnvio: 0, otros: {}, chocadas: new Set() };
    Carrera.joystick();
    const b = byId("crSaltar");
    b.onpointerdown = e => { e.preventDefault(); UI.cr.salta = true; setTimeout(() => { if (UI.cr) UI.cr.salta = false; }, 120); };
    b.oncontextmenu = e => e.preventDefault();
    byId("crSalir").onclick = () => { if (Carrera.opts.local) { if (Carrera.v.fase === "fin" || confirm("¿Abandonar la carrera?")) { Carrera.parar(); go("carreraIntro"); } } else { UI.confirmSalir = true; render(); } };
    if (!Carrera.raf) Carrera.loop();
  },
  joystick() {
    const joy = byId("crJoy"), pin = joy.querySelector("i"), mov = UI.cr.mov, zona = byId("crCanvas");
    let id = null, cx = 0, cy = 0;
    const empezar = e => { const t = e.changedTouches ? e.changedTouches[0] : e; id = t.identifier ?? "m"; cx = t.clientX; cy = t.clientY; joy.style.left = cx - 60 + "px"; joy.style.top = cy - 60 + "px"; joy.classList.add("on"); mover(e); };
    const mover = e => {
      if (id === null) return;
      const t = e.changedTouches ? [...e.changedTouches].find(x => x.identifier === id) : e; if (!t) return;
      let dx = t.clientX - cx, dy = t.clientY - cy; const d = Math.hypot(dx, dy), max = 50;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      pin.style.transform = `translate(${dx}px, ${dy}px)`; mov.x = dx / max; mov.y = -dy / max;
      if (e.cancelable) e.preventDefault();
    };
    const fin = e => { if (e && e.changedTouches && ![...e.changedTouches].some(x => x.identifier === id)) return; id = null; mov.x = 0; mov.y = 0; pin.style.transform = ""; joy.classList.remove("on"); };
    zona.addEventListener("touchstart", empezar, { passive: true }); zona.addEventListener("touchmove", mover, { passive: false });
    zona.addEventListener("touchend", fin); zona.addEventListener("touchcancel", fin);
    zona.addEventListener("mousedown", empezar); window.addEventListener("mousemove", e => { if (id === "m") mover(e); }); window.addEventListener("mouseup", () => { if (id === "m") fin(); });
    if (!Carrera.teclasListas) {
      Carrera.teclasListas = true;
      const map = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, 1], s: [0, -1], a: [-1, 0], d: [1, 0] };
      window.addEventListener("keydown", e => {
        if (!UI.cr || !byId("crCanvas")) return;
        if (e.key === " ") { UI.cr.salta = true; e.preventDefault(); return; }
        if (map[e.key]) { UI.cr.teclas[e.key] = map[e.key]; e.preventDefault(); }
      });
      window.addEventListener("keyup", e => { if (!UI.cr) return; if (e.key === " ") UI.cr.salta = false; delete UI.cr.teclas[e.key]; });
    }
  },
  parar() { if (CarreraPixi.activo) CarreraPixi.desmontar(); cancelAnimationFrame(Carrera.raf); Carrera.raf = null; clearInterval(Carrera.reloj); Carrera.reloj = null; document.body.classList.remove("en-nave"); UI.cr = null; const r = byId("crRoot"); if (r) r.remove(); },
  loop() {
    let prev = performance.now();
    const paso = now => {
      Carrera.raf = requestAnimationFrame(paso);
      const cv = byId("crCanvas"); if (!cv || !UI.cr || !Carrera.v) { if (!cv) Carrera.parar(); return; }
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      Carrera.moverYo(dt, now);
      if (CarreraPixi.activo) { try { CarreraPixi.dibujar(now); } catch (e) { if (!Carrera.errPixi) { Carrera.errPixi = true; console.error(e); } } }
      else dibujarSeguro(cv, () => Carrera.dibujar(cv, now));
    };
    Carrera.raf = requestAnimationFrame(paso);
  },
  /* La persona mueve su corredor en su teléfono (online le avisa al anfitrión dónde está) */
  moverYo(dt, now) {
    const U = UI.cr, v = Carrera.v;
    if (Carrera.opts.local) { const s = S.car; const J = s.jug.find(j => j.id === v.me); if (!J) return;
      let mx = U.mov.x, my = U.mov.y; for (const [dx, dy] of Object.values(U.teclas)) { mx += dx; my += dy; }
      if (s.fase === "carrera") Carrera.mover(s, J, dt, mx, my, U.salta);
      U.yo = J; return; }
    const t = now / 1000 - U.off, s = { t, obst: U.obst, cps: U.cps };
    if (v.fase !== "carrera" || t < 0) return;
    let mx = U.mov.x, my = U.mov.y; for (const [dx, dy] of Object.values(U.teclas)) { mx += dx; my += dy; }
    Carrera.mover(s, U.yo, dt, mx, my, U.salta);
    if (now - U.ultEnvio > 90) { U.ultEnvio = now; Carrera.send({ t: "pos", x: Math.round(U.yo.x), y: Math.round(U.yo.y), s: U.yo.salto > 0 ? 1 : 0, c: U.yo.cae > 0 ? 1 : 0, g: U.yo.golpe > 0 ? 1 : 0, ca: U.yo.caidas | 0 }); }
  },

  dibujar(cv, now) {
    const U = UI.cr, v = Carrera.v, dpr = Math.min(2, window.devicePixelRatio || 1);
    const Wp = cv.clientWidth, Hp = cv.clientHeight;
    if (cv.width !== Math.round(Wp * dpr) || cv.height !== Math.round(Hp * dpr)) { cv.width = Math.round(Wp * dpr); cv.height = Math.round(Hp * dpr); }
    const ctx = cv.getContext("2d"), esc = Wp / CR.W, t = Carrera.opts.local ? S.car.t : now / 1000 - U.off;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const yo = U.yo, camY = yo.y;
    const sy = y => Hp * 0.68 - (y - camY) * esc, sx = x => x * esc;
    // Fondo: pasto a rayas y la pista
    ctx.fillStyle = "#5fbf5f"; ctx.fillRect(0, 0, Wp, Hp);
    for (let y = Math.floor((camY - Hp / esc) / 80) * 80; y < camY + Hp / esc; y += 80) { ctx.fillStyle = (y / 80) % 2 ? "#58b558" : "#63c463"; ctx.fillRect(0, sy(y + 80), Wp, 80 * esc); }
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(0, 0, 4, Hp); ctx.fillRect(Wp - 4, 0, 4, Hp);
    // Largada, banderines y meta
    const linea = (y, a, b) => { const yy = sy(y); for (let k = 0; k < 16; k++) { ctx.fillStyle = k % 2 ? a : b; ctx.fillRect(k * Wp / 16, yy - 8, Wp / 16, 8); ctx.fillStyle = k % 2 ? b : a; ctx.fillRect(k * Wp / 16, yy, Wp / 16, 8); } };
    linea(CR.LARGO, "#fff", "#1b1726"); linea(0, "#fff", "#e03131");
    U.cps.forEach((y, k) => { if (!k) return; const yy = sy(y); if (yy < -40 || yy > Hp + 40) return; ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(0, yy - 2, Wp, 3); ctx.font = `20px ${FE}`; ctx.fillStyle = "#000"; ctx.fillText("🚩", 6, yy - 6); });
    // Obstáculos
    for (const o of U.obst) {
      const top = sy(o.y + (o.h || 60)), bot = sy(o.y - 60); if (bot < -60 || top > Hp + 60) continue;
      if (o.t === "barro") { ctx.fillStyle = "#8b5a2b"; ctx.fillRect(0, sy(o.y + o.h), Wp, o.h * esc); ctx.fillStyle = "rgba(0,0,0,.15)"; for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.ellipse(((k * 97) % CR.W) * esc, sy(o.y + ((k * 53) % o.h)), 12 * esc, 6 * esc, 0, 0, 7); ctx.fill(); } }
      else if (o.t === "cinta") { ctx.fillStyle = "#495057"; ctx.fillRect(0, sy(o.y + o.h), Wp, o.h * esc); ctx.fillStyle = "#ffd43b"; const pasoA = 60, des = ((t * o.vel * o.dir) % pasoA + pasoA) % pasoA; ctx.font = `bold ${22 * esc}px system-ui`; for (let fy = o.y + 30; fy < o.y + o.h; fy += 50) for (let x = -pasoA + des; x < CR.W + pasoA; x += pasoA) ctx.fillText(o.dir > 0 ? "›" : "‹", sx(x), sy(fy)); }
      else if (o.t === "pozo") { ctx.fillStyle = "#1c7ed6"; ctx.beginPath(); ctx.roundRect(sx(o.x), sy(o.y + o.h), Math.min(CR.W - o.x, o.w) * esc, o.h * esc, 10); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); const wx = sx(o.x + 20 + ((t * 30 + k * 60) % Math.max(40, Math.min(CR.W - o.x, o.w) - 40))); ctx.arc(wx, sy(o.y + o.h / 2), 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } }
    }
    for (const o of U.obst) {
      if (Math.abs(o.y - camY) * esc > Hp + 200) continue;
      if (o.t === "barra") {
        const a = Carrera.angBarra(o, t), ux = Math.cos(a), uy = Math.sin(a);
        ctx.lineCap = "round"; ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 16 * esc; ctx.beginPath(); ctx.moveTo(sx(o.x - ux * o.largo) + 4, sy(o.y - uy * o.largo) + 6); ctx.lineTo(sx(o.x + ux * o.largo) + 4, sy(o.y + uy * o.largo) + 6); ctx.stroke();
        ctx.strokeStyle = "#e8590c"; ctx.lineWidth = 14 * esc; ctx.beginPath(); ctx.moveTo(sx(o.x - ux * o.largo), sy(o.y - uy * o.largo)); ctx.lineTo(sx(o.x + ux * o.largo), sy(o.y + uy * o.largo)); ctx.stroke();
        ctx.strokeStyle = "#ffd8a8"; ctx.lineWidth = 4 * esc; ctx.stroke();
        ctx.fillStyle = "#343a40"; ctx.beginPath(); ctx.arc(sx(o.x), sy(o.y), 14 * esc, 0, 7); ctx.fill();
      } else if (o.t === "bloque") {
        const cx = Carrera.xBloque(o, t);
        ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(sx(cx - o.w / 2) + 4, sy(o.y + o.h / 2) + 6, o.w * esc, o.h * esc);
        ctx.fillStyle = "#e03131"; ctx.beginPath(); ctx.roundRect(sx(cx - o.w / 2), sy(o.y + o.h / 2), o.w * esc, o.h * esc, 8); ctx.fill();
        ctx.fillStyle = "#fff"; for (let k = 0; k < o.w; k += 28) ctx.fillRect(sx(cx - o.w / 2 + k + 6), sy(o.y + o.h / 2) + 4, 12 * esc, o.h * esc - 8);
      } else if (o.t === "pendulo") {
        const cx = Carrera.xBloque(o, t);
        ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx(CR.W / 2), sy(o.y) - 4); ctx.lineTo(sx(cx), sy(o.y)); ctx.stroke();
        ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.arc(sx(cx) + 5, sy(o.y) + 8, o.r * esc, 0, 7); ctx.fill();
        const g = ctx.createRadialGradient(sx(cx) - 8, sy(o.y) - 8, 4, sx(cx), sy(o.y), o.r * esc); g.addColorStop(0, "#adb5bd"); g.addColorStop(1, "#343a40");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx(cx), sy(o.y), o.r * esc, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd43b"; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + t * 2; ctx.beginPath(); ctx.arc(sx(cx) + Math.cos(a) * o.r * esc, sy(o.y) + Math.sin(a) * o.r * esc, 4, 0, 7); ctx.fill(); }
      } else if (o.t === "puertas") {
        const ancho = CR.W / o.n;
        for (let k = 0; k < o.n; k++) {
          const probada = U.chocadas.has(o.y + ":" + k);
          ctx.fillStyle = probada ? "#c92a2a" : ["#7048e8", "#1c7ed6", "#2b8a3e", "#f08c00", "#d6336c"][k % 5];
          ctx.beginPath(); ctx.roundRect(sx(k * ancho + 4), sy(o.y + 12), (ancho - 8) * esc, 24 * esc, 6); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = `bold ${16 * esc}px system-ui`; ctx.textAlign = "center"; ctx.fillText(probada ? "✕" : "?", sx(k * ancho + ancho / 2), sy(o.y - 6)); ctx.textAlign = "start";
        }
      }
    }
    if (yo.choco) { U.chocadas.add(yo.choco.y + ":" + yo.choco.k); yo.choco = null; }
    // Corredores (los otros con su última posición; yo con la mía)
    const lista = v.jug.map(j => j.id === v.me ? { ...j, x: yo.x, y: yo.y, s: yo.salto > 0, c: yo.cae > 0, g: yo.golpe > 0, yo: true } : (() => {
      if (Carrera.opts.local) { const J = S.car.jug.find(x => x.id === j.id); return { ...j, x: J.x, y: J.y, s: J.salto > 0, c: J.cae > 0, g: J.golpe > 0 }; }
      const o = U.otros[j.id] = U.otros[j.id] || { x: j.x, y: j.y }; o.x += (j.x - o.x) * 0.25; o.y += (j.y - o.y) * 0.25; return { ...j, x: o.x, y: o.y };
    })()).sort((a, b) => b.y - a.y);
    const ahora = now / 1000, A = U.anim = U.anim || {};
    for (const j of lista) {
      // Animación: se calcula con lo que se movió desde el cuadro anterior (sirve igual para mí, los bots y los demás)
      const a = A[j.id] = A[j.id] || { x: j.x, y: j.y, t: ahora, fase: 0, vel: 0, dir: 1, salto: -9 };
      const dt = Math.min(0.1, Math.max(0.001, ahora - a.t)), dx = j.x - a.x, dy = j.y - a.y, d = Math.hypot(dx, dy);
      a.vel += ((d < 60 ? d / dt : 0) - a.vel) * Math.min(1, dt * 12);
      if (d < 60) a.fase += d * 0.11;
      if (Math.abs(dx) > 0.4) a.dir += ((dx > 0 ? 1 : -1) - a.dir) * Math.min(1, dt * 10);
      if (j.s && !a.sal) a.salto = ahora; a.sal = j.s; a.x = j.x; a.y = j.y; a.t = ahora;
      const X = sx(j.x), Y = sy(j.y); if (Y < -60 || Y > Hp + 60) continue;
      const anda = a.vel > 25 && !j.c, ps = Math.min(1, (ahora - a.salto) / CR.SALTO), enAire = ps < 1;
      const alt = enAire ? Math.sin(ps * Math.PI) * 26 : 0, alto = enAire ? 1 + Math.sin(ps * Math.PI) * 0.18 : 1;
      const rebote = anda && !enAire ? Math.abs(Math.sin(a.fase)) * 4 : Math.sin(ahora * 3 + j.x) * 0.8;
      const pasoP = enAire ? 0.7 : anda ? Math.sin(a.fase) : 0, img = Mundo.muneco(j.look);
      ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(X, Y + 10, 15 * (1 - alt / 60), 6 * (1 - alt / 60), 0, 0, 7); ctx.fill();
      ctx.globalAlpha = j.c ? 0.35 : 1;
      ctx.save(); ctx.translate(X, Y - rebote - alt); ctx.scale(alto * (a.dir < 0 ? -1 : 1) * Math.max(0.85, Math.abs(a.dir)), alto * (enAire ? 1 : 1 - Math.abs(Math.cos(a.fase)) * (anda ? 0.04 : 0)));
      if (anda && !enAire) ctx.rotate(Math.sin(a.fase) * 0.09 + Math.min(0.12, a.vel / 2000));
      if (j.g) ctx.rotate(Math.sin(ahora * 40) * 0.15);
      // Piernas que se cruzan al correr (y se encogen en el aire)
      const pierna = (lado, k) => { ctx.save(); ctx.translate(lado * 7, -2); ctx.rotate(k * 0.6); ctx.fillStyle = "#1b1726"; ctx.beginPath(); ctx.roundRect(-3.5, 0, 7, enAire ? 8 : 12, 3.5); ctx.fill(); ctx.fillStyle = j.look.color || "#748ffc"; ctx.beginPath(); ctx.ellipse(0, enAire ? 8 : 12, 5, 3.5, 0, 0, 7); ctx.fill(); ctx.restore(); };
      pierna(-1, pasoP); pierna(1, enAire ? -0.7 : -pasoP);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, -22, -44, 44, 50);
      ctx.restore();
      ctx.globalAlpha = 1;
      const top = Y - 50 * alto - alt - rebote;
      if (j.g) { ctx.font = `16px ${FE}`; ctx.fillStyle = "#000"; ctx.fillText("💫", X - 9, top); }
      if (j.c) { ctx.font = `18px ${FE}`; ctx.fillStyle = "#000"; ctx.fillText("💦", X - 10, Y - 46); }
      ctx.font = "bold 11px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = j.yo ? "#ffd43b" : "#fff"; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 3;
      const nm = (j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name).slice(0, 10); ctx.strokeText(nm, X, top - (j.g ? 16 : 0)); ctx.fillText(nm, X, top - (j.g ? 16 : 0)); ctx.textAlign = "start";
    }
    // Barra de progreso a la derecha
    const bx = 12, by0 = Hp * 0.16, by1 = Hp * 0.62;
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.roundRect(bx - 4, by0, 8, by1 - by0, 4); ctx.fill();
    lista.forEach(j => { const yy = by1 - (Math.min(CR.LARGO, j.y) / CR.LARGO) * (by1 - by0); ctx.fillStyle = j.yo ? "#ffd43b" : j.look.color || "#fff"; ctx.beginPath(); ctx.arc(bx, yy, j.yo ? 7 : 5, 0, 7); ctx.fill(); });
    Carrera.cuenta(v, yo, t);
  },
  /* Cuenta regresiva y "¡Al agua!" (HTML, igual para los dos dibujos) */
  cuenta(v, yo, t) {
    const c = byId("crCentro");
    if (c) { const falta = Math.ceil(-t); const txt = v.fase === "cuenta" || t < 0 ? (falta > 0 ? String(falta) : "¡YA!") : t < 0.8 ? "¡YA!" : yo.cae > 0 ? "¡Al agua!" : ""; c.hidden = !txt; if (c.textContent !== txt) { c.textContent = txt; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); } }
  },
  hud() {
    const v = Carrera.v, U = UI.cr; if (!U) return;
    const yo = v.jug.find(j => j.id === v.me), ord = v.jug.slice().sort((a, b) => a.puesto - b.puesto);
    const top = byId("crTop");
    if (top) top.innerHTML = `<span class="ar-chip yo"><b>${yo ? (v.fase === "cuenta" ? `🏁 ${v.n} corredores` : `${yo.puesto || "-"}º de ${v.n}`) : ""}</b></span><span class="ar-chip"><b>⏱ ${Math.max(0, v.t).toFixed(0)} s</b></span>${yo && yo.meta != null ? `<span class="ar-chip"><b>🏁 ¡Llegaste!</b></span>` : ""}`;
    const fin = byId("crFin");
    if (fin) {
      fin.hidden = v.fase !== "fin";
      if (v.fase === "fin" && !fin.dataset.listo) {
        fin.dataset.listo = 1;
        const jefe = Carrera.opts.local || Carrera.opts.isHost;
        fin.innerHTML = `<div class="ar-fin-caja"><h2>${yo && yo.puesto === 1 ? "🏆 ¡Ganaste la carrera!" : "🏁 Fin de la carrera"}</h2>
          <ol class="ar-tabla">${ord.map(j => `<li class="${j.id === v.me ? "yo" : ""}"><span>${j.puesto}º</span><b>${esc(j.cpu ? j.name.replace(/^🤖\s*/, "🤖 ") : j.name)}</b><small>${j.meta != null ? `${j.meta.toFixed(1)} s` : "no llegó"}</small></li>`).join("")}</ol>
          ${jefe ? `<div class="row"><button class="btn" id="crOtra">Otra carrera</button><button class="btn ghost" id="crVolver">${Carrera.opts.local ? "Salir" : "Volver a la sala"}</button></div>` : `<p class="sub center">El anfitrión puede largar otra.</p>`}</div>`;
        on("crOtra", () => Carrera.send({ t: "again" }));
        on("crVolver", () => { if (Carrera.opts.local) { Carrera.parar(); go("carreraIntro"); } else Carrera.send({ t: "lobby" }); });
      }
    }
  },

  /* ---------- En este teléfono, contra bots ---------- */
  bots(n, nivel) { return shuffle(CR.BOTS).slice(0, n).map((name, k) => ({ id: "b" + k, name, cpu: true, nivel, look: { color: CR.COLORES[(k + 2) % CR.COLORES.length], acc: [] } })); },
  empezarLocal(cfg) {
    const u = BD.sesion();
    S.car = Carrera.setup(shuffle([{ id: "yo", name: u ? u.nombre : "Vos", look: u ? u.look : null }, ...Carrera.bots(cfg.bots, cfg.nivel)]), cfg);
    clearInterval(Carrera.reloj);
    let prev = performance.now();
    Carrera.reloj = setInterval(() => {
      const s = S.car; if (!s || S.screen !== "carrera") { clearInterval(Carrera.reloj); Carrera.reloj = null; return; }
      const ahora = performance.now(); Carrera.tick(s, (ahora - prev) / 1000); prev = ahora;
      Carrera.v = Carrera.view(s, "yo"); Carrera.hud();
      if (s.fase === "fin" && !s.contada) { s.contada = true; Cuenta.revisar(); }
    }, 50);
    go("carrera");
  },
  /* ---------- Online ---------- */
  empezarOn(R) {
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name, look: p.id === "H" ? Cuenta.look() : p.look }));
    if (jug.length > 12) return "La carrera es de hasta 12.";
    R.car = Carrera.setup([...jug, ...Carrera.bots(Math.max(0, Math.min(7, S.carCfg.mesa - jug.length)), S.carCfg.nivel)], S.carCfg);
    R.game = "carrera"; Carrera.relojHost(R);
    return null;
  },
  relojHost(R) {
    clearInterval(Carrera.relojOn);
    let prev = performance.now(), n = 0;
    Carrera.relojOn = setInterval(() => {
      if (!Net.R || Net.R.game !== "carrera" || !Net.R.car) { clearInterval(Carrera.relojOn); Carrera.relojOn = null; return; }
      const s = Net.R.car, ahora = performance.now(); Carrera.tick(s, (ahora - prev) / 1000); prev = ahora;
      if (++n % 2 === 0 || s.fase === "fin") Net.broadcast();
      if (s.fase === "fin") { clearInterval(Carrera.relojOn); Carrera.relojOn = null; }
    }, 50);
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") { const e = Carrera.empezarOn(R); R.err = e || ""; return; }
    if (a.t === "lobby" && pid === "H") { R.game = null; R.car = null; return; }
    Carrera.act(R.car, pid, a);
  }
};

PANTALLAS.carrera = () => {
  const s = S.car; if (!s) return go("carreraIntro");
  Carrera.render(Carrera.view(s, "yo"), a => {
    if (a.t === "again") { Carrera.parar(); return Carrera.empezarLocal(S.carCfg); }
  }, { local: true });
};

PANTALLAS.carreraIntro = () => {
  ArenaPixi.cargar();
  const c = S.carCfg;
  app.innerHTML = `${head(0)}<section class="screen">
    <div class="tb-hero"><span class="tb-neon">CARRERA LOCA</span><p class="sub">Llegá primero a la meta esquivando barras, péndulos, bloques, pozos, cintas y puertas falsas. Movete con el dedo y saltá con ⤴️.</p></div>
    <div class="panel"><span class="label">Bots en la carrera</span><div class="seg">${[3, 5, 7].map(n => `<button aria-pressed="${c.bots === n}" data-crb="${n}">${n}</button>`).join("")}</div>
      <span class="label">Qué tan buenos son</span><div class="seg">${[["facil", "Fáciles"], ["normal", "Normales"], ["dificil", "Difíciles"]].map(([k, t]) => `<button aria-pressed="${c.nivel === k}" data-crn="${k}">${t}</button>`).join("")}</div></div>
    <button class="btn tb-girar" id="crJugar">🏁 ¡A correr!</button>
    <p class="summary center">¿Con amigos? Creá una sala en "Jugar online" y elegí Carrera Loca: los lugares que sobran los ocupan bots.</p>
    <button class="btn ghost" id="crAtras">Volver</button></section>`;
  const set = (k, v) => { c[k] = v; store.set("carCfg", c); render(); };
  app.querySelectorAll("[data-crb]").forEach(b => b.onclick = () => set("bots", +b.dataset.crb));
  app.querySelectorAll("[data-crn]").forEach(b => b.onclick = () => set("nivel", b.dataset.crn));
  on("crJugar", () => Carrera.empezarLocal(c));
  on("crAtras", () => go("home"));
};
