// @vitest-environment jsdom
import { REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import { isStaleLateManualPaymentRejection } from '../../hooks/useLateManualPayment';
import { readLateManualPaymentRejection } from '../LateManualPaymentSection';

const BASE = 'admin-billing.subscriptionAdmin.lateManualPayment.rejections';
const GENERIC = `${BASE}.generic`;
/** The three MP4 rejections the hook treats as "the screen is reading stale state". */
const STALE = [
    'LOST_RACE',
    'MANUAL_PAYMENT_NOT_DECLARED_UNPAID',
    'MANUAL_PAYMENT_NOT_SUSPENDED'
] as const;

/** Builds the API error shape the resolvers read (`body.error.reason`). */
function rejectionError(reason: string, status = 409): ApiError {
    return new ApiError('rejection', { status, body: { error: { reason } } });
}

describe('HOS-2110 late manual payment rejections', () => {
    it.each(REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS)('%s resolves to its own copy key', (code) => {
        // Arrange + Act
        const key = readLateManualPaymentRejection({ error: rejectionError(code) });

        // Assert
        expect(key).toBe(`${BASE}.${code}`);
    });

    it('falls back to the generic copy for an unknown reason', () => {
        // Arrange + Act + Assert
        expect(readLateManualPaymentRejection({ error: rejectionError('NOT_A_CODE') })).toBe(
            GENERIC
        );
        expect(readLateManualPaymentRejection({ error: new Error('network') })).toBe(GENERIC);
    });

    it('flags only the stale rejections', () => {
        // Arrange + Act + Assert
        for (const code of STALE) {
            expect(isStaleLateManualPaymentRejection({ error: rejectionError(code) })).toBe(true);
        }
        expect(
            isStaleLateManualPaymentRejection({ error: rejectionError('RETAINED_PAYMENT') })
        ).toBe(false);
        expect(isStaleLateManualPaymentRejection({ error: rejectionError('NOT_A_CODE') })).toBe(
            false
        );
    });
});
