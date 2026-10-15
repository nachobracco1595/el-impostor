/* Cuentas: inicio de sesión, perfil, ranking, avisos de puntos y logros */

/* ¿Se abrió como app instalada (pantalla completa)? */
const esApp = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
/* Si salimos a mirar el correo y la app se recargó, se recuerda a qué correo mandamos (por 20 minutos) */
(() => { try { const p = store.get("mailPendiente", null); if (p && Date.now() - p.t < 20 * 60000) { UI.mailEnviado = p.m; UI.mail = p.m; } } catch {} })();
const CABEZAS = ["", "sombrero", "gorra", "galera", "chef", "casco", "pelo", "auriculares", "cofia"];
const CARAS = ["", "lentes", "bigote", "barba", "mono", "collar"];
const NOMBRE_ACC = { "": "Nada", sombrero: "Sombrero", gorra: "Gorra", galera: "Galera", chef: "Chef", casco: "Casco", pelo: "Pelo largo", auriculares: "Auriculares", cofia: "Cofia", lentes: "Lentes", bigote: "Bigote", barba: "Barba", mono: "Moño", collar: "Collar" };

const Cuenta = {
  look(u = BD.sesion()) { return u ? u.look : null; },

  lookValido(l) {
    if (!l || typeof l !== "object" || !(COLORES.includes(l.color) || COLORES_TIENDA.includes(l.color)) || !Array.isArray(l.acc)) return null;
    return { color: l.color, acc: l.acc.filter(a => ACCESORIOS[a]).slice(0, 3), marco: MARCOS[l.marco] ? l.marco : "", titulo: typeof l.titulo === "string" ? l.titulo.slice(0, 24) : "", mascota: MASCOTAS[l.mascota] ? l.mascota : "" };
  },

  /* Los avatares de jugadores con perfil usan su color y accesorios */
  prepararLooks() {
    LOOKS.clear();
    if (typeof Net !== "undefined" && Net.activo()) {
      const looks = (UI.v && UI.v.looks) || {};
      for (const [n, l] of Object.entries(looks)) { const ok = Cuenta.lookValido(l); if (ok) LOOKS.set(n, ok); }
    } else {
      S.players.forEach(n => { const u = BD.porNombre(n); if (u && u.look) LOOKS.set(n, u.look); });
    }
  },

  barra() {
    const u = BD.sesion();
    if (!u) return `<div class="barra-cuenta"><button class="btn ghost chico" id="entrar">👤 Iniciar sesión</button><button class="btn ghost chico" id="verRanking">🏆 Ranking</button></div>`;
    const nv = nivelDe(u.puntos);
    Eco.completar(u);
    const regalo = Eco.diario(u).puede || (Eco.mision(u).hechas >= Eco.mision(u).meta && !Eco.mision(u).cobrada);
    return `<div class="barra-cuenta">
      <button class="yo-chip" id="miPerfil">${retrato(u.look, 34)}<span><b>${esc(u.nombre)}${u.nube ? " ☁️" : ""}</b><small>Nv ${nv.n} · ${u.puntos} pts</small></span></button>
      <div class="barra-acc"><button class="btn ghost chico ${regalo ? "aviso" : ""}" id="verTienda" aria-label="Tienda, ${u.monedas} monedas">🪙 ${u.monedas}</button>${typeof Social !== "undefined" ? Social.boton() : ""}<button class="btn ghost chico" id="verRanking" aria-label="Ranking">🏆</button></div></div>`;
  },
  conectarBarra() {
    on("entrar", () => go("cuenta"));
    on("miPerfil", () => go("perfil"));
    on("verRanking", () => go("ranking"));
    on("verTienda", () => go("tienda"));
    on("verAmigos", () => go("amigos"));
  },

  /* Después de cada pantalla: si terminó una partida, suma puntos (una sola vez) */
  revisar() {
    const pend = [];
    const deLocal = (players, fn) => players.forEach((p, i) => { const u = BD.porNombre(p.name); if (u) pend.push([u, fn(p, i)]); });
    if (typeof Net !== "undefined" && Net.activo()) {
      const u = BD.sesion();
      if (u && UI.v && UI.v.resultado) pend.push([u, UI.v.resultado]);
    } else if (S.screen === "end" && S.game) deLocal(S.game.players, (p, i) => Imp.resultado(S.game, i));
    else if (S.screen === "liars" && S.lie) deLocal(S.lie.players, p => Lie.resultado(S.lie, p.id));
    else if (S.screen === "casos" && S.caso) deLocal(S.caso.players, p => Casos.resultado(S.caso, p.id, true));
    else if (S.screen === "ajedrez" && S.aj) deLocal(S.aj.jug.filter(j => !j.cpu), p => Ajedrez.resultado(S.aj, p.id));
    else if (S.screen === "naval" && S.nav) deLocal(S.nav.jug.filter(j => !j.cpu), p => Naval.resultado(S.nav, p.id));
    else if (S.screen === "nave" && S.nave) deLocal(S.nave.jug.filter(j => !j.bot), p => Nave.resultado(S.nave, p.id));
    else if (S.screen === "arena" && S.arena) deLocal(S.arena.jug.filter(j => !j.cpu), p => Arena.resultado(S.arena, p.id));
    else if (S.screen === "truco" && S.tru) deLocal(S.tru.jug.filter(j => !j.cpu), p => Truco.resultado(S.tru, p.id));
    else if (S.screen === "chinchon" && S.chi) deLocal(S.chi.jug.filter(j => !j.cpu), p => Chin.resultado(S.chi, p.id));
    const hechos = pend.map(([u, r]) => r && BD.registrar(u.id, r)).filter(Boolean);
    if (!hechos.length) return;
    if (hechos.length === 1) {
      const h = hechos[0];
      Toast.mostrar(`<div class="t-pts">+${h.puntos}<small>puntos</small></div><div class="t-txt"><b>${esc(h.usuario.nombre)} · +${h.monedas} 🪙</b>${h.detalle.map(([t, p]) => `<span>${esc(t)} <em>+${p}</em></span>`).join("")}</div>`, "puntos");
    } else {
      Toast.mostrar(`<div class="t-txt"><b>Puntos de la partida</b>${hechos.map(h => `<span>${esc(h.usuario.nombre)} <em>+${h.puntos} pts · +${h.monedas} 🪙</em></span>`).join("")}</div>`, "puntos");
    }
    hechos.forEach(h => h.logros.forEach(l => Toast.mostrar(`<div class="t-ic">${l.ic}</div><div class="t-txt"><small>Logro desbloqueado${hechos.length > 1 ? ` · ${esc(h.usuario.nombre)}` : ""}</small><b>${esc(l.nombre)}</b><span>${esc(l.desc)}</span></div>`, "logro")));
  }
};

