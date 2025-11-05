import type { RefundModel } from '@repo/db';
import {
    CreateRefundSchema,
    type ListRelationsConfig,
    PermissionEnum,
    type Refund,
    RefundQuerySchema,
    RoleEnum,
    ServiceErrorCode,
    UpdateRefundSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing refunds. Implements business logic, permissions, and hooks for Refund entities.
 * Handles payment refunds with validation and business rules.
 * @extends BaseCrudService
 */
export class RefundService extends BaseCrudService<
    Refund,
    RefundModel,
    typeof CreateRefundSchema,
    typeof UpdateRefundSchema,
    typeof RefundQuerySchema
> {
    static readonly ENTITY_NAME = 'refund';
    protected readonly entityName = RefundService.ENTITY_NAME;
    public readonly model: RefundModel;

    public readonly createSchema = CreateRefundSchema;
    public readonly updateSchema = UpdateRefundSchema;
    public readonly searchSchema = RefundQuerySchema;

    /**
     * Initializes a new instance of the RefundService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional RefundModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: RefundModel) {
        super(ctx, RefundService.ENTITY_NAME);
        this.model = model ?? ({} as RefundModel);
    }

    /**
     * Returns default list relations (no relations for refunds)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a refund.
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
                'Permission denied: Only admins or users with CLIENT_UPDATE can create refunds'
            );
        }
    }

    /**
     * Checks if the actor can update a refund.
     * Admin or CLIENT_UPDATE permission holders can update.
     */
    protected _canUpdate(actor: Actor, _entity: Refund): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update refunds'
            );
        }
    }

    /**
     * Checks if the actor can soft delete a refund.
     * Admin or CLIENT_UPDATE permission holders can soft delete.
     */
    protected _canSoftDelete(actor: Actor, _entity: Refund): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete refunds'
            );
        }
    }

    /**
     * Checks if the actor can hard delete a refund.
     * Only ADMIN can hard delete.
     */
    protected _canHardDelete(actor: Actor, _entity: Refund): void {
        if (actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete refunds'
            );
        }
    }

    /**
     * Checks if the actor can view a refund.
     * Admin or CLIENT_UPDATE permission holders can view.
     */
    protected _canView(actor: Actor, _entity: Refund): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view refunds'
            );
        }
    }

    /**
     * Checks if the actor can list refunds.
     * Admin or CLIENT_UPDATE permission holders can list.
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list refunds'
            );
        }
    }

    /**
     * Checks if the actor can restore a refund.
     * Admin or CLIENT_UPDATE permission holders can restore.
     */
    protected _canRestore(actor: Actor, _entity: Refund): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore refunds'
            );
        }
    }

    /**
     * Checks if the actor can search refunds.
     * Admin or CLIENT_UPDATE permission holders can search.
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search refunds'
            );
        }
    }

    /**
     * Checks if the actor can count refunds.
     * Admin or CLIENT_UPDATE permission holders can count.
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count refunds'
            );
        }
    }

    /**
     * Checks if the actor can update visibility of a refund.
     * Admin or CLIENT_UPDATE permission holders can update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: Refund): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update visibility of refunds'
            );
        }
    }

    /**
     * Checks if the actor can update lifecycle state of a refund.
     * Admin or CLIENT_UPDATE permission holders can update lifecycle state.
     */
    protected _canUpdateLifecycleState(actor: Actor, _entity: Refund): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update lifecycle state of refunds'
            );
        }
    }

    /**
     * Executes search for refunds.
     * Uses the model's findAll method to retrieve paginated results.
     */
    protected async _executeSearch(
        params: z.infer<typeof RefundQuerySchema>,
        _actor: Actor
    ): Promise<{ items: Refund[]; total: number }> {
        const { page, pageSize } = params;
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes count for refunds.
     * Uses the model's count method to count refunds based on provided criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof RefundQuerySchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // =========================================================================
    // Business Methods - Refund Processing
    // =========================================================================

    /**
     * Process refund for a payment
     *
     * Business Rules:
     * - Payment must exist and be in APPROVED or AUTHORIZED status
     * - Refund amount must be positive and not exceed payment amount
     * - Cannot exceed remaining refundable amount
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID to refund
     * @param amount - Amount to refund
     * @param reason - Optional reason for refund
     * @returns Service output with created refund or null
     */
    public async processRefund(
        actor: Actor,
        paymentId: string,
        amount: number,
        reason?: string
    ): Promise<ServiceOutput<Refund | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'processRefund',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, {});

                const refund = await this.model.processRefund(paymentId, amount, reason);

                return refund;
            }
        });
    }

    /**
     * Find refunds by payment
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @returns Service output with refunds for the payment
     */
    public async findByPayment(
        actor: Actor,
        paymentId: string
    ): Promise<ServiceOutput<Refund[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByPayment',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const refunds = await this.model.findByPayment(paymentId);

                return refunds;
            }
        });
    }

    /**
     * Calculate refundable amount for payment
     *
     * Calculates the remaining amount that can be refunded for a payment.
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @returns Service output with refundable amount
     */
    public async calculateRefundable(
        actor: Actor,
        paymentId: string
    ): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateRefundable',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Refund);

                const amount = await this.model.calculateRefundable(paymentId);

                return amount;
            }
        });
    }

    /**
     * Get total refunded amount for payment
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @returns Service output with total refunded amount
     */
    public async getTotalRefundedForPayment(
        actor: Actor,
        paymentId: string
    ): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTotalRefundedForPayment',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Refund);

                const total = await this.model.getTotalRefundedForPayment(paymentId);

                return total;
            }
        });
    }

    // =========================================================================
    // Business Methods - Refund Validation
    // =========================================================================

    /**
     * Check if payment can be refunded
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @param amount - Optional specific amount to validate
     * @returns Service output with boolean indicating if refund is allowed
     */
    public async canRefund(
        actor: Actor,
        paymentId: string,
        amount?: number
    ): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'canRefund',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Refund);

                const canRefund = await this.model.canRefund(paymentId, amount);

                return canRefund;
            }
        });
    }

    /**
     * Validate refund amount
     *
     * Business Rules:
     * - Amount must be positive
     * - Amount must not exceed refundable amount
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @param amount - Amount to validate
     * @returns Service output with validation result
     */
    public async validateRefundAmount(
        actor: Actor,
        paymentId: string,
        amount: number
    ): Promise<ServiceOutput<{ valid: boolean; reason?: string; refundableAmount?: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'validateRefundAmount',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Refund);

                const validation = await this.model.validateRefundAmount(paymentId, amount);

                return validation;
            }
        });
    }

    /**
     * Check refund policy
     *
     * Validates if a refund is allowed according to business rules:
     * - Payment must be in refundable status
     * - Refund must be within allowed time period (30 days)
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @returns Service output with policy check result
     */
    public async checkRefundPolicy(
        actor: Actor,
        paymentId: string
    ): Promise<ServiceOutput<{ allowed: boolean; reason?: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'checkRefundPolicy',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Refund);

                const policy = await this.model.checkRefundPolicy(paymentId);

                return policy;
            }
        });
    }

    // =========================================================================
    // Business Methods - Refund Queries
    // =========================================================================

    /**
     * Get refund with payment data
     *
     * @param actor - Current user context
     * @param id - Refund ID
     * @returns Service output with refund including payment data
     */
    public async withPayment(
        actor: Actor,
        id: string
    ): Promise<ServiceOutput<(Refund & { payment: unknown }) | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'withPayment',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Refund);

                const refund = await this.model.withPayment(id);

                return refund;
            }
        });
    }

    /**
     * Find refunds within date range
     *
     * @param actor - Current user context
     * @param startDate - Start of date range
     * @param endDate - End of date range
     * @returns Service output with refunds in date range
     */
    public async findByDateRange(
        actor: Actor,
        startDate: Date,
        endDate: Date
    ): Promise<ServiceOutput<Refund[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByDateRange',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const refunds = await this.model.findByDateRange(startDate, endDate);

                return refunds;
            }
        });
    }

    /**
     * Get refund statistics for payment
     *
     * Returns aggregate statistics including:
     * - Total refunded amount
     * - Number of refunds
     * - Remaining refundable amount
     *
     * @param actor - Current user context
     * @param paymentId - Payment ID
     * @returns Service output with refund statistics
     */
    public async getRefundStats(
        actor: Actor,
        paymentId: string
    ): Promise<
        ServiceOutput<{
            totalRefunded: number;
            refundCount: number;
            remainingRefundable: number;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getRefundStats',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Refund);

                const stats = await this.model.getRefundStats(paymentId);

                return stats;
            }
        });
    }

    // =========================================================================
    // Business Methods - Refund Actions
    // =========================================================================

    /**
     * Reverse/cancel a refund
     *
     * Soft deletes a refund and adds reversal reason to metadata.
     * In a real implementation, this would also call the payment provider.
     *
     * @param actor - Current user context
     * @param id - Refund ID
     * @param reason - Optional reason for reversal
     * @returns Service output with reversed refund or null
     */
    public async reverseRefund(
        actor: Actor,
        id: string,
        reason?: string
    ): Promise<ServiceOutput<Refund | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'reverseRefund',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canUpdate(validatedActor, {} as Refund);

                const refund = await this.model.reverseRefund(id, reason);

                return refund;
            }
        });
    }
}
