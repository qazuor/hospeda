import { DestinationModel } from '@repo/db';
import type {
    DestinationSummaryType,
    DestinationType,
    NewDestinationInputType,
    UpdateDestinationInputType
} from '@repo/types';
import { PermissionEnum, RoleEnum } from '@repo/types';
import { BaseService } from '../../base/base.service';
import type {
    Actor,
    CanCreateResult,
    CanDeleteResult,
    CanHardDeleteResult,
    CanRestoreResult,
    CanUpdateResult,
    CanViewResult,
    ServiceInput,
    ServiceOutput
} from '../../types';
import { EntityPermissionReasonEnum, ServiceErrorCode } from '../../types';
import {
    DestinationCreateInputSchema,
    DestinationFilterInputSchema,
    type SearchDestinationFilters
} from './destination.schemas';

/**
 * DestinationService provides business logic, validation, and permission management for destinations.
 * Inherits CRUD and listing logic from BaseService.
 * Implements advanced search, relations, and summary methods for destinations.
 */
export class DestinationService extends BaseService<
    DestinationType,
    NewDestinationInputType,
    UpdateDestinationInputType,
    unknown,
    DestinationType[]
> {
    /**
     * Model for destination operations.
     */
    protected model = new DestinationModel();
    /**
     * Zod schema for destination creation input.
     */
    protected inputSchema = DestinationCreateInputSchema;
    /**
     * Roles allowed to create, update, or delete destinations.
     */
    protected allowedRoles: RoleEnum[] = [RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN];

    /**
     * Constructs a new DestinationService instance.
     */
    constructor() {
        super('destination');
    }

    /**
     * Checks if the actor can view a destination entity.
     * @param actor - The actor to check
     * @param _entity - The destination entity (unused)
     * @returns The result of the permission check
     */
    protected async canViewEntity(_actor: Actor, _entity: DestinationType): Promise<CanViewResult> {
        // TODO: Implement visibility logic if needed
        return { canView: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if the actor can create a destination entity.
     * Only SUPER_ADMIN, ADMIN, or users with explicit permissions can create.
     * @param actor - The actor to check
     * @returns The result of the permission check
     */
    protected async canCreateEntity(actor: Actor): Promise<CanCreateResult> {
        if (
            !this.allowedRoles.includes(actor.role) &&
            !actor.permissions.includes(PermissionEnum.DESTINATION_CREATE)
        ) {
            return { canCreate: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canCreate: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if the actor can update a destination entity.
     * Only SUPER_ADMIN, ADMIN, or users with explicit permissions can update.
     * @param actor - The actor to check
     * @param _entity - The destination entity (unused)
     * @returns The result of the permission check
     */
    protected async canUpdateEntity(
        _actor: Actor,
        _entity: DestinationType
    ): Promise<CanUpdateResult> {
        if (
            !this.allowedRoles.includes(_actor.role) &&
            !_actor.permissions.includes(PermissionEnum.DESTINATION_UPDATE)
        ) {
            return { canUpdate: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canUpdate: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if the actor can delete a destination entity.
     * Only SUPER_ADMIN, ADMIN, or users with explicit permissions can delete.
     * @param actor - The actor to check
     * @param _entity - The destination entity (unused)
     * @returns The result of the permission check
     */
    protected async canDeleteEntity(
        _actor: Actor,
        _entity: DestinationType
    ): Promise<CanDeleteResult> {
        if (
            !this.allowedRoles.includes(_actor.role) &&
            !_actor.permissions.includes(PermissionEnum.DESTINATION_DELETE)
        ) {
            return { canDelete: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canDelete: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if the actor can restore a destination entity.
     * Only SUPER_ADMIN, ADMIN, or users with explicit permissions can restore.
     * @param actor - The actor to check
     * @param _entity - The destination entity (unused)
     * @returns The result of the permission check
     */
    protected async canRestoreEntity(
        _actor: Actor,
        _entity: DestinationType
    ): Promise<CanRestoreResult> {
        if (
            !this.allowedRoles.includes(_actor.role) &&
            !_actor.permissions.includes(PermissionEnum.DESTINATION_UPDATE)
        ) {
            return { canRestore: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canRestore: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if the actor can hard delete a destination entity.
     * Only SUPER_ADMIN, ADMIN, or users with explicit permissions can hard delete.
     * @param actor - The actor to check
     * @param _entity - The destination entity (unused)
     * @returns The result of the permission check
     */
    protected canHardDeleteEntity(actor: Actor, _entity: DestinationType): CanHardDeleteResult {
        const checkedPermission = PermissionEnum.DESTINATION_DELETE;
        if (
            !this.allowedRoles.includes(actor.role) &&
            !actor.permissions.includes(PermissionEnum.DESTINATION_DELETE)
        ) {
            return {
                canHardDelete: false,
                reason: EntityPermissionReasonEnum.MISSING_PERMISSION,
                checkedPermission
            };
        }
        return {
            canHardDelete: true,
            reason: EntityPermissionReasonEnum.APPROVED,
            checkedPermission
        };
    }

    /**
     * Generates a unique, URL-friendly slug for a destination name.
     * The slug is based only on the name and uses an incremental suffix if needed.
     * @param _type - Entity type (unused)
     * @param name - Destination name
     * @param checkSlugExists - Async callback to check if a slug exists
     * @returns The generated unique slug string
     */
    public async generateSlug(
        _type: string,
        name: string,
        checkSlugExists: (slug: string) => Promise<boolean>
    ): Promise<string> {
        const toSlug = (str: string) =>
            str
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');
        let slug = toSlug(name);
        let i = 2;
        while (await checkSlugExists(slug)) {
            slug = `${toSlug(name)}-${i++}`;
        }
        return slug;
    }

    /**
     * Retrieves all destinations that have a given attraction.
     * Calls the model method and wraps the result in a ServiceOutput.
     * Handles and logs errors, returning them in the output.
     *
     * @param input - Service input containing the attractionId
     * @returns ServiceOutput with a list of destinations or error
     */
    public async getByAttraction(
        input: ServiceInput<{ attractionId: string }>
    ): Promise<ServiceOutput<DestinationType[]>> {
        if (!input.attractionId || typeof input.attractionId !== 'string') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'attractionId is required and must be a string',
                    details: { received: input.attractionId }
                }
            };
        }
        try {
            const results = await this.model.findAllByAttractionId(input.attractionId);
            const destinations = Array.isArray(results) ? results : [];
            const filtered: DestinationType[] = [];
            for (const dest of destinations) {
                const canView = await this.canViewEntity(input.actor, dest);
                if (canView.canView) filtered.push(dest);
            }
            return { data: filtered };
        } catch (error) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message:
                        error instanceof Error ? error.message : 'Unknown error in getByAttraction',
                    details: error
                }
            };
        }
    }

    /**
     * Retrieves a destination with all specified relations populated.
     * Validates input and permissions before returning the entity.
     *
     * @param input - Service input containing the destination id and relations to include
     * @returns ServiceOutput with the destination and its relations, or null/error if not found or forbidden
     */
    public async getWithRelations(
        input: ServiceInput<{ id: string; relations: Record<string, boolean> }>
    ): Promise<ServiceOutput<DestinationType | null>> {
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
        try {
            const destination = await this.model.findWithRelations(
                { id: input.id },
                input.relations
            );
            if (!destination) return { data: null };
            const canView = await this.canViewEntity(input.actor, destination);
            if (!canView.canView) {
                // Optionally log denied access here
                return { data: null };
            }
            // Optionally log granted access here
            return { data: destination };
        } catch (error) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error in getWithRelations',
                    details: error
                }
            };
        }
    }

    /**
     * Retrieves a summary of a destination (id, slug, name, summary, media, location, visibility, lifecycleState, moderationState).
     * @param input - Service input containing the destinationId
     * @returns The destination summary, or null if not found
     */
    public async getSummary(
        input: ServiceInput<{ id: string }>
    ): Promise<ServiceOutput<DestinationSummaryType | null>> {
        if (!input.id || typeof input.id !== 'string') {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'id is required and must be a string',
                    details: { received: input.id }
                }
            };
        }
        try {
            const destination = await this.model.findOne({ id: input.id });
            if (!destination) return { data: null };
            const canView = await this.canViewEntity(input.actor, destination);
            if (!canView.canView) return { data: null };
            const summary: DestinationSummaryType = {
                id: destination.id,
                slug: destination.slug,
                name: destination.name,
                summary: destination.summary,
                media: destination.media,
                averageRating: destination.averageRating,
                reviewsCount: destination.reviewsCount
            };
            return { data: summary };
        } catch (error) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: error instanceof Error ? error.message : 'Unknown error in getSummary',
                    details: error
                }
            };
        }
    }

    /**
     * Retrieves the top-rated destinations, optionally filtered by criteria.
     * @param input - Service input containing optional filter and limit
     * @returns A list of top-rated destinations
     */
    public async getTopRated(
        input: ServiceInput<{ limit?: number; filter?: Record<string, unknown> }>
    ): Promise<ServiceOutput<DestinationType[]>> {
        const limit = typeof input.limit === 'number' && input.limit > 0 ? input.limit : 10;
        const filter: Record<string, unknown> = input.filter ?? {};
        try {
            const result = await this.model.findAll(filter);
            let destinations = Array.isArray(result)
                ? result
                : typeof result === 'object' && result !== null && 'items' in result
                  ? (result as { items: DestinationType[] }).items
                  : [];
            destinations = destinations
                .slice()
                .sort((a, b) => {
                    const ra = a.averageRating ?? 0;
                    const rb = b.averageRating ?? 0;
                    return rb - ra;
                })
                .slice(0, limit);
            // Filtrar por permisos de visualización
            const filtered: DestinationType[] = [];
            for (const dest of destinations) {
                const canView = await this.canViewEntity(input.actor, dest);
                if (canView.canView) filtered.push(dest);
            }
            return { data: filtered };
        } catch (error) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message:
                        error instanceof Error ? error.message : 'Unknown error in getTopRated',
                    details: error
                }
            };
        }
    }

    /**
     * Retrieves all reviews for a given destination by id or slug.
     * @param input - Service input containing the destinationId or slug
     * @returns A list of reviews for the destination
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
        try {
            let destination: DestinationType | null = null;
            if (input.id) {
                destination = await this.model.findById(input.id);
            } else if (input.slug) {
                destination = await this.model.findOne({ slug: input.slug });
            }
            if (!destination) return { data: [] };
            const canView = await this.canViewEntity(input.actor, destination);
            if (!canView.canView) return { data: [] };
            return { data: destination.reviews ?? [] };
        } catch (error) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: error instanceof Error ? error.message : 'Unknown error in getReviews',
                    details: error
                }
            };
        }
    }

    /**
     * Searches for destinations using filters and sorting options.
     * @param input - Service input containing search filters and actor
     * @returns A list of destinations matching the search criteria
     */
    public async search(
        input: ServiceInput<SearchDestinationFilters>
    ): Promise<ServiceOutput<DestinationType[]>> {
        if (!input.actor) {
            return {
                error: {
                    code: ServiceErrorCode.UNAUTHORIZED,
                    message: 'Actor is required',
                    details: { received: input.actor }
                }
            };
        }
        // Validate filters with Zod
        const parseResult = DestinationFilterInputSchema.safeParse(input);
        if (!parseResult.success) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: parseResult.error.errors.map((e) => e.message).join('; '),
                    details: parseResult.error.errors
                }
            };
        }
        // At least one filter must be present
        const filterKeys = Object.keys(input).filter((k) => k !== 'actor');
        if (filterKeys.length === 0) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message:
                        'At least one filter (e.g., state, city, country, tags, visibility, isFeatured, minRating, maxRating, q) is required',
                    details: { received: input }
                }
            };
        }
        try {
            // Construir el filtro solo con las claves válidas (excluyendo actor)
            const { actor, ...filter } = input;
            const result = await this.model.findAll(filter);
            const destinations = Array.isArray(result)
                ? result
                : typeof result === 'object' && result !== null && 'items' in result
                  ? (result as { items: DestinationType[] }).items
                  : [];
            // Filter by view permission
            const filtered: DestinationType[] = [];
            for (const dest of destinations) {
                const canView = await this.canViewEntity(input.actor, dest);
                if (canView.canView) filtered.push(dest);
            }
            return { data: filtered };
        } catch (error) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: error instanceof Error ? error.message : 'Unknown error in search',
                    details: error
                }
            };
        }
    }

    /**
     * Lists all destinations. (No filters yet)
     * @param _input - Currently unused (could be extended for filters)
     * @returns Promise with all destinations
     */
    protected async listEntities(_input: unknown): Promise<DestinationType[]> {
        return this.model.findAll({}) as Promise<DestinationType[]>;
    }
}
