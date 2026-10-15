/* Economía: monedas 🪙, premio diario con racha, misión semanal y tienda de cosas para el personaje.
   Los datos viven en el perfil: monedas, inv (lo comprado) y diario ({ ultimo, racha, mejor, semana, partidasSemana, semanaCobrada }). */

/* ---------- Cosas nuevas para dibujar ---------- */
Object.assign(ACCESORIOS, {
  corona: { sobre: `<path d="M26 26 L30 4 L40 16 L50 0 L60 16 L70 4 L74 26 Z" fill="#ffd43b" stroke="#b8860b" stroke-width="2.5" stroke-linejoin="round"/><circle cx="50" cy="8" r="3.5" fill="#e03131"/><circle cx="33" cy="12" r="2.5" fill="#4dabf7"/><circle cx="67" cy="12" r="2.5" fill="#51cf66"/>` },
  cuernos: { sobre: `<path d="M28 24 Q16 8 22 -2 Q26 12 38 18Z" fill="#e03131" stroke="#8f1d1d" stroke-width="2"/><path d="M72 24 Q84 8 78 -2 Q74 12 62 18Z" fill="#e03131" stroke="#8f1d1d" stroke-width="2"/>` },
  aureola: { sobre: `<ellipse cx="50" cy="6" rx="22" ry="6" fill="none" stroke="#ffe066" stroke-width="5"/><ellipse cx="50" cy="6" rx="22" ry="6" fill="none" stroke="#fff3bf" stroke-width="1.5"/>` },
  fiesta: { sobre: `<path d="M34 26 L50 -4 L66 26 Z" fill="#f06595"/><path d="M38 18 L62 18 M42 10 L58 10" stroke="#ffd43b" stroke-width="3"/><circle cx="50" cy="-2" r="4" fill="#ffd43b"/>` },
  vincha: { sobre: `<path d="M18 34 Q50 22 82 34" stroke="#ff4d63" stroke-width="7" fill="none"/><path d="M80 32 l10 -6 l-2 10 Z M80 34 l12 4 l-8 6 Z" fill="#ff4d63"/>` },
  navidad: { sobre: `<path d="M22 30 Q30 2 62 4 Q82 6 86 26 L78 22 Q70 12 60 14 Z" fill="#e03131"/><rect x="18" y="26" width="64" height="9" rx="4.5" fill="#fff"/><circle cx="84" cy="26" r="6" fill="#fff"/>` },
  flor: { sobre: `<g transform="translate(74 22)">${[0, 72, 144, 216, 288].map(a => `<ellipse rx="6" ry="9" fill="#f783ac" transform="rotate(${a}) translate(0 -8)"/>`).join("")}<circle r="5" fill="#ffd43b"/></g>` },
  parche: { sobre: `<path d="M18 36 L82 52" stroke="#1b1726" stroke-width="3"/><ellipse cx="62" cy="48" rx="11" ry="12" fill="#1b1726"/>` },
  antifaz: { sobre: `<path d="M20 42 Q34 34 48 44 Q50 46 52 44 Q66 34 80 42 Q82 56 66 56 Q56 56 50 50 Q44 56 34 56 Q18 56 20 42Z" fill="#7048e8"/><ellipse cx="36" cy="47" rx="7" ry="5" fill="#1b1726"/><ellipse cx="64" cy="47" rx="7" ry="5" fill="#1b1726"/>` },
  bufanda: { sobre: `<path d="M22 76 Q50 88 78 76 L78 84 Q50 96 22 84 Z" fill="#20c997"/><path d="M64 84 L70 104 L60 104 L56 86 Z" fill="#12b886"/><path d="M28 80 L32 86 M40 84 L44 90 M52 86 L56 92" stroke="#fff" stroke-width="2"/>` },
  auris_gato: { sobre: `<path d="M24 26 L30 4 L44 18 Z" fill="#fcc2d7" stroke="#1b1726" stroke-width="2.5" stroke-linejoin="round"/><path d="M76 26 L70 4 L56 18 Z" fill="#fcc2d7" stroke="#1b1726" stroke-width="2.5" stroke-linejoin="round"/>` }
});

