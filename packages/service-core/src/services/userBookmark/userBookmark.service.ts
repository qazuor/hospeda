import { UserBookmarkModel } from '@repo/db';
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
    UserBookmarkUpdateInputSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './userBookmark.normalizers';
import { canAccessBookmark, canCreateBookmark } from './userBookmark.permissions';

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
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceContext, model?: UserBookmarkModel) {
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
     */
    public async findExistingBookmark(
        actor: Actor,
        params: {
            readonly userId: string;
            readonly entityId: string;
            readonly entityType: string;
        }
    ): Promise<ServiceOutput<UserBookmark | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findExistingBookmark',
            input: { ...params, actor },
            schema: UserBookmarkService.FindExistingBookmarkSchema,
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

    /**
     * Lists all bookmarks for a given user.
     * Accessible by the owner or any actor with USER_BOOKMARK_VIEW_ANY permission.
     */
    public async listBookmarksByUser(
        actor: Actor,
        params: UserBookmarkSearchInput
    ): Promise<ServiceOutput<{ bookmarks: UserBookmark[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listBookmarksByUser',
            input: { ...params, actor },
            schema: UserBookmarkSearchSchema,
            execute: async (validated) => {
                if (actor.id !== validated.userId && !this._hasViewAnyPermission(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: Only owner can list bookmarks'
                    );
                }
                const { page, pageSize } = validated;
                const { items } = await this.model.findAll(
                    { userId: validated.userId, deletedAt: null },
                    { page, pageSize }
                );
                return { bookmarks: items };
            }
        });
    }

    /**
     * Lists bookmarks for a given entity.
     * If the actor has USER_BOOKMARK_VIEW_ANY permission, returns all bookmarks.
     * Otherwise, returns only the actor's own bookmarks for that entity.
     */
    public async listBookmarksByEntity(
        actor: Actor,
        params: UserBookmarkListByEntityInput
    ): Promise<ServiceOutput<{ bookmarks: UserBookmark[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listBookmarksByEntity',
            input: { ...params, actor },
            schema: UserBookmarkListByEntityInputSchema,
            execute: async (validated) => {
                this._canList(actor);
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
     */
    public async countBookmarksForEntity(
        actor: Actor,
        params: UserBookmarkCountByEntityInput
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'countBookmarksForEntity',
            input: { ...params, actor },
            schema: UserBookmarkCountByEntityInputSchema,
            execute: async (validated) => {
                this._canCount(actor);
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
     */
    public async countBookmarksForUser(
        actor: Actor,
        params: UserBookmarkCountByUserInput
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'countBookmarksForUser',
            input: { ...params, actor },
            schema: UserBookmarkCountByUserInputSchema,
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

    protected async _executeSearch(params: UserBookmarkSearchInput, _actor: Actor) {
        const { page, pageSize, ...searchFilters } = params;

        const { items, total } = await this.model.findAll(
            { ...searchFilters, deletedAt: null },
            { page, pageSize }
        );
        return { items, total };
    }

    protected async _executeCount(params: UserBookmarkSearchInput, _actor: Actor) {
        const { page, pageSize, sortBy, sortOrder, ...searchFilters } = params;

        const count = await this.model.count({ ...searchFilters, deletedAt: null });
        return { count };
    }
}
