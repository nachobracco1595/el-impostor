/* La Nave: juego de moverse por el mapa, hacer tareas y descubrir al impostor (estilo Among Us).
   El anfitrión (o el teléfono, en práctica con compus) manda: valida movimientos, eliminaciones, tareas y votos.
   Cada teléfono mueve a su personaje y le avisa su posición al anfitrión unas 10 veces por segundo. */

/* ---------- Mapa ---------- */
const NV = {
  W: 1600, H: 1000, VEL: 190, R_MATAR: 90, R_USAR: 75, R_REPORTAR: 130, VISION: 230, VISION_IMP: 320, ESPERA_MATAR: 25000, REUNION: 60000, EXPULSION: 5500,
  SALAS: [
    { id: "cafe", nombre: "Cafetería", x: 600, y: 60, w: 420, h: 260, color: "#3d4a63" },
    { id: "enf", nombre: "Enfermería", x: 200, y: 60, w: 300, h: 220, color: "#2f5b5a" },
    { id: "armas", nombre: "Armas", x: 1180, y: 60, w: 300, h: 220, color: "#5a3d3d" },
    { id: "nav", nombre: "Navegación", x: 1260, y: 420, w: 260, h: 240, color: "#3b4d74" },
    { id: "esc", nombre: "Escudos", x: 1100, y: 760, w: 300, h: 200, color: "#4b5a2f" },
    { id: "alm", nombre: "Almacén", x: 620, y: 800, w: 260, h: 180, color: "#5b4a33" },
    { id: "elec", nombre: "Electricidad", x: 620, y: 560, w: 260, h: 220, color: "#5a5233" },
    { id: "mot", nombre: "Motores", x: 80, y: 420, w: 300, h: 260, color: "#4a3a5a" }
  ],
  PASILLOS: [
    { x: 500, y: 150, w: 100, h: 80 }, { x: 1020, y: 140, w: 160, h: 80 }, { x: 1300, y: 280, w: 90, h: 140 },
    { x: 1230, y: 660, w: 90, h: 100 }, { x: 880, y: 850, w: 220, h: 80 }, { x: 700, y: 780, w: 90, h: 20 },
    { x: 760, y: 320, w: 90, h: 240 }, { x: 380, y: 600, w: 240, h: 80 }, { x: 250, y: 280, w: 90, h: 140 }
  ],
  BOTON: { x: 810, y: 190 },
  // Estaciones de tarea: tipo de mini-juego y ubicación
  ESTACIONES: [
    { id: "t1", tipo: "cables", nombre: "Arreglar cables", x: 680, y: 620, sala: "elec" },
    { id: "t2", tipo: "descarga", nombre: "Descargar datos", x: 960, y: 110, sala: "cafe" },
    { id: "t3", tipo: "calibrar", nombre: "Calibrar motor", x: 140, y: 520, sala: "mot" },
    { id: "t4", tipo: "codigo", nombre: "Ingresar código", x: 1440, y: 540, sala: "nav" },
    { id: "t5", tipo: "descarga", nombre: "Escanear muestras", x: 300, y: 130, sala: "enf" },
    { id: "t6", tipo: "cables", nombre: "Conectar escudos", x: 1330, y: 880, sala: "esc" },
    { id: "t7", tipo: "calibrar", nombre: "Apuntar armas", x: 1400, y: 140, sala: "armas" },
    { id: "t8", tipo: "codigo", nombre: "Abrir caja fuerte", x: 800, y: 920, sala: "alm" },
    { id: "t9", tipo: "descarga", nombre: "Cargar combustible", x: 300, y: 640, sala: "mot" },
    { id: "t10", tipo: "calibrar", nombre: "Ajustar timón", x: 1320, y: 470, sala: "nav" },
    { id: "t11", tipo: "codigo", nombre: "Reiniciar luces", x: 840, y: 600, sala: "elec" },
    { id: "t12", tipo: "cables", nombre: "Reparar cocina", x: 650, y: 280, sala: "cafe" }
  ],
  ICONO: { cables: "🔌", descarga: "📶", calibrar: "🎯", codigo: "🔢" }
};
NV.ZONAS = [...NV.SALAS, ...NV.PASILLOS];
NV.enZona = (x, y) => NV.ZONAS.some(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
/* El cuerpo del jugador (radio r) entra si todo su borde cae en alguna sala o pasillo: así se cruza de una zona a otra */
NV.dentro = (x, y, r = 14) => [[0, 0], [-r, -r], [0, -r], [r, -r], [-r, 0], [r, 0], [-r, r], [0, r], [r, r]].every(([dx, dy]) => NV.enZona(x + dx, y + dy));
NV.salaDe = (x, y) => (NV.SALAS.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) || {}).nombre || "Pasillo";
NV.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* Grafo para que las compus caminen: centro de cada sala y de cada pasillo */
NV.NODOS = NV.ZONAS.map(z => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 }));
NV.VECINOS = NV.NODOS.map((_, i) => {
  const a = NV.ZONAS[i];
  return NV.ZONAS.map((b, j) => j !== i && a.x <= b.x + b.w + 2 && b.x <= a.x + a.w + 2 && a.y <= b.y + b.h + 2 && b.y <= a.y + a.h + 2 ? j : -1).filter(j => j >= 0);
});
NV.zonaDe = (x, y) => NV.ZONAS.findIndex(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
NV.camino = (desde, hasta) => {
  const a = NV.zonaDe(desde.x, desde.y), b = NV.zonaDe(hasta.x, hasta.y);
  if (a < 0 || b < 0) return [hasta];
  const prev = { [a]: -1 }, cola = [a];
  while (cola.length) { const n = cola.shift(); if (n === b) break; for (const v of NV.VECINOS[n]) if (!(v in prev)) { prev[v] = n; cola.push(v); } }
  const ruta = []; for (let n = b; n !== a && n !== undefined && n !== -1; n = prev[n]) ruta.unshift(NV.NODOS[n]);
  return [...ruta.slice(0, -1), hasta];
};
NV.lugarCafe = i => ({ x: 640 + (i % 6) * 64, y: 250 - Math.floor(i / 6) * 60 });

/* ---------- Partida ---------- */
const Nave = {
  setup(jug) {
    const n = jug.length, nImp = n >= 7 ? 2 : 1;
    const imps = new Set(shuffle(jug.map(j => j.id)).slice(0, nImp));
    const ahora = Date.now();
    return {
      id: "nave-" + ahora.toString(36) + Math.random().toString(36).slice(2, 6),
      fase: "juego", t0: ahora, reunion: null, expulsion: null, ganador: null, cuerpos: [], log: [],
      jug: jug.map((j, i) => ({
        id: j.id, name: j.name, look: j.look || { color: COLORES[i % COLORES.length], acc: [] }, bot: !!j.bot, imp: imps.has(j.id), vivo: true, ...NV.lugarCafe(i), tp: 1,
        tareas: shuffle(NV.ESTACIONES).slice(0, 4).map(e => ({ st: e.id, hecha: false })),
        kcd: ahora + 12000, emerg: 1, kills: 0, ruta: [], espera: 0
      }))
    };
  },
  J: (s, id) => s.jug.find(j => j.id === id),
  progreso(s) {
    const t = s.jug.filter(j => !j.imp).flatMap(j => j.tareas);
    return t.length ? t.filter(x => x.hecha).length / t.length : 0;
  },

  act(s, pid, a) {
    const yo = Nave.J(s, pid); if (!yo) return;
    const ahora = Date.now();
    if (a.t === "pos" && s.fase === "juego" && typeof a.x === "number" && typeof a.y === "number") {
      if ((a.tp || 0) !== yo.tp) return;   // posición vieja de antes de un teletransporte
      if (NV.dentro(a.x, a.y, 4) || !yo.vivo) { yo.x = Math.max(0, Math.min(NV.W, a.x)); yo.y = Math.max(0, Math.min(NV.H, a.y)); yo.dir = a.dir || yo.dir; }
    } else if (a.t === "tarea" && s.fase === "juego") {
      const t = yo.tareas.find(x => x.st === a.st), e = NV.ESTACIONES.find(x => x.id === a.st);
      if (t && e && !yo.imp && NV.dist(yo, e) <= NV.R_USAR + 30) { t.hecha = true; Nave.revisarFin(s); }
    } else if (a.t === "matar" && s.fase === "juego" && yo.imp && yo.vivo && ahora >= yo.kcd) {
      const v = Nave.J(s, a.id);
      if (v && v.vivo && !v.imp && NV.dist(yo, v) <= NV.R_MATAR + 20) {
        v.vivo = false; yo.kcd = ahora + NV.ESPERA_MATAR; yo.kills++;
        s.cuerpos.push({ id: v.id, name: v.name, look: v.look, x: v.x, y: v.y, t: ahora });
        s.ultimoKill = { por: yo.id, n: (s.ultimoKill ? s.ultimoKill.n : 0) + 1 };
        Nave.revisarFin(s);
      }
    } else if (a.t === "reportar" && s.fase === "juego" && yo.vivo) {
      const c = s.cuerpos.find(x => x.id === a.id);
      if (c && NV.dist(yo, c) <= NV.R_REPORTAR + 30) Nave.abrirReunion(s, yo, "cuerpo", c);
    } else if (a.t === "emergencia" && s.fase === "juego" && yo.vivo && yo.emerg > 0 && NV.dist(yo, NV.BOTON) <= NV.R_USAR + 30) {
      yo.emerg--; Nave.abrirReunion(s, yo, "emergencia");
    } else if (a.t === "voto" && s.fase === "reunion" && yo.vivo && !(pid in s.reunion.votos)) {
      if (a.id === "saltar" || (Nave.J(s, a.id) || {}).vivo) s.reunion.votos[pid] = a.id;
      if (s.jug.filter(j => j.vivo).every(j => j.id in s.reunion.votos)) Nave.cerrarVotacion(s);
    }
  },

  abrirReunion(s, quien, motivo, cuerpo) {
    s.fase = "reunion";
    s.reunion = { por: quien.name, motivo, cuerpo: cuerpo ? cuerpo.name : null, fin: Date.now() + NV.REUNION, votos: {}, n: (s.reunion ? s.reunion.n : 0) + 1 };
    // Los cuerpos se limpian y todos vuelven a la cafetería
    s.cuerpos = [];
    s.jug.forEach((j, i) => { Object.assign(j, NV.lugarCafe(i)); j.tp++; j.ruta = []; });
  },

  cerrarVotacion(s) {
    const cuenta = {};
    Object.values(s.reunion.votos).forEach(v => cuenta[v] = (cuenta[v] || 0) + 1);
    const orden = Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
    let fuera = null;
    if (orden.length && orden[0][0] !== "saltar" && !(orden[1] && orden[1][1] === orden[0][1])) fuera = Nave.J(s, orden[0][0]);
    if (fuera) fuera.vivo = false;
    s.expulsion = { name: fuera ? fuera.name : null, look: fuera ? fuera.look : null, imp: fuera ? fuera.imp : null, empate: !!(orden[1] && orden[1][1] === orden[0][1]), votos: cuenta, fin: Date.now() + NV.EXPULSION, quedan: s.jug.filter(j => j.imp && j.vivo).length };
    s.fase = "expulsion";
  },

  revisarFin(s) {
    const vivos = s.jug.filter(j => j.vivo), imps = vivos.filter(j => j.imp).length, crew = vivos.length - imps;
    if (imps === 0) s.ganador = "crew", s.motivo = "Expulsaron a todos los impostores";
    else if (imps >= crew) s.ganador = "imp", s.motivo = "Los impostores ya son tantos como los tripulantes";
    else if (Nave.progreso(s) >= 1) s.ganador = "crew", s.motivo = "La tripulación terminó todas las tareas";
    if (s.ganador) s.fase = "fin";
  },

  /* Avanza el tiempo (lo llama el anfitrión unas 10 veces por segundo) */
  tick(s, dt) {
    const ahora = Date.now();
    if (s.fase === "reunion") {
      Nave.votosCompus(s);
      if (ahora >= s.reunion.fin) Nave.cerrarVotacion(s);
    } else if (s.fase === "expulsion" && ahora >= s.expulsion.fin) {
      s.fase = "juego"; s.expulsion = null;
      s.jug.forEach(j => { if (j.imp) j.kcd = ahora + NV.ESPERA_MATAR; });
      Nave.revisarFin(s);
    } else if (s.fase === "juego") Nave.moverCompus(s, dt);
  },

  /* ---------- Compus ---------- */
  moverCompus(s, dt) {
    const ahora = Date.now();
    for (const b of s.jug.filter(j => j.bot)) {
      if (b.espera > ahora) continue;
      // Reportar si ve un cuerpo
      if (b.vivo) { const c = s.cuerpos.find(c => NV.dist(b, c) < 160 && !(b.imp && c.t > ahora - 8000)); if (c) { b.x = c.x; b.y = c.y; Nave.act(s, b.id, { t: "reportar", id: c.id }); return; } }
      // Impostor: eliminar si hay alguien solo cerca
      if (b.imp && b.vivo && ahora >= b.kcd) {
        const vict = s.jug.find(v => v.vivo && !v.imp && NV.dist(b, v) < 260 && !s.jug.some(w => w !== v && w !== b && w.vivo && !w.imp && NV.dist(w, v) < 260));
        if (vict) {
          if (NV.dist(b, vict) <= NV.R_MATAR) { Nave.act(s, b.id, { t: "matar", id: vict.id }); b.ruta = []; b.espera = ahora + 1500; continue; }
          b.ruta = [vict];
        }
      }
      // Elegir destino: la próxima tarea (o una sala al azar)
      if (!b.ruta.length) {
        const t = !b.imp && b.tareas.find(x => !x.hecha);
        const dest = t ? NV.ESTACIONES.find(e => e.id === t.st) : (() => { const z = pick(NV.SALAS); return { x: z.x + 30 + Math.random() * (z.w - 60), y: z.y + 30 + Math.random() * (z.h - 60) }; })();
        b.ruta = NV.camino(b, dest); b.objetivo = t ? t.st : null;
      }
      const p = b.ruta[0], d = NV.dist(b, p), paso = NV.VEL * 0.85 * dt;
      if (d <= paso) {
        b.x = p.x; b.y = p.y; b.ruta.shift();
        if (!b.ruta.length && b.objetivo) { b.espera = ahora + 2500 + Math.random() * 2000; const o = b.objetivo; b.objetivo = null; setTimeout(() => { if (s.fase === "juego") Nave.act(s, b.id, { t: "tarea", st: o }); }, 2400); }
        else if (!b.ruta.length) b.espera = ahora + 800 + Math.random() * 2500;
      } else { b.dir = p.x < b.x ? -1 : 1; b.x += (p.x - b.x) / d * paso; b.y += (p.y - b.y) / d * paso; }
    }
  },
  votosCompus(s) {
    const ahora = Date.now(), r = s.reunion;
    if (!r.sospecha) {
      // Sospechoso: quien estaba más cerca del cuerpo o al azar
      const vivos = s.jug.filter(j => j.vivo);
      r.sospecha = Object.fromEntries(s.jug.filter(j => j.bot && j.vivo).map(b => {
        const otros = vivos.filter(x => x.id !== b.id);
        const imp = b.imp ? pick(otros.filter(x => !x.imp)) : Math.random() < 0.55 ? pick(otros) : null;
        return [b.id, { a: imp ? imp.id : "saltar", t: ahora + 6000 + Math.random() * 20000 }];
      }));
    }
    for (const [id, v] of Object.entries(r.sospecha)) if (ahora >= v.t && !(id in r.votos) && s.fase === "reunion") Nave.act(s, id, { t: "voto", id: v.a });
  },

  resultado(s, pid) {
    if (s.fase !== "fin") return null;
    const j = Nave.J(s, pid); if (!j) return null;
    return { juego: "nave", id: s.id, imp: j.imp, gano: (s.ganador === "imp") === j.imp, kills: j.kills, tareas: j.tareas.filter(t => t.hecha).length, vsCompus: s.jug.some(x => x.bot) };
  },

  view(s, pid) {
    const yo = Nave.J(s, pid);
    return {
      game: "nave", me: pid, fase: s.fase, prog: Nave.progreso(s), ganador: s.ganador, motivo: s.motivo,
      yo: yo ? { imp: yo.imp, vivo: yo.vivo, tareas: yo.tareas, kcd: yo.kcd - Date.now(), emerg: yo.emerg, tp: yo.tp, x: yo.x, y: yo.y, kills: yo.kills } : null,
      socios: yo && yo.imp ? s.jug.filter(j => j.imp && j.id !== pid).map(j => j.id) : [],
      jug: s.jug.map(j => ({ id: j.id, name: j.name, look: j.look, x: Math.round(j.x), y: Math.round(j.y), vivo: j.vivo, dir: j.dir || 1, imp: s.fase === "fin" ? j.imp : undefined, voto: s.reunion && j.id in s.reunion.votos })),
      cuerpos: s.cuerpos.map(c => ({ id: c.id, name: c.name, look: c.look, x: c.x, y: c.y })),
      reunion: s.fase === "reunion" ? { por: s.reunion.por, motivo: s.reunion.motivo, cuerpo: s.reunion.cuerpo, falta: s.reunion.fin - Date.now(), miVoto: s.reunion.votos[pid] || null, n: s.reunion.n } : null,
      expulsion: s.fase === "expulsion" ? s.expulsion : null,
      kill: s.ultimoKill || null
    };
  },

  /* Muñequito con el color real de cada jugador */
  mini(j, size, tipo = "civ") { const l = j.look || { color: colorDe(j.name), acc: [] }; return `<span class="av" style="width:${size}px;height:${size}px">${personaje(l.color, tipo, size * 0.9, l.acc || [])}</span>`; },

  /* ---------- Dibujo ---------- */
  sprites: {},
  sprite(look, tipo) {
    const l = look || { color: "#748ffc", acc: [] }, k = l.color + (l.acc || []).join() + tipo;
    if (!this.sprites[k]) {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(personaje(l.color, tipo, 60, l.acc || []).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '));
      this.sprites[k] = img;
    }
    return this.sprites[k];
  },

  /* Arma la pantalla una vez; después solo se actualizan los datos */
  render(v, send, opts) {
    Nave.v = v; Nave.send = send; Nave.opts = opts;
    if (!v.yo) { app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="stage">${personaje("#748ffc", "duda", 110)}<h2>Partida en curso</h2><p class="sub">Entras en la próxima.</p></section>`; return; }
    const capa = v.fase === "fin" ? "fin" : "mapa";
    if (UI.naveCapa !== capa || !byId("naveCanvas") && capa === "mapa") {
      UI.naveCapa = capa;
      if (capa === "mapa") Nave.montar(); else Nave.pantallaFin(v);
    }
    if (capa === "mapa") Nave.hud(v);
  },

  montar() {
    document.body.classList.add("en-nave");
    app.innerHTML = `<div class="nave" id="naveRoot">
      <canvas id="naveCanvas"></canvas>
      <div class="nv-hud-sup"><div class="nv-barra"><span>Tareas de la nave</span><i id="nvProg"></i></div><div class="nv-mis" id="nvMis"></div></div>
      <canvas id="naveMini" width="160" height="100"></canvas>
      <div class="nv-rol" id="nvRol"></div>
      <div class="nv-joy" id="nvJoy"><i></i></div>
      <div class="nv-acc" id="nvAcc"></div>
      <div class="nv-capa" id="nvCapa" hidden></div>
      <div class="nv-tarea" id="nvTarea" hidden></div>
      <button class="nv-salir" id="nvSalir" aria-label="Salir">✕</button>
    </div>`;
    const v = Nave.v;
    UI.nave = { x: v.yo.x, y: v.yo.y, tp: v.yo.tp, dir: 1, mov: { x: 0, y: 0 }, otros: {}, ultEnvio: 0, teclas: {} };
    Nave.joystick();
    byId("nvSalir").onclick = () => { if (Nave.opts.local) { Nave.parar(); go("home"); } else UI.confirmSalir = true, render(); };
    if (!Nave.raf) Nave.loop();
  },

  joystick() {
    const joy = byId("nvJoy"), pin = joy.querySelector("i"), mov = UI.nave.mov;
    let id = null, cx = 0, cy = 0;
    const zona = byId("naveCanvas");
    const empezar = e => { const t = e.changedTouches ? e.changedTouches[0] : e; id = t.identifier ?? "m"; cx = t.clientX; cy = t.clientY; joy.style.left = cx - 60 + "px"; joy.style.top = cy - 60 + "px"; joy.classList.add("on"); mover(e); };
    const mover = e => {
      if (id === null) return;
      const t = e.changedTouches ? [...e.changedTouches].find(x => x.identifier === id) : e; if (!t) return;
      let dx = t.clientX - cx, dy = t.clientY - cy; const d = Math.hypot(dx, dy), max = 50;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      pin.style.transform = `translate(${dx}px, ${dy}px)`;
      mov.x = dx / max; mov.y = dy / max;
      if (e.cancelable) e.preventDefault();
    };
    const fin = () => { id = null; mov.x = 0; mov.y = 0; pin.style.transform = ""; joy.classList.remove("on"); };
    zona.addEventListener("touchstart", empezar, { passive: true });
    zona.addEventListener("touchmove", mover, { passive: false });
    zona.addEventListener("touchend", fin); zona.addEventListener("touchcancel", fin);
    zona.addEventListener("mousedown", empezar); window.addEventListener("mousemove", e => { if (id === "m") mover(e); }); window.addEventListener("mouseup", () => { if (id === "m") fin(); });
    if (!Nave.teclasListas) {
      Nave.teclasListas = true;
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      window.addEventListener("keydown", e => { if (!UI.nave || !map[e.key] || document.activeElement.tagName === "INPUT") return; UI.nave.teclas[e.key] = map[e.key]; e.preventDefault(); });
      window.addEventListener("keyup", e => { if (UI.nave) delete UI.nave.teclas[e.key]; });
    }
  },

  parar() { cancelAnimationFrame(Nave.raf); Nave.raf = null; document.body.classList.remove("en-nave"); UI.naveCapa = null; clearInterval(Nave.hostTimer); Nave.hostTimer = null; },

  loop() {
    let prev = performance.now();
    const paso = now => {
      Nave.raf = requestAnimationFrame(paso);
      const cv = byId("naveCanvas");
      if (!cv || !UI.nave || !Nave.v || !Nave.v.yo) { if (!cv) Nave.parar(); return; }
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      Nave.moverYo(dt);
      dibujarSeguro(cv, () => Nave.dibujar(cv));
    };
    Nave.raf = requestAnimationFrame(paso);
  },

  moverYo(dt) {
    const v = Nave.v, n = UI.nave;
    if (v.yo.tp !== n.tp) { n.x = v.yo.x; n.y = v.yo.y; n.tp = v.yo.tp; }   // teletransporte (reunión)
    if (v.fase !== "juego" || byId("nvTarea") && !byId("nvTarea").hidden) return;
    let mx = n.mov.x, my = n.mov.y;
    for (const [dx, dy] of Object.values(n.teclas)) { mx += dx; my += dy; }
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    if (m > 0.05) {
      const vel = NV.VEL * (v.yo.vivo ? 1 : 1.2);
      const nx = n.x + mx * vel * dt, ny = n.y + my * vel * dt;
      if (!v.yo.vivo) { n.x = Math.max(20, Math.min(NV.W - 20, nx)); n.y = Math.max(20, Math.min(NV.H - 20, ny)); }   // los fantasmas atraviesan paredes
      else { if (NV.dentro(nx, n.y)) n.x = nx; if (NV.dentro(n.x, ny)) n.y = ny; }
      if (Math.abs(mx) > 0.1) n.dir = mx < 0 ? -1 : 1;
      n.anda = true;
    } else n.anda = false;
    const ahora = performance.now();
    if (ahora - n.ultEnvio > 90 && (n.x !== n.ex || n.y !== n.ey)) { n.ultEnvio = ahora; n.ex = n.x; n.ey = n.y; Nave.send({ t: "pos", x: Math.round(n.x), y: Math.round(n.y), dir: n.dir, tp: n.tp }); }
    if (ahora - (n.ultHud || 0) > 150) { n.ultHud = ahora; Nave.acciones(); }
  },

  dibujar(cv) {
    const v = Nave.v, n = UI.nave, dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d"), esc = Math.max(W, H) / 900, t = performance.now() / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#05040a"; ctx.fillRect(0, 0, W, H);
    // Estrellas
    for (let i = 0; i < 60; i++) { const sx = (i * 137.5 + t * 6) % W, sy = (i * 71.3) % H; ctx.fillStyle = `rgba(255,255,255,${0.2 + (i % 5) / 8})`; ctx.fillRect(sx, sy, 1.5, 1.5); }
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(esc, esc); ctx.translate(-n.x, -n.y);
    // Casco de la nave, pasillos y salas
    ctx.fillStyle = "#1a1d2b"; NV.PASILLOS.forEach(z => ctx.fillRect(z.x, z.y, z.w, z.h));
    NV.SALAS.forEach(z => {
      ctx.fillStyle = z.color; ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 1;
      for (let gx = z.x; gx < z.x + z.w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, z.y); ctx.lineTo(gx, z.y + z.h); ctx.stroke(); }
      for (let gy = z.y; gy < z.y + z.h; gy += 40) { ctx.beginPath(); ctx.moveTo(z.x, gy); ctx.lineTo(z.x + z.w, gy); ctx.stroke(); }
      ctx.strokeStyle = "#8a93b8"; ctx.lineWidth = 6; ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.font = "bold 22px Figtree, " + FE; ctx.fillText(z.nombre.toUpperCase(), z.x + 14, z.y + 30);
    });
    // Abrir las paredes donde llegan los pasillos
    ctx.fillStyle = "#1a1d2b"; NV.PASILLOS.forEach(z => ctx.fillRect(z.x + 3, z.y + 3, z.w - 6, z.h - 6));
    // Botón de emergencia
    ctx.fillStyle = "#555"; ctx.beginPath(); ctx.arc(NV.BOTON.x, NV.BOTON.y, 30, 0, 7); ctx.fill();
    ctx.fillStyle = "#e03131"; ctx.beginPath(); ctx.arc(NV.BOTON.x, NV.BOTON.y, 20 + Math.sin(t * 3) * 2, 0, 7); ctx.fill();
    // Estaciones de tareas (las mías brillan)
    const mias = new Set(!v.yo.imp ? v.yo.tareas.filter(x => !x.hecha).map(x => x.st) : []);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    NV.ESTACIONES.forEach(e => {
      if (mias.has(e.id)) { ctx.fillStyle = `rgba(255,214,64,${0.35 + Math.sin(t * 4) * 0.2})`; ctx.beginPath(); ctx.arc(e.x, e.y, 34, 0, 7); ctx.fill(); }
      ctx.fillStyle = "#2b2f45"; ctx.fillRect(e.x - 22, e.y - 22, 44, 44); ctx.strokeStyle = mias.has(e.id) ? "#ffd43b" : "#6b7394"; ctx.lineWidth = 3; ctx.strokeRect(e.x - 22, e.y - 22, 44, 44);
      ctx.font = "24px " + FE; ctx.fillStyle = "#000"; ctx.fillText(NV.ICONO[e.tipo], e.x, e.y + 1);
    });
    // Cuerpos
    v.cuerpos.forEach(c => { const img = Nave.sprite(c.look, "muerto"); if (img.complete) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(Math.PI / 2); ctx.drawImage(img, -30, -34, 60, 67); ctx.restore(); } ctx.fillStyle = "#ff4d63"; ctx.font = "bold 13px Figtree, " + FE; ctx.fillText("🦴 " + c.name, c.x, c.y - 42); });
    // Personajes (los de afuera de la visión no se ven)
    const vision = !v.yo.vivo ? 9999 : v.yo.imp ? NV.VISION_IMP : NV.VISION;
    v.jug.forEach(j => {
      const o = n.otros[j.id] = n.otros[j.id] || { x: j.x, y: j.y };
      const yo = j.id === v.me;
      if (yo) { o.x = n.x; o.y = n.y; } else { o.x += (j.x - o.x) * 0.25; o.y += (j.y - o.y) * 0.25; }
      if (!j.vivo && v.yo.vivo && !yo) return;   // los fantasmas solo los ven otros fantasmas
      if (!yo && Math.hypot(o.x - n.x, o.y - n.y) > vision + 30) return;
      const img = Nave.sprite(j.look, "civ"); const anda = yo ? n.anda : Math.hypot(j.x - o.x, j.y - o.y) > 2;
      ctx.save(); ctx.globalAlpha = j.vivo ? 1 : 0.45; ctx.translate(o.x, o.y - (anda ? Math.abs(Math.sin(t * 10)) * 4 : 0));
      if ((yo ? n.dir : j.dir) < 0) ctx.scale(-1, 1);
      if (img.complete) ctx.drawImage(img, -30, -46, 60, 67);
      ctx.restore();
      ctx.fillStyle = v.socios.includes(j.id) || (yo && v.yo.imp) ? "#ff4d63" : "#fff"; ctx.font = "bold 14px Figtree, " + FE; ctx.globalAlpha = j.vivo ? 1 : 0.5;
      ctx.fillText(j.name, o.x, o.y - 54); ctx.globalAlpha = 1;
    });
    ctx.restore();
    // Oscuridad fuera de la visión
    if (v.yo.vivo) {
      const r = vision * esc, g = ctx.createRadialGradient(W / 2, H / 2, r * 0.55, W / 2, H / 2, r);
      g.addColorStop(0, "rgba(3,2,8,0)"); g.addColorStop(1, "rgba(3,2,8,.93)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // Minimapa
    const mm = byId("naveMini");
    if (mm) {
      const m = mm.getContext("2d"), k = mm.width / NV.W;
      m.clearRect(0, 0, mm.width, mm.height); m.fillStyle = "rgba(10,10,20,.75)"; m.fillRect(0, 0, mm.width, mm.height);
      m.fillStyle = "#5b6488"; NV.ZONAS.forEach(z => m.fillRect(z.x * k, z.y * k, z.w * k, z.h * k));
      m.fillStyle = "#ffd43b"; NV.ESTACIONES.filter(e => mias.has(e.id)).forEach(e => { m.beginPath(); m.arc(e.x * k, e.y * k, 3, 0, 7); m.fill(); });
      m.fillStyle = "#ff4d63"; m.beginPath(); m.arc(NV.BOTON.x * k, NV.BOTON.y * k, 2.5, 0, 7); m.fill();
      m.fillStyle = "#3ddcb1"; m.beginPath(); m.arc(n.x * k, n.y * k, 4, 0, 7); m.fill();
    }
  },

  /* Botones según dónde estoy: usar, matar, reportar */
  acciones() {
    const v = Nave.v, n = UI.nave, box = byId("nvAcc"); if (!box || v.fase !== "juego") { if (box) box.innerHTML = ""; return; }
    const yo = { x: n.x, y: n.y }, b = [];
    const est = !v.yo.imp && NV.ESTACIONES.find(e => NV.dist(yo, e) <= NV.R_USAR && v.yo.tareas.some(t => t.st === e.id && !t.hecha));
    if (est) b.push(`<button class="nv-b usar" data-nv="usar" data-st="${est.id}"><span>${NV.ICONO[est.tipo]}</span>Usar</button>`);
    else if (v.yo.vivo && NV.dist(yo, NV.BOTON) <= NV.R_USAR) b.push(`<button class="nv-b emer" data-nv="emergencia" ${v.yo.emerg ? "" : "disabled"}><span>🚨</span>${v.yo.emerg ? "Reunión" : "Sin usos"}</button>`);
    const c = v.yo.vivo && v.cuerpos.find(c => NV.dist(yo, c) <= NV.R_REPORTAR);
    if (c) b.push(`<button class="nv-b rep" data-nv="reportar" data-id="${c.id}"><span>📢</span>Reportar</button>`);
    if (v.yo.imp && v.yo.vivo) {
      const espera = Math.ceil((v.yo.kcd - (Date.now() - (v.recibido || Date.now()))) / 1000);
      const vict = v.jug.filter(j => j.vivo && j.id !== v.me && !v.socios.includes(j.id)).map(j => ({ j, d: NV.dist(yo, (n.otros[j.id] || j)) })).filter(x => x.d <= NV.R_MATAR).sort((a, b) => a.d - b.d)[0];
      b.push(`<button class="nv-b matar" data-nv="matar" data-id="${vict ? vict.j.id : ""}" ${vict && espera <= 0 ? "" : "disabled"}><span>🔪</span>${espera > 0 ? espera + " s" : "Eliminar"}</button>`);
    }
    const html = b.join("");
    if (box.dataset.h !== html) {
      box.dataset.h = html; box.innerHTML = html;
      box.querySelectorAll("[data-nv]").forEach(x => x.onclick = () => {
        const a = x.dataset.nv;
        if (a === "usar") Nave.abrirTarea(x.dataset.st);
        else if (a === "matar") { Nave.send({ t: "matar", id: x.dataset.id }); Sonido.sfx("bang"); }
        else if (a === "reportar") Nave.send({ t: "reportar", id: x.dataset.id });
        else if (a === "emergencia") Nave.send({ t: "emergencia" });
      });
    }
  },

  hud(v) {
    v.recibido = Date.now();
    if (!UI.nave) return;
    byId("nvProg").style.width = Math.round(v.prog * 100) + "%";
    byId("nvMis").innerHTML = v.yo.imp ? `<span class="nv-imp">🔪 Eres impostor${v.socios.length ? ` con ${v.socios.map(id => esc(v.jug.find(j => j.id === id).name)).join(", ")}` : ""}. Elimina sin que te vean.</span>`
      : v.yo.tareas.map(t => { const e = NV.ESTACIONES.find(x => x.id === t.st); return `<span class="${t.hecha ? "ok" : ""}">${t.hecha ? "✓" : "•"} ${e.nombre} <small>(${NV.salaDe(e.x, e.y)})</small></span>`; }).join("");
    byId("nvRol").textContent = v.yo.vivo ? "" : "👻 Eres un fantasma: puedes atravesar paredes y seguir con tus tareas.";
    // Eliminación: destello rojo
    if (v.kill && UI.naveKill !== v.kill.n) { if (UI.naveKill != null) Nave.destello(); UI.naveKill = v.kill.n; }
    if (!v.yo.vivo && UI.naveVivo) { Nave.anuncio("💀 Te eliminaron", "Ahora eres un fantasma."); }
    UI.naveVivo = v.yo.vivo;
    const capa = byId("nvCapa");
    if (v.fase === "reunion") Nave.capaReunion(v, capa);
    else if (v.fase === "expulsion") Nave.capaExpulsion(v, capa);
    else { capa.hidden = true; capa.dataset.k = ""; }
  },

  destello() { const r = byId("naveRoot"); if (!r) return; r.classList.remove("flash"); void r.offsetWidth; r.classList.add("flash"); },
  anuncio(t, sub) {
    const r = byId("naveRoot"); if (!r) return;
    const d = document.createElement("div"); d.className = "nv-anuncio"; d.innerHTML = `<b>${t}</b>${sub ? `<span>${sub}</span>` : ""}`;
    r.appendChild(d); setTimeout(() => d.remove(), 2600);
  },

  capaReunion(v, capa) {
    const r = v.reunion, k = "r" + r.n + (r.miVoto || "") + v.jug.map(j => j.voto ? 1 : 0).join("");
    const tiempo = Math.max(0, Math.ceil(r.falta / 1000));
    if (capa.dataset.k !== k) {
      if (!capa.dataset.k || !capa.dataset.k.startsWith("r" + r.n)) { Sonido.sfx("alarma"); byId("nvTarea").hidden = true; }
      capa.dataset.k = k; capa.hidden = false;
      const puedo = v.yo.vivo && !r.miVoto;
      capa.innerHTML = `<div class="nv-reunion">
        <div class="nv-r-cab">${r.motivo === "cuerpo" ? `📢 <b>${esc(r.por)}</b> encontró el cuerpo de <b>${esc(r.cuerpo)}</b>` : `🚨 <b>${esc(r.por)}</b> llamó a una reunión de emergencia`}</div>
        <p class="sub center">${v.yo.vivo ? (r.miVoto ? "Ya votaste. Esperando a los demás…" : "Debatan y voten. ¿Quién es el impostor?") : "Los fantasmas no votan."} · <b class="nv-t" id="nvT">${tiempo} s</b></p>
        <div class="nv-votos">${v.jug.map(j => `<button class="nv-v ${!j.vivo ? "muerto" : ""} ${r.miVoto === j.id ? "sel" : ""}" ${puedo && j.vivo && j.id !== v.me ? `data-voto="${j.id}"` : "disabled"}>${Nave.mini(j, 34, j.vivo ? "civ" : "muerto")}<span>${esc(j.name)}${j.id === v.me ? " (tú)" : ""}</span>${j.voto ? `<i>✓ votó</i>` : ""}</button>`).join("")}</div>
        <button class="btn ghost" ${puedo ? `data-voto="saltar"` : "disabled"}>${r.miVoto === "saltar" ? "✓ Saltaste" : "Saltar voto"}</button>
      </div>`;
      capa.querySelectorAll("[data-voto]").forEach(b => b.onclick = () => Nave.send({ t: "voto", id: b.dataset.voto }));
    } else { const t = byId("nvT"); if (t) t.textContent = tiempo + " s"; }
  },

  capaExpulsion(v, capa) {
    const e = v.expulsion, k = "e" + (e.name || "nadie") + e.fin;
    if (capa.dataset.k === k) return;
    capa.dataset.k = k; capa.hidden = false;
    const txt = e.name ? (e.imp ? `${esc(e.name)} era impostor` : `${esc(e.name)} no era impostor`) : e.empate ? "Empate: nadie fue expulsado" : "Saltaron la votación";
    capa.innerHTML = `<div class="nv-expulsion"><div class="nv-flota">${e.name ? personaje((e.look || {}).color || "#748ffc", e.imp ? "imp" : "muerto", 110, (e.look || {}).acc || []) : ""}</div>
      <h2>${txt}</h2><p class="sub">${e.quedan} impostor${e.quedan === 1 ? "" : "es"} a bordo</p></div>`;
    Sonido.sfx(e.name ? (e.imp ? "bien" : "mal") : "tap");
  },

  pantallaFin(v) {
    Nave.parar();
    const gana = (v.ganador === "imp") === v.yo.imp;
    app.innerHTML = `${Nave.opts.local ? head(0) : Net.cabecera()}<section class="screen">
      <div class="verdict ${gana ? "good" : "bad"}"><div class="big">${v.ganador === "imp" ? "Ganan los impostores" : "Gana la tripulación"}</div><div class="note">${esc(v.motivo || "")}</div></div>
      <div class="panel"><span class="label">Tripulación</span><ul class="reveal-list">${v.jug.map(j => `<li>${Nave.mini(j, 30, j.imp ? "imp" : j.vivo ? "civ" : "muerto")}<span class="nm">${esc(j.name)}${j.vivo ? "" : " 💀"}</span>${j.imp ? `<span class="r-imp">Impostor</span>` : `<span class="r-civ">Tripulante</span>`}</li>`).join("")}</ul></div>
      ${Nave.opts.local || Nave.opts.isHost ? `<div class="row"><button class="btn" id="nvOtra">Otra partida</button><button class="btn ghost" id="nvFuera">${Nave.opts.local ? "Inicio" : "Volver a la sala"}</button></div>` : `<p class="sub center">El anfitrión puede empezar otra partida.</p>`}
    </section>`;
    on("nvOtra", () => Nave.send({ t: "again" }));
    on("nvFuera", () => Nave.opts.local ? go("home") : Nave.send({ t: "lobby" }));
  },

  /* ---------- Mini-juegos de tareas ---------- */
  abrirTarea(st) {
    const e = NV.ESTACIONES.find(x => x.id === st), box = byId("nvTarea");
    box.hidden = false;
    const terminar = () => { box.innerHTML = `<div class="nv-tbox"><h3>✅ ¡Tarea completa!</h3></div>`; Sonido.sfx("bien"); Nave.send({ t: "tarea", st }); setTimeout(() => { box.hidden = true; }, 700); };
    const cerrar = `<button class="linkish nv-tcerrar" id="tCerrar">Cerrar</button>`;
    if (e.tipo === "cables") {
      const cols = shuffle(["#ff4d63", "#4dabf7", "#ffd43b", "#cc5de8"]), der = shuffle(cols.slice());
      let sel = null, hechos = 0;
      box.innerHTML = `<div class="nv-tbox"><h3>${e.nombre}</h3><p class="sub">Toca un cable de la izquierda y después el del mismo color.</p>
        <div class="cables"><div>${cols.map(c => `<button class="cable" data-l="${c}" style="--c:${c}"></button>`).join("")}</div><div>${der.map(c => `<button class="cable" data-r="${c}" style="--c:${c}"></button>`).join("")}</div></div>${cerrar}</div>`;
      box.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { box.querySelectorAll("[data-l]").forEach(x => x.classList.remove("sel")); sel = b.dataset.l; b.classList.add("sel"); });
      box.querySelectorAll("[data-r]").forEach(b => b.onclick = () => {
        if (!sel) return;
        if (b.dataset.r === sel) { b.classList.add("ok"); box.querySelector(`[data-l="${sel}"]`).classList.add("ok"); b.disabled = true; box.querySelector(`[data-l="${sel}"]`).disabled = true; sel = null; Sonido.sfx("tap"); if (++hechos === 4) terminar(); }
        else Sonido.sfx("clic");
      });
    } else if (e.tipo === "descarga") {
      box.innerHTML = `<div class="nv-tbox"><h3>${e.nombre}</h3><p class="sub">Mantén apretado el botón hasta llenar la barra.</p><div class="bar grande"><i id="tBar" style="width:0%"></i></div><button class="btn" id="tHold">Mantener presionado</button>${cerrar}</div>`;
      let p = 0, iv = null;
      const sube = () => { clearInterval(iv); iv = setInterval(() => { p += 4; byId("tBar").style.width = p + "%"; if (p >= 100) { clearInterval(iv); terminar(); } }, 100); };
      const baja = () => clearInterval(iv);
      const h = byId("tHold");
      h.addEventListener("pointerdown", sube); h.addEventListener("pointerup", baja); h.addEventListener("pointerleave", baja); h.addEventListener("pointercancel", baja);
    } else if (e.tipo === "calibrar") {
      let aciertos = 0, x = 0, dirx = 1;
      box.innerHTML = `<div class="nv-tbox"><h3>${e.nombre}</h3><p class="sub">Toca cuando la aguja esté en la zona verde (3 veces).</p><div class="calib"><span class="zona"></span><i id="tAguja"></i></div><div class="calib-ok" id="tOk">○ ○ ○</div><button class="btn" id="tTap">¡Ahora!</button>${cerrar}</div>`;
      const iv = setInterval(() => { if (!byId("tAguja")) return clearInterval(iv); x += dirx * (1.1 + aciertos * 0.35); if (x >= 100 || x <= 0) dirx *= -1; byId("tAguja").style.left = x + "%"; }, 16);
      byId("tTap").onclick = () => {
        if (x >= 38 && x <= 62) { aciertos++; Sonido.sfx("tap"); byId("tOk").textContent = "●".repeat(aciertos) + " ○".repeat(3 - aciertos); if (aciertos === 3) { clearInterval(iv); terminar(); } }
        else { aciertos = 0; Sonido.sfx("clic"); byId("tOk").textContent = "○ ○ ○"; }
      };
    } else {
      const cod = String(1000 + Math.floor(Math.random() * 9000)); let esc2 = "";
      box.innerHTML = `<div class="nv-tbox"><h3>${e.nombre}</h3><p class="sub">Copia el código: <b class="codigo-tarea">${cod}</b></p><div class="pin-dots" id="tDots">${"<i></i>".repeat(4)}</div>
        <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map(k => k === "" ? "<span></span>" : `<button data-k="${k}">${k}</button>`).join("")}</div>${cerrar}</div>`;
      box.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
        esc2 = b.dataset.k === "⌫" ? esc2.slice(0, -1) : (esc2 + b.dataset.k).slice(0, 4);
        byId("tDots").innerHTML = [0, 1, 2, 3].map(i => `<i class="${i < esc2.length ? "on" : ""}"></i>`).join("");
        if (esc2.length === 4) { if (esc2 === cod) terminar(); else { esc2 = ""; Sonido.sfx("clic"); byId("tDots").classList.add("error"); setTimeout(() => byId("tDots") && byId("tDots").classList.remove("error"), 400); } }
      });
    }
    on("tCerrar", () => { box.hidden = true; });
  },

  /* ---------- Práctica en un teléfono (con compus) y online ---------- */
  empezarLocal() {
    const u = BD.sesion();
    const yo = { id: "yo", name: u ? u.nombre : (S.players[0] || "Tú"), look: u ? u.look : null };
    const bots = ["Rita", "Tito", "Pepa", "Lalo", "Momo"].map((n, i) => ({ id: "b" + i, name: n, bot: true, look: { color: COLORES[(i + 3) % COLORES.length], acc: [] } }));
    S.nave = Nave.setup([yo, ...bots]);
    Object.assign(UI, { naveCapa: null, naveKill: null, naveVivo: true });
    clearInterval(Nave.hostTimer);
    let prev = Date.now();
    Nave.hostTimer = setInterval(() => {
      const s = S.nave; if (!s || S.screen !== "nave") return;
      const ahora = Date.now(); Nave.tick(s, (ahora - prev) / 1000); prev = ahora;
      render();
    }, 100);
    go("nave");
  },
  empezarOn(R) {
    const jug = R.players.filter(p => p.on);
    if (jug.length < 3) return "Hacen falta al menos 3 jugadores.";
    if (jug.length > 10) return "La nave lleva hasta 10 jugadores.";
    R.nave = Nave.setup(jug.map(p => ({ id: p.id, name: p.name, look: p.look })));
    R.game = "nave";
    Nave.relojHost(R);
    return null;
  },
  /* Reloj del anfitrión online: sigue andando aunque el anfitrión esté mirando otra pantalla */
  relojHost(R) {
    clearInterval(Nave.relojOn);
    let prev = Date.now();
    Nave.relojOn = setInterval(() => {
      if (!Net.R || Net.R.game !== "nave" || !Net.R.nave) { clearInterval(Nave.relojOn); Nave.relojOn = null; return; }
      const ahora = Date.now(); Nave.tick(Net.R.nave, (ahora - prev) / 1000); prev = ahora;
      Net.broadcast();
    }, 100);
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") { const e = Nave.empezarOn(R); R.err = e || ""; return; }
    if (a.t === "lobby" && pid === "H") { R.game = null; R.nave = null; return; }
    Nave.act(R.nave, pid, a);
  }
};

PANTALLAS.nave = () => {
  const s = S.nave; if (!s) return go("home");
  Nave.render(Nave.view(s, "yo"), a => {
    if (a.t === "again") return Nave.empezarLocal();
    Nave.act(s, "yo", a);
    if (a.t !== "pos") render();
  }, { local: true });
};

PANTALLAS.naveIntro = () => {
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div class="nave-intro"><span class="nave-mini grande">🚀</span><h2>La Nave</h2>
      <p class="sub">Muévete por la nave y haz tus tareas. Entre la tripulación hay un impostor que elimina a escondidas. Si encuentras un cuerpo, repórtalo: todos debaten y votan a quién echar.</p></div>
    <div class="panel"><span class="label">Cómo se juega</span>
      <ul class="reglas-pts">
        <li><span>🕹️ Moverse</span><b>Arrastra el dedo en la pantalla (o flechas)</b></li>
        <li><span>🟡 Tareas</span><b>Ve a las estaciones que brillan y toca Usar</b></li>
        <li><span>🔪 Impostor</span><b>Elimina cuando nadie mira (cada 25 s)</b></li>
        <li><span>📢 Cuerpo</span><b>Repórtalo y se arma la reunión</b></li>
        <li><span>🚨 Botón rojo</span><b>Reunión de emergencia (1 por persona)</b></li>
        <li><span>🏆 Tripulación</span><b>Gana con todas las tareas o echando al impostor</b></li>
      </ul></div>
    <button class="btn" id="practica">Practicar contra 5 compus</button>
    <button class="btn ghost" id="conAmigos">Jugar con amigos (crear sala)</button>
    <button class="linkish" id="volver">Inicio</button>
  </section>`;
  on("practica", () => Nave.empezarLocal());
  on("conAmigos", () => go("onCrear"));
  on("volver", () => go("home"));
};
