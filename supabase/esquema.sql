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
