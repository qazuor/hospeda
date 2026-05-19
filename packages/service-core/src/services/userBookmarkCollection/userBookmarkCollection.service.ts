import {
    UserBookmarkCollectionModel,
    UserBookmarkModel,
    and,
    count,
    eq,
    getDb,
    isNull,
    userBookmarks
} from '@repo/db';
import type { UserBookmark, UserBookmarkCollection } from '@repo/schemas';
import {
    PermissionEnum,
    ServiceErrorCode,
    type UserBookmarkCollectionCreateInput,
    UserBookmarkCollectionCreateInputSchema,
    type UserBookmarkCollectionSearchInput,
    UserBookmarkCollectionSearchSchema,
    UserBookmarkCollectionUpdateInputSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { withServiceTransaction } from '../../utils/transaction';
import {
    type UserBookmarkWithEntityInfo,
    enrichBookmarksWithEntityInfo
} from '../userBookmark/userBookmark.enrichment';
import { normalizeCreateInput, normalizeUpdateInput } from './userBookmarkCollection.normalizers';
import {
    canAccessCollection,
    canCreateCollection,
    checkCanAdminList,
    hasViewAnyPermission
} from './userBookmarkCollection.permissions';

/**
 * Default maximum number of active bookmark collections per user.
 * Can be overridden via the `HOSPEDA_MAX_COLLECTIONS_PER_USER` environment variable.
 */
const DEFAULT_MAX_COLLECTIONS_PER_USER = 10;

/**
 * Reads the per-user collection limit from the environment.
 * Falls back to {@link DEFAULT_MAX_COLLECTIONS_PER_USER} when the variable is
 * absent or not a valid integer.
 *
 * @returns The maximum number of active bookmark collections allowed per user.
 */
export function getMaxCollectionsPerUser(): number {
    const raw = process.env.HOSPEDA_MAX_COLLECTIONS_PER_USER;
    if (raw === undefined || raw === '') return DEFAULT_MAX_COLLECTIONS_PER_USER;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) || parsed < 1 ? DEFAULT_MAX_COLLECTIONS_PER_USER : parsed;
}

/**
 * Service for managing user bookmark collections (wishlists).
 *
 * Implements business logic, permissions, and hooks for
 * {@link UserBookmarkCollection} entities. Collections are owner-scoped: only
 * the owning user may create, update, or delete their own collections unless
 * the actor carries the `USER_BOOKMARK_COLLECTION_VIEW_ANY` permission.
 *
 * A per-user quota (`HOSPEDA_MAX_COLLECTIONS_PER_USER`, default 10) is
 * enforced inside {@link _canCreate}.
 *
 * @extends BaseCrudService
 */
export class UserBookmarkCollectionService extends BaseCrudService<
    UserBookmarkCollection,
    UserBookmarkCollectionModel,
    typeof UserBookmarkCollectionCreateInputSchema,
    typeof UserBookmarkCollectionUpdateInputSchema,
    typeof UserBookmarkCollectionSearchSchema
