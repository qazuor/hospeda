/**
 * @fileoverview
 * Test suite for validation utility functions (validateInput, validateActor, validateEntity).
 * Ensures robust, type-safe, and comprehensive coverage of input, actor, and entity validation logic, including:
 * - Success and failure cases for all validation utilities
 * - Error handling and custom context messages
 * - Edge cases and non-Zod error propagation
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */

import { ServiceErrorCode } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ServiceError } from '../../src/types';
import { validateActor, validateEntity, validateInput } from '../../src/utils/validation';
import '../setupTest';
import {
    context,
    invalidActor,
    invalidEntity,
    invalidInput,
    validActor,
    validEntity,
    validInput,
    validSchema
} from './validation.mockData';

/**
 * Test suite for validation utility functions.
 *
 * Esta suite verifica:
 * - Correct validation and error handling for input, actor, and entity
 * - Custom context messages and edge case propagation
 *
 * The tests use valid and invalid data to ensure all validation logic is covered.
 */
describe('validation util', () => {
    it('validates input with valid schema', () => {
        const result = validateInput(validSchema, validInput, context);
        expect(result).toEqual(validInput);
    });

    it('throws ServiceError for invalid input', () => {
        expect(() => validateInput(validSchema, invalidInput, context)).toThrowError(
            /validation failed/
        );
    });

    it('validates actor when present', () => {
        expect(() => validateActor(validActor)).not.toThrow();
    });

    it('throws ServiceError if actor is missing', () => {
        expect(() => validateActor(invalidActor)).toThrowError(/Actor is required/);
    });

    it('validates entity when present', () => {
        const result = validateEntity(validEntity, 'Entity');
        expect(result).toEqual(validEntity);
    });

    it('throws ServiceError if entity is null', () => {
        expect(() => validateEntity(invalidEntity, 'Entity')).toThrowError(/not found/);
    });

    it('should throw a ServiceError with a custom context message on validation failure', () => {
        const context = 'test context';
        const testSchema = z.object({ name: z.string() });
        expect(() => validateInput(testSchema, { name: 123 }, context)).toThrow(
            new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `${context} validation failed: expected string, received number`
            )
        );
    });

    it('should re-throw non-Zod errors', () => {
        const mockError = new Error('A generic error');
        const schemaWithSideEffect = z.string().refine(() => {
            throw mockError;
        });

        expect(() => validateInput(schemaWithSideEffect, 'any string', 'test')).toThrow(mockError);
    });
});
