/**
 * AC-2.3 guard test — every seed-controlled `billing_plans` field must be
 * classified in MODEL_C_FIELD_SPLIT, and every classification must be exactly
 * `'capability'` or `'commercial'`.
 *
 * **Why this test exists**
 *
 * If someone adds a new column to `billing_plans` and teaches the seed about
 * it in `detectDivergences` / `ensurePlan` without classifying it in
 * `MODEL_C_FIELD_SPLIT`, the Model C sync would silently ignore it — either
 * always clobbering an operator edit, or always missing a capability change.
 * This test fails in that case, forcing an explicit classification before the
 * PR can merge.
 *
 * **How the expected set is derived**
 *
 * The expected set is derived from the documented seed contract:
 * - Fields compared by `detectDivergences` in `billingPlans.seed.ts`.
 * - Fields written by `ensurePlan` on first insert (including metadata
 *   sub-keys and the `billing_prices` sibling table).
 * - The two logical `limits` facets (`limitsKeysPresent` / `limitsValues`)
 *   that represent the two layers of the single `limits` JSONB column.
 *
 * IMPORTANT: When you add a new field to the seed (either in `detectDivergences`
 * or the `inserted.values({...})` block), you MUST:
 *   1. Add it to `EXPECTED_SEED_CONTROLLED_FIELDS` below.
 *   2. Add it to `MODEL_C_FIELD_SPLIT` in `src/config/model-c-field-split.ts`.
 *   3. Classify it as `'capability'` or `'commercial'`.
 * This test will fail until all three steps are done.
 */

import { describe, expect, it } from 'vitest';
import {
    CAPABILITY_FIELDS,
    COMMERCIAL_FIELDS,
    MODEL_C_FIELD_SPLIT,
    type ModelCLayer
} from '../src/config/model-c-field-split.js';

/**
 * Canonical set of seed-controlled `billing_plans` fields / logical facets.
 *
 * Derived from:
 * - `detectDivergences()` in `packages/seed/src/required/billingPlans.seed.ts`
 *   (the comparisons on lines 53–97 of that file).
 * - `ensurePlan()` first-insert `inserted.values({...})` on lines 196–210.
 * - The two logical limits facets (single `limits` column, two Model C layers).
 * - `billing_prices.unitAmount` from `ensurePrice()` (sibling table, commercial).
 *
 * SYNC CONTRACT: keep this set exactly aligned with the fields the seed reads
 * or writes on `billing_plans`. If you change the seed, change this set.
 */
const EXPECTED_SEED_CONTROLLED_FIELDS: ReadonlySet<string> = new Set([
    // top-level billing_plans columns
    'description',
    'active',
    'entitlements',
    // limits JSONB — two logical facets (one physical column, two Model C layers)
    'limitsKeysPresent',
    'limitsValues',
    // metadata JSONB sub-fields compared by detectDivergences
    'metadata.displayName',
    'metadata.category',
    'metadata.monthlyPriceArs',
    'metadata.annualPriceArs',
    'metadata.isDefault',
    'metadata.sortOrder',
    'metadata.hasTrial',
    'metadata.trialDays',
    // billing_prices sibling table (seed-controlled, commercial, documented only)
    'billing_prices.unitAmount'
]);

const VALID_LAYERS: ReadonlySet<string> = new Set<ModelCLayer>(['capability', 'commercial']);

