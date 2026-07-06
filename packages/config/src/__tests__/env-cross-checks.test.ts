/**
 * @file env-cross-checks.test.ts
 * @description Unit tests for the hand-authored cross-check rules (HOS-79
 * T-009). Asserts the seeded `HOSPEDA_REVALIDATION_SECRET` rule matches the
 * exact `CrossCheckRule` contract required by spec §7.
 */

import { describe, expect, it } from 'vitest';
import { CROSS_CHECK_RULES } from '../env-cross-checks.js';

describe('CROSS_CHECK_RULES', () => {
    it('should contain exactly one seeded rule', () => {
        expect(CROSS_CHECK_RULES).toHaveLength(1);
    });

    it('should seed the HOSPEDA_REVALIDATION_SECRET api/web equality rule with the exact shape', () => {
        const rule = CROSS_CHECK_RULES[0];

        expect(rule).toBeDefined();
        expect(rule?.id).toBe('revalidation-secret-api-web-match');
        expect(rule?.comparator).toBe('equals');
        expect(rule?.appliesTo).toEqual(['local', 'coolify']);
        expect(rule?.compare).toEqual([
            { app: 'api', key: 'HOSPEDA_REVALIDATION_SECRET' },
            { app: 'web', key: 'HOSPEDA_REVALIDATION_SECRET' }
        ]);
    });

    it('should give every rule a non-empty, human-readable description', () => {
        for (const rule of CROSS_CHECK_RULES) {
            expect(rule.description.length).toBeGreaterThan(0);
        }
    });

    it('should only use "local" or "coolify" as appliesTo values', () => {
        for (const rule of CROSS_CHECK_RULES) {
            for (const scope of rule.appliesTo) {
                expect(['local', 'coolify']).toContain(scope);
            }
        }
    });

    it('should only use "equals" as the comparator (the only one currently defined)', () => {
        for (const rule of CROSS_CHECK_RULES) {
            expect(rule.comparator).toBe('equals');
        }
    });

    it('should have at least two compare targets per rule (a rule with 1 side is meaningless)', () => {
        for (const rule of CROSS_CHECK_RULES) {
            expect(rule.compare.length).toBeGreaterThanOrEqual(2);
        }
    });

    it('should have a unique id per rule', () => {
        const ids = CROSS_CHECK_RULES.map((rule) => rule.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
