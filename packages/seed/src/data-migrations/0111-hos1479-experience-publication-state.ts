/**
 * @fileoverview
 * HOS-1479 originally brought the inline experience fixtures into line with
 * the publication state the baseline seed writes, by reading each row's old
 * `lifecycle_state` and `visibility` columns.
 *
 * HOS-1641 (V6.9b) turned it into a no-op, keeping its ledger name:
 * - the structural cut `0148_cut_paso_3` already filled `publication_status`
 *   for every live experience row with the same rule (`ACTIVE` + `PUBLIC` →
 *   `PUBLISHED`, anything else → `DRAFT`), so there is nothing left to move;
 * - the structural migration of HOS-1641 drops the columns this module read,
 *   and on a live environment `db:migrate` runs before `db:seed:migrate`, so
 *   reading them here would fail;
 * - `meta.requiresColumns` does not apply: it would abort the runner forever
 *   on any environment holding experience rows, for a backfill that has no
 *   rows to move.
 */
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0111-hos1479-experience-publication-state',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** No-op: `0148_cut_paso_3` already wrote the publication state the old columns implied. */
export async function up(_ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    return {
        summary:
            'No experience rows required synchronizing; 0148_cut_paso_3 already wrote publication_status.',
        counts: { updated: 0 }
    };
}
