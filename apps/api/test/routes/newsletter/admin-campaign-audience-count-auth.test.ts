/**
 * Auth-boundary tests for GET /api/v1/admin/newsletter/campaigns/:id/audience-count
 * (HOS-2586). Unlike admin-campaign-actions.test.ts this file does NOT mock the
 * authorization middleware, so the real admin gate runs: 401 for a guest, 403 for
 * an actor lacking NEWSLETTER_CAMPAIGN_SEND, 200 when it holds the permission.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetAudienceEstimate = vi.fn();

vi.mock('../../../src/routes/newsletter/admin/_singletons', () => ({
    getDefaultCampaignService: vi.fn(() => ({ getAudienceEstimate: mockGetAudienceEstimate })),
    _resetCampaignRouteSingletons: vi.fn()
}));

import { Hono } from 'hono';
import { adminCampaignAudienceCountRoute } from '../../../src/routes/newsletter/admin/campaigns';
import type { AppBindings } from '../../../src/types';
import { createGuestActor } from '../../../src/utils/actor';

const campaignId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const URL = `/api/v1/admin/newsletter/campaigns/${campaignId}/audience-count`;

const GUEST = createGuestActor();

function buildApp(actor: AppBindings['Variables']['actor']) {
    const app = new Hono<AppBindings>();
    app.use('*', async (c, next) => {
        c.set('actor', actor);
        await next();
    });
    app.route('/api/v1/admin/newsletter', adminCampaignAudienceCountRoute);
    return app;
}

describe('GET /campaigns/:id/audience-count auth boundary', () => {
    beforeEach(() => {
        mockGetAudienceEstimate.mockReset();
        mockGetAudienceEstimate.mockResolvedValue({
            data: { eligible: 1, softCapped: 0, totalCandidates: 1 },
            error: null
        });
    });

    it('returns 401 for a guest actor and never reaches the service', async () => {
        const res = await buildApp(GUEST).request(URL);

        expect(res.status).toBe(401);
        expect(mockGetAudienceEstimate).not.toHaveBeenCalled();
    });

    it('returns 403 for an admin actor without NEWSLETTER_CAMPAIGN_SEND', async () => {
        const res = await buildApp({
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            roles: [RoleEnum.ADMIN],
            permissions: [
                PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW,
                PermissionEnum.ACCESS_PANEL_ADMIN
            ],
            emailVerified: true
        }).request(URL);

        expect(res.status).toBe(403);
        expect(mockGetAudienceEstimate).not.toHaveBeenCalled();
    });

    it('returns 200 when the actor holds NEWSLETTER_CAMPAIGN_SEND', async () => {
        const res = await buildApp({
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            roles: [RoleEnum.ADMIN],
            permissions: [
                PermissionEnum.NEWSLETTER_CAMPAIGN_SEND,
                PermissionEnum.ACCESS_PANEL_ADMIN
            ],
            emailVerified: true
        }).request(URL);

        expect(res.status).toBe(200);
    });
});
