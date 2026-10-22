/* Casino de Mesa Loca: ruleta, tragamonedas y bingo (bingo.js) con las monedas del juego.
   Las monedas son del juego: no se compran ni se cambian por plata.
   - Con cuenta en la nube, cada jugada pasa por el servidor (timba_jugar) que controla el saldo y el premio máximo,
     así las ganancias grandes no chocan con el control de "no subir más de 500 monedas de una vez".
   - Con perfil local se guarda en el teléfono. */

const num = n => new Intl.NumberFormat("es").format(Math.round(n || 0));
const Timba = {
  cfg() { return Object.assign({ activo: true, maxApuesta: 2000, pozoPct: 2, pozoCada: 300000, pozoBase: 2000 }, (typeof Nube !== "undefined" && Nube.cfg && Nube.cfg.timba) || {}); },
  abierto() { return this.cfg().activo !== false; },
  maxApuesta() { return Math.max(10, Math.min(50000, +this.cfg().maxApuesta || 2000)); },
  /* Azar del navegador (más parejo que Math.random) */
  azar(n) { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch { return Math.floor(Math.random() * n); } },
  stats(u) {
    u.stats.timba = Object.assign({ jugadas: 0, apostado: 0, ganado: 0, mayor: 0, plenos: 0, jackpots: 0, lineas: 0, bingos: 0, blackjacks: 0, bjGanadas: 0 }, u.stats.timba || {});
    return u.stats.timba;
  },
  /* Lo que se ve en pantalla: mientras gira, el premio todavía no aparece */
  saldo(u) { return Math.max(0, (u.monedas || 0) - (UI.timbaPend || 0) - (UI.pozoPend || 0)); },
  pintarSaldo() { const u = BD.sesion(), e = byId("tbSaldo"); if (u && e) e.textContent = `🪙 ${num(Timba.saldo(u))}`; },

  /* Mueve monedas: apuesta (sale) y premio (entra) en una sola jugada */
  mover(u, juego, apuesta, premio, extra = {}) {
    Eco.completar(u);
    if (apuesta > u.monedas) return false;
    const st = this.stats(u);
    if (apuesta > 0) { st.jugadas++; st.apostado += apuesta; }
    st.ganado += premio; st.mayor = Math.max(st.mayor, premio);
    for (const k of ["plenos", "jackpots", "lineas", "bingos", "blackjacks", "bjGanadas"]) st[k] += extra[k] | 0;
    u.monedas += premio - apuesta;
    BD.guardar();
    if (!(u.nube && typeof Nube !== "undefined" && Nube.sb && Nube.user && Nube.user.id === u.id)) this.pozoLocal(u, juego, apuesta);
    if (u.nube && typeof Nube !== "undefined" && Nube.sb && Nube.user && Nube.user.id === u.id) {
      Nube.enCola(async () => {
        const { data, error } = await Nube.sb.rpc("timba_jugar", { juego, apuesta, premio });
        if (error) { console.warn("timba", error.message); Eco.guardar(u); return; }        // sin el SQL nuevo: se sube como siempre
        if (data && data.ok) {
          if (data.pozo != null) this.ponerPozo({ monto: +data.pozo });
          if (+data.ganoPozo > 0) this.ganarPozo(u, +data.ganoPozo, juego);
          if (!u.pendiente) { u.monedas = data.monedas; BD.guardar(); } this.subirLuego(u);
        }
        else if (data && data.motivo === "saldo") { u.monedas = data.monedas; BD.guardar(); Toast.mostrar(`<div class="t-ic">⚠️</div><div class="t-txt"><b>No alcanzaban las monedas</b><span>Tu saldo se corrigió con el de la nube.</span></div>`, "info"); render(); }
        else if (data && data.motivo === "datos") Eco.guardar(u);                                   // juego que el SQL todavía no conoce: se sube como siempre
        else if (data && data.motivo === "cerrado") { u.monedas -= premio - apuesta; BD.guardar(); Toast.mostrar(`<div class="t-ic">🔒</div><div class="t-txt"><b>El casino está cerrado</b><span>Lo cerró el administrador. No se movieron monedas.</span></div>`, "info"); go("home"); }
      });
    }
    return true;
  },
  /* ---------- Pozo acumulado ----------
     Con cuenta: es uno solo para todos y lo maneja el servidor (cada apuesta le suma y cada tirada de tragamonedas lo sortea).
     Con perfil local: un pozo de este teléfono que funciona igual. */
  pozo: { monto: null },
  ponerPozo(p) { Object.assign(this.pozo, p); this.pintarPozo(); },
  enLaNube() { return typeof Nube !== "undefined" && !!Nube.sb && !!Nube.user; },
  cargarPozo() {
    if (!this.enLaNube()) { this.ponerPozo({ monto: store.get("pozoLocal", this.cfg().pozoBase), local: true }); return; }
    if (Date.now() - (this.pozoLeido || 0) < 8000) return;
    this.pozoLeido = Date.now();
    Nube.sb.from("pozo").select("monto, ganador, ganado, juego, cuando").eq("id", 1).maybeSingle().then(({ data, error }) => {
      if (error || !data) { if (this.pozo.monto == null) this.ponerPozo({ monto: null, sinSql: true }); return; }
      this.ponerPozo({ monto: +data.monto, ganador: data.ganador, ganado: +data.ganado || 0, cuando: data.cuando, local: false, sinSql: false });
    });
  },
  pozoLocal(u, juego, apuesta) {
    if (apuesta <= 0) return;
    const c = this.cfg(); let p = store.get("pozoLocal", c.pozoBase) + Math.ceil(apuesta * c.pozoPct / 100);
    if (juego === "tragamonedas" && Math.random() < apuesta / c.pozoCada) { const gana = p; p = c.pozoBase; u.monedas += gana; BD.guardar(); this.ganarPozo(u, gana, juego, true); }
    store.set("pozoLocal", p); this.ponerPozo({ monto: p, local: true });
  },
  /* Lo ganó: se festeja cuando terminan de girar los rodillos */
  ganarPozo(u, monto, juego, local) {
    const st = this.stats(u); st.jackpots++; st.pozos = (st.pozos || 0) + 1; st.ganado += monto; st.mayor = Math.max(st.mayor, monto);
    UI.pozoPend = (UI.pozoPend || 0) + monto; this.pintarSaldo();
    if (!local) this.ponerPozo({ ganador: u.nombre, ganado: monto, cuando: new Date().toISOString() });
    const mostrar = () => {
      if ((UI.sl && UI.sl.girando) || (UI.rul && UI.rul.girando)) return setTimeout(mostrar, 400);
      UI.pozoPend = Math.max(0, (UI.pozoPend || 0) - monto);
      this.granPremio(monto, 0, true).then(() => { this.pintarSaldo(); this.logros(u); Eco.guardar(u); if (["casino", "slots"].includes(S.screen)) render(); });
    };
    setTimeout(mostrar, 300);
  },
  /* Contador del pozo: sube de a poco hasta el valor nuevo */
  pintarPozo() {
    const els = document.querySelectorAll("[data-pozo]"); if (!els.length) return;
    const meta = this.pozo.monto;
    if (meta == null) { els.forEach(e => e.textContent = "—"); return; }
    cancelAnimationFrame(this.rafPozo);
    const desde = this.pozoVisto == null ? meta : this.pozoVisto, t0 = performance.now();
    const paso = now => { const k = Math.min(1, (now - t0) / 1200), v = Math.round(desde + (meta - desde) * k); this.pozoVisto = v; document.querySelectorAll("[data-pozo]").forEach(e => e.textContent = num(v)); if (k < 1) this.rafPozo = requestAnimationFrame(paso); };
    this.rafPozo = requestAnimationFrame(paso);
    const ult = document.querySelector("[data-pozo-ult]");
    if (ult) ult.textContent = this.pozo.local ? "Pozo de este teléfono (con cuenta en la nube es uno solo para todos)" : this.pozo.ganador ? `Último: ${this.pozo.ganador} se llevó ${num(this.pozo.ganado)} 🪙` : "¡Todavía nadie se lo llevó!";
  },
  bannerPozo() {
    this.cargarPozo();
    return `<div class="tb-pozo"><small>POZO ACUMULADO</small><b><span class="tb-pozo-m">🪙</span> <span data-pozo>${this.pozo.monto == null ? "—" : num(this.pozo.monto)}</span></b><small data-pozo-ult></small></div>`;
  },
  /* Cartel grande en el medio (giros gratis, fin del bonus) */
  cartel(titulo, sub, ms = 1700) {
    return new Promise(res => {
      const d = document.createElement("div"); d.className = "tb-cartel"; d.innerHTML = `<div><b>${titulo}</b><span>${sub || ""}</span></div>`;
      document.body.appendChild(d); const listo = () => { if (d.isConnected) { d.remove(); res(); } };
      d.onclick = listo; setTimeout(listo, ms);
    });
  },
  /* GRAN PREMIO / MEGA PREMIO / POZO: el número sube contando */
  granPremio(monto, apuesta, pozo) {
    return new Promise(res => {
      const x = apuesta ? monto / apuesta : 0, titulo = pozo ? "¡¡POZO ACUMULADO!!" : x >= 100 ? "¡ÉPICO!" : x >= 50 ? "¡MEGA PREMIO!" : "¡GRAN PREMIO!";
      const d = document.createElement("div"); d.className = "tb-gran" + (pozo ? " pozo" : "");
      d.innerHTML = `<div><b>${titulo}</b><strong id="tbGranN">0</strong><span>🪙</span><small>Tocá para seguir</small></div>`;
      document.body.appendChild(d);
      if (typeof Sonido !== "undefined") Sonido.sfx("victoria");
      Timba.lluvia(); if (pozo) setTimeout(() => Timba.lluvia(), 900);
      try { navigator.vibrate && navigator.vibrate([100, 50, 100, 50, 300]); } catch {}
      const dur = pozo ? 3500 : 2200, t0 = performance.now(), n = d.querySelector("#tbGranN");
      const paso = now => { const k = Math.min(1, (now - t0) / dur); n.textContent = num(monto * (1 - Math.pow(1 - k, 3))); if (k < 1 && d.isConnected) requestAnimationFrame(paso); };
      requestAnimationFrame(paso);
      let ok = false; const listo = () => { if (ok) return; ok = true; d.remove(); res(); };
      d.onclick = () => { if (performance.now() - t0 > 600) listo(); };
      setTimeout(listo, dur + (pozo ? 3000 : 1500));
    });
  },
  /* Las estadísticas del casino se suben un rato después (las monedas ya las guardó el servidor) */
  subirLuego(u) { clearTimeout(this.tSubir); this.tSubir = setTimeout(() => Nube.subir(u), 4000); },

  logros(u) {
    const nuevos = LOGROS.filter(l => !u.logros[l.id] && l.ok(u));
    nuevos.forEach(l => { u.logros[l.id] = Date.now(); Toast.mostrar(`<div class="t-ic">${l.ic}</div><div class="t-txt"><small>Logro desbloqueado</small><b>${esc(l.nombre)}</b><span>${esc(l.desc)}</span></div>`, "logro"); });
    if (nuevos.length) Eco.guardar(u);
  },
  festejo(premio, apuesta, grande) {
    if (premio <= 0) return;
    if (typeof Sonido !== "undefined") Sonido.sfx(grande ? "victoria" : "monedas");
    try { navigator.vibrate && navigator.vibrate(grande ? [80, 40, 80, 40, 200] : 60); } catch {}
    if (grande || premio >= apuesta * 10) Timba.lluvia();
  },
  lluvia() {
    const d = document.createElement("div"); d.className = "tb-lluvia";
    d.innerHTML = Array.from({ length: 26 }, (_, i) => `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random() * .8}s;animation-duration:${1.4 + Math.random()}s">🪙</i>`).join("");
    document.body.appendChild(d); setTimeout(() => d.remove(), 3000);
  },
  /* Pantalla para quien no tiene perfil o con el casino cerrado */
  sinPerfil(titulo) {
    const u = BD.sesion();
    if (!u) {
      app.innerHTML = `${head(0)}<section class="stage"><span class="tb-neon">🎰</span><h2>${titulo}</h2><p class="sub">Necesitas un perfil para apostar tus monedas.</p><button class="btn" id="tbPerfil">Crear o elegir perfil</button><button class="btn ghost" id="tbVolver">Volver</button></section>`;
      on("tbPerfil", () => go("perfil")); on("tbVolver", () => go("home")); return true;
    }
    if (!this.abierto()) {
      app.innerHTML = `${head(0)}<section class="stage"><span class="tb-neon">🔒</span><h2>Casino cerrado</h2><p class="sub">El administrador cerró el casino por ahora. ¡Vuelvan más tarde!</p><button class="btn" id="tbVolver">Volver</button></section>`;
      on("tbVolver", () => go("home")); return true;
    }
    return false;
  },
  cabecera(u, titulo, volver = "casino") {
    return `${head(0)}<div class="tb-cab"><button class="linkish" id="tbAtras">‹ ${volver === "casino" ? "Casino" : "Inicio"}</button><b>${titulo}</b><span class="chip-mon" id="tbSaldo">🪙 ${num(Timba.saldo(u))}</span></div>`;
  }
};

