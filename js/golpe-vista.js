/* Golpe: lo que se ve y los controles (sin emojis: todo dibujado).
   - Cámara que sigue a tu personaje (o a tu auto). Los edificios donde no estás se ven con techo.
   - Personas vistas desde arriba: civiles con ropa de calle, policías de uniforme y gorra, ladrones de oscuro
     con pasamontañas. En la zona segura todos se ven como civiles.
   - Doble joystick: el dedo izquierdo mueve (o maneja), el derecho apunta y dispara. En la compu: WASD, mouse y clic.
   - Tu movimiento a pie se predice en el teléfono y se corrige con lo que dice el anfitrión. */
Object.assign(Golpe, {
  render(v, send, opts) {
    Golpe.send = send; Golpe.opts = opts;
    const U = UI.gp;
    if (!U || U.id !== v.id || U.me !== v.me || !byId("gpCanvas")) Golpe.montar(v);
    Golpe.recibir(v);
  },

  /* ---------- Íconos dibujados (para el mapa y para el HUD) ---------- */
  iconos: {},
  icono(k) {
    if (Golpe.iconos[k]) return Golpe.iconos[k];
    const c = document.createElement("canvas"); c.width = c.height = 64;
    Golpe.dibIcono(c.getContext("2d"), k, 32, 32, 1);
    return Golpe.iconos[k] = c.toDataURL();
  },
  /* Dibuja el ícono k centrado en (x, y); s = escala (1 = unos 64 px) */
  dibIcono(ctx, k, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = "round"; ctx.lineCap = "round";
    const rr = (x0, y0, w, h, r, fill, stroke) => { ctx.beginPath(); ctx.roundRect(x0, y0, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.stroke(); } };
    const circ = (cx, cy, r, fill, stroke, lw = 2.5) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } };
    const poly = (pts, fill, stroke) => { ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.stroke(); } };
    switch (k.replace(/^art-/, "")) {
      case "celular": rr(-12, -21, 24, 42, 5, "#1d1f24", "#05060a"); rr(-9, -16, 18, 30, 2, "#3b82c4"); circ(0, 18, 1.8, "#555"); break;
      case "reloj": rr(-7, -24, 14, 48, 4, "#6b4a2b"); circ(0, 0, 13, "#d9dde3", "#7c838c"); ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.moveTo(0, 0); ctx.lineTo(6, 2); ctx.stroke(); break;
      case "billetes": for (let i = 2; i >= 0; i--) rr(-22 + i * 2, -12 - i * 4, 42, 22, 2, i ? "#5c8a4f" : "#79a865", "#3b5e33"); circ(-1, -1, 6, "#4c7a40"); break;
      case "camara": rr(-22, -13, 44, 28, 5, "#2a2c31", "#111"); rr(-14, -18, 12, 6, 2, "#2a2c31"); circ(3, 1, 10, "#555b63", "#111"); circ(3, 1, 5, "#1a3d5c"); break;
      case "notebook": poly([[-20, -18], [20, -18], [22, 8], [-22, 8]], "#3a3f47", "#1b1e22"); poly([[-17, -15], [17, -15], [18, 5], [-18, 5]], "#4d8fcf"); poly([[-26, 8], [26, 8], [22, 16], [-22, 16]], "#9aa1aa", "#5b6168"); break;
      case "consola": rr(-24, -11, 48, 24, 11, "#2d2f35", "#111"); circ(-12, 1, 4, "#777"); circ(11, -3, 3, "#d64545"); circ(16, 3, 3, "#3f8ed6"); break;
      case "anillo": circ(0, 5, 14, null, "#d4a72c", 5); poly([[-7, -12], [7, -12], [10, -6], [0, 2], [-10, -6]], "#bfe6ff", "#5aa0c8"); break;
      case "collar": ctx.strokeStyle = "#d4a72c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -10, 20, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); for (let i = 0; i < 7; i++) { const a = (0.15 + i * 0.7 / 6) * Math.PI; circ(Math.cos(a) * 20, -10 + Math.sin(a) * 20, 2.8, "#f3e7c9", "#b08d3a", 1); } poly([[0, 10], [7, 18], [0, 26], [-7, 18]], "#c0392b", "#7d1f17"); break;
      case "estatuilla": rr(-14, 14, 28, 8, 2, "#7d7469", "#4a443c"); poly([[-9, 14], [9, 14], [6, -6], [-6, -6]], "#a89f92", "#6b6359"); circ(0, -13, 7, "#a89f92", "#6b6359"); break;
      case "cuadro": rr(-22, -17, 44, 34, 2, "#b58a2e", "#7a5a17"); rr(-17, -12, 34, 24, 1, "#7fb4d6"); poly([[-17, 12], [-6, -2], [3, 8], [9, 2], [17, 12]], "#4f7d3a"); circ(10, -5, 3.5, "#f4d35e"); break;
      case "lingote": poly([[-24, 12], [24, 12], [16, -10], [-16, -10]], "#e3b341", "#9c7414"); poly([[-14, -6], [-4, -6], [-9, 8], [-19, 8]], "rgba(255,255,255,.35)"); break;
      case "diamante": poly([[-20, -6], [-10, -16], [10, -16], [20, -6], [0, 20]], "#c9ecff", "#4d9cc9"); ctx.strokeStyle = "#7fbfe3"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(20, -6); ctx.moveTo(-10, -16); ctx.lineTo(-5, -6); ctx.lineTo(0, 20); ctx.lineTo(5, -6); ctx.lineTo(10, -16); ctx.stroke(); break;
      case "arma-pistola": poly([[-20, -9], [16, -9], [16, -1], [-2, -1], [-6, 16], [-16, 16], [-12, -1], [-20, -1]], "#2b2d31", "#0c0d0f"); break;
      case "arma-subfusil": poly([[-26, -8], [20, -8], [20, -1], [8, -1], [6, 16], [0, 16], [0, -1], [-8, -1], [-12, 10], [-20, 10], [-17, -1], [-26, -1]], "#2b2d31", "#0c0d0f"); rr(20, -6, 8, 3, 1, "#2b2d31"); break;
      case "arma-escopeta": rr(-28, -8, 52, 6, 2, "#2b2d31", "#0c0d0f"); rr(-6, -2, 16, 6, 2, "#6b4a2b"); poly([[-28, -6], [-30, 10], [-20, 10], [-16, -2]], "#6b4a2b", "#3d2a18"); break;
      case "arma-rifle": rr(-30, -6, 60, 6, 2, "#2b2d31", "#0c0d0f"); rr(-6, -13, 18, 5, 2, "#1a1b1e"); poly([[-30, -4], [-31, 9], [-20, 9], [-16, 0]], "#2b2d31", "#0c0d0f"); rr(2, 0, 6, 12, 1, "#2b2d31"); break;
      case "sin-arma": circ(0, 0, 18, null, "#777", 3); ctx.strokeStyle = "#777"; ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(12, -12); ctx.stroke(); break;
      case "chaleco": poly([[-18, -20], [-8, -20], [-4, -10], [4, -10], [8, -20], [18, -20], [20, 18], [-20, 18]], "#4b5233", "#2a2e1c"); rr(-14, 0, 10, 8, 1, "#3b4128"); rr(4, 0, 10, 8, 1, "#3b4128"); break;
      case "bolso": rr(-24, -8, 48, 26, 9, "#3d3a35", "#1c1a17"); ctx.strokeStyle = "#1c1a17"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -8, 11, Math.PI, 0); ctx.stroke(); ctx.strokeStyle = "#8a7f6c"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-18, 2); ctx.lineTo(18, 2); ctx.stroke(); break;
      case "cura": rr(-20, -15, 40, 30, 4, "#f1f3f5", "#adb5bd"); rr(-4, -10, 8, 20, 1, "#d63c3c"); rr(-10, -4, 20, 8, 1, "#d63c3c"); break;
      case "llave": circ(-12, 0, 9, null, "#d4a72c", 5); ctx.strokeStyle = "#d4a72c"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(22, 0); ctx.moveTo(14, 0); ctx.lineTo(14, 8); ctx.moveTo(20, 0); ctx.lineTo(20, 7); ctx.stroke(); break;
      case "plata": rr(-22, -12, 44, 24, 3, "#79a865", "#3b5e33"); rr(-5, -12, 10, 24, 0, "#c9b27a"); break;
      case "placa": poly([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 20; return [Math.cos(a) * r, Math.sin(a) * r]; }), "#d4a72c", "#8a6a12"); circ(0, 0, 5, "#1c4f8c"); break;
      default: circ(0, 0, 14, "#888");
    }
    ctx.restore();
  },

  /* ---------- Montar la pantalla del juego ---------- */
  montar(v) {
    Golpe.parar(true);
    document.body.classList.add("en-nave", "en-golpe");
    app.innerHTML = `<div class="nave golpe" id="gpRoot"><canvas id="gpCanvas"></canvas>
      <div class="gp-top" id="gpTop"></div><canvas class="gp-mini" id="gpMini" width="188" height="188"></canvas>
      <div class="gp-feed" id="gpFeed"></div><div class="ar-centro gp-centro" id="gpCentro" hidden></div>
      <div class="gp-trab" id="gpTrab" hidden><span></span><i></i></div>
      <div class="gp-joy izq" id="gpJoyI"><i></i></div><div class="gp-joy der" id="gpJoyD"><i></i></div>
      <div class="gp-acc" id="gpAcc"></div>
      <div class="gp-ayuda-dedos" id="gpDedos">Izquierda: mover · Derecha: apuntar y disparar</div>
      <div class="gp-tienda" id="gpTienda" hidden></div>
      <button class="nv-salir" id="gpSalir" aria-label="Salir">✕</button>
      <div class="ar-fin" id="gpFin" hidden></div></div>`;
    const M = Golpe.mapa(v.semilla);
    UI.gp = { id: v.id, me: v.me, M, v, yo: null, srv: null, ents: {}, autos: {}, balas: [], nums: [], visto: new Set(),
      mov: { x: 0, y: 0 }, apu: { x: 0, y: 0, f: false }, raton: null, teclas: {}, ult: { t: 0, s: "" }, flash: [], mini: Golpe.miniBase(M), deco: Golpe.decorado(M), kitMandado: false };
    Golpe.controles();
    byId("gpSalir").onclick = () => { if (Golpe.opts.local) { if (UI.gp.v.fase === "fin" || confirm("¿Abandonar? Perdés lo que llevás encima.")) Golpe.send({ t: "salir" }); } else { UI.confirmSalir = true; render(); } };
    byId("gpAcc").onclick = e => { const b = e.target.closest("[data-acc]"); if (b) Golpe.accion(b.dataset.acc); };
    byId("gpTienda").onclick = e => {
      const b = e.target.closest("[data-comprar]"); if (b && !b.disabled) Golpe.send({ t: "comprar", i: b.dataset.comprar });
      if (e.target.closest("[data-cerrar]")) { UI.gp.tienda = false; Golpe.hud(); }
    };
    let prev = performance.now();
    const paso = now => {
      Golpe.raf = requestAnimationFrame(paso);
      const cv = byId("gpCanvas"); if (!cv || !UI.gp) { Golpe.parar(); return; }
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      Golpe.moverYo(dt, now);
      dibujarSeguro(cv, () => Golpe.dibujar(cv, now, dt));
    };
    Golpe.raf = requestAnimationFrame(paso);
  },
  parar(soloVista) {
    cancelAnimationFrame(Golpe.raf); Golpe.raf = null;
    if (Golpe.soltarCtrl) Golpe.soltarCtrl(); Golpe.soltarCtrl = null;
    UI.gp = null; document.body.classList.remove("en-nave", "en-golpe");
    const r = byId("gpRoot"); if (r) r.remove();
    if (!soloVista) { clearInterval(Golpe.reloj); Golpe.reloj = null; }
  },
  accion(a) {
    const U = UI.gp; if (!U) return;
    if (a === "ladron") { if (U.ladronOk || confirm("¿Volverte ladrón? No hay vuelta atrás: la policía va a poder arrestarte.")) { U.ladronOk = true; Golpe.send({ t: "volverse", r: "ladron" }); } return; }
    if (a === "policia") return Golpe.send({ t: "volverse", r: "policia" });
    if (a === "tienda") { U.tienda = true; return Golpe.hud(); }
    if (a === "agarrar") return Golpe.send({ t: "agarrar" });
    if (a === "cura") return Golpe.send({ t: "cura" });
    Golpe.send({ t: "usar", q: a });
  },
  /* Detalles de los techos (equipos de aire, tanques) que no cambian durante la partida */
  decorado(M) {
    const r = Golpe.azar(M.semilla + 7), d = {};
    for (const E of M.ed) { if (!E) continue; d[E.id] = Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({ x: 0.12 + r() * 0.6, y: 0.12 + r() * 0.25 + (r() < 0.5 ? 0.45 : 0), w: 0.08 + r() * 0.1, h: 0.06 + r() * 0.08, tanque: r() < 0.3 })); }
    return d;
  },

  /* ---------- Controles ---------- */
  controles() {
    const root = byId("gpRoot"), U = UI.gp, dedos = {};
    const joy = (lado, x, y, dx, dy) => { const el = byId(lado === "i" ? "gpJoyI" : "gpJoyD"); if (!el) return; if (x == null) { el.classList.remove("on"); el.firstChild.style.transform = ""; return; } el.classList.add("on"); el.style.left = x - 55 + "px"; el.style.top = y - 55 + "px"; el.firstChild.style.transform = `translate(${dx}px, ${dy}px)`; };
    const abajo = e => {
      if (e.target.closest("button, .ar-fin, .gp-top, .gp-tienda, .chat-panel")) return;
      if (e.pointerType === "mouse") { if (e.button === 0) U.apu.f = true; return; }
      const izq = e.clientX < innerWidth / 2;
      if ([...Object.values(dedos)].some(d => d.izq === izq)) return;
      dedos[e.pointerId] = { izq, cx: e.clientX, cy: e.clientY };
      byId("gpDedos") && (byId("gpDedos").hidden = true);
      mover(e); e.preventDefault();
    };
    const mover = e => {
      if (e.pointerType === "mouse") { U.raton = { x: e.clientX, y: e.clientY }; return; }
      const d = dedos[e.pointerId]; if (!d) return;
      let dx = e.clientX - d.cx, dy = e.clientY - d.cy; const m = Math.hypot(dx, dy), max = 48;
      if (m > max) { dx = dx / m * max; dy = dy / m * max; }
      if (d.izq) { U.mov.x = dx / max; U.mov.y = dy / max; }
      else { const k = Math.hypot(dx, dy) / max; if (k > 0.2) { U.apu.x = dx / max; U.apu.y = dy / max; } U.apu.f = k > 0.45; }
      joy(d.izq ? "i" : "d", d.cx, d.cy, dx, dy);
      if (e.cancelable) e.preventDefault();
    };
    const arriba = e => {
      if (e.pointerType === "mouse") { if (e.button === 0) U.apu.f = false; return; }
      const d = dedos[e.pointerId]; if (!d) return;
      delete dedos[e.pointerId];
      if (d.izq) { U.mov.x = 0; U.mov.y = 0; } else U.apu.f = false;
      joy(d.izq ? "i" : "d", null);
    };
    const teclaAbajo = e => {
      if (!UI.gp || document.activeElement && document.activeElement.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if ("wasd".includes(k) && k.length === 1 || k.startsWith("arrow")) { U.teclas[k] = 1; e.preventDefault(); }
      if (k === "e") Golpe.send({ t: "agarrar" });
      if (k === "q") Golpe.send({ t: "cura" });
      if (k === "f") Golpe.send({ t: "usar", q: UI.gp.v.yo && UI.gp.v.yo.auto ? "bajar" : "subir" });
    };
    const teclaArriba = e => { if (UI.gp) delete UI.gp.teclas[e.key.toLowerCase()]; };
    root.addEventListener("pointerdown", abajo); window.addEventListener("pointermove", mover, { passive: false });
    window.addEventListener("pointerup", arriba); window.addEventListener("pointercancel", arriba);
    window.addEventListener("keydown", teclaAbajo); window.addEventListener("keyup", teclaArriba);
    root.oncontextmenu = e => e.preventDefault();
    Golpe.soltarCtrl = () => {
      root.removeEventListener("pointerdown", abajo); window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", arriba); window.removeEventListener("pointercancel", arriba);
      window.removeEventListener("keydown", teclaAbajo); window.removeEventListener("keyup", teclaArriba);
    };
  },
  /* Le pasa al anfitrión una ficha de un solo uso (si hay nube) para que lea el equipo real desde el servidor */
  async mandarKit() {
    const base = { t: "kit", kit: Golpe.kit(), xp: Golpe.xp(), banco: Golpe.banco().total, clan: Golpe.clanTag() };
    if (Golpe.enNube()) { try { const { data, error } = await Nube.sb.rpc("golpe_ficha"); if (!error && typeof data === "string") base.ficha = data; } catch (e) { } }
    Golpe.send(base);
  },
  /* Paso de la caminata: avanza según lo que se movió; vel (0 a 1) suaviza el arranque y la frenada */
  pasos(o, dx, dy, dt) {
    const d = Math.hypot(dx, dy), v = dt > 0 ? d / dt : 0;
    o.vel = (o.vel || 0) + (Math.min(1, v / GP.VEL) - (o.vel || 0)) * Math.min(1, dt * 10);
    o.paso = (o.paso || 0) + d * 0.16;
    if (d > 0.3) o.movA = Math.atan2(dy, dx);
  },
  leerEntrada() {
    const U = UI.gp, T = U.teclas;
    let mx = U.mov.x, my = U.mov.y;
    const kx = (T.d || T.arrowright ? 1 : 0) - (T.a || T.arrowleft ? 1 : 0), ky = (T.s || T.arrowdown ? 1 : 0) - (T.w || T.arrowup ? 1 : 0);
    if (kx || ky) { const m = Math.hypot(kx, ky); mx = kx / m; my = ky / m; }
    let ax = U.apu.x, ay = U.apu.y;
    if (U.raton && U.pantallaYo) { const dx = U.raton.x - U.pantallaYo.x, dy = U.raton.y - U.pantallaYo.y, m = Math.hypot(dx, dy) || 1; ax = dx / m; ay = dy / m; }
    return { mx, my, ax, ay, f: U.apu.f };
  },
  moverYo(dt, now) {
    const U = UI.gp, v = U.v; if (!v) return;
    // Al empezar, le cuenta al anfitrión qué equipo, experiencia y plata trae (online; en este teléfono ya lo sabe)
    if (!U.kitMandado && !Golpe.opts.local && v.yo && v.yo.rol === "civil") { U.kitMandado = true; Golpe.mandarKit(); }
    const I = Golpe.leerEntrada(), r2 = x => Math.round(x * 20) / 20;
    const msg = { t: "in", mx: r2(I.mx), my: r2(I.my), ax: r2(I.ax), ay: r2(I.ay), f: I.f ? 1 : 0 }, txt = JSON.stringify(msg);
    if (v.fase === "juego" && v.yo && v.yo.est === "vivo" && ((txt !== U.ult.s && now - U.ult.t > 45) || now - U.ult.t > 120)) { U.ult = { t: now, s: txt }; Golpe.send(msg); }
    const k = 1 - Math.exp(-dt * 12);
    for (const o of Object.values(U.ents)) { const ox = o.x, oy = o.y; o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; let da = o.ta - o.a; da = Math.atan2(Math.sin(da), Math.cos(da)); o.a += da * k; Golpe.pasos(o, o.x - ox, o.y - oy, dt); }
    for (const o of Object.values(U.autos)) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; let da = o.ta - o.a; da = Math.atan2(Math.sin(da), Math.cos(da)); o.a += da * k; }
    if (U.yo && v.yo && v.yo.est === "vivo" && !v.yo.auto && v.t >= 0 && v.fase === "juego") {
      let mx = I.mx, my = I.my; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
      const vel = GP.VEL * (v.yo.rol === "civil" ? 1.1 : 1) * (v.yo.moch.length > v.yo.cupo * 0.7 ? 0.9 : 1) * (v.yo.trab ? 0.4 : 1);
      const ox = U.yo.x, oy = U.yo.y;
      Golpe.mover(U.M, U.yo, mx * vel * dt, my * vel * dt);
      Golpe.pasos(U.anim || (U.anim = {}), U.yo.x - ox, U.yo.y - oy, dt);
      if (Math.hypot(I.ax, I.ay) > 0.25) U.ang = Math.atan2(I.ay, I.ax); else if (m > 0.2) U.ang = Math.atan2(my, mx);
      const ex = U.srv.x - U.yo.x, ey = U.srv.y - U.yo.y, e = Math.hypot(ex, ey);
      if (e > 160) { U.yo.x = U.srv.x; U.yo.y = U.srv.y; }
      else if (e > 36 || m < 0.1) { const kk = Math.min(1, dt * (m < 0.1 ? 8 : 4)); const nx = U.yo.x + ex * kk, ny = U.yo.y + ey * kk; if (Golpe.libre(U.M, nx, ny, GP.R - 1)) { U.yo.x = nx; U.yo.y = ny; } }
    } else if (v.yo && v.yo.auto && U.autos[v.yo.auto]) { const A = U.autos[v.yo.auto]; U.yo = { x: A.x, y: A.y }; }
    for (const n of U.nums) n.vida -= dt;
    U.nums = U.nums.filter(n => n.vida > 0);
    U.flash = U.flash.filter(f => now - f.t < 90);
  },

  /* ---------- Llega una foto nueva del anfitrión ---------- */
  recibir(v) {
    const U = UI.gp; if (!U) return;
    const now = performance.now(), antes = U.v;
    U.v = v; U.rec = now;
    if (v.yo) {
      U.srv = { x: v.yo.x, y: v.yo.y };
      if (!U.yo || v.yo.est !== "vivo" || (antes && antes.t < 0 && v.t >= 0) || (antes && antes.yo && antes.yo.auto && !v.yo.auto)) U.yo = { x: v.yo.x, y: v.yo.y };
    }
    const vistos = new Set();
    for (const j of v.jug || []) {
      if (j.id === v.me) continue;
      vistos.add(j.id);
      const o = U.ents[j.id] || (U.ents[j.id] = { x: j.x, y: j.y, a: j.a });
      o.tx = j.x; o.ty = j.y; o.ta = j.a; o.d = j;
      if (j.tiro) { U.flash.push({ id: j.id, t: now }); Golpe.tiro(Math.hypot(j.x - (U.yo ? U.yo.x : j.x), j.y - (U.yo ? U.yo.y : j.y))); }
    }
    for (const id of Object.keys(U.ents)) if (!vistos.has(id)) delete U.ents[id];
    const va = new Set();
    for (const a of v.autos || []) { va.add(a.id); const o = U.autos[a.id] || (U.autos[a.id] = { x: a.x, y: a.y, a: a.a }); o.tx = a.x; o.ty = a.y; o.ta = a.a; o.d = a; }
    for (const id of Object.keys(U.autos)) if (!va.has(id)) delete U.autos[id];
    const yoJ = (v.jug || []).find(j => j.id === v.me);
    if (yoJ && yoJ.tiro) { U.flash.push({ id: v.me, t: now }); Golpe.tiro(0); }
    U.yoJ = yoJ || U.yoJ;
    U.balas = (v.balas || []).map(b => ({ ...b, t0: now }));
    for (const h of v.hits || []) {
      const key = h.t + ":" + h.x + ":" + h.y; if (U.visto.has(key)) continue; U.visto.add(key);
      U.nums.push({ x: h.x + (Math.random() - 0.5) * 16, y: h.y - 22, d: h.d, yo: h.yo, a: h.a, ch: h.ch, vida: 0.8 });
      if (h.a) { try { navigator.vibrate && navigator.vibrate(40); } catch {} U.dolor = now; }
    }
    if (U.visto.size > 300) U.visto = new Set([...U.visto].slice(-150));
    if (v.yo && v.yo.junto && typeof Sonido !== "undefined") Sonido.sfx("monedas");
    // Cada vuelta (escape, arresto, muerte, turno) se guarda en el momento: en la nube si hay sesión
    for (const r of (v.yo && v.yo.runs) || []) { U.runsVistos = U.runsVistos || new Set(); if (U.runsVistos.has(r.id)) continue; U.runsVistos.add(r.id); Golpe.guardarBotin(r); }
    Golpe.hud();
  },

  tiro(dist) {
    if (typeof Sonido === "undefined" || !Sonido.ctx || !Sonido.efectosOn || dist > 900) return;
    try {
      const c = Sonido.ctx, len = Math.floor(c.sampleRate * 0.09), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 2400 - dist * 1.6; g.gain.value = 0.32 * Math.max(0.05, 1 - dist / 900);
      src.buffer = buf; src.connect(f).connect(g).connect(Sonido.sfxBus || c.destination); src.start();
    } catch {}
  },

  /* ---------- Dibujo ---------- */
  COL: { 0: "#34363b", 1: "#7a7d82", 2: "#2a272e", 4: "#4a6b3a", 5: "#4a6b3a", 6: "#141317", 7: "#4a6b3a", 8: "#7a7d82", 9: "#b9b5aa" },
  PIEL: ["#f1c9a5", "#e0ac83", "#c68a5e", "#a8693f", "#7c4a2a"],
  hash(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); },
  dibujar(cv, now) {
    const U = UI.gp, v = U.v, M = U.M, T = GP.T, N = GP.N, ctx = cv.getContext("2d");
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth * dpr, H = cv.clientHeight * dpr;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const enAuto = v.yo && v.yo.auto;
    const esc = Math.max(0.45, Math.min(1.2, Math.min(W, H) / dpr / (enAuto ? 760 : 640))) * dpr;
    const vivo = v.yo && v.yo.est === "vivo";
    const ojo = vivo ? U.yo : (U.ents[v.ojo] || U.yo || { x: N * T / 2, y: N * T / 2 });
    const cx = ojo.x, cy = ojo.y, miEd = Golpe.edificioEn(M, ojo.x, ojo.y);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#141317"; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(esc, 0, 0, esc, W / 2 - cx * esc, H / 2 - cy * esc);
    const rc = cv.getBoundingClientRect(); U.pantallaYo = { x: rc.left + W / 2 / dpr, y: rc.top + H / 2 / dpr };
    const vw = W / esc / 2 + T, vh = H / esc / 2 + T;
    const x0 = Math.max(0, Math.floor((cx - vw) / T)), x1 = Math.min(N - 1, Math.floor((cx + vw) / T)), y0 = Math.max(0, Math.floor((cy - vh) / T)), y1 = Math.min(N - 1, Math.floor((cy + vh) / T));
    // Suelo
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = M.t[y * N + x]; if (t === 3 || (t === 2 && M.b[y * N + x])) continue;
      const px = x * T, py = y * T;
      ctx.fillStyle = Golpe.COL[t]; ctx.fillRect(px, py, T + 0.5, T + 0.5);
      if (t === 1 || t === 8) { ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, T / 2, T / 2); ctx.strokeRect(px + T / 2 + 0.5, py + T / 2 + 0.5, T / 2, T / 2); }
      else if (t === 0) { if ((x * 7 + y * 13) % 5 === 0) { ctx.fillStyle = "rgba(255,255,255,.03)"; ctx.fillRect(px + 9, py + 14, 6, 3); } }
      else if (t === 4 || t === 5 || t === 7) { if ((x + y) % 2) { ctx.fillStyle = "rgba(0,0,0,.06)"; ctx.fillRect(px, py, T, T); } }
      else if (t === 9) { ctx.strokeStyle = "rgba(0,0,0,.08)"; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1); }
      else if (t === 2) { ctx.fillStyle = "#8d9096"; ctx.fillRect(px, py, T + 0.5, T + 0.5); ctx.strokeStyle = "#5b5e63"; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 4; k < T; k += 8) { ctx.moveTo(px + k, py); ctx.lineTo(px + k, py + T); } ctx.stroke(); }
    }
    // Líneas de carril y sendas peatonales
    ctx.strokeStyle = "rgba(240,200,80,.45)"; ctx.lineWidth = 2; ctx.setLineDash([24, 20]);
    for (let k = 0; k <= GP.NB; k++) { const c = (k * 15 + 1.5) * T; ctx.beginPath(); ctx.moveTo(T, c); ctx.lineTo((N - 1) * T, c); ctx.moveTo(c, T); ctx.lineTo(c, (N - 1) * T); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(235,235,235,.5)";
    for (let ky = 0; ky <= GP.NB; ky++) for (let kx = 0; kx <= GP.NB; kx++) {
      const ix = kx * 15 * T, iy = ky * 15 * T; if (ix < cx - vw - 200 || ix > cx + vw + 200 || iy < cy - vh - 200 || iy > cy + vh + 200) continue;
      for (let i = 0; i < 6; i++) { ctx.fillRect(ix + 3 * T + 4, iy + 6 + i * 20, 22, 9); ctx.fillRect(ix - 26, iy + 6 + i * 20, 22, 9); ctx.fillRect(ix + 6 + i * 20, iy + 3 * T + 4, 9, 22); ctx.fillRect(ix + 6 + i * 20, iy - 26, 9, 22); }
    }
    // Zona segura
    const Z = M.segura;
    if (Z && Math.abs(Z.cx - cx) < vw + 500 && Math.abs(Z.cy - cy) < vh + 500) {
      ctx.strokeStyle = "rgba(47,158,68,.85)"; ctx.lineWidth = 4; ctx.setLineDash([16, 10]); ctx.strokeRect((Z.x0 + 1) * T + 6, (Z.y0 + 1) * T + 6, (Z.x1 - Z.x0 - 1) * T - 12, (Z.y1 - Z.y0 - 1) * T - 12); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(30,80,40,.85)"; ctx.font = "800 14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("ZONA SEGURA · NO SE PUEDE DISPARAR", Z.cx, (Z.y1 - 1) * T + 2);
    }
    // Árboles y contenedores
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = M.t[y * N + x], px = x * T, py = y * T;
      if (t === 5) { ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.arc(px + 25, py + 26, 22, 0, 7); ctx.fill(); ctx.fillStyle = "#2f5426"; ctx.beginPath(); ctx.arc(px + 20, py + 20, 22, 0, 7); ctx.fill(); ctx.fillStyle = "#3b6a30"; for (const [a, b, c] of [[13, 14, 10], [26, 16, 9], [18, 27, 9]]) { ctx.beginPath(); ctx.arc(px + a, py + b, c, 0, 7); ctx.fill(); } }
      if (t === 8) { ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(px + 6, py + 9, 32, 26); ctx.fillStyle = "#2f5a43"; ctx.fillRect(px + 3, py + 6, 32, 26); ctx.fillStyle = "#264a37"; ctx.fillRect(px + 3, py + 6, 32, 6); ctx.strokeStyle = "#1c3528"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px + 19, py + 6); ctx.lineTo(px + 19, py + 32); ctx.stroke(); }
    }
    // Salidas
    for (const o of M.salidas) {
      if (Math.abs(o.x - cx) > vw + 100 || Math.abs(o.y - cy) > vh + 100) continue;
      const p = 0.5 + 0.5 * Math.sin(now / 300);
      ctx.fillStyle = `rgba(81,207,102,${0.12 + 0.1 * p})`; ctx.beginPath(); ctx.arc(o.x, o.y, GP.SALIDA_R, 0, 7); ctx.fill();
      ctx.strokeStyle = "#51cf66"; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(o.x, o.y, GP.SALIDA_R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#e6fcf5"; ctx.font = "900 14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("SALIDA", o.x, o.y);
    }
    // Edificios
    const alarma = {}; for (const [id, on, son] of v.alarmas || []) alarma[id] = { on, son };
    const cajasAb = new Set(v.cajas || []);
    for (const E of M.ed) {
      if (!E) continue;
      const D = GP.EDIF[E.tipo], ex = E.x0 * T, ey = E.y0 * T, ew = (E.x1 - E.x0 + 1) * T, eh = (E.y1 - E.y0 + 1) * T;
      if (ex > cx + vw || ex + ew < cx - vw || ey > cy + vh || ey + eh < cy - vh) continue;
      const A = alarma[E.id], suena = A && A.son, parp = suena && Math.floor(now / 250) % 2;
      if (E.id === miEd) {
        for (let y = E.y0; y <= E.y1; y++) for (let x = E.x0; x <= E.x1; x++) {
          const t = M.t[y * N + x];
          if (t === 2) { ctx.fillStyle = "#2a272e"; ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5); continue; }
          ctx.fillStyle = (x + y) % 2 ? D.piso : Golpe.oscurecer(D.piso, 0.06); ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5);
        }
        if (suena) { ctx.fillStyle = `rgba(255,40,40,${parp ? 0.14 : 0.04})`; ctx.fillRect(ex, ey, ew, eh); }
      } else {
        ctx.fillStyle = "rgba(0,0,0,.38)"; ctx.fillRect(ex + 10, ey + 12, ew, eh);
        ctx.fillStyle = D.techo; ctx.fillRect(ex, ey, ew, eh);
        ctx.fillStyle = "rgba(255,255,255,.05)"; for (let k = 0; k < ew; k += 20) ctx.fillRect(ex + k, ey, 1, eh);
        ctx.strokeStyle = Golpe.oscurecer(D.techo, 0.35); ctx.lineWidth = 7; ctx.strokeRect(ex + 3.5, ey + 3.5, ew - 7, eh - 7);
        for (const q of U.deco[E.id] || []) {
          const qx = ex + q.x * ew, qy = ey + q.y * eh;
          if (q.tanque) { ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.arc(qx + 4, qy + 5, 14, 0, 7); ctx.fill(); ctx.fillStyle = "#9aa0a6"; ctx.beginPath(); ctx.arc(qx, qy, 14, 0, 7); ctx.fill(); ctx.strokeStyle = "#6c7177"; ctx.lineWidth = 2; ctx.stroke(); }
          else { const w = q.w * ew, h = q.h * eh; ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(qx + 4, qy + 4, w, h); ctx.fillStyle = "#b8bcc2"; ctx.fillRect(qx, qy, w, h); ctx.strokeStyle = "#7d8288"; ctx.lineWidth = 1.5; ctx.strokeRect(qx, qy, w, h); ctx.beginPath(); ctx.arc(qx + w / 2, qy + h / 2, Math.min(w, h) * 0.32, 0, 7); ctx.stroke(); }
        }
        const nombre = D.n.toUpperCase(); ctx.font = "800 15px system-ui"; const tw = ctx.measureText(nombre).width + 18;
        ctx.fillStyle = "rgba(15,14,20,.82)"; ctx.fillRect(ex + ew / 2 - tw / 2, ey + eh / 2 - 13, tw, 26);
        ctx.fillStyle = D.tier >= 2 ? GP.RAR[D.tier + 1][1] : "#e9ecef"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(nombre, ex + ew / 2, ey + eh / 2 + 1);
        if (suena) { ctx.strokeStyle = parp ? "#ff3b3b" : "rgba(255,59,59,.3)"; ctx.lineWidth = 8; ctx.strokeRect(ex + 4, ey + 4, ew - 8, eh - 8); ctx.fillStyle = "#ff3b3b"; ctx.font = "900 13px system-ui"; ctx.fillText("ALARMA", ex + ew / 2, ey + eh / 2 + 26); }
      }
    }
    // Objetos fijos: paneles de alarma, cajas fuertes, mostradores
    for (const o of M.obj) {
      if (Math.abs(o.x - cx) > vw || Math.abs(o.y - cy) > vh) continue;
      if (o.ed && o.ed !== miEd) continue;
      if (o.k === "alarma") {
        const A = alarma[o.ed] || {}, led = A.son ? (Math.floor(now / 200) % 2 ? "#ff3b3b" : "#5a1010") : A.on ? "#e03131" : "#40c057";
        ctx.fillStyle = "#1e2024"; ctx.fillRect(o.x - 11, o.y - 14, 22, 28); ctx.strokeStyle = "#555a61"; ctx.lineWidth = 2; ctx.strokeRect(o.x - 11, o.y - 14, 22, 28);
        ctx.fillStyle = "#6c737b"; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.fillRect(o.x - 7 + i * 5, o.y - 4 + j * 5, 3, 3);
        ctx.fillStyle = led; ctx.beginPath(); ctx.arc(o.x, o.y - 9, 3, 0, 7); ctx.fill();
      } else if (o.k === "caja") {
        const ab = cajasAb.has(o.id);
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(o.x - 15, o.y - 12, 34, 32);
        ctx.fillStyle = "#4b4f56"; ctx.fillRect(o.x - 17, o.y - 16, 34, 32); ctx.strokeStyle = "#2c2f34"; ctx.lineWidth = 2; ctx.strokeRect(o.x - 17, o.y - 16, 34, 32);
        if (ab) { ctx.fillStyle = "#1a1b1e"; ctx.fillRect(o.x - 13, o.y - 12, 26, 24); ctx.fillStyle = "#5f646b"; ctx.fillRect(o.x - 24, o.y - 14, 8, 28); }
        else { ctx.strokeStyle = "#9aa0a6"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(o.x, o.y, 8, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + 5, o.y - 5); ctx.stroke(); ctx.fillStyle = "#9aa0a6"; ctx.fillRect(o.x + 10, o.y - 3, 4, 6); }
      } else if (o.k === "tienda" || o.k === "armeria") {
        Golpe.dibCuerpo(ctx, o.x, o.y - 30, Math.PI / 2, { ropa: o.k === "armeria" ? "#6b5b3e" : "#2b2b2b", piel: Golpe.PIEL[o.id % 5], pelo: "#2a1d14" });
        ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(o.x - 46, o.y - 10, 96, 28);
        ctx.fillStyle = o.k === "armeria" ? "#5c4a32" : "#3b2f4d"; ctx.fillRect(o.x - 50, o.y - 14, 100, 26); ctx.strokeStyle = "#1c1620"; ctx.lineWidth = 2; ctx.strokeRect(o.x - 50, o.y - 14, 100, 26);
        ctx.fillStyle = "#e9ecef"; ctx.font = "900 12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(o.k === "armeria" ? "ARMERÍA" : "REDUCIDOR", o.x, o.y - 1);
      }
    }
    // Cosas en el piso
    for (const it of v.items || []) {
      const ib = GP.BOLSOS.indexOf(it.n);
      const col = it.k === "art" || it.k === "arma" ? GP.RAR[it.r][1] : it.k === "chaleco" ? GP.RAR[Math.min(4, it.n + 1)][1] : it.k === "bolso" ? GP.RAR[Math.max(0, ib) + 1][1] : it.k === "llave" || it.k === "plata" ? "#ffd43b" : "#e9ecef";
      const p = 0.6 + 0.4 * Math.sin(now / 300 + it.id);
      ctx.fillStyle = Golpe.alfa(col, 0.12 + 0.1 * p); ctx.beginPath(); ctx.arc(it.x, it.y, 18, 0, 7); ctx.fill();
      ctx.strokeStyle = Golpe.alfa(col, 0.75); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(it.x, it.y, 17, 0, 7); ctx.stroke();
      Golpe.dibIcono(ctx, it.k === "art" ? "art-" + GP.ART[it.a][1] : it.k === "arma" ? "arma-" + it.a : it.k, it.x, it.y, it.k === "arma" ? 0.42 : 0.4);
    }
    // Autos
    for (const o of Object.values(U.autos)) Golpe.dibAuto(ctx, o.x, o.y, o.a, o.d, now);
    // Balas
    ctx.lineCap = "round";
    for (const b of U.balas) {
      const s = (now - b.t0) / 1000, x = b.x + b.vx * s, y = b.y + b.vy * s;
      ctx.strokeStyle = "rgba(255,236,170,.9)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - b.vx * 0.02, y - b.vy * 0.02); ctx.lineTo(x, y); ctx.stroke();
    }
    // Personas
    for (const o of Object.values(U.ents)) Golpe.dibPersona(ctx, o.x, o.y, o.a, o.d, false, now, U, o);
    if (vivo && !enAuto && U.yoJ) Golpe.dibPersona(ctx, U.yo.x, U.yo.y, U.ang ?? U.yoJ.a, { ...U.yoJ, rol: v.yo.rol, hp: v.yo.hp, ext: v.yo.ext, esc: v.yo.esc, arma: v.yo.arma ? v.yo.arma.a : null, ar: v.yo.arma ? v.yo.arma.r : 0 }, true, now, U, U.anim);
    // Arbustos encima de la gente (tapan al que se esconde)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (M.t[y * N + x] === 7) {
      const px = x * T, py = y * T;
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.arc(px + 23, py + 24, 22, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(47,90,42,.93)"; for (const [a, b, c] of [[12, 13, 13], [28, 12, 13], [20, 27, 14], [8, 26, 10], [32, 28, 10]]) { ctx.beginPath(); ctx.arc(px + a, py + b, c, 0, 7); ctx.fill(); }
      ctx.fillStyle = "#3d7234"; for (const [a, b, c] of [[14, 11, 6], [27, 10, 6], [20, 24, 7]]) { ctx.beginPath(); ctx.arc(px + a, py + b, c, 0, 7); ctx.fill(); }
    }
    // Números de daño
    for (const n of U.nums) {
      ctx.globalAlpha = Math.min(1, n.vida * 2); ctx.font = `900 ${n.yo ? 17 : 14}px system-ui`; ctx.textAlign = "center";
      ctx.fillStyle = n.a ? "#ff6b6b" : n.yo ? "#ffd43b" : "rgba(255,255,255,.75)";
      ctx.fillText(String(n.d), n.x, n.y - (0.8 - n.vida) * 40); ctx.globalAlpha = 1;
    }
    // Niebla y golpe recibido
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const R = GP.VISION * esc * (enAuto ? 1.15 : 1), g = ctx.createRadialGradient(W / 2, H / 2, R * 0.7, W / 2, H / 2, R);
    g.addColorStop(0, "rgba(10,9,14,0)"); g.addColorStop(1, "rgba(10,9,14,.9)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (U.dolor && now - U.dolor < 300) { const k = 1 - (now - U.dolor) / 300, g2 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); g2.addColorStop(0, "rgba(255,0,0,0)"); g2.addColorStop(1, `rgba(255,30,30,${0.45 * k})`); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H); }
    if (!U.miniT || now - U.miniT > 200) { U.miniT = now; Golpe.dibMini(cx, cy, now); }
  },
  /* Persona vista desde arriba: hombros, brazos y cabeza */
  dibCuerpo(ctx, x, y, a, o) {
    const br = o.braceo || 0, bob = 1 + (o.bob || 0) * 0.05;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(bob, bob);
    ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(3, 4, 12, 17, 0, 0, 7); ctx.fill();
    ctx.fillStyle = o.ropa;
    if (o.arma) { ctx.beginPath(); ctx.ellipse(8, -8, 9, 4, 0.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(10, 7, 10, 4, -0.3, 0, 7); ctx.fill(); ctx.fillStyle = o.piel; ctx.beginPath(); ctx.arc(16, 1, 3.5, 0, 7); ctx.fill(); }
    else {
      // brazos que se balancean al caminar (opuestos a los pies)
      ctx.beginPath(); ctx.ellipse(1 - br, -14, 6, 4.5, 0.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(1 + br, 14, 6, 4.5, -0.2, 0, 7); ctx.fill();
      ctx.fillStyle = o.piel; ctx.beginPath(); ctx.arc(5 - br * 1.2, -15, 2.6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(5 + br * 1.2, 15, 2.6, 0, 7); ctx.fill(); ctx.fillStyle = o.ropa;
    }
    ctx.fillStyle = o.ropa; ctx.beginPath(); ctx.ellipse(0, 0, 9, 14, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.2; ctx.stroke();
    if (o.detalle) o.detalle(ctx);
    ctx.fillStyle = o.cabeza || o.piel; ctx.beginPath(); ctx.arc(1, 0, 7.5, 0, 7); ctx.fill();
    if (o.pelo) { ctx.fillStyle = o.pelo; ctx.beginPath(); ctx.arc(-0.5, 0, 7.2, Math.PI * 0.55, Math.PI * 1.45); ctx.fill(); }
    if (o.gorra) { ctx.fillStyle = o.gorra; ctx.beginPath(); ctx.arc(0, 0, 7.8, 0, 7); ctx.fill(); ctx.fillRect(4, -5, 6, 10); ctx.fillStyle = "#d4a72c"; ctx.beginPath(); ctx.arc(2, 0, 1.6, 0, 7); ctx.fill(); }
    if (o.mascara) { ctx.fillStyle = "#e9d9c4"; ctx.fillRect(4.5, -3.5, 2.2, 2.4); ctx.fillRect(4.5, 1.1, 2.2, 2.4); }
    ctx.restore();
  },
  aspecto(d) {
    const h = Golpe.hash(d.id), piel = Golpe.PIEL[h % 5];
    if (d.rol === "policia") return { ropa: "#1f3a5f", piel, gorra: "#16243a", detalle: c => { c.fillStyle = "#d4a72c"; c.beginPath(); c.arc(-2, -6, 1.8, 0, 7); c.fill(); c.fillStyle = "#121a26"; c.fillRect(-3, -11, 2, 22); } };
    if (d.rol === "ladron") return { ropa: ["#2b2b2e", "#3a2f2a", "#23272e"][h % 3], piel, cabeza: "#151517", mascara: true };
    const ropas = ["#c0504d", "#4f81bd", "#9bbb59", "#8064a2", "#f79646", "#d9d9d9", "#4bacc6", "#7f6a4f", "#c9a227"];
    return { ropa: ropas[h % ropas.length], piel, pelo: ["#2a1d14", "#5a3b22", "#b08d57", "#111", "#7a4a2a"][(h >> 3) % 5] };
  },
  dibPersona(ctx, x, y, a, d, yo, now, U, anim) {
    if (!d) return;
    const vel = anim ? anim.vel || 0 : 0, paso = anim ? anim.paso || 0 : 0, movA = anim && anim.movA !== undefined ? anim.movA : a;
    // Piernas: los pies se adelantan y atrasan en la dirección en que camina
    if (vel > 0.05) {
      const sw = Math.sin(paso) * 13 * vel;
      ctx.save(); ctx.translate(x, y); ctx.rotate(movA);
      ctx.strokeStyle = "#2b2830"; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(sw, -5); ctx.moveTo(0, 5); ctx.lineTo(-sw, 5); ctx.stroke();
      ctx.fillStyle = "#151318";
      ctx.beginPath(); ctx.ellipse(sw + Math.sign(sw) * 2, -5, 5, 3.4, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-sw - Math.sign(sw) * 2, 5, 5, 3.4, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    if (yo && d.esc) ctx.globalAlpha = 0.55;
    if (d.ext > 0) { ctx.strokeStyle = "#51cf66"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, d.ext / GP.ESCAPE)); ctx.stroke(); }
    if (yo) { ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.stroke(); }
    if (d.arma) Golpe.dibArmaMano(ctx, x, y, a, d.arma, GP.RAR[d.ar || 0][1]);
    Golpe.dibCuerpo(ctx, x, y, a, { ...Golpe.aspecto(d), arma: !!d.arma, braceo: Math.sin(paso) * 5 * vel, bob: Math.abs(Math.sin(paso)) * vel });
    if (d.arma && U.flash.some(f => f.id === d.id)) { const L = { pistola: 26, subfusil: 30, escopeta: 34, rifle: 40 }[d.arma] || 26; ctx.fillStyle = "rgba(255,225,130,.95)"; ctx.beginPath(); ctx.arc(x + Math.cos(a) * L, y + Math.sin(a) * L, 6, 0, 7); ctx.fill(); }
    if (d.golpe) { ctx.fillStyle = "rgba(255,50,50,.4)"; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill(); }
    if (d.prot) { ctx.strokeStyle = `rgba(116,192,252,${0.45 + 0.3 * Math.sin(now / 120)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 21, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (!yo) {
      const k = Math.max(0, d.hp / d.hpMax);
      if (k < 1) { ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(x - 15, y - 27, 30, 4); ctx.fillStyle = k > 0.5 ? "#69db7c" : k > 0.25 ? "#fcc419" : "#ff6b6b"; ctx.fillRect(x - 15, y - 27, 30 * k, 4); }
      ctx.font = "700 10px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,.55)"; const w = ctx.measureText(d.name).width + 8; ctx.fillRect(x - w / 2, y + 20, w, 13);
      ctx.fillStyle = d.cpu ? "rgba(255,255,255,.75)" : "#ffe066"; ctx.fillText(d.name, x, y + 27);
    }
  },
  dibArmaMano(ctx, x, y, a, tipo, col) {
    const L = { pistola: 12, subfusil: 18, escopeta: 24, rifle: 30 }[tipo] || 12;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = "#1b1c1f"; ctx.fillRect(12, -2.5, L, 5);
    ctx.fillStyle = col; ctx.fillRect(12, -1, Math.min(6, L / 3), 2);
    if (tipo === "escopeta") { ctx.fillStyle = "#6b4a2b"; ctx.fillRect(8, -3, 8, 6); }
    ctx.restore();
  },
  dibAuto(ctx, x, y, a, d, now) {
    const pat = d.tipo === "patrullero";
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.roundRect(-22, -10, 50, 26, 6); ctx.fill();
    ctx.fillStyle = d.color; ctx.beginPath(); ctx.roundRect(-25, -12, 50, 24, 6); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1.5; ctx.stroke();
    if (pat) { ctx.fillStyle = "#1c3f73"; ctx.fillRect(-8, -12, 16, 24); }
    ctx.fillStyle = "rgba(20,28,38,.9)"; ctx.beginPath(); ctx.roundRect(6, -9, 9, 18, 2); ctx.fill(); ctx.beginPath(); ctx.roundRect(-20, -8, 6, 16, 2); ctx.fill();
    ctx.fillStyle = Golpe.oscurecer(pat ? "#f8f9fa" : d.color, 0.12); ctx.fillRect(-13, -9, 18, 18);
    ctx.fillStyle = "#fff6c9"; ctx.fillRect(23, -10, 2.5, 5); ctx.fillRect(23, 5, 2.5, 5);
    ctx.fillStyle = "#b02525"; ctx.fillRect(-25.5, -10, 2, 5); ctx.fillRect(-25.5, 5, 2, 5);
    if (pat) { const on = Math.abs(d.v) > 30, f = Math.floor(now / 160) % 2; ctx.fillStyle = on && f ? "#ff2a2a" : "#7a1010"; ctx.fillRect(-4, -8, 5, 7); ctx.fillStyle = on && !f ? "#2f7bff" : "#173070"; ctx.fillRect(-4, 1, 5, 7); }
    ctx.restore();
    if (d.cond) {
      ctx.font = "700 10px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(d.cond.name).width + 8; ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x - w / 2, y + 22, w, 13);
      ctx.fillStyle = d.cond.cpu ? "rgba(255,255,255,.75)" : "#ffe066"; ctx.fillText(d.cond.name, x, y + 29);
      if (d.cond.ext > 0) { ctx.strokeStyle = "#51cf66"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, d.cond.ext / GP.ESCAPE)); ctx.stroke(); }
    }
  },
  oscurecer(hex, k) { if (hex[0] !== "#") return hex; const n = parseInt(hex.slice(1), 16), f = c => Math.max(0, Math.round(c * (1 - k))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; },
  alfa(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; },
  miniBase(M) {
    const N = GP.N, c = document.createElement("canvas"); c.width = c.height = N * 2; const x = c.getContext("2d"), Z = M.segura;
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
      const t = M.t[ty * N + tx], b = M.b[ty * N + tx], enZ = Z && tx >= Z.x0 && tx <= Z.x1 && ty >= Z.y0 && ty <= Z.y1;
      x.fillStyle = (t === 3 || t === 2) && b ? GP.EDIF[M.ed[b].tipo].techo : enZ ? "#2f9e44" : Golpe.COL[t]; x.fillRect(tx * 2, ty * 2, 2, 2);
    }
    return c;
  },
  dibMini(cx, cy, now) {
    const U = UI.gp, cv = byId("gpMini"); if (!cv || !U) return;
    const x = cv.getContext("2d"), k = cv.width / (GP.N * GP.T), v = U.v, T = GP.T;
    x.drawImage(U.mini, 0, 0, cv.width, cv.height);
    for (const [id, , son] of v.alarmas || []) if (son && Math.floor(now / 400) % 2) { const E = U.M.ed[id]; x.strokeStyle = "#ff3b3b"; x.lineWidth = 3; x.strokeRect(E.x0 * T * k, E.y0 * T * k, 10 * T * k, 10 * T * k); }
    for (const o of U.M.obj) if (o.k === "tienda" || o.k === "armeria") { x.fillStyle = o.k === "armeria" ? "#ffd43b" : "#cc5de8"; x.fillRect(o.x * k - 3, o.y * k - 3, 6, 6); }
    x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 1; x.beginPath(); x.arc(cx * k, cy * k, GP.VISION * k, 0, 7); x.stroke();
    for (const o of U.M.salidas) { x.fillStyle = "#51cf66"; x.beginPath(); x.arc(o.x * k, o.y * k, 5, 0, 7); x.fill(); x.strokeStyle = "#0b3d1a"; x.lineWidth = 1.5; x.stroke(); }
    for (const e of v.equipo || []) if (e.est === "vivo") { x.fillStyle = "#ffd43b"; x.beginPath(); x.arc(e.x * k, e.y * k, 3, 0, 7); x.fill(); }
    x.fillStyle = "#fff"; x.beginPath(); x.arc(cx * k, cy * k, 3.5, 0, 7); x.fill(); x.strokeStyle = "#000"; x.lineWidth = 1; x.stroke();
  },

  /* ---------- HUD ---------- */
  ic(k, t) { return `<img class="gp-ic" src="${Golpe.icono(k)}" alt="" ${t ? `title="${esc(t)}"` : ""}>`; },
  hud() {
    const U = UI.gp; if (!U) return;
    const v = U.v, Y = v.yo, top = byId("gpTop"), ic = Golpe.ic;
    if (top && Y) {
      const R = GP.ROLES[Y.rol] || GP.ROLES.civil, falta = Math.max(0, Math.ceil(v.dur - Math.max(0, v.t))), mm = Math.floor(falta / 60), ss = String(falta % 60).padStart(2, "0");
      const k = Math.max(0, Y.hp / Y.hpMax), rango = Y.rol === "policia" ? GP.RANGOS[Y.rango || 0][0] : null;
      const arma = Y.arma ? `${ic("arma-" + Y.arma.a)}<span style="color:${GP.RAR[Y.arma.r][1]}">${GP.ARMAS[Y.arma.a].n}</span><small>${GP.RAR[Y.arma.r][0]}</small>` : `<small>Sin arma: buscá una o comprala</small>`;
      const html = `<span class="ar-chip gp-rolchip" style="--rc:${R.color}"><i></i><b>${rango || R.n}</b></span>
        <span class="ar-chip ${falta < 60 ? "gp-urge" : ""}"><b>${mm}:${ss}</b></span>
        ${Y.seguro ? `<span class="ar-chip gp-segura">Zona segura</span>` : ""}
        ${Y.esc ? `<span class="ar-chip gp-oculto">Escondido</span>` : ""}
        ${Y.seguro && !Y.verif && !Golpe.opts.local ? `<span class="ar-chip gp-sinverif" title="Tu equipo se limita hasta que el anfitrión lo verifique con la nube">Equipo sin verificar</span>` : ""}
        ${Y.rol === "ladron" ? `<span class="ar-chip">${ic("bolso")}<b>${Y.moch.length}/${Y.cupo}</b><small>$${Y.valor}</small></span><span class="ar-chip">${ic("plata")}<b>$${Y.plata}</b></span>${Y.llaves ? `<span class="ar-chip">${ic("llave")}<b>${Y.llaves}</b></span>` : ""}` : ""}
        ${Y.rol === "policia" ? `<span class="ar-chip">${ic("placa")}<b>${Y.arrestos}</b><small>arresto${Y.arrestos === 1 ? "" : "s"}</small></span>` : ""}
        <div class="gp-vida"><i style="width:${k * 100}%;background:${k > 0.5 ? "#40c057" : k > 0.25 ? "#fcc419" : "#fa5252"}"></i><span>Vida ${Math.max(0, Y.hp)}${Y.ch ? ` · Chaleco ${Y.ch}` : ""}</span></div>
        ${Y.rol !== "civil" ? `<div class="gp-arma">${arma}</div>` : `<div class="gp-arma"><small>Civil: no podés robar. Volvete ladrón o andá a la comisaría.</small></div>`}
        ${Y.moch.length ? `<div class="gp-moch">${Y.moch.map(it => `<i style="--rc:${GP.RAR[it.r][1]}">${ic("art-" + GP.ART[it.a][1], `${GP.ART[it.a][0]} · ${GP.RAR[it.r][0]} · $${it.v}`)}</i>`).join("")}</div>` : ""}`;
      if (top.dataset.h !== html) { top.innerHTML = html; top.dataset.h = html; }
      Golpe.botones(Y, v);
      Golpe.pintarTienda(Y);
      const tr = byId("gpTrab");
      if (tr) { tr.hidden = !Y.trab; if (Y.trab) { tr.firstChild.textContent = Y.trab.tipo === "alarma" ? "Desactivando la alarma…" : "Abriendo la caja fuerte…"; tr.lastChild.style.width = Math.round(Y.trab.p * 100) + "%"; } }
    }
    const feed = byId("gpFeed");
    if (feed) { const html = (v.feed || []).filter(f => v.t - f.t < 8).map(f => `<div>${esc(f.txt)}</div>`).join(""); if (feed.dataset.h !== html) { feed.innerHTML = html; feed.dataset.h = html; } }
    const cen = byId("gpCentro");
    if (cen && Y) {
      let txt = "";
      if (v.fase === "fin") txt = "";
      else if (v.t < 0) txt = String(Math.ceil(-v.t));
      else if (Y.nota) txt = Y.nota;
      else if (Y.ultRun && Y.ultRun.tipo === "escape") txt = `Escapaste${Y.ultRun.plata ? ` con $${Y.ultRun.plata}` : ""} · volvés a la zona segura`;
      else if (Y.ultRun && Y.ultRun.tipo === "preso") txt = "Te arrestaron: perdiste lo robado, conservás tu equipo";
      else if (Y.ultRun && Y.ultRun.tipo === "muerto") txt = "Te mataron: perdiste todo";
      else if (Y.ultRun && Y.ultRun.tipo === "turno") txt = `Terminaste el turno: cobraste $${Y.ultRun.plata}`;
      else if (Y.est === "casa") txt = `Volviendo a la zona segura… ${Y.vuelve}`;
      else if (Y.est === "caido") txt = `Caíste · volvés a la comisaría en ${Y.vuelve}`;
      else if (Y.ext > 0) txt = `Escapando… ${Math.max(0, GP.ESCAPE - Y.ext).toFixed(1)}`;
      else if (Y.vendio) txt = `Vendiste por $${Y.vendio}`;
      else if (Y.compra) txt = Y.compra.ok ? `Compraste: ${Y.compra.n}` : "No te alcanza la plata";
      else if (v.t < 3) txt = "Estás en la zona segura";
      else if (U.rolVisto !== Y.rol && Y.rol !== "civil") { U.rolT = U.rolT || performance.now(); if (performance.now() - U.rolT < 1800) txt = Y.rol === "policia" ? "Ahora sos policía" : "Ahora sos ladrón"; else U.rolVisto = Y.rol; }
      cen.hidden = !txt; if (cen.textContent !== txt) { cen.textContent = txt; cen.classList.remove("pop"); void cen.offsetWidth; cen.classList.add("pop"); }
    }
    const fin = byId("gpFin");
    if (fin) {
      fin.hidden = v.fase !== "fin";
      if (v.fase === "fin" && !fin.dataset.listo) {
        fin.dataset.listo = 1;
        const yoH = (v.humanos || []).find(h => h.id === v.me);
        const res = Golpe.opts.local && S.extra ? Golpe.resultado(S.extra, v.me) : v.resultado;
        const estado = h => h.valor ? `ganó $${h.valor}${h.escapes ? ` · ${h.escapes} escape${h.escapes > 1 ? "s" : ""}` : ""}` : "no sacó plata";
        const filas = (v.humanos || []).slice().sort((a, b) => (a.puesto || 9) - (b.puesto || 9)).map(h => ({ puesto: h.puesto, name: `${h.name} · ${(GP.ROLES[h.rol] || {}).n || ""}`, yo: h.id === v.me, txt: `${estado(h)}${h.kills ? ` · ${h.kills} baja${h.kills > 1 ? "s" : ""}` : ""}${h.arrestos ? ` · ${h.arrestos} arresto${h.arrestos > 1 ? "s" : ""}` : ""}` }));
        const titulo = yoH && yoH.valor ? `Fin de la sesión · ganaste $${yoH.valor}` : "Fin de la sesión";
        const banco = Golpe.banco();
        const sub = `Plata guardada: <b>$${banco.total.toLocaleString("es-AR")}</b>${res ? "<br>" + Golpe.textoCuenta(res) : ""}`;
        fin.innerHTML = Turnero.tablaFin(v, filas, titulo, sub, Golpe.send, Golpe.opts);
        Turnero.conectarFin(Golpe.send, Golpe.opts);
      }
    }
  },
  /* Botones según lo que tengas cerca y tu rol */
  botones(Y, v) {
    const U = UI.gp, cont = byId("gpAcc"); if (!cont) return;
    const b = [], vivo = Y.est === "vivo", p = U.yo || Y, d = o => Math.hypot(o.x - p.x, o.y - p.y);
    const cerca = (k, r = 52) => U.M.obj.filter(o => o.k === k && d(o) < r)[0];
    const alarma = {}; for (const [id, on] of v.alarmas || []) alarma[id] = on;
    if (vivo) {
      const enComi = (U.M.ed[Golpe.edificioEn(U.M, p.x, p.y)] || {}).tipo === "comisaria";
      if (Y.seguro && cerca("armeria", 110)) b.push(["tienda", "Armería", "gp-dorado"]);
      if (Y.rol === "civil" && enComi) b.push(["policia", `Hacerse policía · ${Y.policias}/${GP.MAX_POLI}`, Y.policias >= GP.MAX_POLI ? "gp-off" : "gp-azul"]);
      if (Y.rol === "policia" && enComi) b.push(["turno", "Terminar turno y cobrar", "gp-dorado"]);
      if (Y.rol === "civil") b.push(["ladron", "Volverse ladrón", "gp-rojo"]);
      if (Y.auto) b.push(["bajar", "Bajar del auto"]);
      else {
        const A = Object.values(U.autos).filter(o => !o.d.cond && Math.hypot(o.x - p.x, o.y - p.y) < 56)[0];
        if (A && (A.d.tipo !== "patrullero" || Y.rol === "policia")) b.push(["subir", A.d.tipo === "patrullero" ? "Subir al patrullero" : "Subir al auto"]);
        if (Y.rol === "ladron") {
          if (Y.moch.length && cerca("tienda", 70)) b.push(["vender", `Vender todo · $${Y.valor}`, "gp-dorado"]);
          const pa = cerca("alarma"); if (pa && alarma[pa.ed]) b.push(["alarma", "Desactivar alarma"]);
          const cj = cerca("caja"); if (cj && !(v.cajas || []).includes(cj.id)) b.push(["caja", Y.llaves ? "Abrir caja fuerte" : "Caja fuerte: necesitás una llave", Y.llaves ? "" : "gp-off"]);
          if (Y.baul && A) { if (Y.moch.length && Y.baul.n < Y.baul.cupo) b.push(["guardar", `Guardar en el baúl · ${Y.baul.n}/${Y.baul.cupo}`]); if (Y.baul.n && Y.moch.length < Y.cupo) b.push(["sacar", `Sacar del baúl · ${Y.baul.n}`]); }
        }
        const arma = Y.rol !== "civil" && (v.items || []).find(i => i.k === "arma" && Math.hypot(i.x - p.x, i.y - p.y) < 46);
        if (arma) b.push(["agarrar", `Agarrar ${GP.ARMAS[arma.a].n.toLowerCase()} · ${GP.RAR[arma.r][0].toLowerCase()}`]);
      }
      if (Y.cura > 0 && Y.rol !== "civil") b.push(["cura", `Botiquín · ${Y.cura}`, Y.hp >= Y.hpMax ? "gp-off" : ""]);
    }
    const html = b.map(([a, t, c]) => `<button class="gp-b ${c || ""}" data-acc="${a}" ${c === "gp-off" ? "disabled" : ""}>${t}</button>`).join("");
    if (cont.dataset.h !== html) { cont.innerHTML = html; cont.dataset.h = html; }
  },
  /* Armería: catálogo con precios; se paga con la plata encima y la guardada */
  pintarTienda(Y) {
    const U = UI.gp, el = byId("gpTienda"); if (!el) return;
    const p = U.yo || Y, abierta = U.tienda && Y.est === "vivo" && Y.seguro && U.M.obj.some(o => o.k === "armeria" && Math.hypot(o.x - p.x, o.y - p.y) < 130);
    el.hidden = !abierta; if (!abierta) { if (U.tienda && !Y.seguro) U.tienda = false; return; }
    const K = Y.rol === "ladron" ? { arma: Y.arma, chaleco: Y.ch, bolso: Y.cupo } : Y.kit || Golpe.kitBase(), total = (Y.plata || 0) + (Y.banco || 0);
    const filas = GP.TIENDA.map(P => {
      let precio = P.p, tiene = false, nota = P.d;
      if (P.tipo === "mejora") { if (!K.arma) { tiene = true; nota = "Primero conseguí un arma"; } else if (K.arma.r >= 4) { tiene = true; nota = "Ya es legendaria"; } else { precio = GP.precioMejora(K.arma.r); nota = `${GP.ARMAS[K.arma.a].n}: ${GP.RAR[K.arma.r][0].toLowerCase()} a ${GP.RAR[K.arma.r + 1][0].toLowerCase()}`; } }
      else if (P.tipo === "chaleco" && K.chaleco >= P.c) { tiene = true; nota = "Ya lo tenés"; }
      else if (P.tipo === "bolso" && K.bolso >= P.c) { tiene = true; nota = "Ya lo tenés"; }
      else if (P.tipo === "arma" && K.arma && K.arma.a === P.a && K.arma.r >= P.r) { tiene = true; nota = "Ya la tenés"; }
      else if (P.tipo === "cura" && Y.cura >= 3) { tiene = true; nota = "Llevás el máximo"; }
      if (Y.rol === "policia" && P.tipo !== "cura") { tiene = true; nota = "La policía usa el equipo de su rango"; }
      const icono = P.tipo === "arma" ? "arma-" + P.a : P.tipo === "mejora" ? (K.arma ? "arma-" + K.arma.a : "sin-arma") : P.tipo;
      return `<button class="gp-item" data-comprar="${P.id}" ${tiene || precio > total ? "disabled" : ""}>${Golpe.ic(icono)}<span><b ${P.tipo === "arma" ? `style="color:${GP.RAR[P.r][1]}"` : ""}>${P.n}</b><small>${nota}</small></span><em>$${precio.toLocaleString("es-AR")}</em></button>`;
    }).join("");
    const html = `<div class="gp-tienda-cab"><b>Armería</b><button class="gp-x" data-cerrar>Cerrar</button></div>
      <p class="gp-tienda-plata">Encima: <b>$${(Y.plata || 0).toLocaleString("es-AR")}</b> · Guardada: <b>$${(Y.banco || 0).toLocaleString("es-AR")}</b></p>
      ${Y.rol === "civil" ? `<p class="gp-tienda-nota">Lo que compres queda en tu equipo de ladrón: lo vas a tener cuando te vuelvas ladrón.</p>` : ""}
      <div class="gp-items">${filas}</div>`;
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  },

  svg() {
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <rect x="0" y="0" width="120" height="84" rx="8" fill="#34363b"/><rect x="0" y="36" width="120" height="12" fill="#7a7d82"/>
      <rect x="6" y="6" width="40" height="26" fill="#2f3b52"/><rect x="74" y="6" width="40" height="26" fill="#9c36b5"/><rect x="6" y="54" width="40" height="26" fill="#9c4f3c"/>
      <g transform="translate(86 66) rotate(-20)"><rect x="-22" y="-10" width="44" height="20" rx="5" fill="#e03131"/><rect x="4" y="-8" width="8" height="16" rx="2" fill="#141c26"/></g>
      <g transform="translate(58 42)"><ellipse cx="0" cy="0" rx="8" ry="12" fill="#2b2b2e"/><circle cx="1" cy="0" r="6.5" fill="#151517"/><rect x="10" y="-2" width="14" height="4" fill="#1b1c1f"/></g>
      <g transform="translate(30 42)"><ellipse cx="0" cy="0" rx="8" ry="12" fill="#1f3a5f"/><circle cx="1" cy="0" r="6.5" fill="#16243a"/></g></svg>`;
  }
});
