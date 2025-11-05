import type { AccommodationListingPlanModel } from '@repo/db';
import {
    type AccommodationListingPlan,
    AccommodationListingPlanCreateInputSchema,
    AccommodationListingPlanListQuerySchema,
    AccommodationListingPlanPatchInputSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Service for managing accommodation listing plans.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * and additional business logic methods for plan lifecycle management.
 */
export class AccommodationListingPlanService extends BaseCrudService<
    AccommodationListingPlan,
    AccommodationListingPlanModel,
    typeof AccommodationListingPlanCreateInputSchema,
    typeof AccommodationListingPlanPatchInputSchema,
    typeof AccommodationListingPlanListQuerySchema
> {
    static readonly ENTITY_NAME = 'accommodation-listing-plan';
    protected readonly entityName = AccommodationListingPlanService.ENTITY_NAME;

    public readonly model: AccommodationListingPlanModel;

    public readonly createSchema = AccommodationListingPlanCreateInputSchema;
    public readonly updateSchema = AccommodationListingPlanPatchInputSchema;
    public readonly searchSchema = AccommodationListingPlanListQuerySchema;

    constructor(ctx: ServiceContext, model?: AccommodationListingPlanModel) {
        super(ctx, AccommodationListingPlanService.ENTITY_NAME);
        this.model = model ?? ({} as AccommodationListingPlanModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create accommodation listing plans
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_PLAN_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to create accommodation listing plans'
            );
        }
    }

    /**
     * Check if actor can update accommodation listing plans
     */
    protected _canUpdate(actor: Actor, _id: string, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_PLAN_UPDATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update accommodation listing plans'
            );
        }
    }

    /**
     * Check if actor can patch accommodation listing plans
     */
    protected _canPatch(actor: Actor, _entity: AccommodationListingPlan, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_PLAN_UPDATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to patch accommodation listing plans'
            );
        }
    }

    /**
     * Check if actor can soft delete accommodation listing plans
     */
    protected _canDelete(actor: Actor, _entity: AccommodationListingPlan): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_PLAN_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to delete accommodation listing plans'
            );
        }
    }

    /**
     * Check if actor can hard delete accommodation listing plans
     */
    protected _canHardDelete(actor: Actor, _entity: AccommodationListingPlan): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_PLAN_HARD_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to permanently delete accommodation listing plans'
            );
        }
    }

    /**
     * Check if actor can restore accommodation listing plans
     */
    protected _canRestore(actor: Actor, _entity: AccommodationListingPlan): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_PLAN_RESTORE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to restore accommodation listing plans'
            );
        }
    }

    /**
     * Check if actor can view accommodation listing plans
     */
    protected _canView(actor: Actor, _entity: AccommodationListingPlan): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_PLAN_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to view accommodation listing plans'
            );
        }
    }

    /**
     * Check if actor can list accommodation listing plans
     */
    protected _canList(actor: Actor, _filters: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCOMMODATION_LISTING_PLAN_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to list accommodation listing plans'
            );
        }
    }

    /**
     * Check if actor can activate accommodation listing plans
     */
    protected _canActivate(actor: Actor, _entity: AccommodationListingPlan): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(
                    PermissionEnum.ACCOMMODATION_LISTING_PLAN_STATUS_MANAGE
                ))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to activate accommodation listing plans'
            );
        }
    }

    /**
     * Check if actor can deactivate accommodation listing plans
     */
    protected _canDeactivate(actor: Actor, _entity: AccommodationListingPlan): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(
                    PermissionEnum.ACCOMMODATION_LISTING_PLAN_STATUS_MANAGE
                ))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to deactivate accommodation listing plans'
            );
        }
    }

    /**
     * Check if actor can archive accommodation listing plans
     */
    protected _canArchive(actor: Actor, _entity: AccommodationListingPlan): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(
                    PermissionEnum.ACCOMMODATION_LISTING_PLAN_STATUS_MANAGE
                ))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to archive accommodation listing plans'
            );
        }
    }

    // ============================================================================
    // BUSINESS METHODS (2 lifecycle methods)
    // ============================================================================

    /**
     * Activate an accommodation listing plan
     *
     * @param input - Actor and plan ID
     * @returns Service output with activated plan
     *
     * @example
     * ```ts
     * const result = await service.activate({
     *   actor: adminActor,
     *   planId: 'plan-123'
     * });
     * ```
     */
    public async activate(input: {
        actor: Actor;
        planId: string;
    }): Promise<ServiceOutput<AccommodationListingPlan>> {
        try {
            // Permission check (will throw if not allowed)
            this._canActivate(input.actor, {} as AccommodationListingPlan);

            // Call model method to activate
            const result = await this.model.activate(input.planId);

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
                            : 'Failed to activate accommodation listing plan'
                }
            };
        }
    }

    /**
     * Deactivate an accommodation listing plan
     *
     * @param input - Actor and plan ID
     * @returns Service output with deactivated plan
     *
     * @example
     * ```ts
     * const result = await service.deactivate({
     *   actor: adminActor,
     *   planId: 'plan-123'
     * });
     * ```
     */
    public async deactivate(input: {
        actor: Actor;
        planId: string;
    }): Promise<ServiceOutput<AccommodationListingPlan>> {
        try {
            // Permission check (will throw if not allowed)
            this._canDeactivate(input.actor, {} as AccommodationListingPlan);

            // Call model method to deactivate
            const result = await this.model.deactivate(input.planId);

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
                            : 'Failed to deactivate accommodation listing plan'
                }
            };
        }
    }
}
