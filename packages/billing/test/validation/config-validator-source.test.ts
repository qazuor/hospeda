/**
 * Tests for billing configuration validator - exercises actual source code paths.
 *
 * Unlike config-validator.test.ts which uses a local reimplementation,
 * these tests mock the config imports and call the real validateBillingConfig
 * and validateBillingConfigOrThrow functions to achieve source code coverage.
 *
 * HOS-1290: the validator now walks `ALL_PLAN_CATALOGS` (every vertical's
 * plan catalogue) instead of `ALL_PLANS` alone, and groups its per-catalogue
 * checks (sortOrder uniqueness, "exactly one default") by `productDomain`
 * rather than by `PlanCategory` — every commerce/partner tier shares
 * `category: 'owner'` to satisfy the (commerce-unaware) `PlanCategory` type,
 * so `category` can no longer tell verticals apart. The mock below reflects
 * that: `ALL_PLAN_CATALOGS` is TWO independently-controllable mock arrays
 * (`[mockAllPlans, mockSecondCatalogPlans]`), not one — a single-catalogue
 * mock cannot tell "walks every catalogue" apart from "walks only the
 * first", which is exactly the regression HOS-1290 fixes. Every
 * `createTestPlan` MUST declare a `productDomain` since it is a required
 * `PlanDefinition` field.
 */

import { ProductDomainEnum } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PromoCodeDefinition } from '../../src/config/promo-codes.config.js';
import type { AddonDefinition } from '../../src/types/addon.types.js';
import { EntitlementKey } from '../../src/types/entitlement.types.js';
import { LimitKey, type PlanDefinition } from '../../src/types/plan.types.js';
import {
    validateBillingConfig,
    validateBillingConfigOrThrow
} from '../../src/validation/config-validator.js';

// Mock @repo/logger before importing the module under test
vi.mock('@repo/logger', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

// We'll dynamically mock the config module in each test group
const mockAllPlans: PlanDefinition[] = [];
// A SECOND, independent catalogue — never populated by most tests, but
// essential to a handful that prove the validator walks EVERY entry of
// `ALL_PLAN_CATALOGS`, not merely the first (see "should validate a plan
// that exists ONLY in the second catalogue"). A regression that narrows
// `ALL_PLAN_CATALOGS.flat()` back to `ALL_PLAN_CATALOGS[0]` would still pass
// every OTHER test in this file, because they only ever populate
// `mockAllPlans` — this is the one structurally able to catch it.
const mockSecondCatalogPlans: PlanDefinition[] = [];
const mockAllAddons: AddonDefinition[] = [];
const mockDefaultPromoCodes: PromoCodeDefinition[] = [];

vi.mock('../../src/config/index.js', () => ({
    // HOS-1290: the real module exports `ALL_PLAN_CATALOGS` (an array of
    // catalogues), not a single `ALL_PLANS` array.
    get ALL_PLAN_CATALOGS() {
        return [mockAllPlans, mockSecondCatalogPlans];
    },
    get ALL_ADDONS() {
        return mockAllAddons;
    },
    get DEFAULT_PROMO_CODES() {
        return mockDefaultPromoCodes;
    }
}));

// Import AFTER mocks are set up

// ─── HELPERS ──────────────────────────────────────────────────────

/** Creates a valid test plan with overrides */
function createTestPlan(overrides: Partial<PlanDefinition> = {}): PlanDefinition {
    return {
        slug: 'test-plan',
        name: 'Test Plan',
        description: 'Test description',
        category: 'owner',
        productDomain: ProductDomainEnum.ACCOMMODATION,
        monthlyPriceArs: 1000000,
        annualPriceArs: 10000000,
        monthlyPriceUsdRef: 10,
        hasTrial: true,
        trialDays: 7,
        isDefault: false,
        sortOrder: 1,
        isActive: true,
        entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS],
        limits: [
            {
                key: LimitKey.MAX_ACCOMMODATIONS,
                value: 1,
                name: 'Max Accommodations',
                description: 'Maximum number of accommodations'
            }
        ],
        ...overrides
    };
}

