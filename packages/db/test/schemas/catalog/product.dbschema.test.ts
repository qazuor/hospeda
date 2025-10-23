import { describe, expect, it } from 'vitest';
import { productRelations, products } from '../../../src/schemas/catalog/product.dbschema';

describe('PRODUCT Database Schema', () => {
    describe('schema compilation', () => {
        it('should import product schema without errors', () => {
            expect(products).toBeDefined();
            expect(typeof products).toBe('object');
        });

        it('should import product relations without errors', () => {
            expect(productRelations).toBeDefined();
            expect(typeof productRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(products).toBeDefined();
            expect(typeof products).toBe('object');
            // Basic validation that it's a proper table definition
            expect(products).toHaveProperty('id');
        });

        it('should have expected columns', () => {
            expect(products).toHaveProperty('id');
            expect(products).toHaveProperty('name');
            expect(products).toHaveProperty('type');
            expect(products).toHaveProperty('metadata');
            expect(products).toHaveProperty('createdAt');
            expect(products).toHaveProperty('updatedAt');
            expect(products).toHaveProperty('createdById');
            expect(products).toHaveProperty('updatedById');
            expect(products).toHaveProperty('deletedAt');
            expect(products).toHaveProperty('deletedById');
            expect(products).toHaveProperty('adminInfo');
        });
    });
});
