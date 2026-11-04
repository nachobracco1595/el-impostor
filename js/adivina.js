/* Adivina qué soy (como el "Heads Up"): un solo teléfono que se va pasando.
   - El que tiene el turno se pone el teléfono en la frente con la pantalla mirando al grupo; los demás le dan pistas.
   - Si adivina, inclina la pantalla hacia el piso (asiente) = ✅ acierto. Si quiere pasar, la inclina hacia el techo = ⏭ paso.
   - Sensor: DeviceOrientationEvent. Con beta/gamma se calcula hacia dónde mira la pantalla (componente vertical de su normal),
     que sirve igual con el teléfono acostado (horizontal) o parado (vertical). La posición neutra se calibra al terminar el 3-2-1.
   - Sin sensor (o sin permiso) se juega tocando: mitad de abajo = acierto, mitad de arriba = paso (los toques siempre andan).
   - La app está fija en vertical: en modo horizontal la palabra se dibuja girada 90° (y se da vuelta sola según para qué lado lo tengan). */
const ADV = {
  UMBRAL: 35,     // grados desde la posición neutra para marcar
  VUELTA: 15,     // hay que volver a menos de esto para la próxima palabra
  FLASH: 700,     // ms del cartel de acierto / paso
  MIN_PAL: 300,   // ms mínimos con la palabra a la vista antes de poder marcarla
  BIEN: ["¡Bien!", "¡Eso!", "¡Crack!", "¡Sí!", "¡Genio!"],
  PASO: ["¡Paso!", "Siguiente…", "¡La que sigue!"]
};

