/* Preguntas Locas: como el Preguntados, pensado para reírse en las juntadas.
   - En tu turno girás la ruleta: sale una categoría y respondés una pregunta con tiempo. Si acertás, seguís girando.
   - Con 3 aciertos seguidos (o si la ruleta cae en la corona) elegís un personaje y jugás por él: si acertás, es tuyo.
   - Gana el primero que junta todos los personajes (o 3 en la partida rápida). Si se terminan las rondas, gana el que tiene más.
   - Comodines (uno de cada uno por partida): 💣 saca dos opciones malas, 🔄 cambia la pregunta, ✌️ da una segunda oportunidad.
   - Prendas (opcionales): cuando alguien se equivoca le toca una prenda graciosa.
   - En un teléfono se van pasando el celular; online cada uno responde desde el suyo y los demás miran. */
const PQ = {
  CATS: [
    { k: "ciencia", nombre: "Ciencia loca", ic: "🧪", color: "#22b8cf", pj: "Doctora Probeta" },
    { k: "mundo", nombre: "Mundo", ic: "🌍", color: "#4c6ef5", pj: "Viajero Mapamundi" },
    { k: "historia", nombre: "Historia", ic: "🏛️", color: "#f59f00", pj: "Don Faraón" },
    { k: "deportes", nombre: "Deportes", ic: "⚽", color: "#40c057", pj: "La Pelota Loca" },
    { k: "tele", nombre: "Tele y música", ic: "🎬", color: "#e64980", pj: "Estrella de la Tele" },
    { k: "locas", nombre: "Absurdas", ic: "🤪", color: "#9c36b5", pj: "El Payaso Sabio" }
  ],
  CORONA: 6, RACHA: 3,
  BIEN: ["¡Bien ahí! 🙌", "¡Genio total! 🧠", "¡Eso lo sabía mi abuela! 👵", "¡Sos un Google con patas! 🤓", "¡Aplausos! 👏", "¡Ni dudó! 😎", "¡Crack! ⭐"],
  MAL: ["Uh… casi 😅", "Ni cerca 🙈", "Google llora 😭", "Bueno, pasa en las mejores familias 🤷", "Te traicionó el cerebro 🫠", "Para la próxima, ¡a estudiar! 📚", "Dale que la próxima sale 💪"],
  TARDE: ["Se te fue el tiempo ⏰", "Pensaste demasiado 🐢", "Te quedaste mirando el techo 🫥"]
};

