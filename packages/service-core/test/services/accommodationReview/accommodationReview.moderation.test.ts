/**
 * Tests for AccommodationReviewService moderation features (SPEC-166).
 *
 * Covers:
 *  - T-012: _beforeCreate wires content-moderation → moderationState
 *  - T-014: moderateReview (approve / reject / permission-denied / not-found)
 *  - T-016: getPendingCount (count correctness / permission denial)
 *
 * All model and content-moderation interactions are mocked so the suite runs
 * without a live database connection.
 *
 * Strategy: we mock @repo/db so that when AccommodationReviewService creates
 * `new AccommodationReviewModel()` it receives our mock, and also mock the
 * related services to prevent DB calls in lifecycle hooks.
 */

// ---- MUST be first — vi.mock is hoisted by vitest -------------------------

vi.mock('@repo/content-moderation', () => ({
    moderateText: vi.fn()
}));

vi.mock('../../../src/services/contentModeration/get-threshold-for-context.js', () => ({
    getThresholdForContext: vi.fn().mockResolvedValue({
        context: 'review',
        pending: 0.5,
        reject: 0.85,
        source: 'code-constants'
    })
}));

// Intercept the AccommodationReviewModel constructor so the service uses
// our mock instead of the real model.
const mockModel = {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findAll: vi.fn(),
    findAllWithUser: vi.fn(),
    softDelete: vi.fn(),
    hardDelete: vi.fn(),
    restore: vi.fn()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationReviewModel: vi.fn(() => mockModel),
        AccommodationModel: vi.fn(() => ({
            findById: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
            findAll: vi.fn()
        }))
    };
});

// Also mock AccommodationService to avoid DB calls in _afterCreate
vi.mock('../../../src/services/accommodation/accommodation.service.js', () => ({
    AccommodationService: vi.fn(() => ({
        updateStatsFromReview: vi.fn().mockResolvedValue(undefined),
        getById: vi.fn()
    }))
}));

vi.mock('../../../src/utils/transaction.js', () => ({
    withServiceTransaction: vi.fn(
        async (fn: (ctx: Record<string, unknown>) => Promise<unknown>) => {
            return fn({ tx: undefined, hookState: {} });
        }
    )
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn(() => null)
}));

// ---------------------------------------------------------------------------

import * as contentModeration from '@repo/content-moderation';
import { ModerationStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { AccommodationReview } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import * as getThresholdModule from '../../../src/services/contentModeration/get-threshold-for-context.js';
import type { ServiceConfig } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CLEAN_RESULT: contentModeration.ModerationResult = {
    score: 0,
    categories: Object.freeze({
        spam: 0,
        sexual: 0,
        violence: 0,
        hate: 0,
        harassment: 0,
        other: 0
    }),
    matchedTerms: Object.freeze([])
};

const BLOCKED_RESULT: contentModeration.ModerationResult = {
    score: 1.0,
    categories: Object.freeze({
        spam: 0,
        sexual: 0,
        violence: 0,
        hate: 0,
        harassment: 0,
        other: 1.0
    }),
    matchedTerms: Object.freeze(['badword'])
};

function makeReview(overrides: Partial<AccommodationReview> = {}): AccommodationReview {
    return {
        id: getMockId('accommodationReview'),
        userId: getMockId('user'),
        accommodationId: getMockId('accommodation'),
        title: 'Great stay',
        content: 'Really enjoyed it.',
        rating: {
            cleanliness: 5,
            hospitality: 5,
            services: 5,
            accuracy: 5,
            communication: 5,
            location: 5
        },
        averageRating: 5,
        moderationState: ModerationStatusEnum.APPROVED,
        moderatedById: null,
        moderatedAt: null,
        moderationReason: null,
        lifecycleState: 'ACTIVE' as AccommodationReview['lifecycleState'],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null,
        adminInfo: undefined,
        ...overrides
    } as unknown as AccommodationReview;
}

function makeModeratorActor() {
    return createActor({
        id: getMockId('user'),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE]
    });
}

function makeUnprivilegedActor() {
    return createActor({
        id: getMockId('user'),
        role: RoleEnum.USER,
        permissions: []
    });
}

function makeService(): AccommodationReviewService {
    return new AccommodationReviewService({
        logger: undefined as unknown as ServiceConfig['logger']
    });
}

// ---------------------------------------------------------------------------
// T-012: _beforeCreate — content-moderation wiring
// ---------------------------------------------------------------------------

