/**
 * Tests for limit-check utility
 */

import { LimitKey } from '@repo/billing';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';
import { checkLimit } from '../../src/utils/limit-check';

// Mock getRemainingLimit
vi.mock('../../src/middlewares/entitlement', () => ({
    getRemainingLimit: vi.fn()
}));

import { getRemainingLimit } from '../../src/middlewares/entitlement';

describe('checkLimit', () => {
    const createMockContext = (limit: number): Context<AppBindings> => {
        const mockContext = {
            get: vi.fn().mockReturnValue(limit)
        } as unknown as Context<AppBindings>;

        // Mock getRemainingLimit to return the specified limit
        vi.mocked(getRemainingLimit).mockReturnValue(limit);

        return mockContext;
    };

    describe('unlimited scenarios', () => {
        it('should allow when limit is -1 (unlimited)', () => {
            const context = createMockContext(-1);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount: 100
            });

            expect(result.allowed).toBe(true);
            expect(result.maxAllowed).toBe(-1);
            expect(result.remaining).toBe(-1);
            expect(result.upgradeMessage).toBeUndefined();
        });

        it('should return correct data for unlimited plan', () => {
            const context = createMockContext(-1);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                currentCount: 50
            });

            expect(result).toEqual({
                allowed: true,
                currentCount: 50,
                maxAllowed: -1,
                remaining: -1
            });
        });
    });

    describe('disabled feature scenarios', () => {
        it('should block when limit is 0 (feature disabled)', () => {
            const context = createMockContext(0);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACTIVE_PROMOTIONS,
                currentCount: 0
            });

            expect(result.allowed).toBe(false);
            expect(result.maxAllowed).toBe(0);
            expect(result.remaining).toBe(0);
            expect(result.upgradeMessage).toContain('no está disponible en tu plan actual');
        });

        it('should provide correct message for disabled feature', () => {
            const context = createMockContext(0);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount: 0
            });

            expect(result.upgradeMessage).toBe(
                'Esta funcionalidad no está disponible en tu plan actual. Actualiza tu plan para poder usar alojamientos.'
            );
        });
    });

    describe('under limit scenarios', () => {
        it('should allow when under limit', () => {
            const context = createMockContext(5);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount: 3
            });

            expect(result.allowed).toBe(true);
            expect(result.maxAllowed).toBe(5);
            expect(result.remaining).toBe(2);
            expect(result.upgradeMessage).toBeUndefined();
        });

        it('should calculate remaining correctly', () => {
            const context = createMockContext(10);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                currentCount: 7
            });

            expect(result.remaining).toBe(3);
        });

        it('should allow when at 0 usage', () => {
            const context = createMockContext(5);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount: 0
            });

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(5);
        });
    });

    describe('at limit scenarios', () => {
        it('should block when at limit', () => {
            const context = createMockContext(5);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount: 5
            });

            expect(result.allowed).toBe(false);
            expect(result.maxAllowed).toBe(5);
            expect(result.remaining).toBe(0);
            expect(result.upgradeMessage).toContain('Has alcanzado el límite de 5 alojamientos');
        });

        it('should provide upgrade message when limit reached', () => {
            const context = createMockContext(3);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACTIVE_PROMOTIONS,
                currentCount: 3
            });

            expect(result.upgradeMessage).toBe(
                'Has alcanzado el límite de 3 promociones activas. Actualiza tu plan para obtener más.'
            );
        });

        it('should block when over limit', () => {
            const context = createMockContext(5);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount: 6
            });

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });
    });

    describe('different limit keys', () => {
        it('should handle max_accommodations', () => {
            const context = createMockContext(5);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount: 5
            });

            expect(result.upgradeMessage).toContain('alojamientos');
        });

        it('should handle max_photos_per_accommodation', () => {
            const context = createMockContext(10);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                currentCount: 10
            });

            expect(result.upgradeMessage).toContain('fotos por alojamiento');
        });

        it('should handle max_active_promotions', () => {
            const context = createMockContext(3);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACTIVE_PROMOTIONS,
                currentCount: 3
            });

            expect(result.upgradeMessage).toContain('promociones activas');
        });

        it('should handle max_favorites', () => {
            const context = createMockContext(20);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_FAVORITES,
                currentCount: 20
            });

            expect(result.upgradeMessage).toContain('favoritos');
        });
    });

    describe('edge cases', () => {
        it('should handle limit of 1', () => {
            const context = createMockContext(1);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount: 0
            });

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(1);
        });

        it('should block when at limit of 1', () => {
            const context = createMockContext(1);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount: 1
            });

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });

        it('should handle very large limits', () => {
            const context = createMockContext(1000000);
            const result = checkLimit({
                context,
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                currentCount: 500000
            });

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(500000);
        });
    });
});
