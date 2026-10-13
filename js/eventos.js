/* Eventos de temporada (Halloween, Navidad, Pascuas…).
   Se prenden desde el panel de administración (tabla config, clave "evento"):
   { id: "halloween", trabajo: true, multi: 1.5, mensaje: "…", items: { "cab-calabaza": { on: true, precio: 250 } } }
   Mientras está prendido: cartel en el inicio, colores de la temporada, pestaña del evento en la tienda,
   un trabajo especial y (si se quiere) más monedas en trabajos y Arena.
   Para sumar un evento nuevo alcanza con agregarlo a EVENTOS (y, si trae accesorios nuevos, dibujarlos abajo). */

Object.assign(ACCESORIOS, {
  calabaza: { sobre: `<path d="M20 30 Q14 6 50 8 Q86 6 80 30 Q66 22 50 24 Q34 22 20 30Z" fill="#ff7b00" stroke="#b34700" stroke-width="2.5"/><path d="M50 8 Q46 0 52 -4" stroke="#2f9e44" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M36 12 Q34 20 36 26 M64 12 Q66 20 64 26" stroke="#b34700" stroke-width="2" fill="none"/>` },
  bruja: { sobre: `<path d="M10 30 Q50 22 90 30 Q86 36 50 33 Q14 36 10 30Z" fill="#2b2540"/><path d="M28 30 L46 -8 Q52 -14 58 -2 L72 30Z" fill="#2b2540"/><rect x="28" y="22" width="44" height="6" fill="#8c5cf5"/><path d="M48 25 h6 v-3 h-6z" fill="#ffd43b"/>` },
  colmillos: { sobre: `<path d="M40 66 Q50 72 60 66" stroke="#1b1726" stroke-width="3" fill="none"/><path d="M42 67 L44 76 L46 68Z M54 68 L56 76 L58 67Z" fill="#fff" stroke="#1b1726" stroke-width="1.2"/>` },
  reno: { sobre: `<path d="M30 24 Q22 10 26 0 M26 10 Q18 8 14 2 M28 16 Q20 18 14 14" stroke="#8b5a2b" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M70 24 Q78 10 74 0 M74 10 Q82 8 86 2 M72 16 Q80 18 86 14" stroke="#8b5a2b" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  duende: { sobre: `<path d="M20 30 Q24 4 50 2 Q70 2 92 -6 Q80 10 80 30Z" fill="#2f9e44"/><rect x="18" y="26" width="64" height="8" rx="4" fill="#e03131"/><circle cx="92" cy="-6" r="5" fill="#ffd43b"/>` },
  conejo: { sobre: `<ellipse cx="36" cy="2" rx="8" ry="22" fill="#fff" stroke="#1b1726" stroke-width="2.5" transform="rotate(-12 36 2)"/><ellipse cx="36" cy="4" rx="3.5" ry="14" fill="#fcc2d7" transform="rotate(-12 36 4)"/><ellipse cx="64" cy="2" rx="8" ry="22" fill="#fff" stroke="#1b1726" stroke-width="2.5" transform="rotate(12 64 2)"/><ellipse cx="64" cy="4" rx="3.5" ry="14" fill="#fcc2d7" transform="rotate(12 64 4)"/>` },
  canasta: { sobre: `<path d="M64 80 h28 l-4 16 h-20z" fill="#c08a4a" stroke="#7a5230" stroke-width="2"/><path d="M66 80 Q78 64 90 80" stroke="#7a5230" stroke-width="3" fill="none"/><ellipse cx="72" cy="80" rx="4" ry="5" fill="#74c0fc"/><ellipse cx="82" cy="79" rx="4" ry="5" fill="#f783ac"/>` }
});

const EVENTOS = {
  halloween: {
    nombre: "Halloween", ic: "🎃", color: "#ff7b00", desc: "Calabazas, fantasmas y caramelos. ¡Cosas de miedo en la tienda!",
    items: [["cab-ev-calabaza", "cabeza", "Cabeza de calabaza", 250, "calabaza"], ["cab-ev-bruja", "cabeza", "Sombrero de bruja", 200, "bruja"], ["car-ev-colmillos", "cara", "Colmillos de vampiro", 150, "colmillos"],
      ["col-ev-calabaza", "color", "Naranja calabaza", 150, "#ff7b00"], ["tit-ev-halloween", "titulo", "Rey de las calabazas", 200, "Rey de las calabazas"]],
    trabajo: { nombre: "Cosecha embrujada", ic: "🎃", lugar: "el bosque embrujado", desc: "Junta calabazas y caramelos. Cuidado con los fantasmas.",
      suelo: "#2b2540", manchas: "#221c33", borde: "#120f1c", flores: ["#ff7b00", "#b48cff", "#3ddcb1"], enemigo: "👻",
      arboles: { calabaza: { ic: "🎃", hp: 5, madera: 1.5, peso: 55, r: 20, nombre: "Calabazas", tam: 56 }, arbol: { ic: "🌲", hp: 8, madera: 1.2, peso: 30, r: 22, nombre: "Madera embrujada" }, caramelo: { ic: "🍬", hp: 6, madera: 6, peso: 8, r: 18, oro: true, nombre: "Caramelos", tam: 52 } } }
  },
  navidad: {
    nombre: "Navidad", ic: "🎄", color: "#2f9e44", desc: "Nieve, regalos y gorros. ¡Felices fiestas!",
    items: [["cab-ev-reno", "cabeza", "Cuernos de reno", 200, "reno"], ["cab-ev-duende", "cabeza", "Gorro de duende", 200, "duende"], ["col-ev-pino", "color", "Verde pino", 150, "#1f7a3a"],
      ["tit-ev-navidad", "titulo", "Espíritu navideño", 200, "Espíritu navideño"]],
    trabajo: { nombre: "Taller de regalos", ic: "🎁", lugar: "el bosque nevado", desc: "Tala pinos y abre regalos. Las tormentas de nieve te frenan.",
      suelo: "#e8f0f8", manchas: "#d3e1ef", borde: "#9fb6cc", flores: ["#e03131", "#2f9e44", "#ffd43b"], enemigo: "🌨️",
      arboles: { pino: { ic: "🎄", hp: 7, madera: 1.3, peso: 55, r: 22, nombre: "Pinos" }, muneco: { ic: "⛄", hp: 6, madera: 1.8, peso: 25, r: 20, nombre: "Bolas de nieve", tam: 60 }, regalo: { ic: "🎁", hp: 4, madera: 5, peso: 10, r: 18, oro: true, nombre: "Regalos", tam: 50 } } }
  },
  pascuas: {
    nombre: "Pascuas", ic: "🐣", color: "#f783ac", desc: "Huevos escondidos y orejas de conejo.",
    items: [["cab-ev-conejo", "cabeza", "Orejas de conejo", 200, "conejo"], ["car-ev-canasta", "cara", "Canasta de huevos", 150, "canasta"], ["col-ev-pastel", "color", "Rosa pastel", 150, "#ffb3d1"],
      ["tit-ev-pascuas", "titulo", "Conejo de Pascua", 200, "Conejo de Pascua"]],
    trabajo: { nombre: "Búsqueda de huevos", ic: "🥚", lugar: "la pradera", desc: "Revisa arbustos y junta huevos de chocolate. Las abejas pican.",
      suelo: "#5aa05a", manchas: "#519651", borde: "#2f6b33", flores: ["#ffb3d1", "#ffe066", "#a5d8ff"], enemigo: "🐝",
      arboles: { arbusto: { ic: "🌿", hp: 5, madera: 1, peso: 50, r: 20, nombre: "Hojas", tam: 60 }, huevo: { ic: "🥚", hp: 3, madera: 4, peso: 22, r: 16, nombre: "Huevos", tam: 44 }, nido: { ic: "🪺", hp: 5, madera: 8, peso: 6, r: 18, oro: true, nombre: "Nidos dorados", tam: 50 } } }
  }
};

/* Las cosas de los eventos van al catálogo de la tienda (se ven solo mientras su evento está prendido) */
if (typeof CATALOGO !== "undefined") {
  for (const [ev, E] of Object.entries(EVENTOS)) for (const [id, tipo, nombre, precio, valor] of E.items) {
    CATALOGO[id] = { tipo, nombre, precio, valor, evento: ev };
    if (tipo === "color" && !COLORES_TIENDA.includes(valor)) COLORES_TIENDA.push(valor);
  }
} else if (typeof COLORES_TIENDA !== "undefined") {
  for (const E of Object.values(EVENTOS)) for (const it of E.items) if (it[1] === "color" && !COLORES_TIENDA.includes(it[4])) COLORES_TIENDA.push(it[4]);
}

const Evento = {
  cfg() { return (typeof Nube !== "undefined" && Nube.cfg && Nube.cfg.evento) || null; },
  actual() { const c = this.cfg(); return c && EVENTOS[c.id] ? { ...EVENTOS[c.id], id: c.id, cfg: c } : null; },
  multiplicador() { const e = this.actual(); return e ? Math.max(1, Math.min(3, +e.cfg.multi || 1)) : 1; },
  itemDisponible(id) {
    const it = CATALOGO[id], e = this.actual();
    if (!it || !it.evento) return true;
    return !!(e && e.id === it.evento && !(e.cfg.items && e.cfg.items[id] && e.cfg.items[id].on === false));
  },
  precio(id) {
    const it = CATALOGO[id]; if (!it) return 0;
    const e = this.actual(), o = it.evento && e && e.cfg.items && e.cfg.items[id];
    return o && +o.precio > 0 ? Math.round(+o.precio) : it.precio;
  },
  trabajo() { const e = this.actual(); return e && e.cfg.trabajo !== false ? e.trabajo : null; },

  /* Se llama en cada render: colores de la temporada y trabajo especial */
  decorar() {
    const e = this.actual();
    document.body.dataset.evento = e ? e.id : "";
    const t = this.trabajo();
    if (t && !TR.JUEGOS.evento) TR.JUEGOS.evento = { nombre: t.nombre, lugar: t.lugar, herr: "Hacha", gen: "f", ic: t.ic, mat: "botín", desc: t.desc + " Usa tu hacha.", factor: 0.35, herrDe: "tala" };
    else if (!t && TR.JUEGOS.evento && !(Trabajos.s && Trabajos.s.j === "evento")) delete TR.JUEGOS.evento;
    else if (t && TR.JUEGOS.evento) Object.assign(TR.JUEGOS.evento, { nombre: t.nombre, lugar: t.lugar, ic: t.ic });
  },
  cartel() {
    const e = this.actual(); if (!e) return "";
    const t = this.trabajo();
    return `<article class="evento-banner" style="--ev:${e.color}"><span class="ev-ic">${e.ic}</span>
      <div><b>¡Evento de ${esc(e.nombre)}!</b><small>${esc(e.cfg.mensaje || e.desc)}${this.multiplicador() > 1 ? ` · Monedas ×${this.multiplicador()} en trabajos y Arena` : ""}</small></div>
      <div class="ev-acc"><button class="btn chico" id="evTienda">🛍️ Tienda</button>${t ? `<button class="btn chico ghost" id="evTrabajo">${t.ic} ${esc(t.nombre)}</button>` : ""}</div></article>`;
  },
  conectarCartel() {
    on("evTienda", () => { UI.tabTienda = "evento"; go(BD.sesion() ? "tienda" : "cuenta"); });
    on("evTrabajo", () => go("trabajos"));
  }
};
