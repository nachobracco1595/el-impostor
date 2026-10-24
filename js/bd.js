/* Base de datos local (localStorage) con perfiles, puntos, logros e historial.
   Todo pasa por el objeto BD: para usar una base de datos real (como Supabase)
   alcanza con reimplementar estas funciones. */
const BD_CLAVE = "impostor:bd";
const JUEGOS = { impostor: "El Impostor", liars: "Mesa del Mentiroso", casos: "Detectives", chinchon: "Chinchón", truco: "Truco", burako: "Burako", poker: "Póker", carrera: "Carrera Loca", naval: "Batalla naval", ajedrez: "Ajedrez", nave: "La Nave", arena: "Arena", bowling: "Bowling", arco: "Arco y flecha", circo: "Circo", preguntas: "Preguntas Locas" };

const NIVELES = [
  [0, "Novato"], [50, "Aprendiz"], [150, "Sospechoso"], [300, "Pícaro"], [500, "Detective"],
  [800, "Mentiroso profesional"], [1200, "Maestro del engaño"], [1800, "Cerebro criminal"], [2600, "Leyenda"]
];

const LOGROS = [
  { id: "primera", ic: "🎉", nombre: "Primera partida", desc: "Juega tu primera partida.", ok: u => total(u, "j") >= 1 },
  { id: "fiestero", ic: "🥳", nombre: "Fiestero", desc: "Juega 25 partidas.", ok: u => total(u, "j") >= 25 },
  { id: "lobo", ic: "🐺", nombre: "Lobo con piel de oveja", desc: "Gana 5 veces como impostor.", ok: u => u.stats.impostor.impG >= 5 },
  { id: "halcon", ic: "🦅", nombre: "Ojo de halcón", desc: "Gana 5 veces como inocente.", ok: u => u.stats.impostor.inoG >= 5 },
  { id: "mente", ic: "🔮", nombre: "Lectura de mentes", desc: "Te descubren como impostor, pero adivinas la palabra.", ok: u => u.stats.impostor.adivino >= 1 },
  { id: "bufon", ic: "🤡", nombre: "El último en reír", desc: "Gana como Bufón.", ok: u => u.stats.impostor.bufonG >= 1 },
  { id: "sorpresa", ic: "🎭", nombre: "Nadie me engaña", desc: "Descubre una ronda sorpresa.", ok: u => u.stats.impostor.sorpresa >= 1 },
  { id: "ultimo", ic: "🤠", nombre: "Último en pie", desc: "Gana una Mesa del Mentiroso.", ok: u => u.stats.liars.g >= 1 },
  { id: "vidas", ic: "🐈", nombre: "Siete vidas", desc: "Sobrevive a 10 gatillazos.", ok: u => u.stats.liars.clics >= 10 },
  { id: "detector", ic: "🚨", nombre: "Detector de mentiras", desc: "Atrapa a 10 mentirosos.", ok: u => u.stats.liars.aciertos >= 10 },
  { id: "cerrado", ic: "🔍", nombre: "Caso cerrado", desc: "Resuelve un caso.", ok: u => u.stats.casos.resueltos.length >= 1 },
  { id: "sherlock", ic: "🕵️", nombre: "Sherlock", desc: "Resuelve todos los casos.", ok: u => CASOS.every(c => u.stats.casos.resueltos.includes(c.id)) },
  { id: "garganta", ic: "🤫", nombre: "Garganta profunda", desc: "Gana como soplón.", ok: u => u.stats.casos.soplonG >= 1 },
  { id: "chinchon", ic: "🃏", nombre: "¡Chinchón!", desc: "Haz una escalera de siete del mismo palo.", ok: u => u.stats.chinchon.chinchones >= 1 },
  { id: "menos10", ic: "➖", nombre: "Menos diez", desc: "Corta con todas las cartas ligadas.", ok: u => u.stats.chinchon.menos10 >= 1 },
  { id: "velocista", ic: "🏁", nombre: "Velocista", desc: "Gana una Carrera Loca.", ok: u => u.stats.carrera.g >= 1 },
  { id: "rayo", ic: "⚡", nombre: "Rayo", desc: "Termina una Carrera Loca en menos de 45 segundos.", ok: u => u.stats.carrera.mejor > 0 && u.stats.carrera.mejor < 45 },
  { id: "tiburon", ic: "🦈", nombre: "Tiburón del póker", desc: "Gana un torneo de póker.", ok: u => u.stats.poker.g >= 1 },
  { id: "fullhouse", ic: "🃏", nombre: "Mano de lujo", desc: "Liga póker o escalera de color en el póker.", ok: u => (u.stats.poker.mejorCat ?? -1) >= 7 },
  { id: "burakero", ic: "🀄", nombre: "Burakero", desc: "Gana 5 partidas de Burako.", ok: u => u.stats.burako.g >= 5 },
  { id: "canastera", ic: "🧺", nombre: "Canasta limpia", desc: "Arma 3 canastas limpias en el Burako.", ok: u => u.stats.burako.limpias >= 3 },
  { id: "truquero", ic: "🗡️", nombre: "Truquero", desc: "Gana 10 partidas de truco.", ok: u => u.stats.truco.g >= 10 },
  { id: "vale4", ic: "4️⃣", nombre: "Vale cuatro", desc: "Gana una mano de truco a vale cuatro.", ok: u => u.stats.truco.vale4 >= 1 },
  { id: "e33", ic: "🎯", nombre: "Treinta y tres", desc: "Ten 33 de envido (7 y 6 del mismo palo).", ok: u => u.stats.truco.e33 >= 1 },
  { id: "almirante", ic: "⚓", nombre: "Almirante", desc: "Gana una batalla naval.", ok: u => u.stats.naval.g >= 1 },
  { id: "intacta", ic: "🚢", nombre: "Flota intacta", desc: "Gana una batalla con 3 barcos sin un rasguño.", ok: u => u.stats.naval.intactaG >= 1 },
  { id: "mate", ic: "♚", nombre: "Jaque mate", desc: "Gana una partida de ajedrez por mate.", ok: u => u.stats.ajedrez.mates >= 1 },
  { id: "maestro", ic: "🧠", nombre: "Gran maestro", desc: "Gánale a la compu difícil al ajedrez.", ok: u => u.stats.ajedrez.dificilG >= 1 },
  { id: "abordo", ic: "🚀", nombre: "A bordo", desc: "Gana una partida de La Nave.", ok: u => u.stats.nave.g >= 1 },
  { id: "cazador", ic: "🔪", nombre: "Cazador espacial", desc: "Elimina a 3 en una sola partida de La Nave.", ok: u => u.stats.nave.triple >= 1 },
  { id: "gladiador", ic: "🛡️", nombre: "Gladiador", desc: "Gana 10 peleas en la Arena.", ok: u => u.stats.arena.g >= 10 },
  { id: "elo1500", ic: "🏟️", nombre: "Leyenda de la Arena", desc: "Llega a 1500 de ELO en la Arena.", ok: u => u.stats.arena.mejorElo >= 1500 },
  { id: "pleno", ic: "🎡", nombre: "¡Pleno!", desc: "Acierta el número justo en la ruleta.", ok: u => (u.stats.timba || {}).plenos >= 1 },
  { id: "jackpot", ic: "🎰", nombre: "Jackpot", desc: "Gana el pozo acumulado o un premio de 100 veces la apuesta en una tragamonedas.", ok: u => (u.stats.timba || {}).jackpots >= 1 },
  { id: "bingo", ic: "🎱", nombre: "¡Bingo!", desc: "Canta bingo con un cartón comprado.", ok: u => (u.stats.timba || {}).bingos >= 1 },
  { id: "blackjack", ic: "♠️", nombre: "¡Blackjack!", desc: "Saca 21 de entrada apostando monedas.", ok: u => (u.stats.timba || {}).blackjacks >= 1 },
  { id: "banca", ic: "🎩", nombre: "Le gané a la banca", desc: "Gana 25 manos de blackjack con monedas.", ok: u => (u.stats.timba || {}).bjGanadas >= 25 },
  { id: "racha3", ic: "🔥", nombre: "En racha", desc: "Gana 3 partidas seguidas.", ok: u => u.mejorRacha >= 3 },
  { id: "racha5", ic: "⚡", nombre: "Imparable", desc: "Gana 5 partidas seguidas.", ok: u => u.mejorRacha >= 5 },
  { id: "mil", ic: "💯", nombre: "Mil puntos", desc: "Llega a 1000 puntos.", ok: u => u.puntos >= 1000 },
  { id: "chuza", ic: "🎳", nombre: "¡Chuza!", desc: "Haz tu primer strike en el bowling.", ok: u => u.stats.bowling.strikes >= 1 },
  { id: "turkey", ic: "🦃", nombre: "Turkey", desc: "Haz 3 strikes seguidos en el bowling.", ok: u => u.stats.bowling.turkeys >= 1 },
  { id: "bolo200", ic: "🏅", nombre: "Bolo de oro", desc: "Haz 200 puntos en una partida de bowling de 10 cuadros.", ok: u => u.stats.bowling.mejor >= 200 },
  { id: "robin", ic: "🏹", nombre: "Robin Hood", desc: "Clava 10 flechas en el centro (X).", ok: u => u.stats.arco.x >= 10 },
  { id: "halcon", ic: "🦅", nombre: "Ojo de halcón", desc: "Haz 100 puntos o más en un torneo de arco de 4 rondas.", ok: u => u.stats.arco.mejor >= 100 },
  { id: "domador", ic: "🦁", nombre: "Domador", desc: "Termina las tres etapas del circo.", ok: u => u.stats.circo.completo >= 1 },
  { id: "sabelotodo", ic: "🤓", nombre: "Sabelotodo", desc: "Responde bien 50 preguntas locas.", ok: u => u.stats.preguntas.correctas >= 50 },
  { id: "coleccion", ic: "👑", nombre: "Coleccionista", desc: "Gana Preguntas Locas con los 6 personajes.", ok: u => u.stats.preguntas.completas >= 1 },
  { id: "estrella", ic: "🎪", nombre: "Estrella del circo", desc: "Haz 10.000 puntos en una función de circo.", ok: u => u.stats.circo.mejor >= 10000 }
];

