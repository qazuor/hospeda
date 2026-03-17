/**
 * Tests for billing configuration validator - exercises actual source code paths.
 *
 * Unlike config-validator.test.ts which uses a local reimplementation,
 * these tests mock the config imports and call the real validateBillingConfig
 * and validateBillingConfigOrThrow functions to achieve source code coverage.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PromoCodeDefinition } from '../../src/config/promo-codes.config.js';
import type { AddonDefinition } from '../../src/types/addon.types.js';
import { EntitlementKey } from '../../src/types/entitlement.types.js';
import { LimitKey, type PlanDefinition } from '../../src/types/plan.types.js';

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
const mockAllAddons: AddonDefinition[] = [];
const mockDefaultPromoCodes: PromoCodeDefinition[] = [];

vi.mock('../../src/config/index.js', () => ({
    get ALL_PLANS() {
        return mockAllPlans;
    },
    get ALL_ADDONS() {
        return mockAllAddons;
    },
    get DEFAULT_PROMO_CODES() {
        return mockDefaultPromoCodes;
    }
}));

// Import AFTER mocks are set up
const { validateBillingConfig, validateBillingConfigOrThrow } = await import(
    '../../src/validation/config-validator.js'
);

// ─── HELPERS ──────────────────────────────────────────────────────

/** Creates a valid test plan with overrides */
function createTestPlan(overrides: Partial<PlanDefinition> = {}): PlanDefinition {
    return {
        slug: 'test-plan',
        name: 'Test Plan',
        description: 'Test description',
        category: 'owner',
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
    addons?: AddonDefinition[];
    promoCodes?: PromoCodeDefinition[];
}): void {
    mockAllPlans.length = 0;
    mockAllAddons.length = 0;
    mockDefaultPromoCodes.length = 0;

    if (config.plans) {
        mockAllPlans.push(...config.plans);
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
        it('should return valid for a complete valid config with one default per category', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'owner-1',
                        category: 'owner',
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'complex-1',
                        category: 'complex',
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'tourist-1',
                        category: 'tourist',
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

        it('should report missing defaults for all categories when config is empty', () => {
            // Arrange
            setMockConfig({});

            // Act
            const result = validateBillingConfig();

            // Assert - all 3 categories report missing default
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Category "owner": No default plan found');
            expect(result.errors).toContain('Category "complex": No default plan found');
            expect(result.errors).toContain('Category "tourist": No default plan found');
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
                        category: 'owner',
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'c1',
                        category: 'complex',
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 't1',
                        category: 'tourist',
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
                        category: 'owner',
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'c1',
                        category: 'complex',
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 't1',
                        category: 'tourist',
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

        it('should detect duplicate sortOrder within the same category', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'p1',
                        isDefault: true,
                        sortOrder: 1,
                        category: 'owner'
                    }),
                    createTestPlan({
                        slug: 'p2',
                        isDefault: false,
                        sortOrder: 1,
                        category: 'owner'
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Plan "p2": Duplicate sortOrder 1 in category "owner"');
        });

        it('should detect no default plan in a category', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'p1',
                        isDefault: false,
                        sortOrder: 1,
                        category: 'owner'
                    })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Category "owner": No default plan found');
        });

        it('should detect multiple default plans in a category', () => {
            // Arrange
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'p1',
                        isDefault: true,
                        sortOrder: 1,
                        category: 'owner'
                    }),
                    createTestPlan({ slug: 'p2', isDefault: true, sortOrder: 2, category: 'owner' })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Category "owner": Multiple default plans found (2)');
        });

        it('should report missing default for categories without plans', () => {
            // Arrange - only owner plans, no complex/tourist
            setMockConfig({
                plans: [
                    createTestPlan({ slug: 'p1', isDefault: true, sortOrder: 1, category: 'owner' })
                ]
            });

            // Act
            const result = validateBillingConfig();

            // Assert
            // The source checks ALL categories even if there are no plans for them
            expect(result.errors).toContain('Category "complex": No default plan found');
            expect(result.errors).toContain('Category "tourist": No default plan found');
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
            // Arrange - include default plans to avoid category errors
            setMockConfig({
                plans: [
                    createTestPlan({
                        slug: 'o1',
                        category: 'owner',
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'c1',
                        category: 'complex',
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 't1',
                        category: 'tourist',
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
                        category: 'owner',
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 'c1',
                        category: 'complex',
                        isDefault: true,
                        sortOrder: 1
                    }),
                    createTestPlan({
                        slug: 't1',
                        category: 'tourist',
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
                createTestPlan({ slug: 'o1', category: 'owner', isDefault: true, sortOrder: 1 }),
                createTestPlan({ slug: 'c1', category: 'complex', isDefault: true, sortOrder: 1 }),
                createTestPlan({ slug: 't1', category: 'tourist', isDefault: true, sortOrder: 1 })
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

    it('should log warnings without throwing when config is otherwise valid', () => {
        // Arrange
        setMockConfig({
            plans: [
                createTestPlan({ slug: 'o1', category: 'owner', isDefault: true, sortOrder: 1 }),
                createTestPlan({ slug: 'c1', category: 'complex', isDefault: true, sortOrder: 1 }),
                createTestPlan({ slug: 't1', category: 'tourist', isDefault: true, sortOrder: 1 })
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
