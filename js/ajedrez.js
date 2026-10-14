/* Ajedrez: reglas completas, compu (minimax con poda alfa-beta), un teléfono y online.
   Tablero: arreglo de 64 casillas, índice = fila * 8 + columna, fila 0 = octava (lado negro).
   Piezas: mayúsculas blancas (PNBRQK), minúsculas negras. */
const AJ = {
  INICIO: "rnbqkbnrpppppppp" + ".".repeat(32) + "PPPPPPPPRNBQKBNR",
  VALOR: { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 },
  GLIFO: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  /* Piezas dibujadas en SVG (todas del mismo tamaño y del color correcto en cualquier teléfono o PC) */
  SVG: {
    p: `<circle cx="22.5" cy="13" r="5.5"/><path d="M17 20.5h11l-1.5 3h-8z"/><path d="M18.5 23.5C17 30 14.5 33 13.5 36h18C30.5 33 28 30 26.5 23.5z"/>`,
    r: `<path d="M14 36l1.5-18h14L31 36z"/><path d="M12 18V9.5h4.2v3.3h4.3V9.5h4v3.3h4.3V9.5H33V18z"/><path d="M15 30.5h15" fill="none"/>`,
    b: `<path d="M15 36c1-5 3-7 3.2-9.5h8.6c.2 2.5 2.2 4.5 3.2 9.5z"/><path d="M17 27h11v-2.8H17z"/><path d="M22.5 7.5C16 13 15.5 18.5 17.5 24.2h10C29.5 18.5 29 13 22.5 7.5z"/><path d="M22.5 13.5v6M19.6 16.5h5.8" fill="none"/><circle cx="22.5" cy="6" r="2.3"/>`,
    n: `<path d="M14 36c0-6 3-9 6-12-2.2.2-5-.5-6.8-2.4-1.8-2 .5-5.6 3-8 2.2-2.4 3.4-5.2 5.2-7.2l1-2.6 2.6 3c5.4 1 8.8 6.8 8.4 15.2-.3 5-2 8-1.6 14z"/><circle cx="20.3" cy="14" r="1.3" class="o"/>`,
    q: `<path d="M14 36c1-5 2.5-9 3-12h11c.5 3 2 7 3 12z"/><path d="M12.5 13L16.5 24h12l4-11-4.6 5.6-.6-9.1-3.4 8-1.4-9-1.4 9-3.4-8-.6 9.1z"/><circle cx="12.5" cy="12.2" r="2"/><circle cx="17.5" cy="8.5" r="2"/><circle cx="22.5" cy="7" r="2"/><circle cx="27.5" cy="8.5" r="2"/><circle cx="32.5" cy="12.2" r="2"/>`,
    k: `<path d="M14 36c1-5 2.5-9 3-12h11c.5 3 2 7 3 12z"/><path d="M15.5 24c-2.5-6.5 1.5-10.5 7-8.5 5.5-2 9.5 2 7 8.5z"/><path d="M21 3.5h3v3h3v3h-3v5h-3v-5h-3v-3h3z"/>`
  },
  pieza(p, cls = "") {
    const col = typeof p === "string" && p.length === 1 && p !== p.toLowerCase() ? "w" : "b";
    return `<svg class="pieza ${col} ${cls}" viewBox="0 0 45 45" aria-hidden="true">${AJ.SVG[p.toLowerCase()]}<rect x="10" y="35.5" width="25" height="5" rx="2"/></svg>`;
  },
  NOMBRE: { q: "Dama", r: "Torre", b: "Alfil", n: "Caballo" },
  // Tablas de posición (desde el lado blanco, fila 0 = octava)
  PST: {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  },

  nueva() {
    return { b: AJ.INICIO.split(""), turno: "w", enroque: "KQkq", ep: -1, medio: 0, jugada: 1, ultima: null, hist: [], comidas: { w: [], b: [] }, fin: null };
  },
  color: c => c === "." ? null : c === c.toUpperCase() ? "w" : "b",
  fila: i => i >> 3, col: i => i & 7,
  nombreCasilla: i => "abcdefgh"[i & 7] + (8 - (i >> 3)),

  atacada(b, i, por) {
    const f = i >> 3, c = i & 7;
    const en = (ff, cc) => ff >= 0 && ff < 8 && cc >= 0 && cc < 8 ? b[ff * 8 + cc] : null;
    const es = (p, t) => p && p !== "." && AJ.color(p) === por && p.toLowerCase() === t;
    const dp = por === "w" ? 1 : -1;      // los peones blancos atacan hacia arriba (fila menor)
    if (es(en(f + dp, c - 1), "p") || es(en(f + dp, c + 1), "p")) return true;
    for (const [df, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) if (es(en(f + df, c + dc), "n")) return true;
    for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) if ((df || dc) && es(en(f + df, c + dc), "k")) return true;
    for (const [df, dc, t] of [[1, 0, "r"], [-1, 0, "r"], [0, 1, "r"], [0, -1, "r"], [1, 1, "b"], [1, -1, "b"], [-1, 1, "b"], [-1, -1, "b"]]) {
      let ff = f + df, cc = c + dc;
      while (ff >= 0 && ff < 8 && cc >= 0 && cc < 8) {
        const p = b[ff * 8 + cc];
        if (p !== ".") { if (AJ.color(p) === por && (p.toLowerCase() === t || p.toLowerCase() === "q")) return true; break; }
        ff += df; cc += dc;
      }
    }
    return false;
  },

  enJaque(s, col = s.turno) { const k = s.b.indexOf(col === "w" ? "K" : "k"); return AJ.atacada(s.b, k, col === "w" ? "b" : "w"); },

  pseudo(s) {
    const b = s.b, yo = s.turno, out = [];
    const add = (de, a, extra = {}) => out.push({ de, a, ...extra });
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (p === "." || AJ.color(p) !== yo) continue;
      const t = p.toLowerCase(), f = i >> 3, c = i & 7;
      if (t === "p") {
        const d = yo === "w" ? -1 : 1, fin = yo === "w" ? 0 : 7, ini = yo === "w" ? 6 : 1;
        const pr = (de, a, extra) => (a >> 3) === fin ? ["q", "r", "b", "n"].forEach(q => add(de, a, { ...extra, promo: q })) : add(de, a, extra);
        const a1 = i + d * 8;
        if (a1 >= 0 && a1 < 64 && b[a1] === ".") { pr(i, a1); if (f === ini && b[i + d * 16] === ".") add(i, i + d * 16, { doble: true }); }
        for (const dc of [-1, 1]) {
          const cc = c + dc; if (cc < 0 || cc > 7) continue;
          const a = (f + d) * 8 + cc;
          if (b[a] !== "." && AJ.color(b[a]) !== yo) pr(i, a);
          else if (a === s.ep) add(i, a, { alPaso: true });
        }
      } else if (t === "n" || t === "k") {
        const dirs = t === "n" ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [df, dc] of dirs) {
          const ff = f + df, cc = c + dc; if (ff < 0 || ff > 7 || cc < 0 || cc > 7) continue;
          const a = ff * 8 + cc; if (b[a] === "." || AJ.color(b[a]) !== yo) add(i, a);
        }
        if (t === "k") {
          const op = yo === "w" ? "b" : "w", base = yo === "w" ? 60 : 4;
          if (i === base && !AJ.atacada(b, i, op)) {
            if (s.enroque.includes(yo === "w" ? "K" : "k") && b[i + 1] === "." && b[i + 2] === "." && !AJ.atacada(b, i + 1, op) && !AJ.atacada(b, i + 2, op)) add(i, i + 2, { enroque: "corto" });
            if (s.enroque.includes(yo === "w" ? "Q" : "q") && b[i - 1] === "." && b[i - 2] === "." && b[i - 3] === "." && !AJ.atacada(b, i - 1, op) && !AJ.atacada(b, i - 2, op)) add(i, i - 2, { enroque: "largo" });
          }
        }
      } else {
        const dirs = t === "r" ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : t === "b" ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [df, dc] of dirs) {
          let ff = f + df, cc = c + dc;
          while (ff >= 0 && ff < 8 && cc >= 0 && cc < 8) {
            const a = ff * 8 + cc;
            if (b[a] === ".") add(i, a);
            else { if (AJ.color(b[a]) !== yo) add(i, a); break; }
            ff += df; cc += dc;
          }
        }
      }
    }
    return out;
  },

  /* Aplica una jugada y devuelve un estado nuevo (no toca el original) */
  aplicar(s, m) {
    const b = s.b.slice(), p = b[m.de], yo = s.turno, t = p.toLowerCase();
    let comida = b[m.a] !== "." ? b[m.a] : null;
    b[m.a] = m.promo ? (yo === "w" ? m.promo.toUpperCase() : m.promo) : p; b[m.de] = ".";
    if (m.alPaso) { const c = m.a + (yo === "w" ? 8 : -8); comida = b[c]; b[c] = "."; }
    if (m.enroque === "corto") { b[m.a - 1] = b[m.a + 1]; b[m.a + 1] = "."; }
    if (m.enroque === "largo") { b[m.a + 1] = b[m.a - 2]; b[m.a - 2] = "."; }
    let en = s.enroque;
    if (t === "k") en = en.replace(yo === "w" ? /[KQ]/g : /[kq]/g, "");
    const quita = { 63: "K", 56: "Q", 7: "k", 0: "q" };
    [m.de, m.a].forEach(i => { if (quita[i]) en = en.replace(quita[i], ""); });
    const comidas = comida ? { ...s.comidas, [yo]: [...s.comidas[yo], comida] } : s.comidas;
    return {
      b, turno: yo === "w" ? "b" : "w", enroque: en, ep: m.doble ? (m.de + m.a) / 2 : -1,
      medio: t === "p" || comida ? 0 : s.medio + 1, jugada: s.jugada + (yo === "b" ? 1 : 0),
      ultima: { de: m.de, a: m.a }, hist: s.hist, comidas, fin: null, comio: !!comida
    };
  },

  legales(s) { return AJ.pseudo(s).filter(m => !AJ.enJaque(AJ.aplicar(s, m), s.turno)); },
  clave: s => s.b.join("") + s.turno + s.enroque + s.ep,

  /* Mueve y calcula si terminó la partida */
  mover(s, m) {
    const n = AJ.aplicar(s, m);
    n.hist = [...s.hist, AJ.clave(s)].slice(-120);
    const leg = AJ.legales(n);
    const jaque = AJ.enJaque(n);
    n.jaque = jaque;
    if (!leg.length) n.fin = jaque ? { gana: s.turno, motivo: "Jaque mate" } : { gana: null, motivo: "Rey ahogado" };
    else if (n.medio >= 100) n.fin = { gana: null, motivo: "50 jugadas sin capturas" };
    else if (n.hist.filter(k => k === AJ.clave(n)).length >= 2) n.fin = { gana: null, motivo: "Triple repetición" };
    else {
      const resto = n.b.filter(p => p !== "." && p.toLowerCase() !== "k").map(p => p.toLowerCase());
      if (!resto.length || (resto.length === 1 && "bn".includes(resto[0]))) n.fin = { gana: null, motivo: "Material insuficiente" };
    }
    return n;
  },

  /* ---------- Compu ---------- */
  evaluar(s) {
    let v = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i]; if (p === ".") continue;
      const t = p.toLowerCase(), w = p !== t;
      const pst = AJ.PST[t][w ? i : (7 - (i >> 3)) * 8 + (i & 7)];
      v += (w ? 1 : -1) * (AJ.VALOR[t] + pst);
    }
    return v;
  },
  buscar(s, prof, alfa, beta) {
    if (prof === 0) return AJ.evaluar(s);   // en las hojas no hace falta generar jugadas
    const leg = AJ.legales(s);
    if (!leg.length) return AJ.enJaque(s) ? (s.turno === "w" ? -100000 - prof : 100000 + prof) : 0;
    leg.sort((x, y) => (s.b[y.a] !== "." ? AJ.VALOR[s.b[y.a].toLowerCase()] : 0) - (s.b[x.a] !== "." ? AJ.VALOR[s.b[x.a].toLowerCase()] : 0));
    if (s.turno === "w") {
      let mejor = -Infinity;
      for (const m of leg) { mejor = Math.max(mejor, AJ.buscar(AJ.aplicar(s, m), prof - 1, alfa, beta)); alfa = Math.max(alfa, mejor); if (alfa >= beta) break; }
      return mejor;
    }
    let mejor = Infinity;
    for (const m of leg) { mejor = Math.min(mejor, AJ.buscar(AJ.aplicar(s, m), prof - 1, alfa, beta)); beta = Math.min(beta, mejor); if (alfa >= beta) break; }
    return mejor;
  },
  jugadaCompu(s, nivel) {
    const leg = shuffle(AJ.legales(s));
    if (nivel === "facil" && Math.random() < 0.3) return pick(leg);
    const prof = nivel === "facil" ? 1 : 2;
    const signo = s.turno === "w" ? 1 : -1;
    let mejor = null, mv = -Infinity;
    for (const m of leg) {
      const v = signo * AJ.buscar(AJ.aplicar(s, m), prof, -Infinity, Infinity) + (nivel === "facil" ? Math.random() * 60 : Math.random() * 8);
      if (v > mv) { mv = v; mejor = m; }
    }
    return mejor;
  }
};

