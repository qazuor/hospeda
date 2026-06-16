/**
 * commerce.junction-sync.test.ts
 *
 * Unit tests for the generic commerce junction-sync helpers (SPEC-239 T-031).
 *
 * Contract under test (three-way):
 *  - ids === undefined  → no-op (leave existing rows untouched)
 *  - ids === []         → delete ALL rows for this entity
 *  - ids === [a, b, c]  → diff-sync to EXACTLY that set
 *  - unknown ID         → throw VALIDATION_ERROR, no mutations
 *
 * All models are mocked.  No real DB.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    syncCommerceAmenityJunction,
    syncCommerceFeatureJunction
} from '../../../src/services/commerce/commerce.junction-sync';
import { ServiceError } from '../../../src/types';

// ---------------------------------------------------------------------------
// UUID fixtures
// ---------------------------------------------------------------------------

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const FK_COL = 'gastronomyId';

const UUID_A = '11111111-1111-4111-a111-111111111111';
const UUID_B = '22222222-2222-4222-a222-222222222222';
const UUID_C = '33333333-3333-4333-a333-333333333333';
const UUID_UNKNOWN = 'ffffffff-ffff-4fff-afff-ffffffffffff';

// Fake DrizzleClient (only shape matters for type checks)
const fakeTx = {} as Parameters<typeof syncCommerceAmenityJunction>[0]['tx'];

// ---------------------------------------------------------------------------
// Model factories
// ---------------------------------------------------------------------------

function makeJunctionModel(existingAmenityIds: string[] = []) {
    return {
        findAll: vi.fn().mockResolvedValue({
            items: existingAmenityIds.map((id) => ({ [FK_COL]: ENTITY_ID, amenityId: id }))
        }),
        hardDelete: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({})
    };
}

function makeFeatureJunctionModel(existingFeatureIds: string[] = []) {
    return {
        findAll: vi.fn().mockResolvedValue({
            items: existingFeatureIds.map((id) => ({ [FK_COL]: ENTITY_ID, featureId: id }))
        }),
        hardDelete: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({})
    };
}

function makeCatalogModel(existsForIds: string[] = [UUID_A, UUID_B, UUID_C]) {
    return {
        findById: vi
            .fn()
            .mockImplementation((id: string) =>
                Promise.resolve(existsForIds.includes(id) ? { id } : null)
            )
    };
}

// ---------------------------------------------------------------------------
// syncCommerceAmenityJunction
// ---------------------------------------------------------------------------

describe('syncCommerceAmenityJunction', () => {
    let junctionModel: ReturnType<typeof makeJunctionModel>;
    let amenityModel: ReturnType<typeof makeCatalogModel>;

    beforeEach(() => {
        junctionModel = makeJunctionModel();
        amenityModel = makeCatalogModel();
    });

    describe('three-way contract: undefined', () => {
        it('should be a no-op when amenityIds is undefined', async () => {
            await syncCommerceAmenityJunction({
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

            await syncCommerceAmenityJunction({
                entityId: ENTITY_ID,
                entityFkColumn: FK_COL,
                amenityIds: [],
                junctionModel,
                amenityModel,
                tx: fakeTx
            });

            expect(junctionModel.hardDelete).toHaveBeenCalledTimes(2);
            expect(junctionModel.create).not.toHaveBeenCalled();
        });
    });

    describe('three-way contract: id array', () => {
        it('should insert only new ids when there are no existing rows', async () => {
            junctionModel = makeJunctionModel([]);

            await syncCommerceAmenityJunction({
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

            await syncCommerceAmenityJunction({
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
                { [FK_COL]: ENTITY_ID, amenityId: UUID_A },
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

            await syncCommerceAmenityJunction({
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
                syncCommerceAmenityJunction({
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
// syncCommerceFeatureJunction
// ---------------------------------------------------------------------------

describe('syncCommerceFeatureJunction', () => {
    let junctionModel: ReturnType<typeof makeFeatureJunctionModel>;
    let featureModel: ReturnType<typeof makeCatalogModel>;

    beforeEach(() => {
        junctionModel = makeFeatureJunctionModel();
        featureModel = makeCatalogModel();
    });

    it('should be a no-op when featureIds is undefined', async () => {
        await syncCommerceFeatureJunction({
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

        await syncCommerceFeatureJunction({
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

        await syncCommerceFeatureJunction({
            entityId: ENTITY_ID,
            entityFkColumn: FK_COL,
            featureIds: [UUID_B],
            junctionModel,
            featureModel,
            tx: fakeTx
        });

        // UUID_A deleted
        expect(junctionModel.hardDelete).toHaveBeenCalledWith(
            { [FK_COL]: ENTITY_ID, featureId: UUID_A },
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
            syncCommerceFeatureJunction({
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
