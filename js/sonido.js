/* Música y efectos generados en vivo con Web Audio (sin archivos de audio).
   Pistas: menu (fiesta), misterio (reparto de roles), tension (debate), bar (Mesa del Mentiroso), noir (Detectives). */
const Sonido = {
  ctx: null, master: null, musicBus: null, sfxBus: null, reverb: null,
  musicaOn: store.get("musicaOn", true), efectosOn: store.get("efectosOn", true),
  pista: null, quiere: null, paso: 0, proximo: 0, timer: null, previo: new Set(),

  iniciar() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0;
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.efectosOn ? 0.9 : 0;
    this.musicBus.connect(this.master); this.sfxBus.connect(this.master);
    // Reverb simple con ruido que decae
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2, imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.reverb.buffer = imp;
    const wet = ctx.createGain(); wet.gain.value = 0.28;
    this.reverb.connect(wet).connect(this.master);
    this.ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.timer = setInterval(() => this.programar(), 25);
    if (this.quiere) this.musica(this.quiere, true);
  },

  /* ---------- Instrumentos ---------- */
  nota: m => 440 * Math.pow(2, (m - 69) / 12),
  env(g, t, a, peak, dec, sus = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec);
  },
  osc(tipo, f, t, dur, vol, bus, opts = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(opts.glide, t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    let salida = g;
    if (opts.lp) { const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.setValueAtTime(opts.lp, t); if (opts.lpTo) fl.frequency.exponentialRampToValueAtTime(opts.lpTo, t + dur); fl.Q.value = opts.q || 1; o.connect(fl).connect(g); } else o.connect(g);
    this.env(g, t, opts.a || 0.005, vol, opts.dec || dur, opts.sus);
    if (opts.sus) g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
    salida.connect(bus);
    if (opts.rev) { const s = c.createGain(); s.gain.value = opts.rev; g.connect(s).connect(this.reverb); }
    o.start(t); o.stop(t + dur + 0.6);
  },
  ruido(t, dur, vol, bus, tipo = "highpass", f = 7000, q = 1, opts = {}) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.ruidoBuf; fl.type = tipo; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (opts.fTo) fl.frequency.exponentialRampToValueAtTime(opts.fTo, t + dur);
    s.connect(fl).connect(g).connect(bus);
    this.env(g, t, opts.a || 0.002, vol, dur);
    if (opts.rev) { const r = c.createGain(); r.gain.value = opts.rev; g.connect(r).connect(this.reverb); }
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.1);
  },
  bombo(t, vol = 0.9) { this.osc("sine", 140, t, 0.32, vol, this.musicBus, { glide: 42, dec: 0.3 }); },
  caja(t, vol = 0.35) { this.ruido(t, 0.16, vol, this.musicBus, "bandpass", 1800, 0.8, { rev: 0.3 }); this.osc("triangle", 190, t, 0.08, vol * 0.5, this.musicBus); },
  hat(t, vol = 0.12, abierto) { this.ruido(t, abierto ? 0.18 : 0.04, vol, this.musicBus, "highpass", 8000); },
  escobilla(t, vol = 0.1) { this.ruido(t, 0.22, vol, this.musicBus, "bandpass", 3500, 0.6, { a: 0.03 }); },
  bajo(t, m, dur, vol = 0.32) { this.osc("sawtooth", this.nota(m), t, dur, vol, this.musicBus, { lp: 900, lpTo: 220, q: 6, dec: dur }); },
  bajoRedondo(t, m, dur, vol = 0.4) { this.osc("triangle", this.nota(m), t, dur, vol, this.musicBus, { dec: dur }); },
  pluck(t, m, vol = 0.13, dur = 0.25) { this.osc("triangle", this.nota(m), t, dur, vol, this.musicBus, { dec: dur, rev: 0.4 }); this.osc("square", this.nota(m), t, dur * 0.4, vol * 0.25, this.musicBus, { lp: 3000, dec: dur * 0.4 }); },
  campana(t, m, vol = 0.08, dur = 1.6) { this.osc("sine", this.nota(m), t, dur, vol, this.musicBus, { dec: dur, rev: 0.9 }); this.osc("sine", this.nota(m) * 2.76, t, dur * 0.3, vol * 0.35, this.musicBus, { dec: dur * 0.3, rev: 0.9 }); },
  pad(t, notas, dur, vol = 0.045) { notas.forEach(m => [-8, 8].forEach(dt => this.osc("sawtooth", this.nota(m), t, dur, vol, this.musicBus, { a: 0.6, dec: dur, sus: vol * 0.7, lp: 1100, detune: dt, rev: 0.6 }))); },
  rhodes(t, notas, dur, vol = 0.07) { notas.forEach(m => { this.osc("sine", this.nota(m), t, dur, vol, this.musicBus, { a: 0.01, dec: dur, rev: 0.5 }); this.osc("sine", this.nota(m) * 2, t, 0.2, vol * 0.3, this.musicBus, { dec: 0.2 }); }); },

  /* ---------- Pistas (pasos de semicorchea) ---------- */
  PISTAS: {
    menu: {
      bpm: 112, swing: 0,
      tocar(S2, t, i, d) {
        const bar = Math.floor(i / 16) % 4, k = i % 16;
        const raiz = [57, 53, 48, 55][bar];                 // Am F C G
        const acorde = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]][bar];
        if (k === 0 || k === 8 || k === 10) S2.bombo(t, 0.7);
        if (k === 4 || k === 12) S2.caja(t, 0.25);
        if (k % 2 === 0) S2.hat(t, k % 4 === 2 ? 0.09 : 0.05);
        if ([0, 3, 6, 8, 11, 14].includes(k)) S2.bajo(t, raiz - 24 + (k === 11 ? 12 : 0), d * 1.6, 0.26);
        const mel = [0, 2, 1, 2, 0, 1, 2, 1];
        if ([0, 2, 5, 7, 10, 13].includes(k)) S2.pluck(t, acorde[mel[(k + bar) % 8]] + 12, 0.08);
        if (k === 0 && bar % 2 === 0) S2.pad(t, acorde, d * 30, 0.02);
      }
    },
    misterio: {
      bpm: 76, swing: 0, gain: 1.8,
      tocar(S2, t, i, d) {
        const bar = Math.floor(i / 16) % 4, k = i % 16;
        const acordes = [[45, 52, 60, 64], [41, 48, 57, 64], [43, 50, 59, 62], [40, 47, 56, 64]];
        if (k === 0) S2.pad(t, acordes[bar], d * 16, 0.04);
        if (k === 0) S2.bajoRedondo(t, acordes[bar][0] - 12, d * 14, 0.22);
        const bells = [76, 72, 71, 69, 72, 76, 79, 74];
        if (k === 0 || k === 6 || k === 10) S2.campana(t, bells[(i / 2 + bar) % 8 | 0], 0.045);
        if (k === 8) S2.ruido(t, 0.5, 0.025, S2.musicBus, "bandpass", 600, 2, { a: 0.2, rev: 0.6 });
      }
    },
    tension: {
      bpm: 100, swing: 0,
      tocar(S2, t, i, d) {
        const bar = Math.floor(i / 16) % 8, k = i % 16;
        const raiz = [45, 45, 46, 46, 45, 45, 43, 44][bar];  // A A Bb Bb A A G G#
        if (k === 0 || k === 3) S2.bombo(t, k === 0 ? 0.8 : 0.5);   // latido
        if (k % 2 === 0) S2.bajo(t, raiz - 12, d * 0.9, 0.2);
        if (k % 4 === 2) S2.hat(t, 0.05);
        const ost = [69, 72, 76, 74, 72, 76, 77, 76];
        if (k % 2 === 1 && bar >= 2) S2.pluck(t, ost[(k >> 1) % 8] + (raiz === 46 ? 1 : 0), 0.05, 0.15);
        if (k === 0 && bar % 4 === 0) S2.pad(t, [raiz + 12, raiz + 15, raiz + 19], d * 60, 0.022);
      }
    },
    bar: {
      bpm: 118, swing: 0.32, gain: 2.2,
      tocar(S2, t, i, d) {
        const bar = Math.floor(i / 16) % 4, k = i % 16;
        const raiz = [50, 45, 50, 43][bar];                  // Dm A7 Dm Gm
        const acorde = [[62, 65, 69], [61, 64, 67], [62, 65, 69], [62, 67, 70]][bar];
        if (k === 0 || k === 8) S2.bajoRedondo(t, raiz - 12 + (k === 8 ? 7 : 0), d * 3, 0.38);
        if (k === 4 || k === 12) acorde.forEach(m => S2.pluck(t, m, 0.08, 0.18));
        if (k % 2 === 0) S2.ruido(t, 0.05, k % 4 === 0 ? 0.05 : 0.03, S2.musicBus, "highpass", 6000);
        if (k === 0 || k === 8) S2.bombo(t, 0.6);
        const mel = [74, 72, 69, 70, 69, 67, 65, 64];
        if (bar % 2 === 1 && [0, 3, 6, 10].includes(k)) S2.pluck(t, mel[(k / 2 + bar) % 8 | 0], 0.11, 0.4);
      }
    },
    ajedrez: {   // clave de sol tranquila, estilo clavecín
      bpm: 72, swing: 0, gain: 1.6,
      tocar(S2, t, i, d) {
        const bar = Math.floor(i / 16) % 4, k = i % 16;
        const acordes = [[48, 55, 64, 72], [45, 52, 60, 69], [41, 48, 57, 65], [43, 50, 59, 67]];  // C Am F G
        const a = acordes[bar];
        if (k % 2 === 0) { const arp = [a[0], a[2], a[1], a[2]]; S2.pluck(t, arp[(k / 2) % 4] + 12, 0.05, 0.5); }
        if (k === 0) S2.bajoRedondo(t, a[0] - 12, d * 15, 0.2);
        const mel = [76, 74, 72, 71, 72, 74, 76, 79];
        if ((k === 0 || k === 8) && bar % 2 === 0) S2.campana(t, mel[(bar * 2 + k / 8) % 8], 0.035, 2);
      }
    },
    naval: {     // sonar y redoblante de marcha
      bpm: 92, swing: 0, gain: 1.5,
      tocar(S2, t, i, d) {
        const bar = Math.floor(i / 16) % 4, k = i % 16;
        if (k === 0 && bar % 2 === 0) S2.osc("sine", 1320, t, 1.2, 0.05, S2.musicBus, { dec: 1.2, rev: 1 });   // ping del sonar
        if (k % 4 === 0) S2.bajoRedondo(t, [33, 33, 36, 31][bar], d * 3, 0.3);
        if (k === 4 || k === 12) S2.caja(t, 0.18);
        if (k === 14 || k === 15) S2.caja(t, 0.08);
        if (k === 0) S2.pad(t, [[45, 52, 57], [45, 52, 57], [48, 55, 60], [43, 50, 55]][bar], d * 16, 0.02);
      }
    },
    espacio: {   // ambiente espacial: pulso grave, arpegio lejano
      bpm: 88, swing: 0, gain: 1.7,
      tocar(S2, t, i, d) {
        const bar = Math.floor(i / 16) % 4, k = i % 16;
        if (k === 0) S2.pad(t, [[38, 45, 50], [36, 43, 48], [41, 48, 53], [40, 47, 52]][bar], d * 16, 0.028);
        if (k % 8 === 0) S2.bajoRedondo(t, [26, 24, 29, 28][bar], d * 6, 0.3);
        if (k % 2 === 0) S2.campana(t, [62, 69, 74, 77, 74, 69, 65, 69][(k / 2 + bar) % 8], 0.018, 0.8);
        if (k === 4 || k === 12) S2.hat(t, 0.04);
      }
    },
    noir: {
      bpm: 84, swing: 0.34,
      tocar(S2, t, i, d) {
        const bar = Math.floor(i / 16) % 4, k = i % 16;
        const acordes = [[48, 55, 58, 63], [53, 56, 60, 63], [50, 56, 60, 65], [43, 53, 59, 62]];  // Cm7 Fm7 Dm7b5 G7
        const walk = [[36, 39, 43, 46], [41, 44, 48, 44], [38, 41, 44, 47], [43, 41, 38, 35]][bar];
        if (k % 4 === 0) S2.bajoRedondo(t, walk[k / 4], d * 3.5, 0.34);
        if ([0, 6, 8, 14].includes(k)) S2.hat(t, k % 8 === 6 ? 0.04 : 0.06);
        if (k === 4 || k === 12) S2.escobilla(t, 0.08);
        if (k === 0 || (k === 10 && bar % 2)) S2.rhodes(t, acordes[bar].slice(1).map(m => m + 12), d * 8, 0.04);
        const lead = [[75, 74, 72, 70], [72, 70, 68, 67], [68, 67, 65, 63], [67, 65, 62, 59]][bar];
        if (bar % 2 === 1 && [2, 5, 8, 11].includes(k)) S2.osc("triangle", S2.nota(lead[[2, 5, 8, 11].indexOf(k)]), t, d * 2.5, 0.05, S2.musicBus, { a: 0.04, dec: d * 2.5, rev: 0.7, lp: 1800 });
      }
    }
  },

  programar() {
    if (!this.ctx || !this.pista) return;
    if (!this.musicaOn) { this.proximo = this.ctx.currentTime; return; }
    const P2 = this.PISTAS[this.pista], d = 60 / P2.bpm / 4;
    while (this.proximo < this.ctx.currentTime + 0.15) {
      const t = this.proximo + (this.paso % 2 ? P2.swing * d : 0);
      try { P2.tocar(this, Math.max(t, this.ctx.currentTime), this.paso, d); } catch {}
      this.paso++; this.proximo += d;
    }
  },

  volMusica(nombre) { return this.musicaOn ? 0.5 * ((this.PISTAS[nombre] || {}).gain || 1) : 0; },

  musica(nombre, forzar) {
    this.quiere = nombre;
    if (!this.ctx || (!forzar && nombre === this.pista)) return;
    const c = this.ctx, g = this.musicBus.gain, vol = this.volMusica(nombre);
    g.cancelScheduledValues(c.currentTime);
    g.setTargetAtTime(0, c.currentTime, 0.15);
    setTimeout(() => {
      this.pista = nombre; this.paso = 0; this.proximo = c.currentTime + 0.05;
      g.cancelScheduledValues(c.currentTime); g.setTargetAtTime(vol, c.currentTime, 0.4);
    }, this.pista ? 450 : 0);
  },

  /* ---------- Efectos ---------- */
  sfx(nombre) {
    if (!this.ctx || !this.efectosOn) return;
    const c = this.ctx, t = c.currentTime + 0.01, B = this.sfxBus, n = m => this.nota(m);
    const E = {
      tap: () => this.osc("sine", 880, t, 0.05, 0.12, B, { glide: 600 }),
      pasa: () => this.ruido(t, 0.4, 0.22, B, "bandpass", 400, 1.5, { fTo: 3000, a: 0.1 }),
      revela: () => [76, 83, 88].forEach((m, i) => this.osc("sine", n(m), t + i * 0.07, 0.8, 0.12, B, { rev: 0.8 })),
      malo: () => { [38, 39].forEach(m => this.osc("sawtooth", n(m), t, 1.4, 0.2, B, { lp: 500, dec: 1.4, rev: 0.6 })); this.osc("sine", 70, t, 0.6, 0.6, B, { glide: 35 }); this.osc("square", n(74), t + 0.05, 0.6, 0.05, B, { lp: 1500, glide: n(62), rev: 0.8 }); },
      bien: () => [72, 76, 79, 84].forEach((m, i) => this.osc("triangle", n(m), t + i * 0.09, 0.5, 0.14, B, { rev: 0.5 })),
      mal: () => [67, 66, 65].forEach((m, i) => this.osc("sawtooth", n(m - 12), t + i * 0.28, i === 2 ? 0.9 : 0.26, 0.12, B, { lp: 1200, rev: 0.4 })),
      victoria: () => { [60, 64, 67, 72].forEach((m, i) => this.osc("square", n(m), t + i * 0.12, 0.2, 0.08, B, { lp: 3000 })); [60, 64, 67, 72, 76].forEach(m => this.osc("sawtooth", n(m), t + 0.5, 1.4, 0.05, B, { lp: 2500, a: 0.02, dec: 1.4, rev: 0.6 })); [0, 0.5].forEach(d => this.ruido(t + d, 0.6, 0.15, B, "highpass", 5000, 1, { rev: 0.5 })); },
      derrota: () => [55, 54, 53, 52].forEach((m, i) => this.osc("sawtooth", n(m), t + i * 0.42, i === 3 ? 1.2 : 0.38, 0.13, B, { lp: 900, rev: 0.3, dec: i === 3 ? 1.2 : 0.38 })),
      papel: () => { this.ruido(t, 0.12, 0.18, B, "bandpass", 2500, 0.7); this.ruido(t + 0.08, 0.1, 0.1, B, "bandpass", 4000, 0.7); },
      maquina: () => { for (let i = 0; i < 7; i++) this.ruido(t + i * 0.09 + Math.random() * 0.03, 0.03, 0.25, B, "bandpass", 3000 + Math.random() * 1500, 2); this.osc("sine", 2600, t + 0.75, 0.6, 0.08, B, { rev: 0.4 }); },
      sello: () => { this.osc("sine", 120, t, 0.25, 0.7, B, { glide: 50 }); this.ruido(t, 0.12, 0.35, B, "lowpass", 900); },
      carta: () => this.ruido(t, 0.06, 0.25, B, "bandpass", 3000, 1),
      reparte: () => { for (let i = 0; i < 6; i++) this.ruido(t + i * 0.06, 0.05, 0.2, B, "bandpass", 2800 + i * 120, 1); },
      voltea: () => { for (let i = 0; i < 3; i++) this.ruido(t + i * 0.18, 0.08, 0.25, B, "bandpass", 2200, 1); },
      acusa: () => { this.osc("sawtooth", n(50), t, 0.25, 0.18, B, { lp: 1400 }); this.osc("sawtooth", n(50), t + 0.3, 0.25, 0.18, B, { lp: 1400 }); this.osc("sawtooth", n(53), t + 0.6, 0.9, 0.18, B, { lp: 1400, rev: 0.5 }); },
      giro: () => { for (let i = 0; i < 14; i++) { const tt = t + 0.9 * Math.pow(i / 14, 1.6); this.ruido(tt, 0.02, 0.22, B, "bandpass", 4500, 3); } },
      tic: () => this.osc("square", 1500, t, 0.03, 0.06, B, { lp: 4000 }),
      alarma: () => { for (let i = 0; i < 4; i++) [0, 0.14].forEach(d => this.osc("square", i % 2 ? 1046 : 880, t + i * 0.32 + d, 0.11, 0.1, B, { lp: 3500 })); },
      redoble: () => { for (let i = 0; i < 16; i++) this.ruido(t + i * 0.04, 0.05, 0.08 + i * 0.012, B, "bandpass", 1600, 0.8); },
      bang: () => { this.ruido(t, 0.8, 0.9, B, "lowpass", 3500, 0.7, { fTo: 300, rev: 0.6 }); this.osc("sine", 90, t, 0.4, 0.9, B, { glide: 30 }); },
      clic: () => { this.ruido(t, 0.03, 0.4, B, "bandpass", 3500, 4); this.ruido(t + 0.05, 0.02, 0.2, B, "bandpass", 2500, 4); },
      monedas: () => [84, 88, 91, 96].forEach((m, i) => this.osc("square", n(m), t + i * 0.06, 0.12, 0.06, B, { lp: 5000, rev: 0.3 })),
      logro: () => { [72, 76, 79, 84, 88].forEach((m, i) => this.osc("triangle", n(m), t + i * 0.07, 0.6, 0.1, B, { rev: 0.7 })); this.ruido(t + 0.3, 0.8, 0.08, B, "highpass", 7000, 1, { rev: 0.8 }); },
      pieza: () => { this.osc("triangle", 300, t, 0.06, 0.25, B, { glide: 180 }); this.ruido(t, 0.04, 0.2, B, "bandpass", 1200, 2); },
      jaque: () => [76, 72].forEach((m, i) => this.osc("square", n(m), t + i * 0.12, 0.18, 0.07, B, { lp: 2500 })),
      agua: () => { this.ruido(t, 0.6, 0.35, B, "lowpass", 2500, 1, { fTo: 300, rev: 0.5 }); this.osc("sine", 600, t, 0.25, 0.08, B, { glide: 200 }); },
      tocado: () => { this.ruido(t, 0.7, 0.7, B, "lowpass", 2000, 0.8, { fTo: 200, rev: 0.5 }); this.osc("sine", 80, t, 0.5, 0.7, B, { glide: 35 }); },
      hundido: () => { this.sfx("tocado"); [55, 52, 48, 43].forEach((m, i) => this.osc("sawtooth", n(m), t + 0.3 + i * 0.18, 0.3, 0.08, B, { lp: 1200, rev: 0.5 })); },
      turno: () => { [76, 81, 88].forEach((m, i) => this.osc("triangle", n(m), t + i * 0.11, 0.35, 0.16, B, { rev: 0.5 })); this.osc("sine", n(100), t + 0.33, 0.6, 0.06, B, { rev: 0.8 }); },
      junta: () => { this.osc("triangle", 1200 + Math.random() * 300, t, 0.08, 0.06, B, { glide: 1800 }); },
      hacha: () => { this.osc("triangle", 180, t, 0.09, 0.35, B, { glide: 90 }); this.ruido(t, 0.06, 0.3, B, "bandpass", 900, 1.5); },
      cae: () => { this.ruido(t, 0.5, 0.3, B, "lowpass", 1500, 0.8, { fTo: 200 }); this.osc("sine", 110, t + 0.25, 0.3, 0.5, B, { glide: 50 }); },
      pico: () => { this.osc("square", 1900 + Math.random() * 400, t, 0.05, 0.06, B, { lp: 5000 }); this.ruido(t, 0.05, 0.3, B, "bandpass", 4200, 3); },
      empieza: () => [67, 72].forEach((m, i) => this.osc("triangle", n(m), t + i * 0.1, 0.35, 0.14, B, { rev: 0.4 }))
    };
    (E[nombre] || (() => {}))();
  },

  /* Sonidos que se disparan cuando aparece algo nuevo en pantalla */
  REGLAS: [
    [".role-card.imp", "malo"], [".role-card:not(.imp)", "revela"],
    [".verdict.good", "bien"], [".verdict.bad", "mal"], [".verdict.spc", "bien"],
    [".final-caso.bien", "victoria"], [".final-caso.mal", "derrota"],
    [".pila.abierta", "voltea"], [".acusa", "acusa"], [".tambor.gira", "giro"],
    [".passto .who", "pasa"], [".expediente .exp-t", "maquina"], [".nota.nueva", "papel"],
    [".starter", "empieza"], [".tablero", "pieza"], [".casilla.jaque", "jaque"],
    [".nv-aviso.agua", "agua"], [".nv-aviso.toc", "tocado"], [".nv-aviso.hund", "hundido"],
    [".ch-mesa", "carta"], [".ch-cierre", "voltea"], [".mesa-banner", "reparte"], [".stage .who + .sub + .btn#again", "victoria"]
  ],
  firma() {
    const out = new Set();
    this.REGLAS.forEach(([sel], i) => { const el = app.querySelector(sel); if (el) out.add(i + "|" + (el.dataset.n || el.dataset.k || "") + (el.textContent || "").slice(0, 60)); });
    return out;
  },
  trasRender() {
    this.musica(escenaMusical());
    const ahora = this.firma();
    const tocados = new Set();
    ahora.forEach(k => { if (!this.previo.has(k)) { const s = this.REGLAS[+k.split("|")[0]][1]; if (!tocados.has(s)) { tocados.add(s); this.sfx(s); } } });
    this.previo = ahora;
  },

  alternarMusica() {
    this.musicaOn = !this.musicaOn; store.set("musicaOn", this.musicaOn);
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.volMusica(this.pista), this.ctx.currentTime, 0.2);
    pintarControles();
  },
  alternarEfectos() {
    this.efectosOn = !this.efectosOn; store.set("efectosOn", this.efectosOn);
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(this.efectosOn ? 0.9 : 0, this.ctx.currentTime, 0.05);
    pintarControles();
  }
};

