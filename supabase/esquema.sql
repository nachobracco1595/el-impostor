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
alter table public.perfiles add column if not exists pts_carrera  integer generated always as (coalesce((stats -> 'carrera' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists pts_poker    integer generated always as (coalesce((stats -> 'poker' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists pts_burako   integer generated always as (coalesce((stats -> 'burako' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists pts_truco    integer generated always as (coalesce((stats -> 'truco' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists pts_arena    integer generated always as (coalesce((stats -> 'arena' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists elo_arena    integer generated always as (coalesce((stats -> 'arena' ->> 'elo')::integer, 1000)) stored;
create index if not exists perfiles_elo_arena_idx on public.perfiles (elo_arena desc);
alter table public.perfiles add column if not exists pts_bowling  integer generated always as (coalesce((stats -> 'bowling' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists pts_arco     integer generated always as (coalesce((stats -> 'arco' ->> 'p')::integer, 0)) stored;
alter table public.perfiles add column if not exists pts_circo    integer generated always as (coalesce((stats -> 'circo' ->> 'p')::integer, 0)) stored;
create index if not exists perfiles_bowling_idx on public.perfiles (pts_bowling desc);
create index if not exists perfiles_arco_idx on public.perfiles (pts_arco desc);
create index if not exists perfiles_circo_idx on public.perfiles (pts_circo desc);
alter table public.perfiles add column if not exists pts_preguntas integer generated always as (coalesce((stats -> 'preguntas' ->> 'p')::integer, 0)) stored;
create index if not exists perfiles_preguntas_idx on public.perfiles (pts_preguntas desc);
alter table public.perfiles add column if not exists pts_adivina integer generated always as (coalesce((stats -> 'adivina' ->> 'p')::integer, 0)) stored;
create index if not exists perfiles_adivina_idx on public.perfiles (pts_adivina desc);
alter table public.perfiles add column if not exists pts_basta integer generated always as (coalesce((stats -> 'basta' ->> 'p')::integer, 0)) stored;
create index if not exists perfiles_basta_idx on public.perfiles (pts_basta desc);

create index if not exists perfiles_puntos_idx on public.perfiles (puntos desc);
create index if not exists perfiles_impostor_idx on public.perfiles (pts_impostor desc);
create index if not exists perfiles_liars_idx on public.perfiles (pts_liars desc);
create index if not exists perfiles_casos_idx on public.perfiles (pts_casos desc);
create index if not exists perfiles_chinchon_idx on public.perfiles (pts_chinchon desc);
create index if not exists perfiles_naval_idx on public.perfiles (pts_naval desc);
create index if not exists perfiles_ajedrez_idx on public.perfiles (pts_ajedrez desc);
create index if not exists perfiles_nave_idx on public.perfiles (pts_nave desc);
create index if not exists perfiles_truco_idx on public.perfiles (pts_truco desc);
create index if not exists perfiles_burako_idx on public.perfiles (pts_burako desc);
create index if not exists perfiles_poker_idx on public.perfiles (pts_poker desc);
create index if not exists perfiles_carrera_idx on public.perfiles (pts_carrera desc);

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
  -- El código de amigo (tag) no cambia nunca (la columna se agrega más abajo)
  if old.tag is not null then new.tag := old.tag; end if;
  -- Los ajustes del administrador (cobrar_regalos, cambiar_nombre) pasan sin estos controles
  if current_setting('impostor.ajuste', true) = '1' then
    new.id := old.id; new.creado := old.creado; new.actualizado := now();
    return new;
  end if;
  -- El nombre solo se cambia con cambiar_nombre (cuesta monedas)
  new.nombre := old.nombre; new.cambios_nombre := old.cambios_nombre;
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
  tipo     text not null check (tipo in ('partida', 'ingreso', 'compra', 'mision', 'anuncio', 'regalo', 'ajuste', 'trabajo', 'timba')),
  juego    text check (char_length(juego) <= 20),
  puntos   integer not null default 0,
  monedas  integer not null default 0,
  creado   timestamptz not null default now()
);
alter table public.actividad drop constraint if exists actividad_tipo_check;
alter table public.actividad add constraint actividad_tipo_check check (tipo in ('partida', 'ingreso', 'compra', 'mision', 'anuncio', 'regalo', 'ajuste', 'trabajo', 'timba'));
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
    select p.id, p.nombre, p.look, p.puntos, p.monedas, p.creado, p.diario->'mente' as mente,
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

-- ============ Casino: ruleta, tragamonedas y bingo ============
-- Cada jugada mueve las monedas en el servidor (apuesta y premio juntos), controlando el saldo y el premio máximo.
-- Así las ganancias grandes no chocan con el control de perfiles_controlar (+500 por vez).
insert into public.config (clave, valor) values ('timba', '{"activo": true, "maxApuesta": 500}') on conflict do nothing;

-- Pozo acumulado (jackpot) compartido por todos: cada apuesta del casino le suma un porcentaje
-- y en cada tirada de tragamonedas el servidor sortea si alguien se lo lleva (más chances cuanto más apuesta).
create table if not exists public.pozo (
  id       integer primary key default 1 check (id = 1),
  monto    bigint not null default 2000,
  ganador  text,
  ganado   bigint,
  juego    text,
  cuando   timestamptz
);
insert into public.pozo (id) values (1) on conflict do nothing;
alter table public.pozo enable row level security;
grant select on public.pozo to anon, authenticated;
drop policy if exists "todos ven el pozo" on public.pozo;
create policy "todos ven el pozo" on public.pozo for select to anon, authenticated using (true);

create table if not exists public.pozo_ganadores (
  id       bigint generated always as identity primary key,
  usuario  uuid references public.perfiles (id) on delete set null,
  nombre   text,
  monto    bigint not null,
  juego    text,
  creado   timestamptz not null default now()
);
alter table public.pozo_ganadores enable row level security;
grant select on public.pozo_ganadores to anon, authenticated;
drop policy if exists "todos ven los ganadores del pozo" on public.pozo_ganadores;
create policy "todos ven los ganadores del pozo" on public.pozo_ganadores for select to anon, authenticated using (true);

create or replace function public.timba_jugar(juego text, apuesta integer, premio integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; saldo integer; tope integer; maxap integer; pct numeric; cada numeric; base bigint; aporte bigint; elpozo bigint; gana bigint := 0; nom text;
begin
  if auth.uid() is null then raise exception 'Necesitas un perfil en la nube' using errcode = '42501'; end if;
  select valor into cfg from public.config where clave = 'timba';
  if cfg is not null and not coalesce((cfg ->> 'activo')::boolean, true) then return jsonb_build_object('ok', false, 'motivo', 'cerrado'); end if;
  maxap := least(greatest(coalesce((cfg ->> 'maxApuesta')::integer, 2000), 10), 50000);
  if timba_jugar.juego not in ('ruleta', 'tragamonedas', 'bingo', 'blackjack') or apuesta < 0 or premio < 0 or apuesta > 50000
     or (timba_jugar.juego <> 'bingo' and (apuesta < 1 or apuesta > maxap)) then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;
  tope := case timba_jugar.juego when 'ruleta' then apuesta * 36 when 'tragamonedas' then apuesta * 1000 when 'blackjack' then apuesta * 3 else 50000 end;
  if premio > tope then return jsonb_build_object('ok', false, 'motivo', 'premio'); end if;
  select p.monedas, p.nombre into saldo, nom from public.perfiles p where p.id = auth.uid() for update;
  if saldo is null then raise exception 'Necesitas un perfil en la nube' using errcode = '42501'; end if;
  if saldo < apuesta then return jsonb_build_object('ok', false, 'motivo', 'saldo', 'monedas', saldo); end if;
  -- El pozo: suma su parte de la apuesta y se sortea
  pct := least(greatest(coalesce((cfg ->> 'pozoPct')::numeric, 2), 0), 50);
  cada := greatest(coalesce((cfg ->> 'pozoCada')::numeric, 300000), 1000);
  base := least(greatest(coalesce((cfg ->> 'pozoBase')::bigint, 2000), 0), 1000000);
  select monto into elpozo from public.pozo where id = 1 for update;
  if elpozo is null then insert into public.pozo (id, monto) values (1, base) on conflict do nothing; elpozo := base; end if;
  if apuesta > 0 then
    aporte := ceil(apuesta * pct / 100);
    elpozo := elpozo + aporte;
    if timba_jugar.juego = 'tragamonedas' and random() < apuesta / cada then
      gana := elpozo; elpozo := base;
      update public.pozo set ganador = nom, ganado = gana, juego = timba_jugar.juego, cuando = now() where id = 1;
      insert into public.pozo_ganadores (usuario, nombre, monto, juego) values (auth.uid(), nom, gana, timba_jugar.juego);
    end if;
    update public.pozo set monto = elpozo where id = 1;
  end if;
  perform set_config('impostor.ajuste', '1', true);
  update public.perfiles p set monedas = least(2000000000, p.monedas::bigint - apuesta + premio + gana)::integer where p.id = auth.uid() returning p.monedas into saldo;
  perform set_config('impostor.ajuste', '0', true);
  insert into public.actividad (usuario, tipo, juego, monedas) values (auth.uid(), 'timba', timba_jugar.juego, (premio + gana - apuesta)::integer);
  return jsonb_build_object('ok', true, 'monedas', saldo, 'pozo', elpozo, 'ganoPozo', gana);
end $$;

-- Panel: cómo le va a la gente en el casino
create or replace function public.panel_timba(dias integer default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare desde timestamptz := now() - make_interval(days => least(greatest(dias, 1), 90));
begin
  if not public.es_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return jsonb_build_object(
    'jugadas', (select count(*) from public.actividad where tipo = 'timba' and creado >= desde),
    'jugadores', (select count(distinct usuario) from public.actividad where tipo = 'timba' and creado >= desde),
    'neto', (select coalesce(sum(monedas), 0) from public.actividad where tipo = 'timba' and creado >= desde),
    'porJuego', (select coalesce(jsonb_object_agg(juego, jsonb_build_object('jugadas', n, 'neto', neto)), '{}'::jsonb) from (
      select juego, count(*) as n, sum(monedas) as neto from public.actividad where tipo = 'timba' and creado >= desde group by juego) x),
    'pozo', (select monto from public.pozo where id = 1),
    'ganadores', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select nombre, monto, juego, creado from public.pozo_ganadores order by creado desc limit 10) t));
end $$;

-- ============ Código de amigo, perfil público y cambio de nombre ============
-- Cada perfil tiene un código único de 6 letras y números (sin 0/O ni 1/I para que no se confundan).
-- Los amigos se guardan por id, así que los perfiles que ya existían no pierden ninguna amistad.
create or replace function public.nuevo_tag() returns text
language plpgsql volatile set search_path = public as $$
declare abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; t text;
begin
  loop
    t := '';
    for i in 1..6 loop t := t || substr(abc, 1 + floor(random() * 32)::integer, 1); end loop;
    exit when not exists (select 1 from public.perfiles where tag = t);
  end loop;
  return t;
end $$;
alter table public.perfiles add column if not exists tag text;
-- Público: cualquiera puede ver su tarjeta y encontrarlo por nombre. Si no, solo sus amigos (y se lo agrega con el código).
alter table public.perfiles add column if not exists publico boolean not null default false;
alter table public.perfiles add column if not exists cambios_nombre integer not null default 0;
update public.perfiles set tag = public.nuevo_tag() where tag is null;
alter table public.perfiles alter column tag set default public.nuevo_tag();
alter table public.perfiles alter column tag set not null;
create unique index if not exists perfiles_tag_idx on public.perfiles (tag);
create index if not exists perfiles_publico_idx on public.perfiles (publico) where publico;

-- Al crear el perfil el código lo pone el servidor (no se puede elegir uno)
create or replace function public.perfiles_alta() returns trigger
language plpgsql set search_path = public as $$ begin new.tag := public.nuevo_tag(); new.cambios_nombre := 0; return new; end $$;
drop trigger if exists perfiles_alta on public.perfiles;
create trigger perfiles_alta before insert on public.perfiles for each row execute function public.perfiles_alta();

-- Cambiar el nombre: cuesta 500 monedas (siempre el mismo precio; la app muestra el mismo número)
create or replace function public.cambiar_nombre(nuevo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare yo public.perfiles; precio constant integer := 500; n text := btrim(coalesce(nuevo, ''));
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  if char_length(n) < 2 or char_length(n) > 16 or n ~ '[<>]' then return jsonb_build_object('ok', false, 'motivo', 'nombre'); end if;
  select * into yo from public.perfiles where id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'perfil'); end if;
  if n = yo.nombre then return jsonb_build_object('ok', false, 'motivo', 'igual'); end if;
  if yo.monedas < precio then return jsonb_build_object('ok', false, 'motivo', 'monedas', 'monedas', yo.monedas, 'precio', precio); end if;
  perform set_config('impostor.ajuste', '1', true);
  update public.perfiles set nombre = n, monedas = monedas - precio, cambios_nombre = cambios_nombre + 1 where id = yo.id returning * into yo;
  perform set_config('impostor.ajuste', '0', true);
  insert into public.actividad (usuario, tipo, juego, monedas) values (yo.id, 'compra', 'nombre', -precio);
  if to_regclass('public.compras') is not null then
    insert into public.compras (usuario, tipo, item, nombre, precio) values (yo.id, 'nombre', 'nombre', 'Cambio de nombre a ' || n, precio);
  end if;
  return jsonb_build_object('ok', true, 'nombre', yo.nombre, 'monedas', yo.monedas, 'precio', precio);
end $$;

-- Tarjeta de un perfil (por id o por código). Completa si es público, si es amigo o si es uno mismo;
-- si es privado, solo nombre, personaje y código (para poder mandarle la solicitud).
create or replace function public.tarjeta(quien uuid default null, codigo text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.perfiles; amigo boolean; c text := upper(regexp_replace(coalesce(codigo, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if quien is not null then select * into p from public.perfiles where id = quien;
  else select * into p from public.perfiles where tag = c; end if;
  if not found then return null; end if;
  amigo := exists (select 1 from public.amistades a where a.estado = 'aceptada'
    and ((a.de = auth.uid() and a.para = p.id) or (a.para = auth.uid() and a.de = p.id)));
  if p.publico or amigo or p.id = auth.uid() then
    return jsonb_build_object('id', p.id, 'nombre', p.nombre, 'look', p.look, 'tag', p.tag, 'publico', p.publico, 'completa', true, 'amigo', amigo,
      'puntos', p.puntos, 'racha', p.racha, 'mejor_racha', p.mejor_racha, 'stats', p.stats, 'logros', p.logros, 'creado', p.creado,
      'arena', p.diario -> 'arena', 'torre', p.diario -> 'torre');
  end if;
  return jsonb_build_object('id', p.id, 'nombre', p.nombre, 'look', p.look, 'tag', p.tag, 'publico', false, 'completa', false, 'amigo', false, 'puntos', p.puntos);
end $$;

-- ============ Tienda: precios, disponibilidad y estadísticas de compras ============
-- Precios y lo que no está a la venta se guardan en config 'catalogo': {"precio": {"<id>": n}, "oculto": {"<id>": true}}
-- Ids: los de la tienda (cab-…, car-…, col-…, mar-…, tit-…, mas-…), "skin:<id>", "tier:<0-8>" (equipo de la Arena) y "torre:vida".
insert into public.config (clave, valor) values ('catalogo', '{"precio": {}, "oculto": {}}') on conflict do nothing;

-- Cada compra: qué, quién, cuánto y cuándo (la app la anota al comprar)
create table if not exists public.compras (
  id       bigint generated always as identity primary key,
  usuario  uuid not null references public.perfiles (id) on delete cascade,
  tipo     text not null check (char_length(tipo) between 1 and 20),
  item     text not null check (char_length(item) between 1 and 40),
  nombre   text check (char_length(nombre) <= 60),
  precio   integer not null default 0 check (precio between 0 and 100000),
  creado   timestamptz not null default now()
);
create index if not exists compras_creado_idx on public.compras (creado desc);
create index if not exists compras_item_idx on public.compras (item);
alter table public.compras enable row level security;
grant select, insert on public.compras to authenticated;
drop policy if exists "anotar mis compras" on public.compras;
create policy "anotar mis compras" on public.compras for insert to authenticated with check (usuario = auth.uid());
drop policy if exists "ver mis compras" on public.compras;
create policy "ver mis compras" on public.compras for select to authenticated using (usuario = auth.uid() or public.es_admin());

-- Panel: qué se vende, cuánto deja y quién compra (en los últimos días), y cuántos tienen cada cosa (desde siempre)
create or replace function public.panel_compras(dias integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare desde timestamptz := now() - make_interval(days => least(greatest(dias, 1), 365));
begin
  if not public.es_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return jsonb_build_object(
    'compras', (select count(*) from public.compras where creado >= desde),
    'monedas', (select coalesce(sum(precio), 0) from public.compras where creado >= desde),
    'compradores', (select count(distinct usuario) from public.compras where creado >= desde),
    'porTipo', (select coalesce(jsonb_object_agg(tipo, jsonb_build_object('n', n, 'monedas', m)), '{}'::jsonb) from (
      select tipo, count(*) as n, sum(precio) as m from public.compras where creado >= desde group by tipo) x),
    'porItem', (select coalesce(jsonb_object_agg(item, jsonb_build_object('n', n, 'monedas', m, 'nombre', nom)), '{}'::jsonb) from (
      select item, count(*) as n, sum(precio) as m, max(nombre) as nom from public.compras where creado >= desde group by item) x),
    'top', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select p.id, p.nombre, p.look, count(*) as n, sum(c.precio) as monedas from public.compras c join public.perfiles p on p.id = c.usuario
      where c.creado >= desde group by p.id order by sum(c.precio) desc limit 10) t),
    'ultimas', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select c.item, c.nombre as que, c.tipo, c.precio, c.creado, p.nombre, p.look from public.compras c join public.perfiles p on p.id = c.usuario
      order by c.creado desc limit 40) t),
    'duenos', (select coalesce(jsonb_object_agg(item, n), '{}'::jsonb) from (
      select item, count(*) as n from (
        select x as item from public.perfiles, jsonb_array_elements_text(case when jsonb_typeof(inventario) = 'array' then inventario else '[]'::jsonb end) x
        union all
        select 'skin:' || x from public.perfiles, jsonb_array_elements_text(case when jsonb_typeof(diario -> 'arena' -> 'skins') = 'array' then diario -> 'arena' -> 'skins' else '[]'::jsonb end) x
      ) todo group by item) y)
  );
end $$;

-- Panel: quiénes tienen una cosa (y cuándo la compraron, si la compra quedó anotada)
create or replace function public.panel_duenos(cual text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select p.id, p.nombre, p.look, p.monedas,
      (select max(c.creado) from public.compras c where c.usuario = p.id and c.item = cual) as cuando,
      (select c.precio from public.compras c where c.usuario = p.id and c.item = cual order by c.creado desc limit 1) as pago
    from public.perfiles p
    where (cual like 'skin:%' and jsonb_typeof(p.diario -> 'arena' -> 'skins') = 'array' and (p.diario -> 'arena' -> 'skins') ? substr(cual, 6))
       or (cual not like 'skin:%' and jsonb_typeof(p.inventario) = 'array' and p.inventario ? cual)
       or exists (select 1 from public.compras c where c.usuario = p.id and c.item = cual)
    order by cuando desc nulls last, p.nombre limit 300) t);
end $$;


-- ============ Notificaciones push (mensajes, invitaciones, amistades y recordatorios) ============
-- La función "notificar" (supabase/functions/notificar) manda las notificaciones. Esto guarda los teléfonos
-- suscriptos y le avisa a la función cuando llega un mensaje o una solicitud de amistad, y una vez por día.
create table if not exists public.push_subs (
  endpoint  text primary key check (char_length(endpoint) < 800),
  usuario   uuid not null references public.perfiles (id) on delete cascade,
  p256dh    text not null check (char_length(p256dh) < 200),
  auth      text not null check (char_length(auth) < 100),
  prefs     jsonb not null default '{"mensajes": true, "recordatorios": true}'::jsonb,
  creado    timestamptz not null default now()
);
create index if not exists push_subs_usuario_idx on public.push_subs (usuario);
alter table public.push_subs enable row level security;
grant select, insert, update, delete on public.push_subs to authenticated;
drop policy if exists "mis suscripciones" on public.push_subs;
create policy "mis suscripciones" on public.push_subs for all to authenticated using (usuario = auth.uid()) with check (usuario = auth.uid());

-- Claves de la función (las genera ella sola). Sin políticas: solo la lee el servidor.
create table if not exists public.push_cfg (
  id                   integer primary key default 1 check (id = 1),
  publica              text,
  privada              text,
  ultimo_recordatorio  text
);
alter table public.push_cfg enable row level security;

alter table public.mensajes add column if not exists notificado boolean not null default false;

-- Avisos a la función al insertar (pg_net hace la llamada sin frenar el insert)
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net no disponible: %', sqlerrm; end $$;
create or replace function public.push_avisar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://brvpaoerqcioqxeirxmq.supabase.co/functions/v1/smooth-function',
    body := case when tg_table_name = 'mensajes' then jsonb_build_object('tipo', 'mensaje', 'id', new.id)
                 else jsonb_build_object('tipo', 'amistad', 'de', new.de, 'para', new.para) end,
    headers := '{"Content-Type": "application/json"}'::jsonb);
  return new;
exception when others then return new;          -- si falla la notificación, el mensaje se guarda igual
end $$;
drop trigger if exists push_mensajes on public.mensajes;
create trigger push_mensajes after insert on public.mensajes for each row execute function public.push_avisar();
drop trigger if exists push_amistades on public.amistades;
create trigger push_amistades after insert on public.amistades for each row execute function public.push_avisar();

-- Recordatorio diario a las 18:30 de Argentina (21:30 UTC)
do $$ begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'mesa-recordatorios') then perform cron.unschedule('mesa-recordatorios'); end if;
  perform cron.schedule('mesa-recordatorios', '30 21 * * *',
    $c$select net.http_post(url := 'https://brvpaoerqcioqxeirxmq.supabase.co/functions/v1/smooth-function', body := '{"tipo": "recordatorios"}'::jsonb, headers := '{"Content-Type": "application/json"}'::jsonb)$c$);
exception when others then raise notice 'pg_cron no disponible: %', sqlerrm;
end $$;

-- ============ Ligas semanales (js/misiones.js) ============
-- Cada perfil guarda en diario.liga: { semana: 'AAAA-MM-DD' (el lunes, hora de Argentina), tier: 0 Bronce … 5 Leyenda, lp,
--   ant: { semana, tier, lp } (la semana anterior, para poder armar los grupos viejos aunque ya haya empezado otra) }.
-- Grupos: los de la misma liga esa semana con al menos 1 LP, mezclados por md5(id || semana) y cortados de a 20.
create index if not exists perfiles_liga_semana_idx on public.perfiles ((diario -> 'liga' ->> 'semana'));
create index if not exists perfiles_liga_ant_idx on public.perfiles ((diario -> 'liga' -> 'ant' ->> 'semana'));

-- Grupo de un jugador en una semana (uso interno: solo nombre, personaje, LP y liga)
create or replace function public.liga_grupo_de(quien uuid, cual text) returns jsonb
language sql stable security definer set search_path = public as $$
  with sem as (
    select p.id, p.nombre, p.look,
      case when p.diario -> 'liga' ->> 'semana' = cual then p.diario -> 'liga' else p.diario -> 'liga' -> 'ant' end as l
    from public.perfiles p
    where p.diario -> 'liga' ->> 'semana' = cual or p.diario -> 'liga' -> 'ant' ->> 'semana' = cual
  ), jug as (
    select id, nombre, look,
      case when l ->> 'lp' ~ '^\d{1,9}$' then least((l ->> 'lp')::integer, 100000) else 0 end as lp,
      case when l ->> 'tier' ~ '^[0-5]$' then (l ->> 'tier')::integer else 0 end as tier
    from sem
  ), activos as (select * from jug where lp > 0 or id = quien),
  num as (
    select a.*, (row_number() over (order by md5(a.id::text || cual)) - 1) / 20 as grupo
    from activos a where a.tier = (select tier from activos where id = quien)
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'look', look, 'lp', lp, 'tier', tier) order by lp desc, nombre, id), '[]'::jsonb)
  from num where grupo = (select grupo from num where id = quien)
$$;
revoke execute on function public.liga_grupo_de(uuid, text) from public;
do $$ begin revoke execute on function public.liga_grupo_de(uuid, text) from anon, authenticated; exception when others then null; end $$;

-- Mi grupo de esta semana
create or replace function public.liga_grupo(semana text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or semana !~ '^\d{4}-\d{2}-\d{2}$' then '[]'::jsonb else public.liga_grupo_de(auth.uid(), semana) end
$$;

-- Posición final de un jugador en una semana: { pos, n (con al menos 1 LP), lp, tier }
create or replace function public.liga_pos(quien uuid, cual text) returns jsonb
language sql stable security definer set search_path = public as $$
  with g as (select x, o from jsonb_array_elements(public.liga_grupo_de(quien, cual)) with ordinality as t(x, o))
  select case when not exists (select 1 from g where x ->> 'id' = quien::text) then null else jsonb_build_object(
    'pos', (select o from g where x ->> 'id' = quien::text),
    'n', (select count(*) from g where (x ->> 'lp')::integer > 0 or x ->> 'id' = quien::text),
    'lp', (select (x ->> 'lp')::integer from g where x ->> 'id' = quien::text),
    'tier', (select (x ->> 'tier')::integer from g where x ->> 'id' = quien::text)) end
$$;
revoke execute on function public.liga_pos(uuid, text) from public;
do $$ begin revoke execute on function public.liga_pos(uuid, text) from anon, authenticated; grant execute on function public.liga_pos(uuid, text) to service_role; exception when others then null; end $$;

-- Cómo terminé la semana pasada (para subir o bajar de liga)
create or replace function public.liga_resultado(semana text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or semana !~ '^\d{4}-\d{2}-\d{2}$' then null else public.liga_pos(auth.uid(), semana) end
$$;

-- Panel: cuántos jugadores hay en cada liga esta semana (con al menos 1 LP)
create or replace function public.panel_ligas(semana text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return (select coalesce(jsonb_object_agg(tier, n), '{}'::jsonb) from (
    select case when diario -> 'liga' ->> 'tier' ~ '^[0-5]$' then (diario -> 'liga' ->> 'tier')::integer else 0 end as tier, count(*) as n
    from public.perfiles
    where diario -> 'liga' ->> 'semana' = semana and diario -> 'liga' ->> 'lp' ~ '^\d{1,9}$' and (diario -> 'liga' ->> 'lp')::integer > 0
    group by 1) t);
end $$;


--
-- Nadie puede escribir esta tabla directamente: todo pasa por funciones del servidor que controlan
-- los valores (topes por partida, que no se cobre dos veces la misma partida, que no se gaste más de lo
-- que hay, equipos válidos). Cada uno puede leer su fila; el ranking ve solo números públicos.

create table if not exists public.golpe_cuentas (
  id          uuid primary key references public.perfiles (id) on delete cascade,
  plata       bigint not null default 0 check (plata >= 0),
  kit         jsonb not null default '{"arma": null, "chaleco": 0, "bolso": 10}'::jsonb,
  guarida     jsonb not null default '[]'::jsonb check (jsonb_typeof(guarida) = 'array' and jsonb_array_length(guarida) <= 60),
  xp          integer not null default 0 check (xp >= 0),
  golpes      integer not null default 0,
  escapes     integer not null default 0,
  mejor       integer not null default 0,
  partidas    jsonb not null default '[]'::jsonb check (jsonb_typeof(partidas) = 'array' and jsonb_array_length(partidas) <= 60),
  importado   boolean not null default false,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
alter table public.golpe_cuentas enable row level security;
drop policy if exists "ver mi cuenta de golpe" on public.golpe_cuentas;
create policy "ver mi cuenta de golpe" on public.golpe_cuentas for select to authenticated using (id = auth.uid() or public.es_admin());
-- Sin políticas de insert/update/delete: solo las funciones de abajo (security definer) la cambian.

-- Equipo de ladrón válido: arma conocida con rareza 0 a 4 (o ninguna), chaleco 0 a 3, bolso 10/14/18/24
create or replace function public.golpe_kit_valido(k jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare arma jsonb := null; ch integer := 0; bo integer := 10;
begin
  if k is null or jsonb_typeof(k) <> 'object' then return '{"arma": null, "chaleco": 0, "bolso": 10}'::jsonb; end if;
  if jsonb_typeof(k -> 'arma') = 'object' and (k -> 'arma' ->> 'a') in ('pistola', 'subfusil', 'escopeta', 'rifle') then
    arma := jsonb_build_object('a', k -> 'arma' ->> 'a', 'r', least(greatest(coalesce((k -> 'arma' ->> 'r')::integer, 0), 0), 4));
  end if;
  ch := least(greatest(coalesce((k ->> 'chaleco')::integer, 0), 0), 3);
  bo := coalesce((k ->> 'bolso')::integer, 10); if bo not in (10, 14, 18, 24) then bo := 10; end if;
  return jsonb_build_object('arma', arma, 'chaleco', ch, 'bolso', bo);
exception when others then return '{"arma": null, "chaleco": 0, "bolso": 10}'::jsonb;
end $$;

-- Estado de mi cuenta (la crea si no existe). La primera vez se puede traer lo que había en el teléfono, con topes.
create or replace function public.golpe_estado(importar jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.golpe_cuentas;
begin
  if auth.uid() is null or not exists (select 1 from public.perfiles where id = auth.uid()) then
    raise exception 'Necesitas un perfil en la nube' using errcode = '42501';
  end if;
  insert into public.golpe_cuentas (id) values (auth.uid()) on conflict (id) do nothing;
  select * into c from public.golpe_cuentas where id = auth.uid() for update;
  if not c.importado and importar is not null and jsonb_typeof(importar) = 'object' then
    update public.golpe_cuentas set
      plata = least(greatest(coalesce((importar ->> 'plata')::bigint, 0), 0), 20000),
      kit = (select case when k -> 'arma' <> 'null'::jsonb then jsonb_set(k, '{arma,r}', to_jsonb(least((k -> 'arma' ->> 'r')::integer, 2))) else k end from (select public.golpe_kit_valido(importar -> 'kit') k) x),
      xp = least(greatest(coalesce((importar ->> 'xp')::integer, 0), 0), 40),
      importado = true, actualizado = now()
    where id = auth.uid() returning * into c;
  elsif not c.importado then
    update public.golpe_cuentas set importado = true where id = auth.uid() returning * into c;
  end if;
  return jsonb_build_object('ok', true, 'plata', c.plata, 'kit', c.kit, 'guarida', c.guarida, 'xp', c.xp, 'golpes', c.golpes, 'escapes', c.escapes, 'mejor', c.mejor);
end $$;

-- Resultado de una partida. Controles: cada partida se cobra una sola vez; hasta $30.000 ganados y 40
-- arrestos por partida; no se puede gastar más de lo que había más lo ganado; guarida de hasta 24 cosas
-- de hasta $5.000 cada una. kit: el equipo con el que queda (null = lo perdió todo; ausente = sin cambios).
create or replace function public.golpe_resultado(partida text, rol text, escapo boolean, plata integer, gasto integer, kit jsonb default 'null'::jsonb, perdio boolean default false, guarida jsonb default '[]'::jsonb, arrestos integer default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.golpe_cuentas; gana integer; gas integer; arr integer; nueva jsonb := '[]'::jsonb; it jsonb; n integer := 0; nuevoKit jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.perfiles where id = auth.uid()) then
    raise exception 'Necesitas un perfil en la nube' using errcode = '42501';
  end if;
  if partida is null or char_length(partida) not between 4 and 40 or rol not in ('ladron', 'policia', 'civil') then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;
  insert into public.golpe_cuentas (id, importado) values (auth.uid(), true) on conflict (id) do nothing;
  select * into c from public.golpe_cuentas where id = auth.uid() for update;
  if c.partidas ? partida then return jsonb_build_object('ok', false, 'motivo', 'repetida', 'plata', c.plata); end if;
  gana := least(greatest(coalesce(plata, 0), 0), 30000);
  gas := greatest(coalesce(gasto, 0), 0);
  if gas > c.plata + gana then return jsonb_build_object('ok', false, 'motivo', 'gasto', 'plata', c.plata); end if;
  arr := case when rol = 'policia' then least(greatest(coalesce(arrestos, 0), 0), 40) else 0 end;
  -- Lo sacado sin vender (solo un ladrón que escapó)
  if rol = 'ladron' and escapo and jsonb_typeof(guarida) = 'array' then
    for it in select * from jsonb_array_elements(guarida) loop
      exit when n >= 24;
      if jsonb_typeof(it) = 'object' then
        nueva := nueva || jsonb_build_array(jsonb_build_object(
          'a', least(greatest(coalesce((it ->> 'a')::integer, 0), 0), 11),
          'r', least(greatest(coalesce((it ->> 'r')::integer, 0), 0), 4),
          'v', least(greatest(coalesce((it ->> 'v')::integer, 0), 0), 5000)));
        n := n + 1;
      end if;
    end loop;
  end if;
  nuevoKit := case when perdio then '{"arma": null, "chaleco": 0, "bolso": 10}'::jsonb
                   when kit is null or jsonb_typeof(kit) = 'null' then c.kit
                   else public.golpe_kit_valido(kit) end;
  update public.golpe_cuentas g set
    plata = g.plata + gana - gas,
    kit = nuevoKit,
    guarida = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from (select e, i from jsonb_array_elements(g.guarida || nueva) with ordinality as x(e, i) order by i desc limit 60) s),
    xp = g.xp + arr,
    golpes = g.golpes + 1,
    escapes = g.escapes + case when escapo and rol = 'ladron' then 1 else 0 end,
    mejor = greatest(g.mejor, case when rol = 'ladron' and escapo then gana else 0 end),
    partidas = (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(jsonb_build_array(partida) || g.partidas) with ordinality as x(e, i) order by i limit 60) s),
    actualizado = now()
  where g.id = auth.uid() returning * into c;
  insert into public.actividad (usuario, tipo, juego, monedas) values (auth.uid(), 'golpe', rol, gana - gas);
  return jsonb_build_object('ok', true, 'plata', c.plata, 'kit', c.kit, 'guarida', c.guarida, 'xp', c.xp, 'golpes', c.golpes, 'escapes', c.escapes, 'mejor', c.mejor);
end $$;

-- Vender lo de la guarida a mitad de precio (el reducidor de la ciudad paga el doble)
create or replace function public.golpe_vender_guarida() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.golpe_cuentas; total integer;
begin
  if auth.uid() is null then raise exception 'Necesitas un perfil en la nube' using errcode = '42501'; end if;
  select * into c from public.golpe_cuentas where id = auth.uid() for update;
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'sin cuenta'); end if;
  select coalesce(sum(least(greatest((e ->> 'v')::integer, 0), 5000)), 0) into total from jsonb_array_elements(c.guarida) e;
  total := (round(total * 0.5 / 10) * 10)::integer;
  update public.golpe_cuentas set plata = plata + total, guarida = '[]'::jsonb, actualizado = now() where id = auth.uid() returning * into c;
  return jsonb_build_object('ok', true, 'vendido', total, 'plata', c.plata, 'kit', c.kit, 'guarida', c.guarida, 'xp', c.xp);
end $$;

-- Ranking de Golpe (solo números públicos y el nombre del perfil)
create or replace function public.golpe_ranking(cuantos integer default 50) returns jsonb
language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(f), '[]'::jsonb) from (
    select p.nombre, p.look, g.plata, g.escapes, g.mejor, g.xp
    from public.golpe_cuentas g join public.perfiles p on p.id = g.id
    order by g.plata desc limit least(greatest(cuantos, 1), 100)) f;
$$;

revoke all on function public.golpe_estado(jsonb) from public, anon;
revoke all on function public.golpe_resultado(text, text, boolean, integer, integer, jsonb, boolean, jsonb, integer) from public, anon;
revoke all on function public.golpe_vender_guarida() from public, anon;
grant execute on function public.golpe_estado(jsonb) to authenticated;
grant execute on function public.golpe_resultado(text, text, boolean, integer, integer, jsonb, boolean, jsonb, integer) to authenticated;
grant execute on function public.golpe_vender_guarida() to authenticated;
grant execute on function public.golpe_ranking(integer) to anon, authenticated;

-- ============ Fichas para partidas online ============
-- Al entrar a una partida, cada jugador pide una ficha de un solo uso y se la pasa al anfitrión. El anfitrión la
-- canjea y recibe el equipo, la experiencia, el clan y la plata reales de ese jugador. Así nadie puede inventar su
-- equipo ni hacerse pasar por otro, y el anfitrión nunca recibe la sesión de nadie. Las fichas vencen a los 10 minutos.
create table if not exists public.golpe_fichas (
  ficha   text primary key,
  usuario uuid not null references public.golpe_cuentas (id) on delete cascade,
  creado  timestamptz not null default now()
);
alter table public.golpe_fichas enable row level security;   -- sin políticas: nadie la lee ni escribe directo

create or replace function public.golpe_ficha() returns text
language plpgsql security definer set search_path = public as $$
declare f text;
begin
  if auth.uid() is null or not exists (select 1 from public.perfiles where id = auth.uid()) then
    raise exception 'Necesitas un perfil en la nube' using errcode = '42501';
  end if;
  insert into public.golpe_cuentas (id, importado) values (auth.uid(), true) on conflict (id) do nothing;
  delete from public.golpe_fichas where creado < now() - interval '10 minutes' or usuario = auth.uid();
  f := md5(random()::text || clock_timestamp()::text || auth.uid()::text);
  insert into public.golpe_fichas (ficha, usuario) values (f, auth.uid());
  return f;
end $$;

create or replace function public.golpe_canjear(fichas text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb := '{}'::jsonb; r record;
begin
  if auth.uid() is null then raise exception 'Necesitas un perfil en la nube' using errcode = '42501'; end if;
  if array_length(fichas, 1) > 8 then return res; end if;
  for r in
    delete from public.golpe_fichas f using public.golpe_cuentas g
    where f.ficha = any (fichas) and f.creado >= now() - interval '10 minutes' and g.id = f.usuario
    returning f.ficha, g.kit, g.xp, g.plata,
      (select k.tag from public.golpe_clan_miembros m join public.golpe_clanes k on k.id = m.clan where m.usuario = g.id) as tag
  loop
    res := res || jsonb_build_object(r.ficha, jsonb_build_object('kit', r.kit, 'xp', r.xp, 'banco', r.plata, 'clan', r.tag));
  end loop;
  return res;
end $$;

revoke all on function public.golpe_ficha() from public, anon;
revoke all on function public.golpe_canjear(text[]) from public, anon;
grant execute on function public.golpe_ficha() to authenticated;
grant execute on function public.golpe_canjear(text[]) to authenticated;
