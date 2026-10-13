/* El Impostor: lógica común, modo un teléfono (ImpLocal) y modo online (ImpOn) */
const ROLES = {
  impostor:   { tag: "Impostor",   cls: "imp", side: "imp" },
  civil:      { tag: "Inocente",   cls: "civ", side: "civ" },
  complice:   { tag: "Cómplice",   cls: "spc", side: "imp" },
  infiltrado: { tag: "Infiltrado", cls: "spc", side: "civ" },
  bufon:      { tag: "Bufón",      cls: "spc", side: "bufon" }
};
const SORPRESA = 1 / 7; // probabilidad de cada ronda sorpresa cuando está activada

const Imp = {
  deal(players, cfg, themes) {
    const theme = pick(themes);
    let pool = TEMAS[theme].filter(x => !S.used.includes(x.w));
    if (!pool.length) { S.used = S.used.filter(w => !TEMAS[theme].some(x => x.w === w)); pool = TEMAS[theme]; }
    const secret = pick(pool);
    S.used = [...S.used, secret.w].slice(-200); store.set("used", S.used);
    const other = pick(TEMAS[theme].filter(x => x.w !== secret.w));

    let special = null;
    if (cfg.allImp && Math.random() < SORPRESA) special = "all";
    else if (cfg.noImp && Math.random() < SORPRESA) special = "none";

    const n = players.length;
    let roles;
    if (special === "all") roles = Array(n).fill("impostor");
    else if (special === "none") roles = Array(n).fill("civil");
    else {
      roles = Array(Math.min(cfg.impostors, maxImp(n))).fill("impostor");
      if (cfg.complice) roles.push("complice");
      if (cfg.infiltrado) roles.push("infiltrado");
      if (cfg.bufon) roles.push("bufon");
      while (roles.length < n) roles.push("civil");
      roles = shuffle(roles);
    }
    const g = {
      theme, word: secret.w, hint: secret.h, emoji: secret.e, other: { w: other.w, e: other.e }, special,
      cfg: { ...cfg },
      players: players.map((p, i) => ({ ...p, role: roles[i], out: false })),
      timer: Reloj.nuevo(cfg.minutes), verdict: null, winner: null, ronda: 1
    };
    g.starter = Imp.elegirQuienEmpieza(g);
    return g;
  },

  elegirQuienEmpieza(g) {
    const vivos = g.players.filter(p => !p.out);
    const noImp = vivos.filter(p => p.role !== "impostor");
    return pick(Math.random() < 0.6 && noImp.length ? noImp : vivos).name;
  },

  info(g, i) {
    const p = g.players[i];
    const imps = g.players.filter(x => x.role === "impostor").map(x => x.name);
    return {
      name: p.name, role: p.role, theme: g.theme, hintOn: g.cfg.hint, hint: g.hint,
      word: p.role === "infiltrado" ? g.other.w : g.word,
      emoji: p.role === "infiltrado" ? g.other.e : g.emoji,
      // Con "todos pueden ser impostores" nunca se muestran compañeros, así una ronda sorpresa no se delata.
      companions: g.cfg.allImp ? [] : imps.filter(n => n !== p.name),
      imps: g.special ? [] : imps
    };
  },

  card(f) {
    let art, body, cls;
    if (f.role === "impostor") {
      cls = "imp"; art = personaje("#ff4d63", "imp", 110);
      body = `<div class="tag">Tu rol</div><div class="big">Eres el impostor</div>
        ${f.hintOn ? `<div class="note">Tu pista</div><div class="hint">${esc(f.hint)}</div>` : `<div class="note">Juegas sin pista. Escucha bien a los demás.</div>`}
        <div class="note">Tema: <b>${esc(f.theme)}</b></div>
        ${f.companions.length ? `<div class="note">Tus compañeros impostores: <b>${f.companions.map(esc).join(", ")}</b></div>` : ""}
        <div class="note">Disimula. Si te descubren, puedes adivinar la palabra para salvarte.</div>`;
    } else if (f.role === "complice") {
      cls = "spc"; art = personaje("#b48cff", "complice", 110);
      body = `<div class="tag">Cómplice</div><div class="emo">${f.emoji}</div><div class="big">${esc(f.word)}</div>
        <div class="note">${f.imps.length > 1 ? "Los impostores son" : "El impostor es"} <b>${f.imps.map(esc).join(", ")}</b>. Ayúdale sin que se note: ganas si gana el impostor.</div>`;
    } else if (f.role === "bufon") {
      cls = "spc"; art = personaje("#fcc419", "bufon", 110);
      body = `<div class="tag">Bufón</div><div class="emo">${f.emoji}</div><div class="big">${esc(f.word)}</div>
        <div class="note">Tu misión: actuar sospechoso para que el grupo te expulse. Si te expulsan, ganas tú solo.</div>`;
    } else {
      cls = "civ"; art = personaje(colorDe(f.name), "civ", 110);
      body = `<div class="tag">Inocente</div><div class="emo">${f.emoji}</div><div class="big">${esc(f.word)}</div>
        <div class="note">Tema: <b>${esc(f.theme)}</b>. Da pistas sin decir la palabra y descubre al impostor.</div>`;
    }
    return `<div class="role-card ${cls}"><div class="role-art">${art}</div>${body}</div>`;
  },

  /* Expulsa al jugador i y devuelve el veredicto que se muestra */
  expulsar(g, i) {
    const p = g.players[i];
    p.out = true;
    let kind;
    if (g.special === "all") kind = "all";
    else if (g.special === "none") kind = "none";
    else if (p.role === "bufon") kind = "bufon";
    else if (p.role === "impostor") kind = "imp";
    else kind = "inocente";
    g.verdict = { i, kind };
    return g.verdict;
  },

  verdictHTML(g) {
    const v = g.verdict, p = g.players[v.i], n = esc(p.name);
    const M = {
      all: ["bad", `${n} era impostor…`, "¡y todos lo eran! Era una ronda sorpresa."],
      none: ["bad", `${n} era inocente`, "¡No había ningún impostor! Era una ronda sorpresa."],
      bufon: ["spc", `${n} era el Bufón`, "¡Consiguió que lo expulsaran y gana la partida!"],
      imp: ["good", `¡${n} era impostor!`, `Antes de irse, ${n} puede intentar adivinar la palabra. Si acierta, ganan los impostores.`],
      inocente: ["bad", `${n} era ${p.role === "complice" ? "el Cómplice" : "inocente"}`, "El impostor sigue entre ustedes."]
    }[v.kind];
    const art = personaje(v.kind === "imp" || v.kind === "all" ? "#ff4d63" : colorDe(p.name), v.kind === "imp" || v.kind === "all" ? "imp" : v.kind === "bufon" ? "bufon" : "muerto", 90);
    return `<div class="verdict ${M[0]}">${art}<div class="big">${M[1]}</div><div class="note">${M[2]}</div></div>`;
  },

  /* Tras el veredicto (sin adivinanza acertada): ¿terminó la partida? */
  despues(g) {
    const k = g.verdict.kind;
    if (k === "all") return "all-miss";
    if (k === "none") return "none-miss";
    if (k === "bufon") return "bufon";
    const vivos = g.players.filter(p => !p.out);
    const imps = vivos.filter(p => p.role === "impostor").length;
    const buenos = vivos.filter(p => ROLES[p.role].side !== "imp").length;
    if (imps === 0) return "civ";
    if (imps >= buenos) return "imp";
    return null;
  },

  reclamar(g, kind) { return kind === g.special ? kind + "-hit" : "claim-miss"; },

  siguienteRonda(g) {
    g.verdict = null; g.ronda++;
    g.timer = Reloj.nuevo(g.cfg.minutes);
    g.starter = Imp.elegirQuienEmpieza(g);
  },

  finalHTML(g) {
    const W = {
      civ: ["good", "Ganan los inocentes", "Descubrieron a todos los impostores."],
      imp: ["bad", "Ganan los impostores", "Quedan tantos impostores como inocentes."],
      "imp-guess": ["bad", "Ganan los impostores", "El impostor adivinó la palabra secreta."],
      bufon: ["spc", "Gana el Bufón", "Logró que lo expulsaran."],
      "all-hit": ["good", "¡Bien visto!", "Todos eran impostores y se dieron cuenta. Gana el grupo."],
      "all-miss": ["bad", "Todos eran impostores", "Nadie se dio cuenta de la ronda sorpresa."],
      "none-hit": ["good", "¡Bien visto!", "No había ningún impostor y se dieron cuenta. Gana el grupo."],
      "none-miss": ["bad", "No había impostor", "Se acusaron entre inocentes. Nadie gana."],
      "claim-miss": ["bad", "Ganan los impostores", "Se equivocaron con la ronda sorpresa: sí había impostores normales."]
    }[g.winner];
    const label = p => {
      if (p.role === "impostor") return `<span class="r-imp">Impostor</span>`;
      if (p.role === "civil") return `<span class="r-civ">Inocente</span>`;
      if (p.role === "infiltrado") return `<span class="r-spc">Infiltrado · ${esc(g.other.w)}</span>`;
      return `<span class="r-spc">${ROLES[p.role].tag}</span>`;
    };
    return `${W ? `<div class="verdict ${W[0]}"><div class="big">${W[1]}</div><div class="note">${W[2]}</div></div>` : ""}
    <div class="panel center">
      <span class="label">La palabra era</span>
      <div class="emo">${g.emoji}</div>
      <div class="secret">${esc(g.word)}</div>
      <span class="sub" style="margin:0">Tema: ${esc(g.theme)}${g.cfg.hint && g.special !== "none" ? ` · Pista del impostor: ${esc(g.hint)}` : ""}</span>
      ${g.special ? `<span class="badge">Ronda sorpresa: ${g.special === "all" ? "todos eran impostores" : "no había impostor"}</span>` : ""}
    </div>
    <div class="panel"><span class="label">Roles</span>
      <ul class="reveal-list">${g.players.map(p => `<li>${avatar(p.name, 30, p.role === "impostor" ? "imp" : p.out ? "muerto" : "civ")}<span class="nm">${esc(p.name)}${p.out ? " (expulsado)" : ""}</span>${label(p)}</li>`).join("")}</ul>
    </div>`;
  },

  /* Botones "nadie es impostor" / "todos son impostores", solo si la ronda sorpresa está activada */
  botonesReclamo(cfg) {
    return `${cfg.noImp ? `<button class="btn ghost" data-claim="none">Creemos que no hay impostor</button>` : ""}
      ${cfg.allImp ? `<button class="btn ghost" data-claim="all">Creemos que todos son impostores</button>` : ""}`;
  }
};

