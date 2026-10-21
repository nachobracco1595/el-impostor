/* Catálogo de lo que se vende (lo usan el juego y el panel de administración).
   - CATALOGO: la tienda (cabezas, caras, colores, marcos, títulos y mascotas).
   - SKINS_DATA: las skins de la Arena.
   - Precios del equipo de la Arena por material.
   - Catalogo: aplica lo que el administrador cambió en el panel (config "catalogo": precios y lo que no está a la venta). */
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

/* Skins de la Arena (solo se ven, no dan ventajas): [id, nombre, ícono, precio, { clase (si es exclusiva), tinte, alfa, aura, arma, part, som, opac }] */
const SKINS_DATA = [
  ["rey", "Rey", "👑", 1200, { som: "👑", aura: "#ffd43b", arma: "#ffd43b", part: "#fff3bf" }],
  ["dorado", "Dorado", "🌟", 600, { tinte: "#ffd43b", alfa: .62, aura: "#ffd43b", arma: "#ffd43b", part: "#fff3bf" }],
  ["fantasma", "Fantasma", "👻", 500, { tinte: "#e7f5ff", alfa: .72, opac: .65, aura: "#a5d8ff" }],
  ["lava", "Lava", "🌋", 700, { tinte: "#ff6b00", alfa: .57, aura: "#ff922b", arma: "#ff6b00", part: "#ffd43b" }],
  ["hielo", "Hielo", "🧊", 700, { tinte: "#74c0fc", alfa: .62, aura: "#a5d8ff", arma: "#d0ebff", part: "#e7f5ff" }],
  ["neon", "Neón", "💜", 800, { tinte: "#cc5de8", alfa: .47, aura: "#f783ac", arma: "#f783ac", part: "#e599f7" }],
  ["sombra", "Sombra", "🌑", 900, { tinte: "#1b1726", alfa: .75, aura: "#7048e8", arma: "#9775fa" }],
  ["zombi", "Zombi", "🧟", 450, { tinte: "#82c91e", alfa: .57, som: "🧠" }],
  ["robot", "Robot", "🤖", 650, { tinte: "#adb5bd", alfa: .67, som: "📡", arma: "#74c0fc" }],
  ["pirata", "Pirata", "🏴‍☠️", 550, { som: "🦜", arma: "#e9ecef" }],
  ["fiesta", "Fiesta", "🥳", 400, { som: "🎉", part: "#ffd43b", aura: "#f783ac" }],
  ["rey-barbaro", "Rey bárbaro", "🪓", 1000, { clase: "guerrero", tinte: "#c92a2a", alfa: .42, som: "👑", arma: "#ff6b6b", aura: "#ff8787" }],
  ["elfo", "Elfo del bosque", "🍃", 1000, { clase: "arquero", tinte: "#2f9e44", alfa: .47, som: "🍃", arma: "#69db7c", part: "#b2f2bb" }],
  ["cosmico", "Archimago cósmico", "🌌", 1100, { clase: "mago", tinte: "#364fc7", alfa: .57, som: "⭐", arma: "#91a7ff", aura: "#748ffc", part: "#fff" }],
  ["carmesi", "Ninja carmesí", "🩸", 1000, { clase: "asesino", tinte: "#a61e4d", alfa: .57, arma: "#ff8787", aura: "#e64980" }],
  ["vacio", "Señor del vacío", "🕳️", 1100, { clase: "invocador", tinte: "#5f3dc4", alfa: .62, aura: "#9775fa", part: "#d0bfff", arma: "#b197fc" }]
];

/* Materiales del equipo de la Arena: precio base de cada uno (de madera a "de los creadores") */
const MATERIALES = ["Madera", "Piedra", "Metal", "Esmeralda", "Diamante", "Adamantio", "Encantado", "Vacío", "Creadores"];
const PRECIO_TIER_BASE = [0, 80, 180, 320, 500, 750, 1050, 1400, 1800];

/* Lo que se cambia desde el panel. Ids: los del CATALOGO, "skin:<id>", "tier:<n>" (equipo) y "torre:vida" */
const Catalogo = {
  cfg() { return (typeof Nube !== "undefined" && Nube.cfg && Nube.cfg.catalogo) || {}; },
  precio(id, base) { const p = (this.cfg().precio || {})[id]; return p !== undefined && p !== null && p !== "" && Number.isFinite(+p) ? Math.max(0, Math.round(+p)) : base; },
  visible(id) { return !(this.cfg().oculto || {})[id]; },
  /* Anota la compra (para las estadísticas del panel: qué se compra y quién) */
  anotar(u, tipo, item, nombre, precio) {
    if (!u || !u.nube || typeof Nube === "undefined" || !Nube.user || !Nube.sb) return;
    Nube.sb.from("compras").insert({ usuario: Nube.user.id, tipo, item: String(item).slice(0, 40), nombre: String(nombre || "").slice(0, 60), precio: precio | 0 })
      .then(({ error }) => { if (error) console.warn("compras", error.message); });
  }
};
