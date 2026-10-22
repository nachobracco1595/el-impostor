/* Burako con fichas: números del 1 al 13 en 4 colores (dos de cada una) y 2 comodines. Los 2 también sirven de comodín.
   - 2 jugadores o 4 en parejas (sentados alternados). Cada uno recibe 11 fichas y cada equipo tiene un "muerto" de 11.
   - En tu turno: robas del mazo (una ficha) o levantas el pozo (todas las fichas tiradas). Bajas juegos y tiras una ficha.
   - Juegos: escalera (3 o más seguidas del mismo color; el 1 va antes del 2 o después del 13) o pierna (3 o más del mismo número).
     Un solo comodín por juego. Con 7 fichas es canasta: limpia (sin comodín) 200 puntos, sucia 100.
   - Al quedarte sin fichas por primera vez tomas el muerto. Para cerrar hace falta haber tomado el muerto y tener una canasta.
   - Cuenta: lo bajado suma, lo que queda en la mano resta, cerrar suma 100 y no tomar el muerto resta 100. */
const BK = {
  COLORES: { R: ["rojo", "#e03131"], A: ["azul", "#1c7ed6"], N: ["negro", "#212529"], Y: ["amarillo", "#e67700"] },
  METAS: [[0, "Una mano"], [1500, "A 1500"], [3000, "A 3000"]],
  CPU: ["🤖 Rita", "🤖 Tito", "🤖 Pepa"]
};

