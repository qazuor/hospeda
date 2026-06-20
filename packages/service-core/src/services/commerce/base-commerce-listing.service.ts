/**
 * base-commerce-listing.service.ts
 *
 * Abstract base class for all commerce listing services (SPEC-239 T-029).
 *
 * Provides shared lifecycle hooks and behaviors so that GastronomyService and
 * future experience services reuse this logic without re-deriving it:
 *
 *  (a) Destination CITY-type validation in `_beforeCreate` / `_beforeUpdate`.
 *  (b) Slug auto-generation from `name` when absent (`_beforeCreate`).
 *  (c) Junction IDs capture into `hookState` (`_beforeCreate`, `_beforeUpdate`);
 *      transactional junction sync (`_afterCreate`, `_afterUpdate`).
 *  (d) Denormalized rating recompute exposed as a public helper method
 *      (`recomputeRating`) called by the entity's review sub-service.
 *  (e) Owner-scoping in `_executeAdminSearch` (forces `ownerId` filter for
 *      actors that only hold the VIEW_OWN permission, not VIEW_ALL).
 *  (f) Public-tier projections via overrideable `_projectPublicEntity`.
 *
 * Concrete subclasses supply: model/schemas (inherited abstract members from
 * `BaseCrudService`), junction + catalog model accessors, FK column name, and
 * the permission-check abstract methods.
 *
 * @module base-commerce-listing.service
 */

