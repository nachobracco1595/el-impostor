/* Torre de hordas (Arena contra monstruos, de a uno).
   - Cada piso son olas de monstruos que pelean juntos contra vos; cada piso es más difícil y cada 5 hay un jefe.
   - Un intento: subís pisos seguidos hasta que caés (entre piso y piso recuperás algo de vida).
   - Cada 5 pisos queda guardado: el próximo intento arranca desde ahí.
   - 5 vidas por día: cada vez que caés perdés una. Cada 5 pisos superados se recuperan todas, y también se compran con monedas.
     Cada piso superado da monedas y experiencia al héroe que usaste.
   - La torre se reinicia sola cada 28 días (temporada) o cuando el admin la reinicia desde el panel.
   - En grupo (online, hasta 4): arrancan en el piso guardado más bajo del grupo, los monstruos son más y más fuertes,
     el que cae espera y vuelve en el piso siguiente; el intento termina cuando caen todos.
     Cada uno usa una de sus vidas del día (sin vidas juega igual, pero sin premio) y guarda su propio progreso.
   - Botín: al pasar un piso puede caer un objeto (común, raro, épico, legendario o mítico, con su grado) para el héroe que usaste,
     y materiales (fragmentos, gemas y pergaminos). Cuanto más alto el piso, más chance y mejor rareza;
     los jefes siempre dejan algo (ver Heroes.botinTorre). */
const TO = {
  INTENTOS: 5, DIAS: 28, PRECIO_VIDA: 100, PRECIO_SUBE: 50, PRECIO_MAX: 500, INICIO: "2026-10-20T00:00:00Z",
  // [nombre, ícono, color, dibujo en img/arena/mon]
  MONSTRUOS: [["Esqueleto", "💀", "#dee2e6", "esqueleto"], ["Goblin", "👺", "#82c91e", "goblin"], ["Zombi", "🧟", "#5c940d", "zombi"], ["Lobo", "🐺", "#868e96", "lobo"], ["Bruja", "🧙", "#9c36b5", "bruja"], ["Orco", "👹", "#2b8a3e", "orco"], ["Gólem", "🗿", "#adb5bd", "golem"], ["Vampiro", "🦇", "#c92a2a", "vampiro"], ["Demonio", "😈", "#e03131", "demonio"]],
  JEFES: [["Rey Esqueleto", "☠️", "jefe1"], ["Jefe Orco", "👹", "jefe2"], ["Gran Bruja", "🧙‍♀️", "jefe3"], ["Dragón", "🐉", "jefe4"], ["Señor Demonio", "😈", "jefe5"]],
  ESCENARIOS: ["ring", "coliseo", "volcan", "nave"]
};

