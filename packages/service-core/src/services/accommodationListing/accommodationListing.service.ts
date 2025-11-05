import type { AccommodationListingModel } from '@repo/db';
import {
    AccommodationListingCreateInputSchema,
    AccommodationListingListQuerySchema,
    AccommodationListingPatchInputSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { AccommodationListing } from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Service for managing accommodation listings.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * and additional business logic methods for listing lifecycle management.
 */
export class AccommodationListingService extends BaseCrudService<
    AccommodationListing,
    AccommodationListingModel,
    typeof AccommodationListingCreateInputSchema,
    typeof AccommodationListingPatchInputSchema,
    typeof AccommodationListingListQuerySchema
> {
    static readonly ENTITY_NAME = 'accommodation-listing';
    protected readonly entityName = AccommodationListingService.ENTITY_NAME;

    public readonly model: AccommodationListingModel;

    public readonly createSchema = AccommodationListingCreateInputSchema;
    public readonly updateSchema = AccommodationListingPatchInputSchema;
    public readonly searchSchema = AccommodationListingListQuerySchema;

    constructor(ctx: ServiceContext, model?: AccommodationListingModel) {
        super(ctx, AccommodationListingService.ENTITY_NAME);
        this.model = model ?? ({} as AccommodationListingModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create accommodation listings
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to create accommodation listings'
            );
        }
    }

    /**
     * Check if actor can update accommodation listings
     */
    protected _canUpdate(actor: Actor, _id: string, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_UPDATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update accommodation listings'
            );
        }
    }

    /**
     * Check if actor can patch accommodation listings
     */
    protected _canPatch(actor: Actor, _entity: AccommodationListing, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_UPDATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to patch accommodation listings'
            );
        }
    }

    /**
     * Check if actor can soft delete accommodation listings
     */
    protected _canDelete(actor: Actor, _entity: AccommodationListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to delete accommodation listings'
            );
        }
    }

    /**
     * Check if actor can hard delete accommodation listings
     */
    protected _canHardDelete(actor: Actor, _entity: AccommodationListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_HARD_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to permanently delete accommodation listings'
            );
        }
    }

    /**
     * Check if actor can restore accommodation listings
     */
    protected _canRestore(actor: Actor, _entity: AccommodationListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_RESTORE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to restore accommodation listings'
            );
        }
    }

    /**
     * Check if actor can view accommodation listings
     */
    protected _canView(actor: Actor, _entity: AccommodationListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to view accommodation listings'
            );
        }
    }

    /**
     * Check if actor can list accommodation listings
     */
    protected _canList(actor: Actor, _filters: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to list accommodation listings'
            );
        }
    }

    /**
     * Check if actor can activate accommodation listings
     */
    protected _canActivate(actor: Actor, _entity: AccommodationListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_STATUS_MANAGE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to activate accommodation listings'
            );
        }
    }

    /**
     * Check if actor can pause accommodation listings
     */
    protected _canPause(actor: Actor, _entity: AccommodationListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_STATUS_MANAGE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to pause accommodation listings'
            );
        }
    }

    /**
     * Check if actor can archive accommodation listings
     */
    protected _canArchive(actor: Actor, _entity: AccommodationListing): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_STATUS_MANAGE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to archive accommodation listings'
            );
        }
    }

    // ============================================================================
    // BUSINESS METHODS (3 lifecycle methods)
    // ============================================================================

    /**
     * Activate an accommodation listing
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
    }): Promise<ServiceOutput<AccommodationListing>> {
        try {
            // Permission check (will throw if not allowed)
            this._canActivate(input.actor, {} as AccommodationListing);

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
                            : 'Failed to activate accommodation listing'
                }
            };
        }
    }

    /**
     * Pause an accommodation listing
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
    }): Promise<ServiceOutput<AccommodationListing>> {
        try {
            // Permission check (will throw if not allowed)
            this._canPause(input.actor, {} as AccommodationListing);

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
                        error instanceof Error
                            ? error.message
                            : 'Failed to pause accommodation listing'
                }
            };
        }
    }

    /**
     * Archive an accommodation listing
     *
     * @param input - Actor and listing ID
     * @returns Service output with archived listing
     *
     * @example
     * ```ts
     * const result = await service.archive({
     *   actor: adminActor,
     *   listingId: 'listing-123'
     * });
     * ```
     */
    public async archive(input: {
        actor: Actor;
        listingId: string;
    }): Promise<ServiceOutput<AccommodationListing>> {
        try {
            // Permission check (will throw if not allowed)
            this._canArchive(input.actor, {} as AccommodationListing);

            // Call model method to archive
            const result = await this.model.archive(input.listingId);

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
                            : 'Failed to archive accommodation listing'
                }
            };
        }
    }
}
