import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @repo/db before importing the module under test
vi.mock('@repo/db', () => ({
    billingPromoCodeUsage: { id: 'id', customerId: 'customerId' },
    eq: vi.fn((_col: unknown, _val: unknown) => ({ _type: 'eq', _col, _val })),
    getDb: vi.fn()
}));

vi.mock('../../src/services/billing/promo-code/promo-code.crud.js', () => ({
    getPromoCodeByCode: vi.fn()
}));

import * as dbModule from '@repo/db';
import * as promoCrudModule from '../../src/services/billing/promo-code/promo-code.crud.js';
import { validatePromoCode } from '../../src/services/billing/promo-code/promo-code.validation.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;
const mockGetPromoCodeByCode = promoCrudModule.getPromoCodeByCode as ReturnType<typeof vi.fn>;

/** Builds a minimal valid active promo code with no restrictions. */
function buildActivePromoCode(overrides: Record<string, unknown> = {}) {
    return {
        id: 'pc1',
        code: 'SAVE10',
        type: 'percentage',
        value: 10,
        active: true,
        expiresAt: null,
        maxUses: null,
        timesRedeemed: 0,
        validPlans: null,
        newCustomersOnly: false,
        metadata: null,
        ...overrides
    };
}

/** Builds a mock Drizzle DB client whose select chain returns the given rows. */
function buildMockDb(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    return { select };
}

describe('validatePromoCode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Basic validation paths (no ctx)
    // ──────────────────────────────────────────────────────────────────────────

    describe('when called without ctx (backward compat)', () => {
        it('should return invalid when promo code is not found', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({ success: false });

            // Act
            const result = await validatePromoCode('INVALID', { userId: 'u1' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_NOT_FOUND');
        });

        it('should return invalid when promo code is inactive', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ active: false })
            });

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_INACTIVE');
        });

        it('should return invalid when promo code is expired', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ expiresAt: new Date('2000-01-01').toISOString() })
            });

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_EXPIRED');
        });

        it('should return invalid when max uses reached', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ maxUses: 5, timesRedeemed: 5 })
            });

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_MAX_USES');
        });

        it('should return invalid when plan restriction not met', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ validPlans: ['plan_pro'] })
            });

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1', planId: 'plan_free' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_PLAN_RESTRICTION');
        });

        it('should return invalid when new-customers-only and user has prior usage', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ newCustomersOnly: true })
            });
            mockGetDb.mockReturnValue(buildMockDb([{ id: 'u1' }]));

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_NEW_USERS_ONLY');
            expect(mockGetDb).toHaveBeenCalled();
        });

        it('should return invalid when amount is below minimum', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ metadata: { minAmount: 1000 } })
            });

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1', amount: 500 });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_MIN_AMOUNT');
        });

        it('should return valid with percentage discount when all checks pass', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ type: 'percentage', value: 10 })
            });

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1', amount: 5000 });

            // Assert
            expect(result.valid).toBe(true);
            expect(result.discountAmount).toBe(500);
        });

        it('should return valid with fixed discount capped at amount', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ type: 'fixed', value: 200 })
            });

            // Act
            const result = await validatePromoCode('FLAT200', { userId: 'u1', amount: 100 });

            // Assert
            expect(result.valid).toBe(true);
            expect(result.discountAmount).toBe(100); // capped at original amount
        });

        it('should return valid without discountAmount when amount is not provided', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode()
            });

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1' });

            // Assert
            expect(result.valid).toBe(true);
            expect(result.discountAmount).toBeUndefined();
        });

        it('should return validation error when an unexpected exception is thrown', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockRejectedValue(new Error('unexpected'));

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_VALIDATION_ERROR');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // ctx.tx routing — core SPEC-064 requirement
    // ──────────────────────────────────────────────────────────────────────────

    describe('when ctx with tx is provided', () => {
        it('should route the DB call through ctx.tx instead of getDb()', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ newCustomersOnly: true })
            });

            const txMock = buildMockDb([{ id: 'usage1' }]);
            const ctx = { tx: txMock as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1' }, ctx);

            // Assert: tx was used, getDb was NOT called
            expect(txMock.select).toHaveBeenCalled();
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_NEW_USERS_ONLY');
        });

        it('should pass validation when ctx.tx reports no prior usage', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ newCustomersOnly: true })
            });

            const txMock = buildMockDb([]); // no prior usage
            const ctx = { tx: txMock as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1' }, ctx);

            // Assert
            expect(txMock.select).toHaveBeenCalled();
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(result.valid).toBe(true);
        });

        it('should not call getDb nor tx when newCustomersOnly is false', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ newCustomersOnly: false })
            });

            const txMock = buildMockDb([]);
            const ctx = { tx: txMock as unknown as import('@repo/db').DrizzleClient };

            // Act
            await validatePromoCode('SAVE10', { userId: 'u1' }, ctx);

            // Assert: no DB access at all for the newCustomersOnly check
            expect(txMock.select).not.toHaveBeenCalled();
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // ctx without tx — falls back to getDb()
    // ──────────────────────────────────────────────────────────────────────────

    describe('when ctx is provided but tx is undefined', () => {
        it('should fall back to getDb() when ctx.tx is undefined', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: buildActivePromoCode({ newCustomersOnly: true })
            });
            mockGetDb.mockReturnValue(buildMockDb([]));

            const ctx = { tx: undefined };

            // Act
            const result = await validatePromoCode('SAVE10', { userId: 'u1' }, ctx);

            // Assert
            expect(mockGetDb).toHaveBeenCalled();
            expect(result.valid).toBe(true);
        });
    });
});
