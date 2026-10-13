/* Cuentas: inicio de sesión, perfil, ranking, avisos de puntos y logros */
const CABEZAS = ["", "sombrero", "gorra", "galera", "chef", "casco", "pelo", "auriculares", "cofia"];
const CARAS = ["", "lentes", "bigote", "barba", "mono", "collar"];
const NOMBRE_ACC = { "": "Nada", sombrero: "Sombrero", gorra: "Gorra", galera: "Galera", chef: "Chef", casco: "Casco", pelo: "Pelo largo", auriculares: "Auriculares", cofia: "Cofia", lentes: "Lentes", bigote: "Bigote", barba: "Barba", mono: "Moño", collar: "Collar" };

const Cuenta = {
  look(u = BD.sesion()) { return u ? u.look : null; },

  lookValido(l) {
    if (!l || typeof l !== "object" || !COLORES.includes(l.color) || !Array.isArray(l.acc)) return null;
    return { color: l.color, acc: l.acc.filter(a => ACCESORIOS[a]).slice(0, 3) };
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
    return `<div class="barra-cuenta">
      <button class="yo-chip" id="miPerfil">${personaje(u.look.color, "civ", 34, u.look.acc)}<span><b>${esc(u.nombre)}</b><small>Nivel ${nv.n} · ${u.puntos} pts</small></span></button>
      <button class="btn ghost chico" id="verRanking">🏆 Ranking</button></div>`;
  },
  conectarBarra() {
    on("entrar", () => go("cuenta"));
    on("miPerfil", () => go("perfil"));
    on("verRanking", () => go("ranking"));
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
    const hechos = pend.map(([u, r]) => r && BD.registrar(u.id, r)).filter(Boolean);
    if (!hechos.length) return;
    if (hechos.length === 1) {
      const h = hechos[0];
      Toast.mostrar(`<div class="t-pts">+${h.puntos}<small>puntos</small></div><div class="t-txt"><b>${esc(h.usuario.nombre)}</b>${h.detalle.map(([t, p]) => `<span>${esc(t)} <em>+${p}</em></span>`).join("")}</div>`, "puntos");
    } else {
      Toast.mostrar(`<div class="t-txt"><b>Puntos de la partida</b>${hechos.map(h => `<span>${esc(h.usuario.nombre)} <em>+${h.puntos}</em></span>`).join("")}</div>`, "puntos");
    }
    hechos.forEach(h => h.logros.forEach(l => Toast.mostrar(`<div class="t-ic">${l.ic}</div><div class="t-txt"><small>Logro desbloqueado${hechos.length > 1 ? ` · ${esc(h.usuario.nombre)}` : ""}</small><b>${esc(l.nombre)}</b><span>${esc(l.desc)}</span></div>`, "logro")));
  }
};

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
  return `<div class="editor-look">
    <div class="look-prev">${personaje(look.color, "civ", 120, look.acc)}</div>
    <div class="look-ops">
      <span class="label">Color</span>
      <div class="swatches">${COLORES.map(c => `<button class="sw" style="--c:${c}" data-col="${c}" aria-pressed="${b.color === c}" aria-label="Color ${c}"></button>`).join("")}</div>
      <span class="label">Cabeza</span>
      <div class="acc-ops">${CABEZAS.map(a => `<button class="acc-op" data-cab="${a}" aria-pressed="${b.cabeza === a}">${personaje(b.color, "civ", 38, a ? [a] : [])}<small>${NOMBRE_ACC[a]}</small></button>`).join("")}</div>
      <span class="label">Cara</span>
      <div class="acc-ops">${CARAS.map(a => `<button class="acc-op" data-car="${a}" aria-pressed="${b.cara === a}">${personaje(b.color, "civ", 38, a ? [a] : [])}<small>${NOMBRE_ACC[a]}</small></button>`).join("")}</div>
    </div></div>`;
}
function conectarEditor(b) {
  app.querySelectorAll("[data-col]").forEach(x => x.onclick = () => { b.color = x.dataset.col; render(); });
  app.querySelectorAll("[data-cab]").forEach(x => x.onclick = () => { b.cabeza = x.dataset.cab; render(); });
  app.querySelectorAll("[data-car]").forEach(x => x.onclick = () => { b.cara = x.dataset.car; render(); });
}
const lookABorrador = l => ({ color: l.color, cabeza: l.acc.find(a => CABEZAS.includes(a)) || "", cara: l.acc.find(a => CARAS.includes(a)) || "" });