describe('AccommodationReviewService — _beforeCreate content-moderation wiring (T-012)', () => {
    let service: AccommodationReviewService;

    const baseCreateInput = {
        userId: getMockId('user') as AccommodationReview['userId'],
        accommodationId: getMockId('accommodation') as AccommodationReview['accommodationId'],
        rating: {
            cleanliness: 5,
            hospitality: 5,
            services: 5,
            accuracy: 5,
            communication: 5,
            location: 5
        },
        lifecycleState: 'ACTIVE' as AccommodationReview['lifecycleState']
    } satisfies Partial<AccommodationReview>;

    beforeEach(() => {
        vi.clearAllMocks();
        // No existing review → duplicate check passes
        mockModel.findOne.mockResolvedValue(null);
        service = makeService();
    });

    it('sets moderationState = APPROVED for a clean accommodation review', async () => {
        asMock(contentModeration.moderateText).mockResolvedValue(CLEAN_RESULT);

        const result = await (
            service as unknown as {
                _beforeCreate: (
                    data: AccommodationReview,
                    actor: unknown,
                    ctx: unknown
                ) => Promise<Partial<AccommodationReview>>;
            }
        )._beforeCreate(
            {
                ...baseCreateInput,
                title: 'Great stay',
                content: 'Really enjoyed it.'
            } as unknown as AccommodationReview,
            createActor({ permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE] }),
            {}
        );

        expect(result.moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('sets moderationState = PENDING when content-moderation returns a hit', async () => {
        asMock(contentModeration.moderateText).mockResolvedValue(BLOCKED_RESULT);

        const result = await (
            service as unknown as {
                _beforeCreate: (
                    data: AccommodationReview,
                    actor: unknown,
                    ctx: unknown
                ) => Promise<Partial<AccommodationReview>>;
            }
        )._beforeCreate(
            {
                ...baseCreateInput,
                title: 'Contains badword',
                content: 'This has a blocked term.'
            } as unknown as AccommodationReview,
            createActor({ permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE] }),
            {}
        );

        expect(result.moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    it('uses DB-backed threshold: score 0.6 with threshold 0.8 → APPROVED (not PENDING)', async () => {
        // score 0.6 would be PENDING with the default threshold (0.5),
        // but APPROVED when the DB threshold is elevated to 0.8.
        const gradedResult: contentModeration.ModerationResult = {
            score: 0.6,
            categories: Object.freeze({
                spam: 0,
                sexual: 0,
                violence: 0,
                hate: 0,
                harassment: 0,
                other: 0.6
            }),
            matchedTerms: Object.freeze([])
        };
        asMock(contentModeration.moderateText).mockResolvedValue(gradedResult);
        asMock(getThresholdModule.getThresholdForContext).mockResolvedValue({
            context: 'review',
            pending: 0.8,
            reject: 0.95,
            source: 'row' as const
        });

        const result = await (
            service as unknown as {
                _beforeCreate: (
                    data: AccommodationReview,
                    actor: unknown,
                    ctx: unknown
                ) => Promise<Partial<AccommodationReview>>;
            }
        )._beforeCreate(
            {
                ...baseCreateInput,
                title: 'Borderline review',
                content: 'Some moderate content.'
            } as unknown as AccommodationReview,
            createActor({ permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE] }),
            {}
        );

        expect(result.moderationState).toBe(ModerationStatusEnum.APPROVED);
    });
});

// ---------------------------------------------------------------------------
// T-014: moderateReview — approve / reject / permission-denied / not-found
// ---------------------------------------------------------------------------

describe('AccommodationReviewService.moderateReview (T-014)', () => {
    let service: AccommodationReviewService;
    let review: AccommodationReview;

    beforeEach(() => {
        vi.clearAllMocks();
        asMock(contentModeration.moderateText).mockResolvedValue(CLEAN_RESULT);
        service = makeService();
        review = makeReview({ moderationState: ModerationStatusEnum.PENDING });
    });

    it('approves a PENDING review and returns the updated review', async () => {
        const actor = makeModeratorActor();
        const approved = makeReview({
            moderationState: ModerationStatusEnum.APPROVED,
            moderatedById: actor.id as AccommodationReview['moderatedById']
        });

        mockModel.findById.mockResolvedValue(review);
        mockModel.update.mockResolvedValue(approved);
        // Mock recalculateAndUpdateAccommodationStats since it uses raw SQL (getDb())
        const recalcMock = vi
            .spyOn(
                service as unknown as {
                    recalculateAndUpdateAccommodationStats: (...args: unknown[]) => Promise<void>;
                },
                'recalculateAndUpdateAccommodationStats'
            )
            .mockResolvedValue();
        const slugMock = vi
            .spyOn(
                service as unknown as {
                    _resolveAccommodationSlug: (...args: unknown[]) => Promise<string | undefined>;
                },
                '_resolveAccommodationSlug'
            )
            .mockResolvedValue(undefined);
        const revalidateMock = vi
            .spyOn(
                service as unknown as {
                    _scheduleAccommodationRevalidation: (...args: unknown[]) => void;
                },
                '_scheduleAccommodationRevalidation'
            )
            .mockReturnValue(undefined);

        const result = await service.moderateReview({
            id: review.id,
            decision: ModerationStatusEnum.APPROVED,
            actor
        });

        expectSuccess(result);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(mockModel.findById).toHaveBeenCalledWith(review.id);
        expect(mockModel.update).toHaveBeenCalledWith(
            { id: review.id },
            expect.objectContaining({
                moderationState: ModerationStatusEnum.APPROVED,
                moderatedById: actor.id,
                moderatedAt: expect.any(Date)
            })
        );
        // Approving must re-aggregate public stats (they only count APPROVED)
        // and schedule the page revalidation so the CDN cache refreshes.
        expect(recalcMock).toHaveBeenCalledWith(approved.accommodationId);
        expect(slugMock).toHaveBeenCalledWith(approved.accommodationId);
        expect(revalidateMock).toHaveBeenCalled();
    });

    it('rejects a PENDING review with a reason', async () => {
        const actor = makeModeratorActor();
        const rejected = makeReview({
            moderationState: ModerationStatusEnum.REJECTED,
            moderationReason: 'Inappropriate content'
        });

        mockModel.findById.mockResolvedValue(review);
        mockModel.update.mockResolvedValue(rejected);
        // Mock recalculateAndUpdateAccommodationStats since it uses raw SQL (getDb())
        const recalcMock = vi
            .spyOn(
                service as unknown as {
                    recalculateAndUpdateAccommodationStats: (...args: unknown[]) => Promise<void>;
                },
                'recalculateAndUpdateAccommodationStats'
            )
            .mockResolvedValue();

        const result = await service.moderateReview({
            id: review.id,
            decision: ModerationStatusEnum.REJECTED,
            reason: 'Inappropriate content',
            actor
        });

        expectSuccess(result);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.REJECTED);
        expect(mockModel.update).toHaveBeenCalledWith(
            { id: review.id },
            expect.objectContaining({ moderationReason: 'Inappropriate content' })
        );
        // Rejecting must also re-aggregate (a previously APPROVED review may drop out).
        expect(recalcMock).toHaveBeenCalledWith(rejected.accommodationId);
    });

    it('returns FORBIDDEN when actor lacks ACCOMMODATION_REVIEW_MODERATE', async () => {
        const actor = makeUnprivilegedActor();

        const result = await service.moderateReview({
            id: review.id,
            decision: ModerationStatusEnum.APPROVED,
            actor
        });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mockModel.update).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when review does not exist', async () => {
        const actor = makeModeratorActor();
        mockModel.findById.mockResolvedValue(null);

        const result = await service.moderateReview({
            id: getMockId('accommodationReview'),
            decision: ModerationStatusEnum.APPROVED,
            actor
        });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mockModel.update).not.toHaveBeenCalled();
    });

    it('does NOT mutate lifecycleState when rejecting a review (spec §3.4)', async () => {
        const actor = makeModeratorActor();
        const rejected = makeReview({
            moderationState: ModerationStatusEnum.REJECTED,
            lifecycleState: 'ACTIVE' as AccommodationReview['lifecycleState']
        });

        mockModel.findById.mockResolvedValue(review);
        mockModel.update.mockResolvedValue(rejected);

        await service.moderateReview({
            id: review.id,
            decision: ModerationStatusEnum.REJECTED,
            actor
        });

        const updatePayload = mockModel.update.mock.calls[0]?.[1] ?? {};
        expect(Object.keys(updatePayload)).not.toContain('lifecycleState');
    });
});

