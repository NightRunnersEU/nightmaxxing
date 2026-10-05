-- One-time rename of nightmaxxing-prod's migration history for the
-- drizzle-kit v1 migration layout (upstream tokenmaxxing #86).
--
-- Run BEFORE the first deploy that includes the upstream sync, otherwise the
-- deploy stops with MigrationHistoryConflictError (no writes happen, so it is
-- recoverable: run this, then redeploy).
--
--   1. Check what is recorded (read-only); expect 12 rows, 0000…0011:
--      bunx wrangler d1 execute nightmaxxing-prod --remote \
--        --command "select id, name from d1_migrations order by id"
--   2. Rename (single atomic statement; re-running changes 0 rows):
--      bunx wrangler d1 execute nightmaxxing-prod --remote --file scripts/d1-rename-migrations.sql
--   3. Re-run step 1: the 12 rows should now use the folder names below.
--   4. Deploy. Alchemy converts d1_migrations in place and applies only the
--      newer migrations (cli_login_device_code, eager_whirlwind,
--      rehome_usage_raw_batches).
UPDATE d1_migrations SET name = CASE name
  WHEN '0000_charming_morgan_stark.sql' THEN '20260612221145_charming_morgan_stark'
  WHEN '0001_swift_black_cat.sql' THEN '20260614233643_swift_black_cat'
  WHEN '0002_smooth_malice.sql' THEN '20260616060627_smooth_malice'
  WHEN '0003_even_silver_centurion.sql' THEN '20260617063018_even_silver_centurion'
  WHEN '0004_unique_lightspeed.sql' THEN '20260619203544_unique_lightspeed'
  WHEN '0005_solid_ironclad.sql' THEN '20260621173214_solid_ironclad'
  WHEN '0006_concerned_patch.sql' THEN '20260621214839_concerned_patch'
  WHEN '0007_bright_tiger_shark.sql' THEN '20260622011124_bright_tiger_shark'
  WHEN '0008_slimy_wither.sql' THEN '20260622204519_slimy_wither'
  WHEN '0009_overjoyed_vargas.sql' THEN '20260710034351_overjoyed_vargas'
  WHEN '0010_mysterious_the_liberteens.sql' THEN '20260710040831_mysterious_the_liberteens'
  WHEN '0011_normalize_ccusage_model_labels.sql' THEN '20260722183503_normalize_ccusage_model_labels'
END
WHERE name IN (
  '0000_charming_morgan_stark.sql',
  '0001_swift_black_cat.sql',
  '0002_smooth_malice.sql',
  '0003_even_silver_centurion.sql',
  '0004_unique_lightspeed.sql',
  '0005_solid_ironclad.sql',
  '0006_concerned_patch.sql',
  '0007_bright_tiger_shark.sql',
  '0008_slimy_wither.sql',
  '0009_overjoyed_vargas.sql',
  '0010_mysterious_the_liberteens.sql',
  '0011_normalize_ccusage_model_labels.sql'
);
