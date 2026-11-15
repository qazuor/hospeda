import { describe, expect, it } from 'vitest';
import { PartnerPresenceModerationSchema } from '../partner.presence-moderation.schema.js';

describe('PartnerPresenceModerationSchema (AC:V7:14, ACC:12 (sources: action 13), V7 §1.6)', () => {
    it('requires a reason', () => {
        expect(PartnerPresenceModerationSchema.safeParse({ action: 'MODERATE' }).success).toBe(
            false
        );
    });
    it('rejects whitespace-only reasons', () => {
        expect(
            PartnerPresenceModerationSchema.safeParse({ action: 'MODERATE', reason: '   ' }).success
        ).toBe(false);
    });
    it('rejects reasons over 2000 characters', () => {
        expect(
            PartnerPresenceModerationSchema.safeParse({
                action: 'MODERATE',
                reason: 'x'.repeat(2001)
            }).success
        ).toBe(false);
    });
    it('rejects actions outside MODERATE and LIFT', () => {
        expect(
            PartnerPresenceModerationSchema.safeParse({ action: 'REQUEST_FIX', reason: 'reason' })
                .success
        ).toBe(false);
    });
    it('accepts a valid moderation request', () => {
        expect(
            PartnerPresenceModerationSchema.parse({ action: 'MODERATE', reason: '  reason  ' })
        ).toEqual({ action: 'MODERATE', reason: 'reason' });
    });
});