/* ================= Modo un teléfono ================= */
const ImpLocal = {
  nueva() {
    S.game = Imp.deal(S.players.map(name => ({ name })), S.cfg, S.themes);
    S.game.idx = 0;
    go("pass");
  }
};

PANTALLAS.pass = () => {
  const g = S.game, p = g.players[g.idx];
  app.innerHTML = `${head(0)}
  <section class="stage passto">
    <span class="counter">Jugador ${g.idx + 1} de ${g.players.length}</span>
    <div class="pass-art">${personaje(colorDe(p.name), "duda", 120)}</div>
    <p class="label" style="margin:0">Pásale el teléfono a</p>
    <div class="who">${esc(p.name)}</div>
    <p class="sub">Que nadie más mire la pantalla.</p>
    <button class="btn" id="see">Soy ${esc(p.name)}, ver mi rol</button>
    <button class="linkish" id="quit">Cancelar partida</button>
  </section>`;
  on("see", () => go("reveal"));
  on("quit", () => go("config"));
};

PANTALLAS.reveal = () => {
  const g = S.game, last = g.idx === g.players.length - 1;
  app.innerHTML = `${head(0)}
  <section class="stage">
    ${Imp.card(Imp.info(g, g.idx))}
    <button class="btn" id="hide">${last ? "Ocultar y empezar" : "Ocultar y pasar"}</button>
  </section>`;
  on("hide", () => { if (last) go("play"); else { g.idx++; go("pass"); } });
};

