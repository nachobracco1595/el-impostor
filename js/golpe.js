/* Golpe: robo en la ciudad, visto desde arriba (estilo "extraction shooter").
   - Todos entran por la ZONA SEGURA (el lobby): ahí nadie puede herir a nadie y todos se ven como civiles. Ahí
     está la ARMERÍA, donde se compran armas, chalecos, bolsos, botiquines y mejoras con la plata ganada.
   - Se entra como CIVIL: no puede robar ni tiene armas (sí puede manejar). Desde ahí elige su camino:
     con un botón se vuelve LADRÓN, o va a la comisaría y se hace POLICÍA. No hay vuelta atrás.
   - El ladrón arranca sin nada (salvo lo que haya comprado o conservado): se arma robando.
   - LADRÓN: roba artefactos (entran en su bolso: 10 lugares, más con bolsos más grandes), los vende en un
     REDUCIDOR para tener plata, y para quedarse con todo tiene que llegar a una SALIDA (a pie o en auto).
     · Si lo mata otro ladrón, pierde TODO (también armas, chaleco y bolso).
     · Si lo agarra la policía, pierde lo robado y la plata, pero conserva armas, chaleco y bolso.
     · Las armas, el chaleco y el bolso que conserva quedan guardados para la próxima vez que sea ladrón.
   - En los edificios que se roban hay ALARMA: al robar suena y avisa a la policía, salvo que antes la desactives
     en su panel. Las CAJAS FUERTES se abren con LLAVES que se encuentran por la ciudad: tienen lo mejor y plata.
   - Para esconderse: arbustos en las plazas y contenedores en las veredas. Escondido, nadie te ve de lejos.
   - AUTOS estacionados (con baúl para guardar lo robado) y patrulleros. Los civiles también manejan.
   - La partida es una SESIÓN: nadie queda afuera. El ladrón que escapa, cae preso o muere vuelve a la zona
     segura como civil (preso: conserva su equipo; muerto: pierde todo) y puede volver a salir. Cada vuelta se
     guarda en el momento. Al empezar no hay policías: los civiles eligen serlo (hasta 6 por ciudad).
   - POLICÍA: solo hiere ladrones; al bajarlos los arresta y confisca lo robado. Tiene RANGOS según sus arrestos
     (mejor arma, chaleco y sueldo). Si lo matan, vuelve a la comisaría. Al terminar el turno cobra sueldo,
     una parte de lo confiscado y algunos ítems incautados. No tiene inventario.
   - Online, el teléfono del anfitrión es el SERVIDOR: los demás solo mandan hacia dónde se mueven, apuntan y
     qué botón tocan. El anfitrión calcula todo y a cada teléfono le manda solo lo que ve. */
const GP = {
  T: 40, N: 94, NB: 6, R: 14, VISION: 560, DURACION: 900, ESCAPE: 4, SALIDA_R: 70, VEL: 140,
  RAR: [["Común", "#adb5bd"], ["Poco común", "#51cf66"], ["Rara", "#4dabf7"], ["Épica", "#cc5de8"], ["Legendaria", "#ffd43b"]],
  MULT: [1, 2, 4, 8, 16],
  ROLES: {
    ladron: { n: "Ladrón", color: "#ff4d63" },
    policia: { n: "Policía", color: "#4dabf7" },
    civil: { n: "Civil", color: "#e9ecef" }
  },
  ARMAS: {
    pistola: { n: "Pistola", dmg: 17, cad: 0.36, disp: 0.06, alc: 540, vel: 1050, bal: 1 },
    subfusil: { n: "Subfusil", dmg: 10, cad: 0.1, disp: 0.13, alc: 470, vel: 1050, bal: 1 },
    escopeta: { n: "Escopeta", dmg: 11, cad: 0.85, disp: 0.3, alc: 300, vel: 950, bal: 6 },
    rifle: { n: "Rifle", dmg: 32, cad: 0.6, disp: 0.02, alc: 820, vel: 1400, bal: 1 }
  },
  CHALECO: [0, 0.25, 0.4, 0.55],
  BOLSOS: [10, 14, 18, 24],
  // Armería (en la zona segura): lo que se compra con la plata ganada
  TIENDA: [
    { id: "pistola", n: "Pistola", d: "Común", p: 300, tipo: "arma", a: "pistola", r: 0 },
    { id: "pistola1", n: "Pistola", d: "Poco común", p: 700, tipo: "arma", a: "pistola", r: 1 },
    { id: "subfusil", n: "Subfusil", d: "Común", p: 1000, tipo: "arma", a: "subfusil", r: 0 },
    { id: "escopeta", n: "Escopeta", d: "Común", p: 1200, tipo: "arma", a: "escopeta", r: 0 },
    { id: "rifle", n: "Rifle", d: "Común", p: 1800, tipo: "arma", a: "rifle", r: 0 },
    { id: "mejora", n: "Mejorar arma", d: "+1 de rareza", p: 0, tipo: "mejora" },
    { id: "chaleco1", n: "Chaleco", d: "Nivel 1", p: 400, tipo: "chaleco", c: 1 },
    { id: "chaleco2", n: "Chaleco", d: "Nivel 2", p: 950, tipo: "chaleco", c: 2 },
    { id: "chaleco3", n: "Chaleco", d: "Nivel 3", p: 2000, tipo: "chaleco", c: 3 },
    { id: "bolso14", n: "Bolso", d: "14 lugares", p: 500, tipo: "bolso", c: 14 },
    { id: "bolso18", n: "Bolso", d: "18 lugares", p: 1100, tipo: "bolso", c: 18 },
    { id: "bolso24", n: "Bolso", d: "24 lugares", p: 2200, tipo: "bolso", c: 24 },
    { id: "cura", n: "Botiquín", d: "+50 de vida", p: 150, tipo: "cura" }],
  precioMejora(r) { return r >= 4 ? 0 : [500, 1100, 2200, 4000][r]; },
  ART: [["Celular", "celular", 40], ["Reloj", "reloj", 60], ["Billetes", "billetes", 80], ["Cámara", "camara", 70], ["Notebook", "notebook", 90], ["Consola", "consola", 100],
    ["Anillo", "anillo", 120], ["Collar", "collar", 150], ["Estatuilla", "estatuilla", 160], ["Cuadro", "cuadro", 180], ["Lingote", "lingote", 200], ["Diamante", "diamante", 300]],
  // tier: rareza de lo que hay · alarma: tiene panel · cajas: cajas fuertes · tienda: reducidor
  EDIF: {
    casa: { n: "Casa", tier: 0, piso: "#b89572", techo: "#9c4f3c", cosas: [3, 5], llaves: 0.35 },
    kiosco: { n: "Kiosco", tier: 0, piso: "#c7b28a", techo: "#c2721f", cosas: [3, 5], alarma: true, llaves: 0.3 },
    farmacia: { n: "Farmacia", tier: 1, piso: "#cfe3dc", techo: "#2b8a3e", cosas: [3, 5], curas: 3, alarma: true },
    deposito: { n: "Depósito", tier: 1, piso: "#8d8a80", techo: "#5c5f66", cosas: [4, 6], armas: 2, alarma: true, bolsos: 1 },
    joyeria: { n: "Joyería", tier: 2, piso: "#e6dcc8", techo: "#9c36b5", cosas: [5, 7], alarma: true, cajas: 1 },
    banco: { n: "Banco", tier: 3, piso: "#d9d2c1", techo: "#2f3b52", cosas: [5, 7], armas: 1, alarma: true, cajas: 2 },
    museo: { n: "Museo", tier: 3, piso: "#e9e4d8", techo: "#7c6a4f", cosas: [5, 7], alarma: true, cajas: 1 },
    reducidor: { n: "Reducidor", tier: 0, piso: "#4a3f5c", techo: "#2b2236", cosas: [0, 0], tienda: true },
    comisaria: { n: "Comisaría", tier: 1, piso: "#c3cfe0", techo: "#1c4f8c", cosas: [0, 0], armas: 3, chalecos: 2 }
  },
  // Rangos de la policía: [nombre, abreviatura, arrestos necesarios, arma, chaleco, sueldo]
  RANGOS: [
    ["Cadete", "Cad.", 0, { a: "pistola", r: 0 }, 1, 100], ["Agente", "Ag.", 3, { a: "pistola", r: 1 }, 2, 150],
    ["Cabo", "Cabo", 8, { a: "subfusil", r: 1 }, 2, 200], ["Sargento", "Sgto.", 15, { a: "subfusil", r: 2 }, 3, 260],
    ["Inspector", "Insp.", 25, { a: "rifle", r: 2 }, 3, 330], ["Comisario", "Crio.", 40, { a: "rifle", r: 3 }, 3, 420]],
  PARTE: 0.3, QUEDA: 2, ALARMA: 45, ABRIR: 2.5, DESACTIVAR: 3, MAX_POLI: 6, VUELVE_MIN: 14, CASTIGO: 8, CASA: 4,
  AUTO: { auto: { vmax: 300, cupo: 6 }, patrullero: { vmax: 340, cupo: 0 } },
  COLORES_AUTO: ["#e03131", "#1971c2", "#f08c00", "#2f9e44", "#868e96", "#f8f9fa", "#5f3dc4", "#212529"],
  NOMBRES: {
    ladron: ["Rata", "Chueco", "Facha", "Tano", "Pelado", "Tuerca", "Gato", "Zurdo", "Mosca", "Cabezón", "Flaco", "Ruso", "Pulga", "Tigre"],
    policia: ["Díaz", "Paz", "Ríos", "Luna", "Vera", "Soto", "Ruiz", "Funes", "Ledesma", "Ochoa"],
    civil: ["Doña Rosa", "Kevin", "Marta", "Don Julio", "Yesi", "Beto", "Lili", "Ramón", "Nati", "Coco", "Pocho", "Chiqui", "Tito", "Mirta"]
  },
  DENS: { pocos: [6, 0, 11], normal: [9, 0, 16], muchos: [13, 0, 22] }   // ladrones, policías (ninguno al empezar: salen de los civiles), civiles
};

