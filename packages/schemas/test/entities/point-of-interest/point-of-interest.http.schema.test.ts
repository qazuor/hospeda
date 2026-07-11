/**
 * Tests for point-of-interest HTTP schema converter functions.
 *
 * Verifies:
 * - PointOfInterestSearchHttpSchema coerces string query params to typed fields
 * - PointOfInterestCreateHttpSchema coerces lat/long/displayWeight from strings to numbers
 * - httpToDomainPointOfInterestSearch maps to domain search input
 * - httpToDomainPointOfInterestCreate sets lifecycleState to ACTIVE
 * - httpToDomainPointOfInterestUpdate passes only provided fields
 */
import { describe, expect, it } from 'vitest';
import {
    httpToDomainPointOfInterestCreate,
    httpToDomainPointOfInterestSearch,
    httpToDomainPointOfInterestUpdate,
    PointOfInterestCreateHttpSchema,
    PointOfInterestSearchHttpSchema
} from '../../../src/entities/point-of-interest/point-of-interest.http.schema.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';
import { PointOfInterestTypeEnum } from '../../../src/enums/point-of-interest-type.enum.js';

const DESTINATION_UUID = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';

// ---------------------------------------------------------------------------
// PointOfInterestSearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('PointOfInterestSearchHttpSchema — safeParse', () => {
    it('should accept an empty object', () => {
        const result = PointOfInterestSearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept slug and description filters', () => {
        const result = PointOfInterestSearchHttpSchema.safeParse({
            slug: 'autodromo-ciudad',
            description: 'racetrack'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.slug).toBe('autodromo-ciudad');
            expect(result.data.description).toBe('racetrack');
        }
    });

    it('should accept a valid type filter', () => {
        const result = PointOfInterestSearchHttpSchema.safeParse({ type: 'STADIUM' });
        expect(result.success).toBe(true);
    });

    it('should reject an invalid type filter', () => {
        const result = PointOfInterestSearchHttpSchema.safeParse({ type: 'NOT_A_TYPE' });
        expect(result.success).toBe(false);
    });

    it('should coerce isFeatured from string "true" to boolean', () => {
        const result = PointOfInterestSearchHttpSchema.safeParse({ isFeatured: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isFeatured).toBe(true);
        }
    });

    it('should coerce isBuiltin from string "false" to boolean', () => {
        const result = PointOfInterestSearchHttpSchema.safeParse({ isBuiltin: 'false' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isBuiltin).toBe(false);
        }
    });

    it('should accept valid destinationId UUID', () => {
        const result = PointOfInterestSearchHttpSchema.safeParse({
            destinationId: DESTINATION_UUID
        });
        expect(result.success).toBe(true);
    });

    it('should reject invalid destinationId (non-UUID)', () => {
        const result = PointOfInterestSearchHttpSchema.safeParse({ destinationId: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('should accept destinations as a comma-separated string filter', () => {
        const result = PointOfInterestSearchHttpSchema.safeParse({
            destinations: DESTINATION_UUID
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.destinations).toEqual([DESTINATION_UUID]);
        }
    });
});

// ---------------------------------------------------------------------------
// PointOfInterestCreateHttpSchema — lat/long/displayWeight coercion
// ---------------------------------------------------------------------------

describe('PointOfInterestCreateHttpSchema — safeParse', () => {
    it('should coerce lat/long from strings to numbers', () => {
        const result = PointOfInterestCreateHttpSchema.safeParse({
            slug: 'autodromo-ciudad',
            lat: '-32.4833',
            long: '-58.2333',
            type: 'STADIUM'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.lat).toBe(-32.4833);
            expect(result.data.long).toBe(-58.2333);
        }
    });

    it('should coerce displayWeight from a string to a number', () => {
        const result = PointOfInterestCreateHttpSchema.safeParse({
            slug: 'autodromo-ciudad',
            lat: '-32.4833',
            long: '-58.2333',
            type: 'STADIUM',
            displayWeight: '80'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.displayWeight).toBe(80);
        }
    });

    it('should reject an out-of-range lat', () => {
        const result = PointOfInterestCreateHttpSchema.safeParse({
            slug: 'autodromo-ciudad',
            lat: '200',
            long: '-58.2333',
            type: 'STADIUM'
        });
        expect(result.success).toBe(false);
    });

    it('should reject a missing type', () => {
        const result = PointOfInterestCreateHttpSchema.safeParse({
            slug: 'autodromo-ciudad',
            lat: '-32.4833',
            long: '-58.2333'
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// httpToDomainPointOfInterestSearch
// ---------------------------------------------------------------------------

describe('httpToDomainPointOfInterestSearch', () => {
    it('should map pagination fields to domain search input', () => {
        const parsed = PointOfInterestSearchHttpSchema.parse({ page: '2', pageSize: '20' });

        const result = httpToDomainPointOfInterestSearch(parsed);

        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(20);
    });

    it('should include slug filter in domain output', () => {
        const parsed = PointOfInterestSearchHttpSchema.parse({ slug: 'playa-banco-pelay' });

        const result = httpToDomainPointOfInterestSearch(parsed);

        expect(result.slug).toBe('playa-banco-pelay');
    });

    it('should include type filter in domain output', () => {
        const parsed = PointOfInterestSearchHttpSchema.parse({ type: 'MUSEUM' });

        const result = httpToDomainPointOfInterestSearch(parsed);

        expect(result.type).toBe('MUSEUM');
    });

    it('should include isFeatured boolean in domain output', () => {
        const parsed = PointOfInterestSearchHttpSchema.parse({ isFeatured: 'true' });

        const result = httpToDomainPointOfInterestSearch(parsed);

        expect(result.isFeatured).toBe(true);
    });

    it('should include destinationId in domain output', () => {
        const parsed = PointOfInterestSearchHttpSchema.parse({
            destinationId: DESTINATION_UUID
        });

        const result = httpToDomainPointOfInterestSearch(parsed);

        expect(result.destinationId).toBe(DESTINATION_UUID);
    });

    it('should handle empty input with all-undefined domain fields', () => {
        const parsed = PointOfInterestSearchHttpSchema.parse({});

        const result = httpToDomainPointOfInterestSearch(parsed);

        expect(result.slug).toBeUndefined();
        expect(result.type).toBeUndefined();
        expect(result.isFeatured).toBeUndefined();
        expect(result.destinationId).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// httpToDomainPointOfInterestCreate
// ---------------------------------------------------------------------------

describe('httpToDomainPointOfInterestCreate', () => {
    it('should map required fields to domain create input', () => {
        const httpData = {
            slug: 'autodromo-ciudad',
            lat: -32.4833,
            long: -58.2333,
            type: PointOfInterestTypeEnum.STADIUM,
            isFeatured: false,
            isBuiltin: true,
            displayWeight: 50
        };

        const result = httpToDomainPointOfInterestCreate(httpData);

        expect(result.slug).toBe('autodromo-ciudad');
        expect(result.lat).toBe(-32.4833);
        expect(result.long).toBe(-58.2333);
        expect(result.type).toBe('STADIUM');
    });

    it('should set lifecycleState to ACTIVE by default', () => {
        const httpData = {
            slug: 'playa-banco-pelay',
            lat: -32.5,
            long: -58.24,
            type: PointOfInterestTypeEnum.BEACH,
            isFeatured: false,
            isBuiltin: true,
            displayWeight: 50
        };

        const result = httpToDomainPointOfInterestCreate(httpData);

        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('should pass isFeatured through when true', () => {
        const httpData = {
            slug: 'museo-de-la-ciudad',
            lat: -32.48,
            long: -58.23,
            type: PointOfInterestTypeEnum.MUSEUM,
            isFeatured: true,
            isBuiltin: true,
            displayWeight: 80
        };

        const result = httpToDomainPointOfInterestCreate(httpData);

        expect(result.isFeatured).toBe(true);
        expect(result.displayWeight).toBe(80);
    });
});

// ---------------------------------------------------------------------------
// httpToDomainPointOfInterestUpdate
// ---------------------------------------------------------------------------

describe('httpToDomainPointOfInterestUpdate', () => {
    it('should map lat/long update to domain update input', () => {
        const httpData = { lat: -32.49, long: -58.25 };

        const result = httpToDomainPointOfInterestUpdate(httpData);

        expect(result.lat).toBe(-32.49);
        expect(result.long).toBe(-58.25);
    });

    it('should map description update', () => {
        const httpData = { description: 'Updated description for the point of interest' };

        const result = httpToDomainPointOfInterestUpdate(httpData);

        expect(result.description).toBe('Updated description for the point of interest');
    });

    it('should map isFeatured update', () => {
        const httpData = { isFeatured: true };

        const result = httpToDomainPointOfInterestUpdate(httpData);

        expect(result.isFeatured).toBe(true);
    });

    it('should map displayWeight update', () => {
        const httpData = { displayWeight: 90 };

        const result = httpToDomainPointOfInterestUpdate(httpData);

        expect(result.displayWeight).toBe(90);
    });

    it('should handle empty update payload', () => {
        const httpData = {};

        const result = httpToDomainPointOfInterestUpdate(httpData);

        expect(result.slug).toBeUndefined();
        expect(result.lat).toBeUndefined();
        expect(result.long).toBeUndefined();
        expect(result.type).toBeUndefined();
        expect(result.description).toBeUndefined();
        expect(result.isFeatured).toBeUndefined();
        expect(result.displayWeight).toBeUndefined();
    });
});
