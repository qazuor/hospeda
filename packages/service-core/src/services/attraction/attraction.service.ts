import { AttractionModel, DestinationModel, RDestinationAttractionModel } from '@repo/db';
import type {
    Attraction,
    AttractionIdType,
    Destination,
    DestinationAttractionRelation,
    DestinationIdType
} from '@repo/schemas';
import {
    type AttractionAddToDestinationInput,
    AttractionAddToDestinationInputSchema,
    AttractionAdminSearchSchema,
    type AttractionCreateInput,
    AttractionCreateInputSchema,
    type AttractionListWithCountsResponse,
    type AttractionRemoveFromDestinationInput,
    AttractionRemoveFromDestinationInputSchema,
    type AttractionSearchInput,
    AttractionSearchInputSchema,
    type AttractionUpdateInput,
    AttractionUpdateInputSchema,
    type AttractionsByDestinationInput,
    AttractionsByDestinationInputSchema,
    type CountResponse,
    type DestinationsByAttractionInput,
    DestinationsByAttractionInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import {
    type Actor,
    type PaginatedListOutput,
    type ServiceContext,
    ServiceError,
    type ServiceOutput
} from '../../types';
import { generateAttractionSlug } from './attraction.helpers';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from './attraction.normalizers';
import {
    checkCanAdminList,
    checkCanCreateAttraction,
    checkCanDeleteAttraction,
    checkCanListAttractions,
    checkCanUpdateAttraction,
    checkCanViewAttraction
} from './attraction.permissions';

/**
 * Service for managing attractions. Implements business logic, permissions, and hooks for Attraction entities.
 * @extends BaseCrudRelatedService
 */
export class AttractionService extends BaseCrudRelatedService<
    Attraction,
    AttractionModel,
    RDestinationAttractionModel,
    typeof AttractionCreateInputSchema,
    typeof AttractionUpdateInputSchema,
    typeof AttractionSearchInputSchema
> {
    static readonly ENTITY_NAME = 'attraction';
    protected readonly entityName = AttractionService.ENTITY_NAME;
    public readonly model: AttractionModel;

    public readonly createSchema = AttractionCreateInputSchema;
    public readonly updateSchema = AttractionUpdateInputSchema;
    public readonly searchSchema = AttractionSearchInputSchema;
    /**
     * Admin search schema for attraction list filtering.
     * Uses default _executeAdminSearch() because all entity-specific filter fields
     * map directly to table column names (no JSONB extraction, field renames, or range filters needed).
     */
    protected readonly adminSearchSchema = AttractionAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Attractions are searched by name and description.
     */
    protected override getSearchableColumns(): string[] {
        return ['name', 'description'];
    }

    protected readonly destinationModel: DestinationModel;
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    };

    constructor(
        ctx: ServiceContext,
        model?: AttractionModel,
        relatedModel?: RDestinationAttractionModel,
        destinationModel?: DestinationModel
    ) {
        super(ctx, AttractionService.ENTITY_NAME, relatedModel);
        this.model = model ?? new AttractionModel();
        this.destinationModel = destinationModel ?? new DestinationModel();
    }

    /**
     * Lifecycle hook: normalizes input and generates slug before creating an attraction.
     * If slug is not provided, generates a unique slug from the name.
     */
    protected async _beforeCreate(
        data: AttractionCreateInput,
        _actor: Actor
    ): Promise<Partial<Attraction>> {
        let slug = (data as { slug?: string }).slug;
        if (!slug && data.name) {
            slug = await generateAttractionSlug(data.name, this.model);
        }
        return { ...data, slug };
    }

    /**
     * Lifecycle hook: normalizes input and generates slug before updating an attraction.
     * If name is updated and slug is not provided, generates a new unique slug.
     */
    protected async _beforeUpdate(
        data: AttractionUpdateInput,
        _actor: Actor
    ): Promise<Partial<Attraction>> {
        let slug = (data as { slug?: string }).slug;
        if (!slug && data.name) {
            let entity: Attraction | undefined = undefined;
            if ('id' in data && data.id) {
                const found = await this.model.findById(data.id as AttractionIdType);
                entity = found ?? undefined;
            }
            if (!entity || (entity && data.name !== entity.name)) {
                slug = await generateAttractionSlug(data.name, this.model);
            }
        }
        return { ...data, slug };
    }

    protected _canCreate(actor: Actor): void {
        checkCanCreateAttraction(actor);
    }
    protected _canUpdate(actor: Actor): void {
        checkCanUpdateAttraction(actor);
    }
    protected _canDelete(actor: Actor): void {
        checkCanDeleteAttraction(actor);
    }
    protected _canView(actor: Actor): void {
        checkCanViewAttraction(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanListAttractions(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanListAttractions(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanListAttractions(actor);
    }
    protected _canSoftDelete(actor: Actor): void {
        checkCanDeleteAttraction(actor);
    }
    protected _canHardDelete(actor: Actor): void {
        checkCanDeleteAttraction(actor);
    }
    protected _canRestore(actor: Actor): void {
        checkCanUpdateAttraction(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: Attraction,
        _newVisibility?: unknown
    ): void {
        checkCanUpdateAttraction(actor);
    }
    protected _canAddAttractionToDestination(actor: Actor): void {
        checkCanCreateAttraction(actor);
    }
    protected _canRemoveAttractionFromDestination(actor: Actor): void {
        checkCanDeleteAttraction(actor);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    protected createDefaultRelatedModel(): RDestinationAttractionModel {
        return new RDestinationAttractionModel();
    }

    /**
     * Adds an attraction to a destination, ensuring validation, permissions, and uniqueness.
     * Optimized to run existence checks in parallel.
     */
    public async addAttractionToDestination(
        actor: Actor,
        params: AttractionAddToDestinationInput
    ): Promise<ServiceOutput<{ relation: DestinationAttractionRelation }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addAttractionToDestination',
            input: { ...params, actor },
            schema: AttractionAddToDestinationInputSchema,
            execute: async (validatedParams, actor) => {
                await this._canAddAttractionToDestination(actor);
                const { destinationId, attractionId } = validatedParams;

                // Run all existence checks in parallel for better performance
                const [attraction, destination, existing] = await Promise.all([
                    this.model.findOne({ id: attractionId as AttractionIdType }),
                    this.destinationModel.findOne({ id: destinationId as DestinationIdType }),
                    this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        attractionId: attractionId as AttractionIdType
                    })
                ]);

                if (!attraction) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Attraction not found');
                }
                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'Attraction already added to destination'
                    );
                }

                // Create the relation
                const relation = await this.relatedModel.create({
                    destinationId: destinationId as DestinationIdType,
                    attractionId: attractionId as AttractionIdType
                });

                // If the model returns just an id or number, fetch the full relation
                let fullRelation = relation;
                if (typeof relation === 'number' || typeof relation === 'string' || !relation) {
                    const found = await this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        attractionId: attractionId as AttractionIdType
                    });
                    if (!found) {
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Failed to create relation'
                        );
                    }
                    fullRelation = found;
                }
                return { relation: fullRelation as DestinationAttractionRelation };
            }
        });
    }

    /**
     * Removes an attraction from a destination.
     */
    public async removeAttractionFromDestination(
        actor: Actor,
        params: AttractionRemoveFromDestinationInput
    ): Promise<ServiceOutput<{ relation: DestinationAttractionRelation }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeAttractionFromDestination',
            input: { ...params, actor },
            schema: AttractionRemoveFromDestinationInputSchema,
            execute: async (validatedParams, actor) => {
                await this._canRemoveAttractionFromDestination(actor);
                const { destinationId, attractionId } = validatedParams;
                // Verify attraction exists
                const attraction = await this.model.findOne({
                    id: attractionId as AttractionIdType
                });
                if (!attraction) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Attraction not found');
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
                    attractionId: attractionId as AttractionIdType
                });
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Attraction relation not found for this destination'
                    );
                }
                // Remove the relation (soft delete or delete)
                const relation = await this.relatedModel.softDelete({
                    destinationId: destinationId as DestinationIdType,
                    attractionId: attractionId as AttractionIdType
                });
                if (typeof relation === 'number' || typeof relation === 'string' || !relation) {
                    const fullRelation = await this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        attractionId: attractionId as AttractionIdType
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
                return { relation: relation as DestinationAttractionRelation };
            }
        });
    }

    /**
     * Lists all attractions for a destination.
     * Optimized to use a single JOIN query instead of 2 sequential queries.
     */
    public async getAttractionsForDestination(
        actor: Actor,
        params: AttractionsByDestinationInput
    ): Promise<ServiceOutput<{ attractions: Attraction[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAttractionsForDestination',
            input: { ...params, actor },
            schema: AttractionsByDestinationInputSchema,
            execute: async (validatedParams, actor) => {
                await this._canList(actor);
                const { destinationId } = validatedParams;

                // Run existence check and data fetch in parallel
                const [destination, relationsResult] = await Promise.all([
                    this.destinationModel.findOne({
                        id: destinationId as DestinationIdType
                    }),
                    this.relatedModel.findAll({ destinationId })
                ]);

                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }

                const { items: relations } = relationsResult;

                // If no relations, return empty array early
                if (relations.length === 0) {
                    return { attractions: [] };
                }

                const attractionIds = relations.map(
                    (r: DestinationAttractionRelation) => r.attractionId
                );

                // Fetch all attractions in one query, sorted by displayWeight DESC
                const { items: attractions } = await this.model.findAll({ id: attractionIds });
                const sorted = [...attractions].sort(
                    (a, b) => (b.displayWeight ?? 50) - (a.displayWeight ?? 50)
                );
                return { attractions: sorted };
            }
        });
    }

    /**
     * Lists all destinations for a given attraction.
     * Optimized to use parallel queries instead of 2 sequential queries.
     */
    public async getDestinationsByAttraction(
        actor: Actor,
        params: DestinationsByAttractionInput
    ): Promise<ServiceOutput<{ destinations: Destination[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getDestinationsByAttraction',
            input: { ...params, actor },
            schema: DestinationsByAttractionInputSchema,
            execute: async (validatedParams, actor) => {
                await this._canList(actor);
                const { attractionId } = validatedParams;

                // Run existence check and data fetch in parallel
                const [attraction, relationsResult] = await Promise.all([
                    this.model.findOne({
                        id: attractionId as AttractionIdType
                    }),
                    this.relatedModel.findAll({ attractionId })
                ]);

                if (!attraction) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Attraction not found');
                }

                const { items: relations } = relationsResult;

                // If no relations, return empty array early
                if (relations.length === 0) {
                    return { destinations: [] };
                }

                const destinationIds = relations.map(
                    (r: DestinationAttractionRelation) => r.destinationId
                );

                // Fetch all destinations in one query
                const { items: destinations } = await this.destinationModel.findAll({
                    id: destinationIds
                });
                return { destinations };
            }
        });
    }

    protected async _executeSearch(
        params: AttractionSearchInput,
        _actor: Actor
    ): Promise<PaginatedListOutput<Attraction>> {
        const { name, slug, isFeatured, isBuiltin, destinationId } = params;
        const where: Record<string, unknown> = {};
        if (name) where.name = name;
        if (slug) where.slug = slug;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;
        if (destinationId) where.destinationId = destinationId;
        const { items, total } = await this.model.findAll(where);
        return { items, total };
    }

    protected async _executeCount(
        params: AttractionSearchInput,
        _actor: Actor
    ): Promise<CountResponse> {
        const { name, slug, isFeatured, isBuiltin, destinationId } = params;
        const where: Record<string, unknown> = {};
        if (name) where.name = name;
        if (slug) where.slug = slug;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;
        if (destinationId) where.destinationId = destinationId;
        const count = await this.model.count(where);
        return { count };
    }

    /**
     * Searches for attractions with destination counts.
     * Optimized to fetch all counts in a single query using aggregation.
     * @param actor - The actor performing the action
     * @param params - The search parameters
     * @returns Attractions with destination counts in standardized pagination format
     */
    public async searchForList(
        actor: Actor,
        params: AttractionSearchInput
    ): Promise<AttractionListWithCountsResponse> {
        await this._canSearch(actor);
        const { name, slug, isFeatured, isBuiltin, destinationId } = params;
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;

        const where: Record<string, unknown> = {};
        if (name) where.name = name;
        if (slug) where.slug = slug;
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

        // Get all attraction IDs from the current page
        const attractionIds = items.map((item) => item.id as AttractionIdType);

        // Fetch all relations for these attractions in a single query
        const { items: allRelations } = await this.relatedModel.findAll({
            attractionId: attractionIds
        });

        // Build a map of attraction ID to count
        const countMap = new Map<string, number>();
        for (const relation of allRelations) {
            const attractionId = relation.attractionId as string;
            countMap.set(attractionId, (countMap.get(attractionId) ?? 0) + 1);
        }

        // Merge counts with attractions
        const itemsWithCounts = items.map((attraction) => ({
            ...attraction,
            destinationCount: countMap.get(attraction.id as string) ?? 0
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