/* ---------- Partida (común a un teléfono y online) ---------- */
const Ajedrez = {
  /* jug: [{id, name, cpu?}] (0 = blancas, 1 = negras) */
  setup(jug) {
    return { id: "aj-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), jug: jug.slice(0, 2), pos: AJ.nueva(), rendido: null, tablasOfrecidas: null };
  },
  colorDe(s, pid) { const i = s.jug.findIndex(j => j.id === pid); return i === 0 ? "w" : i === 1 ? "b" : null; },
  terminado(s) { return !!(s.pos.fin || s.rendido || s.acordadas); },

  act(s, pid, a) {
    if (Ajedrez.terminado(s)) return;
    const col = pid === null ? s.pos.turno : Ajedrez.colorDe(s, pid);
    if (a.t === "move") {
      if (col !== s.pos.turno) return;
      const m = AJ.legales(s.pos).find(x => x.de === a.de && x.a === a.a && (!x.promo || x.promo === (a.promo || "q")));
      if (m) s.pos = AJ.mover(s.pos, m);
    } else if (a.t === "rendirse" && col) s.rendido = col;
    else if (a.t === "tablas" && col) {
      if (s.tablasOfrecidas && s.tablasOfrecidas !== col) s.acordadas = true;
      else s.tablasOfrecidas = col;
    } else if (a.t === "rechazar") s.tablasOfrecidas = null;
  },

  ganador(s) {
    if (s.rendido) return s.rendido === "w" ? "b" : "w";
    if (s.acordadas) return null;
    return s.pos.fin ? s.pos.fin.gana : undefined;
  },

  resultado(s, pid) {
    if (!Ajedrez.terminado(s)) return null;
    const col = Ajedrez.colorDe(s, pid); if (!col) return null;
    const rival = s.jug[col === "w" ? 1 : 0];
    const g = Ajedrez.ganador(s);
    return { juego: "ajedrez", id: s.id, gano: g === col, tablas: g === null, mate: !!(s.pos.fin && s.pos.fin.motivo === "Jaque mate" && g === col), vsCompu: !!rival.cpu, nivel: rival.nivel || null };
  },

  view(s, pid) {
    return { game: "ajedrez", s, me: pid, miColor: Ajedrez.colorDe(s, pid) };
  },

  render(v, send, opts) {
    const s = v.s, pos = s.pos, jefe = opts.local || opts.isHost;
    const miColor = opts.local ? pos.turno : v.miColor;
    const abajo = opts.local ? (s.jug[1].cpu ? "w" : s.jug[0].cpu ? "b" : "w") : (v.miColor || "w");
    const turnoJ = s.jug[pos.turno === "w" ? 0 : 1];
    const puedoMover = !Ajedrez.terminado(s) && !turnoJ.cpu && (opts.local || v.miColor === pos.turno);
    const leg = puedoMover ? AJ.legales(pos) : [];
    const sel = UI.ajSel;
    const destinos = sel != null ? leg.filter(m => m.de === sel) : [];
    const reyJaque = pos.jaque ? pos.b.indexOf(pos.turno === "w" ? "K" : "k") : -1;
    const orden = [...Array(64).keys()]; if (abajo === "b") orden.reverse();
    const casillas = orden.map(i => {
      const p = pos.b[i], f = i >> 3, c = i & 7, oscura = (f + c) % 2 === 1;
      const cls = [oscura ? "os" : "cl", sel === i ? "sel" : "", pos.ultima && (pos.ultima.de === i || pos.ultima.a === i) ? "ult" : "", i === reyJaque ? "jaque" : "", destinos.some(m => m.a === i) ? (p !== "." || destinos.some(m => m.a === i && m.alPaso) ? "come" : "punto") : ""].join(" ");
      const etiqueta = (abajo === "w" ? f === 7 : f === 0) ? `<i class="lc">${"abcdefgh"[c]}</i>` : "";
      const etf = (abajo === "w" ? c === 0 : c === 7) ? `<i class="lf">${8 - f}</i>` : "";
      return `<button class="casilla ${cls}" data-sq="${i}" aria-label="${AJ.nombreCasilla(i)}">${p !== "." ? AJ.pieza(p) : ""}${etiqueta}${etf}</button>`;
    }).join("");
    const comidas = col => s.pos.comidas[col].map(p => AJ.pieza(p, "mini")).join("");
    const jugador = (idx, col) => { const j = s.jug[idx]; return `<div class="aj-jug ${pos.turno === col && !Ajedrez.terminado(s) ? "turno" : ""}">${j.cpu ? `<span class="cpu-ic">🤖</span>` : avatar(j.name, 34)}<b>${esc(j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name)}</b><span class="aj-com">${comidas(col)}</span></div>`; };
    const arriba = abajo === "w" ? "b" : "w";
    const g = Ajedrez.ganador(s);
    let estado;
    if (Ajedrez.terminado(s)) {
      const motivo = s.rendido ? `${esc(s.jug[s.rendido === "w" ? 0 : 1].name)} se rindió` : s.acordadas ? "Tablas de común acuerdo" : pos.fin.motivo;
      estado = `<div class="verdict ${g ? "good" : ""}"><div class="big">${g ? `Gana ${esc(s.jug[g === "w" ? 0 : 1].name)}` : "Tablas"}</div><div class="note">${motivo}</div></div>
        ${jefe ? `<div class="row"><button class="btn" id="ajOtra">Otra partida</button><button class="btn ghost" id="ajSalir">${opts.local ? "Inicio" : "Volver a la sala"}</button></div>` : `<p class="sub center">El anfitrión puede empezar otra partida.</p>`}`;
    } else {
      estado = `<p class="aj-estado">${pos.jaque ? "<b>¡Jaque!</b> " : ""}${turnoJ.cpu ? "La compu está pensando…" : `Juegan las <b>${pos.turno === "w" ? "blancas" : "negras"}</b> (${esc(turnoJ.name)})`}</p>
        ${s.tablasOfrecidas && s.tablasOfrecidas !== miColor && !opts.local ? `<div class="panel confirm"><b>Tu rival ofrece tablas</b><div class="row"><button class="btn ghost" id="ajRech">Seguir jugando</button><button class="btn" id="ajAcep">Aceptar tablas</button></div></div>` : ""}
        ${UI.ajPromo ? `<div class="panel"><span class="label">Coronar el peón</span><div class="promo">${["q", "r", "b", "n"].map(q => `<button data-promo="${q}">${AJ.pieza(pos.turno === "w" ? q.toUpperCase() : q)}<small>${AJ.NOMBRE[q]}</small></button>`).join("")}</div></div>` : ""}
        ${opts.local || v.miColor ? `<div class="row">${s.jug.some(j => j.cpu) || opts.local ? "" : `<button class="btn ghost chico" id="ajTablas" ${s.tablasOfrecidas === miColor ? "disabled" : ""}>${s.tablasOfrecidas === miColor ? "Tablas ofrecidas" : "Ofrecer tablas"}</button>`}${UI.ajRendir ? `<button class="btn danger chico" id="ajRendirSi">Sí, me rindo</button><button class="btn ghost chico" id="ajRendirNo">No</button>` : `<button class="btn ghost chico" id="ajRendir">Rendirse</button>`}</div>` : ""}`;
    }
    app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen ajedrez">
      ${jugador(arriba === "w" ? 0 : 1, arriba)}
      <div class="tablero" data-k="${pos.hist.length}">${casillas}</div>
      ${jugador(abajo === "w" ? 0 : 1, abajo)}
      ${estado}</section>`;

    app.querySelectorAll("[data-sq]").forEach(el => el.onclick = () => {
      if (!puedoMover) return;
      const i = +el.dataset.sq, p = pos.b[i];
      const ms = destinos.filter(m => m.a === i);
      if (ms.length) {
        UI.ajSel = null;
        if (ms[0].promo) { UI.ajPromo = { de: ms[0].de, a: i }; return render(); }
        send({ t: "move", de: ms[0].de, a: i });
      } else { UI.ajSel = p !== "." && AJ.color(p) === pos.turno && sel !== i ? i : null; render(); }
    });
    app.querySelectorAll("[data-promo]").forEach(b => b.onclick = () => { const pr = UI.ajPromo; UI.ajPromo = null; send({ t: "move", de: pr.de, a: pr.a, promo: b.dataset.promo }); });
    on("ajRendir", () => { UI.ajRendir = true; render(); });
    on("ajRendirNo", () => { UI.ajRendir = false; render(); });
    on("ajRendirSi", () => { UI.ajRendir = false; send({ t: "rendirse" }); });
    on("ajTablas", () => send({ t: "tablas" }));
    on("ajAcep", () => send({ t: "tablas" }));
    on("ajRech", () => send({ t: "rechazar" }));
    on("ajOtra", () => send({ t: "again" }));
    on("ajSalir", () => opts.local ? go("home") : send({ t: "lobby" }));
  },

  /* Si le toca a la compu, juega después de una pausa */
  turnoCompu(s, alTerminar) {
    if (Ajedrez.terminado(s)) return;
    const j = s.jug[s.pos.turno === "w" ? 0 : 1];
    if (!j.cpu || UI.ajPensando === s.id + s.pos.hist.length) return;
    UI.ajPensando = s.id + s.pos.hist.length;
    setTimeout(() => {
      const m = AJ.jugadaCompu(s.pos, j.nivel);
      if (m) s.pos = AJ.mover(s.pos, m);
      UI.ajPensando = null;
      alTerminar();
    }, 450);
  },

  empezarLocal(jug) {
    S.aj = Ajedrez.setup(jug);
    Object.assign(UI, { ajSel: null, ajPromo: null, ajRendir: false, ajPensando: null });
    go("ajedrez");
  },
  empezarOn(R) {
    const jug = R.players.filter(p => p.on);
    if (jug.length < 2) return "Hacen falta 2 jugadores.";
    R.aj = Ajedrez.setup(shuffle(jug.slice(0, 2)).map(p => ({ id: p.id, name: p.name })));
    R.game = "ajedrez";
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") { R.aj = Ajedrez.setup([R.aj.jug[1], R.aj.jug[0]]); return; }
    if (a.t === "lobby" && pid === "H") { R.game = null; R.aj = null; return; }
    Ajedrez.act(R.aj, pid, a);
  }
};

PANTALLAS.ajedrez = () => {
  const s = S.aj;
  Ajedrez.render(Ajedrez.view(s, null), a => {
    if (a.t === "again") return Ajedrez.empezarLocal([s.jug[1], s.jug[0]]);
    Ajedrez.act(s, null, a); render();
  }, { local: true });
  Ajedrez.turnoCompu(s, render);
};
