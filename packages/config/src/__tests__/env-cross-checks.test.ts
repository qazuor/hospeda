/**
 * @file env-cross-checks.test.ts
 * @description Unit tests for the hand-authored cross-check rules (HOS-79
 * T-009). Asserts the seeded `HOSPEDA_REVALIDATION_SECRET` rule matches the
 * exact `CrossCheckRule` contract required by spec §7.
 */

import { describe, expect, it } from 'vitest';
import { CROSS_CHECK_RULES } from '../env-cross-checks.js';

describe('CROSS_CHECK_RULES', () => {
    // 3 -> 4 (HOS-1153): the api/admin internal-secret rule is a rule of its
    // own rather than a third side on the api/web one, because an unset side
    // makes the evaluator skip the WHOLE rule. See the comment on that rule.
    it('should contain the four seeded rules', () => {
        expect(CROSS_CHECK_RULES).toHaveLength(4);
    });

    it('should seed the HOSPEDA_REVALIDATION_SECRET api/web equality rule with the exact shape', () => {
        const rule = CROSS_CHECK_RULES.find((r) => r.id === 'revalidation-secret-api-web-match');

        expect(rule).toBeDefined();
        expect(rule?.comparator).toBe('equals');
        expect(rule?.appliesTo).toEqual(['local', 'coolify']);
        expect(rule?.compare).toEqual([
            { app: 'api', key: 'HOSPEDA_REVALIDATION_SECRET' },
            { app: 'web', key: 'HOSPEDA_REVALIDATION_SECRET' }
        ]);
    });

    it('should seed the HOSPEDA_INTERNAL_REQUEST_SECRET api/web equality rule with the exact shape', () => {
        const rule = CROSS_CHECK_RULES.find(
            (r) => r.id === 'internal-request-secret-api-web-match'
        );

        expect(rule).toBeDefined();
        expect(rule?.comparator).toBe('equals');
        expect(rule?.appliesTo).toEqual(['local', 'coolify']);
        expect(rule?.compare).toEqual([
            { app: 'api', key: 'HOSPEDA_INTERNAL_REQUEST_SECRET' },
            { app: 'web', key: 'HOSPEDA_INTERNAL_REQUEST_SECRET' }
        ]);
    });

    it('should seed the api/admin internal-secret rule SEPARATELY from the api/web one (HOS-1153)', () => {
        // The separation is the fix, not a stylistic choice: the evaluator
        // short-circuits to `partial` on any unset side, so folding admin into
        // the api/web rule would disable that rule while the admin value is
        // missing. The resulting behaviour is pinned in
        // scripts/__tests__/check-env-rules.test.ts; this pins the shape.
        const rule = CROSS_CHECK_RULES.find(
            (r) => r.id === 'internal-request-secret-api-admin-match'
        );

        expect(rule).toBeDefined();
        expect(rule?.comparator).toBe('equals');
        expect(rule?.appliesTo).toEqual(['local', 'coolify']);
        expect(rule?.compare).toEqual([
            { app: 'api', key: 'HOSPEDA_INTERNAL_REQUEST_SECRET' },
            { app: 'admin', key: 'HOSPEDA_INTERNAL_REQUEST_SECRET' }
        ]);
    });

    it('should never reference a third app inside the api/web internal-secret rule (HOS-1153)', () => {
        // A future edit that "simplifies" the two rules back into one would
        // silently restore the fail-open. Anchored on the api/web rule's own
        // compare list, so unrelated rules cannot make this pass or fail.
        const apiWebRule = CROSS_CHECK_RULES.find(
            (r) => r.id === 'internal-request-secret-api-web-match'
        );

        expect(
            apiWebRule?.compare.map((side) => side.app),
            'The api/web internal-secret rule must compare exactly api and web. Any extra side disables the whole rule whenever that side is unset (HOS-1153 / HOS-155).'
        ).toEqual(['api', 'web']);
    });

    it('should seed the Sentry-environment rule spanning all three apps (H-16)', () => {
        const rule = CROSS_CHECK_RULES.find((r) => r.id === 'sentry-environment-all-apps-match');

        expect(rule).toBeDefined();
        expect(rule?.comparator).toBe('equals');
        // Coolify-only on purpose: H-16 was a per-resource misconfiguration, and
        // one app left unset in a developer's .env.local is not a defect.
        expect(rule?.appliesTo).toEqual(['coolify']);
        expect(rule?.compare).toEqual([
            { app: 'api', key: 'HOSPEDA_SENTRY_ENVIRONMENT' },
            { app: 'web', key: 'PUBLIC_SENTRY_ENVIRONMENT' },
            { app: 'admin', key: 'VITE_SENTRY_ENVIRONMENT' }
        ]);
    });

    it('should cover all three apps in the Sentry-environment rule — a missing side is a blind spot', () => {
        const rule = CROSS_CHECK_RULES.find((r) => r.id === 'sentry-environment-all-apps-match');
        const apps = rule?.compare.map((target) => target.app) ?? [];

        // The rule only catches H-16 if web is compared against BOTH other apps:
        // web alone, or web+api only, would have let the real prod drift through
        // on whichever pair was omitted.
        expect(new Set(apps)).toEqual(new Set(['api', 'web', 'admin']));
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
