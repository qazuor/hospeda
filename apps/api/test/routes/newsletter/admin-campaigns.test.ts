/**
 * Integration tests for the admin newsletter campaign CRUD endpoints
 * (SPEC-101 T-101-27).
 *
 * Tests the 5 CRUD endpoints:
 *   GET    /api/v1/admin/newsletter/campaigns          — list (paginated + filters)
 *   POST   /api/v1/admin/newsletter/campaigns          — create draft → 201
 *   GET    /api/v1/admin/newsletter/campaigns/:id      — get one
 *   PATCH  /api/v1/admin/newsletter/campaigns/:id      — update draft → 409 if not draft
 *   DELETE /api/v1/admin/newsletter/campaigns/:id      — soft-delete → 409 if not draft
 *
 * The LIST and GET handlers use injectable deps (queryCampaigns / queryCampaignById)
 * so tests never need to touch the real Drizzle table object from `@repo/db`.
 *
 * `NewsletterCampaignService` is mocked at the lazy-singleton boundary so we
 * never touch the DB for write operations.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (declare BEFORE importing the routes module)
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();

vi.mock('../../../src/routes/newsletter/admin/_singletons', () => ({
    getDefaultCampaignService: vi.fn(() => ({
        create: mockCreate,
        update: mockUpdate,
        softDelete: mockSoftDelete,
        send: vi.fn(),
        testSend: vi.fn(),
        cancel: vi.fn(),
        computeMetrics: vi.fn(),
        getFailedDeliveries: vi.fn()
    })),
    _resetCampaignRouteSingletons: vi.fn()
}));

vi.mock('../../../src/routes/newsletter/protected/_singletons', () => ({
    getDefaultNewsletterService: vi.fn(() => ({})),
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

// Admin auth middleware no-op that injects an actor with all campaign permissions.
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
                permissions: [
                    'newsletter.campaign.view',
                    'newsletter.campaign.write',
                    'newsletter.campaign.send'
                ]
            });
            await next();
        }
}));

import type { SelectNewsletterCampaign } from '@repo/db';
// Import after mocks
import { Hono } from 'hono';
import {
    adminCreateCampaignRoute,
    adminDeleteCampaignRoute,
    adminUpdateCampaignRoute,
    buildAdminGetCampaignRoute,
    buildAdminListCampaignsRoute
} from '../../../src/routes/newsletter/admin/campaigns';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const campaignId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const draftCampaign: SelectNewsletterCampaign = {
    id: campaignId,
    title: 'Mayo 2025',
    subject: 'Novedades de mayo',
    bodyJson: { type: 'doc', content: [] },
    status: 'draft',
    localeFilter: 'all',
    contentType: null,
    totalRecipients: null,
    totalSoftcapped: 0,
    sentAt: null,
    scheduledFor: null,
    createdBy: ACTOR_ID,
    createdAt: new Date('2025-05-01T00:00:00Z'),
    updatedAt: new Date('2025-05-01T00:00:00Z'),
    deletedAt: null
};

const validCreateBody = {
    title: 'Mayo 2025',
    subject: 'Novedades de mayo',
    bodyJson: { type: 'doc', content: [] },
    localeFilter: 'all'
};

// ---------------------------------------------------------------------------
// Mock dep factories for LIST and GET handlers
// ---------------------------------------------------------------------------

/** Build a mock `queryCampaigns` dep that returns the given items and total. */
function makeQueryCampaigns(items: SelectNewsletterCampaign[], total: number) {
    return vi.fn().mockResolvedValue({ items, total });
}

/** Build a mock `queryCampaignById` dep that returns the given campaign (or null). */
function makeQueryCampaignById(campaign: SelectNewsletterCampaign | null) {
    return vi.fn().mockResolvedValue(campaign);
}

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

