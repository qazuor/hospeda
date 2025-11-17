import type { ServiceListingModel } from '@repo/db';
import type { ListRelationsConfig, ServiceListing } from '@repo/schemas';
import {
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    ServiceListingCreateInputSchema,
    ServiceListingListQuerySchema,
    ServiceListingPatchInputSchema,
    type VisibilityEnum
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type {
    Actor,
    PaginatedListOutput,
    ServiceContext,
    ServiceOutput
} from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import {
    checkCanActivate,
    checkCanCount,
    checkCanCreate,
    checkCanDeactivate,
    checkCanDelete,
    checkCanHardDelete,
    checkCanList,
    checkCanPatch,
    checkCanPublish,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from './serviceListing.permissions.js';

/**
 * Service for managing service listings.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * and additional business logic methods for listing lifecycle management.
 */
export class ServiceListingService extends BaseCrudService<
    ServiceListing,
    ServiceListingModel,
    typeof ServiceListingCreateInputSchema,
    typeof ServiceListingPatchInputSchema,
    typeof ServiceListingListQuerySchema
> {
    static readonly ENTITY_NAME = 'service-listing';
    protected readonly entityName = ServiceListingService.ENTITY_NAME;

    public readonly model: ServiceListingModel;

    public readonly createSchema = ServiceListingCreateInputSchema;
    public readonly updateSchema = ServiceListingPatchInputSchema;
    public readonly searchSchema = ServiceListingListQuerySchema;

    constructor(ctx: ServiceContext, model?: ServiceListingModel) {
        super(ctx, ServiceListingService.ENTITY_NAME);
        this.model = model ?? ({} as ServiceListingModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create service listings
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    /**
     * Check if actor can update service listings
     */
    protected _canUpdate(actor: Actor, _entity: ServiceListing): void {
        checkCanUpdate(actor, _entity);
    }

    /**
     * Check if actor can patch service listings
     */
    protected _canPatch(actor: Actor, _entity: ServiceListing, _data: unknown): void {
        checkCanPatch(actor, _entity, _data);
    }

    /**
     * Check if actor can update visibility of service listings
     */
    protected _canUpdateVisibility(
        actor: Actor,
        entity: ServiceListing,
        newVisibility: VisibilityEnum
    ): void {
        checkCanUpdateVisibility(actor, entity, newVisibility);
    }

    /**
     * Check if actor can soft delete service listings
     */
    protected _canDelete(actor: Actor, _entity: ServiceListing): void {
        checkCanDelete(actor, _entity);
    }

    /**
     * Check if actor can hard delete service listings
     */
    protected _canHardDelete(actor: Actor, _entity: ServiceListing): void {
        checkCanHardDelete(actor, _entity);
    }

    /**
     * Check if actor can restore service listings
     */
    protected _canRestore(actor: Actor, _entity: ServiceListing): void {
        checkCanRestore(actor, _entity);
    }

    /**
     * Check if actor can view service listings
     */
    protected _canView(actor: Actor, _entity: ServiceListing): void {
        checkCanView(actor, _entity);
    }

    /**
     * Check if actor can list service listings
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can activate service listings
     */
    protected _canActivate(actor: Actor, _entity: ServiceListing): void {
        checkCanActivate(actor, _entity);
    }

    /**
     * Check if actor can deactivate service listings
     */
    protected _canDeactivate(actor: Actor, _entity: ServiceListing): void {
        checkCanDeactivate(actor, _entity);
    }

    /**
     * Check if actor can publish service listings
     */
    protected _canPublish(actor: Actor, _entity: ServiceListing): void {
        checkCanPublish(actor, _entity);
    }

    /**
     * Check if actor can soft delete service listings
     */
    protected _canSoftDelete(actor: Actor, _entity: ServiceListing): void {
        checkCanSoftDelete(actor, _entity);
    }

    /**
     * Check if actor can search service listings
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count service listings
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Execute search for service listings
     */
    protected async _executeSearch(
        _params: z.infer<typeof ServiceListingListQuerySchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<ServiceListing>> {
        // For now, delegate to list method until search is implemented
        return {
            items: [],
            total: 0
        };
    }

    /**
     * Execute count for service listings
     */
    protected async _executeCount(
        _params: z.infer<typeof ServiceListingListQuerySchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }

    // ============================================================================
    // BUSINESS METHODS (4 lifecycle methods)
    // ============================================================================

    /**
     * Activate a service listing
     *
     * @param input - Actor and listing ID
     * @returns Service output with activated listing
     *
     * @example
     * ```ts
     * const result = await service.activate({
     *   actor: adminActor,
     *   listingId: 'listing-123'
     * });
     * ```
     */
    public async activate(input: {
        actor: Actor;
        listingId: string;
    }): Promise<ServiceOutput<ServiceListing>> {
        return this.runWithLoggingAndValidation({
            methodName: 'activate',
            input: { actor: input.actor },
            schema: z.object({}),
            execute: async (_, validatedActor) => {
                this._canActivate(validatedActor, {} as ServiceListing);
                const result = await this.model.activate(input.listingId);
                return result;
            }
        });
    }

    /**
     * Deactivate a service listing
     *
     * @param input - Actor and listing ID
     * @returns Service output with deactivated listing
     *
     * @example
     * ```ts
     * const result = await service.deactivate({
     *   actor: adminActor,
     *   listingId: 'listing-123'
     * });
     * ```
     */
    public async deactivate(input: {
        actor: Actor;
        listingId: string;
    }): Promise<ServiceOutput<ServiceListing>> {
        return this.runWithLoggingAndValidation({
            methodName: 'deactivate',
            input: { actor: input.actor },
            schema: z.object({}),
            execute: async (_, validatedActor) => {
                this._canDeactivate(validatedActor, {} as ServiceListing);
                const result = await this.model.deactivate(input.listingId);
                return result;
            }
        });
    }

    /**
     * Publish a service listing
     *
     * @param input - Actor and listing ID
     * @returns Service output with published listing
     *
     * @example
     * ```ts
     * const result = await service.publish({
     *   actor: adminActor,
     *   listingId: 'listing-123'
     * });
     * ```
     */
    public async publish(input: {
        actor: Actor;
        listingId: string;
    }): Promise<ServiceOutput<ServiceListing>> {
        return this.runWithLoggingAndValidation({
            methodName: 'publish',
            input: { actor: input.actor },
            schema: z.object({}),
            execute: async (_, validatedActor) => {
                this._canPublish(validatedActor, {} as ServiceListing);
                const result = await this.model.publish(input.listingId);
                return result;
            }
        });
    }

    /**
     * Pause a service listing
     *
     * @param input - Actor and listing ID
     * @returns Service output with paused listing
     *
     * @example
     * ```ts
     * const result = await service.pause({
     *   actor: adminActor,
     *   listingId: 'listing-123'
     * });
     * ```
     */
    public async pause(input: {
        actor: Actor;
        listingId: string;
    }): Promise<ServiceOutput<ServiceListing>> {
        return this.runWithLoggingAndValidation({
            methodName: 'pause',
            input: { actor: input.actor },
            schema: z.object({}),
            execute: async (_, validatedActor) => {
                // Permission check (using STATUS_MANAGE permission)
                if (
                    !validatedActor ||
                    !validatedActor.id ||
                    (validatedActor.role !== RoleEnum.ADMIN &&
                        !validatedActor.permissions.includes(
                            PermissionEnum.SERVICE_LISTING_STATUS_MANAGE
                        ))
                ) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Insufficient permissions to pause service listings'
                    );
                }

                const result = await this.model.pause(input.listingId);
                return result;
            }
        });
    }
}
