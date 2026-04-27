/**
 * Tests for ServiceError.reason field (SPEC-085 T-004).
 *
 * Verifies that the optional fourth constructor argument is:
 *   1. Stored on the instance as `reason`.
 *   2. Absent (undefined) when not provided.
 *   3. Independent of the first three positional args (no regression).
 */

import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ServiceError } from '../../src/types/index.ts';

describe('ServiceError.reason', () => {
    describe('constructor with reason', () => {
        it('stores reason when provided as fourth argument', () => {
            // Arrange
            const code = ServiceErrorCode.FORBIDDEN;
            const message = 'Anonymous email not yet verified';
            const details = { field: 'anonymousEmail' };
            const reason = 'ANONYMOUS_EMAIL_NOT_VERIFIED';

            // Act
            const error = new ServiceError(code, message, details, reason);

            // Assert
            expect(error.reason).toBe('ANONYMOUS_EMAIL_NOT_VERIFIED');
        });

        it('stores code, message and details unchanged when reason is provided', () => {
            // Arrange
            const code = ServiceErrorCode.NOT_FOUND;
            const message = 'Conversation not found';
            const details = { id: 'some-uuid' };
            const reason = 'CONVERSATION_MISSING';

            // Act
            const error = new ServiceError(code, message, details, reason);

            // Assert
            expect(error.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(error.message).toBe('Conversation not found');
            expect(error.details).toEqual({ id: 'some-uuid' });
        });

        it('is a real Error instance with correct name', () => {
            // Arrange & Act
            const error = new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Something went wrong',
                undefined,
                'SOME_REASON'
            );

            // Assert
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(ServiceError);
            expect(error.name).toBe('ServiceError');
        });
    });

    describe('constructor without reason', () => {
        it('reason is undefined when only three args are provided', () => {
            // Arrange & Act
            const error = new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid input', {
                field: 'email'
            });

            // Assert
            expect(error.reason).toBeUndefined();
        });

        it('reason is undefined when only two args are provided', () => {
            // Arrange & Act
            const error = new ServiceError(ServiceErrorCode.NOT_FOUND, 'Not found');

            // Assert
            expect(error.reason).toBeUndefined();
        });

        it('reason is undefined when explicitly passed as undefined', () => {
            // Arrange & Act
            const error = new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Forbidden',
                undefined,
                undefined
            );

            // Assert
            expect(error.reason).toBeUndefined();
        });

        it('code, message and details are preserved without reason', () => {
            // Arrange
            const details = { extra: 'context' };

            // Act
            const error = new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Already exists',
                details
            );

            // Assert
            expect(error.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(error.message).toBe('Already exists');
            expect(error.details).toBe(details);
        });
    });

    describe('readonly constraint', () => {
        it('reason property is readonly (TypeScript enforcement — runtime typeof check)', () => {
            // Arrange
            const error = new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'msg',
                undefined,
                'MY_REASON'
            );

            // Act — TypeScript would catch mutation at compile-time; here we verify the value
            // is accessible and stable as a primitive string.
            const { reason } = error;

            // Assert
            expect(typeof reason).toBe('string');
            expect(reason).toBe('MY_REASON');
        });
    });
});
