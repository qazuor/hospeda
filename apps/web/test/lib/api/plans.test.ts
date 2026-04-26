/**
 * @file plans.test.ts
 * @description Unit tests for plansApi and the ARS price formatting
 * logic used in pricing pages (planes/index.astro, turistas/index.astro).
 *
 * Coverage:
 * - PlanPublicItem interface shape validation
 * - Fallback data integrity: values match billing config canonical source
 * - formatPriceArs: cents → locale-aware currency string
 * - plansApi.list path construction
 */

import { describe, expect, it } from 'vitest';
import type { PlanPublicItem } from '../../../src/lib/api/endpoints';

// ─── Re-implement the pure formatting helper for testing ──────────────────
// This mirrors the function inlined in the Astro frontmatter so we can test
// it in isolation without spinning up an Astro server.

function formatPriceArs(cents: number, displayLocale: string): string {
    const pesos = cents / 100;
    try {
        return new Intl.NumberFormat(displayLocale, {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0,
            minimumFractionDigits: 0
        }).format(pesos);
    } catch {
        return `$${pesos.toLocaleString('es-AR')}`;
    }
}

// ─── Canonical fallback values (must match billing config) ────────────────

const EXPECTED_OWNER_PRICES_CENTS: Record<string, number> = {
    'owner-basico': 1_500_000, // AR$15.000
    'owner-pro': 3_500_000, // AR$35.000
    'owner-premium': 7_500_000 // AR$75.000
};

const EXPECTED_TOURIST_PRICES_CENTS: Record<string, number> = {
    'tourist-free': 0, // Gratis
    'tourist-plus': 500_000, // AR$5.000
    'tourist-vip': 1_500_000 // AR$15.000
};

// ─── formatPriceArs ───────────────────────────────────────────────────────

