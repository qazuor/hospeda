/**
 * @fileoverview
 * Data migration: 0001-billing-plans-ai-consumer-search-limits
 *
 * Ports `packages/db/src/migrations/extras/023-billing-plans-ai-consumer-search-limits.plan.sql`
 * (SPEC-283 — Graduated AI Usage Limits per Plan) into the versioned seed
 * data-migration carril (HOS-25, T-020).
 *
 * Seeds two new AI consumer-facing limit keys onto every ACCOMMODATION
 * `billing_plans` row:
 *
 *   - `max_ai_search_per_month`        — max AI-powered accommodation search
 *     queries a consumer may issue per calendar month.
 *   - `max_ai_chat_consumer_per_month` — max AI chat turns a consumer
 *     (tourist browsing listings) may initiate per calendar month.
 *
 * Value table (owner-confirmed, unchanged from the original extras file):
 *
 *   Plan slug (name)               search  consumer
 *   ─────────────────────────────  ──────  ────────
 *   tourist-free                       10        10
 *   tourist-plus                       50        50
 *   tourist-vip                       200       200
 *   owner-basico                      200       200
 *   owner-pro                         200       200
 *   owner-premium                     200       200
 *   complex-basico                    200       200
 *   complex-pro                       200       200
 *   complex-premium                   200       200
 *
 * EXCLUDED: commerce-listing and partner-listing plan slugs — a different
 * `product_domain`; accommodation consumer limits do not apply to them.
 *
 * ## OR-PRESERVE semantics (Model C `limitsValues` = commercial layer)
 *
 * Every UPDATE is guarded with `NOT (limits ? '<key>')` — a key already
 * present in the JSONB object, whether from a prior run of this migration or
 * a manual operator edit via the admin UI (SPEC-168), is NEVER overwritten.
 * This is the SAME guard the original `.plan.sql` used, and matches Model C's
 * classification of `limitsValues` as `'commercial'` (DB wins) in
 * `packages/billing/src/config/model-c-field-split.ts` — this migration only
 * ever ADDS a missing key, it never touches an existing one. Re-running `up()`
 * against an already-migrated database is always a no-op (zero affected rows).
 *
 * Unlike the original `.plan.sql`, this migration does not defensively check
 * `information_schema.tables` for `billing_plans` — the versioned seed
 * data-migration runner (T-009) only runs after the structural Drizzle
 * migration that creates `billing_plans` has already applied, so the table's
 * existence is guaranteed by construction here (see the T-020 handoff note).
 *
 * Reminder: when this migration changes canonical seed data, also update the
 * corresponding baseline seed fixture (the JSON/config files that drive
 * `ALL_PLANS` in `packages/billing/src/config/plans.config.ts`) so a fresh
 * `db:fresh`/`db:fresh-dev` produces the same end state as running this
 * migration against an existing database. See
 * .specs/HOS-25-versioned-seed-data-migrations/spec.md for the dual-write
 * convention. (Not needed here: `ALL_PLANS` already declares both limit keys,
 * so a fresh seed already gets them via `seedBillingPlans`'s Model C
 * capability sync — this migration exists purely to backfill EXISTING rows on
 * environments seeded before SPEC-283 shipped.)
 */
import { and, billingPlans, type DrizzleClient, inArray, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0001-billing-plans-ai-consumer-search-limits',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The two limit keys this migration seeds, kept as named constants for reuse/readability. */
const SEARCH_LIMIT_KEY = 'max_ai_search_per_month';
const CHAT_LIMIT_KEY = 'max_ai_chat_consumer_per_month';

const TOURIST_FREE_PLANS = ['tourist-free'] as const;
const TOURIST_PLUS_PLANS = ['tourist-plus'] as const;
const REMAINING_ACCOMMODATION_PLANS = [
    'tourist-vip',
    'owner-basico',
    'owner-pro',
    'owner-premium',
    'complex-basico',
    'complex-pro',
    'complex-premium'
] as const;

/**
 * OR-PRESERVE merge of a single numeric limit key onto every `billing_plans`
 * row whose `name` is in `planNames`, only when that key is not already
 * present in `limits`. Mirrors the original `.plan.sql`'s
 * `limits || jsonb_build_object(key, value) WHERE NOT (limits ? key)` guard
 * exactly.
 *
 * @returns The number of rows actually updated (0 when every targeted row
 *   already had the key — the expected steady-state on re-run).
 */
async function orPreserveLimit(
    db: DrizzleClient,
    key: string,
    value: number,
    planNames: readonly string[]
): Promise<number> {
    const updated = await db
        .update(billingPlans)
        .set({
            limits: sql`${billingPlans.limits} || jsonb_build_object(${key}::text, ${value}::int)`,
            updatedAt: new Date()
        })
        .where(
            and(
                inArray(billingPlans.name, [...planNames]),
                sql`NOT (${billingPlans.limits} ? ${key})`
            )
        )
        .returning({ id: billingPlans.id });

    return updated.length;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let searchRowsUpdated = 0;
    searchRowsUpdated += await orPreserveLimit(ctx.db, SEARCH_LIMIT_KEY, 10, TOURIST_FREE_PLANS);
    searchRowsUpdated += await orPreserveLimit(ctx.db, SEARCH_LIMIT_KEY, 50, TOURIST_PLUS_PLANS);
    searchRowsUpdated += await orPreserveLimit(
        ctx.db,
        SEARCH_LIMIT_KEY,
        200,
        REMAINING_ACCOMMODATION_PLANS
    );

    let chatRowsUpdated = 0;
    chatRowsUpdated += await orPreserveLimit(ctx.db, CHAT_LIMIT_KEY, 10, TOURIST_FREE_PLANS);
    chatRowsUpdated += await orPreserveLimit(ctx.db, CHAT_LIMIT_KEY, 50, TOURIST_PLUS_PLANS);
    chatRowsUpdated += await orPreserveLimit(
        ctx.db,
        CHAT_LIMIT_KEY,
        200,
        REMAINING_ACCOMMODATION_PLANS
    );

    return {
        summary: `Set "${SEARCH_LIMIT_KEY}" on ${searchRowsUpdated} plan row(s), "${CHAT_LIMIT_KEY}" on ${chatRowsUpdated} plan row(s).`,
        counts: {
            searchLimitRowsUpdated: searchRowsUpdated,
            chatLimitRowsUpdated: chatRowsUpdated
        }
    };
}
