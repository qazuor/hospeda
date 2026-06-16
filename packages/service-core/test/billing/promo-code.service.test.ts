/**
 * Unit tests for PromoCodeService facade
 *
 * Tests that the facade correctly delegates to the underlying sub-modules:
 * - promo-code.crud: create, getByCode, getById, update, delete, list
 * - promo-code.redemption: apply, incrementUsage, tryRedeemAtomically,
 *   recordUsage, redeemAndRecord
 * - promo-code.validation: validate
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted() so these variables are available inside vi.mock() factories
const {
    mockCreatePromoCode,
    mockGetPromoCodeByCode,
    mockGetPromoCodeById,
    mockUpdatePromoCode,
    mockDeletePromoCode,
    mockListPromoCodes,
    mockApplyPromoCode,
    mockIncrementPromoCodeUsage,
    mockRecordPromoCodeUsage,
    mockRedeemAndRecordUsage,
    mockTryRedeemAtomically,
    mockValidatePromoCode
} = vi.hoisted(() => ({
    mockCreatePromoCode: vi.fn(),
    mockGetPromoCodeByCode: vi.fn(),
    mockGetPromoCodeById: vi.fn(),
    mockUpdatePromoCode: vi.fn(),
    mockDeletePromoCode: vi.fn(),
    mockListPromoCodes: vi.fn(),
    mockApplyPromoCode: vi.fn(),
    mockIncrementPromoCodeUsage: vi.fn(),
    mockRecordPromoCodeUsage: vi.fn(),
    mockRedeemAndRecordUsage: vi.fn(),
    mockTryRedeemAtomically: vi.fn(),
    mockValidatePromoCode: vi.fn()
}));

vi.mock('../../src/services/billing/promo-code/promo-code.crud.js', () => ({
    createPromoCode: mockCreatePromoCode,
    getPromoCodeByCode: mockGetPromoCodeByCode,
    getPromoCodeById: mockGetPromoCodeById,
    updatePromoCode: mockUpdatePromoCode,
    deletePromoCode: mockDeletePromoCode,
    listPromoCodes: mockListPromoCodes
}));

vi.mock('../../src/services/billing/promo-code/promo-code.redemption.js', () => ({
    applyPromoCode: mockApplyPromoCode,
    incrementPromoCodeUsage: mockIncrementPromoCodeUsage,
    recordPromoCodeUsage: mockRecordPromoCodeUsage,
    redeemAndRecordUsage: mockRedeemAndRecordUsage,
    tryRedeemAtomically: mockTryRedeemAtomically
}));

vi.mock('../../src/services/billing/promo-code/promo-code.validation.js', () => ({
    validatePromoCode: mockValidatePromoCode
}));

import { PromoCodeService } from '../../src/services/billing/promo-code/promo-code.service.js';

describe('PromoCodeService facade', () => {
    let service: PromoCodeService;

    beforeEach(() => {
        service = new PromoCodeService();
        vi.clearAllMocks();
    });

    // ── CRUD operations ───────────────────────────────────────────────────────

    describe('create()', () => {
        it('should delegate to createPromoCode with input and options', async () => {
            // Arrange
            const input = {
                code: 'SUMMER20',
                discountType: 'percentage' as const,
                discountValue: 20
            };
            const options = { livemode: true };
            const expected = { id: 'pc-1', code: 'SUMMER20' };
            mockCreatePromoCode.mockResolvedValue({ data: expected });

            // Act
            const result = await service.create(input, options);

            // Assert
            expect(mockCreatePromoCode).toHaveBeenCalledWith(input, options, undefined);
            expect(result).toEqual({ data: expected });
        });

        it('should pass ctx when provided', async () => {
            // Arrange
            const input = { code: 'X', discountType: 'fixed' as const, discountValue: 1000 };
            const ctx = { tx: {} as never };
            mockCreatePromoCode.mockResolvedValue({ data: null });

            // Act
            await service.create(input, {}, ctx);

            // Assert
            expect(mockCreatePromoCode).toHaveBeenCalledWith(input, {}, ctx);
        });
    });

    describe('getByCode()', () => {
        it('should delegate to getPromoCodeByCode with code and ctx', async () => {
            // Arrange
            const code = 'PROMO10';
            const expected = { data: { id: 'pc-2', code: 'PROMO10' } };
            mockGetPromoCodeByCode.mockResolvedValue(expected);

            // Act
            const result = await service.getByCode(code);

            // Assert
            expect(mockGetPromoCodeByCode).toHaveBeenCalledWith(code, undefined);
            expect(result).toEqual(expected);
        });
    });

    describe('getById()', () => {
        it('should delegate to getPromoCodeById with id', async () => {
            // Arrange
            const id = 'uuid-123';
            const expected = { data: { id, code: 'PROMO10' } };
            mockGetPromoCodeById.mockResolvedValue(expected);

            // Act
            const result = await service.getById(id);

            // Assert
            expect(mockGetPromoCodeById).toHaveBeenCalledWith(id, undefined);
            expect(result).toEqual(expected);
        });
    });

    describe('update()', () => {
        it('should delegate to updatePromoCode with id, input, and ctx', async () => {
            // Arrange
            const id = 'uuid-456';
            const input = { description: 'New desc', isActive: false, actorId: 'admin-1' };
            const expected = { data: { id, code: 'OLD', description: 'New desc' } };
            mockUpdatePromoCode.mockResolvedValue(expected);

            // Act
            const result = await service.update(id, input);

            // Assert
            expect(mockUpdatePromoCode).toHaveBeenCalledWith(id, input, undefined);
            expect(result).toEqual(expected);
        });
    });

    describe('delete()', () => {
        it('should delegate to deletePromoCode with id, ctx, and actorId', async () => {
            // Arrange
            const id = 'uuid-789';
            const actorId = 'admin-1';
            const ctx = { tx: {} as never };
            const expected = { data: { success: true } };
            mockDeletePromoCode.mockResolvedValue(expected);

            // Act
            const result = await service.delete(id, ctx, actorId);

            // Assert
            expect(mockDeletePromoCode).toHaveBeenCalledWith(id, ctx, actorId);
            expect(result).toEqual(expected);
        });
    });

    describe('list()', () => {
        it('should delegate to listPromoCodes with filters and ctx', async () => {
            // Arrange
            const filters = { active: true, page: 1, pageSize: 10 };
            const expected = { data: { items: [], total: 0, page: 1, pageSize: 10 } };
            mockListPromoCodes.mockResolvedValue(expected);

            // Act
            const result = await service.list(filters);

            // Assert
            expect(mockListPromoCodes).toHaveBeenCalledWith(filters, undefined);
            expect(result).toEqual(expected);
        });

        it('should use empty filters by default', async () => {
            // Arrange
            mockListPromoCodes.mockResolvedValue({ data: { items: [], total: 0 } });

            // Act
            await service.list();

            // Assert
            expect(mockListPromoCodes).toHaveBeenCalledWith({}, undefined);
        });
    });

    // ── Validation ────────────────────────────────────────────────────────────

    describe('validate()', () => {
        it('should delegate to validatePromoCode with code, context, and ctx', async () => {
            // Arrange
            const code = 'VALID10';
            const context = { userId: 'user-1', planId: 'plan-1', amount: 5000 };
            const expected = { valid: true, discountAmount: 500 };
            mockValidatePromoCode.mockResolvedValue(expected);

            // Act
            const result = await service.validate(code, context);

            // Assert
            expect(mockValidatePromoCode).toHaveBeenCalledWith(code, context, undefined);
            expect(result).toEqual(expected);
        });

        it('should return validation failure when code is invalid', async () => {
            // Arrange
            const expected = { valid: false, errorCode: 'EXPIRED', errorMessage: 'Code expired' };
            mockValidatePromoCode.mockResolvedValue(expected);

            // Act
            const result = await service.validate('EXPIRED_CODE', { userId: 'u-1' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('EXPIRED');
        });
    });

    // ── Redemption operations ─────────────────────────────────────────────────

    describe('apply()', () => {
        it('should delegate to applyPromoCode with all parameters', async () => {
            // Arrange
            const code = 'APPLY20';
            const customerId = 'cust-1';
            const amount = 10000;
            const options = { livemode: false };
            const expected = { data: { discountAmount: 2000, discountedTotal: 8000 } };
            mockApplyPromoCode.mockResolvedValue(expected);

            // Act
            const result = await service.apply(code, customerId, amount, options);

            // Assert
            expect(mockApplyPromoCode).toHaveBeenCalledWith(
                code,
                customerId,
                amount,
                options,
                undefined
            );
            expect(result).toEqual(expected);
        });
    });

    describe('incrementUsage()', () => {
        it('should delegate to incrementPromoCodeUsage with id and ctx', async () => {
            // Arrange
            const id = 'promo-uuid';
            const expected = { data: { id, timesRedeemed: 5 } };
            mockIncrementPromoCodeUsage.mockResolvedValue(expected);

            // Act
            const result = await service.incrementUsage(id);

            // Assert
            expect(mockIncrementPromoCodeUsage).toHaveBeenCalledWith(id, undefined);
            expect(result).toEqual(expected);
        });
    });

    describe('tryRedeemAtomically()', () => {
        it('should delegate to tryRedeemAtomically with promoCodeId', async () => {
            // Arrange
            const promoCodeId = 'promo-atomic';
            const expected = { data: { id: promoCodeId, timesRedeemed: 1 } };
            mockTryRedeemAtomically.mockResolvedValue(expected);

            // Act
            const result = await service.tryRedeemAtomically(promoCodeId);

            // Assert
            expect(mockTryRedeemAtomically).toHaveBeenCalledWith(promoCodeId);
            expect(result).toEqual(expected);
        });
    });

    describe('recordUsage()', () => {
        it('should delegate to recordPromoCodeUsage with data and ctx', async () => {
            // Arrange
            const data = {
                promoCodeId: 'pc-1',
                customerId: 'cust-1',
                currency: 'ARS',
                discountAmount: 500
            };
            const expected = { data: { id: 'usage-1', ...data } };
            mockRecordPromoCodeUsage.mockResolvedValue(expected);

            // Act
            const result = await service.recordUsage(data);

            // Assert
            expect(mockRecordPromoCodeUsage).toHaveBeenCalledWith(data, undefined);
            expect(result).toEqual(expected);
        });
    });

    describe('redeemAndRecord()', () => {
        it('should delegate to redeemAndRecordUsage with input', async () => {
            // Arrange
            const input = {
                promoCodeId: 'pc-1',
                customerId: 'cust-1',
                currency: 'ARS' as const,
                discountAmount: 1000
            };
            const expected = { data: { promoCode: {}, usageRecord: {} } };
            mockRedeemAndRecordUsage.mockResolvedValue(expected);

            // Act
            const result = await service.redeemAndRecord(input);

            // Assert
            expect(mockRedeemAndRecordUsage).toHaveBeenCalledWith(input);
            expect(result).toEqual(expected);
        });
    });
});
