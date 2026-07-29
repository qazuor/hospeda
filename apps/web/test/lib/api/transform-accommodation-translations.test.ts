/**
 * @file transform-accommodation-translations.test.ts
 * @description `transformAccommodationTranslations` — BETA-199.
 *
 * This transform is where the protected GET's payload becomes what the
 * TranslationPanel reasons about, and it carries the one distinction the whole
 * BETA-199 fix rests on: the premium `richDescription` pair is OMITTED from the
 * response when the owner's plan does not include it, and that omission has to
 * survive as `null` rather than collapsing into the same empty shape as an
 * entitled owner who simply has not written one yet.
 *
 * The two need different UI — hide the row versus show it as unsourced — and
 * after `JSON.parse` only the presence of the KEY tells them apart.
 */

import { describe, expect, it } from 'vitest';
import { transformAccommodationTranslations } from '../../../src/lib/api/transforms';

/** A response from an entitled owner's GET, with the premium pair present. */
const ENTITLED_ITEM: Record<string, unknown> = {
    name: 'Casa del río',
    summary: 'Resumen en español',
    description: 'Descripción en español',
    nameI18n: { es: 'Casa del río', en: 'River house', pt: 'Casa do rio' },
    summaryI18n: { es: 'Resumen en español', en: '', pt: null },
    descriptionI18n: null,
    richDescription: '<p>Rica</p>',
    richDescriptionI18n: { es: '<p>Rica</p>', en: '<p>Rich</p>', pt: null }
};

describe('transformAccommodationTranslations', () => {
    it('carries both the i18n values and the plain source per field', () => {
        const result = transformAccommodationTranslations({ item: ENTITLED_ITEM });

        expect(result.name).toEqual({
            locales: { es: 'Casa del río', en: 'River house', pt: 'Casa do rio' },
            plain: 'Casa del río'
        });
        // The plain column is what makes a never-translated accommodation
        // translatable at all: its i18n column is empty while the source text is
        // right here.
        expect(result.description).toEqual({
            locales: { es: null, en: null, pt: null },
            plain: 'Descripción en español'
        });
    });

    it('normalises empty and missing locale values to null', () => {
        const result = transformAccommodationTranslations({ item: ENTITLED_ITEM });
        expect(result.summary.locales).toEqual({ es: 'Resumen en español', en: null, pt: null });
    });

    it('treats a whitespace-only plain column as absent', () => {
        // The API trims before deciding whether a field is translatable, so the
        // panel must not offer to translate from whitespace.
        const result = transformAccommodationTranslations({
            item: { ...ENTITLED_ITEM, description: '   \n  ' }
        });
        expect(result.description.plain).toBeNull();
    });

    it('exposes richDescription when the response carries the premium pair', () => {
        const result = transformAccommodationTranslations({ item: ENTITLED_ITEM });

        expect(result.richDescription).toEqual({
            locales: { es: '<p>Rica</p>', en: '<p>Rich</p>', pt: null },
            plain: '<p>Rica</p>'
        });
    });

    it('returns null for richDescription when the API omitted the pair', () => {
        // Not-entitled: the route drops BOTH keys. Anything other than `null` here
        // and the panel keeps rendering a row that can never fill in, which is the
        // visible half of BETA-199 (the generate button never goes away).
        const { richDescription, richDescriptionI18n, ...withoutPair } = ENTITLED_ITEM;
        void richDescription;
        void richDescriptionI18n;

        const result = transformAccommodationTranslations({ item: withoutPair });

        expect(result.richDescription).toBeNull();
        // The non-premium fields are untouched by the gate.
        expect(result.name.plain).toBe('Casa del río');
    });

    it('distinguishes an omitted pair from a present-but-empty one', () => {
        // An entitled owner who never wrote a rich description: the keys ARE in the
        // payload, carrying null. That must NOT read as "no plan".
        const result = transformAccommodationTranslations({
            item: { ...ENTITLED_ITEM, richDescription: null, richDescriptionI18n: null }
        });

        expect(result.richDescription).not.toBeNull();
        expect(result.richDescription).toEqual({
            locales: { es: null, en: null, pt: null },
            plain: null
        });
    });

    it('exposes the field when only the i18n half of the pair survives', () => {
        // Defensive: the two keys are meant to travel together, but "present" is
        // decided per key, so a payload carrying either one still counts as exposed
        // rather than silently reading as not-entitled.
        const { richDescription, ...withoutPlain } = ENTITLED_ITEM;
        void richDescription;

        const result = transformAccommodationTranslations({ item: withoutPlain });

        expect(result.richDescription).not.toBeNull();
        expect(result.richDescription?.plain).toBeNull();
        expect(result.richDescription?.locales.en).toBe('<p>Rich</p>');
    });
});
