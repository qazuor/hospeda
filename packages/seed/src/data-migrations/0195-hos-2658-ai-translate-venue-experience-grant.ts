/**
 * HOS-2658: grants AI translation to the venue and experience plans.
 *
 * Inserts `ai_translate` (plan and trial quota) and `max_ai_translate_per_month`
 * into EVERY version of each plan in `PRODUCTION_PLAN_AI_TRANSLATE_GRANTS`, with the
 * accommodation values (owner decision 2026-11-26), so subscribers pinned to an
 * older version receive it too. Publishing a new version instead would leave every
 * live subscriber without on-save translation.
 *
 * Uses the bounded additive-grant lane (extras 041, as 0191 does): only keys new to
 * a version may be inserted, nothing existing is changed. Idempotent: a version that
 * already holds a key is skipped. `contentOnly`: no baseline writes these rows, so a
 * fresh database runs it for real. Both keys already exist in `catalog_key`
 * (`0129_gorgeous_storm.sql`), so no versioned SQL migration is needed (G3, G18).
 */
import { sql } from '@repo/db';
import { PRODUCTION_PLAN_AI_TRANSLATE_GRANTS } from '../catalog/next-version-entitlements.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Ledger identity of this migration; `contentOnly` so fresh databases run it for real. */
export const meta = {
    name: '0195-hos-2658-ai-translate-venue-experience-grant',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

/**
 * Grants `ai_translate` and `max_ai_translate_per_month` to every version of the
 * six venue and experience plans.
 *
 * @param ctx - Transaction-scoped migration context.
 * @returns How many entitlement and limit rows were inserted.
 */
export async function up({ db }: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const grants = sql.join(
        PRODUCTION_PLAN_AI_TRANSLATE_GRANTS.map(
            ({ vertical, slug, entitlement, limit }) =>
                sql`(${vertical}::text, ${slug}::text, ${entitlement.key}::text, ${entitlement.planQuota}::int, ${entitlement.trialQuota}::int, ${limit.key}::text, ${limit.value}::int)`
        ),
        sql`, `
    );

    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', 'HOS-2658', true)`);
    const result = await db.execute(sql`
        with grants (vertical, slug, entitlement_key, plan_quota, trial_quota, limit_key, limit_value) as (
            values ${grants}
        ), target_versions as (
            select pv.id, g.entitlement_key, g.plan_quota, g.trial_quota, g.limit_key, g.limit_value
            from plan_version pv
            join plan p on p.id = pv.plan_id and p.vertical = pv.vertical
            join grants g on g.vertical = pv.vertical::text and g.slug = p.slug
        ), inserted_entitlements as (
            insert into plan_version_entitlement (id, plan_version_id, key, plan_quota, trial_quota)
            select gen_random_uuid(), t.id, t.entitlement_key, t.plan_quota, t.trial_quota
            from target_versions t
            where not exists (
                select 1 from plan_version_entitlement existing
                where existing.plan_version_id = t.id and existing.key = t.entitlement_key
            )
            returning plan_version_id
        ), inserted_limits as (
            insert into plan_version_limit (id, plan_version_id, key, value)
            select gen_random_uuid(), t.id, t.limit_key, t.limit_value
            from target_versions t
            where not exists (
                select 1 from plan_version_limit existing
                where existing.plan_version_id = t.id and existing.key = t.limit_key
            )
            returning plan_version_id
        )
        select
            (select count(*)::int from inserted_entitlements) as entitlements_inserted,
            (select count(*)::int from inserted_limits) as limits_inserted
    `);
    // Cleared on success only: on error the runner rolls back the transaction-local setting.
    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', '', true)`);

    const counts = (result as unknown as { rows?: Array<Record<string, number>> }).rows?.[0] ?? {};
    const entitlementsInserted = Number(counts.entitlements_inserted ?? 0);
    const limitsInserted = Number(counts.limits_inserted ?? 0);
    return {
        summary: `HOS-2658: granted ai_translate to ${entitlementsInserted} and max_ai_translate_per_month to ${limitsInserted} venue/experience plan versions.`,
        counts: { entitlementsInserted, limitsInserted }
    };
}