const COLORES_TIENDA = ["#ffd700", "#111111", "#ff00a8", "#00e5ff", "#7cff00", "#8b5a2b", "#ffffff", "#ff3b00"];
const MARCOS = { oro: "Marco dorado", fuego: "Marco de fuego", hielo: "Marco de hielo", arcoiris: "Marco arcoíris", neon: "Marco neón" };
const MASCOTAS = { perro: "🐶", gato: "🐱", pollito: "🐤", pulpo: "🐙", dino: "🦖", robot: "🤖" };

/* Catálogo: id → { tipo, nombre, precio, valor } */
const CATALOGO = {};
[["corona", "Corona", 400], ["cuernos", "Cuernos de diablo", 250], ["aureola", "Aureola", 250], ["fiesta", "Gorro de fiesta", 120], ["vincha", "Vincha ninja", 150],
 ["navidad", "Gorro navideño", 150], ["flor", "Flor", 80], ["auris_gato", "Orejas de gato", 180]].forEach(([v, n, p]) => CATALOGO["cab-" + v] = { tipo: "cabeza", nombre: n, precio: p, valor: v });
[["parche", "Parche pirata", 120], ["antifaz", "Antifaz", 150], ["bufanda", "Bufanda", 100]].forEach(([v, n, p]) => CATALOGO["car-" + v] = { tipo: "cara", nombre: n, precio: p, valor: v });
COLORES_TIENDA.forEach((c, i) => CATALOGO["col-" + i] = { tipo: "color", nombre: ["Dorado", "Sombra", "Fucsia neón", "Celeste neón", "Verde ácido", "Chocolate", "Fantasma", "Lava"][i], precio: i === 0 ? 300 : 120, valor: c });
Object.entries(MARCOS).forEach(([v, n], i) => CATALOGO["mar-" + v] = { tipo: "marco", nombre: n, precio: [350, 250, 250, 300, 200][i], valor: v });
[["El Sospechoso", 60], ["Cara de póker", 100], ["Sherlock", 150], ["Rey del Chinchón", 150], ["Almirante", 120], ["Gran Maestro", 200], ["Leyenda", 500]].forEach(([n, p], i) => CATALOGO["tit-" + i] = { tipo: "titulo", nombre: n, precio: p, valor: n });
Object.entries(MASCOTAS).forEach(([v, e], i) => CATALOGO["mas-" + v] = { tipo: "mascota", nombre: { perro: "Perrito", gato: "Gatito", pollito: "Pollito", pulpo: "Pulpo", dino: "Dino", robot: "Robotito" }[v] + " " + e, precio: [200, 200, 150, 250, 300, 300][i], valor: v });

const CABEZAS_GRATIS = CABEZAS.slice(), CARAS_GRATIS = CARAS.slice();
const TIPOS_TIENDA = [["cabeza", "Cabeza"], ["cara", "Cara"], ["color", "Colores"], ["marco", "Marcos"], ["titulo", "Títulos"], ["mascota", "Mascotas"]];

/* ---------- Diario y semana ---------- */
const PREMIO_DIA = [10, 15, 20, 25, 30, 40, 100];
const MISION_SEMANA = { partidas: 10, premio: 150 };
const pad2 = n => String(n).padStart(2, "0");
const fechaDe = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hoyStr = () => fechaDe(new Date());
const ayerStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return fechaDe(d); };
function semanaStr(d = new Date()) {
  // Semana que empieza el lunes: se identifica por la fecha de ese lunes
  const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return fechaDe(x);
}

