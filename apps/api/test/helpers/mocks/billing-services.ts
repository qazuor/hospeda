/**
 * Mock implementations for billing-related services.
 *
 * Provides happy-path mock classes for ClientService, ProductService,
 * PricingPlanService, PricingTierService, SubscriptionService, PurchaseService,
 * SubscriptionItemService, ClientAccessRightService, PaymentService,
 * PaymentMethodService, InvoiceService, InvoiceLineService, RefundService,
 * and CreditNoteService used in unit tests.
 *
 * @module test/helpers/mocks/billing-services
 */

/** Non-existent UUID used to trigger 404 responses in tests. */
const NOT_FOUND_UUID = '87654321-4321-4321-8765-876543218765';

/**
 * Mock ClientService - returns predictable happy-path data.
 */
export class ClientService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'client_mock_id',
                name: String((body as Record<string, unknown>).name || 'Client Mock'),
                billingEmail: String(
                    (body as Record<string, unknown>).billingEmail || 'billing@mock.com'
                ),
                userId: (body as Record<string, unknown>).userId || null,
                status: (body as Record<string, unknown>).status || 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, name: 'Test Client', billingEmail: 'test@example.com' } };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return { data: { id, name: (body as Record<string, unknown>).name || 'Updated Client' } };
    }

    async softDelete(_actor: unknown, id: string) {
        return { data: { id, deletedAt: new Date().toISOString() } };
    }
}

/**
 * Mock ClientAccessRightService - returns predictable happy-path data.
 */
export class ClientAccessRightService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'client_access_right_mock_id',
                clientId: String((body as Record<string, unknown>).clientId),
                subscriptionItemId: String((body as Record<string, unknown>).subscriptionItemId),
                feature: String((body as Record<string, unknown>).feature),
                scope: String((body as Record<string, unknown>).scope),
                scopeId: (body as Record<string, unknown>).scopeId || null,
                scopeType: (body as Record<string, unknown>).scopeType || null,
                validFrom: (body as Record<string, unknown>).validFrom || null,
                validTo: (body as Record<string, unknown>).validTo || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, feature: 'test-feature', scope: 'full' } };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return { data: { id, feature: (body as Record<string, unknown>).feature } };
    }

    async softDelete(_actor: unknown, id: string) {
        return { data: { id, deletedAt: new Date().toISOString() } };
    }
}

/**
 * Mock ProductService - returns predictable happy-path data.
 */
export class ProductService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'product_mock_id',
                name: String((body as Record<string, unknown>).name || 'Product Mock'),
                type: String((body as Record<string, unknown>).type || 'recurring'),
                description: (body as Record<string, unknown>).description || null,
                metadata: (body as Record<string, unknown>).metadata || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, name: 'Test Product', type: 'recurring' } };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return { data: { id, name: (body as Record<string, unknown>).name } };
    }

    async softDelete(_actor: unknown, id: string) {
        return { data: { id, deletedAt: new Date().toISOString() } };
    }
}

/**
 * Mock PricingPlanService - returns predictable happy-path data.
 */
export class PricingPlanService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'pricing_plan_mock_id',
                productId: String((body as Record<string, unknown>).productId),
                billingScheme: String(
                    (body as Record<string, unknown>).billingScheme || 'per_unit'
                ),
                interval: (body as Record<string, unknown>).interval || null,
                amount: Number((body as Record<string, unknown>).amount || 0),
                currency: String((body as Record<string, unknown>).currency || 'USD'),
                metadata: (body as Record<string, unknown>).metadata || null,
                lifecycleState: (body as Record<string, unknown>).lifecycleState || 'draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, billingScheme: 'per_unit', currency: 'USD' } };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return { data: { id, amount: (body as Record<string, unknown>).amount } };
    }

    async softDelete(_actor: unknown, id: string) {
        return { data: { id, deletedAt: new Date().toISOString() } };
    }
}

/**
 * Mock PricingTierService - returns predictable happy-path data.
 */
export class PricingTierService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'pricing_tier_mock_id',
                pricingPlanId: String((body as Record<string, unknown>).pricingPlanId),
                minQuantity: Number((body as Record<string, unknown>).minQuantity),
                maxQuantity:
                    (body as Record<string, unknown>).maxQuantity === null
                        ? null
                        : Number((body as Record<string, unknown>).maxQuantity),
                unitPriceMinor: Number((body as Record<string, unknown>).unitPriceMinor),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, minQuantity: 1, maxQuantity: 10, unitPriceMinor: 1000 } };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: { id, unitPriceMinor: (body as Record<string, unknown>).unitPriceMinor }
        };
    }

    async softDelete(_actor: unknown, id: string) {
        return { data: { id, deletedAt: new Date().toISOString() } };
    }
}

/**
 * Mock SubscriptionService - returns predictable happy-path data.
 */
