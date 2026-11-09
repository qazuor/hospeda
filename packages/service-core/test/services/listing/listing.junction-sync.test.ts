/**
 * listing.junction-sync.test.ts
 *
 * Unit tests for the generic listing junction-sync helpers (SPEC-239 T-031).
 *
 * Contract under test (three-way):
 *  - ids === undefined  → no-op (leave existing rows untouched)
 *  - ids === []         → delete ALL rows for this entity
 *  - ids === [a, b, c]  → diff-sync to EXACTLY that set
 *  - unknown ID         → throw VALIDATION_ERROR, no mutations
 *
 * All models are mocked.  No real DB.
 */

import { AmenityAvailabilityEnum, AmenityScopeEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    syncListingAmenityJunction,
    syncListingFeatureJunction
} from '../../../src/services/listing/listing.junction-sync';
import { ServiceError } from '../../../src/types';

// ---------------------------------------------------------------------------
// UUID fixtures
// ---------------------------------------------------------------------------

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const FK_COL = 'venueId';

const UUID_A = '11111111-1111-4111-a111-111111111111';
const UUID_B = '22222222-2222-4222-a222-222222222222';
const UUID_C = '33333333-3333-4333-a333-333333333333';
const UUID_UNKNOWN = 'ffffffff-ffff-4fff-afff-ffffffffffff';

// Fake DrizzleClient (only shape matters for type checks)
const fakeTx = {} as Parameters<typeof syncListingAmenityJunction>[0]['tx'];

// ---------------------------------------------------------------------------
// Model factories
// ---------------------------------------------------------------------------

function makeJunctionModel(existingAmenityIds: string[] = []) {
    const items = existingAmenityIds.map((id) => ({ [FK_COL]: ENTITY_ID, amenityId: id }));
    return {
        findAll: vi.fn().mockResolvedValue({ items, total: items.length }),
        hardDelete: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({})
    };
}

function makeFeatureJunctionModel(existingFeatureIds: string[] = []) {
    const items = existingFeatureIds.map((id) => ({ [FK_COL]: ENTITY_ID, featureId: id }));
    return {
        findAll: vi.fn().mockResolvedValue({ items, total: items.length }),
        hardDelete: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({})
    };
}

/**
 * HOS-321: catalog validation batches through `findByIds` instead of one
 * `findById` per id, so the stub echoes back only the ids that "exist".
 */
function makeCatalogModel(existsForIds: string[] = [UUID_A, UUID_B, UUID_C]) {
    return {
        findByIds: vi
            .fn()
            .mockImplementation((ids: readonly string[]) =>
                Promise.resolve(ids.filter((id) => existsForIds.includes(id)).map((id) => ({ id })))
            )
    };
}

// ---------------------------------------------------------------------------
// syncListingAmenityJunction
// ---------------------------------------------------------------------------

