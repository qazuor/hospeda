/**
 * @file trialPlans.writer.ts
 * @description The single writer that puts a composed trial plan
 * ({@link TrialPlanEntry}) into `billing_plans` — used by the baseline seed
 * (`trialPlans.seed.ts`) AND by the three HOS-1012 data-migrations.
 *
 * Deliberately NOT the `0004-test-daily-plan.ts` shape, where the migration
 * re-types the seed's steps by hand because `seedTestDailyPlan` calls `getDb()`
 * internally. The duplication that precedent accepts is exactly what would let
 * a fresh database and an already-seeded one end up with differently-shaped
 * trial plan rows — and the whole point of D-5 is that the row's
 * `metadata.trialComposition` is what gates a request. So the db client is a
 * parameter here, and both carriles call the same function: the seed with
 * `getDb()`, each migration with its transaction-scoped `ctx.db`.
 */
import { TRIAL_COMPOSITION_METADATA_KEY, type TrialPlanEntry } from '@repo/billing';
import { billingPlans, type DrizzleClient, eq } from '@repo/db';

/** What {@link ensureTrialPlanRow} did to one plan row. */
export type EnsureTrialPlanOutcome = 'created' | 'restamped' | 'skipped';

/**
 * Builds the `metadata` JSONB for a trial plan row.
 *
 * Column layout mirrors `billingPlans.seed.ts` / `commercePlan.seed.ts` exactly
 * — `metadata.category` and `metadata.isDefault` are read by
 * `isOwnerCategorySubscription` and by the entitlement fallbacks, so a row
 * written differently here would be invisible to them — plus the one field that
 * is unique to a trial plan: {@link TRIAL_COMPOSITION_METADATA_KEY}.
 *
 * @param input.entry - The trial plan entry (definition + composition).
 * @param input.existing - Metadata already on the row, preserved underneath.
 * @returns The metadata object to write.
 */
function buildTrialPlanMetadata(input: {
    readonly entry: TrialPlanEntry;
    readonly existing?: Readonly<Record<string, unknown>>;
}): Record<string, unknown> {
    const { plan, composition } = input.entry;
    return {
        // Anything an operator or a future migration put here survives: this
        // writer owns the keys it names and nothing else.
        ...(input.existing ?? {}),
        slug: plan.slug,
        displayName: plan.name,
        category: plan.category,
        isDefault: plan.isDefault,
        sortOrder: plan.sortOrder,
        trialDays: plan.trialDays,
        hasTrial: plan.hasTrial,
        annualPriceArs: plan.annualPriceArs,
        monthlyPriceUsdRef: plan.monthlyPriceUsdRef,
        // The load-bearing field. Re-stamped on every run BY DESIGN, unlike the
        // entitlements/limits snapshot below: the composition decides which
        // grants a request resolves, it is not admin-editable (the admin write
        // is refused outright — HOS-1012 T-038), and a row that lost it would
        // silently fall back to its own stale snapshot.
        [TRIAL_COMPOSITION_METADATA_KEY]: {
            entitlementsFrom: composition.entitlementsFrom,
            limitsFrom: composition.limitsFrom
        }
    };
}

/**
 * Ensures one composed trial plan exists in `billing_plans`, idempotently.
 *
 * Matched by `name` (the slug) — `billing_plans` has no `slug` column, the
 * SPEC-168 convention is that `name` IS it.
 *
 * **No `billing_prices` row is ever created.** A trial plan is granted at first
 * publish and never bought; a zero-amount price row would read as a free plan
 * rather than as an unsellable one, which is the same reasoning
 * `ensureCommercePlan` applies to its unpriced tiers.
 *
 * On an EXISTING row the `entitlements` / `limits` snapshot is left exactly as
 * it is. That is Model C, not laziness: both are `'commercial'` fields since
 * HOS-39, so the database wins. It is also the D-5 invariant running in the
 * only direction it runs — a snapshot that has gone stale against its sources
 * is a screen showing an old number, never a door opening for the wrong person,
 * because the door is opened by the composition and the composition is resolved
 * live.
 *
 * @param input.db - Drizzle client (the seed's `getDb()`, or a migration's `ctx.db`).
 * @param input.entry - The trial plan to write.
 * @param input.livemode - Whether the row belongs to live mode.
 * @returns Whether the row was created, re-stamped, or already correct.
 */
export async function ensureTrialPlanRow(input: {
    readonly db: DrizzleClient;
    readonly entry: TrialPlanEntry;
    readonly livemode: boolean;
}): Promise<EnsureTrialPlanOutcome> {
    const { db, entry, livemode } = input;
    const { plan, productDomain } = entry;

    const existing = await db
        .select({
            id: billingPlans.id,
            metadata: billingPlans.metadata,
            productDomain: billingPlans.productDomain
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, plan.slug))
        .limit(1);

    const existingRow = existing[0];

    if (existingRow) {
        const existingMeta = (existingRow.metadata ?? {}) as Record<string, unknown>;
        const metadata = buildTrialPlanMetadata({ entry, existing: existingMeta });

        const alreadyCorrect =
            existingRow.productDomain === productDomain &&
            JSON.stringify(existingMeta[TRIAL_COMPOSITION_METADATA_KEY]) ===
                JSON.stringify(metadata[TRIAL_COMPOSITION_METADATA_KEY]);

        if (alreadyCorrect) {
            return 'skipped';
        }

        await db
            .update(billingPlans)
            .set({ productDomain, metadata })
            .where(eq(billingPlans.id, existingRow.id));

        return 'restamped';
    }

    const limitsObj: Record<string, number> = {};
    for (const l of plan.limits) {
        limitsObj[l.key] = l.value;
    }

    const inserted = await db
        .insert(billingPlans)
        .values({
            name: plan.slug,
            description: plan.description,
            active: plan.isActive,
            // ── The SNAPSHOT. For showing, never for gating. ──────────────
            entitlements: plan.entitlements as string[],
            limits: limitsObj,
            livemode,
            displayName: plan.name,
            monthlyPriceArs: plan.monthlyPriceArs,
            annualPriceArs: plan.annualPriceArs,
            productDomain,
            metadata: buildTrialPlanMetadata({ entry })
        })
        .returning({ id: billingPlans.id });

    if (!inserted[0]) {
        throw new Error(`Insert of trial plan "${plan.slug}" returned no row`);
    }

    return 'created';
}
