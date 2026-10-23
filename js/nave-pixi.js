/* La Nave con PixiJS: estrellas en capas, casco con muebles en cada sala, luces de techo, motores encendidos,
   botón de emergencia con luz roja, estaciones de tarea que brillan y polvo al caminar.
   La visión sigue siendo la misma (fuera de tu radio todo queda oscuro). Sin WebGL se usa el dibujo de siempre. */
const NavePixi = {
  activo: false,
  lienzo(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; },
  /* Una sola Application (un solo contexto WebGL) para todas las partidas, como en la Arena: en iPhone crear una
     por partida llena la memoria de video y "otra partida" se tilda. Entre partidas solo se vacía la escena. */
  montar(cv) {
    if (!ArenaPixi.listo || !ArenaPixi.soporta()) return false;
    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let app = this.app;
      if (app && (!app.renderer || app.renderer.gl.isContextLost())) { this.desmontar(true); app = null; }
      if (app) { const vw = app.view; vw.id = cv.id; vw.className = cv.className; cv.replaceWith(vw); cv = vw; }
      else {
        app = new PIXI.Application({ view: cv, width: cv.clientWidth || 390, height: cv.clientHeight || 700, resolution: dpr, antialias: true, backgroundColor: 0x05040a, eventFeatures: { move: false, globalMove: false, click: false, wheel: false } });
        app.ticker.stop();
        // Los toques los maneja la nave: sin esto PixiJS deja un requestAnimationFrame andando para siempre
        try { app.renderer.events.setTargetElement(null); } catch {}
        // Si iOS se lleva el contexto (segundo plano, poca memoria) y no vuelve, Nave.loop arma otro lienzo
        cv.addEventListener("webglcontextlost", () => { this.perdido = this.perdido || performance.now(); });
        cv.addEventListener("webglcontextrestored", () => { this.perdido = 0; });
        this.perdido = 0;
      }
      cv.style.width = "100%"; cv.style.height = "100%";
      this.app = app; this.dpr = dpr;
      this.cielo = app.stage.addChild(new PIXI.Container());
      this.mundo = app.stage.addChild(new PIXI.Container());
      this.nave = this.mundo.addChild(new PIXI.Container());
      this.cosas = this.mundo.addChild(new PIXI.Container());
      this.ents = this.mundo.addChild(new PIXI.Container()); this.ents.sortableChildren = true;
      this.part = this.mundo.addChild(new PIXI.Container());
      this.luzCapa = new PIXI.Container();
      this.ambiente = this.luzCapa.addChild(new PIXI.Sprite(PIXI.Texture.WHITE)); this.ambiente.tint = 0x8a90ae;
      this.luces = this.luzCapa.addChild(new PIXI.Container());
      this.rt = PIXI.RenderTexture.create({ width: 64, height: 64, resolution: 0.5 });
      this.luz = app.stage.addChild(new PIXI.Sprite(this.rt)); this.luz.blendMode = PIXI.BLEND_MODES.MULTIPLY;
      this.vision = app.stage.addChild(new PIXI.Sprite(this.texVision()));
      this.tapa = null; this.pj = {}; this.pool = []; this.fxp = []; this.armada = false; this.activo = true;
      this.armar();
      return true;
    } catch (e) { console.warn("PixiJS no arrancó en La Nave", e); this.desmontar(true); return false; }
  },
  /* Vacía la escena (las texturas compartidas quedan). Con todo = true también suelta el contexto WebGL */
  desmontar(todo) {
    this.activo = false;
    try { if (this.app && this.app.stage) this.app.stage.removeChildren().forEach(c => c.destroy({ children: true })); } catch {}
    try { if (this.luzCapa) this.luzCapa.destroy({ children: true }); } catch {}
    try { if (this.rt) this.rt.destroy(true); } catch {}
    this.rt = null; this.luzCapa = null; this.tapa = null; this.pj = {}; this.pool = []; this.fxp = [];
    if (todo) {
      try { if (this.app) this.app.destroy(false, { children: true, texture: false, baseTexture: false }); } catch {}
      this.app = null; this.perdido = 0;
    }
  },
  /* El contexto WebGL se perdió y no volvió (pasa en iPhone al volver del segundo plano) */
  caido() { const a = this.app; if (!this.activo || !a || !a.renderer) return false; if (!a.renderer.gl.isContextLost()) { this.perdido = 0; return false; } this.perdido = this.perdido || performance.now(); return !document.hidden && performance.now() - this.perdido > 1500; },

  texVision() {
    if (this.tVision) return this.tVision;
    const c = this.lienzo(512, 512), x = c.getContext("2d"), g = x.createRadialGradient(256, 256, 256 * 0.55, 256, 256, 256);
    g.addColorStop(0, "rgba(3,2,8,0)"); g.addColorStop(1, "rgba(3,2,8,.93)"); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    return (this.tVision = PIXI.Texture.from(c));
  },
  texEstrellas(semilla, n, tam) {
    const T = this.tEst = this.tEst || {}; if (T[semilla]) return T[semilla];
    const c = this.lienzo(512, 512), x = c.getContext("2d"), r = azarDe(semilla);
    for (let i = 0; i < n; i++) { x.globalAlpha = 0.3 + r() * 0.7; x.fillStyle = r() < 0.15 ? "#a5d8ff" : r() < 0.1 ? "#ffd8a8" : "#ffffff"; const s = tam * (0.4 + r()); x.fillRect(r() * 512, r() * 512, s, s); }
    return (T[semilla] = PIXI.Texture.from(c));
  },
  /* El casco de la nave se pinta una vez (pisos, paredes y muebles de cada sala) */
  ESCALA: 1.25,
  texNave() {
    if (this.tNave) return this.tNave;
    const S = this.ESCALA, c = this.lienzo(Math.round((NV.W + 200) * S), Math.round((NV.H + 200) * S)), x = c.getContext("2d"), r = azarDe("nave-pixi");
    x.scale(S, S); x.translate(100, 100);
    const ruido = (z, n, col, tam, a) => { for (let i = 0; i < n; i++) { x.globalAlpha = a * (0.4 + r() * 0.6); x.fillStyle = col; x.fillRect(z.x + r() * z.w, z.y + r() * z.h, tam, tam); } x.globalAlpha = 1; };
    // Casco exterior (sombra gruesa alrededor de todas las zonas)
    x.fillStyle = "#11131f"; NV.ZONAS.forEach(z => { x.beginPath(); x.roundRect(z.x - 26, z.y - 26, z.w + 52, z.h + 52, 22); x.fill(); });
    x.fillStyle = "#2a2f45"; NV.ZONAS.forEach(z => { x.beginPath(); x.roundRect(z.x - 12, z.y - 12, z.w + 24, z.h + 24, 14); x.fill(); });
    // Pasillos con rejilla
    NV.PASILLOS.forEach(z => { x.fillStyle = "#1c2033"; x.fillRect(z.x, z.y, z.w, z.h); x.strokeStyle = "#2d3350"; x.lineWidth = 2; for (let k = z.x; k < z.x + z.w; k += 10) { x.beginPath(); x.moveTo(k, z.y); x.lineTo(k, z.y + z.h); x.stroke(); } });
    // Salas: baldosas, ruido, nombre y muebles
    NV.SALAS.forEach(z => {
      x.fillStyle = z.color; x.fillRect(z.x, z.y, z.w, z.h);
      for (let gx = z.x; gx < z.x + z.w; gx += 40) for (let gy = z.y; gy < z.y + z.h; gy += 40) { x.fillStyle = (gx + gy) % 80 ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.06)"; x.fillRect(gx + 1, gy + 1, 38, 38); }
      ruido(z, 300, "#000", 2, 0.12);
      this.muebles(x, z, r);
      x.strokeStyle = "#8a93b8"; x.lineWidth = 6; x.strokeRect(z.x, z.y, z.w, z.h); x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 2; x.strokeRect(z.x + 6, z.y + 6, z.w - 12, z.h - 12);
      x.fillStyle = "rgba(255,255,255,.35)"; x.font = "bold 22px Figtree, sans-serif"; x.textAlign = "left"; x.textBaseline = "alphabetic"; x.fillText(z.nombre.toUpperCase(), z.x + 14, z.y + 30);
    });
    // Abrir las paredes donde llegan los pasillos
    NV.PASILLOS.forEach(z => { x.fillStyle = "#1c2033"; x.fillRect(z.x + 3, z.y + 3, z.w - 6, z.h - 6); x.strokeStyle = "#2d3350"; x.lineWidth = 2; for (let k = z.x + 3; k < z.x + z.w - 3; k += 10) { x.beginPath(); x.moveTo(k, z.y + 3); x.lineTo(k, z.y + z.h - 3); x.stroke(); } });
    return (this.tNave = PIXI.Texture.from(c));
  },
  muebles(x, z, r) {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    const mesa = (mx, my, rr) => { x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(mx + 4, my + 6, rr, rr * 0.6, 0, 0, 7); x.fill(); x.fillStyle = "#9aa3c7"; x.beginPath(); x.arc(mx, my, rr, 0, 7); x.fill(); x.fillStyle = "#c5cbe6"; x.beginPath(); x.arc(mx - 4, my - 4, rr * 0.6, 0, 7); x.fill(); };
    const consola = (mx, my, w, col) => { x.fillStyle = "#1b1f30"; x.fillRect(mx, my, w, 26); x.fillStyle = col; for (let k = 0; k < w - 10; k += 14) x.fillRect(mx + 6 + k, my + 6, 8, 5); x.fillStyle = "#3ddcb1"; x.fillRect(mx + 6, my + 16, w - 12, 4); };
    if (z.id === "cafe") { mesa(z.x + 110, z.y + 150, 34); mesa(z.x + 300, z.y + 150, 34); mesa(z.x + 205, z.y + 215, 30); }
    else if (z.id === "enf") { for (let k = 0; k < 2; k++) { x.fillStyle = "#e9ecef"; x.fillRect(z.x + 40 + k * 120, z.y + 140, 80, 44); x.fillStyle = "#74c0fc"; x.fillRect(z.x + 40 + k * 120, z.y + 140, 22, 44); } x.fillStyle = "#ff6b6b"; x.fillRect(z.x + z.w - 60, z.y + 60, 30, 10); x.fillRect(z.x + z.w - 50, z.y + 50, 10, 30); }
    else if (z.id === "armas") { consola(z.x + 40, z.y + 170, 140, "#ff6b6b"); x.fillStyle = "#495057"; x.beginPath(); x.arc(z.x + 230, z.y + 120, 34, 0, 7); x.fill(); x.fillStyle = "#212529"; x.fillRect(z.x + 226, z.y + 60, 8, 50); }
    else if (z.id === "nav") { consola(z.x + 40, z.y + 180, 180, "#74c0fc"); x.strokeStyle = "rgba(116,192,252,.5)"; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy - 10, 50, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy - 10, 25, 0, 7); x.stroke(); }
    else if (z.id === "esc") { for (let k = 0; k < 3; k++) { x.fillStyle = "rgba(81,207,102,.25)"; x.beginPath(); x.arc(z.x + 70 + k * 80, z.y + 120, 26, 0, 7); x.fill(); x.strokeStyle = "#51cf66"; x.lineWidth = 3; x.stroke(); } }
    else if (z.id === "alm") { for (let k = 0; k < 4; k++) { const bx = z.x + 30 + (k % 2) * 60, by = z.y + 50 + Math.floor(k / 2) * 60; x.fillStyle = "#8d6e47"; x.fillRect(bx, by, 48, 48); x.strokeStyle = "#5c4428"; x.lineWidth = 3; x.strokeRect(bx + 2, by + 2, 44, 44); x.beginPath(); x.moveTo(bx + 4, by + 4); x.lineTo(bx + 44, by + 44); x.stroke(); } }
    else if (z.id === "elec") { for (let k = 0; k < 4; k++) { x.fillStyle = "#343a40"; x.fillRect(z.x + 30 + k * 52, z.y + 50, 40, 60); x.fillStyle = k % 2 ? "#ffd43b" : "#ff922b"; x.fillRect(z.x + 36 + k * 52, z.y + 58, 28, 6); x.fillStyle = "#3ddcb1"; x.beginPath(); x.arc(z.x + 50 + k * 52, z.y + 95, 4, 0, 7); x.fill(); } }
    else if (z.id === "mot") { for (let k = 0; k < 2; k++) { const my = z.y + 60 + k * 120; x.fillStyle = "#495057"; x.beginPath(); x.roundRect(z.x + 20, my, 150, 70, 30); x.fill(); x.fillStyle = "#868e96"; x.fillRect(z.x + 40, my + 10, 110, 8); x.fillStyle = "#ff922b"; x.beginPath(); x.arc(z.x + 20, my + 35, 22, 0, 7); x.fill(); } }
  },
  armar() {
    const W = this.app.renderer.width, H = this.app.renderer.height;
    this.est1 = this.cielo.addChild(new PIXI.TilingSprite(this.texEstrellas("e1", 160, 1.6), 64, 64));
    this.est2 = this.cielo.addChild(new PIXI.TilingSprite(this.texEstrellas("e2", 60, 2.6), 64, 64));
    const neb = this.cielo.addChild(new PIXI.Sprite(ArenaPixi.texFx("smoke_07"))); neb.tint = 0x5f3dc4; neb.alpha = 0.18; neb.blendMode = PIXI.BLEND_MODES.ADD; this.neb = neb;
    const casco = new PIXI.Sprite(this.texNave()); casco.x = -100; casco.y = -100; casco.scale.set(1 / this.ESCALA); this.nave.addChild(casco);
    // Luces de techo en cada sala; motores y electricidad con luz propia
    const L = (x, y, rad, col, a = 0.8) => { const s = new PIXI.Sprite(ArenaPixi.texRadial("rgba(255,255,255,1)", "luz")); s.anchor.set(0.5); s.x = x; s.y = y; s.width = s.height = rad * 2; s.tint = col; s.alpha = a; s.blendMode = PIXI.BLEND_MODES.ADD; this.luces.addChild(s); return s; };
    this.lucesSala = NV.SALAS.map(z => L(z.x + z.w / 2, z.y + z.h / 2, Math.max(z.w, z.h) * 0.75, 0xdfe7ff, 0.75));
    NV.PASILLOS.forEach(z => L(z.x + z.w / 2, z.y + z.h / 2, 90, 0x9fb4ff, 0.5));
    const mot = NV.SALAS.find(z => z.id === "mot");
    this.motores = [0, 1].map(k => { const y = mot.y + 95 + k * 120; const f = new PIXI.Sprite(ArenaPixi.texFx("fire_01")); f.anchor.set(0.5); f.x = mot.x + 12; f.y = y; f.width = f.height = 70; f.tint = 0xff922b; f.blendMode = PIXI.BLEND_MODES.ADD; f.rotation = Math.PI / 2; this.cosas.addChild(f); return { f, l: L(mot.x + 20, y, 170, 0xff922b, 0.9) }; });
    const elec = NV.SALAS.find(z => z.id === "elec"); this.luzElec = L(elec.x + elec.w / 2, elec.y + 80, 160, 0xffd43b, 0.6);
    // Botón de emergencia
    this.boton = this.cosas.addChild(new PIXI.Graphics()); this.luzBoton = L(NV.BOTON.x, NV.BOTON.y, 140, 0xff4d63, 0.9);
    // Estaciones de tarea
    this.est = NV.ESTACIONES.map(e => {
      const g = new PIXI.Graphics(); g.beginFill(0x2b2f45); g.drawRoundedRect(-22, -22, 44, 44, 6); g.endFill(); g.x = e.x; g.y = e.y;
      const borde = new PIXI.Graphics(); borde.x = e.x; borde.y = e.y;
      const ic = new PIXI.Text(NV.ICONO[e.tipo], { fontSize: 24, fontFamily: FE }); ic.anchor.set(0.5); ic.x = e.x; ic.y = e.y + 1;
      const halo = new PIXI.Sprite(ArenaPixi.texFx("light_01")); halo.anchor.set(0.5); halo.x = e.x; halo.y = e.y; halo.width = halo.height = 110; halo.tint = 0xffd43b; halo.blendMode = PIXI.BLEND_MODES.ADD;
      this.cosas.addChild(halo, g, borde, ic);
      return { e, borde, halo, luz: L(e.x, e.y, 90, 0xffd43b, 0) };
    });
    this.cuerposC = this.cosas.addChild(new PIXI.Container());
  },
  personaje(j) {
    let p = this.pj[j.id]; if (p) return p;
    const cont = new PIXI.Container(), som = new PIXI.Graphics(); som.beginFill(0x000000, 0.35); som.drawEllipse(0, 18, 20, 7); som.endFill();
    const b = new PIXI.Sprite(PIXI.Texture.from(Nave.sprite(j.look, "civ"))); b.anchor.set(0.5, 0.68); b.width = 60; b.height = 67;
    const nom = new PIXI.Text(j.name, { fontFamily: "Figtree, system-ui, sans-serif", fontSize: 14, fontWeight: "800", fill: "#ffffff", stroke: "#000000", strokeThickness: 3 }); nom.anchor.set(0.5, 1); nom.y = -50;
    cont.addChild(som, b, nom); this.ents.addChild(cont);
    return (this.pj[j.id] = { cont, b, nom, som });
  },
  emitir(p) { this.fxp.push({ t0: performance.now(), vx: 0, vy: 0, rot: Math.random() * 6.28, vrot: 0, tam: 14, crece: 1.5, alfa: 0.5, ...p }); if (this.fxp.length > 160) this.fxp.shift(); },

  dibujar(now) {
    const v = Nave.v, n = UI.nave, app = this.app; if (!app || !v || !n) return;
    const cv = app.view, W = cv.clientWidth, H = cv.clientHeight, t = now / 1000;
    if (app.renderer.width !== Math.round(W * this.dpr) || app.renderer.height !== Math.round(H * this.dpr)) app.renderer.resize(W, H);
    const esc = Math.max(W, H) / 900;
    // Cielo con dos capas de estrellas (la de adelante se mueve más)
    this.est1.width = this.est2.width = W; this.est1.height = this.est2.height = H;
    this.est1.tilePosition.set(-n.x * 0.08 - t * 4, -n.y * 0.08); this.est2.tilePosition.set(-n.x * 0.2 - t * 8, -n.y * 0.2);
    this.neb.width = W * 1.6; this.neb.height = H * 1.6; this.neb.x = -W * 0.3 - n.x * 0.05; this.neb.y = -H * 0.3 - n.y * 0.05;
    for (const C of [this.mundo, this.luces]) { C.scale.set(esc); C.x = W / 2 - n.x * esc; C.y = H / 2 - n.y * esc; }
    // Animaciones fijas: botón, motores y una luz de electricidad que titila
    const b = this.boton; b.clear(); b.beginFill(0x555555); b.drawCircle(NV.BOTON.x, NV.BOTON.y, 30); b.endFill(); b.beginFill(0xe03131); b.drawCircle(NV.BOTON.x, NV.BOTON.y, 20 + Math.sin(t * 3) * 2); b.endFill(); b.beginFill(0xff8787); b.drawCircle(NV.BOTON.x - 6, NV.BOTON.y - 6, 6); b.endFill();
    this.luzBoton.alpha = 0.6 + Math.sin(t * 3) * 0.3;
    this.motores.forEach(({ f, l }, k) => { f.scale.y = f.scale.x * (0.85 + Math.sin(t * 16 + k) * 0.15); l.alpha = 0.75 + Math.sin(t * 9 + k) * 0.15; if (Math.random() < 0.3) this.emitir({ x: f.x - 10, y: f.y + (Math.random() - 0.5) * 16, vx: -60 - Math.random() * 60, vy: (Math.random() - 0.5) * 20, tex: "smoke_03", color: 0xff922b, vida: 600, tam: 22, add: true, alfa: 0.4 }); });
    this.luzElec.alpha = Math.random() < 0.04 ? 0.15 : 0.6;
    // Estaciones (las mías brillan)
    const mias = new Set(!v.yo.imp ? v.yo.tareas.filter(x => !x.hecha).map(x => x.st) : []);
    this.est.forEach(({ e, borde, halo, luz }) => { const mia = mias.has(e.id); borde.clear(); borde.lineStyle(3, mia ? 0xffd43b : 0x6b7394); borde.drawRoundedRect(-22, -22, 44, 44, 6); halo.visible = mia; halo.alpha = 0.35 + Math.sin(t * 4) * 0.2; luz.alpha = mia ? 0.7 : 0; });
    // Cuerpos
    const cc = this.cuerposC, claves = v.cuerpos.map(c => c.name + ":" + c.x + ":" + c.y).join("|");
    if (cc.clave !== claves) {
      cc.clave = claves; cc.removeChildren().forEach(o => o.destroy());
      v.cuerpos.forEach(c => { const s = new PIXI.Sprite(PIXI.Texture.from(Nave.sprite(c.look, "muerto"))); s.anchor.set(0.5); s.width = 60; s.height = 67; s.x = c.x; s.y = c.y; s.rotation = Math.PI / 2; const tx = new PIXI.Text("🦴 " + c.name, { fontFamily: "Figtree, system-ui, sans-serif", fontSize: 13, fontWeight: "800", fill: "#ff4d63", stroke: "#000", strokeThickness: 3 }); tx.anchor.set(0.5); tx.x = c.x; tx.y = c.y - 42; cc.addChild(s, tx); for (let i = 0; i < 6; i++) this.emitir({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, tex: "smoke_07", color: 0x9775fa, vida: 1200, tam: 40, crece: 2, alfa: 0.4 }); });
    }
    // Personajes (los de afuera de la visión no se ven; los fantasmas solo para otros fantasmas)
    const vision = !v.yo.vivo ? 9999 : v.yo.imp ? NV.VISION_IMP : NV.VISION, vistos = new Set();
    v.jug.forEach(j => {
      const o = n.otros[j.id] = n.otros[j.id] || { x: j.x, y: j.y }, yo = j.id === v.me;
      if (yo) { o.x = n.x; o.y = n.y; } else { o.x += (j.x - o.x) * 0.25; o.y += (j.y - o.y) * 0.25; }
      const P = this.personaje(j); vistos.add(j.id);
      const visible = !((!j.vivo && v.yo.vivo && !yo) || (!yo && Math.hypot(o.x - n.x, o.y - n.y) > vision + 30));
      P.cont.visible = visible; if (!visible) return;
      const anda = yo ? n.anda : Math.hypot(j.x - o.x, j.y - o.y) > 2;
      P.cont.x = o.x; P.cont.y = o.y; P.cont.zIndex = o.y; P.cont.alpha = j.vivo ? 1 : 0.45;
      P.b.y = -(anda ? Math.abs(Math.sin(t * 10)) * 4 : 0); P.b.scale.x = Math.abs(P.b.scale.x) * ((yo ? n.dir : j.dir) < 0 ? -1 : 1); P.b.rotation = anda ? Math.sin(t * 10) * 0.05 : 0;
      P.nom.style.fill = v.socios.includes(j.id) || (yo && v.yo.imp) ? "#ff4d63" : "#ffffff"; P.som.visible = j.vivo;
      if (anda && j.vivo && Math.random() < 0.15) this.emitir({ x: o.x + (Math.random() - 0.5) * 14, y: o.y + 16, vx: (Math.random() - 0.5) * 20, vy: -8, tex: "smoke_03", color: 0xadb5bd, vida: 500, tam: 12, alfa: 0.35 });
    });
    Object.keys(this.pj).forEach(id => { if (!vistos.has(id)) { this.pj[id].cont.destroy({ children: true }); delete this.pj[id]; } });
    // Partículas
    this.fxp = this.fxp.filter(p => now - p.t0 < p.vida);
    while (this.pool.length < this.fxp.length) { const s = new PIXI.Sprite(PIXI.Texture.WHITE); s.anchor.set(0.5); this.part.addChild(s); this.pool.push(s); }
    let i = 0;
    for (const p of this.fxp) { const s = this.pool[i++], k = (now - p.t0) / 1000, f = (now - p.t0) / p.vida, tam = p.tam * (1 + (p.crece - 1) * f); s.visible = true; s.texture = ArenaPixi.texFx(p.tex); s.tint = p.color; s.blendMode = p.add ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL; s.alpha = Math.max(0, p.alfa * (1 - f)); s.width = s.height = tam; s.rotation = p.rot + p.vrot * k; s.x = p.x + p.vx * k; s.y = p.y + p.vy * k; }
    for (; i < this.pool.length; i++) this.pool[i].visible = false;
    // Luz y visión
    if (this.rt.width !== Math.ceil(W) || this.rt.height !== Math.ceil(H)) this.rt.resize(Math.ceil(W), Math.ceil(H));
    this.ambiente.width = W; this.ambiente.height = H;
    app.renderer.render(this.luzCapa, { renderTexture: this.rt, clear: true });
    this.vision.visible = !!v.yo.vivo;
    if (v.yo.vivo) { const r = vision * esc; this.vision.width = this.vision.height = r * 2; this.vision.x = W / 2 - r; this.vision.y = H / 2 - r; }
    // Fuera del círculo de visión, todo negro (la textura cubre solo el círculo; el resto se tapa con 4 franjas)
    this.franjas(W, H, v.yo.vivo ? vision * esc : 0);
    app.renderer.render(app.stage);
    Nave.minimapa(v, n, mias);
  },
  franjas(W, H, r) {
    if (!this.tapa) { this.tapa = this.app.stage.addChild(new PIXI.Graphics()); }
    const g = this.tapa; g.clear(); if (!r) return;
    const x0 = W / 2 - r, y0 = H / 2 - r, x1 = W / 2 + r, y1 = H / 2 + r, c = 0x030208, a = 0.93;
    g.beginFill(c, a); if (y0 > 0) g.drawRect(0, 0, W, y0); if (y1 < H) g.drawRect(0, y1, W, H - y1); if (x0 > 0) g.drawRect(0, Math.max(0, y0), x0, Math.min(H, y1) - Math.max(0, y0)); if (x1 < W) g.drawRect(x1, Math.max(0, y0), W - x1, Math.min(H, y1) - Math.max(0, y0)); g.endFill();
  }
};