const Eco = {
  completar(u) {
    if (typeof u.monedas !== "number") u.monedas = 0;
    if (!Array.isArray(u.inv)) u.inv = [];
    u.diario = Object.assign({ ultimo: null, racha: 0, mejor: 0, semana: null, partidasSemana: 0, semanaCobrada: null }, u.diario || {});
    if (u.diario.semana !== semanaStr()) { u.diario.semana = semanaStr(); u.diario.partidasSemana = 0; }
    if (u.look) { u.look.marco = u.look.marco || ""; u.look.titulo = u.look.titulo || ""; u.look.mascota = u.look.mascota || ""; }
    return u;
  },

  /* Estado del premio diario: si se puede cobrar hoy, qué día de la semana de racha toca y cuánto */
  diario(u) {
    Eco.completar(u);
    const d = u.diario, hoy = hoyStr();
    const cobrado = d.ultimo === hoy;
    const racha = cobrado ? d.racha : d.ultimo === ayerStr() ? d.racha + 1 : 1;
    const dia = ((racha - 1) % 7) + 1;
    return { puede: !cobrado, racha, dia, monedas: PREMIO_DIA[dia - 1], cofre: dia === 7, perdida: !cobrado && d.ultimo && d.ultimo !== ayerStr() && d.racha > 1 };
  },

  cobrarDiario(u) {
    const e = Eco.diario(u);
    if (!e.puede) return null;
    u.diario.ultimo = hoyStr(); u.diario.racha = e.racha; u.diario.mejor = Math.max(u.diario.mejor, e.racha);
    u.monedas += e.monedas;
    if (u.nube) Nube.actividad("ingreso", null, 0, e.monedas);
    let item = null;
    if (e.cofre) {
      // Cofre del día 7: una cosa de la tienda que no tenga (hasta 300 monedas)
      const opciones = Object.entries(CATALOGO).filter(([id, it]) => !u.inv.includes(id) && it.precio <= 300);
      if (opciones.length) { const [id, it] = pick(opciones); u.inv.push(id); item = { id, ...it }; }
      else u.monedas += 100;
    }
    Eco.guardar(u);
    return { ...e, item };
  },

  sumarPartida(u) { Eco.completar(u); u.diario.partidasSemana++; },
  mision(u) { Eco.completar(u); const d = u.diario; return { hechas: Math.min(d.partidasSemana, MISION_SEMANA.partidas), meta: MISION_SEMANA.partidas, premio: MISION_SEMANA.premio, cobrada: d.semanaCobrada === d.semana }; },
  cobrarMision(u) {
    const m = Eco.mision(u);
    if (m.cobrada || m.hechas < m.meta) return false;
    u.diario.semanaCobrada = u.diario.semana; u.monedas += m.premio;
    if (u.nube) Nube.actividad("mision", null, 0, m.premio);
    Eco.guardar(u); return true;
  },

  comprar(u, id) {
    const it = CATALOGO[id], precio = typeof Evento !== "undefined" ? Evento.precio(id) : it && it.precio;
    if (!it || it.refs || u.inv.includes(id) || u.monedas < precio || (typeof Evento !== "undefined" && !Evento.itemDisponible(id))) return false;
    u.monedas -= precio; u.inv.push(id);
    if (u.nube) Nube.actividad("compra", it.evento ? "evento" : it.tipo, 0, -precio);
    Eco.guardar(u); return true;
  },
  tiene: (u, id) => u.inv.includes(id),

  equipar(u, id) {
    const it = CATALOGO[id]; if (!it || !u.inv.includes(id)) return;
    const l = u.look;
    if (it.tipo === "color") l.color = it.valor;
    else if (it.tipo === "cabeza") l.acc = [it.valor, ...l.acc.filter(a => !Eco.esCabeza(a))];
    else if (it.tipo === "cara") l.acc = [...l.acc.filter(a => !Eco.esCara(a)), it.valor];
    else if (it.tipo === "marco") l.marco = l.marco === it.valor ? "" : it.valor;
    else if (it.tipo === "titulo") l.titulo = l.titulo === it.valor ? "" : it.valor;
    else if (it.tipo === "mascota") l.mascota = l.mascota === it.valor ? "" : it.valor;
    Eco.guardar(u);
  },
  esCabeza: a => CABEZAS_GRATIS.includes(a) || Object.values(CATALOGO).some(it => it.tipo === "cabeza" && it.valor === a),
  esCara: a => CARAS_GRATIS.includes(a) || Object.values(CATALOGO).some(it => it.tipo === "cara" && it.valor === a),
  equipado(u, id) {
    const it = CATALOGO[id], l = u.look;
    return it.tipo === "color" ? l.color === it.valor : it.tipo === "cabeza" || it.tipo === "cara" ? l.acc.includes(it.valor) : l[it.tipo] === it.valor;
  },

  guardar(u) { BD.guardar(); if (u.nube && typeof Nube !== "undefined") Nube.subir(u); }
};