function buildApp(
    opts: {
        queryCampaigns?: ReturnType<typeof makeQueryCampaigns>;
        queryCampaignById?: ReturnType<typeof makeQueryCampaignById>;
    } = {}
) {
    const listRoute = opts.queryCampaigns
        ? buildAdminListCampaignsRoute({ queryCampaigns: opts.queryCampaigns })
        : buildAdminListCampaignsRoute();

    const getRoute = opts.queryCampaignById
        ? buildAdminGetCampaignRoute({ queryCampaignById: opts.queryCampaignById })
        : buildAdminGetCampaignRoute();

    const app = new Hono();
    app.route('/api/v1/admin/newsletter', listRoute);
    app.route('/api/v1/admin/newsletter', adminCreateCampaignRoute);
    app.route('/api/v1/admin/newsletter', getRoute);
    app.route('/api/v1/admin/newsletter', adminUpdateCampaignRoute);
    app.route('/api/v1/admin/newsletter', adminDeleteCampaignRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockSoftDelete.mockReset();
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/newsletter/campaigns — list
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/newsletter/campaigns', () => {
    it('returns 200 with paginated items on success', async () => {
        const app = buildApp({ queryCampaigns: makeQueryCampaigns([draftCampaign], 1) });
        const res = await app.request('/api/v1/admin/newsletter/campaigns');

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        // createAdminListRoute wraps paginated results as { data: { items, pagination } }
        expect(body.data.items).toBeDefined();
        expect(body.data.pagination).toBeDefined();
        expect(body.data.pagination.total).toBe(1);
    });

    it('returns 200 with empty list when no campaigns exist', async () => {
        const app = buildApp({ queryCampaigns: makeQueryCampaigns([], 0) });
        const res = await app.request('/api/v1/admin/newsletter/campaigns');

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toHaveLength(0);
        expect(body.data.pagination.total).toBe(0);
    });

    it('returns 400 for unknown query params (createAdminListRoute rejects them)', async () => {
        const app = buildApp({ queryCampaigns: makeQueryCampaigns([], 0) });
        const res = await app.request('/api/v1/admin/newsletter/campaigns?unknownParam=bad');
        expect(res.status).toBe(400);
    });

    it('accepts valid filters without rejecting them', async () => {
        const mockQ = makeQueryCampaigns([], 0);
        const app = buildApp({ queryCampaigns: mockQ });
        const res = await app.request(
            '/api/v1/admin/newsletter/campaigns?campaignStatus=draft&titleSearch=mayo'
        );
        expect(res.status).toBe(200);
        // Verify the filter params were forwarded to the query function
        expect(mockQ).toHaveBeenCalledWith(
            expect.objectContaining({
                campaignStatus: 'draft',
                titleSearch: 'mayo'
            })
        );
    });
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/newsletter/campaigns — create
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/newsletter/campaigns', () => {
    it('returns 201 with created campaign on success', async () => {
        mockCreate.mockResolvedValue({ data: draftCampaign, error: null });

        const app = buildApp();
        const res = await app.request('/api/v1/admin/newsletter/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validCreateBody)
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('draft');
    });

    it('returns 400 when title is missing', async () => {
        const app = buildApp();
        const res = await app.request('/api/v1/admin/newsletter/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: 'Novedades', bodyJson: { type: 'doc' } })
        });
        expect(res.status).toBe(400);
    });

    it('returns 400 when bodyJson.type is not "doc"', async () => {
        const app = buildApp();
        const res = await app.request('/api/v1/admin/newsletter/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...validCreateBody,
                bodyJson: { type: 'paragraph' }
            })
        });
        expect(res.status).toBe(400);
    });

    it('propagates service errors as 500', async () => {
        mockCreate.mockResolvedValue({
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'DB failure' }
        });

        const app = buildApp();
        const res = await app.request('/api/v1/admin/newsletter/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validCreateBody)
        });
        expect(res.status).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/newsletter/campaigns/:id — get one
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/newsletter/campaigns/:id', () => {
    it('returns 200 with campaign on success', async () => {
        const app = buildApp({ queryCampaignById: makeQueryCampaignById(draftCampaign) });
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.id).toBe(campaignId);
    });

    it('returns 404 when campaign not found', async () => {
        const app = buildApp({ queryCampaignById: makeQueryCampaignById(null) });
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}`);

        expect(res.status).toBe(404);
    });

    it('returns 400 for invalid UUID', async () => {
        const app = buildApp();
        const res = await app.request('/api/v1/admin/newsletter/campaigns/not-a-uuid');
        expect(res.status).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/newsletter/campaigns/:id — update
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/admin/newsletter/campaigns/:id', () => {
    it('returns 200 with updated campaign on success', async () => {
        const updated = { ...draftCampaign, title: 'Updated Title' };
        mockUpdate.mockResolvedValue({ data: updated, error: null });

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Updated Title' })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.title).toBe('Updated Title');
    });

    it('returns 409 when campaign is not in draft status', async () => {
        // Use a duck-typed error object so the test is resilient to the
        // setup.ts ServiceError mock which lacks the `reason` field.
        const conflictErr = Object.assign(new Error('Only DRAFT campaigns may be updated'), {
            code: 'ALREADY_EXISTS',
            reason: 'CAMPAIGN_NOT_DRAFT'
        });
        mockUpdate.mockRejectedValue(conflictErr);

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Title' })
        });

        expect(res.status).toBe(409);
    });

    it('returns 404 when campaign not found', async () => {
        // Use the code-prefixed message format so handleRouteError's string-parse
        // path maps it correctly to 404 (the mock ServiceError is not instanceof
        // the real ServiceError that handleRouteError checks).
        const notFoundErr = Object.assign(new Error('NOT_FOUND: Campaign not found'), {
            code: 'NOT_FOUND'
        });
        mockUpdate.mockRejectedValue(notFoundErr);

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Title' })
        });
        expect(res.status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/admin/newsletter/campaigns/:id — soft-delete
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/admin/newsletter/campaigns/:id', () => {
    it('returns 204 on successful soft-delete', async () => {
        mockSoftDelete.mockResolvedValue({ data: undefined, error: null });

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}`, {
            method: 'DELETE'
        });

        expect(res.status).toBe(204);
    });

    it('returns 409 when campaign is not in draft status', async () => {
        const conflictErr = Object.assign(new Error('Only DRAFT campaigns may be deleted'), {
            code: 'ALREADY_EXISTS',
            reason: 'CAMPAIGN_NOT_DRAFT'
        });
        mockSoftDelete.mockRejectedValue(conflictErr);

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}`, {
            method: 'DELETE'
        });

        expect(res.status).toBe(409);
    });

    it('returns 404 when campaign not found', async () => {
        const notFoundErr = Object.assign(new Error('NOT_FOUND: Campaign not found'), {
            code: 'NOT_FOUND'
        });
        mockSoftDelete.mockRejectedValue(notFoundErr);

        const app = buildApp();
        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${campaignId}`, {
            method: 'DELETE'
        });

        expect(res.status).toBe(404);
    });
});
