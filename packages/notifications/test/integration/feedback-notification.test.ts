/**
 * Feedback Notification Integration Tests
 *
 * Comprehensive integration tests covering the full flow introduced by:
 * - T-007/T-008: `attachments` field on `SendEmailInput` passed through `ResendEmailTransport`
 * - T-009: `skipDb` and `skipLogging` options on `NotificationService.send()`
 * - T-010: `FEEDBACK_REPORT` notification type with `FeedbackReportPayload`
 * - T-011: `FeedbackReportEmail` template
 *
 * Tests verify:
 * 1. FEEDBACK_REPORT template renders correctly (all fields / minimal fields / optional sections)
 * 2. Attachments pass-through in ResendEmailTransport.send()
 * 3. skipDb option prevents db.insert() calls
 * 4. skipLogging option prevents logger.info() calls
 * 5. Combined: FEEDBACK_REPORT + skipDb + skipLogging full flow
 *
 * @module test/integration/feedback-notification.test
 */

import type { getDb } from '@repo/db';
import type { ILogger } from '@repo/logger';
import type { ReactElement } from 'react';
import type { Resend } from 'resend';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    NotificationService,
    type NotificationServiceDeps
} from '../../src/services/notification.service';
import type { PreferenceService } from '../../src/services/preference.service';
import type { RetryService } from '../../src/services/retry.service';
import {
    FeedbackReportEmail,
    type FeedbackReportEmailProps
} from '../../src/templates/feedback/FeedbackReportEmail';
import type { SendEmailInput } from '../../src/transports/email/email-transport.interface';
import { ResendEmailTransport } from '../../src/transports/email/resend-transport';
import { type FeedbackReportPayload, NotificationType } from '../../src/types/notification.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock Resend client with a controllable emails.send method.
 */
function createMockResend(): { client: Resend; sendMock: Mock } {
    const sendMock = vi.fn();
    const client = { emails: { send: sendMock } } as unknown as Resend;
    return { client, sendMock };
}

/**
 * Returns a minimal but valid FeedbackReportEmailProps object.
 */
function buildMinimalFeedbackEmailProps(
    overrides?: Partial<FeedbackReportEmailProps>
): FeedbackReportEmailProps {
    return {
        reportType: 'Sugerencia',
        title: 'Mejorar el filtrado de alojamientos',
        description: 'Sería útil poder filtrar por precio mínimo.',
        reporterName: 'María García',
        reporterEmail: 'maria@example.com',
        environment: {
            timestamp: '2026-03-06T10:00:00.000Z',
            appSource: 'web'
        },
        ...overrides
    };
}

/**
 * Returns a complete FeedbackReportPayload for service-level tests.
 */
