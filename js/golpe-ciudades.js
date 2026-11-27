/* Golpe: terrenos en otras ciudades y clanes (todo en la nube, ver supabase/golpe.sql).
   - 3 ciudades con lotes limitados. Cada una tiene 4 zonas: la controla el clan con más terrenos (mínimo 2).
   - Cada terreno paga renta por día; cada zona que controla tu clan suma $500 por día.
   - Clanes: crear uno cuesta $5.000; se entra con el código de invitación; hasta 12 miembros. */
const GC = {
  CIUDADES: [["villa", "Villa Norte", 16, 15000, 300], ["puerto", "Puerto Sur", 16, 30000, 600], ["alto", "Barrio Alto", 12, 60000, 1200]],
  zona(lotes, l) { return Math.floor((l - 1) * 4 / lotes) + 1; },
  MOTIVOS: { plata: "No te alcanza la plata.", ocupado: "Ese lote ya tiene dueño.", tope: "Ya tenés 2 terrenos (es el máximo).", "ya tenés clan": "Ya estás en un clan.", "nombre usado": "Ese nombre o tag ya existe.", "código": "Ese código no existe.", lleno: "El clan está lleno (12).", cobrada: "Ya cobraste la renta de hoy.", nada: "Todavía no tenés nada que cobre renta.", datos: "Revisá los datos.", "sin cuenta": "Primero jugá una partida." }
};

