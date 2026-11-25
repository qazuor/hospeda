/**
 * Integration fixture for the HOS-2589 free promotions quota.
 *
 * The integration database is built from the SQL migrations only, so the TOURIST
 * floor plan carries no `max_free_visible_promotions` row: that row arrives in a
 * live environment through seed data-migration 0191. Without it a guest's quota is
 * 0 and every free read fails closed (AC-11) to an empty list.
 *
 * This fixture writes the same row 0191 writes, through the same bounded
 * additive-grant lane (extras 041), so a test can exercise the quota the way
 * production does. Idempotent: a version that already holds the key is skipped.
 */
import { getDb, sql } from '@repo/db';

/** The value data-migration 0191 grants (owner decision M-4). */
export const FREE_VISIBLE_PROMOTIONS_QUOTA = 3;

/**
 * Grants `max_free_visible_promotions` to every version of the TOURIST floor plan.
 *
 * @param params - `value`: the quota to grant (defaults to the production value).
 * @returns The number of versions that received the row.
 */
export async function grantFreeVisiblePromotionsQuota({
    value = FREE_VISIBLE_PROMOTIONS_QUOTA
}: {
    readonly value?: number;
} = {}): Promise<{ readonly granted: number }> {
    return getDb().transaction(async (tx) => {
        await tx.execute(
            sql`select set_config('hospeda.catalog_additive_grant', 'HOS-2589-test', true)`
        );
        const result = await tx.execute(sql`
            insert into plan_version_limit (id, plan_version_id, key, value)
            select gen_random_uuid(), pv.id, 'max_free_visible_promotions', ${value}
            from plan_version pv
            join plan p on p.id = pv.plan_id and p.vertical = pv.vertical
            where pv.vertical::text = 'tourist' and p.role = 'floor'
              and not exists (
                select 1 from plan_version_limit existing
                where existing.plan_version_id = pv.id
                  and existing.key = 'max_free_visible_promotions'
              )
            returning plan_version_id
        `);
        await tx.execute(sql`select set_config('hospeda.catalog_additive_grant', '', true)`);
        const rows = (result as unknown as { rows?: unknown[] }).rows ?? [];
        return { granted: rows.length };
    });
}
