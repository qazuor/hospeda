import { UserBookmarkModel, userBookmarks } from '@repo/db';
import type { UserBookmark } from '@repo/schemas';
import {
    PermissionEnum,
    ServiceErrorCode,
    type UserBookmarkCountByEntityInput,
    UserBookmarkCountByEntityInputSchema,
    type UserBookmarkCountByUserInput,
    UserBookmarkCountByUserInputSchema,
    type UserBookmarkCreateInput,
    UserBookmarkCreateInputSchema,
    type UserBookmarkListByEntityInput,
    UserBookmarkListByEntityInputSchema,
    type UserBookmarkSearchInput,
    UserBookmarkSearchSchema,
    UserBookmarkUpdateInputSchema,
    type UserBookmarkUpdateNotesInput,
    UserBookmarkUpdateNotesSchema
} from '@repo/schemas';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import {
    type UserBookmarkWithEntityInfo,
    enrichBookmarksWithEntityInfo
} from './userBookmark.enrichment';
import { normalizeCreateInput, normalizeUpdateInput } from './userBookmark.normalizers';
import {
    canAccessBookmark,
    canCreateBookmark,
    checkCanAdminList
} from './userBookmark.permissions';

/**
 * Service for managing user bookmarks (favorites).
 * Implements business logic, permissions, and hooks for UserBookmark entities.
 * @extends BaseCrudService
 */
export class UserBookmarkService extends BaseCrudService<
    UserBookmark,
    UserBookmarkModel,
    typeof UserBookmarkCreateInputSchema,
    typeof UserBookmarkUpdateInputSchema,
    typeof UserBookmarkSearchSchema
