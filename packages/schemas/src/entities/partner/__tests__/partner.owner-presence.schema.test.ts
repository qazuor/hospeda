import { describe, expect, it } from 'vitest';
import { PartnerOwnerPresenceSchema } from '../partner.owner-presence.schema.js';

describe('PartnerOwnerPresenceSchema (AC:V8b:1)', () => {
    it('accepts valid moderated and unmoderated presence blocks', () => {
        expect(
            PartnerOwnerPresenceSchema.safeParse({
                publicPage: 'hidden',
                carousel: 'hidden',
                moderated: true,
                moderationReason: 'Policy'
            }).success
        ).toBe(true);
        expect(
            PartnerOwnerPresenceSchema.safeParse({
                publicPage: 'visible',
                carousel: 'visible',
                moderated: false,
                moderationReason: null
            }).success
        ).toBe(true);
    });
    it('rejects inconsistent or invalid values', () => {
        expect(
            PartnerOwnerPresenceSchema.safeParse({
                publicPage: 'visible',
                carousel: 'visible',
                moderated: false,
                moderationReason: 'old'
            }).success
        ).toBe(false);
        expect(
            PartnerOwnerPresenceSchema.safeParse({
                publicPage: 'visible',
                carousel: 'visible',
                moderated: true,
                moderationReason: ''
            }).success
        ).toBe(false);
        expect(
            PartnerOwnerPresenceSchema.safeParse({
                publicPage: 'public',
                carousel: 'visible',
                moderated: false,
                moderationReason: null
            }).success
        ).toBe(false);
    });
});
