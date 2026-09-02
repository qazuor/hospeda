import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    GastronomyCreateHttpSchema,
    GastronomySearchHttpSchema,
    GastronomyUpdateHttpSchema,
    httpToDomainGastronomyCreate,
    httpToDomainGastronomySearch,
    httpToDomainGastronomyUpdate
} from '../../../src/entities/gastronomy/gastronomy.http.schema.js';

describe('GastronomySearchHttpSchema', () => {
    it('should validate an empty search (all defaults)', () => {
        expect(() => GastronomySearchHttpSchema.parse({})).not.toThrow();
    });

    it('should coerce page from string', () => {
        const result = GastronomySearchHttpSchema.parse({ page: '2' });
        expect(result.page).toBe(2);
    });

    it('should coerce isFeatured from string "true"', () => {
        const result = GastronomySearchHttpSchema.parse({ isFeatured: 'true' });
        expect(result.isFeatured).toBe(true);
    });

    it('should coerce minRating from string', () => {
        const result = GastronomySearchHttpSchema.parse({ minRating: '4' });
        expect(result.minRating).toBe(4);
    });

    it('should reject invalid type value', () => {
        expect(() => GastronomySearchHttpSchema.parse({ type: 'TAQUERIA' })).toThrow(ZodError);
    });

    // HOS-1054: the "apto" filter. Sin TACC / vegano / sin lactosa are rows of
    // the shared `features` catalog scoped to the gastronomy vertical, so the
    // filter travels as feature UUIDs — not as a dedicated allergen param.
    describe('features (the "apto" filter, HOS-1054)', () => {
        const GLUTEN_FREE = '11111111-1111-4111-8111-111111111111';
        const LACTOSE_FREE = '22222222-2222-4222-8222-222222222222';

        it('accepts a comma-separated list and splits it into UUIDs', () => {
            const result = GastronomySearchHttpSchema.parse({
                features: `${GLUTEN_FREE},${LACTOSE_FREE}`
            });
            expect(result.features).toEqual([GLUTEN_FREE, LACTOSE_FREE]);
        });

        it('accepts a repeated query param (array form)', () => {
            const result = GastronomySearchHttpSchema.parse({
                features: [GLUTEN_FREE, LACTOSE_FREE]
            });
            expect(result.features).toEqual([GLUTEN_FREE, LACTOSE_FREE]);
        });

        it('trims whitespace and drops empty segments', () => {
            const result = GastronomySearchHttpSchema.parse({
                features: ` ${GLUTEN_FREE} , , ${LACTOSE_FREE} `
            });
            expect(result.features).toEqual([GLUTEN_FREE, LACTOSE_FREE]);
        });

        it('REJECTS a non-UUID rather than silently dropping the filter', () => {
            // A silently-dropped filter answers 200 with an unfiltered page,
            // which for an allergen filter is the dangerous failure: the visitor
            // reads the result as "these places are all sin TACC".
            expect(() =>
                GastronomySearchHttpSchema.parse({ features: 'gluten_free_options' })
            ).toThrow(ZodError);
        });

        it('applies the same shape to the amenities filter', () => {
            const result = GastronomySearchHttpSchema.parse({
                amenities: `${GLUTEN_FREE},${LACTOSE_FREE}`
            });
            expect(result.amenities).toEqual([GLUTEN_FREE, LACTOSE_FREE]);
        });
    });
});

