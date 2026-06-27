/**
 * @file translate-api-error.test.ts
 * @description Unit tests for `translateApiError` (moved to `@repo/i18n`).
 *
 * Ported from `apps/web/test/lib/api-errors.test.ts` and extended with:
 *   (a) locale-only path (no `t` function supplied)
 *   (b) missing-reason branch coverage
 *   (c) Better Auth credential error codes
 *
 * All tests follow the AAA (Arrange-Act-Assert) pattern.
 */

import { describe, expect, it } from 'vitest';
import { translateApiError } from '../src/api-errors';

// ─── Ported from apps/web/test/lib/api-errors.test.ts ──────────────────────

describe('translateApiError', () => {
    it('returns the localized message for a known error code (locale path)', () => {
        // Arrange
        const error = { code: 'UNAUTHORIZED', message: 'You need to sign in.' };

        // Act
        const message = translateApiError({ error, locale: 'es' });

        // Assert
        expect(message).toBe('Necesitás iniciar sesión para realizar esta acción.');
    });

    it('prefers `reason` over `code` when a translation exists for both', () => {
        // Arrange
        const error = {
            code: 'SERVICE_UNAVAILABLE',
            reason: 'NEWSLETTER_NOT_CONFIGURED',
            message: 'Newsletter not configured.'
        };

        // Act
        const message = translateApiError({ error, locale: 'es' });

        // Assert
        expect(message).toMatch(/newsletter no está disponible/i);
    });

    it('falls back to `code` when the `reason` is unknown', () => {
        // Arrange
        const error = {
            code: 'SERVICE_UNAVAILABLE',
            reason: 'SOMETHING_VERY_OBSCURE',
            message: 'Service unavailable.'
        };

        // Act
        const message = translateApiError({ error, locale: 'es' });

        // Assert
        expect(message).toMatch(/servicio no está disponible/i);
    });

    it('falls back to the API `message` when no translation exists for the code', () => {
        // Arrange
        const error = { code: 'UNKNOWN_CODE_FROM_API', message: 'Specific English message' };

        // Act
        const message = translateApiError({ error, locale: 'es' });

        // Assert
        expect(message).toBe('Specific English message');
    });

    it('falls back to the generic localized message when error is null', () => {
        // Arrange / Act
        const message = translateApiError({ error: null, locale: 'es' });

        // Assert
        expect(message).toBe('Algo salió mal. Intentá de nuevo en un momento.');
    });

    it('uses the caller-provided fallback when no code or message is available', () => {
        // Arrange
        const error = {};

        // Act
        const message = translateApiError({ error, locale: 'es', fallback: 'Algo específico' });

        // Assert
        expect(message).toBe('Algo específico');
    });

    it('works without a translation context (returns raw or fallback)', () => {
        // Arrange
        const error = { code: 'UNKNOWN', message: 'Raw API msg' };

        // Act — no `t` and no `locale`
        const message = translateApiError({ error, fallback: 'fb' });

        // Assert
        expect(message).toBe('Raw API msg');
    });

    // ─── Better Auth credential errors ────────────────────────────────────

    describe('Better Auth credential errors', () => {
        it('translates INVALID_EMAIL_OR_PASSWORD to Spanish', () => {
            // Arrange
            const error = {
                code: 'INVALID_EMAIL_OR_PASSWORD',
                message: 'Invalid email or password'
            };

            // Act
            const message = translateApiError({ error, locale: 'es' });

            // Assert
            expect(message).toBe('El correo electrónico o la contraseña son incorrectos.');
        });

        it('translates INVALID_EMAIL_OR_PASSWORD to English', () => {
            // Arrange
            const error = {
                code: 'INVALID_EMAIL_OR_PASSWORD',
                message: 'Invalid email or password'
            };

            // Act
            const message = translateApiError({ error, locale: 'en' });

            // Assert
            expect(message).toBe('The email address or password is incorrect.');
        });

        it('translates INVALID_EMAIL_OR_PASSWORD to Portuguese', () => {
            // Arrange
            const error = {
                code: 'INVALID_EMAIL_OR_PASSWORD',
                message: 'Invalid email or password'
            };

            // Act
            const message = translateApiError({ error, locale: 'pt' });

            // Assert
            expect(message).toBe('O endereço de e-mail ou a senha estão incorretos.');
        });

        it('translates ACCOUNT_LOCKED (brute-force lockout) to Spanish', () => {
            // Arrange
            const error = {
                code: 'ACCOUNT_LOCKED',
                message:
                    'Too many failed login attempts. Please try again in 5 minutes or use password reset.'
            };

            // Act
            const message = translateApiError({ error, locale: 'es' });

            // Assert
            expect(message).toMatch(/bloqueada temporalmente/i);
        });

        it('translates ACCOUNT_LOCKED to English', () => {
            // Arrange
            const error = {
                code: 'ACCOUNT_LOCKED',
                message:
                    'Too many failed login attempts. Please try again in 5 minutes or use password reset.'
            };

            // Act
            const message = translateApiError({ error, locale: 'en' });

            // Assert
            expect(message).toMatch(/temporarily locked/i);
        });

        it('translates ACCOUNT_LOCKED to Portuguese', () => {
            // Arrange
            const error = {
                code: 'ACCOUNT_LOCKED',
                message:
                    'Too many failed login attempts. Please try again in 5 minutes or use password reset.'
            };

            // Act
            const message = translateApiError({ error, locale: 'pt' });

            // Assert
            expect(message).toMatch(/temporariamente bloqueada/i);
        });

        it('does not leak the raw English "Invalid email or password" message in es locale', () => {
            // Arrange
            const error = {
                code: 'INVALID_EMAIL_OR_PASSWORD',
                message: 'Invalid email or password'
            };

            // Act
            const message = translateApiError({ error, locale: 'es' });

            // Assert — must never show the raw English string
            expect(message).not.toBe('Invalid email or password');
        });
    });

    // ─── Extended: locale-only path (no `t` supplied) ─────────────────────

    describe('locale-only path (no t function)', () => {
        it('resolves NOT_FOUND in Spanish using trans map directly', () => {
            // Arrange
            const error = { code: 'NOT_FOUND' };

            // Act
            const message = translateApiError({ error, locale: 'es' });

            // Assert
            expect(message).toBe('No encontramos lo que buscabas.');
        });

        it('resolves NOT_FOUND in English using trans map directly', () => {
            // Arrange
            const error = { code: 'NOT_FOUND' };

            // Act
            const message = translateApiError({ error, locale: 'en' });

            // Assert — actual EN copy: "We couldn't find what you were looking for."
            expect(message).toMatch(/couldn't find/i);
        });

        it('resolves NOT_FOUND in Portuguese using trans map directly', () => {
            // Arrange
            const error = { code: 'NOT_FOUND' };

            // Act
            const message = translateApiError({ error, locale: 'pt' });

            // Assert
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
        });

        it('falls through to code when reason is missing from trans map', () => {
            // Arrange
            const error = {
                code: 'FORBIDDEN',
                reason: 'REASON_THAT_DOES_NOT_EXIST',
                message: ''
            };

            // Act
            const message = translateApiError({ error, locale: 'es' });

            // Assert — should use the FORBIDDEN translation, not the unknown reason
            expect(message).toMatch(/permiso/i);
        });
    });

    // ─── Extended: missing-reason branch ──────────────────────────────────

    describe('missing-reason branch', () => {
        it('does not break when reason is null', () => {
            // Arrange
            const error = { code: 'INTERNAL_ERROR', reason: null, message: 'Server error' };

            // Act
            const message = translateApiError({ error, locale: 'es' });

            // Assert — null reason is ignored, falls to code
            expect(message.length).toBeGreaterThan(0);
            // Should use INTERNAL_ERROR translation, not raw message
            expect(message).not.toBe('Server error');
        });

        it('does not break when reason is undefined', () => {
            // Arrange — no reason field at all
            const error = { code: 'INTERNAL_ERROR', message: 'Server error' };

            // Act
            const message = translateApiError({ error, locale: 'es' });

            // Assert — no reason → falls to code
            expect(message.length).toBeGreaterThan(0);
            expect(message).not.toBe('Server error');
        });

        it('does not break when error is undefined', () => {
            // Arrange / Act
            const message = translateApiError({ error: undefined, locale: 'es' });

            // Assert — undefined error → returns generic
            expect(message).toBe('Algo salió mal. Intentá de nuevo en un momento.');
        });
    });

    // ─── Extended: t-function path ─────────────────────────────────────────

    describe('t-function path', () => {
        it('uses the caller-provided t function for translation lookup', () => {
            // Arrange — simulate a t function that knows one key
            const t = (key: string, fb?: string): string => {
                const dict: Record<string, string> = {
                    'common.apiError.UNAUTHORIZED': 'Custom unauthorized text'
                };
                return dict[key] ?? fb ?? `[MISSING: ${key}]`;
            };

            // Act
            const message = translateApiError({
                error: { code: 'UNAUTHORIZED' },
                t
            });

            // Assert
            expect(message).toBe('Custom unauthorized text');
        });

        it('falls back through priority chain when t returns [MISSING:] for reason', () => {
            // Arrange — t only knows FORBIDDEN, not the obscure reason
            const t = (key: string, fb?: string): string => {
                if (key === 'common.apiError.FORBIDDEN') return 'Forbidden translation';
                if (fb !== undefined) return fb;
                return `[MISSING: ${key}]`;
            };

            // Act
            const message = translateApiError({
                error: {
                    code: 'FORBIDDEN',
                    reason: 'OBSCURE_REASON',
                    message: 'You cannot do that'
                },
                t
            });

            // Assert — reason is missing, should fall to code
            expect(message).toBe('Forbidden translation');
        });
    });
});