PANTALLAS.play = () => {
  const g = S.game, t = g.timer, timed = t.total > 0, ms = Reloj.ms(t);
  const vivos = g.players.filter(p => !p.out);
  app.innerHTML = `${head(0)}
  <section class="stage">
    <div class="starter-box">${avatar(g.starter, 64)}<div><p class="label" style="margin:0">Empieza a hablar</p><div class="starter">${esc(g.starter)}</div></div></div>
    <p class="sub">Cada uno dice una palabra relacionada, en orden. Luego debatan y voten.</p>
    <div class="ronda">${vivos.map(p => avatar(p.name, 34)).join("")}</div>
    ${timed ? `${Reloj.html(ms, t.running, t.total)}
    <div class="row"><button class="btn ${t.running ? "ghost" : ""}" id="toggle">${t.running ? "Pausar" : ms === t.total * 1000 ? "Iniciar cronómetro" : ms ? "Seguir" : "Otra vez"}</button>${ms !== t.total * 1000 ? `<button class="btn ghost" id="reset">Reiniciar</button>` : ""}</div>` : ""}
    <button class="btn ${timed ? "ghost" : ""}" id="vote">Votar a quién expulsar</button>
    <button class="linkish" id="end">Revelar todo y terminar</button>
  </section>`;
  on("toggle", () => { if (t.running) Reloj.pause(t); else { Reloj.start(t); keepAwake(); beep(1); } render(); });
  on("reset", () => { Reloj.reset(t); render(); });
  on("vote", () => { Reloj.pause(t); g.pending = null; go("vote"); });
  on("end", () => { g.winner = null; go("end"); });
};

