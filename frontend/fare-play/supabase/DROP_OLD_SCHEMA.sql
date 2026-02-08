-- ============================================================================
-- DROP OLD SCHEMA
-- WARNING: This will DELETE ALL existing data!
-- Only run this if you're sure you don't need the old schema
-- ============================================================================

-- Drop all old tables (cascade removes dependent objects)
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.outcomes CASCADE;
DROP TABLE IF EXISTS public.bets CASCADE;
DROP TABLE IF EXISTS public.predictions CASCADE;
DROP TABLE IF EXISTS public.scheduled_arrivals CASCADE;
DROP TABLE IF EXISTS public.bus_stops CASCADE;
DROP TABLE IF EXISTS public.bus_routes CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Verify all tables are gone
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name NOT IN ('schema_migrations')
ORDER BY table_name;

-- If the above query returns NO rows (except maybe schema_migrations), you're good!
-- Now run COMPLETE_SCHEMA.sql to create the new tables
