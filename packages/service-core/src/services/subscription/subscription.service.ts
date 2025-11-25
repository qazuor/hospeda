import { PricingPlanModel, SubscriptionModel, type subscriptionItems } from '@repo/db';
import type { ClientIdType, ListRelationsConfig, SubscriptionStatusEnum } from '@repo/schemas';
import {
    BillingIntervalEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    type VisibilityEnum
} from '@repo/schemas';
import {
    type Subscription,
    SubscriptionCreateInputSchema,
    SubscriptionQuerySchema,
    SubscriptionUpdateInputSchema
} from '@repo/schemas/entities/subscription';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing subscriptions. Implements business logic, permissions, and hooks for Subscription entities.
 * @extends BaseCrudService
 */
export class SubscriptionService extends BaseCrudService<
    Subscription,
    SubscriptionModel,
    typeof SubscriptionCreateInputSchema,
    typeof SubscriptionUpdateInputSchema,
    typeof SubscriptionQuerySchema
> {
    static readonly ENTITY_NAME = 'subscription';
    protected readonly entityName = SubscriptionService.ENTITY_NAME;
    public readonly model: SubscriptionModel;
    private readonly pricingPlanModel: PricingPlanModel;

    public readonly createSchema = SubscriptionCreateInputSchema;
    public readonly updateSchema = SubscriptionUpdateInputSchema;
    public readonly searchSchema = SubscriptionQuerySchema;

    /**
     * Initializes a new instance of the SubscriptionService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional SubscriptionModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: SubscriptionModel) {
        super(ctx, SubscriptionService.ENTITY_NAME);
        this.model = model ?? new SubscriptionModel();
        this.pricingPlanModel = new PricingPlanModel();
    }

    /**
     * Returns default list relations (no relations for subscription)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // LIFECYCLE HOOKS
    // ============================================================================

    /**
     * Hook called before creating a subscription.
     * Automatically calculates endDate based on pricing plan interval if not provided.
     * @param data - The validated subscription creation data
     * @returns The data with calculated endDate
     */
    protected async _beforeCreate(
        data: z.infer<typeof SubscriptionCreateInputSchema>
    ): Promise<z.infer<typeof SubscriptionCreateInputSchema>> {
        // If endDate is already provided, use it as-is
        if (data.endDate) {
            return data;
        }

        // Fetch pricing plan to get billing interval
        const plan = await this.pricingPlanModel.findById(data.pricingPlanId);

        if (!plan) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `Pricing plan with ID ${data.pricingPlanId} not found`
            );
        }

        // Only calculate endDate for recurring plans with an interval
        if (plan.billingScheme !== 'recurring' || !plan.interval) {
            return data;
        }

        // Calculate endDate based on interval
        // startDate may not be present yet, will be set by schema default (new Date())
        // We use new Date() as the base for calculation since the default will be applied during model.create()
        const startDate = data.startDate instanceof Date ? data.startDate : new Date();
        const endDate = this.calculateEndDate(startDate, plan.interval);

        return {
            ...data,
            endDate
        };
    }

    /**
     * Calculates the end date based on start date and billing interval
     * @param startDate - The subscription start date
     * @param interval - The billing interval from pricing plan
     * @returns The calculated end date
     */
    private calculateEndDate(startDate: Date, interval: BillingIntervalEnum): Date {
        const endDate = new Date(startDate);

        switch (interval) {
            case BillingIntervalEnum.MONTH:
                endDate.setMonth(endDate.getMonth() + 1);
                break;
            case BillingIntervalEnum.YEAR:
                endDate.setFullYear(endDate.getFullYear() + 1);
                break;
            case BillingIntervalEnum.BIYEAR:
                endDate.setFullYear(endDate.getFullYear() + 2);
                break;
            default:
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Invalid billing interval: ${interval}`
                );
        }

        return endDate;
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a subscription.
     * Only ADMIN and users with SUBSCRIPTION_CREATE permission can create subscriptions.
     * @param actor - The user or system performing the action.
     * @param _data - The validated input data for the new subscription.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SUBSCRIPTION_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or users with SUBSCRIPTION_CREATE can create subscriptions'
            );
        }
    }

    /**
     * Checks if the actor can update a subscription.
     * Admin or SUBSCRIPTION_UPDATE permission holders can update.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription entity to be updated.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdate(actor: Actor, _entity: Subscription): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.SUBSCRIPTION_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update subscriptions'
            );
        }
    }

    /**
     * Checks if the actor can soft-delete a subscription.
     * Only ADMIN and users with SUBSCRIPTION_DELETE permission can soft-delete subscriptions.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription entity to be soft-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSoftDelete(actor: Actor, _entity: Subscription): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SUBSCRIPTION_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can delete subscriptions'
            );
        }
    }

    /**
     * Checks if the actor can hard-delete a subscription.
     * Only SUPER_ADMIN can hard-delete.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription entity to be hard-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canHardDelete(actor: Actor, _entity: Subscription): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only super admins can permanently delete subscriptions'
            );
        }
    }

    /**
     * Checks if the actor can restore a subscription.
     * Only ADMIN can restore.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription entity to be restored.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canRestore(actor: Actor, _entity: Subscription): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can restore subscriptions'
            );
        }
    }

    /**
     * Checks if the actor can view a subscription.
     * Authenticated users can view subscriptions.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription entity to be viewed.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canView(actor: Actor, _entity: Subscription): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to view subscriptions'
            );
        }
    }

    /**
     * Checks if the actor can list subscriptions.
     * Any authenticated user can list subscriptions.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to list subscriptions'
            );
        }
    }

    /**
     * Checks if the actor can search subscriptions.
     * Any authenticated user can search.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to search subscriptions'
            );
        }
    }

    /**
     * Checks if the actor can count subscriptions.
     * Any authenticated user can count.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to count subscriptions'
            );
        }
    }

    /**
     * Checks if the actor can update the visibility of a subscription.
     * Only ADMIN can update visibility.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription entity to be updated.
     * @param _newVisibility - The new visibility state.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: Subscription,
        _newVisibility: VisibilityEnum
    ): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can update subscription visibility'
            );
        }
    }

    // ============================================================================
    // SEARCH & COUNT IMPLEMENTATION
    // ============================================================================

    /**
     * Executes the database search for subscriptions.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the search.
     * @returns A paginated list of subscriptions matching the criteria.
     * @protected
     */
    protected async _executeSearch(params: Record<string, unknown>, _actor: Actor) {
        const { page = 1, pageSize = 10, ...filterParams } = params;
        return this.model.findAll(filterParams, {
            page: page as number,
            pageSize: pageSize as number
        });
    }

    /**
     * Executes the database count for subscriptions.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the count.
     * @returns An object containing the total count of subscriptions matching the criteria.
     * @protected
     */
    protected async _executeCount(params: Record<string, unknown>, _actor: Actor) {
        const { ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    // ============================================================================
    // CRUD METHODS WITH HOOKS
    // ============================================================================

    /**
     * Creates a new subscription with automatic endDate calculation.
     * Calls _beforeCreate hook to calculate endDate based on pricing plan interval.
     * @param actor - The user or system performing the action.
     * @param data - The validated subscription creation data
     * @returns ServiceOutput containing the created subscription.
     */
    public async create(
        actor: Actor,
        data: z.infer<typeof SubscriptionCreateInputSchema>
    ): Promise<ServiceOutput<Subscription>> {
        return this.runWithLoggingAndValidation({
            methodName: 'create',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Validate input data with subscription schema
                const validatedSubscriptionData = SubscriptionCreateInputSchema.parse(data);

                // Permission check
                this._canCreate(validatedActor, validatedSubscriptionData);

                // Call _beforeCreate hook to calculate endDate
                const dataWithEndDate = await this._beforeCreate(validatedSubscriptionData);

                // Create subscription with calculated endDate
                const subscription = await this.model.create(dataWithEndDate);

                if (!subscription) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to create subscription'
                    );
                }

                return subscription;
            }
        });
    }

    // ============================================================================
    // BUSINESS LOGIC METHODS
    // ============================================================================

    /**
     * Finds subscriptions by client ID.
     * @param actor - The user or system performing the action.
     * @param clientId - The client ID to search for.
     * @returns ServiceOutput containing the subscriptions array.
     */
    public async findByClient(
        actor: Actor,
        clientId: ClientIdType
    ): Promise<ServiceOutput<Subscription[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByClient',
            input: { actor, clientId },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query - model method returns Subscription[] directly
                const subscriptions = await this.model.findByClient(clientId);

                return subscriptions;
            }
        });
    }

    /**
     * Activates a subscription.
     * @param actor - The user or system performing the action.
     * @param subscriptionId - The subscription ID.
     * @param startAt - Optional start date.
     * @returns ServiceOutput containing the activated subscription.
     */
    public async activate(
        actor: Actor,
        subscriptionId: string,
        startAt?: Date
    ): Promise<ServiceOutput<Subscription>> {
        return this.runWithLoggingAndValidation({
            methodName: 'activate',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Check permissions (only admin)
                if (validatedActor.role !== RoleEnum.ADMIN) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins can activate subscriptions'
                    );
                }

                // Execute activation
                const subscription = await this.model.activate(subscriptionId, startAt, undefined);

                if (!subscription) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Subscription not found');
                }

                return subscription;
            }
        });
    }

    /**
     * Cancels a subscription.
     * @param actor - The user or system performing the action.
     * @param subscriptionId - The subscription ID.
     * @param cancelAt - Optional cancel date.
     * @returns ServiceOutput containing the cancelled subscription.
     */
    public async cancel(
        actor: Actor,
        subscriptionId: string,
        cancelAt?: Date
    ): Promise<ServiceOutput<Subscription>> {
        return this.runWithLoggingAndValidation({
            methodName: 'cancel',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Check permissions (only admin)
                if (validatedActor.role !== RoleEnum.ADMIN) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins can cancel subscriptions'
                    );
                }

                // Execute cancellation
                const subscription = await this.model.cancel(subscriptionId, cancelAt, undefined);

                if (!subscription) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Subscription not found');
                }

                return subscription;
            }
        });
    }

    /**
     * Renews a subscription.
     * @param actor - The user or system performing the action.
     * @param subscriptionId - The subscription ID.
     * @param newEndAt - New end date.
     * @returns ServiceOutput containing the renewed subscription.
     */
    public async renew(
        actor: Actor,
        subscriptionId: string,
        newEndAt: Date
    ): Promise<ServiceOutput<Subscription>> {
        return this.runWithLoggingAndValidation({
            methodName: 'renew',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Check permissions (only admin)
                if (validatedActor.role !== RoleEnum.ADMIN) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins can renew subscriptions'
                    );
                }

                // Execute renewal
                const subscription = await this.model.renew(subscriptionId, newEndAt, undefined);

                if (!subscription) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Subscription not found');
                }

                return subscription;
            }
        });
    }

    /**
     * Checks if a subscription is active.
     * @param actor - The user or system performing the action.
     * @param subscriptionId - The subscription ID.
     * @returns ServiceOutput containing boolean indicating active status.
     */
    public async checkIsActive(
        actor: Actor,
        subscriptionId: string
    ): Promise<ServiceOutput<{ isActive: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'checkIsActive',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: subscriptionId } as Subscription);

                // Execute check
                const isActive = await this.model.isActive(subscriptionId);

                return { isActive };
            }
        });
    }

    /**
     * Finds all active subscriptions.
     * @param actor - The user or system performing the action.
     * @returns ServiceOutput containing array of active subscriptions.
     */
    public async findActive(actor: Actor): Promise<ServiceOutput<Subscription[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findActive',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query - model method returns Subscription[] directly
                const subscriptions = await this.model.findActive();

                return subscriptions;
            }
        });
    }

    /**
     * Checks if a subscription's trial is expiring within the specified threshold.
     * @param actor - The user or system performing the action.
     * @param subscriptionId - The subscription ID.
     * @param daysThreshold - Number of days to check.
     * @returns ServiceOutput containing boolean indicating if trial is expiring.
     */
    public async checkTrialExpiring(
        actor: Actor,
        subscriptionId: string,
        daysThreshold: number
    ): Promise<ServiceOutput<{ isExpiring: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'checkTrialExpiring',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: subscriptionId } as Subscription);

                // Execute check
                const isExpiring = await this.model.isTrialExpiring(subscriptionId, daysThreshold);

                return { isExpiring };
            }
        });
    }

    /**
     * Calculates the next billing date for a subscription.
     * @param actor - The user or system performing the action.
     * @param subscriptionId - The subscription ID.
     * @returns ServiceOutput containing the next billing date or null.
     */
    public async getNextBillingDate(
        actor: Actor,
        subscriptionId: string
    ): Promise<ServiceOutput<{ nextBillingDate: Date | null }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getNextBillingDate',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: subscriptionId } as Subscription);

                // Execute calculation
                const nextBillingDate = await this.model.calculateNextBilling(subscriptionId);

                return { nextBillingDate };
            }
        });
    }

    /**
     * Updates the status of a subscription with transition validation.
     * @param actor - The user or system performing the action.
     * @param subscriptionId - The subscription ID.
     * @param newStatus - The new status.
     * @returns ServiceOutput containing the updated subscription.
     */
    public async updateStatus(
        actor: Actor,
        subscriptionId: string,
        newStatus: SubscriptionStatusEnum
    ): Promise<ServiceOutput<Subscription>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateStatus',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Check permissions (only admin)
                if (validatedActor.role !== RoleEnum.ADMIN) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins can update subscription status'
                    );
                }

                // Execute status update (model handles transition validation)
                const subscription = await this.model.updateStatus(
                    subscriptionId,
                    newStatus,
                    undefined
                );

                if (!subscription) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Subscription not found');
                }

                return subscription;
            }
        });
    }

    /**
     * Finds subscriptions that are expiring within the specified days threshold.
     * @param actor - The user or system performing the action.
     * @param daysThreshold - Number of days to look ahead.
     * @returns ServiceOutput containing array of expiring subscriptions.
     */
    public async findExpiring(
        actor: Actor,
        daysThreshold: number
    ): Promise<ServiceOutput<Subscription[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findExpiring',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const subscriptions = await this.model.findExpiring(daysThreshold);

                return subscriptions;
            }
        });
    }

    /**
     * Gets a subscription with its associated items.
     * @param actor - The user or system performing the action.
     * @param subscriptionId - The subscription ID.
     * @returns ServiceOutput containing subscription with items.
     */
    public async getWithItems(
        actor: Actor,
        subscriptionId: string
    ): Promise<
        ServiceOutput<{
            subscription: Subscription;
            items: (typeof subscriptionItems.$inferSelect)[];
        } | null>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getWithItems',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: subscriptionId } as Subscription);

                // Execute query
                const result = await this.model.withItems(subscriptionId);

                return result;
            }
        });
    }
}
