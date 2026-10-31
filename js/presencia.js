/* Quién está en línea y salas abiertas (Supabase Realtime Presence: canal "mesa-presencia", sin tablas).
   - Cada teléfono avisa que está conectado, qué está haciendo y, si es anfitrión de una sala pública, los datos de la sala.
   - Se ven por nombre los amigos y los perfiles públicos; el resto solo suma al contador.
   - Las salas públicas aparecen en "Salas abiertas" para que cualquiera entre; las privadas solo con el código. */
const EnLinea = {
  canal: null, estado: {}, mio: null, listo: false, ultimo: "",

  clave() { const u = BD.sesion(); return u && u.nube && typeof Nube !== "undefined" && Nube.user ? Nube.user.id : "l-" + miCid(); },
  iniciar() {
    if (this.canal || typeof Nube === "undefined" || !Nube.sb || Nube.estado !== "lista") return;
    this.miClave = this.clave();
    try {
      const prueba = (/[?&]pr=(\w{1,20})/.exec(location.search) || [])[1];   // ?pr=xxx: canal aparte para probar
      this.canal = Nube.sb.channel("mesa-presencia" + (prueba ? "-" + prueba : ""), { config: { presence: { key: this.miClave } } });
      this.canal.on("presence", { event: "sync" }, () => { this.estado = this.canal.presenceState(); this.alCambiar(); })
        .subscribe(st => { if (st === "SUBSCRIBED") { this.listo = true; this.ultimo = ""; this.avisar(true); } });
    } catch (e) { console.warn("presencia", e); this.canal = null; }
  },
  /* Si cambió la cuenta (entró o salió), se vuelve a conectar con la clave nueva */
  revisarCuenta() { if (this.canal && this.miClave !== this.clave()) { try { Nube.sb.removeChannel(this.canal); } catch {} this.canal = null; this.listo = false; this.iniciar(); } },

  /* Qué está haciendo uno ahora */
  actividad() {
    const sc = S.screen, nom = k => (typeof JUEGOS !== "undefined" && JUEGOS[k]) || null;
    if (typeof Net !== "undefined" && Net.activo()) {
      const v = Net.view || (Net.R && { game: Net.R.game }), g = v && v.game && v.game !== "lobby" ? v.game : null;
      return { estado: g ? "jugando" : "sala", que: g ? `Jugando ${nom(g) || g} online` : "En una sala online" };
    }
    if (["casino", "ruleta", "slots", "blackjack", "bingoSolo"].includes(sc)) return { estado: "jugando", que: "En el casino" };
    const juego = { arena: "arena", arenaIntro: "arena", torre: "arena", chinchon: "chinchon", truco: "truco", burako: "burako", poker: "poker", carrera: "carrera", carreraIntro: "carrera", naval: "naval", ajedrez: "ajedrez", nave: "nave", naveIntro: "nave", liars: "liars", casos: "casos", bowling: "bowling", arco: "arco", circo: "circo", preguntas: "preguntas", pass: "impostor", reveal: "impostor", play: "impostor", vote: "impostor" }[sc];
    if (juego) return { estado: "jugando", que: `Jugando ${nom(juego) || juego}` };
    if (sc === "trabajos" || sc === "trabajo") return { estado: "jugando", que: "Trabajando" };
    return { estado: "menu", que: "En el menú" };
  },
  /* La sala que uno tiene abierta como anfitrión, si es pública */
  miSala() {
    if (typeof Net === "undefined" || Net.rol !== "host" || !Net.R || !Net.publica) return null;
    const R = Net.R, n = R.players.filter(p => p.on).length;
    return { code: R.code, juego: (typeof JUEGOS !== "undefined" && JUEGOS[R.game || R.sel]) || "Elegiendo juego", n, enJuego: !!R.game, host: Net.name };
  },
  datos() {
    const u = BD.sesion(), a = this.actividad();
    return { id: this.miClave, nombre: u ? u.nombre : store.get("nombre", "Invitado"), look: u && u.look ? { color: u.look.color, acc: (u.look.acc || []).slice(0, 4) } : null,
      nube: !!(u && u.nube), publico: !!(u && u.publico), ...a, sala: this.miSala() };
  },
  /* Manda el estado si cambió (o cada tanto para refrescar) */
  avisar(forzar) {
    if (!this.canal || !this.listo) return;
    const d = this.datos(), firma = JSON.stringify(d);
    if (!forzar && firma === this.ultimo) return;
    this.ultimo = firma;
    try { this.canal.track(d); } catch {}
  },

  /* ---------- Lo que se ve ---------- */
  lista() {
    const out = [];
    for (const [k, metas] of Object.entries(this.estado || {})) { const m = metas && metas[metas.length - 1]; if (m && k !== this.miClave) out.push({ ...m, id: k }); }
    return out;
  },
  enLinea(id) { return !!(this.estado && this.estado[id] && this.estado[id].length); },
  de(id) { const m = this.estado && this.estado[id]; return m && m.length ? m[m.length - 1] : null; },
  amigos() { return typeof Social !== "undefined" && Social.disponible() ? Social.amigos() : []; },
  visibles() { const am = this.amigos(); return this.lista().filter(p => p.nube && (p.publico || am.includes(p.id))).sort((a, b) => (am.includes(b.id) - am.includes(a.id)) || (a.estado === "menu") - (b.estado === "menu")); },
  salas() {
    const mia = this.miSala();
    return [...this.lista().filter(p => p.sala && p.sala.code), ...(mia ? [{ id: this.miClave, nombre: Net.name, sala: mia, yo: true }] : [])];
  },
  total() { return this.lista().length + (this.listo ? 1 : 0); },
  alCambiar() {
    clearTimeout(this.tPintar);
    this.tPintar = setTimeout(() => {
      // Las listas de salas se actualizan en el lugar (así no se pierde lo que estés escribiendo)
      document.querySelectorAll("[data-pr-salas]").forEach(el => { el.innerHTML = this.htmlSalas(); }); this.conectarSalas();
      if (["home", "enLinea", "amigos"].includes(S.screen) && !document.querySelector("input:focus")) render();
      else this.pintarChip();
    }, 300);
  },
  chip() {
    if (!this.listo) return "";
    const s = this.salas().filter(x => !x.yo).length;
    return `<button class="pr-chip" id="verEnLinea"><i class="pr-punto on"></i><b data-pr-total>${this.total()}</b>&nbsp;en línea${s ? ` · <b>${s}</b> sala${s > 1 ? "s" : ""} abierta${s > 1 ? "s" : ""}` : ""} <span>›</span></button>`;
  },
  pintarChip() { const b = document.getElementById("verEnLinea"); if (b) b.outerHTML = this.chip(), on("verEnLinea", () => go("enLinea")); },
  punto(id) { return `<i class="pr-punto ${this.enLinea(id) ? "on" : ""}" title="${this.enLinea(id) ? "En línea" : "Desconectado"}"></i>`; },
  textoEstado(id) { const m = this.de(id); return m ? m.que || "En línea" : "Desconectado"; },
  htmlSalas(vacio = true) {
    const ss = this.salas().filter(x => !x.yo);
    if (!ss.length) return vacio ? `<p class="empty">No hay salas públicas abiertas ahora. Creá una y marcala como pública para que aparezca acá.</p>` : "";
    return `<ul class="pr-salas">${ss.map(x => `<li><div><b>${esc(x.sala.host || x.nombre)}</b><small>${esc(x.sala.juego)} · ${x.sala.n} en la sala${x.sala.enJuego ? " · en partida" : ""}</small></div>
      <span class="pr-cod">${esc(x.sala.code)}</span><button class="btn chico" data-pr-sala="${esc(x.sala.code)}">Entrar</button></li>`).join("")}</ul>`;
  },
  conectarSalas() {
    app.querySelectorAll("[data-pr-sala]").forEach(b => b.onclick = () => { const u = BD.sesion(); Net.unirse(b.dataset.prSala, u ? u.nombre : store.get("nombre", "Jugador")); });
  }
};

