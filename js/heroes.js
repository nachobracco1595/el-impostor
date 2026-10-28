/* Personajes de la Arena: cada clase es un personaje propio, con su nivel, evoluciones, puntos y equipo.
   - Experiencia: se gana peleando con esa clase (más por ganar y por eliminar).
   - Nivel máximo 40. Cada nivel da 3 puntos para repartir a mano (fuerza, vida, agilidad, defensa, inteligencia). Reiniciar los puntos es gratis.
   - Prestigio (como en el COD): en el nivel 40 se puede volver al nivel 1 y subir un prestigio, hasta 10.
     Cada prestigio da una mejora única para siempre y 20 puntos de prestigio que se reparten a mano y no se pierden.
     Con el prestigio 10 el nivel sigue hasta el 1000 (un punto más cada 5 niveles).
   - Evoluciones: en el nivel 10 se elige uno de dos caminos y en el 20 se evoluciona otra vez en ese camino.
     La evolución final suma un poder (segundo botón). El camino se puede reiniciar para elegir otro.
   - Equipo: arma, ropa, casco y botas propios de cada clase, en 9 materiales y 2 estilos (tienda),
     más el botín de la torre (común, raro, épico, legendario y mítico), todo en una bolsa de hasta 40 cosas.
     Lo que no está puesto se puede vender. */
const HE = {
  MAX: 40, MAX_FINAL: 1000, PRESTIGIOS: 10, PTS_NIVEL: 3, PTS_PRESTIGIO: 20, BOLSA: 40, VENTA_MAX: 400, EVO_RESET: 150,
  xpNivel: n => n < 40 ? 20 + 5 * n : 220,     // lo que falta para pasar del nivel n al n+1
  /* Mejora única de cada prestigio (se suman: con el prestigio 4 tenés las 4 primeras) */
  PRESTIGIO: [
    { ic: "🥉", nombre: "Bronce", desc: "+5% de vida", pas: { hp: .05 } },
    { ic: "🥈", nombre: "Plata", desc: "+5% de daño", pas: { dano: .05 } },
    { ic: "🥇", nombre: "Oro", desc: "+25% de monedas en la Arena y la Torre", pas: { monedas: .25 } },
    { ic: "💠", nombre: "Platino", desc: "Las pociones te curan el doble", pas: { pocion: 1 } },
    { ic: "💎", nombre: "Diamante", desc: "+6% de velocidad", pas: { vel: .06 } },
    { ic: "🔷", nombre: "Maestro", desc: "Especial 15% más seguido", pas: { espCd: .15 } },
    { ic: "🩸", nombre: "Gran maestro", desc: "Te curás el 4% del daño que hacés", pas: { robo: .04 } },
    { ic: "⭐", nombre: "Leyenda", desc: "+8% de crítico", pas: { crit: .08 } },
    { ic: "🌟", nombre: "Mítico", desc: "Una vez por pelea, al caer, revivís con 30% de vida", pas: { revive: 1 } },
    { ic: "👑", nombre: "Prestigio máximo", desc: "+5% de vida, daño y defensa, aura dorada y niveles hasta el 1000", pas: { hp: .05, dano: .05, def: .05 } }
  ],
  /* Características: cada punto rinde un poco menos cuantos más tenés en esa (ver rinde) */
  STATS: {
    fue: ["Fuerza", "💪", "+1,5% de daño físico, +0,8% de vida y +1,5% de daño crítico"],
    agi: ["Agilidad", "👟", "+0,5% de velocidad de movimiento y de ataque"],
    vid: ["Salud", "❤️", "+2% de vida"],
    def: ["Defensa", "🛡️", "-0,7% de daño recibido, pero -0,25% de velocidad"],
    int: ["Inteligencia", "🧠", "+1,5% de poder mágico (ataques y habilidades de magia) y +0,3% de chance de crítico"]
  },
  /* Lo que conviene subir en cada clase: solo lo usan los bots (la persona reparte como quiere) */
  RECOMIENDA: {
    guerrero: ["fue", "vid", "def"],
    arquero: ["agi", "fue", "int"],
    mago: ["int", "agi", "vid", "def"],
    asesino: ["agi", "fue", "int"],
    invocador: ["int", "agi", "vid", "def"]
  },
  /* Skins (solo se ven, no dan ventajas): [id, nombre, ícono, precio, { clase (si es exclusiva), tinte, alfa, aura, arma, part, som, opac }] */
  SKINS: SKINS_DATA,

  /* Tipo de daño de cada clase (ataque y especial): físico usa Fuerza, mágico usa Inteligencia */
  DANO: { guerrero: "fis", arquero: "fis", asesino: "fis", mago: "mag", invocador: "mag" },
  SLOTS: { arma: ["Arma", "⚔️"], ropa: ["Ropa", "🦺"], casco: ["Cabeza", "⛑️"], botas: ["Pies", "🥾"] },
  NIVEL_TIER: [1, 4, 8, 12, 16, 21, 26, 32, 38],
  PRECIO_TIER: PRECIO_TIER_BASE,
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
    },
    invocador: {
      arma: [["Grimorio", "m", { dano: .08 }], ["Báculo de hueso", "m", { dano: .05, cdm: .02 }]],
      ropa: [["Túnica", "f", { hp: .04 }], ["Capa", "f", { def: .03 }]],
      casco: [["Capucha", "f", { def: .02 }], ["Cráneo", "m", { dano: .02 }]],
      botas: [["Sandalias", "fp", { vel: .03 }], ["Botas", "fp", { def: .015, vel: .015 }]]
    }
  },
  /* Lo que en las evoluciones vale el mayor (no se suma entre la del nivel 10 y la del 20) */
  MAXIMOS: ["flechas", "critX", "lento", "invN", "invBoom", "invGolem"],
  QUE: { dano: ["daño", 1], hp: ["vida", 1], def: ["defensa", 1], vel: ["velocidad", 1], cd: ["más lento", 1], cdm: ["ataques más seguidos", 1], alc: ["alcance", 1], crit: ["crítico", 1], robo: ["robo de vida", 1], regen: ["regeneración", 1], espinas: ["espinas", 1] },
  /* Botín de la torre: rarezas [id, nombre, color, cómo se dice según el género, material con que se dibuja] */
  RAREZAS: [
    { id: "comun", nombre: "Común", color: "#ced4da", adj: { m: "común", f: "común", mp: "comunes", fp: "comunes" }, vis: 2 },
    { id: "raro", nombre: "Raro", color: "#4dabf7", adj: { m: "raro", f: "rara", mp: "raros", fp: "raras" }, vis: 4 },
    { id: "epico", nombre: "Épico", color: "#b197fc", adj: { m: "épico", f: "épica", mp: "épicos", fp: "épicas" }, vis: 6 },
    { id: "legendario", nombre: "Legendario", color: "#ffa94d", adj: { m: "legendario", f: "legendaria", mp: "legendarios", fp: "legendarias" }, vis: 8 },
    { id: "mitico", nombre: "Mítico", color: "#ff4d63", adj: { m: "mítico", f: "mítica", mp: "míticos", fp: "míticas" }, vis: 8 }
  ],
  DE_QUIEN: ["del Dragón", "del Rey Esqueleto", "de la Gran Bruja", "del Abismo", "del Fénix", "de las Sombras", "del Titán", "de la Tormenta", "del Lobo Blanco", "del Vampiro", "del Señor Demonio", "de los Antiguos"],
  /* Lo que puede sumar de más un botín (por cada "nivel" de fuerza del objeto) */
  EXTRA: { dano: .03, hp: .035, def: .015, vel: .012, cdm: .012, crit: .008, alc: .015 },
  /* Poderes especiales del botín (épico 30%, legendario 60%, mítico siempre): x = valor base, sube = cuánto más por rareza */
  AFIJOS: [
    { k: "robo", nombre: "Vampírico", ic: "🩸", x: .03, sube: .33 },
    { k: "cdm", nombre: "Frenético", ic: "⚡", x: .05, sube: .4 },
    { k: "crit", nombre: "Certero", ic: "🎯", x: .04, sube: .37 },
    { k: "espinas", nombre: "Espinoso", ic: "🌵", x: .08, sube: .37 },
    { k: "regen", nombre: "Vital", ic: "💚", x: .004, sube: .37 }
  ],
  /* Grado de calidad (como en Taskbar Hero): el mismo objeto puede salir varias veces, cada vez mejor. Multiplica lo que da */
  GRADOS: [["Gastado", 1, .8], ["Normal", 2, 1], ["Fino", 3, 1.15], ["Superior", 4, 1.3], ["Obra maestra", 5, 1.5]],
  PESO_GRADO: [30, 35, 20, 11, 4],
  /* Mejora +1 a +10 (botín raro o mejor): cada + suma 8% a lo que da. Costo: monedas y fragmentos; desde +6 puede fallar (se pierden los materiales, no el objeto) */
  MEJORA_MAX: 10, MEJORA_PCT: .08,
  /* Gemas para los engarces: [nombre, ícono, qué da, cuánto por nivel] (niveles 1 a 5) */
  GEMAS: { r: ["Rubí", "🔴", "dano", .03], z: ["Zafiro", "🔵", "hp", .04], e: ["Esmeralda", "🟢", "vel", .015], d: ["Diamante", "💎", "crit", .012], a: ["Amatista", "🟣", "def", .015], t: ["Topacio", "🟡", "cdm", .015] },
  /* Grabados (con pergaminos): uno por objeto, se puede reemplazar */
  GRABADOS: { v: ["de Vampiro", "🧛", "robo", .05], h: ["del Huracán", "🌪️", "cdm", .15], e: ["de Espinas", "🌵", "espinas", .10], g: ["del Gigante", "🗿", "hp", .12], f: ["de la Furia", "🔥", "dano", .10], c: ["del Cazador", "🎯", "crit", .06], r: ["del Rayo", "⚡", "vel", .08], o: ["de la Roca", "🪨", "def", .08] },
  /* Topes de materiales guardados */
  TOPE_FRAG: 999, TOPE_MAT: 50,
  /* Poder de la evolución final (segundo botón): cd en ms */
  PODERES: {
    inmortal: { nombre: "Inmortalidad", ic: "😇", cd: 22000, dura: 2500, desc: "Durante 2,5 s no baja de 1 de vida, pase lo que pase." },
    veloz: { nombre: "Súper velocidad", ic: "💨", cd: 20000, dura: 3000, desc: "Corre al triple de velocidad durante 3 s." },
    drena: { nombre: "Absorber vida", ic: "🩸", cd: 20000, dura: 5000, desc: "Le chupa la vida a los que tiene cerca y, durante 5 s, se cura el 60% del daño que hace." },
    curar: { nombre: "Curar a sus monstruos", ic: "💚", cd: 20000, dura: 0, desc: "Cura del todo a sus bichos y les suma 6 s (si no tiene, los invoca)." },
    ferales: { nombre: "Invocar ferales", ic: "🐾", cd: 22000, dura: 6000, desc: "Aparecen 3 bestias salvajes muy rápidas que pelean por él 6 s." },
    sombra: { nombre: "Sombra", ic: "🌑", cd: 18000, dura: 2000, desc: "Se vuelve sombra 2 s: nadie lo puede apuntar ni pegar, y su próximo golpe es crítico seguro." }
  },
  /* Evoluciones: [nivel 10, nivel 20] de cada camino. pas = lo que suman */
  EVOS: {
    guerrero: {
      a: [{ id: "caballero", nombre: "Caballero", ic: "🛡️", desc: "+10% de vida y +5% de defensa.", pas: { hp: .10, def: .05 } },
          { id: "paladin", nombre: "Paladín", ic: "⚜️", desc: "+20% de vida, +8% de defensa y se cura 1% de vida por segundo.", pas: { hp: .20, def: .08, regen: .01 }, poder: "inmortal" }],
      b: [{ id: "barbaro", nombre: "Bárbaro", ic: "🪓", desc: "+10% de daño.", pas: { dano: .10 } },
          { id: "berserker", nombre: "Berserker", ic: "😡", desc: "+15% de daño y, con menos de 40% de vida, pega +40%.", pas: { dano: .15, furia: .40 }, poder: "inmortal" }]
    },
    arquero: {
      a: [{ id: "cazador", nombre: "Cazador", ic: "🐺", desc: "Sus flechas frenan al enemigo 0,6 s.", pas: { lento: 600 } },
          { id: "montaraz", nombre: "Montaraz", ic: "🌲", desc: "Frenan 1 s y la lluvia dispara 7 flechas.", pas: { lento: 1000, flechas: 7 }, poder: "veloz" }],
      b: [{ id: "tirador", nombre: "Tirador", ic: "🎯", desc: "+20% de alcance y 10% de crítico.", pas: { alc: .20, crit: .10 } },
          { id: "francotirador", nombre: "Francotirador", ic: "🔭", desc: "+40% de alcance y 20% de crítico.", pas: { alc: .40, crit: .20 }, poder: "veloz" }]
    },
    mago: {
      a: [{ id: "piromante", nombre: "Piromante", ic: "🔥", desc: "Explosiones 25% más grandes.", pas: { area: .25 } },
          { id: "senor-fuego", nombre: "Señor del fuego", ic: "🌋", desc: "Explosiones 50% más grandes que además queman 3 s.", pas: { area: .50, quema: .15 }, poder: "drena" }],
      b: [{ id: "criomante", nombre: "Criomante", ic: "❄️", desc: "Las bolas frenan al enemigo 1 s.", pas: { lento: 1000 } },
          { id: "glacial", nombre: "Glacial", ic: "🧊", desc: "Frenan 1,5 s y la nova es 40% más grande.", pas: { lento: 1500, nova: .40 }, poder: "drena" }]
    },
    asesino: {
      a: [{ id: "ninja", nombre: "Ninja", ic: "🌀", desc: "Especial 25% más seguido y +6% de velocidad.", pas: { espCd: .25, vel: .06 } },
          { id: "maestro-ninja", nombre: "Maestro ninja", ic: "🐉", desc: "Especial 45% más seguido y +12% de velocidad.", pas: { espCd: .45, vel: .12 }, poder: "sombra" }],
      b: [{ id: "sicario", nombre: "Sicario", ic: "🗡️", desc: "+10% de crítico.", pas: { crit: .10 } },
          { id: "parca", nombre: "Parca", ic: "💀", desc: "+20% de crítico y los críticos pegan ×2,5.", pas: { crit: .20, critX: 2.5 }, poder: "sombra" }]
    },
    invocador: {
      a: [{ id: "nigromante", nombre: "Nigromante", ic: "☠️", desc: "Invoca 3 esqueletos en vez de 2 bichos.", pas: { invN: 3 } },
          { id: "senor-muertos", nombre: "Señor de los muertos", ic: "⚰️", desc: "3 esqueletos que duran 50% más y explotan al irse.", pas: { invN: 3, invDura: .5, invBoom: 1 }, poder: "curar" }],
      b: [{ id: "domador", nombre: "Domador", ic: "🐺", desc: "Sus bichos tienen +40% de vida y daño.", pas: { invFuerza: .4 } },
          { id: "senor-bestias", nombre: "Señor de las bestias", ic: "🗿", desc: "Invoca un gólem gigante y 2 lobos, todos con +60%.", pas: { invFuerza: .6, invGolem: 1 }, poder: "ferales" }]
    }
  }
};