> {
    static readonly ENTITY_NAME = 'userBookmarkCollection';
    protected readonly entityName = UserBookmarkCollectionService.ENTITY_NAME;
    protected readonly model: UserBookmarkCollectionModel;

    protected readonly createSchema = UserBookmarkCollectionCreateInputSchema;
    protected readonly updateSchema = UserBookmarkCollectionUpdateInputSchema;
    protected readonly searchSchema = UserBookmarkCollectionSearchSchema;

    protected getDefaultListRelations() {
        return { user: true };
    }

    protected normalizers: CrudNormalizersFromSchemas<
        typeof UserBookmarkCollectionCreateInputSchema,
        typeof UserBookmarkCollectionUpdateInputSchema,
        typeof UserBookmarkCollectionSearchSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceConfig, model?: UserBookmarkCollectionModel) {
        super(ctx, UserBookmarkCollectionService.ENTITY_NAME);
        this.model = model ?? new UserBookmarkCollectionModel();
    }

    /**
     * Only the owner with `USER_BOOKMARK_COLLECTION_CREATE` permission may
     * create a collection for themselves.
     *
     * Additionally enforces the per-user quota: if the actor already owns
     * {@link getMaxCollectionsPerUser} or more active collections, the
     * operation is rejected with {@link ServiceErrorCode.QUOTA_EXCEEDED} and
     * a payload containing `currentCount` and `maxAllowed`.
     *
     * @param actor - The actor attempting the create
     * @param data - The validated create input
     * @param ctx - Optional service context (transaction propagation)
     * @throws {ServiceError} FORBIDDEN – actor is not the owner or lacks permission
     * @throws {ServiceError} QUOTA_EXCEEDED – actor has reached the collection limit
     */
    protected async _canCreate(
        actor: Actor,
        data: UserBookmarkCollectionCreateInput,
        ctx?: ServiceContext
    ): Promise<void> {
        if (!actor || typeof actor.id !== 'string') {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'userId is required to create a collection (from actor)'
            );
        }

        canCreateCollection(actor, data.userId);

        // Enforce per-user quota
        const maxAllowed = getMaxCollectionsPerUser();
        const currentCount = await this.model.countActiveByUserId(data.userId, ctx?.tx);

        if (currentCount >= maxAllowed) {
            throw new ServiceError(
                ServiceErrorCode.QUOTA_EXCEEDED,
                `Collection limit reached: users may not have more than ${maxAllowed} active collections`,
                { currentCount, maxAllowed }
            );
        }
    }

    /**
     * Only the owner or an actor with `USER_BOOKMARK_COLLECTION_VIEW_ANY`
     * permission may update a collection.
     *
     * @param actor - The actor attempting the update
     * @param entity - The existing collection entity
     */
    protected _canUpdate(actor: Actor, entity: UserBookmarkCollection): void {
        canAccessCollection(actor, entity);
    }

    /**
     * Only the owner or an actor with `USER_BOOKMARK_COLLECTION_VIEW_ANY`
     * permission may delete a collection.
     *
     * @param actor - The actor attempting the delete
     * @param entity - The existing collection entity
     */
    protected _canDelete(actor: Actor, entity: UserBookmarkCollection): void {
        canAccessCollection(actor, entity);
    }

    /**
     * Only the owner or an actor with `USER_BOOKMARK_COLLECTION_VIEW_ANY`
     * permission may view a collection.
     *
     * @param actor - The actor attempting to view
     * @param entity - The existing collection entity
     */
    protected _canView(actor: Actor, entity: UserBookmarkCollection): void {
        canAccessCollection(actor, entity);
    }

    /**
     * Listing collections requires an authenticated actor.
     *
     * @param actor - The actor attempting the list
     * @throws {ServiceError} FORBIDDEN – if actor is missing
     */
    protected _canList(actor: Actor): void {
        if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    }

    /**
     * Searching collections requires an authenticated actor.
     *
     * @param actor - The actor attempting the search
     */
    protected _canSearch(actor: Actor): void {
        this._canList(actor);
    }

    /**
     * Counting collections requires an authenticated actor.
     *
     * @param actor - The actor attempting the count
     */
    protected _canCount(actor: Actor): void {
        this._canList(actor);
    }

    /**
     * Soft-deleting a collection requires ownership or `USER_BOOKMARK_COLLECTION_VIEW_ANY`.
     *
     * @param actor - The actor attempting the soft delete
     * @param entity - The existing collection entity
     */
    protected _canSoftDelete(actor: Actor, entity: UserBookmarkCollection): void {
        canAccessCollection(actor, entity);
    }

    /**
     * Hard-deleting a collection requires ownership or `USER_BOOKMARK_COLLECTION_VIEW_ANY`.
     *
     * @param actor - The actor attempting the hard delete
     * @param entity - The existing collection entity
     */
    protected _canHardDelete(actor: Actor, entity: UserBookmarkCollection): void {
        canAccessCollection(actor, entity);
    }

    /**
     * Restoring a soft-deleted collection requires ownership or
     * `USER_BOOKMARK_COLLECTION_VIEW_ANY`.
     *
     * @param actor - The actor attempting the restore
     * @param entity - The existing collection entity
     */
    protected _canRestore(actor: Actor, entity: UserBookmarkCollection): void {
        canAccessCollection(actor, entity);
    }

    /**
     * @inheritdoc
     * Verifies base admin access via super, then checks
     * `USER_BOOKMARK_COLLECTION_VIEW_ANY`.
     *
     * @param actor - The actor attempting the admin list
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    /**
     * Updating collection visibility requires ownership or
     * `USER_BOOKMARK_COLLECTION_VIEW_ANY`.
     *
     * @param actor - The actor attempting the visibility update
     * @param entity - The existing collection entity
     * @param _newVisibility - The new visibility value (unused in permission check)
     */
    protected _canUpdateVisibility(
        actor: Actor,
        entity: UserBookmarkCollection,
        _newVisibility: unknown
    ): void {
        canAccessCollection(actor, entity);
    }

    /**
     * Executes the database query for search operations.
     * Filters by all non-pagination fields that are present in `params`.
     *
     * Enforces ownership: if `params.userId` is present and differs from
     * `actor.id`, the actor must hold `USER_BOOKMARK_COLLECTION_VIEW_ANY` or
     * the call is rejected with FORBIDDEN. This prevents cross-tenant data
     * leakage via the generic search/list/count pipeline.
     *
     * @param params - Validated search parameters
     * @param actor - The actor performing the search
     * @param _ctx - Service context (unused — base class handles tx propagation)
     * @throws {ServiceError} FORBIDDEN – if the actor queries another user's collections
     */
    protected async _executeSearch(
        params: UserBookmarkCollectionSearchInput,
        actor: Actor,
        _ctx: ServiceContext
    ) {
        if (
            params.userId !== undefined &&
            params.userId !== actor.id &&
            !this._hasViewAnyPermission(actor)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'FORBIDDEN: Cannot search collections belonging to another user'
            );
        }

        const { page, pageSize, ...searchFilters } = params;

        const { items, total } = await this.model.findAll(
            { ...searchFilters, deletedAt: null },
            { page, pageSize }
        );
        return { items, total };
    }

    /**
     * Executes the database query for count operations.
     * Uses the same filters as search but returns only the count.
     *
     * Enforces ownership: if `params.userId` is present and differs from
     * `actor.id`, the actor must hold `USER_BOOKMARK_COLLECTION_VIEW_ANY` or
     * the call is rejected with FORBIDDEN.
     *
     * @param params - Validated search parameters
     * @param actor - The actor performing the count
     * @param _ctx - Service context (unused — base class handles tx propagation)
     * @throws {ServiceError} FORBIDDEN – if the actor counts another user's collections
     */
    protected async _executeCount(
        params: UserBookmarkCollectionSearchInput,
        actor: Actor,
        _ctx: ServiceContext
    ) {
        if (
            params.userId !== undefined &&
            params.userId !== actor.id &&
            !this._hasViewAnyPermission(actor)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'FORBIDDEN: Cannot count collections belonging to another user'
            );
        }

        const {
            page: _page,
            pageSize: _pageSize,
            sortBy: _sortBy,
            sortOrder: _sortOrder,
            ...searchFilters
        } = params;

        const total = await this.model.count({ ...searchFilters, deletedAt: null });
        return { count: total };
    }

    /**
     * Returns `true` if the actor has the `USER_BOOKMARK_COLLECTION_VIEW_ANY`
     * permission, which grants admin-level read access to any user's collections.
     *
     * @param actor - The actor to check
     * @returns `true` if the actor has the view-any permission
     */
    private _hasViewAnyPermission(actor: Actor): boolean {
        return (
            actor.permissions?.includes(PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY) === true
        );
    }

    // =========================================================================
    // Input validation schemas for custom domain methods
    // =========================================================================

    /** Schema for countActiveCollections input validation */
    private static readonly CountActiveCollectionsSchema = z.object({});

    /** Schema for createCollection input validation */
    private static readonly CreateCollectionSchema = UserBookmarkCollectionCreateInputSchema;

    /** Schema for listCollectionsByUser input validation */
    private static readonly ListCollectionsByUserSchema = z.object({
        userId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(20),
        includeBookmarkCount: z.boolean().optional().default(false)
    });

    /** Schema for getCollectionById input validation */
    private static readonly GetCollectionByIdSchema = z.object({
        collectionId: z.string().uuid(),
        includeBookmarks: z.boolean().optional().default(false),
        bookmarksPage: z.number().int().min(1).default(1),
        bookmarksPageSize: z.number().int().min(1).max(200).default(20),
        // Optional polymorphic filter — when set, only bookmarks of this entity
        // type are returned (and counted). Used by the collection detail page
        // to power the entity type tabs.
        entityType: z
            .enum(['ACCOMMODATION', 'DESTINATION', 'ATTRACTION', 'EVENT', 'POST'])
            .optional()
    });

    /** Schema for updateCollection input validation */
    private static readonly UpdateCollectionSchema = z.object({
        collectionId: z.string().uuid(),
        input: UserBookmarkCollectionUpdateInputSchema
    });

    /** Schema for deleteCollection input validation */
    private static readonly DeleteCollectionSchema = z.object({
        collectionId: z.string().uuid()
    });

    /** Schema for addBookmarkToCollection input validation */
    private static readonly AddBookmarkToCollectionSchema = z.object({
        collectionId: z.string().uuid(),
        bookmarkId: z.string().uuid()
    });

    /** Schema for removeBookmarkFromCollection input validation */
    private static readonly RemoveBookmarkFromCollectionSchema = z.object({
        bookmarkId: z.string().uuid()
    });

    // =========================================================================
    // Custom domain methods
    // =========================================================================

    /**
     * Returns the count of active bookmark collections owned by the actor.
     *
     * Requires an authenticated actor. Uses `countActiveByUserId` model method
     * which counts only non-deleted collections.
     *
     * @param actor - The authenticated actor performing the action
     * @param ctx - Optional service context carrying transaction and hookState
     * @returns `Result<{ count: number }>` — total active collections for the actor
     *
     * @throws {ServiceError} FORBIDDEN – if actor is missing or unauthenticated
     *
     * @example
     * ```ts
     * const result = await service.countActiveCollections(actor);
     * if (result.data) console.log(result.data.count); // e.g. 3
     * ```
     */
    public async countActiveCollections(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'countActiveCollections',
            input: { actor },
            schema: UserBookmarkCollectionService.CountActiveCollectionsSchema,
            ctx,
            execute: async (_validated, validActor, execCtx) => {
                this._canCount(validActor);
                const count = await this.model.countActiveByUserId(validActor.id, execCtx?.tx);
                return { count };
            }
        });
    }

    /**
     * Creates a new bookmark collection for the actor.
     *
     * Enforces:
     * 1. Owner-only creation (`input.userId === actor.id`).
     * 2. Name uniqueness within the actor's active collections (pre-check before DB constraint).
     * 3. Per-user quota enforcement (delegated to `_canCreate` in BaseCrudService).
     * 4. Input normalization (trim, colour uppercase) via `normalizeCreateInput`.
     *
     * @param actor - The authenticated actor performing the action
     * @param input - Validated create payload including `userId` and `name`
     * @param ctx - Optional service context carrying transaction and hookState
     * @returns `Result<UserBookmarkCollection>` — the newly created collection
     *
     * @throws {ServiceError} FORBIDDEN – actor is not the owner or lacks permission
     * @throws {ServiceError} VALIDATION_ERROR – `input.userId !== actor.id`
     * @throws {ServiceError} CONFLICT – collection name already used by the actor
     * @throws {ServiceError} QUOTA_EXCEEDED – actor has reached the per-user limit
     *
     * @example
     * ```ts
     * const result = await service.createCollection(actor, {
     *   userId: actor.id,
     *   name: 'Viaje al Litoral',
     *   color: '#E57373',
     * });
     * ```
     */
    public async createCollection(
        actor: Actor,
        input: UserBookmarkCollectionCreateInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserBookmarkCollection>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createCollection',
            input: { actor, ...input },
            schema: UserBookmarkCollectionService.CreateCollectionSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                // 1. Owner-only constraint
                if (validated.userId !== validActor.id) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'VALIDATION_ERROR: userId must match actor.id'
                    );
                }

                // 2. Pre-check name uniqueness
                const nameTaken = await this.model.existsActiveNameForUser(
                    validActor.id,
                    validated.name,
                    undefined,
                    execCtx?.tx
                );
                if (nameTaken) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        `Collection name "${validated.name}" is already taken`,
                        { name: validated.name },
                        'NAME_TAKEN'
                    );
                }

                // 3. Normalize input
                const normalizedInput = normalizeCreateInput(validated, validActor);

                // 4. Delegate to BaseCrudService.create (which runs _canCreate quota check)
                const result = await this.create(validActor, normalizedInput, execCtx);
                if (result.error) {
                    throw new ServiceError(
                        result.error.code,
                        result.error.message,
                        result.error.details
                    );
                }
                // create() always returns data when no error
                // biome-ignore lint/style/noNonNullAssertion: result.data is guaranteed when result.error is absent
                return result.data!;
            }
        });
    }

    /**
     * Lists paginated bookmark collections belonging to a given user.
     *
     * Access rules:
     * - The actor is the owner (`actor.id === userId`), OR
     * - The actor holds `USER_BOOKMARK_COLLECTION_VIEW_ANY`.
     *
     * When `includeBookmarkCount` is `true`, each row is annotated with the
     * count of active bookmarks it contains using the optimised model query
     * `listActiveByUserWithBookmarkCount`. Otherwise `findActiveByUserId` is
     * used and every row receives `bookmarkCount: 0`.
     *
     * @param actor - The authenticated actor performing the action
     * @param params - Query parameters: `userId`, `page`, `pageSize`, `includeBookmarkCount`
     * @param ctx - Optional service context carrying transaction and hookState
     * @returns Paginated result with `rows`, `total`, `page`, `pageSize`
     *
     * @throws {ServiceError} FORBIDDEN – actor is not the owner and lacks VIEW_ANY permission
     *
     * @example
     * ```ts
     * const result = await service.listCollectionsByUser(actor, {
     *   userId: actor.id,
     *   page: 1,
     *   pageSize: 20,
     *   includeBookmarkCount: true,
     * });
     * ```
     */
    public async listCollectionsByUser(
        actor: Actor,
        params: {
            readonly userId: string;
            readonly page?: number;
            readonly pageSize?: number;
            readonly includeBookmarkCount?: boolean;
        },
        ctx?: ServiceContext
    ): Promise<
        ServiceOutput<{
            rows: Array<UserBookmarkCollection & { bookmarkCount: number }>;
            total: number;
            page: number;
            pageSize: number;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'listCollectionsByUser',
            input: { actor, ...params },
            schema: UserBookmarkCollectionService.ListCollectionsByUserSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                // Permission: owner OR VIEW_ANY
                if (validActor.id !== validated.userId && !hasViewAnyPermission(validActor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: Only owner can list collections'
                    );
                }

                const paginationOptions = {
                    page: validated.page,
                    pageSize: validated.pageSize,
                    includeBookmarkCount: validated.includeBookmarkCount
                };

                const { rows, total } = await this.model.listActiveByUserWithBookmarkCount(
                    validated.userId,
                    paginationOptions,
                    execCtx?.tx
                );

                return {
                    rows,
                    total,
                    page: validated.page,
                    pageSize: validated.pageSize
                };
            }
        });
    }

    /**
     * Retrieves a single bookmark collection by ID, optionally including its bookmarks.
     *
     * Access rules:
     * - The actor is the owner (`collection.userId === actor.id`), OR
     * - The actor holds `USER_BOOKMARK_COLLECTION_VIEW_ANY`.
     *
     * When `includeBookmarks` is `true`, the method fetches all bookmarks belonging
     * to the collection using a direct Drizzle query on `userBookmarks` filtered by
     * `collectionId`. This approach is used because `collectionId` is not part of
     * the `UserBookmark` Zod schema, so the generic `UserBookmarkModel.findAll()`
     * `buildWhereClause` cannot resolve it.
     *
     * @param actor - The authenticated actor performing the action
     * @param params - Query parameters: `collectionId`, optional bookmark pagination
     * @param ctx - Optional service context carrying transaction and hookState
     * @returns The collection entity, plus paginated bookmarks when requested
     *
     * @throws {ServiceError} NOT_FOUND – collection does not exist
     * @throws {ServiceError} FORBIDDEN – actor is not the owner and lacks VIEW_ANY permission
     *
     * @example
     * ```ts
     * const result = await service.getCollectionById(actor, {
     *   collectionId: 'uuid',
     *   includeBookmarks: true,
     *   bookmarksPage: 1,
     *   bookmarksPageSize: 10,
     * });
     * ```
     */
    public async getCollectionById(
        actor: Actor,
        params: {
            readonly collectionId: string;
            readonly includeBookmarks?: boolean;
            readonly bookmarksPage?: number;
            readonly bookmarksPageSize?: number;
            readonly entityType?: 'ACCOMMODATION' | 'DESTINATION' | 'ATTRACTION' | 'EVENT' | 'POST';
        },
        ctx?: ServiceContext
    ): Promise<
        ServiceOutput<{
            collection: UserBookmarkCollection;
            bookmarks?: {
                rows: UserBookmarkWithEntityInfo[];
                total: number;
                page: number;
                pageSize: number;
            };
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getCollectionById',
            input: { actor, ...params },
            schema: UserBookmarkCollectionService.GetCollectionByIdSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                // 1. Fetch and validate collection existence
                const collection = await this.model.findById(validated.collectionId, execCtx?.tx);
                if (!collection) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `userBookmarkCollection not found: ${validated.collectionId}`
                    );
                }

                // 2. Permission: owner OR VIEW_ANY
                canAccessCollection(validActor, collection);

                if (!validated.includeBookmarks) {
                    return { collection };
                }

                // 3. Fetch bookmarks via direct Drizzle query (collectionId is not in the
                //    UserBookmark Zod schema so buildWhereClause cannot resolve it).
                const db = execCtx?.tx ?? getDb();
                const page = validated.bookmarksPage;
                const pageSize = validated.bookmarksPageSize;
                const offset = (page - 1) * pageSize;

                // Compose the WHERE clause: always scoped to the collection and
                // non-deleted; optionally narrowed to a single entity type when
                // the caller is filtering tabs in the collection detail UI.
                const activeBookmarksWhere = validated.entityType
                    ? and(
                          eq(userBookmarks.collectionId, validated.collectionId),
                          eq(userBookmarks.entityType, validated.entityType),
                          isNull(userBookmarks.deletedAt)
                      )
                    : and(
                          eq(userBookmarks.collectionId, validated.collectionId),
                          isNull(userBookmarks.deletedAt)
                      );

                const [rows, countRows] = await Promise.all([
                    db
                        .select()
                        .from(userBookmarks)
                        .where(activeBookmarksWhere)
                        .limit(pageSize)
                        .offset(offset),
                    db.select({ value: count() }).from(userBookmarks).where(activeBookmarksWhere)
                ]);

                const enrichedRows = await enrichBookmarksWithEntityInfo(
                    rows as UserBookmark[],
                    execCtx?.tx
                );

                return {
                    collection,
                    bookmarks: {
                        rows: enrichedRows,
                        total: Number(countRows[0]?.value ?? 0),
                        page,
                        pageSize
                    }
                };
            }
        });
    }

    /**
     * Updates a bookmark collection's editable fields.
     *
     * Enforces:
     * 1. Collection existence and ownership (or VIEW_ANY permission).
     * 2. Name uniqueness when the name is being changed — uses `existsActiveNameForUser`
     *    with `excludeId` set to the current collection so rename-to-same is a no-op.
     * 3. Input normalization via `normalizeUpdateInput` (trim, colour uppercase).
     * 4. Delegates actual persistence to `BaseCrudService.update`.
     *
     * @param actor - The authenticated actor performing the action
     * @param params - `collectionId` and the partial update payload
     * @param ctx - Optional service context carrying transaction and hookState
     * @returns The updated `UserBookmarkCollection`
     *
     * @throws {ServiceError} NOT_FOUND – collection does not exist
     * @throws {ServiceError} FORBIDDEN – actor is not the owner and lacks VIEW_ANY permission
     * @throws {ServiceError} CONFLICT – new name conflicts with an existing active collection
     *
     * @example
     * ```ts
     * const result = await service.updateCollection(actor, {
     *   collectionId: 'uuid',
     *   input: { name: 'Nuevo Nombre', color: '#42A5F5' },
     * });
     * ```
     */
    public async updateCollection(
        actor: Actor,
        params: {
            readonly collectionId: string;
            readonly input: import('@repo/schemas').UserBookmarkCollectionUpdateInput;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserBookmarkCollection>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateCollection',
            input: { actor, ...params },
            schema: UserBookmarkCollectionService.UpdateCollectionSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                // 1. Fetch and permission check
                const collection = await this.model.findById(validated.collectionId, execCtx?.tx);
                if (!collection) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `userBookmarkCollection not found: ${validated.collectionId}`
                    );
                }
                canAccessCollection(validActor, collection);

                // 2. Name uniqueness check when name is being changed
                if (
                    validated.input.name !== undefined &&
                    validated.input.name !== collection.name
                ) {
                    const nameTaken = await this.model.existsActiveNameForUser(
                        validActor.id,
                        validated.input.name,
                        validated.collectionId,
                        execCtx?.tx
                    );
                    if (nameTaken) {
                        throw new ServiceError(
                            ServiceErrorCode.ALREADY_EXISTS,
                            `Collection name "${validated.input.name}" is already taken`,
                            { name: validated.input.name },
                            'NAME_TAKEN'
                        );
                    }
                }

                // 3. Normalize input
                const normalizedInput = normalizeUpdateInput(validated.input, validActor);

                // 4. Delegate to BaseCrudService.update
                const result = await this.update(
                    validActor,
                    validated.collectionId,
                    normalizedInput,
                    execCtx
                );
                if (result.error) {
                    throw new ServiceError(
                        result.error.code,
                        result.error.message,
                        result.error.details
                    );
                }
                // biome-ignore lint/style/noNonNullAssertion: result.data is guaranteed when result.error is absent
                return result.data!;
            }
        });
    }

    /**
     * Soft-deletes a bookmark collection and nullifies `collectionId` on all
     * its bookmarks within the same transaction.
     *
     * This two-step atomic operation prevents bookmarks from pointing at a
     * soft-deleted collection (the `ON DELETE SET NULL` FK only fires on hard
     * deletes). Both operations execute inside a single `withServiceTransaction`
     * boundary so that a failure in either step rolls back the whole operation.
     *
     * @param actor - The authenticated actor performing the action
     * @param collectionId - ID of the collection to soft-delete
     * @param ctx - Optional service context carrying transaction and hookState
     * @returns `{ id: string; nullifiedBookmarks: number }` — the collection ID
     *   and the count of bookmarks that had their `collectionId` set to NULL
     *
     * @throws {ServiceError} NOT_FOUND – collection does not exist
     * @throws {ServiceError} FORBIDDEN – actor is not the owner and lacks VIEW_ANY permission
     *
     * @example
     * ```ts
     * const result = await service.deleteCollection(actor, 'collection-uuid');
     * if (result.data) {
     *   console.log(`Deleted, nullified ${result.data.nullifiedBookmarks} bookmarks`);
     * }
     * ```
     */
    public async deleteCollection(
        actor: Actor,
        collectionId: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ id: string; nullifiedBookmarks: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'deleteCollection',
            input: { actor, collectionId },
            schema: UserBookmarkCollectionService.DeleteCollectionSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                // 1. Fetch and permission check
                const collection = await this.model.findById(validated.collectionId, execCtx?.tx);
                if (!collection) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `userBookmarkCollection not found: ${validated.collectionId}`
                    );
                }
                canAccessCollection(validActor, collection);

                // 2. Execute both operations inside a transaction for atomicity
                return withServiceTransaction(async (txCtx) => {
                    // a. Nullify collectionId on bookmarks first
                    const nullifiedBookmarks = await this.model.nullifyCollectionIdOnBookmarks(
                        validated.collectionId,
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        txCtx.tx!
                    );

                    // b. Soft-delete the collection itself
                    await this.softDelete(validActor, validated.collectionId, txCtx);

                    return { id: validated.collectionId, nullifiedBookmarks };
                }, execCtx);
            }
        });
    }

    /**
     * Assigns a bookmark to a collection by updating the bookmark's `collectionId`.
     *
     * Both the collection and the bookmark must belong to the actor (or the actor
     * must hold `USER_BOOKMARK_COLLECTION_VIEW_ANY`). The update uses a direct
     * Drizzle query because `collectionId` is a DB-only column that is absent
     * from the `UserBookmark` Zod schema, so the generic `UserBookmarkModel.update()`
     * cannot accept it without an unsafe cast.
     *
     * @param actor - The authenticated actor performing the action
     * @param params - `collectionId` and `bookmarkId` to link
     * @param ctx - Optional service context carrying transaction and hookState
     * @returns The updated `UserBookmark` row (as returned by RETURNING)
     *
     * @throws {ServiceError} NOT_FOUND – collection or bookmark not found
     * @throws {ServiceError} FORBIDDEN – actor does not own both entities
     *
     * @example
     * ```ts
     * const result = await service.addBookmarkToCollection(actor, {
     *   collectionId: 'col-uuid',
     *   bookmarkId: 'bm-uuid',
     * });
     * ```
     */
    public async addBookmarkToCollection(
        actor: Actor,
        params: {
            readonly collectionId: string;
            readonly bookmarkId: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserBookmark>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addBookmarkToCollection',
            input: { actor, ...params },
            schema: UserBookmarkCollectionService.AddBookmarkToCollectionSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                // 1. Fetch and verify the collection
                const collection = await this.model.findById(validated.collectionId, execCtx?.tx);
                if (!collection) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `userBookmarkCollection not found: ${validated.collectionId}`
                    );
                }
                canAccessCollection(validActor, collection);

                // 2. Fetch and verify the bookmark
                const bookmarkModel = new UserBookmarkModel();
                const bookmark = await bookmarkModel.findById(validated.bookmarkId, execCtx?.tx);
                if (!bookmark) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `userBookmark not found: ${validated.bookmarkId}`
                    );
                }
                if (bookmark.userId !== validActor.id && !hasViewAnyPermission(validActor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: Only owner can modify bookmarks'
                    );
                }

                // 3. Update collectionId via direct Drizzle query (collectionId is a
                //    DB-only column absent from the UserBookmark Zod schema).
                const db = execCtx?.tx ?? getDb();
                const [updated] = await db
                    .update(userBookmarks)
                    .set({ collectionId: validated.collectionId, updatedAt: new Date() })
                    .where(eq(userBookmarks.id, validated.bookmarkId))
                    .returning();

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        `Failed to update bookmark ${validated.bookmarkId}`
                    );
                }

                return updated as UserBookmark;
            }
        });
    }

    /**
     * Removes a bookmark from its current collection by setting `collectionId = NULL`.
     *
     * Only the bookmark owner (or an actor with `USER_BOOKMARK_COLLECTION_VIEW_ANY`)
     * may perform this action. The update uses a direct Drizzle query because
     * `collectionId` is a DB-only column absent from the `UserBookmark` Zod schema.
     *
     * @param actor - The authenticated actor performing the action
     * @param params - `bookmarkId` to unlink from its collection
     * @param ctx - Optional service context carrying transaction and hookState
     * @returns The updated `UserBookmark` row with `collectionId` set to `null`
     *
     * @throws {ServiceError} NOT_FOUND – bookmark not found
     * @throws {ServiceError} FORBIDDEN – actor does not own the bookmark
     *
     * @example
     * ```ts
     * const result = await service.removeBookmarkFromCollection(actor, {
     *   bookmarkId: 'bm-uuid',
     * });
     * ```
     */
    public async removeBookmarkFromCollection(
        actor: Actor,
        params: {
            readonly bookmarkId: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UserBookmark>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeBookmarkFromCollection',
            input: { actor, ...params },
            schema: UserBookmarkCollectionService.RemoveBookmarkFromCollectionSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                // 1. Fetch and verify the bookmark
                const bookmarkModel = new UserBookmarkModel();
                const bookmark = await bookmarkModel.findById(validated.bookmarkId, execCtx?.tx);
                if (!bookmark) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `userBookmark not found: ${validated.bookmarkId}`
                    );
                }
                if (bookmark.userId !== validActor.id && !hasViewAnyPermission(validActor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: Only owner can modify bookmarks'
                    );
                }

                // 2. Set collectionId = NULL via direct Drizzle query (collectionId is a
                //    DB-only column absent from the UserBookmark Zod schema).
                const db = execCtx?.tx ?? getDb();
                const [updated] = await db
                    .update(userBookmarks)
                    .set({ collectionId: null, updatedAt: new Date() })
                    .where(eq(userBookmarks.id, validated.bookmarkId))
                    .returning();

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        `Failed to update bookmark ${validated.bookmarkId}`
                    );
                }

                return updated as UserBookmark;
            }
        });
    }
}
