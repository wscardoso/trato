process.env.DEMO_MODE = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/booking?schema=public";
// Force demo path for unit/integration suites unless RUN_DB_TESTS=1
if (process.env.RUN_DB_TESTS !== "1") {
  process.env.DEMO_MODE = "true";
}
delete process.env.REDIS_URL;
