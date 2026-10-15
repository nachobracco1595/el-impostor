/* Chat de voz de la sala online: el audio va directo de teléfono a teléfono (WebRTC con PeerJS), sin servidor.
   - Quien entra a la voz avisa al anfitrión, que reparte la lista de quiénes están (con su id de PeerJS).
   - Cada par se conecta una sola vez: llama el que tiene el id menor.
   - Se puede silenciar el micrófono; se ve quién está hablando. La música del juego baja mientras hay voz. */
const Voz = {
  activo: false, mute: false, stream: null, lista: [], llamadas: {}, audios: {}, niveles: {}, hablando: new Set(),
  ctx: null, timer: null, abierto: false, btn: null, panel: null, entrando: false,

  posible() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof RTCPeerConnection !== "undefined"); },
  miPeer() { return Net.peer && Net.peer.id; },

  /* Se engancha a cada Peer que crea la sala para atender las llamadas de voz */
  enganchar(peer) {
    peer.on("call", call => {
      if (!this.activo || !this.stream || !this.lista.some(m => m.peer === call.peer)) { try { call.close(); } catch {} return; }
      call.answer(this.stream);
      this.atender(call);
    });
  },

  async entrar() {
    if (this.activo || this.entrando) return;
    if (!this.posible() || !window.isSecureContext) return this.aviso("🎙️", "Este navegador no permite la voz", "Prueba con Chrome o Safari actualizados, desde la página del juego (https).");
    this.entrando = true; this.pintar();
    try {
      this.stream = await this.pedirMic();
    } catch (e) {
      this.entrando = false; this.sesion("playback"); this.pintar();
      return this.explicar(e);
    }
    this.entrando = false; this.activo = true; this.mute = false; this.abierto = true;
    try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume && this.ctx.resume(); } catch {}
    this.medir("yo", this.stream);
    clearInterval(this.timer); this.timer = setInterval(() => this.tic(), 150);
    this.anunciar();
    this.ducking();
    this.pintar();
  },

  /* En iPhone la música del juego deja el audio en modo "solo reproducción" (suena aunque esté en silencio).
     En ese modo iOS no presta el micrófono: para la voz hay que pasar a "reproducir y grabar". */
  sesion(tipo) { try { if (navigator.audioSession) navigator.audioSession.type = tipo; } catch {} },

  async pedirMic() {
    this.sesion("play-and-record");
    const pedidos = [{ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }, { audio: true }];
    let error;
    for (let k = 0; k < 3; k++) {
      try { return await navigator.mediaDevices.getUserMedia(pedidos[Math.min(k, 1)]); }
      catch (e) {
        error = e;
        if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) break;
        // iOS a veces tarda en soltar el audio de la música: se espera un poco y se prueba con lo más simple
        await new Promise(r => setTimeout(r, 400));
      }
    }
    throw error;
  },

  explicar(e) {
    const nombre = (e && e.name) || "Error", ua = navigator.userAgent;
    const iphone = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const appAjena = /FBAN|FBAV|Instagram|WhatsApp|Line\/|GSA\/|TikTok|Twitter/i.test(ua);
    const enMarco = window.top !== window;
    let titulo, texto;
    if (appAjena || enMarco) { titulo = "Abre el juego en el navegador"; texto = `Dentro de ${appAjena ? "esta app" : "esta página"} no se puede usar el micrófono. Abre el enlace en ${iphone ? "Safari" : "Chrome"} y entra a la sala de nuevo.`; }
    else if (nombre === "NotAllowedError" || nombre === "SecurityError") {
      titulo = "Sin permiso para el micrófono";
      texto = iphone ? "Toca «aA» en la barra de Safari → Ajustes del sitio web → Micrófono → Permitir. También revisa Ajustes del iPhone → Safari → Micrófono. Después prueba de nuevo." : "Toca el candado de la barra del navegador, permite el micrófono y prueba de nuevo.";
    } else if (nombre === "NotReadableError" || nombre === "AbortError" || nombre === "InvalidStateError") {
      titulo = "El micrófono está ocupado"; texto = "Puede que otra app lo esté usando (una llamada, un audio de WhatsApp, Siri). Ciérrala y prueba de nuevo. Si sigue, recarga la página.";
    } else if (nombre === "NotFoundError" || nombre === "OverconstrainedError") { titulo = "No se encontró un micrófono"; texto = "Revisa que el teléfono tenga micrófono disponible (sin auriculares a medio conectar) y prueba de nuevo."; }
    else { titulo = "No se pudo usar el micrófono"; texto = "Recarga la página y prueba de nuevo."; }
    Toast.mostrar(`<div class="t-ic">🎙️</div><div class="t-txt"><b>${esc(titulo)}</b><span>${esc(texto)}</span><small>Código: ${esc(nombre)}</small></div>`, "info");
  },

  salir() {
    if (!this.activo && !this.stream) return;
    this.activo = false; this.abierto = false;
    if (Net.activo()) try { Net.send({ t: "voz", on: false }); } catch {}
    Object.keys(this.llamadas).forEach(p => this.cortar(p));
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.sesion("playback");
    this.stream = null; this.niveles = {}; this.hablando.clear();
    clearInterval(this.timer); this.timer = null;
    this.ducking();
    this.pintar();
  },

  silenciar(si = !this.mute) {
    this.mute = si;
    if (this.stream) this.stream.getAudioTracks().forEach(t => t.enabled = !si);
    this.anunciar(); this.pintar();
  },

  anunciar() { if (Net.activo() && this.activo && this.miPeer()) Net.send({ t: "voz", on: true, peer: this.miPeer(), mute: this.mute }); },

  /* Lista que reparte el anfitrión: con quién hay que estar conectado */
  recibir(lista) {
    this.lista = Array.isArray(lista) ? lista.filter(m => m && typeof m.peer === "string") : [];
    if (this.activo) {
      const yo = this.miPeer(), quedan = new Set(this.lista.map(m => m.peer));
      Object.keys(this.llamadas).forEach(p => { if (!quedan.has(p)) this.cortar(p); });
      this.lista.forEach(m => {
        if (m.peer === yo || this.llamadas[m.peer] || !(yo < m.peer)) return;
        try { this.atender(Net.peer.call(m.peer, this.stream)); } catch (e) { console.warn("voz", e); }
      });
    }
    this.pintar();
  },

  atender(call) {
    if (!call) return;
    const p = call.peer;
    if (this.llamadas[p] && this.llamadas[p] !== call) try { this.llamadas[p].close(); } catch {}
    this.llamadas[p] = call;
    call.on("stream", s => {
      let a = this.audios[p];
      if (!a) { a = this.audios[p] = document.createElement("audio"); a.autoplay = true; a.setAttribute("playsinline", ""); a.className = "voz-audio"; document.body.appendChild(a); }
      a.srcObject = s; a.play().catch(() => {});
      this.medir(p, s);
      this.pintar();
    });
    const fin = () => { if (this.llamadas[p] === call) { this.cortar(p); this.pintar(); setTimeout(() => this.reintentar(p), 3000); } };
    call.on("close", fin); call.on("error", fin);
  },
  reintentar(p) {
    if (!this.activo || this.llamadas[p] || !this.lista.some(m => m.peer === p) || !(this.miPeer() < p)) return;
    try { this.atender(Net.peer.call(p, this.stream)); } catch {}
  },
  cortar(p) {
    const c = this.llamadas[p]; delete this.llamadas[p];
    try { c && c.close(); } catch {}
    const a = this.audios[p]; if (a) { a.srcObject = null; a.remove(); delete this.audios[p]; }
    delete this.niveles[p]; this.hablando.delete(p);
  },

  /* Quién está hablando: mide el volumen de cada voz */
  medir(clave, stream) {
    if (!this.ctx) return;
    try {
      const src = this.ctx.createMediaStreamSource(stream), an = this.ctx.createAnalyser();
      an.fftSize = 512; src.connect(an);
      this.niveles[clave] = { an, buf: new Uint8Array(an.fftSize) };
    } catch {}
  },
  tic() {
    let cambio = false;
    for (const [k, n] of Object.entries(this.niveles)) {
      n.an.getByteTimeDomainData(n.buf);
      let s = 0; for (const v of n.buf) s += (v - 128) * (v - 128);
      const rms = Math.sqrt(s / n.buf.length), habla = rms > 4 && !(k === "yo" && this.mute);
      n.hasta = habla ? Date.now() + 350 : n.hasta || 0;
      const ahora = Date.now() < n.hasta;
      if (ahora !== this.hablando.has(k)) { ahora ? this.hablando.add(k) : this.hablando.delete(k); cambio = true; }
    }
    if (cambio) this.pintar();
  },

  ducking() { if (typeof Sonido !== "undefined" && Sonido.ctx && Sonido.musicBus) Sonido.musicBus.gain.setTargetAtTime(Sonido.volMusica(Sonido.pista), Sonido.ctx.currentTime, 0.3); },
  aviso(ic, t, d) { Toast.mostrar(`<div class="t-ic">${ic}</div><div class="t-txt"><b>${esc(t)}</b><span>${esc(d)}</span></div>`, "info"); },

  /* ---------- Botón flotante y panel ---------- */
  crear() {
    this.btn = document.createElement("button");
    this.btn.className = "voz-flot"; this.btn.hidden = true;
    this.btn.onclick = () => { if (!this.activo) this.entrar(); else { this.abierto = !this.abierto; this.pintar(); } };
    this.panel = document.createElement("div");
    this.panel.className = "voz-panel"; this.panel.hidden = true;
    this.panel.onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "vozMute") this.silenciar();
      if (b.id === "vozSalir") this.salir();
      if (b.id === "vozCerrar") { this.abierto = false; this.pintar(); }
    };
    this.hablan = document.createElement("div");
    this.hablan.className = "voz-hablan"; this.hablan.hidden = true;
    document.body.append(this.btn, this.panel, this.hablan);
  },
  nombreDe(peer) {
    if (peer === "yo" || peer === this.miPeer()) return Net.nombre();
    const m = this.lista.find(x => x.peer === peer); return m ? m.name : "";
  },
  pintar() {
    if (!this.btn) this.crear();
    const enSala = Net.activo() && Net.estado === "ok" && this.posible();
    if (!enSala && this.activo) this.salir();
    this.btn.hidden = !enSala;
    const yoHablo = this.hablando.has("yo");
    this.btn.className = `voz-flot ${this.activo ? (this.mute ? "mute" : "on") : ""} ${yoHablo ? "habla" : ""}`;
    this.btn.setAttribute("aria-label", this.activo ? "Chat de voz" : "Entrar al chat de voz");
    const otros = this.lista.filter(m => m.peer !== this.miPeer());
    this.btn.innerHTML = `${this.entrando ? "⏳" : this.activo && this.mute ? "🔇" : "🎙️"}${!this.activo && otros.length ? `<span class="burbuja">${otros.length}</span>` : ""}`;
    // Quién habla (se ve aunque el panel esté cerrado)
    const nombres = [...this.hablando].filter(k => k !== "yo").map(k => this.nombreDe(k)).filter(Boolean);
    this.hablan.hidden = !enSala || !this.activo || !nombres.length || this.abierto;
    this.hablan.textContent = nombres.length ? `🔊 ${nombres.join(", ")}` : "";
    this.panel.hidden = !enSala || !this.activo || !this.abierto;
    if (this.panel.hidden) return;
    const conectado = p => !!(this.audios[p] && this.audios[p].srcObject);
    this.panel.innerHTML = `<div class="chat-cab"><b>🎙️ Chat de voz</b><button class="linkish" id="vozCerrar" aria-label="Cerrar">✕</button></div>
      <ul class="voz-lista">
        <li class="${yoHablo ? "habla" : ""}">${avatar(Net.nombre(), 30)}<b class="voz-nom">${esc(Net.nombre())} (tú)</b><i>${this.mute ? "🔇" : "🎙️"}</i></li>
        ${otros.map(m => `<li class="${this.hablando.has(m.peer) ? "habla" : ""}">${avatar(m.name, 30)}<b class="voz-nom">${esc(m.name)}</b><i>${m.mute ? "🔇" : conectado(m.peer) ? "🔊" : "⏳"}</i></li>`).join("")}
      </ul>
      ${otros.length ? "" : `<p class="sub">Todavía no hay nadie más en la voz. Los demás entran tocando 🎙️.</p>`}
      <div class="row"><button class="btn chico ${this.mute ? "" : "ghost"}" id="vozMute">${this.mute ? "🎙️ Activar micrófono" : "🔇 Silenciarme"}</button><button class="btn chico danger" id="vozSalir">Salir de la voz</button></div>
      <p class="summary">Con auriculares se escucha mejor y no hay eco.</p>`;
  }
};
