// Mesa Loca · notificaciones push (Supabase Edge Function "notificar").
// - La primera vez genera sus claves (VAPID) y las guarda en push_cfg; la pública queda en config "push" para la app.
// - "mensaje" y "amistad": los dispara la base de datos al insertar (ver supabase/esquema.sql). Solo recibe el id
//   y lee todo de la base, así que nadie puede mandar notificaciones con texto inventado.
// - "recordatorios": lo dispara pg_cron una vez por día; avisa solo a quien todavía no entró ese día.
// Desplegar con "Verify JWT" apagado (la llaman la base y pg_cron).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SITIO = "https://nachobracco1595.github.io/el-impostor/";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hoyAR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

async function claves() {
  let { data } = await sb.from("push_cfg").select("*").eq("id", 1).maybeSingle();
  if (!data || !data.privada) {
    const k = webpush.generateVAPIDKeys();
    await sb.from("push_cfg").upsert({ id: 1, publica: k.publicKey, privada: k.privateKey });
    data = { ...(data || {}), id: 1, publica: k.publicKey, privada: k.privateKey };
  }
  await sb.from("config").upsert({ clave: "push", valor: { publica: data.publica } });
  webpush.setVapidDetails(SITIO, data.publica, data.privada);
  return data;
}

/* Manda a todos los teléfonos de un usuario que tengan prendida esa preferencia */
async function enviar(usuario: string, pref: string, aviso: Record<string, unknown>) {
  const { data: subs } = await sb.from("push_subs").select("endpoint, p256dh, auth, prefs").eq("usuario", usuario);
  let ok = 0;
  for (const s of subs || []) {
    if (s.prefs && s.prefs[pref] === false) continue;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), { TTL: 6 * 3600, urgency: "normal" });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("endpoint", s.endpoint);   // el teléfono ya no la acepta
    }
  }
  return ok;
}

async function nombreDe(id: string) { const { data } = await sb.from("perfiles").select("nombre").eq("id", id).maybeSingle(); return data?.nombre || "Alguien"; }

const CONSEJOS = [
  { title: "⚔️ La Arena te espera", body: "Forjá tus ítems, mejoralos y probá tu poder contra los bots." },
  { title: "🗼 ¿Hasta qué piso llegás hoy?", body: "En la Torre sale el mejor botín: legendarios y míticos." },
  { title: "🎰 El pozo sigue creciendo", body: "Cualquier tirada de tragamonedas se lo puede llevar entero." },
  { title: "❓ Preguntas Locas", body: "Hay más de 500 preguntas nuevas para jugar con amigos." },
  { title: "🎳 ¿Un bowling rápido?", body: "Jugá una partida contra los bots o invitá a alguien." }
];

// Ligas: lunes de la semana (hora de Argentina) y cuántos días le quedan
const LIGAS = ["Bronce", "Plata", "Oro", "Platino", "Diamante", "Leyenda"];
function semanaAR() { const d = new Date(Date.now() - 3 * 36e5); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return { semana: d.toISOString().slice(0, 10), dow }; }
/* Aviso de misiones o de liga (lee perfiles.diario; si falta algo, no dice nada) */
async function avisoProgreso(p: { id: string; diario: Record<string, any> }, hoy: string) {
  const d = p.diario || {}, mis = d.mis, liga = d.liga, w = semanaAR();
  if (mis && mis.dia === hoy && Array.isArray(mis.d)) {
    const faltan = mis.d.filter((m: any) => !(m && m.prog >= m.meta)).length;
    const cobrar = mis.d.filter((m: any) => m && m.prog >= m.meta && !m.ok).length;
    if (cobrar > 0) return { title: "🎯 Tenés misiones para cobrar", body: `${cobrar} misión${cobrar > 1 ? "es" : ""} cumplida${cobrar > 1 ? "s" : ""}: entrá a cobrar monedas y XP del pase.` };
    if (faltan > 0) return { title: `🎯 Te queda${faltan > 1 ? "n" : ""} ${faltan} misi${faltan > 1 ? "ones" : "ón"} por hoy`, body: "Cumplilas antes de medianoche: monedas y XP para el pase de temporada." };
  }
  if (liga && liga.semana === w.semana && (liga.lp | 0) > 0 && w.dow >= 5) {
    const cuando = w.dow === 6 ? "hoy" : "mañana", tier = Math.max(0, Math.min(5, liga.tier | 0));
    let pos: any = null;
    try { const r = await sb.rpc("liga_pos", { quien: p.id, cual: w.semana }); if (!r.error) pos = r.data; } catch { /* SQL viejo */ }
    if (pos && pos.pos) {
      const sube = Math.min(5, Math.ceil(pos.n / 3));
      if (pos.pos <= sube && tier < 5) return { title: `🏆 Tu liga termina ${cuando}`, body: `Estás ${pos.pos}º: si seguís así subís a ${LIGAS[tier + 1]}.` };
      if (pos.pos <= sube + 3 && tier < 5) return { title: `🏆 Tu liga termina ${cuando}`, body: `Estás ${pos.pos}º, a un paso de subir a ${LIGAS[tier + 1]}. ¡Jugá una partida!` };
      return { title: `🏆 Tu liga termina ${cuando}`, body: `Estás ${pos.pos}º de ${pos.n} en ${LIGAS[tier]}. Cada partida suma puntos.` };
    }
    return { title: `🏆 Tu liga termina ${cuando}`, body: `Sumá puntos en ${LIGAS[tier]} para ganar un cofre más grande.` };
  }
  return null;
}

