import { AccommodationModel, FeatureModel, RAccommodationFeatureModel, features } from '@repo/db';
import type {
    Accommodation,
    AccommodationFeature,
    AccommodationIdType,
    Feature,
    FeatureIdType
} from '@repo/schemas';
import {
    AddFeatureToAccommodationInputSchema,
    FeatureCreateInputSchema as CreateFeatureSchema,
    FeatureAdminSearchSchema,
    GetAccommodationsByFeatureSchema,
    GetFeaturesForAccommodationSchema,
    RemoveFeatureFromAccommodationInputSchema,
    HttpFeatureSearchSchema as SearchFeatureSchema,
    ServiceErrorCode,
    FeatureUpdateInputSchema as UpdateFeatureSchema
} from '@repo/schemas';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import type { ServiceOutput } from '../../types';
import { type Actor, type ServiceConfig, type ServiceContext, ServiceError } from '../../types';
// generateFeatureSlug removed: JSONB name column dropped in SPEC-266 T-001.
import { normalizeListInput, normalizeViewInput } from './feature.normalizers';
import {
    checkCanAddFeatureToAccommodation,
    checkCanAdminList,
    checkCanCountFeatures,
    checkCanCreateFeature,
    checkCanDeleteFeature,
    checkCanGetAccommodationsByFeature,
    checkCanGetFeaturesForAccommodation,
    checkCanListFeatures,
    checkCanRemoveFeatureFromAccommodation,
    checkCanUpdateFeature,
    checkCanViewFeature
} from './feature.permissions';

/**
 * Service for managing features. Implements business logic, permissions, and hooks for Feature entities.
 * @extends BaseCrudRelatedService
 */
