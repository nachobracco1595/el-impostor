-- El Impostor: perfiles en la nube con puntos y ranking.
-- Pegar todo en Supabase → SQL Editor → New query → Run. Se puede correr más de una vez.

create table if not exists public.perfiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  nombre       text not null check (char_length(nombre) between 1 and 16),
  look         jsonb not null default '{}'::jsonb,
  puntos       integer not null default 0 check (puntos >= 0),
  racha        integer not null default 0,
  mejor_racha  integer not null default 0,
  stats        jsonb not null default '{}'::jsonb,
  logros       jsonb not null default '{}'::jsonb,
  historial    jsonb not null default '[]'::jsonb check (jsonb_typeof(historial) = 'array' and jsonb_array_length(historial) <= 40),
  contadas     jsonb not null default '[]'::jsonb check (jsonb_typeof(contadas) = 'array' and jsonb_array_length(contadas) <= 100),
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),
  -- Puntos por juego, para ordenar el ranking de cada juego
  pts_impostor integer generated always as (coalesce((stats -> 'impostor' ->> 'p')::integer, 0)) stored,
  pts_liars    integer generated always as (coalesce((stats -> 'liars' ->> 'p')::integer, 0)) stored,
  pts_casos    integer generated always as (coalesce((stats -> 'casos' ->> 'p')::integer, 0)) stored
);

-- Monedas, cosas compradas y premio diario
alter table public.perfiles add column if not exists monedas integer not null default 0 check (monedas >= 0);
alter table public.perfiles add column if not exists inventario jsonb not null default '[]'::jsonb;
alter table public.perfiles add column if not exists diario jsonb not null default '{}'::jsonb;