import type { DrizzleClient } from '@repo/db';
import { DestinationModel } from '@repo/db';
import { DestinationTypeEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { createUniqueSlug } from '@repo/utils';
import type { ZodObject, ZodRawShape } from 'zod';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type {
    Actor,
    AdminSearchExecuteParams,
    BaseModel,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';
import { syncCommerceAmenityJunction, syncCommerceFeatureJunction } from './commerce.junction-sync';
import type { CommerceListingHookState } from './commerce.types';

// ---------------------------------------------------------------------------
// Minimal catalog/junction interfaces (injected by concrete services)
// ---------------------------------------------------------------------------

/**
 * Minimal amenity/feature catalog model interface required by the base class.
 * Concrete services inject their own catalog model which must satisfy this
 * interface; it is intentionally minimal to keep the abstraction decoupled
 * from the full model type.
 */
export interface CommerceCatalogModel {
    findById: (id: string, tx?: DrizzleClient) => Promise<unknown>;
}

/**
 * Minimal junction table model interface required by the base class.
 * Only the three operations needed by the diff-sync algorithm are declared.
 */
export interface CommerceJunctionModel<TRow extends Record<string, unknown>> {
    findAll: (
        where: Record<string, unknown>,
        options?: unknown,
        additionalConditions?: unknown,
        tx?: DrizzleClient
    ) => Promise<{ items: TRow[] }>;
    hardDelete: (where: Record<string, unknown>, tx?: DrizzleClient) => Promise<unknown>;
    create: (data: Record<string, unknown>, tx?: DrizzleClient) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Minimum entity shape
// ---------------------------------------------------------------------------

/**
 * Minimum shape a commerce listing entity must satisfy to work with
 * `BaseCommerceListingService`.  Adds commerce-specific fields on top of the
 * `{ id; deletedAt? }` constraint from `BaseCrudService`.
 *
 * The index signature `[key: string]: unknown` satisfies the `BaseModel<T>`
 * constraint which requires `T extends Record<string, unknown>`.
 */
export interface CommerceListingEntity extends Record<string, unknown> {
    id: string;
    name: string;
    slug: string;
    deletedAt?: Date | null;
    ownerId?: string | null;
    destinationId?: string | null;
    visibility?: string | null;
    lifecycleState?: string | null;
    reviewsCount?: number | null;
    averageRating?: number | null;
    rating?: unknown | null;
}

// ---------------------------------------------------------------------------
// Abstract base service
// ---------------------------------------------------------------------------

/**
 * Abstract base class for commerce listing services (gastronomy, experience, …).
 *
 * ## What this class provides
 *
 * - **Destination validation** (`_beforeCreate` / `_beforeUpdate`): asserts
 *   that any `destinationId` in the payload refers to a CITY-type destination.
 * - **Slug generation** (`_beforeCreate`): auto-generates a unique slug from
 *   `name` when the payload omits one; delegates to `createUniqueSlug` from
 *   `@repo/utils`.
 * - **Junction capture** (`_beforeCreate` / `_beforeUpdate`): extracts
 *   `amenityIds` / `featureIds` from the payload into `ctx.hookState` and
 *   strips them from the DB write.
 * - **Junction sync** (`_afterCreate` / `_afterUpdate`): calls
 *   `syncCommerceAmenityJunction` / `syncCommerceFeatureJunction` inside the
 *   caller's `ctx.tx` when hookState carries IDs.
 * - **Owner-scoping** (`_executeAdminSearch`): forces `ownerId = actor.id`
 *   when the actor holds only the VIEW_OWN permission.
 * - **Public projection** (`_projectPublicEntity` / `_projectPublicEntityList`):
 *   no-op by default; subclasses override to strip private fields.
 * - **Rating recompute** (`recomputeRating`): helper for review sub-services.
 *
 * ## What subclasses must supply
 *
 * Abstract members from `BaseCrudService`:
 * - `model`, `createSchema`, `updateSchema`, `searchSchema`
 * - `_canCreate`, `_canUpdate`, `_canSoftDelete`, `_canHardDelete`, `_canRestore`
 * - `_canView`, `_canList`, `_canSearch`, `_canCount`, `_canUpdateVisibility`
 * - `_executeSearch`, `_executeCount`
 *
 * Commerce-specific abstract getters (new in this class):
 * - `_entityFkColumn` — FK column name on the junction table (e.g. `'gastronomyId'`)
 * - `_amenityJunctionModel` — junction model for amenities
 * - `_featureJunctionModel` — junction model for features
 * - `_amenityModel` — catalog model for amenities (validates IDs)
 * - `_featureModel` — catalog model for features (validates IDs)
 *
 * @template TEntity - The commerce listing domain entity type.
 * @template TModel - The Drizzle ORM model type for the entity.
 * @template TCreateSchema - Zod schema for create input.
 * @template TUpdateSchema - Zod schema for update input.
 * @template TSearchSchema - Zod schema for search input.
 */
export abstract class BaseCommerceListingService<
    TEntity extends CommerceListingEntity,
    TModel extends BaseModel<TEntity>,
    TCreateSchema extends ZodObject<ZodRawShape>,
    TUpdateSchema extends ZodObject<ZodRawShape>,
    TSearchSchema extends ZodObject<ZodRawShape>
> extends BaseCrudService<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema> {
    /**
     * Destination model used for city-type validation.
     * Overrideable in tests by assigning a mock after construction.
     */
    protected _destinationModel: DestinationModel;

    constructor(config: ServiceConfig, entityName: string) {
        super(config, entityName);
        this._destinationModel = new DestinationModel();
    }

    // -----------------------------------------------------------------------
    // Abstract commerce-specific getters — subclasses must implement
    // -----------------------------------------------------------------------

    /**
     * Name of the FK column on the junction table that references this entity.
     *
     * @example `'gastronomyId'` for the gastronomy service.
     */
    protected abstract get _entityFkColumn(): string;

    /**
     * Amenity junction table model (injectable for testing).
     */
    protected abstract get _amenityJunctionModel(): CommerceJunctionModel<Record<string, unknown>>;

    /**
     * Feature junction table model (injectable for testing).
     */
    protected abstract get _featureJunctionModel(): CommerceJunctionModel<Record<string, unknown>>;

    /**
     * Amenity catalog model used to validate supplied amenity IDs before sync.
     */
    protected abstract get _amenityModel(): CommerceCatalogModel;

    /**
     * Feature catalog model used to validate supplied feature IDs before sync.
     */
    protected abstract get _featureModel(): CommerceCatalogModel;

    /**
     * The VIEW_ALL permission that grants unscoped listing access.
     *
     * Defaults to `COMMERCE_VIEW_ALL`.  Override in subclasses when a more
     * specific permission is added (e.g. `COMMERCE_GASTRONOMY_VIEW_ALL`).
     */
    protected get _viewAllPermission(): PermissionEnum {
        return PermissionEnum.COMMERCE_VIEW_ALL;
    }

    /**
     * The VIEW_OWN permission that grants owner-scoped listing access.
     *
     * Defaults to {@link _viewAllPermission} so that, until a dedicated
     * owner-scoped permission exists, the owner-scoping predicate is a safe
     * no-op (an actor only reaches `_executeAdminSearch` after the admin-list
     * gate has already required VIEW_ALL). Override in subclasses once a
     * dedicated `COMMERCE_*_VIEW_OWN` permission is introduced — the scoping
     * predicate then becomes correct by construction with no further changes.
     */
    protected get _viewOwnPermission(): PermissionEnum {
        return this._viewAllPermission;
    }

    // -----------------------------------------------------------------------
    // Public-tier projections — override in subclasses when needed
    // -----------------------------------------------------------------------

    /**
     * Applies public-tier projections to a single entity.
     *
     * Default implementation is a no-op (returns the entity unchanged).
     * Subclasses override to strip private fields, normalise owner avatars, etc.
     *
     * @param entity - The raw entity from the database.
     * @returns The projected entity suitable for public consumption.
     */
    protected _projectPublicEntity(entity: TEntity): TEntity {
        return entity;
    }

    /**
     * Applies public-tier projections to a list of entities.
     * Delegates to `_projectPublicEntity` for each item.
     *
     * @param entities - Array of raw entities from the database.
     * @returns Array of projected entities suitable for public consumption.
     */
    protected _projectPublicEntityList(entities: TEntity[]): TEntity[] {
        return entities.map((e) => this._projectPublicEntity(e));
    }

    // -----------------------------------------------------------------------
    // (a) + (b) + (c): _beforeCreate
    // -----------------------------------------------------------------------

    /**
     * Pre-insert lifecycle hook shared by all commerce listing types.
     *
     * Performs three tasks (in order):
     * 1. **Destination validation**: asserts `destinationId` (when provided)
     *    refers to an existing CITY-type destination.
     * 2. **Junction capture**: copies `amenityIds` / `featureIds` from the
     *    payload into `ctx.hookState` for the sync call in `_afterCreate`.
     * 3. **Slug generation**: when `slug` is absent, generates a unique slug
     *    from `name` via `createUniqueSlug` and returns it as the patch.
     *
     * @param data - Validated create input from the schema.
     * @param _actor - The actor performing the action.
     * @param ctx - Service execution context (carries `tx` and `hookState`).
     * @returns Partial entity patch: `{ slug }` when generated, `{}` otherwise.
     */
    protected override async _beforeCreate(
        data: z.infer<TCreateSchema>,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<Partial<TEntity>> {
        const payload = data as Record<string, unknown>;
        const typedCtx = ctx as ServiceContext<CommerceListingHookState>;

        // (a) Destination CITY-type validation
        if (payload.destinationId) {
            await this._assertDestinationIsCity(payload.destinationId as string, ctx.tx);
        }

        // (c) Capture junction IDs into hookState BEFORE the DB write
        if (typedCtx.hookState !== undefined) {
            typedCtx.hookState.pendingAmenityIds = payload.amenityIds as
                | readonly string[]
                | undefined;
            typedCtx.hookState.pendingFeatureIds = payload.featureIds as
                | readonly string[]
                | undefined;
        }

        // (b) Slug auto-generation from name when absent
        if (!payload.slug && payload.name) {
            const name = payload.name as string;
            const model = this.model;
            const slug = await createUniqueSlug(name, async (candidate) => {
                const existing = await model.findOne({ slug: candidate });
                return !!existing;
            });
            return { slug } as Partial<TEntity>;
        }

        return {} as Partial<TEntity>;
    }

    // -----------------------------------------------------------------------
    // (c) Junction sync: _afterCreate
    // -----------------------------------------------------------------------

    /**
     * Post-insert lifecycle hook: syncs amenity and feature junction tables
     * inside `ctx.tx` when `hookState` carries pending IDs.
     *
     * **Transaction requirement**: if `pendingAmenityIds` or `pendingFeatureIds`
     * are defined but `ctx.tx` is absent, the hook throws `INTERNAL_ERROR`.
     * Callers must wrap the `create()` call inside `withServiceTransaction`.
     *
     * @param entity - The newly created entity.
     * @param _actor - The actor performing the action.
     * @param ctx - Service execution context (must carry `tx` when junction IDs are present).
     * @returns The entity unchanged (side-effects only).
     */
    protected override async _afterCreate(
        entity: TEntity,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<TEntity> {
        const typedCtx = ctx as ServiceContext<CommerceListingHookState>;

        if (typedCtx.hookState?.pendingAmenityIds !== undefined) {
            if (!ctx.tx) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Junction sync requires an active transaction; wrap create() in withServiceTransaction'
                );
            }
            await syncCommerceAmenityJunction({
                entityId: entity.id,
                entityFkColumn: this._entityFkColumn,
                amenityIds: typedCtx.hookState.pendingAmenityIds,
                junctionModel: this._amenityJunctionModel,
                amenityModel: this._amenityModel,
                tx: ctx.tx
            });
        }

        if (typedCtx.hookState?.pendingFeatureIds !== undefined) {
            if (!ctx.tx) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Junction sync requires an active transaction; wrap create() in withServiceTransaction'
                );
            }
            await syncCommerceFeatureJunction({
                entityId: entity.id,
                entityFkColumn: this._entityFkColumn,
                featureIds: typedCtx.hookState.pendingFeatureIds,
                junctionModel: this._featureJunctionModel,
                featureModel: this._featureModel,
                tx: ctx.tx
            });
        }

        return entity;
    }

    // -----------------------------------------------------------------------
    // (c) Junction capture: _beforeUpdate
    // -----------------------------------------------------------------------

    /**
     * Pre-update lifecycle hook: captures `amenityIds` / `featureIds` from the
     * update payload into `ctx.hookState` and strips them from the returned
     * data so they are never passed as DB column values.
     *
     * Also re-validates `destinationId` when it is being changed.
     *
     * @param data - Validated update input from the schema.
     * @param _actor - The actor performing the action.
     * @param ctx - Service execution context.
     * @returns Payload with `amenityIds` / `featureIds` stripped.
     */
    protected override async _beforeUpdate(
        data: z.infer<TUpdateSchema>,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<Partial<TEntity>> {
        const payload = data as Record<string, unknown>;
        const typedCtx = ctx as ServiceContext<CommerceListingHookState>;

        // (a) Destination CITY-type validation on re-assignment
        if (payload.destinationId) {
            await this._assertDestinationIsCity(payload.destinationId as string, ctx.tx);
        }

        // (c) Capture junction IDs into hookState
        if (typedCtx.hookState !== undefined) {
            typedCtx.hookState.pendingAmenityIds = payload.amenityIds as
                | readonly string[]
                | undefined;
            typedCtx.hookState.pendingFeatureIds = payload.featureIds as
                | readonly string[]
                | undefined;
        }

        // Strip write-only junction fields from the DB write payload
        const { amenityIds: _a, featureIds: _f, ...rest } = payload;
        return rest as Partial<TEntity>;
    }

    // -----------------------------------------------------------------------
    // (c) Junction sync: _afterUpdate
    // -----------------------------------------------------------------------

    /**
     * Post-update lifecycle hook: syncs amenity and feature junction tables
     * inside `ctx.tx` when `hookState` carries pending IDs.
     *
     * Same transaction requirement as `_afterCreate`.
     *
     * @param entity - The updated entity.
     * @param _actor - The actor performing the action.
     * @param ctx - Service execution context (must carry `tx` when junction IDs are present).
     * @returns The entity unchanged (side-effects only).
     */
    protected override async _afterUpdate(
        entity: TEntity,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<TEntity> {
        const typedCtx = ctx as ServiceContext<CommerceListingHookState>;

        if (typedCtx.hookState?.pendingAmenityIds !== undefined) {
            if (!ctx.tx) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Junction sync requires an active transaction; wrap update() in withServiceTransaction'
                );
            }
            await syncCommerceAmenityJunction({
                entityId: entity.id,
                entityFkColumn: this._entityFkColumn,
                amenityIds: typedCtx.hookState.pendingAmenityIds,
                junctionModel: this._amenityJunctionModel,
                amenityModel: this._amenityModel,
                tx: ctx.tx
            });
        }

        if (typedCtx.hookState?.pendingFeatureIds !== undefined) {
            if (!ctx.tx) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Junction sync requires an active transaction; wrap update() in withServiceTransaction'
                );
            }
            await syncCommerceFeatureJunction({
                entityId: entity.id,
                entityFkColumn: this._entityFkColumn,
                featureIds: typedCtx.hookState.pendingFeatureIds,
                junctionModel: this._featureJunctionModel,
                featureModel: this._featureModel,
                tx: ctx.tx
            });
        }

        return entity;
    }

    // -----------------------------------------------------------------------
    // (e) Owner-scoping: _executeAdminSearch
    // -----------------------------------------------------------------------

    /**
     * Admin search override that applies owner-scoping when the actor holds
     * only the VIEW_OWN permission (not the full VIEW_ALL).
     *
     * When scoped, any client-supplied `ownerId` is **overwritten** with
     * `actor.id`, preventing the "drop the filter to list everything" bypass.
     *
     * After scoping, delegates to `super._executeAdminSearch` for the actual
     * query. The admin tier returns FULL entities (including `ownerId` and
     * `adminInfo`): the public-tier projection (`_projectPublicEntityList`) is
     * applied ONLY on the public search path (`_executeSearch`), never here.
     * Stripping `ownerId` from the admin payload makes every row fail the admin
     * response schema (which requires `ownerId`) and 500s the admin list.
     *
     * Subclasses that need entity-specific extra conditions (e.g., JSONB
     * price-range filters) should override this method, apply their conditions,
     * and call `super._executeAdminSearch(scopedParams)`.
     *
     * @param params - Assembled admin search parameters from `adminList`.
     * @returns Paginated list of matching entities with full admin-tier fields.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<Record<string, unknown>>
    ): Promise<PaginatedListOutput<TEntity>> {
        // Force owner-scoping for actors that hold VIEW_OWN but NOT VIEW_ALL.
        // Correct by construction: an actor with the all-listings permission is
        // never scoped; one that only holds the owner-scoped permission is forced
        // to its own `ownerId`. Until a dedicated owner-scoped permission exists
        // `_viewOwnPermission` defaults to `_viewAllPermission`, making this a safe
        // no-op (the admin-list gate already requires VIEW_ALL upstream).
        const ownerScoped =
            !hasPermission(params.actor, this._viewAllPermission) &&
            hasPermission(params.actor, this._viewOwnPermission);

        const scopedParams: AdminSearchExecuteParams<Record<string, unknown>> = ownerScoped
            ? {
                  ...params,
                  entityFilters: { ...params.entityFilters, ownerId: params.actor.id }
              }
            : params;

        // No public projection here — the admin tier intentionally exposes
        // ownerId / adminInfo (see method doc). Projection lives on the public
        // search path only.
        return super._executeAdminSearch(scopedParams);
    }

    // -----------------------------------------------------------------------
    // (d) Denormalized rating recompute helper
    // -----------------------------------------------------------------------

    /**
     * Recomputes and persists the denormalized `rating`, `averageRating`, and
     * `reviewsCount` fields after a review is created, updated, or deleted.
     *
     * This is a service-layer helper, not a DB trigger.  The entity's review
     * sub-service (e.g. `GastronomyReviewService`) is responsible for calling
     * this method whenever the approved review set changes.
     *
     * **Caller responsibility**: pass only APPROVED, non-deleted review rows.
     * Filtering by `moderationState = APPROVED AND deletedAt IS NULL` should
     * happen before calling this method.
     *
     * @param listingId - UUID of the listing whose rating should be refreshed.
     * @param ratingRows - Approved review ratings for this listing.
     * @param tx - Optional Drizzle transaction client.
     * @returns `ServiceOutput<TEntity | null>` wrapping the updated entity.
     *
     * @example
     * ```ts
     * // In GastronomyReviewService._afterCreate:
     * const approved = await reviewModel.findAll({
     *   gastronomyId: listing.id,
     *   moderationState: ModerationStateEnum.APPROVED,
     *   deletedAt: null,
     * }, undefined, undefined, ctx?.tx);
     * await gastronomyService.recomputeRating(listing.id, approved.items, ctx?.tx);
     * ```
     */
    public async recomputeRating(
        listingId: string,
        ratingRows: readonly {
            readonly food?: number | null;
            readonly service?: number | null;
            readonly ambiance?: number | null;
            readonly value?: number | null;
        }[],
        tx?: DrizzleClient
    ): Promise<ServiceOutput<TEntity | null>> {
        try {
            const count = ratingRows.length;

            if (count === 0) {
                const updated = await this.model.update(
                    { id: listingId },
                    { reviewsCount: 0, averageRating: 0, rating: null } as Partial<TEntity>,
                    tx
                );
                return { data: updated as TEntity };
            }

            const sum = { food: 0, service: 0, ambiance: 0, value: 0 };
            for (const row of ratingRows) {
                sum.food += row.food ?? 0;
                sum.service += row.service ?? 0;
                sum.ambiance += row.ambiance ?? 0;
                sum.value += row.value ?? 0;
            }

            const granular = {
                food: Math.round((sum.food / count) * 100) / 100,
                service: Math.round((sum.service / count) * 100) / 100,
                ambiance: Math.round((sum.ambiance / count) * 100) / 100,
                value: Math.round((sum.value / count) * 100) / 100
            };

            const averageRating =
                Math.round(
                    ((granular.food + granular.service + granular.ambiance + granular.value) / 4) *
                        100
                ) / 100;

            const updated = await this.model.update(
                { id: listingId },
                { reviewsCount: count, averageRating, rating: granular } as Partial<TEntity>,
                tx
            );
            return { data: updated as TEntity };
        } catch (err) {
            const error = new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                `Failed to recompute rating for ${this.entityName} ${listingId}: ${err instanceof Error ? err.message : String(err)}`,
                err
            );
            return { error };
        }
    }

    /**
     * Assigns (or reassigns) the owner of a commerce listing.
     *
     * `ownerId` is intentionally excluded from the entity update schema
     * (ownership is immutable through the generic `update()` path), so ownership
     * changes must go through this dedicated action. Routing them through
     * `update()` silently strips `ownerId` and the change is lost — this method
     * writes the FK column directly instead.
     *
     * Staff-only: requires `COMMERCE_EDIT_ALL`. A listing owner cannot reassign
     * their own listing away.
     *
     * @param actor - The actor performing the assignment.
     * @param listingId - UUID of the commerce listing.
     * @param ownerId - UUID of the user to set as owner.
     * @param tx - Optional transaction client.
     * @returns `ServiceOutput<TEntity>` with the updated listing, or an error.
     */
    public async assignOwner(
        actor: Actor,
        listingId: string,
        ownerId: string,
        tx?: DrizzleClient
    ): Promise<ServiceOutput<TEntity>> {
        try {
            if (!hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL)) {
                return {
                    error: new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        `Permission denied: ${PermissionEnum.COMMERCE_EDIT_ALL} required to assign a ${this.entityName} owner`
                    )
                };
            }

            const existing = await this.model.findById(listingId, tx);
            if (!existing) {
                return {
                    error: new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `${this.entityName} ${listingId} not found`
                    )
                };
            }

            const updated = await this.model.update(
                { id: listingId },
                // TYPE-WORKAROUND: `ownerId` / `updatedById` are concrete columns on
                // every commerce listing table but are not provable members of the
                // generic `TEntity`; the partial-update payload is structurally safe.
                { ownerId, updatedById: actor.id } as unknown as Partial<TEntity>,
                tx
            );
            return { data: updated as TEntity };
        } catch (err) {
            const error = new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                `Failed to assign owner for ${this.entityName} ${listingId}: ${err instanceof Error ? err.message : String(err)}`,
                err
            );
            return { error };
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Asserts that the destination identified by `destinationId` exists and
     * has `destinationType === CITY`.
     *
     * @param destinationId - UUID to look up.
     * @param tx - Optional transaction client.
     * @throws {ServiceError} VALIDATION_ERROR when not found or not a CITY.
     */
    private async _assertDestinationIsCity(
        destinationId: string,
        tx?: DrizzleClient
    ): Promise<void> {
        const dest = await this._destinationModel.findById(destinationId, tx);
        if (!dest) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Destination not found: ${destinationId}`
            );
        }
        const destinationType = (dest as Record<string, unknown>).destinationType;
        if (destinationType !== DestinationTypeEnum.CITY) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Commerce listings must be linked to a CITY-type destination'
            );
        }
    }
}
