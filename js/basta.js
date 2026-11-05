/* Basta (Tutti Frutti): sale una letra y todos escriben a la vez una palabra por categoría que empiece con ella.
   - El primero que completa todo canta ¡BASTA! y los demás tienen 10 segundos más. Si hay tiempo por ronda y se acaba, se cierra igual.
   - Puntos por respuesta: 20 si sos el único que puso algo válido en esa categoría, 10 si tu respuesta no la repitió nadie,
     5 si alguien puso lo mismo, 0 si está vacía, no empieza con la letra o tiene cosas raras (números, símbolos).
   - En la revisión cualquiera toca una respuesta para decir "no vale": si la mayoría de las personas (sin contar al autor) dice que no, vale 0.
     En un empate decide el anfitrión si otro votó con él. El autor puede anular la suya.
   - Online cada uno escribe en su teléfono (el anfitrión manda); en un teléfono se juega contra bots que escriben solos. */
const BA = {
  CATS: [["nombre", "Nombre"], ["apellido", "Apellido"], ["lugar", "País o ciudad"], ["animal", "Animal"], ["fruta", "Fruta o verdura"], ["color", "Color"], ["cosa", "Cosa"], ["marca", "Marca"], ["famoso", "Famoso"], ["comida", "Comida"]],
  FACILES: "ABCDEFGHIJLMNOPRSTUVZ", DIFICILES: "KÑQWXY",
  CUENTA: 10000, GRACIA: 1200, RULETA: 2800, MAX: 30,
  ART: /^(el|la|los|las|un|una|unos|unas)\s+(?=\S)/
};