const Adivina = {
  rt: null,   // estado del turno en curso (no se guarda)
  cfg() { return S.advCfg = S.advCfg || Object.assign({ personas: [], cats: ["famar", "animales", "pelis", "comidas"], tiempo: 60, rondas: 1, orient: "h" }, store.get("advCfg", {})); },
  guardar() { store.set("advCfg", S.advCfg); render(); },
  vibrar(p) { try { navigator.vibrate && navigator.vibrate(p); } catch {} },
  sfx(n) { if (typeof Sonido !== "undefined") Sonido.sfx(n); },
  cat: k => ADV_CATS.find(c => c.k === k),

  /* ---------- Partida ---------- */
  empezar() {
    const c = Adivina.cfg();
    const cats = c.cats.filter(k => Adivina.cat(k));
    if (!c.personas.length || !cats.length) return go("adivinaIntro");
    const jug = c.personas.map((name, i) => { const p = BD.porNombre(name); return { id: "p" + i, name, look: p ? p.look : null, aciertos: 0, pasadas: 0, mejor: 0, puesto: 0 }; });
    const rondas = [1, 2, 3].includes(c.rondas) ? c.rondas : 1, orden = [];
    for (let r = 0; r < rondas; r++) jug.forEach((_, i) => orden.push(i));
    S.adv = { id: "adv-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), juego: "adivina", fase: "listo",
      tiempo: [45, 60, 90].includes(c.tiempo) ? c.tiempo : 60, rondas, orient: c.orient === "v" ? "v" : "h", cats, jug, orden, t: 0, turno: null, mazo: [], usadas: [] };
    go("adivina");
  },
  /* Saca una palabra (sin repetir en la partida hasta que se acaben) */
  sacar(s) {
    if (!s.mazo.length) {
      const vistas = new Set(s.usadas), todas = [];
      s.cats.forEach(k => Adivina.cat(k).w.forEach(w => { if (!todas.some(x => x.w === w)) todas.push({ w, c: k }); }));
      let libres = todas.filter(x => !vistas.has(x.w));
      if (!libres.length) { s.usadas = []; libres = todas; }
      s.mazo = shuffle(libres);
    }
    const x = s.mazo.pop(); s.usadas.push(x.w); return x;
  },
  ordenar(s) {
    const o = s.jug.slice().sort((a, b) => b.aciertos - a.aciertos || b.mejor - a.mejor);
    o.forEach((j, k) => j.puesto = k > 0 && j.aciertos === o[k - 1].aciertos ? o[k - 1].puesto : k + 1);
    return o;
  },
  resultado(s, pid) {
    if (!s || s.fase !== "fin") return null;
    const J = s.jug.find(j => j.id === pid); if (!J) return null;
    return { juego: "adivina", id: s.id, gano: s.jug.length > 1 && J.puesto === 1, puesto: J.puesto, n: s.jug.length, aciertos: J.aciertos, pasadas: J.pasadas, mejor: J.mejor };
  },

  /* ---------- Turno ---------- */
  /* Se llama desde el toque de "¡Listo!": el permiso del sensor en iOS tiene que pedirse acá mismo */
  listo() {
    const s = S.adv;
    let pedido = null;
    try { if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") pedido = DeviceOrientationEvent.requestPermission(); } catch { pedido = null; }
    const rt = Adivina.rt = { estado: "cuenta", fin: 0, actual: null, armado: false, neutro: 0, muestras: [], tilt: null, sensor: false, permiso: pedido ? "pidiendo" : "ok",
      lado: 1, desde: 0, lock: null, timers: [], iv: null, ultimoSeg: null };
    if (pedido) pedido.then(r => { rt.permiso = r === "granted" ? "ok" : "no"; Adivina.pista(); }).catch(() => { rt.permiso = "no"; Adivina.pista(); });
    try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(l => { if (Adivina.rt === rt) rt.lock = l; else l.release(); }).catch(() => {}); } catch {}
    window.addEventListener("deviceorientation", Adivina.onOri);
    window.addEventListener("resize", Adivina.encajar);
    s.turno = { j: s.orden[s.t], palabras: [] };
    s.fase = "juego";
    document.body.classList.add("adv-jugando");
    go("adivina");
    // 3, 2, 1… con pitidos; al final se calibra la posición neutra
    [3, 2, 1].forEach((n, k) => rt.timers.push(setTimeout(() => { Adivina.cuenta(n); Adivina.sfx("tic"); Adivina.vibrar(30); }, k * 1000)));
    rt.timers.push(setTimeout(() => Adivina.arrancar(), 3000));
    Adivina.cuenta(3);
  },
  cuenta(n) { const el = byId("advCuenta"); if (el) { el.textContent = n; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); } },
  arrancar() {
    const rt = Adivina.rt, s = S.adv; if (!rt || !s) return;
    // Calibración: el promedio de las últimas lecturas (si es raro, se toma la pantalla vertical como neutra)
    const m = rt.muestras.slice(-8);
    rt.neutro = m.length ? m.reduce((a, b) => a + b, 0) / m.length : 0;
    if (Math.abs(rt.neutro) > 45) rt.neutro = 0;
    rt.armado = true;
    rt.fin = performance.now() + s.tiempo * 1000;
    Adivina.sfx("empieza"); Adivina.vibrar(80);
    byId("advPlay").classList.add("jugando");
    Adivina.siguiente();
    rt.iv = setInterval(Adivina.reloj, 100);
    Adivina.reloj();
    rt.timers.push(setTimeout(() => { rt.sinSensor = !rt.sensor; Adivina.pista(); }, 1500));
  },
  siguiente() {
    const rt = Adivina.rt, s = S.adv; if (!rt) return;
    rt.actual = Adivina.sacar(s); rt.estado = "jugando"; rt.desde = performance.now();
    // Si ya volvió a la posición neutra durante el cartel, queda listo para la próxima
    if (rt.tilt != null && Math.abs(rt.tilt - rt.neutro) < ADV.VUELTA) rt.armado = true;
    const p = byId("advPal"), c = byId("advCat"), play = byId("advPlay");
    if (play) play.classList.remove("ok", "paso");
    if (c) { const C = Adivina.cat(rt.actual.c); c.textContent = `${C.ic} ${C.nombre}`; }
    if (p) { p.textContent = rt.actual.w; p.classList.remove("entra"); void p.offsetWidth; p.classList.add("entra"); }
    Adivina.ajustar();
  },
  marcar(ok) {
    const rt = Adivina.rt, s = S.adv;
    if (!rt || rt.estado !== "jugando" || performance.now() - rt.desde < ADV.MIN_PAL) return;
    rt.estado = "flash"; rt.armado = false;
    s.turno.palabras.push({ w: rt.actual.w, c: rt.actual.c, ok });
    const play = byId("advPlay"), f = byId("advFlash");
    if (play) play.classList.add(ok ? "ok" : "paso");
    if (f) f.textContent = pick(ok ? ADV.BIEN : ADV.PASO);
    const n = byId("advPts"); if (n) n.textContent = s.turno.palabras.filter(x => x.ok).length;
    Adivina.sfx(ok ? "bien" : "pasa");
    Adivina.vibrar(ok ? [50, 40, 90] : 160);
    rt.timers.push(setTimeout(() => { if (Adivina.rt === rt && rt.estado === "flash") Adivina.siguiente(); }, ADV.FLASH));
  },
  reloj() {
    const rt = Adivina.rt; if (!rt || !rt.fin) return;
    const ms = Math.max(0, rt.fin - performance.now()), seg = Math.ceil(ms / 1000), el = byId("advReloj");
    if (el) { el.textContent = seg; el.classList.toggle("poco", seg <= 10); }
    const barra = byId("advBarra"); if (barra) barra.style.width = (ms / (S.adv.tiempo * 1000)) * 100 + "%";
    if (seg !== rt.ultimoSeg) { rt.ultimoSeg = seg; if (seg > 0 && seg <= 5) Adivina.sfx("tic"); }
    if (ms <= 0) Adivina.tiempo();
  },
  /* Se terminó el tiempo: la palabra que estaba a la vista no cuenta */
  tiempo() {
    const rt = Adivina.rt; if (!rt || rt.estado === "fin") return;
    rt.estado = "fin";
    Adivina.limpiar(false);
    const play = byId("advPlay"), f = byId("advFlash");
    if (play) { play.classList.remove("ok", "paso"); play.classList.add("tiempo"); }
    if (f) f.textContent = "¡Tiempo!";
    Adivina.sfx("alarma"); Adivina.vibrar([200, 100, 200]);
    setTimeout(() => { if (S.adv && S.adv.fase === "juego") { S.adv.fase = "resumen"; Adivina.limpiar(true); go("adivina"); } }, 1400);
  },
  /* Apaga el reloj, el sensor y la pantalla encendida (todo, si total) */
  limpiar(total) {
    const rt = Adivina.rt; if (!rt) return;
    clearInterval(rt.iv); rt.timers.forEach(clearTimeout); rt.timers = [];
    window.removeEventListener("deviceorientation", Adivina.onOri);
    window.removeEventListener("resize", Adivina.encajar);
    if (total) {
      try { rt.lock && rt.lock.release(); } catch {}
      document.body.classList.remove("adv-jugando");
      Adivina.rt = null;
    }
  },
  /* Sensor: hacia dónde mira la pantalla. Con R = Rz(alfa)·Rx(beta)·Ry(gama), el "arriba" del mundo visto desde el teléfono es
     u = (−sen γ·cos β, sen β, cos γ·cos β). u.z es cuánto mira la pantalla al techo: inclinación = asin(u.z) (+ techo, − piso). */
  onOri(e) {
    const rt = Adivina.rt; if (!rt || e.beta == null || e.gamma == null) return;
    const b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180;
    const ux = -Math.sin(g) * Math.cos(b), uz = Math.cos(g) * Math.cos(b);
    const tilt = Math.asin(Math.max(-1, Math.min(1, uz))) * 180 / Math.PI;
    if (!rt.sensor) { rt.sensor = true; Adivina.pista(); }
    rt.tilt = tilt;
    if (rt.estado === "cuenta") { rt.muestras.push(tilt); if (rt.muestras.length > 30) rt.muestras.shift(); }
    // Acostado: si el borde derecho mira al techo, la palabra va girada a la derecha; si no, a la izquierda
    if (S.adv && S.adv.orient === "h") { const lado = ux > 0.6 ? 1 : ux < -0.6 ? -1 : rt.lado; if (lado !== rt.lado) { rt.lado = lado; Adivina.encajar(); } }
    if (!rt.fin) return;
    const d = tilt - rt.neutro;
    if (!rt.armado) { if (Math.abs(d) < ADV.VUELTA && rt.estado === "jugando") rt.armado = true; return; }
    if (rt.estado !== "jugando") return;
    if (d <= -ADV.UMBRAL) Adivina.marcar(true);
    else if (d >= ADV.UMBRAL) Adivina.marcar(false);
  },
  /* Cartelito de ayuda: con sensor o tocando */
  pista() {
    const rt = Adivina.rt, el = byId("advPista"); if (!rt || !el) return;
    const sin = rt.permiso === "no" || rt.sinSensor;
    el.classList.toggle("fuerte", !!sin);
    el.textContent = sin ? "Sin sensor de movimiento: tocá abajo = ✅ acierto · arriba = ⏭ paso" : "Asentí = ✅ · Cabeza para atrás = ⏭ (o tocá abajo / arriba)";
  },
  /* Tamaño y giro del área de juego */
  encajar() {
    const area = byId("advArea"), giro = byId("advGiro"), rt = Adivina.rt; if (!area || !giro) return;
    const W = area.clientWidth, H = area.clientHeight, h = S.adv && S.adv.orient === "h";
    giro.style.width = (h ? H : W) + "px"; giro.style.height = (h ? W : H) + "px";
    giro.style.transform = `translate(-50%, -50%)${h ? ` rotate(${(rt ? rt.lado : 1) * 90}deg)` : ""}`;
    Adivina.ajustar();
  },
  /* La palabra lo más grande posible sin cortarse */
  ajustar() {
    const p = byId("advPal"); if (!p) return;
    const caja = p.parentElement, W = caja.clientWidth - 12, H = caja.clientHeight * 0.92;
    if (!W || !H) return;
    let lo = 18, hi = 170;
    while (hi - lo > 2) { const m = (lo + hi) / 2; p.style.fontSize = m + "px"; if (p.scrollWidth <= W && p.scrollHeight <= H) lo = m; else hi = m; }
    p.style.fontSize = lo + "px";
  },
  salir() { Adivina.limpiar(true); S.adv = null; go("adivinaIntro"); },

  /* ---------- Pantallas ---------- */
  intro() {
    const c = Adivina.cfg(), u = BD.sesion();
    if (!c.personas.length) c.personas = [u ? u.nombre : "Vos"];
    const libres = BD.usuarios().filter(x => !c.personas.some(n => n.toLowerCase() === x.nombre.toLowerCase())).slice(0, 8);
    const todas = ADV_CATS.map(C => C.k), allOn = todas.every(k => c.cats.includes(k));
    const ok = c.personas.length >= 1 && c.cats.some(k => Adivina.cat(k));
    app.innerHTML = `${head(0)}<section class="screen ex-intro adv-intro">
      <div class="tb-hero"><span class="ex-arte">${MenuArte.adivina()}</span><span class="tb-neon">ADIVINA QUÉ SOY</span>
        <p class="sub">Ponete el teléfono en la frente: todos ven la palabra menos vos. Tus amigos te dan pistas (o hacen mímica) y vos adivinás antes de que se acabe el tiempo.</p></div>
      <div class="panel adv-reglas"><span class="label">Cómo se juega</span>
        <ul><li><b>✅ Acierto:</b> inclinás la pantalla hacia el piso (como si asintieras).</li><li><b>⏭ Paso:</b> la inclinás hacia el techo.</li><li><b>👆 Sin sensor:</b> tocá la mitad de abajo para acierto y la de arriba para pasar.</li><li>Gana el que adivina más palabras en total.</li></ul></div>
      <div class="panel"><span class="label">Quiénes juegan · ${c.personas.length}</span>
        <ul class="players">${c.personas.map((n, i) => `<li>${avatar(n, 34)}<span class="name">${esc(n)}${BD.porNombre(n) ? `<small class="suma">⭐ Suma puntos</small>` : ""}</span>${c.personas.length > 1 ? `<button class="x" data-advq="${i}" aria-label="Quitar a ${esc(n)}">×</button>` : ""}</li>`).join("")}</ul>
        ${c.personas.length < 12 ? `<form class="add" id="advAdd"><input id="advNombre" maxlength="16" placeholder="Sumar a alguien" autocomplete="off" aria-label="Nombre del jugador"><button type="submit" aria-label="Agregar jugador">+</button></form>` : ""}
        ${libres.length && c.personas.length < 12 ? `<div class="chips-j">${libres.map(x => `<button class="chip-j" data-advp="${esc(x.nombre)}">${personaje(x.look.color, "civ", 22, x.look.acc)}${esc(x.nombre)}</button>`).join("")}</div>` : ""}
        <small class="sub">${c.personas.length > 1 ? "Se van pasando el teléfono: el orden de la lista es el orden de los turnos." : "Sumá a tus amigos: es para jugar en grupo (solo, practicás)."}</small></div>
      <div class="panel"><div class="headrow"><span class="label">Categorías · ${c.cats.length} de ${todas.length}</span><button class="linkish" id="advTodas">${allOn ? "Quitar todas" : "Marcar todas"}</button></div>
        <div class="temas">${ADV_CATS.map(C => `<button class="tema" aria-pressed="${c.cats.includes(C.k)}" data-advc="${C.k}"><span class="te">${C.ic}</span><span class="tn">${esc(C.nombre)}</span><span class="c">${C.w.length} palabras</span></button>`).join("")}</div></div>
      <div class="panel">
        <span class="label">Tiempo por turno</span><div class="seg">${[45, 60, 90].map(k => `<button aria-pressed="${c.tiempo === k}" data-advt="${k}">${k} s</button>`).join("")}</div>
        <span class="label">Turnos por jugador</span><div class="seg">${[1, 2, 3].map(k => `<button aria-pressed="${c.rondas === k}" data-advr="${k}">${k}</button>`).join("")}</div>
        <span class="label">Cómo se pone el teléfono</span><div class="seg dos">${[["h", "📱↔️ Acostado"], ["v", "📱 Parado"]].map(([k, t]) => `<button aria-pressed="${c.orient === k}" data-advo="${k}">${t}</button>`).join("")}</div>
        <small class="sub">${c.orient === "h" ? "Horizontal en la frente (lo más cómodo): la palabra se ve girada para que el grupo la lea derecha." : "Vertical en la frente: la palabra se ve derecha sin girar."}</small></div>
      <button class="btn tb-girar" id="advJugar" ${ok ? "" : "disabled"}>🎉 ¡A jugar!</button>
      <button class="btn ghost" id="advAtras">Volver</button></section>`;
    const sumar = n => { n = String(n || "").trim().slice(0, 16); if (!n || c.personas.some(x => x.toLowerCase() === n.toLowerCase()) || c.personas.length >= 12) return; c.personas.push(n); Adivina.guardar(); };
    const f = byId("advAdd"); if (f) f.onsubmit = e => { e.preventDefault(); sumar(byId("advNombre").value); const i = byId("advNombre"); if (i) i.focus(); };
    app.querySelectorAll("[data-advp]").forEach(b => b.onclick = () => sumar(b.dataset.advp));
    app.querySelectorAll("[data-advq]").forEach(b => b.onclick = () => { c.personas.splice(+b.dataset.advq, 1); Adivina.guardar(); });
    app.querySelectorAll("[data-advc]").forEach(b => b.onclick = () => { const k = b.dataset.advc; c.cats = c.cats.includes(k) ? c.cats.filter(x => x !== k) : [...c.cats, k]; Adivina.guardar(); });
    on("advTodas", () => { c.cats = allOn ? [] : todas.slice(); Adivina.guardar(); });
    app.querySelectorAll("[data-advt]").forEach(b => b.onclick = () => { c.tiempo = +b.dataset.advt; Adivina.guardar(); });
    app.querySelectorAll("[data-advr]").forEach(b => b.onclick = () => { c.rondas = +b.dataset.advr; Adivina.guardar(); });
    app.querySelectorAll("[data-advo]").forEach(b => b.onclick = () => { c.orient = b.dataset.advo; Adivina.guardar(); });
    on("advJugar", () => Adivina.empezar());
    on("advAtras", () => go("home"));
  },
  cara(J, size) { return J.look ? retrato(J.look, size) : avatar(J.name, size); },
  tablita(s) {
    return `<div class="adv-marcador">${s.jug.map((J, i) => `<span class="${s.orden[s.t] === i && s.fase !== "fin" ? "on" : ""}">${esc(J.name)} <b>${J.aciertos}</b></span>`).join("")}</div>`;
  },
  pantalla() {
    const s = S.adv; if (!s) return go("adivinaIntro");
    if (s.fase === "juego") { if (!byId("advPlay")) Adivina.pintarJuego(); return; }
    if (s.fase === "listo") return Adivina.pintarListo(s);
    if (s.fase === "resumen") return Adivina.pintarResumen(s);
    return Adivina.pintarFin(s);
  },
  pintarListo(s) {
    const J = s.jug[s.orden[s.t]], n = s.jug.length, ronda = Math.floor(s.t / n) + 1;
    app.innerHTML = `${head(0)}<section class="screen stage adv-listo">
      <p class="adv-ronda">${s.rondas > 1 ? `Ronda ${ronda} de ${s.rondas} · ` : ""}Turno ${s.t + 1} de ${s.orden.length}</p>
      ${Adivina.cara(J, 110)}
      <h2>Le toca a ${esc(J.name)}</h2>
      <p class="sub">${n > 1 ? "Pasale el teléfono. " : ""}Tocá <b>¡Listo!</b> y ponete el teléfono en la frente ${s.orient === "h" ? "<b>acostado</b>" : "<b>parado</b>"}, con la pantalla mirando a los demás.</p>
      <div class="adv-gestos"><div><span>⬇️</span><b>Para abajo</b><small>✅ Acierto</small></div><div><span>⬆️</span><b>Para arriba</b><small>⏭ Paso</small></div></div>
      <p class="sub">${s.tiempo} segundos. ¡Que no te soplen la palabra!</p>
      <button class="btn tb-girar" id="advListo">¡Listo!</button>
      ${n > 1 ? Adivina.tablita(s) : ""}
      <button class="linkish" id="advSalir">Terminar la partida</button></section>`;
    on("advListo", () => Adivina.listo());
    on("advSalir", () => Adivina.salir());
  },
  pintarJuego() {
    const s = S.adv, J = s.jug[s.turno.j];
    app.innerHTML = `<div class="adv-play" id="advPlay"><div class="adv-area" id="advArea"><div class="adv-giro" id="advGiro">
      <div class="adv-top"><span class="adv-quien">${esc(J.name)}</span><span class="adv-reloj" id="advReloj">${s.tiempo}</span><span class="adv-pts">✅ <b id="advPts">0</b></span></div>
      <div class="adv-barra"><i id="advBarra"></i></div>
      <div class="adv-centro"><span class="adv-cat" id="advCat"></span><div class="adv-caja"><p class="adv-pal" id="advPal"></p></div></div>
      <div class="adv-cuenta" id="advCuenta">3</div>
      <div class="adv-flash" id="advFlash"></div>
      <div class="adv-zona arriba" id="advPaso" role="button" aria-label="Paso"><span>⏭ Paso</span></div>
      <div class="adv-zona abajo" id="advOk" role="button" aria-label="Acierto"><span>✅ Acierto</span></div>
      <p class="adv-pista" id="advPista"></p>
      <button class="adv-x" id="advCortar" aria-label="Terminar el turno">×</button>
    </div></div></div>`;
    byId("advOk").onpointerdown = e => { e.preventDefault(); Adivina.marcar(true); };
    byId("advPaso").onpointerdown = e => { e.preventDefault(); Adivina.marcar(false); };
    // La cruz: con el reloj andando termina el turno; durante el 3-2-1 lo cancela y vuelve a la pantalla de "Le toca a…"
    byId("advCortar").onclick = () => {
      const rt = Adivina.rt; if (!rt) return;
      if (rt.fin) { rt.fin = performance.now(); return; }
      Adivina.limpiar(true); s.fase = "listo"; s.turno = null; go("adivina");
    };
    Adivina.encajar(); Adivina.pista();
  },
  pintarResumen(s) {
    const T = s.turno, J = s.jug[T.j], ok = T.palabras.filter(x => x.ok).length, ultimo = s.t + 1 >= s.orden.length, prox = ultimo ? null : s.jug[s.orden[s.t + 1]];
    app.innerHTML = `${head(0)}<section class="screen adv-resumen">
      <div class="center"><p class="adv-ronda">⏰ ¡Tiempo!</p>${Adivina.cara(J, 84)}<h2>${esc(J.name)} adivinó ${ok} palabra${ok === 1 ? "" : "s"}</h2>
        <p class="sub">${T.palabras.length ? "Si algo quedó mal marcado, tocalo para corregirlo." : "No marcó ninguna palabra. ¡Será la próxima!"}</p></div>
      ${T.palabras.length ? `<ul class="adv-lista">${T.palabras.map((x, i) => `<li><button class="${x.ok ? "ok" : "paso"}" data-advfix="${i}" aria-label="${esc(x.w)}: ${x.ok ? "acierto" : "paso"}"><span>${x.ok ? "✅" : "⏭️"}</span><b>${esc(x.w)}</b><small>${Adivina.cat(x.c).ic}</small></button></li>`).join("")}</ul>` : ""}
      <button class="btn tb-girar" id="advSigue">${ultimo ? "🏆 Ver resultados" : `Siguiente: ${esc(prox.name)}`}</button>
      ${s.jug.length > 1 ? Adivina.tablita(s) : ""}
    </section>`;
    app.querySelectorAll("[data-advfix]").forEach(b => b.onclick = () => { const x = T.palabras[+b.dataset.advfix]; x.ok = !x.ok; Adivina.sfx(x.ok ? "bien" : "pasa"); render(); });
    on("advSigue", () => {
      const ok2 = T.palabras.filter(x => x.ok).length;
      J.aciertos += ok2; J.pasadas += T.palabras.length - ok2; J.mejor = Math.max(J.mejor, ok2);
      s.turno = null; s.t++;
      if (s.t >= s.orden.length) { s.fase = "fin"; Adivina.ordenar(s); } else s.fase = "listo";
      go("adivina");
    });
  },
  pintarFin(s) {
    const o = Adivina.ordenar(s), solo = s.jug.length === 1, podio = o.slice(0, 3), lugares = [1, 0, 2].filter(i => podio[i]);
    const empate = !solo && o.filter(j => j.puesto === 1).length > 1;
    app.innerHTML = `${head(0)}<section class="screen adv-fin">
      <div class="center"><h2>${solo ? `¡Adivinaste ${o[0].aciertos}!` : empate ? "🤝 ¡Empate en el primer puesto!" : `🏆 ¡Ganó ${esc(o[0].name)}!`}</h2><p class="sub">${solo ? "Jugando solo no se gana ni se pierde: practicaste." : `${o[0].aciertos} acierto${o[0].aciertos === 1 ? "" : "s"} en total.`}</p></div>
      ${solo ? "" : `<div class="podio">${lugares.map(i => { const J = podio[i]; return `<div class="podio-p p${i + 1}">${J.puesto === 1 ? `<span class="corona">👑</span>` : ""}${Adivina.cara(J, i === 0 ? 86 : 66)}<b>${esc(J.name)}</b><small>${J.aciertos} ✅</small><div class="escalon">${J.puesto}</div></div>`; }).join("")}</div>`}
      <ol class="tabla-rank adv-tabla">${o.map(J => `<li><span class="pos">${J.puesto}</span>${Adivina.cara(J, 34)}<span class="nm"><b>${esc(J.name)}</b><small>Mejor turno: ${J.mejor} · ${J.pasadas} pasada${J.pasadas === 1 ? "" : "s"}</small></span><strong>${J.aciertos}</strong></li>`).join("")}</ol>
      <div class="row"><button class="btn" id="advOtra">Otra partida</button><button class="btn ghost" id="advFinSalir">Salir</button></div></section>`;
    if (!s.sonoFin) { s.sonoFin = true; Adivina.sfx("victoria"); }
    on("advOtra", () => Adivina.empezar());
    on("advFinSalir", () => { S.adv = null; go("adivinaIntro"); });
  }
};
PANTALLAS.adivinaIntro = () => Adivina.intro();
PANTALLAS.adivina = () => Adivina.pantalla();
