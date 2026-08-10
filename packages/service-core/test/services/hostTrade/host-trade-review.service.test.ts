/**
 * @fileoverview The four eligibility gates for creating a review (T-024).
 *
 * Each gate gets its own isolated test: the fixture satisfies every OTHER gate
 * and violates exactly one, so a passing test names the gate that actually
 * fired rather than "something refused".
 */
import type {
    HostTradeBenefitUsageModel,
    HostTradeModel,
    HostTradeReviewModel,
    HostTradeReviewReplyModel
} from '@repo/db';
import { ModerationStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/content-moderation', () => ({
    moderateText: vi.fn(async () => ({ score: 0 }))
}));

vi.mock('../../../src/services/hostTrade/host-trade-aggregates', () => ({
    recalculateHostTradeAggregates: vi.fn(async () => ({
        aggregates: {
            confirmedUsesCount: 0,
            distinctHostsCount: 0,
            reviewsCount: 0,
            averageRating: 0,
            benefitRespectedCount: 0
        }
    }))
}));

vi.mock('../../../src/services/contentModeration/get-threshold-for-context.js', () => ({
    getThresholdForContext: vi.fn(async () => ({
        context: 'review',
        pending: 0.5,
        reject: 0.85,
        source: 'code-constants'
    }))
}));

import { moderateText } from '@repo/content-moderation';
import { recalculateHostTradeAggregates } from '../../../src/services/hostTrade/host-trade-aggregates';
import { HostTradeReviewService } from '../../../src/services/hostTrade/host-trade-review.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const HT_ID = getMockId('attraction', 'ht-rev-1');
const OWNER_ID = getMockId('user', 'rev-owner');
const HOST_ID = getMockId('user', 'rev-host');

/** A host: holds the review permission the seed grants RoleEnum.HOST. */
const hostActor = () =>
    new ActorFactoryBuilder()
        .withId(HOST_ID)
        .withPermissions([PermissionEnum.HOST_TRADE_REVIEW_CREATE])
        .build();

const validBody = { overallRating: 4, respectedBenefit: true };

