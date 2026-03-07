/**
 * Tests for api/endpoints-protected.ts - Protected and auxiliary endpoint wrappers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the apiClient
vi.mock('@/lib/api/client', () => ({
    apiClient: {
        get: vi.fn(),
        getList: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        getProtected: vi.fn(),
        postProtected: vi.fn()
    },
    fetchAllPages: vi.fn()
}));

const PUBLIC_BASE = '/api/v1/public';
const PROTECTED_BASE = '/api/v1/protected';

describe('authApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call get with /auth/me on me()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({
            ok: true,
            data: { actor: {}, isAuthenticated: true }
        });

        const { authApi } = await import('@/lib/api/endpoints-protected');
        await authApi.me();

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${PUBLIC_BASE}/auth/me`
        });
    });
});

describe('userBookmarksApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call getProtected with /user-bookmarks on list()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: { bookmarks: [], total: 0 }
        });

        const { userBookmarksApi } = await import('@/lib/api/endpoints-protected');
        await userBookmarksApi.list({ entityType: 'ACCOMMODATION', pageSize: 10 });

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/user-bookmarks`,
            params: { entityType: 'ACCOMMODATION', pageSize: 10 }
        });
    });

    it('should call getProtected with /user-bookmarks/count on count()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: { count: 5 }
        });

        const { userBookmarksApi } = await import('@/lib/api/endpoints-protected');
        await userBookmarksApi.count();

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/user-bookmarks/count`,
            params: undefined
        });
    });

    it('should call getProtected with /user-bookmarks/check on checkStatus()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: { isFavorited: false, bookmarkId: null }
        });

        const { userBookmarksApi } = await import('@/lib/api/endpoints-protected');
        await userBookmarksApi.checkStatus({ entityId: 'acc-1', entityType: 'ACCOMMODATION' });

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/user-bookmarks/check`,
            params: { entityId: 'acc-1', entityType: 'ACCOMMODATION' }
        });
    });

    it('should call postProtected with /user-bookmarks on toggle()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.postProtected).mockResolvedValue({
            ok: true,
            data: { toggled: true, bookmark: null }
        });

        const { userBookmarksApi } = await import('@/lib/api/endpoints-protected');
        const body = { entityId: 'acc-1', entityType: 'ACCOMMODATION' as const };
        await userBookmarksApi.toggle(body);

        expect(apiClient.postProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/user-bookmarks`,
            body
        });
    });

    it('should call delete with /user-bookmarks/:id on delete()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.delete).mockResolvedValue({
            ok: true,
            data: { success: true }
        });

        const { userBookmarksApi } = await import('@/lib/api/endpoints-protected');
        await userBookmarksApi.delete({ id: 'bm-123' });

        expect(apiClient.delete).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/user-bookmarks/bm-123`
        });
    });

    it('should call postProtected with /user-bookmarks on create()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.postProtected).mockResolvedValue({
            ok: true,
            data: { toggled: true, bookmark: null }
        });

        const { userBookmarksApi } = await import('@/lib/api/endpoints-protected');
        const body = { entityId: 'dest-1', entityType: 'DESTINATION' as const, name: 'Mi destino' };
        await userBookmarksApi.create(body);

        expect(apiClient.postProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/user-bookmarks`,
            body
        });
    });
});

describe('userApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call getProtected with /users/:id on getProfile()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getProtected).mockResolvedValue({ ok: true, data: {} });

        const { userApi } = await import('@/lib/api/endpoints-protected');
        await userApi.getProfile({ id: 'user-abc' });

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/users/user-abc`
        });
    });

    it('should call patch with /users/:id on patchProfile()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.patch).mockResolvedValue({ ok: true, data: {} });

        const { userApi } = await import('@/lib/api/endpoints-protected');
        const data = { name: 'New Name' };
        await userApi.patchProfile({ id: 'user-abc', data });

        expect(apiClient.patch).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/users/user-abc`,
            body: data
        });
    });

    it('should call getProtected with /users/me/stats on getStats()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: { bookmarkCount: 0, reviewCount: 0, plan: null }
        });

        const { userApi } = await import('@/lib/api/endpoints-protected');
        await userApi.getStats();

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/users/me/stats`
        });
    });

    it('should call getProtected with /users/me/subscription on getSubscription()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: { subscription: null }
        });

        const { userApi } = await import('@/lib/api/endpoints-protected');
        await userApi.getSubscription();

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/users/me/subscription`
        });
    });

    it('should call getProtected with /users/me/reviews on getReviews()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: {
                accommodationReviews: [],
                destinationReviews: [],
                totals: { accommodationReviews: 0, destinationReviews: 0, total: 0 }
            }
        });

        const { userApi } = await import('@/lib/api/endpoints-protected');
        await userApi.getReviews({ page: 1, pageSize: 10, type: 'all' });

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/users/me/reviews`,
            params: { page: 1, pageSize: 10, type: 'all' }
        });
    });

    it('should call getProtected with /users/me/reviews without params on getReviews()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: {
                accommodationReviews: [],
                destinationReviews: [],
                totals: { accommodationReviews: 0, destinationReviews: 0, total: 0 }
            }
        });

        const { userApi } = await import('@/lib/api/endpoints-protected');
        await userApi.getReviews();

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/users/me/reviews`,
            params: undefined
        });
    });
});

describe('billingApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call postProtected with change-plan path on changePlan()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.postProtected).mockResolvedValue({ ok: true, data: { success: true } });

        const { billingApi } = await import('@/lib/api/endpoints-protected');
        await billingApi.changePlan({ planId: 'plan-1', billingInterval: 'monthly' });

        expect(apiClient.postProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/billing/subscriptions/change-plan`,
            body: { planId: 'plan-1', billingInterval: 'monthly' }
        });
    });

    it('should call delete with subscription path on cancelSubscription()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.delete).mockResolvedValue({ ok: true, data: { success: true } });

        const { billingApi } = await import('@/lib/api/endpoints-protected');
        await billingApi.cancelSubscription({ subscriptionId: 'sub-abc' });

        expect(apiClient.delete).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/billing/subscriptions/sub-abc`
        });
    });

    it('should call getList with /billing/invoices on getInvoices()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { billingApi } = await import('@/lib/api/endpoints-protected');
        await billingApi.getInvoices({ page: 1, pageSize: 20 });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/billing/invoices`,
            params: { page: 1, pageSize: 20 }
        });
    });

    it('should call getProtected with /billing/usage on getUsageSummary()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: { limits: [] }
        });

        const { billingApi } = await import('@/lib/api/endpoints-protected');
        await billingApi.getUsageSummary();

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/billing/usage`
        });
    });

    it('should call postProtected with checkout path on createCheckout()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.postProtected).mockResolvedValue({
            ok: true,
            data: { checkoutUrl: 'https://mp.example.com/checkout/123' }
        });

        const { billingApi } = await import('@/lib/api/endpoints-protected');
        await billingApi.createCheckout({ planId: 'plan-1', billingInterval: 'monthly' });

        expect(apiClient.postProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/billing/checkout`,
            body: { planId: 'plan-1', billingInterval: 'monthly' }
        });
    });

    it('should call postProtected with reactivate-subscription path on reactivateSubscription()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.postProtected).mockResolvedValue({ ok: true, data: { success: true } });

        const { billingApi } = await import('@/lib/api/endpoints-protected');
        await billingApi.reactivateSubscription({ planId: 'plan-free' });

        expect(apiClient.postProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/billing/trial/reactivate-subscription`,
            body: { planId: 'plan-free' }
        });
    });

    it('should call getList with /billing/payments on getPayments()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { billingApi } = await import('@/lib/api/endpoints-protected');
        await billingApi.getPayments({ page: 1, pageSize: 20 });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/billing/payments`,
            params: { page: 1, pageSize: 20 }
        });
    });

    it('should call getProtected with /billing/addons/my on getMyAddons()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: { addons: [] }
        });

        const { billingApi } = await import('@/lib/api/endpoints-protected');
        await billingApi.getMyAddons();

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/billing/addons/my`
        });
    });

    it('should call postProtected with /billing/addons/:id/cancel on cancelAddon()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.postProtected).mockResolvedValue({ ok: true, data: { success: true } });

        const { billingApi } = await import('@/lib/api/endpoints-protected');
        await billingApi.cancelAddon({ addonId: 'addon-abc' });

        expect(apiClient.postProtected).toHaveBeenCalledWith({
            path: `${PROTECTED_BASE}/billing/addons/addon-abc/cancel`,
            body: {}
        });
    });

    it('should call getList with /public/plans on listPlans()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { billingApi } = await import('@/lib/api/endpoints-protected');
        await billingApi.listPlans();

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${PUBLIC_BASE}/plans`
        });
    });
});

describe('tagsApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call get with /tags/by-slug/:slug on getBySlug()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({
            ok: true,
            data: { id: '1', name: 'Termas', slug: 'termas' }
        });

        const { tagsApi } = await import('@/lib/api/endpoints-protected');
        await tagsApi.getBySlug({ slug: 'termas' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${PUBLIC_BASE}/tags/by-slug/termas`
        });
    });
});

describe('plansApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call getList with /plans on list()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { plansApi } = await import('@/lib/api/endpoints-protected');
        await plansApi.list({ page: 1, pageSize: 50 });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${PUBLIC_BASE}/plans`,
            params: { page: 1, pageSize: 50 }
        });
    });
});

describe('exchangeRatesApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call getList with /exchange-rates on list()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { exchangeRatesApi } = await import('@/lib/api/endpoints-protected');
        await exchangeRatesApi.list({ fromCurrency: 'USD', toCurrency: 'ARS' });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${PUBLIC_BASE}/exchange-rates`,
            params: { fromCurrency: 'USD', toCurrency: 'ARS' }
        });
    });
});
