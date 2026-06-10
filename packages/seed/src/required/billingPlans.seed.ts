import {
    ALL_PLANS,
    CAPABILITY_FIELDS,
    MODEL_C_FIELD_SPLIT,
    type ModelCField,
    type PlanDefinition
} from '@repo/billing';
import { type DrizzleClient, and, billingPlans, billingPrices, eq, getDb } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

// ---------------------------------------------------------------------------
// Model C fail-fast guard
// ---------------------------------------------------------------------------

/**
 * The exhaustive set of fields (and logical facets) that the seed controls in
 * `billing_plans`. Every entry here MUST appear in `MODEL_C_FIELD_SPLIT`; if a
 * new column is added to the seed without a corresponding classification, the
 * guard throws at startup (AC-2.3).
 *
 * Note: `billing_prices.unitAmount` is in `MODEL_C_FIELD_SPLIT` for
 * documentation purposes only (it lives in a sibling table). It is NOT listed
 * here because `detectDivergences` does not compare it.
 */
const SEED_CONTROLLED_FIELDS: ReadonlySet<string> = new Set<ModelCField>([
    'description',
    'active',
    'entitlements',
    'limitsKeysPresent',
    'limitsValues',
    'metadata.displayName',
    'metadata.category',
    'metadata.monthlyPriceArs',
    'metadata.annualPriceArs',
    'metadata.isDefault',
    'metadata.sortOrder',
    'metadata.hasTrial',
    'metadata.trialDays'
]);

/**
 * Asserts that every field in {@link SEED_CONTROLLED_FIELDS} is present in
 * {@link MODEL_C_FIELD_SPLIT}. Throws a descriptive error if any field is
 * missing — this is the AC-2.3 fail-fast guard that prevents a new seed
 * column from silently bypassing the Model C policy.
 *
 * Called once at module load time.
 */
function assertAllSeedFieldsClassified(): void {
    const unclassified: string[] = [];
    for (const field of SEED_CONTROLLED_FIELDS) {
        if (!(field in MODEL_C_FIELD_SPLIT)) {
            unclassified.push(field);
        }
    }
    if (unclassified.length > 0) {
        throw new Error(
            `[Model C fail-fast] The following seed-controlled field(s) are not classified in MODEL_C_FIELD_SPLIT: ${unclassified.join(', ')}. Add each field to packages/billing/src/config/model-c-field-split.ts and classify it as "capability" or "commercial" before the seed can run.`
        );
    }
}

// Run at module load — a missing classification is a hard error, not a warning.
assertAllSeedFieldsClassified();

// ---------------------------------------------------------------------------
// Divergence detection helpers
// ---------------------------------------------------------------------------

/**
 * Describes a single diverged field between the seed config and the DB row,
 * annotated with its Model C layer classification.
 */
interface DivergenceEntry {
    /** Logical field key matching a key in MODEL_C_FIELD_SPLIT */
    readonly field: ModelCField;
    readonly config: unknown;
    readonly db: unknown;
    /** Whether this field is capability (config wins) or commercial (DB wins) */
    readonly layer: 'capability' | 'commercial';
}

/**
 * Snapshot of a `billing_plans` DB row as selected by `ensurePlan`.
 */
interface DbRowSnapshot {
    readonly id: string;
    readonly description: string | null;
    readonly active: boolean | null;
    readonly entitlements: unknown;
    readonly limits: unknown;
    readonly metadata: unknown;
}

/**
 * Computes diverged fields between the seed config definition and the existing
 * DB row snapshot. Only compares fields that the seed controls; operator-added
 * fields (e.g. custom metadata keys) are ignored.
 *
 * The `limits` column is split into two logical facets:
 * - `limitsKeysPresent` (capability) — which LimitKeys are present
 * - `limitsValues` (commercial) — the numeric value of each key
 *
 * Each returned entry includes its `layer` classification from
 * {@link MODEL_C_FIELD_SPLIT}, enabling the caller to decide whether to
 * sync the DB or leave it as-is.
 *
 * @param plan - Seed config definition
 * @param dbRow - Existing DB row snapshot
 * @returns Array of diverged field descriptors (empty when config matches DB)
 */
