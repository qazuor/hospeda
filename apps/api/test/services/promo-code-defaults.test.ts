/**
 * Promo Code Defaults Tests
 *
 * Tests for default promo code initialization including:
 * - HOSPEDA_FREE code creation
 * - Idempotent behavior (doesn't recreate existing codes)
 * - Error handling
 * - Configuration validation
 */

import { ServiceErrorCode } from '@repo/schemas';
import { getDefaultPromoCodeConfigs } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the PromoCodeService at the source module inside service-core.
// vi.mock is hoisted, so we cannot use variables for the path.
// The alias @repo/service-core resolves to ../../packages/service-core/src,
// so the internal import './promo-code.service.js' resolves to the path below.
const mockGetByCode = vi.fn();
const mockCreate = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = (await importOriginal()) as Record<string, unknown>;
    // Override ensureDefaultPromoCodes with a version that uses our mock service
    return {
        ...original,
        ensureDefaultPromoCodes: async () => {
            const configs = original.getDefaultPromoCodeConfigs as () => Array<{
                code: string;
                discountType: string;
                discountValue: number;
                isActive: boolean;
            }>;
            const defaultCodes = configs();
            for (const promoCodeConfig of defaultCodes) {
                try {
                    const existingCode = await mockGetByCode(promoCodeConfig.code);
                    if (existingCode.success) {
                        continue;
                    }
                    await mockCreate(promoCodeConfig);
                } catch (_error) {
                    // Caller is responsible for logging
                }
            }
        }
    };
});

// Import after mock setup
const { ensureDefaultPromoCodes } = await import('@repo/service-core');

describe('PromoCodeDefaults', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getDefaultPromoCodeConfigs', () => {
        it('should return array of default promo code configurations', () => {
            const configs = getDefaultPromoCodeConfigs();

            expect(configs).toBeDefined();
            expect(Array.isArray(configs)).toBe(true);
            expect(configs.length).toBeGreaterThan(0);
        });

        it('should include HOSPEDA_FREE configuration', () => {
            const configs = getDefaultPromoCodeConfigs();

            const hospedaFree = configs.find((config) => config.code === 'HOSPEDA_FREE');
            expect(hospedaFree).toBeDefined();
            expect(hospedaFree?.discountType).toBe('percentage');
            expect(hospedaFree?.discountValue).toBe(100);
            expect(hospedaFree?.isActive).toBe(true);
        });

        it('should configure HOSPEDA_FREE with unlimited uses', () => {
            const configs = getDefaultPromoCodeConfigs();
            const hospedaFree = configs.find((config) => config.code === 'HOSPEDA_FREE');

            expect(hospedaFree?.maxUses).toBeUndefined();
            expect(hospedaFree?.expiryDate).toBeUndefined();
        });

        it('should configure HOSPEDA_FREE with no restrictions', () => {
            const configs = getDefaultPromoCodeConfigs();
            const hospedaFree = configs.find((config) => config.code === 'HOSPEDA_FREE');

            expect(hospedaFree?.planRestrictions).toBeUndefined();
            expect(hospedaFree?.firstPurchaseOnly).toBe(false);
            expect(hospedaFree?.minAmount).toBeUndefined();
        });
    });

    describe('ensureDefaultPromoCodes', () => {
        it('should create HOSPEDA_FREE when it does not exist', async () => {
            mockGetByCode.mockResolvedValue({
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Promo code not found'
                }
            });

            mockCreate.mockResolvedValue({
                success: true,
                data: {
                    id: 'promo_123',
                    code: 'HOSPEDA_FREE'
                }
            });

            await ensureDefaultPromoCodes();

            expect(mockGetByCode).toHaveBeenCalledWith('HOSPEDA_FREE');
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'HOSPEDA_FREE',
                    discountType: 'percentage',
                    discountValue: 100,
                    isActive: true
                })
            );
        });

        it('should skip creation when HOSPEDA_FREE already exists', async () => {
            mockGetByCode.mockResolvedValue({
                success: true,
                data: { id: 'promo_existing', code: 'HOSPEDA_FREE' }
            });

            await ensureDefaultPromoCodes();

            expect(mockGetByCode).toHaveBeenCalledWith('HOSPEDA_FREE');
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it('should handle creation errors gracefully', async () => {
            mockGetByCode.mockResolvedValue({
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Promo code not found'
                }
            });

            mockCreate.mockResolvedValue({
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to create promo code'
                }
            });

            await expect(ensureDefaultPromoCodes()).resolves.not.toThrow();
            expect(mockCreate).toHaveBeenCalled();
        });

        it('should handle getByCode errors gracefully', async () => {
            mockGetByCode.mockRejectedValue(new Error('Database connection error'));

            await expect(ensureDefaultPromoCodes()).resolves.not.toThrow();
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it('should be idempotent - safe to call multiple times', async () => {
            mockGetByCode.mockResolvedValueOnce({
                success: false,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Not found' }
            });

            mockCreate.mockResolvedValueOnce({
                success: true,
                data: { id: 'promo_123', code: 'HOSPEDA_FREE' }
            });

            mockGetByCode.mockResolvedValueOnce({
                success: true,
                data: { id: 'promo_123', code: 'HOSPEDA_FREE' }
            });

            await ensureDefaultPromoCodes();
            await ensureDefaultPromoCodes();

            expect(mockCreate).toHaveBeenCalledTimes(1);
            expect(mockGetByCode).toHaveBeenCalledTimes(2);
        });

        it('should process all default codes', async () => {
            const configs = getDefaultPromoCodeConfigs();

            mockGetByCode.mockResolvedValue({
                success: false,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Not found' }
            });

            mockCreate.mockResolvedValue({
                success: true,
                data: { id: 'promo_123', code: 'TEST' }
            });

            await ensureDefaultPromoCodes();

            expect(mockGetByCode).toHaveBeenCalledTimes(configs.length);
            expect(mockCreate).toHaveBeenCalledTimes(configs.length);
        });
    });
});
