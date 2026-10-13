/* Nube con Supabase: inicio de sesión (Google o enlace al correo) y perfiles en la tabla "perfiles".
   El perfil se guarda también en la BD local como caché (con nube: true) y se sube después de cada partida.
   ?emu=1 usa un Supabase local de pruebas en 127.0.0.1:54321. */
const EMU = /[?&]emu=1/.test(location.search);

const Nube = {
  estado: "apagada",   // apagada | cargando | lista | error
  sb: null, user: null, uidCargado: null, error: "",
  ranking: {},         // juego -> { filas, cargando, error, t }

  config() {
    if (EMU) return { url: "http://127.0.0.1:54321", anonKey: "anon-key" };
    return window.SUPABASE_CONFIG || null;
  },
  disponible() { return !!this.config() && this.estado !== "error"; },

  /* Adónde vuelve el navegador después de iniciar sesión */
  /* Se conservan los parámetros (por ejemplo ?sala=ABCD de una invitación) */
  volverA() { return location.origin + location.pathname + location.search; },

  cargarScript(src) {
    return new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  },

  async iniciar() {
    const cfg = this.config();
    if (!cfg || this.estado !== "apagada") return;
    this.estado = "cargando";
    // Si volvemos de Google o del enlace del correo, la sesión viene en la dirección
    const hash = new URLSearchParams(location.hash.slice(1));
    this.volvioDeLogin = hash.has("access_token");
    // Si el enlace del correo se abre en esta misma pestaña, solo cambia el "#": recargamos para leer la sesión
    window.addEventListener("hashchange", () => { if (location.hash.includes("access_token")) location.reload(); });
    if (hash.has("error_description")) {
      UI.errNube = "No se pudo iniciar sesión: " + hash.get("error_description").replace(/\+/g, " ");
      history.replaceState(null, "", location.pathname + location.search);
    }
    try {
      await this.cargarScript("js/vendor/supabase.js");
      this.sb = supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      // Supabase pide no esperar otras llamadas dentro de este aviso: se procesa aparte
      this.sb.auth.onAuthStateChange((evento, sesion) => setTimeout(() => this.alCambiar(sesion ? sesion.user : null), 0));
      this.estado = "lista";
    } catch (e) {
      console.error(e);
      this.estado = "error"; this.error = "No se pudo conectar con la nube.";
    }
    render();
  },

  async entrarGoogle() {
    if (this.estado !== "lista") return;
    const { error } = await this.sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: this.volverA() } });
    if (error) { UI.errNube = "No se pudo abrir Google. " + (error.message || ""); render(); }
  },

  async enviarEnlace(email) {
    if (this.estado !== "lista") return;
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: this.volverA(), shouldCreateUser: true } });
    if (error) throw new Error(/rate|seconds/i.test(error.message) ? "Se mandaron demasiados correos. Espera un rato y prueba de nuevo." : "No se pudo mandar el correo. Revisa la dirección.");
  },

  /* Se llama al iniciar o cerrar sesión (también al abrir la página con sesión guardada) */
  async alCambiar(user) {
    this.user = user;
    if (!user) {
      this.uidCargado = null;
      const ses = BD.sesion();
      if (ses && ses.nube) { BD.salir(); render(); }
      return;
    }
    if (this.uidCargado === user.id) return;
    this.uidCargado = user.id;
    try {
      const { data, error } = await this.sb.from("perfiles").select("*").eq("id", user.id).limit(1);
      if (error) throw error;
      if (data && data.length) {
        const u = BD.adoptarNube(user.id, this.deFila(data[0]));
        if (u.pendiente) this.subir(u);
        if (this.volvioDeLogin || S.screen === "cuenta" || S.screen === "crearPerfil") { this.volvioDeLogin = false; alIniciar(u); }
        else render();
      } else {
        // Primera vez: elige nombre y personaje
        const md = user.user_metadata || {};
        const sugerido = (md.full_name || md.name || (user.email || "").split("@")[0] || "").split(" ")[0].slice(0, 16);
        UI.nubeNuevo = { uid: user.id };
        UI.borrador = { nombre: sugerido, color: pick(COLORES), cabeza: "", cara: "", pin: "" };
        this.volvioDeLogin = false;
        go("crearPerfil");
      }
    } catch (e) {
      console.error(e);
      this.uidCargado = null;
      UI.errNube = "No se pudo leer tu perfil de la nube. Prueba de nuevo en un rato.";
      render();
    }
  },

  aFila(u) {
    return { nombre: u.nombre, look: u.look, puntos: u.puntos, racha: u.racha, mejor_racha: u.mejorRacha, stats: u.stats, logros: u.logros, historial: u.historial, contadas: u.contadas, monedas: u.monedas || 0, inventario: u.inv || [], diario: u.diario || {} };
  },
  deFila(r) {
    return { nombre: r.nombre, look: r.look, puntos: r.puntos, racha: r.racha, mejorRacha: r.mejor_racha, stats: r.stats, logros: r.logros || {}, historial: r.historial || [], contadas: r.contadas || [], monedas: r.monedas || 0, inv: r.inventario || [], diario: r.diario || {}, creado: Date.parse(r.creado) || Date.now() };
  },

  async crearPerfil(nombre, look) {
    if (!this.user) throw new Error("Vuelve a iniciar sesión.");
    const u = BD.crearNube(this.user.id, nombre, look);
    const { error } = await this.sb.from("perfiles").insert({ id: u.id, ...this.aFila(u) });
    if (error) { console.error(error); throw new Error("No se pudo guardar tu perfil en la nube. Prueba de nuevo."); }
    u.pendiente = false; BD.guardar();
    return u;
  },

  /* Sube el perfil; si falla queda marcado como pendiente y se reintenta después */
  async subir(u) {
    if (!u || !u.nube) return;
    if (!this.user || this.user.id !== u.id || !this.sb) { u.pendiente = true; BD.guardar(); return; }
    const { error } = await this.sb.from("perfiles").update(this.aFila(u)).eq("id", u.id);
    if (error) { console.error(error); u.pendiente = true; }
    else { u.pendiente = false; this.ranking = {}; }
    BD.guardar();
  },

  async cargarRanking(juego = "") {
    if (this.estado !== "lista") return;
    const r = this.ranking[juego];
    if (r && (r.cargando || Date.now() - r.t < 30000)) return;
    this.ranking[juego] = { filas: r ? r.filas : null, cargando: true, error: "", t: Date.now() };
    const { data, error } = await this.sb.from("perfiles").select("id,nombre,look,puntos,stats")
      .order(juego ? "pts_" + juego : "puntos", { ascending: false }).limit(50);
    if (error) {
      console.error(error);
      this.ranking[juego] = { filas: null, cargando: false, error: "No se pudo cargar el ranking de la nube.", t: Date.now() };
    } else {
      const filas = data.map(row => {
        const u = { id: row.id, nombre: row.nombre, look: row.look, puntos: row.puntos, stats: statsVacias() };
        for (const j in u.stats) Object.assign(u.stats[j], (row.stats || {})[j] || {});
        const s = juego ? u.stats[juego] : null;
        return { u, puntos: s ? s.p : u.puntos, j: s ? s.j : total(u, "j"), g: s ? s.g : total(u, "g") };
      }).filter(f => Cuenta.lookValido(f.u.look));
      this.ranking[juego] = { filas, cargando: false, error: "", t: Date.now() };
    }
    if (S.screen === "ranking") render();
  },

  async salir() {
    BD.salir();
    this.uidCargado = null;
    try { if (this.sb) await this.sb.auth.signOut(); } catch {}
  },

  async borrarCuenta(u) {
    const { error } = await this.sb.from("perfiles").delete().eq("id", u.id);
    if (error) console.error(error);
    BD.borrar(u.id);
    await this.salir();
  }
};
