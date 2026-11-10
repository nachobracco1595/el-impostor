/* Dibujo de la Arena y la Torre con PixiJS (WebGL): escenarios con textura, antorchas y luces,
   partículas por la placa de video, auras de las evoluciones y festejos.
   La pelea se calcula igual que siempre (arena.js); esto solo cambia cómo se ve.
   Los personajes usan su mismo dibujo y equipo (se pintan en un lienzo propio y se suben como textura).
   Si el teléfono no tiene WebGL o PixiJS no carga, se usa el dibujo de siempre. */
const ArenaPixi = {
  listo: false, cargando: null, activo: false,
  /* PixiJS se baja recién cuando hace falta (pesa ~450 KB). Se lee con fetch para poder mostrar el avance;
     el service worker lo guarda y las próximas veces sale de la caché del teléfono al instante. */
  TAM_PIXI: 456133,
  avance: 0, oyentes: [], pPixi: 0, pImg: 0,
  /* El avance suma las dos partes: PixiJS (70%) y las imágenes (30%) */
  avisar(pixi, img) {
    if (pixi != null) this.pPixi = Math.max(this.pPixi, pixi); if (img != null) this.pImg = Math.max(this.pImg, img);
    this.avance = 0.7 * this.pPixi + 0.3 * this.pImg;
    this.oyentes.forEach(f => { try { f(this.avance); } catch {} });
  },
  cargar() {
    if (this.cargando) return this.cargando;
    this.cargando = (async () => {
      if (window.PIXI) { this.listo = this.soporta(); this.avisar(1); return this.listo; }
      let ok = false;
      try {
        const r = await fetch("js/vendor/pixi.min.js");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const total = +r.headers.get("content-length") || this.TAM_PIXI, lector = r.body && r.body.getReader ? r.body.getReader() : null;
        let texto;
        if (lector) {
          const partes = []; let n = 0;
          for (;;) { const { done, value } = await lector.read(); if (done) break; partes.push(value); n += value.length; this.avisar(Math.min(0.99, n / Math.max(total, n))); }
          texto = new TextDecoder().decode(await new Blob(partes).arrayBuffer());
        } else texto = await r.text();
        await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = URL.createObjectURL(new Blob([texto], { type: "text/javascript" })); sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
        ok = !!window.PIXI;
      } catch (e) {
        // Si fetch no anda (navegador viejo), se carga como siempre
        ok = await new Promise(res => { const sc = document.createElement("script"); sc.src = "js/vendor/pixi.min.js"; sc.onload = () => res(!!window.PIXI); sc.onerror = () => res(false); document.head.appendChild(sc); });
      }
      this.avisar(1);
      this.listo = ok && this.soporta();
      return this.listo;
    })();
    return this.cargando;
  },
  /* El arte (partículas y monstruos) también se baja antes, así no aparecen cuadrados vacíos */
  IMAGENES() { return [...ArenaFX.TEX.map(k => `img/arena/fx/${k}.png`), ...["esqueleto", "goblin", "zombi", "lobo", "bruja", "orco", "golem", "vampiro", "demonio", "jefe1", "jefe2", "jefe3", "jefe4", "jefe5"].map(k => `img/arena/mon/${k}.png`)]; },
  cargarImagenes() {
    if (this.imgs) return this.imgs;
    const lista = this.IMAGENES(); let n = 0;
    ArenaFX.cargar();
    return (this.imgs = Promise.all(lista.map(src => new Promise(res => { const im = new Image(); im.onload = im.onerror = () => { n++; this.avisar(null, n / lista.length); res(); }; im.src = src; }))).then(() => { this.imgsListas = true; }));
  },
  quiere() { return store.get("arenaPixi", true) !== false && !this.fallo; },
  /* Pantalla de carga: "Descargando recursos…" con barra; cuando termina (o si tarda demasiado) sigue la pelea */
  preparar(seguir) {
    if (!this.quiere() || (this.listo && this.imgsListas)) return seguir();
    const capa = document.createElement("div"); capa.className = "carga-recursos";
    capa.innerHTML = `<div class="cr-caja"><div class="cr-ic">⚔️</div><b>Descargando recursos…</b><div class="cr-barra"><i></i></div><small class="cr-pct">0%</small>
      <p>Gráficos de la Arena, la Torre, la Carrera y La Nave. Es solo la primera vez: después quedan guardados en el teléfono.</p>
      <button class="linkish" hidden>Seguir sin gráficos mejorados</button></div>`;
    document.body.appendChild(capa);
    const barra = capa.querySelector(".cr-barra i"), pct = capa.querySelector(".cr-pct"), saltar = capa.querySelector("button");
    let listo = false;
    const fin = () => { if (listo) return; listo = true; this.oyentes = this.oyentes.filter(f => f !== mostrar); capa.classList.add("sale"); setTimeout(() => capa.remove(), 250); seguir(); };
    const mostrar = x => { barra.style.width = Math.round(x * 100) + "%"; pct.textContent = Math.round(x * 100) + "%"; };
    this.oyentes.push(mostrar); mostrar(this.avance);
    setTimeout(() => { saltar.hidden = false; }, 6000);
    saltar.onclick = () => { this.fallo = true; fin(); };
    Promise.all([this.cargar(), this.cargarImagenes()]).then(([ok]) => { this.imgsListas = true; if (!ok) this.fallo = true; mostrar(1); setTimeout(fin, 250); });
    setTimeout(() => { if (!listo) { saltar.hidden = false; } }, 20000);
  },
  soporta() { try { return !!(window.PIXI && PIXI.utils.isWebGLSupported()) && store.get("arenaPixi", true) !== false; } catch { return false; } },

  /* ---------- Calidad ---------- */
  /* "alta" (por defecto) o "baja" (menos partículas, sin temblor ni pausa de golpe). Se elige en la Armería;
     si el teléfono no llega (más de 24 ms por cuadro durante ~3 s seguidos) baja sola hasta que se cierre la app. */
  baja() { return !!(this.autoBaja || this.calBaja); },
  get calidad() { return this.baja() ? "baja" : "alta"; },
  medir(now, v) {
    const d = now - (this.tMed || now); this.tMed = now;
    if (this.autoBaja || this.calBaja || this.sinAuto || document.hidden || v.fase !== "pelea" || d <= 0 || d > 250) return;
    this.ema = this.ema ? this.ema * 0.92 + d * 0.08 : d;
    this.lentoMs = this.ema > 24 ? (this.lentoMs || 0) + d : 0;
    if (this.lentoMs > 3500) { this.autoBaja = true; console.info("Arena: paso a calidad baja (" + this.ema.toFixed(1) + " ms por cuadro)"); }
  },

  /* ---------- Armar la escena ---------- */
  /* Una sola Application (un solo contexto WebGL) para todas las peleas: en iPhone crear uno por pelea
     va llenando la memoria de video hasta que la app se tilda. Entre peleas solo se vacía la escena. */
  montar(cv) {
    if (!this.listo) return false;
    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let app = this.app;
      if (app && (!app.renderer || app.renderer.gl.isContextLost())) { this.desmontar(true); app = null; }
      if (app) { const vw = app.view; vw.id = cv.id; vw.className = cv.className; cv.replaceWith(vw); cv = vw; }
      else {
        app = new PIXI.Application({ view: cv, width: cv.clientWidth || 390, height: cv.clientHeight || 700, resolution: dpr, autoDensity: false, antialias: true, backgroundColor: 0x08070d, powerPreference: "high-performance", eventFeatures: { move: false, globalMove: false, click: false, wheel: false } });
        app.ticker.stop();
        // Los toques los maneja la arena: sin esto PixiJS deja un requestAnimationFrame andando para siempre
        try { app.renderer.events.setTargetElement(null); } catch {}
        // Si iOS se lleva el contexto (segundo plano, poca memoria) PixiJS intenta recuperarlo; si no vuelve, Arena.loop arma otro lienzo
        cv.addEventListener("webglcontextlost", () => { this.perdido = this.perdido || performance.now(); });
        cv.addEventListener("webglcontextrestored", () => { this.perdido = 0; });
        this.perdido = 0;
      }
      cv.style.width = "100%"; cv.style.height = "100%";
      const C = (padre = app.stage) => padre.addChild(new PIXI.Container());
      this.app = app; this.dpr = dpr;
      this.calBaja = store.get("arenaCalidad", "alta") === "baja"; this.tMed = 0; this.ema = 0; this.lentoMs = 0;
      this.trauma = 0; this.alto = 0; this.ultHit = undefined; this.jefeVisto = null; this.rojoPulso = -1e9;
      this.mundo = C(); this.luzCapa = new PIXI.Container(); this.brillo = C(); this.pantalla = C();
      this.cielo = C(this.mundo);                                      // estrellas y nebulosa de la nave (con paralaje)
      this.fondo = C(this.mundo);
      this.publico = C(this.mundo);
      this.suelo = this.mundo.addChild(new PIXI.Graphics());          // rayos, aros, línea de puntería
      this.cosas = C(this.mundo);                                      // pociones y fuegos de antorchas
      this.ents = C(this.mundo); this.ents.sortableChildren = true;
      this.gfx = this.mundo.addChild(new PIXI.Graphics());            // flechas
      this.part = C(this.mundo);
      // Brillos: van después de la luz, así no los oscurece la sombra del escenario (fuego, tajos, chispas, brasas)
      this.ambCapa = C(this.brillo); this.fxCapa = C(this.brillo);
      this.gfxB = this.brillo.addChild(new PIXI.Graphics());          // ondas y rayos
      this.partB = C(this.brillo); this.flashCapa = C(this.brillo);
      // Luz: se dibuja en una textura y se multiplica sobre la escena (lo que no está iluminado queda oscuro)
      this.ambiente = this.luzCapa.addChild(new PIXI.Sprite(PIXI.Texture.WHITE));
      this.luces = this.luzCapa.addChild(new PIXI.Container());
      this.rt = PIXI.RenderTexture.create({ width: 64, height: 64, resolution: 0.5 });
      this.luz = app.stage.addChildAt(new PIXI.Sprite(this.rt), 1); this.luz.blendMode = PIXI.BLEND_MODES.MULTIPLY;
      this.vineta = this.pantalla.addChild(new PIXI.Sprite(this.texVineta()));
      // Carteles en la pantalla (no se achican con la cámara): nombre, vida y números de daño
      this.tags = C(this.pantalla);
      this.barras = this.tags.addChild(new PIXI.Graphics()); this.nombres = C(this.tags); this.tagFx = C(this.tags); this.nums = C(this.tags);
      this.rojo = this.pantalla.addChild(new PIXI.Sprite(PIXI.Texture.WHITE)); this.rojo.tint = 0xff0028; this.rojo.alpha = 0;
      this.flechas = this.pantalla.addChild(new PIXI.Graphics());
      this.flechasTx = C(this.pantalla);
      this.pool = { part: [], b: [], fx: [], tag: [], num: [], ico: [], tx: {} };
      this.entidad = {}; this.esc = null; this.luzMap = {}; this.potis = {}; this.destellos = []; this.amb = []; this.flashes = []; this.focosMov = []; this.errores = 0; this.activo = true;
      return true;
    } catch (e) { console.warn("PixiJS no arrancó, uso el dibujo de siempre", e); this.desmontar(true); return false; }
  },
  /* Vacía la escena de la pelea. Con todo = true también suelta el contexto WebGL (se perdió o PixiJS falló) */
  desmontar(todo) {
    this.activo = false;
    // Lienzos de los personajes: se achican a 0 para que iOS libere su memoria enseguida
    Object.values(this.entidad || {}).forEach(e => this.soltarEnt(e));
    this.entidad = {}; this.esc = null; this.potis = {}; this.luzMap = {}; this.destellos = []; this.pool = { part: [], b: [], fx: [], tag: [], num: [], ico: [], tx: {} }; this.gente = []; this.llamas = []; this.lava = []; this.amb = []; this.flashes = []; this.focosMov = [];
    // Los textos (daño, pociones, íconos) tienen su propio lienzo y se destruyen con la escena; las texturas compartidas quedan
    try { if (this.app && this.app.stage) this.app.stage.removeChildren().forEach(c => c.destroy({ children: true })); } catch {}
    try { if (this.rt) this.rt.destroy(true); } catch {}
    this.rt = null;
    if (todo) {
      try { if (this.app) this.app.destroy(false, { children: true, texture: false, baseTexture: false }); } catch {}
      this.app = null; this.perdido = 0;
    }
  },
  soltarEnt(e) { try { if (e.s && e.s.parent) e.s.parent.removeChild(e.s); if (e.nom) { e.nom.destroy(true); e.nom = null; } e.tex.destroy(true); e.c.width = e.c.height = 0; } catch {} },
  /* El contexto WebGL se perdió y no volvió (pasa en iPhone al volver del segundo plano) */
  caido() { const a = this.app; if (!this.activo || !a || !a.renderer) return false; if (!a.renderer.gl.isContextLost()) { this.perdido = 0; return false; } this.perdido = this.perdido || performance.now(); return !document.hidden && performance.now() - this.perdido > 1500; },

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
    if (this.tVin) return this.tVin;
    const c = this.lienzo(256, 256), x = c.getContext("2d"), g = x.createRadialGradient(128, 128, 70, 128, 128, 182);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)"); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return (this.tVin = PIXI.Texture.from(c));
  },
  /* Texturas de efectos pintadas en el momento: anillo, chispa alargada, tajo en media luna, bola, estela */
  PROC: { anillo: 1, chispa: 1, arco: 1, bola: 1, estela: 1 },
  texProc(k) {
    this.cacheP = this.cacheP || {}; if (this.cacheP[k]) return this.cacheP[k];
    let c, x, g;
    if (k === "anillo") { c = this.lienzo(128, 128); x = c.getContext("2d"); g = x.createRadialGradient(64, 64, 34, 64, 64, 63); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.6, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    else if (k === "chispa") { c = this.lienzo(16, 64); x = c.getContext("2d"); x.scale(1, 4); g = x.createRadialGradient(8, 8, 0, 8, 8, 8); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.8)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 16, 16); }
    else if (k === "bola") { c = this.lienzo(64, 64); x = c.getContext("2d"); g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,.95)"); g.addColorStop(0.55, "rgba(255,255,255,.4)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
    else if (k === "estela") {
      c = this.lienzo(128, 16); x = c.getContext("2d"); g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,1)"); x.fillStyle = g; x.fillRect(0, 0, 128, 16);
      x.globalCompositeOperation = "destination-in"; g = x.createLinearGradient(0, 0, 0, 16); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 16);
    } else {
      // Tajo: media luna que se aclara hacia la punta (la punta va adelante cuando gira)
      c = this.lienzo(256, 256); x = c.getContext("2d"); const N = 48, ab = 1.15;
      for (let i = 0; i < N; i++) {
        const a0 = -ab + 2 * ab * i / N, q = (i + 0.5) / N, al = Math.pow(q, 1.6) * (q > 0.92 ? (1 - q) / 0.08 * 0.6 + 0.4 : 1);
        g = x.createRadialGradient(128, 128, 56, 128, 128, 114); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.72, `rgba(255,255,255,${al * 0.45})`); g.addColorStop(0.93, `rgba(255,255,255,${al})`); g.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = g; x.beginPath(); x.moveTo(128, 128); x.arc(128, 128, 116, a0, a0 + 2 * ab / N + 0.012); x.closePath(); x.fill();
      }
    }
    return (this.cacheP[k] = PIXI.Texture.from(c));
  },
  texFx(k) { if (this.PROC[k]) return this.texProc(k); this.cacheF = this.cacheF || {}; return this.cacheF[k] || (this.cacheF[k] = PIXI.Texture.from(`img/arena/fx/${k}.png`)); },
  /* Emoji en una textura (los íconos de los números: 💥 👻 🌵) */
  texEmoji(e) {
    this.cacheE = this.cacheE || {}; if (this.cacheE[e]) return this.cacheE[e];
    const n = [...e].filter(ch => ch.codePointAt(0) > 0x2000 && ch !== "️").length || 1, c = this.lienzo(56 * n, 56), x = c.getContext("2d");
    x.font = `44px ${FE}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(e, 28 * n, 30);
    return (this.cacheE[e] = PIXI.Texture.from(c));
  },
  /* Números de daño: una fuente de mapa de bits (una sola textura, sin un lienzo nuevo por golpe) */
  fuenteNum() {
    if (this.fNum !== undefined) return this.fNum;
    try { PIXI.BitmapFont.from("arNum", { fontFamily: "Figtree, system-ui, sans-serif", fontSize: 44, fontWeight: "900", fill: "#ffffff", stroke: "#1a0f14", strokeThickness: 8, lineJoin: "round" }, { chars: "0123456789+-", resolution: 1, padding: 4 }); this.fNum = true; }
    catch (e) { this.fNum = false; }
    return this.fNum;
  },
  estiloNom() { return this.tNom || (this.tNom = new PIXI.TextStyle({ fontFamily: "Figtree, system-ui, sans-serif", fontSize: 12, fontWeight: "800", fill: "#ffffff", stroke: "#0b0912", strokeThickness: 3.5, lineJoin: "round" })); },
  color(c) {
    if (typeof c !== "string") return { c: 0xffffff, a: 1 };
    const M = this.colMemo || (this.colMemo = {}); if (M[c]) return M[c];
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) { const p = m[1].split(",").map(Number); return (M[c] = { c: (p[0] << 16) | (p[1] << 8) | p[2], a: p.length > 3 ? p[3] : 1 }); }
    return (M[c] = { c: parseInt(c.replace("#", "").padEnd(6, "0").slice(0, 6), 16), a: 1 });
  },
  mezcla(a, b, k) { const r = (a >> 16) + (((b >> 16) - (a >> 16)) * k), g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * k), bl = (a & 255) + (((b & 255) - (a & 255)) * k); return (r << 16) | (g << 8) | bl; },

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
    // Grano fino (como una foto) y sombra de contacto en los bordes del piso: se pinta una vez, no cuesta nada por cuadro
    const grano = (x0, y0, w, h) => { for (let i = 0; i < w * h / 160; i++) { x.fillStyle = r() < 0.5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.08)"; x.fillRect(x0 + r() * w, y0 + r() * h, 1.6, 1.6); } };
    const bordeRect = (l, ancho, a) => { [[l.x, l.y, l.w, ancho, 0, 1], [l.x, l.y + l.h - ancho, l.w, ancho, 0, -1], [l.x, l.y, ancho, l.h, 1, 0], [l.x + l.w - ancho, l.y, ancho, l.h, -1, 0]].forEach(([bx, by, bw, bh, dx, dy]) => { const x0 = dx < 0 ? bx + bw : bx, y0 = dy < 0 ? by + bh : by, g = x.createLinearGradient(x0, y0, x0 + dx * ancho, y0 + dy * ancho); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(bx, by, bw, bh); }); };
    const luzCentro = (cx, cy, rad, col) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); x.save(); x.globalCompositeOperation = "lighter"; x.fillStyle = g; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); x.restore(); };
    const fondo = { ring: "#110f1f", coliseo: "#21170d", volcan: "#160705", nave: null }[esc];
    if (fondo) { x.fillStyle = fondo; x.fillRect(this.X0, this.Y0, this.WF, this.HF); }
    if (esc === "ring") {
      const l = E.lim;
      // Tribunas a los costados
      for (let fila = 0; fila < 6; fila++) { x.fillStyle = fila % 2 ? "#1d1a33" : "#191630"; x.fillRect(l.x - 260 + fila * 0, l.y - 250 + fila * 30 - 30, l.w + 520, 26); }
      x.fillStyle = "#1a1730"; x.fillRect(l.x - 70, l.y - 70, l.w + 140, l.h + 140);
      // Lona del ring: tela con trama y luz en el centro
      const g = x.createRadialGradient(700, 500, 60, 700, 500, 640); g.addColorStop(0, "#5a6bd0"); g.addColorStop(1, "#253064");
      x.fillStyle = g; x.fillRect(l.x, l.y, l.w, l.h);
      x.globalAlpha = 0.08; x.strokeStyle = "#fff"; x.lineWidth = 1; for (let k = l.x; k < l.x + l.w; k += 6) { x.beginPath(); x.moveTo(k, l.y); x.lineTo(k, l.y + l.h); x.stroke(); } for (let k = l.y; k < l.y + l.h; k += 6) { x.beginPath(); x.moveTo(l.x, k); x.lineTo(l.x + l.w, k); x.stroke(); } x.globalAlpha = 1;
      ruido(l.x, l.y, l.w, l.h, 900, "#0d1240", 9, 0.12); grano(l.x, l.y, l.w, l.h);
      x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = 7; x.beginPath(); x.arc(700, 500, 130, 0, 7); x.stroke();
      x.fillStyle = "rgba(255,255,255,.06)"; x.font = "bold 110px 'Dela Gothic One', Figtree, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("MESA LOCA", 700, 500);
      // Esquinas del color de cada rincón
      [[l.x, l.y, "#ff4d63"], [l.x + l.w, l.y + l.h, "#4dabf7"]].forEach(([cx, cy, col]) => { const gg = x.createRadialGradient(cx, cy, 0, cx, cy, 200); gg.addColorStop(0, col + "33"); gg.addColorStop(1, col + "00"); x.fillStyle = gg; x.fillRect(l.x, l.y, l.w, l.h); });
      bordeRect(l, 70, 0.45); luzCentro(700, 500, 420, "rgba(255,245,225,.07)");
      // Esquineros con almohadón
      E.obst.forEach(o => { x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.ellipse(o.x, o.y + 12, o.r * 1.1, o.r * 0.45, 0, 0, 7); x.fill(); const gg = x.createRadialGradient(o.x - 6, o.y - 8, 2, o.x, o.y, o.r); gg.addColorStop(0, "#ffffff"); gg.addColorStop(1, "#9aa0c0"); x.fillStyle = gg; x.beginPath(); x.arc(o.x, o.y, o.r, 0, 7); x.fill(); x.fillStyle = "#ff4d63"; x.beginPath(); x.arc(o.x, o.y - 4, o.r * 0.7, 0, 7); x.fill(); });
      [0, 10, 20].forEach((o, i) => { x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 6; x.strokeRect(l.x - o + 3, l.y - o + 5, l.w + o * 2, l.h + o * 2); x.strokeStyle = ["#ff4d63", "#ffffff", "#4dabf7"][i]; x.lineWidth = 5; x.strokeRect(l.x - o, l.y - o, l.w + o * 2, l.h + o * 2); x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1.5; x.strokeRect(l.x - o - 1, l.y - o - 1, l.w + o * 2 + 2, l.h + o * 2 + 2); });
    } else if (esc === "coliseo") {
      const c0 = E.circ;
      // Gradas de piedra en anillos
      for (let k = 9; k >= 0; k--) { x.fillStyle = k % 2 ? "#4a3a28" : "#3d3020"; x.beginPath(); x.arc(c0.x, c0.y, c0.r + 60 + k * 34, 0, 7); x.fill(); }
      // Muro con ladrillos
      x.fillStyle = "#6b5232"; x.beginPath(); x.arc(c0.x, c0.y, c0.r + 44, 0, 7); x.fill();
      for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; x.strokeStyle = "rgba(40,28,14,.6)"; x.lineWidth = 2; x.beginPath(); x.moveTo(c0.x + Math.cos(a) * c0.r, c0.y + Math.sin(a) * c0.r); x.lineTo(c0.x + Math.cos(a) * (c0.r + 44), c0.y + Math.sin(a) * (c0.r + 44)); x.stroke(); }
      x.strokeStyle = "rgba(40,28,14,.6)"; x.lineWidth = 2; x.beginPath(); x.arc(c0.x, c0.y, c0.r + 22, 0, 7); x.stroke();
      // Arena con grano, manchas y huellas
      const g = x.createRadialGradient(c0.x, c0.y, 40, c0.x, c0.y, c0.r); g.addColorStop(0, "#ecd2a0"); g.addColorStop(1, "#b08a54");
      x.fillStyle = g; x.beginPath(); x.arc(c0.x, c0.y, c0.r, 0, 7); x.fill();
      x.save(); x.beginPath(); x.arc(c0.x, c0.y, c0.r, 0, 7); x.clip();
      ruido(c0.x - c0.r, c0.y - c0.r, c0.r * 2, c0.r * 2, 4000, "#8a6a3a", 2.2, 0.35);
      ruido(c0.x - c0.r, c0.y - c0.r, c0.r * 2, c0.r * 2, 1500, "#fff1cf", 1.6, 0.3);
      ruido(c0.x - c0.r, c0.y - c0.r, c0.r * 2, c0.r * 2, 60, "#7a5a2a", 26, 0.08);
      grano(c0.x - c0.r, c0.y - c0.r, c0.r * 2, c0.r * 2);
      for (let i = 0; i < 40; i++) { const hx = c0.x + (r() - 0.5) * c0.r * 1.6, hy = c0.y + (r() - 0.5) * c0.r * 1.6, a = r() * 7; x.fillStyle = "rgba(110,80,40,.18)"; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(hx + Math.cos(a) * k * 22 + (k % 2) * 8, hy + Math.sin(a) * k * 22, 5, 8, a, 0, 7); x.fill(); } }
      // Sombra del muro sobre la arena
      const gb = x.createRadialGradient(c0.x, c0.y, c0.r - 110, c0.x, c0.y, c0.r); gb.addColorStop(0, "rgba(40,20,0,0)"); gb.addColorStop(1, "rgba(40,20,0,.5)"); x.fillStyle = gb; x.fillRect(c0.x - c0.r, c0.y - c0.r, c0.r * 2, c0.r * 2);
      x.restore();
      luzCentro(c0.x, c0.y, 360, "rgba(255,230,180,.08)");
      x.strokeStyle = "rgba(90,60,20,.3)"; x.lineWidth = 4; x.beginPath(); x.arc(c0.x, c0.y, 120, 0, 7); x.stroke();
      // Columnas de mármol con brasero arriba
      E.obst.forEach(o => { x.fillStyle = "rgba(0,0,0,.4)"; x.beginPath(); x.ellipse(o.x + 6, o.y + 14, o.r * 1.2, o.r * 0.5, 0, 0, 7); x.fill(); const gg = x.createLinearGradient(o.x - o.r, 0, o.x + o.r, 0); gg.addColorStop(0, "#a89a78"); gg.addColorStop(0.45, "#f7efd9"); gg.addColorStop(1, "#8c7f60"); x.fillStyle = gg; x.beginPath(); x.arc(o.x, o.y, o.r, 0, 7); x.fill(); x.strokeStyle = "#6c604a"; x.lineWidth = 3; x.stroke(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; x.strokeStyle = "rgba(0,0,0,.12)"; x.beginPath(); x.moveTo(o.x + Math.cos(a) * o.r * 0.4, o.y + Math.sin(a) * o.r * 0.4); x.lineTo(o.x + Math.cos(a) * o.r, o.y + Math.sin(a) * o.r); x.stroke(); } x.fillStyle = "#3b2a1a"; x.beginPath(); x.arc(o.x, o.y, o.r * 0.5, 0, 7); x.fill(); x.fillStyle = "#1c120a"; x.beginPath(); x.arc(o.x, o.y, o.r * 0.36, 0, 7); x.fill(); });
    } else if (esc === "volcan") {
      const l = E.lim;
      x.fillStyle = "#2a1712"; x.fillRect(l.x - 60, l.y - 60, l.w + 120, l.h + 120);
      // Baldosas de basalto irregulares (con canto claro arriba)
      for (let gy = l.y; gy < l.y + l.h; gy += 70) for (let gx = l.x + ((gy / 70) % 2) * 35; gx < l.x + l.w; gx += 70) {
        const v = 30 + r() * 18, p = [gx + 3 + r() * 4, gy + 3, gx + 66 - r() * 4, gy + 2 + r() * 4, gx + 67, gy + 66 - r() * 4, gx + 2 + r() * 4, gy + 67];
        x.fillStyle = `rgb(${v + 14},${v - 2},${v - 8})`; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[2], p[3]); x.lineTo(p[4], p[5]); x.lineTo(p[6], p[7]); x.closePath(); x.fill();
        x.strokeStyle = "rgba(255,190,150,.07)"; x.lineWidth = 2; x.beginPath(); x.moveTo(p[6], p[7]); x.lineTo(p[0], p[1]); x.lineTo(p[2], p[3]); x.stroke();
      }
      ruido(l.x, l.y, l.w, l.h, 2500, "#000", 3, 0.25); ruido(l.x, l.y, l.w, l.h, 900, "#6b4a3a", 2, 0.25); grano(l.x, l.y, l.w, l.h);
      // Grietas con brillo de magma (el pulso lo da la luz de la lava)
      x.lineCap = "round"; Arena.decoracion("volcan").grietas.forEach(gr => { [[6, "rgba(255,80,0,.1)"], [1.8, "rgba(255,150,50,.32)"]].forEach(([a, col]) => { x.strokeStyle = col; x.lineWidth = a; x.beginPath(); gr.forEach(([px, py], k) => k ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke(); }); }); x.lineCap = "butt";
      bordeRect(l, 80, 0.5);
      x.strokeStyle = "#0b0505"; x.lineWidth = 22; x.strokeRect(l.x, l.y, l.w, l.h);
      // Rocas
      E.obst.forEach(o => { x.fillStyle = "rgba(0,0,0,.45)"; x.beginPath(); x.ellipse(o.x + 6, o.y + 14, o.r * 1.15, o.r * 0.5, 0, 0, 7); x.fill(); const gg = x.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.4, 4, o.x, o.y, o.r); gg.addColorStop(0, "#8a766e"); gg.addColorStop(1, "#2e2320"); x.fillStyle = gg; x.beginPath(); x.moveTo(o.x - o.r, o.y + 4); x.lineTo(o.x - o.r * 0.6, o.y - o.r * 0.8); x.lineTo(o.x + o.r * 0.3, o.y - o.r); x.lineTo(o.x + o.r, o.y - o.r * 0.2); x.lineTo(o.x + o.r * 0.8, o.y + o.r * 0.6); x.lineTo(o.x - o.r * 0.5, o.y + o.r * 0.7); x.fill(); x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 2; x.stroke(); });
      // Bordes de las lagunas de lava (piedra quemada con resplandor)
      E.lava.forEach(lv => { const gg = x.createRadialGradient(lv.x, lv.y, lv.r, lv.x, lv.y, lv.r + 70); gg.addColorStop(0, "rgba(255,90,0,.35)"); gg.addColorStop(1, "rgba(255,90,0,0)"); x.fillStyle = gg; x.beginPath(); x.arc(lv.x, lv.y, lv.r + 70, 0, 7); x.fill(); x.fillStyle = "#1a0603"; x.beginPath(); x.arc(lv.x, lv.y, lv.r + 16, 0, 7); x.fill(); });
    } else {
      const l = E.lim;
      x.fillStyle = "#151a33"; x.fillRect(l.x - 60, l.y - 60, l.w + 120, l.h + 120);
      // Placas de metal con remaches, rejillas y franjas de peligro
      for (let gx = l.x; gx < l.x + l.w; gx += 80) for (let gy = l.y; gy < l.y + l.h; gy += 80) {
        const g = x.createLinearGradient(gx, gy, gx + 80, gy + 80); g.addColorStop(0, "#3c476d"); g.addColorStop(1, "#252c48");
        x.fillStyle = g; x.fillRect(gx + 2, gy + 2, 76, 76); x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 1; x.strokeRect(gx + 3, gy + 3, 74, 74);
        x.fillStyle = "#59658f"; [[9, 9], [71, 9], [9, 71], [71, 71]].forEach(([a, b]) => { x.beginPath(); x.arc(gx + a, gy + b, 2.4, 0, 7); x.fill(); });
        if (r() < 0.12) { x.fillStyle = "#1a2038"; x.fillRect(gx + 16, gy + 16, 48, 48); x.strokeStyle = "#3d4770"; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(gx + 18, gy + 20 + k * 8); x.lineTo(gx + 62, gy + 20 + k * 8); x.stroke(); } }
        else if (r() < 0.06) { x.fillStyle = "rgba(102,217,232,.12)"; x.fillRect(gx + 30, gy + 30, 20, 20); x.fillStyle = "#66d9e8"; x.fillRect(gx + 37, gy + 37, 6, 6); }
      }
      ruido(l.x, l.y, l.w, l.h, 600, "#000", 4, 0.12); grano(l.x, l.y, l.w, l.h);
      bordeRect(l, 70, 0.4);
      x.save(); x.beginPath(); x.rect(l.x, l.y, l.w, 24); x.rect(l.x, l.y + l.h - 24, l.w, 24); x.clip(); for (let k = l.x - 40; k < l.x + l.w + 40; k += 40) { x.fillStyle = "#ffd43b"; x.beginPath(); x.moveTo(k, l.y); x.lineTo(k + 20, l.y); x.lineTo(k - 4, l.y + 24); x.lineTo(k - 24, l.y + 24); x.fill(); x.beginPath(); x.moveTo(k, l.y + l.h - 24); x.lineTo(k + 20, l.y + l.h - 24); x.lineTo(k - 4, l.y + l.h); x.lineTo(k - 24, l.y + l.h); x.fill(); } x.restore();
      x.strokeStyle = "#5a6aa8"; x.lineWidth = 10; x.strokeRect(l.x, l.y, l.w, l.h);
      x.strokeStyle = "rgba(116,192,252,.35)"; x.lineWidth = 2; x.strokeRect(l.x + 8, l.y + 8, l.w - 16, l.h - 16);
      // Cajas de carga
      E.cajas.forEach(cj => { x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(cj.x + 8, cj.y + 10, cj.w, cj.h); const g = x.createLinearGradient(cj.x, cj.y, cj.x + cj.w, cj.y + cj.h); g.addColorStop(0, "#8a96c8"); g.addColorStop(1, "#46507a"); x.fillStyle = g; x.fillRect(cj.x, cj.y, cj.w, cj.h); x.strokeStyle = "#2b3150"; x.lineWidth = 3; x.strokeRect(cj.x + 3, cj.y + 3, cj.w - 6, cj.h - 6); x.beginPath(); x.moveTo(cj.x + 6, cj.y + 6); x.lineTo(cj.x + cj.w - 6, cj.y + cj.h - 6); x.moveTo(cj.x + cj.w - 6, cj.y + 6); x.lineTo(cj.x + 6, cj.y + cj.h - 6); x.stroke(); x.fillStyle = "#ffd43b"; x.fillRect(cj.x + 6, cj.y + cj.h - 16, cj.w - 12, 8); x.fillStyle = "rgba(255,255,255,.18)"; x.fillRect(cj.x + 3, cj.y + 3, cj.w - 6, 3); });
    }
    // Postes de las antorchas (el fuego y la luz se animan aparte)
    this.focos(esc).forEach(([fx, fy, , , tipo]) => {
      if (tipo === "antorcha") { x.fillStyle = "rgba(0,0,0,.4)"; x.beginPath(); x.ellipse(fx + 4, fy + 16, 12, 5, 0, 0, 7); x.fill(); x.fillStyle = "#5c3b1e"; x.fillRect(fx - 4, fy - 6, 8, 22); x.fillStyle = "#3a3a42"; x.fillRect(fx - 8, fy - 12, 16, 8); }
      if (tipo === "lampara" && esc === "nave") { x.fillStyle = "#9fb4ff"; x.globalAlpha = 0.25; x.beginPath(); x.arc(fx, fy, 16, 0, 7); x.fill(); x.globalAlpha = 1; }
    });
    return PIXI.Texture.from(c);
  },
  /* Nebulosa del fondo de la nave (se ve alrededor del piso y se mueve más lento que la cámara) */
  texNebula() {
    if (this.tNeb) return this.tNeb;
    const c = this.lienzo(256, 256), x = c.getContext("2d"), r = azarDe("nebula");
    x.fillStyle = "#03050f"; x.fillRect(0, 0, 256, 256);
    x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 16; i++) { const cx = r() * 256, cy = r() * 256, rad = 30 + r() * 70, col = ["120,60,220", "40,90,220", "30,160,190", "200,60,160"][i % 4], g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, `rgba(${col},${0.12 + r() * 0.14})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
    for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`; x.fillRect(r() * 256, r() * 256, 0.8, 0.8); }
    return (this.tNeb = PIXI.Texture.from(c));
  },
  prepararEscenario(esc) {
    if (this.esc === esc) return;
    this.esc = esc;
    for (const C of [this.fondo, this.publico, this.cosas, this.luces, this.cielo, this.ambCapa, this.flashCapa]) C.removeChildren().forEach(c => c.destroy());
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
    // Nave: nebulosa y estrellas detrás del piso, con paralaje
    this.cielo.visible = esc === "nave";
    if (esc === "nave") {
      const neb = this.cielo.addChild(new PIXI.Sprite(this.texNebula())); neb.x = -900; neb.y = -800; neb.width = 3000; neb.height = 2500;
      D.estrellas.forEach(st => { const s = new PIXI.Sprite(this.texProc("bola")); s.anchor.set(0.5); s.x = st.x; s.y = st.y; s.width = s.height = st.s * 3; s.alpha = 0.6; this.cielo.addChild(s); this.gente.push({ s, st }); });
    }
    // Fuegos y luces de las antorchas
    this.llamas = [];
    this.focos(esc).forEach(([fx, fy, col, rad, tipo], i) => {
      const L = new PIXI.Sprite(this.texRadial("rgba(255,255,255,1)", "luz")); L.anchor.set(0.5); L.x = fx; L.y = fy; L.width = L.height = rad * 2; L.tint = col; L.alpha = tipo === "lava" ? 0.8 : tipo === "techo" ? 0.45 : 0.55; L.blendMode = PIXI.BLEND_MODES.ADD; this.luces.addChild(L);
      let fuego = null;
      if (tipo === "antorcha" || tipo === "brasero") { fuego = new PIXI.Sprite(this.texFx("fire_01") || PIXI.Texture.WHITE); fuego.anchor.set(0.5, 0.8); fuego.x = fx; fuego.y = fy - (tipo === "antorcha" ? 10 : 0); fuego.width = fuego.height = tipo === "brasero" ? 62 : 44; fuego.tint = 0xffa94d; fuego.blendMode = PIXI.BLEND_MODES.ADD; this.ambCapa.addChild(fuego); }
      this.llamas.push({ L, fuego, rad, i, tipo });
    });
    // Ring: dos reflectores que barren la lona y flashes de fotos en el público
    this.focosMov = esc === "ring" ? [0, 1].map(() => { const L = new PIXI.Sprite(this.texRadial("rgba(255,255,255,1)", "luz")); L.anchor.set(0.5); L.width = L.height = 460; L.tint = 0xfff4dc; L.alpha = 0.5; L.blendMode = PIXI.BLEND_MODES.ADD; this.luces.addChild(L); return L; }) : [];
    this.flashes = esc === "ring" ? Array.from({ length: 5 }, () => { const s = new PIXI.Sprite(this.texFx("star_06")); s.anchor.set(0.5); s.blendMode = PIXI.BLEND_MODES.ADD; s.visible = false; this.flashCapa.addChild(s); return { s, fin: 0 }; }) : [];
    // Partículas del ambiente: brasas (volcán), polvo dorado (coliseo), polvo en las luces (ring) y chispitas (nave)
    const A = { volcan: [42, [0xff8c42, 0xffd43b], 4, 7, 0.9], coliseo: [30, [0xffe2a8, 0xfff1d6], 2.5, 5, 0.3], ring: [22, [0xffffff, 0xdfe7ff], 2.5, 4, 0.18], nave: [26, [0x9fd0ff, 0xd0bfff], 2, 4, 0.35] }[esc], rr = azarDe("amb-" + esc);
    this.amb = Array.from({ length: A[0] }, (_, i) => {
      const s = new PIXI.Sprite(this.texProc("bola")); s.anchor.set(0.5); s.blendMode = PIXI.BLEND_MODES.ADD; s.tint = A[1][i % 2]; s.width = s.height = A[2] + rr() * (A[3] - A[2]); this.ambCapa.addChild(s);
      return { s, x: rr() * 1400, y: rr() * 1000, vx: esc === "volcan" ? (rr() - 0.5) * 16 : 6 + rr() * 14, vy: esc === "volcan" ? -25 - rr() * 50 : (rr() - 0.5) * 8, ph: rr() * 7, a: A[4] };
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
    if (e && e.k !== kk) { this.soltarEnt(e); e = null; }
    if (!e) {
      const c = this.lienzo(Math.round(this.ANCHO * kk), Math.round(this.ALTO * kk)), tex = PIXI.Texture.from(c);
      const s = new PIXI.Sprite(tex); s.anchor.set(this.OX / this.ANCHO, this.OY / this.ALTO); s.scale.set(1 / kk);
      this.ents.addChild(s); e = this.entidad[id] = { c, ctx: c.getContext("2d"), tex, s, k: kk, pintado: false };
    }
    return e;
  },
  /* Nombre y vida en la pantalla (tamaño fijo, se leen aunque la cámara se aleje) con barra fantasma y color por lado */
  etiqueta(e, j, o, esYo, vt, now) {
    if (!j.vivo || !j.name || ((vt < j.invis || vt < j.sombra) && !esYo)) { if (e.nom) e.nom.visible = false; return; }
    const S = this.tagEsc, es = this.escV, jefe = j.tam > 1 && j.equipo === "m";
    const alto = j.sprite ? (j.tam || 1) * 63 + 8 : 68 + ((j.tam || 1) - 1) * 60;
    const sx = this.mundo.x + o.x * es, sy = this.mundo.y + (o.y - alto) * es;
    if (!e.nom) { e.nom = new PIXI.Text("", this.estiloNom()); e.nom.anchor.set(0.5, 1); this.nombres.addChild(e.nom); }
    if (e.nN !== j.name || e.nL !== j.lv || e.nP !== j.pre || e.nI !== j.evoIc) { e.nN = j.name; e.nL = j.lv; e.nP = j.pre; e.nI = j.evoIc; e.nom.text = `${j.evoIc || AR.CLASES[j.clase].ic} ${j.name}${j.lv && !j.equipo ? ` · ${j.pre ? HE.PRESTIGIO[j.pre - 1].ic : ""}${j.lv}` : ""}`; }
    e.nom.visible = true; e.nom.x = sx; e.nom.y = sy - 1; e.nom.scale.set(S * (jefe ? 1.15 : 1));
    const p = Math.max(0, Math.min(1, j.hp / j.max)), w = (jefe ? 86 : 54) * S, h = (jefe ? 9 : 7) * S, bx = sx - w / 2, by = sy + 3 * S;
    const f = Arena.fantasmaDe(j.id, p, now), col = Arena.LADOS[Arena.lado(j)][1], g = this.barras;
    g.beginFill(0x0b0912, 0.85); g.drawRoundedRect(bx - 1.5, by - 1.5, w + 3, h + 3, (h + 3) / 2); g.endFill();
    if (f > p) { g.beginFill(0xfff1c1, 0.95); g.drawRoundedRect(bx, by, Math.max(h, w * f), h, h / 2); g.endFill(); }
    if (p > 0) {
      g.beginFill(col, 1); g.drawRoundedRect(bx, by, Math.max(h, w * p), h, h / 2); g.endFill();
      g.beginFill(0xffffff, p < 0.25 ? 0.25 + 0.25 * Math.sin(now / 80) : 0.3); g.drawRect(bx + h / 2, by + h * 0.18, Math.max(0, w * p - h), h * 0.28); g.endFill();
    }
  },

  /* ---------- Golpes que se sienten ---------- */
  sacudir(k) { this.trauma = Math.min(1, (this.trauma || 0) + k); },
  enPantalla(x, y) { const sx = this.mundo.x + x * this.escV, sy = this.mundo.y + y * this.escV; return sx > -40 && sx < this.W + 40 && sy > -40 && sy < this.H + 40; },
  /* Sprites de efectos que se reusan cuadro a cuadro (tajos, brillos y estelas de los proyectiles) */
  fxSpr(tex) {
    let s = this.pool.fx[this.nFx++];
    if (!s) { s = new PIXI.Sprite(tex); this.fxCapa.addChild(s); this.pool.fx.push(s); s.blendMode = PIXI.BLEND_MODES.ADD; }
    s.texture = tex; s.visible = true; s.rotation = 0; s.alpha = 1; s.tint = 0xffffff; s.anchor.set(0.5); return s;
  },
  tagSpr(tex) {
    let s = this.pool.tag[this.nTag++];
    if (!s) { s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.blendMode = PIXI.BLEND_MODES.ADD; this.tagFx.addChild(s); this.pool.tag.push(s); }
    s.texture = tex; s.visible = true; return s;
  },
  nuevaPart(capa, lista) { const s = new PIXI.Sprite(PIXI.Texture.WHITE); s.anchor.set(0.5); capa.addChild(s); lista.push(s); return s; },

  /* ---------- Cada cuadro ---------- */
  dibujar(now) {
    const v = Arena.v, n = UI.arena, app = this.app; if (!app || !v || !n) return;
    if (app.renderer.gl.isContextLost()) return;          // sin contexto no se dibuja (vuelve solo o se arma otro lienzo)
    const cv = app.view, W = cv.clientWidth, H = cv.clientHeight, t = now / 1000;
    if (app.renderer.width !== Math.round(W * this.dpr) || app.renderer.height !== Math.round(H * this.dpr)) app.renderer.resize(W, H);
    this.W = W; this.H = H;
    n.part = n.part || []; n.vistos = n.vistos || new Set();
    const dt = Math.min(0.05, Math.max(0, (now - (this.tMed || now)) / 1000));
    this.medir(now, v);
    const lo = this.lo = this.baja();
    this.prepararEscenario(v.esc);
    const { yo, esc: esc0, vt } = Arena.camara(v, n, W, H, now);
    // Temblor: se acumula con los golpes (a mí, críticos, explosiones, muertes) y se apaga solo; tope chico
    if (yo && yo.hit !== undefined && yo.hit !== this.ultHit) { if (vt - yo.hit < 300) this.sacudir(0.38); this.ultHit = yo.hit; }
    this.trauma = Math.max(0, (this.trauma || 0) - dt * 1.8);
    const sh = lo ? 0 : Math.min(8, 13 * this.trauma * this.trauma);
    const ox = W / 2 + sh * (Math.sin(t * 53.1) + Math.sin(t * 31.7) * 0.6) / 1.6, oy = H / 2 + sh * (Math.sin(t * 47.3 + 1.3) + Math.sin(t * 27.9) * 0.6) / 1.6;
    // Pausa de golpe (crítico): un instante quieto y la cámara se acerca un pelito; solo el dibujo, la pelea sigue
    const congela = !lo && now < (this.alto || 0), nowV = congela ? this.altoT : now, esc = esc0 * (congela ? 1.03 : 1);
    this.escV = esc; this.tagEsc = Math.min(1.05, Math.max(0.86, 0.62 + esc * 0.45)); this.nTag = 0;
    for (const C of [this.mundo, this.luces, this.brillo]) { C.scale.set(esc); C.x = ox - n.camx * esc; C.y = oy - n.camy * esc; }
    if (this.cielo.visible) { this.cielo.x = n.camx * 0.45; this.cielo.y = n.camy * 0.45; }
    // Animaciones del escenario
    this.gente.forEach(({ s, p, st }) => { if (p) s.y = p.y + 10 - Math.max(0, Math.sin(t * 6 + p.f)) * 5 - (v.fase === "fin" ? Math.abs(Math.sin(t * 9 + p.f)) * 6 : 0); else s.alpha = 0.45 + Math.sin(t * 2 + st.f) * 0.35; });
    this.llamas.forEach(({ L, fuego, rad, i, tipo }) => {
      const f = 1 + Math.sin(t * 9 + i * 1.7) * 0.06 + Math.sin(t * 23 + i) * 0.04 + (Math.sin(t * 37 + i * 3) > 0.92 ? 0.05 : 0);
      L.width = L.height = rad * 2 * (tipo === "lava" ? 1 + Math.sin(t * 1.5 + i) * 0.05 : f);
      if (fuego) { fuego.scale.y = fuego.scale.x * (0.9 + Math.sin(t * 14 + i) * 0.12); fuego.alpha = 0.85 + Math.sin(t * 11 + i) * 0.15; if (!lo && Math.random() < 0.02) Arena.particula(n, fuego.x + (Math.random() - 0.5) * 10, fuego.y - 20, (Math.random() - 0.5) * 30, -50 - Math.random() * 50, 900, "#ffb347", 3); }
    });
    this.lava.forEach(({ s, brillo, l }, i) => { s.rotation = t * 0.08 * (i % 2 ? 1 : -1); s.width = s.height = (l.r + Math.sin(t * 2 + l.x) * 3) * 2.08; brillo.alpha = 0.45 + Math.sin(t * 3 + i) * 0.12; if (Math.random() < (lo ? 0.04 : 0.1)) Arena.particula(n, l.x + (Math.random() - 0.5) * l.r, l.y + (Math.random() - 0.5) * l.r, (Math.random() - 0.5) * 20, -40 - Math.random() * 60, 1400, "#ffb02e", 3); });
    if (v.esc === "volcan") this.ambiente.tint = this.mezcla(0x4a2c26, 0x5e3628, 0.5 + Math.sin(t * 1.3) * 0.5);
    this.focosMov.forEach((L, i) => { L.x = 700 + Math.sin(t * 0.37 + i * 2.4) * 400; L.y = 500 + Math.sin(t * 0.53 + i * 1.3) * 270; L.alpha = 0.42 + Math.sin(t * 1.7 + i) * 0.08; });
    for (const F of this.flashes) {
      if (now > F.fin) { F.s.visible = false; if (!lo && Math.random() < 0.012) { const D = Arena.decoracion(v.esc).publico, p = D[Math.floor(Math.random() * D.length)]; F.s.x = p.x; F.s.y = p.y - 8; F.ini = now; F.fin = now + 160; F.s.rotation = Math.random(); } continue; }
      const k = (now - F.ini) / 160; F.s.visible = true; F.s.alpha = 1 - k; F.s.width = F.s.height = 46 * (0.6 + k * 0.6);
    }
    // Ambiente: se mueve dentro de lo que se ve (dando la vuelta por los bordes)
    const vx0 = n.camx - W / 2 / esc - 30, vy0 = n.camy - H / 2 / esc - 30, vw = W / esc + 60, vh = H / esc + 60;
    this.amb.forEach((a, i) => {
      a.s.visible = !lo || i % 3 === 0; if (!a.s.visible) return;
      a.x += (a.vx + Math.sin(t * 0.9 + a.ph) * 10) * dt; a.y += a.vy * dt;
      a.x = vx0 + ((((a.x - vx0) % vw) + vw) % vw); a.y = vy0 + ((((a.y - vy0) % vh) + vh) % vh);
      a.s.x = a.x; a.s.y = a.y; a.s.alpha = a.a * (0.55 + 0.45 * Math.sin(t * 3 + a.ph * 3));
    });
    // Cosas del piso: rayos, aro propio, línea de puntería
    const g = this.suelo; g.clear(); this.barras.clear();
    const E = AR.ESCENARIOS[v.esc];
    if (E.rayos) E.rayos.forEach(r => {
      const aviso = (vt % 7000) > 4000 && !v.rayosOn;
      if (aviso || v.rayosOn) { g.beginFill(v.rayosOn ? 0x74c0fc : 0xffd43b, v.rayosOn ? 0.45 + Math.sin(t * 30) * 0.2 : 0.1 + Math.max(0, Math.sin(t * 12)) * 0.1); g.drawRect(r.x, r.y, r.w, r.h); g.endFill(); }
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
      if (!e.s.visible) { if (e.nom) e.nom.visible = false; continue; }
      // Giro del guerrero: el área que golpea, marcada en el piso
      if (j.vivo && vt < j.giro) { const c = Arena.LADOS[Arena.lado(j)][1]; g.lineStyle(2.5, c, 0.35 + Math.sin(t * 14) * 0.15); g.beginFill(c, 0.06); g.drawCircle(o.x, o.y + 8, 110); g.endFill(); g.lineStyle(0); }
      if (!congela || !e.pintado) {
        e.pintado = true;
        x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, e.c.width, e.c.height); x.setTransform(e.k, 0, 0, e.k, this.OX * e.k, this.OY * e.k);
        if (!j.vivo) Arena.dibujarCaido(x, { ...j }, 0, 0, t, Arena.caida(n, j, now));
        else {
          if (esYo) { x.strokeStyle = "#3ddcb1"; x.lineWidth = 3; x.beginPath(); x.ellipse(0, 16, 28, 11, 0, 0, 7); x.stroke(); }
          this.aura(n, j, o, t, x, vt);
          Arena.dibujarLuchador(x, { ...j, cara: esYo ? n.cara : j.cara, esYo, festeja: Arena.festeja(v, j), sinNombre: true }, 0, 0, t, anda, vt);
          if (Arena.festeja(v, j) && Math.random() < 0.25) ArenaFX.emitir(n, { x: o.x + (Math.random() - 0.5) * 60, y: o.y - 70, vx: (Math.random() - 0.5) * 140, vy: -120 - Math.random() * 80, grav: 260, tex: "star_04", color: ["#ffd43b", "#ff6b6b", "#4dabf7", "#3ddcb1", "#cc5de8"][Math.floor(Math.random() * 5)], vida: 1200, tam: 16, crece: 0.8, vrot: 6 });
        }
        e.tex.update();
      }
      this.etiqueta(e, j, o, esYo, vt, now);
      // Luz propia: el jugador se ve un poco aunque esté en lo oscuro; los jefes brillan rojo
      this.luzDe("p" + j.id, o.x, o.y - 20, j.equipo === "m" ? (j.tam > 1 ? 0xff4d63 : 0x000000) : esYo ? 0xbfe3ff : 0x7a7a90, j.equipo === "m" ? (j.tam > 1 ? 260 : 0) : esYo ? 260 : 180, j.vivo);
    }
    Object.keys(this.entidad).forEach(id => { if (!vivos.has(id)) { this.soltarEnt(this.entidad[id]); delete this.entidad[id]; this.luzDe("p" + id, 0, 0, 0, 0, false); this.luzDe("a" + id, 0, 0, 0, 0, false); } });
    // Llegó el jefe de la torre: temblor fuerte y la pantalla se pone roja un momento
    if (v.horda && v.horda.jefe && v.fase === "pelea") { const J = v.jug.find(j => j.equipo === "m" && j.tam > 1 && j.vivo); if (J && this.jefeVisto !== J.id) { this.jefeVisto = J.id; this.sacudir(0.75); this.rojoPulso = now; } }
    // Línea de puntería
    if (yo && yo.vivo && n.apunta) {
      const A = AR.CLASES[yo.clase].atk, largo = Math.min(520, (A.alcance || 80) * (yo.alc || 1)), ax = n.x + n.apunta.x * 30, ay = n.y - 10 + n.apunta.y * 30;
      g.lineStyle(4, 0xffd43b, 0.85); for (let k = 0; k < largo; k += 18) { g.moveTo(ax + n.apunta.x * k, ay + n.apunta.y * k); g.lineTo(ax + n.apunta.x * Math.min(largo, k + 10), ay + n.apunta.y * Math.min(largo, k + 10)); }
      const fx = ax + n.apunta.x * largo, fy = ay + n.apunta.y * largo;
      g.lineStyle(0); g.beginFill(0xffd43b, 0.9); g.drawCircle(fx, fy, 6); g.endFill(); g.lineStyle(2.5, 0xffd43b, 0.6 + Math.sin(t * 10) * 0.3); g.drawCircle(fx, fy, 14); g.lineStyle(0);
    }
    // Proyectiles, efectos y partículas
    this.efectos(v, n, nowV, vt, t, lo, now);
    for (let i = this.nTag; i < this.pool.tag.length; i++) this.pool.tag[i].visible = false;
    // Flechas a los rivales que no se ven
    this.fuera(v, n, esc, W, H);
    // Viñeta y pantalla roja con poca vida, en muerte súbita o cuando llega el jefe
    this.vineta.width = W; this.vineta.height = H; this.rojo.width = W; this.rojo.height = H;
    const jr = Math.max(0, 1 - (now - this.rojoPulso) / 700) * 0.28;
    this.rojo.alpha = jr + (v.sub ? 0.12 + Math.sin(t * 4) * 0.06 : yo && yo.vivo && yo.hp / yo.max < 0.3 ? 0.1 + Math.sin(t * 6) * 0.05 : 0);
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
  /* Poderes activos: luz y partículas propias (el aura se dibuja con Arena.dibujarPoder, igual que en el dibujo de siempre) */
  PODER_LUZ: { inmortal: [0xffd43b, "star_04", "#ffe066"], veloz: [0x66d9e8, "trace_04", "#99e9f2"], drena: [0xff4d63, "magic_04", "#ff6b6b"], sombra: [0x7048e8, "smoke_07", "#5f3dc4"] },
  aura(n, j, o, t, x, vt) {
    const activo = ["inmortal", "veloz", "drena", "sombra"].find(k => vt < j[k] && (k !== "sombra" || j.id === Arena.v.me));
    if (activo) {
      const [c, tex, col] = this.PODER_LUZ[activo];
      this.luzDe("a" + j.id, o.x, o.y - 14, c, activo === "inmortal" ? 260 : 190, true);
      if (Math.random() < 0.45) ArenaFX.emitir(n, activo === "veloz" ? { x: o.x + (Math.random() - 0.5) * 20, y: o.y - Math.random() * 40, vx: -(j.cara || 1) * (120 + Math.random() * 80), tex: "spark_01", color: col, vida: 380, tam: 16, crece: 0.6 }
        : { x: o.x + (Math.random() - 0.5) * 50, y: o.y - Math.random() * 50, vy: -60 - Math.random() * 40, tex, color: col, vida: 800, tam: activo === "sombra" ? 40 : 18, crece: activo === "sombra" ? 1.6 : 0.7, alfa: 0.8, add: activo !== "sombra" });
      return;
    }
    const A = j.evoId && this.AURAS[j.evoId];
    if (!A || j.equipo === "m") { if (this.luzMap && this.luzMap["a" + j.id]) this.luzDe("a" + j.id, 0, 0, 0, 0, false); return; }
    x.save(); x.globalAlpha = 0.5 + Math.sin(t * 3) * 0.15; x.strokeStyle = A[0]; x.lineWidth = A[1] ? 4 : 2.5; x.beginPath(); x.ellipse(0, 16, 34, 13, 0, 0, 7); x.stroke(); x.restore();
    if (A[1] && Math.random() < 0.22) ArenaFX.emitir(n, { x: o.x + (Math.random() - 0.5) * 40, y: o.y + 10, vy: -50 - Math.random() * 40, vx: (Math.random() - 0.5) * 20, tex: A[1], color: A[0], vida: 900, tam: 18, crece: A[1].startsWith("smoke") ? 1.8 : 0.6, alfa: 0.75, add: !A[1].startsWith("smoke") });
    this.luzDe("a" + j.id, o.x, o.y - 10, this.color(A[0]).c, 150, !!A[1]);
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
  efectos(v, n, now, vt, t, lo, real) {
    const g = this.gfx, gb = this.gfxB; g.clear(); gb.clear(); this.nFx = 0;
    const dtv = Math.min(0.2, (real - (n.vtLocal || real)) / 1000), activas = this.activas || (this.activas = new Set()); activas.clear();
    v.proy.forEach(p => {
      const x = p.x + p.vx * dtv, y = p.y + p.vy * dtv, a = Math.atan2(p.vy, p.vx), cs = Math.cos(a), sn = Math.sin(a);
      ArenaFX.proyectil(null, n, p, x, y, a);
      if (p.tipo === "flecha") {
        // Estela de luz, varilla, plumas y punta con brillo
        const es = this.fxSpr(this.texProc("estela")); es.anchor.set(1, 0.5); es.x = x - cs * 6; es.y = y - sn * 6; es.rotation = a; es.width = 84; es.height = 9; es.tint = 0xfff3bf; es.alpha = 0.6;
        const h = this.fxSpr(this.texFx("light_01")); h.x = x + cs * 12; h.y = y + sn * 12; h.width = h.height = 36; h.tint = this.color(p.color).c; h.alpha = 0.5;
        g.lineStyle(3, 0xe9dcc0, 1); g.moveTo(x - cs * 20, y - sn * 20); g.lineTo(x + cs * 10, y + sn * 10); g.lineStyle(0);
        g.beginFill(0xff4d63); g.drawPolygon([x - cs * 14, y - sn * 14, x - cs * 24 - sn * 5, y - sn * 24 + cs * 5, x - cs * 22, y - sn * 22, x - cs * 24 + sn * 5, y - sn * 24 - cs * 5]); g.endFill();
        g.beginFill(this.color(p.color).c); g.drawPolygon([x + cs * 18, y + sn * 18, x + cs * 8 - sn * 6, y + sn * 8 + cs * 6, x + cs * 8 + sn * 6, y + sn * 8 - cs * 6]); g.endFill();
        this.luzDe("f" + p.k, x, y, 0x806040, 70, true);
      } else {
        // Bola de fuego: halo, cola que se achica y centro blanco (todo en la capa de brillo)
        const h = this.fxSpr(this.texFx("light_01")); h.x = x; h.y = y; h.width = h.height = 92; h.tint = 0xff8c1a; h.alpha = 0.55 + Math.sin(t * 30 + p.k) * 0.08;
        const B = this.texProc("bola");
        for (let k = 1; k <= 5; k++) { const s = this.fxSpr(B); s.x = x - cs * k * 9; s.y = y - sn * k * 9; s.width = s.height = 26 - k * 3.4; s.tint = k < 3 ? 0xffb02e : 0xff6a00; s.alpha = 0.75 - k * 0.12; }
        const c = this.fxSpr(B); c.x = x; c.y = y; c.width = c.height = 30; c.tint = 0xfff3c4;
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
        if (f.tipo === "num") {
          chispas(f.color === "#3ddcb1" ? "#3ddcb1" : "#ffd43b", 8, 160);
          // Golpe: chispas alargadas que salen disparadas; el crítico además tiembla y pausa un instante
          if (f.color !== "#3ddcb1" && /\d$/.test(f.txt)) {
            const crit = f.color === "#ffd43b";
            for (let i = 0; i < (crit ? 12 : 6); i++) { const a = Math.random() * 6.28, s = (crit ? 420 : 280) * (0.5 + Math.random() * 0.7); ArenaFX.emitir(n, { x: f.x, y: f.y + 26, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, grav: 520, tex: "chispa", color: crit ? "#ffe066" : "#ffd8a8", vida: 240 + Math.random() * 200, tam: crit ? 26 : 20, crece: 0.6, esc: [0.3, 1.5], alinea: true, rot: 0 }); }
            if (crit && this.enPantalla(f.x, f.y)) { this.sacudir(0.3); if (!lo) { this.alto = real + 55; this.altoT = real; } }
          }
        }
        if (f.tipo === "boom") { chispas("#ff8c00", 22, 260); this.destello(f.x, f.y, 0xff8c1a, f.r * 4, now); if (this.enPantalla(f.x, f.y)) this.sacudir(0.2); }
        if (f.tipo === "muerte") {
          chispas("#ffffff", 26, 300); this.destello(f.x, f.y, 0xffffff, 260, now);
          ArenaFX.emitir(n, { x: f.x, y: f.y + 8, tex: "anillo", color: "#ffffff", vida: 520, tam: 30, crece: 6, alfa: 0.85, rot: 0, esc: [1, 0.55] });
          if (this.enPantalla(f.x, f.y)) this.sacudir(0.4);
        }
        if (f.tipo === "onda") { chispas(f.color, 18, 260); this.destello(f.x, f.y, this.color(f.color).c, f.r * 2.4, now); }
        ArenaFX.evento(n, f);
      }
      const k = Math.max(0, (vt - f.t) / 500); if (k > 1 && f.tipo !== "num") return;
      if (f.tipo === "tajo") {
        // Tajo: media luna de luz que barre en la dirección del golpe, del color del arma
        const kk = Math.min(1, (vt - f.t) / 280); if (kk >= 1) return;
        const a = Math.atan2(f.dy, f.dx), col = this.color(f.color).c, e = 1 - (1 - kk) * (1 - kk), T = this.texProc("arco"), sc = f.r / 112, rot = a - f.arco * 0.35 + f.arco * 0.5 * e;
        const s = this.fxSpr(T); s.x = f.x; s.y = f.y - 10; s.rotation = rot; s.scale.set(sc * (0.92 + 0.12 * e)); s.tint = col; s.alpha = (1 - kk) * 0.95;
        const w = this.fxSpr(T); w.x = f.x; w.y = f.y - 10; w.rotation = rot + 0.06; w.scale.set(sc * (0.84 + 0.1 * e)); w.alpha = (1 - kk) * 0.7;
      } else if (f.tipo === "onda") { const c = this.color(f.color).c, e = 1 - (1 - k) * (1 - k); gb.lineStyle(12 * (1 - k) + 2, c, 1 - k); gb.beginFill(c, 0.12 * (1 - k)); gb.drawCircle(f.x, f.y, f.r * (0.3 + 0.7 * e)); gb.endFill(); gb.lineStyle(0); }
      else if (f.tipo === "rayo") {
        // Rayo que chupa la vida (del golpeado al que la absorbe)
        const kk = Math.min(1, (vt - f.t) / 350); if (kk >= 1) return;
        const c = this.color(f.color).c, pts = [];
        for (let i = 0; i <= 8; i++) { const q = i / 8, w = i && i < 8 ? 7 : 0; pts.push(f.x + (f.x2 - f.x) * q + Math.sin(q * 9 + t * 30) * w, f.y + (f.y2 - f.y) * q + Math.cos(q * 7 + t * 25) * w); }
        for (const [ancho, col, al] of [[7, c, 0.9], [2.5, 0xffe3e3, 1]]) { gb.lineStyle(ancho, col, al * (1 - kk)); gb.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) gb.lineTo(pts[i], pts[i + 1]); }
        gb.lineStyle(0);
      }
      else if (f.tipo === "num") this.numero(f, vt);
    });
    if (n.vistos.size > 400) n.vistos = new Set([...n.vistos].slice(-200));
    // Números viejos: los de mapa de bits vuelven a la reserva, los demás se destruyen
    Object.keys(this.pool.tx).forEach(k => { if (k.startsWith("ic")) return; const T = this.pool.tx[k]; if (vt - T.t > 1000 || !v.fx.some(f => f.k === +k)) this.soltarNum(T, k); });
    // Partículas: las simples (cuadraditos, con la luz del escenario) y las de textura (las que suman luz van en la capa de brillo)
    n.part = n.part.filter(p => now - p.t0 < p.vida);
    n.fxp = (n.fxp || []).filter(p => now - p.t0 < p.vida);
    const pp = this.pool.part, pb = this.pool.b; let i = 0, ib = 0;
    for (const p of n.part) {
      const s = pp[i] || this.nuevaPart(this.part, pp); i++;
      const k = Math.max(0, (now - p.t0) / 1000), vida = Math.max(0, (now - p.t0) / p.vida), c = this.color(p.color), tam = p.tam * (1 - vida * 0.5);
      s.visible = true; s.texture = PIXI.Texture.WHITE; s.blendMode = PIXI.BLEND_MODES.NORMAL; s.tint = c.c; s.alpha = (1 - vida) * c.a; s.width = s.height = tam; s.rotation = 0;
      s.x = p.x + p.vx * k; s.y = p.y + p.vy * k + p.grav * k * k;
    }
    for (const p of n.fxp) {
      const T = this.texFx(p.tex), s = p.add ? (pb[ib] || this.nuevaPart(this.partB, pb)) : (pp[i] || this.nuevaPart(this.part, pp)); if (p.add) ib++; else i++;
      if (!T) { s.visible = false; continue; }
      const k = Math.max(0, (now - p.t0) / 1000), f = Math.max(0, (now - p.t0) / p.vida), tam = p.tam * (1 + (p.crece - 1) * f);
      s.visible = true; s.texture = T; s.blendMode = p.add ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL; s.tint = this.color(p.color).c;
      s.alpha = Math.max(0, p.alfa * (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85)); s.width = tam * (p.esc ? p.esc[0] : 1); s.height = tam * (p.esc ? p.esc[1] : 1);
      s.rotation = p.alinea ? Math.atan2(p.vy + 2 * p.grav * k, p.vx) + 1.5708 : p.rot + p.vrot * k;
      s.x = p.x + p.vx * k; s.y = p.y + p.vy * k + p.grav * k * k;
    }
    for (; i < pp.length; i++) pp[i].visible = false;
    for (; ib < pb.length; ib++) pb[ib].visible = false;
    for (let q = this.nFx; q < this.pool.fx.length; q++) this.pool.fx[q].visible = false;
    // Destellos de luz (explosiones, ondas)
    this.destellos = (this.destellos || []).filter(d => { const k = (now - d.t0) / 450; if (k >= 1) { this.luzDe(d.k, 0, 0, 0, 0, false); return false; } this.luzDe(d.k, d.x, d.y, d.c, d.r * (1 - k * 0.5), true); const L = this.luzMap[d.k]; if (L) L.alpha = 1 - Math.max(0, k); return true; });
  },
  destello(x, y, c, r, now) { this.nD = (this.nD || 0) + 1; (this.destellos = this.destellos || []).push({ k: "d" + this.nD, x, y, c, r, t0: now }); },
  /* Número de daño: salta con rebote, sube, se corre un poco de costado y se apaga. El crítico es más grande, tiembla y tiene un destello */
  numero(f, vt) {
    const kk = (vt - f.t) / 1000; if (kk > 1) return;
    let T = this.pool.tx[f.k];
    if (!T) {
      const m = this.fuenteNum() && /^(\D*?)([+-]\d+)$/.exec(f.txt);
      if (m) {
        const o = this.pool.num.pop() || this.nums.addChild(new PIXI.BitmapText("0", { fontName: "arNum", fontSize: 44 }));
        o.text = m[2]; o.anchor.set(0.5); o.visible = true; o.tint = this.color(f.color).c; o.rotation = 0;
        let ic = null; if (m[1].trim()) { ic = this.pool.ico.pop() || this.nums.addChild(new PIXI.Sprite()); ic.texture = this.texEmoji(m[1].trim()); ic.anchor.set(1, 0.5); ic.visible = true; }
        T = this.pool.tx[f.k] = { o, ic, t: f.t, bm: true };
      } else { const o = new PIXI.Text(f.txt, { fontFamily: "Figtree, system-ui, sans-serif", fontSize: 20, fontWeight: "900", fill: f.color, stroke: "#1a0f14", strokeThickness: 5, lineJoin: "round" }); o.anchor.set(0.5); this.nums.addChild(o); T = this.pool.tx[f.k] = { o, t: f.t }; }
    }
    const crit = T.bm && f.color === "#ffd43b", cura = f.color === "#3ddcb1", S = this.tagEsc;
    const pop = kk < 0.1 ? 0.35 + kk / 0.1 * 1.05 : kk < 0.22 ? 1.4 - (kk - 0.1) / 0.12 * 0.4 : 1;
    const deriva = ((f.k * 37) % 23 - 11) * Math.min(1, kk * 3), sube = (1 - Math.pow(1 - Math.min(1, kk * 1.6), 3)) * (cura ? 50 : 40);
    const x = this.mundo.x + f.x * this.escV + deriva, y = this.mundo.y + (f.y - 30) * this.escV - 16 * S - sube, al = kk > 0.65 ? 1 - (kk - 0.65) / 0.35 : 1;
    T.o.x = x; T.o.y = y; T.o.scale.set((T.bm ? 0.5 : 1) * (crit ? 1.45 : 1) * S * pop); T.o.alpha = al; T.o.rotation = crit ? Math.sin(kk * 40) * 0.1 * (1 - kk) : 0;
    if (T.ic) { const h = 26 * S * pop * (crit ? 1.3 : 1); T.ic.scale.set(h / 56); T.ic.x = x - T.o.width / 2 + 2; T.ic.y = y; T.ic.alpha = al; }
    if (crit && kk < 0.45 && !this.lo) { const s = this.tagSpr(this.texFx("star_06")); s.x = x; s.y = y; s.width = s.height = 110 * (0.5 + kk * 1.4) * S; s.alpha = (1 - kk / 0.45) * 0.9; s.tint = 0xffd43b; s.rotation = kk * 3; }
  },
  soltarNum(T, k) {
    if (T.bm) { T.o.visible = false; this.pool.num.push(T.o); if (T.ic) { T.ic.visible = false; this.pool.ico.push(T.ic); } }
    else T.o.destroy(true);
    delete this.pool.tx[k];
  },
  fuera(v, n, esc, W, H) {
    const g = this.flechas; g.clear(); const usados = new Set();
    v.jug.forEach(j => {
      if (!j.vivo || j.id === v.me || j.inv) return;
      const o = n.otros[j.id] || j, sx = (o.x - n.camx) * esc + W / 2, sy = (o.y - 20 - n.camy) * esc + H / 2, m = 34;
      if (sx > m && sx < W - m && sy > m + 50 && sy < H - m - 90) return;
      const ex = Math.max(m, Math.min(W - m, sx)), ey = Math.max(m + 50, Math.min(H - m - 90, sy)), ang = Math.atan2(sy - H / 2, sx - W / 2);
      const col = Arena.LADOS[Arena.lado(j)][1];
      g.lineStyle(3, col, 1); g.beginFill(0x141120, 0.85); g.drawCircle(ex, ey, 20); g.endFill(); g.lineStyle(0);
      g.beginFill(col); g.drawPolygon([ex + Math.cos(ang) * 30, ey + Math.sin(ang) * 30, ex + Math.cos(ang) * 20 - Math.sin(ang) * 8, ey + Math.sin(ang) * 20 + Math.cos(ang) * 8, ex + Math.cos(ang) * 20 + Math.sin(ang) * 8, ey + Math.sin(ang) * 20 - Math.cos(ang) * 8]); g.endFill();
      const ic = j.evoIc || AR.CLASES[j.clase].ic; usados.add(j.id);
      let T = this.pool.tx["ic" + j.id]; if (!T || T.ic !== ic) { if (T) T.o.destroy(); const o2 = new PIXI.Text(ic, { fontSize: 18, fontFamily: FE }); o2.anchor.set(0.5); this.flechasTx.addChild(o2); T = this.pool.tx["ic" + j.id] = { o: o2, ic, t: Infinity }; }
      T.o.x = ex; T.o.y = ey + 1; T.o.visible = true;
    });
    Object.keys(this.pool.tx).forEach(k => { if (k.startsWith("ic") && !usados.has(k.slice(2))) this.pool.tx[k].o.visible = false; });
  }
};
