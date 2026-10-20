/* Dibujo de la Arena y la Torre con PixiJS (WebGL): escenarios con textura, antorchas y luces,
   partículas por la placa de video, auras de las evoluciones y festejos.
   La pelea se calcula igual que siempre (arena.js); esto solo cambia cómo se ve.
   Los personajes usan su mismo dibujo y equipo (se pintan en un lienzo propio y se suben como textura).
   Si el teléfono no tiene WebGL o PixiJS no carga, se usa el dibujo de siempre. */
const ArenaPixi = {
  listo: false, cargando: null, activo: false,
  /* PixiJS se baja recién cuando hace falta (pesa ~450 KB) */
  cargar() {
    if (this.listo || this.cargando) return this.cargando;
    this.cargando = new Promise(res => {
      if (window.PIXI) { this.listo = this.soporta(); return res(this.listo); }
      const sc = document.createElement("script"); sc.src = "js/vendor/pixi.min.js"; sc.async = true;
      sc.onload = () => { this.listo = this.soporta(); res(this.listo); };
      sc.onerror = () => { this.listo = false; res(false); };
      document.head.appendChild(sc);
    });
    return this.cargando;
  },
  soporta() { try { return !!(window.PIXI && PIXI.utils.isWebGLSupported()) && store.get("arenaPixi", true) !== false; } catch { return false; } },

  /* ---------- Armar la escena ---------- */
  montar(cv) {
    if (!this.listo) return false;
    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const app = new PIXI.Application({ view: cv, width: cv.clientWidth || 390, height: cv.clientHeight || 700, resolution: dpr, autoDensity: false, antialias: true, backgroundColor: 0x08070d, powerPreference: "high-performance", eventFeatures: { move: false, globalMove: false, click: false, wheel: false } });
      app.ticker.stop();
      cv.style.width = "100%"; cv.style.height = "100%";
      const C = n => app.stage.addChild(new PIXI.Container());
      this.app = app; this.dpr = dpr;
      this.mundo = C(); this.luzCapa = new PIXI.Container(); this.pantalla = C();
      this.fondo = this.mundo.addChild(new PIXI.Container());
      this.publico = this.mundo.addChild(new PIXI.Container());
      this.suelo = this.mundo.addChild(new PIXI.Graphics());          // rayos, aros, línea de puntería
      this.cosas = this.mundo.addChild(new PIXI.Container());         // pociones y fuegos de antorchas
      this.ents = this.mundo.addChild(new PIXI.Container()); this.ents.sortableChildren = true;
      this.gfx = this.mundo.addChild(new PIXI.Graphics());            // tajos, ondas, flechas
      this.part = this.mundo.addChild(new PIXI.Container());
      this.textos = this.mundo.addChild(new PIXI.Container());
      // Luz: se dibuja en una textura y se multiplica sobre la escena (lo que no está iluminado queda oscuro)
      this.ambiente = this.luzCapa.addChild(new PIXI.Sprite(PIXI.Texture.WHITE));
      this.luces = this.luzCapa.addChild(new PIXI.Container());
      this.rt = PIXI.RenderTexture.create({ width: 64, height: 64, resolution: 0.5 });
      this.luz = app.stage.addChildAt(new PIXI.Sprite(this.rt), 1); this.luz.blendMode = PIXI.BLEND_MODES.MULTIPLY;
      this.vineta = this.pantalla.addChild(new PIXI.Sprite(this.texVineta()));
      this.rojo = this.pantalla.addChild(new PIXI.Sprite(PIXI.Texture.WHITE)); this.rojo.tint = 0xff0028; this.rojo.alpha = 0;
      this.flechas = this.pantalla.addChild(new PIXI.Graphics());
      this.flechasTx = this.pantalla.addChild(new PIXI.Container());
      this.pool = { part: [], luz: [], tx: {} };
      this.entidad = {}; this.esc = null; this.luzMap = {}; this.potis = {}; this.destellos = []; this.activo = true;
      return true;
    } catch (e) { console.warn("PixiJS no arrancó, uso el dibujo de siempre", e); this.desmontar(); return false; }
  },
  desmontar() {
    this.activo = false;
    try { if (this.app) this.app.destroy(false, { children: true, texture: false, baseTexture: false }); } catch {}
    try { if (this.rt) this.rt.destroy(true); } catch {}
    Object.values(this.entidad || {}).forEach(e => { try { e.tex.destroy(true); } catch {} });
    this.app = null; this.entidad = {}; this.esc = null;
  },

  /* ---------- Texturas hechas a mano (una sola vez) ---------- */
  lienzo(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; },
  texRadial(color, nombre) {
    this.cacheT = this.cacheT || {}; if (this.cacheT[nombre]) return this.cacheT[nombre];
    const c = this.lienzo(128, 128), x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color); g.addColorStop(0.35, color.replace(/[\d.]+\)$/, ".45)")); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return (this.cacheT[nombre] = PIXI.Texture.from(c));
  },
  texVineta() {
    const c = this.lienzo(256, 256), x = c.getContext("2d"), g = x.createRadialGradient(128, 128, 70, 128, 128, 182);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)"); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return PIXI.Texture.from(c);
  },
  texFx(k) { this.cacheF = this.cacheF || {}; return this.cacheF[k] || (this.cacheF[k] = PIXI.Texture.from(`img/arena/fx/${k}.png`)); },
  color(c) {
    if (typeof c !== "string") return { c: 0xffffff, a: 1 };
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) { const p = m[1].split(",").map(Number); return { c: (p[0] << 16) | (p[1] << 8) | p[2], a: p.length > 3 ? p[3] : 1 }; }
    return { c: parseInt(c.replace("#", "").padEnd(6, "0").slice(0, 6), 16), a: 1 };
  },

  /* ---------- Escenarios con textura (se pintan una vez) ---------- */
  ESCALA: 1.25, X0: -300, Y0: -300, WF: 2000, HF: 1600,
  /* Antorchas, braseros y lámparas de cada escenario: [x, y, color, radio, tipo] */
  focos(esc) {
    if (esc === "ring") return [[200, 140], [1200, 140], [200, 860], [1200, 860]].map(([x, y]) => [x, y - 30, 0xfff1d6, 520, "lampara"]).concat([[700, 500, 0xdfe7ff, 900, "techo"]]);
    if (esc === "coliseo") return [...AR.ESCENARIOS.coliseo.obst.map(o => [o.x, o.y - 40, 0xffa94d, 360, "brasero"]), ...Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return [700 + Math.cos(a) * 520, 500 + Math.sin(a) * 520, 0xffb347, 380, "antorcha"]; })];
    if (esc === "volcan") return [[90, 90], [1310, 90], [90, 910], [1310, 910], [700, 90], [700, 910]].map(([x, y]) => [x, y, 0xff8c42, 330, "antorcha"]).concat(AR.ESCENARIOS.volcan.lava.map(l => [l.x, l.y, 0xff6a00, l.r * 4.2, "lava"]));
    return [[300, 200], [700, 200], [1100, 200], [300, 800], [700, 800], [1100, 800], [300, 500], [1100, 500]].map(([x, y]) => [x, y, 0x8ec5ff, 420, "lampara"]);
  },
  AMBIENTE: { ring: 0x8487a6, coliseo: 0x7a6a5a, volcan: 0x4f302a, nave: 0x444c70 },
  pintarFondo(esc) {
    const S = this.ESCALA, c = this.lienzo(Math.round(this.WF * S), Math.round(this.HF * S)), x = c.getContext("2d"), E = AR.ESCENARIOS[esc], r = azarDe("pixi-" + esc);
    x.scale(S, S); x.translate(-this.X0, -this.Y0);
    const ruido = (x0, y0, w, h, n, col, tam, alfa) => { for (let i = 0; i < n; i++) { x.globalAlpha = alfa * (0.4 + r() * 0.6); x.fillStyle = col; const s = tam * (0.3 + r()); x.beginPath(); x.arc(x0 + r() * w, y0 + r() * h, s, 0, 7); x.fill(); } x.globalAlpha = 1; };
    const fondo = { ring: "#110f1f", coliseo: "#21170d", volcan: "#160705", nave: "#05081a" }[esc];
    x.fillStyle = fondo; x.fillRect(this.X0, this.Y0, this.WF, this.HF);
    if (esc === "ring") {
      const l = E.lim;
      // Tribunas a los costados
      for (let fila = 0; fila < 6; fila++) { x.fillStyle = fila % 2 ? "#1d1a33" : "#191630"; x.fillRect(l.x - 260 + fila * 0, l.y - 250 + fila * 30 - 30, l.w + 520, 26); }
      x.fillStyle = "#1a1730"; x.fillRect(l.x - 70, l.y - 70, l.w + 140, l.h + 140);
      // Lona del ring: tela con trama y luz en el centro
      const g = x.createRadialGradient(700, 500, 60, 700, 500, 640); g.addColorStop(0, "#5566c8"); g.addColorStop(1, "#273068");
      x.fillStyle = g; x.fillRect(l.x, l.y, l.w, l.h);
      x.globalAlpha = 0.08; x.strokeStyle = "#fff"; x.lineWidth = 1; for (let k = l.x; k < l.x + l.w; k += 6) { x.beginPath(); x.moveTo(k, l.y); x.lineTo(k, l.y + l.h); x.stroke(); } for (let k = l.y; k < l.y + l.h; k += 6) { x.beginPath(); x.moveTo(l.x, k); x.lineTo(l.x + l.w, k); x.stroke(); } x.globalAlpha = 1;
      ruido(l.x, l.y, l.w, l.h, 900, "#0d1240", 9, 0.12);
      x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = 7; x.beginPath(); x.arc(700, 500, 130, 0, 7); x.stroke();
      x.fillStyle = "rgba(255,255,255,.06)"; x.font = "bold 110px 'Dela Gothic One', Figtree, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("MESA LOCA", 700, 500);
      // Esquineros con almohadón
      E.obst.forEach(o => { x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.ellipse(o.x, o.y + 12, o.r * 1.1, o.r * 0.45, 0, 0, 7); x.fill(); const gg = x.createRadialGradient(o.x - 6, o.y - 8, 2, o.x, o.y, o.r); gg.addColorStop(0, "#ffffff"); gg.addColorStop(1, "#9aa0c0"); x.fillStyle = gg; x.beginPath(); x.arc(o.x, o.y, o.r, 0, 7); x.fill(); x.fillStyle = "#ff4d63"; x.beginPath(); x.arc(o.x, o.y - 4, o.r * 0.7, 0, 7); x.fill(); });
      [0, 10, 20].forEach((o, i) => { x.strokeStyle = ["#ff4d63", "#ffffff", "#4dabf7"][i]; x.lineWidth = 5; x.strokeRect(l.x - o, l.y - o, l.w + o * 2, l.h + o * 2); });
    } else if (esc === "coliseo") {
      const c0 = E.circ;
      // Gradas de piedra en anillos
      for (let k = 9; k >= 0; k--) { x.fillStyle = k % 2 ? "#4a3a28" : "#3d3020"; x.beginPath(); x.arc(c0.x, c0.y, c0.r + 60 + k * 34, 0, 7); x.fill(); }
      // Muro con ladrillos
      x.fillStyle = "#6b5232"; x.beginPath(); x.arc(c0.x, c0.y, c0.r + 44, 0, 7); x.fill();
      for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; x.strokeStyle = "rgba(40,28,14,.6)"; x.lineWidth = 2; x.beginPath(); x.moveTo(c0.x + Math.cos(a) * c0.r, c0.y + Math.sin(a) * c0.r); x.lineTo(c0.x + Math.cos(a) * (c0.r + 44), c0.y + Math.sin(a) * (c0.r + 44)); x.stroke(); }
      x.strokeStyle = "rgba(40,28,14,.6)"; x.lineWidth = 2; x.beginPath(); x.arc(c0.x, c0.y, c0.r + 22, 0, 7); x.stroke();
      // Arena con grano, manchas y huellas
      const g = x.createRadialGradient(c0.x, c0.y, 40, c0.x, c0.y, c0.r); g.addColorStop(0, "#e8cc96"); g.addColorStop(1, "#b48f58");
      x.fillStyle = g; x.beginPath(); x.arc(c0.x, c0.y, c0.r, 0, 7); x.fill();
      x.save(); x.beginPath(); x.arc(c0.x, c0.y, c0.r, 0, 7); x.clip();
      ruido(c0.x - c0.r, c0.y - c0.r, c0.r * 2, c0.r * 2, 4000, "#8a6a3a", 2.2, 0.35);
      ruido(c0.x - c0.r, c0.y - c0.r, c0.r * 2, c0.r * 2, 1500, "#fff1cf", 1.6, 0.3);
      ruido(c0.x - c0.r, c0.y - c0.r, c0.r * 2, c0.r * 2, 60, "#7a5a2a", 26, 0.08);
      for (let i = 0; i < 40; i++) { const hx = c0.x + (r() - 0.5) * c0.r * 1.6, hy = c0.y + (r() - 0.5) * c0.r * 1.6, a = r() * 7; x.fillStyle = "rgba(110,80,40,.18)"; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(hx + Math.cos(a) * k * 22 + (k % 2) * 8, hy + Math.sin(a) * k * 22, 5, 8, a, 0, 7); x.fill(); } }
      x.restore();
      x.strokeStyle = "rgba(90,60,20,.3)"; x.lineWidth = 4; x.beginPath(); x.arc(c0.x, c0.y, 120, 0, 7); x.stroke();
      // Columnas de mármol con brasero arriba
      E.obst.forEach(o => { x.fillStyle = "rgba(0,0,0,.4)"; x.beginPath(); x.ellipse(o.x + 6, o.y + 14, o.r * 1.2, o.r * 0.5, 0, 0, 7); x.fill(); const gg = x.createLinearGradient(o.x - o.r, 0, o.x + o.r, 0); gg.addColorStop(0, "#a89a78"); gg.addColorStop(0.45, "#f7efd9"); gg.addColorStop(1, "#8c7f60"); x.fillStyle = gg; x.beginPath(); x.arc(o.x, o.y, o.r, 0, 7); x.fill(); x.strokeStyle = "#6c604a"; x.lineWidth = 3; x.stroke(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; x.strokeStyle = "rgba(0,0,0,.12)"; x.beginPath(); x.moveTo(o.x + Math.cos(a) * o.r * 0.4, o.y + Math.sin(a) * o.r * 0.4); x.lineTo(o.x + Math.cos(a) * o.r, o.y + Math.sin(a) * o.r); x.stroke(); } x.fillStyle = "#3b2a1a"; x.beginPath(); x.arc(o.x, o.y, o.r * 0.5, 0, 7); x.fill(); x.fillStyle = "#1c120a"; x.beginPath(); x.arc(o.x, o.y, o.r * 0.36, 0, 7); x.fill(); });
    } else if (esc === "volcan") {
      const l = E.lim;
      x.fillStyle = "#2a1712"; x.fillRect(l.x - 60, l.y - 60, l.w + 120, l.h + 120);
      // Baldosas de basalto irregulares
      for (let gy = l.y; gy < l.y + l.h; gy += 70) for (let gx = l.x + ((gy / 70) % 2) * 35; gx < l.x + l.w; gx += 70) {
        const v = 30 + r() * 18; x.fillStyle = `rgb(${v + 14},${v - 2},${v - 8})`; x.beginPath(); x.moveTo(gx + 3 + r() * 4, gy + 3); x.lineTo(gx + 66 - r() * 4, gy + 2 + r() * 4); x.lineTo(gx + 67, gy + 66 - r() * 4); x.lineTo(gx + 2 + r() * 4, gy + 67); x.closePath(); x.fill();
      }
      ruido(l.x, l.y, l.w, l.h, 2500, "#000", 3, 0.25); ruido(l.x, l.y, l.w, l.h, 900, "#6b4a3a", 2, 0.25);
      x.strokeStyle = "#0b0505"; x.lineWidth = 22; x.strokeRect(l.x, l.y, l.w, l.h);
      // Rocas
      E.obst.forEach(o => { x.fillStyle = "rgba(0,0,0,.45)"; x.beginPath(); x.ellipse(o.x + 6, o.y + 14, o.r * 1.15, o.r * 0.5, 0, 0, 7); x.fill(); const gg = x.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.4, 4, o.x, o.y, o.r); gg.addColorStop(0, "#8a766e"); gg.addColorStop(1, "#2e2320"); x.fillStyle = gg; x.beginPath(); x.moveTo(o.x - o.r, o.y + 4); x.lineTo(o.x - o.r * 0.6, o.y - o.r * 0.8); x.lineTo(o.x + o.r * 0.3, o.y - o.r); x.lineTo(o.x + o.r, o.y - o.r * 0.2); x.lineTo(o.x + o.r * 0.8, o.y + o.r * 0.6); x.lineTo(o.x - o.r * 0.5, o.y + o.r * 0.7); x.fill(); x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 2; x.stroke(); });
      // Bordes de las lagunas de lava
      E.lava.forEach(lv => { x.fillStyle = "#1a0603"; x.beginPath(); x.arc(lv.x, lv.y, lv.r + 16, 0, 7); x.fill(); });
    } else {
      const l = E.lim;
      x.fillStyle = "#151a33"; x.fillRect(l.x - 60, l.y - 60, l.w + 120, l.h + 120);
      // Placas de metal con remaches, rejillas y franjas de peligro
      for (let gx = l.x; gx < l.x + l.w; gx += 80) for (let gy = l.y; gy < l.y + l.h; gy += 80) {
        const g = x.createLinearGradient(gx, gy, gx + 80, gy + 80); g.addColorStop(0, "#3a4468"); g.addColorStop(1, "#262d4a");
        x.fillStyle = g; x.fillRect(gx + 2, gy + 2, 76, 76); x.strokeStyle = "rgba(255,255,255,.07)"; x.lineWidth = 1; x.strokeRect(gx + 3, gy + 3, 74, 74);
        x.fillStyle = "#59658f"; [[9, 9], [71, 9], [9, 71], [71, 71]].forEach(([a, b]) => { x.beginPath(); x.arc(gx + a, gy + b, 2.4, 0, 7); x.fill(); });
        if (r() < 0.12) { x.fillStyle = "#1a2038"; x.fillRect(gx + 16, gy + 16, 48, 48); x.strokeStyle = "#3d4770"; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(gx + 18, gy + 20 + k * 8); x.lineTo(gx + 62, gy + 20 + k * 8); x.stroke(); } }
      }
      ruido(l.x, l.y, l.w, l.h, 600, "#000", 4, 0.12);
      x.save(); x.beginPath(); x.rect(l.x, l.y, l.w, 24); x.rect(l.x, l.y + l.h - 24, l.w, 24); x.clip(); for (let k = l.x - 40; k < l.x + l.w + 40; k += 40) { x.fillStyle = "#ffd43b"; x.beginPath(); x.moveTo(k, l.y); x.lineTo(k + 20, l.y); x.lineTo(k - 4, l.y + 24); x.lineTo(k - 24, l.y + 24); x.fill(); x.beginPath(); x.moveTo(k, l.y + l.h - 24); x.lineTo(k + 20, l.y + l.h - 24); x.lineTo(k - 4, l.y + l.h); x.lineTo(k - 24, l.y + l.h); x.fill(); } x.restore();
      x.strokeStyle = "#5a6aa8"; x.lineWidth = 10; x.strokeRect(l.x, l.y, l.w, l.h);
      // Cajas de carga
      E.cajas.forEach(cj => { x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(cj.x + 8, cj.y + 10, cj.w, cj.h); const g = x.createLinearGradient(cj.x, cj.y, cj.x + cj.w, cj.y + cj.h); g.addColorStop(0, "#8a96c8"); g.addColorStop(1, "#46507a"); x.fillStyle = g; x.fillRect(cj.x, cj.y, cj.w, cj.h); x.strokeStyle = "#2b3150"; x.lineWidth = 3; x.strokeRect(cj.x + 3, cj.y + 3, cj.w - 6, cj.h - 6); x.beginPath(); x.moveTo(cj.x + 6, cj.y + 6); x.lineTo(cj.x + cj.w - 6, cj.y + cj.h - 6); x.moveTo(cj.x + cj.w - 6, cj.y + 6); x.lineTo(cj.x + 6, cj.y + cj.h - 6); x.stroke(); x.fillStyle = "#ffd43b"; x.fillRect(cj.x + 6, cj.y + cj.h - 16, cj.w - 12, 8); });
    }
    // Postes de las antorchas (el fuego y la luz se animan aparte)
    this.focos(esc).forEach(([fx, fy, , , tipo]) => {
      if (tipo === "antorcha") { x.fillStyle = "rgba(0,0,0,.4)"; x.beginPath(); x.ellipse(fx + 4, fy + 16, 12, 5, 0, 0, 7); x.fill(); x.fillStyle = "#5c3b1e"; x.fillRect(fx - 4, fy - 6, 8, 22); x.fillStyle = "#3a3a42"; x.fillRect(fx - 8, fy - 12, 16, 8); }
      if (tipo === "lampara" && esc === "nave") { x.fillStyle = "#9fb4ff"; x.globalAlpha = 0.25; x.beginPath(); x.arc(fx, fy, 16, 0, 7); x.fill(); x.globalAlpha = 1; }
    });
    return PIXI.Texture.from(c);
  },
  prepararEscenario(esc) {
    if (this.esc === esc) return;
    this.esc = esc;
    this.fondo.removeChildren().forEach(c => c.destroy());
    this.publico.removeChildren().forEach(c => c.destroy());
    this.cosas.removeChildren().forEach(c => c.destroy());
    this.luces.removeChildren().forEach(c => c.destroy());
    this.fondos = this.fondos || {};
    const f = new PIXI.Sprite(this.fondos[esc] = this.fondos[esc] || this.pintarFondo(esc)); f.x = this.X0; f.y = this.Y0; f.scale.set(1 / this.ESCALA); this.fondo.addChild(f);
    // Lava animada
    this.lava = AR.ESCENARIOS[esc].lava.map(l => {
      const s = new PIXI.Sprite(this.texLava()); s.anchor.set(0.5); s.x = l.x; s.y = l.y; s.width = s.height = l.r * 2.08; this.fondo.addChild(s);
      const brillo = new PIXI.Sprite(this.texFx("light_01") || PIXI.Texture.WHITE); brillo.anchor.set(0.5); brillo.x = l.x; brillo.y = l.y; brillo.width = brillo.height = l.r * 2.4; brillo.tint = 0xffb347; brillo.blendMode = PIXI.BLEND_MODES.ADD; brillo.alpha = 0.5; this.fondo.addChild(brillo);
      return { s, brillo, l };
    });
    // Público que salta (ring y coliseo)
    const D = Arena.decoracion(esc); this.gente = [];
    if (esc === "ring" || esc === "coliseo") {
      const cab = this.texCabeza();
      D.publico.forEach(p => { const s = new PIXI.Sprite(cab); s.anchor.set(0.5, 1); s.x = p.x; s.y = p.y + 10; s.tint = this.color(p.c).c; s.alpha = 0.7; this.publico.addChild(s); this.gente.push({ s, p }); });
    }
    if (esc === "nave") D.estrellas.forEach(st => { const s = new PIXI.Sprite(PIXI.Texture.WHITE); s.x = st.x; s.y = st.y; s.width = s.height = st.s; s.alpha = 0.6; this.publico.addChild(s); this.gente.push({ s, st }); });
    // Fuegos y luces de las antorchas
    this.llamas = [];
    this.focos(esc).forEach(([fx, fy, col, rad, tipo], i) => {
      const L = new PIXI.Sprite(this.texRadial("rgba(255,255,255,1)", "luz")); L.anchor.set(0.5); L.x = fx; L.y = fy; L.width = L.height = rad * 2; L.tint = col; L.alpha = tipo === "lava" ? 0.8 : tipo === "techo" ? 0.45 : 0.55; L.blendMode = PIXI.BLEND_MODES.ADD; this.luces.addChild(L);
      let fuego = null;
      if (tipo === "antorcha" || tipo === "brasero") { fuego = new PIXI.Sprite(this.texFx("fire_01") || PIXI.Texture.WHITE); fuego.anchor.set(0.5, 0.8); fuego.x = fx; fuego.y = fy - (tipo === "antorcha" ? 10 : 0); fuego.width = fuego.height = tipo === "brasero" ? 62 : 44; fuego.tint = 0xffa94d; fuego.blendMode = PIXI.BLEND_MODES.ADD; this.cosas.addChild(fuego); }
      this.llamas.push({ L, fuego, rad, i, tipo });
    });
    this.ambiente.tint = this.AMBIENTE[esc];
  },
  texLava() {
    if (this.tLava) return this.tLava;
    const c = this.lienzo(256, 256), x = c.getContext("2d"), g = x.createRadialGradient(128, 128, 10, 128, 128, 124);
    g.addColorStop(0, "#fff3a0"); g.addColorStop(0.35, "#ffb02e"); g.addColorStop(0.75, "#ff5a00"); g.addColorStop(1, "#a81c0a");
    x.fillStyle = g; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
    const r = azarDe("lava"); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,20,0,${0.15 + r() * 0.2})`; x.beginPath(); x.arc(40 + r() * 176, 40 + r() * 176, 6 + r() * 16, 0, 7); x.fill(); }
    return (this.tLava = PIXI.Texture.from(c));
  },
  texCabeza() {
    if (this.tCab) return this.tCab;
    const c = this.lienzo(32, 28), x = c.getContext("2d"); x.fillStyle = "#fff"; x.beginPath(); x.arc(16, 13, 13, Math.PI, 0); x.fill(); x.fillRect(3, 13, 26, 14);
    return (this.tCab = PIXI.Texture.from(c));
  },

  /* ---------- Personajes: su dibujo de siempre en un lienzo propio ---------- */
  ANCHO: 230, ALTO: 250, OX: 115, OY: 160,
  ent(id, k) {
    let e = this.entidad[id];
    const kk = Math.round(Math.max(0.8, Math.min(2.2, k)) * 4) / 4;
    if (e && e.k !== kk) { this.ents.removeChild(e.s); e.tex.destroy(true); e = null; }
    if (!e) {
      const c = this.lienzo(Math.round(this.ANCHO * kk), Math.round(this.ALTO * kk)), tex = PIXI.Texture.from(c);
      const s = new PIXI.Sprite(tex); s.anchor.set(this.OX / this.ANCHO, this.OY / this.ALTO); s.scale.set(1 / kk);
      this.ents.addChild(s); e = this.entidad[id] = { c, ctx: c.getContext("2d"), tex, s, k: kk };
    }
    return e;
  },

  /* ---------- Cada cuadro ---------- */
  dibujar(now) {
    const v = Arena.v, n = UI.arena, app = this.app; if (!app || !v || !n) return;
    const cv = app.view, W = cv.clientWidth, H = cv.clientHeight, t = now / 1000;
    if (app.renderer.width !== Math.round(W * this.dpr) || app.renderer.height !== Math.round(H * this.dpr)) app.renderer.resize(W, H);
    n.part = n.part || []; n.vistos = n.vistos || new Set();
    this.prepararEscenario(v.esc);
    const { yo, esc, vt, sh } = Arena.camara(v, n, W, H, now);
    const ox = W / 2 + (Math.random() - 0.5) * sh, oy = H / 2 + (Math.random() - 0.5) * sh;
    for (const C of [this.mundo, this.luces]) { C.scale.set(esc); C.x = ox - n.camx * esc; C.y = oy - n.camy * esc; }
    // Animaciones del escenario
    this.gente.forEach(({ s, p, st }) => { if (p) s.y = p.y + 10 - Math.max(0, Math.sin(t * 6 + p.f)) * 5 - (v.fase === "fin" ? Math.abs(Math.sin(t * 9 + p.f)) * 6 : 0); else s.alpha = 0.4 + Math.sin(t * 2 + st.f) * 0.3; });
    this.llamas.forEach(({ L, fuego, rad, i, tipo }) => { const f = 1 + Math.sin(t * 9 + i * 1.7) * 0.06 + Math.sin(t * 23 + i) * 0.04; L.width = L.height = rad * 2 * (tipo === "lava" ? 1 + Math.sin(t * 1.5 + i) * 0.05 : f); if (fuego) { fuego.scale.y = fuego.scale.x * (0.9 + Math.sin(t * 14 + i) * 0.12); fuego.alpha = 0.85 + Math.sin(t * 11 + i) * 0.15; } });
    this.lava.forEach(({ s, brillo, l }, i) => { s.rotation = t * 0.08 * (i % 2 ? 1 : -1); s.width = s.height = (l.r + Math.sin(t * 2 + l.x) * 3) * 2.08; brillo.alpha = 0.45 + Math.sin(t * 3 + i) * 0.12; if (Math.random() < 0.1) Arena.particula(n, l.x + (Math.random() - 0.5) * l.r, l.y + (Math.random() - 0.5) * l.r, (Math.random() - 0.5) * 20, -40 - Math.random() * 60, 1400, "#ffb02e", 3); });
    // Cosas del piso: rayos, aro propio, línea de puntería
    const g = this.suelo; g.clear();
    const E = AR.ESCENARIOS[v.esc];
    if (E.rayos) E.rayos.forEach(r => {
      const aviso = (vt % 7000) > 4000 && !v.rayosOn;
      if (aviso || v.rayosOn) { g.beginFill(v.rayosOn ? 0x74c0fc : 0xffd43b, v.rayosOn ? 0.45 + Math.sin(t * 30) * 0.2 : 0.12); g.drawRect(r.x, r.y, r.w, r.h); g.endFill(); }
      g.lineStyle(3, aviso ? 0xffd43b : 0x74c0fc, aviso ? 1 : 0.4); g.drawRect(r.x, r.y, r.w, r.h); g.lineStyle(0);
      if (v.rayosOn) { g.lineStyle(2, 0xe7f5ff, 1); const hor = r.w > r.h; for (let k = 0; k <= 20; k++) { const p = k / 20, x = hor ? r.x + r.w * p : r.x + r.w / 2 + (Math.random() - 0.5) * r.w, y = hor ? r.y + r.h / 2 + (Math.random() - 0.5) * r.h : r.y + r.h * p; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.lineStyle(0); }
    });
    // Pociones
    this.pociones(v, t);
    // Luchadores
    const vivos = new Set(), dpr = this.dpr;
    const lista = v.jug.map(j => {
      const o = n.otros[j.id] = n.otros[j.id] || { x: j.x, y: j.y };
      const esYo = j.id === v.me && j.vivo, ox2 = o.x, oy2 = o.y;
      if (esYo) { o.x = n.x; o.y = n.y; } else { o.x += (j.x - o.x) * 0.3; o.y += (j.y - o.y) * 0.3; }
      const anda = esYo ? n.anda : Math.hypot(o.x - ox2, o.y - oy2) > 0.6;
      if (anda && j.vivo && (esYo || !(vt < j.invis)) && Math.random() < 0.18) Arena.particula(n, o.x + (Math.random() - 0.5) * 16, o.y + 16, (Math.random() - 0.5) * 30, -20, 450, v.esc === "coliseo" ? "rgba(160,120,70,.6)" : "rgba(200,200,220,.35)", 5);
      return { j, o, esYo, anda };
    });
    for (const { j, o, esYo, anda } of lista) {
      vivos.add(j.id);
      const e = this.ent(j.id, esc * dpr), x = e.ctx;
      e.s.x = o.x; e.s.y = o.y; e.s.zIndex = o.y;
      // Fuera de la pantalla no hace falta volver a pintarlo
      const px = (o.x - n.camx) * esc + W / 2, py = (o.y - n.camy) * esc + H / 2;
      e.s.visible = px > -150 && px < W + 150 && py > -150 && py < H + 200;
      if (!e.s.visible) continue;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, e.c.width, e.c.height); x.setTransform(e.k, 0, 0, e.k, this.OX * e.k, this.OY * e.k);
      if (!j.vivo) Arena.dibujarCaido(x, { ...j }, 0, 0, t, Arena.caida(n, j, now));
      else {
        if (esYo) { x.strokeStyle = "#3ddcb1"; x.lineWidth = 3; x.beginPath(); x.ellipse(0, 16, 28, 11, 0, 0, 7); x.stroke(); }
        this.aura(n, j, o, t, x);
        Arena.dibujarLuchador(x, { ...j, cara: esYo ? n.cara : j.cara, esYo, festeja: Arena.festeja(v, j) }, 0, 0, t, anda, vt);
        if (Arena.festeja(v, j) && Math.random() < 0.25) ArenaFX.emitir(n, { x: o.x + (Math.random() - 0.5) * 60, y: o.y - 70, vx: (Math.random() - 0.5) * 140, vy: -120 - Math.random() * 80, grav: 260, tex: "star_04", color: ["#ffd43b", "#ff6b6b", "#4dabf7", "#3ddcb1", "#cc5de8"][Math.floor(Math.random() * 5)], vida: 1200, tam: 16, crece: 0.8, vrot: 6 });
      }
      e.tex.update();
      // Luz propia: el jugador se ve un poco aunque esté en lo oscuro; los jefes brillan rojo
      this.luzDe("p" + j.id, o.x, o.y - 20, j.equipo === "m" ? (j.tam > 1 ? 0xff4d63 : 0x000000) : esYo ? 0xbfe3ff : 0x7a7a90, j.equipo === "m" ? (j.tam > 1 ? 260 : 0) : esYo ? 260 : 180, j.vivo);
    }
    Object.keys(this.entidad).forEach(id => { if (!vivos.has(id)) { const e = this.entidad[id]; this.ents.removeChild(e.s); e.tex.destroy(true); delete this.entidad[id]; this.luzDe("p" + id, 0, 0, 0, 0, false); } });
    // Línea de puntería
    if (yo && yo.vivo && n.apunta) {
      const A = AR.CLASES[yo.clase].atk, largo = Math.min(520, (A.alcance || 80) * (yo.alc || 1)), ax = n.x + n.apunta.x * 30, ay = n.y - 10 + n.apunta.y * 30;
      g.lineStyle(4, 0xffd43b, 0.85); for (let k = 0; k < largo; k += 18) { g.moveTo(ax + n.apunta.x * k, ay + n.apunta.y * k); g.lineTo(ax + n.apunta.x * Math.min(largo, k + 10), ay + n.apunta.y * Math.min(largo, k + 10)); }
      g.lineStyle(0); g.beginFill(0xffd43b, 0.9); g.drawCircle(ax + n.apunta.x * largo, ay + n.apunta.y * largo, 7); g.endFill();
    }
    // Proyectiles, efectos y partículas
    this.efectos(v, n, now, vt, t);
    // Flechas a los rivales que no se ven
    this.fuera(v, n, esc, W, H);
    // Viñeta y pantalla roja con poca vida o en muerte súbita
    this.vineta.width = W; this.vineta.height = H; this.rojo.width = W; this.rojo.height = H;
    this.rojo.alpha = v.sub ? 0.12 + Math.sin(t * 4) * 0.06 : yo && yo.vivo && yo.hp / yo.max < 0.3 ? 0.1 + Math.sin(t * 6) * 0.05 : 0;
    // Luz: ambiente + luces, en una textura que multiplica la escena
    if (this.rt.width !== Math.ceil(W) || this.rt.height !== Math.ceil(H)) this.rt.resize(Math.ceil(W), Math.ceil(H));
    this.ambiente.width = W; this.ambiente.height = H;
    app.renderer.render(this.luzCapa, { renderTexture: this.rt, clear: true });
    app.renderer.render(app.stage);
    Arena.interfaz(v, yo, vt);
  },
  /* Luces que siguen a algo (jugadores, bolas de fuego, explosiones) */
  luzDe(k, x, y, col, rad, on) {
    this.luzMap = this.luzMap || {};
    let L = this.luzMap[k];
    if (!on || !rad) { if (L) { this.luces.removeChild(L); L.destroy(); delete this.luzMap[k]; } return; }
    if (!L) { L = this.luzMap[k] = new PIXI.Sprite(this.texRadial("rgba(255,255,255,1)", "luz")); L.anchor.set(0.5); L.blendMode = PIXI.BLEND_MODES.ADD; this.luces.addChild(L); }
    L.x = x; L.y = y; L.width = L.height = rad * 2; L.tint = col; if (k[0] !== "d") L.alpha = 0.7;
  },
  /* Aura de cada evolución (en la primera un aro de color; en la segunda, además, partículas) */
  AURAS: {
    caballero: ["#74c0fc"], paladin: ["#ffd43b", "star_04"], barbaro: ["#ff8787"], berserker: ["#e03131", "smoke_03"],
    cazador: ["#94d82d"], montaraz: ["#51cf66", "dirt_02"], tirador: ["#ffa94d"], francotirador: ["#ff922b", "spark_01"],
    piromante: ["#ff922b"], "senor-fuego": ["#ff6b00", "flame_03"], criomante: ["#74c0fc"], glacial: ["#a5d8ff", "star_04"],
    ninja: ["#b197fc"], "maestro-ninja": ["#845ef7", "twirl_02"], sicario: ["#adb5bd"], parca: ["#495057", "smoke_07"]
  },
  aura(n, j, o, t, x) {
    const A = j.evoId && this.AURAS[j.evoId]; if (!A || j.equipo === "m") return;
    x.save(); x.globalAlpha = 0.5 + Math.sin(t * 3) * 0.15; x.strokeStyle = A[0]; x.lineWidth = A[1] ? 4 : 2.5; x.beginPath(); x.ellipse(0, 16, 34, 13, 0, 0, 7); x.stroke(); x.restore();
    if (A[1] && Math.random() < 0.22) ArenaFX.emitir(n, { x: o.x + (Math.random() - 0.5) * 40, y: o.y + 10, vy: -50 - Math.random() * 40, vx: (Math.random() - 0.5) * 20, tex: A[1], color: A[0], vida: 900, tam: 18, crece: A[1].startsWith("smoke") ? 1.8 : 0.6, alfa: 0.75, add: !A[1].startsWith("smoke") });
    if (A[1]) this.luzDe("a" + j.id, o.x, o.y - 10, this.color(A[0]).c, 150, true);
  },
  pociones(v, t) {
    this.potis = this.potis || {}; const vistas = new Set();
    v.pociones.forEach(p => {
      vistas.add(p.k); let P = this.potis[p.k];
      if (!P) { const s = new PIXI.Text("🧪", { fontSize: 30, fontFamily: FE }); s.anchor.set(0.5); const halo = new PIXI.Sprite(this.texFx("light_01") || PIXI.Texture.WHITE); halo.anchor.set(0.5); halo.tint = 0x3ddcb1; halo.blendMode = PIXI.BLEND_MODES.ADD; halo.width = halo.height = 80; this.cosas.addChild(halo, s); P = this.potis[p.k] = { s, halo }; }
      P.s.x = P.halo.x = p.x; P.s.y = p.y + Math.sin(t * 3 + p.k) * 4; P.halo.y = p.y; P.halo.alpha = 0.6 + Math.sin(t * 4) * 0.2;
      this.luzDe("po" + p.k, p.x, p.y, 0x3ddcb1, 140, true);
    });
    Object.keys(this.potis).forEach(k => { if (!vistas.has(+k)) { const P = this.potis[k]; P.s.destroy(); P.halo.destroy(); delete this.potis[k]; this.luzDe("po" + k, 0, 0, 0, 0, false); } });
  },
  efectos(v, n, now, vt, t) {
    const g = this.gfx; g.clear();
    const dtv = Math.min(0.2, (now - (n.vtLocal || now)) / 1000), activas = new Set();
    v.proy.forEach(p => {
      const x = p.x + p.vx * dtv, y = p.y + p.vy * dtv, a = Math.atan2(p.vy, p.vx), cs = Math.cos(a), sn = Math.sin(a);
      ArenaFX.proyectil(null, n, p, x, y, a);
      if (p.tipo === "flecha") {
        g.lineStyle(3, 0xffffff, 0.25); g.moveTo(x - cs * 46, y - sn * 46); g.lineTo(x, y);
        g.lineStyle(3, 0xe9dcc0, 1); g.moveTo(x - cs * 20, y - sn * 20); g.lineTo(x + cs * 10, y + sn * 10); g.lineStyle(0);
        g.beginFill(this.color(p.color).c); g.drawPolygon([x + cs * 18, y + sn * 18, x + cs * 8 - sn * 6, y + sn * 8 + cs * 6, x + cs * 8 + sn * 6, y + sn * 8 - cs * 6]); g.endFill();
        this.luzDe("f" + p.k, x, y, 0x806040, 70, true);
      } else {
        g.beginFill(0xffb02e, 0.9); g.drawCircle(x, y, 9); g.endFill(); g.beginFill(0xffffff, 0.95); g.drawCircle(x, y, 5); g.endFill();
        this.luzDe("f" + p.k, x, y, 0xff9f1c, 200, true);
      }
      activas.add("f" + p.k);
    });
    Object.keys(this.luzMap || {}).forEach(k => { if (k[0] === "f" && !activas.has(k)) this.luzDe(k, 0, 0, 0, 0, false); });
    // Efectos que manda la pelea (la primera vez que se ven, salen chispas)
    v.fx.forEach(f => {
      if (!n.vistos.has(f.k)) {
        n.vistos.add(f.k);
        const chispas = (c, k, vel) => { for (let i = 0; i < k; i++) { const a = Math.random() * 7, s = vel * (0.4 + Math.random()); Arena.particula(n, f.x, f.y, Math.cos(a) * s, Math.sin(a) * s - 40, 600, c, 4 + Math.random() * 3, 300); } };
        if (f.tipo === "num") chispas(f.color === "#3ddcb1" ? "#3ddcb1" : "#ffd43b", 8, 160);
        if (f.tipo === "boom") { chispas("#ff8c00", 22, 260); this.destello(f.x, f.y, 0xff8c1a, f.r * 4, now); }
        if (f.tipo === "muerte") chispas("#ffffff", 26, 300);
        if (f.tipo === "onda") { chispas(f.color, 18, 260); this.destello(f.x, f.y, this.color(f.color).c, f.r * 2.4, now); }
        ArenaFX.evento(n, f);
      }
      const k = Math.max(0, (vt - f.t) / 500); if (k > 1 && f.tipo !== "num") return;
      if (f.tipo === "tajo") {
        const a = Math.atan2(f.dy, f.dx), col = this.color(f.color).c;
        for (let i = 0; i < 3; i++) { g.lineStyle(10 - i * 3, i ? 0xffffff : col, (1 - k) * (i ? 0.5 : 1)); const r = f.r * (0.7 + i * 0.12), a0 = a - f.arco / 2 * (0.6 + k * 0.4), a1 = a + f.arco / 2 * (0.6 + k * 0.4); g.moveTo(f.x + Math.cos(a0) * r, f.y - 10 + Math.sin(a0) * r); g.arc(f.x, f.y - 10, r, a0, a1); }
        g.lineStyle(0);
      } else if (f.tipo === "onda") { const c = this.color(f.color).c; g.lineStyle(12 * (1 - k) + 2, c, 1 - k); g.beginFill(c, 0.15 * (1 - k)); g.drawCircle(f.x, f.y, f.r * (0.3 + 0.7 * k)); g.endFill(); g.lineStyle(0); }
      else if (f.tipo === "num") this.numero(f, vt);
    });
    if (n.vistos.size > 400) n.vistos = new Set([...n.vistos].slice(-200));
    // Textos de daño viejos
    Object.keys(this.pool.tx).forEach(k => { if (k.startsWith("ic")) return; const T = this.pool.tx[k]; if (vt - T.t > 1000 || !v.fx.some(f => f.k === +k)) { T.o.destroy(); delete this.pool.tx[k]; } });
    // Partículas: las simples (cuadraditos) y las de textura de ArenaFX
    n.part = n.part.filter(p => now - p.t0 < p.vida);
    n.fxp = (n.fxp || []).filter(p => now - p.t0 < p.vida);
    const total = n.part.length + n.fxp.length;
    while (this.pool.part.length < total) { const s = new PIXI.Sprite(PIXI.Texture.WHITE); s.anchor.set(0.5); this.part.addChild(s); this.pool.part.push(s); }
    let i = 0;
    for (const p of n.part) {
      const s = this.pool.part[i++], k = (now - p.t0) / 1000, vida = (now - p.t0) / p.vida, c = this.color(p.color), tam = p.tam * (1 - vida * 0.5);
      s.visible = true; s.texture = PIXI.Texture.WHITE; s.blendMode = PIXI.BLEND_MODES.NORMAL; s.tint = c.c; s.alpha = (1 - vida) * c.a; s.width = s.height = tam; s.rotation = 0;
      s.x = p.x + p.vx * k; s.y = p.y + p.vy * k + p.grav * k * k;
    }
    for (const p of n.fxp) {
      const T = this.texFx(p.tex), s = this.pool.part[i++]; if (!T) { s.visible = false; continue; }
      const k = (now - p.t0) / 1000, f = (now - p.t0) / p.vida, tam = p.tam * (1 + (p.crece - 1) * f);
      s.visible = true; s.texture = T; s.blendMode = p.add ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL; s.tint = this.color(p.color).c;
      s.alpha = Math.max(0, p.alfa * (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85)); s.width = tam * (p.esc ? p.esc[0] : 1); s.height = tam * (p.esc ? p.esc[1] : 1); s.rotation = p.rot + p.vrot * k;
      s.x = p.x + p.vx * k; s.y = p.y + p.vy * k + p.grav * k * k;
    }
    for (; i < this.pool.part.length; i++) this.pool.part[i].visible = false;
    // Destellos de luz (explosiones, ondas)
    this.destellos = (this.destellos || []).filter(d => { const k = (now - d.t0) / 450; if (k >= 1) { this.luzDe(d.k, 0, 0, 0, 0, false); return false; } this.luzDe(d.k, d.x, d.y, d.c, d.r * (1 - k * 0.5), true); const L = this.luzMap[d.k]; if (L) L.alpha = 1 - k; return true; });
  },
  destello(x, y, c, r, now) { this.nD = (this.nD || 0) + 1; (this.destellos = this.destellos || []).push({ k: "d" + this.nD, x, y, c, r, t0: now }); },
  numero(f, vt) {
    const kk = (vt - f.t) / 1000; if (kk > 1) return;
    let T = this.pool.tx[f.k];
    if (!T) { const o = new PIXI.Text(f.txt, { fontFamily: "Figtree, system-ui, sans-serif", fontSize: 24, fontWeight: "900", fill: f.color, stroke: "#000000", strokeThickness: 5 }); o.anchor.set(0.5); this.textos.addChild(o); T = this.pool.tx[f.k] = { o, t: f.t }; }
    const e = kk < 0.15 ? 0.6 + kk / 0.15 * 0.6 : 1.2 - kk * 0.2;
    T.o.x = f.x; T.o.y = f.y - kk * 50; T.o.scale.set(e); T.o.alpha = 1 - Math.max(0, kk - 0.5) * 2;
  },
  fuera(v, n, esc, W, H) {
    const g = this.flechas; g.clear(); const usados = new Set();
    v.jug.forEach(j => {
      if (!j.vivo || j.id === v.me) return;
      const o = n.otros[j.id] || j, sx = (o.x - n.camx) * esc + W / 2, sy = (o.y - 20 - n.camy) * esc + H / 2, m = 34;
      if (sx > m && sx < W - m && sy > m + 50 && sy < H - m - 90) return;
      const ex = Math.max(m, Math.min(W - m, sx)), ey = Math.max(m + 50, Math.min(H - m - 90, sy)), ang = Math.atan2(sy - H / 2, sx - W / 2);
      g.lineStyle(3, 0xff4d63, 1); g.beginFill(0x141120, 0.85); g.drawCircle(ex, ey, 20); g.endFill(); g.lineStyle(0);
      g.beginFill(0xff4d63); g.drawPolygon([ex + Math.cos(ang) * 30, ey + Math.sin(ang) * 30, ex + Math.cos(ang) * 20 - Math.sin(ang) * 8, ey + Math.sin(ang) * 20 + Math.cos(ang) * 8, ex + Math.cos(ang) * 20 + Math.sin(ang) * 8, ey + Math.sin(ang) * 20 - Math.cos(ang) * 8]); g.endFill();
      const ic = j.evoIc || AR.CLASES[j.clase].ic; usados.add(j.id);
      let T = this.pool.tx["ic" + j.id]; if (!T || T.ic !== ic) { if (T) T.o.destroy(); const o2 = new PIXI.Text(ic, { fontSize: 18, fontFamily: FE }); o2.anchor.set(0.5); this.flechasTx.addChild(o2); T = this.pool.tx["ic" + j.id] = { o: o2, ic, t: Infinity }; }
      T.o.x = ex; T.o.y = ey + 1; T.o.visible = true;
    });
    Object.keys(this.pool.tx).forEach(k => { if (k.startsWith("ic") && !usados.has(k.slice(2))) this.pool.tx[k].o.visible = false; });
  }
};
