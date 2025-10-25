import { describe, expect, it } from 'vitest';
import {
    InvoiceStatusEnum,
    PaymentMethodEnum,
    PaymentStatusEnum,
    PaymentTypeEnum
} from '../../enums/index.js';
import { CreditNoteSchema } from '../creditNote/creditNote.schema.js';
import { InvoiceSchema } from '../invoice/invoice.schema.js';
import { InvoiceLineSchema } from '../invoiceLine/invoiceLine.schema.js';
import { PaymentSchema } from '../payment/payment.schema.js';
import { PaymentMethodSchema } from '../paymentMethod/paymentMethod.schema.js';
import { RefundReasonEnum, RefundSchema, RefundStatusEnum } from '../refund/refund.schema.js';

describe('Billing System Integration Tests', () => {
    const clientId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const invoiceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d480';
    const paymentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d481';
    const paymentMethodId = 'f47ac10b-58cc-4372-a567-0e02b2c3d482';
    const creditNoteId = 'f47ac10b-58cc-4372-a567-0e02b2c3d483';
    const refundId = 'f47ac10b-58cc-4372-a567-0e02b2c3d484';
    const createdById = 'f47ac10b-58cc-4372-a567-0e02b2c3d485';

    describe('Complete Billing Flow', () => {
        it('should validate complete invoice creation with lines', () => {
            const invoice = {
                id: invoiceId,
                clientId,
                invoiceNumber: 'INV-2024-001',
                total: 100.0,
                subtotal: 85.0,
                taxes: 15.0,
                currency: 'USD',
                status: InvoiceStatusEnum.OPEN,
                issueDate: new Date('2024-01-15T00:00:00Z'),
                dueDate: new Date('2024-02-14T00:00:00Z'),
                createdAt: new Date('2024-01-15T00:00:00Z'),
                updatedAt: new Date('2024-01-15T00:00:00Z'),
                createdById,
                updatedById: createdById
            };

            const invoiceLine = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
                invoiceId,
                description: 'Web Development Services',
                quantity: 10,
                unitPrice: 8.5,
                total: 85.0,
                taxRate: 0.15,
                taxAmount: 12.75,
                createdAt: new Date('2024-01-15T00:00:00Z'),
                updatedAt: new Date('2024-01-15T00:00:00Z'),
                createdById,
                updatedById: createdById
            };

            expect(() => InvoiceSchema.parse(invoice)).not.toThrow();
            expect(() => InvoiceLineSchema.parse(invoiceLine)).not.toThrow();
        });

        it('should validate payment with method integration', () => {
            const paymentMethod = {
                id: paymentMethodId,
                clientId,
                type: PaymentMethodEnum.CREDIT_CARD,
                displayName: 'Visa ending in 1234',
                isDefault: true,
                isActive: true,
                createdAt: new Date('2024-01-15T00:00:00Z'),
                updatedAt: new Date('2024-01-15T00:00:00Z'),
                createdById,
                updatedById: createdById
            };

            const payment = {
                id: paymentId,
                userId: clientId,
                paymentPlanId: 'f47ac10b-58cc-4372-a567-0e02b2c3d499',
                amount: 100.0,
                currency: 'USD',
                status: PaymentStatusEnum.APPROVED,
                type: PaymentTypeEnum.ONE_TIME,
                paymentMethod: PaymentMethodEnum.CREDIT_CARD,
                mercadoPagoPaymentId: 'mp_payment_123',
                description: 'Payment for Invoice INV-2024-001',
                createdAt: new Date('2024-01-15T00:00:00Z'),
                updatedAt: new Date('2024-01-15T00:00:00Z'),
                createdById,
                updatedById: createdById
            };

            expect(() => PaymentMethodSchema.parse(paymentMethod)).not.toThrow();
            expect(() => PaymentSchema.parse(payment)).not.toThrow();
        });

        it('should validate credit note against invoice', () => {
            const creditNote = {
                id: creditNoteId,
                invoiceId,
                clientId,
                creditNoteNumber: 'CN-2024-001',
                amount: 25.0,
                currency: 'USD',
                reason: 'Billing error correction',
                description: 'Partial refund for overcharge',
                issueDate: new Date('2024-01-20T00:00:00Z'),
                isApplied: true,
                appliedAt: new Date('2024-01-20T00:00:00Z'),
                createdAt: new Date('2024-01-20T00:00:00Z'),
                updatedAt: new Date('2024-01-20T00:00:00Z'),
                createdById,
                updatedById: createdById
            };

            expect(() => CreditNoteSchema.parse(creditNote)).not.toThrow();
        });

        it('should validate refund against payment', () => {
            const refund = {
                id: refundId,
                paymentId,
                clientId,
                refundNumber: 'REF-2024-001',
                amount: 25.0,
                currency: 'USD',
                reason: RefundReasonEnum.CUSTOMER_REQUEST,
                description: 'Customer requested partial refund',
                status: RefundStatusEnum.COMPLETED,
                processedAt: new Date('2024-01-20T00:00:00Z'),
                processedById: createdById,
                providerRefundId: 'mp_refund_123',
                createdAt: new Date('2024-01-20T00:00:00Z'),
                updatedAt: new Date('2024-01-20T00:00:00Z'),
                createdById,
                updatedById: createdById
            };

            expect(() => RefundSchema.parse(refund)).not.toThrow();
        });
    });

    describe('Invoice Status Transitions', () => {
        const baseInvoice = {
            id: invoiceId,
            clientId,
            invoiceNumber: 'INV-2024-002',
            total: 100.0,
            subtotal: 85.0,
            taxes: 15.0,
            currency: 'USD',
            issueDate: new Date('2024-01-15T00:00:00Z'),
            dueDate: new Date('2024-02-14T00:00:00Z'),
            createdAt: new Date('2024-01-15T00:00:00Z'),
            updatedAt: new Date('2024-01-15T00:00:00Z'),
            createdById,
            updatedById: createdById
        };

        it('should validate open invoice', () => {
            const openInvoice = {
                ...baseInvoice,
                status: InvoiceStatusEnum.OPEN
            };
            expect(() => InvoiceSchema.parse(openInvoice)).not.toThrow();
        });

        it('should validate paid invoice', () => {
            const paidInvoice = {
                ...baseInvoice,
                status: InvoiceStatusEnum.PAID,
                paidAt: new Date('2024-01-17T00:00:00Z')
            };
            expect(() => InvoiceSchema.parse(paidInvoice)).not.toThrow();
        });

        it('should validate void invoice', () => {
            const voidInvoice = {
                ...baseInvoice,
                status: InvoiceStatusEnum.VOID,
                voidAt: new Date('2024-01-18T00:00:00Z'),
                voidReason: 'Client requested cancellation'
            };
            expect(() => InvoiceSchema.parse(voidInvoice)).not.toThrow();
        });
    });

    describe('Refund Status Transitions', () => {
        const baseRefund = {
            id: refundId,
            paymentId,
            clientId,
            refundNumber: 'REF-2024-002',
            amount: 50.0,
            currency: 'USD',
            reason: RefundReasonEnum.BILLING_ERROR,
            description: 'Refund for billing error',
            createdAt: new Date('2024-01-20T00:00:00Z'),
            updatedAt: new Date('2024-01-20T00:00:00Z'),
            createdById,
            updatedById: createdById
        };

        it('should validate pending refund', () => {
            const pendingRefund = {
                ...baseRefund,
                status: RefundStatusEnum.PENDING
            };
            expect(() => RefundSchema.parse(pendingRefund)).not.toThrow();
        });

        it('should validate processing refund', () => {
            const processingRefund = {
                ...baseRefund,
                status: RefundStatusEnum.PROCESSING,
                processedAt: new Date('2024-01-20T10:00:00Z'),
                processedById: createdById
            };
            expect(() => RefundSchema.parse(processingRefund)).not.toThrow();
        });

        it('should validate completed refund', () => {
            const completedRefund = {
                ...baseRefund,
                status: RefundStatusEnum.COMPLETED,
                processedAt: new Date('2024-01-20T10:00:00Z'),
                processedById: createdById,
                providerRefundId: 'mp_refund_456'
            };
            expect(() => RefundSchema.parse(completedRefund)).not.toThrow();
        });

        it('should validate failed refund', () => {
            const failedRefund = {
                ...baseRefund,
                status: RefundStatusEnum.FAILED,
                processedAt: new Date('2024-01-20T10:00:00Z'),
                processedById: createdById,
                failureReason: 'Insufficient funds in merchant account'
            };
            expect(() => RefundSchema.parse(failedRefund)).not.toThrow();
        });

        it('should validate cancelled refund', () => {
            const cancelledRefund = {
                ...baseRefund,
                status: RefundStatusEnum.CANCELLED,
                processedAt: new Date('2024-01-20T10:00:00Z'),
                processedById: createdById,
                failureReason: 'Cancelled by customer request'
            };
            expect(() => RefundSchema.parse(cancelledRefund)).not.toThrow();
        });
    });
});