HE.SKIN = Object.fromEntries(HE.SKINS.map(([id, nombre, ic, precio, x]) => [id, { id, nombre, ic, precio, ...x }]));

const Heroes = {
  /* ---------- Progreso guardado en el perfil (u.diario.arena) ---------- */
  cero() { return Object.fromEntries(Object.keys(HE.STATS).map(k => [k, 0])); },
  nuevo() { return { xp: 0, pre: 0, ppts: Heroes.cero(), pts: Heroes.cero(), evo: [], items: ["arma:0:0", "ropa:0:0", "casco:0:0", "botas:0:0"], eq: { arma: "arma:0:0", ropa: "ropa:0:0", casco: null, botas: "botas:0:0" } }; },
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
    // Los puntos de prestigio antes se repartían solos; ahora se ponen a mano. Los que ya tenía quedan donde estaban
    if ((a.statsV | 0) < 3) {
      for (const c of Object.keys(AR.CLASES)) { const q = a.pj[c]; q.pts = { ...Heroes.cero(), ...q.pts }; q.ppts = { ...Heroes.cero(), ...q.ppts }; }
      a.statsV = 3;
    }
    if (!AR.CLASES[a.clase]) a.clase = "guerrero";
    return a;
  },
  pj(u, clase) { const a = this.datos(u); return a.pj[clase || a.clase]; },
  /* Nivel que corresponde a la experiencia (dentro del prestigio actual) */
  tope: pre => (pre | 0) >= HE.PRESTIGIOS ? HE.MAX_FINAL : HE.MAX,
  nivel(xp, pre = 0) {
    const cap = this.tope(pre);
    let n = 1, resto = Math.max(0, xp | 0);
    while (n < cap && resto >= HE.xpNivel(n)) { resto -= HE.xpNivel(n); n++; }
    return { n, enEste: n < cap ? resto : 0, falta: HE.xpNivel(n), tope: n >= cap, cap };
  },
  puntosTotales: n => HE.PTS_NIVEL * Math.min(n, HE.MAX) + (n > HE.MAX ? Math.floor((n - HE.MAX) / 5) : 0),
  usados: pts => Object.values(pts || {}).reduce((t, v) => t + (v | 0), 0),
  libres(p) { return this.puntosTotales(this.nivel(p.xp, p.pre).n) - this.usados(p.pts); },
  /* Puntos de prestigio sin poner (20 por prestigio) */
  libresPre(p) { return Math.max(0, (p.pre | 0) * HE.PTS_PRESTIGIO - this.usados(p.ppts)); },
  puedePrestigio(p) { return (p.pre | 0) < HE.PRESTIGIOS && this.nivel(p.xp, p.pre).n >= HE.MAX; },
  /* El material se desbloquea al llegar a su nivel (con un prestigio ya están todos) */
  desbloqueado(p, it) { return (p.pre | 0) > 0 || this.nivel(p.xp, p.pre).n >= it.nivel; },
  /* Cada punto rinde un poco menos cuantos más tenés en esa stat (para que el nivel 1000 no rompa todo) */
  rinde: x => x / (1 + x / 250),

  /* ---------- Equipo: lo de la tienda ("slot:estilo:material") y el botín de la torre ("L…") ---------- */
  item(clase, id) {
    const sid = String(id || "");
    if (sid[0] === "L") return this.botinItem(clase, sid);
    const [slot, v, t] = sid.split(":"), est = HE.EQUIPO[clase] && HE.EQUIPO[clase][slot] && HE.EQUIPO[clase][slot][+v];
    if (!est || !(+t >= 0 && +t <= 8)) return null;
    const tier = +t, N = TR.NIVELES[tier], [nom, gen, por] = est;
    let suf = gen[0] === "m" ? N.m : N.f;
    if (N.id === "encantado") suf = { m: "encantado", f: "encantada", fp: "encantadas", mp: "encantados" }[gen];
    const bonus = Object.fromEntries(Object.entries(por).map(([k, x]) => [k, x * (tier + 1)]));
    const precio = Catalogo.precio("tier:" + tier, HE.PRECIO_TIER[tier]);
    return { id: `${slot}:${+v}:${tier}`, slot, v: +v, tier, vis: tier, rar: -1, nombre: `${nom} ${suf}`, color: N.color, nivel: HE.NIVEL_TIER[tier], precio, venta: Math.min(HE.VENTA_MAX, Math.round(precio * 0.4)), bonus };
  },
  LETRA: { a: "arma", r: "ropa", c: "casco", b: "botas" },
  /* Material de la tienda que corresponde a un piso de la torre (el mismo que a ese nivel) */
  tierPiso: f => Math.max(0, Math.min(8, HE.NIVEL_TIER.filter(n => n <= f).length - 1)),
  /* Código del botín: "L" + lugar + estilo + rareza + grado + "." + piso + "." + semilla, y si lo trabajaste
     "_" + mejora (0-9, a = 10) + gemas de a pares (letra y nivel, "--" = hueco vacío) y "~" + grabado.
     Lo demás (nombre, valores, huecos, poder especial) sale de la semilla: así se guarda corto y el anfitrión lo rearma igual */
  RE_BOTIN: /^L([arcb])([01])([0-4])([0-4])\.(\d{1,3})\.([0-9a-z]{1,6})(?:_([0-9a])((?:[rzedat][1-5]|--){0,3}))?(?:~([vhegfcro]))?$/,
  leer(id) {
    const m = this.RE_BOTIN.exec(String(id || "")); if (!m) return null;
    const gem = (m[8] || "").match(/../g) || [];
    return { s: m[1], v: +m[2], r: +m[3], g: +m[4], piso: Math.max(1, +m[5]), semilla: m[6], m: parseInt(m[7] || "0", 36), gemas: gem.map(x => x === "--" ? null : { k: x[0], n: +x[1] }), grab: m[9] || null };
  },
  codigo(o, huecos) {
    const base = `L${o.s}${o.v}${o.r}${o.g}.${o.piso}.${o.semilla}`, gem = Array.from({ length: huecos }, (_, i) => o.gemas[i] ? o.gemas[i].k + o.gemas[i].n : "--").join("");
    return base + (o.m || o.gemas.some(Boolean) ? `_${Math.min(10, o.m | 0).toString(36)}${o.gemas.some(Boolean) ? gem : ""}` : "") + (o.grab ? "~" + o.grab : "");
  },
  botinItem(clase, id) {
    const o = this.leer(id); if (!o) return null;
    const slot = this.LETRA[o.s], ri = o.r, est = HE.EQUIPO[clase] && HE.EQUIPO[clase][slot] && HE.EQUIPO[clase][slot][o.v];
    if (!est) return null;
    this.cacheB = this.cacheB || {}; const ck = clase + id; if (this.cacheB[ck]) return this.cacheB[ck];
    if (Object.keys(this.cacheB).length > 600) this.cacheB = {};
    const base = id.split(/[_~]/)[0], R = HE.RAREZAS[ri], Gr = HE.GRADOS[o.g], r = azarDe(base), teq = this.tierPiso(o.piso), u1 = teq + 1, tope = Math.max(9, u1 * 1.25 + 1);
    // Fuerza del objeto en "materiales" de la tienda: el legendario nunca baja del mejor de la tienda y el mítico lo pasa de lejos
    const F = [u1 * 1.15 * (0.9 + 0.2 * r()), (u1 * 1.3 + 0.5) * (0.9 + 0.2 * r()), (u1 * 1.5 + 1) * (0.9 + 0.2 * r()), tope * (1 + 0.1 * r()), tope * (1.3 + 0.15 * r())][ri];
    const huecos = [0, 1, 1 + (r() < 0.5 ? 1 : 0), 2, 3][ri], mejora = Math.min(HE.MEJORA_MAX, o.m), mult = Gr[2] * (1 + HE.MEJORA_PCT * mejora);
    const bonus = {}, suma = (k, x) => { bonus[k] = (bonus[k] || 0) + x; };
    for (const [k, x] of Object.entries(est[2])) if (k !== "cd") suma(k, x * F * mult);      // sin la contra del hacha o la ballesta
    const libres = Object.keys(HE.EXTRA).filter(k => !(k in bonus));
    for (let i = 0; i < [0, 1, 2, 2, 3][ri] && libres.length; i++) { const k = libres.splice(Math.floor(r() * libres.length), 1)[0]; suma(k, HE.EXTRA[k] * F * (0.25 + 0.35 * r()) * mult); }
    let afijo = null;
    if (r() < [0, 0.1, 0.3, 0.6, 1][ri]) { afijo = HE.AFIJOS[Math.floor(r() * HE.AFIJOS.length)]; suma(afijo.k, afijo.x * (1 + afijo.sube * ri) * (0.8 + 0.4 * r())); }
    const gemas = Array.from({ length: huecos }, (_, i) => { const G = o.gemas[i] && HE.GEMAS[o.gemas[i].k]; return G ? { k: o.gemas[i].k, n: o.gemas[i].n } : null; });
    gemas.forEach(g => { if (g) suma(HE.GEMAS[g.k][2], HE.GEMAS[g.k][3] * g.n); });
    const grab = o.grab && HE.GRABADOS[o.grab] ? o.grab : null;
    if (grab) suma(HE.GRABADOS[grab][2], HE.GRABADOS[grab][3]);
    for (const k of Object.keys(bonus)) bonus[k] = Math.round(bonus[k] * 1000) / 1000;
    const quien = HE.DE_QUIEN[Math.floor(r() * HE.DE_QUIEN.length)];
    return (this.cacheB[ck] = { id, base, o, slot, v: o.v, tier: R.vis, vis: R.vis, rar: ri, rareza: R, grado: o.g, gradoN: Gr[0], estrellas: "★".repeat(Gr[1]) + "☆".repeat(5 - Gr[1]), mejora, huecos, gemas, grab, piso: o.piso, botin: true, afijo,
      nombre: `${est[0]} ${R.adj[est[1]] || R.adj.m}${ri ? " " + quien : ""}${mejora ? ` +${mejora}` : ""}`, color: R.color, nivel: 1, precio: 0,
      venta: Math.min(HE.VENTA_MAX, Math.round([20, 45, 90, 180, 300][ri] * (1 + teq * 0.06) * Gr[2] * (1 + 0.1 * mejora))), bonus });
  },
  catalogo(clase, slot) { const out = []; for (let t = 0; t <= 8; t++) for (let v = 0; v < 2; v++) out.push(this.item(clase, `${slot}:${v}:${t}`)); return out; },
  /* Lo que da cada cosa, en palabras ("+12% de daño", "+8% de vida (+13)") */
  lineasBonus(b, clase) {
    const pct = x => `${Math.round(x * 1000) / 10}`.replace(".", ",") + "%", C = clase && AR.CLASES[clase];
    const T = { dano: x => `+${pct(x)} de daño`, hp: x => `+${pct(x)} de vida${C ? ` (+${Math.round(C.hp * x)})` : ""}`, def: x => `recibe ${pct(x)} menos daño`, vel: x => `+${pct(x)} de velocidad`,
      cd: x => `ataca ${pct(x)} más lento`, cdm: x => `ataca ${pct(x)} más rápido`, alc: x => `+${pct(x)} de alcance`, crit: x => `+${pct(x)} de chance de crítico`,
      robo: x => `se cura el ${pct(x)} del daño que hace`, regen: x => `recupera ${pct(x)} de vida por segundo`, espinas: x => `devuelve el ${pct(x)} del daño que recibe` };
    return Object.entries(b || {}).filter(([k, x]) => T[k] && x).map(([k, x]) => T[k](x));
  },
  textoBonus(b, clase) { return this.lineasBonus(b, clase).join(" · "); },

  /* ---------- Lo que se manda a la pelea (también online) ---------- */
  perfil(u) {
    const a = this.datos(u), p = a.pj[a.clase], L = this.nivel(p.xp, p.pre);
    return { clase: a.clase, lv: L.n, pre: p.pre | 0, pts: { ...p.pts }, ppts: { ...p.ppts }, evo: p.evo.slice(0, 2), eq: { ...p.eq }, elo: Arena.elo(u), skin: p.skin || null };
  },
  validar(p) {
    const ok = p && typeof p === "object", clase = ok && AR.CLASES[p.clase] ? p.clase : "guerrero";
    const pre = Math.max(0, Math.min(HE.PRESTIGIOS, ok ? p.pre | 0 : 0)), lv = Math.max(1, Math.min(this.tope(pre), ok ? p.lv | 0 : 1));
    const tomar = (de, total) => { const out = {}; let quedan = total; for (const k of Object.keys(HE.STATS)) { const x = Math.max(0, Math.min(quedan, ok && de ? de[k] | 0 : 0)); out[k] = x; quedan -= x; } return out; };
    const pts = tomar(ok && p.pts, this.puntosTotales(lv)), ppts = tomar(ok && p.ppts, pre * HE.PTS_PRESTIGIO);
    const E = HE.EVOS[clase], evo = [];
    if (ok && Array.isArray(p.evo) && (lv >= 10 || pre > 0)) {
      const rama = ["a", "b"].find(r => E[r][0].id === p.evo[0]);
      if (rama) { evo.push(E[rama][0].id); if ((lv >= 20 || pre > 0) && p.evo[1] === E[rama][1].id) evo.push(E[rama][1].id); }
    }
    // El equipo (de la tienda o botín) se rearma desde su código: los valores salen de acá, no de lo que manda el otro teléfono
    const eq = {};
    for (const s of Object.keys(HE.SLOTS)) { const it = ok && p.eq && typeof p.eq[s] === "string" && p.eq[s].length < 40 ? this.item(clase, p.eq[s]) : null; eq[s] = it && it.slot === s ? it.id : null; }
    const S = ok && HE.SKIN[p.skin], skin = S && (!S.clase || S.clase === clase) ? S.id : null;
    return { clase, lv, pre, pts, ppts, evo, eq, skin, elo: Math.max(0, Math.min(4000, ok ? (p.elo | 0) || 1000 : 1000)) };
  },
  evoDe(clase, id) { const E = HE.EVOS[clase]; for (const r of ["a", "b"]) for (const e of E[r]) if (e.id === id) return { ...e, rama: r }; return null; },
  /* Stats para pelear: clase + puntos + evoluciones + equipo */
  stats(p) {
    const C = AR.CLASES[p.clase], b = { dano: 0, hp: 0, def: 0, vel: 0, cd: 0, cdm: 0, alc: 0, crit: 0, robo: 0, regen: 0, espinas: 0 }, pas = {};
    const ver = { arma: 0, armadura: -1, casco: -1, botas: -1 }, estilo = { arma: 0 }, col = {};
    for (const s of Object.keys(HE.SLOTS)) {
      const it = this.item(p.clase, p.eq[s]); if (!it) continue;
      for (const [k, x] of Object.entries(it.bonus)) b[k] = (b[k] || 0) + x;
      const vk = s === "ropa" ? "armadura" : s; ver[vk] = it.vis; if (it.botin) col[vk] = it.color;
      if (s === "arma") estilo.arma = it.v;
    }
    for (const id of p.evo) { const e = this.evoDe(p.clase, id); if (e) for (const [k, x] of Object.entries(e.pas)) pas[k] = HE.MAXIMOS.includes(k) ? Math.max(pas[k] || 0, x) : (pas[k] || 0) + x; }
    // Cada evolución reemplaza a la anterior en lo que suma (no se acumulan las dos del mismo camino)
    if (p.evo.length === 2) { const e1 = this.evoDe(p.clase, p.evo[0]); for (const [k, x] of Object.entries(e1.pas)) if (!HE.MAXIMOS.includes(k)) pas[k] -= x; }
    const fin = p.evo.length === 2 ? this.evoDe(p.clase, p.evo[1]) : null;
    // Mejoras de prestigio (se suman todas las que tiene)
    const pr = {};
    HE.PRESTIGIO.slice(0, p.pre | 0).forEach(x => { for (const [k, v] of Object.entries(x.pas)) pr[k] = (pr[k] || 0) + v; });
    const P = {}; for (const k of Object.keys(HE.STATS)) P[k] = this.rinde(((p.pts && p.pts[k]) | 0) + ((p.ppts && p.ppts[k]) | 0));
    // Daño: los golpes físicos (guerrero, asesino, arquero) suben con Fuerza; la magia (mago, invocador) con Inteligencia
    const tipo = HE.DANO[p.clase] || "fis", poder = tipo === "mag" ? P.int : P.fue;
    return {
      tipo,
      hp: Math.round(C.hp * (1 + P.vid * 0.02 + P.fue * 0.008 + b.hp + (pas.hp || 0) + (pr.hp || 0))),
      vel: C.vel * Math.min(1.9, Math.max(0.6, 1 + P.agi * 0.005 - P.def * 0.0025 + b.vel + (pas.vel || 0) + (pr.vel || 0))),
      mult: 1 + poder * 0.015 + b.dano + (pas.dano || 0) + (pr.dano || 0),
      def: 1 - Math.min(0.65, P.def * 0.007 + b.def + (pas.def || 0) + (pr.def || 0)),
      cd: Math.max(0.55, 1 - P.agi * 0.005 - b.cdm + b.cd),
      alc: 1 + b.alc + (pas.alc || 0), crit: (C.atk.crit || 0) + P.int * 0.003 + b.crit + (pas.crit || 0) + (pr.crit || 0), critX: (pas.critX || 2) + P.fue * 0.015,
      area: 1 + (pas.area || 0), nova: 1 + (pas.nova || 0), lento: pas.lento || 0, quema: pas.quema || 0, regen: Math.min(0.03, (pas.regen || 0) + b.regen), furia: pas.furia || 0,
      espCd: (1 - (pas.espCd || 0)) * (1 - (pr.espCd || 0)), flechas: pas.flechas || 5,
      invN: pas.invN || 2, invDura: pas.invDura || 0, invBoom: !!pas.invBoom, invFuerza: pas.invFuerza || 0, invGolem: !!pas.invGolem,
      monedas: pr.monedas || 0, pocion: 1 + (pr.pocion || 0), robo: Math.min(0.25, (pr.robo || 0) + b.robo), revive: !!pr.revive, espinas: Math.min(0.4, b.espinas),
      poder: fin && HE.PODERES[fin.poder] ? fin.poder : null,
      ver, estilo, col, evoIc: p.evo.length ? this.evoDe(p.clase, p.evo[p.evo.length - 1]).ic : null, evoId: p.evo.length ? p.evo[p.evo.length - 1] : null, lv: p.lv, pre: p.pre | 0
    };
  },
  /* Compu de un nivel dado, con puntos, evolución y equipo que le corresponden */
  cpu(lv, pre = 0, clase = pick(Object.keys(AR.CLASES))) {
    pre = Math.max(0, Math.min(HE.PRESTIGIOS, pre | 0)); lv = Math.max(1, Math.min(this.tope(pre), lv | 0));
    const total = this.puntosTotales(lv);
    // Los bots reparten como recomienda su clase (con un poco de azar)
    const reparto = { guerrero: { fue: .45, vid: .3, def: .25 }, arquero: { agi: .35, fue: .4, int: .25 }, mago: { int: .45, agi: .2, vid: .2, def: .15 }, asesino: { agi: .35, fue: .35, int: .3 }, invocador: { int: .45, agi: .15, vid: .25, def: .15 } }[clase];
    const pts = Heroes.cero(); let usados = 0; for (const [k, x] of Object.entries(reparto)) { pts[k] = Math.floor(total * x * (0.85 + Math.random() * 0.3)); usados += pts[k]; }
    pts[HE.RECOMIENDA[clase][0]] += Math.max(0, total - usados); if (usados > total) pts[HE.RECOMIENDA[clase][0]] -= usados - total;
    const rama = Math.random() < 0.5 ? "a" : "b", E = HE.EVOS[clase][rama], evo = lv >= 20 || pre ? [E[0].id, E[1].id] : lv >= 10 ? [E[0].id] : [];
    const tier = pre ? 8 : HE.NIVEL_TIER.filter(n => n <= lv).length - 1, eq = {};
    const ppts = Heroes.cero(); for (let k = 0; k < pre * HE.PTS_PRESTIGIO; k++) ppts[pick(HE.RECOMIENDA[clase])]++;
    for (const s of Object.keys(HE.SLOTS)) { const t = Math.max(0, tier - (Math.random() < 0.4 ? 1 : 0)); eq[s] = `${s}:${Math.random() < 0.5 ? 0 : 1}:${t}`; }
    return { clase, lv, pre, pts, ppts, evo, eq };
  },

  /* ---------- Experiencia al terminar una pelea ---------- */
  ganarXp(u, clase, xp) {
    if (!AR.CLASES[clase] || !(xp > 0)) return;
    const a = this.datos(u), p = a.pj[clase], antes = this.nivel(p.xp, p.pre);
    if (antes.tope) return;                         // en el tope la experiencia espera al prestigio
    p.xp += Math.min(600, xp | 0);
    const ahora = this.nivel(p.xp, p.pre), C = AR.CLASES[clase];
    if (ahora.tope) p.xp = Math.min(p.xp, [...Array(ahora.cap - 1).keys()].reduce((t, k) => t + HE.xpNivel(k + 1), 0));
    if (ahora.n > antes.n) {
      const pts = this.puntosTotales(ahora.n) - this.puntosTotales(antes.n);
      const evo = !p.pre && ((antes.n < 10 && ahora.n >= 10) || (antes.n < 20 && ahora.n >= 20));
      const pres = this.puedePrestigio(p);
      setTimeout(() => Toast.mostrar(`<div class="t-ic">${C.ic}</div><div class="t-txt"><small>${C.nombre}</small><b>¡Nivel ${ahora.n}!</b><span>${pts ? `+${pts} punto${pts > 1 ? "s" : ""} para repartir` : "Sigue subiendo"}${evo ? " · ¡puede evolucionar!" : ""}${pres ? " · ¡ya puede subir de prestigio!" : ""}</span></div>`, "logro"), 900);
    }
  },

  /* ---------- Botín (torre y peleas contra bots) ---------- */
  /* Chance de que caiga un objeto al pasar el piso f (los jefes, cada 5 pisos, siempre dejan) y peso de cada rareza */
  chanceBotin: f => f % 5 === 0 ? 1 : Math.min(0.8, 0.25 + f * 0.02),
  pesosBotin: f => [Math.max(8, 60 - 2 * f), 30, f >= 5 ? 6 + f * 0.8 : 2, f >= 10 ? 1.5 + (f - 10) * 0.5 : 0, f >= 20 ? 0.4 + (f - 20) * 0.25 : 0],
  sortear(w, azar = Math.random) { let x = azar() * w.reduce((t, y) => t + y, 0); for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return i; return 0; },
  /* Rareza que sale en el piso f (-1 = nada). Los jefes: al menos raro y lo mejor de dos tiradas */
  tirarBotin(f, azar = Math.random) {
    if (azar() >= this.chanceBotin(f)) return -1;
    const w = this.pesosBotin(f);
    return f % 5 === 0 ? Math.max(1, this.sortear(w, azar), this.sortear(w, azar)) : this.sortear(w, azar);
  },
  /* Materiales guardados (uno para todos los personajes): fragmentos, gemas por nivel y pergaminos de grabado */
  mat(u) { const a = this.datos(u), m = a.mat = a.mat && typeof a.mat === "object" ? a.mat : {}; m.f = Math.max(0, Math.min(HE.TOPE_FRAG, m.f | 0)); m.g = m.g || {}; m.p = m.p || {}; return m; },
  sumarMat(u, tipo, k, n = 1) {
    const m = this.mat(u);
    if (tipo === "f") m.f = Math.min(HE.TOPE_FRAG, m.f + n);
    else { const b = m[tipo]; b[k] = Math.max(0, Math.min(HE.TOPE_MAT, (b[k] | 0) + n)); if (!b[k]) delete b[k]; }
  },
  /* Un objeto nuevo de rareza ri para el piso (o nivel equivalente) f */
  nuevoBotin(ri, f, jefe) {
    const g = jefe ? Math.max(this.sortear(HE.PESO_GRADO), this.sortear(HE.PESO_GRADO)) : this.sortear(HE.PESO_GRADO);
    return `L${pick(Object.keys(this.LETRA))}${Math.random() < 0.5 ? 0 : 1}${ri}${g}.${Math.max(1, Math.min(999, f | 0))}.${Math.random().toString(36).slice(2, 7) || "x"}`;
  },
  /* Lo que cae: o = { f (piso o nivel equivalente), item (chance del objeto o -1 = la de la torre), jefe, frag, gema, perg } */
  paquete(u, clase, o) {
    if (!AR.CLASES[clase]) return null;
    const out = { frag: 0, gemas: [], pergs: [] }, f = Math.max(1, o.f | 0);
    const ri = o.item < 0 ? this.tirarBotin(f) : Math.random() < o.item ? this.sortear(this.pesosBotin(f)) : -1;
    if (ri >= 0) {
      const p = this.pj(u, clase), id = this.nuevoBotin(ri, f, o.jefe), it = this.item(clase, id);
      if (it) {
        const lleno = p.items.length >= HE.BOLSA;
        if (!lleno) { p.items.push(id); p.nuevos = [...(p.nuevos || []), id].slice(-8); }
        out.item = { id, clase, nombre: it.nombre, color: it.color, rar: ri, rareza: it.rareza.nombre, grado: `${it.estrellas} ${it.gradoN}`, ic: HE.SLOTS[it.slot][1], lineas: this.lineasBonus(it.bonus, clase).slice(0, 3), afijo: it.afijo ? `${it.afijo.ic} ${it.afijo.nombre}` : "", huecos: it.huecos, lleno };
      }
    }
    if (o.frag > 0) { out.frag = o.frag | 0; this.sumarMat(u, "f", null, out.frag); }
    if (Math.random() < o.gema) { const k = pick(Object.keys(HE.GEMAS)), n = Math.max(1, Math.min(5, 1 + Math.floor(f / 10) + (Math.random() < 0.25) - (Math.random() < 0.25))); this.sumarMat(u, "g", k + n); out.gemas.push(k + n); }
    if (Math.random() < o.perg) { const k = pick(Object.keys(HE.GRABADOS)); this.sumarMat(u, "p", k); out.pergs.push(k); }
    return out.item || out.frag || out.gemas.length || out.pergs.length ? out : null;
  },
  /* Torre: al pasar el piso f */
  botinTorre(u, clase, f) {
    const jefe = f % 5 === 0;
    return this.paquete(u, clase, { f, item: -1, jefe, frag: (1 + Math.floor(f / 6) + (Math.random() < 0.5 ? 1 : 0)) * (jefe ? 2 : 1), gema: Math.min(0.5, 0.15 + f * 0.012) + (jefe ? 0.3 : 0), perg: Math.min(0.35, 0.06 + f * 0.008) + (jefe ? 0.2 : 0) });
  },
  /* Peleas contra bots: menos que la torre; más en difícil y con más bots, y algo aunque pierdas */
  botinArena(u, clase, lv, nivel, bots, gano) {
    const dif = { facil: 0.6, normal: 1, dificil: 1.5 }[nivel] || 1, res = gano ? 1 : 0.5;
    const f = Math.max(1, Math.min(30, Math.round((lv | 0) * 0.6) + ({ facil: -3, normal: 0, dificil: 4 }[nivel] || 0)));
    return this.paquete(u, clase, { f, item: Math.min(0.45, (bots > 1 ? 0.25 : 0.15) * dif * (gano ? 1.4 : 0.6)), frag: 1 + (gano ? 1 : 0) + (nivel === "dificil" ? 1 : 0) + (bots > 1 ? 1 : 0), gema: (bots > 1 ? 0.12 : 0.08) * dif * res, perg: 0.04 * dif * res });
  },
  /* Texto corto de los materiales de un paquete ("🧩 +3 · 🔴 Rubí 2 · 📜 de Vampiro") */
  textoMat(B) {
    if (!B) return "";
    return [B.frag ? `🧩 +${B.frag} fragmento${B.frag > 1 ? "s" : ""}` : "", ...(B.gemas || []).map(g => HE.GEMAS[g[0]] ? `${HE.GEMAS[g[0]][1]} ${HE.GEMAS[g[0]][0]} ${g[1]}` : ""), ...(B.pergs || []).map(k => HE.GRABADOS[k] ? `📜 Pergamino ${HE.GRABADOS[k][0]}` : "")].filter(Boolean).join(" · ");
  },
  /* Tarjeta del botín para las pantallas de fin (torre y arena) */
  tarjetaBotin(B) {
    if (!B) return "";
    const I = B.item, mats = this.textoMat(B);
    return (I ? `<div class="to-botin r${I.rar | 0}" style="--c:${I.color}"><span class="to-botin-ic">${I.ic}</span><div><small>¡Botín! · ${esc(I.rareza)} · <span class="he-est">${esc(I.grado || "")}</span></small><b>${esc(I.nombre)}</b><span>${esc((I.lineas || []).join(" · "))}${I.afijo ? ` · ${esc(I.afijo)}` : ""}</span>${I.lleno ? `<em>🎒 Bolsa llena: no lo pudiste guardar. Vendé o desarmá algo en el inventario.</em>` : `<em>Ya está en tu bolsa</em>`}</div></div>` : "")
      + (mats ? `<p class="to-mats">${esc(mats)}</p>` : "");
  },

  /* ---------- Acciones del armado ---------- */
  guardar(u) { Eco.guardar(u); render(); },
  prestigiar(u) {
    const a = this.datos(u), p = a.pj[a.clase];
    if (!this.puedePrestigio(p)) return;
    p.pre = (p.pre | 0) + 1; p.xp = 0; p.pts = Heroes.cero();
    const X = HE.PRESTIGIO[p.pre - 1];
    if (typeof Sonido !== "undefined") Sonido.sfx("victoria");
    Toast.mostrar(`<div class="t-ic">${X.ic}</div><div class="t-txt"><small>¡Prestigio ${p.pre}!</small><b>${esc(X.nombre)}: ${esc(X.desc)}</b><span>+${HE.PTS_PRESTIGIO} puntos de prestigio para poner donde quieras.</span></div>`, "logro");
    this.guardar(u);
  },
  /* Suma o saca un punto (de nivel, o de prestigio con pres = true) */
  punto(u, k, d, pres = false) {
    const p = this.pj(u); if (!HE.STATS[k]) return;
    const bolsa = pres ? p.ppts : p.pts;
    if (d > 0 && (pres ? this.libresPre(p) : this.libres(p)) <= 0) return;
    if (d < 0 && (bolsa[k] | 0) <= 0) return;
    bolsa[k] = (bolsa[k] | 0) + (d > 0 ? 1 : -1); if (typeof Sonido !== "undefined") Sonido.sfx("clic"); this.guardar(u);
  },
  reiniciar(u, pres = false) { const p = this.pj(u); if (pres) p.ppts = Heroes.cero(); else p.pts = Heroes.cero(); this.guardar(u); },
  /* ---------- Skins ---------- */
  /* Las skins de una clase que se pueden ver (las que el panel sacó de la venta solo las ve quien ya las tiene) */
  skinsDe(clase, u) { const mias = (u && this.datos(u).skins) || []; return HE.SKINS.map(x => HE.SKIN[x[0]]).filter(S => (!S.clase || S.clase === clase) && (Catalogo.visible("skin:" + S.id) || mias.includes(S.id))); },
  precioSkin(S) { return Catalogo.precio("skin:" + S.id, S.precio); },
  comprarSkin(u, id) {
    const a = this.datos(u), S = HE.SKIN[id]; a.skins = a.skins || [];
    const precio = S && this.precioSkin(S);
    if (!S || a.skins.includes(id) || (S.clase && S.clase !== a.clase) || (u.monedas || 0) < precio || !Catalogo.visible("skin:" + id)) return false;
    u.monedas -= precio; a.skins.push(id); a.pj[a.clase].skin = id;
    Catalogo.anotar(u, "skin", "skin:" + id, S.nombre, precio);
    if (typeof Sonido !== "undefined") Sonido.sfx("victoria");
    Toast.mostrar(`<div class="t-ic">${S.ic}</div><div class="t-txt"><small>Skin nueva</small><b>${esc(S.nombre)}</b><span>Ya la tiene puesta tu ${esc(AR.CLASES[a.clase].nombre)}.</span></div>`, "logro");
    if (u.nube && typeof Nube !== "undefined") Nube.actividad("compra", "skin", 0, -precio);
    this.guardar(u); return true;
  },
  ponerSkin(u, id) {
    const a = this.datos(u), p = a.pj[a.clase];
    if (id && !(a.skins || []).includes(id)) return;
    p.skin = id || null; this.guardar(u);
  },
  evolucionar(u, id) {
    const a = this.datos(u), p = a.pj[a.clase], L = this.nivel(p.xp, p.pre), e = this.evoDe(a.clase, id);
    if (!e) return;
    const paso = HE.EVOS[a.clase][e.rama].indexOf(HE.EVOS[a.clase][e.rama].find(x => x.id === id));
    if (paso === 0 && ((L.n < 10 && !p.pre) || p.evo.length)) return;
    if (paso === 1 && ((L.n < 20 && !p.pre) || p.evo[0] !== HE.EVOS[a.clase][e.rama][0].id || p.evo.length > 1)) return;
    p.evo.push(id);
    if (typeof Sonido !== "undefined") Sonido.sfx("logro");
    const P = e.poder && HE.PODERES[e.poder];
    Toast.mostrar(`<div class="t-ic">${e.ic}</div><div class="t-txt"><small>¡Evolución!</small><b>${esc(e.nombre)}</b><span>${esc(e.desc)}${P ? ` Nuevo poder: ${P.ic} ${esc(P.nombre)}.` : ""}</span></div>`, "logro");
    this.guardar(u);
  },
  /* Volver a elegir el camino de evolución: la primera vez es gratis, después cuesta un poco (no se pierden niveles ni prestigio) */
  precioEvoReset(p) { return (p.evoR | 0) ? Catalogo.precio("arena:evoReset", HE.EVO_RESET) : 0; },
  reiniciarEvo(u) {
    const a = this.datos(u), p = a.pj[a.clase], precio = this.precioEvoReset(p);
    if (!p.evo.length || (u.monedas || 0) < precio) return false;
    u.monedas -= precio; p.evo = []; p.evoR = (p.evoR | 0) + 1;
    if (precio && u.nube && typeof Nube !== "undefined") Nube.actividad("compra", "arena", 0, -precio);
    if (typeof Sonido !== "undefined") Sonido.sfx("clic");
    Toast.mostrar(`<div class="t-ic">↺</div><div class="t-txt"><small>Evolución reiniciada</small><b>Elegí de nuevo el camino de tu ${esc(AR.CLASES[a.clase].nombre)}</b>${precio ? `<span>Pagaste ${precio} 🪙</span>` : ""}</div>`, "logro");
    this.guardar(u); return true;
  },
  comprar(u, id) {
    const a = this.datos(u), p = a.pj[a.clase], it = this.item(a.clase, id);
    if (!it || it.botin || p.items.includes(it.id) || !this.desbloqueado(p, it) || u.monedas < it.precio || !Catalogo.visible("tier:" + it.tier)) return false;
    if (p.items.length >= HE.BOLSA) { Toast.mostrar(`<div class="t-ic">🎒</div><div class="t-txt"><b>Bolsa llena</b><span>Vendé algo del inventario para hacer lugar (máximo ${HE.BOLSA}).</span></div>`, "info"); return false; }
    u.monedas -= it.precio; p.items.push(it.id); p.eq[it.slot] = it.id;
    if (u.nube) Nube.actividad("compra", "arena", 0, -it.precio);
    Catalogo.anotar(u, "equipo", "tier:" + it.tier, `${AR.CLASES[a.clase].nombre}: ${it.nombre}`, it.precio);
    if (typeof Sonido !== "undefined") Sonido.sfx("monedas");
    Toast.mostrar(`<div class="t-ic">${HE.SLOTS[it.slot][1]}</div><div class="t-txt"><small>Comprado y puesto</small><b>${esc(it.nombre)}</b></div>`, "logro");
    this.guardar(u); return true;
  },
  /* Poner algo de la bolsa (id) o sacar lo que hay en ese lugar (id = null) */
  equipar(u, slot, id) {
    const a = this.datos(u), p = a.pj[a.clase];
    if (!HE.SLOTS[slot]) return;
    if (id) { const it = this.item(a.clase, id); if (!it || it.slot !== slot || !p.items.includes(id)) return; }
    p.eq[slot] = id || null;
    if (typeof Sonido !== "undefined") Sonido.sfx("clic");
    this.guardar(u);
  },
  /* ---------- Trabajar el botín: mejorar, engarzar gemas, grabar y desarmar ---------- */
  /* Cambia un objeto por su versión nueva (en la bolsa y, si estaba puesto, en el cuerpo) */
  reemplazar(p, viejo, nuevo) {
    const i = p.items.indexOf(viejo); if (i < 0) return false;
    p.items[i] = nuevo; for (const s of Object.keys(p.eq)) if (p.eq[s] === viejo) p.eq[s] = nuevo;
    if (p.nuevos) p.nuevos = p.nuevos.map(x => x === viejo ? nuevo : x);
    if (UI.heroe && UI.heroe.ver === viejo) UI.heroe.ver = nuevo;
    return true;
  },
  /* Costo de pasar de +n a +(n+1) y chance de que salga bien */
  costoMejora(it) { const n = it.mejora + 1; return { n, monedas: Math.round(20 * n * (1 + 0.3 * it.rar)), frag: n + it.rar, chance: n >= 6 ? 1 - (n - 5) * 0.1 : 1 }; },
  puedeMejorar(it) { return !!(it && it.botin && it.rar >= 1 && it.mejora < HE.MEJORA_MAX); },
  aviso(ic, titulo, txt) { Toast.mostrar(`<div class="t-ic">${ic}</div><div class="t-txt"><b>${esc(titulo)}</b>${txt ? `<span>${esc(txt)}</span>` : ""}</div>`, "info"); },
  mejorar(u, id, azar = Math.random) {
    const a = this.datos(u), p = a.pj[a.clase], it = this.item(a.clase, id), m = this.mat(u);
    if (!this.puedeMejorar(it) || !p.items.includes(id)) return null;
    const c = this.costoMejora(it);
    if ((u.monedas || 0) < c.monedas || m.f < c.frag) { this.aviso("🧩", "Te faltan materiales", `Necesitás ${c.monedas} 🪙 y ${c.frag} fragmentos.`); return null; }
    u.monedas -= c.monedas; m.f -= c.frag;
    if (u.nube && typeof Nube !== "undefined") Nube.actividad("compra", "arena", 0, -c.monedas);
    const ok = azar() < c.chance;
    if (ok) {
      const nuevo = this.codigo({ ...it.o, m: c.n, gemas: it.gemas }, it.huecos); this.reemplazar(p, id, nuevo);
      if (typeof Sonido !== "undefined") Sonido.sfx("logro");
      Toast.mostrar(`<div class="t-ic">⬆️</div><div class="t-txt"><small>¡Mejora lograda!</small><b>${esc(this.item(a.clase, nuevo).nombre)}</b><span>+${Math.round(HE.MEJORA_PCT * 100)}% a todo lo que da</span></div>`, "logro");
    } else { if (typeof Sonido !== "undefined") Sonido.sfx("derrota"); this.aviso("💥", "La mejora falló", "Perdiste los materiales, pero el objeto quedó igual."); }
    this.guardar(u); return ok;
  },
  /* Poner una gema ("r3" = rubí nivel 3) en el hueco i (si había otra, vuelve a los materiales) */
  engarzar(u, id, i, gema) {
    const a = this.datos(u), p = a.pj[a.clase], it = this.item(a.clase, id), m = this.mat(u);
    if (!it || !it.botin || !p.items.includes(id) || !(i >= 0 && i < it.huecos) || !(m.g[gema] > 0) || !HE.GEMAS[gema[0]]) return false;
    const gemas = it.gemas.slice(); if (gemas[i]) this.sumarMat(u, "g", gemas[i].k + gemas[i].n);
    gemas[i] = { k: gema[0], n: +gema[1] }; this.sumarMat(u, "g", gema, -1);
    this.reemplazar(p, id, this.codigo({ ...it.o, gemas }, it.huecos));
    if (typeof Sonido !== "undefined") Sonido.sfx("monedas");
    this.guardar(u); return true;
  },
  sacarGema(u, id, i) {
    const a = this.datos(u), p = a.pj[a.clase], it = this.item(a.clase, id);
    if (!it || !it.botin || !p.items.includes(id) || !it.gemas[i]) return false;
    const gemas = it.gemas.slice(); this.sumarMat(u, "g", gemas[i].k + gemas[i].n); gemas[i] = null;
    this.reemplazar(p, id, this.codigo({ ...it.o, gemas }, it.huecos));
    this.guardar(u); return true;
  },
  /* Grabar con un pergamino (reemplaza el grabado que tenía) */
  grabar(u, id, k) {
    const a = this.datos(u), p = a.pj[a.clase], it = this.item(a.clase, id), m = this.mat(u);
    if (!it || !it.botin || !p.items.includes(id) || !HE.GRABADOS[k] || !(m.p[k] > 0)) return false;
    this.sumarMat(u, "p", k, -1);
    this.reemplazar(p, id, this.codigo({ ...it.o, gemas: it.gemas, grab: k }, it.huecos));
    if (typeof Sonido !== "undefined") Sonido.sfx("logro");
    Toast.mostrar(`<div class="t-ic">${HE.GRABADOS[k][1]}</div><div class="t-txt"><small>Grabado</small><b>${esc(it.nombre)} ${esc(HE.GRABADOS[k][0])}</b></div>`, "logro");
    this.guardar(u); return true;
  },
  /* Fragmentos que da desarmar algo (y las gemas engarzadas vuelven) */
  fragDe(it) { return it.botin ? Math.round([2, 4, 7, 12, 20][it.rar] * (0.8 + 0.2 * it.grado)) + it.mejora : 1 + Math.floor(it.tier / 2); },
  devolverGemas(u, it) { if (it.botin) it.gemas.forEach(g => { if (g) this.sumarMat(u, "g", g.k + g.n); }); },
  desarmar(u, id) {
    const a = this.datos(u), p = a.pj[a.clase], it = this.item(a.clase, id), i = p.items.indexOf(id);
    if (!it || i < 0 || Object.values(p.eq).includes(id)) return false;
    const n = this.fragDe(it);
    p.items.splice(i, 1); p.nuevos = (p.nuevos || []).filter(x => x !== id);
    this.devolverGemas(u, it); this.sumarMat(u, "f", null, n);
    if (typeof Sonido !== "undefined") Sonido.sfx("clic");
    Toast.mostrar(`<div class="t-ic">🧩</div><div class="t-txt"><small>Desarmado</small><b>${esc(it.nombre)}</b><span>+${n} fragmentos${it.botin && it.gemas.some(Boolean) ? " · las gemas volvieron a tus materiales" : ""}</span></div>`, "logro");
    this.guardar(u); return true;
  },
  /* Vender algo que no está puesto. El servidor no deja subir más de 500 monedas por guardado:
     cada venta es de hasta 400 y, si se vende mucho seguido, se espera a que se guarde lo anterior */
  venta: { m: 0, t: 0 },
  vender(u, id) {
    const a = this.datos(u), p = a.pj[a.clase], it = this.item(a.clase, id), i = p.items.indexOf(id), V = this.venta;
    if (!it || i < 0 || Object.values(p.eq).includes(id)) return false;
    const m = Math.max(0, Math.min(HE.VENTA_MAX, it.venta | 0));
    if (Date.now() - V.t > 20000) V.m = 0;
    if (m && u.nube && V.m + m > 450) { Toast.mostrar(`<div class="t-ic">⏳</div><div class="t-txt"><b>Esperá un momento</b><span>Estamos guardando la venta anterior. Probá de nuevo en unos segundos.</span></div>`, "info"); return false; }
    p.items.splice(i, 1); p.nuevos = (p.nuevos || []).filter(x => x !== id); this.devolverGemas(u, it);
    Eco.completar(u); u.monedas += m;
    if (typeof Sonido !== "undefined") Sonido.sfx(m ? "monedas" : "clic");
    Toast.mostrar(`<div class="t-ic">${HE.SLOTS[it.slot][1]}</div><div class="t-txt"><small>${m ? "Vendido" : "Tirado"}</small><b>${esc(it.nombre)}</b>${m ? `<span>+${m} 🪙</span>` : ""}</div>`, "logro");
    Eco.guardar(u);
    if (m && u.nube && typeof Nube !== "undefined") {
      V.m += m; V.t = Date.now(); Nube.actividad("ingreso", "arena", 0, m);
      Promise.resolve(Nube.cola).then(() => { V.m = Math.max(0, V.m - m); });
    }
    render(); return true;
  }
};

