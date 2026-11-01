/* Notificaciones push: activarlas en este teléfono y elegir cuáles recibir.
   Necesita cuenta en la nube y, en iPhone, la app instalada en la pantalla de inicio (iOS 16.4 o más nuevo).
   Las manda la función "notificar" de Supabase (mensajes, invitaciones, amistades y un recordatorio por día). */
const Avisos = {
  sub: null, prefs: { mensajes: true, recordatorios: true }, msg: "",
  soporta: () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
  ios: () => /iPhone|iPad|iPod/.test(navigator.userAgent),
  instalada: () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
  enNube() { const u = BD.sesion(); return !!(u && u.nube && typeof Nube !== "undefined" && Nube.sb && Nube.user && Nube.user.id === u.id); },
  b64: s => { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); },
  async clave() {
    let c = Nube.cfg && Nube.cfg.push && Nube.cfg.push.publica;
    if (c) return c;
    // La primera vez la función crea las claves: se le pide y se relee la configuración
    // (en Supabase quedó publicada como "smooth-function"; se prueban los dos nombres)
    for (const fn of ["smooth-function", "notificar"]) { try { const r = await Nube.sb.functions.invoke(fn, { body: {} }); if (!r.error) break; } catch {} }
    const { data } = await Nube.sb.from("config").select("valor").eq("clave", "push").maybeSingle();
    return data && data.valor && data.valor.publica;
  },
  async revisar() {
    if (!this.soporta() || !this.enNube()) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration(); const s = reg && await reg.pushManager.getSubscription();
      this.sub = s && Notification.permission === "granted" ? s : null;
      if (this.sub) { const { data } = await Nube.sb.from("push_subs").select("prefs").eq("endpoint", this.sub.endpoint).maybeSingle(); if (data) this.prefs = { ...this.prefs, ...data.prefs }; else await this.guardar(); }
    } catch {}
  },
  async guardar() {
    if (!this.sub) return;
    const j = this.sub.toJSON();
    await Nube.sb.from("push_subs").upsert({ endpoint: j.endpoint, usuario: Nube.user.id, p256dh: j.keys.p256dh, auth: j.keys.auth, prefs: this.prefs });
  },
  async activar() {
    this.msg = "";
    try {
      if (Notification.permission === "denied") throw new Error("Bloqueaste las notificaciones. Activálas en Ajustes → Notificaciones → Mesa Loca y volvé a intentar.");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("No diste permiso para las notificaciones.");
      const reg = await navigator.serviceWorker.ready, clave = await this.clave();
      if (!clave) throw new Error("El servidor de notificaciones todavía no está listo (falta instalar la función «notificar» en Supabase).");
      this.sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.b64(clave) });
      await this.guardar();
      Toast.mostrar(`<div class="t-ic">🔔</div><div class="t-txt"><b>¡Notificaciones activadas!</b><span>Te avisamos cuando te escriban o te inviten.</span></div>`, "logro");
    } catch (e) { this.msg = e.message || "No se pudo activar."; }
    render();
  },
  async desactivar() {
    try { if (this.sub) { await Nube.sb.from("push_subs").delete().eq("endpoint", this.sub.endpoint); await this.sub.unsubscribe(); } } catch {}
    this.sub = null; render();
  },
  async cambiar(k) { this.prefs[k] = !this.prefs[k]; try { await this.guardar(); } catch {} render(); },

  /* Panel en el perfil */
  panel() {
    if (!this.enNube()) return "";
    let cuerpo;
    if (!this.soporta() || (this.ios() && !this.instalada())) cuerpo = `<p class="sub">${this.ios() ? "En iPhone las notificaciones funcionan con la app instalada: abrila desde el ícono de Mesa Loca en tu pantalla de inicio (Compartir → «Agregar a inicio»)." : "Este navegador no permite notificaciones."}</p>`;
    else if (!this.sub) cuerpo = `<p class="sub">Enterate cuando te escriben, te invitan a una sala o te quieren agregar, y un recordatorio por día (recompensa diaria, la Torre…).</p><button class="btn" id="avOn">🔔 Activar notificaciones</button>`;
    else cuerpo = `${[["mensajes", "Mensajes e invitaciones", "Cuando un amigo te escribe, te invita a su sala o te quiere agregar."], ["recordatorios", "Recordatorios", "Uno por día como mucho: recompensa del día, vidas de la Torre, la Arena…"]].map(([k, t, d]) => `<div class="opt"><div class="txt"><b>${t}</b><small>${d}</small></div><button class="switch" role="switch" aria-checked="${this.prefs[k] !== false}" data-avpref="${k}" aria-label="${t}"></button></div>`).join("")}
      <button class="btn ghost chico" id="avOff">Desactivar en este teléfono</button>`;
    return `<div class="panel av-panel"><span class="label">🔔 Notificaciones</span>${cuerpo}${this.msg ? `<p class="warn">${esc(this.msg)}</p>` : ""}</div>`;
  },
  conectar() {
    on("avOn", () => this.activar()); on("avOff", () => this.desactivar());
    app.querySelectorAll("[data-avpref]").forEach(b => b.onclick = () => this.cambiar(b.dataset.avpref));
  }
};
{ const r0 = render; render = function () { const x = r0.apply(this, arguments); try { if (S.screen === "perfil") Avisos.conectar(); } catch {} return x; }; }
setTimeout(() => Avisos.revisar().then(() => { if (S.screen === "perfil") render(); }), 4000);
