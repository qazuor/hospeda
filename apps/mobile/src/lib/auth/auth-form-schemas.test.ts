/**
 * @file auth-form-schemas.test.ts
 * @description Unit tests for auth form Zod schemas (AAA pattern).
 *
 * Environment: node (no React Native runtime needed — pure schema logic).
 *
 * Coverage:
 * - signInFormSchema: valid, invalid email, empty email, empty password
 * - signUpFormSchema: valid, invalid email, short password, weak password,
 *   mismatched confirm, empty firstName
 * - getFieldError: extracts first issue per field
 */

import { describe, expect, it } from 'vitest';
import { getFieldError, signInFormSchema, signUpFormSchema } from './auth-form-schemas';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_SIGN_IN = { email: 'user@example.com', password: 'Secret1!' };

const VALID_SIGN_UP = {
    firstName: 'Alice',
    email: 'alice@example.com',
    password: 'SecureP@ss1',
    confirmPassword: 'SecureP@ss1'
};

// ---------------------------------------------------------------------------
// signInFormSchema
// ---------------------------------------------------------------------------

describe('signInFormSchema', () => {
    describe('valid input', () => {
        it('parses a valid email + password pair', () => {
            // Arrange + Act
            const result = signInFormSchema.safeParse(VALID_SIGN_IN);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('user@example.com');
                expect(result.data.password).toBe('Secret1!');
            }
        });
    });

    describe('email validation', () => {
        it('fails when email is empty — key: emailRequired', () => {
            // Arrange
            const input = { ...VALID_SIGN_IN, email: '' };

            // Act
            const result = signInFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'email');
                expect(key).toBe('auth-ui.signIn.errors.emailRequired');
            }
        });

        it('fails when email has no @ character — key: invalidEmail', () => {
            // Arrange
            const input = { ...VALID_SIGN_IN, email: 'notanemail' };

            // Act
            const result = signInFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'email');
                expect(key).toBe('auth-ui.signIn.errors.invalidEmail');
            }
        });

        it('fails when email has domain but no TLD — key: invalidEmail', () => {
            // Arrange
            const input = { ...VALID_SIGN_IN, email: 'user@domain' };

            // Act
            const result = signInFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'email');
                expect(key).toBe('auth-ui.signIn.errors.invalidEmail');
            }
        });
    });

    describe('password validation', () => {
        it('fails when password is empty — key: passwordRequired', () => {
            // Arrange
            const input = { ...VALID_SIGN_IN, password: '' };

            // Act
            const result = signInFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'password');
                expect(key).toBe('auth-ui.signIn.errors.passwordRequired');
            }
        });
    });
});

// ---------------------------------------------------------------------------
// signUpFormSchema
// ---------------------------------------------------------------------------

describe('signUpFormSchema', () => {
    describe('valid input', () => {
        it('parses a complete valid sign-up payload', () => {
            // Arrange + Act
            const result = signUpFormSchema.safeParse(VALID_SIGN_UP);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.firstName).toBe('Alice');
                expect(result.data.email).toBe('alice@example.com');
                expect(result.data.password).toBe('SecureP@ss1');
            }
        });
    });

    describe('firstName validation', () => {
        it('fails when firstName is empty — key: firstNameRequired', () => {
            // Arrange
            const input = { ...VALID_SIGN_UP, firstName: '' };

            // Act
            const result = signUpFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'firstName');
                expect(key).toBe('auth-ui.signUp.errors.firstNameRequired');
            }
        });
    });

    describe('email validation', () => {
        it('fails when email is empty — key: emailRequired', () => {
            // Arrange
            const input = { ...VALID_SIGN_UP, email: '' };

            // Act
            const result = signUpFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'email');
                expect(key).toBe('auth-ui.signUp.errors.emailRequired');
            }
        });

        it('fails when email is invalid — key: invalidEmail', () => {
            // Arrange
            const input = { ...VALID_SIGN_UP, email: 'bademail' };

            // Act
            const result = signUpFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'email');
                expect(key).toBe('auth-ui.signUp.errors.invalidEmail');
            }
        });
    });

    describe('password strength validation', () => {
        it('fails when password is too short (< 8 chars) — key: passwordTooShort', () => {
            // Arrange — 7 chars with upper+lower+digit+special still fails min(8)
            const input = { ...VALID_SIGN_UP, password: 'Ab1!xyz', confirmPassword: 'Ab1!xyz' };

            // Act
            const result = signUpFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'password');
                // passwordTooShort fires before weakPassword (min is checked first)
                expect(key).toBe('auth-ui.signUp.errors.passwordTooShort');
            }
        });

        it('fails when password has no uppercase — key: weakPassword', () => {
            // Arrange — meets length, has digits and special but no uppercase
            const input = {
                ...VALID_SIGN_UP,
                password: 'secret1!abc',
                confirmPassword: 'secret1!abc'
            };

            // Act
            const result = signUpFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'password');
                expect(key).toBe('auth-ui.signUp.errors.weakPassword');
            }
        });

        it('fails when password has no digit — key: weakPassword', () => {
            // Arrange
            const input = {
                ...VALID_SIGN_UP,
                password: 'SecretPass!',
                confirmPassword: 'SecretPass!'
            };

            // Act
            const result = signUpFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'password');
                expect(key).toBe('auth-ui.signUp.errors.weakPassword');
            }
        });

        it('fails when password has no special character — key: weakPassword', () => {
            // Arrange
            const input = {
                ...VALID_SIGN_UP,
                password: 'SecretPass1',
                confirmPassword: 'SecretPass1'
            };

            // Act
            const result = signUpFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'password');
                expect(key).toBe('auth-ui.signUp.errors.weakPassword');
            }
        });

        it('accepts a strong password with all required character classes', () => {
            // Arrange — exactly meets all requirements
            const input = {
                ...VALID_SIGN_UP,
                password: 'Strong@1',
                confirmPassword: 'Strong@1'
            };

            // Act
            const result = signUpFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('confirmPassword validation', () => {
        it('fails when confirmPassword does not match password — key: passwordsDoNotMatch', () => {
            // Arrange
            const input = {
                ...VALID_SIGN_UP,
                password: 'SecureP@ss1',
                confirmPassword: 'Different@1'
            };

            // Act
            const result = signUpFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const key = getFieldError(result.error.issues, 'confirmPassword');
                expect(key).toBe('auth-ui.signUp.errors.passwordsDoNotMatch');
            }
        });

        it('passes when confirmPassword exactly matches password', () => {
            // Arrange
            const input = {
                ...VALID_SIGN_UP,
                password: 'Match@Pass1',
                confirmPassword: 'Match@Pass1'
            };

            // Act
            const result = signUpFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// getFieldError
// ---------------------------------------------------------------------------

describe('getFieldError', () => {
    it('returns the message of the first issue for the given field', () => {
        // Arrange
        const result = signInFormSchema.safeParse({ email: '', password: '' });
        expect(result.success).toBe(false);

        // Act
        if (!result.success) {
            const key = getFieldError(result.error.issues, 'email');

            // Assert
            expect(key).toBe('auth-ui.signIn.errors.emailRequired');
        }
    });

    it('returns undefined when no issue exists for the given field', () => {
        // Arrange
        const result = signInFormSchema.safeParse({ email: '', password: 'pass' });
        expect(result.success).toBe(false);

        // Act
        if (!result.success) {
            const key = getFieldError(result.error.issues, 'password');

            // Assert — password is non-empty so has no issue
            expect(key).toBeUndefined();
        }
    });
});
