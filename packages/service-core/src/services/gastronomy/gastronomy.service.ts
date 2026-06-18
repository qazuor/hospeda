/**
 * gastronomy.service.ts
 *
 * Concrete service for gastronomy commerce listings (SPEC-239 T-035 / T-036).
 *
 * ## Architecture
 *
 * `GastronomyService` extends {@link BaseCommerceListingService} and satisfies its
 * abstract contract by wiring the gastronomy-specific DB models.  All shared
 * behaviors (slug auto-generation, junction sync, owner-scoping, rating recompute,
 * destination validation) are inherited from the base — zero shared logic is
 * re-derived here.  This is the SPEC-240 reuse acceptance gate.
 *
 * ## Gastronomy-specific additions (T-035 / T-036)
 *
 * 1. **Abstract getters** — wire `gastronomyModel`, junction models
 *    (`rGastronomyAmenityModel`, `rGastronomyFeatureModel`) and catalog models
 *    (`amenityModel`, `featureModel`) for the base junction-sync machinery.
 * 2. **Search filters** — `_executeSearch` / `_executeCount` apply gastronomy
 *    filters (`type`, `priceRange`, `destinationId`, `isFeatured`, …).
 * 3. **Owner update gate** — `updateOwn()` validates with
 *    `GastronomyOwnerUpdateInputSchema` (operational sections only), enforces
 *    ownership (`NOT_FOUND` for non-owners), and gates each section on the
 *    corresponding `COMMERCE_*_EDIT_OWN` permission.
 * 4. **Public projections** — `_projectPublicEntity` strips `adminInfo` and
 *    `ownerId` from public-tier responses.
 *
 * @module gastronomy.service
 */

