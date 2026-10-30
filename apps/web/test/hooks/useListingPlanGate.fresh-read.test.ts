/**
 * @file useListingPlanGate.fresh-read.test.ts
 * @description A cached effective-set read never blocks a control on its own.
 *
 * The browser cache has a 60 s TTL, survives ClientRouter soft navigations and
 * is invalidated by nothing, so an owner who just gained an entitlement could
 * read a stale "not held". The hook confirms every BLOCKING answer with a fresh,
 * uncached read, and the fresh answer wins.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(),
    fetchEntitlementsUncached: vi.fn()
}));

import { useListingPlanGate } from '../../src/hooks/useListingPlanGate';
import type { EntitlementsData } from '../../src/lib/entitlements-cache';
import { fetchEntitlementsUncached, getEntitlementsCached } from '../../src/lib/entitlements-cache';

const mockCached = vi.mocked(getEntitlementsCached);
const mockFresh = vi.mocked(fetchEntitlementsUncached);

const KEY = 'manage_venue_menu';

/** A resolved effective set holding exactly `keys`. */
function data(keys: readonly string[]): EntitlementsData {
    return {
        entitlements: Object.fromEntries(keys.map((key) => [key, 1])),
        limits: {},
        hasLiveNonTrialTitle: false,
        failed: false
    };
}

/** Renders the hook and lets every pending read settle. */
async function settle() {
    const hook = renderHook(() => useListingPlanGate({ vertical: 'venue', entitlementKey: KEY }));
    await act(async () => {});
    await act(async () => {});
    return hook;
}

describe('useListingPlanGate — fresh read before blocking', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('a fresh read that grants the key wins over a cached blocking read', async () => {
        mockCached.mockResolvedValue(data([]));
        mockFresh.mockResolvedValue(data([KEY]));

        const { result } = await settle();

        expect(mockFresh).toHaveBeenCalledWith({ vertical: 'venue' });
        expect(result.current.gate).toBe('open');
    });

    it('blocks only when the fresh read confirms it', async () => {
        mockCached.mockResolvedValue(data([]));
        mockFresh.mockResolvedValue(data(['activate_trial']));

        const { result } = await settle();

        expect(result.current.gate).toBe('preTrial');
    });

    it('a cached read that opens the control is used without a second request', async () => {
        mockCached.mockResolvedValue(data([KEY]));

        const { result } = await settle();

        expect(mockFresh).not.toHaveBeenCalled();
        expect(result.current.gate).toBe('open');
    });

    it('a failed fresh read falls open, never into a block', async () => {
        mockCached.mockResolvedValue(data([]));
        mockFresh.mockResolvedValue({ ...data([]), failed: true });

        const { result } = await settle();

        expect(result.current.gate).toBe('open');
    });
});
