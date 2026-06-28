/**
 * gastronomy.review.service.test.ts
 *
 * Unit tests for GastronomyReviewService (SPEC-239 T-039).
 *
 * Coverage:
 * - moderateReview: permission gate, NOT_FOUND, approve/reject path,
 *   rating recompute triggered.
 * - getPendingCount: permission gate, count delegation.
 * - listByGastronomy: returns APPROVED+ACTIVE reviews only.
 * - _beforeCreate: duplicate review prevention (ALREADY_EXISTS), moderationState forced PENDING.
 * - _canCreate: requires authentication.
 * - _canUpdate / _canHardDelete / _canRestore: staff-only gates.
 * - _canSoftDelete: author OR staff may delete.
 *
 * DB interactions are fully mocked — no real DB is touched.
 */

import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { GastronomyReview } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type GastronomyReviewModerateInput,
    GastronomyReviewService
} from '../../../src/services/gastronomy/gastronomy.review.service';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

type AnyService = any;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REVIEW_ID = '00000000-0000-4000-a000-000000000001';
const GASTRONOMY_ID = '00000000-0000-4000-a000-000000000002';
const REVIEWER_ID = '00000000-0000-4000-a000-000000000003';
const STAFF_ID = '00000000-0000-4000-a000-000000000004';
const OTHER_USER = '00000000-0000-4000-a000-000000000005';

function makeReview(overrides: Partial<Record<string, unknown>> = {}): GastronomyReview {
    return {
        id: REVIEW_ID,
        gastronomyId: GASTRONOMY_ID,
        userId: REVIEWER_ID,
        overallRating: 4,
        averageRating: 0,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.PENDING,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as GastronomyReview;
}

const staffActor: Actor = {
    id: STAFF_ID,
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.COMMERCE_EDIT_ALL,
        PermissionEnum.COMMERCE_MODERATE_REVIEW,
        PermissionEnum.COMMERCE_VIEW_ALL
    ]
};

const reviewerActor: Actor = {
    id: REVIEWER_ID,
    role: RoleEnum.USER,
    permissions: []
};

const unauthActor: Actor = {
    id: '',
    role: RoleEnum.GUEST,
    permissions: []
};

// ---------------------------------------------------------------------------
// Mock model factory for review model
// ---------------------------------------------------------------------------

function makeReviewModel(review: GastronomyReview | null = null) {
    return {
        entityName: 'gastronomy_review',
        findById: vi.fn().mockResolvedValue(review),
        findOne: vi.fn().mockResolvedValue(null), // default: no duplicate
        findAll: vi
            .fn()
            .mockResolvedValue({ items: review ? [review] : [], total: review ? 1 : 0 }),
        // findAllWithRelations is used by listByGastronomy (Bug B7b fix)
        findAllWithRelations: vi
            .fn()
            .mockResolvedValue({ items: review ? [review] : [], total: review ? 1 : 0 }),
        create: vi.fn().mockImplementation(async (data: Partial<GastronomyReview>) => ({
            id: REVIEW_ID,
            ...data
        })),
        update: vi
            .fn()
            .mockImplementation(async (_where: unknown, data: Partial<GastronomyReview>) => ({
                id: REVIEW_ID,
                gastronomyId: GASTRONOMY_ID,
                ...data
            })),
        softDelete: vi.fn().mockResolvedValue(undefined),
        hardDelete: vi.fn().mockResolvedValue(undefined),
        restore: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(3)
    };
}

function makeGastronomyModel() {
    return {
        update: vi.fn().mockResolvedValue({ id: GASTRONOMY_ID, averageRating: 4.0 })
    };
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function makeService(review: GastronomyReview | null = null): GastronomyReviewService {
    const service: AnyService = new GastronomyReviewService({});
    service.model = makeReviewModel(review);
    service._gastronomyModel = makeGastronomyModel();
    // GastronomyService.recomputeRating is called inside the review service;
    // stub it to prevent cascading model dependencies.
    service._gastronomyService = {
        recomputeRating: vi.fn().mockResolvedValue({ data: null })
    };
    return service as GastronomyReviewService;
}

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) =>
        (actor as Actor).permissions.includes(permission)
    );
});

// ---------------------------------------------------------------------------
// moderateReview
// ---------------------------------------------------------------------------