/* ---------- Anuncios con recompensa ----------
   Se activan desde el panel de administración (tabla config, clave "anuncios").
   Con "prueba" se muestra un anuncio de mentira; sin "prueba", se usa la API de anuncios para juegos de Google
   (window.adBreak, que se agrega con el script de AdSense cuando tengas la cuenta). El servidor decide cuántas
   monedas da y cuántos anuncios por día se pueden cobrar. */
const Anuncios = {
  cfg() { return (typeof Nube !== "undefined" && Nube.cfg && Nube.cfg.anuncios) || null; },
  activos(u) { const c = this.cfg(); return !!(c && c.activos && u && u.nube && Nube.user); },

  async ver(u) {
    const c = this.cfg();
    const visto = await (c.prueba || typeof window.adBreak !== "function" ? this.prueba(c) : this.real());
    if (!visto) return;
    try {
      const r = await Nube.cobrarAnuncio();
      if (r.ok) {
        Eco.completar(u); u.monedas += r.monedas; Eco.guardar(u);
        Toast.mostrar(`<div class="t-pts">+${r.monedas}<small>monedas</small></div><div class="t-txt"><b>¡Gracias por mirar!</b><span>${r.quedan > 0 ? `Puedes mirar ${r.quedan} más hoy.` : "Por hoy no hay más anuncios."}</span></div>`, "puntos");
      } else Toast.mostrar(`<div class="t-ic">📺</div><div class="t-txt"><b>${r.motivo === "limite" ? "Ya miraste todos los anuncios de hoy" : "Los anuncios no están disponibles"}</b><span>Vuelve mañana.</span></div>`, "info");
    } catch (e) { Toast.mostrar(`<div class="t-txt"><b>${esc(e.message)}</b></div>`, "info"); }
    render();
  },

  real() {
    return new Promise(res => {
      let listo = false; const fin = v => { if (!listo) { listo = true; res(v); } };
      window.adBreak({ type: "reward", name: "monedas", beforeReward: mostrar => mostrar(), adViewed: () => fin(true), adDismissed: () => fin(false), adBreakDone: () => fin(false) });
    });
  },

  /* Anuncio de prueba: 10 segundos de espera, como uno de verdad */
  prueba(c, boton) {
    return new Promise(res => {
      const caja = document.createElement("div");
      caja.className = "modal-fondo";
      caja.innerHTML = `<div class="modal anuncio"><span class="label">Anuncio de prueba</span>
        <div class="anuncio-espacio">📺<b>Aquí va la publicidad</b><small>Cuando conectes una red de anuncios, este espacio muestra un video.</small></div>
        <div class="bar"><i id="adBar" style="width:0%"></i></div>
        <button class="btn" id="adOk" disabled>Espera <span id="adT">10</span> s…</button>
        <button class="linkish" id="adNo">${boton ? "Cerrar" : "Cerrar sin cobrar"}</button></div>`;
      document.body.appendChild(caja);
      let t = 0; const total = 10;
      const iv = setInterval(() => {
        t++; caja.querySelector("#adBar").style.width = (t / total) * 100 + "%";
        if (t >= total) { clearInterval(iv); const b = caja.querySelector("#adOk"); b.disabled = false; b.textContent = boton || `Cobrar ${c.monedas} 🪙`; }
        else caja.querySelector("#adT").textContent = total - t;
      }, 1000);
      caja.querySelector("#adOk").onclick = () => { caja.remove(); res(true); };
      caja.querySelector("#adNo").onclick = () => { clearInterval(iv); caja.remove(); res(false); };
    });
  }
};

/* Personaje con marco y mascota (para perfil, chip y ranking) */
function retrato(look, size, tipo = "civ") {
  return `<span class="retrato ${look.marco ? "marco-" + look.marco : ""}">${personaje(look.color, tipo, size, look.acc)}${look.mascota && MASCOTAS[look.mascota] ? `<span class="mascota">${MASCOTAS[look.mascota]}</span>` : ""}</span>`;
}