/* ---------- Ruleta europea (un solo cero) ---------- */
const RU = {
  RUEDA: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
  ROJOS: new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]),
  FICHAS: [5, 10, 25, 100, 500, 1000, 5000],
  corto: v => v >= 1000 ? (v % 1000 ? (v / 1000).toFixed(1) : v / 1000) + "K" : String(v),
  /* Apuestas de adentro con varios números: "g:1-2" medio (paga 17 a 1), "g:1-2-3" calle (11 a 1), "g:1-2-4-5" cuarto (8 a 1), "g:1-…-6" línea (5 a 1) */
  nums: clave => clave.slice(2).split("-").map(Number),
  NOMBRE: { 2: "Medio", 3: "Calle", 4: "Cuarto", 6: "Línea" },
  /* Apuestas de afuera: [clave, texto, paga (con lo apostado), condición] */
  AFUERA: [
    ["doc1", "1ª docena", 3, n => n >= 1 && n <= 12], ["doc2", "2ª docena", 3, n => n >= 13 && n <= 24], ["doc3", "3ª docena", 3, n => n >= 25],
    ["bajo", "1 a 18", 2, n => n >= 1 && n <= 18], ["par", "Par", 2, n => n > 0 && n % 2 === 0], ["rojo", "Rojo", 2, n => RU.ROJOS.has(n)],
    ["negro", "Negro", 2, n => n > 0 && !RU.ROJOS.has(n)], ["impar", "Impar", 2, n => n % 2 === 1], ["alto", "19 a 36", 2, n => n >= 19],
    ["col1", "2 a 1", 3, n => n > 0 && n % 3 === 1], ["col2", "2 a 1", 3, n => n > 0 && n % 3 === 2], ["col3", "2 a 1", 3, n => n > 0 && n % 3 === 0]
  ],
  color: n => n === 0 ? "verde" : RU.ROJOS.has(n) ? "rojo" : "negro",
  gana(clave, n) {
    if (clave.startsWith("n")) return +clave.slice(1) === n ? 36 : 0;
    if (clave.startsWith("g:")) { const xs = RU.nums(clave); return xs.includes(n) ? 36 / xs.length : 0; }
    const a = RU.AFUERA.find(x => x[0] === clave);
    return a && n > 0 && a[3](n) ? a[2] : 0;
  },
  premio(apuestas, n) { return Object.entries(apuestas).reduce((t, [k, v]) => t + v * RU.gana(k, n), 0); },
  total: ap => Object.values(ap).reduce((t, v) => t + v, 0),

  rueda(rot, bola) {
    const paso = 360 / 37, R = 100, r = 66;
    const pt = (rad, ang) => [rad * Math.sin(ang * Math.PI / 180), -rad * Math.cos(ang * Math.PI / 180)];
    const sect = RU.RUEDA.map((n, k) => {
      const a0 = k * paso - paso / 2, a1 = a0 + paso, [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0), [tx, ty] = pt(86, k * paso);
      return `<path d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r} ${r} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z" class="ru-s ${RU.color(n)}"/>
        <text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" transform="rotate(${(k * paso).toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)})" class="ru-t">${n}</text>`;
    }).join("");
    const rayos = Array.from({ length: 8 }, (_, k) => `<path d="M0 0L${pt(52, k * 45)[0].toFixed(1)} ${pt(52, k * 45)[1].toFixed(1)}" stroke="#d9b45a" stroke-width="3" stroke-linecap="round"/>`).join("");
    return `<svg class="ru-rueda" viewBox="0 0 240 240" aria-hidden="true"><g transform="translate(120 120)">
      <circle r="117" fill="#5a3416"/><circle r="111" fill="#7a4a22" stroke="#d9b45a" stroke-width="2"/>
      <g class="ru-giro" id="ruGiro" style="transform:rotate(${rot}deg)">${sect}<circle r="66" fill="#3a2410"/><circle r="56" fill="#7a4a22" stroke="#d9b45a" stroke-width="1.5"/>${rayos}<circle r="14" fill="#d9b45a"/><circle r="7" fill="#fff3c4"/></g>
      <g class="ru-bola" id="ruBola" style="transform:rotate(${bola}deg)"><circle r="110" fill="none"/><circle cx="0" cy="-74" r="5.5" fill="#fff" stroke="#bbb" stroke-width="1" id="ruBolita"/></g>
      <path d="M0 -104 L-7 -118 L7 -118Z" fill="#ffd43b" stroke="#7a4a22" stroke-width="1.5"/></g></svg>`;
  }
};

