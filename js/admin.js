/* Panel de administración: lee los datos de Supabase con funciones que solo responden a administradores. */
const EMU = /[?&]emu=1/.test(location.search);
const CFG = EMU ? { url: "http://127.0.0.1:54321", anonKey: "anon-key" } : window.SUPABASE_CONFIG;
const app = document.getElementById("app"), tip = document.getElementById("tip");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = n => new Intl.NumberFormat("es").format(n || 0);
const NOMBRES = { impostor: "El Impostor", liars: "Mentiroso", casos: "Detectives", chinchon: "Chinchón", truco: "Truco", burako: "Burako", poker: "Póker", ruleta: "Ruleta", tragamonedas: "Tragamonedas", bingo: "Bingo", naval: "Batalla naval", ajedrez: "Ajedrez", nave: "La Nave", tala: "Tala", mina: "Mina", pesca: "Pesca", arena: "Arena", evento: "Trabajo de evento" };
const SERIE = ["var(--s1)", "var(--s2)", "var(--s3)"];

const P = { sb: null, user: null, admin: null, dias: 30, datos: null, usuarios: [], q: "", msg: "", regalo: null, cargando: false };

async function iniciar() {
  if (!CFG) { app.innerHTML = `<section class="caja"><h1>Panel</h1><p class="sub">Falta la configuración de Supabase en <code>js/supabase-config.js</code>.</p></section>`; return; }
  P.sb = supabase.createClient(CFG.url, CFG.anonKey, { auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  P.sb.auth.onAuthStateChange((ev, s) => setTimeout(() => cambiar(s ? s.user : null), 0));
}

async function cambiar(user) {
  const antes = P.user && P.user.id;
  P.user = user;
  if (!user) { P.admin = null; return pintar(); }
  if (antes === user.id && P.admin !== null) return;
  const { data, error } = await P.sb.rpc("es_admin");
  P.admin = !error && data === true;
  if (P.admin) await cargar(); else pintar();
}

async function cargar() {
  P.cargando = true; pintar();
  const [r, u, ev, rf, rc] = await Promise.all([P.sb.rpc("panel_resumen", { dias: P.dias }), P.sb.rpc("panel_usuarios", { buscar: P.q }), P.sb.from("config").select("valor").eq("clave", "evento").maybeSingle(), P.sb.rpc("panel_referidos"), P.sb.from("config").select("valor").eq("clave", "referidos").maybeSingle()]);
  const [tb, tc] = await Promise.all([P.sb.rpc("panel_timba", { dias: P.dias }), P.sb.from("config").select("valor").eq("clave", "timba").maybeSingle()]);
  P.timba = tb.error ? null : tb.data;
  P.timbaCfg = Object.assign({ activo: true, maxApuesta: 500 }, (tc.data && tc.data.valor) || {});
  P.refs = rf.error ? null : rf.data;
  P.refCfg = Object.assign({ activo: true, premioInvitado: 100, premioInvitador: 150, partidas: 3, maxPorDia: 5 }, (rc.data && rc.data.valor) || {});
  P.evento = Object.assign({ id: null, trabajo: true, multi: 1, mensaje: "", items: {} }, (ev.data && ev.data.valor) || {});
  P.cargando = false;
  if (r.error) { P.msg = "No se pudieron cargar los datos: " + r.error.message; return pintar(); }
  P.datos = r.data; P.usuarios = u.data || [];
  pintar();
}

/* ---------- Pantallas ---------- */
function pintar() {
  if (!P.user) return pantallaLogin();
  if (P.admin === false) return pantallaSinPermiso();
  if (!P.datos) { app.innerHTML = `<p class="sub center">Cargando el panel…</p>`; return; }
  const d = P.datos, s = d.serie || [], cfg = d.config || { activos: false, monedas: 20, porDia: 5, prueba: true };
  // Los gráficos se dibujan al ancho real de su tarjeta, así el texto de los ejes no se achica
  const repartido = s.reduce((t, x) => t + x.mPartidas + x.mPremios + x.mAnuncios, 0), gastado = s.reduce((t, x) => t + x.gastado, 0);
  app.innerHTML = `
  <header class="p-cab">
    <div><span class="label">Panel de administración</span><h1><img src="img/icono.svg" alt="" width="40" height="40" style="vertical-align:-6px;margin-right:8px">Mesa <span>Loca</span></h1></div>
    <div class="p-acc">
      <div class="seg corto">${[7, 30, 90].map(n => `<button data-dias="${n}" aria-pressed="${P.dias === n}">${n} días</button>`).join("")}</div>
      <button class="btn ghost chico" id="recargar">${P.cargando ? "Actualizando…" : "↻ Actualizar"}</button>
      <button class="btn ghost chico" id="salir">Salir</button>
    </div>
  </header>
  ${P.msg ? `<p class="warn">${esc(P.msg)}</p>` : ""}

  <section class="kpis">
    ${kpi("Jugadores con cuenta", num(d.usuarios), `+${num(d.nuevos7)} en los últimos 7 días`)}
    ${kpi("Activos hoy", num(d.activosHoy), `${num(d.activos7)} distintos en 7 días`)}
    ${kpi("Partidas en 7 días", num(d.partidas7), `${num(d.partidasPeriodo)} en ${P.dias} días`)}
    ${kpi("Monedas en circulación", num(d.monedasCirculacion), `${num(d.gastado7)} gastadas en la tienda en 7 días`)}
    ${kpi("Anuncios vistos en 7 días", num(d.anuncios7), cfg.activos ? (cfg.prueba ? "Activos · modo prueba" : "Activos") : "Apagados")}
    ${kpi("Amistades", num(d.amistades), `${num(d.mensajes7)} mensajes en 7 días`)}
  </section>

  <section class="graficos">
    <article class="tarjeta"><h2>Jugadores activos por día</h2><p class="sub">Personas distintas que jugaron, cobraron un premio o compraron algo.</p>${linea(s, "activos", "activos")}</article>
    <article class="tarjeta"><h2>Partidas por día</h2><p class="sub">Partidas terminadas por jugadores con cuenta.</p>${barras(s, "partidas", "partidas")}</article>
    <article class="tarjeta"><h2>Partidas por juego</h2><p class="sub">Últimos ${P.dias} días.</p>${horizontales(d.porJuego || {})}</article>
    <article class="tarjeta"><h2>Monedas repartidas por día</h2><p class="sub">En ${P.dias} días se repartieron <b>${num(repartido)}</b> y se gastaron <b>${num(gastado)}</b> en la tienda.</p>
      ${apiladas(s, [["mPartidas", "Por partidas"], ["mPremios", "Premios y regalos"], ["mAnuncios", "Anuncios"]])}</article>
  </section>

  <section class="tarjeta">
    <h2>Eventos de temporada</h2>
    <p class="sub">Prende un evento y los jugadores ven el cartel en el inicio, los colores de la temporada, la pestaña especial en la tienda y el trabajo del evento.</p>
    ${pantallaEvento()}
  </section>

  <section class="dos-col">
    <article class="tarjeta">
      <h2>Invitaciones (referidos)</h2>
      <p class="sub">${P.refs ? `${num(P.refs.total)} invitados en total · ${num(P.refs.activos)} ya juegan y cobraron premio.` : "Corre el SQL nuevo para ver los referidos."}</p>
      <form id="fRef" class="ads-form">
        <label class="opt"><span class="txt"><b>Invitaciones con premio</b><small>Si lo apagas, los links siguen funcionando pero no dan monedas.</small></span><input type="checkbox" id="rfOn" ${P.refCfg.activo ? "checked" : ""}></label>
        <div class="row"><label class="campo-l">🪙 al amigo nuevo<input class="campo" id="rfInv" type="number" min="0" max="500" value="${P.refCfg.premioInvitado}"></label>
          <label class="campo-l">🪙 al que invitó<input class="campo" id="rfDor" type="number" min="0" max="500" value="${P.refCfg.premioInvitador}"></label></div>
        <div class="row"><label class="campo-l">Partidas para cobrar<input class="campo" id="rfPar" type="number" min="1" max="50" value="${P.refCfg.partidas}"></label>
          <label class="campo-l">Máximo de premios por día<input class="campo" id="rfMax" type="number" min="1" max="50" value="${P.refCfg.maxPorDia}"></label></div>
        <button class="btn" type="submit">Guardar</button><p class="summary" id="rfMsg"></p>
      </form>
    </article>
    <article class="tarjeta">
      <h2>Los que más invitaron</h2>
      <ol class="tabla-rank">${(P.refs && P.refs.top || []).map((t, i) => `<li><span class="pos">${i + 1}</span>${mini(t.look)}<span class="nm"><b>${esc(t.nombre)}</b><small>${num(t.activos)} ya juegan</small></span><strong>${num(t.invitados)}</strong></li>`).join("") || `<p class="empty">Todavía nadie invitó amigos.</p>`}</ol>
    </article>
  </section>

  <section class="dos-col">
    <article class="tarjeta">
      <h2>🎰 Casino</h2>
      <p class="sub">${P.timba ? `En ${P.dias} días: ${num(P.timba.jugadas)} jugadas de ${num(P.timba.jugadores)} jugadores. Los jugadores ${P.timba.neto >= 0 ? "ganaron" : "perdieron"} <b>${num(Math.abs(P.timba.neto))}</b> 🪙 en total.` : "Corre el SQL nuevo para ver el casino."}</p>
      ${P.timba && Object.keys(P.timba.porJuego || {}).length ? `<ul class="tb-panel">${Object.entries(P.timba.porJuego).map(([j, x]) => `<li><b>${esc(NOMBRES[j] || j)}</b><span>${num(x.jugadas)} jugadas</span><span class="${x.neto >= 0 ? "pos" : "neg"}">${x.neto >= 0 ? "+" : "−"}${num(Math.abs(x.neto))} 🪙</span></li>`).join("")}</ul>` : ""}
      <form id="fTimba" class="ads-form">
        <label class="opt"><span class="txt"><b>Casino abierto</b><small>Ruleta, tragamonedas y bingo con monedas. Si lo cierras, nadie puede apostar.</small></span><input type="checkbox" id="tbOn" ${P.timbaCfg.activo ? "checked" : ""}></label>
        <label class="campo-l">Apuesta máxima por tirada (ruleta y tragamonedas)<input class="campo" id="tbMax" type="number" min="10" max="5000" value="${P.timbaCfg.maxApuesta}"></label>
        <button class="btn" type="submit">Guardar</button><p class="summary" id="tbMsg"></p>
      </form>
    </article>
    <article class="tarjeta">
      <h2>Anuncios con recompensa</h2>
      <p class="sub">Los jugadores con cuenta ven "Mirar un anuncio" en la tienda. El servidor controla el máximo por día.</p>
      <form id="fAds" class="ads-form">
        <label class="opt"><span class="txt"><b>Anuncios activos</b><small>Muestra el botón en la tienda.</small></span><input type="checkbox" id="adOn" ${cfg.activos ? "checked" : ""}></label>
        <label class="opt"><span class="txt"><b>Modo prueba</b><small>Anuncio de mentira de 10 s. Apágalo cuando conectes la red de anuncios.</small></span><input type="checkbox" id="adPrueba" ${cfg.prueba ? "checked" : ""}></label>
        <div class="row"><label class="campo-l">Monedas por anuncio<input class="campo" id="adMon" type="number" min="1" max="200" value="${cfg.monedas}"></label>
          <label class="campo-l">Máximo por día<input class="campo" id="adDia" type="number" min="0" max="50" value="${cfg.porDia}"></label></div>
        <button class="btn" type="submit">Guardar</button>
        <p class="summary" id="adMsg"></p>
      </form>
    </article>
    <article class="tarjeta">
      <h2>Top 10 por puntos</h2>
      <ol class="tabla-rank">${(d.top || []).map((u, i) => `<li><span class="pos">${i + 1}</span>${mini(u.look)}<span class="nm"><b>${esc(u.nombre)}</b><small>${num(u.monedas)} 🪙</small></span><strong>${num(u.puntos)}</strong></li>`).join("") || `<p class="empty">Todavía no hay jugadores.</p>`}</ol>
    </article>
  </section>

  <section class="tarjeta">
    <div class="headrow"><h2>Jugadores</h2><form id="fBus" class="add busca"><input id="q" placeholder="Buscar por nombre" value="${esc(P.q)}" aria-label="Buscar jugadores"><button type="submit" aria-label="Buscar">🔍</button></form></div>
    <div class="tabla-scroll"><table class="tabla">
      <thead><tr><th>Jugador</th><th class="n">Nivel</th><th class="n">Puntos</th><th class="n">Monedas</th><th class="n">Partidas</th><th>Última actividad</th><th>Alta</th><th></th></tr></thead>
      <tbody>${P.usuarios.map(u => `<tr><td><span class="u">${mini(u.look)}${esc(u.nombre)}</span></td><td class="n" title="${esc(nivelDe(u.puntos).titulo)}">${nivelDe(u.puntos).n}</td><td class="n">${num(u.puntos)}</td><td class="n">${num(u.monedas)}</td><td class="n">${num(u.partidas)}</td><td>${u.ultima ? fecha(u.ultima) : "—"}</td><td>${fecha(u.creado)}</td>
        <td>${P.regalo === u.id ? `<form class="regalo" data-id="${u.id}"><label class="campo-l">🪙 Monedas<input class="campo" type="number" step="1" value="0" name="m"></label><label class="campo-l">⭐ Puntos<input class="campo" type="number" step="1" value="0" name="p"></label><label class="campo-l">🏅 Llevar a nivel<select class="campo" name="nv" data-pts="${u.puntos}"><option value="">—</option>${NIVELES.map(([p, t], k) => `<option value="${p}" ${k + 1 === nivelDe(u.puntos).n ? "disabled" : ""}>${k + 1}. ${esc(t)}</option>`).join("")}</select></label><label class="campo-l">Motivo<input class="campo" maxlength="80" placeholder="Opcional" name="t"></label><button class="btn chico" type="submit">Enviar</button><button class="btn ghost chico" type="button" data-cancelar>✕</button></form><small class="sub">Negativo para quitar (ej. −100). El nivel sale de los puntos: al elegir un nivel se calculan los puntos que hay que sumar o quitar.</small>` : `<button class="btn ghost chico" data-regalo="${u.id}">✏️ Ajustar</button>`}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No hay jugadores${P.q ? " con ese nombre" : ""}.</td></tr>`}</tbody>
    </table></div>
  </section>
  <p class="summary center">La actividad se cuenta desde que se creó la tabla <code>actividad</code>; los días anteriores aparecen en cero.</p>`;

  app.querySelectorAll("[data-dias]").forEach(b => b.onclick = () => { P.dias = +b.dataset.dias; cargar(); });
  document.getElementById("recargar").onclick = cargar;
  document.getElementById("salir").onclick = async () => { await P.sb.auth.signOut(); P.user = null; pintar(); };
  document.getElementById("fBus").onsubmit = e => { e.preventDefault(); P.q = document.getElementById("q").value.trim(); cargar(); };
  app.querySelectorAll("[data-regalo]").forEach(b => b.onclick = () => { P.regalo = b.dataset.regalo; pintar(); });
  app.querySelectorAll("select[name=nv]").forEach(sel => sel.onchange = () => { if (sel.value !== "") sel.form.p.value = +sel.value - +sel.dataset.pts; });
  app.querySelectorAll("[data-cancelar]").forEach(b => b.onclick = () => { P.regalo = null; pintar(); });
  app.querySelectorAll("form.regalo").forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const m = Math.trunc(+f.m.value || 0), p = Math.trunc(+f.p.value || 0);
    if (!m && !p) { aviso("Pon monedas o puntos (negativo para quitar)."); return; }
    const u = P.usuarios.find(x => x.id === f.dataset.id);
    if ((m < 0 || p < 0) && !confirm(`¿Quitarle a ${u ? u.nombre : "este jugador"} ${[m < 0 ? -m + " monedas" : "", p < 0 ? -p + " puntos" : ""].filter(Boolean).join(" y ")}?`)) return;
    const { error } = await P.sb.rpc("admin_ajustar", { destino: f.dataset.id, monedas: m, puntos: p, motivo: f.t.value.trim() || null });
    P.regalo = null; P.msg = error ? "No se pudo enviar el ajuste: " + error.message : "";
    const txt = [m ? `${m > 0 ? "+" : ""}${m} 🪙` : "", p ? `${p > 0 ? "+" : ""}${p} pts` : ""].filter(Boolean).join(" · ");
    if (!error) aviso(`${m >= 0 && p >= 0 ? "🎁" : "🛠️"} ${txt} enviado. Se aplica la próxima vez que entre (la tabla se actualiza ahí).`);
    pintar();
  });
  document.getElementById("fAds").onsubmit = async e => {
    e.preventDefault();
    const valor = { activos: document.getElementById("adOn").checked, prueba: document.getElementById("adPrueba").checked,
      monedas: Math.max(1, Math.min(200, +document.getElementById("adMon").value || 20)), porDia: Math.max(0, Math.min(50, +document.getElementById("adDia").value || 0)) };
    const { error } = await P.sb.from("config").update({ valor }).eq("clave", "anuncios");
    document.getElementById("adMsg").textContent = error ? "No se pudo guardar: " + error.message : "Guardado. Los jugadores lo ven la próxima vez que abran el juego.";
    if (!error) P.datos.config = valor;
  };
  conectarEvento();
  const fr = document.getElementById("fRef");
  if (fr) fr.onsubmit = async e => {
    e.preventDefault();
    const n = (id, a, b, d) => Math.max(a, Math.min(b, Math.round(+document.getElementById(id).value || d)));
    const valor = { activo: document.getElementById("rfOn").checked, premioInvitado: n("rfInv", 0, 500, 100), premioInvitador: n("rfDor", 0, 500, 150), partidas: n("rfPar", 1, 50, 3), maxPorDia: n("rfMax", 1, 50, 5) };
    let { data, error } = await P.sb.from("config").update({ valor }).eq("clave", "referidos").select("clave");
    if (!error && (!data || !data.length)) { const r = await P.sb.from("config").insert({ clave: "referidos", valor }); error = r.error && r.error.code !== "23505" ? r.error : null; }
    document.getElementById("rfMsg").textContent = error ? "No se pudo guardar: " + error.message : "Guardado.";
    if (!error) P.refCfg = valor;
  };
  const ft = document.getElementById("fTimba");
  if (ft) ft.onsubmit = async e => {
    e.preventDefault();
    const valor = { activo: document.getElementById("tbOn").checked, maxApuesta: Math.max(10, Math.min(5000, Math.round(+document.getElementById("tbMax").value || 500))) };
    let { data, error } = await P.sb.from("config").update({ valor }).eq("clave", "timba").select("clave");
    if (!error && (!data || !data.length)) { const r = await P.sb.from("config").insert({ clave: "timba", valor }); error = r.error && r.error.code !== "23505" ? r.error : null; }
    document.getElementById("tbMsg").textContent = error ? "No se pudo guardar: " + error.message : "Guardado.";
    if (!error) P.timbaCfg = valor;
  };
  conectarTips();
  // Si el gráfico quedó de otro ancho que el calculado, se redibuja una vez con el ancho real
  const svg = app.querySelector(".graf svg");
  if (svg && Math.abs(svg.clientWidth - G.W) > 4) { G.W = Math.round(svg.clientWidth); pintar(); }
}

