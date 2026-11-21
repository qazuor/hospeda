// @vitest-environment node
import { describe, expect, expectTypeOf, it } from 'vitest';
import { createTranslations } from '../../../src/lib/i18n';
import { buildInquiryMessage } from '../../../src/lib/listing-contact/build-inquiry-message';

describe('buildInquiryMessage', () => {
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('reuses the ContactHost prefill greeting in %s', (locale) => {
        const { t } = createTranslations(locale);
        const expected = t('conversations.form.prefill.intro');

        const result = buildInquiryMessage({ locale });

        expect(expected).not.toBe('conversations.form.prefill.intro');
        expect(result).toEqual({ message: expected });
    });

    it.each([
        ['es', 'Hola, ¿está disponible del 9/1 al 11/1 para 4 personas?'],
        ['en', 'Hello, is it available from 1/9 to 1/11 for 4 guests?'],
        ['pt', 'Olá, está disponível de 09/01 a 11/01 para 4 pessoas?']
    ] as const)('formats dates and guests in %s', (locale, message) => {
        const input = {
            locale,
            checkIn: '2027-01-09',
            checkOut: '2027-01-11',
            guests: 4,
            capacity: 4
        };

        const result = buildInquiryMessage(input);

        expect(result).toEqual({ message });
    });

    it.each([
        [
            { checkIn: '2027-01-09', checkOut: '2027-01-11' },
            'Hola, ¿está disponible del 9/1 al 11/1?'
        ],
        [{ guests: 1, capacity: 4 }, 'Hola, ¿está disponible para 1 persona?'],
        [{ guests: 4, capacity: 4 }, 'Hola, ¿está disponible para 4 personas?'],
        [{ checkIn: '2027-01-09' }, 'Hola, ¿está disponible a partir del 9/1?'],
        [{ checkOut: '2027-01-11' }, 'Hola, ¿está disponible hasta el 11/1?']
    ] as const)('builds a message from only the supplied fields (%j)', (fields, message) => {
        const result = buildInquiryMessage({ locale: 'es', ...fields });

        expect(result).toEqual({ message });
    });

    it.each([
        '2027-01-09',
        '2027-01-08'
    ])('returns a checkout error without rebuilding for %s', (checkOut) => {
        const result = buildInquiryMessage({ locale: 'es', checkIn: '2027-01-09', checkOut });

        expect(result).toEqual({
            errors: { checkOut: 'La salida tiene que ser después de la llegada' }
        });
    });

    it.each([
        0,
        1.5,
        5,
        Number.NaN
    ])('rejects invalid guest count %s without rebuilding', (guests) => {
        const result = buildInquiryMessage({ locale: 'en', guests, capacity: 4 });

        expect(result).toEqual({
            errors: { guests: 'Enter a whole number of guests between 1 and 4.' }
        });
    });

    it('reports invalid calendar dates without rolling them over', () => {
        const result = buildInquiryMessage({ locale: 'es', checkIn: '2027-02-29' });

        expect(result).toEqual({ errors: { checkIn: 'Ingresá una fecha válida.' } });
    });

    it.each([
        undefined,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        0,
        -1,
        5.5
    ])('rejects a guest count when capacity is %s without rebuilding', (capacity) => {
        const input = {
            locale: 'en',
            guests: 5,
            ...(capacity === undefined ? {} : { capacity })
        } as Parameters<typeof buildInquiryMessage>[0];

        const result = buildInquiryMessage(input);

        expect(result).toEqual({
            errors: { guests: 'The guest limit for this listing is unavailable.' }
        });
    });

    it('requires capacity in the input type when guests are supplied', () => {
        expectTypeOf<{ locale: 'en'; guests: 5 }>().not.toExtend<
            Parameters<typeof buildInquiryMessage>[0]
        >();
    });
});
