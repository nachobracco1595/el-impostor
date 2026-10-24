/* Mesa del Mentiroso (estilo Liar's Bar): cartas boca abajo, acusaciones y ruleta rusa.
   Reglas:
   - Baraja de Reinas, Reyes, Ases y Comodines. Cada ronda se reparten 5 cartas y se elige la carta de la mesa.
   - En tu turno tirás de 1 a 3 cartas boca abajo diciendo que son de la mesa. El comodín vale como cualquiera.
   - Mientras esa jugada sea la última de la mesa, CUALQUIERA (no solo el siguiente) puede gritar "¡Mentiroso!".
     Gana el primero que grita. Se dan vuelta las cartas: si había alguna que no era de la mesa, gatilla el mentiroso;
     si no, gatilla quien acusó. El siguiente, si nadie grita, cree y tira las suyas.
   - Cartas especiales (opción, una de cada por ronda):
     😈 Diablo: no vale como carta de la mesa (tirarla es mentir). Si se da vuelta, gatillan TODOS los demás vivos.
     😇 Ángel: vale como comodín. Si se da vuelta, quien la tiró queda protegido (gatilla el que acusó, aunque haya
        mentido con las otras) y además recupera una recámara de su revólver.
   - Cada jugador tiene su propio revólver con 1 bala en 6 recámaras. El último en pie gana. */
