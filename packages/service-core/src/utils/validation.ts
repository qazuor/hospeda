import { ServiceErrorCode } from '@repo/types';
import { z } from 'zod';
import { ServiceError } from '../types';

/**
 * Validates input data against a Zod schema.
 * @template T - The type of the input data
 * @param {z.ZodType<T>} schema - The Zod schema to validate against
 * @param {unknown} input - The input data to validate
 * @param {string} context - The context for error messages
 * @returns {T} The validated input data
 * @throws {ServiceError} If validation fails
 */
export const validateInput = <T>(schema: z.ZodType<T>, input: unknown, context: string): T => {
    try {
        return schema.parse(input);
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `${context} validation failed: ${error.errors.map((e) => e.message).join(', ')}`
            );
        }
        throw error;
    }
};

/**
 * Validates that an actor is provided.
 * @param {unknown} actor - The actor to validate
 * @returns {void}
 * @throws {ServiceError} If actor is not provided
 */
export const validateActor = (actor: unknown): void => {
    if (!actor) {
        throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
    }
};

/**
 * Validates that an entity exists.
 * @template T - The type of the entity
 * @param {T | null} entity - The entity to validate
 * @param {string} entityName - The name of the entity for error messages
 * @returns {T} The validated entity
 * @throws {ServiceError} If entity is null
 */
export const validateEntity = <T>(entity: T | null, entityName: string): T => {
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `${entityName} not found`);
    }
    return entity;
};
