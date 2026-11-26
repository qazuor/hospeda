import { moderateText } from '@repo/content-moderation';
import type { ReceivedReviewRow } from '@repo/db';
import {
    AccommodationModel,
    AccommodationReviewModel,
    AccommodationReviewReplyModel
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { AccommodationReviewReply } from '@repo/schemas';
import {
    AccommodationReviewReplyContentSchema,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    OwnerReceivedReviewsQuerySchema,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { getThresholdForContext } from '../contentModeration/get-threshold-for-context';
import { resolveInitialModerationState } from '../moderation/review-moderation.helpers';
import { checkCanModerateAccommodationReview } from './accommodationReview.permissions';

const logger = createLogger('accommodation-review-reply');

/** The one message every refusal on the host path carries, so none can be told apart. */
const REVIEW_NOT_FOUND_MESSAGE = 'Review not found';

/** PostgreSQL SQLSTATE of a unique violation. */
const UNIQUE_VIOLATION = '23505';

const uuidSchema = z.string().uuid({ message: 'zodError.common.id.invalidUuid' });

const writeReplyInputSchema = z.object({
    accommodationId: uuidSchema,
    reviewId: uuidSchema,
    content: AccommodationReviewReplyContentSchema
});
const reviewIdInputSchema = z.object({ accommodationId: uuidSchema, reviewId: uuidSchema });
const moderateReplyInputSchema = z.object({
    id: uuidSchema,
    decision: z.enum([ModerationStatusEnum.APPROVED, ModerationStatusEnum.REJECTED]),
    reason: z.string().max(1000).optional()
});
const receivedInputSchema = OwnerReceivedReviewsQuerySchema;

/** Whether a thrown value is a PostgreSQL unique violation, however deep its `cause`. */
function isUniqueViolation(error: unknown): boolean {
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current; depth++) {
        if (
            typeof current === 'object' &&
            (current as { code?: unknown }).code === UNIQUE_VIOLATION
        ) {
            return true;
        }
        current = (current as { cause?: unknown }).cause;
    }
    return false;
}

/**
 * Service for a host's reply to a review of their accommodation (HOS-2199).
 *
 * Authorization has two layers. The API route runs `resolveListingAccess` with
 * the `respond_reviews` entitlement at step 6. This service re-derives OWNERSHIP
 * from the accommodation row and answers NOT_FOUND for every refusal (missing
 * review, hidden review, foreign accommodation), never FORBIDDEN, because a 403
 * would confirm the review id exists.
 *
 * A reply is a right of response, not a thread: one LIVE reply per review
 * (partial unique index), publishes at once, re-checked by the content filter
 * on every write, soft-deletable, and answerable again after a delete.
 */
export class AccommodationReviewReplyService extends BaseService {
    static readonly ENTITY_NAME = 'accommodationReviewReply';

    private readonly model: AccommodationReviewReplyModel;
    private readonly reviewModel: AccommodationReviewModel;
    private readonly accommodationModel: AccommodationModel;

    constructor(
        config: ServiceConfig,
        models?: {
            readonly model?: AccommodationReviewReplyModel;
            readonly reviewModel?: AccommodationReviewModel;
            readonly accommodationModel?: AccommodationModel;
        }
    ) {
        super(config, AccommodationReviewReplyService.ENTITY_NAME);
        this.model = models?.model ?? new AccommodationReviewReplyModel();
        this.reviewModel = models?.reviewModel ?? new AccommodationReviewModel();
        this.accommodationModel = models?.accommodationModel ?? new AccommodationModel();
    }

    /**
     * Writes the reply to a review of the actor's own accommodation.
     *
     * @param input.accommodationId - The accommodation the review is on (from the URL).
     * @param input.reviewId - The review being answered.
     * @param input.content - The reply text.
     * @param input.actor - The accommodation owner.
     * @returns The created reply. `moderationState` is PENDING when the filter flagged it.
     */
    public async respond(
        input: {
            readonly accommodationId: string;
            readonly reviewId: string;
            readonly content: string;
            readonly actor: Actor;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ reply: AccommodationReviewReply }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'respond',
            input,
            schema: writeReplyInputSchema,
            ctx,
            execute: async (validated, actor) => {
                const { accommodationId } = await this.requireAnswerableReview({
                    accommodationId: validated.accommodationId,
                    reviewId: validated.reviewId,
                    actor,
                    ctx
                });
                const existing = await this.model.findOne(
                    { reviewId: validated.reviewId, deletedAt: null },
                    ctx?.tx
                );
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'This review already has a reply'
                    );
                }
                const filtered = await this.resolveState(validated.content);
                // An admin decision must survive delete-and-repost: a review whose
                // deleted reply an admin moderated gets its new reply held for a human.
                const moderationState = (await this.model.hasAdminModeratedDeletedReply(
                    { reviewId: validated.reviewId },
                    ctx?.tx
                ))
                    ? ModerationStatusEnum.PENDING
                    : filtered;
                try {
                    const reply = await this.model.create(
                        {
                            reviewId: validated.reviewId,
                            authorUserId: actor.id,
                            content: validated.content,
                            moderationState,
                            createdById: actor.id,
                            updatedById: actor.id
                            // TYPE-WORKAROUND: the create payload omits columns the database defaults (timestamps, moderation audit), which the entity type requires.
                        } as unknown as Partial<AccommodationReviewReply>,
                        ctx?.tx
                    );
                    await this.scheduleRevalidation(accommodationId);
                    return { reply };
                } catch (error) {
                    // The unique index is the real guarantee; this turns the race
                    // loser's violation into the same 409 the guard above gives.
                    if (isUniqueViolation(error)) {
                        throw new ServiceError(
                            ServiceErrorCode.ALREADY_EXISTS,
                            'This review already has a reply'
                        );
                    }
                    throw error;
                }
            }
        });
    }

    /**
     * Rewrites the actor's live reply. The new text passes the content filter
     * again and the reply is marked as edited.
     *
     * An admin decision survives the edit: a reply an admin REJECTED stays
     * REJECTED (the host can delete it and write a new one, which the filter
     * judges from scratch).
     *
     * @param input.reviewId - The review whose reply is edited.
     * @param input.content - The new text.
     * @param input.actor - The accommodation owner.
     */
    public async editReply(
        input: {
            readonly accommodationId: string;
            readonly reviewId: string;
            readonly content: string;
            readonly actor: Actor;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ reply: AccommodationReviewReply }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'editReply',
            input,
            schema: writeReplyInputSchema,
            ctx,
            execute: async (validated, actor) => {
                const { accommodationId } = await this.requireAnswerableReview({
                    accommodationId: validated.accommodationId,
                    reviewId: validated.reviewId,
                    actor,
                    ctx
                });
                const live = await this.requireLiveReply({ reviewId: validated.reviewId, ctx });
                const filtered = await this.resolveState(validated.content);
                const adminRejected = live.moderationState === ModerationStatusEnum.REJECTED;
                const updated = await this.model.update(
                    { id: live.id },
                    {
                        content: validated.content,
                        moderationState: adminRejected ? ModerationStatusEnum.REJECTED : filtered,
                        // A fresh filter verdict is not a human decision: clear the audit
                        // of the previous one unless an admin's rejection is being kept.
                        ...(adminRejected
                            ? {}
                            : { moderatedById: null, moderatedAt: null, moderationReason: null }),
                        editedAt: new Date(),
                        updatedById: actor.id
                        // TYPE-WORKAROUND: the patch clears nullable moderation audit columns the entity type marks optional.
                    } as unknown as Partial<AccommodationReviewReply>,
                    ctx?.tx
                );
                if (!updated) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, REVIEW_NOT_FOUND_MESSAGE);
                }
                await this.scheduleRevalidation(accommodationId);
                return { reply: updated };
            }
        });
    }

    /**
     * Soft-deletes the actor's live reply. The slot frees, so the host can answer again.
     *
     * @param input.reviewId - The review whose reply is deleted.
     * @param input.actor - The accommodation owner.
     */
    public async deleteReply(
        input: {
            readonly accommodationId: string;
            readonly reviewId: string;
            readonly actor: Actor;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ deleted: true }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'deleteReply',
            input,
            schema: reviewIdInputSchema,
            ctx,
            execute: async (validated, actor) => {
                const { accommodationId } = await this.requireAnswerableReview({
                    accommodationId: validated.accommodationId,
                    reviewId: validated.reviewId,
                    actor,
                    ctx
                });
                const live = await this.requireLiveReply({ reviewId: validated.reviewId, ctx });
                await this.model.softDelete({ id: live.id }, actor.id, ctx?.tx);
                await this.scheduleRevalidation(accommodationId);
                return { deleted: true as const };
            }
        });
    }

    /**
     * Reviews received on the actor's own accommodations, each with its live reply.
     *
     * @param input.actor - The accommodation owner.
     * @param input.page - 1-based page.
     * @param input.pageSize - Page size.
     * @param input.unanswered - Keep only reviews with no live reply.
     * @param input.accommodationId - Narrow to one accommodation.
     */
    public async listReceived(
        input: {
            readonly actor: Actor;
            readonly page?: number;
            readonly pageSize?: number;
            readonly unanswered?: boolean;
            readonly accommodationId?: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ items: ReceivedReviewRow[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listReceived',
            input,
            schema: receivedInputSchema.extend({ unanswered: z.boolean().default(false) }),
            ctx,
            execute: async (validated, actor) =>
                this.model.findReceivedByOwner(
                    {
                        ownerId: actor.id,
                        unanswered: validated.unanswered,
                        accommodationId: validated.accommodationId,
                        page: validated.page,
                        pageSize: validated.pageSize
                    },
                    ctx?.tx
                )
        });
    }

    /**
     * The replies the public page may show, keyed by review id. PENDING,
     * REJECTED and deleted replies are never returned.
     *
     * @param input.reviewIds - The reviews on the page being rendered.
     */
    public async getPublicRepliesByReviewIds(input: {
        readonly reviewIds: readonly string[];
    }): Promise<ReadonlyMap<string, { content: string; createdAt: Date; editedAt: Date | null }>> {
        const rows = await this.model.findPublicByReviewIds({ reviewIds: input.reviewIds });
        return new Map(
            rows.map((row) => [
                row.reviewId,
                { content: row.content, createdAt: row.createdAt, editedAt: row.editedAt }
            ])
        );
    }

    /**
     * Approves or hides a reply (admin). `REJECTED` hides it from the public page.
     *
     * @param input.id - The reply.
     * @param input.decision - `APPROVED` or `REJECTED`.
     * @param input.reason - Why. Cleared when absent.
     * @param input.actor - Must hold `ACCOMMODATION_REVIEW_MODERATE`.
     */
    public async moderateReply(
        input: {
            readonly id: string;
            readonly decision: ModerationStatusEnum.APPROVED | ModerationStatusEnum.REJECTED;
            readonly reason?: string;
            readonly actor: Actor;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ reply: AccommodationReviewReply }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'moderateReply',
            input,
            schema: moderateReplyInputSchema,
            ctx,
            execute: async (validated, actor) => {
                checkCanModerateAccommodationReview(actor);
                const existing = await this.model.findById(validated.id, ctx?.tx);
                if (!existing || existing.deletedAt) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Reply not found');
                }
                const updated = await this.model.update(
                    { id: validated.id },
                    {
                        moderationState: validated.decision,
                        moderatedById: actor.id,
                        moderatedAt: new Date(),
                        moderationReason: validated.reason ?? null
                        // TYPE-WORKAROUND: the patch writes moderation audit columns the entity type marks optional.
                    } as unknown as Partial<AccommodationReviewReply>,
                    ctx?.tx
                );
                if (!updated) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Reply not found');
                }
                const review = await this.reviewModel.findById(existing.reviewId, ctx?.tx);
                if (review) await this.scheduleRevalidation(review.accommodationId);
                return { reply: updated };
            }
        });
    }

    /** The state a reply written now is born in: APPROVED unless the filter flags it. */
    private async resolveState(content: string): Promise<ModerationStatusEnum> {
        const [moderationResult, thresholds] = await Promise.all([
            moderateText({ text: content, context: 'review' }),
            getThresholdForContext({ context: 'review' })
        ]);
        return resolveInitialModerationState({
            entityType: 'accommodationReply',
            verificationLevel: 'none',
            moderationScore: moderationResult.score,
            pendingThreshold: thresholds.pending,
            degraded: moderationResult.degraded
        });
    }

    /**
     * Loads the review the actor may answer, or throws NOT_FOUND. A review is
     * answerable when it is publicly visible (APPROVED, ACTIVE, not deleted) and
     * its accommodation is the actor's and not deleted.
     */
    private async requireAnswerableReview(args: {
        readonly accommodationId: string;
        readonly reviewId: string;
        readonly actor: Actor;
        readonly ctx?: ServiceContext;
    }): Promise<{ readonly accommodationId: string }> {
        const notFound = () =>
            new ServiceError(ServiceErrorCode.NOT_FOUND, REVIEW_NOT_FOUND_MESSAGE);
        const review = await this.reviewModel.findById(args.reviewId, args.ctx?.tx);
        if (
            !review ||
            review.accommodationId !== args.accommodationId ||
            review.deletedAt ||
            review.lifecycleState !== LifecycleStatusEnum.ACTIVE ||
            review.moderationState !== ModerationStatusEnum.APPROVED
        ) {
            throw notFound();
        }
        const accommodation = await this.accommodationModel.findById(
            review.accommodationId,
            args.ctx?.tx
        );
        if (!accommodation || accommodation.deletedAt || accommodation.ownerId !== args.actor.id) {
            throw notFound();
        }
        return { accommodationId: review.accommodationId };
    }

    private async requireLiveReply(args: {
        readonly reviewId: string;
        readonly ctx?: ServiceContext;
    }): Promise<AccommodationReviewReply> {
        const live = await this.model.findOne(
            { reviewId: args.reviewId, deletedAt: null },
            args.ctx?.tx
        );
        if (!live) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, REVIEW_NOT_FOUND_MESSAGE);
        }
        return live;
    }

    /** Refreshes the public listing page. Best-effort: never undoes the write. */
    private async scheduleRevalidation(accommodationId: string): Promise<void> {
        try {
            const accommodation = await this.accommodationModel.findById(accommodationId);
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation_review',
                accommodationSlug: accommodation?.slug
            });
        } catch (error) {
            logger.warn({ error, accommodationId }, 'Reply revalidation failed (non-blocking)');
        }
    }
}
