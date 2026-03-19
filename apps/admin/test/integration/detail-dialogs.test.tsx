/**
 * Detail Dialogs Integration Tests
 *
 * Tests for read-only detail dialogs: WebhookEventDetailDialog
 * and NotificationDetailDialog. These dialogs display data
 * without form submission.
 *
 * @module test/integration/detail-dialogs
 */

import type { NotificationLog } from '@/features/billing-notification-logs';
import { NotificationDetailDialog } from '@/features/billing-notification-logs/components/NotificationDetailDialog';
import type { WebhookEvent } from '@/features/billing-webhook-events';
import { WebhookEventDetailDialog } from '@/features/billing-webhook-events/components/WebhookEventDetailDialog';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    mockNotificationLog,
    mockNotificationLogFailed,
    mockNotificationLogNoUser
} from '../fixtures/notification-log.fixture';
import { mockWebhookEvent, mockWebhookEventFailed } from '../fixtures/webhook-event.fixture';
import { renderWithProviders } from '../helpers/render-with-providers';

// ---------------------------------------------------------------------------
// WebhookEventDetailDialog
// ---------------------------------------------------------------------------

describe('WebhookEventDetailDialog', () => {
    const defaultProps = {
        open: true,
        onOpenChange: vi.fn()
    };

    describe('renders event data correctly', () => {
        it('displays event ID in the dialog description', () => {
            const event = { ...mockWebhookEvent } as unknown as WebhookEvent;

            renderWithProviders(
                <WebhookEventDetailDialog
                    {...defaultProps}
                    event={event}
                />
            );

            expect(screen.getByText(`ID: ${event.id}`)).toBeInTheDocument();
        });

        it('displays provider name', () => {
            const event = { ...mockWebhookEvent } as unknown as WebhookEvent;

            renderWithProviders(
                <WebhookEventDetailDialog
                    {...defaultProps}
                    event={event}
                />
            );

            expect(screen.getByText(event.provider)).toBeInTheDocument();
        });

        it('displays provider event ID', () => {
            const event = { ...mockWebhookEvent } as unknown as WebhookEvent;

            renderWithProviders(
                <WebhookEventDetailDialog
                    {...defaultProps}
                    event={event}
                />
            );

            expect(screen.getByText(event.providerEventId)).toBeInTheDocument();
        });

        it('displays status badge with translated label', () => {
            const event = { ...mockWebhookEvent } as unknown as WebhookEvent;

            renderWithProviders(
                <WebhookEventDetailDialog
                    {...defaultProps}
                    event={event}
                />
            );

            expect(
                screen.getByText(`admin-billing.webhookEvents.statuses.${event.status}`)
            ).toBeInTheDocument();
        });

        it('displays type label with translated value', () => {
            const event = { ...mockWebhookEvent } as unknown as WebhookEvent;

            renderWithProviders(
                <WebhookEventDetailDialog
                    {...defaultProps}
                    event={event}
                />
            );

            // Translation mock returns the key as-is
            expect(
                screen.getByText('admin-billing.webhookEvents.types.paymentCreated')
            ).toBeInTheDocument();
        });

        it('displays payload as formatted JSON', () => {
            const event = { ...mockWebhookEvent } as unknown as WebhookEvent;

            renderWithProviders(
                <WebhookEventDetailDialog
                    {...defaultProps}
                    event={event}
                />
            );

            const formattedPayload = JSON.stringify(event.payload, null, 2);
            expect(
                screen.getByText(
                    (_content, element) =>
                        element?.tagName === 'PRE' &&
                        element.textContent?.includes(formattedPayload) === true
                )
            ).toBeInTheDocument();
        });

        it('displays error message for failed events', () => {
            const event = { ...mockWebhookEventFailed } as unknown as WebhookEvent;

            renderWithProviders(
                <WebhookEventDetailDialog
                    {...defaultProps}
                    event={event}
                />
            );

            expect(screen.getByText(mockWebhookEventFailed.errorMessage)).toBeInTheDocument();
        });

        it('displays retry count for events with retries', () => {
            const event = { ...mockWebhookEventFailed } as unknown as WebhookEvent;

            renderWithProviders(
                <WebhookEventDetailDialog
                    {...defaultProps}
                    event={event}
                />
            );

            expect(screen.getByText(String(mockWebhookEventFailed.retryCount))).toBeInTheDocument();
        });

        it('calls onOpenChange(false) when close button is clicked', async () => {
            const user = userEvent.setup();
            const onOpenChange = vi.fn();
            const event = { ...mockWebhookEvent } as unknown as WebhookEvent;

            renderWithProviders(
                <WebhookEventDetailDialog
                    event={event}
                    open={true}
                    onOpenChange={onOpenChange}
                />
            );

            const closeButton = screen.getByText('admin-billing.common.close');
            await user.click(closeButton);

            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('null event handling', () => {
        it('renders nothing when event is null', () => {
            const { container } = renderWithProviders(
                <WebhookEventDetailDialog
                    {...defaultProps}
                    event={null}
                />
            );

            expect(
                screen.queryByText('admin-billing.webhookEvents.dialog.title')
            ).not.toBeInTheDocument();
            expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
        });
    });
});

// ---------------------------------------------------------------------------
// NotificationDetailDialog
// ---------------------------------------------------------------------------

describe('NotificationDetailDialog', () => {
    const defaultProps = {
        open: true,
        onOpenChange: vi.fn()
    };

    describe('renders notification data correctly', () => {
        it('displays notification ID in the dialog description', () => {
            const notification = { ...mockNotificationLog } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={notification}
                />
            );

            expect(screen.getByText(`ID: ${notification.id}`)).toBeInTheDocument();
        });

        it('displays recipient email', () => {
            const notification = { ...mockNotificationLog } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={notification}
                />
            );

            expect(screen.getByText(notification.recipient)).toBeInTheDocument();
        });

        it('displays subject line', () => {
            const notification = { ...mockNotificationLog } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={notification}
                />
            );

            expect(screen.getByText(notification.subject)).toBeInTheDocument();
        });

        it('displays status badge with translated label', () => {
            const notification = { ...mockNotificationLog } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={notification}
                />
            );

            expect(
                screen.getByText(`admin-billing.notificationLogs.statuses.${notification.status}`)
            ).toBeInTheDocument();
        });

        it('displays type with translated label', () => {
            const notification = { ...mockNotificationLog } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={notification}
                />
            );

            expect(
                screen.getByText('admin-billing.notificationLogs.types.paymentSuccess')
            ).toBeInTheDocument();
        });

        it('displays channel with translated label', () => {
            const notification = { ...mockNotificationLog } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={notification}
                />
            );

            expect(
                screen.getByText(`admin-billing.notificationLogs.channels.${notification.channel}`)
            ).toBeInTheDocument();
        });

        it('displays user name when present', () => {
            const notification = { ...mockNotificationLog } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={notification}
                />
            );

            expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        });

        it('does not display user name section when userName is undefined', () => {
            const notification = {
                ...mockNotificationLogNoUser
            } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={notification}
                />
            );

            // The user label should not appear when there is no userName
            expect(
                screen.queryByText('admin-billing.notificationLogs.dialog.userLabel')
            ).not.toBeInTheDocument();
        });

        it('displays error message for failed notifications', () => {
            const notification = {
                ...mockNotificationLogFailed
            } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={notification}
                />
            );

            expect(screen.getByText(mockNotificationLogFailed.errorMessage)).toBeInTheDocument();
        });

        it('displays metadata as formatted JSON when present', () => {
            const notification = { ...mockNotificationLog } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={notification}
                />
            );

            const formattedMetadata = JSON.stringify(notification.metadata, null, 2);
            expect(
                screen.getByText(
                    (_content, element) =>
                        element?.tagName === 'PRE' &&
                        element.textContent?.includes(formattedMetadata) === true
                )
            ).toBeInTheDocument();
        });

        it('calls onOpenChange(false) when close button is clicked', async () => {
            const user = userEvent.setup();
            const onOpenChange = vi.fn();
            const notification = { ...mockNotificationLog } as unknown as NotificationLog;

            renderWithProviders(
                <NotificationDetailDialog
                    notification={notification}
                    open={true}
                    onOpenChange={onOpenChange}
                />
            );

            const closeButton = screen.getByText('admin-billing.common.close');
            await user.click(closeButton);

            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('null notification handling', () => {
        it('renders nothing when notification is null', () => {
            const { container } = renderWithProviders(
                <NotificationDetailDialog
                    {...defaultProps}
                    notification={null}
                />
            );

            expect(
                screen.queryByText('admin-billing.notificationLogs.dialog.title')
            ).not.toBeInTheDocument();
            expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
        });
    });
});
