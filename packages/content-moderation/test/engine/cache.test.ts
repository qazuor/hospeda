import { describe, expect, it } from 'vitest';
import {
    createModerationCacheKey,
    getCachedModerationResult,
    getModerationCacheHealth,
    initializeModerationCache,
    invalidateModerationCache,
    invalidateModerationCacheByTermPattern,
    setCachedModerationResult
} from '../../src/engine/cache.js';

describe('moderation cache', () => {
    it('uses sha256(text).slice(0, 16) keys', () => {
        expect(createModerationCacheKey('hello world')).toHaveLength(16);
        expect(createModerationCacheKey('hello world')).toBe(
            createModerationCacheKey('hello world')
        );
    });

    it('differentiates cache keys by context — same text, different context is a miss', () => {
        initializeModerationCache(300);
        invalidateModerationCache();

        const result = {
            source: 'stub' as const,
            score: 0.9,
            categories: Object.freeze({
                spam: 0,
                sexual: 0,
                violence: 0,
                hate: 0,
                harassment: 0.9,
                other: 0
            }),
            matchedTerms: Object.freeze(['badword'])
        };

        // Store under context 'review'
        setCachedModerationResult('some text', result, 'review');

        // Hit with the same context
        expect(getCachedModerationResult('some text', 'review')?.score).toBe(0.9);

        // Miss with a different context
        expect(getCachedModerationResult('some text', 'message')).toBeNull();

        // Miss with no context at all
        expect(getCachedModerationResult('some text')).toBeNull();
    });

    it('produces distinct keys for same text with different contexts', () => {
        const keyNoCtx = createModerationCacheKey('hello');
        const keyReview = createModerationCacheKey('hello', 'review');
        const keyMessage = createModerationCacheKey('hello', 'message');

        expect(keyNoCtx).not.toBe(keyReview);
        expect(keyNoCtx).not.toBe(keyMessage);
        expect(keyReview).not.toBe(keyMessage);
    });

    it('stores and invalidates cached results by term pattern', () => {
        initializeModerationCache(300);
        setCachedModerationResult('contains badword', {
            source: 'stub',
            score: 1,
            categories: Object.freeze({
                spam: 0,
                sexual: 0,
                violence: 0,
                hate: 0,
                harassment: 0,
                other: 1
            }),
            matchedTerms: Object.freeze(['badword'])
        });

        expect(getCachedModerationResult('contains badword')?.score).toBe(1);
        invalidateModerationCacheByTermPattern('badword');
        expect(getCachedModerationResult('contains badword')).toBeNull();
    });

    it('reports cache health stats', () => {
        initializeModerationCache(300);
        invalidateModerationCache();
        setCachedModerationResult('clean', {
            source: 'stub',
            score: 0,
            categories: Object.freeze({
                spam: 0,
                sexual: 0,
                violence: 0,
                hate: 0,
                harassment: 0,
                other: 0
            }),
            matchedTerms: Object.freeze([])
        });

        expect(getCachedModerationResult('clean')?.score).toBe(0);
        getCachedModerationResult('miss');
        const health = getModerationCacheHealth();

        expect(health.cacheSize).toBeGreaterThanOrEqual(1);
        expect(health.hitsLastHour).toBeGreaterThanOrEqual(1);
        expect(health.missesLastHour).toBeGreaterThanOrEqual(1);
    });
});
