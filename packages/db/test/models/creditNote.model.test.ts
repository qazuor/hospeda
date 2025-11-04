import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditNoteModel } from '../../src/models/invoice/creditNote.model';

// Mock the database client
vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

// Mock logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('CreditNoteModel', () => {
    let model: CreditNoteModel;
    let mockDb: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new CreditNoteModel();

        // Setup mock database with chainable methods
        mockDb = {
            query: {
                refunds: {
                    findFirst: vi.fn(),
                    findMany: vi.fn()
                },
                payments: {
                    findFirst: vi.fn()
                },
                invoices: {
                    findFirst: vi.fn()
                },
                creditNotes: {
                    findFirst: vi.fn(),
                    findMany: vi.fn()
                }
            },
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            transaction: vi.fn()
        };

        const clientModule = await import('../../src/client');
        vi.mocked(clientModule.getDb).mockReturnValue(mockDb);
    });

    describe('Constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(CreditNoteModel);
        });

        it('should have correct table name', () => {
            const tableName = (model as any).getTableName();
            expect(tableName).toBe('credit_notes');
        });
    });

    describe('generateFromRefund', () => {
        it('should generate credit note from valid refund', async () => {
            const mockRefund = {
                id: 'refund-1',
                paymentId: 'payment-1',
                amountMinor: 10000, // $100.00
                reason: 'Customer request'
            };

            const mockPayment = {
                id: 'payment-1',
                invoiceId: 'invoice-1',
                currency: 'USD'
            };

            const mockInvoice = {
                id: 'invoice-1',
                totalAmount: '200.00'
            };

            const mockCreditNote = {
                id: 'cn-1',
                invoiceId: 'invoice-1',
                amount: '100',
                currency: 'USD',
                reason: 'Credit note generated from refund refund-1'
            };

            mockDb.query.refunds.findFirst.mockResolvedValue(mockRefund);
            mockDb.query.payments.findFirst.mockResolvedValue(mockPayment);
            mockDb.query.invoices.findFirst.mockResolvedValue(mockInvoice);

            // Configure insert chain
            mockDb.insert.mockReturnValueOnce(mockDb);
            mockDb.values.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockCreditNote]);

            const result = await model.generateFromRefund('refund-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('cn-1');
            expect(result?.amount).toBe('100');
            expect(mockDb.query.refunds.findFirst).toHaveBeenCalled();
            expect(mockDb.query.payments.findFirst).toHaveBeenCalled();
            expect(mockDb.query.invoices.findFirst).toHaveBeenCalled();
        });

        it('should return null if refund not found', async () => {
            mockDb.query.refunds.findFirst.mockResolvedValue(null);

            const result = await model.generateFromRefund('non-existent');

            expect(result).toBeNull();
        });

        it('should return null if payment not found', async () => {
            const mockRefund = { id: 'refund-1', paymentId: 'payment-1', amountMinor: 10000 };
            mockDb.query.refunds.findFirst.mockResolvedValue(mockRefund);
            mockDb.query.payments.findFirst.mockResolvedValue(null);

            const result = await model.generateFromRefund('refund-1');

            expect(result).toBeNull();
        });

        it('should return null if invoice not found', async () => {
            const mockRefund = { id: 'refund-1', paymentId: 'payment-1', amountMinor: 10000 };
            const mockPayment = { id: 'payment-1', invoiceId: 'invoice-1', currency: 'USD' };

            mockDb.query.refunds.findFirst.mockResolvedValue(mockRefund);
            mockDb.query.payments.findFirst.mockResolvedValue(mockPayment);
            mockDb.query.invoices.findFirst.mockResolvedValue(null);

            const result = await model.generateFromRefund('refund-1');

            expect(result).toBeNull();
        });

        it('should use custom reason if provided', async () => {
            const mockRefund = {
                id: 'refund-1',
                paymentId: 'payment-1',
                amountMinor: 5000
            };
            const mockPayment = { id: 'payment-1', invoiceId: 'invoice-1', currency: 'USD' };
            const mockInvoice = { id: 'invoice-1' };
            const mockCreditNote = {
                id: 'cn-1',
                reason: 'Custom reason'
            };

            mockDb.query.refunds.findFirst.mockResolvedValue(mockRefund);
            mockDb.query.payments.findFirst.mockResolvedValue(mockPayment);
            mockDb.query.invoices.findFirst.mockResolvedValue(mockInvoice);

            // Configure insert chain
            mockDb.insert.mockReturnValueOnce(mockDb);
            mockDb.values.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockCreditNote]);

            const result = await model.generateFromRefund('refund-1', 'Custom reason');

            expect(result).toBeDefined();
            expect(result?.reason).toBe('Custom reason');
        });

        it('should throw error on database failure', async () => {
            mockDb.query.refunds.findFirst.mockRejectedValue(new Error('DB Error'));

            await expect(model.generateFromRefund('refund-1')).rejects.toThrow(
                'Failed to generate credit note from refund'
            );
        });
    });

    describe('applyToInvoice', () => {
        it('should apply credit note to invoice successfully', async () => {
            const mockCreditNote = {
                id: 'cn-1',
                invoiceId: 'invoice-1',
                amount: '50.00'
            };
            const mockInvoice = {
                id: 'invoice-1',
                totalAmount: '200.00'
            };

            mockDb.query.creditNotes.findFirst.mockResolvedValue(mockCreditNote);
            mockDb.query.invoices.findFirst.mockResolvedValue(mockInvoice);

            // Configure update chain
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([]);

            const result = await model.applyToInvoice('cn-1');

            expect(result.success).toBe(true);
            expect(result.appliedAmount).toBe(50);
        });

        it('should return error if credit note not found', async () => {
            mockDb.query.creditNotes.findFirst.mockResolvedValue(null);

            const result = await model.applyToInvoice('non-existent');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Credit note not found');
        });

        it('should return error if invoice not found', async () => {
            const mockCreditNote = { id: 'cn-1', invoiceId: 'invoice-1', amount: '50.00' };
            mockDb.query.creditNotes.findFirst.mockResolvedValue(mockCreditNote);
            mockDb.query.invoices.findFirst.mockResolvedValue(null);

            const result = await model.applyToInvoice('cn-1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Associated invoice not found');
        });

        it('should not allow negative invoice amounts', async () => {
            const mockCreditNote = { id: 'cn-1', invoiceId: 'invoice-1', amount: '300.00' };
            const mockInvoice = { id: 'invoice-1', totalAmount: '200.00' };

            mockDb.query.creditNotes.findFirst.mockResolvedValue(mockCreditNote);
            mockDb.query.invoices.findFirst.mockResolvedValue(mockInvoice);

            // Configure update chain
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([]);

            const result = await model.applyToInvoice('cn-1');

            expect(result.success).toBe(true);
            expect(result.appliedAmount).toBe(200); // Only apply what's available
        });

        it('should handle database errors gracefully', async () => {
            mockDb.query.creditNotes.findFirst.mockRejectedValue(new Error('DB Error'));

            const result = await model.applyToInvoice('cn-1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to apply credit note');
        });
    });

    describe('calculateBalance', () => {
        it('should calculate balance for valid credit note', async () => {
            const mockCreditNote = { id: 'cn-1', amount: '150.00' };
            mockDb.query.creditNotes.findFirst.mockResolvedValue(mockCreditNote);

            const balance = await model.calculateBalance('cn-1');

            expect(balance).toBe(150);
        });

        it('should return 0 if credit note not found', async () => {
            mockDb.query.creditNotes.findFirst.mockResolvedValue(null);

            const balance = await model.calculateBalance('non-existent');

            expect(balance).toBe(0);
        });

        it('should return 0 on database error', async () => {
            mockDb.query.creditNotes.findFirst.mockRejectedValue(new Error('DB Error'));

            const balance = await model.calculateBalance('cn-1');

            expect(balance).toBe(0);
        });
    });

    describe('findByInvoice', () => {
        it('should find all credit notes for an invoice', async () => {
            const mockCreditNotes = [
                { id: 'cn-1', invoiceId: 'invoice-1', amount: '50' },
                { id: 'cn-2', invoiceId: 'invoice-1', amount: '30' }
            ];

            mockDb.query.creditNotes.findMany.mockResolvedValue(mockCreditNotes);

            const result = await model.findByInvoice('invoice-1');

            expect(result).toHaveLength(2);
            expect(result[0]?.id).toBe('cn-1');
            expect(result[1]?.id).toBe('cn-2');
        });

        it('should return empty array if no credit notes found', async () => {
            mockDb.query.creditNotes.findMany.mockResolvedValue([]);

            const result = await model.findByInvoice('invoice-1');

            expect(result).toHaveLength(0);
        });
    });

    describe('getTotalCreditForInvoice', () => {
        it('should calculate total credit for invoice', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ totalCredit: '150.50' }]);

            const total = await model.getTotalCreditForInvoice('invoice-1');

            expect(total).toBe(150.5);
        });

        it('should return 0 if no credits found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ totalCredit: null }]);

            const total = await model.getTotalCreditForInvoice('invoice-1');

            expect(total).toBe(0);
        });

        it('should return 0 on database error', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockRejectedValueOnce(new Error('DB Error'));

            const total = await model.getTotalCreditForInvoice('invoice-1');

            expect(total).toBe(0);
        });
    });

    describe('findByDateRange', () => {
        it('should find credit notes within date range', async () => {
            const mockCreditNotes = [
                { id: 'cn-1', issuedAt: new Date('2024-01-15') },
                { id: 'cn-2', issuedAt: new Date('2024-01-20') }
            ];

            mockDb.query.creditNotes.findMany.mockResolvedValue(mockCreditNotes);

            const result = await model.findByDateRange(
                new Date('2024-01-01'),
                new Date('2024-01-31')
            );

            expect(result).toHaveLength(2);
        });

        it('should return empty array if no credits in range', async () => {
            mockDb.query.creditNotes.findMany.mockResolvedValue([]);

            const result = await model.findByDateRange(
                new Date('2024-01-01'),
                new Date('2024-01-31')
            );

            expect(result).toHaveLength(0);
        });
    });

    describe('getCreditNotesSummary', () => {
        it('should return summary with total and count', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([
                {
                    totalAmount: '500.00',
                    count: 5
                }
            ]);

            const summary = await model.getCreditNotesSummary();

            expect(summary.totalAmount).toBe(500);
            expect(summary.count).toBe(5);
            expect(summary.averageAmount).toBe(100);
        });

        it('should handle date range filters', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([
                {
                    totalAmount: '300.00',
                    count: 3
                }
            ]);

            const summary = await model.getCreditNotesSummary(
                new Date('2024-01-01'),
                new Date('2024-01-31')
            );

            expect(summary.totalAmount).toBe(300);
            expect(summary.count).toBe(3);
        });

        it('should return zero values on error', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockRejectedValueOnce(new Error('DB Error'));

            const summary = await model.getCreditNotesSummary();

            expect(summary.totalAmount).toBe(0);
            expect(summary.count).toBe(0);
            expect(summary.averageAmount).toBe(0);
        });

        it('should handle division by zero', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([
                {
                    totalAmount: null,
                    count: 0
                }
            ]);

            const summary = await model.getCreditNotesSummary();

            expect(summary.averageAmount).toBe(0);
        });
    });

    describe('validateCreditAmount', () => {
        it('should validate positive amounts', async () => {
            const mockInvoice = { id: 'invoice-1', totalAmount: '200.00' };
            mockDb.query.invoices.findFirst.mockResolvedValue(mockInvoice);
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ totalCredit: '50' }]);

            const result = await model.validateCreditAmount('invoice-1', 100);

            expect(result.valid).toBe(true);
        });

        it('should reject negative amounts', async () => {
            const result = await model.validateCreditAmount('invoice-1', -50);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('AMOUNT_MUST_BE_POSITIVE');
        });

        it('should reject zero amounts', async () => {
            const result = await model.validateCreditAmount('invoice-1', 0);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('AMOUNT_MUST_BE_POSITIVE');
        });

        it('should reject if invoice not found', async () => {
            mockDb.query.invoices.findFirst.mockResolvedValue(null);

            const result = await model.validateCreditAmount('non-existent', 100);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('INVOICE_NOT_FOUND');
        });

        it('should reject amounts exceeding invoice balance', async () => {
            const mockInvoice = { id: 'invoice-1', totalAmount: '200.00' };
            mockDb.query.invoices.findFirst.mockResolvedValue(mockInvoice);
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ totalCredit: '150' }]);

            const result = await model.validateCreditAmount('invoice-1', 100);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('AMOUNT_EXCEEDS_INVOICE_BALANCE');
            expect(result.maxAllowed).toBe(50);
        });

        it('should handle validation errors gracefully', async () => {
            mockDb.query.invoices.findFirst.mockRejectedValue(new Error('DB Error'));

            const result = await model.validateCreditAmount('invoice-1', 100);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('VALIDATION_ERROR');
        });
    });

    describe('createWithValidation', () => {
        it('should create credit note with valid data', async () => {
            const mockInvoice = { id: 'invoice-1', totalAmount: '200.00' };
            const mockCreditNote = {
                id: 'cn-1',
                invoiceId: 'invoice-1',
                amount: '50',
                currency: 'USD'
            };

            mockDb.query.invoices.findFirst.mockResolvedValue(mockInvoice);
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ totalCredit: '0' }]);

            vi.spyOn(model, 'create').mockResolvedValue(mockCreditNote as any);

            const result = await model.createWithValidation({
                invoiceId: 'invoice-1',
                amount: 50,
                currency: 'USD',
                reason: 'Test credit'
            });

            expect(result.success).toBe(true);
            expect(result.creditNote?.id).toBe('cn-1');
        });

        it('should fail if validation fails', async () => {
            const result = await model.createWithValidation({
                invoiceId: 'invoice-1',
                amount: -50,
                currency: 'USD'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle creation errors', async () => {
            const mockInvoice = { id: 'invoice-1', totalAmount: '200.00' };
            mockDb.query.invoices.findFirst.mockResolvedValue(mockInvoice);
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ totalCredit: '0' }]);

            vi.spyOn(model, 'create').mockRejectedValue(new Error('DB Error'));

            const result = await model.createWithValidation({
                invoiceId: 'invoice-1',
                amount: 50,
                currency: 'USD'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to create credit note');
        });
    });

    describe('cancel', () => {
        it('should cancel credit note successfully', async () => {
            const mockCanceledNote = {
                id: 'cn-1',
                deletedAt: new Date(),
                reason: 'CANCELED: Wrong amount'
            };

            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockCanceledNote]);

            const result = await model.cancel('cn-1', 'Wrong amount');

            expect(result).toBeDefined();
            expect(result?.deletedAt).toBeDefined();
            expect(result?.reason).toContain('CANCELED');
        });

        it('should use default reason if not provided', async () => {
            const mockCanceledNote = {
                id: 'cn-1',
                reason: 'CANCELED'
            };

            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockCanceledNote]);

            const result = await model.cancel('cn-1');

            expect(result?.reason).toBe('CANCELED');
        });

        it('should return null if credit note not found', async () => {
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([]);

            const result = await model.cancel('non-existent');

            expect(result).toBeNull();
        });

        it('should throw error on database failure', async () => {
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockRejectedValueOnce(new Error('DB Error'));

            await expect(model.cancel('cn-1')).rejects.toThrow('Failed to cancel credit note');
        });
    });
});
