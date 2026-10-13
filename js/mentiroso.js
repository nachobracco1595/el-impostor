/* Mesa del Mentiroso (estilo Liar's Bar): cartas boca abajo, acusaciones y ruleta rusa.
   Reglas:
   - Baraja de Reinas, Reyes, Ases y Comodines. Cada ronda se reparten 5 cartas y se elige la carta de la mesa.
   - En tu turno tiras de 1 a 3 cartas boca abajo diciendo que son de la mesa. El comodín vale como cualquiera.
   - El siguiente puede creerte (y tirar las suyas) o gritar "¡Mentiroso!". Se dan vuelta las cartas:
     si había alguna que no era de la mesa, gatilla el mentiroso; si no, gatilla quien acusó.
   - Cada jugador tiene su propio revólver con 1 bala en 6 recámaras. El último en pie gana. */
const Lie = {
  mazo(n) {
    const J = Math.ceil(n / 2), resto = n * 5 - J, base = Math.floor(resto / 3);
    const cant = { Q: base, K: base, A: base, J };
    ["Q", "K", "A"].slice(0, resto - base * 3).forEach(r => cant[r]++);
    return shuffle(Object.entries(cant).flatMap(([r, c]) => Array(c).fill(r)));
  },

  setup(players) {
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name, alive: true, hand: [], bullet: Math.floor(Math.random() * 6), pulls: 0 })),
      ronda: 0, phase: "turn", table: null, turn: 0, last: null, rev: null, winner: null
    };
    Lie.ronda(s, Math.floor(Math.random() * s.players.length));
    return s;
  },

  ronda(s, start) {
    const vivos = s.players.filter(p => p.alive);
    const mazo = Lie.mazo(vivos.length);
    s.players.forEach(p => p.hand = []);
    vivos.forEach((p, i) => p.hand = mazo.slice(i * 5, i * 5 + 5).sort((a, b) => "QKAJ".indexOf(a) - "QKAJ".indexOf(b)));
    s.table = pick(["Q", "K", "A"]);
    s.turn = s.players[start].alive ? start : Lie.siguiente(s, start, p => p.alive);
    s.last = null; s.rev = null; s.phase = "turn"; s.ronda++;
  },

  siguiente(s, desde, cond) {
    const n = s.players.length;
    for (let k = 1; k <= n; k++) { const i = (desde + k) % n; if (cond(s.players[i], i)) return i; }
    return -1;
  },

  /* ¿El jugador del turno está obligado a acusar? (nadie más tiene cartas, o él no tiene) */
  obligado(s) {
    if (!s.last || s.last.i === s.turn) return false;
    const yo = s.players[s.turn];
    return !yo.hand.length || !s.players.some((p, i) => i !== s.turn && p.alive && p.hand.length);
  },

  /* pid === null: modo un teléfono, se confía en quien toca */
  act(s, pid, a) {
    const yo = s.players[s.turn];
    const esTurno = pid === null || pid === yo.id;
    if (a.t === "play" && s.phase === "turn" && esTurno && !Lie.obligado(s)) {
      const idx = [...new Set(a.cards)].filter(i => i >= 0 && i < yo.hand.length);
      if (idx.length < 1 || idx.length > 3) return;
      const cards = idx.map(i => yo.hand[i]);
      yo.hand = yo.hand.filter((_, i) => !idx.includes(i));
      s.last = { i: s.turn, cards, n: cards.length };
      let sig = Lie.siguiente(s, s.turn, (p, i) => p.alive && p.hand.length && i !== s.turn);
      if (sig < 0) sig = Lie.siguiente(s, s.turn, (p, i) => p.alive && i !== s.turn);
      s.turn = sig;
    } else if (a.t === "call" && s.phase === "turn" && esTurno && s.last && s.last.i !== s.turn) {
      const liar = s.last.cards.some(c => c !== s.table && c !== "J");
      s.rev = { caller: s.turn, accused: s.last.i, cards: s.last.cards, liar, shooter: liar ? s.last.i : s.turn };
      s.phase = "reveal";
    } else if (a.t === "shoot" && s.phase === "reveal") {
      const p = s.players[s.rev.shooter];
      if (pid !== null && pid !== p.id) return;
      s.rev.pullsAntes = p.pulls;
      s.rev.died = p.pulls === p.bullet;
      p.pulls++;
      if (s.rev.died) p.alive = false;
      s.phase = "shot";
    } else if (a.t === "next" && s.phase === "shot") {
      const vivos = s.players.filter(p => p.alive);
      if (vivos.length <= 1) { s.phase = "end"; s.winner = vivos[0] ? vivos[0].name : null; return; }
      Lie.ronda(s, s.rev.shooter);
    }
  },

  view(s, pid) {
    const me = s.players.findIndex(p => p.id === pid);
    const turnP = s.players[s.turn];
    const v = {
      game: "liars", phase: s.phase, me: pid, ronda: s.ronda, table: s.table,
      turnId: turnP ? turnP.id : null, turnName: turnP ? turnP.name : "",
      players: s.players.map(p => ({ id: p.id, name: p.name, alive: p.alive, n: p.hand.length, pulls: p.pulls })),
      hand: me >= 0 ? s.players[me].hand : [],
      last: s.last ? { name: s.players[s.last.i].name, n: s.last.n } : null,
      forced: Lie.obligado(s),
      canCall: !!(s.last && s.last.i !== s.turn),
      winner: s.winner
    };
    if (s.rev) {
      const sh = s.players[s.rev.shooter];
      v.rev = {
        caller: s.players[s.rev.caller].name, accused: s.players[s.rev.accused].name, cards: s.rev.cards, liar: s.rev.liar,
        shooterId: sh.id, shooter: sh.name, pulls: s.phase === "shot" ? s.rev.pullsAntes : sh.pulls, died: s.rev.died
      };
    }
    return v;
  },

  /* opts: { local, isHost } */
  render(v, send, opts) {
    const T = CARTA[v.table];
    const yoTurno = opts.local || v.turnId === v.me;
    const tira = `<div class="mesa-jug">${v.players.map(p => `<div class="mj ${p.id === v.turnId && v.phase === "turn" ? "turno" : ""} ${p.alive ? "" : "muerto"}">
      ${avatar(p.name, 40, p.alive ? "civ" : "muerto")}<span class="mj-n">${esc(p.name)}${p.id === v.me && !opts.local ? " (tú)" : ""}</span>
      <span class="mj-d">${p.alive ? `${p.n} 🂠 · ${p.pulls}/6` : "Fuera"}</span></div>`).join("")}</div>`;
    const banner = `<div class="mesa-banner">${carta(v.table, { cls: "chica" })}<div><span class="label">Ronda ${v.ronda}</span><div class="mesa-t">Mesa de ${T.plural}</div><small class="sub">Los comodines valen como ${T.plural.toLowerCase()}.</small></div></div>`;
    const ultima = v.last ? `<div class="ultima"><div class="pila">${Array(v.last.n).fill(0).map((_, i) => carta(null, { boca: true, attrs: `style="--k:${i}"` })).join("")}</div>
      <p><b>${esc(v.last.name)}</b> tiró ${v.last.n} carta${v.last.n > 1 ? "s" : ""} y dice: «${v.last.n > 1 ? "son" : "es"} ${v.last.n > 1 ? T.plural : T.nombre}».</p></div>` : `<p class="sub center">Nadie tiró cartas todavía en esta ronda.</p>`;
    let body = "";

    if (v.phase === "turn") {
      if (opts.local && UI.gate !== v.turnId) {
        body = `${banner}${tira}${ultima}
          <div class="stage passto"><p class="label" style="margin:0">Pásale el teléfono a</p><div class="who">${esc(v.turnName)}</div>
          <button class="btn" id="soy">Soy ${esc(v.turnName)}, ver mis cartas</button></div>`;
      } else {
        const sel = UI.sel;
        const puedeTirar = yoTurno && !v.forced && v.hand.length;
        body = `${banner}${tira}${ultima}
          <div class="panel mano-panel">
            <span class="label">${yoTurno ? (v.forced ? "Nadie más tiene cartas: tienes que acusar" : "Tus cartas · elige de 1 a 3") : `Turno de ${esc(v.turnName)} · tus cartas`}</span>
            <div class="mano">${v.hand.length ? v.hand.map((c, i) => carta(c, { cls: `${puedeTirar ? "toca" : ""} ${sel.includes(i) ? "sel" : ""}`, attrs: puedeTirar ? `data-c="${i}" role="button" tabindex="0" aria-pressed="${sel.includes(i)}"` : "" })).join("") : `<p class="sub">Te quedaste sin cartas.</p>`}</div>
            ${yoTurno ? `<div class="row">${v.canCall ? `<button class="btn danger" id="call">¡Mentiroso!</button>` : ""}${puedeTirar ? `<button class="btn" id="play" ${sel.length < 1 || sel.length > 3 ? "disabled" : ""}>Tirar ${sel.length || ""} ${sel.length === 1 ? "carta" : "cartas"}</button>` : ""}</div>` : ""}
          </div>`;
      }
    } else if (v.phase === "reveal" || v.phase === "shot") {
      const r = v.rev, puedeGatillar = opts.local || r.shooterId === v.me;
      const chance = 6 - r.pulls;
      body = `${banner}
        <div class="acusa"><b>${esc(r.caller)}</b> acusa a <b>${esc(r.accused)}</b> de mentir</div>
        <div class="pila abierta">${r.cards.map((c, i) => carta(c, { cls: "voltea" + (c === v.table || c === "J" ? "" : " mala"), attrs: `style="--k:${i}"` })).join("")}</div>
        <div class="verdict ${r.liar ? "bad" : "good"}"><div class="big">${r.liar ? "¡Era mentira!" : "¡Decía la verdad!"}</div>
          <div class="note"><b>${esc(r.shooter)}</b> tiene que jugar a la ruleta.</div></div>
        <div class="ruleta ${v.phase === "shot" ? (r.died ? "bang" : "salva") : ""}">
          ${tambor(v.phase === "shot" ? r.pulls + 1 : r.pulls, { girar: v.phase === "shot", size: 130 })}
          ${v.phase === "reveal" ? `<p class="sub center">Recámaras disparadas: ${r.pulls} de 6. Probabilidad de bala: 1 en ${chance}.</p>
            ${puedeGatillar ? `<button class="btn danger" id="shoot">${opts.local ? `${esc(r.shooter)}, gatilla` : "Gatillar"}</button>` : `<p class="sub center">Esperando a que ${esc(r.shooter)} gatille…</p>`}`
          : `<div class="resultado">${r.died ? `<div class="pum">¡BANG!</div>${personaje(colorDe(r.shooter), "muerto", 90)}<p><b>${esc(r.shooter)}</b> quedó fuera de la mesa.</p>` : `<div class="clic">Clic…</div>${personaje(colorDe(r.shooter), "civ", 90)}<p><b>${esc(r.shooter)}</b> se salvó. Por ahora.</p>`}</div>
            ${opts.local || opts.isHost ? `<button class="btn" id="next">Siguiente ronda</button>` : `<p class="sub center">El anfitrión reparte la siguiente ronda.</p>`}`}
        </div>${tira}`;
    } else if (v.phase === "end") {
      body = `<div class="stage">${personaje(colorDe(v.winner || "?"), "complice", 140)}
        <span class="label">Último en pie</span><div class="who">${esc(v.winner || "Nadie")}</div><p class="sub">Gana la Mesa del Mentiroso.</p>
        ${opts.local || opts.isHost ? `<button class="btn" id="again">Jugar otra vez</button>` : `<p class="sub center">El anfitrión puede empezar otra partida.</p>`}
        ${opts.local ? `<button class="btn ghost" id="salir">Inicio</button>` : opts.isHost ? `<button class="btn ghost" id="lobby">Volver a la sala</button>` : ""}</div>`;
    }

    const shotKey = v.phase === "shot" ? `${v.ronda}-${v.rev.shooterId}` : null;
    if (shotKey && UI.sonido !== shotKey) { UI.sonido = shotKey; setTimeout(() => v.rev.died ? bang() : click(), 900); }

    app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen">${body}</section>`;
    on("soy", () => { UI.gate = v.turnId; UI.sel = []; render(); });
    app.querySelectorAll("[data-c]").forEach(el => {
      const tog = () => { const i = +el.dataset.c; UI.sel = UI.sel.includes(i) ? UI.sel.filter(x => x !== i) : UI.sel.length < 3 ? [...UI.sel, i] : UI.sel; render(); };
      el.onclick = tog; el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tog(); } };
    });
    on("play", () => { const c = UI.sel; UI.sel = []; UI.gate = null; send({ t: "play", cards: c }); });
    on("call", () => { UI.sel = []; UI.gate = null; send({ t: "call" }); });
    on("shoot", () => send({ t: "shoot" }));
    on("next", () => send({ t: "next" }));
    on("again", () => send({ t: "again" }));
    on("lobby", () => send({ t: "lobby" }));
    on("salir", () => go("home"));
  },

  /* ---- Modo un teléfono ---- */
  empezarLocal() {
    S.lie = Lie.setup(S.players.map((name, i) => ({ id: "p" + i, name })));
    UI.gate = null; UI.sel = [];
    go("liars");
  },

  /* ---- Modo online ---- */
  empezarOn(R) {
    const jug = R.players.filter(p => p.on);
    if (jug.length < 2) return "Hacen falta al menos 2 jugadores.";
    if (jug.length > 8) return "La mesa admite hasta 8 jugadores.";
    R.lie = Lie.setup(jug.map(p => ({ id: p.id, name: p.name })));
    R.game = "liars";
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") return Lie.empezarOn(R);
    if (a.t === "lobby" && pid === "H") { R.game = null; R.lie = null; return; }
    if (a.t === "next" && pid !== "H") return;
    Lie.act(R.lie, pid, a);
  }
};

PANTALLAS.liars = () => {
  const s = S.lie;
  Lie.render(Lie.view(s, s.players[s.turn]?.id), a => {
    if (a.t === "again") return Lie.empezarLocal();
    Lie.act(s, null, a); render(); window.scrollTo(0, 0);
  }, { local: true });
};