function detectDivergences(
    plan: PlanDefinition,
    dbRow: Omit<DbRowSnapshot, 'id'>
): readonly DivergenceEntry[] {
    const diffs: DivergenceEntry[] = [];

    const meta = (dbRow.metadata ?? {}) as Record<string, unknown>;
    const configLimitsObj: Record<string, number> = {};
    for (const l of plan.limits) {
        configLimitsObj[l.key] = l.value;
    }
    const dbLimitsObj = (dbRow.limits ?? {}) as Record<string, number>;

    /** Compare two values that may be objects/arrays using JSON serialization */
    function differs(a: unknown, b: unknown): boolean {
        return JSON.stringify(a) !== JSON.stringify(b);
    }

    function push(field: ModelCField, config: unknown, db: unknown): void {
        diffs.push({ field, config, db, layer: MODEL_C_FIELD_SPLIT[field] });
    }

    // ── Top-level columns ───────────────────────────────────────────────────
    if (dbRow.description !== plan.description) {
        push('description', plan.description, dbRow.description);
    }
    if (dbRow.active !== plan.isActive) {
        push('active', plan.isActive, dbRow.active);
    }
    if (differs(dbRow.entitlements, plan.entitlements)) {
        push('entitlements', plan.entitlements, dbRow.entitlements);
    }

    // ── limits — two logical facets ─────────────────────────────────────────
    //
    // Facet 1 (capability): which keys are present.
    const configKeys = new Set(Object.keys(configLimitsObj));
    const dbKeys = new Set(Object.keys(dbLimitsObj));
    const keySetDiffers =
        configKeys.size !== dbKeys.size || [...configKeys].some((k) => !dbKeys.has(k));
    if (keySetDiffers) {
        push('limitsKeysPresent', [...configKeys].sort(), [...dbKeys].sort());
    }

    // Facet 2 (commercial): the numeric values of keys present in BOTH sets.
    //
    // We only compare values for keys that exist in both config and DB.
    // Keys added/removed are already captured by limitsKeysPresent (capability).
    // This avoids generating a spurious commercial divergence when a key is
    // simply absent (the key-set facet handles that case).
    const sharedKeys = [...configKeys].filter((k) => dbKeys.has(k));
    const valueDiffKeys = sharedKeys.filter((k) => configLimitsObj[k] !== dbLimitsObj[k]);
    if (valueDiffKeys.length > 0) {
        const configValues: Record<string, number> = {};
        const dbValues: Record<string, number> = {};
        for (const k of valueDiffKeys) {
            configValues[k] = configLimitsObj[k] as number;
            dbValues[k] = dbLimitsObj[k] as number;
        }
        push('limitsValues', configValues, dbValues);
    }

    // ── metadata JSONB ──────────────────────────────────────────────────────
    if (meta.displayName !== plan.name) {
        push('metadata.displayName', plan.name, meta.displayName);
    }
    if (meta.category !== plan.category) {
        push('metadata.category', plan.category, meta.category);
    }
    if (meta.monthlyPriceArs !== plan.monthlyPriceArs) {
        push('metadata.monthlyPriceArs', plan.monthlyPriceArs, meta.monthlyPriceArs);
    }
    if (meta.annualPriceArs !== plan.annualPriceArs) {
        push('metadata.annualPriceArs', plan.annualPriceArs, meta.annualPriceArs);
    }
    if (meta.isDefault !== plan.isDefault) {
        push('metadata.isDefault', plan.isDefault, meta.isDefault);
    }
    if (meta.sortOrder !== plan.sortOrder) {
        push('metadata.sortOrder', plan.sortOrder, meta.sortOrder);
    }
    if (meta.hasTrial !== plan.hasTrial) {
        push('metadata.hasTrial', plan.hasTrial, meta.hasTrial);
    }
    if (meta.trialDays !== plan.trialDays) {
        push('metadata.trialDays', plan.trialDays, meta.trialDays);
    }

    return diffs;
}

