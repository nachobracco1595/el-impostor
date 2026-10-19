/* Personajes de la Arena: cada clase es un personaje propio, con su nivel, evoluciones, puntos y equipo.
   - Experiencia: se gana peleando con esa clase (más por ganar y por eliminar).
   - Nivel máximo 30. Cada nivel da 3 puntos para repartir a mano (fuerza, vida, agilidad, defensa).
     Pasado el 30, la experiencia sigue dando puntos de maestría (hasta 30 más). Reiniciar los puntos es gratis.
   - Evoluciones: en el nivel 10 se elige uno de dos caminos y en el 20 se evoluciona otra vez en ese camino.
   - Equipo: arma, ropa, casco y botas propios de cada clase, en 9 materiales y 2 estilos.
     Se compran con monedas cuando el personaje llega al nivel del material; lo comprado se puede cambiar cuando quieras. */
const HE = {
  MAX: 30, MAESTRIA: 30, PTS_NIVEL: 3, XP_MAESTRIA: 400,
  xpNivel: n => 30 + 12 * n,                   // lo que falta para pasar del nivel n al n+1
  STATS: {
    fue: ["Fuerza", "💪", "+1,5% de daño"],
    vid: ["Vida", "❤️", "+2% de vida"],
    agi: ["Agilidad", "👟", "+0,5% de velocidad y ataques más seguidos"],
    def: ["Defensa", "🛡️", "-0,6% de daño recibido"]
  },
  SLOTS: { arma: ["Arma", "⚔️"], ropa: ["Ropa", "🦺"], casco: ["Cabeza", "⛑️"], botas: ["Pies", "🥾"] },
  NIVEL_TIER: [1, 3, 6, 9, 12, 16, 20, 25, 30],
  PRECIO_TIER: [0, 80, 180, 320, 500, 750, 1050, 1400, 1800],
  /* Dos estilos por lugar: [nombre, género, qué da por material] */
  EQUIPO: {
    guerrero: {
      arma: [["Espada", "f", { dano: .08 }], ["Hacha", "f", { dano: .11, cd: .15 }]],
      ropa: [["Armadura", "f", { def: .035 }], ["Cota de malla", "f", { hp: .05 }]],
      casco: [["Yelmo", "m", { def: .02 }], ["Casco", "m", { hp: .03 }]],
      botas: [["Grebas", "fp", { vel: .03 }], ["Botas pesadas", "fp", { def: .015, vel: .015 }]]
    },
    arquero: {
      arma: [["Arco", "m", { dano: .08 }], ["Ballesta", "f", { dano: .11, cd: .15, alc: .01 }]],
      ropa: [["Jubón", "m", { def: .03 }], ["Capa", "f", { hp: .03, vel: .01 }]],
      casco: [["Capucha", "f", { def: .02 }], ["Sombrero", "m", { crit: .006 }]],
      botas: [["Botas", "fp", { vel: .03 }], ["Sandalias", "fp", { vel: .02, cdm: .01 }]]
    },
    mago: {
      arma: [["Bastón", "m", { dano: .08 }], ["Varita", "f", { dano: .05, cdm: .02 }]],
      ropa: [["Túnica", "f", { hp: .04 }], ["Manto", "m", { def: .03 }]],
      casco: [["Sombrero", "m", { def: .02 }], ["Corona", "f", { dano: .02 }]],
      botas: [["Zapatos", "mp", { vel: .03 }], ["Botas", "fp", { def: .015, vel: .015 }]]
    },
    asesino: {
      arma: [["Dagas", "fp", { dano: .07, crit: .004 }], ["Katana", "f", { dano: .08, alc: .025 }]],
      ropa: [["Traje", "m", { def: .03 }], ["Capa", "f", { vel: .015, hp: .02 }]],
      casco: [["Máscara", "f", { crit: .006 }], ["Capucha", "f", { def: .02 }]],
      botas: [["Botas", "fp", { vel: .03 }], ["Tabi", "mp", { vel: .02, crit: .003 }]]
    }
  },
  QUE: { dano: ["daño", 1], hp: ["vida", 1], def: ["defensa", 1], vel: ["velocidad", 1], cd: ["más lento", 1], cdm: ["ataques más seguidos", 1], alc: ["alcance", 1], crit: ["crítico", 1] },
  /* Evoluciones: [nivel 10, nivel 20] de cada camino. pas = lo que suman */
  EVOS: {
    guerrero: {
      a: [{ id: "caballero", nombre: "Caballero", ic: "🛡️", desc: "+10% de vida y +5% de defensa.", pas: { hp: .10, def: .05 } },
          { id: "paladin", nombre: "Paladín", ic: "⚜️", desc: "+20% de vida, +8% de defensa y se cura 1% de vida por segundo.", pas: { hp: .20, def: .08, regen: .01 } }],
      b: [{ id: "barbaro", nombre: "Bárbaro", ic: "🪓", desc: "+10% de daño.", pas: { dano: .10 } },
          { id: "berserker", nombre: "Berserker", ic: "😡", desc: "+15% de daño y, con menos de 40% de vida, pega +40%.", pas: { dano: .15, furia: .40 } }]
    },
    arquero: {
      a: [{ id: "cazador", nombre: "Cazador", ic: "🐺", desc: "Sus flechas frenan al enemigo 0,6 s.", pas: { lento: 600 } },
          { id: "montaraz", nombre: "Montaraz", ic: "🌲", desc: "Frenan 1 s y la lluvia dispara 7 flechas.", pas: { lento: 1000, flechas: 7 } }],
      b: [{ id: "tirador", nombre: "Tirador", ic: "🎯", desc: "+20% de alcance y 10% de crítico.", pas: { alc: .20, crit: .10 } },
          { id: "francotirador", nombre: "Francotirador", ic: "🔭", desc: "+40% de alcance y 20% de crítico.", pas: { alc: .40, crit: .20 } }]
    },
    mago: {
      a: [{ id: "piromante", nombre: "Piromante", ic: "🔥", desc: "Explosiones 25% más grandes.", pas: { area: .25 } },
          { id: "senor-fuego", nombre: "Señor del fuego", ic: "🌋", desc: "Explosiones 50% más grandes que además queman 3 s.", pas: { area: .50, quema: .15 } }],
      b: [{ id: "criomante", nombre: "Criomante", ic: "❄️", desc: "Las bolas frenan al enemigo 1 s.", pas: { lento: 1000 } },
          { id: "glacial", nombre: "Glacial", ic: "🧊", desc: "Frenan 1,5 s y la nova es 40% más grande.", pas: { lento: 1500, nova: .40 } }]
    },
    asesino: {
      a: [{ id: "ninja", nombre: "Ninja", ic: "🌀", desc: "Especial 25% más seguido y +6% de velocidad.", pas: { espCd: .25, vel: .06 } },
          { id: "maestro-ninja", nombre: "Maestro ninja", ic: "🐉", desc: "Especial 45% más seguido y +12% de velocidad.", pas: { espCd: .45, vel: .12 } }],
      b: [{ id: "sicario", nombre: "Sicario", ic: "🗡️", desc: "+10% de crítico.", pas: { crit: .10 } },
          { id: "parca", nombre: "Parca", ic: "💀", desc: "+20% de crítico y los críticos pegan ×2,5.", pas: { crit: .20, critX: 2.5 } }]
    }
  }
};

