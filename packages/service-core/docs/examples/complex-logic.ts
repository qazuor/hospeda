/**
 * Complex Business Logic Example - OrderService
 *
 * Demonstrates:
 * - Service composition (using multiple services)
 * - Transaction handling
 * - State machine (order status transitions)
 * - External API integration (payment processing)
 * - Complex calculations
 * - Error handling
 */

import { OrderModel } from '@repo/db';
import type { ListRelationsConfig } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Order } from '@repo/schemas/entities/order';
import {
    OrderCreateInputSchema,
    OrderSearchSchema,
    OrderUpdateInputSchema
} from '@repo/schemas/entities/order';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

// Mock services
class ProductService {
    async getById(_actor: Actor, id: string) {
        return { data: { id, name: 'Product', price: 100, stock: 10 } };
    }
}

class PaymentService {
    async processPayment(amount: number, _customerId: string) {
        return { success: true, paymentId: 'pay-123', amount };
    }
    async refund(_paymentId: string, amount: number) {
        return { success: true, refundId: 'ref-123', amount };
    }
}

class InventoryService {
    async reserve(_productId: string, _quantity: number) {
        return { success: true };
    }
    async release(_productId: string, _quantity: number) {
        return { success: true };
    }
}

class NotificationService {
    async sendOrderConfirmation(_order: Order) {}
    async sendCancellationNotice(_order: Order) {}
}

/**
 * Order status state machine:
 *
 * pending → confirmed → shipped → delivered
 *    ↓         ↓
 * cancelled cancelled
 */
type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [], // Terminal state
    cancelled: [] // Terminal state
};

export class OrderService extends BaseCrudService<
    Order,
    OrderModel,
    typeof OrderCreateInputSchema,
    typeof OrderUpdateInputSchema,
    typeof OrderSearchSchema