-- Juegos agregados después (se pueden correr sobre una tabla ya creada)
alter table public.perfiles add column if not exists pts_chinchon integer generated always as (coalesce((stats -> 'chinchon' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists pts_naval    integer generated always as (coalesce((stats -> 'naval' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists pts_nave     integer generated always as (coalesce((stats -> 'nave' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists pts_ajedrez  integer generated always as (coalesce((stats -> 'ajedrez' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists pts_arena    integer generated always as (coalesce((stats -> 'arena' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists elo_arena    integer generated always as (coalesce((stats -> 'arena' ->> 'elo')::integer, 1000)) stored;
create index if not exists perfiles_elo_arena_idx on public.perfiles (elo_arena desc);

create index if not exists perfiles_puntos_idx on public.perfiles (puntos desc);
create index if not exists perfiles_impostor_idx on public.perfiles (pts_impostor desc);
create index if not exists perfiles_liars_idx on public.perfiles (pts_liars desc);
create index if not exists perfiles_casos_idx on public.perfiles (pts_casos desc);
create index if not exists perfiles_chinchon_idx on public.perfiles (pts_chinchon desc);
create index if not exists perfiles_naval_idx on public.perfiles (pts_naval desc);
create index if not exists perfiles_ajedrez_idx on public.perfiles (pts_ajedrez desc);
create index if not exists perfiles_nave_idx on public.perfiles (pts_nave desc);

-- Seguridad: el ranking es público, pero cada uno solo crea, edita y borra su propio perfil.
alter table public.perfiles enable row level security;

drop policy if exists "ranking publico" on public.perfiles;
create policy "ranking publico" on public.perfiles for select using (true);

drop policy if exists "crear mi perfil" on public.perfiles;
create policy "crear mi perfil" on public.perfiles for insert to authenticated
  with check (auth.uid() = id and puntos = 0 and monedas = 0);

drop policy if exists "editar mi perfil" on public.perfiles;
create policy "editar mi perfil" on public.perfiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "borrar mi perfil" on public.perfiles;
create policy "borrar mi perfil" on public.perfiles for delete to authenticated
  using (auth.uid() = id);

-- Antitrampas: los puntos nunca bajan y no suben más de 500 de una vez.
create or replace function public.perfiles_controlar() returns trigger
language plpgsql as $$
begin
  -- Los ajustes del administrador (cobrar_regalos) pasan sin estos controles
  if current_setting('impostor.ajuste', true) = '1' then
    new.id := old.id; new.creado := old.creado; new.actualizado := now();
    return new;
  end if;
  if new.puntos < old.puntos or new.puntos > old.puntos + 500 then
    raise exception 'Cambio de puntos no permitido' using errcode = '42501';
  end if;
  -- Las monedas pueden bajar (compras) pero no subir más de 500 de una vez
  if new.monedas > old.monedas + 500 then
    raise exception 'Cambio de monedas no permitido' using errcode = '42501';
  end if;
  new.id := old.id;
  new.creado := old.creado;
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists perfiles_controlar on public.perfiles;
create trigger perfiles_controlar before update on public.perfiles
  for each row execute function public.perfiles_controlar();

-- ============ Amigos y mensajes ============
create table if not exists public.amistades (
  de      uuid not null references public.perfiles (id) on delete cascade,
  para    uuid not null references public.perfiles (id) on delete cascade,
  estado  text not null default 'pendiente' check (estado in ('pendiente', 'aceptada')),
  creado  timestamptz not null default now(),
  primary key (de, para),
  check (de <> para)
);
alter table public.amistades enable row level security;

drop policy if exists "ver mis amistades" on public.amistades;
create policy "ver mis amistades" on public.amistades for select to authenticated
  using (auth.uid() = de or auth.uid() = para);
drop policy if exists "pedir amistad" on public.amistades;
create policy "pedir amistad" on public.amistades for insert to authenticated
  with check (auth.uid() = de and estado = 'pendiente');
drop policy if exists "aceptar amistad" on public.amistades;
create policy "aceptar amistad" on public.amistades for update to authenticated
  using (auth.uid() = para) with check (auth.uid() = para and estado = 'aceptada');
drop policy if exists "borrar amistad" on public.amistades;
create policy "borrar amistad" on public.amistades for delete to authenticated
  using (auth.uid() = de or auth.uid() = para);

create table if not exists public.mensajes (
  id      bigint generated always as identity primary key,
  de      uuid not null references public.perfiles (id) on delete cascade,
  para    uuid not null references public.perfiles (id) on delete cascade,
  texto   text not null check (char_length(texto) between 1 and 500),
  sala    text check (sala ~ '^[A-Z]{4}$'),
  leido   boolean not null default false,
  creado  timestamptz not null default now()
);
create index if not exists mensajes_para_idx on public.mensajes (para, leido);
create index if not exists mensajes_charla_idx on public.mensajes (de, para, creado desc);
alter table public.mensajes enable row level security;

drop policy if exists "ver mis mensajes" on public.mensajes;
create policy "ver mis mensajes" on public.mensajes for select to authenticated
  using (auth.uid() = de or auth.uid() = para);
-- Solo se le puede escribir a un amigo (amistad aceptada)
drop policy if exists "escribir a amigos" on public.mensajes;
create policy "escribir a amigos" on public.mensajes for insert to authenticated
  with check (
    auth.uid() = de and leido = false and exists (
      select 1 from public.amistades a
      where a.estado = 'aceptada'
        and ((a.de = mensajes.de and a.para = mensajes.para) or (a.de = mensajes.para and a.para = mensajes.de))
    )
  );
drop policy if exists "marcar leidos" on public.mensajes;
create policy "marcar leidos" on public.mensajes for update to authenticated
  using (auth.uid() = para) with check (auth.uid() = para);

-- Al marcar como leído no se puede cambiar nada más del mensaje
create or replace function public.mensajes_solo_leido() returns trigger
language plpgsql as $$
begin
  if new.de <> old.de or new.para <> old.para or new.texto <> old.texto or new.sala is distinct from old.sala or new.creado <> old.creado then
    raise exception 'Solo se puede marcar como leído' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists mensajes_solo_leido on public.mensajes;
create trigger mensajes_solo_leido before update on public.mensajes
  for each row execute function public.mensajes_solo_leido();

-- Mensajes en tiempo real (si la publicación de Supabase existe)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'mensajes') then
    alter publication supabase_realtime add table public.mensajes;
  end if;
end $$;

-- ============ Panel de administración, actividad, anuncios y regalos ============
-- Para darte acceso al panel, corre UNA vez (con tu correo):
--   insert into public.admins (id) select id from auth.users where email = 'TU_CORREO' on conflict do nothing;
create table if not exists public.admins (id uuid primary key references auth.users (id) on delete cascade);
alter table public.admins enable row level security;   -- sin políticas: nadie la lee ni la cambia desde la app

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid())
$$;

-- Actividad: cada jugador anota lo suyo (partidas, ingresos, compras); solo los admins la leen
create table if not exists public.actividad (
  id       bigint generated always as identity primary key,
  usuario  uuid not null references public.perfiles (id) on delete cascade,
  tipo     text not null check (tipo in ('partida', 'ingreso', 'compra', 'mision', 'anuncio', 'regalo', 'ajuste', 'trabajo')),
  juego    text check (char_length(juego) <= 20),
  puntos   integer not null default 0,
  monedas  integer not null default 0,
  creado   timestamptz not null default now()
);
alter table public.actividad drop constraint if exists actividad_tipo_check;
alter table public.actividad add constraint actividad_tipo_check check (tipo in ('partida', 'ingreso', 'compra', 'mision', 'anuncio', 'regalo', 'ajuste', 'trabajo'));
create index if not exists actividad_creado_idx on public.actividad (creado);
create index if not exists actividad_usuario_idx on public.actividad (usuario, creado);
alter table public.actividad enable row level security;
drop policy if exists "anotar mi actividad" on public.actividad;
create policy "anotar mi actividad" on public.actividad for insert to authenticated
  with check (auth.uid() = usuario and tipo in ('partida', 'ingreso', 'compra', 'mision') and monedas between -10000 and 500 and puntos between 0 and 500);
drop policy if exists "admins leen actividad" on public.actividad;
create policy "admins leen actividad" on public.actividad for select to authenticated using (public.es_admin());

-- Configuración que maneja el panel (todos la leen, solo admins la cambian)
create table if not exists public.config (clave text primary key, valor jsonb not null);
alter table public.config enable row level security;
drop policy if exists "leer config" on public.config;
create policy "leer config" on public.config for select using (true);
drop policy if exists "admins cambian config" on public.config;
create policy "admins cambian config" on public.config for all to authenticated using (public.es_admin()) with check (public.es_admin());
insert into public.config (clave, valor) values ('anuncios', '{"activos": false, "monedas": 20, "porDia": 5, "prueba": true}') on conflict do nothing;
-- Evento de temporada: { id: 'halloween' | 'navidad' | 'pascuas' | null, trabajo, multi, mensaje, items: { id: { on, precio } } }
insert into public.config (clave, valor) values ('evento', '{"id": null, "trabajo": true, "multi": 1, "items": {}}') on conflict do nothing;

-- Cobrar un anuncio visto: respeta el máximo por día y devuelve cuántas monedas sumar
create or replace function public.cobrar_anuncio() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; vistos integer; tope integer; m integer;
begin
  if auth.uid() is null or not exists (select 1 from public.perfiles where id = auth.uid()) then
    raise exception 'Necesitas un perfil en la nube' using errcode = '42501';
  end if;
  select valor into cfg from public.config where clave = 'anuncios';
  if cfg is null or not coalesce((cfg ->> 'activos')::boolean, false) then
    return jsonb_build_object('ok', false, 'motivo', 'apagados');
  end if;
  tope := greatest(coalesce((cfg ->> 'porDia')::integer, 5), 0);
  select count(*) into vistos from public.actividad where usuario = auth.uid() and tipo = 'anuncio' and creado >= date_trunc('day', now());
  if vistos >= tope then return jsonb_build_object('ok', false, 'motivo', 'limite', 'quedan', 0); end if;
  m := least(greatest(coalesce((cfg ->> 'monedas')::integer, 20), 1), 200);
  insert into public.actividad (usuario, tipo, monedas) values (auth.uid(), 'anuncio', m);
  return jsonb_build_object('ok', true, 'monedas', m, 'quedan', tope - vistos - 1);
end $$;

-- Trabajos diarios (tala, mina, pesca): uno de cada uno por día, contando el día de Argentina
create or replace function public.desbloquear_trabajo(juego text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'motivo', 'sin sesion'); end if;
  if juego not in ('tala', 'mina', 'pesca', 'evento') then raise exception 'Trabajo desconocido' using errcode = '22023'; end if;
  if juego = 'evento' and not exists (select 1 from public.config where clave = 'evento' and coalesce(valor ->> 'id', '') <> '' and coalesce((valor ->> 'trabajo')::boolean, true)) then
    return jsonb_build_object('ok', false, 'motivo', 'sin evento');
  end if;
  if exists (select 1 from public.actividad a where a.usuario = auth.uid() and a.tipo = 'trabajo' and a.juego = desbloquear_trabajo.juego
             and (a.creado at time zone 'America/Argentina/Buenos_Aires')::date = hoy) then
    return jsonb_build_object('ok', false, 'motivo', 'hecho');
  end if;
  insert into public.actividad (usuario, tipo, juego) values (auth.uid(), 'trabajo', desbloquear_trabajo.juego);
  return jsonb_build_object('ok', true);
end $$;

-- Regalos y ajustes que manda el admin (monedas y puntos, para sumar o quitar).
-- Se aplican cuando el jugador entra: el servidor cambia su perfil y el juego suma lo mismo en el teléfono.
create table if not exists public.regalos (
  id       bigint generated always as identity primary key,
  usuario  uuid not null references public.perfiles (id) on delete cascade,
  monedas  integer not null default 0,
  motivo   text check (char_length(motivo) <= 80),
  cobrado  boolean not null default false,
  creado   timestamptz not null default now()
);
alter table public.regalos add column if not exists puntos integer not null default 0;
alter table public.regalos drop constraint if exists regalos_monedas_check;
alter table public.regalos drop constraint if exists regalos_valores;
alter table public.regalos add constraint regalos_valores check (monedas between -100000 and 100000 and puntos between -1000000 and 1000000);
alter table public.regalos enable row level security;   -- solo se usa con las funciones de abajo

drop function if exists public.cobrar_regalos();
create or replace function public.cobrar_regalos() returns jsonb
language plpgsql security definer set search_path = public as $$
declare dm integer; dp integer; motivos text; antes public.perfiles; despues public.perfiles;
begin
  if auth.uid() is null then return jsonb_build_object('monedas', 0, 'puntos', 0); end if;
  with r as (update public.regalos set cobrado = true where usuario = auth.uid() and not cobrado returning monedas, puntos, motivo)
  select coalesce(sum(monedas), 0), coalesce(sum(puntos), 0), string_agg(motivo, ' · ') into dm, dp, motivos from r;
  if dm = 0 and dp = 0 then return jsonb_build_object('monedas', 0, 'puntos', 0); end if;
  select * into antes from public.perfiles where id = auth.uid() for update;
  if not found then return jsonb_build_object('monedas', 0, 'puntos', 0); end if;
  perform set_config('impostor.ajuste', '1', true);
  update public.perfiles set monedas = greatest(0, monedas + dm), puntos = greatest(0, puntos + dp)
    where id = auth.uid() returning * into despues;
  perform set_config('impostor.ajuste', '', true);
  dm := despues.monedas - antes.monedas; dp := despues.puntos - antes.puntos;
  insert into public.actividad (usuario, tipo, monedas, puntos)
    values (auth.uid(), case when dm > 0 and dp = 0 then 'regalo' else 'ajuste' end, dm, dp);
  return jsonb_build_object('monedas', dm, 'puntos', dp, 'motivo', motivos);
end $$;

create or replace function public.admin_ajustar(destino uuid, monedas integer default 0, puntos integer default 0, motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if coalesce(monedas, 0) = 0 and coalesce(puntos, 0) = 0 then raise exception 'Pon monedas o puntos para sumar o quitar' using errcode = '22023'; end if;
  insert into public.regalos (usuario, monedas, puntos, motivo) values (destino, coalesce(monedas, 0), coalesce(puntos, 0), left(motivo, 80));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_regalar(destino uuid, cantidad integer, motivo text default null) returns jsonb
language sql security definer set search_path = public as $$
  select public.admin_ajustar(destino, cantidad, 0, motivo)
$$;

-- Resumen para el panel (solo admins)
create or replace function public.panel_resumen(dias integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb; desde date := current_date - (least(greatest(dias, 7), 90) - 1);
begin
  if not public.es_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  with d as (select generate_series(desde, current_date, interval '1 day')::date as dia),
  a as (select creado::date as dia, usuario, tipo, juego, monedas from public.actividad where creado >= desde)
  select jsonb_build_object(
    'usuarios', (select count(*) from public.perfiles),
    'nuevos7', (select count(*) from public.perfiles where creado >= now() - interval '7 days'),
    'activosHoy', (select count(distinct usuario) from a where dia = current_date),
    'activos7', (select count(distinct usuario) from a where dia > current_date - 7),
    'partidas7', (select count(*) from a where tipo = 'partida' and dia > current_date - 7),
    'partidasPeriodo', (select count(*) from a where tipo = 'partida'),
    'monedasCirculacion', (select coalesce(sum(monedas), 0) from public.perfiles),
    'gastado7', (select coalesce(-sum(monedas), 0) from a where tipo = 'compra' and dia > current_date - 7),
    'anuncios7', (select count(*) from a where tipo = 'anuncio' and dia > current_date - 7),
    'amistades', (select count(*) from public.amistades where estado = 'aceptada'),
    'mensajes7', (select count(*) from public.mensajes where creado >= now() - interval '7 days'),
    'serie', (select jsonb_agg(jsonb_build_object(
        'dia', d.dia,
        'activos', (select count(distinct usuario) from a where a.dia = d.dia),
        'partidas', (select count(*) from a where a.dia = d.dia and tipo = 'partida'),
        'nuevos', (select count(*) from public.perfiles p where p.creado::date = d.dia),
        'mPartidas', (select coalesce(sum(monedas), 0) from a where a.dia = d.dia and tipo = 'partida'),
        'mPremios', (select coalesce(sum(monedas), 0) from a where a.dia = d.dia and tipo in ('ingreso', 'mision', 'regalo')),
        'mAnuncios', (select coalesce(sum(monedas), 0) from a where a.dia = d.dia and tipo = 'anuncio'),
        'gastado', (select coalesce(-sum(monedas), 0) from a where a.dia = d.dia and tipo = 'compra')
      ) order by d.dia) from d),
    'porJuego', (select coalesce(jsonb_object_agg(juego, n), '{}'::jsonb) from (select juego, count(*) as n from a where tipo = 'partida' and juego is not null group by juego) x),
    'top', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select id, nombre, look, puntos, monedas from public.perfiles order by puntos desc limit 10) t),
    'config', (select valor from public.config where clave = 'anuncios')
  ) into res;
  return res;
end $$;

create or replace function public.panel_usuarios(buscar text default '') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(u), '[]'::jsonb) from (
    select p.id, p.nombre, p.look, p.puntos, p.monedas, p.creado,
      (select max(creado) from public.actividad a where a.usuario = p.id) as ultima,
      (select count(*) from public.actividad a where a.usuario = p.id and a.tipo = 'partida') as partidas
    from public.perfiles p
    where buscar = '' or p.nombre ilike '%' || buscar || '%'
    order by ultima desc nulls last, p.puntos desc limit 100) u);
end $$;

-- ============ Referidos: invitar amigos con un link ============
-- Cada perfil tiene un código. El que entra con el link recibe monedas de bienvenida;
-- el que invitó cobra cuando su amigo ya jugó unas partidas (así no sirve crear cuentas falsas).
alter table public.perfiles add column if not exists ref text unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
update public.perfiles set ref = upper(substr(md5(random()::text || id::text), 1, 6)) where ref is null;

-- El código no se puede cambiar desde la app
create or replace function public.perfiles_ref_fijo() returns trigger
language plpgsql as $$ begin new.ref := old.ref; return new; end $$;
drop trigger if exists perfiles_ref_fijo on public.perfiles;
create trigger perfiles_ref_fijo before update on public.perfiles for each row execute function public.perfiles_ref_fijo();

create table if not exists public.referidos (
  invitado   uuid primary key references public.perfiles (id) on delete cascade,
  invitador  uuid not null references public.perfiles (id) on delete cascade,
  pagado     boolean not null default false,
  creado     timestamptz not null default now()
);
create index if not exists referidos_invitador_idx on public.referidos (invitador);
alter table public.referidos enable row level security;   -- solo con las funciones de abajo

insert into public.config (clave, valor) values ('referidos', '{"activo": true, "premioInvitado": 100, "premioInvitador": 150, "partidas": 3, "maxPorDia": 5}') on conflict do nothing;

-- El nuevo jugador canjea el código del link (solo cuentas nuevas, una vez, no uno mismo)
create or replace function public.canjear_referido(codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; yo public.perfiles; inv public.perfiles; m integer;
begin
  select valor into cfg from public.config where clave = 'referidos';
  if cfg is null or not coalesce((cfg ->> 'activo')::boolean, true) then return jsonb_build_object('ok', false, 'motivo', 'apagado'); end if;
  select * into yo from public.perfiles where id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'motivo', 'sin perfil'); end if;
  if yo.creado < now() - interval '3 days' then return jsonb_build_object('ok', false, 'motivo', 'cuenta vieja'); end if;
  if exists (select 1 from public.referidos where invitado = yo.id) then return jsonb_build_object('ok', false, 'motivo', 'ya usado'); end if;
  select * into inv from public.perfiles where ref = upper(trim(codigo)) and id <> yo.id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'codigo'); end if;
  insert into public.referidos (invitado, invitador) values (yo.id, inv.id);
  m := least(greatest(coalesce((cfg ->> 'premioInvitado')::integer, 100), 0), 500);
  if m > 0 then insert into public.regalos (usuario, monedas, motivo) values (yo.id, m, left('Bienvenida: te invitó ' || inv.nombre, 80)); end if;
  return jsonb_build_object('ok', true, 'invitador', inv.nombre, 'monedas', m);
end $$;

-- El que invitó: cobra los amigos que ya jugaron lo suficiente y ve su lista
create or replace function public.mis_referidos() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; minimo integer; premio integer; tope integer; hoy integer; r record; lista jsonb := '[]'::jsonb; nuevos integer := 0; codigo text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  select valor into cfg from public.config where clave = 'referidos';
  minimo := coalesce((cfg ->> 'partidas')::integer, 3);
  premio := least(greatest(coalesce((cfg ->> 'premioInvitador')::integer, 150), 0), 500);
  tope := coalesce((cfg ->> 'maxPorDia')::integer, 5);
  select ref into codigo from public.perfiles where id = auth.uid();
  select count(*) into hoy from public.actividad where usuario = auth.uid() and tipo = 'regalo' and creado >= date_trunc('day', now()) and juego = 'referido';
  for r in
    select f.invitado, f.pagado, f.creado, p.nombre, p.look,
      (select count(*) from public.actividad a where a.usuario = f.invitado and a.tipo = 'partida') as partidas
    from public.referidos f join public.perfiles p on p.id = f.invitado
    where f.invitador = auth.uid() order by f.creado desc
  loop
    if not r.pagado and r.partidas >= minimo and premio > 0 and hoy + nuevos < tope then
      update public.referidos set pagado = true where invitado = r.invitado;
      insert into public.regalos (usuario, monedas, motivo) values (auth.uid(), premio, left('Tu amigo ' || r.nombre || ' ya juega', 80));
      insert into public.actividad (usuario, tipo, juego, monedas) values (auth.uid(), 'regalo', 'referido', 0);
      nuevos := nuevos + 1; r.pagado := true;
    end if;
    lista := lista || jsonb_build_object('nombre', r.nombre, 'look', r.look, 'partidas', least(r.partidas, minimo), 'activo', r.partidas >= minimo, 'pagado', r.pagado, 'creado', r.creado);
  end loop;
  return jsonb_build_object('ok', true, 'codigo', codigo, 'lista', lista, 'nuevos', nuevos, 'partidas', minimo, 'premio', premio,
    'premioInvitado', coalesce((cfg ->> 'premioInvitado')::integer, 100), 'activo', coalesce((cfg ->> 'activo')::boolean, true));
end $$;

-- Panel: los que más invitaron
create or replace function public.panel_referidos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.referidos),
    'activos', (select count(*) from public.referidos where pagado),
    'top', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select p.nombre, p.look, count(*) as invitados, count(*) filter (where f.pagado) as activos
      from public.referidos f join public.perfiles p on p.id = f.invitador group by p.id order by count(*) desc limit 10) t));
end $$;