describe('syncListingAmenityJunction', () => {
    let junctionModel: ReturnType<typeof makeJunctionModel>;
    let amenityModel: ReturnType<typeof makeCatalogModel>;

    beforeEach(() => {
        junctionModel = makeJunctionModel();
        amenityModel = makeCatalogModel();
    });

    describe('three-way contract: undefined', () => {
        it('should be a no-op when amenityIds is undefined', async () => {
            await syncListingAmenityJunction({
                entityId: ENTITY_ID,
                entityFkColumn: FK_COL,
                amenityIds: undefined,
                junctionModel,
                amenityModel,
                tx: fakeTx
            });

            expect(junctionModel.findAll).not.toHaveBeenCalled();
            expect(junctionModel.hardDelete).not.toHaveBeenCalled();
            expect(junctionModel.create).not.toHaveBeenCalled();
        });
    });

    describe('three-way contract: empty array', () => {
        it('should delete all existing rows when amenityIds is []', async () => {
            junctionModel = makeJunctionModel([UUID_A, UUID_B]);

            await syncListingAmenityJunction({
                entityId: ENTITY_ID,
                entityFkColumn: FK_COL,
                amenityIds: [],
                junctionModel,
                amenityModel,
                tx: fakeTx
            });

            // HOS-321: deletes are batched into ONE `IN (...)` statement.
            expect(junctionModel.hardDelete).toHaveBeenCalledTimes(1);
            expect(junctionModel.hardDelete).toHaveBeenCalledWith(
                { [FK_COL]: ENTITY_ID, amenityId: expect.arrayContaining([UUID_A, UUID_B]) },
                fakeTx
            );
            expect(junctionModel.create).not.toHaveBeenCalled();
        });
    });

    describe('three-way contract: id array', () => {
        it('should insert only new ids when there are no existing rows', async () => {
            junctionModel = makeJunctionModel([]);

            await syncListingAmenityJunction({
                entityId: ENTITY_ID,
                entityFkColumn: FK_COL,
                amenityIds: [UUID_A, UUID_B],
                junctionModel,
                amenityModel,
                tx: fakeTx
            });

            expect(junctionModel.hardDelete).not.toHaveBeenCalled();
            expect(junctionModel.create).toHaveBeenCalledTimes(2);
        });

        it('should diff-sync: delete removed, insert added', async () => {
            junctionModel = makeJunctionModel([UUID_A, UUID_B]); // existing: A, B

            await syncListingAmenityJunction({
                entityId: ENTITY_ID,
                entityFkColumn: FK_COL,
                amenityIds: [UUID_B, UUID_C], // keep B, drop A, add C
                junctionModel,
                amenityModel,
                tx: fakeTx
            });

            // UUID_A deleted (not in target)
            expect(junctionModel.hardDelete).toHaveBeenCalledTimes(1);
            expect(junctionModel.hardDelete).toHaveBeenCalledWith(
                { [FK_COL]: ENTITY_ID, amenityId: [UUID_A] },
                fakeTx
            );
            // UUID_C inserted (not in existing)
            expect(junctionModel.create).toHaveBeenCalledTimes(1);
            expect(junctionModel.create).toHaveBeenCalledWith(
                { [FK_COL]: ENTITY_ID, amenityId: UUID_C },
                fakeTx
            );
        });

        it('should be idempotent: no writes when target equals existing', async () => {
            junctionModel = makeJunctionModel([UUID_A, UUID_B]);

            await syncListingAmenityJunction({
                entityId: ENTITY_ID,
                entityFkColumn: FK_COL,
                amenityIds: [UUID_A, UUID_B],
                junctionModel,
                amenityModel,
                tx: fakeTx
            });

            expect(junctionModel.hardDelete).not.toHaveBeenCalled();
            expect(junctionModel.create).not.toHaveBeenCalled();
        });
    });

    describe('validation', () => {
        it('should throw VALIDATION_ERROR when any ID is unknown', async () => {
            amenityModel = makeCatalogModel([UUID_A]); // UUID_UNKNOWN not known

            await expect(
                syncListingAmenityJunction({
                    entityId: ENTITY_ID,
                    entityFkColumn: FK_COL,
                    amenityIds: [UUID_A, UUID_UNKNOWN],
                    junctionModel,
                    amenityModel,
                    tx: fakeTx
                })
            ).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.VALIDATION_ERROR
            );

            // No mutations should have happened
            expect(junctionModel.hardDelete).not.toHaveBeenCalled();
            expect(junctionModel.create).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// syncListingAmenityJunction — relation attributes (HOS-2061)
// ---------------------------------------------------------------------------

describe('syncListingAmenityJunction — relation attributes (HOS-2061)', () => {
    const SHARED = AmenityScopeEnum.SHARED;
    const SEASONAL = AmenityAvailabilityEnum.SEASONAL;
    const YEAR_ROUND = AmenityAvailabilityEnum.YEAR_ROUND;

    function makeAttributeJunctionModel(
        rows: { amenityId: string; scope?: string | null; availability?: string | null }[]
    ) {
        const items = rows.map((row) => ({ [FK_COL]: ENTITY_ID, ...row }));
        return {
            findAll: vi.fn().mockResolvedValue({ items, total: items.length }),
            hardDelete: vi.fn().mockResolvedValue(1),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({})
        };
    }

    it('inserts new rows with their declared attributes', async () => {
        // Arrange
        const junctionModel = makeAttributeJunctionModel([]);

        // Act
        await syncListingAmenityJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            amenityIds: [UUID_A, UUID_B],
            amenityAttributes: [{ amenityId: UUID_A, scope: SHARED, availability: SEASONAL }],
            junctionModel,
            amenityModel: makeCatalogModel(),
            tx: fakeTx
        });

        // Assert
        expect(junctionModel.create).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, amenityId: UUID_A, scope: 'shared', availability: 'seasonal' },
            fakeTx
        );
        expect(junctionModel.create).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, amenityId: UUID_B, scope: null, availability: null },
            fakeTx
        );
    });

    it('updates kept rows that changed and resets unlisted ones to NULL', async () => {
        // Arrange
        const junctionModel = makeAttributeJunctionModel([
            { amenityId: UUID_A, scope: 'private', availability: null },
            { amenityId: UUID_B, scope: 'shared', availability: 'seasonal' },
            { amenityId: UUID_C, scope: null, availability: 'year_round' }
        ]);

        // Act: A changes, B is unlisted (reset), C is unchanged.
        await syncListingAmenityJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            amenityIds: undefined,
            amenityAttributes: [
                { amenityId: UUID_A, scope: SHARED, availability: null },
                { amenityId: UUID_C, scope: null, availability: YEAR_ROUND }
            ],
            junctionModel,
            amenityModel: makeCatalogModel(),
            tx: fakeTx
        });

        // Assert
        expect(junctionModel.update).toHaveBeenCalledTimes(2);
        expect(junctionModel.update).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, amenityId: UUID_A },
            { scope: 'shared', availability: null },
            fakeTx
        );
        expect(junctionModel.update).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, amenityId: UUID_B },
            { scope: null, availability: null },
            fakeTx
        );
        expect(junctionModel.create).not.toHaveBeenCalled();
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
    });

    it('rejects an attribute entry for an amenity that is not linked, before any write', async () => {
        // Arrange
        const junctionModel = makeAttributeJunctionModel([{ amenityId: UUID_A }]);

        // Act
        const run = syncListingAmenityJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            amenityIds: [UUID_A],
            amenityAttributes: [{ amenityId: UUID_B, scope: SHARED }],
            junctionModel,
            amenityModel: makeCatalogModel(),
            tx: fakeTx
        });

        // Assert
        await expect(run).rejects.toMatchObject({ code: ServiceErrorCode.VALIDATION_ERROR });
        expect(junctionModel.update).not.toHaveBeenCalled();
        expect(junctionModel.create).not.toHaveBeenCalled();
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
    });

    it('leaves attributes untouched when amenityAttributes is undefined', async () => {
        // Arrange
        const junctionModel = makeAttributeJunctionModel([
            { amenityId: UUID_A, scope: 'shared', availability: 'seasonal' }
        ]);

        // Act
        await syncListingAmenityJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            amenityIds: [UUID_A, UUID_B],
            junctionModel,
            amenityModel: makeCatalogModel(),
            tx: fakeTx
        });

        // Assert
        expect(junctionModel.update).not.toHaveBeenCalled();
        expect(junctionModel.create).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, amenityId: UUID_B },
            fakeTx
        );
    });
});

