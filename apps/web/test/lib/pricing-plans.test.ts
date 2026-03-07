/**
 * Tests for pricing-plans.ts - Pricing plan display logic with API + fallback support.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the protected endpoints module to prevent real API calls
vi.mock('@/lib/api/endpoints-protected', () => ({
    plansApi: {
        list: vi.fn()
    }
}));

import { OWNER_FALLBACK_PLANS, TOURIST_FALLBACK_PLANS } from '@/lib/pricing-fallbacks';

describe('fetchTouristPlans', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return fallback plans when API returns ok=false', async () => {
        // Arrange
        const { plansApi } = await import('@/lib/api/endpoints-protected');
        vi.mocked(plansApi.list).mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'Server error' }
        });

        const { fetchTouristPlans } = await import('@/lib/pricing-plans');

        // Act
        const result = await fetchTouristPlans('es');

        // Assert
        expect(result).toEqual(TOURIST_FALLBACK_PLANS.es);
    });

    it('should return fallback plans when API throws', async () => {
        const { plansApi } = await import('@/lib/api/endpoints-protected');
        vi.mocked(plansApi.list).mockRejectedValue(new Error('Network failure'));

        const { fetchTouristPlans } = await import('@/lib/pricing-plans');

        const result = await fetchTouristPlans('en');
        expect(result).toEqual(TOURIST_FALLBACK_PLANS.en);
    });

    it('should return fallback when API returns no tourist plans', async () => {
        const { plansApi } = await import('@/lib/api/endpoints-protected');
        vi.mocked(plansApi.list).mockResolvedValue({
            ok: true,
            data: {
                items: [{ category: 'owner', slug: 'owner-basic' }],
                pagination: { totalPages: 1, total: 1, page: 1, pageSize: 10 }
            }
        });

        const { fetchTouristPlans } = await import('@/lib/pricing-plans');

        const result = await fetchTouristPlans('es');
        expect(result).toEqual(TOURIST_FALLBACK_PLANS.es);
    });

    it('should map API tourist plans when available', async () => {
        const { plansApi } = await import('@/lib/api/endpoints-protected');
        vi.mocked(plansApi.list).mockResolvedValue({
            ok: true,
            data: {
                items: [
                    {
                        category: 'tourist',
                        slug: 'tourist-free',
                        name: 'Gratis',
                        monthlyPriceArs: 0,
                        monthlyPriceUsdRef: 0,
                        description: 'Plan gratuito',
                        sortOrder: 1
                    },
                    {
                        category: 'tourist',
                        slug: 'tourist-plus',
                        name: 'Plus',
                        monthlyPriceArs: 500000,
                        monthlyPriceUsdRef: 5,
                        description: 'Plan plus',
                        sortOrder: 2
                    }
                ],
                pagination: { totalPages: 1, total: 2, page: 1, pageSize: 10 }
            }
        });

        const { fetchTouristPlans } = await import('@/lib/pricing-plans');

        const result = await fetchTouristPlans('es');
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        // Verify required PricingPlan fields are present
        for (const plan of result) {
            expect(typeof plan.name).toBe('string');
            expect(typeof plan.price).toBe('number');
            expect(typeof plan.currency).toBe('string');
            expect(typeof plan.period).toBe('string');
            expect(Array.isArray(plan.features)).toBe(true);
            expect(typeof plan.cta.label).toBe('string');
            expect(typeof plan.cta.href).toBe('string');
        }
    });

    it('should return pt fallback plans', async () => {
        const { plansApi } = await import('@/lib/api/endpoints-protected');
        vi.mocked(plansApi.list).mockResolvedValue({
            ok: false,
            error: { status: 503, message: 'Unavailable' }
        });

        const { fetchTouristPlans } = await import('@/lib/pricing-plans');

        const result = await fetchTouristPlans('pt');
        expect(result).toEqual(TOURIST_FALLBACK_PLANS.pt);
    });
});

describe('fetchOwnerPlans', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return fallback plans when API returns ok=false', async () => {
        const { plansApi } = await import('@/lib/api/endpoints-protected');
        vi.mocked(plansApi.list).mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'Server error' }
        });

        const { fetchOwnerPlans } = await import('@/lib/pricing-plans');

        const result = await fetchOwnerPlans('es');
        expect(result).toEqual(OWNER_FALLBACK_PLANS.es);
    });

    it('should return fallback plans when API throws', async () => {
        const { plansApi } = await import('@/lib/api/endpoints-protected');
        vi.mocked(plansApi.list).mockRejectedValue(new Error('Timeout'));

        const { fetchOwnerPlans } = await import('@/lib/pricing-plans');

        const result = await fetchOwnerPlans('en');
        expect(result).toEqual(OWNER_FALLBACK_PLANS.en);
    });

    it('should return fallback when API returns no owner plans', async () => {
        const { plansApi } = await import('@/lib/api/endpoints-protected');
        vi.mocked(plansApi.list).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { totalPages: 1, total: 0, page: 1, pageSize: 10 } }
        });

        const { fetchOwnerPlans } = await import('@/lib/pricing-plans');

        const result = await fetchOwnerPlans('es');
        expect(result).toEqual(OWNER_FALLBACK_PLANS.es);
    });

    it('should map API owner plans with correct currency for en locale', async () => {
        const { plansApi } = await import('@/lib/api/endpoints-protected');
        vi.mocked(plansApi.list).mockResolvedValue({
            ok: true,
            data: {
                items: [
                    {
                        category: 'owner',
                        slug: 'owner-basico',
                        name: 'Basico',
                        monthlyPriceArs: 1500000,
                        monthlyPriceUsdRef: 15,
                        description: 'Basic plan',
                        sortOrder: 1
                    }
                ],
                pagination: { totalPages: 1, total: 1, page: 1, pageSize: 10 }
            }
        });

        const { fetchOwnerPlans } = await import('@/lib/pricing-plans');

        const result = await fetchOwnerPlans('en');
        expect(result.length).toBe(1);
        // en locale uses USD ref price
        expect(result[0]?.currency).toBe('USD');
        expect(result[0]?.price).toBe(15);
    });

    it('should use ARS price (divided by 100) for es locale', async () => {
        const { plansApi } = await import('@/lib/api/endpoints-protected');
        vi.mocked(plansApi.list).mockResolvedValue({
            ok: true,
            data: {
                items: [
                    {
                        category: 'owner',
                        slug: 'owner-basico',
                        name: 'Basico',
                        monthlyPriceArs: 1500000,
                        monthlyPriceUsdRef: 15,
                        description: 'Basic plan',
                        sortOrder: 1
                    }
                ],
                pagination: { totalPages: 1, total: 1, page: 1, pageSize: 10 }
            }
        });

        const { fetchOwnerPlans } = await import('@/lib/pricing-plans');

        const result = await fetchOwnerPlans('es');
        expect(result[0]?.currency).toBe('ARS');
        // 1500000 centavos / 100 = 15000
        expect(result[0]?.price).toBe(15000);
    });
});

describe('re-exported fallback plans', () => {
    it('should re-export TOURIST_FALLBACK_PLANS', async () => {
        const { TOURIST_FALLBACK_PLANS: reExported } = await import('@/lib/pricing-plans');
        expect(reExported).toBeDefined();
        expect(reExported.es).toBeDefined();
    });

    it('should re-export OWNER_FALLBACK_PLANS', async () => {
        const { OWNER_FALLBACK_PLANS: reExported } = await import('@/lib/pricing-plans');
        expect(reExported).toBeDefined();
        expect(reExported.es).toBeDefined();
    });
});
