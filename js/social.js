/* Amigos, chat privado e invitaciones (Supabase: tablas amistades y mensajes).
   Solo para perfiles en la nube. Los mensajes nuevos llegan en tiempo real y, por las dudas, también se revisan cada tanto. */
const Social = {
  amistades: [], perfiles: {}, noLeidos: [], ultimoVisto: 0, timer: null, canal: null, cargando: false,

  disponible() { const u = BD.sesion(); return !!(u && u.nube && typeof Nube !== "undefined" && Nube.estado === "lista" && Nube.user && Nube.user.id === u.id); },
  yo() { return Nube.user.id; },
  pendientes() { return this.amistades.filter(a => a.estado === "pendiente" && a.para === this.yo()); },
  amigos() { return this.amistades.filter(a => a.estado === "aceptada").map(a => a.de === this.yo() ? a.para : a.de); },
  enviadas() { return this.amistades.filter(a => a.estado === "pendiente" && a.de === this.yo()).map(a => a.para); },
  avisos() { return this.disponible() ? this.noLeidos.length + this.pendientes().length : 0; },

  boton() {
    if (!this.disponible()) return "";
    const n = this.avisos();
    return `<button class="btn ghost chico ${n ? "aviso" : ""}" id="verAmigos" aria-label="Amigos y mensajes${n ? `, ${n} sin ver` : ""}">💬${n ? ` ${n}` : ""}</button>`;
  },

  arrancar() {
    if (this.timer || !this.disponible()) return;
    this.refrescar();
    this.timer = setInterval(() => { if (this.disponible()) this.refrescar(); else this.parar(); }, 12000);
    try {
      this.canal = Nube.sb.channel("mensajes-" + this.yo())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `para=eq.${this.yo()}` }, () => this.refrescar())
        .subscribe();
    } catch (e) { console.warn("Sin tiempo real, se revisa cada 12 s", e); }
  },
  parar() {
    clearInterval(this.timer); this.timer = null;
    try { if (this.canal) Nube.sb.removeChannel(this.canal); } catch {}
    this.canal = null; this.amistades = []; this.noLeidos = [];
  },

  async refrescar() {
    if (!this.disponible() || this.cargando) return;
    this.cargando = true;
    try {
      const sb = Nube.sb, yo = this.yo();
      const [am, ms] = await Promise.all([
        sb.from("amistades").select("*"),
        sb.from("mensajes").select("id,de,texto,sala,creado").eq("para", yo).eq("leido", false).order("creado", { ascending: false }).limit(50)
      ]);
      if (am.error || ms.error) throw am.error || ms.error;
      const antes = this.avisos();
      this.amistades = am.data;
      this.noLeidos = ms.data;
      await this.cargarPerfiles([...this.amistades.flatMap(a => [a.de, a.para]), ...ms.data.map(m => m.de)]);
      // Avisos de mensajes nuevos (salvo los de la charla abierta)
      const nuevos = ms.data.filter(m => m.id > this.ultimoVisto && !(S.screen === "charla" && UI.charla === m.de)).slice(0, 3);
      if (this.ultimoVisto) nuevos.reverse().forEach(m => {
        const p = this.perfiles[m.de] || { nombre: "Alguien" };
        Toast.mostrar(`<div class="t-ic">${m.sala ? "📨" : "💬"}</div><div class="t-txt"><b>${esc(p.nombre)}</b><span>${esc(m.texto.slice(0, 80))}</span></div>`, "info");
      });
      this.ultimoVisto = Math.max(this.ultimoVisto || 1, ...ms.data.map(m => m.id));
      if (S.screen === "charla") await this.cargarCharla();
      Nube.revisarRegalos(BD.sesion());
      if (antes !== this.avisos() || ["amigos", "charla", "home"].includes(S.screen)) render();
    } catch (e) { console.error(e); }
    this.cargando = false;
  },

  async cargarPerfiles(ids) {
    const falta = [...new Set(ids)].filter(id => id && !this.perfiles[id]);
    if (!falta.length) return;
    const { data, error } = await Nube.sb.from("perfiles").select("id,nombre,look").in("id", falta);
    if (!error) data.forEach(p => this.perfiles[p.id] = p);
  },

  async buscar(q) {
    const { data, error } = await Nube.sb.from("perfiles").select("id,nombre,look").ilike("nombre", `%${q}%`).limit(12);
    if (error) throw new Error("No se pudo buscar.");
    data.forEach(p => this.perfiles[p.id] = p);
    return data.filter(p => p.id !== this.yo());
  },
  async pedir(id) {
    // Si el otro ya me había pedido, se acepta directamente
    if (this.amistades.some(a => a.de === id && a.para === this.yo())) return this.aceptar(id);
    const { error } = await Nube.sb.from("amistades").insert({ de: this.yo(), para: id });
    if (error && !/duplicate|23505/.test(error.message + error.code)) throw new Error("No se pudo mandar la solicitud.");
    await this.refrescar();
  },
  async aceptar(de) {
    const { error } = await Nube.sb.from("amistades").update({ estado: "aceptada" }).eq("de", de).eq("para", this.yo());
    if (error) throw new Error("No se pudo aceptar.");
    await this.refrescar();
  },
  async quitar(otro) {
    await Nube.sb.from("amistades").delete().eq("de", this.yo()).eq("para", otro);
    await Nube.sb.from("amistades").delete().eq("de", otro).eq("para", this.yo());
    await this.refrescar();
  },

  charla: [],
  async cargarCharla() {
    const con = UI.charla, yo = this.yo();
    const { data, error } = await Nube.sb.from("mensajes").select("*").in("de", [yo, con]).in("para", [yo, con]).order("creado", { ascending: false }).limit(60);
    if (error) return;
    this.charla = data.filter(m => m.de !== m.para).reverse();
    if (data.some(m => m.para === yo && !m.leido)) {
      await Nube.sb.from("mensajes").update({ leido: true }).eq("para", yo).eq("de", con).eq("leido", false);
      this.noLeidos = this.noLeidos.filter(m => m.de !== con);
    }
  },
  async enviar(para, texto, sala = null) {
    texto = String(texto).trim().slice(0, 500);
    if (!texto) return;
    const { error } = await Nube.sb.from("mensajes").insert({ de: this.yo(), para, texto, ...(sala ? { sala } : {}) });
    if (error) throw new Error("No se pudo enviar. ¿Siguen siendo amigos?");
  }
};