// ---------------------------------------------------------------------------
// syncListingAmenityJunction — extra charge flag (HOS-2084)
// ---------------------------------------------------------------------------

describe('syncListingAmenityJunction — extraCharge (HOS-2084)', () => {
    function makeRows(rows: { amenityId: string; scope?: string | null; isOptional?: boolean }[]) {
        const items = rows.map((row) => ({ [FK_COL]: ENTITY_ID, ...row }));
        return {
            findAll: vi.fn().mockResolvedValue({ items, total: items.length }),
            hardDelete: vi.fn().mockResolvedValue(1),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({})
        };
    }

    it('inserts a new row with is_optional true when extraCharge is sent', async () => {
        const junctionModel = makeRows([]);

        await syncListingAmenityJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            amenityIds: [UUID_A],
            amenityAttributes: [{ amenityId: UUID_A, extraCharge: true }],
            junctionModel,
            amenityModel: makeCatalogModel(),
            tx: fakeTx
        });

        expect(junctionModel.create).toHaveBeenCalledWith(
            {
                [FK_COL]: ENTITY_ID,
                amenityId: UUID_A,
                scope: null,
                availability: null,
                isOptional: true
            },
            fakeTx
        );
    });

    it('updates a kept row when extraCharge changes', async () => {
        const junctionModel = makeRows([{ amenityId: UUID_A, scope: null, isOptional: false }]);

        await syncListingAmenityJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            amenityIds: undefined,
            amenityAttributes: [{ amenityId: UUID_A, extraCharge: true }],
            junctionModel,
            amenityModel: makeCatalogModel(),
            tx: fakeTx
        });

        expect(junctionModel.update).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, amenityId: UUID_A },
            { scope: null, availability: null, isOptional: true },
            fakeTx
        );
    });

    it('keeps the stored value when extraCharge is omitted or the amenity is unlisted', async () => {
        const junctionModel = makeRows([
            { amenityId: UUID_A, scope: 'shared', isOptional: true },
            { amenityId: UUID_B, scope: 'shared', isOptional: true }
        ]);

        await syncListingAmenityJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            amenityIds: undefined,
            amenityAttributes: [{ amenityId: UUID_A, scope: AmenityScopeEnum.PRIVATE }],
            junctionModel,
            amenityModel: makeCatalogModel(),
            tx: fakeTx
        });

        expect(junctionModel.update).toHaveBeenCalledTimes(2);
        for (const call of junctionModel.update.mock.calls) {
            expect(call[1]).not.toHaveProperty('isOptional');
        }
    });

    it('can clear the flag with extraCharge false', async () => {
        const junctionModel = makeRows([{ amenityId: UUID_A, scope: null, isOptional: true }]);

        await syncListingAmenityJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            amenityIds: undefined,
            amenityAttributes: [{ amenityId: UUID_A, extraCharge: false }],
            junctionModel,
            amenityModel: makeCatalogModel(),
            tx: fakeTx
        });

        expect(junctionModel.update).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, amenityId: UUID_A },
            { scope: null, availability: null, isOptional: false },
            fakeTx
        );
    });
});

