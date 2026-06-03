/**
 * @file ProfileEditForm.helpers.test.ts
 * @description Regression tests for parseZodErrors localization (BETA-39).
 *
 * BETA-39: the Edit Profile form showed raw i18n keys
 * (e.g. "zodError.user.profile.displayName.min") instead of localized
 * validation messages, because the schema stores i18n KEYS in each Zod issue's
 * `message` and parseZodErrors passed them through untranslated. The fix routes
 * every key through resolveValidationMessage (zodError.* → validation.*) with
 * min/max interpolation params. These tests lock that in.
 */

import { describe, expect, it } from 'vitest';
import { parseZodErrors } from '../../../src/components/account/ProfileEditForm.helpers';

describe('parseZodErrors localization (BETA-39)', () => {
    it('resolves a zodError.* key to a localized message, not the raw key', () => {
        const t = (key: string, params?: Record<string, unknown>): string =>
            key === 'validation.user.profile.displayName.min'
                ? `El nombre visible debe tener al menos ${params?.min} caracteres`
                : `[MISSING: ${key}]`;

        const errors = parseZodErrors(
            [
                {
                    path: ['displayName'],
                    message: 'zodError.user.profile.displayName.min',
                    minimum: 1
                }
            ],
            t
        );

        expect(errors.displayName).toBe('El nombre visible debe tener al menos 1 caracteres');
        // Regression: the user must never see the raw i18n key.
        expect(errors.displayName).not.toContain('zodError');
    });

    it('forwards the max interpolation param for too_big issues', () => {
        const t = (key: string, params?: Record<string, unknown>): string =>
            key === 'validation.user.profile.bio.max'
                ? `Máximo ${params?.max} caracteres`
                : `[MISSING: ${key}]`;

        const errors = parseZodErrors(
            [{ path: ['bio'], message: 'zodError.user.profile.bio.max', maximum: 1000 }],
            t
        );

        expect(errors.bio).toBe('Máximo 1000 caracteres');
    });

    it('falls back to the original key when the translation is missing', () => {
        const t = (key: string): string => `[MISSING: ${key}]`;

        const errors = parseZodErrors(
            [
                {
                    path: ['firstName'],
                    message: 'zodError.user.profile.firstName.min',
                    minimum: 1
                }
            ],
            t
        );

        // resolveValidationMessage returns the original key (not [MISSING: ...])
        // so the caller always gets a non-empty value.
        expect(errors.firstName).toBe('zodError.user.profile.firstName.min');
    });

    it('keeps only the first error per field', () => {
        const t = (key: string): string => key;

        const errors = parseZodErrors(
            [
                { path: ['displayName'], message: 'first.key' },
                { path: ['displayName'], message: 'second.key' }
            ],
            t
        );

        expect(errors.displayName).toBe('first.key');
    });
});
