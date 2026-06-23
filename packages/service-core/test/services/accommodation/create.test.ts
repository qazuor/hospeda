import type { AccommodationModel } from '@repo/db';
import { DestinationTypeEnum, ModerationStatusEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createMockAccommodationCreateInput } from '../../factories/accommodationFactory';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

/**
 * FIX 1 (SPEC-204): AccommodationService.create() now opens a transaction when
 * `media` is present in the payload. Unit tests have no real DB, so we mock
 * `withServiceTransaction` to execute the callback inline without opening a
 * Drizzle transaction. This lets all existing create() tests continue to verify
 * business-logic outcomes (permissions, validation, model calls) without a DB.
 *
 * The mock supplies a minimal ctx with a null tx and empty hookState so the
 * callback runs in the same context as before the fix. Errors propagate
 * naturally (no tx → no re-throw in runWithLoggingAndValidation catch).
 */
vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (
            fn: (ctx: { tx: object; hookState: Record<string, unknown> }) => Promise<unknown>,
            baseCtx?: { hookState?: Record<string, unknown> }
        ) => {
            // Provide a truthy tx stub so the !ctx.tx guards in _afterCreate/_afterUpdate
            // don't fire. The injected AccommodationMediaModel stub swallows all DB calls.
            const ctx = { ...baseCtx, tx: {}, hookState: baseCtx?.hookState ?? {} };
            try {
                return await fn(ctx as never);
            } catch (err) {
                // runWithLoggingAndValidation re-throws ServiceError when ctx.tx is truthy.
                // Detect via duck-type (has .code + .name) and wrap back into { error } so
                // unit tests asserting on result.error work without a real DB or tx rollback.
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

/**
 * Minimal no-op stub for AccommodationMediaModel.
 * FIX 1 (SPEC-204): create() now calls syncAccommodationMedia inside the (mocked)
 * transaction. These unit tests inject a stub that swallows hardDelete/create so
 * tests do not need a real DB connection.
 */
function makeMediaModelStub() {
    return {
        hardDelete: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue(undefined),
        findById: vi.fn(),
        findOne: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn(),
        restore: vi.fn(),
        count: vi.fn(),
        findAll: vi.fn(),
        findByAccommodation: vi.fn(),
        findFeatured: vi.fn()
    };
}

// Mocks
const mockLogger = createLoggerMock();

beforeEach(() => {
    vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
});

describe('AccommodationService.create', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createMockBaseModel>;
    beforeEach(() => {
        model = createMockBaseModel();
        service = new AccommodationService(
            { logger: mockLogger },
            model as AccommodationModel,
            null,
            undefined,
            null,
            undefined,
            undefined,
            undefined,
            undefined,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any
        );
        // Mock destinationService.updateAccommodationsCount para evitar acceso real a DB
        // @ts-expect-error: override for test
        service.destinationService = {
            updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
        };
        // SPEC-095: stub the private destination model so _assertDestinationIsCity
        // resolves a CITY destination without hitting the real DB.
        // @ts-expect-error: override for test
        service._destinationModel = {
            findById: vi.fn().mockResolvedValue({ destinationType: DestinationTypeEnum.CITY })
        };
        // SPEC-143 #29: stub the private user model so _beforeCreate's
        // service-suspension guard resolves a non-suspended owner by default.
        // @ts-expect-error: override for test
        service._userModel = {
            findById: vi.fn().mockResolvedValue({ serviceSuspended: false })
        };
        vi.clearAllMocks();
    });

    it('should create an accommodation when permissions and input are valid', async () => {
        // Arrange
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });

        const created = { ...input, id: 'mock-id', slug: 'mock-slug' };
        (model.create as Mock).mockResolvedValue(created);
        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe('mock-id');
        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalled();
    });

    /**
     * B-1 regression (SPEC-204): create() must open a transaction when `media` is
     * present, even if `amenityIds` and `featureIds` are absent. Before the fix,
     * `_afterCreate` threw INTERNAL_ERROR because it reached the `!ctx.tx` guard.
     */
    it('should create accommodation with media but no amenities/features', async () => {
        // Arrange: payload with media but intentionally NO amenityIds/featureIds.
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: [],
            media: {
                featuredImage: {
                    url: 'https://cdn.example.com/b1-regression.jpg',
                    moderationState: ModerationStatusEnum.APPROVED
                },
                gallery: [
                    {
                        url: 'https://cdn.example.com/b1-gallery-0.jpg',
                        moderationState: ModerationStatusEnum.APPROVED
                    }
                ]
            }
            // No amenityIds, no featureIds
        });

        const created = { ...input, id: 'b1-regression-id', slug: 'mock-slug' };
        (model.create as Mock).mockResolvedValue(created);

        // Act — before the fix this threw ServiceError(INTERNAL_ERROR, 'Media sync requires an active transaction').
        const result = await service.create(actor, input);

        // Assert: no error (200 path, not 500)
        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe('b1-regression-id');
        expect(model.create).toHaveBeenCalled();
    });

    it('should return FORBIDDEN when the owner is service-suspended (SPEC-143 #29)', async () => {
        // Arrange — even an admin cannot create a listing for a paused owner.
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });
        // @ts-expect-error: override for test
        service._userModel = {
            findById: vi.fn().mockResolvedValue({ serviceSuspended: true })
        };
        // Act
        const result = await service.create(actor, input);
        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.error?.message).toMatch(/paused/i);
        expect(result.data).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });
        // Act
        const result = await service.create(actor, input);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const actor = createAdminActor();
        const input = {
            ...createMockAccommodationCreateInput({
                reviewsCount: 0,
                averageRating: 0,
                tags: []
            }),
            name: undefined
        };
        // Act
        const result = await service.create(
            actor,
            input as unknown as Parameters<AccommodationService['create']>[1]
        );
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });
        (model.create as Mock).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.create(actor, input);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    // SPEC-095: destinationType=CITY enforcement
    it('should return VALIDATION_ERROR if destinationId references a non-CITY destination', async () => {
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });
        // @ts-expect-error: override for test
        service._destinationModel = {
            findById: vi.fn().mockResolvedValue({ destinationType: DestinationTypeEnum.PROVINCE })
        };
        const result = await service.create(actor, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toMatch(/CITY/);
        expect(result.data).toBeUndefined();
        expect(model.create).not.toHaveBeenCalled();
    });

    it('should return VALIDATION_ERROR if destinationId does not exist', async () => {
        const actor = createAdminActor();
        const input = createMockAccommodationCreateInput({
            reviewsCount: 0,
            averageRating: 0,
            tags: []
        });
        // @ts-expect-error: override for test
        service._destinationModel = {
            findById: vi.fn().mockResolvedValue(null)
        };
        const result = await service.create(actor, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });
});
