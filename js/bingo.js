/* Bingo de 90 bolillas con cartones de 3 filas × 9 columnas (15 números, 5 por fila).
   - Cada cartón tiene un valor y se pueden comprar hasta 3. Lo que se junta es el pozo:
     30% para la primera LÍNEA (una fila completa) y 70% para el BINGO (cartón lleno). Si cantan dos a la vez, se reparte.
   - Solo: contra compus (la casa paga sus cartones y se queda con el 10%). Online: entre amigos, sin comisión.
   - Las bolillas salen solas y los números se marcan solos. */
const BI = {
  VALORES: [10, 25, 50, 100],
  VELOCIDADES: [[1500, "Rápido"], [2500, "Normal"], [4000, "Tranqui"]],
  /* Algunos números con su nombre de la quiniela */
  QUINIELA: { 1: "el agua", 2: "el niño", 3: "San Cono", 4: "la cama", 5: "el gato", 6: "el perro", 7: "el revólver", 8: "el incendio", 9: "el arroyo", 12: "el soldado", 13: "la yeta", 14: "el borracho", 15: "la niña bonita", 17: "la desgracia", 18: "la sangre", 19: "el pescado", 20: "la fiesta", 21: "la mujer", 22: "el loco", 24: "el caballo", 25: "la gallina", 27: "el peine", 32: "el dinero", 34: "la cabeza", 35: "el pajarito", 47: "el muerto", 48: "el muerto que habla", 50: "el pan", 53: "el barco", 54: "la vaca", 75: "el payaso", 79: "el ladrón", 90: "el miedo" }
};

