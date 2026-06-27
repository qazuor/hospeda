import { describe, expect, it } from 'vitest';
import {
    ALL_PLANS,
    COMPLEX_BASICO_PLAN,
    COMPLEX_PREMIUM_PLAN,
    OWNER_BASICO_PLAN,
    OWNER_PRO_PLAN,
    PLANS_BY_CATEGORY,
    TOURIST_FREE_PLAN,
    TOURIST_VIP_PLAN,
    getDefaultPlan,
    getPlanBySlug,
    getUnlimitedEntitlements
} from '../src/config/plans.config.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';
import { LimitKey } from '../src/types/plan.types.js';

describe('Plan Configuration', () => {
    describe('ALL_PLANS', () => {
        it('should export 9 plans', () => {
            expect(ALL_PLANS).toHaveLength(9);
        });

        it('should have 3 owner plans', () => {
            const ownerPlans = ALL_PLANS.filter((p) => p.category === 'owner');
            expect(ownerPlans).toHaveLength(3);
        });

        it('should have 3 complex plans', () => {
            const complexPlans = ALL_PLANS.filter((p) => p.category === 'complex');
            expect(complexPlans).toHaveLength(3);
        });

        it('should have 3 tourist plans', () => {
            const touristPlans = ALL_PLANS.filter((p) => p.category === 'tourist');
            expect(touristPlans).toHaveLength(3);
        });
    });

    describe('PLANS_BY_CATEGORY', () => {
        it('should group plans correctly', () => {
            expect(PLANS_BY_CATEGORY.owner).toHaveLength(3);
            expect(PLANS_BY_CATEGORY.complex).toHaveLength(3);
            expect(PLANS_BY_CATEGORY.tourist).toHaveLength(3);
        });
    });

    describe('getPlanBySlug', () => {
        it('should return plan for valid slug', () => {
            const plan = getPlanBySlug('owner-basico');
            expect(plan).toBeDefined();
            expect(plan?.slug).toBe('owner-basico');
        });

        it('should return undefined for invalid slug', () => {
            const plan = getPlanBySlug('invalid-slug');
            expect(plan).toBeUndefined();
        });
    });

    describe('getDefaultPlan', () => {
        it('should return owner-basico as default for owner category', () => {
            const plan = getDefaultPlan('owner');
            expect(plan.slug).toBe('owner-basico');
            expect(plan.isDefault).toBe(true);
        });

        it('should return complex-basico as default for complex category', () => {
            const plan = getDefaultPlan('complex');
            expect(plan.slug).toBe('complex-basico');
            expect(plan.isDefault).toBe(true);
        });

        it('should return tourist-free as default for tourist category', () => {
            const plan = getDefaultPlan('tourist');
            expect(plan.slug).toBe('tourist-free');
            expect(plan.isDefault).toBe(true);
        });
    });

    describe('Plan Structure', () => {
        it('should have required fields in owner-basico plan', () => {
            expect(OWNER_BASICO_PLAN).toMatchObject({
                slug: 'owner-basico',
                name: 'Basic',
                category: 'owner',
                isActive: true,
                isDefault: true
            });
        });

        it('should have pricing in cents', () => {
            expect(OWNER_BASICO_PLAN.monthlyPriceArs).toBe(1500000); // ARS $15,000
        });

        it('should have entitlements array', () => {
            expect(Array.isArray(OWNER_BASICO_PLAN.entitlements)).toBe(true);
            expect(OWNER_BASICO_PLAN.entitlements.length).toBeGreaterThan(0);
        });

        it('should have limits array', () => {
            expect(Array.isArray(OWNER_BASICO_PLAN.limits)).toBe(true);
            expect(OWNER_BASICO_PLAN.limits.length).toBeGreaterThan(0);
        });
    });

    describe('Free Plans', () => {
        it('should have zero price for tourist-free plan', () => {
            expect(TOURIST_FREE_PLAN.monthlyPriceArs).toBe(0);
            expect(TOURIST_FREE_PLAN.annualPriceArs).toBeNull();
        });

        it('should not have trial for free plans', () => {
            expect(TOURIST_FREE_PLAN.hasTrial).toBe(false);
            expect(TOURIST_FREE_PLAN.trialDays).toBe(0);
        });
    });

    describe('Complex Plans', () => {
        it('should have multi-property management entitlement', () => {
            expect(COMPLEX_BASICO_PLAN.entitlements).toContain('multi_property_management');
        });

        it('should have MAX_PROPERTIES limit', () => {
            const propertiesLimit = COMPLEX_BASICO_PLAN.limits.find(
                (l) => l.key === 'max_properties'
            );
            expect(propertiesLimit).toBeDefined();
            expect(propertiesLimit?.value).toBeGreaterThan(0);
        });
    });

    describe('AI entitlements and limits matrix (SPEC-173)', () => {
        it('tourist-free should NOT have AI_TEXT_IMPROVE gate', () => {
            expect(TOURIST_FREE_PLAN.entitlements).not.toContain(EntitlementKey.AI_TEXT_IMPROVE);
        });

        it('tourist-free should NOT have max_ai_text_improve_per_month limit', () => {
            const found = TOURIST_FREE_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH
            );
            expect(found).toBeUndefined();
        });

        // SPEC-211 T-003: ai_chat removed from tourist plans entirely
        it('tourist-free should NOT have AI_CHAT entitlement (SPEC-211 T-003)', () => {
            expect(TOURIST_FREE_PLAN.entitlements).not.toContain(EntitlementKey.AI_CHAT);
        });

        it('tourist-free should NOT have MAX_AI_CHAT_PER_MONTH limit (SPEC-211 T-003)', () => {
            const found = TOURIST_FREE_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_AI_CHAT_PER_MONTH
            );
            expect(found).toBeUndefined();
        });

        // SPEC-211 T-003 + T-004: ai_chat and ai_search removed from tourist-vip
        it('tourist-vip should NOT have AI_CHAT entitlement or MAX_AI_CHAT_PER_MONTH limit (SPEC-211 T-003)', () => {
            expect(TOURIST_VIP_PLAN.entitlements).not.toContain(EntitlementKey.AI_CHAT);
            const chatLimit = TOURIST_VIP_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_AI_CHAT_PER_MONTH
            );
            expect(chatLimit).toBeUndefined();
        });

        it('tourist-vip should NOT grant AI_SEARCH entitlement but CARRIES MAX_AI_SEARCH_PER_MONTH=200 (SPEC-283 auth-baseline)', () => {
            // ai_search is auth-baseline: no entitlement gate (OQ-1), but a
            // graduated per-plan quota (SPEC-283 reverts SPEC-211 T-004's removal).
            expect(TOURIST_VIP_PLAN.entitlements).not.toContain(EntitlementKey.AI_SEARCH);
            const searchLimit = TOURIST_VIP_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_AI_SEARCH_PER_MONTH
            );
            expect(searchLimit?.value).toBe(200);
        });

        it('owner-pro max_ai_text_improve_per_month should be 100', () => {
            const found = OWNER_PRO_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH
            );
            expect(found).toBeDefined();
            expect(found?.value).toBe(100);
        });

        it('complex-premium AI limits should be finite — text 2000, chat 5000, search 200, consumer-chat 200 (SPEC-283)', () => {
            // SPEC-211 cost guardrail: no -1 on AI limits. SPEC-283 adds the
            // consumer-tier search + consumer-side chat quotas (200 at top tier).
            const presentLimits: ReadonlyArray<readonly [LimitKey, number]> = [
                [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 2000],
                [LimitKey.MAX_AI_CHAT_PER_MONTH, 5000],
                [LimitKey.MAX_AI_SEARCH_PER_MONTH, 200],
                [LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH, 200]
            ] as const;
            for (const [key, value] of presentLimits) {
                const found = COMPLEX_PREMIUM_PLAN.limits.find((l) => l.key === key);
                expect(found).toBeDefined();
                expect(found?.value).toBe(value);
            }
            // ai_search carries a quota but NO entitlement (auth-baseline, SPEC-283)
            expect(COMPLEX_PREMIUM_PLAN.entitlements).not.toContain(EntitlementKey.AI_SEARCH);
        });

        it('every plan with an AI gate should have the matching AI limit and vice versa', () => {
            // ai_support is ungranted on all plans (SPEC-200 pending). The
            // entitlement-gated AI features (text_improve, chat, translate,
            // accommodation_import) must each be co-present with their limit.
            //
            // ai_search and the consumer-side chat quota are DELIBERATELY excluded:
            // they are metering-only limits with no entitlement gate (ai_search is
            // auth-baseline per SPEC-283 OQ-1; MAX_AI_CHAT_CONSUMER_PER_MONTH gates
            // the consumer by count while AI_CHAT gates the owner). A limit without
            // a matching gate is correct by design for those two keys.
            const aiGateToLimit: ReadonlyArray<readonly [EntitlementKey, LimitKey]> = [
                [EntitlementKey.AI_TEXT_IMPROVE, LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH],
                [EntitlementKey.AI_CHAT, LimitKey.MAX_AI_CHAT_PER_MONTH],
                [EntitlementKey.AI_TRANSLATE, LimitKey.MAX_AI_TRANSLATE_PER_MONTH],
                [
                    EntitlementKey.AI_ACCOMMODATION_IMPORT,
                    LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH
                ]
            ] as const;

            for (const plan of ALL_PLANS) {
                for (const [gateKey, limitKey] of aiGateToLimit) {
                    const hasGate = plan.entitlements.includes(gateKey);
                    const hasLimit = plan.limits.some((l) => l.key === limitKey);
                    // Gate and limit must be present together or absent together
                    expect(hasGate).toBe(hasLimit);
                }
            }
        });

        it('NO plan should have AI_SUPPORT gate or MAX_AI_SUPPORT_PER_MONTH limit (SPEC-200 pending)', () => {
            // ai_support deliberately ungranted pending SPEC-200 audience decision (owner 2026-06-05)
            for (const plan of ALL_PLANS) {
                expect(plan.entitlements).not.toContain(EntitlementKey.AI_SUPPORT);
                expect(plan.limits.some((l) => l.key === LimitKey.MAX_AI_SUPPORT_PER_MONTH)).toBe(
                    false
                );
            }
        });

        it('NO plan should carry a -1 (unlimited) AI limit — cost guardrail (SPEC-211 Phase 0, AC-0.1)', () => {
            // The cost guardrail forbids unlimited AI on any client plan: a present
            // AI limit must be finite and positive. Absent keys are fine (the plan
            // simply does not grant that AI feature). Staff get unlimited via
            // getUnlimitedEntitlements(), which is intentionally out of scope here.
            const aiLimitKeys = [
                LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
                LimitKey.MAX_AI_CHAT_PER_MONTH,
                LimitKey.MAX_AI_SEARCH_PER_MONTH,
                LimitKey.MAX_AI_SUPPORT_PER_MONTH,
                LimitKey.MAX_AI_TRANSLATE_PER_MONTH,
                LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH
            ] as const;
            for (const plan of ALL_PLANS) {
                for (const key of aiLimitKeys) {
                    const found = plan.limits.find((l) => l.key === key);
                    if (found) {
                        expect(found.value).not.toBe(-1);
                        expect(found.value).toBeGreaterThan(0);
                    }
                }
            }
        });

        // AC-1.4 (SPEC-211 T-003): no tourist plan grants AI_CHAT or carries MAX_AI_CHAT_PER_MONTH
        it('AC-1.4: no tourist plan lists AI_CHAT entitlement or MAX_AI_CHAT_PER_MONTH limit (SPEC-211 T-003)', () => {
            const touristPlans = ALL_PLANS.filter((p) => p.category === 'tourist');
            for (const plan of touristPlans) {
                expect(plan.entitlements).not.toContain(EntitlementKey.AI_CHAT);
                expect(plan.limits.some((l) => l.key === LimitKey.MAX_AI_CHAT_PER_MONTH)).toBe(
                    false
                );
            }
        });

        // AC-3.1 (SPEC-211 T-004) as revised by SPEC-283: ai_search carries no
        // entitlement on any plan (auth-baseline) but DOES carry a per-plan quota.
        it('AC-3.1 (SPEC-283): NO plan grants AI_SEARCH entitlement, but every plan carries MAX_AI_SEARCH_PER_MONTH', () => {
            for (const plan of ALL_PLANS) {
                expect(plan.entitlements).not.toContain(EntitlementKey.AI_SEARCH);
                const searchLimit = plan.limits.find(
                    (l) => l.key === LimitKey.MAX_AI_SEARCH_PER_MONTH
                );
                expect(
                    searchLimit,
                    `plan "${plan.slug}" must carry MAX_AI_SEARCH_PER_MONTH (SPEC-283)`
                ).toBeDefined();
            }
        });
    });

    describe('getUnlimitedEntitlements (SPEC-171)', () => {
        it('should grant every EntitlementKey', () => {
            const { entitlements } = getUnlimitedEntitlements();
            const allKeys = Object.values(EntitlementKey);

            expect(entitlements).toHaveLength(allKeys.length);
            for (const key of allKeys) {
                expect(entitlements).toContain(key);
            }
        });

        it('should include every LimitKey set to the unlimited sentinel (-1)', () => {
            const { limits } = getUnlimitedEntitlements();
            const allLimitKeys = Object.values(LimitKey);

            expect(limits).toHaveLength(allLimitKeys.length);
            for (const key of allLimitKeys) {
                const found = limits.find((l) => l.key === key);
                expect(found).toBeDefined();
                expect(found?.value).toBe(-1);
            }
        });

        it('should produce limit definitions with metadata (name + description)', () => {
            const { limits } = getUnlimitedEntitlements();
            for (const def of limits) {
                expect(typeof def.name).toBe('string');
                expect(def.name).toBeTruthy();
                expect(typeof def.description).toBe('string');
                expect(def.description).toBeTruthy();
            }
        });

        it('should materialize into Set + Map the same way as getDefaultEntitlements', () => {
            const { entitlements, limits } = getUnlimitedEntitlements();
            const entitlementSet = new Set(entitlements);
            const limitMap = new Map(limits.map((l) => [l.key, l.value]));

            expect(entitlementSet.has(EntitlementKey.PUBLISH_ACCOMMODATIONS)).toBe(true);
            expect(limitMap.get(LimitKey.MAX_ACCOMMODATIONS)).toBe(-1);
        });
    });
});
