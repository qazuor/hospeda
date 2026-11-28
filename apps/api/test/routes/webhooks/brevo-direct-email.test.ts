/**
 * @file brevo-direct-email.test.ts
 * @description HOS-2685 AC-9: Brevo events update the direct email recipient by provider
 * message id, a hard bounce suppresses the address, a failed write answers 503 from the
 * webhook, and message ids that are not direct emails are ignored.
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    applyProviderEvent: vi.fn(),
    processBrevoWebhookEvent: vi.fn(),
    recordBounce: vi.fn()
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
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../../src/lib/email-open-analytics', () => ({ captureEmailOpen: vi.fn() }));
vi.mock('../../../src/routes/direct-email/_singletons', () => ({
    getDirectEmailMessageService: () => ({ applyProviderEvent: mocks.applyProviderEvent })
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
import { recordDirectEmailEvent } from '../../../src/routes/webhooks/brevo-direct-email';

const app = new Hono().post('/brevo/:token', _brevoWebhookHandler);

const post = (body: unknown) =>
    app.request('/brevo/test-secret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });

const event = (name: string, extra: Record<string, unknown> = {}) => ({
    event: name,
    email: 'a@example.com',
    'message-id': '<msg-1@brevo>',
    ts_event: 1795600810,
    ...extra
});

describe('recordDirectEmailEvent', () => {
    beforeEach(() => {
        mocks.applyProviderEvent.mockReset();
        mocks.applyProviderEvent.mockResolvedValue({ matched: true });
    });

    it.each([
        ['delivered', 'delivered'],
        ['opened', 'opened'],
        ['unique_opened', 'opened'],
        ['hard_bounce', 'hard_bounce'],
        ['soft_bounce', 'soft_bounce']
    ])('maps Brevo %s to %s', async (eventType, mapped) => {
        // Arrange
        const at = new Date('2026-11-28T10:00:00Z');

        // Act
        const outcome = await recordDirectEmailEvent({ eventType, messageId: '<m>', at });

        // Assert
        expect(outcome).toBe('matched');
        expect(mocks.applyProviderEvent).toHaveBeenCalledWith({
            providerMessageId: '<m>',
            event: mapped,
            at
        });
    });

    it('ignores events outside the set and events without a message id', async () => {
        expect(
            await recordDirectEmailEvent({ eventType: 'click', messageId: '<m>', at: new Date() })
        ).toBe('ignored');
        expect(
            await recordDirectEmailEvent({
                eventType: 'delivered',
                messageId: undefined,
                at: new Date()
            })
        ).toBe('ignored');
        expect(mocks.applyProviderEvent).not.toHaveBeenCalled();
    });

    it('reports ignored when the message id is not a direct email', async () => {
        mocks.applyProviderEvent.mockResolvedValue({ matched: false });
        expect(
            await recordDirectEmailEvent({
                eventType: 'delivered',
                messageId: '<n>',
                at: new Date()
            })
        ).toBe('ignored');
    });

    it('reports write_failed when the service throws', async () => {
        mocks.applyProviderEvent.mockRejectedValue(new Error('db down'));
        expect(
            await recordDirectEmailEvent({
                eventType: 'delivered',
                messageId: '<n>',
                at: new Date()
            })
        ).toBe('write_failed');
    });
});

describe('Brevo webhook handler with direct emails', () => {
    beforeEach(() => {
        _resetBrevoWebhookCache();
        mocks.applyProviderEvent.mockReset();
        mocks.applyProviderEvent.mockResolvedValue({ matched: true });
        mocks.processBrevoWebhookEvent.mockReset();
        mocks.processBrevoWebhookEvent.mockResolvedValue({ data: {} });
        mocks.recordBounce.mockReset();
        mocks.recordBounce.mockResolvedValue({ inserted: true });
    });

    it('applies a delivered event to the direct email recipient and still forwards it', async () => {
        const res = await post([event('delivered')]);

        expect(res.status).toBe(200);
        expect(mocks.applyProviderEvent).toHaveBeenCalledWith(
            expect.objectContaining({ providerMessageId: '<msg-1@brevo>', event: 'delivered' })
        );
        expect(mocks.processBrevoWebhookEvent).toHaveBeenCalledTimes(1);
    });

    it('answers 503 when the direct email write fails, so Brevo redelivers', async () => {
        mocks.applyProviderEvent.mockRejectedValue(new Error('db down'));
        const res = await post([event('hard_bounce')]);
        expect(res.status).toBe(503);
    });

    it('does not touch direct emails for events outside the set', async () => {
        const res = await post([event('spam')]);
        expect(res.status).toBe(200);
        expect(mocks.applyProviderEvent).not.toHaveBeenCalled();
    });
});
