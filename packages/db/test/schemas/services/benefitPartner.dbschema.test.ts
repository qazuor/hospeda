import { describe, expect, it } from 'vitest';
import {
    benefitPartnerRelations,
    benefitPartners
} from '../../../src/schemas/services/benefitPartner.dbschema';

describe('BENEFIT_PARTNER Database Schema - Etapa 2.10', () => {
    describe('schema compilation', () => {
        it('should import benefitPartner schema without errors', () => {
            expect(benefitPartners).toBeDefined();
            expect(typeof benefitPartners).toBe('object');
        });

        it('should import benefitPartner relations without errors', () => {
            expect(benefitPartnerRelations).toBeDefined();
            expect(typeof benefitPartnerRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(benefitPartners).toBeDefined();
            expect(typeof benefitPartners).toBe('object');
            // Basic validation that it's a proper table definition
            expect(benefitPartners).toHaveProperty('id');
        });

        it('should have expected columns for benefit partner', () => {
            expect(benefitPartners).toHaveProperty('id');
            expect(benefitPartners).toHaveProperty('clientId');
            expect(benefitPartners).toHaveProperty('name');
            expect(benefitPartners).toHaveProperty('category');
            expect(benefitPartners).toHaveProperty('createdAt');
            expect(benefitPartners).toHaveProperty('updatedAt');
            expect(benefitPartners).toHaveProperty('createdById');
            expect(benefitPartners).toHaveProperty('updatedById');
            expect(benefitPartners).toHaveProperty('deletedAt');
            expect(benefitPartners).toHaveProperty('deletedById');
            expect(benefitPartners).toHaveProperty('adminInfo');
        });
    });
});
