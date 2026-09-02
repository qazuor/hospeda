/**
 * Regression test for HOS-839: the payment email body divided the amount by
 * 100, while the subject (fixed by HOS-830) did not.
 *
 * `PaymentNotificationPayload.amount` carries MAJOR units (ARS pesos) — its
 * only producers, `sendPaymentSuccessNotification` and
 * `sendPaymentFailureNotifications` in
 * `apps/api/src/routes/webhooks/mercadopago/notifications.ts`, type the
 * parameter `Major` for exactly this reason (HOS-713/HOS-720). The subject
 * line already reads it as pesos (HOS-830's `formatSubjectAmount`); this
 * suite freezes the invariant that the body reads the SAME `payload.amount`
 * field as the SAME unit, so a real ARS 5.000 charge cannot render as
 * "$50,00" in one part of the same email while the other part says
 * "$5.000" (a real defect: the two used to disagree inside a single email).
 *
 * A four-figure amount is used deliberately — a two-figure amount reads
 * plausibly under both the correct value and the amount/100 bug, which is
 * exactly how this defect went unnoticed.
 *
 * @module test/integration/payment-email-amount-unit.test
 */

import type { getDb } from '@repo/db';
import type { ILogger } from '@repo/logger';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import {
    NotificationService,
    type NotificationServiceDeps
} from '../../src/services/notification.service';
import type { PreferenceService } from '../../src/services/preference.service';
import type { RetryService } from '../../src/services/retry.service';
import type {
    EmailTransport,
    SendEmailInput
} from '../../src/transports/email/email-transport.interface';
import type { NotificationPayload } from '../../src/types/notification.types';
import { NotificationType } from '../../src/types/notification.types';

describe('Payment email amount unit (HOS-839 regression)', () => {
    let service: NotificationService;
    let mockEmailTransport: EmailTransport;
    let mockPreferenceService: PreferenceService;
    let mockRetryService: RetryService;
    let mockDb: ReturnType<typeof getDb>;
    let mockLogger: ILogger;

    beforeEach(() => {
        mockEmailTransport = { send: vi.fn().mockResolvedValue({ messageId: 'msg_839' }) };
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
            insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
        } as unknown as ReturnType<typeof getDb>;
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn()
        } as unknown as ILogger;

        const deps: NotificationServiceDeps = {
            emailTransport: mockEmailTransport,
            preferenceService: mockPreferenceService,
            retryService: mockRetryService,
            db: mockDb,
            logger: mockLogger,
            siteUrl: 'https://hospeda.com.ar'
        };
        service = new NotificationService(deps);
    });

    it('renders subject and body for the same 4-figure charge in pesos, never dividing by 100', async () => {
        // Arrange — mirrors the real producer's units: `amount` is MAJOR
        // (pesos), exactly like `sendPaymentSuccessNotification(customerId,
        // amount: Major, ...)` passes it.
        const payload: NotificationPayload = {
            type: NotificationType.PAYMENT_SUCCESS,
            recipientEmail: 'user@example.com',
            recipientName: 'Juan Pérez',
            userId: 'user_123',
            customerId: 'cus_456',
            amount: 5000,
            currency: 'ARS',
            planName: 'Plan Anual'
        };

        // Act
        await service.send(payload);

        // Assert
        expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
        const [sendInput] = (mockEmailTransport.send as Mock).mock.calls[0] as [SendEmailInput];

        // Subject (HOS-830): already grouped es-AR, no currency symbol drift.
        expect(sendInput.subject).toBe('Pago recibido - $5.000');

        // Body (HOS-839): must show the SAME 5.000 pesos, not amount / 100.
        const bodyHtml = renderToStaticMarkup(sendInput.react);
        expect(bodyHtml).toContain('$5.000,00');
        expect(bodyHtml).not.toContain('$50,00');
    });
});
