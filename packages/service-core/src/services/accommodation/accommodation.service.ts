import { AccommodationFaqModel, AccommodationIaDataModel, AccommodationModel } from '@repo/db';
import {
    type Accommodation,
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
    type AccommodationIdType,
    type AccommodationListWrapper,
    type AccommodationSearchInput,
    AccommodationSearchInputSchema,
    type AccommodationSearchResult,
    type AccommodationStatsOutput,
    type AccommodationStatsWrapper,
    type AccommodationSummaryParams,
    AccommodationSummaryParamsSchema,
    type AccommodationSummaryWrapper,
    type AccommodationTopRatedParams,
    AccommodationTopRatedParamsSchema,
    AccommodationUpdateInputSchema,
    type CountResponse,
    type IdOrSlugParams,
    IdOrSlugParamsSchema,
    ServiceErrorCode,
    type Success,
    type WithOwnerIdParams,
    WithOwnerIdParamsSchema
} from '@repo/schemas';
import { generateSlug } from '@repo/service-core/services/accommodation/accommodation.helpers';
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
    Accommodation,
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
    protected _canUpdate(actor: Actor, entity: Accommodation): void {
        checkCanUpdate(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canSoftDelete(actor: Actor, entity: Accommodation): void {
        checkCanSoftDelete(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canHardDelete(actor: Actor, entity: Accommodation): void {
        checkCanHardDelete(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canRestore(actor: Actor, entity: Accommodation): void {
        checkCanRestore(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canView(actor: Actor, entity: Accommodation): void {
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
        entity: Accommodation,
        _newVisibility: Accommodation['visibility']
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
    ): Promise<Partial<Accommodation>> {
        // Only generate a slug if one is not already provided
        if (!data.slug) {
            const slug = await generateSlug(data.type as string, data.name as string);
            return { slug };
        }
        // If slug is provided, return empty object to avoid overwriting
        return {};
    }

    protected async _afterCreate(entity: Accommodation): Promise<Accommodation> {
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
    ): Promise<CountResponse> {
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
    ): Promise<CountResponse> {
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
     * Search accommodations with destination and owner relations for list display.
     * This method follows the complete service pipeline with validation, permissions,
     * normalization, and lifecycle hooks while providing enriched data for UI lists.
     *
     * @param actor - The actor performing the action
     * @param params - Search parameters including filters and pagination
     * @returns Accommodations with related destination and owner data
     */
    public async searchWithRelations(
        actor: Actor,
        params: AccommodationSearchInput
    ): Promise<ServiceOutput<AccommodationSearchResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'searchWithRelations',
            input: { actor, ...params },
            schema: this.searchSchema,
            execute: async (validatedParams, validatedActor) => {
                // 1. Permission Check
                await this._canSearch(validatedActor);

                // 2. Normalization
                const normalizedParams = this.normalizers?.search
                    ? await this.normalizers.search(validatedParams)
                    : validatedParams;

                // 3. Lifecycle Hook: Before Search
                const processedParams = await this._beforeSearch(normalizedParams, validatedActor);

                // 4. Execute search with relations
                const page = processedParams.page ?? 1;
                const pageSize = processedParams.pageSize ?? 10;

                // Convert AccommodationSearchInput to model parameters format
                const modelParams = {
                    page,
                    pageSize,
                    sortBy: processedParams.sortBy,
                    sortOrder: processedParams.sortOrder,
                    q: processedParams.q,
                    type: processedParams.type,
                    minPrice: processedParams.minPrice,
                    maxPrice: processedParams.maxPrice,
                    destinationId: processedParams.destinationId,
                    amenities: processedParams.amenities,
                    isFeatured: processedParams.isFeatured,
                    isAvailable: processedParams.isAvailable
                };

                const result = await this.model.searchWithRelations(modelParams);

                // 5. Lifecycle Hook: After Search (adapt the result format)
                const adaptedResult = {
                    items: result.items.map((item) => item as Accommodation),
                    total: result.total,
                    page,
                    pageSize
                };

                await this._afterSearch(adaptedResult, validatedActor);

                // 6. Return in AccommodationSearchResult format
                return {
                    data: result.items,
                    pagination: {
                        page,
                        pageSize,
                        total: result.total,
                        totalPages: Math.ceil(result.total / pageSize),
                        hasNextPage: page * pageSize < result.total,
                        hasPreviousPage: page > 1
                    }
                };
            }
        });
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
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTopRated',
            input: { ...params, actor },
            schema: AccommodationTopRatedParamsSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const items = await this.model.findTopRated({
                    limit: validated.limit,
                    destinationId: validated.destinationId
                    // type: validated.type, // Field not available in schema
                    // onlyFeatured: validated.onlyFeatured // Field not available in schema
                });

                const accommodations =
                    items.map(
                        (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                    ) ?? [];

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Gets a summary for a specific accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing id or slug
     * @returns The accommodation summary wrapped in an object
     */
    public async getSummary(
        actor: Actor,
        data: AccommodationSummaryParams
    ): Promise<ServiceOutput<AccommodationSummaryWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { ...data, actor },
            schema: AccommodationSummaryParamsSchema,
            execute: async (validated, actor) => {
                const { id } = validated;
                const entityResult = await this.getByField(actor, 'id', id);
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
                    return { accommodation: null };
                }
                const accommodation = {
                    id: entity.id,
                    type: entity.type,
                    ownerId: entity.ownerId,
                    slug: entity.slug,
                    name: entity.name,
                    summary: entity.summary,
                    isFeatured: entity.isFeatured,
                    reviewsCount: 0,
                    averageRating: 0,
                    media: entity.media,
                    location: entity.location
                };
                return { accommodation };
            }
        });
    }

    /**
     * Gets aggregated statistics for a single accommodation
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodation id or slug
     * @returns The accommodation statistics wrapped in a stats object
     */
    public async getStats(
        actor: Actor,
        data: IdOrSlugParams
    ): Promise<ServiceOutput<AccommodationStatsWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input: { ...data, actor },
            schema: IdOrSlugParamsSchema,
            execute: async (validatedParams, validatedActor) => {
                // Use utility to determine if it's ID or slug
                const { field } = parseIdOrSlug(validatedParams.idOrSlug);

                // Get accommodation using the appropriate base method
                const result = await this.getByField(
                    validatedActor,
                    field,
                    validatedParams.idOrSlug
                );

                if (result.error) {
                    throw new ServiceError(
                        result.error.code as ServiceErrorCode,
                        result.error.message
                    );
                }

                if (!result.data) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }

                // Create the stats object following AccommodationStatsSchema format
                const stats: AccommodationStatsOutput = {
                    total: 1, // Single accommodation
                    totalFeatured: result.data.isFeatured ? 1 : 0,
                    averagePrice: result.data.price?.price,
                    averageRating: result.data.averageRating ?? 0,
                    totalByType: {
                        [result.data.type]: 1
                    }
                };

                // Return wrapped in AccommodationStatsWrapper format
                return { stats };
            }
        });
    }

    /**
     * Gets accommodations by destination.
     * @param actor - The actor performing the action
     * @param data - The input object containing destinationId
     * @returns The list of accommodations wrapped in accommodations array
     */
    public async getByDestination(
        actor: Actor,
        data: AccommodationByDestinationParams
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByDestination',
            input: { ...data, actor },
            schema: AccommodationByDestinationParamsSchema,
            execute: async (validated, actor) => {
                this._canList(actor);
                const result = await this.model.findAll({
                    destinationId: validated.destinationId
                });

                const accommodations = Array.isArray(result.items)
                    ? result.items.map(
                          (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                      )
                    : [];

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Gets top-rated accommodations by destination.
     * @param actor - The actor performing the action
     * @param data - The input object containing destinationId (required)
     * @returns The list of top-rated accommodations for the destination
     */
    public async getTopRatedByDestination(
        actor: Actor,
        data: AccommodationTopRatedParams
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTopRatedByDestination',
            input: { ...data, actor },
            schema: AccommodationTopRatedParamsSchema,
            execute: async (validated, actor) => {
                this._canList(actor);

                // For this method, destinationId is required
                if (!validated.destinationId) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'destinationId is required for getTopRatedByDestination'
                    );
                }

                const items = await this.model.findTopRated({
                    limit: validated.limit,
                    destinationId: validated.destinationId
                });

                const accommodations =
                    items.map(
                        (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                    ) ?? [];

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
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
                    accommodationId: validated.accommodationId as AccommodationIdType
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
                        accommodationId: validated.accommodationId as AccommodationIdType
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
                    accommodationId: validated.accommodationId as AccommodationIdType
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
                        accommodationId: validated.accommodationId as AccommodationIdType
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
     * @returns List of accommodations owned by the specified user
     */
    public async getByOwner(
        input: WithOwnerIdParams,
        actor: Actor
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByOwner',
            input: { actor: actor, ...input },
            schema: WithOwnerIdParamsSchema,
            execute: async (validated, actor) => {
                this._canList(actor);

                const result = await this.model.findAll({
                    ownerId: validated.ownerId
                });

                const accommodations = Array.isArray(result.items)
                    ? result.items.map(
                          (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                      )
                    : [];

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Updates the stats (reviewsCount, averageRating) for the accommodation from a review service.
     */
    async updateStatsFromReview(
        accommodationId: string,
        stats: { reviewsCount: number; averageRating: number }
    ): Promise<void> {
        await this.model.updateById(accommodationId, {
            reviewsCount: stats.reviewsCount,
            averageRating: stats.averageRating
            // rating: stats.rating // Field not available in schema
        });
    }
}
