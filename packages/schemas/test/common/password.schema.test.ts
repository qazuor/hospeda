import { describe, expect, test } from 'vitest';
import { ZodError } from 'zod';
import { StrongPasswordRegex, StrongPasswordSchema } from '../../src/common/password.schema.js';

describe('StrongPasswordRegex', () => {
    describe('when password meets all requirements', () => {
        test('should match a valid strong password', () => {
            expect(StrongPasswordRegex.test('SecureP@ss1')).toBe(true);
        });

        test('should match minimum-length valid password (8 chars)', () => {
            expect(StrongPasswordRegex.test('Aa1@bcde')).toBe(true);
        });

        test('should match password with multiple special characters', () => {
            expect(StrongPasswordRegex.test('My!P@ss1Word$')).toBe(true);
        });

        test('should match password with all allowed special chars', () => {
            const specialChars = ['@', '$', '!', '%', '*', '?', '&'];
            for (const ch of specialChars) {
                expect(StrongPasswordRegex.test(`Abcdef1${ch}`)).toBe(true);
            }
        });
    });

    describe('when password is missing required character class', () => {
        test('should not match password without uppercase letter', () => {
            expect(StrongPasswordRegex.test('noupperc@se1')).toBe(false);
        });

        test('should not match password without lowercase letter', () => {
            expect(StrongPasswordRegex.test('NOLOWER1@S')).toBe(false);
        });

        test('should not match password without digit', () => {
            expect(StrongPasswordRegex.test('NoDigits!@AB')).toBe(false);
        });

        test('should not match password without special character', () => {
            expect(StrongPasswordRegex.test('NoSpecial1AB')).toBe(false);
        });
    });

    describe('when password is too short', () => {
        test('should not match password with fewer than 8 characters', () => {
            expect(StrongPasswordRegex.test('Aa1@bcd')).toBe(false);
        });

        test('should not match empty string', () => {
            expect(StrongPasswordRegex.test('')).toBe(false);
        });
    });
});

describe('StrongPasswordSchema', () => {
    describe('when given valid strong passwords', () => {
        test('should accept a standard strong password', () => {
            // Arrange
            const input = 'SecureP@ss1';

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(input);
            }
        });

        test('should accept minimum-length valid password (8 chars)', () => {
            // Arrange
            const input = 'Aa1@bcde';

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        test('should accept a long strong password (127 chars)', () => {
            // Arrange
            const base = 'Aa1@';
            const padding = 'a'.repeat(123);
            const input = base + padding; // 127 chars

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        test('should accept password with all allowed special characters', () => {
            const validPasswords = [
                'Valid@Pass1',
                'Valid$Pass1',
                'Valid!Pass1',
                'Valid%Pass1',
                'Valid*Pass1',
                'Valid?Pass1',
                'Valid&Pass1'
            ];

            for (const password of validPasswords) {
                const result = StrongPasswordSchema.safeParse(password);
                expect(result.success).toBe(true);
            }
        });
    });

    describe('when password is too short', () => {
        test('should reject password with fewer than 8 characters', () => {
            // Arrange
            const input = 'Aa1@bcd';

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const codes = result.error.issues.map((i) => i.message);
                expect(codes).toContain('zodError.common.password.min');
            }
        });

        test('should reject empty string', () => {
            // Arrange
            const input = '';

            // Act & Assert
            expect(() => StrongPasswordSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('when password exceeds maximum length', () => {
        test('should reject password longer than 128 characters', () => {
            // Arrange
            const input = `Aa1@${'a'.repeat(125)}`; // 129 chars

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const messages = result.error.issues.map((i) => i.message);
                expect(messages).toContain('zodError.common.password.max');
            }
        });
    });

    describe('when password is missing a required character class', () => {
        test('should reject password without uppercase letter', () => {
            // Arrange
            const input = 'nouppercase1@';

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const messages = result.error.issues.map((i) => i.message);
                expect(messages).toContain('zodError.common.password.pattern');
            }
        });

        test('should reject password without lowercase letter', () => {
            // Arrange
            const input = 'NOLOWERCASE1@';

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        test('should reject password without digit', () => {
            // Arrange
            const input = 'NoDigitsHere!@';

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        test('should reject password without special character', () => {
            // Arrange
            const input = 'NoSpecialChar1AB';

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when input is not a string', () => {
        test('should reject null', () => {
            // Act & Assert
            expect(() => StrongPasswordSchema.parse(null)).toThrow(ZodError);
        });

        test('should reject undefined', () => {
            // Act & Assert
            expect(() => StrongPasswordSchema.parse(undefined)).toThrow(ZodError);
        });

        test('should reject number', () => {
            // Act & Assert
            expect(() => StrongPasswordSchema.parse(12345678)).toThrow(ZodError);
        });
    });

    describe('boundary conditions', () => {
        test('should accept password of exactly 8 characters meeting all rules', () => {
            // Arrange
            const input = 'Aa1@bcde'; // exactly 8

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        test('should accept password of exactly 128 characters', () => {
            // Arrange
            const base = 'Aa1@';
            const input = base + 'a'.repeat(124); // exactly 128

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        test('should reject password of exactly 7 characters', () => {
            // Arrange
            const input = 'Aa1@bcd'; // 7 chars

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        test('should reject password of exactly 129 characters', () => {
            // Arrange
            const input = `Aa1@${'a'.repeat(125)}`; // 129 chars

            // Act
            const result = StrongPasswordSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
