import { AccommodationModel, FeatureModel, RAccommodationFeatureModel } from '@repo/db';
import type {
    AccommodationFeatureType,
    AccommodationId,
    AccommodationType,
    FeatureId,
    FeatureType
} from '@repo/types';
import { ServiceErrorCode } from '@repo/types';
import type { z } from 'zod';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import type { ServiceOutput } from '../../types';
import { type Actor, type ServiceContext, ServiceError } from '../../types';
import { generateFeatureSlug } from './feature.helpers';
import {
    checkCanAddFeatureToAccommodation,
    checkCanCountFeatures,
    checkCanCreateFeature,
    checkCanDeleteFeature,
    checkCanListFeatures,
    checkCanRemoveFeatureFromAccommodation,
    checkCanUpdateFeature,
    checkCanViewFeature
} from './feature.permissions';
import {
    AddFeatureToAccommodationInputSchema,
    CreateFeatureSchema,
    GetAccommodationsByFeatureSchema,
    GetFeaturesForAccommodationSchema,
    RemoveFeatureFromAccommodationInputSchema,
    SearchFeatureSchema,
    UpdateFeatureSchema
} from './feature.schemas';

/**
 * Service for managing features. Implements business logic, permissions, and hooks for Feature entities.
 * @extends BaseCrudRelatedService
 */
export class FeatureService extends BaseCrudRelatedService<
    FeatureType,
    FeatureModel,
    RAccommodationFeatureModel,
    typeof CreateFeatureSchema,
    typeof UpdateFeatureSchema,
    typeof SearchFeatureSchema
