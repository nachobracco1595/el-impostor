/* Trabajos diarios: Tala, Mina y Pesca.
   - Cada trabajo es un mundo para recorrer (bosque, cueva y lago) donde te cruzas con los demás que están trabajando.
   - Cada trabajo se juega una vez por día y se desbloquea mirando un anuncio (si los anuncios están activos).
   - Hay 10 minutos: lo que juntas se convierte en monedas al terminar (con un tope por jornada).
   - Las herramientas se mejoran con monedas en 9 niveles, de madera a "de los creadores".
   El progreso se guarda en el perfil (u.diario.herr y u.diario.trab), que ya se sincroniza con la nube. */

const TR = {
  DURACION: 10 * 60 * 1000,
  TOPE: 450,                      // monedas máximas por jornada
  NIVELES: [
    { id: "madera", m: "de madera", f: "de madera", color: "#a8743f", mango: "#6b4423" },
    { id: "piedra", m: "de piedra", f: "de piedra", color: "#8d949e", mango: "#6b4423" },
    { id: "metal", m: "de metal", f: "de metal", color: "#d4dbe3", mango: "#5a3a20" },
    { id: "esmeralda", m: "de esmeralda", f: "de esmeralda", color: "#2fd27a", mango: "#4a3020" },
    { id: "diamante", m: "de diamante", f: "de diamante", color: "#6fe0ff", mango: "#3f2a1c" },
    { id: "adamantio", m: "de adamantio", f: "de adamantio", color: "#e0344f", mango: "#2b2b33" },
    { id: "encantado", m: "encantado", f: "encantada", color: "#b77bff", mango: "#3b2a55" },
    { id: "vacio", m: "del vacío", f: "del vacío", color: "#4b1f7a", mango: "#120a1f" },
    { id: "creadores", m: "de los creadores", f: "de los creadores", color: "#ffd34d", mango: "#fff3c4" }
  ],
  COSTO: [0, 150, 300, 550, 900, 1400, 2000, 2800, 3800],   // costo para llegar a cada nivel
  DANO: [1, 1.25, 1.5, 1.8, 2.1, 2.5, 2.9, 3.4, 4],
  RINDE: [1, 1.3, 1.6, 2, 2.5, 3, 3.6, 4.3, 5],
  JUEGOS: {
    tala: { nombre: "Tala", lugar: "el bosque", herr: "Hacha", gen: "f", ic: "🪓", mat: "madera", desc: "Recorre el bosque a hachazos. Mejor hacha: más daño, más área y más madera por árbol.", factor: 0.35 },
    mina: { nombre: "Mina", lugar: "la mina", herr: "Pico", gen: "m", ic: "⛏️", mat: "minerales", desc: "Cava tu camino en la cueva. Más hondo hay minerales mejores, pero piden mejor pico.", factor: 0.3 },
    pesca: { nombre: "Pesca", lugar: "el lago", herr: "Caña", gen: "f", ic: "🎣", mat: "peces", desc: "Lanza al lago y pelea con el pez. Mejor caña: más fuerza y más resistencia.", factor: 0.35 }
  }
};

const Trabajos = {
  s: null,          // jornada en curso
  reloj: null,

  /* ---------- Datos del perfil ---------- */
  datos(u) {
    Eco.completar(u);
    const d = u.diario;
    d.herr = Object.assign({ tala: 0, mina: 0, pesca: 0 }, d.herr || {});
    if (!d.trab || d.trab.dia !== hoyStr()) d.trab = { dia: hoyStr(), abiertos: [], hechos: [] };
    d.trabRecord = Object.assign({ tala: 0, mina: 0, pesca: 0, evento: 0 }, d.trabRecord || {});
    return d;
  },
  estado(u, j) {
    const d = this.datos(u);
    return d.trab.hechos.includes(j) ? "hecho" : d.trab.abiertos.includes(j) ? "abierto" : "cerrado";
  },
  nombreHerr(j, nivel) { const J = TR.JUEGOS[j], N = TR.NIVELES[nivel]; return `${J.herr} ${J.gen === "f" ? N.f : N.m}`; },

  /* Dibujo de la herramienta: el color de la cabeza cambia con el nivel */
  icono(j, nivel, size = 56) {
    j = (TR.JUEGOS[j] && TR.JUEGOS[j].herrDe) || (j === "evento" ? "tala" : j);
    const N = TR.NIVELES[nivel], c = N.color, m = N.mango, brillo = nivel >= 6 ? ` class="herr-brilla n${nivel}"` : "";
    const g = j === "tala"
      ? `<rect x="29" y="14" width="6" height="44" rx="3" fill="${m}" transform="rotate(20 32 36)"/><path d="M30 10 C44 6 52 14 50 26 C46 24 40 24 34 26 Z" fill="${c}" stroke="#0006" stroke-width="1.5" transform="rotate(20 32 36)"/>`
      : j === "mina"
      ? `<rect x="29" y="16" width="6" height="42" rx="3" fill="${m}" transform="rotate(-30 32 36)"/><path d="M8 22 C20 8 44 8 56 22 C46 17 18 17 8 22 Z" fill="${c}" stroke="#0006" stroke-width="1.5" transform="rotate(-30 32 30)"/>`
      : `<path d="M14 58 L46 8" stroke="${m}" stroke-width="5" stroke-linecap="round"/><path d="M46 8 Q56 30 52 52" stroke="#dfe7ff" stroke-width="1.2" fill="none"/><circle cx="23" cy="44" r="6" fill="${c}" stroke="#0006" stroke-width="1.5"/><circle cx="52" cy="54" r="3" fill="#ff5a5a"/>`;
    return `<svg${brillo} viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${g}</svg>`;
  },

  /* ---------- Desbloqueo con anuncio ---------- */
  async desbloquear(j) {
    const u = BD.sesion(); if (!u) return go("perfil");
    if (this.estado(u, j) !== "cerrado") return;
    const conAnuncio = Anuncios.activos(u);
    if (conAnuncio) {
      const c = Anuncios.cfg();
      const visto = await (c.prueba || typeof window.adBreak !== "function" ? Anuncios.prueba(c, `Jugar ${TR.JUEGOS[j].nombre} ${TR.JUEGOS[j].ic}`) : Anuncios.real());
      if (!visto) return;
    }
    if (u.nube && Nube.user) {
      const { data, error } = await Nube.sb.rpc("desbloquear_trabajo", { juego: j });
      if (error) { Toast.mostrar(`<div class="t-ic">⚠️</div><div class="t-txt"><b>No se pudo desbloquear</b><span>${esc(error.message)}</span></div>`, "info"); return; }
      if (!data || !data.ok) {
        this.datos(u).trab.hechos.push(j); Eco.guardar(u);
        Toast.mostrar(`<div class="t-ic">⏰</div><div class="t-txt"><b>Ya hiciste este trabajo hoy</b><span>Vuelve mañana.</span></div>`, "info"); render(); return;
      }
    }
    this.datos(u).trab.abiertos.push(j); Eco.guardar(u);
    this.empezar(j);
  },

  mejorar(j) {
    const u = BD.sesion(); if (!u) return;
    const d = this.datos(u), n = d.herr[j];
    if (n >= TR.NIVELES.length - 1) return;
    const costo = TR.COSTO[n + 1];
    if (u.monedas < costo) return;
    u.monedas -= costo; d.herr[j] = n + 1;
    Eco.guardar(u);
    if (u.nube) Nube.actividad("compra", j, 0, -costo);
    if (typeof Sonido !== "undefined") Sonido.sfx(n + 1 === TR.NIVELES.length - 1 ? "logro" : "monedas");
    Toast.mostrar(`<div class="t-ic">${TR.JUEGOS[j].ic}</div><div class="t-txt"><small>Herramienta mejorada</small><b>${esc(this.nombreHerr(j, n + 1))}</b><span>${n + 1 === TR.NIVELES.length - 1 ? "¡Tope tope! No hay nada mejor." : `Da ${TR.RINDE[n + 1]}× y pega ${TR.DANO[n + 1]}× más fuerte.`}</span></div>`, "logro");
    render();
  },

  /* ---------- Jornada ---------- */
  empezar(j) {
    const u = BD.sesion(); if (!u || this.estado(u, j) !== "abierto") return;
    const nivel = this.datos(u).herr[TR.JUEGOS[j].herrDe || j];
    this.s = { j, nivel, uid: u.id, fin: Date.now() + TR.DURACION, valor: 0, items: {}, terminado: null, factor: TR.JUEGOS[j].factor, tema: j === "evento" ? Evento.trabajo() : null };
    Mundo.iniciar(this.s);
    clearInterval(this.reloj);
    this.reloj = setInterval(() => this.tic(), 250);
    go("trabajo");
  },
  /* Tope por jornada: con el multiplicador de un evento sube, pero nunca pasa de 480 (el servidor no deja sumar más de 500 de una vez) */
  tope() { return Math.min(480, Math.round(TR.TOPE * Evento.multiplicador())); },
  monedas(s) { return Math.min(this.tope(), Math.floor(s.valor * (s.factor || TR.JUEGOS[s.j].factor) * Evento.multiplicador())); },
  sumar(s, item, cant, valor) {
    s.items[item] = (s.items[item] || 0) + cant;
    s.valor += valor;
    if (this.monedas(s) >= this.tope()) setTimeout(() => this.terminar("tope"), 600);
  },
  tic() {
    const s = this.s;
    if (!s || s.terminado) { clearInterval(this.reloj); return; }
    if (S.screen !== "trabajo") return this.terminar("salio");
    const queda = s.fin - Date.now();
    if (queda <= 0) return this.terminar("tiempo");
    this.hud();
  },
  hud() {
    const s = this.s; if (!s) return;
    const queda = Math.max(0, s.fin - Date.now());
    const t = byId("trReloj"); if (t) { const seg = Math.ceil(queda / 1000); t.textContent = `${Math.floor(seg / 60)}:${pad2(seg % 60)}`; t.classList.toggle("poco", seg <= 30); }
    const mo = byId("trMon"); if (mo) mo.textContent = this.monedas(s);
  },
  terminar(motivo) {
    const s = this.s; if (!s || s.terminado) return;
    Mundo.recogerTodo(s);
    clearInterval(this.reloj);
    const u = BD.usuario(s.uid);
    const monedas = this.monedas(s), puntos = Math.min(40, Math.round(monedas / 10));
    s.terminado = { motivo, monedas, puntos };
    Mundo.parar();
    if (u) {
      const d = this.datos(u);
      d.trab.abiertos = d.trab.abiertos.filter(x => x !== s.j);
      if (!d.trab.hechos.includes(s.j)) d.trab.hechos.push(s.j);
      const record = monedas > d.trabRecord[s.j];
      if (record) d.trabRecord[s.j] = monedas;
      s.terminado.record = record && monedas > 0;
      u.monedas += monedas; u.puntos += puntos;
      u.historial.unshift({ f: Date.now(), juego: s.j, gano: true, puntos, txt: `${TR.JUEGOS[s.j].nombre} · +${monedas} monedas` });
      u.historial = u.historial.slice(0, 40);
      Eco.guardar(u);
      if (u.nube) Nube.actividad("partida", s.j, puntos, monedas);
    }
    if (motivo !== "salio") { if (typeof Sonido !== "undefined") Sonido.sfx("victoria"); render(); }
  }
};

