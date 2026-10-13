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
  tipo     text not null check (tipo in ('partida', 'ingreso', 'compra', 'mision', 'anuncio', 'regalo')),
  juego    text check (char_length(juego) <= 20),
  puntos   integer not null default 0,
  monedas  integer not null default 0,
  creado   timestamptz not null default now()
);
create index if not exists actividad_creado_idx on public.actividad (creado);
create index if not exists actividad_usuario_idx on public.actividad (usuario, creado);
alter table public.actividad enable row level security;
drop policy if exists "anotar mi actividad" on public.actividad;
create policy "anotar mi actividad" on public.actividad for insert to authenticated
  with check (auth.uid() = usuario and tipo in ('partida', 'ingreso', 'compra', 'mision') and monedas between -1000 and 500 and puntos between 0 and 500);
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

-- Regalos de monedas que manda el admin; el jugador los cobra al entrar
create table if not exists public.regalos (
  id       bigint generated always as identity primary key,
  usuario  uuid not null references public.perfiles (id) on delete cascade,
  monedas  integer not null check (monedas between 1 and 500),
  motivo   text check (char_length(motivo) <= 80),
  cobrado  boolean not null default false,
  creado   timestamptz not null default now()
);
alter table public.regalos enable row level security;   -- solo se usa con las funciones de abajo

create or replace function public.cobrar_regalos() returns jsonb
language plpgsql security definer set search_path = public as $$
declare total integer; motivos text;
begin
  if auth.uid() is null then return jsonb_build_object('monedas', 0); end if;
  with r as (update public.regalos set cobrado = true where usuario = auth.uid() and not cobrado returning monedas, motivo)
  select coalesce(sum(monedas), 0), string_agg(motivo, ' · ') into total, motivos from r;
  if total > 0 then insert into public.actividad (usuario, tipo, monedas) values (auth.uid(), 'regalo', least(total, 500)); end if;
  return jsonb_build_object('monedas', least(total, 500), 'motivo', motivos);
end $$;

create or replace function public.admin_regalar(destino uuid, cantidad integer, motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if cantidad < 1 or cantidad > 500 then raise exception 'Entre 1 y 500 monedas' using errcode = '22023'; end if;
  insert into public.regalos (usuario, monedas, motivo) values (destino, cantidad, left(motivo, 80));
  return jsonb_build_object('ok', true);
end $$;

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
