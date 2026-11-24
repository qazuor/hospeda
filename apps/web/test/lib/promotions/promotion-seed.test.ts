/**
 * HOS-2589 D-7 / AC-30: the session-stable pick seed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    getPromotionSeed,
    PROMOTION_SEED_PREFIX
} from '../../../src/lib/promotions/promotion-seed';

afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
});

describe('getPromotionSeed', () => {
    it('returns the same seed for a context within the session', () => {
        const first = getPromotionSeed({ context: 'venue:1' });
        const second = getPromotionSeed({ context: 'venue:1' });
        expect(second.seed).toBe(first.seed);
        expect(first.seed).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
        expect(sessionStorage.getItem(`${PROMOTION_SEED_PREFIX}venue:1`)).toBe(first.seed);
    });

    it('keeps independent seeds per context', () => {
        expect(getPromotionSeed({ context: 'listing' }).seed).not.toBe(
            getPromotionSeed({ context: 'accommodation:9' }).seed
        );
    });

    it('renews the seed in a new session (empty storage)', () => {
        const first = getPromotionSeed({ context: 'listing' });
        sessionStorage.clear();
        expect(getPromotionSeed({ context: 'listing' }).seed).not.toBe(first.seed);
    });

    it('replaces a stored value that is not a valid seed', () => {
        sessionStorage.setItem(`${PROMOTION_SEED_PREFIX}listing`, 'bad seed!');
        expect(getPromotionSeed({ context: 'listing' }).seed).toMatch(/^[0-9a-f]{32}$/);
    });

    it('falls back to memory when sessionStorage throws, still stable', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const first = getPromotionSeed({ context: 'memory-only' });
        const second = getPromotionSeed({ context: 'memory-only' });
        expect(second.seed).toBe(first.seed);
    });
});
