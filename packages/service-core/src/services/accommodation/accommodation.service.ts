import { AccommodationModel } from '@repo/db';
import type { AccommodationSummaryType, AccommodationType } from '@repo/types';
import type { z } from 'zod';
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
}