/**
 * ARS is the only currency Hospeda bills in. Centralized so the seed
 * does not silently disagree with the rest of the billing stack.
 */
const SEED_CURRENCY = 'ARS';

/**
 * Result of `ensurePlan` so callers know whether the row was newly
 * created or already existed (for log counters).
 *
 * `status`:
 * - `'created'` — the row did not exist and was inserted.
 * - `'skipped'` — the row existed and config matches DB (no divergence).
 * - `'synced'` — the row existed, capability-layer fields were synced to
 *   config; commercial-layer fields were left as-is (DB wins). A summary
 *   of what was synced and what was skipped is logged.
 */
interface EnsurePlanResult {
    readonly planId: string;
    readonly status: 'created' | 'skipped' | 'synced';
}

// ---------------------------------------------------------------------------
// Capability-sync helpers
// ---------------------------------------------------------------------------

/**
 * Builds the Drizzle update payload for all capability-layer divergences.
 *
 * Capability fields drive the update value directly from config. The `limits`
 * column is special: only the key-set changes (add missing keys with config
 * values; remove extra keys). The numeric values of keys present in both
 * config and DB are left unchanged (commercial layer wins on values).
 *
 * @param plan - The seed config definition (source of truth for capability)
 * @param dbRow - The existing DB row snapshot
 * @param capabilityDiffs - The subset of divergences where layer === 'capability'
 * @returns Partial update object suitable for `db.update(...).set(payload)`
 */
function buildCapabilitySyncPayload(
    plan: PlanDefinition,
    dbRow: Omit<DbRowSnapshot, 'id'>,
    capabilityDiffs: readonly DivergenceEntry[]
): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const capabilityFields = new Set(capabilityDiffs.map((d) => d.field));

    if (capabilityFields.has('entitlements')) {
        payload.entitlements = plan.entitlements as string[];
    }

    if (capabilityFields.has('limitsKeysPresent')) {
        // Merge: start from DB values (preserving commercial values), then
        // add keys config has that DB lacks, and remove keys DB has that
        // config dropped.
        const configLimitsObj: Record<string, number> = {};
        for (const l of plan.limits) {
            configLimitsObj[l.key] = l.value;
        }
        const dbLimitsObj = (dbRow.limits ?? {}) as Record<string, number>;

        const mergedLimits: Record<string, number> = {};

        // Include all keys from config; preserve DB value if key already exists
        // (DB value is the operator-edited commercial value), use config value
        // for new keys the DB doesn't have yet.
        for (const [key, configValue] of Object.entries(configLimitsObj)) {
            mergedLimits[key] = key in dbLimitsObj ? (dbLimitsObj[key] as number) : configValue;
        }
        // Keys the DB had but config removed are simply not included → dropped.

        payload.limits = mergedLimits;
    }

    // Metadata: only sync the capability sub-fields, leaving commercial ones
    // (displayName, monthlyPriceArs, annualPriceArs) as-is.
    const META_CAPABILITY_FIELDS: ReadonlyArray<ModelCField> = [
        'metadata.category',
        'metadata.isDefault',
        'metadata.sortOrder',
        'metadata.hasTrial',
        'metadata.trialDays'
    ];

    const metaUpdate: Record<string, unknown> = {};
    for (const field of META_CAPABILITY_FIELDS) {
        if (capabilityFields.has(field)) {
            switch (field) {
                case 'metadata.category':
                    metaUpdate.category = plan.category;
                    break;
                case 'metadata.isDefault':
                    metaUpdate.isDefault = plan.isDefault;
                    break;
                case 'metadata.sortOrder':
                    metaUpdate.sortOrder = plan.sortOrder;
                    break;
                case 'metadata.hasTrial':
                    metaUpdate.hasTrial = plan.hasTrial;
                    break;
                case 'metadata.trialDays':
                    metaUpdate.trialDays = plan.trialDays;
                    break;
                // no default: exhaustive over the capability metadata fields above
            }
        }
    }

    if (Object.keys(metaUpdate).length > 0) {
        // Merge with the existing metadata to preserve commercial sub-fields
        // (displayName, monthlyPriceArs, annualPriceArs, slug, monthlyPriceUsdRef).
        const existingMeta = (dbRow.metadata ?? {}) as Record<string, unknown>;
        payload.metadata = { ...existingMeta, ...metaUpdate };
    }

    return payload;
}

