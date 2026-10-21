/* Tarjetas de perfil y código de amigo (solo perfiles en la nube).
   - Cada perfil tiene un código único (tag) que pone el servidor y no cambia nunca: sirve para agregarlo como amigo.
   - La tarjeta muestra nivel, trofeos y estadísticas. Si el perfil es privado, los que no son amigos ven solo el nombre y el código.
   - El link ?amigo=CÓDIGO abre la tarjeta de esa persona para mandarle la solicitud.
   - El nombre se cambia pagando monedas (lo cobra el servidor con cambiar_nombre). */
const TARJETA = { PRECIO_NOMBRE: 500 };

const Tarjeta = {
  cache: {},

  capturar() {
    const m = /[?&]amigo=#?([A-Za-z0-9]{6})/.exec(location.search);
    if (m) store.set("amigoPendiente", { c: m[1].toUpperCase(), t: Date.now() });
  },
  /* Si se entró con el link de alguien, abre su tarjeta apenas hay sesión en la nube */
  revisarPendiente() {
    const p = store.get("amigoPendiente", null);
    if (!p || !Social.disponible()) return;
    store.set("amigoPendiente", null);
    if (Date.now() - p.t < 14 * 864e5) this.abrir({ tag: p.c });
  },

  enlace(tag) {
    const ref = typeof Referidos !== "undefined" && Referidos.datos && Referidos.datos.codigo;
    return location.origin + location.pathname.replace(/[^/]*$/, "") + `index.html?amigo=${tag}${ref ? `&ref=${ref}` : ""}`;
  },
  async compartir(u) {
    if (!u.tag) return;
    const t = `¡Agregame en Mesa Loca! 🎉 Mi código es #${u.tag}. Entrá acá y mandame la solicitud: ${this.enlace(u.tag)}`;
    if (navigator.share) { try { await navigator.share({ title: "Mesa Loca", text: t }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    this.copiar(t, "Link copiado", "Pegalo en WhatsApp o donde quieras.");
  },
  async copiar(txt, titulo = "Copiado", sub = "") {
    try { await navigator.clipboard.writeText(txt); Toast.mostrar(`<div class="t-ic">📋</div><div class="t-txt"><b>${esc(titulo)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</div>`, "info"); }
    catch { Toast.mostrar(`<div class="t-txt"><b>${esc(txt)}</b></div>`, "info"); }
  },
  codigoValido(q) { return /^#?[A-Za-z0-9]{6}$/.test(String(q).trim()); },

  async traer({ id, tag }) {
    const { data, error } = await Nube.sb.rpc("tarjeta", id ? { quien: id } : { codigo: tag });
    if (error) throw new Error("No se pudo cargar el perfil.");
    if (data) { this.cache[data.id] = data; Social.perfiles[data.id] = Social.perfiles[data.id] || { id: data.id, nombre: data.nombre, look: data.look }; }
    return data;
  },

  /* ---------- La tarjeta ---------- */
  html(t) {
    const yo = Social.disponible() ? Social.yo() : null, soyYo = t.id === yo;
    const look = Cuenta.lookValido(t.look) || { color: "#748ffc", acc: [] };
    const nv = nivelDe(t.puntos || 0);
    const color = look.color || "#748ffc";
    const cab = `<div class="tj-cab" style="--tc:${esc(color)}">
      <div class="tj-brillo"></div>
      <div class="tj-retrato">${retrato(look, 104)}</div>
      <div class="tj-id"><b class="tj-nombre">${esc(t.nombre)}</b>${look.titulo ? `<span class="titulo-perfil">«${esc(look.titulo)}»</span>` : ""}
        <button class="tj-tag" data-copiar-tag="${esc(t.tag)}" aria-label="Copiar el código ${esc(t.tag)}">#${esc(t.tag)} <i>📋</i></button>
        <span class="tj-nivel">Nivel ${nv.n} · ${esc(nv.titulo)}</span></div></div>`;
    if (!t.completa) return `<div class="tarjeta-perfil privada">${cab}<div class="tj-cuerpo"><div class="tj-candado">🔒</div><b>Perfil privado</b><p class="sub">Solo sus amigos ven sus trofeos y estadísticas.</p></div>${this.acciones(t)}</div>`;
    const u = { stats: statsVacias() };
    for (const j in u.stats) Object.assign(u.stats[j], (t.stats || {})[j] || {});
    const jugadas = total(u, "j"), ganadas = total(u, "g"), logros = LOGROS.filter(l => (t.logros || {})[l.id]);
    const juegos = Object.keys(JUEGOS).map(k => ({ k, ...u.stats[k] })).filter(x => x.j).sort((a, b) => (b.p || 0) - (a.p || 0));
    const maxP = Math.max(1, ...juegos.map(x => x.p || 0));
    const IC = { impostor: "🎭", liars: "🤥", casos: "🔍", chinchon: "🎴", truco: "🗡️", burako: "🀄", poker: "♠️", carrera: "🏁", naval: "⚓", ajedrez: "♚", nave: "🚀", arena: "⚔️", bowling: "🎳", arco: "🏹", circo: "🎪", preguntas: "❓" };
    // Arena: el héroe con más nivel
    let heroe = null;
    if (t.arena && t.arena.pj && typeof Heroes !== "undefined") {
      for (const [k, q] of Object.entries(t.arena.pj)) { if (!AR.CLASES[k] || !q) continue; const l = Heroes.nivel(q.xp || 0, q.pre || 0); if (!heroe || (q.pre || 0) * 100 + l.n > heroe.orden) heroe = { k, n: l.n, pre: q.pre || 0, orden: (q.pre || 0) * 100 + l.n }; }
    }
    const torre = t.torre && typeof Torre !== "undefined" && t.torre.key === Torre.temporada().key ? t.torre.mejor || 0 : 0;
    const destacados = [
      u.stats.arena.j ? [`⚔️`, `${u.stats.arena.elo || 1000}`, "ELO de arena"] : null,
      heroe ? [AR.CLASES[heroe.k].ic, `Nv ${heroe.n}${heroe.pre ? ` · P${heroe.pre}` : ""}`, AR.CLASES[heroe.k].nombre] : null,
      torre ? ["🗼", `Piso ${torre}`, "Torre (temporada)"] : null,
      t.mejor_racha ? ["🔥", t.mejor_racha, "Mejor racha"] : null
    ].filter(Boolean);
    return `<div class="tarjeta-perfil">${cab}
      <div class="tj-cuerpo">
        <div class="tj-nums"><div><b>${jugadas}</b><small>Partidas</small></div><div><b>${ganadas}</b><small>Victorias</small></div><div><b>${jugadas ? Math.round(ganadas / jugadas * 100) : 0}%</b><small>Ganadas</small></div><div><b>${t.puntos || 0}</b><small>Puntos</small></div></div>
        ${destacados.length ? `<div class="tj-dest">${destacados.map(([ic, v, txt]) => `<div><span>${ic}</span><b>${esc(String(v))}</b><small>${esc(txt)}</small></div>`).join("")}</div>` : ""}
        <div class="tj-sec"><span class="label">🏆 Trofeos <em>${logros.length}/${LOGROS.length}</em></span>
          ${logros.length ? `<div class="tj-trofeos">${logros.map(l => `<span class="tj-trofeo" title="${esc(l.nombre)}: ${esc(l.desc)}">${l.ic}</span>`).join("")}</div>` : `<p class="empty">Todavía sin trofeos.</p>`}</div>
        <div class="tj-sec"><span class="label">🎮 Por juego</span>
          ${juegos.length ? `<ul class="tj-juegos">${juegos.slice(0, 8).map(x => `<li><span class="ic">${IC[x.k] || "🎲"}</span><div><b>${esc(JUEGOS[x.k])}</b><div class="tj-barra"><i style="width:${Math.max(4, Math.round((x.p || 0) / maxP * 100))}%"></i></div></div><small>${x.k === "arena" ? `${x.elo || 1000} ELO` : `${x.p || 0} pts`}<br>${x.g || 0}/${x.j} ganadas</small></li>`).join("")}</ul>` : `<p class="empty">Todavía no jugó partidas con su cuenta.</p>`}</div>
        <small class="tj-alta">${t.publico ? "🌍 Perfil público" : "🔒 Perfil privado"} · en Mesa Loca desde ${new Date(t.creado).toLocaleDateString("es", { month: "long", year: "numeric" })}</small>
      </div>${this.acciones(t)}</div>`;
  },
  acciones(t) {
    if (!Social.disponible()) return "";
    const id = t.id;
    if (id === Social.yo()) return `<div class="tj-acc"><button class="btn" data-tj-compartir>📤 Compartir mi tarjeta</button></div>`;
    const amigo = Social.amigos().includes(id), pedido = Social.enviadas().includes(id), meQuiere = Social.pendientes().some(a => a.de === id);
    return `<div class="tj-acc">${amigo ? `<button class="btn" data-tj-charla="${id}">💬 Mensaje</button><span class="badge">✓ Amigos</span>`
      : meQuiere ? `<button class="btn" data-tj-aceptar="${id}">✅ Aceptar solicitud</button>`
      : pedido ? `<button class="btn ghost" disabled>📨 Solicitud enviada</button>`
      : `<button class="btn" data-tj-pedir="${id}">➕ Agregar como amigo</button>`}</div>`;
  },

  /* Abre la tarjeta en una ventana encima de la pantalla */
  async abrir(q) {
    const caja = document.createElement("div");
    caja.className = "modal-fondo tj-fondo";
    caja.innerHTML = `<div class="modal tj-modal"><div class="tj-lugar"><p class="empty">Cargando perfil…</p></div><button class="btn ghost tj-cerrar-abajo">Cerrar</button></div>`;
    // Si ya había una tarjeta abierta (por ejemplo, desde el link), se reemplaza
    document.querySelectorAll(".tj-fondo").forEach(x => x.cerrarTarjeta ? x.cerrarTarjeta(true) : x.remove());
    // La X va aparte (fuera del fondo con desenfoque) para que quede fija arriba aunque se baje
    const x = document.createElement("button");
    x.className = "tj-cerrar"; x.setAttribute("aria-label", "Cerrar"); x.textContent = "×";
    document.body.append(caja, x);
    document.documentElement.classList.add("tj-abierta");
    // El gesto o el botón de "atrás" del teléfono también la cierra
    let conHistoria = false;
    try { history.pushState({ tarjeta: 1 }, ""); conHistoria = true; } catch {}
    const alVolver = () => { conHistoria = false; cerrar(); };
    const conTecla = e => { if (e.key === "Escape") cerrar(); };
    const cerrar = (sinVolver = false) => {
      if (!caja.isConnected) return;
      caja.remove(); x.remove();
      window.removeEventListener("popstate", alVolver); document.removeEventListener("keydown", conTecla);
      if (!document.querySelector(".tj-fondo")) document.documentElement.classList.remove("tj-abierta");
      if (conHistoria && !sinVolver) { conHistoria = false; history.back(); }
    };
    caja.cerrarTarjeta = cerrar;
    window.addEventListener("popstate", alVolver); document.addEventListener("keydown", conTecla);
    caja.onclick = e => { if (e.target === caja) cerrar(); };
    x.onclick = () => cerrar();
    caja.querySelector(".tj-cerrar-abajo").onclick = () => cerrar();
    const lugar = caja.querySelector(".tj-lugar");
    let t = q.id && this.cache[q.id];
    const pintar = () => {
      lugar.innerHTML = t ? this.html(t) : `<p class="empty">No encontramos a nadie con el código #${esc(q.tag || "")}.</p>`;
      if (!t) return;
      lugar.querySelectorAll("[data-copiar-tag]").forEach(b => b.onclick = () => this.copiar("#" + b.dataset.copiarTag, `Código #${b.dataset.copiarTag} copiado`));
      lugar.querySelectorAll("[data-tj-compartir]").forEach(b => b.onclick = () => this.compartir(BD.sesion()));
      lugar.querySelectorAll("[data-tj-pedir]").forEach(b => b.onclick = async () => {
        b.disabled = true;
        try { await Social.pedir(b.dataset.tjPedir); Toast.mostrar(`<div class="t-ic">📨</div><div class="t-txt"><b>Solicitud enviada a ${esc(t.nombre)}</b></div>`, "info"); } catch (err) { Toast.mostrar(`<div class="t-txt"><b>${esc(err.message)}</b></div>`, "info"); }
        pintar(); render();
      });
      lugar.querySelectorAll("[data-tj-aceptar]").forEach(b => b.onclick = async () => {
        b.disabled = true;
        try { await Social.aceptar(b.dataset.tjAceptar); t = await this.traer({ id: t.id }) || t; } catch {}
        pintar(); render();
      });
      lugar.querySelectorAll("[data-tj-charla]").forEach(b => b.onclick = () => { cerrar(); UI.charla = b.dataset.tjCharla; Social.charla = []; go("charla"); Social.cargarCharla().then(render); });
    };
    if (t) pintar();
    try { t = await this.traer(q) || null; } catch (e) { if (!t) { lugar.innerHTML = `<p class="empty">${esc(e.message)}</p>`; return; } }
    if (caja.isConnected) pintar();
  },

  /* ---------- Panel en "Mi perfil": código, público y cambiar nombre ---------- */
  panel(u) {
    if (!u || !u.nube) return "";
    const precio = TARJETA.PRECIO_NOMBRE, alcanza = (u.monedas || 0) >= precio;
    return `<div class="panel tj-panel"><span class="label">Tu tarjeta de jugador</span>
      <div class="tj-mio">
        <div><small>Tu código de amigo</small>${u.tag ? `<button class="tj-tag grande" data-copiar-tag="${esc(u.tag)}">#${esc(u.tag)} <i>📋</i></button>` : `<b class="sub">Se genera al conectarte…</b>`}</div>
        <div class="row"><button class="btn ghost chico" id="tjVer">👤 Ver tarjeta</button><button class="btn ghost chico" id="tjComp" ${u.tag ? "" : "disabled"}>📤 Compartir</button></div>
      </div>
      <div class="opt"><div class="txt"><b>Perfil público</b><small>${u.publico ? "Cualquiera puede ver tu tarjeta y encontrarte por tu nombre." : "Solo tus amigos ven tu tarjeta. Los demás te agregan con tu código."}</small></div><button class="switch" role="switch" aria-checked="${!!u.publico}" id="tjPublico" aria-label="Perfil público"></button></div>
      ${UI.cambiarNombre ? `<form class="tj-nombre-f" id="fNombre"><label class="campo-l">Nuevo nombre<input class="campo" id="nuevoNombre" maxlength="16" minlength="2" value="${esc(u.nombre)}" autocomplete="off"></label>
          <div class="row"><button class="btn ghost" type="button" id="tjNomNo">Cancelar</button><button class="btn" type="submit" ${alcanza ? "" : "disabled"}>Cambiar · ${precio} 🪙</button></div>
          ${alcanza ? `<small class="sub">Tu código y tus amigos no cambian.</small>` : `<small class="sub">Te faltan ${precio - (u.monedas || 0)} 🪙.</small>`}${UI.errNombre ? `<p class="warn">${esc(UI.errNombre)}</p>` : ""}</form>`
        : `<button class="linkish" id="tjNombre">✏️ Cambiar mi nombre (${precio} 🪙)</button>`}
    </div>`;
  },
  conectarPanel(u) {
    if (!u || !u.nube) return;
    app.querySelectorAll(".tj-panel [data-copiar-tag]").forEach(b => b.onclick = () => this.copiar("#" + b.dataset.copiarTag, `Código #${b.dataset.copiarTag} copiado`, "Pasáselo a tus amigos para que te agreguen."));
    on("tjVer", () => this.abrir({ id: u.id }));
    on("tjComp", () => this.compartir(u));
    on("tjPublico", () => { u.publico = !u.publico; delete this.cache[u.id]; BD.guardar(); Nube.subir(u); render(); });
    on("tjNombre", () => { UI.cambiarNombre = true; UI.errNombre = ""; render(); });
    on("tjNomNo", () => { UI.cambiarNombre = false; render(); });
    const f = byId("fNombre");
    if (f) f.onsubmit = async e => {
      e.preventDefault();
      const nuevo = byId("nuevoNombre").value.trim();
      const b = f.querySelector("[type=submit]"); b.disabled = true;
      UI.errNombre = await this.cambiarNombre(u, nuevo);
      if (!UI.errNombre) UI.cambiarNombre = false;
      render();
    };
  },
  /* Devuelve "" si salió bien, o el motivo */
  async cambiarNombre(u, nuevo) {
    if (nuevo.length < 2) return "El nombre tiene que tener al menos 2 letras.";
    if (nuevo === u.nombre) return "Es el mismo nombre que ya tenés.";
    if (/[<>]/.test(nuevo)) return "El nombre no puede tener < ni >.";
    if (BD.usuarios().some(x => x.id !== u.id && x.nombre.toLowerCase() === nuevo.toLowerCase())) return "Ya hay un perfil con ese nombre en este teléfono.";
    return Nube.enCola(async () => {
      await Nube.subirYa(u);                        // primero se suben las monedas que estaban pendientes
      const { data, error } = await Nube.sb.rpc("cambiar_nombre", { nuevo });
      if (error) return "No se pudo cambiar el nombre. Probá de nuevo.";
      if (!data.ok) return data.motivo === "monedas" ? `Te faltan monedas: cuesta ${data.precio} 🪙.` : data.motivo === "igual" ? "Es el mismo nombre que ya tenés." : "Ese nombre no sirve. Usá de 2 a 16 letras.";
      const viejo = u.nombre;
      u.nombre = data.nombre; u.monedas = data.monedas;
      S.players = S.players.map(n => n === viejo ? data.nombre : n); save();
      delete this.cache[u.id];
      BD.guardar();
      Toast.mostrar(`<div class="t-ic">✏️</div><div class="t-txt"><b>Ahora te llamás ${esc(data.nombre)}</b><span>−${data.precio} 🪙 · tus amigos y tu código siguen igual</span></div>`, "logro");
      return "";
    });
  }
};
Tarjeta.capturar();
