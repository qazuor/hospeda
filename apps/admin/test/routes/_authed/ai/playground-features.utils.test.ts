import { AiFeatureSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { AiFeatureId } from '@/features/ai-settings';
import {
    isPlaygroundSupportedFeature,
    PLAYGROUND_SUPPORTED_FEATURES,
    PLAYGROUND_UNSUPPORTED_REASON
} from '../../../../src/routes/_authed/ai/-components/playground-features.utils';

/**
 * Derived from the enum, never hand-listed.
 *
 * This array used to be a literal seven, which silently stopped covering
 * `chat_gastronomy` and `chat_experience` when HOS-400 widened the enum — the
 * "every unsupported feature has a reason" test below kept passing while both
 * new features rendered with no reason at all (HOS-1220).
 */
const ALL_FEATURES: AiFeatureId[] = [...AiFeatureSchema.options];

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
