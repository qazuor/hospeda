import type { Accommodation } from '@repo/schemas';
import { DestinationTypeEnum, PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    applyAccommodationLocationPrivacy,
    applyAccommodationLocationPrivacyList,
    canViewExactLocation,
    projectAccommodationApproximateLocation,
    projectAccommodationCityDestination,
    projectAccommodationCityDestinationList
} from '../../../src/services/accommodation/accommodation.projections';
import type { Actor } from '../../../src/types';

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

describe('projectAccommodationApproximateLocation (SPEC-097)', () => {
    const SALT = 'test-location-salt-fixed-for-deterministic-tests-32+chars';

    const accommodationWithCoords = {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        location: {
            coordinates: { lat: '-30.7521', long: '-58.0429' }
        }
    } as unknown as Accommodation;

    it('returns an empty object when entity is null', () => {
        expect(projectAccommodationApproximateLocation(null, { salt: SALT })).toEqual({});
    });

    it('returns an empty object when entity has no location', () => {
        const entity = { id: 'x', location: undefined } as unknown as Accommodation;
        expect(projectAccommodationApproximateLocation(entity, { salt: SALT })).toEqual({});
    });

    it('returns an empty object when location has no coordinates', () => {
        const entity = {
            id: 'x',
            location: { coordinates: undefined }
        } as unknown as Accommodation;
        expect(projectAccommodationApproximateLocation(entity, { salt: SALT })).toEqual({});
    });

    it('returns an empty object when coordinates are not parseable as finite numbers', () => {
        const entity = {
            id: 'x',
            location: { coordinates: { lat: 'not-a-number', long: 'invalid' } }
        } as unknown as Accommodation;
        expect(projectAccommodationApproximateLocation(entity, { salt: SALT })).toEqual({});
    });

    it('returns approximateLocation with valid lat/lng/radius', () => {
        const result = projectAccommodationApproximateLocation(accommodationWithCoords, {
            salt: SALT
        });

        expect(result.approximateLocation).toBeDefined();
        expect(result.approximateLocation?.radiusMeters).toBe(500);
        expect(typeof result.approximateLocation?.lat).toBe('number');
        expect(typeof result.approximateLocation?.lng).toBe('number');
    });

    it('is deterministic for the same accommodation and salt', () => {
        const a = projectAccommodationApproximateLocation(accommodationWithCoords, {
            salt: SALT
        });
        const b = projectAccommodationApproximateLocation(accommodationWithCoords, {
            salt: SALT
        });

        expect(a).toEqual(b);
    });

    it('produces different output when salt rotates', () => {
        const a = projectAccommodationApproximateLocation(accommodationWithCoords, {
            salt: SALT
        });
        const b = projectAccommodationApproximateLocation(accommodationWithCoords, {
            salt: 'a-different-salt-32+chars-long-for-rotation-test-purposes'
        });

        expect(a.approximateLocation?.lat).not.toBe(b.approximateLocation?.lat);
    });

    it('does not include exact coordinates in output', () => {
        const result = projectAccommodationApproximateLocation(accommodationWithCoords, {
            salt: SALT
        });

        expect(result).not.toHaveProperty('coordinates');
        expect(result).not.toHaveProperty('lat');
        expect(result).not.toHaveProperty('long');
        expect(Object.keys(result)).toEqual(['approximateLocation']);
    });
});

describe('canViewExactLocation (SPEC-097)', () => {
    const ownerId = 'owner-aaaa-bbbb-cccc-dddddddddddd';
    const adminActor = {
        id: 'admin-id',
        role: 'ADMIN',
        permissions: [PermissionEnum.ACCOMMODATION_LOCATION_EXACT_VIEW]
    } as unknown as Actor;
    const ownerActor = {
        id: ownerId,
        role: 'USER',
        permissions: []
    } as unknown as Actor;
    const guestActor = {
        id: 'guest-id',
        role: 'USER',
        permissions: []
    } as unknown as Actor;

    it('returns false for null actor (anonymous)', () => {
        expect(canViewExactLocation(null, ownerId)).toBe(false);
    });

    it('returns true when actor has ACCOMMODATION_LOCATION_EXACT_VIEW', () => {
        expect(canViewExactLocation(adminActor, ownerId)).toBe(true);
    });

    it('returns true when actor is the owner', () => {
        expect(canViewExactLocation(ownerActor, ownerId)).toBe(true);
    });

    it('returns false when actor is logged in but not owner and lacks permission', () => {
        expect(canViewExactLocation(guestActor, ownerId)).toBe(false);
    });

    it('returns false when ownerId is undefined and actor lacks permission', () => {
        expect(canViewExactLocation(guestActor, undefined)).toBe(false);
    });
});