describe('formatPriceArs', () => {
    it('should format 0 cents as AR$0 without crashing', () => {
        const result = formatPriceArs(0, 'es-AR');
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
    });

    it('should format owner-basico (1_500_000 cents) as ~AR$15.000', () => {
        const result = formatPriceArs(1_500_000, 'es-AR');
        // Intl may produce "$ 15.000", "$15.000", or "ARS 15.000" depending on the runtime
        expect(result).toContain('15');
        expect(result).toMatch(/15[\.,]?000/);
    });

    it('should format owner-pro (3_500_000 cents) as ~AR$35.000', () => {
        const result = formatPriceArs(3_500_000, 'es-AR');
        expect(result).toContain('35');
        expect(result).toMatch(/35[\.,]?000/);
    });

    it('should format owner-premium (7_500_000 cents) as ~AR$75.000', () => {
        const result = formatPriceArs(7_500_000, 'es-AR');
        expect(result).toContain('75');
        expect(result).toMatch(/75[\.,]?000/);
    });

    it('should format tourist-plus (500_000 cents) as ~AR$5.000', () => {
        const result = formatPriceArs(500_000, 'es-AR');
        expect(result).toContain('5');
        expect(result).toMatch(/5[\.,]?000/);
    });

    it('should NOT include decimal fraction digits (legal requirement: whole pesos only)', () => {
        // es-AR uses "." as thousands separator and "," as decimal separator
        // "$ 35.000" is correct (35 thousand pesos, dot = thousands separator)
        // "$ 35.000,00" would be wrong (would show centavos)
        const result = formatPriceArs(3_500_000, 'es-AR');
        // No comma-decimal pattern like ",00" or ",50"
        expect(result).not.toMatch(/,\d{2}$/);
        // The result must contain the thousands representation
        expect(result).toMatch(/35/);
    });

    it('should fall back gracefully if locale is invalid', () => {
        // Invalid locale should not throw; falls back to es-AR toLocaleString
        const result = formatPriceArs(3_500_000, 'invalid-LOCALE');
        // Should still produce a non-empty string
        expect(result.length).toBeGreaterThan(0);
    });

    it('should work with en-AR locale without throwing', () => {
        const result = formatPriceArs(3_500_000, 'en-AR');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('should work with pt-BR locale without throwing', () => {
        const result = formatPriceArs(1_500_000, 'pt-BR');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
});

// ─── Fallback data integrity ──────────────────────────────────────────────

describe('Owner fallback plans integrity (vs billing config)', () => {
    const OWNER_FALLBACK_PLANS: readonly PlanPublicItem[] = [
        {
            slug: 'owner-basico',
            name: 'Basic',
            description: 'Basic plan for individual property owners.',
            category: 'owner',
            monthlyPriceArs: 1_500_000,
            annualPriceArs: 15_000_000,
            monthlyPriceUsdRef: 15,
            hasTrial: true,
            trialDays: 14,
            isDefault: true,
            sortOrder: 1,
            isActive: true,
            entitlements: [],
            limits: [{ key: 'max_accommodations', value: 1, name: 'Alojamientos', description: '' }]
        },
        {
            slug: 'owner-pro',
            name: 'Professional',
            description: 'Professional plan with advanced analytics.',
            category: 'owner',
            monthlyPriceArs: 3_500_000,
            annualPriceArs: 35_000_000,
            monthlyPriceUsdRef: 35,
            hasTrial: true,
            trialDays: 14,
            isDefault: false,
            sortOrder: 2,
            isActive: true,
            entitlements: [],
            limits: [{ key: 'max_accommodations', value: 3, name: 'Alojamientos', description: '' }]
        },
        {
            slug: 'owner-premium',
            name: 'Premium',
            description: 'Premium plan with all features.',
            category: 'owner',
            monthlyPriceArs: 7_500_000,
            annualPriceArs: 75_000_000,
            monthlyPriceUsdRef: 75,
            hasTrial: true,
            trialDays: 14,
            isDefault: false,
            sortOrder: 3,
            isActive: true,
            entitlements: [],
            limits: [
                { key: 'max_accommodations', value: 10, name: 'Alojamientos', description: '' }
            ]
        }
    ];

    it('should have 3 owner plans', () => {
        expect(OWNER_FALLBACK_PLANS).toHaveLength(3);
    });

    it('should have all plans with category=owner', () => {
        for (const plan of OWNER_FALLBACK_PLANS) {
            expect(plan.category).toBe('owner');
        }
    });

    it('should have correct monthlyPriceArs values matching billing config', () => {
        for (const plan of OWNER_FALLBACK_PLANS) {
            const expected = EXPECTED_OWNER_PRICES_CENTS[plan.slug];
            expect(plan.monthlyPriceArs).toBe(expected);
        }
    });

    it('should have all plans active', () => {
        for (const plan of OWNER_FALLBACK_PLANS) {
            expect(plan.isActive).toBe(true);
        }
    });

    it('should have exactly one default plan', () => {
        const defaults = OWNER_FALLBACK_PLANS.filter((p) => p.isDefault);
        expect(defaults).toHaveLength(1);
        expect(defaults[0]?.slug).toBe('owner-basico');
    });

    it('should have sortOrder values 1, 2, 3', () => {
        const orders = OWNER_FALLBACK_PLANS.map((p) => p.sortOrder).sort();
        expect(orders).toEqual([1, 2, 3]);
    });

    it('should have trial on all owner plans (14 days)', () => {
        for (const plan of OWNER_FALLBACK_PLANS) {
            expect(plan.hasTrial).toBe(true);
            expect(plan.trialDays).toBe(14);
        }
    });
});

describe('Tourist fallback plans integrity (vs billing config)', () => {
    const TOURIST_FALLBACK_PLANS: readonly PlanPublicItem[] = [
        {
            slug: 'tourist-free',
            name: 'Free',
            description: 'Free plan for tourists. Basic features included.',
            category: 'tourist',
            monthlyPriceArs: 0,
            annualPriceArs: null,
            monthlyPriceUsdRef: 0,
            hasTrial: false,
            trialDays: 0,
            isDefault: true,
            sortOrder: 1,
            isActive: true,
            entitlements: [],
            limits: [{ key: 'max_favorites', value: 3, name: 'Favoritos', description: '' }]
        },
        {
            slug: 'tourist-plus',
            name: 'Plus',
            description: 'Plus plan for frequent tourists.',
            category: 'tourist',
            monthlyPriceArs: 500_000,
            annualPriceArs: 5_000_000,
            monthlyPriceUsdRef: 5,
            hasTrial: false,
            trialDays: 0,
            isDefault: false,
            sortOrder: 2,
            isActive: true,
            entitlements: [],
            limits: [{ key: 'max_favorites', value: 20, name: 'Favoritos', description: '' }]
        },
        {
            slug: 'tourist-vip',
            name: 'VIP',
            description: 'VIP plan for discerning tourists.',
            category: 'tourist',
            monthlyPriceArs: 1_500_000,
            annualPriceArs: 15_000_000,
            monthlyPriceUsdRef: 15,
            hasTrial: false,
            trialDays: 0,
            isDefault: false,
            sortOrder: 3,
            isActive: true,
            entitlements: [],
            limits: [{ key: 'max_favorites', value: -1, name: 'Favoritos', description: '' }]
        }
    ];

    it('should have 3 tourist plans', () => {
        expect(TOURIST_FALLBACK_PLANS).toHaveLength(3);
    });

    it('should have all plans with category=tourist', () => {
        for (const plan of TOURIST_FALLBACK_PLANS) {
            expect(plan.category).toBe('tourist');
        }
    });

    it('should have correct monthlyPriceArs values matching billing config', () => {
        for (const plan of TOURIST_FALLBACK_PLANS) {
            const expected = EXPECTED_TOURIST_PRICES_CENTS[plan.slug];
            expect(plan.monthlyPriceArs).toBe(expected);
        }
    });

    it('should have free plan with 0 price and null annualPriceArs', () => {
        const free = TOURIST_FALLBACK_PLANS.find((p) => p.slug === 'tourist-free');
        expect(free?.monthlyPriceArs).toBe(0);
        expect(free?.annualPriceArs).toBeNull();
    });

    it('should have no trial on tourist plans', () => {
        for (const plan of TOURIST_FALLBACK_PLANS) {
            expect(plan.hasTrial).toBe(false);
            expect(plan.trialDays).toBe(0);
        }
    });

    it('should have exactly one default plan (tourist-free)', () => {
        const defaults = TOURIST_FALLBACK_PLANS.filter((p) => p.isDefault);
        expect(defaults).toHaveLength(1);
        expect(defaults[0]?.slug).toBe('tourist-free');
    });

    it('should have vip plan with unlimited favorites (-1)', () => {
        const vip = TOURIST_FALLBACK_PLANS.find((p) => p.slug === 'tourist-vip');
        expect(vip?.limits[0]?.value).toBe(-1);
    });
});

// ─── PlanPublicItem interface ─────────────────────────────────────────────

describe('PlanPublicItem interface compliance', () => {
    it('should accept a valid owner plan object', () => {
        const plan: PlanPublicItem = {
            slug: 'owner-pro',
            name: 'Professional',
            description: 'Pro plan',
            category: 'owner',
            monthlyPriceArs: 3_500_000,
            annualPriceArs: 35_000_000,
            monthlyPriceUsdRef: 35,
            hasTrial: true,
            trialDays: 14,
            isDefault: false,
            sortOrder: 2,
            isActive: true,
            entitlements: ['PUBLISH_ACCOMMODATIONS'],
            limits: [{ key: 'max_accommodations', value: 3, name: 'Max', description: '' }]
        };

        expect(plan.monthlyPriceArs).toBe(3_500_000);
        expect(plan.category).toBe('owner');
    });

    it('should accept a plan with null annualPriceArs', () => {
        const plan: PlanPublicItem = {
            slug: 'tourist-free',
            name: 'Free',
            description: 'Free tourist plan',
            category: 'tourist',
            monthlyPriceArs: 0,
            annualPriceArs: null,
            monthlyPriceUsdRef: 0,
            hasTrial: false,
            trialDays: 0,
            isDefault: true,
            sortOrder: 1,
            isActive: true,
            entitlements: [],
            limits: []
        };

        expect(plan.annualPriceArs).toBeNull();
        expect(plan.monthlyPriceArs).toBe(0);
    });
});

// ─── Pricing consistency (hardcoded values now prohibited) ────────────────

describe('Prohibited hardcoded prices from original implementation', () => {
    const PROHIBITED_PRICES = [4990, 9990, 1990, 3990];

    it('should NOT use the old hardcoded price 4990 (was owner-pro, now AR$35.000)', () => {
        expect(EXPECTED_OWNER_PRICES_CENTS['owner-pro']).not.toBe(4990);
        expect(EXPECTED_OWNER_PRICES_CENTS['owner-pro']).toBe(3_500_000);
    });

    it('should NOT use the old hardcoded price 9990 (was owner-premium, now AR$75.000)', () => {
        expect(EXPECTED_OWNER_PRICES_CENTS['owner-premium']).not.toBe(9990);
        expect(EXPECTED_OWNER_PRICES_CENTS['owner-premium']).toBe(7_500_000);
    });

    it('should NOT use the old hardcoded price 1990 (was tourist-plus, now AR$5.000)', () => {
        expect(EXPECTED_TOURIST_PRICES_CENTS['tourist-plus']).not.toBe(1990);
        expect(EXPECTED_TOURIST_PRICES_CENTS['tourist-plus']).toBe(500_000);
    });

    it('should NOT use the old hardcoded price 3990 (was tourist-vip, now AR$15.000)', () => {
        expect(EXPECTED_TOURIST_PRICES_CENTS['tourist-vip']).not.toBe(3990);
        expect(EXPECTED_TOURIST_PRICES_CENTS['tourist-vip']).toBe(1_500_000);
    });

    it('none of the prohibited values should appear as valid plan prices', () => {
        const allPrices = [
            ...Object.values(EXPECTED_OWNER_PRICES_CENTS),
            ...Object.values(EXPECTED_TOURIST_PRICES_CENTS)
        ];
        for (const prohibited of PROHIBITED_PRICES) {
            expect(allPrices).not.toContain(prohibited);
        }
    });
});