function buildFeedbackPayload(overrides?: Partial<FeedbackReportPayload>): FeedbackReportPayload {
    return {
        type: NotificationType.FEEDBACK_REPORT,
        recipientEmail: 'admin@hospeda.com.ar',
        recipientName: 'Admin',
        userId: null,
        customerId: undefined,
        reportType: 'Error de JavaScript',
        reportTitle: 'Crash al cargar la página de alojamientos',
        reportDescription: 'La página lanza una excepción al renderizar la lista.',
        feedbackEnvironment: {
            timestamp: '2026-03-06T14:30:00.000Z',
            appSource: 'web'
        },
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Feedback Notification Integration Tests', () => {
    // -----------------------------------------------------------------------
    // 1. FeedbackReportEmail template rendering
    // -----------------------------------------------------------------------

    describe('FeedbackReportEmail template', () => {
        it('should render with all optional fields provided', () => {
            // Arrange
            const props: FeedbackReportEmailProps = buildMinimalFeedbackEmailProps({
                reportType: 'Error de JavaScript',
                title: 'Crash en alojamientos',
                description: 'La página explota.',
                severity: 'Alta',
                stepsToReproduce: '1. Abrir /alojamientos\n2. Observar el error',
                expectedResult: 'Lista de alojamientos visible',
                actualResult: 'Pantalla en blanco con error en consola',
                attachmentUrls: ['https://linear.app/attachment/1.png'],
                environment: {
                    timestamp: '2026-03-06T14:30:00.000Z',
                    appSource: 'web',
                    currentUrl: 'https://hospeda.com.ar/es/alojamientos',
                    browser: 'Chrome 123',
                    os: 'Windows 11',
                    viewport: '1440x900',
                    deployVersion: '1.4.2',
                    userId: 'user_abc',
                    consoleErrors: ['TypeError: Cannot read property "map" of undefined'],
                    errorInfo: {
                        message: 'Cannot read property "map" of undefined',
                        stack: 'TypeError: ...\n  at Component.render'
                    }
                }
            });

            // Act
            const element = FeedbackReportEmail(props);

            // Assert - template returns a React element (not null/undefined)
            expect(element).toBeDefined();
            expect(element).not.toBeNull();
        });

        it('should render with only required fields (minimal payload)', () => {
            // Arrange
            const props = buildMinimalFeedbackEmailProps();

            // Act
            const element = FeedbackReportEmail(props);

            // Assert
            expect(element).toBeDefined();
            expect(element).not.toBeNull();
        });

        it('should render without throwing when severity is provided', () => {
            // Arrange
            const props = buildMinimalFeedbackEmailProps({ severity: 'Media' });

            // Act & Assert
            expect(() => FeedbackReportEmail(props)).not.toThrow();
        });

        it('should render without throwing when console errors are provided', () => {
            // Arrange
            const props = buildMinimalFeedbackEmailProps({
                environment: {
                    timestamp: '2026-03-06T10:00:00.000Z',
                    appSource: 'web',
                    consoleErrors: [
                        'TypeError: null is not an object',
                        'ReferenceError: foo is not defined'
                    ]
                }
            });

            // Act & Assert
            expect(() => FeedbackReportEmail(props)).not.toThrow();
        });

        it('should render without throwing when errorInfo is provided', () => {
            // Arrange
            const props = buildMinimalFeedbackEmailProps({
                environment: {
                    timestamp: '2026-03-06T10:00:00.000Z',
                    appSource: 'admin',
                    errorInfo: {
                        message: 'Cannot read properties of undefined (reading "id")',
                        stack: 'TypeError: ...\n  at Component (/src/Component.tsx:42)'
                    }
                }
            });

            // Act & Assert
            expect(() => FeedbackReportEmail(props)).not.toThrow();
        });

        it('should render without throwing when attachmentUrls are provided', () => {
            // Arrange
            const props = buildMinimalFeedbackEmailProps({
                attachmentUrls: [
                    'https://linear.app/attachment/screenshot-1.png',
                    'https://linear.app/attachment/screenshot-2.png'
                ]
            });

            // Act & Assert
            expect(() => FeedbackReportEmail(props)).not.toThrow();
        });

        it('should render without throwing when no optional fields are provided', () => {
            // Arrange - absolute minimum: no severity, no steps, no attachments, no errors
            const props: FeedbackReportEmailProps = {
                reportType: 'Sugerencia',
                title: 'Añadir modo oscuro',
                description: 'El modo oscuro mejoraría la experiencia nocturna.',
                reporterName: 'Carlos López',
                reporterEmail: 'carlos@example.com',
                environment: {
                    timestamp: '2026-03-06T08:00:00.000Z',
                    appSource: 'web'
                }
            };

            // Act & Assert
            expect(() => FeedbackReportEmail(props)).not.toThrow();
        });

        it('should return a React element with the correct type', () => {
            // Arrange
            const props = buildMinimalFeedbackEmailProps();

            // Act
            const element = FeedbackReportEmail(props) as ReactElement;

            // Assert - React Email templates return objects with a type property
            expect(typeof element).toBe('object');
            expect(element).toHaveProperty('type');
            expect(element).toHaveProperty('props');
        });
    });

    // -----------------------------------------------------------------------
    // 2. Attachments pass-through in ResendEmailTransport
    // -----------------------------------------------------------------------

    describe('ResendEmailTransport - attachments pass-through', () => {
        it('should forward a single attachment to the Resend SDK', async () => {
            // Arrange
            const { client, sendMock } = createMockResend();
            const transport = new ResendEmailTransport(client, {
                fromEmail: 'noreply@hospeda.com.ar',
                fromName: 'Hospeda'
            });
            sendMock.mockResolvedValue({ data: { id: 'msg_attach_single' } });

            const attachment = {
                filename: 'screenshot.png',
                content: Buffer.from('fake-image-data'),
                contentType: 'image/png'
            };

            const input: SendEmailInput = {
                to: 'admin@hospeda.com.ar',
                subject: 'Bug report with attachment',
                react: {} as ReactElement,
                attachments: [attachment]
            };

            // Act
            const result = await transport.send(input);

            // Assert
            expect(result.messageId).toBe('msg_attach_single');
            expect(sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: [attachment]
                })
            );
        });

        it('should forward multiple attachments to the Resend SDK', async () => {
            // Arrange
            const { client, sendMock } = createMockResend();
            const transport = new ResendEmailTransport(client, {
                fromEmail: 'noreply@hospeda.com.ar',
                fromName: 'Hospeda'
            });
            sendMock.mockResolvedValue({ data: { id: 'msg_attach_multi' } });

            const attachments = [
                {
                    filename: 'screenshot-1.png',
                    content: Buffer.from('data-1'),
                    contentType: 'image/png'
                },
                {
                    filename: 'report.pdf',
                    content: Buffer.from('pdf-data'),
                    contentType: 'application/pdf'
                },
                {
                    filename: 'log.txt',
                    content: 'plain text log content'
                }
            ];

            const input: SendEmailInput = {
                to: 'admin@hospeda.com.ar',
                subject: 'Bug report with multiple attachments',
                react: {} as ReactElement,
                attachments
            };

            // Act
            await transport.send(input);

            // Assert
            expect(sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments
                })
            );
            expect(sendMock.mock.calls[0][0].attachments).toHaveLength(3);
        });

        it('should pass undefined attachments when field is not provided', async () => {
            // Arrange
            const { client, sendMock } = createMockResend();
            const transport = new ResendEmailTransport(client, {
                fromEmail: 'noreply@hospeda.com.ar',
                fromName: 'Hospeda'
            });
            sendMock.mockResolvedValue({ data: { id: 'msg_no_attach' } });

            const input: SendEmailInput = {
                to: 'user@example.com',
                subject: 'Email without attachments',
                react: {} as ReactElement
            };

            // Act
            await transport.send(input);

            // Assert
            expect(sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: undefined
                })
            );
        });

        it('should pass an empty attachments array when explicitly set to empty', async () => {
            // Arrange
            const { client, sendMock } = createMockResend();
            const transport = new ResendEmailTransport(client, {
                fromEmail: 'noreply@hospeda.com.ar',
                fromName: 'Hospeda'
            });
            sendMock.mockResolvedValue({ data: { id: 'msg_empty_attach' } });

            const input: SendEmailInput = {
                to: 'user@example.com',
                subject: 'Email with empty attachments',
                react: {} as ReactElement,
                attachments: []
            };

            // Act
            await transport.send(input);

            // Assert
            expect(sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: []
                })
            );
        });

        it('should forward attachments alongside other input fields', async () => {
            // Arrange
            const { client, sendMock } = createMockResend();
            const transport = new ResendEmailTransport(client, {
                fromEmail: 'noreply@hospeda.com.ar',
                fromName: 'Hospeda'
            });
            sendMock.mockResolvedValue({ data: { id: 'msg_full_input' } });

            const input: SendEmailInput = {
                to: 'admin@hospeda.com.ar',
                subject: 'Full email with all fields',
                react: {} as ReactElement,
                replyTo: 'noreply@hospeda.com.ar',
                tags: [{ name: 'type', value: 'feedback_report' }],
                attachments: [
                    { filename: 'file.txt', content: 'content', contentType: 'text/plain' }
                ]
            };

            // Act
            await transport.send(input);

            // Assert - all fields forwarded correctly
            expect(sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'admin@hospeda.com.ar',
                    subject: 'Full email with all fields',
                    replyTo: 'noreply@hospeda.com.ar',
                    tags: [{ name: 'type', value: 'feedback_report' }],
                    attachments: [
                        { filename: 'file.txt', content: 'content', contentType: 'text/plain' }
                    ]
                })
            );
        });
    });

    // -----------------------------------------------------------------------
    // 3. skipDb option
    // -----------------------------------------------------------------------

    describe('NotificationService.send() - skipDb option', () => {
        let mockEmailTransport: { send: Mock };
        let mockPreferenceService: PreferenceService;
        let mockRetryService: RetryService;
        let mockDb: ReturnType<typeof getDb>;
        let mockLogger: ILogger;
        let mockDeps: NotificationServiceDeps;

        beforeEach(() => {
            mockEmailTransport = { send: vi.fn() };

            mockPreferenceService = {
                shouldSendNotification: vi.fn().mockResolvedValue(true),
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
                emailTransport: mockEmailTransport as never,
                preferenceService: mockPreferenceService,
                retryService: mockRetryService,
                db: mockDb,
                logger: mockLogger,
                siteUrl: 'https://hospeda.com.ar'
            };

            (mockEmailTransport.send as Mock).mockResolvedValue({ messageId: 'msg_feedback_001' });
        });

        it('should NOT call db.insert() when skipDb is true', async () => {
            // Arrange
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            // Act
            const result = await service.send(payload, { skipDb: true });

            // Assert
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');
            expect(mockDb.insert).not.toHaveBeenCalled();
        });

        it('should call db.insert() when skipDb is false (default behavior)', async () => {
            // Arrange
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            // Act
            const result = await service.send(payload, { skipDb: false });

            // Assert
            expect(result.success).toBe(true);
            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });

        it('should call db.insert() when options are not provided at all', async () => {
            // Arrange
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            // Act
            await service.send(payload);

            // Assert
            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });

        it('should NOT call db.insert() on failure when skipDb is true', async () => {
            // Arrange
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            (mockEmailTransport.send as Mock).mockRejectedValue(new Error('Transport error'));

            // Act
            const result = await service.send(payload, { skipDb: true });

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');
            expect(mockDb.insert).not.toHaveBeenCalled();
        });

        it('should NOT call db.insert() when skipped due to preferences and skipDb is true', async () => {
            // Arrange
            (mockPreferenceService.shouldSendNotification as Mock).mockResolvedValue(false);
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            // Act
            const result = await service.send(payload, { skipDb: true });

            // Assert
            expect(result.success).toBe(false);
            expect(result.status).toBe('skipped');
            expect(mockDb.insert).not.toHaveBeenCalled();
        });

        it('should call db.insert() when skipped due to preferences and skipDb is false', async () => {
            // Arrange
            (mockPreferenceService.shouldSendNotification as Mock).mockResolvedValue(false);
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            // Act
            await service.send(payload, { skipDb: false });

            // Assert
            expect(mockDb.insert).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // 4. skipLogging option
    // -----------------------------------------------------------------------

    describe('NotificationService.send() - skipLogging option', () => {
        let mockEmailTransport: { send: Mock };
        let mockPreferenceService: PreferenceService;
        let mockRetryService: RetryService;
        let mockDb: ReturnType<typeof getDb>;
        let mockLogger: ILogger;
        let mockDeps: NotificationServiceDeps;

        beforeEach(() => {
            mockEmailTransport = { send: vi.fn() };

            mockPreferenceService = {
                shouldSendNotification: vi.fn().mockResolvedValue(true),
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
                emailTransport: mockEmailTransport as never,
                preferenceService: mockPreferenceService,
                retryService: mockRetryService,
                db: mockDb,
                logger: mockLogger,
                siteUrl: 'https://hospeda.com.ar'
            };

            (mockEmailTransport.send as Mock).mockResolvedValue({ messageId: 'msg_feedback_002' });
        });

        it('should NOT call logger.info() when skipLogging is true', async () => {
            // Arrange
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            // Act
            const result = await service.send(payload, { skipLogging: true });

            // Assert
            expect(result.success).toBe(true);
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should call logger.info() when skipLogging is false (default behavior)', async () => {
            // Arrange
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            // Act
            await service.send(payload, { skipLogging: false });

            // Assert
            // logger.info is called at least twice: "Processing notification" + "Notification sent"
            expect(mockLogger.info).toHaveBeenCalledTimes(2);
        });

        it('should call logger.info() when options are not provided at all', async () => {
            // Arrange
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            // Act
            await service.send(payload);

            // Assert
            expect(mockLogger.info).toHaveBeenCalledTimes(2);
        });

        it('should NOT call logger.info() on skip due to preferences when skipLogging is true', async () => {
            // Arrange
            (mockPreferenceService.shouldSendNotification as Mock).mockResolvedValue(false);
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            // Act
            const result = await service.send(payload, { skipLogging: true });

            // Assert
            expect(result.status).toBe('skipped');
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should NOT call logger.error() on failure when skipLogging is true', async () => {
            // Arrange
            // Use a service with no retry service so enqueueForRetry does not produce
            // an extra logger.info call (retry enqueueing runs outside skipLogging scope).
            const depsWithoutRetry = { ...mockDeps, retryService: null };
            (mockEmailTransport.send as Mock).mockRejectedValue(new Error('Transport failure'));
            const service = new NotificationService(depsWithoutRetry);
            const payload = buildFeedbackPayload();

            // Act
            const result = await service.send(payload, { skipLogging: true });

            // Assert - main flow logging is suppressed
            expect(result.success).toBe(false);
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            // logger.warn IS called because enqueueForRetry warns about missing retry service
            // and that path is not controlled by skipLogging
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({ type: NotificationType.FEEDBACK_REPORT }),
                expect.stringContaining('Retry service not available')
            );
        });

        it('should still call logger.error() on failure when skipLogging is false', async () => {
            // Arrange
            (mockEmailTransport.send as Mock).mockRejectedValue(new Error('Transport failure'));
            const service = new NotificationService(mockDeps);
            const payload = buildFeedbackPayload();

            // Act
            await service.send(payload, { skipLogging: false });

            // Assert
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.FEEDBACK_REPORT,
                    error: 'Transport failure'
                }),
                'Failed to send notification'
            );
        });
    });

    // -----------------------------------------------------------------------
    // 5. Combined: FEEDBACK_REPORT + skipDb + skipLogging full flow
    // -----------------------------------------------------------------------

    describe('Combined: FEEDBACK_REPORT with skipDb + skipLogging', () => {
        let mockEmailTransport: { send: Mock };
        let mockPreferenceService: PreferenceService;
        let mockRetryService: RetryService;
        let mockDb: ReturnType<typeof getDb>;
        let mockLogger: ILogger;
        let service: NotificationService;

        beforeEach(() => {
            mockEmailTransport = { send: vi.fn() };

            mockPreferenceService = {
                shouldSendNotification: vi.fn().mockResolvedValue(true),
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

            service = new NotificationService({
                emailTransport: mockEmailTransport as never,
                preferenceService: mockPreferenceService,
                retryService: mockRetryService,
                db: mockDb,
                logger: mockLogger,
                siteUrl: 'https://hospeda.com.ar'
            });

            (mockEmailTransport.send as Mock).mockResolvedValue({ messageId: 'msg_feedback_full' });
        });

        it('should send email but skip DB and logging when both flags are true', async () => {
            // Arrange
            const payload = buildFeedbackPayload();

            // Act
            const result = await service.send(payload, { skipDb: true, skipLogging: true });

            // Assert - email was sent
            expect(result.success).toBe(true);
            expect(result.status).toBe('sent');
            expect(result.messageId).toBe('msg_feedback_full');

            // Assert - transport was called
            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);

            // Assert - no DB side effects
            expect(mockDb.insert).not.toHaveBeenCalled();

            // Assert - no logging side effects
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should pass correct notification_type and category tags in transport call', async () => {
            // Arrange
            const payload = buildFeedbackPayload();

            // Act
            await service.send(payload, { skipDb: true, skipLogging: true });

            // Assert
            expect(mockEmailTransport.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'admin@hospeda.com.ar',
                    tags: expect.arrayContaining([
                        { name: 'notification_type', value: NotificationType.FEEDBACK_REPORT },
                        { name: 'category', value: 'transactional' }
                    ])
                })
            );
        });

        it('should pass full FEEDBACK_REPORT payload with all optional fields', async () => {
            // Arrange
            const payload = buildFeedbackPayload({
                severity: 'Alta',
                stepsToReproduce: '1. Abrir /alojamientos\n2. Hacer click en filtrar',
                expectedResult: 'Lista filtrada',
                actualResult: 'Pantalla en blanco',
                attachmentUrls: ['https://cdn.linear.app/image1.png'],
                feedbackEnvironment: {
                    timestamp: '2026-03-06T14:30:00.000Z',
                    appSource: 'web',
                    currentUrl: 'https://hospeda.com.ar/es/alojamientos',
                    browser: 'Firefox 125',
                    os: 'macOS 14',
                    viewport: '1920x1080',
                    deployVersion: '2.0.0',
                    userId: 'user_xyz',
                    consoleErrors: ['Uncaught TypeError: map is not a function'],
                    errorInfo: {
                        message: 'map is not a function',
                        stack: 'TypeError: map is not a function\n  at index.tsx:42'
                    }
                }
            });

            // Act
            const result = await service.send(payload, { skipDb: true, skipLogging: true });

            // Assert
            expect(result.success).toBe(true);
            expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
            expect(mockDb.insert).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should return failed result and skip DB/logging on transport error with both flags', async () => {
            // Arrange
            // Use retryService: null so enqueueForRetry does not produce an extra
            // logger.info call (retry success logging is outside skipLogging scope).
            // With retryService null, the service calls logger.warn instead, which we
            // explicitly allow and verify below.
            const serviceNoRetry = new NotificationService({
                emailTransport: mockEmailTransport as never,
                preferenceService: mockPreferenceService,
                retryService: null,
                db: mockDb,
                logger: mockLogger,
                siteUrl: 'https://hospeda.com.ar'
            });

            // The mockEmailTransport is a direct mock (not ResendEmailTransport), so thrown
            // errors surface without the "Failed to send email via Resend:" prefix wrapper.
            (mockEmailTransport.send as Mock).mockRejectedValue(
                new Error('Resend API unavailable')
            );
            const payload = buildFeedbackPayload();

            // Act
            const result = await serviceNoRetry.send(payload, { skipDb: true, skipLogging: true });

            // Assert - failed result
            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');
            expect(result.error).toBe('Resend API unavailable');

            // Assert - no DB or structured logging side effects
            expect(mockDb.insert).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            // logger.warn IS called because enqueueForRetry warns about missing retry service
            // (that path is not gated by skipLogging)
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({ type: NotificationType.FEEDBACK_REPORT }),
                expect.stringContaining('Retry service not available')
            );
        });

        it('should produce correct messageId in result matching transport response', async () => {
            // Arrange
            (mockEmailTransport.send as Mock).mockResolvedValue({
                messageId: 'resend-unique-id-9999'
            });
            const payload = buildFeedbackPayload();

            // Act
            const result = await service.send(payload, { skipDb: true, skipLogging: true });

            // Assert
            expect(result.messageId).toBe('resend-unique-id-9999');
        });

        it('should check user preferences regardless of skipDb/skipLogging flags', async () => {
            // Arrange
            const payload = buildFeedbackPayload();

            // Act
            await service.send(payload, { skipDb: true, skipLogging: true });

            // Assert - preference check always runs (cannot skip it)
            expect(mockPreferenceService.shouldSendNotification).toHaveBeenCalledWith(
                null, // userId is null in buildFeedbackPayload
                NotificationType.FEEDBACK_REPORT
            );
        });
    });
});
