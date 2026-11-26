/* Golpe: robo en la ciudad, visto desde arriba (estilo "extraction shooter").
   - Todos entran a la ciudad como 🧍 CIVIL: no puede robar ni tiene armas. Desde ahí elige su camino:
     con un botón se vuelve 🦹 LADRÓN (puede atacar a cualquiera y quedarse con lo que lleva), o va a la comisaría
     y se hace 👮 POLICÍA (solo puede herir ladrones: al bajarlos los arresta y confisca lo robado).
   - Solo el ladrón ve su inventario. El policía no: al terminar su turno (en una salida o cuando se acaba el
     tiempo) cobra un sueldo, una parte de lo confiscado y se queda con algunos de los ítems incautados.
   - La ciudad sale de una semilla: manzanas con casas, kioscos, farmacias, depósito, joyería, banco, museo,
     comisaría y plazas. Adentro de los edificios hay artefactos de distinta rareza y valor, armas, chalecos y botiquines.
   - Para quedarte con lo robado hay que llegar a una SALIDA y aguantar unos segundos adentro. Si te matan, lo que
     llevabas queda tirado; si te arresta la policía, se lo queda la policía. Lo que sacás se guarda en tu botín.
   - Armas en 5 rarezas (común → legendaria): la rareza sube el daño y la PENETRACIÓN. Los chalecos (nivel 1 a 3)
     frenan parte del daño, pero una bala de mucha penetración atraviesa el chaleco.
   - Online, el teléfono del anfitrión es el SERVIDOR: los demás solo mandan hacia dónde se mueven, apuntan y si
     disparan. El anfitrión calcula todo (movimiento, balas, daño) y a cada teléfono le manda solo lo que ve
     (nadie recibe la posición de alguien escondido adentro de otro edificio). Así no sirve trucar el teléfono.
   - Con bots: ladrones, policías y civiles que recorren la ciudad. Cuando muere uno, al rato entra otro. */
const GP = {
  T: 40, N: 64, R: 14, VISION: 560, DURACION: 600, ELECCION: 12, VEL: 175, ESCAPE: 4, SALIDA_R: 70,
  RAR: [["Común", "#adb5bd"], ["Poco común", "#51cf66"], ["Rara", "#4dabf7"], ["Épica", "#cc5de8"], ["Legendaria", "#ffd43b"]],
  MULT: [1, 2, 4, 8, 16],
  ROLES: {
    ladron: { n: "Ladrón", ic: "🦹", color: "#ff4d63", desc: "Robá todo lo que puedas. Podés atacar a cualquiera y quedarte con lo que lleva." },
    policia: { n: "Policía", ic: "👮", color: "#4dabf7", desc: "Solo podés herir ladrones. Al bajarlos los arrestás y confiscás lo robado." },
    civil: { n: "Civil", ic: "🧍", color: "#e9ecef", desc: "Así entrás a la ciudad: sin armas y sin poder robar. Elegí tu camino." }
  },
  // dmg: daño por bala · cad: segundos entre tiros · disp: dispersión · alc: alcance · bal: balas por tiro
  ARMAS: {
    pistola: { n: "Pistola", dmg: 17, cad: 0.36, disp: 0.06, alc: 540, vel: 1050, bal: 1 },
    subfusil: { n: "Subfusil", dmg: 10, cad: 0.1, disp: 0.13, alc: 470, vel: 1050, bal: 1 },
    escopeta: { n: "Escopeta", dmg: 11, cad: 0.85, disp: 0.3, alc: 300, vel: 950, bal: 6 },
    rifle: { n: "Rifle", dmg: 32, cad: 0.6, disp: 0.02, alc: 820, vel: 1400, bal: 1 }
  },
  CHALECO: [0, 0.25, 0.4, 0.55],
  ART: [["Celular", "📱", 40], ["Reloj", "⌚", 60], ["Billetes", "💵", 80], ["Cámara", "📷", 70], ["Notebook", "💻", 90], ["Consola", "🎮", 100],
    ["Anillo", "💍", 120], ["Collar", "📿", 150], ["Estatuilla", "🗿", 160], ["Cuadro", "🖼️", 180], ["Lingote", "🧈", 200], ["Diamante", "💎", 300]],
  // tier: qué tan buena es la rareza de lo que hay adentro · piso/techo: colores
  EDIF: {
    casa: { n: "Casa", ic: "🏠", tier: 0, piso: "#b89572", techo: "#9c4f3c", cosas: [3, 5] },
    kiosco: { n: "Kiosco", ic: "🏪", tier: 0, piso: "#c7b28a", techo: "#c2721f", cosas: [3, 5] },
    farmacia: { n: "Farmacia", ic: "💊", tier: 1, piso: "#cfe3dc", techo: "#2b8a3e", cosas: [3, 5], curas: 3 },
    deposito: { n: "Depósito", ic: "📦", tier: 1, piso: "#8d8a80", techo: "#5c5f66", cosas: [4, 6], armas: 2 },
    joyeria: { n: "Joyería", ic: "💍", tier: 2, piso: "#e6dcc8", techo: "#9c36b5", cosas: [5, 7] },
    banco: { n: "Banco", ic: "🏦", tier: 3, piso: "#d9d2c1", techo: "#2f3b52", cosas: [6, 8], armas: 1 },
    museo: { n: "Museo", ic: "🏛️", tier: 3, piso: "#e9e4d8", techo: "#7c6a4f", cosas: [5, 7] },
    comisaria: { n: "Comisaría", ic: "🚓", tier: 1, piso: "#c3cfe0", techo: "#1c4f8c", cosas: [0, 0], armas: 3, chalecos: 2 }
  },
  NOMBRES: {
    ladron: ["Rata", "Chueco", "Facha", "Tano", "Pelado", "Tuerca", "Gato", "Zurdo", "Mosca", "Cabezón", "Flaco", "Ruso"],
    policia: ["Oficial Díaz", "Sargento Paz", "Cabo Ríos", "Oficial Luna", "Agente Vera", "Cabo Soto", "Oficial Ruiz"],
    civil: ["Doña Rosa", "Kevin", "Marta", "Don Julio", "Yesi", "Beto", "Lili", "Ramón", "Nati", "Coco", "Pocho"]
  },
  SUELDO: 150, PARTE: 0.3, QUEDA: 2,   // policía: sueldo del turno, parte de lo confiscado y cuántos ítems incautados se lleva
  DENS: { pocos: [4, 3, 5], normal: [6, 4, 7], muchos: [9, 6, 9] }   // ladrones, policías, civiles (bots)
};

