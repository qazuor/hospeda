/**
 * validation.test.ts
 *
 * Tests for validation util functions.
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
                `${context} validation failed: Expected string, received number`
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
