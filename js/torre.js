/* Torre de hordas (Arena contra monstruos, de a uno).
   - Cada piso son olas de monstruos que pelean juntos contra vos; cada piso es más difícil y cada 5 hay un jefe.
   - Un intento: subís pisos seguidos hasta que caés (entre piso y piso recuperás algo de vida).
   - Cada 5 pisos queda guardado: el próximo intento arranca desde ahí.
   - 3 intentos por día. Cada piso superado da monedas y experiencia al héroe que usaste.
   - La torre se reinicia sola cada 28 días (temporada) o cuando el admin la reinicia desde el panel. */
const TO = {
  INTENTOS: 3, DIAS: 28, INICIO: "2026-10-20T00:00:00Z",
  MONSTRUOS: [["Esqueleto", "💀", "#dee2e6"], ["Goblin", "👺", "#82c91e"], ["Zombi", "🧟", "#5c940d"], ["Lobo", "🐺", "#868e96"], ["Bruja", "🧙", "#9c36b5"], ["Orco", "👹", "#2b8a3e"], ["Gólem", "🗿", "#adb5bd"], ["Vampiro", "🦇", "#c92a2a"], ["Demonio", "😈", "#e03131"]],
  JEFES: [["Rey Esqueleto", "☠️"], ["Jefe Orco", "👹"], ["Gran Bruja", "🧙‍♀️"], ["Dragón", "🐉"], ["Señor Demonio", "😈"]],
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
  quedan(u) { const t = this.datos(u); return Math.max(0, (this.cfg().intentos | 0 || TO.INTENTOS) - (t.hoy === hoyStr() ? t.usados : 0)); },

  /* ---------- Cómo es cada piso ---------- */
  piso(f) {
    const olas = Math.min(4, 1 + Math.floor((f - 1) / 4)), porOla = Math.min(5, 1 + Math.ceil(f / 3)), jefe = f % 5 === 0;
    const lv = Math.min(40, 1 + Math.floor(f * 0.9)), pre = Math.min(10, Math.floor(f / 10));
    const fuerza = { hp: 0.7 + f * 0.045, dano: 0.65 + f * 0.028 };
    let k = 0;
    const mon = (extra = {}) => {
      const M = TO.MONSTRUOS[(f + k) % TO.MONSTRUOS.length];
      return { id: `m${f}-${k++}`, name: M[0], ic: M[1], cpu: true, nivel: f >= 10 ? "dificil" : "normal", equipo: "m", look: { color: M[2], acc: [] }, arena: Heroes.cpu(lv, pre), fuerza, ...extra };
    };
    const lista = [];
    for (let o = 0; o < olas; o++) lista.push(Array.from({ length: o === olas - 1 && jefe ? Math.max(1, porOla - 2) : porOla }, () => mon()));
    if (jefe) {
      const J = TO.JEFES[Math.floor(f / 5 - 1) % TO.JEFES.length];
      lista[olas - 1].push(mon({ name: J[0], ic: J[1], tam: 1.45, arena: Heroes.cpu(Math.min(40, lv + 5), pre), fuerza: { hp: fuerza.hp * 3.5, dano: fuerza.dano * 1.4 } }));
    }
    return { olas: lista, jefe, esc: TO.ESCENARIOS[(f - 1) % TO.ESCENARIOS.length] };
  },
  premio(f, st) { return { monedas: Math.round(Math.min(220, 12 + f * 3) * (1 + ((st && st.monedas) || 0))), xp: Math.min(600, 35 + f * 7) }; },

  /* ---------- Un intento ---------- */
  entrar() {
    const u = BD.sesion(); if (!u || !this.quedan(u)) return;
    const t = this.datos(u);
    if (t.hoy !== hoyStr()) { t.hoy = hoyStr(); t.usados = 0; }
    t.usados++; Eco.guardar(u);
    S.torre = { piso: t.base, hp: 1, clase: Heroes.datos(u).clase };
    this.jugarPiso();
  },
  jugarPiso() {
    const u = BD.sesion(), R = S.torre; if (!u || !R) return;
    const P = this.piso(R.piso), yo = { id: "yo", name: u.nombre, look: u.look, arena: Arena.miPerfil(), equipo: "h" };
    const s = Arena.setup([yo, ...P.olas[0]], { esc: P.esc, nivel: "normal", horda: { piso: R.piso, ola: 1, olas: P.olas.length, resto: P.olas.slice(1), jefe: P.jefe, gano: null, premio: null } });
    const J = s.jug[0]; J.hp = Math.max(1, Math.round(J.max * R.hp));
    s.jug.slice(1).forEach(m => { const d = P.olas[0].find(x => x.id === m.id); if (d) m.evoIc = d.ic; });
    S.arena = s; S.arenaCfg = S.arenaCfg || { modo: "duelo", nivel: "normal", esc: "ring" };
    clearInterval(Arena.reloj);
    let prev = Date.now();
    Arena.reloj = setInterval(() => {
      const a = S.arena; if (!a || S.screen !== "arena" || a !== s) { clearInterval(Arena.reloj); Arena.reloj = null; return; }
      const ahora = Date.now(); Arena.tick(a, (ahora - prev) / 1000); prev = ahora;
      Arena.render(Arena.view(a, "yo"), Arena.enviarLocal, { local: true });
    }, 50);
    go("arena");
  },
  /* Lo llama Arena.tick: nuevas olas y fin del piso */
  tick(s) {
    const H = s.horda, yo = s.jug.find(j => j.equipo === "h");
    if (!yo.vivo) return this.cerrar(s, false);
    if (s.jug.some(j => j.equipo === "m" && j.vivo)) return;
    if (!H.resto.length) return this.cerrar(s, true);
    // Próxima ola: aparecen lejos tuyo
    const ola = H.resto.shift(), E = Arena.esc(s);
    H.ola++;
    for (const m of ola) {
      let pos = null;
      for (let k = 0; k < 60 && !pos; k++) { const x = 150 + Math.random() * 1100, y = 140 + Math.random() * 720; if (Arena.libre(E, x, y, 30) && Math.hypot(x - yo.x, y - yo.y) > 380 && !E.lava.some(l => Math.hypot(x - l.x, y - l.y) < l.r + 30)) pos = { x, y }; }
      const j = Arena.luchador(m, pos || Arena.salidas(E, 2)[1]); j.evoIc = m.ic; j.cdA = s.t + 600; s.jug.push(j);
      s.fx.push({ k: ++s.nP, tipo: "humo", x: j.x, y: j.y, t: s.t });
    }
    s.feed.unshift({ t: s.t, txt: `🌊 ¡Ola ${H.ola} de ${H.olas}!${!H.resto.length && H.jefe ? " Llegó el jefe" : ""}` }); s.feed = s.feed.slice(0, 4);
  },
  cerrar(s, gano) {
    if (s.fase === "fin") return;
    s.fase = "fin"; s.horda.gano = gano;
    const u = BD.sesion(), R = S.torre, yo = s.jug.find(j => j.equipo === "h"), f = s.horda.piso;
    if (!u || !R) return;
    const t = this.datos(u);
    if (gano) {
      const p = this.premio(f, yo.st);
      Eco.completar(u); u.monedas += p.monedas;
      Heroes.ganarXp(u, R.clase, p.xp);
      t.mejor = Math.max(t.mejor | 0, f);
      if (f % 5 === 0) t.base = Math.max(t.base | 0, f + 1);
      const st = u.stats.arena = u.stats.arena || {}; st.torreMejor = Math.max(st.torreMejor | 0, f);
      s.horda.premio = p; s.horda.base = t.base;
      R.hp = Math.min(1, yo.hp / yo.max + 0.35);
      if (typeof Sonido !== "undefined") Sonido.sfx("victoria");
    } else {
      s.horda.base = t.base; S.torre = null;
      if (typeof Sonido !== "undefined") Sonido.sfx("derrota");
    }
    s.horda.quedan = this.quedan(u);
    Eco.guardar(u);
  },
  seguir() { if (!S.torre) return; S.torre.piso++; Arena.parar(); this.jugarPiso(); },
  salir() { Arena.parar(); S.torre = null; S.arena = null; go("arenaIntro"); },

  /* ---------- Pantalla de pelea ---------- */
  vista(s) { const H = s.horda; return { piso: H.piso, ola: H.ola, olas: H.olas, gano: H.gano, premio: H.premio, base: H.base, quedan: H.quedan, jefe: H.jefe, vivos: s.jug.filter(j => j.equipo === "m" && j.vivo).length }; },
  barra(v) {
    const yo = v.jug[v.yo], H = v.horda;
    return `${yo ? `<span class="ar-chip yo">${yo.evoIc || AR.CLASES[yo.clase].ic}<b>${esc(yo.name)}</b><i style="width:${Math.max(0, yo.hp / yo.max) * 100}%"></i></span>` : ""}
      <span class="ar-chip to-chip"><b>🗼 Piso ${H.piso}${H.jefe ? " · Jefe" : ""}</b></span><span class="ar-chip to-chip"><b>🌊 ${H.ola}/${H.olas} · 👹 ${H.vivos}</b></span>`;
  },
  fin(v, el) {
    const H = v.horda, f = H.piso;
    el.innerHTML = `<div class="ar-fin-caja">${H.gano
      ? `<h2>🏆 ¡Piso ${f} superado!</h2>
         <div class="tr-premio"><div><b>+${H.premio.monedas}</b><small>monedas</small></div><div><b>+${H.premio.xp}</b><small>XP</small></div></div>
         ${f % 5 === 0 ? `<p class="sub">🚩 ¡Guardado! Tus próximos intentos arrancan en el piso ${f + 1}.</p>` : `<p class="sub">El próximo guardado es en el piso ${Math.ceil((f + 1) / 5) * 5}. Recuperás algo de vida entre piso y piso.</p>`}
         <div class="row"><button class="btn" id="toSeguir">⬆️ Seguir al piso ${f + 1}</button><button class="btn ghost" id="toSalir">Terminar acá</button></div>`
      : `<h2>💀 Caíste en el piso ${f}</h2>
         <p class="sub">Tu próximo intento arranca en el piso ${H.base}. ${H.quedan ? `Te quedan ${H.quedan} intento${H.quedan > 1 ? "s" : ""} hoy.` : "Ya usaste los intentos de hoy: volvé mañana."}</p>
         <div class="row"><button class="btn" id="toSalir">Volver a la Arena</button></div>`}</div>`;
    on("toSeguir", () => Torre.seguir());
    on("toSalir", () => Torre.salir());
  },

  /* ---------- Panel en la Arena ---------- */
  panel(u) {
    const t = this.datos(u), T = this.temporada(), q = this.quedan(u), dias = Math.max(0, Math.ceil((T.fin - Date.now()) / 864e5));
    const yo = Heroes.datos(u), C = AR.CLASES[yo.clase], p = yo.pj[yo.clase], e = p.evo.length ? Heroes.evoDe(yo.clase, p.evo[p.evo.length - 1]) : null;
    return `<div class="panel to-panel"><div class="headrow"><span class="label">🗼 Torre de hordas</span><small class="sub">Se reinicia en ${dias} día${dias === 1 ? "" : "s"}</small></div>
      <div class="to-datos"><div><b>${t.base}</b><small>arrancás en el piso</small></div><div><b>${t.mejor || 0}</b><small>tu mejor piso</small></div><div><b>${q}/${this.cfg().intentos | 0 || TO.INTENTOS}</b><small>intentos hoy</small></div></div>
      <p class="sub he-nota">Pasá olas de monstruos piso por piso: cada uno es más difícil y cada 5 hay un jefe y queda guardado. Cada piso da monedas y experiencia.</p>
      <button class="linkish to-rank" id="toRank">🏆 Ver el ranking de la torre</button>
      <button class="btn tb-girar" id="toEntrar" ${q ? "" : "disabled"}>${q ? `🗼 Subir desde el piso ${t.base} con ${esc(e ? e.nombre : C.nombre)}` : "Volvé mañana: ya usaste los 3 intentos"}</button></div>`;
  }
};