describe('GastronomyReviewService.moderateReview', () => {
    it('should return FORBIDDEN when actor lacks COMMERCE_MODERATE_REVIEW', async () => {
        const service = makeService();
        const result = await service.moderateReview(
            { id: REVIEW_ID, decision: ModerationStatusEnum.APPROVED },
            reviewerActor
        );
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return NOT_FOUND when review does not exist', async () => {
        const service = makeService(null);
        const result = await service.moderateReview(
            { id: REVIEW_ID, decision: ModerationStatusEnum.APPROVED },
            staffActor
        );
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should approve a review and return the updated entity', async () => {
        const review = makeReview({ deletedAt: null });
        const service = makeService(review);
        const input: GastronomyReviewModerateInput = {
            id: REVIEW_ID,
            decision: ModerationStatusEnum.APPROVED
        };
        const result = await service.moderateReview(input, staffActor);
        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();
    });

    it('should reject a review and return the updated entity', async () => {
        const review = makeReview({ deletedAt: null });
        const service = makeService(review);
        const input: GastronomyReviewModerateInput = {
            id: REVIEW_ID,
            decision: ModerationStatusEnum.REJECTED,
            reason: 'Inappropriate content'
        };
        const result = await service.moderateReview(input, staffActor);
        expect(result.error).toBeUndefined();
        expect((service as AnyService).model.update).toHaveBeenCalledWith(
            expect.objectContaining({ id: REVIEW_ID }),
            expect.objectContaining({ moderationState: ModerationStatusEnum.REJECTED }),
            undefined
        );
    });

    it('should trigger rating recompute after moderation decision', async () => {
        const review = makeReview({ deletedAt: null });
        const service = makeService(review);
        const recomputeSpy = (service as AnyService)._gastronomyService.recomputeRating;

        await service.moderateReview(
            { id: REVIEW_ID, decision: ModerationStatusEnum.APPROVED },
            staffActor
        );

        expect(recomputeSpy).toHaveBeenCalledWith(GASTRONOMY_ID, expect.any(Array), undefined);
    });
});

// ---------------------------------------------------------------------------
// getPendingCount
// ---------------------------------------------------------------------------

describe('GastronomyReviewService.getPendingCount', () => {
    it('should return FORBIDDEN when actor lacks COMMERCE_MODERATE_REVIEW', async () => {
        const service = makeService();
        const result = await service.getPendingCount(reviewerActor);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return the pending review count for staff', async () => {
        const service = makeService();
        (service as AnyService).model.count.mockResolvedValue(7);
        const result = await service.getPendingCount(staffActor);
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(7);
    });

    it('should query only PENDING, non-deleted reviews', async () => {
        const service = makeService();
        const mockCount = (service as AnyService).model.count;

        await service.getPendingCount(staffActor);

        expect(mockCount).toHaveBeenCalledWith(
            expect.objectContaining({
                moderationState: ModerationStatusEnum.PENDING,
                deletedAt: null
            }),
            expect.any(Object)
        );
    });
});

// ---------------------------------------------------------------------------
// listByGastronomy
// ---------------------------------------------------------------------------

describe('GastronomyReviewService.listByGastronomy', () => {
    it('should return the list of APPROVED+ACTIVE reviews for a listing', async () => {
        const approvedReview = makeReview({
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            deletedAt: null
        });
        const service = makeService(approvedReview);
        const result = await service.listByGastronomy(GASTRONOMY_ID, staffActor);
        expect(result.error).toBeUndefined();
        expect(result.data?.reviews).toBeDefined();
        expect(result.data?.total).toBeGreaterThanOrEqual(0);
    });

    it('should query with APPROVED + ACTIVE + deletedAt: null filters via findAllWithRelations (Bug B7b fix)', async () => {
        const service = makeService();
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await service.listByGastronomy(GASTRONOMY_ID, staffActor);

        // After B7b fix: listByGastronomy uses findAllWithRelations (arg[0]=relations, arg[1]=where)
        expect(mockFindAllWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ user: true }),
            expect.objectContaining({
                gastronomyId: GASTRONOMY_ID,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                moderationState: ModerationStatusEnum.APPROVED,
                deletedAt: null
            }),
            expect.any(Object),
            undefined,
            undefined
        );
    });
});

// ---------------------------------------------------------------------------
// _beforeCreate: duplicate review prevention
// ---------------------------------------------------------------------------