async function recordatorios() {
  const hoy = hoyAR(), { data: cfg } = await sb.from("push_cfg").select("ultimo_recordatorio").eq("id", 1).maybeSingle();
  if (cfg && cfg.ultimo_recordatorio === hoy) return { ya: true };          // una sola vez por día
  await sb.from("push_cfg").update({ ultimo_recordatorio: hoy }).eq("id", 1);
  const { data: subs } = await sb.from("push_subs").select("usuario").limit(5000);
  const usuarios = [...new Set((subs || []).map(s => s.usuario))];
  let enviados = 0;
  for (let i = 0; i < usuarios.length; i += 200) {
    const { data: perfiles } = await sb.from("perfiles").select("id, nombre, diario").in("id", usuarios.slice(i, i + 200));
    for (const p of perfiles || []) {
      const d = p.diario || {}, t = d.torre || {};
      let aviso;
      const prog = d.ultimo === hoy ? await avisoProgreso(p, hoy) : null;
      if (d.ultimo !== hoy) aviso = { title: "🎁 Tu recompensa del día", body: `${p.nombre}, entrá a cobrarla${d.racha > 1 ? ` y no pierdas tu racha de ${d.racha} días` : ""} (y mirá tus misiones nuevas).` };
      else if (prog) aviso = prog;
      else if (t.hoy !== hoy) aviso = { title: "🗼 Tus vidas de la Torre están listas", body: "Entrá a la batalla y subí pisos para conseguir botín." };
      else continue;                                                         // ya jugó hoy: no molestamos
      if (Math.random() < 0.35 && d.ultimo === hoy && !prog) aviso = CONSEJOS[Math.floor(Math.random() * CONSEJOS.length)];
      enviados += await enviar(p.id, "recordatorios", { ...aviso, url: "./", tag: "recordatorio" });
    }
  }
  return { enviados };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    await claves();
    const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (b.tipo === "mensaje" && b.id) {
      // Se marca como notificado antes de mandar: si llega dos veces, la segunda no hace nada
      const { data: m } = await sb.from("mensajes").update({ notificado: true }).eq("id", b.id).eq("notificado", false).select("de, para, texto, sala").maybeSingle();
      if (!m) return json({ ok: true, nada: true });
      const quien = await nombreDe(m.de);
      const aviso = m.sala
        ? { title: `🎮 ${quien} te invita a jugar`, body: `Sala ${m.sala} · tocá para entrar`, url: `./?sala=${m.sala}`, tag: "sala-" + m.sala }
        : { title: `💬 ${quien}`, body: String(m.texto).slice(0, 140), url: "./?ir=amigos", tag: "msj-" + m.de };
      return json({ ok: true, enviados: await enviar(m.para, "mensajes", aviso) });
    }
    if (b.tipo === "amistad" && b.de && b.para) {
      const { data: a } = await sb.from("amistades").select("estado").eq("de", b.de).eq("para", b.para).maybeSingle();
      if (!a || a.estado !== "pendiente") return json({ ok: true, nada: true });
      return json({ ok: true, enviados: await enviar(b.para, "mensajes", { title: "🤝 Solicitud de amistad", body: `${await nombreDe(b.de)} te quiere agregar como amigo.`, url: "./?ir=amigos", tag: "amistad" }) });
    }
    if (b.tipo === "recordatorios") return json({ ok: true, ...(await recordatorios()) });
    return json({ ok: true, listo: true });                                 // sirve para crear las claves la primera vez
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
