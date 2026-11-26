/* Golpe: lo que se ve y los controles.
   - Cámara que sigue a tu personaje; los edificios donde no estás se ven con techo (no se ve qué hay adentro).
   - Doble joystick: el dedo izquierdo mueve, el derecho apunta y dispara. En la compu: WASD, mouse y clic.
   - Tu movimiento se predice en el teléfono (se siente al instante) y se corrige con lo que dice el anfitrión.
     A los demás se los dibuja suavizando entre una foto y la siguiente. */
Object.assign(Golpe, {
  render(v, send, opts) {
    Golpe.send = send; Golpe.opts = opts;
    if (v.fase === "rol") return Golpe.pantallaRol(v, send);
    const U = UI.gp;
    if (!U || U.id !== v.id || U.me !== v.me || !byId("gpCanvas")) Golpe.montar(v);
    Golpe.recibir(v);
  },

  /* ---------- Elección de rol (online) ---------- */
  pantallaRol(v, send) {
    const seg = Math.max(0, Math.ceil(-3 - v.t)), yo = v.roles.find(r => r.id === v.me) || {};
    const clave = JSON.stringify([v.id, seg, v.roles.map(r => r.rol)]);
    if (UI.gpRol === clave && byId("gpRol")) return;
    UI.gpRol = clave;
    if (UI.gp) Golpe.parar(true);
    app.innerHTML = `${head(0)}<section class="screen ex-golpe" id="gpRol">
      <div class="tb-hero"><span class="tb-neon">GOLPE</span><p class="sub">Elegí tu rol · la partida empieza en <b>${seg}</b></p></div>
      <div class="gp-roles">${Object.entries(GP.ROLES).map(([k, R]) => `<button class="gp-rol ${yo.rol === k ? "on" : ""}" data-gprol="${k}" aria-pressed="${yo.rol === k}" style="--rc:${R.color}"><span>${R.ic}</span><b>${R.n}</b><small>${R.desc}</small></button>`).join("")}</div>
      <div class="panel"><span class="label">En la sala</span><ul class="players">${v.roles.map(r => `<li>${avatar(r.name, 30)}<span class="name">${esc(r.name)}</span><span>${r.rol ? GP.ROLES[r.rol].ic + " " + GP.ROLES[r.rol].n : "eligiendo…"}</span></li>`).join("")}</ul>
      <small class="sub">Los del mismo rol son equipo y entran juntos. Si no elegís, sos ladrón.</small></div></section>`;
    app.querySelectorAll("[data-gprol]").forEach(b => b.onclick = () => send({ t: "rol", r: b.dataset.gprol }));
  },

  /* ---------- Montar la pantalla del juego ---------- */
  montar(v) {
    Golpe.parar(true);
    document.body.classList.add("en-nave", "en-golpe");
    app.innerHTML = `<div class="nave golpe" id="gpRoot"><canvas id="gpCanvas"></canvas>
      <div class="gp-top" id="gpTop"></div><canvas class="gp-mini" id="gpMini" width="128" height="128"></canvas>
      <div class="gp-feed" id="gpFeed"></div><div class="ar-centro gp-centro" id="gpCentro" hidden></div>
      <div class="gp-joy izq" id="gpJoyI"><i></i></div><div class="gp-joy der" id="gpJoyD"><i></i></div>
      <div class="gp-acc"><button class="gp-b gp-poli" id="gpPoli" hidden>👮 Hacerse policía</button><button class="gp-b gp-ladron" id="gpLadron" hidden>🦹 Volverse ladrón</button><button class="gp-b" id="gpAgarrar" hidden></button><button class="gp-b" id="gpCura" hidden></button></div>
      <div class="gp-ayuda-dedos" id="gpDedos">👈 mover · apuntar y disparar 👉</div>
      <button class="nv-salir" id="gpSalir" aria-label="Salir">✕</button>
      <div class="ar-fin" id="gpFin" hidden></div></div>`;
    const M = Golpe.mapa(v.semilla);
    UI.gp = { id: v.id, me: v.me, M, v, yo: null, srv: null, ents: {}, balas: [], nums: [], visto: new Set(), feedVisto: 0,
      mov: { x: 0, y: 0 }, apu: { x: 0, y: 0, f: false }, raton: null, teclas: {}, ult: { t: 0, s: "" }, flash: [], mini: Golpe.miniBase(M), dedos: performance.now() };
    Golpe.controles();
    byId("gpSalir").onclick = () => { if (Golpe.opts.local) { if (UI.gp.v.fase === "fin" || confirm("¿Abandonar el golpe? Perdés lo que llevás.")) Golpe.send({ t: "salir" }); } else { UI.confirmSalir = true; render(); } };
    byId("gpAgarrar").onclick = () => Golpe.send({ t: "agarrar" });
    byId("gpCura").onclick = () => Golpe.send({ t: "cura" });
    byId("gpPoli").onclick = () => Golpe.send({ t: "volverse", r: "policia" });
    byId("gpLadron").onclick = () => { if (UI.gp.ladronOk || confirm("¿Volverte ladrón? No hay vuelta atrás: la policía va a poder arrestarte.")) { UI.gp.ladronOk = true; Golpe.send({ t: "volverse", r: "ladron" }); } };
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

  /* ---------- Controles ---------- */
  controles() {
    const root = byId("gpRoot"), U = UI.gp, dedos = {};
    const joy = (lado, x, y, dx, dy) => { const el = byId(lado === "i" ? "gpJoyI" : "gpJoyD"); if (!el) return; if (x == null) { el.classList.remove("on"); el.firstChild.style.transform = ""; return; } el.classList.add("on"); el.style.left = x - 55 + "px"; el.style.top = y - 55 + "px"; el.firstChild.style.transform = `translate(${dx}px, ${dy}px)`; };
    const abajo = e => {
      if (e.target.closest("button, .ar-fin, .gp-top, .chat-panel")) return;
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
  /* La entrada de este momento (dedos, teclado o mouse) */
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
    const I = Golpe.leerEntrada(), r2 = x => Math.round(x * 20) / 20;
    // Mandar la entrada al anfitrión: cuando cambia o cada 120 ms (nunca más de 1 cada 45 ms)
    const msg = { t: "in", mx: r2(I.mx), my: r2(I.my), ax: r2(I.ax), ay: r2(I.ay), f: I.f ? 1 : 0 }, txt = JSON.stringify(msg);
    if (v.fase === "juego" && v.yo && v.yo.est === "vivo" && ((txt !== U.ult.s && now - U.ult.t > 45) || now - U.ult.t > 120)) { U.ult = { t: now, s: txt }; Golpe.send(msg); }
    // Predicción: mi personaje se mueve ya, con las mismas reglas que usa el anfitrión
    if (U.yo && v.yo && v.yo.est === "vivo" && v.t >= 0 && v.fase === "juego") {
      let mx = I.mx, my = I.my; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
      const vel = GP.VEL * (v.yo.rol === "civil" ? 1.15 : 1) * (v.yo.moch.length > 5 ? 0.93 : 1);
      Golpe.mover(U.M, U.yo, mx * vel * dt, my * vel * dt);
      if (Math.hypot(I.ax, I.ay) > 0.25) U.ang = Math.atan2(I.ay, I.ax); else if (m > 0.2) U.ang = Math.atan2(my, mx);
      // Corrección suave hacia lo que dice el anfitrión (si se fue muy lejos, salta)
      const ex = U.srv.x - U.yo.x, ey = U.srv.y - U.yo.y, e = Math.hypot(ex, ey);
      if (e > 160) { U.yo.x = U.srv.x; U.yo.y = U.srv.y; }
      else if (e > 36 || m < 0.1) { const k = Math.min(1, dt * (m < 0.1 ? 8 : 4)); const nx = U.yo.x + ex * k, ny = U.yo.y + ey * k; if (Golpe.libre(U.M, nx, ny, GP.R - 1)) { U.yo.x = nx; U.yo.y = ny; } }
    }
    // Los demás: se acercan suave a la última posición conocida
    const k = 1 - Math.exp(-dt * 14);
    for (const o of Object.values(U.ents)) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; let da = o.ta - o.a; da = Math.atan2(Math.sin(da), Math.cos(da)); o.a += da * k; }
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
      if (!U.yo || v.yo.est !== "vivo" || (antes && antes.t < 0 && v.t >= 0)) U.yo = { x: v.yo.x, y: v.yo.y };
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
    const yoJ = (v.jug || []).find(j => j.id === v.me);
    if (yoJ && yoJ.tiro) { U.flash.push({ id: v.me, t: now }); Golpe.tiro(0); }
    U.yoJ = yoJ || U.yoJ;
    U.balas = (v.balas || []).map(b => ({ ...b, t0: now }));
    for (const h of v.hits || []) {
      const k = h.t + ":" + h.x + ":" + h.y; if (U.visto.has(k)) continue; U.visto.add(k);
      U.nums.push({ x: h.x + (Math.random() - 0.5) * 16, y: h.y - 22, d: h.d, yo: h.yo, a: h.a, ch: h.ch, vida: 0.8 });
      if (h.a) { try { navigator.vibrate && navigator.vibrate(40); } catch {} U.dolor = now; }
    }
    if (U.visto.size > 300) U.visto = new Set([...U.visto].slice(-150));
    if (v.yo && v.yo.junto && typeof Sonido !== "undefined") Sonido.sfx("monedas");
    Golpe.hud();
  },

  /* ---------- Sonido de los tiros (ruido corto, más bajo cuanto más lejos) ---------- */
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
  COL: { 0: "#3a3d45", 1: "#6d717a", 2: "#25212c", 4: "#3f7a3a", 5: "#3f7a3a", 6: "#121016" },
  dibujar(cv, now, dt) {
    const U = UI.gp, v = U.v, M = U.M, T = GP.T, ctx = cv.getContext("2d");
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth * dpr, H = cv.clientHeight * dpr;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const esc = Math.max(0.5, Math.min(1.25, Math.min(W, H) / dpr / 640)) * dpr;
    // Cámara: sobre mí, o sobre el compañero que estoy mirando
    const vivo = v.yo && v.yo.est === "vivo";
    const ojo = vivo ? U.yo : (U.ents[v.ojo] || U.yo || { x: GP.N * T / 2, y: GP.N * T / 2 });
    const cx = ojo.x, cy = ojo.y, miEd = vivo ? Golpe.edificioEn(M, U.yo.x, U.yo.y) : ojo === U.yo ? (v.yo ? v.yo.bldg : 0) : Golpe.edificioEn(M, ojo.x, ojo.y);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#121016"; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(esc, 0, 0, esc, W / 2 - cx * esc, H / 2 - cy * esc);
    U.pantallaYo = { x: cv.getBoundingClientRect().left + (W / 2) / dpr, y: cv.getBoundingClientRect().top + (H / 2) / dpr };
    const vw = W / esc / 2 + T, vh = H / esc / 2 + T;
    const x0 = Math.max(0, Math.floor((cx - vw) / T)), x1 = Math.min(GP.N - 1, Math.floor((cx + vw) / T)), y0 = Math.max(0, Math.floor((cy - vh) / T)), y1 = Math.min(GP.N - 1, Math.floor((cy + vh) / T));
    // Suelo (calles, veredas, plazas)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = M.t[y * GP.N + x]; if (t === 2 || t === 3) continue;
      ctx.fillStyle = Golpe.COL[t]; ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5);
      if (t === 1) { ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.fillRect(x * T, y * T, T, 2); }
    }
    // Líneas de las calles
    ctx.strokeStyle = "rgba(255,212,59,.35)"; ctx.lineWidth = 3; ctx.setLineDash([22, 22]);
    for (let k = 0; k <= 4; k++) { const c = (k * 15 + 1.5) * T; ctx.beginPath(); ctx.moveTo(T, c); ctx.lineTo((GP.N - 1) * T, c); ctx.moveTo(c, T); ctx.lineTo(c, (GP.N - 1) * T); ctx.stroke(); }
    ctx.setLineDash([]);
    // Árboles
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (M.t[y * GP.N + x] === 5) {
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.arc(x * T + 23, y * T + 25, 19, 0, 7); ctx.fill();
      ctx.fillStyle = "#2b5e2b"; ctx.beginPath(); ctx.arc(x * T + 20, y * T + 20, 19, 0, 7); ctx.fill();
      ctx.fillStyle = "#3d7d3a"; ctx.beginPath(); ctx.arc(x * T + 16, y * T + 16, 10, 0, 7); ctx.fill();
    }
    // Salidas
    for (const o of v.salidas) {
      const p = 0.5 + 0.5 * Math.sin(now / 300);
      ctx.fillStyle = `rgba(81,207,102,${0.16 + 0.12 * p})`; ctx.beginPath(); ctx.arc(o.x, o.y, GP.SALIDA_R, 0, 7); ctx.fill();
      ctx.strokeStyle = "#51cf66"; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(o.x, o.y, GP.SALIDA_R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#d3f9d8"; ctx.font = "900 15px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🚪 SALIDA", o.x, o.y);
    }
    // Edificios: el mío por dentro, los demás con techo
    for (const E of M.ed) {
      if (!E) continue;
      const D = GP.EDIF[E.tipo], ex = E.x0 * T, ey = E.y0 * T, ew = (E.x1 - E.x0 + 1) * T, eh = (E.y1 - E.y0 + 1) * T;
      if (ex > cx + vw || ex + ew < cx - vw || ey > cy + vh || ey + eh < cy - vh) continue;
      if (E.id === miEd) {
        for (let y = E.y0; y <= E.y1; y++) for (let x = E.x0; x <= E.x1; x++) {
          const t = M.t[y * GP.N + x];
          ctx.fillStyle = t === 2 ? "#25212c" : (x + y) % 2 ? D.piso : Golpe.oscurecer(D.piso, 0.06); ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5);
        }
      } else {
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(ex + 8, ey + 10, ew, eh);
        ctx.fillStyle = D.techo; ctx.fillRect(ex, ey, ew, eh);
        ctx.fillStyle = "rgba(255,255,255,.08)"; for (let k = 0; k < ew; k += 24) ctx.fillRect(ex + k, ey, 2, eh);
        ctx.strokeStyle = Golpe.oscurecer(D.techo, 0.3); ctx.lineWidth = 6; ctx.strokeRect(ex + 3, ey + 3, ew - 6, eh - 6);
        // Puertas marcadas en el techo
        ctx.fillStyle = "#ffd43b";
        for (let y = E.y0; y <= E.y1; y++) for (let x = E.x0; x <= E.x1; x++) if ((x === E.x0 || x === E.x1 || y === E.y0 || y === E.y1) && M.t[y * GP.N + x] === 3) ctx.fillRect(x * T + 6, y * T + 6, T - 12, T - 12);
        ctx.font = `${D.tier >= 2 ? 44 : 36}px ${FE}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(D.ic, ex + ew / 2, ey + eh / 2 - 14);
        ctx.font = "900 17px system-ui"; ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText(D.n.toUpperCase(), ex + ew / 2, ey + eh / 2 + 24);
        if (D.tier >= 2) { ctx.font = "800 12px system-ui"; ctx.fillStyle = GP.RAR[D.tier + 1][1]; ctx.fillText("★".repeat(D.tier), ex + ew / 2, ey + eh / 2 + 42); }
      }
    }
    // Cosas en el piso
    for (const it of v.items || []) {
      const col = it.k === "art" || it.k === "arma" ? GP.RAR[it.r][1] : it.k === "chaleco" ? GP.RAR[Math.min(4, it.n + 1)][1] : "#ff8787";
      const p = 0.6 + 0.4 * Math.sin(now / 260 + it.id);
      ctx.fillStyle = Golpe.alfa(col, 0.18 + 0.14 * p); ctx.beginPath(); ctx.arc(it.x, it.y, 17 + (it.r || 0) * 1.5, 0, 7); ctx.fill();
      ctx.strokeStyle = Golpe.alfa(col, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(it.x, it.y, 15 + (it.r || 0) * 1.5, 0, 7); ctx.stroke();
      if (it.k === "arma") Golpe.dibArma(ctx, it.x, it.y, 0, it.a, col, 1.1);
      else { ctx.fillStyle = "#fff"; ctx.font = `20px ${FE}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(it.k === "art" ? GP.ART[it.a][1] : it.k === "chaleco" ? "🦺" : "🩹", it.x, it.y + 1); }
      if (it.k === "chaleco") { ctx.font = "900 10px system-ui"; ctx.fillStyle = "#fff"; ctx.fillText("Nv " + it.n, it.x, it.y + 20); }
    }
    // Balas (se dibujan donde deberían estar ahora)
    ctx.lineCap = "round";
    for (const b of U.balas) {
      const s = (now - b.t0) / 1000, x = b.x + b.vx * s, y = b.y + b.vy * s;
      ctx.strokeStyle = "rgba(255,236,153,.95)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - b.vx * 0.022, y - b.vy * 0.022); ctx.lineTo(x, y); ctx.stroke();
    }
    // Personajes
    const otros = Object.values(U.ents);
    for (const o of otros) Golpe.dibPersona(ctx, o.x, o.y, o.a, o.d, false, now, U);
    if (vivo && U.yoJ) Golpe.dibPersona(ctx, U.yo.x, U.yo.y, U.ang ?? U.yoJ.a, { ...U.yoJ, hp: v.yo.hp, ext: v.yo.ext }, true, now, U);
    // Números de daño
    for (const n of U.nums) {
      ctx.globalAlpha = Math.min(1, n.vida * 2); ctx.font = `900 ${n.yo ? 18 : 15}px system-ui`; ctx.textAlign = "center";
      ctx.fillStyle = n.a ? "#ff6b6b" : n.yo ? "#ffd43b" : "rgba(255,255,255,.75)";
      ctx.fillText((n.ch ? "🛡" : "") + n.d, n.x, n.y - (0.8 - n.vida) * 40); ctx.globalAlpha = 1;
    }
    // Niebla: más allá de la vista, oscuro
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const R = GP.VISION * esc, g = ctx.createRadialGradient(W / 2, H / 2, R * 0.72, W / 2, H / 2, R);
    g.addColorStop(0, "rgba(8,7,14,0)"); g.addColorStop(1, "rgba(8,7,14,.88)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Golpe recibido: borde rojo
    if (U.dolor && now - U.dolor < 300) { const k = 1 - (now - U.dolor) / 300, g2 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); g2.addColorStop(0, "rgba(255,0,0,0)"); g2.addColorStop(1, `rgba(255,30,30,${0.45 * k})`); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H); }
    if (!U.miniT || now - U.miniT > 200) { U.miniT = now; Golpe.dibMini(cx, cy); }
  },
  dibPersona(ctx, x, y, a, d, yo, now, U) {
    if (!d) return;
    const R = GP.ROLES[d.rol] || GP.ROLES.civil;
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(x + 3, y + 6, 17, 10, 0, 0, 7); ctx.fill();
    // Escapando: anillo que se completa
    if (d.ext > 0) { ctx.strokeStyle = "#51cf66"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, d.ext / GP.ESCAPE)); ctx.stroke(); }
    ctx.fillStyle = R.color; ctx.beginPath(); ctx.arc(x, y, 19, 0, 7); ctx.fill();
    ctx.fillStyle = yo ? "#fff" : "rgba(20,18,28,.9)"; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill();
    // Arma hacia donde apunta
    if (d.arma) {
      Golpe.dibArma(ctx, x + Math.cos(a) * 16, y + Math.sin(a) * 16, a, d.arma, GP.RAR[d.ar || 0][1], 1);
      if (U.flash.some(f => f.id === d.id)) { ctx.fillStyle = "rgba(255,230,120,.95)"; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 38, y + Math.sin(a) * 38, 7, 0, 7); ctx.fill(); }
    }
    const img = typeof Mundo !== "undefined" ? Mundo.muneco(d.look) : null;
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x - 15, y - 19, 30, 35);
    else { ctx.fillStyle = (d.look && d.look.color) || "#ffc53d"; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); }
    if (d.prot) { ctx.strokeStyle = `rgba(116,192,252,${0.5 + 0.3 * Math.sin(now / 120)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 23, 0, 7); ctx.stroke(); }
    if (d.golpe) { ctx.fillStyle = "rgba(255,60,60,.45)"; ctx.beginPath(); ctx.arc(x, y, 19, 0, 7); ctx.fill(); }
    // Icono del rol, vida y nombre
    ctx.fillStyle = "#fff"; ctx.font = `14px ${FE}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(R.ic, x + 17, y - 17);
    if (!yo) {
      const k = Math.max(0, d.hp / d.hpMax);
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(x - 18, y - 31, 36, 5);
      ctx.fillStyle = k > 0.5 ? "#51cf66" : k > 0.25 ? "#fcc419" : "#ff6b6b"; ctx.fillRect(x - 18, y - 31, 36 * k, 5);
      if (d.ch) { ctx.fillStyle = "#74c0fc"; for (let i = 0; i < d.ch; i++) ctx.fillRect(x - 18 + i * 7, y - 36, 5, 3); }
      ctx.font = "800 11px system-ui"; ctx.fillStyle = d.cpu ? "rgba(255,255,255,.65)" : "#ffd43b"; ctx.fillText(d.name, x, y + 30);
    } else { ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.moveTo(x - 6, y - 36); ctx.lineTo(x + 6, y - 36); ctx.lineTo(x, y - 28); ctx.fill(); }
  },
  /* Silueta simple de cada arma (más larga el rifle, más gruesa la escopeta) */
  dibArma(ctx, x, y, a, tipo, col, s) {
    const L = { pistola: 14, subfusil: 20, escopeta: 24, rifle: 30 }[tipo] || 14, G = { pistola: 5, subfusil: 6, escopeta: 7, rifle: 5 }[tipo] || 5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    ctx.fillStyle = "#1b1726"; ctx.fillRect(-4, -G / 2 - 1, L + 4, G + 2);
    ctx.fillStyle = col; ctx.fillRect(-3, -G / 2, L + 2, G);
    ctx.fillStyle = "#1b1726"; ctx.fillRect(0, G / 2 - 1, 4, 6);
    if (tipo === "subfusil" || tipo === "rifle") ctx.fillRect(L * 0.45, G / 2 - 1, 3, 7);
    ctx.restore();
  },
  oscurecer(hex, k) { const n = parseInt(hex.slice(1), 16), f = c => Math.max(0, Math.round(c * (1 - k))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; },
  alfa(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; },
  /* Minimapa: la ciudad entera chiquita, con las salidas, vos y tu equipo */
  miniBase(M) {
    const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
    for (let ty = 0; ty < GP.N; ty++) for (let tx = 0; tx < GP.N; tx++) {
      const t = M.t[ty * GP.N + tx]; x.fillStyle = t === 3 || t === 2 ? GP.EDIF[M.ed[M.b[ty * GP.N + tx]].tipo].techo : Golpe.COL[t]; x.fillRect(tx * 2, ty * 2, 2, 2);
    }
    return c;
  },
  dibMini(cx, cy) {
    const U = UI.gp, cv = byId("gpMini"); if (!cv || !U) return;
    const x = cv.getContext("2d"), k = 128 / (GP.N * GP.T), v = U.v;
    x.drawImage(U.mini, 0, 0);
    x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 1; x.beginPath(); x.arc(cx * k, cy * k, GP.VISION * k, 0, 7); x.stroke();
    for (const o of v.salidas) { x.fillStyle = "#51cf66"; x.beginPath(); x.arc(o.x * k, o.y * k, 5, 0, 7); x.fill(); x.fillStyle = "#fff"; x.font = "900 7px system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("S", o.x * k, o.y * k + 0.5); }
    for (const e of v.equipo || []) if (e.est === "vivo") { x.fillStyle = "#ffd43b"; x.beginPath(); x.arc(e.x * k, e.y * k, 3, 0, 7); x.fill(); }
    x.fillStyle = "#fff"; x.beginPath(); x.arc(cx * k, cy * k, 3.5, 0, 7); x.fill(); x.strokeStyle = "#000"; x.stroke();
  },

  /* ---------- HUD ---------- */
  hud() {
    const U = UI.gp; if (!U) return;
    const v = U.v, Y = v.yo, top = byId("gpTop");
    if (top && Y) {
      const R = GP.ROLES[Y.rol] || GP.ROLES.ladron, falta = Math.max(0, Math.ceil(v.dur - Math.max(0, v.t))), mm = Math.floor(falta / 60), ss = String(falta % 60).padStart(2, "0");
      const k = Math.max(0, Y.hp / Y.hpMax), arma = Y.arma ? `<span style="color:${GP.RAR[Y.arma.r][1]}">${GP.ARMAS[Y.arma.a].n}</span> <small>${GP.RAR[Y.arma.r][0]}</small>` : "<small>Sin arma</small>";
      const html = `<span class="ar-chip" style="border-color:${R.color}">${R.ic} <b>${R.n}</b></span>
        <span class="ar-chip ${falta < 60 ? "gp-urge" : ""}">⏱ <b>${mm}:${ss}</b></span>
        ${Y.rol === "policia" ? `<span class="ar-chip">🚔 <b>${Y.arrestos}</b><small>arresto${Y.arrestos === 1 ? "" : "s"}</small></span>` : Y.rol === "ladron" ? `<span class="ar-chip">💰 <b>$${Y.valor}</b><small>${Y.moch.length}/${Y.cupo}</small></span>` : ""}
        <div class="gp-vida"><i style="width:${k * 100}%;background:${k > 0.5 ? "#51cf66" : k > 0.25 ? "#fcc419" : "#ff6b6b"}"></i><span>❤️ ${Math.max(0, Y.hp)}${Y.ch ? ` · 🦺 Nv ${Y.ch}` : ""}</span></div>
        <div class="gp-arma">${Y.rol === "civil" ? "<small>🧍 Civil: no podés robar. Volvete ladrón o andá a la 🚓 comisaría</small>" : arma}</div>
        ${Y.moch.length ? `<div class="gp-moch">${Y.moch.map(it => `<i style="--rc:${GP.RAR[it.r][1]}" title="${GP.ART[it.a][0]} ${GP.RAR[it.r][0]} $${it.v}">${GP.ART[it.a][1]}</i>`).join("")}</div>` : ""}`;
      if (top.dataset.h !== html) { top.innerHTML = html; top.dataset.h = html; }
      // Botones: agarrar arma del piso y botiquín
      const bA = byId("gpAgarrar"), bC = byId("gpCura");
      if (bA) {
        const it = Y.est === "vivo" && Y.rol !== "civil" && U.yo ? (v.items || []).filter(i => i.k === "arma" && Math.hypot(i.x - U.yo.x, i.y - U.yo.y) < 46)[0] : null;
        bA.hidden = !it;
        if (it) { const t = `🔫 ${GP.ARMAS[it.a].n} <small style="color:${GP.RAR[it.r][1]}">${GP.RAR[it.r][0]}</small>`; if (bA.dataset.h !== t) { bA.innerHTML = t; bA.dataset.h = t; } }
      }
      const enComi = U.yo && (U.M.ed[Golpe.edificioEn(U.M, U.yo.x, U.yo.y)] || {}).tipo === "comisaria", civ = Y.est === "vivo" && Y.rol === "civil";
      const bP = byId("gpPoli"), bL = byId("gpLadron");
      if (bP) bP.hidden = !(civ && enComi);
      if (bL) bL.hidden = !civ;
      if (bC) { bC.hidden = !(Y.est === "vivo" && Y.cura > 0); const t = `🩹 ${Y.cura}`; if (bC.textContent !== t) bC.textContent = t; bC.disabled = Y.hp >= Y.hpMax; }
    }
    // Avisos de lo que pasa en la ciudad
    const feed = byId("gpFeed");
    if (feed) { const html = (v.feed || []).filter(f => v.t - f.t < 8).map(f => `<div>${esc(f.txt)}</div>`).join(""); if (feed.dataset.h !== html) { feed.innerHTML = html; feed.dataset.h = html; } }
    // Cartel del centro
    const cen = byId("gpCentro");
    if (cen && Y) {
      const txt = v.fase === "fin" ? "" : v.t < 0 ? (Math.ceil(-v.t) > 0 ? String(Math.ceil(-v.t)) : "¡YA!") : Y.est === "escapo" ? (Y.rol === "policia" ? `👮 Turno terminado: $${Y.premio || 0}` : `🚪 ¡Escapaste${Y.valor ? ` con $${Y.valor}` : ""}!`) : Y.est === "preso" ? "🚔 Te arrestaron" : Y.est === "muerto" ? "💀 Te bajaron" : Y.ext > 0 ? `🚪 Escapando… ${Math.max(0, GP.ESCAPE - Y.ext).toFixed(1)}` : v.t < 2.5 ? "🧍 Entraste como civil" : U.cambioVisto !== Y.rol && Y.rol !== "civil" ? (U.cambioT = U.cambioT || performance.now(), performance.now() - U.cambioT < 1800 ? (Y.rol === "policia" ? "👮 ¡Sos policía!" : "🦹 ¡Sos ladrón!") : (U.cambioVisto = Y.rol, "")) : "";
      cen.hidden = !txt; if (cen.textContent !== txt) { cen.textContent = txt; cen.classList.remove("pop"); void cen.offsetWidth; cen.classList.add("pop"); }
      if (Y.est !== "vivo" && v.fase !== "fin") cen.dataset.sub = "Mirando a tu equipo…";
    }
    // Fin de la partida
    const fin = byId("gpFin");
    if (fin) {
      fin.hidden = v.fase !== "fin";
      if (v.fase === "fin" && !fin.dataset.listo) {
        fin.dataset.listo = 1;
        const yoH = (v.humanos || []).find(h => h.id === v.me);
        const r = yoH ? { juego: "golpe", id: v.id, rol: yoH.rol, escapo: yoH.est === "escapo", valor: yoH.rol === "policia" ? yoH.valor : yoH.est === "escapo" ? yoH.valor : 0 } : null;
        if (r) Golpe.guardarBotin(r);
        const estado = h => h.rol === "policia" ? (h.est === "muerto" ? "lo bajaron en servicio" : `turno cobrado: $${h.valor}${h.items ? ` (con ${h.items} ítem${h.items > 1 ? "s" : ""} incautado${h.items > 1 ? "s" : ""})` : ""}`) : h.est === "escapo" ? (h.rol === "civil" ? "se fue sin robar" : `escapó con $${h.valor}`) : h.est === "preso" ? "terminó preso" : h.est === "muerto" ? "lo bajaron" : "se quedó sin tiempo";
        const filas = (v.humanos || []).slice().sort((a, b) => (a.puesto || 9) - (b.puesto || 9)).map(h => ({ puesto: h.puesto, name: `${GP.ROLES[h.rol] ? GP.ROLES[h.rol].ic : ""} ${h.name}`, yo: h.id === v.me, txt: `${estado(h)}${h.kills ? ` · ${h.kills} 💀` : ""}${h.arrestos ? ` · ${h.arrestos} 🚔` : ""}` }));
        const titulo = !yoH ? "Fin del golpe" : yoH.est === "escapo" && yoH.valor ? "¡Golpe exitoso!" : yoH.rol === "policia" && yoH.est !== "muerto" ? "¡Turno cumplido!" : yoH.est === "preso" ? "Caíste preso" : yoH.est === "muerto" ? "Te bajaron" : "Fin del golpe";
        const banco = Golpe.banco(), res = Golpe.opts.local && S.extra ? Golpe.resultado(S.extra, v.me) : null;
        const sub = `${r && r.valor ? `+$${r.valor} a tu botín · ` : ""}Botín guardado: <b>$${banco.total.toLocaleString("es-AR")}</b>${res ? "<br>" + Golpe.textoCuenta(res) : ""}`;
        fin.innerHTML = Turnero.tablaFin(v, filas, titulo, sub, Golpe.send, Golpe.opts);
        Turnero.conectarFin(Golpe.send, Golpe.opts);
      }
    }
  },

  /* Dibujo del menú */
  svg() {
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <rect x="6" y="40" width="34" height="38" rx="2" fill="#2f3b52"/><rect x="10" y="46" width="8" height="8" fill="#ffd43b"/><rect x="24" y="46" width="8" height="8" fill="#ffd43b" opacity=".5"/><rect x="17" y="62" width="10" height="16" fill="#1b1726"/>
      <rect x="82" y="30" width="32" height="48" rx="2" fill="#7c6a4f"/><rect x="86" y="36" width="7" height="9" fill="#ffd43b" opacity=".6"/><rect x="100" y="36" width="7" height="9" fill="#ffd43b"/><rect x="86" y="52" width="7" height="9" fill="#ffd43b"/>
      <circle cx="58" cy="40" r="15" fill="#ffc53d"/><rect x="43" y="33" width="30" height="7" rx="3" fill="#1b1726"/><circle cx="52" cy="36.5" r="2" fill="#fff"/><circle cx="64" cy="36.5" r="2" fill="#fff"/>
      <path d="M42 56 Q58 48 74 56 L76 80 L40 80 Z" fill="#ff4d63"/>
      <g transform="translate(70 50) rotate(-20)"><rect x="0" y="0" width="22" height="16" rx="5" fill="#8a5a14"/><text x="11" y="12" font-size="11" font-weight="900" text-anchor="middle" fill="#ffd43b">$</text></g>
      <path d="M46 60 l-10 12" stroke="#1b1726" stroke-width="5" stroke-linecap="round"/><rect x="26" y="68" width="14" height="5" rx="1" fill="#1b1726" transform="rotate(-40 33 70)"/>
      <circle cx="98" cy="14" r="5" fill="#4dabf7"/><circle cx="110" cy="14" r="5" fill="#ff4d63"/></svg>`;
  }
});
