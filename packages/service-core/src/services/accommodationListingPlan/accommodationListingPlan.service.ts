import type { AccommodationListingPlanModel } from '@repo/db';
import {
    type AccommodationListingPlan,
    AccommodationListingPlanCreateInputSchema,
    AccommodationListingPlanListQuerySchema,
    AccommodationListingPlanPatchInputSchema,
    type ListRelationsConfig,
    ServiceErrorCode
} from '@repo/schemas';
import type { z } from 'zod';
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
    checkCanArchive,
    checkCanCount,
    checkCanCreate,
    checkCanDeactivate,
    checkCanHardDelete,
    checkCanList,
    checkCanPatch,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from './accommodationListingPlan.permissions.js';

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
        checkCanCreate(actor, _data);
    }

    /**
     * Check if actor can update accommodation listing plans
     */
    protected _canUpdate(actor: Actor, entity: AccommodationListingPlan): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Check if actor can patch accommodation listing plans
     */
    protected _canPatch(actor: Actor, _entity: AccommodationListingPlan, _data: unknown): void {
        checkCanPatch(actor, _entity, _data);
    }

    /**
     * Check if actor can update visibility of accommodation listing plans
     */
    protected _canUpdateVisibility(actor: Actor, entity: AccommodationListingPlan): void {
        checkCanUpdateVisibility(actor, entity);
    }

    /**
     * Check if actor can soft delete accommodation listing plans
     */
    protected _canDelete(actor: Actor, _entity: AccommodationListingPlan): void {
        checkCanSoftDelete(actor, _entity);
    }

    /**
     * Check if actor can hard delete accommodation listing plans
     */
    protected _canHardDelete(actor: Actor, _entity: AccommodationListingPlan): void {
        checkCanHardDelete(actor, _entity);
    }

    /**
     * Check if actor can restore accommodation listing plans
     */
    protected _canRestore(actor: Actor, _entity: AccommodationListingPlan): void {
        checkCanRestore(actor, _entity);
    }

    /**
     * Check if actor can view accommodation listing plans
     */
    protected _canView(actor: Actor, _entity: AccommodationListingPlan): void {
        checkCanView(actor, _entity);
    }

    /**
     * Check if actor can list accommodation listing plans
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can activate accommodation listing plans
     */
    protected _canActivate(actor: Actor, _entity: AccommodationListingPlan): void {
        checkCanActivate(actor, _entity);
    }

    /**
     * Check if actor can deactivate accommodation listing plans
     */
    protected _canDeactivate(actor: Actor, _entity: AccommodationListingPlan): void {
        checkCanDeactivate(actor, _entity);
    }

    /**
     * Check if actor can archive accommodation listing plans
     */
    protected _canArchive(actor: Actor, _entity: AccommodationListingPlan): void {
        checkCanArchive(actor, _entity);
    }

    /**
     * Check if actor can soft delete accommodation listing plans
     */
    protected _canSoftDelete(actor: Actor, _entity: AccommodationListingPlan): void {
        checkCanSoftDelete(actor, _entity);
    }

    /**
     * Check if actor can search accommodation listing plans
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count accommodation listing plans
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    // ============================================================================
    // SEARCH & COUNT METHODS (optional implementations)
    // ============================================================================

    /**
     * Execute search for accommodation listing plans
     * @returns Paginated list of accommodation listing plans
     */
    protected async _executeSearch(
        _params: z.infer<typeof AccommodationListingPlanListQuerySchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<AccommodationListingPlan>> {
        return {
            items: [],
            total: 0
        };
    }

    /**
     * Execute count for accommodation listing plans
     * @returns Count of accommodation listing plans
     */
    protected async _executeCount(
        _params: z.infer<typeof AccommodationListingPlanListQuerySchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
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
                data: result
            };
        } catch (error) {
            if (error instanceof ServiceError) {
                return {
                    error: {
                        code: error.code,
                        message: error.message
                    }
                };
            }

            return {
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
                data: result
            };
        } catch (error) {
            if (error instanceof ServiceError) {
                return {
                    error: {
                        code: error.code,
                        message: error.message
                    }
                };
            }

            return {
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
