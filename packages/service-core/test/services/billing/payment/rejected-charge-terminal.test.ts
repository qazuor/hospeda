import { describe, expect, it } from 'vitest';
import { isRejectedWithoutRetryWindow } from '../../../../src/services/billing/payment/rejected-charge-terminal.js';

describe('isRejectedWithoutRetryWindow', () => {
    it('accepts rejected charge records without an expiration', () => {
        expect(
            isRejectedWithoutRetryWindow({
                charge: { purpose: 'charge', status: 'rejected', expiresAt: null }
            })
        ).toBe(true);
    });
    it.each([
        '2026-11-01T00:00:00.000Z',
        '2026-09-01T00:00:00.000Z'
    ])('keeps a rejected charge with an expiration open for P2 (%s)', (expiresAt) => {
        expect(
            isRejectedWithoutRetryWindow({
                charge: { purpose: 'charge', status: 'rejected', expiresAt }
            })
        ).toBe(false);
    });
    it.each([
        'pending',
        'approved'
    ] as const)('does not fail a %s charge without an expiration', (status) => {
        expect(
            isRejectedWithoutRetryWindow({ charge: { purpose: 'charge', status, expiresAt: null } })
        ).toBe(false);
    });
    it('ignores card validation', () => {
        expect(
            isRejectedWithoutRetryWindow({
                charge: { purpose: 'cardValidation', status: 'rejected', expiresAt: null }
            })
        ).toBe(false);
    });
});
