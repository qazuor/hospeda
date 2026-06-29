/**
 * experience.service.ts
 *
 * Concrete service for experience commerce listings (SPEC-240 T-017).
 *
 * ## Architecture
 *
 * `ExperienceService` extends {@link BaseCommerceListingService} and satisfies its
 * abstract contract by wiring the experience-specific DB models.  All shared
 * behaviors (slug auto-generation, junction sync, owner-scoping, rating recompute,
 * destination validation) are inherited from the base — zero shared logic is
 * re-derived here.  This is the SPEC-239/240 reuse acceptance gate.
 *
 * ## Experience-specific additions (T-017)
 *
 * 1. **Abstract getters** — wire `experienceModel`, junction models
 *    (`rExperienceAmenityModel`, `rExperienceFeatureModel`) and catalog models
 *    (`amenityModel`, `featureModel`) for the base junction-sync machinery.
 * 2. **Search filters** — `_executeSearch` / `_executeCount` apply experience
 *    filters (`type`, `hasActiveSubscription`, `destinationId`, `isFeatured`, …).
 * 3. **Owner update gate** — `updateOwn()` validates with
 *    `ExperienceOwnerUpdateInputSchema` (operational sections only), enforces
 *    ownership (`NOT_FOUND` for non-owners), and gates on a single
 *    `COMMERCE_EDIT_OWN` permission (SPEC-253 D2=b; per-section perms removed).
 * 4. **Public projections** — `_projectPublicEntity` strips `adminInfo` and
 *    `ownerId` from public-tier responses.
 *
 * @module experience.service
 */

import {
    AmenityModel,
    type ExperienceModel,
    FeatureModel,
    experienceModel,
    rExperienceAmenityModel,
    rExperienceFeatureModel
} from '@repo/db';
import {
    type CountResponse,
    type Experience,
    ExperienceAdminCreateInputSchema,
    ExperienceAdminSearchSchema,
    type ExperienceOwnerUpdateInput,
    ExperienceOwnerUpdateInputSchema,
    type ExperienceSearch,
    ExperienceSearchSchema,
    type ExperienceUpdateInput,
    ExperienceUpdateInputSchema,
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
    checkExperienceCanAdminList,
    checkExperienceCanCreate,
    checkExperienceCanDelete,
    checkExperienceCanEditAll,
    checkExperienceCanEditOwn,
    checkExperienceCanEditOwnOrAll,
    checkExperienceCanHardDelete,
    checkExperienceCanRestore,
    checkExperienceCanView
} from './experience.permissions';
import { projectExperienceOwnerAvatar, projectExperiencePublic } from './experience.projections';
import type { ExperienceHookState } from './experience.types';

/**
 * Business-logic service for experience commerce listings.
 *
 * Extends {@link BaseCommerceListingService} with experience-specific model
 * wiring and operational-update gate.  All shared lifecycle behaviors (slug,
 * junction sync, owner-scoping, rating recompute) are provided by the base class.
 *
 * @example
 * ```ts
 * const service = new ExperienceService({});
 *
 * // Admin create (full identity control)
 * const result = await service.create(
 *   { name: 'City Kayak Tour', type: 'EXCURSION', destinationId: 'uuid', priceFrom: 150000, priceUnit: 'per_person' },
 *   actor,
 *   ctx
 * );
 *
 * // Owner operational update (schedule, contact, media…)
 * const update = await service.updateOwn(
 *   'listing-uuid',
 *   { openingHours: { ... }, contactInfo: { ... } },
 *   actor,
 *   ctx
 * );
 * ```
 */
export class ExperienceService extends BaseCommerceListingService<
    Experience,
    ExperienceModel,
    typeof ExperienceAdminCreateInputSchema,
    typeof ExperienceUpdateInputSchema,
    typeof ExperienceSearchSchema
