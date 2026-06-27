/**
 * junctionSync.test.ts
 *
 * Tests for the SPEC-172 junction sync contract:
 * - amenityIds / featureIds on AccommodationService.create and .update
 *
 * Contract under test (owner-locked):
 *  - undefined → leave existing rows untouched (R-1 regression)
 *  - []         → delete all
 *  - [ids]      → sync to exact set (delete-absent, insert-missing)
 *  - unknown ID → reject with VALIDATION_ERROR, roll back entire tx
 *
 * All tests are unit tests — models are mocked, no real DB.
 *
 * IMPORTANT: tests that include amenityIds / featureIds must pass a ctx.tx stub to
 * avoid triggering withServiceTransaction (which requires initializeDb()). Tests that
 * omit those fields exercise the no-op path and do NOT need a tx.
 */

import type {
    AccommodationModel,
    AmenityModel,
    DrizzleClient,
    FeatureModel,
    RAccommodationAmenityModel,
    RAccommodationFeatureModel
} from '@repo/db';
import { DestinationTypeEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';

/**
 * FIX 1 (SPEC-204): AccommodationService.create() now opens a transaction when
 * `media` is present. Mock withServiceTransaction so the R-1 regression test
 * (undefined amenityIds/featureIds, no ctx) works without a real DB.
 * Tests that pass ctxWithTx directly bypass withServiceTransaction entirely.
 */
vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (
            fn: (ctx: { tx: object; hookState: Record<string, unknown> }) => Promise<unknown>,
            baseCtx?: { hookState?: Record<string, unknown> }
        ) => {
            const ctx = { ...baseCtx, tx: {}, hookState: baseCtx?.hookState ?? {} };
            try {
                return await fn(ctx as never);
            } catch (err) {
                // runWithLoggingAndValidation re-throws ServiceError when ctx.tx is truthy.
                // Wrap back into { error } for unit test assertions.
                if (
                    err !== null &&
                    typeof err === 'object' &&
                    'code' in err &&
                    'name' in err &&
                    (err as { name: string }).name === 'ServiceError'
                ) {
                    return { error: err };
                }
                throw err;
            }
        }
    )
}));
import {
    createMockAccommodation,
    createMockAccommodationCreateInput
} from '../../factories/accommodationFactory';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, makeMediaModelStub } from '../../utils/modelMockFactory';

// ─── UUIDs used in tests (must be valid UUID v4) ────────────────────────────

const UUID_AMENITY_A = 'cd53fa0f-0b3f-4a0e-b559-0c13b553cf73';
const UUID_AMENITY_B = '98e8101c-c791-43e1-8666-dcbc39c33144';
const UUID_AMENITY_C = 'b69b2659-84c1-45b0-b359-d5258ef2e2b5';
const UUID_AMENITY_UNKNOWN = '5a9a8ced-15aa-4a55-8261-8b4c6093ed22';
const UUID_FEATURE_A = '1aea3c16-9eae-4dd5-8231-4d01352ca211';
const UUID_FEATURE_UNKNOWN = '31cc8538-5a19-4c3b-8d1b-37b7353aba85';
const UUID_FEATURE_B = '8172442f-03f9-450f-86ca-7704c0cef27f';

// ─── helpers ────────────────────────────────────────────────────────────────

const mockLogger = createLoggerMock();

/** Creates a minimal mock for the junction models. */
function createMockJunctionModel() {
    return {
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        create: vi.fn().mockResolvedValue({}),
        hardDelete: vi.fn().mockResolvedValue(1),
        findById: vi.fn(),
        findOne: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn()
    };
}

/** Creates a minimal mock for the catalog models. */
function createMockCatalogModel() {
    return {
        findById: vi.fn().mockResolvedValue({ id: 'catalog-id' }), // exists by default
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        create: vi.fn(),
        update: vi.fn(),
        hardDelete: vi.fn(),
        softDelete: vi.fn()
    };
}

/**
 * A stub DrizzleClient-shaped object that satisfies the type without a real DB.
 * We cast to DrizzleClient so the service's `ctx.tx` check passes.
 */
const mockTx = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
} as unknown as DrizzleClient;