describe('GastronomyReviewService._beforeCreate', () => {
    it('should throw ALREADY_EXISTS when user has an existing review', async () => {
        const existingReview = makeReview();
        const service = makeService();
        (service as AnyService).model.findOne.mockResolvedValue(existingReview);

        const beforeCreate = (service as AnyService)._beforeCreate.bind(service);
        await expect(
            beforeCreate({ gastronomyId: GASTRONOMY_ID, overallRating: 4 }, reviewerActor, {
                hookState: {}
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.ALREADY_EXISTS });
    });

    it('should return moderationState PENDING when no duplicate exists', async () => {
        const service = makeService();
        (service as AnyService).model.findOne.mockResolvedValue(null);

        const beforeCreate = (service as AnyService)._beforeCreate.bind(service);
        const patch = await beforeCreate(
            { gastronomyId: GASTRONOMY_ID, overallRating: 4 },
            reviewerActor,
            { hookState: {} }
        );

        expect(patch.moderationState).toBe(ModerationStatusEnum.PENDING);
        expect(patch.userId).toBe(REVIEWER_ID);
    });
});

// ---------------------------------------------------------------------------
// Permission hooks
// ---------------------------------------------------------------------------

describe('GastronomyReviewService permission hooks', () => {
    it('_canCreate should throw FORBIDDEN for unauthenticated actor', () => {
        const service = makeService();
        expect(() => (service as AnyService)._canCreate(unauthActor, {})).toThrow();
    });

    it('_canCreate should allow authenticated actor', () => {
        const service = makeService();
        expect(() => (service as AnyService)._canCreate(reviewerActor, {})).not.toThrow();
    });

    it('_canUpdate should throw FORBIDDEN without COMMERCE_EDIT_ALL', () => {
        const service = makeService();
        expect(() => (service as AnyService)._canUpdate(reviewerActor, {})).toThrow();
    });

    it('_canUpdate should allow staff with COMMERCE_EDIT_ALL', () => {
        const service = makeService();
        expect(() => (service as AnyService)._canUpdate(staffActor, {})).not.toThrow();
    });

    it('_canSoftDelete should allow review author', () => {
        const review = makeReview();
        const service = makeService(review);
        expect(() => (service as AnyService)._canSoftDelete(reviewerActor, review)).not.toThrow();
    });

    it('_canSoftDelete should allow staff with COMMERCE_EDIT_ALL', () => {
        const review = makeReview();
        const service = makeService(review);
        expect(() => (service as AnyService)._canSoftDelete(staffActor, review)).not.toThrow();
    });

    it('_canSoftDelete should throw FORBIDDEN for non-author without COMMERCE_EDIT_ALL', () => {
        const review = makeReview();
        const service = makeService(review);
        const stranger: Actor = { id: OTHER_USER, role: RoleEnum.USER, permissions: [] };
        expect(() => (service as AnyService)._canSoftDelete(stranger, review)).toThrow();
    });

    it('_canHardDelete should throw FORBIDDEN without COMMERCE_EDIT_ALL', () => {
        const service = makeService();
        expect(() => (service as AnyService)._canHardDelete(reviewerActor, {})).toThrow();
    });

    it('_canRestore should throw FORBIDDEN without COMMERCE_EDIT_ALL', () => {
        const service = makeService();
        expect(() => (service as AnyService)._canRestore(reviewerActor, {})).toThrow();
    });
});

// ---------------------------------------------------------------------------
// ENTITY_NAME
// ---------------------------------------------------------------------------

describe('GastronomyReviewService.ENTITY_NAME', () => {
    it('should be "gastronomyReview"', () => {
        expect(GastronomyReviewService.ENTITY_NAME).toBe('gastronomyReview');
    });
});

// ---------------------------------------------------------------------------
// Bug B7b regression — listByGastronomy loads user relation
// Fixes: review authors always showing "Usuario" (findAll never joined the
// users table; findAllWithRelations with { user: true } does).
// ---------------------------------------------------------------------------

describe('GastronomyReviewService.listByGastronomy — B7b regression (user relation loaded)', () => {
    it('requests user: true in the relations argument of findAllWithRelations', async () => {
        const review = makeReview({
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            deletedAt: null
        });
        const service = makeService(review);
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await service.listByGastronomy(GASTRONOMY_ID, staffActor);

        // arg[0] must include user: true so the DB layer performs the JOIN
        expect(mockFindAllWithRelations.mock.calls[0]?.[0]).toMatchObject({ user: true });
    });

    it('preserves the APPROVED + ACTIVE + deletedAt: null security invariant after loading relations', async () => {
        const service = makeService();
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await service.listByGastronomy(GASTRONOMY_ID, staffActor);

        // arg[1] is the where object — security filters must remain
        expect(mockFindAllWithRelations.mock.calls[0]?.[1]).toMatchObject({
            gastronomyId: GASTRONOMY_ID,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            deletedAt: null
        });
    });

    it('returns a result object with reviews and total', async () => {
        const review = makeReview({
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            deletedAt: null
        });
        const service = makeService(review);

        const result = await service.listByGastronomy(GASTRONOMY_ID, staffActor);

        expect(result.error).toBeUndefined();
        expect(result.data?.reviews).toBeDefined();
        expect(result.data?.total).toBeGreaterThanOrEqual(0);
    });
});