function pantallaLogin() {
  app.innerHTML = `<section class="caja"><span class="label">Panel de administración</span><h1><img src="img/icono.svg" alt="" width="40" height="40" style="vertical-align:-6px;margin-right:8px">Mesa <span>Loca</span></h1>
    <p class="sub">Entra con el mismo correo que usas en el juego. Te llega un enlace para entrar.</p>
    <form id="fLogin" class="add"><input class="campo" id="mail" type="email" placeholder="tu@correo.com" autocomplete="email" aria-label="Correo"><button class="btn chico" type="submit">Enviar</button></form>
    <form id="fCod" class="add" hidden><input class="campo" id="cod" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="Código del correo" aria-label="Código"><button class="btn chico" type="submit">Entrar</button></form>
    <p class="summary" id="lMsg">${esc(P.msg)}</p>
    </section>`;
  document.getElementById("fCod").onsubmit = async e => {
    e.preventDefault();
    const email = document.getElementById("mail").value.trim(), token = document.getElementById("cod").value.replace(/\D/g, "");
    const { error } = await P.sb.auth.verifyOtp({ email, token, type: "email" });
    if (error) document.getElementById("lMsg").textContent = "El código no es válido o ya venció.";
  };
  document.getElementById("fLogin").onsubmit = async e => {
    e.preventDefault();
    const email = document.getElementById("mail").value.trim();
    const { error } = await P.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname + location.search, shouldCreateUser: false } });
    document.getElementById("lMsg").textContent = error ? "No se pudo enviar el correo. ¿Es el mismo con el que juegas?" : `📬 Te mandamos un correo a ${email}. Abre el enlace en este dispositivo o escribe el código acá arriba.`;
    if (!error) document.getElementById("fCod").hidden = false;
  };
}

