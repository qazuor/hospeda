/**
 * Unit tests for AccommodationExternalListingService (SPEC-237 T-007)
 *
 * Covers:
 * - add: happy path, permission denial (non-owner), duplicate-platform VALIDATION_ERROR,
 *   schema-fail VALIDATION_ERROR, INTERNAL_ERROR for null create result
 * - update: happy path, NOT_FOUND (findById), FORBIDDEN, INTERNAL_ERROR (model.update throws),
 *   VALIDATION_ERROR (schema-fail), NOT_FOUND (model.update returns null)
 * - remove: happy path, NOT_FOUND, FORBIDDEN, INTERNAL_ERROR (softDelete throws)
 * - setMasterToggle: happy path, admin, FORBIDDEN, VALIDATION_ERROR, INTERNAL_ERROR
 */

import {
    ExternalPlatformEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { AccommodationExternalListing } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { AccommodationExternalListingService } from '../../src/services/accommodation-external-reputation/accommodation-external-listing.service.js';
import type { Actor, ServiceConfig } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const ACC_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const LIST_ID = '22222222-2222-4222-8222-222222222222';
const NON_OWNER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function makeAccommodation(overrides: Record<string, unknown> = {}) {
    return {
        id: ACC_ID,
        ownerId: OWNER_ID,
        name: 'Test Accommodation',
        deletedAt: null,
        showExternalReputation: false,
        ...overrides
    };
}

function makeListing(
    overrides: Partial<AccommodationExternalListing> = {}
): AccommodationExternalListing {
    return {
        id: LIST_ID,
        accommodationId: ACC_ID,
        platform: ExternalPlatformEnum.GOOGLE,
        url: 'https://maps.google.com/?cid=12345',
        externalId: 'ChIJ_test',
        showLink: true,
        showReviews: false,
        verified: false,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        createdById: OWNER_ID,
        updatedById: OWNER_ID,
        deletedById: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        deletedAt: null,
        ...overrides
    };
}

function makeOwnerActor(overrides: Partial<Actor> = {}): Actor {
    return {
        id: OWNER_ID,
        role: 'HOST' as never,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN],
        ...overrides
    };
}

function makeAdminActor(overrides: Partial<Actor> = {}): Actor {
    return {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        role: 'ADMIN' as never,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
        ...overrides
    };
}

function makeNonOwnerActor(): Actor {
    return {
        id: NON_OWNER_ID,
        role: 'HOST' as never,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
    };
}

// ---------------------------------------------------------------------------
// Mock model factories
// ---------------------------------------------------------------------------

function makeListingModel(overrides: Record<string, unknown> = {}) {
    return {
        findById: vi.fn().mockResolvedValue(makeListing()),
        create: vi.fn().mockResolvedValue(makeListing()),
        update: vi.fn().mockResolvedValue(makeListing()),
        softDelete: vi.fn().mockResolvedValue(1),
        findByAccommodation: vi.fn().mockResolvedValue([makeListing()]),
        ...overrides
    };
}

