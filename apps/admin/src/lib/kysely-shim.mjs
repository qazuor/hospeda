// Compatibility shim for kysely >=0.29.
// kysely 0.29 moved DEFAULT_MIGRATION_TABLE / DEFAULT_MIGRATION_LOCK_TABLE
// to the `kysely/migration` sub-path. better-auth 1.4.18 still imports them
// from the package root, which crashes Vite's optimizeDeps with rolldown
// (MISSING_EXPORT). Re-exporting them here lets the SQLite dialect modules
// in better-auth bundle cleanly. Runtime path is unaffected — admin uses
// the postgres adapter, not SQLite.
export * from 'kysely/dist/index.js';
export { DEFAULT_MIGRATION_TABLE, DEFAULT_MIGRATION_LOCK_TABLE } from 'kysely/migration';
