// @vitest-environment jsdom
import {
    LIFT_RECONCILIATION_MARK_REJECTIONS,
    SETTLE_EXTERNAL_CHARGE_REJECTIONS,
    SETTLE_EXTERNAL_REFUND_REJECTIONS
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import { KNOWN_LIFT_REASONS, LIFT_REASON_KEYS, readLiftReason } from '../../lift-reasons';
import { ACTION14_REJECTION_KEYS, readAction14Rejection } from '../action14-shared';

const ACTION14_GENERIC = 'admin-billing.reconciliationMarks.action14.genericError';

/** The union of external-refund and external-charge rejections, deduplicated. */
const ACTION14_CODES = [
    ...new Set([...SETTLE_EXTERNAL_REFUND_REJECTIONS, ...SETTLE_EXTERNAL_CHARGE_REJECTIONS])
];

/** Builds the API error shape the resolvers read (`body.error.reason`). */
function rejectionError(reason: string, status = 409): ApiError {
    return new ApiError('rejection', { status, body: { error: { reason } } });
}

describe('HOS-2110 action 14 rejection map', () => {
    it('is exhaustive over the refund + charge tuples', () => {
        // Arrange + Act + Assert
        expect(Object.keys(ACTION14_REJECTION_KEYS).sort()).toEqual([...ACTION14_CODES].sort());
    });

    it.each(ACTION14_CODES)('%s resolves to its mapped key', (code) => {
        // Arrange
        const expected = ACTION14_REJECTION_KEYS[code as keyof typeof ACTION14_REJECTION_KEYS];

        // Act
        const key = readAction14Rejection({ error: rejectionError(code) });

        // Assert
        expect(expected).toBeDefined();
        expect(key).toBe(expected);
    });

    it('falls back to the generic copy for an unknown reason', () => {
        // Arrange + Act + Assert
        expect(readAction14Rejection({ error: rejectionError('NOT_A_CODE') })).toBe(
            ACTION14_GENERIC
        );
    });
});

describe('HOS-2110 lift reconciliation mark rejections', () => {
    it('uses the shared tuple and is exhaustive over it', () => {
        // Arrange + Act + Assert
        expect(KNOWN_LIFT_REASONS).toBe(LIFT_RECONCILIATION_MARK_REJECTIONS);
        expect(Object.keys(LIFT_REASON_KEYS).sort()).toEqual(
            [...LIFT_RECONCILIATION_MARK_REJECTIONS].sort()
        );
    });

    it.each(LIFT_RECONCILIATION_MARK_REJECTIONS)('%s is read as a known reason', (code) => {
        // Arrange + Act + Assert
        expect(readLiftReason({ error: rejectionError(code) })).toBe(code);
    });

    it('returns null for an unknown reason', () => {
        // Arrange + Act + Assert
        expect(readLiftReason({ error: rejectionError('NOT_A_CODE') })).toBeNull();
        expect(readLiftReason({ error: new Error('network') })).toBeNull();
    });
});