PANTALLAS.ruleta = () => {
  if (Timba.sinPerfil("Ruleta")) return;
  const u = BD.sesion(), R = UI.rul = UI.rul || { ficha: 10, ap: {}, prev: {}, hist: [], rot: 0, bola: 0, girando: false, res: null, deshacer: [] };
  const maximo = () => Math.min(Timba.maxApuesta(), Timba.saldo(u));
  const ficha = k => R.ap[k] ? `<span class="ru-ficha f${RU.FICHAS.filter(f => f <= R.ap[k]).pop() || 5}">${RU.corto(R.ap[k])}</span>` : "";
  // Zonas en los bordes y esquinas de cada número: medio, cuarto, calle y línea
  const zona = (xs, cls) => { const k = "g:" + xs.join("-"); return `<span class="ru-z ${cls} ${ganadora(k)}" data-ap="${k}" aria-label="${RU.NOMBRE[xs.length]} ${xs.join(", ")}">${ficha(k)}</span>`; };
  const zonas = (n, f, c) => {
    let z = "";
    if (c < 2) z += zona([n, n + 1], "der");
    if (f < 11) z += zona([n, n + 3], "aba");
    if (c < 2 && f < 11) z += zona([n, n + 1, n + 3, n + 4], "esq");
    if (c === 0) { z += zona([n, n + 1, n + 2], "izq"); if (f < 11) z += zona([n, n + 1, n + 2, n + 3, n + 4, n + 5], "izq-aba"); }
    if (f === 0) { z += zona([0, n], "arr"); if (c < 2) z += zona([0, n, n + 1], "arr-der"); }
    return z;
  };
  const ganadora = k => R.res && !R.girando && RU.gana(k, R.res.n) ? "gana" : "";
  const celda = (k, txt, cls, pos, extra = "") => `<button class="ru-c ${cls} ${ganadora(k)}" data-ap="${k}" style="${pos}">${txt}${extra}${ficha(k)}</button>`;
  // Paño vertical (cómodo en el teléfono): el 0 arriba, 12 filas de 3 números, docenas a la izquierda,
  // apuestas simples a la derecha y los "2 a 1" abajo de cada columna
  let pano = celda("n0", "0", "verde cero", "grid-row:1;grid-column:2/5");
  for (let f = 0; f < 12; f++) for (let c = 0; c < 3; c++) { const n = f * 3 + c + 1; pano += celda("n" + n, n, RU.color(n), `grid-row:${f + 2};grid-column:${c + 2}`, zonas(n, f, c)); }
  ["doc1", "doc2", "doc3"].forEach((k, d) => pano += celda(k, `${d + 1}ª<br>doc.`, "afuera lado", `grid-row:${d * 4 + 2}/${d * 4 + 6};grid-column:1`));
  [["bajo", "1<br>a<br>18"], ["par", "Par"], ["rojo", "◆"], ["negro", "◆"], ["impar", "Im-<br>par"], ["alto", "19<br>a<br>36"]]
    .forEach(([k, t], x) => pano += celda(k, t, `afuera lado ${k === "rojo" ? "rojo" : k === "negro" ? "negro" : ""}`, `grid-row:${x * 2 + 2}/${x * 2 + 4};grid-column:5`));
  ["col1", "col2", "col3"].forEach((k, c) => pano += celda(k, "2 a 1", "afuera", `grid-row:14;grid-column:${c + 2}`));
  const tot = RU.total(R.ap);
  app.innerHTML = `${Timba.cabecera(u, "🎡 Ruleta")}<section class="screen ruleta">
    <div class="ru-mesa" id="ruMesa">
      <div class="ru-rueda-box">${RU.rueda(R.rot, R.bola)}
        <div class="ru-res ${R.res && !R.girando ? RU.color(R.res.n) : ""}" id="ruRes">${R.res && !R.girando ? `<b>${R.res.n}</b><small>${R.res.premio ? `+${num(R.res.premio)} 🪙` : "Sin premio"}</small>` : R.girando ? "<small>¡No va más!</small>" : "<small>Hagan sus apuestas</small>"}</div>
      </div>
      <div class="ru-hist">${R.hist.slice(0, 12).map(n => `<i class="${RU.color(n)}">${n}</i>`).join("") || `<small class="sub">Acá aparecen los últimos números.</small>`}</div>
    </div>
    <p class="tb-linea">Elegí la ficha abajo y tocá el paño. En el medio de un número es pleno; en el borde entre dos, <b>medio</b>; en la esquina entre cuatro, <b>cuarto</b>; en el borde izquierdo de una fila, <b>calle</b> (y entre dos filas, <b>línea</b>).</p>
    <div class="ru-pano ${R.girando ? "quieto" : ""}">${pano}</div>
    <details class="panel"><summary class="label">Cómo se paga</summary><p class="summary">Pleno (un número): 35 a 1. Medio (2 números): 17 a 1. Calle (3 números de una fila): 11 a 1. Cuarto (4 números en esquina): 8 a 1. Línea (6 números, dos filas): 5 a 1. Docenas y columnas (2 a 1): 2 a 1. Rojo/negro, par/impar, 1-18/19-36: 1 a 1. Si sale el 0 pierden todas las apuestas de afuera (el 0 entra en los medios y calles con el 0).</p></details>
    <p class="tb-aviso">Las monedas son del juego: no se compran ni se cambian por plata. Jugá por diversión.</p>
    <div class="ru-barra">
      <div class="ru-fichas" role="radiogroup" aria-label="Valor de la ficha">${RU.FICHAS.map(f => `<button class="ru-ficha grande f${f} ${R.ficha === f ? "on" : ""}" data-ficha="${f}" aria-pressed="${R.ficha === f}">${RU.corto(f)}</button>`).join("")}</div>
      <div class="ru-acc">
        <button class="btn ghost chico" id="ruDes" aria-label="Deshacer la última ficha">↶</button>
        <button class="btn ghost chico" id="ruBorrar" aria-label="Borrar todas las apuestas">✕</button>
        <button class="btn ghost chico" id="ruRep" aria-label="Repetir la apuesta anterior">↻</button>
        <button class="btn tb-girar" id="ruGirar"></button>
      </div>
      <small class="ru-tot" id="ruTot"></small>
    </div>
  </section>`;
  // Actualiza fichas y botones sin redibujar toda la pantalla (así no salta ni parpadea al tocar)
  const refrescar = () => {
    const t = RU.total(R.ap), mx = maximo();
    app.querySelectorAll("[data-ap]").forEach(b => { const vieja = b.querySelector(":scope > .ru-ficha"); if (vieja) vieja.remove(); if (R.ap[b.dataset.ap]) b.insertAdjacentHTML("beforeend", ficha(b.dataset.ap)); });
    byId("ruTot").innerHTML = R.girando ? "Girando…" : `Apostado <b>${num(t)}</b> 🪙 · máx. ${num(mx)}${R.res && R.res.premio ? ` · <b class="ok">Ganaste ${R.res.premio}</b>` : ""}`;
    byId("ruDes").disabled = !R.deshacer.length || R.girando;
    byId("ruBorrar").disabled = !t || R.girando;
    byId("ruRep").disabled = !!t || !RU.total(R.prev) || RU.total(R.prev) > mx || R.girando;
    const g = byId("ruGirar"); g.disabled = !t || t > u.monedas || R.girando; g.textContent = R.girando ? "Girando…" : t ? `🎡 Girar · ${num(t)}` : "🎡 Girar";
  };
  refrescar();
  on("tbAtras", () => { if (!R.girando) go("casino"); });
  if (R.girando) return;
  app.querySelectorAll("[data-ficha]").forEach(b => b.onclick = () => {
    R.ficha = +b.dataset.ficha;
    app.querySelectorAll("[data-ficha]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
  });
  const limpiarResultado = () => { if (!R.res) return; R.res = null; app.querySelectorAll(".ru-c.gana").forEach(x => x.classList.remove("gana")); };
  app.querySelectorAll("[data-ap]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    const k = b.dataset.ap, mx = maximo();
    limpiarResultado();
    if (RU.total(R.ap) + R.ficha > mx) { Toast.mostrar(`<div class="t-ic">🪙</div><div class="t-txt"><b>Llegaste al máximo</b><span>Puedes apostar hasta ${mx} 🪙 por tirada.</span></div>`, "info"); return; }
    R.ap[k] = (R.ap[k] || 0) + R.ficha; R.deshacer.push([k, R.ficha]);
    if (typeof Sonido !== "undefined") Sonido.sfx("clic");
    try { navigator.vibrate && navigator.vibrate(12); } catch {}
    b.classList.remove("toque"); void b.offsetWidth; b.classList.add("toque");
    refrescar();
  });
  on("ruDes", () => { const [k, f] = R.deshacer.pop(); R.ap[k] -= f; if (R.ap[k] <= 0) delete R.ap[k]; refrescar(); });
  on("ruBorrar", () => { R.ap = {}; R.deshacer = []; limpiarResultado(); refrescar(); });
  on("ruRep", () => { R.ap = { ...R.prev }; R.deshacer = Object.entries(R.ap); limpiarResultado(); refrescar(); });
  on("ruGirar", () => {
    const apuesta = RU.total(R.ap);
    if (!apuesta || apuesta > u.monedas) return;
    const n = Timba.azar(37), premio = RU.premio(R.ap, n);
    if (!Timba.mover(u, "ruleta", apuesta, premio, { plenos: R.ap["n" + n] ? 1 : 0 })) return;
    UI.timbaPend = premio;
    R.girando = true; R.res = { n, premio, apuesta, ap: { ...R.ap } };
    // La rueda gira 5 vueltas y deja el número arriba; la bolita gira al revés y cae
    const k = RU.RUEDA.indexOf(n), paso = 360 / 37;
    const destino = R.rot + 360 * 5 + ((((-k * paso) - R.rot) % 360) + 360) % 360;
    R.bola = R.bola % 360; const bolaDestino = -360 * 7;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (typeof Sonido !== "undefined") Sonido.sfx("ruleta");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const g = byId("ruGiro"), b = byId("ruBola");
      if (g) { g.style.transition = "transform 5s cubic-bezier(.12,.75,.2,1)"; g.style.transform = `rotate(${destino}deg)`; }
      if (b) { b.style.transition = "transform 5.4s cubic-bezier(.2,.7,.25,1)"; b.style.transform = `rotate(${bolaDestino}deg)`; }
      setTimeout(() => { const bo = byId("ruBolita"); if (bo) bo.classList.add("cae"); }, 4300);
    }));
    setTimeout(() => {
      R.rot = destino; R.bola = 0; R.girando = false; UI.timbaPend = 0;
      R.hist.unshift(n); R.prev = { ...R.ap }; R.ap = {}; R.deshacer = [];
      if (S.screen === "ruleta") render();
      Timba.festejo(premio, apuesta, premio >= apuesta * 20);
      if (!premio && typeof Sonido !== "undefined") Sonido.sfx("clic");
      Timba.logros(u);
    }, 5600);
  });
};

