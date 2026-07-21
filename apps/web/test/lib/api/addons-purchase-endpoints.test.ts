/**
 * @file addons-purchase-endpoints.test.ts
 * @description Wrapper tests for the HOS-224 addons self-service purchase
 * endpoints (`billingApi.listAvailableAddons` / `billingApi.purchaseAddon`),
 * plus the `getAddons()` shape fix that ships alongside them.
 *
 * Follows the mocking pattern established in `endpoints-protected.test.ts`
 * (HOS-157): mock `apiClient` directly rather than the network layer.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProtected = vi.fn();
const postProtected = vi.fn();

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        getProtected: (args: unknown) => getProtected(args),
        postProtected: (args: unknown) => postProtected(args)
    }
}));

import { billingApi } from '../../../src/lib/api/endpoints-protected';

describe('billingApi.listAvailableAddons (HOS-224)', () => {
    beforeEach(() => {
        getProtected.mockReset();
        getProtected.mockResolvedValue({ ok: true, data: [] });
    });

    it('hits GET /protected/billing/addons with active filter', async () => {
        await billingApi.listAvailableAddons({ active: true });

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/addons',
            params: { active: true, targetCategory: undefined },
            cookieHeader: undefined
        });
    });

    it('forwards targetCategory and cookieHeader for SSR calls', async () => {
        await billingApi.listAvailableAddons({
            active: true,
            targetCategory: 'owner',
            cookieHeader: 'session=abc'
        });

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/addons',
            params: { active: true, targetCategory: 'owner' },
            cookieHeader: 'session=abc'
        });
    });

    it('works with no params at all', async () => {
        await billingApi.listAvailableAddons();

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/addons',
            params: { active: undefined, targetCategory: undefined },
            cookieHeader: undefined
        });
    });
});

describe('billingApi.purchaseAddon (HOS-224)', () => {
    beforeEach(() => {
        postProtected.mockReset();
        postProtected.mockResolvedValue({
            ok: true,
            data: {
                checkoutUrl: 'https://mp.example/checkout/abc',
                orderId: 'addon_visibility-boost-7d_uuid',
                addonId: 'visibility-boost-7d',
                amount: 500000,
                currency: 'ARS',
                expiresAt: '2026-07-20T00:00:00.000Z'
            }
        });
    });

    it('sends the X-Idempotency-Key header on every call', async () => {
        await billingApi.purchaseAddon({
            slug: 'visibility-boost-7d',
            idempotencyKey: 'idem-key-1'
        });

        expect(postProtected).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: { 'X-Idempotency-Key': 'idem-key-1' }
            })
        );
    });

    it('posts to the slug-scoped purchase path', async () => {
        await billingApi.purchaseAddon({
            slug: 'visibility-boost-7d',
            idempotencyKey: 'idem-key-1'
        });

        expect(postProtected).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/protected/billing/addons/visibility-boost-7d/purchase'
            })
        );
    });

    it('includes addonId (= slug) in the body even when no other body fields are given', () => {
        // Arrange / Act
        void billingApi.purchaseAddon({
            slug: 'extra-photos-20',
            idempotencyKey: 'idem-key-2'
        });

        // Assert — the API's PurchaseAddonSchema requires `addonId` even though
        // the handler resolves the addon from the URL :slug param (see
        // apps/api/test/e2e/flows/billing/addon-purchase.test.ts). Omitting it
        // here would 400 for every real caller.
        expect(postProtected).toHaveBeenCalledWith(
            expect.objectContaining({
                body: { addonId: 'extra-photos-20' }
            })
        );
    });

    it('forwards promoCode and accommodationId alongside addonId', async () => {
        await billingApi.purchaseAddon({
            slug: 'visibility-boost-7d',
            body: { promoCode: 'SUMMER2024', accommodationId: 'acc-uuid' },
            idempotencyKey: 'idem-key-3'
        });

        expect(postProtected).toHaveBeenCalledWith(
            expect.objectContaining({
                body: {
                    addonId: 'visibility-boost-7d',
                    promoCode: 'SUMMER2024',
                    accommodationId: 'acc-uuid'
                }
            })
        );
    });

    it('forwards cookieHeader for SSR callers', async () => {
        await billingApi.purchaseAddon({
            slug: 'visibility-boost-7d',
            idempotencyKey: 'idem-key-4',
            cookieHeader: 'session=abc'
        });

        expect(postProtected).toHaveBeenCalledWith(
            expect.objectContaining({ cookieHeader: 'session=abc' })
        );
    });

    it('resolves the checkout URL from a successful response', async () => {
        const result = await billingApi.purchaseAddon({
            slug: 'visibility-boost-7d',
            idempotencyKey: 'idem-key-5'
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.checkoutUrl).toBe('https://mp.example/checkout/abc');
        }
    });
});

describe('billingApi.getAddons (HOS-224 shape fix)', () => {
    beforeEach(() => {
        getProtected.mockReset();
        getProtected.mockResolvedValue({
            ok: true,
            data: [
                {
                    id: 'purchase-1',
                    addonSlug: 'visibility-boost-7d',
                    addonName: 'Visibility Boost (7 days)',
                    billingType: 'one_time',
                    status: 'active',
                    purchasedAt: '2026-07-01T00:00:00.000Z',
                    expiresAt: '2026-07-08T00:00:00.000Z',
                    canceledAt: null,
                    priceArs: 500000,
                    affectsLimitKey: null,
                    limitIncrease: null,
                    grantsEntitlement: 'featured_listing'
                }
            ]
        });
    });

    it('hits GET /protected/billing/addons/my', async () => {
        await billingApi.getAddons();

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/addons/my',
            cookieHeader: undefined
        });
    });

    it('returns the addon array directly, not wrapped in an `addons` key', async () => {
        const result = await billingApi.getAddons();

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data[0]?.addonSlug).toBe('visibility-boost-7d');
        }
    });

    it('forwards cookieHeader for SSR calls', async () => {
        await billingApi.getAddons({ cookieHeader: 'session=abc' });

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/addons/my',
            cookieHeader: 'session=abc'
        });
    });
});
