/**
 * @file field-errors.test.ts
 * @description Unit tests for `zodIssuesToFieldErrors` and `apiErrorToFieldErrors`
 * (HOS-190 slice 2 — shared form-validation primitive).
 */

import { describe, expect, it } from 'vitest';
import type { TranslationFn } from '@/lib/api-errors';
import {
    apiErrorToFieldErrors,
    type ZodIssueLike,
    zodIssuesToFieldErrors
} from '@/lib/forms/field-errors';

describe('zodIssuesToFieldErrors', () => {
    it('maps a flat-path issue to its raw message when no `t` is given', () => {
        const issues: ZodIssueLike[] = [
            { path: ['email'], message: 'zodError.contact.email.invalid' }
        ];

        const errors = zodIssuesToFieldErrors(issues);

        expect(errors).toEqual({ email: 'zodError.contact.email.invalid' });
    });

    it('joins nested paths with a dot (supports nested schemas)', () => {
        const issues: ZodIssueLike[] = [
            {
                path: ['contactInfo', 'mobilePhone'],
                message: 'zodError.contactInfo.mobilePhone.invalid'
            }
        ];

        const errors = zodIssuesToFieldErrors(issues);

        expect(errors).toEqual({
            'contactInfo.mobilePhone': 'zodError.contactInfo.mobilePhone.invalid'
        });
    });

    it('joins deeply nested and array-index paths', () => {
        const issues: ZodIssueLike[] = [
            { path: ['stops', 0, 'name'], message: 'zodError.stops.name.required' }
        ];

        const errors = zodIssuesToFieldErrors(issues);

        expect(errors).toEqual({ 'stops.0.name': 'zodError.stops.name.required' });
    });

    it('keeps only the first issue per field', () => {
        const issues: ZodIssueLike[] = [
            { path: ['email'], message: 'first.key' },
            { path: ['email'], message: 'second.key' }
        ];

        const errors = zodIssuesToFieldErrors(issues);

        expect(errors).toEqual({ email: 'first.key' });
    });

    it('skips issues with an empty path', () => {
        const issues: ZodIssueLike[] = [{ path: [], message: 'form-level issue' }];

        const errors = zodIssuesToFieldErrors(issues);

        expect(errors).toEqual({});
    });

    it('resolves via `t` and forwards the `min` interpolation param when provided', () => {
        const t: TranslationFn = (key, fallback, params) =>
            key === 'validation.contact.firstName.min'
                ? `El nombre debe tener al menos ${params?.min} caracteres`
                : (fallback ?? `[MISSING: ${key}]`);

        const issues: ZodIssueLike[] = [
            { path: ['firstName'], message: 'zodError.contact.firstName.min', minimum: 2 }
        ];

        const errors = zodIssuesToFieldErrors(issues, t);

        expect(errors.firstName).toBe('El nombre debe tener al menos 2 caracteres');
    });

    it('resolves via `t` and forwards the `max` interpolation param when provided', () => {
        const t: TranslationFn = (key, fallback, params) =>
            key === 'validation.contact.message.max'
                ? `Máximo ${params?.max} caracteres`
                : (fallback ?? `[MISSING: ${key}]`);

        const issues: ZodIssueLike[] = [
            { path: ['message'], message: 'zodError.contact.message.max', maximum: 2000 }
        ];

        const errors = zodIssuesToFieldErrors(issues, t);

        expect(errors.message).toBe('Máximo 2000 caracteres');
    });

    it('falls back to the original key when `t` has no translation for it', () => {
        const t: TranslationFn = () => '[MISSING: whatever]';

        const issues: ZodIssueLike[] = [
            { path: ['email'], message: 'zodError.contact.email.invalid' }
        ];

        const errors = zodIssuesToFieldErrors(issues, t);

        expect(errors.email).toBe('zodError.contact.email.invalid');
    });

    it('returns {} for an empty issues array', () => {
        expect(zodIssuesToFieldErrors([])).toEqual({});
    });
});

describe('apiErrorToFieldErrors', () => {
    it('returns {} when the error is null/undefined', () => {
        expect(apiErrorToFieldErrors(null)).toEqual({});
        expect(apiErrorToFieldErrors(undefined)).toEqual({});
    });

    it('returns {} when `details` is absent (the common production ServiceError case)', () => {
        expect(apiErrorToFieldErrors({ details: undefined })).toEqual({});
        expect(apiErrorToFieldErrors({})).toEqual({});
    });

    it('returns {} when `details` is not an array (e.g. a flattened ZodError object)', () => {
        expect(apiErrorToFieldErrors({ details: { fieldErrors: {}, formErrors: [] } })).toEqual({});
    });

    it('maps the route-factory defaultHook shape ({ field, messageKey })', () => {
        const errors = apiErrorToFieldErrors({
            details: [
                {
                    field: 'firstName',
                    messageKey: 'validationError.field.tooSmall',
                    code: 'TOO_SMALL'
                },
                {
                    field: 'email',
                    messageKey: 'validationError.field.invalidEmail',
                    code: 'INVALID_STRING'
                }
            ]
        });

        expect(errors).toEqual({
            firstName: 'validationError.field.tooSmall',
            email: 'validationError.field.invalidEmail'
        });
    });

    it('maps a generic Zod-issue-like shape ({ path, message })', () => {
        const errors = apiErrorToFieldErrors({
            details: [{ path: ['contactInfo', 'mobilePhone'], message: 'Invalid phone number' }]
        });

        expect(errors).toEqual({ 'contactInfo.mobilePhone': 'Invalid phone number' });
    });

    it('prefers `field`/`messageKey` over `path`/`message` when both are present', () => {
        const errors = apiErrorToFieldErrors({
            details: [
                {
                    field: 'email',
                    messageKey: 'validationError.field.invalidEmail',
                    path: ['email'],
                    message: 'raw zod message'
                }
            ]
        });

        expect(errors.email).toBe('validationError.field.invalidEmail');
    });

    it('skips entries with no resolvable field or message', () => {
        const errors = apiErrorToFieldErrors({
            details: [{ code: 'SOMETHING' }, null, 'not-an-object', { field: 'email' }]
        });

        expect(errors).toEqual({});
    });

    it('keeps only the first detail per field', () => {
        const errors = apiErrorToFieldErrors({
            details: [
                { field: 'email', message: 'first' },
                { field: 'email', message: 'second' }
            ]
        });

        expect(errors).toEqual({ email: 'first' });
    });
});
