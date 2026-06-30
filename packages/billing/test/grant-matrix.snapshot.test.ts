/**
 * AC-4.3 — AI grant-matrix snapshot test (SPEC-211 Phase 4 §6.2, revised by
 * SPEC-283 — graduated per-plan AI usage limits).
 *
 * Asserts the COMPLETE AI entitlement + limit matrix across every plan × every
 * AI key. Any future change that:
 *   - re-adds the ai_chat or ai_search ENTITLEMENT to a plan that should not
 *     grant it (ai_search is auth-baseline — no entitlement on any plan), or
 *   - grants ai_support directly on a plan (instead of via addon), or
 *   - adds/removes ai_text_improve from any plan in the wrong direction, or
 *   - drifts a per-plan AI LIMIT value away from the SPEC-283 graduated tiers,
 * will cause this test to fail immediately.
 *
 * Design
 * ------
 * The expected matrix is expressed as plain data (EXPECTED_AI_MATRIX below),
 * keyed by plan slug. Each entry lists exactly which AI EntitlementKeys the
 * plan MUST grant — the complement (absent keys) is verified implicitly by
 * asserting the full set matches (no extras, no missing).
 *
 * AC-4.1 angle — the addon config seam
 * -------------------------------------
 * AI_SUPPORT never appears in this plan matrix because it is an addon-only
 * entitlement (see addons.test.ts — the AI_SUPPORT_ADDON tests cover the
 * config-shape angle). The snapshot test reinforces this by asserting
 * AI_SUPPORT is absent from every plan's grant set.
 *
 * AC-4.2 — DEFERRED
 * ------------------
 * Support-feature metering (ai_support keyed by host userId) cannot be tested
 * here: the ai_support route/feature is deferred to a future spec. See the
 * it.todo below.
 */

import { describe, expect, it } from 'vitest';
import { ALL_PLANS } from '../src/config/plans.config.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';
import { LimitKey } from '../src/types/plan.types.js';

// ─── AI entitlement and limit keys in scope ────────────────────────────────

const AI_ENTITLEMENTS = [
    EntitlementKey.AI_TEXT_IMPROVE,
    EntitlementKey.AI_CHAT,
    EntitlementKey.AI_SEARCH,
    EntitlementKey.AI_SUPPORT
] as const;

type AiEntitlementKey = (typeof AI_ENTITLEMENTS)[number];

const AI_LIMIT_KEYS = [
    LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
    LimitKey.MAX_AI_CHAT_PER_MONTH,
    LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH,
    LimitKey.MAX_AI_SEARCH_PER_MONTH,
    LimitKey.MAX_AI_SUPPORT_PER_MONTH
] as const;

// ─── Expected grant matrix (§6.2 final state) ─────────────────────────────

/**
 * The authoritative expected AI grant matrix derived from SPEC-211 §6.2 as
 * revised by SPEC-283 (graduated per-plan AI usage limits).
 *
 * ENTITLEMENT rules (unchanged from SPEC-211):
 *   - AI_TEXT_IMPROVE: owner-* + complex-* = yes; tourist-* = no.
 *   - AI_CHAT:         owner-* + complex-* = yes; tourist-* = NO (owner-paid).
 *   - AI_SEARCH:       NO plan — auth-baseline, no entitlement (OQ-1).
 *   - AI_SUPPORT:      NO plan (addon-only, not a plan entitlement; Phase 4).
 *
 * LIMIT rules (SPEC-283 — graduated per CONSUMER tier):
 *   - MAX_AI_SEARCH_PER_MONTH + MAX_AI_CHAT_CONSUMER_PER_MONTH are present on
 *     EVERY plan, keyed on the consuming user: tourist-free=10, tourist-plus=50,
 *     tourist-vip + all owner/complex (as consumers)=200 (OQ-4).
 *   - MAX_AI_CHAT_PER_MONTH (owner-side cost cap) stays owner/complex-only.
 *   - No AI limit is ever -1 (SPEC-211 §6.1 cost guardrail holds).
 */