describe('MODEL_C_FIELD_SPLIT (AC-2.3 guard)', () => {
    describe('completeness — every seed-controlled field is classified', () => {
        it('MODEL_C_FIELD_SPLIT contains exactly the expected fields (no missing, no extra)', () => {
            const classified = new Set(Object.keys(MODEL_C_FIELD_SPLIT));

            const missing = [...EXPECTED_SEED_CONTROLLED_FIELDS].filter((f) => !classified.has(f));
            const extra = [...classified].filter((f) => !EXPECTED_SEED_CONTROLLED_FIELDS.has(f));

            expect(missing, 'Fields in seed but NOT classified in MODEL_C_FIELD_SPLIT').toEqual([]);
            expect(
                extra,
                'Fields classified in MODEL_C_FIELD_SPLIT but NOT in the seed contract'
            ).toEqual([]);
        });

        it('every expected seed-controlled field has an entry in MODEL_C_FIELD_SPLIT', () => {
            for (const field of EXPECTED_SEED_CONTROLLED_FIELDS) {
                expect(
                    MODEL_C_FIELD_SPLIT,
                    `Field "${field}" is seed-controlled but missing from MODEL_C_FIELD_SPLIT`
                ).toHaveProperty(field);
            }
        });
    });

    describe('validity — every classification is exactly capability or commercial', () => {
        it('every classified layer value is a valid ModelCLayer', () => {
            for (const [field, layer] of Object.entries(MODEL_C_FIELD_SPLIT)) {
                expect(
                    VALID_LAYERS.has(layer),
                    `Field "${field}" has invalid layer "${layer}" — must be 'capability' or 'commercial'`
                ).toBe(true);
            }
        });
    });

    describe('CAPABILITY_FIELDS derived set', () => {
        it('contains only fields classified as capability', () => {
            for (const field of CAPABILITY_FIELDS) {
                expect(
                    MODEL_C_FIELD_SPLIT[field],
                    `CAPABILITY_FIELDS includes "${field}" but its layer is not 'capability'`
                ).toBe('capability');
            }
        });

        it('contains all fields classified as capability', () => {
            const expectedCapabilityFields = Object.entries(MODEL_C_FIELD_SPLIT)
                .filter(([, layer]) => layer === 'capability')
                .map(([key]) => key);

            for (const field of expectedCapabilityFields) {
                expect(
                    CAPABILITY_FIELDS.has(field as never),
                    `Field "${field}" is classified as capability but missing from CAPABILITY_FIELDS set`
                ).toBe(true);
            }

            expect(CAPABILITY_FIELDS.size).toBe(expectedCapabilityFields.length);
        });
    });

    describe('COMMERCIAL_FIELDS derived set', () => {
        it('contains only fields classified as commercial', () => {
            for (const field of COMMERCIAL_FIELDS) {
                expect(
                    MODEL_C_FIELD_SPLIT[field],
                    `COMMERCIAL_FIELDS includes "${field}" but its layer is not 'commercial'`
                ).toBe('commercial');
            }
        });

        it('contains all fields classified as commercial', () => {
            const expectedCommercialFields = Object.entries(MODEL_C_FIELD_SPLIT)
                .filter(([, layer]) => layer === 'commercial')
                .map(([key]) => key);

            for (const field of expectedCommercialFields) {
                expect(
                    COMMERCIAL_FIELDS.has(field as never),
                    `Field "${field}" is classified as commercial but missing from COMMERCIAL_FIELDS set`
                ).toBe(true);
            }

            expect(COMMERCIAL_FIELDS.size).toBe(expectedCommercialFields.length);
        });
    });

    describe('partition invariant — capability and commercial are disjoint and cover all fields', () => {
        it('CAPABILITY_FIELDS and COMMERCIAL_FIELDS are disjoint', () => {
            const intersection = [...CAPABILITY_FIELDS].filter((f) =>
                COMMERCIAL_FIELDS.has(f as never)
            );
            expect(intersection).toEqual([]);
        });

        it('CAPABILITY_FIELDS ∪ COMMERCIAL_FIELDS = all classified fields', () => {
            const total = CAPABILITY_FIELDS.size + COMMERCIAL_FIELDS.size;
            const allFields = Object.keys(MODEL_C_FIELD_SPLIT).length;
            expect(total).toBe(allFields);
        });
    });

    describe('specific field classifications (§8.2 spec table)', () => {
        it('entitlements is capability (config wins — propagated on deploy)', () => {
            expect(MODEL_C_FIELD_SPLIT.entitlements).toBe('capability');
        });

        it('limitsKeysPresent is capability (structural — which keys exist)', () => {
            expect(MODEL_C_FIELD_SPLIT.limitsKeysPresent).toBe('capability');
        });

        it('limitsValues is commercial (DB wins — operators adjust quotas)', () => {
            expect(MODEL_C_FIELD_SPLIT.limitsValues).toBe('commercial');
        });

        it('metadata.monthlyPriceArs is commercial (price = operator decision)', () => {
            expect(MODEL_C_FIELD_SPLIT['metadata.monthlyPriceArs']).toBe('commercial');
        });

        it('metadata.annualPriceArs is commercial (price = operator decision)', () => {
            expect(MODEL_C_FIELD_SPLIT['metadata.annualPriceArs']).toBe('commercial');
        });

        it('active is commercial (OQ-9: operators toggle via admin UI)', () => {
            expect(MODEL_C_FIELD_SPLIT.active).toBe('commercial');
        });

        it('description is commercial (OQ-9: operators edit via admin UI)', () => {
            expect(MODEL_C_FIELD_SPLIT.description).toBe('commercial');
        });

        it('metadata.displayName is commercial (OQ-9: operators edit via admin UI)', () => {
            expect(MODEL_C_FIELD_SPLIT['metadata.displayName']).toBe('commercial');
        });

        it('metadata.isDefault is capability (structural — fallback resolution)', () => {
            expect(MODEL_C_FIELD_SPLIT['metadata.isDefault']).toBe('capability');
        });

        it('metadata.category is capability (structural — entitlement resolution)', () => {
            expect(MODEL_C_FIELD_SPLIT['metadata.category']).toBe('capability');
        });

        it('metadata.sortOrder is capability (structural — display ordering)', () => {
            expect(MODEL_C_FIELD_SPLIT['metadata.sortOrder']).toBe('capability');
        });

        it('metadata.hasTrial is capability (structural — trial availability)', () => {
            expect(MODEL_C_FIELD_SPLIT['metadata.hasTrial']).toBe('capability');
        });

        it('metadata.trialDays is capability (structural — trial duration)', () => {
            expect(MODEL_C_FIELD_SPLIT['metadata.trialDays']).toBe('capability');
        });

        it('billing_prices.unitAmount is commercial (price = operator decision)', () => {
            expect(MODEL_C_FIELD_SPLIT['billing_prices.unitAmount']).toBe('commercial');
        });
    });
});
