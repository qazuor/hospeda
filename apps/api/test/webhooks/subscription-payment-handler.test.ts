/**
 * Unit tests for the subscription_authorized_payment webhook handler
 * (SPEC-126 D4).
 *
 * Covers:
 * - extractAuthorizedPaymentId returns the id when payload is well-formed.
 * - extractAuthorizedPaymentId returns null on malformed payloads instead
 *   of throwing.
 * - handleSubscriptionAuthorizedPayment marks the event as processed.
 * - handleSubscriptionAuthorizedPayment swallows a markEventProcessed
 *   failure (non-blocking) so MP can retry on its own schedule.
 *
 * @module test/webhooks/subscription-payment-handler
 */

import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared before imports of the handler file).
// ---------------------------------------------------------------------------

vi.mock('../../src/routes/webhooks/mercadopago/utils', () => ({
    markEventProcessedByProviderId: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/event-handler', () => ({
    cleanupRequestProviderEventId: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { cleanupRequestProviderEventId } from '../../src/routes/webhooks/mercadopago/event-handler';
import {
    _internals,
    handleSubscriptionAuthorizedPayment
} from '../../src/routes/webhooks/mercadopago/subscription-payment-handler';
import { markEventProcessedByProviderId } from '../../src/routes/webhooks/mercadopago/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<QZPayWebhookEvent> = {}): QZPayWebhookEvent {
    return {
        id: 'mp-event-auth-pay-1',
        type: 'subscription_authorized_payment.created',
        data: { id: 'authorized-payment-abc' },
        created: new Date('2026-05-15T10:00:00.000Z'),
        ...overrides
    };
}

function makeMockContext() {
    const store: Record<string, unknown> = { requestId: 'req-1' };
    return {
        get: vi.fn((key: string) => store[key]),
        set: vi.fn((key: string, value: unknown) => {
            store[key] = value;
        })
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractAuthorizedPaymentId', () => {
    it('returns the data.id string when present', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: { id: 'pay_123' } })).toBe('pay_123');
    });

    it('returns null when data is missing', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: null })).toBeNull();
    });

    it('returns null when data is not an object', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: 'pay_123' })).toBeNull();
    });

    it('returns null when data.id is missing', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: {} })).toBeNull();
    });

    it('returns null when data.id is empty string', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: { id: '' } })).toBeNull();
    });

    it('returns null when data.id is not a string', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: { id: 123 } })).toBeNull();
    });
});

describe('handleSubscriptionAuthorizedPayment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('marks the event as processed and cleans up the request id', async () => {
        vi.mocked(markEventProcessedByProviderId).mockResolvedValue(undefined);

        await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

        expect(markEventProcessedByProviderId).toHaveBeenCalledWith({
            providerEventId: 'mp-event-auth-pay-1'
        });
        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });

    it('handles both .created and .updated event types via the same handler', async () => {
        vi.mocked(markEventProcessedByProviderId).mockResolvedValue(undefined);

        await handleSubscriptionAuthorizedPayment(
            makeMockContext() as never,
            makeEvent({
                id: 'mp-event-auth-pay-updated-1',
                type: 'subscription_authorized_payment.updated'
            })
        );

        expect(markEventProcessedByProviderId).toHaveBeenCalledWith({
            providerEventId: 'mp-event-auth-pay-updated-1'
        });
    });

    it('does NOT throw when markEventProcessedByProviderId fails', async () => {
        vi.mocked(markEventProcessedByProviderId).mockRejectedValue(new Error('db down'));

        // Should resolve, not reject — failure is logged but swallowed so MP
        // can retry on its own schedule without blocking the bucket.
        await expect(
            handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
        ).resolves.toBeUndefined();

        // Cleanup still happens so the request-scoped tracking map does not
        // leak entries.
        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });

    it('tolerates malformed payloads without throwing', async () => {
        vi.mocked(markEventProcessedByProviderId).mockResolvedValue(undefined);

        const malformed = makeEvent({ data: null });

        await expect(
            handleSubscriptionAuthorizedPayment(makeMockContext() as never, malformed)
        ).resolves.toBeUndefined();

        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
    });
});