/**
 * Ensure a `billing_plans` row exists for the given plan definition,
 * creating one when missing. Returns the resolved `plan.id` so callers
 * can chain price creation.
 *
 * Idempotent: matches existing rows by `name` (the seed's stable handle
 * — there are no DB-side unique constraints on slug).
 *
 * **Divergence policy (SPEC-211 Phase 2 — Model C):** when a row already
 * exists and its persisted values differ from the seed config, each diverged
 * field is evaluated against {@link MODEL_C_FIELD_SPLIT}:
 *
 * - **Capability** divergences (entitlements, limit-key presence, structural
 *   metadata) → the DB row is updated to match the config value. Config is
 *   the source of truth for capabilities.
 * - **Commercial** divergences (description, active flag, limit numeric values,
 *   prices, displayName) → the DB value is preserved. Operator edits via the
 *   SPEC-168 admin UI win; a log entry is emitted for visibility only.
 *
 * `db` is injectable for tests; production callers omit it and the
 * default `getDb()` resolves the runtime client.
 */
async function ensurePlan(
    plan: PlanDefinition,
    livemode: boolean,
    db: DrizzleClient = getDb()
): Promise<EnsurePlanResult> {
    // Lookup AND insert use the slug as `name`. The Hospeda backend treats
    // `QZPayPlan.name` as the slug (see apps/api/src/services/
    // subscription-checkout.service.ts:72 — `resolvePlanBySlug` matches by
    // `p.name === planSlug`). Storing the human display name here would
    // make every checkout fail with PLAN_NOT_FOUND because the resolver
    // never finds a match. The human label still lives in metadata.displayName
    // for any UI that wants it.
    const existing = await db
        .select({
            id: billingPlans.id,
            description: billingPlans.description,
            active: billingPlans.active,
            entitlements: billingPlans.entitlements,
            limits: billingPlans.limits,
            metadata: billingPlans.metadata
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, plan.slug))
        .limit(1);

    const existingRow = existing[0];
    if (existingRow) {
        const diffs = detectDivergences(plan, existingRow);
        if (diffs.length === 0) {
            return { planId: existingRow.id, status: 'skipped' };
        }

        const capabilityDiffs = diffs.filter((d) => CAPABILITY_FIELDS.has(d.field as ModelCField));
        const commercialDiffs = diffs.filter((d) => !CAPABILITY_FIELDS.has(d.field as ModelCField));

        // Log commercial divergences (DB wins — operator edit preserved).
        if (commercialDiffs.length > 0) {
            logger.info(
                `${STATUS_ICONS.Skip}  Plan "${plan.slug}": ${commercialDiffs.length} commercial field(s) differ from config — DB value preserved (operator edits win).`
            );
            for (const diff of commercialDiffs) {
                logger.info(
                    `   [commercial] "${diff.field}": config=${JSON.stringify(diff.config)}, db=${JSON.stringify(diff.db)}`
                );
            }
        }

        // Sync capability divergences (config wins — update the DB row).
        if (capabilityDiffs.length > 0) {
            const payload = buildCapabilitySyncPayload(plan, existingRow, capabilityDiffs);

            await db
                .update(billingPlans)
                .set(payload as Parameters<ReturnType<typeof db.update>['set']>[0])
                .where(eq(billingPlans.id, existingRow.id));

            logger.info(
                `${STATUS_ICONS.Success}  Plan "${plan.slug}": synced ${capabilityDiffs.length} capability field(s) to config values.`
            );
            for (const diff of capabilityDiffs) {
                logger.info(
                    `   [capability→synced] "${diff.field}": ${JSON.stringify(diff.db)} → ${JSON.stringify(diff.config)}`
                );
            }

            return { planId: existingRow.id, status: 'synced' };
        }

        // Only commercial diffs — nothing to update, but still counts as synced
        // from a caller perspective (the plan row is now in the desired state:
        // capability layer matches config, commercial layer reflects DB).
        return { planId: existingRow.id, status: 'synced' };
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
            entitlements: plan.entitlements as string[],
            limits: limitsObj,
            livemode,
            metadata: {
                slug: plan.slug,
                displayName: plan.name,
                category: plan.category,
                isDefault: plan.isDefault,
                sortOrder: plan.sortOrder,
                trialDays: plan.trialDays,
                hasTrial: plan.hasTrial,
                monthlyPriceArs: plan.monthlyPriceArs,
                annualPriceArs: plan.annualPriceArs,
                monthlyPriceUsdRef: plan.monthlyPriceUsdRef
            }
        })
        .returning({ id: billingPlans.id });

    const insertedRow = inserted[0];
    if (!insertedRow) {
        throw new Error(`Insert of plan "${plan.slug}" returned no row`);
    }

    return { planId: insertedRow.id, status: 'created' };
}

