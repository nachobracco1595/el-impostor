/* Nube: inicio de sesión con Google (Firebase Auth) y perfiles en Firestore (colección "usuarios").
   El perfil se guarda también en la BD local como caché (con nube: true) y se sube después de cada partida.
   ?emu=1 usa los emuladores locales de Firebase (para probar sin tocar la nube real). */
const EMU = /[?&]emu=1/.test(location.search);
const CAMPOS_NUBE = ["nombre", "look", "puntos", "racha", "mejorRacha", "stats", "logros", "historial", "contadas", "creado", "actualizado"];

const Nube = {
  estado: "apagada",   // apagada | cargando | lista | error
  auth: null, db: null, user: null, error: "",
  ranking: {},         // juego -> { filas, cargando, error, t }

  config() {
    if (EMU) return { apiKey: "demo-key", authDomain: "demo-impostor.firebaseapp.com", projectId: "demo-impostor", appId: "demo" };
    return window.FIREBASE_CONFIG || null;
  },
  disponible() { return !!this.config() && this.estado !== "error"; },

  cargarScript(src) {
    return new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  },

  async iniciar() {
    if (!this.config() || this.estado !== "apagada") return;
    this.estado = "cargando";
    try {
      for (const f of ["app", "auth", "firestore"]) await this.cargarScript(`js/vendor/firebase/firebase-${f}-compat.js`);
      firebase.initializeApp(this.config());
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      if (EMU) {
        this.auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
        this.db.useEmulator("127.0.0.1", 8085);
      }
      this.auth.languageCode = "es";
      this.auth.onAuthStateChanged(u => this.alCambiar(u));
      this.estado = "lista";
    } catch (e) {
      console.error(e);
      this.estado = "error"; this.error = "No se pudo conectar con la nube.";
    }
    render();
  },

  async entrarGoogle() {
    if (this.estado !== "lista") return;
    const prov = new firebase.auth.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: "select_account" });
    try {
      await this.auth.signInWithPopup(prov);
    } catch (e) {
      const c = e && e.code;
      console.warn("Google:", c, e && e.message);
      if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return;
      if (c === "auth/popup-blocked" || c === "auth/operation-not-supported-in-this-environment") {
        try { await this.auth.signInWithRedirect(prov); return; } catch {}
      }
      UI.errNube = c === "auth/unauthorized-domain"
        ? "Este sitio todavía no está autorizado en Firebase. Agrega el dominio en Authentication → Configuración → Dominios autorizados."
        : c === "auth/network-request-failed" ? "Sin conexión. Revisa tu internet."
        : "No se pudo iniciar sesión con Google. Si abriste el juego dentro de Claude, ábrelo desde su página web.";
      render();
    }
  },

  /* Se llama al iniciar o cerrar sesión (también al abrir la página con sesión guardada) */
  async alCambiar(fu) {
    this.user = fu;
    const ses = BD.sesion();
    if (!fu) {
      if (ses && ses.nube) { BD.salir(); render(); }
      return;
    }
    try {
      const doc = await this.db.collection("usuarios").doc(fu.uid).get();
      if (doc.exists) {
        const u = BD.adoptarNube(fu.uid, doc.data());
        if (u.pendiente) this.subir(u);
        if (S.screen === "cuenta" || S.screen === "crearPerfil") alIniciar(u); else render();
      } else {
        // Primera vez: elige nombre y personaje
        UI.nubeNuevo = { uid: fu.uid };
        UI.borrador = { nombre: (fu.displayName || "").split(" ")[0].slice(0, 16), color: pick(COLORES), cabeza: "", cara: "", pin: "" };
        go("crearPerfil");
      }
    } catch (e) {
      console.error(e);
      UI.errNube = "No se pudo leer tu perfil de la nube. Prueba de nuevo en un rato.";
      render();
    }
  },

  async crearPerfil(nombre, look) {
    const fu = this.user;
    if (!fu) throw new Error("Vuelve a iniciar sesión con Google.");
    const u = BD.crearNube(fu.uid, nombre, look);
    await this.db.collection("usuarios").doc(fu.uid).set(this.publico(u));
    u.pendiente = false; BD.guardar();
    return u;
  },

  publico(u) {
    const d = {};
    CAMPOS_NUBE.forEach(k => { if (u[k] !== undefined) d[k] = u[k]; });
    d.actualizado = Date.now();
    return JSON.parse(JSON.stringify(d));
  },

  /* Sube el perfil; si falla queda marcado como pendiente y se reintenta después */
  async subir(u) {
    if (!u || !u.nube) return;
    if (!this.user || this.user.uid !== u.id || !this.db) { u.pendiente = true; BD.guardar(); return; }
    try {
      await this.db.collection("usuarios").doc(u.id).set(this.publico(u));
      u.pendiente = false; BD.guardar();
      delete this.ranking[""]; delete this.ranking[UI.tabRank || ""];
    } catch (e) {
      console.error(e);
      u.pendiente = true; BD.guardar();
    }
  },

  async cargarRanking(juego = "") {
    if (this.estado !== "lista") return;
    const r = this.ranking[juego];
    if (r && (r.cargando || Date.now() - r.t < 30000)) return;
    this.ranking[juego] = { filas: r ? r.filas : null, cargando: true, error: "", t: Date.now() };
    try {
      const campo = juego ? `stats.${juego}.p` : "puntos";
      const snap = await this.db.collection("usuarios").orderBy(campo, "desc").limit(50).get();
      const filas = snap.docs.map(d => {
        const u = { id: d.id, ...d.data() };
        const base = statsVacias();
        for (const j in base) u.stats = u.stats || {}, u.stats[j] = Object.assign(base[j], u.stats[j] || {});
        const s = juego ? u.stats[juego] : null;
        return { u, puntos: s ? s.p : u.puntos, j: s ? s.j : total(u, "j"), g: s ? s.g : total(u, "g") };
      }).filter(f => Cuenta.lookValido(f.u.look));
      this.ranking[juego] = { filas, cargando: false, error: "", t: Date.now() };
    } catch (e) {
      console.error(e);
      this.ranking[juego] = { filas: null, cargando: false, error: "No se pudo cargar el ranking de la nube.", t: Date.now() };
    }
    if (S.screen === "ranking") render();
  },

  async salir() {
    BD.salir();
    try { if (this.auth) await this.auth.signOut(); } catch {}
  },

  async borrarCuenta(u) {
    try { await this.db.collection("usuarios").doc(u.id).delete(); } catch (e) { console.error(e); }
    BD.borrar(u.id);
    await this.salir();
  }
};
