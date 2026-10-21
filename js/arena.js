/* Arena: peleas en tiempo real con clases, equipo y ELO.
   - Te mueves como en La Nave y peleas con dos botones: ataque y habilidad especial.
   - 4 clases (Guerrero, Arquero, Mago y Asesino) y 4 piezas de equipo (casco, armadura, botas y arma)
     con los mismos 9 niveles de las herramientas. Todo se compra con monedas.
   - Contra la compu o online: el anfitrión calcula los golpes; cada uno mueve su personaje.
   - Cada pelea cambia tu ELO (ranking de la Arena) y da monedas. */

const AR = {
  W: 1400, H: 1000, R: 20,
  CLASES: {
    guerrero: { nombre: "Guerrero", ic: "🗡️", hp: 160, vel: 205, precio: 0, desc: "Mucha vida y espadazos en abanico.",
      atk: { tipo: "melee", alcance: 82, arco: 2.2, dano: 18, cd: 550 }, esp: { nombre: "Giro", ic: "🌀", cd: 8000, desc: "Gira 3 s con la espada (como Garen): golpea a todos alrededor varias veces y se mueve un poco más rápido." }, arma: ["Espada", "f"] },
    arquero: { nombre: "Arquero", ic: "🏹", hp: 110, vel: 210, precio: 300, desc: "Dispara flechas desde lejos.",
      atk: { tipo: "flecha", vel: 700, dano: 14, cd: 450, alcance: 640 }, esp: { nombre: "Lluvia de flechas", ic: "🎯", cd: 6000, desc: "Cinco flechas en abanico." }, arma: ["Arco", "m"] },
    mago: { nombre: "Mago", ic: "🔮", hp: 100, vel: 195, precio: 400, desc: "Bolas de fuego que explotan en área.",
      atk: { tipo: "bola", vel: 440, dano: 20, cd: 800, area: 58, alcance: 540 }, esp: { nombre: "Nova de hielo", ic: "❄️", cd: 7000, desc: "Congela y daña a todos cerca tuyo." }, arma: ["Bastón", "m"] },
    asesino: { nombre: "Asesino", ic: "🥷", hp: 105, vel: 240, precio: 500, desc: "Rápido, con golpes críticos.",
      atk: { tipo: "melee", alcance: 64, arco: 1.7, dano: 13, cd: 300, crit: 0.25 }, esp: { nombre: "Invisible", ic: "👻", cd: 7000, desc: "Se vuelve invisible 4 s (nadie lo puede apuntar) y su primer golpe hace el doble de daño." }, arma: ["Dagas", "fp"] }
  },
  PIEZAS: { casco: ["Casco", "m", "⛑️"], armadura: ["Armadura", "f", "🦺"], botas: ["Botas", "fp", "🥾"], arma: ["Arma", "f", "⚔️"] },
  COSTO: [0, 120, 250, 450, 750, 1200, 1800, 2600, 3600],
  ESCENARIOS: {
    ring: { nombre: "Ring", ic: "🥊", suelo: "#34406b", linea: "#5a6aa8", lim: { x: 200, y: 140, w: 1000, h: 720 }, obst: [{ x: 200, y: 140, r: 22 }, { x: 1200, y: 140, r: 22 }, { x: 200, y: 860, r: 22 }, { x: 1200, y: 860, r: 22 }], cajas: [], lava: [] },
    coliseo: { nombre: "Coliseo", ic: "🏛️", suelo: "#c9a66b", linea: "#a8834b", circ: { x: 700, y: 500, r: 470 }, obst: Array.from({ length: 6 }, (_, i) => ({ x: 700 + Math.cos(i * Math.PI / 3) * 290, y: 500 + Math.sin(i * Math.PI / 3) * 290, r: 36 })), cajas: [], lava: [] },
    volcan: { nombre: "Volcán", ic: "🌋", suelo: "#3a2a26", linea: "#5a3a2e", lim: { x: 80, y: 80, w: 1240, h: 840 }, obst: [{ x: 420, y: 300, r: 44 }, { x: 980, y: 700, r: 44 }, { x: 700, y: 180, r: 36 }, { x: 700, y: 820, r: 36 }], cajas: [], lava: [{ x: 330, y: 700, r: 90 }, { x: 1070, y: 300, r: 90 }, { x: 700, y: 500, r: 70 }] },
    nave: { nombre: "Nave espacial", ic: "🚀", suelo: "#232a42", linea: "#3a4670", lim: { x: 80, y: 80, w: 1240, h: 840 }, obst: [], cajas: [{ x: 380, y: 260, w: 90, h: 90 }, { x: 930, y: 260, w: 90, h: 90 }, { x: 380, y: 650, w: 90, h: 90 }, { x: 930, y: 650, w: 90, h: 90 }, { x: 655, y: 455, w: 90, h: 90 }], lava: [], rayos: [{ x: 120, y: 470, w: 1160, h: 60 }, { x: 670, y: 120, w: 60, h: 760 }] }
  },
  CPU_ELO: { facil: 900, normal: 1100, dificil: 1300 },
  NOMBRES_CPU: ["Brutus", "Sombra", "Merlina", "Robin", "Tormenta", "Kira", "Goliat"],
  DURA_SUBITA: 90000,
  DANO: 0.4,          // ajuste general del daño (para que las peleas duren)
  FRENO: 0.15         // cuánto frena el hielo y las flechas del Cazador: 15% menos de velocidad
};

