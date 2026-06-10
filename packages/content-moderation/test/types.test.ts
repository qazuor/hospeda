import { describe, expect, it } from 'vitest';
import { moderateTextInputSchema } from '../src/types';

describe('moderateTextInputSchema', () => {
    describe('valid inputs', () => {
        it('should accept a plain text string without context', () => {
            // Arrange
            const input = { text: 'This is a perfectly fine review.' };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.text).toBe('This is a perfectly fine review.');
                expect(result.data.context).toBeUndefined();
            }
        });

        it('should accept text with context set to "review"', () => {
            // Arrange
            const input = { text: 'Great place to stay!', context: 'review' };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.context).toBe('review');
            }
        });

        it('should accept text with context set to "message"', () => {
            // Arrange
            const input = { text: 'Hello, is the room available?', context: 'message' };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept text with context set to "post"', () => {
            // Arrange
            const input = { text: 'Top 10 places in the Litoral region.', context: 'post' };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept text with an arbitrary future context string', () => {
            // Arrange
            const input = { text: 'Some bio text.', context: 'bio' };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.context).toBe('bio');
            }
        });

        it('should accept a single-character text string', () => {
            // Arrange
            const input = { text: 'A' };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a very long text string', () => {
            // Arrange
            const input = { text: 'a'.repeat(10_000) };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('invalid inputs — text field', () => {
        it('should reject an empty string for text', () => {
            // Arrange
            const input = { text: '' };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const textIssue = result.error.issues.find((issue) => issue.path[0] === 'text');
                expect(textIssue).toBeDefined();
            }
        });

        it('should reject a missing text field', () => {
            // Arrange
            const input = {};

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a numeric value for text', () => {
            // Arrange
            const input = { text: 42 };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject null for text', () => {
            // Arrange
            const input = { text: null };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject undefined for text when explicitly passed', () => {
            // Arrange
            const input = { text: undefined };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an array for text', () => {
            // Arrange
            const input = { text: ['hello'] };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('invalid inputs — context field', () => {
        it('should reject a numeric value for context', () => {
            // Arrange
            const input = { text: 'Valid text', context: 123 };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject null for context', () => {
            // Arrange
            const input = { text: 'Valid text', context: null };

            // Act
            const result = moderateTextInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('parse (throwing) mode', () => {
        it('should return the parsed data on success', () => {
            // Arrange + Act
            const data = moderateTextInputSchema.parse({ text: 'hello', context: 'review' });

            // Assert
            expect(data.text).toBe('hello');
            expect(data.context).toBe('review');
        });

        it('should throw ZodError on invalid input', () => {
            // Arrange + Act + Assert
            expect(() => moderateTextInputSchema.parse({ text: '' })).toThrow();
        });
    });
});
