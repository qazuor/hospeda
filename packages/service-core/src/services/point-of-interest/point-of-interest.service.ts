import { DestinationModel, PointOfInterestModel, RDestinationPointOfInterestModel } from '@repo/db';
import type { CountResponse, PointOfInterest } from '@repo/schemas';
import {
    PointOfInterestCreateInputSchema,
    type PointOfInterestListWithCountsResponse,
    type PointOfInterestSearchInput,
    PointOfInterestSearchInputSchema,
    PointOfInterestUpdateInputSchema
} from '@repo/schemas';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../types';
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
        destinationModel?: DestinationModel
    ) {
        super(ctx, PointOfInterestService.ENTITY_NAME, relatedModel);
        this.model = model ?? new PointOfInterestModel();
        this.destinationModel = destinationModel ?? new DestinationModel();
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

    protected async _executeSearch(
        params: PointOfInterestSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<PointOfInterest>> {
        const { slug, type, isFeatured, isBuiltin, destinationId } = params;
        const where: Record<string, unknown> = {};
        if (slug) where.slug = slug;
        if (type) where.type = type;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;
        if (destinationId) where.destinationId = destinationId;
        const { items, total } = await this.model.findAll(where);
        return { items, total };
    }

    protected async _executeCount(
        params: PointOfInterestSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<CountResponse> {
        const { slug, type, isFeatured, isBuiltin, destinationId } = params;
        const where: Record<string, unknown> = {};
        if (slug) where.slug = slug;
        if (type) where.type = type;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;
        if (destinationId) where.destinationId = destinationId;
        const count = await this.model.count(where);
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
        const { slug, type, isFeatured, isBuiltin, destinationId } = params;
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;

        const where: Record<string, unknown> = {};
        if (slug) where.slug = slug;
        if (type) where.type = type;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;
        if (destinationId) where.destinationId = destinationId;

        const { items, total } = await this.model.findAll(where, { page, pageSize });

        // If no items, return early
        if (items.length === 0) {
            return {
                data: [],
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };
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
