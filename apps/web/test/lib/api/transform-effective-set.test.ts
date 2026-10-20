import { describe, expect, it } from 'vitest';
import { transformProtectedEffectiveSet } from '../../../src/lib/api/transforms';

describe('HOS-1646 · cliente web de capacidades · effective set transform', () => {
    it('decodes Infinity and preserves finite values', () => {
        expect(
            transformProtectedEffectiveSet({
                userId: 'u',
                vertical: 'tourist',
                hasLiveNonTrialTitle: false,
                entitlements: { x: 2 },
                limits: { unlimited: 'Infinity', cap: 5 }
            })
        ).toEqual({
            userId: 'u',
            vertical: 'tourist',
            hasLiveNonTrialTitle: false,
            entitlements: { x: 2 },
            limits: { unlimited: Number.POSITIVE_INFINITY, cap: 5 }
        });
    });
});
