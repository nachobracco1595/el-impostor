/* Juego online con PeerJS: el anfitrión guarda la partida y le manda a cada teléfono solo lo que puede ver. */
const PREFIJO = "el-impostor-sala-";
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function miCid() {
  let id = store.get("cid", null);
  if (!id) { id = "j" + Math.random().toString(36).slice(2, 10); store.set("cid", id); }
  return id;
}

const Net = {
  rol: null, peer: null, conn: null, code: null, name: null, view: null,
  estado: "", error: "", R: null, conns: {},

  activo() { return !!this.rol; },
  nombre() { return this.name || ""; },
  cantidad() { return this.R ? this.R.players.filter(p => p.on).length : 0; },
  conectado(id) { if (!this.R) return true; const p = this.R.players.find(x => x.id === id); return !!(p && p.on); },

  opciones() {
    // ?peer=localhost:9000 permite probar con un servidor PeerJS propio
    const m = /[?&]peer=([^&:]+):(\d+)/.exec(location.search);
    const base = { debug: 0 };
    return m ? { ...base, host: m[1], port: +m[2], path: "/", secure: false } : base;
  },

  disponible() { return typeof Peer !== "undefined" && typeof RTCPeerConnection !== "undefined"; },

  fallo(e) {
    const t = e && e.type;
    this.estado = "error";
    this.error = t === "peer-unavailable" ? "No existe una sala con ese código. Revisa las letras o pídele el código otra vez al anfitrión."
      : t === "browser-incompatible" ? "Este navegador no permite jugar online. Prueba con Chrome o Safari actualizados."
      : t === "network" || t === "server-error" || t === "socket-error" ? "No hay conexión con el servidor de salas. Revisa tu internet y prueba de nuevo."
      : "No se pudo conectar. Si abriste el juego dentro de Claude, ábrelo desde la página web del juego para jugar online.";
    render();
  },

  /* ---------- Anfitrión ---------- */
  crear(name) {
    if (!this.disponible()) return this.fallo({ type: "browser-incompatible" });
    this.salir(true);
    this.rol = "host"; this.name = name; this.estado = "conectando"; this.error = "";
    this.code = Array(4).fill(0).map(() => pick(LETRAS.split(""))).join("");
    this.R = { code: this.code, players: [{ id: "H", name, on: true, look: Cuenta.look() }], game: null, sel: "impostor", err: "" };
    const peer = this.peer = new Peer(PREFIJO + this.code, this.opciones());
    Voz.enganchar(peer);
    peer.on("open", () => { this.estado = "ok"; keepAwake(); this.broadcast(); });
    peer.on("error", e => {
      if (e.type === "unavailable-id") return this.crear(name);
      if (e.type === "peer-unavailable") return;
      this.fallo(e);
    });
    peer.on("disconnected", () => { try { peer.reconnect(); } catch {} });
    peer.on("connection", c => {
      c.on("data", m => this.recibir(c, m));
      c.on("close", () => this.cerrada(c));
      c.on("error", () => this.cerrada(c));
    });
    go("online");
  },

  recibir(c, m) {
    const R = this.R;
    if (!m || typeof m !== "object") return;
    if (m.t === "join") {
      const name = String(m.name || "").trim().slice(0, 16) || "Jugador";
      const cid = String(m.cid || c.peer).slice(0, 40);
      let p = R.players.find(x => x.id === cid);
      if (!p) {
        if (R.players.filter(x => x.on).length >= 12) { c.send({ t: "error", msg: "La sala está llena (máximo 12)." }); return; }
        let nombre = name, k = 2;
        while (R.players.some(x => x.name.toLowerCase() === nombre.toLowerCase())) nombre = `${name} ${k++}`;
        p = { id: cid, name: nombre, on: true };
        R.players.push(p);
      }
      p.on = true;
      p.look = Cuenta.lookValido(m.look);
      p.arena = Arena.validar(m.arena); p.torre = Torre.validarInfo(m.torre);
      this.conns[cid] = c; c.cid = cid;
      this.broadcast();
      if (R.chat && R.chat.length) c.send({ t: "chat", lista: R.chat });
      if (R.voz && Object.keys(R.voz).length) this.enviarVoz();
    } else if (m.t === "act" && c.cid) {
      this.hostAct(c.cid, m.a || {});
    }
  },

  cerrada(c) {
    if (!c.cid || this.conns[c.cid] !== c) return;
    delete this.conns[c.cid];
    const R = this.R, p = R.players.find(x => x.id === c.cid);
    if (!p) return;
    p.on = false;
    if (R.voz && R.voz[c.cid]) { delete R.voz[c.cid]; this.enviarVoz(); }
    if (!R.game) R.players = R.players.filter(x => x !== p);
    this.broadcast();
  },

  hostAct(pid, a) {
    const R = this.R;
    if (a.t === "chat") {
      const txt = String(a.txt || "").trim().slice(0, 200), quien = R.players.find(x => x.id === pid);
      if (!txt || !quien) return;
      R.chat = [...(R.chat || []), { id: (R.chatN = (R.chatN || 0) + 1), de: quien.name, txt, t: Date.now() }].slice(-60);
      this.enviarChat();
      return;
    }
    if (a.t === "voz") {
      const quien = R.players.find(x => x.id === pid);
      if (!quien) return;
      R.voz = R.voz || {};
      if (a.on && typeof a.peer === "string") R.voz[pid] = { peer: a.peer.slice(0, 64), mute: !!a.mute, name: quien.name };
      else delete R.voz[pid];
      this.enviarVoz();
      return;
    }
    if (a.t === "arenaPerfil") { const quien = R.players.find(x => x.id === pid); if (quien) { quien.arena = Arena.validar(a.p); if (a.torre) quien.torre = Torre.validarInfo(a.torre); } return; }
    try {
      if (!R.game) {
        if (pid !== "H") return;
        if (a.t === "sel") R.sel = a.game;
        if (a.t === "start") { R.err = (R.sel === "liars" ? Lie.empezarOn(R) : R.sel === "casos" ? Casos.empezarOn(R) : R.sel === "ajedrez" ? Ajedrez.empezarOn(R) : R.sel === "naval" ? Naval.empezarOn(R) : R.sel === "chinchon" ? Chin.empezarOn(R) : R.sel === "truco" ? Truco.empezarOn(R) : R.sel === "burako" ? Burako.empezarOn(R) : R.sel === "poker" ? Poker.empezarOn(R) : R.sel === "carrera" ? Carrera.empezarOn(R) : R.sel === "bingo" ? Bingo.empezarOn(R) : R.sel === "blackjack" ? Blackjack.empezarOn(R) : R.sel === "nave" ? Nave.empezarOn(R) : R.sel === "arena" ? Arena.empezarOn(R) : R.sel === "torre" ? Torre.empezarOn(R) : ImpOn.empezar(R)) || ""; }
        if (a.t === "kick") { R.players = R.players.filter(p => p.id !== a.id || p.id === "H"); const c = this.conns[a.id]; if (c) { c.send({ t: "error", msg: "El anfitrión te sacó de la sala." }); setTimeout(() => c.close(), 300); } }
      } else if (R.game === "impostor") ImpOn.act(R, pid, a);
      else if (R.game === "liars") Lie.actOn(R, pid, a);
      else if (R.game === "casos") Casos.actOn(R, pid, a);
      else if (R.game === "ajedrez") Ajedrez.actOn(R, pid, a);
      else if (R.game === "naval") Naval.actOn(R, pid, a);
      else if (R.game === "chinchon") Chin.actOn(R, pid, a);
      else if (R.game === "truco") Truco.actOn(R, pid, a);
      else if (R.game === "burako") Burako.actOn(R, pid, a);
      else if (R.game === "poker") Poker.actOn(R, pid, a);
      else if (R.game === "carrera") Carrera.actOn(R, pid, a);
      else if (R.game === "bingo") Bingo.actOn(R, pid, a);
      else if (R.game === "blackjack") Blackjack.actOn(R, pid, a);
      else if (R.game === "nave") Nave.actOn(R, pid, a);
      else if (R.game === "arena") Arena.actOn(R, pid, a);
    } catch (e) { console.error(e); }
    // En La Nave las posiciones se reparten con el reloj (10 por segundo), no con cada movimiento
    if (!((R.game === "nave" || R.game === "arena" || R.game === "carrera") && a.t === "pos")) this.broadcast();
  },

  viewFor(pid) {
    const v = this.vistaJuego(pid), R = this.R;
    v.looks = Object.fromEntries(R.players.filter(p => p.look).map(p => [p.name, p.look]));
    v.resultado = R.game === "impostor" ? ImpOn.resultado(R, pid) : R.game === "liars" ? Lie.resultado(R.lie, pid) : R.game === "casos" ? Casos.resultado(R.casos, pid, false) : R.game === "ajedrez" ? Ajedrez.resultado(R.aj, pid) : R.game === "naval" ? Naval.resultado(R.nav, pid) : R.game === "chinchon" ? Chin.resultado(R.chi, pid) : R.game === "truco" ? Truco.resultado(R.tru, pid) : R.game === "burako" ? Burako.resultado(R.bk, pid) : R.game === "poker" ? Poker.resultado(R.pk, pid) : R.game === "carrera" ? Carrera.resultado(R.car, pid) : R.game === "nave" ? Nave.resultado(R.nave, pid) : R.game === "arena" ? Arena.resultado(R.arena, pid) : null;
    return v;
  },

  vistaJuego(pid) {
    const R = this.R;
    if (R.game === "impostor") return ImpOn.view(R, pid);
    if (R.game === "liars") return { ...Lie.view(R.lie, pid), isHost: pid === "H" };
    if (R.game === "casos") return { ...Casos.view(R.casos, pid), isHost: pid === "H" };
    if (R.game === "ajedrez") return { ...Ajedrez.view(R.aj, pid), isHost: pid === "H" };
    if (R.game === "naval") return { ...Naval.view(R.nav, pid), isHost: pid === "H" };
    if (R.game === "chinchon") return { ...Chin.view(R.chi, pid), isHost: pid === "H" };
    if (R.game === "truco") return { ...Truco.view(R.tru, pid), isHost: pid === "H" };
    if (R.game === "burako") return { ...Burako.view(R.bk, pid), isHost: pid === "H" };
    if (R.game === "poker") return { ...Poker.view(R.pk, pid), isHost: pid === "H" };
    if (R.game === "carrera") return { ...Carrera.view(R.car, pid), isHost: pid === "H" };
    if (R.game === "bingo") return { ...Bingo.view(R.bin, pid), isHost: pid === "H" };
    if (R.game === "blackjack") return { ...Blackjack.view(R.bj, pid), isHost: pid === "H" };
    if (R.game === "nave") return { ...Nave.view(R.nave, pid), isHost: pid === "H" };
    if (R.game === "arena") return { ...Arena.view(R.arena, pid), isHost: pid === "H" };
    return {
      game: "lobby", code: R.code, lieMesa: S.lieCfg.mesa, chCpus: S.chCfg.cpus, trCfg: { ...S.trCfg }, bkCfg: { ...S.bkCfg }, pkCfg: { ...S.pkCfg }, carCfg: { ...S.carCfg }, biCfg: { valor: S.biCfg.valor, vel: S.biCfg.vel }, bjCfg: { ...S.bjCfg }, arEsc: S.arenaEsc || "ring", chCom: S.chCfg.comodines, ch89: S.chCfg.con89, caso: Casos.caso(S.casoId).titulo, casoCfg: { ...S.casoCfg }, isHost: pid === "H", me: pid, sel: R.sel, err: pid === "H" ? R.err : "",
      players: R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name, host: p.id === "H", torre: p.id === "H" ? Torre.info() : p.torre || null })),
      resumen: `${S.themes.length} tema${S.themes.length === 1 ? "" : "s"} · ${S.cfg.impostors} impostor${S.cfg.impostors > 1 ? "es" : ""}${S.cfg.hint ? " · con pista" : " · sin pista"}${S.cfg.minutes ? ` · ${S.cfg.minutes} min` : ""}${extras(S.cfg) ? ` · ${extras(S.cfg)} rol${extras(S.cfg) > 1 ? "es" : ""} extra` : ""}${S.cfg.allImp || S.cfg.noImp ? " · rondas sorpresa" : ""}`
    };
  },

  /* Lista del chat de voz: quién está y con qué id de PeerJS (cada teléfono se conecta con los demás) */
  enviarVoz() {
    const R = this.R, lista = Object.entries(R.voz || {}).filter(([pid]) => R.players.some(p => p.id === pid && p.on)).map(([pid, x]) => ({ pid, ...x }));
    for (const c of Object.values(this.conns)) { try { if (c.open) c.send({ t: "voz", lista }); } catch {} }
    Voz.recibir(lista);
  },

  enviarChat() {
    for (const c of Object.values(this.conns)) { try { if (c.open) c.send({ t: "chat", lista: this.R.chat }); } catch {} }
    Chat.recibir(this.R.chat);
  },

  broadcast() {
    if (this.rol !== "host") return;
    for (const [cid, c] of Object.entries(this.conns)) {
      try { if (c.open) c.send({ t: "view", v: this.viewFor(cid) }); } catch {}
    }
    if (S.screen === "online") render();
  },

  cfgCambiada() { this.broadcast(); },

  /* ---------- Invitado ---------- */
  unirse(code, name) {
    if (!this.disponible()) return this.fallo({ type: "browser-incompatible" });
    this.salir(true);
    this.rol = "guest"; this.code = code; this.name = name; this.estado = "conectando"; this.error = ""; this.view = null;
    store.set("nombre", name);
    const peer = this.peer = new Peer(this.opciones());
    Voz.enganchar(peer);
    peer.on("open", () => this.conectar());
    peer.on("error", e => this.fallo(e));
    peer.on("disconnected", () => { try { peer.reconnect(); } catch {} });
    go("online");
  },

  conectar() {
    const c = this.conn = this.peer.connect(PREFIJO + this.code, { reliable: true });
    c.on("open", () => { this.estado = "ok"; c.send({ t: "join", name: this.name, cid: miCid(), look: Cuenta.look(), arena: Arena.miPerfil(), torre: Torre.info() }); keepAwake(); if (Voz.activo) setTimeout(() => Voz.anunciar(), 300); });
    c.on("data", m => {
      if (m.t === "view") { this.view = m.v; if (S.screen === "online") render(); }
      if (m.t === "chat") Chat.recibir(m.lista || []);
      if (m.t === "voz") Voz.recibir(m.lista || []);
      if (m.t === "error") { this.estado = "error"; this.error = m.msg; render(); }
    });
    c.on("close", () => { if (this.rol === "guest" && this.estado !== "error") { this.estado = "perdida"; render(); } });
  },

  reconectar() {
    if (this.rol !== "guest") return;
    this.estado = "conectando"; render();
    if (!this.peer || this.peer.destroyed) return this.unirse(this.code, this.name);
    if (this.peer.disconnected) try { this.peer.reconnect(); } catch {}
    this.conectar();
  },

  send(a) {
    if (this.rol === "host") return this.hostAct("H", a);
    try { if (this.conn && this.conn.open) this.conn.send({ t: "act", a }); else this.reconectar(); } catch {}
  },

  salir(silencio) {
    if (typeof Voz !== "undefined") { Voz.salir(); Voz.lista = []; }
    try { this.peer && this.peer.destroy(); } catch {}
    Object.assign(this, { rol: null, peer: null, conn: null, view: null, R: null, conns: {}, estado: "", error: "" });
    if (typeof Chat !== "undefined") Chat.pintar();
    S.online = false;
    if (!silencio) go("home");
  },

  cabecera() {
    const n = this.rol === "host" ? this.cantidad() : (this.view && this.view.players ? this.view.players.length : 0);
    return `<header class="top"><button class="logo" id="home" aria-label="Volver a la sala"><img src="img/icono.svg" alt="" width="30" height="30">Mesa <span>Loca</span></button>
      <div class="sala-chip"><span>Sala <b>${esc(this.code || "")}</b></span><span>${n} 👥</span><button id="salirSala" class="linkish">Salir</button></div></header>`;
  },

  enlace() { return `${location.origin}${location.pathname}?sala=${this.code}`; }
};

