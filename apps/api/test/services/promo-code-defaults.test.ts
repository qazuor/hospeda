/**
 * Promo Code Defaults Tests
 *
 * HOS-1171 rewrote this file. Every assertion it used to make was about
 * `HOSPEDA_FREE`: that the startup path includes it, configures it with
 * unlimited uses and no restrictions, and creates it when missing. All of that
 * was true, and all of it was the vulnerability written down as a contract — a
 * permanent, uncapped, `livemode`-unscoped comp code that anyone who learned the
 * string could redeem for a never-billed subscription.
 *
 * The startup path was the THIRD place that created it, after the seed baseline
 * and the seeded row, and it is the one that would have quietly restored the
 * code on every fresh database. So what is asserted now is the opposite: the
 * startup list is empty, and `ensureDefaultPromoCodes` therefore writes nothing.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { getDefaultPromoCodeConfigs } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the PromoCodeService at the source module inside service-core.
// vi.mock is hoisted, so we cannot use variables for the path.
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

/**
 * The startup list is empty (HOS-1171), so any test that drives
 * `ensureDefaultPromoCodes` by LOOPING over it runs zero iterations and passes
 * for the wrong reason. Those are skipped rather than counted as coverage; the
 * assertions about the list itself, and the one that pins "nothing is written",
 * stay unconditional because emptiness is exactly what they assert.
 *
 * `it.skipIf` and not a hard `.skip`: CI forbids a hard-coded skip, and the
 * condition IS the fact worth showing in the runner output.
 */
const DEFAULTS_ARE_EMPTY = getDefaultPromoCodeConfigs().length === 0;

describe('PromoCodeDefaults', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getDefaultPromoCodeConfigs', () => {
        it('should return an array', () => {
            const configs = getDefaultPromoCodeConfigs();

            expect(configs).toBeDefined();
            expect(Array.isArray(configs)).toBe(true);
        });

        it('HOS-1171: no longer creates HOSPEDA_FREE at startup', () => {
            const configs = getDefaultPromoCodeConfigs();

            expect(configs.find((config) => config.code === 'HOSPEDA_FREE')).toBeUndefined();
        });

        it('HOS-1171: creates NO 100%-discount code at startup', () => {
            // Broader than the name check above on purpose. The hole was a
            // startup-created code that costs the customer nothing; renaming
            // HOSPEDA_FREE would reopen it while leaving the previous assertion
            // green.
            const configs = getDefaultPromoCodeConfigs();

            expect(
                configs.filter(
                    (config) => config.discountType === 'percentage' && config.discountValue === 100
                )
            ).toEqual([]);
        });
    });

    describe('ensureDefaultPromoCodes', () => {
        it('HOS-1171: writes nothing, because there is nothing to ensure', async () => {
            mockGetByCode.mockResolvedValue({
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Promo code not found'
                }
            });

            await ensureDefaultPromoCodes();

            // The `getByCode` assertion is the load-bearing one: it fails if a
            // default is re-added even when the create mock happens to be lenient.
            expect(mockGetByCode).not.toHaveBeenCalled();
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it.skipIf(DEFAULTS_ARE_EMPTY)('should be safe to call multiple times', async () => {
            await expect(ensureDefaultPromoCodes()).resolves.not.toThrow();
            await expect(ensureDefaultPromoCodes()).resolves.not.toThrow();

            expect(mockCreate).not.toHaveBeenCalled();
        });

        it.skipIf(DEFAULTS_ARE_EMPTY)(
            'should process exactly the configured defaults',
            async () => {
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
            }
        );
    });
});
