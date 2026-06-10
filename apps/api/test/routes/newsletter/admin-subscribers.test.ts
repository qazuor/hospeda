/**
 * Unit tests for the admin newsletter subscriber endpoints (SPEC-101 T-101-26).
 *
 * Pure-handler-style tests via the Hono router. The `NewsletterSubscriberService`
 * is mocked at the lazy-singleton boundary so we never touch the DB.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (declare BEFORE importing the routes)
// ---------------------------------------------------------------------------

const mockAdminList = vi.fn();
const mockGetStats = vi.fn();

vi.mock('../../../src/routes/newsletter/protected/_singletons', () => ({
    getDefaultNewsletterService: vi.fn(() => ({
        adminList: mockAdminList,
        getStats: mockGetStats
    })),
    getDefaultUserService: vi.fn(() => ({})),
    _resetNewsletterRouteSingletons: vi.fn()
}));

vi.mock('../../../src/middlewares/rate-limit', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/middlewares/rate-limit')>();
    return {
        ...original,
        createPerRouteRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    };
});

// Mock the authorization middlewares to a no-op + actor injection — keeps the
// test focused on routing + handler logic, not the auth pipeline.
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

vi.mock('../../../src/middlewares/authorization', () => ({
    publicAuthMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    protectedAuthMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    adminAuthMiddleware:
        () => async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
            c.set('actor', {
                id: ACTOR_ID,
                role: 'ADMIN',
                permissions: ['NEWSLETTER_SUBSCRIBER_VIEW']
            });
            await next();
        }
}));

import { Hono } from 'hono';
import {
    adminListSubscribersRoute,
    adminSubscribersStatsRoute
} from '../../../src/routes/newsletter/admin/subscribers';

function buildApp() {
    const app = new Hono();
    app.route('/api/v1/admin/newsletter', adminListSubscribersRoute);
    app.route('/api/v1/admin/newsletter', adminSubscribersStatsRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const subscriberRow = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    email: 'sub@example.com',
    channel: 'email',
    status: 'active',
    locale: 'es',
    source: 'web_footer',
    preferences: { offers: true, events: true, guides: true, productNews: true },
    consentIp: '203.0.113.1',
    consentUa: 'Mozilla/5.0',
    consentVersion: 'spec-101-v1',
    subscribedAt: new Date('2026-04-01T00:00:00.000Z'),
    verifiedAt: new Date('2026-04-01T00:05:00.000Z'),
    unsubscribedAt: null,
    bouncedAt: null,
    complainedAt: null,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:05:00.000Z'),
    deletedAt: null
};

beforeEach(() => {
    mockAdminList.mockReset();
    mockGetStats.mockReset();
});

// ---------------------------------------------------------------------------
// adminList tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/newsletter/subscribers', () => {
    it('returns the paginated subscriber list (happy path)', async () => {
        mockAdminList.mockResolvedValue({
            data: { items: [subscriberRow], total: 1, page: 1, pageSize: 20 },
            error: null
        });
        const app = buildApp();

        const res = await app.request('/api/v1/admin/newsletter/subscribers?page=1&pageSize=20');

        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: { items: unknown[]; pagination: { total: number } };
        };
        expect(body.data.items).toHaveLength(1);
        expect(body.data.pagination.total).toBe(1);
        expect(mockAdminList).toHaveBeenCalledTimes(1);
    });

    it('forwards the status / locale / source / channel / emailSearch filters to the service', async () => {
        mockAdminList.mockResolvedValue({
            data: { items: [], total: 0, page: 1, pageSize: 10 },
            error: null
        });
        const app = buildApp();

        await app.request(
            '/api/v1/admin/newsletter/subscribers?page=1&pageSize=10&subscriberStatus=active&locale=es&source=web_footer&channel=email&emailSearch=foo'
        );

        const [, params] = mockAdminList.mock.calls[0] ?? [];
        expect(params).toMatchObject({
            subscriberStatus: 'active',
            locale: 'es',
            source: 'web_footer',
            channel: 'email',
            emailSearch: 'foo',
            page: 1,
            pageSize: 10
        });
    });

    it('propagates service errors as HTTP error responses', async () => {
        mockAdminList.mockResolvedValue({
            data: null,
            error: { code: 'FORBIDDEN', message: 'no access' }
        });
        const app = buildApp();

        const res = await app.request('/api/v1/admin/newsletter/subscribers?page=1&pageSize=20');

        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});

// ---------------------------------------------------------------------------
// stats tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/newsletter/subscribers/stats', () => {
    it('returns the per-status counters', async () => {
        mockGetStats.mockResolvedValue({
            data: {
                totalActive: 42,
                totalPending: 3,
                totalUnsubscribed: 7,
                totalBounced: 1,
                totalComplained: 0
            },
            error: null
        });
        const app = buildApp();

        const res = await app.request('/api/v1/admin/newsletter/subscribers/stats');

        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: {
                totalActive: number;
                totalPending: number;
                totalUnsubscribed: number;
                totalBounced: number;
                totalComplained: number;
            };
        };
        expect(body.data).toEqual({
            totalActive: 42,
            totalPending: 3,
            totalUnsubscribed: 7,
            totalBounced: 1,
            totalComplained: 0
        });
        expect(mockGetStats).toHaveBeenCalledTimes(1);
    });

    it('propagates service errors as HTTP error responses', async () => {
        mockGetStats.mockResolvedValue({
            data: null,
            error: { code: 'FORBIDDEN', message: 'no access' }
        });
        const app = buildApp();

        const res = await app.request('/api/v1/admin/newsletter/subscribers/stats');

        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
