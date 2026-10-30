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

    it('HOS-1721 decodes the pre-trial DRAFT caps only when present', () => {
        expect(
            transformProtectedEffectiveSet({
                userId: 'u',
                vertical: 'accommodation',
                hasLiveNonTrialTitle: false,
                entitlements: {},
                limits: {},
                preTrialDraftLimits: { max_photos_per_accommodation: 15 }
            }).preTrialDraftLimits
        ).toEqual({ max_photos_per_accommodation: 15 });
    });
});
