import { describe, expect, it } from 'vitest';
import { clientRelations, clients } from '../../../src/schemas/client/client.dbschema';

describe('CLIENT Database Schema', () => {
    describe('schema compilation', () => {
        it('should import client schema without errors', () => {
            expect(clients).toBeDefined();
            expect(typeof clients).toBe('object');
        });

        it('should import client relations without errors', () => {
            expect(clientRelations).toBeDefined();
            expect(typeof clientRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(clients).toBeDefined();
            expect(typeof clients).toBe('object');
            // Basic validation that it's a proper table definition
            expect(clients).toHaveProperty('id');
        });

        it('should have expected columns', () => {
            expect(clients).toHaveProperty('id');
            expect(clients).toHaveProperty('userId');
            expect(clients).toHaveProperty('name');
            expect(clients).toHaveProperty('billingEmail');
            expect(clients).toHaveProperty('createdAt');
            expect(clients).toHaveProperty('updatedAt');
            expect(clients).toHaveProperty('createdById');
            expect(clients).toHaveProperty('updatedById');
            expect(clients).toHaveProperty('deletedAt');
            expect(clients).toHaveProperty('deletedById');
            expect(clients).toHaveProperty('adminInfo');
        });
    });
});