const Burako = {
  /* ---------- Fichas: "R07a" = rojo, 7, copia a. Comodín: "J00a" ---------- */
  col: t => t[0], num: t => +t.slice(1, 3),
  esJoker: t => t[0] === "J",
  esComodin: t => t[0] === "J" || +t.slice(1, 3) === 2,
  valor(t) { if (t[0] === "J") return 50; const n = +t.slice(1, 3); return n === 2 ? 20 : n === 1 ? 15 : n >= 8 ? 10 : 5; },
  mazo() {
    const m = [];
    for (const c of "RANY") for (let n = 1; n <= 13; n++) for (const k of "ab") m.push(c + String(n).padStart(2, "0") + k);
    m.push("J00a", "J00b");
    return shuffle(m);
  },
  ordenar(mano, modo) {
    const ord = t => Burako.esJoker(t) ? 999 : modo === "num" ? Burako.num(t) * 10 + "RANY".indexOf(t[0]) : "RANY".indexOf(t[0]) * 100 + Burako.num(t);
    return mano.slice().sort((a, b) => ord(a) - ord(b) || (a < b ? -1 : 1));
  },

  /* ¿Estas fichas forman un juego? → { tipo, orden, comodines } o null */
  analizar(fs) {
    if (!fs || fs.length < 3) return null;
    const jok = fs.filter(Burako.esJoker), resto = fs.filter(t => !Burako.esJoker(t)), num = Burako.num;
    const escalera = () => {
      const otros = resto.filter(t => num(t) !== 2), doses = resto.filter(t => num(t) === 2);
      if (!otros.length) return null;
      const c = otros[0][0];
      if (!otros.every(t => t[0] === c)) return null;
      for (const dosNat of [null, ...doses.filter(t => t[0] === c).slice(0, 1)]) for (const alto of [false, true]) {
        if (alto && !otros.some(t => num(t) === 1)) continue;
        const nat = dosNat ? [...otros, dosNat] : otros, wild = [...jok, ...doses.filter(t => t !== dosNat)];
        if (wild.length > 1) continue;
        const val = t => num(t) === 1 && alto ? 14 : num(t);
        const vs = nat.map(val).sort((a, b) => a - b);
        if (new Set(vs).size !== vs.length) continue;
        let lo = vs[0], hi = vs[vs.length - 1];
        const huecos = hi - lo + 1 - vs.length;
        if (huecos > wild.length) continue;
        if (wild.length > huecos) { if (hi < (alto ? 14 : 13)) hi++; else if (lo > 1) lo--; else continue; }
        const orden = []; let wi = 0;
        for (let v = lo; v <= hi; v++) orden.push(nat.find(x => val(x) === v) || wild[wi++]);
        return { tipo: "esc", orden, comodines: wild.length, color: c };
      }
      return null;
    };
    const pierna = () => {
      let nat = resto.filter(t => num(t) !== 2), wild = [...jok, ...resto.filter(t => num(t) === 2)];
      if (!nat.length) { nat = resto; wild = jok; }           // pierna de doses
      if (nat.length < 2 || wild.length > 1 || !nat.every(t => num(t) === num(nat[0]))) return null;
      return { tipo: "pie", orden: [...Burako.ordenar(nat), ...wild], comodines: wild.length };
    };
    return escalera() || pierna();
  },
  juego(fs) { const a = Burako.analizar(fs); return a && { fichas: a.orden, tipo: a.tipo, canasta: a.orden.length >= 7, limpia: a.comodines === 0 }; },

  /* ---------- Partida ---------- */
  equipo: (s, i) => i % 2,
  setup(jug, cfg) {
    const s = {
      id: "bk-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      jug: jug.map(j => ({ ...j, mano: [] })), n: jug.length, cfg: { meta: cfg && cfg.meta != null ? +cfg.meta : 1500 },
      pts: [0, 0], ronda: 0, mano: Math.floor(Math.random() * jug.length), mov: 0,
      st: { limpias: [0, 0], cierres: [0, 0] }, historial: []
    };
    Burako.nuevaMano(s);
    return s;
  },
  nuevaMano(s) {
    s.ronda++; s.mano = (s.mano + 1) % s.n;
    const m = Burako.mazo();
    s.jug.forEach(j => j.mano = m.splice(0, 11));
    Object.assign(s, { muertos: [m.splice(0, 11), m.splice(0, 11)], muertoTomado: [false, false], mazo: m, descarte: [], mesa: [[], []],
      turno: s.mano, fase: "robar", res: null, log: [], aviso: null, mov: s.mov + 1, turnos: 0, nuevas: {}, nuevasDe: {}, levanto: null });
  },
  decir(s, txt) { s.log = [...s.log, txt].slice(-5); },
  tieneCanasta: (s, q) => s.mesa[q].some(j => j.canasta),
  /* ¿Puede quedar con `k` fichas después de esta jugada? (sin poder tirar no se puede seguir) */
  puedeQuedar(s, i, k, mesaDespues) {
    const q = Burako.equipo(s, i), muerto = !s.muertoTomado[q], canasta = (mesaDespues || s.mesa[q]).some(j => j.canasta);
    if (k >= 2) return true;
    return muerto || canasta && s.muertoTomado[q];
  },

  act(s, pid, a) {
    if (a.t === "siguiente") { if (s.fase === "finMano") Burako.nuevaMano(s); return; }
    const i = s.jug.findIndex(j => j.id === pid), J = s.jug[i];
    if (!J || i !== s.turno || (s.fase !== "robar" && s.fase !== "jugar")) return;
    const q = Burako.equipo(s, i), tiene = ids => Array.isArray(ids) && ids.length && new Set(ids).size === ids.length && ids.every(t => J.mano.includes(t));
    if (a.t === "robar" && s.fase === "robar") {
      if (a.de === "descarte") {
        if (!s.descarte.length) return;
        (s.quiere = s.quiere || [[], []])[q] = [...s.quiere[q], s.descarte[s.descarte.length - 1]].slice(-5);   // lo que levantó: lo anotan los bots
        J.mano.push(...s.descarte); Burako.decir(s, `${J.name} levantó el pozo (${s.descarte.length})`);
        s.nuevas[i] = s.descarte.slice(); s.nuevasDe[i] = "pozo"; s.levanto = { i, fichas: s.descarte.slice(), k: s.mov + 1 }; s.descarte = [];
      } else {
        if (!s.mazo.length) return Burako.cerrarMano(s, null);
        const t = s.mazo.pop(); J.mano.push(t); s.nuevas[i] = [t]; s.nuevasDe[i] = "mazo"; Burako.decir(s, `${J.name} robó del mazo`);
      }
      s.fase = "jugar"; s.mov++;
    } else if (a.t === "bajar" && s.fase === "jugar" && tiene(a.ids)) {
      const jg = Burako.juego(a.ids); if (!jg) return;
      const mesa = [...s.mesa[q], jg], quedan = J.mano.length - a.ids.length;
      if (!Burako.puedeQuedar(s, i, quedan, mesa)) return;
      s.mesa[q] = mesa; J.mano = J.mano.filter(t => !a.ids.includes(t));
      Burako.decir(s, `${J.name} bajó ${jg.tipo === "esc" ? "una escalera" : "una pierna"}`);
      if (jg.canasta) Burako.festejo(s, i, jg);
      s.mov++; Burako.revisarVacia(s, i, false);
    } else if (a.t === "agregar" && s.fase === "jugar" && tiene(a.ids) && s.mesa[q][a.k]) {
      const viejo = s.mesa[q][a.k], jg = Burako.juego([...viejo.fichas, ...a.ids]); if (!jg) return;
      const mesa = s.mesa[q].map((x, k) => k === a.k ? jg : x), quedan = J.mano.length - a.ids.length;
      if (!Burako.puedeQuedar(s, i, quedan, mesa)) return;
      s.mesa[q] = mesa; J.mano = J.mano.filter(t => !a.ids.includes(t));
      Burako.decir(s, `${J.name} agregó ${a.ids.length} ficha${a.ids.length > 1 ? "s" : ""}`);
      if (jg.canasta && !viejo.canasta) Burako.festejo(s, i, jg);
      s.mov++; Burako.revisarVacia(s, i, false);
    } else if (a.t === "tirar" && s.fase === "jugar" && J.mano.includes(a.id)) {
      if (J.mano.length === 1 && !Burako.puedeQuedar(s, i, 0)) return;
      J.mano = J.mano.filter(t => t !== a.id); s.descarte.push(a.id); s.mov++;
      if (Burako.revisarVacia(s, i, true)) return;
      // Por si nadie puede cerrar nunca (se llevan el descarte una y otra vez): la mano termina a las 400 jugadas
      if (++s.turnos > 400) return Burako.cerrarMano(s, null);
      s.turno = (i + 1) % s.n; s.fase = "robar";
    }
  },
  festejo(s, i, jg) { s.aviso = { k: s.mov, txt: `¡Canasta ${jg.limpia ? "limpia" : "sucia"}!`, eq: Burako.equipo(s, i) }; if (jg.limpia) s.st.limpias[Burako.equipo(s, i)]++; },
  /* Sin fichas: toma el muerto o cierra. Devuelve true si cerró la mano. */
  revisarVacia(s, i, tiro) {
    const J = s.jug[i], q = Burako.equipo(s, i);
    if (J.mano.length) return false;
    if (!s.muertoTomado[q]) {
      s.muertoTomado[q] = true; J.mano = s.muertos[q]; s.muertos[q] = []; s.nuevas[i] = J.mano.slice(); s.nuevasDe[i] = "muerto";
      s.aviso = { k: s.mov, txt: `¡${J.name.replace(/^🤖\s*/, "")} tomó el muerto!`, eq: q };
      Burako.decir(s, `${J.name} tomó el muerto`);
      if (tiro) { s.turno = (i + 1) % s.n; s.fase = "robar"; return true; }
      return false;
    }
    Burako.cerrarMano(s, q);
    return true;
  },
  cerrarMano(s, cerro) {
    const cuenta = [0, 1].map(q => {
      const mesa = s.mesa[q].reduce((t, j) => t + j.fichas.reduce((a, f) => a + Burako.valor(f), 0), 0);
      const canastas = s.mesa[q].reduce((t, j) => t + (j.canasta ? (j.limpia ? 200 : 100) : 0), 0);
      const mano = s.jug.filter((_, i) => Burako.equipo(s, i) === q).reduce((t, j) => t + j.mano.reduce((a, f) => a + Burako.valor(f), 0), 0);
      const r = { mesa, canastas, cierre: cerro === q ? 100 : 0, mano: -mano, muerto: s.muertoTomado[q] ? 0 : -100 };
      r.total = r.mesa + r.canastas + r.cierre + r.mano + r.muerto;
      return r;
    });
    cuenta.forEach((r, q) => s.pts[q] += r.total);
    if (cerro != null) s.st.cierres[cerro]++;
    s.res = { cerro, cuenta, sinFichas: cerro == null };
    s.historial.push(cuenta.map(r => r.total));
    const fin = !s.cfg.meta || s.pts.some(p => p >= s.cfg.meta);
    if (fin) { s.fase = "fin"; s.ganador = s.pts[0] === s.pts[1] ? (cerro ?? 0) : s.pts[0] > s.pts[1] ? 0 : 1; }
    else s.fase = "finMano";
    s.mov++;
  },

  /* ---------- Compu ---------- */
  util(s, i, t) {
    if (Burako.esComodin(t)) return 1000;
    const mano = s.jug[i].mano.filter(x => x !== t && !Burako.esComodin(x)), n = Burako.num(t);
    let u = 0;
    for (const x of mano) {
      if (x[0] === t[0]) { const d = Math.abs(Burako.num(x) - n); if (d === 1) u += 4; else if (d === 2) u += 2; else if (d === 0) u -= 1; }
      if (Burako.num(x) === n && x[0] !== t[0]) u += 3;
    }
    const q = Burako.equipo(s, i);
    if (s.mesa[q].some(j => Burako.analizar([...j.fichas, t]))) u += 50;
    if (s.mesa[1 - q].some(j => Burako.analizar([...j.fichas, t]))) u += 15;     // no regalarle fichas al otro equipo
    return u;
  },
  buscarJuego(mano) {
    const nat = mano.filter(t => !Burako.esComodin(t)), wild = mano.filter(Burako.esComodin);
    const prueba = ids => Burako.analizar(ids) ? ids : null;
    // Escaleras naturales (una ficha por número)
    for (const c of "RANY") {
      const por = {}; nat.filter(t => t[0] === c).forEach(t => { por[Burako.num(t)] = por[Burako.num(t)] || t; });
      if (por[1]) por[14] = por[1];
      let run = [];
      for (let v = 1; v <= 15; v++) {
        if (por[v] && !(v === 14 && run.some(t => Burako.num(t) === 1))) run.push(por[v]);
        else { if (run.length >= 3) { const r = prueba(run); if (r) return r; } run = por[v] ? [por[v]] : []; }
      }
    }
    // Piernas naturales
    const por = {}; nat.forEach(t => (por[Burako.num(t)] = por[Burako.num(t)] || []).push(t));
    for (const g of Object.values(por)) if (g.length >= 3) { const r = prueba(g); if (r) return r; }
    // Con un comodín
    if (wild.length) {
      const w = wild.find(Burako.esJoker) || wild[0];
      for (const a of nat) for (const b of nat) if (a < b && a[0] === b[0] && Math.abs(Burako.num(a) - Burako.num(b)) <= 2 && Burako.num(a) !== Burako.num(b)) { const r = prueba([a, b, w]); if (r) return r; }
      for (const g of Object.values(por)) if (g.length === 2) { const r = prueba([...g, w]); if (r) return r; }
    }
    return null;
  },
  decidir(s) {
    const i = s.turno, J = s.jug[i], q = Burako.equipo(s, i);
    // h: habilidad (Mente). Los flojos se olvidan de agregar y tiran sin mirar; los buenos se acuerdan de qué levantó el rival
    const h = typeof Mente !== "undefined" ? Mente.habilidad("burako") : 0.5, distraido = Math.random() < 0.3 * (1 - h);
    if (s.fase === "robar") {
      const top = s.descarte[s.descarte.length - 1];
      const conTop = top && Burako.buscarJuego([...J.mano, top]);
      const usable = Burako.puedeQuedar(s, i, J.mano.length);       // si después de usarla me quedo sin poder tirar, no sirve
      const sirve = top && usable && (Burako.esComodin(top) || s.mesa[q].some(j => Burako.analizar([...j.fichas, top])) || (conTop && conTop.includes(top)));
      return { t: "robar", de: top && (sirve || s.descarte.length >= 5 && Burako.util(s, i, top) >= 4) || !s.mazo.length ? "descarte" : "mazo" };
    }
    // Agregar a lo que ya está en la mesa (primero las fichas naturales)
    const fichas = Burako.ordenar(J.mano).sort((a, b) => Burako.esComodin(a) - Burako.esComodin(b));
    if (!distraido) for (let k = 0; k < s.mesa[q].length; k++) for (const t of fichas) {
      const j = s.mesa[q][k];
      if (Burako.esComodin(t) && (j.fichas.some(Burako.esComodin) || j.canasta && j.limpia)) continue;
      const nuevo = Burako.juego([...j.fichas, t]);
      if (nuevo && Burako.puedeQuedar(s, i, J.mano.length - 1, s.mesa[q].map((x, kk) => kk === k ? nuevo : x))) return { t: "agregar", ids: [t], k };
    }
    const nuevo = Burako.buscarJuego(J.mano);
    if (nuevo && Burako.puedeQuedar(s, i, J.mano.length - nuevo.length, [...s.mesa[q], Burako.juego(nuevo)])) return { t: "bajar", ids: nuevo };
    const junta = ((s.quiere || [])[1 - q] || []).filter(x => !Burako.esComodin(x));
    const peligro = t => h * junta.reduce((u, x) => u + (x[0] === t[0] && Math.abs(Burako.num(x) - Burako.num(t)) <= 2 ? 6 : Burako.num(x) === Burako.num(t) ? 4 : 0), 0);
    const orden = J.mano.slice().sort((a, b) => Burako.util(s, i, a) + peligro(a) - Burako.util(s, i, b) - peligro(b) || Burako.valor(b) - Burako.valor(a));
    const tira = distraido && orden.length > 2 && !Burako.esComodin(orden[1]) ? orden[1] : orden[0];
    return { t: "tirar", id: tira };
  },
  jugarCompu(s) {
    if (s.fase !== "robar" && s.fase !== "jugar") return;
    const J = s.jug[s.turno]; if (!J.cpu) return;
    const mov = s.mov, a = Burako.decidir(s);
    Burako.act(s, J.id, a);
    // Si por algún motivo la jugada no valió, tira la ficha menos útil para no trabarse
    if (s.mov === mov && s.fase === "jugar") { for (const t of J.mano) { Burako.act(s, J.id, { t: "tirar", id: t }); if (s.mov !== mov) break; } }
  },

  resultado(s, pid) {
    if (s.fase !== "fin") return null;
    const i = s.jug.findIndex(j => j.id === pid); if (i < 0) return null;
    const q = Burako.equipo(s, i);
    return { juego: "burako", id: s.id, gano: s.ganador === q, vsCompu: s.jug.every((j, k) => Burako.equipo(s, k) === q || j.cpu), n: s.n, limpias: s.st.limpias[q], cierres: s.st.cierres[q] };
  },
  view(s, pid) {
    const yo = s.jug.findIndex(j => j.id === pid);
    return {
      game: "burako", id: s.id, me: pid, yo, n: s.n, fase: s.fase, turno: s.turno, pts: s.pts, meta: s.cfg.meta, ronda: s.ronda, mov: s.mov,
      jug: s.jug.map((j, i) => ({ name: j.name, cpu: !!j.cpu, n: j.mano.length, eq: Burako.equipo(s, i) })),
      mano: yo >= 0 ? s.jug[yo].mano : [], mesa: s.mesa, top: s.descarte.slice(-1)[0] || null, descarte: s.descarte.length, mazo: s.mazo.length,
      muertoTomado: s.muertoTomado, res: s.res, ganador: s.ganador, log: s.log, aviso: s.aviso,
      // El pozo está a la vista de todos (son fichas tiradas), igual que lo que alguien levantó
      pozo: s.descarte, levanto: s.levanto, nuevas: yo >= 0 ? (s.nuevas || {})[yo] || [] : [], nuevasDe: yo >= 0 ? (s.nuevasDe || {})[yo] : null
    };
  },

  /* ---------- Dibujo ---------- */
  /* Cada ficha es un dibujo (SVG) que escala con su tamaño: el número queda siempre centrado
     y los de dos cifras se ajustan al ancho, sea cual sea la letra del teléfono */
  ESTRELLA: "M0-5l1.5 3.2 3.5.4-2.6 2.4.7 3.5L0 2.8-3.1 4.5l.7-3.5L-5-1.4l3.5-.4z",
  ficha(t, cls = "", attrs = "") {
    if (Burako.esJoker(t)) return `<span class="bk-f joker ${cls}" ${attrs} aria-label="comodín"><svg viewBox="0 0 40 56" aria-hidden="true"><path d="${Burako.ESTRELLA}" transform="translate(20 27) scale(2.6)" fill="#c2255c"/><text class="cl" x="20" y="49" text-anchor="middle" font-size="7" font-weight="900" fill="#c2255c" letter-spacing=".5">COMODÍN</text></svg></span>`;
    const n = Burako.num(t), c = BK.COLORES[t[0]], dos = n >= 10;
    return `<span class="bk-f ${n === 2 ? "dos" : ""} ${cls}" style="--fc:${c[1]}" ${attrs} aria-label="${n} ${c[0]}"><svg viewBox="0 0 40 56" aria-hidden="true">
      <text x="20" y="35" text-anchor="middle" font-size="${dos ? 25 : 27}" font-weight="900" fill="${c[1]}" ${dos ? `textLength="29" lengthAdjust="spacingAndGlyphs"` : ""}>${n}</text>
      <circle class="pt" cx="20" cy="46.5" r="3.4" fill="${c[1]}" opacity=".85"/>${n === 2 ? `<path d="${Burako.ESTRELLA}" transform="translate(33 8) scale(.9)" fill="#c2255c"/>` : ""}</svg></span>`;
  },
  render(v, send, opts) {
    // Mientras se arrastra una ficha no se redibuja (si juega otro, se muestra al soltar)
    if (UI.bk && UI.bk.arrastrando && UI.bk.id === v.id && byId("bkMano") && document.querySelector(".bk-f.fantasma")) { UI.bk.pendiente = true; return; }
    // Si quedó un dedo apoyado en una ficha (sin llegar a arrastrar), se suelta: si no, al vencer la espera
    // arrancaba un arrastre sobre la mano vieja, nadie lo soltaba y la pantalla dejaba de redibujarse
    if (UI.bk && UI.bk.soltar) UI.bk.soltar();
    document.querySelectorAll(".bk-f.fantasma").forEach(x => x.remove());
    const yo = v.yo >= 0 ? v.yo : 0, miEq = v.yo >= 0 ? v.jug[yo].eq : 0, U = UI.bk = UI.bk && UI.bk.id === v.id ? UI.bk : { id: v.id, sel: [], orden: store.get("bkOrden", "color"), manual: [] };
    U.sel = U.sel.filter(t => v.mano.includes(t));
    // Orden a mano: se respeta lo que acomodó la persona; lo nuevo va al final
    U.manual = [...U.manual.filter(t => v.mano.includes(t)), ...v.mano.filter(t => !U.manual.includes(t))];
    const enOrden = U.orden === "mano" ? U.manual : Burako.ordenar(v.mano, U.orden);
    const nuevas = new Set(v.fase === "jugar" && v.turno === v.yo ? v.nuevas : []);
    const miTurno = v.yo >= 0 && v.turno === v.yo && (v.fase === "robar" || v.fase === "jugar") && !v.jug[yo].cpu, jugando = miTurno && v.fase === "jugar";
    const nom = j => esc(j.cpu ? j.name.replace(/^🤖\s*/, "") : j.name);
    const eqNom = q => v.n === 2 ? (q === miEq && v.yo >= 0 ? "Vos" : nom(v.jug.find(j => j.eq === q))) : q === miEq ? "Nosotros" : "Ellos";
    const marcador = `<div class="bk-marcador">${[miEq, 1 - miEq].map(q => `<div class="bk-eq ${q === miEq ? "nos" : "ellos"}"><b>${eqNom(q)}</b><span class="bk-pts">${v.pts[q]}</span>
      <small>${v.muertoTomado[q] ? "✅ muerto" : "🃏 muerto"} · 🧺 ${v.mesa[q].filter(j => j.canasta).length}</small></div>`).join("")}</div>`;
    const rivales = `<div class="bk-rivales">${v.jug.map((j, i) => i === v.yo ? "" : `<div class="bk-riv ${i === v.turno && v.fase !== "fin" && v.fase !== "finMano" ? "turno" : ""} ${j.eq === miEq ? "nos" : "ellos"}">${j.cpu ? `<span class="cpu-ic">🤖</span>` : avatar(j.name, 22)}<b>${nom(j)}</b><span>${j.n} ficha${j.n === 1 ? "" : "s"}</span></div>`).join("")}</div>`;
    // Para agregar: qué juegos propios aceptan la selección
    const acepta = k => jugando && U.sel.length && !!Burako.analizar([...v.mesa[miEq][k].fichas, ...U.sel]);
    const juegos = q => v.mesa[q].length ? v.mesa[q].map((j, k) => {
      const ok = q === miEq && acepta(k);
      return `<button class="bk-juego ${j.canasta ? (j.limpia ? "canasta limpia" : "canasta sucia") : ""} ${ok ? "acepta" : ""}" ${q === miEq && jugando ? `data-agregar="${k}"` : "disabled"}>
        ${j.fichas.map(f => Burako.ficha(f, "mini")).join("")}${j.canasta ? `<em>${j.limpia ? "Limpia" : "Sucia"}</em>` : ""}${ok ? `<strong>＋</strong>` : ""}</button>`;
    }).join("") : `<p class="empty">${q === miEq ? "Todavía no bajaron juegos." : "Nada en la mesa."}</p>`;
    const mesa = `<div class="bk-mesa" data-k="${v.mov}">
      <div class="bk-lado"><span class="label">${eqNom(1 - miEq)}</span><div class="bk-juegos">${juegos(1 - miEq)}</div></div>
      <div class="bk-centro">
        <button class="bk-pila mazo ${U.sug && U.sug.mov === v.mov && U.sug.de === "mazo" ? "sugerida" : ""}" id="bkMazo" ${miTurno && v.fase === "robar" && v.mazo ? "" : "disabled"}><span class="bk-f dorso"></span><small>Mazo · ${v.mazo}</small></button>
        <button class="bk-pila desc ${miTurno && v.fase === "robar" && v.descarte ? "puede" : ""} ${U.sug && U.sug.mov === v.mov && U.sug.de === "descarte" ? "sugerida" : ""}" id="bkDesc" ${v.descarte ? "" : "disabled"}>${v.top ? Burako.ficha(v.top) : `<span class="bk-f vacio"></span>`}<small>${v.descarte ? `Pozo · ${v.descarte} · 👀 ver` : "Pozo vacío"}</small></button>
      </div>
      <div class="bk-lado nuestro"><span class="label">${eqNom(miEq)}${jugando && U.sel.length && v.mesa[miEq].length ? " · tocá uno para agregar" : ""}</span><div class="bk-juegos">${juegos(miEq)}</div></div>
    </div>`;

    let estado = "", botones = "", cartel = "";
    if (v.fase === "finMano" || v.fase === "fin") {
      const r = v.res, fila = (t, k) => `<tr><td>${t}</td>${[miEq, 1 - miEq].map(q => `<td class="${r.cuenta[q][k] < 0 ? "neg" : ""}">${r.cuenta[q][k] > 0 && k !== "total" ? "+" : ""}${r.cuenta[q][k]}</td>`).join("")}</tr>`;
      cartel = `${v.fase === "fin" ? `<div class="verdict ${v.ganador === miEq && v.yo >= 0 ? "good" : "bad"}"><div class="big">${v.yo < 0 ? `Ganó ${esc(eqNom(v.ganador))}` : v.ganador === miEq ? "¡Ganaron!" : "Perdieron"}</div><div class="note">${v.pts[miEq]} a ${v.pts[1 - miEq]}</div></div>` : `<div class="verdict"><div class="big">${r.cerro != null ? `Cerró ${esc(eqNom(r.cerro))}` : "Se terminó el mazo"}</div><div class="note">Mano ${v.ronda}${v.meta ? ` · se juega a ${v.meta}` : ""}</div></div>`}
        <table class="bk-cuenta"><tr><th></th><th>${eqNom(miEq)}</th><th>${eqNom(1 - miEq)}</th></tr>${fila("Fichas bajadas", "mesa")}${fila("Canastas", "canastas")}${fila("Cierre", "cierre")}${fila("En la mano", "mano")}${fila("Muerto", "muerto")}${fila("<b>Total de la mano</b>", "total")}</table>
        ${opts.local || opts.isHost ? `<div class="row">${v.fase === "fin" ? `<button class="btn" id="bkOtra">Otra partida</button><button class="btn ghost" id="bkSalir">${opts.local ? "Inicio" : "Volver a la sala"}</button>` : `<button class="btn" id="bkSig">Siguiente mano</button>`}</div>` : `<p class="sub center">El anfitrión reparte la siguiente.</p>`}`;
    } else {
      const sel = U.sel, jg = sel.length >= 3 ? Burako.analizar(sel) : null;
      const sug = U.sug && U.sug.mov === v.mov ? U.sug : null;
      estado = sug && miTurno ? `💡 ${sug.txt}` : !miTurno ? (v.jug[v.turno].cpu ? `🤖 ${nom(v.jug[v.turno])} está jugando…` : `Turno de <b>${nom(v.jug[v.turno])}</b>.`)
        : v.fase === "robar" ? "🀄 <b>Tu turno:</b> robá del mazo o levantá todo el pozo."
        : sel.length === 0 && v.nuevas.length ? `${v.nuevasDe === "mazo" ? `Robaste ${Burako.ficha(v.nuevas[0], "mini")} del mazo` : v.nuevasDe === "muerto" ? "Tomaste el muerto: sus fichas brillan en tu mano" : v.nuevas.length === 1 ? `Levantaste ${Burako.ficha(v.nuevas[0], "mini")} del pozo` : `Levantaste ${v.nuevas.length} fichas del pozo (brillan en tu mano)`}. Elegí fichas para bajar o una para tirar.`
        : sel.length === 0 ? "Elegí fichas para bajar un juego, tocá un juego tuyo para agregar, o elegí una para tirar."
        : jg ? `✅ ${jg.tipo === "esc" ? "Escalera" : "Pierna"} de ${jg.orden.length}${jg.orden.length >= 7 ? " · ¡canasta!" : ""}` : sel.length === 1 ? "Tirala o agregala a un juego tuyo." : sel.length < 3 ? "Un juego necesita 3 fichas o más." : "Esas fichas no forman un juego.";
      botones = `<div class="bk-botones ${jugando ? "" : "oculta"}" ${jugando ? "" : `aria-hidden="true"`}><button class="btn" id="bkBajar" ${jg ? "" : "disabled"}>⬇️ Bajar</button><button class="btn danger" id="bkTirar" ${sel.length === 1 ? "" : "disabled"}>Tirar</button><button class="btn ghost chico" id="bkLimpiar" ${sel.length ? "" : "disabled"}>✕</button></div>`;
    }
    const hayJugada = jugando && !U.sel.length && (() => { const s = Burako.sugerir(v); return s && s.ids && s.ids.length && !s.tirar; })();
    const mano = v.yo >= 0 && v.fase !== "fin" ? `<div class="panel bk-mano-panel"><div class="bk-mano-cab"><span class="label">Mano · ${v.mano.length}</span>
        ${miTurno ? `<button class="btn chico bk-sug ${hayJugada ? "hay" : ""}" id="bkSug">💡 ${hayJugada ? "¡Tenés jugada!" : "Sugerencia"}</button>` : ""}
        <div class="seg bk-orden" role="radiogroup" aria-label="Ordenar la mano">${[["color", "Color"], ["num", "Número"], ["mano", "✋"]].map(([k, t]) => `<button aria-pressed="${U.orden === k}" data-bkorden="${k}">${t}</button>`).join("")}</div></div>
      <div class="bk-mano" id="bkMano">${enOrden.map(t => Burako.ficha(t, `${jugando ? "toca" : ""} ${U.sel.includes(t) ? "sel" : ""} ${nuevas.has(t) ? "nueva" : ""}`, `data-mf="${t}" ${jugando ? `data-f="${t}" role="button" tabindex="0"` : ""}`)).join("")}</div>
      <p class="bk-ayuda">Mantené apretada una ficha y arrastrala para acomodarla donde quieras.</p></div>` : "";
    // Lo que levantó otro jugador del pozo (todos lo vieron)
    // Siempre ocupa su lugar (vacío o con lo último que levantó otro) para que nada se corra
    const levTxt = v.fase === "finMano" || v.fase === "fin" ? "" : v.levanto && v.levanto.k >= v.mov - 6 && v.levanto.i !== v.yo
      ? `<p class="bk-levanto">${nom(v.jug[v.levanto.i])} levantó el pozo: ${v.levanto.fichas.slice(0, 10).map(f => Burako.ficha(f, "mini")).join("")}${v.levanto.fichas.length > 10 ? ` +${v.levanto.fichas.length - 10}` : ""}</p>` : `<p class="bk-levanto vacio"></p>`;
    // Ventana para mirar el pozo antes de levantarlo
    const puedeLevantar = miTurno && v.fase === "robar" && v.descarte;
    const verPozo = U.verPozo && v.descarte ? `<div class="modal-fondo bk-pozo-fondo" id="bkPozoFondo"><div class="modal bk-pozo" role="dialog" aria-label="El pozo">
        <div class="headrow"><h2>El pozo · ${v.descarte} ficha${v.descarte === 1 ? "" : "s"}</h2><button class="linkish" id="bkPozoX" aria-label="Cerrar">✕</button></div>
        <p class="sub">De la más vieja a la última que se tiró. Si lo levantás, te llevás todas.</p>
        <div class="bk-mano">${v.pozo.map((f, k) => Burako.ficha(f, k === v.pozo.length - 1 ? "ultima" : "")).join("")}</div>
        <p class="summary">Suman <b>${v.pozo.reduce((t, f) => t + Burako.valor(f), 0)}</b> puntos${v.pozo.some(Burako.esComodin) ? ` · trae ${v.pozo.filter(Burako.esComodin).length} comodín${v.pozo.filter(Burako.esComodin).length > 1 ? "es" : ""}` : ""}.</p>
        ${puedeLevantar ? `<div class="row"><button class="btn ghost" id="bkPozoNo">Mejor robo del mazo</button><button class="btn" id="bkLevantar">Levantar el pozo</button></div>` : `<button class="btn ghost" id="bkPozoNo">Cerrar</button>`}
      </div></div>` : "";
    const aviso = v.aviso && v.aviso.k >= v.mov - 1 ? `<div class="bk-aviso ${v.aviso.eq === miEq ? "nos" : "ellos"}" data-k="${v.aviso.k}">${esc(v.aviso.txt)}</div>` : "";
    app.innerHTML = `${opts.local ? head(0) : Net.cabecera()}<section class="screen burako">
      ${marcador}${rivales}${aviso}${mesa}${levTxt}
      ${estado ? `<p class="aj-estado bk-estado">${estado}${v.log.length && !miTurno ? ` <small>${esc(v.log[v.log.length - 1])}.</small>` : ""}</p>` : ""}
      ${cartel}${mano}${botones}
      <details class="panel"><summary class="label">Reglas rápidas</summary><p class="summary">Robás del mazo o levantás todo el pozo (las fichas tiradas); bajás juegos y tirás una ficha. <b>Escalera</b>: 3 o más seguidas del mismo color (el 1 va antes del 2 o después del 13). <b>Pierna</b>: 3 o más del mismo número. Un comodín por juego (★ y los 2). Con 7 fichas es <b>canasta</b>: limpia 200, sucia 100. Al quedarte sin fichas tomás el muerto. Para cerrar hay que haber tomado el muerto y tener una canasta: cerrar suma 100. Fichas: ★ 50, 2 → 20, 1 → 15, del 8 al 13 → 10, del 3 al 7 → 5. Lo de la mano resta.</p></details>
    </section>`;
    // La ventana del pozo va directo en la página (dentro de la pantalla se descoloca con la animación de entrada)
    document.querySelectorAll(".bk-pozo-fondo").forEach(x => x.remove());
    if (verPozo) document.body.insertAdjacentHTML("beforeend", verPozo);
    on("bkMazo", () => send({ t: "robar", de: "mazo" }));
    on("bkDesc", () => { U.verPozo = true; render(); });
    on("bkLevantar", () => { U.verPozo = false; send({ t: "robar", de: "descarte" }); });
    on("bkPozoNo", () => { U.verPozo = false; if (puedeLevantar && byId("bkLevantar")) send({ t: "robar", de: "mazo" }); else render(); });
    on("bkPozoX", () => { U.verPozo = false; render(); });
    const fondo = byId("bkPozoFondo"); if (fondo) fondo.onclick = e => { if (e.target === fondo) { U.verPozo = false; render(); } };
    app.querySelectorAll("[data-f]").forEach(el => {
      const f = () => { if (Date.now() < (U.sinClick || 0)) return; U.sug = null; const t = el.dataset.f; U.sel = U.sel.includes(t) ? U.sel.filter(x => x !== t) : [...U.sel, t]; if (typeof Sonido !== "undefined") Sonido.sfx("tap"); render(); };
      el.onclick = f; el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } };
    });
    app.querySelectorAll("[data-agregar]").forEach(b => b.onclick = () => {
      if (!U.sel.length) return;
      if (!acepta(+b.dataset.agregar)) return Toast.mostrar(`<div class="t-ic">🀄</div><div class="t-txt"><b>No entran en ese juego</b><span>Elegí fichas que sigan la escalera o del mismo número.</span></div>`, "info");
      const ids = U.sel; U.sel = []; send({ t: "agregar", ids, k: +b.dataset.agregar });
    });
    on("bkBajar", () => { const ids = U.sel; U.sel = []; send({ t: "bajar", ids }); });
    on("bkTirar", () => { const id = U.sel[0]; U.sel = []; send({ t: "tirar", id }); });
    on("bkLimpiar", () => { U.sel = []; render(); });
    on("bkSug", () => {
      const s = Burako.sugerir(v); if (!s) return;
      U.sug = { ...s, mov: v.mov }; if (s.ids) U.sel = s.ids.slice();
      if (typeof Sonido !== "undefined") Sonido.sfx("tap");
      render();
    });
    app.querySelectorAll("[data-bkorden]").forEach(b => b.onclick = () => {
      if (b.dataset.bkorden === "mano" && U.orden !== "mano") U.manual = enOrden.slice();     // arranca desde lo que se ve
      U.orden = b.dataset.bkorden; store.set("bkOrden", U.orden); render();
    });
    Burako.arrastrar(U, enOrden);
    on("bkSig", () => send({ t: "siguiente" }));
    on("bkOtra", () => send({ t: "again" }));
    on("bkSalir", () => opts.local ? go("home") : send({ t: "lobby" }));
  },

  /* Sugerencia para la persona (con lo que ve en su pantalla): qué robar, qué agregar, qué bajar o qué tirar */
  sugerir(v) {
    if (v.yo < 0) return null;
    const q = v.jug[v.yo].eq, mano = v.mano, mesa = v.mesa[q], muertoLibre = !v.muertoTomado[q];
    const puede = (k, m) => k >= 2 || muertoLibre || (v.muertoTomado[q] && (m || mesa).some(j => j.canasta));
    const f = t => Burako.ficha(t, "mini"), nombre = jg => jg.tipo === "esc" ? "escalera" : "pierna";
    if (v.fase === "robar") {
      if (!v.descarte) return { de: "mazo", txt: "Robá del mazo: el pozo está vacío." };
      const pozo = v.pozo, comodines = pozo.filter(Burako.esComodin).length;
      const aMesa = pozo.filter(t => mesa.some(j => Burako.analizar([...j.fichas, t])));
      const nuevo = Burako.buscarJuego([...mano, ...pozo]), usa = nuevo && nuevo.some(t => pozo.includes(t));
      const razones = [comodines ? `trae ${comodines} comodín${comodines > 1 ? "es" : ""}` : "", aMesa.length ? `${aMesa.length} ficha${aMesa.length > 1 ? "s" : ""} van a tus juegos` : "", usa ? "te arma un juego nuevo" : ""].filter(Boolean);
      if (razones.length) return { de: "descarte", txt: `Conviene levantar el pozo: ${razones.join(", ")}.` };
      return { de: "mazo", txt: pozo.length >= 6 ? "El pozo tiene muchas fichas pero no te arma nada: igual podés levantarlo para tener más opciones." : "Mejor robá del mazo: el pozo no te arma nada." };
    }
    if (v.fase !== "jugar") return null;
    // 1) Agregar a un juego propio (primero fichas naturales)
    const fichas = Burako.ordenar(mano).sort((a, b) => Burako.esComodin(a) - Burako.esComodin(b));
    for (let k = 0; k < mesa.length; k++) for (const t of fichas) {
      const j = mesa[k];
      if (Burako.esComodin(t) && (j.fichas.some(Burako.esComodin) || j.canasta && j.limpia)) continue;
      const nuevo = Burako.juego([...j.fichas, t]);
      if (nuevo && puede(mano.length - 1, mesa.map((x, kk) => kk === k ? nuevo : x)))
        return { ids: [t], k, txt: `Podés agregar ${f(t)} a tu ${nombre(j)}${nuevo.canasta && !j.canasta ? " y hacer <b>canasta</b>" : ""}: ya la elegí, tocá el juego que brilla.` };
    }
    // 2) Bajar un juego nuevo
    const ids = Burako.buscarJuego(mano);
    if (ids) {
      const jg = Burako.juego(ids);
      if (puede(mano.length - ids.length, [...mesa, jg])) return { ids, txt: `Podés bajar una ${nombre(jg)}: ${ids.map(f).join("")}. Ya la elegí, tocá <b>Bajar</b>.` };
      return { ids: [], txt: `Tenés una ${nombre(jg)} armada, pero si la bajás te quedás sin poder tirar. Guardala un turno más.` };
    }
    // 3) Qué tirar: la que menos sirve (y que no le sirva al otro equipo)
    const falsa = { jug: [{ mano }], mesa: [mesa, v.mesa[1 - q]] };
    const tira = mano.slice().sort((a, b) => Burako.util(falsa, 0, a) - Burako.util(falsa, 0, b) || Burako.valor(b) - Burako.valor(a))[0];
    if (!tira) return null;
    if (mano.length === 1 && !puede(0)) return { ids: [], txt: "Te queda una sola ficha y todavía no podés cerrar: necesitás una canasta." };
    return { ids: [tira], tirar: true, txt: `No tenés juegos para bajar. Te conviene tirar ${f(tira)}: es la que menos te sirve. Ya la elegí, tocá <b>Tirar</b>.` };
  },

  /* Acomodar la mano arrastrando: mantener apretada una ficha (o moverla un poco) y soltarla donde va */
  arrastrar(U, enOrden) {
    const caja = byId("bkMano"); if (!caja) return;
    let d = null;
    const soltar = () => { if (!d) return; clearTimeout(d.espera); U.arrastrando = false; if (d.fantasma) d.fantasma.remove(); caja.querySelectorAll(".antes, .despues, .arrastrando").forEach(x => x.classList.remove("antes", "despues", "arrastrando")); d = null; };
    U.soltar = soltar;
    const empezar = () => {
      if (!d || d.fantasma) return;
      if (!d.el.isConnected) return soltar();                    // la mano se redibujó mientras esperaba
      const r = d.el.getBoundingClientRect();
      d.fantasma = d.el.cloneNode(true); d.fantasma.className += " fantasma"; d.fantasma.removeAttribute("data-f"); d.fantasma.removeAttribute("data-mf");
      Object.assign(d.fantasma.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      document.body.appendChild(d.fantasma); d.el.classList.add("arrastrando"); U.arrastrando = true;
      try { navigator.vibrate && navigator.vibrate(15); } catch {}
    };
    caja.querySelectorAll("[data-mf]").forEach(el => {
      el.addEventListener("pointerdown", e => {
        if (e.button > 0) return;
        soltar(); d = { el, id: el.dataset.mf, x0: e.clientX, y0: e.clientY, pid: e.pointerId };
        d.espera = setTimeout(empezar, 260);
        try { el.setPointerCapture(e.pointerId); } catch {}
      });
      el.addEventListener("pointermove", e => {
        if (!d || d.pid !== e.pointerId) return;
        if (!d.fantasma && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 10) empezar();
        if (!d.fantasma) return;
        e.preventDefault();
        const r = d.el.getBoundingClientRect();
        d.fantasma.style.transform = `translate(${e.clientX - d.x0}px, ${e.clientY - d.y0}px) scale(1.12)`;
        const bajo = document.elementFromPoint(e.clientX, e.clientY), obj = bajo && bajo.closest("#bkMano [data-mf]");
        caja.querySelectorAll(".antes, .despues").forEach(x => x.classList.remove("antes", "despues"));
        d.destino = null;
        if (obj && obj !== d.el) { const ro = obj.getBoundingClientRect(), antes = e.clientX < ro.left + ro.width / 2; obj.classList.add(antes ? "antes" : "despues"); d.destino = { id: obj.dataset.mf, antes }; }
        void r;
      });
      const fin = e => {
        if (!d || d.pid !== e.pointerId) return;
        const hubo = !!d.fantasma, destino = d.destino, id = d.id;
        soltar();
        if (!hubo) return;
        U.sinClick = Date.now() + 350;                          // que soltar no cuente como tocar la ficha
        if (!destino) { if (U.pendiente) { U.pendiente = false; render(); } return; }
        U.pendiente = false;
        const lista = enOrden.filter(t => t !== id), k = lista.indexOf(destino.id);
        lista.splice(destino.antes ? k : k + 1, 0, id);
        U.manual = lista; U.orden = "mano"; store.set("bkOrden", "mano");
        if (typeof Sonido !== "undefined") Sonido.sfx("pieza");
        render();
      };
      el.addEventListener("pointerup", fin); el.addEventListener("pointercancel", fin);
      el.addEventListener("contextmenu", e => e.preventDefault());
    });
  },

  /* Si una jugada no vale, el motor la ignora: le avisamos a la persona por qué */
  explicar(s, i, a, antes) {
    if (s.mov !== antes || s.jug[i].cpu) return;
    const J = s.jug[i], q = Burako.equipo(s, i);
    let txt = "Esa jugada no vale.";
    if (a.t === "tirar" && J.mano.length === 1) txt = s.muertoTomado[q] ? "Para cerrar necesitás al menos una canasta." : "No podés quedarte sin fichas así.";
    else if (a.t === "bajar" || a.t === "agregar") txt = "Así te quedarías sin poder tirar: para cerrar hace falta el muerto tomado y una canasta.";
    Toast.mostrar(`<div class="t-ic">🀄</div><div class="t-txt"><b>No se puede</b><span>${esc(txt)}</span></div>`, "info");
  },

  /* ---------- Un teléfono ---------- */
  asientos(personas, total, juntos) {
    const orden = juntos ? [0, 2, 1, 3].filter(x => x < total) : [...Array(total).keys()];
    const sillas = Array(total).fill(null);
    personas.slice(0, total).forEach((p, k) => sillas[orden[k]] = p);
    let c = 0;
    return sillas.map((p, i) => p || { id: "c" + i, name: BK.CPU[c++ % BK.CPU.length], cpu: true });
  },
  empezarLocal(jug) { S.bk = Burako.setup(jug, S.bkCfg); UI.bk = null; UI.bkVisto = null; UI.bkPens = null; go("burako"); },
  empezarOn(R) {
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name }));
    if (jug.length > 4) return "El burako es de 2 o 4 jugadores.";
    const total = jug.length > 2 || S.bkCfg.n === 4 ? 4 : 2;
    R.bk = Burako.setup(Burako.asientos(jug, total, S.bkCfg.juntos), S.bkCfg);
    R.game = "burako";
    Burako.programarHost(R);
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") R.bk = Burako.setup(R.bk.jug.map(j => ({ id: j.id, name: j.name, cpu: j.cpu })), R.bk.cfg);
    else if (a.t === "lobby" && pid === "H") { R.game = null; R.bk = null; return; }
    else if (a.t === "siguiente") { if (pid === "H") Burako.act(R.bk, pid, a); }
    else Burako.act(R.bk, pid, a);
    Burako.programarHost(R);
  },
  timer: null,
  programarHost(R) {
    const s = R.bk;
    if (!s || (s.fase !== "robar" && s.fase !== "jugar") || !s.jug[s.turno].cpu || Burako.timer === s.id + s.mov) return;
    Burako.timer = s.id + s.mov;
    setTimeout(() => {
      if (R.bk !== s || R.game !== "burako" || Burako.timer !== s.id + s.mov) return;
      Burako.jugarCompu(s); Burako.timer = null;
      Net.broadcast(); Burako.programarHost(R);
    }, 750 + Math.random() * 400);
  }
};

