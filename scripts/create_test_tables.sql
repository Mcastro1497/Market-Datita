-- ============================================================================
--  Tablas de PRUEBA para el panel de admin (subida de Excel crudos)
--  Correr en Supabase → SQL Editor.  Seguras: no tocan v2 ni v3.
-- ============================================================================

-- ── FLUJOS: copia exacta de instrument_flows_v2 (id autoincremental, append) ──
drop table if exists public.instrument_flows_test;
create table public.instrument_flows_test
  (like public.instrument_flows_v2 including all);

-- ── INSTRUMENTOS: mismas columnas que instruments_v2, pero TODO nullable ─────
--   (sin PK ni NOT NULL, salvo symbol) para que las pruebas nunca fallen si
--   una fila del screener viene incompleta, y para permitir "solo agregar".
drop table if exists public.instruments_test;
create table public.instruments_test (like public.instruments_v2);

do $$
declare c record;
begin
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'instruments_test'
      and column_name <> 'symbol'
  loop
    execute format(
      'alter table public.instruments_test alter column %I drop not null',
      c.column_name);
  end loop;
end $$;

-- ── Permisos (el uploader usa la anon key desde el browser) ─────────────────
grant all on public.instrument_flows_test to anon, authenticated, service_role;
grant all on public.instruments_test      to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated;
