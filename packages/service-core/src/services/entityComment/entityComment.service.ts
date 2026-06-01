import { EntityCommentModel, EventModel, PostModel } from '@repo/db';
import {
    type CountResponse,
    type CreateEntityCommentInput,
    CreateEntityCommentInputSchema,
    type EntityComment,
    type EntityCommentAdminSearch,
    EntityCommentAdminSearchSchema,
    type EntityCommentRecentItem,
    EntityTypeEnum,
    EntityTypeEnumSchema,
    ModerateEntityCommentInputSchema,
    ModerationStatusEnum,
    ModerationStatusEnumSchema,
    PublicCommentThreadQuerySchema,
    RecentCommentsQuerySchema,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import {
    type Actor,
    type AdminSearchExecuteParams,
    type PaginatedListOutput,
    type ServiceConfig,
    type ServiceContext,
    ServiceError,
    type ServiceOutput
} from '../../types';
import { isCountedApprovedPostComment, moderationCounterDelta } from './entityComment.helpers';
import {
    assertCommentEntityType,
    checkCanCreateComment,
    checkCanListComments,
    checkCanListRecentComments,
    checkCanModerateComment,
    checkCanViewComment
} from './entityComment.permissions';
import type { EntityCommentHookState } from './entityComment.types';

/** Service-level input for the public comment thread (path + query combined). */
const ListPublicCommentsInputSchema = PublicCommentThreadQuerySchema.extend({
    entityType: EntityTypeEnumSchema,
    entityId: z.string().uuid()
});

/** Service-level input for a moderation-state change (PATCH body + comment id). */
const ModerateCommentInputSchema = ModerateEntityCommentInputSchema.extend({
    commentId: z.string().uuid()
});

/**
 * Minimal update schema for the comment entity. Comments are NOT content-editable
 * in the MVP (no edit endpoint); the only field the base `update()` pipeline may
 * touch is `moderationState`. The real moderation flow is the custom
 * {@link EntityCommentService.moderate} method (T-007), not `update()`.
 */
const EntityCommentServiceUpdateSchema = z
    .object({ moderationState: ModerationStatusEnumSchema.optional() })
    .strict();

/** A comment row with its (optional) loaded author relation. */
type CommentWithAuthor = EntityComment & {
    author?: { displayName?: string | null } | null;
};

/**
 * Flattens a comment (with its loaded author relation) into the fixed
 * recent-feed item shape (SPEC-165 §5.4, AC-18). Falls back to a deleted-user
 * placeholder when the author is missing, matching the public/admin mappers.
 */
const toRecentItem = (comment: EntityComment): EntityCommentRecentItem => {
    const author = (comment as CommentWithAuthor).author ?? null;
    return {
        id: comment.id,
        entityType: comment.entityType,
        entityId: comment.entityId,
        content: comment.content,
        authorName: author?.displayName ?? '[Usuario eliminado]',
        moderationState: comment.moderationState,
        createdAt: comment.createdAt
    };
};

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
    private readonly eventModel: EventModel;

    protected readonly createSchema = CreateEntityCommentInputSchema;
    protected readonly updateSchema = EntityCommentServiceUpdateSchema;
    protected readonly searchSchema = EntityCommentAdminSearchSchema;

    constructor(
        ctx: ServiceConfig,
        model?: EntityCommentModel,
        postModel?: PostModel,
        eventModel?: EventModel
    ) {
        super(ctx, EntityCommentService.ENTITY_NAME);
        this.model = model ?? new EntityCommentModel();
        this.postModel = postModel ?? new PostModel();
        this.eventModel = eventModel ?? new EventModel();
        this.adminSearchSchema = EntityCommentAdminSearchSchema;
    }

    protected getDefaultListRelations() {
        return { author: true };
    }

    protected getDefaultGetByIdRelations() {
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
    // PUBLIC THREAD
    // ========================================================================

    /**
     * Returns whether the target entity exists and is publicly visible
     * (`visibility === PUBLIC`, not soft-deleted). Used to enforce the 404
     * contract on the public thread endpoint (AC-9). Only POST and EVENT are
     * supported (RD-3).
     */
    private async _isEntityPublished(
        entityType: EntityComment['entityType'],
        entityId: string,
        tx?: ServiceContext['tx']
    ): Promise<boolean> {
        const resolved = assertCommentEntityType(entityType);
        const entity =
            resolved === EntityTypeEnum.POST
                ? await this.postModel.findById(entityId, tx)
                : await this.eventModel.findById(entityId, tx);
        return Boolean(
            entity &&
                !(entity as { deletedAt?: Date | null }).deletedAt &&
                (entity as { visibility?: string }).visibility === VisibilityEnum.PUBLIC
        );
    }

    /**
     * Public comment thread for a post or event (no auth). Returns APPROVED,
     * non-deleted comments ordered oldest-first (natural thread order), paginated.
     * The author relation is loaded so the route can resolve the display name.
     * Responds with NOT_FOUND when the entity does not exist or is not published
     * (AC-9); an existing published entity with zero approved comments yields an
     * empty page, not a 404 (AC-10).
     *
     * @param actor - The (possibly guest) actor from the public middleware.
     * @param input - `{ entityType, entityId, page, pageSize }`.
     * @param ctx - Optional service context.
     */
    public async listPublic(
        actor: Actor,
        input: {
            entityType: EntityComment['entityType'];
            entityId: string;
            page?: number;
            pageSize?: number;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<EntityComment>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listPublic',
            input: { ...input, actor },
            schema: ListPublicCommentsInputSchema,
            ctx,
            execute: async (validated, _validActor, execCtx) => {
                assertCommentEntityType(validated.entityType);
                const published = await this._isEntityPublished(
                    validated.entityType,
                    validated.entityId,
                    execCtx?.tx
                );
                if (!published) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'The requested post or event was not found.'
                    );
                }
                return this.model.findAllWithRelations(
                    { author: true },
                    {
                        entityType: validated.entityType,
                        entityId: validated.entityId,
                        moderationState: ModerationStatusEnum.APPROVED,
                        deletedAt: null
                    },
                    {
                        page: validated.page,
                        pageSize: validated.pageSize,
                        sortBy: 'createdAt',
                        sortOrder: 'asc'
                    },
                    undefined,
                    execCtx?.tx
                );
            }
        });
    }

    // ========================================================================
    // MODERATE — approve / reject (admin tier), with counter sync
    // ========================================================================

    /**
     * Changes a comment's moderation state (APPROVED ↔ REJECTED). Gated by the
     * `_MODERATE` permission resolved from the comment's entity type. For POST
     * comments the `posts.comments` counter is adjusted: +1 when a comment becomes
     * APPROVED, -1 when it leaves APPROVED (AC-19 / AC-20 / AC-25).
     *
     * @param actor - The moderating actor.
     * @param input - `{ commentId, moderationState }` (APPROVED | REJECTED).
     * @param ctx - Optional service context.
     * @returns The updated comment, or a `ServiceError` (NOT_FOUND if missing/deleted).
     */
    public async moderate(
        actor: Actor,
        input: { commentId: string; moderationState: 'APPROVED' | 'REJECTED' },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<EntityComment>> {
        return this.runWithLoggingAndValidation({
            methodName: 'moderate',
            input: { ...input, actor },
            schema: ModerateCommentInputSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                const comment = await this.model.findById(validated.commentId, execCtx?.tx);
                if (!comment || comment.deletedAt) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Comment not found.');
                }
                checkCanModerateComment(validActor, comment.entityType);

                const delta = moderationCounterDelta(
                    comment.moderationState,
                    validated.moderationState
                );

                await this.model.updateById(
                    validated.commentId,
                    { moderationState: validated.moderationState, updatedById: validActor.id },
                    execCtx?.tx
                );

                if (comment.entityType === EntityTypeEnum.POST && delta !== 0) {
                    await this.postModel.adjustCommentCount(
                        { id: comment.entityId, delta },
                        execCtx?.tx
                    );
                }

                const updated = await this.model.findById(validated.commentId, execCtx?.tx);
                if (!updated) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Comment not found.');
                }
                return updated;
            }
        });
    }

    // ========================================================================
    // ADMIN DELETE / RESTORE LIFECYCLE HOOKS — counter sync
    //
    // These hooks back the INHERITED softDelete / hardDelete / restore (admin
    // tier, gated by _MODERATE via the _can* hooks). The author-gated path is the
    // separate softDeleteOwn() above.
    // ========================================================================

    /**
     * Captures the pre-mutation comment snapshot into the hook state under `key`,
     * so the matching `_after*` hook can adjust the counter. Centralises the
     * `hookState` guard shared by all three delete/restore before-hooks.
     */
    private async _snapshotForCounter(
        id: string,
        key: keyof EntityCommentHookState,
        ctx: ServiceContext<EntityCommentHookState>
    ): Promise<void> {
        const comment = await this.model.findById(id, ctx?.tx);
        if (ctx.hookState) {
            ctx.hookState[key] = comment ?? undefined;
        }
    }

    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<EntityCommentHookState>
    ): Promise<string> {
        await this._snapshotForCounter(id, 'softDeletedComment', ctx);
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<EntityCommentHookState>
    ): Promise<{ count: number }> {
        const comment = ctx.hookState?.softDeletedComment;
        if (comment && isCountedApprovedPostComment(comment)) {
            await this.postModel.adjustCommentCount({ id: comment.entityId, delta: -1 }, ctx?.tx);
        }
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<EntityCommentHookState>
    ): Promise<string> {
        await this._snapshotForCounter(id, 'hardDeletedComment', ctx);
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<EntityCommentHookState>
    ): Promise<{ count: number }> {
        const comment = ctx.hookState?.hardDeletedComment;
        if (comment && isCountedApprovedPostComment(comment)) {
            await this.postModel.adjustCommentCount({ id: comment.entityId, delta: -1 }, ctx?.tx);
        }
        return result;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<EntityCommentHookState>
    ): Promise<string> {
        await this._snapshotForCounter(id, 'restoredComment', ctx);
        return id;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<EntityCommentHookState>
    ): Promise<{ count: number }> {
        // The captured snapshot is the pre-restore (soft-deleted) row; once restored
        // it becomes visible again, so an APPROVED post comment re-enters the count.
        const comment = ctx.hookState?.restoredComment;
        if (
            comment &&
            comment.entityType === EntityTypeEnum.POST &&
            comment.moderationState === ModerationStatusEnum.APPROVED
        ) {
            await this.postModel.adjustCommentCount({ id: comment.entityId, delta: 1 }, ctx?.tx);
        }
        return result;
    }

    // ========================================================================
    // SEARCH / COUNT — admin list backing
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

    // ========================================================================
    // RECENT FEED — cross-entity flat list of the newest comments (AC-18)
    // ========================================================================

    /**
     * Returns the most recent comments across POST and EVENT entities as a flat,
     * fixed-shape list ordered by `createdAt` DESC and capped at `pageSize`
     * (default 10, max 50 — no deeper pagination). All moderation states are
     * included; soft-deleted comments are excluded (SPEC-165 §5.4, AC-18).
     *
     * Gated by {@link checkCanListRecentComments}: the actor must hold BOTH
     * `POST_COMMENT_VIEW` and `EVENT_COMMENT_VIEW` (defense in depth — the admin
     * route also enforces this via `requiredPermissions`).
     *
     * @param actor - The requesting actor.
     * @param input - `{ pageSize? }` (coerced/capped by `RecentCommentsQuerySchema`).
     * @param ctx - Optional service context.
     * @returns A flat list of recent-feed items.
     */
    public async listRecent(
        actor: Actor,
        input: { pageSize?: number },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<EntityCommentRecentItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listRecent',
            input: { ...input, actor },
            schema: RecentCommentsQuerySchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                checkCanListRecentComments(validActor);
                const result = await this.model.findAllWithRelations(
                    { author: true },
                    { deletedAt: null },
                    {
                        page: 1,
                        pageSize: validated.pageSize,
                        sortBy: 'createdAt',
                        sortOrder: 'desc'
                    },
                    undefined,
                    execCtx?.tx
                );
                return result.items.map(toRecentItem);
            }
        });
    }

    /**
     * Override of the base admin-search executor (AC-17).
     *
     * The base `adminList` injects `where.lifecycleState = status` for any
     * `?status` other than the default `'all'`, but `entity_comments` has no
     * `lifecycleState` column. Drop that key here before delegating so a stray
     * status filter can never produce an invalid WHERE clause. Everything else
     * (author relation loading, pagination, search) is preserved by `super`.
     */
    protected async _executeAdminSearch(
        params: AdminSearchExecuteParams
    ): Promise<PaginatedListOutput<EntityComment>> {
        const { lifecycleState: _lifecycleState, ...where } = params.where;
        return super._executeAdminSearch({ ...params, where });
    }
}
