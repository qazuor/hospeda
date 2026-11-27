/** Campaign action contracts: real authorization, service arguments and domain errors. */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const mocks = vi.hoisted(() => ({
    send: vi.fn(),
    testSend: vi.fn(),
    cancel: vi.fn(),
    computeMetrics: vi.fn(),
    getAudienceEstimate: vi.fn(),
    getFailedDeliveries: vi.fn(),
    preview: vi.fn(),
    user: vi.fn()
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    resolveCampaignPreview: mocks.preview
}));
vi.mock('../../../src/routes/newsletter/admin/_singletons', () => ({
    getDefaultCampaignService: vi.fn(() => mocks)
}));
vi.mock('../../../src/routes/newsletter/protected/_singletons', () => ({
    getDefaultUserService: vi.fn(() => ({ getById: mocks.user }))
}));
vi.mock('../../../src/middlewares/rate-limit', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/middlewares/rate-limit')>()),
    createPerRouteRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
        next()
}));

import {
    adminCampaignAudienceCountRoute,
    adminCampaignErrorsRoute,
    adminCampaignMetricsRoute,
    adminCancelCampaignRoute,
    adminResolvePreviewCampaignRoute,
    adminSendCampaignRoute,
    adminTestSendCampaignRoute
} from '../../../src/routes/newsletter/admin/campaigns';

const campaignId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const actor = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roles: [RoleEnum.ADMIN],
    emailVerified: true,
    permissions: [
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW,
        PermissionEnum.NEWSLETTER_CAMPAIGN_SEND
    ]
};
const email = 'admin@example.com';
const base = `/api/v1/admin/newsletter/campaigns/${campaignId}`;
const report = {
    blocks: [
        {
            blockKey: 'newest-01',
            candidates: ['a', 'b'],
            dropped: [],
            repeatsUsed: 0,
            belowMin: true,
            action: 'skip_run'
        }
    ]
};

function buildApp(input: { permissions?: PermissionEnum[] } = {}) {
    const app = new Hono<AppBindings>();
    app.use('*', async (c, next) => {
        c.set('actor', { ...actor, permissions: input.permissions ?? actor.permissions });
        await next();
    });
    for (const route of [
        adminCampaignAudienceCountRoute,
        adminCampaignErrorsRoute,
        adminCampaignMetricsRoute,
        adminCancelCampaignRoute,
        adminResolvePreviewCampaignRoute,
        adminSendCampaignRoute,
        adminTestSendCampaignRoute
    ]) {
        app.route('/api/v1/admin/newsletter', route);
    }
    return app;
}

function post(input: { path: string; body?: unknown; permissions?: PermissionEnum[] }) {
    return buildApp({ permissions: input.permissions }).request(input.path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
        ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) })
    });
}

beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.user.mockResolvedValue({ data: { email }, error: null });
});

describe('test-send', () => {
    it('resolves the actor email and forwards the actor and campaign', async () => {
        mocks.testSend.mockResolvedValue({ data: { sentTo: email }, error: null });
        const response = await post({ path: `${base}/test-send`, body: {} });
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({ sent: true, sentTo: email });
        expect(mocks.testSend.mock.calls).toEqual([[actor, { id: campaignId, toEmail: email }]]);
        expect(mocks.user.mock.calls).toEqual([[actor, actor.id]]);
    });
    it('forwards an override without reading the user', async () => {
        mocks.testSend.mockResolvedValue({ data: { sentTo: 'override@example.com' }, error: null });
        const response = await post({
            path: `${base}/test-send`,
            body: { toEmail: 'override@example.com' }
        });
        expect(response.status).toBe(200);
        expect(mocks.testSend.mock.calls).toEqual([
            [actor, { id: campaignId, toEmail: 'override@example.com' }]
        ]);
        expect(mocks.user).not.toHaveBeenCalled();
    });
    it('rejects an invalid email before the service', async () => {
        expect(
            (await post({ path: `${base}/test-send`, body: { toEmail: 'invalid' } })).status
        ).toBe(400);
        expect(mocks.testSend).not.toHaveBeenCalled();
    });
    it('rejects an actor with no email', async () => {
        mocks.user.mockResolvedValue({ data: { email: null }, error: null });
        expect((await post({ path: `${base}/test-send`, body: {} })).status).toBe(400);
        expect(mocks.testSend).not.toHaveBeenCalled();
    });
    it('maps returned service-unavailable errors to 503', async () => {
        mocks.testSend.mockResolvedValue({
            data: null,
            error: { code: ServiceErrorCode.SERVICE_UNAVAILABLE, message: 'Unavailable' }
        });
        expect((await post({ path: `${base}/test-send`, body: {} })).status).toBe(503);
        expect(mocks.testSend.mock.calls).toEqual([[actor, { id: campaignId, toEmail: email }]]);
    });
});

