import { describe, expect, it } from 'vitest';
import {
    ClientCreateInputSchema,
    ClientCreateOutputSchema,
    ClientDeleteInputSchema,
    ClientDeleteOutputSchema,
    ClientRestoreInputSchema,
    ClientRestoreOutputSchema,
    ClientUpdateInputSchema,
    ClientUpdateOutputSchema
} from '../../../src/entities/client/client.crud.schema.js';

describe('Client CRUD Schemas', () => {
    describe('Create schemas', () => {
        it('should validate client creation input', () => {
            const createInput = {
                userId: '550e8400-e29b-41d4-a716-446655440000',
                name: 'New Test Client',
                billingEmail: 'billing@newclient.com'
            };

            const result = ClientCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(true);
        });

        it('should validate client creation with null userId', () => {
            const createInput = {
                userId: null,
                name: 'Organization Client',
                billingEmail: 'billing@organization.com'
            };

            const result = ClientCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(true);
        });

        it('should fail creation validation for missing required fields', () => {
            const createInput = {
                userId: '550e8400-e29b-41d4-a716-446655440000'
                // Missing name and billingEmail
            };

            const result = ClientCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(false);
        });

        it('should validate client creation output', () => {
            const createOutput = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '550e8400-e29b-41d4-a716-446655440000',
                name: 'New Test Client',
                billingEmail: 'billing@newclient.com',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ClientCreateOutputSchema.safeParse(createOutput);
            expect(result.success).toBe(true);
        });
    });

    describe('Update schemas', () => {
        it('should validate client update input', () => {
            const updateInput = {
                name: 'Updated Client Name',
                billingEmail: 'newemail@client.com'
            };

            const result = ClientUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(true);
        });

        it('should validate partial client update', () => {
            const updateInput = {
                name: 'Only Name Updated'
            };

            const result = ClientUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(true);
        });

        it('should validate client update output', () => {
            const updateOutput = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Updated Client Name',
                billingEmail: 'newemail@client.com',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-02T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440002'
            };

            const result = ClientUpdateOutputSchema.safeParse(updateOutput);
            expect(result.success).toBe(true);
        });
    });

    describe('Delete schemas', () => {
        it('should validate client delete input (empty object)', () => {
            const deleteInput = {};

            const result = ClientDeleteInputSchema.safeParse(deleteInput);
            expect(result.success).toBe(true);
        });

        it('should validate client delete output', () => {
            const deleteOutput = {
                success: true,
                deletedAt: new Date('2023-01-01T12:00:00Z')
            };

            const result = ClientDeleteOutputSchema.safeParse(deleteOutput);
            expect(result.success).toBe(true);
        });
    });

    describe('Restore schemas', () => {
        it('should validate client restore input (empty object)', () => {
            const restoreInput = {};

            const result = ClientRestoreInputSchema.safeParse(restoreInput);
            expect(result.success).toBe(true);
        });

        it('should validate client restore output', () => {
            const restoreOutput = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Restored Client',
                billingEmail: 'billing@restored.com',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ClientRestoreOutputSchema.safeParse(restoreOutput);
            expect(result.success).toBe(true);
        });
    });

    describe('Field validation in updates', () => {
        it('should fail update validation for invalid email', () => {
            const updateInput = {
                billingEmail: 'invalid-email'
            };

            const result = ClientUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(false);
        });

        it('should fail update validation for empty name', () => {
            const updateInput = {
                name: ''
            };

            const result = ClientUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(false);
        });
    });
});
