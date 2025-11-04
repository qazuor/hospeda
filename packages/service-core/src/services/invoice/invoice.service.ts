import type { InvoiceModel } from '@repo/db';
import {
    CreateInvoiceSchema,
    type Invoice,
    InvoiceSearchSchema,
    InvoiceStatusEnum,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    UpdateInvoiceSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing invoices. Implements business logic, permissions, and hooks for Invoice entities.
 * Handles billing invoices for client subscriptions.
 * @extends BaseCrudService
 */
export class InvoiceService extends BaseCrudService<
    Invoice,
    InvoiceModel,
    typeof CreateInvoiceSchema,
    typeof UpdateInvoiceSchema,
    typeof InvoiceSearchSchema
> {
    static readonly ENTITY_NAME = 'invoice';
    protected readonly entityName = InvoiceService.ENTITY_NAME;
    public readonly model: InvoiceModel;

    public readonly createSchema = CreateInvoiceSchema;
    public readonly updateSchema = UpdateInvoiceSchema;
    public readonly searchSchema = InvoiceSearchSchema;

    /**
     * Initializes a new instance of the InvoiceService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional InvoiceModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: InvoiceModel) {
        super(ctx, InvoiceService.ENTITY_NAME);
        this.model = model ?? ({} as InvoiceModel);
    }

    /**
     * Returns default list relations (no relations for invoices)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create an invoice.
     * Only ADMIN and users with BILLING_INVOICES_MANAGE permission can create.
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
                'Permission denied: Only admins or users with CLIENT_UPDATE can create invoices'
            );
        }
    }

    /**
     * Checks if the actor can update an invoice.
     * Admin or BILLING_INVOICES_MANAGE permission holders can update.
     */
    protected _canUpdate(actor: Actor, _entity: Invoice): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update invoices'
            );
        }
    }

    /**
     * Checks if the actor can soft delete an invoice.
     * Admin or BILLING_INVOICES_MANAGE permission holders can soft delete.
     */
    protected _canSoftDelete(actor: Actor, _entity: Invoice): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete invoices'
            );
        }
    }

    /**
     * Checks if the actor can hard delete an invoice.
     * Only ADMIN can hard delete.
     */
    protected _canHardDelete(actor: Actor, _entity: Invoice): void {
        if (actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete invoices'
            );
        }
    }

    /**
     * Checks if the actor can view an invoice.
     * Admin or BILLING_INVOICES_MANAGE permission holders can view.
     */
    protected _canView(actor: Actor, _entity: Invoice): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view invoices'
            );
        }
    }

    /**
     * Checks if the actor can list invoices.
     * Admin or BILLING_INVOICES_MANAGE permission holders can list.
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list invoices'
            );
        }
    }

    /**
     * Checks if the actor can restore an invoice.
     * Admin or BILLING_INVOICES_MANAGE permission holders can restore.
     */
    protected _canRestore(actor: Actor, _entity: Invoice): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore invoices'
            );
        }
    }

    /**
     * Checks if the actor can search invoices.
     * Admin or BILLING_INVOICES_MANAGE permission holders can search.
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search invoices'
            );
        }
    }

    /**
     * Checks if the actor can count invoices.
     * Admin or BILLING_INVOICES_MANAGE permission holders can count.
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count invoices'
            );
        }
    }

    /**
     * Checks if the actor can update visibility of an invoice.
     * Admin or BILLING_INVOICES_MANAGE permission holders can update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: Invoice): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update visibility of invoices'
            );
        }
    }

    /**
     * Checks if the actor can update lifecycle state of an invoice.
     * Admin or BILLING_INVOICES_MANAGE permission holders can update lifecycle state.
     */
    protected _canUpdateLifecycleState(actor: Actor, _entity: Invoice): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update lifecycle state of invoices'
            );
        }
    }

    /**
     * Executes search for invoices.
     * Uses the model's findAll method to retrieve paginated results.
     */
    protected async _executeSearch(
        params: z.infer<typeof InvoiceSearchSchema>,
        _actor: Actor
    ): Promise<{ items: Invoice[]; total: number }> {
        const { page, pageSize } = params;
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes count for invoices.
     * Uses the model's count method to count invoices based on provided criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof InvoiceSearchSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // =========================================================================
    // Business Methods - Invoice Generation
    // =========================================================================

    /**
     * Generate invoice from subscription for billing cycle
     *
     * @param actor - Current user context
     * @param subscriptionId - Subscription ID
     * @param billingPeriodStart - Start of billing period
     * @param billingPeriodEnd - End of billing period
     * @returns Service output with newly created invoice
     */
    public async generateFromSubscription(
        actor: Actor,
        subscriptionId: string,
        billingPeriodStart: Date,
        billingPeriodEnd: Date
    ): Promise<ServiceOutput<Invoice | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'generateFromSubscription',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, {});

                const invoice = await this.model.generateFromSubscription(
                    subscriptionId,
                    billingPeriodStart,
                    billingPeriodEnd
                );

                return invoice;
            }
        });
    }

    /**
     * Calculate invoice totals from line items
     *
     * @param actor - Current user context
     * @param invoiceId - Invoice ID
     * @returns Service output with calculated totals
     */
    public async calculateTotals(
        actor: Actor,
        invoiceId: string
    ): Promise<ServiceOutput<{ subtotal: number; tax: number; total: number } | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateTotals',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Invoice);

                const totals = await this.model.calculateTotals(invoiceId);

                return totals;
            }
        });
    }

    // =========================================================================
    // Business Methods - Invoice Status Management
    // =========================================================================

    /**
     * Mark invoice as paid
     *
     * Business Rules:
     * - Can only mark OPEN invoices as paid
     * - Sets paidAt timestamp
     * - Updates status to PAID
     *
     * @param actor - Current user context
     * @param invoiceId - Invoice ID
     * @param input - Payment details (optional paidAt date)
     * @returns Service output with updated invoice
     */
    public async markAsPaid(
        actor: Actor,
        invoiceId: string,
        input: { paidAt?: Date }
    ): Promise<ServiceOutput<Invoice | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'markAsPaid',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as Invoice);

                // Check if invoice can be marked as paid
                const canMarkPaid = await this.model.canMarkPaid(invoiceId);

                if (!canMarkPaid) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Invoice cannot be marked as paid (must be in OPEN status)'
                    );
                }

                const paidAt = input.paidAt || new Date();
                const invoice = await this.model.markAsPaid(invoiceId, paidAt);

                return invoice;
            }
        });
    }

    /**
     * Mark invoice as void
     *
     * Business Rules:
     * - Can only void OPEN invoices
     * - Stores void reason in metadata
     * - Updates status to VOID
     *
     * @param actor - Current user context
     * @param invoiceId - Invoice ID
     * @param reason - Reason for voiding the invoice
     * @returns Service output indicating success
     */
    public async markAsVoid(
        actor: Actor,
        invoiceId: string,
        reason: string
    ): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'markAsVoid',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as Invoice);

                // Check if invoice can be voided
                const canVoid = await this.model.canVoid(invoiceId);

                if (!canVoid) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Invoice cannot be voided (must be in OPEN status)'
                    );
                }

                // Get current invoice
                const invoice = await this.model.findById(invoiceId);

                if (!invoice) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Invoice not found');
                }

                // Update invoice status to VOID and store reason
                await this.model.update(
                    { id: invoiceId },
                    {
                        status: InvoiceStatusEnum.VOID,
                        metadata: {
                            ...invoice.metadata,
                            voidReason: reason,
                            voidedAt: new Date().toISOString()
                        }
                    }
                );

                return true;
            }
        });
    }

    // =========================================================================
    // Business Methods - Invoice Queries
    // =========================================================================

    /**
     * Find invoice by invoice number
     *
     * @param actor - Current user context
     * @param invoiceNumber - Unique invoice number
     * @returns Service output with found invoice or null
     */
    public async findByNumber(
        actor: Actor,
        invoiceNumber: string
    ): Promise<ServiceOutput<Invoice | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByNumber',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const invoice = await this.model.findOne({ invoiceNumber });

                return invoice;
            }
        });
    }

    /**
     * Find invoices by client
     *
     * @param actor - Current user context
     * @param clientId - Client ID
     * @returns Service output with invoices for the client
     */
    public async findByClient(actor: Actor, clientId: string): Promise<ServiceOutput<Invoice[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByClient',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const invoices = await this.model.findByClient(clientId);

                return invoices;
            }
        });
    }

    /**
     * Find overdue invoices
     *
     * Returns invoices with status OPEN that are past their due date.
     *
     * @param actor - Current user context
     * @param daysOverdue - Optional: Only return invoices overdue by this many days or more
     * @returns Service output with overdue invoices
     */
    public async findOverdue(
        actor: Actor,
        daysOverdue?: number
    ): Promise<ServiceOutput<Invoice[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findOverdue',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const invoices = await this.model.findOverdue();

                // If daysOverdue is specified, filter further
                if (daysOverdue !== undefined) {
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

                    return invoices.filter((invoice: Invoice) => invoice.dueDate <= cutoffDate);
                }

                return invoices;
            }
        });
    }

    // =========================================================================
    // Business Methods - Invoice Actions
    // =========================================================================

    /**
     * Send payment reminder for invoice
     *
     * This is a placeholder that logs the reminder action.
     * In a real implementation, this would trigger email/notification sending.
     *
     * @param actor - Current user context
     * @param invoiceId - Invoice ID
     * @returns Service output indicating success
     */
    public async sendReminder(actor: Actor, invoiceId: string): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'sendReminder',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Invoice);

                // Check if invoice exists
                const invoice = await this.model.findById(invoiceId);

                if (!invoice) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Invoice not found');
                }

                // Log the reminder (placeholder for actual email/notification sending)
                this.logger.info(
                    `Invoice payment reminder sent: ${invoice.invoiceNumber} for client ${invoice.clientId}`
                );

                // TODO: Implement actual email/notification sending
                // await emailService.sendInvoiceReminder(invoice);

                return true;
            }
        });
    }
}