// ---------------------------------------------------------------------------
// syncListingFeatureJunction
// ---------------------------------------------------------------------------

describe('syncListingFeatureJunction', () => {
    let junctionModel: ReturnType<typeof makeFeatureJunctionModel>;
    let featureModel: ReturnType<typeof makeCatalogModel>;

    beforeEach(() => {
        junctionModel = makeFeatureJunctionModel();
        featureModel = makeCatalogModel();
    });

    it('should be a no-op when featureIds is undefined', async () => {
        await syncListingFeatureJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            featureIds: undefined,
            junctionModel,
            featureModel,
            tx: fakeTx
        });

        expect(junctionModel.findAll).not.toHaveBeenCalled();
    });

    it('should delete all existing rows when featureIds is []', async () => {
        junctionModel = makeFeatureJunctionModel([UUID_A]);

        await syncListingFeatureJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            featureIds: [],
            junctionModel,
            featureModel,
            tx: fakeTx
        });

        expect(junctionModel.hardDelete).toHaveBeenCalledTimes(1);
        expect(junctionModel.create).not.toHaveBeenCalled();
    });

    it('should diff-sync features to exact set', async () => {
        junctionModel = makeFeatureJunctionModel([UUID_A]);

        await syncListingFeatureJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            featureIds: [UUID_B],
            junctionModel,
            featureModel,
            tx: fakeTx
        });

        // UUID_A deleted
        expect(junctionModel.hardDelete).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, featureId: [UUID_A] },
            fakeTx
        );
        // UUID_B inserted
        expect(junctionModel.create).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, featureId: UUID_B },
            fakeTx
        );
    });

    it('should throw VALIDATION_ERROR for unknown feature ID', async () => {
        featureModel = makeCatalogModel([]); // nothing exists

        await expect(
            syncListingFeatureJunction({
                entityId: ENTITY_ID,
                entityFkColumn: FK_COL,
                featureIds: [UUID_UNKNOWN],
                junctionModel,
                featureModel,
                tx: fakeTx
            })
        ).rejects.toSatisfy(
            (err: unknown) =>
                err instanceof ServiceError && err.code === ServiceErrorCode.VALIDATION_ERROR
        );
    });
});