const Golpe = {
  clave: "golpe", nombre: "Golpe", boton: "Entrar a la ciudad",
  descripcion: "Robo en la ciudad. Entrás como civil y elegís: ladrón o policía. Autos, alarmas, cajas fuertes, reducidores y una armería.",
  cfg() { return Turnero.cfg("golpe", { dens: "normal", nivel: "normal" }); },
  arte() { return Golpe.svg(); },
  lobbyInfo: ["Golpe", "", "1 a 8"],
  lobby(v, H) {
    const c = v.exCfg.golpe;
    return `<p class="summary">Todos entran por la zona segura como civiles. Adentro, cada uno se vuelve ladrón o va a la comisaría a hacerse policía. Los del mismo rol son equipo. Hay autos, alarmas, cajas fuertes con llaves y reducidores para vender lo robado.</p>
      ${H ? `<span class="label">Gente en la ciudad</span><div class="seg">${[["pocos", "Poca"], ["normal", "Normal"], ["muchos", "Mucha"]].map(([k, t]) => `<button aria-pressed="${c.dens === k}" data-exopc="golpe:dens:${k}">${t}</button>`).join("")}</div>
      <div class="seg">${[["facil", "Bots fáciles"], ["normal", "Normales"], ["dificil", "Difíciles"]].map(([k, t]) => `<button aria-pressed="${c.nivel === k}" data-exniv="golpe:${k}">${t}</button>`).join("")}</div>` : ""}`;
  },

  azar(semilla) { let a = semilla >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },

  /* ---------- La ciudad ----------
     Casillas: 0 calle · 1 vereda · 2 pared · 3 piso · 4 pasto · 5 árbol · 6 límite · 7 arbusto · 8 contenedor · 9 zona segura.
     Arbustos y contenedores se pueden pisar y sirven para esconderse. 6×6 manzanas de 12 con calles de 3. */
  mapa(semilla) {
    const r = Golpe.azar(semilla), N = GP.N, T = GP.T, t = new Uint8Array(N * N), b = new Uint8Array(N * N), ed = [null], obj = [], estac = [];
    const set = (x, y, v, id) => { if (x < 0 || y < 0 || x >= N || y >= N) return; t[y * N + x] = v; if (id !== undefined) b[y * N + x] = id; };
    const get = (x, y) => x < 0 || y < 0 || x >= N || y >= N ? 6 : t[y * N + x];
    for (let i = 0; i < N; i++) { set(i, 0, 6); set(i, N - 1, 6); set(0, i, 6); set(N - 1, i, 6); }
    const tipos = ["banco", "banco", "joyeria", "joyeria", "museo", "comisaria", "reducidor", "reducidor", "reducidor", "plaza", "plaza", "plaza", "plaza", "plaza",
      "deposito", "deposito", "farmacia", "farmacia", "farmacia", "kiosco", "kiosco", "kiosco", "kiosco"];
    while (tipos.length < GP.NB * GP.NB - 1) tipos.push("casa");
    for (let i = tipos.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [tipos[i], tipos[j]] = [tipos[j], tipos[i]]; }
    // La zona segura (lobby) va en una manzana del borde, para que de ahí se salga a la ciudad
    const bordes = []; for (let i = 0; i < GP.NB * GP.NB; i++) { const bx = i % GP.NB, by = (i / GP.NB) | 0; if (bx === 0 || by === 0 || bx === GP.NB - 1 || by === GP.NB - 1) bordes.push(i); }
    tipos.splice(bordes[Math.floor(r() * bordes.length)], 0, "segura");
    let segura = null;
    let k = 0;
    for (let by = 0; by < GP.NB; by++) for (let bx = 0; bx < GP.NB; bx++) {
      const x0 = 3 + bx * 15, y0 = 3 + by * 15, tipo = tipos[k++];
      for (let y = y0; y < y0 + 12; y++) for (let x = x0; x < x0 + 12; x++) set(x, y, 1);
      if (tipo === "segura") {
        // Cerco con cuatro entradas, piso de la zona segura y la armería en el medio
        for (let y = y0 + 1; y <= y0 + 10; y++) for (let x = x0 + 1; x <= x0 + 10; x++) {
          const borde = x === x0 + 1 || x === x0 + 10 || y === y0 + 1 || y === y0 + 10, hueco = (x === x0 + 5 || x === x0 + 6 || y === y0 + 5 || y === y0 + 6);
          set(x, y, borde && !hueco ? 2 : 9);
        }
        segura = { x0: x0 + 1, y0: y0 + 1, x1: x0 + 10, y1: y0 + 10, cx: (x0 + 6) * T, cy: (y0 + 6) * T };
        obj.push({ id: obj.length + 1, k: "armeria", ed: 0, tx: x0 + 5, ty: y0 + 3, x: (x0 + 6) * T, y: (y0 + 3.5) * T });
        continue;
      }
      if (tipo === "plaza") {
        for (let y = y0 + 1; y < y0 + 11; y++) for (let x = x0 + 1; x < x0 + 11; x++) set(x, y, 4);
        for (let n = 0; n < 7; n++) { const x = x0 + 2 + Math.floor(r() * 8), y = y0 + 2 + Math.floor(r() * 8); if ((x + y) % 2) set(x, y, 5); }
        // Arbustos en grupitos (escondites)
        for (let n = 0; n < 4; n++) { const x = x0 + 2 + Math.floor(r() * 7), y = y0 + 2 + Math.floor(r() * 7); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) if (get(x + dx, y + dy) === 4) set(x + dx, y + dy, 7); }
        continue;
      }
      const id = ed.length, E = { id, tipo, x0: x0 + 1, y0: y0 + 1, x1: x0 + 10, y1: y0 + 10 }, D = GP.EDIF[tipo];
      ed.push(E);
      for (let y = y0 + 1; y <= y0 + 10; y++) for (let x = x0 + 1; x <= x0 + 10; x++) {
        const borde = x === x0 + 1 || x === x0 + 10 || y === y0 + 1 || y === y0 + 10;
        set(x, y, borde ? 2 : 3, id);
      }
      const lados = [0, 1, 2, 3].sort(() => r() - 0.5).slice(0, 1 + (r() < 0.6 ? 1 : 0)), m = 4 + Math.floor(r() * 2);
      const puertas = [];
      for (const l of lados) for (let d = 0; d < 2; d++) {
        const [px, py, nx, ny] = l === 0 ? [x0 + 1 + m + d, y0 + 1, 0, 1] : l === 1 ? [x0 + 1 + m + d, y0 + 10, 0, -1] : l === 2 ? [x0 + 1, y0 + 1 + m + d, 1, 0] : [x0 + 10, y0 + 1 + m + d, -1, 0];
        set(px, py, 3, id); puertas.push([px, py, nx, ny]);
      }
      if (D.tier >= 1 || r() < 0.5) {
        const vert = r() < 0.5, p = 5 + Math.floor(r() * 2), hueco = 3 + Math.floor(r() * 4);
        for (let q = 2; q <= 9; q++) if (q !== hueco && q !== hueco + 1) vert ? set(x0 + p, y0 + q, 2, id) : set(x0 + q, y0 + p, 2, id);
      }
      const piso = () => { for (let i = 0; i < 60; i++) { const x = E.x0 + 1 + Math.floor(r() * 8), y = E.y0 + 1 + Math.floor(r() * 8); if (get(x, y) === 3 && !obj.some(o => o.tx === x && o.ty === y) && !puertas.some(p => Math.abs(p[0] - x) + Math.abs(p[1] - y) < 2)) return [x, y]; } return [E.x0 + 2, E.y0 + 2]; };
      const pone = (tipoO, tx, ty) => obj.push({ id: obj.length + 1, k: tipoO, ed: id, tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T });
      if (D.alarma) { // el panel, justo adentro de la primera puerta
        const [px, py, nx, ny] = puertas[0], cx = px + nx + (nx ? 0 : -1), cy = py + ny + (ny ? 0 : -1);
        if (get(cx, cy) === 3) pone("alarma", cx, cy); else { const [a, c] = piso(); pone("alarma", a, c); }
      }
      for (let i = 0; i < (D.cajas || 0); i++) { const [a, c] = piso(); pone("caja", a, c); }
      if (D.tienda) { const [a, c] = piso(); pone("tienda", a, c); }
    }
    // Contenedores en las veredas (escondites)
    for (let n = 0, intentos = 0; n < 45 && intentos < 2000; intentos++) {
      const x = 1 + Math.floor(r() * (N - 2)), y = 1 + Math.floor(r() * (N - 2));
      if (get(x, y) !== 1) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(x + dx, y + dy) === 3 || get(x + dx, y + dy) === 8)) continue;
      set(x, y, 8); n++;
    }
    // Lugares para autos estacionados: calles junto a la vereda (no en las esquinas)
    for (let n = 0, intentos = 0; n < 40 && intentos < 4000; intentos++) {
      const x = 1 + Math.floor(r() * (N - 2)), y = 1 + Math.floor(r() * (N - 2));
      if (get(x, y) !== 0) continue;
      const hor = y % 15 <= 2, ver = x % 15 <= 2; if (hor === ver) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(x + dx, y + dy) === 1)) continue;
      if (estac.some(e => Math.abs(e.tx - x) + Math.abs(e.ty - y) < 4)) continue;
      estac.push({ tx: x, ty: y, x: (x + 0.5) * T, y: (y + 0.5) * T, a: hor ? (r() < 0.5 ? 0 : Math.PI) : (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2) }); n++;
    }
    // Salidas: en las calles del borde, en lados distintos
    const cand = [];
    for (let kk = 1; kk < GP.NB; kk++) { const c = (kk * 15 + 1.5) * T; cand.push({ x: 1.6 * T, y: c, lado: 0 }, { x: (N - 1.6) * T, y: c, lado: 1 }, { x: c, y: 1.6 * T, lado: 2 }, { x: c, y: (N - 1.6) * T, lado: 3 }); }
    const salidas = [], usados = new Set();
    while (salidas.length < 4) { const c = cand[Math.floor(r() * cand.length)]; if (usados.has(c.lado)) continue; usados.add(c.lado); salidas.push({ x: c.x, y: c.y }); }
    return { t, b, ed, obj, estac, salidas, segura, semilla };
  },
  solido(M, x, y) { const N = GP.N; if (x < 0 || y < 0 || x >= N || y >= N) return true; const v = M.t[y * N + x]; return v === 2 || v === 5 || v === 6; },
  // Por dónde puede andar un auto: solo calle y vereda
  pisableAuto(M, x, y) { const N = GP.N; if (x < 0 || y < 0 || x >= N || y >= N) return false; const v = M.t[y * N + x]; return v === 0 || v === 1; },
  casilla(M, px, py) { return [Math.floor(px / GP.T), Math.floor(py / GP.T)]; },
  tile(M, px, py) { const [x, y] = Golpe.casilla(M, px, py); return x < 0 || y < 0 || x >= GP.N || y >= GP.N ? 6 : M.t[y * GP.N + x]; },
  edificioEn(M, px, py) { const [x, y] = Golpe.casilla(M, px, py); if (x < 0 || y < 0 || x >= GP.N || y >= GP.N) return 0; return M.t[y * GP.N + x] === 3 ? M.b[y * GP.N + x] : 0; },
  enSegura(M, px, py) { return Golpe.tile(M, px, py) === 9; },
  escondite(M, px, py) { const v = Golpe.tile(M, px, py); return v === 7 || v === 8; },
  libre(M, x, y, r) {
    const T = GP.T, x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (Golpe.solido(M, tx, ty)) return false;
    return true;
  },
  libreAuto(M, x, y, r) {
    const T = GP.T, x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (!Golpe.pisableAuto(M, tx, ty)) return false;
    return true;
  },
  mover(M, o, dx, dy) {
    const r = GP.R;
    if (dx && Golpe.libre(M, o.x + dx, o.y, r)) o.x += dx;
    if (dy && Golpe.libre(M, o.x, o.y + dy, r)) o.y += dy;
  },
  linea(M, x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 14);
    for (let i = 1; i < n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n; if (Golpe.solido(M, Math.floor(x / GP.T), Math.floor(y / GP.T))) return false; }
    return true;
  },
  /* Camino por la grilla. Con soloCalle, solo por donde andan los autos. */
  camino(M, ax, ay, bx, by, soloCalle) {
    const N = GP.N, ini = ay * N + ax, fin = by * N + bx, pasa = soloCalle ? (x, y) => Golpe.pisableAuto(M, x, y) : (x, y) => !Golpe.solido(M, x, y);
    if (!pasa(bx, by) || ini === fin) return ini === fin ? [] : null;
    const prev = new Int32Array(N * N).fill(-1), cola = new Int32Array(N * N); let h = 0, q = 0;
    cola[q++] = ini; prev[ini] = ini;
    while (h < q) {
      const c = cola[h++]; if (c === fin) break;
      const x = c % N, y = (c / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, n = ny * N + nx;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || prev[n] !== -1 || !pasa(nx, ny)) continue;
        prev[n] = c; cola[q++] = n;
      }
    }
    if (prev[fin] === -1) return null;
    const out = []; for (let c = fin; c !== ini; c = prev[c]) out.push([c % N, (c / N) | 0]);
    return out.reverse();
  },
  pisoAzar(M, r, E) { for (let i = 0; i < 80; i++) { const x = E.x0 + 1 + Math.floor(r() * (E.x1 - E.x0 - 1)), y = E.y0 + 1 + Math.floor(r() * (E.y1 - E.y0 - 1)); if (M.t[y * GP.N + x] === 3) return [x, y]; } return [E.x0 + 1, E.y0 + 1]; },
  calleAzar(M, r, soloCalle) { for (let i = 0; i < 300; i++) { const x = 1 + Math.floor(r() * (GP.N - 2)), y = 1 + Math.floor(r() * (GP.N - 2)); const v = M.t[y * GP.N + x]; if (v === 0 || (!soloCalle && v === 1)) return [x, y]; } return [2, 2]; },
  entrada(s, lejosDe) {
    const N = GP.N, T = GP.T;
    for (let i = 0; i < 60; i++) {
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
  artefacto(tier, minR = 0) { const a = Math.min(GP.ART.length - 1, Math.floor(Math.random() * (GP.ART.length - 4 + tier * 2))), r = Math.max(minR, Golpe.rareza(tier)); return { k: "art", a, r, v: Math.round(GP.ART[a][2] * GP.MULT[r] * (0.85 + Math.random() * 0.3) / 10) * 10 }; },
  armaAzar(tier) { const tipos = ["pistola", "subfusil", "escopeta", "rifle"]; return { k: "arma", a: tipos[Math.floor(Math.random() * tipos.length)], r: Golpe.rareza(tier) }; },
  soltar(s, it, x, y) { const a = Math.random() * 6.28, d = 10 + Math.random() * 22; it.id = ++s.nId; it.x = x + Math.cos(a) * d; it.y = y + Math.sin(a) * d; if (!Golpe.libre(s.M, it.x, it.y, 4)) { it.x = x; it.y = y; } s.items.push(it); },
  llenar(s) {
    const M = s.M, T = GP.T;
    for (const E of M.ed.slice(1)) {
      const D = GP.EDIF[E.tipo], poner = it => { const [x, y] = Golpe.pisoAzar(M, Math.random, E); Golpe.soltar(s, it, (x + 0.5) * T, (y + 0.5) * T); };
      const n = D.cosas[0] + Math.floor(Math.random() * (D.cosas[1] - D.cosas[0] + 1));
      for (let i = 0; i < n; i++) poner(Golpe.artefacto(D.tier));
      if (E.tipo !== "reducidor") {
        for (let i = 0; i < (D.armas || (Math.random() < 0.4 ? 1 : 0)); i++) poner(Golpe.armaAzar(D.tier));
        for (let i = 0; i < (D.chalecos || (Math.random() < 0.22 ? 1 : 0)); i++) poner({ k: "chaleco", n: Math.min(3, 1 + (Golpe.rareza(D.tier) >> 1)) });
        for (let i = 0; i < (D.curas || (Math.random() < 0.35 ? 1 : 0)); i++) poner({ k: "cura" });
        for (let i = 0; i < (D.bolsos || (Math.random() < 0.15 ? 1 : 0)); i++) poner({ k: "bolso", n: GP.BOLSOS[1 + Math.min(2, Golpe.rareza(D.tier) >> 1)] });
        if (Math.random() < (D.llaves || 0.08)) poner({ k: "llave" });
      }
    }
    // Alarmas y cajas fuertes
    s.alarmas = {}; s.cajas = {};
    for (const o of M.obj) { if (o.k === "alarma") s.alarmas[o.ed] = { on: true, son: 0, panel: o.id }; if (o.k === "caja") s.cajas[o.id] = { ab: false }; }
    // Autos estacionados; los dos más cerca de la comisaría son patrulleros
    const C = M.ed.find(e => e && e.tipo === "comisaria"), cc = { x: (C.x0 + 5) * T, y: (C.y0 + 5) * T };
    const lugares = M.estac.slice().sort((a, b) => Math.hypot(a.x - cc.x, a.y - cc.y) - Math.hypot(b.x - cc.x, b.y - cc.y));
    lugares.forEach((e, i) => {
      if (i >= 2 && Math.random() < 0.3) return;
      const tipo = i < 2 ? "patrullero" : "auto";
      s.autos.push({ id: "a" + (++s.nId), tipo, x: e.x, y: e.y, ang: e.a, v: 0, cond: null, color: tipo === "patrullero" ? "#f8f9fa" : GP.COLORES_AUTO[Math.floor(Math.random() * GP.COLORES_AUTO.length)], baul: [], cupo: GP.AUTO[tipo].cupo });
    });
  },
  valor(J) { return J.moch.reduce((a, it) => a + (it.v || 0), 0); },
  botin(J) { return Golpe.valor(J) + (J.plata || 0); },
  puntajeArma(a) { if (!a) return 0; const W = GP.ARMAS[a.a]; return W.dmg * W.bal / W.cad * (1 + 0.15 * a.r) + a.r * 25; },
  rango(xp) { let r = 0; GP.RANGOS.forEach((R, i) => { if (xp >= R[2]) r = i; }); return r; },

  /* ---------- Jugadores ---------- */
  kitBase() { return { arma: null, chaleco: 0, bolso: 10 }; },
  limpiarKit(k) {
    const b = Golpe.kitBase(); if (!k || typeof k !== "object") return b;
    const arma = k.arma && GP.ARMAS[k.arma.a] ? { a: k.arma.a, r: Math.max(0, Math.min(4, k.arma.r | 0)) } : null;
    return { arma, chaleco: Math.max(0, Math.min(3, k.chaleco | 0)), bolso: GP.BOLSOS.includes(k.bolso) ? k.bolso : 10 };
  },
  armar(J, rol) {
    J.rol = rol; J.hp = J.hpMax = rol === "policia" ? 120 : 100; J.moch = []; J.plata = 0; J.llaves = 0; J.est = "vivo"; J.ext = 0; J.cd = 0; J.ang = J.ang || 0; J.trab = null;
    J.cupo = 10; J.arma = null; J.chaleco = 0; J.cura = 1;
    if (rol === "ladron") { const K = J.cpu ? { arma: Math.random() < 0.4 ? { a: "pistola", r: Math.random() < 0.3 ? 1 : 0 } : null, chaleco: Math.random() < 0.3 ? 1 : 0, bolso: 10 } : Golpe.limpiarKit(J.kit); J.arma = K.arma ? { ...K.arma } : null; J.chaleco = K.chaleco; J.cupo = K.bolso; }
    if (rol === "policia") { const R = GP.RANGOS[J.rango = Golpe.rango((J.xp || 0) + (J.arrTurno || 0))]; J.arma = { ...R[3] }; J.chaleco = R[4]; J.cura = 2; }
    J.incaut = J.incaut || []; J.premio = null;
    J.team = J.cpu ? (rol === "policia" ? "pol" : J.id) : rol === "policia" ? "pol" : "h-" + rol;
    J.in = { mx: 0, my: 0, ax: 0, ay: 0, f: false };
  },
  bot(s, rol) {
    const nombres = GP.NOMBRES[rol], usados = new Set(s.jug.map(j => j.name));
    let name = nombres.find(n => !usados.has(n)) || nombres[Math.floor(Math.random() * nombres.length)] + " " + (2 + Math.floor(Math.random() * 8));
    const J = { id: "b" + (++s.nBot), name, cpu: true, nivel: s.nivel, look: { color: COLORES[Math.floor(Math.random() * COLORES.length)], acc: [] }, kills: 0, arrestos: 0, confis: 0, xp: rol === "policia" ? [0, 3, 3, 8, 8, 15][Math.floor(Math.random() * 6)] : 0 };
    Golpe.armar(J, rol);
    const p = rol === "policia" ? Golpe.enComisaria(s) : Golpe.entrada(s, s.jug.filter(j => !j.cpu && j.est === "vivo"));
    J.x = p.x; J.y = p.y; J.bldg = Golpe.edificioEn(s.M, J.x, J.y); J.nace = s.t;
    s.jug.push(J);
    // Algunos civiles andan en auto
    if (rol === "civil" && Math.random() < 0.35) {
      const a = s.autos.filter(a => a.tipo === "auto" && !a.cond && !a.nuncaBot).sort((a, b) => Math.hypot(a.x - J.x, a.y - J.y) - Math.hypot(b.x - J.x, b.y - J.y))[0];
      if (a && Math.hypot(a.x - J.x, a.y - J.y) < 1400) { a.cond = J.id; J.auto = a.id; J.x = a.x; J.y = a.y; J.bldg = 0; }
    }
    return J;
  },
  enComisaria(s) {
    const E = s.M.ed.find(e => e && e.tipo === "comisaria"), T = GP.T;
    for (let i = 0; i < 30; i++) { const [x, y] = Golpe.pisoAzar(s.M, Math.random, E); const px = (x + 0.5) * T, py = (y + 0.5) * T; if (Golpe.libre(s.M, px, py, GP.R)) return { x: px, y: py }; }
    return { x: (E.x0 + 2) * T, y: (E.y0 + 2) * T };
  },
  nombreVisible(J) { const n = J.clan ? `[${J.clan}] ${J.name}` : J.name; return J.rol === "policia" ? `${GP.RANGOS[J.rango || 0][1]} ${n}` : n; },
  limpiarTag(t) { t = String(t || "").toUpperCase(); return /^[A-Z0-9]{2,4}$/.test(t) ? t : ""; },

  /* ---------- Partida ---------- */
  crear(humanos, cfg) {
    const semilla = Math.floor(Math.random() * 1e9);
    const s = { id: Turnero.nuevoId("gp"), semilla, M: Golpe.mapa(semilla), fase: "juego", t: -3, mov: 0, local: !!cfg.local,
      nivel: cfg.nivel || "normal", dens: GP.DENS[cfg.dens] ? cfg.dens : "normal", jug: [], items: [], balas: [], autos: [], feed: [], hits: [], nId: 0, nBot: 0, respawn: [] };
    for (const h of humanos) s.jug.push({ ...h, cpu: false, kills: 0, arrestos: 0, confis: 0, rol: "civil", kit: Golpe.limpiarKit(h.kit), xp: Math.max(0, Math.min(999, h.xp | 0)), banco: Math.max(0, Math.min(1e7, h.banco | 0)), gastoPend: 0, clan: Golpe.limpiarTag(h.clan), runs: [], ganado: 0, escapes: 0, arrTurno: 0, castigo: 0 });
    Golpe.llenar(s);
    Golpe.arrancar(s);
    return s;
  },
  arrancar(s) {
    const humanos = s.jug.filter(j => !j.cpu), Z = s.M.segura, g = { x: Z.cx, y: Z.cy + 60 };
    for (const J of humanos) {
      Golpe.armar(J, "civil");
      let p = { x: g.x + (Math.random() - 0.5) * 120, y: g.y + (Math.random() - 0.5) * 60 }; if (!Golpe.libre(s.M, p.x, p.y, GP.R)) p = { x: g.x, y: g.y };
      J.x = p.x; J.y = p.y; J.bldg = 0; J.seguro = true;
    }
    // Un auto libre cerca de donde entran (para que se pueda arrancar manejando)
    const lib = s.autos.filter(a => a.tipo === "auto").sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0];
    if (lib) lib.nuncaBot = true;
    const [nl, np, nc] = GP.DENS[s.dens];
    for (let i = 0; i < nl; i++) Golpe.bot(s, "ladron");
    for (let i = 0; i < np; i++) Golpe.bot(s, "policia");
    for (let i = 0; i < nc; i++) Golpe.bot(s, "civil");
  },
  policias(s) { return s.jug.filter(j => j.rol === "policia" && (j.est === "vivo" || j.est === "caido")).length; },
  nota(s, J, txt) { J.nota = { txt, t: s.t }; },
  convertir(s, J, rol) {
    if (J.est !== "vivo" || J.rol !== "civil") return;
    if (rol === "policia" && !(J.bldg && s.M.ed[J.bldg].tipo === "comisaria")) return;
    if (rol === "policia" && Golpe.policias(s) >= GP.MAX_POLI) { Golpe.nota(s, J, `La comisaría está completa (${GP.MAX_POLI} policías). Esperá a que alguien termine su turno.`); return; }
    if (J.auto) Golpe.bajar(s, J);
    const { x, y, cura } = J;
    if (rol === "policia") { J.incaut = []; J.confis = 0; J.arrTurno = 0; }
    Golpe.armar(J, rol); J.x = x; J.y = y; J.cura = Math.max(J.cura, cura);
    if (rol === "policia") { J.turnoDesde = s.t; if (J.cpu) J.turnoFin = s.t + 200 + Math.random() * 240; Golpe.aviso(s, `${J.name} entró a la policía como ${GP.RANGOS[J.rango][0].toLowerCase()}`); }
    if (J.cpu) delete J.ia;
  },
  /* Lo que cobra un policía al terminar el turno: sueldo + una parte de lo confiscado + algunos ítems incautados */
  cerrarTurno(J) {
    if (J.rol !== "policia" || J.premio != null) return;
    const items = J.incaut.slice().sort(() => Math.random() - 0.5).slice(0, GP.QUEDA);
    J.premioItems = items;
    J.premio = GP.RANGOS[J.rango || 0][5] + Math.round(J.confis * GP.PARTE / 10) * 10 + items.reduce((a, it) => a + (it.v || 0), 0);
  },
  /* El policía deja de trabajar (en la comisaría): cobra y deja el lugar libre para otro */
  terminarTurno(s, J) {
    if (J.rol !== "policia" || J.est !== "vivo" || !(J.bldg && s.M.ed[J.bldg].tipo === "comisaria")) return;
    Golpe.cerrarTurno(J);
    const premio = J.premio || 0;
    Golpe.run(s, J, "turno", { plata: premio, arrestos: J.arrTurno || 0 });
    J.xp = (J.xp || 0) + (J.arrTurno || 0);
    Golpe.aviso(s, `${Golpe.nombreVisible(J)} terminó su turno y cobró $${premio}`);
    const { x, y } = J, kit = J.kit;
    Golpe.armar(J, "civil"); J.x = x; J.y = y; J.kit = kit; J.arrTurno = 0; J.confis = 0; J.incaut = []; J.castigo = 0;
    if (J.cpu) { J.nace = s.t - 9999; delete J.ia; }
  },
  /* Una "vuelta" de una persona: escape, arresto, muerte, turno o cierre. Se guarda en el momento (cada teléfono
     la manda al servidor). gasto: lo que salió de la plata guardada en la armería desde la vuelta anterior. */
  run(s, J, tipo, extra) {
    if (J.cpu) return;
    J.nRun = (J.nRun || 0) + 1;
    const r = Object.assign({ id: `${s.id.slice(-10)}-${String(J.id).slice(-10)}-${J.nRun}`, tipo, rol: J.rol, escapo: tipo === "escape", plata: 0, gasto: J.gastoPend || 0, arrestos: 0, guarida: [], t: Math.round(s.t) }, extra);
    J.gastoPend = 0; J.banco = Math.max(0, (J.banco || 0) + r.plata); J.ganado = (J.ganado || 0) + r.plata;
    if (r.escapo) J.escapes = (J.escapes || 0) + 1;
    J.runs.push(r); if (J.runs.length > 40) J.runs.shift();
    J.ultRun = { tipo, plata: r.plata, t: s.t };
  },
  /* Vuelve a la zona segura (su casa) y al rato reaparece como civil, con el equipo que le quedó */
  aCasa(s, J, kit) {
    J.kit = Golpe.limpiarKit(kit); J.est = "casa"; J.vuelve = s.t + GP.CASA; J.auto = null; J.trab = null; J.moch = []; J.plata = 0; J.llaves = 0;
  },
  aviso(s, txt) { s.feed.push({ txt, t: s.t }); if (s.feed.length > 6) s.feed.shift(); },

  tick(s, dt) {
    if (s.fase === "fin") return;
    s.t += dt;
    if (s.t < 0) return;
    const M = s.M;
    for (const J of s.jug) {
      // Policías humanos que cayeron: vuelven a la comisaría
      if (J.est === "caido" && s.t >= J.vuelve) {
        const p = Golpe.enComisaria(s); const { incaut, confis, arrestos, arrTurno, kills, castigo, kit } = J;
        Golpe.armar(J, "policia"); Object.assign(J, { incaut, confis, arrestos, arrTurno, kills, castigo, kit, x: p.x, y: p.y, bldg: Golpe.edificioEn(M, p.x, p.y), prot: 4 });
      }
      // De vuelta en la zona segura, como civil
      if (J.est === "casa" && s.t >= J.vuelve) {
        const Z = s.M.segura, kit = J.kit; Golpe.armar(J, "civil"); J.kit = kit;
        let p = { x: Z.cx + (Math.random() - 0.5) * 120, y: Z.cy + 40 + (Math.random() - 0.5) * 60 }; if (!Golpe.libre(M, p.x, p.y, GP.R)) p = { x: Z.cx, y: Z.cy + 60 };
        J.x = p.x; J.y = p.y; J.bldg = 0; J.seguro = true;
      }
      // Cuanto más aguanta vivo un policía, menos tarda en volver la próxima vez que caiga
      if (J.rol === "policia" && J.est === "vivo" && J.castigo > 0) J.castigo = Math.max(0, J.castigo - dt / 10);
      if (J.est !== "vivo") continue;
      if (J.cpu) Golpe.pensar(s, J, dt);
      const I = J.in;
      if (Math.hypot(I.ax, I.ay) > 0.25) J.ang = Math.atan2(I.ay, I.ax);
      J.cd -= dt; if (J.prot > 0) J.prot -= dt;
      if (J.auto) {
        const A = s.autos.find(a => a.id === J.auto);
        if (!A) { J.auto = null; continue; }
        Golpe.manejar(s, A, I, dt); J.x = A.x; J.y = A.y; J.bldg = 0; J.escondido = false; J.seguro = false;
      } else {
        let mx = I.mx, my = I.my; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
        const vel = GP.VEL * (J.rol === "civil" ? 1.1 : 1) * (J.moch.length > J.cupo * 0.7 ? 0.9 : 1) * (J.trab ? 0.4 : 1);
        Golpe.mover(M, J, mx * vel * dt, my * vel * dt);
        if (Math.hypot(I.ax, I.ay) <= 0.25 && m > 0.2) J.ang = Math.atan2(my, mx);
        // No se atraviesan los autos
        for (const A of s.autos) { const dx = J.x - A.x, dy = J.y - A.y, d = Math.hypot(dx, dy); if (d < 30 && d > 0.1) { const nx = A.x + dx / d * 30, ny = A.y + dy / d * 30; if (Golpe.libre(M, nx, ny, GP.R)) { J.x = nx; J.y = ny; } } }
        J.seguro = Golpe.enSegura(M, J.x, J.y);
        if (I.f && J.arma && J.rol !== "civil" && J.cd <= 0 && !J.seguro) Golpe.disparar(s, J);
        J.bldg = Golpe.edificioEn(M, J.x, J.y);
        J.escondido = Golpe.escondite(M, J.x, J.y);
        Golpe.juntar(s, J);
        Golpe.trabajar(s, J, dt);
      }
      // Salida (a pie o en auto)
      if (J.rol !== "policia" && s.M.salidas.some(o => Math.hypot(o.x - J.x, o.y - J.y) < GP.SALIDA_R)) {
        J.ext += dt;
        if (J.ext >= GP.ESCAPE) Golpe.escapar(s, J);
      } else J.ext = 0;
    }
    // Autos sin conductor: frenan solos
    for (const A of s.autos) if (!A.cond && A.v) { A.v *= Math.pow(0.05, dt); if (Math.abs(A.v) < 5) A.v = 0; else Golpe.moverAuto(s, A, dt); }
    Golpe.balas(s, dt);
    s.hits = s.hits.filter(h => s.t - h.t < 0.7);
    for (const a of Object.values(s.alarmas)) if (a.son && s.t > a.son) a.son = 0;
    for (const r of s.respawn.slice()) if (s.t >= r.t && s.t < GP.DURACION - 40) { s.respawn.splice(s.respawn.indexOf(r), 1); Golpe.bot(s, r.rol); }
    if (s.jug.length > 70) s.jug = s.jug.filter(j => !j.cpu || j.est === "vivo" || s.t - (j.fin || 0) < 30);
    const humanos = s.jug.filter(j => !j.cpu);
    if (s.t >= GP.DURACION) Golpe.terminar(s);
  },
  escapar(s, J) {
    if (J.auto) { const A = s.autos.find(a => a.id === J.auto); if (A) { J.moch.push(...A.baul); A.baul = []; s.autos.splice(s.autos.indexOf(A), 1); } J.auto = null; }
    if (J.cpu) { J.est = "escapo"; J.fin = s.t; if (J.rol === "ladron") Golpe.aviso(s, `${J.name} escapó`); s.respawn.push({ rol: J.rol === "policia" ? "civil" : J.rol, t: s.t + 15 }); return; }
    if (J.rol === "ladron") {
      // Escapó: se queda con la plata, lo que no vendió va a su guarida y conserva el equipo
      const gear = { arma: J.arma, chaleco: J.chaleco, bolso: J.cupo }, v = Golpe.botin(J);
      Golpe.run(s, J, "escape", { plata: J.plata, guarida: J.moch.map(it => ({ a: it.a, r: it.r, v: it.v })), kit: gear });
      Golpe.aviso(s, `${J.name} escapó${v ? ` con $${v}` : ""}`);
      Golpe.aCasa(s, J, gear);
    } else {
      if (J.gastoPend) Golpe.run(s, J, "cierre", { kit: J.kit });
      Golpe.aCasa(s, J, J.kit);
    }
  },
  /* Fin de la sesión: los policías cobran su turno; los ladrones en la calle pierden lo que llevan (no el equipo) */
  terminar(s) {
    if (s.fase === "fin") return;
    for (const J of s.jug) {
      if (J.cpu) continue;
      if (J.rol === "policia" && (J.est === "vivo" || J.est === "caido")) { Golpe.cerrarTurno(J); Golpe.run(s, J, "turno", { plata: J.premio || 0, arrestos: J.arrTurno || 0 }); }
      else if (J.rol === "ladron" && J.est === "vivo") Golpe.run(s, J, "tiempo", { kit: { arma: J.arma, chaleco: J.chaleco, bolso: J.cupo } });
      else if (J.gastoPend) Golpe.run(s, J, "cierre", { kit: J.kit });
      J.fin = s.t;
    }
    Golpe.ordenar(s); s.fase = "fin"; s.mov++;
  },
  puntaje(J) { return J.ganado || 0; },
  ordenar(s) { s.jug.filter(j => !j.cpu).sort((a, b) => Golpe.puntaje(b) - Golpe.puntaje(a) || b.kills - a.kills).forEach((j, k) => j.puesto = k + 1); },

  /* ---------- Juntar cosas ---------- */
  juntar(s, J) {
    for (let i = s.items.length - 1; i >= 0; i--) {
      const it = s.items[i]; if (Math.hypot(it.x - J.x, it.y - J.y) > 28) continue;
      const L = J.rol === "ladron";
      if (it.k === "art" && L && J.moch.length < J.cupo) { J.moch.push({ k: "art", a: it.a, r: it.r, v: it.v }); s.items.splice(i, 1); J.junto = s.t; Golpe.robo(s, J); }
      else if (it.k === "plata" && L) { J.plata += it.v; s.items.splice(i, 1); J.junto = s.t; }
      else if (it.k === "llave" && L && J.llaves < 3) { J.llaves++; s.items.splice(i, 1); J.junto = s.t; }
      else if (it.k === "bolso" && L && it.n > J.cupo) { if (J.cupo > 10) Golpe.soltar(s, { k: "bolso", n: J.cupo }, J.x, J.y); J.cupo = it.n; s.items.splice(i, 1); J.junto = s.t; }
      else if (it.k === "cura" && J.rol !== "civil" && J.cura < 3) { J.cura++; s.items.splice(i, 1); J.junto = s.t; }
      else if (it.k === "chaleco" && J.rol !== "civil" && it.n > J.chaleco) { const viejo = J.chaleco; J.chaleco = it.n; s.items.splice(i, 1); if (viejo) Golpe.soltar(s, { k: "chaleco", n: viejo }, J.x, J.y); J.junto = s.t; }
      else if (it.k === "arma" && !J.arma && J.rol !== "civil") { J.arma = { a: it.a, r: it.r }; s.items.splice(i, 1); J.junto = s.t; }
    }
  },
  /* Robar adentro de un edificio con la alarma conectada la hace sonar */
  robo(s, J) {
    const A = J.bldg && s.alarmas[J.bldg];
    if (!A || !A.on || A.son) return;
    A.son = s.t + GP.ALARMA;
    const tipo = s.M.ed[J.bldg].tipo, lugar = { casa: "una casa", kiosco: "un kiosco", farmacia: "una farmacia", deposito: "un depósito", joyeria: "una joyería", banco: "un banco", museo: "el museo" }[tipo] || "un local";
    Golpe.aviso(s, `¡Suena la alarma en ${lugar}!`);
  },
  /* Trabajos que llevan unos segundos: desactivar una alarma o abrir una caja fuerte */
  trabajar(s, J, dt) {
    if (!J.trab) return;
    const o = s.M.obj.find(o => o.id === J.trab.obj);
    if (!o || Math.hypot(o.x - J.x, o.y - J.y) > 52) { J.trab = null; return; }
    J.trab.t += dt;
    if (J.trab.t < J.trab.dur) return;
    if (J.trab.tipo === "alarma") { const A = s.alarmas[o.ed]; if (A) { A.on = false; A.son = 0; } }
    if (J.trab.tipo === "caja") {
      const C = s.cajas[o.id];
      if (C && !C.ab && J.llaves > 0) {
        C.ab = true; J.llaves--;
        Golpe.robo(s, J);
        const n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) Golpe.soltar(s, Golpe.artefacto(3, 2), o.x, o.y);
        Golpe.soltar(s, { k: "plata", v: 300 + Math.round(Math.random() * 90) * 10 }, o.x, o.y);
      }
    }
    J.trab = null;
  },
  cerca(s, J, k, r = 52) { return s.M.obj.filter(o => o.k === k && Math.hypot(o.x - J.x, o.y - J.y) < r).sort((a, b) => Math.hypot(a.x - J.x, a.y - J.y) - Math.hypot(b.x - J.x, b.y - J.y))[0]; },
  autoCerca(s, J, r = 56) { return s.autos.filter(a => Math.hypot(a.x - J.x, a.y - J.y) < r).sort((a, b) => Math.hypot(a.x - J.x, a.y - J.y) - Math.hypot(b.x - J.x, b.y - J.y))[0]; },
  usar(s, J, q) {
    if (J.est !== "vivo") return;
    const L = J.rol === "ladron";
    if (q === "vender" && L && !J.auto) {
      const o = Golpe.cerca(s, J, "tienda", 70); if (!o || !J.moch.length) return;
      const v = Golpe.valor(J); J.plata += v; J.moch = []; J.vendio = { v, t: s.t };
    } else if (q === "alarma" && L && !J.auto) {
      const o = Golpe.cerca(s, J, "alarma"); if (!o || !s.alarmas[o.ed] || !s.alarmas[o.ed].on) return;
      J.trab = { tipo: "alarma", obj: o.id, t: 0, dur: GP.DESACTIVAR };
    } else if (q === "caja" && L && !J.auto) {
      const o = Golpe.cerca(s, J, "caja"); if (!o || !s.cajas[o.id] || s.cajas[o.id].ab || J.llaves < 1) return;
      J.trab = { tipo: "caja", obj: o.id, t: 0, dur: GP.ABRIR };
    } else if (q === "subir" && !J.auto) {
      const A = Golpe.autoCerca(s, J); if (!A || A.cond || (A.tipo === "patrullero" && J.rol !== "policia")) return;
      A.cond = J.id; J.auto = A.id; J.trab = null; J.x = A.x; J.y = A.y;
    } else if (q === "bajar" && J.auto) Golpe.bajar(s, J);
    else if (q === "guardar" && L && !J.auto) {
      const A = Golpe.autoCerca(s, J); if (!A || A.cond || !A.cupo || Math.abs(A.v) > 20) return;
      while (J.moch.length && A.baul.length < A.cupo) A.baul.push(J.moch.pop());
    } else if (q === "sacar" && L && !J.auto) {
      const A = Golpe.autoCerca(s, J); if (!A || A.cond || Math.abs(A.v) > 20) return;
      while (A.baul.length && J.moch.length < J.cupo) J.moch.push(A.baul.pop());
    }
  },
  /* Armería: se paga primero con la plata que llevás encima y después con la guardada */
  comprar(s, J, id) {
    if (J.est !== "vivo" || !J.seguro || J.rol === "policia" && id !== "cura") return;
    if (!Golpe.cerca(s, J, "armeria", 110)) return;
    const P = GP.TIENDA.find(p => p.id === id); if (!P) return;
    const K = J.rol === "ladron" ? { arma: J.arma, chaleco: J.chaleco, bolso: J.cupo } : J.kit || (J.kit = Golpe.kitBase());
    let precio = P.p;
    if (P.tipo === "mejora") { if (!K.arma || K.arma.r >= 4) return; precio = GP.precioMejora(K.arma.r); }
    if (P.tipo === "chaleco" && K.chaleco >= P.c) return;
    if (P.tipo === "bolso" && K.bolso >= P.c) return;
    if (P.tipo === "cura" && J.cura >= 3) return;
    if (P.tipo === "arma" && K.arma && K.arma.a === P.a && K.arma.r >= P.r) return;
    const banco = Math.max(0, J.banco || 0);
    if ((J.plata || 0) + banco < precio) { J.compra = { ok: 0, t: s.t }; return; }
    const dePlata = Math.min(J.plata || 0, precio); J.plata = (J.plata || 0) - dePlata; J.banco = banco - (precio - dePlata); J.gastoPend = (J.gastoPend || 0) + precio - dePlata;
    if (P.tipo === "arma") K.arma = { a: P.a, r: P.r };
    if (P.tipo === "mejora") K.arma = { a: K.arma.a, r: K.arma.r + 1 };
    if (P.tipo === "chaleco") K.chaleco = P.c;
    if (P.tipo === "bolso") K.bolso = P.c;
    if (P.tipo === "cura") J.cura++;
    if (J.rol === "ladron") { J.arma = K.arma; J.chaleco = K.chaleco; J.cupo = K.bolso; }
    J.compra = { ok: 1, t: s.t, n: P.n };
  },
  bajar(s, J) {
    const A = s.autos.find(a => a.id === J.auto); J.auto = null;
    if (!A) return;
    A.cond = null;
    // Se baja al costado del auto, donde haya lugar
    for (const da of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
      const x = A.x + Math.cos(A.ang + da) * 34, y = A.y + Math.sin(A.ang + da) * 34;
      if (Golpe.libre(s.M, x, y, GP.R)) { J.x = x; J.y = y; break; }
    }
    J.bldg = Golpe.edificioEn(s.M, J.x, J.y);
  },
  /* Manejo arcade: el auto gira hacia donde apunta el joystick y acelera según cuánto lo empujás */
  manejar(s, A, I, dt) {
    const m = Math.min(1, Math.hypot(I.mx, I.my)), vmax = GP.AUTO[A.tipo].vmax;
    let objetivo = 0;
    if (m > 0.15) {
      const meta = Math.atan2(I.my, I.mx); let da = Math.atan2(Math.sin(meta - A.ang), Math.cos(meta - A.ang));
      const marcha = Math.abs(da) > 2.4 && Math.abs(A.v) < 60 ? -1 : 1;   // si apuntás para atrás estando casi quieto, va en reversa
      if (marcha < 0) da = Math.atan2(Math.sin(meta + Math.PI - A.ang), Math.cos(meta + Math.PI - A.ang));
      const giro = 2.8 * dt * (0.6 + Math.min(1, Math.abs(A.v) / 160));
      A.ang += Math.max(-giro, Math.min(giro, da));
      objetivo = marcha * vmax * m * (marcha > 0 ? Math.max(0.25, Math.cos(da)) : 0.4);
    }
    const acel = objetivo === 0 ? 260 : Math.sign(objetivo) !== Math.sign(A.v) && Math.abs(A.v) > 10 ? 420 : 230;
    if (A.v < objetivo) A.v = Math.min(objetivo, A.v + acel * dt); else A.v = Math.max(objetivo, A.v - acel * dt);
    Golpe.moverAuto(s, A, dt);
  },
  moverAuto(s, A, dt) {
    const M = s.M, dx = Math.cos(A.ang) * A.v * dt, dy = Math.sin(A.ang) * A.v * dt, r = 16;
    let choco = false;
    if (Golpe.libreAuto(M, A.x + dx, A.y, r)) A.x += dx; else choco = true;
    if (Golpe.libreAuto(M, A.x, A.y + dy, r)) A.y += dy; else choco = true;
    // Choque con otros autos
    for (const B of s.autos) { if (B === A) continue; const ex = A.x - B.x, ey = A.y - B.y, d = Math.hypot(ex, ey); if (d < 34 && d > 0.1) { A.x = B.x + ex / d * 34; A.y = B.y + ey / d * 34; choco = true; if (!B.cond) B.v += A.v * 0.3; } }
    if (choco) A.v *= -0.25;
    // Empuja a la gente a pie (el que maneja rápido contra ladrones y civiles los lastima un poco)
    for (const J of s.jug) {
      if (J.est !== "vivo" || J.auto) continue;
      const ex = J.x - A.x, ey = J.y - A.y, d = Math.hypot(ex, ey);
      if (d < 30 && d > 0.1) {
        const nx = A.x + ex / d * 31, ny = A.y + ey / d * 31; if (Golpe.libre(M, nx, ny, GP.R)) { J.x = nx; J.y = ny; }
        if (Math.abs(A.v) > 170 && A.cond && (!J.golpeAuto || s.t - J.golpeAuto > 1)) {
          const C = s.jug.find(j => j.id === A.cond);
          if (C && C.rol !== "civil" && Golpe.puedeHerir({ de: C.id, rol: C.rol, team: C.team }, J)) { J.golpeAuto = s.t; Golpe.herir(s, J, { dmg: 22, pen: 4, de: C.id, rol: C.rol, vx: ex, vy: ey }); }
        }
      }
    }
  },
  agarrar(s, J) {
    if (J.rol === "civil" || J.auto) return;
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
    J.cd = W.cad * (1 - 0.05 * r); J.tiro = s.t; J.escondido = false;
  },
  puedeHerir(b, q) {
    if (q.est !== "vivo" || q.id === b.de || q.prot > 0 || q.seguro) return false;
    if (b.rol === "policia") return q.rol === "ladron";
    if (b.rol === "civil") return false;
    return q.team !== b.team;
  },
  balas(s, dt) {
    const M = s.M;
    for (let i = s.balas.length - 1; i >= 0; i--) {
      const b = s.balas[i], pasos = 4; let fuera = false;
      for (let k = 0; k < pasos && !fuera; k++) {
        b.x += b.vx * dt / pasos; b.y += b.vy * dt / pasos; b.d += Math.hypot(b.vx, b.vy) * dt / pasos;
        if (b.d > b.alc || Golpe.solido(M, Math.floor(b.x / GP.T), Math.floor(b.y / GP.T))) { fuera = true; break; }
        // Los autos frenan las balas; si alguien maneja, le llega parte del daño
        for (const A of s.autos) {
          if (Math.abs(A.x - b.x) > 24 || Math.abs(A.y - b.y) > 24) continue;
          if (Math.hypot(A.x - b.x, A.y - b.y) < 20) {
            const C = A.cond && s.jug.find(j => j.id === A.cond);
            if (C && Golpe.puedeHerir(b, C)) Golpe.herir(s, C, { ...b, dmg: b.dmg * 0.55 });
            if (!C || C.id !== b.de) { fuera = true; break; }
          }
        }
        if (fuera) break;
        for (const q of s.jug) {
          if (q.auto || Math.abs(q.x - b.x) > 20 || Math.abs(q.y - b.y) > 20 || !Golpe.puedeHerir(b, q)) continue;
          if (Math.hypot(q.x - b.x, q.y - b.y) < GP.R + 3) { Golpe.herir(s, q, b); fuera = true; break; }
        }
      }
      if (fuera) s.balas.splice(i, 1);
    }
  },
  herir(s, q, b) {
    const red = GP.CHALECO[q.chaleco] * Math.max(0, 1 - 0.22 * b.pen), d = Math.max(1, Math.round(b.dmg * (1 - red)));
    q.hp -= d; q.golpe = s.t; q.escondido = false;
    s.hits.push({ x: Math.round(q.x), y: Math.round(q.y), d, t: s.t, de: b.de, a: q.id, ch: red > 0.05 });
    const autor = s.jug.find(j => j.id === b.de);
    if (q.cpu && q.ia && autor) { q.ia.obj = autor.id; q.ia.reac = Math.min(q.ia.reac || 0, s.t + 0.25); }
    if (q.hp > 0) return;
    q.hp = 0; q.fin = s.t; q.trab = null;
    if (q.auto) Golpe.bajar(s, q);
    if (b.rol === "policia" && q.rol === "ladron") {
      // Arrestado: pierde lo robado y la plata, conserva armas, chaleco y bolso
      const v = Golpe.botin(q), gear = { arma: q.arma, chaleco: q.chaleco, bolso: q.cupo };
      if (autor) {
        autor.confis += v; autor.arrestos++; autor.arrTurno = (autor.arrTurno || 0) + 1; autor.incaut.push(...q.moch.map(it => ({ ...it })));
        const nuevo = Golpe.rango((autor.xp || 0) + autor.arrTurno);
        if (nuevo > (autor.rango || 0)) {
          autor.rango = nuevo; const R = GP.RANGOS[nuevo];
          if (Golpe.puntajeArma(R[3]) > Golpe.puntajeArma(autor.arma)) autor.arma = { ...R[3] };
          autor.chaleco = Math.max(autor.chaleco, R[4]);
          Golpe.aviso(s, `${autor.name} ascendió a ${R[0].toLowerCase()}`);
        }
      }
      Golpe.aviso(s, `${autor ? Golpe.nombreVisible(autor) : "La policía"} arrestó a ${q.name}${v ? ` · $${v} confiscados` : ""}`);
      if (q.cpu) { q.est = "preso"; q.moch = []; q.plata = 0; }
      else { Golpe.run(s, q, "preso", { kit: gear }); Golpe.aCasa(s, q, gear); return; }
    } else if (q.rol === "policia" && !q.cpu) {
      // Policía humano: cae y vuelve a la comisaría. Cada caída suma espera; aguantar vivo la va bajando (mínimo 14 s).
      if (autor) autor.kills++;
      q.est = "caido"; q.vuelve = s.t + GP.VUELVE_MIN + (q.castigo || 0); q.castigo = (q.castigo || 0) + GP.CASTIGO;
      Golpe.aviso(s, `${autor ? autor.name : "Alguien"} bajó a ${Golpe.nombreVisible(q)}: vuelve a la comisaría`);
      return;
    } else {
      // Muerto: lo deja todo tirado (un ladrón muerto pierde también armas, chaleco y bolso)
      q.est = "muerto"; if (autor) autor.kills++;
      for (const it of q.moch) Golpe.soltar(s, { ...it }, q.x, q.y);
      if (q.plata) Golpe.soltar(s, { k: "plata", v: q.plata }, q.x, q.y);
      for (let i = 0; i < (q.llaves || 0); i++) Golpe.soltar(s, { k: "llave" }, q.x, q.y);
      if (q.arma && q.rol !== "policia") Golpe.soltar(s, { k: "arma", a: q.arma.a, r: q.arma.r }, q.x, q.y);
      if (q.rol === "ladron" && q.chaleco) Golpe.soltar(s, { k: "chaleco", n: q.chaleco }, q.x, q.y);
      if (q.rol === "ladron" && q.cupo > 10) Golpe.soltar(s, { k: "bolso", n: q.cupo }, q.x, q.y);
      if (q.cura) Golpe.soltar(s, { k: "cura" }, q.x, q.y);
      q.moch = []; q.plata = 0;
      Golpe.aviso(s, `${autor ? autor.name : "Alguien"} bajó a ${Golpe.nombreVisible(q)}`);
      if (!q.cpu) { Golpe.run(s, q, "muerto", { kit: null, perdio: true }); Golpe.aCasa(s, q, null); return; }
    }
    // Los policías bot que caen se reemplazan por civiles (la policía sale de los civiles)
    if (q.cpu) s.respawn.push({ rol: q.rol === "policia" ? "civil" : q.rol, t: s.t + 18 + Math.random() * 10 });
  },

  /* ---------- Bots ---------- */
  hab(nivel) { return { facil: 0.25, normal: 0.5, dificil: 0.8 }[nivel] ?? 0.5; },
  hostil(J, q) { if (q === J || q.est !== "vivo") return false; if (J.rol === "policia") return q.rol === "ladron"; if (J.rol === "ladron") return q.team !== J.team; return false; },
  interesa(J, q, d) {
    if (J.rol !== "ladron") return true;
    const meAtaca = q.ia && q.ia.obj === J.id;
    if (meAtaca || !q.cpu) return true;
    if (q.rol === "policia") return d < 300;
    if (q.rol === "civil") return !q.auto && d < 160 && J.ia && J.ia.malo;
    return Golpe.botin(q) > 400 && Golpe.botin(J) < 200;
  },
  pensar(s, J, dt) {
    const M = s.M, IA = J.ia || (J.ia = { t: 0, camino: null, meta: null, obj: null, reac: 0, lado: 1, cambio: 0, quieto: 0, px: J.x, py: J.y, repensar: 0, meta2: 0, objetivo: (J.rol === "civil" ? 200 : 300) + Math.random() * 600, malo: Math.random() < 0.4, cuidadoso: Math.random() < 0.55, poli: J.rol === "civil" && !J.auto && Math.random() < 0.35 }), h = Golpe.hab(J.nivel);
    IA.t -= dt; IA.repensar -= dt;
    if (J.auto) return Golpe.pensarAuto(s, J, IA, dt);
    let enemigo = IA.obj ? s.jug.find(q => q.id === IA.obj) : null;
    if (IA.t <= 0) {
      IA.t = 0.22 + Math.random() * 0.15;
      const alcance = J.rol === "policia" ? 460 : J.rol === "ladron" ? 470 : 340;
      let mejor = null, md = 1e9;
      for (const q of s.jug) {
        const amenaza = J.rol === "civil" ? q.rol === "ladron" && q.est === "vivo" && !q.seguro : Golpe.hostil(J, q) && !(q.prot > 0) && !q.seguro;
        if (!amenaza) continue;
        const d = Math.hypot(q.x - J.x, q.y - J.y);
        if (q.escondido && d > 60) continue;
        if (d < alcance && d < md && (q.bldg === J.bldg || !q.bldg || !J.bldg || d < 120) && Golpe.interesa(J, q, d) && Golpe.linea(M, J.x, J.y, q.x, q.y)) { md = d; mejor = q; }
      }
      if (mejor) IA.visto = s.t;
      if (mejor && mejor.id !== IA.obj) { IA.obj = mejor.id; IA.reac = s.t + (0.85 - 0.55 * h) + Math.random() * 0.35 + (J.rol === "policia" ? 0.25 : 0); }
      if (!mejor && enemigo && (enemigo.est !== "vivo" || s.t - (IA.visto || 0) > 2.5 || Math.hypot(enemigo.x - J.x, enemigo.y - J.y) > alcance * 1.3)) IA.obj = null;
      enemigo = IA.obj ? s.jug.find(q => q.id === IA.obj) : null;
      if (J.hp < J.hpMax * 0.4 && J.cura && (!enemigo || Math.random() < 0.3)) Golpe.curar(s, J);
      if (!enemigo || J.rol === "civil") Golpe.elegirMeta(s, J, IA, !!enemigo, enemigo);
    }
    const I = J.in; I.f = false; I.ax = 0; I.ay = 0;
    if (enemigo && enemigo.est === "vivo" && J.rol !== "civil") {
      const dx = enemigo.x - J.x, dy = enemigo.y - J.y, d = Math.hypot(dx, dy) || 1, ve = Golpe.linea(M, J.x, J.y, enemigo.x, enemigo.y);
      IA.err = IA.err === undefined || Math.random() < dt * 2 ? Turnero.gauss() * (0.2 - 0.16 * h) : IA.err;
      const lead = d / 1100 * h, ex = enemigo.in ? enemigo.in.mx * GP.VEL * lead : 0, ey = enemigo.in ? enemigo.in.my * GP.VEL * lead : 0;
      const a = Math.atan2(dy + ey, dx + ex) + IA.err;
      I.ax = Math.cos(a); I.ay = Math.sin(a);
      const W = J.arma ? GP.ARMAS[J.arma.a] : null;
      I.f = ve && s.t >= IA.reac && W && d < W.alc * 0.95;
      IA.cambio -= dt; if (IA.cambio <= 0) { IA.cambio = 0.8 + Math.random() * 1.2; IA.lado = Math.random() < 0.5 ? 1 : -1; }
      const ideal = J.arma && J.arma.a === "escopeta" ? 140 : W && W.alc > 700 ? 380 : 240;
      let mx = 0, my = 0;
      if (!ve || d > ideal + 80) { const p = Golpe.siguiente(s, J, IA, enemigo.x, enemigo.y); mx = p[0]; my = p[1]; }
      else if (d < ideal - 70) { mx = -dx / d; my = -dy / d; }
      mx += -dy / d * IA.lado * 0.8; my += dx / d * IA.lado * 0.8;
      I.mx = mx; I.my = my;
    } else if (enemigo && J.rol === "civil") {
      const dx = J.x - enemigo.x, dy = J.y - enemigo.y, d = Math.hypot(dx, dy) || 1;
      if (Golpe.libre(M, J.x + dx / d * 30, J.y + dy / d * 30, GP.R)) { I.mx = dx / d; I.my = dy / d; }
      else { const p = Golpe.siguiente(s, J, IA, IA.meta ? IA.meta.x : J.x, IA.meta ? IA.meta.y : J.y); I.mx = p[0]; I.my = p[1]; }
    } else if (IA.meta) {
      const p = Golpe.siguiente(s, J, IA, IA.meta.x, IA.meta.y); I.mx = p[0]; I.my = p[1];
      // Ladrón bot: si llegó a un reducidor con cosas, vende
      if (J.rol === "ladron" && IA.meta.vender && J.moch.length) Golpe.usar(s, J, "vender");
    } else { I.mx = 0; I.my = 0; }
    IA.quieto = Math.hypot(J.x - IA.px, J.y - IA.py) < 1 && Math.hypot(I.mx, I.my) > 0.3 ? IA.quieto + dt : 0;
    IA.px = J.x; IA.py = J.y;
    if (IA.quieto > 0.8) { IA.camino = null; IA.quieto = 0; IA.meta2 = 0; I.mx = Math.random() - 0.5; I.my = Math.random() - 0.5; }
  },
  /* Civil bot manejando: va de un punto a otro por las calles y en un rato se va de la ciudad */
  pensarAuto(s, J, IA, dt) {
    const M = s.M, T = GP.T, I = J.in; I.f = false;
    const irse = s.t - (J.nace || 0) > IA.objetivo / 2 + 90;
    if (!IA.meta || IA.meta2 <= 0 || Math.hypot(IA.meta.x - J.x, IA.meta.y - J.y) < 50) {
      if (irse) { const sal = M.salidas.slice().sort((a, b) => Math.hypot(a.x - J.x, a.y - J.y) - Math.hypot(b.x - J.x, b.y - J.y))[0]; IA.meta = { x: sal.x, y: sal.y }; }
      else { const [x, y] = Golpe.calleAzar(M, Math.random, true); IA.meta = { x: (x + 0.5) * T, y: (y + 0.5) * T }; }
      IA.camino = null; IA.meta2 = 30;
    }
    IA.meta2 -= dt;
    const p = Golpe.siguiente(s, J, IA, IA.meta.x, IA.meta.y, true);
    I.mx = p[0] * 0.65; I.my = p[1] * 0.65;
    IA.quieto = Math.hypot(J.x - IA.px, J.y - IA.py) < 0.6 ? IA.quieto + dt : 0; IA.px = J.x; IA.py = J.y;
    if (IA.quieto > 1.5) { // trabado: reversa un ratito
      const A = s.autos.find(a => a.id === J.auto); if (A) A.v = -90;
      IA.camino = null; IA.quieto = 0; if (Math.random() < 0.3) IA.meta = null;
    }
  },
  elegirMeta(s, J, IA, huyendo, enemigo) {
    const M = s.M, T = GP.T;
    IA.meta2 -= 0.25;
    if (huyendo && enemigo) {
      if (!IA.meta || IA.meta2 <= 0 || Math.hypot(IA.meta.x - enemigo.x, IA.meta.y - enemigo.y) < 300) { const [x, y] = Golpe.calleAzar(M, Math.random); IA.meta = { x: (x + 0.5) * T, y: (y + 0.5) * T }; IA.camino = null; IA.meta2 = 4; }
      return;
    }
    const comisaria = () => { const E = M.ed.find(e => e && e.tipo === "comisaria"), [x, y] = Golpe.pisoAzar(M, Math.random, E); return { x: (x + 0.5) * T, y: (y + 0.5) * T, comi: true }; };
    if (J.rol === "policia" && J.turnoFin && s.t > J.turnoFin) {
      // Terminó su turno: vuelve a la comisaría, cobra y deja el lugar
      if (J.bldg && M.ed[J.bldg].tipo === "comisaria") { Golpe.terminarTurno(s, J); return; }
      if (!IA.meta || !IA.meta.comi) { IA.meta = comisaria(); IA.camino = null; }
      return;
    }
    if (J.rol === "civil" && IA.poli && Golpe.policias(s) < GP.MAX_POLI) {
      // Este civil quiere trabajar de policía
      if (J.bldg && M.ed[J.bldg].tipo === "comisaria") { Golpe.convertir(s, J, "policia"); return; }
      if (!IA.meta || !IA.meta.comi) { IA.meta = comisaria(); IA.camino = null; }
      return;
    }
    if (J.rol === "policia") {
      // Alarmas sonando: van para allá. Si no, por radio se enteran de algún ladrón, o patrullan.
      const al = Object.entries(s.alarmas).filter(([, a]) => a.son).map(([id]) => M.ed[id]).map(E => ({ E, d: Math.hypot((E.x0 + 5) * T - J.x, (E.y0 + 5) * T - J.y) })).sort((a, b) => a.d - b.d)[0];
      if (al && al.d < 2600 && (!IA.meta || !IA.meta.alarma || IA.meta.alarma !== al.E.id) && Math.random() < 0.75) {
        const [x, y] = Golpe.pisoAzar(M, Math.random, al.E); IA.meta = { x: (x + 0.5) * T, y: (y + 0.5) * T, alarma: al.E.id }; IA.camino = null; IA.meta2 = 25; return;
      }
      if (IA.meta2 <= 0) {
        IA.meta2 = 9 + Math.random() * 8;
        const l = s.jug.filter(q => q.rol === "ladron" && q.est === "vivo" && !q.escondido && Math.hypot(q.x - J.x, q.y - J.y) < 1100).sort((a, b) => Golpe.botin(b) - Golpe.botin(a))[0];
        if (l && Math.random() < 0.4) IA.meta = { x: l.x, y: l.y };
        else { const [x, y] = Golpe.calleAzar(M, Math.random); IA.meta = { x: (x + 0.5) * T, y: (y + 0.5) * T }; }
        IA.camino = null;
      }
      return;
    }
    if (J.rol === "civil") {
      const irse = s.t - (J.nace || 0) > IA.objetivo / 2 + 60;
      if (irse) { const sal = M.salidas.slice().sort((a, b) => Math.hypot(a.x - J.x, a.y - J.y) - Math.hypot(b.x - J.x, b.y - J.y))[0]; if (!IA.meta || IA.meta.x !== sal.x) { IA.meta = { x: sal.x, y: sal.y }; IA.camino = null; } return; }
      if (!IA.meta || IA.meta2 <= 0 || Math.hypot(IA.meta.x - J.x, IA.meta.y - J.y) < 30) {
        const E = M.ed[1 + Math.floor(Math.random() * (M.ed.length - 1))], [x, y] = Math.random() < 0.5 ? Golpe.pisoAzar(M, Math.random, E) : Golpe.calleAzar(M, Math.random);
        IA.meta = { x: (x + 0.5) * T, y: (y + 0.5) * T }; IA.camino = null; IA.meta2 = 14;
      }
      return;
    }
    // Ladrón bot: con el bolso lleno (o mucho valor) va a vender; con plata suficiente (o poco tiempo), se va
    const v = Golpe.valor(J), lleno = J.moch.length >= J.cupo || v >= IA.objetivo * 0.7;
    if ((J.plata >= IA.objetivo && !J.moch.length) || s.t > GP.DURACION - 90 || (lleno && Math.random() < 0.002)) {
      const sal = M.salidas.slice().sort((a, b) => Math.hypot(a.x - J.x, a.y - J.y) - Math.hypot(b.x - J.x, b.y - J.y))[0];
      if (!IA.meta || IA.meta.x !== sal.x || IA.meta.y !== sal.y) { IA.meta = { x: sal.x, y: sal.y, salida: true }; IA.camino = null; }
      return;
    }
    if (lleno) {
      const t = M.obj.filter(o => o.k === "tienda").sort((a, b) => Math.hypot(a.x - J.x, a.y - J.y) - Math.hypot(b.x - J.x, b.y - J.y))[0];
      if (t && (!IA.meta || !IA.meta.vender)) { IA.meta = { x: t.x, y: t.y, vender: true }; IA.camino = null; }
      return;
    }
    // Los ladrones cuidadosos, al entrar a un lugar con alarma, primero la desactivan
    const al = J.bldg && s.alarmas[J.bldg];
    if (IA.cuidadoso && al && al.on && !al.son) {
      const o = M.obj.find(o => o.id === al.panel);
      if (Math.hypot(o.x - J.x, o.y - J.y) < 44) { if (!J.trab) Golpe.usar(s, J, "alarma"); IA.meta = { x: J.x, y: J.y }; return; }
      if (!IA.meta || !IA.meta.panel) { IA.meta = { x: o.x, y: o.y, panel: true }; IA.camino = null; }
      return;
    }
    let mejor = null, mp = 0;
    for (const it of s.items) {
      const d = Math.hypot(it.x - J.x, it.y - J.y); if (d > 1200) continue;
      let p = 0;
      if ((it.k === "art" || it.k === "plata") && J.moch.length < J.cupo) p = it.v;
      else if (it.k === "arma") p = Math.max(0, Golpe.puntajeArma(it) - Golpe.puntajeArma(J.arma)) * 2;
      else if (it.k === "chaleco" && it.n > J.chaleco) p = 150 * (it.n - J.chaleco);
      else if (it.k === "bolso" && it.n > J.cupo) p = 120;
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
  siguiente(s, J, IA, x, y, soloCalle) {
    const M = s.M, T = GP.T, dx = x - J.x, dy = y - J.y, d = Math.hypot(dx, dy);
    if (d < 6) return [0, 0];
    if (!soloCalle && d < 260 && Golpe.linea(M, J.x, J.y, x, y) && Golpe.libre(M, J.x + dx / d * 16, J.y + dy / d * 16, GP.R)) return [dx / d, dy / d];
    const [tx, ty] = Golpe.casilla(M, x, y), [jx, jy] = Golpe.casilla(M, J.x, J.y);
    if (!IA.camino || IA.repensar <= 0 || IA.dest !== tx + "," + ty) {
      IA.camino = Golpe.camino(M, jx, jy, tx, ty, soloCalle) || []; IA.dest = tx + "," + ty; IA.repensar = 2.5 + Math.random();
    }
    while (IA.camino.length) {
      const [cx, cy] = IA.camino[0], px = (cx + 0.5) * T, py = (cy + 0.5) * T;
      if (Math.hypot(px - J.x, py - J.y) < (soloCalle ? 26 : 10) || (cx === jx && cy === jy && Math.hypot(px - J.x, py - J.y) < 18)) { IA.camino.shift(); continue; }
      if (IA.camino.length > 1) { const [nx, ny] = IA.camino[1], qx = (nx + 0.5) * T, qy = (ny + 0.5) * T; if (Golpe.linea(M, J.x, J.y, qx, qy) && Math.hypot(qx - J.x, qy - J.y) < 90) { IA.camino.shift(); continue; } }
      const ex = px - J.x, ey = py - J.y, e = Math.hypot(ex, ey);
      return [ex / e, ey / e];
    }
    return [dx / d, dy / d];
  },

  /* ---------- Lo que ve cada uno ---------- */
  ve(me, q) {
    if (q === me) return true;
    if (!me.cpu && !q.cpu && me.team === q.team) return true;
    const d = Math.hypot(q.x - me.x, q.y - me.y);
    if (d > GP.VISION) return false;
    if (q.escondido && d > 55) return false;
    return !q.bldg || q.bldg === me.bldg || d < 70;
  },
  view(s, pid) {
    const me = s.jug.find(j => j.id === pid);
    const base = { game: "golpe", id: s.id, me: pid, semilla: s.semilla, fase: s.fase, t: Math.round(s.t * 100) / 100, dur: GP.DURACION, feed: s.feed.slice(-4) };
    let ojo = me;
    if (me && me.est !== "vivo") ojo = s.jug.find(j => !j.cpu && j.team === me.team && j.est === "vivo") || me;
    const visibles = ojo ? s.jug.filter(j => j.est === "vivo" && !j.auto && Golpe.ve(ojo, j)) : [];
    const cerca = (o, r) => ojo && Math.abs(o.x - ojo.x) < r && Math.abs(o.y - ojo.y) < r;
    const v = {
      ...base, ojo: ojo ? ojo.id : null,
      jug: visibles.map(j => j !== me && j.seguro && j.team !== (me && me.team) ? { id: j.id, name: j.clan ? `[${j.clan}] ${j.name}` : j.name, cpu: !!j.cpu, look: j.look, rol: "civil", x: Math.round(j.x), y: Math.round(j.y), a: Math.round(j.ang * 100) / 100, hp: Math.round(j.hp), hpMax: j.hpMax, ch: 0, arma: null, ar: 0, seg: 1 } : ({ id: j.id, name: Golpe.nombreVisible(j), cpu: !!j.cpu, look: j.look, rol: j.rol, seg: j.seguro ? 1 : 0, x: Math.round(j.x), y: Math.round(j.y), a: Math.round(j.ang * 100) / 100, hp: Math.round(j.hp), hpMax: j.hpMax, ch: j.chaleco, arma: j.arma ? j.arma.a : null, ar: j.arma ? j.arma.r : 0, tiro: j.tiro && s.t - j.tiro < 0.08 ? 1 : 0, ext: j.ext ? Math.round(j.ext * 10) / 10 : 0, golpe: j.golpe && s.t - j.golpe < 0.2 ? 1 : 0, prot: j.prot > 0 ? 1 : 0, esc: j.escondido ? 1 : 0, trab: j.trab ? 1 : 0 })),
      autos: s.autos.filter(a => cerca(a, GP.VISION + 80)).map(a => { const C = a.cond && s.jug.find(j => j.id === a.cond); return { id: a.id, x: Math.round(a.x), y: Math.round(a.y), a: Math.round(a.ang * 100) / 100, tipo: a.tipo, color: a.color, v: Math.round(a.v), cond: C ? { id: C.id, rol: C.rol, name: Golpe.nombreVisible(C), cpu: !!C.cpu, hp: Math.round(C.hp), hpMax: C.hpMax, ext: C.ext ? Math.round(C.ext * 10) / 10 : 0 } : null, baul: a.baul.length, cupo: a.cupo }; }),
      items: s.items.filter(it => cerca(it, GP.VISION + 60) && (!Golpe.edificioEn(s.M, it.x, it.y) || Golpe.edificioEn(s.M, it.x, it.y) === ojo.bldg)).map(it => ({ id: it.id, x: Math.round(it.x), y: Math.round(it.y), k: it.k, a: it.a, r: it.r, n: it.n, v: it.v })),
      balas: s.balas.filter(b => cerca(b, GP.VISION + 200)).map(b => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y), vx: Math.round(b.vx), vy: Math.round(b.vy) })),
      hits: s.hits.filter(h => h.de === pid || h.a === pid || cerca(h, GP.VISION)).map(h => ({ x: h.x, y: h.y, d: h.d, yo: h.de === pid, a: h.a === pid, ch: h.ch, t: h.t })),
      alarmas: Object.entries(s.alarmas).map(([id, a]) => [+id, a.on ? 1 : 0, a.son ? 1 : 0]),
      cajas: Object.entries(s.cajas).filter(([, c]) => c.ab).map(([id]) => +id),
      equipo: s.jug.filter(j => me && !j.cpu && j.team === me.team && j !== me).map(j => ({ id: j.id, name: j.name, x: Math.round(j.x), y: Math.round(j.y), est: j.est, hp: Math.round(j.hp) })),
      humanos: s.jug.filter(j => !j.cpu).map(j => ({ id: j.id, name: j.name, rol: j.rol, est: j.est, valor: j.ganado || 0, escapes: j.escapes || 0, items: 0, kills: j.kills, arrestos: j.arrestos, puesto: j.puesto, pts: Golpe.puntaje(j), rango: j.rol === "policia" ? GP.RANGOS[j.rango || 0][0] : null }))
    };
    if (me) {
      const A = me.auto ? s.autos.find(a => a.id === me.auto) : null, Ac = !me.auto && me.rol === "ladron" ? Golpe.autoCerca(s, me) : null;
      v.yo = { id: me.id, rol: me.rol, est: me.est, x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, hp: Math.round(me.hp), hpMax: me.hpMax, ch: me.chaleco, arma: me.arma, cura: me.cura,
        moch: me.rol === "ladron" ? me.moch : [], cupo: me.cupo, valor: me.rol === "ladron" ? Golpe.valor(me) : 0, plata: me.rol === "ladron" ? me.plata : 0, llaves: me.llaves || 0, premio: me.premio,
        kills: me.kills, arrestos: me.arrestos, rango: me.rol === "policia" ? me.rango || 0 : null, ext: Math.round(me.ext * 10) / 10, bldg: me.bldg, auto: me.auto || null, esc: me.escondido ? 1 : 0,
        trab: me.trab ? { tipo: me.trab.tipo, p: Math.round(me.trab.t / me.trab.dur * 100) / 100 } : null, vuelve: me.est === "caido" || me.est === "casa" ? Math.max(0, Math.ceil(me.vuelve - s.t)) : 0,
        baul: (A || Ac) && (A || Ac).cupo ? { id: (A || Ac).id, n: (A || Ac).baul.length, cupo: (A || Ac).cupo, items: (A || Ac).baul } : null,
        junto: me.junto && s.t - me.junto < 0.3 ? 1 : 0, vendio: me.vendio && s.t - me.vendio.t < 2 ? me.vendio.v : 0,
        seguro: me.seguro ? 1 : 0, verif: me.verif === false ? 0 : 1, banco: Math.max(0, me.banco || 0),
        runs: me.runs || [], ultRun: me.ultRun && s.t - me.ultRun.t < 4 ? me.ultRun : null, nota: me.nota && s.t - me.nota.t < 3 ? me.nota.txt : null, policias: Golpe.policias(s), castigo: Math.round(me.castigo || 0), kit: me.rol === "civil" ? Golpe.limpiarKit(me.kit) : null, compra: me.compra && s.t - me.compra.t < 1.5 ? me.compra : null };
    }
    return v;
  },

  act(s, pid, a) {
    const J = s.jug.find(j => j.id === pid); if (!J || J.cpu) return;
    const n = (x, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, +x || 0));
    if (a.t === "in") J.in = { mx: n(a.mx), my: n(a.my), ax: n(a.ax), ay: n(a.ay), f: !!a.f };
    else if (a.t === "volverse" && (a.r === "ladron" || a.r === "policia")) Golpe.convertir(s, J, a.r);
    else if (a.t === "agarrar" && J.est === "vivo") Golpe.agarrar(s, J);
    else if (a.t === "cura") Golpe.curar(s, J);
    else if (a.t === "usar" && a.q === "turno") Golpe.terminarTurno(s, J);
    else if (a.t === "usar" && typeof a.q === "string") Golpe.usar(s, J, a.q);
    // Lo que trae cada uno de partidas anteriores (equipo de ladrón y experiencia de policía); solo antes de elegir rol
    else if (a.t === "comprar" && typeof a.i === "string") Golpe.comprar(s, J, a.i);
    else if (a.t === "kit" && J.rol === "civil" && !J.kitListo) {
      // Lo que dice el propio teléfono no se cree del todo: hasta que se verifique con su ficha, equipo limitado
      J.kitListo = 1; J.verif = false;
      const k = Golpe.limpiarKit(a.kit); if (k.arma) k.arma.r = Math.min(k.arma.r, 1); k.chaleco = Math.min(k.chaleco, 1); k.bolso = Math.min(k.bolso, 14);
      J.kit = k; J.xp = Math.max(0, Math.min(3, a.xp | 0)); J.banco = Math.max(0, Math.min(3000, a.banco | 0)); J.clan = "";
      if (typeof a.ficha === "string" && /^[0-9a-f]{32}$/.test(a.ficha)) Golpe.verificar(s, J, a.ficha);
    }
  },
  /* El anfitrión canjea las fichas de los invitados en el servidor y recibe su equipo real (de a varias juntas) */
  verificar(s, J, ficha) {
    if (!Golpe.enNube()) return;
    Golpe.fichas = Golpe.fichas || [];
    if (J) Golpe.fichas.push({ s, J, ficha });
    clearTimeout(Golpe.fichasT);
    Golpe.fichasT = setTimeout(async () => {
      const lote = Golpe.fichas.splice(0, 8);
      try {
        const { data, error } = await Nube.sb.rpc("golpe_canjear", { fichas: lote.map(x => x.ficha) });
        if (error) throw error;
        for (const { s, J, ficha } of lote) {
          const d = data && data[ficha]; if (!d || s.fase === "fin") continue;
          J.verif = true; J.clan = Golpe.limpiarTag(d.clan); J.banco = Math.max(0, (Number(d.banco) || 0) - (J.gastoPend || 0));
          if (J.rol === "civil") { J.kit = Golpe.limpiarKit(d.kit); J.xp = Math.max(0, d.xp | 0); }
        }
      } catch (e) { console.warn("Golpe: no se pudieron verificar los equipos", e); }
      if (Golpe.fichas.length) Golpe.verificar(lote[0].s, null, null);
    }, 300);
  },
  resultado(s, pid) {
    if (!s || s.fase !== "fin") return null;
    const J = s.jug.find(j => j.id === pid); if (!J || J.cpu) return null;
    const humanos = s.jug.filter(j => !j.cpu);
    return { juego: "golpe", id: s.id, gano: (J.ganado || 0) > 0, puesto: J.puesto, n: s.jug.length, vsCompu: humanos.length === 1, rol: J.rol, escapo: (J.escapes || 0) > 0, valor: J.ganado || 0, kills: J.kills, arrestos: J.arrestos };
  },
  textoCuenta(r) {
    if (!r || typeof Puntos === "undefined" || !BD.sesion()) return "";
    const c = Puntos.calcular(r);
    return `A tu cuenta se suman <b>+${c.puntos} puntos</b>.`;
  },

  /* ---------- Lo que se guarda: plata, equipo de ladrón, guarida y arrestos ----------
     Con sesión en la nube, la verdad está en Supabase (tabla golpe_cuentas, que solo cambian funciones del
     servidor con controles: ver supabase/golpe.sql). El teléfono guarda una copia para mostrarla al toque
     y una cola de resultados pendientes por si no hay internet. Sin nube, todo queda en el teléfono. */
  claveP(k) { const u = BD.sesion(); return "golpe" + k + ":" + (u ? u.id : "anon"); },
  banco() { return store.get(Golpe.claveP("Banco"), { total: 0, golpes: [] }); },
  kit() { return Golpe.limpiarKit(store.get(Golpe.claveP("Kit"), null)); },
  guarida() { return store.get(Golpe.claveP("Guarida"), []); },
  xp() { return store.get(Golpe.claveP("Xp"), 0); },
  enNube() { const u = BD.sesion(); return !!(u && u.nube && typeof Nube !== "undefined" && Nube.sb && Nube.user && Golpe.nubeFalta !== true); },
  /* Copia local de lo que devolvió el servidor */
  copiar(d) {
    if (!d || !d.ok) return;
    const b = Golpe.banco(); b.total = Number(d.plata) || 0; store.set(Golpe.claveP("Banco"), b);
    store.set(Golpe.claveP("Kit"), Golpe.limpiarKit(d.kit)); store.set(Golpe.claveP("Guarida"), Array.isArray(d.guarida) ? d.guarida : []);
    store.set(Golpe.claveP("Xp"), Number(d.xp) || 0);
  },
  async sincronizar() {
    if (!Golpe.enNube() || Golpe.sincronizando) return;
    Golpe.sincronizando = true;
    try {
      // Primero sube los resultados que quedaron pendientes
      const pend = store.get(Golpe.claveP("Pend"), []);
      for (const r of pend.slice()) { const ok = await Golpe.subir(r); if (!ok) break; pend.shift(); store.set(Golpe.claveP("Pend"), pend); }
      const { data, error } = await Nube.sb.rpc("golpe_estado", { importar: { plata: Golpe.banco().total, kit: Golpe.kit(), xp: Golpe.xp() } });
      if (error) { if (/golpe_estado|PGRST202|does not exist/i.test(error.message + error.code)) Golpe.nubeFalta = true; throw error; }
      const antes = JSON.stringify([Golpe.banco().total, Golpe.kit(), Golpe.guarida(), Golpe.xp()]);
      Golpe.copiar(data);
      if (S.screen === "golpeIntro" && antes !== JSON.stringify([Golpe.banco().total, Golpe.kit(), Golpe.guarida(), Golpe.xp()])) render();
    } catch (e) { console.warn("Golpe: no se pudo sincronizar", e); }
    Golpe.sincronizando = false;
  },
  /* Manda un resultado al servidor. true si quedó guardado (o si el servidor dice que ya estaba). */
  async subir(r) {
    try {
      const { data, error } = await Nube.sb.rpc("golpe_resultado", { partida: r.id, rol: r.rol, escapo: !!r.escapo, plata: r.plata | 0, gasto: r.gasto | 0,
        kit: r.kit === undefined || r.kit === null ? null : r.kit, perdio: r.kit === null, guarida: r.guarida || [], arrestos: r.arrestos | 0 });
      if (error) { if (/golpe_resultado|PGRST202|does not exist/i.test(error.message + error.code)) Golpe.nubeFalta = true; return false; }
      if (data && data.ok) Golpe.copiar(data);
      else if (data && data.motivo === "gasto") toast("El servidor no aceptó el gasto de esa partida.");
      return true;
    } catch (e) { return false; }
  },
  guardarBotin(r) {
    if (!r) return;
    const b = Golpe.banco(); if (b.golpes.includes(r.id)) return;
    // Al toque en el teléfono (para mostrarlo), y después lo confirma el servidor
    b.golpes = [r.id, ...b.golpes].slice(0, 200); b.total = Math.max(0, b.total + (r.plata || 0) - (r.gasto || 0)); store.set(Golpe.claveP("Banco"), b);
    if (r.guarida && r.guarida.length) store.set(Golpe.claveP("Guarida"), [...Golpe.guarida(), ...r.guarida].slice(-60));
    if (r.kit !== undefined) store.set(Golpe.claveP("Kit"), r.kit === null ? Golpe.kitBase() : r.kit);
    if (r.rol === "policia" && r.arrestos) store.set(Golpe.claveP("Xp"), Golpe.xp() + r.arrestos);
    if (Golpe.enNube()) {
      const pend = store.get(Golpe.claveP("Pend"), []);
      store.set(Golpe.claveP("Pend"), [...pend, { id: r.id, rol: r.rol, escapo: r.escapo, plata: r.plata, gasto: r.gasto, kit: r.kit, guarida: r.guarida, arrestos: r.arrestos }].slice(-20));
      Golpe.sincronizar();
    }
  },
  /* En la guarida se puede vender lo que trajiste, pero el reducidor de la ciudad paga el doble */
  async venderGuarida() {
    const g = Golpe.guarida(); if (!g.length) return;
    if (Golpe.enNube()) {
      const { data, error } = await Nube.sb.rpc("golpe_vender_guarida");
      if (!error && data && data.ok) { Golpe.copiar(data); toast(`Vendiste lo de la guarida por $${data.vendido}`); render(); return; }
      if (error && !/golpe_vender|PGRST202|does not exist/i.test(error.message + error.code)) { toast("No se pudo vender: revisá la conexión."); return; }
    }
    const v = Math.round(g.reduce((a, it) => a + it.v, 0) * 0.5 / 10) * 10, b = Golpe.banco();
    b.total += v; store.set(Golpe.claveP("Banco"), b); store.set(Golpe.claveP("Guarida"), []);
    toast(`Vendiste lo de la guarida por $${v}`); render();
  },

  /* ---------- En este teléfono (contra bots) ---------- */
  empezarLocal() {
    const c = Golpe.cfg(), u = BD.sesion();
    S.extra = Golpe.crear([{ id: "p0", name: u ? u.nombre : "Vos", look: u ? u.look : Cuenta.look(), kit: Golpe.kit(), xp: Golpe.xp(), banco: Golpe.banco().total, clan: Golpe.clanTag ? Golpe.clanTag() : "" }], { local: true, nivel: c.nivel, dens: c.dens });
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
      if (s.fase === "fin" && !s.contada) { s.contada = true; Cuenta.revisar(); }
    }, 50);
    Golpe.render(Golpe.view(s, "p0"), a => {
      if (a.t === "again") { Golpe.parar(); return Golpe.empezarLocal(); }
      if (a.t === "salir") { Golpe.parar(); clearInterval(Golpe.reloj); S.extra = null; return go("golpeIntro"); }
      Golpe.act(s, "p0", a);
    }, { local: true, isHost: true });
  },
  intro() {
    const c = Golpe.cfg(), b = Golpe.banco(), K = Golpe.kit(), g = Golpe.guarida(), xp = Golpe.xp(), R = GP.RANGOS[Golpe.rango(xp)], sig = GP.RANGOS[Golpe.rango(xp) + 1];
    if (!Golpe.sincroVista) { Golpe.sincroVista = true; Golpe.sincronizar().then(() => { Golpe.sincroVista = false; }); }
    const vg = Math.round(g.reduce((a, it) => a + it.v, 0) * 0.5 / 10) * 10, ic = (k, t) => `<img class="gp-ic" src="${Golpe.icono(k)}" alt="" title="${t || ""}">`;
    app.innerHTML = `${head(0)}<section class="screen ex-intro ex-golpe">
      <div class="tb-hero"><span class="ex-arte">${Golpe.svg()}</span><span class="tb-neon">GOLPE</span><p class="sub">${Golpe.descripcion}</p></div>
      <div class="panel gp-banco"><span>Plata guardada</span><b>$${b.total.toLocaleString("es-AR")}</b><small>Se usa en la armería de la zona segura · ${Golpe.enNube() ? "guardada en tu cuenta" : BD.sesion() && BD.sesion().nube ? "guardada en este teléfono (falta activar Golpe en la nube)" : "guardada en este teléfono: iniciá sesión para no perderla"}</small></div>
      <div class="panel gp-kit"><span class="label">Tu equipo de ladrón</span>
        <div class="gp-kit-fila">
          <span>${ic(K.arma ? "arma-" + K.arma.a : "sin-arma")} ${K.arma ? `<b style="color:${GP.RAR[K.arma.r][1]}">${GP.ARMAS[K.arma.a].n}</b> <small>${GP.RAR[K.arma.r][0]}</small>` : "<small>Sin arma</small>"}</span>
          <span>${ic("chaleco")} ${K.chaleco ? `Chaleco nivel ${K.chaleco}` : "<small>Sin chaleco</small>"}</span>
          <span>${ic("bolso")} Bolso de ${K.bolso}</span></div>
        <small class="sub">Arrancás con esto. Si te agarra la policía lo conservás; si te mata otro ladrón, lo perdés todo.</small>
        ${g.length ? `<div class="gp-guarida"><span>En tu guarida: ${g.map(it => ic("art-" + GP.ART[it.a][1], GP.ART[it.a][0])).join("")}</span><button class="btn small ghost" id="gpVenderG">Vender acá por $${vg}</button><small class="sub">El reducidor de la ciudad paga el doble, pero hay que llevarlo.</small></div>` : ""}
      </div>
      <div class="panel gp-kit"><span class="label">Tu carrera en la policía</span>
        <div class="gp-kit-fila"><span>${ic("placa")} <b>${R[0]}</b></span><span>${xp} arresto${xp === 1 ? "" : "s"}</span><span><small>${sig ? `${sig[2] - xp} más para ${sig[0].toLowerCase()}` : "Rango máximo"}</small></span></div></div>
      <div class="panel"><span class="label">Gente en la ciudad</span><div class="seg">${[["pocos", "Poca"], ["normal", "Normal"], ["muchos", "Mucha"]].map(([k, t]) => `<button aria-pressed="${c.dens === k}" data-gpd="${k}">${t}</button>`).join("")}</div>
        <span class="label">Qué tan buenos son los bots</span><div class="seg">${[["facil", "Fáciles"], ["normal", "Normales"], ["dificil", "Difíciles"]].map(([k, t]) => `<button aria-pressed="${c.nivel === k}" data-gpn="${k}">${t}</button>`).join("")}</div></div>
      <details class="panel gp-ayuda"><summary>Cómo se juega</summary>
        <p><b>Zona segura.</b> Todos entran por ahí. Nadie puede herir a nadie y todos se ven como civiles. En la armería comprás armas, chalecos, bolsos, botiquines y mejoras.</p>
        <p><b>Civil.</b> No puede robar, pero puede manejar. Tocá «Volverse ladrón» o andá a la comisaría para hacerte policía. No hay vuelta atrás.</p>
        <p><b>Ladrón.</b> Arrancás con lo que tengas guardado (al principio, nada): armate robando. El bolso tiene ${GP.BOLSOS[0]} lugares y hay más grandes. Vendé lo robado en un reducidor para tener plata y llegá a una salida para quedarte con todo.</p>
        <p><b>Alarmas y cajas fuertes.</b> Al robar suena la alarma y viene la policía, salvo que antes la desactives en su panel, al lado de la puerta. Las cajas fuertes se abren con llaves que aparecen por la ciudad.</p>
        <p><b>Escondites y autos.</b> En arbustos y contenedores no te ven de lejos. Los autos tienen baúl para guardar lo robado.</p>
        <p><b>Policía.</b> Solo hiere ladrones; al bajarlos los arresta. Sube de rango con los arrestos. Si lo matan, vuelve a la comisaría. Al terminar el turno cobra sueldo, una parte de lo confiscado y algunos ítems.</p>
        <p><b>Controles.</b> Dedo izquierdo: mover o manejar. Dedo derecho: apuntar y disparar. En la compu: WASD, mouse y clic; E agarra, Q cura, F sube o baja del auto.</p></details>
      <button class="btn tb-girar" id="exJugar">${Golpe.boton}</button>
      <button class="btn ghost" id="gpCiudades">Ciudades, terrenos y clanes</button>
      <p class="summary center">Con amigos: creá una sala en "Jugar online" y elegí Golpe. Entran juntos y los del mismo rol son equipo.</p>
      <button class="btn ghost" id="exAtras">Volver</button></section>`;
    const guardar = () => { store.set("golpeCfg", c); render(); };
    app.querySelectorAll("[data-gpd]").forEach(x => x.onclick = () => { c.dens = x.dataset.gpd; guardar(); });
    app.querySelectorAll("[data-gpn]").forEach(x => x.onclick = () => { c.nivel = x.dataset.gpn; guardar(); });
    on("gpVenderG", () => { if (confirm(`¿Vender todo lo de la guarida por $${vg}? En el reducidor de la ciudad te pagarían el doble.`)) Golpe.venderGuarida(); });
    on("exJugar", () => Golpe.empezarLocal());
    on("gpCiudades", () => go("golpeCiudades"));
    on("exAtras", () => go("home"));
  },

  /* ---------- Online (en el anfitrión) ---------- */
  empezarOn(R) {
    const c = Golpe.cfg();
    const jug = R.players.filter(p => p.on).map(p => ({ id: p.id, name: p.name, look: p.id === "H" ? Cuenta.look() : p.look, kit: p.id === "H" ? Golpe.kit() : null, xp: p.id === "H" ? Golpe.xp() : 0, banco: p.id === "H" ? Golpe.banco().total : 0, clan: p.id === "H" && Golpe.clanTag ? Golpe.clanTag() : "" }));
    for (const j of jug) if (j.id === "H") j.kitListo = 1;
    if (jug.length > 8) return "Golpe es de hasta 8 personas.";
    R.ex = Golpe.crear(jug, { local: false, nivel: c.nivel, dens: c.dens });
    R.ex.juego = "golpe"; R.game = "golpe";
    clearInterval(Golpe.relojOn);
    let prev = performance.now(), n = 0;
    Golpe.relojOn = setInterval(() => {
      if (!Net.R || Net.R.game !== "golpe" || !Net.R.ex) { clearInterval(Golpe.relojOn); Golpe.relojOn = null; return; }
      const s = Net.R.ex, ahora = performance.now(); Golpe.tick(s, Math.min(0.1, (ahora - prev) / 1000)); prev = ahora;
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
/* Aviso corto abajo de la pantalla (la app no tenía uno general) */
function toast(txt) {
  let el = document.getElementById("gpToast");
  if (!el) { el = document.createElement("div"); el.id = "gpToast"; el.className = "gp-toast"; document.body.appendChild(el); }
  el.textContent = txt; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2600);
}
EXTRA.golpe = Golpe;
PANTALLAS.golpeIntro = () => Golpe.intro();
PANTALLAS.golpe = () => Golpe.pantallaLocal();