/** Creates a valid test addon with overrides */
function createTestAddon(overrides: Partial<AddonDefinition> = {}): AddonDefinition {
    return {
        slug: 'test-addon',
        name: 'Test Addon',
        description: 'Test description',
        billingType: 'one_time',
        priceArs: 500000,
        annualPriceArs: null,
        durationDays: 7,
        affectsLimitKey: null,
        limitIncrease: null,
        grantsEntitlement: null,
        targetCategories: ['owner'],
        isActive: true,
        sortOrder: 1,
        ...overrides
    };
}

/** Creates a valid test promo code with overrides */
function createTestPromo(overrides: Partial<PromoCodeDefinition> = {}): PromoCodeDefinition {
    return {
        code: 'TESTCODE',
        description: 'Test promo code',
        discountPercent: 20,
        isPermanent: false,
        durationCycles: 1,
        maxRedemptions: 100,
        expiresAt: null,
        restrictedToPlans: null,
        newUserOnly: false,
        isActive: true,
        ...overrides
    };
}

/** Replaces mock arrays in-place with new data */
function setMockConfig(config: {
    plans?: PlanDefinition[];
    /** Plans that live in the SECOND catalogue, not the first. */
    secondCatalogPlans?: PlanDefinition[];
    addons?: AddonDefinition[];
    promoCodes?: PromoCodeDefinition[];
}): void {
    mockAllPlans.length = 0;
    mockSecondCatalogPlans.length = 0;
    mockAllAddons.length = 0;
    mockDefaultPromoCodes.length = 0;

    if (config.plans) {
        mockAllPlans.push(...config.plans);
    }
    if (config.secondCatalogPlans) {
        mockSecondCatalogPlans.push(...config.secondCatalogPlans);
    }
    if (config.addons) {
        mockAllAddons.push(...config.addons);
    }
    if (config.promoCodes) {
        mockDefaultPromoCodes.push(...config.promoCodes);
    }
}

// ─── TESTS ────────────────────────────────────────────────────────