const Lie = {
  /* Cuántas cartas de cada una para n jugadores (5 por cabeza). D = Diablo, G = Ángel */
  cuentas(n, esp) {
    const J = Math.ceil(n / 2), E = esp ? 2 : 0, resto = n * 5 - J - E, base = Math.floor(resto / 3);
    const cant = { Q: base, K: base, A: base, J };
    ["Q", "K", "A"].slice(0, resto - base * 3).forEach(r => cant[r]++);
    if (esp) { cant.G = 1; cant.D = 1; }
    return cant;
  },
  mazo(n, esp) { return shuffle(Object.entries(Lie.cuentas(n, esp)).flatMap(([r, c]) => Array(c).fill(r))); },
  /* ¿La carta vale como carta de la mesa? (el Ángel es comodín, el Diablo nunca) */
  vale(c, mesa) { return c === mesa || c === "J" || c === "G"; },
  ORDEN: "QKAJGD",
  ESP: {
    D: { nombre: "Diablo", ic: "😈", esq: "⛧", txt: "No vale como carta de la mesa (tirarla es mentir). Si la dan vuelta, gatillan todos los demás." },
    G: { nombre: "Ángel", ic: "😇", esq: "✦", txt: "Vale como comodín. Si la dan vuelta, quien la tiró se salva (gatilla el que acusó) y recupera una recámara." }
  },

  setup(players, opts = {}) {
    const s = {
      players: players.map(p => ({ id: p.id, name: p.name, cpu: !!p.cpu, alive: true, hand: [], bullet: Math.floor(Math.random() * 6), pulls: 0 })),
      ronda: 0, phase: "turn", table: null, turn: 0, last: null, rev: null, winner: null, winnerId: null, esp: opts.esp !== false, k: 0,
      id: "lie-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), stats: Object.fromEntries(players.map(p => [p.id, { aciertos: 0, clics: 0, diablos: 0, angeles: 0 }]))
    };
    Lie.ronda(s, Math.floor(Math.random() * s.players.length));
    return s;
  },

  ronda(s, start) {
    const vivos = s.players.filter(p => p.alive);
    const mazo = Lie.mazo(vivos.length, s.esp);
    s.players.forEach(p => p.hand = []);
    vivos.forEach((p, i) => p.hand = mazo.slice(i * 5, i * 5 + 5).sort((a, b) => Lie.ORDEN.indexOf(a) - Lie.ORDEN.indexOf(b)));
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

  /* pid === null: modo un teléfono, se confía en quien toca (a.quien dice quién acusa o gatilla) */
  act(s, pid, a) {
    const yo = s.players[s.turn];
    const esTurno = pid === null || pid === yo.id;
    const idx = id => s.players.findIndex(p => p.id === id);
    if (a.t === "play" && s.phase === "turn" && esTurno && !Lie.obligado(s)) {
      const ids = [...new Set(a.cards)].filter(i => i >= 0 && i < yo.hand.length);
      if (ids.length < 1 || ids.length > 3) return;
      const cards = ids.map(i => yo.hand[i]);
      yo.hand = yo.hand.filter((_, i) => !ids.includes(i));
      s.last = { i: s.turn, cards, n: cards.length, k: ++s.k };
      if (!yo.cpu && typeof Mente !== "undefined" && Mente.local()) Mente.anotar("liars", "miente", cards.some(c => !Lie.vale(c, s.table)) ? 1 : 0);
      let sig = Lie.siguiente(s, s.turn, (p, i) => p.alive && p.hand.length && i !== s.turn);
      if (sig < 0) sig = Lie.siguiente(s, s.turn, (p, i) => p.alive && i !== s.turn);
      s.turn = sig;
      s.last.salta = Lie.saltaBot(s);   // algún bot que no es el siguiente puede gritar de arriba
    } else if (a.t === "call" && s.phase === "turn" && s.last) {
      // Cualquiera vivo, menos quien tiró, mientras esa jugada siga siendo la última (ref) de la mesa
      const ci = pid !== null ? idx(pid) : a.quien != null ? idx(a.quien) : s.turn, c = s.players[ci];
      if (!c || !c.alive || ci === s.last.i || (a.ref != null && a.ref !== s.last.k)) return;
      Lie.revelar(s, ci);
    } else if (a.t === "shoot" && s.phase === "reveal") {
      const R = s.rev, pend = R.shooters.filter(i => !R.res[i]);
      const i = pid !== null ? idx(pid) : a.quien != null ? idx(a.quien) : pend[0];
      if (!pend.includes(i)) return;
      const p = s.players[i], died = p.pulls === p.bullet;
      R.res[i] = { antes: p.pulls, died };
      p.pulls++;
      if (died) p.alive = false; else s.stats[p.id].clics++;
      if (R.shooters.every(j => R.res[j])) s.phase = "shot";
    } else if (a.t === "next" && s.phase === "shot") {
      const vivos = s.players.filter(p => p.alive);
      if (vivos.length <= 1) { s.phase = "end"; s.winner = vivos[0] ? vivos[0].name : null; s.winnerId = vivos[0] ? vivos[0].id : null; return; }
      Lie.ronda(s, s.rev.diablo ? s.rev.accused : s.rev.shooters[0]);
    }
  },

  /* Se dan vuelta las cartas de la última jugada: quién gatilla según lo que aparezca */
  revelar(s, ci) {
    const L = s.last, cards = L.cards, diablo = cards.includes("D"), angel = cards.includes("G");
    const liar = cards.some(c => !Lie.vale(c, s.table)), acusado = s.players[L.i];
    let shooters = diablo ? s.players.map((p, i) => i).filter(i => i !== L.i && s.players[i].alive) : [liar && !angel ? L.i : ci];
    let recarga = false;
    if (angel) { s.stats[acusado.id].angeles++; if (acusado.pulls > 0) { acusado.pulls--; recarga = true; } }
    if (diablo) s.stats[acusado.id].diablos++;
    if (liar && !angel || diablo) s.stats[s.players[ci].id].aciertos++;
    s.rev = { caller: ci, accused: L.i, cards, liar, diablo, angel, recarga, fuera: ci !== s.turn, shooters, res: {} };
    s.phase = "reveal";
  },

  resultado(s, pid) {
    if (!s || s.phase !== "end" || !s.stats[pid]) return null;
    return { juego: "liars", id: s.id, gano: s.winnerId === pid, ...s.stats[pid] };
  },

  view(s, pid) {
    const me = s.players.findIndex(p => p.id === pid);
    const turnP = s.players[s.turn];
    const v = {
      game: "liars", phase: s.phase, me: pid, ronda: s.ronda, table: s.table, esp: !!s.esp,
      turnId: turnP ? turnP.id : null, turnName: turnP ? turnP.name : "",
      players: s.players.map(p => ({ id: p.id, name: p.name, cpu: !!p.cpu, alive: p.alive, n: p.hand.length, pulls: p.pulls })),
      hand: me >= 0 ? s.players[me].hand : [],
      last: s.last ? { id: s.players[s.last.i].id, name: s.players[s.last.i].name, n: s.last.n, k: s.last.k } : null,
      forced: Lie.obligado(s),
      canCall: !!(s.last && s.last.i !== s.turn),
      winner: s.winner
    };
    if (s.rev) {
      const R = s.rev;
      const tir = R.shooters.map(i => { const p = s.players[i], x = R.res[i]; return { id: p.id, name: p.name, cpu: p.cpu, hecho: !!x, pulls: x ? x.antes : p.pulls, died: x ? x.died : false }; });
      const sh = tir.find(t => !t.hecho) || tir[0];
      v.rev = {
        caller: s.players[R.caller].name, accused: s.players[R.accused].name, cards: R.cards, liar: R.liar, diablo: R.diablo, angel: R.angel, recarga: R.recarga, fuera: R.fuera,
        tiradores: tir, shooterId: sh.id, shooter: sh.name, pulls: sh.pulls, died: sh.died
      };
    }
    return v;
  },

  /* Cartas especiales con su propio dibujo (las comunes usan el de arte.js) */
  carta(r, opts = {}) {
    const E = Lie.ESP[r];
    if (!E || opts.boca) return carta(r, opts);
    return `<span class="carta lie-esp ${r === "D" ? "diablo" : "angel"} ${opts.cls || ""}" ${opts.attrs || ""}>
    <span class="esq">${E.esq}</span><span class="cen">${E.ic}</span><span class="nom">${E.nombre}</span><span class="esq b">${E.esq}</span></span>`;
  },
  reglas(v) {
    const T = CARTA[v.table] || CARTA.Q;
    return `<details class="panel lie-reglas"><summary><span class="label" style="margin:0">¿Cómo se juega?</span></summary>
      <ul>
        <li>En tu turno tirás de 1 a 3 cartas boca abajo y decís que son de la mesa (${T.plural.toLowerCase()}). El ★ comodín vale siempre.</li>
        <li><b>Cualquiera</b> puede gritar <b>¡Mentiroso!</b> a la última jugada, no solo el siguiente: gana el primero que grita.</li>
        <li>Si había una carta que no era de la mesa, gatilla el que tiró. Si era todo verdad, gatilla el que acusó.</li>
        ${v.esp ? `<li>${Lie.carta("D", { cls: "chica" })} <b>Diablo</b>: ${Lie.ESP.D.txt}</li><li>${Lie.carta("G", { cls: "chica" })} <b>Ángel</b>: ${Lie.ESP.G.txt}</li>` : ""}
        <li>Cada uno tiene su revólver: 1 bala en 6 recámaras. El último en pie gana.</li>
      </ul></details>`;
  },

  /* opts: { local, isHost, gate } */
  render(v, send, opts) {
    const T = CARTA[v.table];
    const turnoBot = !!(v.players.find(p => p.id === v.turnId) || {}).cpu;
    const yoTurno = opts.local ? !turnoBot : v.turnId === v.me;
    const tira = `<div class="mesa-jug">${v.players.map(p => `<div class="mj ${p.id === v.turnId && v.phase === "turn" ? "turno" : ""} ${p.alive ? "" : "muerto"}">
      ${avatar(p.name, 40, p.alive ? "civ" : "muerto")}<span class="mj-n">${esc(p.name)}${p.id === v.me && !opts.local ? " (tú)" : ""}</span>
      <span class="mj-d">${p.alive ? `${p.n} 🂠 · ${p.pulls}/6` : "Fuera"}</span></div>`).join("")}</div>`;
    const banner = `<div class="mesa-banner">${carta(v.table, { cls: "chica" })}<div><span class="label">Ronda ${v.ronda}</span><div class="mesa-t">Mesa de ${T.plural}</div><small class="sub">Los comodines valen como ${T.plural.toLowerCase()}.${v.esp ? " 😇 Ángel también; 😈 Diablo no." : ""}</small></div></div>`;
    // Quiénes pueden gritar ¡Mentiroso! desde esta pantalla sin ser el del turno (el del turno tiene su botón en la mano)
    const L = v.last, acusan = !L || v.phase !== "turn" ? [] : v.players.filter(p => p.alive && p.id !== L.id && p.id !== v.turnId && (opts.local ? !p.cpu : p.id === v.me));
    const ultima = L ? `<div class="ultima ${acusan.length ? "lie-reta" : ""}"><div class="pila">${Array(L.n).fill(0).map((_, i) => carta(null, { boca: true, attrs: `style="--k:${i}"` })).join("")}</div>
      <div class="lie-ult"><p><b>${esc(L.name)}</b> tiró ${L.n} carta${L.n > 1 ? "s" : ""} y dice: «${L.n > 1 ? "son" : "es"} ${L.n > 1 ? T.plural : T.nombre}».${acusan.length ? ` <b>¿Le creés?</b>` : ""}</p>
      ${acusan.length ? `<div class="lie-acusar">${acusan.map(p => `<button class="btn danger" data-acusa="${esc(p.id)}">¡Mentiroso!${acusan.length > 1 || (opts.local && opts.gate) ? ` <small>(${esc(p.name)})</small>` : ""}</button>`).join("")}</div>` : ""}</div></div>`
      : `<p class="sub center">Nadie tiró cartas todavía en esta ronda.</p>`;
    let body = "";

    if (v.phase === "turn") {
      if (opts.local && opts.gate && !turnoBot && UI.gate !== v.turnId) {
        body = `${banner}${tira}${ultima}
          <div class="stage passto"><p class="label" style="margin:0">Pásale el teléfono a</p><div class="who">${esc(v.turnName)}</div>
          <button class="btn" id="soy">Soy ${esc(v.turnName)}, ver mis cartas</button></div>`;
      } else {
        const sel = UI.sel;
        const puedeTirar = yoTurno && !v.forced && v.hand.length;
        body = `${banner}${tira}${ultima}
          <div class="panel mano-panel">
            <span class="label">${yoTurno ? (v.forced ? "Nadie más tiene cartas: tienes que acusar" : "Tus cartas · elige de 1 a 3") : `Turno de ${esc(v.turnName)} · tus cartas`}</span>
            <div class="mano">${v.hand.length ? v.hand.map((c, i) => Lie.carta(c, { cls: `${puedeTirar ? "toca" : ""} ${sel.includes(i) ? "sel" : ""}`, attrs: puedeTirar ? `data-c="${i}" role="button" tabindex="0" aria-pressed="${sel.includes(i)}"` : "" })).join("") : `<p class="sub">Te quedaste sin cartas.</p>`}</div>
            ${yoTurno ? `<div class="row">${v.canCall ? `<button class="btn danger" id="call">¡Mentiroso!</button>` : ""}${puedeTirar ? `<button class="btn" id="play" ${sel.length < 1 || sel.length > 3 ? "disabled" : ""}>Tirar ${sel.length || ""} ${sel.length === 1 ? "carta" : "cartas"}</button>` : ""}</div>` : ""}
          </div>${Lie.reglas(v)}`;
      }
    } else if (v.phase === "reveal" || v.phase === "shot") {
      const r = v.rev, multi = r.tiradores.length > 1, pend = r.tiradores.filter(t => !t.hecho);
      const mios = pend.filter(t => opts.local ? !t.cpu : t.id === v.me), yo = mios[0];
      const boton = yo ? `<button class="btn danger" id="shoot" data-quien="${esc(yo.id)}">${opts.local ? `${esc(yo.name)}, gatillá` : "Gatillar"}</button>` : "";
      const sigue = v.phase === "shot" ? (opts.local || opts.isHost ? `<button class="btn" id="next">Siguiente ronda</button>` : `<p class="sub center">El anfitrión reparte la siguiente ronda.</p>`) : "";
      const titulo = r.diablo ? "¡Era la carta del Diablo!" : r.angel ? "¡Apareció el Ángel!" : r.liar ? "¡Era mentira!" : "¡Decía la verdad!";
      const nota = r.diablo ? `Todos los demás gatillan. <b>${esc(r.accused)}</b> se salva.`
        : r.angel ? `<b>${esc(r.accused)}</b> queda protegido${r.liar ? " (aunque mintió con las otras)" : ""}${r.recarga ? " y recupera una recámara" : ""}. Gatilla <b>${esc(r.caller)}</b>.`
        : `<b>${esc(r.shooter)}</b> tiene que jugar a la ruleta.`;
      let ruleta;
      if (multi) {
        ruleta = `<div class="lie-tiros">${r.tiradores.map(t => `<div class="lie-tiro ${t.hecho ? (t.died ? "bang" : "salva") : ""}">
            ${tambor(t.hecho ? t.pulls + 1 : t.pulls, { girar: t.hecho, size: 56 })}<span class="mj-n">${esc(t.name)}</span>
            <span class="mj-d">${t.hecho ? (t.died ? "¡BANG! Fuera" : "Clic… se salvó") : `1 en ${6 - t.pulls}`}</span></div>`).join("")}</div>
          ${v.phase === "reveal" ? (boton || `<p class="sub center">Esperando a que gatillen: ${pend.map(t => esc(t.name)).join(", ")}…</p>`) : sigue}`;
      } else {
        const t = r.tiradores[0], chance = 6 - t.pulls;
        ruleta = `<div class="ruleta ${v.phase === "shot" ? (t.died ? "bang" : "salva") : ""}">
          ${tambor(v.phase === "shot" ? t.pulls + 1 : t.pulls, { girar: v.phase === "shot", size: 130 })}
          ${v.phase === "reveal" ? `<p class="sub center">Recámaras disparadas: ${t.pulls} de 6. Probabilidad de bala: 1 en ${chance}.</p>
            ${boton || `<p class="sub center">Esperando a que ${esc(t.name)} gatille…</p>`}`
          : `<div class="resultado">${t.died ? `<div class="pum">¡BANG!</div>${personaje(colorDe(t.name), "muerto", 90)}<p><b>${esc(t.name)}</b> quedó fuera de la mesa.</p>` : `<div class="clic">Clic…</div>${personaje(colorDe(t.name), "civ", 90)}<p><b>${esc(t.name)}</b> se salvó. Por ahora.</p>`}</div>
            ${sigue}`}
        </div>`;
      }
      body = `${banner}
        <div class="acusa"><b>${esc(r.caller)}</b> acusa a <b>${esc(r.accused)}</b> de mentir${r.fuera ? `<small class="sub lie-fuera">¡Se metió sin ser su turno!</small>` : ""}</div>
        <div class="pila abierta">${r.cards.map((c, i) => Lie.carta(c, { cls: "voltea" + (Lie.vale(c, v.table) ? "" : " mala"), attrs: `style="--k:${i}"` })).join("")}</div>
        <div class="verdict ${r.diablo ? "lie-diablo" : r.angel ? "lie-angel" : r.liar ? "bad" : "good"}"><div class="big">${titulo}</div>
          <div class="note">${nota}</div></div>
        ${multi ? `<div class="ruleta">${ruleta}</div>` : ruleta}${tira}`;
    } else if (v.phase === "end") {
      body = `<div class="stage">${personaje(colorDe(v.winner || "?"), "complice", 140)}
        <span class="label">Último en pie</span><div class="who">${esc(v.winner || "Nadie")}</div><p class="sub">Gana la Mesa del Mentiroso.</p>
        ${opts.local || opts.isHost ? `<button class="btn" id="again">Jugar otra vez</button>` : `<p class="sub center">El anfitrión puede empezar otra partida.</p>`}
        ${opts.local ? `<button class="btn ghost" id="salir">Inicio</button>` : opts.isHost ? `<button class="btn ghost" id="lobby">Volver a la sala</button>` : ""}</div>`;
    }

    // Un sonido por cada gatillazo nuevo
    if (v.rev) {
      UI.lieSon = UI.lieSon || {};
      v.rev.tiradores.filter(t => t.hecho).forEach(t => { const k = `${v.ronda}-${t.id}-${t.pulls}`; if (!UI.lieSon[k]) { UI.lieSon[k] = 1; setTimeout(() => t.died ? bang() : click(), 900); } });
    }

    app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen">${body}</section>`;
    on("soy", () => { UI.gate = v.turnId; UI.sel = []; render(); });
    app.querySelectorAll("[data-c]").forEach(el => {
      const tog = () => { const i = +el.dataset.c; UI.sel = UI.sel.includes(i) ? UI.sel.filter(x => x !== i) : UI.sel.length < 3 ? [...UI.sel, i] : UI.sel; render(); };
      el.onclick = tog; el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tog(); } };
    });
    on("play", () => { const c = UI.sel; UI.sel = []; UI.gate = null; send({ t: "play", cards: c }); });
    on("call", () => { UI.sel = []; UI.gate = null; send({ t: "call", ref: L ? L.k : null }); });
    app.querySelectorAll("[data-acusa]").forEach(b => b.onclick = () => { UI.sel = []; UI.gate = null; send({ t: "call", quien: b.dataset.acusa, ref: L.k }); });
    on("shoot", () => send({ t: "shoot", quien: byId("shoot").dataset.quien }));
    on("next", () => send({ t: "next" }));
    on("again", () => send({ t: "again" }));
    on("lobby", () => send({ t: "lobby" }));
    on("salir", () => go("home"));
  },

  /* ---- Bots ---- */
  /* Chance de que lo último que se tiró sea verdad, con lo que el bot sabe (su mano y cuántas cartas hay de cada una) */
  creible(s, i) {
    const yo = s.players[i], vivos = s.players.filter(p => p.alive).length, cant = Lie.cuentas(vivos, s.esp);
    const buenas = cant[s.table] + cant.J + (cant.G || 0);           // de la mesa + comodines + ángel en el mazo
    const misBuenas = yo.hand.filter(c => Lie.vale(c, s.table)).length;
    let quedan = buenas - misBuenas, pool = vivos * 5 - yo.hand.length, p = 1;
    for (let k = 0; k < s.last.n; k++) { p *= Math.max(0, quedan - k) / Math.max(1, pool - k); }
    return p;
  },
  /* ¿El bot i grita ¡Mentiroso! a la última jugada? salta: no es su turno (se mete solo si está muy seguro) */
  quiereAcusar(s, i, salta) {
    const yo = s.players[i];
    // La mayoría dice la verdad si puede: se desconfía cuando es casi imposible que tenga tantas buenas
    // Con más nivel recuerdan cuánto mentís vos y desconfían en proporción; los flojos tiran "¡mentira!" más al azar
    const h = typeof Mente !== "undefined" ? Mente.habilidad("liars") : 0.5, quien = s.players[s.last.i];
    let p = Lie.creible(s, i), n = s.last.n, sospecha = n === 3 ? 0.35 : n === 2 ? 0.2 : 0.08;
    if (!quien.cpu && typeof Mente !== "undefined") { const miente = Mente.costumbre("liars", "miente", 0.2); p = Math.max(0, Math.min(1, p * (1 + h * ((1 - miente) / 0.8 - 1)))); }
    // Si el Diablo anda suelto (no lo tiene él), acusar es más peligroso
    if (s.esp && !yo.hand.includes("D")) sospecha *= 0.85;
    if (salta) return p < sospecha * 0.6 * (0.8 + 0.5 * h) || Math.random() < 0.03;
    return p < sospecha * (0.8 + 0.5 * h) || Math.random() < 0.09 * (1 - h) + 0.02 || !yo.hand.length;
  },
  /* Al tirar: algún bot que no es el siguiente puede decidir gritar desde afuera (-1 si ninguno) */
  saltaBot(s) {
    const cand = shuffle(s.players.map((p, i) => i).filter(i => i !== s.last.i && i !== s.turn && s.players[i].alive && s.players[i].cpu));
    return cand.find(i => Lie.quiereAcusar(s, i, true)) ?? -1;
  },
  decidirBot(s) {
    const i = s.turn, yo = s.players[i];
    if (s.phase === "reveal") { const t = s.rev.shooters.find(j => !s.rev.res[j] && s.players[j].cpu); return t != null ? { t: "shoot", quien: s.players[t].id } : null; }
    if (s.phase !== "turn" || !yo || !yo.cpu) return null;
    if (Lie.obligado(s)) return { t: "call" };
    if (s.last && s.last.i !== i && Lie.quiereAcusar(s, i, false)) return { t: "call" };
    const cartas = yo.hand.map((c, k) => [c, k]), iD = yo.hand.indexOf("D"), iG = yo.hand.indexOf("G");
    const buenas = cartas.filter(([c]) => c === s.table || c === "J").sort((a, b) => (a[0] === "J") - (b[0] === "J"));
    const malas = cartas.filter(([c]) => !Lie.vale(c, s.table) && c !== "D");
    // Diablo: un farol que conviene que te descubran (a veces escondido con una buena para que parezca verdad)
    if (iD >= 0 && (Math.random() < 0.3 + (yo.hand.length <= 2 ? 0.4 : 0) || yo.hand.length === 1)) return { t: "play", cards: buenas.length && Math.random() < 0.5 ? [iD, buenas[0][1]] : [iD] };
    // Ángel: carta segura, sirve para tapar una mentira
    if (iG >= 0 && malas.length && Math.random() < 0.55) return { t: "play", cards: [iG, ...malas.slice(0, Math.random() < 0.4 ? 2 : 1).map(x => x[1])] };
    if (iG >= 0) buenas.push(["G", iG]);
    // Verdad: 1 o 2 de las buenas (los comodines al final). Mentira: 1 mala (o a veces se mezcla).
    // Los buenos mienten más cuando les quedan pocas cartas (si no, se quedan sin poder jugar)
    const hb = typeof Mente !== "undefined" ? Mente.habilidad("liars") : 0.5, mentir = 0.12 + (yo.hand.length <= 2 ? 0.15 * hb : 0);
    if (buenas.length && (Math.random() > mentir || !malas.length)) return { t: "play", cards: buenas.slice(0, Math.min(buenas.length, Math.random() < 0.5 ? 1 : 2)).map(x => x[1]) };
    if (malas.length) return { t: "play", cards: Math.random() < 0.25 && buenas.length ? [malas[0][1], buenas[0][1]] : [malas[0][1]] };
    return { t: "play", cards: [0] };
  },
  jugarBot(s, conPid) {
    const a = Lie.decidirBot(s); if (!a) return false;
    const quien = a.quien || s.players[s.turn].id;
    Lie.act(s, conPid ? quien : null, a);
    return true;
  },
  hayBot(s) { return s.phase === "turn" ? !!(s.players[s.turn] || {}).cpu : s.phase === "reveal" ? s.rev.shooters.some(i => !s.rev.res[i] && s.players[i].cpu) : false; },
  /* Cuánto piensa el bot: si hay personas que podrían acusar la última jugada, se espera un poco más para darles tiempo */
  demora(s) {
    if (s.phase === "reveal") return Object.keys(s.rev.res).length ? 900 : 1600;
    const L = s.last, gente = L && s.players.some((p, i) => !p.cpu && p.alive && i !== L.i && i !== s.turn);
    return 1200 + Math.random() * 900 + (gente ? 1100 : 0);
  },
  /* Programa lo que hacen los bots (el del turno o los que gatillan, y el que grita de arriba). vivo(): sigue la partida; hacer(a): aplica la acción */
  programar(s, vivo, hacer) {
    if (Lie.hayBot(s)) {
      const k = s.id + s.ronda + s.phase + s.turn + (s.last ? s.last.k : "") + (s.rev ? Object.keys(s.rev.res).length : "");
      if (Lie.tBot !== k) { Lie.tBot = k; setTimeout(() => { if (!vivo() || Lie.tBot !== k) return; Lie.tBot = null; const a = Lie.decidirBot(s); if (a) hacer(a); }, Lie.demora(s)); }
    }
    const L = s.last;
    if (s.phase === "turn" && L && L.salta >= 0 && Lie.tSalta !== s.id + L.k) {
      Lie.tSalta = s.id + L.k;
      setTimeout(() => { if (!vivo() || s.phase !== "turn" || s.last !== L || !s.players[L.salta].alive) return; hacer({ t: "call", quien: s.players[L.salta].id, ref: L.k }); }, 2600 + Math.random() * 1400);
    }
  },
  tBot: null, tSalta: null,

  /* ---- Modo un teléfono ---- */
  empezarLocal() {
    const bots = CPU_NOMBRES.concat(["🤖 Cacho", "🤖 Coca"]).slice(0, S.lieCfg.bots).map((name, i) => ({ id: "b" + i, name, cpu: true }));
    S.lie = Lie.setup([...S.players.map((name, i) => ({ id: "p" + i, name })), ...bots], { esp: S.lieCfg.esp !== false });
    UI.gate = null; UI.sel = [];
    go("liars");
  },

  /* ---- Modo online ---- */
  empezarOn(R) {
    const jug = R.players.filter(p => p.on);
    if (jug.length > 8) return "La mesa admite hasta 8 jugadores.";
    const faltan = Math.max(0, Math.min(8, Math.max(2, S.lieCfg.mesa)) - jug.length);
    const bots = CPU_NOMBRES.concat(["🤖 Cacho", "🤖 Coca", "🤖 Lalo", "🤖 Mora"]).slice(0, faltan).map((name, i) => ({ id: "b" + i, name, cpu: true }));
    R.lie = Lie.setup([...jug.map(p => ({ id: p.id, name: p.name })), ...bots], { esp: S.lieCfg.esp !== false });
    R.game = "liars"; Lie.programarHost(R);
    return null;
  },
  programarHost(R) {
    const s = R.lie;
    if (!s) return;
    Lie.programar(s, () => R.lie === s && R.game === "liars", a => { Lie.act(s, a.quien || s.players[s.turn].id, a); Net.broadcast(); Lie.programarHost(R); });
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") return Lie.empezarOn(R);
    if (a.t === "lobby" && pid === "H") { R.game = null; R.lie = null; return; }
    if (a.t === "next" && pid !== "H") return;
    Lie.act(R.lie, pid, a);
    Lie.programarHost(R);
  }
};

