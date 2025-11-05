import type { CreditNote, CreditNoteModel } from '@repo/db';
import {
    CreditNoteQuerySchema,
    CreateCreditNoteSchema,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    UpdateCreditNoteSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing credit notes. Implements business logic, permissions, and hooks for CreditNote entities.
 * Handles credit notes issued against invoices for refunds and adjustments.
 * @extends BaseCrudService
 */
export class CreditNoteService extends BaseCrudService<
    CreditNote,
    CreditNoteModel,
    typeof CreateCreditNoteSchema,
    typeof UpdateCreditNoteSchema,
    typeof CreditNoteQuerySchema
> {
    static readonly ENTITY_NAME = 'creditNote';
    protected readonly entityName = CreditNoteService.ENTITY_NAME;
    public readonly model: CreditNoteModel;

    public readonly createSchema = CreateCreditNoteSchema;
    public readonly updateSchema = UpdateCreditNoteSchema;
    public readonly searchSchema = CreditNoteQuerySchema;

    /**
     * Initializes a new instance of the CreditNoteService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional CreditNoteModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: CreditNoteModel) {
        super(ctx, CreditNoteService.ENTITY_NAME);
        this.model = model ?? ({} as CreditNoteModel);
    }

    /**
     * Returns default list relations (no relations for credit notes)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a credit note.
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
                'Permission denied: Only admins or users with CLIENT_UPDATE can create credit notes'
            );
        }
    }

    /**
     * Checks if the actor can update a credit note.
     * Admin or CLIENT_UPDATE permission holders can update.
     */
    protected _canUpdate(actor: Actor, _entity: CreditNote): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update credit notes'
            );
        }
    }

    /**
     * Checks if the actor can soft delete a credit note.
     * Admin or CLIENT_UPDATE permission holders can soft delete.
     */
    protected _canSoftDelete(actor: Actor, _entity: CreditNote): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete credit notes'
            );
        }
    }

    /**
     * Checks if the actor can hard delete a credit note.
     * Only ADMIN can hard delete.
     */
    protected _canHardDelete(actor: Actor, _entity: CreditNote): void {
        if (actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete credit notes'
            );
        }
    }

    /**
     * Checks if the actor can view a credit note.
     * Admin or CLIENT_UPDATE permission holders can view.
     */
    protected _canView(actor: Actor, _entity: CreditNote): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view credit notes'
            );
        }
    }

    /**
     * Checks if the actor can list credit notes.
     * Admin or CLIENT_UPDATE permission holders can list.
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list credit notes'
            );
        }
    }

    /**
     * Checks if the actor can restore a credit note.
     * Admin or CLIENT_UPDATE permission holders can restore.
     */
    protected _canRestore(actor: Actor, _entity: CreditNote): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore credit notes'
            );
        }
    }

    /**
     * Checks if the actor can search credit notes.
     * Admin or CLIENT_UPDATE permission holders can search.
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search credit notes'
            );
        }
    }

    /**
     * Checks if the actor can count credit notes.
     * Admin or CLIENT_UPDATE permission holders can count.
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count credit notes'
            );
        }
    }

    /**
     * Checks if the actor can update visibility of a credit note.
     * Admin or CLIENT_UPDATE permission holders can update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: CreditNote): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update visibility of credit notes'
            );
        }
    }

    /**
     * Checks if the actor can update lifecycle state of a credit note.
     * Admin or CLIENT_UPDATE permission holders can update lifecycle state.
     */
    protected _canUpdateLifecycleState(actor: Actor, _entity: CreditNote): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update lifecycle state of credit notes'
            );
        }
    }

    /**
     * Executes search for credit notes.
     * Uses the model's findAll method to retrieve paginated results.
     */
    protected async _executeSearch(
        params: z.infer<typeof CreditNoteQuerySchema>,
        _actor: Actor
    ): Promise<{ items: CreditNote[]; total: number }> {
        const { page, pageSize } = params;
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes count for credit notes.
     * Uses the model's count method to count credit notes based on provided criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof CreditNoteQuerySchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // =========================================================================
    // Business Methods - Credit Note Generation
    // =========================================================================

    /**
     * Generate credit note from refund
     *
     * Business Rules:
     * - Refund must exist
     * - Associated payment and invoice must exist
     * - Credit note amount equals refund amount
     *
     * @param actor - Current user context
     * @param refundId - Refund ID to generate credit note from
     * @param reason - Optional reason for credit note
     * @returns Service output with created credit note or null
     */
    public async generateFromRefund(
        actor: Actor,
        refundId: string,
        reason?: string
    ): Promise<ServiceOutput<CreditNote | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'generateFromRefund',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, {});

                const creditNote = await this.model.generateFromRefund(refundId, reason);

                return creditNote;
            }
        });
    }

    /**
     * Apply credit note to invoice
     *
     * Business Rules:
     * - Credit note must exist and not be applied
     * - Invoice must exist
     * - Credit note amount is applied to reduce invoice total
     *
     * @param actor - Current user context
     * @param creditNoteId - Credit note ID to apply
     * @returns Service output with application result
     */
    public async applyToInvoice(
        actor: Actor,
        creditNoteId: string
    ): Promise<ServiceOutput<{ success: boolean; appliedAmount?: number; error?: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'applyToInvoice',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as CreditNote);

                const result = await this.model.applyToInvoice(creditNoteId);

                return result;
            }
        });
    }

    /**
     * Calculate remaining balance of credit note
     *
     * Business Rules:
     * - Returns full amount if not yet applied
     * - Returns 0 if credit note doesn't exist
     *
     * @param actor - Current user context
     * @param creditNoteId - Credit note ID
     * @returns Service output with balance amount
     */
    public async calculateBalance(
        actor: Actor,
        creditNoteId: string
    ): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateBalance',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as CreditNote);

                const balance = await this.model.calculateBalance(creditNoteId);

                return balance;
            }
        });
    }

    // =========================================================================
    // Business Methods - Credit Note Queries
    // =========================================================================

    /**
     * Find credit notes by invoice
     *
     * @param actor - Current user context
     * @param invoiceId - Invoice ID
     * @returns Service output with credit notes for the invoice
     */
    public async findByInvoice(
        actor: Actor,
        invoiceId: string
    ): Promise<ServiceOutput<CreditNote[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByInvoice',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const creditNotes = await this.model.findByInvoice(invoiceId);

                return creditNotes;
            }
        });
    }

    /**
     * Get total credit notes amount for an invoice
     *
     * Calculates the sum of all credit note amounts for a specific invoice.
     *
     * @param actor - Current user context
     * @param invoiceId - Invoice ID
     * @returns Service output with total credit amount
     */
    public async getTotalCreditForInvoice(
        actor: Actor,
        invoiceId: string
    ): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTotalCreditForInvoice',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as CreditNote);

                const total = await this.model.getTotalCreditForInvoice(invoiceId);

                return total;
            }
        });
    }

    /**
     * Find credit notes issued within a date range
     *
     * @param actor - Current user context
     * @param startDate - Range start date
     * @param endDate - Range end date
     * @returns Service output with credit notes in date range
     */
    public async findByDateRange(
        actor: Actor,
        startDate: Date,
        endDate: Date
    ): Promise<ServiceOutput<CreditNote[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByDateRange',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const creditNotes = await this.model.findByDateRange(startDate, endDate);

                return creditNotes;
            }
        });
    }

    /**
     * Get credit notes summary for reporting
     *
     * Provides aggregated statistics about credit notes.
     *
     * @param actor - Current user context
     * @param startDate - Optional start date for filtering
     * @param endDate - Optional end date for filtering
     * @returns Service output with summary data
     */
    public async getCreditNotesSummary(
        actor: Actor,
        startDate?: Date,
        endDate?: Date
    ): Promise<ServiceOutput<{
        totalAmount: number;
        count: number;
        averageAmount: number;
    }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getCreditNotesSummary',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const summary = await this.model.getCreditNotesSummary(startDate, endDate);

                return summary;
            }
        });
    }

    // =========================================================================
    // Business Methods - Credit Note Validation
    // =========================================================================

    /**
     * Validate credit note amount against invoice
     *
     * Business Rules:
     * - Amount must be positive
     * - Amount cannot exceed invoice balance
     * - Invoice must exist
     *
     * @param actor - Current user context
     * @param invoiceId - Invoice ID to validate against
     * @param amount - Credit note amount
     * @returns Service output with validation result
     */
    public async validateCreditAmount(
        actor: Actor,
        invoiceId: string,
        amount: number
    ): Promise<ServiceOutput<{ valid: boolean; reason?: string; maxAllowed?: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'validateCreditAmount',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as CreditNote);

                const validation = await this.model.validateCreditAmount(invoiceId, amount);

                return validation;
            }
        });
    }

    /**
     * Create credit note with validation
     *
     * Business Rules:
     * - Validates amount against invoice balance
     * - Ensures invoice exists
     * - Validates currency matches invoice currency
     *
     * @param actor - Current user context
     * @param data - Credit note data
     * @returns Service output with creation result
     */
    public async createWithValidation(
        actor: Actor,
        data: {
            invoiceId: string;
            amount: number;
            currency: string;
            reason?: string;
        }
    ): Promise<ServiceOutput<{ success: boolean; creditNote?: CreditNote; error?: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createWithValidation',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, {});

                const result = await this.model.createWithValidation(data);

                return result;
            }
        });
    }

    // =========================================================================
    // Business Methods - Credit Note Actions
    // =========================================================================

    /**
     * Cancel/void a credit note
     *
     * Business Rules:
     * - Can only cancel unapplied credit notes
     * - Sets deletedAt timestamp
     * - Stores cancellation reason
     *
     * @param actor - Current user context
     * @param creditNoteId - Credit note ID to cancel
     * @param reason - Optional reason for cancellation
     * @returns Service output with canceled credit note or null
     */
    public async cancel(
        actor: Actor,
        creditNoteId: string,
        reason?: string
    ): Promise<ServiceOutput<CreditNote | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'cancel',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canSoftDelete(validatedActor, {} as CreditNote);

                const creditNote = await this.model.cancel(creditNoteId, reason);

                return creditNote;
            }
        });
    }
}
