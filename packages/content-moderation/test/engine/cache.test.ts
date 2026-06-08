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