function total(u, k) { return Object.keys(JUEGOS).reduce((s, j) => s + (u.stats[j][k] || 0), 0); }

function statsVacias() {
  return {
    impostor: { j: 0, g: 0, p: 0, imp: 0, impG: 0, inoG: 0, adivino: 0, bufonG: 0, sorpresa: 0 },
    liars: { j: 0, g: 0, p: 0, clics: 0, aciertos: 0, diablos: 0, angeles: 0 },
    casos: { j: 0, g: 0, p: 0, resueltos: [], soplonG: 0 },
    chinchon: { j: 0, g: 0, p: 0, chinchones: 0, menos10: 0, cortes: 0 },
    truco: { j: 0, g: 0, p: 0, envidos: 0, vale4: 0, e33: 0 },
    burako: { j: 0, g: 0, p: 0, limpias: 0, cierres: 0 },
    poker: { j: 0, g: 0, p: 0, manos: 0, mejorCat: -1, podios: 0 },
    carrera: { j: 0, g: 0, p: 0, podios: 0, mejor: 0, caidas: 0 },
    naval: { j: 0, g: 0, p: 0, hundidos: 0, intactaG: 0 },
    ajedrez: { j: 0, g: 0, p: 0, tablas: 0, mates: 0, dificilG: 0 },
    nave: { j: 0, g: 0, p: 0, kills: 0, tareas: 0, impG: 0, triple: 0 },
    arena: { j: 0, g: 0, p: 0, elo: 1000, mejorElo: 1000, kills: 0 },
    bowling: { j: 0, g: 0, p: 0, mejor: 0, strikes: 0, spares: 0, turkeys: 0 },
    arco: { j: 0, g: 0, p: 0, mejor: 0, x: 0, dieces: 0 },
    circo: { j: 0, g: 0, p: 0, mejor: 0, completo: 0, etapas: 0 },
    preguntas: { j: 0, g: 0, p: 0, correctas: 0, personajes: 0, coronas: 0, completas: 0 },
    // El casino no suma partidas ni puntos: solo lleva la cuenta
    timba: { j: 0, g: 0, p: 0, jugadas: 0, apostado: 0, ganado: 0, mayor: 0, plenos: 0, jackpots: 0, lineas: 0, bingos: 0, blackjacks: 0, bjGanadas: 0 }
  };
}

