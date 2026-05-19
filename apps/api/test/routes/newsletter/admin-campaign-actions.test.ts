/**
 * Integration tests for the admin newsletter campaign action and metrics endpoints
 * (SPEC-101 T-101-28).
 *
 * Tests the 5 action/metrics endpoints:
 *   POST /api/v1/admin/newsletter/campaigns/:id/test-send
 *   POST /api/v1/admin/newsletter/campaigns/:id/send       (202, 200 no-eligible, 409)
 *   POST /api/v1/admin/newsletter/campaigns/:id/cancel     (200, 409)
 *   GET  /api/v1/admin/newsletter/campaigns/:id/metrics    (200 + no-cache header)
 *   GET  /api/v1/admin/newsletter/campaigns/:id/errors     (200 paginated + masked email)
 *
 * The `NewsletterCampaignService` is mocked at the lazy-singleton boundary.
 * `UserService` (for test-send actor email resolution) is also mocked.
 *
 * Error shape notes:
 * - 409 conflict errors: duck-typed Error objects with `.code` and `.reason` fields
 *   (resilient to the test mock ServiceError that lacks `reason`).
 * - 404 / 503 service errors: duck-typed Error objects using the `CODE: message`
 *   format so `handleRouteError`'s string-parse path maps them correctly.
 * - send / cancel use result.error plumbing — the handler throws `new ServiceError()`
 *   which is re-caught. We use duck-typed objects so the error reaches the
 *   `instanceof Error` path in handleRouteError rather than failing instanceof checks.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (declare BEFORE importing routes)
// ---------------------------------------------------------------------------

const mockSend = vi.fn();
const mockTestSend = vi.fn();
const mockCancel = vi.fn();
const mockComputeMetrics = vi.fn();
const mockGetFailedDeliveries = vi.fn();
const mockUserGetById = vi.fn();

vi.mock('../../../src/routes/newsletter/admin/_singletons', () => ({
    getDefaultCampaignService: vi.fn(() => ({
        create: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn(),
        send: mockSend,
        testSend: mockTestSend,
        cancel: mockCancel,
        computeMetrics: mockComputeMetrics,
        getFailedDeliveries: mockGetFailedDeliveries
    })),
    _resetCampaignRouteSingletons: vi.fn()
}));

vi.mock('../../../src/routes/newsletter/protected/_singletons', () => ({
    getDefaultNewsletterService: vi.fn(() => ({})),
    getDefaultUserService: vi.fn(() => ({ getById: mockUserGetById })),
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

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACTOR_EMAIL = 'admin@hospeda.com.ar';

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
                permissions: [
                    'newsletter.campaign.view',
                    'newsletter.campaign.write',
                    'newsletter.campaign.send'
                ]
            });
            await next();
        }
}));

import { Hono } from 'hono';
import {
    adminCampaignErrorsRoute,
    adminCampaignMetricsRoute,
    adminCancelCampaignRoute,
    adminSendCampaignRoute,
    adminTestSendCampaignRoute
} from '../../../src/routes/newsletter/admin/campaigns';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const campaignId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const campaignMetrics = {
    campaignId,
    totalRecipients: 1500,
    totalSoftcapped: 42,
    pending: 0,
    delivered: 1450,
    failed: 8,
    skipped: 0,
    opened: 900,
    clicked: 250
};

const failedDelivery = {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    subscriberId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    channel: 'email',
    errorMessage: 'SMTP timeout',
    retryCount: 3,
    createdAt: new Date('2025-05-01T00:00:00Z'),
    updatedAt: new Date('2025-05-01T12:00:00Z')
};

function buildApp() {
    const app = new Hono();
    app.route('/api/v1/admin/newsletter', adminTestSendCampaignRoute);
    app.route('/api/v1/admin/newsletter', adminSendCampaignRoute);
    app.route('/api/v1/admin/newsletter', adminCancelCampaignRoute);
    app.route('/api/v1/admin/newsletter', adminCampaignMetricsRoute);
    app.route('/api/v1/admin/newsletter', adminCampaignErrorsRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    mockSend.mockReset();
    mockTestSend.mockReset();
    mockCancel.mockReset();
    mockComputeMetrics.mockReset();
    mockGetFailedDeliveries.mockReset();
    mockUserGetById.mockReset();

    // Default: user has an email on file
    mockUserGetById.mockResolvedValue({
        data: { id: ACTOR_ID, email: ACTOR_EMAIL },
        error: null
    });
});

// ---------------------------------------------------------------------------
// POST /:id/test-send
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/newsletter/campaigns/:id/test-send', () => {
    it('sends to actor email when toEmail is not provided', async () => {
        mockTestSend.mockResolvedValue({ data: { sentTo: ACTOR_EMAIL }, error: null });

        const app = buildApp();
        const res = await app.request(
            `/api/v1/admin/newsletter/campaigns/${campaignId}/test-send`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.sent).toBe(true);
        expect(body.data.sentTo).toBe(ACTOR_EMAIL);
        expect(mockTestSend).toHaveBeenCalledWith(expect.objectContaining({ id: ACTOR_ID }), {
            id: campaignId,
            toEmail: ACTOR_EMAIL
        });
    });

    it('sends to override email when toEmail is provided', async () => {
        const overrideEmail = 'override@example.com';
        mockTestSend.mockResolvedValue({ data: { sentTo: overrideEmail }, error: null });

        const app = buildApp();
        const res = await app.request(
            `/api/v1/admin/newsletter/campaigns/${campaignId}/test-send`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toEmail: overrideEmail })
            }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.sentTo).toBe(overrideEmail);
        // UserService should NOT be called when toEmail is provided
        expect(mockUserGetById).not.toHaveBeenCalled();
    });

    it('returns 400 when toEmail is not a valid email', async () => {
        const app = buildApp();
        const res = await app.request(
            `/api/v1/admin/newsletter/campaigns/${campaignId}/test-send`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toEmail: 'not-an-email' })
            }
        );
        expect(res.status).toBe(400);
    });

    it('returns 400 when actor has no email on file', async () => {
        mockUserGetById.mockResolvedValue({
            data: { id: ACTOR_ID, email: null },
            error: null
        });

        const app = buildApp();
        const res = await app.request(
            `/api/v1/admin/newsletter/campaigns/${campaignId}/test-send`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            }
        );
        // VALIDATION_ERROR → 400
        expect(res.status).toBe(400);
    });

    it('returns 503 when testSend service returns SERVICE_UNAVAILABLE', async () => {
        mockTestSend.mockResolvedValue({
            data: null,
            error: { code: 'SERVICE_UNAVAILABLE', message: 'Email not configured' }
        });

        const app = buildApp();
        const res = await app.request(
            `/api/v1/admin/newsletter/campaigns/${campaignId}/test-send`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            }
        );
        expect(res.status).toBe(503);
    });
});

// ---------------------------------------------------------------------------
// POST /:id/send
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/newsletter/campaigns/:id/send', () => {
    it('returns 202 with dispatched result when subscribers are enqueued', async () => {
        mockSend.mockResolvedValue({
            data: { enqueued: 1500, softcapped: 42 },
            error: null
        });

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/send`, {
            method: 'POST'
        });

        expect(res.status).toBe(202);
        // send bypasses the factory wrapper and returns ctx.json() directly
        const body = await res.json();
        expect(body.dispatched).toBe(true);
        expect(body.enqueued).toBe(1500);
        expect(body.softcapped).toBe(42);
    });

    it('returns 200 with no_eligible_subscribers when 0 eligible', async () => {
        mockSend.mockResolvedValue({
            data: { enqueued: 0, softcapped: 200 },
            error: null
        });

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/send`, {
            method: 'POST'
        });

        expect(res.status).toBe(200);
        // send bypasses the factory wrapper
        const body = await res.json();
        expect(body.dispatched).toBe(false);
        expect(body.reason).toBe('no_eligible_subscribers');
    });

    it('returns 409 when campaign is not in a sendable status', async () => {
        // Duck-typed error: rethrowConflictAsHttp409 checks .code + .reason duck-typed
        const conflictErr = Object.assign(
            new Error('Campaign is not sendable. Current status: sent'),
            { code: 'ALREADY_EXISTS', reason: 'CAMPAIGN_NOT_SENDABLE' }
        );
        mockSend.mockRejectedValue(conflictErr);

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/send`, {
            method: 'POST'
        });

        expect(res.status).toBe(409);
    });

    it('returns 404 when campaign not found (result.error)', async () => {
        // When result.error is set, the handler throws new ServiceError(code, msg).
        // Use a duck-typed error via mockRejectedValue so handleRouteError's
        // string-parse path (`NOT_FOUND: message`) maps it to 404.
        const notFoundErr = Object.assign(new Error('NOT_FOUND: Campaign not found'), {
            code: 'NOT_FOUND'
        });
        mockSend.mockRejectedValue(notFoundErr);

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/send`, {
            method: 'POST'
        });

        expect(res.status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// POST /:id/cancel
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/newsletter/campaigns/:id/cancel', () => {
    it('returns 200 with cancelled result on success', async () => {
        mockCancel.mockResolvedValue({
            data: { skipped: 1450 },
            error: null
        });

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/cancel`, {
            method: 'POST'
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        // createAdminRoute wraps as { success, data: { cancelled, skipped } }
        expect(body.success).toBe(true);
        expect(body.data.cancelled).toBe(true);
        expect(body.data.skipped).toBe(1450);
    });

    it('returns 409 when campaign is not in a cancellable status', async () => {
        const conflictErr = Object.assign(
            new Error('Campaign cannot be cancelled. Current status: sent'),
            { code: 'ALREADY_EXISTS', reason: 'CAMPAIGN_NOT_CANCELLABLE' }
        );
        mockCancel.mockRejectedValue(conflictErr);

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/cancel`, {
            method: 'POST'
        });

        expect(res.status).toBe(409);
    });

    it('returns 404 when campaign not found (result.error)', async () => {
        const notFoundErr = Object.assign(new Error('NOT_FOUND: Campaign not found'), {
            code: 'NOT_FOUND'
        });
        mockCancel.mockRejectedValue(notFoundErr);

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/cancel`, {
            method: 'POST'
        });

        expect(res.status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// GET /:id/metrics
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/newsletter/campaigns/:id/metrics', () => {
    it('returns 200 with metrics and Cache-Control: no-store header', async () => {
        mockComputeMetrics.mockResolvedValue({
            data: campaignMetrics,
            error: null
        });

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/metrics`);

        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.campaignId).toBe(campaignId);
        expect(body.data.delivered).toBe(1450);
        expect(body.data.opened).toBe(900);
    });

    it('returns 404 when campaign not found (result.error)', async () => {
        const notFoundErr = Object.assign(new Error('NOT_FOUND: Campaign not found'), {
            code: 'NOT_FOUND'
        });
        mockComputeMetrics.mockRejectedValue(notFoundErr);

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/metrics`);

        expect(res.status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// GET /:id/errors
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/newsletter/campaigns/:id/errors', () => {
    it('returns 200 with paginated failed deliveries and masked email', async () => {
        mockGetFailedDeliveries.mockResolvedValue({
            data: {
                items: [failedDelivery],
                total: 1,
                page: 1,
                pageSize: 20
            },
            error: null
        });

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/errors`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        // createAdminListRoute wraps as { data: { items, pagination } }
        expect(body.data.items).toHaveLength(1);

        const item = body.data.items[0];
        expect(item.subscriberId).toBe(failedDelivery.subscriberId);
        expect(item.errorMessage).toBe('SMTP timeout');
        expect(item.retryCount).toBe(3);

        // maskedEmail must contain '***' and '@'
        expect(item.maskedEmail).toContain('***');
        expect(item.maskedEmail).toContain('@');
    });

    it('returns 200 with empty items when no failures exist', async () => {
        mockGetFailedDeliveries.mockResolvedValue({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
            error: null
        });

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/errors`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toHaveLength(0);
        expect(body.data.pagination.total).toBe(0);
    });

    it('returns 404 when campaign not found (result.error)', async () => {
        const notFoundErr = Object.assign(new Error('NOT_FOUND: Campaign not found'), {
            code: 'NOT_FOUND'
        });
        mockGetFailedDeliveries.mockRejectedValue(notFoundErr);

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}/errors`);

        expect(res.status).toBe(404);
    });

    it('accepts page and pageSize query params', async () => {
        mockGetFailedDeliveries.mockResolvedValue({
            data: { items: [], total: 0, page: 2, pageSize: 10 },
            error: null
        });

        const app = buildApp();
        const res = await app.request(
            `/api/v1/admin/newsletter/campaigns/${campaignId}/errors?page=2&pageSize=10`
        );

        expect(res.status).toBe(200);
        expect(mockGetFailedDeliveries).toHaveBeenCalledWith(expect.anything(), {
            id: campaignId,
            page: 2,
            pageSize: 10
        });
    });
});