document.addEventListener("click", e => {
  if (e.target.closest("#salirSala")) { UI.confirmSalir = true; render(); }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (Net.rol) keepAwake();
  if (Net.rol === "guest" && (!Net.conn || !Net.conn.open) && Net.estado !== "error") Net.reconectar();
});

/* ---------- Pantallas online ---------- */
const codigoUrl = () => ((/[?&]sala=([A-Za-z]{4})/.exec(location.search) || [])[1] || "").toUpperCase();

PANTALLAS.onCrear = () => {
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>Crear sala</h2><p class="sub">Tu teléfono será el anfitrión: guarda la partida y elige el juego. No lo bloquees ni cierres la página mientras juegan.</p></div>
    <form class="panel" id="f">
      <label class="label" for="nm">Tu nombre</label>
      <input class="campo" id="nm" maxlength="16" autocomplete="off" value="${esc(BD.sesion() ? BD.sesion().nombre : store.get("nombre", ""))}" placeholder="Cómo te verán los demás">
      <button class="btn" type="submit">Crear sala</button>
    </form>
    <button class="btn ghost" id="back">Atrás</button>
  </section>`;
  byId("f").onsubmit = e => { e.preventDefault(); const n = byId("nm").value.trim(); if (!n) return byId("nm").focus(); store.set("nombre", n); Net.crear(n); };
  on("back", () => go("home"));
};

PANTALLAS.onUnirme = () => {
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>Unirme a una sala</h2><p class="sub">Pídele el código de 4 letras a quien creó la sala.</p></div>
    <form class="panel" id="f">
      <label class="label" for="cd">Código de la sala</label>
      <input class="campo codigo" id="cd" maxlength="4" autocomplete="off" autocapitalize="characters" value="${esc(codigoUrl())}" placeholder="ABCD">
      <label class="label" for="nm">Tu nombre</label>
      <input class="campo" id="nm" maxlength="16" autocomplete="off" value="${esc(BD.sesion() ? BD.sesion().nombre : store.get("nombre", ""))}" placeholder="Cómo te verán los demás">
      <p class="warn" id="msg" hidden></p>
      <button class="btn" type="submit">Entrar</button>
    </form>
    <button class="btn ghost" id="back">Atrás</button>
  </section>`;
  byId("f").onsubmit = e => {
    e.preventDefault();
    const c = byId("cd").value.trim().toUpperCase(), n = byId("nm").value.trim(), msg = byId("msg");
    if (!/^[A-Z]{4}$/.test(c)) { msg.hidden = false; msg.textContent = "El código tiene 4 letras."; return; }
    if (!n) { msg.hidden = false; msg.textContent = "Escribe tu nombre."; return; }
    Net.unirse(c, n);
  };
  on("back", () => go("home"));
};