export class SubscriptionService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'subscription_mock_id',
                clientId: String((body as Record<string, unknown>).clientId),
                pricingPlanId: String((body as Record<string, unknown>).pricingPlanId),
                status: String((body as Record<string, unknown>).status || 'active'),
                currentPeriodStart:
                    (body as Record<string, unknown>).currentPeriodStart ||
                    new Date().toISOString(),
                currentPeriodEnd: (body as Record<string, unknown>).currentPeriodEnd || null,
                canceledAt: (body as Record<string, unknown>).canceledAt || null,
                quantity: Number((body as Record<string, unknown>).quantity || 1),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, status: 'active', quantity: 1 } };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return { data: { id, status: (body as Record<string, unknown>).status } };
    }

    async softDelete(_actor: unknown, id: string) {
        return { data: { id, deletedAt: new Date().toISOString() } };
    }
}

/**
 * Mock PurchaseService - returns predictable happy-path data.
 */
export class PurchaseService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'purchase_mock_id',
                clientId: String((body as Record<string, unknown>).clientId),
                pricingPlanId: String((body as Record<string, unknown>).pricingPlanId),
                amount: Number((body as Record<string, unknown>).amount),
                currency: String((body as Record<string, unknown>).currency),
                status: String((body as Record<string, unknown>).status || 'pending'),
                quantity: Number((body as Record<string, unknown>).quantity || 1),
                paymentId: (body as Record<string, unknown>).paymentId || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, amount: 99.99, currency: 'USD', status: 'completed' } };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return { data: { id, status: (body as Record<string, unknown>).status } };
    }

    async softDelete(_actor: unknown, id: string) {
        return { data: { id, deletedAt: new Date().toISOString() } };
    }
}

/**
 * Mock SubscriptionItemService - returns predictable happy-path data.
 */
export class SubscriptionItemService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'subscription_item_mock_id',
                sourceId: String((body as Record<string, unknown>).sourceId),
                sourceType: String((body as Record<string, unknown>).sourceType),
                linkedEntityId: String((body as Record<string, unknown>).linkedEntityId),
                entityType: String((body as Record<string, unknown>).entityType),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, sourceType: 'subscription', entityType: 'product' } };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return { data: { id, entityType: (body as Record<string, unknown>).entityType } };
    }

    async softDelete(_actor: unknown, id: string) {
        return { data: { id, deletedAt: new Date().toISOString() } };
    }
}

/**
 * Mock PaymentService - returns predictable happy-path data.
 */
export class PaymentService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'payment_mock_id',
                userId: String(b.userId),
                paymentPlanId: b.paymentPlanId || null,
                invoiceId: b.invoiceId || null,
                type: String(b.type || 'SUBSCRIPTION'),
                status: String(b.status || 'PENDING'),
                paymentMethod: b.paymentMethod || null,
                amount: Number(b.amount),
                currency: String(b.currency || 'USD'),
                description: b.description || null,
                metadata: b.metadata || null,
                mercadoPagoPaymentId: b.mercadoPagoPaymentId || null,
                mercadoPagoPreferenceId: b.mercadoPagoPreferenceId || null,
                externalReference: b.externalReference || null,
                processedAt: b.processedAt || null,
                expiresAt: b.expiresAt || null,
                failureReason: b.failureReason || null,
                mercadoPagoResponse: b.mercadoPagoResponse || null,
                lifecycleState: b.lifecycleState || 'ACTIVE',
                isActive: b.isActive !== undefined ? b.isActive : true,
                isDeleted: b.isDeleted !== undefined ? b.isDeleted : false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: {
                items: [],
                pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
            }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                userId: 'user_mock_id',
                amount: 100,
                currency: 'USD',
                status: 'COMPLETED',
                type: 'SUBSCRIPTION',
                paymentMethod: 'CREDIT_CARD',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                status: (params.data as Record<string, unknown>).status || 'COMPLETED',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: {
                id: params.id,
                deletedAt: new Date().toISOString(),
                isDeleted: true
            }
        };
    }
}

/**
 * Mock PaymentMethodService - returns predictable happy-path data.
 */
export class PaymentMethodService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'payment_method_mock_id',
                userId: String(b.userId),
                type: String(b.type || 'CREDIT_CARD'),
                provider: b.provider || null,
                isDefault: b.isDefault !== undefined ? b.isDefault : false,
                cardBrand: b.cardBrand || null,
                cardLastFour: b.cardLastFour || null,
                cardExpiryMonth: b.cardExpiryMonth || null,
                cardExpiryYear: b.cardExpiryYear || null,
                cardHolderName: b.cardHolderName || null,
                mercadoPagoCardId: b.mercadoPagoCardId || null,
                mercadoPagoCustomerId: b.mercadoPagoCustomerId || null,
                externalReference: b.externalReference || null,
                metadata: b.metadata || null,
                lifecycleState: b.lifecycleState || 'ACTIVE',
                isActive: b.isActive !== undefined ? b.isActive : true,
                isDeleted: b.isDeleted !== undefined ? b.isDeleted : false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: {
                items: [],
                pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
            }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                userId: 'user_mock_id',
                type: 'CREDIT_CARD',
                provider: 'MERCADO_PAGO',
                isDefault: true,
                cardBrand: 'VISA',
                cardLastFour: '4242',
                cardExpiryMonth: 12,
                cardExpiryYear: 2025,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                isDefault:
                    (params.data as Record<string, unknown>).isDefault !== undefined
                        ? (params.data as Record<string, unknown>).isDefault
                        : false,
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock InvoiceService - returns predictable happy-path data.
 */
