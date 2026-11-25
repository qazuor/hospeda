/**
 * @file brevo-email-open.test.ts
 * @description HOS-2583: a Brevo `unique_opened` webhook (the FIRST open) becomes one `email-open` analytics event.
 *
 * - AC-1: a transactional open carries the template key read from the `template:` tag.
 * - AC-3: an open with no tag, or with a key that is not in the email catalog, does not
 *   break the batch, is logged and is not reported.
 * - A newsletter open (the tracking service matched a delivery) is reported with its
 *   campaign slug and never as a transactional one.
 *
 * Mutation: removing the `reportEmailOpen` call in `routes/webhooks/brevo.ts` turns every
 * reporting case red.
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    processBrevoWebhookEvent: vi.fn(),
    captureEmailOpen: vi.fn(),
    recordBounce: vi.fn(),
    warn: vi.fn()
}));

vi.mock('../../../src/utils/env', () => ({
    env: { HOSPEDA_BREVO_WEBHOOK_SECRET: 'test-secret' }
}));
vi.mock('../../../src/utils/create-app', () => ({ createRouter: () => new Hono() }));
vi.mock('../../../src/middlewares/rate-limit', () => ({
    createPerRouteRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
        next()
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { warn: mocks.warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../../src/lib/email-open-analytics', () => ({
    captureEmailOpen: mocks.captureEmailOpen
}));
vi.mock('@repo/db', () => ({ notificationLogModel: {} }));
vi.mock('@repo/notifications', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/notifications')>()),
    recordProviderHardBounce: mocks.recordBounce
}));
vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        NewsletterTrackingService: class {
            processBrevoWebhookEvent = mocks.processBrevoWebhookEvent;
        }
    };
});

import { _brevoWebhookHandler, _resetBrevoWebhookCache } from '../../../src/routes/webhooks/brevo';

const app = new Hono().post('/brevo/:token', _brevoWebhookHandler);

function post(body: unknown, token = 'test-secret') {
    return app.request(`/brevo/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
}

/** Brevo's transactional `unique_opened` payload (developers.brevo.com, transactional webhooks). */
function openedEvent(overrides: Record<string, unknown> = {}) {
    return {
        event: 'unique_opened',
        email: 'reader@example.com',
        id: 1,
        date: '2026-11-24 10:00:00',
        ts: 1795600800,
        'message-id': '<202611241000.1@smtp-relay.mailin.fr>',
        ts_event: 1795600810,
        subject: 'Verificá tu email',
        tags: ['template:auth.verify-email'],
        user_agent: 'Mozilla/5.0 (via ggpht.com GoogleImageProxy)',
        ...overrides
    };
}

