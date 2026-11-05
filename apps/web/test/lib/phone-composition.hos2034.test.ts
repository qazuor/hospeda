/**
 * @file phone-composition.hos2034.test.ts
 * @description HOS-2034: the editors store `composePhoneValue(...)`, so what the
 * server parser sees is `+54 <typed>`. Every owner example must survive that
 * composition, validate through the editor schema, and normalize to the
 * canonical form per field meaning.
 */

import { normalizeArgentinePhone } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { AccommodationContactSchema } from '@/components/host/editor/accommodation-edit-form.schema';
import { composePhoneValue, DEFAULT_PHONE_COUNTRY, parsePhoneValue } from '@/lib/phone-countries';

const compose = (number: string) => composePhoneValue({ country: DEFAULT_PHONE_COUNTRY, number });

describe('editor composition -> validator -> canonical (HOS-2034)', () => {
    it.each([
        // typed, canonical phone (landline field), canonical whatsapp (mobile field)
        ['3442 45-2345', '+543442452345', '+5493442452345'],
        ['3442452345', '+543442452345', '+5493442452345'],
        ['(3442) 45-2345', '+543442452345', '+5493442452345'],
        ['03442 452345', '+543442452345', '+5493442452345'],
        ['3442 15 45-2345', '+5493442452345', '+5493442452345'],
        ['+54 9 3442 45-2345', '+5493442452345', '+5493442452345'],
        ['+5493442452345', '+5493442452345', '+5493442452345'],
        ['54 3442 452345', '+543442452345', '+5493442452345'],
        ['0223-155-1234', '+542231551234', '+5492231551234'],
        ['3415123456', '+543415123456', '+5493415123456']
    ])('%s saves and normalizes per field', (typed, phone, whatsapp) => {
        const composed = compose(typed);
        const parsed = AccommodationContactSchema.safeParse({
            phone: composed,
            whatsapp: composed
        });
        expect(parsed.success).toBe(true);
        expect(normalizeArgentinePhone(composed, false)).toBe(phone);
        expect(normalizeArgentinePhone(composed, true)).toBe(whatsapp);
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
