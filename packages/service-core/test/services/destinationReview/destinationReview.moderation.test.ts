/**
 * Tests for DestinationReviewService moderation features (SPEC-166).
 *
 * Covers:
 *  - T-013: _beforeCreate wires content-moderation → moderationState
 *  - T-015: moderateReview (approve / reject / permission-denied / not-found)
 *  - T-017: getPendingCount (count correctness / permission denial)
 *
 * Strategy: we mock @repo/db so that when DestinationReviewService creates
 * `new DestinationReviewModel()` it receives our mock, and mock related services
 * to prevent DB calls in lifecycle hooks.
 */

// ---- MUST be first — vi.mock is hoisted by vitest -------------------------

vi.mock('@repo/content-moderation', () => ({
    moderateText: vi.fn()
}));

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
        DestinationReviewModel: vi.fn(() => mockModel),
        DestinationModel: vi.fn(() => ({
            findById: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
            findAll: vi.fn()
        }))
    };
});

vi.mock('../../../src/services/destination/destination.service.js', () => ({
    DestinationService: vi.fn(() => ({
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
import type { DestinationReview } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service';
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

function makeReview(overrides: Partial<DestinationReview> = {}): DestinationReview {
    return {
        id: getMockId('destinationReview'),
        userId: getMockId('user'),
        destinationId: getMockId('destination'),
        title: 'Nice destination',
        content: 'Enjoyed the visit.',
        rating: {
            landscape: 5,
            attractions: 5,
            accessibility: 5,
            safety: 5,
            cleanliness: 5,
            hospitality: 5,
            culturalOffer: 5,
            gastronomy: 5,
            affordability: 5,
            nightlife: 5,
            infrastructure: 5,
            environmentalCare: 5,
            wifiAvailability: 5,
            shopping: 5,
            beaches: 5,
            greenSpaces: 5,
            localEvents: 5,
            weatherSatisfaction: 5
        },
        averageRating: 5,
        moderationState: ModerationStatusEnum.PENDING,
        moderatedById: null,
        moderatedAt: null,
        moderationReason: null,
        lifecycleState: 'ACTIVE' as DestinationReview['lifecycleState'],
        isVerified: false,
        isPublished: false,
        isRecommended: true,
        wouldVisitAgain: true,
        helpfulVotes: 0,
        totalVotes: 0,
        hasOwnerResponse: false,
        isBusinessTravel: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null,
        adminInfo: undefined,
        ...overrides
    } as unknown as DestinationReview;
}

function makeModeratorActor() {
    return createActor({
        id: getMockId('user'),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.DESTINATION_REVIEW_MODERATE]
    });
}

function makeUnprivilegedActor() {
    return createActor({
        id: getMockId('user'),
        role: RoleEnum.USER,
        permissions: []
    });
}

function makeService(): DestinationReviewService {
    return new DestinationReviewService({
        logger: undefined as unknown as ServiceConfig['logger']
    });
}

// ---------------------------------------------------------------------------
// T-013: _beforeCreate — content-moderation wiring
// ---------------------------------------------------------------------------

describe('DestinationReviewService — _beforeCreate content-moderation wiring (T-013)', () => {
    let service: DestinationReviewService;

    const baseCreateInput = {
        userId: getMockId('user') as DestinationReview['userId'],
        destinationId: getMockId('destination') as DestinationReview['destinationId'],
        rating: {
            landscape: 5,
            attractions: 5,
            accessibility: 5,
            safety: 5,
            cleanliness: 5,
            hospitality: 5,
            culturalOffer: 5,
            gastronomy: 5,
            affordability: 5,
            nightlife: 5,
            infrastructure: 5,
            environmentalCare: 5,
            wifiAvailability: 5,
            shopping: 5,
            beaches: 5,
            greenSpaces: 5,
            localEvents: 5,
            weatherSatisfaction: 5
        },
        lifecycleState: 'ACTIVE' as DestinationReview['lifecycleState'],
        isVerified: false,
        isPublished: false,
        isRecommended: true,
        wouldVisitAgain: true,
        helpfulVotes: 0,
        totalVotes: 0,
        hasOwnerResponse: false,
        isBusinessTravel: false
    } satisfies Partial<DestinationReview>;

    beforeEach(() => {
        vi.clearAllMocks();
        service = makeService();
    });

    it('sets moderationState = PENDING for a clean destination review (entity default)', async () => {
        asMock(contentModeration.moderateText).mockResolvedValue(CLEAN_RESULT);

        const result = await (
            service as unknown as {
                _beforeCreate: (
                    data: DestinationReview,
                    actor: unknown,
                    ctx: unknown
                ) => Promise<Partial<DestinationReview>>;
            }
        )._beforeCreate(
            {
                ...baseCreateInput,
                title: 'Nice place',
                content: 'Enjoyed the visit.'
            } as unknown as DestinationReview,
            createActor({ permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE] }),
            {}
        );

        // Destination default: PENDING (unverified entity type)
        expect(result.moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    it('sets moderationState = PENDING when content-moderation returns a hit', async () => {
        asMock(contentModeration.moderateText).mockResolvedValue(BLOCKED_RESULT);

        const result = await (
            service as unknown as {
                _beforeCreate: (
                    data: DestinationReview,
                    actor: unknown,
                    ctx: unknown
                ) => Promise<Partial<DestinationReview>>;
            }
        )._beforeCreate(
            {
                ...baseCreateInput,
                title: 'Contains badword',
                content: 'Blocked content here.'
            } as unknown as DestinationReview,
            createActor({ permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE] }),
            {}
        );

        expect(result.moderationState).toBe(ModerationStatusEnum.PENDING);
    });
});

// ---------------------------------------------------------------------------
// T-015: moderateReview — approve / reject / permission-denied / not-found
// ---------------------------------------------------------------------------

describe('DestinationReviewService.moderateReview (T-015)', () => {
    let service: DestinationReviewService;
    let review: DestinationReview;

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
            moderatedById: actor.id as DestinationReview['moderatedById']
        });

        mockModel.findById.mockResolvedValue(review);
        mockModel.update.mockResolvedValue(approved);

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
    });

    it('rejects a PENDING review with a reason', async () => {
        const actor = makeModeratorActor();
        const rejected = makeReview({
            moderationState: ModerationStatusEnum.REJECTED,
            moderationReason: 'Spam content'
        });

        mockModel.findById.mockResolvedValue(review);
        mockModel.update.mockResolvedValue(rejected);

        const result = await service.moderateReview({
            id: review.id,
            decision: ModerationStatusEnum.REJECTED,
            reason: 'Spam content',
            actor
        });

        expectSuccess(result);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.REJECTED);
        expect(mockModel.update).toHaveBeenCalledWith(
            { id: review.id },
            expect.objectContaining({ moderationReason: 'Spam content' })
        );
    });

    it('returns FORBIDDEN when actor lacks DESTINATION_REVIEW_MODERATE', async () => {
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
            id: getMockId('destinationReview'),
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
            lifecycleState: 'ACTIVE' as DestinationReview['lifecycleState']
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
// T-017: getPendingCount
// ---------------------------------------------------------------------------

describe('DestinationReviewService.getPendingCount (T-017)', () => {
    let service: DestinationReviewService;

    beforeEach(() => {
        vi.clearAllMocks();
        asMock(contentModeration.moderateText).mockResolvedValue(CLEAN_RESULT);
        service = makeService();
    });

    it('returns the count of PENDING destination reviews', async () => {
        const actor = makeModeratorActor();
        mockModel.count.mockResolvedValue(3);

        const result = await service.getPendingCount({ actor });

        expectSuccess(result);
        expect(result.data?.count).toBe(3);
        expect(mockModel.count).toHaveBeenCalledWith({
            moderationState: ModerationStatusEnum.PENDING,
            deletedAt: null
        });
    });

    it('returns FORBIDDEN when actor lacks DESTINATION_REVIEW_MODERATE', async () => {
        const actor = makeUnprivilegedActor();

        const result = await service.getPendingCount({ actor });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mockModel.count).not.toHaveBeenCalled();
    });

    it('returns 0 when there are no pending destination reviews', async () => {
        const actor = makeModeratorActor();
        mockModel.count.mockResolvedValue(0);

        const result = await service.getPendingCount({ actor });

        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });
});
