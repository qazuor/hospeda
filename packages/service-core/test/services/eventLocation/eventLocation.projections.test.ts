import type { EventLocation } from '@repo/schemas';
import { DestinationTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    projectEventLocationCityDestination,
    projectEventLocationCityDestinationList
} from '../../../src/services/eventLocation/eventLocation.projections';

const cityRelation = {
    id: 'c4dd293f-9c0a-4b2e-8ade-7f9c5e4d3c12',
    slug: 'colon',
    name: 'Colón',
    summary: 'Ciudad turística sobre el río Uruguay',
    destinationType: DestinationTypeEnum.CITY,
    level: 4,
    path: '/argentina/litoral/entre-rios/colon',
    pathIds:
        '00000000-0000-0000-0000-000000000001,00000000-0000-0000-0000-000000000002,00000000-0000-0000-0000-000000000003,22222222-2222-2222-2222-222222222222'
};

const baseLocation = {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    placeName: 'Anfiteatro Municipal',
    destinationId: cityRelation.id
} as unknown as EventLocation;

describe('projectEventLocationCityDestination (SPEC-095)', () => {
    it('returns null when entity is null', () => {
        expect(projectEventLocationCityDestination(null)).toBeNull();
    });

    it('leaves entity untouched when there is no destination relation', () => {
        const result = projectEventLocationCityDestination(baseLocation);
        expect(result).toEqual(baseLocation);
        expect((result as { cityDestination?: unknown }).cityDestination).toBeUndefined();
    });

    it('projects valid destination relation as cityDestination and keeps destination', () => {
        const entity = {
            ...baseLocation,
            destination: { ...cityRelation, mediaItems: ['heavy'] }
        } as unknown as EventLocation;

        const result = projectEventLocationCityDestination(entity);

        const projected = result as EventLocation & { cityDestination?: typeof cityRelation };
        expect(projected.cityDestination).toEqual(cityRelation);
        expect((projected as { destination?: unknown }).destination).toBeDefined();
    });

    it('skips invalid destination relation silently', () => {
        const entity = {
            ...baseLocation,
            destination: { foo: 'bar' }
        } as unknown as EventLocation;

        const result = projectEventLocationCityDestination(entity);

        expect((result as { cityDestination?: unknown }).cityDestination).toBeUndefined();
    });
});

describe('projectEventLocationCityDestinationList (SPEC-095)', () => {
    it('projects only items that carry a destination relation', () => {
        const withRelation = {
            ...baseLocation,
            id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            destination: cityRelation
        } as unknown as EventLocation;

        const result = projectEventLocationCityDestinationList([baseLocation, withRelation]);

        expect(result).toHaveLength(2);
        expect((result[0] as { cityDestination?: unknown }).cityDestination).toBeUndefined();
        expect((result[1] as { cityDestination?: unknown }).cityDestination).toEqual(cityRelation);
    });
});
