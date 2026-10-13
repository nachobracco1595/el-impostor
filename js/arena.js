/* Arena: peleas en tiempo real con clases, equipo y ELO.
   - Te mueves como en La Nave y peleas con dos botones: ataque y habilidad especial.
   - 4 clases (Guerrero, Arquero, Mago y Asesino) y 4 piezas de equipo (casco, armadura, botas y arma)
     con los mismos 9 niveles de las herramientas. Todo se compra con monedas.
   - Contra la compu o online: el anfitrión calcula los golpes; cada uno mueve su personaje.
   - Cada pelea cambia tu ELO (ranking de la Arena) y da monedas. */

const AR = {
  W: 1400, H: 1000, R: 20,
  CLASES: {
    guerrero: { nombre: "Guerrero", ic: "🗡️", hp: 160, vel: 190, precio: 0, desc: "Mucha vida y espadazos en abanico.",
      atk: { tipo: "melee", alcance: 82, arco: 2.2, dano: 18, cd: 550 }, esp: { nombre: "Giro", ic: "🌀", cd: 6000, desc: "Gira la espada y golpea a todos alrededor." }, arma: ["Espada", "f"] },
    arquero: { nombre: "Arquero", ic: "🏹", hp: 110, vel: 210, precio: 300, desc: "Dispara flechas desde lejos.",
      atk: { tipo: "flecha", vel: 700, dano: 14, cd: 450, alcance: 640 }, esp: { nombre: "Lluvia de flechas", ic: "🎯", cd: 6000, desc: "Cinco flechas en abanico." }, arma: ["Arco", "m"] },
    mago: { nombre: "Mago", ic: "🔮", hp: 100, vel: 195, precio: 400, desc: "Bolas de fuego que explotan en área.",
      atk: { tipo: "bola", vel: 440, dano: 20, cd: 800, area: 58, alcance: 540 }, esp: { nombre: "Nova de hielo", ic: "❄️", cd: 7000, desc: "Congela y daña a todos cerca tuyo." }, arma: ["Bastón", "m"] },
    asesino: { nombre: "Asesino", ic: "🥷", hp: 105, vel: 240, precio: 500, desc: "Rápido, con golpes críticos.",
      atk: { tipo: "melee", alcance: 64, arco: 1.7, dano: 13, cd: 300, crit: 0.25 }, esp: { nombre: "Paso sombra", ic: "💨", cd: 5000, desc: "Salta hacia adelante, invulnerable, y el próximo golpe es crítico." }, arma: ["Dagas", "fp"] }
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
  DANO: 0.4           // ajuste general del daño (para que las peleas duren)
};

const Arena = {
  /* ---------- Equipo guardado en el perfil (u.diario.arena) ---------- */
  datos(u) {
    Eco.completar(u);
    const a = u.diario.arena = Object.assign({ clase: "guerrero", clases: ["guerrero"], eq: {} }, u.diario.arena || {});
    a.eq = Object.assign({ casco: 0, armadura: 0, botas: 0, arma: 0 }, a.eq);
    if (!a.clases.includes(a.clase)) a.clase = "guerrero";
    return a;
  },
  elo(u) { return (u && u.stats && u.stats.arena && u.stats.arena.elo) || 1000; },
  miPerfil() {
    const u = BD.sesion(); if (!u) return null;
    const a = this.datos(u);
    return { clase: a.clase, eq: { ...a.eq }, elo: this.elo(u) };
  },
  validar(p) {
    const ok = p && typeof p === "object";
    const n = v => Math.max(0, Math.min(8, v | 0));
    return {
      clase: ok && AR.CLASES[p.clase] ? p.clase : "guerrero",
      eq: { casco: n(ok && p.eq && p.eq.casco), armadura: n(ok && p.eq && p.eq.armadura), botas: n(ok && p.eq && p.eq.botas), arma: n(ok && p.eq && p.eq.arma) },
      elo: Math.max(0, Math.min(4000, ok ? (p.elo | 0) || 1000 : 1000))
    };
  },
  nombrePieza(pieza, clase, n) {
    const [nom, gen] = pieza === "arma" ? AR.CLASES[clase].arma : AR.PIEZAS[pieza], N = TR.NIVELES[n];
    let sufijo = gen === "m" ? N.m : N.f;
    if (N.id === "encantado") sufijo = { m: "encantado", f: "encantada", fp: "encantadas" }[gen];
    return `${nom} ${sufijo}`;
  },
  stats(clase, eq) {
    const C = AR.CLASES[clase];
    return {
      hp: Math.round(C.hp + eq.armadura * 9 + eq.casco * 5),
      vel: C.vel * (1 + eq.botas * 0.035),
      mult: 1 + eq.arma * 0.12,
      def: 1 - Math.min(0.55, eq.casco * 0.025 + eq.armadura * 0.04)
    };
  },
  comprarClase(c) {
    const u = BD.sesion(); if (!u) return;
    const a = this.datos(u), C = AR.CLASES[c];
    if (a.clases.includes(c) || u.monedas < C.precio) return;
    u.monedas -= C.precio; a.clases.push(c); a.clase = c;
    Eco.guardar(u); if (u.nube) Nube.actividad("compra", "arena", 0, -C.precio);
    Sonido.sfx("logro"); render();
  },
  mejorar(pieza) {
    const u = BD.sesion(); if (!u) return;
    const a = this.datos(u), n = a.eq[pieza];
    if (n >= 8 || u.monedas < AR.COSTO[n + 1]) return;
    u.monedas -= AR.COSTO[n + 1]; a.eq[pieza] = n + 1;
    Eco.guardar(u); if (u.nube) Nube.actividad("compra", "arena", 0, -AR.COSTO[n + 1]);
    Sonido.sfx(n + 1 === 8 ? "logro" : "monedas");
    Toast.mostrar(`<div class="t-ic">${AR.PIEZAS[pieza][2]}</div><div class="t-txt"><small>Equipo mejorado</small><b>${esc(this.nombrePieza(pieza, a.clase, n + 1))}</b></div>`, "logro");
    render();
  },

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
      jug: jug.map((j, i) => {
        const p = this.validar(j.arena), st = this.stats(p.clase, p.eq);
        return { id: j.id, name: j.name, look: j.look || null, cpu: !!j.cpu, nivel: j.nivel || null, clase: p.clase, eq: p.eq, elo: j.cpu ? AR.CPU_ELO[j.nivel || "normal"] : p.elo,
          x: pos[i].x, y: pos[i].y, dx: 1, dy: 0, cara: pos[i].x < 700 ? 1 : -1, hp: st.hp, max: st.hp, st, vivo: true, cdA: 0, cdE: 0, lento: 0, invul: 0, critSig: false, golpe: -9999, esp: -9999,
          kills: 0, dano: 0, lugar: 0, dElo: 0, monedas: 0, tp: 0 };
      })
    };
  },
  vivos: s => s.jug.filter(j => j.vivo),
  objetivo(s, a, alcance) {
    let mejor = null, d0 = Infinity;
    for (const b of s.jug) if (b !== a && b.vivo) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < d0 && d < alcance) { d0 = d; mejor = b; } }
    return mejor;
  },
  /* Apunta al rival más cercano; con proyectiles, adonde va a estar (según cómo se mueve) */
  apuntar(s, a, dx, dy, alcance, vel = 0) {
    const b = this.objetivo(s, a, alcance);
    if (b) {
      let tx = b.x, ty = b.y;
      if (vel) { const tt = Math.hypot(b.x - a.x, b.y - a.y) / vel; tx += (b.vx || 0) * tt * 0.85; ty += (b.vy || 0) * tt * 0.85; }
      const d = Math.hypot(tx - a.x, ty - a.y) || 1; return { x: (tx - a.x) / d, y: (ty - a.y) / d };
    }
    const d = Math.hypot(dx, dy); return d > 0.1 ? { x: dx / d, y: dy / d } : { x: a.cara, y: 0 };
  },
  pegar(s, a, b, dano, crit) {
    if (!b.vivo || s.t < b.invul) return;
    if (a.clase === "asesino" && (crit || a.critSig || Math.random() < AR.CLASES.asesino.atk.crit)) { dano *= 2; crit = true; a.critSig = false; }
    dano = Math.max(1, Math.round(dano * AR.DANO * a.st.mult * b.st.def));
    b.hp -= dano; a.dano += dano;
    s.fx.push({ k: ++s.nP, tipo: "num", x: b.x, y: b.y - 40, txt: (crit ? "💥" : "") + "-" + dano, color: crit ? "#ffd43b" : "#ff6b7d", t: s.t });
    if (b.hp <= 0) this.morir(s, b, a);
  },
  morir(s, b, a) {
    b.hp = 0; b.vivo = false; s.muertes.push(b.id);
    if (a && a !== b) { a.kills++; s.feed.unshift({ t: s.t, txt: `${a.name} ⚔️ ${b.name}` }); }
    else s.feed.unshift({ t: s.t, txt: `☠️ ${b.name} cayó` });
    s.feed = s.feed.slice(0, 4);
    s.fx.push({ k: ++s.nP, tipo: "muerte", x: b.x, y: b.y, t: s.t });
  },
  atacar(s, a, dx, dy) {
    if (s.fase !== "pelea" || !a.vivo || s.t < a.cdA) return;
    const C = AR.CLASES[a.clase], A = C.atk;
    a.cdA = s.t + A.cd; a.golpe = s.t;
    const dir = this.apuntar(s, a, dx, dy, (A.alcance || 80) + 40, A.tipo === "melee" ? 0 : A.vel);
    a.dx = dir.x; a.dy = dir.y; if (Math.abs(dir.x) > 0.1) a.cara = dir.x < 0 ? -1 : 1;
    if (A.tipo === "melee") {
      for (const b of s.jug) {
        if (b === a || !b.vivo) continue;
        const ddx = b.x - a.x, ddy = b.y - a.y, d = Math.hypot(ddx, ddy);
        if (d > A.alcance + AR.R) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, (ddx * dir.x + ddy * dir.y) / (d || 1))));
        if (d < 30 || ang < A.arco / 2) this.pegar(s, a, b, A.dano);
      }
      s.fx.push({ k: ++s.nP, tipo: "tajo", x: a.x, y: a.y, dx: dir.x, dy: dir.y, r: A.alcance, arco: A.arco, color: TR.NIVELES[a.eq.arma].color, t: s.t });
    } else this.disparar(s, a, dir, A);
  },
  disparar(s, a, dir, A, extra = {}) {
    s.proy.push({ k: ++s.nP, tipo: A.tipo, dueno: a.id, x: a.x + dir.x * 26, y: a.y - 10 + dir.y * 26, vx: dir.x * A.vel, vy: dir.y * A.vel, dano: A.dano * (extra.mult || 1), hasta: s.t + (A.alcance / A.vel) * 1000, area: A.area || 0, color: TR.NIVELES[a.eq.arma].color });
  },
  especial(s, a, dx, dy) {
    if (s.fase !== "pelea" || !a.vivo || s.t < a.cdE) return;
    const C = AR.CLASES[a.clase];
    a.cdE = s.t + C.esp.cd; a.esp = s.t;
    const dir = this.apuntar(s, a, dx, dy, 600, a.clase === "arquero" ? C.atk.vel : 0);
    if (a.clase === "guerrero") {
      for (const b of s.jug) if (b !== a && b.vivo && Math.hypot(b.x - a.x, b.y - a.y) < 120) this.pegar(s, a, b, C.atk.dano * 1.6);
      s.fx.push({ k: ++s.nP, tipo: "onda", x: a.x, y: a.y, r: 120, color: "#ffd43b", t: s.t });
    } else if (a.clase === "arquero") {
      const base = Math.atan2(dir.y, dir.x);
      for (let i = -2; i <= 2; i++) this.disparar(s, a, { x: Math.cos(base + i * 0.22), y: Math.sin(base + i * 0.22) }, C.atk);
    } else if (a.clase === "mago") {
      for (const b of s.jug) if (b !== a && b.vivo && Math.hypot(b.x - a.x, b.y - a.y) < 175) { this.pegar(s, a, b, C.atk.dano * 1.1); b.lento = s.t + 2200; }
      s.fx.push({ k: ++s.nP, tipo: "onda", x: a.x, y: a.y, r: 175, color: "#74c0fc", t: s.t });
    } else if (a.clase === "asesino") {
      a.invul = s.t + 450; a.critSig = true;
      if (a.cpu || !s.online || a.id === "H") this.saltar(s, a, dir);   // los jugadores online se mueven solos (ver Arena.local)
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
    } else if (a.t === "atk") this.atacar(s, j, +a.dx || 0, +a.dy || 0);
    else if (a.t === "esp") this.especial(s, j, +a.dx || 0, +a.dy || 0);
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
        for (const b of s.jug) if (b.vivo && b.id !== p.dueno && Math.hypot(b.x - p.x, b.y - 10 - p.y) < cerca) { p.fin = true; break; }
      }
      if (p.fin) {
        const a = s.jug.find(j => j.id === p.dueno);
        if (a) {
          if (p.area) { for (const b of s.jug) if (b !== a && b.vivo && Math.hypot(b.x - p.x, b.y - p.y) < p.area + AR.R) this.pegar(s, a, b, p.dano); s.fx.push({ k: ++s.nP, tipo: "boom", x: p.x, y: p.y, r: p.area, t: s.t }); }
          else { const b = s.jug.find(b => b.vivo && b.id !== p.dueno && Math.hypot(b.x - p.x, b.y - 10 - p.y) < 30); if (b) this.pegar(s, a, b, p.dano); }
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
      if (d) { j.hp -= d; if (j.hp <= 0) this.morir(s, j, null); }
    }
    // Pociones de vida
    if (s.t > s.prox && s.pociones.length < 2) {
      s.prox = s.t + 12000;
      for (let k = 0; k < 30; k++) { const x = 150 + Math.random() * 1100, y = 150 + Math.random() * 700; if (this.libre(E, x, y, 30) && !E.lava.some(l => Math.hypot(x - l.x, y - l.y) < l.r + 30)) { s.pociones.push({ k: ++s.nP, x, y }); break; } }
    }
    s.pociones = s.pociones.filter(p => { const j = s.jug.find(j => j.vivo && Math.hypot(j.x - p.x, j.y - p.y) < 34); if (j) { j.hp = Math.min(j.max, j.hp + 35); s.fx.push({ k: ++s.nP, tipo: "num", x: j.x, y: j.y - 40, txt: "+35", color: "#3ddcb1", t: s.t }); return false; } return true; });
    // Compus
    for (const j of s.jug) if (j.cpu && j.vivo) this.cpu(s, j, dt);
    // Velocidad de cada uno (para apuntar a donde van)
    for (const j of s.jug) { if (j.px !== undefined && dt > 0) { j.vx = j.vx * 0.6 + ((j.x - j.px) / dt) * 0.4; j.vy = j.vy * 0.6 + ((j.y - j.py) / dt) * 0.4; } else { j.vx = 0; j.vy = 0; } j.px = j.x; j.py = j.y; }
    s.fx = s.fx.filter(f => s.t - f.t < 1200);
    // ¿Terminó?
    const vivos = this.vivos(s), humanosVivos = vivos.filter(j => !j.cpu).length;
    if (vivos.length <= 1 || (!s.online && humanosVivos === 0)) this.terminar(s);
  },

  /* Compu: busca al más cercano, mantiene distancia según su clase, esquiva la lava y ataca */
  cpu(s, j, dt) {
    const E = this.esc(s), C = AR.CLASES[j.clase], ritmo = { facil: 0.55, normal: 0.85, dificil: 1 }[j.nivel || "normal"];
    const b = this.objetivo(s, j, 3000); if (!b) return;
    const dx = b.x - j.x, dy = b.y - j.y, d = Math.hypot(dx, dy) || 1;
    const lejos = C.atk.tipo === "melee" ? C.atk.alcance * 0.7 : 330;
    j.giro = j.giro || (Math.random() < 0.5 ? 1 : -1);
    if (Math.random() < 0.005) j.giro *= -1;
    let mx = 0, my = 0;
    if (d > lejos + 20) { mx = dx / d; my = dy / d; }
    else if (d < lejos - 60 && C.atk.tipo !== "melee") { mx = -dx / d; my = -dy / d; }
    mx += -dy / d * 0.5 * j.giro; my += dx / d * 0.5 * j.giro;
    const m = Math.hypot(mx, my) || 1; mx /= m; my /= m;
    const vel = j.st.vel * ritmo * (s.t < j.lento ? 0.5 : 1);
    let nx = j.x + mx * vel * dt, ny = j.y + my * vel * dt;
    const enLava = (x, y) => E.lava.some(l => Math.hypot(x - l.x, y - l.y) < l.r + 10) || (s.rayosOn && E.rayos && E.rayos.some(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h));
    if (enLava(nx, ny) && !enLava(j.x, j.y)) { nx = j.x - my * vel * dt * j.giro; ny = j.y + mx * vel * dt * j.giro; }
    if (this.libre(E, nx, j.y)) j.x = nx; else j.giro *= -1;
    if (this.libre(E, j.x, ny)) j.y = ny;
    if (Math.abs(mx) > 0.1) j.cara = mx < 0 ? -1 : 1;
    const alcance = (C.atk.alcance || 80) + (C.atk.tipo === "melee" ? 10 : 0);
    if (d < alcance && Math.random() < ritmo * 0.3) this.atacar(s, j, dx, dy);
    if (s.t > j.cdE && Math.random() < ritmo * 0.02 && d < (j.clase === "arquero" ? 500 : j.clase === "asesino" ? 260 : 150)) this.especial(s, j, dx, dy);
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
      a.dElo = Math.round(K * d / Math.max(1, n - 1));
      const mult = s.online ? 1.3 : { facil: 0.6, normal: 1, dificil: 1.4 }[s.nivelCpu] || 1;
      a.monedas = Math.min(120, Math.round((8 + a.kills * 4 + (a.lugar === 1 ? 25 : a.lugar === 2 && n > 2 ? 10 : 0)) * mult * Evento.multiplicador()));
    }
  },

  resultado(s, pid) {
    if (!s || s.fase !== "fin") return null;
    const j = s.jug.find(x => x.id === pid); if (!j || j.cpu) return null;
    return { juego: "arena", id: s.id, gano: j.lugar === 1, lugar: j.lugar, n: s.jug.length, kills: j.kills, dElo: j.dElo, monedas: j.monedas, vsCompu: !s.online };
  },

  view(s, pid) {
    const yo = s.jug.findIndex(j => j.id === pid);
    return {
      game: "arena", me: pid, yo, esc: s.esc, fase: s.fase, t: s.t, inicio: s.inicio, sub: s.sub, rayosOn: !!s.rayosOn, online: s.online,
      jug: s.jug.map(j => ({ id: j.id, name: j.name, look: j.look, cpu: j.cpu, clase: j.clase, eq: j.eq, x: Math.round(j.x), y: Math.round(j.y), cara: j.cara, dx: j.dx, dy: j.dy, hp: Math.ceil(j.hp), max: j.max, vivo: j.vivo,
        golpe: j.golpe, esp: j.esp, cdA: j.cdA, cdE: j.cdE, lento: j.lento, invul: j.invul, kills: j.kills, lugar: j.lugar, dElo: j.dElo, monedas: j.monedas, elo: j.elo, tp: j.tp, vel: j.st.vel })),
      proy: s.proy.map(p => ({ k: p.k, tipo: p.tipo, x: Math.round(p.x), y: Math.round(p.y), vx: p.vx, vy: p.vy, color: p.color })),
      fx: s.fx, pociones: s.pociones, feed: s.feed
    };
  },

  /* ---------- Pantalla de pelea (canvas) ---------- */
  img: {},
  imagen(k, svg) { if (!this.img[k]) { const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')); this.img[k] = im; } return this.img[k]; },

  render(v, send, opts) {
    Arena.v = v; Arena.send = send; Arena.opts = opts;
    if (!byId("arCanvas")) Arena.montar();
    Arena.hud();
  },
  montar() {
    document.body.classList.add("en-nave");
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
    UI.arena = { x: yo ? yo.x : 700, y: yo ? yo.y : 500, tp: yo ? yo.tp : 0, cara: 1, dir: { x: 1, y: 0 }, mov: { x: 0, y: 0 }, teclas: {}, atk: false, ultEnvio: 0, otros: {} };
    Arena.joystick();
    const boton = (id, fn) => { const b = byId(id); b.onpointerdown = e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} fn(true); }; const f = () => fn(false); b.onpointerup = f; b.onpointercancel = f; b.onlostpointercapture = f; b.oncontextmenu = e => e.preventDefault(); };
    boton("arAtk", on => { UI.arena.atk = on; if (on) Arena.pulsarAtaque(); });
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
  parar() { cancelAnimationFrame(Arena.raf); Arena.raf = null; document.body.classList.remove("en-nave"); clearInterval(Arena.reloj); Arena.reloj = null; UI.arena = null; },
  pulsarAtaque() { const n = UI.arena, v = Arena.v; if (!n || !v || v.fase !== "pelea") return; const yo = v.jug[v.yo]; if (!yo || !yo.vivo || v.t < yo.cdA) return; Arena.send({ t: "atk", dx: n.dir.x, dy: n.dir.y }); },
  usarEspecial() {
    const n = UI.arena, v = Arena.v; if (!n || !v || v.fase !== "pelea") return;
    const yo = v.jug[v.yo]; if (!yo || !yo.vivo || v.t < yo.cdE) return;
    // El asesino online salta por su cuenta (cada uno mueve su personaje)
    if (yo.clase === "asesino" && v.online && v.me !== "H") {
      const E = AR.ESCENARIOS[v.esc], b = v.jug.filter(j => j.vivo && j.id !== v.me).sort((p, q) => Math.hypot(p.x - n.x, p.y - n.y) - Math.hypot(q.x - n.x, q.y - n.y))[0];
      let dir = n.dir; if (b && Math.hypot(b.x - n.x, b.y - n.y) < 600) { const d = Math.hypot(b.x - n.x, b.y - n.y) || 1; dir = { x: (b.x - n.x) / d, y: (b.y - n.y) / d }; }
      for (let k = 0; k < 22; k++) { const nx = n.x + dir.x * 10, ny = n.y + dir.y * 10; if (!Arena.libre(E, nx, ny)) break; n.x = nx; n.y = ny; }
    }
    Arena.send({ t: "esp", dx: n.dir.x, dy: n.dir.y });
  },

  loop() {
    let prev = performance.now();
    const paso = now => {
      Arena.raf = requestAnimationFrame(paso);
      const cv = byId("arCanvas"); if (!cv || !UI.arena || !Arena.v) { if (!cv) Arena.parar(); return; }
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      Arena.moverYo(dt, now);
      Arena.dibujar(cv, now);
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
      const E = AR.ESCENARIOS[v.esc], vel = yo.vel * (v.t < yo.lento ? 0.5 : 1);
      const nx = n.x + mx * vel * dt, ny = n.y + my * vel * dt;
      if (Arena.libre(E, nx, n.y)) n.x = nx; if (Arena.libre(E, n.x, ny)) n.y = ny;
      n.dir = { x: mx / Math.max(d, 0.001), y: my / Math.max(d, 0.001) };
      if (Math.abs(mx) > 0.1) n.cara = mx < 0 ? -1 : 1;
      n.anda = true;
    } else n.anda = false;
    if (n.atk) Arena.pulsarAtaque();
    if (now - n.ultEnvio > 70 && (n.x !== n.ex || n.y !== n.ey || n.cara !== n.ec)) { n.ultEnvio = now; n.ex = n.x; n.ey = n.y; n.ec = n.cara; Arena.send({ t: "pos", x: Math.round(n.x), y: Math.round(n.y), c: n.cara, dx: n.dir.x, dy: n.dir.y }); }
  },

  /* Personaje con equipo dibujado encima: casco, pechera, botas y arma según el nivel */
  dibujarLuchador(ctx, j, x, y, t, anda, vt) {
    const img = Mundo.muneco(j.look || { color: colorDe(j.name), acc: [] });
    const N = k => TR.NIVELES[j.eq[k]];
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(x, y + 16, 22, 8, 0, 0, 7); ctx.fill();
    if (vt < j.invul) ctx.globalAlpha = 0.45;
    const salto = anda ? Math.abs(Math.sin(t * 11)) * 4 : 0;
    ctx.save(); ctx.translate(x, y - salto); if (j.cara < 0) ctx.scale(-1, 1);
    if (img.complete) ctx.drawImage(img, -30, -46, 60, 67);
    // Botas
    if (j.eq.botas) { ctx.fillStyle = N("botas").color; ctx.fillRect(-16, 10, 12, 8); ctx.fillRect(4, 10, 12, 8); }
    // Armadura (pechera)
    if (j.eq.armadura) { ctx.fillStyle = N("armadura").color; ctx.globalAlpha *= 0.92; ctx.beginPath(); ctx.roundRect(-17, -6, 34, 18, 6); ctx.fill(); ctx.strokeStyle = "#0006"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = vt < j.invul ? 0.45 : 1; }
    // Casco
    if (j.eq.casco) { ctx.fillStyle = N("casco").color; ctx.beginPath(); ctx.arc(0, -28, 20, Math.PI, 0); ctx.fill(); ctx.fillRect(-21, -30, 42, 5); ctx.strokeStyle = "#0006"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -28, 20, Math.PI, 0); ctx.stroke(); }
    // Arma
    const col = N("arma").color, golpe = vt - j.golpe < 250 ? (vt - j.golpe) / 250 : -1;
    ctx.translate(20, -6);
    if (j.clase === "guerrero" || j.clase === "asesino") {
      ctx.rotate(golpe >= 0 ? -1.6 + golpe * 2.6 : -0.5);
      ctx.fillStyle = "#5c3b1e"; ctx.fillRect(-2, -2, 4, 10); ctx.fillStyle = "#888"; ctx.fillRect(-7, -4, 14, 3);
      ctx.fillStyle = col; ctx.beginPath(); const largo = j.clase === "guerrero" ? 34 : 20; ctx.moveTo(-3, -4); ctx.lineTo(0, -4 - largo); ctx.lineTo(3, -4); ctx.fill();
      if (j.clase === "asesino") { ctx.translate(-34, 6); ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(0, -22); ctx.lineTo(3, -4); ctx.fill(); }
    } else if (j.clase === "arquero") {
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -4, 18, -1.3, 1.3); ctx.stroke(); ctx.strokeStyle = "#eee"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.cos(-1.3) * 18, -4 + Math.sin(-1.3) * 18); ctx.lineTo(golpe >= 0 ? -6 : 2, -4); ctx.lineTo(Math.cos(1.3) * 18, -4 + Math.sin(1.3) * 18); ctx.stroke();
    } else {
      ctx.strokeStyle = "#6b4423"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -30); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -34, 7 + (golpe >= 0 ? 3 : Math.sin(t * 4)), 0, 7); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
    if (j.eq.arma >= 6 || j.eq.armadura >= 6) { ctx.strokeStyle = TR.NIVELES[Math.max(j.eq.arma, j.eq.armadura)].color; ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.15; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 14, 34, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    if (vt < j.lento) { ctx.font = "18px sans-serif"; ctx.textAlign = "center"; ctx.fillText("❄️", x + 22, y - 44); }
    // Nombre y vida
    ctx.textAlign = "center"; ctx.font = "bold 13px Figtree, sans-serif"; ctx.lineWidth = 3; ctx.strokeStyle = "#000a";
    const nom = `${AR.CLASES[j.clase].ic} ${j.name}`; ctx.strokeText(nom, x, y - 66); ctx.fillStyle = "#fff"; ctx.fillText(nom, x, y - 66);
    ctx.fillStyle = "#0009"; ctx.fillRect(x - 26, y - 58, 52, 7);
    const p = Math.max(0, j.hp / j.max); ctx.fillStyle = p > 0.5 ? "#3ddcb1" : p > 0.25 ? "#ffc53d" : "#ff4d63"; ctx.fillRect(x - 26, y - 58, 52 * p, 7);
  },

  dibujar(cv, now) {
    const v = Arena.v, n = UI.arena, E = AR.ESCENARIOS[v.esc], dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d"), t = now / 1000;
    // La cámara sigue a tu personaje; se ve buena parte de la arena
    const esc = Math.max(0.55, Math.min(1.1, Math.max(W, H) / 1300));
    const yo = v.jug[v.yo];
    const cx = yo ? (yo.vivo ? n.x : yo.x) : 700, cy = yo ? (yo.vivo ? n.y : yo.y) : 500;
    const camx = Math.max(W / 2 / esc, Math.min(AR.W - W / 2 / esc, cx)), camy = Math.max(H / 2 / esc, Math.min(AR.H - H / 2 / esc, cy));
    // Tiempo de la vista interpolado
    if (v.t !== n.vtBase) { n.vtBase = v.t; n.vtLocal = now; }
    const vt = v.t + (v.fase === "pelea" ? Math.min(200, now - (n.vtLocal || now)) : 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0a10"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(esc, esc); ctx.translate(-camx, -camy);
    // Suelo
    ctx.fillStyle = E.suelo;
    if (E.circ) { ctx.beginPath(); ctx.arc(E.circ.x, E.circ.y, E.circ.r, 0, 7); ctx.fill(); ctx.strokeStyle = E.linea; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = "rgba(0,0,0,.08)"; ctx.lineWidth = 2; for (let r = 80; r < E.circ.r; r += 80) { ctx.beginPath(); ctx.arc(E.circ.x, E.circ.y, r, 0, 7); ctx.stroke(); } }
    else {
      const l = E.lim; ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.strokeStyle = E.linea; ctx.lineWidth = 2;
      for (let x = l.x; x <= l.x + l.w; x += 80) { ctx.beginPath(); ctx.moveTo(x, l.y); ctx.lineTo(x, l.y + l.h); ctx.stroke(); }
      for (let y = l.y; y <= l.y + l.h; y += 80) { ctx.beginPath(); ctx.moveTo(l.x, y); ctx.lineTo(l.x + l.w, y); ctx.stroke(); }
      if (v.esc === "ring") { [0, 10, 20].forEach((o, i) => { ctx.strokeStyle = ["#ff4d63", "#fff", "#4dabf7"][i]; ctx.lineWidth = 5; ctx.strokeRect(l.x - o, l.y - o, l.w + o * 2, l.h + o * 2); }); ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.font = "bold 120px Figtree"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("ARENA", 700, 500); }
      else { ctx.strokeStyle = "#0008"; ctx.lineWidth = 14; ctx.strokeRect(l.x, l.y, l.w, l.h); }
    }
    E.lava.forEach(l => { const g = ctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, l.r); g.addColorStop(0, "#ffd43b"); g.addColorStop(0.5, "#ff6b00"); g.addColorStop(1, "#b3200c"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, l.r + Math.sin(t * 2 + l.x) * 3, 0, 7); ctx.fill(); });
    if (E.rayos) E.rayos.forEach(r => { const aviso = (vt % 7000) > 4000 && !v.rayosOn; ctx.fillStyle = v.rayosOn ? `rgba(116,192,252,${0.55 + Math.sin(t * 30) * 0.2})` : aviso ? "rgba(255,212,59,.18)" : "rgba(116,192,252,.08)"; ctx.fillRect(r.x, r.y, r.w, r.h); });
    E.obst.forEach(o => { ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(o.x, o.y + 10, o.r, o.r * 0.4, 0, 0, 7); ctx.fill(); ctx.fillStyle = v.esc === "ring" ? "#d9d9e6" : v.esc === "coliseo" ? "#e8dcc0" : "#5b4a44"; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill(); ctx.strokeStyle = "#0005"; ctx.lineWidth = 3; ctx.stroke(); });
    E.cajas.forEach(c => { ctx.fillStyle = "#596285"; ctx.fillRect(c.x, c.y, c.w, c.h); ctx.strokeStyle = "#2b3150"; ctx.lineWidth = 4; ctx.strokeRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8); ctx.beginPath(); ctx.moveTo(c.x + 4, c.y + 4); ctx.lineTo(c.x + c.w - 4, c.y + c.h - 4); ctx.stroke(); });
    // Pociones
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    v.pociones.forEach(p => { ctx.font = "30px sans-serif"; ctx.fillText("🧪", p.x, p.y + Math.sin(t * 3 + p.k) * 4); });
    // Luchadores (los otros interpolados)
    const lista = v.jug.map(j => {
      const o = n.otros[j.id] = n.otros[j.id] || { x: j.x, y: j.y };
      const esYo = j.id === v.me && j.vivo;
      if (esYo) { o.x = n.x; o.y = n.y; } else { o.x += (j.x - o.x) * 0.3; o.y += (j.y - o.y) * 0.3; }
      return { j, o, esYo };
    }).sort((a, b) => a.o.y - b.o.y);
    lista.forEach(({ j, o, esYo }) => {
      if (!j.vivo) { ctx.globalAlpha = 0.5; ctx.font = "30px sans-serif"; ctx.fillText("🪦", o.x, o.y); ctx.globalAlpha = 1; return; }
      const anda = esYo ? n.anda : Math.hypot(j.x - o.x, j.y - o.y) > 2;
      Arena.dibujarLuchador(ctx, esYo ? { ...j, cara: n.cara } : j, o.x, o.y, t, anda, vt);
      if (esYo) { ctx.strokeStyle = "#3ddcb1"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(o.x, o.y + 16, 26, 10, 0, 0, 7); ctx.stroke(); }
    });
    // Proyectiles (avanzan entre una vista y otra)
    const dtv = Math.min(0.2, (now - (n.vtLocal || now)) / 1000);
    v.proy.forEach(p => {
      const x = p.x + p.vx * dtv, y = p.y + p.vy * dtv;
      if (p.tipo === "flecha") { const a = Math.atan2(p.vy, p.vx); ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = "#e9dcc0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(10, 0); ctx.stroke(); ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(8, -5); ctx.lineTo(8, 5); ctx.fill(); ctx.restore(); }
      else { const g = ctx.createRadialGradient(x, y, 2, x, y, 16); g.addColorStop(0, "#fff"); g.addColorStop(0.4, "#ffb02e"); g.addColorStop(1, "rgba(255,80,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill(); }
    });
    // Efectos
    v.fx.forEach(f => {
      const k = Math.max(0, (vt - f.t) / 600); if (k > 1 && f.tipo !== "num") return;
      if (f.tipo === "tajo") { ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 8; const a = Math.atan2(f.dy, f.dx); ctx.beginPath(); ctx.arc(f.x, f.y - 10, f.r * 0.85, a - f.arco / 2, a + f.arco / 2); ctx.stroke(); }
      else if (f.tipo === "onda") { ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * k), 0, 7); ctx.stroke(); }
      else if (f.tipo === "boom") { ctx.fillStyle = `rgba(255,140,0,${0.6 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + k), 0, 7); ctx.fill(); }
      else if (f.tipo === "humo") { ctx.fillStyle = `rgba(80,70,110,${0.6 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y, 30 + k * 30, 0, 7); ctx.fill(); }
      else if (f.tipo === "muerte") { ctx.globalAlpha = 1 - k; ctx.font = "40px sans-serif"; ctx.fillText("💀", f.x, f.y - 30 - k * 30); }
      else if (f.tipo === "num") { const kk = (vt - f.t) / 1100; if (kk > 1) return; ctx.globalAlpha = 1 - kk; ctx.font = "800 22px Figtree"; ctx.lineWidth = 4; ctx.strokeStyle = "#000a"; ctx.strokeText(f.txt, f.x, f.y - kk * 40); ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y - kk * 40); }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    if (v.sub) { ctx.fillStyle = `rgba(255,0,40,${0.12 + Math.sin(t * 4) * 0.06})`; ctx.fillRect(0, 0, W, H); }
    // Botón especial: tiempo de espera
    if (yo) {
      const C = AR.CLASES[yo.clase], falta = Math.max(0, yo.cdE - vt), p = falta / C.esp.cd;
      const cdEl = byId("arEspCd"); if (cdEl) { cdEl.style.height = p * 100 + "%"; byId("arEsp").classList.toggle("listo", falta <= 0 && v.fase === "pelea"); }
    }
    if (v.fase === "cuenta") { const c = byId("arCentro"); if (c) { c.hidden = false; c.textContent = Math.max(1, Math.ceil((v.inicio - vt) / 1000)); } }
  },

  hud() {
    const v = Arena.v, yo = v.jug[v.yo];
    const top = byId("arTop"); if (!top) return;
    top.innerHTML = v.jug.map(j => `<span class="ar-chip ${j.vivo ? "" : "fuera"} ${j.id === v.me ? "yo" : ""}">${AR.CLASES[j.clase].ic}<b>${esc(j.name)}</b><i style="width:${Math.max(0, j.hp / j.max) * 100}%"></i></span>`).join("");
    byId("arFeed").innerHTML = v.feed.map(f => `<span>${esc(f.txt)}</span>`).join("") + (v.sub ? `<span class="sub">🔥 ¡Muerte súbita!</span>` : "");
    if (yo) byId("arEspIc").textContent = AR.CLASES[yo.clase].esp.ic;
    const c = byId("arCentro");
    if (v.fase === "pelea" && c && !c.hidden) { c.textContent = "¡A pelear!"; setTimeout(() => { if (Arena.v && Arena.v.fase === "pelea") c.hidden = true; }, 700); }
    const fin = byId("arFin");
    if (v.fase === "fin" && fin && fin.hidden) {
      fin.hidden = false;
      const orden = v.jug.slice().sort((a, b) => a.lugar - b.lugar);
      const mio = yo && !yo.cpu ? yo : null;
      Sonido.sfx(mio && mio.lugar === 1 ? "victoria" : "derrota");
      fin.innerHTML = `<div class="ar-fin-caja">
        <h2>${mio ? (mio.lugar === 1 ? "🏆 ¡Ganaste!" : `Quedaste ${mio.lugar}°`) : "Fin de la pelea"}</h2>
        ${mio ? `<div class="tr-premio"><div><b>${mio.dElo >= 0 ? "+" : ""}${mio.dElo}</b><small>ELO</small></div><div><b>+${mio.monedas}</b><small>monedas</small></div><div><b>${mio.kills}</b><small>eliminaciones</small></div></div>` : ""}
        <ol class="ar-tabla">${orden.map(j => `<li class="${j.id === v.me ? "yo" : ""}"><span>${j.lugar}°</span><b>${AR.CLASES[j.clase].ic} ${esc(j.name)}</b><small>${j.kills} ⚔️ · ${j.dElo >= 0 ? "+" : ""}${j.dElo} ELO</small></li>`).join("")}</ol>
        <div class="row">${Arena.opts.local || v.isHost ? `<button class="btn" id="arOtra">Otra pelea</button>` : `<p class="sub">El anfitrión elige si juegan otra.</p>`}<button class="btn ghost" id="arVolver">${Arena.opts.local ? "Armería" : v.isHost ? "Volver a la sala" : "Salir"}</button></div></div>`;
      on("arOtra", () => Arena.send({ t: "again" }));
      on("arVolver", () => { if (Arena.opts.local) { Arena.parar(); go("arenaIntro"); } else if (v.isHost) Arena.send({ t: "lobby" }); else { UI.confirmSalir = true; render(); } });
    }
    if (v.fase !== "fin" && fin && !fin.hidden) fin.hidden = true;
  },

  /* ---------- Contra la compu ---------- */
  empezarLocal(modo, nivel, esc) {
    const u = BD.sesion(), yo = this.miPerfil() || { clase: "guerrero", eq: { casco: 0, armadura: 0, botas: 0, arma: 0 }, elo: 1000 };
    const tier = Object.values(yo.eq).reduce((a, b) => a + b, 0) / 4;
    const base = { facil: Math.max(0, tier - 2), normal: tier, dificil: Math.min(8, tier + 1.5) }[nivel];
    const cpus = modo === "duelo" ? 1 : 3;
    const nombres = AR.NOMBRES_CPU.slice().sort(() => Math.random() - 0.5);
    const jug = [{ id: "yo", name: u ? u.nombre : "Tú", look: u ? u.look : null, arena: yo }];
    for (let i = 0; i < cpus; i++) {
      const n = () => Math.max(0, Math.min(8, Math.round(base + (Math.random() - 0.5) * 1.5)));
      jug.push({ id: "cpu" + i, name: "🤖 " + nombres[i], cpu: true, nivel, look: { color: COLORES[(i * 3 + 2) % COLORES.length], acc: [] }, arena: { clase: pick(Object.keys(AR.CLASES)), eq: { casco: n(), armadura: n(), botas: n(), arma: n() } } });
    }
    S.arena = this.setup(jug, { esc, nivel });
    S.arenaCfg = { modo, nivel, esc };
    clearInterval(Arena.reloj);
    let prev = Date.now();
    Arena.reloj = setInterval(() => {
      const s = S.arena; if (!s || S.screen !== "arena") { clearInterval(Arena.reloj); Arena.reloj = null; return; }
      const ahora = Date.now(); Arena.tick(s, (ahora - prev) / 1000); prev = ahora;
      Arena.render(Arena.view(s, "yo"), Arena.send, { local: true });
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
    if (a.t === "again" && pid === "H") { const e = Arena.empezarOn(R); R.err = e || ""; return; }
    if (a.t === "lobby" && pid === "H") { R.game = null; R.arena = null; return; }
    Arena.act(R.arena, pid, a);
  }
};

PANTALLAS.arena = () => {
  const s = S.arena; if (!s) return go("arenaIntro");
  Arena.render(Arena.view(s, "yo"), Arena.send, { local: true });
};
Arena.send = a => {
  const s = S.arena;
  if (Net && Net.activo && Net.activo() && UI.v && UI.v.game === "arena") return Net.send(a);
  if (!s) return;
  if (a.t === "again") { Arena.parar(); const c = S.arenaCfg; return Arena.empezarLocal(c.modo, c.nivel, c.esc); }
  Arena.act(s, "yo", a);
};

/* ---------- Armería: clases, equipo, escenario y modo ---------- */
PANTALLAS.arenaIntro = () => {
  const u = BD.sesion();
  if (!u) {
    app.innerHTML = `${head(0)}<section class="stage">${personaje("#ff4d63", "civ", 110, ["casco"])}<h2>Arena</h2><p class="sub">Necesitas un perfil para guardar tu clase, tu equipo y tu ELO.</p><button class="btn" id="arPerfil">Crear o elegir perfil</button><button class="btn ghost" id="volver">Volver</button></section>`;
    on("arPerfil", () => go("cuenta")); on("volver", () => go("home")); return;
  }
  const a = Arena.datos(u), st = Arena.stats(a.clase, a.eq), elo = Arena.elo(u), sa = u.stats.arena || {};
  const cfg = S.arenaCfg || { modo: "duelo", nivel: "normal", esc: "ring" };
  app.innerHTML = `${Cuenta.barra()}<section class="screen">
    <div class="headrow"><h1 class="titulo chico">La <span>Arena</span></h1><span class="chip-mon">🪙 ${u.monedas}</span></div>
    <div class="ar-perfil">
      <div class="ar-retrato"><canvas id="arPrev" width="160" height="170"></canvas></div>
      <div class="ar-datos"><span class="label">ELO</span><b class="ar-elo">${elo}</b><small>${sa.g || 0} victorias · ${sa.j || 0} peleas · ${sa.kills || 0} ⚔️</small>
        <div class="ar-st"><span>❤️ ${st.hp}</span><span>👟 ${Math.round(st.vel)}</span><span>💥 ×${st.mult.toFixed(2)}</span><span>🛡️ ${Math.round((1 - st.def) * 100)}%</span></div></div>
    </div>
    <div class="panel"><span class="label">Clase</span>
      <div class="ar-clases">${Object.entries(AR.CLASES).map(([k, C]) => { const tengo = a.clases.includes(k); return `<button class="ar-clase ${a.clase === k ? "on" : ""}" data-clase="${k}" ${!tengo && u.monedas < C.precio ? "disabled" : ""}>
        <span class="ic">${C.ic}</span><b>${C.nombre}</b><small>${C.desc}</small><small class="esp">${C.esp.ic} ${C.esp.nombre}</small>${tengo ? "" : `<span class="precio">🪙 ${C.precio}</span>`}</button>`; }).join("")}</div></div>
    <div class="panel"><span class="label">Equipo</span>
      ${Object.keys(AR.PIEZAS).map(p => { const n = a.eq[p]; return `<div class="ar-pieza"><span class="ic">${AR.PIEZAS[p][2]}</span><div><b>${esc(Arena.nombrePieza(p, a.clase, n))}</b>
        <span class="tr-pasos">${TR.NIVELES.map((N, k) => `<i style="--c:${N.color}" class="${k <= n ? "on" : ""}"></i>`).join("")}</span></div>
        ${n >= 8 ? `<span class="ok">👑 Tope</span>` : `<button class="btn chico" data-mej="${p}" ${u.monedas < AR.COSTO[n + 1] ? "disabled" : ""}>⬆️ ${AR.COSTO[n + 1]} 🪙</button>`}</div>`; }).join("")}
    </div>
    <div class="panel"><span class="label">Escenario</span>
      <div class="chips-j">${Object.entries(AR.ESCENARIOS).map(([k, E]) => `<button class="chip-j ${cfg.esc === k ? "on" : ""}" data-esc="${k}">${E.ic} ${E.nombre}</button>`).join("")}</div>
      <span class="label">Contra la compu</span>
      <div class="tabs">${[["duelo", "1 contra 1"], ["todos", "Todos contra todos (4)"]].map(([k, n]) => `<button data-modo="${k}" aria-pressed="${cfg.modo === k}">${n}</button>`).join("")}</div>
      <div class="tabs">${[["facil", "Fácil"], ["normal", "Normal"], ["dificil", "Difícil"]].map(([k, n]) => `<button data-niv="${k}" aria-pressed="${cfg.nivel === k}">${n}</button>`).join("")}</div>
      <button class="btn" id="arJugar">⚔️ ¡A pelear!</button>
      <button class="btn ghost" id="arAmigos">Pelear con amigos (crear sala)</button>
    </div>
    <details class="panel"><summary class="label">Cómo se juega</summary><ul class="reglas-pts">
      <li><span>🕹️ Moverse</span><b>Arrastra el dedo (o flechas)</b></li><li><span>⚔️ Atacar</span><b>Botón grande (o espacio): apunta solo al más cercano</b></li>
      <li><span>✨ Especial</span><b>Botón chico (o E), cuando se llena</b></li><li><span>🧪 Pociones</span><b>Pásales por encima: +35 de vida</b></li>
      <li><span>🔥 Muerte súbita</span><b>A los 90 s todos pierden vida</b></li><li><span>🏆 ELO</span><b>Sube si le ganas a alguien con más ELO</b></li></ul></details>
    <button class="btn ghost" id="volver">Inicio</button>
  </section>`;
  Cuenta.conectarBarra();
  // Vista previa del personaje con el equipo
  const cv = byId("arPrev"), ctx = cv.getContext("2d");
  const pintar = () => { ctx.clearRect(0, 0, 160, 170); ctx.save(); ctx.scale(1.7, 1.7); Arena.dibujarLuchador(ctx, { name: "", look: u.look, clase: a.clase, eq: a.eq, cara: 1, hp: 1, max: 1, invul: 0, lento: 0, golpe: -9999 }, 47, 75, performance.now() / 1000, false, 0); ctx.restore(); };
  pintar(); setTimeout(pintar, 300);
  app.querySelectorAll("[data-clase]").forEach(b => b.onclick = () => { const k = b.dataset.clase; if (a.clases.includes(k)) { a.clase = k; Eco.guardar(u); render(); } else if (confirm(`¿Comprar la clase ${AR.CLASES[k].nombre} por ${AR.CLASES[k].precio} monedas?`)) Arena.comprarClase(k); });
  app.querySelectorAll("[data-mej]").forEach(b => b.onclick = () => Arena.mejorar(b.dataset.mej));
  app.querySelectorAll("[data-esc]").forEach(b => b.onclick = () => { S.arenaCfg = { ...cfg, esc: b.dataset.esc }; S.arenaEsc = b.dataset.esc; render(); });
  app.querySelectorAll("[data-modo]").forEach(b => b.onclick = () => { S.arenaCfg = { ...cfg, modo: b.dataset.modo }; render(); });
  app.querySelectorAll("[data-niv]").forEach(b => b.onclick = () => { S.arenaCfg = { ...cfg, nivel: b.dataset.niv }; render(); });
  on("arJugar", () => Arena.empezarLocal(cfg.modo, cfg.nivel, cfg.esc));
  on("arAmigos", () => { S.arenaEsc = cfg.esc; go("onCrear"); });
  on("volver", () => go("home"));
};