const BD = {
  datos: null,

  cargar() {
    if (this.datos) return this.datos;
    let d = null;
    try { d = JSON.parse(localStorage.getItem(BD_CLAVE)); } catch {}
    this.datos = d && d.usuarios ? d : { v: 1, usuarios: {}, sesion: null };
    // Completa perfiles viejos con campos nuevos
    Object.values(this.datos.usuarios).forEach(u => {
      const base = statsVacias();
      for (const j in base) u.stats[j] = Object.assign(base[j], u.stats[j] || {});
    });
    return this.datos;
  },
  guardar() { try { localStorage.setItem(BD_CLAVE, JSON.stringify(this.datos)); } catch {} },

  /* Perfiles locales y, si hay sesión en la nube, el perfil de la nube. Los perfiles de nube
     de otras sesiones quedan en caché pero no se muestran ni suman puntos. */
  usuarios() { const d = this.cargar(); return Object.values(d.usuarios).filter(u => !u.nube || u.id === d.sesion); },
  locales() { return Object.values(this.cargar().usuarios).filter(u => !u.nube); },
  usuario(id) { return this.cargar().usuarios[id] || null; },
  porNombre(nombre) { const n = String(nombre).trim().toLowerCase(); return this.usuarios().find(u => u.nombre.toLowerCase() === n) || null; },
  sesion() { const u = this.usuario(this.cargar().sesion); if (u && typeof Eco !== "undefined") Eco.completar(u); return u; },

  async hash(pin, id) {
    const txt = `${id}:${pin}:el-impostor`;
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    } catch {
      let h = 5381; for (const c of txt) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
      return "s" + h.toString(16);
    }
  },

  async crear(nombre, pin, look) {
    nombre = String(nombre).trim().slice(0, 16);
    if (!nombre) throw new Error("Escribe un nombre.");
    if (this.porNombre(nombre)) throw new Error("Ya existe un perfil con ese nombre en este teléfono.");
    if (!/^\d{4}$/.test(pin)) throw new Error("El PIN tiene que tener 4 números.");
    const id = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const u = { id, nombre, look, pin: await this.hash(pin, id), creado: Date.now(), puntos: 0, racha: 0, mejorRacha: 0, stats: statsVacias(), logros: {}, historial: [], contadas: [] };
    this.cargar().usuarios[id] = u;
    this.datos.sesion = id;
    this.guardar();
    return u;
  },

  /* Perfil de la nube: el id es el del usuario de Supabase y no tiene PIN */
  crearNube(uid, nombre, look) {
    nombre = String(nombre).trim().slice(0, 16);
    if (!nombre) throw new Error("Escribe un nombre.");
    const u = { id: uid, nube: true, nombre, look, pin: null, creado: Date.now(), puntos: 0, racha: 0, mejorRacha: 0, stats: statsVacias(), logros: {}, historial: [], contadas: [], pendiente: true };
    this.cargar().usuarios[uid] = u;
    this.datos.sesion = uid;
    this.guardar();
    return u;
  },

  /* Trae el perfil de la nube. Si la copia local tiene más partidas (jugó sin conexión), gana la local y se sube. */
  adoptarNube(uid, data) {
    const local = this.cargar().usuarios[uid];
    const nube = Object.assign({ puntos: 0, racha: 0, mejorRacha: 0, logros: {}, historial: [], contadas: [] }, data, { id: uid, nube: true, pin: null });
    const base = statsVacias();
    nube.stats = nube.stats || {};
    for (const j in base) nube.stats[j] = Object.assign(base[j], nube.stats[j] || {});
    let u = nube;
    if (local && local.nube && (total(local, "j") > total(nube, "j") || (local.monedas || 0) !== (nube.monedas || 0) && total(local, "j") === total(nube, "j") && (local.diario || {}).ultimo > ((nube.diario || {}).ultimo || ""))) {
      u = local; u.pendiente = true;
      // El nombre (se cambia en el servidor) y el código siempre salen de la nube
      u.nombre = nube.nombre; u.tag = nube.tag;
    }
    else u.pendiente = false;
    this.datos.usuarios[uid] = u;
    this.datos.sesion = uid;
    this.guardar();
    return u;
  },

  async entrar(id, pin) {
    const u = this.usuario(id);
    if (!u || (await this.hash(pin, id)) !== u.pin) throw new Error("PIN incorrecto.");
    this.datos.sesion = id; this.guardar();
    return u;
  },
  salir() { this.cargar().sesion = null; this.guardar(); },
  editarLook(id, look) { const u = this.usuario(id); if (u) { u.look = Object.assign({ marco: "", titulo: "", mascota: "" }, look); this.guardar(); } },
  borrar(id) { delete this.cargar().usuarios[id]; if (this.datos.sesion === id) this.datos.sesion = null; this.guardar(); },

  /* Registra el resultado de una partida. Devuelve {puntos, detalle, gano, logros} o null si ya se contó. */
  registrar(uid, res) {
    const u = this.usuario(uid);
    if (!u || !res) return null;
    const clave = res.id + ":" + uid;
    if (u.contadas.includes(clave)) return null;
    const calc = Puntos.calcular(res);
    const st = u.stats[res.juego];
    // Jugando solo no se gana ni se pierde: suma puntos, pero no cuenta en ganadas/jugadas ni corta la racha
    if (!calc.solo) st.j++; st.p += calc.puntos; if (calc.gano) st.g++;
    if (res.juego === "impostor") {
      if (res.rol === "impostor") st.imp++;
      if (calc.gano && res.rol === "impostor") st.impG++;
      if (calc.gano && (res.rol === "civil" || res.rol === "infiltrado")) st.inoG++;
      if (res.winner === "imp-guess" && res.rol === "impostor") st.adivino++;
      if (res.winner === "bufon" && res.rol === "bufon") st.bufonG++;
      if (/-hit$/.test(res.winner)) st.sorpresa++;
    } else if (res.juego === "liars") {
      st.clics += res.clics | 0; st.aciertos += res.aciertos | 0; st.diablos = (st.diablos | 0) + (res.diablos | 0); st.angeles = (st.angeles | 0) + (res.angeles | 0);
    } else if (res.juego === "chinchon") {
      st.chinchones += res.chinchon ? 1 : 0; st.menos10 += res.menos10; st.cortes += res.cortes;
    } else if (res.juego === "carrera") {
      if (res.puesto <= 3) st.podios++; if (res.llego && res.tiempo) st.mejor = st.mejor ? Math.min(st.mejor, res.tiempo) : res.tiempo; st.caidas += res.caidas | 0;
    } else if (res.juego === "poker") {
      st.manos += res.manos | 0; st.mejorCat = Math.max(st.mejorCat ?? -1, res.mejorCat ?? -1); if (res.puesto <= 3 && res.n > 3) st.podios++;
    } else if (res.juego === "burako") {
      st.limpias += res.limpias | 0; st.cierres += res.cierres | 0;
    } else if (res.juego === "truco") {
      st.envidos += res.envidos | 0; st.vale4 += res.vale4 | 0; st.e33 += res.e33 | 0;
    } else if (res.juego === "naval") {
      st.hundidos += res.hundidos; if (calc.gano && res.intactos >= 3) st.intactaG++;
    } else if (res.juego === "nave") {
      st.kills += res.kills; st.tareas += res.tareas; if (calc.gano && res.imp) st.impG++; if (res.kills >= 3) st.triple++;
    } else if (res.juego === "ajedrez") {
      if (res.tablas) st.tablas++; if (res.mate) st.mates++; if (calc.gano && res.nivel === "dificil") st.dificilG++;
    } else if (res.juego === "arena") {
      st.kills += res.kills | 0;
      if (!res.vsCompu) st.elo = Math.max(0, (st.elo || 1000) + Math.max(-60, Math.min(60, res.dElo | 0)));
      st.mejorElo = Math.max(st.mejorElo || 1000, st.elo);
      if (typeof Heroes !== "undefined" && res.clase) Heroes.ganarXp(u, res.clase, res.xp | 0);
    } else if (res.juego === "bowling") {
      st.strikes += res.strikes | 0; st.spares += res.spares | 0; if (res.turkey) st.turkeys++; if (res.cuadros === 10) st.mejor = Math.max(st.mejor || 0, res.total | 0);
    } else if (res.juego === "arco") {
      st.x += res.centros | 0; st.dieces += res.dieces | 0; if (res.max === 120) st.mejor = Math.max(st.mejor || 0, res.total | 0);
    } else if (res.juego === "preguntas") {
      st.correctas += res.correctas | 0; st.personajes += res.personajes | 0; st.coronas += res.coronas | 0; if (calc.gano && res.personajes >= 6) st.completas++;
    } else if (res.juego === "circo") {
      st.etapas += res.etapas | 0; if (res.completo) st.completo++; st.mejor = Math.max(st.mejor || 0, res.total | 0);
    } else if (res.juego === "casos") {
      if (res.resuelto && !res.soplon && !st.resueltos.includes(res.casoId)) st.resueltos.push(res.casoId);
      if (res.soplon && calc.gano) st.soplonG++;
    }
    u.puntos += calc.puntos;
    // Monedas: una cada 4 puntos (mínimo 2 por partida)
    const monedas = res.juego === "arena" ? Math.max(0, Math.min(120, res.monedas | 0)) : Math.max(2, Math.round(calc.puntos / 4));
    if (typeof Eco !== "undefined") { Eco.completar(u); u.monedas += monedas; Eco.sumarPartida(u); }
    if (!calc.solo) u.racha = calc.gano ? u.racha + 1 : 0;
    u.mejorRacha = Math.max(u.mejorRacha, u.racha);
    u.historial.unshift({ f: Date.now(), juego: res.juego, gano: calc.gano, solo: calc.solo || undefined, puntos: calc.puntos, txt: calc.resumen });
    u.historial = u.historial.slice(0, 40);
    u.contadas = [clave, ...u.contadas].slice(0, 100);
    const nuevos = LOGROS.filter(l => !u.logros[l.id] && l.ok(u));
    nuevos.forEach(l => u.logros[l.id] = Date.now());
    this.guardar();
    if (u.nube && typeof Nube !== "undefined") { Nube.subir(u); Nube.actividad("partida", res.juego, calc.puntos, monedas); }
    return { ...calc, monedas, logros: nuevos, usuario: u };
  },

  /* Exporta solo los perfiles locales: los de la nube ya están guardados allá */
  exportar() {
    const usuarios = Object.fromEntries(this.locales().map(u => [u.id, u]));
    return JSON.stringify({ v: 1, usuarios, sesion: null, exportado: new Date().toISOString() }, null, 2);
  },

  /* Suma perfiles de otro archivo. Si un perfil ya existe, se queda la versión con más partidas. */
  importar(texto) {
    const d = JSON.parse(texto);
    if (!d || typeof d.usuarios !== "object") throw new Error("El archivo no es una base de datos de Mesa Loca.");
    let nuevos = 0, actualizados = 0;
    for (const u of Object.values(d.usuarios)) {
      if (!u || !u.id || !u.nombre || !u.stats || u.nube) continue;
      const base = statsVacias();
      for (const j in base) u.stats[j] = Object.assign(base[j], u.stats[j] || {});
      const ya = this.usuario(u.id);
      if (!ya) { this.datos.usuarios[u.id] = u; nuevos++; }
      else if (total(u, "j") > total(ya, "j")) { this.datos.usuarios[u.id] = u; actualizados++; }
    }
    this.guardar();
    return { nuevos, actualizados };
  },

  ranking(juego) {
    if (juego === "torre") {
      // Torre: el mejor piso de la temporada actual
      const key = Torre.temporada().key;
      return this.usuarios().map(u => { const t = (u.diario || {}).torre; return t && t.key === key && t.mejor > 0 ? { u, puntos: t.mejor, base: t.base, j: 0, g: 0 } : null; }).filter(Boolean).sort((a, b) => b.puntos - a.puntos);
    }
    return this.usuarios().map(u => {
      const s = juego ? u.stats[juego] : null;
      return { u, puntos: s ? (juego === "arena" ? s.elo : s.p) : u.puntos, j: s ? s.j : total(u, "j"), g: s ? s.g : total(u, "g") };
    }).sort((a, b) => b.puntos - a.puntos || b.g - a.g);
  }
};

