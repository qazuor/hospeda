/**
 * @file owner-inherits-tourist.test.ts
 * @description SPEC-216 — every owner and complex plan is a superset of the
 * tourist-VIP tier. An owner is also a full tourist, so owner/complex plans must
 * grant the entire tourist-VIP entitlement + limit set in addition to their own.
 */

import { describe, expect, it } from 'vitest';
import { PLANS_BY_CATEGORY, TOURIST_VIP_PLAN } from '../src/config/plans.config.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';
import { LimitKey } from '../src/types/plan.types.js';

const VIP_ENTITLEMENTS = new Set(TOURIST_VIP_PLAN.entitlements);
const VIP_LIMIT_KEYS = new Set(TOURIST_VIP_PLAN.limits.map((l) => l.key));

const INHERITING_PLANS = [...PLANS_BY_CATEGORY.owner, ...PLANS_BY_CATEGORY.complex];

describe('SPEC-216 — owner/complex plans inherit the tourist-VIP tier', () => {
    it('there are 6 inheriting plans (3 owner + 3 complex)', () => {
        expect(INHERITING_PLANS).toHaveLength(6);
        expect(VIP_ENTITLEMENTS.size).toBeGreaterThanOrEqual(14);
        // 3 base tourist-VIP limits (favorites/alerts/compare) + 2 AI consumer
        // quotas (search + consumer-side chat) added by SPEC-283.
        expect(VIP_LIMIT_KEYS.size).toBe(5);
    });

    describe.each(INHERITING_PLANS)('$slug', (plan) => {
        it('grants every tourist-VIP entitlement (superset invariant)', () => {
            const granted = new Set(plan.entitlements);
            for (const key of VIP_ENTITLEMENTS) {
                expect(granted.has(key)).toBe(true);
            }
        });

        it('carries every tourist-VIP limit key', () => {
            const keys = new Set(plan.limits.map((l) => l.key));
            for (const key of VIP_LIMIT_KEYS) {
                expect(keys.has(key)).toBe(true);
            }
        });

        it('has no duplicate entitlements', () => {
            expect(new Set(plan.entitlements).size).toBe(plan.entitlements.length);
        });

        it('has no duplicate limit keys', () => {
            const keys = plan.limits.map((l) => l.key);
            expect(new Set(keys).size).toBe(keys.length);
        });
    });

    it('owner-specific entitlements are preserved', () => {
        const ownerBasico = PLANS_BY_CATEGORY.owner.find((p) => p.slug === 'owner-basico');
        expect(ownerBasico?.entitlements).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
        expect(ownerBasico?.entitlements).toContain(EntitlementKey.RESPOND_REVIEWS);

        const complexPremium = PLANS_BY_CATEGORY.complex.find((p) => p.slug === 'complex-premium');
        expect(complexPremium?.entitlements).toContain(EntitlementKey.MULTI_PROPERTY_MANAGEMENT);
        expect(complexPremium?.entitlements).toContain(EntitlementKey.STAFF_MANAGEMENT);
        expect(complexPremium?.entitlements).toContain(EntitlementKey.CUSTOM_BRANDING);
    });

    it('owner-specific limits stay authoritative (no clash today, mergeLimits keeps both)', () => {
        const ownerBasico = PLANS_BY_CATEGORY.owner.find((p) => p.slug === 'owner-basico');
        const maxAccommodations = ownerBasico?.limits.find(
            (l) => l.key === LimitKey.MAX_ACCOMMODATIONS
        );
        expect(maxAccommodations?.value).toBe(1);
        // inherited tourist-VIP limit is also present and unlimited
        const maxFavorites = ownerBasico?.limits.find((l) => l.key === LimitKey.MAX_FAVORITES);
        expect(maxFavorites?.value).toBe(-1);

        const complexPremium = PLANS_BY_CATEGORY.complex.find((p) => p.slug === 'complex-premium');
        const maxProperties = complexPremium?.limits.find((l) => l.key === LimitKey.MAX_PROPERTIES);
        expect(maxProperties?.value).toBe(-1);
    });

    it('an owner plan now grants the core tourist features (SAVE_FAVORITES, WRITE_REVIEWS)', () => {
        for (const plan of INHERITING_PLANS) {
            expect(plan.entitlements).toContain(EntitlementKey.SAVE_FAVORITES);
            expect(plan.entitlements).toContain(EntitlementKey.WRITE_REVIEWS);
            expect(plan.entitlements).toContain(EntitlementKey.READ_REVIEWS);
        }
    });
});