> {
    static readonly ENTITY_NAME = 'userBookmark';
    protected readonly entityName = UserBookmarkService.ENTITY_NAME;
    protected readonly model: UserBookmarkModel;

    protected readonly createSchema = UserBookmarkCreateInputSchema;
    protected readonly updateSchema = UserBookmarkUpdateInputSchema;
    protected readonly searchSchema = UserBookmarkSearchSchema;

    protected getDefaultListRelations() {
        return { user: true };
    }
    protected normalizers: CrudNormalizersFromSchemas<
        typeof UserBookmarkCreateInputSchema,
        typeof UserBookmarkUpdateInputSchema,
        typeof UserBookmarkSearchSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceConfig, model?: UserBookmarkModel) {
        super(ctx, UserBookmarkService.ENTITY_NAME);
        this.model = model ?? new UserBookmarkModel();
    }

    /**
     * Only the owner (with USER_BOOKMARK_CREATE permission) can create bookmarks for themselves.
     */
    protected _canCreate(actor: Actor, data: UserBookmarkCreateInput): void {
        if (actor && typeof actor.id === 'string') {
            canCreateBookmark(actor, data.userId);
        } else {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'userId is required to create a bookmark (from actor)'
            );
        }
    }

    /**
     * Only the owner or an actor with appropriate admin permission can update/delete/view the bookmark.
     */
    protected _canUpdate(actor: Actor, entity: UserBookmark): void {
        canAccessBookmark(actor, entity);
    }
    protected _canDelete(actor: Actor, entity: UserBookmark): void {
        canAccessBookmark(actor, entity);
    }
    protected _canView(actor: Actor, entity: UserBookmark): void {
        canAccessBookmark(actor, entity);
    }
    protected _canList(actor: Actor): void {
        if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    }
    protected _canSearch(actor: Actor): void {
        this._canList(actor);
    }
    protected _canCount(actor: Actor): void {
        this._canList(actor);
    }
    protected _canSoftDelete(actor: Actor, entity: UserBookmark): void {
        canAccessBookmark(actor, entity);
    }
    protected _canHardDelete(actor: Actor, entity: UserBookmark): void {
        canAccessBookmark(actor, entity);
    }
    protected _canRestore(actor: Actor, entity: UserBookmark): void {
        canAccessBookmark(actor, entity);
    }

    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks USER_BOOKMARK_VIEW_ANY.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    protected _canUpdateVisibility(
        actor: Actor,
        entity: UserBookmark,
        _newVisibility: unknown
    ): void {
        canAccessBookmark(actor, entity);
    }

    /**
     * Returns true if the actor has the USER_BOOKMARK_VIEW_ANY permission,
     * which grants admin-level read access to any user's bookmarks.
     *
     * @param actor - The actor to check
     * @returns `true` if the actor has the view-any permission
     */
    private _hasViewAnyPermission(actor: Actor): boolean {
        return actor.permissions?.includes(PermissionEnum.USER_BOOKMARK_VIEW_ANY) === true;
    }

    /** Schema for findExistingBookmark input validation */
    private static readonly FindExistingBookmarkSchema = z.object({
        userId: z.string().uuid(),
        entityId: z.string().uuid(),
        entityType: z.string().min(1)
    });

    /**
     * Find an existing bookmark by userId, entityId, and entityType.
     * Returns the bookmark if found, null otherwise.
     * @param actor - The actor performing the action
     * @param params - The params containing userId, entityId, and entityType
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async findExistingBookmark(
        actor: Actor,
        params: {
            readonly userId: string;
            readonly entityId: string;
            readonly entityType: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserBookmark | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findExistingBookmark',
            input: { ...params, actor },
            schema: UserBookmarkService.FindExistingBookmarkSchema,
            ctx,
            execute: async (validated) => {
                if (actor.id !== validated.userId && !this._hasViewAnyPermission(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: Only owner can check bookmarks'
                    );
                }
                const result = await this.model.findOne({
                    userId: validated.userId,
                    entityId: validated.entityId,
                    entityType: validated.entityType,
                    deletedAt: null
                });
                return result;
            }
        });
    }

    /** Schema for checkBookmarksBulk input validation */
    private static readonly CheckBookmarksBulkSchema = z.object({
        userId: z.string().uuid(),
        entityType: z.string().min(1),
        entityIds: z.array(z.string().uuid()).min(1).max(100)
    });

    /**
     * Bulk-check whether a list of entities is bookmarked by a user.
     * Returns a record keyed by entityId mapping to `{ isBookmarked, bookmarkId }`.
     * Issues a single SQL query using `entityId IN (...)` for performance.
     *
     * @param actor - The actor performing the action (must own the bookmarks
     * or have USER_BOOKMARK_VIEW_ANY)
     * @param params - The userId, entityType, and entityIds to check
     * @param ctx - Optional service context carrying transaction and hookState
     */
    public async checkBookmarksBulk(
        actor: Actor,
        params: {
            readonly userId: string;
            readonly entityType: string;
            readonly entityIds: readonly string[];
        },
        ctx?: ServiceContext
    ): Promise<
        ServiceOutput<{
            checks: Record<string, { isBookmarked: boolean; bookmarkId: string | null }>;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'checkBookmarksBulk',
            input: { ...params, actor },
            schema: UserBookmarkService.CheckBookmarksBulkSchema,
            ctx,
            execute: async (validated) => {
                if (actor.id !== validated.userId && !this._hasViewAnyPermission(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: Only owner can check bookmarks'
                    );
                }

                const { items } = await this.model.findAll(
                    {
                        userId: validated.userId,
                        entityType: validated.entityType,
                        deletedAt: null
                    },
                    { page: 1, pageSize: validated.entityIds.length },
                    [inArray(userBookmarks.entityId, [...validated.entityIds])],
                    ctx?.tx
                );

                const checks: Record<string, { isBookmarked: boolean; bookmarkId: string | null }> =
                    {};

                for (const id of validated.entityIds) {
                    checks[id] = { isBookmarked: false, bookmarkId: null };
                }
                for (const bookmark of items) {
                    checks[bookmark.entityId] = {
                        isBookmarked: true,
                        bookmarkId: bookmark.id
                    };
                }

                return { checks };
            }
        });
    }

    /**
     * Lists all bookmarks for a given user.
     * Accessible by the owner or any actor with USER_BOOKMARK_VIEW_ANY permission.
     * @param actor - The actor performing the action
     * @param params - The search parameters
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async listBookmarksByUser(
        actor: Actor,
        params: UserBookmarkSearchInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ bookmarks: UserBookmarkWithEntityInfo[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listBookmarksByUser',
            input: { ...params, actor },
            schema: UserBookmarkSearchSchema,
            ctx,
            execute: async (validated) => {
                if (actor.id !== validated.userId && !this._hasViewAnyPermission(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: Only owner can list bookmarks'
                    );
                }
                const { page, pageSize } = validated;
                const filter: Record<string, unknown> = {
                    userId: validated.userId,
                    deletedAt: null
                };
                if (validated.entityType) {
                    filter.entityType = validated.entityType;
                }
                const { items, total } = await this.model.findAll(filter, { page, pageSize });
                const enriched = await enrichBookmarksWithEntityInfo(items, ctx?.tx);
                return { bookmarks: enriched, total };
            }
        });
    }

    /**
     * Lists bookmarks for a given entity.
     * If the actor has USER_BOOKMARK_VIEW_ANY permission, returns all bookmarks.
     * Otherwise, returns only the actor's own bookmarks for that entity.
     * @param actor - The actor performing the action
     * @param params - The params containing entityId and entityType
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async listBookmarksByEntity(
        actor: Actor,
        params: UserBookmarkListByEntityInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ bookmarks: UserBookmark[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listBookmarksByEntity',
            input: { ...params, actor },
            schema: UserBookmarkListByEntityInputSchema,
            ctx,
            execute: async (validated) => {
                await this._canList(actor);
                const { page, pageSize } = validated;
                const filter: Record<string, unknown> = {
                    entityId: validated.entityId,
                    entityType: validated.entityType,
                    deletedAt: null
                };
                // If the actor lacks VIEW_ANY, restrict to their own bookmarks only
                if (!this._hasViewAnyPermission(actor)) {
                    filter.userId = actor.id;
                }
                const { items } = await this.model.findAll(filter, { page, pageSize });
                return { bookmarks: items };
            }
        });
    }

    /**
     * Counts how many users have bookmarked a given entity.
     * @param actor - The actor performing the action
     * @param params - The params containing entityId and entityType
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async countBookmarksForEntity(
        actor: Actor,
        params: UserBookmarkCountByEntityInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'countBookmarksForEntity',
            input: { ...params, actor },
            schema: UserBookmarkCountByEntityInputSchema,
            ctx,
            execute: async (validated) => {
                await this._canCount(actor);
                const count = await this.model.count({
                    entityId: validated.entityId,
                    entityType: validated.entityType,
                    deletedAt: null
                });
                return { count };
            }
        });
    }

    /**
     * Counts how many bookmarks a user has.
     * Accessible by the owner or any actor with USER_BOOKMARK_VIEW_ANY permission.
     * @param actor - The actor performing the action
     * @param params - The params containing the userId
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async countBookmarksForUser(
        actor: Actor,
        params: UserBookmarkCountByUserInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'countBookmarksForUser',
            input: { ...params, actor },
            schema: UserBookmarkCountByUserInputSchema,
            ctx,
            execute: async (validated) => {
                if (actor.id !== validated.userId && !this._hasViewAnyPermission(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: Only owner can count bookmarks'
                    );
                }
                const count = await this.model.count({ userId: validated.userId, deletedAt: null });
                return { count };
            }
        });
    }

    /** Combined schema for updateBookmark input validation */
    private static readonly UpdateBookmarkSchema = z.object({
        bookmarkId: z.string().uuid(),
        input: UserBookmarkUpdateNotesSchema
    });

    /**
     * Updates the user-editable note fields (`name` and/or `description`) on a bookmark.
     *
     * Permission rules:
     * - The actor must own the bookmark (actor.id === bookmark.userId), OR
     * - The actor must hold USER_BOOKMARK_VIEW_ANY (admin override).
     *
     * @param actor - The actor performing the action
     * @param params - bookmarkId and the partial notes input
     * @param ctx - Optional service context carrying transaction and hookState
     * @returns The updated UserBookmark entity
     */
    public async updateBookmark(
        actor: Actor,
        params: {
            readonly bookmarkId: string;
            readonly input: UserBookmarkUpdateNotesInput;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserBookmark>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateBookmark',
            input: { bookmarkId: params.bookmarkId, input: params.input, actor },
            schema: UserBookmarkService.UpdateBookmarkSchema,
            ctx,
            execute: async (validated) => {
                // Fetch the existing bookmark (must exist and not be soft-deleted)
                const existing = await this.model.findById(validated.bookmarkId, ctx?.tx);
                if (!existing || existing.deletedAt !== null) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Bookmark ${validated.bookmarkId} not found`
                    );
                }

                // Permission check: owner or admin with VIEW_ANY
                canAccessBookmark(actor, existing);

                // Persist the note field changes
                const updated = await this.model.update(
                    { id: validated.bookmarkId },
                    {
                        ...(validated.input.name !== undefined
                            ? { name: validated.input.name }
                            : {}),
                        ...(validated.input.description !== undefined
                            ? { description: validated.input.description }
                            : {}),
                        updatedById: actor.id
                    },
                    ctx?.tx
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Bookmark ${validated.bookmarkId} not found after update`
                    );
                }

                return updated;
            }
        });
    }

    protected async _executeSearch(
        params: UserBookmarkSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page, pageSize, ...searchFilters } = params;

        const { items, total } = await this.model.findAll(
            { ...searchFilters, deletedAt: null },
            { page, pageSize }
        );
        return { items, total };
    }

    protected async _executeCount(
        params: UserBookmarkSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page, pageSize, sortBy, sortOrder, ...searchFilters } = params;

        const count = await this.model.count({ ...searchFilters, deletedAt: null });
        return { count };
    }
}