/* ---------- Iniciar sesión ---------- */
PANTALLAS.cuenta = () => {
  const us = BD.usuarios();
  if (!us.length || UI.creando) return PANTALLAS.crearPerfil();
  const sel = UI.loginId && BD.usuario(UI.loginId);
  const pin = UI.pin || "";
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>${sel ? `Hola, ${esc(sel.nombre)}` : "¿Quién eres?"}</h2><p class="sub">${sel ? "Escribe tu PIN de 4 números." : "Elige tu perfil. Los perfiles se guardan en este teléfono."}</p></div>
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
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>Crear perfil</h2><p class="sub">Arma tu personaje. Con tu perfil sumas puntos, logros y apareces en el ranking.</p></div>
    <div class="panel">${editorLook(b)}</div>
    <form class="panel" id="f">
      <label class="label" for="pnom">Nombre</label>
      <input class="campo" id="pnom" maxlength="16" autocomplete="off" value="${esc(b.nombre)}" placeholder="Cómo te verán los demás">
      <label class="label" for="ppin">PIN de 4 números</label>
      <input class="campo codigo" id="ppin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" value="${esc(b.pin)}" placeholder="••••">
      <p class="summary">El PIN solo evita que otro use tu perfil en este teléfono. No uses uno que uses en otro lado.</p>
      <p class="warn" id="msg" ${UI.errCrear ? "" : "hidden"}>${esc(UI.errCrear || "")}</p>
      <button class="btn" type="submit">Crear perfil</button>
    </form>
    <button class="btn ghost" id="cancel">${BD.usuarios().length ? "Volver" : "Jugar sin cuenta"}</button>
  </section>`;
  conectarEditor(b);
  byId("pnom").oninput = e => b.nombre = e.target.value;
  byId("ppin").oninput = e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); b.pin = e.target.value; };
  byId("f").onsubmit = async e => {
    e.preventDefault();
    try {
      const u = await BD.crear(b.nombre, b.pin, { color: b.color, acc: [b.cabeza, b.cara].filter(Boolean) });
      UI.borrador = null; UI.creando = false; UI.errCrear = "";
      alIniciar(u);
    } catch (err) { UI.errCrear = err.message; render(); }
  };
  on("cancel", () => { UI.creando = false; UI.errCrear = ""; UI.borrador = null; go(BD.usuarios().length ? "cuenta" : "home"); });
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
    on("ok", () => { BD.editarLook(u.id, { color: b.color, acc: [b.cabeza, b.cara].filter(Boolean) }); UI.editLook = null; render(); });
    return;
  }
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div class="perfil-head">
      <button class="perfil-art" id="editar" aria-label="Editar personaje">${personaje(u.look.color, "civ", 120, u.look.acc)}<span>Editar</span></button>
      <div class="perfil-info">
        <h2>${esc(u.nombre)}</h2>
        <span class="nivel">Nivel ${nv.n} · ${nv.titulo}</span>
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
        <div><b>🔍 Detectives</b><span>${st.casos.p} pts · ${st.casos.g}/${st.casos.j} ganadas (${pct(st.casos.g, st.casos.j)})</span><small>Casos resueltos: ${st.casos.resueltos.length} de ${CASOS.length}</small></div>
      </div></div>
    <div class="panel"><span class="label">Logros</span>
      <div class="logros">${LOGROS.map(l => `<div class="logro ${u.logros[l.id] ? "on" : ""}" title="${esc(l.desc)}"><span class="l-ic">${u.logros[l.id] ? l.ic : "🔒"}</span><b>${esc(l.nombre)}</b><small>${esc(l.desc)}</small></div>`).join("")}</div></div>
    <div class="panel"><span class="label">Últimas partidas</span>
      ${u.historial.length ? `<ul class="historial">${u.historial.slice(0, 10).map(h => `<li class="${h.gano ? "g" : "p"}"><span>${fecha(h.f)}</span><b>${esc(JUEGOS[h.juego])}</b><em>${h.gano ? "Ganó" : "Perdió"}</em><strong>+${h.puntos}</strong></li>`).join("")}</ul>` : `<p class="empty">Todavía no jugaste ninguna partida con este perfil.</p>`}</div>
    <div class="panel"><span class="label">Base de datos de este teléfono</span>
      <p class="summary">Los perfiles se guardan en este navegador. Exporta el archivo para tener un respaldo o pasarlo a otro teléfono, e impórtalo allá.</p>
      <div class="row"><button class="btn ghost" id="exp">Exportar archivo</button><label class="btn ghost" for="imp">Importar archivo</label></div>
      <input type="file" id="imp" accept=".json,application/json" hidden>
      ${UI.msgBD ? `<p class="summary"><b>${esc(UI.msgBD)}</b></p>` : ""}
    </div>
    <div class="row"><button class="btn ghost" id="salir">Cerrar sesión</button><button class="btn ghost" id="rank">🏆 Ranking</button></div>
    ${UI.borrarPerfil ? `<div class="panel confirm"><b>¿Borrar el perfil de ${esc(u.nombre)}? Se pierden sus puntos y logros.</b><div class="row"><button class="btn ghost" id="noB">No</button><button class="btn danger" id="siB">Sí, borrar</button></div></div>` : `<button class="linkish" id="borrar">Borrar este perfil</button>`}
  </section>`;
  on("editar", () => { UI.editLook = lookABorrador(u.look); render(); });
  on("salir", () => { BD.salir(); UI.msgBD = ""; go("home"); });
  on("rank", () => go("ranking"));
  on("borrar", () => { UI.borrarPerfil = true; render(); });
  on("noB", () => { UI.borrarPerfil = false; render(); });
  on("siB", () => { UI.borrarPerfil = false; S.players = S.players.filter(n => n !== u.nombre); save(); BD.borrar(u.id); go("home"); });
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
  const filas = BD.ranking(tab || null);
  const yo = BD.sesion();
  const tabs = [["", "General"], ["impostor", "Impostor"], ["liars", "Mentiroso"], ["casos", "Detectives"]];
  const podio = filas.slice(0, 3);
  const orden = [1, 0, 2].filter(i => podio[i]);
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>Ranking</h2><p class="sub">Perfiles guardados en este teléfono.</p></div>
    <div class="tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" aria-pressed="${tab === k}">${n}</button>`).join("")}</div>
    ${filas.length ? `
      <div class="podio">${orden.map(i => { const f = podio[i]; return `<div class="podio-p p${i + 1}">
        ${i === 0 ? `<span class="corona">👑</span>` : ""}${personaje(f.u.look.color, "civ", i === 0 ? 86 : 66, f.u.look.acc)}
        <b>${esc(f.u.nombre)}</b><small>${f.puntos} pts</small><div class="escalon">${i + 1}</div></div>`; }).join("")}</div>
      <ol class="tabla-rank">${filas.map((f, i) => `<li class="${yo && yo.id === f.u.id ? "yo" : ""}"><span class="pos">${i + 1}</span>${personaje(f.u.look.color, "civ", 34, f.u.look.acc)}<span class="nm"><b>${esc(f.u.nombre)}</b><small>Nivel ${nivelDe(f.u.puntos).n} · ${f.g}/${f.j} ganadas</small></span><strong>${f.puntos}</strong></li>`).join("")}</ol>`
      : `<div class="panel center"><p class="empty">Todavía no hay perfiles. Crea uno y jueguen para aparecer acá.</p><button class="btn" id="crear">Crear perfil</button></div>`}
    <details class="panel"><summary class="label">¿Cómo se ganan puntos?</summary>
      <ul class="reglas-pts">${Puntos.REGLAS.map(([t, p]) => `<li><span>${esc(t)}</span><b>${esc(p)}</b></li>`).join("")}</ul>
      <p class="summary">Niveles: ${NIVELES.map(([p, t], i) => `${i + 1}. ${t} (${p})`).join(" · ")}</p></details>
    <button class="btn ghost" id="volver">Volver</button>
  </section>`;
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { UI.tabRank = b.dataset.tab; render(); });
  on("crear", () => { UI.creando = true; go("cuenta"); });
  on("volver", () => go("home"));
};
