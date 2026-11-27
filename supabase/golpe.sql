-- Golpe: plata, equipo de ladrón, guarida y carrera policial de cada jugador, guardados en la nube.
-- Pegar en Supabase → SQL Editor → New query → Run. Se puede correr más de una vez.
-- (También está al final de esquema.sql.)
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

-- ============ Terrenos en otras ciudades y clanes ============
-- 3 ciudades con lotes limitados (el cupo de vecinos). Cada ciudad tiene 4 zonas; una zona la controla el clan
-- con más terrenos en ella (mínimo 2; si empatan, el que llegó primero). Cada terreno paga renta diaria y cada
-- zona controlada por tu clan suma $500 por día. Hasta 2 terrenos por persona. Vender devuelve el 70%.

alter table public.golpe_cuentas add column if not exists renta_dia date;

create or replace function public.golpe_ciudad(c text) returns jsonb
language sql immutable as $$
  select case c
    when 'villa'  then '{"nombre": "Villa Norte", "lotes": 16, "precio": 15000, "renta": 300}'::jsonb
    when 'puerto' then '{"nombre": "Puerto Sur", "lotes": 16, "precio": 30000, "renta": 600}'::jsonb
    when 'alto'   then '{"nombre": "Barrio Alto", "lotes": 12, "precio": 60000, "renta": 1200}'::jsonb
    else null end;
$$;

create table if not exists public.golpe_terrenos (
  ciudad   text not null check (ciudad in ('villa', 'puerto', 'alto')),
  lote     integer not null check (lote between 1 and 16),
  dueno    uuid not null references public.golpe_cuentas (id) on delete cascade,
  precio   integer not null,
  comprado timestamptz not null default now(),
  primary key (ciudad, lote)
);
create index if not exists golpe_terrenos_dueno_idx on public.golpe_terrenos (dueno);

create table if not exists public.golpe_clanes (
  id      bigserial primary key,
  nombre  text not null unique check (char_length(nombre) between 3 and 20),
  tag     text not null unique check (tag ~ '^[A-Z0-9]{2,4}$'),
  lider   uuid not null references public.golpe_cuentas (id) on delete cascade,
  codigo  text not null unique,
  creado  timestamptz not null default now()
);
create table if not exists public.golpe_clan_miembros (
  usuario uuid primary key references public.golpe_cuentas (id) on delete cascade,
  clan    bigint not null references public.golpe_clanes (id) on delete cascade,
  desde   timestamptz not null default now()
);
create index if not exists golpe_clan_miembros_clan_idx on public.golpe_clan_miembros (clan);

alter table public.golpe_terrenos enable row level security;
alter table public.golpe_clanes enable row level security;
alter table public.golpe_clan_miembros enable row level security;
-- Todos ven quién tiene cada terreno y qué clanes hay (sin el código de invitación); nadie escribe directo.
drop policy if exists "ver terrenos" on public.golpe_terrenos;
create policy "ver terrenos" on public.golpe_terrenos for select using (true);
drop policy if exists "ver miembros" on public.golpe_clan_miembros;
create policy "ver miembros" on public.golpe_clan_miembros for select using (true);
-- golpe_clanes no tiene política de lectura: el código de invitación solo lo ven los miembros (vía golpe_mundo).

-- Zona de un lote: 4 zonas por ciudad, lotes repartidos en orden
create or replace function public.golpe_zona(c text, lote integer) returns integer
language sql immutable as $$ select ((lote - 1) * 4 / ((public.golpe_ciudad(c) ->> 'lotes')::integer)) + 1 $$;

-- Qué clan controla cada zona
create or replace function public.golpe_zonas() returns table (ciudad text, zona integer, clan bigint, terrenos bigint)
language sql stable security definer set search_path = public as $$
  select distinct on (t.ciudad, public.golpe_zona(t.ciudad, t.lote)) t.ciudad, public.golpe_zona(t.ciudad, t.lote) as zona, m.clan, count(*) as terrenos
  from public.golpe_terrenos t join public.golpe_clan_miembros m on m.usuario = t.dueno
  group by t.ciudad, public.golpe_zona(t.ciudad, t.lote), m.clan
  having count(*) >= 2
  order by t.ciudad, public.golpe_zona(t.ciudad, t.lote), count(*) desc, min(t.comprado);
$$;

