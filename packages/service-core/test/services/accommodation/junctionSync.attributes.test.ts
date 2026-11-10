/**
 * HOS-2058 -- `syncAmenityJunction` persists the per-amenity relation
 * attributes `scope` and `availability` (`amenityAttributes`).
 *
 * Contract under test:
 * - `amenityAttributes === undefined` writes no attribute (legacy behaviour);
 * - provided, it applies to the FINAL linked set: listed amenities get their
 *   values, unlisted linked ones are reset to NULL, unchanged rows are not
 *   written, and an entry for an amenity that is not linked is rejected before
 *   any write.
 */
import type { AmenityModel, DrizzleClient, RAccommodationAmenityModel } from '@repo/db';
import { AmenityAvailabilityEnum, AmenityScopeEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { syncAmenityJunction } from '../../../src/services/accommodation/accommodation.junction-sync';

const ACCOMMODATION_ID = '11111111-1111-4111-8111-111111111111';
const POOL = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const GRILL = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002';
const WIFI = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003';

interface Row {
    readonly amenityId: string;
    readonly scope?: AmenityScopeEnum | null;
    readonly availability?: AmenityAvailabilityEnum | null;
    readonly isOptional?: boolean;
}

/** Junction stub holding `rows`; records every write. */
function createJunctionModel(rows: readonly Row[]) {
    return {
        findAll: vi.fn(async () => ({
            items: rows.map((row) => ({ accommodationId: ACCOMMODATION_ID, ...row })),
            total: rows.length
        })),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        hardDelete: vi.fn().mockResolvedValue(1)
    };
}

const catalog = () =>
    ({
        findByIds: vi.fn(async (ids: readonly string[]) => ids.map((id) => ({ id })))
    }) as unknown as AmenityModel;

const tx = {} as DrizzleClient;

describe('syncAmenityJunction amenityAttributes (HOS-2058)', () => {
    it('without amenityAttributes, inserts new rows with no attribute keys', async () => {
        // Arrange
        const junction = createJunctionModel([]);

        // Act
        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: [POOL],
            junctionModel: junction as unknown as RAccommodationAmenityModel,
            amenityModel: catalog(),
            tx
        });

        // Assert
        expect(junction.create).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID, amenityId: POOL, isOptional: false },
            tx
        );
        expect(junction.update).not.toHaveBeenCalled();
    });

    it('inserts a newly checked amenity with its declared scope and availability', async () => {
        const junction = createJunctionModel([]);

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: [POOL, WIFI],
            amenityAttributes: [
                {
                    amenityId: POOL,
                    scope: AmenityScopeEnum.SHARED,
                    availability: AmenityAvailabilityEnum.SEASONAL
                }
            ],
            junctionModel: junction as unknown as RAccommodationAmenityModel,
            amenityModel: catalog(),
            tx
        });

        expect(junction.create).toHaveBeenCalledWith(
            {
                accommodationId: ACCOMMODATION_ID,
                amenityId: POOL,
                isOptional: false,
                scope: 'shared',
                availability: 'seasonal'
            },
            tx
        );
        // Listed nowhere → explicitly "not declared".
        expect(junction.create).toHaveBeenCalledWith(
            {
                accommodationId: ACCOMMODATION_ID,
                amenityId: WIFI,
                isOptional: false,
                scope: null,
                availability: null
            },
            tx
        );
    });

    it('updates only kept rows whose attributes change, and resets unlisted ones to NULL', async () => {
        // Arrange: POOL changes, GRILL is unchanged, WIFI was declared but is now unlisted.
        const junction = createJunctionModel([
            { amenityId: POOL, scope: null, availability: null },
            { amenityId: GRILL, scope: AmenityScopeEnum.PRIVATE, availability: null },
            { amenityId: WIFI, scope: AmenityScopeEnum.SHARED, availability: null }
        ]);

        // Act: attributes only, no amenityIds → the linked set stays as is.
        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: undefined,
            amenityAttributes: [
                { amenityId: POOL, scope: AmenityScopeEnum.PRIVATE, availability: null },
                { amenityId: GRILL, scope: AmenityScopeEnum.PRIVATE }
            ],
            junctionModel: junction as unknown as RAccommodationAmenityModel,
            amenityModel: catalog(),
            tx
        });

        // Assert
        expect(junction.create).not.toHaveBeenCalled();
        expect(junction.hardDelete).not.toHaveBeenCalled();
        expect(junction.update).toHaveBeenCalledTimes(2);
        expect(junction.update).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID, amenityId: POOL },
            { scope: 'private', availability: null },
            tx
        );
        expect(junction.update).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID, amenityId: WIFI },
            { scope: null, availability: null },
            tx
        );
    });

    it('rejects an entry for an amenity that will not be linked, before any write', async () => {
        const junction = createJunctionModel([{ amenityId: POOL }]);

        await expect(
            syncAmenityJunction({
                accommodationId: ACCOMMODATION_ID,
                amenityIds: [POOL],
                amenityAttributes: [{ amenityId: GRILL, scope: AmenityScopeEnum.SHARED }],
                junctionModel: junction as unknown as RAccommodationAmenityModel,
                amenityModel: catalog(),
                tx
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.VALIDATION_ERROR });

        expect(junction.create).not.toHaveBeenCalled();
        expect(junction.update).not.toHaveBeenCalled();
        expect(junction.hardDelete).not.toHaveBeenCalled();
    });

    it('is a no-op when neither amenityIds nor amenityAttributes is sent', async () => {
        const junction = createJunctionModel([{ amenityId: POOL }]);

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: undefined,
            junctionModel: junction as unknown as RAccommodationAmenityModel,
            amenityModel: catalog(),
            tx
        });

        expect(junction.findAll).not.toHaveBeenCalled();
    });

    it('re-sending identical attributes writes nothing (idempotent)', async () => {
        const junction = createJunctionModel([
            { amenityId: POOL, scope: AmenityScopeEnum.SHARED, availability: null }
        ]);

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: [POOL],
            amenityAttributes: [{ amenityId: POOL, scope: AmenityScopeEnum.SHARED }],
            junctionModel: junction as unknown as RAccommodationAmenityModel,
            amenityModel: catalog(),
            tx
        });

        expect(junction.create).not.toHaveBeenCalled();
        expect(junction.update).not.toHaveBeenCalled();
    });
});

