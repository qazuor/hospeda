import { ServiceErrorCode } from '@repo/types';
import { z } from 'zod';
import { ServiceError } from '../types';

/**
 * Validates untrusted input data against a provided Zod schema.
 * If validation fails, it transforms the ZodError into a structured ServiceError.
 *
 * @template T The expected type of the validated data.
 * @param schema The Zod schema to use for validation.
 * @param input The unknown input data to validate.
 * @param context A string describing the context of the validation (e.g., 'create accommodation input'), used for error messages.
 * @returns The validated data, conforming to type T.
 * @throws {ServiceError} Throws a `VALIDATION_ERROR` if the input does not conform to the schema.
 */
export const validateInput = <T>(schema: z.ZodType<T>, input: unknown, context: string): T => {
    try {
        return schema.parse(input);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.issues
                .map((e) => e.message.replace(/^Invalid input: /, ''))
                .join(', ');
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `${context} validation failed: ${errorMessages}`
            );
        }
        throw error;
    }
};

/**
 * Ensures that an actor object is provided.
 * This is a fundamental check to ensure that every service operation is performed
 * on behalf of an authenticated and identifiable user or system.
 *
 * @param actor The actor object to validate.
 * @throws {ServiceError} Throws an `UNAUTHORIZED` error if the actor is null or undefined.
 */
export const validateActor = (actor: unknown): void => {
    if (!actor) {
        throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
    }
};

/**
 * Ensures that a fetched entity exists (is not null or undefined).
 * This is a common check after a database query to handle "not found" cases gracefully.
 *
 * @template T The type of the entity.
 * @param entity The entity object to check, which may be null.
 * @param entityName The name of the entity (e.g., 'Accommodation'), used for clear error messages.
 * @returns The non-null entity.
 * @throws {ServiceError} Throws a `NOT_FOUND` error if the entity is null or undefined.
 */
export const validateEntity = <T>(entity: T | null, entityName: string): T => {
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `${entityName} not found`);
    }
    return entity;
};
