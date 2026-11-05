/**
 * @file phone-composition.hos2034.test.ts
 * @description HOS-2034: the editors store `composePhoneValue(...)`, so what the
 * server parser sees is `+54 <typed>`. Every owner example must survive that
 * composition, validate through the editor schema, and normalize to the
 * canonical form per field meaning.
 */

import {
    AccommodationUpdateHttpSchema,
    ContactInfoSchema,
    httpToDomainAccommodationUpdate,
    normalizeArgentinePhone
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { AccommodationContactSchema } from '@/components/host/editor/accommodation-edit-form.schema';
import { composePhoneValue, DEFAULT_PHONE_COUNTRY, parsePhoneValue } from '@/lib/phone-countries';

const compose = (number: string) => composePhoneValue({ country: DEFAULT_PHONE_COUNTRY, number });

describe('editor composition -> HTTP schema -> contactInfo (HOS-2034)', () => {
    // The editor's flat `phone` and `whatsapp` fields both map to
    // contactInfo.mobilePhone / contactInfo.whatsapp, which are stored as
    // mobile numbers (+549...). The service normalizer applies the same
    // parser (see packages/service-core normalizer.editor-chain test).
    it.each([
        ['3442 45-2345', '+5493442452345'],
        ['3442452345', '+5493442452345'],
        ['(3442) 45-2345', '+5493442452345'],
        ['03442 452345', '+5493442452345'],
        ['3442 15 45-2345', '+5493442452345'],
        ['+54 9 3442 45-2345', '+5493442452345'],
        ['+5493442452345', '+5493442452345'],
        ['54 3442 452345', '+5493442452345'],
        ['0223-155-1234', '+5492231551234'],
        ['3415123456', '+5493415123456']
    ])('%s saves and is stored as %s', (typed, stored) => {
        const composed = compose(typed);
        expect(
            AccommodationContactSchema.safeParse({ phone: composed, whatsapp: composed }).success
        ).toBe(true);

        const http = AccommodationUpdateHttpSchema.parse({ phone: composed, whatsapp: composed });
        const contactInfo = httpToDomainAccommodationUpdate(http).contactInfo;
        expect(ContactInfoSchema.safeParse(contactInfo).success).toBe(true);
        expect(normalizeArgentinePhone(contactInfo?.mobilePhone ?? '', true)).toBe(stored);
        expect(normalizeArgentinePhone(contactInfo?.whatsapp ?? '', true)).toBe(stored);
    });

    it.each([
        '3442 45-2345',
        '03442 452345',
        '3442 15 45-2345',
        '+54 9 3442 45-2345',
        '54 3442 452345',
        '0223-155-1234'
    ])('edit round-trip of %s does not double-compose', (typed) => {
        const stored = compose(typed);
        const reopened = parsePhoneValue(stored);
        const recomposed = composePhoneValue({
            country: reopened.country,
            number: reopened.number
        });
        expect(recomposed).toBe(stored);
        expect(normalizeArgentinePhone(recomposed, true)).toBe(
            normalizeArgentinePhone(stored, true)
        );
    });

    it('does not prepend the dial code to a value that already carries it', () => {
        expect(compose('+54 9 3442 45-2345')).toBe('+54 9 3442 45-2345');
        expect(compose('54 3442 452345')).toBe('+54 3442 452345');
        expect(compose('3442 45-2345')).toBe('+54 3442 45-2345');
    });

    it('leaves other countries untouched', () => {
        const uy = { iso: 'UY', dialCode: '+598', name: 'Uruguay' };
        expect(composePhoneValue({ country: uy, number: '99 123 456' })).toBe('+598 99 123 456');
    });
});