/* ---------- Ventana del premio diario ---------- */
function mostrarDiario(u) {
  const e = Eco.diario(u);
  if (!e.puede) return;
  const caja = document.createElement("div");
  caja.className = "modal-fondo";
  caja.innerHTML = `<div class="modal diario" role="dialog" aria-label="Premio diario">
    <span class="label">Premio diario</span>
    <h2>${e.racha > 1 ? `🔥 ¡${e.racha} días seguidos!` : "¡Bienvenido de vuelta!"}</h2>
    <p class="sub">${e.perdida ? "Se cortó tu racha, pero empieza una nueva hoy." : "Entra todos los días: el séptimo hay cofre."}</p>
    <div class="dias">${PREMIO_DIA.map((m, i) => `<div class="dia ${i + 1 < e.dia ? "hecho" : i + 1 === e.dia ? "hoy" : ""} ${i === 6 ? "cofre" : ""}"><small>Día ${i + 1}</small><span>${i === 6 ? "🎁" : "🪙"}</span><b>${m}</b></div>`).join("")}</div>
    <button class="btn" id="cobrar">Cobrar ${e.monedas} 🪙${e.cofre ? " y el cofre" : ""}</button>
  </div>`;
  document.body.appendChild(caja);
  caja.querySelector("#cobrar").onclick = () => {
    const r = Eco.cobrarDiario(u);
    caja.remove();
    if (!r) return;
    Toast.mostrar(`<div class="t-pts">+${r.monedas}<small>monedas</small></div><div class="t-txt"><b>Premio del día ${r.dia}</b><span>Racha: ${r.racha} día${r.racha > 1 ? "s" : ""} 🔥</span></div>`, "puntos");
    if (r.item) Toast.mostrar(`<div class="t-ic">🎁</div><div class="t-txt"><small>Cofre semanal</small><b>${esc(r.item.nombre)}</b><span>Ya es tuyo: equípalo en la tienda.</span></div>`, "logro");
    render();
  };
}
/* Una vez por sesión, al entrar al inicio con perfil */
let diarioMostrado = null;
function revisarDiario() {
  const u = BD.sesion();
  if (!u || S.screen !== "home" || diarioMostrado === u.id + hoyStr()) return;
  diarioMostrado = u.id + hoyStr();
  if (Eco.diario(u).puede) setTimeout(() => mostrarDiario(u), 400);
}

