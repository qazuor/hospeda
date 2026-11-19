import { describe, expect, it } from 'vitest';
import {
    PartnerClaimCheckRequestSchema,
    PartnerClaimCheckResponseSchema
} from '../../../src/entities/partner/partner-claim.schema';

const PARTNER_ID = 'd32b0f9b-0864-49d8-bf8f-0fb52c40fd15';

describe('PartnerClaimCheckResponseSchema (HOS-2353)', () => {
    it('accepts only a boolean emailMatches', () => {
        expect(PartnerClaimCheckResponseSchema.safeParse({ emailMatches: false }).success).toBe(
            true
        );
        expect(PartnerClaimCheckResponseSchema.safeParse({ emailMatches: 'yes' }).success).toBe(
            false
        );
    });

    it('rejects any extra field, so the claim mailbox can never ride along', () => {
        const result = PartnerClaimCheckResponseSchema.safeParse({
            emailMatches: true,
            email: 'claim@example.test'
        });
        expect(result.success).toBe(false);
    });
});

describe('PartnerClaimCheckRequestSchema (HOS-2353)', () => {
    it('accepts partnerId and secret and rejects unknown fields', () => {
        expect(
            PartnerClaimCheckRequestSchema.safeParse({ partnerId: PARTNER_ID, secret: 's' }).success
        ).toBe(true);
        expect(
            PartnerClaimCheckRequestSchema.safeParse({
                partnerId: PARTNER_ID,
                secret: 's',
                email: 'x@example.test'
            }).success
        ).toBe(false);
    });
});
