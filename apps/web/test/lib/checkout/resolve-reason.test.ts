/**
 * @file resolve-reason.test.ts
 * @description Unit tests for the MercadoPago status_detail → reason key mapper.
 * Covers all pattern groups, null/undefined inputs, unknown codes, and empty strings.
 */

import { describe, expect, it } from 'vitest';
import { resolveReasonI18nKey, resolveReasonKey } from '../../../src/lib/checkout/resolve-reason';
import type {
    CheckoutReasonI18nKey,
    CheckoutReasonKey
} from '../../../src/lib/checkout/resolve-reason';

// ---------------------------------------------------------------------------
// resolveReasonKey
// ---------------------------------------------------------------------------

describe('resolveReasonKey', () => {
    // -- reasonInsufficientFunds --

    describe('insufficients funds patterns', () => {
        it('should return reasonInsufficientFunds for cc_rejected_insufficient_amount', () => {
            // Arrange
            const statusDetail = 'cc_rejected_insufficient_amount';

            // Act
            const result: CheckoutReasonKey = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonInsufficientFunds');
        });

        it('should return reasonInsufficientFunds for cc_rejected_high_risk', () => {
            // Arrange
            const statusDetail = 'cc_rejected_high_risk';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonInsufficientFunds');
        });

        it('should return reasonInsufficientFunds for rejected_insufficient_data', () => {
            // Arrange
            const statusDetail = 'rejected_insufficient_data';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonInsufficientFunds');
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

        it('should return reasonCardDeclined for cc_rejected_bad_filled_security_code', () => {
            // Arrange
            const statusDetail = 'cc_rejected_bad_filled_security_code';

            // Act
            const result = resolveReasonKey(statusDetail);

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

        it('should return reasonCardDeclined for rejected_by_bank', () => {
            // Arrange
            const statusDetail = 'rejected_by_bank';

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
    });

    // -- reasonExpired --

    describe('expired card patterns', () => {
        it('should return reasonExpired for cc_rejected_card_disabled', () => {
            // Arrange
            const statusDetail = 'cc_rejected_card_disabled';

            // Act
            const result: CheckoutReasonKey = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonExpired');
        });

        it('should return reasonExpired for cc_rejected_card_type_not_allowed', () => {
            // Arrange
            const statusDetail = 'cc_rejected_card_type_not_allowed';

            // Act
            const result = resolveReasonKey(statusDetail);

            // Assert
            expect(result).toBe('reasonExpired');
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

    it('should return billing.checkout.failure.reasonExpired for disabled card', () => {
        // Arrange
        const statusDetail = 'cc_rejected_card_disabled';

        // Act
        const result = resolveReasonI18nKey(statusDetail);

        // Assert
        expect(result).toBe('billing.checkout.failure.reasonExpired');
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
