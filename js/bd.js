/* Base de datos local (localStorage) con perfiles, puntos, logros e historial.
   Todo pasa por el objeto BD: para usar una base de datos real (Firebase, Supabase…)
   alcanza con reimplementar estas funciones. */
const BD_CLAVE = "impostor:bd";
const JUEGOS = { impostor: "El Impostor", liars: "Mesa del Mentiroso", casos: "Detectives" };

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
  { id: "racha3", ic: "🔥", nombre: "En racha", desc: "Gana 3 partidas seguidas.", ok: u => u.mejorRacha >= 3 },
  { id: "racha5", ic: "⚡", nombre: "Imparable", desc: "Gana 5 partidas seguidas.", ok: u => u.mejorRacha >= 5 },
  { id: "mil", ic: "💯", nombre: "Mil puntos", desc: "Llega a 1000 puntos.", ok: u => u.puntos >= 1000 }
];

function total(u, k) { return Object.keys(JUEGOS).reduce((s, j) => s + (u.stats[j][k] || 0), 0); }

function statsVacias() {
  return {
    impostor: { j: 0, g: 0, p: 0, imp: 0, impG: 0, inoG: 0, adivino: 0, bufonG: 0, sorpresa: 0 },
    liars: { j: 0, g: 0, p: 0, clics: 0, aciertos: 0 },
    casos: { j: 0, g: 0, p: 0, resueltos: [], soplonG: 0 }
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

  /* Perfiles locales y, si hay sesión de Google, el perfil de la nube. Los perfiles de nube
     de otras sesiones quedan en caché pero no se muestran ni suman puntos. */
  usuarios() { const d = this.cargar(); return Object.values(d.usuarios).filter(u => !u.nube || u.id === d.sesion); },
  locales() { return Object.values(this.cargar().usuarios).filter(u => !u.nube); },
  usuario(id) { return this.cargar().usuarios[id] || null; },
  porNombre(nombre) { const n = String(nombre).trim().toLowerCase(); return this.usuarios().find(u => u.nombre.toLowerCase() === n) || null; },
  sesion() { return this.usuario(this.cargar().sesion); },

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

  /* Perfil de la nube (Google): el id es el uid de Firebase y no tiene PIN */
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
    if (local && local.nube && total(local, "j") > total(nube, "j")) { u = local; u.pendiente = true; }
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
  editarLook(id, look) { const u = this.usuario(id); if (u) { u.look = look; this.guardar(); } },
  borrar(id) { delete this.cargar().usuarios[id]; if (this.datos.sesion === id) this.datos.sesion = null; this.guardar(); },

  /* Registra el resultado de una partida. Devuelve {puntos, detalle, gano, logros} o null si ya se contó. */
  registrar(uid, res) {
    const u = this.usuario(uid);
    if (!u || !res) return null;
    const clave = res.id + ":" + uid;
    if (u.contadas.includes(clave)) return null;
    const calc = Puntos.calcular(res);
    const st = u.stats[res.juego];
    st.j++; st.p += calc.puntos; if (calc.gano) st.g++;
    if (res.juego === "impostor") {
      if (res.rol === "impostor") st.imp++;
      if (calc.gano && res.rol === "impostor") st.impG++;
      if (calc.gano && (res.rol === "civil" || res.rol === "infiltrado")) st.inoG++;
      if (res.winner === "imp-guess" && res.rol === "impostor") st.adivino++;
      if (res.winner === "bufon" && res.rol === "bufon") st.bufonG++;
      if (/-hit$/.test(res.winner)) st.sorpresa++;
    } else if (res.juego === "liars") {
      st.clics += res.clics; st.aciertos += res.aciertos;
    } else if (res.juego === "casos") {
      if (res.resuelto && !res.soplon && !st.resueltos.includes(res.casoId)) st.resueltos.push(res.casoId);
      if (res.soplon && calc.gano) st.soplonG++;
    }
    u.puntos += calc.puntos;
    u.racha = calc.gano ? u.racha + 1 : 0;
    u.mejorRacha = Math.max(u.mejorRacha, u.racha);
    u.historial.unshift({ f: Date.now(), juego: res.juego, gano: calc.gano, puntos: calc.puntos, txt: calc.resumen });
    u.historial = u.historial.slice(0, 40);
    u.contadas = [clave, ...u.contadas].slice(0, 100);
    const nuevos = LOGROS.filter(l => !u.logros[l.id] && l.ok(u));
    nuevos.forEach(l => u.logros[l.id] = Date.now());
    this.guardar();
    if (u.nube && typeof Nube !== "undefined") Nube.subir(u);
    return { ...calc, logros: nuevos, usuario: u };
  },

  /* Exporta solo los perfiles locales: los de Google ya están en la nube */
  exportar() {
    const usuarios = Object.fromEntries(this.locales().map(u => [u.id, u]));
    return JSON.stringify({ v: 1, usuarios, sesion: null, exportado: new Date().toISOString() }, null, 2);
  },

  /* Suma perfiles de otro archivo. Si un perfil ya existe, se queda la versión con más partidas. */
  importar(texto) {
    const d = JSON.parse(texto);
    if (!d || typeof d.usuarios !== "object") throw new Error("El archivo no es una base de datos de El Impostor.");
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
    return this.usuarios().map(u => {
      const s = juego ? u.stats[juego] : null;
      return { u, puntos: s ? s.p : u.puntos, j: s ? s.j : total(u, "j"), g: s ? s.g : total(u, "g") };
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
    ["Detectives: ganar como soplón", "+35"]
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
      if (r.gano) { gano = true; d.push(["Último en pie", 30]); }
    } else if (r.juego === "casos") {
      if (r.soplon) { if (!r.resuelto) { gano = true; d.push(["Ganaste como soplón", 35]); } }
      else {
        if (r.resuelto) { gano = true; d.push([`Caso resuelto (${"🔍".repeat(r.dificultad)})`, 10 + 10 * r.dificultad]); }
        if (r.votoCorrecto) d.push(["Votaste al culpable", 10]);
      }
    }
    const puntos = d.reduce((s, x) => s + x[1], 0);
    return { puntos, gano, detalle: d, resumen: `${JUEGOS[r.juego]} · ${gano ? "ganó" : "perdió"}` };
  }
};
