/**
 * Notification Log Test Fixtures
 *
 * Mock data for billing notification log-related tests.
 * Field shapes match the NotificationLog interface in
 * apps/admin/src/features/billing-notification-logs/hooks.ts
 */

import { mockPaginatedResponse } from '../mocks/handlers';

/** Single notification log fixture with all fields populated */
export const mockNotificationLog = {
    id: 'ntf-test-001',
    type: 'payment_success' as const,
    recipient: 'owner@example.com',
    subject: 'Payment received for your subscription',
    status: 'sent' as const,
    channel: 'email' as const,
    sentAt: '2026-01-15T10:30:00.000Z',
    metadata: { paymentId: 'pay-123', amount: 5000 },
    errorMessage: undefined,
    userId: 'user-owner-001',
    userName: 'Juan Perez'
} as const;

/** Failed notification log entry */
export const mockNotificationLogFailed = {
    id: 'ntf-test-002',
    type: 'payment_failed' as const,
    recipient: 'host@example.com',
    subject: 'Payment failed for your subscription',
    status: 'failed' as const,
    channel: 'email' as const,
    sentAt: '2026-01-16T14:00:00.000Z',
    metadata: { paymentId: 'pay-456', reason: 'insufficient_funds' },
    errorMessage: 'SMTP connection timeout after 30s',
    userId: 'user-host-002',
    userName: 'Maria Garcia'
} as const;

/** Pending notification log entry */
export const mockNotificationLogPending = {
    id: 'ntf-test-003',
    type: 'trial_ending' as const,
    recipient: 'trial@example.com',
    subject: 'Your trial is ending in 3 days',
    status: 'pending' as const,
    channel: 'email' as const,
    sentAt: '2026-01-17T08:15:00.000Z',
    metadata: { trialEndDate: '2026-01-20T00:00:00.000Z' },
    errorMessage: undefined,
    userId: 'user-trial-003',
    userName: 'Carlos Lopez'
} as const;

/** Notification without user association */
export const mockNotificationLogNoUser = {
    id: 'ntf-test-004',
    type: 'payment_reminder' as const,
    recipient: 'unknown@example.com',
    subject: 'Payment reminder for your subscription',
    status: 'sent' as const,
    channel: 'email' as const,
    sentAt: '2026-01-18T12:00:00.000Z',
    metadata: {},
    errorMessage: undefined,
    userId: undefined,
    userName: undefined
} as const;

/** List of notification logs for table/list tests */
export const mockNotificationLogList = [
    mockNotificationLog,
    mockNotificationLogFailed,
    mockNotificationLogPending,
    mockNotificationLogNoUser
];

/** Paginated notification logs response */
export const mockNotificationLogPage = mockPaginatedResponse(mockNotificationLogList);

/** Empty paginated notification logs response */
export const mockNotificationLogEmptyPage = mockPaginatedResponse([]);
