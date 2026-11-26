/**
 * @fileoverview The host's reply to a review of their accommodation (HOS-2199).
 *
 * Pins four things: ownership is derived from the accommodation row and every
 * refusal answers NOT_FOUND (never FORBIDDEN); the reply publishes at once and
 * only the content filter (or a degraded engine) holds it as PENDING; an edit
 * marks the reply edited, re-runs the filter and never lifts an admin
 * rejection; and a deleted reply frees the slot for a new one.
 */
import type {
    AccommodationModel,
    AccommodationReviewModel,
    AccommodationReviewReplyModel
} from '@repo/db';
import { ModerationStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/content-moderation', () => ({
    moderateText: vi.fn(async () => ({ score: 0, degraded: false }))
}));

vi.mock('../../../src/services/contentModeration/get-threshold-for-context.js', () => ({
    getThresholdForContext: vi.fn(async () => ({
        context: 'review',
        pending: 0.5,
        reject: 0.85,
        source: 'code-constants'
    }))
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn(() => ({ scheduleRevalidation: vi.fn() }))
}));

import { moderateText } from '@repo/content-moderation';
import { AccommodationReviewReplyService } from '../../../src/services/accommodationReview/accommodationReviewReply.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const ACCOMMODATION_ID = getMockId('accommodation', 'reply-acc');
const OTHER_ACCOMMODATION_ID = getMockId('accommodation', 'reply-other-acc');
const REVIEW_ID = getMockId('feature', 'reply-review');
const REPLY_ID = getMockId('feature', 'reply-1');
const OWNER_ID = getMockId('user', 'reply-owner');
const STRANGER_ID = getMockId('user', 'reply-stranger');
const ADMIN_ID = getMockId('user', 'reply-admin');

const CONTENT = 'Gracias por tu visita, nos alegra que la hayas disfrutado.';

const ownerActor = () => new ActorFactoryBuilder().withId(OWNER_ID).withPermissions([]).build();
const strangerActor = () =>
    new ActorFactoryBuilder().withId(STRANGER_ID).withPermissions([]).build();
const adminActor = () =>
    new ActorFactoryBuilder()
        .withId(ADMIN_ID)
        .withPermissions([PermissionEnum.ACCOMMODATION_REVIEW_MODERATE])
        .build();

function buildService(
    options: {
        review?: Record<string, unknown> | null;
        accommodation?: Record<string, unknown> | null;
        liveReply?: Record<string, unknown> | null;
        adminModeratedDeleted?: boolean;
    } = {}
) {
    const model = createModelMock();
    const reviewModel = createModelMock();
    const accommodationModel = createModelMock();

    reviewModel.findById = vi.fn(async () =>
        options.review === undefined
            ? {
                  id: REVIEW_ID,
                  accommodationId: ACCOMMODATION_ID,
                  lifecycleState: 'ACTIVE',
                  moderationState: ModerationStatusEnum.APPROVED,
                  deletedAt: null
              }
            : options.review
    );
    accommodationModel.findById = vi.fn(async () =>
        options.accommodation === undefined
            ? { id: ACCOMMODATION_ID, ownerId: OWNER_ID, slug: 'casa', deletedAt: null }
            : options.accommodation
    );
    model.findOne = vi.fn(async () => options.liveReply ?? null);
    model.findById = vi.fn(async () => options.liveReply ?? null);
    model.create = vi.fn(async (data: Record<string, unknown>) => ({ id: REPLY_ID, ...data }));
    model.update = vi.fn(async (_where: unknown, data: Record<string, unknown>) => ({
        id: REPLY_ID,
        reviewId: REVIEW_ID,
        ...data
    }));
    model.softDelete = vi.fn(async () => 1);
    (model as unknown as { hasAdminModeratedDeletedReply: unknown }).hasAdminModeratedDeletedReply =
        vi.fn(async () => options.adminModeratedDeleted ?? false);

    const service = new AccommodationReviewReplyService(
        { logger: mockLogger },
        {
            model: model as unknown as AccommodationReviewReplyModel,
            reviewModel: reviewModel as unknown as AccommodationReviewModel,
            accommodationModel: accommodationModel as unknown as AccommodationModel
        }
    );
    return { service, model, reviewModel, accommodationModel };
}

const firstArg = (mock: unknown, call = 0) =>
    (mock as { mock: { calls: unknown[][] } }).mock.calls[call]?.[0] as Record<string, unknown>;
const secondArg = (mock: unknown, call = 0) =>
    (mock as { mock: { calls: unknown[][] } }).mock.calls[call]?.[1] as Record<string, unknown>;