/**
 * Inputs for {@link ensurePrice}.
 *
 * `billingInterval` uses the qzpay-core enum values (`'month'` / `'year'`)
 * — NOT the user-facing aliases (`'monthly'` / `'annual'`) — to match
 * what `billing_prices.billing_interval` stores and what
 * `findMonthlyPrice` / `findAnnualPrice` filter by downstream.
 */
interface EnsurePriceInput {
    readonly planId: string;
    readonly unitAmount: number;
    readonly billingInterval: 'month' | 'year';
    readonly trialDays: number;
    readonly hasTrial: boolean;
    readonly livemode: boolean;
}

/**
 * Ensure a `billing_prices` row exists for the given (planId, currency,
 * billingInterval, intervalCount=1) tuple. Skips when an active row
 * already matches; never updates an existing row (price changes go
 * through a separate flow, not the seed).
 *
 * `trialDays` is forwarded only when the plan declares a trial and the
 * interval is monthly. Annual plans don't carry a trial in Hospeda's
 * model (annual = one-time upfront charge, no MP preapproval).
 *
 * `db` is injectable for tests; production callers omit it.
 */
async function ensurePrice(
    input: EnsurePriceInput,
    db: DrizzleClient = getDb()
): Promise<'created' | 'skipped'> {
    const existing = await db
        .select({ id: billingPrices.id })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, input.planId),
                eq(billingPrices.currency, SEED_CURRENCY),
                eq(billingPrices.billingInterval, input.billingInterval),
                eq(billingPrices.intervalCount, 1)
            )
        )
        .limit(1);

    if (existing.length > 0) {
        return 'skipped';
    }

    const shouldAttachTrial =
        input.hasTrial && input.billingInterval === 'month' && input.trialDays > 0;

    await db.insert(billingPrices).values({
        planId: input.planId,
        currency: SEED_CURRENCY,
        unitAmount: input.unitAmount,
        billingInterval: input.billingInterval,
        intervalCount: 1,
        active: true,
        livemode: input.livemode,
        ...(shouldAttachTrial ? { trialDays: input.trialDays } : {})
    });

    return 'created';
}

