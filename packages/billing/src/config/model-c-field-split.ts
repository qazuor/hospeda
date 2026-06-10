/**
 * Model C field-split for `billing_plans` (SPEC-211 Phase 2, §8.2).
 *
 * ---
 * ## What this file is
 *
 * Model C splits every seed-controlled `billing_plans` column into one of two
 * layers that determine who wins when config and the live DB disagree:
 *
 * - **`'capability'`** — config wins; the Model C sync propagates the config
 *   value to the DB row on every deploy. Changes to these fields in
 *   `plans.config.ts` automatically reach existing paying subscribers.
 *
 * - **`'commercial'`** — DB wins; the Model C sync never overwrites these.
 *   Operators deliberately edit them via the SPEC-168 admin UI (prices,
 *   descriptions, active/inactive toggle, display names). Clobbering them
 *   would silently undo operator decisions.
 *
 * ## The `limits` split
 *
 * The `limits` JSONB column has two distinct facets that belong to different
 * layers:
 *
 * - `limitsKeysPresent` (`'capability'`) — **which** `LimitKey`s a plan has.
 *   If config adds or removes a limit key, the sync adds/removes that key
 *   from the DB row. This is a structural decision (e.g. "owner-basico no
 *   longer has `MAX_AI_SEARCH_PER_MONTH`").
 *
 * - `limitsValues` (`'commercial'`) — the **numeric values** of those keys
 *   (e.g. `MAX_AI_CHAT_PER_MONTH = 20`). Operators can adjust these via the
 *   admin UI without the next deploy overwriting their edits.
 *
 * Both keys share the same `'limits'` JSONB column on the DB row; this split
 * is a logical distinction implemented by the sync logic, not two physical
 * columns. The guard test (AC-2.3) validates that both facets are classified.
 *
 * ## `billing_prices` column
 *
 * `billing_prices.unitAmount` (the ARS price stored in a sibling table) is
 * also seed-controlled but lives in `billing_prices`, not `billing_plans`.
 * It is classified as `'commercial'` here for completeness so the full
 * Model C picture is documented in one place. The sync only touches
 * `billing_plans`; price mutations are out-of-scope for the extras migration.
 *
 * ## Exhaustiveness contract (AC-2.3)
 *
 * `MODEL_C_FIELD_SPLIT` must enumerate EVERY field that the seed controls in
 * `billing_plans` (as detected by `detectDivergences` in
 * `packages/seed/src/required/billingPlans.seed.ts` and written by
 * `ensurePlan`). The guard test `model-c-field-split.test.ts` asserts this.
 * When you add a new column to `billing_plans` and teach the seed about it,
 * you MUST add it here and classify it.
 *
 * @module config/model-c-field-split
 */

/**
 * The two layers in Model C.
 *
 * - `'capability'` — config wins; auto-propagated to the DB on every deploy.
 * - `'commercial'` — DB wins; operator edits are preserved by the sync.
 */
export type ModelCLayer = 'capability' | 'commercial';

/**
 * Every seed-controlled field (or logical facet) of `billing_plans`, keyed by
 * a stable string identifier and classified into its Model C layer.
 *
 * Fields that map to `billing_plans` columns use the column name (or the dot
 * path for nested JSONB properties). The two `limits` facets use explicit keys
 * (`limitsKeysPresent` / `limitsValues`) as documented in the module JSDoc.
 *
 * This record is `as const` so TypeScript can narrow each value to its literal
 * type. The guard test derives the expected key set from the seed source and
 * asserts every entry is `'capability' | 'commercial'`.
 *
 * @see {@link ModelCLayer}
 */