const Heroes = {
  /* ---------- Progreso guardado en el perfil (u.diario.arena) ---------- */
  nuevo() { return { xp: 0, pts: { fue: 0, vid: 0, agi: 0, def: 0 }, evo: [], items: ["arma:0:0", "ropa:0:0", "casco:0:0", "botas:0:0"], eq: { arma: "arma:0:0", ropa: "ropa:0:0", casco: null, botas: "botas:0:0" } }; },
  datos(u) {
    Eco.completar(u);
    const a = u.diario.arena = u.diario.arena || {};
    if (!a.clase) a.clase = "guerrero";
    if (!a.pj) {
      // Pasa el equipo de antes (uno solo para todas las clases) a cada personaje nuevo, sin perder lo comprado
      const viejo = Object.assign({ casco: 0, armadura: 0, botas: 0, arma: 0 }, a.eq || {});
      a.pj = {};
      for (const c of Object.keys(AR.CLASES)) {
        const p = Heroes.nuevo();
        for (const [slot, ant] of [["arma", "arma"], ["ropa", "armadura"], ["casco", "casco"], ["botas", "botas"]]) {
          const n = Math.max(0, Math.min(8, viejo[ant] | 0));
          if (n > 0) { const id = `${slot}:0:${n}`; p.items.push(id); p.eq[slot] = id; }
        }
        a.pj[c] = p;
      }
      a.migrado = Date.now();
    }
    // Se completa lo que falte sin reemplazar el objeto (así nadie se queda con una copia vieja)
    for (const c of Object.keys(AR.CLASES)) { const q = a.pj[c] = a.pj[c] || {}, base = Heroes.nuevo(); for (const k of Object.keys(base)) if (q[k] == null) q[k] = base[k]; }
    if (!AR.CLASES[a.clase]) a.clase = "guerrero";
    return a;
  },
  pj(u, clase) { const a = this.datos(u); return a.pj[clase || a.clase]; },
  /* Nivel y maestría que corresponden a la experiencia */
  nivel(xp) {
    let n = 1, resto = Math.max(0, xp | 0);
    while (n < HE.MAX && resto >= HE.xpNivel(n)) { resto -= HE.xpNivel(n); n++; }
    const maestria = n >= HE.MAX ? Math.min(HE.MAESTRIA, Math.floor(resto / HE.XP_MAESTRIA)) : 0;
    const falta = n < HE.MAX ? HE.xpNivel(n) : HE.XP_MAESTRIA;
    const enEste = n < HE.MAX ? resto : resto - maestria * HE.XP_MAESTRIA;
    return { n, maestria, enEste, falta, tope: n >= HE.MAX };
  },
  puntosTotales: (n, maestria) => n * HE.PTS_NIVEL + maestria,
  usados: pts => Object.values(pts).reduce((t, v) => t + (v | 0), 0),
  libres(p) { const L = this.nivel(p.xp); return this.puntosTotales(L.n, L.maestria) - this.usados(p.pts); },

  /* ---------- Equipo ---------- */
  item(clase, id) {
    const [slot, v, t] = String(id || "").split(":"), est = HE.EQUIPO[clase] && HE.EQUIPO[clase][slot] && HE.EQUIPO[clase][slot][+v];
    if (!est || !(+t >= 0 && +t <= 8)) return null;
    const tier = +t, N = TR.NIVELES[tier], [nom, gen, por] = est;
    let suf = gen[0] === "m" ? N.m : N.f;
    if (N.id === "encantado") suf = { m: "encantado", f: "encantada", fp: "encantadas", mp: "encantados" }[gen];
    const bonus = Object.fromEntries(Object.entries(por).map(([k, x]) => [k, x * (tier + 1)]));
    return { id: `${slot}:${+v}:${tier}`, slot, v: +v, tier, nombre: `${nom} ${suf}`, color: N.color, nivel: HE.NIVEL_TIER[tier], precio: HE.PRECIO_TIER[tier], bonus };
  },
  catalogo(clase, slot) { const out = []; for (let t = 0; t <= 8; t++) for (let v = 0; v < 2; v++) out.push(this.item(clase, `${slot}:${v}:${t}`)); return out; },
  textoBonus(b) {
    const pct = x => `${Math.round(x * 1000) / 10}%`.replace(".", ",");
    return Object.entries(b).map(([k, x]) => k === "cd" ? `ataca ${pct(x)} más lento` : k === "cdm" ? `ataca ${pct(x)} más seguido` : `+${pct(x)} de ${HE.QUE[k][0]}`).join(" · ");
  },

  /* ---------- Lo que se manda a la pelea (también online) ---------- */
  perfil(u) {
    const a = this.datos(u), p = a.pj[a.clase], L = this.nivel(p.xp);
    return { clase: a.clase, lv: L.n, ma: L.maestria, pts: { ...p.pts }, evo: p.evo.slice(0, 2), eq: { ...p.eq }, elo: Arena.elo(u) };
  },
  validar(p) {
    const ok = p && typeof p === "object", clase = ok && AR.CLASES[p.clase] ? p.clase : "guerrero";
    const lv = Math.max(1, Math.min(HE.MAX, ok ? p.lv | 0 : 1)), ma = Math.max(0, Math.min(HE.MAESTRIA, ok ? p.ma | 0 : 0));
    const pts = {}; let quedan = this.puntosTotales(lv, ma);
    for (const k of Object.keys(HE.STATS)) { const x = Math.max(0, Math.min(quedan, ok && p.pts ? p.pts[k] | 0 : 0)); pts[k] = x; quedan -= x; }
    const E = HE.EVOS[clase], evo = [];
    if (ok && Array.isArray(p.evo) && lv >= 10) {
      const rama = ["a", "b"].find(r => E[r][0].id === p.evo[0]);
      if (rama) { evo.push(E[rama][0].id); if (lv >= 20 && p.evo[1] === E[rama][1].id) evo.push(E[rama][1].id); }
    }
    const eq = {};
    for (const s of Object.keys(HE.SLOTS)) { const it = ok && p.eq ? this.item(clase, p.eq[s]) : null; eq[s] = it && it.slot === s ? it.id : null; }
    return { clase, lv, ma, pts, evo, eq, elo: Math.max(0, Math.min(4000, ok ? (p.elo | 0) || 1000 : 1000)) };
  },
  evoDe(clase, id) { const E = HE.EVOS[clase]; for (const r of ["a", "b"]) for (const e of E[r]) if (e.id === id) return { ...e, rama: r }; return null; },
  /* Stats para pelear: clase + puntos + evoluciones + equipo */
  stats(p) {
    const C = AR.CLASES[p.clase], b = { dano: 0, hp: 0, def: 0, vel: 0, cd: 0, cdm: 0, alc: 0, crit: 0 }, pas = {};
    const ver = { arma: 0, armadura: -1, casco: -1, botas: -1 }, estilo = { arma: 0 };
    for (const s of Object.keys(HE.SLOTS)) {
      const it = this.item(p.clase, p.eq[s]); if (!it) continue;
      for (const [k, x] of Object.entries(it.bonus)) b[k] += x;
      ver[s === "ropa" ? "armadura" : s] = it.tier; if (s === "arma") estilo.arma = it.v;
    }
    for (const id of p.evo) { const e = this.evoDe(p.clase, id); if (e) for (const [k, x] of Object.entries(e.pas)) pas[k] = k === "flechas" || k === "critX" || k === "lento" ? Math.max(pas[k] || 0, x) : (pas[k] || 0) + x; }
    // Cada evolución reemplaza a la anterior en lo que suma (no se acumulan las dos del mismo camino)
    if (p.evo.length === 2) { const e1 = this.evoDe(p.clase, p.evo[0]); for (const [k, x] of Object.entries(e1.pas)) if (!["flechas", "critX", "lento"].includes(k)) pas[k] -= x; }
    const P = p.pts;
    return {
      hp: Math.round(C.hp * (1 + P.vid * 0.02 + b.hp + (pas.hp || 0))),
      vel: C.vel * (1 + P.agi * 0.005 + b.vel + (pas.vel || 0)),
      mult: 1 + P.fue * 0.015 + b.dano + (pas.dano || 0),
      def: 1 - Math.min(0.6, P.def * 0.006 + b.def + (pas.def || 0)),
      cd: Math.max(0.6, 1 - P.agi * 0.004 - b.cdm + b.cd),
      alc: 1 + b.alc + (pas.alc || 0), crit: b.crit + (pas.crit || 0), critX: pas.critX || 2,
      area: 1 + (pas.area || 0), nova: 1 + (pas.nova || 0), lento: pas.lento || 0, quema: pas.quema || 0, regen: pas.regen || 0, furia: pas.furia || 0,
      espCd: 1 - (pas.espCd || 0), flechas: pas.flechas || 5,
      ver, estilo, evoIc: p.evo.length ? this.evoDe(p.clase, p.evo[p.evo.length - 1]).ic : null, lv: p.lv
    };
  },
  /* Compu de un nivel dado, con puntos, evolución y equipo que le corresponden */
  cpu(lv) {
    const clase = pick(Object.keys(AR.CLASES)), ma = 0, total = this.puntosTotales(lv, ma);
    const reparto = { guerrero: [.35, .35, .1, .2], arquero: [.45, .25, .2, .1], mago: [.45, .3, .1, .15], asesino: [.4, .2, .3, .1] }[clase];
    const pts = {}; let usados = 0; Object.keys(HE.STATS).forEach((k, i) => { pts[k] = Math.floor(total * reparto[i]); usados += pts[k]; }); pts.fue += total - usados;
    const rama = Math.random() < 0.5 ? "a" : "b", E = HE.EVOS[clase][rama], evo = lv >= 20 ? [E[0].id, E[1].id] : lv >= 10 ? [E[0].id] : [];
    const tier = HE.NIVEL_TIER.filter(n => n <= lv).length - 1, eq = {};
    for (const s of Object.keys(HE.SLOTS)) { const t = Math.max(0, tier - (Math.random() < 0.4 ? 1 : 0)); eq[s] = `${s}:${Math.random() < 0.5 ? 0 : 1}:${t}`; }
    return { clase, lv, ma, pts, evo, eq };
  },

  /* ---------- Experiencia al terminar una pelea ---------- */
  ganarXp(u, clase, xp) {
    if (!AR.CLASES[clase] || !(xp > 0)) return;
    const a = this.datos(u), p = a.pj[clase], antes = this.nivel(p.xp);
    p.xp += Math.min(250, xp | 0);
    const ahora = this.nivel(p.xp), C = AR.CLASES[clase];
    if (ahora.n > antes.n || ahora.maestria > antes.maestria) {
      const pts = this.puntosTotales(ahora.n, ahora.maestria) - this.puntosTotales(antes.n, antes.maestria);
      const evo = (antes.n < 10 && ahora.n >= 10) || (antes.n < 20 && ahora.n >= 20);
      setTimeout(() => Toast.mostrar(`<div class="t-ic">${C.ic}</div><div class="t-txt"><small>${C.nombre}</small><b>${ahora.n > antes.n ? `¡Nivel ${ahora.n}!` : `Maestría ${ahora.maestria}`}</b><span>+${pts} punto${pts > 1 ? "s" : ""} para repartir${evo ? " · ¡puede evolucionar!" : ""}</span></div>`, "logro"), 900);
    }
  },

  /* ---------- Acciones del armado ---------- */
  guardar(u) { Eco.guardar(u); render(); },
  punto(u, k, d) {
    const p = this.pj(u); if (!HE.STATS[k]) return;
    if (d > 0 && this.libres(p) <= 0) return;
    if (d < 0 && p.pts[k] <= 0) return;
    p.pts[k] += d; if (typeof Sonido !== "undefined") Sonido.sfx("clic"); this.guardar(u);
  },
  reiniciar(u) { const p = this.pj(u); p.pts = { fue: 0, vid: 0, agi: 0, def: 0 }; this.guardar(u); },
  evolucionar(u, id) {
    const a = this.datos(u), p = a.pj[a.clase], L = this.nivel(p.xp), e = this.evoDe(a.clase, id);
    if (!e) return;
    const paso = HE.EVOS[a.clase][e.rama].indexOf(HE.EVOS[a.clase][e.rama].find(x => x.id === id));
    if (paso === 0 && (L.n < 10 || p.evo.length)) return;
    if (paso === 1 && (L.n < 20 || p.evo[0] !== HE.EVOS[a.clase][e.rama][0].id || p.evo.length > 1)) return;
    p.evo.push(id);
    if (typeof Sonido !== "undefined") Sonido.sfx("logro");
    Toast.mostrar(`<div class="t-ic">${e.ic}</div><div class="t-txt"><small>¡Evolución!</small><b>${esc(e.nombre)}</b><span>${esc(e.desc)}</span></div>`, "logro");
    this.guardar(u);
  },
  comprar(u, id) {
    const a = this.datos(u), p = a.pj[a.clase], it = this.item(a.clase, id), L = this.nivel(p.xp);
    if (!it || p.items.includes(it.id) || L.n < it.nivel || u.monedas < it.precio) return;
    u.monedas -= it.precio; p.items.push(it.id); p.eq[it.slot] = it.id;
    if (u.nube) Nube.actividad("compra", "arena", 0, -it.precio);
    if (typeof Sonido !== "undefined") Sonido.sfx("monedas");
    Toast.mostrar(`<div class="t-ic">${HE.SLOTS[it.slot][1]}</div><div class="t-txt"><small>Comprado y puesto</small><b>${esc(it.nombre)}</b></div>`, "logro");
    this.guardar(u);
  },
  equipar(u, slot, id) {
    const p = this.pj(u);
    if (id && !p.items.includes(id)) return;
    if (!id && slot !== "casco") return;      // sin arma, ropa o botas no se pelea (el casco es opcional)
    p.eq[slot] = id; this.guardar(u);
  }
};

