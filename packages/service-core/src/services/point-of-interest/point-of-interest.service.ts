import {
    DestinationModel,
    PoiCategoryModel,
    PointOfInterestModel,
    pointsOfInterest,
    RDestinationPointOfInterestModel,
    RPoiCategoryModel
} from '@repo/db';
import type {
    CountResponse,
    Destination,
    DestinationIdType,
    DestinationPointOfInterestRelation,
    PointOfInterest,
    PointOfInterestCategoryRelation,
    PointOfInterestIdType
} from '@repo/schemas';
import {
    type DestinationIdsByPointOfInterestSlugsInput,
    DestinationIdsByPointOfInterestSlugsInputSchema,
    type DestinationIdsByPointOfInterestSlugsOutput,
    type DestinationsByPointOfInterestInput,
    DestinationsByPointOfInterestInputSchema,
    type PointOfInterestAddToDestinationInput,
    PointOfInterestAddToDestinationInputSchema,
    PointOfInterestCreateInputSchema,
    PointOfInterestDestinationRelationEnum,
    type PointOfInterestListWithCountsResponse,
    type PointOfInterestRemoveFromDestinationInput,
    PointOfInterestRemoveFromDestinationInputSchema,
    type PointOfInterestSearchInput,
    PointOfInterestSearchInputSchema,
    type PointOfInterestUpdateDestinationRelationInput,
    PointOfInterestUpdateDestinationRelationInputSchema,
    PointOfInterestUpdateInputSchema,
    type PointsOfInterestByDestinationInput,
    PointsOfInterestByDestinationInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { inArray, type SQL } from 'drizzle-orm';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import {
    type Actor,
    type PaginatedListOutput,
    type ServiceConfig,
    type ServiceContext,
    ServiceError,
    type ServiceOutput
} from '../../types';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from './point-of-interest.normalizers';
import {
    checkCanAdminList,
    checkCanCreatePointOfInterest,
    checkCanDeletePointOfInterest,
    checkCanListPointsOfInterest,
    checkCanRestorePointOfInterest,
    checkCanUpdatePointOfInterest,
    checkCanViewPointOfInterest
} from './point-of-interest.permissions';

/**
 * Upper bound for the `categoryId`/`categorySlug` filter's candidate-POI
 * lookup in {@link PointOfInterestService.resolveCategoryIdFilter} (mirrors
 * `PointOfInterestCategoryService`'s `POI_CATEGORY_RELATIONS_PAGE_SIZE`
 * precedent). Without an explicit `pageSize`, `findAll` defaults to
 * `DEFAULT_PAGE_SIZE` (20), silently truncating the candidate id list once
 * more than 20 POIs share a category (HOS-139 judgment-day INFO).
 */
const POI_CATEGORY_RELATIONS_PAGE_SIZE = 200;

/**
 * Service for managing points of interest (HOS-113). Implements business
 * logic, permissions, and hooks for PointOfInterest entities, mirroring
 * `AttractionService`'s core CRUD shape. Coordinates read + destination
 * relation management + slug resolution; write access is seed-driven in
 * Phase 1 (no admin CRUD routes — HOS-113 OQ-6/NG-5), but the service
 * itself is built read+write capable so that follow-up is additive.
 *
 * @extends BaseCrudRelatedService
 */
export class PointOfInterestService extends BaseCrudRelatedService<
    PointOfInterest,
    PointOfInterestModel,
    RDestinationPointOfInterestModel,
    typeof PointOfInterestCreateInputSchema,
    typeof PointOfInterestUpdateInputSchema,
    typeof PointOfInterestSearchInputSchema
> {
    static readonly ENTITY_NAME = 'pointOfInterest';
    protected readonly entityName = PointOfInterestService.ENTITY_NAME;
    public readonly model: PointOfInterestModel;

    public readonly createSchema = PointOfInterestCreateInputSchema;
    public readonly updateSchema = PointOfInterestUpdateInputSchema;
    public readonly searchSchema = PointOfInterestSearchInputSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * Returns the columns to search against when the `search` query param is
     * provided. Points of interest are searched by `slug` and `description`
     * — there is NO `name` column (HOS-113 OQ-2).
     */
    protected override getSearchableColumns(): string[] {
        return ['slug', 'description'];
    }

    protected readonly destinationModel: DestinationModel;
    /**
     * Category catalog model, used to resolve `categorySlug` search filters
     * to a `categoryId` (HOS-139 spec §6.5/§7.2). Injectable for tests,
     * mirroring `destinationModel`'s optional-constructor-param shape.
     */
    protected readonly categoryModel: PoiCategoryModel;
    /**
     * `r_poi_category` join model, used to resolve the `categoryId`/
     * `categorySlug` search filter to an `id IN (...)` condition (HOS-139
     * spec §6.5) — mirrors `relatedModel`'s (`r_destination_point_of_interest`)
     * role for the `destinationId` filter, but is a SEPARATE model since a
     * POI's category relation is unrelated to its destination relation.
     */
    protected readonly categoryRelatedModel: RPoiCategoryModel;
    protected normalizers: CrudNormalizersFromSchemas<
        typeof PointOfInterestCreateInputSchema,
        typeof PointOfInterestUpdateInputSchema,
        typeof PointOfInterestSearchInputSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    };

    constructor(
        ctx: ServiceConfig,
        model?: PointOfInterestModel,
        relatedModel?: RDestinationPointOfInterestModel,
        destinationModel?: DestinationModel,
        categoryModel?: PoiCategoryModel,
        categoryRelatedModel?: RPoiCategoryModel
    ) {
        super(ctx, PointOfInterestService.ENTITY_NAME, relatedModel);
        this.model = model ?? new PointOfInterestModel();
        this.destinationModel = destinationModel ?? new DestinationModel();
        this.categoryModel = categoryModel ?? new PoiCategoryModel();
        this.categoryRelatedModel = categoryRelatedModel ?? new RPoiCategoryModel();
    }

    protected _canCreate(actor: Actor): void {
        checkCanCreatePointOfInterest(actor);
    }
    protected _canUpdate(actor: Actor): void {
        checkCanUpdatePointOfInterest(actor);
    }
    protected _canDelete(actor: Actor): void {
        checkCanDeletePointOfInterest(actor);
    }
    protected _canView(actor: Actor): void {
        checkCanViewPointOfInterest(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanListPointsOfInterest(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanListPointsOfInterest(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanListPointsOfInterest(actor);
    }
    protected _canSoftDelete(actor: Actor): void {
        checkCanDeletePointOfInterest(actor);
    }
    protected _canHardDelete(actor: Actor): void {
        checkCanDeletePointOfInterest(actor);
    }
    protected _canRestore(actor: Actor): void {
        checkCanRestorePointOfInterest(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: PointOfInterest,
        _newVisibility?: unknown
    ): void {
        checkCanUpdatePointOfInterest(actor);
    }
    protected _canAddPointOfInterestToDestination(actor: Actor): void {
        checkCanCreatePointOfInterest(actor);
    }
    protected _canRemovePointOfInterestFromDestination(actor: Actor): void {
        checkCanDeletePointOfInterest(actor);
    }
    /**
     * Permission hook for {@link updatePointOfInterestDestinationRelation}
     * (HOS-143 T-005, Decision 1). Deliberately delegates to
     * `checkCanUpdatePointOfInterest` — the same `POINT_OF_INTEREST_UPDATE`
     * checker used by `_canUpdate` — rather than introducing a dedicated
     * `DESTINATION_POINT_OF_INTEREST_MANAGE` permission, to keep this file's
     * `POINT_OF_INTEREST_*`-only consistency (see
     * `point-of-interest.permissions.ts`'s file-level deviation note).
     */
    protected _canUpdatePointOfInterestDestinationRelation(actor: Actor): void {
        checkCanUpdatePointOfInterest(actor);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    protected createDefaultRelatedModel(): RDestinationPointOfInterestModel {
        return new RDestinationPointOfInterestModel();
    }

    /**
     * Adds a point of interest to a destination, ensuring validation,
     * permissions, and uniqueness (HOS-113 OQ-1, M2M). Optimized to run
     * existence checks in parallel. Mirrors
     * `AttractionService.addAttractionToDestination`.
     * @param actor - The actor performing the action
     * @param params - The params required to add the POI to the destination
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async addPointOfInterestToDestination(
        actor: Actor,
        params: PointOfInterestAddToDestinationInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ relation: DestinationPointOfInterestRelation }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addPointOfInterestToDestination',
            input: { ...params, actor },
            schema: PointOfInterestAddToDestinationInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canAddPointOfInterestToDestination(actor);
                const {
                    destinationId,
                    pointOfInterestId,
                    relation: relationKind
                } = validatedParams;

                // Run all existence checks in parallel for better performance
                const [pointOfInterest, destination, existing] = await Promise.all([
                    this.model.findOne({ id: pointOfInterestId as PointOfInterestIdType }),
                    this.destinationModel.findOne({ id: destinationId as DestinationIdType }),
                    this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        pointOfInterestId: pointOfInterestId as PointOfInterestIdType
                    })
                ]);

                if (!pointOfInterest) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest not found'
                    );
                }
                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'Point of interest already added to destination'
                    );
                }

                // Create the relation (HOS-140: relationKind defaults to
                // PRIMARY in the Zod schema when omitted)
                const relation = await this.relatedModel.create({
                    destinationId: destinationId as DestinationIdType,
                    pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                    relation: relationKind
                });

                // If the model returns just an id or number, fetch the full relation
                let fullRelation = relation;
                if (typeof relation === 'number' || typeof relation === 'string' || !relation) {
                    const found = await this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        pointOfInterestId: pointOfInterestId as PointOfInterestIdType
                    });
                    if (!found) {
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Failed to create relation'
                        );
                    }
                    fullRelation = found;
                }
                return { relation: fullRelation as DestinationPointOfInterestRelation };
            }
        });
    }

    /**
     * Removes a point of interest from a destination.
     * @param actor - The actor performing the action
     * @param params - The params required to remove the POI from the destination
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async removePointOfInterestFromDestination(
        actor: Actor,
        params: PointOfInterestRemoveFromDestinationInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ relation: DestinationPointOfInterestRelation }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removePointOfInterestFromDestination',
            input: { ...params, actor },
            schema: PointOfInterestRemoveFromDestinationInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canRemovePointOfInterestFromDestination(actor);
                const { destinationId, pointOfInterestId } = validatedParams;
                // Verify point of interest exists
                const pointOfInterest = await this.model.findOne({
                    id: pointOfInterestId as PointOfInterestIdType
                });
                if (!pointOfInterest) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest not found'
                    );
                }
                const destination = await this.destinationModel.findOne({
                    id: destinationId as DestinationIdType
                });
                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }
                // Verify that the relation exists
                const existing = await this.relatedModel.findOne({
                    destinationId: destinationId as DestinationIdType,
                    pointOfInterestId: pointOfInterestId as PointOfInterestIdType
                });
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest relation not found for this destination'
                    );
                }
                // Remove the relation (soft delete)
                const relation = await this.relatedModel.softDelete({
                    destinationId: destinationId as DestinationIdType,
                    pointOfInterestId: pointOfInterestId as PointOfInterestIdType
                });
                if (typeof relation === 'number' || typeof relation === 'string' || !relation) {
                    const fullRelation = await this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        pointOfInterestId: pointOfInterestId as PointOfInterestIdType
                    });
                    if (!fullRelation) {
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Failed to remove relation'
                        );
                    }
                    return { relation: fullRelation };
                }
                if (!relation) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to remove relation'
                    );
                }
                return { relation: relation as DestinationPointOfInterestRelation };
            }
        });
    }

    /**
     * Updates the `relation` kind (`PRIMARY`/`NEARBY`, HOS-140) of an
     * EXISTING point-of-interest-destination link (HOS-143 T-005). Mirrors
     * {@link addPointOfInterestToDestination}'s parallel existence-check
     * shape, but never creates the relation row — if the POI, the
     * destination, or the relation itself does not already exist, this
     * throws `NOT_FOUND` rather than silently creating it (AC-4). Use
     * {@link addPointOfInterestToDestination} to create a new link.
     * @param actor - The actor performing the action
     * @param params - The destination/POI pair and the new `relation` kind
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async updatePointOfInterestDestinationRelation(
        actor: Actor,
        params: PointOfInterestUpdateDestinationRelationInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ relation: DestinationPointOfInterestRelation }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updatePointOfInterestDestinationRelation',
            input: { ...params, actor },
            schema: PointOfInterestUpdateDestinationRelationInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canUpdatePointOfInterestDestinationRelation(actor);
                const {
                    destinationId,
                    pointOfInterestId,
                    relation: relationKind
                } = validatedParams;

                // Run all existence checks in parallel for better performance
                const [pointOfInterest, destination, existing] = await Promise.all([
                    this.model.findOne({ id: pointOfInterestId as PointOfInterestIdType }),
                    this.destinationModel.findOne({ id: destinationId as DestinationIdType }),
                    this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        pointOfInterestId: pointOfInterestId as PointOfInterestIdType
                    })
                ]);

                if (!pointOfInterest) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest not found'
                    );
                }
                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest relation not found for this destination'
                    );
                }

                // Update the relation kind. Does NOT create the row — the
                // existence check above guarantees it already exists (AC-4).
                const relation = await this.relatedModel.update(
                    {
                        destinationId: destinationId as DestinationIdType,
                        pointOfInterestId: pointOfInterestId as PointOfInterestIdType
                    },
                    { relation: relationKind }
                );

                // If the model returns just an id or number, fetch the full relation
                let fullRelation = relation;
                if (typeof relation === 'number' || typeof relation === 'string' || !relation) {
                    const found = await this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        pointOfInterestId: pointOfInterestId as PointOfInterestIdType
                    });
                    if (!found) {
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Failed to update relation'
                        );
                    }
                    fullRelation = found;
                }
                return { relation: fullRelation as DestinationPointOfInterestRelation };
            }
        });
    }

    /**
     * Lists all points of interest for a destination.
     * Optimized to use parallel queries instead of sequential ones.
     *
     * HOS-140 AC-4: each returned entry carries its own `relation`
     * (`PRIMARY`/`NEARBY`), mirroring `DestinationModel.getPointsOfInterestMap`'s
     * per-row `relation` — otherwise a caller requesting `relation: 'ALL'`
     * would have no way to distinguish which entries are PRIMARY vs NEARBY.
     * @param actor - The actor performing the action
     * @param params - The params containing the destination ID
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async getPointsOfInterestForDestination(
        actor: Actor,
        params: PointsOfInterestByDestinationInput,
        ctx?: ServiceContext
    ): Promise<
        ServiceOutput<{
            pointsOfInterest: Array<
                PointOfInterest & { relation: PointOfInterestDestinationRelationEnum }
            >;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getPointsOfInterestForDestination',
            input: { ...params, actor },
            schema: PointsOfInterestByDestinationInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canList(actor);
                const { destinationId, relation } = validatedParams;

                // Run existence check and data fetch in parallel. HOS-140:
                // default 'PRIMARY' is behavior-preserving for every row
                // that existed before this spec; 'ALL' drops the filter
                // entirely, 'NEARBY' is the explicit opt-in.
                const [destination, relationsResult] = await Promise.all([
                    this.destinationModel.findOne({
                        id: destinationId as DestinationIdType
                    }),
                    this.relatedModel.findAll({
                        destinationId,
                        ...(relation !== 'ALL' && { relation })
                    })
                ]);

                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }

                const { items: relations } = relationsResult;

                // If no relations, return empty array early
                if (relations.length === 0) {
                    return { pointsOfInterest: [] };
                }

                const poiIds = relations.map(
                    (r: DestinationPointOfInterestRelation) => r.pointOfInterestId
                );

                // HOS-140 AC-4: map each POI id to its relation kind. The PK
                // on `r_destination_point_of_interest` (destinationId,
                // pointOfInterestId) guarantees exactly one row — and thus
                // exactly one relation — per POI id for this destination.
                const relationByPoiId = new Map<string, PointOfInterestDestinationRelationEnum>();
                for (const r of relations) {
                    relationByPoiId.set(
                        r.pointOfInterestId as string,
                        r.relation as PointOfInterestDestinationRelationEnum
                    );
                }

                // Fetch all points of interest in one query, sorted by displayWeight DESC
                const { items: pointsOfInterest } = await this.model.findAll({ id: poiIds });
                const withRelation = pointsOfInterest.map((poi) => ({
                    ...poi,
                    relation:
                        relationByPoiId.get(poi.id as string) ??
                        PointOfInterestDestinationRelationEnum.PRIMARY
                }));
                const sorted = withRelation.sort(
                    (a, b) => (b.displayWeight ?? 50) - (a.displayWeight ?? 50)
                );
                return { pointsOfInterest: sorted };
            }
        });
    }

    /**
     * Lists all destinations for a given point of interest (HOS-113 OQ-1 —
     * M2M, so a POI may legitimately map to more than one destination).
     * Optimized to use parallel queries instead of sequential ones.
     *
     * HOS-140 relation-awareness decision: deliberately left relation-blind
     * (returns destinations for BOTH `PRIMARY` and `NEARBY` rows). Unlike
     * {@link getPointsOfInterestForDestination} (where surfacing a NEARBY
     * row would silently make a POI look like it belongs to a destination it
     * doesn't), the reverse question — "which destinations reference this
     * POI at all" — is symmetric: a `NEARBY` row IS a real, intentional
     * cross-reference, so excluding it here would hide a legitimate
     * association rather than prevent an incorrect one. No known caller
     * needs relation-blind vs relation-aware behavior distinguished yet; if
     * one does, add an opt-in `relation` param mirroring
     * {@link getPointsOfInterestForDestination}'s 3-value contract rather
     * than changing this method's default.
     * @param actor - The actor performing the action
     * @param params - The params containing the point of interest ID
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async getDestinationsByPointOfInterest(
        actor: Actor,
        params: DestinationsByPointOfInterestInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ destinations: Destination[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getDestinationsByPointOfInterest',
            input: { ...params, actor },
            schema: DestinationsByPointOfInterestInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canList(actor);
                const { pointOfInterestId } = validatedParams;

                // Run existence check and data fetch in parallel
                const [pointOfInterest, relationsResult] = await Promise.all([
                    this.model.findOne({
                        id: pointOfInterestId as PointOfInterestIdType
                    }),
                    this.relatedModel.findAll({ pointOfInterestId })
                ]);

                if (!pointOfInterest) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest not found'
                    );
                }

                const { items: relations } = relationsResult;

                // If no relations, return empty array early
                if (relations.length === 0) {
                    return { destinations: [] };
                }

                const destinationIds = relations.map(
                    (r: DestinationPointOfInterestRelation) => r.destinationId
                );

                // Fetch all destinations in one query
                const { items: destinations } = await this.destinationModel.findAll({
                    id: destinationIds
                });
                return { destinations };
            }
        });
    }

    /**
     * Bulk-resolves point-of-interest SLUGS (not a single UUID) to the
     * destinations that have them, via `r_destination_point_of_interest`
     * (HOS-113 §6.2/§6.3 — accommodation proximity search and AI search
     * resolution entry point). Consumed by the AI search-chat handler and
     * the `resolvePoiToCoordinates` helper (Phase 2/3), which only have
     * NL-matched slugs from a curated allowlist, never a pre-resolved POI
     * UUID — this is the slug-bulk sibling of
     * {@link getDestinationsByPointOfInterest} (single UUID, paginated).
     * Mirrors `AttractionService.getDestinationIdsByAttractionSlugs`
     * exactly.
     *
     * @param actor - The actor performing the action.
     * @param params - The params containing the point-of-interest slugs to resolve.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns De-duplicated destination UUIDs (never throws NOT_FOUND — an
     *   unmatched slug or a destination-less POI simply yields fewer, or
     *   zero, ids; the caller treats an empty result as "skip constraint").
     */
    public async getDestinationIdsByPointOfInterestSlugs(
        actor: Actor,
        params: DestinationIdsByPointOfInterestSlugsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DestinationIdsByPointOfInterestSlugsOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getDestinationIdsByPointOfInterestSlugs',
            input: { ...params, actor },
            schema: DestinationIdsByPointOfInterestSlugsInputSchema,
            ctx,
            execute: async (validatedParams, _actor, resolvedCtx) => {
                await this._canList(actor);
                const destinationIds = await this.model.findDestinationIdsBySlugs(
                    validatedParams.slugs,
                    resolvedCtx.tx
                );
                return { destinationIds };
            }
        });
    }

    /**
     * Builds the plain `where` object for search/count/searchForList.
     *
     * Deliberately EXCLUDES `destinationId` — `points_of_interest` has no
     * `destinationId` column (the relation is M2M via
     * `r_destination_point_of_interest`, HOS-113 OQ-1). Passing it through
     * to `buildWhereClause` would either throw `DbError` (unknown column,
     * when it's the only filter) or be silently dropped (when combined with
     * another known filter), returning POIs across ALL destinations. See
     * {@link resolveDestinationIdFilter} for how `destinationId` is applied
     * instead, as an `id IN (...)` additional condition.
     *
     * @param params - Search params containing the plain-column filters.
     * @returns A `where` object safe to pass to `model.findAll`/`model.count`.
     */
    private buildSearchWhere(
        params: Pick<
            PointOfInterestSearchInput,
            'slug' | 'type' | 'isFeatured' | 'isBuiltin' | 'hasOwnPage' | 'verified'
        >
    ): Record<string, unknown> {
        const { slug, type, isFeatured, isBuiltin, hasOwnPage, verified } = params;
        const where: Record<string, unknown> = {};
        if (slug) where.slug = slug;
        if (type) where.type = type;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;
        // HOS-143 T-007: `hasOwnPage`/`verified` are real plain columns
        // (HOS-138), same passthrough pattern as `isFeatured`/`isBuiltin`.
        if (typeof hasOwnPage === 'boolean') where.hasOwnPage = hasOwnPage;
        if (typeof verified === 'boolean') where.verified = verified;
        return where;
    }

    /**
     * Resolves a `destinationId` search filter to an `id IN (...)`
     * additional SQL condition, via the `r_destination_point_of_interest`
     * join table (HOS-113 OQ-1 — POIs have no `destinationId` column).
     *
     * Reuses the same relation lookup as
     * {@link getPointsOfInterestForDestination}: query the join table for
     * every `pointOfInterestId` mapped to the destination, then constrain
     * the main query with `inArray(pointsOfInterest.id, ids)`.
     *
     * @param destinationId - The destination id filter from search params,
     *   if any.
     * @param relation - The relation-kind constraint applied to the join
     *   lookup (HOS-140). Defaults to `'PRIMARY'` — searching "POIs in
     *   destination X" must NOT surface a landmark that is merely nearby X
     *   unless explicitly asked for.
     * @returns `{ empty: true }` when `destinationId` was provided but maps
     *   to zero points of interest (callers MUST short-circuit to an empty
     *   result rather than falling through to an unfiltered query).
     *   `{ empty: false, additionalConditions: [] }` when no `destinationId`
     *   filter was requested. `{ empty: false, additionalConditions: [SQL] }`
     *   otherwise, containing the `id IN (...)` condition to combine with
     *   the plain `where` object.
     */
    private async resolveDestinationIdFilter(
        destinationId: string | undefined,
        relation: 'PRIMARY' | 'NEARBY' | 'ALL' = 'PRIMARY'
    ): Promise<{ empty: boolean; additionalConditions: SQL[] }> {
        if (!destinationId) {
            return { empty: false, additionalConditions: [] };
        }
        const { items: relations } = await this.relatedModel.findAll({
            destinationId,
            ...(relation !== 'ALL' && { relation })
        });
        if (relations.length === 0) {
            return { empty: true, additionalConditions: [] };
        }
        const poiIds = relations.map(
            (r: DestinationPointOfInterestRelation) => r.pointOfInterestId as string
        );
        return { empty: false, additionalConditions: [inArray(pointsOfInterest.id, poiIds)] };
    }

    /**
     * Resolves a `categoryId`/`categorySlug` search filter to an
     * `id IN (...)` additional SQL condition, via the `r_poi_category` join
     * table (HOS-139 spec §6.5 — the new category taxonomy is M2M, resolved
     * through the join, alongside — not replacing — the legacy `type` plain
     * column filter in {@link buildSearchWhere}).
     *
     * Mirrors {@link resolveDestinationIdFilter}'s shape exactly, with one
     * addition: `categorySlug` is resolved to a `categoryId` first (via
     * {@link categoryModel}) when `categoryId` itself was not provided.
     *
     * @param categoryId - The category id filter from search params, if any.
     * @param categorySlug - The category slug filter from search params, if
     *   any. Ignored when `categoryId` is also provided (id wins).
     * @returns `{ empty: true }` when a category filter was provided but
     *   maps to zero points of interest (or an unmatched `categorySlug`) —
     *   callers MUST short-circuit to an empty result. `{ empty: false,
     *   additionalConditions: [] }` when no category filter was requested.
     *   `{ empty: false, additionalConditions: [SQL] }` otherwise.
     */
    private async resolveCategoryIdFilter(
        categoryId: string | undefined,
        categorySlug: string | undefined
    ): Promise<{ empty: boolean; additionalConditions: SQL[] }> {
        if (!categoryId && !categorySlug) {
            return { empty: false, additionalConditions: [] };
        }

        let resolvedCategoryId = categoryId;
        if (!resolvedCategoryId && categorySlug) {
            const category = await this.categoryModel.findOne({ slug: categorySlug });
            if (!category) {
                return { empty: true, additionalConditions: [] };
            }
            resolvedCategoryId = category.id;
        }

        const { items: relations } = await this.categoryRelatedModel.findAll(
            { categoryId: resolvedCategoryId },
            { pageSize: POI_CATEGORY_RELATIONS_PAGE_SIZE }
        );
        if (relations.length === 0) {
            return { empty: true, additionalConditions: [] };
        }
        const poiIds = relations.map(
            (r: PointOfInterestCategoryRelation) => r.pointOfInterestId as string
        );
        return { empty: false, additionalConditions: [inArray(pointsOfInterest.id, poiIds)] };
    }

    /**
     * Resolves BOTH the `destinationId` and `categoryId`/`categorySlug`
     * join-table filters in parallel and merges them into a single
     * `additionalConditions` array (AND-combined by the caller's
     * `model.findAll`/`count`, so a POI must satisfy every provided
     * relation filter simultaneously).
     *
     * @param params - The `destinationId`/`categoryId`/`categorySlug`
     *   filters from search params.
     * @returns `{ empty: true }` when ANY relation filter resolved to zero
     *   matches — callers MUST short-circuit to an empty result.
     */
    private async resolveRelationFilters(params: {
        destinationId: string | undefined;
        categoryId: string | undefined;
        categorySlug: string | undefined;
    }): Promise<{ empty: boolean; additionalConditions: SQL[] }> {
        const [destinationResult, categoryResult] = await Promise.all([
            this.resolveDestinationIdFilter(params.destinationId),
            this.resolveCategoryIdFilter(params.categoryId, params.categorySlug)
        ]);
        if (destinationResult.empty || categoryResult.empty) {
            return { empty: true, additionalConditions: [] };
        }
        return {
            empty: false,
            additionalConditions: [
                ...destinationResult.additionalConditions,
                ...categoryResult.additionalConditions
            ]
        };
    }

    protected async _executeSearch(
        params: PointOfInterestSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<PointOfInterest>> {
        const where = this.buildSearchWhere(params);
        const { empty, additionalConditions } = await this.resolveRelationFilters({
            destinationId: params.destinationId,
            categoryId: params.categoryId,
            categorySlug: params.categorySlug
        });
        if (empty) {
            return { items: [], total: 0 };
        }
        const { items, total } = await this.model.findAll(where, undefined, additionalConditions);
        return { items, total };
    }

    protected async _executeCount(
        params: PointOfInterestSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<CountResponse> {
        const where = this.buildSearchWhere(params);
        const { empty, additionalConditions } = await this.resolveRelationFilters({
            destinationId: params.destinationId,
            categoryId: params.categoryId,
            categorySlug: params.categorySlug
        });
        if (empty) {
            return { count: 0 };
        }
        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }

    /**
     * Searches for points of interest with destination counts.
     * Fetches all counts in a single query using aggregation.
     * @param actor - The actor performing the action
     * @param params - The search parameters
     * @param _ctx - Optional service context carrying transaction and hookState.
     * @returns Points of interest with destination counts in standardized pagination format
     */
    public async searchForList(
        actor: Actor,
        params: PointOfInterestSearchInput,
        _ctx?: ServiceContext
    ): Promise<PointOfInterestListWithCountsResponse> {
        await this._canSearch(actor);
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;

        const where = this.buildSearchWhere(params);
        const { empty, additionalConditions } = await this.resolveRelationFilters({
            destinationId: params.destinationId,
            categoryId: params.categoryId,
            categorySlug: params.categorySlug
        });

        const buildEmptyPage = (total: number) => ({
            data: [],
            pagination: {
                page,
                pageSize,
                total,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false
            }
        });
        if (empty) {
            return buildEmptyPage(0);
        }

        const { items, total } = await this.model.findAll(
            where,
            { page, pageSize },
            additionalConditions
        );

        // If no items, return early
        if (items.length === 0) {
            return buildEmptyPage(total);
        }

        // Get all POI IDs from the current page
        const poiIds = items.map((item) => item.id);

        // Fetch all relations for these POIs in a single query
        const { items: allRelations } = await this.relatedModel.findAll({
            pointOfInterestId: poiIds
        });

        // Build a map of POI ID to count
        const countMap = new Map<string, number>();
        for (const relation of allRelations) {
            const poiId = relation.pointOfInterestId as string;
            countMap.set(poiId, (countMap.get(poiId) ?? 0) + 1);
        }

        // Merge counts with points of interest
        const itemsWithCounts = items.map((poi) => ({
            ...poi,
            destinationCount: countMap.get(poi.id as string) ?? 0
        }));

        return {
            data: itemsWithCounts,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
                hasNextPage: page * pageSize < total,
                hasPreviousPage: page > 1
            }
        };
    }
}
