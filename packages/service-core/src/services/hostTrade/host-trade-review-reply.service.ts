import { moderateText } from '@repo/content-moderation';
import { HostTradeModel, HostTradeReviewModel, HostTradeReviewReplyModel } from '@repo/db';
import type {
    CountResponse,
    HostTradeReview,
    HostTradeReviewReply,
    HostTradeReviewReplyAdminSearch
} from '@repo/schemas';
import {
    HostTradeReviewReplyAdminSearchSchema,
    HostTradeReviewReplyContentSchema,
    HostTradeReviewReplyCreateInputSchema,
    HostTradeReviewReplyUpdateInputSchema,
    ModerationStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type {
    Actor,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { getThresholdForContext } from '../contentModeration/get-threshold-for-context';
import { resolveInitialModerationState } from '../moderation/review-moderation.helpers';
import {
    checkCanModerateHostTradeReviews,
    checkCanViewAllHostTradeReviews
} from './host-trade-review.permissions';

/**
 * The state a new reply is born in (spec §6.4).
 *
 * Always `PENDING` — the entity default in `resolveInitialModerationState` is
 * unconditional for a reply, so the moderation score cannot make it any more
 * pending than it already is. The engine still runs, and deliberately: the
 * score it records is what an admin sees first in the queue, and it is what
 * lets the reply be treated like every other moderated text the day the
 * threshold moves or the queue grows an auto-reject tier.
 */
async function resolveReplyModerationState(content: string) {
    const [moderationResult, thresholds] = await Promise.all([
        moderateText({ text: content, context: 'review' }),
        getThresholdForContext({ context: 'review' })
    ]);

    return resolveInitialModerationState({
        entityType: 'hostTradeReply',
        verificationLevel: 'none',
        moderationScore: moderationResult.score,
        pendingThreshold: thresholds.pending
    });
}

/** Input for {@link HostTradeReviewReplyService.createReply}. */
const createReplyInputSchema = z.object({
    reviewId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    content: HostTradeReviewReplyContentSchema
});

/** Input for {@link HostTradeReviewReplyService.moderateReply}. */
const moderateReplyInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    decision: z.enum([ModerationStatusEnum.APPROVED, ModerationStatusEnum.REJECTED]),
    reason: z.string().max(1000).optional()
});

/** Input for {@link HostTradeReviewReplyService.updateReply}. */
const updateReplyInputSchema = z.object({
    replyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    content: HostTradeReviewReplyContentSchema
});

/**
 * Service for the provider's reply to a review (HOS-376 §6.4).
 *
 * Two properties define it.
 *
 * Authorisation is ROW OWNERSHIP, never a permission: an approved provider
 * receives no role and no grant (AC-7 of HOS-278), so the only question is
 * whether the reviewed listing is his. A review that is not answers NOT_FOUND
 * rather than FORBIDDEN — the same rule the usage service follows — because a
 * 403 would confirm the review exists and turn the endpoint into an oracle.
 *
 * And a reply is a RIGHT OF RESPONSE, not a thread: one per review, enforced by
 * the UNIQUE index with a guard in front of it, editable by its author, and
 * always subject to moderation before it reaches the directory.
 */
