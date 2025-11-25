import { ProfessionalServiceOrderModel } from '@repo/db';
import type { ListRelationsConfig, ServiceOrder, ServiceOrderStatusEnum } from '@repo/schemas';
import {
    CreateServiceOrderSchema,
    PermissionEnum,
    SearchServiceOrdersSchema,
    ServiceErrorCode,
    UpdateServiceOrderSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type {
    Actor,
    PaginatedListOutput,
    ServiceContext,
    ServiceOutput
} from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import {
    checkCanCount,
    checkCanCreate,
    checkCanDelete,
    checkCanHardDelete,
    checkCanList,
    checkCanPatch,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanView
} from './professionalServiceOrder.permissions.js';

/**
 * Professional Service Order Service
 *
 * Manages professional service orders including order placement, status management,
 * deliverables handling, and order lifecycle (start, complete, cancel, refund).
 *
 * @extends BaseCrudService
 */
export class ProfessionalServiceOrderService extends BaseCrudService<
    ServiceOrder,
    ProfessionalServiceOrderModel,
    typeof CreateServiceOrderSchema,
    typeof UpdateServiceOrderSchema,
    typeof SearchServiceOrdersSchema
> {
    static readonly ENTITY_NAME = 'professional-service-order';
    protected readonly entityName = ProfessionalServiceOrderService.ENTITY_NAME;

    public readonly model: ProfessionalServiceOrderModel;
    public readonly createSchema = CreateServiceOrderSchema;
    public readonly updateSchema = UpdateServiceOrderSchema;
    public readonly searchSchema = SearchServiceOrdersSchema;

    /**
     * Creates an instance of ProfessionalServiceOrderService
     *
     * @param ctx - Service context with request information
     * @param model - Optional model instance (for testing/DI)
     */
    constructor(ctx: ServiceContext, model?: ProfessionalServiceOrderModel) {
        super(ctx, ProfessionalServiceOrderService.ENTITY_NAME);
        this.model = model ?? new ProfessionalServiceOrderModel();
    }

    /**
     * Get default relations configuration for listing operations
     *
     * @returns Empty relations config (can be extended for specific needs)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // Permission Hooks
    // ============================================================================

    /**
     * Check if actor can create professional service orders
     */
    protected _canCreate(actor: Actor, data: unknown): void {
        checkCanCreate(actor, data);
    }

    /**
     * Check if actor can update professional service orders
     */
    protected _canUpdate(actor: Actor, data: unknown): void {
        checkCanUpdate(actor, data);
    }

    /**
     * Check if actor can patch (partial update) professional service orders
     */
    protected _canPatch(actor: Actor, data: unknown): void {
        checkCanPatch(actor, data);
    }

    /**
     * Check if actor can delete (soft delete) professional service orders
     */
    protected _canDelete(actor: Actor, data: unknown): void {
        checkCanDelete(actor, data);
    }

    /**
     * Check if actor can soft delete professional service orders
     */
    protected _canSoftDelete(actor: Actor, data: unknown): void {
        checkCanSoftDelete(actor, data);
    }

    /**
     * Check if actor can hard delete professional service orders
     */
    protected _canHardDelete(actor: Actor, data: unknown): void {
        checkCanHardDelete(actor, data);
    }

    /**
     * Check if actor can restore soft-deleted professional service orders
     */
    protected _canRestore(actor: Actor, data: unknown): void {
        checkCanRestore(actor, data);
    }

    /**
     * Check if actor can view professional service orders
     */
    protected _canView(actor: Actor, data: unknown): void {
        checkCanView(actor, data);
    }

    /**
     * Check if actor can list professional service orders
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can search professional service orders
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count professional service orders
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Check if actor can update visibility of professional service orders
     * Note: This service doesn't use visibility enum, but the hook is required by BaseCrudService
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: ServiceOrder,
        _newVisibility: unknown
    ): void {
        // ServiceOrder doesn't have visibility field, but we check UPDATE permission
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.PROFESSIONAL_SERVICE_ORDER_UPDATE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'You do not have permission to update professional service orders'
            );
        }
    }

    // ============================================================================
    // Search & Count Implementation
    // ============================================================================

    /**
     * Execute search operation for professional service orders
     *
     * @param params - Validated search parameters
     * @param _actor - The actor performing the search
     * @returns Search results
     */
    protected async _executeSearch(
        params: Record<string, unknown>,
        _actor: Actor
    ): Promise<PaginatedListOutput<ServiceOrder>> {
        // Convert params to model-compatible format
        const modelParams = {
            ...params,
            limit: params.pageSize as number | undefined,
            offset: params.page
                ? ((params.page as number) - 1) * (params.pageSize as number)
                : undefined
        };

        const results = await this.model.findAll(modelParams);
        const total = await this.model.count(params);

        return { items: results.items, total };
    }

    /**
     * Execute count operation for professional service orders
     *
     * @param params - Validated count parameters
     * @param _actor - The actor performing the count
     * @returns Count result
     */
    protected async _executeCount(
        params: Record<string, unknown>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // ============================================================================
    // Business Logic Methods
    // ============================================================================

    /**
     * Find all service orders for a specific client
     *
     * @param clientId - The client ID to filter by
     * @returns Service output with orders array
     */
    public async findByClient(clientId: string): Promise<ServiceOutput<ServiceOrder[]>> {
        // No need for complex validation, just execute the model method
        const results = await this.model.findByClient(clientId);
        return { data: results };
    }

    /**
     * Find all service orders for a specific service type
     *
     * @param serviceTypeId - The service type ID to filter by
     * @returns Service output with orders array
     */
    public async findByServiceType(serviceTypeId: string): Promise<ServiceOutput<ServiceOrder[]>> {
        const results = await this.model.findByServiceType(serviceTypeId);
        return { data: results };
    }

    /**
     * Find all service orders with a specific status
     *
     * @param status - The status to filter by
     * @returns Service output with orders array
     */
    public async findByStatus(
        status: ServiceOrderStatusEnum
    ): Promise<ServiceOutput<ServiceOrder[]>> {
        const results = await this.model.findByStatus(status);
        return { data: results };
    }

    /**
     * Start a service order (transition from PENDING to IN_PROGRESS)
     *
     * @param orderId - The order ID to start
     * @returns Service output with updated order
     */
    public async startOrder(orderId: string): Promise<ServiceOutput<ServiceOrder>> {
        const result = await this.model.startOrder(orderId);
        return { data: result };
    }

    /**
     * Complete a service order (transition to COMPLETED status)
     *
     * @param orderId - The order ID to complete
     * @param completedAt - Optional completion date (defaults to now)
     * @returns Service output with updated order
     */
    public async completeOrder(
        orderId: string,
        completedAt?: Date
    ): Promise<ServiceOutput<ServiceOrder>> {
        const result = await this.model.completeOrder(orderId, completedAt);
        return { data: result };
    }

    /**
     * Cancel a service order (transition to CANCELLED status)
     *
     * @param orderId - The order ID to cancel
     * @returns Service output with updated order
     */
    public async cancelOrder(orderId: string): Promise<ServiceOutput<ServiceOrder>> {
        const result = await this.model.cancelOrder(orderId);
        return { data: result };
    }

    /**
     * Refund a service order (transition to REFUNDED status)
     *
     * @param orderId - The order ID to refund
     * @returns Service output with updated order
     */
    public async refundOrder(orderId: string): Promise<ServiceOutput<ServiceOrder>> {
        const result = await this.model.refundOrder(orderId);
        return { data: result };
    }
}