function buildService(
    options: {
        provider?: Record<string, unknown> | null;
        confirmedUsage?: Record<string, unknown> | null;
        existingReview?: Record<string, unknown> | null;
    } = {}
) {
    const model = createModelMock();
    const hostTradeModel = createModelMock();
    const usageModel = createModelMock();

    hostTradeModel.findById = vi.fn(async () =>
        options.provider === undefined
            ? { id: HT_ID, ownerUserId: OWNER_ID, revokedAt: null, deletedAt: null }
            : options.provider
    );
    usageModel.findConfirmedPair = vi.fn(async () =>
        options.confirmedUsage === undefined ? { id: 'usage-1' } : options.confirmedUsage
    );
    model.findOne = vi.fn(async () => options.existingReview ?? null);
    model.create = vi.fn(async (data: Record<string, unknown>) => ({ id: 'review-1', ...data }));

    const service = new HostTradeReviewService(
        { logger: mockLogger },
        model as unknown as HostTradeReviewModel,
        hostTradeModel as unknown as HostTradeModel,
        usageModel as unknown as HostTradeBenefitUsageModel
    );

    return { service, model, usageModel };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('HostTradeReviewService.createReview — the happy path', () => {
    it('creates the review when all four gates pass', async () => {
        const { service, model } = buildService();

        const result = await service.createReview(
            { hostTradeId: HT_ID, ...validBody },
            hostActor()
        );

        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalled();
    });

    it('stamps the provider and the host from the path and the session', async () => {
        const { service, model } = buildService();

        await service.createReview({ hostTradeId: HT_ID, ...validBody }, hostActor());

        const row = (model.create as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[0] as Record<string, unknown>;
        expect(row.hostTradeId).toBe(HT_ID);
        expect(row.hostUserId).toBe(HOST_ID);
    });
});

describe('gate 1 — HOST_TRADE_REVIEW_CREATE', () => {
    /** AC-15 — a provider-only account has no accommodations, so no HOST role. */
    it('refuses an actor without the permission', async () => {
        const { service, model } = buildService();
        const providerOnly = new ActorFactoryBuilder().withId(OWNER_ID).withPermissions([]).build();

        const result = await service.createReview(
            { hostTradeId: HT_ID, ...validBody },
            providerOnly
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.create).not.toHaveBeenCalled();
    });
});

describe('gate 2 — a confirmed usage must exist', () => {
    it('answers NO_CONFIRMED_USAGE when the pair has none', async () => {
        const { service, model } = buildService({ confirmedUsage: null });

        const result = await service.createReview(
            { hostTradeId: HT_ID, ...validBody },
            hostActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NO_CONFIRMED_USAGE);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('looks the usage up for the acting host, not for anyone else', async () => {
        const { service, usageModel } = buildService();

        await service.createReview({ hostTradeId: HT_ID, ...validBody }, hostActor());

        expect(usageModel.findConfirmedPair).toHaveBeenCalledWith(HT_ID, HOST_ID, undefined);
    });
});

describe('gate 3 — self-review', () => {
    /** AC-17 — fires even with the HOST role AND a confirmed usage. */
    it('answers SELF_REVIEW_FORBIDDEN to the listing owner', async () => {
        const { service, model } = buildService();
        const ownerWhoIsAlsoHost = new ActorFactoryBuilder()
            .withId(OWNER_ID)
            .withPermissions([PermissionEnum.HOST_TRADE_REVIEW_CREATE])
            .build();

        const result = await service.createReview(
            { hostTradeId: HT_ID, ...validBody },
            ownerWhoIsAlsoHost
        );

        expect(result.error?.code).toBe(ServiceErrorCode.SELF_REVIEW_FORBIDDEN);
        expect(model.create).not.toHaveBeenCalled();
    });

    /**
     * Self-review is checked BEFORE the confirmed-usage gate. Both would refuse
     * the owner, but only one of them is true forever: telling him to go get a
     * confirmed usage sends him after something that would still not let him
     * review his own listing.
     */
    it('reports SELF_REVIEW_FORBIDDEN rather than NO_CONFIRMED_USAGE when both apply', async () => {
        const { service } = buildService({ confirmedUsage: null });
        const owner = new ActorFactoryBuilder()
            .withId(OWNER_ID)
            .withPermissions([PermissionEnum.HOST_TRADE_REVIEW_CREATE])
            .build();

        const result = await service.createReview({ hostTradeId: HT_ID, ...validBody }, owner);

        expect(result.error?.code).toBe(ServiceErrorCode.SELF_REVIEW_FORBIDDEN);
    });

    /** AC-16 — the same person may review a DIFFERENT provider. */
    it('lets a host who also owns a listing review someone else', async () => {
        const { service, model } = buildService({
            provider: {
                id: HT_ID,
                ownerUserId: 'somebody-else',
                revokedAt: null,
                deletedAt: null
            }
        });
        const dualRole = new ActorFactoryBuilder()
            .withId(HOST_ID)
            .withPermissions([PermissionEnum.HOST_TRADE_REVIEW_CREATE])
            .build();

        const result = await service.createReview({ hostTradeId: HT_ID, ...validBody }, dualRole);

        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalled();
    });
});

describe('gate 4 — the provider must still be listed', () => {
    it('answers PROVIDER_REVOKED for a revoked listing', async () => {
        const { service, model } = buildService({
            provider: {
                id: HT_ID,
                ownerUserId: OWNER_ID,
                revokedAt: new Date('2026-07-01T00:00:00Z'),
                deletedAt: null
            }
        });

        const result = await service.createReview(
            { hostTradeId: HT_ID, ...validBody },
            hostActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.PROVIDER_REVOKED);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers PROVIDER_REVOKED for a soft-deleted listing', async () => {
        const { service, model } = buildService({
            provider: {
                id: HT_ID,
                ownerUserId: OWNER_ID,
                revokedAt: null,
                deletedAt: new Date('2026-07-01T00:00:00Z')
            }
        });

        const result = await service.createReview(
            { hostTradeId: HT_ID, ...validBody },
            hostActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.PROVIDER_REVOKED);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a provider that never existed', async () => {
        const { service, model } = buildService({ provider: null });

        const result = await service.createReview(
            { hostTradeId: HT_ID, ...validBody },
            hostActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });
});

describe('duplicate guard', () => {
    /**
     * Defence in depth beside the UNIQUE (hostUserId, hostTradeId) index. The
     * index is the real guarantee; this exists so the client gets
     * REVIEW_ALREADY_EXISTS instead of a raw constraint violation surfacing as
     * a 500.
     */
    it('answers REVIEW_ALREADY_EXISTS when the pair already has one', async () => {
        const { service, model } = buildService({ existingReview: { id: 'existing' } });

        const result = await service.createReview(
            { hostTradeId: HT_ID, ...validBody },
            hostActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.REVIEW_ALREADY_EXISTS);
        expect(model.create).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Initial moderation state (T-027)
// ---------------------------------------------------------------------------

/** First argument of the first call to a mocked model method. */
function firstArg(mock: unknown): Record<string, unknown> {
    return (mock as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as Record<string, unknown>;
}

describe('initial moderation state', () => {
    it('publishes a clean review immediately', async () => {
        const { service, model } = buildService();

        await service.createReview(
            { hostTradeId: HT_ID, ...validBody, content: 'Trabajo prolijo y puntual.' },
            hostActor()
        );

        expect(firstArg(model.create).moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    /** AC-19 — content moderation overrides the APPROVED default. */
    it('holds a flagged review for a human', async () => {
        vi.mocked(moderateText).mockResolvedValueOnce({ score: 1 } as never);
        const { service, model } = buildService();

        await service.createReview(
            { hostTradeId: HT_ID, ...validBody, content: 'un texto con problemas' },
            hostActor()
        );

        expect(firstArg(model.create).moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    /**
     * The review body is optional (§6.3), so most reviews are stars and a
     * boolean with nothing to moderate. Calling the engine on an empty string
     * would spend a round trip to score nothing.
     */
    it('skips moderation entirely when there is no text', async () => {
        const { service, model } = buildService();

        await service.createReview({ hostTradeId: HT_ID, ...validBody }, hostActor());

        expect(moderateText).not.toHaveBeenCalled();
        expect(firstArg(model.create).moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('sends the body through content moderation when there is one', async () => {
        const { service } = buildService();

        await service.createReview(
            { hostTradeId: HT_ID, ...validBody, content: 'Trabajo prolijo y puntual.' },
            hostActor()
        );

        expect(moderateText).toHaveBeenCalledWith({
            text: 'Trabajo prolijo y puntual.',
            context: 'review'
        });
    });
});

describe('aggregate recalculation', () => {
    it('recalculates the listing counters after a review lands', async () => {
        const { service } = buildService();

        await service.createReview({ hostTradeId: HT_ID, ...validBody }, hostActor());

        expect(recalculateHostTradeAggregates).toHaveBeenCalledWith(
            expect.objectContaining({ hostTradeId: HT_ID })
        );
    });

    it('does not recalculate when a gate refused the review', async () => {
        const { service } = buildService({ confirmedUsage: null });

        await service.createReview({ hostTradeId: HT_ID, ...validBody }, hostActor());

        expect(recalculateHostTradeAggregates).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Admin moderation (T-028)
// ---------------------------------------------------------------------------

const MODERATOR_ID = getMockId('user', 'rev-moderator');
const REVIEW_ID = getMockId('feature', 'moderated-review');

const moderatorActor = () =>
    new ActorFactoryBuilder()
        .withId(MODERATOR_ID)
        .withPermissions([PermissionEnum.HOST_TRADE_REVIEW_MODERATE])
        .build();

/** A stub transaction, so the service joins it instead of opening its own. */
const txCtx = () => ({ tx: {} as never });

function buildModerationService(review: Record<string, unknown> | null = null) {
    const model = createModelMock();
    model.findById = vi.fn(async () =>
        review === null ? { id: REVIEW_ID, hostTradeId: HT_ID, deletedAt: null } : review
    );
    model.update = vi.fn(async (_where: unknown, data: Record<string, unknown>) => ({
        id: REVIEW_ID,
        hostTradeId: HT_ID,
        ...data
    }));
    model.count = vi.fn(async () => 7);

    const service = new HostTradeReviewService(
        { logger: mockLogger },
        model as unknown as HostTradeReviewModel,
        createModelMock() as unknown as HostTradeModel,
        createModelMock() as unknown as HostTradeBenefitUsageModel
    );

    return { service, model };
}

describe('HostTradeReviewService.moderateReview', () => {
    /**
     * Both refusals THROW rather than returning an error envelope, because
     * these calls carry a caller transaction. That is the base service's
     * contract (`base.service.ts`: `if (ctx?.tx) throw error`) and it is the
     * right one — swallowing the error into `{ error }` would let the caller's
     * transaction commit around a decision that never happened.
     */
    it('refuses an actor without HOST_TRADE_REVIEW_MODERATE', async () => {
        const { service, model } = buildModerationService();

        await expect(
            service.moderateReview(
                { id: REVIEW_ID, decision: ModerationStatusEnum.REJECTED, actor: hostActor() },
                txCtx()
            )
        ).rejects.toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a review that does not exist', async () => {
        const { service, model } = buildModerationService(null as never);
        model.findById = vi.fn(async () => null);

        await expect(
            service.moderateReview(
                { id: REVIEW_ID, decision: ModerationStatusEnum.APPROVED, actor: moderatorActor() },
                txCtx()
            )
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        expect(model.update).not.toHaveBeenCalled();
    });

    it('stamps the decision, the moderator, the time and the reason', async () => {
        const { service, model } = buildModerationService();

        await service.moderateReview(
            {
                id: REVIEW_ID,
                decision: ModerationStatusEnum.REJECTED,
                reason: 'Menciona datos personales',
                actor: moderatorActor()
            },
            txCtx()
        );

        const [where, data] = (model.update as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0] as [Record<string, unknown>, Record<string, unknown>];
        expect(where).toEqual({ id: REVIEW_ID });
        expect(data.moderationState).toBe(ModerationStatusEnum.REJECTED);
        expect(data.moderatedById).toBe(MODERATOR_ID);
        expect(data.moderatedAt).toBeInstanceOf(Date);
        expect(data.moderationReason).toBe('Menciona datos personales');
    });

    it('clears a stale reason when the decision carries none', async () => {
        const { service, model } = buildModerationService();

        await service.moderateReview(
            { id: REVIEW_ID, decision: ModerationStatusEnum.APPROVED, actor: moderatorActor() },
            txCtx()
        );

        const data = (model.update as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[1] as Record<string, unknown>;
        expect(data.moderationReason).toBeNull();
    });

    /** AC-27 — a review leaving APPROVED has to leave the average with it. */
    it('recalculates the listing aggregates after the decision', async () => {
        const { service } = buildModerationService();

        await service.moderateReview(
            { id: REVIEW_ID, decision: ModerationStatusEnum.REJECTED, actor: moderatorActor() },
            txCtx()
        );

        expect(recalculateHostTradeAggregates).toHaveBeenCalledWith(
            expect.objectContaining({ hostTradeId: HT_ID })
        );
    });

    /**
     * The decision and the recount are ONE unit of work. Unlike the
     * accommodation precedent — whose recount is bundled with a cache
     * revalidation that cannot be rolled back — this one is pure SQL in the
     * same database, so there is no reason to let it fail silently and leave a
     * rejected review inside the public average.
     */
    it('runs the recount inside the caller’s transaction', async () => {
        const ctx = txCtx();
        const { service } = buildModerationService();

        await service.moderateReview(
            { id: REVIEW_ID, decision: ModerationStatusEnum.REJECTED, actor: moderatorActor() },
            ctx
        );

        expect(recalculateHostTradeAggregates).toHaveBeenCalledWith(
            expect.objectContaining({ tx: ctx.tx })
        );
    });
});

// ---------------------------------------------------------------------------
// The host editing their own review (T-026, AC-22)
// ---------------------------------------------------------------------------

const REPLY_ID = getMockId('feature', 'review-reply');
const OTHER_HOST_ID = getMockId('user', 'rev-other-host');

/** The stored review before the edit: a clean text, no breakdown, moderated. */
const storedReview = () => ({
    id: REVIEW_ID,
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    overallRating: 4,
    rating: null,
    averageRating: null,
    respectedBenefit: true,
    content: 'El trabajo original, prolijo.',
    moderationState: ModerationStatusEnum.APPROVED,
    moderatedById: MODERATOR_ID,
    moderatedAt: new Date('2026-07-01T00:00:00Z'),
    moderationReason: 'Revisada a mano',
    editedAt: null,
    deletedAt: null
});

function buildEditService(
    options: {
        review?: Record<string, unknown> | null;
        reply?: Record<string, unknown> | null;
    } = {}
) {
    const model = createModelMock();
    const replyModel = createModelMock();

    model.findById = vi.fn(async () =>
        options.review === undefined ? storedReview() : options.review
    );
    model.update = vi.fn(async (_where: unknown, data: Record<string, unknown>) => ({
        ...storedReview(),
        ...data
    }));
    replyModel.findOne = vi.fn(async () => options.reply ?? null);
    replyModel.update = vi.fn(async (_where: unknown, data: Record<string, unknown>) => ({
        id: REPLY_ID,
        ...data
    }));

    const service = new HostTradeReviewService(
        { logger: mockLogger },
        model as unknown as HostTradeReviewModel,
        createModelMock() as unknown as HostTradeModel,
        createModelMock() as unknown as HostTradeBenefitUsageModel,
        replyModel as unknown as HostTradeReviewReplyModel
    );

    return { service, model, replyModel };
}

/** An approved reply, the AC-22 fixture: it must survive the host's edit. */
const approvedReply = () => ({
    id: REPLY_ID,
    reviewId: REVIEW_ID,
    moderationState: ModerationStatusEnum.APPROVED,
    reviewEditedAfterReply: false,
    deletedAt: null
});

/** Second argument of the first call to a mocked model method. */
function firstPatch(mock: unknown): Record<string, unknown> {
    return (mock as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1] as Record<string, unknown>;
}

describe('HostTradeReviewService.updateReview — ownership', () => {
    /**
     * Every refusal here THROWS instead of returning an envelope because the
     * calls carry a transaction — the base service's `if (ctx?.tx) throw`
     * contract, same as the moderation tests above.
     */
    it('answers NOT_FOUND for somebody else’s review, never FORBIDDEN', async () => {
        const { service, model } = buildEditService();
        const intruder = new ActorFactoryBuilder()
            .withId(OTHER_HOST_ID)
            .withPermissions([PermissionEnum.HOST_TRADE_REVIEW_CREATE])
            .build();

        await expect(
            service.updateReview({ reviewId: REVIEW_ID, overallRating: 1 }, intruder, txCtx())
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a review that does not exist', async () => {
        const { service, model } = buildEditService({ review: null });

        await expect(
            service.updateReview({ reviewId: REVIEW_ID, overallRating: 1 }, hostActor(), txCtx())
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a soft-deleted review', async () => {
        const { service, model } = buildEditService({
            review: { ...storedReview(), deletedAt: new Date('2026-07-02T00:00:00Z') }
        });

        await expect(
            service.updateReview({ reviewId: REVIEW_ID, overallRating: 1 }, hostActor(), txCtx())
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        expect(model.update).not.toHaveBeenCalled();
    });

    /**
     * Editing is gated by ROW OWNERSHIP, not by a permission (§7.5: "auth +
     * ownership"). A host who wrote the review keeps the right to edit it even
     * if `HOST_TRADE_REVIEW_CREATE` were later revoked from the role.
     */
    it('lets the author edit without holding any permission', async () => {
        const { service, model } = buildEditService();
        const bareAuthor = new ActorFactoryBuilder().withId(HOST_ID).withPermissions([]).build();

        const result = await service.updateReview(
            { reviewId: REVIEW_ID, overallRating: 2 },
            bareAuthor,
            txCtx()
        );

        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalled();
    });
});

describe('HostTradeReviewService.updateReview — what it writes', () => {
    it('stamps editedAt and the editor on every edit', async () => {
        const { service, model } = buildEditService();

        await service.updateReview({ reviewId: REVIEW_ID, overallRating: 2 }, hostActor(), txCtx());

        const patch = firstPatch(model.update);
        expect(patch.overallRating).toBe(2);
        expect(patch.editedAt).toBeInstanceOf(Date);
        expect(patch.updatedById).toBe(HOST_ID);
    });

    it('leaves untouched fields out of the patch', async () => {
        const { service, model } = buildEditService();

        await service.updateReview(
            { reviewId: REVIEW_ID, respectedBenefit: false },
            hostActor(),
            txCtx()
        );

        const patch = firstPatch(model.update);
        expect(patch.respectedBenefit).toBe(false);
        expect(patch).not.toHaveProperty('overallRating');
        expect(patch).not.toHaveProperty('content');
    });

    /** AC-20 — the derived average follows the breakdown it is derived from. */
    it('recomputes averageRating when the breakdown changes', async () => {
        const { service, model } = buildEditService();

        await service.updateReview(
            { reviewId: REVIEW_ID, rating: { workQuality: 5, punctuality: 4 } },
            hostActor(),
            txCtx()
        );

        expect(firstPatch(model.update).averageRating).toBe(4.5);
    });

    it('clears averageRating when the host drops the breakdown', async () => {
        const { service, model } = buildEditService({
            review: { ...storedReview(), rating: { workQuality: 5 }, averageRating: 5 }
        });

        await service.updateReview({ reviewId: REVIEW_ID, rating: null }, hostActor(), txCtx());

        const patch = firstPatch(model.update);
        expect(patch.rating).toBeNull();
        expect(patch.averageRating).toBeNull();
    });

    /** The public card's numbers move with the stars, and this path never goes
     * through the base update, so `_afterUpdate` would not fire for it. */
    it('recalculates the listing aggregates inside the same transaction', async () => {
        const ctx = txCtx();
        const { service } = buildEditService();

        await service.updateReview({ reviewId: REVIEW_ID, overallRating: 1 }, hostActor(), ctx);

        expect(recalculateHostTradeAggregates).toHaveBeenCalledWith({
            hostTradeId: HT_ID,
            tx: ctx.tx
        });
    });
});

describe('HostTradeReviewService.updateReview — re-moderation', () => {
    /** AC-22 — the edited text goes back through the engine. */
    it('re-moderates a rewritten text and re-approves it when it is clean', async () => {
        const { service, model } = buildEditService();

        await service.updateReview(
            { reviewId: REVIEW_ID, content: 'Lo corrijo: al final cumplió con el descuento.' },
            hostActor(),
            txCtx()
        );

        expect(moderateText).toHaveBeenCalledWith({
            text: 'Lo corrijo: al final cumplió con el descuento.',
            context: 'review'
        });
        expect(firstPatch(model.update).moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('holds a rewritten text that the engine flags', async () => {
        vi.mocked(moderateText).mockResolvedValueOnce({ score: 1 } as never);
        const { service, model } = buildEditService();

        await service.updateReview(
            { reviewId: REVIEW_ID, content: 'un texto con problemas nuevos' },
            hostActor(),
            txCtx()
        );

        expect(firstPatch(model.update).moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    /**
     * The previous decision was made about text that no longer exists, so it is
     * wiped rather than kept — the same reasoning as `updateReply`.
     */
    it('wipes the previous moderation decision when the text changes', async () => {
        const { service, model } = buildEditService();

        await service.updateReview(
            { reviewId: REVIEW_ID, content: 'Un texto completamente distinto.' },
            hostActor(),
            txCtx()
        );

        const patch = firstPatch(model.update);
        expect(patch.moderatedById).toBeNull();
        expect(patch.moderatedAt).toBeNull();
        expect(patch.moderationReason).toBeNull();
    });

    /**
     * THE LAUNDERING GUARD. Re-moderation is about the TEXT: an edit that does
     * not touch it must not re-run the engine, because a review an admin
     * REJECTED would come back APPROVED — turning "change one star" into a way
     * of republishing a text a human took down.
     */
    it('does not re-moderate a star-only edit', async () => {
        const { service, model } = buildEditService({
            review: {
                ...storedReview(),
                moderationState: ModerationStatusEnum.REJECTED,
                moderationReason: 'Menciona datos personales'
            }
        });

        await service.updateReview({ reviewId: REVIEW_ID, overallRating: 5 }, hostActor(), txCtx());

        expect(moderateText).not.toHaveBeenCalled();
        const patch = firstPatch(model.update);
        expect(patch).not.toHaveProperty('moderationState');
        expect(patch).not.toHaveProperty('moderationReason');
    });

    it('does not re-moderate when the submitted text is identical', async () => {
        const { service, model } = buildEditService();

        await service.updateReview(
            { reviewId: REVIEW_ID, content: storedReview().content, overallRating: 5 },
            hostActor(),
            txCtx()
        );

        expect(moderateText).not.toHaveBeenCalled();
        expect(firstPatch(model.update)).not.toHaveProperty('moderationState');
    });

    /** A text removed altogether is a change like any other, and leaves nothing
     * to score — so the engine is skipped and the default state applies. */
    it('re-resolves the state without the engine when the text is removed', async () => {
        const { service, model } = buildEditService();

        await service.updateReview({ reviewId: REVIEW_ID, content: null }, hostActor(), txCtx());

        expect(moderateText).not.toHaveBeenCalled();
        expect(firstPatch(model.update).moderationState).toBe(ModerationStatusEnum.APPROVED);
    });
});

describe('HostTradeReviewService.updateReview — the reply marker (AC-22)', () => {
    /**
     * The reply SURVIVES. Deleting the provider's words because the host
     * changed his would be worse than a stale answer: with the marker the
     * directory can say the reply answers an earlier version, and the provider
     * can rewrite it.
     */
    it('marks an existing reply instead of deleting it', async () => {
        const { service, replyModel } = buildEditService({ reply: approvedReply() });

        await service.updateReview(
            { reviewId: REVIEW_ID, content: 'Reescribo lo que había puesto antes.' },
            hostActor(),
            txCtx()
        );

        const [where, patch] = (replyModel.update as unknown as { mock: { calls: unknown[][] } })
            .mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
        expect(where).toEqual({ id: REPLY_ID });
        expect(patch.reviewEditedAfterReply).toBe(true);
        expect(patch).not.toHaveProperty('content');
        expect(patch).not.toHaveProperty('moderationState');
        expect(replyModel.softDelete).not.toHaveBeenCalled();
        expect(replyModel.hardDelete).not.toHaveBeenCalled();
    });

    /** A star-only edit also makes the reply answer an older version. */
    it('marks the reply even when only the stars moved', async () => {
        const { service, replyModel } = buildEditService({ reply: approvedReply() });

        await service.updateReview({ reviewId: REVIEW_ID, overallRating: 1 }, hostActor(), txCtx());

        expect(firstPatch(replyModel.update).reviewEditedAfterReply).toBe(true);
    });

    it('does nothing to the reply when there is none', async () => {
        const { service, replyModel } = buildEditService();

        await service.updateReview({ reviewId: REVIEW_ID, overallRating: 1 }, hostActor(), txCtx());

        expect(replyModel.update).not.toHaveBeenCalled();
    });

    it('leaves an already-marked reply alone', async () => {
        const { service, replyModel } = buildEditService({
            reply: { ...approvedReply(), reviewEditedAfterReply: true }
        });

        await service.updateReview({ reviewId: REVIEW_ID, overallRating: 1 }, hostActor(), txCtx());

        expect(replyModel.update).not.toHaveBeenCalled();
    });

    it('does not resurrect a soft-deleted reply', async () => {
        const { service, replyModel } = buildEditService({
            reply: { ...approvedReply(), deletedAt: new Date('2026-07-03T00:00:00Z') }
        });

        await service.updateReview({ reviewId: REVIEW_ID, overallRating: 1 }, hostActor(), txCtx());

        expect(replyModel.update).not.toHaveBeenCalled();
    });
});

describe('HostTradeReviewService.getPendingCount', () => {
    it('refuses an actor without HOST_TRADE_REVIEW_MODERATE', async () => {
        const { service } = buildModerationService();

        const result = await service.getPendingCount({ actor: hostActor() });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('counts only PENDING, non-deleted reviews', async () => {
        const { service, model } = buildModerationService();

        const result = await service.getPendingCount({ actor: moderatorActor() });

        expect(result.data?.count).toBe(7);
        expect(model.count).toHaveBeenCalledWith(
            { moderationState: ModerationStatusEnum.PENDING, deletedAt: null },
            expect.anything()
        );
    });
});

describe('HostTradeReviewService.getMyReview — reading your own review back (T-034)', () => {
    /**
     * The endpoint the host's provider card calls before it decides whether to
     * offer "write a review" or "edit yours". Absence is an ORDINARY state here,
     * not a failure: most pairs have no review.
     */
    it('answers null instead of an error when the host has not reviewed yet', async () => {
        const { service } = buildService({ existingReview: null });

        const result = await service.getMyReview({ hostTradeId: HT_ID }, hostActor());

        expect(result.error).toBeUndefined();
        expect(result.data?.review).toBeNull();
    });

    it('returns the review the actor wrote for that provider', async () => {
        const { service } = buildService({
            existingReview: { id: 'review-1', hostTradeId: HT_ID, hostUserId: HOST_ID }
        });

        const result = await service.getMyReview({ hostTradeId: HT_ID }, hostActor());

        expect(result.data?.review).toMatchObject({ id: 'review-1' });
    });

    /**
     * The lookup is scoped by the SESSION, never by anything the caller sent:
     * the path carries the provider, the actor carries the host. Scoped by
     * `hostTradeId` alone this would hand back a stranger's review.
     */
    it('scopes the lookup to the actor and skips soft-deleted rows', async () => {
        const { service, model } = buildService({ existingReview: null });

        await service.getMyReview({ hostTradeId: HT_ID }, hostActor());

        expect(model.findOne).toHaveBeenCalledWith(
            { hostTradeId: HT_ID, hostUserId: HOST_ID, deletedAt: null },
            undefined
        );
    });

    /**
     * Auth-only (spec §7.5). Reading back your own row is not the directory
     * perk: a host whose `HOST_TRADE_REVIEW_CREATE` lapsed must still be able to
     * see — and therefore edit — what he already published.
     */
    it('does not require HOST_TRADE_REVIEW_CREATE', async () => {
        const { service } = buildService({
            existingReview: { id: 'review-1', hostTradeId: HT_ID, hostUserId: HOST_ID }
        });
        const permissionless = new ActorFactoryBuilder()
            .withId(HOST_ID)
            .withPermissions([])
            .build();

        const result = await service.getMyReview({ hostTradeId: HT_ID }, permissionless);

        expect(result.error).toBeUndefined();
        expect(result.data?.review).toMatchObject({ id: 'review-1' });
    });

    /**
     * The refusal comes from the base runner's `validateActor()`, not from a
     * guard inside the method — one was written and removed, because mutation
     * testing showed it could not fail. What this pins is that `getMyReview`
     * stays INSIDE `runWithLoggingAndValidation`: a "fast path" that read the
     * model directly would answer `null` to an anonymous caller, which reads as
     * "you have not reviewed them" rather than "you are not logged in".
     */
    it('refuses a call with no session behind it', async () => {
        const { service, model } = buildService();
        const anonymous = new ActorFactoryBuilder().withId('').withPermissions([]).build();

        const result = await service.getMyReview({ hostTradeId: HT_ID }, anonymous);

        expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
        expect(model.findOne).not.toHaveBeenCalled();
    });
});

describe('HostTradeReviewService.listForDirectory — what the directory may show (T-036)', () => {
    /**
     * Builds a service whose model records the `where` it was handed, which is
     * the only thing this layer decides. What that `where` DOES to the rows is
     * SQL, and is proven against a real database in
     * `packages/db/test/integration/host-trade-review-directory.integration.test.ts`.
     */
    function buildDirectoryService() {
        const model = createModelMock();
        model.findAllWithAuthorAndReply = vi.fn(async () => ({ items: [], total: 0 }));

        const service = new HostTradeReviewService(
            { logger: mockLogger },
            model as unknown as HostTradeReviewModel
        );

        return { service, model };
    }

    const lastWhere = (model: ReturnType<typeof createModelMock>) =>
        (model.findAllWithAuthorAndReply as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[0] as Record<string, unknown>;

    /**
     * A host reading the directory. Holds `HOST_TRADE_VIEW` — the directory's
     * own gate — which is a DIFFERENT permission from the one that lets him
     * write a review.
     */
    const directoryReader = () =>
        new ActorFactoryBuilder()
            .withId(HOST_ID)
            .withPermissions([PermissionEnum.HOST_TRADE_VIEW])
            .build();

    it('scopes the read to the provider named in the path', async () => {
        const { service, model } = buildDirectoryService();

        await service.listForDirectory(
            { hostTradeId: HT_ID, page: 1, pageSize: 10 },
            directoryReader()
        );

        expect(lastWhere(model).hostTradeId).toBe(HT_ID);
    });

    it('forces APPROVED and excludes soft-deleted rows', async () => {
        const { service, model } = buildDirectoryService();

        await service.listForDirectory(
            { hostTradeId: HT_ID, page: 1, pageSize: 10 },
            directoryReader()
        );

        expect(lastWhere(model).moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(lastWhere(model).deletedAt).toBeNull();
    });

    /**
     * THE PROPERTY THAT MATTERS: a `?moderationState=PENDING` must not turn
     * this endpoint into a window onto the moderation queue.
     *
     * What this pins is the INPUT SCHEMA, which does not declare those keys, so
     * Zod strips them before the handler runs. It is deliberately NOT a test of
     * the post-spread assignment order — mutation testing showed that reversing
     * that order changes nothing while the schema strips first, so a test
     * claiming to cover it would be claiming more than it proves.
     */
    it('drops a caller-supplied moderationState before it can widen the read', async () => {
        const { service, model } = buildDirectoryService();

        await service.listForDirectory(
            {
                hostTradeId: HT_ID,
                page: 1,
                pageSize: 10,
                moderationState: ModerationStatusEnum.PENDING,
                deletedAt: 'anything'
            } as never,
            directoryReader()
        );

        expect(lastWhere(model).moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(lastWhere(model).deletedAt).toBeNull();
    });

    it('passes the page window through', async () => {
        const { service, model } = buildDirectoryService();

        await service.listForDirectory(
            { hostTradeId: HT_ID, page: 3, pageSize: 5 },
            directoryReader()
        );

        const pagination = (
            model.findAllWithAuthorAndReply as unknown as { mock: { calls: unknown[][] } }
        ).mock.calls[0]?.[1];
        expect(pagination).toEqual({ page: 3, pageSize: 5 });
    });

    /**
     * A directory read, so it takes the directory's own gate. A provider
     * reading his OWN reviews holds no such permission — that is what
     * `/mine/reviews` is for, and it is a different endpoint.
     */
    it('refuses an actor without HOST_TRADE_VIEW', async () => {
        const { service, model } = buildDirectoryService();
        const outsider = new ActorFactoryBuilder().withId(HOST_ID).withPermissions([]).build();

        const result = await service.listForDirectory(
            { hostTradeId: HT_ID, page: 1, pageSize: 10 },
            outsider
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.findAllWithAuthorAndReply).not.toHaveBeenCalled();
    });

    it('returns the rows and the total the model reports', async () => {
        const { service, model } = buildDirectoryService();
        model.findAllWithAuthorAndReply = vi.fn(async () => ({
            items: [{ review: { id: 'review-1' }, author: null, reply: null }],
            total: 1
        }));

        const result = await service.listForDirectory(
            { hostTradeId: HT_ID, page: 1, pageSize: 10 },
            directoryReader()
        );

        expect(result.data?.total).toBe(1);
        expect(result.data?.items).toHaveLength(1);
    });
});