const input = (extra: Record<string, unknown> = {}) => ({
    accommodationId: ACCOMMODATION_ID,
    reviewId: REVIEW_ID,
    content: CONTENT,
    actor: ownerActor(),
    ...extra
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('AccommodationReviewReplyService.respond', () => {
    it('publishes a clean reply at once as APPROVED', async () => {
        const { service, model } = buildService();

        const result = await service.respond(input());

        expect(result.error).toBeUndefined();
        const created = firstArg(model.create);
        expect(created.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(created.reviewId).toBe(REVIEW_ID);
        expect(created.authorUserId).toBe(OWNER_ID);
        expect(created.content).toBe(CONTENT);
    });

    it('holds a reply the content filter flags as PENDING', async () => {
        vi.mocked(moderateText).mockResolvedValueOnce({ score: 1, degraded: false } as never);
        const { service, model } = buildService();

        await service.respond(input());

        expect(firstArg(model.create).moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    it('holds a reply as PENDING when the filter could not reach a verdict', async () => {
        vi.mocked(moderateText).mockResolvedValueOnce({ score: 0, degraded: true } as never);
        const { service, model } = buildService();

        await service.respond(input());

        expect(firstArg(model.create).moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    it('answers NOT_FOUND when the accommodation belongs to somebody else', async () => {
        const { service, model } = buildService();

        const result = await service.respond(input({ actor: strangerActor() }));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND when the review is on a different accommodation than the URL', async () => {
        const { service, model } = buildService();

        const result = await service.respond(input({ accommodationId: OTHER_ACCOMMODATION_ID }));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it.each([
        ['missing', null],
        [
            'deleted',
            {
                accommodationId: ACCOMMODATION_ID,
                lifecycleState: 'ACTIVE',
                moderationState: 'APPROVED',
                deletedAt: new Date()
            }
        ],
        [
            'archived',
            {
                accommodationId: ACCOMMODATION_ID,
                lifecycleState: 'ARCHIVED',
                moderationState: 'APPROVED',
                deletedAt: null
            }
        ],
        [
            'not approved',
            {
                accommodationId: ACCOMMODATION_ID,
                lifecycleState: 'ACTIVE',
                moderationState: 'PENDING',
                deletedAt: null
            }
        ]
    ])('answers NOT_FOUND for a %s review', async (_label, review) => {
        const { service, model } = buildService({ review });

        const result = await service.respond(input());

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers the same message for every refusal so none can be told apart', async () => {
        const missing = await buildService({ review: null }).service.respond(input());
        const foreign = await buildService().service.respond(input({ actor: strangerActor() }));

        expect(foreign.error?.message).toBe(missing.error?.message);
    });

    it('answers ALREADY_EXISTS when the review already has a live reply', async () => {
        const { service, model } = buildService({ liveReply: { id: REPLY_ID } });

        const result = await service.respond(input());

        expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('turns a unique violation from the race loser into ALREADY_EXISTS', async () => {
        const { service, model } = buildService();
        model.create = vi.fn(async () => {
            throw Object.assign(new Error('db'), { cause: { code: '23505' } });
        });

        const result = await service.respond(input());

        expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
    });

    it('holds the new reply as PENDING when an admin moderated the deleted one (no delete-and-repost bypass)', async () => {
        const { service, model } = buildService({ liveReply: null, adminModeratedDeleted: true });

        const result = await service.respond(input());

        expect(result.error).toBeUndefined();
        expect(firstArg(model.create).moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    it('rejects an empty reply', async () => {
        const { service } = buildService();

        const result = await service.respond(input({ content: '   ' }));

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});

describe('AccommodationReviewReplyService.editReply', () => {
    const live = (extra: Record<string, unknown> = {}) => ({
        id: REPLY_ID,
        reviewId: REVIEW_ID,
        moderationState: ModerationStatusEnum.APPROVED,
        ...extra
    });

    it('marks the reply as edited and re-runs the filter', async () => {
        vi.mocked(moderateText).mockResolvedValueOnce({ score: 1, degraded: false } as never);
        const { service, model } = buildService({ liveReply: live() });

        const result = await service.editReply(input({ content: 'Texto nuevo y distinto.' }));

        expect(result.error).toBeUndefined();
        const patch = secondArg(model.update);
        expect(patch.editedAt).toBeInstanceOf(Date);
        expect(patch.content).toBe('Texto nuevo y distinto.');
        expect(patch.moderationState).toBe(ModerationStatusEnum.PENDING);
        expect(patch.moderatedById).toBeNull();
    });

    it('never lifts an admin rejection by editing', async () => {
        const { service, model } = buildService({
            liveReply: live({ moderationState: ModerationStatusEnum.REJECTED })
        });

        await service.editReply(input());

        const patch = secondArg(model.update);
        expect(patch.moderationState).toBe(ModerationStatusEnum.REJECTED);
        expect('moderatedById' in patch).toBe(false);
    });

    it('answers NOT_FOUND when there is no live reply', async () => {
        const { service } = buildService({ liveReply: null });

        const result = await service.editReply(input());

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('answers NOT_FOUND to somebody who does not own the accommodation', async () => {
        const { service, model } = buildService({ liveReply: live() });

        const result = await service.editReply(input({ actor: strangerActor() }));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('AccommodationReviewReplyService.deleteReply', () => {
    it('soft-deletes the live reply on behalf of the owner', async () => {
        const { service, model } = buildService({ liveReply: { id: REPLY_ID } });

        const result = await service.deleteReply({
            accommodationId: ACCOMMODATION_ID,
            reviewId: REVIEW_ID,
            actor: ownerActor()
        });

        expect(result.data).toEqual({ deleted: true });
        expect(firstArg(model.softDelete)).toEqual({ id: REPLY_ID });
        expect((model.softDelete as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toBe(OWNER_ID);
    });

    it('answers NOT_FOUND to somebody who does not own the accommodation', async () => {
        const { service, model } = buildService({ liveReply: { id: REPLY_ID } });

        const result = await service.deleteReply({
            accommodationId: ACCOMMODATION_ID,
            reviewId: REVIEW_ID,
            actor: strangerActor()
        });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.softDelete).not.toHaveBeenCalled();
    });

    it('lets the host answer again once the reply is deleted (no live reply remains)', async () => {
        const { service, model } = buildService({ liveReply: null });

        const result = await service.respond(input());

        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalledTimes(1);
        // The guard looks only at LIVE replies: deleted rows are history.
        expect(firstArg(model.findOne)).toEqual({ reviewId: REVIEW_ID, deletedAt: null });
    });
});

describe('AccommodationReviewReplyService.moderateReply', () => {
    const existing = { id: REPLY_ID, reviewId: REVIEW_ID, deletedAt: null };

    it('hides a reply when an admin rejects it', async () => {
        const { service, model } = buildService({ liveReply: existing });

        const result = await service.moderateReply({
            id: REPLY_ID,
            decision: ModerationStatusEnum.REJECTED,
            reason: 'insulto',
            actor: adminActor()
        });

        expect(result.error).toBeUndefined();
        const patch = secondArg(model.update);
        expect(patch.moderationState).toBe(ModerationStatusEnum.REJECTED);
        expect(patch.moderatedById).toBe(ADMIN_ID);
        expect(patch.moderationReason).toBe('insulto');
    });

    it('is FORBIDDEN without the moderate permission', async () => {
        const { service, model } = buildService({ liveReply: existing });

        const result = await service.moderateReply({
            id: REPLY_ID,
            decision: ModerationStatusEnum.REJECTED,
            actor: ownerActor()
        });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('AccommodationReviewReplyService.getPublicRepliesByReviewIds', () => {
    it('keys the public replies by review id', async () => {
        const { service, model } = buildService();
        const createdAt = new Date('2026-11-01T00:00:00Z');
        (model as unknown as { findPublicByReviewIds: unknown }).findPublicByReviewIds = vi.fn(
            async () => [{ reviewId: REVIEW_ID, content: CONTENT, createdAt, editedAt: null }]
        );

        const map = await service.getPublicRepliesByReviewIds({ reviewIds: [REVIEW_ID] });

        expect(map.get(REVIEW_ID)).toEqual({ content: CONTENT, createdAt, editedAt: null });
    });
});

describe('AccommodationReviewReplyService.listReceived', () => {
    it('always scopes the query to the actor as owner, whatever the filters', async () => {
        const { service, model } = buildService();
        (model as unknown as { findReceivedByOwner: unknown }).findReceivedByOwner = vi.fn(
            async () => ({ items: [], total: 0 })
        );

        const result = await service.listReceived({
            actor: ownerActor(),
            unanswered: true,
            accommodationId: OTHER_ACCOMMODATION_ID
        });

        expect(result.error).toBeUndefined();
        expect(
            firstArg((model as unknown as { findReceivedByOwner: unknown }).findReceivedByOwner)
        ).toEqual({
            ownerId: OWNER_ID,
            unanswered: true,
            accommodationId: OTHER_ACCOMMODATION_ID,
            page: 1,
            pageSize: 10
        });
    });
});
