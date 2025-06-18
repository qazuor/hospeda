/**
 * validation.test.ts
 *
 * Tests for validation util functions.
 */

import { describe, expect, it } from 'vitest';
import * as validation from '../../src/utils/validation';
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
        const result = validation.validateInput(validSchema, validInput, context);
        expect(result).toEqual(validInput);
    });

    it('throws ServiceError for invalid input', () => {
        expect(() => validation.validateInput(validSchema, invalidInput, context)).toThrowError(
            /validation failed/
        );
    });

    it('validates actor when present', () => {
        expect(() => validation.validateActor(validActor)).not.toThrow();
    });

    it('throws ServiceError if actor is missing', () => {
        expect(() => validation.validateActor(invalidActor)).toThrowError(/Actor is required/);
    });

    it('validates entity when present', () => {
        const result = validation.validateEntity(validEntity, 'Entity');
        expect(result).toEqual(validEntity);
    });

    it('throws ServiceError if entity is null', () => {
        expect(() => validation.validateEntity(invalidEntity, 'Entity')).toThrowError(/not found/);
    });
});
