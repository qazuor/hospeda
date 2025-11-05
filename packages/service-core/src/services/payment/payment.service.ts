import type { PaymentModel } from '@repo/db';
import type { payments } from '@repo/db';
import {
    type ListRelationsConfig,
    PaymentCreateInputSchema,
    type PaymentProviderEnum,
    PaymentSearchSchema,
    type PaymentStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    UpdatePaymentSchema
} from '@repo/schemas';

// Use the DB schema inferred type for Payment
type Payment = typeof payments.$inferSelect;
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing payments. Implements business logic, permissions, and hooks for Payment entities.
 * Handles payment processing, webhooks, and payment status management.
 * @extends BaseCrudService
 */
export class PaymentService extends BaseCrudService<
    Payment,
    PaymentModel,
    typeof PaymentCreateInputSchema,
    typeof UpdatePaymentSchema,
    typeof PaymentSearchSchema
> {
    static readonly ENTITY_NAME = 'payment';
    protected readonly entityName = PaymentService.ENTITY_NAME;
    public readonly model: PaymentModel;

    public readonly createSchema = PaymentCreateInputSchema;
    public readonly updateSchema = UpdatePaymentSchema;
    public readonly searchSchema = PaymentSearchSchema;

    /**
     * Initializes a new instance of the PaymentService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional PaymentModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: PaymentModel) {
        super(ctx, PaymentService.ENTITY_NAME);
        this.model = model ?? ({} as PaymentModel);
    }

    /**
     * Returns default list relations (no relations for payments)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a payment.
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
                'Permission denied: Only admins or users with CLIENT_UPDATE can create payments'
            );
        }
    }

    /**
     * Checks if the actor can update a payment.
     * Admin or CLIENT_UPDATE permission holders can update.
     */
    protected _canUpdate(actor: Actor, _entity: Payment): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update payments'
            );
        }
    }

    /**
     * Checks if the actor can soft delete a payment.
     * Admin or CLIENT_UPDATE permission holders can soft delete.
     */
    protected _canSoftDelete(actor: Actor, _entity: Payment): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete payments'
            );
        }
    }

    /**
     * Checks if the actor can hard delete a payment.
     * Only ADMIN can hard delete.
     */
    protected _canHardDelete(actor: Actor, _entity: Payment): void {
        if (actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete payments'
            );
        }
    }

    /**
     * Checks if the actor can view a payment.
     * Admin or CLIENT_UPDATE permission holders can view.
     */
    protected _canView(actor: Actor, _entity: Payment): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view payments'
            );
        }
    }

    /**
     * Checks if the actor can list payments.
     * Admin or CLIENT_UPDATE permission holders can list.
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list payments'
            );
        }
    }

    /**
     * Checks if the actor can restore a payment.
     * Admin or CLIENT_UPDATE permission holders can restore.
     */
    protected _canRestore(actor: Actor, _entity: Payment): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore payments'
            );
        }
    }

    /**
     * Checks if the actor can search payments.
     * Admin or CLIENT_UPDATE permission holders can search.
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search payments'
            );
        }
    }

    /**
     * Checks if the actor can count payments.
     * Admin or CLIENT_UPDATE permission holders can count.
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count payments'
            );
        }
    }

    /**
     * Checks if the actor can update visibility of a payment.
     * Admin or CLIENT_UPDATE permission holders can update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: Payment): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update visibility of payments'
            );
        }
    }

    /**
     * Checks if the actor can update lifecycle state of a payment.
     * Admin or CLIENT_UPDATE permission holders can update lifecycle state.
     */
    protected _canUpdateLifecycleState(actor: Actor, _entity: Payment): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update lifecycle state of payments'
            );
        }
    }

    /**
     * Executes search for payments.
     * Uses the model's findAll method to retrieve paginated results.
     */
    protected async _executeSearch(
        params: z.infer<typeof PaymentSearchSchema>,
        _actor: Actor
    ): Promise<{ items: Payment[]; total: number }> {
        const { page, pageSize } = params;
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes count for payments.
     * Uses the model's count method to count payments based on provided criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof PaymentSearchSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // =========================================================================
    // Business Methods - Payment Processing
    // =========================================================================

    /**
     * Process payment with provider
     *
     * Creates a new payment record and initiates processing with the payment provider.
     *
     * @param actor - Current user context
     * @param data - Payment processing data
     * @returns Service output with newly created payment
     */
    public async processWithProvider(
        actor: Actor,
        data: {
            invoiceId: string;
            amount: number;
            currency?: string;
            provider: PaymentProviderEnum;
            providerPaymentId?: string;
        }
    ): Promise<ServiceOutput<Payment | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'processWithProvider',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, data);

                try {
                    const payment = await this.model.processWithProvider(data);
                    return payment;
                } catch (error) {
                    if (error instanceof Error && error.message === 'INVOICE_NOT_FOUND') {
                        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Invoice not found');
                    }
                    throw error;
                }
            }
        });
    }

    /**
     * Handle webhook from payment provider
     *
     * Processes webhook notifications from payment providers to update payment status.
     *
     * @param actor - Current user context
     * @param providerPaymentId - Provider's payment ID
     * @param newStatus - New payment status from provider
     * @param webhookData - Optional webhook payload data
     * @returns Service output with updated payment
     */
    public async handleWebhook(
        actor: Actor,
        providerPaymentId: string,
        newStatus: PaymentStatusEnum,
        webhookData?: Record<string, unknown>
    ): Promise<ServiceOutput<Payment | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'handleWebhook',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as Payment);

                try {
                    const payment = await this.model.handleWebhook(
                        providerPaymentId,
                        newStatus,
                        webhookData
                    );
                    return payment;
                } catch (error) {
                    if (error instanceof Error && error.message === 'PAYMENT_NOT_FOUND') {
                        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Payment not found');
                    }
                    throw error;
                }
            }
        });
    }

    /**
     * Sync payment status with provider
     *
     * Synchronizes payment status by querying the payment provider's API.
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @returns Service output with updated payment
     */
    public async syncStatus(
        actor: Actor,
        paymentId: string
    ): Promise<ServiceOutput<Payment | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'syncStatus',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Payment);

                const payment = await this.model.syncStatus(paymentId);
                return payment;
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Queries
    // =========================================================================

    /**
     * Find payments by invoice
     *
     * @param actor - Current user context
     * @param invoiceId - Invoice ID
     * @returns Service output with payments for the invoice
     */
    public async findByInvoice(actor: Actor, invoiceId: string): Promise<ServiceOutput<Payment[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByInvoice',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const payments = await this.model.findByInvoice(invoiceId);
                return payments;
            }
        });
    }

    /**
     * Find payments by provider
     *
     * @param actor - Current user context
     * @param provider - Payment provider
     * @returns Service output with payments from the provider
     */
    public async findByProvider(
        actor: Actor,
        provider: PaymentProviderEnum
    ): Promise<ServiceOutput<Payment[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByProvider',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const payments = await this.model.findByProvider(provider);
                return payments;
            }
        });
    }

    /**
     * Find pending payments
     *
     * Returns all payments with PENDING status.
     *
     * @param actor - Current user context
     * @returns Service output with pending payments
     */
    public async findPending(actor: Actor): Promise<ServiceOutput<Payment[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findPending',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const payments = await this.model.findPending();
                return payments;
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Status Management
    // =========================================================================

    /**
     * Mark payment as approved
     *
     * Updates payment status to APPROVED and sets paidAt timestamp.
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @param paidAt - Optional payment date (defaults to current date)
     * @returns Service output with updated payment
     */
    public async markApproved(
        actor: Actor,
        paymentId: string,
        paidAt?: Date
    ): Promise<ServiceOutput<Payment | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'markApproved',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as Payment);

                const payment = await this.model.markApproved(paymentId, paidAt);
                return payment;
            }
        });
    }

    /**
     * Mark payment as rejected
     *
     * Updates payment status to REJECTED with optional rejection reason.
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @param reason - Optional rejection reason
     * @returns Service output with updated payment
     */
    public async markRejected(
        actor: Actor,
        paymentId: string,
        reason?: string
    ): Promise<ServiceOutput<Payment | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'markRejected',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as Payment);

                const payment = await this.model.markRejected(paymentId, reason);
                return payment;
            }
        });
    }

    /**
     * Retry failed payment
     *
     * Business Rules:
     * - Can only retry payments with REJECTED or CANCELLED status
     * - Resets payment to PENDING status
     * - Optionally updates provider payment ID for new attempt
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @param newProviderPaymentId - Optional new provider payment ID
     * @returns Service output with updated payment
     */
    public async retryPayment(
        actor: Actor,
        paymentId: string,
        newProviderPaymentId?: string
    ): Promise<ServiceOutput<Payment | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'retryPayment',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as Payment);

                try {
                    const payment = await this.model.retryPayment(paymentId, newProviderPaymentId);
                    return payment;
                } catch (error) {
                    if (error instanceof Error && error.message === 'PAYMENT_NOT_FOUND') {
                        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Payment not found');
                    }
                    if (error instanceof Error && error.message === 'PAYMENT_CANNOT_BE_RETRIED') {
                        throw new ServiceError(
                            ServiceErrorCode.VALIDATION_ERROR,
                            'Payment cannot be retried (only REJECTED or CANCELLED payments can be retried)'
                        );
                    }
                    throw error;
                }
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Status Checks
    // =========================================================================

    /**
     * Check if payment is successful
     *
     * Returns true if payment status is APPROVED or AUTHORIZED.
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @returns Service output with boolean result
     */
    public async isSuccessful(actor: Actor, paymentId: string): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'isSuccessful',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Payment);

                const isSuccess = await this.model.isSuccessful(paymentId);
                return isSuccess;
            }
        });
    }

    /**
     * Check if payment is pending
     *
     * Returns true if payment status is PENDING, IN_PROCESS, or IN_MEDIATION.
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @returns Service output with boolean result
     */
    public async isPending(actor: Actor, paymentId: string): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'isPending',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Payment);

                const pending = await this.model.isPending(paymentId);
                return pending;
            }
        });
    }

    /**
     * Check if payment can be refunded
     *
     * Returns true if payment is in a refundable state (APPROVED or AUTHORIZED).
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @returns Service output with boolean result
     */
    public async canBeRefunded(actor: Actor, paymentId: string): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'canBeRefunded',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Payment);

                const canRefund = await this.model.canBeRefunded(paymentId);
                return canRefund;
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Analytics
    // =========================================================================

    /**
     * Get total successful payments for invoice
     *
     * Calculates the sum of all successful payments (excluding REJECTED and CANCELLED) for an invoice.
     *
     * @param actor - Current user context
     * @param invoiceId - Invoice ID
     * @returns Service output with total amount
     */
    public async getTotalSuccessfulForInvoice(
        actor: Actor,
        invoiceId: string
    ): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTotalSuccessfulForInvoice',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Payment);

                const total = await this.model.getTotalSuccessfulForInvoice(invoiceId);
                return total;
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Relations
    // =========================================================================

    /**
     * Get payment with invoice data
     *
     * Retrieves payment along with related invoice information.
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @returns Service output with payment and invoice data
     */
    public async withInvoice(
        actor: Actor,
        paymentId: string
    ): Promise<ServiceOutput<Awaited<ReturnType<PaymentModel['withInvoice']>>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'withInvoice',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Payment);

                const paymentWithInvoice = await this.model.withInvoice(paymentId);
                return paymentWithInvoice;
            }
        });
    }

    // =========================================================================
    // Business Methods - Payment Actions
    // =========================================================================

    /**
     * Cancel payment
     *
     * Updates payment status to CANCELLED with optional cancellation reason.
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @param reason - Optional cancellation reason
     * @returns Service output with updated payment
     */
    public async cancel(
        actor: Actor,
        paymentId: string,
        reason?: string
    ): Promise<ServiceOutput<Payment | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'cancel',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as Payment);

                const payment = await this.model.cancel(paymentId, reason);
                return payment;
            }
        });
    }
}
