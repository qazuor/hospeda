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
    userApi
} from '../../../src/lib/api/endpoints-protected';

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

describe('userApi.getSubscription productDomain param (HOS-259)', () => {
    beforeEach(() => {
        getProtected.mockReset();
        getProtected.mockResolvedValue({ ok: true, data: { subscription: null } });
    });

    it('omits the productDomain query param when none is passed (server default applies)', async () => {
        await userApi.getSubscription();

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/users/me/subscription',
            params: undefined,
            cookieHeader: undefined
        });
    });

    it('forwards productDomain=commerce as a query param', async () => {
        await userApi.getSubscription({ productDomain: 'commerce' });

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/users/me/subscription',
            params: { productDomain: 'commerce' },
            cookieHeader: undefined
        });
    });

    it('forwards the cookieHeader alongside productDomain for SSR callers', async () => {
        await userApi.getSubscription({ productDomain: 'accommodation', cookieHeader: 'sid=abc' });

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/users/me/subscription',
            params: { productDomain: 'accommodation' },
            cookieHeader: 'sid=abc'
        });
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
            body: { question: '¿Hay wifi?', answer: 'Sí, gratuito.', category: undefined }
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
                category: undefined
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
