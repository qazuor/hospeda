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

    protected createDefaultRelatedModel(): RDestinationAttractionModel {
        return new RDestinationAttractionModel();
    }

    /**
     * Adds an attraction to a destination, ensuring validation, permissions, and uniqueness.
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
                this._canAddAttractionToDestination(actor);
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
                // Verify that the relation does not already exist
                const existing = await this.relatedModel.findOne({
                    destinationId: destinationId as DestinationIdType,
                    attractionId: attractionId as AttractionIdType
                });
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
                this._canRemoveAttractionFromDestination(actor);
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
                this._canList(actor);
                const { destinationId } = validatedParams;
                // Verify destination exists
                const destination = await this.destinationModel.findOne({
                    id: destinationId as DestinationIdType
                });
                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }
                // Find all relations for this destination
                const { items: relations } = await this.relatedModel.findAll({ destinationId });
                const attractionIds = relations.map(
                    (r: DestinationAttractionRelation) => r.attractionId
                );
                // Find all attractions by id
                const { items: attractions } = await this.model.findAll({ id: attractionIds });
                return { attractions };
            }
        });
    }

    /**
     * Lists all destinations for a given attraction.
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
                this._canList(actor);
                const { attractionId } = validatedParams;
                // Verify attraction exists
                const attraction = await this.model.findOne({
                    id: attractionId as AttractionIdType
                });
                if (!attraction) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Attraction not found');
                }
                // Find all relations for this attraction
                const { items: relations } = await this.relatedModel.findAll({ attractionId });
                const destinationIds = relations.map(
                    (r: DestinationAttractionRelation) => r.destinationId
                );
                // Find all destinations by id
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
     * @param actor - The actor performing the action
     * @param params - The search parameters
     * @returns Attractions with destination counts in standardized pagination format
     */
    public async searchForList(
        actor: Actor,
        params: AttractionSearchInput
    ): Promise<AttractionListWithCountsResponse> {
        this._canSearch(actor);
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

        // Get destination counts for each attraction
        const itemsWithCounts = await Promise.all(
            items.map(async (attraction) => {
                const { items: relations } = await this.relatedModel.findAll({
                    attractionId: attraction.id as AttractionIdType
                });
                return {
                    ...attraction,
                    destinationCount: relations.length
                };
            })
        );

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
