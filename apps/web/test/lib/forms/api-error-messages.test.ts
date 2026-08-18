/**
 * @file api-error-messages.test.ts
 * @description Regression suite for H-29 (smoke agosto 2026): the web carried
 * the SAME shape as the admin's H-27 bug — `apiErrorToFieldErrors` returned the
 * `zodError.*` key the API reports and its only caller stored it straight into
 * `fieldErrors`, with nobody in between calling `resolveValidationMessage`.
 *
 * It was invisible in production only because the four forms that path serves
 * hit routes throwing `ServiceError`, whose `details` are gated behind
 * `HOSPEDA_API_DEBUG_ERRORS` (forced `false` in production). Any form pointed
 * at a route wired with the route factory's `requestBody` DOES receive
 * `details`, and would have rendered a bare `zodError.contact.firstName.min`
 * next to the field. Configuration was hiding it, not correctness.
 *
 * Drives the real dictionaries via `createT`, like
 * `ContactForm.error-messages.test.tsx`.
 */

import { describe, expect, it } from 'vitest';
import { apiErrorToFieldErrors } from '@/lib/forms/field-errors';
import { createT } from '@/lib/i18n';

/** Matches an i18n key that reached the UI unresolved. */
const RAW_KEY_RE = /^(zodError|validationError|validation)\./;

/** The `details` array the route factory's `defaultHook` sends on a 400. */
const CONTACT_400_DETAILS = [
    {
        field: 'firstName',
        messageKey: 'zodError.contact.firstName.min',
        code: 'TOO_SMALL',
        zodMessage: 'zodError.contact.firstName.min',
        userFriendlyMessage: 'First name is required'
    },
    {
        field: 'email',
        messageKey: 'validationError.field.invalidEmail',
        code: 'INVALID_EMAIL',
        zodMessage: 'Invalid email',
        userFriendlyMessage: 'Email must be a valid email'
    }
];

describe('apiErrorToFieldErrors — message resolution (H-29)', () => {
    it('returns raw keys when no `t` is given, so the function stays pure', () => {
        // Arrange + Act
        const errors = apiErrorToFieldErrors({ details: CONTACT_400_DETAILS });

        // Assert — unchanged contract for callers that resolve themselves
        expect(errors.firstName).toBe('zodError.contact.firstName.min');
    });

    it('resolves every key to its localized message when `t` is given', () => {
        // Arrange + Act
        const errors = apiErrorToFieldErrors({ details: CONTACT_400_DETAILS }, createT('es'));

        // Assert
        expect(errors.firstName).toBe('El nombre es obligatorio');
        expect(errors.email).toBe('Debe ser un email válido');
    });

    it('leaks no raw key in any locale', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            // Arrange + Act
            const errors = apiErrorToFieldErrors({ details: CONTACT_400_DETAILS }, createT(locale));

            // Assert
            expect(Object.keys(errors)).toHaveLength(CONTACT_400_DETAILS.length);
            for (const [field, message] of Object.entries(errors)) {
                expect(message, `${locale}/${field}`).not.toMatch(RAW_KEY_RE);
                expect(message, `${locale}/${field}`).not.toMatch(/^\[MISSING:/);
            }
        }
    });

    it('interpolates the bound the API sent in `params`', () => {
        // Arrange
        const details = [
            {
                field: 'contactInfo.mobilePhone',
                messageKey: 'zodError.contact.message.min',
                code: 'TOO_SMALL',
                params: { min: 10 }
            }
        ];

        // Act
        const errors = apiErrorToFieldErrors({ details }, createT('es'));

        // Assert
        expect(errors['contactInfo.mobilePhone'] ?? '').toContain('10');
        expect(errors['contactInfo.mobilePhone'] ?? '').not.toContain('{{min}}');
    });

    it('keeps the untranslatable message the API sent rather than showing a key', () => {
        // Arrange — a key present in no locale
        const details = [
            {
                field: 'firstName',
                messageKey: 'zodError.contact.firstName.thisKeyDoesNotExist',
                code: 'CUSTOM_VALIDATION_ERROR',
                userFriendlyMessage: 'First name is not acceptable'
            }
        ];

        // Act
        const errors = apiErrorToFieldErrors({ details }, createT('es'));

        // Assert
        expect(errors.firstName).toBe('First name is not acceptable');
    });
});
