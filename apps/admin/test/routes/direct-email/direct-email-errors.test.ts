/**
 * @file direct-email-errors.test.ts
 * HOS-2685: API reason codes map to friendly i18n keys.
 */
import { describe, expect, it } from 'vitest';
import {
    getDirectEmailErrorKey,
    getDirectEmailErrorReason
} from '@/hooks/direct-email/direct-email-errors';
import { ApiError } from '@/lib/errors';

function apiError(reason: string | undefined, status = 409) {
    return new ApiError('x', {
        status,
        code: 'CONFLICT',
        body: { success: false, error: { code: 'ALREADY_EXISTS', ...(reason ? { reason } : {}) } }
    });
}

describe('direct email error mapping', () => {
    it.each([
        ['DIRECT_EMAIL_RECIPIENT_SUPPRESSED', 'admin-direct-email.errors.recipientSuppressed'],
        ['DIRECT_EMAIL_SENDER_EMAIL_MISSING', 'admin-direct-email.errors.senderEmailMissing'],
        ['DIRECT_EMAIL_NOT_CONFIGURED', 'admin-direct-email.errors.notConfigured']
    ])('maps %s', (reason, key) => {
        expect(getDirectEmailErrorKey({ error: apiError(reason) })).toBe(key);
    });

    it('falls back to the generic message for an unknown reason, no reason or a non-API error', () => {
        expect(getDirectEmailErrorKey({ error: apiError('SOMETHING_ELSE') })).toBe(
            'admin-direct-email.errors.generic'
        );
        expect(getDirectEmailErrorKey({ error: apiError(undefined) })).toBe(
            'admin-direct-email.errors.generic'
        );
        expect(getDirectEmailErrorKey({ error: new Error('boom') })).toBe(
            'admin-direct-email.errors.generic'
        );
    });

    it('reads the reason from the response body', () => {
        expect(getDirectEmailErrorReason({ error: apiError('R1') })).toBe('R1');
    });
});