Object.assign(Golpe, {
  async mundo() {
    if (!Golpe.enNube()) return;
    GC.cargando = true;
    try {
      await Golpe.sincronizar();
      const { data, error } = await Nube.sb.rpc("golpe_mundo");
      if (error) throw error;
      GC.m = data; GC.err = "";
      store.set(Golpe.claveP("Clan"), data.clan ? data.clan.tag : "");
    } catch (e) { GC.err = /golpe_mundo|PGRST202|does not exist/i.test((e.message || "") + (e.code || "")) ? "Falta activar las ciudades en la base de datos." : "No se pudo cargar. Revisá la conexión."; }
    GC.cargando = false;
    if (S.screen === "golpeCiudades") render();
  },
  async llamar(fn, args, ok) {
    try {
      const { data, error } = await Nube.sb.rpc(fn, args || {});
      if (error) throw error;
      if (!data.ok) { toast(GC.MOTIVOS[data.motivo] || "No se pudo."); return; }
      if (data.plata !== undefined) { const b = Golpe.banco(); b.total = Number(data.plata); store.set(Golpe.claveP("Banco"), b); }
      if (ok) ok(data);
      Golpe.mundo();
    } catch (e) { toast("No se pudo: revisá la conexión."); }
  },
  clanTag() { return store.get(Golpe.claveP("Clan"), ""); },

  pantallaCiudades() {
    const u = BD.sesion();
    if (!Golpe.enNube()) {
      app.innerHTML = `${head(0)}<section class="screen ex-golpe"><div class="tb-hero"><span class="tb-neon">CIUDADES</span></div>
        <div class="panel"><p>Los terrenos y los clanes se comparten con todos los jugadores, así que necesitan tu cuenta en la nube.</p>
        <p class="sub">${u && u.nube ? "Falta activar Golpe en la base de datos (supabase/golpe.sql)." : "Iniciá sesión desde tu perfil para comprar terrenos y armar un clan."}</p></div>
        <button class="btn ghost" id="gcAtras">Volver</button></section>`;
      on("gcAtras", () => go("golpeIntro")); return;
    }
    if (!GC.m && !GC.cargando && !GC.err) Golpe.mundo();
    const m = GC.m, plata = Golpe.banco().total, sel = GC.sel || "villa";
    const misLotes = m ? m.lotes.filter(l => l.yo) : [];
    let cuerpo = "";
    if (GC.err) cuerpo = `<div class="panel"><p>${esc(GC.err)}</p><button class="btn small" id="gcReint">Reintentar</button></div>`;
    else if (!m) cuerpo = `<div class="panel"><p class="sub">Cargando…</p></div>`;
    else {
      const C = GC.CIUDADES.find(c => c[0] === sel), [cid, cnom, nl, precio, renta] = C;
      const zonas = [1, 2, 3, 4].map(z => {
        const ctrl = m.zonas.find(x => x.c === cid && x.z === z);
        const lotes = Array.from({ length: nl }, (_, i) => i + 1).filter(l => GC.zona(nl, l) === z).map(l => {
          const L = m.lotes.find(x => x.c === cid && x.l === l);
          if (!L) return `<button class="gc-lote libre" data-comprar="${l}"><b>Lote ${l}</b><small>Libre · $${precio.toLocaleString("es-AR")}</small></button>`;
          if (L.yo) return `<button class="gc-lote mio" data-vender="${l}"><b>Lote ${l}</b><small>Tuyo · vender</small></button>`;
          return `<div class="gc-lote ocupado"><b>Lote ${l}</b><small>${esc(L.nombre)}${L.tag ? ` [${esc(L.tag)}]` : ""}</small></div>`;
        }).join("");
        return `<div class="gc-zona ${ctrl && ctrl.mia ? "mia" : ""}"><div class="gc-zona-cab"><span>Zona ${z}</span><small>${ctrl ? `Controla [${esc(ctrl.tag)}] ${esc(ctrl.nombre)}` : "Sin control"}</small></div><div class="gc-lotes">${lotes}</div></div>`;
      }).join("");
      const clan = m.clan;
      cuerpo = `
        <div class="panel gc-resumen"><div><span class="sub">Plata guardada</span><b>$${plata.toLocaleString("es-AR")}</b></div>
          <div><span class="sub">Tus terrenos</span><b>${misLotes.length}/2</b></div>
          <button class="btn small" id="gcRenta" ${m.renta && m.renta.cobrada ? "disabled" : ""}>${m.renta && m.renta.cobrada ? "Renta cobrada hoy" : "Cobrar renta de hoy"}</button></div>
        <div class="seg gc-tabs">${GC.CIUDADES.map(c => `<button aria-pressed="${c[0] === sel}" data-ciudad="${c[0]}">${c[1]}</button>`).join("")}</div>
        <div class="panel"><div class="gc-ciudad-cab"><b>${cnom}</b><small>${nl} lotes · $${precio.toLocaleString("es-AR")} cada uno · renta $${renta}/día</small></div>${zonas}
          <small class="sub">Una zona la controla el clan con más terrenos en ella (mínimo 2). Cada zona controlada le suma $500 por día a cada miembro.</small></div>
        <div class="panel gc-clan"><span class="label">Clan</span>
          ${clan ? `<p class="gc-clan-nom"><b>[${esc(clan.tag)}] ${esc(clan.nombre)}</b>${clan.lider ? " · sos el líder" : ""}</p>
            <p>Código para invitar: <b class="gc-codigo">${esc(clan.codigo)}</b> <button class="btn small ghost" id="gcCopiar">Copiar</button></p>
            <ul class="players">${clan.miembros.map(x => `<li><span class="name">${esc(x.nombre)}</span><small>${x.lider ? "Líder" : ""}</small></li>`).join("")}</ul>
            <p class="sub">Zonas que controlan: ${m.zonas.filter(z => z.mia).map(z => `${GC.CIUDADES.find(c => c[0] === z.c)[1]} ${z.z}`).join(", ") || "ninguna todavía"}</p>
            <button class="btn small ghost" id="gcSalir">Salir del clan</button>`
          : `<p class="sub">Con un clan pueden controlar zonas y cobrar más renta. El tag aparece al lado de tu nombre en la ciudad.</p>
            <div class="gc-form"><input id="gcNombre" maxlength="20" placeholder="Nombre del clan"><input id="gcTag" maxlength="4" placeholder="TAG"><button class="btn small" id="gcCrear">Crear · $5.000</button></div>
            <div class="gc-form"><input id="gcCodigo" maxlength="6" placeholder="Código de invitación"><button class="btn small ghost" id="gcUnirse">Unirme</button></div>`}
          ${m.clanes.length ? `<details><summary class="sub">Clanes (${m.clanes.length})</summary><ul class="players">${m.clanes.map(k => `<li><span class="name">[${esc(k.tag)}] ${esc(k.nombre)}</span><small>${k.miembros} miembro${k.miembros === 1 ? "" : "s"}</small></li>`).join("")}</ul></details>` : ""}
        </div>`;
    }
    app.innerHTML = `${head(0)}<section class="screen ex-golpe gc"><div class="tb-hero"><span class="tb-neon">CIUDADES</span><p class="sub">Comprá terrenos con lo que sacás de los golpes y armá un clan para controlar zonas.</p></div>
      ${cuerpo}<button class="btn ghost" id="gcAtras">Volver</button></section>`;
    on("gcAtras", () => go("golpeIntro"));
    on("gcReint", () => { GC.err = ""; Golpe.mundo(); render(); });
    on("gcRenta", () => Golpe.llamar("golpe_cobrar_renta", {}, d => toast(`Cobraste $${d.terrenos + d.zonas} de renta`)));
    app.querySelectorAll("[data-ciudad]").forEach(b => b.onclick = () => { GC.sel = b.dataset.ciudad; render(); });
    app.querySelectorAll("[data-comprar]").forEach(b => b.onclick = () => {
      const C = GC.CIUDADES.find(c => c[0] === sel);
      if (confirm(`¿Comprar el lote ${b.dataset.comprar} de ${C[1]} por $${C[3].toLocaleString("es-AR")}?`)) Golpe.llamar("golpe_comprar_terreno", { ciudad: sel, lote: +b.dataset.comprar }, () => toast("¡Terreno comprado!"));
    });
    app.querySelectorAll("[data-vender]").forEach(b => b.onclick = () => {
      const C = GC.CIUDADES.find(c => c[0] === sel);
      if (confirm(`¿Vender el lote ${b.dataset.vender}? Recibís el 70%: $${Math.floor(C[3] * 0.7).toLocaleString("es-AR")}.`)) Golpe.llamar("golpe_vender_terreno", { ciudad: sel, lote: +b.dataset.vender }, d => toast(`Vendido por $${d.recibido}`));
    });
    on("gcCrear", () => { const n = byId("gcNombre").value.trim(), t = byId("gcTag").value.trim().toUpperCase(); if (n.length < 3 || !/^[A-Z0-9]{2,4}$/.test(t)) return toast("Nombre de 3 a 20 letras y tag de 2 a 4 letras o números."); Golpe.llamar("golpe_clan_crear", { nombre: n, tag: t }, () => toast("¡Clan creado!")); });
    on("gcUnirse", () => { const c = byId("gcCodigo").value.trim(); if (c.length < 4) return toast("Escribí el código."); Golpe.llamar("golpe_clan_unirse", { codigo: c }, d => toast(`Entraste a [${d.tag}] ${d.nombre}`)); });
    on("gcCopiar", () => { try { navigator.clipboard.writeText(m.clan.codigo); toast("Código copiado"); } catch { } });
    on("gcSalir", () => { if (confirm("¿Salir del clan?")) Golpe.llamar("golpe_clan_salir", {}, () => toast("Saliste del clan")); });
  }
});
PANTALLAS.golpeCiudades = () => Golpe.pantallaCiudades();
