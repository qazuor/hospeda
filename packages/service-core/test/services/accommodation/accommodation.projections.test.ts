import type { Accommodation } from '@repo/schemas';
import { DestinationTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    projectAccommodationCityDestination,
    projectAccommodationCityDestinationList
} from '../../../src/services/accommodation/accommodation.projections';

const cityRelation = {
    id: 'a3bb189e-8bf9-4a1e-9adf-6e8c4d3b2a01',
    slug: 'concepcion-del-uruguay',
    name: 'Concepción del Uruguay',
    summary: 'Ciudad histórica del Litoral argentino',
    destinationType: DestinationTypeEnum.CITY,
    level: 4,
    path: '/argentina/litoral/entre-rios/concepcion-del-uruguay',
    pathIds:
        '00000000-0000-0000-0000-000000000001,00000000-0000-0000-0000-000000000002,00000000-0000-0000-0000-000000000003,11111111-1111-1111-1111-111111111111'
};

const baseAccommodation = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    slug: 'gran-hotel-plaza',
    name: 'Gran Hotel Plaza',
    destinationId: cityRelation.id
} as unknown as Accommodation;

describe('projectAccommodationCityDestination (SPEC-095)', () => {
    it('returns the entity unchanged when it is null', () => {
        expect(projectAccommodationCityDestination(null)).toBeNull();
    });

    it('returns the entity unchanged when there is no destination relation', () => {
        const result = projectAccommodationCityDestination(baseAccommodation);
        expect(result).toEqual(baseAccommodation);
        expect((result as { cityDestination?: unknown }).cityDestination).toBeUndefined();
    });

    it('projects a valid destination relation into cityDestination and keeps destination', () => {
        const entity = {
            ...baseAccommodation,
            destination: { ...cityRelation, mediaItems: ['heavy'], reviewsCount: 42 }
        } as unknown as Accommodation;

        const result = projectAccommodationCityDestination(entity);

        expect(result).not.toBeNull();
        const projected = result as Accommodation & { cityDestination?: typeof cityRelation };
        expect(projected.cityDestination).toEqual(cityRelation);
        expect((projected as { destination?: unknown }).destination).toBeDefined();
    });

    it('returns the entity unchanged when destination relation is invalid', () => {
        const entity = {
            ...baseAccommodation,
            destination: { id: 'not-a-uuid', name: 'broken' }
        } as unknown as Accommodation;

        const result = projectAccommodationCityDestination(entity);

        expect((result as { cityDestination?: unknown }).cityDestination).toBeUndefined();
    });
});

describe('projectAccommodationCityDestinationList (SPEC-095)', () => {
    it('projects items with a destination and leaves items without one untouched', () => {
        const withRelation = {
            ...baseAccommodation,
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            destination: cityRelation
        } as unknown as Accommodation;

        const result = projectAccommodationCityDestinationList([baseAccommodation, withRelation]);

        expect(result).toHaveLength(2);
        expect((result[0] as { cityDestination?: unknown }).cityDestination).toBeUndefined();
        expect((result[1] as { cityDestination?: unknown }).cityDestination).toEqual(cityRelation);
    });
});
