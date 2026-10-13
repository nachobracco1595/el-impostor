/* Ilustraciones dibujadas en SVG: personajes, avatares, cartas y revólver */
const COLORES = ["#ff6b6b", "#4dabf7", "#51cf66", "#fcc419", "#cc5de8", "#ff922b", "#20c997", "#f06595", "#94d82d", "#748ffc", "#e8e8e8", "#a9746e"];

/* Cada jugador de la lista actual recibe un color distinto; fuera de la lista, uno según su nombre */
const COLOR_FIJO = new Map();
/* Aspecto elegido por cada jugador con perfil: nombre -> { color, acc } */
const LOOKS = new Map();
function fijarColores(nombres) {
  COLOR_FIJO.clear();
  // Los colores elegidos en perfiles no se repiten en los jugadores sin perfil
  const usados = new Set([...LOOKS.values()].map(l => l.color));
  const libres = COLORES.filter(c => !usados.has(c));
  let k = 0;
  nombres.forEach(n => { if (!LOOKS.has(String(n))) COLOR_FIJO.set(String(n), (libres.length ? libres : COLORES)[k++ % (libres.length || COLORES.length)]); });
}
function colorDe(nombre) {
  if (LOOKS.has(String(nombre))) return LOOKS.get(String(nombre)).color;
  if (COLOR_FIJO.has(String(nombre))) return COLOR_FIJO.get(String(nombre));
  let h = 0;
  for (const c of String(nombre)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

function oscurecer(hex, f = 0.72) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

/* Personaje "frijol" con variantes: civ, imp, complice, bufon, nadie, todos, muerto */
/* Accesorios para retratos. "bajo" se dibuja antes de la cara; "sobre", encima. */
const ACCESORIOS = {
  barba: { bajo: `<path d="M24 56 Q26 92 50 93 Q74 92 76 56 Q66 78 50 78 Q34 78 24 56Z" fill="#5c3b1e"/>` },
  pelo: { bajo: `<path d="M14 84 Q10 40 22 22 Q50 2 78 22 Q90 40 86 84 L76 84 Q80 44 70 30 Q50 22 30 30 Q20 44 24 84Z" fill="#5c3b1e"/>`,
          sobre: `<path d="M20 40 Q22 14 50 12 Q78 14 80 40 Q70 24 54 26 Q40 34 20 40Z" fill="#5c3b1e"/>` },
  bigote: { sobre: `<path d="M34 63 Q42 55 50 60 Q58 55 66 63 Q58 67 50 63 Q42 67 34 63Z" fill="#3b2a1a"/>` },
  lentes: { sobre: `<circle cx="38" cy="48" r="12" fill="#ffffff22" stroke="#1b1726" stroke-width="3.5"/><circle cx="62" cy="48" r="12" fill="#ffffff22" stroke="#1b1726" stroke-width="3.5"/><path d="M50 47 H50.1" stroke="#1b1726" stroke-width="4"/>` },
  sombrero: { sobre: `<path d="M8 28 Q50 20 92 28 Q88 34 50 31 Q12 34 8 28Z" fill="#3d3550"/><path d="M26 28 Q24 4 50 4 Q76 4 74 28Z" fill="#3d3550"/><path d="M26 22 Q50 18 74 22 L74 27 Q50 23 26 27Z" fill="#b3263c"/>` },
  galera: { sobre: `<rect x="31" y="0" width="38" height="24" rx="2" fill="#1b1726"/><rect x="31" y="16" width="38" height="5" fill="#b3263c"/><rect x="20" y="22" width="60" height="6" rx="3" fill="#1b1726"/>` },
  gorra: { sobre: `<path d="M20 32 Q20 8 50 8 Q80 8 80 32Z" fill="#1c5fb8"/><path d="M50 28 H94 Q92 36 78 35 H50Z" fill="#164a8f"/><circle cx="50" cy="9" r="3" fill="#164a8f"/>` },
  casco: { sobre: `<path d="M18 32 Q18 4 50 4 Q82 4 82 32Z" fill="#fcc419"/><path d="M46 4 h8 v28 h-8z" fill="#f59f00"/><rect x="12" y="29" width="76" height="6" rx="3" fill="#f59f00"/>` },
  chef: { sobre: `<path d="M26 28 Q12 22 20 10 Q28 0 40 6 Q50 -3 60 6 Q72 0 80 10 Q88 22 74 28Z" fill="#fff"/><rect x="26" y="20" width="48" height="12" rx="2" fill="#f1f3f5"/>` },
  cofia: { sobre: `<path d="M28 26 L33 10 H67 L72 26Z" fill="#fff"/><path d="M47 12 h6 v4 h4 v6 h-4 v4 h-6 v-4 h-4 v-6 h4z" fill="#e03131"/>` },
  auriculares: { sobre: `<path d="M18 48 Q16 10 50 10 Q84 10 82 48" stroke="#1b1726" stroke-width="5" fill="none"/><rect x="12" y="40" width="11" height="18" rx="5" fill="#1b1726"/><rect x="77" y="40" width="11" height="18" rx="5" fill="#1b1726"/><path d="M18 56 Q22 70 38 68" stroke="#1b1726" stroke-width="3" fill="none"/><circle cx="39" cy="68" r="3" fill="#1b1726"/>` },
  mono: { sobre: `<path d="M50 86 L36 79 V93Z M50 86 L64 79 V93Z" fill="#c92a2a"/><circle cx="50" cy="86" r="4" fill="#8f1d1d"/>` },
  collar: { sobre: `<path d="M30 80 Q50 94 70 80" stroke="#3ddcb1" stroke-width="3" fill="none"/><circle cx="50" cy="88" r="4.5" fill="#3ddcb1"/>` },
  lupa: { sobre: `<circle cx="80" cy="74" r="11" fill="#ffffff33" stroke="#c9a227" stroke-width="4"/><path d="M73 82 L62 96" stroke="#5c3b1e" stroke-width="6" stroke-linecap="round"/>` }
};

function personaje(color, tipo = "civ", size = 120, acc = []) {
  const bajo = acc.map(a => (ACCESORIOS[a] || {}).bajo || "").join("");
  const sobre = acc.map(a => (ACCESORIOS[a] || {}).sobre || "").join("");
  const sombra = oscurecer(color);
  let ojos = `<ellipse cx="38" cy="48" rx="9" ry="11" fill="#fff"/><ellipse cx="62" cy="48" rx="9" ry="11" fill="#fff"/>
    <circle cx="40" cy="50" r="4.5" fill="#1b1726"/><circle cx="64" cy="50" r="4.5" fill="#1b1726"/>`;
  let boca = `<path d="M40 66 Q50 75 60 66" stroke="#1b1726" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  let extra = "";
  if (tipo === "imp") {
    ojos = `<rect x="22" y="38" width="56" height="20" rx="10" fill="#1b1726"/>
      <ellipse cx="38" cy="48" rx="7" ry="5" fill="#fff"/><ellipse cx="62" cy="48" rx="7" ry="5" fill="#fff"/>
      <circle cx="40" cy="49" r="3" fill="#ff4d63"/><circle cx="64" cy="49" r="3" fill="#ff4d63"/>
      <path d="M26 34 L46 40 M74 34 L54 40" stroke="#1b1726" stroke-width="4" stroke-linecap="round"/>`;
    boca = `<path d="M38 68 Q52 74 64 64" stroke="#1b1726" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  } else if (tipo === "complice") {
    ojos = `<path d="M22 44 H78" stroke="#1b1726" stroke-width="4"/>
      <rect x="26" y="42" width="22" height="14" rx="6" fill="#1b1726"/><rect x="52" y="42" width="22" height="14" rx="6" fill="#1b1726"/>
      <path d="M30 46 l6 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
    boca = `<path d="M42 68 Q50 72 60 66" stroke="#1b1726" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  } else if (tipo === "bufon") {
    extra = `<path d="M22 30 L14 4 L40 22 L50 0 L60 22 L86 4 L78 30 Z" fill="#b48cff" stroke="#1b1726" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="14" cy="4" r="5" fill="#ffc53d"/><circle cx="50" cy="1" r="5" fill="#ffc53d"/><circle cx="86" cy="4" r="5" fill="#ffc53d"/>`;
    boca = `<path d="M36 64 Q50 82 64 64 Z" fill="#1b1726"/>`;
  } else if (tipo === "muerto") {
    ojos = `<path d="M32 42 l12 12 M44 42 l-12 12 M56 42 l12 12 M68 42 l-12 12" stroke="#1b1726" stroke-width="4" stroke-linecap="round"/>`;
    boca = `<path d="M40 70 H60" stroke="#1b1726" stroke-width="3.5" stroke-linecap="round"/>`;
  } else if (tipo === "duda") {
    ojos = `<ellipse cx="38" cy="48" rx="9" ry="11" fill="#fff"/><ellipse cx="62" cy="48" rx="9" ry="11" fill="#fff"/>
      <circle cx="36" cy="45" r="4.5" fill="#1b1726"/><circle cx="60" cy="45" r="4.5" fill="#1b1726"/>`;
    boca = `<circle cx="50" cy="69" r="5" fill="#1b1726"/>`;
  }
  return `<svg class="pj" viewBox="0 0 100 112" width="${size}" height="${size * 1.12}" aria-hidden="true">
    <ellipse cx="50" cy="108" rx="30" ry="4" fill="#000" opacity=".25"/>
    <rect x="26" y="80" width="18" height="26" rx="8" fill="${sombra}"/>
    <rect x="56" y="80" width="18" height="26" rx="8" fill="${sombra}"/>
    <rect x="18" y="16" width="64" height="80" rx="32" fill="${color}"/>
    <path d="M70 26 Q82 40 80 70" stroke="#fff" stroke-width="5" fill="none" opacity=".25" stroke-linecap="round"/>
    ${bajo}${ojos}${boca}${extra}${sobre}
  </svg>`;
}

/* Grupo de personajes para portadas */
function grupoPortada() {
  const c = ["#4dabf7", "#51cf66", "#ff4d63", "#fcc419", "#cc5de8"];
  const t = ["civ", "civ", "imp", "civ", "civ"];
  return `<div class="grupo">${c.map((col, i) => `<span style="--i:${i}">${personaje(col, t[i], 64)}</span>`).join("")}</div>`;
}

function accDe(nombre, def = []) { const l = LOOKS.get(String(nombre)); return l && l.acc.length ? l.acc : def; }

function avatar(nombre, size = 36, tipo = "civ", acc = []) {
  return `<span class="av" style="width:${size}px;height:${size}px">${personaje(colorDe(nombre), tipo, size * 0.9, accDe(nombre, acc))}</span>`;
}

/* Cartas del Mentiroso: Q, K, A y J (comodín) */
const CARTA = {
  Q: { nombre: "Reina", plural: "Reinas", simbolo: "♛", color: "#d6336c" },
  K: { nombre: "Rey", plural: "Reyes", simbolo: "♚", color: "#1c7ed6" },
  A: { nombre: "As", plural: "Ases", simbolo: "♠", color: "#2b2540" },
  J: { nombre: "Comodín", plural: "Comodines", simbolo: "★", color: "#e8590c" }
};

function carta(r, opts = {}) {
  if (!r || opts.boca) return `<span class="carta dorso ${opts.cls || ""}" ${opts.attrs || ""}><span class="dorso-in"></span></span>`;
  const c = CARTA[r];
  const letra = r === "J" ? "★" : r;
  return `<span class="carta ${opts.cls || ""}" style="--cc:${c.color}" ${opts.attrs || ""}>
    <span class="esq">${letra}</span><span class="cen">${c.simbolo}</span><span class="nom">${c.nombre}</span><span class="esq b">${letra}</span></span>`;
}

/* Revólver visto de frente: 6 recámaras, las usadas en gris */
function tambor(disparos, opts = {}) {
  const ch = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(a) * 26, y = 50 + Math.sin(a) * 26;
    const usada = i < disparos;
    const bala = opts.bala === i;
    ch.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="${bala ? "#ff4d63" : usada ? "#3a3354" : "#0e0c16"}" stroke="#8a84a3" stroke-width="2"/>`);
  }
  return `<svg class="tambor ${opts.girar ? "gira" : ""}" viewBox="0 0 100 100" width="${opts.size || 120}" height="${opts.size || 120}" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="#5c566e" stroke="#2a2540" stroke-width="3"/>
    <circle cx="50" cy="50" r="40" fill="#726b88"/>
    ${ch.join("")}
    <circle cx="50" cy="50" r="7" fill="#2a2540"/>
  </svg>`;
}
