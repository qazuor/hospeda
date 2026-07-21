/**
 * @file api-errors.test.ts
 * @description Unit tests for `translateApiError`.
 */

import { describe, expect, it } from 'vitest';
import { isRetryableApiError, translateApiError } from '../../src/lib/api-errors';

describe('translateApiError', () => {
    it('returns the localized message for a known error code', () => {
        const message = translateApiError({
            error: { code: 'UNAUTHORIZED', message: 'You need to sign in.' },
            locale: 'es'
        });
        expect(message).toBe('Necesitás iniciar sesión para realizar esta acción.');
    });

    it('prefers `reason` over `code` when a translation exists for both', () => {
        const message = translateApiError({
            error: {
                code: 'SERVICE_UNAVAILABLE',
                reason: 'NEWSLETTER_NOT_CONFIGURED',
                message: 'Newsletter not configured.'
            },
            locale: 'es'
        });
        expect(message).toMatch(/newsletter no está disponible/i);
    });

    // BETA-194: the plan-change 409 carries reason SUBSCRIPTION_CANCEL_PENDING
    // (code ALREADY_EXISTS) and must resolve to the specific localized copy, not
    // the generic "already exists" text.
    it('maps SUBSCRIPTION_CANCEL_PENDING (reason) to the specific message per locale', () => {
        const es = translateApiError({
            error: {
                status: 409,
                code: 'ALREADY_EXISTS',
                reason: 'SUBSCRIPTION_CANCEL_PENDING',
                message: 'Subscription is scheduled to cancel at period end.'
            },
            locale: 'es'
        });
        expect(es).toMatch(/programada para cancelarse/i);
        expect(es).not.toMatch(/ya existe/i);

        const en = translateApiError({
            error: { reason: 'SUBSCRIPTION_CANCEL_PENDING', message: 'x' },
            locale: 'en'
        });
        expect(en).toMatch(/scheduled to cancel/i);

        const pt = translateApiError({
            error: { reason: 'SUBSCRIPTION_CANCEL_PENDING', message: 'x' },
            locale: 'pt'
        });
        expect(pt).toMatch(/programada para ser cancelada/i);
    });

    it('falls back to `code` when the `reason` is unknown', () => {
        const message = translateApiError({
            error: {
                code: 'SERVICE_UNAVAILABLE',
                reason: 'SOMETHING_VERY_OBSCURE',
                message: 'Service unavailable.'
            },
            locale: 'es'
        });
        expect(message).toMatch(/servicio no está disponible/i);
    });

    it('falls back to the API `message` when no translation exists for the code', () => {
        const message = translateApiError({
            error: { code: 'UNKNOWN_CODE_FROM_API', message: 'Specific English message' },
            locale: 'es'
        });
        expect(message).toBe('Specific English message');
    });

    it('falls back to the generic localized message when error is null', () => {
        const message = translateApiError({ error: null, locale: 'es' });
        expect(message).toBe('Algo salió mal. Intentá de nuevo en un momento.');
    });

    it('uses the caller-provided fallback when no code or message is available', () => {
        const message = translateApiError({
            error: {},
            locale: 'es',
            fallback: 'Algo específico'
        });
        expect(message).toBe('Algo específico');
    });

    it('works without a translation context (returns raw or fallback)', () => {
        const message = translateApiError({
            error: { code: 'UNKNOWN', message: 'Raw API msg' },
            fallback: 'fb'
        });
        expect(message).toBe('Raw API msg');
    });

    // Better Auth credential error (INVALID_EMAIL_OR_PASSWORD)
    describe('Better Auth credential errors', () => {
        it('translates INVALID_EMAIL_OR_PASSWORD to Spanish', () => {
            const message = translateApiError({
                error: {
                    code: 'INVALID_EMAIL_OR_PASSWORD',
                    message: 'Invalid email or password'
                },
                locale: 'es'
            });
            expect(message).toBe('El correo electrónico o la contraseña son incorrectos.');
        });

        it('translates INVALID_EMAIL_OR_PASSWORD to English', () => {
            const message = translateApiError({
                error: {
                    code: 'INVALID_EMAIL_OR_PASSWORD',
                    message: 'Invalid email or password'
                },
                locale: 'en'
            });
            expect(message).toBe('The email address or password is incorrect.');
        });

        it('translates INVALID_EMAIL_OR_PASSWORD to Portuguese', () => {
            const message = translateApiError({
                error: {
                    code: 'INVALID_EMAIL_OR_PASSWORD',
                    message: 'Invalid email or password'
                },
                locale: 'pt'
            });
            expect(message).toBe('O endereço de e-mail ou a senha estão incorretos.');
        });

        it('translates ACCOUNT_LOCKED (brute-force lockout) to Spanish', () => {
            const message = translateApiError({
                error: {
                    code: 'ACCOUNT_LOCKED',
                    message:
                        'Too many failed login attempts. Please try again in 5 minutes or use password reset.'
                },
                locale: 'es'
            });
            expect(message).toMatch(/bloqueada temporalmente/i);
        });

        it('translates ACCOUNT_LOCKED to English', () => {
            const message = translateApiError({
                error: {
                    code: 'ACCOUNT_LOCKED',
                    message:
                        'Too many failed login attempts. Please try again in 5 minutes or use password reset.'
                },
                locale: 'en'
            });
            expect(message).toMatch(/temporarily locked/i);
        });

        it('translates ACCOUNT_LOCKED to Portuguese', () => {
            const message = translateApiError({
                error: {
                    code: 'ACCOUNT_LOCKED',
                    message:
                        'Too many failed login attempts. Please try again in 5 minutes or use password reset.'
                },
                locale: 'pt'
            });
            expect(message).toMatch(/temporariamente bloqueada/i);
        });

        it('does not leak the raw English "Invalid email or password" message in es locale', () => {
            const message = translateApiError({
                error: {
                    code: 'INVALID_EMAIL_OR_PASSWORD',
                    message: 'Invalid email or password'
                },
                locale: 'es'
            });
            // Must not fall back to the raw English string.
            expect(message).not.toBe('Invalid email or password');
        });
    });

    // BETA-146: failure modes that arrive WITHOUT a machine-readable code but
    // carry an HTTP status (client timeout, network/offline, raw rate-limit).
    describe('status-based fallback (BETA-146)', () => {
        it('maps a network failure (status 0, no code) to the network message', () => {
            const message = translateApiError({
                error: { status: 0, message: 'Network error' },
                locale: 'es'
            });
            expect(message).toBe('No pudimos conectar con el servidor. Probá de nuevo.');
        });

        it('maps a client-side timeout (status 408, no code) to the timeout message', () => {
            const message = translateApiError({
                error: { status: 408, message: 'Request timeout after 8000ms' },
                locale: 'es'
            });
            expect(message).toBe('La solicitud tardó demasiado. Probá de nuevo.');
        });

        it('does not leak the raw English message for a code-less timeout', () => {
            const message = translateApiError({
                error: { status: 408, message: 'Request timeout after 8000ms' },
                locale: 'es'
            });
            expect(message).not.toMatch(/Request timeout/);
        });

        it('maps a raw rate-limit (status 429, no code) to the rate-limit message', () => {
            const message = translateApiError({
                error: { status: 429, message: 'API request failed with status 429' },
                locale: 'es'
            });
            expect(message).toBe(
                'Demasiadas solicitudes. Esperá unos segundos y volvé a intentar.'
            );
        });

        it('maps the timeout status in English too', () => {
            const message = translateApiError({
                error: { status: 408, message: 'Request timeout' },
                locale: 'en'
            });
            expect(message).toBe('The request took too long. Please try again.');
        });

        it('prefers an explicit code over the status mapping', () => {
            const message = translateApiError({
                error: {
                    status: 503,
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Service unavailable.'
                },
                locale: 'es'
            });
            expect(message).toMatch(/servicio no está disponible/i);
        });

        it('falls through to the raw/generic message for an unmapped code-less status', () => {
            // 500 is intentionally NOT mapped (minimal policy) → keeps prior behaviour.
            const message = translateApiError({
                error: { status: 500, message: 'API request failed with status 500' },
                locale: 'es'
            });
            expect(message).toBe('API request failed with status 500');
        });
    });
});

// BETA-194 / BETA-195: a "Retry" affordance must appear only for TRANSIENT
// failures. Non-transitory 4xx business rejections (409/422/403/...) are
// deterministically doomed and must NOT offer retry.
describe('isRetryableApiError', () => {
    it('is NOT retryable for non-transitory 4xx rejections', () => {
        for (const status of [400, 403, 404, 409, 422]) {
            expect(isRetryableApiError({ status })).toBe(false);
        }
    });

    it('IS retryable for transient failures (network, timeout, rate-limit, 5xx)', () => {
        for (const status of [0, 408, 429, 500, 502, 503]) {
            expect(isRetryableApiError({ status })).toBe(true);
        }
    });

    it('treats an absent/undefined status as transient (retry is the safe default)', () => {
        expect(isRetryableApiError(null)).toBe(true);
        expect(isRetryableApiError(undefined)).toBe(true);
        expect(isRetryableApiError({})).toBe(true);
    });
});
