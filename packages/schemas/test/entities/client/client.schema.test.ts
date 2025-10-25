import { describe, expect, it } from 'vitest';
import { ClientSchema } from '../../../src/entities/client/client.schema.js';

describe('Client Schema', () => {
    describe('valid client data', () => {
        it('should validate a valid client object', () => {
            const validClient = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Test Client Company',
                billingEmail: 'billing@testclient.com',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001',
                adminInfo: {
                    notes: 'Test client for development',
                    approvalStatus: 'approved'
                }
            };

            const result = ClientSchema.safeParse(validClient);
            expect(result.success).toBe(true);
        });

        it('should validate client with null userId (organization)', () => {
            const clientOrganization = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: null,
                name: 'Organization Client',
                billingEmail: 'billing@organization.com',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001',
                adminInfo: null
            };

            const result = ClientSchema.safeParse(clientOrganization);
            expect(result.success).toBe(true);
        });
    });

    describe('invalid client data', () => {
        it('should fail validation for invalid id', () => {
            const invalidClient = {
                id: 'invalid-uuid',
                userId: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Test Client',
                billingEmail: 'billing@test.com',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ClientSchema.safeParse(invalidClient);
            expect(result.success).toBe(false);
        });

        it('should fail validation for empty name', () => {
            const invalidClient = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '550e8400-e29b-41d4-a716-446655440000',
                name: '',
                billingEmail: 'billing@test.com',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ClientSchema.safeParse(invalidClient);
            expect(result.success).toBe(false);
        });

        it('should fail validation for invalid email', () => {
            const invalidClient = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Test Client',
                billingEmail: 'invalid-email',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ClientSchema.safeParse(invalidClient);
            expect(result.success).toBe(false);
        });
    });

    describe('field validation', () => {
        it('should validate name length constraints', () => {
            const shortName = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '550e8400-e29b-41d4-a716-446655440000',
                name: 'AB', // Too short
                billingEmail: 'billing@test.com',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ClientSchema.safeParse(shortName);
            expect(result.success).toBe(false);
        });

        it('should validate required fields are present', () => {
            const missingRequiredFields = {
                id: '123e4567-e89b-12d3-a456-426614174000'
                // Missing name, billingEmail, etc.
            };

            const result = ClientSchema.safeParse(missingRequiredFields);
            expect(result.success).toBe(false);
        });
    });
});
