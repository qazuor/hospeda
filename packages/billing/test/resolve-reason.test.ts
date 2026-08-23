/**
 * @file resolve-reason.test.ts
 * @description Unit tests for the MercadoPago status_detail → reason key mapper.
 * Covers all pattern groups, null/undefined inputs, unknown codes, and empty strings.
 *
 * HOS-764 phase 2 re-categorised three codes that were previously mapped to a
 * message that contradicted MercadoPago's own documentation. The tests below
 * assert the CORRECTED mapping; the old expectations are gone on purpose, so a
 * revert of the resolver turns this file red.
 */

import { describe, expect, it } from 'vitest';
import type { CheckoutReasonI18nKey, CheckoutReasonKey } from '../src/utils/resolve-reason.js';
import { resolveReasonI18nKey, resolveReasonKey } from '../src/utils/resolve-reason.js';

// ---------------------------------------------------------------------------
// resolveReasonKey
// ---------------------------------------------------------------------------

describe('resolveReasonKey', () => {
    // -- reasonInsufficientFunds --

    describe('insufficient funds patterns', () => {
        it('should return reasonInsufficientFunds for cc_rejected_insufficient_amount', () => {
            // Arrange
            const statusDetail = 'cc_rejected_insufficient_amount';

            // Act
            const result: CheckoutReasonKey = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonInsufficientFunds');
        });

        it('should NOT return reasonInsufficientFunds for cc_rejected_high_risk (HOS-764)', () => {
            // Arrange — MercadoPago classifies this as a fraud-prevention block.
            // Telling the payer "you do not have enough money" is factually wrong.
            const statusDetail = 'cc_rejected_high_risk';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).not.toBe('reasonInsufficientFunds');
        });
    });

    // -- reasonHighRisk (HOS-764) --

    describe('fraud prevention patterns', () => {
        it('should return reasonHighRisk for cc_rejected_high_risk', () => {
            // Arrange
            const statusDetail = 'cc_rejected_high_risk';

            // Act
            const result: CheckoutReasonKey = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonHighRisk');
        });
    });

    // -- reasonCardDeclined --

    describe('card declined patterns', () => {
        it('should return reasonCardDeclined for cc_rejected_call_for_authorize', () => {
            // Arrange
            const statusDetail = 'cc_rejected_call_for_authorize';

            // Act
            const result: CheckoutReasonKey = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonCardDeclined');
        });

        it('should return reasonCardDeclined for cc_rejected_blacklist', () => {
            // Arrange
            const statusDetail = 'cc_rejected_blacklist';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonCardDeclined');
        });

        it('should return reasonCardDeclined for cc_rejected_max_attempts', () => {
            // Arrange
            const statusDetail = 'cc_rejected_max_attempts';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonCardDeclined');
        });

        it('should return reasonCardDeclined for cc_rejected_other_reason', () => {
            // Arrange
            const statusDetail = 'cc_rejected_other_reason';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonCardDeclined');
        });

        it('should NOT return reasonCardDeclined for cc_rejected_bad_filled_security_code (HOS-764)', () => {
            // Arrange — MercadoPago documents this as a typo in the CVV. A bare
            // "the card was declined" hides the ten-second fix from the payer.
            const statusDetail = 'cc_rejected_bad_filled_security_code';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).not.toBe('reasonCardDeclined');
        });
    });

    // -- reasonSecurityCode (HOS-764) --

    describe('security code patterns', () => {
        it('should return reasonSecurityCode for cc_rejected_bad_filled_security_code', () => {
            // Arrange
            const statusDetail = 'cc_rejected_bad_filled_security_code';

            // Act
            const result: CheckoutReasonKey = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonSecurityCode');
        });
    });

    // -- reasonCardDisabled (HOS-764) --

    describe('disabled card patterns', () => {
        it('should return reasonCardDisabled for cc_rejected_card_disabled', () => {
            // Arrange
            const statusDetail = 'cc_rejected_card_disabled';

            // Act
            const result: CheckoutReasonKey = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonCardDisabled');
        });

        it('should NOT report cc_rejected_card_disabled as an expired card (HOS-764)', () => {
            // Arrange — blocked/disabled and expired are different problems with
            // different fixes; the payer cannot act on the wrong one.
            const statusDetail = 'cc_rejected_card_disabled';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).not.toBe('reasonExpired');
        });
    });

    // -- reasonInvalidInstallments (HOS-764) --

    describe('invalid installments patterns', () => {
        it('should return reasonInvalidInstallments for cc_rejected_invalid_installments', () => {
            // Arrange — previously unmapped, so it fell through to genericMessage.
            const statusDetail = 'cc_rejected_invalid_installments';

            // Act
            const result: CheckoutReasonKey = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonInvalidInstallments');
        });

        it('should not fall through to genericMessage for cc_rejected_invalid_installments', () => {
            // Arrange
            const statusDetail = 'cc_rejected_invalid_installments';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).not.toBe('genericMessage');
        });
    });

    // -- reasonInvalidData --

    describe('invalid data patterns', () => {
        it('should return reasonInvalidData for cc_rejected_bad_filled_card_number', () => {
            // Arrange
            const statusDetail = 'cc_rejected_bad_filled_card_number';

            // Act
            const result: CheckoutReasonKey = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonInvalidData');
        });

        it('should return reasonInvalidData for cc_rejected_bad_filled_date', () => {
            // Arrange
            const statusDetail = 'cc_rejected_bad_filled_date';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonInvalidData');
        });

        it('should return reasonInvalidData for cc_rejected_bad_filled_other', () => {
            // Arrange
            const statusDetail = 'cc_rejected_bad_filled_other';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonInvalidData');
        });

        it('should return reasonInvalidData for cc_rejected_duplicated_payment', () => {
            // Arrange
            const statusDetail = 'cc_rejected_duplicated_payment';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonInvalidData');
        });
    });

    // -- retired codes (HOS-764) --

    describe('codes retired for not existing in the MercadoPago vocabulary', () => {
        it.each([
            'rejected_insufficient_data',
            'rejected_by_bank',
            'cc_rejected_card_type_not_allowed'
        ])('should return genericMessage for the invented code %s', (statusDetail) => {
            // Arrange / Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('genericMessage');
        });
    });

    // -- genericMessage fallbacks --

    describe('genericMessage fallbacks', () => {
        it('should return genericMessage for null', () => {
            // Arrange / Act
            const result: CheckoutReasonKey = resolveReasonKey(null);

            // Assert
            expect(result).toBe('genericMessage');
        });

        it('should return genericMessage for undefined', () => {
            // Arrange / Act
            const result: CheckoutReasonKey = resolveReasonKey(undefined);

            // Assert
            expect(result).toBe('genericMessage');
        });

        it('should return genericMessage for empty string', () => {
            // Arrange / Act
            const result = resolveReasonKey('');

            // Assert
            expect(result).toBe('genericMessage');
        });

        it('should return genericMessage for an unknown status_detail code', () => {
            // Arrange
            const statusDetail = 'some_unknown_mp_code';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('genericMessage');
        });

        it('should return genericMessage for a partial code that is not an exact match', () => {
            // Arrange — partial match of a known pattern must NOT resolve
            const statusDetail = 'cc_rejected_insufficient';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('genericMessage');
        });
    });
});

