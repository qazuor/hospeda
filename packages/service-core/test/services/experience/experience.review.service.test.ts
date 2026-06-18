/**
 * experience.review.service.test.ts
 *
 * Unit tests for ExperienceReviewService (SPEC-240 T-017).
 *
 * Coverage:
 * - moderateReview: permission gate, NOT_FOUND, approve/reject path,
 *   rating recompute triggered.
 * - getPendingCount: permission gate, count delegation.
 * - listByExperience: returns APPROVED+ACTIVE reviews only.
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
import type { ExperienceReview } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type ExperienceReviewModerateInput,
    ExperienceReviewService
} from '../../../src/services/experience/experience.review.service';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// biome-ignore lint/suspicious/noExplicitAny: test helper — explicit any is intentional for mock wiring
type AnyService = any;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REVIEW_ID = '00000000-0000-4000-a000-000000000001';
const EXPERIENCE_ID = '00000000-0000-4000-a000-000000000002';
const REVIEWER_ID = '00000000-0000-4000-a000-000000000003';
const STAFF_ID = '00000000-0000-4000-a000-000000000004';
const OTHER_USER = '00000000-0000-4000-a000-000000000005';

function makeReview(overrides: Partial<Record<string, unknown>> = {}): ExperienceReview {
    return {
        id: REVIEW_ID,
        experienceId: EXPERIENCE_ID,
        userId: REVIEWER_ID,
        overallRating: 4,
        averageRating: 0,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.PENDING,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as ExperienceReview;
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

const otherActor: Actor = {
    id: OTHER_USER,
    role: RoleEnum.USER,
    permissions: []
};

// ---------------------------------------------------------------------------
// Mock model factory for review model
// ---------------------------------------------------------------------------

function makeReviewModel(review: ExperienceReview | null = null) {
    return {
        entityName: 'experience_reviews',
        findById: vi.fn().mockResolvedValue(review),
        findOne: vi.fn().mockResolvedValue(null), // default: no duplicate
        findAll: vi
            .fn()
            .mockResolvedValue({ items: review ? [review] : [], total: review ? 1 : 0 }),
        create: vi.fn().mockImplementation(async (data: Partial<ExperienceReview>) => ({
            id: REVIEW_ID,
            ...data
        })),
        update: vi
            .fn()
            .mockImplementation(async (_where: unknown, data: Partial<ExperienceReview>) => ({
                id: REVIEW_ID,
                ...data
            })),
        softDelete: vi.fn().mockResolvedValue(undefined),
        hardDelete: vi.fn().mockResolvedValue(undefined),
        restore: vi.fn().mockResolvedValue(undefined),
        findWithRelations: vi.fn().mockResolvedValue(review),
        count: vi.fn().mockResolvedValue(0),
        getTable: vi.fn(),
        raw: vi.fn()
    };
}

function makeExperienceModelMock() {
    return {
        entityName: 'experiences',
        findById: vi.fn().mockResolvedValue({ id: EXPERIENCE_ID }),
        update: vi.fn().mockResolvedValue({ id: EXPERIENCE_ID })
    };
}

function makeService(review: ExperienceReview | null = null): ExperienceReviewService {
    const service: AnyService = new ExperienceReviewService({});
    service.model = makeReviewModel(review);
    service._experienceModel = makeExperienceModelMock();
    // Stub out _experienceService.recomputeRating to avoid DB calls
    service._experienceService = {
        recomputeRating: vi.fn().mockResolvedValue({ data: null })
    };
    return service as ExperienceReviewService;
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

describe('ExperienceReviewService.moderateReview', () => {
    it('should return FORBIDDEN when actor lacks COMMERCE_MODERATE_REVIEW', async () => {
        const service = makeService(makeReview());
        const input: ExperienceReviewModerateInput = {
            id: REVIEW_ID,
            decision: ModerationStatusEnum.APPROVED
        };
        const result = await service.moderateReview(input, reviewerActor);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return NOT_FOUND when review does not exist', async () => {
        const service = makeService(null);
        const input: ExperienceReviewModerateInput = {
            id: REVIEW_ID,
            decision: ModerationStatusEnum.APPROVED
        };
        const result = await service.moderateReview(input, staffActor);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should approve a review and return the updated entity', async () => {
        const review = makeReview();
        const service = makeService(review);
        const input: ExperienceReviewModerateInput = {
            id: REVIEW_ID,
            decision: ModerationStatusEnum.APPROVED
        };
        const result = await service.moderateReview(input, staffActor);
        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();
    });

    it('should reject a review with an optional reason', async () => {
        const review = makeReview();
        const service = makeService(review);
        const input: ExperienceReviewModerateInput = {
            id: REVIEW_ID,
            decision: ModerationStatusEnum.REJECTED,
            reason: 'Inappropriate content'
        };
        const result = await service.moderateReview(input, staffActor);
        expect(result.error).toBeUndefined();
        const updateArgs = (service as AnyService).model.update.mock.calls[0];
        expect(updateArgs?.[1]).toMatchObject({
            moderationState: ModerationStatusEnum.REJECTED,
            moderationReason: 'Inappropriate content'
        });
    });

    it('should call recomputeRating after moderation', async () => {
        const review = makeReview();
        const service = makeService(review);
        const recomputeSpy = vi.spyOn(
            (service as AnyService)._experienceService,
            'recomputeRating'
        );
        await service.moderateReview(
            { id: REVIEW_ID, decision: ModerationStatusEnum.APPROVED },
            staffActor
        );
        expect(recomputeSpy).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// getPendingCount
// ---------------------------------------------------------------------------

describe('ExperienceReviewService.getPendingCount', () => {
    it('should return FORBIDDEN when actor lacks COMMERCE_MODERATE_REVIEW', async () => {
        const service = makeService();
        const result = await service.getPendingCount(reviewerActor);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return the pending count for staff actors', async () => {
        const service = makeService();
        (service as AnyService).model.count.mockResolvedValueOnce(7);
        const result = await service.getPendingCount(staffActor);
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(7);
    });
});

// ---------------------------------------------------------------------------
// listByExperience
// ---------------------------------------------------------------------------

describe('ExperienceReviewService.listByExperience', () => {
    it('should return APPROVED+ACTIVE reviews for a listing', async () => {
        const review = makeReview({ moderationState: ModerationStatusEnum.APPROVED });
        const service = makeService(review);
        const result = await service.listByExperience(EXPERIENCE_ID, reviewerActor);
        expect(result.error).toBeUndefined();
        expect(result.data?.reviews).toBeDefined();
    });

    it('should query with lifecycleState=ACTIVE and moderationState=APPROVED', async () => {
        const service = makeService();
        await service.listByExperience(EXPERIENCE_ID, reviewerActor);
        const findAllArgs = (service as AnyService).model.findAll.mock.calls[0];
        expect(findAllArgs?.[0]).toMatchObject({
            experienceId: EXPERIENCE_ID,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED
        });
    });
});

// ---------------------------------------------------------------------------
// _beforeCreate — duplicate enforcement + moderationState PENDING
// ---------------------------------------------------------------------------

describe('ExperienceReviewService._beforeCreate', () => {
    it('should throw ALREADY_EXISTS when user already reviewed this listing', async () => {
        const existingReview = makeReview();
        const service = makeService(existingReview);
        // findOne returning a row means "user already has a review"
        (service as AnyService).model.findOne.mockResolvedValueOnce(existingReview);

        await expect(
            (service as AnyService)._beforeCreate(
                { experienceId: EXPERIENCE_ID, overallRating: 5 },
                reviewerActor,
                {}
            )
        ).rejects.toMatchObject({ code: ServiceErrorCode.ALREADY_EXISTS });
    });

    it('should force moderationState = PENDING regardless of input', async () => {
        const service = makeService();
        const patch = await (service as AnyService)._beforeCreate(
            { experienceId: EXPERIENCE_ID, overallRating: 4 },
            reviewerActor,
            {}
        );
        expect(patch.moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    it('should set userId to the actor id', async () => {
        const service = makeService();
        const patch = await (service as AnyService)._beforeCreate(
            { experienceId: EXPERIENCE_ID, overallRating: 4 },
            reviewerActor,
            {}
        );
        expect(patch.userId).toBe(REVIEWER_ID);
    });
});

// ---------------------------------------------------------------------------
// _canCreate
// ---------------------------------------------------------------------------

describe('ExperienceReviewService._canCreate', () => {
    it('should throw FORBIDDEN when actor has no id (unauthenticated)', () => {
        const service = makeService();
        expect(() =>
            (service as AnyService)._canCreate(unauthActor, {
                experienceId: EXPERIENCE_ID,
                overallRating: 3
            })
        ).toThrow();
    });

    it('should not throw for an authenticated actor', () => {
        const service = makeService();
        expect(() =>
            (service as AnyService)._canCreate(reviewerActor, {
                experienceId: EXPERIENCE_ID,
                overallRating: 4
            })
        ).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// _canUpdate / _canHardDelete / _canRestore — staff-only gates
// ---------------------------------------------------------------------------

describe('ExperienceReviewService permission gates (staff-only)', () => {
    it('_canUpdate: should throw FORBIDDEN for non-staff actor', () => {
        const review = makeReview();
        const service = makeService(review);
        expect(() => (service as AnyService)._canUpdate(reviewerActor, review)).toThrow();
    });

    it('_canUpdate: should not throw for staff actor', () => {
        const review = makeReview();
        const service = makeService(review);
        expect(() => (service as AnyService)._canUpdate(staffActor, review)).not.toThrow();
    });

    it('_canHardDelete: should throw FORBIDDEN for non-staff actor', () => {
        const review = makeReview();
        const service = makeService(review);
        expect(() => (service as AnyService)._canHardDelete(reviewerActor, review)).toThrow();
    });

    it('_canRestore: should throw FORBIDDEN for non-staff actor', () => {
        const review = makeReview();
        const service = makeService(review);
        expect(() => (service as AnyService)._canRestore(reviewerActor, review)).toThrow();
    });
});

// ---------------------------------------------------------------------------
// _canSoftDelete — author OR staff may delete
// ---------------------------------------------------------------------------

describe('ExperienceReviewService._canSoftDelete', () => {
    it('should allow the review author to soft-delete their own review', () => {
        const review = makeReview();
        const service = makeService(review);
        expect(() => (service as AnyService)._canSoftDelete(reviewerActor, review)).not.toThrow();
    });

    it('should allow staff to soft-delete any review', () => {
        const review = makeReview();
        const service = makeService(review);
        expect(() => (service as AnyService)._canSoftDelete(staffActor, review)).not.toThrow();
    });

    it('should throw FORBIDDEN for a non-author non-staff actor', () => {
        const review = makeReview();
        const service = makeService(review);
        expect(() => (service as AnyService)._canSoftDelete(otherActor, review)).toThrow();
    });
});

// ---------------------------------------------------------------------------
// _executeSearch / _executeCount force-override to APPROVED+ACTIVE
// ---------------------------------------------------------------------------

describe('ExperienceReviewService._executeSearch force-filter', () => {
    it('should always query with lifecycleState=ACTIVE and moderationState=APPROVED', async () => {
        const service = makeService();
        await (service as AnyService)._executeSearch({ page: 1, pageSize: 10 }, reviewerActor, {});
        const findAllArgs = (service as AnyService).model.findAll.mock.calls[0];
        expect(findAllArgs?.[0]).toMatchObject({
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED
        });
    });

    it('_executeCount should also force-filter to APPROVED+ACTIVE', async () => {
        const service = makeService();
        await (service as AnyService)._executeCount({ page: 1, pageSize: 10 }, reviewerActor, {});
        const countArgs = (service as AnyService).model.count.mock.calls[0];
        expect(countArgs?.[0]).toMatchObject({
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED
        });
    });
});