const Golpe = {
  clave: "golpe", nombre: "Golpe", boton: "🦹 ¡A la ciudad!",
  descripcion: "Robo en la ciudad: ladrones, policías y civiles. Juntá artefactos raros, sobreviví y llegá a la salida con el botín.",
  cfg() { return Turnero.cfg("golpe", { dens: "normal", rol: "ladron", nivel: "normal" }); },
  arte() { return Golpe.svg(); },
  lobbyInfo: ["Golpe", "🦹", "1 a 8"],
  lobby(v, H) {
    const c = v.exCfg.golpe;
    return `<p class="summary">Todos entran como 🧍 civiles. Adentro, cada uno se vuelve 🦹 ladrón con un botón o va a la comisaría a hacerse 👮 policía. Los del mismo rol son equipo. Los ladrones tienen que llegar a una salida con el botín; los policías cobran al terminar el turno.</p>
      ${H ? `<span class="label">Gente en la ciudad</span><div class="seg">${[["pocos", "Poca"], ["normal", "Normal"], ["muchos", "Mucha"]].map(([k, t]) => `<button aria-pressed="${c.dens === k}" data-exopc="golpe:dens:${k}">${t}</button>`).join("")}</div>
      <div class="seg">${[["facil", "Bots fáciles"], ["normal", "Normales"], ["dificil", "Difíciles"]].map(([k, t]) => `<button aria-pressed="${c.nivel === k}" data-exniv="golpe:${k}">${t}</button>`).join("")}</div>` : ""}`;
  },

  azar(semilla) { let a = semilla >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },

  /* ---------- La ciudad ----------
     Casillas: 0 calle · 1 vereda · 2 pared · 3 piso de edificio · 4 pasto · 5 árbol · 6 límite de la ciudad.
     4×4 manzanas de 12 casillas con calles de 3. Cada edificio tiene paredes, 1 o 2 puertas y a veces una pared adentro. */
  mapa(semilla) {
    const r = Golpe.azar(semilla), N = GP.N, t = new Uint8Array(N * N), b = new Uint8Array(N * N), ed = [null];
    const set = (x, y, v, id) => { if (x < 0 || y < 0 || x >= N || y >= N) return; t[y * N + x] = v; if (id !== undefined) b[y * N + x] = id; };
    for (let i = 0; i < N; i++) { set(i, 0, 6); set(i, N - 1, 6); set(0, i, 6); set(N - 1, i, 6); }
    const tipos = ["banco", "joyeria", "museo", "comisaria", "plaza", "plaza", "farmacia", "kiosco", "deposito", "casa", "casa", "casa", "casa", "kiosco", "casa", "farmacia"];
    for (let i = tipos.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [tipos[i], tipos[j]] = [tipos[j], tipos[i]]; }
    let k = 0;
    for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
      const x0 = 3 + bx * 15, y0 = 3 + by * 15, tipo = tipos[k++];
      for (let y = y0; y < y0 + 12; y++) for (let x = x0; x < x0 + 12; x++) set(x, y, 1);
      if (tipo === "plaza") {
        for (let y = y0 + 1; y < y0 + 11; y++) for (let x = x0 + 1; x < x0 + 11; x++) set(x, y, 4);
        for (let n = 0; n < 9; n++) { const x = x0 + 2 + Math.floor(r() * 8), y = y0 + 2 + Math.floor(r() * 8); if ((x + y) % 2) set(x, y, 5); }
        continue;
      }
      const id = ed.length, E = { id, tipo, x0: x0 + 1, y0: y0 + 1, x1: x0 + 10, y1: y0 + 10 };
      ed.push(E);
      for (let y = y0 + 1; y <= y0 + 10; y++) for (let x = x0 + 1; x <= x0 + 10; x++) {
        const borde = x === x0 + 1 || x === x0 + 10 || y === y0 + 1 || y === y0 + 10;
        set(x, y, borde ? 2 : 3, id);
      }
      // Puertas (2 casillas de ancho) en uno o dos lados
      const lados = [0, 1, 2, 3].sort(() => r() - 0.5).slice(0, 1 + (r() < 0.6 ? 1 : 0));
      const m = 5 + Math.floor(r() * 2) - 1;
      for (const l of lados) for (let d = 0; d < 2; d++) {
        if (l === 0) set(x0 + 1 + m + d, y0 + 1, 3, id); if (l === 1) set(x0 + 1 + m + d, y0 + 10, 3, id);
        if (l === 2) set(x0 + 1, y0 + 1 + m + d, 3, id); if (l === 3) set(x0 + 10, y0 + 1 + m + d, 3, id);
      }
      E.puertas = lados;
      // Pared interna con un hueco
      if (GP.EDIF[tipo].tier >= 1 || r() < 0.5) {
        const vert = r() < 0.5, p = 5 + Math.floor(r() * 2), hueco = 3 + Math.floor(r() * 4);
        for (let q = 2; q <= 9; q++) if (q !== hueco && q !== hueco + 1) vert ? set(x0 + p, y0 + q, 2, id) : set(x0 + q, y0 + p, 2, id);
      }
    }
    // Salidas: en las calles del borde, entre manzanas. Se eligen 3 en lados distintos.
    const cand = [];
    for (const kk of [1, 2, 3]) {
      const c = (kk * 15 + 1.5) * GP.T;
      cand.push({ x: 2 * GP.T, y: c, lado: 0 }, { x: (N - 2) * GP.T, y: c, lado: 1 }, { x: c, y: 2 * GP.T, lado: 2 }, { x: c, y: (N - 2) * GP.T, lado: 3 });
    }
    const salidas = [], usados = new Set();
    while (salidas.length < 3) { const c = cand[Math.floor(r() * cand.length)]; if (usados.has(c.lado)) continue; usados.add(c.lado); salidas.push({ x: c.x, y: c.y }); }
    return { t, b, ed, salidas, semilla };
  },
  solido(M, x, y) { const N = GP.N; if (x < 0 || y < 0 || x >= N || y >= N) return true; const v = M.t[y * N + x]; return v === 2 || v === 5 || v === 6; },
  casilla(M, px, py) { return [Math.floor(px / GP.T), Math.floor(py / GP.T)]; },
  edificioEn(M, px, py) { const [x, y] = Golpe.casilla(M, px, py); if (x < 0 || y < 0 || x >= GP.N || y >= GP.N) return 0; return M.t[y * GP.N + x] === 3 ? M.b[y * GP.N + x] : 0; },
  libre(M, x, y, r) {
    const T = GP.T, x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (Golpe.solido(M, tx, ty)) return false;
    return true;
  },
  /* Mueve un círculo chocando contra las paredes (eje por eje, así se desliza por las paredes) */
  mover(M, o, dx, dy) {
    const r = GP.R;
    if (dx && Golpe.libre(M, o.x + dx, o.y, r)) o.x += dx;
    if (dy && Golpe.libre(M, o.x, o.y + dy, r)) o.y += dy;
  },
  /* ¿Se ven? (las paredes y los árboles tapan) */
  linea(M, x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 14);
    for (let i = 1; i < n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n; if (Golpe.solido(M, Math.floor(x / GP.T), Math.floor(y / GP.T))) return false; }
    return true;
  },
  /* Camino por la grilla (búsqueda a lo ancho). Devuelve casillas a recorrer o null. */
  camino(M, ax, ay, bx, by) {
    const N = GP.N, ini = ay * N + ax, fin = by * N + bx;
    if (Golpe.solido(M, bx, by) || ini === fin) return ini === fin ? [] : null;
    const prev = new Int32Array(N * N).fill(-1), cola = new Int32Array(N * N); let h = 0, q = 0;
    cola[q++] = ini; prev[ini] = ini;
    while (h < q) {
      const c = cola[h++]; if (c === fin) break;
      const x = c % N, y = (c / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, n = ny * N + nx;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || prev[n] !== -1 || Golpe.solido(M, nx, ny)) continue;
        prev[n] = c; cola[q++] = n;
      }
    }
    if (prev[fin] === -1) return null;
    const out = []; for (let c = fin; c !== ini; c = prev[c]) out.push([c % N, (c / N) | 0]);
    return out.reverse();
  },
  pisoAzar(M, r, E) { for (let i = 0; i < 80; i++) { const x = E.x0 + 1 + Math.floor(r() * (E.x1 - E.x0 - 1)), y = E.y0 + 1 + Math.floor(r() * (E.y1 - E.y0 - 1)); if (M.t[y * GP.N + x] === 3) return [x, y]; } return [E.x0 + 1, E.y0 + 1]; },
  calleAzar(M, r) { for (let i = 0; i < 200; i++) { const x = 1 + Math.floor(r() * (GP.N - 2)), y = 1 + Math.floor(r() * (GP.N - 2)); const v = M.t[y * GP.N + x]; if (v === 0 || v === 1) return [x, y]; } return [2, 2]; },
  /* Punto de entrada a la ciudad: en una calle del borde, lejos de quienes ya están */
  entrada(s, lejosDe) {
    const N = GP.N, T = GP.T;
    for (let i = 0; i < 40; i++) {
      const lado = Math.floor(Math.random() * 4), a = 2 + Math.floor(Math.random() * (N - 4));
      const [x, y] = lado === 0 ? [1.5, a] : lado === 1 ? [N - 2.5, a] : lado === 2 ? [a, 1.5] : [a, N - 2.5];
      if (Golpe.solido(s.M, Math.floor(x), Math.floor(y))) continue;
      const px = (x + 0.5) * T, py = (y + 0.5) * T;
      if (!Golpe.libre(s.M, px, py, GP.R)) continue;
      if (lejosDe && lejosDe.some(o => Math.hypot(o.x - px, o.y - py) < 650)) continue;
      return { x: px, y: py };
    }
    return { x: 2 * T, y: 2 * T };
  },

  /* ---------- Cosas tiradas ---------- */
  rareza(tier) { const p = Math.random() * 100; let r = p < 55 ? 0 : p < 82 ? 1 : p < 94 ? 2 : p < 99 ? 3 : 4; for (let i = 0; i < tier; i++) if (Math.random() < 0.42) r = Math.min(4, r + 1); return r; },
  artefacto(tier) { const a = Math.min(GP.ART.length - 1, Math.floor(Math.random() * (GP.ART.length - 4 + tier * 2))), r = Golpe.rareza(tier); return { k: "art", a, r, v: Math.round(GP.ART[a][2] * GP.MULT[r] * (0.85 + Math.random() * 0.3) / 10) * 10 }; },
  armaAzar(tier) { const tipos = ["pistola", "subfusil", "escopeta", "rifle"]; return { k: "arma", a: tipos[Math.floor(Math.random() * tipos.length)], r: Golpe.rareza(tier) }; },
  soltar(s, it, x, y) { const a = Math.random() * 6.28, d = 10 + Math.random() * 22; it.id = ++s.nId; it.x = x + Math.cos(a) * d; it.y = y + Math.sin(a) * d; if (!Golpe.libre(s.M, it.x, it.y, 4)) { it.x = x; it.y = y; } s.items.push(it); },
  llenar(s) {
    const M = s.M, T = GP.T;
    for (const E of M.ed.slice(1)) {
      const D = GP.EDIF[E.tipo], poner = it => { const [x, y] = Golpe.pisoAzar(M, Math.random, E); Golpe.soltar(s, it, (x + 0.5) * T, (y + 0.5) * T); };
      const n = D.cosas[0] + Math.floor(Math.random() * (D.cosas[1] - D.cosas[0] + 1));
      for (let i = 0; i < n; i++) poner(Golpe.artefacto(D.tier));
      for (let i = 0; i < (D.armas || (Math.random() < 0.45 ? 1 : 0)); i++) poner(Golpe.armaAzar(D.tier));
      for (let i = 0; i < (D.chalecos || (Math.random() < 0.25 ? 1 : 0)); i++) poner({ k: "chaleco", n: Math.min(3, 1 + (Golpe.rareza(D.tier) >> 1)) });
      for (let i = 0; i < (D.curas || (Math.random() < 0.4 ? 1 : 0)); i++) poner({ k: "cura" });
    }
  },
  valor(J) { return J.moch.reduce((a, it) => a + (it.v || 0), 0); },
  puntajeArma(a) { if (!a) return 0; const W = GP.ARMAS[a.a]; return W.dmg * W.bal / W.cad * (1 + 0.15 * a.r) + a.r * 25; },

  /* ---------- Jugadores ---------- */
  armar(J, rol) {
    J.rol = rol; J.hp = J.hpMax = rol === "policia" ? 120 : 100; J.moch = []; J.cupo = 8; J.est = "vivo"; J.ext = 0; J.cd = 0; J.ang = 0;
    J.arma = rol === "civil" ? null : rol === "policia" ? { a: "pistola", r: 1 } : { a: "pistola", r: 0 };
    J.chaleco = rol === "policia" ? 2 : rol === "ladron" ? 1 : 0; J.cura = rol === "policia" ? 2 : 1;
    J.incaut = []; J.premio = null;
    J.team = J.cpu ? (rol === "policia" ? "pol" : J.id) : rol === "policia" ? "pol" : "h-" + rol;
    J.in = { mx: 0, my: 0, ax: 0, ay: 0, f: false };
  },
  bot(s, rol) {
    const nombres = GP.NOMBRES[rol], usados = new Set(s.jug.map(j => j.name));
    let name = nombres.find(n => !usados.has(n)) || nombres[Math.floor(Math.random() * nombres.length)] + " " + (2 + Math.floor(Math.random() * 8));
    const J = { id: "b" + (++s.nBot), name, cpu: true, nivel: s.nivel, look: { color: COLORES[Math.floor(Math.random() * COLORES.length)], acc: [] }, kills: 0, arrestos: 0, confis: 0 };
    Golpe.armar(J, rol);
    const p = rol === "policia" ? Golpe.enComisaria(s) : Golpe.entrada(s, s.jug.filter(j => !j.cpu && j.est === "vivo"));
    J.x = p.x; J.y = p.y; J.bldg = Golpe.edificioEn(s.M, J.x, J.y); J.nace = s.t;
    s.jug.push(J);
    return J;
  },
  enComisaria(s) {
    const E = s.M.ed.find(e => e && e.tipo === "comisaria"), T = GP.T;
    for (let i = 0; i < 30; i++) { const [x, y] = Golpe.pisoAzar(s.M, Math.random, E); const px = (x + 0.5) * T, py = (y + 0.5) * T; if (Golpe.libre(s.M, px, py, GP.R)) return { x: px, y: py }; }
    return { x: (E.x0 + 2) * T, y: (E.y0 + 2) * T };
  },

  /* ---------- Partida ---------- */
  crear(humanos, cfg) {
    const semilla = Math.floor(Math.random() * 1e9);
    const s = { id: Turnero.nuevoId("gp"), semilla, M: Golpe.mapa(semilla), fase: "juego", t: -3, mov: 0, local: !!cfg.local,
      nivel: cfg.nivel || "normal", dens: GP.DENS[cfg.dens] ? cfg.dens : "normal", jug: [], items: [], balas: [], feed: [], hits: [], nId: 0, nBot: 0, respawn: [] };
    for (const h of humanos) s.jug.push({ ...h, cpu: false, kills: 0, arrestos: 0, confis: 0, rol: "civil" });
    Golpe.llenar(s);
    Golpe.arrancar(s);
    return s;
  },
  /* Ubica a las personas (todas entran juntas como civiles, por el mismo lado) y llena la ciudad de bots */
  arrancar(s) {
    const humanos = s.jug.filter(j => !j.cpu), g = Golpe.entrada(s, []);
    for (const J of humanos) {
      Golpe.armar(J, "civil");
      let p = { x: g.x + (Math.random() - 0.5) * 34, y: g.y + (Math.random() - 0.5) * 34 }; if (!Golpe.libre(s.M, p.x, p.y, GP.R)) p = { x: g.x, y: g.y };
      J.x = p.x; J.y = p.y; J.bldg = Golpe.edificioEn(s.M, J.x, J.y); J.prot = 10;   // unos segundos sin que te puedan herir al entrar
    }
    const [nl, np, nc] = GP.DENS[s.dens];
    for (let i = 0; i < nl; i++) Golpe.bot(s, "ladron");
    for (let i = 0; i < np; i++) Golpe.bot(s, "policia");
    for (let i = 0; i < nc; i++) Golpe.bot(s, "civil");
  },
  /* El civil elige su camino: ladrón (en cualquier lado) o policía (adentro de la comisaría). No hay vuelta atrás. */
  convertir(s, J, rol) {
    if (J.est !== "vivo" || J.rol !== "civil") return;
    if (rol === "policia" && !(J.bldg && s.M.ed[J.bldg].tipo === "comisaria")) return;
    const { x, y, cura } = J;
    Golpe.armar(J, rol); J.x = x; J.y = y; J.cura = Math.max(J.cura, cura);
    J.cambio = s.t;
    if (rol === "policia") Golpe.aviso(s, `👮 ${J.name} se unió a la policía`);
  },
  /* Fin del turno de un policía: sueldo + una parte de lo confiscado + algunos ítems incautados */
  cerrarTurno(J) {
    if (J.rol !== "policia" || J.premio != null) return;
    const items = J.incaut.slice().sort(() => Math.random() - 0.5).slice(0, GP.QUEDA);
    J.premioItems = items;
    J.premio = GP.SUELDO + Math.round(J.confis * GP.PARTE / 10) * 10 + items.reduce((a, it) => a + (it.v || 0), 0);
  },
  aviso(s, txt) { s.feed.push({ txt, t: s.t }); if (s.feed.length > 6) s.feed.shift(); },

  tick(s, dt) {
    if (s.fase === "fin") return;
    s.t += dt;
    if (s.fase === "rol") { if (s.t >= -3) { Golpe.arrancar(s); s.fase = "juego"; s.mov++; } return; }
    if (s.t < 0) return;
    const M = s.M;
    for (const J of s.jug) {
      if (J.est !== "vivo") continue;
      if (J.cpu) Golpe.pensar(s, J, dt);
      const I = J.in;
      let mx = I.mx, my = I.my; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
      const vel = GP.VEL * (J.rol === "civil" ? 1.15 : 1) * (J.moch.length > 5 ? 0.93 : 1);
      Golpe.mover(M, J, mx * vel * dt, my * vel * dt);
      if (Math.hypot(I.ax, I.ay) > 0.25) J.ang = Math.atan2(I.ay, I.ax); else if (m > 0.2) J.ang = Math.atan2(my, mx);
      J.cd -= dt; if (J.prot > 0) J.prot -= dt;
      if (I.f && J.arma && J.rol !== "civil" && J.cd <= 0) Golpe.disparar(s, J);
      J.bldg = Golpe.edificioEn(M, J.x, J.y);
      Golpe.juntar(s, J);
      // Salida: hay que aguantar adentro unos segundos
      if (s.M.salidas.some(o => Math.hypot(o.x - J.x, o.y - J.y) < GP.SALIDA_R) && (J.rol !== "policia" || !J.cpu)) {
        J.ext += dt;
        if (J.ext >= GP.ESCAPE) {
          J.est = "escapo"; J.fin = s.t;
          if (J.rol === "policia") { Golpe.cerrarTurno(J); Golpe.aviso(s, `👮 ${J.name} terminó su turno`); }
          else { const v = Golpe.valor(J); Golpe.aviso(s, `🚪 ${J.name} escapó${v ? ` con $${v}` : ""}`); }
          if (J.cpu) s.respawn.push({ rol: J.rol, t: s.t + 15 });
        }
      } else J.ext = 0;
    }
    Golpe.balas(s, dt);
    s.hits = s.hits.filter(h => s.t - h.t < 0.7);
    // Entran bots nuevos para que la ciudad no se vacíe
    for (const r of s.respawn.slice()) if (s.t >= r.t && s.t < GP.DURACION - 40) { s.respawn.splice(s.respawn.indexOf(r), 1); Golpe.bot(s, r.rol); }
    // Se van sacando de la lista los bots que ya no están (para que no crezca sin fin)
    if (s.jug.length > 60) s.jug = s.jug.filter(j => !j.cpu || j.est === "vivo" || s.t - (j.fin || 0) < 30);
    const humanos = s.jug.filter(j => !j.cpu);
    if (humanos.every(j => j.est !== "vivo")) { s.cierre = s.cierre ?? s.t + 2.5; if (s.t >= s.cierre) Golpe.terminar(s); }
    else if (s.t >= GP.DURACION) Golpe.terminar(s);
  },
  terminar(s) {
    if (s.fase === "fin") return;
    // Se acabó el tiempo: los policías completaron su turno; ladrones y civiles que no salieron pierden lo que llevaban
    for (const J of s.jug) if (!J.cpu && J.est === "vivo") { J.est = "tiempo"; J.fin = s.t; if (J.rol === "policia") Golpe.cerrarTurno(J); else J.moch = []; }
    Golpe.ordenar(s); s.fase = "fin"; s.mov++;
  },
  puntaje(J) { return J.rol === "policia" ? J.premio || 0 : J.est === "escapo" ? Golpe.valor(J) : 0; },
  ordenar(s) { s.jug.filter(j => !j.cpu).sort((a, b) => Golpe.puntaje(b) - Golpe.puntaje(a) || b.kills - a.kills).forEach((j, k) => j.puesto = k + 1); },

  juntar(s, J) {
    for (let i = s.items.length - 1; i >= 0; i--) {
      const it = s.items[i]; if (Math.hypot(it.x - J.x, it.y - J.y) > 28) continue;
      if (it.k === "art" && J.rol === "ladron" && J.moch.length < J.cupo) { J.moch.push({ k: "art", a: it.a, r: it.r, v: it.v }); s.items.splice(i, 1); J.junto = s.t; }
      else if (it.k === "cura" && J.cura < 3) { J.cura++; s.items.splice(i, 1); J.junto = s.t; }
      else if (it.k === "chaleco" && it.n > J.chaleco) { const viejo = J.chaleco; J.chaleco = it.n; s.items.splice(i, 1); if (viejo) Golpe.soltar(s, { k: "chaleco", n: viejo }, J.x, J.y); J.junto = s.t; }
      else if (it.k === "arma" && !J.arma && J.rol !== "civil") { J.arma = { a: it.a, r: it.r }; s.items.splice(i, 1); J.junto = s.t; }
    }
  },
  /* Cambiar el arma por la que está en el piso (botón "Agarrar") */
  agarrar(s, J) {
    if (J.rol === "civil") return;
    const it = s.items.filter(it => it.k === "arma" && Math.hypot(it.x - J.x, it.y - J.y) < 42).sort((a, b) => Math.hypot(a.x - J.x, a.y - J.y) - Math.hypot(b.x - J.x, b.y - J.y))[0];
    if (!it) return;
    s.items.splice(s.items.indexOf(it), 1);
    if (J.arma) Golpe.soltar(s, { k: "arma", a: J.arma.a, r: J.arma.r }, J.x, J.y);
    J.arma = { a: it.a, r: it.r }; J.cd = 0.3;
  },
  curar(s, J) { if (J.cura > 0 && J.hp < J.hpMax && J.est === "vivo") { J.cura--; J.hp = Math.min(J.hpMax, J.hp + 50); J.curo = s.t; } },

  disparar(s, J) {
    const W = GP.ARMAS[J.arma.a], r = J.arma.r;
    for (let i = 0; i < W.bal; i++) {
      const a = J.ang + Turnero.gauss() * W.disp * (1 - 0.08 * r), cx = J.x + Math.cos(J.ang) * 18, cy = J.y + Math.sin(J.ang) * 18;
      if (!Golpe.libre(s.M, cx, cy, 2)) continue;
      s.balas.push({ id: ++s.nId, x: cx, y: cy, vx: Math.cos(a) * W.vel, vy: Math.sin(a) * W.vel, dmg: W.dmg * (1 + 0.15 * r), pen: r, de: J.id, rol: J.rol, team: J.team, d: 0, alc: W.alc });
    }
    J.cd = W.cad * (1 - 0.05 * r); J.tiro = s.t;
  },
  puedeHerir(b, q) {
    if (q.est !== "vivo" || q.id === b.de || q.prot > 0) return false;
    if (b.rol === "policia") return q.rol === "ladron";
    return q.team !== b.team;
  },
  balas(s, dt) {
    const M = s.M;
    for (let i = s.balas.length - 1; i >= 0; i--) {
      const b = s.balas[i], pasos = 4; let fuera = false;
      for (let k = 0; k < pasos && !fuera; k++) {
        b.x += b.vx * dt / pasos; b.y += b.vy * dt / pasos; b.d += Math.hypot(b.vx, b.vy) * dt / pasos;
        if (b.d > b.alc || Golpe.solido(M, Math.floor(b.x / GP.T), Math.floor(b.y / GP.T))) { fuera = true; break; }
        for (const q of s.jug) {
          if (Math.abs(q.x - b.x) > 20 || Math.abs(q.y - b.y) > 20 || !Golpe.puedeHerir(b, q)) continue;
          if (Math.hypot(q.x - b.x, q.y - b.y) < GP.R + 3) { Golpe.herir(s, q, b); fuera = true; break; }
        }
      }
      if (fuera) s.balas.splice(i, 1);
    }
  },
  herir(s, q, b) {
    // El chaleco frena una parte, pero la penetración del arma (su rareza) lo atraviesa
    const red = GP.CHALECO[q.chaleco] * Math.max(0, 1 - 0.22 * b.pen), d = Math.max(1, Math.round(b.dmg * (1 - red)));
    q.hp -= d; q.golpe = s.t; q.golpeDe = Math.atan2(-b.vy, -b.vx);
    s.hits.push({ x: Math.round(q.x), y: Math.round(q.y), d, t: s.t, de: b.de, a: q.id, ch: red > 0.05 });
    const autor = s.jug.find(j => j.id === b.de);
    if (q.cpu && q.ia && autor) { q.ia.obj = autor.id; q.ia.reac = Math.min(q.ia.reac || 0, s.t + 0.25); }
    if (q.hp > 0) return;
    q.hp = 0; q.fin = s.t;
    if (b.rol === "policia" && q.rol === "ladron") {
      const v = Golpe.valor(q); q.est = "preso";
      if (autor) { autor.confis += v; autor.arrestos++; autor.incaut.push(...q.moch.map(it => ({ ...it }))); }
      q.moch = [];
      Golpe.aviso(s, `👮 ${autor ? autor.name : "La policía"} arrestó a ${q.name}${v ? ` · $${v} confiscados` : ""}`);
    } else {
      q.est = "muerto"; if (autor) autor.kills++;
      for (const it of q.moch) Golpe.soltar(s, { ...it }, q.x, q.y);
      if (q.arma && q.rol !== "policia") Golpe.soltar(s, { k: "arma", a: q.arma.a, r: q.arma.r }, q.x, q.y);
      if (q.cura) Golpe.soltar(s, { k: "cura" }, q.x, q.y);
      q.moch = [];
      Golpe.aviso(s, `💀 ${autor ? autor.name : "Alguien"} bajó a ${q.name}`);
    }
    if (q.cpu) s.respawn.push({ rol: q.rol, t: s.t + 18 + Math.random() * 10 });
  },

  /* ---------- Bots ----------
     Ven solo lo que tienen a la vista (las paredes tapan) y tardan un poco en reaccionar: así se puede
     sorprenderlos. Los fáciles apuntan peor y reaccionan más lento. */
  hab(nivel) { return { facil: 0.25, normal: 0.5, dificil: 0.8 }[nivel] ?? 0.5; },
  hostil(J, q) { if (q === J || q.est !== "vivo") return false; if (J.rol === "policia") return q.rol === "ladron"; if (J.rol === "ladron") return q.team !== J.team; return false; },
  /* Con quién se mete un bot: los ladrones van contra las personas, contra quien los ataca, contra la policía
     que se les acerca y contra quien lleva mucho botín; con los demás, siguen robando */
  interesa(J, q, d) {
    if (J.rol !== "ladron") return true;
    const meAtaca = q.ia && q.ia.obj === J.id;
    if (meAtaca || !q.cpu) return true;
    if (q.rol === "policia") return d < 300;
    if (q.rol === "civil") return d < 160 && J.ia && J.ia.malo;   // no todos los ladrones se meten con civiles
    return Golpe.valor(q) > 400 && Golpe.valor(J) < 200;
  },
  pensar(s, J, dt) {
    const M = s.M, IA = J.ia || (J.ia = { t: 0, camino: null, meta: null, obj: null, reac: 0, lado: 1, cambio: 0, quieto: 0, px: J.x, py: J.y, repensar: 0, meta2: 0, objetivo: (J.rol === "civil" ? 200 : 300) + Math.random() * 600, malo: Math.random() < 0.4 }), h = Golpe.hab(J.nivel);
    IA.t -= dt; IA.repensar -= dt;
    let enemigo = IA.obj ? s.jug.find(q => q.id === IA.obj) : null;
    if (IA.t <= 0) {
      IA.t = 0.22 + Math.random() * 0.15;
      // ¿A quién ve?
      const alcance = J.rol === "policia" ? 460 : J.rol === "ladron" ? 470 : 340;
      let mejor = null, md = 1e9;
      for (const q of s.jug) {
        const amenaza = J.rol === "civil" ? q.rol === "ladron" && q.est === "vivo" : Golpe.hostil(J, q) && !(q.prot > 0);
        if (!amenaza) continue;
        const d = Math.hypot(q.x - J.x, q.y - J.y);
        if (d < alcance && d < md && (q.bldg === J.bldg || !q.bldg || !J.bldg || d < 120) && Golpe.interesa(J, q, d) && Golpe.linea(M, J.x, J.y, q.x, q.y)) { md = d; mejor = q; }
      }
      if (mejor) IA.visto = s.t;
      if (mejor && mejor.id !== IA.obj) { IA.obj = mejor.id; IA.reac = s.t + (0.85 - 0.55 * h) + Math.random() * 0.35 + (J.rol === "policia" ? 0.25 : 0); }
      // Si lo pierde de vista un rato (o ya no está), lo deja
      if (!mejor && enemigo && (enemigo.est !== "vivo" || s.t - (IA.visto || 0) > 2.5 || Math.hypot(enemigo.x - J.x, enemigo.y - J.y) > alcance * 1.3)) IA.obj = null;
      enemigo = IA.obj ? s.jug.find(q => q.id === IA.obj) : null;
      if (J.hp < J.hpMax * 0.4 && J.cura && (!enemigo || Math.random() < 0.3)) Golpe.curar(s, J);
      if (!enemigo || J.rol === "civil") Golpe.elegirMeta(s, J, IA, !!enemigo, enemigo);
    }
    const I = J.in; I.f = false; I.ax = 0; I.ay = 0;
    if (enemigo && enemigo.est === "vivo" && J.rol !== "civil") {
      const dx = enemigo.x - J.x, dy = enemigo.y - J.y, d = Math.hypot(dx, dy), ve = Golpe.linea(M, J.x, J.y, enemigo.x, enemigo.y);
      // Apunta con un error que depende de la habilidad (y un poco de anticipación al movimiento)
      IA.err = IA.err === undefined || Math.random() < dt * 2 ? Turnero.gauss() * (0.2 - 0.16 * h) : IA.err;
      const lead = d / 1100 * h, ex = enemigo.in ? enemigo.in.mx * GP.VEL * lead : 0, ey = enemigo.in ? enemigo.in.my * GP.VEL * lead : 0;
      const a = Math.atan2(dy + ey, dx + ex) + IA.err;
      I.ax = Math.cos(a); I.ay = Math.sin(a);
      const W = J.arma ? GP.ARMAS[J.arma.a] : null;
      I.f = ve && s.t >= IA.reac && W && d < W.alc * 0.95;
      // Movimiento en pelea: acercarse si está lejos, alejarse si está muy cerca, y moverse de costado
      IA.cambio -= dt; if (IA.cambio <= 0) { IA.cambio = 0.8 + Math.random() * 1.2; IA.lado = Math.random() < 0.5 ? 1 : -1; }
      const ideal = W && W.a === "escopeta" ? 140 : W && W.alc > 700 ? 380 : 240;
      let mx = 0, my = 0;
      if (!ve || d > ideal + 80) { const p = Golpe.siguiente(s, J, IA, enemigo.x, enemigo.y); mx = p[0]; my = p[1]; }
      else if (d < ideal - 70) { mx = -dx / d; my = -dy / d; }
      mx += -dy / d * IA.lado * 0.8; my += dx / d * IA.lado * 0.8;
      I.mx = mx; I.my = my;
    } else if (enemigo && J.rol === "civil") {
      // Huye: hacia el lado contrario, y si está contra una pared, por su camino
      const dx = J.x - enemigo.x, dy = J.y - enemigo.y, d = Math.hypot(dx, dy) || 1;
      if (Golpe.libre(M, J.x + dx / d * 30, J.y + dy / d * 30, GP.R)) { I.mx = dx / d; I.my = dy / d; }
      else { const p = Golpe.siguiente(s, J, IA, IA.meta ? IA.meta.x : J.x, IA.meta ? IA.meta.y : J.y); I.mx = p[0]; I.my = p[1]; }
    } else if (IA.meta) {
      const p = Golpe.siguiente(s, J, IA, IA.meta.x, IA.meta.y); I.mx = p[0]; I.my = p[1];
    } else { I.mx = 0; I.my = 0; }
    // Si se trabó contra algo, busca otro camino
    IA.quieto = Math.hypot(J.x - IA.px, J.y - IA.py) < 1.2 && Math.hypot(I.mx, I.my) > 0.3 ? IA.quieto + dt : 0;
    IA.px = J.x; IA.py = J.y;
    if (IA.quieto > 0.8) { IA.camino = null; IA.quieto = 0; IA.meta2 = 0; I.mx = Math.random() - 0.5; I.my = Math.random() - 0.5; }
  },
  elegirMeta(s, J, IA, huyendo, enemigo) {
    const M = s.M, T = GP.T;
    IA.meta2 -= 0.25;
    if (huyendo && enemigo) { // un punto lejos del ladrón
      if (!IA.meta || IA.meta2 <= 0 || Math.hypot(IA.meta.x - enemigo.x, IA.meta.y - enemigo.y) < 300) { const [x, y] = Golpe.calleAzar(M, Math.random); IA.meta = { x: (x + 0.5) * T, y: (y + 0.5) * T }; IA.camino = null; IA.meta2 = 4; }
      return;
    }
    if (J.rol === "policia") {
      // Por radio: se entera de dónde anda algún ladrón (cada tanto), si no patrulla
      if (IA.meta2 <= 0) {
        IA.meta2 = 9 + Math.random() * 8;
        const l = s.jug.filter(q => q.rol === "ladron" && q.est === "vivo" && Math.hypot(q.x - J.x, q.y - J.y) < 1100).sort((a, b) => Golpe.valor(b) - Golpe.valor(a))[0];
        if (l && Math.random() < 0.4) IA.meta = { x: l.x, y: l.y };
        else { const [x, y] = Golpe.calleAzar(M, Math.random); IA.meta = { x: (x + 0.5) * T, y: (y + 0.5) * T }; }
        IA.camino = null;
      }
      return;
    }
    const v = Golpe.valor(J), irse = J.rol === "civil" ? s.t - (J.nace || 0) > IA.objetivo / 2 + 60 : J.moch.length >= J.cupo || v >= IA.objetivo || s.t > GP.DURACION - 80;
    if (irse) {
      const sal = M.salidas.slice().sort((a, b) => Math.hypot(a.x - J.x, a.y - J.y) - Math.hypot(b.x - J.x, b.y - J.y))[0];
      if (!IA.meta || IA.meta.x !== sal.x || IA.meta.y !== sal.y) { IA.meta = { x: sal.x, y: sal.y, salida: true }; IA.camino = null; }
      return;
    }
    // Lo más conveniente que haya cerca (más valor, menos distancia)
    let mejor = null, mp = 0;
    for (const it of s.items) {
      const d = Math.hypot(it.x - J.x, it.y - J.y); if (d > 1200) continue;
      let p = 0;
      if (it.k === "art" && J.rol === "ladron" && J.moch.length < J.cupo) p = it.v;
      else if (it.k === "arma" && J.rol !== "civil") p = Math.max(0, Golpe.puntajeArma(it) - Golpe.puntajeArma(J.arma)) * 2;
      else if (it.k === "chaleco" && it.n > J.chaleco) p = 150 * (it.n - J.chaleco);
      else if (it.k === "cura" && J.cura < 2) p = 60;
      p = p / (1 + d / 250);
      if (p > mp) { mp = p; mejor = it; }
    }
    if (mejor) { if (!IA.meta || IA.meta.item !== mejor.id) { IA.meta = { x: mejor.x, y: mejor.y, item: mejor.id }; IA.camino = null; } }
    else if (!IA.meta || IA.meta2 <= 0 || Math.hypot(IA.meta.x - J.x, IA.meta.y - J.y) < 30) {
      const E = M.ed[1 + Math.floor(Math.random() * (M.ed.length - 1))], [x, y] = Golpe.pisoAzar(M, Math.random, E);
      IA.meta = { x: (x + 0.5) * T, y: (y + 0.5) * T }; IA.camino = null; IA.meta2 = 10;
    }
  },
  /* Dirección para ir hacia (x, y): derecho si se ve, si no por el camino de la grilla */
  siguiente(s, J, IA, x, y) {
    const M = s.M, T = GP.T, dx = x - J.x, dy = y - J.y, d = Math.hypot(dx, dy);
    if (d < 6) return [0, 0];
    if (d < 260 && Golpe.linea(M, J.x, J.y, x, y) && Golpe.libre(M, J.x + dx / d * 16, J.y + dy / d * 16, GP.R)) return [dx / d, dy / d];
    const [tx, ty] = Golpe.casilla(M, x, y), [jx, jy] = Golpe.casilla(M, J.x, J.y);
    if (!IA.camino || IA.repensar <= 0 || IA.dest !== tx + "," + ty) {
      IA.camino = Golpe.camino(M, jx, jy, tx, ty) || []; IA.dest = tx + "," + ty; IA.repensar = 2.5 + Math.random();
    }
    while (IA.camino.length) {
      const [cx, cy] = IA.camino[0], px = (cx + 0.5) * T, py = (cy + 0.5) * T;
      if (Math.hypot(px - J.x, py - J.y) < 10 || (cx === jx && cy === jy && Math.hypot(px - J.x, py - J.y) < 18)) { IA.camino.shift(); continue; }
      // Si el punto que sigue ya se ve derecho, saltea este
      if (IA.camino.length > 1) { const [nx, ny] = IA.camino[1], qx = (nx + 0.5) * T, qy = (ny + 0.5) * T; if (Golpe.linea(M, J.x, J.y, qx, qy) && Math.hypot(qx - J.x, qy - J.y) < 90) { IA.camino.shift(); continue; } }
      const ex = px - J.x, ey = py - J.y, e = Math.hypot(ex, ey);
      return [ex / e, ey / e];
    }
    return [dx / d, dy / d];
  },

  /* ---------- Lo que ve cada uno ----------
     Al que está afuera no se le mandan los que están adentro de un edificio (y al revés solo si están cerca de la puerta) */
  ve(me, q) {
    if (q === me) return true;
    if (!me.cpu && !q.cpu && me.team === q.team) return true;
    const d = Math.hypot(q.x - me.x, q.y - me.y);
    if (d > GP.VISION) return false;
    return !q.bldg || q.bldg === me.bldg || d < 70;
  },
  view(s, pid) {
    const me = s.jug.find(j => j.id === pid);
    const base = { game: "golpe", id: s.id, me: pid, semilla: s.semilla, fase: s.fase, t: Math.round(s.t * 100) / 100, dur: GP.DURACION, salidas: s.M.salidas, feed: s.feed.slice(-4) };
    if (s.fase === "rol") return { ...base, roles: s.jug.filter(j => !j.cpu).map(j => ({ id: j.id, name: j.name, rol: j.rol, look: j.look })) };
    // Si ya no está en juego, mira a un compañero (o queda quieto donde terminó)
    let ojo = me;
    if (me && me.est !== "vivo") ojo = s.jug.find(j => !j.cpu && j.team === me.team && j.est === "vivo") || me;
    const visibles = ojo ? s.jug.filter(j => j.est === "vivo" && Golpe.ve(ojo, j)) : [];
    const cerca = (o, r) => ojo && Math.abs(o.x - ojo.x) < r && Math.abs(o.y - ojo.y) < r;
    const v = {
      ...base, ojo: ojo ? ojo.id : null,
      jug: visibles.map(j => ({ id: j.id, name: j.name, cpu: !!j.cpu, look: j.look, rol: j.rol, x: Math.round(j.x), y: Math.round(j.y), a: Math.round(j.ang * 100) / 100, hp: Math.round(j.hp), hpMax: j.hpMax, ch: j.chaleco, arma: j.arma ? j.arma.a : null, ar: j.arma ? j.arma.r : 0, tiro: j.tiro && s.t - j.tiro < 0.08 ? 1 : 0, ext: j.ext ? Math.round(j.ext * 10) / 10 : 0, prot: j.prot > 0 ? 1 : 0, golpe: j.golpe && s.t - j.golpe < 0.2 ? 1 : 0 })),
      items: s.items.filter(it => cerca(it, GP.VISION + 60) && (!Golpe.edificioEn(s.M, it.x, it.y) || Golpe.edificioEn(s.M, it.x, it.y) === ojo.bldg)).map(it => ({ id: it.id, x: Math.round(it.x), y: Math.round(it.y), k: it.k, a: it.a, r: it.r, n: it.n, v: it.v })),
      balas: s.balas.filter(b => cerca(b, GP.VISION + 200)).map(b => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y), vx: Math.round(b.vx), vy: Math.round(b.vy) })),
      hits: s.hits.filter(h => h.de === pid || h.a === pid || cerca(h, GP.VISION)).map(h => ({ x: h.x, y: h.y, d: h.d, yo: h.de === pid, a: h.a === pid, ch: h.ch, t: h.t })),
      equipo: s.jug.filter(j => me && !j.cpu && j.team === me.team && j !== me).map(j => ({ id: j.id, name: j.name, x: Math.round(j.x), y: Math.round(j.y), est: j.est, hp: Math.round(j.hp) })),
      humanos: s.jug.filter(j => !j.cpu).map(j => ({ id: j.id, name: j.name, rol: j.rol, est: j.est, valor: j.rol === "policia" ? j.premio || 0 : Golpe.valor(j), items: j.premioItems ? j.premioItems.length : 0, kills: j.kills, arrestos: j.arrestos, puesto: j.puesto, pts: Golpe.puntaje(j) }))
    };
    if (me) v.yo = { id: me.id, rol: me.rol, est: me.est, x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, hp: Math.round(me.hp), hpMax: me.hpMax, ch: me.chaleco, arma: me.arma, cura: me.cura, moch: me.rol === "ladron" ? me.moch : [], cupo: me.cupo, valor: me.rol === "ladron" ? Golpe.valor(me) : 0, premio: me.premio, kills: me.kills, arrestos: me.arrestos, confis: me.confis, ext: Math.round(me.ext * 10) / 10, bldg: me.bldg, junto: me.junto && s.t - me.junto < 0.3 ? 1 : 0 };
    return v;
  },

  act(s, pid, a) {
    const J = s.jug.find(j => j.id === pid); if (!J || J.cpu) return;
    const n = (x, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, +x || 0));
    if (a.t === "in") J.in = { mx: n(a.mx), my: n(a.my), ax: n(a.ax), ay: n(a.ay), f: !!a.f };
    else if (a.t === "volverse" && (a.r === "ladron" || a.r === "policia")) Golpe.convertir(s, J, a.r);
    else if (a.t === "agarrar" && J.est === "vivo") Golpe.agarrar(s, J);
    else if (a.t === "cura") Golpe.curar(s, J);
  },
  resultado(s, pid) {
    if (!s || s.fase !== "fin") return null;
    const J = s.jug.find(j => j.id === pid); if (!J || J.cpu) return null;
    const humanos = s.jug.filter(j => !j.cpu), escapo = J.est === "escapo", valor = J.rol === "policia" ? J.premio || 0 : escapo ? Golpe.valor(J) : 0;
    const gano = J.rol === "policia" ? J.arrestos >= 1 && J.est !== "muerto" : escapo && valor > 0;
    return { juego: "golpe", id: s.id, gano, puesto: J.puesto, n: s.jug.length, vsCompu: humanos.length === 1, rol: J.rol, escapo, valor, kills: J.kills, arrestos: J.arrestos };
  },
  textoCuenta(r) {
    if (!r || typeof Puntos === "undefined" || !BD.sesion()) return "";
    const c = Puntos.calcular(r);
    return `A tu cuenta se suman <b>+${c.puntos} puntos</b>.`;
  },
  /* Botín guardado (lo que sacaste de la ciudad), por perfil, en este teléfono. Más adelante: comprar terrenos. */
  banco() { const u = BD.sesion(); return store.get("golpeBanco:" + (u ? u.id : "anon"), { total: 0, golpes: [] }); },
  guardarBotin(r) {
    if (!r || !r.valor || (r.rol !== "policia" && !r.escapo)) return;
    const u = BD.sesion(), k = "golpeBanco:" + (u ? u.id : "anon"), b = store.get(k, { total: 0, golpes: [] });
    if (b.golpes.includes(r.id)) return;
    b.total += r.valor; b.golpes = [r.id, ...b.golpes].slice(0, 50); store.set(k, b);
  },

  /* ---------- En este teléfono (contra bots) ---------- */
  empezarLocal() {
    const c = Golpe.cfg(), u = BD.sesion();
    S.extra = Golpe.crear([{ id: "p0", name: u ? u.nombre : "Vos", look: u ? u.look : Cuenta.look(), rol: "civil" }], { local: true, nivel: c.nivel, dens: c.dens });
    S.extra.juego = "golpe";
    go("golpe");
  },
  pantallaLocal() {
    const s = S.extra; if (!s || s.juego !== "golpe") return go("golpeIntro");
    clearInterval(Golpe.reloj);
    let prev = performance.now();
    Golpe.reloj = setInterval(() => {
      if (S.extra !== s || S.screen !== "golpe") { clearInterval(Golpe.reloj); Golpe.reloj = null; return; }
      const ahora = performance.now(), dt = Math.min(0.1, (ahora - prev) / 1000); prev = ahora;
      Golpe.tick(s, dt);
      Golpe.recibir(Golpe.view(s, "p0"));
      if (s.fase === "fin" && !s.contada) { s.contada = true; Golpe.guardarBotin(Golpe.resultado(s, "p0")); Cuenta.revisar(); }
    }, 50);
    Golpe.render(Golpe.view(s, "p0"), a => {
      if (a.t === "again") { Golpe.parar(); return Golpe.empezarLocal(); }
      if (a.t === "salir") { Golpe.parar(); clearInterval(Golpe.reloj); S.extra = null; return go("golpeIntro"); }
      Golpe.act(s, "p0", a);
    }, { local: true, isHost: true });
  },
  intro() {
    const c = Golpe.cfg(), b = Golpe.banco();
    app.innerHTML = `${head(0)}<section class="screen ex-intro ex-golpe">
      <div class="tb-hero"><span class="ex-arte">${Golpe.svg()}</span><span class="tb-neon">GOLPE</span><p class="sub">${Golpe.descripcion}</p></div>
      <div class="panel gp-banco"><span>💰 Tu botín guardado</span><b>$${b.total.toLocaleString("es-AR")}</b><small>${b.golpes.length} golpe${b.golpes.length === 1 ? "" : "s"} · pronto vas a poder comprar terrenos en otras ciudades</small></div>
      <div class="panel"><span class="label">Entrás como civil… y elegís tu camino</span>
        <div class="gp-roles">${[["civil", "Entrás a la ciudad sin armas y sin poder robar. Mirá, recorré y decidí."], ["ladron", "Tocá el botón «Volverse ladrón» en cualquier momento. Solo el ladrón ve su mochila. Llegá a una salida con el botín."], ["policia", "Andá a la 🚓 comisaría y hacete policía. Arrestá ladrones y confiscá lo robado. Al terminar el turno cobrás sueldo, una parte y algunos ítems."]].map(([k, d]) => `<div class="gp-rol" style="--rc:${GP.ROLES[k].color}"><span>${GP.ROLES[k].ic}</span><b>${GP.ROLES[k].n}</b><small>${d}</small></div>`).join("")}</div>
        <span class="label">Gente en la ciudad</span><div class="seg">${[["pocos", "Poca"], ["normal", "Normal"], ["muchos", "Mucha"]].map(([k, t]) => `<button aria-pressed="${c.dens === k}" data-gpd="${k}">${t}</button>`).join("")}</div>
        <span class="label">Qué tan buenos son los bots</span><div class="seg">${[["facil", "Fáciles"], ["normal", "Normales"], ["dificil", "Difíciles"]].map(([k, t]) => `<button aria-pressed="${c.nivel === k}" data-gpn="${k}">${t}</button>`).join("")}</div>
      </div>
      <details class="panel gp-ayuda"><summary>¿Cómo se juega?</summary>
        <p>👈 Con el dedo izquierdo te movés. 👉 Con el derecho apuntás: al arrastrar, disparás. En la compu: WASD, el mouse para apuntar y clic para disparar (E agarra, Q cura).</p>
        <p>🏦 Los edificios tienen cosas de distinta rareza: <span style="color:${GP.RAR[0][1]}">común</span>, <span style="color:${GP.RAR[1][1]}">poco común</span>, <span style="color:${GP.RAR[2][1]}">rara</span>, <span style="color:${GP.RAR[3][1]}">épica</span> y <span style="color:${GP.RAR[4][1]}">legendaria</span>. El banco, la joyería y el museo tienen lo mejor.</p>
        <p>🦺 El chaleco frena parte del daño, pero las armas de más rareza lo atraviesan. Si te bajan de pocos tiros, mirá el arma del otro.</p>
        <p>🚪 Como ladrón, para quedarte con lo robado llegá a una <b>SALIDA</b> verde y aguantá ${GP.ESCAPE} segundos adentro. Como policía, la salida termina tu turno (o se termina solo al acabarse el tiempo). Tenés ${GP.DURACION / 60} minutos.</p></details>
      <button class="btn tb-girar" id="exJugar">${Golpe.boton}</button>
      <p class="summary center">¿Con amigos? Creá una sala en "Jugar online" y elegí Golpe: entran juntos y los del mismo rol son equipo.</p>
      <button class="btn ghost" id="exAtras">Volver</button></section>`;
    const guardar = () => { store.set("golpeCfg", c); render(); };
    app.querySelectorAll("[data-gpd]").forEach(x => x.onclick = () => { c.dens = x.dataset.gpd; guardar(); });
    app.querySelectorAll("[data-gpn]").forEach(x => x.onclick = () => { c.nivel = x.dataset.gpn; guardar(); });
    on("exJugar", () => Golpe.empezarLocal());
    on("exAtras", () => go("home"));
  },

  /* ---------- Online (en el anfitrión) ---------- */
  empezarOn(R) {
    const c = Golpe.cfg();
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name, look: p.id === "H" ? Cuenta.look() : p.look }));
    if (jug.length > 8) return "Golpe es de hasta 8 personas.";
    R.ex = Golpe.crear(jug, { local: false, nivel: c.nivel, dens: c.dens });
    R.ex.juego = "golpe"; R.game = "golpe";
    clearInterval(Golpe.relojOn);
    let prev = performance.now(), n = 0;
    Golpe.relojOn = setInterval(() => {
      if (!Net.R || Net.R.game !== "golpe" || !Net.R.ex) { clearInterval(Golpe.relojOn); Golpe.relojOn = null; return; }
      const s = Net.R.ex, ahora = performance.now(); Golpe.tick(s, Math.min(0.1, (ahora - prev) / 1000)); prev = ahora;
      // 20 veces por segundo se calcula; 10 veces por segundo se manda a cada teléfono lo que ve
      if (++n % 2 === 0 || s.fase === "fin") Net.broadcast();
      if (s.fase === "fin") { clearInterval(Golpe.relojOn); Golpe.relojOn = null; }
    }, 50);
    return null;
  },
  actOn(R, pid, a) {
    if (a.t === "again" && pid === "H") { const e = Golpe.empezarOn(R); R.err = e || ""; return; }
    if (a.t === "lobby" && pid === "H") { clearInterval(Golpe.relojOn); R.game = null; R.ex = null; return; }
    if (R.ex) Golpe.act(R.ex, pid, a);
  },
  turnoInfo() { return null; }
};
EXTRA.golpe = Golpe;
PANTALLAS.golpeIntro = () => Golpe.intro();
PANTALLAS.golpe = () => Golpe.pantallaLocal();
