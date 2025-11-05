import type { ServiceListingModel } from '@repo/db';
import {
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    ServiceListingCreateInputSchema,
    ServiceListingListQuerySchema,
    ServiceListingPatchInputSchema
} from '@repo/schemas';
import type { ServiceListing } from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

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
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to create service listings'
            );
        }
    }

    /**
     * Check if actor can update service listings
     */
    protected _canUpdate(actor: Actor, _id: string, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_UPDATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update service listings'
            );
        }
    }

    /**
     * Check if actor can patch service listings
     */
    protected _canPatch(actor: Actor, _entity: ServiceListing, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_UPDATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to patch service listings'
            );
        }
    }

    /**
     * Check if actor can soft delete service listings
     */
    protected _canDelete(actor: Actor, _entity: ServiceListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to delete service listings'
            );
        }
    }

    /**
     * Check if actor can hard delete service listings
     */
    protected _canHardDelete(actor: Actor, _entity: ServiceListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_HARD_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to permanently delete service listings'
            );
        }
    }

    /**
     * Check if actor can restore service listings
     */
    protected _canRestore(actor: Actor, _entity: ServiceListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_RESTORE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to restore service listings'
            );
        }
    }

    /**
     * Check if actor can view service listings
     */
    protected _canView(actor: Actor, _entity: ServiceListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to view service listings'
            );
        }
    }

    /**
     * Check if actor can list service listings
     */
    protected _canList(actor: Actor, _filters: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to list service listings'
            );
        }
    }

    /**
     * Check if actor can activate service listings
     */
    protected _canActivate(actor: Actor, _entity: ServiceListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_STATUS_MANAGE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to activate service listings'
            );
        }
    }

    /**
     * Check if actor can deactivate service listings
     */
    protected _canDeactivate(actor: Actor, _entity: ServiceListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_STATUS_MANAGE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to deactivate service listings'
            );
        }
    }

    /**
     * Check if actor can publish service listings
     */
    protected _canPublish(actor: Actor, _entity: ServiceListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SERVICE_LISTING_STATUS_MANAGE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to publish service listings'
            );
        }
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
        try {
            // Permission check (will throw if not allowed)
            this._canActivate(input.actor, {} as ServiceListing);

            // Call model method to activate
            const result = await this.model.activate(input.listingId);

            return {
                success: true,
                data: result
            };
        } catch (error) {
            if (error instanceof ServiceError) {
                return {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message
                    }
                };
            }

            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Failed to activate service listing'
                }
            };
        }
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
        try {
            // Permission check (will throw if not allowed)
            this._canDeactivate(input.actor, {} as ServiceListing);

            // Call model method to deactivate
            const result = await this.model.deactivate(input.listingId);

            return {
                success: true,
                data: result
            };
        } catch (error) {
            if (error instanceof ServiceError) {
                return {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message
                    }
                };
            }

            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Failed to deactivate service listing'
                }
            };
        }
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
        try {
            // Permission check (will throw if not allowed)
            this._canPublish(input.actor, {} as ServiceListing);

            // Call model method to publish
            const result = await this.model.publish(input.listingId);

            return {
                success: true,
                data: result
            };
        } catch (error) {
            if (error instanceof ServiceError) {
                return {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message
                    }
                };
            }

            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message:
                        error instanceof Error ? error.message : 'Failed to publish service listing'
                }
            };
        }
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
        try {
            // Permission check (will throw if not allowed - using STATUS_MANAGE permission)
            if (
                !input.actor ||
                !input.actor.id ||
                (input.actor.role !== RoleEnum.ADMIN &&
                    !input.actor.permissions.includes(PermissionEnum.SERVICE_LISTING_STATUS_MANAGE))
            ) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: Insufficient permissions to pause service listings'
                );
            }

            // Call model method to pause
            const result = await this.model.pause(input.listingId);

            return {
                success: true,
                data: result
            };
        } catch (error) {
            if (error instanceof ServiceError) {
                return {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message
                    }
                };
            }

            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message:
                        error instanceof Error ? error.message : 'Failed to pause service listing'
                }
            };
        }
    }
}