/* ---------- Armería: personajes, evoluciones, puntos, equipo y a pelear ---------- */
PANTALLAS.arenaIntro = () => {
  const u = BD.sesion();
  if (!u) {
    app.innerHTML = `${head(0)}<section class="stage">${personaje("#ff4d63", "civ", 110, ["casco"])}<h2>Arena</h2><p class="sub">Necesitas un perfil para guardar tus personajes y tu ELO.</p><button class="btn" id="arPerfil">Crear o elegir perfil</button><button class="btn ghost" id="volver">Volver</button></section>`;
    on("arPerfil", () => go("cuenta")); on("volver", () => go("home")); return;
  }
  const a = Heroes.datos(u), clase = a.clase, C = AR.CLASES[clase], p = a.pj[clase], L = Heroes.nivel(p.xp), libres = Heroes.libres(p);
  const perfil = Heroes.validar(Heroes.perfil(u)), st = Heroes.stats(perfil), elo = Arena.elo(u), sa = u.stats.arena || {};
  const cfg = S.arenaCfg || { modo: "duelo", nivel: "normal", esc: "ring" }, U = UI.heroe = UI.heroe || { slot: null };
  const evoAct = p.evo.length ? Heroes.evoDe(clase, p.evo[p.evo.length - 1]) : null;
  const nombrePj = evoAct ? evoAct.nombre : C.nombre;
  // Pestañas: un personaje por clase
  const tabs = `<div class="he-tabs">${Object.entries(AR.CLASES).map(([k, X]) => { const q = a.pj[k], l = Heroes.nivel(q.xp), e = q.evo.length ? Heroes.evoDe(k, q.evo[q.evo.length - 1]) : null, aviso = Heroes.libres(q) > 0 || (l.n >= 10 && !q.evo.length) || (l.n >= 20 && q.evo.length === 1);
    return `<button class="he-tab ${k === clase ? "on" : ""}" data-pj="${k}"><span class="ic">${e ? e.ic : X.ic}</span><b>${esc(e ? e.nombre : X.nombre)}</b><small>Nv ${l.n}</small>${aviso ? `<i class="he-punto"></i>` : ""}</button>`; }).join("")}</div>`;
  // Evoluciones
  const E = HE.EVOS[clase], rama = p.evo.length ? Heroes.evoDe(clase, p.evo[0]).rama : null;
  const evoCard = (e, paso, estado) => `<div class="he-evo ${estado}"><span class="ic">${e.ic}</span><div><b>${esc(e.nombre)}</b><small>${esc(e.desc)}</small></div>
    ${estado === "elegir" ? `<button class="btn chico" data-evo="${e.id}">Elegir</button>` : estado === "lista" ? `<button class="btn chico" data-evo="${e.id}">Evolucionar</button>` : estado === "hecha" ? `<span class="ok">✓</span>` : `<span class="he-req">Nv ${paso ? 20 : 10}</span>`}</div>`;
  const evos = !rama
    ? `<p class="sub">${L.n >= 10 ? "¡Ya puede evolucionar! Elegí un camino (es para siempre en este personaje):" : `En el nivel 10 elegís uno de estos dos caminos:`}</p>
       <div class="he-caminos">${["a", "b"].map(r => `<div class="he-camino">${evoCard(E[r][0], 0, L.n >= 10 ? "elegir" : "bloq")}${evoCard(E[r][1], 1, "bloq")}</div>`).join("")}</div>`
    : `<div class="he-camino solo">${evoCard(E[rama][0], 0, "hecha")}${evoCard(E[rama][1], 1, p.evo.length > 1 ? "hecha" : L.n >= 20 ? "lista" : "bloq")}</div>`;
  // Puntos
  const statsHTML = Object.entries(HE.STATS).map(([k, [nom, ic, desc]]) => `<div class="he-stat"><span class="ic">${ic}</span><div><b>${nom} <em>${p.pts[k]}</em></b><small>${desc}</small></div>
    <button class="he-mas menos" data-pt="${k}" data-d="-1" ${p.pts[k] ? "" : "disabled"} aria-label="Quitar un punto de ${nom}">−</button><button class="he-mas" data-pt="${k}" data-d="1" ${libres > 0 ? "" : "disabled"} aria-label="Sumar un punto a ${nom}">+</button></div>`).join("");
  // Equipo
  const slotHTML = Object.entries(HE.SLOTS).map(([s, [nom, ic]]) => {
    const it = Heroes.item(clase, p.eq[s]), abierto = U.slot === s;
    return `<button class="he-slot ${abierto ? "on" : ""}" data-slot="${s}"><span class="he-ic" style="--c:${it ? it.color : "transparent"}">${ic}</span><div><small>${nom}</small><b>${it ? esc(it.nombre) : "Nada"}</b>${it ? `<small>${Heroes.textoBonus(it.bonus)}</small>` : ""}</div><span class="he-flecha">${abierto ? "▲" : "▼"}</span></button>
      ${abierto ? `<div class="he-items">${s === "casco" ? `<div class="he-item ${p.eq.casco ? "" : "puesto"}"><span class="he-ic">🚫</span><div><b>Sin nada en la cabeza</b></div>${p.eq.casco ? `<button class="btn chico ghost" data-equipar="casco" data-id="">Sacar</button>` : `<span class="ok">Puesto</span>`}</div>` : ""}
        ${Heroes.catalogo(clase, s).map(x => { const tengo = p.items.includes(x.id), puesto = p.eq[s] === x.id, bloq = !tengo && L.n < x.nivel;
          return `<div class="he-item ${puesto ? "puesto" : ""} ${bloq ? "bloq" : ""}"><span class="he-ic" style="--c:${x.color}">${ic}</span><div><b>${esc(x.nombre)}</b><small>${Heroes.textoBonus(x.bonus)}</small></div>
            ${puesto ? `<span class="ok">Puesto</span>` : tengo ? `<button class="btn chico ghost" data-equipar="${s}" data-id="${x.id}">Poner</button>` : bloq ? `<span class="he-req">🔒 Nv ${x.nivel}</span>` : `<button class="btn chico" data-comprar="${x.id}" ${u.monedas < x.precio ? "disabled" : ""}>🪙 ${x.precio}</button>`}</div>`; }).join("")}</div>` : ""}`;
  }).join("");
  const xpTxt = L.tope ? (L.maestria >= HE.MAESTRIA ? "¡Maestría completa!" : `Maestría ${L.maestria} · ${L.enEste}/${L.falta} XP`) : `${L.enEste}/${L.falta} XP para el nivel ${L.n + 1}`;
  app.innerHTML = `${Cuenta.barra()}<section class="screen arena-pj">
    <div class="headrow"><h1 class="titulo chico">La <span>Arena</span></h1><span class="chip-mon">🪙 ${u.monedas}</span></div>
    ${tabs}
    <div class="ar-perfil he-ficha">
      <div class="ar-retrato"><canvas id="arPrev" width="160" height="170"></canvas></div>
      <div class="ar-datos"><span class="label">${C.ic} ${esc(C.nombre)}${evoAct ? ` → ${esc(evoAct.nombre)}` : ""}</span><b class="ar-elo he-nv">Nv ${L.n}${L.maestria ? ` <small>+${L.maestria}</small>` : ""}</b>
        <div class="he-xp"><i style="width:${Math.min(100, L.enEste / L.falta * 100)}%"></i></div><small>${xpTxt}</small>
        <div class="ar-st"><span>❤️ ${st.hp}</span><span>👟 ${Math.round(st.vel)}</span><span>💥 ×${st.mult.toFixed(2)}</span><span>🛡️ ${Math.round((1 - st.def) * 100)}%</span>${st.crit ? `<span>🎯 ${Math.round(st.crit * 100)}%</span>` : ""}</div>
        <small>ELO ${elo} · ${sa.g || 0} victorias · ${sa.j || 0} peleas</small></div>
    </div>
    <div class="panel"><div class="headrow"><span class="label">Puntos${libres ? ` · <b class="he-libres">${libres} para repartir</b>` : ""}</span><button class="linkish" id="heReiniciar" ${Heroes.usados(p.pts) ? "" : "disabled"}>↺ Reiniciar</button></div>${statsHTML}</div>
    <div class="panel"><span class="label">Evolución</span>${evos}</div>
    <div class="panel"><span class="label">Equipo de ${esc(nombrePj)}</span><p class="sub he-nota">Cada material se compra al llegar a su nivel. Lo que compraste lo podés cambiar cuando quieras.</p>${slotHTML}</div>
    <div class="panel"><span class="label">Escenario</span>
      <div class="chips-j">${Object.entries(AR.ESCENARIOS).map(([k, X]) => `<button class="chip-j ${cfg.esc === k ? "on" : ""}" data-esc="${k}">${X.ic} ${X.nombre}</button>`).join("")}</div>
      <span class="label">Contra la compu</span>
      <div class="tabs">${[["duelo", "1 contra 1"], ["todos", "Todos contra todos (4)"]].map(([k, n]) => `<button data-modo="${k}" aria-pressed="${cfg.modo === k}">${n}</button>`).join("")}</div>
      <div class="tabs">${[["facil", "Fácil"], ["normal", "Normal"], ["dificil", "Difícil"]].map(([k, n]) => `<button data-niv="${k}" aria-pressed="${cfg.nivel === k}">${n}</button>`).join("")}</div>
      <button class="btn" id="arJugar">⚔️ ¡A pelear con ${esc(nombrePj)}!</button>
      <button class="btn ghost" id="arAmigos">Pelear con amigos (crear sala)</button>
    </div>
    <details class="panel"><summary class="label">Cómo se juega</summary><ul class="reglas-pts">
      <li><span>🕹️ Moverse</span><b>Arrastra el dedo (o flechas)</b></li><li><span>⚔️ Atacar</span><b>Botón grande (o espacio): apunta solo al más cercano</b></li>
      <li><span>✨ Especial</span><b>Botón chico (o E), cuando se llena</b></li><li><span>🧪 Pociones</span><b>Pásales por encima: +35 de vida</b></li>
      <li><span>⭐ Experiencia</span><b>Cada pelea sube de nivel al personaje que usaste</b></li><li><span>🔥 Muerte súbita</span><b>A los 90 s todos pierden vida</b></li>
      <li><span>🏆 ELO</span><b>Es uno solo para todos tus personajes</b></li></ul></details>
    <button class="btn ghost" id="volver">Inicio</button>
  </section>`;
  Cuenta.conectarBarra();
  const cv = byId("arPrev"), ctx = cv.getContext("2d");
  const pintar = () => { ctx.clearRect(0, 0, 160, 170); ctx.save(); ctx.scale(1.7, 1.7); Arena.dibujarLuchador(ctx, { name: "", look: u.look, clase, eq: st.ver, estilo: st.estilo, evoIc: st.evoIc, cara: 1, hp: 1, max: 1, invul: 0, lento: 0, golpe: -9999 }, 47, 75, performance.now() / 1000, false, 0); ctx.restore(); };
  pintar(); setTimeout(pintar, 300);
  app.querySelectorAll("[data-pj]").forEach(b => b.onclick = () => { a.clase = b.dataset.pj; U.slot = null; Eco.guardar(u); render(); });
  app.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => Heroes.punto(u, b.dataset.pt, +b.dataset.d));
  on("heReiniciar", () => Heroes.reiniciar(u));
  app.querySelectorAll("[data-evo]").forEach(b => b.onclick = () => { const e = Heroes.evoDe(clase, b.dataset.evo); if (p.evo.length || confirm(`¿Evolucionar a ${e.nombre}? El camino que elijas queda para siempre en este personaje.`)) Heroes.evolucionar(u, b.dataset.evo); });
  app.querySelectorAll("[data-slot]").forEach(b => b.onclick = () => { U.slot = U.slot === b.dataset.slot ? null : b.dataset.slot; render(); });
  app.querySelectorAll("[data-comprar]").forEach(b => b.onclick = () => { const it = Heroes.item(clase, b.dataset.comprar); if (confirm(`¿Comprar ${it.nombre} por ${it.precio} monedas?`)) Heroes.comprar(u, b.dataset.comprar); });
  app.querySelectorAll("[data-equipar]").forEach(b => b.onclick = () => Heroes.equipar(u, b.dataset.equipar, b.dataset.id || null));
  app.querySelectorAll("[data-esc]").forEach(b => b.onclick = () => { S.arenaCfg = { ...cfg, esc: b.dataset.esc }; S.arenaEsc = b.dataset.esc; render(); });
  app.querySelectorAll("[data-modo]").forEach(b => b.onclick = () => { S.arenaCfg = { ...cfg, modo: b.dataset.modo }; render(); });
  app.querySelectorAll("[data-niv]").forEach(b => b.onclick = () => { S.arenaCfg = { ...cfg, nivel: b.dataset.niv }; render(); });
  on("arJugar", () => Arena.empezarLocal(cfg.modo, cfg.nivel, cfg.esc));
  on("arAmigos", () => { S.arenaEsc = cfg.esc; go("onCrear"); });
  on("volver", () => go("home"));
};