/* ---------- Tienda ---------- */
PANTALLAS.tienda = () => {
  const u = BD.sesion();
  if (!u) return go("cuenta");
  Eco.completar(u);
  const ev = Evento.actual();
  let tab = UI.tabTienda || (ev ? "evento" : "cabeza");
  if (tab === "evento" && !ev) tab = "cabeza";
  const m = Eco.mision(u), e = Eco.diario(u);
  // Las cosas de un evento se ven solo mientras está prendido (o si ya las tienes)
  const items = Object.entries(CATALOGO).filter(([id, it]) => tab === "evento" ? it.evento === ev.id && Evento.itemDisponible(id) : it.tipo === tab && (!it.evento || Eco.tiene(u, id) || Evento.itemDisponible(id)) && (!it.refs || Eco.tiene(u, id)));
  const prev = (id, it) => {
    const l = { ...u.look, acc: u.look.acc.slice() };
    if (it.tipo === "color") l.color = it.valor;
    if (it.tipo === "cabeza") l.acc = [it.valor, ...l.acc.filter(a => !Eco.esCabeza(a))];
    if (it.tipo === "cara") l.acc = [...l.acc.filter(a => !Eco.esCara(a)), it.valor];
    if (it.tipo === "marco") l.marco = it.valor;
    if (it.tipo === "mascota") l.mascota = it.valor;
    if (it.tipo === "titulo") return `<span class="tit-prev">«${esc(it.valor)}»</span>`;
    return retrato(l, 64);
  };
  app.innerHTML = `${head(0)}
  <section class="screen">
    <div class="tienda-head"><div><h2>Tienda</h2><p class="sub">Gana monedas jugando, entrando cada día y con la misión semanal.</p></div><div class="saldo">🪙 <b>${u.monedas}</b></div></div>
    <div class="panel misiones">
      <div class="mision"><span class="m-ic">🔥</span><div class="txt"><b>Racha de ${e.puede ? Math.max(e.racha - 1, 0) : e.racha} día${(e.puede ? e.racha - 1 : e.racha) === 1 ? "" : "s"}</b><small>${e.puede ? `Hoy te espera el premio del día ${e.dia}.` : `Mañana: ${PREMIO_DIA[e.dia % 7]} 🪙${e.dia === 6 ? " y el cofre 🎁" : ""}.`}</small></div>${e.puede ? `<button class="btn chico" id="diario">Cobrar</button>` : `<span class="ok">✓ Hoy</span>`}</div>
      ${Anuncios.activos(u) ? `<div class="mision"><span class="m-ic">📺</span><div class="txt"><b>Mirar un anuncio</b><small>+${Anuncios.cfg().monedas} 🪙 cada uno · hasta ${Anuncios.cfg().porDia} por día</small></div><button class="btn chico" id="verAnuncio">Mirar</button></div>` : ""}
      <div class="mision"><span class="m-ic">🎯</span><div class="txt"><b>Misión semanal: ${m.meta} partidas</b><small>${m.hechas} de ${m.meta} · premio ${m.premio} 🪙</small><div class="xp"><i style="width:${(m.hechas / m.meta) * 100}%"></i></div></div>${m.cobrada ? `<span class="ok">✓ Cobrada</span>` : `<button class="btn chico" id="mision" ${m.hechas < m.meta ? "disabled" : ""}>Cobrar</button>`}</div>
    </div>
    ${ev ? `<div class="evento-banner chico" style="--ev:${ev.color}"><span class="ev-ic">${ev.ic}</span><div><b>Evento de ${esc(ev.nombre)}</b><small>Cosas especiales por tiempo limitado.</small></div></div>` : ""}
    <div class="tabs scroll">${[...(ev ? [["evento", ev.ic + " " + ev.nombre]] : []), ...TIPOS_TIENDA].map(([k, n]) => `<button data-tt="${k}" aria-pressed="${tab === k}">${esc(n)}</button>`).join("")}</div>
    <div class="items">${items.map(([id, it]) => {
      const tengo = Eco.tiene(u, id), eq = tengo && Eco.equipado(u, id);
      return `<div class="item ${tengo ? "mio" : ""}"><div class="item-prev">${prev(id, it)}</div><b>${esc(it.nombre)}</b>
        ${tengo ? `<button class="btn chico ${eq ? "" : "ghost"}" data-eq="${id}">${eq ? (["color", "cabeza", "cara"].includes(it.tipo) ? "Puesto" : "Quitar") : "Usar"}</button>`
          : `<button class="btn chico" data-buy="${id}" ${u.monedas < Evento.precio(id) ? "disabled" : ""}>🪙 ${Evento.precio(id)}</button>`}</div>`;
    }).join("")}</div>
    <button class="btn ghost" id="volver">Volver</button>
  </section>`;
  app.querySelectorAll("[data-tt]").forEach(b => b.onclick = () => { UI.tabTienda = b.dataset.tt; render(); });
  app.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => {
    if (Eco.comprar(u, b.dataset.buy)) { Eco.equipar(u, b.dataset.buy); Sonido.sfx("monedas"); Toast.mostrar(`<div class="t-ic">🛍️</div><div class="t-txt"><b>¡Comprado!</b><span>${esc(CATALOGO[b.dataset.buy].nombre)} ya es tuyo.</span></div>`, "info"); }
    render();
  });
  app.querySelectorAll("[data-eq]").forEach(b => b.onclick = () => { Eco.equipar(u, b.dataset.eq); render(); });
  on("diario", () => mostrarDiario(u));
  on("verAnuncio", () => Anuncios.ver(u));
  on("mision", () => { if (Eco.cobrarMision(u)) Toast.mostrar(`<div class="t-pts">+${MISION_SEMANA.premio}<small>monedas</small></div><div class="t-txt"><b>¡Misión semanal cumplida!</b><span>Jugaste ${MISION_SEMANA.partidas} partidas esta semana.</span></div>`, "logro"); render(); });
  on("volver", () => go("home"));
};
