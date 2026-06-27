/**
 * @file auth-errors.test.ts
 * @description Unit tests for Better Auth error -> i18n key mapping.
 *
 * Regression coverage for SPEC-243 T-004: Better Auth client methods resolve
 * with `{ data, error }` (they do NOT throw), and the error carries a typed
 * `code`. Mapping must be code-driven, not message string-matching.
 */
import { describe, expect, it } from 'vitest';
import { mapSignInError, mapSignUpError } from './auth-errors';

describe('mapSignInError', () => {
    it('maps INVALID_EMAIL_OR_PASSWORD code to invalidCredentials', () => {
        // Arrange
        const error = { code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 };
        // Act
        const key = mapSignInError(error);
        // Assert
        expect(key).toBe('auth-ui.signIn.errors.invalidCredentials');
    });

    it('maps a bare 401 status (no code) to invalidCredentials', () => {
        expect(mapSignInError({ status: 401 })).toBe('auth-ui.signIn.errors.invalidCredentials');
    });

    it('maps INVALID_EMAIL code to invalidEmail', () => {
        expect(mapSignInError({ code: 'INVALID_EMAIL', status: 400 })).toBe(
            'auth-ui.signIn.errors.invalidEmail'
        );
    });

    it('is case-insensitive on the error code', () => {
        expect(mapSignInError({ code: 'invalid_email_or_password' })).toBe(
            'auth-ui.signIn.errors.invalidCredentials'
        );
    });

    it('falls back to unknownError for an unrecognized code', () => {
        expect(mapSignInError({ code: 'SOMETHING_ELSE', status: 500 })).toBe(
            'auth-ui.signIn.errors.unknownError'
        );
    });

    it('falls back to unknownError for null / undefined / empty error', () => {
        expect(mapSignInError(null)).toBe('auth-ui.signIn.errors.unknownError');
        expect(mapSignInError(undefined)).toBe('auth-ui.signIn.errors.unknownError');
        expect(mapSignInError({})).toBe('auth-ui.signIn.errors.unknownError');
    });
});

describe('mapSignUpError', () => {
    it('maps USER_ALREADY_EXISTS code to emailAlreadyExists', () => {
        // Arrange
        const error = { code: 'USER_ALREADY_EXISTS', status: 422 };
        // Act
        const key = mapSignUpError(error);
        // Assert
        expect(key).toBe('auth-ui.signUp.errors.emailAlreadyExists');
    });

    it('maps any PASSWORD_* code to weakPassword', () => {
        expect(mapSignUpError({ code: 'PASSWORD_TOO_SHORT' })).toBe(
            'auth-ui.signUp.errors.weakPassword'
        );
        expect(mapSignUpError({ code: 'PASSWORD_TOO_LONG' })).toBe(
            'auth-ui.signUp.errors.weakPassword'
        );
    });

    it('maps INVALID_EMAIL code to invalidEmail', () => {
        expect(mapSignUpError({ code: 'INVALID_EMAIL' })).toBe(
            'auth-ui.signUp.errors.invalidEmail'
        );
    });

    it('falls back to unknownError for an unrecognized code', () => {
        expect(mapSignUpError({ code: 'WEIRD', status: 500 })).toBe(
            'auth-ui.signUp.errors.unknownError'
        );
    });

    it('falls back to unknownError for null / undefined / empty error', () => {
        expect(mapSignUpError(null)).toBe('auth-ui.signUp.errors.unknownError');
        expect(mapSignUpError(undefined)).toBe('auth-ui.signUp.errors.unknownError');
        expect(mapSignUpError({})).toBe('auth-ui.signUp.errors.unknownError');
    });
});
