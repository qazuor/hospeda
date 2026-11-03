import { describe, expect, it } from 'vitest';
import { PartnerClaimRequestSchema } from '../partner-claim.schema';

/** TEST:V7:9 checks claim request UUID and secret boundary validation. */
describe('PartnerClaimRequestSchema', () => {
    it('rejects a malformed partner id', () => {
        expect(PartnerClaimRequestSchema.safeParse({ partnerId: 'bad', secret: '' }).success).toBe(
            false
        );
    });
    it('accepts an empty secret so it is handled as an opaque 404 by the service', () => {
        expect(
            PartnerClaimRequestSchema.safeParse({
                partnerId: '11111111-1111-4111-8111-111111111111',
                secret: ''
            }).success
        ).toBe(true);
    });
    it('rejects secrets over 512 characters', () => {
        expect(
            PartnerClaimRequestSchema.safeParse({
                partnerId: '11111111-1111-4111-8111-111111111111',
                secret: 'x'.repeat(513)
            }).success
        ).toBe(false);
    });
});
