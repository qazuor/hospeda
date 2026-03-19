/**
 * Webhook Event Test Fixtures
 *
 * Mock data for webhook event-related tests.
 * Field shapes match the WebhookEvent interface in
 * apps/admin/src/features/billing-webhook-events/hooks.ts
 */

import { mockPaginatedResponse } from '../mocks/handlers';

/** Single webhook event fixture with all fields populated */
export const mockWebhookEvent = {
    id: 'whe-test-001',
    provider: 'mercadopago',
    type: 'payment.created' as const,
    status: 'processed' as const,
    providerEventId: 'mp-evt-abc123def456',
    receivedAt: '2026-01-15T10:30:00.000Z',
    processedAt: '2026-01-15T10:30:05.000Z',
    payload: { id: 12345, type: 'payment', action: 'payment.created' },
    errorMessage: undefined,
    retryCount: 0
} as const;

/** Webhook event in failed state with error details */
export const mockWebhookEventFailed = {
    id: 'whe-test-002',
    provider: 'mercadopago',
    type: 'subscription.updated' as const,
    status: 'failed' as const,
    providerEventId: 'mp-evt-xyz789ghi012',
    receivedAt: '2026-01-16T14:00:00.000Z',
    processedAt: undefined,
    payload: { id: 67890, type: 'subscription_preapproval', action: 'updated' },
    errorMessage: 'Failed to process subscription update: customer not found',
    retryCount: 3
} as const;

/** Webhook event in pending state */
export const mockWebhookEventPending = {
    id: 'whe-test-003',
    provider: 'mercadopago',
    type: 'invoice.created' as const,
    status: 'pending' as const,
    providerEventId: 'mp-evt-pnd456rst789',
    receivedAt: '2026-01-17T08:15:00.000Z',
    processedAt: undefined,
    payload: { id: 11223, type: 'payment', action: 'invoice.created' },
    errorMessage: undefined,
    retryCount: 0
} as const;

/** List of webhook events for table/list tests */
export const mockWebhookEventList = [
    mockWebhookEvent,
    mockWebhookEventFailed,
    mockWebhookEventPending
];

/** Paginated webhook events response */
export const mockWebhookEventPage = mockPaginatedResponse(mockWebhookEventList);

/** Empty paginated webhook events response */
export const mockWebhookEventEmptyPage = mockPaginatedResponse([]);