PANTALLAS.online = () => {
  if (UI.confirmSalir) {
    app.innerHTML = `${Net.cabecera()}<section class="stage">${personaje("#748ffc", "duda", 110)}<h2>¿Salir de la sala?</h2>
      <p class="sub">${Net.rol === "host" ? "Eres el anfitrión: si sales, la sala se cierra para todos." : "Puedes volver a entrar con el mismo código."}</p>
      <div class="row"><button class="btn ghost" id="noS">Quedarme</button><button class="btn danger" id="siS">Salir</button></div></section>`;
    on("noS", () => { UI.confirmSalir = false; render(); });
    on("siS", () => { UI.confirmSalir = false; Net.salir(); });
    return;
  }
  if (!Net.rol) return go("home");
  if (Net.estado === "error") {
    app.innerHTML = `${head(0)}<section class="stage">${personaje("#ff6b6b", "muerto", 110)}<h2>No se pudo conectar</h2><p class="sub">${esc(Net.error)}</p>
      <button class="btn" id="retry">Probar otra vez</button><button class="btn ghost" id="inicio">Inicio</button></section>`;
    on("retry", () => Net.rol === "host" ? Net.crear(Net.name) : Net.unirse(Net.code, Net.name));
    on("inicio", () => Net.salir());
    return;
  }
  if (Net.estado === "perdida") {
    app.innerHTML = `${Net.cabecera()}<section class="stage">${personaje("#fcc419", "duda", 110)}<h2>Se cortó la conexión</h2><p class="sub">Tu lugar en la sala se guarda. Vuelve a conectarte para seguir.</p>
      <button class="btn" id="rc">Reconectar</button></section>`;
    on("rc", () => Net.reconectar());
    return;
  }
  const v = Net.rol === "host" ? (Net.estado === "ok" ? Net.viewFor("H") : null) : Net.view;
  if (!v) {
    app.innerHTML = `${head(0)}<section class="stage"><div class="cargando">${grupoPortada()}</div><h2>Conectando…</h2><p class="sub">${Net.rol === "host" ? "Creando la sala." : `Entrando a la sala ${esc(Net.code)}.`}</p>
      <button class="linkish" id="cancel">Cancelar</button></section>`;
    on("cancel", () => Net.salir());
    return;
  }
  UI.v = v;
  Turno.revisar(v);
  Cuenta.prepararLooks();
  const lista = v.players || [];
  fijarColores(lista.map(p => p.name));
  const key = `${v.game}-${v.phase || ""}-${v.ronda || ""}`;
  if (key !== UI.fase) { UI.fase = key; UI.ver = false; UI.sel = []; }
  if (v.game === "impostor") return ImpOn.render(v);
  if (v.game === "liars") return Lie.render(v, a => Net.send(a), { local: false, isHost: v.isHost });
  const enviar = a => Net.send(a), op = { local: false, isHost: v.isHost };
  if (v.game === "ajedrez") return Ajedrez.render(v, enviar, op);
  if (v.game === "naval") return Naval.render(v, enviar, op);
  if (v.game === "chinchon") return Chin.render(v, enviar, op);
  if (v.game === "truco") return Truco.render(v, enviar, op);
  if (v.game === "burako") return Burako.render(v, enviar, op);
  if (v.game === "poker") return Poker.render(v, enviar, op);
  if (v.game === "carrera") return Carrera.render(v, enviar, op);
  if (UI.cr) Carrera.parar();
  if (v.game === "bingo") return Bingo.render(v, enviar, op);
  if (v.game === "blackjack") return Blackjack.render(v, enviar, op);
  if (UI.bj) { UI.bj = null; UI.bjEnJuego = null; UI.timbaPend = 0; Blackjack.pendientes(); }
  if (v.game === "nave") return Nave.render(v, enviar, op);
  if (v.game === "arena") return Arena.render(v, enviar, op);
  if (UI.arena) Arena.parar();
  if (document.body.classList.contains("en-nave")) Nave.parar();
  if (v.game === "casos") { if (v.phase === "intro") UI.vistas = new Set(); marcarResuelto(v); return Casos.render(v, a => Net.send(a), { local: false, isHost: v.isHost }); }
  renderLobby(v);
};

