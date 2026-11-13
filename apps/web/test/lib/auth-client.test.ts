/**
 * @file auth-client.test.ts
 * @description Regression tests for the manual-fetch auth helpers
 * (`forgetPassword`, `resetPassword`, `verifyEmail`) — HOS-195. These
 * helpers must propagate `code` (from the API's JSON body) and `status`
 * (from the HTTP response, or `0` on a network failure) on the returned
 * `AuthResult['error']`, so `translateApiError` can resolve a localized
 * message instead of always falling back to the raw English `message`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    forgetPassword,
    resendVerificationEmail,
    resetPassword,
    verifyEmail
} from '../../src/lib/auth-client';

describe('resendVerificationEmail (AC:V8b:5)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('propagates the nested error code and HTTP status from a 429 response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            json: async () => ({
                error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests' }
            })
        }) as unknown as typeof fetch;

        const result = await resendVerificationEmail({
            email: 'test@example.com',
            callbackURL: 'https://hospeda.test/es/sumate/partner/'
        });

        expect(result.error).toEqual({
            message: 'Too many requests',
            code: 'TOO_MANY_REQUESTS',
            status: 429
        });
    });

    it('returns status zero without a code when fetch throws', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

        const result = await resendVerificationEmail({
            email: 'test@example.com',
            callbackURL: 'https://hospeda.test/es/sumate/partner/'
        });

        expect(result.error).toEqual({
            message: 'Error de red. Por favor, intenta de nuevo.',
            status: 0
        });
    });

    it('returns response data without an error on success', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ status: true })
        }) as unknown as typeof fetch;

        const result = await resendVerificationEmail({
            email: 'test@example.com',
            callbackURL: 'https://hospeda.test/es/sumate/partner/'
        });

        expect(result).toEqual({ data: { status: true } });
    });

    it('sends the exact Better Auth request with credentials and the callback URL', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ status: true })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        const email = 'test@example.com';
        const callbackURL = 'https://hospeda.test/es/sumate/partner/';
        await resendVerificationEmail({ email, callbackURL });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            'http://localhost:3001/api/auth/send-verification-email'
        );
        expect(fetchMock.mock.calls[0]?.[1]).toEqual({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, callbackURL })
        });
        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
            email,
            callbackURL
        });
    });
});

describe('forgetPassword', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('propagates `code` and `status` from a non-ok JSON response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            json: async () => ({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests' })
        }) as unknown as typeof fetch;

        const result = await forgetPassword({
            email: 'test@example.com',
            redirectTo: '/es/auth/reset-password/'
        });

        expect(result.error).toMatchObject({ code: 'TOO_MANY_REQUESTS', status: 429 });
    });

    it('sets `status: 0` and no `code` when the fetch throws (network error)', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

        const result = await forgetPassword({
            email: 'test@example.com',
            redirectTo: '/es/auth/reset-password/'
        });

        expect(result.error).toMatchObject({ status: 0 });
        expect(result.error?.code).toBeUndefined();
    });

    it('returns data with no error on a successful response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ status: true })
        }) as unknown as typeof fetch;

        const result = await forgetPassword({
            email: 'test@example.com',
            redirectTo: '/es/auth/reset-password/'
        });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ status: true });
    });
});

describe('resetPassword', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('propagates `code` and `status` from a non-ok JSON response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ code: 'INVALID_TOKEN', message: 'Invalid or expired token' })
        }) as unknown as typeof fetch;

        const result = await resetPassword({ newPassword: 'NewPass123!', token: 'bad-token' });

        expect(result.error).toMatchObject({ code: 'INVALID_TOKEN', status: 400 });
    });

    it('sets `status: 0` and no `code` when the fetch throws (network error)', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

        const result = await resetPassword({ newPassword: 'NewPass123!', token: 'some-token' });

        expect(result.error).toMatchObject({ status: 0 });
        expect(result.error?.code).toBeUndefined();
    });

    it('returns data with no error on a successful response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ status: true })
        }) as unknown as typeof fetch;

        const result = await resetPassword({ newPassword: 'NewPass123!', token: 'good-token' });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ status: true });
    });
});

describe('verifyEmail', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('propagates `code` and `status` from a non-ok JSON response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ code: 'INVALID_TOKEN', message: 'Verification failed' })
        }) as unknown as typeof fetch;

        const result = await verifyEmail({ token: 'bad-token' });

        expect(result.error).toMatchObject({ code: 'INVALID_TOKEN', status: 400 });
    });

    it('sets `status: 0` and no `code` when the fetch throws (network error)', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

        const result = await verifyEmail({ token: 'some-token' });

        expect(result.error).toMatchObject({ status: 0 });
        expect(result.error?.code).toBeUndefined();
    });

    it('returns data with no error on a successful response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ status: true })
        }) as unknown as typeof fetch;

        const result = await verifyEmail({ token: 'good-token' });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ status: true });
    });
});
