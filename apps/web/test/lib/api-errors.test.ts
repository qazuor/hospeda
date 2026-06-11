/**
 * @file api-errors.test.ts
 * @description Unit tests for `translateApiError`.
 */

import { describe, expect, it } from 'vitest';
import { translateApiError } from '../../src/lib/api-errors';

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
});