const Bingo = {
  /* Cartón: 3 filas de 9; en cada fila hay 5 números. La columna c lleva del c·10 al c·10+9 (la primera del 1 al 9, la última del 80 al 90). */
  carton() {
    for (;;) {
      const filas = [0, 1, 2].map(() => shuffle([...Array(9).keys()]).slice(0, 5));
      const usadas = new Set(filas.flat());
      if (usadas.size < 9) continue;
      const g = [0, 1, 2].map(() => Array(9).fill(0));
      for (let c = 0; c < 9; c++) {
        const rs = [0, 1, 2].filter(f => filas[f].includes(c));
        const desde = c === 0 ? 1 : c * 10, hasta = c === 8 ? 90 : c * 10 + 9;
        const nums = shuffle(Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)).slice(0, rs.length).sort((a, b) => a - b);
        rs.forEach((f, k) => g[f][c] = nums[k]);
      }
      return g;
    }
  },
  numeros: c => c.flat().filter(Boolean),
  faltan(c, salio) { return Bingo.numeros(c).filter(n => !salio.has(n)).length; },
  faltanLinea(c, salio) { return Math.min(...c.map(f => f.filter(n => n && !salio.has(n)).length)); },

  setup(jug, cfg) {
    return {
      id: "bin-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      cfg: { valor: cfg.valor | 0, vel: cfg.vel || 2500, casa: !!cfg.casa },
      jug: jug.map(j => ({ id: j.id, name: j.name, cpu: !!j.cpu, cartones: Array.from({ length: j.n || 0 }, () => Bingo.carton()) })),
      fase: "compra", bolas: shuffle(Array.from({ length: 90 }, (_, i) => i + 1)), salidas: [], linea: null, bingo: null, pausa: false, espera: 0
    };
  },
  pozo(s) {
    const cartones = s.jug.reduce((t, j) => t + j.cartones.length, 0), bruto = cartones * s.cfg.valor;
    const neto = s.cfg.casa ? Math.floor(bruto * 0.9) : bruto, linea = Math.floor(neto * 0.3);
    return { cartones, total: neto, linea, bingo: neto - linea };
  },
  empezar(s) {
    if (s.fase !== "compra" || !s.jug.some(j => j.cartones.length)) return false;
    s.premios = Bingo.pozo(s); s.fase = "juego"; s.espera = Date.now() + 1500;
    return true;
  },
  /* Saca una bolilla y revisa línea y bingo */
  sacar(s) {
    if (s.fase !== "juego" || !s.bolas.length) return;
    const n = s.bolas.pop(); s.salidas.push(n);
    const salio = new Set(s.salidas);
    const quienes = test => s.jug.flatMap((j, i) => j.cartones.map((c, k) => ({ i, k, c })).filter(x => test(x.c)));
    if (!s.linea) {
      const g = quienes(c => c.some(f => f.every(x => !x || salio.has(x))));
      if (g.length) { const p = Math.floor(s.premios.linea / g.length); s.linea = { bola: n, ganadores: g.map(({ i, k }) => ({ i, k, premio: p })) }; s.espera = Date.now() + 3500; }
    }
    const b = quienes(c => Bingo.faltan(c, salio) === 0);
    if (b.length) { const p = Math.floor(s.premios.bingo / b.length); s.bingo = { bola: n, ganadores: b.map(({ i, k }) => ({ i, k, premio: p })) }; s.fase = "fin"; }
    if (!s.bolas.length && s.fase === "juego") s.fase = "fin";
  },
  /* Un paso del reloj: respeta la pausa y el festejo de la línea */
  tic(s) {
    if (s.fase !== "juego" || s.pausa || Date.now() < s.espera) return false;
    if (Date.now() - (s.ultimoTic || 0) < s.cfg.vel - 60) return false;
    s.ultimoTic = Date.now(); Bingo.sacar(s); return true;
  },
  premioDe(s, i) { return [s.linea, s.bingo].reduce((t, x) => t + (x ? x.ganadores.filter(g => g.i === i).reduce((a, g) => a + g.premio, 0) : 0), 0); },

  act(s, pid, a) {
    const i = s.jug.findIndex(j => j.id === pid), J = s.jug[i];
    if (!J) return;
    if (a.t === "cartones" && s.fase === "compra") { const n = Math.max(0, Math.min(3, a.n | 0)); J.cartones = Array.from({ length: n }, (_, k) => J.cartones[k] || Bingo.carton()); }
    if (a.t === "cambiar" && s.fase === "compra" && J.cartones[a.k]) J.cartones[a.k] = Bingo.carton();
    if (a.t === "sinSaldo" && s.fase === "juego" && s.salidas.length < 3) { J.cartones = []; s.premios = Bingo.pozo(s); }
  },

  view(s, pid) {
    const yo = s.jug.findIndex(j => j.id === pid), salio = new Set(s.salidas), p = s.premios || Bingo.pozo(s);
    const nombre = g => ({ name: s.jug[g.i].name, premio: g.premio, yo: g.i === yo });
    return {
      game: "bingo", id: s.id, me: pid, yo, fase: s.fase, cfg: s.cfg, salidas: s.salidas, pausa: s.pausa, pozo: p,
      jug: s.jug.map(j => ({ name: j.name, cpu: j.cpu, n: j.cartones.length, faltan: j.cartones.length ? Math.min(...j.cartones.map(c => Bingo.faltan(c, salio))) : null })),
      cartones: yo >= 0 ? s.jug[yo].cartones : [],
      linea: s.linea ? { bola: s.linea.bola, ganadores: s.linea.ganadores.map(nombre), cartones: s.linea.ganadores.filter(g => g.i === yo).map(g => g.k) } : null,
      bingo: s.bingo ? { bola: s.bingo.bola, ganadores: s.bingo.ganadores.map(nombre), cartones: s.bingo.ganadores.filter(g => g.i === yo).map(g => g.k) } : null,
      miPremio: yo >= 0 ? Bingo.premioDe(s, yo) : 0
    };
  },

  /* ---------- Monedas: cada teléfono cobra y paga lo suyo, una sola vez por partida ---------- */
  cuentas(v, enviar) {
    const u = BD.sesion();
    if (!u || v.yo < 0 || !v.cfg.valor) return;
    const hechas = store.get("bingoCuentas", {}), h = hechas[v.id] || { pago: 0, cobro: 0 };
    if (v.fase !== "compra" && v.cartones.length && !h.pago) {
      const costo = v.cartones.length * v.cfg.valor;
      if (Timba.mover(u, "bingo", costo, 0)) h.pago = costo;
      else { h.pago = -1; enviar({ t: "sinSaldo" }); }
    }
    if (h.pago > 0 && v.miPremio > h.cobro) {
      const extra = v.miPremio - h.cobro;
      Timba.mover(u, "bingo", 0, extra, { lineas: v.linea && v.linea.cartones.length && !h.linea ? 1 : 0, bingos: v.bingo && v.bingo.cartones.length ? 1 : 0 });
      h.linea = h.linea || !!(v.linea && v.linea.cartones.length);
      h.cobro = v.miPremio;
      Timba.festejo(extra, 1, v.bingo && v.bingo.cartones.length);
      Timba.logros(u);
    }
    hechas[v.id] = h;
    store.set("bingoCuentas", Object.fromEntries(Object.entries(hechas).slice(-30)));
  },

  /* ---------- Dibujo ---------- */
  bola(n, cls = "") {
    const col = ["#e03131", "#f08c00", "#ffd43b", "#2f9e44", "#1c7ed6", "#7048e8", "#d6336c", "#0ca678", "#495057"][Math.min(8, Math.floor(n / 10))];
    return `<span class="bi-bola ${cls}" style="--bc:${col}"><b>${n}</b></span>`;
  },
  dibCarton(c, salio, opts = {}) {
    const ultima = opts.ultima, lineaHecha = opts.linea;
    return `<div class="bi-carton ${opts.gano ? "gano" : ""}">${opts.titulo ? `<div class="bi-cart-cab"><b>${opts.titulo}</b>${opts.extra || ""}</div>` : ""}
      <div class="bi-grilla">${c.map((f, r) => { const llena = f.every(x => !x || salio.has(x)); return f.map(n => `<span class="bi-n ${n ? "" : "vacio"} ${n && salio.has(n) ? "marca" : ""} ${n === ultima ? "nueva" : ""} ${llena && lineaHecha ? "fila" : ""}">${n || ""}</span>`).join(""); }).join("")}</div></div>`;
  },

  render(v, send, opts) {
    const salio = new Set(v.salidas), ultima = v.salidas[v.salidas.length - 1], jefe = opts.local || opts.isHost, valor = v.cfg.valor;
    const cab = opts.local ? Timba.cabecera(BD.sesion(), "🎱 Bingo") : Net.cabecera();
    if (v.fase === "compra") {
      const u = BD.sesion(), puede = n => !valor || (u && u.monedas >= n * valor);
      app.innerHTML = `${cab}<section class="screen bingo">
        <div class="bi-pozo"><span class="label">Pozo</span><b>${v.pozo.total} 🪙</b><small>Línea ${v.pozo.linea} · Bingo ${v.pozo.bingo}</small></div>
        <p class="sub center">${valor ? `Cada cartón vale <b>${valor} 🪙</b>. Elige cuántos quieres (hasta 3).` : "Partida amistosa: los cartones son gratis y no hay premio en monedas."}${!opts.local && valor && !u ? " Necesitas un perfil con monedas para comprar cartones." : ""}</p>
        ${v.yo >= 0 ? `<div class="seg bi-cuantos">${[0, 1, 2, 3].map(n => `<button aria-pressed="${v.cartones.length === n}" data-bin="${n}" ${puede(n) ? "" : "disabled"}>${n ? `${n} cartón${n > 1 ? "es" : ""}` : "Ninguno"}</button>`).join("")}</div>` : ""}
        ${v.cartones.map((c, k) => Bingo.dibCarton(c, salio, { titulo: `Cartón ${k + 1}`, extra: `<button class="linkish" data-cambiar="${k}">🔀 Cambiar</button>` })).join("")}
        <div class="panel"><span class="label">En la mesa</span><ul class="players">${v.jug.map(j => `<li>${j.cpu ? `<span class="cpu-ic">🤖</span>` : avatar(j.name, 34)}<span class="name">${esc(j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name)}</span><span class="badge">${j.n ? `${j.n} 🎟️` : "mirando"}</span></li>`).join("")}</ul></div>
        ${jefe ? `<button class="btn tb-girar" id="biEmpezar" ${v.pozo.cartones ? "" : "disabled"}>🎱 ¡Que empiece el bingo!</button>` : `<p class="sub center">El anfitrión arranca cuando estén todos.</p>`}
      </section>`;
    } else {
      const fin = v.fase === "fin", miLinea = new Set(v.linea ? v.linea.cartones : []), miBingo = new Set(v.bingo ? v.bingo.cartones : []);
      const ganTxt = x => x.ganadores.map(g => `${g.yo ? "¡Vos!" : esc(g.name.replace(/^🤖\s*/, ""))}${valor ? ` (+${g.premio})` : ""}`).join(", ");
      const top = v.jug.filter(j => j.n).sort((a, b) => a.faltan - b.faltan).slice(0, 4);
      app.innerHTML = `${cab}<section class="screen bingo">
        <div class="bi-bombo">
          <div class="bi-actual">${ultima ? Bingo.bola(ultima, "grande") : `<span class="bi-bola grande vacia"><b>?</b></span>`}<small>${ultima ? (BI.QUINIELA[ultima] ? `«${BI.QUINIELA[ultima]}»` : `Bolilla ${v.salidas.length}`) : "Mezclando…"}</small></div>
          <div class="bi-info"><div class="bi-ultimas">${v.salidas.slice(-6, -1).reverse().map(n => Bingo.bola(n)).join("")}</div>
            <div class="bi-premios"><span class="${v.linea ? "hecho" : ""}">Línea <b>${v.pozo.linea}</b></span><span class="${v.bingo ? "hecho" : ""}">Bingo <b>${v.pozo.bingo}</b></span></div>
            <small class="sub">${v.salidas.length}/90 bolillas${v.pausa ? " · ⏸ en pausa" : ""}</small></div>
        </div>
        ${v.linea ? `<div class="bi-canto linea" data-k="l${v.linea.bola}"><b>¡LÍNEA!</b> ${ganTxt(v.linea)}</div>` : ""}
        ${v.bingo ? `<div class="bi-canto bingo" data-k="b${v.bingo.bola}"><b>¡BINGO!</b> ${ganTxt(v.bingo)}</div>` : ""}
        ${fin ? `<div class="verdict ${v.bingo && v.bingo.cartones.length ? "good" : ""}"><div class="big">${v.bingo && v.bingo.cartones.length ? "¡Cantaste bingo!" : v.bingo ? "Fin del bingo" : "Se terminaron las bolillas"}</div><div class="note">${v.miPremio ? `Ganaste <b>${v.miPremio} 🪙</b>.` : v.cartones.length ? "Esta vez no hubo suerte." : ""}</div></div>
          ${jefe ? `<div class="row"><button class="btn" id="biOtra">Otra partida</button><button class="btn ghost" id="biSalir">${opts.local ? "Casino" : "Volver a la sala"}</button></div>` : `<p class="sub center">El anfitrión puede empezar otra.</p>`}` : ""}
        ${v.cartones.map((c, k) => { const f = Bingo.faltan(c, salio), fl = Bingo.faltanLinea(c, salio);
          return Bingo.dibCarton(c, salio, { ultima, linea: miLinea.has(k) || (!v.linea ? false : true), gano: miBingo.has(k), titulo: `Cartón ${k + 1}`,
            extra: `<span class="bi-faltan ${f <= 2 ? "cerca" : ""}">${miBingo.has(k) ? "🏆 ¡Bingo!" : miLinea.has(k) ? `✅ Línea · faltan ${f}` : !v.linea && fl <= 1 ? `🔥 ¡Línea a ${fl}!` : `Faltan ${f}`}</span>` }); }).join("")}
        ${!v.cartones.length && v.yo >= 0 ? `<p class="sub center">Estás mirando esta partida.</p>` : ""}
        ${top.length ? `<div class="panel"><span class="label">Los que están más cerca</span><ul class="bi-cerca">${top.map(j => `<li><span>${esc(j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name)}</span><b class="${j.faltan <= 2 ? "cerca" : ""}">${j.faltan === 0 ? "¡Bingo!" : `falta${j.faltan > 1 ? "n" : ""} ${j.faltan}`}</b></li>`).join("")}</ul></div>` : ""}
        ${jefe && !fin ? `<button class="btn ghost" id="biPausa">${v.pausa ? "▶ Seguir" : "⏸ Pausa"}</button>` : ""}
        <details class="panel"><summary class="label">Tablero (${v.salidas.length} salieron)</summary><div class="bi-tablero">${Array.from({ length: 90 }, (_, i) => `<i class="${salio.has(i + 1) ? "on" : ""}">${i + 1}</i>`).join("")}</div></details>
      </section>`;
    }
    app.querySelectorAll("[data-bin]").forEach(b => b.onclick = () => send({ t: "cartones", n: +b.dataset.bin }));
    app.querySelectorAll("[data-cambiar]").forEach(b => b.onclick = () => send({ t: "cambiar", k: +b.dataset.cambiar }));
    on("biEmpezar", () => send({ t: "empezar" }));
    on("biPausa", () => send({ t: "pausa" }));
    on("biOtra", () => send({ t: "again" }));
    on("biSalir", () => opts.local ? go("casino") : send({ t: "lobby" }));
    on("tbAtras", () => { if (v.fase !== "juego" || confirm("¿Salir del bingo? Los cartones ya están pagados.")) { Bingo.parar(); go("casino"); } });
    Bingo.cuentas(v, send);
  },

  /* ---------- Solo, contra compus ---------- */
  timer: null,
  parar() { clearInterval(Bingo.timer); Bingo.timer = null; },
  empezarSolo(cfg) {
    const u = BD.sesion();
    const cpus = Array.from({ length: cfg.cpus }, (_, i) => ({ id: "c" + i, name: TR_CPU[i % TR_CPU.length], cpu: true, n: 1 + Timba.azar(3) }));
    S.bin = Bingo.setup([{ id: "yo", name: u.nombre, n: cfg.n }, ...cpus], { valor: cfg.valor, vel: cfg.vel, casa: true });
    go("bingo");
  },
  relojLocal() {
    if (Bingo.timer) return;
    Bingo.timer = setInterval(() => {
      const s = S.bin;
      if (S.screen !== "bingo" || !s || s.fase !== "juego") return Bingo.parar();
      if (Bingo.tic(s)) render();
    }, 200);
  },

  /* ---------- Online: el anfitrión saca las bolillas ---------- */
  empezarOn(R) {
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name, n: 0 }));
    R.bin = Bingo.setup(jug, { valor: S.biCfg.valor, vel: S.biCfg.vel });
    R.game = "bingo";
    return null;
  },
  actOn(R, pid, a) {
    const s = R.bin;
    if (a.t === "again" && pid === "H") { R.bin = Bingo.setup(s.jug.filter(j => !j.cpu).map(j => ({ id: j.id, name: j.name, n: 0 })), s.cfg); return; }
    if (a.t === "lobby" && pid === "H") { R.game = null; R.bin = null; Bingo.paraHost(); return; }
    if (a.t === "empezar" && pid === "H") { if (Bingo.empezar(s)) Bingo.relojHost(R); return; }
    if (a.t === "pausa" && pid === "H") { s.pausa = !s.pausa; return; }
    Bingo.act(s, pid, a);
  },
  timerHost: null,
  paraHost() { clearInterval(Bingo.timerHost); Bingo.timerHost = null; },
  relojHost(R) {
    Bingo.paraHost();
    Bingo.timerHost = setInterval(() => {
      if (R.game !== "bingo" || !R.bin || R.bin.fase !== "juego") { if (R.bin && R.bin.fase === "fin") Net.broadcast(); return Bingo.paraHost(); }
      if (Bingo.tic(R.bin)) Net.broadcast();
    }, 200);
  }
};