/* Qué pista suena según la pantalla */
function escenaMusical() {
  const sc = S.screen;
  if (sc === "pass" || sc === "reveal") return "misterio";
  if (sc === "play" || sc === "vote") return "tension";
  if (sc === "liars") return "bar";
  if (sc === "casos" || (sc === "casoSel")) return "noir";
  if (sc === "ajedrez" || (sc === "duelo" && S.mode === "ajedrez")) return "ajedrez";
  if (sc === "naval" || (sc === "duelo" && S.mode === "naval")) return "naval";
  if (sc === "chinchon") return "bar";
  if (sc === "trabajo" || sc === "trabajos") return "ajedrez";
  if (sc === "arena") return "tension";
  if (sc === "arenaIntro") return "naval";
  if (sc === "nave" || sc === "naveIntro") return S.nave && S.nave.fase === "reunion" ? "tension" : "espacio";
  if (sc === "online" && UI.v) {
    const v = UI.v;
    if (v.game === "liars") return "bar";
    if (v.game === "casos") return "noir";
    if (v.game === "ajedrez") return "ajedrez";
    if (v.game === "arena") return "tension";
    if (v.game === "naval") return "naval";
    if (v.game === "chinchon") return "bar";
    if (v.game === "nave") return v.fase === "reunion" || v.fase === "expulsion" ? "tension" : "espacio";
    if (v.game === "impostor") return v.phase === "roles" ? "misterio" : v.phase === "end" ? "menu" : "tension";
  }
  return "menu";
}

