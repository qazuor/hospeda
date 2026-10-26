import { beforeEach, describe, expect, it, vi } from 'vitest';

const postProtected = vi.fn();
const post = vi.fn();
const getProtected = vi.fn();
const put = vi.fn();
const del = vi.fn();

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        postProtected: (args: unknown) => postProtected(args),
        // Non-credentialed variant: exposed so tests can assert that protected
        // mutations do NOT route through it (would send no session cookie → 401).
        post: (args: unknown) => post(args),
        getProtected: (args: unknown) => getProtected(args),
        put: (args: unknown) => put(args),
        delete: (args: unknown) => del(args)
    }
}));

import {
    accommodationCalendarSyncApi,
    accommodationFaqApi,
    billingSubscriptionApi,
    effectiveSetApi,
    promoCodeApi,
    publishApi
} from '../../../src/lib/api/endpoints-protected';

describe('TEST:1730:5c billing subscription client', () => {
    it('posts the selected option and declared payer email exactly', async () => {
        postProtected.mockReset();
        postProtected.mockResolvedValue({ ok: true, data: {} });
        await billingSubscriptionApi.start({
            billingOptionId: '123e4567-e89b-42d3-a456-426614174000',
            payerEmail: 'payer@example.test'
        });
        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/subscriptions',
            body: {
                billingOptionId: '123e4567-e89b-42d3-a456-426614174000',
                payerEmail: 'payer@example.test'
            }
        });
    });
});

describe('accommodationCalendarSyncApi credentialed mutations (HOS-157 regression)', () => {
    beforeEach(() => {
        postProtected.mockReset();
        post.mockReset();
        postProtected.mockResolvedValue({ ok: true, data: {} });
        post.mockResolvedValue({ ok: true, data: {} });
    });

    // Regression: connectGoogle/sync hit /protected/* mutation routes, so they
    // must send the session cookie. They previously used the non-credentialed
    // `apiClient.post`, which omits `credentials: 'include'` → the browser POST
    // carried no cookie → 401 before the route could run. They must route
    // through `postProtected`.
    it('connectGoogle uses the credentialed postProtected (never plain post)', async () => {
        await accommodationCalendarSyncApi.connectGoogle({ id: 'acc-1', returnTo: '/es/x/' });

        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-1/calendar-sync/connect-google',
            body: { returnTo: '/es/x/' }
        });
        expect(post).not.toHaveBeenCalled();
    });

    it('sync uses the credentialed postProtected (never plain post)', async () => {
        await accommodationCalendarSyncApi.sync({ id: 'acc-1' });

        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-1/calendar-sync/sync',
            body: {}
        });
        expect(post).not.toHaveBeenCalled();
    });
});

describe('accommodationFaqApi routing (HOS-393)', () => {
    beforeEach(() => {
        postProtected.mockReset();
        post.mockReset();
        getProtected.mockReset();
        put.mockReset();
        del.mockReset();
        postProtected.mockResolvedValue({ ok: true, data: { faq: {} } });
        put.mockResolvedValue({ ok: true, data: { faq: {} } });
        del.mockResolvedValue({ ok: true, data: { success: true } });
        getProtected.mockResolvedValue({ ok: true, data: { faqs: [] } });
    });

    it('list() calls getProtected with the accommodation-scoped path', async () => {
        await accommodationFaqApi.list({ accommodationId: 'acc-1' });

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-1/faqs',
            cookieHeader: undefined
        });
    });

    it('add() uses the credentialed postProtected (never plain post)', async () => {
        await accommodationFaqApi.add({
            accommodationId: 'acc-1',
            question: '¿Hay wifi?',
            answer: 'Sí, gratuito.'
        });

        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-1/faqs',
            body: {
                question: '¿Hay wifi?',
                answer: 'Sí, gratuito.',
                category: undefined,
                isVisibleOnListing: undefined,
                isUsableByAi: undefined
            }
        });
        expect(post).not.toHaveBeenCalled();
    });

    it('update() sends PUT (not PATCH) to the faqId sub-path', async () => {
        await accommodationFaqApi.update({
            accommodationId: 'acc-1',
            faqId: 'faq-1',
            question: '¿A qué hora es el check-in?'
        });

        expect(put).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-1/faqs/faq-1',
            body: {
                question: '¿A qué hora es el check-in?',
                answer: undefined,
                category: undefined,
                isVisibleOnListing: undefined,
                isUsableByAi: undefined
            }
        });
    });

    it('remove() sends DELETE to the faqId sub-path', async () => {
        await accommodationFaqApi.remove({ accommodationId: 'acc-1', faqId: 'faq-1' });

        expect(del).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-1/faqs/faq-1'
        });
    });

    it('reorder() sends PUT to the /reorder sub-path with the explicit order array', async () => {
        await accommodationFaqApi.reorder({
            accommodationId: 'acc-1',
            order: [
                { faqId: 'faq-2', displayOrder: 0 },
                { faqId: 'faq-1', displayOrder: 1 }
            ]
        });

        expect(put).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/acc-1/faqs/reorder',
            body: {
                order: [
                    { faqId: 'faq-2', displayOrder: 0 },
                    { faqId: 'faq-1', displayOrder: 1 }
                ]
            }
        });
    });
});