-- Todo lo que muestra la pantalla de ciudades: lotes, zonas, mi clan y mi renta
create or replace function public.golpe_mundo() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare yo uuid := auth.uid(); miClan bigint; res jsonb;
begin
  select clan into miClan from public.golpe_clan_miembros where usuario = yo;
  res := jsonb_build_object(
    'lotes', (select coalesce(jsonb_agg(jsonb_build_object('c', t.ciudad, 'l', t.lote, 'precio', t.precio, 'yo', t.dueno = yo, 'nombre', p.nombre, 'tag', k.tag)), '[]'::jsonb)
              from public.golpe_terrenos t join public.perfiles p on p.id = t.dueno
              left join public.golpe_clan_miembros m on m.usuario = t.dueno left join public.golpe_clanes k on k.id = m.clan),
    'zonas', (select coalesce(jsonb_agg(jsonb_build_object('c', z.ciudad, 'z', z.zona, 'tag', k.tag, 'nombre', k.nombre, 'n', z.terrenos, 'mia', z.clan = miClan)), '[]'::jsonb)
              from public.golpe_zonas() z join public.golpe_clanes k on k.id = z.clan),
    'clanes', (select coalesce(jsonb_agg(jsonb_build_object('tag', k.tag, 'nombre', k.nombre, 'miembros', (select count(*) from public.golpe_clan_miembros m where m.clan = k.id)) order by k.creado), '[]'::jsonb) from public.golpe_clanes k),
    'clan', case when miClan is null then null else (select jsonb_build_object('id', k.id, 'nombre', k.nombre, 'tag', k.tag, 'codigo', k.codigo, 'lider', k.lider = yo,
              'miembros', (select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'lider', m.usuario = k.lider) order by m.desde), '[]'::jsonb) from public.golpe_clan_miembros m join public.perfiles p on p.id = m.usuario where m.clan = k.id))
              from public.golpe_clanes k where k.id = miClan) end,
    'renta', (select jsonb_build_object('cobrada', g.renta_dia = (now() at time zone 'America/Argentina/Buenos_Aires')::date) from public.golpe_cuentas g where g.id = yo)
  );
  return res;
end $$;