const Torre = {
  cfg() { return Object.assign({ inicio: TO.INICIO, dias: TO.DIAS, intentos: TO.INTENTOS }, (typeof Nube !== "undefined" && Nube.cfg && Nube.cfg.torre) || {}); },
  /* Temporada actual: arranca en "inicio" (lo cambia el admin al reiniciar) y dura "dias" */
  temporada() {
    const c = this.cfg(), ini = Date.parse(c.inicio) || Date.parse(TO.INICIO), dias = Math.max(1, c.dias | 0 || TO.DIAS), largo = dias * 864e5;
    const n = Math.max(0, Math.floor((Date.now() - ini) / largo));
    return { key: `${c.inicio}#${n}`, fin: ini + (n + 1) * largo, dias };
  },
  datos(u) {
    Eco.completar(u);
    const T = this.temporada(), t = u.diario.torre = u.diario.torre || {};
    if (t.key !== T.key) { t.key = T.key; t.base = 1; t.mejor = 0; t.hoy = ""; t.usados = 0; }
    return t;
  },
  max() { return this.cfg().intentos | 0 || TO.INTENTOS; },
  quedan(u) { const t = this.datos(u); return Math.max(0, this.max() - (t.hoy === hoyStr() ? t.usados : 0)); },
  /* Vidas: comprar una con monedas (cada una del día sale un poco más) y recuperarlas todas cada 5 pisos */
  precioVida(u) { const t = this.datos(u); return Math.min(TO.PRECIO_MAX, Catalogo.precio("torre:vida", TO.PRECIO_VIDA) + TO.PRECIO_SUBE * (t.diaCompra === hoyStr() ? t.compradas | 0 : 0)); },
  comprarVida(u) {
    const t = this.datos(u), precio = this.precioVida(u);
    if (this.quedan(u) >= this.max() || u.monedas < precio || !Catalogo.visible("torre:vida")) return false;
    if (t.diaCompra !== hoyStr()) { t.diaCompra = hoyStr(); t.compradas = 0; }
    u.monedas -= precio; t.compradas++; t.usados = Math.max(0, (t.hoy === hoyStr() ? t.usados : 0) - 1); t.hoy = hoyStr();
    if (u.nube && typeof Nube !== "undefined") Nube.actividad("compra", "torre", 0, -precio);
    Catalogo.anotar(u, "torre", "torre:vida", "Vida de la torre", precio);
    if (typeof Sonido !== "undefined") Sonido.sfx("monedas");
    Toast.mostrar(`<div class="t-ic">❤️</div><div class="t-txt"><small>Torre de hordas</small><b>¡Recuperaste una vida!</b><span>Pagaste ${precio} 🪙. Tenés ${this.quedan(u)} de ${this.max()}.</span></div>`, "logro");
    Eco.guardar(u); return true;
  },
  regenerar(u) { const t = this.datos(u); t.hoy = hoyStr(); t.usados = 0; },

  /* ---------- Cómo es cada piso ---------- */
  piso(f, n = 1) {
    // Más suave al principio: menos monstruos por ola y más débiles; la dificultad sube de a poco
    const olas = Math.min(4, 1 + Math.floor((f - 1) / 5)), porOla = Math.min(8, Math.min(5, 1 + Math.ceil(f / 4)) + (n - 1)), jefe = f % 5 === 0;
    const lv = Math.min(40, 1 + Math.floor(f * 0.7)), pre = Math.min(10, Math.floor(f / 12));
    const fuerza = { hp: (0.6 + f * 0.035) * (1 + 0.35 * (n - 1)), dano: 0.55 + f * 0.022 };
    let k = 0;
    const mon = (extra = {}) => {
      const M = TO.MONSTRUOS[(f + k) % TO.MONSTRUOS.length];
      return { id: `m${f}-${k++}`, name: M[0], ic: M[1], cpu: true, nivel: f >= 10 ? "dificil" : "normal", ia: typeof Mente !== "undefined" ? Math.min(1, Mente.habilidad("torre", f >= 10 ? "dificil" : "normal") + f * 0.006) : null, equipo: "m", sprite: M[3], look: { color: M[2], acc: [] }, arena: Heroes.cpu(lv, pre), fuerza, ...extra };
    };
    const lista = [];
    for (let o = 0; o < olas; o++) lista.push(Array.from({ length: o === olas - 1 && jefe ? Math.max(1, porOla - 2) : porOla }, () => mon()));
    if (jefe) {
      const J = TO.JEFES[Math.floor(f / 5 - 1) % TO.JEFES.length];
      lista[olas - 1].push(mon({ name: J[0], ic: J[1], sprite: J[2], tam: 1.6, arena: Heroes.cpu(Math.min(40, lv + 5), pre), fuerza: { hp: fuerza.hp * 3.5, dano: fuerza.dano * 1.4 } }));
    }
    return { olas: lista, jefe, esc: TO.ESCENARIOS[(f - 1) % TO.ESCENARIOS.length] };
  },
  premio(f, st) { return { monedas: Math.round(Math.min(220, 12 + f * 3) * (1 + ((st && st.monedas) || 0))), xp: Math.min(600, 35 + f * 7) }; },

  /* ---------- Un intento ---------- */
  entrar() {
    if ((!ArenaPixi.listo || !ArenaPixi.imgsListas) && ArenaPixi.quiere() && !this.preparando) { this.preparando = true; return ArenaPixi.preparar(() => { this.preparando = false; Torre.entrar(); }); }
    const u = BD.sesion(); if (!u || !this.quedan(u)) return;
    const t = this.datos(u);
    if (t.hoy !== hoyStr()) { t.hoy = hoyStr(); t.usados = 0; }
    t.usados++; Eco.guardar(u);
    S.torre = { piso: t.base, hp: 1, clase: Heroes.datos(u).clase, run: "tl-" + Date.now().toString(36) };
    store.set("torreRun", { [S.torre.run]: true });
    this.jugarPiso();
  },
  /* Arma el piso f para los que pelean (h = [{ id, name, look, arena, hp }]) */
  armar(f, h, opts = {}) {
    const P = this.piso(f, h.length);
    const s = Arena.setup([...h.map(x => ({ ...x, equipo: "h" })), ...P.olas[0]], { esc: P.esc, nivel: "normal", online: !!opts.online, horda: { piso: f, ola: 1, olas: P.olas.length, resto: P.olas.slice(1), jefe: P.jefe, gano: null, run: opts.run, n: h.length } });
    s.jug.forEach(j => { if (j.equipo === "h" && !j.inv) { const d = h.find(x => x.id === j.id); j.hp = Math.max(1, Math.round(j.max * ((d && d.hp) || 1))); } else { const d = P.olas[0].find(x => x.id === j.id); if (d) j.evoIc = d.ic; } });
    return s;
  },
  jugarPiso() {
    const u = BD.sesion(), R = S.torre; if (!u || !R) return;
    const s = this.armar(R.piso, [{ id: "yo", name: u.nombre, look: u.look, arena: Arena.miPerfil(), hp: R.hp }], { run: R.run });
    S.arena = s; S.arenaCfg = S.arenaCfg || { modo: "duelo", nivel: "normal", esc: "ring" };
    clearInterval(Arena.reloj);
    let prev = Date.now();
    Arena.reloj = setInterval(() => {
      const a = S.arena; if (!a || S.screen !== "arena" || a !== s) { clearInterval(Arena.reloj); Arena.reloj = null; return; }
      const ahora = Date.now(); Arena.tickSeguro(a, (ahora - prev) / 1000); prev = ahora;
      Arena.render(Arena.view(a, "yo"), Arena.enviarLocal, { local: true });
    }, 50);
    go("arena");
  },
  /* Lo llama Arena.tick: nuevas olas y fin del piso */
  tick(s) {
    const H = s.horda, humanos = s.jug.filter(j => j.equipo === "h" && !j.inv), yo = humanos.find(j => j.vivo) || humanos[0];
    if (!humanos.some(j => j.vivo)) return this.cerrar(s, false);
    if (s.jug.some(j => j.equipo === "m" && j.vivo)) return;
    if (!H.resto.length) return this.cerrar(s, true);
    // Próxima ola: aparecen lejos tuyo
    const ola = H.resto.shift(), E = Arena.esc(s);
    H.ola++;
    // Respiro entre olas: los héroes vivos recuperan un poco de vida
    for (const h of humanos) if (h.vivo) h.hp = Math.min(h.max, h.hp + h.max * 0.15);
    for (const m of ola) {
      let pos = null;
      for (let k = 0; k < 60 && !pos; k++) { const x = 150 + Math.random() * 1100, y = 140 + Math.random() * 720; if (Arena.libre(E, x, y, 30) && Math.hypot(x - yo.x, y - yo.y) > 380 && !E.lava.some(l => Math.hypot(x - l.x, y - l.y) < l.r + 30)) pos = { x, y }; }
      const j = Arena.luchador(m, pos || Arena.salidas(E, 2)[1]); j.evoIc = m.ic; j.cdA = s.t + 600; s.jug.push(j);
      s.fx.push({ k: ++s.nP, tipo: "humo", x: j.x, y: j.y, t: s.t });
    }
    s.feed.unshift({ t: s.t, txt: `🌊 ¡Ola ${H.ola} de ${H.olas}! (+15% de vida)${!H.resto.length && H.jefe ? " Llegó el jefe" : ""}` }); s.feed = s.feed.slice(0, 4);
  },
  cerrar(s, gano) {
    if (s.fase === "fin") return;
    s.fase = "fin"; s.horda.gano = gano;
    s.horda.premio = gano ? this.premio(s.horda.piso) : null;
    if (typeof Sonido !== "undefined") Sonido.sfx(gano ? "victoria" : "derrota");
    if (!s.online) {
      if (typeof Mente !== "undefined") Mente.resultado("torre", gano);
      const R = S.torre, yo = s.jug.find(j => j.equipo === "h" && !j.inv);
      this.cobrar(this.vista(s), yo.clase, yo.st);
      // Entre piso y piso se recupera la mitad de la vida (y toda después de un jefe)
      if (gano && R) R.hp = s.horda.jefe ? 1 : Math.min(1, yo.hp / yo.max + 0.5); else S.torre = null;
    }
  },
  /* Cada teléfono cobra el piso que ganó (una sola vez) y guarda su progreso */
  cobrar(H, clase, st) {
    const u = BD.sesion(); if (!u || !H) return null;
    const hechos = store.get("torreCobrado", {}), k = `${H.id}`;
    if (hechos[k]) return hechos[k];
    const runs = store.get("torreRun", {}), conPremio = !!runs[H.run], t = this.datos(u), f = H.piso;
    let r = { sinPremio: !conPremio, vidas: false };
    if (H.gano && conPremio) {
      const p = this.premio(f, st);
      Eco.completar(u); u.monedas += p.monedas;
      Heroes.ganarXp(u, clase, p.xp);
      t.mejor = Math.max(t.mejor | 0, f);
      if (f % 5 === 0) { t.base = Math.max(t.base | 0, f + 1); this.regenerar(u); r.vidas = true; }
      const sa = u.stats.arena = u.stats.arena || {}; sa.torreMejor = Math.max(sa.torreMejor | 0, f);
      r = { ...p, sinPremio: false, vidas: f % 5 === 0, botin: Heroes.botinTorre(u, clase, f) };
    }
    r.base = t.base; r.quedan = this.quedan(u);
    hechos[k] = r; store.set("torreCobrado", Object.fromEntries(Object.entries(hechos).slice(-30)));
    Eco.guardar(u);
    return r;
  },
  seguir() { if (!S.torre) return; S.torre.piso++; Arena.parar(); this.jugarPiso(); },
  salir() { Arena.parar(); S.torre = null; S.arena = null; go("arenaIntro"); },

  /* ---------- Pantalla de pelea ---------- */
  vista(s) { const H = s.horda; return { id: s.id, run: H.run, n: H.n, piso: H.piso, ola: H.ola, olas: H.olas, gano: H.gano, jefe: H.jefe, vivos: s.jug.filter(j => j.equipo === "m" && j.vivo).length, caidos: s.jug.filter(j => j.equipo === "h" && !j.inv && !j.vivo).length }; },
  /* Online: al ver un intento nuevo, cada teléfono usa uno de sus intentos del día (si no le quedan, juega sin premio) */
  unirse(v) {
    const H = v.horda; if (!H || !v.online || !H.run) return;
    const runs = store.get("torreRun", {});
    if (H.run in runs) return;
    const u = BD.sesion(); let ok = false;
    if (u && this.quedan(u)) { const t = this.datos(u); if (t.hoy !== hoyStr()) { t.hoy = hoyStr(); t.usados = 0; } t.usados++; Eco.guardar(u); ok = true; }
    runs[H.run] = ok; store.set("torreRun", Object.fromEntries(Object.entries(runs).slice(-20)));
  },
  barra(v) {
    this.unirse(v);
    const yo = v.jug[v.yo], H = v.horda, humanos = v.jug.filter(j => j.equipo === "h" && !j.inv);
    const chip = j => `<span class="ar-chip ${j.vivo ? "" : "fuera"} ${j.id === v.me ? "yo" : ""}">${j.evoIc || AR.CLASES[j.clase].ic}<b>${esc(j.name)}</b><i style="width:${Math.max(0, j.hp / j.max) * 100}%"></i></span>`;
    return `${humanos.map(chip).join("")}<span class="ar-chip to-chip"><b>🗼 Piso ${H.piso}${H.jefe ? " · Jefe" : ""}</b></span><span class="ar-chip to-chip"><b>🌊 ${H.ola}/${H.olas} · 👹 ${H.vivos}</b></span>
      ${yo && !yo.vivo && v.fase !== "fin" && humanos.some(j => j.vivo) ? `<span class="ar-chip to-chip"><b>💀 Caíste: volvés en el próximo piso</b></span>` : ""}`;
  },
  fin(v, el) {
    const H = v.horda, f = H.piso, yo = v.jug[v.yo], jefe = !v.online || v.isHost;
    const r = yo ? this.cobrar(H, yo.clase, Heroes.stats(Heroes.validar(Arena.miPerfil()))) || {} : {};
    const B = H.gano && r.botin, premio = (r.sinPremio ? `<p class="sub">Jugás sin premio: no te quedaban vidas hoy.</p>` : r.monedas ? `<div class="tr-premio"><div><b>+${r.monedas}</b><small>monedas</small></div><div><b>+${r.xp}</b><small>XP</small></div></div>` : "")
      + Heroes.tarjetaBotin(B);
    el.innerHTML = `<div class="ar-fin-caja">${H.gano
      ? `<h2>🏆 ¡Piso ${f} superado!</h2>${premio}
         ${f % 5 === 0 && !r.sinPremio ? `<p class="sub">🚩 ¡Guardado! Si caés, volvés desde el piso ${f + 1}. ❤️ ¡Recuperaste todas tus vidas (${r.quedan}/${this.max()})!</p>` : `<p class="sub">El próximo guardado es en el piso ${Math.ceil((f + 1) / 5) * 5}. ${v.online ? "Los que cayeron vuelven en el próximo piso y todos recuperan algo de vida." : "Recuperás algo de vida entre piso y piso."}</p>`}
         ${jefe ? `<div class="row"><button class="btn" id="toSeguir">⬆️ Seguir al piso ${f + 1}</button><button class="btn ghost" id="toSalir">${v.online ? "Volver a la sala" : "Terminar acá"}</button></div>` : `<p class="sub">El anfitrión elige si siguen al piso ${f + 1}.</p><button class="btn ghost" id="toIrme">Salir</button>`}`
      : `<h2>💀 ${v.online ? `Cayeron en el piso ${f}` : `Caíste en el piso ${f}`}</h2>
         <p class="sub">Volvés desde el piso ${r.base || 1}. <span id="toVidasTx">${Torre.textoVidas()}</span></p>
         ${!v.online ? `<div class="row"><button class="btn" id="toOtra" ${r.quedan ? "" : "disabled"}>❤️ Usar una vida y volver al piso ${r.base || 1}</button></div>` : ""}
         ${Torre.botonComprar()}
         ${jefe ? `<div class="row"><button class="btn ghost" id="toSalir">${v.online ? "Volver a la sala" : "Volver a la Arena"}</button></div>` : `<button class="btn ghost" id="toIrme">Salir</button>`}`}</div>`;
    if (B && B.item && B.item.rar >= 3 && typeof Sonido !== "undefined" && !el.dataset.botin) { el.dataset.botin = 1; setTimeout(() => Sonido.sfx("logro"), 600); }
    on("toSeguir", () => v.online ? Arena.send({ t: "torreSeguir" }) : Torre.seguir());
    on("toSalir", () => v.online ? Arena.send({ t: "lobby" }) : Torre.salir());
    on("toIrme", () => { UI.confirmSalir = true; render(); });
    on("toOtra", () => { Arena.parar(); S.arena = null; Torre.entrar(); });
    on("toComprar", () => { const u = BD.sesion(); if (u && confirm(`¿Comprar una vida por ${Torre.precioVida(u)} monedas?`) && Torre.comprarVida(u)) Torre.fin(v, el); });
  },
  textoVidas() { const u = BD.sesion(); if (!u) return ""; const q = this.quedan(u); return q ? `Te quedan ❤️ ${q} de ${this.max()} vidas hoy.` : "No te quedan vidas hoy."; },
  botonComprar() {
    const u = BD.sesion(); if (!u || this.quedan(u) >= this.max() || !Catalogo.visible("torre:vida")) return "";
    const p = this.precioVida(u);
    return `<button class="btn ${this.quedan(u) ? "ghost" : "tb-girar"}" id="toComprar" ${u.monedas < p ? "disabled" : ""}>💰 Comprar una vida · ${p} 🪙</button>`;
  },

  /* ---------- En grupo (online): el anfitrión arma cada piso ---------- */
  info() { const u = BD.sesion(); if (!u) return null; const t = this.datos(u); return { base: t.base | 0 || 1, quedan: this.quedan(u), mejor: t.mejor | 0 }; },
  validarInfo(x) { return x && typeof x === "object" ? { base: Math.max(1, Math.min(100000, x.base | 0 || 1)), quedan: Math.max(0, Math.min(20, x.quedan | 0)), mejor: Math.max(0, x.mejor | 0) } : null; },
  empezarOn(R) {
    const jug = R.players.filter(p => p.on);
    if (jug.length > 4) return "La torre en grupo es de hasta 4.";
    const infos = jug.map(p => (p.id === "H" ? this.info() : p.torre) || { base: 1, quedan: 0 });
    R.torreRun = { run: "tg-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), piso: Math.min(...infos.map(x => x.base || 1)), hp: {} };
    this.pisoOn(R);
    return null;
  },
  pisoOn(R) {
    const T = R.torreRun, jug = R.players.filter(p => p.on).slice(0, 4);
    const h = jug.map(p => ({ id: p.id, name: p.name, look: p.look, arena: p.id === "H" ? Arena.miPerfil() : p.arena, hp: T.hp[p.id] || 1 }));
    R.arena = this.armar(T.piso, h, { online: true, run: T.run });
    R.game = "arena";
    Arena.relojHost(R);
  },
  seguirOn(R) {
    const s = R.arena, T = R.torreRun;
    if (!s || !T || s.fase !== "fin" || !s.horda.gano) return;
    s.jug.filter(j => j.equipo === "h" && !j.inv).forEach(j => { T.hp[j.id] = j.vivo ? Math.min(1, j.hp / j.max + 0.35) : 0.4; });
    T.piso++;
    this.pisoOn(R);
  },

  /* ---------- Panel en la Arena ---------- */
  panel(u) {
    const t = this.datos(u), T = this.temporada(), q = this.quedan(u), dias = Math.max(0, Math.ceil((T.fin - Date.now()) / 864e5));
    const yo = Heroes.datos(u), C = AR.CLASES[yo.clase], p = yo.pj[yo.clase], e = p.evo.length ? Heroes.evoDe(yo.clase, p.evo[p.evo.length - 1]) : null;
    return `<div class="panel to-panel"><div class="headrow"><span class="label">🗼 Torre de hordas</span><small class="sub">Se reinicia en ${dias} día${dias === 1 ? "" : "s"}</small></div>
      <div class="to-datos"><div><b>${t.base}</b><small>arrancás en el piso</small></div><div><b>${t.mejor || 0}</b><small>tu mejor piso</small></div><div><b>❤️ ${q}/${this.max()}</b><small>vidas hoy</small></div></div>
      <p class="sub he-nota">Pasá olas de monstruos piso por piso: cada uno es más difícil y cada 5 hay un jefe, queda guardado y recuperás todas tus vidas. Cada vez que caés perdés una. Cada piso da monedas, experiencia y a veces botín (más raro cuanto más alto).</p>
      <button class="linkish to-rank" id="toRank">🏆 Ver el ranking de la torre</button>
      <button class="btn tb-girar" id="toEntrar" ${q ? "" : "disabled"}>${q ? `🗼 Subir desde el piso ${t.base} con ${esc(e ? e.nombre : C.nombre)}` : "Sin vidas: comprá una o volvé mañana"}</button>
      ${this.botonComprar()}</div>`;
  }
};