/** ServiceContext with a stubbed tx so junction sync can run without a real DB. */
const ctxWithTx = { tx: mockTx, hookState: {} };

// ─── fixtures ────────────────────────────────────────────────────────────────

interface Fixtures {
    service: AccommodationService;
    model: ReturnType<typeof createMockBaseModel>;
    rAmenityModel: ReturnType<typeof createMockJunctionModel>;
    rFeatureModel: ReturnType<typeof createMockJunctionModel>;
    amenityModel: ReturnType<typeof createMockCatalogModel>;
    featureCatalogModel: ReturnType<typeof createMockCatalogModel>;
}

function buildFixtures(): Fixtures {
    const model = createMockBaseModel();
    const rAmenityModel = createMockJunctionModel();
    const rFeatureModel = createMockJunctionModel();
    const amenityModel = createMockCatalogModel();
    const featureCatalogModel = createMockCatalogModel();

    const service = new AccommodationService(
        { logger: mockLogger },
        model as unknown as AccommodationModel,
        null,
        undefined,
        null,
        rAmenityModel as unknown as RAccommodationAmenityModel,
        rFeatureModel as unknown as RAccommodationFeatureModel,
        amenityModel as unknown as AmenityModel,
        featureCatalogModel as unknown as FeatureModel,
        // biome-ignore lint/suspicious/noExplicitAny: test stub
        makeMediaModelStub() as any
    );

    // Stub internal dependencies that touch the real DB.
    // @ts-expect-error: override for test
    service.destinationService = {
        updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
    };
    // @ts-expect-error: override for test
    service._destinationModel = {
        findById: vi.fn().mockResolvedValue({ destinationType: DestinationTypeEnum.CITY })
    };
    // @ts-expect-error: override for test
    service._userModel = {
        findById: vi.fn().mockResolvedValue({ serviceSuspended: false, role: 'HOST' })
    };

    return { service, model, rAmenityModel, rFeatureModel, amenityModel, featureCatalogModel };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('AccommodationService junction sync (SPEC-172)', () => {
    let fixtures: Fixtures;
    const actor = createAdminActor();

    beforeEach(() => {
        vi.clearAllMocks();
        fixtures = buildFixtures();
    });

    // ── CREATE ─────────────────────────────────────────────────────────────

    describe('create()', () => {
        it('should insert amenity and feature junction rows when both ids are provided', async () => {
            // Arrange
            const {
                service,
                model,
                rAmenityModel,
                rFeatureModel,
                amenityModel,
                featureCatalogModel
            } = fixtures;

            const created = createMockAccommodation({ id: 'acc-001', slug: 'mock-slug' });
            (model.create as Mock).mockResolvedValue(created);
            (model.findById as Mock).mockResolvedValue(created);

            (amenityModel.findById as Mock).mockResolvedValue({ id: UUID_AMENITY_A });
            (featureCatalogModel.findById as Mock).mockResolvedValue({ id: UUID_FEATURE_A });

            const input = createMockAccommodationCreateInput({
                reviewsCount: 0,
                averageRating: 0,
                tags: [],
                amenityIds: [UUID_AMENITY_A],
                featureIds: [UUID_FEATURE_A]
            });

            // Act — pass ctxWithTx to bypass withServiceTransaction (no real DB needed)
            const result = await service.create(actor, input, ctxWithTx);

            // Assert — no service error
            expect(result.error).toBeUndefined();

            // Amenity junction was inserted.
            expect(rAmenityModel.create).toHaveBeenCalledWith(
                expect.objectContaining({ accommodationId: 'acc-001', amenityId: UUID_AMENITY_A }),
                mockTx
            );

            // Feature junction was inserted.
            expect(rFeatureModel.create).toHaveBeenCalledWith(
                expect.objectContaining({ accommodationId: 'acc-001', featureId: UUID_FEATURE_A }),
                mockTx
            );
        });

        it('R-1 regression: undefined amenityIds/featureIds does NOT touch junction tables', async () => {
            // Arrange — no amenityIds / featureIds in input
            const { service, model, rAmenityModel, rFeatureModel } = fixtures;
            const created = createMockAccommodation({ id: 'acc-001', slug: 'mock-slug' });
            (model.create as Mock).mockResolvedValue(created);
            (model.findById as Mock).mockResolvedValue(created);

            const input = createMockAccommodationCreateInput({
                reviewsCount: 0,
                averageRating: 0,
                tags: []
                // amenityIds and featureIds intentionally absent
            });

            // Act — no tx needed because no junction sync
            const result = await service.create(actor, input);

            // Assert
            expect(result.error).toBeUndefined();
            expect(rAmenityModel.create).not.toHaveBeenCalled();
            expect(rAmenityModel.hardDelete).not.toHaveBeenCalled();
            expect(rFeatureModel.create).not.toHaveBeenCalled();
            expect(rFeatureModel.hardDelete).not.toHaveBeenCalled();
        });

        it('should throw VALIDATION_ERROR when an amenityId does not exist in catalog', async () => {
            // Arrange
            const { service, model, amenityModel } = fixtures;

            const created = createMockAccommodation({ id: 'acc-001', slug: 'mock-slug' });
            (model.create as Mock).mockResolvedValue(created);

            // Catalog lookup returns null → unknown ID
            (amenityModel.findById as Mock).mockResolvedValue(null);

            const input = createMockAccommodationCreateInput({
                reviewsCount: 0,
                averageRating: 0,
                tags: [],
                amenityIds: [UUID_AMENITY_UNKNOWN]
            });

            // Act + Assert — when ctx.tx is present, runWithLoggingAndValidation re-throws
            // ServiceErrors so the transaction can roll back. We verify the correct error shape.
            await expect(service.create(actor, input, ctxWithTx)).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: expect.stringMatching(/amenity not found/i)
            });
        });

        it('should throw VALIDATION_ERROR when a featureId does not exist in catalog', async () => {
            // Arrange
            const { service, model, featureCatalogModel } = fixtures;

            const created = createMockAccommodation({ id: 'acc-001', slug: 'mock-slug' });
            (model.create as Mock).mockResolvedValue(created);

            // Catalog lookup returns null → unknown ID
            (featureCatalogModel.findById as Mock).mockResolvedValue(null);

            const input = createMockAccommodationCreateInput({
                reviewsCount: 0,
                averageRating: 0,
                tags: [],
                featureIds: [UUID_FEATURE_UNKNOWN]
            });

            // Act + Assert — same re-throw behavior inside ctx.tx
            await expect(service.create(actor, input, ctxWithTx)).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: expect.stringMatching(/feature not found/i)
            });
        });

        it('should call junctionModel.create zero times when empty arrays are provided', async () => {
            // Arrange — explicit empty arrays mean "clear all" on create
            const { service, model, rAmenityModel, rFeatureModel } = fixtures;
            const created = createMockAccommodation({ id: 'acc-001', slug: 'mock-slug' });
            (model.create as Mock).mockResolvedValue(created);
            (model.findById as Mock).mockResolvedValue(created);

            const input = createMockAccommodationCreateInput({
                reviewsCount: 0,
                averageRating: 0,
                tags: [],
                amenityIds: [],
                featureIds: []
            });

            // Act
            const result = await service.create(actor, input, ctxWithTx);

            // Assert — no inserts (nothing to insert), no deletes (nothing existed)
            expect(result.error).toBeUndefined();
            expect(rAmenityModel.create).not.toHaveBeenCalled();
            expect(rFeatureModel.create).not.toHaveBeenCalled();
        });
    });

    // ── UPDATE ────────────────────────────────────────────────────────────

    describe('update()', () => {
        it('R-1 regression: undefined amenityIds/featureIds does NOT touch junction tables', async () => {
            // Arrange — update payload has NO junction fields
            const { service, model, rAmenityModel, rFeatureModel } = fixtures;
            const existing = createMockAccommodation({ id: 'acc-001' });
            (model.findById as Mock).mockResolvedValue(existing);
            (model.update as Mock).mockResolvedValue({ ...existing, name: 'Updated' });

            // Act — no tx needed, no junction sync triggered
            const result = await service.update(actor, 'acc-001', { name: 'Updated' });

            // Assert — no junction calls at all
            expect(result.error).toBeUndefined();
            expect(rAmenityModel.findAll).not.toHaveBeenCalled();
            expect(rAmenityModel.create).not.toHaveBeenCalled();
            expect(rAmenityModel.hardDelete).not.toHaveBeenCalled();
            expect(rFeatureModel.findAll).not.toHaveBeenCalled();
            expect(rFeatureModel.create).not.toHaveBeenCalled();
            expect(rFeatureModel.hardDelete).not.toHaveBeenCalled();
        });

        it('should sync amenities: delete-absent and insert-added', async () => {
            // Arrange — existing: [A, B]; target: [B, C] → delete A, insert C
            const { service, model, rAmenityModel, amenityModel } = fixtures;

            const existing = createMockAccommodation({ id: 'acc-001' });
            (model.findById as Mock).mockResolvedValue(existing);
            (model.update as Mock).mockResolvedValue(existing);

            // Junction currently has A and B
            (rAmenityModel.findAll as Mock).mockResolvedValue({
                items: [
                    { accommodationId: 'acc-001', amenityId: UUID_AMENITY_A },
                    { accommodationId: 'acc-001', amenityId: UUID_AMENITY_B }
                ],
                total: 2
            });

            // All catalog IDs exist
            (amenityModel.findById as Mock).mockResolvedValue({ id: 'some-id' });

            // Act — target is [B, C], pass ctxWithTx to avoid opening a new tx
            const result = await service.update(
                actor,
                'acc-001',
                { amenityIds: [UUID_AMENITY_B, UUID_AMENITY_C] },
                ctxWithTx
            );

            // Assert
            expect(result.error).toBeUndefined();

            // A was deleted (not in target)
            expect(rAmenityModel.hardDelete).toHaveBeenCalledWith(
                expect.objectContaining({ accommodationId: 'acc-001', amenityId: UUID_AMENITY_A }),
                mockTx
            );

            // B was NOT deleted (present in both)
            const deleteCalls = (rAmenityModel.hardDelete as Mock).mock.calls;
            const deletedIds = deleteCalls.map(
                (c: unknown[]) => (c[0] as Record<string, string>).amenityId
            );
            expect(deletedIds).not.toContain(UUID_AMENITY_B);

            // C was inserted (in target but not in existing)
            expect(rAmenityModel.create).toHaveBeenCalledWith(
                expect.objectContaining({ accommodationId: 'acc-001', amenityId: UUID_AMENITY_C }),
                mockTx
            );
        });

        it('should clear all amenity relations when amenityIds = []', async () => {
            // Arrange — existing has two amenities; target is []
            const { service, model, rAmenityModel } = fixtures;

            const existing = createMockAccommodation({ id: 'acc-001' });
            (model.findById as Mock).mockResolvedValue(existing);
            (model.update as Mock).mockResolvedValue(existing);

            (rAmenityModel.findAll as Mock).mockResolvedValue({
                items: [
                    { accommodationId: 'acc-001', amenityId: UUID_AMENITY_A },
                    { accommodationId: 'acc-001', amenityId: UUID_AMENITY_B }
                ],
                total: 2
            });

            // Act — clear all
            const result = await service.update(actor, 'acc-001', { amenityIds: [] }, ctxWithTx);

            // Assert — both deleted, none inserted
            expect(result.error).toBeUndefined();
            expect(rAmenityModel.hardDelete).toHaveBeenCalledTimes(2);
            expect(rAmenityModel.create).not.toHaveBeenCalled();
        });

        it('should clear all feature relations when featureIds = []', async () => {
            // Arrange
            const { service, model, rFeatureModel } = fixtures;

            const existing = createMockAccommodation({ id: 'acc-001' });
            (model.findById as Mock).mockResolvedValue(existing);
            (model.update as Mock).mockResolvedValue(existing);

            (rFeatureModel.findAll as Mock).mockResolvedValue({
                items: [{ accommodationId: 'acc-001', featureId: UUID_FEATURE_A }],
                total: 1
            });

            // Act
            const result = await service.update(actor, 'acc-001', { featureIds: [] }, ctxWithTx);

            // Assert
            expect(result.error).toBeUndefined();
            expect(rFeatureModel.hardDelete).toHaveBeenCalledTimes(1);
            expect(rFeatureModel.create).not.toHaveBeenCalled();
        });

        it('should be idempotent: syncing the same ids twice produces no extra inserts/deletes', async () => {
            // Arrange — existing has [A]; target is [A] → no changes
            const { service, model, rAmenityModel, amenityModel } = fixtures;

            const existing = createMockAccommodation({ id: 'acc-001' });
            (model.findById as Mock).mockResolvedValue(existing);
            (model.update as Mock).mockResolvedValue(existing);

            (rAmenityModel.findAll as Mock).mockResolvedValue({
                items: [{ accommodationId: 'acc-001', amenityId: UUID_AMENITY_A }],
                total: 1
            });
            (amenityModel.findById as Mock).mockResolvedValue({ id: UUID_AMENITY_A });

            // Act
            const result = await service.update(
                actor,
                'acc-001',
                { amenityIds: [UUID_AMENITY_A] },
                ctxWithTx
            );

            // Assert — no deletes and no inserts (A already exists in target)
            expect(result.error).toBeUndefined();
            expect(rAmenityModel.hardDelete).not.toHaveBeenCalled();
            expect(rAmenityModel.create).not.toHaveBeenCalled();
        });

        it('should throw VALIDATION_ERROR when an unknown amenityId is provided on update', async () => {
            // Arrange
            const { service, model, amenityModel } = fixtures;

            const existing = createMockAccommodation({ id: 'acc-001' });
            (model.findById as Mock).mockResolvedValue(existing);
            (model.update as Mock).mockResolvedValue(existing);

            // Catalog says unknown ID does not exist
            (amenityModel.findById as Mock).mockResolvedValue(null);

            // Act + Assert — ServiceError is re-thrown when ctx.tx is present
            await expect(
                service.update(actor, 'acc-001', { amenityIds: [UUID_AMENITY_UNKNOWN] }, ctxWithTx)
            ).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: expect.stringMatching(/amenity not found/i)
            });
        });

        it('should throw VALIDATION_ERROR when an unknown featureId is provided on update', async () => {
            // Arrange
            const { service, model, featureCatalogModel } = fixtures;

            const existing = createMockAccommodation({ id: 'acc-001' });
            (model.findById as Mock).mockResolvedValue(existing);
            (model.update as Mock).mockResolvedValue(existing);

            (featureCatalogModel.findById as Mock).mockResolvedValue(null);

            // Act + Assert — ServiceError is re-thrown when ctx.tx is present
            await expect(
                service.update(actor, 'acc-001', { featureIds: [UUID_FEATURE_UNKNOWN] }, ctxWithTx)
            ).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: expect.stringMatching(/feature not found/i)
            });
        });

        it('should sync both amenities and features simultaneously', async () => {
            // Arrange — update payload has both amenityIds and featureIds
            const {
                service,
                model,
                rAmenityModel,
                rFeatureModel,
                amenityModel,
                featureCatalogModel
            } = fixtures;

            const existing = createMockAccommodation({ id: 'acc-001' });
            (model.findById as Mock).mockResolvedValue(existing);
            (model.update as Mock).mockResolvedValue(existing);

            // Both junction tables start empty
            (rAmenityModel.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
            (rFeatureModel.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

            (amenityModel.findById as Mock).mockResolvedValue({ id: UUID_AMENITY_A });
            (featureCatalogModel.findById as Mock).mockResolvedValue({ id: UUID_FEATURE_B });

            // Act
            const result = await service.update(
                actor,
                'acc-001',
                {
                    amenityIds: [UUID_AMENITY_A],
                    featureIds: [UUID_FEATURE_B]
                },
                ctxWithTx
            );

            // Assert — both junctions were populated
            expect(result.error).toBeUndefined();
            expect(rAmenityModel.create).toHaveBeenCalledOnce();
            expect(rFeatureModel.create).toHaveBeenCalledOnce();
        });
    });
});
