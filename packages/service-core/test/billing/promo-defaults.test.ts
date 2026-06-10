/**
 * Unit tests for promo-code-defaults.ts (SPEC-192 T-029)
 *
 * Verifies startup idempotency: calling `ensureDefaultPromoCodes` multiple
 * times does NOT duplicate codes. Each code is only created when it is
 * absent (skip-by-code behaviour).
 *
 * Mock strategy: `PromoCodeService` is mocked at the module level via
 * vi.mock so `ensureDefaultPromoCodes` (which constructs `new PromoCodeService()`)
 * gets the mock instance. Unique IDs are used across tests to avoid
 * cross-contamination from module-level Maps that survive between tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mock handles ─────────────────────────────────────────────────

const mockGetByCode = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../src/services/billing/promo-code/promo-code.service.js', () => ({
    PromoCodeService: vi.fn().mockImplementation(() => ({
        getByCode: mockGetByCode,
        create: mockCreate
    }))
    // Re-export types and other symbols the module uses (none required for this test)
}));

// Import under test AFTER mocks are registered
import {
    ensureDefaultPromoCodes,
    getDefaultPromoCodeConfigs
} from '../../src/services/billing/promo-code/promo-code-defaults.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns a successful `getByCode` result (code already exists).
 */
function foundResult(code: string) {
    return {
        success: true as const,
        data: { id: `id-${code}`, code }
    };
}

/**
 * Returns a not-found `getByCode` result (code is absent).
 */
function notFoundResult() {
    return {
        success: false as const,
        error: { code: 'NOT_FOUND', message: 'Promo code not found' }
    };
}

/**
 * Returns a successful `create` result.
 */
function createdResult(code: string) {
    return {
        success: true as const,
        data: { id: `new-id-${code}`, code }
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('ensureDefaultPromoCodes (SPEC-192 T-029)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('idempotency: running twice does not duplicate codes', () => {
        it('should skip creation on second call when all codes already exist', async () => {
            // Arrange — all codes already present after first successful run
            const configs = getDefaultPromoCodeConfigs();
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(foundResult(cfg.code));
            }
            // Second call: same, all still present
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(foundResult(cfg.code));
            }

            // Act
            await ensureDefaultPromoCodes();
            await ensureDefaultPromoCodes();

            // Assert
            expect(mockCreate).not.toHaveBeenCalled();
            expect(mockGetByCode).toHaveBeenCalledTimes(configs.length * 2);
        });

        it('should create once then skip on subsequent call', async () => {
            // Arrange — first call: all absent → created; second call: all present → skipped
            const configs = getDefaultPromoCodeConfigs();
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(notFoundResult());
                mockCreate.mockResolvedValueOnce(createdResult(cfg.code));
            }
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(foundResult(cfg.code));
            }

            // Act
            await ensureDefaultPromoCodes();
            await ensureDefaultPromoCodes();

            // Assert — created exactly once per default code
            expect(mockCreate).toHaveBeenCalledTimes(configs.length);
        });
    });

    describe('skip-by-code: existing code is never recreated', () => {
        it('should not call create when getByCode returns success', async () => {
            // Arrange
            const configs = getDefaultPromoCodeConfigs();
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(foundResult(cfg.code));
            }

            // Act
            await ensureDefaultPromoCodes();

            // Assert
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it('should call create for each absent code', async () => {
            // Arrange
            const configs = getDefaultPromoCodeConfigs();
            for (const cfg of configs) {
                mockGetByCode.mockResolvedValueOnce(notFoundResult());
                mockCreate.mockResolvedValueOnce(createdResult(cfg.code));
            }

            // Act
            await ensureDefaultPromoCodes();

            // Assert
            expect(mockCreate).toHaveBeenCalledTimes(configs.length);
            for (const cfg of configs) {
                expect(mockGetByCode).toHaveBeenCalledWith(cfg.code);
            }
        });
    });

    describe('error resilience', () => {
        it('should not throw when getByCode rejects', async () => {
            // Arrange — simulate DB connectivity issue on every code
            const configs = getDefaultPromoCodeConfigs();
            for (let i = 0; i < configs.length; i++) {
                mockGetByCode.mockRejectedValueOnce(new Error('connection refused'));
            }

            // Act + Assert
            await expect(ensureDefaultPromoCodes()).resolves.not.toThrow();
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it('should continue processing remaining codes after a failure', async () => {
            // Arrange — first code throws, second is absent and gets created
            const configs = getDefaultPromoCodeConfigs();
            if (configs.length < 2) return; // guard for future config changes

            mockGetByCode.mockRejectedValueOnce(new Error('DB error on first code'));
            // Remaining codes: all absent
            for (let i = 1; i < configs.length; i++) {
                mockGetByCode.mockResolvedValueOnce(notFoundResult());
                mockCreate.mockResolvedValueOnce(createdResult(configs[i]?.code ?? 'unknown'));
            }

            // Act
            await ensureDefaultPromoCodes();

            // Assert — create was called for the non-failing codes
            expect(mockCreate).toHaveBeenCalledTimes(configs.length - 1);
        });
    });

    describe('getDefaultPromoCodeConfigs', () => {
        it('should return a non-empty readonly array', () => {
            const configs = getDefaultPromoCodeConfigs();
            expect(Array.isArray(configs)).toBe(true);
            expect(configs.length).toBeGreaterThan(0);
        });

        it('should include HOSPEDA_FREE with 100% percentage discount', () => {
            const configs = getDefaultPromoCodeConfigs();
            const free = configs.find((c) => c.code === 'HOSPEDA_FREE');
            expect(free).toBeDefined();
            expect(free?.discountType).toBe('percentage');
            expect(free?.discountValue).toBe(100);
            expect(free?.isActive).toBe(true);
        });

        it('should return the same reference on repeated calls (stable config)', () => {
            // Verifies the const is not re-created per call
            expect(getDefaultPromoCodeConfigs()).toBe(getDefaultPromoCodeConfigs());
        });
    });
});
