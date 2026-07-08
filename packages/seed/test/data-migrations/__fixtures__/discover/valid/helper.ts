/**
 * Non-migration file placed alongside valid fixtures in `discover.test.ts`
 * (HOS-25 T-008) to prove `discoverMigrationFiles` excludes files that don't
 * match the `NNNN-slug.ts` naming convention, without needing an explicit
 * denylist.
 */
export function helperNotAMigration(): string {
    return 'not a migration';
}
