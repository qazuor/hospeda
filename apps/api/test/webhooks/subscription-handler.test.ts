/**
 * Unit tests for the MercadoPago subscription webhook handler.
 *
 * Tests cover:
 * - handleSubscriptionUpdated dispatches to processSubscriptionUpdated correctly
 * - Event is marked as processed on successful result
 * - Event is marked as processed when billing is not configured (skipped gracefully)
 * - Error propagation when processSubscriptionUpdated throws
 * - The `source` parameter passed to processSubscriptionUpdated is 'webhook'
 *
 * @module test/webhooks/subscription-handler
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared before any imports that use them)
// ---------------------------------------------------------------------------

vi.mock('../../src/routes/webhooks/mercadopago/subscription-logic', () => ({
    processSubscriptionUpdated: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/utils', () => ({
    getWebhookDependencies: vi.fn(),
    markEventProcessedByProviderId: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/routes/webhooks/mercadopago/event-handler', () => ({
    cleanupRequestProviderEventId: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (vi.mock calls above are hoisted by Vitest, so these are safe)
// ---------------------------------------------------------------------------

import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { cleanupRequestProviderEventId } from '../../src/routes/webhooks/mercadopago/event-handler';
import {
    handleSubscriptionPreapprovalEvent,
    handleSubscriptionUpdated
} from '../../src/routes/webhooks/mercadopago/subscription-handler';
import { processSubscriptionUpdated } from '../../src/routes/webhooks/mercadopago/subscription-logic';
import {
    getWebhookDependencies,
    markEventProcessedByProviderId
} from '../../src/routes/webhooks/mercadopago/utils';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal QZPayWebhookEvent for subscription_preapproval.updated.
 */
function makeSubscriptionEvent(overrides: Partial<QZPayWebhookEvent> = {}): QZPayWebhookEvent {
    return {
        id: 'mp-event-sub-1',
        type: 'subscription_preapproval.updated',
        data: { id: 'preapproval-abc', status: 'active' },
        created: new Date('2024-01-15T10:00:00Z'),
        ...overrides
    };
}

/**
 * Build a minimal mock Hono context with a working `get` method.
 */
function makeMockContext(overrides: Record<string, unknown> = {}) {
    const store: Record<string, unknown> = { requestId: 'test-request-id', ...overrides };
    return {
        get: vi.fn((key: string) => store[key]),
        set: vi.fn((key: string, value: unknown) => {
            store[key] = value;
        })
    };
}

/**
 * Build a minimal webhook dependencies mock.
 */
function makeWebhookDeps() {
    return {
        billing: {
            customers: { get: vi.fn() },
            plans: { get: vi.fn() }
        },
        paymentAdapter: {
            subscriptions: { retrieve: vi.fn() }
        }
    };
}

// ---------------------------------------------------------------------------
// Shared setup/teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ===========================================================================
// handleSubscriptionUpdated
// ===========================================================================