/* Elegir valor, cartones y compus antes de jugar solo */
PANTALLAS.bingoSolo = () => {
  if (Timba.sinPerfil("Bingo")) return;
  const u = BD.sesion(), c = S.biCfg, costo = c.n * c.valor, ok = costo <= u.monedas;
  app.innerHTML = `${Timba.cabecera(u, "🎱 Bingo")}<section class="screen bingo">
    <div class="tb-hero"><span class="tb-neon">BINGO</span><p class="sub">Línea paga el 30% del pozo y bingo el 70%. Las compus también compran cartones y suman al pozo.</p></div>
    <div class="panel"><span class="label">Valor del cartón</span><div class="seg">${BI.VALORES.map(x => `<button aria-pressed="${c.valor === x}" data-biv="${x}">${x} 🪙</button>`).join("")}</div>
      <span class="label">Tus cartones</span><div class="seg">${[1, 2, 3].map(x => `<button aria-pressed="${c.n === x}" data-bic="${x}">${x}</button>`).join("")}</div>
      <span class="label">Compus en la mesa</span><div class="seg">${[3, 5, 7].map(x => `<button aria-pressed="${c.cpus === x}" data-bip="${x}">${x}</button>`).join("")}</div>
      <span class="label">Velocidad</span><div class="seg">${BI.VELOCIDADES.map(([ms, t]) => `<button aria-pressed="${c.vel === ms}" data-biz="${ms}">${t}</button>`).join("")}</div></div>
    <p class="tb-linea">Pagas <b>${costo} 🪙</b> · tienes ${u.monedas} 🪙</p>
    ${ok ? "" : `<p class="warn">No te alcanzan las monedas para ${c.n} cartón${c.n > 1 ? "es" : ""} de ${c.valor}.</p>`}
    <button class="btn tb-girar" id="biJugar" ${ok ? "" : "disabled"}>🎱 Comprar y jugar</button>
    <p class="summary center">¿Con amigos? Crea una sala en "Jugar online" y elige Bingo.</p>
  </section>`;
  const set = (k, v) => { c[k] = v; store.set("biCfg", c); render(); };
  app.querySelectorAll("[data-biv]").forEach(b => b.onclick = () => set("valor", +b.dataset.biv));
  app.querySelectorAll("[data-bic]").forEach(b => b.onclick = () => set("n", +b.dataset.bic));
  app.querySelectorAll("[data-bip]").forEach(b => b.onclick = () => set("cpus", +b.dataset.bip));
  app.querySelectorAll("[data-biz]").forEach(b => b.onclick = () => set("vel", +b.dataset.biz));
  on("tbAtras", () => go("casino"));
  on("biJugar", () => Bingo.empezarSolo(c));
};

PANTALLAS.bingo = () => {
  const s = S.bin;
  if (!s) return go("casino");
  Bingo.render(Bingo.view(s, "yo"), a => {
    if (a.t === "again") return go("bingoSolo");
    if (a.t === "empezar") { if (Bingo.empezar(s)) Bingo.relojLocal(); }
    else if (a.t === "pausa") s.pausa = !s.pausa;
    else Bingo.act(s, "yo", a);
    render();
  }, { local: true });
  if (s.fase === "juego") Bingo.relojLocal();
};
