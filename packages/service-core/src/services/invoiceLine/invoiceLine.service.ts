import type { InvoiceLineModel } from '@repo/db';
import type { invoiceLines } from '@repo/db';
import {
    CreateInvoiceLineSchema,
    InvoiceLineSearchSchema,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    UpdateInvoiceLineSchema
} from '@repo/schemas';

// Use the DB schema inferred type for InvoiceLine
type InvoiceLine = typeof invoiceLines.$inferSelect;
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing invoice line items. Implements business logic, permissions, and hooks for InvoiceLine entities.
 * Handles individual line items within invoices with calculations for tax, discounts, and totals.
 * @extends BaseCrudService
 */
export class InvoiceLineService extends BaseCrudService<
    InvoiceLine,
    InvoiceLineModel,
    typeof CreateInvoiceLineSchema,
    typeof UpdateInvoiceLineSchema,
    typeof InvoiceLineSearchSchema
> {
    static readonly ENTITY_NAME = 'invoiceLine';
    protected readonly entityName = InvoiceLineService.ENTITY_NAME;
    public readonly model: InvoiceLineModel;

    public readonly createSchema = CreateInvoiceLineSchema;
    public readonly updateSchema = UpdateInvoiceLineSchema;
    public readonly searchSchema = InvoiceLineSearchSchema;

    /**
     * Initializes a new instance of the InvoiceLineService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional InvoiceLineModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: InvoiceLineModel) {
        super(ctx, InvoiceLineService.ENTITY_NAME);
        this.model = model ?? ({} as InvoiceLineModel);
    }

    /**
     * Returns default list relations (no relations for invoice lines)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create an invoice line.
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
                'Permission denied: Only admins or users with CLIENT_UPDATE can create invoice lines'
            );
        }
    }

    /**
     * Checks if the actor can update an invoice line.
     * Admin or CLIENT_UPDATE permission holders can update.
     */
    protected _canUpdate(actor: Actor, _entity: InvoiceLine): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update invoice lines'
            );
        }
    }

    /**
     * Checks if the actor can soft delete an invoice line.
     * Admin or CLIENT_UPDATE permission holders can soft delete.
     */
    protected _canSoftDelete(actor: Actor, _entity: InvoiceLine): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete invoice lines'
            );
        }
    }

    /**
     * Checks if the actor can hard delete an invoice line.
     * Only ADMIN can hard delete.
     */
    protected _canHardDelete(actor: Actor, _entity: InvoiceLine): void {
        if (actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete invoice lines'
            );
        }
    }

    /**
     * Checks if the actor can view an invoice line.
     * Admin or CLIENT_UPDATE permission holders can view.
     */
    protected _canView(actor: Actor, _entity: InvoiceLine): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view invoice lines'
            );
        }
    }

    /**
     * Checks if the actor can list invoice lines.
     * Admin or CLIENT_UPDATE permission holders can list.
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list invoice lines'
            );
        }
    }

    /**
     * Checks if the actor can restore an invoice line.
     * Admin or CLIENT_UPDATE permission holders can restore.
     */
    protected _canRestore(actor: Actor, _entity: InvoiceLine): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore invoice lines'
            );
        }
    }

    /**
     * Checks if the actor can search invoice lines.
     * Admin or CLIENT_UPDATE permission holders can search.
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search invoice lines'
            );
        }
    }

    /**
     * Checks if the actor can count invoice lines.
     * Admin or CLIENT_UPDATE permission holders can count.
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count invoice lines'
            );
        }
    }

    /**
     * Checks if the actor can update visibility of an invoice line.
     * Admin or CLIENT_UPDATE permission holders can update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: InvoiceLine): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update visibility of invoice lines'
            );
        }
    }

    /**
     * Checks if the actor can update lifecycle state of an invoice line.
     * Admin or CLIENT_UPDATE permission holders can update lifecycle state.
     */
    protected _canUpdateLifecycleState(actor: Actor, _entity: InvoiceLine): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update lifecycle state of invoice lines'
            );
        }
    }

    /**
     * Executes search for invoice lines.
     * Uses the model's findAll method to retrieve paginated results.
     */
    protected async _executeSearch(
        params: z.infer<typeof InvoiceLineSearchSchema>,
        _actor: Actor
    ): Promise<{ items: InvoiceLine[]; total: number }> {
        const { page, pageSize } = params;
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes count for invoice lines.
     * Uses the model's count method to count invoice lines based on provided criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof InvoiceLineSearchSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // =========================================================================
    // Business Methods - Invoice Line Calculations
    // =========================================================================

    /**
     * Calculate line total including tax and discounts
     *
     * @param actor - Current user context
     * @param invoiceLineId - Invoice line ID
     * @returns Service output with calculated totals (lineAmount, taxAmount, totalAmount)
     */
    public async calculateLineTotal(
        actor: Actor,
        invoiceLineId: string
    ): Promise<
        ServiceOutput<{ lineAmount: number; taxAmount: number; totalAmount: number } | null>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateLineTotal',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as InvoiceLine);

                const totals = await this.model.calculateLineTotal(invoiceLineId);

                return totals;
            }
        });
    }

    /**
     * Apply discounts to line item
     *
     * @param actor - Current user context
     * @param invoiceLineId - Invoice line ID
     * @param discountRate - Optional discount rate (percentage as decimal, e.g., 0.1 for 10%)
     * @param discountAmount - Optional fixed discount amount
     * @returns Service output with updated invoice line
     */
    public async applyDiscounts(
        actor: Actor,
        invoiceLineId: string,
        discountRate?: number,
        discountAmount?: number
    ): Promise<ServiceOutput<InvoiceLine | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'applyDiscounts',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as InvoiceLine);

                const updatedLine = await this.model.applyDiscounts(
                    invoiceLineId,
                    discountRate,
                    discountAmount
                );

                return updatedLine;
            }
        });
    }

    /**
     * Calculate tax for line item
     *
     * @param actor - Current user context
     * @param invoiceLineId - Invoice line ID
     * @param taxRate - Tax rate as decimal (e.g., 0.21 for 21%)
     * @returns Service output with updated invoice line
     */
    public async calculateTax(
        actor: Actor,
        invoiceLineId: string,
        taxRate: number
    ): Promise<ServiceOutput<InvoiceLine | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateTax',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as InvoiceLine);

                const updatedLine = await this.model.calculateTax(invoiceLineId, taxRate);

                return updatedLine;
            }
        });
    }

    // =========================================================================
    // Business Methods - Invoice Line Queries
    // =========================================================================

    /**
     * Find line items by invoice
     *
     * @param actor - Current user context
     * @param invoiceId - Invoice ID
     * @returns Service output with line items for the invoice
     */
    public async findByInvoice(
        actor: Actor,
        invoiceId: string
    ): Promise<ServiceOutput<InvoiceLine[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByInvoice',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const lines = await this.model.findByInvoice(invoiceId);

                return lines;
            }
        });
    }

    /**
     * Find line items by subscription item
     *
     * @param actor - Current user context
     * @param subscriptionItemId - Subscription item ID
     * @returns Service output with line items for the subscription item
     */
    public async findBySubscriptionItem(
        actor: Actor,
        subscriptionItemId: string
    ): Promise<ServiceOutput<InvoiceLine[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findBySubscriptionItem',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const lines = await this.model.findBySubscriptionItem(subscriptionItemId);

                return lines;
            }
        });
    }

    /**
     * Get line items with their related invoice data
     *
     * @param actor - Current user context
     * @param invoiceLineId - Invoice line ID
     * @returns Service output with line item and related invoice data
     */
    public async withInvoice(
        actor: Actor,
        invoiceLineId: string
    ): Promise<ServiceOutput<Awaited<ReturnType<InvoiceLineModel['withInvoice']>>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'withInvoice',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as InvoiceLine);

                const lineWithInvoice = await this.model.withInvoice(invoiceLineId);

                return lineWithInvoice;
            }
        });
    }

    // =========================================================================
    // Business Methods - Invoice Line Modifications
    // =========================================================================

    /**
     * Update quantity and recalculate totals
     *
     * Business Rules:
     * - Quantity must be positive
     * - Automatically recalculates line amounts, tax, and totals
     *
     * @param actor - Current user context
     * @param invoiceLineId - Invoice line ID
     * @param quantity - New quantity (must be positive)
     * @returns Service output with updated invoice line
     */
    public async updateQuantity(
        actor: Actor,
        invoiceLineId: string,
        quantity: number
    ): Promise<ServiceOutput<InvoiceLine | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateQuantity',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as InvoiceLine);

                const updatedLine = await this.model.updateQuantity(invoiceLineId, quantity);

                return updatedLine;
            }
        });
    }

    /**
     * Create a new invoice line with calculations
     *
     * Automatically calculates line amounts, tax, and totals based on provided data.
     *
     * @param actor - Current user context
     * @param data - Invoice line creation data
     * @returns Service output with newly created invoice line
     */
    public async createWithCalculations(
        actor: Actor,
        data: {
            invoiceId: string;
            description: string;
            quantity: number;
            unitPrice: number;
            taxRate?: number;
            discountRate?: number;
            discountAmount?: number;
            pricingPlanId?: string;
            subscriptionItemId?: string;
            periodStart?: Date;
            periodEnd?: Date;
            metadata?: Record<string, unknown>;
        }
    ): Promise<ServiceOutput<InvoiceLine | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createWithCalculations',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, data);

                const newLine = await this.model.createWithCalculations(data);

                return newLine;
            }
        });
    }

    /**
     * Bulk update quantities for multiple line items
     *
     * Updates quantities for multiple invoice lines in a single operation.
     * Each line is recalculated independently.
     *
     * @param actor - Current user context
     * @param updates - Array of updates with invoice line ID and new quantity
     * @returns Service output with array of updated invoice lines
     */
    public async bulkUpdateQuantities(
        actor: Actor,
        updates: Array<{ id: string; quantity: number }>
    ): Promise<ServiceOutput<InvoiceLine[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'bulkUpdateQuantities',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as InvoiceLine);

                const updatedLines = await this.model.bulkUpdateQuantities(updates);

                return updatedLines;
            }
        });
    }
}
