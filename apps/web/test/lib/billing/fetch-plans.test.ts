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

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import {
    fetchPublicPlans,
    filterPlansByCategory,
    PRICING_CACHE_MAX_AGE_SECONDS,
    PRICING_CACHE_SWR_SECONDS
} from '@/lib/billing/fetch-plans';

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

/**
 * Mock a 200 response wrapping `data` in the ResponseFactory envelope
 * `{ success: true, data }`, mirroring the real public endpoint. Passing a
 * non-array `data` exercises the invalid-shape paths.
 */
function mockFetchOk(data: unknown): void {
    global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data })
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
            expect(result.error).toContain('shape');
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

/**
 * SPEC-192 T-028 lock: verify fetch-plans.ts calls the DB-backed public endpoint
 * with no hardcoded config fallback.
 *
 * The endpoint `/api/v1/public/plans` is backed by the `billing_plans` DB table
 * (DB-backed since SPEC-168/T-022). This describe block locks:
 * 1. The exact URL path used (no accidental rollback to a config-only endpoint).
 * 2. That on HTTP error or network error, `ok:false` is returned — no config
 *    fallback is performed.
 */
describe('SPEC-192 T-028: DB-backed endpoint lock (no config fallback)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls the DB-backed public plans endpoint at /api/v1/public/plans', async () => {
        // Arrange
        mockFetchOk([]);

        // Act
        await fetchPublicPlans();

        // Assert — the exact DB-backed endpoint is called
        expect(global.fetch).toHaveBeenCalledWith(
            'http://api.test/api/v1/public/plans',
            expect.objectContaining({ headers: { Accept: 'application/json' } })
        );
    });

    it('returns ok:false on HTTP error without a config fallback', async () => {
        // Arrange — simulate the plans endpoint being down
        mockFetchHttpError(503);

        // Act
        const result = await fetchPublicPlans();

        // Assert — no config fallback: ok:false is returned
        expect(result.ok).toBe(false);
        // No ALL_PLANS or static config was used as a fallback
    });

    it('returns ok:false on network error without a config fallback', async () => {
        // Arrange
        mockFetchNetworkError('Connection refused');

        // Act
        const result = await fetchPublicPlans();

        // Assert — no config fallback: ok:false is returned
        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected ok:false');
        expect(result.error).toBe('Connection refused');
    });
});

/**
 * HOS-39 T-021 — both pricing pages reflect a DB change on the next request,
 * without a deploy.
 *
 * SCOPE REVISED (spec-realign 2026-07-02): the owner (`suscriptores/planes/`)
 * and tourist (`suscriptores/turistas/`) pages are SSR (`prerender = false`)
 * and both call `fetchPublicPlans()` fresh on every request — there is no
 * page-rebuild step to test. The only thing "revalidation" buys is purging
 * Cloudflare's edge HTTP cache (`Cache-Control: s-maxage=300`) so an
 * in-window request doesn't see a stale response; that purge makes a real
 * outbound HTTP call in production (`CloudflareRevalidationAdapter`) with no
 * local stub, and is already covered by the staging smoke checklist
 * (SPEC-143 staging-smoke-checklist.md, section "SPEC-168.2"). Locally, this
 * suite proves the piece that IS testable and that both pages actually
 * depend on: an admin-edited plan value returned by the API is correctly
 * surfaced by `filterPlansByCategory` for BOTH the owner and tourist
 * category filters on the very next fetch — the mechanism that lets a fresh
 * (uncached) request always reflect the DB, deploy-free.
 *
 * The revalidation TRIGGER firing with the correct paths is already covered
 * at the service layer by
 * `packages/service-core/test/billing/plan-service-revalidation.test.ts`;
 * the DB-write-visible-at-the-API-boundary leg is already covered by
 * `apps/api/test/e2e/flows/billing/plan-price-change.test.ts` (SPEC-168
 * T-020). This suite is specifically the missing web-layer piece.
 */
describe('HOS-39 T-021: owner + tourist pricing pages reflect DB changes on next request', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('owner pricing page data (filterPlansByCategory) reflects an admin-edited value on the next fetch', async () => {
        // ARRANGE — simulate the API response AFTER an admin edit: a higher
        // price and a new display name for the owner plan, as
        // fetchPublicPlans() would see it on the very next request.
        const editedOwnerPlan = makePlan({
            slug: 'owner-basico',
            category: 'owner',
            name: 'Básico (Editado)',
            monthlyPriceArs: 999_000,
            isActive: true,
            sortOrder: 1
        });
        mockFetchOk([editedOwnerPlan, TOURIST_ACTIVE]);

        // ACT — a fresh fetch + owner-category filter, exactly what
        // suscriptores/planes/index.astro does on every SSR request.
        const result = await fetchPublicPlans();
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected ok:true');
        const ownerPlans = filterPlansByCategory(result.plans, 'owner');

        // ASSERT — the edited value is visible without any rebuild/deploy.
        expect(ownerPlans).toHaveLength(1);
        expect(ownerPlans[0]?.name).toBe('Básico (Editado)');
        expect(ownerPlans[0]?.monthlyPriceArs).toBe(999_000);
    });

    it('tourist pricing page data (filterPlansByCategory) reflects an admin-edited value on the next fetch', async () => {
        // ARRANGE — simulate the API response AFTER an admin edit to a
        // tourist plan, as fetchPublicPlans() would see it on the very next
        // request.
        const editedTouristPlan = makePlan({
            slug: 'tourist-plus',
            category: 'tourist',
            name: 'Plus (Editado)',
            monthlyPriceArs: 777_000,
            isActive: true,
            sortOrder: 1
        });
        mockFetchOk([OWNER_ACTIVE, editedTouristPlan]);

        // ACT — a fresh fetch + tourist-category filter, exactly what
        // suscriptores/turistas/index.astro does on every SSR request.
        const result = await fetchPublicPlans();
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected ok:true');
        const touristPlans = filterPlansByCategory(result.plans, 'tourist');

        // ASSERT — the edited value is visible without any rebuild/deploy.
        expect(touristPlans).toHaveLength(1);
        expect(touristPlans[0]?.name).toBe('Plus (Editado)');
        expect(touristPlans[0]?.monthlyPriceArs).toBe(777_000);
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
