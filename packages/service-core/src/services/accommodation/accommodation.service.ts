import { AccommodationModel } from '@repo/db';
import { logger } from '@repo/logger';
import type {
    AccommodationType,
    NewAccommodationInputType,
    UpdateAccommodationInputType
} from '@repo/types';
import { PermissionEnum } from '@repo/types';
import { toSlug } from '../../../../utils/src/string';
import { BaseService } from '../../base/base.service';
import {
    type Actor,
    type CanCreateResult,
    type CanDeleteResult,
    type CanHardDeleteResult,
    type CanRestoreResult,
    type CanUpdateResult,
    type CanViewResult,
    EntityPermissionReasonEnum,
    ServiceErrorCode,
    type ServiceInput,
    type ServiceOutput
} from '../../types';
import { logDenied } from '../../utils/logging';
import {
    type EntityPermissionActor,
    type EntityPermissionInput,
    getEntityPermission,
    hasPermission
} from '../../utils/permission';
import { validateEntity } from '../../utils/validation';
import {
    NewAccommodationInputSchema,
    SearchAccommodationFiltersSchema
} from './accommodation.schemas';

// Define the type for search filters (outside the class)
export type SearchAccommodationFilters = {
    type?: string;
    destinationId?: string;
    amenityIds?: string[];
    featureIds?: string[];
    name?: string;
    slug?: string;
};

/**
 * Service for managing accommodations.
 * @extends {BaseService<AccommodationType, AccommodationCreateInput, AccommodationUpdateInput, AccommodationListInput, AccommodationListOutput>}
 */
export class AccommodationService extends BaseService<
    AccommodationType,
    NewAccommodationInputType,
    UpdateAccommodationInputType,
    unknown,
    AccommodationType[]
