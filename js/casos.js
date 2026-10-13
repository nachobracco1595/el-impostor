/* Detectives: casos con pistas repartidas en secreto, debate por actos y un final según a quién arrestan.
   Fases: intro → leer → debate (×3 actos) → acusar → (desempate) → final */
const TIPO_PISTA = { prueba: ["🔍", "Prueba"], testimonio: ["💬", "Testimonio"], documento: ["📄", "Documento"] };

const Casos = {
  caso: id => CASOS.find(c => c.id === id) || CASOS[0],

  /* Referencias a pistas: "pub-A", "priv-A-K", "opt-A-K" (A = acto, K = índice) */
  pista(caso, ref) {
    const [tipo, a, k] = ref.split("-"), acto = caso.actos[+a];
    if (tipo === "pub") return acto.publica;
    if (tipo === "priv") return acto.privadas[+k];
    return acto.opciones[+k].pista;
  },

  setup(players, casoId, cfg) {
    const s = {
      casoId, players: players.map(p => ({ id: p.id, name: p.name })), cfg: { ...cfg },
      soplon: cfg.soplon && players.length >= 4 ? pick(players).id : null,
      acto: 0, phase: "intro", mias: {}, elegidas: [null, null, null], listos: {}, votos: {},
      timer: Reloj.nuevo(cfg.min), acusado: null, tie: [], leerIdx: 0,
      id: "caso-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    };
    s.players.forEach(p => s.mias[p.id] = []);
    return s;
  },

  repartir(s) {
    const n = s.players.length, orden = shuffle(s.players.map(p => p.id));
    Casos.caso(s.casoId).actos[s.acto].privadas.forEach((_, k) => s.mias[orden[k % n]].push(`priv-${s.acto}-${k}`));
    s.listos = {}; s.leerIdx = 0;
    s.timer = Reloj.nuevo(s.cfg.min);
  },

  /* pid === null: modo un teléfono (se confía en quien toca). "H" es el anfitrión online. */
  act(s, pid, a) {
    const jefe = pid === null || pid === "H";
    switch (a.t) {
      case "start": if (jefe && s.phase === "intro") { s.phase = "leer"; Casos.repartir(s); } break;
      case "listo":
        if (s.phase !== "leer" || pid === null) break;
        s.listos[pid] = true;
        if (s.players.every(p => s.listos[p.id] || !Net.conectado(p.id))) s.phase = "debate";
        break;
      case "debate": if (jefe && s.phase === "leer") s.phase = "debate"; break;
      case "timer": if (jefe) { const t = s.timer; a.cmd === "start" ? Reloj.start(t) : a.cmd === "pause" ? Reloj.pause(t) : Reloj.reset(t); } break;
      case "investigar": if (jefe && s.phase === "debate" && s.elegidas[s.acto] === null && (a.k === 0 || a.k === 1)) s.elegidas[s.acto] = a.k; break;
      case "siguiente":
        if (!jefe || s.phase !== "debate" || s.elegidas[s.acto] === null) break;
        Reloj.pause(s.timer);
        if (s.acto < 2) { s.acto++; s.phase = "leer"; Casos.repartir(s); }
        else { s.phase = "acusar"; s.votos = {}; }
        break;
      case "voto": if (s.phase === "acusar" && pid && s.players.some(p => p.id === pid)) s.votos[pid] = a.sid; break;
      case "cerrar": {
        if (!jefe || s.phase !== "acusar") break;
        const cuenta = {};
        Object.values(s.votos).forEach(v => cuenta[v] = (cuenta[v] || 0) + 1);
        const max = Math.max(0, ...Object.values(cuenta));
        const top = Object.keys(cuenta).filter(k => cuenta[k] === max);
        if (top.length === 1) { s.acusado = top[0]; s.phase = "final"; }
        else { s.tie = top.length ? top : Casos.caso(s.casoId).sospechosos.map(x => x.id); s.phase = "desempate"; }
        break;
      }
      case "arrestar": if (jefe && (s.phase === "acusar" || s.phase === "desempate")) { s.acusado = a.sid; s.phase = "final"; } break;
    }
  },

  /* local: en un teléfono no hay voto individual, cuenta el arresto del grupo */
  resultado(s, pid, local) {
    if (!s || s.phase !== "final" || !s.players.some(p => p.id === pid)) return null;
    const caso = Casos.caso(s.casoId);
    return {
      juego: "casos", id: s.id, casoId: s.casoId, dificultad: caso.dificultad,
      resuelto: s.acusado === caso.culpable, soplon: s.soplon === pid,
      votoCorrecto: (local ? s.acusado : s.votos[pid]) === caso.culpable
    };
  },

  view(s, pid) {
    const caso = Casos.caso(s.casoId);
    const publicas = [];
    for (let a = 0; a <= Math.min(s.acto, 2); a++) {
      if (s.phase === "intro") break;
      publicas.push(`pub-${a}`);
      if (s.elegidas[a] !== null) publicas.push(`opt-${a}-${s.elegidas[a]}`);
    }
    const yo = s.players.find(p => p.id === pid);
    const v = {
      game: "casos", casoId: s.casoId, phase: s.phase, acto: s.acto, me: pid, ronda: s.acto,
      players: s.players.map(p => ({ id: p.id, name: p.name, listo: !!s.listos[p.id], voto: !!s.votos[p.id] })),
      publicas, elegida: s.elegidas[s.acto],
      mias: yo ? s.mias[pid] : [],
      soplonOn: !!s.soplon, soySoplon: !!yo && s.soplon === pid,
      timer: { ms: Reloj.ms(s.timer), running: s.timer.running, total: s.timer.total },
      miVoto: s.votos[pid] || null, tie: s.tie
    };
    if (v.soySoplon) v.culpable = caso.culpable;
    if (s.phase === "final") {
      v.acusado = s.acusado;
      v.culpable = caso.culpable;
      v.soplonName = s.soplon ? (s.players.find(p => p.id === s.soplon) || {}).name : null;
      const cuenta = {};
      Object.values(s.votos).forEach(x => cuenta[x] = (cuenta[x] || 0) + 1);
      v.cuenta = cuenta;
    }
    return v;
  },

  /* ---------- Piezas de dibujo ---------- */
  /* "nueva" solo la primera vez que esta pista aparece en este teléfono */
  nueva(ref) {
    UI.vistas = UI.vistas || new Set();
    if (UI.vistas.has(ref)) return "";
    UI.vistas.add(ref);
    return "nueva";
  },
  nota(p, extra = "") {
    const [ic, tx] = TIPO_PISTA[p.t];
    return `<article class="nota t-${p.t} ${extra}"><span class="nota-tipo">${ic} ${tx}</span><h4>${esc(p.titulo)}</h4><p>${esc(p.texto)}</p></article>`;
  },
  polaroid(s, i, extra = "") {
    return `<figure class="polaroid ${extra}" style="--r:${[-3, 2, -1.5, 3][i % 4]}deg">${personaje(s.color, "civ", 84, s.acc)}<figcaption><b>${esc(s.nombre)}</b><small>${esc(s.rol)}</small></figcaption></figure>`;
  },
  ficha(s, i) {
    return `<div class="ficha">${Casos.polaroid(s, i)}<div class="ficha-txt"><p>${esc(s.desc)}</p><p class="motivo"><span>Móvil:</span> ${esc(s.motivo)}</p></div></div>`;
  },
  cabeceraCaso(caso, v) {
    const actos = caso.actos.map((a, i) => `<span class="acto-dot ${i < v.acto || v.phase === "acusar" || v.phase === "final" || v.phase === "desempate" ? "hecho" : i === v.acto && v.phase !== "intro" ? "ahora" : ""}" title="${esc(a.titulo)}"></span>`).join("");
    return `<div class="caso-head"><div class="caso-emo">${caso.emoji}</div><div class="caso-ht"><span class="label">Expediente · ${esc(caso.lugar)}</span><div class="caso-t">${esc(caso.titulo)}</div></div><div class="actos">${actos}</div></div>`;
  },

  render(v, send, opts) {
    const caso = Casos.caso(v.casoId), jefe = opts.local || opts.isHost;
    const acto = caso.actos[Math.min(v.acto, 2)];
    const espera = t => `<p class="sub center">${t}</p>`;
    const sosp = caso.sospechosos;
    let body = "";

    if (v.phase === "intro") {
      body = `<div class="expediente">
          <div class="sello">Confidencial</div>
          <span class="label">${esc(caso.lugar)}</span>
          <h2 class="exp-t">${esc(caso.titulo)}</h2>
          ${caso.intro.map(t => `<p>${esc(t)}</p>`).join("")}
        </div>
        <div class="panel"><span class="label">Los sospechosos</span><div class="fichas">${sosp.map(Casos.ficha).join("")}</div></div>
        ${v.soplonOn ? `<p class="summary">Atención: entre ustedes hay un <b>soplón</b> que sabe quién es el culpable y va a intentar desviar la investigación.</p>` : ""}
        ${jefe ? `<button class="btn" id="cStart">Comenzar la investigación</button>` : espera("El anfitrión abrirá el primer acto cuando todos hayan leído.")}`;
    } else if (v.phase === "leer") {
      if (opts.local && UI.gate !== v.me) {
        body = `${Casos.cabeceraCaso(caso, v)}<div class="stage passto"><span class="counter">Acto ${v.acto + 1}: ${esc(acto.titulo)} · Detective ${opts.idx + 1} de ${v.players.length}</span>
          <div class="pass-art">${personaje(colorDe(opts.nombre), "duda", 110, ["sombrero"])}</div>
          <p class="label" style="margin:0">Pásale el teléfono a</p><div class="who">${esc(opts.nombre)}</div>
          <p class="sub">Va a leer sus pistas secretas de este acto.</p>
          <button class="btn" id="cSoy">Soy ${esc(opts.nombre)}, ver mis pistas</button></div>`;
      } else {
        const nuevas = v.mias.filter(r => r.startsWith(`priv-${v.acto}-`));
        const listo = v.players.find(p => p.id === v.me)?.listo;
        const nListos = v.players.filter(p => p.listo).length;
        body = `${Casos.cabeceraCaso(caso, v)}
          <div><h2>Acto ${v.acto + 1}: ${esc(acto.titulo)}</h2><p class="sub">Tus pistas secretas. Léelas bien: después tendrás que contarlas (o no) en el debate.</p></div>
          ${v.soySoplon && v.acto === 0 ? `<div class="nota soplon"><span class="nota-tipo">🤫 Rol secreto</span><h4>Eres el soplón</h4><p>El culpable es <b>${esc(sosp.find(x => x.id === v.culpable).nombre)}</b>. Ganas si el grupo arresta a otra persona. Desvía la investigación sin que te descubran.</p></div>` : ""}
          <div class="notas">${nuevas.length ? nuevas.map(r => Casos.nota(Casos.pista(caso, r), Casos.nueva("l" + r))).join("") : `<div class="nota vacia"><h4>Sin pistas nuevas</h4><p>Esta vez no te tocó ninguna pista privada. Escucha bien a los demás.</p></div>`}</div>
          ${opts.local ? `<button class="btn" id="cLeido">Listo, ocultar y pasar</button>`
            : listo ? espera(`Esperando a los demás detectives (${nListos} de ${v.players.length}).`) : `<button class="btn" id="cListo">Ya las leí</button>`}
          ${!opts.local && jefe ? `<button class="linkish" id="cDebate">Empezar el debate sin esperar</button>` : ""}`;
      }
    } else if (v.phase === "debate") {
      const t = v.timer, timed = t.total > 0;
      const op = acto.opciones;
      const mias = v.mias;
      body = `${Casos.cabeceraCaso(caso, v)}
        <div><h2>Acto ${v.acto + 1}: ${esc(acto.titulo)}</h2><p class="sub">Cuenten sus pistas, discutan y decidan dónde investigar.</p></div>
        ${timed ? `${Reloj.html(t.ms, t.running, t.total)}${jefe ? `<div class="row"><button class="btn ${t.running ? "ghost" : ""}" id="cTg">${t.running ? "Pausar" : t.ms === t.total * 1000 ? "Iniciar cronómetro" : t.ms ? "Seguir" : "Otra vez"}</button>${t.ms !== t.total * 1000 ? `<button class="btn ghost" id="cRs">Reiniciar</button>` : ""}</div>` : ""}` : ""}
        <div class="corcho"><span class="corcho-t">Pistas en el tablero</span><div class="notas">${v.publicas.slice().reverse().map(r => Casos.nota(Casos.pista(caso, r), Casos.nueva("t" + r))).join("")}</div></div>
        ${v.elegida === null ? `<div class="panel"><span class="label">¿Dónde investigan? Solo pueden elegir un lugar</span>
            ${jefe ? `<div class="row">${op.map((o, k) => `<button class="btn ghost lugar" data-inv="${k}">📍 ${esc(o.lugar)}</button>`).join("")}</div>` : `<ul class="lugares">${op.map(o => `<li>📍 ${esc(o.lugar)}</li>`).join("")}</ul>${espera("Pónganse de acuerdo: el anfitrión elige el lugar.")}`}</div>`
          : `<p class="summary">Investigaron: <b>${esc(op[v.elegida].lugar)}</b>. El otro lugar quedó sin revisar.</p>`}
        ${opts.local
          ? `<div class="panel"><span class="label">Releer pistas secretas</span><div class="chips-j">${v.players.map(p => `<button class="chip-j" data-rel="${esc(p.id)}">${avatar(p.name, 28, "civ", ["sombrero"])}${esc(p.name)}</button>`).join("")}</div>
             ${UI.releer ? `<div class="notas">${(opts.misDe(UI.releer) || []).map(r => Casos.nota(Casos.pista(caso, r))).join("") || `<p class="sub">No tiene pistas secretas.</p>`}</div><button class="linkish" id="cOcultar">Ocultar</button>` : ""}</div>`
          : `<details class="panel" ${UI.verMias ? "open" : ""} id="cMias"><summary class="label">Mis pistas secretas (${mias.length})</summary><div class="notas">${mias.map(r => Casos.nota(Casos.pista(caso, r))).join("") || `<p class="sub">No tienes pistas secretas todavía.</p>`}</div>
             ${v.soySoplon ? `<p class="summary">🤫 Eres el soplón. El culpable es <b>${esc(sosp.find(x => x.id === v.culpable).nombre)}</b>.</p>` : ""}</details>`}
        <details class="panel"><summary class="label">Ver sospechosos</summary><div class="fichas">${sosp.map(Casos.ficha).join("")}</div></details>
        ${jefe ? `<button class="btn" id="cSig" ${v.elegida === null ? "disabled" : ""}>${v.acto < 2 ? `Pasar al acto ${v.acto + 2}` : "Pasar a la acusación"}</button>${v.elegida === null ? `<p class="sub center" style="margin:0">Primero elijan dónde investigar.</p>` : ""}` : espera("El anfitrión pasa al siguiente acto.")}`;
    } else if (v.phase === "acusar" || v.phase === "desempate") {
      const lista = v.phase === "desempate" ? sosp.filter(x => v.tie.includes(x.id)) : sosp;
      const votaron = v.players.filter(p => p.voto).length;
      let pie;
      if (opts.local) pie = UI.arrestar ? `<div class="panel confirm"><b>¿Arrestar a ${esc(sosp.find(x => x.id === UI.arrestar).nombre)}?</b><div class="row"><button class="btn ghost" id="cNo">No</button><button class="btn danger" id="cSi">Sí, arrestar</button></div></div>` : "";
      else if (v.phase === "desempate") pie = jefe ? espera("Hubo empate. Como jefe de la investigación, decides tú.") : espera("Hubo empate. El anfitrión decide a quién arrestar.");
      else pie = `${espera(`${votaron} de ${v.players.length} votaron. Pueden cambiar su voto.`)}${jefe ? `<button class="btn" id="cCerrar">Cerrar la votación</button>` : ""}`;
      body = `${Casos.cabeceraCaso(caso, v)}
        <div><h2>${v.phase === "desempate" ? "Empate: hay que decidir" : "¿A quién arrestan?"}</h2><p class="sub">${opts.local ? "Debatan y toquen al culpable." : "Cada detective vota desde su teléfono."}</p></div>
        <div class="corcho"><span class="corcho-t">Todas las pistas del tablero</span><div class="notas compactas">${v.publicas.map(r => Casos.nota(Casos.pista(caso, r))).join("")}</div></div>
        <div class="acusables">${lista.map((x, i) => `<button class="acusable ${v.miVoto === x.id || UI.arrestar === x.id ? "sel" : ""}" data-acc="${x.id}" ${v.phase === "desempate" && !jefe ? "disabled" : ""}>${Casos.polaroid(x, i)}</button>`).join("")}</div>
        ${pie}`;
    } else if (v.phase === "final") {
      const acusado = sosp.find(x => x.id === v.acusado), culpable = sosp.find(x => x.id === v.culpable);
      const bien = v.acusado === v.culpable;
      body = `<div class="final-caso ${bien ? "bien" : "mal"}">
          <div class="sello-final">${bien ? "Caso resuelto" : "Culpable equivocado"}</div>
          ${Casos.polaroid(acusado, 1, "grande")}
          <span class="label">Arrestaron a ${esc(acusado.nombre)}</span>
          <p class="final-txt">${esc(caso.finales[v.acusado])}</p>
        </div>
        ${bien ? "" : `<div class="panel"><span class="label">Lo que realmente pasó</span><div class="culpable-real">${Casos.polaroid(culpable, 0)}<p><b>${esc(culpable.nombre)}</b> era culpable.</p></div></div>`}
        <div class="expediente chico"><span class="label">La solución</span><p>${esc(caso.solucion)}</p></div>
        ${v.soplonName ? `<div class="verdict ${bien ? "good" : "bad"}"><div class="big">${esc(v.soplonName)} era el soplón</div><div class="note">${bien ? "No logró engañarlos." : "Se salió con la suya: gana el soplón."}</div></div>` : ""}
        ${Object.keys(v.cuenta || {}).length ? `<div class="panel"><span class="label">Votos</span><ul class="reveal-list">${sosp.filter(x => v.cuenta[x.id]).map(x => `<li><span class="nm">${esc(x.nombre)}</span><b>${v.cuenta[x.id]}</b></li>`).join("")}</ul></div>` : ""}
        ${jefe ? `<button class="btn" id="cOtro">Jugar otro caso</button>` : espera("El anfitrión puede elegir otro caso.")}
        ${opts.local ? `<button class="btn ghost" id="cInicio">Inicio</button>` : jefe ? `<button class="btn ghost" id="cSala">Volver a la sala</button>` : ""}`;
    }

    app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen casos">${body}</section>`;
    on("cStart", () => send({ t: "start" }));
    on("cSoy", () => { UI.gate = v.me; render(); });
    on("cLeido", () => send({ t: "leido" }));
    on("cListo", () => send({ t: "listo" }));
    on("cDebate", () => send({ t: "debate" }));
    on("cTg", () => { send({ t: "timer", cmd: v.timer.running ? "pause" : "start" }); if (!v.timer.running) { beep(1); keepAwake(); } });
    on("cRs", () => send({ t: "timer", cmd: "reset" }));
    app.querySelectorAll("[data-inv]").forEach(b => b.onclick = () => send({ t: "investigar", k: +b.dataset.inv }));
    app.querySelectorAll("[data-rel]").forEach(b => b.onclick = () => { UI.releer = UI.releer === b.dataset.rel ? null : b.dataset.rel; render(); });
    on("cOcultar", () => { UI.releer = null; render(); });
    const det = byId("cMias"); if (det) det.ontoggle = () => { UI.verMias = det.open; };
    on("cSig", () => { UI.releer = null; send({ t: "siguiente" }); });
    app.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => {
      if (opts.local) { UI.arrestar = b.dataset.acc; render(); }
      else if (v.phase === "desempate") send({ t: "arrestar", sid: b.dataset.acc });
      else send({ t: "voto", sid: b.dataset.acc });
    });
    on("cNo", () => { UI.arrestar = null; render(); });
    on("cSi", () => { const sid = UI.arrestar; UI.arrestar = null; send({ t: "arrestar", sid }); });
    on("cCerrar", () => send({ t: "cerrar" }));
    on("cOtro", () => send({ t: "otro" }));
    on("cSala", () => send({ t: "lobby" }));
    on("cInicio", () => go("home"));
  },

  /* ---------- Modo un teléfono ---------- */
  empezarLocal(id) {
    S.casoId = id; store.set("casoId", id);
    S.caso = Casos.setup(S.players.map((name, i) => ({ id: "p" + i, name })), id, S.casoCfg);
    Object.assign(UI, { gate: null, releer: null, arrestar: null, vistas: new Set() });
    go("casos");
  },

  /* ---------- Modo online ---------- */
  empezarOn(R) {
    const jug = R.players.filter(p => p.on);
    if (jug.length < 2) return "Hacen falta al menos 2 detectives.";
    R.casos = Casos.setup(jug.map(p => ({ id: p.id, name: p.name })), S.casoId, S.casoCfg);
    R.game = "casos";
    UI.vistas = new Set();
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "otro" && pid === "H") { R.game = null; R.casos = null; return; }
    if (a.t === "lobby" && pid === "H") { R.game = null; R.casos = null; return; }
    Casos.act(R.casos, pid, a);
  }
};