// ---------------------------------------------------------------------------
// resolveReasonI18nKey
// ---------------------------------------------------------------------------

describe('resolveReasonI18nKey', () => {
    it('should prefix the reason key with the billing.checkout.failure namespace', () => {
        // Arrange
        const statusDetail = 'cc_rejected_insufficient_amount';

        // Act
        const result: CheckoutReasonI18nKey = resolveReasonI18nKey(statusDetail);

        // Assert
        expect(result).toBe('billing.checkout.failure.reasonInsufficientFunds');
    });

    it('should return billing.checkout.failure.reasonCardDeclined for blacklisted card', () => {
        // Arrange
        const statusDetail = 'cc_rejected_blacklist';

        // Act
        const result = resolveReasonI18nKey(statusDetail);

        // Assert
        expect(result).toBe('billing.checkout.failure.reasonCardDeclined');
    });

    it('should return billing.checkout.failure.reasonCardDisabled for disabled card', () => {
        // Arrange
        const statusDetail = 'cc_rejected_card_disabled';

        // Act
        const result = resolveReasonI18nKey(statusDetail);

        // Assert
        expect(result).toBe('billing.checkout.failure.reasonCardDisabled');
    });

    it('should return billing.checkout.failure.reasonHighRisk for a high-risk block', () => {
        // Arrange
        const statusDetail = 'cc_rejected_high_risk';

        // Act
        const result = resolveReasonI18nKey(statusDetail);

        // Assert
        expect(result).toBe('billing.checkout.failure.reasonHighRisk');
    });

    it('should return billing.checkout.failure.reasonSecurityCode for a bad CVV', () => {
        // Arrange
        const statusDetail = 'cc_rejected_bad_filled_security_code';

        // Act
        const result = resolveReasonI18nKey(statusDetail);

        // Assert
        expect(result).toBe('billing.checkout.failure.reasonSecurityCode');
    });

    it('should return billing.checkout.failure.reasonInvalidInstallments for a bad installment plan', () => {
        // Arrange
        const statusDetail = 'cc_rejected_invalid_installments';

        // Act
        const result = resolveReasonI18nKey(statusDetail);

        // Assert
        expect(result).toBe('billing.checkout.failure.reasonInvalidInstallments');
    });

    it('should return billing.checkout.failure.reasonInvalidData for duplicated payment', () => {
        // Arrange
        const statusDetail = 'cc_rejected_duplicated_payment';

        // Act
        const result = resolveReasonI18nKey(statusDetail);

        // Assert
        expect(result).toBe('billing.checkout.failure.reasonInvalidData');
    });

    it('should return billing.checkout.failure.genericMessage for null', () => {
        // Arrange / Act
        const result: CheckoutReasonI18nKey = resolveReasonI18nKey(null);

        // Assert
        expect(result).toBe('billing.checkout.failure.genericMessage');
    });

    it('should return billing.checkout.failure.genericMessage for undefined', () => {
        // Arrange / Act
        const result = resolveReasonI18nKey(undefined);

        // Assert
        expect(result).toBe('billing.checkout.failure.genericMessage');
    });

    it('should return billing.checkout.failure.genericMessage for unknown code', () => {
        // Arrange
        const statusDetail = 'unknown_random_code';

        // Act
        const result = resolveReasonI18nKey(statusDetail);

        // Assert
        expect(result).toBe('billing.checkout.failure.genericMessage');
    });
});
