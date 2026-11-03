/**
 * @fileoverview
 * Data migration: 0133-hos1830-business-lines-verification
 *
 * Verifies the structural backfill invariant after the dual-write boundary.
 *
 * Reminder: when this migration changes canonical seed data, also update the
 * corresponding baseline seed fixture (the JSON files under
 * `src/data/**`) so a fresh `db:fresh` / `db:fresh-dev` produces the same
 * end state as running this migration against an existing database. See
 * .specs/HOS-25-versioned-seed-data-migrations/spec.md for the dual-write
 * convention.
 */

import { accommodations, experiences, sql, venues } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0133-hos1830-business-lines-verification',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const empty = await Promise.all([
        ctx.db
            .select({ id: venues.id })
            .from(venues)
            .where(sql`cardinality(${venues.businessLines}) = 0`)
            .limit(1),
        ctx.db
            .select({ id: accommodations.id })
            .from(accommodations)
            .where(sql`cardinality(${accommodations.businessLines}) = 0`)
            .limit(1),
        ctx.db
            .select({ id: experiences.id })
            .from(experiences)
            .where(sql`cardinality(${experiences.businessLines}) = 0`)
            .limit(1)
    ]);
    const tables = ['venues', 'accommodations', 'experiences'] as const;
    const invalid = tables.filter((_, index) => empty[index]?.length);
    if (invalid.length) {
        throw new Error(
            `HOS-1830 business_lines verification failed: empty rows in ${invalid.join(', ')}`
        );
    }
    return {
        summary: 'All venue, accommodation, and experience rows have at least one business line.'
    };
}