import {
    AmenityModel,
    FeatureModel,
    type GastronomyModel,
    gastronomyModel,
    rGastronomyAmenityModel,
    rGastronomyFeatureModel
} from '@repo/db';
import {
    type CountResponse,
    type EntityFilters,
    type Gastronomy,
    GastronomyAdminCreateInputSchema,
    GastronomyAdminSearchSchema,
    type GastronomyOwnerUpdateInput,
    GastronomyOwnerUpdateInputSchema,
    type GastronomySearch,
    GastronomySearchSchema,
    type GastronomyUpdateInput,
    GastronomyUpdateInputSchema,
    LifecycleStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import type {
    Actor,
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';
import type {
    CommerceCatalogModel,
    CommerceJunctionModel
} from '../commerce/base-commerce-listing.service';
import { BaseCommerceListingService } from '../commerce/base-commerce-listing.service';
import {
    checkGastronomyCanAdminList,
    checkGastronomyCanCreate,
    checkGastronomyCanDelete,
    checkGastronomyCanEditAll,
    checkGastronomyCanEditOwn,
    checkGastronomyCanEditOwnOrAll,
    checkGastronomyCanHardDelete,
    checkGastronomyCanRestore,
    checkGastronomyCanView
} from './gastronomy.permissions';
import { projectGastronomyOwnerAvatar, projectGastronomyPublic } from './gastronomy.projections';
import type { GastronomyHookState } from './gastronomy.types';

/** Entity-specific filter fields for gastronomy admin search. */
type _GastronomyEntityFilters = EntityFilters<typeof GastronomyAdminSearchSchema>;

/**
 * Business-logic service for gastronomy commerce listings.
 *
 * Extends {@link BaseCommerceListingService} with gastronomy-specific model
 * wiring and operational-update gate.  All shared lifecycle behaviors (slug,
 * junction sync, owner-scoping, rating recompute) are provided by the base class.
 *
 * @example
 * ```ts
 * const service = new GastronomyService({});
 *
 * // Admin create (full identity control)
 * const result = await service.create(
 *   { name: 'La Parrilla', type: 'PARRILLA', destinationId: 'uuid' },
 *   actor,
 *   ctx
 * );
 *
 * // Owner operational update (schedule, contact, media…)
 * const update = await service.updateOwn(
 *   'listing-uuid',
 *   { priceRange: 'MID', openingHours: { ... } },
 *   actor,
 *   ctx
 * );
 * ```
 */
export class GastronomyService extends BaseCommerceListingService<
    Gastronomy,
    GastronomyModel,
    typeof GastronomyAdminCreateInputSchema,
    typeof GastronomyUpdateInputSchema,
    typeof GastronomySearchSchema
> {
    static readonly ENTITY_NAME = 'gastronomy';

    protected readonly entityName = GastronomyService.ENTITY_NAME;

    protected readonly model: GastronomyModel;
    protected readonly createSchema = GastronomyAdminCreateInputSchema;
    protected readonly updateSchema = GastronomyUpdateInputSchema;
    protected readonly searchSchema = GastronomySearchSchema;

    // -----------------------------------------------------------------------
    // Catalog / junction model instances (injectable for unit tests)
    // -----------------------------------------------------------------------

    /** @internal Overrideable in unit tests. */
    private _amenityModelInstance: CommerceCatalogModel;
    /** @internal Overrideable in unit tests. */
    private _featureModelInstance: CommerceCatalogModel;
    /** @internal Overrideable in unit tests. */
    private _amenityJunctionModelInstance: CommerceJunctionModel<Record<string, unknown>>;
    /** @internal Overrideable in unit tests. */
    private _featureJunctionModelInstance: CommerceJunctionModel<Record<string, unknown>>;

    constructor(config: ServiceConfig) {
        super(config, GastronomyService.ENTITY_NAME);
        this.model = gastronomyModel;
        this.adminSearchSchema = GastronomyAdminSearchSchema;
        this._amenityModelInstance = new AmenityModel();
        this._featureModelInstance = new FeatureModel();
        // TYPE-WORKAROUND: concrete gastronomy junction model bridged to the generic CommerceJunctionModel contract
        this._amenityJunctionModelInstance =
            rGastronomyAmenityModel as unknown as CommerceJunctionModel<Record<string, unknown>>;
        // TYPE-WORKAROUND: concrete gastronomy junction model bridged to the generic CommerceJunctionModel contract
        this._featureJunctionModelInstance =
            rGastronomyFeatureModel as unknown as CommerceJunctionModel<Record<string, unknown>>;
    }

    // -----------------------------------------------------------------------
    // Abstract getter implementations (T-035)
    // -----------------------------------------------------------------------

    /**
     * FK column name on junction tables that references this entity.
     * Used by `syncCommerceAmenityJunction` / `syncCommerceFeatureJunction`.
     */
    protected override get _entityFkColumn(): string {
        return 'gastronomyId';
    }

    /** Gastronomy-amenity junction model (satisfies {@link CommerceJunctionModel}). */
    protected override get _amenityJunctionModel(): CommerceJunctionModel<Record<string, unknown>> {
        return this._amenityJunctionModelInstance;
    }

    /** Gastronomy-feature junction model. */
    protected override get _featureJunctionModel(): CommerceJunctionModel<Record<string, unknown>> {
        return this._featureJunctionModelInstance;
    }

    /** Amenity catalog model — validates supplied amenity IDs before sync. */
    protected override get _amenityModel(): CommerceCatalogModel {
        return this._amenityModelInstance;
    }

    /** Feature catalog model — validates supplied feature IDs before sync. */
    protected override get _featureModel(): CommerceCatalogModel {
        return this._featureModelInstance;
    }

    // -----------------------------------------------------------------------
    // Relation loading defaults
    // -----------------------------------------------------------------------

    protected override getDefaultListRelations(): Record<string, boolean> {
        return { owner: true, destination: true };
    }

    protected override getDefaultGetByIdRelations(): Record<string, boolean> {
        return {
            owner: true,
            destination: true,
            amenities: true,
            features: true,
            faqs: true
        };
    }

    // -----------------------------------------------------------------------
    // Permission hooks — required by BaseCrudService
    // -----------------------------------------------------------------------

    protected _canCreate(actor: Actor, data: unknown): void {
        checkGastronomyCanCreate(actor, data);
    }

    protected _canUpdate(actor: Actor, entity: Gastronomy): void {
        checkGastronomyCanEditOwnOrAll(actor, entity);
    }

    protected _canSoftDelete(actor: Actor, entity: Gastronomy): void {
        checkGastronomyCanDelete(actor, entity);
    }

    protected _canHardDelete(actor: Actor, entity: Gastronomy): void {
        checkGastronomyCanHardDelete(actor, entity);
    }

    protected _canRestore(actor: Actor, entity: Gastronomy): void {
        checkGastronomyCanRestore(actor, entity);
    }

    protected _canView(actor: Actor, entity: Gastronomy): void {
        checkGastronomyCanView(actor);

        // Non-admin actors receive NOT_FOUND for soft-deleted listings.
        if (
            entity.deletedAt !== null &&
            entity.deletedAt !== undefined &&
            !hasPermission(actor, PermissionEnum.COMMERCE_VIEW_ALL)
        ) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy not found');
        }

        // Non-admin / non-owner actors receive NOT_FOUND for non-ACTIVE or PRIVATE
        // listings (mirrors AccommodationService._canView for public-read gating).
        const isOwner = entity.ownerId === actor.id;
        const isStaff = hasPermission(actor, PermissionEnum.COMMERCE_VIEW_ALL);
        if (!isOwner && !isStaff) {
            if (entity.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy not found');
            }
            if (entity.visibility === VisibilityEnum.PRIVATE) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy not found');
            }
        }
    }

    protected _canList(actor: Actor): void {
        checkGastronomyCanView(actor);
    }

    protected _canSearch(actor: Actor): void {
        checkGastronomyCanView(actor);
    }

    protected _canCount(actor: Actor): void {
        checkGastronomyCanView(actor);
    }

    protected _canUpdateVisibility(
        actor: Actor,
        entity: Gastronomy,
        _newVisibility: unknown
    ): void {
        checkGastronomyCanEditAll(actor, entity);
    }

    /**
     * Admin-list gate: verifies admin-panel access (base class) then checks
     * entity-specific commerce permission.
     *
     * @param actor - The actor performing the action.
     * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
     */
    protected override async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkGastronomyCanAdminList(actor);
    }

    // -----------------------------------------------------------------------
    // Public-tier projections (T-038)
    // -----------------------------------------------------------------------

    /**
     * Strips `adminInfo` and `ownerId` from a single entity for public-tier responses.
     *
     * Called by the base class `_executeAdminSearch` post-processing.
     *
     * @param entity - Raw gastronomy entity from the database.
     * @returns Projected entity with private fields removed.
     */
    protected override _projectPublicEntity(entity: Gastronomy): Gastronomy {
        return projectGastronomyPublic(entity) as Gastronomy;
    }

    /**
     * List variant: resolves owner avatar then strips private fields.
     *
     * @param entities - Array of raw gastronomy entities.
     * @returns Array of projected entities.
     */
    protected override _projectPublicEntityList(entities: Gastronomy[]): Gastronomy[] {
        return entities.map((e) => {
            const withAvatar = projectGastronomyOwnerAvatar(e) ?? e;
            return this._projectPublicEntity(withAvatar);
        });
    }

    // -----------------------------------------------------------------------
    // Search execution (gastronomy-specific filters)
    // -----------------------------------------------------------------------

    /**
     * Executes the public search query with gastronomy-specific filter support.
     *
     * Scalar filters forwarded to the model: `type`, `priceRange`, `destinationId`,
     * `ownerId`, `isFeatured`.
     *
     * NOTE: `amenities` / `features` (array filters requiring junction-table
     * JOINs) and `minRating` / `maxRating` are stripped here and NOT applied —
     * they require a custom SQL query that the current `GastronomyModel.findAll`
     * does not support.  Junction-level and rating range filtering is tracked as
     * a follow-up task for the search route layer.
     *
     * @param params - Validated search parameters from `GastronomySearchSchema`.
     * @param _actor - The actor performing the action (public path; unused).
     * @param ctx - Service context for transaction propagation.
     * @returns Paginated gastronomy listing results.
     */
    protected async _executeSearch(
        params: GastronomySearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<Gastronomy>> {
        const {
            page,
            pageSize,
            sortBy: _sortBy,
            sortOrder: _sortOrder,
            amenities: _amenities,
            features: _features,
            minRating: _minRating,
            maxRating: _maxRating,
            includeAmenities: _includeAmenities,
            includeFeatures: _includeFeatures,
            ...scalarFilters
        } = params;

        // Public search MUST only surface listings with an active subscription
        // (AC-6.2 / AC-4.3): force visibility=PUBLIC + lifecycleState=ACTIVE AFTER
        // the caller's scalar filters so no query param can widen the result set.
        const result = await this.model.findAll(
            {
                ...scalarFilters,
                deletedAt: null,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            },
            { page, pageSize },
            undefined,
            ctx?.tx
        );
        return result as unknown as PaginatedListOutput<Gastronomy>; // TYPE-WORKAROUND: base list result narrowed to the gastronomy entity type (Drizzle row vs Zod entity, same bridge as accommodation services)
    }

    /**
     * Count query mirroring `_executeSearch` filter logic.
     *
     * @param params - Validated search parameters.
     * @param _actor - The actor performing the action.
     * @param ctx - Service context.
     * @returns Total count of matching gastronomy listings.
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
            amenities: _amenities,
            features: _features,
            minRating: _minRating,
            maxRating: _maxRating,
            includeAmenities: _includeAmenities,
            includeFeatures: _includeFeatures,
            ...scalarFilters
        } = params;

        // Mirror _executeSearch: count only publicly-visible (active-subscription)
        // listings so pagination totals match the filtered result set (AC-6.2).
        const count = await this.model.count(
            {
                ...scalarFilters,
                deletedAt: null,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            },
            { tx: ctx?.tx }
        );
        return { count };
    }

    /**
     * Admin search — inherits owner-scoping from the base class.
     *
     * Gastronomy-specific entity filters (`type`, `priceRange`, `destinationId`,
     * `ownerId`, `isFeatured`) are plain scalars that the generic admin search
     * builder handles natively via the where-clause builder.
     *
     * @param params - Admin search parameters assembled by `adminList()`.
     * @returns Paginated list with owner-scoping and public projections applied.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<Record<string, unknown>>
    ): Promise<PaginatedListOutput<Gastronomy>> {
        return super._executeAdminSearch(params);
    }

    // -----------------------------------------------------------------------
    // Owner operational update (T-036)
    // -----------------------------------------------------------------------

    /**
     * Owner-scoped operational update for gastronomy listings.
     *
     * ## Enforcement contract
     *
     * 1. **Schema validation**: payload is validated with
     *    `GastronomyOwnerUpdateInputSchema`, which ONLY permits operational
     *    sections (`openingHours`, `contactInfo`, `socialNetworks`, `media`,
     *    `menuUrl`, `priceRange`, `richDescription`, `amenityIds`, `featureIds`).
     *    Identity fields (`name`, `slug`, `type`, `destinationId`) are absent
     *    from the schema — any forged keys in the HTTP body are silently stripped.
     * 2. **Ownership check**: a non-owner receives `NOT_FOUND` to prevent
     *    existence leakage (same pattern as SPEC-169 for accommodations).
     *    Staff holding `COMMERCE_EDIT_ALL` bypass the ownership check.
     * 3. **Per-section permission checks**: each field group is gated on the
     *    matching `COMMERCE_*_EDIT_OWN` permission:
     *    - `openingHours` → `COMMERCE_SCHEDULE_EDIT_OWN`
     *    - `contactInfo` → `COMMERCE_CONTACT_EDIT_OWN`
     *    - `socialNetworks` → `COMMERCE_SOCIAL_EDIT_OWN`
     *    - `media` → `COMMERCE_MEDIA_EDIT_OWN`
     *    - `menuUrl` → `COMMERCE_MENU_EDIT_OWN`
     *    - `priceRange` → `COMMERCE_PRICE_RANGE_EDIT_OWN`
     *    - `richDescription` → `COMMERCE_RICH_DESCRIPTION_EDIT_OWN`
     *    - `amenityIds` → `COMMERCE_AMENITIES_EDIT_OWN`
     *    - `featureIds` → `COMMERCE_FEATURES_EDIT_OWN`
     * 4. **Delegation**: passes through to `this.update()` so that junction sync
     *    (`_beforeUpdate` / `_afterUpdate`) fires for amenity/feature changes.
     *
     * @param gastronomyId - UUID of the gastronomy listing to update.
     * @param data - Validated operational-only update payload.
     * @param actor - The actor performing the update.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `ServiceOutput<Gastronomy>` wrapping the updated entity.
     */
    public async updateOwn(
        gastronomyId: string,
        data: GastronomyOwnerUpdateInput,
        actor: Actor,
        ctx?: ServiceContext<GastronomyHookState>
    ): Promise<ServiceOutput<Gastronomy>> {
        try {
            // 1. Validate the payload against the owner-update schema (operational only).
            const parseResult = GastronomyOwnerUpdateInputSchema.safeParse(data);
            if (!parseResult.success) {
                const messages = parseResult.error.issues
                    .map((i) => `${i.path.join('.')}: ${i.message}`)
                    .join('; ');
                return {
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: `Validation failed: ${messages}`
                    }
                };
            }
            const validated = parseResult.data;

            // 2. Load the listing.
            const entity = await this.model.findById(gastronomyId, ctx?.tx);
            if (!entity) {
                return {
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Gastronomy listing not found'
                    }
                };
            }

            // 3. Ownership gate — non-owners receive NOT_FOUND (existence leak prevention).
            const isOwner = entity.ownerId === actor.id;
            const hasEditAll = hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL);
            if (!isOwner && !hasEditAll) {
                return {
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Gastronomy listing not found'
                    }
                };
            }

            // 4. Per-section permission checks (staff with EDIT_ALL bypass all).
            if (!hasEditAll) {
                if (validated.openingHours !== undefined) {
                    checkGastronomyCanEditOwn(
                        actor,
                        entity,
                        PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN
                    );
                }
                if (validated.contactInfo !== undefined) {
                    checkGastronomyCanEditOwn(
                        actor,
                        entity,
                        PermissionEnum.COMMERCE_CONTACT_EDIT_OWN
                    );
                }
                if (validated.socialNetworks !== undefined) {
                    checkGastronomyCanEditOwn(
                        actor,
                        entity,
                        PermissionEnum.COMMERCE_SOCIAL_EDIT_OWN
                    );
                }
                if (validated.media !== undefined) {
                    checkGastronomyCanEditOwn(
                        actor,
                        entity,
                        PermissionEnum.COMMERCE_MEDIA_EDIT_OWN
                    );
                }
                if (validated.menuUrl !== undefined) {
                    checkGastronomyCanEditOwn(actor, entity, PermissionEnum.COMMERCE_MENU_EDIT_OWN);
                }
                if (validated.priceRange !== undefined) {
                    checkGastronomyCanEditOwn(
                        actor,
                        entity,
                        PermissionEnum.COMMERCE_PRICE_RANGE_EDIT_OWN
                    );
                }
                if (validated.richDescription !== undefined) {
                    checkGastronomyCanEditOwn(
                        actor,
                        entity,
                        PermissionEnum.COMMERCE_RICH_DESCRIPTION_EDIT_OWN
                    );
                }
                if (validated.amenityIds !== undefined) {
                    checkGastronomyCanEditOwn(
                        actor,
                        entity,
                        PermissionEnum.COMMERCE_AMENITIES_EDIT_OWN
                    );
                }
                if (validated.featureIds !== undefined) {
                    checkGastronomyCanEditOwn(
                        actor,
                        entity,
                        PermissionEnum.COMMERCE_FEATURES_EDIT_OWN
                    );
                }
            }

            // 5. Delegate to base update() for junction sync + hook pipeline.
            //    Owner update schema is a strict subset of the full update schema,
            //    so casting is safe here.  Base update signature: update(actor, id, data, ctx?).
            //
            //    Base update() runs _canUpdate, which is owner-aware
            //    (checkGastronomyCanEditOwnOrAll: COMMERCE_EDIT_ALL OR owner + an
            //    operational editOwn permission). updateOwn() already enforced ownership
            //    and per-section gating above, and the payload was validated against the
            //    owner schema (operational fields only), so the original actor passes the
            //    base gate without any privilege elevation.
            return this.update(
                actor,
                gastronomyId,
                validated as GastronomyUpdateInput,
                ctx as ServiceContext
            );
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
}