describe('handleSubscriptionUpdated', () => {
    // -------------------------------------------------------------------------
    // Test 1: Calls processSubscriptionUpdated with correct params
    // -------------------------------------------------------------------------
    it('should call processSubscriptionUpdated with event, deps, providerEventId, and source=webhook', async () => {
        // Arrange
        const event = makeSubscriptionEvent({ id: 'mp-event-123' });
        const deps = makeWebhookDeps();

        vi.mocked(getWebhookDependencies).mockReturnValue(
            deps as unknown as ReturnType<typeof getWebhookDependencies>
        );
        vi.mocked(processSubscriptionUpdated).mockResolvedValue({
            success: true,
            statusChanged: true,
            newStatus: 'active'
        });
        vi.mocked(markEventProcessedByProviderId).mockResolvedValue(undefined);

        // Act
        await handleSubscriptionUpdated(makeMockContext() as never, event);

        // Assert
        expect(processSubscriptionUpdated).toHaveBeenCalledOnce();
        expect(processSubscriptionUpdated).toHaveBeenCalledWith({
            event,
            billing: deps.billing,
            paymentAdapter: deps.paymentAdapter,
            providerEventId: 'mp-event-123',
            source: 'webhook'
        });
        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });

    // -------------------------------------------------------------------------
    // Test 2: Marks event as processed on success
    // -------------------------------------------------------------------------
    it('should mark event as processed when processSubscriptionUpdated returns success=true', async () => {
        // Arrange
        const event = makeSubscriptionEvent({ id: 'mp-event-456' });
        const deps = makeWebhookDeps();

        vi.mocked(getWebhookDependencies).mockReturnValue(
            deps as unknown as ReturnType<typeof getWebhookDependencies>
        );
        vi.mocked(processSubscriptionUpdated).mockResolvedValue({
            success: true,
            statusChanged: false
        });
        vi.mocked(markEventProcessedByProviderId).mockResolvedValue(undefined);

        // Act
        await handleSubscriptionUpdated(makeMockContext() as never, event);

        // Assert
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
        expect(markEventProcessedByProviderId).toHaveBeenCalledWith({
            providerEventId: 'mp-event-456'
        });
        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });

    // -------------------------------------------------------------------------
    // Test 3: Marks event as processed when billing is not configured
    // -------------------------------------------------------------------------
    it('should mark event as processed and skip business logic when billing is not configured', async () => {
        // Arrange
        const event = makeSubscriptionEvent({ id: 'mp-event-no-billing' });

        // getWebhookDependencies returns null when billing is not configured
        vi.mocked(getWebhookDependencies).mockReturnValue(null);
        vi.mocked(markEventProcessedByProviderId).mockResolvedValue(undefined);

        // Act
        await handleSubscriptionUpdated(makeMockContext() as never, event);

        // Assert — no business logic, but event is still marked processed
        expect(processSubscriptionUpdated).not.toHaveBeenCalled();
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
        expect(markEventProcessedByProviderId).toHaveBeenCalledWith({
            providerEventId: 'mp-event-no-billing'
        });
        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });

    // -------------------------------------------------------------------------
    // Test 4: Error propagation when processSubscriptionUpdated throws
    // -------------------------------------------------------------------------
    it('should propagate the error when processSubscriptionUpdated throws', async () => {
        // Arrange
        const event = makeSubscriptionEvent({ id: 'mp-event-throw' });
        const deps = makeWebhookDeps();

        vi.mocked(getWebhookDependencies).mockReturnValue(
            deps as unknown as ReturnType<typeof getWebhookDependencies>
        );

        const mpApiError = new Error('MercadoPago API timeout');
        vi.mocked(processSubscriptionUpdated).mockRejectedValue(mpApiError);

        // Act & Assert — error must propagate so the event enters the dead letter queue
        await expect(handleSubscriptionUpdated(makeMockContext() as never, event)).rejects.toThrow(
            'MercadoPago API timeout'
        );

        // Neither markEventProcessedByProviderId nor cleanupRequestProviderEventId
        // must be called when processing throws
        expect(markEventProcessedByProviderId).not.toHaveBeenCalled();
        expect(cleanupRequestProviderEventId).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test 5: Does NOT mark event processed when processSubscriptionUpdated fails
    // -------------------------------------------------------------------------
    it('should not mark event as processed when processSubscriptionUpdated returns success=false', async () => {
        // Arrange
        const event = makeSubscriptionEvent({ id: 'mp-event-fail' });
        const deps = makeWebhookDeps();

        vi.mocked(getWebhookDependencies).mockReturnValue(
            deps as unknown as ReturnType<typeof getWebhookDependencies>
        );
        vi.mocked(processSubscriptionUpdated).mockResolvedValue({
            success: false,
            statusChanged: false,
            error: 'Subscription not found'
        });

        // Act
        await handleSubscriptionUpdated(makeMockContext() as never, event);

        // Assert — when result.success is false, neither markEventProcessedByProviderId
        // nor cleanupRequestProviderEventId is called
        // (the event handler upstream will mark it as failed + add to dead letter queue)
        expect(markEventProcessedByProviderId).not.toHaveBeenCalled();
        expect(cleanupRequestProviderEventId).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// handleSubscriptionPreapprovalEvent — SPEC-126 D3
// ===========================================================================

describe('handleSubscriptionPreapprovalEvent (SPEC-126 D3)', () => {
    it('is exported as the same function as the legacy handleSubscriptionUpdated alias', () => {
        // The router registers both subscription_preapproval.created and
        // subscription_preapproval.updated to this single handler. The
        // backwards-compat alias must point at the exact same function so
        // existing imports continue to work.
        expect(handleSubscriptionPreapprovalEvent).toBe(handleSubscriptionUpdated);
    });

    it('handles subscription_preapproval.created events (initial activation)', async () => {
        // Arrange — simulate the event MP fires the first time a user
        // authorizes the recurring charge. MP status='authorized' arrives in
        // the payload; processSubscriptionUpdated will fetch the full
        // preapproval, map authorized -> active, and flip the local sub from
        // incomplete/pending_provider -> active.
        const createdEvent = makeSubscriptionEvent({
            id: 'mp-event-created-1',
            type: 'subscription_preapproval.created',
            data: { id: 'preapproval-new-1', status: 'authorized' }
        });
        const deps = makeWebhookDeps();

        vi.mocked(getWebhookDependencies).mockReturnValue(
            deps as unknown as ReturnType<typeof getWebhookDependencies>
        );
        vi.mocked(processSubscriptionUpdated).mockResolvedValue({
            success: true,
            statusChanged: true,
            newStatus: 'active'
        });
        vi.mocked(markEventProcessedByProviderId).mockResolvedValue(undefined);

        // Act
        await handleSubscriptionPreapprovalEvent(makeMockContext() as never, createdEvent);

        // Assert — the same dispatch path that handles .updated events
        // is invoked for .created events too. processSubscriptionUpdated
        // receives the event with type='subscription_preapproval.created'
        // and source='webhook'.
        expect(processSubscriptionUpdated).toHaveBeenCalledOnce();
        const callArg = vi.mocked(processSubscriptionUpdated).mock.calls[0]?.[0];
        expect(callArg?.event.type).toBe('subscription_preapproval.created');
        expect(callArg?.source).toBe('webhook');
        expect(callArg?.providerEventId).toBe('mp-event-created-1');
        expect(markEventProcessedByProviderId).toHaveBeenCalledWith({
            providerEventId: 'mp-event-created-1'
        });
    });

    it('still handles subscription_preapproval.updated events (status sync)', async () => {
        // Defense-in-depth: the rename to handleSubscriptionPreapprovalEvent
        // must not regress the existing .updated dispatch.
        const updatedEvent = makeSubscriptionEvent({
            id: 'mp-event-updated-1',
            type: 'subscription_preapproval.updated',
            data: { id: 'preapproval-existing-1', status: 'paused' }
        });
        const deps = makeWebhookDeps();

        vi.mocked(getWebhookDependencies).mockReturnValue(
            deps as unknown as ReturnType<typeof getWebhookDependencies>
        );
        vi.mocked(processSubscriptionUpdated).mockResolvedValue({
            success: true,
            statusChanged: true,
            newStatus: 'paused'
        });
        vi.mocked(markEventProcessedByProviderId).mockResolvedValue(undefined);

        await handleSubscriptionPreapprovalEvent(makeMockContext() as never, updatedEvent);

        expect(processSubscriptionUpdated).toHaveBeenCalledOnce();
        const callArg = vi.mocked(processSubscriptionUpdated).mock.calls[0]?.[0];
        expect(callArg?.event.type).toBe('subscription_preapproval.updated');
    });
});