describe('validateBillingConfig (source coverage)', () => {
    afterEach(() => {
        setMockConfig({});
    });

    describe('valid configurations', () => {
        it('should return valid with one default per product domain', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'owner-1',
                        productDomain: ProductDomainEnum.ACCOMMODATION,
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'gastronomy-1',
                        productDomain: ProductDomainEnum.GASTRONOMY,
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'tourist-1',
                        productDomain: ProductDomainEnum.TOURIST,
                        isDefault: true,
                        sortOrder: 1
                    })
                ],
                addons: [createTestAddon()],
                promoCodes: [createTestPromo()]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should report a missing default for accommodation/tourist but NOT for a zero-default-allowed domain, when config is empty', () => {
            // Arrange
            setMockConfig({});

            // Act
            const result = validateBillingConfig();

            // Assert — an empty config has NO plans at all, so no product
            // domain appears in the map and nothing is flagged (there is
            // nothing to require a default OF). This mirrors HOS-692's old
            // "complex is allowed empty" case, generalized: a domain with
            // zero plans in the input never triggers "no default found" —
            // only a domain that appears WITH zero of its plans marked
            // default does (see the next test).
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('flags accommodation/tourist for a missing default, but not gastronomy/experience/partner (HOS-1290)', () => {
            // Arrange — one plan per domain, none marked default.
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'owner-1',
                        productDomain: ProductDomainEnum.ACCOMMODATION,
                        isDefault: false,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'tourist-1',
                        productDomain: ProductDomainEnum.TOURIST,
                        isDefault: false,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'gastronomy-1',
                        productDomain: ProductDomainEnum.GASTRONOMY,
                        isDefault: false,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'experience-1',
                        productDomain: ProductDomainEnum.EXPERIENCE,
                        isDefault: false,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'partner-1',
                        productDomain: ProductDomainEnum.PARTNER,
                        isDefault: false,
                        sortOrder: 1
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Product domain "accommodation": No default plan found'
            );
            expect(result.errors).toContain('Product domain "tourist": No default plan found');
            expect(result.errors).not.toContain(
                'Product domain "gastronomy": No default plan found'
            );
            expect(result.errors).not.toContain(
                'Product domain "experience": No default plan found'
            );
            expect(result.errors).not.toContain('Product domain "partner": No default plan found');
        });
    });

    describe('plan validation errors', () => {
        it('should detect duplicate plan slugs', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({ slug: 'dup', isDefault: true, sortOrder: 1 }),
                    createTestPlan({ slug: 'dup', sortOrder: 2 })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Plan "dup": Duplicate slug found');
        });

        it('should detect a duplicate slug even across DIFFERENT ALL_PLAN_CATALOGS entries (HOS-1290)', () => {
            // Arrange — this is exactly the class of bug HOS-1290 fixes: a
            // commerce-domain plan slug colliding with an accommodation one
            // used to be invisible because the validator only ever saw
            // ALL_PLANS. The two colliding plans are placed in TWO DIFFERENT
            // mock catalogues (not the same array) so this only passes if
            // the validator actually walks every entry of
            // `ALL_PLAN_CATALOGS`.
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'cross-domain-dup',
                        productDomain: ProductDomainEnum.ACCOMMODATION,
                        isDefault: true,
                        sortOrder: 1
                    })
                ],
                secondCatalogPlans: [
                    createTestPlan({
                        slug: 'cross-domain-dup',
                        productDomain: ProductDomainEnum.GASTRONOMY,
                        sortOrder: 1
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Plan "cross-domain-dup": Duplicate slug found');
        });

        it('validates a plan that exists ONLY in the second catalogue (HOS-1290 — catches a narrowed-to-first-catalogue regression)', () => {
            // Arrange — no plan at all in the first mock catalogue; the
            // ENTIRE input lives in the second one. A validator that reads
            // `ALL_PLAN_CATALOGS[0]` instead of flattening every entry would
            // see zero plans here and report this config as valid.
            setMockConfig({
                secondCatalogPlans: [
                    createTestPlan({
                        slug: 'second-catalog-only',
                        productDomain: ProductDomainEnum.GASTRONOMY,
                        monthlyPriceArs: -1,
                        isDefault: false
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Plan "second-catalog-only": monthlyPriceArs must be >= 0, got -1'
            );
        });

        it('should detect negative monthlyPriceArs', () => {
            // Arrange
            setMockConfig({
                plans: [createTestPlan({ monthlyPriceArs: -100, isDefault: true })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Plan "test-plan": monthlyPriceArs must be >= 0, got -100'
            );
        });

        it('should detect negative monthlyPriceArs on a GASTRONOMY-domain plan (HOS-1290 regression)', () => {
            // Arrange — before HOS-1290, a negative price on a commerce plan
            // never reached the validator at all (it wasn't in ALL_PLANS),
            // so the API started up without a complaint.
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'gastronomy-broken',
                        productDomain: ProductDomainEnum.GASTRONOMY,
                        monthlyPriceArs: -500,
                        isDefault: false
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Plan "gastronomy-broken": monthlyPriceArs must be >= 0, got -500'
            );
        });

        it('should detect negative annualPriceArs', () => {
            // Arrange
            setMockConfig({
                plans: [createTestPlan({ annualPriceArs: -200, isDefault: true })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Plan "test-plan": annualPriceArs must be >= 0, got -200'
            );
        });

        it('should allow null annualPriceArs', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        annualPriceArs: null,
                        isDefault: true,
                        productDomain: ProductDomainEnum.ACCOMMODATION,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 't1',
                        productDomain: ProductDomainEnum.TOURIST,
                        isDefault: true,
                        sortOrder: 1
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(true);
        });

        it('should detect negative monthlyPriceUsdRef', () => {
            // Arrange
            setMockConfig({
                plans: [createTestPlan({ monthlyPriceUsdRef: -5, isDefault: true })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Plan "test-plan": monthlyPriceUsdRef must be >= 0, got -5'
            );
        });

        it('should detect negative trialDays when hasTrial is true', () => {
            // Arrange
            setMockConfig({
                plans: [createTestPlan({ hasTrial: true, trialDays: -3, isDefault: true })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Plan "test-plan": trialDays must be >= 0 when hasTrial is true, got -3'
            );
        });

        it('should not check trialDays when hasTrial is false', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        hasTrial: false,
                        trialDays: -1,
                        isDefault: true,
                        productDomain: ProductDomainEnum.ACCOMMODATION,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 't1',
                        productDomain: ProductDomainEnum.TOURIST,
                        isDefault: true,
                        sortOrder: 1
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(true);
        });

        it('should detect invalid entitlement keys', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        entitlements: ['BOGUS_KEY' as EntitlementKey],
                        isDefault: true
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Plan "test-plan": Invalid entitlement key "BOGUS_KEY"'
            );
        });

        it('should detect duplicate sortOrder within the same product domain', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'p1',
                        isDefault: true,
                        sortOrder: 1,
                        productDomain: ProductDomainEnum.ACCOMMODATION
                    }),
                    createTestPlan({
                        slug: 'p2',
                        isDefault: false,
                        sortOrder: 1,
                        productDomain: ProductDomainEnum.ACCOMMODATION
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Plan "p2": Duplicate sortOrder 1 in product domain "accommodation"'
            );
        });

        it('should pass when different product domains share the same sortOrder', () => {
            // Arrange — this is the exact case that used to false-positive
            // once commerce/partner plans (all `category: 'owner'`) were fed
            // into the old category-keyed check: gastronomy's own sortOrder
            // 1/2/3 ladder must NOT collide with accommodation's.
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'owner-plan',
                        productDomain: ProductDomainEnum.ACCOMMODATION,
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'gastronomy-plan',
                        productDomain: ProductDomainEnum.GASTRONOMY,
                        isDefault: false,
                        sortOrder: 1
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect no default plan in the accommodation domain', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'p1',
                        isDefault: false,
                        sortOrder: 1,
                        productDomain: ProductDomainEnum.ACCOMMODATION
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Product domain "accommodation": No default plan found'
            );
        });

        it('should detect multiple default plans in the accommodation domain', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'p1',
                        isDefault: true,
                        sortOrder: 1,
                        productDomain: ProductDomainEnum.ACCOMMODATION
                    }),
                    createTestPlan({
                        slug: 'p2',
                        isDefault: true,
                        sortOrder: 2,
                        productDomain: ProductDomainEnum.ACCOMMODATION
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Product domain "accommodation": Multiple default plans found (2)'
            );
        });

        it('should still detect multiple defaults on a zero-default-allowed domain (gastronomy)', () => {
            // Arrange — DOMAINS_ALLOWED_ZERO_DEFAULT permits ZERO defaults,
            // never MORE THAN ONE. Two commerce plans both claiming
            // isDefault:true is still a real config bug.
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'g1',
                        isDefault: true,
                        sortOrder: 1,
                        productDomain: ProductDomainEnum.GASTRONOMY
                    }),
                    createTestPlan({
                        slug: 'g2',
                        isDefault: true,
                        sortOrder: 2,
                        productDomain: ProductDomainEnum.GASTRONOMY
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Product domain "gastronomy": Multiple default plans found (2)'
            );
        });
    });

    describe('addon validation errors', () => {
        it('should detect addon with priceArs <= 0', () => {
            // Arrange
            setMockConfig({
                addons: [createTestAddon({ priceArs: 0 })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Addon "test-addon": priceArs must be > 0, got 0');
        });

        it('should detect duplicate addon slugs', () => {
            // Arrange
            setMockConfig({
                addons: [
                    createTestAddon({ slug: 'dup-addon', sortOrder: 1 }),
                    createTestAddon({ slug: 'dup-addon', sortOrder: 2 })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Addon "dup-addon": Duplicate slug found');
        });

        it('should detect null limitIncrease when affectsLimitKey is set', () => {
            // Arrange
            setMockConfig({
                addons: [
                    createTestAddon({
                        affectsLimitKey: LimitKey.MAX_ACCOMMODATIONS,
                        limitIncrease: null
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Addon "test-addon": limitIncrease must be > 0 when affectsLimitKey is set, got null'
            );
        });

        it('should detect zero limitIncrease when affectsLimitKey is set', () => {
            // Arrange
            setMockConfig({
                addons: [
                    createTestAddon({
                        affectsLimitKey: LimitKey.MAX_ACCOMMODATIONS,
                        limitIncrease: 0
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Addon "test-addon": limitIncrease must be > 0 when affectsLimitKey is set, got 0'
            );
        });

        it('should detect invalid grantsEntitlement', () => {
            // Arrange
            setMockConfig({
                addons: [
                    createTestAddon({
                        grantsEntitlement: 'FAKE_ENTITLEMENT' as EntitlementKey
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Addon "test-addon": Invalid entitlement key "FAKE_ENTITLEMENT"'
            );
        });

        it('should detect null annualPriceArs for recurring addons', () => {
            // Arrange
            setMockConfig({
                addons: [
                    createTestAddon({
                        billingType: 'recurring',
                        annualPriceArs: null
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Addon "test-addon": annualPriceArs must be defined and > 0 for recurring addons, got null'
            );
        });

        it('should detect zero annualPriceArs for recurring addons', () => {
            // Arrange
            setMockConfig({
                addons: [
                    createTestAddon({
                        billingType: 'recurring',
                        annualPriceArs: 0
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Addon "test-addon": annualPriceArs must be defined and > 0 for recurring addons, got 0'
            );
        });

        it('should allow null annualPriceArs for one_time addons', () => {
            // Arrange
            setMockConfig({
                addons: [
                    createTestAddon({
                        billingType: 'one_time',
                        annualPriceArs: null
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            // No addon errors expected for annualPriceArs
            const addonAnnualErrors = result.errors.filter((e) => e.includes('annualPriceArs'));
            expect(addonAnnualErrors).toHaveLength(0);
        });

        it('should pass addon with valid affectsLimitKey and positive limitIncrease', () => {
            // Arrange
            setMockConfig({
                addons: [
                    createTestAddon({
                        affectsLimitKey: LimitKey.MAX_ACCOMMODATIONS,
                        limitIncrease: 5
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            const limitErrors = result.errors.filter((e) => e.includes('limitIncrease'));
            expect(limitErrors).toHaveLength(0);
        });
    });

    describe('promo code validation', () => {
        it('should detect duplicate promo codes', () => {
            // Arrange
            setMockConfig({
                promoCodes: [createTestPromo({ code: 'DUPE' }), createTestPromo({ code: 'DUPE' })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Promo code "DUPE": Duplicate code found');
        });

        it('should detect discount percent out of range (> 100)', () => {
            // Arrange
            setMockConfig({
                promoCodes: [createTestPromo({ discountPercent: 150 })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Promo code "TESTCODE": discountPercent must be between 0 and 100, got 150'
            );
        });

        it('should detect discount percent out of range (< 0)', () => {
            // Arrange
            setMockConfig({
                promoCodes: [createTestPromo({ discountPercent: -10 })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Promo code "TESTCODE": discountPercent must be between 0 and 100, got -10'
            );
        });

        it('should warn about expired promo codes', () => {
            // Arrange - include default plans to avoid product-domain errors
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'o1',
                        productDomain: ProductDomainEnum.ACCOMMODATION,
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 't1',
                        productDomain: ProductDomainEnum.TOURIST,
                        isDefault: true,
                        sortOrder: 1
                    })
                ],
                promoCodes: [createTestPromo({ expiresAt: new Date('2020-01-01') })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(true); // Warnings don't make it invalid
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain('Promo code "TESTCODE": Promo code has expired');
        });

        it('should not warn about non-expired promo codes', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'o1',
                        productDomain: ProductDomainEnum.ACCOMMODATION,
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 't1',
                        productDomain: ProductDomainEnum.TOURIST,
                        isDefault: true,
                        sortOrder: 1
                    })
                ],
                promoCodes: [createTestPromo({ expiresAt: new Date('2099-12-31') })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.warnings).toHaveLength(0);
        });

        it('should detect references to non-existent plan slugs', () => {
            // Arrange
            setMockConfig({
                plans: [createTestPlan({ slug: 'real-plan', isDefault: true })],
                promoCodes: [createTestPromo({ restrictedToPlans: ['fake-plan'] })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.errors).toContain(
                'Promo code "TESTCODE": References non-existent plan slug "fake-plan"'
            );
        });

        it('should pass when restrictedToPlans references existing plans', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({ slug: 'plan-a', isDefault: true, sortOrder: 1 }),
                    createTestPlan({ slug: 'plan-b', sortOrder: 2 })
                ],
                promoCodes: [createTestPromo({ restrictedToPlans: ['plan-a', 'plan-b'] })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            const promoErrors = result.errors.filter((e) => e.includes('Promo code'));
            expect(promoErrors).toHaveLength(0);
        });

        it('should pass when restrictedToPlans is null', () => {
            // Arrange
            setMockConfig({
                promoCodes: [createTestPromo({ restrictedToPlans: null })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            const promoErrors = result.errors.filter((e) => e.includes('Promo code'));
            expect(promoErrors).toHaveLength(0);
        });

        it('should pass when restrictedToPlans references a GASTRONOMY-domain plan slug (HOS-1290 regression)', () => {
            // Arrange — before HOS-1290, a promo restricted to a commerce
            // plan slug ALWAYS failed startup: the validator only knew
            // ALL_PLANS's slugs, so a real, existing gastronomy plan read as
            // "non-existent" and threw on every boot.
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'gastronomy-premium',
                        productDomain: ProductDomainEnum.GASTRONOMY,
                        isDefault: false,
                        sortOrder: 1
                    })
                ],
                promoCodes: [createTestPromo({ restrictedToPlans: ['gastronomy-premium'] })]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            const promoErrors = result.errors.filter((e) => e.includes('Promo code'));
            expect(promoErrors).toHaveLength(0);
        });
    });
});

describe('validateBillingConfigOrThrow (source coverage)', () => {
    afterEach(() => {
        setMockConfig({});
    });

    it('should not throw when config is valid', () => {
        // Arrange
        setMockConfig({
            plans: [
                createTestPlan({
                    slug: 'o1',
                    productDomain: ProductDomainEnum.ACCOMMODATION,
                    isDefault: true,
                    sortOrder: 1
                }),
                createTestPlan({
                    slug: 't1',
                    productDomain: ProductDomainEnum.TOURIST,
                    isDefault: true,
                    sortOrder: 1
                })
            ],
            addons: [createTestAddon()],
            promoCodes: [createTestPromo()]
        });

        // Act & Assert
        expect(() => validateBillingConfigOrThrow()).not.toThrow();
    });

    it('should throw when config has errors', () => {
        // Arrange
        setMockConfig({
            plans: [createTestPlan({ monthlyPriceArs: -999, isDefault: true })]
        });

        // Act & Assert
        expect(() => validateBillingConfigOrThrow()).toThrow(
            'Billing configuration validation failed'
        );
    });

    it('should include error details in thrown message', () => {
        // Arrange
        setMockConfig({
            addons: [createTestAddon({ priceArs: -1 })]
        });

        // Act & Assert
        expect(() => validateBillingConfigOrThrow()).toThrow('priceArs must be > 0');
    });

    it('should throw when a commerce-domain promo restriction breaks startup (HOS-1290 inverse case)', () => {
        // Arrange — the exact "promo restricted to a commerce plan tears
        // down the boot" bug named in HOS-1290, reproduced with NO plan
        // registered under that slug at all (so it MUST still error).
        setMockConfig({
            plans: [
                createTestPlan({
                    slug: 'o1',
                    productDomain: ProductDomainEnum.ACCOMMODATION,
                    isDefault: true,
                    sortOrder: 1
                })
            ],
            promoCodes: [createTestPromo({ restrictedToPlans: ['gastronomy-does-not-exist'] })]
        });

        // Act & Assert
        expect(() => validateBillingConfigOrThrow()).toThrow(
            'References non-existent plan slug "gastronomy-does-not-exist"'
        );
    });

    it('should log warnings without throwing when config is otherwise valid', () => {
        // Arrange
        setMockConfig({
            plans: [
                createTestPlan({
                    slug: 'o1',
                    productDomain: ProductDomainEnum.ACCOMMODATION,
                    isDefault: true,
                    sortOrder: 1
                }),
                createTestPlan({
                    slug: 't1',
                    productDomain: ProductDomainEnum.TOURIST,
                    isDefault: true,
                    sortOrder: 1
                })
            ],
            promoCodes: [createTestPromo({ expiresAt: new Date('2020-01-01') })]
        });

        // Act & Assert - should not throw despite warnings
        expect(() => validateBillingConfigOrThrow()).not.toThrow();
    });

    it('should throw with multiple errors formatted', () => {
        // Arrange
        setMockConfig({
            plans: [
                createTestPlan({
                    slug: 'bad',
                    monthlyPriceArs: -1,
                    annualPriceArs: -1,
                    isDefault: true
                })
            ]
        });

        // Act
        let thrownError: Error | undefined;
        try {
            validateBillingConfigOrThrow();
        } catch (e) {
            thrownError = e as Error;
        }

        // Assert
        expect(thrownError).toBeDefined();
        expect(thrownError?.message).toContain('monthlyPriceArs');
        expect(thrownError?.message).toContain('annualPriceArs');
    });
});
