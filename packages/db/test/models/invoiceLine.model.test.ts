import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { InvoiceLineModel } from '../../src/models/invoice/invoiceLine.model';

// Define the InvoiceLine type for testing
interface InvoiceLine {
    id: string;
    invoiceId: string;
    pricingPlanId?: string | null;
    subscriptionItemId?: string | null;
    description: string;
    quantity: number;
    unitPrice: string;
    lineAmount: string;
    taxRate?: string | null;
    taxAmount: string;
    discountRate?: string | null;
    discountAmount: string;
    totalAmount: string;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
    createdById?: string | null;
    updatedById?: string | null;
    deletedAt?: Date | null;
    deletedById?: string | null;
    adminInfo?: any;
}

// Mock data
const mockInvoiceLine: InvoiceLine = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    invoiceId: '550e8400-e29b-41d4-a716-446655440001',
    pricingPlanId: null,
    subscriptionItemId: null,
    description: 'Basic Plan - Monthly',
    quantity: 1,
    unitPrice: '100.00',
    lineAmount: '100.00',
    taxRate: '0.1000',
    taxAmount: '10.00',
    discountRate: '0.0000',
    discountAmount: '0.00',
    totalAmount: '110.00',
    periodStart: new Date('2024-01-01T00:00:00Z'),
    periodEnd: new Date('2024-01-31T23:59:59Z'),
    metadata: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: null,
    deletedById: null,
    adminInfo: null
};

const mockInvoiceLineWithDiscount: InvoiceLine = {
    ...mockInvoiceLine,
    id: '550e8400-e29b-41d4-a716-446655440011',
    discountRate: '0.1000', // 10% discount
    lineAmount: '90.00',
    taxAmount: '9.00',
    totalAmount: '99.00'
};

const mockInvoice = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clientId: '550e8400-e29b-41d4-a716-446655440002',
    invoiceNumber: 'INV-2024-000001',
    status: 'open',
    totalAmount: '110.00'
};

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