/* ---------- Mundos para recorrer (bosque, cueva y lago) ----------
   Te mueves como en La Nave (joystick o flechas) y con el botón de acción das golpes en área:
   cuanto mejor la herramienta, más grande el área y más fuerte el golpe.
   El mapa sale de una semilla del día: todos ven el mismo bosque, la misma cueva y el mismo lago,
   y con cuenta en la nube ves en vivo a los demás que están trabajando. */

/* Números al azar repetibles a partir de un texto */
function azarDe(semilla) {
  let a = 0;
  for (const c of semilla) a = (a * 31 + c.charCodeAt(0)) | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pesoAzar = (r, lista, peso) => { let x = r() * lista.reduce((a, it) => a + peso(it), 0); for (const it of lista) if ((x -= peso(it)) < 0) return it; return lista[0]; };

const Mundo = {
  raf: null, img: {},
  imagen(clave, svg) {
    if (!this.img[clave]) { const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')); this.img[clave] = im; }
    return this.img[clave];
  },
  muneco(look) { const l = look || { color: "#748ffc", acc: [] }; return this.imagen("p" + l.color + (l.acc || []).join(), personaje(l.color, "civ", 60, l.acc || [])); },
  herramienta(j, n) { j = j === "evento" ? "tala" : j; return this.imagen("h" + j + n, Trabajos.icono(j, n, 64).replace(/ class="[^"]*"/, "")); },
  motor: j => ({ tala: Tala, mina: Mina, pesca: Pesca, evento: Tala })[j],

  iniciar(s) {
    const u = BD.usuario(s.uid);
    const m = s.m = { x: 0, y: 0, dir: { x: 1, y: 0 }, cara: 1, mov: { x: 0, y: 0 }, teclas: {}, aprieta: false, cd: 0, swing: -9999, aturdido: 0, anda: false,
      efectos: [], chispas: [], drops: [], look: u ? u.look : null, nombre: u ? u.nombre : "Yo", ultEnvio: 0, firma: "", msg: "", msgHasta: 0 };
    this.motor(s.j).generar(s, azarDe(s.j + hoyStr()));
  },

  montar(s) {
    const J = TR.JUEGOS[s.j];
    document.body.classList.add("en-nave");
    app.innerHTML = `<div class="nave mundo m-${s.j}" id="mdRoot">
      <canvas id="mdCanvas"></canvas>
      <div class="md-hud">
        <span class="tr-reloj" id="trReloj">10:00</span>
        <span class="md-herr">${Trabajos.icono(s.j, s.nivel, 26)}<small>${esc(Trabajos.nombreHerr(s.j, s.nivel))}</small></span>
        <span class="tr-mon">🪙 <b id="trMon">0</b><small>/${Trabajos.tope()}</small></span>
      </div>
      <div class="md-gente" id="mdGente"></div>
      <div class="md-msg" id="mdMsg" hidden></div>
      <div class="md-pesca" id="mdPesca" hidden><canvas id="mdPescaCv" width="96" height="300"></canvas><small id="mdPescaTxt"></small></div>
      <div class="nv-joy" id="mdJoy"><i></i></div>
      <button class="md-accion" id="mdAcc" aria-label="Acción">${J.ic}</button>
      <button class="nv-salir" id="mdSalir" aria-label="Terminar">✕</button>
    </div>`;
    this.joystick(s);
    const b = byId("mdAcc");
    b.onpointerdown = e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} s.m.aprieta = true; this.accion(s); };
    const soltar = () => { s.m.aprieta = false; };
    b.onpointerup = soltar; b.onpointercancel = soltar; b.onlostpointercapture = soltar; b.oncontextmenu = e => e.preventDefault();
    byId("mdSalir").onclick = () => { if (confirm("¿Terminar la jornada ahora? Cobras lo que juntaste y no puedes volver a jugarla hoy.")) Trabajos.terminar("fin"); };
    Presencia.entrar(s);
    if (!this.raf) this.loop(s);
  },

  joystick(s) {
    const joy = byId("mdJoy"), pin = joy.querySelector("i"), mov = s.m.mov, zona = byId("mdCanvas");
    let id = null, cx = 0, cy = 0;
    const empezar = e => { const t = e.changedTouches ? e.changedTouches[0] : e; id = t.identifier ?? "m"; cx = t.clientX; cy = t.clientY; joy.style.left = cx - 60 + "px"; joy.style.top = cy - 60 + "px"; joy.classList.add("on"); mover(e); };
    const mover = e => {
      if (id === null) return;
      const t = e.changedTouches ? [...e.changedTouches].find(x => x.identifier === id) : e; if (!t) return;
      let dx = t.clientX - cx, dy = t.clientY - cy; const d = Math.hypot(dx, dy), max = 50;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      pin.style.transform = `translate(${dx}px, ${dy}px)`; mov.x = dx / max; mov.y = dy / max;
      if (e.cancelable) e.preventDefault();
    };
    const fin = e => { if (e && e.changedTouches && ![...e.changedTouches].some(x => x.identifier === id)) return; id = null; mov.x = 0; mov.y = 0; pin.style.transform = ""; joy.classList.remove("on"); };
    zona.addEventListener("touchstart", empezar, { passive: true });
    zona.addEventListener("touchmove", mover, { passive: false });
    zona.addEventListener("touchend", fin); zona.addEventListener("touchcancel", fin);
    zona.addEventListener("mousedown", empezar);
    window.addEventListener("mousemove", e => { if (id === "m") mover(e); }); window.addEventListener("mouseup", () => { if (id === "m") fin(); });
    if (!Mundo.teclasListas) {
      Mundo.teclasListas = true;
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      window.addEventListener("keydown", e => {
        const ss = Trabajos.s; if (!ss || !ss.m || ss.terminado || S.screen !== "trabajo" || document.activeElement.tagName === "INPUT") return;
        if (e.key === " ") { if (!ss.m.aprieta) { ss.m.aprieta = true; Mundo.accion(ss); } e.preventDefault(); return; }
        if (map[e.key]) { ss.m.teclas[e.key] = map[e.key]; e.preventDefault(); }
      });
      window.addEventListener("keyup", e => { const ss = Trabajos.s; if (!ss || !ss.m) return; if (e.key === " ") ss.m.aprieta = false; delete ss.m.teclas[e.key]; });
    }
  },

  parar() {
    cancelAnimationFrame(this.raf); this.raf = null;
    document.body.classList.remove("en-nave");
    Presencia.salir();
  },

  loop(s) {
    let prev = performance.now();
    const paso = now => {
      if (Trabajos.s !== s || s.terminado) { this.raf = null; return; }
      this.raf = requestAnimationFrame(paso);
      const cv = byId("mdCanvas"); if (!cv) return;
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      this.mover(s, dt, now);
      this.motor(s.j).tic(s, dt, now);
      this.drops(s, dt, now);
      if (s.m.aprieta && s.j !== "pesca") this.accion(s);
      this.dibujar(s, cv, now);
      Presencia.enviar(s, now);
    };
    this.raf = requestAnimationFrame(paso);
  },

  mover(s, dt, now) {
    const m = s.m, M = this.motor(s.j);
    let mx = m.mov.x, my = m.mov.y;
    for (const [dx, dy] of Object.values(m.teclas)) { mx += dx; my += dy; }
    const d = Math.hypot(mx, my); if (d > 1) { mx /= d; my /= d; }
    if (M.quieto && M.quieto(s)) { m.anda = false; return; }
    if (d > 0.05) {
      const vel = 210 * (now < m.aturdido ? 0.45 : 1);
      const nx = m.x + mx * vel * dt, ny = m.y + my * vel * dt;
      if (M.libre(s, nx, m.y)) m.x = nx;
      if (M.libre(s, m.x, ny)) m.y = ny;
      m.dir = { x: mx / Math.max(d, 0.001), y: my / Math.max(d, 0.001) };
      if (Math.abs(mx) > 0.1) m.cara = mx < 0 ? -1 : 1;
      m.anda = true;
      if (M.alMoverse) M.alMoverse(s);
    } else m.anda = false;
  },

  /* Golpe en área delante del personaje (tala y mina) o acción de pesca */
  accion(s) {
    if (s.terminado) return;
    const m = s.m, now = performance.now(), M = this.motor(s.j);
    if (s.j === "pesca") return M.accion(s, now);
    if (now < m.cd) return;
    if (now < m.aturdido) { this.texto(s, m.x, m.y - 70, "🐝 ¡No puedes!", "#ff6b7d"); m.cd = now + 500; return; }
    m.cd = now + 380 - s.nivel * 18; m.swing = now;
    const fx = m.x + m.dir.x * 36, fy = m.y - 14 + m.dir.y * 36;
    const radio = this.radio(s);
    const pego = M.golpear(s, fx, fy, radio, TR.DANO[s.nivel], now);
    if (typeof Sonido !== "undefined") Sonido.sfx(pego ? (s.j === "mina" ? "pico" : "hacha") : "tap");
    m.ultGolpe = { x: fx, y: fy, r: radio, t: now };
  },
  radio: s => 46 + s.nivel * 12,

  /* Botín: sale disparado, rebota y vuela hacia el personaje; se cuenta al llegar */
  soltar(s, x, y, o) {
    const n = Math.max(1, o.n || 1);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = o.directo ? 0 : 90 + Math.random() * 120;
      s.m.drops.push({ x, y, z: o.directo ? 30 : 10, vz: o.directo ? 360 : 260 + Math.random() * 160, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, t0: performance.now(),
        ic: o.ic, gema: o.gema, item: o.item, cant: o.cant / n, valor: o.valor / n, grande: o.grande, directo: o.directo });
    }
  },
  drops(s, dt, now) {
    const m = s.m;
    m.drops = m.drops.filter(d => {
      const edad = now - d.t0;
      const dx = m.x - d.x, dy = m.y - 14 - d.y, dist = Math.hypot(dx, dy) || 1;
      if (edad < (d.directo ? 0 : 420)) {
        d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.9; d.vy *= 0.9;
        d.vz -= 1100 * dt; d.z += d.vz * dt; if (d.z < 0) { d.z = 0; d.vz *= -0.45; }
        return true;
      }
      // Imán: cuanto más tiempo, más rápido
      const vel = Math.min(1400, 260 + edad * 0.9);
      d.x += dx / dist * vel * dt; d.y += dy / dist * vel * dt; d.z = Math.max(0, d.z - 200 * dt) + Math.sin(edad / 80) * 0.6;
      if (dist < 24) { this.recoger(s, d); return false; }
      return true;
    });
    // Junta los números en un solo cartelito
    if (m.juntado && now - m.juntado.t > 380) { const j = m.juntado; this.texto(s, m.x, m.y - 74, `+${Math.round(j.cant * 10) / 10} ${j.ic}`, j.color, j.grande); m.juntado = null; }
  },
  recoger(s, d) {
    Trabajos.sumar(s, d.item, d.cant, d.valor);
    const m = s.m, ic = d.ic || "💎";
    if (!m.juntado || m.juntado.ic !== ic) { if (m.juntado) this.texto(s, m.x, m.y - 74, `+${Math.round(m.juntado.cant * 10) / 10} ${m.juntado.ic}`, m.juntado.color, m.juntado.grande); m.juntado = { ic, cant: 0, t: performance.now(), color: d.gema || "#fff", grande: d.grande }; }
    m.juntado.cant += d.cant;
    m.brillo = performance.now();
    if (typeof Sonido !== "undefined") Sonido.sfx("junta");
  },
  recogerTodo(s) { if (s && s.m && s.m.drops) { s.m.drops.forEach(d => Trabajos.sumar(s, d.item, d.cant, d.valor)); s.m.drops = []; } },
  dibujarDrops(s, ctx, t) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const d of s.m.drops) {
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(d.x, d.y + 6, 9, 4, 0, 0, 7); ctx.fill();
      const y = d.y - d.z;
      if (d.gema) {
        ctx.save(); ctx.translate(d.x, y); ctx.rotate(Math.sin(t * 6 + d.t0) * 0.3);
        ctx.fillStyle = d.gema; ctx.strokeStyle = "#0008"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, -2); ctx.lineTo(0, 9); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(4, -3); ctx.lineTo(-2, -3); ctx.fill(); ctx.restore();
      } else { ctx.font = (d.directo ? 34 : 22) + "px " + FE; ctx.fillStyle = "#000"; ctx.fillText(d.ic, d.x, y); }
    }
  },

  texto(s, x, y, txt, color = "#fff", grande) { s.m.efectos.push({ x, y, txt, color, t: performance.now(), grande }); },
  chispas(s, x, y, color, n = 8) { for (let i = 0; i < n; i++) s.m.chispas.push({ x, y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 220 - 40, t: performance.now(), color }); },
  aviso(s, txt, ms = 2200) { s.m.msg = txt; s.m.msgHasta = performance.now() + ms; },

  dibujar(s, cv, now) {
    const m = s.m, M = this.motor(s.j), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d"), esc = Math.max(W, H) / 900, t = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vista = { x0: m.x - W / 2 / esc - 80, x1: m.x + W / 2 / esc + 80, y0: m.y - H / 2 / esc - 80, y1: m.y + H / 2 / esc + 80 };
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(esc, esc); ctx.translate(-m.x, -m.y);
    M.suelo(s, ctx, vista, t);
    // Cosas con altura ordenadas por y: objetos del mapa y personajes
    const cosas = M.objetos(s, vista, t);
    for (const o of Object.values(Presencia.otros)) {
      o.dx += (o.x - o.dx) * 0.2; o.dy += (o.y - o.dy) * 0.2;
      if (o.dx > vista.x0 && o.dx < vista.x1 && o.dy > vista.y0 && o.dy < vista.y1) cosas.push({ y: o.dy, d: () => this.persona(s, ctx, o.dx, o.dy, o.l, o.c, o.h, now - o.aT < 300 ? (now - o.aT) / 300 : -1, Math.hypot(o.x - o.dx, o.y - o.dy) > 2, o.n, t, o) });
    }
    if (m.anda && Math.random() < 0.25) m.chispas.push({ x: m.x + (Math.random() - 0.5) * 18, y: m.y + 14, vx: (Math.random() - 0.5) * 40, vy: -30, t: now, color: s.j === "mina" ? "rgba(160,150,170,.5)" : s.tema && s.tema.suelo === "#e8f0f8" ? "rgba(255,255,255,.8)" : "rgba(230,220,180,.35)", polvo: true });
    if (m.brillo && now - m.brillo < 250) { const k = (now - m.brillo) / 250; ctx.fillStyle = `rgba(255,230,120,${0.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(m.x, m.y - 14, 26 + k * 20, 0, 7); ctx.fill(); }
    cosas.push({ y: m.y, d: () => this.persona(s, ctx, m.x, m.y, m.look, m.cara, s.nivel, now - m.swing < 300 ? (now - m.swing) / 300 : -1, m.anda, null, t, null) });
    cosas.sort((a, b) => a.y - b.y).forEach(c => c.d(ctx));
    // Área del golpe
    if (m.ultGolpe && now - m.ultGolpe.t < 220) {
      const g = m.ultGolpe, p = (now - g.t) / 220, N = TR.NIVELES[s.nivel];
      ctx.strokeStyle = N.color; ctx.globalAlpha = 0.55 * (1 - p); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r * (0.6 + 0.4 * p), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (M.encima) M.encima(s, ctx, t, now);
    this.dibujarDrops(s, ctx, t);
    // Chispas y textos
    m.chispas = m.chispas.filter(c => now - c.t < 600);
    m.chispas.forEach(c => { const k = (now - c.t) / 1000; ctx.fillStyle = c.color; ctx.globalAlpha = 1 - k / 0.6; if (c.polvo) { ctx.beginPath(); ctx.arc(c.x + c.vx * k, c.y + c.vy * k, 4 + k * 14, 0, 7); ctx.fill(); } else ctx.fillRect(c.x + c.vx * k - 3, c.y + c.vy * k + 400 * k * k - 3, 6, 6); });
    ctx.globalAlpha = 1; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    m.efectos = m.efectos.filter(e => now - e.t < 1100);
    m.efectos.forEach(e => { const k = (now - e.t) / 1100; ctx.globalAlpha = 1 - k; ctx.font = `800 ${e.grande ? 26 : 19}px Figtree, ${FE}`; ctx.lineWidth = 4; ctx.strokeStyle = "#000a"; ctx.strokeText(e.txt, e.x, e.y - k * 50); ctx.fillStyle = e.color; ctx.fillText(e.txt, e.x, e.y - k * 50); });
    ctx.globalAlpha = 1;
    ctx.restore();
    if (M.luz) M.luz(s, ctx, W, H, esc, now);
    else { const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, s.tema && s.tema.suelo === "#2b2540" ? "rgba(10,0,20,.6)" : "rgba(0,0,0,.35)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); }
    // Mensajes y gente
    const msg = byId("mdMsg");
    if (msg) { const ver = now < m.msgHasta; msg.hidden = !ver; if (ver && msg.textContent !== m.msg) msg.textContent = m.msg; }
  },

  /* Personaje con su herramienta; golpe = progreso del hachazo (0..1) o -1 */
  persona(s, ctx, x, y, look, cara, nivel, golpe, anda, nombre, t, otro) {
    const img = this.muneco(look), h = this.herramienta(s.j, Math.max(0, Math.min(8, nivel | 0)));
    ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(x, y + 16, 22, 8, 0, 0, 7); ctx.fill();
    const salto = anda ? Math.abs(Math.sin(t * 10)) * 4 : 0;
    ctx.save(); ctx.translate(x, y - salto);
    if (cara < 0) ctx.scale(-1, 1);
    if (img.complete) ctx.drawImage(img, -30, -46, 60, 67);
    // Herramienta en la mano
    const ang = golpe >= 0 ? (-1.9 + golpe * 3.0) : (s.j === "pesca" ? -0.5 : -0.9 + Math.sin(t * 2) * 0.05);
    ctx.translate(18, -8); ctx.rotate(ang);
    if (h.complete) ctx.drawImage(h, -10, -40, 44, 44);
    ctx.restore();
    if (nombre) { ctx.textAlign = "center"; ctx.font = "bold 13px Figtree, " + FE; ctx.lineWidth = 3; ctx.strokeStyle = "#000a"; ctx.strokeText(nombre, x, y - 58); ctx.fillStyle = "#fff"; ctx.fillText(nombre, x, y - 58); }
    if (otro && otro.f && s.j === "pesca") Pesca.linea(ctx, x + (cara < 0 ? -30 : 30), y - 40, otro.f.x, otro.f.y, t, false);
  }
};

/* ---------- Gente en vivo (Supabase Realtime, canal por trabajo y día) ---------- */
const Presencia = {
  canal: null, otros: {}, sala: null, limpiar: null,
  entrar(s) {
    this.salir();
    const u = BD.usuario(s.uid);
    this.sala = `trabajo-${s.j}-${hoyStr()}`;
    this.otros = {};
    const recibir = p => {
      if (!p || p.id === s.uid) return;
      const o = this.otros[p.id] || { dx: p.x, dy: p.y, aT: -9999 };
      Object.assign(o, p, { visto: Date.now() }); if (p.a) o.aT = performance.now();
      this.otros[p.id] = o;
    };
    const salio = p => { if (p) delete this.otros[p.id]; };
    if (window.__presenciaLocal) {         // pruebas: canal entre pestañas del mismo navegador
      this.canal = new BroadcastChannel(this.sala);
      this.canal.onmessage = e => (e.data.ev === "x" ? salio : recibir)(e.data.p);
      this.mandar = (ev, p) => this.canal.postMessage({ ev, p });
    } else if (u && u.nube && typeof Nube !== "undefined" && Nube.sb && Nube.user) {
      this.canal = Nube.sb.channel(this.sala, { config: { broadcast: { self: false } } });
      this.canal.on("broadcast", { event: "p" }, ({ payload }) => recibir(payload)).on("broadcast", { event: "x" }, ({ payload }) => salio(payload)).subscribe();
      this.mandar = (ev, p) => { try { this.canal.send({ type: "broadcast", event: ev, payload: p }); } catch {} };
    } else this.mandar = null;
    clearInterval(this.limpiar);
    this.limpiar = setInterval(() => {
      const ahora = Date.now();
      for (const [id, o] of Object.entries(this.otros)) if (ahora - o.visto > 6000) delete this.otros[id];
      const g = byId("mdGente"); if (!g) return;
      const n = Object.keys(this.otros).length;
      g.textContent = !this.mandar ? "Jugando solo (sin cuenta en la nube)" : n ? `👥 ${n} más en ${TR.JUEGOS[s.j].lugar}` : `👥 Nadie más en ${TR.JUEGOS[s.j].lugar} por ahora`;
    }, 1000);
  },
  enviar(s, now) {
    if (!this.mandar) return;
    const m = s.m, golpe = now - m.swing < 300;
    const p = { id: s.uid, n: m.nombre, l: m.look, x: Math.round(m.x), y: Math.round(m.y), c: m.cara, h: s.nivel, a: golpe ? 1 : 0, f: s.j === "pesca" && m.boya ? { x: Math.round(m.boya.x), y: Math.round(m.boya.y) } : null };
    const firma = `${p.x},${p.y},${p.c},${golpe},${p.f ? p.f.x + ":" + p.f.y : ""}`;
    const cada = firma !== m.firma ? 200 : 2000;
    if (now - m.ultEnvio < cada) return;
    m.ultEnvio = now; m.firma = firma;
    this.mandar("p", p);
  },
  salir() {
    clearInterval(this.limpiar);
    if (this.mandar && this.canal && Trabajos.s) this.mandar("x", { id: Trabajos.s.uid });
    if (this.canal) { try { this.canal instanceof BroadcastChannel ? this.canal.close() : Nube.sb.removeChannel(this.canal); } catch {} }
    this.canal = null; this.mandar = null; this.otros = {};
  }
};

/* ---------- Tala: bosque ---------- */
const ARBOLES = {
  pino: { ic: "🌲", hp: 6, madera: 1, peso: 60, r: 22 },
  roble: { ic: "🌳", hp: 10, madera: 2.2, peso: 30, r: 26 },
  dorado: { ic: "🌳", hp: 9, madera: 6, peso: 6, r: 26, oro: true }
};
const arbolesDe = s => (s.tema && s.tema.arboles) || ARBOLES;
const Tala = {
  generar(s, r) {
    const AR_ = arbolesDe(s);
    const m = s.m; m.W = 2400; m.H = 1800; m.x = 1200; m.y = 900;
    m.arboles = []; m.rocas = []; m.flores = []; m.manchas = [];
    for (let k = 0; k < 900 && m.arboles.length < 170; k++) {
      const x = 60 + r() * (m.W - 120), y = 60 + r() * (m.H - 120);
      if (Math.hypot(x - 1200, y - 900) < 160 || m.arboles.some(a => Math.hypot(a.x - x, a.y - y) < 78)) continue;
      const tipo = pesoAzar(r, Object.keys(AR_), k => AR_[k].peso);
      m.arboles.push({ x, y, tipo, hp: AR_[tipo].hp, caido: 0, tiembla: 0 });
    }
    for (let k = 0; k < 200 && m.rocas.length < 22; k++) {
      const x = 80 + r() * (m.W - 160), y = 80 + r() * (m.H - 160);
      if (Math.hypot(x - 1200, y - 900) < 160 || m.arboles.some(a => Math.hypot(a.x - x, a.y - y) < 70)) continue;
      m.rocas.push({ x, y });
    }
    const colores = s.tema ? s.tema.flores : ["#ffd43b", "#ff8fab", "#ffffff", "#b197fc"];
    for (let k = 0; k < 160; k++) m.flores.push({ x: r() * m.W, y: r() * m.H, c: colores[Math.floor(r() * colores.length)] });
    for (let k = 0; k < 40; k++) m.manchas.push({ x: r() * m.W, y: r() * m.H, rad: 80 + r() * 160 });
    m.pasto = Array.from({ length: 420 }, () => ({ x: r() * m.W, y: r() * m.H, h: 6 + r() * 8 }));
    m.abejas = Array.from({ length: 6 }, () => ({ x: 200 + r() * (m.W - 400), y: 200 + r() * (m.H - 400), vx: 0, vy: 0, cambio: 0 }));
  },
  libre(s, x, y) {
    const m = s.m;
    if (x < 20 || y < 20 || x > m.W - 20 || y > m.H - 20) return false;
    const AR_ = arbolesDe(s);
    for (const a of m.arboles) if (!a.caido && Math.abs(a.x - x) < 40 && Math.hypot(a.x - x, a.y - y) < AR_[a.tipo].r) return false;
    for (const k of m.rocas) if (Math.abs(k.x - x) < 40 && Math.hypot(k.x - x, k.y - y) < 30) return false;
    return true;
  },
  golpear(s, fx, fy, radio, dano, now) {
    const m = s.m; let pego = 0;
    for (const a of m.arboles) {
      if (a.caido || Math.abs(a.x - fx) > radio + 30 || Math.hypot(a.x - fx, a.y - 20 - fy) > radio + 20) continue;
      const A = arbolesDe(s)[a.tipo];
      a.hp -= dano; a.tiembla = now; pego++;
      Mundo.chispas(s, a.x, a.y - 20, "#c08a4a", 5);
      if (a.hp <= 0) {
        a.caido = now;
        const madera = Math.round(A.madera * TR.RINDE[s.nivel] * 10) / 10;
        Mundo.soltar(s, a.x, a.y - 30, { ic: s.tema ? A.ic : "🪵", item: A.nombre || (A.oro ? "Madera dorada" : "Madera"), cant: madera, valor: madera, n: Math.min(5, Math.max(2, Math.round(madera))), grande: A.oro });
        Mundo.chispas(s, a.x, a.y - 40, A.oro ? "#ffd43b" : "#3f8f3a", 14);
        if (typeof Sonido !== "undefined") Sonido.sfx("cae");
      }
    }
    return pego;
  },
  tic(s, dt, now) {
    const m = s.m;
    for (const a of m.arboles) if (a.caido && now - a.caido > 25000 && Math.hypot(a.x - m.x, a.y - m.y) > 80) { a.caido = 0; a.hp = arbolesDe(s)[a.tipo].hp; }
    for (const b of m.abejas) {
      if (now > b.cambio) { const ang = Math.random() * 7, v = 40 + Math.random() * 50; b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v; b.cambio = now + 1500 + Math.random() * 2500; }
      // Si estás cerca, te persiguen un poco
      const dx = m.x - b.x, dy = m.y - b.y, d = Math.hypot(dx, dy);
      if (d < 260 && d > 1) { b.vx += dx / d * 60 * dt; b.vy += dy / d * 60 * dt; }
      b.x = Math.max(40, Math.min(m.W - 40, b.x + b.vx * dt)); b.y = Math.max(40, Math.min(m.H - 40, b.y + b.vy * dt));
      if (d < 34 && now > m.aturdido + 1000) {
        const en = s.tema ? s.tema.enemigo : "🐝";
        m.aturdido = now + 2200; Mundo.texto(s, m.x, m.y - 70, `${en} ¡Ay!`, "#ff6b7d"); Mundo.aviso(s, en === "🐝" ? "¡Te picaron las abejas! Quedas lento un momento." : `¡${en} te atrapó! Quedas lento un momento.`);
        if (typeof Sonido !== "undefined") Sonido.sfx("mal"); try { navigator.vibrate && navigator.vibrate(200); } catch {}
        b.vx = -b.vx * 3; b.vy = -b.vy * 3;
      }
    }
  },
  suelo(s, ctx, v, t) {
    const m = s.m;
    ctx.fillStyle = s.tema ? s.tema.suelo : "#5a9a48"; ctx.fillRect(0, 0, m.W, m.H);
    ctx.fillStyle = s.tema ? s.tema.manchas : "#528f41"; m.manchas.forEach(p => { if (p.x > v.x0 - p.rad && p.x < v.x1 + p.rad && p.y > v.y0 - p.rad && p.y < v.y1 + p.rad) { ctx.beginPath(); ctx.arc(p.x, p.y, p.rad, 0, 7); ctx.fill(); } });
    ctx.strokeStyle = s.tema ? s.tema.borde : "#3f7a33"; ctx.lineWidth = 2; ctx.globalAlpha = 0.7; ctx.beginPath();
    for (const p of m.pasto) if (p.x > v.x0 && p.x < v.x1 && p.y > v.y0 && p.y < v.y1) { ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x - 6, p.y - p.h * 0.7); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.sin(t * 2 + p.x) * 1.5, p.y - p.h); ctx.moveTo(p.x + 4, p.y); ctx.lineTo(p.x + 6, p.y - p.h * 0.7); }
    ctx.stroke(); ctx.globalAlpha = 1;
    m.flores.forEach(f => { if (f.x > v.x0 && f.x < v.x1 && f.y > v.y0 && f.y < v.y1) { ctx.fillStyle = f.c; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(f.x + Math.cos(i * 1.57) * 3, f.y + Math.sin(i * 1.57) * 3, 2.4, 0, 7); ctx.fill(); } ctx.fillStyle = "#fff6"; ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, 7); ctx.fill(); } });
    ctx.strokeStyle = s.tema ? s.tema.borde : "#1b3d1d"; ctx.lineWidth = 14; ctx.strokeRect(0, 0, m.W, m.H);
  },
  objetos(s, v, t) {
    const m = s.m, out = [], now = performance.now();
    for (const a of m.arboles) {
      if (a.x < v.x0 || a.x > v.x1 || a.y < v.y0 || a.y > v.y1) continue;
      out.push({ y: a.y, d: ctx => {
        const A = arbolesDe(s)[a.tipo];
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        if (a.caido) {
          // Tocón (o tierra removida en los eventos) mientras vuelve a crecer
          const crece = Math.min(1, (performance.now() - a.caido) / 25000);
          ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(a.x, a.y + 6, 22, 8, 0, 0, 7); ctx.fill();
          if (s.tema) { ctx.fillStyle = "rgba(90,60,40,.7)"; ctx.beginPath(); ctx.ellipse(a.x, a.y + 2, 18, 8, 0, 0, 7); ctx.fill(); }
          else {
            ctx.fillStyle = "#6b4423"; ctx.fillRect(a.x - 14, a.y - 10, 28, 14); ctx.beginPath(); ctx.ellipse(a.x, a.y + 4, 14, 5, 0, 0, 7); ctx.fill();
            ctx.fillStyle = "#d9a86a"; ctx.beginPath(); ctx.ellipse(a.x, a.y - 10, 14, 6, 0, 0, 7); ctx.fill();
            ctx.strokeStyle = "#a8743f"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(a.x, a.y - 10, 8, 3.2, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(a.x, a.y - 10, 3.5, 1.4, 0, 0, 7); ctx.stroke();
          }
          if (crece > 0.6) { ctx.font = "18px " + FE; ctx.fillStyle = "#000"; ctx.fillText("🌱", a.x + 10, a.y - 12); }
          return;
        }
        ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(a.x, a.y + 8, 30, 10, 0, 0, 7); ctx.fill();
        if (A.oro) { ctx.fillStyle = `rgba(255,212,59,${0.25 + Math.sin(t * 3) * 0.1})`; ctx.beginPath(); ctx.arc(a.x, a.y - 30, 48, 0, 7); ctx.fill(); }
        const sh = now - a.tiembla < 200 ? Math.sin((now - a.tiembla) / 15) * 4 : 0;
        ctx.save(); ctx.translate(a.x + sh, a.y + 12); ctx.rotate(Math.sin(t * 1.3 + a.x * 0.01) * 0.035);
        ctx.font = (A.tam || (a.tipo === "pino" ? 74 : 82)) + "px " + FE; ctx.fillStyle = "#000"; ctx.fillText(A.ic, 0, 0); ctx.restore();
        if (A.oro) { ctx.font = "18px " + FE; ctx.fillStyle = "#000"; ctx.fillText("✨", a.x + 24, a.y - 60 + Math.sin(t * 4) * 4); }
        if (a.hp < A.hp) { ctx.fillStyle = "#0008"; ctx.fillRect(a.x - 26, a.y - 86, 52, 7); ctx.fillStyle = "#3ddcb1"; ctx.fillRect(a.x - 26, a.y - 86, 52 * Math.max(0, a.hp / A.hp), 7); }
      } });
    }
    for (const k of m.rocas) if (k.x > v.x0 && k.x < v.x1 && k.y > v.y0 && k.y < v.y1) out.push({ y: k.y, d: ctx => { ctx.textAlign = "center"; ctx.font = "54px " + FE; ctx.fillStyle = "#000"; ctx.fillText("🪨", k.x, k.y + 16); } });
    for (const b of m.abejas) if (b.x > v.x0 && b.x < v.x1 && b.y > v.y0 && b.y < v.y1) out.push({ y: b.y + 200, d: ctx => { ctx.textAlign = "center"; ctx.font = "26px " + FE; ctx.fillStyle = "#000"; const en = s.tema ? s.tema.enemigo : "🐝"; for (let i = 0; i < (en === "🐝" ? 3 : 1); i++) ctx.fillText(en, b.x + Math.sin(t * 9 + i * 2) * 14, b.y + Math.cos(t * 7 + i * 2) * 10 - 20); } });
    return out;
  }
};

/* ---------- Mina: cueva por casilleros ---------- */
const MINERALES = [
  { id: "piedra", nombre: "Piedra", hp: 3, v: 0.4, req: 0, peso: 1, desde: 0, color: "#6b6f78" },
  { id: "carbon", nombre: "Carbón", hp: 5, v: 1, req: 0, peso: 30, desde: 0, color: "#141416" },
  { id: "hierro", nombre: "Hierro", hp: 7, v: 2, req: 1, peso: 24, desde: 5, color: "#e3c9a6" },
  { id: "oro", nombre: "Oro", hp: 8, v: 3.5, req: 2, peso: 18, desde: 10, color: "#ffcc33" },
  { id: "esmeralda", nombre: "Esmeralda", hp: 10, v: 6, req: 3, peso: 14, desde: 16, color: "#2fd27a" },
  { id: "diamante", nombre: "Diamante", hp: 12, v: 10, req: 4, peso: 11, desde: 22, color: "#6fe0ff" },
  { id: "adamantio", nombre: "Adamantio", hp: 14, v: 15, req: 5, peso: 9, desde: 28, color: "#e0344f" },
  { id: "arcano", nombre: "Cristal arcano", hp: 16, v: 22, req: 6, peso: 7, desde: 34, color: "#b77bff" },
  { id: "vacio", nombre: "Fragmento del vacío", hp: 18, v: 30, req: 7, peso: 5, desde: 40, color: "#8a3dff" },
  { id: "tnt", nombre: "TNT", hp: 1, v: 0, req: 0, peso: 0, desde: 3, color: "#c0392b" }
];
const MT = 56;   // tamaño de cada casillero
const Mina = {
  generar(s, r) {
    const m = s.m, C = 50, F = 34; m.C = C; m.F = F; m.W = C * MT; m.H = F * MT;
    let sol = Array.from({ length: C * F }, (_, k) => { const x = k % C, y = Math.floor(k / C); return x === 0 || y === 0 || x === C - 1 || y === F - 1 || r() < 0.47; });
    for (let it = 0; it < 5; it++) {
      sol = sol.map((v, k) => {
        const x = k % C, y = Math.floor(k / C);
        if (x === 0 || y === 0 || x === C - 1 || y === F - 1) return true;
        let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && sol[(y + dy) * C + x + dx]) n++;
        return n >= 5 || (n === 4 && v);
      });
    }
    // Entrada a la izquierda y un túnel serpenteante hacia el fondo
    const abrir = (x, y) => { if (x > 0 && y > 0 && x < C - 1 && y < F - 1) sol[y * C + x] = false; };
    for (let y = 14; y <= 19; y++) for (let x = 1; x <= 5; x++) abrir(x, y);
    let tx = 5, ty = 17;
    while (tx < C - 3) { abrir(tx, ty); abrir(tx, ty + 1); if (r() < 0.6) tx++; else ty = Math.max(3, Math.min(F - 4, ty + (r() < 0.5 ? -1 : 1))); }
    // Casilleros: -1 aire, -2 roca madre (borde), 0.. índice de MINERALES
    m.t = new Int8Array(C * F); m.hp = new Float32Array(C * F);
    for (let k = 0; k < C * F; k++) {
      const x = k % C, y = Math.floor(k / C);
      if (x === 0 || y === 0 || x === C - 1 || y === F - 1) { m.t[k] = -2; continue; }
      if (!sol[k]) { m.t[k] = -1; continue; }
      let idx = 0;
      const prob = 0.07 + 0.13 * (x / C);
      if (r() < 0.012 && x > 3) idx = MINERALES.length - 1;
      else if (r() < prob) { const ok = MINERALES.filter(M => M.peso > 1 && x >= M.desde); const elegido = pesoAzar(r, ok, M => M.peso * (1 + (M.desde ? 0.5 : 0))); idx = MINERALES.indexOf(elegido); }
      m.t[k] = idx; m.hp[k] = MINERALES[idx].hp;
    }
    m.x = 3 * MT; m.y = 17 * MT;
    // Antorchas en las paredes de los pasillos abiertos
    m.antorchas = [];
    for (let k = 0; k < C * F; k++) {
      if (m.t[k] !== -1) continue;
      const x = k % C, y = Math.floor(k / C);
      if (m.t[k - C] >= 0 || m.t[k - C] === -2) { if (r() < 0.07 && !m.antorchas.some(a => Math.abs(a.cx - x) + Math.abs(a.cy - y) < 5)) m.antorchas.push({ cx: x, cy: y, x: (x + 0.5) * MT, y: y * MT + 8, f: r() * 7 }); }
    }
    m.prof = 0;
  },
  casilla(m, x, y) { const cx = Math.floor(x / MT), cy = Math.floor(y / MT); if (cx < 0 || cy < 0 || cx >= m.C || cy >= m.F) return -2; return m.t[cy * m.C + cx]; },
  libre(s, x, y) {
    const m = s.m, r = 15;
    return [[0, 0], [-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]].every(([dx, dy]) => this.casilla(m, x + dx, y + dy) === -1);
  },
  alMoverse(s) { const m = s.m, p = Math.floor(m.x / MT) * 3; if (p > m.prof) { m.prof = p; } },
  romper(s, k, now, cadena = 0) {
    const m = s.m, idx = m.t[k]; if (idx < 0) return;
    const M = MINERALES[idx], x = (k % m.C + 0.5) * MT, y = (Math.floor(k / m.C) + 0.5) * MT;
    m.t[k] = -1;
    if (M.id === "tnt") {
      if (typeof Sonido !== "undefined") Sonido.sfx("bang");
      Mundo.texto(s, x, y - 20, "💥", "#ffb02e", true); Mundo.chispas(s, x, y, "#ffb02e", 24);
      try { navigator.vibrate && navigator.vibrate(300); } catch {}
      const cx = k % m.C, cy = Math.floor(k / m.C);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > 5) continue;
        const kk = (cy + dy) * m.C + cx + dx, v = m.t[kk];
        if (v >= 0 && cadena < 4 && MINERALES[v].req <= s.nivel) this.romper(s, kk, now, cadena + 1);
      }
      return;
    }
    Mundo.chispas(s, x, y, M.color, 9);
    if (M.v) {
      const v = Math.round(M.v * TR.RINDE[s.nivel] * 10) / 10;
      Mundo.soltar(s, x, y, { gema: M.id === "piedra" ? "#8d949e" : M.color === "#141416" ? "#3a3a40" : M.color, ic: M.id === "piedra" ? "🪨" : "💎", item: M.nombre, cant: 1, valor: v, n: 1, grande: M.req >= 3 });
    }
  },
  golpear(s, fx, fy, radio, dano, now) {
    const m = s.m; let pego = 0;
    const c0 = Math.max(0, Math.floor((fx - radio) / MT)), c1 = Math.min(m.C - 1, Math.floor((fx + radio) / MT));
    const f0 = Math.max(0, Math.floor((fy - radio) / MT)), f1 = Math.min(m.F - 1, Math.floor((fy + radio) / MT));
    let duro = null;
    for (let cy = f0; cy <= f1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const k = cy * m.C + cx, idx = m.t[k]; if (idx < 0) continue;
      const px = Math.max(cx * MT, Math.min(fx, (cx + 1) * MT)), py = Math.max(cy * MT, Math.min(fy, (cy + 1) * MT));
      if (Math.hypot(px - fx, py - fy) > radio) continue;
      const M = MINERALES[idx], blando = M.req <= s.nivel;
      if (!blando) duro = M;
      m.hp[k] -= dano * (blando ? 1 : 0.12); pego++;
      if (m.hp[k] <= 0) this.romper(s, k, now);
    }
    if (duro && !m.avisoDuro) { m.avisoDuro = true; Mundo.aviso(s, `${duro.nombre}: muy duro. Necesitas ${Trabajos.nombreHerr("mina", duro.req).toLowerCase()} o mejor.`); setTimeout(() => m.avisoDuro = false, 3000); }
    return pego;
  },
  tic() {},
  suelo(s, ctx, v, t) {
    const m = s.m;
    ctx.fillStyle = "#0c0b10"; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    const c0 = Math.max(0, Math.floor(v.x0 / MT)), c1 = Math.min(m.C - 1, Math.floor(v.x1 / MT));
    const f0 = Math.max(0, Math.floor(v.y0 / MT)), f1 = Math.min(m.F - 1, Math.floor(v.y1 / MT));
    for (let cy = f0; cy <= f1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const k = cy * m.C + cx, idx = m.t[k], x = cx * MT, y = cy * MT;
      if (idx === -1) { ctx.fillStyle = (cx * 7 + cy * 13) % 5 ? "#2b2730" : "#2f2a35"; ctx.fillRect(x, y, MT, MT); if ((cx * 31 + cy * 17) % 9 === 0) { ctx.fillStyle = "#3a3540"; ctx.beginPath(); ctx.arc(x + 18, y + 30, 4, 0, 7); ctx.arc(x + 38, y + 20, 3, 0, 7); ctx.fill(); } continue; }
      if (idx === -2) { ctx.fillStyle = "#121016"; ctx.fillRect(x, y, MT, MT); continue; }
      const M = MINERALES[idx];
      const g = 92 - (cx / m.C) * 40;   // más hondo, más oscuro
      ctx.fillStyle = `rgb(${g},${g - 2},${g + 8})`; ctx.fillRect(x, y, MT, MT);
      ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(x, y, MT, 5);
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(x, y + MT - 5, MT, 5);
      if (M.id === "tnt") {
        ctx.fillStyle = "#c0392b"; ctx.fillRect(x + 6, y + 6, MT - 12, MT - 12); ctx.fillStyle = "#fff"; ctx.font = "bold 13px Figtree, " + FE; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("TNT", x + MT / 2, y + MT / 2);
      } else if (M.id !== "piedra") {
        const brilla = M.req >= 3 ? 0.75 + Math.sin(t * 3 + cx) * 0.25 : 1;
        [[14, 16, 7], [37, 22, 8], [22, 39, 6], [41, 42, 5]].forEach(([a, b, rr]) => {
          ctx.fillStyle = M.color; ctx.globalAlpha = brilla; ctx.beginPath(); ctx.moveTo(x + a, y + b - rr); ctx.lineTo(x + a + rr, y + b); ctx.lineTo(x + a, y + b + rr); ctx.lineTo(x + a - rr, y + b); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.moveTo(x + a, y + b - rr); ctx.lineTo(x + a + rr * 0.5, y + b - rr * 0.3); ctx.lineTo(x + a - rr * 0.2, y + b - rr * 0.3); ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
      const max = M.hp, p = m.hp[k] / max;
      if (p < 1) { ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, y + 12); ctx.lineTo(x + 28, y + 26); ctx.lineTo(x + 20, y + 44); if (p < 0.5) { ctx.moveTo(x + 28, y + 26); ctx.lineTo(x + 46, y + 18); ctx.moveTo(x + 30, y + 30); ctx.lineTo(x + 44, y + 48); } ctx.stroke(); }
    }
    // Antorchas
    for (const a of m.antorchas) {
      if (a.x < v.x0 || a.x > v.x1 || a.y < v.y0 || a.y > v.y1) continue;
      ctx.fillStyle = "#5c3b1e"; ctx.fillRect(a.x - 3, a.y, 6, 16);
      const fl = Math.sin(t * 12 + a.f) * 2;
      ctx.fillStyle = "#ff8c00"; ctx.beginPath(); ctx.ellipse(a.x, a.y - 4 + fl * 0.3, 7, 11 + fl, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.ellipse(a.x, a.y - 1, 3.5, 6, 0, 0, 7); ctx.fill();
    }
    // Cartel de la entrada
    ctx.fillStyle = "#ffd43b"; ctx.font = "bold 16px Figtree, " + FE; ctx.textAlign = "center"; ctx.fillText("⛏️ Más hondo = minerales mejores →", 3 * MT, 13.4 * MT);
  },
  objetos() { return []; },
  /* Oscuridad con huecos de luz: tu lámpara (más grande con mejor pico) y las antorchas */
  luz(s, ctx, W, H, esc, now) {
    const m = s.m, t = now / 1000;
    const o = this.sombra = this.sombra || document.createElement("canvas");
    if (o.width !== W || o.height !== H) { o.width = W; o.height = H; }
    const c = o.getContext("2d");
    c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, W, H); c.fillStyle = "rgba(5,4,8,.95)"; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "destination-out";
    const hueco = (x, y, r) => { const g = c.createRadialGradient(x, y, r * 0.3, x, y, r); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
    hueco(W / 2, H / 2, (230 + s.nivel * 18) * esc);
    const aPantalla = (x, y) => [(x - m.x) * esc + W / 2, (y - m.y) * esc + H / 2];
    const visibles = m.antorchas.filter(a => Math.abs(a.x - m.x) < W / esc && Math.abs(a.y - m.y) < H / esc);
    visibles.forEach(a => { const [x, y] = aPantalla(a.x, a.y); hueco(x, y, (150 + Math.sin(t * 9 + a.f) * 8) * esc); });
    ctx.drawImage(o, 0, 0, W, H);
    // Resplandor cálido de las antorchas
    ctx.globalCompositeOperation = "lighter";
    visibles.forEach(a => { const [x, y] = aPantalla(a.x, a.y), r = 120 * esc, g = ctx.createRadialGradient(x, y, 4, x, y, r); g.addColorStop(0, "rgba(255,140,40,.35)"); g.addColorStop(1, "rgba(255,140,40,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Figtree, " + FE; ctx.textAlign = "left"; ctx.fillText(`Profundidad: ${s.m.prof} m`, 14, H - 18);
  }
};

/* ---------- Pesca: lago ---------- */
const PECES = [
  { nombre: "Bota vieja", ic: "👢", v: 0, peso: 10, dif: 0.4, mejora: -0.12 },
  { nombre: "Sardina", ic: "🐟", v: 2, peso: 40, dif: 0.7, mejora: -0.05 },
  { nombre: "Trucha", ic: "🐟", v: 3.5, peso: 24, dif: 0.9, mejora: 0 },
  { nombre: "Cangrejo", ic: "🦀", v: 4, peso: 12, dif: 0.9, mejora: 0.1 },
  { nombre: "Pez globo", ic: "🐡", v: 5, peso: 10, dif: 1.1, mejora: 0.15 },
  { nombre: "Pez tropical", ic: "🐠", v: 6.5, peso: 8, dif: 1.2, mejora: 0.25 },
  { nombre: "Pulpo", ic: "🐙", v: 9, peso: 4, dif: 1.4, mejora: 0.4 },
  { nombre: "Calamar gigante", ic: "🦑", v: 14, peso: 2, dif: 1.6, mejora: 0.6 },
  { nombre: "Cofre del tesoro", ic: "💰", v: 20, peso: 0.6, dif: 1.2, mejora: 0.8 },
  { nombre: "Tiburón", ic: "🦈", v: 22, peso: 1, dif: 1.9, mejora: 0.9, desde: 2 },
  { nombre: "Ballena", ic: "🐋", v: 35, peso: 0.4, dif: 2.2, mejora: 1.2, desde: 5 },
  { nombre: "Pez del vacío", ic: "🌌", v: 50, peso: 0.15, dif: 2.5, mejora: 1.6, desde: 7 }
];
const Pesca = {
  fuerza: n => 1 + n * 0.25,           // qué tan rápido sube la barra y recoges
  resistencia: n => 1 + n * 0.2,       // tamaño de la barra y cuánto aguanta la línea
  generar(s, r) {
    const m = s.m; m.W = 2200; m.H = 1500;
    m.lagos = [{ x: 1100, y: 760, rx: 520 + r() * 80, ry: 330 + r() * 50 }, { x: 760 + r() * 120, y: 600, rx: 260, ry: 200 }, { x: 1420 + r() * 120, y: 900, rx: 280, ry: 210 }];
    m.x = 300; m.y = 760;
    m.arboles = []; m.flores = [];
    for (let k = 0; k < 500 && m.arboles.length < 45; k++) {
      const x = 50 + r() * (m.W - 100), y = 50 + r() * (m.H - 100);
      if (this.agua(m, x, y, 90) || Math.hypot(x - 300, y - 760) < 120 || m.arboles.some(a => Math.hypot(a.x - x, a.y - y) < 90)) continue;
      m.arboles.push({ x, y, ic: r() < 0.5 ? "🌳" : "🌴" });
    }
    for (let k = 0; k < 120; k++) m.flores.push({ x: r() * m.W, y: r() * m.H, c: ["#ffd43b", "#ff8fab", "#ffffff"][Math.floor(r() * 3)] });
    m.burbujas = Array.from({ length: 6 }, () => this.lugarAgua(m, r));
    // Nenúfares y juncos cerca de la orilla; sombras de peces nadando
    m.nenufares = []; m.juncos = []; m.sombras = [];
    for (let k = 0; k < 400 && m.nenufares.length < 24; k++) { const x = 300 + r() * 1600, y = 300 + r() * 900; if (this.agua(m, x, y, -20) && !this.agua(m, x, y, -110)) m.nenufares.push({ x, y, r: 10 + r() * 8, a: r() * 7, flor: r() < 0.3 }); }
    for (let k = 0; k < 900 && m.juncos.length < 70; k++) { const x = 200 + r() * 1800, y = 200 + r() * 1100; if (!this.agua(m, x, y, 4) && this.agua(m, x, y, 40)) m.juncos.push({ x, y, h: 18 + r() * 16 }); }
    for (let k = 0; k < 9; k++) m.sombras.push({ ...this.lugarAgua(m, r), a: r() * 7, v: 20 + r() * 30 });
    m.p = "nada"; m.boya = null;
  },
  lugarAgua(m, r = Math.random) { for (let k = 0; k < 200; k++) { const x = 300 + r() * 1600, y = 300 + r() * 900; if (this.agua(m, x, y, -60)) return { x, y, hasta: performance.now() + 30000 + Math.random() * 30000 }; } return { x: 1100, y: 760, hasta: 0 }; },
  /* ¿Hay agua en (x, y)? margen > 0 agranda el lago (para dejar orilla) */
  agua(m, x, y, margen = 0) { return m.lagos.some(l => ((x - l.x) / (l.rx + margen)) ** 2 + ((y - l.y) / (l.ry + margen)) ** 2 <= 1); },
  libre(s, x, y) {
    const m = s.m;
    if (x < 20 || y < 20 || x > m.W - 20 || y > m.H - 20) return false;
    if (this.agua(m, x, y, 6)) return false;
    for (const a of m.arboles) if (Math.hypot(a.x - x, a.y - y) < 24) return false;
    return true;
  },
  quieto(s) { return s.m.p === "pelea"; },
  alMoverse(s) { const m = s.m; if (m.p === "espera" || m.p === "pica") { m.p = "nada"; m.boya = null; Mundo.aviso(s, "Recogiste la línea al moverte."); } },
  elegir(nivel, bonus) {
    const ok = PECES.filter(p => !p.desde || nivel >= p.desde);
    return pesoAzar(Math.random, ok, p => Math.max(0.05, p.peso * (1 + p.mejora * (nivel + bonus))));
  },
  accion(s, now) {
    const m = s.m;
    if (m.p === "nada") {
      // Busca agua en la dirección en que miras
      const dir = Math.hypot(m.dir.x, m.dir.y) > 0.1 ? m.dir : { x: m.cara, y: 0 };
      let primera = null, ultima = null; const alcance = 150 + s.nivel * 28;
      for (let d = 10; d <= alcance; d += 8) { const x = m.x + dir.x * d, y = m.y + dir.y * d; if (this.agua(m, x, y)) { primera = primera || d; ultima = { x, y }; } else if (primera) break; }
      if (!primera || primera > 90) { Mundo.aviso(s, "Acércate a la orilla y mira hacia el agua para lanzar."); return; }
      m.boya = ultima; m.p = "espera";
      const cerca = m.burbujas.some(b => Math.hypot(b.x - ultima.x, b.y - ultima.y) < 80);
      m.bonus = (cerca ? 2.5 : 0) + Math.min(1.5, (alcance - primera) / 200);
      m.espera = now + (cerca ? 900 : 1600) + Math.random() * (cerca ? 1800 : 3500);
      Mundo.aviso(s, cerca ? "¡Lanzaste en un cardumen! Pican mejores peces." : "Esperando que pique…", 1800);
      if (typeof Sonido !== "undefined") Sonido.sfx("agua");
    } else if (m.p === "espera") { m.p = "nada"; m.boya = null; Mundo.aviso(s, "¡Muy apurado! Se espantaron."); }
    else if (m.p === "pica") {
      const pez = this.elegir(s.nivel, m.bonus);
      const R = this.resistencia(s.nivel);
      m.pez = pez; m.p = "pelea";
      const alto = Math.min(0.45, 0.16 * R);
      m.juego = { pez: 0.5, objetivo: 0.5, vel: 0, barra: 0.5 - alto / 2, vbarra: 0, alto, avance: 30, prox: now + 700 };
      Mundo.aviso(s, "¡Enganchado! Mantén apretado para subir la barra verde y tener al pez adentro.", 2600);
      byId("mdPesca").hidden = false;
    }
  },
  tic(s, dt, now) {
    const m = s.m;
    for (const b of m.burbujas) if (now > b.hasta) Object.assign(b, this.lugarAgua(m));
    if (m.p === "espera" && now > m.espera) {
      m.p = "pica"; m.picaHasta = now + 900 + s.nivel * 120;
      if (typeof Sonido !== "undefined") Sonido.sfx("tic"); try { navigator.vibrate && navigator.vibrate(120); } catch {}
      Mundo.aviso(s, "¡PICÓ! Toca el botón ya.", 1200);
    } else if (m.p === "pica" && now > m.picaHasta) { m.p = "nada"; m.boya = null; Mundo.aviso(s, "Se escapó… Lanza de nuevo."); }
    else if (m.p === "pelea") this.pelea(s, dt, now);
  },
  /* Mini-juego: el pez sube y baja; la barra verde sube mientras aprietas (fuerza) y es más grande con mejor caña (resistencia) */
  pelea(s, dt, now) {
    const m = s.m, g = m.juego, p = m.pez, F = this.fuerza(s.nivel), R = this.resistencia(s.nivel);
    if (now > g.prox) { g.objetivo = Math.random(); g.prox = now + (400 + Math.random() * 1400) / p.dif; }
    g.vel += (g.objetivo - g.pez) * 6 * p.dif * dt; g.vel *= 0.9; g.pez = Math.max(0, Math.min(1, g.pez + g.vel * dt * 2));
    g.vbarra += (m.aprieta ? 2.6 * F : -2.2) * dt; g.vbarra *= 0.94;
    g.barra += g.vbarra * dt;
    if (g.barra < 0) { g.barra = 0; g.vbarra = Math.max(0, g.vbarra) * -0.3; }
    if (g.barra > 1 - g.alto) { g.barra = 1 - g.alto; g.vbarra = Math.min(0, g.vbarra) * -0.3; }
    const adentro = g.pez >= g.barra && g.pez <= g.barra + g.alto;
    g.avance += adentro ? (16 + 4 * F) * dt : -(16 * p.dif / R) * dt;
    if (g.avance >= 100) {
      const v = Math.round(p.v * TR.RINDE[s.nivel] * 10) / 10;
      Mundo.soltar(s, m.boya.x, m.boya.y, { ic: p.ic, item: `${p.ic} ${p.nombre}`, cant: 1, valor: v, n: 1, directo: true, grande: p.v >= 14 });
      for (let i = 0; i < 10; i++) m.chispas.push({ x: m.boya.x, y: m.boya.y, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 200, t: performance.now(), color: "#a5d8ff" });
      Mundo.texto(s, m.x, m.y - 80, `${p.ic} ${p.nombre}!`, p.v >= 14 ? "#ffd43b" : "#fff", p.v >= 14);
      Mundo.aviso(s, p.v ? `¡Pescaste ${p.nombre}! Vale ${Math.round(v * TR.JUEGOS.pesca.factor * 10) / 10} 🪙.` : `Sacaste ${p.nombre}… no vale nada.`);
      if (typeof Sonido !== "undefined") Sonido.sfx(p.v >= 14 ? "logro" : p.v ? "bien" : "mal");
      return this.cerrar(s);
    } else if (g.avance <= 0) {
      Mundo.aviso(s, `Se escapó ${p.ic} ${p.nombre}.`); if (typeof Sonido !== "undefined") Sonido.sfx("mal");
      return this.cerrar(s);
    }
    this.dibujarPelea(s);
  },
  cerrar(s) { const m = s.m; m.p = "nada"; m.boya = null; m.pez = null; const c = byId("mdPesca"); if (c) c.hidden = true; },
  dibujarPelea(s) {
    const cv = byId("mdPescaCv"); if (!cv) return;
    const m = s.m, g = m.juego, ctx = cv.getContext("2d"), W = cv.width, H = cv.height, top = 10, alto = H - 20;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0e2a44"; ctx.fillRect(18, top, 40, alto);
    ctx.strokeStyle = "#6fb6ff"; ctx.lineWidth = 2; ctx.strokeRect(18, top, 40, alto);
    const by = top + alto * (1 - g.barra - g.alto);
    ctx.fillStyle = "rgba(61,220,177,.75)"; ctx.fillRect(20, by, 36, alto * g.alto);
    ctx.font = "26px " + FE; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#000"; ctx.fillText(m.pez.ic, 38, top + alto * (1 - g.pez));
    ctx.fillStyle = "#1b1726"; ctx.fillRect(70, top, 14, alto);
    ctx.fillStyle = g.avance > 66 ? "#3ddcb1" : g.avance > 33 ? "#ffc53d" : "#ff4d63";
    ctx.fillRect(70, top + alto * (1 - g.avance / 100), 14, alto * g.avance / 100);
    const tx = byId("mdPescaTxt"); if (tx) tx.textContent = `💪 ${this.fuerza(s.nivel).toFixed(1)} · 🛡️ ${this.resistencia(s.nivel).toFixed(1)}`;
  },
  linea(ctx, x0, y0, x1, y1, t, pica) {
    ctx.strokeStyle = "rgba(240,240,255,.8)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 30, x1, y1); ctx.stroke();
    const dy = pica ? Math.sin(t * 30) * 5 + 4 : Math.sin(t * 3) * 2;
    ctx.fillStyle = "#ff4d4d"; ctx.beginPath(); ctx.arc(x1, y1 + dy, 7, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x1, y1 + dy, 7, 0, Math.PI); ctx.fill();
  },
  suelo(s, ctx, v, t) {
    const m = s.m;
    ctx.fillStyle = "#3a7a3c"; ctx.fillRect(0, 0, m.W, m.H);
    m.flores.forEach(f => { if (f.x > v.x0 && f.x < v.x1 && f.y > v.y0 && f.y < v.y1) { ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, 7); ctx.fill(); } });
    ctx.fillStyle = "#d9c38a"; m.lagos.forEach(l => { ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx + 34, l.ry + 34, 0, 0, 7); ctx.fill(); });
    ctx.fillStyle = "#2f7fbf"; m.lagos.forEach(l => { ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, 7); ctx.fill(); });
    ctx.fillStyle = "#246aa6"; m.lagos.forEach(l => { ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx * 0.6, l.ry * 0.6, 0, 0, 7); ctx.fill(); });
    // Brillo cerca de la orilla
    m.lagos.forEach(l => { ctx.strokeStyle = "rgba(165,216,255,.35)"; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx - 6, l.ry - 6, 0, 0, 7); ctx.stroke(); });
    // Sombras de peces
    (m.sombras || []).forEach((f, i) => {
      f.a += Math.sin(t * 0.5 + i) * 0.01; const nx = f.x + Math.cos(f.a) * f.v / 60, ny = f.y + Math.sin(f.a) * f.v / 60;
      if (this.agua(m, nx, ny, -50)) { f.x = nx; f.y = ny; } else f.a += Math.PI * 0.6;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.fillStyle = "rgba(10,40,70,.45)"; ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-24, -6 + Math.sin(t * 8 + i) * 2); ctx.lineTo(-24, 6 + Math.sin(t * 8 + i) * 2); ctx.fill(); ctx.restore();
    });
    // Nenúfares
    (m.nenufares || []).forEach(n => { ctx.fillStyle = "#3f9e4a"; ctx.beginPath(); ctx.arc(n.x, n.y + Math.sin(t + n.a) * 1.5, n.r, n.a + 0.4, n.a + Math.PI * 2 - 0.1); ctx.lineTo(n.x, n.y); ctx.fill(); if (n.flor) { ctx.fillStyle = "#ffc9e0"; ctx.beginPath(); ctx.arc(n.x + 3, n.y - 2, 4.5, 0, 7); ctx.fill(); ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.arc(n.x + 3, n.y - 2, 1.8, 0, 7); ctx.fill(); } });
    // Juncos
    ctx.strokeStyle = "#2f6b2f"; ctx.lineWidth = 2.5; ctx.beginPath();
    (m.juncos || []).forEach(j => { const b = Math.sin(t * 1.5 + j.x) * 3; ctx.moveTo(j.x, j.y); ctx.quadraticCurveTo(j.x + b * 0.5, j.y - j.h * 0.5, j.x + b, j.y - j.h); ctx.moveTo(j.x + 5, j.y); ctx.quadraticCurveTo(j.x + 5 + b * 0.5, j.y - j.h * 0.4, j.x + 7 + b, j.y - j.h * 0.8); });
    ctx.stroke(); ctx.fillStyle = "#7a4a22"; (m.juncos || []).forEach(j => { if (j.h > 28) { const b = Math.sin(t * 1.5 + j.x) * 3; ctx.beginPath(); ctx.ellipse(j.x + b, j.y - j.h, 2.5, 6, 0, 0, 7); ctx.fill(); } });
    // Olitas
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2;
    for (let k = 0; k < 40; k++) { const x = 600 + ((k * 137) % 1100), y = 480 + ((k * 89) % 560); if (!this.agua(m, x, y, -20)) continue; const o = Math.sin(t * 2 + k) * 6; ctx.beginPath(); ctx.moveTo(x - 12 + o, y); ctx.quadraticCurveTo(x + o, y - 5, x + 12 + o, y); ctx.stroke(); }
    // Cardúmenes (burbujas)
    m.burbujas.forEach(b => { for (let i = 0; i < 4; i++) { const k = (t * 0.8 + i * 0.25) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; ctx.beginPath(); ctx.arc(b.x + Math.sin(i * 2) * 14, b.y + Math.cos(i * 3) * 10, 3 + k * 9, 0, 7); ctx.stroke(); } });
  },
  objetos(s, v) {
    const out = [];
    for (const a of s.m.arboles) if (a.x > v.x0 && a.x < v.x1 && a.y > v.y0 && a.y < v.y1) out.push({ y: a.y, d: ctx => { ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(a.x, a.y + 8, 28, 9, 0, 0, 7); ctx.fill(); ctx.font = "78px " + FE; ctx.fillStyle = "#000"; ctx.fillText(a.ic, a.x, a.y + 12); } });
    return out;
  },
  encima(s, ctx, t) {
    const m = s.m;
    if (m.boya) {
      const x0 = m.x + (m.cara < 0 ? -34 : 34), y0 = m.y - 42;
      this.linea(ctx, x0, y0, m.boya.x, m.boya.y, t, m.p === "pica" || m.p === "pelea");
      if (m.p === "pica") { ctx.font = "bold 30px Figtree, " + FE; ctx.textAlign = "center"; ctx.fillStyle = "#ffd43b"; ctx.fillText("❗", m.boya.x, m.boya.y - 30 + Math.sin(t * 20) * 3); }
      if (m.p === "pelea") { ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(m.boya.x, m.boya.y, 10 + ((t * 40 + i * 12) % 36), 0, 7); ctx.stroke(); } }
    }
  }
};

/* ---------- Pantallas ---------- */
PANTALLAS.trabajos = () => {
  const u = BD.sesion();
  if (!u) {
    app.innerHTML = `${head(0)}<section class="stage"><h2>Trabajos diarios</h2><p class="sub">Necesitas un perfil para guardar tus herramientas y monedas.</p><button class="btn" id="trPerfil">Crear o elegir perfil</button><button class="btn ghost" id="trVolver">Volver</button></section>`;
    on("trPerfil", () => go("perfil")); on("trVolver", () => go("home")); return;
  }
  const d = Trabajos.datos(u), conAnuncio = Anuncios.activos(u);
  const hechos = d.trab.hechos.length;
  app.innerHTML = `${Cuenta.barra()}<section class="screen">
    <div class="headrow"><h1 class="titulo chico">Trabajos <span>diarios</span></h1><span class="chip-mon">🪙 ${u.monedas}</span></div>
    <p class="sub">3 trabajos por día, ${conAnuncio ? "cada uno se desbloquea mirando un anuncio" : "uno de cada uno"}. Tienes <b>10 minutos</b>: lo que juntas se vuelve monedas (hasta ${Trabajos.tope()} por trabajo). Mejora tus herramientas para ganar más.</p>
    <div class="tr-dia">${Object.keys(TR.JUEGOS).map(j => `<i class="${d.trab.hechos.includes(j) ? "on" : ""}"></i>`).join("")}<small>${hechos}/${Object.keys(TR.JUEGOS).length} hechos hoy</small></div>
    ${Object.entries(TR.JUEGOS).map(([j, J]) => {
      const n = d.herr[J.herrDe || j], est = Trabajos.estado(u, j), max = n >= TR.NIVELES.length - 1, costo = TR.COSTO[n + 1];
      return `<article class="tr-card t-${j}" ${j === "evento" && Evento.actual() ? `style="--ev:${Evento.actual().color}"` : ""}>
        <div class="tr-card-top"><span class="tr-herr">${Trabajos.icono(j, n, 64)}</span>
          <div><h2>${J.ic} ${J.nombre}</h2><p class="sub">${J.desc}</p>${d.trabRecord[j] ? `<small class="sub">Récord: ${d.trabRecord[j]} 🪙</small>` : ""}</div></div>
        <div class="tr-nivel"><b>${esc(Trabajos.nombreHerr(j, n))}</b><span class="tr-pasos">${TR.NIVELES.map((N, k) => `<i style="--c:${N.color}" class="${k <= n ? "on" : ""}" title="${esc(Trabajos.nombreHerr(j, k))}"></i>`).join("")}</span></div>
        <div class="row">
          ${est === "hecho" ? `<button class="btn ghost" disabled>✓ Hecho hoy</button>`
            : est === "abierto" ? `<button class="btn" data-jugar="${j}">▶ Jugar</button>`
            : `<button class="btn" data-abrir="${j}">${conAnuncio ? "📺 Mirar anuncio y jugar" : "▶ Jugar"}</button>`}
          ${J.herrDe ? `<span class="sub">Usa tu ${esc(Trabajos.nombreHerr("tala", n).toLowerCase())}</span>` : max ? `<button class="btn ghost" disabled>👑 Tope tope</button>` : `<button class="btn ghost" data-mejorar="${j}" ${u.monedas < costo ? "disabled" : ""}>⬆️ ${esc(Trabajos.nombreHerr(j, n + 1))} · ${costo} 🪙</button>`}
        </div></article>`;
    }).join("")}
    <button class="btn ghost" id="trVolver">Volver al inicio</button>
  </section>`;
  Cuenta.conectarBarra();
  app.querySelectorAll("[data-abrir]").forEach(b => b.onclick = async () => { b.disabled = true; await Trabajos.desbloquear(b.dataset.abrir); if (S.screen === "trabajos") render(); });
  app.querySelectorAll("[data-jugar]").forEach(b => b.onclick = () => Trabajos.empezar(b.dataset.jugar));
  app.querySelectorAll("[data-mejorar]").forEach(b => b.onclick = () => Trabajos.mejorar(b.dataset.mejorar));
  on("trVolver", () => go("home"));
};

PANTALLAS.trabajo = () => {
  const s = Trabajos.s;
  if (!s) return go("trabajos");
  const J = TR.JUEGOS[s.j];
  if (s.terminado) {
    document.body.classList.remove("en-nave");
    const t = s.terminado, items = Object.entries(s.items).sort((a, b) => b[1] - a[1]);
    app.innerHTML = `${head(0)}<section class="stage tr-fin">
      <span class="tr-herr grande">${Trabajos.icono(s.j, s.nivel, 90)}</span>
      <h2>${t.motivo === "tope" ? "¡Llegaste al tope!" : t.motivo === "tiempo" ? "¡Se terminó el tiempo!" : "Jornada terminada"}</h2>
      <div class="tr-premio"><div><b>+${t.monedas}</b><small>monedas</small></div><div><b>+${t.puntos}</b><small>puntos</small></div></div>
      ${t.record ? `<p class="warn ok">🏆 ¡Nuevo récord en ${J.nombre}!</p>` : ""}
      ${items.length ? `<ul class="tr-items">${items.map(([k, n]) => `<li><span>${esc(k)}</span><b>${Math.round(n * 10) / 10}</b></li>`).join("")}</ul>` : `<p class="sub">No juntaste nada esta vez.</p>`}
      <button class="btn" id="trOtra">Ver trabajos</button></section>`;
    on("trOtra", () => { Trabajos.s = null; go("trabajos"); });
    return;
  }
  if (!byId("mdCanvas")) Mundo.montar(s);
  Trabajos.hud();
};
