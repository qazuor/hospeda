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
        // `degraded` joined the shape in HOS-1069: consumers must be able to
        // tell "the engine judged this and it is clean" from "the engine could
        // not judge it", which the score alone cannot express.
        expect(Object.keys(result).sort()).toEqual([
            'categories',
            'degraded',
            'matchedTerms',
            'score'
        ]);
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