> {
    static readonly ENTITY_NAME = 'feature';
    protected readonly entityName = FeatureService.ENTITY_NAME;
    public readonly model: FeatureModel;

    public readonly createSchema = CreateFeatureSchema;
    public readonly updateSchema = UpdateFeatureSchema;
    public readonly searchSchema = SearchFeatureSchema;
    protected readonly accommodationModel: AccommodationModel;

    constructor(
        ctx: ServiceContext,
        model?: FeatureModel,
        relatedModel?: RAccommodationFeatureModel,
        accommodationModel?: AccommodationModel
    ) {
        super(ctx, FeatureService.ENTITY_NAME, relatedModel);
        this.model = model ?? new FeatureModel();
        this.accommodationModel = accommodationModel ?? new AccommodationModel();
    }

    /**
     * Lifecycle hook: normalizes input and generates slug before creating a feature.
     * If slug is not provided, generates a unique slug from the name.
     */
    protected async _beforeCreate(
        data: z.infer<typeof CreateFeatureSchema>,
        _actor: Actor
    ): Promise<Partial<FeatureType>> {
        let slug = data.slug;
        if (!slug && data.name) {
            slug = await generateFeatureSlug(data.name, this.model);
        }
        return { ...data, slug };
    }

    /**
     * Lifecycle hook: normalizes input and generates slug before updating a feature.
     * If name is updated and slug is not provided, generates a new unique slug.
     */
    protected async _beforeUpdate(
        data: z.infer<typeof UpdateFeatureSchema>,
        _actor: Actor
    ): Promise<Partial<FeatureType>> {
        let slug = data.slug;
        if (!slug && data.name) {
            // Try to get the entity by id if present
            let entity: FeatureType | undefined = undefined;
            if ('id' in data && data.id) {
                const found = await this.model.findById(data.id as FeatureType['id']);
                entity = found ?? undefined;
            }
            if (!entity || (entity && data.name !== entity.name)) {
                slug = await generateFeatureSlug(data.name, this.model);
            }
        }
        return { ...data, slug };
    }

    protected _canCreate(actor: Actor, _data: z.infer<typeof CreateFeatureSchema>): void {
        checkCanCreateFeature(actor);
    }
    protected _canUpdate(actor: Actor, entity: FeatureType): void {
        checkCanUpdateFeature(actor, entity);
    }
    protected _canDelete(actor: Actor, entity: FeatureType): void {
        checkCanDeleteFeature(actor, entity);
    }
    protected _canView(actor: Actor, entity: FeatureType): void {
        checkCanViewFeature(actor, entity);
    }
    protected _canList(actor: Actor): void {
        checkCanListFeatures(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanListFeatures(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanCountFeatures(actor);
    }

    protected _canSoftDelete(actor: Actor, entity: FeatureType): void {
        checkCanDeleteFeature(actor, entity);
    }
    protected _canHardDelete(actor: Actor, entity: FeatureType): void {
        checkCanDeleteFeature(actor, entity);
    }
    protected _canRestore(actor: Actor, entity: FeatureType): void {
        checkCanUpdateFeature(actor, entity);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        entity: FeatureType,
        _newVisibility?: unknown
    ): void {
        checkCanUpdateFeature(actor, entity);
    }

    protected _canAddFeatureToAccommodation(actor: Actor): void {
        checkCanAddFeatureToAccommodation(actor);
    }
    protected _canRemoveFeatureFromAccommodation(actor: Actor): void {
        checkCanRemoveFeatureFromAccommodation(actor);
    }

    protected async _executeSearch(
        params: z.infer<typeof SearchFeatureSchema>,
        _actor: Actor
    ): Promise<{ items: FeatureType[]; total: number }> {
        const { name, slug, isFeatured, isBuiltin } = params;
        const where: Record<string, unknown> = {};
        if (name) where.name = name;
        if (slug) where.slug = slug;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;
        const { items, total } = await this.model.findAll(where);
        return { items, total };
    }

    protected async _executeCount(
        params: z.infer<typeof SearchFeatureSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const { name, slug, isFeatured, isBuiltin } = params;
        const where: Record<string, unknown> = {};
        if (name) where.name = name;
        if (slug) where.slug = slug;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;
        const count = await this.model.count(where);
        return { count };
    }

    /**
     * Searches for features with accommodation counts.
     * @param actor - The actor performing the action
     * @param params - The search parameters with optional filters
     * @returns Features with accommodation counts
     */
    public async searchForList(
        actor: Actor,
        params: {
            filters?: { name?: string; slug?: string; isFeatured?: boolean; isBuiltin?: boolean };
            pagination?: { page?: number; pageSize?: number };
        } = {}
    ): Promise<{
        items: Array<FeatureType & { accommodationCount?: number }>;
        total: number;
    }> {
        this._canSearch(actor);
        const { filters = {}, pagination } = params;
        const { name, slug, isFeatured, isBuiltin } = filters;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;

        const where: Record<string, unknown> = {};
        if (name) where.name = name;
        if (slug) where.slug = slug;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;

        const { items, total } = await this.model.findAll(where, { page, pageSize });

        // Get accommodation counts for each feature
        const itemsWithCounts = await Promise.all(
            items.map(async (feature) => {
                const { items: relations } = await this.relatedModel.findAll({
                    featureId: feature.id as FeatureId
                });
                return {
                    ...feature,
                    accommodationCount: relations.length
                };
            })
        );

        return {
            items: itemsWithCounts,
            total
        };
    }

    protected createDefaultRelatedModel(): RAccommodationFeatureModel {
        return new RAccommodationFeatureModel();
    }

    /**
     * Adds a feature to an accommodation, ensuring validation, permissions, and uniqueness.
     */
    public async addFeatureToAccommodation(
        actor: Actor,
        params: z.infer<typeof AddFeatureToAccommodationInputSchema>
    ): Promise<ServiceOutput<{ relation: AccommodationFeatureType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addFeatureToAccommodation',
            input: { ...params, actor },
            schema: AddFeatureToAccommodationInputSchema,
            execute: async (validatedParams, actor) => {
                this._canAddFeatureToAccommodation(actor);
                const { accommodationId, featureId, hostReWriteName, comments } = validatedParams;
                // Verify feature exists
                const feature = await this.model.findOne({ id: featureId as FeatureId });
                if (!feature) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature not found');
                }
                const accommodation = await this.accommodationModel.findOne({
                    id: accommodationId as AccommodationId
                });
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                // Verify that the relation does not already exist
                const existing = await this.relatedModel.findOne({
                    accommodationId: accommodationId as AccommodationId,
                    featureId: featureId as FeatureId
                });
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'Feature already added to accommodation'
                    );
                }
                // Create the relation
                const relation = await this.relatedModel.create({
                    accommodationId: accommodationId as AccommodationId,
                    featureId: featureId as FeatureId,
                    hostReWriteName,
                    comments
                });
                return { relation };
            }
        });
    }

    /**
     * Removes a feature from an accommodation.
     */
    public async removeFeatureFromAccommodation(
        actor: Actor,
        params: z.infer<typeof RemoveFeatureFromAccommodationInputSchema>
    ): Promise<ServiceOutput<{ relation: AccommodationFeatureType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeFeatureFromAccommodation',
            input: { ...params, actor },
            schema: RemoveFeatureFromAccommodationInputSchema,
            execute: async (validatedParams, actor) => {
                this._canRemoveFeatureFromAccommodation(actor);
                const { accommodationId, featureId } = validatedParams;
                // Verify feature exists
                const feature = await this.model.findOne({ id: featureId as FeatureId });
                if (!feature) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature not found');
                }
                // Verify relation exists
                const existing = await this.relatedModel.findOne({
                    accommodationId: accommodationId as AccommodationId,
                    featureId: featureId as FeatureId
                });
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Feature relation not found for this accommodation'
                    );
                }
                // Remove relation using softDelete and ensure it returns non-null
                const softDeleted = await this.relatedModel.softDelete({
                    accommodationId: accommodationId as AccommodationId,
                    featureId: featureId as FeatureId
                });
                if (!softDeleted) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to delete feature relation'
                    );
                }
                return {
                    relation: {
                        ...existing,
                        deletedAt: new Date()
                    }
                };
            }
        });
    }

    /**
     * Retrieves all features for a given accommodation.
     */
    public async getFeaturesForAccommodation(
        actor: Actor,
        params: z.infer<typeof GetFeaturesForAccommodationSchema>
    ): Promise<ServiceOutput<{ features: FeatureType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFeaturesForAccommodation',
            input: { ...params, actor },
            schema: GetFeaturesForAccommodationSchema,
            execute: async (validatedParams, actor) => {
                this._canList(actor);
                const { accommodationId } = validatedParams;
                // Find all relations with this accommodationId
                const { items: relations } = await this.relatedModel.findAll({ accommodationId });
                const featureIds = relations.map((r) => r.featureId);
                if (featureIds.length === 0) {
                    return { features: [] };
                }
                // Find all features by their IDs
                const { items: features } = await this.model.findAll({ id: featureIds });
                return { features };
            }
        });
    }

    /**
     * Retrieves all accommodations that have a specific feature.
     */
    public async getAccommodationsByFeature(
        actor: Actor,
        params: z.infer<typeof GetAccommodationsByFeatureSchema>
    ): Promise<ServiceOutput<{ accommodations: AccommodationType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAccommodationsByFeature',
            input: { ...params, actor },
            schema: GetAccommodationsByFeatureSchema,
            execute: async (validatedParams, actor) => {
                this._canList(actor);
                const { featureId } = validatedParams;
                const feature = await this.model.findOne({ id: featureId as FeatureId });
                if (!feature) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature not found');
                }
                const { items: relations } = await this.relatedModel.findAll({ featureId });
                const accommodationIds = relations.map((r) => r.accommodationId);
                if (accommodationIds.length === 0) {
                    return { accommodations: [] };
                }
                const accommodationModel = this.accommodationModel ?? new AccommodationModel();
                const { items: accommodations } = await accommodationModel.findAll({
                    id: accommodationIds
                });
                return { accommodations };
            }
        });
    }
}
