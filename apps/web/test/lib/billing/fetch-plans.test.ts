/**
 * @file billing/fetch-plans.test.ts
 * @description Unit tests for the fetch-plans helper (SPEC-168 T-016).
 *
 * Covers:
 * - fetchPublicPlans returns ok:true with a parsed plan array on 200
 * - fetchPublicPlans returns ok:false on non-OK HTTP status
 * - fetchPublicPlans returns ok:false on network error
 * - fetchPublicPlans returns ok:false when the response body is not an array
 * - filterPlansByCategory filters by category and isActive, sorts by sortOrder
 * - exported constants have the expected values
 *
 * Fetch is mocked globally — no real HTTP requests are made.
 * getApiUrl() is module-mocked to avoid triggering validateWebEnv() which
 * reads import.meta.env and is not available in the Vitest jsdom context.
 */

import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import {
    PRICING_CACHE_MAX_AGE_SECONDS,
    PRICING_CACHE_SWR_SECONDS,
    fetchPublicPlans,
    filterPlansByCategory
} from '@/lib/billing/fetch-plans';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Module-level mock: bypass validateWebEnv() which requires import.meta.env.
// Pattern established by apps/web/test/pages/sitemap-dynamic.test.ts.
vi.mock('@/lib/env', () => ({
    getApiUrl: vi.fn(() => 'http://api.test')
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePlan = (overrides: Partial<PublicPlanData> = {}): PublicPlanData => ({
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico',
    category: 'owner',
    monthlyPriceArs: 1000,
    annualPriceArs: 10000,
    monthlyPriceUsdRef: 5,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 1,
    isActive: true,
    entitlements: ['ACCOMMODATION_LIST'],
    limits: { max_accommodations: 1 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

const OWNER_ACTIVE = makePlan({
    slug: 'owner-basico',
    category: 'owner',
    isActive: true,
    sortOrder: 2
});
const OWNER_INACTIVE = makePlan({
    slug: 'owner-inactivo',
    category: 'owner',
    isActive: false,
    sortOrder: 1
});
const TOURIST_ACTIVE = makePlan({
    slug: 'tourist-basico',
    category: 'tourist',
    isActive: true,
    sortOrder: 1
});
const TOURIST_ACTIVE_2 = makePlan({
    slug: 'tourist-plus',
    category: 'tourist',
    isActive: true,
    sortOrder: 3
});
const TOURIST_ACTIVE_3 = makePlan({
    slug: 'tourist-premium',
    category: 'tourist',
    isActive: true,
    sortOrder: 2
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchOk(body: unknown): void {
    global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body)
    } as Response);
}

function mockFetchHttpError(status: number): void {
    global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status,
        json: () => Promise.resolve({ error: { message: 'Not found' } })
    } as Response);
}

function mockFetchNetworkError(message: string): void {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error(message));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchPublicPlans', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('successful response', () => {
        it('returns ok:true with the plan array when the endpoint returns 200', async () => {
            // Arrange
            const plans = [OWNER_ACTIVE, TOURIST_ACTIVE];
            mockFetchOk(plans);

            // Act
            const result = await fetchPublicPlans();

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            expect(result.plans).toHaveLength(2);
            expect(result.plans[0]?.slug).toBe('owner-basico');
        });

        it('calls fetch with the correct URL path', async () => {
            // Arrange
            mockFetchOk([]);

            // Act
            await fetchPublicPlans();

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/public/plans'),
                expect.objectContaining({ headers: { Accept: 'application/json' } })
            );
        });

        it('returns ok:true with an empty array when the endpoint returns []', async () => {
            // Arrange
            mockFetchOk([]);

            // Act
            const result = await fetchPublicPlans();

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            expect(result.plans).toHaveLength(0);
        });
    });

    describe('error cases', () => {
        it('returns ok:false with an error message on HTTP 500', async () => {
            // Arrange
            mockFetchHttpError(500);

            // Act
            const result = await fetchPublicPlans();

            // Assert
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected ok:false');
            expect(result.error).toContain('500');
        });

        it('returns ok:false with an error message on HTTP 503', async () => {
            // Arrange
            mockFetchHttpError(503);

            // Act
            const result = await fetchPublicPlans();

            // Assert
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected ok:false');
            expect(result.error).toContain('503');
        });

        it('returns ok:false on network error', async () => {
            // Arrange
            mockFetchNetworkError('ECONNREFUSED');

            // Act
            const result = await fetchPublicPlans();

            // Assert
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected ok:false');
            expect(result.error).toBe('ECONNREFUSED');
        });

        it('returns ok:false when response body is not an array (object)', async () => {
            // Arrange
            mockFetchOk({ data: [] });

            // Act
            const result = await fetchPublicPlans();

            // Assert
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected ok:false');
            expect(result.error).toContain('array');
        });

        it('returns ok:false when response body is a string', async () => {
            // Arrange
            mockFetchOk('unexpected string');

            // Act
            const result = await fetchPublicPlans();

            // Assert
            expect(result.ok).toBe(false);
        });
    });
});

describe('filterPlansByCategory', () => {
    it('filters to the requested category only', () => {
        // Arrange
        const plans = [OWNER_ACTIVE, TOURIST_ACTIVE, TOURIST_ACTIVE_2] as const;

        // Act
        const result = filterPlansByCategory(plans, 'tourist');

        // Assert
        expect(result.every((p) => p.category === 'tourist')).toBe(true);
        expect(result).toHaveLength(2);
    });

    it('excludes inactive plans', () => {
        // Arrange
        const plans = [OWNER_ACTIVE, OWNER_INACTIVE] as const;

        // Act
        const result = filterPlansByCategory(plans, 'owner');

        // Assert
        expect(result.every((p) => p.isActive)).toBe(true);
        expect(result).toHaveLength(1);
        expect(result[0]?.slug).toBe('owner-basico');
    });

    it('sorts active plans by sortOrder ascending', () => {
        // Arrange — tourist plans are intentionally out of order
        const plans = [TOURIST_ACTIVE_2, TOURIST_ACTIVE_3, TOURIST_ACTIVE] as const;

        // Act
        const result = filterPlansByCategory(plans, 'tourist');

        // Assert
        expect(result.map((p) => p.sortOrder)).toEqual([1, 2, 3]);
    });

    it('returns an empty array when no plans match the category', () => {
        // Arrange
        const plans = [OWNER_ACTIVE] as const;

        // Act
        const result = filterPlansByCategory(plans, 'tourist');

        // Assert
        expect(result).toHaveLength(0);
    });

    it('returns an empty array when the input list is empty', () => {
        // Act
        const result = filterPlansByCategory([], 'owner');

        // Assert
        expect(result).toHaveLength(0);
    });
});

describe('cache constants', () => {
    it('PRICING_CACHE_MAX_AGE_SECONDS is a positive number', () => {
        expect(typeof PRICING_CACHE_MAX_AGE_SECONDS).toBe('number');
        expect(PRICING_CACHE_MAX_AGE_SECONDS).toBeGreaterThan(0);
    });

    it('PRICING_CACHE_SWR_SECONDS is a positive number', () => {
        expect(typeof PRICING_CACHE_SWR_SECONDS).toBe('number');
        expect(PRICING_CACHE_SWR_SECONDS).toBeGreaterThan(0);
    });

    it('PRICING_CACHE_MAX_AGE_SECONDS is 300', () => {
        expect(PRICING_CACHE_MAX_AGE_SECONDS).toBe(300);
    });

    it('PRICING_CACHE_SWR_SECONDS is 60', () => {
        expect(PRICING_CACHE_SWR_SECONDS).toBe(60);
    });
});
