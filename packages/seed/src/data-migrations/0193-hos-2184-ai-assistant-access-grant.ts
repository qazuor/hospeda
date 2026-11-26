/**
 * HOS-2184 G-6: grants the `ai_assistant_access` catalog key (the gate of the
 * Hospeda AI assistant connector, MCP) to EVERY version of each plan in
 * `PRODUCTION_PLAN_AI_ASSISTANT_ACCESS_GRANTS`: the sellable plans and the
 * pre-trial plan of the accommodation, venue and experience verticals. Granting
 * every version (instead of publishing a new one) reaches subscribers pinned to an
 * older version on the day of the launch.
 *
 * The key is global and boolean: rows carry no plan quota and no trial quota (a
 * trial quota on a global key is refused, `MeteredKeyGlobalScopeError`).
 *
 * Uses the bounded additive-grant lane (extras 041, as 0168, 0187 and 0191 do):
 * only keys new to a version may be inserted, nothing existing is changed.
 * Idempotent: a version that already holds the key is skipped. `contentOnly`: no
 * baseline writes these rows, so a fresh database runs it for real.
 */
import { sql } from '@repo/db';
import { PRODUCTION_PLAN_AI_ASSISTANT_ACCESS_GRANTS } from '../catalog/next-version-entitlements.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Ledger identity of this migration; `contentOnly` so fresh databases run it for real. */
export const meta = {
    name: '0193-hos-2184-ai-assistant-access-grant',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

/**
 * Grants `ai_assistant_access` to every version of the listed plans.
 *
 * @param ctx - Transaction-scoped migration context.
 * @returns How many entitlement rows were inserted.
 */
export async function up({ db }: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const planPairs = sql.join(
        PRODUCTION_PLAN_AI_ASSISTANT_ACCESS_GRANTS.map(
            ({ vertical, slug }) => sql`(${vertical}::text, ${slug}::text)`
        ),
        sql`, `
    );

    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', 'HOS-2184', true)`);
    const result = await db.execute(sql`
        with granted_versions as (
            select pv.id
            from plan_version pv
            join plan p on p.id = pv.plan_id and p.vertical = pv.vertical
            where (pv.vertical::text, p.slug) in (${planPairs})
        ), inserted_entitlements as (
            insert into plan_version_entitlement (id, plan_version_id, key, plan_quota, trial_quota)
            select gen_random_uuid(), g.id, 'ai_assistant_access', null, null
            from granted_versions g
            where not exists (
                select 1 from plan_version_entitlement existing
                where existing.plan_version_id = g.id and existing.key = 'ai_assistant_access'
            )
            returning plan_version_id
        )
        select (select count(*)::int from inserted_entitlements) as ai_assistant_access_inserted
    `);
    // Cleared on success only: on error the runner rolls back the transaction-local setting.
    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', '', true)`);

    const counts = (result as unknown as { rows?: Array<Record<string, number>> }).rows?.[0] ?? {};
    const aiAssistantAccessInserted = Number(counts.ai_assistant_access_inserted ?? 0);
    return {
        summary: `HOS-2184: granted ai_assistant_access to ${aiAssistantAccessInserted} plan versions.`,
        counts: { aiAssistantAccessInserted }
    };
}