> {
    static readonly ENTITY_NAME = 'experience';

    protected readonly entityName = ExperienceService.ENTITY_NAME;

    protected readonly model: ExperienceModel;
    protected readonly createSchema = ExperienceAdminCreateInputSchema;
    protected readonly updateSchema = ExperienceUpdateInputSchema;
    protected readonly searchSchema = ExperienceSearchSchema;

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
        super(config, ExperienceService.ENTITY_NAME);
        this.model = experienceModel;
        this.adminSearchSchema = ExperienceAdminSearchSchema;
        this._amenityModelInstance = new AmenityModel();
        this._featureModelInstance = new FeatureModel();
        // TYPE-WORKAROUND: concrete experience junction model bridged to the generic CommerceJunctionModel contract
        this._amenityJunctionModelInstance =
            rExperienceAmenityModel as unknown as CommerceJunctionModel<Record<string, unknown>>;
        // TYPE-WORKAROUND: concrete experience junction model bridged to the generic CommerceJunctionModel contract
        this._featureJunctionModelInstance =
            rExperienceFeatureModel as unknown as CommerceJunctionModel<Record<string, unknown>>;
    }

    // -----------------------------------------------------------------------
    // Abstract getter implementations (T-017)
    // -----------------------------------------------------------------------

    /**
     * FK column name on junction tables that references this entity.
     * Used by `syncCommerceAmenityJunction` / `syncCommerceFeatureJunction`.
     */
    protected override get _entityFkColumn(): string {
        return 'experienceId';
    }

    /** Experience-amenity junction model (satisfies {@link CommerceJunctionModel}). */
    protected override get _amenityJunctionModel(): CommerceJunctionModel<Record<string, unknown>> {
        return this._amenityJunctionModelInstance;
    }

    /** Experience-feature junction model. */
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
        checkExperienceCanCreate(actor, data);
    }

    protected _canUpdate(actor: Actor, entity: Experience): void {
        checkExperienceCanEditOwnOrAll(actor, entity);
    }

    protected _canSoftDelete(actor: Actor, entity: Experience): void {
        checkExperienceCanDelete(actor, entity);
    }

    protected _canHardDelete(actor: Actor, entity: Experience): void {
        checkExperienceCanHardDelete(actor, entity);
    }

    protected _canRestore(actor: Actor, entity: Experience): void {
        checkExperienceCanRestore(actor, entity);
    }

    protected _canView(actor: Actor, entity: Experience): void {
        checkExperienceCanView(actor);

        // Non-admin actors receive NOT_FOUND for soft-deleted listings.
        if (
            entity.deletedAt !== null &&
            entity.deletedAt !== undefined &&
            !hasPermission(actor, PermissionEnum.COMMERCE_VIEW_ALL)
        ) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Experience not found');
        }

        // Non-admin / non-owner actors receive NOT_FOUND for non-ACTIVE or PRIVATE
        // listings (mirrors AccommodationService._canView for public-read gating).
        const isOwner = entity.ownerId === actor.id;
        const isStaff = hasPermission(actor, PermissionEnum.COMMERCE_VIEW_ALL);
        if (!isOwner && !isStaff) {
            if (entity.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Experience not found');
            }
            if (entity.visibility === VisibilityEnum.PRIVATE) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Experience not found');
            }
        }
    }

    protected _canList(actor: Actor): void {
        checkExperienceCanView(actor);
    }

    protected _canSearch(actor: Actor): void {
        checkExperienceCanView(actor);
    }

    protected _canCount(actor: Actor): void {
        checkExperienceCanView(actor);
    }

    protected _canUpdateVisibility(
        actor: Actor,
        entity: Experience,
        _newVisibility: unknown
    ): void {
        checkExperienceCanEditAll(actor, entity);
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
        checkExperienceCanAdminList(actor);
    }

    // -----------------------------------------------------------------------
    // Public-tier projections (T-016)
    // -----------------------------------------------------------------------

    /**
     * Strips `adminInfo` and `ownerId` from a single entity for public-tier responses.
     *
     * Called by the base class `_executeAdminSearch` post-processing.
     *
     * @param entity - Raw experience entity from the database.
     * @returns Projected entity with private fields removed.
     */
    protected override _projectPublicEntity(entity: Experience): Experience {
        return projectExperiencePublic(entity) as Experience;
    }

    /**
     * List variant: resolves owner avatar then strips private fields.
     *
     * @param entities - Array of raw experience entities.
     * @returns Array of projected entities.
     */
    protected override _projectPublicEntityList(entities: Experience[]): Experience[] {
        return entities.map((e) => {
            const withAvatar = projectExperienceOwnerAvatar(e) ?? e;
            return this._projectPublicEntity(withAvatar);
        });
    }

    // -----------------------------------------------------------------------
    // Search execution (experience-specific filters)
    // -----------------------------------------------------------------------

    /**
     * Executes the public search query with experience-specific filter support.
     *
     * Scalar filters forwarded to the model: `type`, `destinationId`,
     * `ownerId`, `isFeatured`, `hasActiveSubscription`.
     *
     * NOTE: `amenities` / `features` (array filters requiring junction-table
     * JOINs) and `minRating` / `maxRating` are stripped here and NOT applied —
     * they require a custom SQL query that the current `ExperienceModel.findAll`
     * does not support.  Junction-level and rating range filtering is tracked as
     * a follow-up task for the search route layer.
     *
     * @param params - Validated search parameters from `ExperienceSearchSchema`.
     * @param _actor - The actor performing the action (public path; unused).
     * @param ctx - Service context for transaction propagation.
     * @returns Paginated experience listing results.
     */
    protected async _executeSearch(
        params: ExperienceSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<Experience>> {
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
        // Relations (destination, owner) are loaded so the web card transform can
        // read destinationName without an N+1 query (Bug B3 fix).
        const result = await this.model.findAllWithRelations(
            { destination: true, owner: true },
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
        return result as unknown as PaginatedListOutput<Experience>; // TYPE-WORKAROUND: base list result narrowed to the experience entity type (Drizzle row vs Zod entity, same bridge as accommodation services)
    }

    /**
     * Count query mirroring `_executeSearch` filter logic.
     *
     * @param params - Validated search parameters.
     * @param _actor - The actor performing the action.
     * @param ctx - Service context.
     * @returns Total count of matching experience listings.
     */
    protected async _executeCount(
        params: ExperienceSearch,
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
     * Experience-specific entity filters (`type`, `destinationId`,
     * `ownerId`, `isFeatured`, `hasActiveSubscription`) are plain scalars that
     * the generic admin search builder handles natively via the where-clause builder.
     *
     * @param params - Admin search parameters assembled by `adminList()`.
     * @returns Paginated list with owner-scoping and public projections applied.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<Record<string, unknown>>
    ): Promise<PaginatedListOutput<Experience>> {
        return super._executeAdminSearch(params);
    }

    // -----------------------------------------------------------------------
    // Owner operational update (T-017)
    // -----------------------------------------------------------------------

    /**
     * Owner-scoped operational update for experience listings.
     *
     * ## Enforcement contract
     *
     * 1. **Schema validation**: payload is validated with
     *    `ExperienceOwnerUpdateInputSchema`, which ONLY permits operational
     *    sections (`openingHours`, `contactInfo`, `socialNetworks`, `media`,
     *    `isPriceOnRequest`, `richDescription`, `amenityIds`, `featureIds`).
     *    Identity fields (`name`, `slug`, `type`, `priceFrom`, `priceUnit`,
     *    `destinationId`) are absent from the schema — any forged keys in the
     *    HTTP body are silently stripped.
     * 2. **Ownership check**: a non-owner receives `NOT_FOUND` to prevent
     *    existence leakage (same pattern as SPEC-169 for accommodations).
     *    Staff holding `COMMERCE_EDIT_ALL` bypass the ownership check.
     * 3. **Single permission check** (SPEC-253 D2=b): gated on `COMMERCE_EDIT_OWN`
     *    (owner) OR `COMMERCE_EDIT_ALL` (staff). The former per-section permissions
     *    are removed — one check replaces all 8 conditional gates.
     * 4. **Delegation**: passes through to `this.update()` so that junction sync
     *    (`_beforeUpdate` / `_afterUpdate`) fires for amenity/feature changes.
     *
     * @param experienceId - UUID of the experience listing to update.
     * @param data - Validated operational-only update payload.
     * @param actor - The actor performing the update.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `ServiceOutput<Experience>` wrapping the updated entity.
     */
    public async updateOwn(
        experienceId: string,
        data: ExperienceOwnerUpdateInput,
        actor: Actor,
        ctx?: ServiceContext<ExperienceHookState>
    ): Promise<ServiceOutput<Experience>> {
        try {
            // 1. Validate the payload against the owner-update schema (operational only).
            const parseResult = ExperienceOwnerUpdateInputSchema.safeParse(data);
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
            const entity = await this.model.findById(experienceId, ctx?.tx);
            if (!entity) {
                return {
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Experience listing not found'
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
                        message: 'Experience listing not found'
                    }
                };
            }

            // 4. Single permission check (SPEC-253 D2=b): COMMERCE_EDIT_OWN covers all
            //    owner-accessible sections. Staff with EDIT_ALL bypass this gate.
            if (!hasEditAll) {
                checkExperienceCanEditOwn(actor, entity);
            }

            // 5. Delegate to base update() for junction sync + hook pipeline.
            //    Owner update schema is a strict subset of the full update schema,
            //    so casting is safe here.  Base update signature: update(actor, id, data, ctx?).
            //
            //    Base update() runs _canUpdate, which is owner-aware
            //    (checkExperienceCanEditOwnOrAll: COMMERCE_EDIT_ALL OR owner +
            //    COMMERCE_EDIT_OWN). updateOwn() already enforced ownership and the
            //    single COMMERCE_EDIT_OWN gate above, and the payload was validated
            //    against the owner schema (operational fields only), so the actor
            //    passes the base gate without any privilege elevation.
            return this.update(
                actor,
                experienceId,
                validated as ExperienceUpdateInput,
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