export class HostTradeReviewReplyService extends BaseCrudService<
    HostTradeReviewReply,
    HostTradeReviewReplyModel,
    typeof HostTradeReviewReplyCreateInputSchema,
    typeof HostTradeReviewReplyUpdateInputSchema,
    typeof HostTradeReviewReplyAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'hostTradeReviewReply';
    protected readonly entityName = HostTradeReviewReplyService.ENTITY_NAME;
    public readonly model: HostTradeReviewReplyModel;

    public readonly createSchema = HostTradeReviewReplyCreateInputSchema;
    public readonly updateSchema = HostTradeReviewReplyUpdateInputSchema;
    public readonly searchSchema = HostTradeReviewReplyAdminSearchSchema;
    protected readonly adminSearchSchema = HostTradeReviewReplyAdminSearchSchema;

    private readonly reviewModel: HostTradeReviewModel;
    private readonly hostTradeModel: HostTradeModel;

    constructor(
        ctx: ServiceConfig,
        model?: HostTradeReviewReplyModel,
        reviewModel?: HostTradeReviewModel,
        hostTradeModel?: HostTradeModel
    ) {
        super(ctx, HostTradeReviewReplyService.ENTITY_NAME);
        this.model = model ?? new HostTradeReviewReplyModel();
        this.reviewModel = reviewModel ?? new HostTradeReviewModel();
        this.hostTradeModel = hostTradeModel ?? new HostTradeModel();
    }

    protected override getSearchableColumns(): string[] {
        return ['content'];
    }

    protected getDefaultListRelations() {
        return undefined;
    }

    // --- Permission hooks -------------------------------------------------
    //
    // The generic CRUD surface is ADMIN-ONLY. The provider's own two operations
    // do not come through it: they are `createReply` and `updateReply` below,
    // authorised by ownership. Wiring `_canCreate` to a permission the provider
    // does not hold is therefore correct, not an oversight.

    protected _canCreate(actor: Actor): void {
        checkCanModerateHostTradeReviews(actor);
    }
    protected _canUpdate(actor: Actor): void {
        checkCanModerateHostTradeReviews(actor);
    }
    protected _canPatch(actor: Actor): void {
        checkCanModerateHostTradeReviews(actor);
    }
    protected _canDelete(actor: Actor): void {
        checkCanModerateHostTradeReviews(actor);
    }
    protected _canSoftDelete(actor: Actor): void {
        checkCanModerateHostTradeReviews(actor);
    }
    protected _canHardDelete(actor: Actor): void {
        checkCanModerateHostTradeReviews(actor);
    }
    protected _canRestore(actor: Actor): void {
        checkCanModerateHostTradeReviews(actor);
    }
    protected _canUpdateVisibility(actor: Actor): void {
        checkCanModerateHostTradeReviews(actor);
    }
    protected _canView(actor: Actor): void {
        checkCanViewAllHostTradeReviews(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanViewAllHostTradeReviews(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanViewAllHostTradeReviews(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanViewAllHostTradeReviews(actor);
    }

    protected async _executeSearch(
        params: HostTradeReviewReplyAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<HostTradeReviewReply>> {
        const { items, total } = await this.model.findAll(
            this.buildReplyWhere(params),
            undefined,
            undefined,
            ctx?.tx
        );
        return { items, total };
    }

    protected async _executeCount(
        params: HostTradeReviewReplyAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<CountResponse> {
        const count = await this.model.count(this.buildReplyWhere(params), { tx: ctx?.tx });
        return { count };
    }

    private buildReplyWhere(params: HostTradeReviewReplyAdminSearch): Record<string, unknown> {
        const where: Record<string, unknown> = {};
        if (params.reviewId) where.reviewId = params.reviewId;
        if (params.authorUserId) where.authorUserId = params.authorUserId;
        if (params.moderationState) where.moderationState = params.moderationState;
        return where;
    }

    // --- The provider's two operations ------------------------------------

    /**
     * Answers a review of the actor's own listing (AC-21).
     *
     * The reply is born `PENDING` and this method does not say so: the state
     * comes from the column default, so there is ONE place that decides it.
     * T-027 layers `moderateText()` on top of that same default.
     *
     * @param input - The review being answered and the text.
     * @param actor - The provider's owner account.
     * @param ctx - Optional service context.
     * @returns The created reply, awaiting moderation.
     */
    public async createReply(
        input: { reviewId: string; content: string },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ reply: HostTradeReviewReply }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createReply',
            input: { ...input, actor },
            schema: createReplyInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const review = await this.requireAnswerableReview(
                    validated.reviewId,
                    validatedActor,
                    ctx
                );

                // Defence in depth beside the UNIQUE index on `reviewId`: the
                // index is the real guarantee, this turns the race loser's
                // constraint violation into a meaningful 409.
                const existing = await this.model.findOne({ reviewId: review.id }, ctx?.tx);
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'This review already has a reply'
                    );
                }

                const moderationState = await resolveReplyModerationState(validated.content);

                const reply = await this.model.create(
                    {
                        reviewId: review.id,
                        authorUserId: validatedActor.id,
                        content: validated.content,
                        moderationState,
                        createdById: validatedActor.id,
                        updatedById: validatedActor.id
                    } as unknown as Partial<HostTradeReviewReply>,
                    ctx?.tx
                );

                return { reply: reply as HostTradeReviewReply };
            }
        });
    }

    /**
     * Rewrites the actor's own reply, which returns it to moderation (AC-23).
     *
     * The edited text leaves the directory until an admin clears it again, and
     * the previous decision is WIPED rather than kept. It was made about text
     * that no longer exists: left in place, the queue would show a reply
     * "approved" at a timestamp that refers to something else, and a provider
     * whose earlier version was rejected would keep reading a reason that no
     * longer applies to anything he wrote.
     *
     * @param input - The reply id and its new text.
     * @param actor - The provider's owner account.
     * @param ctx - Optional service context.
     * @returns The updated reply, back in `PENDING`.
     */
    public async updateReply(
        input: { replyId: string; content: string },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ reply: HostTradeReviewReply }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateReply',
            input: { ...input, actor },
            schema: updateReplyInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const reply = await this.model.findById(validated.replyId, ctx?.tx);
                if (!reply || reply.deletedAt) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Reply not found');
                }

                // Ownership is re-derived from the listing rather than trusted
                // from `authorUserId`: the column is frozen at writing time on
                // purpose, so a listing that changed hands would otherwise let
                // its former owner keep editing.
                await this.requireAnswerableReview(reply.reviewId, validatedActor, ctx);

                const updated = await this.model.update(
                    { id: validated.replyId },
                    {
                        content: validated.content,
                        moderationState: ModerationStatusEnum.PENDING,
                        moderatedById: null,
                        moderatedAt: null,
                        moderationReason: null,
                        updatedById: validatedActor.id
                    } as unknown as Partial<HostTradeReviewReply>,
                    ctx?.tx
                );

                return { reply: updated as HostTradeReviewReply };
            }
        });
    }

    // --- Admin moderation (T-028) -----------------------------------------

    /**
     * Approves or rejects a reply.
     *
     * Unlike {@link HostTradeReviewService.moderateReview}, this does NOT
     * re-aggregate the listing: a reply is not counted anywhere. The five
     * denormalised columns aggregate usages and reviews, so recomputing here
     * would be three queries that cannot change a number.
     *
     * This is the queue that actually blocks publication — a PENDING review is
     * already public, a PENDING reply is a provider waiting to be allowed to
     * answer a complaint about him.
     *
     * @param input.id - The reply to moderate.
     * @param input.decision - `APPROVED` or `REJECTED`.
     * @param input.reason - Why. Cleared when absent, so an approval does not
     *   keep the reason that justified a previous rejection.
     * @param input.actor - Must hold `HOST_TRADE_REVIEW_MODERATE`.
     * @param ctx - Optional service context.
     * @returns The moderated reply.
     */
    public async moderateReply(
        input: {
            readonly id: string;
            readonly decision: ModerationStatusEnum.APPROVED | ModerationStatusEnum.REJECTED;
            readonly reason?: string;
            readonly actor: Actor;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ reply: HostTradeReviewReply }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'moderateReply',
            input,
            schema: moderateReplyInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                checkCanModerateHostTradeReviews(validatedActor);

                const existing = await this.model.findById(validated.id, ctx?.tx);
                if (!existing || existing.deletedAt) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Reply not found: ${validated.id}`
                    );
                }

                const updated = await this.model.update(
                    { id: validated.id },
                    {
                        moderationState: validated.decision,
                        moderatedById: validatedActor.id,
                        moderatedAt: new Date(),
                        moderationReason: validated.reason ?? null
                    } as unknown as Partial<HostTradeReviewReply>,
                    ctx?.tx
                );

                return { reply: updated as HostTradeReviewReply };
            }
        });
    }

    /**
     * How many replies are waiting for a human, for the admin badge.
     *
     * The badge must read this AND
     * {@link HostTradeReviewService.getPendingCount} — a badge that counted
     * only reviews would hide the one queue whose backlog keeps providers
     * silenced.
     *
     * @param input.actor - Must hold `HOST_TRADE_REVIEW_MODERATE`.
     * @param ctx - Optional service context.
     */
    public async getPendingCount(
        input: { readonly actor: Actor },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<CountResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPendingCount',
            input,
            schema: z.object({}),
            ctx,
            execute: async (_validated, validatedActor) => {
                checkCanModerateHostTradeReviews(validatedActor);
                const count = await this.model.count(
                    { moderationState: ModerationStatusEnum.PENDING, deletedAt: null },
                    { tx: ctx?.tx }
                );
                return { count };
            }
        });
    }

    /**
     * Loads a review the actor is entitled to answer, or throws NOT_FOUND.
     *
     * Every refusal on this path is NOT_FOUND — missing review, deleted review,
     * missing listing, somebody else's listing — so none of them can be told
     * apart from outside.
     */
    private async requireAnswerableReview(
        reviewId: string,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<HostTradeReview> {
        const notFound = () => new ServiceError(ServiceErrorCode.NOT_FOUND, 'Review not found');

        const review = await this.reviewModel.findById(reviewId, ctx?.tx);
        if (!review || review.deletedAt) {
            throw notFound();
        }

        const provider = await this.hostTradeModel.findById(review.hostTradeId, ctx?.tx);
        if (!provider || provider.deletedAt) {
            throw notFound();
        }
        if (!provider.ownerUserId || provider.ownerUserId !== actor.id) {
            throw notFound();
        }

        return review as HostTradeReview;
    }
}
