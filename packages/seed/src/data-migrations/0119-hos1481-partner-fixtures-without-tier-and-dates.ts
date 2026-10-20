/**
 * @fileoverview
 * HOS-1481 dual-write for the curated partner fixtures. The structural
 * migration removes the old partner commercial fields. Production had zero
 * partner rows at HOS-1480 measurement (2026-10-08), so there is nothing to
 * rewrite here; fixtures already represent the post-migration shape.
 */
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0119-hos1481-partner-fixtures-without-tier-and-dates',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** No-op: the structural migration drops the columns and production had no rows to rewrite. */
export async function up(_ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    return {
        summary:
            'No partner rows required rewriting; the structural migration removes the old columns.',
        counts: { partnersRewritten: 0 }
    };
}