const Basta = {
  clave: "basta", nombre: "Basta", t: null,
  descripcion: "El Tutti Frutti de siempre: sale una letra y hay que llenar todas las categorías antes que los demás. El primero que termina grita ¡Basta!",
  cfg() {
    const c = Turnero.cfg("basta", { bots: 3, rondas: 3, tiempo: 90, dificiles: false, cats: BA.CATS.map(x => x[0]), extra: "" });
    if (!Array.isArray(c.cats) || c.cats.length < 4) c.cats = BA.CATS.map(x => x[0]);
    return c;
  },
  guardarCfg() { store.set("bastaCfg", Basta.cfg()); if (S.screen === "online" && typeof Net !== "undefined" && Net.activo()) Net.cfgCambiada(); else render(); },
  extraCfg: x => String(x || "").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20),

  /* ---------- Palabras ---------- */
  sinTildes: s => String(s).toLowerCase().replace(/ñ/g, "\u0001").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0001/g, "ñ"),
  limpia: s => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").replace(/^ /, "").slice(0, BA.MAX),
  /* [con artículo, sin artículo] en minúscula y sin tildes */
  base(w) { const b = Basta.sinTildes(w).trim().replace(/\s+/g, " "); return [b, b.replace(BA.ART, "")]; },
  /* ok | vacia | invalida (símbolos, números o muy corta) | letra (no empieza con la letra) */
  estado(w, letra) {
    const [b, sin] = Basta.base(w);
    if (!b) return "vacia";
    if (!/^[a-zñ][a-zñ '.\-]*$/.test(b) || (sin.match(/[a-zñ]/g) || []).length < 2) return "invalida";
    const l = letra.toLowerCase();
    return sin[0] === l || b[0] === l ? "ok" : "letra";
  },
  /* Para comparar respuestas: sin artículo, sin espacios ni signos y más o menos en singular */
  comparar(w) {
    let k = Basta.base(w)[1].replace(/[^a-zñ]/g, "");
    if (k.length > 3) k = k.replace(/(es|s)$/, "");
    return k.replace(/e$/, "");
  },
  /* La mayoría de las personas (sin el autor) dijo que no vale; en un empate con el voto del anfitrión (y al menos otro) también; el autor puede bajarla */
  anulada(s, i, c) {
    const votos = s.votos[i + ":" + c] || [], autor = s.jug[i].id;
    if (votos.includes(autor)) return true;
    const electores = s.jug.filter(j => !j.cpu && j.id !== autor).map(j => j.id), n = votos.filter(v => electores.includes(v)).length;
    if (!n) return false;
    // En un empate decide el anfitrión, pero solo si alguien más votó con él (solo no puede anular a nadie)
    return n * 2 > electores.length || (n >= 2 && n * 2 === electores.length && votos.includes(s.host));
  },
  puntuar(s) {
    const est = s.jug.map((J, i) => s.cats.map((_, c) => { const e = Basta.estado(J.resp[c], s.letra); return e === "ok" && Basta.anulada(s, i, c) ? "anulada" : e; }));
    const pts = s.jug.map(() => s.cats.map(() => 0));
    s.cats.forEach((_, c) => {
      const ok = s.jug.map((_, i) => i).filter(i => est[i][c] === "ok");
      if (ok.length === 1) { pts[ok[0]][c] = 20; return; }
      const k = ok.map(i => Basta.comparar(s.jug[i].resp[c]));
      ok.forEach((i, x) => pts[i][c] = k.filter(y => y === k[x]).length > 1 ? 5 : 10);
    });
    return { est, pts, ronda: pts.map(p => p.reduce((a, b) => a + b, 0)) };
  },

  /* ---------- Partida (en el anfitrión o en este teléfono) ---------- */
  crear(jug, cfg) {
    const keys = BA.CATS.map(x => x[0]), elegidas = Array.isArray(cfg.cats) ? cfg.cats : [];
    let cats = keys.filter(k => elegidas.includes(k));
    if (cats.length < 4) cats = keys;
    cats = cats.map(k => ({ k, n: BA.CATS.find(x => x[0] === k)[1] }));
    const extra = Basta.extraCfg(cfg.extra);
    if (extra) cats.push({ k: "extra", n: extra });
    const s = { id: Turnero.nuevoId("ba"), rondas: [3, 5, 7].includes(+cfg.rondas) ? +cfg.rondas : 3, tiempo: [0, 60, 90, 120].includes(+cfg.tiempo) ? +cfg.tiempo : 90,
      letras: (BA.FACILES + (cfg.dificiles ? BA.DIFICILES : "")).split(""), usadas: [], cats, ronda: 0, mov: 0, host: cfg.host, hist: [],
      jug: jug.map(j => ({ ...j, resp: [], total: 0, palabras: 0, unicas: 0, bastas: 0, mejor: 0, listo: false })) };
    Basta.nuevaRonda(s);
    return s;
  },
  /* Sorteo de la letra: las más usadas en castellano salen más seguido (A, C, M, P, S…) y las raras menos (Z, U, I…).
     Además se acuerda de las últimas letras que salieron en este teléfono (también entre partidas) para no repetirlas pronto. */
  PESOS: { A: 10, B: 7, C: 10, D: 7, E: 7, F: 6, G: 6, H: 4, I: 3, J: 4, L: 8, M: 9, N: 6, O: 4, P: 9, R: 7, S: 9, T: 8, U: 2, V: 5, Z: 2, K: 1, Ñ: 1, Q: 2, W: 1, X: 1, Y: 1 },
  sortear(letras, usadas) {
    const recientes = store.get("bastaRecientes", []), evitar = new Set([...usadas, ...recientes.slice(-Math.min(12, letras.length - 4))]);
    let libres = letras.filter(l => !evitar.has(l));
    if (!libres.length) libres = letras.filter(l => !usadas.includes(l));
    if (!libres.length) libres = letras;
    const tot = libres.reduce((t, l) => t + (Basta.PESOS[l] || 3), 0);
    let r = Math.random() * tot, letra = libres[libres.length - 1];
    for (const l of libres) { r -= Basta.PESOS[l] || 3; if (r < 0) { letra = l; break; } }
    store.set("bastaRecientes", [...recientes, letra].slice(-20));
    return letra;
  },
  nuevaRonda(s) {
    s.ronda++;
    s.letra = Basta.sortear(s.letras, s.usadas); s.usadas.push(s.letra);
    Object.assign(s, { fase: "ruleta", hasta: Date.now() + BA.RULETA, bastaPor: -1, bastaFin: 0, limite: 0, votos: {}, motivo: "" });
    s.jug.forEach(J => { J.resp = s.cats.map(() => ""); J.listo = false; J.plan = null; });
    s.mov++;
  },
  /* Los bots arman lo que van a escribir y cuándo: más hábiles, más palabras y más rápido. A veces completan todo y cantan basta. */
  planear(s) {
    const t0 = Date.now();
    s.jug.forEach(J => {
      if (!J.cpu) return;
      const h = Turnero.habilidad("basta", J.nivel), rapido = Math.random() < 0.2 + 0.45 * h, p = 0.5 + 0.45 * h;
      const items = shuffle(s.cats.map((_, c) => c)).map(c => {
        const lista = (BASTA_DATOS[s.cats[c].k] || {})[s.letra] || [];
        if (!lista.length || (!rapido && Math.random() > p)) return null;
        // Los flojos usan las más comunes (y se repiten más entre ellos)
        return { c, w: lista[Math.floor(Math.pow(Math.random(), 1.6 - h) * lista.length)] };
      }).filter(Boolean);
      const total = (62 - 36 * h) * 1000 * (0.75 + Math.random() * 0.5);
      let t = t0 + 2500 + Math.random() * 2000;
      items.forEach(x => { t += total / Math.max(1, items.length) * (0.5 + Math.random()); x.t = t; });
      J.plan = { items, basta: items.length === s.cats.length };
    });
  },
  cantar(s, i) {
    const now = Date.now();
    Object.assign(s, { fase: "cuenta", bastaPor: i, bastaFin: now + BA.CUENTA });
    s.jug[i].bastas++;
    // Los bots se apuran
    s.jug.forEach(J => { if (J.plan) J.plan.items.forEach(x => { if (!x.hecho) x.t = now + (x.t - now) * 0.4; }); });
    s.mov++;
  },
  cerrar(s, motivo) { s.fase = "revision"; s.motivo = motivo; s.mov++; },
  seguir(s) {
    const P = Basta.puntuar(s);
    s.jug.forEach((J, i) => {
      J.total += P.ronda[i]; J.mejor = Math.max(J.mejor, P.ronda[i]);
      J.palabras += P.est[i].filter(e => e === "ok").length; J.unicas += P.pts[i].filter(p => p >= 10).length;
    });
    s.hist.push({ letra: s.letra, pts: P.ronda.slice() });
    if (s.ronda >= s.rondas) { s.fase = "fin"; Basta.ordenar(s); s.mov++; }
    else Basta.nuevaRonda(s);
  },
  ordenar(s) {
    const o = s.jug.slice().sort((a, b) => b.total - a.total || b.palabras - a.palabras);
    o.forEach((j, k) => j.puesto = k > 0 && j.total === o[k - 1].total && j.palabras === o[k - 1].palabras ? o[k - 1].puesto : k + 1);
  },
  /* Reloj: termina la ruleta, escriben los bots, se cierra la ronda. Devuelve true si cambió algo. */
  tick(s) {
    const now = Date.now();
    if (s.fase === "ruleta") {
      if (now < s.hasta) return false;
      Object.assign(s, { fase: "escribir", inicio: now, limite: s.tiempo ? now + s.tiempo * 1000 : 0 });
      Basta.planear(s); s.mov++;
      return true;
    }
    if (s.fase !== "escribir" && s.fase !== "cuenta") return false;
    const tope = Math.min(now, s.fase === "cuenta" ? s.bastaFin : s.limite || Infinity);
    let cambio = false;
    s.jug.forEach((J, i) => {
      if (!J.cpu || !J.plan || i === s.bastaPor) return;
      J.plan.items.forEach(x => { if (!x.hecho && x.t <= tope) { x.hecho = true; J.resp[x.c] = x.w; cambio = true; } });
      if (s.fase === "escribir" && J.plan.basta && J.plan.items.every(x => x.hecho)) { Basta.cantar(s, i); cambio = true; }
    });
    if (s.fase === "cuenta" && now >= s.bastaFin + BA.GRACIA) { Basta.cerrar(s, "basta"); return true; }
    if (s.fase === "escribir" && s.limite && now >= s.limite + BA.GRACIA) { Basta.cerrar(s, "tiempo"); return true; }
    if (cambio) s.mov++;
    return cambio;
  },
  reloj(s, vivo, cambio) {
    clearInterval(Basta.t);
    Basta.t = setInterval(() => { if (!vivo() || s.fase === "fin") { clearInterval(Basta.t); return; } if (Basta.tick(s)) cambio(); }, 200);
  },
  /* Lo que manda cada persona (se valida todo acá) */
  act(s, pid, a) {
    if (!s || !a) return false;
    const i = s.jug.findIndex(j => j.id === pid), J = s.jug[i], now = Date.now();
    if (!J || J.cpu) return false;
    const abierta = (s.fase === "escribir" && (!s.limite || now <= s.limite + BA.GRACIA)) || (s.fase === "cuenta" && now <= s.bastaFin + BA.GRACIA);
    if ((a.t === "resp" || a.t === "basta") && abierta && i !== s.bastaPor && Array.isArray(a.r)) J.resp = s.cats.map((_, c) => Basta.limpia(a.r[c]));
    if (a.t === "resp") return abierta;
    if (a.t === "basta") {
      if (s.fase !== "escribir" || !abierta || J.resp.some(r => !r.trim())) return false;
      Basta.cantar(s, i);
      return true;
    }
    if (s.fase !== "revision") return false;
    if (a.t === "voto") {
      const x = a.i | 0, c = a.c | 0;
      if (!s.jug[x] || c < 0 || c >= s.cats.length || Basta.estado(s.jug[x].resp[c], s.letra) !== "ok") return false;
      const v = s.votos[x + ":" + c] = s.votos[x + ":" + c] || [], k = v.indexOf(pid);
      if (k >= 0) v.splice(k, 1); else v.push(pid);
      s.mov++;
      return true;
    }
    if (a.t === "listo") { J.listo = !J.listo; if (s.jug.every(j => j.cpu || j.listo)) Basta.seguir(s); else s.mov++; return true; }
    if (a.t === "seguir" && pid === s.host) { Basta.seguir(s); return true; }
    return false;
  },

  /* ---------- En este teléfono, contra bots ---------- */
  empezarLocal() {
    const c = Basta.cfg(), u = BD.sesion();
    const jug = [{ id: "p0", name: u ? u.nombre : "Vos", look: u ? u.look : null }, ...Turnero.bots(Math.max(1, Math.min(5, c.bots | 0)), c.nivel)];
    const s = S.extra = Basta.crear(jug, { ...c, host: "p0" });
    s.juego = "basta"; UI.ba = null;
    Basta.reloj(s, () => S.extra === s, () => { if (S.screen === "basta" && S.extra === s) render(); });
    go("basta");
  },

  /* ---------- Online (en el anfitrión) ---------- */
  empezarOn(R) {
    const c = Basta.cfg(), jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name, look: p.id === "H" ? Cuenta.look() : p.look }));
    if (jug.length > 8) return "Basta es de hasta 8 personas.";
    const bots = Math.max(0, Math.min(5, (c.mesa || 0) - jug.length));
    const s = R.ex = Basta.crear([...jug, ...Turnero.bots(bots, c.nivel)], { ...c, host: "H" });
    s.juego = "basta"; R.game = "basta";
    Basta.reloj(s, () => Net.R === R && R.ex === s, () => Net.broadcast());
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") { R.err = Basta.empezarOn(R) || ""; return; }
    if (a.t === "lobby" && pid === "H") { clearInterval(Basta.t); R.game = null; R.ex = null; return; }
    Basta.act(R.ex, pid, a);
  },
  resultado(s, pid) {
    if (!s || s.fase !== "fin") return null;
    const J = s.jug.find(j => j.id === pid); if (!J) return null;
    return { juego: "basta", id: s.id, gano: s.jug.length > 1 && J.puesto === 1, puesto: J.puesto, n: s.jug.length, vsCompu: s.jug.every(j => j === J || j.cpu),
      total: J.total, palabras: J.palabras, unicas: J.unicas, bastas: J.bastas, mejor: J.mejor, rondas: s.rondas };
  },
  view(s, pid) {
    const yo = s.jug.findIndex(j => j.id === pid), now = Date.now(), P = s.fase === "revision" ? Basta.puntuar(s) : null;
    return { game: "basta", id: s.id, me: pid, yo, fase: s.fase, ronda: s.ronda, rondas: s.rondas, letra: s.letra, letras: s.letras.join(""), cats: s.cats.map(c => c.n), host: s.host, motivo: s.motivo,
      quedanRuleta: s.fase === "ruleta" ? Math.max(0, s.hasta - now) : 0, quedanBasta: s.fase === "cuenta" ? Math.max(0, s.bastaFin - now) : 0,
      quedanLimite: s.fase === "escribir" && s.limite ? Math.max(0, s.limite - now) : 0, tiempo: s.tiempo, bastaPor: s.bastaPor, mias: yo >= 0 ? s.jug[yo].resp : null,
      jug: s.jug.map(j => ({ id: j.id, name: j.name, cpu: !!j.cpu, look: j.look, total: j.total, llenas: j.resp.filter(r => r.trim()).length, listo: j.listo, puesto: j.puesto, bastas: j.bastas, palabras: j.palabras })),
      rev: P ? { resp: s.jug.map(j => j.resp), est: P.est, pts: P.pts, ronda: P.ronda,
        votos: Object.fromEntries(Object.entries(s.votos).filter(([, v]) => v.length).map(([k, v]) => [k, { n: v.length, mio: v.includes(pid) }])) } : null,
      hist: s.hist };
  },
  turnoInfo() { return null; },
  lobbyInfo: ["Basta", "✋", "1 a 8"],
  lobby(v, H) {
    const c = v.exCfg.basta, n = (c.cats || []).length + (c.extra ? 1 : 0), bots = Math.max(0, Math.min(5, (c.mesa || 0) - v.players.length));
    return `<p class="summary">Todos escriben a la vez desde su teléfono: sale una letra y hay que completar <b>${n} categorías</b>. El primero que termina canta ¡Basta! y los demás tienen 10 segundos. ${c.rondas} rondas · ${c.tiempo ? `${c.tiempo} s por ronda` : "sin límite de tiempo"}${c.dificiles ? " · con letras difíciles" : ""}.${bots ? ` Se suman ${bots} bot${bots > 1 ? "s" : ""}.` : ""}</p>
      ${H ? Basta.opciones(c) : ""}${Turnero.lobbyBots("basta", c, H)}`;
  },
  opciones(c) {
    const cats = c.cats || [];
    return `<span class="label">Rondas</span><div class="seg">${[3, 5, 7].map(k => `<button aria-pressed="${c.rondas === k}" data-baopc="rondas:${k}">${k}</button>`).join("")}</div>
      <span class="label">Tiempo por ronda</span><div class="seg">${[[0, "Sin"], [60, "60 s"], [90, "90 s"], [120, "2 min"]].map(([k, t]) => `<button aria-pressed="${c.tiempo === k}" data-baopc="tiempo:${k}">${t}</button>`).join("")}</div>
      <div class="opt"><div class="txt"><b>Letras difíciles</b><small>Suma la K, Ñ, Q, W, X e Y al sorteo.</small></div><button class="switch" role="switch" aria-checked="${!!c.dificiles}" data-baopc="dificiles:${c.dificiles ? 0 : 1}" aria-label="Letras difíciles"></button></div>
      <span class="label">Categorías · ${cats.length + (c.extra ? 1 : 0)} (mínimo 4)</span>
      <div class="chips-j ba-chips">${BA.CATS.map(([k, t]) => `<button class="chip-j ${cats.includes(k) ? "on" : ""}" data-bacat="${k}" aria-pressed="${cats.includes(k)}">${cats.includes(k) ? "✓ " : ""}${t}</button>`).join("")}</div>
      <input class="campo" id="baExtra" maxlength="20" placeholder="Sumá una categoría propia (opcional)" value="${esc(c.extra || "")}" autocomplete="off" aria-label="Categoría propia">`;
  },

  /* ---------- Pantalla ---------- */
  render(v, send, opts) {
    const U = UI.ba = UI.ba && UI.ba.id === v.id ? UI.ba : { id: v.id };
    Basta.v = v; Basta.send = send; Basta.opts = opts;
    const grupo = v.fase === "ruleta" ? "r" : v.fase === "escribir" || v.fase === "cuenta" ? "e" : v.fase === "revision" ? "v" : "f", clave = v.ronda + ":" + grupo;
    if (!byId("baRoot") || U.clave !== clave) {
      clearInterval(U.iv); clearTimeout(U.tEnv);
      Object.assign(U, { clave, fin: null, lim: null, cerrado: false, ultimo: null });
      const arma = { r: Basta.armaRuleta, e: Basta.armaEscribir, v: () => `<div id="baRev"></div>`, f: () => `<div id="baFin"></div>` }[grupo];
      app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen ba" id="baRoot">${arma(v)}</section>`;
      if (grupo === "r") Basta.girar(v);
      if (grupo === "e") Basta.conectarEscribir(v);
      if (grupo === "v" && typeof Sonido !== "undefined") Sonido.sfx("papel");
      if (grupo === "f") Basta.fin(v);
    }
    if (grupo === "e") Basta.pintarEscribir(v);
    if (grupo === "v") Basta.revision(v);
  },
  corto: n => esc(String(n).replace(/^🤖\s*/, "🤖 ").slice(0, 12)),
  /* La ruleta de letras: pasan rápido y van frenando hasta la que salió */
  armaRuleta(v) {
    return `<div class="ba-ruleta"><p class="ba-ronda">Ronda ${v.ronda} de ${v.rondas}</p>
      <div class="ba-letra grande" id="baLetra">?</div><p class="sub center" id="baRuTxt">Sorteando la letra…</p>
      <div class="ba-cats-mini">${v.cats.map(c => `<span>${esc(c)}</span>`).join("")}</div></div>`;
  },
  girar(v) {
    const el = byId("baLetra"), txt = byId("baRuTxt"), letras = v.letras.split(""), N = 22;
    const pasos = Array.from({ length: N }, (_, k) => 40 + 230 * Math.pow((k + 1) / N, 2)), suma = pasos.reduce((a, b) => a + b, 0), k0 = Math.max(0, v.quedanRuleta - 250) / suma;
    let k = 0;
    const paso = () => {
      if (!el.isConnected) return;
      if (k >= N || k0 <= 0.05) {
        el.textContent = v.letra; el.classList.add("sale"); txt.innerHTML = `¡Con la <b>${esc(v.letra)}</b>!`;
        if (typeof Sonido !== "undefined") Sonido.sfx("revela");
        return;
      }
      el.textContent = pick(letras.filter(l => l !== el.textContent)); el.classList.toggle("flip");
      if (k % 2 === 0 && typeof Sonido !== "undefined") Sonido.sfx("tic");
      setTimeout(paso, pasos[k++] * k0);
    };
    paso();
  },
  armaEscribir(v) {
    const n = v.cats.length, mira = v.yo < 0;
    return `<div class="ba-top"><div class="ba-letra">${esc(v.letra)}</div><div class="ba-top-txt"><b>Ronda ${v.ronda} de ${v.rondas}</b><small>Todo tiene que empezar con <b>${esc(v.letra)}</b></small></div><div class="ba-reloj" id="baReloj"></div></div>
      <div class="ba-prog" id="baProg"></div>
      ${mira ? `<p class="sub center">Estás mirando esta partida: en la próxima jugás.</p>` : `<form class="ba-form" id="baForm" autocomplete="off" onsubmit="return false">
        ${v.cats.map((c, k) => `<label class="ba-campo" id="baCampo${k}"><span>${esc(c)}</span><input id="baIn${k}" data-bain="${k}" maxlength="${BA.MAX}" autocapitalize="words" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="${k < n - 1 ? "next" : "done"}" placeholder="${esc(v.letra)}…"><i class="ba-marca"></i></label>`).join("")}
      </form>
      <div class="ba-pie"><button class="btn ba-basta" id="baBasta" disabled>✋ ¡BASTA!</button><small id="baFalta"></small></div>`}
      <div class="ba-cuenta" id="baCuenta" hidden></div>`;
  },
  valores: () => [...app.querySelectorAll("[data-bain]")].map(x => x.value),
  conectarEscribir(v) {
    const U = UI.ba, ins = [...app.querySelectorAll("[data-bain]")];
    ins.forEach((inp, k) => {
      inp.value = (v.mias && v.mias[k]) || "";
      inp.oninput = () => { Basta.marcar(); clearTimeout(U.tEnv); U.tEnv = setTimeout(() => Basta.enviar(), Basta.v.fase === "cuenta" ? 200 : 600); };
      inp.onkeydown = e => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const sig = ins.slice(k + 1).find(x => !x.value.trim()) || ins.find(x => !x.value.trim());
        if (sig && sig !== inp) sig.focus(); else { inp.blur(); const b = byId("baBasta"); if (b && !b.disabled) b.focus(); }
      };
    });
    on("baBasta", () => { const b = byId("baBasta"); b.disabled = true; clearTimeout(U.tEnv); Basta.send({ t: "basta", r: Basta.valores() }); });
    if (ins[0] && !v.mias.some(Boolean) && matchMedia("(pointer: fine)").matches) ins[0].focus();
    Basta.marcar();
    U.iv = setInterval(() => Basta.relojEscribir(), 200);
  },
  enviar() { const U = UI.ba; clearTimeout(U.tEnv); if (Basta.v.yo >= 0 && byId("baForm")) Basta.send({ t: "resp", r: Basta.valores() }); },
  /* Tilde o cruz al lado de cada campo y el botón de basta */
  marcar() {
    const v = Basta.v, U = UI.ba, vals = Basta.valores();
    vals.forEach((w, k) => { const c = byId("baCampo" + k); if (c) { const e = w.trim() ? Basta.estado(w, v.letra) : ""; c.classList.toggle("ok", e === "ok"); c.classList.toggle("mal", !!e && e !== "ok"); } });
    const faltan = vals.filter(w => !w.trim()).length, b = byId("baBasta"), f = byId("baFalta");
    if (b) b.disabled = !!faltan || v.fase !== "escribir" || U.cerrado;
    if (f) f.textContent = U.cerrado ? "" : v.fase === "cuenta" ? "¡Rápido, completá lo que puedas!" : faltan ? `Te falta${faltan > 1 ? "n" : ""} ${faltan} para cantar basta` : "¡Listo! Cantá ¡BASTA!";
  },
  bloquear() {
    const U = UI.ba; if (U.cerrado) return;
    U.cerrado = true;
    if (Basta.v.bastaPor !== Basta.v.yo) Basta.enviar();
    app.querySelectorAll("[data-bain]").forEach(x => { x.disabled = true; x.blur(); });
    Basta.marcar();
  },
  pintarEscribir(v) {
    const U = UI.ba, p = byId("baProg"), n = v.cats.length;
    if (p) p.innerHTML = v.jug.map((J, i) => `<span class="ba-pj ${i === v.yo ? "yo" : ""} ${i === v.bastaPor ? "canto" : ""}"><b>${Basta.corto(J.name)}</b><i style="--p:${J.llenas / n}"></i><small>${J.llenas}/${n}</small></span>`).join("");
    if (v.fase === "escribir" && v.quedanLimite && !U.lim) U.lim = performance.now() + v.quedanLimite;
    if (v.fase === "cuenta" && !U.fin) {
      U.fin = performance.now() + v.quedanBasta;
      const quien = v.jug[v.bastaPor], c = byId("baCuenta");
      if (c) { c.hidden = false; c.classList.add("grande"); c.innerHTML = `<b>¡BASTA!</b><span id="baNum">${Math.ceil(v.quedanBasta / 1000)}</span><small>${v.bastaPor === v.yo ? "¡Lo cantaste vos!" : `Lo cantó ${Basta.corto(quien.name)}`}</small>`; setTimeout(() => c.classList.remove("grande"), 1300); }
      if (typeof Sonido !== "undefined") Sonido.sfx("alarma");
      try { navigator.vibrate && navigator.vibrate([200, 80, 200]); } catch {}
      if (v.bastaPor === v.yo) Basta.bloquear();
    }
    Basta.marcar();
  },
  relojEscribir() {
    const U = UI.ba; if (!byId("baRoot") || !U) { clearInterval(U && U.iv); return; }
    const ahora = performance.now(), r = byId("baReloj");
    if (r) {
      if (U.lim && !U.fin) { const s = Math.max(0, Math.ceil((U.lim - ahora) / 1000)); r.textContent = "⏱ " + fmt(s); r.classList.toggle("low", s <= 10); if (s <= 0) { r.textContent = "⏱ ¡Tiempo!"; Basta.bloquear(); } }
      else if (!U.lim && !U.fin) r.textContent = "";
    }
    if (U.fin) {
      const s = Math.max(0, Math.ceil((U.fin - ahora) / 1000)), num = byId("baNum");
      if (num && U.ultimo !== s) { U.ultimo = s; num.textContent = s; if (s > 0 && typeof Sonido !== "undefined") Sonido.sfx("tic"); }
      if (r) r.textContent = "";
      if (s <= 0 && !U.cerrado) {
        Basta.bloquear();
        const c = byId("baCuenta"); if (c) c.innerHTML = `<b>¡Lápices arriba!</b><small>Ahora se revisan las respuestas…</small>`;
        if (typeof Sonido !== "undefined") Sonido.sfx("sello");
      }
    }
  },
  /* Revisión: todas las respuestas por categoría, los puntos y los votos de "no vale" */
  revision(v) {
    const R = v.rev, caja = byId("baRev"); if (!R || !caja) return;
    const jefe = Basta.opts.local || v.isHost, quien = v.jug[v.bastaPor], humanos = v.jug.filter(j => !j.cpu), listos = humanos.filter(j => j.listo).length;
    const ETQ = { vacia: "", invalida: "✗ no vale", letra: `✗ no es con ${esc(v.letra)}`, anulada: "👎 anulada" };
    const orden = v.jug.map((J, i) => ({ J, i, ronda: R.ronda[i], tot: J.total + R.ronda[i] })).sort((a, b) => b.tot - a.tot);
    const yo = v.jug[v.yo];
    caja.innerHTML = `<div class="ba-top"><div class="ba-letra">${esc(v.letra)}</div><div class="ba-top-txt"><b>Ronda ${v.ronda} de ${v.rondas} · Revisión</b><small>${v.motivo === "tiempo" ? "⏱ Se acabó el tiempo" : quien ? `✋ Basta de ${Basta.corto(quien.name)}` : ""}</small></div></div>
      <p class="sub center ba-ayuda">Tocá una respuesta para decir que <b>no vale</b>. Si la mayoría dice que no, vale 0.</p>
      ${v.cats.map((cat, c) => `<div class="ba-cat"><h3>${esc(cat)}</h3><div class="ba-resps">${v.jug.map((J, i) => {
        const e = R.est[i][c], w = R.resp[i][c], p = R.pts[i][c], vo = R.votos[i + ":" + c], toca = (e === "ok" || e === "anulada") && v.yo >= 0;
        return `<button class="ba-r ${e} ${p === 20 ? "solo" : ""} ${vo && vo.mio ? "voto" : ""} ${i === v.yo ? "mia" : ""}" ${toca ? `data-bavoto="${i}:${c}"` : "disabled"}><small>${Basta.corto(J.name)}</small><b>${w.trim() ? esc(w) : "—"}</b><em>${e === "ok" ? `+${p}` : ETQ[e]}</em>${vo ? `<i>👎 ${vo.n}</i>` : ""}</button>`;
      }).join("")}</div></div>`).join("")}
      <div class="panel ba-tot"><span class="label">Puntos</span>${orden.map(({ J, i, ronda, tot }) => `<div class="ba-fila ${i === v.yo ? "yo" : ""}"><b>${Basta.corto(J.name)}${!J.cpu && !Basta.opts.local && J.listo ? " ✓" : ""}</b><span>+${ronda}</span><strong>${tot}</strong></div>`).join("")}</div>
      ${Basta.opts.local ? `<button class="btn" id="baSeguir">${v.ronda >= v.rondas ? "🏁 Ver el resultado final" : "Siguiente ronda ›"}</button>`
        : `${yo ? `<button class="btn ${yo.listo ? "ghost" : ""}" id="baListo">${yo.listo ? "Esperando a los demás…" : "✓ Listo, sigamos"}</button>` : ""}
          ${jefe ? `<button class="btn ghost" id="baSeguir">${v.ronda >= v.rondas ? "Terminar" : "Seguir"} ya (${listos}/${humanos.length} listos)</button>` : `<p class="sub center">${listos}/${humanos.length} listos</p>`}`}`;
    app.querySelectorAll("[data-bavoto]").forEach(b => b.onclick = () => { const [i, c] = b.dataset.bavoto.split(":").map(Number); Basta.send({ t: "voto", i, c }); });
    on("baListo", () => Basta.send({ t: "listo" }));
    on("baSeguir", () => Basta.send({ t: "seguir" }));
  },
  fin(v) {
    const caja = byId("baFin"); if (!caja) return;
    const orden = v.jug.slice().sort((a, b) => a.puesto - b.puesto), yo = v.jug[v.yo];
    const titulo = v.jug.length === 1 ? "🏁 ¡Terminaste!" : yo && yo.puesto === 1 ? "🏆 ¡Ganaste!" : `🎉 ¡Ganó ${esc(orden[0].name.replace(/^🤖\s*/, ""))}!`;
    caja.innerHTML = `<div class="ba-final">${Turnero.tablaFin(v, orden.map(j => ({ puesto: j.puesto, name: j.name, yo: j.id === v.me, txt: `<b class="ba-pts">${j.total}</b> pts · ${j.palabras} palabras${j.bastas ? ` · ✋${j.bastas}` : ""}` })), titulo, "", Basta.send, Basta.opts)}</div>
      <div class="panel"><span class="label">Ronda por ronda</span><div class="ba-hist-c"><table class="ba-hist"><tr><th></th>${v.hist.map(h => `<th>${esc(h.letra)}</th>`).join("")}<th>Total</th></tr>
        ${orden.map(j => { const i = v.jug.indexOf(j); return `<tr class="${j.id === v.me ? "yo" : ""}"><td>${Basta.corto(j.name)}</td>${v.hist.map(h => `<td>${h.pts[i]}</td>`).join("")}<td><b>${j.total}</b></td></tr>`; }).join("")}</table></div></div>`;
    Turnero.conectarFin(Basta.send, Basta.opts);
    if (typeof Sonido !== "undefined") Sonido.sfx(yo && (yo.puesto === 1 || v.jug.length === 1) ? "victoria" : "derrota");
  },
  parar() { if (UI.ba) clearInterval(UI.ba.iv); UI.ba = null; }
};
EXTRA.basta = Basta;

