import { describe, expect, it } from 'vitest';
import {
    professionalServiceTypeRelations,
    professionalServiceTypes
} from '../../../src/schemas/services/professionalServiceType.dbschema';

describe('PROFESSIONAL_SERVICE_TYPE Database Schema - Etapa 2.8', () => {
    describe('schema compilation', () => {
        it('should import professionalServiceType schema without errors', () => {
            expect(professionalServiceTypes).toBeDefined();
            expect(typeof professionalServiceTypes).toBe('object');
        });

        it('should import professionalServiceType relations without errors', () => {
            expect(professionalServiceTypeRelations).toBeDefined();
            expect(typeof professionalServiceTypeRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(professionalServiceTypes).toBeDefined();
            expect(typeof professionalServiceTypes).toBe('object');
            // Basic validation that it's a proper table definition
            expect(professionalServiceTypes).toHaveProperty('id');
        });

        it('should have expected columns for professional service type', () => {
            expect(professionalServiceTypes).toHaveProperty('id');
            expect(professionalServiceTypes).toHaveProperty('name');
            expect(professionalServiceTypes).toHaveProperty('category');
            expect(professionalServiceTypes).toHaveProperty('description');
            expect(professionalServiceTypes).toHaveProperty('defaultPricing');
            expect(professionalServiceTypes).toHaveProperty('isActive');
            expect(professionalServiceTypes).toHaveProperty('createdAt');
            expect(professionalServiceTypes).toHaveProperty('updatedAt');
            expect(professionalServiceTypes).toHaveProperty('createdById');
            expect(professionalServiceTypes).toHaveProperty('updatedById');
            expect(professionalServiceTypes).toHaveProperty('deletedAt');
            expect(professionalServiceTypes).toHaveProperty('deletedById');
            expect(professionalServiceTypes).toHaveProperty('adminInfo');
        });
    });
});
