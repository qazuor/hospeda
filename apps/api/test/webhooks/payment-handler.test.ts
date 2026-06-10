/**
 * Unit tests for payment webhook handlers (payment.created, payment.updated).
 *
 * Coverage:
 * - handlePaymentCreated: happy path marks event processed
 * - handlePaymentUpdated: billing not configured → skip + mark processed
 * - handlePaymentUpdated: missing data.id → skip + mark processed
 * - handlePaymentUpdated: payment retrieve fails → mark FAILED (transient error swallow fix)
 * - handlePaymentUpdated: processPaymentUpdated throws → mark FAILED (transient error swallow fix)
 * - handlePaymentUpdated: happy path → mark processed
 *
 * RED tests (T-007):
 * - On transient error (retrieve throws, processPaymentUpdated throws), the event
 *   must be marked FAILED via markEventFailedByProviderId, NOT marked processed.
 *
 * @module test/webhooks/payment-handler
 */

import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared before imports of the handler file).
// ---------------------------------------------------------------------------

const mockMarkEventProcessedByProviderId = vi.hoisted(() => vi.fn());
const mockMarkEventFailedByProviderId = vi.hoisted(() => vi.fn());

vi.mock('../../src/routes/webhooks/mercadopago/utils', () => ({
    markEventProcessedByProviderId: mockMarkEventProcessedByProviderId,
    markEventFailedByProviderId: mockMarkEventFailedByProviderId,
    getWebhookDependencies: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/event-handler', () => ({
    cleanupRequestProviderEventId: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/payment-logic', () => ({
    processPaymentUpdated: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/lib/sentry', () => ({
    captureWebhookError: vi.fn(),
    captureBillingError: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { captureBillingError } from '../../src/lib/sentry';
import { cleanupRequestProviderEventId } from '../../src/routes/webhooks/mercadopago/event-handler';
import {
    handlePaymentCreated,
    handlePaymentUpdated
} from '../../src/routes/webhooks/mercadopago/payment-handler';
import { processPaymentUpdated } from '../../src/routes/webhooks/mercadopago/payment-logic';
import {
    getWebhookDependencies,
    markEventFailedByProviderId,
    markEventProcessedByProviderId
} from '../../src/routes/webhooks/mercadopago/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<QZPayWebhookEvent> = {}): QZPayWebhookEvent {
    return {
        id: 'mp-event-pay-1',
        type: 'payment.updated',
        data: { id: '987' },
        created: new Date('2026-05-15T10:00:00.000Z'),
        ...overrides
    };
}

function makeMockContext() {
    const store: Record<string, unknown> = { requestId: 'req-pay-1' };
    return {
        get: vi.fn((key: string) => store[key]),
        set: vi.fn((key: string, value: unknown) => {
            store[key] = value;
        })
    };
}

function makePaymentAdapter(
    overrides: Partial<{ retrieve: ReturnType<typeof vi.fn> }> = {}
): unknown {
    return {
        payments: {
            retrieve:
                overrides.retrieve ??
                vi.fn().mockResolvedValue({
                    id: '987',
                    amount: 99.99,
                    currency: 'ARS',
                    status: 'approved',
                    metadata: {}
                })
        }
    };
}

function makeDependencies(
    overrides: Partial<{
        retrieve: ReturnType<typeof vi.fn>;
    }> = {}
): NonNullable<ReturnType<typeof getWebhookDependencies>> {
    return {
        billing: {} as never,
        paymentAdapter: makePaymentAdapter(overrides) as never
    };
}

// ---------------------------------------------------------------------------
// handlePaymentCreated
// ---------------------------------------------------------------------------

describe('handlePaymentCreated', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMarkEventProcessedByProviderId.mockResolvedValue(undefined);
        mockMarkEventFailedByProviderId.mockResolvedValue(undefined);
    });

    it('marks event processed and cleans up on success', async () => {
        const event = makeEvent({ type: 'payment.created' });
        const ctx = makeMockContext();

        await handlePaymentCreated(ctx as never, event);

        expect(markEventProcessedByProviderId).toHaveBeenCalledWith({
            providerEventId: 'mp-event-pay-1'
        });
        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// handlePaymentUpdated
// ---------------------------------------------------------------------------

describe('handlePaymentUpdated', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMarkEventProcessedByProviderId.mockResolvedValue(undefined);
        mockMarkEventFailedByProviderId.mockResolvedValue(undefined);
        vi.mocked(processPaymentUpdated).mockResolvedValue({
            success: true,
            addonConfirmed: false
        } as never);
    });

    it('skips processing and marks processed when billing not configured', async () => {
        vi.mocked(getWebhookDependencies).mockReturnValue(null);

        await handlePaymentUpdated(makeMockContext() as never, makeEvent());

        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
        expect(markEventFailedByProviderId).not.toHaveBeenCalled();
        expect(processPaymentUpdated).not.toHaveBeenCalled();
    });

    it('skips processing and marks processed when event has no data.id', async () => {
        vi.mocked(getWebhookDependencies).mockReturnValue(makeDependencies());

        await handlePaymentUpdated(makeMockContext() as never, makeEvent({ data: {} }));

        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
        expect(markEventFailedByProviderId).not.toHaveBeenCalled();
        expect(processPaymentUpdated).not.toHaveBeenCalled();
    });

    it('happy path: calls processPaymentUpdated and marks processed', async () => {
        vi.mocked(getWebhookDependencies).mockReturnValue(makeDependencies());
        vi.mocked(processPaymentUpdated).mockResolvedValue({
            success: true,
            addonConfirmed: false
        } as never);

        await handlePaymentUpdated(makeMockContext() as never, makeEvent());

        expect(processPaymentUpdated).toHaveBeenCalledOnce();
        expect(markEventProcessedByProviderId).toHaveBeenCalledWith({
            providerEventId: 'mp-event-pay-1'
        });
        expect(markEventFailedByProviderId).not.toHaveBeenCalled();
        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });

    // -------------------------------------------------------------------------
    // RED tests: transient error swallow fix (T-007)
    // -------------------------------------------------------------------------

    it('[T-007 RED] payment retrieve throws → event marked FAILED, NOT processed', async () => {
        vi.mocked(getWebhookDependencies).mockReturnValue(
            makeDependencies({
                retrieve: vi.fn().mockRejectedValue(new Error('MP timeout'))
            })
        );

        await handlePaymentUpdated(makeMockContext() as never, makeEvent());

        // SHOULD fail — today the handler swallows and marks processed instead
        expect(markEventFailedByProviderId).toHaveBeenCalledWith(
            expect.objectContaining({ providerEventId: 'mp-event-pay-1' })
        );
        expect(markEventProcessedByProviderId).not.toHaveBeenCalled();
    });

    it('[T-007 RED] processPaymentUpdated throws → event marked FAILED, NOT processed', async () => {
        vi.mocked(getWebhookDependencies).mockReturnValue(makeDependencies());
        vi.mocked(processPaymentUpdated).mockRejectedValue(new Error('DB connection lost'));

        await handlePaymentUpdated(makeMockContext() as never, makeEvent());

        // SHOULD fail — today the handler swallows and marks processed instead
        expect(markEventFailedByProviderId).toHaveBeenCalledWith(
            expect.objectContaining({ providerEventId: 'mp-event-pay-1' })
        );
        expect(markEventProcessedByProviderId).not.toHaveBeenCalled();
    });

    it('[T-007 RED] transient error capture: captureBillingError or captureWebhookError called on failure', async () => {
        vi.mocked(getWebhookDependencies).mockReturnValue(makeDependencies());
        vi.mocked(processPaymentUpdated).mockRejectedValue(new Error('storage offline'));

        await handlePaymentUpdated(makeMockContext() as never, makeEvent());

        // Sentry should be notified on transient errors
        expect(captureBillingError).toHaveBeenCalled();
    });

    it('handler never throws even when mark-failed itself fails', async () => {
        vi.mocked(getWebhookDependencies).mockReturnValue(makeDependencies());
        vi.mocked(processPaymentUpdated).mockRejectedValue(new Error('DB down'));
        mockMarkEventFailedByProviderId.mockRejectedValue(new Error('mark-failed also down'));

        await expect(
            handlePaymentUpdated(makeMockContext() as never, makeEvent())
        ).resolves.toBeUndefined();
    });
});
