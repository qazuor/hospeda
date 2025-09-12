import { AccommodationFaqModel, AccommodationIaDataModel, AccommodationModel } from '@repo/db';
import {
    type AccommodationByDestinationParams,
    AccommodationByDestinationParamsSchema,
    type AccommodationCreateInput,
    AccommodationCreateInputSchema,
    type AccommodationFaqAddInput,
    AccommodationFaqAddInputSchema,
    type AccommodationFaqListInput,
    AccommodationFaqListInputSchema,
    type AccommodationFaqListOutput,
    type AccommodationFaqRemoveInput,
    AccommodationFaqRemoveInputSchema,
    type AccommodationFaqSingleOutput,
    type AccommodationFaqUpdateInput,
    AccommodationFaqUpdateInputSchema,
    type AccommodationIaDataAddInput,
    AccommodationIaDataAddInputSchema,
    type AccommodationIaDataListInput,
    AccommodationIaDataListInputSchema,
    type AccommodationIaDataListOutput,
    type AccommodationIaDataRemoveInput,
    AccommodationIaDataRemoveInputSchema,
    type AccommodationIaDataSingleOutput,
    type AccommodationIaDataUpdateInput,
    AccommodationIaDataUpdateInputSchema,
    type AccommodationSearchInput,
    AccommodationSearchInputSchema,
    type AccommodationStatsOutput,
    type AccommodationStatsParams,
    AccommodationStatsParamsSchema,
    type AccommodationSummaryParams,
    AccommodationSummaryParamsSchema,
    type AccommodationTopRatedParams,
    AccommodationTopRatedParamsSchema,
    AccommodationUpdateInputSchema,
    type Success,
    type WithOwnerIdParams,
    WithOwnerIdParamsSchema
} from '@repo/schemas';
import { generateSlug } from '@repo/service-core/services/accommodation/accommodation.helpers';
import type {
    AccommodationId,
    AccommodationRatingType,
    AccommodationSummaryType,
    AccommodationType
} from '@repo/types';
import { ServiceErrorCode } from '@repo/types';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { parseIdOrSlug } from '../../utils';
import { DestinationService } from '../destination/destination.service';
import {
    normalizeAccommodationOutput,
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from './accommodation.normalizers';
import {
    checkCanCreate,
    checkCanHardDelete,
    checkCanList,
    checkCanRestore,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanView
} from './accommodation.permissions';

/**
 * Provides accommodation-specific business logic, including creation, updates,
 * permissions, and other operations. It extends the generic `BaseCrudService` to
 * leverage a standardized service pipeline (validation, permissions, hooks, etc.).
 */
export class AccommodationService extends BaseCrudService<
    AccommodationType,
    AccommodationModel,
    typeof AccommodationCreateInputSchema,
    typeof AccommodationUpdateInputSchema,
    typeof AccommodationSearchInputSchema
> {
    static readonly ENTITY_NAME = 'accommodation';
    protected readonly entityName = AccommodationService.ENTITY_NAME;
    /**
     * @inheritdoc
     */
    protected readonly model: AccommodationModel;
    /**
     * @inheritdoc
     */

    /**
     * @inheritdoc
     */
    protected readonly createSchema = AccommodationCreateInputSchema;
    /**
     * @inheritdoc
     */
    protected readonly updateSchema = AccommodationUpdateInputSchema;

    /**
     * @inheritdoc
     */
    protected readonly searchSchema = AccommodationSearchInputSchema;

    /**
     * @inheritdoc
     */
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput,
        search: (params: AccommodationSearchInput) => params // identity by default, can be overridden in tests
    };

    private destinationService: DestinationService;
    private _lastDeletedDestinationId: string | undefined;

    /**
     * Initializes a new instance of the AccommodationService.
     * @param ctx - The service context, containing the logger.
     */
    constructor(ctx: ServiceContext, model?: AccommodationModel) {
        super(ctx, AccommodationService.ENTITY_NAME);
        this.model = model ?? new AccommodationModel();
        this.destinationService = new DestinationService(ctx);
    }

    // --- Permissions Hooks ---
    /**
     * @inheritdoc
     */
    protected _canCreate(actor: Actor, data: AccommodationCreateInput): void {
        checkCanCreate(actor, data);
    }
    /**
     * @inheritdoc
     */
    protected _canUpdate(actor: Actor, entity: AccommodationType): void {
        checkCanUpdate(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canSoftDelete(actor: Actor, entity: AccommodationType): void {
        checkCanSoftDelete(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canHardDelete(actor: Actor, entity: AccommodationType): void {
        checkCanHardDelete(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canRestore(actor: Actor, entity: AccommodationType): void {
        checkCanRestore(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canView(actor: Actor, entity: AccommodationType): void {
        checkCanView(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }
    /**
     * @inheritdoc
     * For accommodations, search permission is the same as list permission.
     * This could be evolved to a specific `ACCOMMODATION_SEARCH` permission if needed.
     */
    protected _canSearch(actor: Actor): void {
        checkCanList(actor);
    }
    /**
     * @inheritdoc
     * For accommodations, count permission is the same as list permission.
     */
    protected _canCount(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * @inheritdoc
     * For accommodations, visibility can be changed by anyone who can update the entity.
     * This could be evolved to a specific `ACCOMMODATION_UPDATE_VISIBILITY` permission if needed.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        entity: AccommodationType,
        _newVisibility: AccommodationType['visibility']
    ): void {
        checkCanUpdate(actor, entity);
    }

    // --- Lifecycle Hooks ---
    /**
     * @inheritdoc
     * Generates a unique slug for the accommodation before it is created.
     * This hook ensures that every accommodation has a URL-friendly and unique identifier.
     */
    protected async _beforeCreate(
        data: AccommodationCreateInput,
        _actor: Actor
    ): Promise<Partial<AccommodationType>> {
        const slug = await generateSlug(data.type as string, data.name as string);
        return { ...data, slug } as unknown as Partial<AccommodationType>;
    }

    protected async _afterCreate(entity: AccommodationType): Promise<AccommodationType> {
        if (entity.destinationId) {
            await this.destinationService.updateAccommodationsCount(entity.destinationId);
        }
        return entity;
    }

    protected async _beforeSoftDelete(id: string, _actor: Actor): Promise<string> {
        // Buscar el accommodation antes de borrarlo para obtener el destinationId
        const entity = await this.model.findById(id);
        this._lastDeletedDestinationId = entity?.destinationId;
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor
    ): Promise<{ count: number }> {
        if (this._lastDeletedDestinationId) {
            await this.destinationService.updateAccommodationsCount(this._lastDeletedDestinationId);
            this._lastDeletedDestinationId = undefined;
        }
        return result;
    }

    protected async _beforeHardDelete(id: string, _actor: Actor): Promise<string> {
        // Buscar el accommodation antes de borrarlo para obtener el destinationId
        const entity = await this.model.findById(id);
        this._lastDeletedDestinationId = entity?.destinationId;
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor
    ): Promise<{ count: number }> {
        if (this._lastDeletedDestinationId) {
            await this.destinationService.updateAccommodationsCount(this._lastDeletedDestinationId);
            this._lastDeletedDestinationId = undefined;
        }
        return result;
    }

    // --- Core Logic ---
    /**
     * @inheritdoc
     * Executes the database search for accommodations.
     * This implementation ensures that any branded types (like `UserId`) are
     * cast to primitives before being passed to the database model.
     * @param params The validated and processed search parameters.
     * @param _actor The actor performing the search.
     * @returns A paginated list of accommodations matching the criteria.
     */
    protected async _executeSearch(params: AccommodationSearchInput, _actor: Actor) {
        return this.model.search(params);
    }

    /**
     * @inheritdoc
     * Executes the database count for accommodations.
     * @param params The validated and processed search parameters.
     * @param _actor The actor performing the count.
     * @returns An object containing the total count of accommodations matching the criteria.
     */
    protected async _executeCount(params: AccommodationSearchInput, _actor: Actor) {
        return this.model.countByFilters(params);
    }

    /**
     * Search accommodations for list display with destination and owner relations
     */
    public async searchForList(
        actor: Actor,
        params: AccommodationSearchInput
    ): Promise<{
        items: Array<
            Omit<AccommodationType, 'destination' | 'owner'> & {
                destination?: { id: string; name: string; slug: string };
                owner?: { id: string; displayName: string };
            }
        >;
        total: number;
    }> {
        this._canSearch(actor);
        const { filters = {}, pagination } = params;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;

        const result = await this.model.searchWithRelations({
            filters,
            pagination: { page, pageSize }
        });

        return {
            items: result.items,
            total: result.total
        };
    }

    /**
     * Returns top-rated accommodations, optionally filtered by destination, type, and featured flag.
     * The output is a compact summary tailored for cards/lists and includes joined amenities/features only when related.
     * @param actor - The actor performing the action
     * @param params - Input with optional limit, destinationId, type and onlyFeatured
     * @returns List of summarized accommodations ordered by rating
     */
    public async getTopRated(
        actor: Actor,
        params: AccommodationTopRatedParams
    ): Promise<ServiceOutput<AccommodationType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTopRated',
            input: { ...params, actor },
            schema: AccommodationTopRatedParamsSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const items = await this.model.findTopRated({
                    limit: validated.limit,
                    destinationId: validated.destinationId,
                    type: validated.type,
                    onlyFeatured: validated.onlyFeatured
                });
                return (
                    items.map(
                        (item) => normalizeAccommodationOutput(item, actor) as AccommodationType
                    ) ?? []
                );
            }
        });
    }

    /**
     * Gets a summary for a specific accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing id or slug
     * @returns The accommodation summary or null
     */
    public async getSummary(
        actor: Actor,
        data: AccommodationSummaryParams
    ): Promise<ServiceOutput<AccommodationSummaryType | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { ...data, actor },
            schema: AccommodationSummaryParamsSchema,
            execute: async (validated, actor) => {
                const { idOrSlug } = validated;
                const { field, value } = parseIdOrSlug(idOrSlug);
                const entityResult = await this.getByField(actor, field, value as string);
                if (entityResult.error) {
                    throw new ServiceError(
                        entityResult.error.code,
                        entityResult.error.message,
                        entityResult.error.details
                    );
                }
                if (!entityResult.data) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                const entity = entityResult.data;
                this._canView(actor, entity);
                if (!entity.location) {
                    this.logger.warn(`Accommodation ${entity.id} has no location for summary.`);
                    return null;
                }
                return {
                    id: entity.id,
                    slug: entity.slug,
                    name: entity.name,
                    type: entity.type,
                    media: entity.media,
                    location: entity.location,
                    isFeatured: entity.isFeatured,
                    averageRating: 0,
                    reviewsCount: 0
                };
            }
        });
    }

    /**
     * Gets stats for a specific accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing id or slug
     * @returns The stats object or null
     */
    public async getStats(
        actor: Actor,
        data: AccommodationStatsParams
    ): Promise<ServiceOutput<AccommodationStatsOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input: { ...data, actor },
            schema: AccommodationStatsParamsSchema,
            execute: async (validated, actor) => {
                const { idOrSlug } = validated;
                const { field, value } = parseIdOrSlug(idOrSlug);
                const entityResult = await this.getByField(actor, field, value as string);
                if (entityResult.error) {
                    throw new ServiceError(
                        entityResult.error.code,
                        entityResult.error.message,
                        entityResult.error.details
                    );
                }
                if (!entityResult.data) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                const entity = entityResult.data;
                this._canView(actor, entity);
                return {
                    reviewsCount: entity.reviewsCount ?? 0,
                    averageRating: entity.averageRating ?? 0,
                    rating: entity.rating
                };
            }
        });
    }

    /**
     * Gets accommodations by destination.
     * @param actor - The actor performing the action
     * @param data - The input object containing destinationId
     * @returns The list of accommodations
     */
    public async getByDestination(
        actor: Actor,
        data: AccommodationByDestinationParams
    ): Promise<ServiceOutput<AccommodationType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByDestination',
            input: { ...data, actor },
            schema: AccommodationByDestinationParamsSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const result = await this.model.findAll({
                    destinationId: validated.destinationId
                });
                return Array.isArray(result.items)
                    ? result.items.map(
                          (item) => normalizeAccommodationOutput(item, actor) as AccommodationType
                      )
                    : [];
            }
        });
    }

    /**
     * Gets top-rated accommodations by destination.
     * @param actor - The actor performing the action
     * @param data - The input object containing destinationId (optional)
     * @returns The list of top-rated accommodations
     */
    public async getTopRatedByDestination(
        actor: Actor,
        data: AccommodationTopRatedParams
    ): Promise<ServiceOutput<never>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTopRatedByDestination',
            input: { ...data, actor },
            schema: AccommodationTopRatedParamsSchema,
            execute: async (_validated, actor) => {
                this._canList(actor);
                throw new ServiceError(ServiceErrorCode.NOT_IMPLEMENTED, 'Not implemented');
            }
        });
    }

    /**
     * Adds a FAQ to an accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId and faq
     * @returns The created FAQ
     */
    public async addFaq(
        actor: Actor,
        data: AccommodationFaqAddInput
    ): Promise<ServiceOutput<AccommodationFaqSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addFaq',
            input: { ...data, actor },
            schema: AccommodationFaqAddInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canUpdate(actor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faqToCreate = {
                    ...validated.faq,
                    accommodationId: validated.accommodationId as AccommodationId
                };
                const createdFaq = await faqModel.create(faqToCreate);
                return { faq: createdFaq };
            }
        });
    }

    /**
     * Removes a FAQ from an accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId and faqId
     * @returns Success boolean
     */
    public async removeFaq(
        actor: Actor,
        data: AccommodationFaqRemoveInput
    ): Promise<ServiceOutput<Success>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeFaq',
            input: { ...data, actor },
            schema: AccommodationFaqRemoveInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canUpdate(actor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faq = await faqModel.findById(validated.faqId);
                if (!faq || faq.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'FAQ not found for this accommodation'
                    );
                }
                await faqModel.hardDelete({ id: validated.faqId });
                return { success: true };
            }
        });
    }

    /**
     * Updates a FAQ for an accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId, faqId, and faq
     * @returns The updated FAQ
     */
    public async updateFaq(
        actor: Actor,
        data: AccommodationFaqUpdateInput
    ): Promise<ServiceOutput<AccommodationFaqSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateFaq',
            input: { ...data, actor },
            schema: AccommodationFaqUpdateInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canUpdate(actor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faq = await faqModel.findById(validated.faqId);
                if (!faq || faq.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'FAQ not found for this accommodation'
                    );
                }
                const updatedFaq = await faqModel.update(
                    { id: validated.faqId },
                    {
                        ...validated.faq,
                        accommodationId: validated.accommodationId as AccommodationId
                    }
                );
                if (!updatedFaq) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update FAQ');
                }
                return { faq: updatedFaq };
            }
        });
    }

    /**
     * Gets all FAQs for an accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId
     * @returns The list of FAQs
     */
    public async getFaqs(
        actor: Actor,
        data: AccommodationFaqListInput
    ): Promise<ServiceOutput<AccommodationFaqListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFaqs',
            input: { ...data, actor },
            schema: AccommodationFaqListInputSchema,
            execute: async (validated, actor) => {
                const accommodation = await this.model.findById(validated.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canView(actor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const { items: faqs } = await faqModel.findAll({
                    accommodationId: validated.accommodationId
                });
                return { faqs };
            }
        });
    }

    /**
     * Adds IA data to an accommodation.
     * @param input - Input object for adding IA data.
     * @param actor - The actor performing the action.
     * @returns Output object with the created IA data
     */
    public async addIAData(
        input: AccommodationIaDataAddInput,
        actor: Actor
    ): Promise<ServiceOutput<AccommodationIaDataSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataAddInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canUpdate(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const iaDataToCreate = {
                    ...validated.iaData,
                    accommodationId: validated.accommodationId as AccommodationId
                };
                const createdIaData = await iaDataModel.create(iaDataToCreate);
                return { iaData: createdIaData };
            }
        });
    }

    /**
     * Removes IA data from an accommodation.
     * @param input - Input object for removing IA data.
     * @param actor - The actor performing the action.
     * @returns Output object with success status
     */
    public async removeIAData(
        input: AccommodationIaDataRemoveInput,
        actor: Actor
    ): Promise<ServiceOutput<Success>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataRemoveInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canUpdate(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const iaData = await iaDataModel.findById(validated.iaDataId);
                if (!iaData || iaData.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'IA data not found for this accommodation'
                    );
                }
                await iaDataModel.hardDelete({ id: validated.iaDataId });
                return { success: true };
            }
        });
    }

    /**
     * Updates IA data for an accommodation.
     * @param input - Input object for updating IA data.
     * @param actor - The actor performing the action.
     * @returns Output object with the updated IA data
     */
    public async updateIAData(
        input: AccommodationIaDataUpdateInput,
        actor: Actor
    ): Promise<ServiceOutput<AccommodationIaDataSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataUpdateInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canUpdate(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const iaData = await iaDataModel.findById(validated.iaDataId);
                if (!iaData || iaData.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'IA data not found for this accommodation'
                    );
                }
                const updatedIaData = await iaDataModel.update(
                    { id: validated.iaDataId },
                    {
                        ...validated.iaData,
                        accommodationId: validated.accommodationId as AccommodationId
                    }
                );
                if (!updatedIaData) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update IA data'
                    );
                }
                return { iaData: updatedIaData };
            }
        });
    }

    /**
     * Gets all IA data for an accommodation.
     * @param input - Input object for getting all IA data.
     * @param actor - The actor performing the action.
     * @returns Output object with the list of IA data
     */
    public async getAllIAData(
        input: AccommodationIaDataListInput,
        actor: Actor
    ): Promise<ServiceOutput<AccommodationIaDataListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAllIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataListInputSchema,
            execute: async (validated, actor) => {
                const accommodation = await this.model.findById(validated.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canView(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const { items: iaData } = await iaDataModel.findAll({
                    accommodationId: validated.accommodationId
                });
                return { iaData };
            }
        });
    }

    /**
     * Gets accommodations by owner.
     * @param input - Input object for owner query.
     * @param actor - The actor performing the action.
     * @returns Output object (to be defined)
     */
    public async getByOwner(input: WithOwnerIdParams, actor: Actor): Promise<ServiceOutput<never>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByOwner',
            input: { actor: actor, ...input },
            schema: WithOwnerIdParamsSchema,
            execute: async () => {
                throw new ServiceError(ServiceErrorCode.NOT_IMPLEMENTED, 'Not implemented');
            }
        });
    }

    /**
     * Updates the stats (reviewsCount, averageRating, rating) for the accommodation from a review service.
     */
    async updateStatsFromReview(
        accommodationId: string,
        stats: { reviewsCount: number; averageRating: number; rating: AccommodationRatingType }
    ): Promise<void> {
        await this.model.updateById(accommodationId, {
            reviewsCount: stats.reviewsCount,
            averageRating: stats.averageRating,
            rating: stats.rating
        });
    }
}