describe('InvoiceLineModel', () => {
    let mockDb: any;
    let invoiceLineModel: InvoiceLineModel;

    beforeEach(() => {
        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis()
        };

        vi.mocked(dbUtils.getDb).mockReturnValue(mockDb);
        invoiceLineModel = new InvoiceLineModel();
    });

    describe('calculateLineTotal', () => {
        it('should calculate line total without discount', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    quantity: 1,
                    unitPrice: '100.00',
                    taxRate: '0.1000',
                    discountRate: '0.0000',
                    discountAmount: '0.00'
                }
            ]);

            const result = await invoiceLineModel.calculateLineTotal(mockInvoiceLine.id);

            expect(result).toEqual({
                lineAmount: 100,
                taxAmount: 10,
                totalAmount: 110
            });
        });

        it('should calculate line total with discount rate', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    quantity: 1,
                    unitPrice: '100.00',
                    taxRate: '0.1000',
                    discountRate: '0.1000', // 10% discount
                    discountAmount: '0.00'
                }
            ]);

            const result = await invoiceLineModel.calculateLineTotal(mockInvoiceLine.id);

            expect(result).toEqual({
                lineAmount: 90,
                taxAmount: 9,
                totalAmount: 99
            });
        });

        it('should calculate line total with fixed discount amount', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    quantity: 1,
                    unitPrice: '100.00',
                    taxRate: '0.1000',
                    discountRate: '0.0000',
                    discountAmount: '10.00' // $10 fixed discount
                }
            ]);

            const result = await invoiceLineModel.calculateLineTotal(mockInvoiceLine.id);

            expect(result).toEqual({
                lineAmount: 90,
                taxAmount: 9,
                totalAmount: 99
            });
        });

        it('should return null if line not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            const result = await invoiceLineModel.calculateLineTotal('nonexistent-id');

            expect(result).toBeNull();
        });
    });

    describe('applyDiscounts', () => {
        it('should apply discount rate', async () => {
            // Mock calculateLineTotal call
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    quantity: 1,
                    unitPrice: '100.00',
                    taxRate: '0.1000',
                    discountRate: '0.1000', // will be updated
                    discountAmount: '0.00'
                }
            ]);

            // Mock update call
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockInvoiceLineWithDiscount]);

            const result = await invoiceLineModel.applyDiscounts(mockInvoiceLine.id, 0.1);

            expect(result).toEqual(mockInvoiceLineWithDiscount);
            expect(mockDb.update).toHaveBeenCalled();
        });

        it('should apply fixed discount amount', async () => {
            // Mock calculateLineTotal call
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    quantity: 1,
                    unitPrice: '100.00',
                    taxRate: '0.1000',
                    discountRate: '0.0000',
                    discountAmount: '10.00' // will be updated
                }
            ]);

            // Mock update call
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockInvoiceLineWithDiscount]);

            const result = await invoiceLineModel.applyDiscounts(mockInvoiceLine.id, undefined, 10);

            expect(result).toEqual(mockInvoiceLineWithDiscount);
        });
    });

    describe('calculateTax', () => {
        it('should calculate and apply tax rate', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    quantity: 1,
                    unitPrice: '100.00',
                    discountRate: '0.0000',
                    discountAmount: '0.00'
                }
            ]);

            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockInvoiceLine]);

            const result = await invoiceLineModel.calculateTax(mockInvoiceLine.id, 0.1);

            expect(result).toEqual(mockInvoiceLine);
            expect(mockDb.update).toHaveBeenCalled();
        });
    });

    describe('findByInvoice', () => {
        it('should find line items by invoice', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockInvoiceLine]);

            const result = await invoiceLineModel.findByInvoice(mockInvoice.id);

            expect(result).toEqual([mockInvoiceLine]);
        });
    });

    describe('findBySubscriptionItem', () => {
        it('should find line items by subscription item', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockInvoiceLine]);

            const result = await invoiceLineModel.findBySubscriptionItem('subscription-item-id');

            expect(result).toEqual([mockInvoiceLine]);
        });
    });

    describe('updateQuantity', () => {
        it('should update quantity and recalculate totals', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    unitPrice: '100.00',
                    taxRate: '0.1000',
                    discountRate: '0.0000',
                    discountAmount: '0.00'
                }
            ]);

            const updatedLine = {
                ...mockInvoiceLine,
                quantity: 2,
                lineAmount: '200.00',
                taxAmount: '20.00',
                totalAmount: '220.00'
            };

            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([updatedLine]);

            const result = await invoiceLineModel.updateQuantity(mockInvoiceLine.id, 2);

            expect(result).toEqual(updatedLine);
        });

        it('should throw error for invalid quantity', async () => {
            await expect(invoiceLineModel.updateQuantity(mockInvoiceLine.id, 0)).rejects.toThrow(
                'INVALID_QUANTITY'
            );

            await expect(invoiceLineModel.updateQuantity(mockInvoiceLine.id, -1)).rejects.toThrow(
                'INVALID_QUANTITY'
            );
        });

        it('should return null if line not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            const result = await invoiceLineModel.updateQuantity('nonexistent-id', 2);

            expect(result).toBeNull();
        });
    });

    describe('createWithCalculations', () => {
        it('should create line with calculations', async () => {
            mockDb.insert.mockReturnValueOnce(mockDb);
            mockDb.values.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockInvoiceLine]);

            const result = await invoiceLineModel.createWithCalculations({
                invoiceId: mockInvoice.id,
                description: 'Basic Plan - Monthly',
                quantity: 1,
                unitPrice: 100,
                taxRate: 0.1
            });

            expect(result).toEqual(mockInvoiceLine);
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it('should create line with discount rate', async () => {
            mockDb.insert.mockReturnValueOnce(mockDb);
            mockDb.values.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockInvoiceLineWithDiscount]);

            const result = await invoiceLineModel.createWithCalculations({
                invoiceId: mockInvoice.id,
                description: 'Basic Plan - Monthly',
                quantity: 1,
                unitPrice: 100,
                taxRate: 0.1,
                discountRate: 0.1
            });

            expect(result).toEqual(mockInvoiceLineWithDiscount);
        });
    });

    describe('withInvoice', () => {
        it('should return line with invoice data', async () => {
            const joinResult = {
                invoice_lines: mockInvoiceLine,
                invoices: mockInvoice
            };

            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.innerJoin.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([joinResult]);

            const result = await invoiceLineModel.withInvoice(mockInvoiceLine.id);

            expect(result).toEqual({
                ...mockInvoiceLine,
                invoice: mockInvoice
            });
        });

        it('should return null if line not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.innerJoin.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            const result = await invoiceLineModel.withInvoice('nonexistent-id');

            expect(result).toBeNull();
        });
    });

    describe('bulkUpdateQuantities', () => {
        it('should update multiple line quantities', async () => {
            const updates = [
                { id: mockInvoiceLine.id, quantity: 2 },
                { id: mockInvoiceLineWithDiscount.id, quantity: 3 }
            ];

            // Mock first updateQuantity call
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    unitPrice: '100.00',
                    taxRate: '0.1000',
                    discountRate: '0.0000',
                    discountAmount: '0.00'
                }
            ]);
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([{ ...mockInvoiceLine, quantity: 2 }]);

            // Mock second updateQuantity call
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    unitPrice: '100.00',
                    taxRate: '0.1000',
                    discountRate: '0.1000',
                    discountAmount: '0.00'
                }
            ]);
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([{ ...mockInvoiceLineWithDiscount, quantity: 3 }]);

            const result = await invoiceLineModel.bulkUpdateQuantities(updates);

            expect(result).toHaveLength(2);
            expect(result[0].quantity).toBe(2);
            expect(result[1].quantity).toBe(3);
        });
    });
});
