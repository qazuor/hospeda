/**
 * Schema tests for the venue WhatsApp contract (HOS-2256 section 7.8, OQ-8).
 *
 * The public contact allow-list must keep NOT naming the number (HOS-1076 /
 * HOS-2042, AC-20): the number can only travel in the separate `whatsapp`
 * block, and only in its `PUBLIC` variant.
 */
import { describe, expect, it } from 'vitest';
import {
    VenueOwnerUpdateInputSchema,
    VenuePublicContactInfoSchema,
    VenuePublicWhatsappSchema,
    VenueWhatsappVisibilityEnum,
    VenueWhatsappVisibilityEnumSchema
} from '../../../src/index.js';

describe('VenuePublicContactInfoSchema (AC-20)', () => {
    it('still strips whatsapp, whatever the visibility', () => {
        const parsed = VenuePublicContactInfoSchema.parse({
            mobilePhone: '+54 9 343 1111111',
            whatsapp: '+54 9 343 2222222'
        });

        expect(parsed).not.toHaveProperty('whatsapp');
        expect(JSON.stringify(parsed)).not.toContain('2222222');
    });
});

describe('VenuePublicWhatsappSchema', () => {
    it('keeps the number of the PUBLIC variant', () => {
        expect(
            VenuePublicWhatsappSchema.parse({ visibility: 'PUBLIC', number: '+54 9 343 1' })
        ).toEqual({
            visibility: 'PUBLIC',
            number: '+54 9 343 1'
        });
    });

    it('strips a number smuggled into the LOGGED_IN_ONLY variant (AC-18)', () => {
        const parsed = VenuePublicWhatsappSchema.parse({
            visibility: 'LOGGED_IN_ONLY',
            number: '+54 9 343 2222222'
        });

        expect(parsed).toEqual({ visibility: 'LOGGED_IN_ONLY' });
    });

    it('rejects a PUBLIC variant without a number and an unknown visibility', () => {
        expect(VenuePublicWhatsappSchema.safeParse({ visibility: 'PUBLIC' }).success).toBe(false);
        expect(VenuePublicWhatsappSchema.safeParse({ visibility: 'EVERYONE' }).success).toBe(false);
    });
});

describe('whatsappVisibility (AC-16)', () => {
    it('accepts the two values and rejects anything else', () => {
        for (const value of Object.values(VenueWhatsappVisibilityEnum)) {
            expect(VenueWhatsappVisibilityEnumSchema.safeParse(value).success).toBe(true);
        }
        expect(VenueWhatsappVisibilityEnumSchema.safeParse('public').success).toBe(false);
    });

    it('is writable through the owner update schema and keeps null as "undecided"', () => {
        const set = VenueOwnerUpdateInputSchema.parse({ whatsappVisibility: 'PUBLIC' });
        const cleared = VenueOwnerUpdateInputSchema.parse({ whatsappVisibility: null });

        expect(set.whatsappVisibility).toBe('PUBLIC');
        expect(cleared.whatsappVisibility).toBeNull();
    });
});
