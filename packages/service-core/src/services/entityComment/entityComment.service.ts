import { EntityCommentModel, PostModel } from '@repo/db';
import {
    type CountResponse,
    type CreateEntityCommentInput,
    CreateEntityCommentInputSchema,
    type EntityComment,
    type EntityCommentAdminSearch,
    EntityCommentAdminSearchSchema,
    EntityTypeEnum,
    ModerationStatusEnum,
    ModerationStatusEnumSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import {
    type Actor,
    type PaginatedListOutput,
    type ServiceConfig,
    type ServiceContext,
    ServiceError,
    type ServiceOutput
} from '../../types';
import {
    checkCanCreateComment,
    checkCanListComments,
    checkCanModerateComment,
    checkCanViewComment
} from './entityComment.permissions';

/**
 * Minimal update schema for the comment entity. Comments are NOT content-editable
 * in the MVP (no edit endpoint); the only field the base `update()` pipeline may
 * touch is `moderationState`. The real moderation flow is the custom
 * {@link EntityCommentService.moderate} method (T-007), not `update()`.
 */
const EntityCommentServiceUpdateSchema = z
    .object({ moderationState: ModerationStatusEnumSchema.optional() })
    .strict();

/**
 * Service for polymorphic post/event comments (SPEC-165).
 *
 * Comments are published immediately (moderationState defaults to APPROVED, RD-4)
 * and restricted to POST and EVENT entities at the service layer (RD-3). The
 * `posts.comments` integer counter is kept in sync with ±1 adjustments on the
 * write paths (create / delete / moderate / restore); events have no counter
 * (RD-7, AC-24, AC-25, AC-26).
 *
 * Delete has two distinct paths:
 * - {@link softDeleteOwn}: a registered user deleting their OWN comment (author
 *   check, gated by ownership not a permission — protected tier).
 * - the inherited `softDelete`: an editor/admin deleting ANY comment (gated by
 *   the `_MODERATE` permission via {@link _canSoftDelete} — admin tier, wired in T-007).
 */
export class EntityCommentService extends BaseCrudService<
    EntityComment,
    EntityCommentModel,
    typeof CreateEntityCommentInputSchema,
    typeof EntityCommentServiceUpdateSchema,
    typeof EntityCommentAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'entityComment';
    protected readonly entityName = EntityCommentService.ENTITY_NAME;
    protected readonly model: EntityCommentModel;
    private readonly postModel: PostModel;

    protected readonly createSchema = CreateEntityCommentInputSchema;
    protected readonly updateSchema = EntityCommentServiceUpdateSchema;
    protected readonly searchSchema = EntityCommentAdminSearchSchema;

    constructor(ctx: ServiceConfig, model?: EntityCommentModel, postModel?: PostModel) {
        super(ctx, EntityCommentService.ENTITY_NAME);
        this.model = model ?? new EntityCommentModel();
        this.postModel = postModel ?? new PostModel();
        this.adminSearchSchema = EntityCommentAdminSearchSchema;
    }

    protected getDefaultListRelations() {
        return { author: true };
    }

    /**
     * Columns matched by the admin free-text `search` param. Comments are searched
     * by their body content.
     */
    protected override getSearchableColumns(): string[] {
        return ['content'];
    }

    // ========================================================================
    // PERMISSION HOOKS — every permission is resolved from the comment's entityType
    // ========================================================================

    protected _canCreate(actor: Actor, data: CreateEntityCommentInput): void {
        // Validates the entityType allowlist (AC-3) AND the _CREATE permission (RD-9).
        checkCanCreateComment(actor, data.entityType);
    }
    protected _canUpdate(actor: Actor, entity: EntityComment): void {
        checkCanModerateComment(actor, entity.entityType);
    }
    protected _canSoftDelete(actor: Actor, entity: EntityComment): void {
        checkCanModerateComment(actor, entity.entityType);
    }
    protected _canHardDelete(actor: Actor, entity: EntityComment): void {
        checkCanModerateComment(actor, entity.entityType);
    }
    protected _canRestore(actor: Actor, entity: EntityComment): void {
        checkCanModerateComment(actor, entity.entityType);
    }
    protected _canView(actor: Actor, entity: EntityComment): void {
        checkCanViewComment(actor, entity.entityType);
    }
    protected _canList(actor: Actor): void {
        checkCanListComments(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanListComments(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanListComments(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        entity: EntityComment,
        _newVisibility: unknown
    ): void {
        // Comments have no visibility state; treat any attempt as a moderation action.
        checkCanModerateComment(actor, entity.entityType);
    }

    // ========================================================================
    // CREATE — inject author + APPROVED state, then bump the post counter
    // ========================================================================

    /**
     * Injects the server-controlled fields the create input deliberately omits:
     * the author (from the actor) and the default moderation state (APPROVED —
     * publish-immediately, RD-4).
     */
    protected async _beforeCreate(
        data: CreateEntityCommentInput,
        actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<EntityComment>> {
        return {
            ...data,
            authorId: actor.id,
            moderationState: ModerationStatusEnum.APPROVED
        };
    }

    /**
     * After a comment is created, increment `posts.comments` by 1 when the target
     * is a post. Events have no counter (AC-26). The comment is APPROVED on create,
     * so it always counts.
     */
    protected async _afterCreate(
        entity: EntityComment,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<EntityComment> {
        if (entity.entityType === EntityTypeEnum.POST) {
            await this.postModel.adjustCommentCount({ id: entity.entityId, delta: 1 }, ctx?.tx);
        }
        return entity;
    }

    // ========================================================================
    // SOFT-DELETE OWN — author-gated delete (protected tier)
    // ========================================================================

    /**
     * Soft-deletes a comment on behalf of its author. Unlike the inherited
     * `softDelete` (admin/editor, gated by the `_MODERATE` permission), this path
     * is gated by ownership: only the comment's author may call it (AC-15/AC-16).
     *
     * When the deleted comment was an APPROVED post comment, `posts.comments` is
     * decremented by 1.
     *
     * @param actor - The authenticated user.
     * @param input - `{ commentId }`.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ id }` of the soft-deleted comment, or a `ServiceError`
     *   (NOT_FOUND if missing/already deleted, FORBIDDEN if not the author).
     */
    public async softDeleteOwn(
        actor: Actor,
        input: { commentId: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ id: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'softDeleteOwn',
            input: { ...input, actor },
            schema: z.object({ commentId: z.string().uuid() }),
            ctx,
            execute: async (validated, validActor, execCtx) => {
                const comment = await this.model.findById(validated.commentId, execCtx?.tx);
                if (!comment || comment.deletedAt) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Comment not found.');
                }
                if (comment.authorId !== validActor.id) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: only the author may delete their own comment.'
                    );
                }

                const wasApprovedPost =
                    comment.entityType === EntityTypeEnum.POST &&
                    comment.moderationState === ModerationStatusEnum.APPROVED;

                await this.model.softDelete({ id: validated.commentId }, execCtx?.tx);
                await this.model.updateById(
                    validated.commentId,
                    { deletedById: validActor.id },
                    execCtx?.tx
                );

                if (wasApprovedPost) {
                    await this.postModel.adjustCommentCount(
                        { id: comment.entityId, delta: -1 },
                        execCtx?.tx
                    );
                }

                return { id: validated.commentId };
            }
        });
    }

    // ========================================================================
    // COUNTER RECONCILIATION
    // ========================================================================

    /**
     * Recomputes the authoritative number of APPROVED, non-deleted comments for a
     * post via `COUNT`. This is the reconciliation primitive (NOT the hot path —
     * live writes use ±1 adjustments so legacy baseline counts are preserved,
     * AC-24/AC-25). Exposed for a future reconciliation job (SPEC-165 §10).
     *
     * @param actor - The actor performing the action (must hold a comment view permission).
     * @param input - `{ postId }`.
     * @param ctx - Optional service context.
     * @returns `{ count }` of APPROVED non-deleted post comments.
     */
    public async countApprovedByPostId(
        actor: Actor,
        input: { postId: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<CountResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'countApprovedByPostId',
            input: { ...input, actor },
            schema: z.object({ postId: z.string().uuid() }),
            ctx,
            execute: async (validated, validActor, execCtx) => {
                this._canCount(validActor);
                const count = await this.model.countApprovedByPostId({
                    postId: validated.postId,
                    tx: execCtx?.tx
                });
                return { count };
            }
        });
    }

    // ========================================================================
    // SEARCH / COUNT — admin list backing (filters refined in T-007)
    // ========================================================================

    /**
     * Builds the where clause for admin search/count from the entity-specific
     * filter fields only. Transport-layer keys (page, pageSize, sort, search,
     * status, date range) are intentionally excluded so they never leak into the
     * model where-clause builder.
     */
    private _buildAdminWhere(params: EntityCommentAdminSearch): Record<string, unknown> {
        const where: Record<string, unknown> = {};
        if (params.entityType) where.entityType = params.entityType;
        if (params.entityId) where.entityId = params.entityId;
        if (params.authorId) where.authorId = params.authorId;
        if (params.moderationState) where.moderationState = params.moderationState;
        if (!params.includeDeleted) where.deletedAt = null;
        return where;
    }

    protected async _executeSearch(
        params: EntityCommentAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<EntityComment>> {
        const { page, pageSize } = params;
        return this.model.findAll(
            this._buildAdminWhere(params),
            { page, pageSize },
            undefined,
            ctx?.tx
        );
    }

    protected async _executeCount(
        params: EntityCommentAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<CountResponse> {
        const count = await this.model.count(this._buildAdminWhere(params), { tx: ctx?.tx });
        return { count };
    }
}
