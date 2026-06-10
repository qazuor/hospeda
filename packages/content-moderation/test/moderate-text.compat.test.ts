import { describe, expect, it } from 'vitest';
import * as publicApi from '../src/index.js';

describe('SPEC-195 public moderation API compatibility', () => {
    it('preserves the frozen API plus the reject threshold and cache-invalidation exports', async () => {
        expect(Object.keys(publicApi).sort()).toEqual([
            'MODERATION_PENDING_THRESHOLD',
            'MODERATION_REJECT_THRESHOLD',
            'invalidateModerationCache',
            'invalidateModerationCacheByTermPattern',
            'moderateText',
            'moderateTextInputSchema'
        ]);

        expect(publicApi.MODERATION_PENDING_THRESHOLD).toBe(0.5);
        expect(publicApi.MODERATION_REJECT_THRESHOLD).toBe(0.85);

        const result = await publicApi.moderateText({ text: 'compat input', context: 'review' });
        expect(Object.keys(result).sort()).toEqual(['categories', 'matchedTerms', 'score']);
        expect(Object.keys(result.categories).sort()).toEqual([
            'harassment',
            'hate',
            'other',
            'sexual',
            'spam',
            'violence'
        ]);
    });
});
