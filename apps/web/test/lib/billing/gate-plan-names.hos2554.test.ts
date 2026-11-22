/**
 * @file gate-plan-names.hos2554.test.ts
 * @description HOS-2554: the shared server reader returns the catalog's plan names for an
 * entitlement, reads the catalog once per window, and yields no names on a failed read.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchPlansResult, PublicPlanData } from '../../../src/lib/billing/fetch-plans';
import {
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

    it('names no plan on a failed read and retries on the next call', async () => {
        fetchPublicPlans.mockResolvedValueOnce({ ok: false, error: 'down' });
        expect(await getGatePlanNames({ entitlement: 'x' })).toEqual([]);
        await Promise.resolve();
        fetchPublicPlans.mockResolvedValueOnce({ ok: true, plans: [plan('B', ['x'])] });
        expect(await getGatePlanNames({ entitlement: 'x' })).toEqual(['B']);
    });
});