describe('send and cancel', () => {
    it('returns 202 with the dispatched count', async () => {
        mocks.send.mockResolvedValue({ data: { enqueued: 1500, softcapped: 42 }, error: null });
        const response = await post({ path: `${base}/send` });
        expect(response.status).toBe(202);
        expect(await response.json()).toEqual({ dispatched: true, enqueued: 1500, softcapped: 42 });
        expect(mocks.send.mock.calls).toEqual([[actor, { id: campaignId }]]);
    });
    it('returns 200 for an empty audience', async () => {
        mocks.send.mockResolvedValue({ data: { enqueued: 0, softcapped: 200 }, error: null });
        const response = await post({ path: `${base}/send` });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            dispatched: false,
            reason: 'no_eligible_subscribers'
        });
    });
    it('returns skipped deliveries on cancellation', async () => {
        mocks.cancel.mockResolvedValue({ data: { skipped: 1450 }, error: null });
        const response = await post({ path: `${base}/cancel` });
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({ cancelled: true, skipped: 1450 });
        expect(mocks.cancel.mock.calls).toEqual([[actor, { id: campaignId }]]);
    });
    it.each(['send', 'cancel'] as const)('%s maps state conflicts to 409', async (action) => {
        mocks[action].mockRejectedValue(
            new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'State conflict',
                undefined,
                action === 'send' ? 'CAMPAIGN_NOT_SENDABLE' : 'CAMPAIGN_NOT_CANCELLABLE'
            )
        );
        expect((await post({ path: `${base}/${action}` })).status).toBe(409);
        expect(mocks[action].mock.calls).toEqual([[actor, { id: campaignId }]]);
    });
    it.each(['send', 'cancel'] as const)('%s maps not-found to 404', async (action) => {
        mocks[action].mockRejectedValue(
            new ServiceError(ServiceErrorCode.NOT_FOUND, 'Campaign not found')
        );
        expect((await post({ path: `${base}/${action}` })).status).toBe(404);
    });
});

describe('dynamic campaign actions', () => {
    it.each([
        'thrown',
        'returned'
    ] as const)('preserves the 422 code and report for a %s send rejection', async (mode) => {
        const error = new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Below minimum',
            { statusCode: 422, report },
            'DYNAMIC_BLOCK_BELOW_MIN'
        );
        if (mode === 'thrown') mocks.send.mockRejectedValue(error);
        else mocks.send.mockResolvedValue({ data: null, error });
        const response = await post({ path: `${base}/send` });
        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'DYNAMIC_BLOCK_BELOW_MIN',
            details: { report }
        });
        expect(mocks.send.mock.calls).toEqual([[actor, { id: campaignId }]]);
    });
    it('forwards preview dependencies and returns HTML and the report without dispatch', async () => {
        const preview = {
            html: '<p>Resolved</p>',
            segments: ['<p>Resolved</p>'],
            report: { blocks: [] }
        };
        mocks.preview.mockResolvedValue(preview);
        const response = await post({ path: `${base}/resolve-preview` });
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect((await response.json()).data).toEqual(preview);
        expect(mocks.preview.mock.calls).toEqual([
            [
                {
                    actor,
                    id: campaignId,
                    port: expect.objectContaining({ fetchCandidates: expect.any(Function) }),
                    renderNewsletterEmailFn: expect.any(Function),
                    renderTiptapEmailFn: expect.any(Function)
                }
            ]
        ]);
        expect(mocks.send).not.toHaveBeenCalled();
        expect(mocks.testSend).not.toHaveBeenCalled();
    });
    it.each([
        'resolve-preview',
        'test-send',
        'send'
    ])('%s maps INVALID_DYNAMIC_BLOCK to 400', async (action) => {
        const mock =
            action === 'resolve-preview'
                ? mocks.preview
                : action === 'test-send'
                  ? mocks.testSend
                  : mocks.send;
        mock.mockRejectedValue(
            new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Invalid configuration',
                undefined,
                'INVALID_DYNAMIC_BLOCK'
            )
        );
        const response = await post({
            path: `${base}/${action}`,
            body: action === 'test-send' ? {} : undefined
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.code).toBe('INVALID_DYNAMIC_BLOCK');
        expect(mock).toHaveBeenCalledOnce();
    });
    it('rejects a malformed preview id before calling the service', async () => {
        expect(
            (await post({ path: '/api/v1/admin/newsletter/campaigns/invalid/resolve-preview' }))
                .status
        ).toBe(400);
        expect(mocks.preview).not.toHaveBeenCalled();
    });
    it('returns 403 without send permission, before validating the id', async () => {
        const response = await post({
            path: '/api/v1/admin/newsletter/campaigns/invalid/resolve-preview',
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW
            ]
        });
        expect(response.status).toBe(403);
        expect(mocks.preview).not.toHaveBeenCalled();
    });
});

