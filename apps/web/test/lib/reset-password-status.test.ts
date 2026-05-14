/**
 * @file reset-password-status.test.ts
 * @description Unit tests for the SSR helper that decides what the
 * reset-password page renders (SPEC-118).
 *
 * The Astro page itself can't be rendered in Vitest, so all the branching
 * logic was extracted to `resolveResetPasswordTokenStatus` and is tested
 * here. Four branches are covered:
 * - missing token → invalid/invalid (no API call)
 * - check returns valid:true → valid
 * - check returns valid:false (expired or invalid) → invalid + reason
 * - check transport error → degrade to valid + logger.warn
 */

import { describe, expect, it, vi } from 'vitest';
import {
    type ResetPasswordChecker,
    type ResetPasswordStatusLogger,
    resolveResetPasswordTokenStatus
} from '../../src/lib/reset-password-status';

const buildOkChecker = (
    payload: { valid: true } | { valid: false; reason: 'expired' | 'invalid' }
): ResetPasswordChecker => {
    return vi.fn().mockResolvedValue({ ok: true, data: payload });
};

const buildErrorChecker = (): ResetPasswordChecker => {
    return vi.fn().mockResolvedValue({
        ok: false,
        error: { status: 503, message: 'Service Unavailable' }
    });
};

const buildLoggerSpy = (): ResetPasswordStatusLogger & { warn: ReturnType<typeof vi.fn> } => ({
    warn: vi.fn()
});

describe('resolveResetPasswordTokenStatus (SPEC-118)', () => {
    it('returns invalid/invalid when the token is an empty string, without calling the API', async () => {
        const check = vi.fn();

        const result = await resolveResetPasswordTokenStatus({
            token: '',
            check: check as unknown as ResetPasswordChecker
        });

        expect(result).toEqual({ kind: 'invalid', reason: 'invalid' });
        expect(check).not.toHaveBeenCalled();
    });

    it('returns valid when the API reports valid:true', async () => {
        const check = buildOkChecker({ valid: true });

        const result = await resolveResetPasswordTokenStatus({ token: 'good-token', check });

        expect(result).toEqual({ kind: 'valid' });
        expect(check).toHaveBeenCalledWith({ token: 'good-token' });
    });

    it('returns invalid + reason:expired when the API reports the token expired', async () => {
        const check = buildOkChecker({ valid: false, reason: 'expired' });

        const result = await resolveResetPasswordTokenStatus({ token: 'old-token', check });

        expect(result).toEqual({ kind: 'invalid', reason: 'expired' });
    });

    it('returns invalid + reason:invalid when the API reports the token invalid', async () => {
        const check = buildOkChecker({ valid: false, reason: 'invalid' });

        const result = await resolveResetPasswordTokenStatus({ token: 'tampered-token', check });

        expect(result).toEqual({ kind: 'invalid', reason: 'invalid' });
    });

    it('degrades to valid (form fallback) and logs a warning on transport error', async () => {
        const check = buildErrorChecker();
        const logger = buildLoggerSpy();

        const result = await resolveResetPasswordTokenStatus({
            token: 'any-token',
            check,
            logger
        });

        expect(result).toEqual({ kind: 'valid' });
        expect(logger.warn).toHaveBeenCalledTimes(1);
        const [message, payload] = logger.warn.mock.calls[0];
        expect(message).toMatch(/token check failed/);
        expect(payload).toMatchObject({ status: 503, message: 'Service Unavailable' });
    });

    it('does not require a logger; transport error path stays silent', async () => {
        const check = buildErrorChecker();

        const result = await resolveResetPasswordTokenStatus({ token: 'any-token', check });

        expect(result).toEqual({ kind: 'valid' });
    });
});
