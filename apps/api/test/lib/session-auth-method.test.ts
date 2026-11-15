import { describe, expect, it } from 'vitest';
import { resolveSessionAuthMethod } from '../../src/lib/session-auth-method';

/** TEST:V7:8 verifies each supported session creation path and fails closed for unknown paths. */
describe('resolveSessionAuthMethod', () => {
    it.each([
        ['/sign-in/email', undefined, 'credential'],
        ['/callback/:id', 'google', 'google'],
        ['/oauth2/callback/:providerId', 'facebook', 'facebook'],
        ['/callback/google', undefined, 'google'],
        ['/verify-email', undefined, 'email-verification'],
        ['/callback/unknown', undefined, null],
        ['/other', undefined, null],
        [undefined, undefined, null]
    ] as const)('resolves %s', (path, providerId, expected) => {
        expect(resolveSessionAuthMethod({ path, providerId })).toEqual(expected);
    });
});
