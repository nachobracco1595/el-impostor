/* Base para los juegos nuevos (Bowling, Arco y flecha, Circo).
   - EXTRA: registro de juegos. La sala online, los puntos y el ranking los atienden a todos igual.
   - Turnero: juegos por turnos de tiro (bowling, arco). Quien tira manda los datos del tiro; el anfitrión
     (o este teléfono) calcula el resultado, lo anima un rato y pasa el turno. Los bots tiran solos.
   - Pantalla de inicio común: personas que juegan en este teléfono (se pasan el teléfono en su turno) y bots. */
const EXTRA = {};

const Turnero = {
  t: null,
  /* Avanza solo: si hay animación, espera que termine; si le toca a un bot, tira después de un ratito */
  programar(mod, s, cambio) {
    clearTimeout(Turnero.t);
    if (!s || s.fase === "fin") return;
    if (s.fase === "anim") { Turnero.t = setTimeout(() => { if (s.fase !== "anim") return; mod.seguir(s); s.mov++; cambio(); Turnero.programar(mod, s, cambio); }, s.anim.dur + 900); return; }
    const J = s.jug[s.turno], mov = s.mov;
    if (s.fase === "tiro" && J && J.cpu) Turnero.t = setTimeout(() => { if (s.fase !== "tiro" || s.jug[s.turno] !== J || s.mov !== mov) return; mod.tirar(s, s.turno, mod.bot(s, s.turno)); s.mov++; cambio(); Turnero.programar(mod, s, cambio); }, mod.esperaBot ? mod.esperaBot(s) : 1100 + Math.random() * 700);
    // Tiempo límite (por ejemplo, para responder una pregunta): si se pasa, el juego decide qué pasa
    else if (s.fase === "tiro" && J && s.limite && mod.vencido) Turnero.t = setTimeout(() => { if (s.fase !== "tiro" || s.jug[s.turno] !== J || s.mov !== mov) return; mod.tirar(s, s.turno, mod.vencido(s)); s.mov++; cambio(); Turnero.programar(mod, s, cambio); }, Math.max(0, s.limite - Date.now()) + 250);
  },
  /* Acción de alguien (pid null: modo un teléfono, tira el que tiene el turno) */
  act(mod, s, pid, a) {
    if (a.t !== "tiro" || s.fase !== "tiro") return false;
    const J = s.jug[s.turno];
    if (!J || J.cpu || (pid !== null && pid !== J.id)) return false;
    mod.tirar(s, s.turno, mod.validar(a.p || {}, s));
    s.mov++;
    return true;
  },
  nuevoId: pre => pre + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  idx: (s, pid) => s.jug.findIndex(j => j.id === pid),

  /* ---------- En este teléfono ---------- */
  empezarLocal(mod) {
    const c = mod.cfg(), u = BD.sesion();
    const personas = (c.personas && c.personas.length ? c.personas : [u ? u.nombre : "Vos"]).slice(0, 6);
    const jug = [...personas.map((name, i) => { const p = BD.porNombre(name); return { id: "p" + i, name, look: p ? p.look : null }; }), ...Turnero.bots(c.bots, c.nivel)];
    S.extra = mod.crear(jug, { ...c, local: true });
    S.extra.juego = mod.clave;
    UI.extraPase = personas.length > 1 ? S.extra.jug[S.extra.turno].id : null;
    go(mod.clave);
  },
  pantalla(mod) {
    const s = S.extra; if (!s || s.juego !== mod.clave) return go(mod.clave + "Intro");
    const v = mod.view(s, null);
    const humanos = s.jug.filter(j => !j.cpu);
    // Varias personas en un teléfono: se pasan el teléfono cuando cambia el turno
    const J = s.jug[s.turno];
    if (humanos.length > 1 && s.fase === "tiro" && J && !J.cpu && UI.extraPase !== J.id) {
      mod.parar && mod.parar();
      app.innerHTML = `${head(0)}<section class="stage">${retrato(J.look || { color: colorDe(J.name), acc: [] }, 110)}<h2>Turno de ${esc(J.name)}</h2><p class="sub">Pasale el teléfono.</p><button class="btn" id="soyYo">Soy ${esc(J.name)}, ¡a tirar!</button></section>`;
      on("soyYo", () => { UI.extraPase = J.id; render(); });
      return;
    }
    v.me = J && !J.cpu ? J.id : (humanos[0] || {}).id;
    mod.render(v, a => {
      if (a.t === "again") { mod.parar && mod.parar(); return Turnero.empezarLocal(mod); }
      if (a.t === "salir") { mod.parar && mod.parar(); clearTimeout(Turnero.t); S.extra = null; return go(mod.clave + "Intro"); }
      if (Turnero.act(mod, s, null, a)) { render(); Turnero.programar(mod, s, () => { if (S.screen === mod.clave) render(); }); }
    }, { local: true, isHost: true });
    if (!s.programado || s.programado !== s.mov) { s.programado = s.mov; Turnero.programar(mod, s, () => { if (S.screen === mod.clave && S.extra === s) { render(); if (s.fase === "fin" && !s.contada) { s.contada = true; Cuenta.revisar(); } } }); }
    if (s.fase === "fin" && !s.contada) { s.contada = true; Cuenta.revisar(); }
  },

  /* ---------- Online (en el anfitrión) ---------- */
  empezarOn(mod, R) {
    const c = mod.cfg();
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name, look: p.id === "H" ? Cuenta.look() : p.look }));
    if (jug.length > 6) return `${mod.nombre} es de hasta 6 personas.`;
    const bots = Math.max(0, Math.min(5, (c.mesa || 0) - jug.length));
    R.ex = mod.crear([...jug, ...Turnero.bots(bots, c.nivel)], { ...c, local: false });
    R.ex.juego = mod.clave; R.game = mod.clave;
    Turnero.programar(mod, R.ex, () => Net.broadcast());
    return null;
  },
  actOn(mod, R, pid, a) {
    if (a.t === "again" && pid === "H") { const e = mod.empezarOn(R); R.err = e || ""; return; }
    if (a.t === "lobby" && pid === "H") { clearTimeout(Turnero.t); R.game = null; R.ex = null; return; }
    if (Turnero.act(mod, R.ex, pid, a)) Turnero.programar(mod, R.ex, () => Net.broadcast());
  },

  bots(n, nivel) { return shuffle(["🤖 Rita", "🤖 Tito", "🤖 Pepa", "🤖 Cacho", "🤖 Coca"]).slice(0, n).map((name, k) => ({ id: "b" + k, name, cpu: true, nivel, look: { color: COLORES[(k * 3 + 1) % COLORES.length], acc: [] } })); },

  /* Quién tira ahora (para el aviso de turno online) */
  turno(v, que) {
    if (!v || v.fase !== "tiro" || v.yo < 0) return null;
    const J = v.jug[v.turno]; if (!J) return null;
    return { mio: J.id === v.me, quien: J.name.replace(/^🤖\s*/, ""), que };
  },

  /* ---------- Pantalla de inicio (común a los tres) ---------- */
  intro(mod) {
    const c = mod.cfg(), u = BD.sesion();
    if (!c.personas || !c.personas.length) c.personas = [u ? u.nombre : "Vos"];
    const libres = BD.usuarios().filter(x => !c.personas.includes(x.nombre)).slice(0, 8);
    app.innerHTML = `${head(0)}<section class="screen ex-intro ex-${mod.clave}">
      <div class="tb-hero"><span class="ex-arte">${mod.arte()}</span><span class="tb-neon">${esc(mod.nombre.toUpperCase())}</span><p class="sub">${mod.descripcion}</p></div>
      <div class="panel"><span class="label">Quiénes juegan en este teléfono</span>
        <ul class="players">${c.personas.map((n, i) => `<li>${avatar(n, 34)}<span class="name">${esc(n)}${BD.porNombre(n) ? `<small class="suma">⭐ Suma puntos</small>` : ""}</span>${c.personas.length > 1 ? `<button class="x" data-quitar="${i}" aria-label="Quitar a ${esc(n)}">×</button>` : ""}</li>`).join("")}</ul>
        ${c.personas.length < 6 ? `<form class="add" id="exAdd"><input id="exNombre" maxlength="16" placeholder="Sumar a alguien" autocomplete="off" aria-label="Nombre"><button type="submit" aria-label="Agregar">+</button></form>` : ""}
        ${libres.length && c.personas.length < 6 ? `<div class="chips-j">${libres.map(x => `<button class="chip-j" data-perfil="${esc(x.nombre)}">${personaje(x.look.color, "civ", 22, x.look.acc)}${esc(x.nombre)}</button>`).join("")}</div>` : ""}
        <small class="sub">${c.personas.length > 1 ? "Se van pasando el teléfono en cada turno." : "Podés sumar amigos para jugar por turnos en este teléfono."}</small>
        <span class="label">Bots</span><div class="seg">${[0, 1, 2, 3].map(n => `<button aria-pressed="${c.bots === n}" data-exb="${n}">${n ? n : "Ninguno"}</button>`).join("")}</div>
        ${c.bots ? `<span class="label">Qué tan buenos son</span><div class="seg">${[["facil", "Fáciles"], ["normal", "Normales"], ["dificil", "Difíciles"]].map(([k, t]) => `<button aria-pressed="${c.nivel === k}" data-exn="${k}">${t}</button>`).join("")}</div>` : ""}
      </div>
      ${mod.opciones ? `<div class="panel">${mod.opciones(c)}</div>` : ""}
      <button class="btn tb-girar" id="exJugar">${mod.boton}</button>
      <p class="summary center">¿Cada uno en su teléfono? Creá una sala en "Jugar online" y elegí ${esc(mod.nombre)}.</p>
      <button class="btn ghost" id="exAtras">Volver</button></section>`;
    const guardar = () => { store.set(mod.clave + "Cfg", c); render(); };
    const sumar = n => { n = String(n || "").trim().slice(0, 16); if (!n || c.personas.some(x => x.toLowerCase() === n.toLowerCase()) || c.personas.length >= 6) return; c.personas.push(n); guardar(); };
    const f = byId("exAdd"); if (f) f.onsubmit = e => { e.preventDefault(); sumar(byId("exNombre").value); };
    app.querySelectorAll("[data-perfil]").forEach(b => b.onclick = () => sumar(b.dataset.perfil));
    app.querySelectorAll("[data-quitar]").forEach(b => b.onclick = () => { c.personas.splice(+b.dataset.quitar, 1); guardar(); });
    app.querySelectorAll("[data-exb]").forEach(b => b.onclick = () => { c.bots = +b.dataset.exb; guardar(); });
    app.querySelectorAll("[data-exn]").forEach(b => b.onclick = () => { c.nivel = b.dataset.exn; guardar(); });
    if (mod.conectarOpciones) mod.conectarOpciones(c, guardar);
    on("exJugar", () => mod.empezarLocal());
    on("exAtras", () => go("home"));
  },
  /* Configuración guardada de cada juego */
  cfg(clave, base) { return S[clave + "Cfg"] = S[clave + "Cfg"] || Object.assign({ bots: 1, nivel: "normal", mesa: 0, personas: [] }, base, store.get(clave + "Cfg", {})); },

  /* Opciones del anfitrión en la sala online */
  lobbyBots(clave, c, H) {
    return H ? `<span class="label">Completar con bots hasta</span><div class="seg">${[[0, "Sin bots"], [2, "2"], [3, "3"], [4, "4"]].map(([k, t]) => `<button aria-pressed="${(c.mesa || 0) === k}" data-exmesa="${clave}:${k}">${t}</button>`).join("")}</div>
      <div class="seg">${[["facil", "Bots fáciles"], ["normal", "Normales"], ["dificil", "Difíciles"]].map(([k, t]) => `<button aria-pressed="${c.nivel === k}" data-exniv="${clave}:${k}">${t}</button>`).join("")}</div>` : "";
  },
  conectarLobby() {
    app.querySelectorAll("[data-exmesa]").forEach(b => b.onclick = () => { const [k, n] = b.dataset.exmesa.split(":"); const c = EXTRA[k].cfg(); c.mesa = +n; store.set(k + "Cfg", c); Net.cfgCambiada(); });
    app.querySelectorAll("[data-exniv]").forEach(b => b.onclick = () => { const [k, n] = b.dataset.exniv.split(":"); const c = EXTRA[k].cfg(); c.nivel = n; store.set(k + "Cfg", c); Net.cfgCambiada(); });
    app.querySelectorAll("[data-exopc]").forEach(b => b.onclick = () => { const [k, campo, val] = b.dataset.exopc.split(":"); const c = EXTRA[k].cfg(); c[campo] = isNaN(+val) ? val : +val; store.set(k + "Cfg", c); Net.cfgCambiada(); });
  },

  /* Ruido con forma de campana (para los bots) */
  gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
  habilidad(clave, nivel) { return typeof Mente !== "undefined" ? Mente.habilidad(clave, nivel || "normal") : { facil: 0.2, normal: 0.5, dificil: 0.8 }[nivel] ?? 0.5; },
  /* Cartel final con la tabla (los tres juegos) */
  tablaFin(v, filas, titulo, sub, send, opts) {
    const jefe = opts.local || opts.isHost;
    return `<div class="ar-fin-caja"><h2>${titulo}</h2>${sub ? `<p class="sub center">${sub}</p>` : ""}
      <ol class="ar-tabla">${filas.map(f => `<li class="${f.yo ? "yo" : ""}"><span>${f.puesto}º</span><b>${esc(f.name)}</b><small>${f.txt}</small></li>`).join("")}</ol>
      ${jefe ? `<div class="row"><button class="btn" id="exOtra">Otra partida</button><button class="btn ghost" id="exVolver">${opts.local ? "Salir" : "Volver a la sala"}</button></div>` : `<p class="sub center">El anfitrión puede empezar otra.</p>`}</div>`;
  },
  conectarFin(send, opts) {
    on("exOtra", () => send({ t: "again" }));
    on("exVolver", () => send(opts.local ? { t: "salir" } : { t: "lobby" }));
  }
};
