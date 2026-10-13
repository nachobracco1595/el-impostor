/* Ilustraciones dibujadas en SVG: personajes, avatares, cartas y revólver */
const COLORES = ["#ff6b6b", "#4dabf7", "#51cf66", "#fcc419", "#cc5de8", "#ff922b", "#20c997", "#f06595", "#94d82d", "#748ffc", "#e8e8e8", "#a9746e"];

/* Cada jugador de la lista actual recibe un color distinto; fuera de la lista, uno según su nombre */
const COLOR_FIJO = new Map();
function fijarColores(nombres) {
  COLOR_FIJO.clear();
  nombres.forEach((n, i) => COLOR_FIJO.set(String(n), COLORES[i % COLORES.length]));
}
function colorDe(nombre) {
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
function personaje(color, tipo = "civ", size = 120) {
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
    ${ojos}${boca}${extra}
  </svg>`;
}

/* Grupo de personajes para portadas */
function grupoPortada() {
  const c = ["#4dabf7", "#51cf66", "#ff4d63", "#fcc419", "#cc5de8"];
  const t = ["civ", "civ", "imp", "civ", "civ"];
  return `<div class="grupo">${c.map((col, i) => `<span style="--i:${i}">${personaje(col, t[i], 64)}</span>`).join("")}</div>`;
}

function avatar(nombre, size = 36, tipo = "civ") {
  return `<span class="av" style="width:${size}px;height:${size}px">${personaje(colorDe(nombre), tipo, size * 0.9)}</span>`;
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
