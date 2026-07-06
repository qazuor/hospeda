/**
 * @fileoverview
 * Unit tests for AccommodationService.verifyAccommodation (SPEC-291).
 *
 * Covers the four business cases:
 * 1. verify   — sets isVerified=true, stamps verifiedAt and verifiedById.
 * 2. unverify — sets isVerified=false, nulls verifiedAt and verifiedById.
 * 3. permission denied — actor without ACCOMMODATION_VERIFY gets FORBIDDEN.
 * 4. not found — unknown id returns the standard NOT_FOUND result.
 */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { Actor, ServiceConfig } from '../../../src/types';
import { makeMediaModelStub } from '../../utils/modelMockFactory';

// ── Inline vi.mock declarations ──────────────────────────────────────────────
// These must live at the top level so Vitest hoists them before imports.

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn(),
        DestinationModel: vi.fn().mockImplementation(function () {
            return { findById: vi.fn() };
        })
    };
});

// ── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** Minimal accommodation row sufficient for verifyAccommodation tests. */
const baseAccommodation = {
    id: ACC_ID,
    ownerId: USER_ID,
    slug: 'test-accommodation',
    isVerified: false,
    verifiedAt: null,
    verifiedById: null,
    type: 'hotel',
    destinationId: null
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal mock of AccommodationModel — only the methods used by
 * verifyAccommodation (findById + update) need return values; the
 * rest are no-ops to avoid "not a function" errors from the base class.
 */
class MockAccommodationModel {
    findById = vi.fn();
    update = vi.fn();
    findOne = vi.fn();
    findOneWithRelations = vi.fn();
    findWithRelations = vi.fn();
    findAllWithRelations = vi.fn();
    findAll = vi.fn();
    create = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
    count = vi.fn();
    /** Suppress SPEC-230 soft-delete predicate injection in list paths. */
    getTable = vi.fn().mockReturnValue({});
    getTableName = vi.fn().mockReturnValue('accommodations');
}

/**
 * Creates an Actor with the specified permissions.
 *
 * @param permissions - Permission flags the actor holds.
 * @param id          - Actor id (defaults to ADMIN_ID).
 */
function actorWith(permissions: PermissionEnum[], id = ADMIN_ID): Actor {
    return {
        id,
        role: RoleEnum.ADMIN,
        permissions
    };
}

/**
 * Builds an AccommodationService with a mocked model and the minimum
 * constructor arguments required by verifyAccommodation.
 *
 * The 10th constructor arg is the media model stub (SPEC-204 T-013):
 * read hooks call findByAccommodations; without the stub they throw on
 * any path that touches _afterGetByField.
 */
function buildService(model: MockAccommodationModel): AccommodationService {
    return new AccommodationService(
        {} as ServiceConfig,
        // biome-ignore lint/suspicious/noExplicitAny: test stub
        model as any,
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
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AccommodationService.verifyAccommodation (SPEC-291)', () => {
    let model: MockAccommodationModel;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        model = new MockAccommodationModel();
        service = buildService(model);
    });

    // ── verify ───────────────────────────────────────────────────────────────

    describe('when isVerified = true (verify action)', () => {
        it('should set isVerified=true, stamp verifiedAt and verifiedById', async () => {
            // Arrange
            const now = new Date('2026-07-01T00:00:00.000Z');
            vi.setSystemTime(now);

            model.findById.mockResolvedValue({ ...baseAccommodation });
            const updatedRow = {
                ...baseAccommodation,
                isVerified: true,
                verifiedAt: now,
                verifiedById: ADMIN_ID
            };
            model.update.mockResolvedValue(updatedRow);

            const actor = actorWith([PermissionEnum.ACCOMMODATION_VERIFY]);

            // Act
            const result = await service.verifyAccommodation(actor, ACC_ID, true);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.isVerified).toBe(true);
            expect(result.data?.verifiedById).toBe(ADMIN_ID);
            expect(result.data?.verifiedAt).toEqual(now);

            expect(model.update).toHaveBeenCalledWith(
                { id: ACC_ID },
                expect.objectContaining({
                    isVerified: true,
                    verifiedAt: now,
                    verifiedById: ADMIN_ID,
                    updatedById: ADMIN_ID
                }),
                undefined
            );
        });
    });

    // ── unverify ─────────────────────────────────────────────────────────────

    describe('when isVerified = false (unverify action)', () => {
        it('should set isVerified=false and null out verifiedAt and verifiedById', async () => {
            // Arrange
            model.findById.mockResolvedValue({
                ...baseAccommodation,
                isVerified: true,
                verifiedAt: new Date('2026-06-01T00:00:00.000Z'),
                verifiedById: ADMIN_ID
            });
            const updatedRow = {
                ...baseAccommodation,
                isVerified: false,
                verifiedAt: null,
                verifiedById: null
            };
            model.update.mockResolvedValue(updatedRow);

            const actor = actorWith([PermissionEnum.ACCOMMODATION_VERIFY]);

            // Act
            const result = await service.verifyAccommodation(actor, ACC_ID, false);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.isVerified).toBe(false);
            expect(result.data?.verifiedAt).toBeNull();
            expect(result.data?.verifiedById).toBeNull();

            expect(model.update).toHaveBeenCalledWith(
                { id: ACC_ID },
                expect.objectContaining({
                    isVerified: false,
                    verifiedAt: null,
                    verifiedById: null,
                    updatedById: ADMIN_ID
                }),
                undefined
            );
        });
    });

    // ── permission denied ─────────────────────────────────────────────────────

    describe('when the actor lacks ACCOMMODATION_VERIFY', () => {
        it('should return FORBIDDEN without touching the model', async () => {
            // Arrange — actor has an unrelated permission, but NOT ACCOMMODATION_VERIFY
            const actor = actorWith([PermissionEnum.ACCOMMODATION_VIEW_ALL]);

            // Act
            const result = await service.verifyAccommodation(actor, ACC_ID, true);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.findById).not.toHaveBeenCalled();
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should return FORBIDDEN for an actor with an empty permission set', async () => {
            // Arrange
            const actor = actorWith([]);

            // Act
            const result = await service.verifyAccommodation(actor, ACC_ID, false);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // ── not found ─────────────────────────────────────────────────────────────

    describe('when the accommodation does not exist', () => {
        it('should return NOT_FOUND without calling update', async () => {
            // Arrange
            model.findById.mockResolvedValue(null);
            const actor = actorWith([PermissionEnum.ACCOMMODATION_VERIFY]);

            // Act
            const result = await service.verifyAccommodation(actor, 'unknown-id', true);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(model.update).not.toHaveBeenCalled();
        });
    });
});
