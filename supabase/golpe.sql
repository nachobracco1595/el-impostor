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