/* ---------- Elegir con qué personaje pelear (también desde la sala online, sin salir) ---------- */
Heroes.selector = () => {
  const u = BD.sesion(); if (!u) return "";
  const a = Heroes.datos(u);
  return `<div class="he-elige"><span class="label">Tu héroe</span><div class="he-tabs">${Object.entries(AR.CLASES).map(([k, X]) => { const q = a.pj[k], l = Heroes.nivel(q.xp, q.pre), e = q.evo.length ? Heroes.evoDe(k, q.evo[q.evo.length - 1]) : null;
    return `<button class="he-tab ${k === a.clase ? "on" : ""}" data-heroe="${k}" aria-pressed="${k === a.clase}"><span class="ic">${e ? e.ic : X.ic}</span><b>${esc(e ? e.nombre : X.nombre)}</b><small>${q.pre ? `${HE.PRESTIGIO[q.pre - 1].ic} ` : ""}Nv ${l.n}</small></button>`; }).join("")}</div></div>`;
};
Heroes.conectarSelector = (raiz = app) => {
  raiz.querySelectorAll("[data-heroe]").forEach(b => b.onclick = () => {
    const u = BD.sesion(); if (!u) return;
    Heroes.datos(u).clase = b.dataset.heroe; Eco.guardar(u);
    if (typeof Sonido !== "undefined") Sonido.sfx("clic");
    // Online: el anfitrión toma su perfil al empezar; los demás se lo mandan
    if (Net.rol && Net.rol !== "host") Net.send({ t: "arenaPerfil", p: Arena.miPerfil(), torre: Torre.info() });
    raiz.querySelectorAll("[data-heroe]").forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
  });
};

