/**
 * @file direct-email-errors.test.ts
 * HOS-2685: API reason codes map to friendly i18n keys.
 */
import { describe, expect, it } from 'vitest';
import {
    getDirectEmailErrorKey,
    getDirectEmailErrorReason,
    getDirectEmailProviderMessage,
    getDirectEmailSendErrorKey
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
        ['DIRECT_EMAIL_NOT_CONFIGURED', 'admin-direct-email.errors.notConfigured'],
        ['DIRECT_EMAIL_TEST_SEND_FAILED', 'admin-direct-email.errors.testSendFailed'],
        ['DIRECT_EMAIL_TEMPLATE_NOT_FOUND', 'admin-direct-email.errors.templateNotFound'],
        ['DIRECT_EMAIL_PERMISSION_DENIED', 'admin-direct-email.errors.permissionDenied'],
        ['DIRECT_EMAIL_SUPPRESSION_OPT_OUT_LOCKED', 'admin-direct-email.errors.optOutLocked']
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

describe('send error message', () => {
    it('keeps a specific message when the reason proves nothing was sent', () => {
        expect(
            getDirectEmailSendErrorKey({ error: apiError('DIRECT_EMAIL_NOT_CONFIGURED', 503) })
        ).toBe('admin-direct-email.errors.notConfigured');
    });

    it.each([
        ['an unknown reason', apiError('SOMETHING_ELSE', 504)],
        ['no reason (a masked 502)', apiError(undefined, 502)],
        ['a network failure', new Error('Failed to fetch')]
    ])('tells the admin to check the history on %s', (_label, error) => {
        expect(getDirectEmailSendErrorKey({ error })).toBe(
            'admin-direct-email.errors.sendFailedCheckHistory'
        );
    });
});

describe('provider message', () => {
    const withDetails = (details: unknown) =>
        new ApiError('x', {
            status: 502,
            code: 'UNKNOWN',
            body: { success: false, error: { code: 'UNKNOWN', details } }
        });

    it('reads details.providerError, then details.message', () => {
        expect(
            getDirectEmailProviderMessage({
                error: withDetails({ providerError: 'sender not verified' })
            })
        ).toBe('sender not verified');
        expect(getDirectEmailProviderMessage({ error: withDetails({ message: 'boom' }) })).toBe(
            'boom'
        );
    });

    it('is undefined when the details are absent (production masks a 5xx) or not an API error', () => {
        expect(getDirectEmailProviderMessage({ error: withDetails(undefined) })).toBeUndefined();
        expect(getDirectEmailProviderMessage({ error: new Error('x') })).toBeUndefined();
    });
});