export class FeatureService extends BaseCrudRelatedService<
    Feature,
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
    /**
     * Admin search schema for feature list filtering.
     * Uses default _executeAdminSearch() because all entity-specific filter fields
     * map directly to table column names (no JSONB extraction, field renames, or range filters needed).
     */
    protected readonly adminSearchSchema = FeatureAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    protected readonly normalizers: CrudNormalizersFromSchemas<
        typeof CreateFeatureSchema,
        typeof UpdateFeatureSchema,
        typeof SearchFeatureSchema
    > = {
        list: normalizeListInput,
        view: normalizeViewInput
    };

    protected readonly accommodationModel: AccommodationModel;

    constructor(
        ctx: ServiceConfig,
        model?: FeatureModel,
        relatedModel?: RAccommodationFeatureModel,
        accommodationModel?: AccommodationModel
    ) {
        super(ctx, FeatureService.ENTITY_NAME, relatedModel);
        this.model = model ?? new FeatureModel();
        this.accommodationModel = accommodationModel ?? new AccommodationModel();
    }

    /**
     * Lifecycle hook: normalizes input before creating a feature.
     * Slug must be provided explicitly; auto-generation from name is no longer
     * possible because the JSONB `name` column was dropped in SPEC-266 T-001.
     */
    protected async _beforeCreate(
        data: z.infer<typeof CreateFeatureSchema>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Feature>> {
        const slug = data.slug;

        // Set default values for optional fields
        const isBuiltin = data.isBuiltin ?? false;
        const isFeatured = data.isFeatured ?? false;

        return {
            ...data,
            slug,
            isBuiltin,
            isFeatured
        };
    }

    /**
     * Lifecycle hook: normalizes input before updating a feature.
     * Slug must be provided explicitly; auto-generation from name is no longer
     * possible because the JSONB `name` column was dropped in SPEC-266 T-001.
     */
    protected async _beforeUpdate(
        data: z.infer<typeof UpdateFeatureSchema>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Feature>> {
        const slug = data.slug;
        return { ...data, slug };
    }

    protected _canCreate(actor: Actor, _data: z.infer<typeof CreateFeatureSchema>): void {
        checkCanCreateFeature(actor);
    }
    protected _canUpdate(actor: Actor, entity: Feature): void {
        checkCanUpdateFeature(actor, entity);
    }
    protected _canDelete(actor: Actor, entity: Feature): void {
        checkCanDeleteFeature(actor, entity);
    }
    protected _canView(actor: Actor, entity: Feature): void {
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

    protected _canSoftDelete(actor: Actor, entity: Feature): void {
        checkCanDeleteFeature(actor, entity);
    }
    protected _canHardDelete(actor: Actor, entity: Feature): void {
        checkCanDeleteFeature(actor, entity);
    }
    protected _canRestore(actor: Actor, entity: Feature): void {
        checkCanUpdateFeature(actor, entity);
    }
    protected _canUpdateVisibility(actor: Actor, entity: Feature, _newVisibility?: unknown): void {
        checkCanUpdateFeature(actor, entity);
    }

    protected _canAddFeatureToAccommodation(actor: Actor): void {
        checkCanAddFeatureToAccommodation(actor);
    }
    protected _canRemoveFeatureFromAccommodation(actor: Actor): void {
        checkCanRemoveFeatureFromAccommodation(actor);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    protected async _executeSearch(
        params: z.infer<typeof SearchFeatureSchema>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ items: Feature[]; total: number }> {
        const { slug, isFeatured, isBuiltin, applicableVertical } = params;
        const where: Record<string, unknown> = {};
        // The JSONB name column was dropped in SPEC-266 T-001. Text search is now
        // done via the slug field (exact match). safeIlike on features.slug is
        // available for callers that need partial slug matching.
        if (slug) where.slug = slug;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;

        // SPEC-266 T-005: array containment filter for applicable_verticals.
        // buildWhereClause cannot handle text[] containment, so we build the
        // SQL condition manually and pass it as additionalConditions.
        const additionalConditions = applicableVertical
            ? [sql`${applicableVertical} = ANY(${features.applicableVerticals})`]
            : undefined;

        const { items, total } = await this.model.findAll(where, undefined, additionalConditions);
        return { items, total };
    }

    protected async _executeCount(
        params: z.infer<typeof SearchFeatureSchema>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { slug, isFeatured, isBuiltin, applicableVertical } = params;
        const where: Record<string, unknown> = {};
        // The JSONB name column was dropped in SPEC-266 T-001. Text search is now
        // done via the slug field (exact match). safeIlike on features.slug is
        // available for callers that need partial slug matching.
        if (slug) where.slug = slug;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;

        // SPEC-266 T-005: array containment filter for applicable_verticals.
        const additionalConditions = applicableVertical
            ? [sql`${applicableVertical} = ANY(${features.applicableVerticals})`]
            : undefined;

        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }

    /**
     * Searches for features with accommodation counts.
     * Uses a single batch COUNT query instead of N+1 individual queries.
     *
     * The JSONB `name` column was dropped in SPEC-266 T-001. Text search is now
     * done via the `slug` field (exact match). Partial slug matching can be
     * added by callers using `safeIlike(features.slug, term)` in additional conditions.
     *
     * @param actor - The actor performing the action
     * @param params - The search parameters with optional filters
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns Features with accommodation counts
     */
    public async searchForList(
        actor: Actor,
        params: {
            filters?: { slug?: string; isFeatured?: boolean; isBuiltin?: boolean };
            pagination?: { page?: number; pageSize?: number };
        } = {},
        _ctx?: ServiceContext
    ): Promise<{
        items: Array<Feature & { accommodationCount?: number }>;
        total: number;
    }> {
        await this._canSearch(actor);
        const { pagination, filters = {} } = params;
        const { slug, isFeatured, isBuiltin } = filters;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;

        const where: Record<string, unknown> = {};
        // The JSONB name column was dropped in SPEC-266 T-001. Text search is now
        // done via the slug field (exact match). safeIlike on features.slug is
        // available for callers that need partial slug matching.
        if (slug) where.slug = slug;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;

        const { items, total } = await this.model.findAll(where, { page, pageSize });

        // Batch fetch accommodation counts in a single query instead of N+1
        const featureIds = items.map((feature) => feature.id as string);
        const countsMap = await this.relatedModel.countAccommodationsByFeatureIds(featureIds);

        const itemsWithCounts = items.map((feature) => ({
            ...feature,
            accommodationCount: countsMap.get(feature.id as string) ?? 0
        }));

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
     * @param actor - The actor performing the action
     * @param params - The params required to add the feature to the accommodation
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async addFeatureToAccommodation(
        actor: Actor,
        params: z.infer<typeof AddFeatureToAccommodationInputSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ relation: AccommodationFeature }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addFeatureToAccommodation',
            input: { actor, ...params },
            schema: AddFeatureToAccommodationInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canAddFeatureToAccommodation(actor);
                const { accommodationId, featureId, comments } = validatedParams;
                // Verify feature exists
                const feature = await this.model.findOne({ id: featureId as FeatureIdType });
                if (!feature) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature not found');
                }
                const accommodation = await this.accommodationModel.findOne({
                    id: accommodationId as AccommodationIdType
                });
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                // Verify that the relation does not already exist
                const existing = await this.relatedModel.findOne({
                    accommodationId: accommodationId as AccommodationIdType,
                    featureId: featureId as FeatureIdType
                });
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'Feature already added to accommodation'
                    );
                }
                // Create the relation
                const relation = await this.relatedModel.create({
                    accommodationId: accommodationId as AccommodationIdType,
                    featureId: featureId as FeatureIdType,
                    notes: comments || undefined, // Map comments to notes, handle null
                    isHighlighted: false // Default value
                });
                return { relation };
            }
        });
    }

    /**
     * Removes a feature from an accommodation.
     * @param actor - The actor performing the action
     * @param params - The params required to remove the feature from the accommodation
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async removeFeatureFromAccommodation(
        actor: Actor,
        params: z.infer<typeof RemoveFeatureFromAccommodationInputSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ relation: AccommodationFeature }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeFeatureFromAccommodation',
            input: { actor, ...params },
            schema: RemoveFeatureFromAccommodationInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canRemoveFeatureFromAccommodation(actor);
                const { accommodationId, featureId } = validatedParams;
                // Verify relation exists (implies feature exists, no separate check needed)
                const existing = await this.relatedModel.findOne({
                    accommodationId: accommodationId as AccommodationIdType,
                    featureId: featureId as FeatureIdType
                });
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Feature relation not found for this accommodation'
                    );
                }
                // Remove relation using softDelete and ensure it returns non-null
                const softDeleted = await this.relatedModel.softDelete({
                    accommodationId: accommodationId as AccommodationIdType,
                    featureId: featureId as FeatureIdType
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
     * @param actor - The actor performing the action
     * @param params - The params containing the accommodation ID
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async getFeaturesForAccommodation(
        actor: Actor,
        params: z.infer<typeof GetFeaturesForAccommodationSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ features: Feature[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFeaturesForAccommodation',
            input: { actor, ...params },
            schema: GetFeaturesForAccommodationSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                checkCanGetFeaturesForAccommodation(actor);
                const { accommodationId } = validatedParams;
                // Single query with JOIN instead of 2 sequential queries
                const { items: relationsWithFeature } =
                    await this.relatedModel.findAllWithRelations(
                        { feature: true },
                        { accommodationId },
                        { page: 1, pageSize: 100 }
                    );

                const features = relationsWithFeature
                    .filter((r) => 'feature' in r && r.feature != null)
                    .map((r) => (r as AccommodationFeature & { feature: Feature }).feature)
                    .sort((a, b) => (b.displayWeight ?? 50) - (a.displayWeight ?? 50));

                return { features };
            }
        });
    }

    /**
     * Retrieves all accommodations that have a specific feature.
     * @param actor - The actor performing the action
     * @param params - The params containing the feature ID
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async getAccommodationsByFeature(
        actor: Actor,
        params: z.infer<typeof GetAccommodationsByFeatureSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ accommodations: Accommodation[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAccommodationsByFeature',
            input: { actor, ...params },
            schema: GetAccommodationsByFeatureSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                checkCanGetAccommodationsByFeature(actor);
                const { featureId } = validatedParams;
                const feature = await this.model.findOne({ id: featureId as FeatureIdType });
                if (!feature) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature not found');
                }
                // Single query with JOIN instead of 3 sequential queries
                const { items: relationsWithAccommodation } =
                    await this.relatedModel.findAllWithRelations(
                        { accommodation: true },
                        { featureId },
                        { page: 1, pageSize: 100 }
                    );

                const accommodations = relationsWithAccommodation
                    .filter((r) => 'accommodation' in r && r.accommodation != null)
                    .map(
                        (r) =>
                            (
                                r as AccommodationFeature & {
                                    accommodation: Accommodation;
                                }
                            ).accommodation
                    );

                return { accommodations };
            }
        });
    }
}
