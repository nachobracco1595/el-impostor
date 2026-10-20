/* Efectos con texturas para la Arena y la Torre: chispas, fuego, humo, ondas mágicas, cortes y brillos,
   y los monstruos de la torre dibujados con sprites.
   Arte: Particle Pack y Monster Builder Pack de Kenney (kenney.nl), licencia CC0 (ver img/arena/). */
const ArenaFX = {
  TEX: ["spark_01", "star_04", "star_06", "smoke_03", "smoke_07", "fire_01", "flame_03", "magic_02", "magic_04", "slash_02", "light_01", "circle_05", "trace_04", "twirl_02", "muzzle_01", "symbol_01", "dirt_02"],
  img: {}, tintes: {}, mon: {},
  cargar() {
    if (this.listo) return; this.listo = true;
    for (const k of this.TEX) { const im = new Image(); im.src = `img/arena/fx/${k}.png`; this.img[k] = im; }
  },
  /* Textura blanca pintada de un color (se guarda para no repetir el trabajo) */
  tex(k, color) {
    const im = this.img[k]; if (!im || !im.complete || !im.naturalWidth) return null;
    const key = k + color; if (this.tintes[key]) return this.tintes[key];
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d"); x.drawImage(im, 0, 0, 64, 64); x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, 64, 64);
    return (this.tintes[key] = c);
  },
  sprite(k) {
    if (!this.mon[k]) { const im = new Image(); im.src = `img/arena/mon/${k}.png`; this.mon[k] = im; }
    return this.mon[k];
  },
  /* Silueta blanca del monstruo (destello cuando recibe un golpe) */
  blanco(k) {
    const key = "b" + k; if (this.mon[key]) return this.mon[key];
    const im = this.sprite(k); if (!im.complete || !im.naturalWidth) return null;
    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext("2d"); x.drawImage(im, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    return (this.mon[key] = c);
  },

  /* ---------- Partículas con textura ---------- */
  emitir(n, p) { (n.fxp = n.fxp || []).push({ t0: performance.now(), vx: 0, vy: 0, grav: 0, rot: Math.random() * 6.28, vrot: 0, tam: 24, crece: 1, alfa: 1, add: true, ...p }); if (n.fxp.length > 320) n.fxp.splice(0, n.fxp.length - 320); },
  rafaga(n, x, y, tex, color, k, vel, extra = {}) {
    for (let i = 0; i < k; i++) { const a = Math.random() * 6.28, s = vel * (0.35 + Math.random() * 0.65); this.emitir(n, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, tex, color, vida: 420 + Math.random() * 300, tam: 14 + Math.random() * 14, crece: 0.4, vrot: (Math.random() - 0.5) * 8, ...extra }); }
  },
  dibujar(ctx, n, now) {
    if (!n.fxp || !n.fxp.length) return;
    n.fxp = n.fxp.filter(p => now - p.t0 < p.vida);
    const modo = ctx.globalCompositeOperation;
    for (const p of n.fxp) {
      const k = (now - p.t0) / 1000, f = (now - p.t0) / p.vida, T = this.tex(p.tex, p.color); if (!T) continue;
      const s = p.tam * (1 + (p.crece - 1) * f) * (p.crece < 1 ? 1 : 1), x = p.x + p.vx * k, y = p.y + p.vy * k + p.grav * k * k;
      ctx.globalCompositeOperation = p.add ? "lighter" : "source-over";
      ctx.globalAlpha = Math.max(0, p.alfa * (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85));
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + p.vrot * k); if (p.esc) ctx.scale(p.esc[0], p.esc[1]);
      ctx.drawImage(T, -s / 2, -s / 2, s, s); ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = modo;
  },
  /* Lo que se ve la primera vez que llega cada efecto del anfitrión */
  evento(n, f) {
    if (f.tipo === "num") {
      const cura = f.color === "#3ddcb1", crit = f.color === "#ffd43b";
      if (cura) { for (let i = 0; i < 5; i++) this.emitir(n, { x: f.x + (Math.random() - 0.5) * 40, y: f.y + 30, vy: -60 - Math.random() * 40, tex: "symbol_01", color: "#3ddcb1", vida: 900, tam: 18, crece: 1.2, rot: 0, add: false }); return; }
      this.rafaga(n, f.x, f.y + 20, "star_04", crit ? "#ffd43b" : "#ff8f8f", crit ? 9 : 5, crit ? 320 : 220);
      this.emitir(n, { x: f.x, y: f.y + 24, tex: "circle_05", color: crit ? "#ffe066" : "#ff8787", vida: 200, tam: crit ? 60 : 40, crece: 1.5, alfa: 0.4 });
      if (crit) this.emitir(n, { x: f.x, y: f.y + 24, tex: "star_06", color: "#ffd43b", vida: 380, tam: 90, crece: 1.3 });
    } else if (f.tipo === "boom") {
      this.emitir(n, { x: f.x, y: f.y, tex: "light_01", color: "#ff8c1a", vida: 380, tam: f.r * 2.2, crece: 1.25, alfa: 0.4 });
      for (let i = 0; i < 4; i++) this.emitir(n, { x: f.x + (Math.random() - 0.5) * f.r, y: f.y + (Math.random() - 0.5) * f.r, tex: "fire_01", color: i % 2 ? "#ff7b00" : "#ffb703", vida: 450 + Math.random() * 200, tam: f.r * 1.2, crece: 1.4, vy: -40, vrot: (Math.random() - 0.5) * 3, alfa: 0.55 });
      for (let i = 0; i < 4; i++) this.emitir(n, { x: f.x + (Math.random() - 0.5) * f.r, y: f.y, tex: "smoke_03", color: "#5c5470", vida: 1100, tam: f.r * 1.5, crece: 1.8, vy: -50, add: false, alfa: 0.55 });
      this.rafaga(n, f.x, f.y, "spark_01", "#ffb347", 8, 380);
    } else if (f.tipo === "muerte") {
      for (let i = 0; i < 7; i++) this.emitir(n, { x: f.x + (Math.random() - 0.5) * 40, y: f.y - Math.random() * 30, tex: "smoke_07", color: "#d0cfe0", vida: 1300, tam: 60, crece: 1.9, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 40, add: false, alfa: 0.7 });
      this.emitir(n, { x: f.x, y: f.y - 10, tex: "star_06", color: "#ffffff", vida: 500, tam: 140, crece: 1.2 });
      this.rafaga(n, f.x, f.y - 10, "star_04", "#ffe066", 12, 340);
    } else if (f.tipo === "onda") {
      this.emitir(n, { x: f.x, y: f.y, tex: "magic_02", color: f.color, vida: 600, tam: f.r * 0.6, crece: 3.6, vrot: 2 });
      this.emitir(n, { x: f.x, y: f.y, tex: "light_01", color: f.color, vida: 380, tam: f.r * 1.6, crece: 1.2, alfa: 0.35 });
      this.rafaga(n, f.x, f.y, "magic_04", f.color, 10, 300);
    } else if (f.tipo === "humo") {
      for (let i = 0; i < 6; i++) this.emitir(n, { x: f.x + (Math.random() - 0.5) * 30, y: f.y - Math.random() * 30, tex: "smoke_03", color: "#7d6fa8", vida: 900, tam: 50, crece: 1.9, vx: (Math.random() - 0.5) * 60, vy: -20, add: false, alfa: 0.75 });
      this.emitir(n, { x: f.x, y: f.y - 10, tex: "twirl_02", color: "#b197fc", vida: 600, tam: 80, crece: 1.6, vrot: 6 });
    } else if (f.tipo === "tajo") {
      const a = Math.atan2(f.dy, f.dx);
      this.emitir(n, { x: f.x + Math.cos(a) * f.r * 0.55, y: f.y - 10 + Math.sin(a) * f.r * 0.55, tex: "slash_02", color: f.color || "#ffffff", vida: 260, tam: f.r * 1.5, crece: 1.15, rot: a + Math.PI / 2, alfa: 0.95 });
    }
  },
  /* Brillo y estela de cada proyectil (se dibuja antes que el proyectil) */
  proyectil(ctx, n, p, x, y, a) {
    const g = ctx && this.tex("light_01", p.tipo === "flecha" ? "#fff3bf" : "#ff9f1c");
    if (g) { const modo = ctx.globalCompositeOperation; ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = p.tipo === "flecha" ? 0.3 : 0.55; const s = p.tipo === "flecha" ? 36 : 62; ctx.drawImage(g, x - s / 2, y - s / 2, s, s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = modo; }
    if (p.tipo !== "flecha" && Math.random() < 0.6) this.emitir(n, { x, y, tex: Math.random() < 0.5 ? "flame_03" : "fire_01", color: "#ff9f1c", vida: 380, tam: 26, crece: 0.4, vx: -Math.cos(a) * 60 + (Math.random() - 0.5) * 40, vy: -Math.sin(a) * 60 + (Math.random() - 0.5) * 40 });
    if (p.tipo === "flecha" && Math.random() < 0.35) this.emitir(n, { x, y, tex: "trace_04", color: "#ffffff", vida: 220, tam: 28, crece: 0.7, rot: a + Math.PI / 2, alfa: 0.5 });
  },

  /* ---------- Monstruos de la torre ---------- */
  monstruo(ctx, j, x, y, t, anda, vt) {
    const im = this.sprite(j.sprite); if (!im.complete || !im.naturalWidth) return false;
    const tam = (j.tam || 1) * 66, w = tam * im.naturalWidth / Math.max(im.naturalWidth, im.naturalHeight), h = tam * im.naturalHeight / Math.max(im.naturalWidth, im.naturalHeight);
    const golpeado = j.hit !== undefined && vt - j.hit < 160, pegando = vt - j.golpe < 220;
    const paso = anda ? Math.sin(t * 12 + x * 0.01) : 0, rebote = anda ? Math.abs(paso) * 5 : Math.sin(t * 3 + x) * 1.5;
    // Sombra
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x, y + 16, w * 0.4, 9 * (j.tam || 1), 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x + (golpeado ? Math.sin(vt / 12) * 4 : 0), y + 18 - rebote);
    if (j.cara < 0) ctx.scale(-1, 1);
    ctx.rotate(anda ? paso * 0.07 : 0);
    // Se estira al atacar y se aplasta al caminar
    const sx = pegando ? 1.12 : 1 + Math.abs(paso) * 0.04, sy = pegando ? 0.9 : 1 - Math.abs(paso) * 0.04;
    ctx.scale(sx, sy);
    ctx.drawImage(im, -w / 2, -h, w, h);
    if (golpeado) { const b = this.blanco(j.sprite); if (b) { ctx.globalAlpha = 0.85 * (1 - (vt - j.hit) / 160); ctx.drawImage(b, -w / 2, -h, w, h); ctx.globalAlpha = 1; } }
    ctx.restore();
    if (j.tam > 1) { ctx.strokeStyle = "#ff4d63"; ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.15; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 16, w * 0.55, 14, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    if (vt < j.lento) { ctx.fillStyle = "rgba(116,192,252,.22)"; ctx.beginPath(); ctx.arc(x, y - h * 0.4, w * 0.5, 0, 7); ctx.fill(); }
    if (j.quema) { ctx.font = "15px " + FE; ctx.textAlign = "center"; ctx.fillStyle = "#000"; ctx.fillText("🔥", x - w * 0.4, y - h * 0.6); }
    return h;
  }
};
