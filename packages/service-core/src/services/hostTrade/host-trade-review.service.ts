import { moderateText } from '@repo/content-moderation';
import {
    HostTradeBenefitUsageModel,
    HostTradeModel,
    HostTradeReviewModel,
    HostTradeReviewReplyModel
} from '@repo/db';
import type {
    CountResponse,
    HostTradeReview,
    HostTradeReviewAdminSearch,
    HostTradeReviewReply
} from '@repo/schemas';
import {
    HostTradeReviewAdminSearchSchema,
    HostTradeReviewCreateInputSchema,
    HostTradeReviewUpdateInputSchema,
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
import { withServiceTransaction } from '../../utils/transaction';
import { getThresholdForContext } from '../contentModeration/get-threshold-for-context';
import { resolveInitialModerationState } from '../moderation/review-moderation.helpers';
import { recalculateHostTradeAggregates } from './host-trade-aggregates';
import {
    checkCanCreateHostTradeReview,
    checkCanModerateHostTradeReviews,
    checkCanViewAllHostTradeReviews
} from './host-trade-review.permissions';

/**
 * State passed from a `_before*` hook to its `_after*` counterpart.
 *
 * An instance field would be shared across concurrent requests on the same
 * service instance; `ctx.hookState` is scoped to one invocation.
 */
interface HostTradeReviewHookState extends Record<string, unknown> {
    /** The listing whose counters must be recomputed once the row is gone. */
    affectedHostTradeId?: string;
}

/** Input for {@link HostTradeReviewService.createReview}. */
const createReviewInputSchema = z.object({
    hostTradeId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    overallRating: z.number().int().min(1).max(5),
    rating: z
        .object({
            workQuality: z.number().int().min(1).max(5).optional(),
            punctuality: z.number().int().min(1).max(5).optional(),
            treatment: z.number().int().min(1).max(5).optional()
        })
        .nullish(),
    respectedBenefit: z.boolean(),
    content: z.string().min(10).max(2000).nullish()
});

/**
 * Input for {@link HostTradeReviewService.updateReview}.
 *
 * The same four fields the host authored, all optional: an absent key means
 * "leave it alone", which is what makes a star-only edit distinguishable from a
 * rewrite. `content` is nullish rather than optional because dropping the text
 * altogether is a legitimate edit and has to be told apart from not touching it.
 */
const updateReviewInputSchema = z.object({
    reviewId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    overallRating: z.number().int().min(1).max(5).optional(),
    rating: z
        .object({
            workQuality: z.number().int().min(1).max(5).optional(),
            punctuality: z.number().int().min(1).max(5).optional(),
            treatment: z.number().int().min(1).max(5).optional()
        })
        .nullish(),
    respectedBenefit: z.boolean().optional(),
    content: z.string().min(10).max(2000).nullish()
});

/**
 * Input for {@link HostTradeReviewService.getMyReview}.
 *
 * The provider and nothing else. `hostUserId` is deliberately absent: the
 * review being read back is the actor's, so a field for it here would be a
 * field a client could fill in with somebody else's id — the same reasoning as
 * the usage inbox's input schema.
 */
const getMyReviewInputSchema = z.object({
    hostTradeId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** Input for {@link HostTradeReviewService.moderateReview}. */
const moderateReviewInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    decision: z.enum([ModerationStatusEnum.APPROVED, ModerationStatusEnum.REJECTED]),
    reason: z.string().max(1000).optional()
});

/**
 * Service for host-trade reviews (HOS-376 §6.3).
 *
 * Its centre is the eligibility chain in {@link createReview}. Everything else
 * about this domain — the public averages, the provider's right of reply, the
 * moderation queue — is downstream of a review existing, so this is the one
 * place where getting the order of refusals right matters.
 */
export class HostTradeReviewService extends BaseCrudService<
    HostTradeReview,
    HostTradeReviewModel,
    typeof HostTradeReviewCreateInputSchema,
    typeof HostTradeReviewUpdateInputSchema,
    typeof HostTradeReviewAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'hostTradeReview';
    protected readonly entityName = HostTradeReviewService.ENTITY_NAME;
    public readonly model: HostTradeReviewModel;

    public readonly createSchema = HostTradeReviewCreateInputSchema;
    public readonly updateSchema = HostTradeReviewUpdateInputSchema;
    public readonly searchSchema = HostTradeReviewAdminSearchSchema;
    protected readonly adminSearchSchema = HostTradeReviewAdminSearchSchema;

    private readonly hostTradeModel: HostTradeModel;
    private readonly usageModel: HostTradeBenefitUsageModel;
    private readonly replyModel: HostTradeReviewReplyModel;

    constructor(
        ctx: ServiceConfig,
        model?: HostTradeReviewModel,
        hostTradeModel?: HostTradeModel,
        usageModel?: HostTradeBenefitUsageModel,
        replyModel?: HostTradeReviewReplyModel
    ) {
        super(ctx, HostTradeReviewService.ENTITY_NAME);
        this.model = model ?? new HostTradeReviewModel();
        this.hostTradeModel = hostTradeModel ?? new HostTradeModel();
        this.usageModel = usageModel ?? new HostTradeBenefitUsageModel();
        this.replyModel = replyModel ?? new HostTradeReviewReplyModel();
    }

    protected override getSearchableColumns(): string[] {
        return ['content'];
    }

    protected getDefaultListRelations() {
        return undefined;
    }

    // --- Permission hooks -------------------------------------------------

    protected _canCreate(actor: Actor): void {
        checkCanCreateHostTradeReview(actor);
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
        params: HostTradeReviewAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<HostTradeReview>> {
        const { items, total } = await this.model.findAll(
            this.buildReviewWhere(params),
            undefined,
            undefined,
            ctx?.tx
        );
        return { items, total };
    }

    protected async _executeCount(
        params: HostTradeReviewAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<CountResponse> {
        const count = await this.model.count(this.buildReviewWhere(params), { tx: ctx?.tx });
        return { count };
    }

    private buildReviewWhere(params: HostTradeReviewAdminSearch): Record<string, unknown> {
        const where: Record<string, unknown> = {};
        if (params.hostTradeId) where.hostTradeId = params.hostTradeId;
        if (params.hostUserId) where.hostUserId = params.hostUserId;
        if (params.moderationState) where.moderationState = params.moderationState;
        if (typeof params.respectedBenefit === 'boolean') {
            where.respectedBenefit = params.respectedBenefit;
        }
        return where;
    }

    // --- Aggregate upkeep (T-023) -----------------------------------------
    //
    // Every path that can change what the public card shows recomputes the
    // listing's counters. The delete hooks come in pairs because the row is
    // gone by the time the `_after` runs, so the parent listing has to be
    // captured on the way in.

    protected async _afterCreate(
        entity: HostTradeReview,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<HostTradeReview> {
        await recalculateHostTradeAggregates({ hostTradeId: entity.hostTradeId, tx: ctx?.tx });
        return entity;
    }

    protected async _afterUpdate(
        entity: HostTradeReview,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<HostTradeReview> {
        await recalculateHostTradeAggregates({ hostTradeId: entity.hostTradeId, tx: ctx?.tx });
        return entity;
    }

    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<HostTradeReviewHookState>
    ): Promise<string> {
        await this.rememberParentListing(id, ctx);
        return id;
    }

    protected async _afterSoftDelete(
        result: CountResponse,
        _actor: Actor,
        ctx: ServiceContext<HostTradeReviewHookState>
    ): Promise<CountResponse> {
        await this.recalculateRememberedListing(ctx);
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<HostTradeReviewHookState>
    ): Promise<string> {
        await this.rememberParentListing(id, ctx);
        return id;
    }

    protected async _afterHardDelete(
        result: CountResponse,
        _actor: Actor,
        ctx: ServiceContext<HostTradeReviewHookState>
    ): Promise<CountResponse> {
        await this.recalculateRememberedListing(ctx);
        return result;
    }

    protected async _afterRestore(
        result: CountResponse,
        _actor: Actor,
        ctx: ServiceContext<HostTradeReviewHookState>
    ): Promise<CountResponse> {
        await this.recalculateRememberedListing(ctx);
        return result;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<HostTradeReviewHookState>
    ): Promise<string> {
        await this.rememberParentListing(id, ctx);
        return id;
    }

    /** Captures the parent listing before the row stops being readable. */
    private async rememberParentListing(
        id: string,
        ctx: ServiceContext<HostTradeReviewHookState>
    ): Promise<void> {
        const review = await this.model.findById(id, ctx?.tx);
        if (ctx.hookState) {
            ctx.hookState.affectedHostTradeId = review?.hostTradeId;
        }
    }

    /** Recomputes the listing captured on the way in, if there was one. */
    private async recalculateRememberedListing(
        ctx: ServiceContext<HostTradeReviewHookState>
    ): Promise<void> {
        const hostTradeId = ctx.hookState?.affectedHostTradeId;
        if (hostTradeId) {
            await recalculateHostTradeAggregates({ hostTradeId, tx: ctx?.tx });
        }
    }

    // --- Admin moderation (T-028) -----------------------------------------

    /**
     * Approves or rejects a review, and re-aggregates the listing (AC-27).
     *
     * The decision and the recount are ONE unit of work, which is a deliberate
     * divergence from `AccommodationReviewService.moderateReview`. That one
     * recounts on a best-effort basis because its recalculation is bundled with
     * a cache revalidation that cannot be rolled back. This recount is pure SQL
     * in the same database, so there is nothing to protect: letting it fail
     * quietly would leave a REJECTED review inside the public average, and the
     * only thing worse than a wrong number is a wrong number nobody can see.
     *
     * `lifecycleState` is untouched — moderation and lifecycle are orthogonal.
     *
     * @param input.id - The review to moderate.
     * @param input.decision - `APPROVED` or `REJECTED`.
     * @param input.reason - Why. Cleared when absent, so a re-approval does not
     *   keep the reason that justified a previous rejection.
     * @param input.actor - Must hold `HOST_TRADE_REVIEW_MODERATE`.
     * @param ctx - Optional service context. Its transaction is joined when
     *   present; otherwise one is opened for the pair.
     * @returns The moderated review.
     */
    public async moderateReview(
        input: {
            readonly id: string;
            readonly decision: ModerationStatusEnum.APPROVED | ModerationStatusEnum.REJECTED;
            readonly reason?: string;
            readonly actor: Actor;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ review: HostTradeReview }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'moderateReview',
            input,
            schema: moderateReviewInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                checkCanModerateHostTradeReviews(validatedActor);

                const run = async (execCtx: ServiceContext) => {
                    const existing = await this.model.findById(validated.id, execCtx.tx);
                    if (!existing) {
                        throw new ServiceError(
                            ServiceErrorCode.NOT_FOUND,
                            `Review not found: ${validated.id}`
                        );
                    }

                    const updated = await this.model.update(
                        { id: validated.id },
                        {
                            moderationState: validated.decision,
                            moderatedById: validatedActor.id,
                            moderatedAt: new Date(),
                            moderationReason: validated.reason ?? null
                        } as unknown as Partial<HostTradeReview>,
                        execCtx.tx
                    );

                    await recalculateHostTradeAggregates({
                        hostTradeId: existing.hostTradeId,
                        tx: execCtx.tx
                    });

                    return { review: updated as HostTradeReview };
                };

                return ctx?.tx ? run(ctx) : withServiceTransaction(run);
            }
        });
    }

    /**
     * How many reviews are waiting for a human, for the admin badge.
     *
     * Reviews are born APPROVED, so this queue is a BACKLOG, not a gate: a
     * non-zero count means texts that `moderateText()` flagged are already
     * public and waiting to be looked at. The reply queue is the blocking one —
     * see `HostTradeReviewReplyService.getPendingCount`, which the badge must
     * also read.
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

    // --- Reading your own (T-034) -----------------------------------------

    /**
     * Returns the actor's own review of one provider, or `null`.
     *
     * ABSENCE IS AN ORDINARY STATE, not a failure: most host/provider pairs
     * have no review, and the card that calls this needs to know whether to
     * offer "write one" or "edit yours". A `NOT_FOUND` here would make the
     * common case look like an error to every caller.
     *
     * AUTH-ONLY (§7.5), one step looser than creating: the row is already
     * scoped to the session, so a permission could only decide whether a host
     * may read something he wrote himself — and it would lock out a host whose
     * directory perk lapsed while his review was still published.
     *
     * The scope comes from the SESSION, never from the request. The path
     * carries the provider and the actor carries the host; a `hostUserId`
     * parameter here would be a field a client could fill with someone else's
     * id. There is no session guard of its own — `runWithLoggingAndValidation`
     * runs `validateActor()` before `execute`, so an anonymous call is refused
     * UNAUTHORIZED and never reaches the lookup. A local re-check was written
     * here and removed: mutation testing showed it could not fail.
     *
     * @param input.hostTradeId - The provider whose review is being read back.
     * @param actor - The host. Must be signed in.
     * @param ctx - Optional service context.
     * @returns `{ review }`, `null` when this host has not reviewed them.
     */
    public async getMyReview(
        input: { readonly hostTradeId: string },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ review: HostTradeReview | null }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getMyReview',
            input: { ...input, actor },
            schema: getMyReviewInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const review = await this.model.findOne(
                    {
                        hostTradeId: validated.hostTradeId,
                        hostUserId: validatedActor.id,
                        deletedAt: null
                    },
                    ctx?.tx
                );

                return { review: (review as HostTradeReview) ?? null };
            }
        });
    }

    // --- Creation ---------------------------------------------------------

    /**
     * Creates a review, after the four eligibility gates of spec §6.3.
     *
     * THE ORDER IS DELIBERATE and is not the order §6.3 lists them in — the spec
     * enumerates the gates, it does not prescribe which refusal wins when
     * several apply. They run most-permanent first:
     *
     * 1. `HOST_TRADE_REVIEW_CREATE` — may this account review anything at all?
     * 2. the provider exists and is still listed (`PROVIDER_REVOKED`)
     * 3. it is not the actor's own listing (`SELF_REVIEW_FORBIDDEN`)
     * 4. the actor has not already reviewed it (`REVIEW_ALREADY_EXISTS`)
     * 5. a `CONFIRMED` usage exists for the pair (`NO_CONFIRMED_USAGE`)
     *
     * Self-review before confirmed-usage matters in practice: both refuse the
     * owner of a listing, but `NO_CONFIRMED_USAGE` reads as "go get a confirmed
     * usage and come back", which would send him after something that still
     * would not let him review his own listing. The permanent refusal wins.
     *
     * @param input - The provider id plus the review body.
     * @param actor - The host writing it.
     * @param ctx - Optional service context.
     * @returns The created review.
     */
    public async createReview(
        input: {
            hostTradeId: string;
            overallRating: number;
            rating?: Record<string, number> | null;
            respectedBenefit: boolean;
            content?: string | null;
        },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ review: HostTradeReview }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createReview',
            input: { ...input, actor },
            schema: createReviewInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                // Gate 1 — may this account review at all?
                checkCanCreateHostTradeReview(validatedActor);

                // Gate 2 — does the provider exist and is it still listed?
                const provider = await this.hostTradeModel.findById(validated.hostTradeId, ctx?.tx);
                if (!provider) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Host trade listing not found'
                    );
                }
                if (provider.revokedAt || provider.deletedAt) {
                    throw new ServiceError(
                        ServiceErrorCode.PROVIDER_REVOKED,
                        'This provider is no longer listed'
                    );
                }

                // Gate 3 — not your own listing (AC-17).
                if (provider.ownerUserId && provider.ownerUserId === validatedActor.id) {
                    throw new ServiceError(
                        ServiceErrorCode.SELF_REVIEW_FORBIDDEN,
                        'You cannot review your own listing'
                    );
                }

                // Defence in depth beside the UNIQUE (hostUserId, hostTradeId)
                // index: the index is the real guarantee, this turns the race
                // loser's constraint violation into a meaningful 409.
                const existing = await this.model.findOne(
                    { hostTradeId: validated.hostTradeId, hostUserId: validatedActor.id },
                    ctx?.tx
                );
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.REVIEW_ALREADY_EXISTS,
                        'You already reviewed this provider'
                    );
                }

                // Gate 4 — a confirmed usage for THIS pair. The whole point of
                // the usage machinery: no confirmation, no voice.
                const confirmed = await this.usageModel.findConfirmedPair(
                    validated.hostTradeId,
                    validatedActor.id,
                    ctx?.tx
                );
                if (!confirmed) {
                    throw new ServiceError(
                        ServiceErrorCode.NO_CONFIRMED_USAGE,
                        'A confirmed benefit usage with this provider is required'
                    );
                }

                const moderationState = await resolveReviewModerationState(validated.content);

                const created = await this.model.create(
                    {
                        hostTradeId: validated.hostTradeId,
                        hostUserId: validatedActor.id,
                        overallRating: validated.overallRating,
                        rating: validated.rating ?? null,
                        averageRating: computeBreakdownAverage(validated.rating),
                        respectedBenefit: validated.respectedBenefit,
                        content: validated.content ?? null,
                        moderationState,
                        createdById: validatedActor.id,
                        updatedById: validatedActor.id
                    } as unknown as Partial<HostTradeReview>,
                    ctx?.tx
                );

                // The public card's numbers move the moment an APPROVED review
                // exists, and this path never goes through the base create, so
                // `_afterCreate` would not fire for it.
                await recalculateHostTradeAggregates({
                    hostTradeId: validated.hostTradeId,
                    tx: ctx?.tx
                });

                return { review: created as HostTradeReview };
            }
        });
    }

    // --- Editing (T-026, AC-22) -------------------------------------------

    /**
     * Rewrites the actor's own review, and tells any existing reply about it.
     *
     * A pattern with no precedent in this repo: no other review is editable by
     * its author. Three properties define it.
     *
     * ROW OWNERSHIP, not a permission (§7.5: "auth + ownership"). A review that
     * belongs to somebody else answers NOT_FOUND rather than FORBIDDEN — the
     * rule the whole domain follows, so the endpoint cannot be used to find out
     * which reviews exist.
     *
     * RE-MODERATION IS ABOUT THE TEXT, so it only runs when the text actually
     * changed. Re-running it on a star-only edit would be worse than wasteful:
     * a review a moderator REJECTED would come back APPROVED, and changing one
     * star would become a way of republishing a text a human took down. When
     * the text does change, the previous decision is wiped — it was made about
     * words that no longer exist, the same reasoning as `updateReply`.
     *
     * THE REPLY SURVIVES, marked (AC-22). Every edit marks it, stars included:
     * a reply thanking someone for five stars answers an older version just as
     * much as one answering a deleted paragraph. Deleting the provider's words
     * because the host changed his would be worse than a stale answer — with
     * the marker the directory says so and the provider can rewrite it.
     *
     * @param input - The review id plus whichever of the four authored fields
     *   the host is changing. An absent key means "no change".
     * @param actor - Must be the review's author.
     * @param ctx - Optional service context. Its transaction is joined when
     *   present; otherwise one is opened for the edit, the marker and the
     *   recount together.
     * @returns The edited review.
     */
    public async updateReview(
        input: {
            readonly reviewId: string;
            readonly overallRating?: number;
            readonly rating?: Record<string, number> | null;
            readonly respectedBenefit?: boolean;
            readonly content?: string | null;
        },
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ review: HostTradeReview }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateReview',
            input: { ...input, actor },
            schema: updateReviewInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const run = async (execCtx: ServiceContext) => {
                    const existing = await this.model.findById(validated.reviewId, execCtx.tx);
                    if (
                        !existing ||
                        existing.deletedAt ||
                        existing.hostUserId !== validatedActor.id
                    ) {
                        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Review not found');
                    }

                    const patch: Record<string, unknown> = {
                        editedAt: new Date(),
                        updatedById: validatedActor.id
                    };

                    if (validated.overallRating !== undefined) {
                        patch.overallRating = validated.overallRating;
                    }
                    if (validated.respectedBenefit !== undefined) {
                        patch.respectedBenefit = validated.respectedBenefit;
                    }
                    if (validated.rating !== undefined) {
                        patch.rating = validated.rating ?? null;
                        patch.averageRating = computeBreakdownAverage(validated.rating);
                    }

                    const newContent = validated.content ?? null;
                    if (
                        validated.content !== undefined &&
                        newContent !== (existing.content ?? null)
                    ) {
                        patch.content = newContent;
                        patch.moderationState = await resolveReviewModerationState(newContent);
                        patch.moderatedById = null;
                        patch.moderatedAt = null;
                        patch.moderationReason = null;
                    }

                    const updated = await this.model.update(
                        { id: validated.reviewId },
                        patch as unknown as Partial<HostTradeReview>,
                        execCtx.tx
                    );

                    await this.markReplyAsAnsweringAnOlderReview(validated.reviewId, execCtx);

                    // The public average moves with the stars, and with a text
                    // that re-moderation just pulled out of APPROVED. This path
                    // never goes through the base update, so `_afterUpdate`
                    // would not fire for it.
                    await recalculateHostTradeAggregates({
                        hostTradeId: existing.hostTradeId,
                        tx: execCtx.tx
                    });

                    return { review: updated as HostTradeReview };
                };

                return ctx?.tx ? run(ctx) : withServiceTransaction(run);
            }
        });
    }

    /**
     * Raises `reviewEditedAfterReply` on the review's reply, if it has a live
     * one that is not already marked.
     *
     * The re-read of the flag is not an optimisation: writing `true` over
     * `true` would move the reply's `updatedAt` on every subsequent edit, and
     * the provider's dashboard reads that timestamp as "when I last wrote".
     */
    private async markReplyAsAnsweringAnOlderReview(
        reviewId: string,
        ctx: ServiceContext
    ): Promise<void> {
        const reply = await this.replyModel.findOne({ reviewId }, ctx.tx);
        if (!reply || reply.deletedAt || reply.reviewEditedAfterReply) {
            return;
        }

        await this.replyModel.update(
            { id: reply.id },
            { reviewEditedAfterReply: true } as unknown as Partial<HostTradeReviewReply>,
            ctx.tx
        );
    }
}