// ---------------------------------------------------------------------------
// T-016: getPendingCount
// ---------------------------------------------------------------------------

describe('AccommodationReviewService.getPendingCount (T-016)', () => {
    let service: AccommodationReviewService;

    beforeEach(() => {
        vi.clearAllMocks();
        asMock(contentModeration.moderateText).mockResolvedValue(CLEAN_RESULT);
        service = makeService();
    });

    it('returns the count of PENDING accommodation reviews', async () => {
        const actor = makeModeratorActor();
        mockModel.count.mockResolvedValue(7);

        const result = await service.getPendingCount({ actor });

        expectSuccess(result);
        expect(result.data?.count).toBe(7);
        expect(mockModel.count).toHaveBeenCalledWith({
            moderationState: ModerationStatusEnum.PENDING,
            deletedAt: null
        });
    });

    it('returns FORBIDDEN when actor lacks ACCOMMODATION_REVIEW_MODERATE', async () => {
        const actor = makeUnprivilegedActor();

        const result = await service.getPendingCount({ actor });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mockModel.count).not.toHaveBeenCalled();
    });

    it('returns 0 when there are no pending reviews', async () => {
        const actor = makeModeratorActor();
        mockModel.count.mockResolvedValue(0);

        const result = await service.getPendingCount({ actor });

        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });
});