interface PlanAiExpectation {
    /** Which AI entitlements the plan MUST grant. */
    readonly grants: ReadonlyArray<AiEntitlementKey>;
    /**
     * AI limits that MUST be present and finite (> 0, !== -1).
     * Absent AI limit keys should NOT appear in the plan's limits array.
     */
    readonly limitsPresent: ReadonlyArray<LimitKey>;
    /**
     * Exact quota values for the limits above, in the same order as
     * `limitsPresent`. Used to assert §6.1 Phase-0 replacements.
     */
    readonly limitValues: ReadonlyArray<number>;
}

const EXPECTED_AI_MATRIX: Readonly<Record<string, PlanAiExpectation>> = {
    'owner-basico': {
        grants: [EntitlementKey.AI_TEXT_IMPROVE, EntitlementKey.AI_CHAT],
        limitsPresent: [
            LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
            LimitKey.MAX_AI_CHAT_PER_MONTH,
            LimitKey.MAX_AI_SEARCH_PER_MONTH,
            LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH
        ],
        limitValues: [20, 20, 200, 200]
    },
    'owner-pro': {
        grants: [EntitlementKey.AI_TEXT_IMPROVE, EntitlementKey.AI_CHAT],
        limitsPresent: [
            LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
            LimitKey.MAX_AI_CHAT_PER_MONTH,
            LimitKey.MAX_AI_SEARCH_PER_MONTH,
            LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH
        ],
        limitValues: [100, 100, 200, 200]
    },
    'owner-premium': {
        grants: [EntitlementKey.AI_TEXT_IMPROVE, EntitlementKey.AI_CHAT],
        limitsPresent: [
            LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
            LimitKey.MAX_AI_CHAT_PER_MONTH,
            LimitKey.MAX_AI_SEARCH_PER_MONTH,
            LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH
        ],
        // Phase 0 §6.1: -1 replaced with finite values; SPEC-283 consumer quotas at 200
        limitValues: [1000, 2000, 200, 200]
    },
    'complex-basico': {
        grants: [EntitlementKey.AI_TEXT_IMPROVE, EntitlementKey.AI_CHAT],
        limitsPresent: [
            LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
            LimitKey.MAX_AI_CHAT_PER_MONTH,
            LimitKey.MAX_AI_SEARCH_PER_MONTH,
            LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH
        ],
        limitValues: [30, 30, 200, 200]
    },
    'complex-pro': {
        grants: [EntitlementKey.AI_TEXT_IMPROVE, EntitlementKey.AI_CHAT],
        limitsPresent: [
            LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
            LimitKey.MAX_AI_CHAT_PER_MONTH,
            LimitKey.MAX_AI_SEARCH_PER_MONTH,
            LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH
        ],
        limitValues: [150, 150, 200, 200]
    },
    'complex-premium': {
        grants: [EntitlementKey.AI_TEXT_IMPROVE, EntitlementKey.AI_CHAT],
        limitsPresent: [
            LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
            LimitKey.MAX_AI_CHAT_PER_MONTH,
            LimitKey.MAX_AI_SEARCH_PER_MONTH,
            LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH
        ],
        // Phase 0 §6.1: -1 replaced with finite values; SPEC-283 consumer quotas at 200
        limitValues: [2000, 5000, 200, 200]
    },
    'tourist-free': {
        grants: [],
        limitsPresent: [LimitKey.MAX_AI_SEARCH_PER_MONTH, LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH],
        limitValues: [10, 10]
    },
    'tourist-plus': {
        grants: [],
        limitsPresent: [LimitKey.MAX_AI_SEARCH_PER_MONTH, LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH],
        limitValues: [50, 50]
    },
    'tourist-vip': {
        grants: [],
        limitsPresent: [LimitKey.MAX_AI_SEARCH_PER_MONTH, LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH],
        limitValues: [200, 200]
    }
} as const;

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('AI grant-matrix snapshot (SPEC-211 §6.2 — AC-4.3)', () => {
    it('ALL_PLANS covers every slug in the expected matrix', () => {
        const actualSlugs = new Set(ALL_PLANS.map((p) => p.slug));
        const expectedSlugs = Object.keys(EXPECTED_AI_MATRIX);
        expect(expectedSlugs).toHaveLength(9);
        for (const slug of expectedSlugs) {
            expect(actualSlugs.has(slug), `slug "${slug}" missing from ALL_PLANS`).toBe(true);
        }
    });

    it('no plan outside the expected matrix exists in ALL_PLANS', () => {
        for (const plan of ALL_PLANS) {
            expect(
                Object.hasOwn(EXPECTED_AI_MATRIX, plan.slug),
                `Unexpected plan slug "${plan.slug}" — update EXPECTED_AI_MATRIX`
            ).toBe(true);
        }
    });

    // Iterate every plan × every AI entitlement key for an exhaustive check.
    for (const plan of ALL_PLANS) {
        describe(`plan: ${plan.slug} (category: ${plan.category})`, () => {
            const expected = EXPECTED_AI_MATRIX[plan.slug];

            for (const aiKey of AI_ENTITLEMENTS) {
                const shouldGrant = (expected.grants as ReadonlyArray<AiEntitlementKey>).includes(
                    aiKey
                );
                it(`${shouldGrant ? 'GRANTS' : 'does NOT grant'} ${aiKey}`, () => {
                    if (shouldGrant) {
                        expect(plan.entitlements).toContain(aiKey);
                    } else {
                        expect(plan.entitlements).not.toContain(aiKey);
                    }
                });
            }

            it('has exactly the expected AI limits present (no extras, no missing)', () => {
                const actualAiLimits = plan.limits.filter((l) =>
                    (AI_LIMIT_KEYS as ReadonlyArray<LimitKey>).includes(l.key)
                );
                const expectedLimitKeys = expected.limitsPresent;

                // No extras
                for (const actual of actualAiLimits) {
                    expect(
                        (expectedLimitKeys as ReadonlyArray<LimitKey>).includes(actual.key),
                        `plan "${plan.slug}" has unexpected AI limit key "${actual.key}"`
                    ).toBe(true);
                }

                // No missing
                for (const expectedKey of expectedLimitKeys) {
                    const found = plan.limits.find((l) => l.key === expectedKey);
                    expect(
                        found,
                        `plan "${plan.slug}" is missing expected AI limit key "${expectedKey}"`
                    ).toBeDefined();
                }
            });

            it('AI limit values match §6.2 (Phase-0 finite values in place)', () => {
                for (let i = 0; i < expected.limitsPresent.length; i++) {
                    const key = expected.limitsPresent[i];
                    const expectedValue = expected.limitValues[i];
                    const found = plan.limits.find((l) => l.key === key);
                    expect(found, `plan "${plan.slug}" missing limit "${key}"`).toBeDefined();
                    expect(found?.value).toBe(expectedValue);
                    // Reinforce Phase-0 cost guardrail: value must never be -1
                    expect(found?.value).not.toBe(-1);
                }
            });
        });
    }

    // ── Cross-plan structural invariants ──────────────────────────────────

    describe('cross-plan invariants', () => {
        it('AI_SEARCH entitlement is absent from every plan (auth-baseline, no entitlement gate — SPEC-283 OQ-1)', () => {
            for (const plan of ALL_PLANS) {
                expect(
                    plan.entitlements,
                    `plan "${plan.slug}" must not grant AI_SEARCH (auth-baseline)`
                ).not.toContain(EntitlementKey.AI_SEARCH);
            }
        });

        it('MAX_AI_SEARCH_PER_MONTH is present and finite on every plan (SPEC-283 graduated quota)', () => {
            for (const plan of ALL_PLANS) {
                const searchLimit = plan.limits.find(
                    (l) => l.key === LimitKey.MAX_AI_SEARCH_PER_MONTH
                );
                expect(
                    searchLimit,
                    `plan "${plan.slug}" must carry MAX_AI_SEARCH_PER_MONTH (SPEC-283)`
                ).toBeDefined();
                expect(
                    searchLimit?.value,
                    `plan "${plan.slug}" search quota must be > 0`
                ).toBeGreaterThan(0);
                expect(
                    searchLimit?.value,
                    `plan "${plan.slug}" search quota must not be -1`
                ).not.toBe(-1);
            }
        });

        it('MAX_AI_CHAT_CONSUMER_PER_MONTH is present and finite on every plan (SPEC-283 two-sided chat)', () => {
            for (const plan of ALL_PLANS) {
                const consumerLimit = plan.limits.find(
                    (l) => l.key === LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH
                );
                expect(
                    consumerLimit,
                    `plan "${plan.slug}" must carry MAX_AI_CHAT_CONSUMER_PER_MONTH (SPEC-283)`
                ).toBeDefined();
                expect(
                    consumerLimit?.value,
                    `plan "${plan.slug}" consumer chat quota must be > 0`
                ).toBeGreaterThan(0);
                expect(
                    consumerLimit?.value,
                    `plan "${plan.slug}" consumer chat quota must not be -1`
                ).not.toBe(-1);
            }
        });

        it('AI_SUPPORT is absent from every plan (addon-only, Phase 4)', () => {
            for (const plan of ALL_PLANS) {
                expect(
                    plan.entitlements,
                    `plan "${plan.slug}" must not grant AI_SUPPORT — it is an addon (ai-support-monthly)`
                ).not.toContain(EntitlementKey.AI_SUPPORT);
                const supportLimit = plan.limits.find(
                    (l) => l.key === LimitKey.MAX_AI_SUPPORT_PER_MONTH
                );
                expect(
                    supportLimit,
                    `plan "${plan.slug}" must not carry MAX_AI_SUPPORT_PER_MONTH`
                ).toBeUndefined();
            }
        });

        it('AI_CHAT is absent from all three tourist plans (Phase 1 / T-003)', () => {
            const touristPlans = ALL_PLANS.filter((p) => p.category === 'tourist');
            expect(touristPlans).toHaveLength(3);
            for (const plan of touristPlans) {
                expect(
                    plan.entitlements,
                    `tourist plan "${plan.slug}" must not grant AI_CHAT`
                ).not.toContain(EntitlementKey.AI_CHAT);
                const chatLimit = plan.limits.find((l) => l.key === LimitKey.MAX_AI_CHAT_PER_MONTH);
                expect(
                    chatLimit,
                    `tourist plan "${plan.slug}" must not carry MAX_AI_CHAT_PER_MONTH`
                ).toBeUndefined();
            }
        });

        it('AI_TEXT_IMPROVE is absent from all three tourist plans', () => {
            const touristPlans = ALL_PLANS.filter((p) => p.category === 'tourist');
            for (const plan of touristPlans) {
                expect(
                    plan.entitlements,
                    `tourist plan "${plan.slug}" must not grant AI_TEXT_IMPROVE`
                ).not.toContain(EntitlementKey.AI_TEXT_IMPROVE);
            }
        });

        it('AI_TEXT_IMPROVE and AI_CHAT are granted by all 6 host/complex plans', () => {
            const hostPlans = ALL_PLANS.filter(
                (p) => p.category === 'owner' || p.category === 'complex'
            );
            expect(hostPlans).toHaveLength(6);
            for (const plan of hostPlans) {
                expect(
                    plan.entitlements,
                    `host plan "${plan.slug}" must grant AI_TEXT_IMPROVE`
                ).toContain(EntitlementKey.AI_TEXT_IMPROVE);
                expect(plan.entitlements, `host plan "${plan.slug}" must grant AI_CHAT`).toContain(
                    EntitlementKey.AI_CHAT
                );
            }
        });

        it('no AI limit has value -1 across all plans (Phase-0 cost guardrail, AC-0.1)', () => {
            for (const plan of ALL_PLANS) {
                for (const aiKey of AI_LIMIT_KEYS) {
                    const found = plan.limits.find((l) => l.key === aiKey);
                    if (found) {
                        expect(
                            found.value,
                            `plan "${plan.slug}" limit "${aiKey}" must not be -1`
                        ).not.toBe(-1);
                    }
                }
            }
        });
    });

    // ── AC-4.2 (deferred) ─────────────────────────────────────────────────

    /**
     * AC-4.2 — ai_support metering is keyed by the host's userId (the addon
     * purchaser), NOT an accommodation's ownerId. This cannot be tested here
     * because the ai_support feature route (the surface that calls
     * recordAiUsage with { userId: hostId, feature: 'support' }) is deferred
     * to a future spec. Test belongs in the ai_support feature spec once the
     * route is built.
     */
    it.todo(
        'AC-4.2 (DEFERRED): ai_support metering is keyed by host userId, not ownerId — deferred to the ai_support feature spec'
    );
});
