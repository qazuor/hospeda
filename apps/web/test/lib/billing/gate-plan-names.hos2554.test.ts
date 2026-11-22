/**
 * @file gate-plan-names.hos2554.test.ts
 * @description HOS-2554: the shared server reader returns the catalog's plan names for an
 * entitlement, reads the catalog once per window, and yields no names on a failed read.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchPlansResult, PublicPlanData } from '../../../src/lib/billing/fetch-plans';
import {
    CATALOG_FAILURE_TTL_MS,
    CATALOG_TTL_MS,
    clearGatePlanCatalogCache,
    getGatePlanNames
} from '../../../src/lib/billing/gate-plan-names';

const fetchPublicPlans = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/billing/fetch-plans', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/lib/billing/fetch-plans')>()),
    fetchPublicPlans
}));

const plan = (name: string, entitlements: string[]): PublicPlanData => ({
    id: name,
    vertical: 'tourist',
    slug: name.toLowerCase(),
    name,
    description: '',
    category: 'tourist',
    monthlyPriceArs: 1,
    annualPriceArs: null,
    hasTrial: false,
    trialDays: 0,
    sortOrder: 0,
    isActive: true,
    inheritsTouristVip: false,
    entitlements,
    limits: {}
});

describe('getGatePlanNames (HOS-2554)', () => {
    beforeEach(() => {
        clearGatePlanCatalogCache();
        fetchPublicPlans.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it('returns the names of the plans that carry the entitlement, whatever they are called', async () => {
        const ok: FetchPlansResult = {
            ok: true,
            plans: [plan('Nómada', ['can_compare_accommodations']), plan('Gratis', [])]
        };
        fetchPublicPlans.mockResolvedValue(ok);
        expect(await getGatePlanNames({ entitlement: 'can_compare_accommodations' })).toEqual([
            'Nómada'
        ]);
    });

    it('reads the catalog once for many callers in the same window', async () => {
        fetchPublicPlans.mockResolvedValue({ ok: true, plans: [plan('A', ['x'])] });
        await Promise.all([1, 2, 3].map(() => getGatePlanNames({ entitlement: 'x' })));
        expect(fetchPublicPlans).toHaveBeenCalledTimes(1);
    });

    it('names no plan on a failed read and reuses the failure for the short window only', async () => {
        // Arrange
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
        fetchPublicPlans.mockResolvedValue({ ok: false, error: 'down' });

        // Act: a page of many cards while the API is down
        const first = await getGatePlanNames({ entitlement: 'x' });
        await Promise.all([1, 2, 3, 4, 5].map(() => getGatePlanNames({ entitlement: 'x' })));
        vi.advanceTimersByTime(CATALOG_FAILURE_TTL_MS - 1);
        await getGatePlanNames({ entitlement: 'x' });

        // Assert: one fetch for the whole failure window
        expect(first).toEqual([]);
        expect(fetchPublicPlans).toHaveBeenCalledTimes(1);

        // Act: past the failure window the API has recovered
        vi.advanceTimersByTime(2);
        fetchPublicPlans.mockResolvedValue({ ok: true, plans: [plan('B', ['x'])] });

        // Assert
        expect(await getGatePlanNames({ entitlement: 'x' })).toEqual(['B']);
        expect(fetchPublicPlans).toHaveBeenCalledTimes(2);
    });

    it('keeps the failure window much shorter than the success window', () => {
        expect(CATALOG_FAILURE_TTL_MS).toBeLessThan(CATALOG_TTL_MS);
        expect(CATALOG_FAILURE_TTL_MS).toBeGreaterThan(0);
    });
});
