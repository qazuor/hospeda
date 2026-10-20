import { describe, expect, it } from 'vitest';
import {
    ProtectedEffectiveSetQuerySchema,
    ProtectedEffectiveSetResponseSchema
} from '../../../src/api/billing/protected-effective-set.schema';

describe('HOS-1646 · cliente web de capacidades · protected effective set schemas', () => {
    it('validates query and response including Infinity', () => {
        expect(
            ProtectedEffectiveSetQuerySchema.safeParse({ vertical: 'accommodation' }).success
        ).toBe(true);
        expect(ProtectedEffectiveSetQuerySchema.safeParse({ vertical: 'bad' }).success).toBe(false);
        expect(
            ProtectedEffectiveSetResponseSchema.safeParse({
                userId: '11111111-1111-4111-8111-111111111111',
                vertical: 'accommodation',
                hasLiveNonTrialTitle: false,
                entitlements: { x: 1 },
                limits: { y: 'Infinity' }
            }).success
        ).toBe(true);
        expect(
            ProtectedEffectiveSetResponseSchema.safeParse({
                userId: '11111111-1111-4111-8111-111111111111',
                vertical: 'accommodation',
                hasLiveNonTrialTitle: false,
                entitlements: { x: -1 },
                limits: {}
            }).success
        ).toBe(false);
    });

    it('HOS-1721 accepts an optional preTrialDraftLimits map', () => {
        const base = {
            userId: '11111111-1111-4111-8111-111111111111',
            vertical: 'accommodation',
            hasLiveNonTrialTitle: false,
            entitlements: {},
            limits: {}
        };
        expect(
            ProtectedEffectiveSetResponseSchema.safeParse({
                ...base,
                preTrialDraftLimits: { max_photos_per_accommodation: 15 }
            }).success
        ).toBe(true);
        expect(
            ProtectedEffectiveSetResponseSchema.safeParse({
                ...base,
                preTrialDraftLimits: { max_photos_per_accommodation: -1 }
            }).success
        ).toBe(false);
    });
});