describe('publishApi.precheck path per vertical (HOS-1156 T-016)', () => {
    beforeEach(() => {
        getProtected.mockReset();
        getProtected.mockResolvedValue({ ok: true, data: {} });
    });

    it.each([
        ['accommodation', '/api/v1/protected/publish/precheck/accommodation'],
        ['gastronomy', '/api/v1/protected/publish/precheck/gastronomy'],
        ['experience', '/api/v1/protected/publish/precheck/experience']
    ] as const)('builds the %s path', async (vertical, expectedPath) => {
        await publishApi.precheck({ vertical });

        expect(getProtected).toHaveBeenCalledWith(expect.objectContaining({ path: expectedPath }));
    });

    it('forwards the SSR cookie header so the session resolves', async () => {
        // Without this the endpoint sees an anonymous caller and the page would
        // fail open to create_direct for a signed-in owner at their cap.
        await publishApi.precheck({ vertical: 'gastronomy', cookieHeader: 'session=abc' });

        expect(getProtected).toHaveBeenCalledWith(
            expect.objectContaining({ cookieHeader: 'session=abc' })
        );
    });

    it('uses the credentialed getProtected, never a bare get', async () => {
        await publishApi.precheck({ vertical: 'experience' });
        expect(getProtected).toHaveBeenCalledTimes(1);
    });
});

describe('HOS-1646 · cliente web de capacidades · effective set endpoint', () => {
    it('requests the protected effective set with the vertical query and cookie', async () => {
        getProtected.mockResolvedValue({
            ok: true,
            data: {
                userId: 'u',
                vertical: 'tourist',
                hasLiveNonTrialTitle: false,
                entitlements: {},
                limits: {}
            }
        });
        await effectiveSetApi.get({ vertical: 'tourist', cookieHeader: 'session=abc' });
        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/users/me/effective-set',
            params: { vertical: 'tourist' },
            cookieHeader: 'session=abc'
        });
    });
});

describe('promoCodeApi (AC:B9b:12 HOS-1591 TEST:B9b:12 (support))', () => {
    beforeEach(() => {
        postProtected.mockReset();
        postProtected.mockResolvedValue({ ok: true, data: {} });
    });

    it('redeem posts the code and vertical to the protected endpoint', async () => {
        await promoCodeApi.redeem({ code: 'SAVE20', vertical: 'accommodation' });
        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing/promo-codes/redeem',
            body: { code: 'SAVE20', vertical: 'accommodation' }
        });
    });
});

describe('TEST:1878:24a optional cancellation reason request body', () => {
    beforeEach(() => {
        postProtected.mockReset();
        postProtected.mockResolvedValue({ ok: true, data: {} });
    });

    it('omits the body when no reason is selected', async () => {
        await billingSubscriptionApi.cancel({ subscriptionId: 'sub-id' });
        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing-subscription/sub-id/cancellation'
        });
    });

    it('sends JSON only when a reason is selected', async () => {
        await billingSubscriptionApi.cancel({ subscriptionId: 'sub-id', reason: 'SEASONAL_PAUSE' });
        expect(postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/billing-subscription/sub-id/cancellation',
            body: { reason: 'SEASONAL_PAUSE' }
        });
    });
});