PANTALLAS.burako = () => {
  const s = S.bk;
  if (!s) return go("home");
  const humanos = s.jug.map((j, i) => j.cpu ? -1 : i).filter(i => i >= 0);
  const enJuego = s.fase === "robar" || s.fase === "jugar", act = enJuego ? s.turno : -1;
  if (humanos.length > 1 && act >= 0 && !s.jug[act].cpu && UI.bkVisto !== act) {
    app.innerHTML = `${head(0)}<section class="stage passto"><p class="sub">${esc(s.log[s.log.length - 1] || `Mano ${s.ronda}`)}</p>
      <div class="pass-art">${personaje(colorDe(s.jug[act].name), "duda", 110)}</div>
      <p class="label" style="margin:0">Pásale el teléfono a</p><div class="who">${esc(s.jug[act].name)}</div>
      <button class="btn" id="bkSoy">Soy ${esc(s.jug[act].name)}, ver mis fichas</button></section>`;
    on("bkSoy", () => { UI.bkVisto = act; render(); });
    return;
  }
  const yo = humanos.length === 1 ? humanos[0] : act >= 0 && !s.jug[act].cpu ? act : UI.bkVisto ?? humanos[0];
  Burako.render(Burako.view(s, s.jug[yo].id), a => {
    if (a.t === "again") return Burako.empezarLocal(s.jug.map(j => ({ id: j.id, name: j.name, cpu: j.cpu })));
    const antes = s.mov;
    Burako.act(s, s.jug[yo].id, a);
    if (a.t !== "siguiente") Burako.explicar(s, yo, a, antes);
    render();
  }, { local: true });
  if (act >= 0 && s.jug[act].cpu && UI.bkPens !== s.id + s.mov) {
    const k = UI.bkPens = s.id + s.mov;
    setTimeout(() => { if (S.screen !== "burako" || S.bk !== s || UI.bkPens !== k) return; Burako.jugarCompu(s); render(); }, 700 + Math.random() * 400);
  }
};