export class InvoiceService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'invoice_mock_id',
                clientId: String(b.clientId),
                subscriptionId: b.subscriptionId || null,
                invoiceNumber: String(b.invoiceNumber || 'INV-001'),
                status: String(b.status || 'DRAFT'),
                issueDate: b.issueDate || new Date().toISOString(),
                dueDate: b.dueDate || null,
                paidDate: b.paidDate || null,
                subtotal: Number(b.subtotal || 0),
                taxAmount: Number(b.taxAmount || 0),
                totalAmount: Number(b.totalAmount || 0),
                currency: String(b.currency || 'USD'),
                notes: b.notes || null,
                metadata: b.metadata || null,
                lifecycleState: b.lifecycleState || 'ACTIVE',
                isActive: b.isActive !== undefined ? b.isActive : true,
                isDeleted: b.isDeleted !== undefined ? b.isDeleted : false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: {
                items: [],
                pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
            }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                clientId: 'client_mock_id',
                invoiceNumber: 'INV-001',
                status: 'PAID',
                issueDate: '2024-01-01T00:00:00.000Z',
                totalAmount: 100,
                currency: 'USD',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                status: (params.data as Record<string, unknown>).status || 'PAID',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock InvoiceLineService - returns predictable happy-path data.
 */
export class InvoiceLineService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'invoice_line_mock_id',
                invoiceId: String(b.invoiceId),
                description: String(b.description),
                quantity: Number(b.quantity || 1),
                unitPrice: Number(b.unitPrice || 0),
                totalAmount: Number(b.totalAmount || 0),
                taxAmount: b.taxAmount || null,
                discountAmount: b.discountAmount || null,
                productId: b.productId || null,
                metadata: b.metadata || null,
                lifecycleState: b.lifecycleState || 'ACTIVE',
                isActive: b.isActive !== undefined ? b.isActive : true,
                isDeleted: b.isDeleted !== undefined ? b.isDeleted : false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: {
                items: [],
                pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
            }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                invoiceId: 'invoice_mock_id',
                description: 'Test invoice line',
                quantity: 1,
                unitPrice: 100,
                totalAmount: 100,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                quantity: (params.data as Record<string, unknown>).quantity || 1,
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock RefundService - returns predictable happy-path data.
 */
export class RefundService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'refund_mock_id',
                paymentId: String(b.paymentId),
                clientId: String(b.clientId),
                refundNumber: String(b.refundNumber || 'REF-001'),
                amount: Number(b.amount || 0),
                currency: String(b.currency || 'USD'),
                reason: String(b.reason || 'CUSTOMER_REQUEST'),
                status: String(b.status || 'PENDING'),
                description: b.description || null,
                processedAt: b.processedAt || null,
                processedById: b.processedById || null,
                providerRefundId: b.providerRefundId || null,
                failureReason: b.failureReason || null,
                lifecycleState: b.lifecycleState || 'ACTIVE',
                isActive: b.isActive !== undefined ? b.isActive : true,
                isDeleted: b.isDeleted !== undefined ? b.isDeleted : false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: {
                items: [],
                pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
            }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                paymentId: 'payment_mock_id',
                clientId: 'client_mock_id',
                refundNumber: 'REF-001',
                amount: 50,
                currency: 'USD',
                reason: 'CUSTOMER_REQUEST',
                status: 'COMPLETED',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                status: (params.data as Record<string, unknown>).status || 'COMPLETED',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock CreditNoteService - returns predictable happy-path data.
 */
export class CreditNoteService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'credit_note_mock_id',
                invoiceId: String(b.invoiceId),
                clientId: String(b.clientId),
                creditNoteNumber: String(b.creditNoteNumber || 'CN-001'),
                amount: Number(b.amount || 0),
                currency: String(b.currency || 'USD'),
                reason: String(b.reason || 'REFUND'),
                status: String(b.status || 'DRAFT'),
                issueDate: b.issueDate || new Date().toISOString(),
                notes: b.notes || null,
                metadata: b.metadata || null,
                lifecycleState: b.lifecycleState || 'ACTIVE',
                isActive: b.isActive !== undefined ? b.isActive : true,
                isDeleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: {
                items: [],
                pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
            }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                invoiceId: 'invoice_mock_id',
                clientId: 'client_mock_id',
                creditNoteNumber: 'CN-001',
                amount: 50,
                currency: 'USD',
                reason: 'REFUND',
                status: 'ISSUED',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                status: (params.data as Record<string, unknown>).status || 'ISSUED',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}
