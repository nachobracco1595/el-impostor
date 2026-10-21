/* Memoria de los bots: aprenden de cada persona, juego por juego.
   - Nivel que sube solo: cada partida contra bots mueve un puntaje (0 a 100). Si les ganás sube bastante, si perdés baja un poco,
     así con el tiempo cada vez juegan mejor. La dificultad elegida (fácil, normal, difícil) es la base y el puntaje la corre.
   - Costumbres: en algunos juegos anotan cómo jugás (si mentís, si faroleás, desde dónde atacás…) y juegan en contra de eso.
   Se guarda en el perfil (u.diario.mente), así la memoria te sigue en cualquier teléfono. Sin perfil, queda en este teléfono. */
const MENTE = {
  BASE: { facil: 0.2, normal: 0.5, dificil: 0.8 },
  SUBE: 7, BAJA: 3, INICIO: 40,
  NOMBRES: { arena: "Arena", torre: "Torre", truco: "Truco", liars: "Mentiroso", poker: "Póker", chinchon: "Chinchón", burako: "Burako", ajedrez: "Ajedrez", naval: "Batalla naval", carrera: "Carrera", nave: "La Nave", bowling: "Bowling", arco: "Arco y flecha", circo: "Circo" }
};

const Mente = {
  todo() {
    const u = typeof BD !== "undefined" && BD.sesion && BD.sesion();
    if (u) { u.diario = u.diario || {}; return (u.diario.mente = u.diario.mente || {}); }
    this.anon = this.anon || store.get("menteAnon", {});
    return this.anon;
  },
  guardar() {
    const u = typeof BD !== "undefined" && BD.sesion && BD.sesion();
    if (u) { clearTimeout(this.tGuardar); this.tGuardar = setTimeout(() => { try { Eco.guardar(u); } catch { BD.guardar(); } }, 1500); }
    else store.set("menteAnon", this.anon || {});
  },
  de(juego) { const T = this.todo(); return (T[juego] = T[juego] || { r: MENTE.INICIO, j: 0, g: 0, hab: {} }); },
  /* 0 a 100: cuánto aprendieron de vos en este juego */
  puntaje(juego) { return Math.round(this.de(juego).r); },
  /* Nivel de 1 a 10 para mostrar */
  nivel(juego) { return Math.max(1, Math.min(10, Math.round(this.de(juego).r / 10))); },
  /* Habilidad de 0 a 1 para usar en la lógica: la dificultad elegida es la base y el puntaje la sube o la baja */
  habilidad(juego, dificultad = "normal") {
    const base = MENTE.BASE[dificultad] ?? MENTE.BASE.normal;
    return Math.max(0, Math.min(1, base + (this.de(juego).r - 50) / 160));
  },
  /* Interpola entre lo que haría un bot flojo (a) y uno muy bueno (b) */
  mezcla(juego, a, b, dificultad) { const h = this.habilidad(juego, dificultad); return a + (b - a) * h; },
  /* Al terminar una partida contra bots */
  resultado(juego, gano, empate = false) {
    const M = this.de(juego); M.j++;
    if (empate) M.r += 1;
    else if (gano) { M.g++; M.r += MENTE.SUBE; }
    else M.r -= MENTE.BAJA;
    M.r = Math.max(0, Math.min(100, M.r));
    this.guardar();
  },
  /* Costumbres: promedio que se va actualizando (los datos nuevos pesan más) */
  anotar(juego, clave, valor, peso = 0.12) {
    const H = this.de(juego).hab, x = H[clave];
    H[clave] = x ? { v: x.v * (1 - peso) + valor * peso, n: x.n + 1 } : { v: valor, n: 1 };
    this.guardar();
  },
  /* Lo que aprendió (si todavía vio poco, devuelve lo normal) */
  costumbre(juego, clave, normal, minimo = 4) { const x = this.de(juego).hab[clave]; return x && x.n >= minimo ? x.v : normal; },
  vistos(juego, clave) { const x = this.de(juego).hab[clave]; return x ? x.n : 0; },
  /* Después de cada pantalla (desde Cuenta.revisar): si terminó una partida local contra bots, la anota una sola vez.
     La arena y la torre anotan solas al terminar la pelea. */
  revisar() {
    if (typeof Net !== "undefined" && Net.activo && Net.activo()) return;
    const J = {
      liars: [S.lie, s => s.players, () => Lie], truco: [S.tru, s => s.jug, () => Truco], poker: [S.pk, s => s.jug, () => Poker],
      chinchon: [S.chi, s => s.jug, () => Chin], burako: [S.bk, s => s.jug, () => Burako], ajedrez: [S.aj, s => s.jug, () => Ajedrez],
      naval: [S.nav, s => s.jug, () => Naval], carrera: [S.car, s => s.jug, () => Carrera], nave: [S.nave, s => s.jug, () => Nave]
    };
    if (typeof EXTRA !== "undefined" && S.extra && EXTRA[S.extra.juego]) J[S.extra.juego] = [S.extra, s => s.jug, () => EXTRA[S.extra.juego]];
    for (const juego in J) {
      const [st, lista, mod] = J[juego]; if (!st || st.menteOk) continue;
      const jug = lista(st) || [], yo = jug.find(j => !j.cpu && !j.bot);
      if (!yo || !jug.some(j => j.cpu || j.bot)) continue;
      let r = null; try { r = mod().resultado(st, yo.id); } catch { }
      if (!r) continue;
      st.menteOk = true;
      this.resultado(juego, !!r.gano, !!r.tablas);
    }
  },
  /* Solo se aprende en partidas de este teléfono (online cada uno tiene su propia memoria) */
  local() { return typeof Net === "undefined" || !Net.activo || !Net.activo(); }
};
