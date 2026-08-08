import { moderateText } from '@repo/content-moderation';
import { HostTradeBenefitUsageModel, HostTradeModel, HostTradeReviewModel } from '@repo/db';
import type { CountResponse, HostTradeReview, HostTradeReviewAdminSearch } from '@repo/schemas';
import {
    HostTradeReviewAdminSearchSchema,
    HostTradeReviewCreateInputSchema,
    HostTradeReviewUpdateInputSchema,
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
    checkCanCreateHostTradeReview,
    checkCanModerateHostTradeReviews,
    checkCanViewAllHostTradeReviews
} from './host-trade-review.permissions';

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

    constructor(
        ctx: ServiceConfig,
        model?: HostTradeReviewModel,
        hostTradeModel?: HostTradeModel,
        usageModel?: HostTradeBenefitUsageModel
    ) {
        super(ctx, HostTradeReviewService.ENTITY_NAME);
        this.model = model ?? new HostTradeReviewModel();
        this.hostTradeModel = hostTradeModel ?? new HostTradeModel();
        this.usageModel = usageModel ?? new HostTradeBenefitUsageModel();
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

                const review = await this.model.create(
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

                return { review: review as HostTradeReview };
            }
        });
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