export const MODEL_C_FIELD_SPLIT = {
    // ── Top-level `billing_plans` columns ────────────────────────────────────

    /**
     * `billing_plans.description` — human-readable plan description.
     * COMMERCIAL: operators edit this via the SPEC-168 admin UI (OQ-9).
     */
    description: 'commercial',

    /**
     * `billing_plans.active` — whether the plan is available for purchase.
     * COMMERCIAL: operators activate/deactivate plans via the SPEC-168 admin
     * UI; the sync must never flip a plan back on (OQ-9).
     */
    active: 'commercial',

    /**
     * `billing_plans.entitlements` — the set of EntitlementKeys a plan grants.
     * CAPABILITY: adding or removing an entitlement in config propagates to
     * all existing subscribers on the next deploy.
     */
    entitlements: 'capability',

    /**
     * Logical facet of `billing_plans.limits` (the JSONB object).
     * Which LimitKeys are PRESENT in the limits map for this plan.
     * CAPABILITY: presence is a structural decision (e.g. "this plan no longer
     * has `MAX_AI_SEARCH_PER_MONTH`"). The sync adds/removes keys accordingly.
     */
    limitsKeysPresent: 'capability',

    /**
     * Logical facet of `billing_plans.limits` (the JSONB object).
     * The NUMERIC VALUES of the limit keys that are present.
     * COMMERCIAL: operators can edit quotas via the SPEC-168 admin UI without
     * the next deploy overwriting their adjustments.
     */
    limitsValues: 'commercial',

    // ── Nested `billing_plans.metadata` JSONB fields ─────────────────────────

    /**
     * `billing_plans.metadata.displayName` — human-readable name shown in the
     * admin UI and public-facing plan picker.
     * COMMERCIAL: operators may update display names via the SPEC-168 admin UI
     * without a code deploy (OQ-9).
     */
    'metadata.displayName': 'commercial',

    /**
     * `billing_plans.metadata.category` — plan category (`owner` | `complex`
     * | `tourist`). Structural: it drives entitlement-resolution fallbacks and
     * must stay in sync with the config classification.
     * CAPABILITY: config wins.
     */
    'metadata.category': 'capability',

    /**
     * `billing_plans.metadata.monthlyPriceArs` — ARS monthly price snapshot
     * in metadata (mirrored from `billing_prices.unitAmount`).
     * COMMERCIAL: price is an operator/commercial decision; DB wins.
     */
    'metadata.monthlyPriceArs': 'commercial',

    /**
     * `billing_plans.metadata.annualPriceArs` — ARS annual price snapshot
     * in metadata.
     * COMMERCIAL: same rationale as `metadata.monthlyPriceArs`.
     */
    'metadata.annualPriceArs': 'commercial',

    /**
     * `billing_plans.metadata.isDefault` — whether this is the default plan
     * for its category (used by fallback resolution).
     * CAPABILITY: defaultness is structural config; config wins.
     */
    'metadata.isDefault': 'capability',

    /**
     * `billing_plans.metadata.sortOrder` — display order in the plan picker.
     * CAPABILITY: structural/display ordering is config-driven.
     */
    'metadata.sortOrder': 'capability',

    /**
     * `billing_plans.metadata.hasTrial` — whether the plan has a trial period.
     * CAPABILITY: trial availability is a structural plan property, not an
     * operator runtime decision.
     */
    'metadata.hasTrial': 'capability',

    /**
     * `billing_plans.metadata.trialDays` — duration of the trial in days.
     * CAPABILITY: trial length is structural config; config wins.
     */
    'metadata.trialDays': 'capability',

    // ── `billing_prices` (sibling table, seed-controlled, documented here) ───

    /**
     * `billing_prices.unitAmount` — ARS unit price stored in the prices table.
     * COMMERCIAL: price is set by the operator; DB wins. The extras migration
     * does not touch `billing_prices` — this entry is for documentation only.
     */
    'billing_prices.unitAmount': 'commercial'
} as const satisfies Record<string, ModelCLayer>;

/**
 * The union of all classified field keys in {@link MODEL_C_FIELD_SPLIT}.
 * Useful for compile-time exhaustiveness checks in sync logic.
 */
export type ModelCField = keyof typeof MODEL_C_FIELD_SPLIT;

/**
 * Convenience set of all capability-layer field keys (config wins).
 * Derived from {@link MODEL_C_FIELD_SPLIT} at module load — never drifts.
 */
export const CAPABILITY_FIELDS: ReadonlySet<ModelCField> = new Set(
    (Object.entries(MODEL_C_FIELD_SPLIT) as Array<[ModelCField, ModelCLayer]>)
        .filter(([, layer]) => layer === 'capability')
        .map(([key]) => key)
);

/**
 * Convenience set of all commercial-layer field keys (DB wins).
 * Derived from {@link MODEL_C_FIELD_SPLIT} at module load — never drifts.
 */
export const COMMERCIAL_FIELDS: ReadonlySet<ModelCField> = new Set(
    (Object.entries(MODEL_C_FIELD_SPLIT) as Array<[ModelCField, ModelCLayer]>)
        .filter(([, layer]) => layer === 'commercial')
        .map(([key]) => key)
);
