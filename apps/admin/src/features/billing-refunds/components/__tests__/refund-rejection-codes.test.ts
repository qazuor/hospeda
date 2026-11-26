// @vitest-environment jsdom
import {
    RETRY_REFUND_PROVIDER_CALLS_REJECTIONS,
    SETTLE_REFUND_REMAINDER_REJECTIONS
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import { readRetryRejection } from '../RefundProviderCallRetryForm';
import { readRemainderRejection } from '../RefundRemainderSettlementForm';

const RETRY_GENERIC = 'admin-billing.proposedRefunds.genericError';
const RETRY_SERVER = 'admin-billing.proposedRefunds.serverError';
const ACTION14_GENERIC = 'admin-billing.reconciliationMarks.action14.genericError';
const ACTION14_SERVER = 'admin-billing.reconciliationMarks.action14.serverError';

/** Builds the API error shape the resolvers read (`body.error.reason`). */
function rejectionError(reason: string, status = 409): ApiError {
    return new ApiError('rejection', { status, body: { error: { reason } } });
}

describe('HOS-2110 refund retry rejections', () => {
    it.each(
        RETRY_REFUND_PROVIDER_CALLS_REJECTIONS
    )('%s resolves to a specific key, never the generic fallback', (code) => {
        // Arrange + Act
        const key = readRetryRejection({ error: rejectionError(code) });

        // Assert
        expect(key).not.toBe(RETRY_GENERIC);
        expect(key).not.toBe(RETRY_SERVER);
    });

    it('keeps the retry-owned copy and reuses action 13 for the shared codes', () => {
        // Arrange + Act + Assert
        expect(readRetryRejection({ error: rejectionError('REFUND_RETRY_IN_PROGRESS') })).toBe(
            'admin-billing.proposedRefunds.providerRetry.rejections.REFUND_RETRY_IN_PROGRESS'
        );
        expect(readRetryRejection({ error: rejectionError('REFUND_PAST_PROVIDER_WINDOW') })).toBe(
            'admin-billing.proposedRefunds.providerRetry.rejections.REFUND_PAST_PROVIDER_WINDOW'
        );
        expect(readRetryRejection({ error: rejectionError('REFUND_NOT_FOUND') })).toBe(
            'admin-billing.proposedRefunds.rejections.REFUND_NOT_FOUND'
        );
    });

    it('falls back to the action 13 generic copy for an unknown reason', () => {
        // Arrange + Act + Assert
        expect(readRetryRejection({ error: rejectionError('NOT_A_CODE') })).toBe(RETRY_GENERIC);
    });
});

describe('HOS-2110 refund remainder rejections', () => {
    it.each(
        SETTLE_REFUND_REMAINDER_REJECTIONS
    )('%s resolves to a specific key, never the action 14 generic fallback', (code) => {
        // Arrange + Act
        const key = readRemainderRejection({ error: rejectionError(code) });

        // Assert
        expect(key).not.toBe(ACTION14_GENERIC);
        expect(key).not.toBe(ACTION14_SERVER);
    });

    it('keeps the remainder-owned copy and reuses action 14 for the shared codes', () => {
        // Arrange + Act + Assert
        expect(
            readRemainderRejection({ error: rejectionError('REMAINDER_NOT_FOUND_AT_PROVIDER') })
        ).toBe(
            'admin-billing.proposedRefunds.remainder.rejections.REMAINDER_NOT_FOUND_AT_PROVIDER'
        );
        expect(readRemainderRejection({ error: rejectionError('REFUND_AMOUNT_INVALID') })).toBe(
            'admin-billing.reconciliationMarks.action14.rejections.REFUND_AMOUNT_INVALID'
        );
    });

    it('falls back to the action 14 generic copy for an unknown reason', () => {
        // Arrange + Act + Assert
        expect(readRemainderRejection({ error: rejectionError('NOT_A_CODE') })).toBe(
            ACTION14_GENERIC
        );
    });
});