/* ---------- Entrada del casino ---------- */
PANTALLAS.casino = () => {
  if (Timba.sinPerfil("Casino")) return;
  if (typeof Blackjack !== "undefined") Blackjack.pendientes();
  const u = BD.sesion(), st = Timba.stats(u);
  app.innerHTML = `${Timba.cabecera(u, "🎰 Casino", "inicio")}<section class="screen casino">
    <div class="tb-hero"><span class="tb-neon">CASINO</span><p class="sub">Apuesta tus monedas del juego. ${st.jugadas ? `Llevas ${num(st.jugadas)} jugadas · tu mayor premio: <b>${num(st.mayor)} 🪙</b>.` : "¡Que la suerte te acompañe!"}</p></div>
    ${Timba.bannerPozo()}
    <p class="tb-linea">Cada apuesta del casino (ruleta, máquinas, blackjack y bingo) suma al pozo, y cualquier tirada de tragamonedas se lo puede llevar entero.</p>
    <button class="tb-juego ru" id="tbRuleta"><span class="tb-art">🎡</span><div><b>Ruleta</b><small>Europea, con un solo cero. Plenos, medios, cuartos, calles y líneas.</small></div></button>
    <span class="label">Tragamonedas</span>
    <div class="tb-maqs">${Object.entries(MAQUINAS).map(([k, m]) => `<button class="tb-juego ${m.tema}" data-maq="${k}"><span class="tb-art">${m.ic}</span><div><b>${esc(m.nombre)}</b><small>${esc(m.desc)}</small></div></button>`).join("")}</div>
    <button class="tb-juego bj" id="tbBlackjack"><span class="tb-art">♠️</span><div><b>Blackjack 21</b><small>Contra la banca. Blackjack paga 3 a 2. Doblá y separá.</small></div></button>
    <button class="tb-juego pk" id="tbPoker"><span class="tb-art">🃏</span><div><b>Póker</b><small>Texas Hold'em contra bots (con fichas de la mesa).</small></div></button>
    <button class="tb-juego bi" id="tbBingo"><span class="tb-art">🎱</span><div><b>Bingo</b><small>Contra compus acá, o con amigos en "Jugar online". Hasta 3 cartones.</small></div></button>
    <p class="tb-aviso">Las monedas son del juego: no se compran ni se cambian por plata. Si un día te quedas sin monedas, juega partidas, trabajos o cobra el premio diario.</p>
  </section>`;
  on("tbAtras", () => go("home"));
  on("tbRuleta", () => go("ruleta"));
  on("tbBingo", () => go("bingoSolo"));
  on("tbPoker", () => go("pokerIntro"));
  on("tbBlackjack", () => go("blackjack"));
  app.querySelectorAll("[data-maq]").forEach(b => b.onclick = () => { UI.maquina = b.dataset.maq; go("slots"); });
  Timba.pintarPozo();
};

/* Mientras estás en el casino, el pozo se actualiza solo (sube con lo que apuestan los demás) */
setInterval(() => { if (typeof S !== "undefined" && ["casino", "slots", "ruleta", "blackjack", "bingoSolo"].includes(S.screen) && !document.hidden) { Timba.cargarPozo(); Timba.pintarPozo(); } }, 10000);
