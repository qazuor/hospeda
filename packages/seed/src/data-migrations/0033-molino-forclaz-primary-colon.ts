/**
 * @fileoverview
 * Data migration: 0033-molino-forclaz-primary-colon
 *
 * Promotes the Molino Forclaz's `r_destination_point_of_interest` row for
 * Colón from `NEARBY` to `PRIMARY`.
 *
 * ## Why
 *
 * The destination page's POI grid renders `PRIMARY` rows only — surfacing a
 * `NEARBY` one would suggest a POI belongs to a destination it does not
 * (HOS-146). That rule is right, but it left the Museo Provincial Molino
 * Forclaz — which now has its own detail page — unlinked from Colón, the
 * tourist hub visitors actually browse, while appearing under San José.
 *
 * Measured distances from each destination's centre make the case:
 *
 * | destination  | km  | relation before |
 * |--------------|-----|-----------------|
 * | san-jose     | 2.9 | PRIMARY         |
 * | colon        | 5.0 | NEARBY          |
 * | liebig       | 6.9 | NEARBY          |
 * | villa-elisa  | 21.1| NEARBY          |
 *
 * At 5.0 km the Molino is well inside Colón's own orbit, so PRIMARY states
 * something true. San José keeps its PRIMARY row — the relation is
 * many-to-many precisely so a landmark can belong to more than one
 * destination.
 *
 * ## What this deliberately does NOT do
 *
 * It does not touch `palacio_san_jose` ↔ `concepcion-del-uruguay`. That pair is
 * 28.3 km apart; `NEARBY` is the honest relation, and promoting it to make a
 * link appear would put the Palacio in the grid of a city it is not in. The
 * map popup (which does render NEARBY pins) is the correct surface there.
 *
 * ## Scope guards
 *
 * Matches the one POI/destination pair by slug and only writes while the row
 * is still `NEARBY`, so an operator who set it deliberately is never
 * overwritten. A missing pair is a silent no-op — the count reports reality.
 *
 * ## Idempotency
 *
 * Re-running is a no-op: after the first pass the row is `PRIMARY` and the
 * `relation = 'NEARBY'` predicate matches nothing.
 *
 * ## `destructive` flag decision
 *
 * `false` — flips one enum value on a single join row. Deletes nothing, and is
 * reversible by setting it back to `NEARBY`.
 */
import { sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0033-molino-forclaz-primary-colon',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const POI_SLUG = 'molino_forclaz';
const DESTINATION_SLUG = 'colon';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const promoted = await ctx.db.execute(sql`
        UPDATE r_destination_point_of_interest r
        SET relation = 'PRIMARY'
        FROM points_of_interest p, destinations d
        WHERE r.point_of_interest_id = p.id
          AND r.destination_id = d.id
          AND p.slug = ${POI_SLUG}
          AND d.slug = ${DESTINATION_SLUG}
          AND r.relation = 'NEARBY'
    `);

    const rowsPromoted = promoted.rowCount ?? 0;

    return {
        summary:
            rowsPromoted > 0
                ? `Promoted ${POI_SLUG} to PRIMARY for ${DESTINATION_SLUG}.`
                : `No change — ${POI_SLUG} was not NEARBY for ${DESTINATION_SLUG}.`,
        counts: { rowsPromoted }
    };
}
