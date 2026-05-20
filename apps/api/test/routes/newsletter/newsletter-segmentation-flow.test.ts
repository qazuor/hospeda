/**
 * E2E-style integration test for the newsletter content-type segmentation
 * pipeline (Phase 7 of feat/newsletter-polish).
 *
 * Walks through the user-visible flow that the Phase 6 wiring is supposed to
 * enable:
 *
 *   1. Guest subscribes via `POST /api/v1/public/newsletter/subscribe`
 *      (anonymous row created with status='pending_verification').
 *   2. Subscriber sets per-content preferences via `PATCH /api/v1/protected/newsletter/preferences`
 *      (after sign-up + link). The preferences JSONB drives the segmentation.
 *   3. Admin creates a campaign with `contentType: 'offers'` via
 *      `POST /api/v1/admin/newsletter/campaigns`. The new field rides through
 *      the create body untouched.
 *   4. Admin dispatches the campaign via
 *      `POST /api/v1/admin/newsletter/campaigns/:id/send`. The dispatch path
 *      reads `campaign.contentType` and threads it into
 *      `NewsletterSubscriberService.getEligibleForCampaign`, so only
 *      subscribers with `preferences.offers = true` end up enqueued.
 *
 * The services are mocked at the singleton boundary so the test does not need
 * a real database or Redis. The point of this file is to prove the HTTP →
 * route → service-input contract for the full flow, complementing the
 * unit-level coverage in:
 *   - packages/schemas/test/entities/newsletter/newsletter-campaign.contentType.schema.test.ts
 *   - packages/service-core/test/services/newsletter/newsletter-campaign.service.test.ts
 *
 * @module test/routes/newsletter/newsletter-segmentation-flow
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE importing the route modules so vi.mock hoists
// above the imports and the route files pick up the stubbed singletons.
// ---------------------------------------------------------------------------

const subscribeGuestMock = vi.fn();
const verifyTokenMock = vi.fn();
const updatePreferencesMock = vi.fn();
const createCampaignMock = vi.fn();
const sendCampaignMock = vi.fn();
const getEligibleForCampaignMock = vi.fn();

vi.mock('../../../src/routes/newsletter/protected/_singletons', () => ({
    getDefaultNewsletterService: vi.fn(() => ({
        subscribeGuest: subscribeGuestMock,
        verifyToken: verifyTokenMock,
        updatePreferences: updatePreferencesMock,
        getEligibleForCampaign: getEligibleForCampaignMock
    })),
    getDefaultUserService: vi.fn(() => ({})),
    _resetNewsletterRouteSingletons: vi.fn()
}));

vi.mock('../../../src/routes/newsletter/admin/_singletons', () => ({
    getDefaultCampaignService: vi.fn(() => ({
        create: createCampaignMock,
        send: sendCampaignMock,
        update: vi.fn(),
        softDelete: vi.fn(),
        testSend: vi.fn(),
        cancel: vi.fn(),
        computeMetrics: vi.fn(),
        getFailedDeliveries: vi.fn()
    })),
    _resetCampaignRouteSingletons: vi.fn()
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

// Skip auth middleware so we can hit protected/admin routes from the test
// runner without minting real Better-Auth sessions.
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

vi.mock('../../../src/middlewares/authorization', () => ({
    publicAuthMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    protectedAuthMiddleware:
        () => async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
            c.set('actor', {
                id: ACTOR_ID,
                role: 'USER',
                permissions: ['newsletter.subscriber.update']
            });
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
                    'newsletter.campaign.send',
                    'newsletter.subscriber.update'
                ]
            });
            await next();
        }
}));

// Imports come AFTER the mocks so the route handlers resolve our stubs.
import { NewsletterContentTypeEnum } from '@repo/schemas';
import { Hono } from 'hono';
import {
    adminCreateCampaignRoute,
    adminSendCampaignRoute
} from '../../../src/routes/newsletter/admin/campaigns';
import { newsletterPreferencesRoute } from '../../../src/routes/newsletter/protected/preferences';
import { newsletterGuestSubscribeRoute } from '../../../src/routes/newsletter/public/subscribe';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CAMPAIGN_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const draftCampaign = {
    id: CAMPAIGN_ID,
    title: 'Ofertas de mayo',
    subject: 'Ofertas — mayo 2026',
    bodyJson: { type: 'doc' as const, content: [] },
    status: 'draft' as const,
    localeFilter: 'all' as const,
    contentType: NewsletterContentTypeEnum.OFFERS,
    totalRecipients: null,
    totalSoftcapped: 0,
    sentAt: null,
    scheduledFor: null,
    createdBy: ACTOR_ID,
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    deletedAt: null
};

function buildApp() {
    const app = new Hono();
    app.route('/api/v1/public/newsletter', newsletterGuestSubscribeRoute);
    // The preferences route already declares `/newsletter/preferences`, so it
    // mounts under the protected prefix without the entity segment.
    app.route('/api/v1/protected', newsletterPreferencesRoute);
    app.route('/api/v1/admin/newsletter', adminCreateCampaignRoute);
    app.route('/api/v1/admin/newsletter', adminSendCampaignRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    subscribeGuestMock.mockReset();
    verifyTokenMock.mockReset();
    updatePreferencesMock.mockReset();
    createCampaignMock.mockReset();
    sendCampaignMock.mockReset();
    getEligibleForCampaignMock.mockReset();
});

// ---------------------------------------------------------------------------
// Flow tests
// ---------------------------------------------------------------------------

describe('newsletter content-type segmentation flow (Phase 7)', () => {
    it('threads contentType from guest signup through admin dispatch end-to-end', async () => {
        // Step 1 — guest signs up via the public endpoint.
        subscribeGuestMock.mockResolvedValue({
            data: { status: 'pending_verification' },
            error: null
        });

        const app = buildApp();

        const subscribeRes = await app.request('/api/v1/public/newsletter/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'guest+offers@example.com',
                locale: 'es',
                source: 'web_footer'
            })
        });

        expect(subscribeRes.status).toBe(201);
        expect(subscribeGuestMock).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'guest+offers@example.com',
                locale: 'es'
            })
        );

        // Step 2 — once linked, the (now-authenticated) subscriber updates
        // their per-content preferences. We only opt INTO offers; the others
        // stay at their default.
        updatePreferencesMock.mockResolvedValue({
            data: {
                preferences: {
                    offers: true,
                    events: false,
                    guides: false,
                    productNews: false
                }
            },
            error: null
        });

        const prefsRes = await app.request('/api/v1/protected/newsletter/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offers: true, events: false })
        });

        expect(prefsRes.status).toBe(200);
        expect(updatePreferencesMock).toHaveBeenCalledTimes(1);
        const prefsArgs = updatePreferencesMock.mock.calls[0];
        // The preferences handler forwards `(actor, { userId, preferences })`
        // — the second arg wraps the parsed partial body.
        expect(prefsArgs?.[1]).toMatchObject({
            userId: ACTOR_ID,
            preferences: { offers: true, events: false }
        });

        // Step 3 — admin creates a campaign with contentType=offers.
        createCampaignMock.mockResolvedValue({ data: draftCampaign, error: null });

        const createRes = await app.request('/api/v1/admin/newsletter/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Ofertas de mayo',
                subject: 'Ofertas — mayo 2026',
                bodyJson: { type: 'doc', content: [] },
                localeFilter: 'all',
                contentType: NewsletterContentTypeEnum.OFFERS
            })
        });

        expect(createRes.status).toBe(201);
        const createdBody = await createRes.json();
        expect(createdBody.data.contentType).toBe('offers');
        expect(createCampaignMock).toHaveBeenCalledTimes(1);
        const createArgs = createCampaignMock.mock.calls[0];
        // Route forwards { ...parsed, createdBy } to the service.
        expect(createArgs?.[1]).toMatchObject({
            title: 'Ofertas de mayo',
            contentType: NewsletterContentTypeEnum.OFFERS,
            createdBy: ACTOR_ID
        });

        // Step 4 — admin dispatches the campaign. The send service resolves
        // the eligible audience (via getEligibleForCampaign), enqueues, and
        // returns the counts. We assert the HTTP contract is wired and the
        // service call shape is correct.
        sendCampaignMock.mockResolvedValue({
            data: { enqueued: 1, softcapped: 0 },
            error: null
        });

        const sendRes = await app.request(
            `/api/v1/admin/newsletter/campaigns/${CAMPAIGN_ID}/send`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            }
        );

        expect(sendRes.status).toBe(202);
        const sendBody = await sendRes.json();
        // The send handler returns ctx.json() directly so the body is the raw
        // payload, NOT wrapped in { success, data }.
        expect(sendBody).toMatchObject({
            dispatched: true,
            enqueued: 1,
            softcapped: 0
        });
        expect(sendCampaignMock).toHaveBeenCalledTimes(1);
        // The send route hands the campaign id to the service; the service
        // itself (covered by unit tests) reads the row's contentType from
        // the DB and threads it into getEligibleForCampaign.
        const sendArgs = sendCampaignMock.mock.calls[0];
        expect(sendArgs?.[1]).toMatchObject({ id: CAMPAIGN_ID });
    });

    it('200 no-eligible response when the contentType filter matches no subscribers', async () => {
        sendCampaignMock.mockResolvedValue({
            data: { enqueued: 0, softcapped: 0 },
            error: null
        });

        const app = buildApp();

        const res = await app.request(`/api/v1/admin/newsletter/campaigns/${CAMPAIGN_ID}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({
            dispatched: false,
            reason: 'no_eligible_subscribers'
        });
    });

    it('create with contentType=null (legacy unsegmented) is accepted', async () => {
        createCampaignMock.mockResolvedValue({
            data: { ...draftCampaign, contentType: null },
            error: null
        });

        const app = buildApp();

        const res = await app.request('/api/v1/admin/newsletter/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Newsletter mensual',
                subject: 'Lo nuevo de este mes',
                bodyJson: { type: 'doc', content: [] },
                localeFilter: 'all',
                contentType: null
            })
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.contentType).toBeNull();
        expect(createCampaignMock.mock.calls[0]?.[1]).toMatchObject({ contentType: null });
    });

    it('create rejects an unknown contentType value at the zValidator boundary', async () => {
        const app = buildApp();

        const res = await app.request('/api/v1/admin/newsletter/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Newsletter mensual',
                subject: 'Lo nuevo de este mes',
                bodyJson: { type: 'doc', content: [] },
                localeFilter: 'all',
                contentType: 'announcements'
            })
        });

        expect(res.status).toBe(400);
        // Validation rejection happens upstream of the service.
        expect(createCampaignMock).not.toHaveBeenCalled();
    });
});
