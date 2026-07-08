import { describe, expect, it } from 'vitest';
import type { AiFeatureId } from '@/features/ai-settings';
import {
    isPlaygroundSupportedFeature,
    PLAYGROUND_SUPPORTED_FEATURES,
    PLAYGROUND_UNSUPPORTED_REASON
} from '../-components/playground-features.utils';

const ALL_FEATURES: AiFeatureId[] = [
    'text_improve',
    'chat',
    'search',
    'support',
    'translate',
    'accommodation_import',
    'post_generate'
];

describe('playground-features.utils', () => {
    describe('PLAYGROUND_SUPPORTED_FEATURES', () => {
        it('supports only chat and search', () => {
            expect([...PLAYGROUND_SUPPORTED_FEATURES].sort()).toEqual(['chat', 'search']);
        });
    });

    describe('isPlaygroundSupportedFeature', () => {
        it('returns true for chat and search', () => {
            expect(isPlaygroundSupportedFeature('chat')).toBe(true);
            expect(isPlaygroundSupportedFeature('search')).toBe(true);
        });

        it('returns false for every other feature', () => {
            for (const f of ALL_FEATURES.filter((x) => x !== 'chat' && x !== 'search')) {
                expect(isPlaygroundSupportedFeature(f)).toBe(false);
            }
        });
    });

    describe('PLAYGROUND_UNSUPPORTED_REASON', () => {
        it('has a non-empty reason for every unsupported feature', () => {
            for (const f of ALL_FEATURES) {
                if (isPlaygroundSupportedFeature(f)) continue;
                expect(PLAYGROUND_UNSUPPORTED_REASON[f]?.length ?? 0).toBeGreaterThan(0);
            }
        });

        it('has no reason entry for supported features', () => {
            expect(PLAYGROUND_UNSUPPORTED_REASON.chat).toBeUndefined();
            expect(PLAYGROUND_UNSUPPORTED_REASON.search).toBeUndefined();
        });
    });
});