/**
 * Seed billing plans + prices from configuration.
 *
 * For each entry in `ALL_PLANS` this:
 * 1. Ensures the matching `billing_plans` row exists.
 * 2. Ensures a monthly `billing_prices` row exists (always — every plan
 *    has a `monthlyPriceArs`).
 * 3. Ensures an annual `billing_prices` row exists when the plan
 *    declares `annualPriceArs` (skipped for plans like sponsor-only
 *    that have no annual variant).
 *
 * Fully idempotent: re-running against an already-seeded DB is a no-op.
 * The seed is the ONLY entry point for the initial config-to-DB transfer;
 * day-to-day plan/price edits happen through the admin UI directly
 * against the DB, not by re-running the seed.
 *
 * **Divergence policy (SPEC-168 T-018):** when an existing plan's DB values
 * differ from the seed config, a warning is logged for each diverged field.
 * The DB row is never overwritten — edits must be applied via the admin UI.
 *
 * @param _context - Seed context (unused but kept for the runner contract)
 */
export async function seedBillingPlans(_context: SeedContext): Promise<void> {
    const entityName = 'Billing Plans';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName}`);
    logger.info(`${separator}`);

    try {
        const isProduction = process.env.NODE_ENV === 'production';

        let plansCreated = 0;
        let plansSkipped = 0;
        let plansSynced = 0;
        let pricesCreated = 0;
        let pricesSkipped = 0;

        for (const plan of ALL_PLANS) {
            try {
                const planResult = await ensurePlan(plan, isProduction);
                if (planResult.status === 'created') {
                    plansCreated++;
                    logger.success({
                        msg: `${STATUS_ICONS.Success}  Created plan: "${plan.name}" (${plan.slug}) - ${plan.entitlements.length} entitlements, ${plan.limits.length} limits`
                    });
                } else if (planResult.status === 'synced') {
                    plansSynced++;
                    // Detail already emitted inside ensurePlan with field-level breakdown
                } else {
                    plansSkipped++;
                    logger.info(
                        `${STATUS_ICONS.Skip}  Skipping plan "${plan.name}" (${plan.slug}) - already exists, no drift`
                    );
                }

                // Monthly price — always present in the config.
                const monthlyResult = await ensurePrice({
                    planId: planResult.planId,
                    unitAmount: plan.monthlyPriceArs,
                    billingInterval: 'month',
                    trialDays: plan.trialDays,
                    hasTrial: plan.hasTrial,
                    livemode: isProduction
                });
                if (monthlyResult === 'created') {
                    pricesCreated++;
                } else {
                    pricesSkipped++;
                }

                // Annual price — only when the plan declares one.
                if (plan.annualPriceArs !== null && plan.annualPriceArs > 0) {
                    const annualResult = await ensurePrice({
                        planId: planResult.planId,
                        unitAmount: plan.annualPriceArs,
                        billingInterval: 'year',
                        trialDays: plan.trialDays,
                        hasTrial: plan.hasTrial,
                        livemode: isProduction
                    });
                    if (annualResult === 'created') {
                        pricesCreated++;
                    } else {
                        pricesSkipped++;
                    }
                }

                summaryTracker.trackSuccess(entityName);
            } catch (error) {
                logger.error(
                    `${STATUS_ICONS.Error}  Failed to seed plan "${plan.name}": ${error instanceof Error ? error.message : String(error)}`
                );
                summaryTracker.trackError(
                    entityName,
                    plan.name,
                    error instanceof Error ? error.message : String(error)
                );
            }
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Plans: ${plansCreated} created, ${plansSkipped} skipped, ${plansSynced} synced (Model C) (${ALL_PLANS.length} total)`
        );
        if (plansSynced > 0) {
            logger.info(
                `${STATUS_ICONS.Info}  ${plansSynced} plan(s) had capability-layer drift synced from config. Commercial fields preserved. See details above.`
            );
        }
        logger.info(
            `${STATUS_ICONS.Info}  Prices: ${pricesCreated} created, ${pricesSkipped} skipped`
        );
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Internals exposed for unit tests only.
 */
export const _internals = {
    ensurePlan,
    ensurePrice,
    detectDivergences,
    buildCapabilitySyncPayload,
    assertAllSeedFieldsClassified,
    SEED_CONTROLLED_FIELDS
};