/* ---------- Armería: personajes, evoluciones, puntos, equipo y a pelear ---------- */
PANTALLAS.arenaIntro = () => {
  const u = BD.sesion();
  if (!u) {
    app.innerHTML = `${head(0)}<section class="stage">${personaje("#ff4d63", "civ", 110, ["casco"])}<h2>Arena</h2><p class="sub">Necesitas un perfil para guardar tus personajes y tu ELO.</p><button class="btn" id="arPerfil">Crear o elegir perfil</button><button class="btn ghost" id="volver">Volver</button></section>`;
    on("arPerfil", () => go("cuenta")); on("volver", () => go("home")); return;
  }
  const a = Heroes.datos(u), clase = a.clase, C = AR.CLASES[clase], p = a.pj[clase], L = Heroes.nivel(p.xp, p.pre), libres = Heroes.libres(p), evoOk = n => L.n >= n || p.pre > 0;
  const perfil = Heroes.validar(Heroes.perfil(u)), st = Heroes.stats(perfil), elo = Arena.elo(u), sa = u.stats.arena || {};
  const cfg = S.arenaCfg || { modo: "duelo", nivel: "normal", esc: "ring" }, U = UI.heroe = UI.heroe || { slot: null };
  const evoAct = p.evo.length ? Heroes.evoDe(clase, p.evo[p.evo.length - 1]) : null;
  const nombrePj = evoAct ? evoAct.nombre : C.nombre;
  // Pestañas: un personaje por clase
  const tabs = `<div class="he-tabs">${Object.entries(AR.CLASES).map(([k, X]) => { const q = a.pj[k], l = Heroes.nivel(q.xp, q.pre), e = q.evo.length ? Heroes.evoDe(k, q.evo[q.evo.length - 1]) : null, aviso = Heroes.libres(q) > 0 || Heroes.libresPre(q) > 0 || ((l.n >= 10 || q.pre) && !q.evo.length) || ((l.n >= 20 || q.pre) && q.evo.length === 1) || Heroes.puedePrestigio(q);
    return `<button class="he-tab ${k === clase ? "on" : ""}" data-pj="${k}"><span class="ic">${e ? e.ic : X.ic}</span><b>${esc(e ? e.nombre : X.nombre)}</b><small>${q.pre ? `${HE.PRESTIGIO[q.pre - 1].ic} ` : ""}Nv ${l.n}</small>${aviso ? `<i class="he-punto"></i>` : ""}</button>`; }).join("")}</div>`;
  // Skins
  const misSkins = a.skins || [], ver = U.skinVer && U.skinVer.clase === clase ? U.skinVer.id : undefined;
  const skinsHTML = `<div class="panel he-skins"><div class="headrow"><span class="label">🎨 Skins de ${esc(AR.CLASES[clase].nombre)}</span><small class="sub">Solo cambian cómo se ve</small></div>
    <div class="he-skin-grid">
      <button class="he-skin ${!p.skin ? "puesta" : ""} ${ver === null ? "viendo" : ""}" data-skinver=""><span class="ic">🙂</span><b>Normal</b><small>${!p.skin ? "✓ Puesta" : "Gratis"}</small></button>
      ${Heroes.skinsDe(clase, u).map(S => { const tengo = misSkins.includes(S.id), puesta = p.skin === S.id;
        return `<button class="he-skin ${puesta ? "puesta" : ""} ${ver === S.id ? "viendo" : ""} ${S.clase ? "exclusiva" : ""}" data-skinver="${S.id}" style="--sc:${S.aura || S.tinte || "#748ffc"}"><span class="ic">${S.ic}</span><b>${esc(S.nombre)}</b><small>${puesta ? "✓ Puesta" : tengo ? "Tuya" : `🪙 ${Heroes.precioSkin(S)}`}</small>${S.clase ? `<em>Exclusiva</em>` : ""}</button>`; }).join("")}
    </div>
    ${ver !== undefined && ver !== (p.skin || null) ? (() => { const S = ver && HE.SKIN[ver]; return `<div class="he-skin-acc"><span>👀 Probando <b>${S ? esc(S.nombre) : "Normal"}</b> en la vista de arriba</span>${!S || misSkins.includes(ver) ? `<button class="btn chico" id="skinPoner">Ponérsela</button>` : `<button class="btn chico" id="skinComprar" ${(u.monedas || 0) < Heroes.precioSkin(S) ? "disabled" : ""}>Comprar · 🪙 ${Heroes.precioSkin(S)}</button>`}</div>`; })() : ""}
  </div>`;
  // Evoluciones
  const E = HE.EVOS[clase], rama = p.evo.length ? Heroes.evoDe(clase, p.evo[0]).rama : null;
  const poderTxt = e => { const P = e.poder && HE.PODERES[e.poder]; return P ? `<small class="he-poder">⚡ Poder: ${P.ic} <b>${esc(P.nombre)}</b> — ${esc(P.desc)}</small>` : ""; };
  const evoCard = (e, paso, estado) => `<div class="he-evo ${estado}"><span class="ic">${e.ic}</span><div><b>${esc(e.nombre)}</b><small>${esc(e.desc)}</small>${poderTxt(e)}</div>
    ${estado === "elegir" ? `<button class="btn chico" data-evo="${e.id}">Elegir</button>` : estado === "lista" ? `<button class="btn chico" data-evo="${e.id}">Evolucionar</button>` : estado === "hecha" ? `<span class="ok">✓</span>` : `<span class="he-req">Nv ${paso ? 20 : 10}</span>`}</div>`;
  const precioEvo = Heroes.precioEvoReset(p);
  const evos = !rama
    ? `<p class="sub">${evoOk(10) ? "¡Ya puede evolucionar! Elegí un camino (si te arrepentís, después lo podés cambiar):" : `En el nivel 10 elegís uno de estos dos caminos:`}</p>
       <div class="he-caminos">${["a", "b"].map(r => `<div class="he-camino">${evoCard(E[r][0], 0, evoOk(10) ? "elegir" : "bloq")}${evoCard(E[r][1], 1, "bloq")}</div>`).join("")}</div>`
    : `<div class="he-camino solo">${evoCard(E[rama][0], 0, "hecha")}${evoCard(E[rama][1], 1, p.evo.length > 1 ? "hecha" : evoOk(20) ? "lista" : "bloq")}</div>
       <button class="btn ghost chico he-evoreset" id="heEvoReset" ${(u.monedas || 0) < precioEvo ? "disabled" : ""}>↺ Cambiar de camino · ${precioEvo ? `🪙 ${precioEvo}` : "gratis la primera vez"}</button>`;
  // Puntos: se ponen donde uno quiera (los de nivel y, con prestigio, los de prestigio)
  const modoPre = p.pre > 0 && U.modoPts === "pre", libresP = Heroes.libresPre(p), quedan = modoPre ? libresP : libres, bolsaPts = modoPre ? p.ppts : p.pts;
  const statsHTML = (p.pre ? `<div class="tabs dos he-modo"><button data-modopts="nivel" aria-pressed="${!modoPre}">Puntos de nivel${libres ? ` · ${libres}` : ""}</button><button data-modopts="pre" aria-pressed="${modoPre}">⭐ De prestigio${libresP ? ` · ${libresP}` : ""}</button></div>` : "")
    + `<p class="sub he-nota">${modoPre ? `Los puntos de prestigio no se pierden al subir de prestigio. Ponelos donde quieras.` : "Poné los puntos donde quieras. Reiniciar es gratis."} Daño de esta clase: ${st.tipo === "mag" ? "mágico" : "físico"}.</p>`
    + Object.entries(HE.STATS).map(([k, [nom, ic, desc]]) => `<div class="he-stat"><span class="ic">${ic}</span><div><b>${nom} <em>${p.pts[k] | 0}</em>${p.ppts[k] ? `<em class="he-pp">+${p.ppts[k]} de prestigio</em>` : ""}</b><small>${desc}</small></div>
    <button class="he-mas menos" data-pt="${k}" data-d="-1" ${bolsaPts[k] ? "" : "disabled"} aria-label="Quitar un punto${modoPre ? " de prestigio" : ""} de ${nom}">−</button><button class="he-mas ${modoPre ? "pre" : ""}" data-pt="${k}" data-d="1" ${quedan > 0 ? "" : "disabled"} aria-label="Sumar un punto${modoPre ? " de prestigio" : ""} a ${nom}">+</button></div>`).join("");
  // Equipo: inventario (lo puesto arriba y la bolsa) y la tienda aparte
  const tabEq = U.tabEq === "tienda" ? "tienda" : "bolsa", nuevos = p.nuevos || [], itemDe = id => Heroes.item(clase, id);
  const munieco = `<div class="he-doll">${Object.entries(HE.SLOTS).map(([s, [nom, ic]]) => { const it = itemDe(p.eq[s]);
    return `<button class="he-dslot ${it ? "lleno" : ""} ${it && it.botin ? "botin" : ""}" data-ver="${it ? it.id : ""}" data-vslot="${s}" style="--c:${it ? it.color : "transparent"}"><span class="ic">${ic}</span><small>${nom}</small><b>${it ? esc(it.nombre) : "Nada"}</b></button>`; }).join("")}</div>`;
  const mios = p.items.map(itemDe).filter(Boolean), filtro = HE.SLOTS[U.filtro] ? U.filtro : null;
  const lista = mios.filter(it => !filtro || it.slot === filtro).sort((x, y) => (p.eq[y.slot] === y.id) - (p.eq[x.slot] === x.id) || y.rar - x.rar || y.tier - x.tier);
  const tarjeta = it => { const puesto = p.eq[it.slot] === it.id;
    return `<button class="he-card ${puesto ? "puesto" : ""} ${it.botin ? "botin r" + it.rar : ""}" data-ver="${it.id}" style="--c:${it.color}"><span class="he-ic">${HE.SLOTS[it.slot][1]}</span><span class="he-card-tx"><b>${esc(it.nombre)}</b><small class="he-rar">${it.botin ? `${esc(it.rareza.nombre)} <span class="he-est">${it.estrellas}</span>` : "Tienda"} · ${HE.SLOTS[it.slot][0]}${it.afijo ? ` · ${it.afijo.ic}` : ""}${it.botin && it.huecos ? ` · ${it.gemas.map(g => g ? HE.GEMAS[g.k][1] : "◌").join("")}` : ""}${it.grab ? ` · ${HE.GRABADOS[it.grab][1]}` : ""}</small><small>${esc(Heroes.lineasBonus(it.bonus, clase).slice(0, 2).join(" · ") || "Sin bonus")}</small></span>${puesto ? `<em class="he-marca">✓ Puesto</em>` : nuevos.includes(it.id) ? `<em class="he-marca nuevo">¡Nuevo!</em>` : ""}</button>`; };
  // Materiales para trabajar el botín
  const M = Heroes.mat(u), nGem = Object.values(M.g).reduce((t, x) => t + x, 0), nPerg = Object.values(M.p).reduce((t, x) => t + x, 0);
  const matHTML = `<div class="he-mat"><span>🧩 <b>${M.f}</b> fragmentos</span><span>💎 <b>${nGem}</b> gemas</span><span>📜 <b>${nPerg}</b> pergaminos</span></div>
    ${nGem + nPerg ? `<div class="he-mat-lista">${Object.entries(M.g).sort().map(([k, n]) => `<span title="${HE.GEMAS[k[0]][0]} nivel ${k[1]}: ${esc(Heroes.lineasBonus({ [HE.GEMAS[k[0]][2]]: HE.GEMAS[k[0]][3] * k[1] }, clase)[0] || "")}">${HE.GEMAS[k[0]][1]}${k[1]} ×${n}</span>`).join("")}${Object.entries(M.p).map(([k, n]) => `<span title="Pergamino ${HE.GRABADOS[k][0]}">📜${HE.GRABADOS[k][1]} ×${n}</span>`).join("")}</div>` : ""}`;
  const bolsaHTML = `${munieco}
    <div class="headrow he-bolsa-h"><span class="label">🎒 Bolsa ${mios.length}/${HE.BOLSA}</span>${mios.length >= HE.BOLSA ? `<small class="he-lleno">¡Bolsa llena! Vendé algo</small>` : `<small class="sub">Tocá algo para verlo</small>`}</div>
    ${matHTML}
    <div class="chips-j he-filtro"><button class="chip-j ${!filtro ? "on" : ""}" data-filtro="">Todo</button>${Object.entries(HE.SLOTS).map(([s, [nom, ic]]) => `<button class="chip-j ${filtro === s ? "on" : ""}" data-filtro="${s}">${ic} ${nom}</button>`).join("")}</div>
    <div class="he-bolsa">${lista.map(tarjeta).join("") || `<p class="sub">No tenés nada de esto. Comprá en la tienda o ganá botín en la torre.</p>`}</div>
    <p class="sub he-nota">💡 El botín sale en la torre (cuanto más alto, mejor; los jefes siempre dejan algo) y, un poco menos, peleando contra la compu. Del raro para arriba se mejora hasta +10; las gemas van en los huecos y los pergaminos graban un poder. Lo que no tenés puesto se vende o se desarma en fragmentos.</p>`;
  const slotHTML = Object.entries(HE.SLOTS).map(([s, [nom, ic]]) => {
    const it = itemDe(p.eq[s]), abierto = U.slot === s;
    return `<button class="he-slot ${abierto ? "on" : ""}" data-slot="${s}"><span class="he-ic" style="--c:${it ? it.color : "transparent"}">${ic}</span><div><small>${nom}</small><b>${it ? esc(it.nombre) : "Nada"}</b>${it ? `<small>${Heroes.textoBonus(it.bonus, clase)}</small>` : ""}</div><span class="he-flecha">${abierto ? "▲" : "▼"}</span></button>
      ${abierto ? `<div class="he-items">
        ${Heroes.catalogo(clase, s).map(x => { const tengo = p.items.includes(x.id), puesto = p.eq[s] === x.id, bloq = !tengo && !Heroes.desbloqueado(p, x), agotado = !tengo && !Catalogo.visible("tier:" + x.tier);
          return `<div class="he-item ${puesto ? "puesto" : ""} ${bloq ? "bloq" : ""}"><span class="he-ic" style="--c:${x.color}">${ic}</span><div><b>${esc(x.nombre)}</b><small>${Heroes.textoBonus(x.bonus, clase)}</small></div>
            ${puesto ? `<span class="ok">Puesto</span>` : tengo ? `<button class="btn chico ghost" data-equipar="${s}" data-id="${x.id}">Poner</button>` : bloq ? `<span class="he-req">🔒 Nv ${x.nivel}</span>` : agotado ? `<span class="he-req">No disponible</span>` : `<button class="btn chico" data-comprar="${x.id}" ${u.monedas < x.precio ? "disabled" : ""}>🪙 ${x.precio}</button>`}</div>`; }).join("")}</div>` : ""}`;
  }).join("");
  const tiendaHTML = `<p class="sub he-nota">Cada material se compra al llegar a su nivel. Lo que comprás va a la bolsa y se pone solo.</p>${slotHTML}`;
  // Detalle de una cosa de la bolsa: qué da, comparado con lo puesto, y equipar / quitar / vender
  const det = U.ver && p.items.includes(U.ver) ? itemDe(U.ver) : null;
  const detalle = !det ? "" : (() => {
    const puesto = p.eq[det.slot] === det.id, actual = !puesto && itemDe(p.eq[det.slot]), pct = x => `${Math.round(Math.abs(x) * 1000) / 10}`.replace(".", ",") + "%";
    const comp = actual ? [...new Set([...Object.keys(det.bonus), ...Object.keys(actual.bonus)])].map(k => { let d = (det.bonus[k] || 0) - (actual.bonus[k] || 0); if (k === "cd") d = -d; return Math.abs(d) < 0.0005 ? "" : `<span class="${d > 0 ? "mas" : "menos"}">${d > 0 ? "▲" : "▼"} ${k === "cd" ? (d > 0 ? "ataca más rápido" : "ataca más lento") : HE.QUE[k][0]} ${pct(d)}</span>`; }).filter(Boolean).join(" ") : "";
    const elige = U.pick && U.pick.id === det.id ? U.pick.k : null, cm = det.botin && Heroes.puedeMejorar(det) ? Heroes.costoMejora(det) : null;
    const lineaGema = g => `${HE.GEMAS[g.k][1]} ${HE.GEMAS[g.k][0]} ${g.n} (${esc(Heroes.lineasBonus({ [HE.GEMAS[g.k][2]]: HE.GEMAS[g.k][3] * g.n }, clase)[0])})`;
    const huecos = det.botin && det.huecos ? `<div class="he-det-sec"><small class="label">💎 Engarces</small><div class="he-huecos">${det.gemas.map((g, i) => `<button class="he-hueco ${g ? "lleno" : ""} ${elige === "g" + i ? "on" : ""}" data-hueco="${i}">${g ? lineaGema(g) : "◌ Vacío · tocá para engarzar"}</button>`).join("")}</div>
      ${elige && elige[0] === "g" ? (() => { const i = +elige.slice(1), g = det.gemas[i], lista = Object.entries(M.g).sort();
        return `<div class="he-pick">${g ? `<button class="chip-j" data-sacargema="${i}">↩ Sacar la gema</button>` : ""}${lista.map(([k, n]) => `<button class="chip-j" data-engarzar="${k}" data-i="${i}">${HE.GEMAS[k[0]][1]} ${HE.GEMAS[k[0]][0]} ${k[1]} ×${n}</button>`).join("") || `<small class="sub">No tenés gemas. Caen en la torre y peleando contra la compu.</small>`}</div>`; })() : ""}</div>` : "";
    const grabado = det.botin ? `<div class="he-det-sec"><small class="label">📜 Grabado</small><button class="he-hueco ${det.grab ? "lleno" : ""} ${elige === "p" ? "on" : ""}" data-grabar="1">${det.grab ? `${HE.GRABADOS[det.grab][1]} ${HE.GRABADOS[det.grab][0]}: ${esc(Heroes.lineasBonus({ [HE.GRABADOS[det.grab][2]]: HE.GRABADOS[det.grab][3] }, clase)[0])} · tocá para cambiarlo` : "Sin grabado · tocá para grabar"}</button>
      ${elige === "p" ? `<div class="he-pick">${Object.entries(M.p).map(([k, n]) => `<button class="chip-j" data-pergamino="${k}">${HE.GRABADOS[k][1]} ${HE.GRABADOS[k][0]} ×${n}</button>`).join("") || `<small class="sub">No tenés pergaminos. Caen en la torre y peleando contra la compu.</small>`}</div>` : ""}</div>` : "";
    return `<div class="modal-fondo he-det-fondo" id="heVerFondo"><div class="modal he-det ${det.botin ? "botin r" + det.rar : ""}" role="dialog" aria-label="${esc(det.nombre)}" style="--c:${det.color}">
      <div class="he-det-ic">${HE.SLOTS[det.slot][1]}${det.mejora ? `<em>+${det.mejora}</em>` : ""}</div><b class="he-det-nom">${esc(det.nombre)}</b>
      <small class="he-rar">${det.botin ? `${esc(det.rareza.nombre)} · <span class="he-est">${det.estrellas}</span> ${esc(det.gradoN)} · botín del piso ${det.piso}` : `De la tienda · nivel ${det.nivel}`} · ${HE.SLOTS[det.slot][0]}</small>
      <ul class="he-det-bon">${Heroes.lineasBonus(det.bonus, clase).map(x => `<li>${esc(x)}</li>`).join("") || "<li>Sin bonus</li>"}</ul>
      ${det.afijo ? `<p class="he-afijo">${det.afijo.ic} <b>${esc(det.afijo.nombre)}</b>: poder especial del botín (ya sumado arriba)</p>` : ""}
      ${actual ? `<p class="he-comp"><small>Comparado con ${esc(actual.nombre)}:</small> ${comp || "da lo mismo"}</p>` : !puesto ? `<p class="he-comp"><small>No tenés nada puesto en ${HE.SLOTS[det.slot][0].toLowerCase()}.</small></p>` : ""}
      ${huecos}${grabado}
      ${cm ? `<button class="btn tb-girar" id="heMejorar" ${(u.monedas || 0) < cm.monedas || M.f < cm.frag ? "disabled" : ""}>⬆️ Mejorar a +${cm.n} · 🪙 ${cm.monedas} · 🧩 ${cm.frag}${cm.chance < 1 ? ` · ${Math.round(cm.chance * 100)}% de éxito` : ""}</button>` : det.botin && det.rar >= 1 ? `<small class="sub">✨ Mejorado al máximo (+${HE.MEJORA_MAX})</small>` : det.botin ? `<small class="sub">Los comunes no se mejoran.</small>` : `<small class="sub">Lo de la tienda no se mejora ni se engarza: eso es para el botín.</small>`}
      <div class="row">${puesto ? `<button class="btn ghost" data-quitar="${det.slot}">Quitar</button>` : `<button class="btn" data-equipar="${det.slot}" data-id="${det.id}">Equipar</button><button class="btn ghost" id="heVender">${det.venta ? `Vender · 🪙 ${det.venta}` : "Tirar"}</button><button class="btn ghost" id="heDesarmar">Desarmar · 🧩 ${Heroes.fragDe(det)}</button>`}</div>
      ${puesto ? `<small class="sub">Para venderlo o desarmarlo, primero sacátelo o poné otro.</small>` : ""}
      <button class="linkish" id="heVerCerrar">Cerrar</button></div></div>`;
  })();
  const xpTxt = L.tope ? (p.pre >= HE.PRESTIGIOS ? "¡Nivel 1000! Llegaste a lo más alto." : "¡Nivel 40! Ya podés subir de prestigio.") : `${L.enEste}/${L.falta} XP para el nivel ${L.n + 1}`;
  // Prestigio: las 10 mejoras y el botón para subir
  const PR = HE.PRESTIGIO, prest = `<div class="panel he-prestigio"><div class="headrow"><span class="label">Prestigio ${p.pre ? `${PR[p.pre - 1].ic} ${p.pre}` : "0"} de ${HE.PRESTIGIOS}</span>${p.pre ? `<small class="sub">${Heroes.usados(p.ppts)} puntos de prestigio puestos${libresP ? ` · <b class="he-libres">${libresP} sin poner</b>` : ""}</small>` : ""}</div>
      <p class="sub he-nota">${p.pre >= HE.PRESTIGIOS ? "Prestigio máximo: ahora el nivel sigue hasta el 1000." : "Al llegar al nivel 40 podés volver al nivel 1 y subir un prestigio. Te quedás con la evolución y el equipo, ganás una mejora única para siempre y 20 puntos de prestigio para poner donde quieras (los puntos de nivel se reinician)."}</p>
      ${Heroes.puedePrestigio(p) ? `<button class="btn tb-girar" id="hePrestigio">${PR[p.pre].ic} Subir a prestigio ${p.pre + 1}: ${esc(PR[p.pre].nombre)}</button>` : ""}
      <div class="he-pres">${PR.map((x, k) => `<div class="he-pre ${k < p.pre ? "ok" : ""}"><span class="ic">${x.ic}</span><div><b>${k + 1}. ${esc(x.nombre)}</b><small>${esc(x.desc)}</small></div>${k < p.pre ? `<span class="ok">✓</span>` : ""}</div>`).join("")}</div></div>`;
  app.innerHTML = `${Cuenta.barra()}<section class="screen arena-pj">
    <div class="headrow"><h1 class="titulo chico">La <span>Arena</span></h1><span class="chip-mon">🪙 ${u.monedas}</span></div>
    ${tabs}
    <div class="ar-perfil he-ficha">
      <div class="ar-retrato"><canvas id="arPrev" width="160" height="170"></canvas></div>
      <div class="ar-datos"><span class="label">${C.ic} ${esc(C.nombre)}${evoAct ? ` → ${esc(evoAct.nombre)}` : ""}</span><b class="ar-elo he-nv">Nv ${L.n}${p.pre ? ` <small>${PR[p.pre - 1].ic} Prestigio ${p.pre}</small>` : ""}</b>
        <div class="he-xp"><i style="width:${Math.min(100, L.enEste / L.falta * 100)}%"></i></div><small>${xpTxt}</small>
        <div class="ar-st"><span>❤️ ${st.hp}</span><span>👟 ${Math.round(st.vel)}</span><span title="${st.tipo === "mag" ? "Poder mágico" : "Daño físico"}">${st.tipo === "mag" ? "🔮" : "💥"} ×${st.mult.toFixed(2)}</span><span>🛡️ ${Math.round((1 - st.def) * 100)}%</span>${st.crit ? `<span title="Chance y daño de crítico">🎯 ${Math.round(st.crit * 100)}% ×${st.critX.toFixed(1)}</span>` : ""}</div>
        <small>ELO ${elo} · ${sa.g || 0} victorias · ${sa.j || 0} peleas</small></div>
    </div>
    <div class="panel"><div class="headrow"><span class="label">Puntos${quedan ? ` · <b class="he-libres">${quedan} ${modoPre ? "de prestigio " : ""}para repartir</b>` : ""}</span><button class="linkish" id="heReiniciar" ${Heroes.usados(bolsaPts) ? "" : "disabled"}>↺ Reiniciar</button></div>${statsHTML}</div>
    <div class="panel"><span class="label">Evolución</span>${evos}</div>
    ${prest}
    <div class="panel he-equipo"><span class="label">Equipo de ${esc(nombrePj)}</span>
      <div class="tabs dos he-eqtabs"><button data-tabeq="bolsa" aria-pressed="${tabEq === "bolsa"}">🎒 Inventario</button><button data-tabeq="tienda" aria-pressed="${tabEq === "tienda"}">🛒 Tienda</button></div>
      ${tabEq === "tienda" ? tiendaHTML : bolsaHTML}</div>
    ${skinsHTML}
    ${Torre.panel(u)}
    <div class="panel"><span class="label">Escenario</span>
      <div class="chips-j">${Object.entries(AR.ESCENARIOS).map(([k, X]) => `<button class="chip-j ${cfg.esc === k ? "on" : ""}" data-esc="${k}">${X.ic} ${X.nombre}</button>`).join("")}</div>
      <span class="label">Contra la compu</span>
      <div class="tabs">${[["duelo", "1 contra 1"], ["todos", "Todos contra todos (4)"]].map(([k, n]) => `<button data-modo="${k}" aria-pressed="${cfg.modo === k}">${n}</button>`).join("")}</div>
      <div class="tabs">${[["facil", "Fácil"], ["normal", "Normal"], ["dificil", "Difícil"]].map(([k, n]) => `<button data-niv="${k}" aria-pressed="${cfg.nivel === k}">${n}</button>`).join("")}</div>
      <div class="opt"><div class="txt"><b>✨ Gráficos mejorados</b><small>Luces, antorchas y partículas (usa la placa de video). Apagalo si el teléfono va lento.</small></div><button class="switch" role="switch" aria-checked="${store.get("arenaPixi", true) !== false}" id="arPixi"></button></div>
      <button class="btn" id="arJugar">⚔️ ¡A pelear con ${esc(nombrePj)}!</button>
      <button class="btn ghost" id="arAmigos">Pelear con amigos (crear sala)</button>
    </div>
    <details class="panel"><summary class="label">Cómo se juega</summary><ul class="reglas-pts">
      <li><span>🕹️ Moverse</span><b>Arrastra el dedo (o flechas)</b></li><li><span>⚔️ Atacar</span><b>Tocá el botón grande (o espacio) y apunta solo al más cercano. Arrastrándolo apuntás a mano (sirve para el arquero)</b></li>
      <li><span>✨ Especial</span><b>Botón chico (o E), cuando se llena</b></li><li><span>⚡ Poder</span><b>Con la evolución final aparece un segundo botón (o Q)</b></li><li><span>🧪 Pociones</span><b>Pásales por encima: +35 de vida</b></li>
      <li><span>⭐ Experiencia</span><b>Cada pelea sube de nivel al personaje que usaste</b></li><li><span>🔥 Muerte súbita</span><b>A los 90 s todos pierden vida</b></li>
      <li><span>🏆 ELO</span><b>Solo cambia en peleas online con amigos (contra la compu no cuenta). Es uno para todos tus personajes</b></li></ul></details>
    <button class="btn ghost" id="volver">Inicio</button>
  </section>${detalle}`;
  Cuenta.conectarBarra();
  const cv = byId("arPrev"), ctx = cv.getContext("2d");
  const skinPrev = ver !== undefined ? ver : p.skin || null;
  const pintar = () => { ctx.clearRect(0, 0, 160, 170); ctx.save(); ctx.scale(1.7, 1.7); Arena.dibujarLuchador(ctx, { name: "", look: u.look, clase, skin: skinPrev, eq: st.ver, estilo: st.estilo, evoIc: st.evoIc, cara: 1, hp: 1, max: 1, invul: 0, lento: 0, golpe: -9999 }, 47, 80, performance.now() / 1000, false, 0); ctx.restore(); };
  // La vista se anima (las skins tienen aura y partículas)
  cancelAnimationFrame(Heroes.rafPrev);
  const animar = () => { if (!cv.isConnected) return; pintar(); Heroes.rafPrev = requestAnimationFrame(animar); };
  animar();
  app.querySelectorAll("[data-skinver]").forEach(b => b.onclick = () => { U.skinVer = { clase, id: b.dataset.skinver || null }; render(); const r = byId("arPrev"); if (r) r.scrollIntoView({ behavior: "smooth", block: "center" }); });
  on("skinPoner", () => { Heroes.ponerSkin(u, U.skinVer.id); U.skinVer = null; });
  on("skinComprar", () => { const S = HE.SKIN[U.skinVer.id]; if (confirm(`¿Comprar la skin ${S.nombre} por ${Heroes.precioSkin(S)} monedas?`) && Heroes.comprarSkin(u, S.id)) U.skinVer = null; });
  app.querySelectorAll("[data-pj]").forEach(b => b.onclick = () => { a.clase = b.dataset.pj; U.slot = null; U.ver = null; U.filtro = null; Eco.guardar(u); render(); });
  app.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => Heroes.punto(u, b.dataset.pt, +b.dataset.d, modoPre));
  app.querySelectorAll("[data-modopts]").forEach(b => b.onclick = () => { U.modoPts = b.dataset.modopts; render(); });
  on("heReiniciar", () => Heroes.reiniciar(u, modoPre));
  on("heEvoReset", () => { if (confirm(`¿Cambiar el camino de evolución de ${nombrePj}? Volvés a elegir entre los dos caminos (no perdés niveles, prestigio ni equipo).${precioEvo ? ` Cuesta ${precioEvo} monedas.` : " Esta vez es gratis; las próximas cuestan " + HE.EVO_RESET + " monedas."}`)) Heroes.reiniciarEvo(u); });
  // Inventario
  app.querySelectorAll("[data-tabeq]").forEach(b => b.onclick = () => { U.tabEq = b.dataset.tabeq; render(); });
  app.querySelectorAll("[data-filtro]").forEach(b => b.onclick = () => { U.filtro = b.dataset.filtro || null; render(); });
  app.querySelectorAll("[data-ver]").forEach(b => b.onclick = () => {
    const id = b.dataset.ver;
    if (!id) { U.filtro = b.dataset.vslot; U.tabEq = "bolsa"; return render(); }      // lugar vacío: muestra lo que hay para ponerse ahí
    U.ver = id; if (p.nuevos && p.nuevos.includes(id)) { p.nuevos = p.nuevos.filter(x => x !== id); Eco.guardar(u); }
    if (typeof Sonido !== "undefined") Sonido.sfx("clic"); render();
  });
  const cerrarVer = () => { U.ver = null; U.pick = null; render(); };
  on("heVerCerrar", cerrarVer);
  const fondoVer = byId("heVerFondo"); if (fondoVer) fondoVer.onclick = e => { if (e.target === fondoVer) cerrarVer(); };
  app.querySelectorAll("[data-quitar]").forEach(b => b.onclick = () => { U.ver = null; Heroes.equipar(u, b.dataset.quitar, null); });
  const repintar = () => { const y = byId("heVerFondo") && byId("heVerFondo").querySelector(".modal").scrollTop; render(); const m = byId("heVerFondo"); if (m && y) m.querySelector(".modal").scrollTop = y; };
  app.querySelectorAll("[data-hueco]").forEach(b => b.onclick = () => { const k = "g" + b.dataset.hueco; U.pick = U.pick && U.pick.k === k ? null : { id: U.ver, k }; repintar(); });
  app.querySelectorAll("[data-grabar]").forEach(b => b.onclick = () => { U.pick = U.pick && U.pick.k === "p" ? null : { id: U.ver, k: "p" }; repintar(); });
  app.querySelectorAll("[data-engarzar]").forEach(b => b.onclick = () => { U.pick = null; Heroes.engarzar(u, U.ver, +b.dataset.i, b.dataset.engarzar); });
  app.querySelectorAll("[data-sacargema]").forEach(b => b.onclick = () => { U.pick = null; Heroes.sacarGema(u, U.ver, +b.dataset.sacargema); });
  app.querySelectorAll("[data-pergamino]").forEach(b => b.onclick = () => { const G = HE.GRABADOS[b.dataset.pergamino]; if (!det.grab || confirm(`¿Reemplazar el grabado ${HE.GRABADOS[det.grab][0]} por ${G[0]}?`)) { U.pick = null; Heroes.grabar(u, U.ver, b.dataset.pergamino); } });
  on("heMejorar", () => { const c = Heroes.costoMejora(det); if (c.chance >= 1 || confirm(`¿Mejorar a +${c.n}? Tiene ${Math.round(c.chance * 100)}% de salir bien. Si falla perdés las monedas y los fragmentos, pero no el objeto.`)) Heroes.mejorar(u, U.ver); });
  on("heDesarmar", () => { if (confirm(`¿Desarmar ${det.nombre}? Te da ${Heroes.fragDe(det)} fragmentos${det.botin && det.gemas.some(Boolean) ? " y te devuelve las gemas" : ""}.`)) { const id = U.ver; U.ver = null; if (!Heroes.desarmar(u, id)) render(); } });
  on("heVender", () => { const it = det; if (!it) return; if (confirm(it.venta ? `¿Vender ${it.nombre} por ${it.venta} monedas?` : `¿Tirar ${it.nombre}? (no vale monedas)`)) { U.ver = null; if (!Heroes.vender(u, it.id)) render(); } });
  on("hePrestigio", () => { if (confirm(`¿Subir a prestigio ${p.pre + 1}? ${nombrePj} vuelve al nivel 1 y sus puntos de nivel se reinician. Te quedás con la evolución, el equipo y los puntos de prestigio, y ganás: ${HE.PRESTIGIO[p.pre].desc}.`)) Heroes.prestigiar(u); });
  app.querySelectorAll("[data-evo]").forEach(b => b.onclick = () => { const e = Heroes.evoDe(clase, b.dataset.evo); if (p.evo.length || confirm(`¿Evolucionar a ${e.nombre}? Si después te arrepentís, podés cambiar de camino desde acá.`)) Heroes.evolucionar(u, b.dataset.evo); });
  app.querySelectorAll("[data-slot]").forEach(b => b.onclick = () => { U.slot = U.slot === b.dataset.slot ? null : b.dataset.slot; render(); });
  app.querySelectorAll("[data-comprar]").forEach(b => b.onclick = () => { const it = Heroes.item(clase, b.dataset.comprar); if (confirm(`¿Comprar ${it.nombre} por ${it.precio} monedas?`)) Heroes.comprar(u, b.dataset.comprar); });
  app.querySelectorAll("[data-equipar]").forEach(b => b.onclick = () => { U.ver = null; Heroes.equipar(u, b.dataset.equipar, b.dataset.id || null); });
  app.querySelectorAll("[data-esc]").forEach(b => b.onclick = () => { S.arenaCfg = { ...cfg, esc: b.dataset.esc }; S.arenaEsc = b.dataset.esc; render(); });
  app.querySelectorAll("[data-modo]").forEach(b => b.onclick = () => { S.arenaCfg = { ...cfg, modo: b.dataset.modo }; render(); });
  app.querySelectorAll("[data-niv]").forEach(b => b.onclick = () => { S.arenaCfg = { ...cfg, nivel: b.dataset.niv }; render(); });
  ArenaPixi.cargar();
  on("arPixi", () => { store.set("arenaPixi", store.get("arenaPixi", true) === false); render(); });
  on("arJugar", () => Arena.empezarLocal(cfg.modo, cfg.nivel, cfg.esc));
  on("toEntrar", () => Torre.entrar());
  on("toComprar", () => { if (confirm(`¿Comprar una vida por ${Torre.precioVida(u)} monedas?`) && Torre.comprarVida(u)) render(); });
  on("toRank", () => { UI.tabRank = "torre"; go("ranking"); });
  on("arAmigos", () => { S.arenaEsc = cfg.esc; go("onCrear"); });
  on("volver", () => go("home"));
};
