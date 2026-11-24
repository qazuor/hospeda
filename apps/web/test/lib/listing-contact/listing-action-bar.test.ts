/**
 * @file listing-action-bar.test.ts
 * @description HOS-2579 §6.10.1 row 3 (Llamar): the bar's phone href is the first
 * dialable public phone, normalized like the channel panel's `toTelHref`.
 */
import { describe, expect, it } from 'vitest';
import {
    LISTING_BAR_TEL_HREF_PATTERN,
    resolveListingBarPhoneHref
} from '@/lib/listing-contact/listing-action-bar';
import { toTelHref } from '@/lib/listing-contact/listing-channels';

describe('resolveListingBarPhoneHref', () => {
    it('uses the first phone, normalized like the panel', () => {
        const { href } = resolveListingBarPhoneHref({
            phones: ['+54 (3442) 123-456', '03442 999 999']
        });

        expect(href).toBe('tel:+543442123456');
        expect(href).toBe(toTelHref('+54 (3442) 123-456'));
    });

    it('falls back to the second phone when the first is empty or blank', () => {
        expect(resolveListingBarPhoneHref({ phones: [undefined, '03442 999 999'] }).href).toBe(
            'tel:03442999999'
        );
        expect(resolveListingBarPhoneHref({ phones: ['   ', '03442 999 999'] }).href).toBe(
            'tel:03442999999'
        );
    });

    it('skips a value without enough digits to dial', () => {
        expect(resolveListingBarPhoneHref({ phones: ['call me', '12', null] }).href).toBeNull();
    });

    it('returns null when the listing publishes no phone', () => {
        expect(resolveListingBarPhoneHref({ phones: [] }).href).toBeNull();
    });

    it('only ever returns an href the bar schema accepts', () => {
        const { href } = resolveListingBarPhoneHref({ phones: ['+54 9 3442 000000'] });

        expect(href && LISTING_BAR_TEL_HREF_PATTERN.test(href)).toBe(true);
    });
});