/* Marca el caso como resuelto en este teléfono */
function marcarResuelto(v) {
  if (v.phase === "final" && v.acusado === v.culpable) {
    const r = store.get("resueltos", []);
    if (!r.includes(v.casoId)) store.set("resueltos", [...r, v.casoId]);
  }
}

PANTALLAS.casos = () => {
  const s = S.caso;
  // En "leer" el teléfono pasa por cada detective, uno por uno
  const quien = s.phase === "leer" ? s.players[s.leerIdx] : null;
  const v = Casos.view(s, quien ? quien.id : null);
  marcarResuelto(v);
  Casos.render(v, a => {
    if (a.t === "leido") {
      UI.gate = null;
      s.leerIdx++;
      if (s.leerIdx >= s.players.length) s.phase = "debate";
    } else if (a.t === "otro") return go("casoSel");
    else Casos.act(s, null, a);
    render(); window.scrollTo(0, 0);
  }, { local: true, idx: s.leerIdx, nombre: quien ? quien.name : "", misDe: pid => s.mias[pid] });
};

/* ---------- Elegir caso y ajustes ---------- */
PANTALLAS.casoSel = () => {
  const n = nJug(), c = S.casoCfg, hechos = store.get("resueltos", []);
  const estrellas = d => "🔍".repeat(d) + `<span class="off">${"🔍".repeat(3 - d)}</span>`;
  app.innerHTML = `${head(S.online ? 0 : 2)}
  <section class="screen casos">
    <div><h2>Elige un caso</h2><p class="sub">${n} detective${n === 1 ? "" : "s"}. Cada caso dura unos 20 a 30 minutos.</p></div>
    <div class="casos-lista">${CASOS.map(k => `<button class="caso-card" data-caso="${k.id}" aria-pressed="${S.casoId === k.id}">
      <span class="caso-emo">${k.emoji}</span>
      <span class="caso-info"><b>${esc(k.titulo)}</b><small>${esc(k.teaser)}</small><span class="dif">${estrellas(k.dificultad)}${hechos.includes(k.id) ? `<em>Resuelto</em>` : ""}</span></span>
    </button>`).join("")}</div>
    <div class="panel">
      <span class="label">Tiempo de debate por acto</span>
      <div class="seg">${[0, 3, 5, 8, 10].map(m => `<button aria-pressed="${c.min === m}" data-cmin="${m}">${m ? m + " min" : "Sin"}</button>`).join("")}</div>
      <div class="opt"><div class="txt"><b>Hay un soplón</b><small>${n >= 4 ? "Un jugador sabe quién es el culpable y gana si arrestan a otra persona." : "Necesitan al menos 4 jugadores."}</small></div>
        <button class="switch" role="switch" aria-checked="${!!c.soplon && n >= 4}" id="cSop" aria-label="Hay un soplón" ${n >= 4 ? "" : "disabled"}></button></div>
    </div>
    <div class="row"><button class="btn ghost" id="back">Atrás</button>${S.online ? `<button class="btn" id="sala">Volver a la sala</button>` : `<button class="btn" id="go" ${S.casoId ? "" : "disabled"}>Abrir el expediente</button>`}</div>
  </section>`;
  app.querySelectorAll("[data-caso]").forEach(b => b.onclick = () => { S.casoId = b.dataset.caso; store.set("casoId", S.casoId); render(); });
  app.querySelectorAll("[data-cmin]").forEach(b => b.onclick = () => { c.min = +b.dataset.cmin; store.set("casoCfg", c); render(); });
  on("cSop", () => { c.soplon = !c.soplon; store.set("casoCfg", c); render(); });
  on("back", () => go(S.online ? "online" : "players"));
  on("go", () => Casos.empezarLocal(S.casoId));
  on("sala", () => { Net.cfgCambiada(); go("online"); });
};
