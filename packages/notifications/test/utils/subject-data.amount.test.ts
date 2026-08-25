/**
 * @file subject-data.amount.test.ts
 * @description Money formatting in the PAYMENT_SUCCESS subject line (HOS-830).
 *
 * The amount used to reach the subject through `buildSubjectData`'s generic
 * pass, which copies a payload field verbatim — `String(5000)` — so the receipt
 * arrived as "Pago recibido - $5000". Four digits are still legible; a plan
 * priced in the hundreds of thousands is not.
 *
 * The unit is the load-bearing detail here and it is asserted directly:
 * `PaymentNotificationPayload.amount` is in MAJOR units (ARS pesos), because
 * its only producer — `sendPaymentSuccessNotification` — types the parameter
 * `Major` after an unconverted centavo figure once mailed a real $150.00 charge
 * as $15.000,00 (HOS-713 / HOS-720). A subject that divided by 100, as
 * `formatCurrency` does, would reintroduce that defect inverted.
 */

import { describe, expect, it } from 'vitest';
import type { PaymentNotificationPayload } from '../../src/types/notification.types.js';
import { NotificationType } from '../../src/types/notification.types.js';
import { getSubject } from '../../src/utils/subject-builder.js';
import { buildSubjectData } from '../../src/utils/subject-data.js';

/** Minimal PAYMENT_SUCCESS payload carrying a given peso amount. */
function paymentPayload(amount: number): PaymentNotificationPayload {
    return {
        type: NotificationType.PAYMENT_SUCCESS,
        recipientEmail: 'buyer@example.com',
        recipientName: 'Buyer',
        amount,
        currency: 'ARS',
        planName: 'Pro'
    } as PaymentNotificationPayload;
}

/** End-to-end: payload -> resolved variables -> interpolated subject. */
function subjectFor(amount: number): string {
    const { subjectData } = buildSubjectData({ payload: paymentPayload(amount) });
    return getSubject(NotificationType.PAYMENT_SUCCESS, subjectData);
}

describe('PAYMENT_SUCCESS subject amount (HOS-830)', () => {
    it('groups thousands in es-AR style', () => {
        // Arrange / Act
        const { subjectData } = buildSubjectData({ payload: paymentPayload(5000) });

        // Assert
        expect(subjectData.amount).toBe('5.000');
    });

    it('renders the full subject the buyer sees in the inbox list', () => {
        // Assert — the literal "$" comes from the subject pattern itself.
        expect(subjectFor(5000)).toBe('Pago recibido - $5.000');
    });

    it('groups an annual-plan figure, the case the raw number actually broke', () => {
        // Arrange / Act / Assert
        expect(subjectFor(1250000)).toBe('Pago recibido - $1.250.000');
    });

    it('treats the amount as PESOS, never centavos', () => {
        // Assert — 5000 pesos is $5.000. Dividing by 100 (what `formatCurrency`
        // does) would produce "$50,00" and understate the charge by 100x.
        const subject = subjectFor(5000);

        expect(subject).toContain('5.000');
        expect(subject).not.toContain('50,00');
    });

    it('keeps a whole amount free of decimals', () => {
        expect(subjectFor(900)).toBe('Pago recibido - $900');
    });

    it('shows two decimals only when the amount actually has cents', () => {
        expect(subjectFor(1500.5)).toBe('Pago recibido - $1.500,50');
    });

    it('never leaves the raw ungrouped number in the subject', () => {
        // The precise defect: a bare String(amount) passthrough.
        expect(subjectFor(5000)).not.toContain('$5000');
    });

    it('does not emit an unresolved placeholder', () => {
        expect(subjectFor(5000)).not.toContain('{amount}');
    });
});
