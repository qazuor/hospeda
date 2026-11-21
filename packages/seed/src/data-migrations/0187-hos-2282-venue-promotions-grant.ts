/**
 * Grants promotion creation to every venue Pro/Premium plan version.
 *
 * Owner decision HOS-2253 (2026-11-16): Pro allows five active promotions;
 * Premium is unlimited (the established 2147483647 sentinel). Básico has
 * neither grant. This uses the bounded additive-grant lane so existing
 * subscribers receive the feature without changing any existing catalog row.
 */
import { sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/**
 * Ledger identity of this migration. `contentOnly`: the venue Pro/Premium
 * versions exist on a fresh database (catalog migrations) and no baseline
 * writes these rows, so `--baseline-stamp` must run it instead of stamping it.
 */
export const meta = {
    name: '0187-hos-2282-venue-promotions-grant',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

export async function up({ db }: SeedMigrationCtx): Promise<SeedMigrationResult> {
    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', 'HOS-2282', true)`);
    const result = await db.execute(sql`
        with eligible as (
            select pv.id, p.slug
            from plan_version pv
            join plan p on p.id = pv.plan_id and p.vertical = pv.vertical
            where pv.vertical = 'venue'
              and p.slug in ('venue-pro', 'venue-premium')
        ), inserted_entitlements as (
            insert into plan_version_entitlement (id, plan_version_id, key, plan_quota, trial_quota)
            select gen_random_uuid(), e.id, 'create_promotions', null, null
            from eligible e
            where not exists (
                select 1 from plan_version_entitlement existing
                where existing.plan_version_id = e.id and existing.key = 'create_promotions'
            )
            returning plan_version_id
        ), inserted_limits as (
            insert into plan_version_limit (id, plan_version_id, key, value)
            select gen_random_uuid(), e.id, 'max_active_promotions',
                case e.slug when 'venue-pro' then 5 else 2147483647 end
            from eligible e
            where not exists (
                select 1 from plan_version_limit existing
                where existing.plan_version_id = e.id and existing.key = 'max_active_promotions'
            )
            returning plan_version_id
        )
        select
            (select count(*)::int from inserted_entitlements) as create_promotions_inserted,
            (select count(*)::int from inserted_limits) as max_active_promotions_inserted
    `);
    // Clear only on success; on error the runner rolls back the transaction-local setting.
    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', '', true)`);

    const counts = (result as unknown as { rows?: Array<Record<string, number>> }).rows?.[0] ?? {};
    const createPromotionsInserted = Number(counts.create_promotions_inserted ?? 0);
    const maxActivePromotionsInserted = Number(counts.max_active_promotions_inserted ?? 0);
    return {
        summary: `HOS-2282: granted venue promotions to ${createPromotionsInserted} plan versions.`,
        counts: { createPromotionsInserted, maxActivePromotionsInserted }
    };
}