create or replace function public.golpe_comprar_terreno(ciudad text, lote integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.golpe_ciudad(golpe_comprar_terreno.ciudad); saldo bigint; precio integer;
begin
  if auth.uid() is null then raise exception 'Necesitas un perfil en la nube' using errcode = '42501'; end if;
  if cfg is null or lote < 1 or lote > (cfg ->> 'lotes')::integer then return jsonb_build_object('ok', false, 'motivo', 'datos'); end if;
  select plata into saldo from public.golpe_cuentas where id = auth.uid() for update;
  if saldo is null then return jsonb_build_object('ok', false, 'motivo', 'sin cuenta'); end if;
  if (select count(*) from public.golpe_terrenos where dueno = auth.uid()) >= 2 then return jsonb_build_object('ok', false, 'motivo', 'tope'); end if;
  if exists (select 1 from public.golpe_terrenos t where t.ciudad = golpe_comprar_terreno.ciudad and t.lote = golpe_comprar_terreno.lote) then return jsonb_build_object('ok', false, 'motivo', 'ocupado'); end if;
  precio := (cfg ->> 'precio')::integer;
  if saldo < precio then return jsonb_build_object('ok', false, 'motivo', 'plata', 'plata', saldo); end if;
  insert into public.golpe_terrenos (ciudad, lote, dueno, precio) values (golpe_comprar_terreno.ciudad, golpe_comprar_terreno.lote, auth.uid(), precio);
  update public.golpe_cuentas set plata = plata - precio, actualizado = now() where id = auth.uid() returning plata into saldo;
  insert into public.actividad (usuario, tipo, juego, monedas) values (auth.uid(), 'golpe-terreno', golpe_comprar_terreno.ciudad, -precio);
  return jsonb_build_object('ok', true, 'plata', saldo);
exception when unique_violation then return jsonb_build_object('ok', false, 'motivo', 'ocupado');
end $$;

create or replace function public.golpe_vender_terreno(ciudad text, lote integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr integer; saldo bigint;
begin
  if auth.uid() is null then raise exception 'Necesitas un perfil en la nube' using errcode = '42501'; end if;
  delete from public.golpe_terrenos t where t.ciudad = golpe_vender_terreno.ciudad and t.lote = golpe_vender_terreno.lote and t.dueno = auth.uid() returning t.precio into pr;
  if pr is null then return jsonb_build_object('ok', false, 'motivo', 'no es tuyo'); end if;
  update public.golpe_cuentas set plata = plata + (pr * 7 / 10), actualizado = now() where id = auth.uid() returning plata into saldo;
  return jsonb_build_object('ok', true, 'plata', saldo, 'recibido', pr * 7 / 10);
end $$;

-- Renta de hoy (día de Argentina): renta de cada terreno + $500 por cada zona que controla tu clan
create or replace function public.golpe_cobrar_renta() returns jsonb
language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date; ya date; r integer := 0; z integer := 0; miClan bigint; saldo bigint;
begin
  if auth.uid() is null then raise exception 'Necesitas un perfil en la nube' using errcode = '42501'; end if;
  select renta_dia into ya from public.golpe_cuentas where id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'sin cuenta'); end if;
  if ya = hoy then return jsonb_build_object('ok', false, 'motivo', 'cobrada'); end if;
  select coalesce(sum((public.golpe_ciudad(t.ciudad) ->> 'renta')::integer), 0) into r from public.golpe_terrenos t where t.dueno = auth.uid();
  select clan into miClan from public.golpe_clan_miembros where usuario = auth.uid();
  if miClan is not null then select count(*) * 500 into z from public.golpe_zonas() zz where zz.clan = miClan; end if;
  if r + z = 0 then return jsonb_build_object('ok', false, 'motivo', 'nada'); end if;
  update public.golpe_cuentas set plata = plata + r + z, renta_dia = hoy, actualizado = now() where id = auth.uid() returning plata into saldo;
  return jsonb_build_object('ok', true, 'plata', saldo, 'terrenos', r, 'zonas', z);
end $$;

create or replace function public.golpe_clan_crear(nombre text, tag text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare saldo bigint; nid bigint; cod text; n text := btrim(nombre); t text := upper(btrim(tag));
begin
  if auth.uid() is null then raise exception 'Necesitas un perfil en la nube' using errcode = '42501'; end if;
  if char_length(n) not between 3 and 20 or t !~ '^[A-Z0-9]{2,4}$' then return jsonb_build_object('ok', false, 'motivo', 'datos'); end if;
  if exists (select 1 from public.golpe_clan_miembros where usuario = auth.uid()) then return jsonb_build_object('ok', false, 'motivo', 'ya tenés clan'); end if;
  select plata into saldo from public.golpe_cuentas where id = auth.uid() for update;
  if saldo is null or saldo < 5000 then return jsonb_build_object('ok', false, 'motivo', 'plata'); end if;
  if exists (select 1 from public.golpe_clanes k where lower(k.nombre) = lower(n) or k.tag = t) then return jsonb_build_object('ok', false, 'motivo', 'nombre usado'); end if;
  cod := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.golpe_clanes (nombre, tag, lider, codigo) values (n, t, auth.uid(), cod) returning id into nid;
  insert into public.golpe_clan_miembros (usuario, clan) values (auth.uid(), nid);
  update public.golpe_cuentas set plata = plata - 5000, actualizado = now() where id = auth.uid() returning plata into saldo;
  return jsonb_build_object('ok', true, 'plata', saldo, 'codigo', cod);
exception when unique_violation then return jsonb_build_object('ok', false, 'motivo', 'nombre usado');
end $$;

create or replace function public.golpe_clan_unirse(codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k public.golpe_clanes;
begin
  if auth.uid() is null then raise exception 'Necesitas un perfil en la nube' using errcode = '42501'; end if;
  insert into public.golpe_cuentas (id, importado) values (auth.uid(), true) on conflict (id) do nothing;
  if exists (select 1 from public.golpe_clan_miembros where usuario = auth.uid()) then return jsonb_build_object('ok', false, 'motivo', 'ya tenés clan'); end if;
  select * into k from public.golpe_clanes c where c.codigo = upper(btrim(golpe_clan_unirse.codigo));
  if k.id is null then return jsonb_build_object('ok', false, 'motivo', 'código'); end if;
  if (select count(*) from public.golpe_clan_miembros where clan = k.id) >= 12 then return jsonb_build_object('ok', false, 'motivo', 'lleno'); end if;
  insert into public.golpe_clan_miembros (usuario, clan) values (auth.uid(), k.id);
  return jsonb_build_object('ok', true, 'nombre', k.nombre, 'tag', k.tag);
end $$;

-- Salir del clan. Si sale el líder, queda como líder el miembro más antiguo; si era el último, el clan se disuelve.
create or replace function public.golpe_clan_salir() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c bigint; otro uuid;
begin
  if auth.uid() is null then raise exception 'Necesitas un perfil en la nube' using errcode = '42501'; end if;
  delete from public.golpe_clan_miembros where usuario = auth.uid() returning clan into c;
  if c is null then return jsonb_build_object('ok', false, 'motivo', 'sin clan'); end if;
  select usuario into otro from public.golpe_clan_miembros where clan = c order by desde limit 1;
  if otro is null then delete from public.golpe_clanes where id = c;
  else update public.golpe_clanes set lider = otro where id = c and lider = auth.uid(); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.golpe_zonas() from public, anon;
revoke all on function public.golpe_comprar_terreno(text, integer) from public, anon;
revoke all on function public.golpe_vender_terreno(text, integer) from public, anon;
revoke all on function public.golpe_cobrar_renta() from public, anon;
revoke all on function public.golpe_clan_crear(text, text) from public, anon;
revoke all on function public.golpe_clan_unirse(text) from public, anon;
revoke all on function public.golpe_clan_salir() from public, anon;
grant execute on function public.golpe_mundo() to anon, authenticated;
grant execute on function public.golpe_comprar_terreno(text, integer) to authenticated;
grant execute on function public.golpe_vender_terreno(text, integer) to authenticated;
grant execute on function public.golpe_cobrar_renta() to authenticated;
grant execute on function public.golpe_clan_crear(text, text) to authenticated;
grant execute on function public.golpe_clan_unirse(text) to authenticated;
grant execute on function public.golpe_clan_salir() to authenticated;
