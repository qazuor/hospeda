/**
 * @fileoverview The four eligibility gates for creating a review (T-024).
 *
 * Each gate gets its own isolated test: the fixture satisfies every OTHER gate
 * and violates exactly one, so a passing test names the gate that actually
 * fired rather than "something refused".
 */
import type { HostTradeBenefitUsageModel, HostTradeModel, HostTradeReviewModel } from '@repo/db';
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
