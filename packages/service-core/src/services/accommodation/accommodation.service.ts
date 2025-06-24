import { AccommodationFaqModel, AccommodationModel } from '@repo/db';
import type { AccommodationSummaryType, AccommodationType } from '@repo/types';
import { ServiceErrorCode } from '@repo/types';
import { z } from 'zod';
import { BaseService } from '../../base';
import type { Actor, ServiceContext, ServiceLogger, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import {
    CreateAccommodationSchema,
    GetAccommodationSchema,
    SearchAccommodationSchema,
    UpdateAccommodationSchema,
    generateSlug,
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from './';
import {
    checkCanCreate,
    checkCanHardDelete,
    checkCanList,
    checkCanRestore,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanView
} from './accommodation.permissions';
import {
    type AddFaqInput,
    AddFaqInputSchema,
    type GetFaqsInput,
    GetFaqsInputSchema,
    type RemoveFaqInput,
    RemoveFaqInputSchema,
    type UpdateFaqInput,
    UpdateFaqInputSchema
} from './accommodation.schemas';

/**
 * Provides accommodation-specific business logic, including creation, updates,
 * permissions, and other operations. It extends the generic `BaseService` to
 * leverage a standardized service pipeline (validation, permissions, hooks, etc.).
 */
export class AccommodationService extends BaseService<
    AccommodationType,
    AccommodationModel,
    typeof CreateAccommodationSchema,
    typeof UpdateAccommodationSchema,
    typeof SearchAccommodationSchema
> {
    /**
     * @inheritdoc
     */
    protected readonly entityName = 'accommodation';
    /**
     * @inheritdoc
     */
    protected readonly model: AccommodationModel;
    /**
     * @inheritdoc
     */
    protected readonly logger: ServiceLogger;

    /**
     * @inheritdoc
     */
    protected readonly createSchema = CreateAccommodationSchema;
    /**
     * @inheritdoc
     */
    protected readonly updateSchema = UpdateAccommodationSchema;

    /**
     * @inheritdoc
     */
    protected readonly searchSchema = SearchAccommodationSchema;

    /**
     * @inheritdoc
     */
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    };

    /**
     * Initializes a new instance of the AccommodationService.
     * @param ctx - The service context, containing the logger.
     */
    constructor(ctx: ServiceContext, model?: AccommodationModel) {
        super();
        this.logger = ctx.logger;
        this.model = model ?? new AccommodationModel();
    }

    // --- Permissions Hooks ---
    /**
     * @inheritdoc
     */
    protected _canCreate(actor: Actor, data: z.infer<typeof CreateAccommodationSchema>): void {
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
        data: z.infer<typeof CreateAccommodationSchema>,
        _actor: Actor
    ): Promise<Partial<AccommodationType>> {
        const slug = await generateSlug(data.type, data.name);
        return { ...data, slug };
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
    protected async _executeSearch(
        params: z.infer<typeof SearchAccommodationSchema>,
        _actor: Actor
    ) {
        const searchParams = {
            ...params,
            filters: {
                ...params.filters,
                ownerId: params.filters?.ownerId as string | undefined
            }
        };
        return this.model.search(searchParams);
    }

    /**
     * @inheritdoc
     * Executes the database count for accommodations.
     * @param params The validated and processed search parameters.
     * @param _actor The actor performing the count.
     * @returns An object containing the total count of accommodations matching the criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof SearchAccommodationSchema>,
        _actor: Actor
    ) {
        const searchParams = {
            ...params,
            filters: {
                ...params.filters,
                ownerId: params.filters?.ownerId as string | undefined
            }
        };
        return this.model.countByFilters(searchParams);
    }

    /**
     * Fetches a summarized, public-facing version of an accommodation.
     * This method is designed to provide a lightweight DTO (Data Transfer Object)
     * for use in lists or cards, excluding sensitive or detailed information.
     * It reuses the base `getByField` method to ensure consistent validation,
     * logging, and permission checks.
     *
     * @param actor The user or system performing the action.
     * @param data An object containing either the `id` or the `slug` of the accommodation.
     * @returns A `ServiceOutput` object containing the summary, `null` if not found, or a `ServiceError`.
     */
    public async getSummary(
        actor: Actor,
        data: z.infer<typeof GetAccommodationSchema>
    ): Promise<ServiceOutput<AccommodationSummaryType | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { actor, ...data },
            schema: GetAccommodationSchema,
            execute: async (validatedData, validatedActor) => {
                const { id, slug } = validatedData;
                const field = id ? 'id' : 'slug';
                const value = id ?? slug;

                const entityResult = await this.getByField(validatedActor, field, value as string);

                if (entityResult.error) {
                    throw new ServiceError(
                        entityResult.error.code,
                        entityResult.error.message,
                        entityResult.error.details
                    );
                }
                if (!entityResult.data) {
                    return null;
                }
                const entity = entityResult.data;

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
     * Gets statistics for accommodations.
     * @param actor - The actor performing the action.
     * @param data - Input object for stats query.
     * @returns Output object (to be defined)
     */
    public async getStats(
        actor: Actor,
        data: z.infer<typeof GetAccommodationSchema>
    ): Promise<
        ServiceOutput<{
            reviewsCount: number;
            averageRating: number;
            rating: AccommodationType['rating'];
        } | null>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input: { actor, ...data },
            schema: GetAccommodationSchema,
            execute: async (validatedData, validatedActor) => {
                const { id, slug } = validatedData;
                const field = id ? 'id' : 'slug';
                const value = id ?? slug;
                const entityResult = await this.getByField(validatedActor, field, value as string);
                if (entityResult.error) {
                    throw new ServiceError(
                        entityResult.error.code,
                        entityResult.error.message,
                        entityResult.error.details
                    );
                }
                if (!entityResult.data) {
                    return null;
                }
                const entity = entityResult.data;
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
     * @param input - Input object for destination query.
     * @param actor - The actor performing the action.
     * @returns Output object (to be defined)
     */
    public async getByDestination(
        actor: Actor,
        data: { destinationId: string }
    ): Promise<ServiceOutput<AccommodationType[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByDestination',
            input: { actor, ...data },
            schema: z.object({ destinationId: z.string().uuid(), actor: z.any() }),
            execute: async (validatedData, validatedActor) => {
                this._canList(validatedActor);
                const result = await this.model.findAll({
                    destinationId: validatedData.destinationId
                });
                return Array.isArray(result.items) ? result.items : [];
            }
        });
    }

    /**
     * Gets top-rated accommodations by destination.
     * @param input - Input object for top-rated query.
     * @param actor - The actor performing the action.
     * @returns Output object (to be defined)
     */
    public async getTopRatedByDestination(_input: object, _actor: Actor): Promise<object> {
        // FUTURE: This method is a stub for future implementation.
        throw new Error('Not implemented');
    }

    /**
     * Adds a FAQ to an accommodation.
     * @param input - Input object for adding FAQ.
     * @param actor - The actor performing the action.
     * @returns Output object (to be defined)
     */
    public async addFaq(
        actor: Actor,
        data: AddFaqInput
    ): Promise<ServiceOutput<{ faq: import('@repo/types').AccommodationFaqType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addFaq',
            input: { actor, ...data },
            schema: AddFaqInputSchema,
            execute: async (validatedData, validatedActor) => {
                const accommodation = await this.model.findById(validatedData.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canUpdate(validatedActor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faqToCreate = {
                    ...validatedData.faq,
                    accommodationId: validatedData.accommodationId as import(
                        '@repo/types'
                    ).AccommodationId
                };
                const createdFaq = await faqModel.create(faqToCreate);
                return { faq: createdFaq };
            }
        });
    }

    /**
     * Removes a FAQ from an accommodation.
     * @param actor - The actor performing the action.
     * @param data - Input object for removing FAQ.
     * @returns Output object (to be defined)
     */
    public async removeFaq(
        actor: Actor,
        data: RemoveFaqInput
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeFaq',
            input: { actor, ...data },
            schema: RemoveFaqInputSchema,
            execute: async (validatedData, validatedActor) => {
                const accommodation = await this.model.findById(validatedData.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canUpdate(validatedActor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faq = await faqModel.findById(validatedData.faqId);
                if (!faq || faq.accommodationId !== validatedData.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'FAQ not found for this accommodation'
                    );
                }
                await faqModel.hardDelete({ id: validatedData.faqId });
                return { success: true };
            }
        });
    }

    /**
     * Updates a FAQ for an accommodation.
     * @param actor - The actor performing the action.
     * @param data - Input object for updating FAQ.
     * @returns Output object (to be defined)
     */
    public async updateFaq(
        actor: Actor,
        data: UpdateFaqInput
    ): Promise<ServiceOutput<{ faq: import('@repo/types').AccommodationFaqType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateFaq',
            input: { actor, ...data },
            schema: UpdateFaqInputSchema,
            execute: async (validatedData, validatedActor) => {
                const accommodation = await this.model.findById(validatedData.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canUpdate(validatedActor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faq = await faqModel.findById(validatedData.faqId);
                if (!faq || faq.accommodationId !== validatedData.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'FAQ not found for this accommodation'
                    );
                }
                const updatedFaq = await faqModel.update(
                    { id: validatedData.faqId },
                    validatedData.faq
                );
                if (!updatedFaq) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update FAQ');
                }
                return { faq: updatedFaq };
            }
        });
    }

    /**
     * Gets FAQs for an accommodation.
     * @param actor - The actor performing the action.
     * @param data - Input object for getting FAQs.
     * @returns Output object (to be defined)
     */
    public async getFaqs(
        actor: Actor,
        data: GetFaqsInput
    ): Promise<ServiceOutput<{ faqs: import('@repo/types').AccommodationFaqType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFaqs',
            input: { actor, ...data },
            schema: GetFaqsInputSchema,
            execute: async (validatedData, validatedActor) => {
                const accommodation = await this.model.findById(validatedData.accommodationId);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                this._canView(validatedActor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const { items: faqs } = await faqModel.findAll({
                    accommodationId: validatedData.accommodationId
                });
                return { faqs };
            }
        });
    }

    /**
     * Adds IA data to an accommodation.
     * @param input - Input object for adding IA data.
     * @param actor - The actor performing the action.
     * @returns Output object (to be defined)
     */
    public async addIAData(_input: object, _actor: Actor): Promise<object> {
        // FUTURE: This method is a stub for future implementation.
        throw new Error('Not implemented');
    }

    /**
     * Removes IA data from an accommodation.
     * @param input - Input object for removing IA data.
     * @param actor - The actor performing the action.
     * @returns Output object (to be defined)
     */
    public async removeIAData(_input: object, _actor: Actor): Promise<object> {
        // FUTURE: This method is a stub for future implementation.
        throw new Error('Not implemented');
    }

    /**
     * Updates IA data for an accommodation.
     * @param input - Input object for updating IA data.
     * @param actor - The actor performing the action.
     * @returns Output object (to be defined)
     */
    public async updateIAData(_input: object, _actor: Actor): Promise<object> {
        // FUTURE: This method is a stub for future implementation.
        throw new Error('Not implemented');
    }

    /**
     * Gets all IA data for an accommodation.
     * @param input - Input object for getting all IA data.
     * @param actor - The actor performing the action.
     * @returns Output object (to be defined)
     */
    public async getAllIAData(_input: object, _actor: Actor): Promise<object> {
        // FUTURE: This method is a stub for future implementation.
        throw new Error('Not implemented');
    }

    /**
     * Gets accommodations by owner.
     * @param input - Input object for owner query.
     * @param actor - The actor performing the action.
     * @returns Output object (to be defined)
     */
    public async getByOwner(_input: object, _actor: Actor): Promise<object> {
        // FUTURE: This method is a stub for future implementation.
        throw new Error('Not implemented');
    }
}
