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
      this.conns[cid] = c; c.cid = cid;
      this.broadcast();
      if (R.chat && R.chat.length) c.send({ t: "chat", lista: R.chat });
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
    try {
      if (!R.game) {
        if (pid !== "H") return;
        if (a.t === "sel") R.sel = a.game;
        if (a.t === "start") { R.err = (R.sel === "liars" ? Lie.empezarOn(R) : R.sel === "casos" ? Casos.empezarOn(R) : R.sel === "ajedrez" ? Ajedrez.empezarOn(R) : R.sel === "naval" ? Naval.empezarOn(R) : R.sel === "chinchon" ? Chin.empezarOn(R) : R.sel === "nave" ? Nave.empezarOn(R) : ImpOn.empezar(R)) || ""; }
        if (a.t === "kick") { R.players = R.players.filter(p => p.id !== a.id || p.id === "H"); const c = this.conns[a.id]; if (c) { c.send({ t: "error", msg: "El anfitrión te sacó de la sala." }); setTimeout(() => c.close(), 300); } }
      } else if (R.game === "impostor") ImpOn.act(R, pid, a);
      else if (R.game === "liars") Lie.actOn(R, pid, a);
      else if (R.game === "casos") Casos.actOn(R, pid, a);
      else if (R.game === "ajedrez") Ajedrez.actOn(R, pid, a);
      else if (R.game === "naval") Naval.actOn(R, pid, a);
      else if (R.game === "chinchon") Chin.actOn(R, pid, a);
      else if (R.game === "nave") Nave.actOn(R, pid, a);
    } catch (e) { console.error(e); }
    // En La Nave las posiciones se reparten con el reloj (10 por segundo), no con cada movimiento
    if (!(R.game === "nave" && a.t === "pos")) this.broadcast();
  },

  viewFor(pid) {
    const v = this.vistaJuego(pid), R = this.R;
    v.looks = Object.fromEntries(R.players.filter(p => p.look).map(p => [p.name, p.look]));
    v.resultado = R.game === "impostor" ? ImpOn.resultado(R, pid) : R.game === "liars" ? Lie.resultado(R.lie, pid) : R.game === "casos" ? Casos.resultado(R.casos, pid, false) : R.game === "ajedrez" ? Ajedrez.resultado(R.aj, pid) : R.game === "naval" ? Naval.resultado(R.nav, pid) : R.game === "chinchon" ? Chin.resultado(R.chi, pid) : R.game === "nave" ? Nave.resultado(R.nave, pid) : null;
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
    if (R.game === "nave") return { ...Nave.view(R.nave, pid), isHost: pid === "H" };
    return {
      game: "lobby", code: R.code, chCom: S.chCfg.comodines, caso: Casos.caso(S.casoId).titulo, casoCfg: { ...S.casoCfg }, isHost: pid === "H", me: pid, sel: R.sel, err: pid === "H" ? R.err : "",
      players: R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name, host: p.id === "H" })),
      resumen: `${S.themes.length} tema${S.themes.length === 1 ? "" : "s"} · ${S.cfg.impostors} impostor${S.cfg.impostors > 1 ? "es" : ""}${S.cfg.hint ? " · con pista" : " · sin pista"}${S.cfg.minutes ? ` · ${S.cfg.minutes} min` : ""}${extras(S.cfg) ? ` · ${extras(S.cfg)} rol${extras(S.cfg) > 1 ? "es" : ""} extra` : ""}${S.cfg.allImp || S.cfg.noImp ? " · rondas sorpresa" : ""}`
    };
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
    peer.on("open", () => this.conectar());
    peer.on("error", e => this.fallo(e));
    peer.on("disconnected", () => { try { peer.reconnect(); } catch {} });
    go("online");
  },

  conectar() {
    const c = this.conn = this.peer.connect(PREFIJO + this.code, { reliable: true });
    c.on("open", () => { this.estado = "ok"; c.send({ t: "join", name: this.name, cid: miCid(), look: Cuenta.look() }); keepAwake(); });
    c.on("data", m => {
      if (m.t === "view") { this.view = m.v; if (S.screen === "online") render(); }
      if (m.t === "chat") Chat.recibir(m.lista || []);
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
    try { this.peer && this.peer.destroy(); } catch {}
    Object.assign(this, { rol: null, peer: null, conn: null, view: null, R: null, conns: {}, estado: "", error: "" });
    if (typeof Chat !== "undefined") Chat.pintar();
    S.online = false;
    if (!silencio) go("home");
  },

  cabecera() {
    const n = this.rol === "host" ? this.cantidad() : (this.view && this.view.players ? this.view.players.length : 0);
    return `<header class="top"><button class="logo" id="home" aria-label="Volver a la sala">El <span>Impostor</span></button>
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
  if (v.game === "nave") return Nave.render(v, enviar, op);
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
    naval: ["Batalla naval", `<span class="naval-mini">${"<i></i>".repeat(9)}</span>`, "2 jugadores"],
    nave: ["La Nave", `<span class="nave-mini">🚀</span>`, "3 a 10"],
    ajedrez: ["Ajedrez", `<span class="aj-mini"><span class="pieza w">♚</span><span class="pieza b">♞</span></span>`, "2 jugadores"]
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
        : v.sel === "chinchon" ? `<p class="summary">De 2 a 5 jugadores · ${v.chCom ? "con 2 comodines" : "sin comodines"} · se pierde al pasar de 100.</p>${H ? `<div class="opt"><div class="txt"><b>Con comodines</b></div><button class="switch" role="switch" aria-checked="${v.chCom}" id="chComOn" aria-label="Con comodines"></button></div>` : ""}`
        : v.sel === "nave" ? `<p class="summary">Muévanse por la nave, hagan tareas y descubran al impostor. 1 impostor (2 desde 7 jugadores). Usen el chat 💬 en las reuniones.</p>`
        : v.sel === "ajedrez" || v.sel === "naval" ? `<p class="summary">Juegan los dos primeros de la sala${v.sel === "ajedrez" ? " (los colores se sortean)" : ""}. Los demás miran la partida.</p>`
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
  on("compartir", () => { navigator.share({ title: "El Impostor", text: `Únete a mi sala: ${v.code}`, url: Net.enlace() }).catch(() => {}); });
  app.querySelectorAll("[data-g]").forEach(b => b.onclick = () => Net.send({ t: "sel", game: b.dataset.g }));
  app.querySelectorAll("[data-kick]").forEach(b => b.onclick = () => Net.send({ t: "kick", id: b.dataset.kick }));
  on("ajustes", () => { S.online = true; go("themes"); });
  on("ajCaso", () => { S.online = true; go("casoSel"); });
  on("chComOn", () => { S.chCfg.comodines = !S.chCfg.comodines; store.set("chCfg", S.chCfg); Net.cfgCambiada(); });
  on("empezar", () => Net.send({ t: "start" }));
  on("invitar", () => invitarAmigos());
}
