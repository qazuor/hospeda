import { PurchaseModel } from '@repo/db';
import type { ListRelationsConfig } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Purchase } from '@repo/schemas/entities/purchase';
import {
    PurchaseCreateInputSchema,
    PurchaseQuerySchema,
    PurchaseUpdateInputSchema
} from '@repo/schemas/entities/purchase';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing purchases. Implements business logic, permissions, and hooks for Purchase entities.
 * @extends BaseCrudService
 */
export class PurchaseService extends BaseCrudService<
    Purchase,
    PurchaseModel,
    typeof PurchaseCreateInputSchema,
    typeof PurchaseUpdateInputSchema,
    typeof PurchaseQuerySchema
> {
    static readonly ENTITY_NAME = 'purchase';
    protected readonly entityName = PurchaseService.ENTITY_NAME;
    public readonly model: PurchaseModel;

    public readonly createSchema = PurchaseCreateInputSchema;
    public readonly updateSchema = PurchaseUpdateInputSchema;
    public readonly searchSchema = PurchaseQuerySchema;

    /**
     * Initializes a new instance of the PurchaseService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional PurchaseModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: PurchaseModel) {
        super(ctx, PurchaseService.ENTITY_NAME);
        this.model = model ?? new PurchaseModel();
    }

    /**
     * Returns default list relations (no relations for purchase)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a purchase.
     * Only ADMIN and users with PURCHASE_CREATE permission can create purchases.
     * @param actor - The user or system performing the action.
     * @param _data - The validated input data for the new purchase.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.PURCHASE_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or users with PURCHASE_CREATE can create purchases'
            );
        }
    }

    /**
     * Checks if the actor can update a purchase.
     * Admin or PURCHASE_UPDATE permission holders can update.
     * @param actor - The user or system performing the action.
     * @param _entity - The purchase entity to be updated.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdate(actor: Actor, _entity: Purchase): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PURCHASE_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update purchases'
            );
        }
    }

    /**
     * Checks if the actor can soft delete a purchase.
     * Admin or PURCHASE_DELETE permission holders can soft delete.
     * @param actor - The user or system performing the action.
     * @param _entity - The purchase entity to be soft deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSoftDelete(actor: Actor, _entity: Purchase): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PURCHASE_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can soft delete purchases'
            );
        }
    }

    /**
     * Checks if the actor can hard delete a purchase.
     * Only super admins can permanently delete.
     * @param actor - The user or system performing the action.
     * @param _entity - The purchase entity to be hard deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canHardDelete(actor: Actor, _entity: Purchase): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only super admins can permanently delete purchases'
            );
        }
    }

    /**
     * Checks if the actor can restore a purchase.
     * Only admins can restore soft deleted purchases.
     * @param actor - The user or system performing the action.
     * @param _entity - The purchase entity to be restored.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canRestore(actor: Actor, _entity: Purchase): void {
        if (actor.role !== RoleEnum.ADMIN && actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can restore purchases'
            );
        }
    }

    /**
     * Checks if the actor can view a purchase.
     * Any authenticated user can view purchases.
     * @param actor - The user or system performing the action.
     * @param _entity - The purchase entity to be viewed.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canView(actor: Actor, _entity: Purchase): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to view purchases'
            );
        }
    }

    /**
     * Checks if the actor can list purchases.
     * Any authenticated user can list.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to list purchases'
            );
        }
    }

    /**
     * Checks if the actor can search purchases.
     * Any authenticated user can search.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to search purchases'
            );
        }
    }

    /**
     * Checks if the actor can count purchases.
     * Any authenticated user can count.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to count purchases'
            );
        }
    }

    // ============================================================================
    // SEARCH & COUNT IMPLEMENTATION
    // ============================================================================

    /**
     * Executes the database search for purchases.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the search.
     * @returns A paginated list of purchases matching the criteria.
     * @protected
     */
    protected async _executeSearch(params: Record<string, unknown>, _actor: Actor) {
        const { page = 1, pageSize = 10, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize });
    }

    /**
     * Executes the database count for purchases.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the count.
     * @returns An object containing the total count of purchases matching the criteria.
     * @protected
     */
    protected async _executeCount(params: Record<string, unknown>, _actor: Actor) {
        const { ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    // ============================================================================
    // BUSINESS LOGIC METHODS
    // ============================================================================

    /**
     * Find purchases by client ID
     * @param actor - Actor performing the operation
     * @param clientId - Client ID
     * @param options - Pagination options
     * @returns ServiceOutput with paginated purchases
     */
    public async findByClient(
        actor: Actor,
        clientId: string,
        options?: { page?: number; pageSize?: number }
    ): Promise<ServiceOutput<{ items: Purchase[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByClient',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const result = await this.model.findByClient(clientId, options, undefined);

                return result;
            }
        });
    }

    /**
     * Find purchases by pricing plan ID
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @param options - Pagination options
     * @returns ServiceOutput with paginated purchases
     */
    public async findByPlan(
        actor: Actor,
        pricingPlanId: string,
        options?: { page?: number; pageSize?: number }
    ): Promise<ServiceOutput<{ items: Purchase[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByPlan',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const result = await this.model.findByPlan(pricingPlanId, options, undefined);

                return result;
            }
        });
    }

    /**
     * Calculate total amount for a purchase
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @param quantity - Quantity
     * @returns ServiceOutput with calculated total
     */
    public async calculateTotal(
        actor: Actor,
        pricingPlanId: string,
        quantity = 1
    ): Promise<ServiceOutput<{ total: number | null }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateTotal',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: pricingPlanId } as Purchase);

                // Execute calculation
                const total = await this.model.calculateTotal(pricingPlanId, quantity, undefined);

                return { total };
            }
        });
    }

    /**
     * Create purchase from cart data
     * @param actor - Actor performing the operation
     * @param purchaseData - Purchase data
     * @returns ServiceOutput with created purchase
     */
    public async createFromCart(
        actor: Actor,
        purchaseData: {
            clientId: string;
            pricingPlanId: string;
            purchasedAt?: Date;
        }
    ): Promise<ServiceOutput<Purchase>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createFromCart',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canCreate(validatedActor, purchaseData);

                // Execute creation
                const purchase = await this.model.createFromCart(purchaseData, undefined);

                if (!purchase) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to create purchase from cart'
                    );
                }

                return purchase;
            }
        });
    }

    /**
     * Process payment for a purchase
     * @param actor - Actor performing the operation
     * @param purchaseId - Purchase ID
     * @param paymentData - Payment data
     * @returns ServiceOutput with updated purchase
     */
    public async processPayment(
        actor: Actor,
        purchaseId: string,
        paymentData?: {
            paymentId?: string;
            paymentMethod?: string;
        }
    ): Promise<ServiceOutput<Purchase>> {
        return this.runWithLoggingAndValidation({
            methodName: 'processPayment',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Check permissions (only admin)
                if (validatedActor.role !== RoleEnum.ADMIN) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins can process payments'
                    );
                }

                // Execute payment processing
                const purchase = await this.model.processPayment(
                    purchaseId,
                    paymentData,
                    undefined
                );

                if (!purchase) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Purchase not found');
                }

                return purchase;
            }
        });
    }

    /**
     * Mark purchase as complete
     * @param actor - Actor performing the operation
     * @param purchaseId - Purchase ID
     * @returns ServiceOutput with updated purchase
     */
    public async markComplete(actor: Actor, purchaseId: string): Promise<ServiceOutput<Purchase>> {
        return this.runWithLoggingAndValidation({
            methodName: 'markComplete',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Check permissions (only admin)
                if (validatedActor.role !== RoleEnum.ADMIN) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins can mark purchases as complete'
                    );
                }

                // Execute completion
                const purchase = await this.model.markComplete(purchaseId, undefined);

                if (!purchase) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Purchase not found');
                }

                return purchase;
            }
        });
    }

    /**
     * Get purchase with client information
     * @param actor - Actor performing the operation
     * @param purchaseId - Purchase ID
     * @returns ServiceOutput with purchase and client data
     */
    public async getWithClient(
        actor: Actor,
        purchaseId: string
    ): Promise<
        ServiceOutput<{
            purchase: Purchase;
            client: {
                id: string;
                name: string;
                billingEmail: string;
            };
        } | null>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getWithClient',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: purchaseId } as Purchase);

                // Execute query
                const result = await this.model.withClient(purchaseId, undefined);

                return result;
            }
        });
    }

    /**
     * Get purchase with pricing plan information
     * @param actor - Actor performing the operation
     * @param purchaseId - Purchase ID
     * @returns ServiceOutput with purchase and plan data
     */
    public async getWithPlan(
        actor: Actor,
        purchaseId: string
    ): Promise<
        ServiceOutput<{
            purchase: Purchase;
            pricingPlan: {
                id: string;
                amountMinor: number;
                currency: string;
                billingScheme: string;
            };
        } | null>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getWithPlan',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: purchaseId } as Purchase);

                // Execute query
                const result = await this.model.withPlan(purchaseId, undefined);

                return result;
            }
        });
    }

    /**
     * Get recent purchases for a client
     * @param actor - Actor performing the operation
     * @param clientId - Client ID
     * @param limit - Maximum number of purchases to return
     * @returns ServiceOutput with array of purchases
     */
    public async getRecentPurchases(
        actor: Actor,
        clientId: string,
        limit = 10
    ): Promise<ServiceOutput<Purchase[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getRecentPurchases',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const purchases = await this.model.getRecentPurchases(clientId, limit, undefined);

                return purchases;
            }
        });
    }

    /**
     * Get purchase with subscription items
     * @param actor - Actor performing the operation
     * @param purchaseId - Purchase ID
     * @returns ServiceOutput with purchase and items
     */
    public async getWithItems(
        actor: Actor,
        purchaseId: string
    ): Promise<
        ServiceOutput<{
            purchase: Purchase;
            items: Array<{
                id: string;
                linkedEntityId: string;
                entityType: string;
            }>;
        } | null>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getWithItems',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: purchaseId } as Purchase);

                // Execute query
                const result = await this.model.withItems(purchaseId, undefined);

                return result;
            }
        });
    }
}