function pantallaSinPermiso() {
  app.innerHTML = `<section class="caja"><span class="label">Panel de administración</span><h1>Sin acceso</h1>
    <p class="sub">Entraste como <b>${esc(P.user.email || "este usuario")}</b>, pero no figuras como administrador.</p>
    <p class="sub">En Supabase → SQL Editor, corre una vez:</p>
    <pre class="sql">insert into public.admins (id)
select id from auth.users
where email = '${esc(P.user.email || "TU_CORREO")}'
on conflict do nothing;</pre>
    <div class="row"><button class="btn" id="otraVez">Ya lo hice, entrar</button><button class="btn ghost" id="salir">Salir</button></div></section>`;
  document.getElementById("otraVez").onclick = () => { P.admin = null; cambiar(P.user); };
  document.getElementById("salir").onclick = async () => { await P.sb.auth.signOut(); P.user = null; pintar(); };
}

/* ---------- Piezas ---------- */
const kpi = (t, v, sub) => `<div class="kpi"><span class="label">${t}</span><b>${v}</b><small>${sub}</small></div>`;
const fecha = f => new Date(f).toLocaleDateString("es", { day: "numeric", month: "short" });
const diaCorto = f => { const d = new Date(f + "T12:00:00"); return d.toLocaleDateString("es", { day: "numeric", month: "short" }); };
const mini = l => { l = l && l.color ? l : { color: "#748ffc", acc: [] }; return `<span class="av-mini">${personaje(l.color, "civ", 26, (l.acc || []).filter(a => ACCESORIOS[a]))}</span>`; };
function aviso(t) { const d = document.createElement("div"); d.className = "p-aviso"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }

