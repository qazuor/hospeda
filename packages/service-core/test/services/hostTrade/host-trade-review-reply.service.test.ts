/**
 * @fileoverview The provider's right of reply (T-025, AC-21 and AC-23).
 *
 * Two things are being pinned here. First, that authorisation runs on ROW
 * OWNERSHIP and answers NOT_FOUND — never FORBIDDEN — so the endpoint cannot be
 * used to enumerate reviews. Second, that editing a published reply returns it
 * to PENDING and wipes the decision that approved the previous text.
 */
import type { HostTradeModel, HostTradeReviewModel, HostTradeReviewReplyModel } from '@repo/db';
import { ModerationStatusEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeReviewReplyService } from '../../../src/services/hostTrade/host-trade-review-reply.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const HT_ID = getMockId('attraction', 'ht-reply-1');
const REVIEW_ID = getMockId('feature', 'reply-review-1');
const REPLY_ID = getMockId('feature', 'reply-1');
const OWNER_ID = getMockId('user', 'reply-owner');
const STRANGER_ID = getMockId('user', 'reply-stranger');

const CONTENT = 'Lamento la demora, tuvimos un imprevisto con la camioneta ese día.';

/**
 * The provider's owner account. It carries NO permissions on purpose: replying
 * is authorised by owning the row, never by a grant (AC-7 of HOS-278).
 */
const ownerActor = () => new ActorFactoryBuilder().withId(OWNER_ID).withPermissions([]).build();
const strangerActor = () =>
    new ActorFactoryBuilder().withId(STRANGER_ID).withPermissions([]).build();

function buildService(
    options: {
        review?: Record<string, unknown> | null;
        provider?: Record<string, unknown> | null;
        existingReply?: Record<string, unknown> | null;
        reply?: Record<string, unknown> | null;
    } = {}
) {
    const model = createModelMock();
    const reviewModel = createModelMock();
    const hostTradeModel = createModelMock();

    reviewModel.findById = vi.fn(async () =>
        options.review === undefined
            ? { id: REVIEW_ID, hostTradeId: HT_ID, deletedAt: null }
            : options.review
    );
    hostTradeModel.findById = vi.fn(async () =>
        options.provider === undefined
            ? { id: HT_ID, ownerUserId: OWNER_ID, deletedAt: null }
            : options.provider
    );
    model.findOne = vi.fn(async () => options.existingReply ?? null);
    model.findById = vi.fn(async () =>
        options.reply === undefined
            ? {
                  id: REPLY_ID,
                  reviewId: REVIEW_ID,
                  authorUserId: OWNER_ID,
                  content: CONTENT,
                  moderationState: ModerationStatusEnum.APPROVED,
                  moderatedById: getMockId('user', 'an-admin'),
                  moderatedAt: new Date('2026-08-02T00:00:00Z'),
                  moderationReason: 'todo bien',
                  deletedAt: null
              }
            : options.reply
    );
    model.create = vi.fn(async (data: Record<string, unknown>) => ({
        id: REPLY_ID,
        moderationState: ModerationStatusEnum.PENDING,
        ...data
    }));
    model.update = vi.fn(async (_where: unknown, data: Record<string, unknown>) => ({
        id: REPLY_ID,
        ...data
    }));

    const service = new HostTradeReviewReplyService(
        { logger: mockLogger },
        model as unknown as HostTradeReviewReplyModel,
        reviewModel as unknown as HostTradeReviewModel,
        hostTradeModel as unknown as HostTradeModel
    );

    return { service, model, reviewModel, hostTradeModel };
}

/** First argument of the nth call to a mocked model method. */
function firstArg(mock: unknown, call = 0): Record<string, unknown> {
    return (mock as { mock: { calls: unknown[][] } }).mock.calls[call]?.[0] as Record<
        string,
        unknown
    >;
}

