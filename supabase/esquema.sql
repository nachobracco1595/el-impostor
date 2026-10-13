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
alter table public.perfiles add column if not exists pts_ajedrez  integer generated always as (coalesce((stats -> 'ajedrez' ->> 'p')::integer, 0)) stored;

create index if not exists perfiles_puntos_idx on public.perfiles (puntos desc);
create index if not exists perfiles_impostor_idx on public.perfiles (pts_impostor desc);
create index if not exists perfiles_liars_idx on public.perfiles (pts_liars desc);
create index if not exists perfiles_casos_idx on public.perfiles (pts_casos desc);
create index if not exists perfiles_chinchon_idx on public.perfiles (pts_chinchon desc);
create index if not exists perfiles_naval_idx on public.perfiles (pts_naval desc);
create index if not exists perfiles_ajedrez_idx on public.perfiles (pts_ajedrez desc);

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