/* Pantalla "En línea": salas abiertas y gente conectada */
PANTALLAS.enLinea = () => {
  const P = EnLinea, vis = P.visibles(), am = P.amigos(), otros = P.lista().length - vis.length;
  const look = p => (typeof Cuenta !== "undefined" && Cuenta.lookValido(p.look)) || { color: "#748ffc", acc: [] };
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>En línea</h2><p class="sub">${P.listo ? `Hay <b>${P.total()}</b> persona${P.total() === 1 ? "" : "s"} jugando ahora (contándote a vos).` : "Conectando…"}</p></div>
    <div class="panel"><span class="label">🚪 Salas abiertas</span><div data-pr-salas>${P.htmlSalas()}</div></div>
    <div class="panel"><span class="label">🟢 Conectados</span>
      ${vis.length ? `<ul class="players">${vis.map(p => `<li><button class="tj-ver" data-tarjeta="${esc(p.id)}">${retrato(look(p), 36)}<span class="name">${esc(p.nombre)}${am.includes(p.id) ? ` <small class="tit-mini">amigo</small>` : ""}<small class="pr-que"><i class="pr-punto on ${p.estado}"></i>${esc(p.que || "En línea")}</small></span></button>
        ${p.sala ? `<button class="btn chico" data-pr-sala="${esc(p.sala.code)}">Entrar</button>` : ""}</li>`).join("")}</ul>` : `<p class="empty">${P.listo ? "Ningún amigo ni perfil público conectado ahora." : "…"}</p>`}
      ${otros > 0 ? `<p class="summary">Y ${otros} persona${otros > 1 ? "s" : ""} más jugando (con perfil privado o sin cuenta).</p>` : ""}
    </div>
    <p class="summary center">Aparecés por nombre para tus amigos${BD.sesion() && BD.sesion().publico ? " y para todos (tu perfil es público)" : ". Si hacés tu perfil público, te ve todo el mundo"}.</p>
    <button class="btn ghost" id="plVolver">Volver</button>
  </section>`;
  P.conectarSalas();
  app.querySelectorAll("[data-tarjeta]").forEach(b => b.onclick = () => { if (!String(b.dataset.tarjeta).startsWith("l-")) Tarjeta.abrir({ id: b.dataset.tarjeta }); });
  on("plVolver", () => go("home"));
};

/* Se conecta cuando la nube está lista, avisa los cambios de pantalla y se refresca cada 20 s */
{ const r0 = render; render = function () { const x = r0.apply(this, arguments); try { EnLinea.iniciar(); EnLinea.revisarCuenta(); EnLinea.avisar(); } catch {} return x; }; }
setInterval(() => { try { EnLinea.iniciar(); EnLinea.avisar(); } catch {} }, 20000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) try { EnLinea.avisar(true); } catch {} });
