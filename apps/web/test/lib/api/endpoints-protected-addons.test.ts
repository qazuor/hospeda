import { beforeEach, describe, expect, it, vi } from 'vitest';
import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';

const { getProtected } = vi.hoisted(() => ({ getProtected: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: { getProtected } }));

describe('billingAddonApi.listRecurringAddons', () => {
    beforeEach(() => vi.clearAllMocks());

    it('forwards SSR cookies separately from listing query parameters', async () => {
        const result = { ok: true, data: { items: [] } };
        getProtected.mockResolvedValue(result);
        expect(await billingAddonApi.listRecurringAddons({ cookieHeader: 'test-session' })).toBe(
            result
        );
        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/addons/instances',
            params: { listingId: undefined },
            cookieHeader: 'test-session'
        });
    });

    it('keeps browser listing-filter calls compatible without an SSR cookie', async () => {
        await billingAddonApi.listRecurringAddons({ listingId: 'listing-a' });
        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/addons/instances',
            params: { listingId: 'listing-a' },
            cookieHeader: undefined
        });
    });
});