/* ---------- Pantalla de amigos ---------- */
PANTALLAS.amigos = () => {
  if (!Social.disponible()) {
    app.innerHTML = `${head(0)}<section class="stage">${personaje("#748ffc", "duda", 110)}<h2>Amigos y chat</h2>
      <p class="sub">Para agregar amigos y chatear, entra con tu cuenta en la nube (con tu correo).</p>
      <button class="btn" id="aCuenta">Iniciar sesión</button><button class="btn ghost" id="aVolver">Volver</button></section>`;
    on("aCuenta", () => go("cuenta")); on("aVolver", () => go("home"));
    return;
  }
  Social.arrancar();
  const P = id => Social.perfiles[id] || { nombre: "…", look: { color: "#748ffc", acc: [] } };
  const look = p => Cuenta.lookValido(p.look) || { color: "#748ffc", acc: [] };
  const amigos = Social.amigos(), pend = Social.pendientes(), env = Social.enviadas();
  const sinLeer = id => Social.noLeidos.filter(m => m.de === id).length;
  const res = UI.busqueda || null;
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>Amigos</h2><p class="sub">Busca a tus amigos por su nombre, chatea e invítalos a tu sala.</p></div>
    <form class="add" id="fBus"><input id="qAmigo" maxlength="16" placeholder="Buscar por nombre" autocomplete="off" value="${esc(UI.qAmigo || "")}" aria-label="Buscar amigos"><button type="submit" aria-label="Buscar">🔍</button></form>
    ${res ? `<div class="panel"><span class="label">Resultados</span>${res.length ? `<ul class="players">${res.map(p => {
        const ya = amigos.includes(p.id), pedido = env.includes(p.id);
        return `<li>${retrato(look(p), 34)}<span class="name">${esc(p.nombre)}</span>${ya ? `<span class="badge">Amigo</span>` : pedido ? `<span class="badge">Pedido</span>` : `<button class="btn chico" data-pedir="${p.id}">Agregar</button>`}</li>`; }).join("")}</ul>` : `<p class="empty">No encontramos a nadie con ese nombre.</p>`}</div>` : ""}
    ${pend.length ? `<div class="panel"><span class="label">Te quieren agregar</span><ul class="players">${pend.map(a => `<li>${retrato(look(P(a.de)), 34)}<span class="name">${esc(P(a.de).nombre)}</span><button class="btn chico" data-aceptar="${a.de}">Aceptar</button><button class="x" data-quitar="${a.de}" aria-label="Rechazar">×</button></li>`).join("")}</ul></div>` : ""}
    <div class="panel"><span class="label">Tus amigos (${amigos.length})</span>
      ${amigos.length ? `<ul class="players">${amigos.map(id => `<li class="amigo" data-charla="${id}">${retrato(look(P(id)), 38)}<span class="name">${esc(P(id).nombre)}${P(id).look && P(id).look.titulo ? `<small class="tit-mini">${esc(P(id).look.titulo)}</small>` : ""}</span>${sinLeer(id) ? `<span class="burbuja">${sinLeer(id)}</span>` : ""}<span class="ir">💬</span></li>`).join("")}</ul>` : `<p class="empty">Todavía no tienes amigos agregados. Búscalos arriba por su nombre.</p>`}
      ${env.length ? `<p class="summary">Esperando respuesta: ${env.map(id => esc(P(id).nombre)).join(", ")}</p>` : ""}
    </div>
    <button class="btn ghost" id="aVolver">Volver</button>
  </section>`;
  byId("fBus").onsubmit = async e => {
    e.preventDefault();
    const q = byId("qAmigo").value.trim(); UI.qAmigo = q;
    if (q.length < 2) { UI.busqueda = null; return render(); }
    try { UI.busqueda = await Social.buscar(q); } catch { UI.busqueda = []; }
    render();
  };
  app.querySelectorAll("[data-pedir]").forEach(b => b.onclick = async () => { b.disabled = true; try { await Social.pedir(b.dataset.pedir); Toast.mostrar(`<div class="t-ic">📨</div><div class="t-txt"><b>Solicitud enviada</b></div>`, "info"); } catch (err) { Toast.mostrar(`<div class="t-txt"><b>${esc(err.message)}</b></div>`, "info"); } render(); });
  app.querySelectorAll("[data-aceptar]").forEach(b => b.onclick = async () => { b.disabled = true; try { await Social.aceptar(b.dataset.aceptar); } catch {} render(); });
  app.querySelectorAll("[data-quitar]").forEach(b => b.onclick = async () => { await Social.quitar(b.dataset.quitar); render(); });
  app.querySelectorAll("[data-charla]").forEach(li => li.onclick = () => { UI.charla = li.dataset.charla; Social.charla = []; go("charla"); Social.cargarCharla().then(render); });
  on("aVolver", () => { UI.busqueda = null; go("home"); });
};

/* ---------- Charla con un amigo ---------- */
PANTALLAS.charla = () => {
  if (!Social.disponible() || !UI.charla) return go("amigos");
  const otro = Social.perfiles[UI.charla] || { nombre: "…", look: { color: "#748ffc", acc: [] } }, yo = Social.yo();
  const hora = t => new Date(t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const lista = byId("msgs"), abajo = !lista || lista.scrollHeight - lista.scrollTop - lista.clientHeight < 60;
  const borrador = byId("txtCharla") ? byId("txtCharla").value : "";
  app.innerHTML = `${head(0)}
  <section class="screen charla">
    <div class="charla-head"><button class="linkish" id="cVolver" aria-label="Volver">←</button>${retrato(Cuenta.lookValido(otro.look) || { color: "#748ffc", acc: [] }, 40)}<b>${esc(otro.nombre)}</b></div>
    <div class="msgs" id="msgs">${Social.charla.length ? Social.charla.map(m => `<div class="msg ${m.de === yo ? "mio" : ""}"><p>${esc(m.texto)}</p>${m.sala ? `<button class="btn chico" data-sala="${esc(m.sala)}">🎮 Unirme a la sala ${esc(m.sala)}</button>` : ""}<small>${hora(m.creado)}</small></div>`).join("") : `<p class="empty center">Todavía no hay mensajes. ¡Saluda!</p>`}</div>
    <div class="rapidos">${["👋 ¡Hola!", "¿Jugamos?", "😂", "🔥", "GG 🏆"].map(t => `<button class="chip-j" data-rap="${esc(t)}">${esc(t)}</button>`).join("")}</div>
    <form class="add" id="fCharla"><input id="txtCharla" maxlength="500" placeholder="Escribe un mensaje" autocomplete="off" aria-label="Mensaje"><button type="submit" aria-label="Enviar">➤</button></form>
    ${Net.activo() && Net.code ? `<button class="btn ghost" id="invAqui">📨 Invitarlo a mi sala ${esc(Net.code)}</button>` : ""}
  </section>`;
  const inp = byId("txtCharla"); inp.value = borrador;
  const l2 = byId("msgs"); if (abajo) l2.scrollTop = l2.scrollHeight;
  const mandar = async (txt, sala) => {
    try { await Social.enviar(UI.charla, txt, sala); inp.value = ""; await Social.cargarCharla(); render(); const l = byId("msgs"); if (l) l.scrollTop = l.scrollHeight; }
    catch (err) { Toast.mostrar(`<div class="t-txt"><b>${esc(err.message)}</b></div>`, "info"); }
  };
  byId("fCharla").onsubmit = e => { e.preventDefault(); mandar(inp.value); };
  app.querySelectorAll("[data-rap]").forEach(b => b.onclick = () => mandar(b.dataset.rap));
  app.querySelectorAll("[data-sala]").forEach(b => b.onclick = () => { const u = BD.sesion(); Net.unirse(b.dataset.sala, u ? u.nombre : store.get("nombre", "Jugador")); });
  on("invAqui", () => mandar(`¡Vení a jugar conmigo! Sala ${Net.code}`, Net.code));
  on("cVolver", () => go("amigos"));
};

/* Invitar amigos desde la sala online */
function invitarAmigos() {
  const caja = document.createElement("div");
  caja.className = "modal-fondo";
  const amigos = Social.amigos();
  caja.innerHTML = `<div class="modal"><span class="label">Invitar a la sala ${esc(Net.code)}</span>
    ${amigos.length ? `<ul class="players">${amigos.map(id => { const p = Social.perfiles[id] || { nombre: "…" }; return `<li>${retrato(Cuenta.lookValido(p.look) || { color: "#748ffc", acc: [] }, 34)}<span class="name">${esc(p.nombre)}</span><button class="btn chico" data-inv="${id}">Invitar</button></li>`; }).join("")}</ul>` : `<p class="empty">Todavía no tienes amigos. Agrégalos desde el inicio, en 💬.</p>`}
    <button class="btn ghost" id="cerrarInv">Listo</button></div>`;
  document.body.appendChild(caja);
  caja.querySelectorAll("[data-inv]").forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = "Enviando…";
    try { await Social.enviar(b.dataset.inv, `¡Vení a jugar conmigo! Sala ${Net.code}`, Net.code); b.textContent = "✓ Invitado"; }
    catch { b.textContent = "No se pudo"; }
  });
  caja.querySelector("#cerrarInv").onclick = () => caja.remove();
  caja.onclick = e => { if (e.target === caja) caja.remove(); };
}
