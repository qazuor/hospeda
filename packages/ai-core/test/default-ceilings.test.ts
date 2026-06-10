/**
 * Unit tests for DEFAULT_COST_CEILINGS (SPEC-211 T-002, AC-0.2).
 *
 * Asserts the exact integer µUSD values mandated in §6.3:
 *   - globalMonthlyMicroUsd = 100_000_000  (USD 100)
 *   - perFeatureMonthlyMicroUsd.chat        = 45_000_000  (USD 45)
 *   - perFeatureMonthlyMicroUsd.search      = 30_000_000  (USD 30)
 *   - perFeatureMonthlyMicroUsd.text_improve = 15_000_000 (USD 15)
 *   - perFeatureMonthlyMicroUsd.support     = 10_000_000  (USD 10)
 *
 * Also verifies the constant parses cleanly through `AiCostCeilingsSchema`
 * (integers, µUSD, no floats, no negatives) to prove it is a valid runtime
 * value that can be written to `ai_settings.costCeilings` unchanged.
 *
 * @module test/default-ceilings
 */

import { AiCostCeilingsSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { DEFAULT_COST_CEILINGS } from '../src/usage/model-rates.js';

// ---------------------------------------------------------------------------
// Exact value assertions (AC-0.2)
// ---------------------------------------------------------------------------

describe('DEFAULT_COST_CEILINGS', () => {
    describe('global ceiling', () => {
        it('globalMonthlyMicroUsd is exactly 100_000_000 µUSD (USD 100)', () => {
            expect(DEFAULT_COST_CEILINGS.globalMonthlyMicroUsd).toBe(100_000_000);
        });

        it('globalMonthlyMicroUsd is an integer', () => {
            expect(Number.isInteger(DEFAULT_COST_CEILINGS.globalMonthlyMicroUsd)).toBe(true);
        });
    });

    describe('per-feature ceilings', () => {
        it('chat ceiling is exactly 45_000_000 µUSD (USD 45)', () => {
            expect(DEFAULT_COST_CEILINGS.perFeatureMonthlyMicroUsd?.chat).toBe(45_000_000);
        });

        it('search ceiling is exactly 30_000_000 µUSD (USD 30)', () => {
            expect(DEFAULT_COST_CEILINGS.perFeatureMonthlyMicroUsd?.search).toBe(30_000_000);
        });

        it('text_improve ceiling is exactly 15_000_000 µUSD (USD 15)', () => {
            expect(DEFAULT_COST_CEILINGS.perFeatureMonthlyMicroUsd?.text_improve).toBe(15_000_000);
        });

        it('support ceiling is exactly 10_000_000 µUSD (USD 10)', () => {
            expect(DEFAULT_COST_CEILINGS.perFeatureMonthlyMicroUsd?.support).toBe(10_000_000);
        });

        it('all four per-feature ceiling values are integers', () => {
            const perFeature = DEFAULT_COST_CEILINGS.perFeatureMonthlyMicroUsd ?? {};
            for (const [key, value] of Object.entries(perFeature)) {
                expect(
                    Number.isInteger(value),
                    `perFeatureMonthlyMicroUsd.${key} must be an integer, got ${String(value)}`
                ).toBe(true);
            }
        });

        it('all four per-feature ceiling values are non-negative', () => {
            const perFeature = DEFAULT_COST_CEILINGS.perFeatureMonthlyMicroUsd ?? {};
            for (const [key, value] of Object.entries(perFeature)) {
                expect(
                    (value as number) >= 0,
                    `perFeatureMonthlyMicroUsd.${key} must be >= 0, got ${String(value)}`
                ).toBe(true);
            }
        });

        it('covers all four AI features (chat, search, text_improve, support)', () => {
            const perFeature = DEFAULT_COST_CEILINGS.perFeatureMonthlyMicroUsd;
            expect(perFeature).toBeDefined();
            expect(Object.keys(perFeature ?? {})).toEqual(
                expect.arrayContaining(['chat', 'search', 'text_improve', 'support'])
            );
        });
    });

    describe('per-feature sum', () => {
        it('sum of per-feature ceilings equals the global ceiling (budget fully allocated)', () => {
            const perFeature = DEFAULT_COST_CEILINGS.perFeatureMonthlyMicroUsd ?? {};
            const total = Object.values(perFeature).reduce((acc, v) => acc + (v as number), 0);
            expect(total).toBe(DEFAULT_COST_CEILINGS.globalMonthlyMicroUsd);
        });
    });
});

// ---------------------------------------------------------------------------
// Schema round-trip (AC-0.2 — verifies values are AiCostCeilingsSchema-valid)
// ---------------------------------------------------------------------------

describe('DEFAULT_COST_CEILINGS parses through AiCostCeilingsSchema', () => {
    it('safeParse succeeds — no validation errors', () => {
        const result = AiCostCeilingsSchema.safeParse(DEFAULT_COST_CEILINGS);
        expect(result.success).toBe(true);
    });

    it('parsed output preserves globalMonthlyMicroUsd exactly', () => {
        const result = AiCostCeilingsSchema.safeParse(DEFAULT_COST_CEILINGS);
        if (!result.success) return;
        expect(result.data.globalMonthlyMicroUsd).toBe(100_000_000);
    });

    it('parsed output preserves all four per-feature values exactly', () => {
        const result = AiCostCeilingsSchema.safeParse(DEFAULT_COST_CEILINGS);
        if (!result.success) return;
        const pf = result.data.perFeatureMonthlyMicroUsd;
        expect(pf?.chat).toBe(45_000_000);
        expect(pf?.search).toBe(30_000_000);
        expect(pf?.text_improve).toBe(15_000_000);
        expect(pf?.support).toBe(10_000_000);
    });
});
