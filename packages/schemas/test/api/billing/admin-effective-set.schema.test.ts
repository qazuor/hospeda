import { describe, expect, it } from 'vitest';
import {
    AdminEffectiveSetQuerySchema,
    AdminEffectiveSetResponseSchema
} from '../../../src/api/billing/admin-effective-set.schema.js';

const valid = {
    userId: '11111111-1111-4111-8111-111111111111',
    vertical: 'accommodation',
    hasLiveNonTrialTitle: false,
    entitlements: { can_embed_video: 1 },
    limits: { max_accommodations: 'Infinity' }
};

describe('TEST:B13a:23 AC:B13a:23 admin effective-set schema', () => {
    it('accepts a JSON-safe Infinity value', () => {
        expect(AdminEffectiveSetResponseSchema.safeParse(valid).success).toBe(true);
    });

    it.each([
        { ...valid, limits: { max_accommodations: -1 } },
        { ...valid, limits: { max_accommodations: Number.NaN } },
        { ...valid, vertical: 'nope' },
        { ...valid, userId: 'not-a-uuid' }
    ])('rejects an invalid response', (value) => {
        expect(AdminEffectiveSetResponseSchema.safeParse(value).success).toBe(false);
    });

    it('rejects an invalid query vertical', () => {
        expect(AdminEffectiveSetQuerySchema.safeParse({ vertical: 'nope' }).success).toBe(false);
    });
});
