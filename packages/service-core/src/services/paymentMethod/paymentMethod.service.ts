import type { PaymentMethod, PaymentMethodModel } from '@repo/db';
import {
    CreatePaymentMethodSchema,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    UpdatePaymentMethodSchema,
    PaymentMethodQuerySchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing payment methods. Implements business logic, permissions, and hooks for PaymentMethod entities.
 * Handles payment method management with validation and business rules.
 * @extends BaseCrudService
 */
export class PaymentMethodService extends BaseCrudService<
    PaymentMethod,
    PaymentMethodModel,
    typeof CreatePaymentMethodSchema,
    typeof UpdatePaymentMethodSchema,
    typeof PaymentMethodQuerySchema
> {
    static readonly ENTITY_NAME = 'paymentMethod';
    protected readonly entityName = PaymentMethodService.ENTITY_NAME;
    public readonly model: PaymentMethodModel;

    public readonly createSchema = CreatePaymentMethodSchema;
    public readonly updateSchema = UpdatePaymentMethodSchema;
    public readonly searchSchema = PaymentMethodQuerySchema;

    /**
     * Initializes a new instance of the PaymentMethodService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional PaymentMethodModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: PaymentMethodModel) {
        super(ctx, PaymentMethodService.ENTITY_NAME);
        this.model = model ?? ({} as PaymentMethodModel);
    }

    /**
     * Returns default list relations (no relations for payment methods)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a payment method.
     * Only ADMIN and users with CLIENT_UPDATE permission can create.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.CLIENT_UPDATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or users with CLIENT_UPDATE can create payment methods'
            );
        }
    }

    /**
     * Checks if the actor can update a payment method.
     * Admin or CLIENT_UPDATE permission holders can update.
     */
    protected _canUpdate(actor: Actor, _entity: PaymentMethod): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update payment methods'
            );
        }
    }

    /**
     * Checks if the actor can soft delete a payment method.
     * Admin or CLIENT_UPDATE permission holders can soft delete.
     */
    protected _canSoftDelete(actor: Actor, _entity: PaymentMethod): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete payment methods'
            );
        }
    }

    /**
     * Checks if the actor can hard delete a payment method.
     * Only ADMIN can hard delete.
     */
    protected _canHardDelete(actor: Actor, _entity: PaymentMethod): void {
        if (actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete payment methods'
            );
        }
    }

    /**
     * Checks if the actor can view a payment method.
     * Admin or CLIENT_UPDATE permission holders can view.
     */
    protected _canView(actor: Actor, _entity: PaymentMethod): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view payment methods'
            );
        }
    }

    /**
     * Checks if the actor can list payment methods.
     * Admin or CLIENT_UPDATE permission holders can list.
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list payment methods'
            );
        }
    }

    /**
     * Checks if the actor can restore a payment method.
     * Admin or CLIENT_UPDATE permission holders can restore.
     */
    protected _canRestore(actor: Actor, _entity: PaymentMethod): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore payment methods'
            );
        }
    }

    /**
     * Checks if the actor can search payment methods.
     * Admin or CLIENT_UPDATE permission holders can search.
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search payment methods'
            );
        }
    }

    /**
     * Checks if the actor can count payment methods.
     * Admin or CLIENT_UPDATE permission holders can count.
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count payment methods'
            );
        }
    }

    /**
     * Checks if the actor can update visibility of a payment method.
     * Admin or CLIENT_UPDATE permission holders can update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: PaymentMethod): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update visibility of payment methods'
            );
        }
    }

    /**
     * Checks if the actor can update lifecycle state of a payment method.
     * Admin or CLIENT_UPDATE permission holders can update lifecycle state.
     */
    protected _canUpdateLifecycleState(actor: Actor, _entity: PaymentMethod): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update lifecycle state of payment methods'
            );
        }
    }

    /**
     * Executes search for payment methods.
     * Uses the model's findAll method to retrieve paginated results.
     */
    protected async _executeSearch(
        params: z.infer<typeof PaymentMethodQuerySchema>,
        _actor: Actor
    ): Promise<{ items: PaymentMethod[]; total: number }> {
        const { page, pageSize } = params;
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes count for payment methods.
     * Uses the model's count method to count payment methods based on provided criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof PaymentMethodQuerySchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // =========================================================================
    // Business Methods - Payment Method Validation
    // =========================================================================

    /**
     * Validate card data before storing
     *
     * Business Rules:
     * - Card number must pass Luhn algorithm
     * - Expiry date must be in the future
     * - CVV must be 3-4 digits
     *
     * @param actor - Current user context
     * @param cardData - Card data to validate
     * @returns Service output with validation result
     */
    public async validateCard(
        actor: Actor,
        cardData: {
            number: string;
            expiryMonth: number;
            expiryYear: number;
            cvv: string;
        }
    ): Promise<ServiceOutput<{ valid: boolean; reason?: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'validateCard',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, {});

                const validation = await this.model.validateCard(cardData);

                return validation;
            }
        });
    }

    /**
     * Tokenize card data
     *
     * Creates a secure token for storing payment method without raw card data.
     * Mock implementation - use real payment provider in production.
     *
     * @param actor - Current user context
     * @param cardData - Card data to tokenize
     * @returns Service output with tokenization result
     */
    public async tokenize(
        actor: Actor,
        cardData: {
            number: string;
            expiryMonth: number;
            expiryYear: number;
            cvv: string;
            holderName: string;
        }
    ): Promise<
        ServiceOutput<{
            success: boolean;
            token?: string;
            brand?: string;
            last4?: string;
            error?: string;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'tokenize',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, {});

                const result = await this.model.tokenize(cardData);

                return result;
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Method Status
    // =========================================================================

    /**
     * Check if payment method is expired
     *
     * @param actor - Current user context
     * @param paymentMethodId - Payment method ID
     * @returns Service output with expiration status
     */
    public async checkExpiration(
        actor: Actor,
        paymentMethodId: string
    ): Promise<ServiceOutput<{ expired: boolean; expiresAt?: Date }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'checkExpiration',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as PaymentMethod);

                const result = await this.model.checkExpiration(paymentMethodId);

                return result;
            }
        });
    }

    /**
     * Set payment method as default for client
     *
     * Business Rules:
     * - Only one payment method can be default per client
     * - Unsets all other payment methods as default
     * - Payment method must exist and belong to client
     *
     * @param actor - Current user context
     * @param paymentMethodId - Payment method ID
     * @returns Service output with operation result
     */
    public async setAsDefault(
        actor: Actor,
        paymentMethodId: string
    ): Promise<ServiceOutput<{ success: boolean; error?: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'setAsDefault',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as PaymentMethod);

                const result = await this.model.setAsDefault(paymentMethodId);

                return result;
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Method Queries
    // =========================================================================

    /**
     * Find payment methods by client
     *
     * Returns all payment methods for a specific client, ordered by default status.
     *
     * @param actor - Current user context
     * @param clientId - Client ID
     * @returns Service output with payment methods
     */
    public async findByClient(
        actor: Actor,
        clientId: string
    ): Promise<ServiceOutput<PaymentMethod[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByClient',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const paymentMethods = await this.model.findByClient(clientId);

                return paymentMethods;
            }
        });
    }

    /**
     * Get default payment method for client
     *
     * @param actor - Current user context
     * @param clientId - Client ID
     * @returns Service output with default payment method or null
     */
    public async getDefaultForClient(
        actor: Actor,
        clientId: string
    ): Promise<ServiceOutput<PaymentMethod | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getDefaultForClient',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as PaymentMethod);

                const defaultMethod = await this.model.getDefaultForClient(clientId);

                return defaultMethod;
            }
        });
    }

    /**
     * Find expired payment methods
     *
     * Returns all payment methods that have expired.
     * Useful for cleanup operations and notifications.
     *
     * @param actor - Current user context
     * @returns Service output with expired payment methods
     */
    public async findExpired(actor: Actor): Promise<ServiceOutput<PaymentMethod[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findExpired',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const expiredMethods = await this.model.findExpired();

                return expiredMethods;
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Method Creation
    // =========================================================================

    /**
     * Create payment method with card tokenization
     *
     * Business Rules:
     * - Card must be validated before tokenization
     * - Token is securely generated (mock - use real provider in production)
     * - Can optionally set as default
     * - Expiry date is calculated from card expiry
     *
     * @param actor - Current user context
     * @param data - Card data and creation options
     * @returns Service output with created payment method
     */
    public async createWithCard(
        actor: Actor,
        data: {
            clientId: string;
            provider: string;
            cardNumber: string;
            expiryMonth: number;
            expiryYear: number;
            cvv: string;
            holderName: string;
            setAsDefault?: boolean;
        }
    ): Promise<
        ServiceOutput<{
            success: boolean;
            paymentMethod?: PaymentMethod;
            error?: string;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'createWithCard',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, {});

                const result = await this.model.createWithCard(data);

                return result;
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Method Removal
    // =========================================================================

    /**
     * Remove payment method (soft delete)
     *
     * Business Rules:
     * - Soft deletes the payment method
     * - If it was default, sets another payment method as default
     * - Payment method must exist
     *
     * @param actor - Current user context
     * @param paymentMethodId - Payment method ID
     * @returns Service output with operation result
     */
    public async remove(
        actor: Actor,
        paymentMethodId: string
    ): Promise<ServiceOutput<{ success: boolean; error?: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'remove',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canSoftDelete(validatedActor, {} as PaymentMethod);

                const result = await this.model.remove(paymentMethodId);

                return result;
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Method Updates
    // =========================================================================

    /**
     * Update payment method expiry
     *
     * Updates the expiration date of a payment method.
     * Useful when card is renewed.
     *
     * @param actor - Current user context
     * @param paymentMethodId - Payment method ID
     * @param expiryMonth - New expiry month (1-12)
     * @param expiryYear - New expiry year (YYYY)
     * @returns Service output with updated payment method or null
     */
    public async updateExpiry(
        actor: Actor,
        paymentMethodId: string,
        expiryMonth: number,
        expiryYear: number
    ): Promise<ServiceOutput<PaymentMethod | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateExpiry',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as PaymentMethod);

                const updatedMethod = await this.model.updateExpiry(
                    paymentMethodId,
                    expiryMonth,
                    expiryYear
                );

                return updatedMethod;
            }
        });
    }
}