describe('applyAccommodationLocationPrivacy (SPEC-097)', () => {
    const SALT = 'test-location-salt-fixed-for-deterministic-tests-32+chars';
    const ownerId = 'owner-aaaa-bbbb-cccc-dddddddddddd';

    const buildEntity = () =>
        ({
            id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            ownerId,
            location: {
                state: 'Entre Ríos',
                country: 'Argentina',
                zipCode: '3260',
                street: 'Av. Belgrano',
                number: '123',
                floor: '2',
                apartment: 'B',
                coordinates: { lat: '-30.7521', long: '-58.0429' }
            }
        }) as unknown as Accommodation & { ownerId: string };

    const guestActor = {
        id: 'guest-id',
        role: 'USER',
        permissions: []
    } as unknown as Actor;

    const adminActor = {
        id: 'admin-id',
        role: 'ADMIN',
        permissions: [PermissionEnum.ACCOMMODATION_LOCATION_EXACT_VIEW]
    } as unknown as Actor;

    it('strips sensitive location fields for anonymous visitors', () => {
        const result = applyAccommodationLocationPrivacy(buildEntity(), {
            actor: null,
            salt: SALT
        });

        expect(result?.location).toBeDefined();
        const loc = result?.location as Record<string, unknown>;
        expect(loc.state).toBe('Entre Ríos');
        expect(loc.country).toBe('Argentina');
        expect(loc.zipCode).toBe('3260');
        expect(loc.street).toBeUndefined();
        expect(loc.number).toBeUndefined();
        expect(loc.floor).toBeUndefined();
        expect(loc.apartment).toBeUndefined();
        expect(loc.coordinates).toBeUndefined();
        expect(
            (result as { approximateLocation?: { lat: number } } | null)?.approximateLocation
        ).toBeDefined();
    });

    it('strips sensitive fields for logged-in users without permission', () => {
        const result = applyAccommodationLocationPrivacy(buildEntity(), {
            actor: guestActor,
            salt: SALT
        });

        const loc = result?.location as Record<string, unknown>;
        expect(loc.coordinates).toBeUndefined();
        expect(loc.street).toBeUndefined();
    });

    it('keeps exact location for the owner', () => {
        const result = applyAccommodationLocationPrivacy(buildEntity(), {
            actor: { id: ownerId, role: 'USER', permissions: [] } as unknown as Actor,
            salt: SALT
        });

        const loc = result?.location as Record<string, unknown>;
        expect(loc.coordinates).toEqual({ lat: '-30.7521', long: '-58.0429' });
        expect(loc.street).toBe('Av. Belgrano');
        expect(loc.number).toBe('123');
        expect(
            (result as { approximateLocation?: { lat: number } } | null)?.approximateLocation
        ).toBeDefined();
    });

    it('keeps exact location for admins (with permission)', () => {
        const result = applyAccommodationLocationPrivacy(buildEntity(), {
            actor: adminActor,
            salt: SALT
        });

        const loc = result?.location as Record<string, unknown>;
        expect(loc.coordinates).toEqual({ lat: '-30.7521', long: '-58.0429' });
        expect(loc.street).toBe('Av. Belgrano');
    });

    it('returns null when entity is null', () => {
        expect(applyAccommodationLocationPrivacy(null, { actor: null, salt: SALT })).toBeNull();
    });

    it('handles entity without location', () => {
        const entity = { id: 'x', ownerId } as unknown as Accommodation & { ownerId: string };
        const result = applyAccommodationLocationPrivacy(entity, { actor: null, salt: SALT });
        expect(result).toEqual({ id: 'x', ownerId });
    });

    it('does not mutate the input entity', () => {
        const entity = buildEntity();
        const originalCoords = entity.location?.coordinates;
        applyAccommodationLocationPrivacy(entity, { actor: null, salt: SALT });
        expect(entity.location?.coordinates).toEqual(originalCoords);
    });
});

describe('applyAccommodationLocationPrivacyList (SPEC-097)', () => {
    const SALT = 'test-location-salt-fixed-for-deterministic-tests-32+chars';

    it('applies privacy to every item', () => {
        const entities = [
            {
                id: 'a',
                ownerId: 'o-a',
                location: { coordinates: { lat: '-30.0', long: '-58.0' }, street: 'S' }
            },
            {
                id: 'b',
                ownerId: 'o-b',
                location: { coordinates: { lat: '-31.0', long: '-59.0' }, street: 'T' }
            }
        ] as unknown as Array<Accommodation & { ownerId: string }>;

        const result = applyAccommodationLocationPrivacyList(entities, {
            actor: null,
            salt: SALT
        });

        expect(result).toHaveLength(2);
        for (const item of result) {
            const loc = item.location as Record<string, unknown>;
            expect(loc.coordinates).toBeUndefined();
            expect(loc.street).toBeUndefined();
            expect(
                (item as { approximateLocation?: { lat: number } }).approximateLocation
            ).toBeDefined();
        }
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
