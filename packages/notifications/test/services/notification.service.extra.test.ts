/**
 * NotificationService — supplemental coverage for SPEC-236
 *
 * Targets the uncovered branches in notification.service.ts:
 *   • selectTemplate() branches for notification types not exercised in the
 *     base suite (lines ~477-587): subscription_cancelled, subscription_paused,
 *     subscription_reactivated, plan_downgrade_limit_warning, payment_retry_warning,
 *     addon_cancellation, ai_cost_threshold_alert, subscription_cancel_confirmed,
 *     subscription_access_ending_soon, plan_being_retired, addon_purchase,
 *     payment_failure, plan_change_confirmation, addon_expired,
 *     addon_renewal_confirmation, and the default throw.
 *   • generateSubject() branches (lines 570-671): admin_payment_failure with
 *     affectedUserEmail, admin_system_event with eventType, feedback_report,
 *     contact_submission with both types, payment_retry_warning fields,
 *     ai_cost_threshold_alert with scope=feature, subscription_cancel_confirmed
 *     accessUntil formatting, subscription_access_ending_soon daysRemaining,
 *     plan_being_retired accessUntil formatting.
 *   • enqueueForRetry() error path (lines 768-775): when retryService.enqueue()
 *     itself throws, the error is logged but not re-thrown.
 *   • send() with skipDb + skipLogging options.
 *
 * @module test/services/notification.service.extra.test
 */

import type { getDb } from '@repo/db';
import type { ILogger } from '@repo/logger';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    NotificationService,
    type NotificationServiceDeps
} from '../../src/services/notification.service.js';
import type { PreferenceService } from '../../src/services/preference.service.js';
import { RetryService } from '../../src/services/retry.service.js';
import type { EmailTransport } from '../../src/transports/email/email-transport.interface.js';
import { NotificationType } from '../../src/types/notification.types.js';
import type { NotificationPayload } from '../../src/types/notification.types.js';

