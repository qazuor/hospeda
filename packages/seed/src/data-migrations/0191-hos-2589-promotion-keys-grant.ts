/**
 * HOS-2589: grants the two catalog keys of the free / VIP promotions model.
 *
 * - `vip_only_promotions` (D-4): to EVERY version of each plan in
 *   `PRODUCTION_PLAN_VIP_ONLY_PROMOTIONS_GRANTS`, so «Solo VIP» behaves as
 *   «anyone can» on day one, including for subscribers pinned to an older version.
 *   Publishing a new version instead would leave every live subscriber without the
 *   key and pause their «Solo VIP» promotions (D-8) on the day of the launch.
 * - `max_free_visible_promotions` (M-4): the X of the model, as a limit row on
 *   every version of the TOURIST floor plan.
 *
 * Uses the bounded additive-grant lane (extras 041, as 0168 and 0187 do): only keys
 * new to a version may be inserted, nothing existing is changed. Idempotent: a
 * version that already holds a key is skipped. `contentOnly`: no baseline writes
 * these rows, so a fresh database runs it for real.
 */
import { sql } from '@repo/db';
import {
    PRODUCTION_PLAN_FREE_VISIBLE_PROMOTIONS_LIMIT,
    PRODUCTION_PLAN_VIP_ONLY_PROMOTIONS_GRANTS
} from '../catalog/next-version-entitlements.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Ledger identity of this migration; `contentOnly` so fresh databases run it for real. */
export const meta = {
    name: '0191-hos-2589-promotion-keys-grant',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

/**
 * Grants `vip_only_promotions` to the owner plans and `max_free_visible_promotions`
 * to the tourist floor plan.
 *
 * @param ctx - Transaction-scoped migration context.
 * @returns How many entitlement and limit rows were inserted.
 */
export async function up({ db }: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const ownerPairs = sql.join(
        PRODUCTION_PLAN_VIP_ONLY_PROMOTIONS_GRANTS.map(
            ({ vertical, slug }) => sql`(${vertical}::text, ${slug}::text)`
        ),
        sql`, `
    );
    const floor = PRODUCTION_PLAN_FREE_VISIBLE_PROMOTIONS_LIMIT;

    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', 'HOS-2589', true)`);
    const result = await db.execute(sql`
        with owner_versions as (
            select pv.id
            from plan_version pv
            join plan p on p.id = pv.plan_id and p.vertical = pv.vertical
            where (pv.vertical::text, p.slug) in (${ownerPairs})
        ), floor_versions as (
            select pv.id
            from plan_version pv
            join plan p on p.id = pv.plan_id and p.vertical = pv.vertical
            where pv.vertical::text = ${floor.vertical} and p.slug = ${floor.slug}
        ), inserted_entitlements as (
            insert into plan_version_entitlement (id, plan_version_id, key, plan_quota, trial_quota)
            select gen_random_uuid(), o.id, 'vip_only_promotions', null, null
            from owner_versions o
            where not exists (
                select 1 from plan_version_entitlement existing
                where existing.plan_version_id = o.id and existing.key = 'vip_only_promotions'
            )
            returning plan_version_id
        ), inserted_limits as (
            insert into plan_version_limit (id, plan_version_id, key, value)
            select gen_random_uuid(), f.id, ${floor.limit.key}, ${floor.limit.value}
            from floor_versions f
            where not exists (
                select 1 from plan_version_limit existing
                where existing.plan_version_id = f.id and existing.key = ${floor.limit.key}
            )
            returning plan_version_id
        )
        select
            (select count(*)::int from inserted_entitlements) as vip_only_promotions_inserted,
            (select count(*)::int from inserted_limits) as max_free_visible_promotions_inserted
    `);
    // Cleared on success only: on error the runner rolls back the transaction-local setting.
    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', '', true)`);

    const counts = (result as unknown as { rows?: Array<Record<string, number>> }).rows?.[0] ?? {};
    const vipOnlyPromotionsInserted = Number(counts.vip_only_promotions_inserted ?? 0);
    const maxFreeVisiblePromotionsInserted = Number(
        counts.max_free_visible_promotions_inserted ?? 0
    );
    return {
        summary: `HOS-2589: granted vip_only_promotions to ${vipOnlyPromotionsInserted} and max_free_visible_promotions to ${maxFreeVisiblePromotionsInserted} plan versions.`,
        counts: { vipOnlyPromotionsInserted, maxFreeVisiblePromotionsInserted }
    };
}