/**
 * The state a new review is born in (spec §6.4, AC-19).
 *
 * `APPROVED` by default, on stronger evidence than the accommodation case: not
 * a conversation that happened, but a usage the counterpart CONFIRMED. Content
 * moderation overrides that — a text scoring at or above the threshold is held
 * for a human whatever the default says.
 *
 * The body is optional (§6.3), so most reviews are stars and a boolean with
 * nothing to moderate. Those skip the engine entirely rather than paying a
 * round trip to score an empty string.
 */
async function resolveReviewModerationState(content: string | null | undefined) {
    const [moderationResult, thresholds] = await Promise.all([
        content
            ? moderateText({ text: content, context: 'review' })
            : Promise.resolve({ score: 0 }),
        getThresholdForContext({ context: 'review' })
    ]);

    return resolveInitialModerationState({
        entityType: 'hostTrade',
        verificationLevel: 'none',
        moderationScore: moderationResult.score,
        pendingThreshold: thresholds.pending
    });
}

/**
 * Mean of the supplied breakdown dimensions, or null when there is no
 * breakdown (AC-20).
 *
 * Null rather than falling back to `overallRating`: the two answer different
 * questions, and a derived average that silently mirrors the overall score
 * would make "this host filled in the breakdown" indistinguishable from "this
 * host skipped it".
 */
function computeBreakdownAverage(rating: Record<string, number> | null | undefined): number | null {
    if (!rating) return null;
    const values = Object.values(rating).filter((value) => typeof value === 'number');
    if (values.length === 0) return null;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.round(mean * 100) / 100;
}