describe('GastronomyCreateHttpSchema', () => {
    // H-88: `ownerId` is REQUIRED. `gastronomies.owner_id` is NOT NULL with no
    // default, so a create payload without it cannot become a row — it reached
    // Postgres and came back as an opaque 500. A fixture that omits it is not a
    // "valid create payload".
    const validCreate = () => ({
        name: 'La Parrilla de Juan',
        summary: 'Parrilla tradicional argentina',
        description: 'Una parrilla tradicional con los mejores cortes de carne.',
        type: 'PARRILLA',
        destinationId: faker.string.uuid(),
        ownerId: faker.string.uuid()
    });

    it('should validate a valid create payload', () => {
        expect(() => GastronomyCreateHttpSchema.parse(validCreate())).not.toThrow();
    });

    it('should default isFeatured to false', () => {
        const result = GastronomyCreateHttpSchema.parse(validCreate());
        expect(result.isFeatured).toBe(false);
    });

    it('should reject when name is missing', () => {
        const { name: _n, ...data } = validCreate();
        expect(() => GastronomyCreateHttpSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject non-HTTPS menuUrl', () => {
        const data = { ...validCreate(), menuUrl: 'http://insecure.com' };
        expect(() => GastronomyCreateHttpSchema.parse(data)).toThrow(ZodError);
    });
});

describe('GastronomyUpdateHttpSchema', () => {
    it('should allow empty update', () => {
        expect(() => GastronomyUpdateHttpSchema.parse({})).not.toThrow();
    });

    it('should accept partial update with priceRange', () => {
        const data = { priceRange: 'HIGH' };
        expect(() => GastronomyUpdateHttpSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid priceRange', () => {
        expect(() => GastronomyUpdateHttpSchema.parse({ priceRange: 'EXPENSIVE' })).toThrow(
            ZodError
        );
    });
});

describe('httpToDomainGastronomySearch', () => {
    it('should convert HTTP search params to domain search input', () => {
        const httpInput = GastronomySearchHttpSchema.parse({
            type: 'RESTAURANT',
            page: '1',
            pageSize: '20'
        });
        const result = httpToDomainGastronomySearch(httpInput);
        expect(result.type).toBe('RESTAURANT');
        expect(result.page).toBe(1);
    });

    // HOS-1054. This mapper used to end with a comment saying amenities and
    // features "exist in domain but not in HTTP schema, so they are not mapped
    // here" — the reason the apto filter was accepted by the domain schema and
    // then never reached the service.
    it('forwards the apto (features) filter to the domain search input', () => {
        const GLUTEN_FREE = '11111111-1111-4111-8111-111111111111';
        const httpInput = GastronomySearchHttpSchema.parse({ features: GLUTEN_FREE });
        const result = httpToDomainGastronomySearch(httpInput);
        expect(result.features).toEqual([GLUTEN_FREE]);
    });

    it('forwards the amenities filter to the domain search input', () => {
        const WIFI = '33333333-3333-4333-8333-333333333333';
        const httpInput = GastronomySearchHttpSchema.parse({ amenities: WIFI });
        const result = httpToDomainGastronomySearch(httpInput);
        expect(result.amenities).toEqual([WIFI]);
    });

    it('leaves both undefined when neither is requested', () => {
        const result = httpToDomainGastronomySearch(GastronomySearchHttpSchema.parse({}));
        expect(result.features).toBeUndefined();
        expect(result.amenities).toBeUndefined();
    });
});

describe('httpToDomainGastronomyCreate', () => {
    it('should convert HTTP create payload to domain create input', () => {
        const httpInput = GastronomyCreateHttpSchema.parse({
            name: 'Café del Centro',
            summary: 'Café tradicional en el centro',
            description: 'El mejor café de la ciudad con pasteles artesanales.',
            type: 'CAFE',
            destinationId: faker.string.uuid(),
            // H-88: required — see `validCreate` above.
            ownerId: faker.string.uuid()
        });
        const result = httpToDomainGastronomyCreate(httpInput);
        expect(result.name).toBe('Café del Centro');
        expect(result.type).toBe('CAFE');
    });
});

describe('httpToDomainGastronomyUpdate', () => {
    it('should convert HTTP update payload to domain update input', () => {
        const httpInput = GastronomyUpdateHttpSchema.parse({ priceRange: 'BUDGET' });
        const result = httpToDomainGastronomyUpdate(httpInput);
        expect(result.priceRange).toBe('BUDGET');
    });
});
