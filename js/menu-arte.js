/* Ilustraciones del menú principal (SVG dibujados a mano, sin imágenes externas) */
const MenuArte = {
  nave() {
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <defs><linearGradient id="maFuego" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset=".5" stop-color="#ffb02e"/><stop offset="1" stop-color="#ff4d63" stop-opacity="0"/></linearGradient>
        <linearGradient id="maCasco" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f3effa"/><stop offset="1" stop-color="#b9b2cf"/></linearGradient></defs>
      <g fill="#fff"><circle cx="12" cy="14" r="1.6"/><circle cx="104" cy="10" r="1.2"/><circle cx="96" cy="44" r="1.6"/><circle cx="20" cy="56" r="1.1"/><circle cx="110" cy="66" r="1.3"/></g>
      <g class="ma-flota" transform="rotate(-28 60 42)">
        <path d="M52 66 Q60 92 68 66 Z" fill="url(#maFuego)"/>
        <path d="M44 58 L34 70 L46 66 Z M76 58 L86 70 L74 66 Z" fill="#ff4d63"/>
        <path d="M60 4 C76 16 78 40 74 64 L46 64 C42 40 44 16 60 4 Z" fill="url(#maCasco)"/>
        <path d="M60 4 C68 10 72 18 73 26 L47 26 C48 18 52 10 60 4 Z" fill="#ff4d63"/>
        <circle cx="60" cy="40" r="9" fill="#2b2347" stroke="#748ffc" stroke-width="3"/>
        <ellipse cx="57" cy="37" rx="3" ry="2" fill="#a5d8ff"/>
        <rect x="54" y="60" width="12" height="5" rx="2" fill="#6c6584"/>
      </g></svg>`;
  },
  carrera() {
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <g opacity=".7" stroke="#b2f2bb" stroke-width="3" stroke-linecap="round"><path d="M2 36h14M0 48h16M4 60h12"/></g>
      <g transform="translate(18 4)">${personaje("#ffc53d", "civ", 62)}</g>
      <g transform="translate(86 6)"><rect x="0" y="0" width="3" height="68" rx="1.5" fill="#e9ecef"/>
        <g transform="translate(3 2)">${[0, 1, 2, 3].map(f => [0, 1, 2, 3, 4].map(c => `<rect x="${c * 6}" y="${f * 6}" width="6" height="6" fill="${(f + c) % 2 ? "#1b1726" : "#fff"}"/>`).join("")).join("")}</g></g>
      <ellipse cx="49" cy="78" rx="24" ry="3.5" fill="#000" opacity=".25"/></svg>`;
  },
  arena() {
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <defs><linearGradient id="maHoja" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#9aa5b8"/></linearGradient>
        <linearGradient id="maEscudo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b7d"/><stop offset="1" stop-color="#a61e33"/></linearGradient></defs>
      <g transform="rotate(-40 60 44)"><rect x="57" y="2" width="7" height="56" rx="2" fill="url(#maHoja)"/><path d="M57 2 L60.5 -6 L64 2 Z" fill="#fff"/><rect x="48" y="56" width="25" height="6" rx="3" fill="#ffc53d"/><rect x="57.5" y="62" width="6" height="14" rx="2" fill="#7a4b2a"/><circle cx="60.5" cy="78" r="4" fill="#ffc53d"/></g>
      <g transform="rotate(40 60 44)"><rect x="57" y="2" width="7" height="56" rx="2" fill="url(#maHoja)"/><path d="M57 2 L60.5 -6 L64 2 Z" fill="#fff"/><rect x="48" y="56" width="25" height="6" rx="3" fill="#ffc53d"/><rect x="57.5" y="62" width="6" height="14" rx="2" fill="#7a4b2a"/><circle cx="60.5" cy="78" r="4" fill="#ffc53d"/></g>
      <path d="M60 22 L82 30 C82 52 74 66 60 74 C46 66 38 52 38 30 Z" fill="url(#maEscudo)" stroke="#ffc53d" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M60 34 L64 44 L75 44 L66 51 L69 62 L60 55 L51 62 L54 51 L45 44 L56 44 Z" fill="#ffc53d"/></svg>`;
  },
  casino() {
    const rodillo = (x, d) => `<g transform="translate(${x} 30)"><rect width="22" height="26" rx="4" fill="#fff"/><text x="11" y="20" text-anchor="middle" font-family="var(--display)" font-size="18" fill="${d === "7" ? "#ff4d63" : "#2b2347"}">${d}</text></g>`;
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <defs><linearGradient id="maSlot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5fa2"/><stop offset="1" stop-color="#9c1f6a"/></linearGradient></defs>
      <rect x="16" y="14" width="80" height="62" rx="12" fill="url(#maSlot)" stroke="#ffc53d" stroke-width="3"/>
      <rect x="26" y="4" width="60" height="16" rx="8" fill="#ffc53d"/><text x="56" y="16" text-anchor="middle" font-family="var(--display)" font-size="10" fill="#5a1238">JACKPOT</text>
      <rect x="22" y="26" width="68" height="34" rx="6" fill="#2b0f24"/>
      ${rodillo(25, "7")}${rodillo(45, "7")}${rodillo(65, "7")}
      <rect x="30" y="64" width="52" height="6" rx="3" fill="#5a1238"/>
      <path d="M96 52 h8 V26" fill="none" stroke="#c9c2dc" stroke-width="4" stroke-linecap="round"/><circle cx="104" cy="22" r="6" fill="#ff4d63"/>
      <g fill="#ffc53d"><circle cx="10" cy="70" r="5"/><circle cx="18" cy="78" r="4"/><circle cx="108" cy="76" r="4.5"/></g></svg>`;
  },
  trabajos() {
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <g transform="rotate(-14 34 46)"><rect x="31" y="12" width="7" height="66" rx="3" fill="#a0673a"/><rect x="31" y="66" width="7" height="12" rx="3" fill="#7a4b2a"/>
        <path d="M37 14 L56 8 C62 18 62 32 56 42 L37 36 Z" fill="#c9d1dc" stroke="#6c7686" stroke-width="2.5" stroke-linejoin="round"/><path d="M56 8 C62 18 62 32 56 42" fill="none" stroke="#fff" stroke-width="2.5"/></g>
      <g transform="rotate(16 78 46)"><rect x="75" y="16" width="7" height="62" rx="3" fill="#8a5a33"/>
        <path d="M58 26 Q78 8 100 26 L97 30 Q78 16 61 30 Z" fill="#aeb7c4" stroke="#6c7686" stroke-width="2.5" stroke-linejoin="round"/></g>
      <g transform="translate(84 58)"><path d="M0 10 C8 0 22 0 28 10 C22 20 8 20 0 10 Z" fill="#4dabf7"/><path d="M26 10 L36 2 L36 18 Z" fill="#339af0"/><circle cx="7" cy="8" r="2" fill="#13111d"/></g>
      <g fill="#51cf66"><path d="M6 78 C8 66 14 62 20 60 C16 68 14 74 12 80 Z"/><path d="M16 80 C18 72 24 68 28 68 C24 74 22 78 20 82 Z"/></g></svg>`;
  },
  naval() {
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <g fill="none" stroke="#4dabf7" stroke-opacity=".35" stroke-width="1">${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${8 + i * 18} 6 V74"/><path d="M4 ${10 + i * 12} H116"/>`).join("")}</g>
      <path d="M14 52 L104 52 L94 66 L24 66 Z" fill="#748ffc"/><path d="M14 52 L104 52 L102 56 L16 56 Z" fill="#a5b4fc"/>
      <rect x="40" y="38" width="30" height="14" rx="2" fill="#bac8ff"/><rect x="48" y="28" width="12" height="10" rx="2" fill="#dbe4ff"/><rect x="60" y="30" width="4" height="10" fill="#495057"/>
      <path d="M70 44 H88" stroke="#495057" stroke-width="4" stroke-linecap="round"/>
      <path d="M2 70 Q12 64 22 70 T42 70 T62 70 T82 70 T102 70 T122 70 V84 H2 Z" fill="#1971c2"/>
      <g transform="translate(92 22)"><circle r="12" fill="none" stroke="#ff4d63" stroke-width="3"/><path d="M0 -17 V-6 M0 6 V17 M-17 0 H-6 M6 0 H17" stroke="#ff4d63" stroke-width="3" stroke-linecap="round"/><circle r="2.5" fill="#ff4d63"/></g></svg>`;
  },
  bowling() {
    const pino = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-4 22 C-7 14 -6 9 -2.5 5 C-1.6 4 -3.6 0 -2.2 -3 C-1 -5 1 -5 2.2 -3 C3.6 0 1.6 4 2.5 5 C6 9 7 14 4 22 Z" fill="#fbf7ee" stroke="#c9c2dc" stroke-width=".6"/><rect x="-2.3" y="1.2" width="4.6" height="1.2" fill="#e03131"/><rect x="-2.5" y="3" width="5" height="1.2" fill="#e03131"/></g>`;
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <defs><radialGradient id="maBola" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#d0bfff"/><stop offset=".45" stop-color="#7048e8"/><stop offset="1" stop-color="#2b1a6b"/></radialGradient>
        <linearGradient id="maPista" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b77b45"/><stop offset="1" stop-color="#e7b071"/></linearGradient></defs>
      <path d="M46 10 L74 10 L104 82 L16 82 Z" fill="url(#maPista)"/><path d="M60 10 V82 M53 10 L40 82 M67 10 L80 82" stroke="rgba(120,70,30,.25)" stroke-width="1"/>
      ${pino(54, 14, 0.9)}${pino(60, 14, 0.9)}${pino(66, 14, 0.9)}${pino(57, 19, 1)}${pino(63, 19, 1)}${pino(60, 24, 1.1)}
      <g transform="rotate(25 72 40)"><path d="M70 20 C66 30 74 30 72 40" stroke="rgba(255,255,255,.7)" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="2 5"/></g>
      <circle cx="44" cy="62" r="16" fill="url(#maBola)"/><circle cx="39" cy="56" r="2.2" fill="#1b1726"/><circle cx="45" cy="54" r="2.2" fill="#1b1726"/><circle cx="43" cy="60" r="2.4" fill="#1b1726"/>
      <ellipse cx="44" cy="79" rx="15" ry="3" fill="rgba(0,0,0,.25)"/></svg>`;
  },
  arco() {
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <g transform="translate(74 38)">${["#f8f9fa", "#212529", "#339af0", "#f03e3e", "#fcc419"].map((c, k) => `<circle r="${30 - k * 6}" fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width=".8"/>`).join("")}<circle r="2" fill="#e8590c"/></g>
      <rect x="50" y="62" width="4" height="20" fill="#8b5a2b" transform="rotate(-12 52 72)"/><rect x="94" y="62" width="4" height="20" fill="#8b5a2b" transform="rotate(12 96 72)"/>
      <g transform="rotate(-8 60 40)"><path d="M8 44 L70 39" stroke="#7a4b2a" stroke-width="2.6" stroke-linecap="round"/><path d="M70 39 l-7 -3.5 l1.5 3.8 l-1.2 3.6 z" fill="#adb5bd"/>
        <path d="M8 44 l-6 -6 l7 2 z M8 44 l-6 6 l7 -2 z" fill="#ff4d63"/></g>
      <path d="M18 10 Q-2 42 18 76" stroke="#8b5a2b" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M18 10 L30 43 L18 76" stroke="rgba(255,255,255,.75)" stroke-width="1.2" fill="none"/></svg>`;
  },
  circo() {
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <path d="M8 26 L60 4 L112 26 Z" fill="#ff4d63"/><path d="M60 4 L34 26 L47 26 Z M60 4 L73 26 L86 26 Z" fill="#fff"/><circle cx="60" cy="4" r="3" fill="#ffd43b"/>
      <ellipse cx="38" cy="50" rx="7" ry="22" fill="none" stroke="#ff922b" stroke-width="4"/>
      ${[0, 1, 2, 3, 4, 5].map(k => { const a = k / 6 * Math.PI * 2; return `<path d="M${38 + Math.cos(a) * 7 - 2} ${50 + Math.sin(a) * 22} q2 -8 4 0 z" fill="${k % 2 ? "#ffd43b" : "#ff6b00"}"/>`; }).join("")}
      <g transform="translate(78 78)">
        <ellipse cx="0" cy="-17" rx="20" ry="9" fill="#e8a33d"/><rect x="-15" y="-12" width="5" height="12" fill="#c8781f"/><rect x="10" y="-12" width="5" height="12" fill="#c8781f"/>
        <circle cx="18" cy="-23" r="10" fill="#8a4b14"/><circle cx="21" cy="-22" r="6" fill="#e8a33d"/><circle cx="23" cy="-24" r="1.3" fill="#1b1726"/>
        <circle cx="-2" cy="-36" r="9" fill="#ffc53d"/><circle cx="-5" cy="-37" r="2" fill="#fff"/><circle cx="1" cy="-37" r="2" fill="#fff"/><circle cx="-2" cy="-33" r="2" fill="#ff4d63"/>
        <path d="M-8 -43 L4 -43 L-1 -57 Z" fill="#748ffc"/><circle cx="-1" cy="-58" r="2.2" fill="#ffd43b"/>
        <path d="M-10 -28 q4 3 8 0 q4 3 8 0" stroke="#fff" stroke-width="2.5" fill="none"/></g></svg>`;
  },
  online() {
    return `<svg viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <g fill="none" stroke="#3ddcb1" stroke-width="5" stroke-linecap="round"><path d="M38 34 A32 32 0 0 1 82 34" opacity=".45"/><path d="M46 44 A20 20 0 0 1 74 44" opacity=".75"/></g><circle cx="60" cy="54" r="5" fill="#3ddcb1"/>
      <g transform="translate(2 36)">${personaje("#ff4d63", "civ", 42)}</g>
      <g transform="translate(76 36)">${personaje("#748ffc", "civ", 42)}</g></svg>`;
  }
};