function renderLobby(v) {
  const H = v.isHost;
  const juegos = {
    impostor: ["El Impostor", personaje("#ff4d63", "imp", 46), "3 o más"],
    liars: ["Mentiroso", `<span class="cartas-mini">${carta("A")}${carta("J")}</span>`, "2 a 8"],
    casos: ["Detectives", personaje("#e8e8e8", "civ", 46, ["sombrero", "lupa"]), "2 o más"],
    chinchon: ["Chinchón", `<span class="ce-mini">${Chin.carta("O1")}${Chin.carta("E7")}</span>`, "2 a 5"],
    carrera: ["Carrera Loca", `<span class="nave-mini">🏁</span>`, "1 o más"],
    poker: ["Póker", `<span class="pk-mini">${Poker.carta("As")}${Poker.carta("Kh")}</span>`, "2 a 8"],
    burako: ["Burako", `<span class="bk-mini">${Burako.ficha("R07a")}${Burako.ficha("J00a")}</span>`, "2 o 4"],
    truco: ["Truco", `<span class="tr-mini">${Chin.carta("E1")}${Chin.carta("B1")}</span>`, "2 a 6"],
    bingo: ["Bingo", `<span class="nave-mini">🎱</span>`, "1 o más"],
    blackjack: ["Blackjack 21", `<span class="pk-mini">${Poker.carta("Ah")}${Poker.carta("Ks")}</span>`, "1 a 7"],
    naval: ["Batalla naval", `<span class="naval-mini">${"<i></i>".repeat(9)}</span>`, "2 jugadores"],
    nave: ["La Nave", `<span class="nave-mini">🚀</span>`, "3 a 10"],
    arena: ["Arena", `<span class="nave-mini">⚔️</span>`, "2 a 8"],
    torre: ["Torre de hordas", `<span class="nave-mini">🗼</span>`, "1 a 4"],
    ajedrez: ["Ajedrez", `<span class="aj-mini">${AJ.pieza("K")}${AJ.pieza("n")}</span>`, "2 jugadores"]
  };
  app.innerHTML = `${Net.cabecera()}
  <section class="screen">
    <div class="panel center codigo-box">
      <span class="label">Código de la sala</span>
      <div class="codigo-big">${esc(v.code)}</div>
      <p class="sub" style="margin:0">Los demás entran con este código en "Jugar online → Unirme".</p>
      ${Social.disponible() ? `<button class="btn" id="invitar">📨 Invitar amigos</button>` : ""}
      <div class="row"><button class="btn ghost" id="copiar">Copiar enlace</button>${navigator.share ? `<button class="btn ghost" id="compartir">Compartir</button>` : ""}</div>
      <input class="campo enlace" id="lnk" readonly value="${esc(Net.enlace())}" aria-label="Enlace de la sala">
    </div>
    <div class="panel">
      <span class="label">${v.players.length} en la sala</span>
      <ul class="players">${v.players.map(p => `<li>${avatar(p.name, 38)}<span class="name">${esc(p.name)}${p.id === v.me ? " (tú)" : ""}</span>${p.host ? `<span class="badge">Anfitrión</span>` : H ? `<button class="x" data-kick="${esc(p.id)}" aria-label="Sacar a ${esc(p.name)}">×</button>` : ""}</li>`).join("")}</ul>
    </div>
    <div class="panel">
      <span class="label">Juego</span>
      <div class="elige">${Object.entries(juegos).map(([k, j]) => `<button class="elige-j" data-g="${k}" aria-pressed="${v.sel === k}" ${H ? "" : "disabled"}>${j[1]}<b>${j[0]}</b><small>${j[2]}</small></button>`).join("")}</div>
      ${v.sel === "impostor" ? `<p class="summary">${esc(v.resumen)}</p>${H ? `<button class="btn ghost" id="ajustes">Ajustar temas y reglas</button>` : ""}`
        : v.sel === "casos" ? `<p class="summary">Caso: <b>${esc(v.caso)}</b> · ${v.casoCfg.min ? v.casoCfg.min + " min por acto" : "sin cronómetro"}${v.casoCfg.soplon ? " · con soplón" : ""}</p>${H ? `<button class="btn ghost" id="ajCaso">Elegir caso</button>` : ""}`
        : v.sel === "chinchon" ? `<p class="summary">De 2 a 5 jugadores${v.chCpus ? ` · ${Math.min(v.chCpus, 5 - v.players.length)} compu${Math.min(v.chCpus, 5 - v.players.length) === 1 ? "" : "s"}` : ""} · ${v.chCom ? "con 2 comodines" : "sin comodines"} · ${v.ch89 ? "baraja de 48 (con 8 y 9)" : "baraja de 40 (sin 8 ni 9)"} · se pierde al pasar de 100.</p>${H ? `<span class="label">Compus</span><div class="seg">${[0, 1, 2, 3].map(k => `<button aria-pressed="${v.chCpus === k}" data-chc="${k}">${k ? k : "Sin"}</button>`).join("")}</div><div class="opt"><div class="txt"><b>Con comodines</b></div><button class="switch" role="switch" aria-checked="${v.chCom}" id="chComOn" aria-label="Con comodines"></button></div><div class="opt"><div class="txt"><b>Con 8 y 9</b></div><button class="switch" role="switch" aria-checked="${v.ch89}" id="ch89On" aria-label="Con 8 y 9"></button></div>` : ""}`
        : v.sel === "truco" ? (() => { const c = v.trCfg, n = v.players.length, tot = Math.max(n + n % 2, c.n); return `<p class="summary">${tot > 6 ? "El truco es de 2 a 6 jugadores." : `${tot / 2} contra ${tot / 2}${tot > n ? ` (${tot - n} compu${tot - n > 1 ? "s" : ""} completa${tot - n > 1 ? "n" : ""} la mesa)` : ""} · a ${c.a} puntos · sin flor. Los equipos se sientan alternados en el orden de la sala.`}</p>
          ${H ? `<span class="label">Mesa mínima</span><div class="seg">${[[2, "1 vs 1"], [4, "2 vs 2"], [6, "3 vs 3"]].map(([k, t]) => `<button aria-pressed="${c.n === k}" data-trn="${k}">${t}</button>`).join("")}</div>
          <div class="seg">${[15, 30].map(k => `<button aria-pressed="${c.a === k}" data-tra="${k}">A ${k}</button>`).join("")}</div>${tot > n && n >= 2 ? `<div class="opt"><div class="txt"><b>Personas en el mismo equipo</b></div><button class="switch" role="switch" aria-checked="${c.juntos}" id="trJuntos" aria-label="Personas en el mismo equipo"></button></div>` : ""}` : ""}`; })()
        : v.sel === "carrera" ? (() => { const c = v.carCfg, n = v.players.length, bots = Math.max(0, Math.min(7, c.mesa - n)); return `<p class="summary">Todos a la vez por la misma pista de obstáculos: gana el primero en llegar.${bots ? ` Corren ${bots} bot${bots > 1 ? "s" : ""} también.` : ""}</p>
          ${H ? `<span class="label">Completar con bots hasta</span><div class="seg">${[[0, "Sin bots"], [4, "4"], [6, "6"], [8, "8"]].map(([k, t]) => `<button aria-pressed="${c.mesa === k}" data-crm="${k}">${t}</button>`).join("")}</div>` : ""}`; })()
        : v.sel === "poker" ? (() => { const c = v.pkCfg, n = v.players.length, tot = Math.max(n, Math.max(2, c.mesa)); return `<p class="summary">${n > 8 ? "El póker es de hasta 8 jugadores." : `Texas Hold'em en torneo · ${tot} en la mesa${tot > n ? ` (${tot - n} bot${tot - n > 1 ? "s" : ""})` : ""} · ${c.fichas} fichas cada uno. Las fichas son de la mesa, no las monedas.`}</p>
          ${H ? `<span class="label">Mesa de</span><div class="seg">${[2, 4, 6, 8].map(k => `<button aria-pressed="${c.mesa === k}" data-pkm="${k}">${k}</button>`).join("")}</div>
          <div class="seg">${[["facil", "Bots fáciles"], ["normal", "Normales"], ["dificil", "Difíciles"]].map(([k, t]) => `<button aria-pressed="${c.nivel === k}" data-pkn="${k}">${t}</button>`).join("")}</div>` : ""}`; })()
        : v.sel === "burako" ? (() => { const c = v.bkCfg, n = v.players.length, tot = n > 2 || c.n === 4 ? 4 : 2; return `<p class="summary">${n > 4 ? "El burako es de 2 o 4 jugadores." : `${tot === 4 ? "En parejas (2 vs 2)" : "1 contra 1"}${tot > n ? ` · ${tot - n} compu${tot - n > 1 ? "s" : ""} completa${tot - n > 1 ? "n" : ""} la mesa` : ""} · ${BK.METAS.find(m => m[0] === c.meta)[1].toLowerCase()}. Las parejas se sientan alternadas en el orden de la sala.`}</p>
          ${H ? `<div class="seg">${[[2, "1 vs 1"], [4, "Parejas"]].map(([k, t]) => `<button aria-pressed="${c.n === k}" data-bkn="${k}">${t}</button>`).join("")}</div>
          <div class="seg">${BK.METAS.map(([k, t]) => `<button aria-pressed="${c.meta === k}" data-bkm="${k}">${t}</button>`).join("")}</div>${tot > n && n >= 2 ? `<div class="opt"><div class="txt"><b>Personas en la misma pareja</b></div><button class="switch" role="switch" aria-checked="${c.juntos}" id="bkJuntos" aria-label="Personas en la misma pareja"></button></div>` : ""}` : ""}`; })()
        : v.sel === "bingo" ? `<p class="summary">${v.biCfg.valor ? `Cartón a <b>${v.biCfg.valor} 🪙</b>, hasta 3 por persona. Línea se lleva el 30% del pozo y bingo el 70%. Cada uno paga con las monedas de su perfil.` : "Bingo amistoso: cartones gratis, sin premio en monedas."}</p>
          ${H ? `<span class="label">Valor del cartón</span><div class="seg">${[0, ...BI.VALORES].map(x => `<button aria-pressed="${v.biCfg.valor === x}" data-biv="${x}">${x ? x + " 🪙" : "Gratis"}</button>`).join("")}</div>
          <span class="label">Velocidad</span><div class="seg">${BI.VELOCIDADES.map(([ms, t]) => `<button aria-pressed="${v.biCfg.vel === ms}" data-biz="${ms}">${t}</button>`).join("")}</div>` : ""}`
        : v.sel === "blackjack" ? (() => { const c = v.bjCfg, n = v.players.length, bots = Math.max(0, Math.min(c.bots, 7 - n)); return `<p class="summary">${n > 7 ? "La mesa de blackjack es de hasta 7." : `Todos contra la banca${bots ? ` · ${bots} bot${bots > 1 ? "s" : ""} en la mesa` : ""}. ${c.monedas ? "Cada uno apuesta las monedas de su perfil." : `Mesa amistosa: ${BJ.FICHAS_MESA} fichas para cada uno, sin monedas.`}`}</p>
          ${H ? `<div class="seg">${[[true, "Con monedas 🪙"], [false, "Amistosa"]].map(([k, t]) => `<button aria-pressed="${c.monedas === k}" data-bjm="${k}">${t}</button>`).join("")}</div>
          <span class="label">Bots en la mesa</span><div class="seg">${[0, 1, 2, 3].map(k => `<button aria-pressed="${c.bots === k}" data-bjb="${k}">${k ? k : "Ninguno"}</button>`).join("")}</div>` : ""}`; })()
        : v.sel === "torre" ? (() => { const ps = v.players.slice(0, 4), base = Math.min(...ps.map(p => (p.torre && p.torre.base) || 1));
            return `<p class="summary">${v.players.length > 4 ? "La torre en grupo es de hasta 4. " : ""}Suben juntos contra olas de monstruos (más y más fuertes cuantos más son). Arrancan en el <b>piso ${base}</b>, el guardado más bajo del grupo. El que cae vuelve en el piso siguiente; el intento termina cuando caen todos. Cada uno usa una de sus vidas del día y guarda su propio progreso; cada 5 pisos se recuperan.</p>
            <ul class="to-lobby">${ps.map(p => `<li><b>${esc(p.name)}</b><span>${p.torre ? `🚩 piso ${p.torre.base} · ${p.torre.quedan ? `❤️ ${p.torre.quedan} vida${p.torre.quedan > 1 ? "s" : ""}` : "sin vidas (juega sin premio)"}` : "sin perfil (juega sin premio)"}</span></li>`).join("")}</ul>
            ${Heroes.selector()}`; })()
        : v.sel === "arena" ? `<p class="summary">Todos contra todos: gana el último en pie. Cada uno pelea con su héroe y su equipo (se arman en Inicio → Arena). Cambia el ELO y da monedas.</p>
          ${Heroes.selector()}
          <div class="chips-j">${Object.entries(AR.ESCENARIOS).map(([k, E]) => `<button class="chip-j ${v.arEsc === k ? "on" : ""}" ${H ? `data-aresc="${k}"` : "disabled"}>${E.ic} ${E.nombre}</button>`).join("")}</div>`
        : v.sel === "nave" ? `<p class="summary">Muévanse por la nave, hagan tareas y descubran al impostor. 1 impostor (2 desde 7 jugadores). Usen el chat 💬 en las reuniones.</p>`
        : v.sel === "ajedrez" || v.sel === "naval" ? `<p class="summary">Juegan los dos primeros de la sala${v.sel === "ajedrez" ? " (los colores se sortean)" : ""}. Los demás miran la partida.</p>`
        : v.sel === "liars" ? `<p class="summary">5 cartas por ronda, 1 bala en 6 recámaras por jugador.${Math.max(2, v.lieMesa) > v.players.length ? ` Se suman ${Math.min(8, Math.max(2, v.lieMesa)) - v.players.length} bot${Math.min(8, Math.max(2, v.lieMesa)) - v.players.length > 1 ? "s" : ""} para completar la mesa.` : ""}</p>
          ${H ? `<span class="label">Completar con bots hasta</span><div class="seg">${[[0, "Sin bots"], [3, "3"], [4, "4"], [6, "6"]].map(([k, t]) => `<button aria-pressed="${v.lieMesa === k}" data-liem="${k}">${t}</button>`).join("")}</div>` : ""}`
        : `<p class="summary">5 cartas por ronda, 1 bala en 6 recámaras por jugador.</p>`}
    </div>
    ${v.err ? `<p class="warn">${esc(v.err)}</p>` : ""}
    ${H ? `<button class="btn" id="empezar">Empezar partida</button>` : `<p class="sub center">Esperando a que el anfitrión empiece la partida…</p>`}
  </section>`;
  on("copiar", async () => {
    const inp = byId("lnk");
    try { await navigator.clipboard.writeText(inp.value); byId("copiar").textContent = "Enlace copiado"; }
    catch { inp.focus(); inp.select(); byId("copiar").textContent = "Cópialo de abajo"; }
  });
  on("compartir", () => { navigator.share({ title: "Mesa Loca", text: `Únete a mi sala de Mesa Loca: ${v.code}`, url: Net.enlace() }).catch(() => {}); });
  app.querySelectorAll("[data-g]").forEach(b => b.onclick = () => Net.send({ t: "sel", game: b.dataset.g }));
  app.querySelectorAll("[data-kick]").forEach(b => b.onclick = () => Net.send({ t: "kick", id: b.dataset.kick }));
  on("ajustes", () => { S.online = true; go("themes"); });
  on("ajCaso", () => { S.online = true; go("casoSel"); });
  on("chComOn", () => { S.chCfg.comodines = !S.chCfg.comodines; store.set("chCfg", S.chCfg); Net.cfgCambiada(); });
  on("ch89On", () => { S.chCfg.con89 = !S.chCfg.con89; store.set("chCfg", S.chCfg); Net.cfgCambiada(); });
  on("empezar", () => Net.send({ t: "start" }));
  app.querySelectorAll("[data-trn]").forEach(b => b.onclick = () => { S.trCfg.n = +b.dataset.trn; store.set("trCfg", S.trCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-bkn]").forEach(b => b.onclick = () => { S.bkCfg.n = +b.dataset.bkn; store.set("bkCfg", S.bkCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-liem]").forEach(b => b.onclick = () => { S.lieCfg.mesa = +b.dataset.liem; store.set("lieCfg", S.lieCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-chc]").forEach(b => b.onclick = () => { S.chCfg.cpus = +b.dataset.chc; store.set("chCfg", S.chCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-crm]").forEach(b => b.onclick = () => { S.carCfg.mesa = +b.dataset.crm; store.set("carCfg", S.carCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-pkm]").forEach(b => b.onclick = () => { S.pkCfg.mesa = +b.dataset.pkm; store.set("pkCfg", S.pkCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-pkn]").forEach(b => b.onclick = () => { S.pkCfg.nivel = b.dataset.pkn; store.set("pkCfg", S.pkCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-bkm]").forEach(b => b.onclick = () => { S.bkCfg.meta = +b.dataset.bkm; store.set("bkCfg", S.bkCfg); Net.cfgCambiada(); });
  on("bkJuntos", () => { S.bkCfg.juntos = !S.bkCfg.juntos; store.set("bkCfg", S.bkCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-biv]").forEach(b => b.onclick = () => { S.biCfg.valor = +b.dataset.biv; store.set("biCfg", S.biCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-biz]").forEach(b => b.onclick = () => { S.biCfg.vel = +b.dataset.biz; store.set("biCfg", S.biCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-bjm]").forEach(b => b.onclick = () => { S.bjCfg.monedas = b.dataset.bjm === "true"; store.set("bjCfg", S.bjCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-bjb]").forEach(b => b.onclick = () => { S.bjCfg.bots = +b.dataset.bjb; store.set("bjCfg", S.bjCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-tra]").forEach(b => b.onclick = () => { S.trCfg.a = +b.dataset.tra; store.set("trCfg", S.trCfg); Net.cfgCambiada(); });
  on("trJuntos", () => { S.trCfg.juntos = !S.trCfg.juntos; store.set("trCfg", S.trCfg); Net.cfgCambiada(); });
  app.querySelectorAll("[data-aresc]").forEach(b => b.onclick = () => { S.arenaEsc = b.dataset.aresc; Net.cfgCambiada(); });
  Heroes.conectarSelector();
  if (!H && (v.sel === "arena" || v.sel === "torre") && UI.arenaPerfil !== v.code + v.sel) { UI.arenaPerfil = v.code + v.sel; Net.send({ t: "arenaPerfil", p: Arena.miPerfil(), torre: Torre.info() }); }
  on("invitar", () => invitarAmigos());
}

/* ---------- Aviso de "es tu turno" en los juegos por turnos online ----------
   Cartel fijo arriba, borde de la pantalla que brilla, sonido, vibración y el título de la pestaña. */
const Turno = {
  previo: false, titulo: null,
  estado(v) {
    if (!v) return null;
    if (v.game === "naval" && v.fase === "juego" && v.yo >= 0) return { mio: v.turno === v.yo, quien: v.jug[v.turno].name, que: "disparar" };
    if (v.game === "chinchon" && (v.fase === "robar" || v.fase === "tirar") && v.yo >= 0) return { mio: v.turno === v.yo && !(v.jug[v.yo] || {}).fuera, quien: v.jug[v.turno].name, que: v.fase === "robar" ? "robar una carta" : "tirar una carta" };
    if (v.game === "poker" && v.turno >= 0 && v.yo >= 0 && !v.jug[v.yo].fuera) return { mio: v.turno === v.yo, quien: v.jug[v.turno].name.replace(/^🤖\s*/, ""), que: "apostar" };
    if (v.game === "blackjack" && v.fase === "juego" && v.turno && v.yo >= 0 && v.jug[v.yo].manos.length) return { mio: v.turno.i === v.yo, quien: v.jug[v.turno.i].name.replace(/^🤖\s*/, ""), que: "jugar tu mano" };
    if (v.game === "burako" && (v.fase === "robar" || v.fase === "jugar") && v.yo >= 0) return { mio: v.turno === v.yo, quien: v.jug[v.turno].name.replace(/^🤖\s*/, ""), que: v.fase === "robar" ? "robar" : "bajar o tirar" };
    if (v.game === "truco" && v.fase === "juego" && v.yo >= 0) return { mio: v.actor === v.yo, quien: v.jug[v.actor].name.replace(/^🤖\s*/, ""), que: v.pend && v.pend.resp === v.yo ? "responder" : "jugar" };
    if (v.game === "ajedrez" && v.s && v.miColor && !Ajedrez.terminado(v.s)) { const t = v.s.pos.turno; return { mio: v.miColor === t, quien: v.s.jug[t === "w" ? 0 : 1].name, que: "mover" }; }
    if (v.game === "liars") {
      if (v.phase === "turn") return { mio: v.turnId === v.me, quien: v.turnName, que: "jugar tus cartas" };
      if (v.phase === "reveal" && v.rev) return { mio: v.rev.shooterId === v.me, quien: v.rev.shooter, que: "gatillar" };
    }
    return null;
  },
  pill() {
    let p = document.getElementById("turnoPill");
    if (!p) { p = document.createElement("div"); p.id = "turnoPill"; p.className = "turno-pill"; p.setAttribute("role", "status"); p.setAttribute("aria-live", "polite"); document.body.appendChild(p); }
    return p;
  },
  revisar(v) {
    const e = this.estado(v), mio = !!(e && e.mio), p = this.pill();
    const porTurnos = !!(v && ["naval", "chinchon", "ajedrez", "liars", "truco", "burako", "poker", "blackjack"].includes(v.game));
    document.body.classList.toggle("mi-turno", mio); document.body.classList.toggle("con-turno", !!e || porTurnos);
    p.hidden = !e;
    if (e) { p.classList.toggle("mio", mio); p.innerHTML = mio ? `🎯 <b>¡Es tu turno!</b> <small>Te toca ${esc(e.que)}</small>` : `⏳ Turno de <b>${esc(e.quien)}</b>`; }
    if (mio && !this.previo) {
      if (typeof Sonido !== "undefined") Sonido.sfx("turno");
      try { navigator.vibrate && navigator.vibrate([90, 60, 90]); } catch {}
      p.classList.remove("salta"); void p.offsetWidth; p.classList.add("salta");
    }
    if (mio && !this.titulo) { this.titulo = document.title; document.title = "🎯 ¡Tu turno! · Mesa Loca"; }
    if (!mio && this.titulo) { document.title = this.titulo; this.titulo = null; }
    this.previo = mio;
  }
};