function nivelDe(puntos) {
  let i = 0;
  while (i + 1 < NIVELES.length && puntos >= NIVELES[i + 1][0]) i++;
  const [desde, titulo] = NIVELES[i], hasta = NIVELES[i + 1] ? NIVELES[i + 1][0] : null;
  return { n: i + 1, titulo, desde, hasta, pct: hasta ? Math.round(((puntos - desde) / (hasta - desde)) * 100) : 100 };
}

/* ---------- Puntos ---------- */
const Puntos = {
  REGLAS: [
    ["Participar en cualquier partida", "+5"],
    ["Bowling: cada strike / cada spare", "+2 / +1"],
    ["Bowling: 150 o más / 200 o más", "+5 / +10"],
    ["Bowling, Arco o Circo: ganar (persona / bots)", "+25 / +12"],
    ["Arco: cada flecha al centro (X)", "+2"],
    ["Arco: 80% del máximo o más", "+8"],
    ["Circo: cada etapa superada / función completa", "+4 / +10"],
    ["Circo: cada 500 de puntaje en la función (desde 1000)", "+1 (hasta +20)"],
    ["Bowling, Arco, Circo o Preguntas jugando solo: no se gana ni se pierde, solo suma lo que hiciste", ""],
    ["Preguntas Locas: cada respuesta correcta / cada personaje", "+1 / +2"],
    ["Impostor: ganar como inocente", "+10"],
    ["Impostor: ganar como impostor", "+25"],
    ["Impostor: adivinar la palabra al ser descubierto", "+10 extra"],
    ["Impostor: ganar como Cómplice", "+20"],
    ["Impostor: ganar como Bufón", "+30"],
    ["Impostor: descubrir una ronda sorpresa", "+15"],
    ["Mentiroso: atrapar a un mentiroso", "+5 cada vez"],
    ["Mentiroso: sobrevivir a un gatillazo", "+3 cada vez"],
    ["Mentiroso: ser el último en pie", "+30"],
    ["Detectives: resolver el caso", "+10 por cada 🔍 de dificultad, +10"],
    ["Detectives: votar al culpable", "+10"],
    ["Detectives: ganar como soplón", "+35"],
    ["Chinchón: ganar la partida", "+20, +5 por rival"],
    ["Carrera Loca: llegar 1º (con personas / contra bots)", "+25 / +12"],
    ["Carrera Loca: llegar 2º / 3º", "+10 / +5"],
    ["Póker: ganar el torneo (con personas / contra bots)", "+30 / +15"],
    ["Póker: segundo puesto (mesa de 4 o más)", "+10"],
    ["Burako: ganar la partida (contra personas / la compu)", "+25 / +12"],
    ["Burako: canasta limpia / cerrar", "+4 / +5 cada vez"],
    ["Truco: ganar la partida (contra personas / la compu)", "+25 / +12"],
    ["Truco: ganar un envido querido", "+2 cada uno"],
    ["Truco: ganar una mano a vale cuatro", "+5"],
    ["Arena: ganar la pelea", "+25 (contra la compu +10)"],
    ["Arena: cada eliminación", "+5"],
    ["Chinchón: hacer chinchón", "+40"],
    ["Chinchón: cortar / cortar con −10", "+3 / +8 cada vez"],
    ["Batalla naval: hundir un barco", "+2 cada uno"],
    ["Batalla naval: ganar (contra una persona / la compu)", "+25 / +15"],
    ["Batalla naval: barcos intactos al ganar", "+3 cada uno"],
    ["Ajedrez: ganar (persona / compu difícil / compu fácil)", "+30 / +25 / +10"],
    ["Ajedrez: tablas", "+10"],
    ["La Nave: cada tarea / cada eliminación", "+2 / +5"],
    ["La Nave: ganar como tripulación / impostor", "+15 / +30 (la mitad en práctica)"],
    ["Ajedrez: ganar por jaque mate", "+5 extra"]
  ],

  calcular(r) {
    const d = [["Participar", 5]];
    let gano = false;
    if (r.juego === "impostor") {
      const ladoImp = r.rol === "impostor" || r.rol === "complice";
      const ganaImp = ["imp", "imp-guess", "claim-miss", "all-miss"].includes(r.winner);
      if (/-hit$/.test(r.winner)) { gano = true; d.push(["Descubrieron la ronda sorpresa", 15]); }
      else if (r.winner === "bufon") { if (r.rol === "bufon") { gano = true; d.push(["Ganaste como Bufón", 30]); } }
      else if (r.winner === "civ" && !ladoImp && r.rol !== "bufon") { gano = true; d.push(["Ganaron los inocentes", 10]); }
      else if (ganaImp && ladoImp) {
        gano = true;
        d.push(r.rol === "complice" ? ["Ganaste como Cómplice", 20] : ["Ganaste como impostor", 25]);
        if (r.winner === "imp-guess" && r.rol === "impostor") d.push(["Adivinaste la palabra", 10]);
      }
    } else if (r.juego === "liars") {
      if (r.aciertos) d.push([`Atrapaste ${r.aciertos} mentiroso${r.aciertos > 1 ? "s" : ""}`, 5 * r.aciertos]);
      if (r.clics) d.push([`Sobreviviste ${r.clics} gatillazo${r.clics > 1 ? "s" : ""}`, 3 * r.clics]);
      if (r.diablos) d.push([`Tu carta del Diablo hizo gatillar a todos${r.diablos > 1 ? ` (${r.diablos})` : ""}`, 8 * r.diablos]);
      if (r.angeles) d.push([`Te salvó el Ángel${r.angeles > 1 ? ` (${r.angeles})` : ""}`, 4 * r.angeles]);
      if (r.gano) { gano = true; d.push(["Último en pie", 30]); }
    } else if (r.juego === "chinchon") {
      if (r.chinchon) { gano = true; d.push(["¡Chinchón!", 40]); }
      else if (r.gano) { gano = true; d.push([`Ganaste contra ${r.rivales} rival${r.rivales > 1 ? "es" : ""}`, 20 + 5 * r.rivales]); }
      const cortesComunes = r.cortes - r.menos10;
      if (cortesComunes > 0) d.push([`Cortaste ${cortesComunes} ${cortesComunes > 1 ? "veces" : "vez"}`, 3 * cortesComunes]);
      if (r.menos10) d.push([`Cortaste con −10 (${r.menos10})`, 8 * r.menos10]);
    } else if (r.juego === "carrera") {
      if (r.gano) { gano = true; d.push([r.vsCompu ? "Le ganaste a los bots" : "¡Llegaste primero!", r.vsCompu ? 12 : 25]); }
      else if (r.puesto === 2) d.push(["Segundo puesto", 10]); else if (r.puesto === 3) d.push(["Tercer puesto", 5]);
    } else if (r.juego === "poker") {
      if (r.manos) d.push([`Ganaste ${r.manos} mano${r.manos > 1 ? "s" : ""}`, Math.min(20, r.manos)]);
      if (r.gano) { gano = true; d.push([r.vsCompu ? "Ganaste el torneo contra los bots" : "Ganaste el torneo", r.vsCompu ? 15 : 30]); }
      else if (r.puesto === 2 && r.n >= 4) d.push(["Segundo puesto", 10]);
    } else if (r.juego === "burako") {
      if (r.limpias) d.push([`${r.limpias} canasta${r.limpias > 1 ? "s" : ""} limpia${r.limpias > 1 ? "s" : ""}`, 4 * Math.min(10, r.limpias)]);
      if (r.cierres) d.push([`Cerraron ${r.cierres} ${r.cierres > 1 ? "veces" : "vez"}`, 5 * Math.min(10, r.cierres)]);
      if (r.gano) { gano = true; d.push([r.vsCompu ? "Le ganaron a la compu" : "Ganaron la partida", r.vsCompu ? 12 : 25]); }
    } else if (r.juego === "truco") {
      if (r.envidos) d.push([`Ganaste ${r.envidos} envido${r.envidos > 1 ? "s" : ""}`, 2 * Math.min(10, r.envidos)]);
      if (r.vale4) d.push(["Ganaste un vale cuatro", 5 * Math.min(3, r.vale4)]);
      if (r.gano) { gano = true; d.push([r.vsCompu ? "Le ganaste a la compu" : "Ganaste la partida", r.vsCompu ? 12 : 25]); }
    } else if (r.juego === "naval") {
      if (r.hundidos) d.push([`Hundiste ${r.hundidos} barco${r.hundidos > 1 ? "s" : ""}`, 2 * r.hundidos]);
      if (r.gano) { gano = true; d.push([r.vsCompu ? "Le ganaste a la compu" : "Ganaste la batalla", r.vsCompu ? 15 : 25]); if (r.intactos) d.push([`${r.intactos} barco${r.intactos > 1 ? "s" : ""} intacto${r.intactos > 1 ? "s" : ""}`, 3 * r.intactos]); }
    } else if (r.juego === "nave") {
      if (r.tareas) d.push([`Hiciste ${r.tareas} tarea${r.tareas > 1 ? "s" : ""}`, 2 * r.tareas]);
      if (r.kills) d.push([`Eliminaste a ${r.kills}`, 5 * r.kills]);
      if (r.gano) { gano = true; d.push([r.imp ? "Ganaste como impostor" : "Ganó la tripulación", r.imp ? (r.vsCompus ? 15 : 30) : (r.vsCompus ? 10 : 15)]); }
    } else if (r.juego === "ajedrez") {
      if (r.gano) { gano = true; d.push([r.vsCompu ? (r.nivel === "dificil" ? "Le ganaste a la compu difícil" : "Le ganaste a la compu fácil") : "Ganaste la partida", r.vsCompu ? (r.nivel === "dificil" ? 25 : 10) : 30]); if (r.mate) d.push(["Por jaque mate", 5]); }
      else if (r.tablas) d.push(["Tablas", 10]);
    } else if (r.juego === "arena") {
      if (r.kills) d.push([`Eliminaste a ${r.kills}`, 5 * r.kills]);
      if (r.gano) { gano = true; d.push([r.vsCompu ? "Ganaste la pelea contra la compu" : "Ganaste la pelea", r.vsCompu ? 10 : 25]); }
      else if (r.lugar === 2 && r.n > 2) d.push(["Segundo puesto", 8]);
    } else if (r.juego === "bowling") {
      if (r.strikes) d.push([`${r.strikes} strike${r.strikes > 1 ? "s" : ""}`, 2 * Math.min(12, r.strikes)]);
      if (r.spares) d.push([`${r.spares} spare${r.spares > 1 ? "s" : ""}`, Math.min(10, r.spares)]);
      const t = r.cuadros === 10 ? r.total : r.total * 2;
      if (t >= 200) d.push(["Más de 200 puntos", 10]); else if (t >= 150) d.push(["Más de 150 puntos", 5]);
      if (r.gano) { gano = true; d.push([r.vsCompu ? "Le ganaste a los bots" : "Ganaste la partida", r.vsCompu ? 12 : 25]); }
    } else if (r.juego === "arco") {
      if (r.centros) d.push([`${r.centros} flecha${r.centros > 1 ? "s" : ""} al centro`, 2 * Math.min(12, r.centros)]);
      if (r.max && r.total >= r.max * 0.8) d.push(["Más del 80% del máximo", 8]);
      if (r.gano) { gano = true; d.push([r.vsCompu ? "Le ganaste a los bots" : "Ganaste el torneo", r.vsCompu ? 12 : 25]); }
    } else if (r.juego === "preguntas") {
      if (r.correctas) d.push([`${r.correctas} respuesta${r.correctas > 1 ? "s" : ""} correcta${r.correctas > 1 ? "s" : ""}`, Math.min(20, r.correctas)]);
      if (r.personajes) d.push([`${r.personajes} personaje${r.personajes > 1 ? "s" : ""}`, 2 * r.personajes]);
      if (r.gano) { gano = true; d.push([r.vsCompu ? "Le ganaste a los bots" : "Ganaste la partida", r.vsCompu ? 12 : 25]); }
    } else if (r.juego === "circo") {
      if (r.etapas) d.push([`${r.etapas} etapa${r.etapas > 1 ? "s" : ""} superada${r.etapas > 1 ? "s" : ""}`, 4 * r.etapas]);
      if (r.total >= 1000) d.push([`Puntaje de la función (${r.total})`, Math.min(20, Math.floor(r.total / 500))]);
      if (r.completo) d.push(["¡Función completa!", 10]);
      if (r.gano) { gano = true; d.push([r.vsCompu ? "Le ganaste a los bots" : "La estrella del circo", r.vsCompu ? 12 : 25]); }
    } else if (r.juego === "casos") {
      if (r.soplon) { if (!r.resuelto) { gano = true; d.push(["Ganaste como soplón", 35]); } }
      else {
        if (r.resuelto) { gano = true; d.push([`Caso resuelto (${"🔍".repeat(r.dificultad)})`, 10 + 10 * r.dificultad]); }
        if (r.votoCorrecto) d.push(["Votaste al culpable", 10]);
      }
    }
    const puntos = d.reduce((s, x) => s + x[1], 0), solo = r.n === 1 && ["bowling", "arco", "circo", "preguntas"].includes(r.juego);
    return { puntos, gano: gano && !solo, solo, detalle: d, resumen: `${JUEGOS[r.juego]} · ${solo ? "jugó solo" : gano ? "ganó" : "perdió"}` };
  }
};
