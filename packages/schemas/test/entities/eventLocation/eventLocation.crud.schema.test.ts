import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    EventLocationCreateInputSchema,
    EventLocationCreateOutputSchema,
    EventLocationDeleteInputSchema,
    EventLocationDeleteOutputSchema,
    EventLocationRestoreInputSchema,
    EventLocationRestoreOutputSchema,
    EventLocationUpdateInputSchema,
    EventLocationUpdateOutputSchema
} from '../../../src/entities/eventLocation/eventLocation.crud.schema.js';
import {
    createMinimalEventLocation,
    createValidEventLocation
} from '../../fixtures/eventLocation.fixtures.js';

describe('EventLocation CRUD Schemas', () => {
    describe('EventLocationCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validData = createValidEventLocation();
            // Remove auto-generated fields for create input
            const {
                id,
                createdAt,
                updatedAt,
                createdById,
                updatedById,
                deletedAt,
                deletedById,
                ...createData
            } = validData;

            expect(() => EventLocationCreateInputSchema.parse(createData)).not.toThrow();

            const result = EventLocationCreateInputSchema.parse(createData);
            expect(result).toBeDefined();
            expect(result.state).toBe(createData.state);
            expect(result.country).toBe(createData.country);
        });

        it('should reject create input with auto-generated fields', () => {
            const validData = createValidEventLocation();

            // Should reject with id field
            expect(() => EventLocationCreateInputSchema.parse(validData)).toThrow(ZodError);
        });

        it('should validate minimal create input', () => {
            const minimalData = createMinimalEventLocation();
            const {
                id,
                createdAt,
                updatedAt,
                createdById,
                updatedById,
                deletedAt,
                deletedById,
                ...createData
            } = minimalData;

            expect(() => EventLocationCreateInputSchema.parse(createData)).not.toThrow();
        });
    });

    describe('EventLocationCreateOutputSchema', () => {
        it('should validate create output', () => {
            const validData = createValidEventLocation();

            expect(() => EventLocationCreateOutputSchema.parse(validData)).not.toThrow();

            const result = EventLocationCreateOutputSchema.parse(validData);
            expect(result.id).toBeDefined();
            expect(result.createdAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });
    });

    describe('EventLocationUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const validData = createValidEventLocation();
            // Remove auto-generated fields and make partial for update
            const {
                id,
                createdAt,
                updatedAt,
                createdById,
                updatedById,
                deletedAt,
                deletedById,
                ...baseData
            } = validData;
            const updateData = {
                street: baseData.street,
                city: baseData.city,
                placeName: baseData.placeName
            };

            expect(() => EventLocationUpdateInputSchema.parse(updateData)).not.toThrow();

            const result = EventLocationUpdateInputSchema.parse(updateData);
            expect(result.street).toBe(updateData.street);
            expect(result.city).toBe(updateData.city);
            expect(result.placeName).toBe(updateData.placeName);
        });

        it('should validate empty update input', () => {
            const updateData = {};

            expect(() => EventLocationUpdateInputSchema.parse(updateData)).not.toThrow();
        });

        it('should validate partial update input', () => {
            const updateData = {
                street: 'Updated Street',
                city: 'Updated City'
            };

            expect(() => EventLocationUpdateInputSchema.parse(updateData)).not.toThrow();

            const result = EventLocationUpdateInputSchema.parse(updateData);
            expect(result.street).toBe('Updated Street');
            expect(result.city).toBe('Updated City');
        });

        it('should reject update input with auto-generated fields', () => {
            const updateData = {
                id: 'some-id',
                street: 'Updated Street'
            };

            expect(() => EventLocationUpdateInputSchema.parse(updateData)).toThrow(ZodError);
        });
    });

    describe('EventLocationUpdateOutputSchema', () => {
        it('should validate update output', () => {
            const validData = createValidEventLocation();

            expect(() => EventLocationUpdateOutputSchema.parse(validData)).not.toThrow();

            const result = EventLocationUpdateOutputSchema.parse(validData);
            expect(result.id).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });
    });

    describe('EventLocationDeleteInputSchema', () => {
        it('should validate delete input with ID only', () => {
            const deleteData = {
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => EventLocationDeleteInputSchema.parse(deleteData)).not.toThrow();

            const result = EventLocationDeleteInputSchema.parse(deleteData);
            expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.force).toBe(false); // Default value
        });

        it('should validate delete input with force flag', () => {
            const deleteData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                force: true
            };

            expect(() => EventLocationDeleteInputSchema.parse(deleteData)).not.toThrow();

            const result = EventLocationDeleteInputSchema.parse(deleteData);
            expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.force).toBe(true);
        });

        it('should reject delete input without ID', () => {
            const deleteData = {
                force: true
            };

            expect(() => EventLocationDeleteInputSchema.parse(deleteData)).toThrow(ZodError);
        });

        it('should reject delete input with invalid force type', () => {
            const deleteData = {
                id: 'event-location-123',
                force: 'true' // Should be boolean
            };

            expect(() => EventLocationDeleteInputSchema.parse(deleteData)).toThrow(ZodError);
        });
    });

    describe('EventLocationDeleteOutputSchema', () => {
        it('should validate delete output with success only', () => {
            const deleteOutput = {
                success: true
            };

            expect(() => EventLocationDeleteOutputSchema.parse(deleteOutput)).not.toThrow();

            const result = EventLocationDeleteOutputSchema.parse(deleteOutput);
            expect(result.success).toBe(true);
        });

        it('should validate delete output with deletedAt', () => {
            const deleteOutput = {
                success: true,
                deletedAt: new Date()
            };

            expect(() => EventLocationDeleteOutputSchema.parse(deleteOutput)).not.toThrow();

            const result = EventLocationDeleteOutputSchema.parse(deleteOutput);
            expect(result.success).toBe(true);
            expect(result.deletedAt).toBeInstanceOf(Date);
        });

        it('should use default success value', () => {
            const deleteOutput = {};

            expect(() => EventLocationDeleteOutputSchema.parse(deleteOutput)).not.toThrow();

            const result = EventLocationDeleteOutputSchema.parse(deleteOutput);
            expect(result.success).toBe(true); // Default value
        });
    });

    describe('EventLocationRestoreInputSchema', () => {
        it('should validate restore input', () => {
            const restoreData = {
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => EventLocationRestoreInputSchema.parse(restoreData)).not.toThrow();

            const result = EventLocationRestoreInputSchema.parse(restoreData);
            expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should reject restore input without ID', () => {
            const restoreData = {};

            expect(() => EventLocationRestoreInputSchema.parse(restoreData)).toThrow(ZodError);
        });
    });

    describe('EventLocationRestoreOutputSchema', () => {
        it('should validate restore output', () => {
            const validData = createValidEventLocation();

            expect(() => EventLocationRestoreOutputSchema.parse(validData)).not.toThrow();

            const result = EventLocationRestoreOutputSchema.parse(validData);
            expect(result.id).toBeDefined();
            expect(result.createdAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });
    });
});