/* Sonidos que antes estaban en app.js, ahora con el mezclador y el silencio */
beep = (times = 3) => Sonido.sfx(times > 1 ? "alarma" : "empieza");
bang = () => { Sonido.sfx("bang"); try { navigator.vibrate && navigator.vibrate(600); } catch {} };
click = () => Sonido.sfx("clic");

/* Controles flotantes de música y efectos */
const ctlAudio = document.createElement("div");
ctlAudio.className = "audio-ctl";
document.body.appendChild(ctlAudio);
function pintarControles() {
  ctlAudio.innerHTML = `<button id="tgMus" aria-pressed="${Sonido.musicaOn}" aria-label="${Sonido.musicaOn ? "Apagar música" : "Prender música"}" title="Música">
      <svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="3" fill="currentColor"/><circle cx="17.5" cy="16" r="3" fill="currentColor"/>${Sonido.musicaOn ? "" : `<path d="M3 3l18 18" stroke="currentColor" stroke-width="2.4"/>`}</svg></button>
    <button id="tgSfx" aria-pressed="${Sonido.efectosOn}" aria-label="${Sonido.efectosOn ? "Apagar efectos" : "Prender efectos"}" title="Efectos">
      <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${Sonido.efectosOn ? `<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>` : `<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`}</svg></button>`;
  byId("tgMus").onclick = e => { e.stopPropagation(); Sonido.iniciar(); Sonido.alternarMusica(); };
  byId("tgSfx").onclick = e => { e.stopPropagation(); Sonido.iniciar(); Sonido.alternarEfectos(); };
}
pintarControles();

/* El audio solo puede arrancar después de un toque */
["pointerdown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, () => Sonido.iniciar(), { passive: true }));
/* Sonido suave al tocar botones y cartas */
document.addEventListener("click", e => {
  const b = e.target.closest("button, .carta.toca, [role=switch]");
  if (!b || b.closest(".audio-ctl")) return;
  Sonido.sfx(b.classList.contains("carta") ? "carta" : "tap");
});
document.addEventListener("visibilitychange", () => {
  if (!Sonido.ctx) return;
  if (document.visibilityState === "hidden" && !(typeof Net !== "undefined" && Net.activo())) Sonido.ctx.suspend();
  else Sonido.ctx.resume();
});