PANTALLAS.liars = () => {
  const s = S.lie;
  const humanos = s.players.filter(p => !p.cpu), turno = s.players[s.turn];
  // Con bots: se ve la mano de la persona (si hay varias, la del turno y se pasan el teléfono)
  if (turno && !turno.cpu) UI.lieVe = turno.id;
  const ve = humanos.length === 1 ? humanos[0].id : UI.lieVe || (humanos[0] || {}).id;
  Lie.render(Lie.view(s, ve), a => {
    if (a.t === "again") return Lie.empezarLocal();
    Lie.act(s, null, a); render(); window.scrollTo(0, 0);
  }, { local: true, gate: humanos.length > 1 });
  // Juegan los bots (y alguno puede gritar ¡Mentiroso! sin ser su turno)
  Lie.programar(s, () => S.screen === "liars" && S.lie === s, a => { Lie.act(s, null, a); if (a.t === "call") { UI.sel = []; UI.gate = null; } render(); });
};

/* Opción "Cartas especiales" en la pantalla de jugadores (modo un teléfono) */
(() => {
  const orig = PANTALLAS.players;
  PANTALLAS.players = () => {
    orig();
    const mas = S.mode === "liars" && byId("lieMas"); if (!mas) return;
    const on = S.lieCfg.esp !== false;
    mas.closest(".panel").insertAdjacentHTML("beforeend", `<div class="opt"><div class="txt"><b>Cartas especiales</b><small>${on ? "Una 😈 Diablo (si la descubren, gatillan todos los demás) y un 😇 Ángel (te salva y recarga) por ronda." : "Solo reinas, reyes, ases y comodines."}</small></div><button class="switch" role="switch" aria-checked="${on}" id="lieEsp" aria-label="Cartas especiales"></button></div>`);
    byId("lieEsp").onclick = () => { S.lieCfg.esp = !on; store.set("lieCfg", S.lieCfg); render(); };
  };
})();
