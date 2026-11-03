import { describe, expect, it } from 'vitest';
import { adminCreatePartnerSchema, createPartnerSchema } from '../partner.create.schema.js';

const base = {
    name: 'Test Partner',
    slug: 'test-partner',
    type: 'business',
    lifecycleState: 'ACTIVE'
};

describe('adminCreatePartnerSchema', () => {
    it('requires a valid claim email and trims it', () => {
        expect(adminCreatePartnerSchema.safeParse(base).success).toBe(false);
        expect(
            adminCreatePartnerSchema.safeParse({ ...base, claimEmail: 'no-es-correo' }).success
        ).toBe(false);
        expect(
            adminCreatePartnerSchema.safeParse({ ...base, claimEmail: `${'a'.repeat(316)}@b.co` })
                .success
        ).toBe(false);
        expect(
            adminCreatePartnerSchema.parse({ ...base, claimEmail: '  owner@example.test  ' })
                .claimEmail
        ).toBe('owner@example.test');
    });

    it('keeps claim email out of normal creation and discards owner ids', () => {
        expect('claimEmail' in createPartnerSchema.shape).toBe(false);
        expect(
            createPartnerSchema.parse({
                ...base,
                ownerUserId: '00000000-0000-4000-8000-000000000001'
            })
        ).not.toHaveProperty('ownerUserId');
        expect(
            adminCreatePartnerSchema.parse({
                ...base,
                claimEmail: 'owner@example.test',
                ownerUserId: '00000000-0000-4000-8000-000000000001'
            })
        ).not.toHaveProperty('ownerUserId');
    });
});