> {
    static readonly ENTITY_NAME = 'order';
    protected readonly entityName = OrderService.ENTITY_NAME;

    public readonly model: OrderModel;
    public readonly createSchema = OrderCreateInputSchema;
    public readonly updateSchema = OrderUpdateInputSchema;
    public readonly searchSchema = OrderSearchSchema;

    // Dependent services
    private productService: ProductService;
    private paymentService: PaymentService;
    private inventoryService: InventoryService;
    private notificationService: NotificationService;

    constructor(ctx: ServiceContext, model?: OrderModel) {
        super(ctx, OrderService.ENTITY_NAME);
        this.model = model ?? new OrderModel();

        this.productService = new ProductService();
        this.paymentService = new PaymentService();
        this.inventoryService = new InventoryService();
        this.notificationService = new NotificationService();
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // Permission hooks (simplified)
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (!actor?.id) throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
    }
    protected _canUpdate(actor: Actor, _entity: Order): void {
        if (!actor?.id) throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Auth required');
    }
    protected _canSoftDelete(actor: Actor, _entity: Order): void {
        if (!actor?.id || !actor.permissions?.includes(PermissionEnum.ORDER_DELETE))
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Insufficient permissions');
    }
    protected _canHardDelete(actor: Actor, _entity: Order): void {
        if (!actor?.id || !actor.permissions?.includes(PermissionEnum.ORDER_HARD_DELETE))
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Insufficient permissions');
    }
    protected _canRestore(actor: Actor, _entity: Order): void {
        if (!actor?.id || !actor.permissions?.includes(PermissionEnum.ORDER_RESTORE))
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Insufficient permissions');
    }
    protected _canView(_actor: Actor, _entity: Order): void {}
    protected _canList(_actor: Actor): void {}
    protected _canSearch(_actor: Actor): void {}
    protected _canCount(_actor: Actor): void {}

    protected async _executeSearch(
        params: Record<string, unknown>,
        _actor: Actor
    ): Promise<PaginatedListOutput<Order>> {
        const { page = 1, pageSize = 20, ...filters } = params;
        return this.model.findAll(filters, { page, pageSize });
    }

    protected async _executeCount(
        params: Record<string, unknown>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // ============================================================================
    // COMPLEX BUSINESS LOGIC
    // ============================================================================

    /**
     * Calculate order total with discounts and taxes
     *
     * Business rules:
     * - Base: quantity * unit price
     * - Discount: 10% if quantity >= 5
     * - Tax: 16% on subtotal
     * - Shipping: free if total > 1000, else 50
     */
    public async calculateTotal(
        actor: Actor,
        productId: string,
        quantity: number,
        discountCode?: string
    ): Promise<
        ServiceOutput<{
            basePrice: number;
            discount: number;
            subtotal: number;
            tax: number;
            shipping: number;
            total: number;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateTotal',
            input: { actor, productId, quantity, discountCode },
            schema: z.object({
                productId: z.string(),
                quantity: z.number().min(1),
                discountCode: z.string().optional()
            }),
            execute: async (data, validatedActor) => {
                // Get product
                const productResult = await this.productService.getById(
                    validatedActor,
                    data.productId
                );
                if (!productResult.data) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Product not found');
                }

                const product = productResult.data;
                const basePrice = product.price * data.quantity;

                // Calculate discount
                let discount = 0;
                if (data.quantity >= 5) {
                    discount = basePrice * 0.1; // 10% bulk discount
                }
                if (data.discountCode === 'SAVE20') {
                    discount += basePrice * 0.2; // Additional 20% with code
                }

                const subtotal = basePrice - discount;

                // Calculate tax (16%)
                const tax = subtotal * 0.16;

                // Calculate shipping
                const shipping = subtotal > 1000 ? 0 : 50;

                const total = subtotal + tax + shipping;

                return {
                    basePrice,
                    discount,
                    subtotal,
                    tax,
                    shipping,
                    total
                };
            }
        });
    }

    /**
     * Process payment and create order (atomic transaction)
     *
     * Steps:
     * 1. Validate product and stock
     * 2. Reserve inventory
     * 3. Process payment
     * 4. Create order
     * 5. Send confirmation
     *
     * All steps must succeed or entire operation rolls back
     */
    public async processPayment(actor: Actor, orderId: string): Promise<ServiceOutput<Order>> {
        return this.runWithLoggingAndValidation({
            methodName: 'processPayment',
            input: { actor, orderId },
            schema: z.object({ orderId: z.string() }),
            execute: async (data, validatedActor) => {
                // Use transaction for atomicity
                return await this.model.transaction(async (trx) => {
                    // 1. Get order
                    const order = await this.model.findById(data.orderId, trx);
                    if (!order) {
                        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Order not found');
                    }

                    // 2. Validate state
                    if (order.status !== 'pending') {
                        throw new ServiceError(
                            ServiceErrorCode.VALIDATION_ERROR,
                            'Order is not in pending state'
                        );
                    }

                    // 3. Process payment (external API)
                    const payment = await this.paymentService.processPayment(
                        order.total,
                        validatedActor.id
                    );

                    if (!payment.success) {
                        throw new ServiceError(
                            ServiceErrorCode.PAYMENT_FAILED,
                            'Payment processing failed'
                        );
                    }

                    // 4. Update order
                    const updated = await this.model.update(
                        { id: data.orderId },
                        {
                            status: 'confirmed',
                            paymentId: payment.paymentId,
                            confirmedAt: new Date()
                        },
                        trx
                    );

                    if (!updated) {
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Failed to update order'
                        );
                    }

                    // 5. Send confirmation
                    await this.notificationService.sendOrderConfirmation(updated);

                    return updated;
                });
            }
        });
    }

    /**
     * Cancel order with refund
     *
     * Business rules:
     * - Only pending/confirmed orders can be cancelled
     * - Shipped/delivered orders cannot be cancelled
     * - Refund is processed for confirmed orders
     * - Inventory is released
     */
    public async cancelOrder(
        actor: Actor,
        orderId: string,
        reason: string
    ): Promise<ServiceOutput<Order>> {
        return this.runWithLoggingAndValidation({
            methodName: 'cancelOrder',
            input: { actor, orderId, reason },
            schema: z.object({
                orderId: z.string(),
                reason: z.string().min(10)
            }),
            execute: async (data, validatedActor) => {
                return await this.model.transaction(async (trx) => {
                    // Get order
                    const order = await this.model.findById(data.orderId, trx);
                    if (!order) {
                        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Order not found');
                    }

                    // Check permission
                    this._canUpdate(validatedActor, order);

                    // Validate status transition
                    const canCancel =
                        STATUS_TRANSITIONS[order.status as OrderStatus]?.includes('cancelled');
                    if (!canCancel) {
                        throw new ServiceError(
                            ServiceErrorCode.VALIDATION_ERROR,
                            `Cannot cancel order in ${order.status} status`
                        );
                    }

                    // Process refund if payment was made
                    if (order.paymentId) {
                        const refund = await this.paymentService.refund(
                            order.paymentId,
                            order.total
                        );

                        if (!refund.success) {
                            throw new ServiceError(
                                ServiceErrorCode.INTERNAL_ERROR,
                                'Refund processing failed'
                            );
                        }

                        order.refundId = refund.refundId;
                    }

                    // Release inventory
                    await this.inventoryService.release(order.productId, order.quantity);

                    // Update order
                    const updated = await this.model.update(
                        { id: data.orderId },
                        {
                            status: 'cancelled',
                            cancelledAt: new Date(),
                            cancellationReason: data.reason,
                            refundId: order.refundId
                        },
                        trx
                    );

                    if (!updated) {
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Failed to cancel order'
                        );
                    }

                    // Notify customer
                    await this.notificationService.sendCancellationNotice(updated);

                    return updated;
                });
            }
        });
    }

    /**
     * Transition order through status states
     *
     * Enforces state machine rules
     */
    public async transitionStatus(
        actor: Actor,
        orderId: string,
        newStatus: OrderStatus
    ): Promise<ServiceOutput<Order>> {
        return this.runWithLoggingAndValidation({
            methodName: 'transitionStatus',
            input: { actor, orderId, newStatus },
            schema: z.object({
                orderId: z.string(),
                newStatus: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
            }),
            execute: async (data, validatedActor) => {
                // Get order
                const orderResult = await this.getById(validatedActor, data.orderId);
                if (!orderResult.data) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Order not found');
                }

                const order = orderResult.data;

                // Validate transition
                const allowedTransitions = STATUS_TRANSITIONS[order.status as OrderStatus] || [];
                if (!allowedTransitions.includes(data.newStatus)) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `Cannot transition from ${order.status} to ${data.newStatus}`
                    );
                }

                // Update status
                const updateResult = await this.update(validatedActor, data.orderId, {
                    status: data.newStatus,
                    ...(data.newStatus === 'shipped' && { shippedAt: new Date() }),
                    ...(data.newStatus === 'delivered' && { deliveredAt: new Date() })
                });

                if (!updateResult.data) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update order status');
                }

                return updateResult.data;
            }
        });
    }
}