/** Second argument of the nth call to a mocked model method. */
function secondArg(mock: unknown, call = 0): Record<string, unknown> {
    return (mock as { mock: { calls: unknown[][] } }).mock.calls[call]?.[1] as Record<
        string,
        unknown
    >;
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createReply
// ---------------------------------------------------------------------------

describe('HostTradeReviewReplyService.createReply', () => {
    it('lets the owner of the reviewed listing answer', async () => {
        const { service, model } = buildService();

        const result = await service.createReply(
            { reviewId: REVIEW_ID, content: CONTENT },
            ownerActor()
        );

        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalled();
    });

    it('stamps the author from the session and the review from the path', async () => {
        const { service, model } = buildService();

        await service.createReply({ reviewId: REVIEW_ID, content: CONTENT }, ownerActor());

        const row = firstArg(model.create);
        expect(row.reviewId).toBe(REVIEW_ID);
        expect(row.authorUserId).toBe(OWNER_ID);
        expect(row.content).toBe(CONTENT);
    });

    /**
     * AC-21 — the reply is born PENDING. The service does not name the state:
     * it comes from the column default, and T-027 will layer `moderateText()`
     * on top. A service that wrote it explicitly would be a second source of
     * truth for the same decision.
     */
    it('never names the moderation state itself', async () => {
        const { service, model } = buildService();

        await service.createReply({ reviewId: REVIEW_ID, content: CONTENT }, ownerActor());

        expect(firstArg(model.create)).not.toHaveProperty('moderationState');
    });

    /**
     * NOT_FOUND, not FORBIDDEN. A 403 would confirm the review exists, turning
     * the endpoint into an oracle for review ids.
     */
    it("answers NOT_FOUND when the review belongs to someone else's listing", async () => {
        const { service, model } = buildService();

        const result = await service.createReply(
            { reviewId: REVIEW_ID, content: CONTENT },
            strangerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a review that does not exist', async () => {
        const { service, model } = buildService({ review: null });

        const result = await service.createReply(
            { reviewId: REVIEW_ID, content: CONTENT },
            ownerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a soft-deleted review', async () => {
        const { service, model } = buildService({
            review: {
                id: REVIEW_ID,
                hostTradeId: HT_ID,
                deletedAt: new Date('2026-08-03T00:00:00Z')
            }
        });

        const result = await service.createReply(
            { reviewId: REVIEW_ID, content: CONTENT },
            ownerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND when the reviewed listing is gone', async () => {
        const { service, model } = buildService({ provider: null });

        const result = await service.createReply(
            { reviewId: REVIEW_ID, content: CONTENT },
            ownerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    /**
     * A right of response, not a thread. The UNIQUE index on `reviewId` is the
     * real guarantee; this turns the race loser's constraint violation into a
     * meaningful 409.
     */
    it('answers ALREADY_EXISTS on a second reply to the same review', async () => {
        const { service, model } = buildService({ existingReply: { id: REPLY_ID } });

        const result = await service.createReply(
            { reviewId: REVIEW_ID, content: CONTENT },
            ownerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(model.create).not.toHaveBeenCalled();
    });

    it.each([
        ['too short', 'x'.repeat(9)],
        ['too long', 'x'.repeat(1001)]
    ])('rejects a content that is %s', async (_label, content) => {
        const { service, model } = buildService();

        const result = await service.createReply({ reviewId: REVIEW_ID, content }, ownerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.create).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// updateReply
// ---------------------------------------------------------------------------

describe('HostTradeReviewReplyService.updateReply', () => {
    const NEW_CONTENT = 'Corrijo: la demora fue nuestra y ya lo resolvimos con el cliente.';

    it('lets the owner rewrite their own reply', async () => {
        const { service, model } = buildService();

        const result = await service.updateReply(
            { replyId: REPLY_ID, content: NEW_CONTENT },
            ownerActor()
        );

        expect(result.error).toBeUndefined();
        expect(secondArg(model.update).content).toBe(NEW_CONTENT);
    });

    it('targets the reply by id', async () => {
        const { service, model } = buildService();

        await service.updateReply({ replyId: REPLY_ID, content: NEW_CONTENT }, ownerActor());

        expect(firstArg(model.update)).toEqual({ id: REPLY_ID });
    });

    /** AC-23 — an edited reply leaves the directory until an admin re-approves. */
    it('sends an APPROVED reply back to PENDING', async () => {
        const { service, model } = buildService();

        await service.updateReply({ replyId: REPLY_ID, content: NEW_CONTENT }, ownerActor());

        expect(secondArg(model.update).moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    /**
     * The previous decision was made about text that no longer exists. Left in
     * place, the moderation queue would show a reply "approved" at a timestamp
     * that refers to something else, and a provider whose earlier version was
     * rejected would keep reading a reason that no longer applies.
     */
    it.each([
        'moderatedById',
        'moderatedAt',
        'moderationReason'
    ])('clears %s, which described the previous text', async (field) => {
        const { service, model } = buildService();

        await service.updateReply({ replyId: REPLY_ID, content: NEW_CONTENT }, ownerActor());

        expect(secondArg(model.update)[field]).toBeNull();
    });

    it('answers NOT_FOUND when the reply is not the actor’s', async () => {
        const { service, model } = buildService();

        const result = await service.updateReply(
            { replyId: REPLY_ID, content: NEW_CONTENT },
            strangerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a reply that does not exist', async () => {
        const { service, model } = buildService({ reply: null });

        const result = await service.updateReply(
            { replyId: REPLY_ID, content: NEW_CONTENT },
            ownerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it.each([
        ['too short', 'x'.repeat(9)],
        ['too long', 'x'.repeat(1001)]
    ])('rejects a content that is %s', async (_label, content) => {
        const { service, model } = buildService();

        const result = await service.updateReply({ replyId: REPLY_ID, content }, ownerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });
});
