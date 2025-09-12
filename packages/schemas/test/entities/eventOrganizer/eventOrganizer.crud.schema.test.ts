import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    EventOrganizerCreateInputSchema,
    EventOrganizerCreateOutputSchema,
    EventOrganizerDeleteInputSchema,
    EventOrganizerDeleteOutputSchema,
    EventOrganizerRestoreInputSchema,
    EventOrganizerRestoreOutputSchema,
    EventOrganizerUpdateInputSchema,
    EventOrganizerUpdateOutputSchema
} from '../../../src/entities/eventOrganizer/eventOrganizer.crud.schema.js';
import {
    createMinimalEventOrganizerCreateInput,
    createPartialEventOrganizerUpdateInput,
    createValidEventOrganizer,
    createValidEventOrganizerCreateInput,
    createValidEventOrganizerUpdateInput
} from '../../fixtures/eventOrganizer.fixtures.js';

describe('EventOrganizer CRUD Schemas', () => {
    describe('EventOrganizerCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = createValidEventOrganizerCreateInput();

            expect(() => EventOrganizerCreateInputSchema.parse(validInput)).not.toThrow();

            const result = EventOrganizerCreateInputSchema.parse(validInput);
            expect(result.name).toBeDefined();
            expect('id' in result).toBe(false); // Should be omitted
            expect('createdAt' in result).toBe(false); // Should be omitted
        });

        it('should reject create input with auto-generated fields', () => {
            const validData = createValidEventOrganizer();

            // Should reject with id field
            expect(() => EventOrganizerCreateInputSchema.parse(validData)).toThrow(ZodError);
        });

        it('should validate minimal create input', () => {
            const minimalInput = createMinimalEventOrganizerCreateInput();

            expect(() => EventOrganizerCreateInputSchema.parse(minimalInput)).not.toThrow();

            const result = EventOrganizerCreateInputSchema.parse(minimalInput);
            expect(result.name).toBeDefined();
        });

        it('should reject create input with invalid name', () => {
            const invalidInput = {
                name: 'AB' // Too short
            };

            expect(() => EventOrganizerCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject create input with invalid description', () => {
            const invalidInput = {
                name: faker.company.name(),
                description: 'Short' // Too short
            };

            expect(() => EventOrganizerCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject create input with invalid logo URL', () => {
            const invalidInput = {
                name: faker.company.name(),
                logo: 'not-a-url'
            };

            expect(() => EventOrganizerCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('EventOrganizerCreateOutputSchema', () => {
        it('should validate create output', () => {
            const createOutput = createValidEventOrganizer();

            expect(() => EventOrganizerCreateOutputSchema.parse(createOutput)).not.toThrow();

            const result = EventOrganizerCreateOutputSchema.parse(createOutput);
            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.createdAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });
    });

    describe('EventOrganizerUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const updateInput = createValidEventOrganizerUpdateInput();

            expect(() => EventOrganizerUpdateInputSchema.parse(updateInput)).not.toThrow();

            const result = EventOrganizerUpdateInputSchema.parse(updateInput);
            expect(result.name).toBeDefined();
        });

        it('should validate empty update input', () => {
            const emptyUpdate = {};

            expect(() => EventOrganizerUpdateInputSchema.parse(emptyUpdate)).not.toThrow();
        });

        it('should validate partial update input', () => {
            const partialUpdate = createPartialEventOrganizerUpdateInput();

            expect(() => EventOrganizerUpdateInputSchema.parse(partialUpdate)).not.toThrow();

            const result = EventOrganizerUpdateInputSchema.parse(partialUpdate);
            expect(result.name).toBeDefined();
        });

        it('should reject update input with auto-generated fields', () => {
            const updateData = {
                name: faker.company.name(),
                id: faker.string.uuid(),
                createdAt: new Date()
            };

            expect(() => EventOrganizerUpdateInputSchema.parse(updateData)).toThrow(ZodError);
        });

        it('should reject update input with invalid name', () => {
            const invalidUpdate = {
                name: 'AB' // Too short
            };

            expect(() => EventOrganizerUpdateInputSchema.parse(invalidUpdate)).toThrow(ZodError);
        });

        it('should reject update input with invalid description', () => {
            const invalidUpdate = {
                description: 'Short' // Too short
            };

            expect(() => EventOrganizerUpdateInputSchema.parse(invalidUpdate)).toThrow(ZodError);
        });
    });

    describe('EventOrganizerUpdateOutputSchema', () => {
        it('should validate update output', () => {
            const updateOutput = createValidEventOrganizer();

            expect(() => EventOrganizerUpdateOutputSchema.parse(updateOutput)).not.toThrow();

            const result = EventOrganizerUpdateOutputSchema.parse(updateOutput);
            expect(result.id).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });
    });

    describe('EventOrganizerDeleteInputSchema', () => {
        it('should validate delete input with ID only', () => {
            const deleteData = {
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => EventOrganizerDeleteInputSchema.parse(deleteData)).not.toThrow();

            const result = EventOrganizerDeleteInputSchema.parse(deleteData);
            expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.force).toBe(false); // Default value
        });

        it('should validate delete input with force flag', () => {
            const deleteData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                force: true
            };

            expect(() => EventOrganizerDeleteInputSchema.parse(deleteData)).not.toThrow();

            const result = EventOrganizerDeleteInputSchema.parse(deleteData);
            expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.force).toBe(true);
        });

        it('should reject delete input without ID', () => {
            const deleteData = {
                force: true
            };

            expect(() => EventOrganizerDeleteInputSchema.parse(deleteData)).toThrow(ZodError);
        });

        it('should reject delete input with invalid force type', () => {
            const deleteData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                force: 'invalid'
            };

            expect(() => EventOrganizerDeleteInputSchema.parse(deleteData)).toThrow(ZodError);
        });

        it('should reject delete input with invalid ID format', () => {
            const deleteData = {
                id: 'invalid-uuid'
            };

            expect(() => EventOrganizerDeleteInputSchema.parse(deleteData)).toThrow(ZodError);
        });
    });

    describe('EventOrganizerDeleteOutputSchema', () => {
        it('should validate delete output with success only', () => {
            const deleteOutput = {
                success: true
            };

            expect(() => EventOrganizerDeleteOutputSchema.parse(deleteOutput)).not.toThrow();

            const result = EventOrganizerDeleteOutputSchema.parse(deleteOutput);
            expect(result.success).toBe(true);
        });

        it('should validate delete output with deletedAt', () => {
            const deleteOutput = {
                success: true,
                deletedAt: new Date()
            };

            expect(() => EventOrganizerDeleteOutputSchema.parse(deleteOutput)).not.toThrow();

            const result = EventOrganizerDeleteOutputSchema.parse(deleteOutput);
            expect(result.success).toBe(true);
            expect(result.deletedAt).toBeInstanceOf(Date);
        });

        it('should use default success value', () => {
            const deleteOutput = {};

            expect(() => EventOrganizerDeleteOutputSchema.parse(deleteOutput)).not.toThrow();

            const result = EventOrganizerDeleteOutputSchema.parse(deleteOutput);
            expect(result.success).toBe(true); // Default value
        });
    });

    describe('EventOrganizerRestoreInputSchema', () => {
        it('should validate restore input', () => {
            const restoreData = {
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => EventOrganizerRestoreInputSchema.parse(restoreData)).not.toThrow();

            const result = EventOrganizerRestoreInputSchema.parse(restoreData);
            expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should reject restore input without ID', () => {
            const restoreData = {};

            expect(() => EventOrganizerRestoreInputSchema.parse(restoreData)).toThrow(ZodError);
        });

        it('should reject restore input with invalid ID format', () => {
            const restoreData = {
                id: 'invalid-uuid'
            };

            expect(() => EventOrganizerRestoreInputSchema.parse(restoreData)).toThrow(ZodError);
        });
    });

    describe('EventOrganizerRestoreOutputSchema', () => {
        it('should validate restore output', () => {
            const restoreOutput = {
                success: true,
                restoredAt: new Date()
            };

            expect(() => EventOrganizerRestoreOutputSchema.parse(restoreOutput)).not.toThrow();

            const result = EventOrganizerRestoreOutputSchema.parse(restoreOutput);
            expect(result.success).toBe(true);
            expect(result.restoredAt).toBeInstanceOf(Date);
        });

        it('should validate restore output with success only', () => {
            const restoreOutput = {
                success: true
            };

            expect(() => EventOrganizerRestoreOutputSchema.parse(restoreOutput)).not.toThrow();
        });

        it('should use default success value', () => {
            const restoreOutput = {};

            expect(() => EventOrganizerRestoreOutputSchema.parse(restoreOutput)).not.toThrow();

            const result = EventOrganizerRestoreOutputSchema.parse(restoreOutput);
            expect(result.success).toBe(true); // Default value
        });
    });
});
