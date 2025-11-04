import type { InvoiceModel } from '@repo/db';
import {
    type Invoice,
    InvoiceStatusEnum,
    PermissionEnum,
    PriceCurrencyEnum,
    RoleEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceService } from '../../../src/services/invoice/invoice.service.js';
import type { Actor } from '../../../src/types/index.js';

describe('InvoiceService', () => {
    let service: InvoiceService;
    let mockModel: InvoiceModel;
    let mockActor: Actor;
    let ctx: import('../../../src/types/index.js').ServiceContext;

    // Mock data
    const mockInvoice: Invoice = {
        id: '00000000-0000-0000-0000-000000000001',
        clientId: '00000000-0000-0000-0000-000000000002',
        invoiceNumber: 'INV-2025-000001',
        status: InvoiceStatusEnum.OPEN,
        subtotal: 100,
        taxes: 21,
        total: 121,
        currency: PriceCurrencyEnum.USD,
        issueDate: new Date('2025-01-01'),
        dueDate: new Date('2025-01-31'),
        description: 'Monthly subscription fee',
        paymentTerms: 'Net 30',
        notes: 'Thank you for your business',
        paidAt: undefined,
        metadata: undefined,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        createdById: '',
        updatedById: '',
        deletedAt: undefined,
        deletedById: undefined
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
            generateFromSubscription: vi.fn(),
            calculateTotals: vi.fn(),
            markAsPaid: vi.fn(),
            canMarkPaid: vi.fn(),
            canVoid: vi.fn(),
            findOverdue: vi.fn(),
            findByClient: vi.fn(),
            findById: vi.fn(),
            findOne: vi.fn(),
            update: vi.fn()
        } as unknown as InvoiceModel;

        service = new InvoiceService(ctx, mockModel);
    });

    // =========================================================================
    // generateFromSubscription
    // =========================================================================

    describe('generateFromSubscription', () => {
        it('should generate invoice from subscription', async () => {
            const subscriptionId = '00000000-0000-0000-0000-000000000003';
            const billingPeriodStart = new Date('2025-01-01');
            const billingPeriodEnd = new Date('2025-01-31');

            vi.mocked(mockModel.generateFromSubscription).mockResolvedValue(mockInvoice);

            const result = await service.generateFromSubscription(
                mockActor,
                subscriptionId,
                billingPeriodStart,
                billingPeriodEnd
            );

            expect(result.data).toEqual(mockInvoice);
            expect(result.error).toBeUndefined();
            expect(mockModel.generateFromSubscription).toHaveBeenCalledWith(
                subscriptionId,
                billingPeriodStart,
                billingPeriodEnd
            );
        });

        it('should return null when subscription not found', async () => {
            const subscriptionId = 'nonexistent';
            const billingPeriodStart = new Date('2025-01-01');
            const billingPeriodEnd = new Date('2025-01-31');

            vi.mocked(mockModel.generateFromSubscription).mockResolvedValue(null);

            const result = await service.generateFromSubscription(
                mockActor,
                subscriptionId,
                billingPeriodStart,
                billingPeriodEnd
            );

            expect(result.data).toBeNull();
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceService(ctx, mockModel);

            const result = await serviceWithoutPermission.generateFromSubscription(
                actorWithoutPermission,
                'subscription-id',
                new Date(),
                new Date()
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // calculateTotals
    // =========================================================================

    describe('calculateTotals', () => {
        it('should calculate invoice totals', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000001';
            const mockTotals = {
                subtotal: 100,
                tax: 21,
                total: 121
            };

            vi.mocked(mockModel.calculateTotals).mockResolvedValue(mockTotals);

            const result = await service.calculateTotals(mockActor, invoiceId);

            expect(result.data).toEqual(mockTotals);
            expect(mockModel.calculateTotals).toHaveBeenCalledWith(invoiceId);
        });

        it('should return null when invoice not found', async () => {
            const invoiceId = 'nonexistent';

            vi.mocked(mockModel.calculateTotals).mockResolvedValue(null);

            const result = await service.calculateTotals(mockActor, invoiceId);

            expect(result.data).toBeNull();
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceService(ctx, mockModel);

            const result = await serviceWithoutPermission.calculateTotals(
                actorWithoutPermission,
                'invoice-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // markAsPaid
    // =========================================================================

    describe('markAsPaid', () => {
        it('should mark invoice as paid', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000001';
            const paidAt = new Date('2025-01-15');

            const paidInvoice: Invoice = {
                ...mockInvoice,
                status: InvoiceStatusEnum.PAID,
                paidAt
            };

            vi.mocked(mockModel.canMarkPaid).mockResolvedValue(true);
            vi.mocked(mockModel.markAsPaid).mockResolvedValue(paidInvoice);

            const result = await service.markAsPaid(mockActor, invoiceId, { paidAt });

            expect(result.data).toEqual(paidInvoice);
            expect(mockModel.canMarkPaid).toHaveBeenCalledWith(invoiceId);
            expect(mockModel.markAsPaid).toHaveBeenCalledWith(invoiceId, paidAt);
        });

        it('should mark invoice as paid with current date if not provided', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000001';

            const paidInvoice: Invoice = {
                ...mockInvoice,
                status: InvoiceStatusEnum.PAID,
                paidAt: new Date()
            };

            vi.mocked(mockModel.canMarkPaid).mockResolvedValue(true);
            vi.mocked(mockModel.markAsPaid).mockResolvedValue(paidInvoice);

            const result = await service.markAsPaid(mockActor, invoiceId, {});

            expect(result.data).toEqual(paidInvoice);
            expect(mockModel.markAsPaid).toHaveBeenCalled();
        });

        it('should reject marking invoice as paid when not allowed', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.canMarkPaid).mockResolvedValue(false);

            const result = await service.markAsPaid(mockActor, invoiceId, {});

            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('cannot be marked as paid');
        });

        it('should return null when invoice not found', async () => {
            const invoiceId = 'nonexistent';

            vi.mocked(mockModel.canMarkPaid).mockResolvedValue(true);
            vi.mocked(mockModel.markAsPaid).mockResolvedValue(null);

            const result = await service.markAsPaid(mockActor, invoiceId, {});

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceService(ctx, mockModel);

            const result = await serviceWithoutPermission.markAsPaid(
                actorWithoutPermission,
                'invoice-id',
                {}
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // markAsVoid
    // =========================================================================

    describe('markAsVoid', () => {
        it('should mark invoice as void', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000001';
            const reason = 'Duplicate invoice';

            const voidInvoice: Invoice = {
                ...mockInvoice,
                status: InvoiceStatusEnum.VOID,
                metadata: { voidReason: reason }
            };

            vi.mocked(mockModel.canVoid).mockResolvedValue(true);
            vi.mocked(mockModel.findById).mockResolvedValue(mockInvoice);
            vi.mocked(mockModel.update).mockResolvedValue(voidInvoice);

            const result = await service.markAsVoid(mockActor, invoiceId, reason);

            expect(result.data).toBe(true);
            expect(result.error).toBeUndefined();
            expect(mockModel.canVoid).toHaveBeenCalledWith(invoiceId);
        });

        it('should reject marking invoice as void when not allowed', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000001';
            const reason = 'Duplicate invoice';

            vi.mocked(mockModel.canVoid).mockResolvedValue(false);

            const result = await service.markAsVoid(mockActor, invoiceId, reason);

            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('cannot be voided');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceService(ctx, mockModel);

            const result = await serviceWithoutPermission.markAsVoid(
                actorWithoutPermission,
                'invoice-id',
                'reason'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByNumber
    // =========================================================================

    describe('findByNumber', () => {
        it('should find invoice by number', async () => {
            const invoiceNumber = 'INV-2025-000001';

            vi.mocked(mockModel.findOne).mockResolvedValue(mockInvoice);

            const result = await service.findByNumber(mockActor, invoiceNumber);

            expect(result.data).toEqual(mockInvoice);
        });

        it('should return null when invoice not found', async () => {
            const invoiceNumber = 'INV-2025-999999';

            vi.mocked(mockModel.findOne).mockResolvedValue(null);

            const result = await service.findByNumber(mockActor, invoiceNumber);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByNumber(
                actorWithoutPermission,
                'INV-2025-000001'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByClient
    // =========================================================================

    describe('findByClient', () => {
        it('should find invoices by client', async () => {
            const clientId = '00000000-0000-0000-0000-000000000002';
            const mockInvoices: Invoice[] = [mockInvoice];

            vi.mocked(mockModel.findByClient).mockResolvedValue(mockInvoices);

            const result = await service.findByClient(mockActor, clientId);

            expect(result.data).toEqual(mockInvoices);
            expect(mockModel.findByClient).toHaveBeenCalledWith(clientId);
        });

        it('should return empty array when no invoices found', async () => {
            const clientId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.findByClient).mockResolvedValue([]);

            const result = await service.findByClient(mockActor, clientId);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByClient(
                actorWithoutPermission,
                'client-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findOverdue
    // =========================================================================

    describe('findOverdue', () => {
        it('should find overdue invoices', async () => {
            const daysOverdue = 7;
            const overdueInvoice: Invoice = {
                ...mockInvoice,
                dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
            };

            vi.mocked(mockModel.findOverdue).mockResolvedValue([overdueInvoice]);

            const result = await service.findOverdue(mockActor, daysOverdue);

            expect(result.data).toEqual([overdueInvoice]);
            expect(mockModel.findOverdue).toHaveBeenCalled();
        });

        it('should find all overdue invoices without days parameter', async () => {
            vi.mocked(mockModel.findOverdue).mockResolvedValue([mockInvoice]);

            const result = await service.findOverdue(mockActor);

            expect(result.data).toEqual([mockInvoice]);
            expect(mockModel.findOverdue).toHaveBeenCalled();
        });

        it('should return empty array when no overdue invoices', async () => {
            vi.mocked(mockModel.findOverdue).mockResolvedValue([]);

            const result = await service.findOverdue(mockActor);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceService(ctx, mockModel);

            const result = await serviceWithoutPermission.findOverdue(actorWithoutPermission);

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // sendReminder
    // =========================================================================

    describe('sendReminder', () => {
        it('should send reminder for invoice', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.findById).mockResolvedValue(mockInvoice);

            const result = await service.sendReminder(mockActor, invoiceId);

            expect(result.data).toBe(true);
            expect(result.error).toBeUndefined();
            expect(mockModel.findById).toHaveBeenCalledWith(invoiceId);
        });

        it('should return error when invoice not found', async () => {
            const invoiceId = 'nonexistent';

            vi.mocked(mockModel.findById).mockResolvedValue(null);

            const result = await service.sendReminder(mockActor, invoiceId);

            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('Invoice not found');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceService(ctx, mockModel);

            const result = await serviceWithoutPermission.sendReminder(
                actorWithoutPermission,
                'invoice-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });
});
