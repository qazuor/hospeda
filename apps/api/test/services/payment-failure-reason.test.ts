/**
 * @file payment-failure-reason.test.ts
 * @description HOS-764 — the payment-failure email must explain WHY a payment
 * failed in plain Spanish, never by forwarding MercadoPago's raw
 * `status_detail`.
 *
 * These assertions deliberately check the rendered STRING, not the i18n key: a
 * key that resolves to nothing is exactly the defect this module exists to
 * prevent, and asserting on the key would be blind to it.
 */

import { describe, expect, it } from 'vitest';
import { resolvePaymentFailureReason } from '../../src/services/payment-failure-reason';

describe('resolvePaymentFailureReason', () => {
    describe('known status_detail codes', () => {
        it('should explain a fraud-prevention block without mentioning funds', () => {
            // Arrange
            const statusDetail = 'cc_rejected_high_risk';

            // Act
            const result = resolvePaymentFailureReason({ statusDetail });

            // Assert
            expect(result).toBe('La operación no fue autorizada por prevención de fraude');
            expect(result.toLowerCase()).not.toContain('fondos');
        });

        it('should point a CVV typo at the security code', () => {
            // Arrange
            const statusDetail = 'cc_rejected_bad_filled_security_code';

            // Act
            const result = resolvePaymentFailureReason({ statusDetail });

            // Assert
            expect(result).toBe('Revisá el código de seguridad de la tarjeta');
        });

        it('should describe a disabled card as blocked, not expired', () => {
            // Arrange
            const statusDetail = 'cc_rejected_card_disabled';

            // Act
            const result = resolvePaymentFailureReason({ statusDetail });

            // Assert
            expect(result).toBe('La tarjeta está bloqueada o deshabilitada');
            expect(result.toLowerCase()).not.toContain('vencid');
        });

        it('should name an invalid installment plan', () => {
            // Arrange
            const statusDetail = 'cc_rejected_invalid_installments';

            // Act
            const result = resolvePaymentFailureReason({ statusDetail });

            // Assert
            expect(result).toBe('El plan de cuotas elegido no es válido para esta tarjeta');
        });

        it('should still explain insufficient funds', () => {
            // Arrange
            const statusDetail = 'cc_rejected_insufficient_amount';

            // Act
            const result = resolvePaymentFailureReason({ statusDetail });

            // Assert
            expect(result).toBe('Fondos insuficientes en la tarjeta');
        });
    });

    describe('unknown and absent status_detail', () => {
        it.each([
            ['null', null],
            ['undefined', undefined],
            ['an empty string', ''],
            ['an unrecognised code', 'cc_rejected_some_future_code']
        ])('should return the unknown-reason phrase for %s', (_label, statusDetail) => {
            // Act
            const result = resolvePaymentFailureReason({ statusDetail });

            // Assert
            expect(result).toBe('Motivo no informado por el banco');
        });

        it('should NOT fall back to the full-page checkout sentence', () => {
            // Arrange — `genericMessage` tells the reader to review a form they
            // are not looking at; it is wrong copy for an email.
            const statusDetail = null;

            // Act
            const result = resolvePaymentFailureReason({ statusDetail });

            // Assert
            expect(result).not.toContain('Revisá los datos');
        });
    });

    describe('the raw provider code never reaches the payer', () => {
        it.each([
            'cc_rejected_high_risk',
            'cc_rejected_bad_filled_security_code',
            'cc_rejected_card_disabled',
            'cc_rejected_invalid_installments',
            'cc_rejected_insufficient_amount',
            'cc_rejected_blacklist',
            'cc_rejected_bad_filled_card_number',
            'cc_rejected_some_future_code'
        ])('should not echo %s into the email body', (statusDetail) => {
            // Act
            const result = resolvePaymentFailureReason({ statusDetail });

            // Assert
            expect(result).not.toContain(statusDetail);
            expect(result).not.toContain('cc_rejected');
            expect(result.length).toBeGreaterThan(0);
        });
    });
});