/* Escala "bonita": tope redondo y 4 marcas */
function escala(max) {
  if (max <= 4) return { tope: 4, marcas: [0, 1, 2, 3, 4] };
  const paso0 = max / 4, mag = Math.pow(10, Math.floor(Math.log10(paso0))), paso = [1, 2, 2.5, 5, 10].map(m => m * mag).find(p => p >= paso0);
  const tope = Math.ceil(max / paso) * paso;
  return { tope, marcas: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) };
}

const G = { W: 640, H: 220, L: 40, R: 12, T: 12, B: 28 };
function ejes(sc, serie) {
  const { W, H, L, R, T, B } = G, h = H - T - B;
  const y = v => T + h - (v / sc.tope) * h;
  const cada = Math.ceil(serie.length / 6);
  return sc.marcas.map(m => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(m)}" y2="${y(m)}"/><text class="eje" x="${L - 6}" y="${y(m) + 4}" text-anchor="end">${num(m)}</text>`).join("")
    + serie.map((p, i) => i % cada === 0 || i === serie.length - 1 ? `<text class="eje" x="${xPos(i, serie.length)}" y="${H - 8}" text-anchor="middle">${diaCorto(p.dia)}</text>` : "").join("");
}
const xPos = (i, n) => G.L + (n === 1 ? (G.W - G.L - G.R) / 2 : (i / (n - 1)) * (G.W - G.L - G.R));