const LOGO_G = `<svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

/* ---------- Avisos flotantes ---------- */
const Toast = {
  cola: [], activo: false,
  caja: (() => { const d = document.createElement("div"); d.className = "toasts"; d.setAttribute("aria-live", "polite"); document.body.appendChild(d); return d; })(),
  mostrar(html, tipo) { this.cola.push([html, tipo]); if (!this.activo) this.siguiente(); },
  siguiente() {
    const it = this.cola.shift();
    if (!it) { this.activo = false; return; }
    this.activo = true;
    const el = document.createElement("div");
    el.className = `toast ${it[1]}`; el.innerHTML = it[0];
    el.onclick = () => el.remove();
    this.caja.appendChild(el);
    if (typeof Sonido !== "undefined") Sonido.sfx(it[1] === "logro" ? "logro" : "monedas");
    setTimeout(() => { el.classList.add("sale"); setTimeout(() => { el.remove(); this.siguiente(); }, 350); }, it[1] === "logro" ? 3200 : 3800);
  }
};

/* ---------- Editor de avatar ---------- */
function editorLook(b) {
  const look = { color: b.color, acc: [b.cabeza, b.cara].filter(Boolean) };
  const u = BD.sesion(), inv = u && UI.editLook ? u.inv || [] : [];
  const comprado = tipo => inv.map(id => CATALOGO[id]).filter(it => it && it.tipo === tipo).map(it => it.valor);
  const colores = [...COLORES, ...comprado("color")], cabezas = [...CABEZAS, ...comprado("cabeza")], caras = [...CARAS, ...comprado("cara")];
  const nombreAcc = a => NOMBRE_ACC[a] || (Object.values(CATALOGO).find(it => it.valor === a) || {}).nombre || a;
  return `<div class="editor-look">
    <div class="look-prev">${personaje(look.color, "civ", 120, look.acc)}</div>
    <div class="look-ops">
      <span class="label">Color</span>
      <div class="swatches">${colores.map(c => `<button class="sw" style="--c:${c}" data-col="${c}" aria-pressed="${b.color === c}" aria-label="Color ${c}"></button>`).join("")}</div>
      <span class="label">Cabeza</span>
      <div class="acc-ops">${cabezas.map(a => `<button class="acc-op" data-cab="${a}" aria-pressed="${b.cabeza === a}">${personaje(b.color, "civ", 38, a ? [a] : [])}<small>${nombreAcc(a)}</small></button>`).join("")}</div>
      <span class="label">Cara</span>
      <div class="acc-ops">${caras.map(a => `<button class="acc-op" data-car="${a}" aria-pressed="${b.cara === a}">${personaje(b.color, "civ", 38, a ? [a] : [])}<small>${nombreAcc(a)}</small></button>`).join("")}</div>
    </div></div>`;
}
function conectarEditor(b) {
  app.querySelectorAll("[data-col]").forEach(x => x.onclick = () => { b.color = x.dataset.col; render(); });
  app.querySelectorAll("[data-cab]").forEach(x => x.onclick = () => { b.cabeza = x.dataset.cab; render(); });
  app.querySelectorAll("[data-car]").forEach(x => x.onclick = () => { b.cara = x.dataset.car; render(); });
}
const lookABorrador = l => ({ color: l.color, cabeza: l.acc.find(a => Eco.esCabeza(a)) || "", cara: l.acc.find(a => Eco.esCara(a)) || "" });

/* ---------- Iniciar sesión ---------- */
PANTALLAS.cuenta = () => {
  const us = BD.locales();
  if (UI.creando || UI.nubeNuevo) return PANTALLAS.crearPerfil();
  if (!us.length && !Nube.config()) return PANTALLAS.crearPerfil();
  const sel = UI.loginId && BD.usuario(UI.loginId);
  const pin = UI.pin || "";
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>${sel ? `Hola, ${esc(sel.nombre)}` : "¿Quién eres?"}</h2><p class="sub">${sel ? "Escribe tu PIN de 4 números." : (Nube.config() ? "Entra con tu cuenta en la nube o elige un perfil de este teléfono." : "Elige tu perfil. Los perfiles se guardan en este teléfono.")}</p></div>
    ${!sel && Nube.config() ? `<div class="panel google-box">
        <span class="label">Cuenta en la nube</span>
        <p class="summary">Tus puntos se guardan en internet, los ves desde cualquier teléfono y apareces en el ranking mundial.</p>
        ${Nube.config().google !== false ? `<button class="btn google" id="google" ${Nube.estado !== "lista" ? "disabled" : ""}>${LOGO_G}${Nube.estado === "lista" ? "Continuar con Google" : Nube.estado === "error" ? "Nube no disponible" : "Conectando…"}</button>` : ""}
        <form class="mail-form" id="fMail">
          <label class="label" for="mail">${Nube.config().google !== false ? "O entra con tu correo, sin contraseña" : "Entra con tu correo, sin contraseña"}</label>
          <div class="add"><input class="campo" id="mail" type="email" autocomplete="email" placeholder="tu@correo.com" value="${esc(UI.mail || "")}" ${Nube.estado !== "lista" ? "disabled" : ""}><button class="btn ghost chico" type="submit" ${Nube.estado !== "lista" ? "disabled" : ""}>Enviar</button></div>
        </form>
        ${UI.mailEnviado ? `<p class="summary">📬 Te mandamos un correo a <b>${esc(UI.mailEnviado)}</b> (revisa también el spam).
          ${esApp() ? `<b>Estás en la app:</b> el enlace del correo se abre en Safari, que es aparte. En el correo <b>mantén apretado el botón del enlace → Copiar enlace</b> (sin abrirlo) y pégalo acá, o escribe el código si viene uno:` : `Toca el enlace en este mismo dispositivo, <b>o pega acá el enlace o el código</b> del correo:`}</p>
          <form class="add" id="fCodigo"><input class="campo" id="codigo" autocomplete="one-time-code" placeholder="Código o enlace del correo" aria-label="Código o enlace del correo"><button class="btn chico" type="submit">Entrar</button></form>` : ""}
        ${UI.errNube ? `<p class="warn">${esc(UI.errNube)}</p>` : ""}
      </div>
      <span class="label">Perfiles sin internet (con PIN, solo en este teléfono)</span>` : ""}
    ${sel ? `<div class="login-sel">${personaje(sel.look.color, "civ", 110, sel.look.acc)}
        <div class="pin-dots ${UI.pinError ? "error" : ""}">${[0, 1, 2, 3].map(i => `<i class="${i < pin.length ? "on" : ""}"></i>`).join("")}</div>
        ${UI.pinError ? `<p class="warn">${esc(UI.pinError)}</p>` : ""}
        <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map(k => k === "" ? "<span></span>" : `<button data-k="${k}" aria-label="${k === "⌫" ? "Borrar" : k}">${k}</button>`).join("")}</div>
        <button class="linkish" id="otro">No soy yo</button></div>`
      : `<div class="perfiles">${us.map(u => `<button class="perfil-op" data-u="${u.id}">${personaje(u.look.color, "civ", 70, u.look.acc)}<b>${esc(u.nombre)}</b><small>Nivel ${nivelDe(u.puntos).n} · ${u.puntos} pts</small></button>`).join("")}
          <button class="perfil-op nuevo" id="nuevo"><span class="mas">+</span><b>Crear perfil</b><small>Nuevo jugador</small></button></div>`}
    <button class="btn ghost" id="volver">Jugar sin cuenta</button>
  </section>`;
  app.querySelectorAll("[data-u]").forEach(b => b.onclick = () => { UI.loginId = b.dataset.u; UI.pin = ""; UI.pinError = ""; render(); });
  on("nuevo", () => { UI.creando = true; render(); });
  on("google", () => { UI.errNube = ""; Nube.entrarGoogle(); });
  const fm = byId("fMail");
  if (fm) fm.onsubmit = async e => {
    e.preventDefault();
    const m = byId("mail").value.trim();
    UI.mail = m; UI.errNube = ""; UI.mailEnviado = "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) { UI.errNube = "Escribe un correo válido."; return render(); }
    try { await Nube.enviarEnlace(m); UI.mailEnviado = m; store.set("mailPendiente", { m, t: Date.now() }); } catch (err) { UI.errNube = err.message; }
    render();
  };
  const fc = byId("fCodigo");
  if (fc) fc.onsubmit = async e => {
    e.preventDefault(); UI.errNube = "";
    const b = fc.querySelector("button"); b.disabled = true;
    try { await Nube.verificarCodigo(UI.mailEnviado, byId("codigo").value); UI.mailEnviado = ""; store.set("mailPendiente", null); } catch (err) { UI.errNube = err.message; b.disabled = false; }
    render();
  };
  on("otro", () => { UI.loginId = null; render(); });
  on("volver", () => { UI.loginId = null; go("home"); });
  app.querySelectorAll("[data-k]").forEach(b => b.onclick = async () => {
    const k = b.dataset.k;
    UI.pinError = "";
    UI.pin = k === "⌫" ? pin.slice(0, -1) : (pin + k).slice(0, 4);
    render();
    if (UI.pin.length === 4) {
      try {
        const u = await BD.entrar(UI.loginId, UI.pin);
        UI.loginId = null; UI.pin = "";
        alIniciar(u);
      } catch (e) { UI.pin = ""; UI.pinError = e.message; try { navigator.vibrate && navigator.vibrate(200); } catch {} render(); }
    }
  });
};