PANTALLAS.vote = () => {
  const g = S.game;
  let extra = "";
  if (g.pending != null) {
    const p = g.players[g.pending];
    extra = `<div class="panel confirm"><b>¿Expulsar a ${esc(p.name)}?</b><div class="row"><button class="btn ghost" id="no">No</button><button class="btn danger" id="yes">Sí, expulsar</button></div></div>`;
  } else if (g.verdict) {
    extra = Imp.verdictHTML(g) + (g.verdict.kind === "imp"
      ? `<div class="row"><button class="btn ghost" id="guessOk">Adivinó la palabra</button><button class="btn" id="cont">No adivinó</button></div>`
      : `<button class="btn" id="cont">Continuar</button>`);
  }
  const libre = !g.verdict && g.pending == null;
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div><h2>¿A quién expulsan?</h2><p class="sub">Voten en voz alta y toquen al más votado.</p></div>
    <ul class="vote">${g.players.map((p, i) => `<li><button data-v="${i}" class="${p.out ? "out" : ""}" ${p.out || !libre ? "disabled" : ""}>${avatar(p.name, 34, p.out ? "muerto" : "civ")}<span>${esc(p.name)}</span></button></li>`).join("")}</ul>
    ${extra}
    ${libre ? `${Imp.botonesReclamo(g.cfg)}<button class="btn ghost" id="back">Volver al debate</button>` : ""}
  </section>`;
  app.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { g.pending = +b.dataset.v; render(); });
  app.querySelectorAll("[data-claim]").forEach(b => b.onclick = () => { g.winner = Imp.reclamar(g, b.dataset.claim); go("end"); });
  on("no", () => { g.pending = null; render(); });
  on("yes", () => { const i = g.pending; g.pending = null; Imp.expulsar(g, i); render(); });
  on("back", () => go("play"));
  on("guessOk", () => { g.winner = "imp-guess"; go("end"); });
  on("cont", () => {
    const w = Imp.despues(g);
    if (w) { g.winner = w; return go("end"); }
    Imp.siguienteRonda(g); go("play");
  });
};

PANTALLAS.end = () => {
  app.innerHTML = `${head(0)}
  <section class="screen">
    ${Imp.finalHTML(S.game)}
    <button class="btn" id="again">Otra ronda, mismos ajustes</button>
    <button class="btn ghost" id="cfg">Cambiar jugadores o temas</button>
  </section>`;
  on("again", () => ImpLocal.nueva());
  on("cfg", () => go("players"));
};

/* ================= Modo online (el anfitrión manda) ================= */
const ImpOn = {
  /* R = sala del anfitrión. Devuelve un mensaje de error o null. */
  empezar(R) {
    const jug = R.players.filter(p => p.on);
    const val = validaImp(jug.length, S.cfg);
    if (!val.ok) return val.msg;
    if (!S.themes.length) return "Elige al menos un tema.";
    R.imp = Imp.deal(jug.map(p => ({ id: p.id, name: p.name })), S.cfg, S.themes);
    Object.assign(R.imp, { phase: "roles", ready: {}, votes: {}, tally: null });
    R.game = "impostor";
    return null;
  },

  act(R, pid, a) {
    const g = R.imp, host = pid === "H";
    const idx = g.players.findIndex(p => p.id === pid);
    switch (a.t) {
      case "ready": g.ready[pid] = true; if (g.phase === "roles" && g.players.every(p => g.ready[p.id] || !Net.conectado(p.id))) g.phase = "play"; break;
      case "toPlay": if (host) g.phase = "play"; break;
      case "timer": if (host) { const t = g.timer; a.cmd === "start" ? (Reloj.start(t)) : a.cmd === "pause" ? Reloj.pause(t) : Reloj.reset(t); } break;
      case "openVote": if (host) { Reloj.pause(g.timer); g.phase = "vote"; g.votes = {}; g.tally = null; } break;
      case "vote": if (g.phase === "vote" && idx >= 0 && !g.players[idx].out && a.target !== pid) g.votes[pid] = a.target; break;
      case "closeVote": if (host && g.phase === "vote") ImpOn.cerrar(g); break;
      case "claim": if (host) { g.winner = Imp.reclamar(g, a.kind); g.phase = "end"; } break;
      case "guess": if (host && g.verdict) { if (a.ok) { g.winner = "imp-guess"; g.phase = "end"; } else ImpOn.seguir(g); } break;
      case "cont": if (host) ImpOn.seguir(g); break;
      case "backPlay": if (host) { g.phase = "play"; g.verdict = null; g.tally = null; } break;
      case "end": if (host) { g.winner = null; g.phase = "end"; } break;
      case "again": if (host) ImpOn.empezar(R); break;
      case "lobby": if (host) { R.game = null; R.imp = null; } break;
    }
  },

  cerrar(g) {
    const cuenta = {};
    Object.values(g.votes).forEach(t => cuenta[t] = (cuenta[t] || 0) + 1);
    const orden = Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
    g.tally = orden.map(([id, n]) => ({ name: g.players.find(p => p.id === id)?.name || "?", n }));
    g.phase = "verdict";
    if (!orden.length || (orden[1] && orden[1][1] === orden[0][1])) { g.verdict = { tie: true }; return; }
    Imp.expulsar(g, g.players.findIndex(p => p.id === orden[0][0]));
  },

  seguir(g) {
    if (g.verdict && g.verdict.tie) { g.verdict = null; g.tally = null; g.phase = "play"; g.timer = Reloj.nuevo(g.cfg.minutes); return; }
    const w = Imp.despues(g);
    if (w) { g.winner = w; g.phase = "end"; return; }
    Imp.siguienteRonda(g); g.tally = null; g.phase = "play";
  },

  view(R, pid) {
    const g = R.imp, i = g.players.findIndex(p => p.id === pid);
    const v = {
      game: "impostor", phase: g.phase, isHost: pid === "H", me: pid, inGame: i >= 0,
      players: g.players.map(p => ({ id: p.id, name: p.name, out: p.out, ready: !!g.ready[p.id], voted: !!g.votes[p.id], on: Net.conectado(p.id) })),
      card: i >= 0 ? Imp.card(Imp.info(g, i)) : null,
      out: i >= 0 && g.players[i].out,
      starter: g.starter, ronda: g.ronda,
      timer: { ms: Reloj.ms(g.timer), running: g.timer.running, total: g.timer.total },
      myVote: g.votes[pid] || null,
      cfg: { noImp: g.cfg.noImp, allImp: g.cfg.allImp },
      tally: g.tally
    };
    if (g.phase === "verdict") v.verdict = g.verdict.tie ? null : Imp.verdictHTML(g), v.tie = !!g.verdict.tie, v.kind = g.verdict.kind;
    if (g.phase === "end") v.final = Imp.finalHTML(g);
    return v;
  },

  render(v) {
    const send = a => Net.send(a);
    const H = v.isHost;
    const espera = txt => `<p class="sub center">${txt}</p>`;
    let body = "";
    if (!v.inGame && v.phase !== "end") body = `<div class="stage">${personaje("#748ffc", "duda", 110)}<h2>Partida en curso</h2>${espera("Entraste a mitad de ronda. Juegas en la próxima.")}</div>`;
    else if (v.phase === "roles") {
      const listos = v.players.filter(p => p.ready).length;
      body = `<div class="stage">
        ${UI.ver ? v.card : `<div class="tapa">${personaje(colorDe(Net.nombre()), "duda", 120)}<p class="sub">Tu rol está listo. Asegúrate de que nadie mire tu pantalla.</p></div>`}
        <button class="btn ${UI.ver ? "ghost" : ""}" id="ver">${UI.ver ? "Ocultar mi rol" : "Ver mi rol"}</button>
        ${v.players.find(p => p.id === v.me)?.ready ? espera(`Listo. Esperando a los demás (${listos} de ${v.players.length}).`) : `<button class="btn" id="listo">Ya lo vi, estoy listo</button>`}
        ${H ? `<button class="linkish" id="toPlay">Empezar sin esperar</button>` : ""}
      </div>`;
    } else if (v.phase === "play") {
      const t = v.timer, timed = t.total > 0;
      body = `<div class="stage">
        <div class="starter-box">${avatar(v.starter, 64)}<div><p class="label" style="margin:0">Empieza a hablar</p><div class="starter">${esc(v.starter)}</div></div></div>
        <p class="sub">Ronda ${v.ronda}. Cada uno dice una palabra relacionada, en orden.</p>
        ${timed ? Reloj.html(t.ms, t.running, t.total) : ""}
        ${H ? `${timed ? `<div class="row"><button class="btn ${t.running ? "ghost" : ""}" id="tg">${t.running ? "Pausar" : t.ms === t.total * 1000 ? "Iniciar cronómetro" : t.ms ? "Seguir" : "Otra vez"}</button>${t.ms !== t.total * 1000 ? `<button class="btn ghost" id="rs">Reiniciar</button>` : ""}</div>` : ""}
          <button class="btn ${timed ? "ghost" : ""}" id="ov">Abrir votación</button><button class="linkish" id="fin">Revelar todo y terminar</button>`
          : espera("El anfitrión maneja el cronómetro y abre la votación.")}
        <button class="linkish" id="ver">${UI.ver ? "Ocultar mi rol" : "Volver a ver mi rol"}</button>
        ${UI.ver ? v.card : ""}
      </div>`;
    } else if (v.phase === "vote") {
      const votaron = v.players.filter(p => p.voted).length, vivos = v.players.filter(p => !p.out).length;
      body = `<div><h2>¿A quién expulsan?</h2><p class="sub">${v.out ? "Estás fuera: mira en silencio." : "Toca a quién quieres expulsar. Puedes cambiar tu voto."} ${votaron} de ${vivos} votaron.</p></div>
        <ul class="vote">${v.players.map(p => `<li><button data-v="${esc(p.id)}" class="${p.out ? "out" : ""} ${v.myVote === p.id ? "sel" : ""}" ${p.out || v.out || p.id === v.me ? "disabled" : ""}>${avatar(p.name, 34, p.out ? "muerto" : "civ")}<span>${esc(p.name)}</span>${p.voted ? `<small class="ok">votó</small>` : ""}</button></li>`).join("")}</ul>
        ${H ? `<button class="btn" id="cv">Cerrar votación</button>${Imp.botonesReclamo(v.cfg)}<button class="btn ghost" id="bp">Volver al debate</button>` : espera("Cuando todos voten, el anfitrión cierra la votación.")}`;
    } else if (v.phase === "verdict") {
      const tally = v.tally && v.tally.length ? `<div class="panel"><span class="label">Votos</span><ul class="reveal-list">${v.tally.map(x => `<li><span class="nm">${esc(x.name)}</span><b>${x.n}</b></li>`).join("")}</ul></div>` : "";
      body = `${v.tie ? `<div class="verdict"><div class="big">Empate</div><div class="note">Nadie es expulsado. Debatan otra vez.</div></div>` : v.verdict}${tally}
        ${H ? (v.kind === "imp" ? `<div class="row"><button class="btn ghost" id="gOk">Adivinó la palabra</button><button class="btn" id="gNo">No adivinó</button></div>` : `<button class="btn" id="ct">Continuar</button>`) : espera("Esperando al anfitrión…")}`;
    } else if (v.phase === "end") {
      body = `${v.final}${H ? `<button class="btn" id="again">Otra ronda</button><button class="btn ghost" id="lobby">Volver a la sala</button>` : espera("El anfitrión puede empezar otra ronda.")}`;
    }
    app.innerHTML = `${Net.cabecera()}<section class="screen">${body}</section>`;
    on("ver", () => { UI.ver = !UI.ver; render(); });
    on("listo", () => { UI.ver = false; send({ t: "ready" }); });
    on("toPlay", () => send({ t: "toPlay" }));
    on("tg", () => { send({ t: "timer", cmd: v.timer.running ? "pause" : "start" }); if (!v.timer.running) beep(1); });
    on("rs", () => send({ t: "timer", cmd: "reset" }));
    on("ov", () => send({ t: "openVote" }));
    on("fin", () => send({ t: "end" }));
    app.querySelectorAll("[data-v]").forEach(b => b.onclick = () => send({ t: "vote", target: b.dataset.v }));
    app.querySelectorAll("[data-claim]").forEach(b => b.onclick = () => send({ t: "claim", kind: b.dataset.claim }));
    on("cv", () => send({ t: "closeVote" }));
    on("bp", () => send({ t: "backPlay" }));
    on("gOk", () => send({ t: "guess", ok: true }));
    on("gNo", () => send({ t: "guess", ok: false }));
    on("ct", () => send({ t: "cont" }));
    on("again", () => send({ t: "again" }));
    on("lobby", () => send({ t: "lobby" }));
  }
};
const UI = { ver: false, sel: [], gate: null, fase: null };
