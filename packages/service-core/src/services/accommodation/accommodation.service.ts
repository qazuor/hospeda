import { AccommodationModel } from '@repo/db';
import { logger } from '@repo/logger';
import type {
    AccommodationSummaryType,
    AccommodationType,
    NewAccommodationInputType,
    UpdateAccommodationInputType
} from '@repo/types';
import { PermissionEnum, RoleEnum } from '@repo/types';
import { createUniqueSlug } from '@repo/utils';
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
import { logDenied, logPermission } from '../../utils/logging';
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
 * AccommodationService provides all business logic and permission checks for managing accommodations.
 * Handles creation, update, deletion, restoration, advanced search, and permission filtering.
 * Extends BaseService to inherit common CRUD and permission logic.
 *
 * @remarks
 * - All methods validate input and actor before performing operations.
 * - Uses Drizzle ORM for database access via AccommodationModel.
 * - Applies permission checks for all sensitive operations.
 * - All errors are returned in ServiceOutput with a ServiceErrorCode.
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
    protected hardDeleteRoles: RoleEnum[] = [RoleEnum.SUPER_ADMIN];

    /**
     * Constructs a new AccommodationService instance.
     * @constructor
     */
    constructor() {
        super('accommodation');
    }

    /**
     * Lists accommodations based on input criteria.
     * @param input - The input containing list criteria and actor
     * @returns A promise resolving to a ServiceOutput with an array of accommodations or an error
     */
    public async list(input: ServiceInput<unknown>): Promise<ServiceOutput<AccommodationType[]>> {
        return this.runWithLoggingAndValidation('list', input, async (_actor, input) => {
            const normalizedInput = await this.normalizeListInput(input);
            const result = await this.model.findAll(normalizedInput as Record<string, unknown>);
            const accommodations = Array.isArray(result)
                ? result
                : typeof result === 'object' && result !== null && 'items' in result
                  ? (result as { items: AccommodationType[] }).items
                  : [];
            return accommodations;
        });
    }

    /**
     * Creates a new accommodation, generating a unique slug before creation.
     * @param input - The input for creating the accommodation, including actor
     * @returns A promise resolving to a ServiceOutput with the created accommodation or an error
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
                // Generate unique slug
                const slug = await this.generateSlug(
                    input.type ?? '',
                    input.name ?? '',
                    async (slug: string) => !!(await this.model.findOne({ slug }))
                );
                const normalizedInput = await this.normalizeCreateInput({ ...input, slug });
                return await this.model.create(normalizedInput as Partial<AccommodationType>);
            },
            this.inputSchema
        );
    }

    /**
     * Updates an existing accommodation, regenerating the slug if type or name changes.
     * @param input - The input for updating the accommodation, must include id and actor
     * @returns A promise resolving to a ServiceOutput with the updated accommodation or an error
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
                let normalizedInput = await this.normalizeUpdateInput(input);
                // Regenerate slug if type or name changes
                const typeChanged =
                    normalizedInput.type !== undefined && normalizedInput.type !== entity.type;
                const nameChanged =
                    normalizedInput.name !== undefined && normalizedInput.name !== entity.name;
                if (typeChanged || nameChanged) {
                    const slug = await this.generateSlug(
                        normalizedInput.type ?? entity.type,
                        normalizedInput.name ?? entity.name,
                        async (slug: string) =>
                            !!(await this.model.findOne({ slug, id: { $ne: entity.id } }))
                    );
                    normalizedInput = { ...normalizedInput, slug };
                }
                const result = await this.model.update(
                    { id: input.id },
                    normalizedInput as Partial<AccommodationType>
                );
                if (!result) {
                    throw new Error('Accommodation not found after update');
                }
                return result;
            },
            this.inputSchema
        );
    }

    /**
     * Checks if an actor can view a specific accommodation entity.
     * @param actor - The actor to check
     * @param entity - The accommodation entity to check
     * @returns A promise resolving to CanViewResult with permission and reason
     */
    protected async canViewEntity(actor: Actor, entity: AccommodationType): Promise<CanViewResult> {
        logPermission(PermissionEnum.ACCOMMODATION_VIEW_ALL, actor, entity);
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
     * Checks if an actor can update a specific accommodation entity.
     * @param actor - The actor to check
     * @param entity - The accommodation entity to check
     * @returns A promise resolving to CanUpdateResult with permission and reason
     */
    protected async canUpdateEntity(
        actor: Actor,
        entity: AccommodationType
    ): Promise<CanUpdateResult> {
        logPermission(PermissionEnum.ACCOMMODATION_UPDATE_ANY, actor, entity);
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
     * Checks if an actor can delete a specific accommodation entity.
     * @param actor - The actor to check
     * @param entity - The accommodation entity to check
     * @returns A promise resolving to CanDeleteResult with permission and reason
     */
    protected async canDeleteEntity(
        actor: Actor,
        entity: AccommodationType
    ): Promise<CanDeleteResult> {
        logPermission(PermissionEnum.ACCOMMODATION_DELETE_ANY, actor, entity);
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
     * Checks if an actor can create a new accommodation.
     * @param actor - The actor to check
     * @returns A promise resolving to CanCreateResult with permission and reason
     */
    protected async canCreateEntity(actor: Actor): Promise<CanCreateResult> {
        logPermission(PermissionEnum.ACCOMMODATION_CREATE, actor, null);
        if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_CREATE)) {
            return { canCreate: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canCreate: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if an actor can restore a soft-deleted accommodation entity.
     * @param actor - The actor to check
     * @param entity - The accommodation entity to check
     * @returns A promise resolving to CanRestoreResult with permission and reason
     */
    protected async canRestoreEntity(
        actor: Actor,
        entity: AccommodationType
    ): Promise<CanRestoreResult> {
        logPermission(PermissionEnum.ACCOMMODATION_RESTORE_ANY, actor, entity);
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
     * Normalizes the input for creating an accommodation. Sets default visibility if not provided.
     * @param input - The input to normalize
     * @returns A promise resolving to the normalized input
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
     * Normalizes the input for updating an accommodation. Currently returns input as-is.
     * @param input - The input to normalize
     * @returns A promise resolving to the normalized input
     */
    protected async normalizeUpdateInput(
        input: ServiceInput<UpdateAccommodationInputType>
    ): Promise<ServiceInput<UpdateAccommodationInputType>> {
        return input;
    }

    /**
     * Normalizes the input for listing accommodations. Currently returns input as-is.
     * @param input - The input to normalize
     * @returns A promise resolving to the normalized input
     */
    protected async normalizeListInput(
        input: ServiceInput<unknown>
    ): Promise<ServiceInput<unknown>> {
        return input;
    }

    /**
     * Lists accommodations based on input criteria. (Stub for extension)
     * @param _input - The input containing list criteria
     * @returns A promise resolving to an array of accommodations (empty by default)
     */
    protected async listEntities(_input: ServiceInput<unknown>): Promise<AccommodationType[]> {
        return [];
    }

    /**
     * Checks if an actor can hard delete an accommodation entity.
     * Only SUPER_ADMIN with the correct permission can hard delete.
     * @param actor - The actor to check
     * @param entity - The accommodation entity to check
     * @returns CanHardDeleteResult with permission, reason, and checked permission
     */
    protected canHardDeleteEntity(actor: Actor, entity: AccommodationType): CanHardDeleteResult {
        logPermission(PermissionEnum.ACCOMMODATION_HARD_DELETE, actor, entity);
        if (entity.deletedAt) {
            return {
                canHardDelete: false,
                reason: EntityPermissionReasonEnum.DELETED,
                checkedPermission: PermissionEnum.ACCOMMODATION_HARD_DELETE
            };
        }
        if (!this.hardDeleteRoles.includes(actor.role)) {
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
     * Counts the number of accommodations matching the given parameters.
     * @param params - Parameters to filter accommodations
     * @returns A promise resolving to the count
     */
    public async count(params: Record<string, unknown>): Promise<number> {
        return this.model.count(params);
    }

    /**
     * Filters entities by view permission and logs grants/denials for each entity.
     * @param actor - The actor to check permissions for
     * @param entities - The list of entities to filter
     * @param input - The original input for logging context
     * @returns A promise resolving to the list of entities the actor can view
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

    /**
     * Retrieves an accommodation with its related entities based on the provided relations object.
     * Validates permissions before returning the entity.
     * @param input - Object containing the accommodation id and a relations map
     * @returns A ServiceOutput with the accommodation and its relations, or an error/null if not found or forbidden
     */
    public async getWithRelations(
        input: ServiceInput<{ id: string; relations: Record<string, boolean> }>
    ): Promise<ServiceOutput<AccommodationType | null>> {
        if (!input.id || typeof input.id !== 'string') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'id is required and must be a string',
                    details: { received: input.id }
                }
            };
        }
        if (!input.relations || typeof input.relations !== 'object') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'relations is required and must be an object',
                    details: { received: input.relations }
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

    /**
     * Retrieves all accommodations for a given destinationId, filtered by view permission.
     * @param input - Object containing the destinationId and actor
     * @returns A ServiceOutput with an array of accommodations or an error
     */
    public async getByDestinationId(
        input: ServiceInput<{ destinationId: string }>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        if (!input.destinationId || typeof input.destinationId !== 'string') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'destinationId is required and must be a string',
                    details: { received: input.destinationId }
                }
            };
        }
        return this.runWithLoggingAndValidation(
            'getByDestinationId',
            input,
            async (actor, input) => {
                const result = await this.model.findAll({
                    destinationId: input.destinationId
                });
                const accommodations = Array.isArray(result)
                    ? result
                    : typeof result === 'object' && result !== null && 'items' in result
                      ? (result as { items: AccommodationType[] }).items
                      : [];
                return await this.filterByViewPermission(actor, accommodations, input);
            }
        );
    }

    /**
     * Retrieves all accommodations of a given type, filtered by view permission.
     * @param input - Object containing the type and actor
     * @returns A ServiceOutput with an array of accommodations or an error
     */
    public async getByType(
        input: ServiceInput<{ type: string }>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        if (!input.type || typeof input.type !== 'string') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'type is required and must be a string',
                    details: { received: input.type }
                }
            };
        }
        return this.runWithLoggingAndValidation('getByType', input, async (actor, input) => {
            const result = await this.model.findAll({ type: input.type });
            const accommodations = Array.isArray(result)
                ? result
                : typeof result === 'object' && result !== null && 'items' in result
                  ? (result as { items: AccommodationType[] }).items
                  : [];
            return await this.filterByViewPermission(actor, accommodations, input);
        });
    }

    /**
     * Retrieves all accommodations with a given amenity, filtered by view permission.
     * @param input - Object containing amenityId or amenitySlug and actor
     * @returns A ServiceOutput with an array of accommodations or an error
     */
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
                    message: 'amenityId or amenitySlug is required and must be a string',
                    details: {
                        received: { amenityId: input.amenityId, amenitySlug: input.amenitySlug }
                    }
                }
            };
        }
        return this.runWithLoggingAndValidation('getByAmenity', input, async (actor, input) => {
            if (input.amenityId) {
                const result = await this.model.findAll({
                    'amenities.amenityId': input.amenityId
                });
                const accommodations = Array.isArray(result)
                    ? result
                    : typeof result === 'object' && result !== null && 'items' in result
                      ? (result as { items: AccommodationType[] }).items
                      : [];
                return await this.filterByViewPermission(actor, accommodations, input);
            }
            if (input.amenitySlug) {
                throw Object.assign(new Error('Not implemented: search by amenitySlug'), {
                    details: { received: input.amenitySlug }
                });
            }
            return [];
        });
    }

    /**
     * Retrieves all accommodations with a given feature, filtered by view permission.
     * @param input - Object containing featureId or featureSlug and actor
     * @returns A ServiceOutput with an array of accommodations or an error
     */
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
                    message: 'featureId or featureSlug is required and must be a string',
                    details: {
                        received: { featureId: input.featureId, featureSlug: input.featureSlug }
                    }
                }
            };
        }
        return this.runWithLoggingAndValidation('getByFeature', input, async (actor, input) => {
            if (input.featureId) {
                const result = await this.model.findAll({
                    'features.featureId': input.featureId
                });
                const accommodations = Array.isArray(result)
                    ? result
                    : typeof result === 'object' && result !== null && 'items' in result
                      ? (result as { items: AccommodationType[] }).items
                      : [];
                return await this.filterByViewPermission(actor, accommodations, input);
            }
            if (input.featureSlug) {
                throw Object.assign(new Error('Not implemented: search by featureSlug'), {
                    details: { received: input.featureSlug }
                });
            }
            return [];
        });
    }

    /**
     * Retrieves a summary of an accommodation by id or slug, filtered by view permission.
     * @param input - Object containing id or slug and actor
     * @returns A ServiceOutput with a partial accommodation summary or null/error
     */
    public async getSummary(
        input: ServiceInput<{ id?: string; slug?: string }>
    ): Promise<ServiceOutput<AccommodationSummaryType | null>> {
        if (
            (!input.id || typeof input.id !== 'string') &&
            (!input.slug || typeof input.slug !== 'string')
        ) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'id or slug is required and must be a string',
                    details: { received: { id: input.id, slug: input.slug } }
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
            const summary: AccommodationSummaryType = {
                id: accommodation.id,
                slug: accommodation.slug,
                name: accommodation.name,
                type: accommodation.type,
                media: accommodation.media,
                rating: accommodation.rating,
                reviewsCount: accommodation.reviewsCount,
                location: accommodation.location,
                isFeatured: accommodation.isFeatured
            };
            return summary;
        });
    }

    /**
     * Retrieves similar accommodations to the given id or slug, filtered by view permission.
     * @param input - Object containing id or slug and actor
     * @returns A ServiceOutput with an array of similar accommodations or an error
     */
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
                    message: 'id or slug is required and must be a string',
                    details: { received: { id: input.id, slug: input.slug } }
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
            const result = await this.model.findAll({
                destinationId: base.destinationId,
                type: base.type
            });
            const arr = Array.isArray(result)
                ? result
                : typeof result === 'object' && result !== null && 'items' in result
                  ? (result as { items: AccommodationType[] }).items
                  : [];
            const filtered = arr.filter((a) => a.id !== base?.id).slice(0, 10);
            return await this.filterByViewPermission(actor, filtered, input);
        });
    }

    /**
     * Retrieves top-rated accommodations, optionally filtered by destinationId, filtered by view permission.
     * @param input - Object containing optional destinationId and actor
     * @returns A ServiceOutput with an array of top-rated accommodations or an error
     */
    public async getTopRated(
        input: ServiceInput<{ destinationId?: string }>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        if (input.destinationId && typeof input.destinationId !== 'string') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'destinationId must be a string if provided',
                    details: { received: input.destinationId }
                }
            };
        }
        return this.runWithLoggingAndValidation('getTopRated', input, async (actor, input) => {
            const filter: Record<string, unknown> = {};
            if (input.destinationId) {
                filter.destinationId = input.destinationId;
            }
            const result = await this.model.findAll(filter);
            let accommodations = Array.isArray(result)
                ? result
                : typeof result === 'object' && result !== null && 'items' in result
                  ? (result as { items: AccommodationType[] }).items
                  : [];
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

    /**
     * Retrieves reviews for an accommodation by id or slug.
     * @param input - Object containing id or slug and actor
     * @returns A ServiceOutput with an array of reviews or an error
     */
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
                    message: 'id or slug is required and must be a string',
                    details: { received: { id: input.id, slug: input.slug } }
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
     * Asynchronously generates a unique, URL-friendly slug for an accommodation using type and name.
     * If the slug already exists (as determined by the provided callback), appends an incremental suffix (-2, -3, ...).
     *
     * @param type - Accommodation type (enum or string)
     * @param name - Accommodation name
     * @param checkSlugExists - Async callback to check if a slug exists (returns true if exists)
     * @returns The generated unique slug string
     * @throws {Error} If both type and name are empty
     */
    public async generateSlug(
        type: string,
        name: string,
        checkSlugExists: (slug: string) => Promise<boolean>
    ): Promise<string> {
        // The combination of type and name creates the base for the slug.
        const baseString = `${type} ${name}`;
        return createUniqueSlug(baseString, checkSlugExists);
    }

    /**
     * Builds a filter object for searching accommodations based on provided filters.
     * @param filters - SearchAccommodationFilters object
     * @returns A filter object suitable for AccommodationModel.findAll
     */
    private buildAccommodationFilter(filters: SearchAccommodationFilters): Record<string, unknown> {
        const query: Record<string, unknown> = {};
        if (filters.type) query.type = filters.type;
        if (filters.destinationId) query.destinationId = filters.destinationId;
        if (filters.name) query.name = filters.name;
        if (filters.slug) query.slug = filters.slug;
        if (filters.amenityIds && filters.amenityIds.length > 0) {
            query['amenities.amenityId'] = { $in: filters.amenityIds };
        }
        if (filters.featureIds && filters.featureIds.length > 0) {
            query['features.featureId'] = { $in: filters.featureIds };
        }
        return query;
    }

    /**
     * Finds accommodations using multiple filters (type, destinationId, amenityIds, featureIds, name, slug).
     * Does not apply permission filtering; see public search method for permission checks.
     * @param input - SearchAccommodationFilters object
     * @returns A promise resolving to an array of accommodations
     */
    protected async searchEntities(
        input: SearchAccommodationFilters
    ): Promise<AccommodationType[]> {
        const filter = this.buildAccommodationFilter(input);
        const result = await this.model.findAll(filter);
        const accommodations = Array.isArray(result)
            ? result
            : typeof result === 'object' && result !== null && 'items' in result
              ? (result as { items: AccommodationType[] }).items
              : [];
        return accommodations;
    }

    /**
     * Public search method supporting multiple filters and permission filtering.
     * Validates input and actor, applies Zod schema validation, and filters results by view permission.
     * @param input - ServiceInput containing SearchAccommodationFilters and actor
     * @returns A ServiceOutput with an array of accommodations or an error
     */
    public async search(
        input: ServiceInput<SearchAccommodationFilters>
    ): Promise<ServiceOutput<AccommodationType[]>> {
        if (!input.actor) {
            return {
                error: {
                    code: ServiceErrorCode.UNAUTHORIZED,
                    message: 'Actor is required',
                    details: { received: input.actor }
                }
            };
        }
        const parseResult = SearchAccommodationFiltersSchema.safeParse(input);
        if (!parseResult.success) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: parseResult.error.errors.map((e) => e.message).join('; '),
                    details: parseResult.error.errors
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
                        'At least one filter (type, destinationId, amenityIds, featureIds, name, slug) is required',
                    details: { received: filters }
                }
            };
        }
        return this.runWithLoggingAndValidation('search', input, async (actor, input) => {
            const accommodations = await this.searchEntities(input);
            return await this.filterByViewPermission(actor, accommodations, input);
        });
    }
}
