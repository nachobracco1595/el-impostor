/* Referidos: invitar amigos con un link personal.
   - El link lleva ?ref=CÓDIGO. Quien entra con él y crea su cuenta en la nube recibe monedas de bienvenida.
   - Quien invitó cobra cuando su amigo ya jugó unas partidas (lo controla el servidor: canjear_referido y mis_referidos).
   - Títulos especiales al llegar a 3 y a 10 amigos que ya juegan. */

const REF_TITULOS = [[3, "tit-ref-3", "Embajador"], [10, "tit-ref-10", "Alma de la fiesta"]];
REF_TITULOS.forEach(([n, id, nombre]) => { CATALOGO[id] = { tipo: "titulo", nombre, precio: 0, valor: nombre, refs: n }; });

const Referidos = {
  datos: null, cargando: false,

  /* Guarda el código si se entró con un link de invitación */
  capturar() {
    const m = /[?&]ref=([A-Za-z0-9]{4,8})/.exec(location.search);
    if (m) store.set("refPendiente", { c: m[1].toUpperCase(), t: Date.now() });
  },
  pendiente() { const p = store.get("refPendiente", null); return p && Date.now() - p.t < 14 * 864e5 ? p.c : null; },
  enlace(codigo) { return location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html?ref=" + codigo; },
  texto(codigo) { return `¡Vení a jugar a Mesa Loca conmigo! 🎉 Impostor, Arena, Chinchón y más, gratis y con amigos. Entrá con mi link y te regalan monedas: ${this.enlace(codigo)}`; },

  /* El amigo nuevo: canjea el código al tener su cuenta en la nube */
  async canjear() {
    const c = this.pendiente();
    if (!c || !Nube.user || !Nube.sb) return;
    const { data, error } = await Nube.sb.rpc("canjear_referido", { codigo: c });
    if (error) return;
    store.set("refPendiente", null);
    if (data && data.ok) Toast.mostrar(`<div class="t-ic">🤝</div><div class="t-txt"><small>Te invitó ${esc(data.invitador)}</small><b>¡Bienvenido a Mesa Loca!</b><span>Te regalamos ${data.monedas} 🪙 de bienvenida.</span></div>`, "logro");
  },

  /* El que invitó: trae su lista, cobra los premios nuevos y desbloquea títulos */
  async cargar(u) {
    if (!Nube.user || !Nube.sb || this.cargando) return this.datos;
    this.cargando = true;
    try {
      const { data, error } = await Nube.sb.rpc("mis_referidos");
      if (!error && data && data.ok) {
        this.datos = data;
        u = u || BD.sesion();
        if (data.nuevos) Toast.mostrar(`<div class="t-ic">🤝</div><div class="t-txt"><small>Invitaciones</small><b>¡${data.nuevos === 1 ? "Un amigo tuyo ya juega" : `${data.nuevos} amigos tuyos ya juegan`}!</b><span>Te ganaste ${data.nuevos * data.premio} 🪙.</span></div>`, "logro");
        const activos = data.lista.filter(x => x.activo).length;
        if (u) {
          Eco.completar(u);
          REF_TITULOS.forEach(([n, id, nombre]) => {
            if (activos >= n && !u.inv.includes(id)) { u.inv.push(id); Toast.mostrar(`<div class="t-ic">🏅</div><div class="t-txt"><small>Título desbloqueado</small><b>«${esc(nombre)}»</b><span>Por invitar a ${n} amigos que ya juegan. Póntelo desde la tienda.</span></div>`, "logro"); Eco.guardar(u); }
          });
        }
      }
    } finally { this.cargando = false; }
    if (S.screen === "invitar") render();
    return this.datos;
  },

  compartir(codigo) {
    const t = this.texto(codigo);
    if (navigator.share) navigator.share({ title: "Mesa Loca", text: t }).catch(() => {});
    else this.copiar(t);
  },
  async copiar(t) {
    try { await navigator.clipboard.writeText(t); Toast.mostrar(`<div class="t-ic">📋</div><div class="t-txt"><b>Copiado</b><span>Pégalo en WhatsApp o donde quieras.</span></div>`, "info"); }
    catch { prompt("Copia el texto:", t); }
  },

  /* Cartelito en el inicio */
  cartel() {
    const u = BD.sesion();
    if (this.pendiente() && !(u && u.nube)) return `<article class="ref-banner"><span class="ev-ic">🎁</span><div><b>¡Te invitaron a Mesa Loca!</b><small>Crea tu cuenta en la nube con tu correo y recibes monedas de bienvenida.</small></div><button class="btn chico" id="refEntrar">Crear cuenta</button></article>`;
    if (u && u.nube) return `<button class="ref-banner chico" id="refInvitar"><span class="ev-ic">🤝</span><div><b>Invita amigos y gana 🪙</b><small>Por cada amigo que se suma y juega, ganan los dos.</small></div><span class="ref-flecha">›</span></button>`;
    return "";
  },
  conectarCartel() { on("refEntrar", () => go("cuenta")); on("refInvitar", () => go("invitar")); }
};

PANTALLAS.invitar = () => {
  const u = BD.sesion();
  if (!u || !u.nube || !Nube.user) {
    app.innerHTML = `${head(0)}<section class="stage">${personaje("#3ddcb1", "civ", 110)}<h2>Invitar amigos</h2><p class="sub">Para invitar amigos y ganar monedas, entra con tu cuenta en la nube.</p><button class="btn" id="rCuenta">Iniciar sesión</button><button class="btn ghost" id="rVolver">Volver</button></section>`;
    on("rCuenta", () => go("cuenta")); on("rVolver", () => go("home")); return;
  }
  const d = Referidos.datos;
  if (!d) Referidos.cargar(u);
  const lista = d ? d.lista : [], activos = lista.filter(x => x.activo).length;
  const sig = REF_TITULOS.find(([n]) => activos < n);
  app.innerHTML = `${head(0)}<section class="screen">
    <div><h2>Invita amigos 🤝</h2><p class="sub">Compárteles tu link. Cuando crean su cuenta reciben <b>${d ? d.premioInvitado : 100} 🪙</b> de regalo, y tú ganas <b>${d ? d.premio : 150} 🪙</b> cuando ya jugaron ${d ? d.partidas : 3} partidas.</p></div>
    ${d && !d.activo ? `<p class="warn">Las invitaciones con premio están en pausa por ahora.</p>` : ""}
    <div class="panel center ref-codigo">
      <span class="label">Tu código</span>
      <div class="codigo-big">${d ? esc(d.codigo) : "…"}</div>
      <div class="row"><button class="btn" id="rCompartir" ${d ? "" : "disabled"}>📤 Compartir link</button><a class="btn ghost" id="rWa" ${d ? `href="https://wa.me/?text=${encodeURIComponent(Referidos.texto(d.codigo))}" target="_blank" rel="noopener"` : ""}>WhatsApp</a></div>
      <button class="linkish" id="rCopiar" ${d ? "" : "disabled"}>Copiar link</button>
    </div>
    <div class="stats-row"><div class="stat"><b>${lista.length}</b><small>Invitados</small></div><div class="stat"><b>${activos}</b><small>Ya juegan</small></div><div class="stat"><b>${lista.filter(x => x.pagado).length * (d ? d.premio : 0)}</b><small>🪙 ganadas</small></div></div>
    ${sig ? `<div class="panel"><span class="label">Próximo premio</span><p class="summary">Con <b>${sig[0]}</b> amigos que ya juegan te llevas el título <b>«${esc(sig[2])}»</b>. Te faltan ${sig[0] - activos}.</p><div class="xp"><i style="width:${Math.min(100, activos / sig[0] * 100)}%"></i></div></div>` : `<div class="panel"><p class="summary">🏅 ¡Desbloqueaste todos los títulos de invitación!</p></div>`}
    <div class="panel"><span class="label">Tus invitados</span>
      ${lista.length ? `<ul class="players">${lista.map(x => `<li>${retrato(Cuenta.lookValido(x.look) || { color: "#748ffc", acc: [] }, 34)}<span class="name">${esc(x.nombre)}<small class="sub"> · ${x.activo ? "✅ ya juega" : `🎮 ${x.partidas}/${d.partidas} partidas`}</small></span>${x.pagado ? `<span class="badge">+${d.premio} 🪙</span>` : ""}</li>`).join("")}</ul>` : `<p class="empty">${d ? "Todavía no invitaste a nadie. ¡Mándale el link a tus amigos!" : "Cargando…"}</p>`}
    </div>
    <p class="summary center">Solo cuentan cuentas nuevas, una vez por persona. El premio llega solo cuando tu amigo juega.</p>
    <button class="btn ghost" id="rVolver">Volver</button>
  </section>`;
  on("rCompartir", () => Referidos.compartir(d.codigo));
  on("rCopiar", () => Referidos.copiar(Referidos.texto(d.codigo)));
  on("rVolver", () => go("home"));
};
