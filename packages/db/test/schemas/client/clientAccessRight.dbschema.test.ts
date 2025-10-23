import { describe, expect, it } from 'vitest';
import {
    clientAccessRightRelations,
    clientAccessRights
} from '../../../src/schemas/client/clientAccessRight.dbschema';

describe('CLIENT_ACCESS_RIGHT Database Schema', () => {
    describe('schema compilation', () => {
        it('should import clientAccessRights schema without errors', () => {
            expect(clientAccessRights).toBeDefined();
            expect(typeof clientAccessRights).toBe('object');
        });

        it('should import clientAccessRight relations without errors', () => {
            expect(clientAccessRightRelations).toBeDefined();
            expect(typeof clientAccessRightRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(clientAccessRights).toBeDefined();
            expect(typeof clientAccessRights).toBe('object');
            // Basic validation that it's a proper table definition
            expect(clientAccessRights).toHaveProperty('id');
        });

        it('should have expected columns', () => {
            expect(clientAccessRights).toHaveProperty('id');
            expect(clientAccessRights).toHaveProperty('clientId');
            expect(clientAccessRights).toHaveProperty('subscriptionItemId');
            expect(clientAccessRights).toHaveProperty('feature');
            expect(clientAccessRights).toHaveProperty('scope');
            expect(clientAccessRights).toHaveProperty('scopeId');
            expect(clientAccessRights).toHaveProperty('scopeType');
            expect(clientAccessRights).toHaveProperty('validFrom');
            expect(clientAccessRights).toHaveProperty('validTo');
            expect(clientAccessRights).toHaveProperty('createdAt');
            expect(clientAccessRights).toHaveProperty('updatedAt');
            expect(clientAccessRights).toHaveProperty('createdById');
            expect(clientAccessRights).toHaveProperty('updatedById');
            expect(clientAccessRights).toHaveProperty('deletedAt');
            expect(clientAccessRights).toHaveProperty('deletedById');
            expect(clientAccessRights).toHaveProperty('adminInfo');
        });
    });
});
