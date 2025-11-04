import type { InvoiceLineModel } from '@repo/db';
import { PermissionEnum, PriceCurrencyEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceLineService } from '../../../src/services/invoiceLine/invoiceLine.service.js';
import type { Actor } from '../../../src/types/index.js';

// Use DB schema types for invoice line
type InvoiceLine = {
    id: string;
    invoiceId: string;
    description: string;
    quantity: number;
    unitPrice: string;
    lineAmount: string;
    taxRate: string;
    taxAmount: string;
    discountRate: string;
    discountAmount: string;
    totalAmount: string;
    pricingPlanId: string | null;
    subscriptionItemId: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    metadata: unknown;
    adminInfo: unknown;
    createdAt: Date;
    updatedAt: Date;
    createdById: string | null;
    updatedById: string | null;
    deletedAt: Date | null;
    deletedById: string | null;
};

describe('InvoiceLineService', () => {
    let service: InvoiceLineService;
    let mockModel: InvoiceLineModel;
    let mockActor: Actor;
    let ctx: import('../../../src/types/index.js').ServiceContext;

    // Mock data
    const mockInvoiceLine: InvoiceLine = {
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        description: 'Monthly subscription fee',
        quantity: 1,
        unitPrice: '100.00',
        lineAmount: '100.00',
        taxRate: '0.21',
        taxAmount: '21.00',
        discountRate: '0.00',
        discountAmount: '0.00',
        totalAmount: '121.00',
        pricingPlanId: '00000000-0000-0000-0000-000000000003',
        subscriptionItemId: '00000000-0000-0000-0000-000000000004',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        metadata: null,
        adminInfo: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null
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
            calculateLineTotal: vi.fn(),
            applyDiscounts: vi.fn(),
            calculateTax: vi.fn(),
            findByInvoice: vi.fn(),
            findBySubscriptionItem: vi.fn(),
            updateQuantity: vi.fn(),
            createWithCalculations: vi.fn(),
            withInvoice: vi.fn(),
            bulkUpdateQuantities: vi.fn()
        } as unknown as InvoiceLineModel;

        service = new InvoiceLineService(ctx, mockModel);
    });

    // =========================================================================
    // calculateLineTotal
    // =========================================================================

    describe('calculateLineTotal', () => {
        it('should calculate line total', async () => {
            const invoiceLineId = '00000000-0000-0000-0000-000000000001';
            const mockTotals = {
                lineAmount: 100,
                taxAmount: 21,
                totalAmount: 121
            };

            vi.mocked(mockModel.calculateLineTotal).mockResolvedValue(mockTotals);

            const result = await service.calculateLineTotal(mockActor, invoiceLineId);

            expect(result.data).toEqual(mockTotals);
            expect(result.error).toBeUndefined();
            expect(mockModel.calculateLineTotal).toHaveBeenCalledWith(invoiceLineId);
        });

        it('should return null when invoice line not found', async () => {
            const invoiceLineId = 'nonexistent';

            vi.mocked(mockModel.calculateLineTotal).mockResolvedValue(null);

            const result = await service.calculateLineTotal(mockActor, invoiceLineId);

            expect(result.data).toBeNull();
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceLineService(ctx, mockModel);

            const result = await serviceWithoutPermission.calculateLineTotal(
                actorWithoutPermission,
                'invoice-line-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // applyDiscounts
    // =========================================================================

    describe('applyDiscounts', () => {
        it('should apply discount rate', async () => {
            const invoiceLineId = '00000000-0000-0000-0000-000000000001';
            const discountRate = 0.1;

            const discountedLine: InvoiceLine = {
                ...mockInvoiceLine,
                discountRate: '0.1',
                lineAmount: '90.00',
                totalAmount: '108.90'
            };

            vi.mocked(mockModel.applyDiscounts).mockResolvedValue(discountedLine);

            const result = await service.applyDiscounts(mockActor, invoiceLineId, discountRate);

            expect(result.data).toEqual(discountedLine);
            expect(mockModel.applyDiscounts).toHaveBeenCalledWith(
                invoiceLineId,
                discountRate,
                undefined
            );
        });

        it('should apply discount amount', async () => {
            const invoiceLineId = '00000000-0000-0000-0000-000000000001';
            const discountAmount = 10;

            const discountedLine: InvoiceLine = {
                ...mockInvoiceLine,
                discountAmount: '10.00',
                lineAmount: '90.00',
                totalAmount: '108.90'
            };

            vi.mocked(mockModel.applyDiscounts).mockResolvedValue(discountedLine);

            const result = await service.applyDiscounts(
                mockActor,
                invoiceLineId,
                undefined,
                discountAmount
            );

            expect(result.data).toEqual(discountedLine);
            expect(mockModel.applyDiscounts).toHaveBeenCalledWith(
                invoiceLineId,
                undefined,
                discountAmount
            );
        });

        it('should return null when invoice line not found', async () => {
            const invoiceLineId = 'nonexistent';

            vi.mocked(mockModel.applyDiscounts).mockResolvedValue(null);

            const result = await service.applyDiscounts(mockActor, invoiceLineId, 0.1);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceLineService(ctx, mockModel);

            const result = await serviceWithoutPermission.applyDiscounts(
                actorWithoutPermission,
                'invoice-line-id',
                0.1
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // calculateTax
    // =========================================================================

    describe('calculateTax', () => {
        it('should calculate tax for line item', async () => {
            const invoiceLineId = '00000000-0000-0000-0000-000000000001';
            const taxRate = 0.21;

            const taxedLine: InvoiceLine = {
                ...mockInvoiceLine,
                taxRate: '0.21',
                taxAmount: '21.00',
                totalAmount: '121.00'
            };

            vi.mocked(mockModel.calculateTax).mockResolvedValue(taxedLine);

            const result = await service.calculateTax(mockActor, invoiceLineId, taxRate);

            expect(result.data).toEqual(taxedLine);
            expect(mockModel.calculateTax).toHaveBeenCalledWith(invoiceLineId, taxRate);
        });

        it('should return null when invoice line not found', async () => {
            const invoiceLineId = 'nonexistent';

            vi.mocked(mockModel.calculateTax).mockResolvedValue(null);

            const result = await service.calculateTax(mockActor, invoiceLineId, 0.21);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceLineService(ctx, mockModel);

            const result = await serviceWithoutPermission.calculateTax(
                actorWithoutPermission,
                'invoice-line-id',
                0.21
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByInvoice
    // =========================================================================

    describe('findByInvoice', () => {
        it('should find line items by invoice', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';
            const mockInvoiceLines: InvoiceLine[] = [mockInvoiceLine];

            vi.mocked(mockModel.findByInvoice).mockResolvedValue(mockInvoiceLines);

            const result = await service.findByInvoice(mockActor, invoiceId);

            expect(result.data).toEqual(mockInvoiceLines);
            expect(mockModel.findByInvoice).toHaveBeenCalledWith(invoiceId);
        });

        it('should return empty array when no line items found', async () => {
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

            const serviceWithoutPermission = new InvoiceLineService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByInvoice(
                actorWithoutPermission,
                'invoice-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findBySubscriptionItem
    // =========================================================================

    describe('findBySubscriptionItem', () => {
        it('should find line items by subscription item', async () => {
            const subscriptionItemId = '00000000-0000-0000-0000-000000000004';
            const mockInvoiceLines: InvoiceLine[] = [mockInvoiceLine];

            vi.mocked(mockModel.findBySubscriptionItem).mockResolvedValue(mockInvoiceLines);

            const result = await service.findBySubscriptionItem(mockActor, subscriptionItemId);

            expect(result.data).toEqual(mockInvoiceLines);
            expect(mockModel.findBySubscriptionItem).toHaveBeenCalledWith(subscriptionItemId);
        });

        it('should return empty array when no line items found', async () => {
            const subscriptionItemId = '00000000-0000-0000-0000-000000000004';

            vi.mocked(mockModel.findBySubscriptionItem).mockResolvedValue([]);

            const result = await service.findBySubscriptionItem(mockActor, subscriptionItemId);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceLineService(ctx, mockModel);

            const result = await serviceWithoutPermission.findBySubscriptionItem(
                actorWithoutPermission,
                'subscription-item-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // updateQuantity
    // =========================================================================

    describe('updateQuantity', () => {
        it('should update quantity and recalculate totals', async () => {
            const invoiceLineId = '00000000-0000-0000-0000-000000000001';
            const newQuantity = 2;

            const updatedLine: InvoiceLine = {
                ...mockInvoiceLine,
                quantity: 2,
                lineAmount: '200.00',
                taxAmount: '42.00',
                totalAmount: '242.00'
            };

            vi.mocked(mockModel.updateQuantity).mockResolvedValue(updatedLine);

            const result = await service.updateQuantity(mockActor, invoiceLineId, newQuantity);

            expect(result.data).toEqual(updatedLine);
            expect(mockModel.updateQuantity).toHaveBeenCalledWith(invoiceLineId, newQuantity);
        });

        it('should reject invalid quantity', async () => {
            const invoiceLineId = '00000000-0000-0000-0000-000000000001';
            const invalidQuantity = 0;

            vi.mocked(mockModel.updateQuantity).mockRejectedValue(new Error('INVALID_QUANTITY'));

            const result = await service.updateQuantity(mockActor, invoiceLineId, invalidQuantity);

            expect(result.error).toBeDefined();
        });

        it('should return null when invoice line not found', async () => {
            const invoiceLineId = 'nonexistent';

            vi.mocked(mockModel.updateQuantity).mockResolvedValue(null);

            const result = await service.updateQuantity(mockActor, invoiceLineId, 2);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceLineService(ctx, mockModel);

            const result = await serviceWithoutPermission.updateQuantity(
                actorWithoutPermission,
                'invoice-line-id',
                2
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // createWithCalculations
    // =========================================================================

    describe('createWithCalculations', () => {
        it('should create invoice line with calculations', async () => {
            const data = {
                invoiceId: '00000000-0000-0000-0000-000000000002',
                description: 'New line item',
                quantity: 1,
                unitPrice: 100,
                taxRate: 0.21
            };

            vi.mocked(mockModel.createWithCalculations).mockResolvedValue(mockInvoiceLine);

            const result = await service.createWithCalculations(mockActor, data);

            expect(result.data).toEqual(mockInvoiceLine);
            expect(mockModel.createWithCalculations).toHaveBeenCalledWith(data);
        });

        it('should return null when creation fails', async () => {
            const data = {
                invoiceId: '00000000-0000-0000-0000-000000000002',
                description: 'New line item',
                quantity: 1,
                unitPrice: 100
            };

            vi.mocked(mockModel.createWithCalculations).mockResolvedValue(null);

            const result = await service.createWithCalculations(mockActor, data);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceLineService(ctx, mockModel);

            const result = await serviceWithoutPermission.createWithCalculations(
                actorWithoutPermission,
                {
                    invoiceId: 'invoice-id',
                    description: 'Test',
                    quantity: 1,
                    unitPrice: 100
                }
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // withInvoice
    // =========================================================================

    describe('withInvoice', () => {
        it('should get line item with invoice data', async () => {
            const invoiceLineId = '00000000-0000-0000-0000-000000000001';
            const mockLineWithInvoice = {
                ...mockInvoiceLine,
                invoice: {
                    id: '00000000-0000-0000-0000-000000000002',
                    invoiceNumber: 'INV-2025-000001',
                    clientId: '00000000-0000-0000-0000-000000000005',
                    status: 'OPEN' as const,
                    subtotal: '100.00',
                    taxes: '21.00',
                    total: '121.00',
                    currency: PriceCurrencyEnum.USD,
                    issueDate: new Date('2025-01-01'),
                    dueDate: new Date('2025-01-31'),
                    description: 'Monthly subscription',
                    paymentTerms: 'Net 30',
                    notes: null,
                    paidAt: null,
                    metadata: null,
                    createdAt: new Date('2025-01-01'),
                    updatedAt: new Date('2025-01-01'),
                    createdById: '',
                    updatedById: '',
                    deletedAt: null,
                    deletedById: null
                }
            };

            vi.mocked(mockModel.withInvoice).mockResolvedValue(
                mockLineWithInvoice as Parameters<typeof mockModel.withInvoice>[0] extends string
                    ? Awaited<ReturnType<typeof mockModel.withInvoice>>
                    : never
            );

            const result = await service.withInvoice(mockActor, invoiceLineId);

            expect(result.data).toEqual(mockLineWithInvoice);
            expect(mockModel.withInvoice).toHaveBeenCalledWith(invoiceLineId);
        });

        it('should return null when invoice line not found', async () => {
            const invoiceLineId = 'nonexistent';

            vi.mocked(mockModel.withInvoice).mockResolvedValue(null);

            const result = await service.withInvoice(mockActor, invoiceLineId);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceLineService(ctx, mockModel);

            const result = await serviceWithoutPermission.withInvoice(
                actorWithoutPermission,
                'invoice-line-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // bulkUpdateQuantities
    // =========================================================================

    describe('bulkUpdateQuantities', () => {
        it('should bulk update quantities', async () => {
            const updates = [
                { id: '00000000-0000-0000-0000-000000000001', quantity: 2 },
                { id: '00000000-0000-0000-0000-000000000002', quantity: 3 }
            ];

            const updatedLines: InvoiceLine[] = [
                { ...mockInvoiceLine, id: updates[0].id, quantity: updates[0].quantity },
                { ...mockInvoiceLine, id: updates[1].id, quantity: updates[1].quantity }
            ];

            vi.mocked(mockModel.bulkUpdateQuantities).mockResolvedValue(updatedLines);

            const result = await service.bulkUpdateQuantities(mockActor, updates);

            expect(result.data).toEqual(updatedLines);
            expect(mockModel.bulkUpdateQuantities).toHaveBeenCalledWith(updates);
        });

        it('should return empty array when no updates', async () => {
            const updates: Array<{ id: string; quantity: number }> = [];

            vi.mocked(mockModel.bulkUpdateQuantities).mockResolvedValue([]);

            const result = await service.bulkUpdateQuantities(mockActor, updates);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new InvoiceLineService(ctx, mockModel);

            const result = await serviceWithoutPermission.bulkUpdateQuantities(
                actorWithoutPermission,
                [{ id: 'id', quantity: 2 }]
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });
});