function makeAccommodationModel(overrides: Record<string, unknown> = {}) {
    return {
        findById: vi.fn().mockResolvedValue(makeAccommodation()),
        update: vi.fn().mockResolvedValue(makeAccommodation()),
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const ctx: ServiceConfig = {};

describe('AccommodationExternalListingService', () => {
    // -------------------------------------------------------------------------
    // add
    // -------------------------------------------------------------------------

    describe('add', () => {
        it('should create a listing for the owner — happy path', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.add(makeOwnerActor(), {
                accommodationId: ACC_ID,
                platform: ExternalPlatformEnum.GOOGLE,
                url: 'https://maps.google.com/?cid=12345',
                showLink: true,
                showReviews: false
            });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(listingModel.create).toHaveBeenCalledOnce();
        });

        it('should allow admin to add a listing for any accommodation', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.add(makeAdminActor(), {
                accommodationId: ACC_ID,
                platform: ExternalPlatformEnum.BOOKING,
                url: 'https://www.booking.com/hotel/ar/test.html',
                showLink: false,
                showReviews: false
            });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
        });

        it('should return FORBIDDEN when a non-owner tries to add', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.add(makeNonOwnerActor(), {
                accommodationId: ACC_ID,
                platform: ExternalPlatformEnum.GOOGLE,
                url: 'https://maps.google.com/?cid=12345',
                showLink: false,
                showReviews: false
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return VALIDATION_ERROR on duplicate platform (unique constraint violation)', async () => {
            const listingModel = makeListingModel({
                create: vi
                    .fn()
                    .mockRejectedValue(new Error('duplicate key value violates unique constraint'))
            });
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.add(makeOwnerActor(), {
                accommodationId: ACC_ID,
                platform: ExternalPlatformEnum.GOOGLE,
                url: 'https://maps.google.com/?cid=12345',
                showLink: false,
                showReviews: false
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.details).toMatchObject({ reason: 'DUPLICATE_PLATFORM' });
        });

        it('should return VALIDATION_ERROR when the input schema fails', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            // Missing required `platform`
            const result = await svc.add(makeOwnerActor(), {
                accommodationId: ACC_ID,
                platform: 'INVALID_PLATFORM' as never,
                url: 'https://maps.google.com/?cid=12345',
                showLink: false,
                showReviews: false
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('should return NOT_FOUND when the accommodation is soft-deleted (resolveAccommodationOwnerId)', async () => {
            // Exercises lines 81-85: resolveAccommodationOwnerId throws NOT_FOUND when
            // accommodation.deletedAt is not null. The ServiceError propagates through add()'s
            // catch block at line 187 and is returned as the ServiceError code.
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel({
                findById: vi
                    .fn()
                    .mockResolvedValue({ ...makeAccommodation(), deletedAt: new Date() })
            });
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.add(makeOwnerActor(), {
                accommodationId: ACC_ID,
                platform: ExternalPlatformEnum.GOOGLE,
                url: 'https://maps.google.com/?cid=12345',
                showLink: false,
                showReviews: false
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should return INTERNAL_ERROR when model.create returns null', async () => {
            // Exercises the `!row` defensive guard after create (lines 177-183).
            const listingModel = makeListingModel({
                create: vi.fn().mockResolvedValue(null)
            });
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.add(makeOwnerActor(), {
                accommodationId: ACC_ID,
                platform: ExternalPlatformEnum.GOOGLE,
                url: 'https://maps.google.com/?cid=12345',
                showLink: false,
                showReviews: false
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });

        it('should return INTERNAL_ERROR when create throws an unrecognized (non-unique) error', async () => {
            // Exercises the final fallthrough (non-ServiceError, non-unique/duplicate/conflict)
            // — lines 205-211.
            const listingModel = makeListingModel({
                create: vi.fn().mockRejectedValue(new Error('disk full'))
            });
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.add(makeOwnerActor(), {
                accommodationId: ACC_ID,
                platform: ExternalPlatformEnum.GOOGLE,
                url: 'https://maps.google.com/?cid=12345',
                showLink: false,
                showReviews: false
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('disk full');
        });
    });

    // -------------------------------------------------------------------------
    // update
    // -------------------------------------------------------------------------

    describe('update', () => {
        it('should update the listing for the owner — happy path', async () => {
            const updatedListing = makeListing({ showLink: true, showReviews: true });
            const listingModel = makeListingModel({
                update: vi.fn().mockResolvedValue(updatedListing)
            });
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.update(makeOwnerActor(), LIST_ID, {
                showLink: true,
                showReviews: true
            });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
        });

        it('should return NOT_FOUND when the listing does not exist', async () => {
            const listingModel = makeListingModel({ findById: vi.fn().mockResolvedValue(null) });
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.update(makeOwnerActor(), 'nonexistent-id', {
                showLink: false
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should return FORBIDDEN when a non-owner tries to update', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.update(makeNonOwnerActor(), LIST_ID, {
                showLink: true
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return INTERNAL_ERROR when the model.update throws a non-ServiceError', async () => {
            const listingModel = makeListingModel({
                update: vi.fn().mockRejectedValue(new Error('Connection pool exhausted'))
            });
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.update(makeOwnerActor(), LIST_ID, { showLink: true });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('Connection pool exhausted');
        });

        it('should return VALIDATION_ERROR when update input fails the schema', async () => {
            // Exercises lines 238-244: the schema validation path in update().
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            // externalId must be string or null — passing a number fails validation
            const result = await svc.update(makeOwnerActor(), LIST_ID, {
                externalId: 99999 as never
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('should return NOT_FOUND when model.update returns null (row vanished after findById)', async () => {
            // Exercises lines 274-280: the defensive NOT_FOUND guard after update().
            const listingModel = makeListingModel({
                update: vi.fn().mockResolvedValue(null)
            });
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.update(makeOwnerActor(), LIST_ID, { showLink: false });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    // -------------------------------------------------------------------------
    // remove
    // -------------------------------------------------------------------------

    describe('remove', () => {
        it('should soft-delete the listing for the owner — happy path', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.remove(makeOwnerActor(), LIST_ID);

            expect(result.error).toBeUndefined();
            expect(result.data).toBe(true);
            expect(listingModel.softDelete).toHaveBeenCalledOnce();
        });

        it('should return NOT_FOUND when the listing does not exist', async () => {
            const listingModel = makeListingModel({ findById: vi.fn().mockResolvedValue(null) });
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.remove(makeOwnerActor(), 'nonexistent-id');

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should return FORBIDDEN when a non-owner tries to remove', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.remove(makeNonOwnerActor(), LIST_ID);

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return INTERNAL_ERROR when softDelete throws a non-ServiceError', async () => {
            const listingModel = makeListingModel({
                softDelete: vi.fn().mockRejectedValue(new Error('DB connection lost'))
            });
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.remove(makeOwnerActor(), LIST_ID);

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('DB connection lost');
        });

        it('should return INTERNAL_ERROR when softDelete throws a non-Error value (String branch)', async () => {
            // Exercises the `String(err)` branch in `err instanceof Error ? ... : String(err)`.
            // Throwing a non-Error value (string) exercises the false branch of the ternary.
            const listingModel = makeListingModel({
                // eslint-disable-next-line @typescript-eslint/no-throw-literal, @typescript-eslint/prefer-promise-reject-errors
                softDelete: vi.fn().mockRejectedValue('plain string error')
            });
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.remove(makeOwnerActor(), LIST_ID);

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('plain string error');
        });
    });

    // -------------------------------------------------------------------------
    // setMasterToggle
    // -------------------------------------------------------------------------

    describe('setMasterToggle', () => {
        it('should flip showExternalReputation for the owner — happy path', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.setMasterToggle(makeOwnerActor(), ACC_ID, true);

            expect(result.error).toBeUndefined();
            expect(result.data).toBe(true);
            expect(accommodationModel.update).toHaveBeenCalledOnce();
        });

        it('should allow admin to flip the toggle', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.setMasterToggle(makeAdminActor(), ACC_ID, false);

            expect(result.error).toBeUndefined();
            expect(result.data).toBe(true);
        });

        it('should return FORBIDDEN when a non-owner tries to set the toggle', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.setMasterToggle(makeNonOwnerActor(), ACC_ID, true);

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return VALIDATION_ERROR for an invalid accommodationId', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel();
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.setMasterToggle(makeOwnerActor(), 'not-a-uuid', true);

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('should return INTERNAL_ERROR when the accommodationModel.update throws a non-ServiceError', async () => {
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel({
                update: vi.fn().mockRejectedValue(new Error('Unexpected DB error'))
            });
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.setMasterToggle(makeOwnerActor(), ACC_ID, true);

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('Unexpected DB error');
        });

        it('should return INTERNAL_ERROR when the accommodationModel.update throws a non-Error value (String branch)', async () => {
            // Exercises the `String(err)` false branch of the ternary at line 406:
            // `err instanceof Error ? err.message : String(err)`
            const listingModel = makeListingModel();
            const accommodationModel = makeAccommodationModel({
                // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                update: vi.fn().mockRejectedValue('toggle string error')
            });
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.setMasterToggle(makeOwnerActor(), ACC_ID, true);

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('toggle string error');
        });
    });
});
