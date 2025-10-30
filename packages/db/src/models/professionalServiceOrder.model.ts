import type { ServiceOrder, ServiceOrderStatusEnum } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { professionalServiceOrders } from '../schemas/services/professionalServiceOrder.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Professional Service Order Model
 *
 * Manages orders for professional services placed by clients including
 * photography, copywriting, SEO, design, and other professional services.
 * Handles the complete order lifecycle from pending to completion/cancellation.
 *
 * @extends BaseModel<ServiceOrder>
 */
export class ProfessionalServiceOrderModel extends BaseModel<ServiceOrder> {
    protected table = professionalServiceOrders;
    protected entityName = 'professional-service-order';

    protected getTableName(): string {
        return 'professional_service_orders';
    }

    /**
     * Find all orders for a specific client
     *
     * @param clientId - The client ID to filter by
     * @returns Array of professional service orders
     *
     * @example
     * ```ts
     * const clientOrders = await model.findByClient('client-123');
     * ```
     */
    async findByClient(clientId: string): Promise<ServiceOrder[]> {
        try {
            const result = await this.findAll({ clientId });
            logQuery(this.entityName, 'findByClient', { clientId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByClient', { clientId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all orders for a specific service type
     *
     * @param serviceTypeId - The service type ID to filter by
     * @returns Array of professional service orders
     *
     * @example
     * ```ts
     * const photoOrders = await model.findByServiceType('service-type-123');
     * ```
     */
    async findByServiceType(serviceTypeId: string): Promise<ServiceOrder[]> {
        try {
            const result = await this.findAll({ serviceTypeId });
            logQuery(this.entityName, 'findByServiceType', { serviceTypeId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByServiceType', { serviceTypeId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all orders by status
     *
     * @param status - The order status to filter by
     * @returns Array of professional service orders
     *
     * @example
     * ```ts
     * const pendingOrders = await model.findByStatus(ServiceOrderStatusEnum.PENDING);
     * ```
     */
    async findByStatus(status: ServiceOrderStatusEnum): Promise<ServiceOrder[]> {
        try {
            const result = await this.findAll({ status });
            logQuery(this.entityName, 'findByStatus', { status }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByStatus', { status }, error as Error);
            throw error;
        }
    }

    /**
     * Start an order (change status to IN_PROGRESS)
     *
     * @param orderId - The order ID to start
     * @returns Updated order
     *
     * @example
     * ```ts
     * const started = await model.startOrder('order-123');
     * ```
     */
    async startOrder(orderId: string): Promise<ServiceOrder> {
        try {
            const result = await this.update({ id: orderId }, {
                status: 'IN_PROGRESS' as ServiceOrderStatusEnum
            } as Partial<ServiceOrder>);

            if (!result) {
                throw new Error(`Professional service order not found: ${orderId}`);
            }

            logQuery(this.entityName, 'startOrder', { orderId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'startOrder', { orderId }, error as Error);
            throw error;
        }
    }

    /**
     * Complete an order (change status to COMPLETED and set completedAt)
     *
     * @param orderId - The order ID to complete
     * @param completedAt - The completion timestamp (defaults to now)
     * @returns Updated order
     *
     * @example
     * ```ts
     * const completed = await model.completeOrder('order-123');
     * ```
     */
    async completeOrder(orderId: string, completedAt: Date = new Date()): Promise<ServiceOrder> {
        try {
            const result = await this.update({ id: orderId }, {
                status: 'COMPLETED' as ServiceOrderStatusEnum,
                completedAt
            } as Partial<ServiceOrder>);

            if (!result) {
                throw new Error(`Professional service order not found: ${orderId}`);
            }

            logQuery(this.entityName, 'completeOrder', { orderId, completedAt }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'completeOrder', { orderId, completedAt }, error as Error);
            throw error;
        }
    }

    /**
     * Cancel an order (change status to CANCELLED)
     *
     * @param orderId - The order ID to cancel
     * @returns Updated order
     *
     * @example
     * ```ts
     * const cancelled = await model.cancelOrder('order-123');
     * ```
     */
    async cancelOrder(orderId: string): Promise<ServiceOrder> {
        try {
            const result = await this.update({ id: orderId }, {
                status: 'CANCELLED' as ServiceOrderStatusEnum
            } as Partial<ServiceOrder>);

            if (!result) {
                throw new Error(`Professional service order not found: ${orderId}`);
            }

            logQuery(this.entityName, 'cancelOrder', { orderId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'cancelOrder', { orderId }, error as Error);
            throw error;
        }
    }

    /**
     * Refund an order (change status to REFUNDED)
     *
     * @param orderId - The order ID to refund
     * @returns Updated order
     *
     * @example
     * ```ts
     * const refunded = await model.refundOrder('order-123');
     * ```
     */
    async refundOrder(orderId: string): Promise<ServiceOrder> {
        try {
            const result = await this.update({ id: orderId }, {
                status: 'REFUNDED' as ServiceOrderStatusEnum
            } as Partial<ServiceOrder>);

            if (!result) {
                throw new Error(`Professional service order not found: ${orderId}`);
            }

            logQuery(this.entityName, 'refundOrder', { orderId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'refundOrder', { orderId }, error as Error);
            throw error;
        }
    }
}
