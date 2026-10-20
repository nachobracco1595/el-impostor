/* Carrera Loca con PixiJS: pasto, barro, agua y cintas con textura que se mueven, obstáculos con volumen,
   sombras de nubes, polvo al correr, salpicones al caer al agua, estrellitas al chocar y papelitos en la meta.
   La carrera se calcula igual (carrera.js); si no hay WebGL se usa el dibujo de siempre. */
const CarreraPixi = {
  activo: false,
  lienzo(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; },
  tex(nombre, w, h, pintar) { this.cache = this.cache || {}; if (this.cache[nombre]) return this.cache[nombre]; const c = this.lienzo(w, h); pintar(c.getContext("2d"), w, h); return (this.cache[nombre] = PIXI.Texture.from(c)); },
  texFx(k) { return ArenaPixi.texFx(k); },

  montar(cv) {
    if (!ArenaPixi.listo || !ArenaPixi.soporta()) return false;
    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const app = new PIXI.Application({ view: cv, width: cv.clientWidth || 390, height: cv.clientHeight || 700, resolution: dpr, antialias: true, backgroundColor: 0x5fbf5f, eventFeatures: { move: false, globalMove: false, click: false, wheel: false } });
      app.ticker.stop(); cv.style.width = "100%"; cv.style.height = "100%";
      this.app = app; this.dpr = dpr;
      this.mundo = app.stage.addChild(new PIXI.Container());
      this.piso = this.mundo.addChild(new PIXI.Container());
      this.obj = this.mundo.addChild(new PIXI.Container()); this.obj.sortableChildren = true;
      this.part = this.mundo.addChild(new PIXI.Container());
      this.nubes = app.stage.addChild(new PIXI.Container());
      this.hud = app.stage.addChild(new PIXI.Graphics());
      this.corr = {}; this.pool = []; this.fxp = []; this.armada = null; this.activo = true;
      return true;
    } catch (e) { console.warn("PixiJS no arrancó en la carrera", e); this.desmontar(); return false; }
  },
  desmontar() { this.activo = false; try { if (this.app) this.app.destroy(false, { children: true, texture: false, baseTexture: false }); } catch {} this.app = null; this.corr = {}; this.armada = null; },

  /* ---------- Texturas ---------- */
  texPasto() {
    return this.tex("pasto", 240, 240, (x, w, h) => {
      const r = azarDe("pasto");
      x.fillStyle = "#5fbf5f"; x.fillRect(0, 0, w, h); x.fillStyle = "#58b558"; x.fillRect(0, 0, w, h / 2);
      for (let i = 0; i < 900; i++) { const px = r() * w, py = r() * h; x.strokeStyle = r() < 0.5 ? "rgba(40,120,40,.35)" : "rgba(170,230,140,.35)"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 3, py - 3 - r() * 4); x.stroke(); }
      for (let i = 0; i < 6; i++) { x.fillStyle = ["#fff", "#ffe066", "#ff8787", "#b197fc"][i % 4]; x.beginPath(); x.arc(r() * w, r() * h, 2.2, 0, 7); x.fill(); }
    });
  },
  texBarro() { return this.tex("barro", 160, 160, (x, w, h) => { const r = azarDe("barro"); x.fillStyle = "#8b5a2b"; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${60 + r() * 30},${35 + r() * 20},15,${0.25 + r() * 0.3})`; x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 16, 3 + r() * 8, r() * 3, 0, 7); x.fill(); } for (let i = 0; i < 10; i++) { x.fillStyle = "rgba(255,255,255,.12)"; x.beginPath(); x.ellipse(r() * w, r() * h, 6, 2, 0, 0, 7); x.fill(); } }); },
  texAgua() { return this.tex("agua", 128, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#339af0"); g.addColorStop(1, "#1c7ed6"); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2; for (let k = 0; k < 6; k++) { x.beginPath(); for (let i = 0; i <= w; i += 8) { const y = 12 + k * 21 + Math.sin(i / 128 * Math.PI * 4 + k) * 3; i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); } }); },
  texCinta() { return this.tex("cinta", 60, 60, (x, w, h) => { x.fillStyle = "#3d4247"; x.fillRect(0, 0, w, h); x.fillStyle = "#495057"; x.fillRect(0, 0, w, 6); x.fillStyle = "#ffd43b"; x.beginPath(); x.moveTo(18, 14); x.lineTo(38, 30); x.lineTo(18, 46); x.lineTo(26, 30); x.closePath(); x.fill(); }); },
  texBarra() { return this.tex("barra", 256, 32, (x, w, h) => { x.fillStyle = "#c2410c"; x.beginPath(); x.roundRect(0, 4, w, h - 8, 12); x.fill(); for (let k = 0; k < w; k += 32) { x.fillStyle = "#fff3bf"; x.beginPath(); x.moveTo(k, 4); x.lineTo(k + 14, 4); x.lineTo(k + 4, h - 4); x.lineTo(k - 10, h - 4); x.fill(); } x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(6, 7, w - 12, 4); }); },
  texBloque() { return this.tex("bloque", 128, 48, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#ff6b6b"); g.addColorStop(1, "#c92a2a"); x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, w, h, 10); x.fill(); x.fillStyle = "rgba(255,255,255,.9)"; for (let k = 8; k < w - 8; k += 28) x.fillRect(k, 6, 12, h - 12); x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(4, 3, w - 8, 4); }); },
  texBola() { return this.tex("bola", 96, 96, (x, w, h) => { x.fillStyle = "#ffd43b"; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; x.beginPath(); x.moveTo(48 + Math.cos(a - 0.22) * 30, 48 + Math.sin(a - 0.22) * 30); x.lineTo(48 + Math.cos(a) * 46, 48 + Math.sin(a) * 46); x.lineTo(48 + Math.cos(a + 0.22) * 30, 48 + Math.sin(a + 0.22) * 30); x.fill(); } const g = x.createRadialGradient(38, 36, 4, 48, 48, 34); g.addColorStop(0, "#dee2e6"); g.addColorStop(1, "#343a40"); x.fillStyle = g; x.beginPath(); x.arc(48, 48, 32, 0, 7); x.fill(); }); },
  texSombra() { return this.tex("sombra", 64, 32, (x) => { const g = x.createRadialGradient(32, 16, 2, 32, 16, 30); g.addColorStop(0, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 32); }); },
  texNube() { return this.tex("nube", 256, 160, (x) => { const g = x.createRadialGradient(128, 80, 10, 128, 80, 120); g.addColorStop(0, "rgba(0,0,0,.16)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.beginPath(); x.ellipse(128, 80, 128, 80, 0, 0, 7); x.fill(); }); },
  texLinea(a, b) { return this.tex("linea" + a + b, 480, 16, (x) => { for (let k = 0; k < 16; k++) { x.fillStyle = k % 2 ? a : b; x.fillRect(k * 30, 0, 30, 8); x.fillStyle = k % 2 ? b : a; x.fillRect(k * 30, 8, 30, 8); } }); },
  texPierna() { return this.tex("pierna", 28, 36, (x) => { x.scale(2, 2); x.fillStyle = "#1b1726"; x.beginPath(); x.roundRect(3.5, 0, 7, 12, 3.5); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.ellipse(7, 12, 5, 3.5, 0, 0, 7); x.fill(); }); },

  /* ---------- Armar la pista (una vez por carrera) ---------- */
  armar(U) {
    if (this.armada === U.id) return;
    this.armada = U.id;
    [this.piso, this.obj, this.part, this.nubes].forEach(c => c.removeChildren().forEach(o => o.destroy()));
    this.corr = {}; this.pool = []; this.fxp = [];
    const W = CR.W, Y = y => -y;
    const pasto = new PIXI.TilingSprite(this.texPasto(), W, CR.LARGO + 1600); pasto.x = 0; pasto.y = Y(CR.LARGO + 800); this.piso.addChild(pasto);
    const borde = new PIXI.Graphics(); borde.beginFill(0xffffff, 0.18); borde.drawRect(0, Y(CR.LARGO + 800), 4, CR.LARGO + 1600); borde.drawRect(W - 4, Y(CR.LARGO + 800), 4, CR.LARGO + 1600); borde.endFill(); this.piso.addChild(borde);
    const linea = (y, a, b) => { const s = new PIXI.Sprite(this.texLinea(a, b)); s.x = 0; s.y = Y(y) - 8; this.piso.addChild(s); };
    linea(CR.LARGO, "#fff", "#1b1726"); linea(0, "#fff", "#e03131");
    // Arco de la meta
    const arco = new PIXI.Graphics(); arco.lineStyle(10, 0xffd43b); arco.moveTo(10, Y(CR.LARGO)); arco.lineTo(10, Y(CR.LARGO) - 80); arco.lineTo(W - 10, Y(CR.LARGO) - 80); arco.lineTo(W - 10, Y(CR.LARGO)); this.obj.addChild(arco); arco.zIndex = -CR.LARGO + 100;
    const meta = new PIXI.Text("🏁 META 🏁", { fontFamily: "Figtree, system-ui, sans-serif", fontSize: 30, fontWeight: "900", fill: "#1b1726", stroke: "#ffd43b", strokeThickness: 6 }); meta.anchor.set(0.5); meta.x = W / 2; meta.y = Y(CR.LARGO) - 80; meta.zIndex = -CR.LARGO + 101; this.obj.addChild(meta);
    U.cps.forEach((y, k) => { if (!k) return; const g = new PIXI.Graphics(); g.beginFill(0xffffff, 0.35); g.drawRect(0, Y(y) - 2, W, 3); g.endFill(); this.piso.addChild(g); const f = new PIXI.Text("🚩", { fontSize: 22, fontFamily: FE }); f.x = 6; f.y = Y(y) - 30; this.piso.addChild(f); });
    // Obstáculos
    this.obs = U.obst.map(o => {
      const h = o.h || 60;
      if (o.t === "barro") { const s = new PIXI.TilingSprite(this.texBarro(), W, o.h); s.x = 0; s.y = Y(o.y + o.h); this.piso.addChild(s); return { o }; }
      if (o.t === "cinta") { const s = new PIXI.TilingSprite(this.texCinta(), W, o.h); s.x = 0; s.y = Y(o.y + o.h); if (o.dir < 0) { s.tileScale.x = -1; } this.piso.addChild(s); return { o, s }; }
      if (o.t === "pozo") {
        const w = Math.min(W - o.x, o.w), s = new PIXI.TilingSprite(this.texAgua(), w, o.h); s.x = o.x; s.y = Y(o.y + o.h);
        const m = new PIXI.Graphics(); m.beginFill(0xffffff); m.drawRoundedRect(o.x, Y(o.y + o.h), w, o.h, 12); m.endFill(); s.mask = m;
        const espuma = new PIXI.Graphics(); espuma.lineStyle(4, 0xe7f5ff, 0.8); espuma.drawRoundedRect(o.x, Y(o.y + o.h), w, o.h, 12);
        this.piso.addChild(s, m, espuma); return { o, s };
      }
      if (o.t === "barra") {
        const som = new PIXI.Sprite(this.texBarra()); som.anchor.set(0.5); som.tint = 0x000000; som.alpha = 0.25; som.width = o.largo * 2; som.height = 18;
        const s = new PIXI.Sprite(this.texBarra()); s.anchor.set(0.5); s.width = o.largo * 2; s.height = 18;
        const eje = new PIXI.Graphics(); eje.beginFill(0x343a40); eje.drawCircle(0, 0, 14); eje.endFill(); eje.beginFill(0xadb5bd); eje.drawCircle(-3, -3, 5); eje.endFill(); eje.x = o.x; eje.y = Y(o.y);
        som.x = o.x + 4; som.y = Y(o.y) + 6; s.x = o.x; s.y = Y(o.y); this.piso.addChild(som); this.obj.addChild(s, eje); s.zIndex = eje.zIndex = -o.y + 40;
        return { o, s, som };
      }
      if (o.t === "bloque") {
        const som = new PIXI.Sprite(this.texSombra()); som.anchor.set(0.5); som.width = o.w * 1.1; som.height = o.h * 0.9;
        const s = new PIXI.Sprite(this.texBloque()); s.anchor.set(0.5); s.width = o.w; s.height = o.h; this.piso.addChild(som); this.obj.addChild(s); s.zIndex = -o.y;
        return { o, s, som };
      }
      if (o.t === "pendulo") {
        const cad = new PIXI.Graphics(); this.obj.addChild(cad); cad.zIndex = -o.y - 1;
        const som = new PIXI.Sprite(this.texSombra()); som.anchor.set(0.5); som.width = o.r * 2.6; som.height = o.r * 1.2; this.piso.addChild(som);
        const s = new PIXI.Sprite(this.texBola()); s.anchor.set(0.5); s.width = s.height = o.r * 2.9; this.obj.addChild(s); s.zIndex = -o.y;
        return { o, s, som, cad };
      }
      if (o.t === "puertas") {
        const ancho = W / o.n, ps = [];
        for (let k = 0; k < o.n; k++) {
          const g = new PIXI.Graphics(); g.beginFill(0xffffff); g.drawRoundedRect(0, 0, ancho - 8, 24, 6); g.endFill(); g.x = k * ancho + 4; g.y = Y(o.y + 12); g.tint = [0x7048e8, 0x1c7ed6, 0x2b8a3e, 0xf08c00, 0xd6336c][k % 5];
          const tx = new PIXI.Text("?", { fontFamily: "system-ui, sans-serif", fontSize: 18, fontWeight: "900", fill: "#ffffff" }); tx.anchor.set(0.5); tx.x = k * ancho + ancho / 2; tx.y = Y(o.y) - 6;
          this.obj.addChild(g, tx); g.zIndex = tx.zIndex = -o.y + 5; ps.push({ g, tx, k });
        }
        return { o, ps };
      }
      return { o };
    });
    // Sombras de nubes que pasan
    this.nubesL = Array.from({ length: 4 }, (_, i) => { const s = new PIXI.Sprite(this.texNube()); s.anchor.set(0.5); s.width = 420; s.height = 260; s.alpha = 0.8; this.nubes.addChild(s); return { s, f: i * 1.7 }; });
  },

  /* ---------- Corredores ---------- */
  corredor(j) {
    let c = this.corr[j.id]; if (c) return c;
    const cont = new PIXI.Container(), som = new PIXI.Sprite(this.texSombra()); som.anchor.set(0.5); som.width = 34; som.height = 14;
    const cuerpo = new PIXI.Container(), pi = new PIXI.Sprite(this.texPierna()), pd = new PIXI.Sprite(this.texPierna());
    const col = parseInt(((j.look && j.look.color) || "#748ffc").replace("#", ""), 16);
    [pi, pd].forEach((p, i) => { p.anchor.set(0.5, 0); p.x = i ? 7 : -7; p.y = -2; p.width = 14; p.height = 18; p.tint = col; });
    const img = Mundo.muneco(j.look), tx = PIXI.Texture.from(img), b = new PIXI.Sprite(tx); b.anchor.set(0.5, 1); b.width = 44; b.height = 50; b.y = 6;
    cuerpo.addChild(pi, pd, b);
    const nom = new PIXI.Text((j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name).slice(0, 10), { fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: "800", fill: j.id === Carrera.v.me ? "#ffd43b" : "#ffffff", stroke: "#000000", strokeThickness: 3 }); nom.anchor.set(0.5, 1);
    const icono = new PIXI.Text("", { fontSize: 16, fontFamily: FE }); icono.anchor.set(0.5, 1);
    cont.addChild(cuerpo, nom, icono); this.obj.addChild(cont); this.piso.addChild(som);
    return (this.corr[j.id] = { cont, som, cuerpo, pi, pd, b, nom, icono, prev: {} });
  },

  /* ---------- Partículas ---------- */
  emitir(p) { this.fxp.push({ t0: performance.now(), vx: 0, vy: 0, grav: 0, rot: Math.random() * 6.28, vrot: 0, tam: 20, crece: 1, alfa: 1, add: false, ...p }); if (this.fxp.length > 260) this.fxp.splice(0, this.fxp.length - 260); },
  particulas(now) {
    this.fxp = this.fxp.filter(p => now - p.t0 < p.vida);
    while (this.pool.length < this.fxp.length) { const s = new PIXI.Sprite(PIXI.Texture.WHITE); s.anchor.set(0.5); this.part.addChild(s); this.pool.push(s); }
    let i = 0;
    for (const p of this.fxp) {
      const s = this.pool[i++], k = (now - p.t0) / 1000, f = (now - p.t0) / p.vida, tam = p.tam * (1 + (p.crece - 1) * f);
      s.visible = true; s.texture = p.tex ? this.texFx(p.tex) : PIXI.Texture.WHITE; s.tint = p.color; s.blendMode = p.add ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;
      s.alpha = Math.max(0, p.alfa * (f < 0.1 ? f / 0.1 : 1 - (f - 0.1) / 0.9)); s.width = s.height = tam; s.rotation = p.rot + p.vrot * k;
      s.x = p.x + p.vx * k; s.y = p.y + p.vy * k + p.grav * k * k;
    }
    for (; i < this.pool.length; i++) this.pool[i].visible = false;
  },

  /* ---------- Cada cuadro ---------- */
  dibujar(now) {
    const U = UI.cr, v = Carrera.v, app = this.app; if (!app || !U || !v) return;
    const cv = app.view, Wp = cv.clientWidth, Hp = cv.clientHeight;
    if (app.renderer.width !== Math.round(Wp * this.dpr) || app.renderer.height !== Math.round(Hp * this.dpr)) app.renderer.resize(Wp, Hp);
    this.armar(U);
    const esc = Wp / CR.W, t = Carrera.opts.local ? S.car.t : now / 1000 - U.off, yo = U.yo, camY = yo.y;
    this.mundo.scale.set(esc); this.mundo.x = 0; this.mundo.y = Hp * 0.68 + camY * esc;
    // Obstáculos que se mueven
    for (const X of this.obs) {
      const o = X.o; if (Math.abs(o.y - camY) * esc > Hp + 300) { if (X.s) X.s.visible = false; continue; } if (X.s) X.s.visible = true;
      if (o.t === "cinta") X.s.tilePosition.x = (t * o.vel * o.dir) % 60 * (o.dir < 0 ? -1 : 1);
      else if (o.t === "pozo") { X.s.tilePosition.x = t * 14; X.s.tilePosition.y = Math.sin(t * 1.3) * 6; if (Math.random() < 0.05) this.emitir({ x: o.x + Math.random() * Math.min(CR.W - o.x, o.w), y: -(o.y + Math.random() * o.h), tex: "circle_05", color: 0xe7f5ff, vida: 900, tam: 10, crece: 2.6, alfa: 0.6 }); }
      else if (o.t === "barra") { const a = Carrera.angBarra(o, t); X.s.rotation = -a; X.som.rotation = -a; }
      else if (o.t === "bloque") { const cx = Carrera.xBloque(o, t); X.s.x = cx; X.s.y = -o.y; X.som.x = cx + 4; X.som.y = -o.y + 8; }
      else if (o.t === "pendulo") { const cx = Carrera.xBloque(o, t); X.s.x = cx; X.s.y = -o.y; X.s.rotation = t * 2; X.som.x = cx + 5; X.som.y = -o.y + 10; X.cad.clear(); X.cad.lineStyle(3, 0x495057, 0.8); X.cad.moveTo(CR.W / 2, -o.y - 4); X.cad.lineTo(cx, -o.y); }
      else if (o.t === "puertas") X.ps.forEach(P => { const probada = U.chocadas.has(o.y + ":" + P.k); if (probada && !P.ya) { P.ya = true; P.g.tint = 0xc92a2a; P.tx.text = "✕"; for (let i = 0; i < 8; i++) this.emitir({ x: P.tx.x, y: P.tx.y + 10, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 140, grav: 300, tex: "star_04", color: 0xffffff, vida: 600, tam: 14, add: true }); } });
    }
    if (yo.choco) { U.chocadas.add(yo.choco.y + ":" + yo.choco.k); yo.choco = null; }
    // Corredores
    const lista = v.jug.map(j => j.id === v.me ? { ...j, x: yo.x, y: yo.y, s: yo.salto > 0, c: yo.cae > 0, g: yo.golpe > 0, yo: true } : (() => {
      if (Carrera.opts.local) { const J = S.car.jug.find(x => x.id === j.id); return { ...j, x: J.x, y: J.y, s: J.salto > 0, c: J.cae > 0, g: J.golpe > 0 }; }
      const o = U.otros[j.id] = U.otros[j.id] || { x: j.x, y: j.y }; o.x += (j.x - o.x) * 0.25; o.y += (j.y - o.y) * 0.25; return { ...j, x: o.x, y: o.y };
    })());
    const ahora = now / 1000, A = U.anim = U.anim || {};
    for (const j of lista) {
      const a = A[j.id] = A[j.id] || { x: j.x, y: j.y, t: ahora, fase: 0, vel: 0, dir: 1, salto: -9 };
      const dt = Math.min(0.1, Math.max(0.001, ahora - a.t)), dx = j.x - a.x, dy = j.y - a.y, d = Math.hypot(dx, dy);
      a.vel += ((d < 60 ? d / dt : 0) - a.vel) * Math.min(1, dt * 12);
      if (d < 60) a.fase += d * 0.11;
      if (Math.abs(dx) > 0.4) a.dir += ((dx > 0 ? 1 : -1) - a.dir) * Math.min(1, dt * 10);
      const C = this.corredor(j);
      if (j.s && !a.sal) { a.salto = ahora; for (let i = 0; i < 6; i++) this.emitir({ x: j.x + (Math.random() - 0.5) * 20, y: -j.y + 10, vx: (Math.random() - 0.5) * 80, vy: -20, tex: "smoke_03", color: 0xffffff, vida: 500, tam: 18, crece: 1.8, alfa: 0.6 }); }
      a.sal = j.s; a.x = j.x; a.y = j.y; a.t = ahora;
      const anda = a.vel > 25 && !j.c, ps = Math.min(1, (ahora - a.salto) / CR.SALTO), enAire = ps < 1;
      const alt = enAire ? Math.sin(ps * Math.PI) * 26 : 0, alto = enAire ? 1 + Math.sin(ps * Math.PI) * 0.18 : 1;
      const rebote = anda && !enAire ? Math.abs(Math.sin(a.fase)) * 4 : Math.sin(ahora * 3 + j.x) * 0.8;
      const paso = enAire ? 0.7 : anda ? Math.sin(a.fase) : 0;
      C.cont.x = j.x; C.cont.y = -j.y; C.cont.zIndex = -j.y + 20; C.som.x = j.x; C.som.y = -j.y + 10;
      C.som.width = 34 * (1 - alt / 60); C.som.height = 14 * (1 - alt / 60);
      C.cuerpo.y = -rebote - alt; C.cuerpo.scale.set(alto * (a.dir < 0 ? -1 : 1) * Math.max(0.85, Math.abs(a.dir)), alto * (enAire ? 1 : 1 - Math.abs(Math.cos(a.fase)) * (anda ? 0.04 : 0)));
      C.cuerpo.rotation = (anda && !enAire ? Math.sin(a.fase) * 0.09 + Math.min(0.12, a.vel / 2000) : 0) + (j.g ? Math.sin(ahora * 40) * 0.15 : 0);
      // Piernas que se cruzan al correr (y se encogen en el aire)
      C.pi.rotation = paso * 0.6; C.pd.rotation = (enAire ? -0.7 : -paso) * 0.6;
      C.pi.height = C.pd.height = enAire ? 13 : 18;
      C.cuerpo.alpha = j.c ? 0.35 : 1;
      const top = -50 * alto - alt - rebote;
      C.nom.y = top - (j.g ? 16 : 0); C.icono.y = j.g ? top : -46; C.icono.text = j.g ? "💫" : j.c ? "💦" : "";
      // Polvo al correr, salpicón al caer al agua, estrellitas al chocar
      if (anda && !enAire && Math.random() < 0.3) this.emitir({ x: j.x + (Math.random() - 0.5) * 12, y: -j.y + 12, vx: (Math.random() - 0.5) * 30, vy: -10, tex: "dirt_02", color: 0x8d6e47, vida: 500, tam: 12, crece: 1.6, alfa: 0.5 });
      if (j.c && !C.prev.c) for (let i = 0; i < 14; i++) this.emitir({ x: j.x, y: -j.y, vx: (Math.random() - 0.5) * 200, vy: -80 - Math.random() * 160, grav: 420, tex: "circle_05", color: 0xa5d8ff, vida: 800, tam: 12, add: true });
      if (j.g && !C.prev.g) for (let i = 0; i < 8; i++) this.emitir({ x: j.x, y: -j.y - 30, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 120, grav: 200, tex: "star_04", color: 0xffe066, vida: 700, tam: 18, add: true });
      if (j.meta != null && C.prev.meta == null) for (let i = 0; i < 40; i++) this.emitir({ x: j.x + (Math.random() - 0.5) * 60, y: -j.y - 40, vx: (Math.random() - 0.5) * 300, vy: -150 - Math.random() * 200, grav: 380, color: [0xffd43b, 0xff6b6b, 0x4dabf7, 0x3ddcb1, 0xcc5de8][i % 5], vida: 1600, tam: 7, vrot: 8 });
      C.prev = { c: j.c, g: j.g, meta: j.meta };
    }
    this.particulas(now);
    // Sombras de nubes
    this.nubesL.forEach(({ s, f }) => { s.x = ((t * 18 + f * 170) % (Wp + 500)) - 250; s.y = ((f * 260 + camY * esc * 0.4) % (Hp + 400)) - 200; });
    // Barra de progreso a la izquierda
    const g = this.hud; g.clear(); const bx = 12, by0 = Hp * 0.16, by1 = Hp * 0.62;
    g.beginFill(0x000000, 0.35); g.drawRoundedRect(bx - 4, by0, 8, by1 - by0, 4); g.endFill();
    lista.forEach(j => { const yy = by1 - (Math.min(CR.LARGO, j.y) / CR.LARGO) * (by1 - by0); g.beginFill(j.yo ? 0xffd43b : parseInt(((j.look && j.look.color) || "#ffffff").replace("#", ""), 16)); g.drawCircle(bx, yy, j.yo ? 7 : 5); g.endFill(); });
    app.renderer.render(app.stage);
    Carrera.cuenta(v, yo, t);
  }
};