const Arena = {
  /* ---------- Personajes: los arma heroes.js (nivel, puntos, evoluciones y equipo de cada clase) ---------- */
  datos(u) { return Heroes.datos(u); },
  elo(u) { return (u && u.stats && u.stats.arena && u.stats.arena.elo) || 1000; },
  miPerfil() { const u = BD.sesion(); return u ? Heroes.perfil(u) : null; },
  validar(p) { return Heroes.validar(p); },

  /* ---------- Mapa ---------- */
  esc: s => AR.ESCENARIOS[s.esc],
  libre(E, x, y, r = AR.R) {
    if (E.lim) { if (x < E.lim.x + r || x > E.lim.x + E.lim.w - r || y < E.lim.y + r || y > E.lim.y + E.lim.h - r) return false; }
    if (E.circ && Math.hypot(x - E.circ.x, y - E.circ.y) > E.circ.r - r) return false;
    for (const o of E.obst) if (Math.hypot(o.x - x, o.y - y) < o.r + r) return false;
    for (const c of E.cajas) if (x > c.x - r && x < c.x + c.w + r && y > c.y - r && y < c.y + c.h + r) return false;
    return true;
  },
  bloquea(E, x, y) { return !this.libre(E, x, y, 2); },
  salidas(E, n) {
    const c = E.circ || { x: 700, y: 500 }, rad = E.circ ? 330 : 300;
    return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + 0.4; let x = c.x + Math.cos(a) * rad, y = c.y + Math.sin(a) * rad * 0.8; for (let k = 0; k < 40 && !this.libre(E, x, y); k++) { x += (c.x - x) * 0.1; y += (c.y - y) * 0.1; } return { x, y }; });
  },

  /* ---------- Partida ---------- */
  setup(jug, cfg) {
    const esc = AR.ESCENARIOS[cfg.esc] ? cfg.esc : "ring", E = AR.ESCENARIOS[esc];
    const pos = this.salidas(E, jug.length);
    return {
      id: "ar-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), esc, online: !!cfg.online, nivelCpu: cfg.nivel || "normal",
      t: 0, fase: "cuenta", inicio: 3000, proy: [], fx: [], pociones: [], prox: 12000, muertes: [], feed: [], sub: false, nP: 0,
      horda: cfg.horda || null,
      mente: cfg.online || typeof Mente === "undefined" ? null : { distRival: Mente.costumbre("arena", "dist", 250) },
      jug: jug.map((j, i) => this.luchador(j, pos[i]))
    };
  },
  luchador(j, pos) {
    const p = this.validar(j.arena), st = Heroes.stats(p);
    if (j.fuerza) { st.hp = Math.round(st.hp * j.fuerza.hp); st.mult *= j.fuerza.dano; }
    return { id: j.id, name: j.name, look: j.look || null, cpu: !!j.cpu, nivel: j.nivel || null, ia: j.ia ?? null, clase: p.clase, eq: st.ver, estilo: st.estilo, evoIc: st.evoIc, evoId: st.evoId, lv: p.lv, pre: p.pre, equipo: j.equipo || null, tam: j.tam || 1, sprite: j.sprite || null,
      elo: j.cpu ? AR.CPU_ELO[j.nivel || "normal"] : p.elo, quema: null,
      x: pos.x, y: pos.y, dx: 1, dy: 0, cara: pos.x < 700 ? 1 : -1, hp: st.hp, max: st.hp, st, vivo: true, cdA: 0, cdE: 0, lento: 0, invul: 0, invis: 0, giro: 0, golpe: -9999, esp: -9999,
      kills: 0, dano: 0, lugar: 0, dElo: 0, monedas: 0, tp: 0, revivio: false };
  },
  /* En la torre los monstruos son un equipo: no se pegan entre ellos */
  aliado: (a, b) => !!(a.equipo && a.equipo === b.equipo),
  vivos: s => s.jug.filter(j => j.vivo),
  objetivo(s, a, alcance) {
    let mejor = null, d0 = Infinity;
    for (const b of s.jug) if (b !== a && b.vivo && !(s.t < b.invis) && !this.aliado(a, b)) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < d0 && d < alcance) { d0 = d; mejor = b; } }
    return mejor;
  },
  /* Apunta al rival más cercano; con proyectiles, adonde va a estar (según cómo se mueve) */
  apuntar(s, a, dx, dy, alcance, vel = 0, manual = false) {
    // Puntería a mano (arrastrando el botón de ataque): va justo adonde apuntó
    if (manual && Math.hypot(dx, dy) > 0.1) { const d = Math.hypot(dx, dy); return { x: dx / d, y: dy / d }; }
    const b = this.objetivo(s, a, alcance);
    if (b) {
      let tx = b.x, ty = b.y;
      if (vel) { const tt = Math.hypot(b.x - a.x, b.y - a.y) / vel; tx += (b.vx || 0) * tt * 0.85; ty += (b.vy || 0) * tt * 0.85; }
      const d = Math.hypot(tx - a.x, ty - a.y) || 1; return { x: (tx - a.x) / d, y: (ty - a.y) / d };
    }
    const d = Math.hypot(dx, dy); return d > 0.1 ? { x: dx / d, y: dy / d } : { x: a.cara, y: 0 };
  },
  pegar(s, a, b, dano, crit, efecto = true) {
    if (!b.vivo || s.t < b.invul || this.aliado(a, b)) return;
    const chance = (a.clase === "asesino" ? AR.CLASES.asesino.atk.crit : 0) + (a.st.crit || 0);
    if (crit || Math.random() < chance) { dano *= a.st.critX || 2; crit = true; }
    // Golpe desde la invisibilidad: doble de daño y se vuelve a ver
    let sorpresa = false;
    if (s.t < a.invis) { dano *= 2; a.invis = 0; sorpresa = true; s.fx.push({ k: ++s.nP, tipo: "humo", x: a.x, y: a.y, t: s.t }); }
    if (a.st.furia && a.hp < a.max * 0.4) dano *= 1 + a.st.furia;
    dano = Math.max(1, Math.round(dano * AR.DANO * a.st.mult * b.st.def));
    // Evoluciones: frenar y quemar
    if (efecto && a.st.lento) b.lento = Math.max(b.lento, s.t + a.st.lento);
    if (efecto && a.st.quema) b.quema = { hasta: s.t + 3000, dps: dano * a.st.quema, de: a.id };
    b.hp -= dano; a.dano += dano; b.hit = s.t;
    if (a.st.robo && a.vivo) a.hp = Math.min(a.max, a.hp + dano * a.st.robo);
    s.fx.push({ k: ++s.nP, tipo: "num", x: b.x, y: b.y - 40, txt: (sorpresa ? "👻" : "") + (crit ? "💥" : "") + "-" + dano, color: crit || sorpresa ? "#ffd43b" : "#ff6b7d", t: s.t });
    if (b.hp <= 0) this.morir(s, b, a);
  },
  morir(s, b, a) {
    if (b.st.revive && !b.revivio) {
      b.revivio = true; b.hp = Math.round(b.max * 0.3); b.invul = s.t + 1200;
      s.fx.push({ k: ++s.nP, tipo: "onda", x: b.x, y: b.y, r: 90, color: "#ffd43b", t: s.t }, { k: ++s.nP, tipo: "num", x: b.x, y: b.y - 50, txt: "🌟 ¡Revive!", color: "#ffd43b", t: s.t });
      return;
    }
    b.hp = 0; b.vivo = false; s.muertes.push(b.id);
    if (a && a !== b) { a.kills++; s.feed.unshift({ t: s.t, txt: `${a.name} ⚔️ ${b.name}` }); }
    else s.feed.unshift({ t: s.t, txt: `☠️ ${b.name} cayó` });
    s.feed = s.feed.slice(0, 4);
    s.fx.push({ k: ++s.nP, tipo: "muerte", x: b.x, y: b.y, t: s.t });
  },
  atacar(s, a, dx, dy, manual = false) {
    if (s.fase !== "pelea" || !a.vivo || s.t < a.cdA || s.t < a.giro) return;
    const C = AR.CLASES[a.clase], A = C.atk;
    a.cdA = s.t + A.cd * a.st.cd; a.golpe = s.t;
    // Los bots anotan desde qué distancia atacás vos, para jugarte en contra
    if (!a.cpu && s.mente && !s.horda) { const r = s.jug.filter(b => b !== a && b.vivo && !this.aliado(a, b)).map(b => Math.hypot(b.x - a.x, b.y - a.y)); if (r.length) Mente.anotar("arena", "dist", Math.min(...r), 0.05); }
    const alc = (A.alcance || 80) * a.st.alc;
    const dir = this.apuntar(s, a, dx, dy, alc + 40, A.tipo === "melee" ? 0 : A.vel, manual);
    a.dx = dir.x; a.dy = dir.y; if (Math.abs(dir.x) > 0.1) a.cara = dir.x < 0 ? -1 : 1;
    if (A.tipo === "melee") {
      for (const b of s.jug) {
        if (b === a || !b.vivo || this.aliado(a, b)) continue;
        const ddx = b.x - a.x, ddy = b.y - a.y, d = Math.hypot(ddx, ddy);
        if (d > alc + AR.R) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, (ddx * dir.x + ddy * dir.y) / (d || 1))));
        if (d < 30 || ang < A.arco / 2) this.pegar(s, a, b, A.dano);
      }
      s.fx.push({ k: ++s.nP, tipo: "tajo", x: a.x, y: a.y, dx: dir.x, dy: dir.y, r: alc, arco: A.arco, color: TR.NIVELES[a.eq.arma].color, t: s.t });
    } else this.disparar(s, a, dir, A);
  },
  disparar(s, a, dir, A, extra = {}) {
    s.proy.push({ k: ++s.nP, tipo: A.tipo, dueno: a.id, x: a.x + dir.x * 26, y: a.y - 10 + dir.y * 26, vx: dir.x * A.vel, vy: dir.y * A.vel, dano: A.dano * (extra.mult || 1), hasta: s.t + (A.alcance * a.st.alc / A.vel) * 1000, area: (A.area || 0) * a.st.area, color: TR.NIVELES[a.eq.arma].color });
  },
  especial(s, a, dx, dy, manual = false) {
    if (s.fase !== "pelea" || !a.vivo || s.t < a.cdE) return;
    const C = AR.CLASES[a.clase];
    a.cdE = s.t + C.esp.cd * a.st.espCd; a.esp = s.t;
    const dir = this.apuntar(s, a, dx, dy, 600, a.clase === "arquero" ? C.atk.vel : 0, manual);
    if (a.clase === "guerrero") {
      // Giro: 3 s girando, cada 0,3 s golpea a todos alrededor (lo hace el reloj en tick)
      a.giro = s.t + 3000; a.giroSig = s.t;
    } else if (a.clase === "arquero") {
      const base = Math.atan2(dir.y, dir.x);
      const n = a.st.flechas || 5, abre = n > 5 ? 0.17 : 0.22;
      for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2; this.disparar(s, a, { x: Math.cos(base + k * abre), y: Math.sin(base + k * abre) }, C.atk); }
    } else if (a.clase === "mago") {
      const r = 175 * a.st.nova;
      for (const b of s.jug) if (b !== a && b.vivo && !this.aliado(a, b) && Math.hypot(b.x - a.x, b.y - a.y) < r) { this.pegar(s, a, b, C.atk.dano * 1.1); b.lento = s.t + 2200; }
      s.fx.push({ k: ++s.nP, tipo: "onda", x: a.x, y: a.y, r, color: "#74c0fc", t: s.t });
    } else if (a.clase === "asesino") {
      a.invis = s.t + 4000;
      s.fx.push({ k: ++s.nP, tipo: "humo", x: a.x, y: a.y, t: s.t });
    }
  },
  saltar(s, a, dir) {
    const E = this.esc(s);
    for (let k = 0; k < 22; k++) { const nx = a.x + dir.x * 10, ny = a.y + dir.y * 10; if (!this.libre(E, nx, ny)) break; a.x = nx; a.y = ny; }
    a.tp++;
  },

  act(s, pid, a) {
    const j = s.jug.find(x => x.id === pid); if (!j) return;
    if (a.t === "pos") {
      if (!j.vivo || s.fase === "fin") return;
      const E = this.esc(s), x = +a.x, y = +a.y;
      if (!isFinite(x) || !isFinite(y) || Math.hypot(x - j.x, y - j.y) > 260 || !this.libre(E, x, y, AR.R - 4)) return;
      j.x = x; j.y = y; j.cara = a.c < 0 ? -1 : 1;
      if (isFinite(+a.dx)) { j.dx = +a.dx; j.dy = +a.dy; }
    } else if (a.t === "atk") this.atacar(s, j, +a.dx || 0, +a.dy || 0, !!a.m);
    else if (a.t === "esp") this.especial(s, j, +a.dx || 0, +a.dy || 0, !!a.m);
  },

  tick(s, dt) {
    const ms = dt * 1000; s.t += ms;
    if (s.fase === "cuenta") { if (s.t >= s.inicio) { s.fase = "pelea"; s.t0 = s.t; } return; }
    if (s.fase !== "pelea") return;
    const E = this.esc(s);
    // Proyectiles
    for (const p of s.proy) {
      const pasos = 3;
      for (let k = 0; k < pasos && !p.fin; k++) {
        p.x += p.vx * dt / pasos; p.y += p.vy * dt / pasos;
        if (this.bloquea(E, p.x, p.y) || s.t > p.hasta) { p.fin = true; break; }
        const cerca = p.area ? 40 : 26;   // las bolas de fuego explotan al pasar cerca
        const due = s.jug.find(j => j.id === p.dueno);
        for (const b of s.jug) if (b.vivo && b.id !== p.dueno && !(due && this.aliado(due, b)) && Math.hypot(b.x - p.x, b.y - 10 - p.y) < cerca) { p.fin = true; break; }
      }
      if (p.fin) {
        const a = s.jug.find(j => j.id === p.dueno);
        if (a) {
          if (p.area) { for (const b of s.jug) if (b !== a && b.vivo && !this.aliado(a, b) && Math.hypot(b.x - p.x, b.y - p.y) < p.area + AR.R) this.pegar(s, a, b, p.dano); s.fx.push({ k: ++s.nP, tipo: "boom", x: p.x, y: p.y, r: p.area, t: s.t }); }
          else { const b = s.jug.find(b => b.vivo && b.id !== p.dueno && !this.aliado(a, b) && Math.hypot(b.x - p.x, b.y - 10 - p.y) < 30); if (b) this.pegar(s, a, b, p.dano); }
        }
      }
    }
    s.proy = s.proy.filter(p => !p.fin);
    // Lava, rayos y muerte súbita
    const rayosOn = E.rayos && (s.t % 7000) > 5000;
    s.rayosOn = !!rayosOn;
    s.sub = s.t - s.t0 > AR.DURA_SUBITA;
    for (const j of s.jug) {
      if (!j.vivo) continue;
      let d = 0;
      for (const l of E.lava) if (Math.hypot(j.x - l.x, j.y - l.y) < l.r) d += 22 * dt;
      if (rayosOn) for (const r of E.rayos) if (j.x > r.x && j.x < r.x + r.w && j.y > r.y && j.y < r.y + r.h) d += 30 * dt;
      if (s.sub) d += 5 * dt;
      if (j.st.regen && j.hp < j.max) j.hp = Math.min(j.max, j.hp + j.max * j.st.regen * dt);
      let quien = null;
      if (j.quema && s.t < j.quema.hasta) { d += j.quema.dps * dt; quien = s.jug.find(x => x.id === j.quema.de) || null; if (quien) quien.dano += j.quema.dps * dt; }
      if (d) { j.hp -= d; if (j.hp <= 0) this.morir(s, j, quien); }
    }
    // Pociones de vida
    if (s.t > s.prox && s.pociones.length < 2) {
      s.prox = s.t + 12000;
      for (let k = 0; k < 30; k++) { const x = 150 + Math.random() * 1100, y = 150 + Math.random() * 700; if (this.libre(E, x, y, 30) && !E.lava.some(l => Math.hypot(x - l.x, y - l.y) < l.r + 30)) { s.pociones.push({ k: ++s.nP, x, y }); break; } }
    }
    s.pociones = s.pociones.filter(p => { const j = s.jug.find(j => j.vivo && Math.hypot(j.x - p.x, j.y - p.y) < 34); if (j) { const c = Math.round(35 * (j.st.pocion || 1)); j.hp = Math.min(j.max, j.hp + c); s.fx.push({ k: ++s.nP, tipo: "num", x: j.x, y: j.y - 40, txt: "+" + c, color: "#3ddcb1", t: s.t }); return false; } return true; });
    // Giro del guerrero: golpea alrededor cada 0,3 s mientras dura
    for (const a of s.jug) {
      if (!a.vivo || !(s.t < a.giro) || s.t < a.giroSig) continue;
      a.giroSig = s.t + 300;
      for (const b of s.jug) if (b !== a && b.vivo && !this.aliado(a, b) && Math.hypot(b.x - a.x, b.y - a.y) < 110) this.pegar(s, a, b, AR.CLASES.guerrero.atk.dano * 0.5, false, false);
    }
    // Compus
    for (const j of s.jug) if (j.cpu && j.vivo) this.cpu(s, j, dt);
    // Velocidad de cada uno (para apuntar a donde van)
    for (const j of s.jug) { if (j.px !== undefined && dt > 0) { j.vx = j.vx * 0.6 + ((j.x - j.px) / dt) * 0.4; j.vy = j.vy * 0.6 + ((j.y - j.py) / dt) * 0.4; } else { j.vx = 0; j.vy = 0; } j.px = j.x; j.py = j.y; }
    s.fx = s.fx.filter(f => s.t - f.t < 1200);
    // ¿Terminó?
    if (s.horda) return Torre.tick(s);
    const vivos = this.vivos(s), humanosVivos = vivos.filter(j => !j.cpu).length;
    if (vivos.length <= 1 || (!s.online && humanosVivos === 0)) this.terminar(s);
  },

  /* Compu: elige a quién atacar, mantiene la distancia que le conviene, esquiva proyectiles y lava, toma pociones
     y usa el especial cuando sirve. Qué tan bien lo hace depende de j.ia (0 a 1), que sale de la dificultad y de lo que
     los bots aprendieron de la persona (Mente): con más nivel apuntan mejor, esquivan más y juegan en contra de tu estilo. */
  cpu(s, j, dt) {
    const E = this.esc(s), C = AR.CLASES[j.clase], h = j.ia ?? ({ facil: 0.25, normal: 0.5, dificil: 0.8 }[j.nivel || "normal"]);
    const ritmo = 0.5 + 0.5 * h, rivales = s.jug.filter(b => b !== j && b.vivo && !this.aliado(j, b) && !(s.t < b.invis));
    if (!rivales.length) return;
    // A quién: los flojos van al más cercano; los buenos prefieren al que tiene poca vida o a la persona
    const puntaje = b => { const d = Math.hypot(b.x - j.x, b.y - j.y); return d * (1 - 0.5 * h * (1 - b.hp / b.max)) * (h > 0.6 && !b.cpu ? 0.85 : 1); };
    if (!j.obj || !rivales.includes(j.obj) || s.t > (j.cambio || 0)) { j.obj = rivales.reduce((a, b) => puntaje(b) < puntaje(a) ? b : a); j.cambio = s.t + 900 + Math.random() * 1200; }
    const b = j.obj;
    const dx = b.x - j.x, dy = b.y - j.y, d = Math.hypot(dx, dy) || 1, ranged = C.atk.tipo !== "melee";
    const alcance = (C.atk.alcance || 80) * j.st.alc + (ranged ? 0 : 10);
    // Distancia que le conviene: contra alguien que pega de lejos, los melee se tiran encima; los de lejos se alejan de los melee
    const rivalLejos = !b.cpu && s.mente ? s.mente.distRival > 230 : AR.CLASES[b.clase].atk.tipo !== "melee";
    const quiero = ranged ? Math.min(alcance * 0.8, (AR.CLASES[b.clase].atk.tipo === "melee" ? 330 : 270) * (0.85 + 0.3 * h)) : C.atk.alcance * 0.7;
    j.lado = j.lado || (Math.random() < 0.5 ? 1 : -1);
    if (Math.random() < 0.005 + 0.01 * h) j.lado *= -1;
    let mx = 0, my = 0;
    if (d > quiero + 20) { mx = dx / d; my = dy / d; }
    else if (ranged && d < quiero - 60) { mx = -dx / d * (0.4 + 0.5 * h); my = -dy / d * (0.4 + 0.5 * h); }
    const zig = ranged ? 0.5 : rivalLejos ? 0.25 + 0.5 * h : 0.5;       // en zigzag para que cueste apuntarle
    mx += -dy / d * zig * j.lado; my += dx / d * zig * j.lado;
    // Esquivar proyectiles que vienen hacia él
    if (h > 0.2) for (const p of s.proy) {
      if (p.dueno === j.id) continue; const due = s.jug.find(x => x.id === p.dueno); if (due && this.aliado(due, j)) continue;
      const rx = j.x - p.x, ry = j.y - p.y, v = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / v, uy = p.vy / v, adelante = rx * ux + ry * uy;
      if (adelante < 0 || adelante > 320) continue;
      const lateral = rx * -uy + ry * ux;
      if (Math.abs(lateral) < 40 && Math.random() < h * 0.9) { const s2 = lateral >= 0 ? 1 : -1; mx += -uy * s2 * 1.6; my += ux * s2 * 1.6; }
    }
    // Con poca vida, los buenos van a buscar una poción
    if (j.hp < j.max * 0.45 && s.pociones.length && h > 0.35) { const P = s.pociones.reduce((a, q) => Math.hypot(q.x - j.x, q.y - j.y) < Math.hypot(a.x - j.x, a.y - j.y) ? q : a); const pd = Math.hypot(P.x - j.x, P.y - j.y) || 1; if (pd < 600) { mx += (P.x - j.x) / pd * 1.4 * h; my += (P.y - j.y) / pd * 1.4 * h; } }
    const m = Math.hypot(mx, my) || 1; mx /= m; my /= m;
    const vel = j.st.vel * ritmo * (s.t < j.lento ? 1 - AR.FRENO : 1) * (s.t < j.giro ? 1.1 : 1);
    let nx = j.x + mx * vel * dt, ny = j.y + my * vel * dt;
    const enLava = (x, y) => E.lava.some(l => Math.hypot(x - l.x, y - l.y) < l.r + 10 + 20 * h) || (s.rayosOn && E.rayos && E.rayos.some(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h));
    if (enLava(nx, ny) && !enLava(j.x, j.y)) { nx = j.x - my * vel * dt * j.lado; ny = j.y + mx * vel * dt * j.lado; }
    if (this.libre(E, nx, j.y)) j.x = nx; else j.lado *= -1;
    if (this.libre(E, j.x, ny)) j.y = ny;
    if (Math.abs(mx) > 0.1) j.cara = mx < 0 ? -1 : 1;
    // Atacar: los flojos fallan la puntería y tardan en reaccionar
    if (d < alcance && Math.random() < 0.1 + 0.35 * h) {
      const err = (1 - h) * 0.5 * (Math.random() - 0.5), ca = Math.cos(err), sa = Math.sin(err);
      this.atacar(s, j, dx * ca - dy * sa, dx * sa + dy * ca);
    }
    // Especial cuando sirve de verdad
    if (s.t > j.cdE && Math.random() < 0.01 + 0.05 * h) {
      const cerca = rivales.filter(x => Math.hypot(x.x - j.x, x.y - j.y) < 130).length;
      const sirve = j.clase === "guerrero" ? cerca >= 1 && (h < 0.5 || cerca >= 2 || b.hp < b.max * 0.6)
        : j.clase === "mago" ? rivales.some(x => Math.hypot(x.x - j.x, x.y - j.y) < 160 * j.st.nova)
        : j.clase === "arquero" ? d < 520 && d > 120
        : d < 420 && d > 160;                                   // asesino: invisible para acercarse por sorpresa
      if (sirve || Math.random() < 0.15 * (1 - h)) this.especial(s, j, dx, dy);
    }
  },

  terminar(s) {
    if (s.fase === "fin") return;
    s.fase = "fin";
    // Lugar: los vivos primero (por vida), después los que cayeron último
    const orden = [...this.vivos(s).sort((a, b) => b.hp - a.hp), ...s.muertes.slice().reverse().map(id => s.jug.find(j => j.id === id))];
    orden.forEach((j, i) => j.lugar = i + 1);
    const n = s.jug.length, K = s.online ? 32 : 20;
    for (const a of s.jug) {
      let d = 0;
      for (const b of s.jug) if (b !== a) { const S = a.lugar < b.lugar ? 1 : a.lugar > b.lugar ? 0 : 0.5, E = 1 / (1 + Math.pow(10, (b.elo - a.elo) / 400)); d += (S - E); }
      // El ELO solo se mueve en peleas online entre personas (contra la compu no cuenta)
      a.dElo = s.online ? Math.round(K * d / Math.max(1, n - 1)) : 0;
      const mult = s.online ? 1.3 : { facil: 0.6, normal: 1, dificil: 1.4 }[s.nivelCpu] || 1;
      a.monedas = Math.min(150, Math.round((8 + a.kills * 4 + (a.lugar === 1 ? 25 : a.lugar === 2 && n > 2 ? 10 : 0)) * mult * Evento.multiplicador() * (1 + (a.st.monedas || 0))));
      const multXp = s.online ? 1.2 : { facil: 0.6, normal: 1, dificil: 1.3 }[s.nivelCpu] || 1;
      a.xp = Math.min(250, Math.round((20 + a.kills * 12 + (a.lugar === 1 ? 30 : a.lugar === 2 && n > 2 ? 12 : 0)) * multXp));
    }
    const yo = s.jug.find(j => !j.cpu);
    if (!s.online && !s.horda && yo && typeof Mente !== "undefined") Mente.resultado("arena", yo.lugar === 1);
  },

  resultado(s, pid) {
    if (!s || s.fase !== "fin" || s.horda) return null;       // la torre reparte sus premios aparte
    const j = s.jug.find(x => x.id === pid); if (!j || j.cpu) return null;
    return { juego: "arena", id: s.id, gano: j.lugar === 1, lugar: j.lugar, n: s.jug.length, kills: j.kills, dElo: j.dElo, monedas: j.monedas, vsCompu: !s.online, clase: j.clase, xp: j.xp | 0 };
  },

  view(s, pid) {
    const yo = s.jug.findIndex(j => j.id === pid);
    return {
      game: "arena", id: s.id, me: pid, yo, esc: s.esc, fase: s.fase, t: s.t, inicio: s.inicio, sub: s.sub, rayosOn: !!s.rayosOn, online: s.online,
      jug: s.jug.map(j => ({ id: j.id, name: j.name, look: j.look, cpu: j.cpu, clase: j.clase, eq: j.eq, estilo: j.estilo, evoIc: j.evoIc, evoId: j.evoId, lv: j.lv, pre: j.pre, tam: j.tam, equipo: j.equipo, sprite: j.sprite, giro: j.giro, xp: j.xp, quema: j.quema && s.t < j.quema.hasta, x: Math.round(j.x), y: Math.round(j.y), cara: j.cara, dx: j.dx, dy: j.dy, hp: Math.ceil(j.hp), max: j.max, vivo: j.vivo,
        golpe: j.golpe, hit: j.hit, esp: j.esp, cdA: j.cdA, cdE: j.cdE, lento: j.lento, invul: j.invul, invis: j.invis, kills: j.kills, lugar: j.lugar, dElo: j.dElo, monedas: j.monedas, elo: j.elo, tp: j.tp, vel: j.st.vel, alc: j.st.alc })),
      proy: s.proy.map(p => ({ k: p.k, tipo: p.tipo, x: Math.round(p.x), y: Math.round(p.y), vx: p.vx, vy: p.vy, color: p.color })),
      fx: s.fx, pociones: s.pociones, feed: s.feed, horda: s.horda ? Torre.vista(s) : null
    };
  },

  /* ---------- Pantalla de pelea (canvas) ---------- */
  img: {},
  imagen(k, svg) { if (!this.img[k]) { const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')); this.img[k] = im; } return this.img[k]; },

  render(v, send, opts) {
    Arena.v = v; Arena.send = send; Arena.opts = opts;
    if (!byId("arCanvas") || !UI.arena || UI.arena.partida !== v.id) Arena.montar();
    Arena.hud();
  },
  montar() {
    document.body.classList.add("en-nave");
    ArenaFX.cargar();
    if (!ArenaPixi.listo) ArenaPixi.cargar();      // queda lista para la próxima pelea
    app.innerHTML = `<div class="nave arena" id="arRoot">
      <canvas id="arCanvas"></canvas>
      <div class="ar-top" id="arTop"></div>
      <div class="ar-feed" id="arFeed"></div>
      <div class="ar-centro" id="arCentro" hidden></div>
      <div class="nv-joy" id="arJoy"><i></i></div>
      <button class="ar-esp" id="arEsp" aria-label="Habilidad especial"><span id="arEspIc"></span><i id="arEspCd"></i></button>
      <button class="md-accion ar-atk" id="arAtk" aria-label="Atacar">⚔️</button>
      <button class="nv-salir" id="arSalir" aria-label="Salir">✕</button>
      <div class="ar-fin" id="arFin" hidden></div>
    </div>`;
    const v = Arena.v, yo = v.jug[v.yo];
    if (ArenaPixi.activo) ArenaPixi.desmontar();
    if (ArenaPixi.listo && ArenaPixi.soporta()) ArenaPixi.montar(byId("arCanvas"));
    UI.arena = { partida: v.id, x: yo ? yo.x : 700, y: yo ? yo.y : 500, tp: yo ? yo.tp : 0, cara: 1, dir: { x: 1, y: 0 }, mov: { x: 0, y: 0 }, teclas: {}, atk: false, ultEnvio: 0, otros: {} };
    Arena.joystick();
    // Si PixiJS todavía se estaba bajando, cuando llega se cambia al dibujo nuevo sin cortar la pelea
    if (!ArenaPixi.activo) ArenaPixi.cargar().then(ok => {
      const cv = byId("arCanvas"); if (!ok || !cv || ArenaPixi.activo || !UI.arena || UI.arena.partida !== v.id) return;
      const nuevo = cv.cloneNode(false); cv.replaceWith(nuevo); if (ArenaPixi.montar(nuevo)) Arena.joystick();
    });
    const boton = (id, fn) => { const b = byId(id); b.onpointerdown = e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} fn(true); }; const f = () => fn(false); b.onpointerup = f; b.onpointercancel = f; b.onlostpointercapture = f; b.oncontextmenu = e => e.preventDefault(); };
    // Ataque: tocar = apunta solo al más cercano; arrastrar el botón = apuntar a mano (se ve una línea)
    const atk = byId("arAtk"); let ini = null;
    atk.onpointerdown = e => { e.preventDefault(); try { atk.setPointerCapture(e.pointerId); } catch {} ini = { x: e.clientX, y: e.clientY }; UI.arena.apunta = null; UI.arena.atk = true; Arena.pulsarAtaque(); };
    atk.onpointermove = e => {
      if (!ini || !UI.arena) return;
      const dx = e.clientX - ini.x, dy = e.clientY - ini.y, d = Math.hypot(dx, dy);
      if (d > 14) { UI.arena.apunta = { x: dx / d, y: dy / d }; UI.arena.ultApunta = { ...UI.arena.apunta, t: performance.now() }; if (Math.abs(dx) > 4) UI.arena.cara = dx < 0 ? -1 : 1; }
    };
    const soltar = () => { ini = null; if (UI.arena) { UI.arena.atk = false; UI.arena.apunta = null; } };
    atk.onpointerup = soltar; atk.onpointercancel = soltar; atk.onlostpointercapture = soltar; atk.oncontextmenu = e => e.preventDefault();
    boton("arEsp", on => { if (on) Arena.usarEspecial(); });
    byId("arSalir").onclick = () => { if (Arena.opts.local) { if (Arena.v.fase === "fin" || confirm("¿Abandonar la pelea?")) { Arena.parar(); go("arenaIntro"); } } else { UI.confirmSalir = true; render(); } };
    if (!Arena.raf) Arena.loop();
  },
  joystick() {
    const joy = byId("arJoy"), pin = joy.querySelector("i"), mov = UI.arena.mov, zona = byId("arCanvas");
    let id = null, cx = 0, cy = 0;
    const empezar = e => { const t = e.changedTouches ? e.changedTouches[0] : e; id = t.identifier ?? "m"; cx = t.clientX; cy = t.clientY; joy.style.left = cx - 60 + "px"; joy.style.top = cy - 60 + "px"; joy.classList.add("on"); mover(e); };
    const mover = e => {
      if (id === null) return;
      const t = e.changedTouches ? [...e.changedTouches].find(x => x.identifier === id) : e; if (!t) return;
      let dx = t.clientX - cx, dy = t.clientY - cy; const d = Math.hypot(dx, dy), max = 50;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      pin.style.transform = `translate(${dx}px, ${dy}px)`; mov.x = dx / max; mov.y = dy / max;
      if (e.cancelable) e.preventDefault();
    };
    const fin = e => { if (e && e.changedTouches && ![...e.changedTouches].some(x => x.identifier === id)) return; id = null; mov.x = 0; mov.y = 0; pin.style.transform = ""; joy.classList.remove("on"); };
    zona.addEventListener("touchstart", empezar, { passive: true }); zona.addEventListener("touchmove", mover, { passive: false });
    zona.addEventListener("touchend", fin); zona.addEventListener("touchcancel", fin);
    zona.addEventListener("mousedown", empezar); window.addEventListener("mousemove", e => { if (id === "m") mover(e); }); window.addEventListener("mouseup", () => { if (id === "m") fin(); });
    if (!Arena.teclasListas) {
      Arena.teclasListas = true;
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      window.addEventListener("keydown", e => {
        if (!UI.arena || !byId("arCanvas") || document.activeElement.tagName === "INPUT") return;
        if (e.key === " ") { UI.arena.atk = true; Arena.pulsarAtaque(); e.preventDefault(); return; }
        if (e.key === "e" || e.key === "Shift") { Arena.usarEspecial(); e.preventDefault(); return; }
        if (map[e.key]) { UI.arena.teclas[e.key] = map[e.key]; e.preventDefault(); }
      });
      window.addEventListener("keyup", e => { if (!UI.arena) return; if (e.key === " ") UI.arena.atk = false; delete UI.arena.teclas[e.key]; });
    }
  },
  parar() { if (ArenaPixi.activo) ArenaPixi.desmontar(); cancelAnimationFrame(Arena.raf); Arena.raf = null; document.body.classList.remove("en-nave"); clearInterval(Arena.reloj); Arena.reloj = null; UI.arena = null; const r = byId("arRoot"); if (r) r.remove(); },
  pulsarAtaque() { const n = UI.arena, v = Arena.v; if (!n || !v || v.fase !== "pelea") return; const yo = v.jug[v.yo]; if (!yo || !yo.vivo || v.t < yo.cdA || v.t < yo.giro) return; const a = n.apunta; Arena.send(a ? { t: "atk", dx: a.x, dy: a.y, m: 1 } : { t: "atk", dx: n.dir.x, dy: n.dir.y }); },
  usarEspecial() {
    const n = UI.arena, v = Arena.v; if (!n || !v || v.fase !== "pelea") return;
    const yo = v.jug[v.yo]; if (!yo || !yo.vivo || v.t < yo.cdE) return;
    // El asesino online salta por su cuenta (cada uno mueve su personaje)
    if (yo.clase === "asesino" && v.online && v.me !== "H") {
      const E = AR.ESCENARIOS[v.esc], b = v.jug.filter(j => j.vivo && j.id !== v.me).sort((p, q) => Math.hypot(p.x - n.x, p.y - n.y) - Math.hypot(q.x - n.x, q.y - n.y))[0];
      let dir = n.dir; if (b && Math.hypot(b.x - n.x, b.y - n.y) < 600) { const d = Math.hypot(b.x - n.x, b.y - n.y) || 1; dir = { x: (b.x - n.x) / d, y: (b.y - n.y) / d }; }
      for (let k = 0; k < 22; k++) { const nx = n.x + dir.x * 10, ny = n.y + dir.y * 10; if (!Arena.libre(E, nx, ny)) break; n.x = nx; n.y = ny; }
    }
    // Si recién apuntó a mano, el especial sale para ese lado (lluvia de flechas, por ejemplo)
    const a = n.apunta || (n.ultApunta && performance.now() - n.ultApunta.t < 1500 ? n.ultApunta : null);
    Arena.send(a ? { t: "esp", dx: a.x, dy: a.y, m: 1 } : { t: "esp", dx: n.dir.x, dy: n.dir.y });
  },

  loop() {
    let prev = performance.now();
    const paso = now => {
      Arena.raf = requestAnimationFrame(paso);
      const cv = byId("arCanvas"); if (!cv || !UI.arena || !Arena.v) { if (!cv) Arena.parar(); return; }
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      Arena.moverYo(dt, now);
      if (ArenaPixi.activo) { try { ArenaPixi.dibujar(now); } catch (e) { if (!Arena.errPixi) { Arena.errPixi = true; console.error(e); } } }
      else dibujarSeguro(cv, () => Arena.dibujar(cv, now));
    };
    Arena.raf = requestAnimationFrame(paso);
  },
  moverYo(dt, now) {
    const v = Arena.v, n = UI.arena, yo = v.jug[v.yo]; if (!yo) return;
    if (yo.tp !== n.tp) { n.x = yo.x; n.y = yo.y; n.tp = yo.tp; }
    if (!yo.vivo || v.fase !== "pelea") return;
    let mx = n.mov.x, my = n.mov.y;
    for (const [dx, dy] of Object.values(n.teclas)) { mx += dx; my += dy; }
    const d = Math.hypot(mx, my); if (d > 1) { mx /= d; my /= d; }
    if (d > 0.05) {
      const E = AR.ESCENARIOS[v.esc], vel = yo.vel * (v.t < yo.lento ? 1 - AR.FRENO : 1) * (v.t < yo.giro ? 1.1 : 1);
      const nx = n.x + mx * vel * dt, ny = n.y + my * vel * dt;
      if (Arena.libre(E, nx, n.y)) n.x = nx; if (Arena.libre(E, n.x, ny)) n.y = ny;
      n.dir = { x: mx / Math.max(d, 0.001), y: my / Math.max(d, 0.001) };
      if (Math.abs(mx) > 0.1) n.cara = mx < 0 ? -1 : 1;
      n.anda = true;
    } else n.anda = false;
    if (n.atk) Arena.pulsarAtaque();
    if (now - n.ultEnvio > 70 && (n.x !== n.ex || n.y !== n.ey || n.cara !== n.ec)) { n.ultEnvio = now; n.ex = n.x; n.ey = n.y; n.ec = n.cara; Arena.send({ t: "pos", x: Math.round(n.x), y: Math.round(n.y), c: n.cara, dx: n.dir.x, dy: n.dir.y }); }
  },

  /* Silueta blanca del personaje (para el destello cuando recibe un golpe) */
  blanco(look) {
    const img = Mundo.muneco(look), k = "b" + (look.color || "") + (look.acc || []).join();
    if (!this.img[k] && img.complete && img.naturalWidth) {
      const c = document.createElement("canvas"); c.width = 120; c.height = 134;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0, 120, 134); x.globalCompositeOperation = "source-in"; x.fillStyle = "#fff"; x.fillRect(0, 0, 120, 134);
      this.img[k] = c;
    }
    return this.img[k];
  },

  /* Personaje con equipo dibujado encima: casco, pechera, botas y arma según el nivel */
  dibujarLuchador(ctx, j, x, y, t, anda, vt) {
    const look = j.look || { color: colorDe(j.name), acc: [] }, img = Mundo.muneco(look);
    const N = k => TR.NIVELES[j.eq[k]];
    const golpeado = j.hit !== undefined && vt - j.hit < 160;
    // Invisible: los demás apenas ven un brillito (sin sombra, nombre ni vida); uno mismo se ve transparente
    const invis = vt < j.invis;
    if (j.sprite) { const h = ArenaFX.monstruo(ctx, j, x, y, t, anda, vt); if (h !== false) { if (j.name) this.nombreVida(ctx, j, x, y + 10 - h); return; } }
    if (invis && !j.esYo) { ctx.save(); ctx.globalAlpha = 0.07 + Math.sin(t * 7) * 0.03; ctx.translate(x, y); if (j.cara < 0) ctx.scale(-1, 1); if (img.complete) ctx.drawImage(img, -30, -46, 60, 67); ctx.restore(); ctx.globalAlpha = 1; return; }
    // Sombra y anillo de la clase
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x, y + 16, 24, 9, 0, 0, 7); ctx.fill();
    if (vt < j.invul || invis) ctx.globalAlpha = invis ? 0.4 : 0.45;
    const fest = j.festeja, salto = fest ? Math.abs(Math.sin(t * 7)) * 22 : anda ? Math.abs(Math.sin(t * 11)) * 4 : Math.sin(t * 3) * 1;
    const temblor = golpeado ? Math.sin(vt / 12) * 4 : 0;
    // Giro del guerrero: la espada da vueltas alrededor
    if (vt < j.giro) {
      const ang = vt / 70, col = TR.NIVELES[j.eq.arma].color;
      ctx.save(); ctx.translate(x, y - 8); ctx.globalAlpha = 0.35; ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, 70, ang, ang + 4.2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.rotate(ang); const g = ctx.createLinearGradient(0, 0, 72, 0); g.addColorStop(0, oscurecer(col, 0.7)); g.addColorStop(0.6, "#fff"); g.addColorStop(1, col);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(18, -4); ctx.lineTo(70, -2); ctx.lineTo(76, 0); ctx.lineTo(70, 2); ctx.lineTo(18, 4); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.translate(x + temblor, y - salto); if (j.tam && j.tam !== 1) ctx.scale(j.tam, j.tam); if (j.cara < 0) ctx.scale(-1, 1);
    // Inclinación al caminar
    if (anda) ctx.rotate(Math.sin(t * 11) * 0.06);
    if (img.complete) ctx.drawImage(img, -30, -46, 60, 67);
    if (golpeado) { const b = this.blanco(look); if (b) { ctx.globalAlpha = 0.85 * (1 - (vt - j.hit) / 160); ctx.drawImage(b, -30, -46, 60, 67); ctx.globalAlpha = invis ? 0.4 : vt < j.invul ? 0.45 : 1; } }
    // Botas
    if (j.eq.botas >= 0) { ctx.fillStyle = N("botas").color; ctx.beginPath(); ctx.roundRect(-17, 9, 14, 9, 3); ctx.roundRect(3, 9, 14, 9, 3); ctx.fill(); ctx.strokeStyle = "#0007"; ctx.lineWidth = 1.2; ctx.stroke(); }
    // Armadura (pechera con brillo)
    if (j.eq.armadura >= 0) {
      const c = N("armadura").color, g = ctx.createLinearGradient(-17, -8, 17, 14); g.addColorStop(0, "#fff8"); g.addColorStop(0.35, c); g.addColorStop(1, oscurecer(c, 0.6));
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-17, -7, 34, 19, 7); ctx.fill(); ctx.strokeStyle = "#0008"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = "#0004"; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 11); ctx.stroke();
    }
    // Casco con visera
    if (j.eq.casco >= 0) {
      const c = N("casco").color, g = ctx.createLinearGradient(0, -48, 0, -24); g.addColorStop(0, "#fff9"); g.addColorStop(0.3, c); g.addColorStop(1, oscurecer(c, 0.65));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -28, 21, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#0008"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = oscurecer(c, 0.55); ctx.beginPath(); ctx.roundRect(-22, -31, 44, 6, 3); ctx.fill();
      if (j.eq.casco >= 4) { ctx.fillStyle = "#ff4d63"; ctx.beginPath(); ctx.moveTo(-3, -49); ctx.quadraticCurveTo(10, -64, 18, -50); ctx.quadraticCurveTo(8, -52, 3, -47); ctx.fill(); }
    }
    // Arma
    const col = N("arma").color, golpe = vt - j.golpe < 250 ? (vt - j.golpe) / 250 : -1;
    ctx.translate(20, -6);
    const est = (j.estilo && j.estilo.arma) || 0, hoja = (largo, ancho) => { const g = ctx.createLinearGradient(-ancho, 0, ancho, 0); g.addColorStop(0, oscurecer(col, 0.7)); g.addColorStop(0.5, "#fff"); g.addColorStop(1, col); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-ancho, -5); ctx.lineTo(-ancho + 1, -4 - largo + 6); ctx.lineTo(0, -5 - largo); ctx.lineTo(ancho - 1, -4 - largo + 6); ctx.lineTo(ancho, -5); ctx.fill(); };
    if (j.clase === "guerrero" || j.clase === "asesino") {
      ctx.rotate(golpe >= 0 ? -1.9 + golpe * 3.0 : -0.5 + Math.sin(t * 3) * 0.05);
      if (j.clase === "guerrero" && est === 1) {
        // Hacha: mango largo y hoja curva
        ctx.fillStyle = "#5c3b1e"; ctx.fillRect(-2.5, -36, 5, 46);
        const g = ctx.createLinearGradient(0, -40, 18, -24); g.addColorStop(0, "#fff"); g.addColorStop(0.4, col); g.addColorStop(1, oscurecer(col, 0.6));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(2, -40); ctx.quadraticCurveTo(24, -38, 20, -18); ctx.quadraticCurveTo(12, -24, 2, -22); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#0007"; ctx.lineWidth = 1.2; ctx.stroke();
      } else if (j.clase === "asesino" && est === 1) {
        // Katana: una sola hoja larga y fina
        ctx.fillStyle = "#1b1726"; ctx.fillRect(-2, -2, 4, 13); ctx.fillStyle = "#c9a227"; ctx.beginPath(); ctx.ellipse(0, -4, 6, 2.5, 0, 0, 7); ctx.fill();
        hoja(42, 2.6);
      } else {
        ctx.fillStyle = "#5c3b1e"; ctx.fillRect(-2.5, -2, 5, 12); ctx.fillStyle = "#c9a227"; ctx.fillRect(-8, -5, 16, 4);
        hoja(j.clase === "guerrero" ? 38 : 22, 4);
        if (j.clase === "asesino") { ctx.translate(-34, 6); ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(0, -24); ctx.lineTo(3, -4); ctx.fill(); }
      }
    } else if (j.clase === "arquero" && est === 1) {
      // Ballesta: culata horizontal con el arco cruzado adelante
      const tens = golpe >= 0 ? Math.max(0, 1 - golpe * 2) : 0.3;
      ctx.fillStyle = "#6b4423"; ctx.beginPath(); ctx.roundRect(-10, -7, 30, 6, 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(14, -4, 13, -1.9 + Math.PI / 2 - 1.2, -1.9 + Math.PI / 2 + 1.2 + Math.PI); ctx.stroke();
      ctx.strokeStyle = "#eee"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14, -17); ctx.lineTo(6 - tens * 8, -4); ctx.lineTo(14, 9); ctx.stroke();
    } else if (j.clase === "arquero") {
      const tens = golpe >= 0 ? Math.max(0, 1 - golpe * 2) : 0.2;
      ctx.strokeStyle = oscurecer(col, 0.8); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -4, 19, -1.3, 1.3); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -4, 19, -1.25, 1.25); ctx.stroke();
      ctx.strokeStyle = "#eee"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.cos(-1.3) * 19, -4 + Math.sin(-1.3) * 19); ctx.lineTo(-tens * 10 + 4, -4); ctx.lineTo(Math.cos(1.3) * 19, -4 + Math.sin(1.3) * 19); ctx.stroke();
    } else if (est === 1) {
      // Varita: corta, con una estrella en la punta
      ctx.rotate(golpe >= 0 ? -0.9 + golpe * 1.2 : -0.35 + Math.sin(t * 3) * 0.06);
      ctx.strokeStyle = "#2b1a3a"; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -16); ctx.stroke(); ctx.lineCap = "butt";
      const r = 5 + (golpe >= 0 ? 4 * (1 - golpe) : Math.sin(t * 5)), g = ctx.createRadialGradient(0, -20, 1, 0, -20, r * 2.4);
      g.addColorStop(0, "#fff"); g.addColorStop(0.35, col); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -20, r * 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); for (let k = 0; k < 10; k++) { const ang = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 2.5 : 6; ctx.lineTo(Math.cos(ang) * rr, -20 + Math.sin(ang) * rr); } ctx.fill();
    } else {
      ctx.strokeStyle = "#6b4423"; ctx.lineWidth = 4.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -30); ctx.stroke(); ctx.lineCap = "butt";
      const r = 7 + (golpe >= 0 ? 4 * (1 - golpe) : Math.sin(t * 4)), g = ctx.createRadialGradient(0, -34, 1, 0, -34, r * 2.2);
      g.addColorStop(0, "#fff"); g.addColorStop(0.35, col); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -34, r * 2.2, 0, 7); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
    if (j.pre >= 10) { ctx.strokeStyle = "#ffd43b"; ctx.globalAlpha = 0.45 + Math.sin(t * 4) * 0.2; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - 14, 42, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    if (j.eq.arma >= 6 || j.eq.armadura >= 6) { ctx.strokeStyle = TR.NIVELES[Math.max(j.eq.arma, j.eq.armadura)].color; ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.15; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 14, 36, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    if (j.quema) { ctx.font = "15px " + FE; ctx.textAlign = "center"; ctx.fillStyle = "#000"; ctx.fillText("🔥", x - 22, y - 44); }
    if (vt < j.lento) { ctx.fillStyle = "rgba(116,192,252,.25)"; ctx.beginPath(); ctx.arc(x, y - 14, 30, 0, 7); ctx.fill(); ctx.font = "16px " + FE; ctx.textAlign = "center"; ctx.fillStyle = "#000"; ctx.fillText("❄️", x + 22, y - 44); }
    if (!j.name) return;
    this.nombreVida(ctx, j, x, y - 68 - ((j.tam || 1) - 1) * 60);
  },

  /* Nombre y barra de vida arriba del luchador (yN = altura del nombre) */
  nombreVida(ctx, j, x, yN) {
    ctx.textAlign = "center"; ctx.font = "bold 13px Figtree, " + FE; ctx.lineWidth = 3.5; ctx.strokeStyle = "#000b";
    const nom = `${j.evoIc || AR.CLASES[j.clase].ic} ${j.name}${j.lv && !j.equipo ? ` · ${j.pre ? HE.PRESTIGIO[j.pre - 1].ic : ""}${j.lv}` : ""}`; ctx.strokeText(nom, x, yN); ctx.fillStyle = "#fff"; ctx.fillText(nom, x, yN);
    const p = Math.max(0, j.hp / j.max), yb = yN + 6;
    ctx.fillStyle = "#000c"; ctx.beginPath(); ctx.roundRect(x - 28, yb, 56, 9, 4.5); ctx.fill();
    ctx.fillStyle = j.equipo === "m" ? (p > 0.5 ? "#ff6b6b" : "#e03131") : p > 0.5 ? "#3ddcb1" : p > 0.25 ? "#ffc53d" : "#ff4d63"; ctx.beginPath(); ctx.roundRect(x - 27, yb + 1, Math.max(3, 54 * p), 7, 3.5); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x - 25, yb + 2, Math.max(0, 50 * p), 2);
  },

  /* Cámara (la usan el dibujo de siempre y el de PixiJS): se aleja o se acerca sola para que veas a tu personaje y al rival más cercano */
  camara(v, n, W, H, now) {
    const yo = v.jug[v.yo];
    const mx = yo ? (yo.vivo ? n.x : yo.x) : 700, my = yo ? (yo.vivo ? n.y : yo.y) : 500;
    const rival = v.jug.filter(j => j.vivo && j.id !== v.me).sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my))[0];
    const escMax = Math.max(0.6, Math.min(1.1, Math.max(W, H) / 1050));
    let escObj = escMax, cx = mx, cy = my;
    if (rival && yo && yo.vivo) {
      const ax = Math.abs(rival.x - mx) + 220, ay = Math.abs(rival.y - my) + 300;
      escObj = Math.max(0.42, Math.min(escMax, W / ax, H / ay));
      cx = mx + (rival.x - mx) * 0.45; cy = my + (rival.y - my) * 0.45;
    }
    n.esc = n.esc ? n.esc + (escObj - n.esc) * 0.06 : escObj;
    const esc = n.esc;
    const objx = Math.max(W / 2 / esc - 200, Math.min(AR.W + 200 - W / 2 / esc, cx)), objy = Math.max(H / 2 / esc - 200, Math.min(AR.H + 200 - H / 2 / esc, cy));
    if (n.camx === undefined) { n.camx = objx; n.camy = objy; }
    n.camx += (objx - n.camx) * 0.12; n.camy += (objy - n.camy) * 0.12;
    if (v.t !== n.vtBase) { n.vtBase = v.t; n.vtLocal = now; }
    const vt = v.t + (v.fase === "pelea" ? Math.min(200, now - (n.vtLocal || now)) : 0);
    // Temblor de pantalla cuando te pegan
    if (yo && yo.hit !== undefined && yo.hit !== n.ultHit) { n.ultHit = yo.hit; if (vt - yo.hit < 300) n.temblor = now + 180; }
    const sh = now < (n.temblor || 0) ? 6 : 0;
    return { yo, esc, vt, sh };
  },
  /* Botón del especial y cuenta regresiva (son HTML, iguales para los dos dibujos) */
  interfaz(v, yo, vt) {
    if (yo) {
      const C = AR.CLASES[yo.clase], falta = Math.max(0, yo.cdE - vt), p = falta / C.esp.cd;
      const cdEl = byId("arEspCd"); if (cdEl) { cdEl.style.height = p * 100 + "%"; byId("arEsp").classList.toggle("listo", falta <= 0 && v.fase === "pelea"); }
    }
    if (v.fase === "cuenta") { const c = byId("arCentro"); if (c) { const num = Math.max(1, Math.ceil((v.inicio - vt) / 1000)); c.hidden = false; if (c.textContent !== String(num)) { c.textContent = num; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); } } }
  },
  /* Animación al caer: se desploma, sale el fantasmita y queda la lápida */
  dibujarCaido(ctx, j, x, y, t, k) {
    if (k < 1) {
      ctx.save(); ctx.globalAlpha = 1 - k * 0.7; ctx.translate(x, y + 10); ctx.rotate((j.cara < 0 ? -1 : 1) * Math.min(1, k * 1.6) * 1.45); ctx.translate(-x, -(y + 10));
      Arena.dibujarLuchador(ctx, { ...j, name: "", hit: undefined, invis: 0, giro: 0, vivo: true }, x, y, t, false, -1e9); ctx.restore();
      const look = j.look || { color: colorDe(j.name || "x"), acc: [] }, b = j.sprite ? ArenaFX.blanco(j.sprite) : this.blanco(look);
      if (b) { ctx.globalAlpha = 0.55 * (1 - k); ctx.drawImage(b, x - 18, y - 60 - k * 70, 36, 40); ctx.globalAlpha = 1; }
    }
    if (k > 0.55) {
      const a = Math.min(1, (k - 0.55) / 0.3), cae = (1 - a) * 30;
      ctx.globalAlpha = a; ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(x, y + 14, 20, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#8a8f98"; ctx.beginPath(); ctx.roundRect(x - 14, y - 20 - cae, 28, 34, [14, 14, 3, 3]); ctx.fill(); ctx.fillStyle = "#5c616b"; ctx.font = "bold 10px Figtree, " + FE; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("RIP", x, y - 4 - cae); ctx.globalAlpha = 1;
    }
  },
  /* Hace cuánto cayó (0 a 1 durante la animación) */
  caida(n, j, now) { n.cayo = n.cayo || {}; if (!n.cayo[j.id]) n.cayo[j.id] = now; return Math.min(1, (now - n.cayo[j.id]) / 1100); },
  /* ¿Festeja? El ganador de la pelea (o los que pasaron el piso de la torre) */
  festeja(v, j) { return v.fase === "fin" && j.vivo && (v.horda ? v.horda.gano && j.equipo === "h" : j.lugar === 1); },
  /* Decoración fija de cada escenario (público, grietas, estrellas…) */
  decoracion(esc) {
    this.deco = this.deco || {};
    if (this.deco[esc]) return this.deco[esc];
    const r = azarDe("arena-" + esc), d = { publico: [], grietas: [], estrellas: [], manchas: [] };
    const colores = ["#ff6b6b", "#4dabf7", "#51cf66", "#fcc419", "#cc5de8", "#ff922b", "#20c997", "#f06595", "#e8e8e8"];
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2, rad = 560 + r() * 260;
      d.publico.push({ x: 700 + Math.cos(a) * rad * 1.15, y: 500 + Math.sin(a) * rad * 0.95, c: colores[Math.floor(r() * colores.length)], f: r() * 7 });
    }
    for (let i = 0; i < 26; i++) { let x = 100 + r() * 1200, y = 100 + r() * 800; const pts = [[x, y]]; for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 90; y += (r() - 0.5) * 90; pts.push([x, y]); } d.grietas.push(pts); }
    for (let i = 0; i < 160; i++) d.estrellas.push({ x: -300 + r() * 2000, y: -300 + r() * 1600, s: r() * 2 + 0.5, f: r() * 7 });
    for (let i = 0; i < 80; i++) d.manchas.push({ x: 100 + r() * 1200, y: 100 + r() * 800, r: 3 + r() * 10, a: 0.04 + r() * 0.06 });
    return (this.deco[esc] = d);
  },

  /* Partículas solo visuales (polvo, chispas, brasas) */
  particula(n, x, y, vx, vy, vida, color, tam = 4, grav = 0) { n.part.push({ x, y, vx, vy, t0: performance.now(), vida, color, tam, grav }); if (n.part.length > 260) n.part.shift(); },

  dibujar(cv, now) {
    const v = Arena.v, n = UI.arena, E = AR.ESCENARIOS[v.esc], D = Arena.decoracion(v.esc), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d"), t = now / 1000;
    n.part = n.part || []; n.vistos = n.vistos || new Set();
    const { yo, esc, vt, sh } = Arena.camara(v, n, W, H, now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    // Fondo de cada escenario
    const fondo = { ring: ["#1a1730", "#08070d"], coliseo: ["#3a2a1a", "#120c08"], volcan: ["#3a120a", "#0a0405"], nave: ["#0b1030", "#020309"] }[v.esc];
    const gf = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H)); gf.addColorStop(0, fondo[0]); gf.addColorStop(1, fondo[1]);
    ctx.fillStyle = gf; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2 + (Math.random() - 0.5) * sh, H / 2 + (Math.random() - 0.5) * sh); ctx.scale(esc, esc); ctx.translate(-n.camx, -n.camy);
    if (v.esc === "nave") D.estrellas.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(t * 2 + s.f) * 0.3})`; ctx.fillRect(s.x, s.y, s.s, s.s); });
    if (v.esc === "ring" || v.esc === "coliseo") D.publico.forEach(p => { const salta = Math.max(0, Math.sin(t * 6 + p.f)) * 5; ctx.fillStyle = p.c; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(p.x, p.y - salta, 13, Math.PI, 0); ctx.fill(); ctx.fillRect(p.x - 13, p.y - salta, 26, 10); ctx.globalAlpha = 1; });
    // Piso
    if (E.circ) {
      const c = E.circ;
      ctx.fillStyle = "#6b5232"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 40, 0, 7); ctx.fill();
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ctx.fillStyle = i % 2 ? "#7c6040" : "#5c4428"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 40, a, a + Math.PI / 24 * 2); ctx.lineTo(c.x, c.y); ctx.fill(); }
      const g = ctx.createRadialGradient(c.x, c.y, 40, c.x, c.y, c.r); g.addColorStop(0, "#e2c48e"); g.addColorStop(1, "#b8955c");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
      D.manchas.forEach(m => { if (Math.hypot(m.x - c.x, m.y - c.y) < c.r - 20) { ctx.fillStyle = `rgba(90,60,20,${m.a})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill(); } });
      ctx.strokeStyle = "rgba(90,60,20,.25)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, 120, 0, 7); ctx.stroke();
    } else {
      const l = E.lim;
      if (v.esc === "ring") {
        ctx.fillStyle = "#151226"; ctx.fillRect(l.x - 60, l.y - 60, l.w + 120, l.h + 120);
        const g = ctx.createRadialGradient(700, 500, 60, 700, 500, 620); g.addColorStop(0, "#4a5ab8"); g.addColorStop(1, "#283163");
        ctx.fillStyle = g; ctx.fillRect(l.x, l.y, l.w, l.h);
        ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(700, 500, 130, 0, 7); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.font = "bold 110px 'Dela Gothic One', Figtree, " + FE; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("MESA LOCA", 700, 500);
      } else if (v.esc === "volcan") {
        ctx.fillStyle = "#2a1c18"; ctx.fillRect(l.x, l.y, l.w, l.h);
        D.manchas.forEach(m => { ctx.fillStyle = `rgba(0,0,0,${m.a * 2})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 3, 0, 7); ctx.fill(); });
        ctx.lineCap = "round"; D.grietas.forEach((g, i) => { ctx.strokeStyle = `rgba(255,${90 + Math.sin(t * 2 + i) * 40},0,${0.35 + Math.sin(t * 2 + i) * 0.15})`; ctx.lineWidth = 3; ctx.beginPath(); g.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }); ctx.lineCap = "butt";
        ctx.strokeStyle = "#120b09"; ctx.lineWidth = 18; ctx.strokeRect(l.x, l.y, l.w, l.h);
      } else {
        ctx.fillStyle = "#2b3352"; ctx.fillRect(l.x, l.y, l.w, l.h);
        for (let x = l.x; x < l.x + l.w; x += 80) for (let y = l.y; y < l.y + l.h; y += 80) {
          ctx.fillStyle = (x + y) % 160 ? "#303a5c" : "#2a3254"; ctx.fillRect(x + 2, y + 2, 76, 76);
          ctx.fillStyle = "#4b5680"; [[8, 8], [70, 8], [8, 70], [70, 70]].forEach(([a, b]) => ctx.fillRect(x + a, y + b, 3, 3));
        }
        ctx.strokeStyle = "#5a6aa8"; ctx.lineWidth = 10; ctx.strokeRect(l.x, l.y, l.w, l.h);
        ctx.strokeStyle = "rgba(116,192,252,.35)"; ctx.lineWidth = 2; ctx.strokeRect(l.x + 8, l.y + 8, l.w - 16, l.h - 16);
      }
    }
    // Lava burbujeando
    E.lava.forEach((l, i) => {
      ctx.fillStyle = "#3a0d06"; ctx.beginPath(); ctx.arc(l.x, l.y, l.r + 10, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, l.r); g.addColorStop(0, "#fff3a0"); g.addColorStop(0.35, "#ffb02e"); g.addColorStop(0.75, "#ff5a00"); g.addColorStop(1, "#b3200c");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, l.r + Math.sin(t * 2 + l.x) * 3, 0, 7); ctx.fill();
      for (let k = 0; k < 4; k++) { const ph = (t * 0.7 + k * 0.25 + i * 0.13) % 1, a = k * 1.7 + i; ctx.strokeStyle = `rgba(255,240,180,${0.7 * (1 - ph)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(l.x + Math.cos(a) * l.r * 0.5, l.y + Math.sin(a) * l.r * 0.5, 3 + ph * 9, 0, 7); ctx.stroke(); }
      if (Math.random() < 0.08) Arena.particula(n, l.x + (Math.random() - 0.5) * l.r, l.y + (Math.random() - 0.5) * l.r, (Math.random() - 0.5) * 20, -40 - Math.random() * 60, 1400, "#ffb02e", 3);
    });
    // Rayos de la nave (con aviso amarillo antes de prenderse)
    if (E.rayos) E.rayos.forEach(r => {
      const aviso = (vt % 7000) > 4000 && !v.rayosOn;
      if (aviso || v.rayosOn) { ctx.fillStyle = v.rayosOn ? `rgba(116,192,252,${0.45 + Math.sin(t * 30) * 0.2})` : "rgba(255,212,59,.12)"; ctx.fillRect(r.x, r.y, r.w, r.h); }
      ctx.strokeStyle = aviso ? "#ffd43b" : "rgba(116,192,252,.4)"; ctx.setLineDash([16, 12]); ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
      if (v.rayosOn) { ctx.strokeStyle = "#e7f5ff"; ctx.lineWidth = 2; ctx.beginPath(); const hor = r.w > r.h; for (let k = 0; k <= 20; k++) { const p = k / 20, x = hor ? r.x + r.w * p : r.x + r.w / 2 + (Math.random() - 0.5) * r.w, y = hor ? r.y + r.h / 2 + (Math.random() - 0.5) * r.h : r.y + r.h * p; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    });
    // Postes, columnas, rocas y cajas
    E.obst.forEach(o => {
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(o.x, o.y + 12, o.r * 1.1, o.r * 0.45, 0, 0, 7); ctx.fill();
      if (v.esc === "ring") { ctx.fillStyle = "#c9cbe0"; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill(); ctx.fillStyle = "#ff4d63"; ctx.beginPath(); ctx.arc(o.x, o.y - 4, o.r * 0.7, 0, 7); ctx.fill(); }
      else if (v.esc === "coliseo") { const g = ctx.createLinearGradient(o.x - o.r, 0, o.x + o.r, 0); g.addColorStop(0, "#b8ab8c"); g.addColorStop(0.5, "#f2e8cf"); g.addColorStop(1, "#9c8f70"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill(); ctx.strokeStyle = "#7c705a"; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.6, 0, 7); ctx.stroke(); }
      else { const g = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.4, 4, o.x, o.y, o.r); g.addColorStop(0, "#7a6a64"); g.addColorStop(1, "#3a2e2a"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(o.x - o.r, o.y + 4); ctx.lineTo(o.x - o.r * 0.6, o.y - o.r * 0.8); ctx.lineTo(o.x + o.r * 0.3, o.y - o.r); ctx.lineTo(o.x + o.r, o.y - o.r * 0.2); ctx.lineTo(o.x + o.r * 0.8, o.y + o.r * 0.6); ctx.lineTo(o.x - o.r * 0.5, o.y + o.r * 0.7); ctx.fill(); }
    });
    E.cajas.forEach(c => {
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(c.x + 8, c.y + 10, c.w, c.h);
      const g = ctx.createLinearGradient(c.x, c.y, c.x + c.w, c.y + c.h); g.addColorStop(0, "#7a86b8"); g.addColorStop(1, "#46507a");
      ctx.fillStyle = g; ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = "#ffd43b"; for (let k = 0; k < 4; k++) { ctx.save(); ctx.beginPath(); ctx.rect(c.x, c.y + c.h - 14, c.w, 10); ctx.clip(); ctx.fillRect(c.x + k * 28 - 10, c.y + c.h - 14, 12, 10); ctx.restore(); }
      ctx.strokeStyle = "#2b3150"; ctx.lineWidth = 3; ctx.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
    });
    // Cuerdas del ring (adelante y atrás)
    if (v.esc === "ring") { const l = E.lim; [0, 10, 20].forEach((o, i) => { ctx.strokeStyle = ["#ff4d63", "#ffffff", "#4dabf7"][i]; ctx.lineWidth = 5; ctx.strokeRect(l.x - o, l.y - o, l.w + o * 2, l.h + o * 2); }); }
    // Pociones
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    v.pociones.forEach(p => { const b = Math.sin(t * 3 + p.k) * 4; ctx.fillStyle = "rgba(61,220,177,.25)"; ctx.beginPath(); ctx.arc(p.x, p.y, 22 + Math.sin(t * 4) * 3, 0, 7); ctx.fill(); ctx.font = "30px " + FE; ctx.fillStyle = "#000"; ctx.fillText("🧪", p.x, p.y + b); });
    // Luchadores (los otros interpolados), ordenados por altura
    const lista = v.jug.map(j => {
      const o = n.otros[j.id] = n.otros[j.id] || { x: j.x, y: j.y };
      const esYo = j.id === v.me && j.vivo;
      const ox = o.x, oy = o.y;
      if (esYo) { o.x = n.x; o.y = n.y; } else { o.x += (j.x - o.x) * 0.3; o.y += (j.y - o.y) * 0.3; }
      const anda = esYo ? n.anda : Math.hypot(o.x - ox, o.y - oy) > 0.6;
      if (anda && j.vivo && (esYo || !(vt < j.invis)) && Math.random() < 0.18) Arena.particula(n, o.x + (Math.random() - 0.5) * 16, o.y + 16, (Math.random() - 0.5) * 30, -20, 450, v.esc === "coliseo" ? "rgba(160,120,70,.6)" : "rgba(200,200,220,.35)", 5);
      return { j, o, esYo, anda };
    }).sort((a, b) => a.o.y - b.o.y);
    lista.forEach(({ j, o, esYo, anda }) => {
      if (!j.vivo) { Arena.dibujarCaido(ctx, j, o.x, o.y, t, Arena.caida(n, j, now)); return; }
      if (esYo) { ctx.strokeStyle = "#3ddcb1"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(o.x, o.y + 16, 28, 11, 0, 0, 7); ctx.stroke(); }
      if (esYo && n.apunta) {
        // Línea de puntería
        const A = AR.CLASES[j.clase].atk, largo = Math.min(520, (A.alcance || 80) * (j.alc || 1)), ax = o.x + n.apunta.x * 30, ay = o.y - 10 + n.apunta.y * 30;
        ctx.save(); ctx.setLineDash([10, 8]); ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,212,59,.85)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + n.apunta.x * largo, ay + n.apunta.y * largo); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,212,59,.9)"; ctx.beginPath(); ctx.arc(ax + n.apunta.x * largo, ay + n.apunta.y * largo, 7, 0, 7); ctx.fill(); ctx.restore();
      }
      Arena.dibujarLuchador(ctx, { ...j, cara: esYo ? n.cara : j.cara, esYo, festeja: Arena.festeja(v, j) }, o.x, o.y, t, anda, vt);
    });
    // Proyectiles con estela
    const dtv = Math.min(0.2, (now - (n.vtLocal || now)) / 1000);
    v.proy.forEach(p => {
      const x = p.x + p.vx * dtv, y = p.y + p.vy * dtv, a = Math.atan2(p.vy, p.vx);
      ArenaFX.proyectil(ctx, n, p, x, y, a);
      if (p.tipo === "flecha") {
        ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 46, y - Math.sin(a) * 46); ctx.lineTo(x, y); ctx.stroke();
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = "#e9dcc0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.fill(); ctx.fillStyle = "#ff4d63"; ctx.fillRect(-22, -4, 6, 3); ctx.fillRect(-22, 1, 6, 3); ctx.restore();
      } else {
        for (let k = 3; k >= 1; k--) { ctx.fillStyle = `rgba(255,${120 + k * 20},0,${0.18})`; ctx.beginPath(); ctx.arc(x - Math.cos(a) * k * 12, y - Math.sin(a) * k * 12, 14 - k * 2, 0, 7); ctx.fill(); }
        const g = ctx.createRadialGradient(x, y, 2, x, y, 18); g.addColorStop(0, "#fff"); g.addColorStop(0.4, "#ffb02e"); g.addColorStop(1, "rgba(255,80,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.fill();
        if (Math.random() < 0.5) Arena.particula(n, x, y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 350, "#ffb02e", 4);
      }
    });
    // Efectos del anfitrión (golpes, ondas, explosiones) + chispas la primera vez que se ven
    v.fx.forEach(f => {
      if (!n.vistos.has(f.k)) {
        n.vistos.add(f.k);
        const chispas = (c, k, vel) => { for (let i = 0; i < k; i++) { const a = Math.random() * 7, s = vel * (0.4 + Math.random()); Arena.particula(n, f.x, f.y, Math.cos(a) * s, Math.sin(a) * s - 40, 600, c, 4 + Math.random() * 3, 300); } };
        if (f.tipo === "num") chispas(f.color === "#3ddcb1" ? "#3ddcb1" : "#ffd43b", 8, 160);
        if (f.tipo === "boom") chispas("#ff8c00", 22, 260);
        if (f.tipo === "muerte") chispas("#ffffff", 26, 300);
        if (f.tipo === "onda") chispas(f.color, 18, 260);
        ArenaFX.evento(n, f);
      }
      const k = Math.max(0, (vt - f.t) / 500); if (k > 1 && f.tipo !== "num") return;
      if (f.tipo === "tajo") {
        const a = Math.atan2(f.dy, f.dx); ctx.globalAlpha = 1 - k;
        for (let i = 0; i < 3; i++) { ctx.strokeStyle = i ? "rgba(255,255,255,.5)" : f.color; ctx.lineWidth = 10 - i * 3; ctx.beginPath(); ctx.arc(f.x, f.y - 10, f.r * (0.7 + i * 0.12), a - f.arco / 2 * (0.6 + k * 0.4), a + f.arco / 2 * (0.6 + k * 0.4)); ctx.stroke(); }
      } else if (f.tipo === "onda") { ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 12 * (1 - k) + 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + 0.7 * k), 0, 7); ctx.stroke(); ctx.fillStyle = f.color; ctx.globalAlpha = 0.15 * (1 - k); ctx.fill(); }
      else if (f.tipo === "boom") { const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r * (0.6 + k)); g.addColorStop(0, `rgba(255,255,220,${1 - k})`); g.addColorStop(0.5, `rgba(255,140,0,${0.7 * (1 - k)})`); g.addColorStop(1, "rgba(255,60,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + k), 0, 7); ctx.fill(); }
      else if (f.tipo === "humo") { ctx.fillStyle = `rgba(80,70,110,${0.6 * (1 - k)})`; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(f.x + Math.cos(i * 1.3) * 20 * (1 + k), f.y + Math.sin(i * 1.3) * 14 * (1 + k), 18 + k * 16, 0, 7); ctx.fill(); } }
      else if (f.tipo === "num") { const kk = (vt - f.t) / 1000; if (kk > 1) return; const esc2 = kk < 0.15 ? 0.6 + kk / 0.15 * 0.6 : 1.2 - kk * 0.2; ctx.globalAlpha = 1 - Math.max(0, kk - 0.5) * 2; ctx.save(); ctx.translate(f.x, f.y - kk * 50); ctx.scale(esc2, esc2); ctx.font = "900 24px Figtree, " + FE; ctx.lineWidth = 5; ctx.strokeStyle = "#000c"; ctx.strokeText(f.txt, 0, 0); ctx.fillStyle = f.color; ctx.fillText(f.txt, 0, 0); ctx.restore(); }
      ctx.globalAlpha = 1;
    });
    if (n.vistos.size > 400) n.vistos = new Set([...n.vistos].slice(-200));
    // Partículas
    n.part = n.part.filter(p => now - p.t0 < p.vida);
    n.part.forEach(p => { const k = (now - p.t0) / 1000, vida = (now - p.t0) / p.vida; ctx.globalAlpha = 1 - vida; ctx.fillStyle = p.color; const s = p.tam * (1 - vida * 0.5); ctx.fillRect(p.x + p.vx * k - s / 2, p.y + p.vy * k + p.grav * k * k - s / 2, s, s); });
    ctx.globalAlpha = 1;
    ArenaFX.dibujar(ctx, n, now);
    ctx.restore();
    // Flechas en el borde para los rivales que quedan fuera de la pantalla
    v.jug.forEach(j => {
      if (!j.vivo || j.id === v.me) return;
      const o = n.otros[j.id] || j, sx = (o.x - n.camx) * esc + W / 2, sy = (o.y - 20 - n.camy) * esc + H / 2, m = 34;
      if (sx > m && sx < W - m && sy > m + 50 && sy < H - m - 90) return;
      const ex = Math.max(m, Math.min(W - m, sx)), ey = Math.max(m + 50, Math.min(H - m - 90, sy)), ang = Math.atan2(sy - H / 2, sx - W / 2);
      ctx.save(); ctx.translate(ex, ey);
      ctx.fillStyle = "rgba(20,17,32,.85)"; ctx.strokeStyle = "#ff4d63"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = "18px " + FE; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#000"; ctx.fillText(j.evoIc || AR.CLASES[j.clase].ic, 0, 1);
      ctx.rotate(ang); ctx.fillStyle = "#ff4d63"; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(20, -8); ctx.lineTo(20, 8); ctx.fill();
      ctx.restore();
    });
    // Luz del escenario y viñeta
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, v.esc === "volcan" ? "rgba(60,8,0,.55)" : "rgba(0,0,0,.5)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (v.sub) { ctx.fillStyle = `rgba(255,0,40,${0.12 + Math.sin(t * 4) * 0.06})`; ctx.fillRect(0, 0, W, H); }
    if (yo && yo.vivo && yo.hp / yo.max < 0.3) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, "rgba(255,0,40,0)"); g.addColorStop(1, `rgba(255,0,40,${0.25 + Math.sin(t * 6) * 0.1})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    Arena.interfaz(v, yo, vt);
  },

  hud() {
    const v = Arena.v, yo = v.jug[v.yo];
    const top = byId("arTop"); if (!top) return;
    top.innerHTML = v.horda ? Torre.barra(v) : v.jug.map(j => `<span class="ar-chip ${j.vivo ? "" : "fuera"} ${j.id === v.me ? "yo" : ""}">${j.evoIc || AR.CLASES[j.clase].ic}<b>${esc(j.name)}</b><i style="width:${Math.max(0, j.hp / j.max) * 100}%"></i></span>`).join("");
    byId("arFeed").innerHTML = v.feed.map(f => `<span>${esc(f.txt)}</span>`).join("") + (v.sub ? `<span class="sub">🔥 ¡Muerte súbita!</span>` : "");
    if (yo) byId("arEspIc").textContent = AR.CLASES[yo.clase].esp.ic;
    const c = byId("arCentro");
    if (v.fase === "pelea" && c && !c.hidden && c.textContent !== "¡YA!") { c.textContent = "¡YA!"; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); setTimeout(() => { if (Arena.v && Arena.v.fase === "pelea") c.hidden = true; }, 700); }
    const fin = byId("arFin");
    if (v.fase === "fin" && fin && fin.hidden && v.horda) { fin.hidden = false; Torre.fin(v, fin); }
    if (v.fase === "fin" && fin && fin.hidden) {
      fin.hidden = false;
      const orden = v.jug.slice().sort((a, b) => a.lugar - b.lugar);
      const mio = yo && !yo.cpu ? yo : null;
      Sonido.sfx(mio && mio.lugar === 1 ? "victoria" : "derrota");
      fin.innerHTML = `<div class="ar-fin-caja">
        <h2>${mio ? (mio.lugar === 1 ? "🏆 ¡Ganaste!" : `Quedaste ${mio.lugar}°`) : "Fin de la pelea"}</h2>
        ${mio ? `<div class="tr-premio">${v.online ? `<div><b>${mio.dElo >= 0 ? "+" : ""}${mio.dElo}</b><small>ELO</small></div>` : ""}<div><b>+${mio.monedas}</b><small>monedas</small></div><div><b>+${mio.xp || 0}</b><small>XP de ${esc(AR.CLASES[mio.clase].nombre)}</small></div><div><b>${mio.kills}</b><small>eliminaciones</small></div></div>` : ""}
        <ol class="ar-tabla">${orden.map(j => `<li class="${j.id === v.me ? "yo" : ""}"><span>${j.lugar}°</span><b>${j.evoIc || AR.CLASES[j.clase].ic} ${esc(j.name)}${j.lv ? ` <small>Nv ${j.lv}</small>` : ""}</b><small>${j.kills} ⚔️${v.online ? ` · ${j.dElo >= 0 ? "+" : ""}${j.dElo} ELO` : ""}</small></li>`).join("")}</ol>
        ${!Arena.opts.local ? Heroes.selector() : ""}
        <div class="row">${Arena.opts.local || v.isHost ? `<button class="btn" id="arOtra">Otra pelea</button>` : `<p class="sub">El anfitrión elige si juegan otra.</p>`}<button class="btn ghost" id="arVolver">${Arena.opts.local ? "Armería" : v.isHost ? "Volver a la sala" : "Salir"}</button></div></div>`;
      on("arOtra", () => Arena.send({ t: "again" }));
      Heroes.conectarSelector(fin);
      on("arVolver", () => { if (Arena.opts.local) { Arena.parar(); go("arenaIntro"); } else if (v.isHost) Arena.send({ t: "lobby" }); else { UI.confirmSalir = true; render(); } });
    }
    if (v.fase !== "fin" && fin && !fin.hidden) fin.hidden = true;
  },

  /* ---------- Contra la compu ---------- */
  empezarLocal(modo, nivel, esc) {
    if (!ArenaPixi.listo || !ArenaPixi.imgsListas) { if (ArenaPixi.quiere() && !Arena.preparando) { Arena.preparando = true; return ArenaPixi.preparar(() => { Arena.preparando = false; Arena.empezarLocal(modo, nivel, esc); }); } }
    const u = BD.sesion(), yo = this.miPerfil() || Heroes.validar(null);
    const base = { facil: yo.lv - 4, normal: yo.lv, dificil: yo.lv + 3 }[nivel];
    const cpus = modo === "duelo" ? 1 : 3;
    const nombres = AR.NOMBRES_CPU.slice().sort(() => Math.random() - 0.5);
    const jug = [{ id: "yo", name: u ? u.nombre : "Tú", look: u ? u.look : null, arena: yo }];
    for (let i = 0; i < cpus; i++) {
      const lv = Math.max(1, Math.min(HE.MAX, Math.round(base + (Math.random() - 0.5) * 3)));
      jug.push({ id: "cpu" + i, name: "🤖 " + nombres[i], cpu: true, nivel, ia: typeof Mente !== "undefined" ? Mente.habilidad("arena", nivel) : null, look: { color: COLORES[(i * 3 + 2) % COLORES.length], acc: [] }, arena: Heroes.cpu(lv, yo.pre) });
    }
    S.arena = this.setup(jug, { esc, nivel });
    S.arenaCfg = { modo, nivel, esc };
    clearInterval(Arena.reloj);
    let prev = Date.now();
    Arena.reloj = setInterval(() => {
      const s = S.arena; if (!s || S.screen !== "arena") { clearInterval(Arena.reloj); Arena.reloj = null; return; }
      const ahora = Date.now(); Arena.tick(s, (ahora - prev) / 1000); prev = ahora;
      Arena.render(Arena.view(s, "yo"), Arena.enviarLocal, { local: true });
      if (s.fase === "fin" && !s.contada) { s.contada = true; Cuenta.revisar(); }
    }, 50);
    go("arena");
  },

  /* ---------- Online (el anfitrión calcula todo a 20 por segundo) ---------- */
  empezarOn(R) {
    const jug = R.players.filter(p => p.on);
    if (jug.length < 2) return "Hacen falta al menos 2 jugadores.";
    if (jug.length > 8) return "La arena es de hasta 8 jugadores.";
    R.arena = Arena.setup(jug.map(p => ({ id: p.id, name: p.name, look: p.look, arena: p.id === "H" ? Arena.miPerfil() : p.arena })), { esc: S.arenaEsc || "ring", online: true });
    R.game = "arena";
    Arena.relojHost(R);
    return null;
  },
  relojHost(R) {
    clearInterval(Arena.relojOn);
    let prev = Date.now(), n = 0;
    Arena.relojOn = setInterval(() => {
      if (!Net.R || Net.R.game !== "arena" || !Net.R.arena) { clearInterval(Arena.relojOn); Arena.relojOn = null; return; }
      const ahora = Date.now(); Arena.tick(Net.R.arena, (ahora - prev) / 1000); prev = ahora;
      if (++n % 2 === 0 || Net.R.arena.fase !== "pelea") Net.broadcast();
    }, 50);
  },
  actOn(R, pid, a) {
    if (a.t === "torreSeguir" && pid === "H") return Torre.seguirOn(R);
    if (a.t === "again" && R.arena && R.arena.horda) return;
    if (a.t === "again" && pid === "H") { const e = Arena.empezarOn(R); R.err = e || ""; return; }
    if (a.t === "lobby" && pid === "H") { R.game = null; R.arena = null; return; }
    Arena.act(R.arena, pid, a);
  }
};

PANTALLAS.arena = () => {
  const s = S.arena; if (!s) return go("arenaIntro");
  Arena.render(Arena.view(s, "yo"), Arena.enviarLocal, { local: true });
};
/* Pelea en este teléfono: las acciones van directo a la partida local.
   (Arena.send es "a dónde mando ahora" y lo pisa cada render; la pelea local siempre pasa esta función.) */
Arena.enviarLocal = a => {
  const s = S.arena;
  if (!s) return;
  if (a.t === "again") { Arena.parar(); const c = S.arenaCfg; return Arena.empezarLocal(c.modo, c.nivel, c.esc); }
  Arena.act(s, "yo", a);
};
