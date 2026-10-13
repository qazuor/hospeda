import type { Pool } from 'pg';

/**
 * Temporarily empties the accommodation sellable catalog by un-marking as current
 * ONLY the versions that are both `current` and `sellable`, and returns a function
 * that restores exactly those versions to `current = true`.
 *
 * Why only `current`, and only on `current AND sellable` rows (HOS-1673):
 * - `trg_plan_version_immutable` rejects any UPDATE of `plan_version` that changes a
 *   column other than `current` (`sellable` included), so "no plans" cannot be
 *   simulated by writing `sellable`.
 * - The floor and trial versions must stay current: without them the catalog
 *   resolution throws `CatalogVersionNotFoundError` and `subscribe-destination`
 *   answers 500, so the card falls into `publish-check-failed` instead of the
 *   no-plans state the spec asserts.
 *
 * @param pool - Pool connected to the E2E database.
 * @returns A restore callback; call it in `finally` so the global catalog comes back.
 */
export async function retireAccommodationPlanVersions(pool: Pool): Promise<() => Promise<void>> {
    const { rows } = await pool.query<{ id: string }>(
        `UPDATE plan_version AS version
         SET current = false
         FROM plan
         WHERE plan.id = version.plan_id
           AND plan.vertical = 'accommodation'
           AND version.current = true
           AND version.sellable = true
         RETURNING version.id`
    );
    const retiredIds = rows.map((row) => row.id);
    return async () => {
        if (retiredIds.length === 0) return;
        await pool.query('UPDATE plan_version SET current = true WHERE id = ANY($1::uuid[])', [
            retiredIds
        ]);
    };
}