/* Línea con área (una serie) */
function linea(serie, clave, unidad) {
  if (!serie.length) return vacio();
  const sc = escala(Math.max(...serie.map(p => p[clave]))), h = G.H - G.T - G.B, y = v => G.T + h - (v / sc.tope) * h;
  const pts = serie.map((p, i) => [xPos(i, serie.length), y(p[clave])]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const ult = pts[pts.length - 1];
  return `<div class="graf"><svg viewBox="0 0 ${G.W} ${G.H}" role="img" aria-label="Gráfico de líneas: ${unidad} por día">
    ${ejes(sc, serie)}
    <path class="area" d="${d} L ${ult[0]} ${y(0)} L ${pts[0][0]} ${y(0)} Z" fill="var(--s1)"/>
    <path d="${d}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${ult[0]}" cy="${ult[1]}" r="4.5" fill="var(--s1)" stroke="var(--surf)" stroke-width="2"/>
    ${serie.map((p, i) => `<rect class="hit" x="${xPos(i, serie.length) - (G.W - G.L - G.R) / serie.length / 2}" y="${G.T}" width="${(G.W - G.L - G.R) / serie.length}" height="${h}" data-tip="${diaCorto(p.dia)}: <b>${num(p[clave])}</b> ${unidad}" data-x="${xPos(i, serie.length)}"/>`).join("")}
  </svg></div>${tablaSerie(serie, [[clave, unidad]])}`;
}

/* Barras verticales (una serie) */
function barras(serie, clave, unidad) {
  if (!serie.length) return vacio();
  const sc = escala(Math.max(...serie.map(p => p[clave]))), h = G.H - G.T - G.B, y = v => G.T + h - (v / sc.tope) * h;
  const anchoCelda = (G.W - G.L - G.R) / serie.length, bw = Math.max(2, Math.min(18, anchoCelda - 2));
  return `<div class="graf"><svg viewBox="0 0 ${G.W} ${G.H}" role="img" aria-label="Gráfico de barras: ${unidad} por día">
    ${ejes(sc, serie)}
    ${serie.map((p, i) => { const cx = G.L + anchoCelda * (i + 0.5); return p[clave] ? `<path d="${barra(cx - bw / 2, y(p[clave]), bw, y(0) - y(p[clave]))}" fill="var(--s1)"/>` : ""; }).join("")}
    ${serie.map((p, i) => `<rect class="hit" x="${G.L + anchoCelda * i}" y="${G.T}" width="${anchoCelda}" height="${h}" data-tip="${diaCorto(p.dia)}: <b>${num(p[clave])}</b> ${unidad}"/>`).join("")}
  </svg></div>${tablaSerie(serie, [[clave, unidad]])}`;
}
/* Barra con las puntas de arriba redondeadas (4px) y base recta */
function barra(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h} Z`;
}

/* Barras horizontales por juego, ordenadas */
function horizontales(obj) {
  const filas = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  if (!filas.length) return vacio();
  const max = filas[0][1];
  return `<div class="hbars">${filas.map(([j, n]) => `<div class="hb" data-tip="${esc(NOMBRES[j] || j)}: <b>${num(n)}</b> partidas"><span class="hb-n">${esc(NOMBRES[j] || j)}</span><span class="hb-t"><i style="width:${(n / max) * 100}%"></i></span><b>${num(n)}</b></div>`).join("")}</div>`;
}

/* Barras apiladas (hasta 3 series) con leyenda */
function apiladas(serie, claves) {
  if (!serie.length) return vacio();
  const tot = p => claves.reduce((t, [k]) => t + p[k], 0);
  const sc = escala(Math.max(...serie.map(tot))), h = G.H - G.T - G.B, y = v => G.T + h - (v / sc.tope) * h;
  const anchoCelda = (G.W - G.L - G.R) / serie.length, bw = Math.max(2, Math.min(18, anchoCelda - 2));
  return `<div class="leyenda">${claves.map(([, n], i) => `<span><i style="background:${SERIE[i]}"></i>${n}</span>`).join("")}</div>
  <div class="graf"><svg viewBox="0 0 ${G.W} ${G.H}" role="img" aria-label="Barras apiladas: monedas repartidas por día y por origen">
    ${ejes(sc, serie)}
    ${serie.map((p, i) => {
      let acum = 0; const cx = G.L + anchoCelda * (i + 0.5), visibles = claves.map(([k], j) => [k, j]).filter(([k]) => p[k] > 0);
      return visibles.map(([k, j], idx) => {
        const y0 = y(acum), y1 = y(acum + p[k]); acum += p[k];
        const alto = Math.max(0, y0 - y1 - (idx < visibles.length - 1 ? 2 : 0));   // 2px de separación entre segmentos
        return idx === visibles.length - 1 ? `<path d="${barra(cx - bw / 2, y1, bw, y0 - y1)}" fill="${SERIE[j]}"/>` : `<rect x="${cx - bw / 2}" y="${y1 + 2}" width="${bw}" height="${alto}" fill="${SERIE[j]}"/>`;
      }).join("");
    }).join("")}
    ${serie.map((p, i) => `<rect class="hit" x="${G.L + anchoCelda * i}" y="${G.T}" width="${anchoCelda}" height="${h}" data-tip="${diaCorto(p.dia)}<br>${claves.map(([k, n], j) => `<i class='punto' style='background:${SERIE[j]}'></i>${n}: <b>${num(p[k])}</b>`).join("<br>")}"/>`).join("")}
  </svg></div>${tablaSerie(serie, claves)}`;
}

const vacio = () => `<p class="empty center">Todavía no hay datos en este período.</p>`;
const tablaSerie = (serie, claves) => `<details class="ver-tabla"><summary>Ver como tabla</summary><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Día</th>${claves.map(([, n]) => `<th class="n">${n}</th>`).join("")}</tr></thead>
  <tbody>${serie.slice().reverse().map(p => `<tr><td>${diaCorto(p.dia)}</td>${claves.map(([k]) => `<td class="n">${num(p[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;

/* Tooltips: un solo cartel que sigue al dedo o al mouse */
function conectarTips() {
  app.querySelectorAll("[data-tip]").forEach(el => {
    const mostrar = e => { tip.innerHTML = el.dataset.tip; tip.hidden = false; const x = e.clientX, yy = e.clientY; const r = tip.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, x - r.width / 2)) + "px"; tip.style.top = Math.max(8, yy - r.height - 14) + "px"; el.classList.add("on"); };
    el.addEventListener("pointermove", mostrar); el.addEventListener("pointerdown", mostrar);
    el.addEventListener("pointerleave", () => { tip.hidden = true; el.classList.remove("on"); });
  });
}

let redim = null;
addEventListener("resize", () => { clearTimeout(redim); redim = setTimeout(() => { if (P.datos) pintar(); }, 250); });

iniciar();

/* ---------- Eventos de temporada (config "evento") ---------- */
function pantallaEvento() {
  const e = P.evento || { id: null, items: {} }, E = EVENTOS[e.id];
  const prev = (tipo, valor) => tipo === "color" ? personaje(valor, "civ", 44) : tipo === "titulo" ? `<span class="tit-prev">«${esc(valor)}»</span>` : personaje("#748ffc", "civ", 44, [valor]);
  return `<form id="fEv" class="ads-form">
    <div class="ev-elige">${[["", "Ninguno", "⭕"], ...Object.entries(EVENTOS).map(([k, x]) => [k, x.nombre, x.ic])].map(([k, n, ic]) => `<label class="ev-op ${(e.id || "") === k ? "on" : ""}"><input type="radio" name="ev" value="${k}" ${(e.id || "") === k ? "checked" : ""}><span>${ic}</span><b>${n}</b></label>`).join("")}</div>
    ${E ? `
    <label class="opt"><span class="txt"><b>Trabajo especial: ${E.trabajo.ic} ${esc(E.trabajo.nombre)}</b><small>${esc(E.trabajo.desc)}</small></span><input type="checkbox" id="evTrab" ${e.trabajo !== false ? "checked" : ""}></label>
    <div class="row"><label class="campo-l">Monedas extra en trabajos y Arena<select class="campo" id="evMulti">${[1, 1.5, 2, 3].map(m => `<option value="${m}" ${+e.multi === m ? "selected" : ""}>×${m}${m === 1 ? " (normal)" : ""}</option>`).join("")}</select></label>
      <label class="campo-l">Mensaje del cartel (opcional)<input class="campo" id="evMsg" maxlength="120" value="${esc(e.mensaje || "")}" placeholder="${esc(E.desc)}"></label></div>
    <span class="label">Cosas en la tienda</span>
    <div class="ev-items">${E.items.map(([id, tipo, nombre, precio, valor]) => { const o = (e.items || {})[id] || {}; return `<div class="ev-item"><span class="ev-prev">${prev(tipo, valor)}</span><div><b>${esc(nombre)}</b><small>${tipo}</small></div>
      <label class="campo-l">Precio<input class="campo" type="number" min="1" max="5000" data-precio="${id}" value="${o.precio || precio}"></label><label class="ev-on"><input type="checkbox" data-on="${id}" ${o.on === false ? "" : "checked"}> En venta</label></div>`; }).join("")}</div>` : `<p class="sub">Sin evento: el juego se ve normal.</p>`}
    <button class="btn" type="submit">Guardar evento</button>
    <p class="summary" id="evMsgOk"></p>
  </form>`;
}
function conectarEvento() {
  const f = document.getElementById("fEv"); if (!f) return;
  f.querySelectorAll("input[name=ev]").forEach(r => r.onchange = () => { if ((P.evento.id || "") !== r.value) P.evento.mensaje = ""; P.evento.id = r.value || null; pintar(); });
  f.onsubmit = async ev => {
    ev.preventDefault();
    const e = P.evento, E = EVENTOS[e.id];
    const valor = { id: e.id || null, trabajo: true, multi: 1, mensaje: "", items: e.items || {} };
    if (E) {
      valor.trabajo = document.getElementById("evTrab").checked;
      valor.multi = +document.getElementById("evMulti").value || 1;
      valor.mensaje = document.getElementById("evMsg").value.trim().slice(0, 120);
      valor.items = { ...valor.items };
      E.items.forEach(([id, , , precio]) => { valor.items[id] = { on: f.querySelector(`[data-on="${id}"]`).checked, precio: Math.max(1, Math.min(5000, Math.round(+f.querySelector(`[data-precio="${id}"]`).value || precio))) }; });
    }
    // Actualiza la fila; si todavía no existe (esquema viejo), la crea
    let { data, error } = await P.sb.from("config").update({ valor }).eq("clave", "evento").select("clave");
    if (!error && (!data || !data.length)) {
      const r = await P.sb.from("config").insert({ clave: "evento", valor });
      error = r.error && r.error.code !== "23505" ? r.error : null;   // 23505: ya existía (y se actualizó)
    }
    document.getElementById("evMsgOk").textContent = error ? "No se pudo guardar: " + error.message : E ? `Evento de ${E.nombre} prendido. Los jugadores lo ven al abrir el juego.` : "Evento apagado.";
    if (!error) P.evento = valor;
  };
}
