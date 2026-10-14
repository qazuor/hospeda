/**
 * @fileoverview
 * HOS-1641 (V6.9b) dual-write for the curated listing fixtures.
 *
 * The gastronomy JSON fixtures and the inline experience fixtures now declare
 * `publicationStatus` instead of the old `lifecycleState`, `visibility` and
 * `moderationState` fields. They change shape, not state: each one carries the
 * value the old pair implied (`ACTIVE` + `PUBLIC` → `PUBLISHED`, anything else
 * → `DRAFT`). On a live environment that state is already written —
 * `0148_cut_paso_3` filled `publication_status` for every live row with the
 * same rule — and the old columns are dropped by the structural migration of
 * HOS-1641, so there is nothing to rewrite here.
 */
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0125-v69b-listing-fixtures-publication-status',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** No-op: `0148_cut_paso_3` already wrote the state the reshaped fixtures declare. */
export async function up(_ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    return {
        summary:
            'No listing rows required rewriting; 0148_cut_paso_3 already wrote publication_status.',
        counts: { listingsRewritten: 0 }
    };
}
