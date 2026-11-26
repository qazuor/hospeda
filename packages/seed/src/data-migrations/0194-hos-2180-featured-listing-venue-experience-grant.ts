/**
 * HOS-2180: grants the `featured_listing` catalog key (the gate that lets an owner
 * feature a listing) to EVERY version of each plan in
 * `PRODUCTION_PLAN_FEATURED_LISTING_GRANTS`: the sellable venue and experience Pro
 * and Premium plans. Granting every version (instead of publishing a new one)
 * reaches subscribers pinned to an older version on the day of the launch.
 *
 * The accommodation plans already carry this key in the 0144 baseline. The trial
 * plans are deliberately absent, because PM-627 says TRIAL never features listings.
 *
 * The key is boolean (vertical scope, `MAX` aggregation): rows carry no plan quota and
 * no trial quota, the same shape the 0144 baseline uses for the accommodation plans.
 *
 * Uses the bounded additive-grant lane (extras 041, as 0168, 0187, 0191 and 0193
 * do): only keys new to a version may be inserted, nothing existing is changed.
 * Idempotent: a version that already holds the key is skipped. `contentOnly`: no
 * baseline writes these rows, so a fresh database runs it for real.
 */
import { sql } from '@repo/db';
import { PRODUCTION_PLAN_FEATURED_LISTING_GRANTS } from '../catalog/next-version-entitlements.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Ledger identity of this migration; `contentOnly` so fresh databases run it for real. */
export const meta = {
    name: '0194-hos-2180-featured-listing-venue-experience-grant',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

/**
 * Grants `featured_listing` to every version of the listed plans.
 *
 * @param ctx - Transaction-scoped migration context.
 * @returns How many entitlement rows were inserted.
 */
export async function up({ db }: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const planPairs = sql.join(
        PRODUCTION_PLAN_FEATURED_LISTING_GRANTS.map(
            ({ vertical, slug }) => sql`(${vertical}::text, ${slug}::text)`
        ),
        sql`, `
    );

    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', 'HOS-2180', true)`);
    const result = await db.execute(sql`
        with granted_versions as (
            select pv.id
            from plan_version pv
            join plan p on p.id = pv.plan_id and p.vertical = pv.vertical
            where (pv.vertical::text, p.slug) in (${planPairs})
        ), inserted_entitlements as (
            insert into plan_version_entitlement (id, plan_version_id, key, plan_quota, trial_quota)
            select gen_random_uuid(), g.id, 'featured_listing', null, null
            from granted_versions g
            where not exists (
                select 1 from plan_version_entitlement existing
                where existing.plan_version_id = g.id and existing.key = 'featured_listing'
            )
            returning plan_version_id
        )
        select (select count(*)::int from inserted_entitlements) as featured_listing_inserted
    `);
    // Cleared on success only: on error the runner rolls back the transaction-local setting.
    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', '', true)`);

    const counts = (result as unknown as { rows?: Array<Record<string, number>> }).rows?.[0] ?? {};
    const featuredListingInserted = Number(counts.featured_listing_inserted ?? 0);
    return {
        summary: `HOS-2180: granted featured_listing to ${featuredListingInserted} plan versions.`,
        counts: { featuredListingInserted }
    };
}
