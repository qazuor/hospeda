/**
 * @file contact-payload.test.ts
 * @description HOS-1262 — a cleared social network on the accommodation contact
 * page must travel as `null`.
 *
 * `accommodations.socialNetworks` is merged (`||`), so an omitted key keeps the
 * stored link, and `''` fails the flat HTTP schema's `.url()`. Only `null`
 * clears.
 */

import { AccommodationUpdateHttpSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { nullifyClearedSocials } from '@/components/host/editor/forms/contact-payload';

describe('nullifyClearedSocials', () => {
    it('turns an emptied social into an explicit null', () => {
        expect(nullifyClearedSocials({ payload: { facebook: '' } })).toStrictEqual({
            facebook: null
        });
    });

    it('treats whitespace and undefined as cleared', () => {
        expect(
            nullifyClearedSocials({ payload: { twitter: '   ', tiktok: undefined } })
        ).toStrictEqual({ twitter: null, tiktok: null });
    });

    it('leaves a network that has a value alone', () => {
        expect(
            nullifyClearedSocials({ payload: { instagram: 'https://instagram.com/x' } })
        ).toStrictEqual({});
    });

    it('never adds a network the diff did not contain', () => {
        expect(nullifyClearedSocials({ payload: { phone: '' } })).toStrictEqual({});
    });

    it('covers all six networks under their HTTP keys (`linkedin`, lowercase)', () => {
        const payload = {
            facebook: '',
            instagram: '',
            twitter: '',
            linkedin: '',
            tiktok: '',
            youtube: ''
        };

        expect(nullifyClearedSocials({ payload })).toStrictEqual({
            facebook: null,
            instagram: null,
            twitter: null,
            linkedin: null,
            tiktok: null,
            youtube: null
        });
    });

    it('produces a payload the server-side HTTP schema accepts (where `""` is rejected)', () => {
        const cleared = { ...nullifyClearedSocials({ payload: { facebook: '' } }) };

        expect(AccommodationUpdateHttpSchema.safeParse({ facebook: '' }).success).toBe(false);
        expect(AccommodationUpdateHttpSchema.safeParse(cleared).success).toBe(true);
    });
});
