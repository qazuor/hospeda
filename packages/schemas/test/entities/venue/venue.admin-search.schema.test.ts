import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { VenueAdminSearchSchema } from '../../../src/entities/venue/venue.admin-search.schema.js';

describe('VenueAdminSearchSchema', () => {
    it('should validate an empty admin search (all defaults)', () => {
        const result = VenueAdminSearchSchema.parse({});
        expect(result.page).toBe(1);
        // AdminSearchBaseSchema defaults pageSize to 20 (not 10 — different from BaseSearchSchema)
        expect(result.pageSize).toBe(20);
        expect(result.includeDeleted).toBe(false);
    });

    it('should accept valid admin search with filters', () => {
        const data = {
            page: 1,
            pageSize: 20,
            search: 'parrilla',
            type: 'PARRILLA',
            destinationId: faker.string.uuid(),
            ownerId: faker.string.uuid(),
            priceRange: 'MID',
            isFeatured: true
        };
        expect(() => VenueAdminSearchSchema.parse(data)).not.toThrow();
    });

    it('should accept includeDeleted flag', () => {
        const result = VenueAdminSearchSchema.parse({ includeDeleted: true });
        expect(result.includeDeleted).toBe(true);
    });

    it('should reject invalid type enum value', () => {
        expect(() => VenueAdminSearchSchema.parse({ type: 'TAQUERIA' })).toThrow(ZodError);
    });

    // HOS-1787 leaf 7.1 — the business-line filter is one catalog line.
    it('should accept a business line from the catalog', () => {
        const result = VenueAdminSearchSchema.parse({ businessLine: 'nightlife' });
        expect(result.businessLine).toBe('nightlife');
    });

    it('should reject a business line from another vertical', () => {
        expect(() => VenueAdminSearchSchema.parse({ businessLine: 'standard' })).toThrow(ZodError);
    });

    it('should reject an unknown business line value', () => {
        expect(() => VenueAdminSearchSchema.parse({ businessLine: 'x' })).toThrow(ZodError);
    });

    it('should leave businessLine absent when it is not provided', () => {
        const result = VenueAdminSearchSchema.parse({});
        expect(result.businessLine).toBeUndefined();
    });

    it('should reject invalid destinationId', () => {
        expect(() => VenueAdminSearchSchema.parse({ destinationId: 'not-a-uuid' })).toThrow(
            ZodError
        );
    });

    it('should coerce string page to number', () => {
        const result = VenueAdminSearchSchema.parse({ page: '3' });
        expect(result.page).toBe(3);
    });

    it('should coerce string pageSize to number', () => {
        const result = VenueAdminSearchSchema.parse({ pageSize: '50' });
        expect(result.pageSize).toBe(50);
    });
});