describe('metrics and audience reads', () => {
    it('returns fresh metrics', async () => {
        const data = {
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
        mocks.computeMetrics.mockResolvedValue({ data, error: null });
        const response = await buildApp().request(`${base}/metrics`);
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect((await response.json()).data).toEqual(data);
        expect(mocks.computeMetrics.mock.calls).toEqual([[actor, { id: campaignId }]]);
    });
    it.each([false, true])('forwards ignoreSoftCap=%s', async (ignoreSoftCap) => {
        const data = { eligible: 7, softCapped: 2, totalCandidates: 9 };
        mocks.getAudienceEstimate.mockResolvedValue({ data, error: null });
        const response = await buildApp().request(
            `${base}/audience-count${ignoreSoftCap ? '?ignoreSoftCap=true' : ''}`
        );
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect((await response.json()).data).toEqual(data);
        expect(mocks.getAudienceEstimate.mock.calls).toEqual([
            [actor, { id: campaignId, ignoreSoftCap }]
        ]);
    });
    it('rejects invalid audience campaign ids', async () => {
        expect(
            (await buildApp().request('/api/v1/admin/newsletter/campaigns/invalid/audience-count'))
                .status
        ).toBe(400);
        expect(mocks.getAudienceEstimate).not.toHaveBeenCalled();
    });
    it.each([
        ['metrics', 'computeMetrics'],
        ['errors', 'getFailedDeliveries'],
        ['audience-count', 'getAudienceEstimate']
    ] as const)('%s maps missing campaigns to 404', async (path, method) => {
        mocks[method].mockRejectedValue(
            new ServiceError(ServiceErrorCode.NOT_FOUND, 'Campaign not found')
        );
        expect((await buildApp().request(`${base}/${path}`)).status).toBe(404);
    });
    it('returns masked failure details', async () => {
        const item = {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            subscriberId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            channel: 'email',
            errorMessage: 'SMTP timeout',
            retryCount: 3,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        mocks.getFailedDeliveries.mockResolvedValue({
            data: { items: [item], total: 1 },
            error: null
        });
        const response = await buildApp().request(`${base}/errors`);
        expect(response.status).toBe(200);
        const data = (await response.json()).data;
        expect(data.items).toHaveLength(1);
        expect(data.items[0]).toMatchObject({
            subscriberId: item.subscriberId,
            maskedEmail: 'su***@masked.invalid',
            errorMessage: 'SMTP timeout',
            retryCount: 3
        });
    });
    it('returns empty failures and forwards pagination', async () => {
        mocks.getFailedDeliveries.mockResolvedValue({ data: { items: [], total: 0 }, error: null });
        const response = await buildApp().request(`${base}/errors?page=2&pageSize=10`);
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({ items: [], pagination: { total: 0 } });
        expect(mocks.getFailedDeliveries.mock.calls).toEqual([
            [actor, { id: campaignId, page: 2, pageSize: 10 }]
        ]);
    });
});
