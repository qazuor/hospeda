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
import { ensureDefaultPromoCodes, getDefaultPromoCodeConfigs } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromoCodeService } from '../../src/services/promo-code.service';

// Mock the PromoCodeService
vi.mock('../../src/services/promo-code.service', () => {
    return {
        PromoCodeService: vi.fn()
    };
});

// Mock the logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));

describe('PromoCodeDefaults', () => {
    let mockPromoCodeService: {
        getByCode: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create mock service methods
        mockPromoCodeService = {
            getByCode: vi.fn(),
            create: vi.fn()
        };

        // Mock the PromoCodeService constructor to return our mock
        vi.mocked(PromoCodeService).mockImplementation(() => {
            return mockPromoCodeService as unknown as PromoCodeService;
        });
    });

    describe('getDefaultPromoCodeConfigs', () => {
        it('should return array of default promo code configurations', () => {
            // Act
            const configs = getDefaultPromoCodeConfigs();

            // Assert
            expect(configs).toBeDefined();
            expect(Array.isArray(configs)).toBe(true);
            expect(configs.length).toBeGreaterThan(0);
        });

        it('should include HOSPEDA_FREE configuration', () => {
            // Act
            const configs = getDefaultPromoCodeConfigs();

            // Assert
            const hospedaFree = configs.find((config) => config.code === 'HOSPEDA_FREE');
            expect(hospedaFree).toBeDefined();
            expect(hospedaFree?.discountType).toBe('percentage');
            expect(hospedaFree?.discountValue).toBe(100);
            expect(hospedaFree?.isActive).toBe(true);
        });

        it('should configure HOSPEDA_FREE with unlimited uses', () => {
            // Act
            const configs = getDefaultPromoCodeConfigs();
            const hospedaFree = configs.find((config) => config.code === 'HOSPEDA_FREE');

            // Assert
            expect(hospedaFree?.maxUses).toBeUndefined();
            expect(hospedaFree?.expiryDate).toBeUndefined();
        });

        it('should configure HOSPEDA_FREE with no restrictions', () => {
            // Act
            const configs = getDefaultPromoCodeConfigs();
            const hospedaFree = configs.find((config) => config.code === 'HOSPEDA_FREE');

            // Assert
            expect(hospedaFree?.planRestrictions).toBeUndefined();
            expect(hospedaFree?.firstPurchaseOnly).toBe(false);
            expect(hospedaFree?.minAmount).toBeUndefined();
        });
    });

    describe('ensureDefaultPromoCodes', () => {
        it('should create HOSPEDA_FREE when it does not exist', async () => {
            // Arrange - code doesn't exist
            mockPromoCodeService.getByCode.mockResolvedValue({
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Promo code not found'
                }
            });

            mockPromoCodeService.create.mockResolvedValue({
                success: true,
                data: {
                    id: 'promo_123',
                    code: 'HOSPEDA_FREE',
                    type: 'percentage',
                    value: 100,
                    active: true,
                    timesRedeemed: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            });

            // Act
            await ensureDefaultPromoCodes();

            // Assert
            expect(mockPromoCodeService.getByCode).toHaveBeenCalledWith('HOSPEDA_FREE');
            expect(mockPromoCodeService.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'HOSPEDA_FREE',
                    discountType: 'percentage',
                    discountValue: 100,
                    isActive: true
                })
            );
        });

        it('should skip creation when HOSPEDA_FREE already exists', async () => {
            // Arrange - code already exists
            mockPromoCodeService.getByCode.mockResolvedValue({
                success: true,
                data: {
                    id: 'promo_existing',
                    code: 'HOSPEDA_FREE',
                    type: 'percentage',
                    value: 100,
                    active: true,
                    timesRedeemed: 5,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            });

            // Act
            await ensureDefaultPromoCodes();

            // Assert
            expect(mockPromoCodeService.getByCode).toHaveBeenCalledWith('HOSPEDA_FREE');
            expect(mockPromoCodeService.create).not.toHaveBeenCalled();
        });

        it('should handle creation errors gracefully', async () => {
            // Arrange - code doesn't exist but creation fails
            mockPromoCodeService.getByCode.mockResolvedValue({
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Promo code not found'
                }
            });

            mockPromoCodeService.create.mockResolvedValue({
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to create promo code'
                }
            });

            // Act & Assert - should not throw
            await expect(ensureDefaultPromoCodes()).resolves.not.toThrow();

            expect(mockPromoCodeService.create).toHaveBeenCalled();
        });

        it('should handle getByCode errors gracefully', async () => {
            // Arrange - getByCode throws error
            mockPromoCodeService.getByCode.mockRejectedValue(
                new Error('Database connection error')
            );

            // Act & Assert - should not throw
            await expect(ensureDefaultPromoCodes()).resolves.not.toThrow();

            expect(mockPromoCodeService.create).not.toHaveBeenCalled();
        });

        it('should be idempotent - safe to call multiple times', async () => {
            // Arrange - first call: code doesn't exist
            mockPromoCodeService.getByCode.mockResolvedValueOnce({
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Promo code not found'
                }
            });

            mockPromoCodeService.create.mockResolvedValueOnce({
                success: true,
                data: {
                    id: 'promo_123',
                    code: 'HOSPEDA_FREE',
                    type: 'percentage',
                    value: 100,
                    active: true,
                    timesRedeemed: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            });

            // Second call: code now exists
            mockPromoCodeService.getByCode.mockResolvedValueOnce({
                success: true,
                data: {
                    id: 'promo_123',
                    code: 'HOSPEDA_FREE',
                    type: 'percentage',
                    value: 100,
                    active: true,
                    timesRedeemed: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            });

            // Act - call twice
            await ensureDefaultPromoCodes();
            await ensureDefaultPromoCodes();

            // Assert - create should only be called once
            expect(mockPromoCodeService.create).toHaveBeenCalledTimes(1);
            expect(mockPromoCodeService.getByCode).toHaveBeenCalledTimes(2);
        });

        it('should process all default codes', async () => {
            // Arrange
            const configs = getDefaultPromoCodeConfigs();

            mockPromoCodeService.getByCode.mockResolvedValue({
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Promo code not found'
                }
            });

            mockPromoCodeService.create.mockResolvedValue({
                success: true,
                data: {
                    id: 'promo_123',
                    code: 'TEST',
                    type: 'percentage',
                    value: 100,
                    active: true,
                    timesRedeemed: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            });

            // Act
            await ensureDefaultPromoCodes();

            // Assert - should check for each code
            expect(mockPromoCodeService.getByCode).toHaveBeenCalledTimes(configs.length);
            expect(mockPromoCodeService.create).toHaveBeenCalledTimes(configs.length);
        });
    });
});