// ---------------------------------------------------------------------------
// HOS-2067: retired (soft-deleted) catalog ids
// ---------------------------------------------------------------------------

/** Catalog stub whose `retiredIds` come back soft-deleted, like a real `findByIds`. */
function makeRetiringCatalogModel(retiredIds: string[], live: string[] = [UUID_A, UUID_B, UUID_C]) {
    return {
        findByIds: vi.fn().mockImplementation((ids: readonly string[]) =>
            Promise.resolve(
                ids
                    .filter((id) => live.includes(id) || retiredIds.includes(id))
                    .map((id) => ({
                        id,
                        deletedAt: retiredIds.includes(id) ? new Date() : null
                    }))
            )
        )
    };
}

describe('listing junction sync: retired catalog ids (HOS-2067)', () => {
    it('rejects a NEW retired amenity id and writes nothing', async () => {
        // Arrange: the listing already has B; the stale form sends A (retired) without B
        const junctionModel = makeJunctionModel([UUID_B]);
        const amenityModel = makeRetiringCatalogModel([UUID_A]);

        // Act + Assert
        await expect(
            syncListingAmenityJunction({
                entityId: ENTITY_ID,
                entityFkColumn: FK_COL,
                amenityIds: [UUID_A],
                junctionModel,
                amenityModel,
                tx: fakeTx
            })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: `amenity retired: ${UUID_A}`
        });
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
        expect(junctionModel.create).not.toHaveBeenCalled();
    });

    it('keeps an amenity relation whose catalog row is retired but already linked', async () => {
        // Arrange: A is linked and retired; B is new and live
        const junctionModel = makeJunctionModel([UUID_A]);
        const amenityModel = makeRetiringCatalogModel([UUID_A]);

        // Act
        await syncListingAmenityJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            amenityIds: [UUID_A, UUID_B],
            junctionModel,
            amenityModel,
            tx: fakeTx
        });

        // Assert
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
        expect(junctionModel.create).toHaveBeenCalledTimes(1);
        expect(junctionModel.create).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, amenityId: UUID_B },
            fakeTx
        );
    });

    it('rejects a NEW retired feature id and writes nothing', async () => {
        // Arrange
        const junctionModel = makeFeatureJunctionModel([UUID_B]);
        const featureModel = makeRetiringCatalogModel([UUID_A]);

        // Act + Assert
        await expect(
            syncListingFeatureJunction({
                entityId: ENTITY_ID,
                entityFkColumn: FK_COL,
                featureIds: [UUID_A],
                junctionModel,
                featureModel,
                tx: fakeTx
            })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: `feature retired: ${UUID_A}`
        });
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
        expect(junctionModel.create).not.toHaveBeenCalled();
    });

    it('keeps a feature relation whose catalog row is retired but already linked', async () => {
        // Arrange
        const junctionModel = makeFeatureJunctionModel([UUID_A]);
        const featureModel = makeRetiringCatalogModel([UUID_A]);

        // Act
        await syncListingFeatureJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            featureIds: [UUID_A],
            junctionModel,
            featureModel,
            tx: fakeTx
        });

        // Assert
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
        expect(junctionModel.create).not.toHaveBeenCalled();
    });
});
