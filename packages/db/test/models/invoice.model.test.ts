import { InvoiceStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { InvoiceModel } from '../../src/models/invoice/invoice.model';

// Define the Invoice type for testing
interface Invoice {
    id: string;
    clientId: string;
    invoiceNumber: string;
    status: string;
    subtotalAmount: string;
    taxAmount: string;
    totalAmount: string;
    currency: string;
    exchangeRate?: string | null;
    baseCurrency: string;
    issuedAt: Date;
    dueAt?: Date | null;
    paidAt?: Date | null;
    voidedAt?: Date | null;
    billingAddress?: any;
    notes?: string | null;
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
const mockInvoice: Invoice = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clientId: '550e8400-e29b-41d4-a716-446655440002',
    invoiceNumber: 'INV-2024-000001',
    status: InvoiceStatusEnum.OPEN,
    subtotalAmount: '100.00',
    taxAmount: '10.00',
    totalAmount: '110.00',
    currency: 'USD',
    exchangeRate: '1.0000',
    baseCurrency: 'USD',
    issuedAt: new Date('2024-01-01T00:00:00Z'),
    dueAt: new Date('2024-01-31T23:59:59Z'),
    paidAt: null,
    voidedAt: null,
    billingAddress: null,
    notes: null,
    metadata: {
        subscriptionId: '550e8400-e29b-41d4-a716-446655440003',
        billingPeriodStart: '2024-01-01T00:00:00.000Z',
        billingPeriodEnd: '2024-01-31T23:59:59.000Z'
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: null,
    deletedById: null,
    adminInfo: null
};

const mockPaidInvoice: Invoice = {
    ...mockInvoice,
    id: '550e8400-e29b-41d4-a716-446655440004',
    status: InvoiceStatusEnum.PAID,
    paidAt: new Date('2024-01-15T10:30:00Z')
};

const mockOverdueInvoice: Invoice = {
    ...mockInvoice,
    id: '550e8400-e29b-41d4-a716-446655440005',
    dueAt: new Date('2023-12-31T23:59:59Z') // Past date
};

const mockSubscription = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    clientId: '550e8400-e29b-41d4-a716-446655440002',
    status: 'ACTIVE'
};

const mockInvoiceLines = [
    {
        id: '550e8400-e29b-41d4-a716-446655440010',
        invoiceId: '550e8400-e29b-41d4-a716-446655440001',
        description: 'Basic Plan',
        quantity: 1,
        unitPrice: '100.00',
        lineAmount: '100.00',
        taxAmount: '10.00',
        totalAmount: '110.00'
    }
];

const mockPayments = [
    {
        id: '550e8400-e29b-41d4-a716-446655440020',
        invoiceId: '550e8400-e29b-41d4-a716-446655440001',
        amount: '110.00',
        status: 'COMPLETED'
    }
];

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

describe('InvoiceModel', () => {
    let mockDb: any;
    let invoiceModel: InvoiceModel;

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
            orderBy: vi.fn().mockReturnThis(),
            offset: vi.fn().mockReturnThis()
        };

        vi.mocked(dbUtils.getDb).mockReturnValue(mockDb);
        invoiceModel = new InvoiceModel();
    });

    describe('generateFromSubscription', () => {
        it('should generate invoice from subscription successfully', async () => {
            // Mock subscription query
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockSubscription]);

            // Mock latest invoice query for number generation
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.orderBy.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            // Mock insert query
            mockDb.insert.mockReturnValueOnce(mockDb);
            mockDb.values.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockInvoice]);

            const result = await invoiceModel.generateFromSubscription(
                '550e8400-e29b-41d4-a716-446655440003',
                new Date('2024-01-01'),
                new Date('2024-01-31')
            );

            expect(result).toEqual(mockInvoice);
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it('should throw error if subscription not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            await expect(
                invoiceModel.generateFromSubscription(
                    'nonexistent-id',
                    new Date('2024-01-01'),
                    new Date('2024-01-31')
                )
            ).rejects.toThrow('SUBSCRIPTION_NOT_FOUND');
        });
    });

    describe('calculateTotals', () => {
        it('should calculate invoice totals from line items', async () => {
            const mockTotals = {
                subtotal: '100.00',
                tax: '10.00',
                total: '110.00'
            };

            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([mockTotals]);

            const result = await invoiceModel.calculateTotals(mockInvoice.id);

            expect(result).toEqual({
                subtotal: 100,
                tax: 10,
                total: 110
            });
        });

        it('should return null if no totals found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([]);

            const result = await invoiceModel.calculateTotals('nonexistent-id');

            expect(result).toBeNull();
        });
    });

    describe('markAsPaid', () => {
        it('should mark invoice as paid', async () => {
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockPaidInvoice]);

            const paidAt = new Date('2024-01-15T10:30:00Z');
            const result = await invoiceModel.markAsPaid(mockInvoice.id, paidAt);

            expect(result).toEqual(mockPaidInvoice);
            expect(mockDb.update).toHaveBeenCalled();
        });
    });

    describe('canMarkPaid', () => {
        it('should return true for open invoice', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ status: InvoiceStatusEnum.OPEN }]);

            const result = await invoiceModel.canMarkPaid(mockInvoice.id);

            expect(result).toBe(true);
        });

        it('should return false for paid invoice', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ status: InvoiceStatusEnum.PAID }]);

            const result = await invoiceModel.canMarkPaid(mockInvoice.id);

            expect(result).toBe(false);
        });

        it('should return false if invoice not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            const result = await invoiceModel.canMarkPaid('nonexistent-id');

            expect(result).toBe(false);
        });
    });

    describe('canVoid', () => {
        it('should return true for open invoice', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ status: InvoiceStatusEnum.OPEN }]);

            const result = await invoiceModel.canVoid(mockInvoice.id);

            expect(result).toBe(true);
        });

        it('should return false for paid invoice', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ status: InvoiceStatusEnum.PAID }]);

            const result = await invoiceModel.canVoid(mockInvoice.id);

            expect(result).toBe(false);
        });
    });

    describe('getPaymentStatus', () => {
        it('should return payment status with amounts', async () => {
            // Mock invoice query
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                { status: InvoiceStatusEnum.OPEN, totalAmount: '110.00' }
            ]);

            // Mock amount paid query
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ amount: '110.00' }]);

            const result = await invoiceModel.getPaymentStatus(mockInvoice.id);

            expect(result).toEqual({
                status: InvoiceStatusEnum.OPEN,
                amountPaid: 110,
                balance: 0
            });
        });
    });

    describe('findOverdue', () => {
        it('should find overdue invoices', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.orderBy.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockOverdueInvoice]);

            const result = await invoiceModel.findOverdue();

            expect(result).toEqual([mockOverdueInvoice]);
        });
    });

    describe('findByClient', () => {
        it('should find invoices by client', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.orderBy.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockInvoice]);

            const result = await invoiceModel.findByClient(mockInvoice.clientId);

            expect(result).toEqual([mockInvoice]);
        });
    });

    describe('withLines', () => {
        it('should return invoice with line items', async () => {
            // Mock invoice query
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockInvoice]);

            // Mock lines query
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce(mockInvoiceLines);

            const result = await invoiceModel.withLines(mockInvoice.id);

            expect(result).toEqual({
                ...mockInvoice,
                lines: mockInvoiceLines
            });
        });

        it('should return null if invoice not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            const result = await invoiceModel.withLines('nonexistent-id');

            expect(result).toBeNull();
        });
    });

    describe('withPayments', () => {
        it('should return invoice with payments', async () => {
            // Mock invoice query
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockInvoice]);

            // Mock payments query
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce(mockPayments);

            const result = await invoiceModel.withPayments(mockInvoice.id);

            expect(result).toEqual({
                ...mockInvoice,
                payments: mockPayments
            });
        });
    });

    describe('getTotalDue', () => {
        it('should return total amount due', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ totalAmount: '110.00' }]);

            const result = await invoiceModel.getTotalDue(mockInvoice.id);

            expect(result).toBe(110);
        });

        it('should return 0 if invoice not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            const result = await invoiceModel.getTotalDue('nonexistent-id');

            expect(result).toBe(0);
        });
    });

    describe('getAmountPaid', () => {
        it('should return amount paid', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ amount: '110.00' }]);

            const result = await invoiceModel.getAmountPaid(mockInvoice.id);

            expect(result).toBe(110);
        });

        it('should return 0 if no payments found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ amount: null }]);

            const result = await invoiceModel.getAmountPaid('nonexistent-id');

            expect(result).toBe(0);
        });
    });

    describe('getBalance', () => {
        it('should return remaining balance', async () => {
            // Mock getTotalDue
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ totalAmount: '110.00' }]);

            // Mock getAmountPaid
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ amount: '50.00' }]);

            const result = await invoiceModel.getBalance(mockInvoice.id);

            expect(result).toBe(60);
        });
    });
});