describe('syncAmenityJunction extraCharge (HOS-2084)', () => {
    const run = (
        rows: readonly Row[],
        amenityAttributes: Parameters<typeof syncAmenityJunction>[0]['amenityAttributes'],
        amenityIds: readonly string[] | undefined = undefined
    ) => {
        const junction = createJunctionModel(rows);
        return syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds,
            amenityAttributes,
            junctionModel: junction as unknown as RAccommodationAmenityModel,
            amenityModel: catalog(),
            tx
        }).then(() => junction);
    };

    it('inserts a new row with isOptional true when extraCharge is sent', async () => {
        const junction = await run([], [{ amenityId: POOL, extraCharge: true }], [POOL]);

        expect(junction.create).toHaveBeenCalledWith(
            {
                accommodationId: ACCOMMODATION_ID,
                amenityId: POOL,
                isOptional: true,
                scope: null,
                availability: null
            },
            tx
        );
    });

    it('updates isOptional when extraCharge changes, and can clear it', async () => {
        const on = await run(
            [{ amenityId: POOL, isOptional: false }],
            [{ amenityId: POOL, extraCharge: true }]
        );
        expect(on.update).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID, amenityId: POOL },
            { scope: null, availability: null, isOptional: true },
            tx
        );

        const off = await run(
            [{ amenityId: POOL, isOptional: true }],
            [{ amenityId: POOL, extraCharge: false }]
        );
        expect(off.update).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID, amenityId: POOL },
            { scope: null, availability: null, isOptional: false },
            tx
        );
    });

    it('keeps the stored flag when extraCharge is omitted or the amenity is unlisted', async () => {
        const junction = await run(
            [
                { amenityId: POOL, scope: AmenityScopeEnum.SHARED, isOptional: true },
                { amenityId: GRILL, scope: AmenityScopeEnum.SHARED, isOptional: true }
            ],
            [{ amenityId: POOL, scope: AmenityScopeEnum.PRIVATE }]
        );

        expect(junction.update).toHaveBeenCalledTimes(2);
        for (const call of junction.update.mock.calls) {
            expect(call[1]).not.toHaveProperty('isOptional');
        }
    });

    it('writes nothing when the flag already matches', async () => {
        const junction = await run(
            [{ amenityId: POOL, isOptional: true }],
            [{ amenityId: POOL, extraCharge: true }]
        );

        expect(junction.update).not.toHaveBeenCalled();
    });
});