> {
    protected model = new AccommodationModel();
    protected logger = logger;
    protected inputSchema = NewAccommodationInputSchema as unknown as import(
        'zod'
    ).ZodType<NewAccommodationInputType>;

    /**
     * Creates a new AccommodationService.
     */
    constructor() {
        super('accommodation');
    }

    /**
     * Lists accommodations based on input criteria.
     */
    public async list(input: ServiceInput<unknown>): Promise<ServiceOutput<AccommodationType[]>> {
        return this.runWithLoggingAndValidation('list', input, async (_actor, input) => {
            const normalizedInput = await this.normalizeListInput(input);
            return await this.model.findAll(normalizedInput as Record<string, unknown>);
        });
    }

    /**
     * Creates a new accommodation.
     */
    public async create(
        input: ServiceInput<NewAccommodationInputType>
    ): Promise<ServiceOutput<AccommodationType>> {
        return this.runWithLoggingAndValidation(
            'create',
            input,
            async (actor, input) => {
                const canCreate = await this.canCreateEntity(actor);
                if (!canCreate.canCreate) {
                    logDenied(actor, input, null, canCreate.reason, 'create');
                    throw new Error(`Cannot create ${this.entityName}`);
                }
                const normalizedInput = await this.normalizeCreateInput(input);
                return await this.model.create(normalizedInput as Partial<AccommodationType>);
            },
            this.inputSchema
        );
    }

    /**
     * Updates an existing accommodation.
     */
    public async update(
        input: ServiceInput<UpdateAccommodationInputType>
    ): Promise<ServiceOutput<AccommodationType>> {
        return this.runWithLoggingAndValidation(
            'update',
            input,
            async (actor, input) => {
                if (!input.id) {
                    throw new Error('Missing accommodation id');
                }
                const entity = (await this.model.findById(input.id)) ?? null;
                if (!entity) {
                    throw new Error(`${this.entityName} not found`);
                }
                validateEntity(entity, this.entityName);
                const canUpdate = await this.canUpdateEntity(actor, entity);
                if (!canUpdate.canUpdate) {
                    logDenied(actor, input, entity, canUpdate.reason, 'update');
                    throw new Error(`Cannot update ${this.entityName}`);
                }
                const normalizedInput = await this.normalizeUpdateInput(input);
                const updated = await this.model.update(
                    { id: input.id },
                    normalizedInput as Partial<AccommodationType>
                );
                if (!updated) {
                    throw new Error('Accommodation not found after update');
                }
                return updated;
            },
            this.inputSchema
        );
    }

    /**
     * Checks if an actor can view an accommodation.
     */
    protected async canViewEntity(actor: Actor, entity: AccommodationType): Promise<CanViewResult> {
        if (entity.deletedAt) {
            return { canView: false, reason: EntityPermissionReasonEnum.DELETED };
        }
        if (entity.isFeatured) {
            return { canView: true, reason: EntityPermissionReasonEnum.PUBLIC_ACCESS };
        }
        if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL)) {
            return { canView: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        const result = getEntityPermission(
            actor as EntityPermissionActor,
            entity as EntityPermissionInput,
            'view'
        );
        return {
            canView: result.allowed,
            reason: result.reason
        };
    }

    /**
     * Checks if an actor can update an accommodation.
     */
    protected async canUpdateEntity(
        actor: Actor,
        entity: AccommodationType
    ): Promise<CanUpdateResult> {
        if (entity.deletedAt) {
            return { canUpdate: false, reason: EntityPermissionReasonEnum.DELETED };
        }
        const isAdmin = actor.role === 'ADMIN';
        const isHost = actor.role === 'HOST';
        const isOwner = actor.id === entity.ownerId;
        const hasAny = isAdmin && hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_ANY);
        const hasOwn =
            isOwner &&
            (isHost || isAdmin) &&
            hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_OWN);
        const result = getEntityPermission(
            actor as EntityPermissionActor,
            entity as EntityPermissionInput,
            'update',
            { hasAny, hasOwn }
        );
        return {
            canUpdate: result.allowed,
            reason: result.reason
        };
    }

    /**
     * Checks if an actor can delete an accommodation.
     */
    protected async canDeleteEntity(
        actor: Actor,
        entity: AccommodationType
    ): Promise<CanDeleteResult> {
        if (entity.deletedAt) {
            return { canDelete: false, reason: EntityPermissionReasonEnum.DELETED };
        }
        const isAdmin = actor.role === 'ADMIN';
        const isHost = actor.role === 'HOST';
        const isOwner = actor.id === entity.ownerId;
        const hasAny = isAdmin && hasPermission(actor, PermissionEnum.ACCOMMODATION_DELETE_ANY);
        const hasOwn =
            isOwner &&
            (isHost || isAdmin) &&
            hasPermission(actor, PermissionEnum.ACCOMMODATION_DELETE_OWN);
        const result = getEntityPermission(
            actor as EntityPermissionActor,
            entity as EntityPermissionInput,
            'delete',
            { hasAny, hasOwn }
        );
        return {
            canDelete: result.allowed,
            reason: result.reason
        };
    }

    /**
     * Checks if an actor can create an accommodation.
     */
    protected async canCreateEntity(actor: Actor): Promise<CanCreateResult> {
        if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_CREATE)) {
            return { canCreate: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canCreate: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if an actor can restore an accommodation.
     */
    protected async canRestoreEntity(
        actor: Actor,
        entity: AccommodationType
    ): Promise<CanRestoreResult> {
        if (entity.deletedAt) {
            return { canRestore: false, reason: EntityPermissionReasonEnum.DELETED };
        }
        const isAdmin = actor.role === 'ADMIN';
        const isHost = actor.role === 'HOST';
        const isOwner = actor.id === entity.ownerId;
        const hasAny = isAdmin && hasPermission(actor, PermissionEnum.ACCOMMODATION_RESTORE_ANY);
        const hasOwn =
            isOwner &&
            (isHost || isAdmin) &&
            hasPermission(actor, PermissionEnum.ACCOMMODATION_RESTORE_OWN);
        const result = getEntityPermission(
            actor as EntityPermissionActor,
            entity as EntityPermissionInput,
            'restore',
            { hasAny, hasOwn }
        );
        return {
            canRestore: result.allowed,
            reason: result.reason
        };
    }

    /**
     * Normalizes the input for creating an accommodation.
     * @param {ServiceInput<NewAccommodationInputType>} input - The input to normalize
     * @returns {Promise<ServiceInput<NewAccommodationInputType>>} The normalized input
     */
    protected async normalizeCreateInput(
        input: ServiceInput<NewAccommodationInputType>
    ): Promise<ServiceInput<NewAccommodationInputType>> {
        return {
            ...input,
            visibility: input.visibility ?? 'PRIVATE'
        };
    }

    /**
     * Normalizes the input for updating an accommodation.
     * @param {ServiceInput<UpdateAccommodationInputType>} input - The input to normalize
     * @returns {Promise<ServiceInput<UpdateAccommodationInputType>>} The normalized input
     */
    protected async normalizeUpdateInput(
        input: ServiceInput<UpdateAccommodationInputType>
    ): Promise<ServiceInput<UpdateAccommodationInputType>> {
        return input;
    }

    /**
     * Normalizes the input for listing accommodations.
     * @param {ServiceInput<unknown>} input - The input to normalize
     * @returns {Promise<ServiceInput<unknown>>} The normalized input
     */
    protected async normalizeListInput(
        input: ServiceInput<unknown>
    ): Promise<ServiceInput<unknown>> {
        return input;
    }

    /**
     * Lists accommodations based on input criteria.
     * @param {ServiceInput<unknown>} input - The input containing list criteria
     * @returns {Promise<ServiceOutput<AccommodationType[]>>} The list of accommodations
     */
    protected async listEntities(_input: ServiceInput<unknown>): Promise<AccommodationType[]> {
        return [];
    }

    protected canHardDeleteEntity(actor: Actor, entity: AccommodationType): CanHardDeleteResult {
        if (entity.deletedAt) {
            return {
                canHardDelete: false,
                reason: EntityPermissionReasonEnum.DELETED,
                checkedPermission: PermissionEnum.ACCOMMODATION_HARD_DELETE
            };
        }
        if (actor.role !== 'SUPER_ADMIN') {
            return {
                canHardDelete: false,
                reason: EntityPermissionReasonEnum.NOT_SUPER_ADMIN,
                checkedPermission: PermissionEnum.ACCOMMODATION_HARD_DELETE
            };
        }
        if (!actor.permissions.includes(PermissionEnum.ACCOMMODATION_HARD_DELETE)) {
            return {
                canHardDelete: false,
                reason: EntityPermissionReasonEnum.MISSING_PERMISSION,
                checkedPermission: PermissionEnum.ACCOMMODATION_HARD_DELETE
            };
        }
        return {
            canHardDelete: true,
            reason: EntityPermissionReasonEnum.SUPER_ADMIN,
            checkedPermission: PermissionEnum.ACCOMMODATION_HARD_DELETE
        };
    }

    /**
     * Wrapper para count que adapta los params a AccommodationSearchParams.
     */
    public async count(params: Record<string, unknown>): Promise<number> {
        return this.model.count(params);
    }

    /**
     * Filtra entidades por permiso de visibilidad y loggea grants/denegaciones.
     */
    private async filterByViewPermission(
        actor: Actor,
        entities: AccommodationType[],
        input: unknown
    ): Promise<AccommodationType[]> {
        const visibles: AccommodationType[] = [];
        for (const entity of entities) {
            const canView = await this.canViewEntity(actor, entity);
            if (canView.canView) {
                this.logGrant(actor, input, entity, 'view', canView.reason);
                visibles.push(entity);
            } else {
                this.logDenied(actor, input, entity, canView.reason, 'view');
            }
        }
        return visibles;
    }

    public async getWithRelations(
        input: ServiceInput<{ id: string; relations: Record<string, boolean> }>
    ): Promise<ServiceOutput<AccommodationType | null>> {
        if (!input.id || typeof input.id !== 'string') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'id is required and must be a string'
                }
            };
        }
        if (!input.relations || typeof input.relations !== 'object') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'relations is required and must be an object'
                }
            };
        }
        return this.runWithLoggingAndValidation('getWithRelations', input, async (actor, input) => {
            const accommodation = await this.model.findWithRelations(
                { id: input.id },
                input.relations
            );
            if (!accommodation) return null;
            const canView = await this.canViewEntity(actor, accommodation);
            if (!canView.canView) {
                this.logDenied(actor, input, accommodation, canView.reason, 'view');
                return null;
            }
            this.logGrant(actor, input, accommodation, 'view', canView.reason);
            return accommodation;
        });
    }

    public async getByDestinationId(
        input: ServiceInput<{ destinationId: string }>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        if (!input.destinationId || typeof input.destinationId !== 'string') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'destinationId is required and must be a string'
                }
            };
        }
        return this.runWithLoggingAndValidation(
            'getByDestinationId',
            input,
            async (actor, input) => {
                const accommodations = await this.model.findAll({
                    destinationId: input.destinationId
                });
                return await this.filterByViewPermission(actor, accommodations, input);
            }
        );
    }

    public async getByType(
        input: ServiceInput<{ type: string }>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        if (!input.type || typeof input.type !== 'string') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'type is required and must be a string'
                }
            };
        }
        return this.runWithLoggingAndValidation('getByType', input, async (actor, input) => {
            const accommodations = await this.model.findAll({ type: input.type });
            return await this.filterByViewPermission(actor, accommodations, input);
        });
    }

    public async getByAmenity(
        input: ServiceInput<{ amenityId?: string; amenitySlug?: string }>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        if (
            (!input.amenityId || typeof input.amenityId !== 'string') &&
            (!input.amenitySlug || typeof input.amenitySlug !== 'string')
        ) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'amenityId or amenitySlug is required and must be a string'
                }
            };
        }
        return this.runWithLoggingAndValidation('getByAmenity', input, async (actor, input) => {
            if (input.amenityId) {
                const accommodations = await this.model.findAll({
                    'amenities.amenityId': input.amenityId
                });
                return await this.filterByViewPermission(actor, accommodations, input);
            }
            if (input.amenitySlug) {
                throw new Error('Not implemented: search by amenitySlug');
            }
            return [];
        });
    }

    public async getByFeature(
        input: ServiceInput<{ featureId?: string; featureSlug?: string }>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        if (
            (!input.featureId || typeof input.featureId !== 'string') &&
            (!input.featureSlug || typeof input.featureSlug !== 'string')
        ) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'featureId or featureSlug is required and must be a string'
                }
            };
        }
        return this.runWithLoggingAndValidation('getByFeature', input, async (actor, input) => {
            if (input.featureId) {
                const accommodations = await this.model.findAll({
                    'features.featureId': input.featureId
                });
                return await this.filterByViewPermission(actor, accommodations, input);
            }
            if (input.featureSlug) {
                throw new Error('Not implemented: search by featureSlug');
            }
            return [];
        });
    }

    public async getSummary(
        input: ServiceInput<{ id?: string; slug?: string }>
    ): Promise<ServiceOutput<Partial<AccommodationType> | null>> {
        if (
            (!input.id || typeof input.id !== 'string') &&
            (!input.slug || typeof input.slug !== 'string')
        ) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'id or slug is required and must be a string'
                }
            };
        }
        return this.runWithLoggingAndValidation('getSummary', input, async (actor, input) => {
            let accommodation: AccommodationType | null = null;
            if (input.id) {
                accommodation = await this.model.findById(input.id);
            } else if (input.slug) {
                accommodation = await this.model.findOne({ slug: input.slug });
            }
            if (!accommodation) return null;
            const canView = await this.canViewEntity(actor, accommodation);
            if (!canView.canView) {
                this.logDenied(actor, input, accommodation, canView.reason, 'view');
                return null;
            }
            this.logGrant(actor, input, accommodation, 'view', canView.reason);
            const summary: Partial<AccommodationType> = {
                id: accommodation.id,
                name: accommodation.name,
                slug: accommodation.slug,
                summary: accommodation.summary,
                media: accommodation.media,
                rating: accommodation.rating,
                reviewsCount: accommodation.reviewsCount
            };
            return summary;
        });
    }

    public async getSimilar(
        input: ServiceInput<{ id?: string; slug?: string }>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        if (
            (!input.id || typeof input.id !== 'string') &&
            (!input.slug || typeof input.slug !== 'string')
        ) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'id or slug is required and must be a string'
                }
            };
        }
        return this.runWithLoggingAndValidation('getSimilar', input, async (actor, input) => {
            let base: AccommodationType | null = null;
            if (input.id) {
                base = await this.model.findById(input.id);
            } else if (input.slug) {
                base = await this.model.findOne({ slug: input.slug });
            }
            if (!base) return [];
            const similars = await this.model.findAll({
                destinationId: base.destinationId,
                type: base.type
            });
            const filtered = similars.filter((a) => a.id !== base?.id).slice(0, 10);
            return await this.filterByViewPermission(actor, filtered, input);
        });
    }

    public async getTopRated(
        input: ServiceInput<{ destinationId?: string }>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        if (input.destinationId && typeof input.destinationId !== 'string') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'destinationId must be a string if provided'
                }
            };
        }
        return this.runWithLoggingAndValidation('getTopRated', input, async (actor, input) => {
            const filter: Record<string, unknown> = {};
            if (input.destinationId) {
                filter.destinationId = input.destinationId;
            }
            let accommodations = await this.model.findAll(filter);
            accommodations = accommodations
                .slice()
                .sort((a, b) => {
                    const ra = a.rating?.cleanliness ?? 0;
                    const rb = b.rating?.cleanliness ?? 0;
                    return rb - ra;
                })
                .slice(0, 10);
            return await this.filterByViewPermission(actor, accommodations, input);
        });
    }

    public async getReviews(
        input: ServiceInput<{ id?: string; slug?: string }>
    ): Promise<ServiceOutput<unknown[]>> {
        if (
            (!input.id || typeof input.id !== 'string') &&
            (!input.slug || typeof input.slug !== 'string')
        ) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'id or slug is required and must be a string'
                }
            };
        }
        return this.runWithLoggingAndValidation('getReviews', input, async (actor, input) => {
            let accommodation: AccommodationType | null = null;
            if (input.id) {
                accommodation = await this.model.findById(input.id);
            } else if (input.slug) {
                accommodation = await this.model.findOne({ slug: input.slug });
            }
            if (!accommodation) return [];
            const canView = await this.canViewEntity(actor, accommodation);
            if (!canView.canView) {
                this.logDenied(actor, input, accommodation, canView.reason, 'view');
                return [];
            }
            this.logGrant(actor, input, accommodation, 'view', canView.reason);
            return accommodation.reviews ?? [];
        });
    }

    /**
     * Generates a URL-friendly slug for an accommodation: type + name.
     * At least one of type or name must be non-empty, otherwise throws an error.
     * @param type - Accommodation type (enum or string)
     * @param name - Accommodation name
     * @returns The generated slug
     * @throws {Error} If both type and name are empty
     */
    public override generateSlug(type: string, name: string): string {
        if (!type && !name) {
            throw new Error('At least one of type or name must be provided to generate a slug');
        }
        return toSlug(`${type}-${name}`);
    }

    /**
     * Helper to build a filter object for AccommodationModel from search filters.
     * @param filters - SearchAccommodationFilters
     * @returns Filter object for the model
     */
    private buildAccommodationFilter(filters: SearchAccommodationFilters): Record<string, unknown> {
        const filter: Record<string, unknown> = {};
        if (filters.type) filter.type = filters.type;
        if (filters.destinationId) filter.destinationId = filters.destinationId;
        if (filters.name) filter.name = filters.name;
        if (filters.slug) filter.slug = filters.slug;
        if (filters.amenityIds && filters.amenityIds.length > 0) {
            filter['amenities.amenityId'] = { $in: filters.amenityIds };
        }
        if (filters.featureIds && filters.featureIds.length > 0) {
            filter['features.featureId'] = { $in: filters.featureIds };
        }
        return filter;
    }

    /**
     * Searches for accommodations using multiple filters.
     * @param input - SearchAccommodationFilters
     * @returns Filtered accommodations with permission filtering
     */
    protected async searchEntities(
        input: SearchAccommodationFilters
    ): Promise<AccommodationType[]> {
        const filter = this.buildAccommodationFilter(input);
        const accommodations = await this.model.findAll(filter);
        // Permission filtering is handled by filterByViewPermission in the public search method
        return accommodations;
    }

    /**
     * Public search method supporting multiple filters.
     */
    public async search(
        input: ServiceInput<SearchAccommodationFilters>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        // Validation aligned with the rest of the methods
        if (!input.actor) {
            return {
                error: {
                    code: ServiceErrorCode.UNAUTHORIZED,
                    message: 'Actor is required'
                }
            };
        }
        // Validate filter types with Zod
        const parseResult = SearchAccommodationFiltersSchema.safeParse(input);
        if (!parseResult.success) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: parseResult.error.errors.map((e) => e.message).join('; ')
                }
            };
        }
        const filters = input;
        if (
            !filters.type &&
            !filters.destinationId &&
            (!filters.amenityIds || filters.amenityIds.length === 0) &&
            (!filters.featureIds || filters.featureIds.length === 0) &&
            !filters.name &&
            !filters.slug
        ) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message:
                        'At least one filter (type, destinationId, amenityIds, featureIds, name, slug) is required'
                }
            };
        }
        return this.runWithLoggingAndValidation('search', input, async (actor, input) => {
            const accommodations = await this.searchEntities(input);
            return await this.filterByViewPermission(actor, accommodations, input);
        });
    }
}