const Preguntas = {
  clave: "preguntas", nombre: "Preguntas Locas", boton: "❓ ¡A jugar!",
  descripcion: "Como el Preguntados, pero para reírse en la juntada: girá la ruleta, respondé, juntá los personajes y, si te equivocás, cumplí la prenda.",
  cfg() { return Turnero.cfg("preguntas", { meta: 6, prendas: true, tiempo: 25 }); },
  arte() { return MenuArte.preguntas(); },
  opciones(c) {
    return `<span class="label">Para ganar</span><div class="seg">${[[6, "Los 6 personajes"], [3, "Rápida (3)"]].map(([k, t]) => `<button aria-pressed="${c.meta === k}" data-pqm="${k}">${t}</button>`).join("")}</div>
      <span class="label">Tiempo para responder</span><div class="seg">${[[15, "15 s"], [25, "25 s"], [40, "40 s"]].map(([k, t]) => `<button aria-pressed="${c.tiempo === k}" data-pqt="${k}">${t}</button>`).join("")}</div>
      <div class="opt"><div class="txt"><b>Prendas</b><small>El que se equivoca cumple una prenda graciosa (ideal para la juntada).</small></div><button class="switch" role="switch" aria-checked="${!!c.prendas}" id="pqPrendas" aria-label="Prendas"></button></div>`;
  },
  conectarOpciones(c, guardar) {
    app.querySelectorAll("[data-pqm]").forEach(b => b.onclick = () => { c.meta = +b.dataset.pqm; guardar(); });
    app.querySelectorAll("[data-pqt]").forEach(b => b.onclick = () => { c.tiempo = +b.dataset.pqt; guardar(); });
    on("pqPrendas", () => { c.prendas = !c.prendas; guardar(); });
  },
  empezarLocal() { Turnero.empezarLocal(Preguntas); },
  empezarOn(R) { return Turnero.empezarOn(Preguntas, R); },
  actOn(R, pid, a) { Turnero.actOn(Preguntas, R, pid, a); },
  lobby(v, H) {
    const c = v.exCfg.preguntas;
    return `<p class="summary">Por turnos: el que tiene el turno gira la ruleta y responde desde su teléfono; los demás miran (¡y se ríen!). ${c.meta === 3 ? "Partida rápida: gana el primero con 3 personajes." : "Gana el primero con los 6 personajes."} ${c.tiempo} s por pregunta${c.prendas ? " · con prendas" : ""}.${c.mesa > v.players.length ? ` Se suman ${Math.min(6, c.mesa) - v.players.length} bot${Math.min(6, c.mesa) - v.players.length > 1 ? "s" : ""}.` : ""}</p>
      ${H ? `<div class="seg">${[[6, "6 personajes"], [3, "Rápida (3)"]].map(([k, t]) => `<button aria-pressed="${c.meta === k}" data-exopc="preguntas:meta:${k}">${t}</button>`).join("")}</div>
      <div class="seg">${[[15, "15 s"], [25, "25 s"], [40, "40 s"]].map(([k, t]) => `<button aria-pressed="${c.tiempo === k}" data-exopc="preguntas:tiempo:${k}">${t}</button>`).join("")}</div>
      <div class="seg">${[[1, "Con prendas"], [0, "Sin prendas"]].map(([k, t]) => `<button aria-pressed="${!!c.prendas === !!k}" data-exopc="preguntas:prendas:${k}">${t}</button>`).join("")}</div>` : ""}${Turnero.lobbyBots("preguntas", c, H)}`;
  },
  lobbyInfo: ["Preguntas Locas", "❓", "1 a 6"],

  /* ---------- Partida ---------- */
  crear(jug, cfg) {
    const meta = cfg.meta === 3 ? 3 : 6;
    return { id: Turnero.nuevoId("pq"), meta, tiempo: [15, 25, 40].includes(+cfg.tiempo) ? +cfg.tiempo : 25, prendas: !!cfg.prendas, maxTurnos: meta === 6 ? 14 : 8,
      fase: "tiro", paso: "girar", turno: 0, mov: 0, anim: null, nAnim: 0, q: null, usadas: [], limite: null,
      jug: jug.map(j => ({ ...j, pers: [], racha: 0, correctas: 0, erradas: 0, turnos: 0, coronas: 0, com: { bomba: 1, pasar: 1, doble: 1 } })) };
  },
  validar(p) {
    const acc = ["girar", "resp", "elegir", "comodin"].includes(p.acc) ? p.acc : "girar";
    return { acc, i: Math.max(-1, Math.min(5, p.i | 0)), k: ["bomba", "pasar", "doble"].includes(p.k) ? p.k : null };
  },
  /* Una pregunta nueva de la categoría (sin repetir en la partida) */
  pregunta(s, cat) {
    const C = PQ.CATS[cat], lista = PQ_DATOS[C.k];
    let libres = lista.map((_, i) => i).filter(i => !s.usadas.includes(C.k + i));
    if (!libres.length) { s.usadas = s.usadas.filter(u => !u.startsWith(C.k)); libres = lista.map((_, i) => i); }
    const n = pick(libres), [txt, ok, ...resto] = lista[n], dato = resto.length > 3 ? resto[3] : null;
    s.usadas.push(C.k + n);
    const ops = shuffle([ok, resto[0], resto[1], resto[2]]);
    return { cat, n, txt, ops, ok: ops.indexOf(ok), dato, ocultas: [], doble: false, usoDoble: false };
  },
  tirar(s, i, p) {
    const J = s.jug[i];
    if (s.paso === "girar" && p.acc === "girar") {
      // La ruleta: 6 categorías y la corona (la corona sale un poco menos)
      const r = Math.random(), sector = r < 0.1 ? PQ.CORONA : Math.floor(Math.random() * 6);
      s.anim = { n: ++s.nAnim, tipo: "ruleta", sector, dur: 3200 }; s.fase = "anim"; s.sector = sector;
      return;
    }
    if (s.paso === "corona" && p.acc === "elegir" && p.i >= 0 && p.i < 6 && !J.pers.includes(p.i)) {
      s.q = Preguntas.pregunta(s, p.i); s.q.corona = true; s.paso = "preguntar"; s.limite = Date.now() + s.tiempo * 1000;
      return;
    }
    if (s.paso !== "preguntar" || !s.q) return;
    if (p.acc === "comodin" && p.k && J.com[p.k] > 0) {
      J.com[p.k]--;
      if (p.k === "bomba") s.q.ocultas = shuffle([0, 1, 2, 3].filter(x => x !== s.q.ok && !s.q.ocultas.includes(x))).slice(0, 2).concat(s.q.ocultas);
      else if (p.k === "pasar") { const corona = s.q.corona; s.q = Preguntas.pregunta(s, s.q.cat); s.q.corona = corona; s.limite = Date.now() + s.tiempo * 1000; }
      else s.q.doble = true;
      return;
    }
    if (p.acc !== "resp") return;
    const q = s.q, ok = p.i === q.ok;
    // Segunda oportunidad: la primera equivocada no cuenta
    if (!ok && p.i >= 0 && q.doble && !q.usoDoble) { q.usoDoble = true; q.ocultas.push(p.i); return; }
    s.limite = null;
    let gano = null, corona = false;
    if (ok) {
      J.correctas++;
      if (q.corona) { if (!J.pers.includes(q.cat)) { J.pers.push(q.cat); gano = q.cat; } J.racha = 0; }
      else if (++J.racha >= PQ.RACHA) { J.racha = 0; corona = true; }
    } else { J.erradas++; J.racha = 0; }
    const frases = ok ? PQ.BIEN : p.i < 0 ? PQ.TARDE : PQ.MAL;
    s.anim = { n: ++s.nAnim, tipo: "resp", i: p.i, ok: q.ok, acerto: ok, gano, corona, frase: pick(frases), dato: q.dato,
      prenda: !ok && s.prendas ? pick(PQ_PRENDAS) : null, dur: ok ? (gano != null ? 3400 : 2600) : s.prendas ? 6500 : 3400 };
    s.fase = "anim";
  },
  seguir(s) {
    const A = s.anim, J = s.jug[s.turno];
    s.anim = null; s.fase = "tiro";
    if (A.tipo === "ruleta") {
      if (A.sector === PQ.CORONA) { if (J.pers.length >= 6) { s.q = Preguntas.pregunta(s, Math.floor(Math.random() * 6)); s.paso = "preguntar"; s.limite = Date.now() + s.tiempo * 1000; } else s.paso = "corona"; }
      else { s.q = Preguntas.pregunta(s, A.sector); s.paso = "preguntar"; s.limite = Date.now() + s.tiempo * 1000; }
      return;
    }
    s.q = null;
    if (A.acerto) {
      if (J.pers.length >= s.meta) { s.fase = "fin"; Preguntas.ordenar(s); return; }
      s.paso = A.corona ? "corona" : "girar";
      if (A.corona) J.coronas++;
      return;
    }
    // Se equivocó: le toca al siguiente
    J.turnos++;
    if (s.jug.every(j => j.turnos >= s.maxTurnos)) { s.fase = "fin"; Preguntas.ordenar(s); return; }
    s.turno = (s.turno + 1) % s.jug.length; s.paso = "girar";
  },
  vencido(s) { return s.paso === "preguntar" ? { acc: "resp", i: -1 } : { acc: "girar" }; },
  ordenar(s) {
    const o = s.jug.slice().sort((a, b) => b.pers.length - a.pers.length || b.correctas - a.correctas);
    o.forEach((j, k) => j.puesto = k > 0 && j.pers.length === o[k - 1].pers.length && j.correctas === o[k - 1].correctas ? o[k - 1].puesto : k + 1);
  },
  /* ---------- Bots ---------- */
  esperaBot(s) { return s.paso === "preguntar" ? 2600 + Math.random() * 4500 : 1300 + Math.random() * 900; },
  bot(s, i) {
    const J = s.jug[i], h = Turnero.habilidad("preguntas", J.nivel);
    if (s.paso === "girar") return { acc: "girar" };
    if (s.paso === "corona") { const faltan = [0, 1, 2, 3, 4, 5].filter(c => !J.pers.includes(c)); return { acc: "elegir", i: pick(faltan) }; }
    const q = s.q;
    if (q.corona && J.com.bomba && !q.ocultas.length && Math.random() < 0.6) return { acc: "comodin", k: "bomba" };
    const visibles = [0, 1, 2, 3].filter(x => !q.ocultas.includes(x));
    const chance = Math.min(0.95, 0.4 + 0.5 * h + (4 - visibles.length) * 0.12);
    return { acc: "resp", i: Math.random() < chance ? q.ok : pick(visibles.filter(x => x !== q.ok)) };
  },

  resultado(s, pid) {
    if (!s || s.fase !== "fin") return null;
    const J = s.jug.find(j => j.id === pid); if (!J) return null;
    return { juego: "preguntas", id: s.id, gano: s.jug.length > 1 && J.puesto === 1, puesto: J.puesto, n: s.jug.length, vsCompu: s.jug.every(j => j === J || j.cpu), correctas: J.correctas, personajes: J.pers.length, meta: s.meta, coronas: J.coronas };
  },
  view(s, pid) {
    const q = s.q;
    return { game: "preguntas", id: s.id, me: pid, yo: Turnero.idx(s, pid), fase: s.fase, paso: s.paso, turno: s.turno, meta: s.meta, tiempo: s.tiempo, mov: s.mov,
      anim: s.anim, quedan: s.limite ? Math.max(0, s.limite - Date.now()) : null,
      q: q ? { cat: q.cat, n: q.n, txt: q.txt, ops: q.ops, ocultas: q.ocultas, doble: q.doble && !q.usoDoble, corona: !!q.corona } : null,
      jug: s.jug.map(j => ({ id: j.id, name: j.name, cpu: !!j.cpu, look: j.look, pers: j.pers, racha: j.racha, correctas: j.correctas, com: j.com, puesto: j.puesto, turnos: j.turnos })) };
  },
  turnoInfo(v) { return Turnero.turno(v, v.paso === "preguntar" ? "responder" : v.paso === "corona" ? "elegir un personaje" : "girar la ruleta"); },

  /* ---------- Pantalla ---------- */
  miTurno(v) { const J = v.jug[v.turno]; return v.fase !== "fin" && J && J.id === v.me && !J.cpu; },
  render(v, send, opts) {
    const U = UI.pq = UI.pq && UI.pq.id === v.id ? UI.pq : { id: v.id, rot: 0, anim: null, plazo: null, qn: null };
    Preguntas.v = v; Preguntas.send = send; Preguntas.opts = opts;
    if (!byId("pqRoot")) {
      app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen pq" id="pqRoot"><div id="pqTabla"></div><div id="pqCentro"></div><div class="ar-fin" id="pqFin" hidden></div></section>`;
    }
    // Reloj de la pregunta: cada teléfono cuenta desde que le llegó
    const clave = v.q ? `${v.mov}:${v.q.n}:${v.q.cat}` : null;
    if (v.q && v.paso === "preguntar" && v.fase === "tiro" && v.quedan != null && U.qn !== clave) { U.qn = clave; U.plazo = performance.now() + v.quedan; U.total = v.tiempo * 1000; }
    Preguntas.tabla(v);
    const nueva = v.anim && U.anim !== v.anim.n;
    if (nueva) { U.anim = v.anim.n; U.t0 = performance.now(); }
    Preguntas.centro(v, nueva);
    Preguntas.fin(v);
  },
  tabla(v) {
    const t = byId("pqTabla"); if (!t) return;
    t.innerHTML = `<div class="pq-tabla">${v.jug.map((J, k) => `<div class="pq-fila ${k === v.turno && v.fase !== "fin" ? "on" : ""} ${J.id === v.me ? "yo" : ""}">
      <b>${esc(J.name.replace(/^🤖\s*/, "🤖 ").slice(0, 13))}</b>
      <span class="pq-pers">${PQ.CATS.map((C, c) => `<i class="${J.pers.includes(c) ? "si" : ""}" style="--c:${C.color}" title="${esc(C.pj)}">${C.ic}</i>`).join("")}</span>
      <span class="pq-racha">${[0, 1, 2].map(r => `<em class="${r < J.racha ? "si" : ""}"></em>`).join("")}</span></div>`).join("")}</div>`;
  },
  rueda() {
    const n = 7, R = 120, sec = (k) => { const a0 = (k - 0.5) / n * Math.PI * 2 - Math.PI / 2, a1 = (k + 0.5) / n * Math.PI * 2 - Math.PI / 2; return `M0 0 L${Math.cos(a0) * R} ${Math.sin(a0) * R} A${R} ${R} 0 0 1 ${Math.cos(a1) * R} ${Math.sin(a1) * R} Z`; };
    const datos = [...PQ.CATS.map(C => [C.color, C.ic]), ["#ffd43b", "👑"]];
    return `<svg viewBox="-130 -130 260 260" class="pq-rueda-svg" aria-hidden="true"><circle r="128" fill="#1b1729"/><g id="pqRueda" style="transform: rotate(${UI.pq.rot}deg)">
      ${datos.map(([col, ic], k) => { const a = k / n * Math.PI * 2 - Math.PI / 2; return `<path d="${sec(k)}" fill="${col}" stroke="#fff" stroke-width="3"/><text x="${Math.cos(a) * 82}" y="${Math.sin(a) * 82}" font-size="30" text-anchor="middle" dominant-baseline="central">${ic}</text>`; }).join("")}
      <circle r="26" fill="#fff"/><text font-size="26" text-anchor="middle" dominant-baseline="central">❓</text></g>
      <path d="M-13 -134 L13 -134 L0 -106 Z" fill="#fff" stroke="#1b1729" stroke-width="3"/></svg>`;
  },
  centro(v, nueva) {
    const c = byId("pqCentro"); if (!c) return;
    const U = UI.pq, J = v.jug[v.turno], mio = Preguntas.miTurno(v), A = v.anim, nombre = J ? esc(J.name.replace(/^🤖\s*/, "")) : "";
    if (v.fase === "fin") { c.innerHTML = ""; return; }
    // Ruleta (para girar o mientras gira)
    if ((v.paso === "girar" && !A) || (A && A.tipo === "ruleta")) {
      if (!byId("pqRueda")) c.innerHTML = `<div class="pq-girar"><div class="pq-rueda">${Preguntas.rueda()}</div><div id="pqGirarTxt"></div></div>`;
      const txt = byId("pqGirarTxt");
      if (A && A.tipo === "ruleta") {
        if (nueva) {
          const n = 7, final = -(A.sector / n) * 360, base = Math.ceil(U.rot / 360) * 360 + 360 * 5;
          U.rot = base + final + (Math.random() - 0.5) * (360 / n) * 0.6;
          const g = byId("pqRueda"); g.style.transition = "none"; void g.getBoundingClientRect();
          requestAnimationFrame(() => { g.style.transition = `transform ${A.dur - 300}ms cubic-bezier(.12,.72,.18,1)`; g.style.transform = `rotate(${U.rot}deg)`; });
          if (typeof Sonido !== "undefined") Sonido.sfx("tic");
        }
        txt.innerHTML = `<p class="pq-gira">🎡 ¡Gira, gira, gira…!</p>`;
        clearTimeout(U.tCat); U.tCat = setTimeout(() => { const t2 = byId("pqGirarTxt"); if (t2 && Preguntas.v.anim && Preguntas.v.anim.n === A.n) { const C = A.sector === PQ.CORONA ? { nombre: "¡Corona!", ic: "👑", color: "#ffd43b" } : PQ.CATS[A.sector]; t2.innerHTML = `<p class="pq-sale" style="--c:${C.color}">${C.ic} ${esc(C.nombre)}</p>`; } }, A.dur - 250);
      } else txt.innerHTML = mio ? `<button class="btn tb-girar pq-btn" id="pqGirar">🎡 ¡Girar la ruleta!</button><p class="sub center">Turno de <b>${nombre}</b>${J.racha ? ` · racha ${J.racha}/3 para la corona 👑` : ""}</p>` : `<p class="pq-espera">⏳ Gira <b>${nombre}</b>…</p>`;
      on("pqGirar", () => { const b = byId("pqGirar"); if (b) b.disabled = true; Preguntas.send({ t: "tiro", p: { acc: "girar" } }); });
      return;
    }
    // Corona: elegir personaje
    if (v.paso === "corona" && !A) {
      c.innerHTML = `<div class="pq-corona"><div class="pq-corona-ic">👑</div><h2>¡Corona!</h2><p class="sub">${mio ? "Elegí por qué personaje querés jugar: si acertás la pregunta, es tuyo." : `${nombre} está eligiendo un personaje…`}</p>
        <div class="pq-elige">${PQ.CATS.map((C, k) => { const tiene = J.pers.includes(k); return `<button class="pq-pj" style="--c:${C.color}" ${mio && !tiene ? `data-pqpj="${k}"` : "disabled"}><span>${C.ic}</span><b>${esc(C.pj)}</b><small>${tiene ? "✓ ya lo tiene" : esc(C.nombre)}</small></button>`; }).join("")}</div></div>`;
      app.querySelectorAll("[data-pqpj]").forEach(b => b.onclick = () => { app.querySelectorAll("[data-pqpj]").forEach(x => x.disabled = true); Preguntas.send({ t: "tiro", p: { acc: "elegir", i: +b.dataset.pqpj } }); });
      return;
    }
    // Pregunta (y el resultado)
    const q = v.q || U.ultimaQ; if (!q) return;
    U.ultimaQ = q;
    const C = PQ.CATS[q.cat], R = A && A.tipo === "resp" ? A : null;
    const opc = q.ops.map((o, k) => {
      const oculta = q.ocultas.includes(k), cls = R ? (k === R.ok ? "bien" : k === R.i ? "mal" : "apagada") : oculta ? "oculta" : "";
      return `<button class="pq-op ${cls}" ${mio && !R && !oculta ? `data-pqop="${k}"` : "disabled"}><i>${"ABCD"[k]}</i><span>${esc(o)}</span></button>`;
    }).join("");
    const J2 = v.jug[v.turno];
    c.innerHTML = `<div class="pq-preg" style="--c:${C.color}">
      <div class="pq-cat"><span>${C.ic}</span><b>${esc(C.nombre)}</b>${q.corona ? `<em>👑 Por ${esc(C.pj)}</em>` : ""}</div>
      ${!R ? `<div class="pq-tiempo"><i id="pqBarra"></i></div>` : ""}
      <p class="pq-txt">${esc(q.txt)}</p>
      <div class="pq-ops">${opc}</div>
      ${!R && mio ? `<div class="pq-com">${[["bomba", "💣", "Sacar 2"], ["pasar", "🔄", "Cambiar"], ["doble", "✌️", "2 chances"]].map(([k, ic, t]) => `<button class="pq-c" data-pqc="${k}" ${J2.com[k] > 0 && !(k === "doble" && q.doble) ? "" : "disabled"}><span>${ic}</span><small>${t}</small></button>`).join("")}</div>${q.doble ? `<p class="sub center">✌️ Tenés una segunda oportunidad</p>` : ""}`
        : !R ? `<p class="pq-espera">🤔 Responde <b>${esc(J2.name.replace(/^🤖\s*/, ""))}</b>… (¡no le soplen!)</p>` : ""}
      ${R ? `<div class="pq-res ${R.acerto ? "bien" : "mal"}"><b>${esc(R.frase)}</b>${R.gano != null ? `<p class="pq-gano">🏆 ¡Ganó a ${esc(PQ.CATS[R.gano].pj)}! ${PQ.CATS[R.gano].ic}</p>` : R.corona ? `<p class="pq-gano">👑 ¡3 seguidas! Ahora juega por un personaje</p>` : ""}${R.dato ? `<small>💡 ${esc(R.dato)}</small>` : ""}</div>
        ${R.prenda ? `<div class="pq-prenda"><span>🎭 Prenda para ${esc(J2.name.replace(/^🤖\s*/, ""))}</span><b>${esc(R.prenda)}</b></div>` : ""}` : ""}
    </div>`;
    if (R && nueva && typeof Sonido !== "undefined") Sonido.sfx(R.acerto ? "victoria" : "derrota");
    app.querySelectorAll("[data-pqop]").forEach(b => b.onclick = () => { app.querySelectorAll("[data-pqop]").forEach(x => x.disabled = true); b.classList.add("elegida"); Preguntas.send({ t: "tiro", p: { acc: "resp", i: +b.dataset.pqop } }); });
    app.querySelectorAll("[data-pqc]").forEach(b => b.onclick = () => { b.disabled = true; Preguntas.send({ t: "tiro", p: { acc: "comodin", k: b.dataset.pqc } }); });
    // Barra del tiempo
    const barra = byId("pqBarra");
    if (barra && U.plazo) {
      const resta = Math.max(0, U.plazo - performance.now()), frac = Math.min(1, resta / U.total);
      barra.style.transition = "none"; barra.style.width = frac * 100 + "%"; void barra.offsetWidth;
      barra.style.transition = `width ${resta}ms linear`; barra.style.width = "0%";
    }
  },
  fin(v) {
    const fin = byId("pqFin"); if (!fin) return;
    fin.hidden = v.fase !== "fin";
    if (v.fase === "fin" && !fin.dataset.listo) {
      fin.dataset.listo = 1;
      const orden = v.jug.slice().sort((a, b) => a.puesto - b.puesto), yo = v.jug.find(j => j.id === v.me);
      fin.innerHTML = Turnero.tablaFin(v, orden.map(j => ({ puesto: j.puesto, name: j.name, yo: j.id === v.me, txt: `${j.pers.map(c => PQ.CATS[c].ic).join("") || "sin personajes"} · ${j.correctas} ✓` })),
        yo && yo.puesto === 1 && v.jug.length > 1 ? "🏆 ¡Ganaste!" : `🎉 ¡Ganó ${esc(orden[0].name.replace(/^🤖\s*/, ""))}!`, "", Preguntas.send, Preguntas.opts);
      Turnero.conectarFin(Preguntas.send, Preguntas.opts);
      if (typeof Sonido !== "undefined") Sonido.sfx("victoria");
    }
  },
  parar() { UI.pq = null; }
};
EXTRA.preguntas = Preguntas;
PANTALLAS.preguntasIntro = () => Turnero.intro(Preguntas);
PANTALLAS.preguntas = () => Turnero.pantalla(Preguntas);