function alIniciar(u) {
  if (!S.players.some(n => n.toLowerCase() === u.nombre.toLowerCase())) { S.players.unshift(u.nombre); save(); }
  store.set("nombre", u.nombre);
  Toast.mostrar(`<div class="t-ic">👋</div><div class="t-txt"><b>¡Hola, ${esc(u.nombre)}!</b><span>Tus partidas ahora suman puntos.</span></div>`, "info");
  go("home");
}

PANTALLAS.crearPerfil = () => {
  const b = UI.borrador = UI.borrador || { nombre: "", color: pick(COLORES), cabeza: "", cara: "", pin: "" };
  const nube = !!UI.nubeNuevo;
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>${nube ? "Tu perfil en la nube" : "Crear perfil"}</h2><p class="sub">${nube ? "Ya iniciaste sesión. Elige cómo te verán los demás: tu nombre y tu personaje." : "Arma tu personaje. Con tu perfil sumas puntos, logros y apareces en el ranking."}</p></div>
    <div class="panel">${editorLook(b)}</div>
    <form class="panel" id="f">
      <label class="label" for="pnom">Nombre</label>
      <input class="campo" id="pnom" maxlength="16" autocomplete="off" value="${esc(b.nombre)}" placeholder="Cómo te verán los demás">
      ${nube ? `<p class="summary">Tu correo no se muestra a nadie: en el ranking solo aparecen tu nombre y tu personaje.</p>` : `<label class="label" for="ppin">PIN de 4 números</label>
      <input class="campo codigo" id="ppin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" value="${esc(b.pin)}" placeholder="••••">
      <p class="summary">El PIN solo evita que otro use tu perfil en este teléfono. No uses uno que uses en otro lado.</p>`}
      <p class="warn" id="msg" ${UI.errCrear ? "" : "hidden"}>${esc(UI.errCrear || "")}</p>
      <button class="btn" type="submit">Crear perfil</button>
    </form>
    <button class="btn ghost" id="cancel">${nube ? "Cancelar y cerrar sesión" : BD.locales().length || Nube.config() ? "Volver" : "Jugar sin cuenta"}</button>
  </section>`;
  conectarEditor(b);
  byId("pnom").oninput = e => b.nombre = e.target.value;
  if (byId("ppin")) byId("ppin").oninput = e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); b.pin = e.target.value; };
  byId("f").onsubmit = async e => {
    e.preventDefault();
    try {
      const look = { color: b.color, acc: [b.cabeza, b.cara].filter(Boolean) };
      const u = nube ? await Nube.crearPerfil(b.nombre, look) : await BD.crear(b.nombre, b.pin, look);
      UI.borrador = null; UI.creando = false; UI.errCrear = ""; UI.nubeNuevo = null;
      alIniciar(u);
    } catch (err) { UI.errCrear = err.message; render(); }
  };
  on("cancel", () => {
    if (nube) { UI.nubeNuevo = null; Nube.salir(); }
    UI.creando = false; UI.errCrear = ""; UI.borrador = null;
    go(BD.locales().length || Nube.config() ? "cuenta" : "home");
  });
};

/* ---------- Perfil ---------- */
PANTALLAS.perfil = () => {
  const u = BD.sesion();
  if (!u) return go("cuenta");
  const nv = nivelDe(u.puntos), st = u.stats;
  const pct = (g, j) => j ? Math.round((g / j) * 100) + "%" : "—";
  const fecha = f => new Date(f).toLocaleDateString("es", { day: "numeric", month: "short" });
  if (UI.editLook) {
    const b = UI.editLook;
    app.innerHTML = `${head(0)}<section class="screen"><div><h2>Tu personaje</h2></div><div class="panel">${editorLook(b)}</div>
      <div class="row"><button class="btn ghost" id="cancel">Cancelar</button><button class="btn" id="ok">Guardar</button></div></section>`;
    conectarEditor(b);
    on("cancel", () => { UI.editLook = null; render(); });
    on("ok", () => { BD.editarLook(u.id, { ...u.look, color: b.color, acc: [b.cabeza, b.cara].filter(Boolean) }); if (u.nube) Nube.subir(u); UI.editLook = null; render(); });
    return;
  }
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div class="perfil-head">
      <button class="perfil-art" id="editar" aria-label="Editar personaje">${retrato(u.look, 120)}<span class="editar-tag">Editar</span></button>
      <div class="perfil-info">
        <h2>${esc(u.nombre)}</h2>${u.look.titulo ? `<span class="titulo-perfil">«${esc(u.look.titulo)}»</span>` : ""}
        <span class="nivel">Nivel ${nv.n} · ${nv.titulo}</span>
        <small class="cuenta-tipo">${u.nube ? `☁️ Cuenta en la nube${Nube.user && Nube.user.email ? ` · ${esc(Nube.user.email)}` : ""}${u.pendiente ? " · ⏳ cambios por subir" : ""}` : "📱 Perfil local de este teléfono"}</small>
        <div class="xp"><i style="width:${nv.pct}%"></i></div>
        <small class="sub">${u.puntos} puntos${nv.hasta ? ` · faltan ${nv.hasta - u.puntos} para el nivel ${nv.n + 1}` : " · nivel máximo"}</small>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat"><b>${total(u, "j")}</b><small>Partidas</small></div>
      <div class="stat"><b>${total(u, "g")}</b><small>Victorias</small></div>
      <div class="stat"><b>${u.racha}${u.racha >= 3 ? "🔥" : ""}</b><small>Racha</small></div>
      <div class="stat"><b>${Object.keys(u.logros).length}/${LOGROS.length}</b><small>Logros</small></div>
    </div>
    <div class="panel"><span class="label">Por juego</span>
      <div class="juego-stats">
        <div><b>🎭 El Impostor</b><span>${st.impostor.p} pts · ${st.impostor.g}/${st.impostor.j} ganadas (${pct(st.impostor.g, st.impostor.j)})</span><small>Fue impostor ${st.impostor.imp} ${st.impostor.imp === 1 ? "vez" : "veces"} y ganó ${st.impostor.impG} · Ganó como inocente ${st.impostor.inoG}</small></div>
        <div><b>🃏 Mesa del Mentiroso</b><span>${st.liars.p} pts · ${st.liars.g}/${st.liars.j} ganadas (${pct(st.liars.g, st.liars.j)})</span><small>${st.liars.aciertos} mentirosos atrapados · ${st.liars.clics} gatillazos sobrevividos</small></div>
        <div><b>🃏 Chinchón</b><span>${st.chinchon.p} pts · ${st.chinchon.g}/${st.chinchon.j} ganadas (${pct(st.chinchon.g, st.chinchon.j)})</span><small>${st.chinchon.chinchones} chinchones · ${st.chinchon.menos10} cortes con −10</small></div>
        <div><b>🗡️ Truco</b><span>${st.truco.p} pts · ${st.truco.g}/${st.truco.j} ganadas (${pct(st.truco.g, st.truco.j)})</span><small>${st.truco.envidos} envidos ganados · ${st.truco.vale4} vale cuatro</small></div>
        <div><b>⚓ Batalla naval</b><span>${st.naval.p} pts · ${st.naval.g}/${st.naval.j} ganadas (${pct(st.naval.g, st.naval.j)})</span><small>${st.naval.hundidos} barcos hundidos</small></div>
        <div><b>♚ Ajedrez</b><span>${st.ajedrez.p} pts · ${st.ajedrez.g}/${st.ajedrez.j} ganadas (${pct(st.ajedrez.g, st.ajedrez.j)})</span><small>${st.ajedrez.mates} mates · ${st.ajedrez.tablas} tablas</small></div>
        <div><b>🚀 La Nave</b><span>${st.nave.p} pts · ${st.nave.g}/${st.nave.j} ganadas (${pct(st.nave.g, st.nave.j)})</span><small>${st.nave.tareas} tareas · ${st.nave.kills} eliminaciones</small></div>
        <div><b>🔍 Detectives</b><span>${st.casos.p} pts · ${st.casos.g}/${st.casos.j} ganadas (${pct(st.casos.g, st.casos.j)})</span><small>Casos resueltos: ${st.casos.resueltos.length} de ${CASOS.length}</small></div>
      </div></div>
    <div class="panel"><span class="label">Logros</span>
      <div class="logros">${LOGROS.map(l => `<div class="logro ${u.logros[l.id] ? "on" : ""}" title="${esc(l.desc)}"><span class="l-ic">${u.logros[l.id] ? l.ic : "🔒"}</span><b>${esc(l.nombre)}</b><small>${esc(l.desc)}</small></div>`).join("")}</div></div>
    <div class="panel"><span class="label">Últimas partidas</span>
      ${u.historial.length ? `<ul class="historial">${u.historial.slice(0, 10).map(h => `<li class="${h.gano ? "g" : "p"}"><span>${fecha(h.f)}</span><b>${esc(JUEGOS[h.juego])}</b><em>${h.gano ? "Ganó" : "Perdió"}</em><strong>+${h.puntos}</strong></li>`).join("")}</ul>` : `<p class="empty">Todavía no jugaste ninguna partida con este perfil.</p>`}</div>
    <div class="panel"><span class="label">Perfiles locales de este teléfono</span>
      <p class="summary">${u.nube ? "Tu cuenta ya se guarda en la nube. Esto es para los perfiles con PIN: se guardan en este navegador." : "Los perfiles se guardan en este navegador."} Exporta el archivo para tener un respaldo o pasarlo a otro teléfono, e impórtalo allá.</p>
      <div class="row"><button class="btn ghost" id="exp">Exportar archivo</button><label class="btn ghost" for="imp">Importar archivo</label></div>
      <input type="file" id="imp" accept=".json,application/json" hidden>
      ${UI.msgBD ? `<p class="summary"><b>${esc(UI.msgBD)}</b></p>` : ""}
    </div>
    <div class="row"><button class="btn ghost" id="salir">Cerrar sesión</button><button class="btn ghost" id="rank">🏆 Ranking</button></div>
    ${UI.borrarPerfil ? `<div class="panel confirm"><b>¿Borrar el perfil de ${esc(u.nombre)}${u.nube ? " de la nube" : ""}? Se pierden sus puntos y logros.</b><div class="row"><button class="btn ghost" id="noB">No</button><button class="btn danger" id="siB">Sí, borrar</button></div></div>` : `<button class="linkish" id="borrar">${u.nube ? "Borrar mi perfil de la nube" : "Borrar este perfil"}</button>`}
  </section>`;
  on("editar", () => { UI.editLook = lookABorrador(u.look); render(); });
  if (u.nube && u.pendiente) Nube.subir(u).then(() => { if (S.screen === "perfil" && !u.pendiente) render(); });
  on("salir", async () => { UI.msgBD = ""; if (u.nube) await Nube.salir(); else BD.salir(); go("home"); });
  on("rank", () => go("ranking"));
  on("borrar", () => { UI.borrarPerfil = true; render(); });
  on("noB", () => { UI.borrarPerfil = false; render(); });
  on("siB", async () => {
    UI.borrarPerfil = false; S.players = S.players.filter(n => n !== u.nombre); save();
    if (u.nube) await Nube.borrarCuenta(u); else BD.borrar(u.id);
    go("home");
  });
  on("exp", () => {
    const blob = new Blob([BD.exportar()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `el-impostor-bd-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    UI.msgBD = "Archivo exportado. Si no se descargó, abre el juego desde su página web.";
    render();
  });
  byId("imp").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { const x = BD.importar(r.result); UI.msgBD = `Importado: ${x.nuevos} perfil${x.nuevos === 1 ? "" : "es"} nuevo${x.nuevos === 1 ? "" : "s"} y ${x.actualizados} actualizado${x.actualizados === 1 ? "" : "s"}.`; }
      catch (err) { UI.msgBD = err.message || "No se pudo leer el archivo."; }
      render();
    };
    r.readAsText(f);
  };
};

/* ---------- Ranking ---------- */
PANTALLAS.ranking = () => {
  const tab = UI.tabRank || "";
  const enNube = Nube.config() && (UI.rankScope || "nube") === "nube";
  let filas = [], aviso = "";
  if (enNube) {
    Nube.cargarRanking(tab);
    const r = Nube.ranking[tab];
    if (Nube.estado !== "lista" || !r || (r.cargando && !r.filas)) aviso = Nube.estado === "error" ? "La nube no está disponible ahora." : "Cargando el ranking…";
    else if (r.error) aviso = r.error;
    else filas = r.filas;
  } else filas = BD.ranking(tab || null);
  const yo = BD.sesion();
  const tabs = [["", "General"], ["impostor", "Impostor"], ["liars", "Mentiroso"], ["casos", "Detectives"], ["chinchon", "Chinchón"], ["truco", "Truco"], ["naval", "Naval"], ["ajedrez", "Ajedrez"], ["nave", "Nave"], ["arena", "Arena (ELO)"]];
  const podio = filas.slice(0, 3);
  const orden = [1, 0, 2].filter(i => podio[i]);
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>Ranking</h2><p class="sub">${enNube ? "Todos los jugadores con cuenta en la nube." : "Perfiles guardados en este teléfono."}</p></div>
    ${Nube.config() ? `<div class="tabs dos">${[["nube", "☁️ Mundial"], ["local", "📱 Este teléfono"]].map(([k, n]) => `<button data-scope="${k}" aria-pressed="${(UI.rankScope || "nube") === k}">${n}</button>`).join("")}</div>` : ""}
    <div class="tabs scroll">${tabs.map(([k, n]) => `<button data-tab="${k}" aria-pressed="${tab === k}">${n}</button>`).join("")}</div>
    ${aviso ? `<div class="panel center"><p class="empty">${esc(aviso)}</p></div>` : filas.length ? `
      <div class="podio">${orden.map(i => { const f = podio[i]; return `<div class="podio-p p${i + 1}">
        ${i === 0 ? `<span class="corona">👑</span>` : ""}${retrato(f.u.look, i === 0 ? 86 : 66)}
        <b>${esc(f.u.nombre)}</b><small>${f.puntos} ${tab === "arena" ? "ELO" : "pts"}</small><div class="escalon">${i + 1}</div></div>`; }).join("")}</div>
      <ol class="tabla-rank">${filas.map((f, i) => `<li class="${yo && yo.id === f.u.id ? "yo" : ""}"><span class="pos">${i + 1}</span>${retrato(f.u.look, 34)}<span class="nm"><b>${esc(f.u.nombre)}</b>${f.u.look.titulo ? `<em class="tit-mini">${esc(f.u.look.titulo)}</em>` : ""}<small>Nivel ${nivelDe(f.u.puntos).n} · ${f.g}/${f.j} ganadas</small></span><strong>${f.puntos}</strong></li>`).join("")}</ol>`
      : `<div class="panel center"><p class="empty">Todavía no hay nadie en este ranking. Crea tu perfil y jueguen para aparecer acá.</p><button class="btn" id="crear">Crear perfil</button></div>`}
    <details class="panel"><summary class="label">¿Cómo se ganan puntos?</summary>
      <ul class="reglas-pts">${Puntos.REGLAS.map(([t, p]) => `<li><span>${esc(t)}</span><b>${esc(p)}</b></li>`).join("")}</ul>
      <p class="summary">Niveles: ${NIVELES.map(([p, t], i) => `${i + 1}. ${t} (${p})`).join(" · ")}</p></details>
    <button class="btn ghost" id="volver">Volver</button>
  </section>`;
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { UI.tabRank = b.dataset.tab; render(); });
  app.querySelectorAll("[data-scope]").forEach(b => b.onclick = () => { UI.rankScope = b.dataset.scope; render(); });
  on("crear", () => { UI.creando = !Nube.config(); go("cuenta"); });
  on("volver", () => go("home"));
};
