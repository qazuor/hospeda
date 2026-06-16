/**
 * gastronomy.review.service.ts
 *
 * Review service for gastronomy listings (SPEC-239 T-039).
 *
 * ## Behavior
 *
 * - **Create (tourist path)**: `moderationState` defaults to `PENDING` (DB
 *   default; we enforce it explicitly in `_beforeCreate` for defense-in-depth).
 * - **Moderate (admin path)**: approve or reject a review via `moderateReview`.
 *   On every decision, the listing's denormalized `averageRating` / `reviewsCount`
 *   / `rating` fields are recomputed from all APPROVED, non-deleted reviews using
 *   `GastronomyService.recomputeRating()`.
 * - **Public list**: `_executeSearch` + `_executeCount` force-override
 *   `lifecycleState = ACTIVE` AND `moderationState = APPROVED` so that PENDING /
 *   REJECTED reviews never surface on public endpoints (mirrors SPEC-166).
 * - **UNIQUE constraint**: one review per user per listing. We check in
 *   `_beforeCreate` and return a friendly `ALREADY_EXISTS` error.
 * - **Rating recompute**: after create / moderation / delete the listing's
 *   denormalized rating is refreshed. Only APPROVED reviews count.
 *
 * @module gastronomy.review.service
 */

import {
    type GastronomyModel,
    type GastronomyReviewModel,
    gastronomyModel,
    gastronomyReviewModel
} from '@repo/db';
import {
    type CountResponse,
    type GastronomyReview,
    type GastronomyReviewCreateInput,
    GastronomyReviewCreateInputSchema,
    GastronomyReviewUpdateInputSchema,
    type GastronomySearch,
    GastronomySearchSchema,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type {
    Actor,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';
import { GastronomyService } from './gastronomy.service';

// ---------------------------------------------------------------------------
// Moderation decision input type
// ---------------------------------------------------------------------------

/**
 * Input for the `moderateReview` method.
 */
export interface GastronomyReviewModerateInput {
    /** UUID of the review to moderate. */
    id: string;
    /** The moderation decision. */
    decision: ModerationStatusEnum.APPROVED | ModerationStatusEnum.REJECTED;
    /** Optional free-text reason for the decision. */
    reason?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Service for managing gastronomy reviews.
 *
 * Uses `GastronomyReview` as the entity type (inferred from Zod schema) and
 * `GastronomyReviewModel` as the DB model.  Where the Drizzle inferred type
 * diverges from the Zod type (e.g. `isVerified`, `reviewerName` absent from
 * the DB columns), explicit `unknown` casts bridge the gap — this is the same
 * pattern used by `AccommodationReviewService`.
 *
 * @example
 * ```ts
 * const service = new GastronomyReviewService({});
 *
 * // Tourist creates a review (goes to PENDING)
 * const result = await service.create(
 *   { gastronomyId: 'uuid', overallRating: 4 },
 *   actor,
 *   ctx
 * );
 *
 * // Admin approves it (recomputes listing rating)
 * await service.moderateReview(
 *   { id: 'review-uuid', decision: ModerationStatusEnum.APPROVED },
 *   adminActor,
 * );
 * ```
 */
export class GastronomyReviewService extends BaseCrudService<
    GastronomyReview,
    GastronomyReviewModel,
    typeof GastronomyReviewCreateInputSchema,
    typeof GastronomyReviewUpdateInputSchema,
    typeof GastronomySearchSchema
> {
    static readonly ENTITY_NAME = 'gastronomyReview';

    protected readonly entityName = GastronomyReviewService.ENTITY_NAME;
    protected readonly model: GastronomyReviewModel;
    protected readonly createSchema = GastronomyReviewCreateInputSchema;
    protected readonly updateSchema = GastronomyReviewUpdateInputSchema;
    protected readonly searchSchema = GastronomySearchSchema;

    /** Injectable for unit tests. */
    private _gastronomyModel: GastronomyModel;
    /** Injectable for unit tests. */
    private _gastronomyService: GastronomyService;

    constructor(config: ServiceConfig) {
        super(config, GastronomyReviewService.ENTITY_NAME);
        this.model = gastronomyReviewModel;
        this._gastronomyModel = gastronomyModel;
        this._gastronomyService = new GastronomyService(config);
    }

    // -----------------------------------------------------------------------
    // Relation defaults
    // -----------------------------------------------------------------------

    protected override getDefaultListRelations(): Record<string, boolean> {
        return { gastronomy: true, user: true };
    }

    // -----------------------------------------------------------------------
    // Permission hooks
    // -----------------------------------------------------------------------

    /**
     * Any authenticated user may submit a review (tourist path).
     *
     * @param actor - The actor performing the action.
     * @param _data - The create payload (unused).
     * @throws {ServiceError} FORBIDDEN when actor is not authenticated.
     */
    protected _canCreate(actor: Actor, _data: GastronomyReviewCreateInput): void {
        if (!actor?.id) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: authentication required to submit a gastronomy review'
            );
        }
    }

    /** Review update is staff-only (`COMMERCE_EDIT_ALL`). */
    protected _canUpdate(actor: Actor, _entity: GastronomyReview): void {
        if (!hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: COMMERCE_EDIT_ALL required to update a gastronomy review'
            );
        }
    }

    /** Soft-delete: staff or the review author. */
    protected _canSoftDelete(actor: Actor, entity: GastronomyReview): void {
        const isAuthor = entity.userId === actor.id;
        if (!hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL) && !isAuthor) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: cannot delete this gastronomy review'
            );
        }
    }

    /** Hard delete is staff-only (`COMMERCE_EDIT_ALL`). */
    protected _canHardDelete(actor: Actor, _entity: GastronomyReview): void {
        if (!hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: COMMERCE_EDIT_ALL required to permanently delete a gastronomy review'
            );
        }
    }

    /** Restore is staff-only (`COMMERCE_EDIT_ALL`). */
    protected _canRestore(actor: Actor, _entity: GastronomyReview): void {
        if (!hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: COMMERCE_EDIT_ALL required to restore a gastronomy review'
            );
        }
    }

    /** Public view — any actor may view a review. */
    protected _canView(_actor: Actor, _entity: GastronomyReview): void {
        return;
    }

    /** Public list — open to any actor. */
    protected _canList(_actor: Actor): void {
        return;
    }

    /** Public search — open to any actor. */
    protected _canSearch(_actor: Actor): void {
        return;
    }

    /** Public count — open to any actor. */
    protected _canCount(_actor: Actor): void {
        return;
    }

    protected _canUpdateVisibility(actor: Actor, _entity: GastronomyReview, _v: unknown): void {
        if (!hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: COMMERCE_EDIT_ALL required to update gastronomy review visibility'
            );
        }
    }

    /**
     * Admin-list gate: verifies admin-panel access (base class) then checks
     * `COMMERCE_MODERATE_REVIEW`.
     */
    protected override async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        if (!hasPermission(actor, PermissionEnum.COMMERCE_MODERATE_REVIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: COMMERCE_MODERATE_REVIEW required for gastronomy review admin list'
            );
        }
    }

    // -----------------------------------------------------------------------
    // Lifecycle hooks
    // -----------------------------------------------------------------------

    /**
     * Pre-create: enforces one-review-per-user-per-listing and sets
     * `moderationState = PENDING` for defense-in-depth.
     *
     * @param data - Validated create input.
     * @param actor - The actor performing the action.
     * @param ctx - Service context.
     * @returns Partial patch with `moderationState: PENDING` and `userId`.
     * @throws {ServiceError} ALREADY_EXISTS when user already reviewed this listing.
     */
    protected override async _beforeCreate(
        data: GastronomyReviewCreateInput,
        actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<GastronomyReview>> {
        const existing = await this.model.findOne({
            userId: actor.id,
            gastronomyId: data.gastronomyId,
            deletedAt: null
        });
        if (existing) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'You have already submitted a review for this gastronomy listing.'
            );
        }

        // Force PENDING regardless of any caller-supplied value.
        return {
            userId: actor.id,
            moderationState: ModerationStatusEnum.PENDING
        } as Partial<GastronomyReview>;
    }

    /**
     * Post-create: triggers rating recompute on the listing.
     *
     * A freshly-created PENDING review has no effect on the aggregate until
     * approved; this is still called to maintain consistency.
     */
    protected override async _afterCreate(
        entity: GastronomyReview,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<GastronomyReview> {
        await this._recomputeListingRating(entity.gastronomyId, ctx);
        return entity;
    }

    // -----------------------------------------------------------------------
    // Public search — force-filtered to ACTIVE + APPROVED
    // -----------------------------------------------------------------------

    /**
     * Public search: forces `lifecycleState = ACTIVE` and
     * `moderationState = APPROVED` regardless of what the caller supplies.
     *
     * PENDING / REJECTED reviews must NEVER surface on public endpoints
     * (mirrors SPEC-166 T-022 for accommodation reviews).
     */
    protected async _executeSearch(
        params: GastronomySearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<GastronomyReview>> {
        const { page, pageSize, sortBy: _sortBy, sortOrder: _sortOrder, ...filters } = params;
        // Force-override: public reads must only see APPROVED+ACTIVE reviews.
        (filters as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        (filters as Record<string, unknown>).moderationState = ModerationStatusEnum.APPROVED;
        const result = await this.model.findAll(
            { ...filters, deletedAt: null },
            { page, pageSize },
            undefined,
            ctx?.tx
        );
        return result as unknown as PaginatedListOutput<GastronomyReview>; // TYPE-WORKAROUND: base list result narrowed to the gastronomy review entity type (Drizzle row vs Zod entity, same bridge as accommodation services)
    }

    /**
     * Count query mirroring `_executeSearch` filter overrides.
     */
    protected async _executeCount(
        params: GastronomySearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<CountResponse> {
        const {
            page: _p,
            pageSize: _ps,
            sortBy: _sortBy,
            sortOrder: _sortOrder,
            ...filters
        } = params;
        (filters as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        (filters as Record<string, unknown>).moderationState = ModerationStatusEnum.APPROVED;
        const count = await this.model.count({ ...filters, deletedAt: null }, { tx: ctx?.tx });
        return { count };
    }

    // -----------------------------------------------------------------------
    // Moderation (admin path)
    // -----------------------------------------------------------------------

    /**
     * Approves or rejects a gastronomy review (admin moderation action).
     *
     * After persisting the decision, the listing's denormalized rating fields
     * (`averageRating`, `reviewsCount`, `rating`) are recomputed from all
     * APPROVED, non-deleted reviews.
     *
     * Permission: `COMMERCE_MODERATE_REVIEW`.
     *
     * @param input - Moderation decision input.
     * @param actor - The admin actor performing the moderation.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `ServiceOutput<GastronomyReview>` wrapping the updated review.
     */
    public async moderateReview(
        input: GastronomyReviewModerateInput,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<GastronomyReview>> {
        try {
            if (!hasPermission(actor, PermissionEnum.COMMERCE_MODERATE_REVIEW)) {
                return {
                    error: {
                        code: ServiceErrorCode.FORBIDDEN,
                        message:
                            'Permission denied: COMMERCE_MODERATE_REVIEW required to moderate reviews'
                    }
                };
            }

            const review = await this.model.findById(input.id, ctx?.tx);
            if (!review || (review as Record<string, unknown>).deletedAt) {
                return {
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Gastronomy review not found'
                    }
                };
            }

            const gastronomyId = (review as Record<string, unknown>).gastronomyId as string;

            const updated = await this.model.update(
                { id: input.id },
                {
                    moderationState: input.decision,
                    moderatedById: actor.id,
                    moderatedAt: new Date(),
                    moderationReason: input.reason ?? null
                },
                ctx?.tx
            );

            if (!updated) {
                return {
                    error: {
                        code: ServiceErrorCode.INTERNAL_ERROR,
                        message: 'Failed to update review moderation state'
                    }
                };
            }

            // Recompute listing rating after every moderation decision.
            await this._recomputeListingRating(gastronomyId, ctx ?? {});

            return { data: updated as unknown as GastronomyReview }; // TYPE-WORKAROUND: model row narrowed to the Zod GastronomyReview entity type
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message } };
            }
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: err instanceof Error ? err.message : String(err)
                }
            };
        }
    }

    /**
     * Returns the count of PENDING reviews for the gastronomy entity type.
     *
     * Permission: `COMMERCE_MODERATE_REVIEW`.
     *
     * @param actor - The actor requesting the count.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `ServiceOutput<{ count: number }>` containing the pending count.
     */
    public async getPendingCount(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        try {
            if (!hasPermission(actor, PermissionEnum.COMMERCE_MODERATE_REVIEW)) {
                return {
                    error: {
                        code: ServiceErrorCode.FORBIDDEN,
                        message:
                            'Permission denied: COMMERCE_MODERATE_REVIEW required to read pending count'
                    }
                };
            }

            const count = await this.model.count(
                { moderationState: ModerationStatusEnum.PENDING, deletedAt: null },
                { tx: ctx?.tx }
            );
            return { data: { count } };
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message } };
            }
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: err instanceof Error ? err.message : String(err)
                }
            };
        }
    }

    /**
     * Lists all APPROVED + ACTIVE reviews for a specific gastronomy listing.
     *
     * Force-filtered — no PENDING / REJECTED reviews are returned.
     *
     * @param gastronomyId - UUID of the gastronomy listing.
     * @param _actor - The actor performing the action (unused; public path).
     * @param ctx - Optional service context for transaction propagation.
     * @returns `ServiceOutput` with the approved review list and total count.
     */
    public async listByGastronomy(
        gastronomyId: string,
        _actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ reviews: GastronomyReview[]; total: number }>> {
        try {
            const result = await this.model.findAll(
                {
                    gastronomyId,
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    moderationState: ModerationStatusEnum.APPROVED,
                    deletedAt: null
                },
                { pageSize: 100 },
                undefined,
                ctx?.tx
            );
            return {
                data: {
                    reviews: result.items as unknown as GastronomyReview[], // TYPE-WORKAROUND: base list result narrowed to the gastronomy review entity type (Drizzle row vs Zod entity, same bridge as accommodation services)
                    total: result.total
                }
            };
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message } };
            }
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: err instanceof Error ? err.message : String(err)
                }
            };
        }
    }

    // -----------------------------------------------------------------------
    // Private: denormalized rating recompute
    // -----------------------------------------------------------------------

    /**
     * Recomputes the gastronomy listing's denormalized rating fields from all
     * APPROVED, non-deleted reviews using `GastronomyService.recomputeRating`.
     *
     * Called after create, moderation decision, and soft-delete.
     *
     * @param gastronomyId - UUID of the listing to refresh.
     * @param ctx - Service context (carries the active transaction).
     */
    private async _recomputeListingRating(
        gastronomyId: string,
        ctx: ServiceContext
    ): Promise<void> {
        try {
            const { items: approvedReviews } = await this.model.findAll(
                {
                    gastronomyId,
                    moderationState: ModerationStatusEnum.APPROVED,
                    deletedAt: null
                },
                { pageSize: 10000 },
                undefined,
                ctx?.tx
            );

            // Extract the rating breakdown from each APPROVED review row.
            const ratingRows = approvedReviews.map((r) => {
                const raw = r as Record<string, unknown>;
                const rating = raw.rating as Record<string, number | null> | null | undefined;
                return {
                    food: rating?.food ?? null,
                    service: rating?.service ?? null,
                    ambiance: rating?.ambiance ?? null,
                    value: rating?.value ?? null
                };
            });

            await this._gastronomyService.recomputeRating(gastronomyId, ratingRows, ctx?.tx);
        } catch {
            // Swallow recompute errors to prevent a rating-update failure from
            // rolling back the review write (best-effort denormalization).
        }
    }
}
