/**
 * Grants FAQ drafting to plan versions that were published after 0202.
 *
 * 0202 granted accommodation versions by fixed ids, while admin-published
 * versions have environment-specific ids. Owner decisions (2026-11-12): use
 * the bounded additive-grant lane from extras 041; apply the same 50/250/1250
 * tier quotas to accommodation, venue and experience; never alter a version
 * that already has this limit. Four 0144 venue/experience basico/pro versions
 * therefore retain their existing zero limit and receive no entitlement.
 */
import { sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0168-hos-2105-faq-draft-plan-version-grant',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Grants only eligible versions that do not already define the FAQ draft limit. */
export async function up({ db }: SeedMigrationCtx): Promise<SeedMigrationResult> {
    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', 'HOS-2105', true)`);
    const result = await db.execute(sql`
            with eligible as (
                select pv.id, case p.slug
                    when 'owner-basico' then 50 when 'venue-basico' then 50 when 'experience-basico' then 50
                    when 'owner-pro' then 250 when 'venue-pro' then 250 when 'experience-pro' then 250
                    when 'owner-premium' then 1250 when 'venue-premium' then 1250 when 'experience-premium' then 1250
                end as quota
                from plan_version pv
                join plan p on p.id = pv.plan_id and p.vertical = pv.vertical
                where pv.vertical in ('accommodation', 'venue', 'experience')
                  and p.slug in (
                    'owner-basico', 'owner-pro', 'owner-premium',
                    'venue-basico', 'venue-pro', 'venue-premium',
                    'experience-basico', 'experience-pro', 'experience-premium'
                  )
                  and not exists (
                    select 1 from plan_version_limit l
                    where l.plan_version_id = pv.id and l.key = 'max_ai_faq_draft_per_month'
                  )
            ), inserted_limits as (
                insert into plan_version_limit (id, plan_version_id, key, value)
                select gen_random_uuid(), id, 'max_ai_faq_draft_per_month', quota from eligible
                returning plan_version_id
            ), inserted_entitlements as (
                insert into plan_version_entitlement (id, plan_version_id, key, plan_quota, trial_quota)
                select gen_random_uuid(), e.id, 'ai_faq_draft', null, null
                from eligible e
                where not exists (
                    select 1 from plan_version_entitlement x
                    where x.plan_version_id = e.id and x.key = 'ai_faq_draft'
                )
                returning plan_version_id
            )
            select
                (select count(*)::int from eligible) as versions_granted,
                (select count(*)::int from inserted_entitlements) as entitlements_inserted,
                (select count(*)::int from inserted_limits) as limits_inserted
        `);
    // Cleared on success only: on failure the runner's transaction rolls back and
    // discards the local setting, and a query on an aborted transaction would
    // replace the trigger's real error with "current transaction is aborted".
    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', '', true)`);
    const counts = (result as unknown as { rows?: Array<Record<string, number>> }).rows?.[0] ?? {};
    const versionsGranted = Number(counts.versions_granted ?? 0);
    const entitlementsInserted = Number(counts.entitlements_inserted ?? 0);
    const limitsInserted = Number(counts.limits_inserted ?? 0);
    return {
        summary: `HOS-2105: granted FAQ drafting to ${versionsGranted} plan versions.`,
        counts: { versionsGranted, entitlementsInserted, limitsInserted }
    };
}
