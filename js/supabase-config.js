/* Configuración de Supabase (nube, inicio de sesión y ranking mundial).
   Copiar de: Supabase → Project Settings → API (o "Data API"):
     url:     Project URL           (https://xxxx.supabase.co)
     anonKey: Publishable key (sb_publishable_…) o la anon key. NUNCA la "secret" / "service_role".
   La clave anon es pública a propósito: la seguridad la dan las reglas de supabase/esquema.sql.
   Con null el juego funciona igual, solo con perfiles locales. */
window.SUPABASE_CONFIG = {
  url: "https://brvpaoerqcioqxeirxmq.supabase.co",
  anonKey: "sb_publishable_3hDkgv9xoNNmisflbqyskQ_NJT3lPUS"
};
