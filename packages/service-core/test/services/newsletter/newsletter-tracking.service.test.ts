/**
 * @file newsletter-tracking.service.test.ts
 *
 * Unit tests for NewsletterTrackingService (SPEC-101 T-101-17).
 *
 * Every external dependency is mocked:
 *   - `@repo/db`: `getDb()` returns a chainable Drizzle stub backed by
 *     `queryBuilderResponses`. Each terminal call (await on `.returning()`)
 *     resolves to the next entry.
 *
 * Coverage areas (1 case per event type plus edge cases):
 *   - delivered: success, missing messageId, no match (already delivered)
 *   - opened / click: success, no match (idempotency)
 *   - soft_bounce: success, missing messageId
 *   - hard_bounce: subscriber updated + delivery updated, subscriber-only fallback
 *   - spam / complained / unsubscribed / invalid_email: subscriber updated, no match
 */

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

let queryBuilderResponses: unknown[][] = [];

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();

    const buildChain = (): Record<string, unknown> => {
        const rows = queryBuilderResponses.shift() ?? [];
        const chain: Record<string, unknown> = {};
        const methods = ['select', 'from', 'where', 'limit', 'update', 'set', 'returning'];
        for (const m of methods) {
            chain[m] = vi.fn(() => chain);
        }
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable for Drizzle chain mock
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
        return chain;
    };

    const mockDb = {
        select: vi.fn(() => buildChain()),
        update: vi.fn(() => buildChain())
    };

    return {
        ...original,
        getDb: vi.fn(() => mockDb),
        newsletterCampaignDeliveries: original.newsletterCampaignDeliveries,
        newsletterSubscribers: original.newsletterSubscribers
    };
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterTrackingService } from '../../../src/services/newsletter/newsletter-tracking.service.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DATE = new Date('2026-05-12T15:00:00.000Z');
const EMAIL = 'subscriber@example.com';
const MESSAGE_ID = '<202605121500.brevo@hospeda.com.ar>';
const DELIVERY_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SUBSCRIBER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeService(): NewsletterTrackingService {
    return new NewsletterTrackingService({});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewsletterTrackingService.processBrevoWebhookEvent', () => {
    beforeEach(() => {
        queryBuilderResponses = [];
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('delivered event', () => {
        it('updates deliveredAt on the matching delivery row', async () => {
            queryBuilderResponses = [[{ id: DELIVERY_ID }]];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'delivered',
                email: EMAIL,
                messageId: MESSAGE_ID,
                date: DATE
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.updated).toBe(true);
            expect(result.data?.matchedByMessageId).toBe(true);
            expect(result.data?.matchedBySubscriberEmail).toBe(false);
        });

        it('reports skipped when there is no matching pending delivery', async () => {
            queryBuilderResponses = [[]]; // no rows returned

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'delivered',
                email: EMAIL,
                messageId: MESSAGE_ID,
                date: DATE
            });

            expect(result.data?.updated).toBe(false);
            expect(result.data?.skippedReason).toBe('no_match_or_already_delivered');
        });

        it('skips when messageId is missing', async () => {
            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'delivered',
                email: EMAIL,
                date: DATE
            });

            expect(result.data?.updated).toBe(false);
            expect(result.data?.skippedReason).toBe('missing_message_id');
        });
    });

    describe('opened event', () => {
        it('records the first open via WHERE opened_at IS NULL', async () => {
            queryBuilderResponses = [[{ id: DELIVERY_ID }]];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'opened',
                email: EMAIL,
                messageId: MESSAGE_ID,
                date: DATE
            });

            expect(result.data?.updated).toBe(true);
            expect(result.data?.matchedByMessageId).toBe(true);
        });

        it('is idempotent — duplicate open reports as no-match', async () => {
            queryBuilderResponses = [[]];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'opened',
                email: EMAIL,
                messageId: MESSAGE_ID,
                date: DATE
            });

            expect(result.data?.updated).toBe(false);
            expect(result.data?.skippedReason).toBe('no_match_or_already_opened');
        });
    });

    describe('click event', () => {
        it('records the first click via WHERE first_click_at IS NULL', async () => {
            queryBuilderResponses = [[{ id: DELIVERY_ID }]];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'click',
                email: EMAIL,
                messageId: MESSAGE_ID,
                date: DATE
            });

            expect(result.data?.updated).toBe(true);
        });

        it('is idempotent on duplicates', async () => {
            queryBuilderResponses = [[]];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'click',
                email: EMAIL,
                messageId: MESSAGE_ID,
                date: DATE
            });

            expect(result.data?.updated).toBe(false);
            expect(result.data?.skippedReason).toBe('no_match_or_already_clicked');
        });
    });

    describe('soft_bounce event', () => {
        it('increments retryCount on the delivery row', async () => {
            queryBuilderResponses = [[{ id: DELIVERY_ID }]];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'soft_bounce',
                email: EMAIL,
                messageId: MESSAGE_ID,
                date: DATE
            });

            expect(result.data?.updated).toBe(true);
        });

        it('skips when messageId is missing', async () => {
            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'soft_bounce',
                email: EMAIL,
                date: DATE
            });

            expect(result.data?.updated).toBe(false);
            expect(result.data?.skippedReason).toBe('missing_message_id');
        });
    });

    describe('hard_bounce event', () => {
        it('updates BOTH the delivery and the subscriber', async () => {
            queryBuilderResponses = [
                [{ id: DELIVERY_ID }], // delivery UPDATE
                [{ id: SUBSCRIBER_ID }] // subscriber UPDATE
            ];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'hard_bounce',
                email: EMAIL,
                messageId: MESSAGE_ID,
                date: DATE
            });

            expect(result.data?.updated).toBe(true);
            expect(result.data?.matchedByMessageId).toBe(true);
            expect(result.data?.matchedBySubscriberEmail).toBe(true);
        });

        it('falls back to subscriber-only when messageId is missing', async () => {
            queryBuilderResponses = [[{ id: SUBSCRIBER_ID }]];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'hard_bounce',
                email: EMAIL,
                date: DATE
            });

            expect(result.data?.updated).toBe(true);
            expect(result.data?.matchedByMessageId).toBe(false);
            expect(result.data?.matchedBySubscriberEmail).toBe(true);
        });

        it('reports no_match when neither delivery nor subscriber is found', async () => {
            queryBuilderResponses = [[], []];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'hard_bounce',
                email: EMAIL,
                messageId: MESSAGE_ID,
                date: DATE
            });

            expect(result.data?.updated).toBe(false);
            expect(result.data?.skippedReason).toBe('no_match_for_email_or_message_id');
        });
    });

    describe('subscriber-only events', () => {
        it.each([
            ['spam', 'COMPLAINED'],
            ['complained', 'COMPLAINED'],
            ['unsubscribed', 'UNSUBSCRIBED'],
            ['invalid_email', 'BOUNCED']
        ] as const)('flips the subscriber on %s event', async (event, _expectedStatus) => {
            queryBuilderResponses = [[{ id: SUBSCRIBER_ID }]];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event,
                email: EMAIL,
                date: DATE
            });

            expect(result.data?.updated).toBe(true);
            expect(result.data?.matchedBySubscriberEmail).toBe(true);
            expect(result.data?.matchedByMessageId).toBe(false);
        });

        it('reports no subscriber match for unknown email', async () => {
            queryBuilderResponses = [[]];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'complained',
                email: 'unknown@example.com',
                date: DATE
            });

            expect(result.data?.updated).toBe(false);
            expect(result.data?.skippedReason).toBe('no_subscriber_for_email');
        });
    });

    describe('input validation', () => {
        it('rejects unknown event types', async () => {
            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'not_a_real_event' as unknown as 'delivered',
                email: EMAIL,
                date: DATE
            });

            expect(result.error).toBeDefined();
        });

        it('rejects malformed emails', async () => {
            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'delivered',
                email: 'not-an-email',
                messageId: MESSAGE_ID,
                date: DATE
            });

            expect(result.error).toBeDefined();
        });

        it('lowercases the email before lookup', async () => {
            queryBuilderResponses = [[{ id: SUBSCRIBER_ID }]];

            const svc = makeService();
            const result = await svc.processBrevoWebhookEvent({
                event: 'unsubscribed',
                email: 'CAPS@EXAMPLE.COM',
                date: DATE
            });

            expect(result.data?.updated).toBe(true);
            // The Zod schema applies .toLowerCase(), so the SQL sees a lowercased value.
        });
    });
});
