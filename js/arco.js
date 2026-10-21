/* Arco y flecha: diana de 10 anillos a distancias que van subiendo, con viento que cambia en cada flecha.
   - Se apunta manteniendo el dedo apretado (la vista se acerca) y se tira al soltar. El pulso tiembla un poco
     y, si tardás mucho, el brazo se cansa y tiembla más.
   - El viento empuja la flecha de costado: hay que apuntar un poco en contra. Más lejos, más empuja.
   - 3 flechas por ronda y por persona. Centro (X) vale 10 y desempata. */
const AC = {
  RADIO: 0.61, ANILLO: 0.061, DIST: { 4: [18, 30, 50, 70], 3: [20, 40, 60] },
  DERIVA: 0.0012     // metros de deriva por cada m/s de viento y cada metro de distancia
};

const Arco = {
  clave: "arco", nombre: "Arco y flecha", boton: "🏹 ¡A tirar!",
  descripcion: "Mantené apretado para apuntar y soltá para tirar. El viento empuja la flecha y la diana se aleja en cada ronda. 3 flechas por ronda: gana el que suma más.",
  cfg() { return Turnero.cfg("arco", { rondas: 4 }); },
  arte() { return MenuArte.arco(); },
  opciones(c) { return `<span class="label">Rondas</span><div class="seg">${[[4, "4 (18 a 70 m)"], [3, "3 (20 a 60 m)"]].map(([k, t]) => `<button aria-pressed="${c.rondas === k}" data-acr="${k}">${t}</button>`).join("")}</div>`; },
  conectarOpciones(c, guardar) { app.querySelectorAll("[data-acr]").forEach(b => b.onclick = () => { c.rondas = +b.dataset.acr; guardar(); }); },
  empezarLocal() { Turnero.empezarLocal(Arco); },
  empezarOn(R) { return Turnero.empezarOn(Arco, R); },
  actOn(R, pid, a) { Turnero.actOn(Arco, R, pid, a); },
  lobby(v, H) { const c = v.exCfg.arco; return `<p class="summary">Por turnos: cada uno tira sus 3 flechas desde su teléfono y todos ven dónde pegan. ${AC.DIST[c.rondas === 3 ? 3 : 4].join(", ")} metros.${c.mesa > v.players.length ? ` Se suman ${Math.min(6, c.mesa) - v.players.length} bot${Math.min(6, c.mesa) - v.players.length > 1 ? "s" : ""}.` : ""}</p>
    ${H ? `<div class="seg">${[[4, "4 rondas"], [3, "3 rondas"]].map(([k, t]) => `<button aria-pressed="${c.rondas === k}" data-exopc="arco:rondas:${k}">${t}</button>`).join("")}</div>` : ""}${Turnero.lobbyBots("arco", c, H)}`; },
  lobbyInfo: ["Arco y flecha", "🏹", "1 a 6"],

  crear(jug, cfg) {
    const s = { id: Turnero.nuevoId("ac"), dist: AC.DIST[cfg.rondas === 3 ? 3 : 4], ronda: 0, flecha: 0, turno: 0, fase: "tiro", mov: 0, anim: null, nAnim: 0, viento: 0,
      jug: jug.map(j => ({ ...j, tiros: [], total: 0, x: 0, dieces: 0 })) };
    Arco.nuevoViento(s);
    return s;
  },
  nuevoViento(s) { const max = 1.5 + s.ronda * 1.4; s.viento = Math.round((Math.random() * 2 - 1) * max * 10) / 10; },
  D(s) { return s.dist[Math.min(s.ronda, s.dist.length - 1)]; },
  validar(p) { const n = v => Math.max(-2, Math.min(2, Number.isFinite(+v) ? +v : 0)); return { x: n(p.x), y: n(p.y) }; },
  puntos(r) { if (r <= AC.ANILLO / 2) return { pts: 10, X: true }; const k = 10 - Math.floor(r / AC.ANILLO); return { pts: Math.max(0, k), X: false }; },

  tirar(s, i, p) {
    const J = s.jug[i], D = Arco.D(s);
    // Deriva del viento y un poco de dispersión natural (más lejos, más)
    const hx = p.x + s.viento * D * AC.DERIVA + Turnero.gauss() * 0.006 * D / 20, hy = p.y + Turnero.gauss() * 0.006 * D / 20;
    const r = Math.hypot(hx, hy), { pts, X } = Arco.puntos(r);
    (J.tiros[s.ronda] = J.tiros[s.ronda] || []).push({ x: Math.round(hx * 1000) / 1000, y: Math.round(hy * 1000) / 1000, pts, X });
    J.total += pts; if (X) J.x++; if (pts === 10) J.dieces++;
    s.anim = { n: ++s.nAnim, quien: i, x: hx, y: hy, pts, X, dur: 1500 };
    s.fase = "anim";
  },
  seguir(s) {
    s.anim = null;
    if (++s.flecha >= 3) {
      s.flecha = 0;
      const sig = s.turno + 1;
      if (sig >= s.jug.length) { s.turno = 0; if (++s.ronda >= s.dist.length) { s.ronda = s.dist.length - 1; s.fase = "fin"; Arco.ordenar(s); return; } }
      else s.turno = sig;
    }
    Arco.nuevoViento(s);
    s.fase = "tiro";
  },
  ordenar(s) {
    const o = s.jug.slice().sort((a, b) => b.total - a.total || b.x - a.x);
    o.forEach((j, k) => j.puesto = k > 0 && j.total === o[k - 1].total && j.x === o[k - 1].x ? o[k - 1].puesto : k + 1);
  },
  bot(s, i) {
    const J = s.jug[i], h = Turnero.habilidad("arco", J.nivel), D = Arco.D(s), err = 1 - h;
    const compensa = 0.35 + 0.65 * h, sigma = (0.026 + 0.2 * Math.pow(err, 1.25)) * D / 30;
    return Arco.validar({ x: -s.viento * D * AC.DERIVA * compensa + Turnero.gauss() * sigma, y: Turnero.gauss() * sigma });
  },
  resultado(s, pid) {
    if (!s || s.fase !== "fin") return null;
    const J = s.jug.find(j => j.id === pid); if (!J) return null;
    return { juego: "arco", id: s.id, gano: s.jug.length > 1 && J.puesto === 1, puesto: J.puesto, n: s.jug.length, vsCompu: s.jug.every(j => j === J || j.cpu), total: J.total, max: s.dist.length * 30, centros: J.x, dieces: J.dieces };
  },
  view(s, pid) {
    return { game: "arco", id: s.id, me: pid, yo: Turnero.idx(s, pid), fase: s.fase, turno: s.turno, ronda: s.ronda, flecha: s.flecha, dist: s.dist, D: Arco.D(s), viento: s.viento, anim: s.anim,
      jug: s.jug.map(j => ({ id: j.id, name: j.name, cpu: !!j.cpu, look: j.look, tiros: j.tiros, total: j.total, x: j.x, puesto: j.puesto })) };
  },
  turnoInfo(v) { return Turnero.turno(v, "tirar una flecha"); },

  /* ---------- Pantalla ---------- */
  render(v, send, opts) {
    Arco.v = v; Arco.send = send; Arco.opts = opts;
    if (!UI.ac || UI.ac.id !== v.id || !byId("acCanvas")) Arco.montar(v);
    if (v.anim && UI.ac.anim !== v.anim.n) { UI.ac.anim = v.anim.n; UI.ac.t0 = performance.now(); UI.ac.cartel = false; if (typeof Sonido !== "undefined") Sonido.sfx("tic"); }
    if (!v.anim) UI.ac.anim = null;
    Arco.hud();
  },
  montar(v) {
    Arco.parar();
    document.body.classList.add("en-nave");
    app.innerHTML = `<div class="nave arco" id="acRoot"><canvas id="acCanvas"></canvas>
      <div class="bw-top" id="acTop"></div><div class="ar-centro bw-cartel" id="acCartel" hidden></div>
      <div class="bw-ayuda" id="acAyuda"></div>
      <button class="nv-salir" id="acSalir" aria-label="Salir">✕</button>
      <div class="ar-fin" id="acFin" hidden></div></div>`;
    UI.ac = { id: v.id, anim: null, t0: 0, apunta: null, zoom: 1 };
    byId("acSalir").onclick = () => { if (Arco.opts.local) { if (Arco.v.fase === "fin" || confirm("¿Salir del tiro con arco?")) Arco.send({ t: "salir" }); } else { UI.confirmSalir = true; render(); } };
    Arco.gestos(byId("acCanvas"));
    const paso = now => { Arco.raf = requestAnimationFrame(paso); const cv = byId("acCanvas"); if (!cv || !UI.ac) { Arco.parar(); return; } dibujarSeguro(cv, () => Arco.dibujar(cv, now)); };
    Arco.raf = requestAnimationFrame(paso);
  },
  parar() { cancelAnimationFrame(Arco.raf); Arco.raf = null; UI.ac = null; document.body.classList.remove("en-nave"); const r = byId("acRoot"); if (r) r.remove(); },
  miTurno() { const v = Arco.v; return v && v.fase === "tiro" && v.jug[v.turno] && v.jug[v.turno].id === v.me && !v.jug[v.turno].cpu; },

  /* Geometría de la diana en la pantalla */
  geo(cv) {
    const W = cv.clientWidth, H = cv.clientHeight, v = Arco.v, U = UI.ac;
    const base = Math.min(W, H * 0.62) * 0.4 * (18 / v.D);
    return { W, H, cx: W / 2, cy: H * 0.47, r: base * U.zoom, k: base * U.zoom / AC.RADIO };
  },
  /* El pulso: tiembla siempre un poco y más si se tarda */
  temblor(seg, D) {
    const amp = 0.012 * (D / 20) * (1 + Math.max(0, seg - 2.5) * 0.9);
    return { x: amp * (Math.sin(seg * 1.9) + 0.6 * Math.sin(seg * 3.7 + 1.2)), y: amp * (Math.cos(seg * 1.5) + 0.5 * Math.sin(seg * 2.9 + 0.4)) };
  },
  gestos(cv) {
    const pos = e => { const r = cv.getBoundingClientRect(), t = e.changedTouches ? e.changedTouches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const inicio = e => {
      if (!Arco.miTurno() || !UI.ac || UI.ac.apunta) return;
      const p = pos(e), G = Arco.geo(cv);
      // El punto de mira arranca en el centro de la diana y se mueve con el dedo (más fino que el dedo)
      const ang = Math.random() * 6.28, d = (0.12 + Math.random() * 0.2) * Arco.v.D / 30;
      UI.ac.apunta = { p0: p, x0: Math.cos(ang) * d, y0: Math.sin(ang) * d, mx: Math.cos(ang) * d, my: Math.sin(ang) * d, t0: performance.now() };
      if (e.cancelable) e.preventDefault();
    };
    const mover = e => {
      const A = UI.ac && UI.ac.apunta; if (!A) return;
      const p = pos(e), G = Arco.geo(cv);
      A.mx = A.x0 + (p.x - A.p0.x) * 0.45 / G.k; A.my = A.y0 - (p.y - A.p0.y) * 0.45 / G.k;
      if (e.cancelable) e.preventDefault();
    };
    const fin = () => {
      const A = UI.ac && UI.ac.apunta; if (!A) return; UI.ac.apunta = null;
      const seg = (performance.now() - A.t0) / 1000; if (seg < 0.3) return;
      const T = Arco.temblor(seg, Arco.v.D);
      Arco.send({ t: "tiro", p: { x: A.mx + T.x, y: A.my + T.y } });
    };
    cv.addEventListener("touchstart", inicio, { passive: false }); cv.addEventListener("touchmove", mover, { passive: false }); cv.addEventListener("touchend", fin); cv.addEventListener("touchcancel", () => { if (UI.ac) UI.ac.apunta = null; });
    cv.addEventListener("mousedown", inicio); window.addEventListener("mousemove", e => { if (UI.ac && UI.ac.apunta) mover(e); }); window.addEventListener("mouseup", () => { if (UI.ac && UI.ac.apunta) fin(); });
  },

  dibujar(cv, now) {
    const v = Arco.v, U = UI.ac, dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Zoom suave mientras se apunta
    U.zoom += ((U.apunta ? 2.1 : 1) - U.zoom) * 0.15;
    const G = Arco.geo(cv), hor = H * 0.47 + G.r * 1.15 / U.zoom * 0.2 + H * 0.06;
    // Cielo, sol, montañas y pasto
    const cielo = ctx.createLinearGradient(0, 0, 0, hor); cielo.addColorStop(0, "#4a9be8"); cielo.addColorStop(1, "#bfe3ff"); ctx.fillStyle = cielo; ctx.fillRect(0, 0, W, hor);
    ctx.fillStyle = "rgba(255,244,190,.9)"; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.12, 26, 0, 7); ctx.fill();
    const nubes = (now / 1000) * (v.viento || 0) * 4;
    ctx.fillStyle = "rgba(255,255,255,.85)"; for (let k = 0; k < 4; k++) { const x = (((k * 230 + nubes) % (W + 200)) + W + 200) % (W + 200) - 100, y = H * (0.08 + k * 0.05); ctx.beginPath(); ctx.ellipse(x, y, 46, 14, 0, 0, 7); ctx.ellipse(x + 26, y - 8, 28, 13, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#7aa36b"; ctx.beginPath(); ctx.moveTo(0, hor); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, hor - 18 - 14 * Math.sin(x * 0.013 + 1)); ctx.lineTo(W, hor); ctx.fill();
    const pasto = ctx.createLinearGradient(0, hor, 0, H); pasto.addColorStop(0, "#6fbf5a"); pasto.addColorStop(1, "#3e8f3a"); ctx.fillStyle = pasto; ctx.fillRect(0, hor, W, H - hor);
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2; for (let k = 1; k < 7; k++) { const y = hor + (H - hor) * Math.pow(k / 7, 1.7); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // Banderín de viento al costado
    const vx = v.viento || 0, fx = W * 0.12, fy = hor - 4;
    ctx.strokeStyle = "#f1f3f5"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 70); ctx.stroke();
    const largo = 10 + Math.min(1, Math.abs(vx) / 7) * 34, ondea = Math.sin(now / 160) * 3;
    ctx.fillStyle = "#ff4d63"; ctx.beginPath(); ctx.moveTo(fx, fy - 70); ctx.lineTo(fx + Math.sign(vx || 1) * largo, fy - 64 + ondea); ctx.lineTo(fx, fy - 56); ctx.fill();
    // Diana con soporte
    const { cx, cy, r } = G;
    ctx.fillStyle = "#8b5a2b"; ctx.save(); ctx.translate(cx, cy);
    ctx.fillRect(-r * 0.78, -r * 0.1, r * 0.09, r * 1.9); ctx.fillRect(r * 0.69, -r * 0.1, r * 0.09, r * 1.9);
    ctx.fillStyle = "#d9c29a"; ctx.beginPath(); ctx.arc(0, 0, r * 1.08, 0, 7); ctx.fill();
    const colores = ["#f8f9fa", "#f8f9fa", "#212529", "#212529", "#339af0", "#339af0", "#f03e3e", "#f03e3e", "#fcc419", "#fcc419"];
    for (let k = 0; k < 10; k++) { const rr = r * (1 - k / 10); ctx.fillStyle = colores[k]; ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.fill(); ctx.strokeStyle = k === 2 || k === 3 ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.25)"; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.arc(0, 0, r * 0.05, 0, 7); ctx.stroke();
    ctx.restore();
    // Flechas de esta ronda del que tira
    const J = v.jug[v.anim ? v.anim.quien : v.turno] || v.jug[0], clavadas = ((J.tiros || [])[v.ronda] || []).slice();
    const A = v.anim, t = A ? (now - U.t0) / 1000 : 0, vuela = A && t < 0.55;
    if (A && vuela) clavadas.pop();
    for (const f of clavadas) Arco.flecha(ctx, cx + f.x * G.k, cy - f.y * G.k, Math.max(6, r * 0.12));
    if (A && vuela) {
      const k = t / 0.55, e = 1 - Math.pow(1 - k, 2), x = W / 2 + (cx + A.x * G.k - W / 2) * e, y = H * 1.05 + (cy - A.y * G.k - H * 1.05) * e - Math.sin(k * Math.PI) * H * 0.08;
      Arco.flecha(ctx, x, y, Math.max(6, r * 0.12) * (3 - 2 * e), true);
    }
    if (A && !vuela && !U.cartel) {
      U.cartel = true; const c = byId("acCartel");
      if (c) { c.textContent = A.X ? "¡X! 🎯" : A.pts ? String(A.pts) : "Afuera"; c.dataset.m = A.X || A.pts >= 9 ? "strike" : A.pts ? "" : "canal"; c.hidden = false; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); }
      if ((A.X || A.pts === 10) && typeof Sonido !== "undefined") Sonido.sfx("victoria");
    }
    if (!A) { const c = byId("acCartel"); if (c && !c.hidden) c.hidden = true; }
    // Mira mientras se apunta
    const P = U.apunta;
    if (P && !A) {
      const seg = (now - P.t0) / 1000, T = Arco.temblor(seg, v.D), mx = cx + (P.mx + T.x) * G.k, my = cy - (P.my + T.y) * G.k, cansado = seg > 2.5;
      ctx.strokeStyle = cansado ? "#ff4d63" : "#fff"; ctx.lineWidth = 2.5; ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.arc(mx, my, 14, 0, 7); ctx.moveTo(mx - 24, my); ctx.lineTo(mx - 6, my); ctx.moveTo(mx + 6, my); ctx.lineTo(mx + 24, my); ctx.moveTo(mx, my - 24); ctx.lineTo(mx, my - 6); ctx.moveTo(mx, my + 6); ctx.lineTo(mx, my + 24); ctx.stroke();
      ctx.shadowBlur = 0;
      // Arco tensado abajo
      ctx.strokeStyle = "#5c3a1e"; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(W / 2, H * 1.18, H * 0.3, Math.PI * 1.22, Math.PI * 1.78); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(Math.PI * 1.22) * H * 0.3, H * 1.18 + Math.sin(Math.PI * 1.22) * H * 0.3); ctx.lineTo(W / 2, H * 0.98); ctx.lineTo(W / 2 + Math.cos(Math.PI * 1.78) * H * 0.3, H * 1.18 + Math.sin(Math.PI * 1.78) * H * 0.3); ctx.stroke();
    }
  },
  flecha(ctx, x, y, s, vuela) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.arc(1, 2, s * 0.32, 0, 7); ctx.fill();
    ctx.fillStyle = "#5c3a1e"; ctx.beginPath(); ctx.arc(0, 0, s * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = "#ff4d63"; for (let k = 0; k < 3; k++) { ctx.save(); ctx.rotate(k * 2.094 + (vuela ? performance.now() / 90 : 0.4)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.9, -s * 0.18); ctx.lineTo(s * 0.9, s * 0.18); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.arc(0, 0, s * 0.12, 0, 7); ctx.fill();
    ctx.restore();
  },
  hud() {
    const v = Arco.v; if (!UI.ac) return;
    const tira = v.jug[v.turno], top = byId("acTop");
    const vientoTxt = Math.abs(v.viento) < 0.3 ? "sin viento" : `${Math.abs(v.viento).toFixed(1)} m/s ${v.viento > 0 ? "→" : "←"}`;
    if (top) top.innerHTML = `<div class="ac-info"><span>🎯 Ronda ${v.ronda + 1} de ${v.dist.length} · <b>${v.D} m</b></span><span>💨 <b>${vientoTxt}</b></span></div>
      <div class="bw-tabla">${v.jug.map(J => `<div class="bw-fila ${J === tira && v.fase !== "fin" ? "on" : ""} ${J.id === v.me ? "yo" : ""}"><b>${esc(J.name.replace(/^🤖\s*/, "🤖 ").slice(0, 12))}</b><div class="ac-flechas">${((J.tiros || [])[v.ronda] || []).map(f => `<i class="${f.X ? "x" : f.pts >= 9 ? "oro" : ""}">${f.X ? "X" : f.pts || "M"}</i>`).join("")}</div><strong>${J.total}</strong></div>`).join("")}</div>`;
    const ay = byId("acAyuda");
    if (ay) { const mio = Arco.miTurno(); ay.hidden = v.fase === "fin"; ay.innerHTML = v.fase === "anim" ? "" : mio ? `🏹 <b>Tu turno</b> · flecha ${v.flecha + 1} de 3<br><small>Mantené apretado para apuntar, mové el dedo para corregir y soltá para tirar. Apuntá un poco en contra del viento.</small>` : `⏳ Tira <b>${esc(tira.name.replace(/^🤖\s*/, ""))}</b>…`; }
    const fin = byId("acFin");
    if (fin) {
      fin.hidden = v.fase !== "fin";
      if (v.fase === "fin" && !fin.dataset.listo) {
        fin.dataset.listo = 1;
        const orden = v.jug.slice().sort((a, b) => a.puesto - b.puesto), yo = v.jug.find(j => j.id === v.me);
        fin.innerHTML = Turnero.tablaFin(v, orden.map(j => ({ puesto: j.puesto, name: j.name, yo: j.id === v.me, txt: `${j.total} pts${j.x ? ` · ${j.x} X` : ""}` })), yo && yo.puesto === 1 && v.jug.length > 1 ? "🏆 ¡Ganaste!" : "🏹 Fin del torneo", `Máximo posible: ${v.dist.length * 30}`, Arco.send, Arco.opts);
        Turnero.conectarFin(Arco.send, Arco.opts);
      }
    }
  }
};
EXTRA.arco = Arco;
PANTALLAS.arcoIntro = () => Turnero.intro(Arco);
PANTALLAS.arco = () => Turnero.pantalla(Arco);