/* Opciones (inicio y sala online): se atienden acá para las dos pantallas */
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-baopc], [data-bacat]");
  if (!b || !app.contains(b)) return;
  const c = Basta.cfg();
  if (b.dataset.baopc) { const [k, val] = b.dataset.baopc.split(":"); c[k] = k === "dificiles" ? val === "1" : +val; }
  else {
    const k = b.dataset.bacat, si = c.cats.includes(k);
    if (si && c.cats.length <= 4) { b.classList.add("no"); setTimeout(() => b.classList.remove("no"), 400); return; }
    c.cats = si ? c.cats.filter(x => x !== k) : [...c.cats, k];
  }
  Basta.guardarCfg();
});
document.addEventListener("change", e => { if (e.target && e.target.id === "baExtra") { Basta.cfg().extra = Basta.extraCfg(e.target.value); Basta.guardarCfg(); } });

PANTALLAS.bastaIntro = () => {
  const c = Basta.cfg();
  app.innerHTML = `${head(0)}<section class="screen ex-intro ex-basta">
    <div class="tb-hero"><span class="ex-arte">${MenuArte.basta()}</span><span class="tb-neon ba-neon">¡BASTA!</span><p class="sub">${Basta.descripcion}</p></div>
    <div class="panel"><span class="label">Contra cuántos bots</span><div class="seg">${[1, 2, 3, 4, 5].map(n => `<button aria-pressed="${c.bots === n}" data-baopc="bots:${n}">${n}</button>`).join("")}</div>
      <span class="label">Qué tan rápido escriben</span><div class="seg">${[["facil", "Lentos"], ["normal", "Normales"], ["dificil", "Rapidísimos"]].map(([k, t]) => `<button aria-pressed="${c.nivel === k}" data-banivel="${k}">${t}</button>`).join("")}</div>
      <small class="sub">Los bots aprenden: cuanto más les ganás, más rápido escriben.</small></div>
    <div class="panel">${Basta.opciones(c)}</div>
    <div class="panel ba-reglas"><span class="label">Puntos por respuesta</span><p class="summary"><b>20</b> si sos el único que puso algo en esa categoría · <b>10</b> si nadie repitió tu palabra · <b>5</b> si alguien puso lo mismo · <b>0</b> si está vacía o no vale.</p></div>
    <button class="btn tb-girar" id="baJugar">✋ ¡A jugar!</button>
    <p class="summary center">¿Cada uno en su teléfono? Creá una sala en "Jugar online" y elegí Basta.</p>
    <button class="btn ghost" id="baAtras">Volver</button></section>`;
  app.querySelectorAll("[data-banivel]").forEach(b => b.onclick = () => { c.nivel = b.dataset.banivel; Basta.guardarCfg(); });
  on("baJugar", () => Basta.empezarLocal());
  on("baAtras", () => go("home"));
};
PANTALLAS.basta = () => {
  const s = S.extra; if (!s || s.juego !== "basta") return go("bastaIntro");
  Basta.render(Basta.view(s, "p0"), a => {
    if (a.t === "again") return Basta.empezarLocal();
    if (a.t === "salir") { clearInterval(Basta.t); Basta.parar(); S.extra = null; return go("bastaIntro"); }
    if (Basta.act(s, "p0", a) && a.t !== "resp") render();
  }, { local: true, isHost: true });
};