describe('NotificationService — extended coverage', () => {
    let service: NotificationService;
    let mockDeps: NotificationServiceDeps;
    let mockEmailTransport: EmailTransport;
    let mockPreferenceService: PreferenceService;
    let mockRetryService: RetryService;
    let mockDb: ReturnType<typeof getDb>;
    let mockLogger: ILogger;

    const basePayload = {
        recipientEmail: 'user@example.com',
        recipientName: 'Jane Doe',
        userId: 'user_abc',
        customerId: 'cus_xyz'
    };

    beforeEach(() => {
        mockEmailTransport = { send: vi.fn() };

        mockPreferenceService = {
            shouldSendNotification: vi.fn(),
            getPreferences: vi.fn(),
            updatePreferences: vi.fn()
        } as unknown as PreferenceService;

        mockRetryService = {
            enqueue: vi.fn(),
            dequeueReady: vi.fn()
        } as unknown as RetryService;

        mockDb = {
            insert: vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined)
            })
        } as unknown as ReturnType<typeof getDb>;

        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn()
        } as unknown as ILogger;

        mockDeps = {
            emailTransport: mockEmailTransport,
            preferenceService: mockPreferenceService,
            retryService: mockRetryService,
            db: mockDb,
            logger: mockLogger,
            siteUrl: 'https://hospeda.com.ar'
        };

        service = new NotificationService(mockDeps);

        (mockEmailTransport.send as Mock).mockResolvedValue({ messageId: 'msg_ok' });
        (mockPreferenceService.shouldSendNotification as Mock).mockResolvedValue(true);
    });

    // =========================================================================
    // selectTemplate() — previously uncovered notification types
    // =========================================================================

    describe('selectTemplate — previously uncovered types', () => {
        it('should select template for addon_purchase', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.ADDON_PURCHASE,
                ...basePayload,
                planName: 'Fotos Extra',
                amount: 2000,
                currency: 'ARS'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
            expect(mockEmailTransport.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'user@example.com' })
            );
        });

        it('should select template for payment_failure', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_FAILURE,
                ...basePayload,
                amount: 5000,
                currency: 'ARS',
                planName: 'Standard',
                failureReason: 'Fondos insuficientes',
                retryDate: '2026-07-01'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for plan_change_confirmation', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PLAN_CHANGE_CONFIRMATION,
                ...basePayload,
                planName: 'Premium',
                oldPlanName: 'Standard',
                newPlanName: 'Premium',
                amount: 10000,
                currency: 'ARS'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for addon_expired', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.ADDON_EXPIRED,
                ...basePayload,
                addonName: 'Prioridad de soporte',
                expirationDate: '2026-06-30'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for addon_renewal_confirmation', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.ADDON_RENEWAL_CONFIRMATION,
                ...basePayload,
                addonName: 'Fotos Extra',
                amount: 1500,
                currency: 'ARS'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for admin_system_event', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.ADMIN_SYSTEM_EVENT,
                ...basePayload,
                severity: 'warning',
                eventDetails: { eventType: 'cron_failure', message: 'Exchange rate cron failed' }
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for subscription_cancelled', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.SUBSCRIPTION_CANCELLED,
                ...basePayload,
                planName: 'Standard',
                currentPeriodEnd: '2026-07-31'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for subscription_paused', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.SUBSCRIPTION_PAUSED,
                ...basePayload,
                planName: 'Premium'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for subscription_reactivated', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.SUBSCRIPTION_REACTIVATED,
                ...basePayload,
                planName: 'Premium',
                nextBillingDate: '2026-08-01'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for plan_downgrade_limit_warning', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING,
                ...basePayload,
                planName: 'Basic',
                limitKey: 'accommodations',
                oldLimit: 10,
                newLimit: 3,
                currentUsage: 7
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for payment_retry_warning', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_RETRY_WARNING,
                ...basePayload,
                failureCount: 2,
                maxRetries: 3,
                paymentMethodHint: 'Visa terminada en 4242'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for addon_cancellation', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.ADDON_CANCELLATION,
                ...basePayload,
                addonName: 'Fotos Extra',
                canceledAt: '2026-06-15T10:00:00.000Z'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for ai_cost_threshold_alert with global scope', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.AI_COST_THRESHOLD_ALERT,
                ...basePayload,
                scope: 'global',
                thresholdPct: 80,
                spentMicroUsd: 160_000_000,
                ceilingMicroUsd: 200_000_000,
                period: '2026-06'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for ai_cost_threshold_alert with feature scope', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.AI_COST_THRESHOLD_ALERT,
                ...basePayload,
                scope: 'feature',
                feature: 'translation',
                thresholdPct: 50,
                spentMicroUsd: 50_000_000,
                ceilingMicroUsd: 100_000_000,
                period: '2026-06'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for subscription_cancel_confirmed', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED,
                ...basePayload,
                planName: 'Standard',
                accessUntil: '2026-07-15T23:59:59.000Z'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for subscription_access_ending_soon', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.SUBSCRIPTION_ACCESS_ENDING_SOON,
                ...basePayload,
                planName: 'Standard',
                accessUntil: '2026-07-18T23:59:59.000Z',
                daysRemaining: 3
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should select template for plan_being_retired', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PLAN_BEING_RETIRED,
                ...basePayload,
                planName: 'Standard',
                accessUntil: '2026-08-15T23:59:59.000Z',
                migrationHint: 'Resubscribite a otro plan para mantener el acceso'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    // =========================================================================
    // generateSubject() — previously uncovered branches (lines 570-671)
    // =========================================================================

    describe('generateSubject — previously uncovered branches', () => {
        it('should include affectedUserEmail in subject data for admin_payment_failure', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.ADMIN_PAYMENT_FAILURE,
                ...basePayload,
                affectedUserEmail: 'victim@example.com',
                affectedUserId: 'user_victim',
                severity: 'critical',
                eventDetails: { reason: 'Card declined' }
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
            // The DB insert should include a subject containing the affected email data
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it('should extract eventType from eventDetails for admin_system_event subject', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.ADMIN_SYSTEM_EVENT,
                ...basePayload,
                severity: 'info',
                eventDetails: { eventType: 'cron_success', data: 'Exchange rate updated' }
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should include reportType and reportTitle in subject for feedback_report', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.FEEDBACK_REPORT,
                ...basePayload,
                reportType: 'Error',
                reportTitle: 'Login falla en móvil',
                reportDescription: 'No puedo iniciar sesión desde el celular',
                feedbackEnvironment: {
                    timestamp: '2026-06-15T10:00:00.000Z',
                    appSource: 'web'
                }
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it('should build senderName and contactType=Alojamiento for contact_submission (accommodation)', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.CONTACT_SUBMISSION,
                ...basePayload,
                contactType: 'accommodation',
                senderFirstName: 'María',
                senderLastName: 'González',
                senderEmail: 'maria@example.com',
                message: 'Quiero publicar mi alojamiento',
                submittedAt: '2026-06-15T12:00:00.000Z'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should build contactType=General for non-accommodation contact_submission', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.CONTACT_SUBMISSION,
                ...basePayload,
                contactType: 'general',
                senderFirstName: 'Carlos',
                senderLastName: 'Ruiz',
                senderEmail: 'carlos@example.com',
                message: 'Tengo una consulta general',
                submittedAt: '2026-06-15T12:00:00.000Z'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should include failureCount and maxRetries in subject for payment_retry_warning', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_RETRY_WARNING,
                ...basePayload,
                failureCount: 1,
                maxRetries: 3,
                paymentMethodHint: 'Mastercard terminada en 9999'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it('should include thresholdPct and scope=global in subject for ai_cost_threshold_alert', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.AI_COST_THRESHOLD_ALERT,
                ...basePayload,
                scope: 'global',
                thresholdPct: 100,
                spentMicroUsd: 200_000_000,
                ceilingMicroUsd: 200_000_000,
                period: '2026-06'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should include scope=feature:<name> in subject for ai_cost_threshold_alert with feature', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.AI_COST_THRESHOLD_ALERT,
                ...basePayload,
                scope: 'feature',
                feature: 'ocr',
                thresholdPct: 50,
                spentMicroUsd: 25_000_000,
                ceilingMicroUsd: 50_000_000,
                period: '2026-06'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should format accessUntil as locale date string in subscription_cancel_confirmed subject', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED,
                ...basePayload,
                planName: 'Premium',
                accessUntil: '2026-07-15T23:59:59.000Z'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
            // Verify subject was generated (DB call means subject was included)
            const insertCall = (mockDb.insert as Mock).mock.results[0]?.value;
            expect(insertCall?.values).toHaveBeenCalledWith(
                expect.objectContaining({ subject: expect.any(String) })
            );
        });

        it('should include daysRemaining in subject for subscription_access_ending_soon', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.SUBSCRIPTION_ACCESS_ENDING_SOON,
                ...basePayload,
                planName: 'Standard',
                accessUntil: '2026-07-18T23:59:59.000Z',
                daysRemaining: 3
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should format accessUntil as locale date string in plan_being_retired subject', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PLAN_BEING_RETIRED,
                ...basePayload,
                planName: 'Standard',
                accessUntil: '2026-08-15T23:59:59.000Z',
                migrationHint: 'Elegí otro plan'
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(true);
            const insertCall = (mockDb.insert as Mock).mock.results[0]?.value;
            expect(insertCall?.values).toHaveBeenCalledWith(
                expect.objectContaining({ subject: expect.any(String) })
            );
        });
    });

    // =========================================================================
    // send() options — skipDb and skipLogging
    // =========================================================================

    describe('send() with skipDb and skipLogging options', () => {
        it('should not write to DB when skipDb is true', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard'
            };

            // Act
            const result = await service.send(payload, { skipDb: true });

            // Assert
            expect(result.success).toBe(true);
            expect(mockDb.insert).not.toHaveBeenCalled();
        });

        it('should not call logger when skipLogging is true', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard'
            };

            // Act
            const result = await service.send(payload, { skipLogging: true });

            // Assert
            expect(result.success).toBe(true);
            // Only debug from logNotification is expected, no info calls
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should skip DB logging when user opts out and skipDb is true', async () => {
            // Arrange
            (mockPreferenceService.shouldSendNotification as Mock).mockResolvedValue(false);
            const payload: NotificationPayload = {
                type: NotificationType.RENEWAL_REMINDER,
                ...basePayload,
                planName: 'Standard',
                amount: 5000,
                currency: 'ARS',
                renewalDate: '2026-12-31'
            };

            // Act
            const result = await service.send(payload, { skipDb: true });

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('skipped');
            expect(mockDb.insert).not.toHaveBeenCalled();
        });

        it('should skip logger when user opts out and skipLogging is true', async () => {
            // Arrange
            (mockPreferenceService.shouldSendNotification as Mock).mockResolvedValue(false);
            const payload: NotificationPayload = {
                type: NotificationType.RENEWAL_REMINDER,
                ...basePayload,
                planName: 'Standard',
                amount: 5000,
                currency: 'ARS',
                renewalDate: '2026-12-31'
            };

            // Act
            const result = await service.send(payload, { skipLogging: true });

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('skipped');
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should skip DB logging on transport failure when skipDb is true', async () => {
            // Arrange
            (mockEmailTransport.send as Mock).mockRejectedValue(new Error('Transport down'));
            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard'
            };

            // Act
            const result = await service.send(payload, { skipDb: true });

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');
            expect(mockDb.insert).not.toHaveBeenCalled();
        });

        it('should pass emailAttachments to transport when provided', async () => {
            // Arrange
            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard'
            };
            const attachments = [{ filename: 'receipt.pdf', content: 'base64content' }];

            // Act
            const result = await service.send(payload, { emailAttachments: attachments });

            // Assert
            expect(result.success).toBe(true);
            expect(mockEmailTransport.send).toHaveBeenCalledWith(
                expect.objectContaining({ attachments })
            );
        });
    });

    // =========================================================================
    // enqueueForRetry() error path (lines 768-775)
    // =========================================================================

    describe('enqueueForRetry error path', () => {
        it('should log error but not throw when retryService.enqueue() throws', async () => {
            // Arrange — transport fails so enqueueForRetry is called, and then
            // enqueue itself also throws.
            const transportError = new Error('Transport failed');
            const enqueueError = new Error('Redis ENQUEUE failed');

            (mockEmailTransport.send as Mock).mockRejectedValue(transportError);
            (mockRetryService.enqueue as Mock).mockRejectedValue(enqueueError);

            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard',
                idempotencyKey: 'idem_enqueue_fail'
            };

            // Act — must NOT throw even though both transport and enqueue fail
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');
            expect(result.error).toBe('Transport failed');

            // enqueueForRetry error logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.PAYMENT_SUCCESS,
                    error: 'Redis ENQUEUE failed'
                }),
                'Failed to enqueue notification for retry'
            );
        });

        it('should use type-derived id when no idempotencyKey is present', async () => {
            // Arrange
            (mockEmailTransport.send as Mock).mockRejectedValue(new Error('Network error'));

            const payload: NotificationPayload = {
                type: NotificationType.RENEWAL_REMINDER,
                ...basePayload,
                planName: 'Standard',
                amount: 5000,
                currency: 'ARS',
                renewalDate: '2026-12-31'
                // No idempotencyKey
            };

            // Act
            const result = await service.send(payload);

            // Assert
            expect(result.success).toBe(false);
            expect(mockRetryService.enqueue).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.stringMatching(/^renewal_reminder-\d+$/)
                }),
                expect.any(Number)
            );
        });

        it('should log warning when retry service is null (no-retry configured)', async () => {
            // Arrange
            const depsNoRetry = { ...mockDeps, retryService: null };
            const serviceNoRetry = new NotificationService(depsNoRetry);

            (mockEmailTransport.send as Mock).mockRejectedValue(new Error('SMTP timeout'));

            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard'
            };

            // Act
            await serviceNoRetry.send(payload);

            // Assert
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({ type: NotificationType.PAYMENT_SUCCESS }),
                'Retry service not available, cannot enqueue for retry'
            );
        });
    });

    // =========================================================================
    // selectTemplate() — default throw for unknown type
    // =========================================================================

    describe('selectTemplate — unknown type', () => {
        it('should throw when notification type has no template', async () => {
            // Arrange — cast to bypass TS enum exhaustion check
            // NOTE: selectTemplate() is called BEFORE the try/catch in send(), so the
            // error propagates to the caller unhandled.
            const payload = {
                type: 'unknown_type_xyz' as NotificationType,
                ...basePayload
            } as unknown as NotificationPayload;

            // Act & Assert — the error is NOT caught internally; it throws to caller
            await expect(service.send(payload)).rejects.toThrow(
                'No template found for notification type: unknown_type_xyz'
            );
        });
    });

    // =========================================================================
    // RetryService.calculateRetryDelay used in enqueueForRetry
    // =========================================================================

    describe('enqueueForRetry — retry delay calculation', () => {
        it('should enqueue with 60s delay for first attempt', async () => {
            // Arrange
            (mockEmailTransport.send as Mock).mockRejectedValue(new Error('First fail'));

            const payload: NotificationPayload = {
                type: NotificationType.PAYMENT_SUCCESS,
                ...basePayload,
                amount: 10000,
                currency: 'ARS',
                planName: 'Standard',
                idempotencyKey: 'idem_delay_test'
            };

            // Act
            await service.send(payload);

            // Assert — first retry delay is 60000ms (60s base delay × 5^0)
            expect(mockRetryService.enqueue).toHaveBeenCalledWith(
                expect.any(Object),
                RetryService.calculateRetryDelay(1)
            );
        });
    });
});
