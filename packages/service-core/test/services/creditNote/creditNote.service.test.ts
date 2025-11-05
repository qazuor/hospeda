import type { CreditNote, CreditNoteModel } from '@repo/db';
import {
    PermissionEnum,
    PriceCurrencyEnum,
    RoleEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditNoteService } from '../../../src/services/creditNote/creditNote.service.js';
import type { Actor } from '../../../src/types/index.js';

describe('CreditNoteService', () => {
    let service: CreditNoteService;
    let mockModel: CreditNoteModel;
    let mockActor: Actor;
    let ctx: import('../../../src/types/index.js').ServiceContext;

    // Mock data
    const mockCreditNote: CreditNote = {
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        amount: '100.00',
        currency: PriceCurrencyEnum.USD,
        reason: 'Customer refund',
        issuedAt: new Date('2025-01-15'),
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15'),
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        adminInfo: null
    };

    beforeEach(() => {
        ctx = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        } as unknown as import('../../../src/types/index.js').ServiceContext;

        mockActor = {
            id: '00000000-0000-0000-0000-000000000100',
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.CLIENT_UPDATE]
        };

        mockModel = {
            generateFromRefund: vi.fn(),
            applyToInvoice: vi.fn(),
            calculateBalance: vi.fn(),
            findByInvoice: vi.fn(),
            getTotalCreditForInvoice: vi.fn(),
            findByDateRange: vi.fn(),
            getCreditNotesSummary: vi.fn(),
            validateCreditAmount: vi.fn(),
            createWithValidation: vi.fn(),
            cancel: vi.fn()
        } as unknown as CreditNoteModel;

        service = new CreditNoteService(ctx, mockModel);
    });

    // =========================================================================
    // generateFromRefund tests
    // =========================================================================

    describe('generateFromRefund', () => {
        it('should generate credit note from refund', async () => {
            const refundId = '00000000-0000-0000-0000-000000000004';
            const reason = 'Customer requested refund';

            vi.mocked(mockModel.generateFromRefund).mockResolvedValue(mockCreditNote);

            const result = await service.generateFromRefund(mockActor, refundId, reason);

            expect(result.data).toEqual(mockCreditNote);
            expect(result.error).toBeUndefined();
            expect(mockModel.generateFromRefund).toHaveBeenCalledWith(refundId, reason);
        });

        it('should return null when refund not found', async () => {
            const refundId = 'nonexistent';

            vi.mocked(mockModel.generateFromRefund).mockResolvedValue(null);

            const result = await service.generateFromRefund(mockActor, refundId);

            expect(result.data).toBeNull();
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new CreditNoteService(ctx, mockModel);

            const result = await serviceWithoutPermission.generateFromRefund(
                actorWithoutPermission,
                'refund-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });

        it('should generate credit note without reason', async () => {
            const refundId = '00000000-0000-0000-0000-000000000004';

            vi.mocked(mockModel.generateFromRefund).mockResolvedValue(mockCreditNote);

            const result = await service.generateFromRefund(mockActor, refundId);

            expect(result.data).toEqual(mockCreditNote);
            expect(mockModel.generateFromRefund).toHaveBeenCalledWith(refundId, undefined);
        });
    });

    // =========================================================================
    // applyToInvoice tests
    // =========================================================================

    describe('applyToInvoice', () => {
        it('should apply credit note to invoice', async () => {
            const creditNoteId = '00000000-0000-0000-0000-000000000001';
            const mockResult = {
                success: true,
                appliedAmount: 100
            };

            vi.mocked(mockModel.applyToInvoice).mockResolvedValue(mockResult);

            const result = await service.applyToInvoice(mockActor, creditNoteId);

            expect(result.data).toEqual(mockResult);
            expect(result.error).toBeUndefined();
            expect(mockModel.applyToInvoice).toHaveBeenCalledWith(creditNoteId);
        });

        it('should return error when credit note not found', async () => {
            const creditNoteId = 'nonexistent';
            const mockResult = {
                success: false,
                error: 'Credit note not found'
            };

            vi.mocked(mockModel.applyToInvoice).mockResolvedValue(mockResult);

            const result = await service.applyToInvoice(mockActor, creditNoteId);

            expect(result.data).toEqual(mockResult);
            expect(result.data?.success).toBe(false);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new CreditNoteService(ctx, mockModel);

            const result = await serviceWithoutPermission.applyToInvoice(
                actorWithoutPermission,
                'credit-note-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });

        it('should handle invoice not found error', async () => {
            const creditNoteId = '00000000-0000-0000-0000-000000000001';
            const mockResult = {
                success: false,
                error: 'Associated invoice not found'
            };

            vi.mocked(mockModel.applyToInvoice).mockResolvedValue(mockResult);

            const result = await service.applyToInvoice(mockActor, creditNoteId);

            expect(result.data?.success).toBe(false);
            expect(result.data?.error).toContain('invoice not found');
        });
    });

    // =========================================================================
    // calculateBalance tests
    // =========================================================================

    describe('calculateBalance', () => {
        it('should calculate credit note balance', async () => {
            const creditNoteId = '00000000-0000-0000-0000-000000000001';
            const balance = 100;

            vi.mocked(mockModel.calculateBalance).mockResolvedValue(balance);

            const result = await service.calculateBalance(mockActor, creditNoteId);

            expect(result.data).toBe(balance);
            expect(mockModel.calculateBalance).toHaveBeenCalledWith(creditNoteId);
        });

        it('should return 0 when credit note not found', async () => {
            const creditNoteId = 'nonexistent';

            vi.mocked(mockModel.calculateBalance).mockResolvedValue(0);

            const result = await service.calculateBalance(mockActor, creditNoteId);

            expect(result.data).toBe(0);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new CreditNoteService(ctx, mockModel);

            const result = await serviceWithoutPermission.calculateBalance(
                actorWithoutPermission,
                'credit-note-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByInvoice tests
    // =========================================================================

    describe('findByInvoice', () => {
        it('should find credit notes by invoice', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';
            const mockCreditNotes: CreditNote[] = [mockCreditNote];

            vi.mocked(mockModel.findByInvoice).mockResolvedValue(mockCreditNotes);

            const result = await service.findByInvoice(mockActor, invoiceId);

            expect(result.data).toEqual(mockCreditNotes);
            expect(mockModel.findByInvoice).toHaveBeenCalledWith(invoiceId);
        });

        it('should return empty array when no credit notes found', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.findByInvoice).mockResolvedValue([]);

            const result = await service.findByInvoice(mockActor, invoiceId);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new CreditNoteService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByInvoice(
                actorWithoutPermission,
                'invoice-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // getTotalCreditForInvoice tests
    // =========================================================================

    describe('getTotalCreditForInvoice', () => {
        it('should get total credit for invoice', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';
            const total = 250;

            vi.mocked(mockModel.getTotalCreditForInvoice).mockResolvedValue(total);

            const result = await service.getTotalCreditForInvoice(mockActor, invoiceId);

            expect(result.data).toBe(total);
            expect(mockModel.getTotalCreditForInvoice).toHaveBeenCalledWith(invoiceId);
        });

        it('should return 0 when no credits exist', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.getTotalCreditForInvoice).mockResolvedValue(0);

            const result = await service.getTotalCreditForInvoice(mockActor, invoiceId);

            expect(result.data).toBe(0);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new CreditNoteService(ctx, mockModel);

            const result = await serviceWithoutPermission.getTotalCreditForInvoice(
                actorWithoutPermission,
                'invoice-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByDateRange tests
    // =========================================================================

    describe('findByDateRange', () => {
        it('should find credit notes by date range', async () => {
            const startDate = new Date('2025-01-01');
            const endDate = new Date('2025-01-31');
            const mockCreditNotes: CreditNote[] = [mockCreditNote];

            vi.mocked(mockModel.findByDateRange).mockResolvedValue(mockCreditNotes);

            const result = await service.findByDateRange(mockActor, startDate, endDate);

            expect(result.data).toEqual(mockCreditNotes);
            expect(mockModel.findByDateRange).toHaveBeenCalledWith(startDate, endDate);
        });

        it('should return empty array when no credit notes in range', async () => {
            const startDate = new Date('2025-02-01');
            const endDate = new Date('2025-02-28');

            vi.mocked(mockModel.findByDateRange).mockResolvedValue([]);

            const result = await service.findByDateRange(mockActor, startDate, endDate);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new CreditNoteService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByDateRange(
                actorWithoutPermission,
                new Date(),
                new Date()
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // getCreditNotesSummary tests
    // =========================================================================

    describe('getCreditNotesSummary', () => {
        it('should get credit notes summary', async () => {
            const mockSummary = {
                totalAmount: 500,
                count: 5,
                averageAmount: 100
            };

            vi.mocked(mockModel.getCreditNotesSummary).mockResolvedValue(mockSummary);

            const result = await service.getCreditNotesSummary(mockActor);

            expect(result.data).toEqual(mockSummary);
            expect(mockModel.getCreditNotesSummary).toHaveBeenCalledWith(undefined, undefined);
        });

        it('should get summary with date filters', async () => {
            const startDate = new Date('2025-01-01');
            const endDate = new Date('2025-01-31');
            const mockSummary = {
                totalAmount: 300,
                count: 3,
                averageAmount: 100
            };

            vi.mocked(mockModel.getCreditNotesSummary).mockResolvedValue(mockSummary);

            const result = await service.getCreditNotesSummary(mockActor, startDate, endDate);

            expect(result.data).toEqual(mockSummary);
            expect(mockModel.getCreditNotesSummary).toHaveBeenCalledWith(startDate, endDate);
        });

        it('should return zero values when no credit notes exist', async () => {
            const mockSummary = {
                totalAmount: 0,
                count: 0,
                averageAmount: 0
            };

            vi.mocked(mockModel.getCreditNotesSummary).mockResolvedValue(mockSummary);

            const result = await service.getCreditNotesSummary(mockActor);

            expect(result.data).toEqual(mockSummary);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new CreditNoteService(ctx, mockModel);

            const result = await serviceWithoutPermission.getCreditNotesSummary(
                actorWithoutPermission
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // validateCreditAmount tests
    // =========================================================================

    describe('validateCreditAmount', () => {
        it('should validate credit amount successfully', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';
            const amount = 100;
            const mockValidation = {
                valid: true
            };

            vi.mocked(mockModel.validateCreditAmount).mockResolvedValue(mockValidation);

            const result = await service.validateCreditAmount(mockActor, invoiceId, amount);

            expect(result.data).toEqual(mockValidation);
            expect(mockModel.validateCreditAmount).toHaveBeenCalledWith(invoiceId, amount);
        });

        it('should return validation error for negative amount', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';
            const amount = -100;
            const mockValidation = {
                valid: false,
                reason: 'AMOUNT_MUST_BE_POSITIVE'
            };

            vi.mocked(mockModel.validateCreditAmount).mockResolvedValue(mockValidation);

            const result = await service.validateCreditAmount(mockActor, invoiceId, amount);

            expect(result.data?.valid).toBe(false);
            expect(result.data?.reason).toBe('AMOUNT_MUST_BE_POSITIVE');
        });

        it('should return validation error when amount exceeds invoice balance', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';
            const amount = 500;
            const mockValidation = {
                valid: false,
                reason: 'AMOUNT_EXCEEDS_INVOICE_BALANCE',
                maxAllowed: 200
            };

            vi.mocked(mockModel.validateCreditAmount).mockResolvedValue(mockValidation);

            const result = await service.validateCreditAmount(mockActor, invoiceId, amount);

            expect(result.data?.valid).toBe(false);
            expect(result.data?.reason).toBe('AMOUNT_EXCEEDS_INVOICE_BALANCE');
            expect(result.data?.maxAllowed).toBe(200);
        });

        it('should return validation error when invoice not found', async () => {
            const invoiceId = 'nonexistent';
            const amount = 100;
            const mockValidation = {
                valid: false,
                reason: 'INVOICE_NOT_FOUND'
            };

            vi.mocked(mockModel.validateCreditAmount).mockResolvedValue(mockValidation);

            const result = await service.validateCreditAmount(mockActor, invoiceId, amount);

            expect(result.data?.valid).toBe(false);
            expect(result.data?.reason).toBe('INVOICE_NOT_FOUND');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new CreditNoteService(ctx, mockModel);

            const result = await serviceWithoutPermission.validateCreditAmount(
                actorWithoutPermission,
                'invoice-id',
                100
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // createWithValidation tests
    // =========================================================================

    describe('createWithValidation', () => {
        it('should create credit note with validation', async () => {
            const data = {
                invoiceId: '00000000-0000-0000-0000-000000000002',
                amount: 100,
                currency: 'USD',
                reason: 'Customer refund'
            };
            const mockResult = {
                success: true,
                creditNote: mockCreditNote
            };

            vi.mocked(mockModel.createWithValidation).mockResolvedValue(mockResult);

            const result = await service.createWithValidation(mockActor, data);

            expect(result.data).toEqual(mockResult);
            expect(result.data?.success).toBe(true);
            expect(mockModel.createWithValidation).toHaveBeenCalledWith(data);
        });

        it('should return error when validation fails', async () => {
            const data = {
                invoiceId: '00000000-0000-0000-0000-000000000002',
                amount: 1000,
                currency: 'USD'
            };
            const mockResult = {
                success: false,
                error: 'AMOUNT_EXCEEDS_INVOICE_BALANCE'
            };

            vi.mocked(mockModel.createWithValidation).mockResolvedValue(mockResult);

            const result = await service.createWithValidation(mockActor, data);

            expect(result.data?.success).toBe(false);
            expect(result.data?.error).toBe('AMOUNT_EXCEEDS_INVOICE_BALANCE');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new CreditNoteService(ctx, mockModel);

            const result = await serviceWithoutPermission.createWithValidation(
                actorWithoutPermission,
                {
                    invoiceId: 'invoice-id',
                    amount: 100,
                    currency: 'USD'
                }
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });

        it('should create credit note without optional reason', async () => {
            const data = {
                invoiceId: '00000000-0000-0000-0000-000000000002',
                amount: 100,
                currency: 'USD'
            };
            const mockResult = {
                success: true,
                creditNote: mockCreditNote
            };

            vi.mocked(mockModel.createWithValidation).mockResolvedValue(mockResult);

            const result = await service.createWithValidation(mockActor, data);

            expect(result.data?.success).toBe(true);
            expect(mockModel.createWithValidation).toHaveBeenCalledWith(data);
        });
    });

    // =========================================================================
    // cancel tests
    // =========================================================================

    describe('cancel', () => {
        it('should cancel credit note', async () => {
            const creditNoteId = '00000000-0000-0000-0000-000000000001';
            const reason = 'Issued in error';

            const canceledCreditNote: CreditNote = {
                ...mockCreditNote,
                deletedAt: new Date(),
                reason: `CANCELED: ${reason}`
            };

            vi.mocked(mockModel.cancel).mockResolvedValue(canceledCreditNote);

            const result = await service.cancel(mockActor, creditNoteId, reason);

            expect(result.data).toEqual(canceledCreditNote);
            expect(mockModel.cancel).toHaveBeenCalledWith(creditNoteId, reason);
        });

        it('should cancel credit note without reason', async () => {
            const creditNoteId = '00000000-0000-0000-0000-000000000001';

            const canceledCreditNote: CreditNote = {
                ...mockCreditNote,
                deletedAt: new Date(),
                reason: 'CANCELED'
            };

            vi.mocked(mockModel.cancel).mockResolvedValue(canceledCreditNote);

            const result = await service.cancel(mockActor, creditNoteId);

            expect(result.data).toEqual(canceledCreditNote);
            expect(mockModel.cancel).toHaveBeenCalledWith(creditNoteId, undefined);
        });

        it('should return null when credit note not found', async () => {
            const creditNoteId = 'nonexistent';

            vi.mocked(mockModel.cancel).mockResolvedValue(null);

            const result = await service.cancel(mockActor, creditNoteId);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new CreditNoteService(ctx, mockModel);

            const result = await serviceWithoutPermission.cancel(
                actorWithoutPermission,
                'credit-note-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });
});
