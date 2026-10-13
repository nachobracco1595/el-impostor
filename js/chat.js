/* Chat de la sala online: viaja por la misma conexión del juego (el anfitrión lo reparte a todos). */
const Chat = {
  lista: [], vistos: 0, abierto: false,
  btn: null, panel: null,

  crear() {
    this.btn = document.createElement("button");
    this.btn.className = "chat-flot"; this.btn.hidden = true;
    this.btn.setAttribute("aria-label", "Chat de la sala");
    this.btn.onclick = () => this.abrir(!this.abierto);
    this.panel = document.createElement("div");
    this.panel.className = "chat-panel"; this.panel.hidden = true;
    this.panel.innerHTML = `<div class="chat-cab"><b>Chat de la sala</b><button class="linkish" id="chatCerrar" aria-label="Cerrar chat">✕</button></div>
      <div class="chat-msgs" id="chatMsgs"></div>
      <div class="rapidos">${["😂", "👍", "😱", "🤔", "🔪", "🙈", "¡Fui yo no!", "¡Votemos!"].map(t => `<button class="chip-j" data-crap="${t}">${t}</button>`).join("")}</div>
      <form class="add" id="chatF"><input id="chatTxt" maxlength="200" placeholder="Escribe al grupo" autocomplete="off" aria-label="Mensaje al grupo"><button type="submit" aria-label="Enviar">➤</button></form>`;
    document.body.append(this.btn, this.panel);
    this.panel.querySelector("#chatCerrar").onclick = () => this.abrir(false);
    this.panel.querySelector("#chatF").onsubmit = e => { e.preventDefault(); const i = this.panel.querySelector("#chatTxt"); this.enviar(i.value); i.value = ""; };
    this.panel.querySelectorAll("[data-crap]").forEach(b => b.onclick = () => this.enviar(b.dataset.crap));
  },

  enviar(txt) {
    txt = String(txt || "").trim().slice(0, 200);
    if (txt && Net.activo()) Net.send({ t: "chat", txt });
  },

  recibir(lista) {
    const nuevos = lista.filter(m => !this.lista.some(x => x.id === m.id));
    this.lista = lista;
    if (this.abierto) this.vistos = lista.length;
    else if (nuevos.some(m => m.de !== Net.nombre())) Sonido.sfx("tap");
    this.pintar();
  },

  abrir(si) {
    this.abierto = si; this.panel.hidden = !si;
    if (si) { this.vistos = this.lista.length; this.panel.querySelector("#chatTxt").focus(); }
    this.pintar();
  },

  pintar() {
    if (!this.btn) this.crear();
    const activo = Net.activo() && Net.estado === "ok";
    this.btn.hidden = !activo;
    if (!activo) { this.panel.hidden = true; this.abierto = false; this.lista = []; this.vistos = 0; }
    const sin = Math.max(0, this.lista.length - this.vistos);
    this.btn.innerHTML = `💬${sin ? `<span class="burbuja">${sin}</span>` : ""}`;
    if (!this.abierto) return;
    const box = this.panel.querySelector("#chatMsgs");
    const abajo = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = this.lista.length ? this.lista.map(m => `<div class="msg ${m.de === Net.nombre() ? "mio" : ""}">${m.de !== Net.nombre() ? `<b>${esc(m.de)}</b>` : ""}<p>${esc(m.txt)}</p></div>`).join("") : `<p class="empty center">Nadie escribió todavía.</p>`;
    if (abajo) box.scrollTop = box.scrollHeight;
  }
};