describe('Brevo webhook: unique_opened -> email-open (HOS-2583)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetBrevoWebhookCache();
        mocks.processBrevoWebhookEvent.mockResolvedValue({
            data: { updated: false, matchedByMessageId: false, matchedBySubscriberEmail: false }
        });
    });

    it('reports a transactional open with the template key from the tag (AC-1)', async () => {
        // Act
        const response = await post(openedEvent());

        // Assert
        expect(response.status).toBe(200);
        expect(mocks.captureEmailOpen).toHaveBeenCalledTimes(1);
        expect(mocks.captureEmailOpen).toHaveBeenCalledWith({
            kind: 'transactional',
            templateKey: 'auth.verify-email',
            at: expect.any(Date)
        });
    });

    it('finds the template tag among other tags', async () => {
        await post(
            openedEvent({ tags: ['category:transactional', 'template:auth.reset-password'] })
        );

        expect(mocks.captureEmailOpen).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'transactional', templateKey: 'auth.reset-password' })
        );
    });

    it('reports a newsletter open with the campaign slug the tracking service resolved', async () => {
        mocks.processBrevoWebhookEvent.mockResolvedValue({
            data: {
                updated: true,
                matchedByMessageId: true,
                matchedBySubscriberEmail: false,
                openedCampaignSlug: 'otono-aaaaaaaa'
            }
        });

        await post(openedEvent({ tags: ['campaign:aaaaaaaa-0000'] }));

        expect(mocks.captureEmailOpen).toHaveBeenCalledTimes(1);
        expect(mocks.captureEmailOpen).toHaveBeenCalledWith({
            kind: 'newsletter',
            campaignSlug: 'otono-aaaaaaaa',
            at: expect.any(Date)
        });
    });

    it('forwards a unique_opened to the tracking service as the `opened` event so opened_at gets the first open', async () => {
        await post(openedEvent());

        expect(mocks.processBrevoWebhookEvent).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'opened', email: 'reader@example.com' })
        );
    });

    it('still forwards a re-open (`opened`) to the tracking service but never reports it', async () => {
        await post(openedEvent({ event: 'opened' }));

        expect(mocks.processBrevoWebhookEvent).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'opened', email: 'reader@example.com' })
        );
        expect(mocks.captureEmailOpen).not.toHaveBeenCalled();
    });

    it('does not report a re-open of a newsletter message either', async () => {
        mocks.processBrevoWebhookEvent.mockResolvedValue({
            data: {
                updated: false,
                matchedByMessageId: true,
                matchedBySubscriberEmail: false,
                openedCampaignSlug: 'otono-aaaaaaaa'
            }
        });

        await post(openedEvent({ event: 'opened' }));

        expect(mocks.captureEmailOpen).not.toHaveBeenCalled();
    });

    it.each([
        ['no tags at all', { tags: undefined }],
        ['an empty tags array', { tags: [] }],
        ['tags without ours', { tags: ['transac_messages'] }],
        ['tags that are not an array', { tags: 'template:auth.verify-email' }]
    ])('logs and skips an open with %s without breaking the batch (AC-3)', async (_label, overrides) => {
        // Act: the untagged open is followed by a good one in the same batch
        const response = await post([openedEvent(overrides), openedEvent()]);
        const body = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(body).toMatchObject({ ok: true, processed: 2 });
        expect(mocks.captureEmailOpen).toHaveBeenCalledTimes(1);
        expect(mocks.captureEmailOpen).toHaveBeenCalledWith(
            expect.objectContaining({ templateKey: 'auth.verify-email' })
        );
        expect(mocks.warn).toHaveBeenCalledWith(
            expect.anything(),
            expect.stringContaining('no template tag')
        );
    });

    it('logs and skips an open whose template is not in the email catalog (AC-3)', async () => {
        const response = await post([
            openedEvent({ tags: ['template:made.up-template'] }),
            openedEvent()
        ]);

        expect(response.status).toBe(200);
        expect(mocks.captureEmailOpen).toHaveBeenCalledTimes(1);
        expect(mocks.warn).toHaveBeenCalledWith(
            { templateKey: 'made.up-template' },
            expect.stringContaining('not in the email catalog')
        );
    });

    it('does not report any other event type', async () => {
        await post([openedEvent({ event: 'delivered' }), openedEvent({ event: 'click' })]);

        expect(mocks.captureEmailOpen).not.toHaveBeenCalled();
    });

    it('survives a capture that throws and still answers 200 (AC-3)', async () => {
        mocks.captureEmailOpen.mockImplementationOnce(() => {
            throw new Error('umami down');
        });

        const response = await post([openedEvent(), openedEvent()]);

        expect(response.status).toBe(200);
        expect(mocks.captureEmailOpen).toHaveBeenCalledTimes(2);
    });

    it('emits nothing when a later event makes the batch answer 503, so Brevo redelivery cannot double count', async () => {
        // Arrange: the hard_bounce suppression write fails after an open was processed
        mocks.recordBounce.mockRejectedValue(new Error('db down'));

        // Act
        const response = await post([
            openedEvent(),
            {
                event: 'hard_bounce',
                email: 'gone@example.com',
                'message-id': '<x@brevo>',
                reason: 'mailbox does not exist'
            }
        ]);

        // Assert
        expect(response.status).toBe(503);
        expect(mocks.captureEmailOpen).not.toHaveBeenCalled();
    });

    it('rejects a wrong token without reporting anything', async () => {
        const response = await post(openedEvent(), 'wrong');

        expect(response.status).toBe(401);
        expect(mocks.captureEmailOpen).not.toHaveBeenCalled();
    });
});
